from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, update, case
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal

from app.models.warehouse import Warehouse, Zone, Bin, BinHistory
from app.models.item_master import ItemMaster
from app.schemas.warehouse import (
    WarehouseCreate, WarehouseUpdate,
    ZoneCreate, ZoneUpdate,
    BinCreate, BinUpdate, BinContentUpdate,
    BinHistoryCreate
)


# ============================================================================
# WAREHOUSE OPERATIONS
# ============================================================================

async def get_warehouse(db: AsyncSession, warehouse_id: UUID) -> Optional[Warehouse]:
    """Get warehouse by ID"""
    result = await db.execute(
        select(Warehouse)
        .where(Warehouse.id == warehouse_id)
        .options(
            selectinload(Warehouse.zones),
            selectinload(Warehouse.bins)
        )
    )
    return result.scalar_one_or_none()


async def get_warehouse_by_code(db: AsyncSession, code: str) -> Optional[Warehouse]:
    """Get warehouse by code"""
    result = await db.execute(
        select(Warehouse)
        .where(Warehouse.code == code)
        .options(
            selectinload(Warehouse.zones),
            selectinload(Warehouse.bins)
        )
    )
    return result.scalar_one_or_none()


async def get_warehouses(
    db: AsyncSession, 
    skip: int = 0, 
    limit: int = 100,
    active_only: bool = True,
    search: Optional[str] = None
) -> List[Warehouse]:
    """Get list of warehouses with filters"""
    query = select(Warehouse)
    
    if active_only:
        query = query.where(Warehouse.is_active == True)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                Warehouse.code.ilike(search_term),
                Warehouse.name.ilike(search_term),
                Warehouse.city.ilike(search_term)
            )
        )
    
    query = query.offset(skip).limit(limit).order_by(Warehouse.code)
    result = await db.execute(query)
    return result.scalars().all()


async def create_warehouse(db: AsyncSession, warehouse_data: WarehouseCreate) -> Warehouse:
    """Create a new warehouse"""
    db_warehouse = Warehouse(**warehouse_data.dict())
    db.add(db_warehouse)
    await db.commit()
    await db.refresh(db_warehouse)
    return db_warehouse


async def update_warehouse(
    db: AsyncSession, 
    warehouse_id: UUID, 
    warehouse_data: WarehouseUpdate
) -> Optional[Warehouse]:
    """Update warehouse"""
    db_warehouse = await get_warehouse(db, warehouse_id)
    if not db_warehouse:
        return None
    
    update_data = warehouse_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_warehouse, key, value)
    
    db_warehouse.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(db_warehouse)
    return db_warehouse


async def delete_warehouse(db: AsyncSession, warehouse_id: UUID, hard_delete: bool = False) -> bool:
    """Delete warehouse"""
    db_warehouse = await get_warehouse(db, warehouse_id)
    if not db_warehouse:
        return False
    
    if hard_delete:
        await db.delete(db_warehouse)
    else:
        db_warehouse.is_active = False
        db_warehouse.updated_at = datetime.utcnow()
    
    await db.commit()
    return True


# ============================================================================
# ZONE OPERATIONS
# ============================================================================

async def get_zone(db: AsyncSession, zone_id: UUID) -> Optional[Zone]:
    """Get zone by ID"""
    result = await db.execute(
        select(Zone)
        .where(Zone.id == zone_id)
        .options(selectinload(Zone.bins))
    )
    return result.scalar_one_or_none()


async def get_zones_by_warehouse(
    db: AsyncSession,
    warehouse_id: UUID,
    zone_type: Optional[str] = None,
    active_only: bool = True
) -> List[Zone]:
    """Get zones by warehouse"""
    query = select(Zone).where(Zone.warehouse_id == warehouse_id)
    
    if active_only:
        query = query.where(Zone.is_active == True)
    
    if zone_type:
        query = query.where(Zone.zone_type == zone_type)
    
    query = query.order_by(Zone.code)
    result = await db.execute(query)
    return result.scalars().all()


