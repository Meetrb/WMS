from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from typing import List, Optional, Tuple, Dict, Any
from uuid import UUID, uuid4
from datetime import datetime, date, time, timezone
from decimal import Decimal

from app.models.inbound import (
    InboundShipment, ASNShipment, ASNShipmentItem,
    ReceivingTask, ReceivingTaskItem, InspectionRecord,
    InspectionDetail, GRN, GRNItem
)
from app.models.item_master import ItemMaster
from app.models.supplier_master import SupplierMaster
from app.models.warehouse import Warehouse
from app.models.user import User

# Import ASN models with clear names
from app.models.asn import ASN as OriginalASN
from app.models.asn import Shipment as OriginalShipment
from app.models.asn import ShipmentItem as OriginalShipmentItem

from app.schemas.inbound import (
    InboundShipmentCreate, ArrivalConfirmationWithWarehouse,
    ReceivingTaskCreate, InspectionRecordCreate, GRNCreate,
    ArrivalConfirmation
)

from app.crud.item_master import get_item_by_sku, create_item, update_item, get_item_by_id
from app.crud.supplier_master import get_supplier_by_code, create_supplier
from app.crud.warehouse import get_warehouse_by_code
import logging
from app.services.hybrid_putaway_service import HybridPutawayService
import asyncio



# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def make_naive_datetime(dt: Optional[datetime]) -> Optional[datetime]:
    """Convert timezone-aware datetime to naive UTC datetime"""
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
) -> Tuple[Optional[SupplierMaster], bool]:
    """Get existing supplier master or create new one"""
    if not supplier_data or not supplier_data.get('code'):
        return None, False
    
    supplier = await get_supplier_by_code(db, supplier_data['code'])
    if supplier:
        return supplier, False
    
    from app.schemas.supplier_master import SupplierMasterCreate
    supplier_in = SupplierMasterCreate(
        code=supplier_data['code'],
        name=supplier_data.get('name', ''),
        gstin=supplier_data.get('gstin')
    )
    supplier = await create_supplier(db, supplier_in)
    return supplier, True


async def get_or_create_item_master_with_barcode(
    db: AsyncSession,
    item_data: dict
) -> Tuple[ItemMaster, bool, bool]:
    """
    Get existing item master or create new one
    Returns: (item_master, is_new, barcode_updated)
    """
    item = await get_item_by_sku(db, item_data['sku'])
    barcode_updated = False
    
    if item:
        # Check if we need to update barcode
        barcode = item_data.get('primary_barcode')
        if barcode and not item.primary_barcode:
            from app.schemas.item_master import ItemMasterUpdate
            update_data = ItemMasterUpdate(primary_barcode=barcode)
            item = await update_item(db, item.id, update_data)
            barcode_updated = True
        return item, False, barcode_updated
    
    # Create new item master with barcode
    from app.schemas.item_master import ItemMasterCreate
    item_in = ItemMasterCreate(
        sku_code=item_data['sku'],
        description=item_data['description'],
        base_uom=item_data['unit'],
        primary_barcode=item_data.get('primary_barcode'),
        hsn_code=item_data.get('hsn_code'),
        batch_required=True if item_data.get('lot_number') else False
    )
    item = await create_item(db, item_in)
    return item, True, False


# ============================================================================
# TODAY'S ARRIVED ASNS FUNCTIONS
# ============================================================================

# async def get_today_arrived_asns(
#     db: AsyncSession,
#     warehouse_code: Optional[str] = None,
#     include_grn_details: bool = True
# ) -> List[Dict[str, Any]]:
#     """
#     Get all ASNs that arrived today with complete details including:
#     - All shipment/PO information
#     - All item details with primary_barcode
#     - GRN information if exists
#     - Summary statistics
    
#     Args:
#         db: Database session
#         warehouse_code: Optional warehouse code to filter by
#         include_grn_details: Whether to include GRN details
    
#     Returns:
#         List of arrived ASNs with complete details
#     """
#     today = date.today()
#     today_start = datetime.combine(today, time.min)
#     today_end = datetime.combine(today, time.max)
    
#     # Get all inbound shipments that arrived today
#     inbound_query = select(InboundShipment).where(
#         and_(
#             InboundShipment.actual_arrival_date >= today_start,
#             InboundShipment.actual_arrival_date <= today_end
#         )
#     ).options(
#         # Load all related data eagerly to avoid N+1 queries
#         selectinload(InboundShipment.warehouse),
#         selectinload(InboundShipment.supplier),
#         selectinload(InboundShipment.asn_shipments)
#         .selectinload(ASNShipment.supplier),
#         selectinload(InboundShipment.asn_shipments)
#         .selectinload(ASNShipment.items)
#         .selectinload(ASNShipmentItem.item_master),
#         selectinload(InboundShipment.grns)
#         .selectinload(GRN.items)
#         .selectinload(GRNItem.asn_shipment_item)
#     ).order_by(InboundShipment.actual_arrival_date.desc())
    
#     # Filter by warehouse if specified
#     if warehouse_code:
#         warehouse_subquery = select(Warehouse.id).where(Warehouse.code == warehouse_code)
#         inbound_query = inbound_query.where(InboundShipment.warehouse_id.in_(warehouse_subquery))
    
#     inbound_result = await db.execute(inbound_query)
#     inbound_shipments = inbound_result.scalars().all()
    
#     result_list = []
    
#     for inbound in inbound_shipments:
#         # Get GRN information if exists
#         latest_grn = None
#         if inbound.grns and include_grn_details:
#             # Get the most recent GRN
#             latest_grn = sorted(inbound.grns, key=lambda x: x.created_at, reverse=True)[0] if inbound.grns else None
        
#         # Calculate summary statistics
#         total_items = 0
#         total_expected_qty = Decimal('0')
#         total_received_qty = Decimal('0')
#         total_accepted_qty = Decimal('0')
#         total_rejected_qty = Decimal('0')
        
#         # Build shipments data
#         shipments_data = []
        
#         for asn_shipment in inbound.asn_shipments:
#             shipment_items = []
            
#             for asn_item in asn_shipment.items:
#                 total_items += 1
#                 total_expected_qty += asn_item.expected_quantity or Decimal('0')
#                 total_received_qty += asn_item.received_quantity or Decimal('0')
#                 total_rejected_qty += asn_item.rejected_quantity or Decimal('0')
                
#                 # Get item master details with barcode
#                 item_master = asn_item.item_master
                
#                 # Get GRN item details if available
#                 received_qty = asn_item.received_quantity or Decimal('0')
#                 accepted_qty = received_qty - (asn_item.rejected_quantity or Decimal('0'))
#                 total_accepted_qty += accepted_qty
                
#                 # Check if this item is in any GRN
#                 grn_item = None
#                 batch_no = None
#                 if latest_grn:
#                     for gi in latest_grn.items:
#                         if gi.asn_shipment_item_id == asn_item.id:
#                             grn_item = gi
#                             batch_no = gi.batch_no
#                             break
                
#                 shipment_items.append({
#                     "sku": item_master.sku_code if item_master else None,
#                     "description": item_master.description if item_master else "",
#                     "primary_barcode": item_master.primary_barcode if item_master else None,
#                     "expected_quantity": asn_item.expected_quantity or Decimal('0'),
#                     "received_quantity": asn_item.received_quantity or Decimal('0'),
#                     "accepted_quantity": accepted_qty,
#                     "rejected_quantity": asn_item.rejected_quantity or Decimal('0'),
#                     "unit": asn_item.unit,
#                     "lot_number": asn_item.lot_number,
#                     "expiry_date": asn_item.expiry_date,
#                     "batch_no": batch_no,
#                     "hsn_code": item_master.hsn_code if item_master else None,
#                     "item_master_id": item_master.id if item_master else None
#                 })
            
#             # Get supplier details for this shipment
#             supplier = asn_shipment.supplier
            
#             shipments_data.append({
#                 "po_number": asn_shipment.po_number,
#                 "supplier_code": supplier.code if supplier else None,
#                 "supplier_name": supplier.name if supplier else None,
#                 "items": shipment_items
#             })
        
