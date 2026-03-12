from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import datetime, timezone, time, date

from app.api import deps
from app.schemas.inbound import (
    InboundShipment, InboundShipmentUpdate,
    InboundShipmentList, InboundShipmentResponse,
    ReceivingTask, ReceivingTaskCreate,
    InspectionRecord, InspectionRecordCreate,
    GRN, GRNCreate, ArrivalConfirmationWithWarehouse, 
    TodayASNResponse, TodayASNSummaryResponse,
    TodayArrivedASNResponse, TodayArrivedSummaryResponse, GRNSimpleResponse
)
from app.schemas.user import User
from app.crud import inbound as inbound_crud
from app.db.session import get_db
import logging
from sqlalchemy import func, select
from app.models.inbound import InboundShipment as InboundShipmentModel  # Add this for DB queries

router = APIRouter(prefix="/inbound", tags=["Inbound"])

logger = logging.getLogger(__name__)

# ============================================================================
# TODAY'S ARRIVED ASNS ROUTES - MOST SPECIFIC
# ============================================================================

@router.get("/today/arrived", response_model=List[TodayArrivedASNResponse])
async def get_today_arrived_asns(
    warehouse_code: Optional[str] = Query(None, description="Filter by warehouse code"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get ASNs that arrived today and are pending GRN creation.
    Once a GRN is created for an ASN, it will no longer appear in this list.
    Use /today/arrived/with-grn to see ASNs that already have a GRN.
    """
    logger.info("="*80)
    logger.info("GET /today/arrived ENDPOINT CALLED")
    logger.info(f"User: {current_user.username}, Role: {current_user.role}")
    logger.info(f"Warehouse filter: {warehouse_code}")
    logger.info("="*80)
    
    try:
        arrived_asns = await inbound_crud.get_today_arrived_asns(
            db=db,
            warehouse_code=warehouse_code
        )
        
        # Filter out ASNs that already have a GRN created
        pending_grn = [a for a in arrived_asns if a.get("grn_id") is None]
        
        logger.info(f"Endpoint returning {len(pending_grn)} ASNs (filtered out {len(arrived_asns) - len(pending_grn)} with GRN)")
        return pending_grn
        
    except Exception as e:
        logger.error(f"Error in get_today_arrived_asns: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching today's arrived ASNs: {str(e)}"
        )


@router.get("/today/arrived/summary", response_model=TodayArrivedSummaryResponse)
async def get_today_arrived_summary(
    warehouse_code: Optional[str] = Query(None, description="Filter by warehouse code"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get summary of today's arrived ASNs
    
    Returns:
    - Total arrived count
    - Count with GRN
    - Count pending GRN
    - Quantity totals (expected, received, accepted, rejected)
    - Complete list of arrived ASNs with all details
    
    Accessible to: All authenticated users
    """
    try:
        summary = await inbound_crud.get_today_arrived_summary(
            db=db,
            warehouse_code=warehouse_code
        )
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching today's summary: {str(e)}"
        )


@router.get("/today/arrived/with-grn", response_model=List[TodayArrivedASNResponse])
async def get_today_arrived_with_grn(
    warehouse_code: Optional[str] = Query(None, description="Filter by warehouse code"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get today's arrived ASNs that already have GRN created
    
    Accessible to: All authenticated users
    """
    try:
        arrived_asns = await inbound_crud.get_today_arrived_asns(
            db=db,
            warehouse_code=warehouse_code
        )
        # Filter ASNs with GRN
        with_grn = [a for a in arrived_asns if a["grn_id"] is not None]
        return with_grn
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching today's ASNs with GRN: {str(e)}"
        )


@router.get("/today/arrived/pending-grn", response_model=List[TodayArrivedASNResponse])
async def get_today_arrived_pending_grn(
    warehouse_code: Optional[str] = Query(None, description="Filter by warehouse code"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get today's arrived ASNs that are pending GRN creation
    
    Accessible to: All authenticated users
    """
    try:
        arrived_asns = await inbound_crud.get_today_arrived_asns(
            db=db,
            warehouse_code=warehouse_code
        )
        # Filter ASNs without GRN
        pending_grn = [a for a in arrived_asns if a["grn_id"] is None]
        return pending_grn
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching today's ASNs pending GRN: {str(e)}"
        )


# ============================================================================
# TODAY'S GENERAL ASN ROUTES (Expected, Arrived, Overdue)
# ============================================================================

@router.get("/today/summary", response_model=TodayASNSummaryResponse)
async def get_today_inbound_summary(
    warehouse_code: Optional[str] = Query(None, description="Filter by warehouse code"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get summary of today's inbound ASN activities
    
    Returns:
    - Summary counts (total, expected, arrived, overdue)
    - Quantity totals
    - Categorized lists (expected, arrived, overdue)
    """
    try:
        summary = await inbound_crud.get_today_inbound_summary(
            db=db,
            warehouse_code=warehouse_code
        )
        return summary
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching today's summary: {str(e)}"
        )


@router.get("/today/expected", response_model=List[TodayASNResponse])
async def get_today_expected_asns(
    warehouse_code: Optional[str] = Query(None, description="Filter by warehouse code"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get ASNs expected to arrive today (that haven't arrived yet)
    
    Accessible to: All authenticated users
    """
    try:
        today_asns = await inbound_crud.get_today_inbound_asns(
            db=db,
            warehouse_code=warehouse_code,
            include_expected=True,
            include_arrived=False
        )
        return today_asns
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching expected ASNs: {str(e)}"
        )


@router.get("/today/overdue", response_model=List[TodayASNResponse])
async def get_today_overdue_asns(
    warehouse_code: Optional[str] = Query(None, description="Filter by warehouse code"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get overdue ASNs (expected before today but not yet arrived)
    
    Accessible to: All authenticated users
    """
    try:
        today_asns = await inbound_crud.get_today_inbound_asns(
            db=db,
            warehouse_code=warehouse_code,
            include_expected=True,
            include_arrived=True
        )
        # Filter for overdue only
        overdue = [a for a in today_asns if a.get("arrival_status") == "OVERDUE"]
        return overdue
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching overdue ASNs: {str(e)}"
        )


@router.get("/today", response_model=List[TodayASNResponse])
async def get_today_inbound_asns(
    warehouse_code: Optional[str] = Query(None, description="Filter by warehouse code"),
    include_expected: bool = Query(True, description="Include ASNs expected today"),
    include_arrived: bool = Query(True, description="Include ASNs that arrived today"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get all ASNs for today
    
    This endpoint returns:
    - ASNs expected to arrive today (expected_date = today)
    - ASNs that arrived today (actual_arrival_date = today)
    
    Each ASN includes:
    - Complete header information
    - All PO/shipment details
    - All item details with SKU, quantities, prices
    - Supplier information
    - Arrival status (EXPECTED_TODAY, ARRIVED_TODAY, OVERDUE)
    
    Accessible to: All authenticated users
    """
    try:
        today_asns = await inbound_crud.get_today_inbound_asns(
            db=db,
            warehouse_code=warehouse_code,
            include_expected=include_expected,
            include_arrived=include_arrived
        )
        return today_asns
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching today's ASNs: {str(e)}"
        )


# ============================================================================
# GRN MANAGEMENT ROUTES - WITH ROLE-BASED ACCESS
# ============================================================================

@router.post("/grn/create", response_model=Dict[str, Any])
async def create_grn_for_arrived_asn(
    inbound_shipment_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Create GRN for an arrived ASN and automatically generate putaway tasks.
    
    This endpoint will:
    1. Create GRN with all items from the inbound shipment
    2. Mark GRN as POSTED and inbound shipment as COMPLETED
    3. Automatically generate putaway tasks using hybrid strategy
    4. Return complete details of GRN + putaway tasks
    
    Role: GRN_MANAGER, ADMIN only
    """
    # Check if user has GRN Manager role
    if current_user.role not in ["GRN_MANAGER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Only GRN Managers can create GRN. Your role: {current_user.role}"
        )
    
    try:
        logger.info("=" * 80)
        logger.info("🚀 POST /grn/create ENDPOINT CALLED")
        logger.info(f"   User: {current_user.username} (Role: {current_user.role})")
        logger.info(f"   Inbound Shipment ID: {inbound_shipment_id}")
        logger.info("=" * 80)
        
        # Check if inbound shipment exists and has arrived
        inbound = await inbound_crud.get_inbound_shipment_by_id(db, inbound_shipment_id)
        if not inbound:
            logger.error(f"❌ Inbound shipment {inbound_shipment_id} not found")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inbound shipment not found"
            )
        
        logger.info(f"   Found inbound: {inbound.asn_number} (Status: {inbound.status})")
        
        if inbound.status != "ARRIVED":
            logger.error(f"❌ Inbound status is {inbound.status}, expected ARRIVED")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"GRN can only be created for ARRIVED shipments. Current status: {inbound.status}"
            )
        
        # Check if GRN already exists
        if inbound.grns and len(inbound.grns) > 0:
            existing_grn = inbound.grns[0]
            logger.info(f"   ⚠️ GRN already exists: {existing_grn.grn_number}")
            
            # Get putaway tasks count for existing GRN
            from app.models.putaway import PutawayTask
            tasks_count_result = await db.execute(
                select(func.count()).select_from(PutawayTask).where(PutawayTask.grn_id == existing_grn.id)
            )
            tasks_count = tasks_count_result.scalar() or 0
            
            return {
                "message": "GRN already exists for this ASN",
                "grn_id": str(existing_grn.id),
                "grn_number": existing_grn.grn_number,
                "status": existing_grn.status,
                "putaway_tasks_generated": existing_grn.putaway_tasks_generated,
                "putaway_tasks_count": tasks_count
            }
        
        # Build GRN items from all ASN shipment items
        from app.schemas.inbound import GRNCreate, GRNItemCreate
        grn_items = []
        logger.info(f"   Building GRN items from {len(inbound.asn_shipments)} shipments...")
        
        for asn_shipment in inbound.asn_shipments:
            logger.info(f"     PO: {asn_shipment.po_number} - {len(asn_shipment.items)} items")
            for asn_item in asn_shipment.items:
                item_name = asn_item.item_master.sku_code if asn_item.item_master else "UNKNOWN"
                logger.info(f"       Item: {item_name}, Expected Qty: {asn_item.expected_quantity}")
                grn_items.append(GRNItemCreate(
                    asn_shipment_item_id=asn_item.id,
                    received_quantity=asn_item.expected_quantity,
                    accepted_quantity=asn_item.expected_quantity,
                    rejected_quantity=0
                ))
        
        if not grn_items:
            logger.error("❌ No items found in inbound shipment")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No items found in inbound shipment to create GRN"
            )
        
        logger.info(f"   Total GRN items: {len(grn_items)}")
        
        grn_data = GRNCreate(
            inbound_shipment_id=inbound_shipment_id,
            items=grn_items
        )
        
        # create_grn now returns (grn, putaway_tasks, warnings)
        grn, putaway_tasks, putaway_warnings = await inbound_crud.create_grn(
            db=db,
            grn_data=grn_data,
            created_by_id=current_user.id
        )
        
        # Build putaway tasks response
        putaway_tasks_response = []
        for task in putaway_tasks:
            putaway_tasks_response.append({
                "task_id": str(task.id),
                "task_number": task.task_number,
                "item_sku": task.item_sku,
                "item_description": task.item_description,
                "quantity_to_put": float(task.quantity_to_put),
                "source_location": task.source_location,
                "suggested_bin_id": str(task.suggested_bin_id) if task.suggested_bin_id else None,
                "priority": task.priority,
                "status": task.status,
                "strategy": task.task_data.get('strategy') if task.task_data else None,
                "reason": task.task_data.get('reason') if task.task_data else None,
            })
        
        logger.info(f"✅ GRN created: {grn.grn_number}")
        logger.info(f"✅ Putaway tasks: {len(putaway_tasks)}")
        
        return {
            "message": "GRN created and putaway tasks generated successfully",
            "grn_id": str(grn.id),
            "grn_number": grn.grn_number,
            "grn_status": grn.status,
            "items_count": len(grn_items),
            "inbound_shipment_id": str(inbound_shipment_id),
            "asn_number": inbound.asn_number,
            "created_by": current_user.username,
            "putaway_tasks_generated": grn.putaway_tasks_generated,
            "putaway_tasks_count": len(putaway_tasks),
            "putaway_tasks": putaway_tasks_response,
            "putaway_warnings": putaway_warnings,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"❌ Error in create_grn_for_arrived_asn: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating GRN: {str(e)}"
        )


@router.post("/grn/{grn_id}/post", response_model=Dict[str, Any])
async def post_grn_via_post(
    grn_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Post/Finalize a GRN (POST method)
    
    This will:
    1. Mark GRN as POSTED
    2. Update inbound shipment status to COMPLETED
    3. Automatically generate putaway tasks
    
    Role: GRN_MANAGER, ADMIN only
    """
    # Check if user has GRN Manager role
    if current_user.role not in ["GRN_MANAGER", "ADMIN"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Only GRN Managers can post GRN. Your role: {current_user.role}"
        )
    
    try:
        grn = await inbound_crud.post_grn(db=db, grn_id=grn_id)
        if not grn:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="GRN not found"
            )
        
        # Get putaway task count for this GRN
        from app.models.putaway import PutawayTask
        tasks_count_result = await db.execute(
            select(func.count()).select_from(PutawayTask).where(PutawayTask.grn_id == grn_id)
        )
        tasks_count = tasks_count_result.scalar() or 0
        
        return {
            "message": "GRN posted successfully and putaway tasks generated",
            "grn_id": str(grn_id),
            "grn_number": grn.grn_number,
            "status": grn.status,
            "putaway_tasks_generated": grn.putaway_tasks_generated,
            "putaway_tasks_count": tasks_count,
            "posted_by": current_user.username,
            "role": current_user.role,
            "timestamp": datetime.utcnow().isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error posting GRN: {str(e)}"
        )


@router.get("/grn/pending", response_model=List[Dict[str, Any]])
async def get_pending_grns(
    warehouse_code: Optional[str] = Query(None, description="Filter by warehouse code"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get all pending GRNs (arrived ASNs without GRN)
    
    Accessible to: All authenticated users (view only)
    GRN Managers can see all details, others see limited view
    """
    try:
        arrived_asns = await inbound_crud.get_today_arrived_asns(
            db=db,
            warehouse_code=warehouse_code
        )
        
        pending_grn = [a for a in arrived_asns if a["grn_id"] is None]
        
        # If user is not GRN Manager, remove sensitive information
        if current_user.role not in ["GRN_MANAGER", "ADMIN"]:
            for asn in pending_grn:
                # Keep only essential information for non-managers
                asn.pop("driver_phone", None)
                asn.pop("supplier_gst", None)
                # You can add more fields to remove as needed
        
        return pending_grn
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error fetching pending GRNs: {str(e)}"
        )


# ============================================================================
# DASHBOARD ROUTES
# ============================================================================

@router.get("/dashboard/today", response_model=dict)
async def get_today_dashboard(
    db: AsyncSession = Depends(get_db),
    warehouse_id: Optional[UUID] = Query(None, description="Filter by warehouse ID"),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get today's inbound dashboard summary
    
    Shows:
    - Expected arrivals today
    - Arrived today
    - Overdue shipments
    - Pending shipments
    
    Accessible to: All authenticated users
    """
    today = date.today()
    today_start = datetime.combine(today, time.min)
    today_end = datetime.combine(today, time.max)
    
    # Get today's expected arrivals
    expected_today = await inbound_crud.get_inbound_shipments(
        db=db,
        warehouse_id=warehouse_id,
        from_date=today_start,
        to_date=today_end,
        limit=1000
    )
    
    # Get arrived today
    arrived_today = await inbound_crud.get_inbound_shipments(
        db=db,
        warehouse_id=warehouse_id,
        arrival_status='ARRIVED_TODAY',
        limit=1000
    )
    
    # Get overdue
    overdue = await inbound_crud.get_inbound_shipments(
        db=db,
        warehouse_id=warehouse_id,
        arrival_status='OVERDUE',
        limit=1000
    )
    
    # Get all pending
    pending = await inbound_crud.get_inbound_shipments(
        db=db,
        warehouse_id=warehouse_id,
        status='PENDING',
        limit=1000
    )
    
    return {
        "date": today.isoformat(),
        "summary": {
            "expected_today": len(expected_today),
            "arrived_today": len(arrived_today),
            "overdue": len(overdue),
            "pending": len(pending),
            "total_shipments": len(expected_today) + len(overdue)
        },
        "expected_today": [
            {
                "id": str(s.id),
                "asn_number": s.asn_number,
                "expected_arrival_date": s.expected_arrival_date,
                "status": s.status,
                "supplier_name": s.supplier.name if s.supplier else None
            }
            for s in expected_today
        ],
        "arrived_today": [
            {
                "id": str(s.id),
                "asn_number": s.asn_number,
                "actual_arrival_date": s.actual_arrival_date,
                "status": s.status,
                "supplier_name": s.supplier.name if s.supplier else None
            }
            for s in arrived_today
        ]
    }


@router.get("/statistics/summary", response_model=dict)
async def get_inbound_statistics(
    warehouse_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get statistics about inbound shipments"""
    stats = await inbound_crud.get_inbound_statistics(
        db=db,
        warehouse_id=warehouse_id
    )
    return stats


# ============================================================================
# ASN ARRIVAL AND PROCESSING ROUTES
# ============================================================================

@router.post("/asn/{asn_number}/arrive", response_model=InboundShipmentResponse)
async def process_existing_asn_arrival(
    asn_number: str,
    arrival_data: ArrivalConfirmationWithWarehouse,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_grn_manager_user)
):
    """
    Process arrival of an existing ASN from the asns table
    """
    try:
        # DEBUG: Print received data
        print("="*60)
        print(f"PROCESSING ARRIVAL FOR ASN: {asn_number}")
        print(f"Current time: {datetime.utcnow()}")
        print(f"Received arrival_data: {arrival_data}")
        print(f"actual_arrival_date from request: {arrival_data.actual_arrival_date}")
        print(f"warehouse_code: {arrival_data.warehouse_code}")
        print("="*60)
        
        # Convert timezone-aware datetime to naive UTC if needed
        if arrival_data.actual_arrival_date and arrival_data.actual_arrival_date.tzinfo is not None:
            original_date = arrival_data.actual_arrival_date
            arrival_data.actual_arrival_date = arrival_data.actual_arrival_date.astimezone(timezone.utc).replace(tzinfo=None)
            print(f"Original date with tz: {original_date}")
            print(f"Converted to naive UTC: {arrival_data.actual_arrival_date}")
        
        # First check if inbound shipment already exists
        existing_inbound = await inbound_crud.get_inbound_shipment_by_asn(db, asn_number)
        
        if existing_inbound:
            print(f"Found existing inbound shipment: {existing_inbound.id}")
            # Update existing inbound shipment with arrival info
            updated_inbound = await inbound_crud.confirm_shipment_arrival(
                db=db,
                inbound_shipment_id=existing_inbound.id,
                arrival_data=arrival_data,
                updated_by=current_user.username
            )
            
            print(f"Updated inbound shipment with arrival date: {updated_inbound.actual_arrival_date}")
            
            return InboundShipmentResponse(
                shipment=updated_inbound,
                new_suppliers=[],
                new_items=[],
                updated_items=[],
                warnings=[f"Updated existing inbound shipment for ASN {asn_number}"]
            )
        else:
            print(f"No existing inbound found. Creating new from ASN: {asn_number}")
            # Create new inbound shipment from existing ASN
            inbound, result_info = await inbound_crud.create_inbound_from_existing_asn(
                db=db,
                asn_number=asn_number,
                warehouse_code=arrival_data.warehouse_code,
                arrival_data=arrival_data,
                created_by=current_user.username
            )
            
            print(f"Created new inbound shipment with ID: {inbound.id}")
            print(f"Actual arrival date set to: {inbound.actual_arrival_date}")
            
            return InboundShipmentResponse(
                shipment=inbound,
                new_suppliers=result_info['new_suppliers'],
                new_items=result_info['new_items'],
                updated_items=result_info['updated_items'],
                warnings=result_info['warnings']
            )
            
    except ValueError as e:
        print(f"ERROR: {str(e)}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    
    

@router.get("/asn/{asn_number}", response_model=InboundShipment)
async def get_inbound_by_asn(
    asn_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get inbound shipment by ASN number"""
    inbound = await inbound_crud.get_inbound_shipment_by_asn(db, asn_number)
    if not inbound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inbound shipment not found"
        )
    return inbound


# ============================================================================
# RECEIVING TASKS ROUTES
# ============================================================================

@router.post("/receiving-tasks", response_model=ReceivingTask)
async def create_receiving_task(
    task_data: ReceivingTaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_grn_manager_user)
):
    """Create a task for receiving/offloading"""
    task = await inbound_crud.create_receiving_task(
        db=db,
        task_data=task_data,
        created_by=current_user.username
    )
    return task


@router.get("/receiving-tasks/pending", response_model=List[ReceivingTask])
async def get_pending_receiving_tasks(
    warehouse_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get all pending receiving tasks"""
    tasks = await inbound_crud.get_pending_receiving_tasks(
        db=db,
        warehouse_id=warehouse_id
    )
    return tasks


@router.get("/receiving-tasks/{task_id}", response_model=ReceivingTask)
async def get_receiving_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get receiving task by ID"""
    task = await inbound_crud.get_receiving_task_by_id(db, task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receiving task not found"
        )
    return task


@router.patch("/receiving-tasks/{task_id}/start", response_model=ReceivingTask)
async def start_receiving_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_putaway_worker)
):
    """Start a receiving task"""
    task = await inbound_crud.start_receiving_task(
        db=db,
        task_id=task_id,
        user_id=current_user.id
    )
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receiving task not found"
        )
    return task


@router.patch("/receiving-tasks/{task_id}/complete", response_model=ReceivingTask)
async def complete_receiving_task(
    task_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_putaway_worker)
):
    """Complete a receiving task"""
    task = await inbound_crud.complete_receiving_task(db=db, task_id=task_id)
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Receiving task not found"
        )
    return task


# ============================================================================
# INSPECTION ROUTES
# ============================================================================

@router.post("/inspection", response_model=InspectionRecord)
async def create_inspection(
    inspection_data: InspectionRecordCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_quality_inspector)
):
    """Create quality inspection record"""
    inspection = await inbound_crud.create_inspection_record(
        db=db,
        inspection_data=inspection_data,
        inspector_id=current_user.id
    )
    return inspection


