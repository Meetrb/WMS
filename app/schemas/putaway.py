from pydantic import BaseModel, Field, validator
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any
from decimal import Decimal


# ============================================================================
# BASE SCHEMAS
# ============================================================================

class PutawayTaskBase(BaseModel):
    """Base schema for putaway task"""
    task_number: Optional[str] = None
    inbound_shipment_id: UUID
    grn_id: UUID
    asn_shipment_item_id: UUID
    item_id: UUID
    item_sku: str
    item_description: Optional[str] = None
    quantity_to_put: Decimal
    source_location: Optional[str] = None
    suggested_bin_id: Optional[UUID] = None
    lot_number: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    priority: int = 5
    notes: Optional[str] = None
    task_data: Optional[Dict[str, Any]] = None


class PutawayTaskCreate(PutawayTaskBase):
    """Schema for creating a putaway task"""
    pass


class PutawayTaskUpdate(BaseModel):
    """Schema for updating a putaway task"""
    suggested_bin_id: Optional[UUID] = None
    actual_bin_id: Optional[UUID] = None
    priority: Optional[int] = None
    notes: Optional[str] = None
    task_data: Optional[Dict[str, Any]] = None


class PutawayTaskStatusUpdate(BaseModel):
    """Schema for updating task status"""
    status: str = Field(..., pattern='^(ASSIGNED|IN_PROGRESS|COMPLETED|CANCELLED|ON_HOLD)$')
    notes: Optional[str] = None


class PutawayTaskAssignment(BaseModel):
    """Schema for assigning task to worker"""
    worker_id: UUID
    notes: Optional[str] = None


class PutawayTaskCompletion(BaseModel):
    """Schema for completing a putaway task"""
    actual_bin_id: UUID
    quantity_put: Decimal
    notes: Optional[str] = None


# ============================================================================
# RESPONSE SCHEMAS
# ============================================================================

class PutawayTaskInDB(PutawayTaskBase):
    """Schema for putaway task from database"""
    id: UUID
    quantity_put: Decimal = 0
    assigned_to_id: Optional[UUID] = None
    assigned_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    status: str
    queue_position: Optional[int] = None
    created_by_id: UUID
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PutawayTask(PutawayTaskInDB):
    """Schema for API responses with related data"""
    assigned_to_name: Optional[str] = None
    suggested_bin_code: Optional[str] = None
    actual_bin_code: Optional[str] = None
    inbound_shipment_number: Optional[str] = None
    grn_number: Optional[str] = None


class PutawayTaskList(BaseModel):
    """Schema for list view"""
    id: UUID
    task_number: str
    item_sku: str
    item_description: Optional[str] = None
    quantity_to_put: Decimal
    quantity_put: Decimal
    status: str
    priority: int
    assigned_to_name: Optional[str] = None
    created_at: datetime
    completed_at: Optional[datetime] = None


# ============================================================================
# WORKER WORKLOAD SCHEMAS
# ============================================================================

class WorkerWorkloadBase(BaseModel):
    worker_id: UUID
    worker_name: Optional[str] = None
    max_concurrent_tasks: int = 3


class WorkerWorkloadCreate(WorkerWorkloadBase):
    pass


class WorkerWorkloadUpdate(BaseModel):
    max_concurrent_tasks: Optional[int] = None


class WorkerWorkloadInDB(WorkerWorkloadBase):
    id: UUID
    tasks_assigned: int
    tasks_in_progress: int
    total_active_tasks: int
    tasks_completed_today: int
    items_put_today: Decimal
    last_task_assigned_at: Optional[datetime] = None
    last_task_completed_at: Optional[datetime] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class WorkerWorkload(WorkerWorkloadInDB):
    """Worker workload with current tasks"""
    current_tasks: List[PutawayTaskList] = []


# ============================================================================
# TASK GENERATION SCHEMAS
# ============================================================================

class GeneratePutawayTasksRequest(BaseModel):
    """Request to generate putaway tasks from GRN"""
    grn_id: UUID
    override_suggestions: bool = False
    priority_override: Optional[int] = None


class GeneratePutawayTasksResponse(BaseModel):
    """Response for task generation"""
    grn_id: UUID
    tasks_generated: int
    tasks: List[PutawayTask]
    warnings: List[str] = []


