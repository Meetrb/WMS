from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta
import json

from app.models.item_master import ItemMaster
from app.schemas.item_master import ItemMasterCreate, ItemMasterUpdate


# ============================================================================
# BASIC CRUD OPERATIONS
# ============================================================================

async def get_item_by_id(db: AsyncSession, item_id: UUID) -> Optional[ItemMaster]:
    """
    Get item master by ID
    
    Args:
        db: Database session
        item_id: UUID of the item
    
    Returns:
        ItemMaster object if found, None otherwise
    """
    query = select(ItemMaster).where(ItemMaster.id == item_id)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_item_by_sku(db: AsyncSession, sku: str) -> Optional[ItemMaster]:
    """
    Get item master by SKU code
    
    Args:
        db: Database session
        sku: SKU code of the item
    
    Returns:
        ItemMaster object if found, None otherwise
    """
    query = select(ItemMaster).where(ItemMaster.sku_code == sku)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_item_by_barcode(db: AsyncSession, barcode: str) -> Optional[ItemMaster]:
    """
    Get item master by primary barcode
    
    Args:
        db: Database session
        barcode: Primary barcode of the item
    
    Returns:
        ItemMaster object if found, None otherwise
    """
    query = select(ItemMaster).where(ItemMaster.primary_barcode == barcode)
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_items(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    search: Optional[str] = None,
    item_type: Optional[str] = None,
    item_category: Optional[str] = None,
    velocity_class: Optional[str] = None,
    is_hazardous: Optional[bool] = None,
    requires_inspection: Optional[bool] = None,
    active_only: bool = True
) -> List[ItemMaster]:
    """
    Get list of items with optional filters
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        search: Search term for SKU, description, or barcode
        item_type: Filter by item type
        item_category: Filter by item category
        velocity_class: Filter by velocity class (A, B, C)
        is_hazardous: Filter hazardous items
        requires_inspection: Filter items requiring inspection
        active_only: Return only active items
    
    Returns:
        List of ItemMaster objects
    """
    query = select(ItemMaster)
    
    if active_only:
        query = query.where(ItemMaster.active == True)
    
    if item_type:
        query = query.where(ItemMaster.item_type == item_type)
    
    if item_category:
        query = query.where(ItemMaster.item_category == item_category)
    
    if velocity_class:
        query = query.where(ItemMaster.velocity_class == velocity_class)
    
    if is_hazardous is not None:
        query = query.where(ItemMaster.is_hazardous == is_hazardous)
    
    if requires_inspection is not None:
        query = query.where(ItemMaster.requires_inspection == requires_inspection)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                ItemMaster.sku_code.ilike(search_term),
                ItemMaster.description.ilike(search_term),
                ItemMaster.short_description.ilike(search_term),
                ItemMaster.primary_barcode.ilike(search_term)
            )
        )
    
    query = query.offset(skip).limit(limit).order_by(ItemMaster.sku_code)
    result = await db.execute(query)
    return result.scalars().all()