async def create_zone(db: AsyncSession, zone_data: ZoneCreate) -> Zone:
    """Create a new zone"""
    # Check if zone code already exists in warehouse
    existing = await db.execute(
        select(Zone).where(
            Zone.warehouse_id == zone_data.warehouse_id,
            Zone.code == zone_data.code
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError(f"Zone with code {zone_data.code} already exists in this warehouse")
    
    db_zone = Zone(**zone_data.dict())
    db.add(db_zone)
    await db.commit()
    await db.refresh(db_zone)
    return db_zone


async def update_zone(
    db: AsyncSession,
    zone_id: UUID,
    zone_data: ZoneUpdate
) -> Optional[Zone]:
    """Update zone"""
    db_zone = await get_zone(db, zone_id)
    if not db_zone:
        return None
    
    update_data = zone_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_zone, key, value)
    
    db_zone.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(db_zone)
    return db_zone


async def delete_zone(db: AsyncSession, zone_id: UUID, hard_delete: bool = False) -> bool:
    """Delete zone"""
    db_zone = await get_zone(db, zone_id)
    if not db_zone:
        return False
    
    # Check if zone has bins
    bins_count = await db.execute(
        select(func.count()).select_from(Bin).where(Bin.zone_id == zone_id)
    )
    if bins_count.scalar() > 0 and not hard_delete:
        # Soft delete - just deactivate
        db_zone.is_active = False
        db_zone.updated_at = datetime.utcnow()
        await db.commit()
        return True
    elif hard_delete:
        await db.delete(db_zone)
        await db.commit()
        return True
    
    return False


# ============================================================================
# BIN OPERATIONS
# ============================================================================

async def get_bin(db: AsyncSession, bin_id: UUID) -> Optional[Bin]:
    """Get bin by ID"""
    result = await db.execute(
        select(Bin)
        .where(Bin.id == bin_id)
        .options(selectinload(Bin.zone), selectinload(Bin.warehouse))
    )
    return result.scalar_one_or_none()


async def get_bin_by_code(db: AsyncSession, warehouse_id: UUID, code: str) -> Optional[Bin]:
    """Get bin by warehouse and code"""
    result = await db.execute(
        select(Bin).where(
            Bin.warehouse_id == warehouse_id,
            Bin.code == code
        )
    )
    return result.scalar_one_or_none()


async def get_bin_by_barcode(db: AsyncSession, barcode: str) -> Optional[Bin]:
    """Get bin by barcode"""
    result = await db.execute(select(Bin).where(Bin.barcode == barcode))
    return result.scalar_one_or_none()


async def get_bins(
    db: AsyncSession,
    warehouse_id: Optional[UUID] = None,
    zone_id: Optional[UUID] = None,
    bin_type: Optional[str] = None,
    status: Optional[str] = None,
    is_empty: Optional[bool] = None,
    item_id: Optional[UUID] = None,
    active_only: bool = True,
    skip: int = 0,
    limit: int = 100
) -> List[Bin]:
    """Get bins with filters"""
    query = select(Bin)
    
    if warehouse_id:
        query = query.where(Bin.warehouse_id == warehouse_id)
    
    if zone_id:
        query = query.where(Bin.zone_id == zone_id)
    
    if bin_type:
        query = query.where(Bin.bin_type == bin_type)
    
    if status:
        query = query.where(Bin.status == status)
    elif active_only:
        query = query.where(Bin.status == 'ACTIVE')
    
    if is_empty is not None:
        query = query.where(Bin.is_empty == is_empty)
    
    if item_id:
        query = query.where(Bin.current_item_id == item_id)
    
    query = query.offset(skip).limit(limit).order_by(Bin.code)
    result = await db.execute(query)
    return result.scalars().all()


async def create_bin(db: AsyncSession, bin_data: BinCreate) -> Bin:
    """Create a new bin"""
    # Check if bin code already exists in warehouse
    existing = await get_bin_by_code(db, bin_data.warehouse_id, bin_data.code)
    if existing:
        raise ValueError(f"Bin with code {bin_data.code} already exists in this warehouse")
    
    # Check if barcode already exists
    if bin_data.barcode:
        existing = await get_bin_by_barcode(db, bin_data.barcode)
        if existing:
            raise ValueError(f"Bin with barcode {bin_data.barcode} already exists")
    
    db_bin = Bin(**bin_data.dict())
    db.add(db_bin)
    await db.commit()
    await db.refresh(db_bin)
    return db_bin  # ✅ Returns SQLAlchemy model

async def update_bin(
    db: AsyncSession,
    bin_id: UUID,
    bin_data: BinUpdate
) -> Optional[Bin]:
    """Update bin details"""
    db_bin = await get_bin(db, bin_id)
    if not db_bin:
        return None
    
    update_data = bin_data.dict(exclude_unset=True)
    
    # Check barcode uniqueness if updating
    if 'barcode' in update_data and update_data['barcode'] != db_bin.barcode:
        existing = await get_bin_by_barcode(db, update_data['barcode'])
        if existing and existing.id != bin_id:
            raise ValueError(f"Bin with barcode {update_data['barcode']} already exists")
    
    for key, value in update_data.items():
        setattr(db_bin, key, value)
    
    db_bin.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(db_bin)
    return db_bin


async def update_bin_contents(
    db: AsyncSession,
    bin_id: UUID,
    content_update: BinContentUpdate,
    changed_by_id: Optional[UUID] = None,
    changed_by_name: Optional[str] = None
) -> Optional[Bin]:
    """Update bin contents (putaway/picking)"""
    db_bin = await get_bin(db, bin_id)
    if not db_bin:
        return None
    
    # Store previous state for history
    previous_quantity = db_bin.current_quantity
    previous_item_id = db_bin.current_item_id
    
    # Get item details
    item = await db.get(ItemMaster, content_update.item_id)
    if not item:
        raise ValueError(f"Item with ID {content_update.item_id} not found")
    
    # Check compatibility rules
    if db_bin.compatibility_rules and db_bin.current_item_id and db_bin.current_item_id != content_update.item_id:
        # Check if items are compatible
        if not await check_item_compatibility(db, db_bin.current_item_id, content_update.item_id):
            raise ValueError("Items are not compatible for storing together")
    
    # Update based on operation
    if content_update.operation == "ADD":
        new_quantity = db_bin.current_quantity + content_update.quantity
    elif content_update.operation == "REMOVE":
        if db_bin.current_quantity < content_update.quantity:
            raise ValueError(f"Insufficient quantity in bin. Available: {db_bin.current_quantity}")
        new_quantity = db_bin.current_quantity - content_update.quantity
    elif content_update.operation == "SET":
        new_quantity = content_update.quantity
    else:
        raise ValueError(f"Invalid operation: {content_update.operation}")
    
    # Update bin
    db_bin.current_item_id = content_update.item_id
    db_bin.current_item_sku = item.sku_code
    db_bin.current_quantity = new_quantity
    db_bin.current_lot_number = content_update.lot_number
    db_bin.current_batch_number = content_update.batch_number
    db_bin.current_expiry_date = content_update.expiry_date
    db_bin.is_empty = (new_quantity == 0)
    db_bin.last_accessed_at = datetime.utcnow()
    db_bin.updated_at = datetime.utcnow()
    
    # Create history record
    history = BinHistory(
        bin_id=bin_id,
        item_id=content_update.item_id,
        item_sku=item.sku_code,
        previous_quantity=previous_quantity,
        new_quantity=new_quantity,
        change_quantity=new_quantity - previous_quantity,
        change_type=content_update.operation,
        reference_id=None,  # Can be set by caller
        reference_type=None,
        changed_by_id=changed_by_id,
        changed_by_name=changed_by_name
    )
    db.add(history)
    
    await db.commit()
    await db.refresh(db_bin)
    return db_bin


async def reserve_bin(db: AsyncSession, bin_id: UUID) -> Optional[Bin]:
    """Reserve a bin for incoming putaway"""
    db_bin = await get_bin(db, bin_id)
    if not db_bin:
        return None
    
    if not db_bin.is_empty:
        raise ValueError("Cannot reserve a non-empty bin")
    
    db_bin.is_reserved = True
    db_bin.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(db_bin)
    return db_bin


async def unreserve_bin(db: AsyncSession, bin_id: UUID) -> Optional[Bin]:
    """Unreserve a bin"""
    db_bin = await get_bin(db, bin_id)
    if not db_bin:
        return None
    
    db_bin.is_reserved = False
    db_bin.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(db_bin)
    return db_bin


async def block_bin(
    db: AsyncSession,
    bin_id: UUID,
    reason: str
) -> Optional[Bin]:
    """Block a bin (for maintenance, damage, etc.)"""
    db_bin = await get_bin(db, bin_id)
    if not db_bin:
        return None
    
    db_bin.is_blocked = True
    db_bin.blocked_reason = reason
    db_bin.status = 'BLOCKED'
    db_bin.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(db_bin)
    return db_bin


async def unblock_bin(db: AsyncSession, bin_id: UUID) -> Optional[Bin]:
    """Unblock a bin"""
    db_bin = await get_bin(db, bin_id)
    if not db_bin:
        return None
    
    db_bin.is_blocked = False
    db_bin.blocked_reason = None
    db_bin.status = 'ACTIVE'
    db_bin.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(db_bin)
    return db_bin


async def delete_bin(db: AsyncSession, bin_id: UUID, hard_delete: bool = False) -> bool:
    """Delete a bin"""
    db_bin = await get_bin(db, bin_id)
    if not db_bin:
        return False
    
    if not db_bin.is_empty and not hard_delete:
        raise ValueError("Cannot delete a non-empty bin. Move contents first or use hard delete.")
    
    if hard_delete:
        await db.delete(db_bin)
    else:
        db_bin.status = 'INACTIVE'
        db_bin.updated_at = datetime.utcnow()
    
    await db.commit()
    return True


# ============================================================================
# BIN HISTORY
# ============================================================================

async def get_bin_history(
    db: AsyncSession,
    bin_id: UUID,
    limit: int = 100,
    change_type: Optional[str] = None
) -> List[BinHistory]:
    """Get bin history"""
    query = select(BinHistory).where(BinHistory.bin_id == bin_id)
    
    if change_type:
        query = query.where(BinHistory.change_type == change_type)
    
    query = query.order_by(BinHistory.created_at.desc()).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_item_history(
    db: AsyncSession,
    item_id: UUID,
    limit: int = 100
) -> List[BinHistory]:
    """Get history of an item across all bins"""
    query = select(BinHistory).where(
        BinHistory.item_id == item_id
    ).order_by(
        BinHistory.created_at.desc()
    ).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


# ============================================================================
# BIN SUGGESTION / PUTAWAY OPTIMIZATION
# ============================================================================

async def suggest_bin_for_putaway(
    db: AsyncSession,
    warehouse_id: UUID,
    item_id: UUID,
    quantity: Decimal,
    lot_number: Optional[str] = None,
    batch_number: Optional[str] = None
) -> Optional[Bin]:
    """
    Suggest the best bin for putaway based on item characteristics and bin availability
    """
    # Get item details
    item = await db.get(ItemMaster, item_id)
    if not item:
        raise ValueError(f"Item with ID {item_id} not found")
    
    # Determine bin type based on quantity and item characteristics
    suggested_bin_type = _determine_bin_type(item, quantity)
    
    # Find suitable bins
    query = select(Bin).where(
        Bin.warehouse_id == warehouse_id,
        Bin.bin_type == suggested_bin_type,
        Bin.status == 'ACTIVE',
        Bin.is_blocked == False,
        Bin.is_reserved == False,
        Bin.is_empty == True,
        Bin.max_weight_kg >= (item.weight_kg or 0) * quantity,
        Bin.max_volume_cc >= (item.volume_cc or 0) * quantity
    )
    
    # Check if bin can accept this SKU
    query = query.where(
        or_(
            Bin.max_sku_count > 1,
            Bin.current_item_id == item_id,
            Bin.current_item_id == None
        )
    )
    
    # Order by preference
    query = query.order_by(
        # Prefer bins in appropriate zone based on velocity
        Bin.pick_priority.asc(),
        # Prefer bins with same item for consolidation
        case(
            (Bin.current_item_id == item_id, 1),
            else_=2
        ),
        # Prefer bins that are a good size match
        func.abs(Bin.max_volume_cc - (item.volume_cc or 0) * quantity)
    ).limit(1)
    
    result = await db.execute(query)
    return result.scalar_one_or_none()


def _determine_bin_type(item: ItemMaster, quantity: Decimal) -> str:
    """Determine appropriate bin type based on item and quantity"""
    # Check if pallet quantity
    if item.pallet_quantity and quantity >= item.pallet_quantity:
        return 'pallet'
    
    # Check if case quantity
    if item.case_quantity and quantity >= item.case_quantity:
        return 'shelf'
    
    # Check if item is fast mover
    if item.velocity_class == 'A' and item.pick_face_eligible:
        return 'pick-face'
    
    # Check if large quantity
    if quantity > 100:
        return 'bulk'
    
    # Default to shelf
    return 'shelf'


async def check_item_compatibility(
    db: AsyncSession,
    item1_id: UUID,
    item2_id: UUID
) -> bool:
    """Check if two items can be stored together"""
    item1 = await db.get(ItemMaster, item1_id)
    item2 = await db.get(ItemMaster, item2_id)
    
    if not item1 or not item2:
        return False
    
    # Check hazardous compatibility
    if item1.is_hazardous and not item2.is_hazardous:
        rules1 = item1.compatibility_rules or {}
        if rules1.get('isolate_from_non_hazardous', False):
            return False
    
    if item2.is_hazardous and not item1.is_hazardous:
        rules2 = item2.compatibility_rules or {}
        if rules2.get('isolate_from_non_hazardous', False):
            return False
    
    # Check custom rules
    for item, other in [(item1, item2), (item2, item1)]:
        rules = item.compatibility_rules or {}
        incompatible_with = rules.get('incompatible_with', [])
        
        if other.item_category in incompatible_with:
            return False
        if other.item_type in incompatible_with:
            return False
    
    return True


# ============================================================================
# STATISTICS
# ============================================================================

async def get_warehouse_statistics(db: AsyncSession, warehouse_id: UUID) -> Dict[str, Any]:
    """Get comprehensive statistics for a warehouse"""
    # Get warehouse
    warehouse = await get_warehouse(db, warehouse_id)
    if not warehouse:
        return {}
    
    # Get zones count
    zones_count = await db.execute(
        select(func.count()).select_from(Zone).where(Zone.warehouse_id == warehouse_id)
    )
    
    # Get bins statistics
    total_bins = await db.execute(
        select(func.count()).select_from(Bin).where(Bin.warehouse_id == warehouse_id)
    )
    
    available_bins = await db.execute(
        select(func.count()).select_from(Bin).where(
            Bin.warehouse_id == warehouse_id,
            Bin.is_empty == True,
            Bin.status == 'ACTIVE',
            Bin.is_blocked == False
        )
    )
    
    occupied_bins = await db.execute(
        select(func.count()).select_from(Bin).where(
            Bin.warehouse_id == warehouse_id,
            Bin.is_empty == False
        )
    )
    
    blocked_bins = await db.execute(
        select(func.count()).select_from(Bin).where(
            Bin.warehouse_id == warehouse_id,
            Bin.is_blocked == True
        )
    )
    
    # Bins by type
    bins_by_type_query = select(
        Bin.bin_type,
        func.count().label('count')
    ).where(
        Bin.warehouse_id == warehouse_id
    ).group_by(Bin.bin_type)
    
    bins_by_type = await db.execute(bins_by_type_query)
    bins_by_type_dict = {row.bin_type: row.count for row in bins_by_type}
    
    # Calculate utilization
    bins = await get_bins(db, warehouse_id=warehouse_id)
    total_capacity = sum(float(b.max_volume_cc or 0) for b in bins)
    
    occupied_bins_list = await get_bins(db, warehouse_id=warehouse_id, is_empty=False)
    used_capacity = 0
    for b in occupied_bins_list:
        if b.current_item and b.current_item.volume_cc:
            used_capacity += float(b.current_quantity) * float(b.current_item.volume_cc)
    
    utilization = (used_capacity / total_capacity * 100) if total_capacity > 0 else 0
    
    # Active zones count
    active_zones = await db.execute(
        select(func.count()).select_from(Zone).where(
            Zone.warehouse_id == warehouse_id,
            Zone.is_active == True
        )
    )
    
    return {
        "warehouse_code": warehouse.code,
        "warehouse_name": warehouse.name,
        "total_zones": zones_count.scalar() or 0,
        "total_bins": total_bins.scalar() or 0,
        "available_bins": available_bins.scalar() or 0,
        "occupied_bins": occupied_bins.scalar() or 0,
        "blocked_bins": blocked_bins.scalar() or 0,
        "bins_by_type": bins_by_type_dict,
        "capacity_utilization": round(utilization, 2),
        "active_zones": active_zones.scalar() or 0
    }


async def get_zone_statistics(db: AsyncSession, zone_id: UUID) -> Dict[str, Any]:
    """Get statistics for a specific zone"""
    zone = await get_zone(db, zone_id)
    if not zone:
        return {}
    
    bins = await get_bins(db, zone_id=zone_id)
    
    total_bins = len(bins)
    available_bins = sum(1 for b in bins if b.is_empty and b.status == 'ACTIVE' and not b.is_blocked)
    occupied_bins = sum(1 for b in bins if not b.is_empty)
    blocked_bins = sum(1 for b in bins if b.is_blocked)
    
    # Calculate zone capacity utilization
    total_capacity = sum(float(b.max_volume_cc or 0) for b in bins)
    used_capacity = 0
    for b in bins:
        if not b.is_empty and b.current_item and b.current_item.volume_cc:
            used_capacity += float(b.current_quantity) * float(b.current_item.volume_cc)
    
    utilization = (used_capacity / total_capacity * 100) if total_capacity > 0 else 0
    
    # Bins by type in this zone
    bins_by_type = {}
    for b in bins:
        bins_by_type[b.bin_type] = bins_by_type.get(b.bin_type, 0) + 1
    
    return {
        "zone_id": str(zone.id),
        "zone_code": zone.code,
        "zone_name": zone.name,
        "zone_type": zone.zone_type,
        "total_bins": total_bins,
        "available_bins": available_bins,
        "occupied_bins": occupied_bins,
        "blocked_bins": blocked_bins,
        "utilization_percentage": round(utilization, 2),
        "bins_by_type": bins_by_type
    }


async def get_bin_statistics(db: AsyncSession, bin_id: UUID) -> Dict[str, Any]:
    """Get statistics for a specific bin"""
    bin = await get_bin(db, bin_id)
    if not bin:
        return {}
    
    # Get recent activity
    recent_activity = await get_bin_history(db, bin_id, limit=10)
    
    # Calculate utilization percentage
    utilization = 0
    if bin.max_volume_cc and bin.current_item and bin.current_item.volume_cc:
        utilization = float(bin.current_quantity * bin.current_item.volume_cc) / float(bin.max_volume_cc) * 100
    
    return {
        "bin_id": str(bin.id),
        "bin_code": bin.code,
        "bin_type": bin.bin_type,
        "status": bin.status,
        "is_empty": bin.is_empty,
        "is_reserved": bin.is_reserved,
        "is_blocked": bin.is_blocked,
        "current_item_sku": bin.current_item_sku,
        "current_quantity": float(bin.current_quantity),
        "utilization_percentage": round(utilization, 2),
        "last_accessed": bin.last_accessed_at,
        "last_counted": bin.last_counted_at,
        "recent_activity": [
            {
                "change_type": h.change_type,
                "quantity_change": float(h.change_quantity) if h.change_quantity else 0,
                "changed_by": h.changed_by_name,
                "created_at": h.created_at
            }
            for h in recent_activity
        ]
    }


# ============================================================================
# BATCH OPERATIONS
# ============================================================================

async def bulk_create_bins(
    db: AsyncSession,
    warehouse_id: UUID,
    zone_id: Optional[UUID],
    bin_configs: List[Dict[str, Any]],
    created_by: Optional[str] = None
) -> Dict[str, Any]:
    """Create multiple bins in bulk (e.g., for a new rack/aisle)"""
    created_bins = []
    errors = []
    
    for config in bin_configs:
        try:
            # Ensure warehouse_id is set
            config['warehouse_id'] = warehouse_id
            if zone_id:
                config['zone_id'] = zone_id
            
            bin_create = BinCreate(**config)
            bin = await create_bin(db, bin_create)
            
            # ✅ IMPORTANT: Convert SQLAlchemy model to dict for JSON serialization
            from app.schemas.warehouse import Bin as BinSchema
            bin_schema = BinSchema.model_validate(bin)
            created_bins.append(bin_schema)
            
        except Exception as e:
            errors.append({
                'code': config.get('code', 'unknown'),
                'error': str(e)
            })
    
    return {
        'created': created_bins,
        'total_created': len(created_bins),
        'errors': errors,
        'total_errors': len(errors)
    }

async def bulk_update_bin_status(
    db: AsyncSession,
    bin_ids: List[UUID],
    status: str,
    reason: Optional[str] = None,
    updated_by: Optional[str] = None
) -> int:
    """Update status for multiple bins at once"""
    update_data = {
        'status': status,
        'updated_at': datetime.utcnow()
    }
    
    if status == 'BLOCKED' and reason:
        update_data['is_blocked'] = True
        update_data['blocked_reason'] = reason
    elif status == 'ACTIVE':
        update_data['is_blocked'] = False
        update_data['blocked_reason'] = None
    
    stmt = (
        update(Bin)
        .where(Bin.id.in_(bin_ids))
        .values(**update_data)
        .execution_options(synchronize_session=False)
    )
    
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount


# ============================================================================
# LOCATION SUGGESTION FOR PICKING
# ============================================================================

async def suggest_picking_location(
    db: AsyncSession,
    item_id: UUID,
    quantity: Decimal,
    warehouse_id: UUID
) -> List[Bin]:
    """
    Suggest bins for picking an item, ordered by optimal picking order
    """
    bins = await get_bins(
        db,
        warehouse_id=warehouse_id,
        item_id=item_id,
        is_empty=False,
        active_only=True
    )
    
    # Filter bins with sufficient quantity
    suitable_bins = [b for b in bins if b.current_quantity >= quantity]
    
    if suitable_bins:
        # Return bins with sufficient quantity, ordered by pick priority
        return sorted(suitable_bins, key=lambda b: (b.pick_priority, b.distance_from_packing or 999))
    
    # If no single bin has enough, return all bins with the item (for multi-bin picks)
    if bins:
        return sorted(bins, key=lambda b: (b.pick_priority, b.distance_from_packing or 999))
    
    return []


# ============================================================================
# CLEANUP AND MAINTENANCE
# ============================================================================

async def cleanup_empty_reserved_bins(
    db: AsyncSession,
    warehouse_id: Optional[UUID] = None,
    hours_threshold: int = 24
) -> int:
    """
    Clear reservation flag on bins that have been reserved for too long
    """
    threshold_time = datetime.utcnow() - timedelta(hours=hours_threshold)
    
    query = select(Bin).where(
        Bin.is_reserved == True,
        Bin.updated_at < threshold_time
    )
    
    if warehouse_id:
        query = query.where(Bin.warehouse_id == warehouse_id)
    
    result = await db.execute(query)
    bins = result.scalars().all()
    
    for bin in bins:
        bin.is_reserved = False
        bin.updated_at = datetime.utcnow()
    
    await db.commit()
    return len(bins)