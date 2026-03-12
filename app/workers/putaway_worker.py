# app/workers/putaway_worker.py
import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from sqlalchemy import select, func, and_, or_, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.exc import SQLAlchemyError

from app.core.config import settings
from app.models.putaway import PutawayTask, WorkerWorkload
from app.models.user import User
from app.services.hybrid_putaway_service import HybridPutawayService
from app.db.session import AsyncSessionLocal

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class PutawayBackgroundWorker:
    """
    Background worker that monitors the putaway queue and auto-assigns tasks
    to available workers based on workload and priority.
    
    Features:
    - Automatic task assignment with priority-based ordering
    - Round-robin worker distribution
    - Stale task monitoring and requeuing
    - Worker health monitoring
    - Graceful shutdown handling
    - Comprehensive error recovery
    """
    
    def __init__(self):
        self.service = HybridPutawayService()
        self.is_running = False
        self.check_interval = getattr(settings, 'WORKER_CHECK_INTERVAL', 10)
        self.stale_hours = getattr(settings, 'WORKER_STALE_TASK_HOURS', 1)
        self.stuck_hours = getattr(settings, 'WORKER_STUCK_TASK_HOURS', 4)
        self._task: Optional[asyncio.Task] = None
        self._stats = {
            'cycles': 0,
            'tasks_assigned': 0,
            'tasks_requeued': 0,
            'errors': 0,
            'last_cycle_time': None
        }
        logger.info(f"🛠️ Putaway worker initialized with check interval: {self.check_interval}s")
    
    async def sync_workers_from_users(self):
        """
        Auto-sync workers from users table.
        
        Finds all active users with role='putaway worker' and creates
        WorkerWorkload entries for any that don't already exist.
        This ensures putaway tasks can be assigned automatically.
        """
        async with AsyncSessionLocal() as db:
            try:
                # Get all active putaway workers from users table
                users_result = await db.execute(
                    select(User).where(
                        and_(
                            User.role == 'putaway worker',
                            User.is_active == True
                        )
                    )
                )
                putaway_users = users_result.scalars().all()
                
                if not putaway_users:
                    logger.warning("⚠️ No users with role 'putaway worker' found in users table!")
                    logger.info("💡 Tip: Create users with role 'putaway worker' to enable task assignment")
                    return
                
                logger.info(f"👷 Found {len(putaway_users)} putaway worker(s) in users table")
                
                # Get existing worker_workload entries
                existing_result = await db.execute(select(WorkerWorkload))
                existing_workers = {w.worker_id: w for w in existing_result.scalars().all()}
                
                new_count = 0
                for user in putaway_users:
                    if user.id not in existing_workers:
                        # Create new WorkerWorkload entry
                        workload = WorkerWorkload(
                            worker_id=user.id,
                            worker_name=user.full_name or user.username,
                            tasks_assigned=0,
                            tasks_in_progress=0,
                            total_active_tasks=0,
                            max_concurrent_tasks=3,  # Default capacity
                            tasks_completed_today=0,
                            items_put_today=0
                        )
                        db.add(workload)
                        new_count += 1
                        logger.info(f"  ✅ Registered worker: {user.full_name or user.username} "
                                   f"(ID: {user.id}, Email: {user.email})")
                    else:
                        existing = existing_workers[user.id]
                        logger.debug(f"  ℹ️ Worker already registered: {user.full_name or user.username} "
                                    f"({existing.total_active_tasks}/{existing.max_concurrent_tasks} tasks)")
                
                if new_count > 0:
                    await db.commit()
                    logger.info(f"✅ Registered {new_count} new putaway worker(s) in worker_workload table")
                else:
                    logger.info(f"✅ All {len(putaway_users)} putaway workers already registered")
                
                # Also remove workers who are no longer active or no longer have putaway role
                active_putaway_ids = {u.id for u in putaway_users}
                removed_count = 0
                for worker_id, workload in existing_workers.items():
                    if worker_id not in active_putaway_ids:
                        # Check if user still exists but changed role
                        user_check = await db.get(User, worker_id)
                        if not user_check or not user_check.is_active or user_check.role != 'putaway worker':
                            if workload.total_active_tasks == 0:
                                await db.delete(workload)
                                removed_count += 1
                                logger.info(f"  🗑️ Removed inactive worker: {workload.worker_name}")
                            else:
                                logger.warning(f"  ⚠️ Worker {workload.worker_name} changed role but has "
                                             f"{workload.total_active_tasks} active tasks. Keeping until tasks complete.")
                
                if removed_count > 0:
                    await db.commit()
                    logger.info(f"🗑️ Removed {removed_count} inactive worker(s) from worker_workload")
                    
            except Exception as e:
                logger.error(f"❌ Error syncing workers from users table: {str(e)}")
                logger.exception("Full traceback:")
                await db.rollback()
    
    async def start(self):
        """Start the background worker with error recovery"""
        self.is_running = True
        logger.info("🚀 Putaway background worker started")
        logger.info(f"⚙️ Configuration: Check Interval={self.check_interval}s, "
                   f"Stale Hours={self.stale_hours}, Stuck Hours={self.stuck_hours}")
        
        # Initial sync: register putaway workers from users table
        logger.info("🔄 Initial worker sync from users table...")
        await self.sync_workers_from_users()
        
        consecutive_errors = 0
        
        while self.is_running:
            cycle_start = datetime.utcnow()
            try:
                # Periodically re-sync workers (every 30 cycles = ~5 minutes)
                if self._stats['cycles'] > 0 and self._stats['cycles'] % 30 == 0:
                    await self.sync_workers_from_users()
                
                # Run main worker cycles
                await self.process_queue()
                await self.monitor_stale_tasks()
                await self.monitor_worker_health()
                
                # Update stats
                self._stats['cycles'] += 1
                self._stats['last_cycle_time'] = datetime.utcnow()
                consecutive_errors = 0  # Reset on success
                
                # Log stats periodically
                if self._stats['cycles'] % 60 == 0:  # Every ~10 minutes
                    logger.info(f"📊 Worker stats: Cycles={self._stats['cycles']}, "
                               f"Tasks Assigned={self._stats['tasks_assigned']}, "
                               f"Tasks Requeued={self._stats['tasks_requeued']}, "
                               f"Errors={self._stats['errors']}")
                
                # Calculate sleep time
                cycle_duration = (datetime.utcnow() - cycle_start).total_seconds()
                sleep_time = max(0, self.check_interval - cycle_duration)
                
                if sleep_time > 0:
                    logger.debug(f"Worker cycle completed in {cycle_duration:.2f}s. "
                                f"Waiting {sleep_time:.2f}s...")
                    await asyncio.sleep(sleep_time)
                
            except asyncio.CancelledError:
                logger.info("Worker task cancelled - initiating graceful shutdown")
                break
                
            except Exception as e:
                consecutive_errors += 1
                self._stats['errors'] += 1
                
                # Exponential backoff for errors
                error_sleep = min(30 * (2 ** min(consecutive_errors - 1, 3)), 300)  # Max 5 minutes
                
                logger.error(f"❌ Error in putaway worker (attempt {consecutive_errors}): {str(e)}", 
                           exc_info=True)
                logger.info(f"⏳ Waiting {error_sleep}s before retry...")
                
                await asyncio.sleep(error_sleep)
        
        logger.info("🛑 Putaway background worker stopped")
    
    async def stop(self):
        """Stop the background worker gracefully"""
        logger.info("🛑 Stopping putaway background worker...")
        self.is_running = False
        
        # Cancel the task if it exists
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        
        # Log final stats
        logger.info(f"📊 Final worker stats: {self._stats}")
        logger.info("✅ Putaway background worker stopped gracefully")
    
    async def process_queue(self):
        """
        Main queue processing logic with improved error handling and batch processing.
        Assigns pending tasks to available workers based on priority and round-robin.
        """
        async with AsyncSessionLocal() as db:
            try:
                # Get queue info with count
                pending_count_result = await db.execute(
                    select(func.count()).select_from(PutawayTask).where(PutawayTask.status == 'PENDING')
                )
                total_pending = pending_count_result.scalar() or 0
                
                if total_pending == 0:
                    logger.debug("No pending tasks to process")
                    return
                
                # Get available workers with capacity, ordered by workload
                workers_result = await db.execute(
                    select(WorkerWorkload)
                    .where(WorkerWorkload.total_active_tasks < WorkerWorkload.max_concurrent_tasks)
                    .order_by(
                        WorkerWorkload.total_active_tasks.asc(),
                        WorkerWorkload.last_task_assigned_at.asc().nullsfirst()
                    )
                )
                workers = workers_result.scalars().all()
                
                workers_available = len(workers)
                
                if workers_available == 0:
                    logger.info(f"⏳ No workers available, {total_pending} tasks remain in queue")
                    
                    # Log worker status for debugging
                    await self._log_worker_status(db)
                    return
                
                logger.info(f"📊 Processing queue: {total_pending} pending, {workers_available} workers available")
                
                # Get pending tasks ordered by priority (lower number = higher priority)
                # and then by creation date (FIFO)
                tasks_result = await db.execute(
                    select(PutawayTask)
                    .where(PutawayTask.status == 'PENDING')
                    .order_by(
                        PutawayTask.priority.asc(),  # Priority 1 (highest) first
                        PutawayTask.created_at.asc()  # Oldest first
                    )
                    .limit(workers_available * 2)  # Limit to avoid overwhelming
                )
                pending_tasks = tasks_result.scalars().all()
                
                if not pending_tasks:
                    return
                
                # Assign tasks round-robin
                assigned_count = 0
                worker_tasks = {w.worker_id: [] for w in workers}
                
                for task in pending_tasks:
                    # Find worker with capacity using round-robin
                    worker = await self._find_available_worker(db, workers, start_idx=assigned_count % workers_available)
                    
                    if not worker:
                        logger.warning("No workers with capacity available for remaining tasks")
                        break
                    
                    # Assign task to worker
                    await self._assign_task_to_worker(db, task, worker)
                    assigned_count += 1
                    worker_tasks[worker.worker_id].append(task.task_number)
                    
                    logger.info(f"✅ Assigned task {task.task_number} (Priority {task.priority}) "
                              f"to worker {worker.worker_name}")
                
                if assigned_count > 0:
                    await db.commit()
                    self._stats['tasks_assigned'] += assigned_count
                    
                    # Log summary
                    logger.info(f"📈 Assigned {assigned_count} tasks to workers")
                    for worker_id, tasks in worker_tasks.items():
                        if tasks:
                            logger.debug(f"  👤 Worker {worker_id}: {len(tasks)} tasks")
                
            except SQLAlchemyError as e:
                logger.error(f"❌ Database error in process_queue: {str(e)}", exc_info=True)
                await db.rollback()
                raise
                
            except Exception as e:
                logger.error(f"❌ Error in process_queue: {str(e)}", exc_info=True)
                await db.rollback()
                raise
    
    async def _find_available_worker(self, db: AsyncSession, workers: List, start_idx: int = 0) -> Optional[WorkerWorkload]:
        """
        Find an available worker with capacity using round-robin approach.
        """
        if not workers:
            return None
        
        # Try each worker starting from start_idx
        for i in range(len(workers)):
            idx = (start_idx + i) % len(workers)
            worker = workers[idx]
            
            # Refresh worker to get latest state
            refresh_result = await db.execute(
                select(WorkerWorkload).where(WorkerWorkload.worker_id == worker.worker_id)
            )
            current_worker = refresh_result.scalar_one_or_none()
            
            if current_worker and current_worker.total_active_tasks < current_worker.max_concurrent_tasks:
                return current_worker
        
        return None
    
    async def _assign_task_to_worker(self, db: AsyncSession, task: PutawayTask, worker: WorkerWorkload):
        """
        Assign a task to a worker and update workload.
        """
        # Assign task
        task.assigned_to_id = worker.worker_id
        task.status = 'ASSIGNED'
        task.assigned_at = datetime.utcnow()
        
        # Update worker workload
        worker.tasks_assigned += 1
        worker.total_active_tasks += 1
        worker.last_task_assigned_at = datetime.utcnow()
    
    async def _log_worker_status(self, db: AsyncSession):
        """
        Log worker status for debugging when no workers are available.
        """
        try:
            # Get all workers
            result = await db.execute(select(WorkerWorkload))
            all_workers = result.scalars().all()
            
            if all_workers:
                logger.debug("Current worker status:")
                for w in all_workers:
                    logger.debug(f"  👤 {w.worker_name}: {w.total_active_tasks}/{w.max_concurrent_tasks} active")
            else:
                logger.warning("⚠️ No workers found in worker_workload table!")
                logger.info("💡 Workers are auto-synced from users with role 'putaway worker'")
                logger.info("💡 Make sure you have active users with role='putaway worker' in the users table")
                
        except Exception as e:
            logger.error(f"Error logging worker status: {e}")
    
    async def monitor_stale_tasks(self):
        """
        Monitor and requeue stale tasks that have been assigned but not started.
        Stale tasks are those in ASSIGNED state for longer than WORKER_STALE_TASK_HOURS.
        """
        async with AsyncSessionLocal() as db:
            try:
                threshold = datetime.utcnow() - timedelta(hours=self.stale_hours)
                
                # Find tasks that have been assigned but not started for > threshold
                result = await db.execute(
                    select(PutawayTask)
                    .where(
                        and_(
                            PutawayTask.status == 'ASSIGNED',
                            PutawayTask.assigned_at < threshold
                        )
                    )
                )
                stale_tasks = result.scalars().all()
                
                if stale_tasks:
                    logger.warning(f"⚠️ Found {len(stale_tasks)} stale tasks (assigned for >{self.stale_hours} hour)")
                
                for task in stale_tasks:
                    logger.warning(f"⚠️ Task {task.task_number} is stale (assigned at {task.assigned_at}), requeuing")
                    
                    # Store worker_id before clearing
                    worker_id = task.assigned_to_id
                    
                    # Requeue the task
                    task.status = 'PENDING'
                    task.assigned_to_id = None
                    task.assigned_at = None
                    
                    # Update workload if needed
                    if worker_id:
                        workload_result = await db.execute(
                            select(WorkerWorkload).where(WorkerWorkload.worker_id == worker_id)
                        )
                        workload = workload_result.scalar_one_or_none()
                        if workload:
                            workload.tasks_assigned = max(0, workload.tasks_assigned - 1)
                            workload.total_active_tasks = max(0, workload.total_active_tasks - 1)
                            logger.debug(f"  ↻ Updated workload for worker {workload.worker_name}")
                
                if stale_tasks:
                    await db.commit()
                    self._stats['tasks_requeued'] += len(stale_tasks)
                    logger.info(f"🔄 Requeued {len(stale_tasks)} stale tasks")
                    
            except SQLAlchemyError as e:
                logger.error(f"❌ Database error in monitor_stale_tasks: {str(e)}", exc_info=True)
                await db.rollback()
                
            except Exception as e:
                logger.error(f"❌ Error in monitor_stale_tasks: {str(e)}", exc_info=True)
                await db.rollback()
    
    async def monitor_worker_health(self):
        """
        Check worker health and reset stuck tasks.
        Stuck tasks are those in IN_PROGRESS state for longer than WORKER_STUCK_TASK_HOURS.
        """
        async with AsyncSessionLocal() as db:
            try:
                # Find tasks in progress for > threshold (likely stuck)
                threshold = datetime.utcnow() - timedelta(hours=self.stuck_hours)
                
                result = await db.execute(
                    select(PutawayTask)
                    .where(
                        and_(
                            PutawayTask.status == 'IN_PROGRESS',
                            PutawayTask.started_at < threshold
                        )
                    )
                )
                stuck_tasks = result.scalars().all()
                
                if stuck_tasks:
                    logger.warning(f"⚠️ Found {len(stuck_tasks)} stuck tasks (in progress for >{self.stuck_hours} hours)")
                
                for task in stuck_tasks:
                    logger.error(f"⚠️ Task {task.task_number} appears stuck (started at {task.started_at}), requeuing")
                    
                    # Store worker_id before clearing
                    worker_id = task.assigned_to_id
                    
                    # Requeue the task
                    task.status = 'PENDING'
                    task.assigned_to_id = None
                    task.assigned_at = None
                    task.started_at = None
                    
                    # Update workload
                    if worker_id:
                        workload_result = await db.execute(
                            select(WorkerWorkload).where(WorkerWorkload.worker_id == worker_id)
                        )
                        workload = workload_result.scalar_one_or_none()
                        if workload:
                            workload.tasks_in_progress = max(0, workload.tasks_in_progress - 1)
                            workload.total_active_tasks = max(0, workload.total_active_tasks - 1)
                            logger.debug(f"  ↻ Updated workload for worker {workload.worker_name}")
                
                if stuck_tasks:
                    await db.commit()
                    self._stats['tasks_requeued'] += len(stuck_tasks)
                    logger.info(f"🔄 Requeued {len(stuck_tasks)} stuck tasks")
                    
            except SQLAlchemyError as e:
                logger.error(f"❌ Database error in monitor_worker_health: {str(e)}", exc_info=True)
                await db.rollback()
                
            except Exception as e:
                logger.error(f"❌ Error in monitor_worker_health: {str(e)}", exc_info=True)
                await db.rollback()
    
    async def get_stats(self) -> Dict[str, Any]:
        """Get worker statistics"""
        return {
            **self._stats,
            'is_running': self.is_running,
            'check_interval': self.check_interval,
            'stale_hours': self.stale_hours,
            'stuck_hours': self.stuck_hours
        }
    
    async def force_process_queue(self):
        """Force immediate queue processing (for testing/admin purposes)"""
        logger.info("🔄 Forcing queue processing...")
        await self.process_queue()
        return {"message": "Queue processing triggered", "stats": await self.get_stats()}