async def create_item(
    db: AsyncSession, 
    item_data: ItemMasterCreate, 
    created_by: Optional[str] = None
) -> ItemMaster:
    """
    Create a new item master
    
    Args:
        db: Database session
        item_data: ItemMasterCreate schema with item data
        created_by: Username of creator
    
    Returns:
        Created ItemMaster object
    """
    # Check if SKU already exists
    existing = await get_item_by_sku(db, item_data.sku_code)
    if existing:
        raise ValueError(f"Item with SKU {item_data.sku_code} already exists")
    
    # Check if barcode already exists (if provided)
    if item_data.primary_barcode:
        existing_barcode = await get_item_by_barcode(db, item_data.primary_barcode)
        if existing_barcode:
            raise ValueError(f"Item with barcode {item_data.primary_barcode} already exists")
    
    # Create new item with all fields
    db_item = ItemMaster(
        # Core Identification
        sku_code=item_data.sku_code,
        description=item_data.description,
        short_description=item_data.short_description,
        
        # Barcodes
        primary_barcode=item_data.primary_barcode,
        alt_barcodes=item_data.alt_barcodes,
        rfid_tag=item_data.rfid_tag,
        
        # Unit of Measure
        base_uom=item_data.base_uom,
        alt_uom=item_data.alt_uom,
        uom_conversion=item_data.uom_conversion,
        uom_hierarchy=item_data.uom_hierarchy,
        
        # Physical Dimensions
        length_cm=item_data.length_cm,
        width_cm=item_data.width_cm,
        height_cm=item_data.height_cm,
        weight_kg=item_data.weight_kg,
        volume_cc=item_data.volume_cc,
        
        # Pallet/Case quantities
        pallet_quantity=item_data.pallet_quantity,
        case_quantity=item_data.case_quantity,
        inner_quantity=item_data.inner_quantity,
        
        # Item Classification
        item_type=item_data.item_type,
        item_category=item_data.item_category,
        storage_condition=item_data.storage_condition,
        
        # Velocity Classification
        velocity_class=item_data.velocity_class,
        velocity_score=item_data.velocity_score,
        pick_frequency=item_data.pick_frequency or 0,
        
        # Storage Rules
        fefo_enabled=item_data.fefo_enabled,
        fifo_enabled=item_data.fifo_enabled,
        shelf_life_days=item_data.shelf_life_days,
        batch_required=item_data.batch_required,
        serial_required=item_data.serial_required,
        
        # Pick Face Configuration
        pick_face_eligible=item_data.pick_face_eligible,
        pick_face_capacity=item_data.pick_face_capacity,
        pick_face_replenishment_point=item_data.pick_face_replenishment_point,
        
        # Putaway Preferences
        preferred_zones=item_data.preferred_zones,
        preferred_bin_types=item_data.preferred_bin_types,
        picking_strategy=item_data.picking_strategy,
        max_stack_height=item_data.max_stack_height,
        max_qty_per_bin=item_data.max_qty_per_bin,
        
        # Compatibility Rules
        compatibility_rules=item_data.compatibility_rules,
        
        # Hazardous Materials
        is_hazardous=item_data.is_hazardous,
        hazard_class=item_data.hazard_class,
        hazmat_code=item_data.hazmat_code,
        
        # Quality/Inspection
        requires_inspection=item_data.requires_inspection,
        inspection_rule=item_data.inspection_rule,
        sample_percentage=item_data.sample_percentage,
        quarantine_on_failure=item_data.quarantine_on_failure,
        
        # GST/HSN
        hsn_code=item_data.hsn_code,
        tax_rate=item_data.tax_rate,
        
        # Status & Audit
        active=item_data.active if item_data.active is not None else True,
        created_by=created_by
    )
    
    db.add(db_item)
    await db.commit()
    await db.refresh(db_item)
    
    return db_item


async def update_item(
    db: AsyncSession,
    item_id: UUID,
    item_update: ItemMasterUpdate,
    updated_by: Optional[str] = None
) -> Optional[ItemMaster]:
    """
    Update an existing item master
    
    Args:
        db: Database session
        item_id: UUID of the item to update
        item_update: ItemMasterUpdate schema with fields to update
        updated_by: Username of updater
    
    Returns:
        Updated ItemMaster object if found, None otherwise
    """
    db_item = await get_item_by_id(db, item_id)
    if not db_item:
        return None
    
    # Convert to dict and update only provided fields
    update_data = item_update.dict(exclude_unset=True)
    
    # If updating SKU, check if new SKU already exists
    if 'sku_code' in update_data and update_data['sku_code'] != db_item.sku_code:
        existing = await get_item_by_sku(db, update_data['sku_code'])
        if existing:
            raise ValueError(f"Item with SKU {update_data['sku_code']} already exists")
    
    # If updating primary barcode, check if new barcode already exists
    if 'primary_barcode' in update_data and update_data['primary_barcode'] != db_item.primary_barcode:
        if update_data['primary_barcode']:
            existing = await get_item_by_barcode(db, update_data['primary_barcode'])
            if existing and existing.id != item_id:
                raise ValueError(f"Item with barcode {update_data['primary_barcode']} already exists")
    
    for field, value in update_data.items():
        setattr(db_item, field, value)
    
    db_item.updated_at = datetime.utcnow()
    db_item.updated_by = updated_by
    
    await db.commit()
    await db.refresh(db_item)
    
    return db_item


async def delete_item(
    db: AsyncSession, 
    item_id: UUID, 
    updated_by: Optional[str] = None
) -> bool:
    """
    Delete an item master (soft delete by setting active=False)
    
    Args:
        db: Database session
        item_id: UUID of the item to delete
        updated_by: Username of updater
    
    Returns:
        True if deleted, False if not found
    """
    db_item = await get_item_by_id(db, item_id)
    if not db_item:
        return False
    
    # Soft delete by marking as inactive
    db_item.active = False
    db_item.updated_at = datetime.utcnow()
    db_item.updated_by = updated_by
    
    await db.commit()
    return True


async def hard_delete_item(db: AsyncSession, item_id: UUID) -> bool:
    """
    Hard delete an item master (use with caution)
    
    Args:
        db: Database session
        item_id: UUID of the item to delete
    
    Returns:
        True if deleted, False if not found
    """
    db_item = await get_item_by_id(db, item_id)
    if not db_item:
        return False
    
    await db.delete(db_item)
    await db.commit()
    return True


