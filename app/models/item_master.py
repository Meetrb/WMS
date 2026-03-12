# In app/models/item_master.py

from sqlalchemy import Column, String, Text, Boolean, Integer, DateTime, Numeric, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db.base import Base


class ItemMaster(Base):
    __tablename__ = "item_master"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # ==================== CORE IDENTIFICATION ====================
    sku_code = Column(String(50), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=False)
    short_description = Column(String(200), nullable=True)  # NEW
    
    # ==================== BARCODES ====================
    primary_barcode = Column(String(100), nullable=True, index=True)
    alt_barcodes = Column(JSON, nullable=True)  # CHANGED: Text -> JSON
    rfid_tag = Column(String(100), nullable=True, unique=True)  # NEW
    
    # ==================== UNIT OF MEASURE ====================
    base_uom = Column(String(20), nullable=False)
    alt_uom = Column(String(20), nullable=True)
    uom_conversion = Column(Numeric(18, 6), nullable=True)
    uom_hierarchy = Column(JSON, nullable=True)  # NEW
    
    # ==================== PHYSICAL DIMENSIONS ====================
    length_cm = Column(Numeric(18, 3), nullable=True)
    width_cm = Column(Numeric(18, 3), nullable=True)
    height_cm = Column(Numeric(18, 3), nullable=True)
    weight_kg = Column(Numeric(18, 3), nullable=True)
    volume_cc = Column(Numeric(18, 3), nullable=True)
    
    # Pallet/Case quantities (NEW - CRITICAL for putaway)
    pallet_quantity = Column(Numeric(18, 3), nullable=True)
    case_quantity = Column(Numeric(18, 3), nullable=True)
    inner_quantity = Column(Numeric(18, 3), nullable=True)
    
    # ==================== ITEM CLASSIFICATION ====================
    item_type = Column(String(30), nullable=True)
    item_category = Column(String(30), nullable=True)  # NEW
    storage_condition = Column(String(30), nullable=True)
    
    # ==================== VELOCITY CLASSIFICATION ====================
    velocity_class = Column(String(10), nullable=True)
    velocity_score = Column(Numeric(10, 2), nullable=True)  # NEW
    last_velocity_calc = Column(DateTime, nullable=True)  # NEW
    pick_frequency = Column(Integer, default=0)  # NEW
    
    # ==================== STORAGE RULES ====================
    fefo_enabled = Column(Boolean, default=False)
    fifo_enabled = Column(Boolean, default=True)
    shelf_life_days = Column(Integer, nullable=True)
    batch_required = Column(Boolean, default=False)
    serial_required = Column(Boolean, default=False)
    
    # Pick face configuration (NEW)
    pick_face_eligible = Column(Boolean, default=False)
    pick_face_capacity = Column(Numeric(18, 3), nullable=True)
    pick_face_replenishment_point = Column(Numeric(18, 3), nullable=True)
    
    # ==================== PUTAWAY PREFERENCES ====================
    preferred_zones = Column(JSON, nullable=True)  # CHANGED: Text -> JSON
    preferred_bin_types = Column(JSON, nullable=True)  # NEW
    picking_strategy = Column(String(20), nullable=True)
    max_stack_height = Column(Integer, nullable=True)  # CHANGED: Numeric -> Integer
    max_qty_per_bin = Column(Numeric(18, 3), nullable=True)
    
    # ==================== COMPATIBILITY RULES ====================
    compatibility_rules = Column(JSON, nullable=True)
    
    # ==================== HAZARDOUS MATERIALS ====================
    is_hazardous = Column(Boolean, default=False)  # NEW
    hazard_class = Column(String(30), nullable=True)  # NEW
    hazmat_code = Column(String(30), nullable=True)  # NEW
    
    # ==================== QUALITY/INSPECTION ====================
    requires_inspection = Column(Boolean, default=False)  # NEW
    inspection_rule = Column(String(50), nullable=True)  # NEW
    sample_percentage = Column(Integer, default=100)  # NEW
    quarantine_on_failure = Column(Boolean, default=False)  # NEW
    
    # ==================== GST/HSN ====================
    hsn_code = Column(String(20), nullable=True)
    tax_rate = Column(Numeric(10, 2), nullable=True)  # NEW
    
    # ==================== STATUS & AUDIT ====================
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(100), nullable=True)  # NEW
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    updated_by = Column(String(100), nullable=True)  # NEW
    
    # ==================== RELATIONSHIPS ====================
    shipment_items = relationship("ShipmentItem", back_populates="item_master")
    
    def __repr__(self):
        return f"<ItemMaster {self.sku_code}>"