from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, update, delete
from sqlalchemy.orm import selectinload, joinedload
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal

from app.models.putaway import PutawayTask, PutawayTaskHistory, WorkerWorkload
from app.models.user import User
from app.models.warehouse import Bin
from app.models.inbound import InboundShipment, GRN
from app.schemas.putaway import PutawayTaskCreate, PutawayTaskUpdate


# ============================================================================
# BASIC CRUD OPERATIONS
# ============================================================================

async def get_task(db: AsyncSession, task_id: UUID) -> Optional[PutawayTask]:
    """Get putaway task by ID with all relationships"""
    result = await db.execute(
        select(PutawayTask)
        .where(PutawayTask.id == task_id)
        .options(
            selectinload(PutawayTask.inbound_shipment),
            selectinload(PutawayTask.grn),
            selectinload(PutawayTask.asn_shipment_item),
            selectinload(PutawayTask.item),
            selectinload(PutawayTask.suggested_bin),
            selectinload(PutawayTask.actual_bin),
            selectinload(PutawayTask.assigned_to)
        )
    )
    return result.scalar_one_or_none()


async def get_task_by_number(db: AsyncSession, task_number: str) -> Optional[PutawayTask]:
    """Get putaway task by task number"""
    result = await db.execute(
        select(PutawayTask).where(PutawayTask.task_number == task_number)
    )
    return result.scalar_one_or_none()


async def get_tasks(
    db: AsyncSession,
    status: Optional[str] = None,
    assigned_to_id: Optional[UUID] = None,
    warehouse_id: Optional[UUID] = None,
    priority_min: Optional[int] = None,
    priority_max: Optional[int] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 100
) -> List[PutawayTask]:
    """Get tasks with filters"""
    query = select(PutawayTask)
    
    if status:
        query = query.where(PutawayTask.status == status)
    
    if assigned_to_id:
        query = query.where(PutawayTask.assigned_to_id == assigned_to_id)
    
    if warehouse_id:
        query = query.join(
            PutawayTask.inbound_shipment
        ).where(InboundShipment.warehouse_id == warehouse_id)
    
    if priority_min:
        query = query.where(PutawayTask.priority >= priority_min)
    
    if priority_max:
        query = query.where(PutawayTask.priority <= priority_max)
    
    if from_date:
        query = query.where(PutawayTask.created_at >= from_date)
    
    if to_date:
        query = query.where(PutawayTask.created_at <= to_date)
    
    query = query.offset(skip).limit(limit).order_by(
        PutawayTask.priority.asc(),
        PutawayTask.created_at.asc()
    )
    
    result = await db.execute(query)
    return result.scalars().all()


async def create_task(db: AsyncSession, task_data: PutawayTaskCreate, created_by_id: UUID) -> PutawayTask:
    """Create a new putaway task (usually via service, not direct)"""
    db_task = PutawayTask(**task_data.dict(), created_by_id=created_by_id)
    db.add(db_task)
    await db.commit()
    await db.refresh(db_task)
    return db_task


async def update_task(
    db: AsyncSession,
    task_id: UUID,
    task_update: PutawayTaskUpdate
) -> Optional[PutawayTask]:
    """Update task details"""
    db_task = await get_task(db, task_id)
    if not db_task:
        return None
    
    update_data = task_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_task, key, value)
    
    db_task.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(db_task)
    return db_task


# ============================================================================
# WORKER TASK MANAGEMENT
# ============================================================================

async def get_worker_tasks(
    db: AsyncSession,
    worker_id: UUID,
    active_only: bool = True
) -> List[PutawayTask]:
    """Get tasks assigned to a specific worker"""
    query = select(PutawayTask).where(PutawayTask.assigned_to_id == worker_id)
    
    if active_only:
        query = query.where(PutawayTask.status.in_(['ASSIGNED', 'IN_PROGRESS']))
    
    query = query.order_by(
        PutawayTask.priority.asc(),
        PutawayTask.created_at.asc()
    )
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_worker_workload(db: AsyncSession, worker_id: UUID) -> Optional[WorkerWorkload]:
    """Get workload for a worker"""
    result = await db.execute(
        select(WorkerWorkload).where(WorkerWorkload.worker_id == worker_id)
    )
    return result.scalar_one_or_none()