# ============================================================================
# BATCH OPERATIONS
# ============================================================================

async def get_items_by_ids(db: AsyncSession, item_ids: List[UUID]) -> List[ItemMaster]:
    """
    Get multiple items by their IDs
    
    Args:
        db: Database session
        item_ids: List of item UUIDs
    
    Returns:
        List of ItemMaster objects
    """
    query = select(ItemMaster).where(ItemMaster.id.in_(item_ids))
    result = await db.execute(query)
    return result.scalars().all()


async def get_items_by_skus(db: AsyncSession, skus: List[str]) -> List[ItemMaster]:
    """
    Get multiple items by their SKUs
    
    Args:
        db: Database session
        skus: List of SKU codes
    
    Returns:
        List of ItemMaster objects
    """
    query = select(ItemMaster).where(ItemMaster.sku_code.in_(skus))
    result = await db.execute(query)
    return result.scalars().all()


async def bulk_create_items(
    db: AsyncSession, 
    items_data: List[ItemMasterCreate],
    created_by: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create multiple items in bulk
    
    Args:
        db: Database session
        items_data: List of ItemMasterCreate schemas
        created_by: Username of creator
    
    Returns:
        Dictionary with created items and errors
    """
    created_items = []
    errors = []
    
    for item_data in items_data:
        try:
            item = await create_item(db, item_data, created_by)
            created_items.append(item)
        except ValueError as e:
            errors.append({
                'sku': item_data.sku_code,
                'error': str(e)
            })
            continue
    
    return {
        'created': created_items,
        'errors': errors,
        'total_created': len(created_items),
        'total_errors': len(errors)
    }


# ============================================================================
# SEARCH AND FILTER FUNCTIONS
# ============================================================================

async def search_items_by_description(
    db: AsyncSession,
    search_term: str,
    limit: int = 50
) -> List[ItemMaster]:
    """
    Search items by description (partial match)
    
    Args:
        db: Database session
        search_term: Term to search in description
        limit: Maximum number of results
    
    Returns:
        List of matching ItemMaster objects
    """
    query = select(ItemMaster).where(
        or_(
            ItemMaster.description.ilike(f"%{search_term}%"),
            ItemMaster.short_description.ilike(f"%{search_term}%")
        )
    ).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_items_by_type(
    db: AsyncSession,
    item_type: str,
    skip: int = 0,
    limit: int = 100
) -> List[ItemMaster]:
    """
    Get items by item type
    
    Args:
        db: Database session
        item_type: Type of items to retrieve
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of ItemMaster objects
    """
    query = select(ItemMaster).where(
        ItemMaster.item_type == item_type
    ).offset(skip).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_items_by_category(
    db: AsyncSession,
    category: str,
    skip: int = 0,
    limit: int = 100
) -> List[ItemMaster]:
    """
    Get items by item category
    
    Args:
        db: Database session
        category: Category of items to retrieve
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of ItemMaster objects
    """
    query = select(ItemMaster).where(
        ItemMaster.item_category == category
    ).offset(skip).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_items_by_velocity(
    db: AsyncSession,
    velocity_class: str,
    skip: int = 0,
    limit: int = 100
) -> List[ItemMaster]:
    """
    Get items by velocity class
    
    Args:
        db: Database session
        velocity_class: Velocity class (A, B, C)
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of ItemMaster objects
    """
    query = select(ItemMaster).where(
        ItemMaster.velocity_class == velocity_class
    ).offset(skip).limit(limit)
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_items_requiring_batch(db: AsyncSession) -> List[ItemMaster]:
    """
    Get all items that require batch tracking
    
    Returns:
        List of ItemMaster objects with batch_required = True
    """
    query = select(ItemMaster).where(ItemMaster.batch_required == True)
    result = await db.execute(query)
    return result.scalars().all()


async def get_items_requiring_serial(db: AsyncSession) -> List[ItemMaster]:
    """
    Get all items that require serial number tracking
    
    Returns:
        List of ItemMaster objects with serial_required = True
    """
    query = select(ItemMaster).where(ItemMaster.serial_required == True)
    result = await db.execute(query)
    return result.scalars().all()


# ============================================================================
# VELOCITY MANAGEMENT FUNCTIONS
# ============================================================================

async def update_item_velocity(
    db: AsyncSession,
    item_id: UUID,
    velocity_class: str,
    updated_by: str,
    reason: str
) -> Optional[ItemMaster]:
    """
    Manually update item velocity class
    
    Args:
        db: Database session
        item_id: UUID of the item
        velocity_class: New velocity class (A, B, C)
        updated_by: Username of updater
        reason: Reason for change
    
    Returns:
        Updated ItemMaster object if found, None otherwise
    """
    if velocity_class not in ['A', 'B', 'C']:
        raise ValueError("Velocity class must be A, B, or C")
    
    db_item = await get_item_by_id(db, item_id)
    if not db_item:
        return None
    
    old_class = db_item.velocity_class
    db_item.velocity_class = velocity_class
    db_item.last_velocity_calc = datetime.utcnow()
    db_item.updated_by = updated_by
    db_item.updated_at = datetime.utcnow()
    
    # Log velocity change (you might want a separate table for this)
    # For now, we'll just print or use a simple log
    print(f"Velocity change: {db_item.sku_code} - {old_class} -> {velocity_class} by {updated_by}: {reason}")
    
    await db.commit()
    await db.refresh(db_item)
    return db_item


async def calculate_velocity_for_all_items(db: AsyncSession, days: int = 90) -> Dict[str, Any]:
    """
    Automated velocity calculation based on historical data
    This would be run as a scheduled job
    
    Args:
        db: Database session
        days: Number of days to look back
    
    Returns:
        Dictionary with results summary
    """
    from app.models.asn import ShipmentItem
    from app.models.inbound import ASNShipmentItem
    
    # Get all active items
    items = await get_items(db, active_only=True, limit=10000)
    
    results = {
        'total_processed': 0,
        'changed': [],
        'errors': [],
        'summary': {
            'A': 0,
            'B': 0,
            'C': 0
        }
    }
    
    cutoff_date = datetime.utcnow() - timedelta(days=days)
    
    for item in items:
        try:
            # Get outbound quantity (shipments)
            outbound_query = select(func.coalesce(func.sum(ShipmentItem.quantity), 0)).where(
                ShipmentItem.item_master_id == item.id,
                ShipmentItem.created_at >= cutoff_date
            )
            outbound_result = await db.execute(outbound_query)
            outbound_qty = outbound_result.scalar() or 0
            
            # Get inbound quantity (receipts)
            inbound_query = select(func.coalesce(func.sum(ASNShipmentItem.expected_quantity), 0)).where(
                ASNShipmentItem.item_master_id == item.id,
                ASNShipmentItem.created_at >= cutoff_date
            )
            inbound_result = await db.execute(inbound_query)
            inbound_qty = inbound_result.scalar() or 0
            
            # Calculate velocity metrics
            total_movement = float(outbound_qty) + float(inbound_qty)
            daily_avg = total_movement / days if days > 0 else 0
            
            # Update pick frequency
            item.pick_frequency = int(outbound_qty)
            item.velocity_score = daily_avg
            
            # Determine new velocity class
            old_class = item.velocity_class
            new_class = _determine_velocity_class(daily_avg, outbound_qty)
            
            # Update if changed
            if old_class != new_class:
                item.velocity_class = new_class
                item.last_velocity_calc = datetime.utcnow()
                
                results['changed'].append({
                    'sku': item.sku_code,
                    'old_class': old_class,
                    'new_class': new_class,
                    'score': round(daily_avg, 2),
                    'total_movement': total_movement
                })
            
            # Count by class
            if item.velocity_class:
                results['summary'][item.velocity_class] += 1
            
            results['total_processed'] += 1
            
        except Exception as e:
            results['errors'].append({
                'sku': item.sku_code,
                'error': str(e)
            })
    
    await db.commit()
    return results


def _determine_velocity_class(daily_avg: float, total_picks: int) -> str:
    """
    Determine velocity class based on daily average and total picks
    This is a configurable algorithm
    """
    if daily_avg > 50 or total_picks > 1000:
        return 'A'
    elif daily_avg > 10 or total_picks > 200:
        return 'B'
    else:
        return 'C'


# ============================================================================
# PICK FACE MANAGEMENT
# ============================================================================

async def get_pick_face_eligible_items(
    db: AsyncSession,
    warehouse_id: Optional[UUID] = None,
    velocity_class: str = 'A'
) -> List[ItemMaster]:
    """
    Get items eligible for pick face storage
    
    Args:
        db: Database session
        warehouse_id: Optional warehouse filter
        velocity_class: Filter by velocity class (default 'A')
    
    Returns:
        List of pick face eligible items
    """
    query = select(ItemMaster).where(
        ItemMaster.pick_face_eligible == True,
        ItemMaster.active == True
    )
    
    if velocity_class:
        query = query.where(ItemMaster.velocity_class == velocity_class)
    
    # Order by velocity score (highest first)
    query = query.order_by(ItemMaster.velocity_score.desc().nulls_last())
    
    result = await db.execute(query)
    return result.scalars().all()


async def update_pick_face_config(
    db: AsyncSession,
    item_id: UUID,
    eligible: bool,
    updated_by: str,
    capacity: Optional[float] = None,
    replenishment_point: Optional[float] = None
) -> Optional[ItemMaster]:
    """
    Update pick face configuration for an item
    
    Args:
        db: Database session
        item_id: UUID of the item
        eligible: Whether item is eligible for pick face
        updated_by: Username of updater
        capacity: Maximum quantity in pick face
        replenishment_point: When to replenish
    
    Returns:
        Updated ItemMaster object if found, None otherwise
    """
    db_item = await get_item_by_id(db, item_id)
    if not db_item:
        return None
    
    db_item.pick_face_eligible = eligible
    if capacity is not None:
        db_item.pick_face_capacity = capacity
    if replenishment_point is not None:
        db_item.pick_face_replenishment_point = replenishment_point
    
    db_item.updated_by = updated_by
    db_item.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(db_item)
    return db_item


# ============================================================================
# COMPATIBILITY RULES
# ============================================================================

async def check_compatibility(
    db: AsyncSession,
    item1_id: UUID,
    item2_id: UUID
) -> Dict[str, Any]:
    """
    Check if two items can be stored together
    
    Args:
        db: Database session
        item1_id: UUID of first item
        item2_id: UUID of second item
    
    Returns:
        Dictionary with compatibility result
    """
    item1 = await get_item_by_id(db, item1_id)
    item2 = await get_item_by_id(db, item2_id)
    
    if not item1 or not item2:
        return {
            'compatible': False, 
            'reason': 'One or both items not found',
            'items_found': {
                'item1': item1 is not None,
                'item2': item2 is not None
            }
        }
    
    # Check if same item - always compatible
    if item1.id == item2.id:
        return {'compatible': True, 'reason': 'Same item'}
    
    # Check hazardous compatibility
    if item1.is_hazardous and not item2.is_hazardous:
        rules1 = item1.compatibility_rules or {}
        if rules1.get('isolate_from_non_hazardous', False):
            return {
                'compatible': False,
                'reason': f'Hazardous item {item1.sku_code} must be isolated from non-hazardous items'
            }
    
    if item2.is_hazardous and not item1.is_hazardous:
        rules2 = item2.compatibility_rules or {}
        if rules2.get('isolate_from_non_hazardous', False):
            return {
                'compatible': False,
                'reason': f'Hazardous item {item2.sku_code} must be isolated from non-hazardous items'
            }
    
    # Check custom compatibility rules for item1
    if item1.compatibility_rules:
        rules = item1.compatibility_rules
        incompatible_with = rules.get('incompatible_with', [])
        
        if item2.item_category in incompatible_with:
            return {
                'compatible': False,
                'reason': f'{item1.sku_code} incompatible with {item2.item_category}'
            }
        
        if item2.item_type in incompatible_with:
            return {
                'compatible': False,
                'reason': f'{item1.sku_code} incompatible with {item2.item_type}'
            }
    
    # Check custom compatibility rules for item2
    if item2.compatibility_rules:
        rules = item2.compatibility_rules
        incompatible_with = rules.get('incompatible_with', [])
        
        if item1.item_category in incompatible_with:
            return {
                'compatible': False,
                'reason': f'{item2.sku_code} incompatible with {item1.item_category}'
            }
        
        if item1.item_type in incompatible_with:
            return {
                'compatible': False,
                'reason': f'{item2.sku_code} incompatible with {item1.item_type}'
            }
    
    # Check storage condition compatibility
    if item1.storage_condition and item2.storage_condition:
        if item1.storage_condition != item2.storage_condition:
            return {
                'compatible': False,
                'reason': f'Storage condition mismatch: {item1.storage_condition} vs {item2.storage_condition}'
            }
    
    return {'compatible': True, 'reason': 'Items are compatible'}


async def get_compatible_items(
    db: AsyncSession,
    item_id: UUID,
    limit: int = 100
) -> List[ItemMaster]:
    """
    Get items that are compatible with the given item
    
    Args:
        db: Database session
        item_id: UUID of the reference item
        limit: Maximum number of items to return
    
    Returns:
        List of compatible items
    """
    reference_item = await get_item_by_id(db, item_id)
    if not reference_item:
        return []
    
    all_items = await get_items(db, active_only=True, limit=limit * 2)
    compatible_items = []
    
    for item in all_items:
        if item.id == reference_item.id:
            continue
        
        result = await check_compatibility(db, reference_item.id, item.id)
        if result['compatible']:
            compatible_items.append(item)
        
        if len(compatible_items) >= limit:
            break
    
    return compatible_items[:limit]


# ============================================================================
# HAZARDOUS ITEMS
# ============================================================================

async def get_hazardous_items(
    db: AsyncSession,
    hazard_class: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[ItemMaster]:
    """
    Get all hazardous items, optionally filtered by class
    
    Args:
        db: Database session
        hazard_class: Optional hazard class filter
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of hazardous items
    """
    query = select(ItemMaster).where(
        ItemMaster.is_hazardous == True,
        ItemMaster.active == True
    )
    
    if hazard_class:
        query = query.where(ItemMaster.hazard_class == hazard_class)
    
    query = query.offset(skip).limit(limit).order_by(ItemMaster.sku_code)
    result = await db.execute(query)
    return result.scalars().all()


async def get_hazardous_items_by_class(db: AsyncSession) -> Dict[str, int]:
    """
    Get count of hazardous items by hazard class
    
    Returns:
        Dictionary with counts per hazard class
    """
    query = select(
        ItemMaster.hazard_class,
        func.count().label('count')
    ).where(
        ItemMaster.is_hazardous == True,
        ItemMaster.active == True
    ).group_by(ItemMaster.hazard_class)
    
    result = await db.execute(query)
    return {row.hazard_class: row.count for row in result}


# ============================================================================
# QUALITY/INSPECTION FUNCTIONS
# ============================================================================

async def get_items_requiring_inspection(
    db: AsyncSession,
    inspection_rule: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[ItemMaster]:
    """
    Get items that require inspection
    
    Args:
        db: Database session
        inspection_rule: Optional rule filter (SAMPLING, FULL, NONE)
        skip: Number of records to skip
        limit: Maximum number of records to return
    
    Returns:
        List of items requiring inspection
    """
    query = select(ItemMaster).where(
        ItemMaster.requires_inspection == True,
        ItemMaster.active == True
    )
    
    if inspection_rule:
        query = query.where(ItemMaster.inspection_rule == inspection_rule)
    
    query = query.offset(skip).limit(limit).order_by(ItemMaster.sku_code)
    result = await db.execute(query)
    return result.scalars().all()


async def get_inspection_sample_size(
    db: AsyncSession,
    item_id: UUID,
    received_quantity: float
) -> Dict[str, Any]:
    """
    Calculate inspection sample size based on item rules
    
    Args:
        db: Database session
        item_id: UUID of the item
        received_quantity: Quantity received
    
    Returns:
        Dictionary with inspection details
    """
    item = await get_item_by_id(db, item_id)
    if not item or not item.requires_inspection:
        return {
            'requires_inspection': False,
            'sample_size': 0,
            'inspection_rule': 'NONE'
        }
    
    rule = item.inspection_rule or 'FULL'
    sample_percentage = item.sample_percentage or 100
    
    if rule == 'NONE':
        sample_size = 0
    elif rule == 'SAMPLING':
        sample_size = int(received_quantity * sample_percentage / 100)
        # Ensure minimum sample size (e.g., at least 1, at most received_quantity)
        sample_size = max(1, min(sample_size, int(received_quantity)))
    else:  # FULL
        sample_size = int(received_quantity)
    
    return {
        'requires_inspection': True,
        'inspection_rule': rule,
        'sample_percentage': sample_percentage,
        'sample_size': sample_size,
        'received_quantity': received_quantity
    }


# ============================================================================
# STATISTICS FUNCTIONS (Enhanced)
# ============================================================================

async def get_item_statistics(db: AsyncSession) -> Dict[str, Any]:
    """
    Get comprehensive statistics about items
    
    Returns:
        Dictionary with item statistics
    """
    # Total counts
    total_active_query = select(func.count()).select_from(ItemMaster).where(ItemMaster.active == True)
    total_active = await db.execute(total_active_query)
    total_active_count = total_active.scalar() or 0
    
    total_inactive_query = select(func.count()).select_from(ItemMaster).where(ItemMaster.active == False)
    total_inactive = await db.execute(total_inactive_query)
    total_inactive_count = total_inactive.scalar() or 0
    
    # Count by item type
    type_query = select(
        ItemMaster.item_type,
        func.count().label('count')
    ).group_by(ItemMaster.item_type)
    type_result = await db.execute(type_query)
    type_counts = {row.item_type or 'UNSPECIFIED': row.count for row in type_result}
    
    # Count by item category
    category_query = select(
        ItemMaster.item_category,
        func.count().label('count')
    ).group_by(ItemMaster.item_category)
    category_result = await db.execute(category_query)
    category_counts = {row.item_category or 'UNSPECIFIED': row.count for row in category_result}
    
    # Count by velocity class
    velocity_query = select(
        ItemMaster.velocity_class,
        func.count().label('count')
    ).group_by(ItemMaster.velocity_class)
    velocity_result = await db.execute(velocity_query)
    velocity_counts = {row.velocity_class or 'UNCLASSIFIED': row.count for row in velocity_result}
    
    # Batch and serial required counts
    batch_required_query = select(func.count()).select_from(ItemMaster).where(ItemMaster.batch_required == True)
    batch_required = await db.execute(batch_required_query)
    batch_required_count = batch_required.scalar() or 0
    
    serial_required_query = select(func.count()).select_from(ItemMaster).where(ItemMaster.serial_required == True)
    serial_required = await db.execute(serial_required_query)
    serial_required_count = serial_required.scalar() or 0
    
    # Hazardous items count
    hazardous_query = select(func.count()).select_from(ItemMaster).where(ItemMaster.is_hazardous == True)
    hazardous = await db.execute(hazardous_query)
    hazardous_count = hazardous.scalar() or 0
    
    # Items requiring inspection
    inspection_query = select(func.count()).select_from(ItemMaster).where(ItemMaster.requires_inspection == True)
    inspection = await db.execute(inspection_query)
    inspection_count = inspection.scalar() or 0
    
    # Pick face eligible items
    pick_face_query = select(func.count()).select_from(ItemMaster).where(ItemMaster.pick_face_eligible == True)
    pick_face = await db.execute(pick_face_query)
    pick_face_count = pick_face.scalar() or 0
    
    return {
        "total_items": total_active_count + total_inactive_count,
        "active_items": total_active_count,
        "inactive_items": total_inactive_count,
        "by_item_type": type_counts,
        "by_item_category": category_counts,
        "by_velocity_class": velocity_counts,
        "batch_required": batch_required_count,
        "serial_required": serial_required_count,
        "hazardous_items": hazardous_count,
        "requires_inspection": inspection_count,
        "pick_face_eligible": pick_face_count
    }


# ============================================================================
# BARCODE FUNCTIONS (Enhanced)
# ============================================================================

async def update_item_barcode(
    db: AsyncSession,
    item_id: UUID,
    barcode: str,
    updated_by: Optional[str] = None
) -> Optional[ItemMaster]:
    """
    Update primary barcode for an item
    
    Args:
        db: Database session
        item_id: UUID of the item
        barcode: New primary barcode
        updated_by: Username of updater
    
    Returns:
        Updated ItemMaster object if found, None otherwise
    """
    # Check if barcode already exists on another item
    existing = await get_item_by_barcode(db, barcode)
    if existing and existing.id != item_id:
        raise ValueError(f"Barcode {barcode} already exists on item {existing.sku_code}")
    
    db_item = await get_item_by_id(db, item_id)
    if not db_item:
        return None
    
    db_item.primary_barcode = barcode
    db_item.updated_at = datetime.utcnow()
    db_item.updated_by = updated_by
    
    await db.commit()
    await db.refresh(db_item)
    
    return db_item


async def add_alternative_barcode(
    db: AsyncSession,
    item_id: UUID,
    barcode: str,
    updated_by: Optional[str] = None
) -> Optional[ItemMaster]:
    """
    Add an alternative barcode to an item
    
    Args:
        db: Database session
        item_id: UUID of the item
        barcode: Alternative barcode to add
        updated_by: Username of updater
    
    Returns:
        Updated ItemMaster object if found, None otherwise
    """
    # Check if barcode already exists as primary on another item
    existing = await get_item_by_barcode(db, barcode)
    if existing and existing.id != item_id:
        raise ValueError(f"Barcode {barcode} already exists as primary on item {existing.sku_code}")
    
    db_item = await get_item_by_id(db, item_id)
    if not db_item:
        return None
    
    # Initialize alt_barcodes if None
    if not db_item.alt_barcodes:
        db_item.alt_barcodes = []
    elif isinstance(db_item.alt_barcodes, str):
        # Handle legacy text format
        try:
            db_item.alt_barcodes = json.loads(db_item.alt_barcodes)
        except:
            db_item.alt_barcodes = [db_item.alt_barcodes] if db_item.alt_barcodes else []
    
    # Add barcode if not already present
    if barcode not in db_item.alt_barcodes:
        db_item.alt_barcodes.append(barcode)
        db_item.updated_at = datetime.utcnow()
        db_item.updated_by = updated_by
        
        await db.commit()
        await db.refresh(db_item)
    
    return db_item


async def remove_alternative_barcode(
    db: AsyncSession,
    item_id: UUID,
    barcode: str,
    updated_by: Optional[str] = None
) -> Optional[ItemMaster]:
    """
    Remove an alternative barcode from an item
    
    Args:
        db: Database session
        item_id: UUID of the item
        barcode: Alternative barcode to remove
        updated_by: Username of updater
    
    Returns:
        Updated ItemMaster object if found, None otherwise
    """
    db_item = await get_item_by_id(db, item_id)
    if not db_item or not db_item.alt_barcodes:
        return db_item
    
    # Handle both list and string formats
    alt_barcodes = db_item.alt_barcodes
    if isinstance(alt_barcodes, str):
        try:
            alt_barcodes = json.loads(alt_barcodes)
        except:
            alt_barcodes = [alt_barcodes] if alt_barcodes else []
    
    if barcode in alt_barcodes:
        alt_barcodes.remove(barcode)
        db_item.alt_barcodes = alt_barcodes
        db_item.updated_at = datetime.utcnow()
        db_item.updated_by = updated_by
        
        await db.commit()
        await db.refresh(db_item)
    
    return db_item


async def find_item_by_any_barcode(
    db: AsyncSession,
    barcode: str
) -> Optional[ItemMaster]:
    """
    Find item by any barcode (primary or alternative)
    
    Args:
        db: Database session
        barcode: Barcode to search for
    
    Returns:
        ItemMaster object if found, None otherwise
    """
    # Check primary barcode first
    item = await get_item_by_barcode(db, barcode)
    if item:
        return item
    
    # Check alternative barcodes
    # This is more complex - we need to search in JSON field
    # For PostgreSQL, we can use JSON containment operators
    query = select(ItemMaster).where(
        ItemMaster.alt_barcodes != None,
        ItemMaster.alt_barcodes.contains(barcode)
    )
    
    result = await db.execute(query)
    return result.scalar_one_or_none()


# ============================================================================
# UOM CONVERSION FUNCTIONS
# ============================================================================

async def convert_quantity(
    db: AsyncSession,
    item_id: UUID,
    quantity: float,
    from_uom: str,
    to_uom: str
) -> Dict[str, Any]:
    """
    Convert quantity between different units of measure
    
    Args:
        db: Database session
        item_id: UUID of the item
        quantity: Quantity to convert
        from_uom: Source UOM
        to_uom: Target UOM
    
    Returns:
        Dictionary with conversion result
    """
    item = await get_item_by_id(db, item_id)
    if not item:
        raise ValueError(f"Item with ID {item_id} not found")
    
    # Same UOM - no conversion needed
    if from_uom == to_uom:
        return {
            'original_quantity': quantity,
            'converted_quantity': quantity,
            'from_uom': from_uom,
            'to_uom': to_uom,
            'conversion_factor': 1.0
        }
    
    # Use uom_hierarchy if available
    if item.uom_hierarchy and from_uom in item.uom_hierarchy and to_uom in item.uom_hierarchy:
        from_factor = item.uom_hierarchy[from_uom]
        to_factor = item.uom_hierarchy[to_uom]
        conversion_factor = from_factor / to_factor
        
        return {
            'original_quantity': quantity,
            'converted_quantity': quantity * conversion_factor,
            'from_uom': from_uom,
            'to_uom': to_uom,
            'conversion_factor': conversion_factor,
            'using': 'hierarchy'
        }
    
    # Use base_uom and uom_conversion
    if item.base_uom == from_uom:
        conversion_factor = 1 / item.uom_conversion if item.uom_conversion else 1
    elif item.base_uom == to_uom:
        conversion_factor = item.uom_conversion or 1
    else:
        # Convert through base_uom
        if from_uom == item.base_uom:
            to_base = 1
        elif item.alt_uom == from_uom and item.uom_conversion:
            to_base = item.uom_conversion
        else:
            raise ValueError(f"Cannot convert from {from_uom} to {to_uom} for item {item.sku_code}")
        
        if to_uom == item.base_uom:
            from_base = 1
        elif item.alt_uom == to_uom and item.uom_conversion:
            from_base = 1 / item.uom_conversion
        else:
            raise ValueError(f"Cannot convert to {to_uom} from {from_uom} for item {item.sku_code}")
        
        conversion_factor = to_base * from_base
    
    return {
        'original_quantity': quantity,
        'converted_quantity': quantity * conversion_factor,
        'from_uom': from_uom,
        'to_uom': to_uom,
        'conversion_factor': conversion_factor,
        'using': 'base_uom'
    }