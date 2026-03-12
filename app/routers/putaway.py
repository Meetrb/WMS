import asyncio
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.core.config import settings
from app.models.putaway import PutawayTask, WorkerWorkload
from app.services.hybrid_putaway_service import HybridPutawayService
from app.crud import putaway as putaway_crud
from app.api import deps
from app.schemas.putaway import (
    PutawayTask as PutawayTaskSchema,
    PutawayTaskList,
    PutawayTaskCreate,
    PutawayTaskUpdate,
    PutawayTaskStatusUpdate,
    PutawayTaskAssignment,
    PutawayTaskCompletion,
    GeneratePutawayTasksRequest,
    GeneratePutawayTasksResponse,
    QueueInfo,
    RequeueTaskRequest,
    WorkerWorkload as WorkerWorkloadSchema,
    PutawayTaskHistory,
    WorkerTaskDetail,
    BarcodeScanRequest,
    BarcodeScanResponse,
    BinScanRequest,
    BinScanResponse,
    WorkerDashboard,
)
from app.schemas.user import User
from app.db.session import get_db
from app.models.inbound import GRN
from app.models.item_master import ItemMaster
from app.models.warehouse import Bin

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/putaway", tags=["Putaway Management"])

# Initialize service
putaway_service = HybridPutawayService()


# ============================================================================
# TASK GENERATION
# ============================================================================

@router.post("/generate", response_model=GeneratePutawayTasksResponse, status_code=status.HTTP_201_CREATED)
async def generate_putaway_tasks(
    request: GeneratePutawayTasksRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_grn_manager_user)
):
    """
    Generate putaway tasks from a completed GRN.
    This is typically called automatically when GRN is posted,
    but can also be triggered manually.
    
    Requires GRN Manager role.
    """
    try:
        tasks, warnings = await putaway_service.generate_tasks_from_grn(
            db,
            request.grn_id,
            override_suggestions=request.override_suggestions
        )
        
        return GeneratePutawayTasksResponse(
            grn_id=request.grn_id,
            tasks_generated=len(tasks),
            tasks=tasks,
            warnings=warnings
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============================================================================
# TASK MANAGEMENT
# ============================================================================

@router.get("/tasks", response_model=List[PutawayTaskList])
async def get_tasks(
    status: Optional[str] = Query(None, description="Filter by status (PENDING, ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED)"),
    assigned_to: Optional[UUID] = Query(None, description="Filter by assigned worker ID"),
    warehouse_id: Optional[UUID] = Query(None, description="Filter by warehouse ID"),
    grn_id: Optional[UUID] = Query(None, description="Filter by GRN ID"),
    priority_min: Optional[int] = Query(None, ge=1, le=10, description="Minimum priority (1=highest)"),
    priority_max: Optional[int] = Query(None, ge=1, le=10, description="Maximum priority (10=lowest)"),
    from_date: Optional[datetime] = Query(None, description="Created from date"),
    to_date: Optional[datetime] = Query(None, description="Created to date"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum records to return"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get list of putaway tasks with filters"""
    tasks = await putaway_crud.get_tasks(
        db,
        status=status,
        assigned_to_id=assigned_to,
        warehouse_id=warehouse_id,
        priority_min=priority_min,
        priority_max=priority_max,
        from_date=from_date,
        to_date=to_date,
        skip=skip,
        limit=limit
    )
    return tasks


@router.get("/tasks/{task_id}", response_model=PutawayTaskSchema)
async def get_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get putaway task by ID with all details"""
    task = await putaway_crud.get_task(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    
    # Add computed fields
    task_dict = task.__dict__
    task_dict["assigned_to_name"] = task.assigned_to.full_name if task.assigned_to else None
    task_dict["suggested_bin_code"] = task.suggested_bin.code if task.suggested_bin else None
    task_dict["actual_bin_code"] = task.actual_bin.code if task.actual_bin else None
    task_dict["inbound_shipment_number"] = task.inbound_shipment.asn_number if task.inbound_shipment else None
    task_dict["grn_number"] = task.grn.grn_number if task.grn else None
    
    return task


@router.patch("/tasks/{task_id}", response_model=PutawayTaskSchema)
async def update_task(
    task_id: UUID,
    task_update: PutawayTaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Update task details (admin only)"""
    task = await putaway_crud.update_task(db, task_id, task_update)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.post("/tasks/{task_id}/cancel", response_model=PutawayTaskSchema)
async def cancel_task(
    task_id: UUID,
    reason: str = Query(..., description="Reason for cancellation"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Cancel a putaway task (admin only)"""
    task = await putaway_service.cancel_task(db, task_id, reason, current_user.id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


@router.post("/tasks/{task_id}/requeue", response_model=PutawayTaskSchema)
async def requeue_task(
    task_id: UUID,
    request: RequeueTaskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Put a task back in the queue (e.g., worker dropped it)"""
    task = await putaway_service.requeue_task(
        db,
        task_id,
        request.reason,
        new_priority=request.new_priority
    )
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    return task


# ============================================================================
# WORKER TASK OPERATIONS
# ============================================================================

@router.post("/worker/next-task", response_model=Optional[PutawayTaskSchema])
async def get_next_task(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_putaway_worker)
):
    """
    Get the next available task for the current worker.
    Auto-assigns based on workload and queue priority.
    """
    task = await putaway_service.assign_next_task(db, current_user.id)
    return task


@router.get("/worker/my-tasks", response_model=List[PutawayTaskList])
async def get_my_tasks(
    active_only: bool = Query(True, description="Only return active (ASSIGNED/IN_PROGRESS) tasks"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_putaway_worker)
):
    """Get tasks assigned to current worker"""
    tasks = await putaway_crud.get_worker_tasks(db, current_user.id, active_only=active_only)
    return tasks


@router.post("/tasks/{task_id}/start", response_model=PutawayTaskSchema)
async def start_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_putaway_worker)
):
    """Start working on an assigned task"""
    try:
        task = await putaway_service.start_task(db, task_id, current_user.id)
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        return task
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/tasks/{task_id}/complete", response_model=PutawayTaskSchema)
async def complete_task(
    task_id: UUID,
    completion: PutawayTaskCompletion,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_putaway_worker)
):
    """Complete a putaway task"""
    try:
        task = await putaway_service.complete_task(
            db,
            task_id,
            current_user.id,
            completion.actual_bin_id,
            completion.quantity_put
        )
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
        return task
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


# ============================================================================
# WORKER WORKLOAD MANAGEMENT
# ============================================================================

@router.get("/worker/workload", response_model=WorkerWorkloadSchema)
async def get_my_workload(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_putaway_worker)
):
    """Get current workload for the authenticated worker"""
    workload = await putaway_crud.get_worker_workload(db, current_user.id)
    if not workload:
        # Create default workload
        workload = await putaway_service._get_or_create_workload(db, current_user.id)
    
    # Add current tasks
    tasks = await putaway_crud.get_worker_tasks(db, current_user.id, active_only=True)
    setattr(workload, "current_tasks", tasks)
    
    return workload