@router.get("/inspection/{inspection_id}", response_model=InspectionRecord)
async def get_inspection(
    inspection_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get inspection record by ID"""
    inspection = await inbound_crud.get_inspection_by_id(db, inspection_id)
    if not inspection:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inspection record not found"
        )
    return inspection


# ============================================================================
# GRN ROUTES (Standard CRUD) - ENHANCED WITH VALIDATION
# ============================================================================

@router.post("/grn", response_model=GRNSimpleResponse)
async def create_grn(
    grn_data: GRNCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_grn_manager_user)
):
    """
    Create Goods Received Note
    
    This endpoint validates that the inbound_shipment_id exists before creating the GRN.
    If the ID doesn't exist, it returns a helpful error message with available IDs.
    """
    logger.info("="*60)
    logger.info("📝 GRN CREATE REQUEST RECEIVED")
    logger.info("="*60)
    logger.info(f"Inbound Shipment ID: {grn_data.inbound_shipment_id}")
    logger.info(f"Items count: {len(grn_data.items)}")
    
    # First verify the inbound shipment exists using the model
    inbound = await db.get(InboundShipmentModel, grn_data.inbound_shipment_id)
    
    if not inbound:
        # List available inbound shipments for debugging
        result = await db.execute(
            select(InboundShipmentModel).limit(10).order_by(InboundShipmentModel.created_at.desc())
        )
        available = result.scalars().all()
        
        error_msg = f"Inbound shipment with ID {grn_data.inbound_shipment_id} not found!"
        logger.error(f"❌ {error_msg}")
        
        if available:
            logger.info("Available inbound shipments:")
            valid_ids = []
            available_shipments = []
            
            for s in available:
                logger.info(f"  - {s.id}: {s.asn_number} (Status: {s.status})")
                valid_ids.append(str(s.id))
                available_shipments.append({
                    "id": str(s.id),
                    "asn_number": s.asn_number,
                    "status": s.status,
                    "created_at": s.created_at.isoformat() if s.created_at else None
                })
            
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": error_msg,
                    "message": "Please use a valid inbound_shipment_id from the list below",
                    "valid_ids": valid_ids,
                    "available_shipments": available_shipments,
                    "hint": "You can fetch arrived ASNs from /inbound/today/arrived to get valid IDs"
                }
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error": "No inbound shipments found in database",
                    "message": "Please create an inbound shipment first using /inbound/asn/{asn_number}/arrive",
                    "hint": "After creating an inbound shipment, use its ID to create a GRN"
                }
            )
    
    logger.info(f"✅ Found inbound shipment: {inbound.asn_number} (Status: {inbound.status})")
    
    try:
        # create_grn now returns (grn, putaway_tasks, warnings)
        grn, putaway_tasks, putaway_warnings = await inbound_crud.create_grn(
            db=db,
            grn_data=grn_data,
            created_by_id=current_user.id
        )
        logger.info(f"✅ GRN created: {grn.grn_number} | Putaway Tasks: {len(putaway_tasks)} | Warnings: {len(putaway_warnings)}")
        return grn
        
    except Exception as e:
        logger.error(f"❌ Error creating GRN: {str(e)}")
        logger.exception("Full traceback:")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating GRN: {str(e)}"
        )


@router.patch("/grn/{grn_id}/post", response_model=GRN)
async def post_grn(
    grn_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_grn_manager_user)
):
    """
    Post GRN - finalize receiving and automatically generate putaway tasks
    
    This will:
    1. Mark GRN as POSTED
    2. Update inbound shipment status to COMPLETED
    3. Automatically generate putaway tasks in the background
    """
    grn = await inbound_crud.post_grn(db=db, grn_id=grn_id)
    if not grn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GRN not found"
        )
    
    return grn


@router.get("/grn/{grn_id}", response_model=GRN)
async def get_grn(
    grn_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get GRN by ID"""
    grn = await inbound_crud.get_grn_by_id(db, grn_id)
    if not grn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GRN not found"
        )
    return grn