# Singleton instance
putaway_worker = PutawayBackgroundWorker()


async def start_putaway_worker():
    """
    Start the putaway worker (called from main.py)
    Returns the asyncio task for the worker.
    """
    try:
        # Check if worker is already running
        if putaway_worker._task and not putaway_worker._task.done():
            logger.warning("⚠️ Putaway worker is already running")
            return putaway_worker._task
        
        # Create and store the task
        task = asyncio.create_task(
            putaway_worker.start(),
            name="putaway_worker"
        )
        
        # Store the task reference
        putaway_worker._task = task
        
        # Add done callback for cleanup
        def task_done_callback(future):
            try:
                if future.exception():
                    logger.error(f"❌ Putaway worker task failed: {future.exception()}")
                else:
                    logger.info("✅ Putaway worker task completed normally")
            except asyncio.CancelledError:
                logger.info("Putaway worker task was cancelled")
            except Exception as e:
                logger.error(f"Error in task callback: {e}")
        
        task.add_done_callback(task_done_callback)
        
        logger.info("✅ Putaway background worker task created and started")
        logger.info(f"💡 Worker will check for tasks every {putaway_worker.check_interval} seconds")
        
        return task
        
    except Exception as e:
        logger.error(f"❌ Failed to start putaway worker: {str(e)}", exc_info=True)
        raise