@router.get("/workers/{worker_id}/workload", response_model=WorkerWorkloadSchema)
async def get_worker_workload(
    worker_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_supervisor_user)  # This is now defined
):
    """Get workload for a specific worker (supervisor only)"""
    workload = await putaway_crud.get_worker_workload(db, worker_id)
    if not workload:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Worker not found")
    
    # Add current tasks
    tasks = await putaway_crud.get_worker_tasks(db, worker_id, active_only=True)
    setattr(workload, "current_tasks", tasks)
    
    return workload


@router.patch("/workers/{worker_id}/capacity", response_model=WorkerWorkloadSchema)
async def update_worker_capacity(
    worker_id: UUID,
    max_concurrent_tasks: int = Query(..., ge=1, le=10, description="Maximum concurrent tasks"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_supervisor_user)
):
    """Update worker's max concurrent tasks (supervisor only)"""
    workload = await putaway_crud.update_worker_capacity(db, worker_id, max_concurrent_tasks)
    return workload


# ============================================================================
# QUEUE MANAGEMENT
# ============================================================================

@router.get("/queue/info", response_model=QueueInfo)
async def get_queue_info(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_supervisor_user)  # Fixed
):
    """Get information about the current putaway queue (supervisor only)"""
    info = await putaway_service.get_queue_info(db)
    return info


@router.get("/queue/next", response_model=Optional[PutawayTaskSchema])
async def peek_next_task(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_supervisor_user)  # Fixed
):
    """Look at the next task in queue without assigning it (supervisor only)"""
    next_id = putaway_service.task_queue.peek()
    if next_id:
        task = await putaway_crud.get_task(db, next_id)
        return task
    return None


