from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from typing import List, Optional, Tuple, Dict, Any
from uuid import UUID
from datetime import datetime, date, timezone

from app.models.asn import ASN, Shipment, ShipmentItem
from app.models.item_master import ItemMaster
from app.models.supplier_master import SupplierMaster
from app.schemas.asn import ASNCreate, ASNUpdate
from app.crud.item_master import get_item_by_sku, create_item, get_item_by_id
from app.crud.supplier_master import get_supplier_by_code, create_supplier


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def make_naive_datetime(dt: Optional[datetime]) -> Optional[datetime]:
    """
    Convert timezone-aware datetime to naive UTC datetime
    This is crucial for PostgreSQL TIMESTAMP WITHOUT TIME ZONE columns
    
    Args:
        dt: Datetime object that might have timezone info
    
    Returns:
        Naive datetime in UTC
    """
    if dt is None:
        return None
    if isinstance(dt, datetime):
        if dt.tzinfo is not None:
            # Convert to UTC and remove timezone info
            return dt.astimezone(timezone.utc).replace(tzinfo=None)
    return dt


async def get_or_create_supplier_master(
    db: AsyncSession, 
    supplier_data: dict
) -> Tuple[SupplierMaster, bool]:
    """
    Get existing supplier master or create new one
    
    Args:
        db: Database session
        supplier_data: Dictionary with supplier information
    
    Returns:
        Tuple of (SupplierMaster object, is_new boolean)
    """
    # Try to find by code
    supplier = await get_supplier_by_code(db, supplier_data.get('code', ''))
    if supplier:
        return supplier, False
    
    # Create new supplier master
    from app.schemas.supplier_master import SupplierMasterCreate
    supplier_in = SupplierMasterCreate(
        code=supplier_data.get('code', ''),
        name=supplier_data.get('name', ''),
        gstin=supplier_data.get('gstin'),
        contact_person=supplier_data.get('contact_person'),
        phone=supplier_data.get('phone'),
        email=supplier_data.get('email'),
        address=supplier_data.get('address')
    )
    supplier = await create_supplier(db, supplier_in)
    return supplier, True


async def get_or_create_item_master(
    db: AsyncSession,
    item_data: dict
) -> Tuple[ItemMaster, bool]:
    """
    Get existing item master or create new one
    
    Args:
        db: Database session
        item_data: Dictionary with item information
    
    Returns:
        Tuple of (ItemMaster object, is_new boolean)
    """
    # Try to find by SKU
    item = await get_item_by_sku(db, item_data.get('sku', ''))
    if item:
        return item, False
    
    # Create new item master
    from app.schemas.item_master import ItemMasterCreate
    item_in = ItemMasterCreate(
        sku_code=item_data.get('sku', ''),
        description=item_data.get('description', ''),
        base_uom=item_data.get('unit', 'PCS'),
        hsn_code=item_data.get('hsn_code'),
        batch_required=True if item_data.get('lot') else False
    )
    item = await create_item(db, item_in)
    return item, True


# ============================================================================
# MAIN CREATE FUNCTION
# ============================================================================