# ============================================================================
# INBOUND SHIPMENT ROUTES (with UUID parameters - LEAST SPECIFIC)
# ============================================================================

@router.get("/", response_model=List[InboundShipmentList])
async def get_inbound_shipments(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None, description="Filter by status: PENDING, ARRIVED, INSPECTION, RECEIVING, COMPLETED, CANCELLED"),
    warehouse_id: Optional[UUID] = Query(None, description="Filter by warehouse ID"),
    from_date: Optional[datetime] = Query(None, description="Filter by expected arrival date from"),
    to_date: Optional[datetime] = Query(None, description="Filter by expected arrival date to"),
    arrival_status: Optional[str] = Query(
        None, 
        description="Filter by arrival status: ARRIVED, NOT_ARRIVED, OVERDUE, TODAY, ARRIVED_TODAY"
    ),
    asn_number: Optional[str] = Query(None, description="Search by ASN number"),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get list of inbound shipments with filters
    
    Arrival Status options:
    - ARRIVED: All shipments that have arrived
    - NOT_ARRIVED: Shipments that haven't arrived yet
    - OVERDUE: Expected arrivals that are past due and not arrived
    - TODAY: Shipments expected to arrive today
    - ARRIVED_TODAY: Shipments that arrived today
    """
    shipments = await inbound_crud.get_inbound_shipments(
        db=db,
        skip=skip,
        limit=limit,
        status=status,
        warehouse_id=warehouse_id,
        from_date=from_date,
        to_date=to_date,
        arrival_status=arrival_status,
        asn_number=asn_number
    )
    return shipments


@router.get("/{inbound_id}/receiving-tasks", response_model=List[ReceivingTask])
async def get_receiving_tasks_by_shipment(
    inbound_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get all receiving tasks for a shipment"""
    tasks = await inbound_crud.get_receiving_tasks_by_shipment(db, inbound_id)
    return tasks