async def update_worker_capacity(
    db: AsyncSession,
    worker_id: UUID,
    max_concurrent_tasks: int
) -> Optional[WorkerWorkload]:
    """Update worker's max concurrent tasks"""
    workload = await get_worker_workload(db, worker_id)
    if not workload:
        # Create if doesn't exist
        worker = await db.get(User, worker_id)
        workload = WorkerWorkload(
            worker_id=worker_id,
            worker_name=worker.full_name or worker.email,
            max_concurrent_tasks=max_concurrent_tasks
        )
        db.add(workload)
    else:
        workload.max_concurrent_tasks = max_concurrent_tasks
    
    await db.commit()
    await db.refresh(workload)
    return workload


# ============================================================================
# TASK HISTORY
# ============================================================================

async def get_task_history(
    db: AsyncSession,
    task_id: UUID,
    limit: int = 50
) -> List[PutawayTaskHistory]:
    """Get history for a specific task"""
    result = await db.execute(
        select(PutawayTaskHistory)
        .where(PutawayTaskHistory.task_id == task_id)
        .order_by(PutawayTaskHistory.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


async def get_worker_history(
    db: AsyncSession,
    worker_id: UUID,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = 100
) -> List[PutawayTaskHistory]:
    """Get task history for a worker"""
    query = select(PutawayTaskHistory).where(
        or_(
            PutawayTaskHistory.old_assignee_id == worker_id,
            PutawayTaskHistory.new_assignee_id == worker_id
        )
    )
    
    if from_date:
        query = query.where(PutawayTaskHistory.created_at >= from_date)
    
    if to_date:
        query = query.where(PutawayTaskHistory.created_at <= to_date)
    
    query = query.order_by(PutawayTaskHistory.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


# ============================================================================
# STATISTICS
# ============================================================================

async def get_worker_performance(
    db: AsyncSession,
    worker_id: UUID,
    days: int = 7
) -> Dict[str, Any]:
    """Get performance statistics for a worker"""
    since_date = datetime.utcnow() - timedelta(days=days)
    
    # Get tasks completed in period
    result = await db.execute(
        select(PutawayTask)
        .where(
            PutawayTask.assigned_to_id == worker_id,
            PutawayTask.status == 'COMPLETED',
            PutawayTask.completed_at >= since_date
        )
    )
    completed_tasks = result.scalars().all()
    
    # Calculate metrics
    total_tasks = len(completed_tasks)
    total_items = sum(float(t.quantity_put) for t in completed_tasks)
    
    # Average completion time
    completion_times = []
    for task in completed_tasks:
        if task.started_at and task.completed_at:
            time_taken = (task.completed_at - task.started_at).total_seconds() / 60
            completion_times.append(time_taken)
    
    avg_time = sum(completion_times) / len(completion_times) if completion_times else 0
    
    # Tasks by day
    tasks_by_day = {}
    for task in completed_tasks:
        day = task.completed_at.date().isoformat()
        tasks_by_day[day] = tasks_by_day.get(day, 0) + 1
    
    return {
        "worker_id": str(worker_id),
        "period_days": days,
        "total_tasks_completed": total_tasks,
        "total_items_put": total_items,
        "average_completion_time_minutes": round(avg_time, 2),
        "tasks_by_day": tasks_by_day,
        "completion_rate": round(total_tasks / days, 2) if days > 0 else 0
    }


async def get_warehouse_putaway_stats(
    db: AsyncSession,
    warehouse_id: UUID,
    days: int = 7
) -> Dict[str, Any]:
    """Get putaway statistics for entire warehouse"""
    since_date = datetime.utcnow() - timedelta(days=days)
    
    # Get all tasks for this warehouse
    result = await db.execute(
        select(PutawayTask)
        .join(PutawayTask.inbound_shipment)
        .where(
            InboundShipment.warehouse_id == warehouse_id,
            PutawayTask.created_at >= since_date
        )
    )
    tasks = result.scalars().all()
    
    # Counts by status
    status_counts = {}
    for task in tasks:
        status_counts[task.status] = status_counts.get(task.status, 0) + 1
    
    # Completed tasks
    completed = [t for t in tasks if t.status == 'COMPLETED']
    total_completed = len(completed)
    total_items = sum(float(t.quantity_put) for t in completed)
    
    # Average completion time
    completion_times = []
    for task in completed:
        if task.created_at and task.completed_at:
            time_taken = (task.completed_at - task.created_at).total_seconds() / 60
            completion_times.append(time_taken)
    
    avg_completion = sum(completion_times) / len(completion_times) if completion_times else 0
    
    # Pending tasks
    pending = [t for t in tasks if t.status == 'PENDING']
    oldest_pending = min([t.created_at for t in pending]) if pending else None
    max_wait = (datetime.utcnow() - oldest_pending).total_seconds() / 60 if oldest_pending else 0
    
    return {
        "warehouse_id": str(warehouse_id),
        "period_days": days,
        "total_tasks_created": len(tasks),
        "total_tasks_completed": total_completed,
        "total_items_put": total_items,
        "status_breakdown": status_counts,
        "average_completion_time_minutes": round(avg_completion, 2),
        "pending_tasks": len(pending),
        "max_wait_time_minutes": round(max_wait, 2),
        "completion_rate": round(total_completed / len(tasks) * 100 if tasks else 0, 2)
    }


# Add to app/crud/putaway.py

async def get_tasks_by_strategy(
    db: AsyncSession,
    strategy: str,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    limit: int = 100
) -> List[PutawayTask]:
    """Get tasks created with a specific strategy"""
    query = select(PutawayTask).where(
        PutawayTask.task_data['strategy'].astext == strategy
    )
    
    if from_date:
        query = query.where(PutawayTask.created_at >= from_date)
    
    if to_date:
        query = query.where(PutawayTask.created_at <= to_date)
    
    query = query.limit(limit).order_by(PutawayTask.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


async def get_task_group_details(db: AsyncSession, task_id: UUID) -> Optional[Dict[str, Any]]:
    """Get detailed information about a task's item group"""
    task = await get_task(db, task_id)
    if not task or not task.task_data:
        return None
    
    return {
        'task_id': task.id,
        'task_number': task.task_number,
        'strategy': task.task_data.get('strategy'),
        'reason': task.task_data.get('reason'),
        'items_count': task.task_data.get('items_count', 1),
        'group_items': task.task_data.get('group_items', []),
        'pallet_id': task.task_data.get('pallet_id'),
        'zone': task.task_data.get('zone')
    }


async def get_strategy_statistics(
    db: AsyncSession,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None
) -> Dict[str, Any]:
    """Get statistics about strategy usage"""
    query = select(PutawayTask)
    
    if from_date:
        query = query.where(PutawayTask.created_at >= from_date)
    
    if to_date:
        query = query.where(PutawayTask.created_at <= to_date)
    
    result = await db.execute(query)
    tasks = result.scalars().all()
    
    strategy_counts = {'item-wise': 0, 'pallet-wise': 0, 'zone-wise': 0, 'unknown': 0}
    total_items = 0
    total_quantity = Decimal('0')
    
    for task in tasks:
        if task.task_data and 'strategy' in task.task_data:
            strategy = task.task_data['strategy']
            if strategy in strategy_counts:
                strategy_counts[strategy] += 1
            else:
                strategy_counts['unknown'] += 1
        else:
            strategy_counts['unknown'] += 1
        
        if task.task_data and 'items_count' in task.task_data:
            total_items += task.task_data['items_count']
        else:
            total_items += 1
        
        total_quantity += task.quantity_to_put
    
    return {
        'total_tasks': len(tasks),
        'strategy_breakdown': strategy_counts,
        'total_items_processed': total_items,
        'total_quantity_processed': float(total_quantity),
        'average_items_per_task': total_items / len(tasks) if tasks else 0
    }