async def create_asn(
    db: AsyncSession, 
    asn_data: ASNCreate, 
    created_by: str
) -> Tuple[ASN, Dict[str, Any]]:
    """
    Create a new ASN with all shipments and items
    Integrates with master tables and handles datetime conversion
    
    Args:
        db: Database session
        asn_data: ASNCreate schema with all data
        created_by: Username of the creator
    
    Returns:
        Tuple of (created ASN object, result_info dictionary)
    """
    # Convert to dict with aliases - this will use snake_case keys
    asn_dict = asn_data.dict(by_alias=True)
    
    # ========================================================================
    # CRITICAL: Convert all datetime fields to naive UTC
    # This prevents the "can't subtract offset-naive and offset-aware datetimes" error
    # ========================================================================
    
    # Convert asn_date
    if 'asn_date' in asn_dict and asn_dict['asn_date']:
        original_date = asn_dict['asn_date']
        asn_dict['asn_date'] = make_naive_datetime(asn_dict['asn_date'])
        print(f"ASN Date conversion: {original_date} -> {asn_dict['asn_date']}")
    
    # Convert expected_date
    if 'expected_date' in asn_dict and asn_dict['expected_date']:
        original_date = asn_dict['expected_date']
        asn_dict['expected_date'] = make_naive_datetime(asn_dict['expected_date'])
        print(f"Expected Date conversion: {original_date} -> {asn_dict['expected_date']}")
    
    # Convert expiry_date in items (if they are datetime objects)
    for shipment in asn_dict.get('shipments', []):
        for item in shipment.get('items', []):
            if 'expiry_date' in item and item['expiry_date']:
                if isinstance(item['expiry_date'], datetime):
                    original_date = item['expiry_date']
                    item['expiry_date'] = make_naive_datetime(item['expiry_date'])
                    print(f"Expiry Date conversion: {original_date} -> {item['expiry_date']}")
                elif isinstance(item['expiry_date'], date) and not isinstance(item['expiry_date'], datetime):
                    # Keep as date, no conversion needed
                    pass
    
    print("Final ASN Dict after datetime conversion:", asn_dict)
    
    # Track new masters created
    result_info = {
        'new_suppliers': [],
        'new_items': []
    }
    
    # Process supplier for main ASN if provided
    main_supplier = None
    supplier_code = asn_dict.get('supplier_code')
    if supplier_code:
        supplier_data = {'code': supplier_code}
        main_supplier, is_new = await get_or_create_supplier_master(db, supplier_data)
        if is_new:
            result_info['new_suppliers'].append(supplier_code)
    
    # Create ASN main record with already converted dates
    db_asn = ASN(
        asn_number=asn_dict['asn_number'],
        asn_date=asn_dict['asn_date'],  # Now naive
        shipment_id=asn_dict['shipment_id'],
        expected_date=asn_dict['expected_date'],  # Now naive
        status=asn_dict.get('status', 'draft'),
        notes=asn_dict.get('notes'),
        supplier_id=main_supplier.id if main_supplier else None,
        created_by=created_by
    )
    
    db.add(db_asn)
    await db.flush()
    
    # Create shipments
    for shipment_data in asn_dict.get('shipments', []):
        # Process supplier for this shipment
        shipment_supplier = None
        shipment_supplier_code = shipment_data.get('supplier_code')
        
        if shipment_supplier_code:
            supplier_data = {'code': shipment_supplier_code}
            # Try to get from DB or use existing
            if shipment_supplier_code == supplier_code:
                shipment_supplier = main_supplier
            else:
                shipment_supplier, is_new = await get_or_create_supplier_master(db, supplier_data)
                if is_new:
                    result_info['new_suppliers'].append(shipment_supplier_code)
        
        db_shipment = Shipment(
            asn_id=db_asn.id,
            po_number=shipment_data['po_number'],
            supplier_id=shipment_supplier.id if shipment_supplier else None
        )
        db.add(db_shipment)
        await db.flush()
        
        # Create items for this shipment
        for item_data in shipment_data.get('items', []):
            # Get or create item master
            item_master, is_new_item = await get_or_create_item_master(db, item_data)
            if is_new_item:
                result_info['new_items'].append(item_data.get('sku', ''))
            
            # Handle expiry_date - ensure it's a date object
            expiry_date = item_data.get('expiry_date')
            if expiry_date and isinstance(expiry_date, datetime):
                expiry_date = expiry_date.date()
            
            db_item = ShipmentItem(
                shipment_id=db_shipment.id,
                item_master_id=item_master.id,
                quantity=item_data['quantity'],
                unit=item_data['unit'],
                unit_price=item_data.get('unit_price'),
                total_price=item_data.get('total_price'),
                lot=item_data.get('lot'),
                expiry_date=expiry_date  # Now properly handled
            )
            db.add(db_item)
    
    await db.commit()
    
    # Return the complete ASN with all relationships
    return await get_asn_by_id(db, db_asn.id), result_info