@router.get("/{inbound_id}/grns", response_model=List[GRN])
async def get_grns_by_shipment(
    inbound_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get all GRNs for a shipment"""
    grns = await inbound_crud.get_grns_by_shipment(db, inbound_id)
    return grns


@router.get("/{inbound_id}", response_model=InboundShipment)
async def get_inbound_shipment(
    inbound_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get inbound shipment by ID with all details"""
    inbound = await inbound_crud.get_inbound_shipment_by_id(db, inbound_id)
    if not inbound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inbound shipment not found"
        )
    return inbound


@router.patch("/{inbound_id}", response_model=InboundShipment)
async def update_inbound_shipment(
    inbound_id: UUID,
    inbound_update: InboundShipmentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_grn_manager_user)
):
    """Update inbound shipment details"""
    inbound = await inbound_crud.get_inbound_shipment_by_id(db, inbound_id)
    if not inbound:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Inbound shipment not found"
        )
    
    # Update fields
    update_data = inbound_update.dict(exclude_unset=True, by_alias=True)
    for key, value in update_data.items():
        if hasattr(inbound, key) and value is not None:
            setattr(inbound, key, value)
    
    inbound.updated_by = current_user.username
    inbound.updated_at = datetime.utcnow()
    
    await db.commit()
    await db.refresh(inbound)
    return inbound


@router.get("/grn/{grn_id}/putaway-status", response_model=Dict[str, Any])
async def get_grn_putaway_status(
    grn_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Check putaway task generation status for a GRN"""
    grn = await inbound_crud.get_grn_by_id(db, grn_id)
    if not grn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GRN not found"
        )
    
    # Count putaway tasks for this GRN
    from app.models.putaway import PutawayTask
    tasks_count = await db.execute(
        select(func.count()).select_from(PutawayTask).where(PutawayTask.grn_id == grn_id)
    )
    
    return {
        "grn_id": str(grn_id),
        "grn_number": grn.grn_number,
        "status": grn.status,
        "putaway_tasks_generated": grn.putaway_tasks_generated,
        "putaway_tasks_generated_at": grn.putaway_tasks_generated_at,
        "tasks_count": tasks_count.scalar() or 0
    }