from pydantic import BaseModel, EmailStr, Field, validator
from uuid import UUID
from datetime import datetime
from typing import Optional, List, Dict, Any
from decimal import Decimal


# ============================================================================
# Warehouse Schemas
# ============================================================================

class WarehouseBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    time_zone: str = "UTC"
    default_rules_profile: Optional[str] = None
    total_area_sqft: Optional[Decimal] = None
    total_volume_cc: Optional[Decimal] = None
    max_pallet_positions: Optional[int] = None
    is_active: bool = True


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    address_line1: Optional[str] = None
    address_line2: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    postal_code: Optional[str] = None
    contact_person: Optional[str] = None
    contact_email: Optional[EmailStr] = None
    contact_phone: Optional[str] = None
    time_zone: Optional[str] = None
    default_rules_profile: Optional[str] = None
    total_area_sqft: Optional[Decimal] = None
    total_volume_cc: Optional[Decimal] = None
    max_pallet_positions: Optional[int] = None
    is_active: Optional[bool] = None


class WarehouseInDB(WarehouseBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Warehouse(WarehouseInDB):
    zones_count: Optional[int] = 0
    bins_count: Optional[int] = 0
    active_bins_count: Optional[int] = 0


# ============================================================================
# Zone Schemas
# ============================================================================

class ZoneBase(BaseModel):
    code: str
    name: str
    description: Optional[str] = None
    zone_type: str  # receiving, storage, picking, packing, shipping, quarantine, cross_dock
    length_meters: Optional[Decimal] = None
    width_meters: Optional[Decimal] = None
    height_meters: Optional[Decimal] = None
    floor_area_sqft: Optional[Decimal] = None
    temperature_min_celsius: Optional[Decimal] = None
    temperature_max_celsius: Optional[Decimal] = None
    humidity_percent: Optional[Decimal] = None
    is_hazardous: bool = False
    is_refrigerated: bool = False
    is_clean_room: bool = False
    special_condition: Optional[str] = None
    max_pallet_positions: Optional[int] = None
    is_active: bool = True


class ZoneCreate(ZoneBase):
    warehouse_id: UUID


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    zone_type: Optional[str] = None
    length_meters: Optional[Decimal] = None
    width_meters: Optional[Decimal] = None
    height_meters: Optional[Decimal] = None
    floor_area_sqft: Optional[Decimal] = None
    temperature_min_celsius: Optional[Decimal] = None
    temperature_max_celsius: Optional[Decimal] = None
    humidity_percent: Optional[Decimal] = None
    is_hazardous: Optional[bool] = None
    is_refrigerated: Optional[bool] = None
    is_clean_room: Optional[bool] = None
    special_condition: Optional[str] = None
    max_pallet_positions: Optional[int] = None
    is_active: Optional[bool] = None


class ZoneInDB(ZoneBase):
    id: UUID
    warehouse_id: UUID
    current_utilization: Decimal = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Zone(ZoneInDB):
    bins_count: Optional[int] = 0
    available_bins: Optional[int] = 0
    warehouse_code: Optional[str] = None


# ============================================================================
# Bin Schemas
# ============================================================================

class BinBase(BaseModel):
    code: str
    barcode: Optional[str] = None
    rfid_tag: Optional[str] = None
    
    # Location
    aisle: Optional[str] = None
    rack: Optional[str] = None
    shelf: Optional[str] = None
    bin_position: Optional[str] = None
    
    # Type
    bin_type: str  # floor, pallet, shelf, bulk, pick-face, staging, packing, dock
    
    # Dimensions
    length_cm: Optional[Decimal] = None
    width_cm: Optional[Decimal] = None
    height_cm: Optional[Decimal] = None
    max_volume_cc: Optional[Decimal] = None
    max_weight_kg: Optional[Decimal] = None
    
    # Storage Rules
    max_sku_count: int = 1
    max_quantity: Optional[Decimal] = None
    
    # Stacking
    max_stack_height: int = 1
    
    # Coordinates
    x_coordinate: Optional[int] = None
    y_coordinate: Optional[int] = None
    z_coordinate: Optional[int] = None
    
    # Picking
    pick_priority: int = 5
    distance_from_packing: Optional[Decimal] = None
    
    # Compatibility
    compatibility_rules: Optional[Dict[str, Any]] = None
    
    # FEFO/FIFO
    fefo_allowed: bool = True
    fifo_allowed: bool = True


class BinCreate(BinBase):
    warehouse_id: UUID
    zone_id: Optional[UUID] = None


class BinUpdate(BaseModel):
    zone_id: Optional[UUID] = None
    barcode: Optional[str] = None
    rfid_tag: Optional[str] = None
    bin_type: Optional[str] = None
    length_cm: Optional[Decimal] = None
    width_cm: Optional[Decimal] = None
    height_cm: Optional[Decimal] = None
    max_volume_cc: Optional[Decimal] = None
    max_weight_kg: Optional[Decimal] = None
    max_sku_count: Optional[int] = None
    max_quantity: Optional[Decimal] = None
    max_stack_height: Optional[int] = None
    x_coordinate: Optional[int] = None
    y_coordinate: Optional[int] = None
    z_coordinate: Optional[int] = None
    pick_priority: Optional[int] = None
    distance_from_packing: Optional[Decimal] = None
    compatibility_rules: Optional[Dict[str, Any]] = None
    fefo_allowed: Optional[bool] = None
    fifo_allowed: Optional[bool] = None
    status: Optional[str] = None
    is_blocked: Optional[bool] = None
    blocked_reason: Optional[str] = None


class BinContentUpdate(BaseModel):
    """Update bin contents (for putaway/picking)"""
    item_id: UUID
    quantity: Decimal
    lot_number: Optional[str] = None
    batch_number: Optional[str] = None
    expiry_date: Optional[datetime] = None
    operation: str = "ADD"  # ADD, REMOVE, SET


class BinInDB(BinBase):
    id: UUID
    warehouse_id: UUID
    zone_id: Optional[UUID] = None
    status: str = "ACTIVE"
    is_empty: bool = True
    is_reserved: bool = False
    is_blocked: bool = False
    blocked_reason: Optional[str] = None
    current_stack_height: int = 0
    current_item_sku: Optional[str] = None
    current_item_id: Optional[UUID] = None
    current_quantity: Decimal = 0
    current_lot_number: Optional[str] = None
    current_batch_number: Optional[str] = None
    current_expiry_date: Optional[datetime] = None
    last_accessed_at: Optional[datetime] = None
    last_counted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class Bin(BinInDB):
    warehouse_code: Optional[str] = None
    zone_code: Optional[str] = None
    zone_name: Optional[str] = None
    utilization_percentage: Optional[float] = None


class BinHistoryCreate(BaseModel):
    bin_id: UUID
    item_id: Optional[UUID] = None
    item_sku: Optional[str] = None
    previous_quantity: Optional[Decimal] = None
    new_quantity: Optional[Decimal] = None
    change_type: str
    reference_id: Optional[UUID] = None
    reference_type: Optional[str] = None
    notes: Optional[str] = None


class BinHistory(BinHistoryCreate):
    id: UUID
    change_quantity: Optional[Decimal] = None
    changed_by_id: Optional[UUID] = None
    changed_by_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# ============================================================================
# Response Schemas with Details
# ============================================================================

class WarehouseWithDetails(Warehouse):
    """Warehouse with all zones and bins"""
    zones: List[Zone] = []
    bins: List[Bin] = []


class ZoneWithBins(Zone):
    """Zone with all bins"""
    bins: List[Bin] = []


class BinWithHistory(Bin):
    """Bin with recent history"""
    recent_history: List[BinHistory] = []


# ============================================================================
# Statistics and Summary Schemas
# ============================================================================

class WarehouseStatistics(BaseModel):
    total_warehouses: int
    active_warehouses: int
    total_zones: int
    total_bins: int
    available_bins: int
    occupied_bins: int
    blocked_bins: int
    bins_by_type: Dict[str, int]
    bins_by_zone: Dict[str, int]
    capacity_utilization: float


class ZoneStatistics(BaseModel):
    zone_id: UUID
    zone_code: str
    zone_name: str
    total_bins: int
    available_bins: int
    occupied_bins: int
    utilization_percentage: float
    bins_by_type: Dict[str, int]