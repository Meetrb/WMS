from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, Date, Numeric, Enum, Integer
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db.base import Base


class InboundShipment(Base):
    """ASN/Inbound Shipment Header - When ASN arrives at warehouse"""
    __tablename__ = "inbound_shipments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # ASN Information
    asn_number = Column(String(50), unique=True, index=True, nullable=False)
    asn_date = Column(DateTime, nullable=False)
    expected_arrival_date = Column(DateTime, nullable=False)
    actual_arrival_date = Column(DateTime, nullable=True)
    
    # Warehouse Information (ONLY warehouse level, no bin)
    warehouse_id = Column(UUID(as_uuid=True), ForeignKey("warehouses.id"), nullable=False)
    receiving_dock = Column(String(50), nullable=True)  # Just dock door, not specific bin
    
    # Supplier Information
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier_master.id"), nullable=True)
    
    # Shipment Information
    shipment_id = Column(String(50), nullable=False)  # Vehicle/Container number
    driver_name = Column(String(100), nullable=True)
    driver_phone = Column(String(20), nullable=True)
    vehicle_number = Column(String(50), nullable=True)
    
    # Status Tracking
    status = Column(
        Enum('PENDING', 'ARRIVED', 'INSPECTION', 'RECEIVING', 'COMPLETED', 'CANCELLED',
             name="inbound_status"),
        default='PENDING',
        nullable=False
    )
    
    # Additional Info
    notes = Column(Text, nullable=True)
    reference_docs = Column(Text, nullable=True)  # JSON for additional docs
    
    # Audit Fields
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    warehouse = relationship("Warehouse", foreign_keys=[warehouse_id])
    supplier = relationship("SupplierMaster", foreign_keys=[supplier_id])
    asn_shipments = relationship("ASNShipment", back_populates="inbound_shipment", cascade="all, delete-orphan")
    receiving_tasks = relationship("ReceivingTask", back_populates="inbound_shipment", cascade="all, delete-orphan")
    grns = relationship("GRN", back_populates="inbound_shipment", cascade="all, delete-orphan")
    inspection_records = relationship("InspectionRecord", back_populates="inbound_shipment", cascade="all, delete-orphan")


class ASNShipment(Base):
    """Links Inbound Shipment to POs from the ASN"""
    __tablename__ = "asn_shipments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inbound_shipment_id = Column(UUID(as_uuid=True), ForeignKey("inbound_shipments.id", ondelete="CASCADE"), nullable=False)
    po_number = Column(String(50), nullable=False)
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier_master.id"), nullable=True)
    
    # Relationships
    inbound_shipment = relationship("InboundShipment", back_populates="asn_shipments")
    supplier = relationship("SupplierMaster", foreign_keys=[supplier_id])
    items = relationship("ASNShipmentItem", back_populates="asn_shipment", cascade="all, delete-orphan")


class ASNShipmentItem(Base):
    """Items in each PO from ASN"""
    __tablename__ = "asn_shipment_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asn_shipment_id = Column(UUID(as_uuid=True), ForeignKey("asn_shipments.id", ondelete="CASCADE"), nullable=False)
    
    # Item Details from ASN
    item_master_id = Column(UUID(as_uuid=True), ForeignKey("item_master.id"), nullable=False)
    expected_quantity = Column(Numeric(18, 3), nullable=False)
    received_quantity = Column(Numeric(18, 3), default=0)
    rejected_quantity = Column(Numeric(18, 3), default=0)
    unit = Column(String(20), nullable=False)
    unit_price = Column(Numeric(18, 4), nullable=True)
    total_price = Column(Numeric(18, 4), nullable=True)
    
    # Lot/Batch Information
    lot_number = Column(String(50), nullable=True)
    expiry_date = Column(Date, nullable=True)
    manufacturing_date = Column(Date, nullable=True)
    
    # Status
    is_fully_received = Column(Boolean, default=False)
    
    # Relationships
    asn_shipment = relationship("ASNShipment", back_populates="items")
    item_master = relationship("ItemMaster", foreign_keys=[item_master_id])
    receiving_task_items = relationship("ReceivingTaskItem", back_populates="asn_shipment_item")
    grn_items = relationship("GRNItem", back_populates="asn_shipment_item")