# ============================================================================
# QUEUE MANAGEMENT SCHEMAS
# ============================================================================

class QueueInfo(BaseModel):
    """Information about the putaway queue"""
    total_pending: int
    total_assigned: int
    total_in_progress: int
    average_wait_time_minutes: Optional[float] = None
    oldest_task_waiting_minutes: Optional[float] = None
    tasks_by_priority: Dict[int, int]
    workers_available: int
    workers_at_capacity: int


class RequeueTaskRequest(BaseModel):
    """Request to put a task back in queue"""
    task_id: UUID
    reason: str
    new_priority: Optional[int] = None


# ============================================================================
# HISTORY SCHEMAS
# ============================================================================

class PutawayTaskHistory(BaseModel):
    id: UUID
    task_id: UUID
    old_status: Optional[str] = None
    new_status: str
    old_assignee_name: Optional[str] = None
    new_assignee_name: Optional[str] = None
    notes: Optional[str] = None
    changed_by_name: str
    created_at: datetime

    class Config:
        from_attributes = True



# Add these to your existing schemas

class PutawayStrategyInfo(BaseModel):
    """Information about the putaway strategy used for a task"""
    strategy: str  # 'item-wise', 'pallet-wise', 'zone-wise'
    reason: str
    items_count: int
    pallet_id: Optional[str] = None
    zone: Optional[str] = None


class HybridTaskGenerationResult(BaseModel):
    """Result of hybrid task generation"""
    grn_id: UUID
    grn_number: str
    total_tasks: int
    assigned_tasks: int
    queued_tasks: int
    strategy_breakdown: Dict[str, int]
    tasks: List[PutawayTask]
    warnings: List[str] = []


class TaskGroupInfo(BaseModel):
    """Information about a group of items in a task"""
    strategy: str
    item_count: int
    total_quantity: Decimal
    items: List[Dict[str, Any]]


# ============================================================================
# WORKER MOBILE APP SCHEMAS
# ============================================================================

class WorkerTaskDetail(BaseModel):
    """Full task detail for worker's mobile screen"""
    id: UUID
    task_number: str
    status: str
    priority: int
    
    # Item info
    item_id: UUID
    item_sku: str
    item_description: Optional[str] = None
    item_barcode: Optional[str] = None
    item_alt_barcodes: Optional[List[str]] = None
    
    # Quantities
    quantity_to_put: Decimal
    quantity_put: Decimal = Decimal('0')
    
    # Source
    source_location: Optional[str] = None
    grn_number: Optional[str] = None
    asn_number: Optional[str] = None
    
    # Suggested destination
    suggested_bin_id: Optional[UUID] = None
    suggested_bin_code: Optional[str] = None
    suggested_bin_barcode: Optional[str] = None
    suggested_zone: Optional[str] = None
    suggested_aisle: Optional[str] = None
    suggested_rack: Optional[str] = None
    suggested_shelf: Optional[str] = None
    suggested_position: Optional[str] = None
    
    # Lot/Batch
    lot_number: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    
    # Timestamps
    assigned_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True


class BarcodeScanRequest(BaseModel):
    """Worker scans item barcode to verify"""
    barcode: str = Field(..., description="Scanned barcode value")


class BarcodeScanResponse(BaseModel):
    """Response after barcode scan verification"""
    verified: bool
    message: str
    item_sku: Optional[str] = None
    item_description: Optional[str] = None
    expected_barcode: Optional[str] = None
    scanned_barcode: str


class BinScanRequest(BaseModel):
    """Worker scans destination bin barcode"""
    bin_barcode: str = Field(..., description="Scanned bin barcode or bin code")
    quantity_put: Decimal = Field(..., gt=0, description="Quantity being placed in bin")
    notes: Optional[str] = None


class BinScanResponse(BaseModel):
    """Response after bin scan and task completion"""
    success: bool
    message: str
    task_number: str
    task_status: str
    item_sku: str
    quantity_put: Decimal
    bin_code: str
    bin_location: Optional[str] = None
    was_suggested_bin: bool = False
    completed_at: Optional[datetime] = None


class WorkerDashboard(BaseModel):
    """Worker's dashboard summary"""
    worker_name: str
    tasks_assigned: int
    tasks_in_progress: int
    tasks_completed_today: int
    items_put_today: Decimal
    active_tasks: List[WorkerTaskDetail] = []