# ============================================================================
# QUERY FUNCTIONS
# ============================================================================

async def get_asn_by_id(db: AsyncSession, asn_id: UUID) -> Optional[ASN]:
    """
    Get ASN by ID with all relationships loaded
    
    Args:
        db: Database session
        asn_id: UUID of the ASN
    
    Returns:
        ASN object with all relationships or None
    """
    query = select(ASN).where(ASN.id == asn_id).options(
        selectinload(ASN.supplier),
        selectinload(ASN.shipments)
        .selectinload(Shipment.supplier),
        selectinload(ASN.shipments)
        .selectinload(Shipment.items)
        .selectinload(ShipmentItem.item_master)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_asn_by_number(db: AsyncSession, asn_number: str) -> Optional[ASN]:
    """
    Get ASN by ASN number
    
    Args:
        db: Database session
        asn_number: ASN number to search for
    
    Returns:
        ASN object with all relationships or None
    """
    query = select(ASN).where(ASN.asn_number == asn_number).options(
        selectinload(ASN.supplier),
        selectinload(ASN.shipments)
        .selectinload(Shipment.supplier),
        selectinload(ASN.shipments)
        .selectinload(Shipment.items)
        .selectinload(ShipmentItem.item_master)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_asns(
    db: AsyncSession, 
    skip: int = 0, 
    limit: int = 100,
    status: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None
) -> List[ASN]:
    """
    Get list of ASNs with optional filters
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        status: Filter by status
        from_date: Filter by expected date from
        to_date: Filter by expected date to
    
    Returns:
        List of ASN objects
    """
    query = select(ASN)
    
    # Convert filter dates if they have timezone
    if from_date:
        from_date = make_naive_datetime(from_date)
    if to_date:
        to_date = make_naive_datetime(to_date)
    
    # Apply filters
    if status:
        query = query.where(ASN.status == status)
    
    if from_date:
        query = query.where(ASN.expected_date >= from_date)
    
    if to_date:
        query = query.where(ASN.expected_date <= to_date)
    
    query = query.offset(skip).limit(limit).order_by(ASN.created_at.desc())
    result = await db.execute(query)
    return result.scalars().all()


async def update_asn(
    db: AsyncSession, 
    asn_id: UUID, 
    asn_update: ASNUpdate, 
    updated_by: str
) -> Optional[ASN]:
    """
    Update ASN details
    
    Args:
        db: Database session
        asn_id: UUID of the ASN to update
        asn_update: ASNUpdate schema with fields to update
        updated_by: Username of the updater
    
    Returns:
        Updated ASN object or None if not found
    """
    db_asn = await get_asn_by_id(db, asn_id)
    if not db_asn:
        return None
    
    # Convert to dict with aliases
    update_data = asn_update.dict(exclude_unset=True, by_alias=True)
    
    # Convert datetime fields if present
    if 'asn_date' in update_data and update_data['asn_date']:
        update_data['asn_date'] = make_naive_datetime(update_data['asn_date'])
    
    if 'expected_date' in update_data and update_data['expected_date']:
        update_data['expected_date'] = make_naive_datetime(update_data['expected_date'])
    
    # Update fields
    if 'asn_number' in update_data:
        db_asn.asn_number = update_data['asn_number']
    if 'asn_date' in update_data:
        db_asn.asn_date = update_data['asn_date']
    if 'shipment_id' in update_data:
        db_asn.shipment_id = update_data['shipment_id']
    if 'expected_date' in update_data:
        db_asn.expected_date = update_data['expected_date']
    if 'status' in update_data:
        db_asn.status = update_data['status']
    if 'notes' in update_data:
        db_asn.notes = update_data['notes']
    
    # Handle supplier update
    if 'supplier_code' in update_data and update_data['supplier_code']:
        supplier = await get_supplier_by_code(db, update_data['supplier_code'])
        if supplier:
            db_asn.supplier_id = supplier.id
    
    db_asn.updated_by = updated_by
    db_asn.updated_at = datetime.utcnow()
    
    await db.commit()
    
    # Return with relationships loaded
    return await get_asn_by_id(db, asn_id)


async def update_asn_status(
    db: AsyncSession, 
    asn_id: UUID, 
    status: str, 
    updated_by: str
) -> Optional[ASN]:
    """
    Update only the status of an ASN
    
    Args:
        db: Database session
        asn_id: UUID of the ASN
        status: New status value
        updated_by: Username of the updater
    
    Returns:
        Updated ASN object or None if not found
    """
    db_asn = await get_asn_by_id(db, asn_id)
    if not db_asn:
        return None
    
    db_asn.status = status
    db_asn.updated_by = updated_by
    db_asn.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(db_asn)
    
    return db_asn


async def delete_asn(db: AsyncSession, asn_id: UUID) -> bool:
    """
    Delete an ASN (cascade will delete all related records)
    
    Args:
        db: Database session
        asn_id: UUID of the ASN to delete
    
    Returns:
        True if deleted, False if not found
    """
    db_asn = await get_asn_by_id(db, asn_id)
    if not db_asn:
        return False
    
    await db.delete(db_asn)
    await db.commit()
    return True


async def search_asns(db: AsyncSession, search_term: str) -> List[ASN]:
    """
    Search ASNs by ASN number or shipment ID
    
    Args:
        db: Database session
        search_term: Term to search for
    
    Returns:
        List of matching ASN objects
    """
    query = select(ASN).where(
        or_(
            ASN.asn_number.ilike(f"%{search_term}%"),
            ASN.shipment_id.ilike(f"%{search_term}%")
        )
    ).order_by(ASN.created_at.desc())
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_asns_by_date_range(
    db: AsyncSession, 
    start_date: date, 
    end_date: date
) -> List[ASN]:
    """
    Get ASNs within a date range based on expected date
    
    Args:
        db: Database session
        start_date: Start date (inclusive)
        end_date: End date (inclusive)
    
    Returns:
        List of ASN objects within the date range
    """
    # Convert dates to datetime for proper comparison
    start_datetime = datetime.combine(start_date, datetime.min.time())
    end_datetime = datetime.combine(end_date, datetime.max.time())
    
    query = select(ASN).where(
        and_(
            ASN.expected_date >= start_datetime,
            ASN.expected_date <= end_datetime
        )
    ).order_by(ASN.expected_date.asc())
    
    result = await db.execute(query)
    return result.scalars().all()


async def get_asn_statistics(db: AsyncSession) -> dict:
    """
    Get statistics about ASNs
    
    Args:
        db: Database session
    
    Returns:
        Dictionary with statistics
    """
    # Get total count
    total_query = select(func.count()).select_from(ASN)
    total_result = await db.execute(total_query)
    total = total_result.scalar()
    
    # Get counts by status
    statuses = ['draft', 'in_transit', 'received', 'cancelled']
    status_counts = {}
    
    for status in statuses:
        count_query = select(func.count()).select_from(ASN).where(ASN.status == status)
        count_result = await db.execute(count_query)
        status_counts[status] = count_result.scalar() or 0
    
    # Get today's expected ASNs
    today = date.today()
    today_start = datetime.combine(today, datetime.min.time())
    today_end = datetime.combine(today, datetime.max.time())
    
    today_query = select(func.count()).select_from(ASN).where(
        and_(
            ASN.expected_date >= today_start,
            ASN.expected_date <= today_end
        )
    )
    today_result = await db.execute(today_query)
    today_count = today_result.scalar() or 0
    
    return {
        "total": total or 0,
        "by_status": status_counts,
        "expected_today": today_count
    }