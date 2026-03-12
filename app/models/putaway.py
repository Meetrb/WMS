from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer, Numeric, ForeignKey, Enum, JSON, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db.base import Base


class PutawayTask(Base):
    """Putaway Task - Tasks for moving items from receiving to storage bins"""
    __tablename__ = "putaway_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Task Identification
    task_number = Column(String(50), unique=True, nullable=False, index=True)
    
    # Source (where items come from)
    inbound_shipment_id = Column(UUID(as_uuid=True), ForeignKey("inbound_shipments.id"), nullable=False)
    grn_id = Column(UUID(as_uuid=True), ForeignKey("grns.id"), nullable=False)
    asn_shipment_item_id = Column(UUID(as_uuid=True), ForeignKey("asn_shipment_items.id"), nullable=False)
    
    # Item Details
    item_id = Column(UUID(as_uuid=True), ForeignKey("item_master.id"), nullable=False)
    item_sku = Column(String(50), nullable=False)
    item_description = Column(String(200), nullable=True)
    
    # Quantities
    quantity_to_put = Column(Numeric(18, 3), nullable=False)
    quantity_put = Column(Numeric(18, 3), default=0)
    
    # Location Information
    source_location = Column(String(100), nullable=True)  # e.g., "Receiving Dock A1"
    suggested_bin_id = Column(UUID(as_uuid=True), ForeignKey("bins.id"), nullable=True)
    actual_bin_id = Column(UUID(as_uuid=True), ForeignKey("bins.id"), nullable=True)
    
    # Lot/Batch Information
    lot_number = Column(String(50), nullable=True)
    batch_number = Column(String(50), nullable=True)
    expiry_date = Column(DateTime, nullable=True)
    
    # Assignment
    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    assigned_at = Column(DateTime, nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Status Tracking
    status = Column(
        Enum('PENDING', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'ON_HOLD',
             name="putaway_status"),
        default='PENDING',
        nullable=False
    )
    
    # Priority (1 = highest, 10 = lowest)
    priority = Column(Integer, default=5)
    
    # Queue Position (for FIFO processing)
    queue_position = Column(Integer, nullable=True)
    
    # Additional Data
    notes = Column(Text, nullable=True)
    task_data = Column(JSON, nullable=True)  # Flexible storage for additional task data
    
    # Audit
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    created_by_name = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    inbound_shipment = relationship("InboundShipment", foreign_keys=[inbound_shipment_id])
    grn = relationship("GRN", foreign_keys=[grn_id])
    asn_shipment_item = relationship("ASNShipmentItem", foreign_keys=[asn_shipment_item_id])
    item = relationship("ItemMaster", foreign_keys=[item_id])
    suggested_bin = relationship("Bin", foreign_keys=[suggested_bin_id])
    actual_bin = relationship("Bin", foreign_keys=[actual_bin_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    
    __table_args__ = (
        Index('ix_putaway_tasks_status', 'status'),
        Index('ix_putaway_tasks_priority', 'priority'),
        Index('ix_putaway_tasks_created', 'created_at'),
        Index('ix_putaway_tasks_assigned', 'assigned_to_id', 'status'),
    )
    
    def __repr__(self):
        return f"<PutawayTask {self.task_number}: {self.status}>"


class PutawayTaskHistory(Base):
    """History of putaway task status changes"""
    __tablename__ = "putaway_task_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("putaway_tasks.id", ondelete="CASCADE"), nullable=False)
    
    # Status Change
    old_status = Column(String(20), nullable=True)
    new_status = Column(String(20), nullable=False)
    
    # Assignment Changes
    old_assignee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    new_assignee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # User
    changed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    changed_by_name = Column(String(100), nullable=True)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    task = relationship("PutawayTask", foreign_keys=[task_id])
    old_assignee = relationship("User", foreign_keys=[old_assignee_id])
    new_assignee = relationship("User", foreign_keys=[new_assignee_id])
    changed_by = relationship("User", foreign_keys=[changed_by_id])


class WorkerWorkload(Base):
    """Track current workload of warehouse workers"""
    __tablename__ = "worker_workload"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    worker_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False, unique=True)
    worker_name = Column(String(100), nullable=True)
    
    # Current Workload
    tasks_assigned = Column(Integer, default=0)  # ASSIGNED tasks
    tasks_in_progress = Column(Integer, default=0)  # IN_PROGRESS tasks
    total_active_tasks = Column(Integer, default=0)  # ASSIGNED + IN_PROGRESS
    
    # Capacity
    max_concurrent_tasks = Column(Integer, default=3)  # Max tasks a worker can handle
    
    # Today's Performance
    tasks_completed_today = Column(Integer, default=0)
    items_put_today = Column(Numeric(18, 3), default=0)
    
    # Last Activity
    last_task_assigned_at = Column(DateTime, nullable=True)
    last_task_completed_at = Column(DateTime, nullable=True)
    
    # Audit
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationship
    worker = relationship("User", foreign_keys=[worker_id])
    
    def __repr__(self):
        return f"<WorkerWorkload {self.worker_name}: {self.total_active_tasks}/{self.max_concurrent_tasks}>"