#         # Build the complete response
#         result_list.append({
#             # ASN Header Information
#             "asn_number": inbound.asn_number,
#             "asn_date": inbound.asn_date,
#             "expected_arrival_date": inbound.expected_arrival_date,
#             "actual_arrival_date": inbound.actual_arrival_date,
#             "shipment_id": inbound.shipment_id,
#             "status": inbound.status,
#             "inbound_shipment_id": inbound.id,
            
#             # Warehouse Information
#             "warehouse_code": inbound.warehouse.code if inbound.warehouse else None,
#             "warehouse_name": inbound.warehouse.name if inbound.warehouse else None,
#             "receiving_dock": inbound.receiving_dock,
            
#             # Supplier Information
#             "supplier_code": inbound.supplier.code if inbound.supplier else None,
#             "supplier_name": inbound.supplier.name if inbound.supplier else None,
#             "supplier_gst": inbound.supplier.gstin if inbound.supplier else None,
            
#             # Driver Information
#             "driver_name": inbound.driver_name,
#             "driver_phone": inbound.driver_phone,
#             "vehicle_number": inbound.vehicle_number,
            
#             # GRN Information
#             "grn_number": latest_grn.grn_number if latest_grn else None,
#             "grn_id": latest_grn.id if latest_grn else None,
#             "grn_status": latest_grn.status if latest_grn else None,
            
#             # Summary Statistics
#             "total_items": total_items,
#             "total_expected_quantity": total_expected_qty,
#             "total_received_quantity": total_received_qty,
#             "total_accepted_quantity": total_accepted_qty,
#             "total_rejected_quantity": total_rejected_qty,
            
#             # Shipments with Items
#             "shipments": shipments_data
#         })
    
#     return result_list
async def get_today_arrived_asns(
    db: AsyncSession,
    warehouse_code: Optional[str] = None,
    include_grn_details: bool = True
) -> List[Dict[str, Any]]:
    """
    Get all ASNs that arrived today with complete details including:
    - All shipment/PO information
    - All item details with primary_barcode
    - GRN information if exists
    - Summary statistics
    """
    logger.info("="*80)
    logger.info("GET_TODAY_ARRIVED_ASNS FUNCTION CALLED")
    logger.info("="*80)
    
    # Get today's date range
    today = date.today()
    today_start = datetime.combine(today, time.min)
    today_end = datetime.combine(today, time.max)
    
    logger.info(f"Today's date: {today}")
    logger.info(f"Today start: {today_start}")
    logger.info(f"Today end: {today_end}")
    
    # Build query for inbound shipments that arrived today
    logger.info("-"*40)
    logger.info("STEP 1: Querying inbound_shipments table")
    logger.info(f"Filter: actual_arrival_date between {today_start} and {today_end}")
    
    inbound_query = select(InboundShipment).where(
        and_(
            InboundShipment.actual_arrival_date >= today_start,
            InboundShipment.actual_arrival_date <= today_end
        )
    ).options(
        selectinload(InboundShipment.warehouse),
        selectinload(InboundShipment.supplier),
        selectinload(InboundShipment.asn_shipments)
        .selectinload(ASNShipment.supplier),
        selectinload(InboundShipment.asn_shipments)
        .selectinload(ASNShipment.items)
        .selectinload(ASNShipmentItem.item_master),
        selectinload(InboundShipment.grns)
        .selectinload(GRN.items)
        .selectinload(GRNItem.asn_shipment_item)
    ).order_by(InboundShipment.actual_arrival_date.desc())
    
    # Filter by warehouse if specified
    if warehouse_code:
        logger.info(f"Filtering by warehouse_code: {warehouse_code}")
        warehouse_subquery = select(Warehouse.id).where(Warehouse.code == warehouse_code)
        inbound_query = inbound_query.where(InboundShipment.warehouse_id.in_(warehouse_subquery))
    
    # Execute query
    logger.info("Executing inbound query...")
    inbound_result = await db.execute(inbound_query)
    inbound_shipments = inbound_result.scalars().all()
    
    logger.info(f"Query returned {len(inbound_shipments)} inbound shipments")
    
    # Log each inbound shipment found
    for idx, inbound in enumerate(inbound_shipments):
        logger.info(f"  Inbound #{idx+1}:")
        logger.info(f"    ID: {inbound.id}")
        logger.info(f"    ASN Number: {inbound.asn_number}")
        logger.info(f"    Actual Arrival: {inbound.actual_arrival_date}")
        logger.info(f"    Status: {inbound.status}")
        logger.info(f"    Warehouse ID: {inbound.warehouse_id}")
    
    if not inbound_shipments:
        logger.warning("NO INBOUND SHIPMENTS FOUND FOR TODAY!")
        logger.info("="*80)
        return []
    
    result_list = []
    
    for inbound in inbound_shipments:
        logger.info("-"*40)
        logger.info(f"STEP 2: Processing inbound shipment {inbound.asn_number}")
        
        # Get GRN information if exists
        latest_grn = None
        if inbound.grns and include_grn_details:
            latest_grn = sorted(inbound.grns, key=lambda x: x.grn_date, reverse=True)[0] if inbound.grns else None
            logger.info(f"  Found GRN: {latest_grn.grn_number if latest_grn else 'None'}")
        
        # Calculate summary statistics
        total_items = 0
        total_expected_qty = Decimal('0')
        total_received_qty = Decimal('0')
        total_accepted_qty = Decimal('0')
        total_rejected_qty = Decimal('0')
        
        # Build shipments data
        shipments_data = []
        
        logger.info(f"  Processing {len(inbound.asn_shipments)} ASN shipments...")
        
        for asn_shipment in inbound.asn_shipments:
            logger.info(f"    Shipment PO: {asn_shipment.po_number}")
            shipment_items = []
            
            for asn_item in asn_shipment.items:
                total_items += 1
                total_expected_qty += asn_item.expected_quantity or Decimal('0')
                total_received_qty += asn_item.received_quantity or Decimal('0')
                total_rejected_qty += asn_item.rejected_quantity or Decimal('0')
                
                # Get item master details with barcode
                item_master = asn_item.item_master
                
                if item_master:
                    logger.info(f"      Item: {item_master.sku_code} - Barcode: {item_master.primary_barcode}")
                else:
                    logger.warning(f"      WARNING: No item_master found for item ID {asn_item.id}")
                
                # Get GRN item details if available
                received_qty = asn_item.received_quantity or Decimal('0')
                accepted_qty = received_qty - (asn_item.rejected_quantity or Decimal('0'))
                total_accepted_qty += accepted_qty
                
                # Check if this item is in any GRN
                grn_item = None
                batch_no = None
                if latest_grn:
                    for gi in latest_grn.items:
                        if gi.asn_shipment_item_id == asn_item.id:
                            grn_item = gi
                            # SAFELY check if batch_no attribute exists
                            if hasattr(gi, 'batch_no'):
                                batch_no = gi.batch_no
                                logger.info(f"      Found in GRN with batch: {batch_no}")
                            else:
                                logger.info(f"      Found in GRN (no batch_no field)")
                            break
                
                shipment_items.append({
                    "asn_shipment_item_id": asn_item.id,
                    "sku": item_master.sku_code if item_master else None,
                    "description": item_master.description if item_master else "",
                    "primary_barcode": item_master.primary_barcode if item_master else None,
                    "expected_quantity": asn_item.expected_quantity or Decimal('0'),
                    "received_quantity": asn_item.received_quantity or Decimal('0'),
                    "accepted_quantity": accepted_qty,
                    "rejected_quantity": asn_item.rejected_quantity or Decimal('0'),
                    "unit": asn_item.unit,
                    "lot_number": asn_item.lot_number,
                    "expiry_date": asn_item.expiry_date,
                    "batch_no": batch_no,
                    "hsn_code": item_master.hsn_code if item_master else None,
                    "item_master_id": item_master.id if item_master else None
                })
            
            # Get supplier details for this shipment
            supplier = asn_shipment.supplier
            
            shipments_data.append({
                "po_number": asn_shipment.po_number,
                "supplier_code": supplier.code if supplier else None,
                "supplier_name": supplier.name if supplier else None,
                "items": shipment_items
            })
        
        logger.info(f"  Summary - Items: {total_items}, Expected Qty: {total_expected_qty}, Received: {total_received_qty}")
        
        # Build the complete response
        result_item = {
            "asn_number": inbound.asn_number,
            "asn_date": inbound.asn_date,
            "expected_arrival_date": inbound.expected_arrival_date,
            "actual_arrival_date": inbound.actual_arrival_date,
            "shipment_id": inbound.shipment_id,
            "status": inbound.status,
            "inbound_shipment_id": inbound.id,
            
            # Warehouse Information
            "warehouse_code": inbound.warehouse.code if inbound.warehouse else None,
            "warehouse_name": inbound.warehouse.name if inbound.warehouse else None,
            "receiving_dock": inbound.receiving_dock,
            
            # Supplier Information
            "supplier_code": inbound.supplier.code if inbound.supplier else None,
            "supplier_name": inbound.supplier.name if inbound.supplier else None,
            "supplier_gst": inbound.supplier.gstin if inbound.supplier else None,
            
            # Driver Information
            "driver_name": inbound.driver_name,
            "driver_phone": inbound.driver_phone,
            "vehicle_number": inbound.vehicle_number,
            
            # GRN Information
            "grn_number": latest_grn.grn_number if latest_grn else None,
            "grn_id": latest_grn.id if latest_grn else None,
            "grn_status": latest_grn.status if latest_grn else None,
            
            # Summary Statistics
            "total_items": total_items,
            "total_expected_quantity": total_expected_qty,
            "total_received_quantity": total_received_qty,
            "total_accepted_quantity": total_accepted_qty,
            "total_rejected_quantity": total_rejected_qty,
            
            # Shipments with Items
            "shipments": shipments_data
        }
        
        result_list.append(result_item)
        logger.info(f"✓ Added {inbound.asn_number} to results")
    
    logger.info("="*80)
    logger.info(f"FINAL RESULT: Returning {len(result_list)} arrived ASNs")
    logger.info("="*80)
    
    return result_list