# ============================================================================
# TASK HISTORY
# ============================================================================

@router.get("/tasks/{task_id}/history", response_model=List[PutawayTaskHistory])
async def get_task_history(
    task_id: UUID,
    limit: int = Query(50, ge=1, le=500, description="Maximum history records to return"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get history for a specific task"""
    history = await putaway_crud.get_task_history(db, task_id, limit=limit)
    return history


@router.get("/workers/{worker_id}/history", response_model=List[PutawayTaskHistory])
async def get_worker_history(
    worker_id: UUID,
    days: int = Query(7, ge=1, le=90, description="Number of days to look back"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_supervisor_user)  # Fixed
):
    """Get task history for a worker (supervisor only)"""
    from_date = datetime.utcnow() - timedelta(days=days)
    history = await putaway_crud.get_worker_history(db, worker_id, from_date=from_date)
    return history


# ============================================================================
# PERFORMANCE STATISTICS
# ============================================================================

@router.get("/statistics/worker/{worker_id}", response_model=Dict[str, Any])
async def get_worker_statistics(
    worker_id: UUID,
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_supervisor_user)  # Fixed
):
    """Get performance statistics for a worker (supervisor only)"""
    stats = await putaway_crud.get_worker_performance(db, worker_id, days=days)
    return stats



@router.get("/statistics/warehouse/{warehouse_id}", response_model=Dict[str, Any])
async def get_warehouse_putaway_statistics(
    warehouse_id: UUID,
    days: int = Query(7, ge=1, le=90, description="Number of days to analyze"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_supervisor_user)  # Fixed
):
    """Get putaway statistics for a warehouse (supervisor only)"""
    stats = await putaway_crud.get_warehouse_putaway_stats(db, warehouse_id, days=days)
    return stats


# ============================================================================
# MANUAL TASK CREATION (for testing/emergencies)
# ============================================================================

@router.post("/tasks/manual", response_model=PutawayTaskSchema, status_code=status.HTTP_201_CREATED)
async def create_manual_task(
    task_data: PutawayTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Manually create a putaway task (admin only, for testing/emergencies)"""
    task = await putaway_crud.create_task(db, task_data, current_user.id)
    
    # Add to queue
    putaway_service.task_queue.add_task(task.id, task.priority, task.created_at)
    
    return task


# ============================================================================
# GRN-SPECIFIC ENDPOINTS
# ============================================================================

@router.post("/generate-from-grn/{grn_id}", response_model=Dict[str, Any])
async def generate_putaway_from_grn(
    grn_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_supervisor_user)
):
    """
    Manually trigger putaway task generation for a GRN
    Useful if auto-generation fails or for testing
    
    Requires Supervisor role
    """
    try:
        # Check if GRN exists and is POSTED
        grn = await db.get(GRN, grn_id)
        if not grn:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="GRN not found"
            )
        
        if grn.status != 'POSTED':
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"GRN must be POSTED to generate putaway tasks. Current status: {grn.status}"
            )
        
        # Generate tasks
        tasks, warnings = await putaway_service.generate_tasks_from_grn(db, grn_id)
        
        return {
            "message": f"Successfully generated {len(tasks)} putaway tasks",
            "grn_id": str(grn_id),
            "grn_number": grn.grn_number,
            "tasks_generated": len(tasks),
            "warnings": warnings,
            "tasks": tasks
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate putaway tasks: {str(e)}"
        )


