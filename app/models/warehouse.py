from sqlalchemy import Column, String, Text, Boolean, DateTime, Integer, Numeric, ForeignKey, JSON, UniqueConstraint, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db.base import Base


class Warehouse(Base):
    __tablename__ = "warehouses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Core Information
    code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Location Details
    address_line1 = Column(String(200), nullable=True)
    address_line2 = Column(String(200), nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(100), nullable=True)
    country = Column(String(100), nullable=True)
    postal_code = Column(String(20), nullable=True)
    
    # Contact Information
    contact_person = Column(String(100), nullable=True)
    contact_email = Column(String(100), nullable=True)
    contact_phone = Column(String(20), nullable=True)
    
    # Operational Details
    time_zone = Column(String(50), nullable=True, default='UTC')
    default_rules_profile = Column(String(50), nullable=True)
    
    # Capacity
    total_area_sqft = Column(Numeric(18, 2), nullable=True)
    total_volume_cc = Column(Numeric(18, 2), nullable=True)
    max_pallet_positions = Column(Integer, nullable=True)
    
    # Status
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    zones = relationship("Zone", back_populates="warehouse", cascade="all, delete-orphan")
    bins = relationship("Bin", back_populates="warehouse", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Warehouse {self.code}: {self.name}>"


class Zone(Base):
    """Zone Master - Functional areas within warehouse"""
    __tablename__ = "zones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Core Information
    warehouse_id = Column(UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False)
    code = Column(String(20), nullable=False)
    name = Column(String(100), nullable=False)
    description = Column(Text, nullable=True)
    
    # Zone Type (receiving, storage, picking, packing, shipping, quarantine, cross_dock)
    zone_type = Column(String(30), nullable=False)
    
    # Physical Characteristics
    length_meters = Column(Numeric(10, 2), nullable=True)
    width_meters = Column(Numeric(10, 2), nullable=True)
    height_meters = Column(Numeric(10, 2), nullable=True)
    floor_area_sqft = Column(Numeric(10, 2), nullable=True)
    
    # Environmental Conditions
    temperature_min_celsius = Column(Numeric(5, 2), nullable=True)
    temperature_max_celsius = Column(Numeric(5, 2), nullable=True)
    humidity_percent = Column(Numeric(5, 2), nullable=True)
    
    # Special Conditions
    is_hazardous = Column(Boolean, default=False)
    is_refrigerated = Column(Boolean, default=False)
    is_clean_room = Column(Boolean, default=False)
    special_condition = Column(String(50), nullable=True)
    
    # Operational
    max_pallet_positions = Column(Integer, nullable=True)
    current_utilization = Column(Numeric(5, 2), default=0)  # Percentage
    is_active = Column(Boolean, default=True)
    
    # Audit
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    warehouse = relationship("Warehouse", back_populates="zones")
    bins = relationship("Bin", back_populates="zone", cascade="all, delete-orphan")
    
    __table_args__ = (
        UniqueConstraint('warehouse_id', 'code', name='uix_warehouse_zone_code'),
    )
    
    def __repr__(self):
        return f"<Zone {self.code}: {self.name}>"


class Bin(Base):
    """Bin Master - Individual storage locations"""
    __tablename__ = "bins"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Location Hierarchy
    warehouse_id = Column(UUID(as_uuid=True), ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False)
    zone_id = Column(UUID(as_uuid=True), ForeignKey("zones.id", ondelete="SET NULL"), nullable=True)
    
    # Identification
    code = Column(String(30), nullable=False)  # Human-readable code (e.g., "A-01-02-03")
    barcode = Column(String(100), unique=True, nullable=True)
    rfid_tag = Column(String(100), unique=True, nullable=True)
    
    # Physical Location Breakdown
    aisle = Column(String(20), nullable=True)      # Aisle number/letter
    rack = Column(String(20), nullable=True)       # Rack identifier
    shelf = Column(String(20), nullable=True)      # Shelf level
    bin_position = Column(String(20), nullable=True)  # Position within shelf
    
    # Bin Type
    bin_type = Column(String(30), nullable=False)  # floor, pallet, shelf, bulk, pick-face, staging, packing, dock
    
    # Physical Dimensions
    length_cm = Column(Numeric(18, 3), nullable=True)
    width_cm = Column(Numeric(18, 3), nullable=True)
    height_cm = Column(Numeric(18, 3), nullable=True)
    max_volume_cc = Column(Numeric(18, 3), nullable=True)
    max_weight_kg = Column(Numeric(18, 3), nullable=True)
    
    # Storage Rules
    max_sku_count = Column(Integer, default=1)  # 1 = single SKU bin
    max_quantity = Column(Numeric(18, 3), nullable=True)  # Maximum quantity this bin can hold
    
    # Stacking
    max_stack_height = Column(Integer, default=1)
    current_stack_height = Column(Integer, default=0)
    
    # Location Coordinates (for pathfinding)
    x_coordinate = Column(Integer, nullable=True)
    y_coordinate = Column(Integer, nullable=True)
    z_coordinate = Column(Integer, nullable=True)  # Height level
    
    # Picking Optimization
    pick_priority = Column(Integer, default=5)  # 1 (highest) to 10 (lowest)
    distance_from_packing = Column(Numeric(10, 2), nullable=True)  # In meters
    
    # Compatibility Rules
    compatibility_rules = Column(JSON, nullable=True)
    
    # FEFO/FIFO Allowed
    fefo_allowed = Column(Boolean, default=True)
    fifo_allowed = Column(Boolean, default=True)
    
    # Current Status
    status = Column(String(20), default='ACTIVE')  # ACTIVE, BLOCKED, MAINTENANCE, FULL
    is_empty = Column(Boolean, default=True)
    is_reserved = Column(Boolean, default=False)
    is_blocked = Column(Boolean, default=False)
    blocked_reason = Column(Text, nullable=True)
    
    # Current Contents (denormalized for quick access)
    current_item_sku = Column(String(50), nullable=True)
    current_item_id = Column(UUID(as_uuid=True), ForeignKey("item_master.id"), nullable=True)
    current_quantity = Column(Numeric(18, 3), default=0)
    current_lot_number = Column(String(50), nullable=True)
    current_batch_number = Column(String(50), nullable=True)
    current_expiry_date = Column(DateTime, nullable=True)
    
    # Last Activity
    last_accessed_at = Column(DateTime, nullable=True)
    last_counted_at = Column(DateTime, nullable=True)
    
    # Audit
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    warehouse = relationship("Warehouse", back_populates="bins")
    zone = relationship("Zone", back_populates="bins")
    current_item = relationship("ItemMaster", foreign_keys=[current_item_id])
    
    __table_args__ = (
        UniqueConstraint('warehouse_id', 'code', name='uix_warehouse_bin_code'),
        Index('ix_bins_status', 'status'),
        Index('ix_bins_location', 'warehouse_id', 'aisle', 'rack', 'shelf'),
    )
    
    def __repr__(self):
        return f"<Bin {self.code}>"


class BinHistory(Base):
    """Bin Contents History - Audit trail for all bin changes"""
    __tablename__ = "bin_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    bin_id = Column(UUID(as_uuid=True), ForeignKey("bins.id", ondelete="CASCADE"), nullable=False)
    
    # Item Details
    item_id = Column(UUID(as_uuid=True), ForeignKey("item_master.id"), nullable=True)
    item_sku = Column(String(50), nullable=True)
    
    # Quantity Changes
    previous_quantity = Column(Numeric(18, 3), nullable=True)
    new_quantity = Column(Numeric(18, 3), nullable=True)
    change_quantity = Column(Numeric(18, 3), nullable=True)
    
    # Change Type
    change_type = Column(String(30), nullable=False)  # PUTAWAY, PICK, MOVE, COUNT, ADJUST, RESERVE, UNRESERVE
    
    # Reference
    reference_id = Column(UUID(as_uuid=True), nullable=True)  # ID of putaway_task, pick_task, etc.
    reference_type = Column(String(50), nullable=True)  # putaway_task, pick_task, cycle_count, etc.
    
    # User
    changed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    changed_by_name = Column(String(100), nullable=True)
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Indexes
    __table_args__ = (
        Index('ix_bin_history_bin', 'bin_id'),
        Index('ix_bin_history_item', 'item_id'),
        Index('ix_bin_history_created', 'created_at'),
    )