class ReceivingTask(Base):
    """Task for receiving/offloading the truck"""
    __tablename__ = "receiving_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_number = Column(String(50), unique=True, nullable=False)
    inbound_shipment_id = Column(UUID(as_uuid=True), ForeignKey("inbound_shipments.id"), nullable=False)
    
    # Assignment
    assigned_to_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Status
    status = Column(
        Enum('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED',
             name="receiving_task_status"),
        default='PENDING'
    )
    
    # Relationships
    inbound_shipment = relationship("InboundShipment", back_populates="receiving_tasks")
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    items = relationship("ReceivingTaskItem", back_populates="receiving_task", cascade="all, delete-orphan")


class ReceivingTaskItem(Base):
    """Items being received in the task"""
    __tablename__ = "receiving_task_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    receiving_task_id = Column(UUID(as_uuid=True), ForeignKey("receiving_tasks.id", ondelete="CASCADE"), nullable=False)
    asn_shipment_item_id = Column(UUID(as_uuid=True), ForeignKey("asn_shipment_items.id"), nullable=False)
    
    received_quantity = Column(Numeric(18, 3), nullable=False)
    rejected_quantity = Column(Numeric(18, 3), default=0)
    rejection_reason = Column(String(200), nullable=True)
    
    # Relationships
    receiving_task = relationship("ReceivingTask", back_populates="items")
    asn_shipment_item = relationship("ASNShipmentItem", back_populates="receiving_task_items")


class InspectionRecord(Base):
    """Quality inspection records"""
    __tablename__ = "inspection_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inbound_shipment_id = Column(UUID(as_uuid=True), ForeignKey("inbound_shipments.id"), nullable=False)
    
    inspection_type = Column(String(50), nullable=False)  # QUICK, SAMPLING, FULL
    inspector_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    inspection_date = Column(DateTime, default=datetime.utcnow)
    
    # Results
    status = Column(
        Enum('PENDING', 'PASSED', 'PARTIAL_PASS', 'FAILED', name="inspection_status"),
        default='PENDING'
    )
    comments = Column(Text, nullable=True)
    
    # Relationships
    inbound_shipment = relationship("InboundShipment", back_populates="inspection_records")
    inspector = relationship("User", foreign_keys=[inspector_id])
    details = relationship("InspectionDetail", back_populates="inspection", cascade="all, delete-orphan")


class InspectionDetail(Base):
    """Item-wise inspection details"""
    __tablename__ = "inspection_details"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    inspection_id = Column(UUID(as_uuid=True), ForeignKey("inspection_records.id", ondelete="CASCADE"), nullable=False)
    asn_shipment_item_id = Column(UUID(as_uuid=True), ForeignKey("asn_shipment_items.id"), nullable=False)
    
    inspected_quantity = Column(Numeric(18, 3), nullable=False)
    passed_quantity = Column(Numeric(18, 3), nullable=False)
    rejected_quantity = Column(Numeric(18, 3), nullable=False)
    rejection_reason = Column(String(200), nullable=True)
    
    # Relationships
    inspection = relationship("InspectionRecord", back_populates="details")
    asn_shipment_item = relationship("ASNShipmentItem")


class GRN(Base):
    """Goods Received Note"""
    __tablename__ = "grns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grn_number = Column(String(50), unique=True, nullable=False)
    inbound_shipment_id = Column(UUID(as_uuid=True), ForeignKey("inbound_shipments.id"), nullable=False)
    
    grn_date = Column(DateTime, default=datetime.utcnow)
    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    
    # Status
    status = Column(
        Enum('DRAFT', 'POSTED', 'CANCELLED', name="grn_status"),
        default='DRAFT'
    )
    
    # Putaway tracking fields
    putaway_tasks_generated = Column(Boolean, default=False)
    putaway_tasks_generated_at = Column(DateTime, nullable=True)
    
    # Relationships
    inbound_shipment = relationship("InboundShipment", back_populates="grns")
    created_by = relationship("User", foreign_keys=[created_by_id])
    items = relationship("GRNItem", back_populates="grn", cascade="all, delete-orphan")


class GRNItem(Base):
    """Items in GRN"""
    __tablename__ = "grn_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    grn_id = Column(UUID(as_uuid=True), ForeignKey("grns.id", ondelete="CASCADE"), nullable=False)
    asn_shipment_item_id = Column(UUID(as_uuid=True), ForeignKey("asn_shipment_items.id"), nullable=False)
    
    received_quantity = Column(Numeric(18, 3), nullable=False)
    accepted_quantity = Column(Numeric(18, 3), nullable=False)
    rejected_quantity = Column(Numeric(18, 3), nullable=False)
    
    # Relationships
    grn = relationship("GRN", back_populates="items")
    asn_shipment_item = relationship("ASNShipmentItem", back_populates="grn_items")