@router.get("/grn-status/{grn_id}", response_model=Dict[str, Any])
async def get_grn_putaway_status(
    grn_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Check putaway task generation status for a GRN"""
    grn = await db.get(GRN, grn_id)
    if not grn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GRN not found"
        )
    
    # Count putaway tasks for this GRN
    tasks_count = await db.execute(
        select(func.count()).select_from(PutawayTask).where(PutawayTask.grn_id == grn_id)
    )
    
    return {
        "grn_id": str(grn_id),
        "grn_number": grn.grn_number,
        "status": grn.status,
        "putaway_tasks_generated": getattr(grn, 'putaway_tasks_generated', False),
        "putaway_tasks_generated_at": getattr(grn, 'putaway_tasks_generated_at', None),
        "tasks_count": tasks_count.scalar() or 0
    }


# ============================================================================
# WORKER MOBILE APP ENDPOINTS (Scan → Verify → Put → Complete)
# ============================================================================

@router.get("/worker/dashboard", response_model=WorkerDashboard)
async def get_worker_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_putaway_worker)
):
    """
    Worker's mobile dashboard - shows all active tasks with full details.
    
    Returns:
    - Worker performance summary (tasks assigned, in progress, completed today)
    - List of active tasks with item details, barcodes, and suggested bin locations
    """
    # Get workload
    workload = await putaway_crud.get_worker_workload(db, current_user.id)
    
    # Get active tasks with full details
    tasks = await putaway_crud.get_worker_tasks(db, current_user.id, active_only=True)
    
    task_details = []
    for task in tasks:
        # Load item for barcode info
        item = await db.get(ItemMaster, task.item_id)
        
        # Load suggested bin for location details
        suggested_bin = None
        zone = None
        if task.suggested_bin_id:
            suggested_bin = await db.get(Bin, task.suggested_bin_id)
            # Eagerly load zone to avoid lazy-load in async context
            if suggested_bin and suggested_bin.zone_id:
                from app.models.warehouse import Zone
                zone = await db.get(Zone, suggested_bin.zone_id)
        
        # Load GRN and inbound for reference numbers
        grn = await db.get(GRN, task.grn_id) if task.grn_id else None
        from app.models.inbound import InboundShipment
        inbound = await db.get(InboundShipment, task.inbound_shipment_id) if task.inbound_shipment_id else None
        
        detail = WorkerTaskDetail(
            id=task.id,
            task_number=task.task_number,
            status=task.status,
            priority=task.priority,
            item_id=task.item_id,
            item_sku=task.item_sku,
            item_description=task.item_description,
            item_barcode=item.primary_barcode if item else None,
            item_alt_barcodes=item.alt_barcodes if item and item.alt_barcodes else None,
            quantity_to_put=task.quantity_to_put,
            quantity_put=task.quantity_put or 0,
            source_location=task.source_location,
            grn_number=grn.grn_number if grn else None,
            asn_number=inbound.asn_number if inbound else None,
            suggested_bin_id=task.suggested_bin_id,
            suggested_bin_code=suggested_bin.code if suggested_bin else None,
            suggested_bin_barcode=suggested_bin.barcode if suggested_bin else None,
            suggested_zone=zone.code if zone else None,
            suggested_aisle=suggested_bin.aisle if suggested_bin else None,
            suggested_rack=suggested_bin.rack if suggested_bin else None,
            suggested_shelf=suggested_bin.shelf if suggested_bin else None,
            suggested_position=suggested_bin.bin_position if suggested_bin else None,
            lot_number=task.lot_number,
            batch_number=task.batch_number,
            expiry_date=task.expiry_date,
            assigned_at=task.assigned_at,
            started_at=task.started_at,
        )
        task_details.append(detail)
    
    return WorkerDashboard(
        worker_name=current_user.full_name or current_user.username,
        tasks_assigned=workload.tasks_assigned if workload else 0,
        tasks_in_progress=workload.tasks_in_progress if workload else 0,
        tasks_completed_today=workload.tasks_completed_today if workload else 0,
        items_put_today=workload.items_put_today if workload else 0,
        active_tasks=task_details,
    )


@router.get("/worker/tasks/{task_id}/detail", response_model=WorkerTaskDetail)
async def get_worker_task_detail(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_putaway_worker)
):
    """
    Get full task details for the worker's mobile screen.
    
    Shows:
    - Item info (SKU, description, barcode to scan)
    - Quantity to put away
    - Suggested bin location (zone, aisle, rack, shelf, position)
    - Lot/batch/expiry info
    """
    task = await db.get(PutawayTask, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    
    # Verify task belongs to this worker
    if task.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This task is not assigned to you"
        )
    
    # Load related data
    item = await db.get(ItemMaster, task.item_id)
    suggested_bin = await db.get(Bin, task.suggested_bin_id) if task.suggested_bin_id else None
    grn = await db.get(GRN, task.grn_id) if task.grn_id else None
    from app.models.inbound import InboundShipment
    inbound = await db.get(InboundShipment, task.inbound_shipment_id) if task.inbound_shipment_id else None
    
    # Eager load zone for suggested bin
    if suggested_bin and suggested_bin.zone_id:
        from app.models.warehouse import Zone
        zone = await db.get(Zone, suggested_bin.zone_id)
    else:
        zone = None
    
    return WorkerTaskDetail(
        id=task.id,
        task_number=task.task_number,
        status=task.status,
        priority=task.priority,
        item_id=task.item_id,
        item_sku=task.item_sku,
        item_description=task.item_description,
        item_barcode=item.primary_barcode if item else None,
        item_alt_barcodes=item.alt_barcodes if item and item.alt_barcodes else None,
        quantity_to_put=task.quantity_to_put,
        quantity_put=task.quantity_put or 0,
        source_location=task.source_location,
        grn_number=grn.grn_number if grn else None,
        asn_number=inbound.asn_number if inbound else None,
        suggested_bin_id=task.suggested_bin_id,
        suggested_bin_code=suggested_bin.code if suggested_bin else None,
        suggested_bin_barcode=suggested_bin.barcode if suggested_bin else None,
        suggested_zone=zone.code if zone else None,
        suggested_aisle=suggested_bin.aisle if suggested_bin else None,
        suggested_rack=suggested_bin.rack if suggested_bin else None,
        suggested_shelf=suggested_bin.shelf if suggested_bin else None,
        suggested_position=suggested_bin.bin_position if suggested_bin else None,
        lot_number=task.lot_number,
        batch_number=task.batch_number,
        expiry_date=task.expiry_date,
        assigned_at=task.assigned_at,
        started_at=task.started_at,
    )


@router.post("/worker/tasks/{task_id}/scan-item", response_model=BarcodeScanResponse)
async def scan_item_barcode(
    task_id: UUID,
    scan: BarcodeScanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_putaway_worker)
):
    """
    Step 1: Worker scans the item barcode to verify they have the correct item.
    
    - Compares scanned barcode against item's primary_barcode and alt_barcodes
    - If verified, automatically starts the task (moves to IN_PROGRESS)
    - If not matched, returns error with expected barcode
    
    Flow: Worker picks item → scans barcode → system verifies → task starts
    """
    task = await db.get(PutawayTask, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    
    if task.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This task is not assigned to you"
        )
    
    if task.status not in ('ASSIGNED', 'IN_PROGRESS'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task cannot be scanned in status '{task.status}'. Must be ASSIGNED or IN_PROGRESS."
        )
    
    # Load item to check barcodes
    item = await db.get(ItemMaster, task.item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Item not found in database"
        )
    
    # Check barcode match
    scanned = scan.barcode.strip()
    valid_barcodes = []
    
    if item.primary_barcode:
        valid_barcodes.append(item.primary_barcode.strip())
    
    if item.alt_barcodes and isinstance(item.alt_barcodes, list):
        valid_barcodes.extend([b.strip() for b in item.alt_barcodes if b])
    
    # Also match by SKU code (some scanners may scan SKU label)
    valid_barcodes.append(item.sku_code.strip())
    
    barcode_matched = scanned in valid_barcodes
    
    if not barcode_matched:
        logger.warning(f"❌ Barcode mismatch for task {task.task_number}: "
                      f"scanned='{scanned}', expected={valid_barcodes}")
        return BarcodeScanResponse(
            verified=False,
            message=f"Barcode '{scanned}' does not match item {item.sku_code}. "
                    f"Expected barcode: {item.primary_barcode or item.sku_code}",
            item_sku=item.sku_code,
            item_description=item.description,
            expected_barcode=item.primary_barcode,
            scanned_barcode=scanned,
        )
    
    # Barcode verified - auto-start task if still ASSIGNED
    if task.status == 'ASSIGNED':
        started_task = await putaway_service.start_task(db, task_id, current_user.id)
        if started_task:
            logger.info(f"✅ Task {task.task_number} auto-started after barcode scan by {current_user.username}")
    
    return BarcodeScanResponse(
        verified=True,
        message=f"✅ Item verified: {item.sku_code} - {item.description}",
        item_sku=item.sku_code,
        item_description=item.description,
        expected_barcode=item.primary_barcode,
        scanned_barcode=scanned,
    )


@router.post("/worker/tasks/{task_id}/scan-bin", response_model=BinScanResponse)
async def scan_bin_and_complete(
    task_id: UUID,
    scan: BinScanRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_putaway_worker)
):
    """
    Step 2: Worker scans the destination bin barcode and confirms putaway.
    
    - Worker walks to the suggested bin (or any valid bin)
    - Scans the bin barcode/code
    - Enters quantity placed
    - System validates bin exists, completes the task, updates bin contents
    
    Flow: Worker at bin → scans bin barcode → enters qty → task completed
    """
    task = await db.get(PutawayTask, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Task not found")
    
    if task.assigned_to_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This task is not assigned to you"
        )
    
    if task.status != 'IN_PROGRESS':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Task must be IN_PROGRESS to complete. Current status: '{task.status}'. "
                   f"Scan the item barcode first to start the task."
        )
    
    # Find bin by barcode or code
    scanned_value = scan.bin_barcode.strip()
    
    # Try barcode first, then code
    bin_result = await db.execute(
        select(Bin).where(
            (Bin.barcode == scanned_value) | (Bin.code == scanned_value)
        )
    )
    target_bin = bin_result.scalar_one_or_none()
    
    if not target_bin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Bin with barcode/code '{scanned_value}' not found. "
                   f"Please scan a valid bin barcode."
        )
    
    # Validate bin is active
    if target_bin.status != 'ACTIVE':
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bin {target_bin.code} is {target_bin.status}. Cannot put items in this bin."
        )
    
    if target_bin.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Bin {target_bin.code} is blocked: {target_bin.blocked_reason or 'No reason given'}"
        )
    
    # Validate quantity
    if scan.quantity_put > task.quantity_to_put:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Quantity {scan.quantity_put} exceeds task quantity {task.quantity_to_put}"
        )
    
    # Check if this was the suggested bin
    was_suggested = (task.suggested_bin_id is not None and target_bin.id == task.suggested_bin_id)
    
    # Complete the task via service (updates bin contents, workload, history)
    try:
        completed_task = await putaway_service.complete_task(
            db=db,
            task_id=task_id,
            worker_id=current_user.id,
            actual_bin_id=target_bin.id,
            quantity_put=scan.quantity_put,
        )
        
        if not completed_task:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to complete task"
            )
        
        # Build location string
        location_parts = []
        if target_bin.aisle:
            location_parts.append(f"Aisle {target_bin.aisle}")
        if target_bin.rack:
            location_parts.append(f"Rack {target_bin.rack}")
        if target_bin.shelf:
            location_parts.append(f"Shelf {target_bin.shelf}")
        if target_bin.bin_position:
            location_parts.append(f"Pos {target_bin.bin_position}")
        
        bin_location = " → ".join(location_parts) if location_parts else target_bin.code
        
        logger.info(f"✅ Task {task.task_number} completed by {current_user.username}: "
                    f"{scan.quantity_put} x {task.item_sku} → Bin {target_bin.code}")
        
        return BinScanResponse(
            success=True,
            message=f"✅ Putaway complete! {scan.quantity_put} x {task.item_sku} placed in bin {target_bin.code}",
            task_number=task.task_number,
            task_status="COMPLETED",
            item_sku=task.item_sku,
            quantity_put=scan.quantity_put,
            bin_code=target_bin.code,
            bin_location=bin_location,
            was_suggested_bin=was_suggested,
            completed_at=completed_task.completed_at,
        )
        
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


# ============================================================================
# MAINTENANCE
# ============================================================================

@router.post("/maintenance/cleanup-stale", response_model=Dict[str, int])
async def cleanup_stale_tasks(
    hours_threshold: int = Query(24, ge=1, description="Tasks older than this in 'ASSIGNED' status will be requeued"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """
    Clean up stale assigned tasks (tasks assigned but not started for too long).
    Requeues them so other workers can pick them up.
    """
    threshold_time = datetime.utcnow() - timedelta(hours=hours_threshold)
    
    # Find stale assigned tasks
    result = await db.execute(
        select(PutawayTask)
        .where(
            PutawayTask.status == 'ASSIGNED',
            PutawayTask.assigned_at < threshold_time
        )
    )
    stale_tasks = result.scalars().all()
    
    count = 0
    for task in stale_tasks:
        await putaway_service.requeue_task(
            db,
            task.id,
            f"Auto-requeued after {hours_threshold} hours without progress"
        )
        count += 1
    
    return {"requeued_count": count}