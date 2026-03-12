from pydantic import BaseModel, Field, validator
from uuid import UUID
from datetime import datetime
from typing import Optional, Dict, Any, List
from decimal import Decimal


class ItemMasterBase(BaseModel):
    """Base schema with all fields"""
    sku_code: str
    description: str
    short_description: Optional[str] = None
    
    # Barcodes
    primary_barcode: Optional[str] = None
    alt_barcodes: Optional[List[str]] = None  # CHANGED: str -> List[str]
    rfid_tag: Optional[str] = None
    
    # UOM
    base_uom: str
    alt_uom: Optional[str] = None
    uom_conversion: Optional[Decimal] = None
    uom_hierarchy: Optional[Dict[str, int]] = None
    
    # Physical
    length_cm: Optional[Decimal] = None
    width_cm: Optional[Decimal] = None
    height_cm: Optional[Decimal] = None
    weight_kg: Optional[Decimal] = None
    volume_cc: Optional[Decimal] = None
    
    # Pallet/Case quantities
    pallet_quantity: Optional[Decimal] = None
    case_quantity: Optional[Decimal] = None
    inner_quantity: Optional[Decimal] = None
    
    # Classification
    item_type: Optional[str] = None
    item_category: Optional[str] = None
    storage_condition: Optional[str] = None
    
    # Velocity (usually system-calculated, but can be manually set)
    velocity_class: Optional[str] = None
    velocity_score: Optional[Decimal] = None
    pick_frequency: Optional[int] = 0
    
    # Storage rules
    fefo_enabled: bool = False
    fifo_enabled: bool = True
    shelf_life_days: Optional[int] = None
    batch_required: bool = False
    serial_required: bool = False
    
    # Pick face
    pick_face_eligible: bool = False
    pick_face_capacity: Optional[Decimal] = None
    pick_face_replenishment_point: Optional[Decimal] = None
    
    # Putaway preferences
    preferred_zones: Optional[List[str]] = None  # CHANGED: str -> List[str]
    preferred_bin_types: Optional[List[str]] = None
    picking_strategy: Optional[str] = None
    max_stack_height: Optional[int] = None  # CHANGED: Decimal -> int
    max_qty_per_bin: Optional[Decimal] = None
    
    # Compatibility
    compatibility_rules: Optional[Dict[str, Any]] = None
    
    # Hazardous
    is_hazardous: bool = False
    hazard_class: Optional[str] = None
    hazmat_code: Optional[str] = None
    
    # Quality
    requires_inspection: bool = False
    inspection_rule: Optional[str] = None
    sample_percentage: Optional[int] = 100
    quarantine_on_failure: bool = False
    
    # Financial
    hsn_code: Optional[str] = None
    tax_rate: Optional[Decimal] = None
    
    # Status
    active: bool = True


class ItemMasterCreate(ItemMasterBase):
    """Schema for creating a new item"""
    
    @validator('velocity_class')
    def validate_velocity_class(cls, v):
        if v and v not in ['A', 'B', 'C']:
            raise ValueError('velocity_class must be A, B, or C')
        return v
    
    @validator('inspection_rule')
    def validate_inspection_rule(cls, v):
        if v and v not in ['SAMPLING', 'FULL', 'NONE']:
            raise ValueError('inspection_rule must be SAMPLING, FULL, or NONE')
        return v


class ItemMasterUpdate(BaseModel):
    """Schema for updating an item (all fields optional)"""
    description: Optional[str] = None
    short_description: Optional[str] = None
    primary_barcode: Optional[str] = None
    alt_barcodes: Optional[List[str]] = None
    rfid_tag: Optional[str] = None
    base_uom: Optional[str] = None
    alt_uom: Optional[str] = None
    uom_conversion: Optional[Decimal] = None
    uom_hierarchy: Optional[Dict[str, int]] = None
    length_cm: Optional[Decimal] = None
    width_cm: Optional[Decimal] = None
    height_cm: Optional[Decimal] = None
    weight_kg: Optional[Decimal] = None
    volume_cc: Optional[Decimal] = None
    pallet_quantity: Optional[Decimal] = None
    case_quantity: Optional[Decimal] = None
    inner_quantity: Optional[Decimal] = None
    item_type: Optional[str] = None
    item_category: Optional[str] = None
    storage_condition: Optional[str] = None
    velocity_class: Optional[str] = None
    fefo_enabled: Optional[bool] = None
    fifo_enabled: Optional[bool] = None
    shelf_life_days: Optional[int] = None
    batch_required: Optional[bool] = None
    serial_required: Optional[bool] = None
    pick_face_eligible: Optional[bool] = None
    pick_face_capacity: Optional[Decimal] = None
    pick_face_replenishment_point: Optional[Decimal] = None
    preferred_zones: Optional[List[str]] = None
    preferred_bin_types: Optional[List[str]] = None
    picking_strategy: Optional[str] = None
    max_stack_height: Optional[int] = None
    max_qty_per_bin: Optional[Decimal] = None
    compatibility_rules: Optional[Dict[str, Any]] = None
    is_hazardous: Optional[bool] = None
    hazard_class: Optional[str] = None
    hazmat_code: Optional[str] = None
    requires_inspection: Optional[bool] = None
    inspection_rule: Optional[str] = None
    sample_percentage: Optional[int] = None
    quarantine_on_failure: Optional[bool] = None
    hsn_code: Optional[str] = None
    tax_rate: Optional[Decimal] = None
    active: Optional[bool] = None


class ItemMasterInDB(ItemMasterBase):
    """Schema for item from database (includes system fields)"""
    id: UUID
    velocity_score: Optional[Decimal] = None
    last_velocity_calc: Optional[datetime] = None
    pick_frequency: int = 0
    created_by: Optional[str] = None
    created_at: datetime
    updated_by: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True


class ItemMaster(ItemMasterInDB):
    """Schema for API responses"""
    pass


class ItemVelocityUpdate(BaseModel):
    """
    Schema for manually updating velocity class
    """
    velocity_class: str = Field(..., pattern='^[ABC]$', description="Velocity class: A (Fast), B (Medium), or C (Slow)")
    reason: str = Field(..., description="Reason for velocity change")
    
    class Config:
        json_schema_extra = {
            "example": {
                "velocity_class": "A",
                "reason": "Item moved from 50 picks/day to 200 picks/day"
            }
        }