async def get_today_arrived_summary(
    db: AsyncSession,
    warehouse_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get summary of today's arrived ASNs
    
    Args:
        db: Database session
        warehouse_code: Optional warehouse code to filter by
    
    Returns:
        Summary dictionary with counts and statistics
    """
    arrived_asns = await get_today_arrived_asns(
        db=db,
        warehouse_code=warehouse_code,
        include_grn_details=True
    )
    
    # Calculate totals
    total_expected_qty = sum(a["total_expected_quantity"] for a in arrived_asns)
    total_received_qty = sum(a["total_received_quantity"] for a in arrived_asns)
    total_accepted_qty = sum(a["total_accepted_quantity"] for a in arrived_asns)
    total_rejected_qty = sum(a["total_rejected_quantity"] for a in arrived_asns)
    
    # Count ASNs with GRN
    with_grn = [a for a in arrived_asns if a["grn_id"] is not None]
    pending_grn = [a for a in arrived_asns if a["grn_id"] is None]
    
    return {
        "date": date.today().isoformat(),
        "total_arrived": len(arrived_asns),
        "total_with_grn": len(with_grn),
        "total_pending_grn": len(pending_grn),
        "total_expected_quantity": total_expected_qty,
        "total_received_quantity": total_received_qty,
        "total_accepted_quantity": total_accepted_qty,
        "total_rejected_quantity": total_rejected_qty,
        "arrived_asns": arrived_asns
    }


# ============================================================================
# INBOUND SHIPMENT CREATION FUNCTIONS
# ============================================================================

async def create_inbound_from_existing_asn(
    db: AsyncSession,
    asn_number: str,
    warehouse_code: str,
    arrival_data: Optional[ArrivalConfirmationWithWarehouse] = None,
    created_by: str = "system"
) -> Tuple[InboundShipment, Dict[str, Any]]:
    """
    Create inbound shipment from an existing ASN in the asns table
    """
    # First, check if inbound shipment already exists for this ASN
    existing_inbound = await get_inbound_shipment_by_asn(db, asn_number)
    if existing_inbound:
        return existing_inbound, {
            'new_suppliers': [],
            'new_items': [],
            'updated_items': [],
            'warnings': [f"Inbound shipment for ASN {asn_number} already exists with ID {existing_inbound.id}"]
        }
    
    # Get the existing ASN from asns table with all relationships loaded
    result = await db.execute(
        select(OriginalASN)
        .where(OriginalASN.asn_number == asn_number)
        .options(
            selectinload(OriginalASN.shipments)
            .selectinload(OriginalShipment.items)
            .selectinload(OriginalShipmentItem.item_master),
            selectinload(OriginalASN.supplier)  # Load ASN supplier
        )
    )
    existing_asn = result.scalar_one_or_none()
    
    if not existing_asn:
        raise ValueError(f"ASN with number {asn_number} not found in asns table")
    
    # Get warehouse
    warehouse = await get_warehouse_by_code(db, warehouse_code)
    if not warehouse:
        raise ValueError(f"Warehouse with code {warehouse_code} not found")
    
    result_info = {
        'new_suppliers': [],
        'new_items': [],
        'updated_items': [],
        'warnings': []
    }
    
    # DEBUG: Print the arrival data
    print(f"ARRIVAL DATA RECEIVED: {arrival_data}")
    if arrival_data:
        print(f"actual_arrival_date from request: {arrival_data.actual_arrival_date}")
    
    # Handle datetime timezone issues
    expected_arrival = existing_asn.expected_date
    if expected_arrival and expected_arrival.tzinfo is not None:
        expected_arrival = expected_arrival.replace(tzinfo=None)
    
    # IMPORTANT: Use the date from arrival_data, not from existing_asn
    actual_arrival = None
    if arrival_data and arrival_data.actual_arrival_date:
        actual_arrival = arrival_data.actual_arrival_date
        print(f"Using actual_arrival_date from request: {actual_arrival}")
        if actual_arrival.tzinfo is not None:
            actual_arrival = actual_arrival.replace(tzinfo=None)
            print(f"After tz conversion: {actual_arrival}")
    else:
        print("WARNING: No actual_arrival_date in request! Using current time.")
        actual_arrival = datetime.utcnow()
    
    # Get supplier from ASN if exists
    supplier_id = None
    if existing_asn.supplier_id:
        supplier_id = existing_asn.supplier_id
    
    # Create inbound shipment from existing ASN data
    db_inbound = InboundShipment(
        asn_number=existing_asn.asn_number,
        asn_date=existing_asn.asn_date.replace(tzinfo=None) if existing_asn.asn_date and existing_asn.asn_date.tzinfo else existing_asn.asn_date,
        expected_arrival_date=expected_arrival or datetime.utcnow(),
        actual_arrival_date=actual_arrival,  # This now uses the date from request
        shipment_id=existing_asn.shipment_id,
        warehouse_id=warehouse.id,
        supplier_id=supplier_id,
        driver_name=arrival_data.driver_name if arrival_data else None,
        driver_phone=arrival_data.driver_phone if arrival_data else None,
        vehicle_number=arrival_data.vehicle_number if arrival_data else None,
        receiving_dock=arrival_data.receiving_dock if arrival_data else None,
        notes=arrival_data.notes if arrival_data else existing_asn.notes,
        status='ARRIVED' if arrival_data else 'PENDING',
        created_by=created_by
    )
    
    db.add(db_inbound)
    await db.flush()
    print(f"Created inbound shipment with ID: {db_inbound.id}")
    print(f"Actual arrival date set to: {db_inbound.actual_arrival_date}")
    
    # Copy shipments and items from existing ASN
    for shipment in existing_asn.shipments:
        # Get supplier for this shipment if exists
        shipment_supplier_id = None
        if shipment.supplier_id:
            shipment_supplier_id = shipment.supplier_id
            
        db_asn_shipment = ASNShipment(
            inbound_shipment_id=db_inbound.id,
            po_number=shipment.po_number,
            supplier_id=shipment_supplier_id
        )
        db.add(db_asn_shipment)
        await db.flush()
        
        for item in shipment.items:
            # Get SKU from item_master
            sku = None
            description = ''
            unit = item.unit if hasattr(item, 'unit') else 'EA'
            
            # Get item master details
            item_master_obj = None
            if item.item_master:
                item_master_obj = item.item_master
                sku = item_master_obj.sku_code
                description = item_master_obj.description
            else:
                # Try to get item_master if not loaded
                item_master_obj = await get_item_by_id(db, item.item_master_id)
                if item_master_obj:
                    sku = item_master_obj.sku_code
                    description = item_master_obj.description
            
            if not sku:
                sku = f"UNKNOWN-{item.id}"
                description = "Unknown Item"
            
            item_dict = {
                'sku': sku,
                'description': description,
                'unit': unit,
                'primary_barcode': item_master_obj.primary_barcode if item_master_obj else None,
                'hsn_code': item_master_obj.hsn_code if item_master_obj else None,
                'lot_number': item.lot if hasattr(item, 'lot') else None
            }
            
            # Check if item master exists
            existing_item_master = await get_item_by_sku(db, sku)
            if existing_item_master:
                final_item_master = existing_item_master
            else:
                # Create new item master
                from app.schemas.item_master import ItemMasterCreate
                item_in = ItemMasterCreate(
                    sku_code=item_dict['sku'],
                    description=item_dict['description'],
                    base_uom=item_dict['unit'],
                    primary_barcode=item_dict['primary_barcode'],
                    hsn_code=item_dict['hsn_code'],
                    batch_required=True if item_dict['lot_number'] else False
                )
                final_item_master = await create_item(db, item_in)
                result_info['new_items'].append(item_dict['sku'])
            
            # Handle expiry date timezone
            expiry_date = None
            if hasattr(item, 'expiry_date') and item.expiry_date:
                expiry_date = item.expiry_date
                if hasattr(expiry_date, 'tzinfo') and expiry_date.tzinfo is not None:
                    expiry_date = expiry_date.replace(tzinfo=None)
            
            db_item = ASNShipmentItem(
                asn_shipment_id=db_asn_shipment.id,
                item_master_id=final_item_master.id,
                expected_quantity=item.quantity if hasattr(item, 'quantity') else 0,
                unit=unit,
                unit_price=item.unit_price if hasattr(item, 'unit_price') else None,
                total_price=item.total_price if hasattr(item, 'total_price') else None,
                lot_number=item.lot if hasattr(item, 'lot') else None,
                expiry_date=expiry_date,
                manufacturing_date=None
            )
            db.add(db_item)
    
    await db.commit()
    print(f"Successfully committed inbound shipment with date: {actual_arrival}")
    
    # Return the inbound shipment with ALL relationships loaded
    return await get_inbound_shipment_by_id(db, db_inbound.id), result_info



async def create_inbound_shipment_from_asn(
    db: AsyncSession,
    asn_data: InboundShipmentCreate,
    created_by: str
) -> Tuple[InboundShipment, Dict[str, Any]]:
    """
    Create inbound shipment when ASN arrives at warehouse
    This version checks for existing inbound records first
    """
    # Check if inbound shipment already exists for this ASN
    existing = await get_inbound_shipment_by_asn(db, asn_data.asn_number)
    if existing:
        # Return existing inbound shipment with warning
        return existing, {
            'new_suppliers': [],
            'new_items': [],
            'updated_items': [],
            'warnings': [f"ASN {asn_data.asn_number} already processed as inbound shipment {existing.id}"]
        }
    
    # Check if ASN exists in original asns table
    result = await db.execute(
        select(OriginalASN).where(OriginalASN.asn_number == asn_data.asn_number)
    )
    existing_asn = result.scalar_one_or_none()
    
    if existing_asn:
        # Use existing ASN data
        return await create_inbound_from_existing_asn(
            db=db,
            asn_number=asn_data.asn_number,
            warehouse_code=asn_data.warehouse_code,
            arrival_data=ArrivalConfirmation(
                actual_arrival_date=datetime.utcnow(),
                driver_name=asn_data.driver_name,
                driver_phone=asn_data.driver_phone,
                vehicle_number=asn_data.vehicle_number,
                receiving_dock=asn_data.receiving_dock,
                notes=asn_data.notes
            ),
            created_by=created_by
        )
    
    # If no existing ASN, create new one (original behavior)
    asn_dict = asn_data.dict(by_alias=True)
    
    result_info = {
        'new_suppliers': [],
        'new_items': [],
        'updated_items': [],
        'warnings': []
    }
    
    # Get warehouse
    warehouse_code = asn_dict.get('warehouse_code')
    if not warehouse_code:
        raise ValueError(f"Warehouse code not found in payload")
    
    warehouse = await get_warehouse_by_code(db, warehouse_code)
    if not warehouse:
        raise ValueError(f"Warehouse with code {warehouse_code} not found")
    
    # Get or create supplier
    supplier = None
    supplier_code = asn_dict.get('supplier_code')
    if supplier_code:
        supplier_data = {'code': supplier_code}
        supplier, is_new = await get_or_create_supplier_master(db, supplier_data)
        if is_new:
            result_info['new_suppliers'].append(supplier_code)
    
    # Create inbound shipment
    db_inbound = InboundShipment(
        asn_number=asn_dict['asn_number'],
        asn_date=asn_dict['asn_date'],
        expected_arrival_date=asn_dict['expected_arrival_date'],
        shipment_id=asn_dict['shipment_id'],
        warehouse_id=warehouse.id,
        supplier_id=supplier.id if supplier else None,
        driver_name=asn_dict.get('driver_name'),
        driver_phone=asn_dict.get('driver_phone'),
        vehicle_number=asn_dict.get('vehicle_number'),
        receiving_dock=asn_dict.get('receiving_dock'),
        notes=asn_dict.get('notes'),
        status='PENDING',
        created_by=created_by
    )
    
    db.add(db_inbound)
    await db.flush()
    
    # Create ASN shipments (POs)
    for shipment_data in asn_dict.get('shipments', []):
        shipment_supplier = supplier
        ship_supplier_code = shipment_data.get('supplier_code')
        
        if ship_supplier_code and ship_supplier_code != supplier_code:
            supplier_data = {'code': ship_supplier_code}
            shipment_supplier, is_new = await get_or_create_supplier_master(db, supplier_data)
            if is_new:
                result_info['new_suppliers'].append(ship_supplier_code)
        
        db_asn_shipment = ASNShipment(
            inbound_shipment_id=db_inbound.id,
            po_number=shipment_data['po_number'],
            supplier_id=shipment_supplier.id if shipment_supplier else None
        )
        db.add(db_asn_shipment)
        await db.flush()
        
        for item_data in shipment_data.get('items', []):
            item_master, is_new_item, barcode_updated = await get_or_create_item_master_with_barcode(db, item_data)
            
            if is_new_item:
                result_info['new_items'].append(item_data['sku'])
            if barcode_updated:
                result_info['updated_items'].append({
                    'sku': item_data['sku'],
                    'barcode': item_data.get('primary_barcode')
                })
            
            db_item = ASNShipmentItem(
                asn_shipment_id=db_asn_shipment.id,
                item_master_id=item_master.id,
                expected_quantity=item_data['expected_quantity'],
                unit=item_data['unit'],
                unit_price=item_data.get('unit_price'),
                total_price=item_data.get('total_price'),
                lot_number=item_data.get('lot_number'),
                expiry_date=item_data.get('expiry_date'),
                manufacturing_date=item_data.get('manufacturing_date')
            )
            db.add(db_item)
    
    await db.commit()
    
    return await get_inbound_shipment_by_id(db, db_inbound.id), result_info


async def confirm_shipment_arrival(
    db: AsyncSession,
    inbound_shipment_id: UUID,
    arrival_data: ArrivalConfirmation,
    updated_by: str
) -> Optional[InboundShipment]:
    """Confirm that the shipment has arrived at warehouse"""
    inbound = await get_inbound_shipment_by_id(db, inbound_shipment_id)
    if not inbound:
        return None
    
    inbound.actual_arrival_date = arrival_data.actual_arrival_date
    inbound.receiving_dock = arrival_data.receiving_dock or inbound.receiving_dock
    inbound.driver_name = arrival_data.driver_name or inbound.driver_name
    inbound.driver_phone = arrival_data.driver_phone or inbound.driver_phone
    inbound.vehicle_number = arrival_data.vehicle_number or inbound.vehicle_number
    inbound.notes = arrival_data.notes or inbound.notes
    inbound.status = 'ARRIVED'
    inbound.updated_by = updated_by
    inbound.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(inbound)
    return inbound


# ============================================================================
# RECEIVING TASKS FUNCTIONS
# ============================================================================

async def create_receiving_task(
    db: AsyncSession,
    task_data: ReceivingTaskCreate,
    created_by: str
) -> ReceivingTask:
    """Create a task for receiving/offloading"""
    task_count = await db.execute(select(func.count()).select_from(ReceivingTask))
    count = task_count.scalar() or 0
    task_number = f"RCT-{datetime.now().strftime('%Y%m%d')}-{count+1:04d}"
    
    db_task = ReceivingTask(
        task_number=task_number,
        inbound_shipment_id=task_data.inbound_shipment_id,
        assigned_to_id=task_data.assigned_to_id,
        status='PENDING'
    )
    db.add(db_task)
    await db.flush()
    
    for item_data in task_data.items:
        db_task_item = ReceivingTaskItem(
            receiving_task_id=db_task.id,
            asn_shipment_item_id=item_data.asn_shipment_item_id,
            received_quantity=item_data.received_quantity,
            rejected_quantity=item_data.rejected_quantity,
            rejection_reason=item_data.rejection_reason
        )
        db.add(db_task_item)
        
        asn_item = await db.get(ASNShipmentItem, item_data.asn_shipment_item_id)
        if asn_item:
            asn_item.received_quantity += item_data.received_quantity
            asn_item.rejected_quantity += item_data.rejected_quantity
            if asn_item.received_quantity >= asn_item.expected_quantity:
                asn_item.is_fully_received = True
    
    await db.commit()
    return await get_receiving_task_by_id(db, db_task.id)


async def start_receiving_task(
    db: AsyncSession,
    task_id: UUID,
    user_id: UUID
) -> Optional[ReceivingTask]:
    """Start a receiving task"""
    task = await get_receiving_task_by_id(db, task_id)
    if not task:
        return None
    
    task.status = 'IN_PROGRESS'
    task.started_at = datetime.utcnow()
    task.assigned_to_id = user_id
    
    await db.commit()
    await db.refresh(task)
    return task


async def complete_receiving_task(
    db: AsyncSession,
    task_id: UUID
) -> Optional[ReceivingTask]:
    """Complete a receiving task"""
    task = await get_receiving_task_by_id(db, task_id)
    if not task:
        return None
    
    task.status = 'COMPLETED'
    task.completed_at = datetime.utcnow()
    
    inbound = await get_inbound_shipment_by_id(db, task.inbound_shipment_id)
    if inbound:
        all_received = all(
            item.received_quantity >= item.expected_quantity
            for shipment in inbound.shipments
            for item in shipment.items
        )
        if all_received:
            inbound.status = 'RECEIVING'
    
    await db.commit()
    await db.refresh(task)
    return task


# ============================================================================
# INSPECTION FUNCTIONS
# ============================================================================

async def create_inspection_record(
    db: AsyncSession,
    inspection_data: InspectionRecordCreate,
    inspector_id: UUID
) -> InspectionRecord:
    """Create quality inspection record"""
    db_inspection = InspectionRecord(
        inbound_shipment_id=inspection_data.inbound_shipment_id,
        inspection_type=inspection_data.inspection_type,
        inspector_id=inspector_id,
        status='PENDING'
    )
    db.add(db_inspection)
    await db.flush()
    
    all_passed = True
    for detail_data in inspection_data.details:
        db_detail = InspectionDetail(
            inspection_id=db_inspection.id,
            asn_shipment_item_id=detail_data.asn_shipment_item_id,
            inspected_quantity=detail_data.inspected_quantity,
            passed_quantity=detail_data.passed_quantity,
            rejected_quantity=detail_data.rejected_quantity,
            rejection_reason=detail_data.rejection_reason
        )
        db.add(db_detail)
        
        if detail_data.rejected_quantity > 0:
            all_passed = False
    
    db_inspection.status = 'PASSED' if all_passed else 'PARTIAL_PASS'
    await db.commit()
    return await get_inspection_by_id(db, db_inspection.id)


# ============================================================================
# GRN FUNCTIONS
# ============================================================================


async def create_grn(
    db: AsyncSession,
    grn_data: GRNCreate,
    created_by_id: UUID
) -> Tuple[GRN, List[Any], List[str]]:
    """
    Create Goods Received Note AND automatically generate putaway tasks.
    
    Returns: (grn, putaway_tasks, warnings)
    """
    logger.info("=" * 80)
    logger.info("📝 CREATE GRN - START")
    logger.info("=" * 80)
    logger.info(f"  Inbound Shipment ID: {grn_data.inbound_shipment_id}")
    logger.info(f"  Created By ID: {created_by_id}")
    logger.info(f"  Number of GRN items: {len(grn_data.items)}")
    
    # Step 1: Generate GRN number
    grn_count = await db.execute(select(func.count()).select_from(GRN))
    count = grn_count.scalar() or 0
    grn_number = f"GRN-{datetime.now().strftime('%Y%m%d')}-{count+1:04d}"
    logger.info(f"  Generated GRN Number: {grn_number}")
    
    # Step 2: Create GRN record
    db_grn = GRN(
        grn_number=grn_number,
        inbound_shipment_id=grn_data.inbound_shipment_id,
        created_by_id=created_by_id,
        status='POSTED',  # Directly POSTED since we generate tasks immediately
        putaway_tasks_generated=False
    )
    db.add(db_grn)
    await db.flush()
    logger.info(f"  ✅ GRN record created: {db_grn.id}")
    
    # Step 3: Create GRN items
    for idx, item_data in enumerate(grn_data.items):
        db_grn_item = GRNItem(
            grn_id=db_grn.id,
            asn_shipment_item_id=item_data.asn_shipment_item_id,
            received_quantity=item_data.received_quantity,
            accepted_quantity=item_data.accepted_quantity,
            rejected_quantity=item_data.rejected_quantity
        )
        db.add(db_grn_item)
        logger.info(f"    Item {idx+1}: asn_item={item_data.asn_shipment_item_id}, "
                     f"received={item_data.received_quantity}, "
                     f"accepted={item_data.accepted_quantity}, "
                     f"rejected={item_data.rejected_quantity}")
    
    # Step 4: Update inbound shipment status to COMPLETED
    inbound = await get_inbound_shipment_by_id(db, grn_data.inbound_shipment_id)
    if inbound:
        inbound.status = 'COMPLETED'
        logger.info(f"  ✅ Inbound shipment {inbound.asn_number} status → COMPLETED")
    else:
        logger.warning(f"  ⚠️ Inbound shipment {grn_data.inbound_shipment_id} not found!")
    
    await db.commit()
    await db.refresh(db_grn)
    logger.info(f"  ✅ GRN committed to database")
    
    # Step 5: AUTO-GENERATE PUTAWAY TASKS
    putaway_tasks = []
    putaway_warnings = []
    
    logger.info("-" * 80)
    logger.info("🎯 PUTAWAY TASK GENERATION - START")
    logger.info("-" * 80)
    
    try:
        service = HybridPutawayService()
        logger.info(f"  Calling generate_tasks_from_grn(grn_id={db_grn.id})")
        
        putaway_tasks, putaway_warnings = await service.generate_tasks_from_grn(db, db_grn.id)
        
        logger.info(f"  ✅ Putaway service returned:")
        logger.info(f"     Tasks generated: {len(putaway_tasks)}")
        logger.info(f"     Warnings: {len(putaway_warnings)}")
        
        # Log each generated task
        for i, task in enumerate(putaway_tasks):
            logger.info(f"     Task {i+1}:")
            logger.info(f"       Task Number: {task.task_number}")
            logger.info(f"       Item SKU: {task.item_sku}")
            logger.info(f"       Item Description: {task.item_description}")
            logger.info(f"       Quantity to Put: {task.quantity_to_put}")
            logger.info(f"       Source Location: {task.source_location}")
            logger.info(f"       Suggested Bin ID: {task.suggested_bin_id}")
            logger.info(f"       Priority: {task.priority}")
            logger.info(f"       Status: {task.status}")
            if task.task_data:
                logger.info(f"       Strategy: {task.task_data.get('strategy', 'N/A')}")
                logger.info(f"       Reason: {task.task_data.get('reason', 'N/A')}")
                logger.info(f"       Items Count: {task.task_data.get('items_count', 'N/A')}")
        
        # Log warnings
        for w in putaway_warnings:
            logger.warning(f"     ⚠️ Warning: {w}")
        
        # Update GRN with generation info
        db_grn.putaway_tasks_generated = True
        db_grn.putaway_tasks_generated_at = datetime.utcnow()
        await db.commit()
        
        logger.info(f"  ✅ GRN updated: putaway_tasks_generated=True")
        
    except Exception as e:
        logger.error(f"  ❌ ERROR generating putaway tasks: {str(e)}")
        logger.exception("  Full traceback:")
        putaway_warnings.append(f"Error generating putaway tasks: {str(e)}")
    
    logger.info("=" * 80)
    logger.info(f"📝 CREATE GRN - COMPLETE")
    logger.info(f"   GRN: {grn_number} (ID: {db_grn.id})")
    logger.info(f"   Status: {db_grn.status}")
    logger.info(f"   Putaway Tasks: {len(putaway_tasks)}")
    logger.info(f"   Warnings: {len(putaway_warnings)}")
    logger.info("=" * 80)
    
    return db_grn, putaway_tasks, putaway_warnings



# async def create_grn(
#     db: AsyncSession,
#     grn_data: GRNCreate,
#     created_by_id: UUID
# ) -> GRN:
#     """Create Goods Received Note"""
#     grn_count = await db.execute(select(func.count()).select_from(GRN))
#     count = grn_count.scalar() or 0
#     grn_number = f"GRN-{datetime.now().strftime('%Y%m%d')}-{count+1:04d}"
    
#     db_grn = GRN(
#         grn_number=grn_number,
#         inbound_shipment_id=grn_data.inbound_shipment_id,
#         created_by_id=created_by_id,
#         status='DRAFT'
#     )
#     db.add(db_grn)
#     await db.flush()
    
#     for item_data in grn_data.items:
#         db_grn_item = GRNItem(
#             grn_id=db_grn.id,
#             asn_shipment_item_id=item_data.asn_shipment_item_id,
#             received_quantity=item_data.received_quantity,
#             accepted_quantity=item_data.accepted_quantity,
#             rejected_quantity=item_data.rejected_quantity
#         )
#         db.add(db_grn_item)
    
#     await db.commit()
#     return await get_grn_by_id(db, db_grn.id)



async def post_grn(
    db: AsyncSession,
    grn_id: UUID
) -> Optional[GRN]:
    """
    Post GRN - finalize the receiving process and trigger putaway tasks.
    
    NOTE: If create_grn already generated putaway tasks (putaway_tasks_generated=True),
    this function will NOT re-generate them. It will only update status if needed.
    """
    logger.info("=" * 80)
    logger.info(f"📝 POST GRN CALLED: {grn_id}")
    logger.info("=" * 80)
    
    grn = await get_grn_by_id(db, grn_id)
    if not grn:
        logger.error(f"❌ GRN {grn_id} not found")
        return None
    
    logger.info(f"  GRN Number: {grn.grn_number}")
    logger.info(f"  Current Status: {grn.status}")
    logger.info(f"  Putaway Already Generated: {grn.putaway_tasks_generated}")
    
    # If GRN is already POSTED and putaway tasks already generated, skip
    if grn.status == 'POSTED' and grn.putaway_tasks_generated:
        logger.info(f"  ℹ️ GRN {grn.grn_number} is already POSTED with putaway tasks generated.")
        logger.info(f"     No action needed. Returning existing GRN.")
        return grn
    
    # Update GRN status if not already POSTED
    if grn.status != 'POSTED':
        grn.status = 'POSTED'
        logger.info(f"  ✅ GRN status updated to POSTED")
    
    # Update inbound shipment status
    inbound = await get_inbound_shipment_by_id(db, grn.inbound_shipment_id)
    if inbound and inbound.status != 'COMPLETED':
        inbound.status = 'COMPLETED'
        logger.info(f"  ✅ Inbound shipment {inbound.asn_number} status updated to COMPLETED")
    
    await db.commit()
    await db.refresh(grn)
    
    # Only generate putaway tasks if they haven't been generated yet
    if not grn.putaway_tasks_generated:
        logger.info(f"  🎯 Putaway tasks not yet generated — generating now...")
        try:
            from app.services.hybrid_putaway_service import HybridPutawayService
            
            service = HybridPutawayService()
            tasks, warnings = await service.generate_tasks_from_grn(db, grn_id)
            
            # Update GRN with generation info
            grn.putaway_tasks_generated = True
            grn.putaway_tasks_generated_at = datetime.utcnow()
            await db.commit()
            
            logger.info(f"  ✅ Generated {len(tasks)} putaway tasks for GRN {grn.grn_number}")
            for i, task in enumerate(tasks):
                logger.info(f"     Task {i+1}: {task.task_number} | {task.item_sku} | Qty: {task.quantity_to_put} | Priority: {task.priority}")
            if warnings:
                for w in warnings:
                    logger.warning(f"  ⚠️ {w}")
                
        except Exception as e:
            logger.error(f"  ❌ Error generating putaway tasks for GRN {grn_id}: {str(e)}")
            logger.exception("  Full traceback:")
    else:
        logger.info(f"  ℹ️ Putaway tasks already generated at {grn.putaway_tasks_generated_at}. Skipping.")
    
    logger.info(f"✅ POST GRN COMPLETE: {grn.grn_number}")
    return grn



async def generate_putaway_tasks_background(grn_id: UUID):
    """Background task to generate putaway tasks with its own session"""
    from app.db.session import async_session_local
    from app.services.hybrid_putaway_service import HybridPutawayService
    
    try:
        logger.info(f"🎯 Starting putaway task generation for GRN: {grn_id}")
        
        # Create a new session for background task
        async with async_session_local() as bg_db:
            service = HybridPutawayService()
            tasks, warnings = await service.generate_tasks_from_grn(bg_db, grn_id)
            
            # Update GRN with generation info
            grn = await bg_db.get(GRN, grn_id)
            if grn:
                grn.putaway_tasks_generated = True
                grn.putaway_tasks_generated_at = datetime.utcnow()
                await bg_db.commit()
            
            logger.info(f"✅ Generated {len(tasks)} putaway tasks for GRN {grn_id}")
            if warnings:
                logger.warning(f"Warnings: {warnings}")
                
    except Exception as e:
        logger.error(f"❌ Error generating putaway tasks for GRN {grn_id}: {str(e)}")
        logger.exception("Full traceback:")



# async def post_grn(
#     db: AsyncSession,
#     grn_id: UUID
# ) -> Optional[GRN]:
#     """Post GRN - finalize the receiving process"""
#     grn = await get_grn_by_id(db, grn_id)
#     if not grn:
#         return None
    
#     grn.status = 'POSTED'
    
#     inbound = await get_inbound_shipment_by_id(db, grn.inbound_shipment_id)
#     if inbound:
#         inbound.status = 'COMPLETED'
    
#     await db.commit()
#     await db.refresh(grn)
#     return grn


# ============================================================================
# QUERY FUNCTIONS
# ============================================================================

async def get_inbound_shipment_by_id(
    db: AsyncSession,
    shipment_id: UUID
) -> Optional[InboundShipment]:
    """Get inbound shipment with all details including shipments, items, and suppliers"""
    query = select(InboundShipment).where(InboundShipment.id == shipment_id).options(
        selectinload(InboundShipment.warehouse),
        selectinload(InboundShipment.supplier),  # Load supplier
        selectinload(InboundShipment.asn_shipments)
        .selectinload(ASNShipment.supplier),  # Load supplier for each PO
        selectinload(InboundShipment.asn_shipments)
        .selectinload(ASNShipment.items)
        .selectinload(ASNShipmentItem.item_master)  # Load item master for each item
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_inbound_shipment_by_asn(
    db: AsyncSession,
    asn_number: str
) -> Optional[InboundShipment]:
    """Get inbound shipment by ASN number"""
    query = select(InboundShipment).where(InboundShipment.asn_number == asn_number).options(
        selectinload(InboundShipment.warehouse),
        selectinload(InboundShipment.supplier),
        selectinload(InboundShipment.asn_shipments)
        .selectinload(ASNShipment.supplier),
        selectinload(InboundShipment.asn_shipments)
        .selectinload(ASNShipment.items)
        .selectinload(ASNShipmentItem.item_master)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_inbound_shipments(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    warehouse_id: Optional[UUID] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    arrival_status: Optional[str] = None,
    asn_number: Optional[str] = None
) -> List[InboundShipment]:
    """Get list of inbound shipments with filters"""
    query = select(InboundShipment).options(
        selectinload(InboundShipment.warehouse),
        selectinload(InboundShipment.supplier)
    )
    
    if status:
        query = query.where(InboundShipment.status == status)
    
    if warehouse_id:
        query = query.where(InboundShipment.warehouse_id == warehouse_id)
    
    if from_date:
        query = query.where(InboundShipment.expected_arrival_date >= from_date)
    
    if to_date:
        query = query.where(InboundShipment.expected_arrival_date <= to_date)
    
    if asn_number:
        query = query.where(InboundShipment.asn_number.ilike(f"%{asn_number}%"))
    
    # Handle arrival status filters
    if arrival_status:
        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())
        
        if arrival_status == 'ARRIVED':
            query = query.where(InboundShipment.actual_arrival_date.isnot(None))
        elif arrival_status == 'NOT_ARRIVED':
            query = query.where(InboundShipment.actual_arrival_date.is_(None))
        elif arrival_status == 'OVERDUE':
            query = query.where(
                InboundShipment.actual_arrival_date.is_(None),
                InboundShipment.expected_arrival_date < datetime.now()
            )
        elif arrival_status == 'TODAY':
            query = query.where(
                InboundShipment.expected_arrival_date.between(today_start, today_end)
            )
        elif arrival_status == 'ARRIVED_TODAY':
            query = query.where(
                InboundShipment.actual_arrival_date.between(today_start, today_end)
            )
    
    query = query.offset(skip).limit(limit).order_by(InboundShipment.expected_arrival_date)
    result = await db.execute(query)
    return result.scalars().all()


async def get_receiving_task_by_id(
    db: AsyncSession,
    task_id: UUID
) -> Optional[ReceivingTask]:
    """Get receiving task by ID"""
    query = select(ReceivingTask).where(ReceivingTask.id == task_id).options(
        selectinload(ReceivingTask.assigned_to),
        selectinload(ReceivingTask.inbound_shipment),
        selectinload(ReceivingTask.items)
        .selectinload(ReceivingTaskItem.asn_shipment_item)
        .selectinload(ASNShipmentItem.item_master)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_receiving_tasks_by_shipment(
    db: AsyncSession,
    inbound_shipment_id: UUID
) -> List[ReceivingTask]:
    """Get all receiving tasks for a shipment"""
    query = select(ReceivingTask).where(
        ReceivingTask.inbound_shipment_id == inbound_shipment_id
    ).order_by(ReceivingTask.created_at)
    result = await db.execute(query)
    return result.scalars().all()


async def get_pending_receiving_tasks(
    db: AsyncSession,
    warehouse_id: Optional[UUID] = None
) -> List[ReceivingTask]:
    """Get all pending receiving tasks"""
    query = select(ReceivingTask).where(
        ReceivingTask.status.in_(['PENDING', 'IN_PROGRESS'])
    ).options(
        selectinload(ReceivingTask.inbound_shipment)
    )
    
    if warehouse_id:
        query = query.join(InboundShipment).where(InboundShipment.warehouse_id == warehouse_id)
    
    query = query.order_by(ReceivingTask.created_at)
    result = await db.execute(query)
    return result.scalars().all()


async def get_inspection_by_id(
    db: AsyncSession,
    inspection_id: UUID
) -> Optional[InspectionRecord]:
    """Get inspection record by ID"""
    query = select(InspectionRecord).where(InspectionRecord.id == inspection_id).options(
        selectinload(InspectionRecord.inspector),
        selectinload(InspectionRecord.details)
        .selectinload(InspectionDetail.asn_shipment_item)
        .selectinload(ASNShipmentItem.item_master)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_grn_by_id(
    db: AsyncSession,
    grn_id: UUID
) -> Optional[GRN]:
    """Get GRN by ID with all relationships eagerly loaded"""
    query = select(GRN).where(GRN.id == grn_id).options(
        selectinload(GRN.created_by),
        selectinload(GRN.inbound_shipment)
        .selectinload(InboundShipment.warehouse),
        selectinload(GRN.inbound_shipment)
        .selectinload(InboundShipment.supplier),
        selectinload(GRN.items)
        .selectinload(GRNItem.asn_shipment_item)
        .selectinload(ASNShipmentItem.item_master)
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def get_grns_by_shipment(
    db: AsyncSession,
    inbound_shipment_id: UUID
) -> List[GRN]:
    """Get all GRNs for a shipment"""
    query = select(GRN).where(
        GRN.inbound_shipment_id == inbound_shipment_id
    ).order_by(GRN.created_at)
    result = await db.execute(query)
    return result.scalars().all()


async def get_inbound_statistics(
    db: AsyncSession,
    warehouse_id: Optional[UUID] = None
) -> dict:
    """Get statistics about inbound shipments"""
    query = select(InboundShipment)
    if warehouse_id:
        query = query.where(InboundShipment.warehouse_id == warehouse_id)
    
    result = await db.execute(query)
    shipments = result.scalars().all()
    
    total = len(shipments)
    status_counts = {}
    for shipment in shipments:
        status_counts[shipment.status] = status_counts.get(shipment.status, 0) + 1
    
    today = datetime.now().date()
    today_arrivals = [
        s for s in shipments 
        if s.expected_arrival_date.date() == today
    ]
    
    overdue = [
        s for s in shipments 
        if s.status in ['PENDING', 'ARRIVED'] 
        and s.expected_arrival_date < datetime.now()
    ]
    
    return {
        'total_shipments': total,
        'by_status': status_counts,
        'today_arrivals': len(today_arrivals),
        'overdue_shipments': len(overdue)
    }


async def get_today_inbound_asns(
    db: AsyncSession,
    warehouse_code: Optional[str] = None,
    include_expected: bool = True,
    include_arrived: bool = True
) -> List[Dict[str, Any]]:
    """
    Get all ASNs for today including:
    - ASNs expected to arrive today
    - ASNs that arrived today (even if expected earlier)
    """
    today = date.today()
    today_start = datetime.combine(today, time.min)
    today_end = datetime.combine(today, time.max)
    
    # Build the query conditions
    conditions = []
    
    if include_expected:
        conditions.append(
            and_(
                OriginalASN.expected_date >= today_start,
                OriginalASN.expected_date <= today_end
            )
        )
    
    if include_arrived:
        # Get ASNs that arrived today from inbound_shipments
        conditions.append(
            OriginalASN.asn_number.in_(
                select(InboundShipment.asn_number).where(
                    and_(
                        InboundShipment.actual_arrival_date >= today_start,
                        InboundShipment.actual_arrival_date <= today_end
                    )
                )
            )
        )
    
    if not conditions:
        return []
    
    # Query ASNs with all relationships loaded
    query = select(OriginalASN).where(
        or_(*conditions)
    ).options(
        selectinload(OriginalASN.shipments)
        .selectinload(OriginalShipment.items)
        .selectinload(OriginalShipmentItem.item_master),
        selectinload(OriginalASN.supplier)
    ).order_by(OriginalASN.expected_date)
    
    result = await db.execute(query)
    asns = result.scalars().all()
    
    if not asns:
        return []
    
    # Get all inbound shipments for these ASNs
    asn_numbers = [asn.asn_number for asn in asns]
    inbound_query = select(InboundShipment).where(
        InboundShipment.asn_number.in_(asn_numbers)
    ).options(
        selectinload(InboundShipment.warehouse),
        selectinload(InboundShipment.supplier),
        selectinload(InboundShipment.asn_shipments)
        .selectinload(ASNShipment.supplier),
        selectinload(InboundShipment.asn_shipments)
        .selectinload(ASNShipment.items)
        .selectinload(ASNShipmentItem.item_master)
    )
    
    inbound_result = await db.execute(inbound_query)
    inbound_shipments = {ib.asn_number: ib for ib in inbound_result.scalars().all()}
    
    # Get all supplier IDs for shipments
    supplier_ids = set()
    for asn in asns:
        if asn.supplier_id:
            supplier_ids.add(asn.supplier_id)
        for shipment in asn.shipments:
            if shipment.supplier_id:
                supplier_ids.add(shipment.supplier_id)
    
    # Fetch supplier details
    suppliers = {}
    if supplier_ids:
        supplier_result = await db.execute(
            select(SupplierMaster).where(SupplierMaster.id.in_(supplier_ids))
        )
        suppliers = {s.id: s for s in supplier_result.scalars().all()}
    
    # Filter by warehouse if specified
    if warehouse_code:
        # Get warehouse ID
        warehouse_result = await db.execute(
            select(Warehouse).where(Warehouse.code == warehouse_code)
        )
        warehouse = warehouse_result.scalar_one_or_none()
        
        if warehouse:
            # Filter ASNs that have inbound shipments for this warehouse
            filtered_asns = []
            for asn in asns:
                inbound = inbound_shipments.get(asn.asn_number)
                if inbound and inbound.warehouse_id == warehouse.id:
                    filtered_asns.append(asn)
                elif not inbound:
                    # For ASNs not yet arrived, we can't filter by warehouse
                    filtered_asns.append(asn)
            asns = filtered_asns
    
    # Build response
    result_list = []
    for asn in asns:
        inbound = inbound_shipments.get(asn.asn_number)
        
        # Calculate totals
        total_items = 0
        total_qty = Decimal('0')
        
        # Build shipments data
        shipments_data = []
        for shipment in asn.shipments:
            shipment_items = []
            for item in shipment.items:
                total_items += 1
                if item.quantity:
                    total_qty += Decimal(str(item.quantity))
                
                # Get item master details
                item_master = item.item_master
                
                shipment_items.append({
                    "sku": item_master.sku_code if item_master else None,
                    "description": item_master.description if item_master else item.description,
                    "quantity": Decimal(str(item.quantity)) if item.quantity else Decimal('0'),
                    "received_quantity": Decimal('0'),
                    "unit": item.unit,
                    "unitPrice": Decimal(str(item.unit_price)) if item.unit_price else None,
                    "totalPrice": Decimal(str(item.total_price)) if item.total_price else None,
                    "lot": item.lot,
                    "hsnCode": item_master.hsn_code if item_master else None
                })
            
            # Get supplier name for this shipment
            shipment_supplier_name = None
            if shipment.supplier_id and shipment.supplier_id in suppliers:
                shipment_supplier_name = suppliers[shipment.supplier_id].name
            
            shipments_data.append({
                "poNumber": shipment.po_number,
                "supplierCode": shipment.supplier.code if shipment.supplier else None,
                "supplierName": shipment_supplier_name,
                "items": shipment_items
            })
        
        # Determine arrival status
        is_arrived = inbound is not None
        arrival_time = None
        arrival_status = "EXPECTED_TODAY"
        
        if is_arrived:
            arrival_time = inbound.actual_arrival_date.strftime("%H:%M") if inbound.actual_arrival_date else None
            if inbound.actual_arrival_date and inbound.actual_arrival_date.date() == today:
                arrival_status = "ARRIVED_TODAY"
            else:
                arrival_status = "ARRIVED_EARLIER"
        else:
            if asn.expected_date and asn.expected_date.date() < today:
                arrival_status = "OVERDUE"
        
        # Get supplier name for main ASN
        supplier_name = None
        if inbound and inbound.supplier:
            supplier_name = inbound.supplier.name
        elif asn.supplier_id and asn.supplier_id in suppliers:
            supplier_name = suppliers[asn.supplier_id].name
        
        result_list.append({
            "asnNumber": asn.asn_number,
            "asnDate": asn.asn_date,
            "expectedDate": asn.expected_date,
            "actualArrivalDate": inbound.actual_arrival_date if inbound else None,
            "shipmentId": asn.shipment_id,
            "status": inbound.status if inbound else asn.status,
            "warehouseCode": inbound.warehouse.code if inbound and inbound.warehouse else warehouse_code,
            "supplierCode": asn.supplier.code if asn.supplier else None,
            "supplierName": supplier_name,
            "driverName": inbound.driver_name if inbound else None,
            "driverPhone": inbound.driver_phone if inbound else None,
            "vehicleNumber": inbound.vehicle_number if inbound else None,
            "receivingDock": inbound.receiving_dock if inbound else None,
            "notes": inbound.notes if inbound else asn.notes,
            "is_arrived": is_arrived,
            "arrival_time": arrival_time,
            "arrival_status": arrival_status,
            "items_count": total_items,
            "total_quantity": total_qty,
            "shipments": shipments_data
        })
    
    return result_list


async def get_today_inbound_summary(
    db: AsyncSession,
    warehouse_code: Optional[str] = None
) -> Dict[str, Any]:
    """
    Get summary of today's inbound ASNs
    """
    today_asns = await get_today_inbound_asns(
        db=db,
        warehouse_code=warehouse_code,
        include_expected=True,
        include_arrived=True
    )
    
    # Categorize ASNs
    expected = [a for a in today_asns if a["arrival_status"] == "EXPECTED_TODAY"]
    arrived = [a for a in today_asns if a["arrival_status"] == "ARRIVED_TODAY"]
    overdue = [a for a in today_asns if a["arrival_status"] == "OVERDUE"]
    
    # Calculate totals
    total_expected_qty = sum(a["total_quantity"] for a in expected)
    total_arrived_qty = sum(a["total_quantity"] for a in arrived)
    total_overdue_qty = sum(a["total_quantity"] for a in overdue)
    
    total_expected_items = sum(a["items_count"] for a in expected)
    total_arrived_items = sum(a["items_count"] for a in arrived)
    
    return {
        "date": date.today().isoformat(),
        "summary": {
            "total_asns": len(today_asns),
            "expected_today": len(expected),
            "arrived_today": len(arrived),
            "overdue": len(overdue),
            "arrival_rate": round((len(arrived) / len(today_asns) * 100) if today_asns else 0, 2)
        },
        "quantities": {
            "total_quantity_expected": float(total_expected_qty),
            "total_quantity_arrived": float(total_arrived_qty),
            "total_quantity_overdue": float(total_overdue_qty),
            "total_items_expected": total_expected_items,
            "total_items_arrived": total_arrived_items,
            "received_percentage": round((float(total_arrived_qty) / float(total_expected_qty + total_overdue_qty) * 100) if (total_expected_qty + total_overdue_qty) > 0 else 0, 2)
        },
        "expected": expected,
        "arrived": arrived,
        "overdue": overdue
    }