async def stop_putaway_worker():
    """
    Stop the putaway worker gracefully.
    """
    try:
        logger.info("🛑 Stopping putaway worker...")
        
        # Stop the worker
        await putaway_worker.stop()
        
        # Cancel the task if it exists
        if putaway_worker._task and not putaway_worker._task.done():
            putaway_worker._task.cancel()
            try:
                await putaway_worker._task
            except asyncio.CancelledError:
                pass
            except Exception as e:
                logger.error(f"Error during task cancellation: {e}")
        
        # Get final stats
        stats = await putaway_worker.get_stats()
        logger.info(f"📊 Final worker stats: {stats}")
        
        logger.info("✅ Putaway background worker stopped gracefully")
        
    except Exception as e:
        logger.error(f"❌ Error stopping putaway worker: {str(e)}", exc_info=True)
        raise


# For testing purposes
async def test_worker():
    """Test function to verify worker functionality"""
    logger.info("🧪 Testing putaway worker...")
    
    # Start worker
    task = await start_putaway_worker()
    
    # Let it run for a few cycles
    await asyncio.sleep(30)
    
    # Stop worker
    await stop_putaway_worker()
    
    logger.info("✅ Worker test completed")


if __name__ == "__main__":
    # Run test if script is executed directly
    asyncio.run(test_worker())