from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.api import deps
from app.schemas.item_master import (
    ItemMaster, 
    ItemMasterCreate, 
    ItemMasterUpdate,
    ItemVelocityUpdate
)
from app.schemas.user import User
from app.crud import item_master as item_crud
from app.db.session import get_db

router = APIRouter(prefix="/items", tags=["Item Master"])


# ============================================================================
# BASIC CRUD ENDPOINTS
# ============================================================================

@router.post("/", response_model=ItemMaster, status_code=status.HTTP_201_CREATED)
async def create_item(
    item_data: ItemMasterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """
    Create a new item master
    
    This endpoint creates a new item with all its properties including:
    - Basic identification (SKU, description, barcodes)
    - Physical dimensions and weights
    - Storage rules (FEFO/FIFO, batch/serial tracking)
    - Putaway preferences
    - Compatibility rules
    - Hazardous materials information
    - Quality inspection requirements
    """
    try:
        item = await item_crud.create_item(
            db, 
            item_data, 
            created_by=current_user.username
        )
        return item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.get("/", response_model=List[ItemMaster])
async def read_items(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None, description="Search by SKU, description, or barcode"),
    item_type: Optional[str] = Query(None, description="Filter by item type"),
    item_category: Optional[str] = Query(None, description="Filter by item category"),
    velocity_class: Optional[str] = Query(None, description="Filter by velocity class (A, B, C)"),
    is_hazardous: Optional[bool] = Query(None, description="Filter hazardous items"),
    requires_inspection: Optional[bool] = Query(None, description="Filter items requiring inspection"),
    active_only: bool = Query(True, description="Return only active items"),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get list of items with optional filters
    
    Supports filtering by:
    - Search term (SKU, description, barcode)
    - Item type and category
    - Velocity class (A, B, C)
    - Hazardous status
    - Inspection requirements
    - Active status
    """
    items = await item_crud.get_items(
        db=db,
        skip=skip,
        limit=limit,
        search=search,
        item_type=item_type,
        item_category=item_category,
        velocity_class=velocity_class,
        is_hazardous=is_hazardous,
        requires_inspection=requires_inspection,
        active_only=active_only
    )
    return items


@router.get("/{item_id}", response_model=ItemMaster)
async def read_item(
    item_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get item by ID with all details
    """
    item = await item_crud.get_item_by_id(db, item_id)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    return item


@router.get("/sku/{sku_code}", response_model=ItemMaster)
async def read_item_by_sku(
    sku_code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get item by SKU code
    """
    item = await item_crud.get_item_by_sku(db, sku_code)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    return item


@router.get("/barcode/{barcode}", response_model=ItemMaster)
async def read_item_by_barcode(
    barcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get item by primary barcode
    """
    item = await item_crud.get_item_by_barcode(db, barcode)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    return item


@router.get("/barcode/any/{barcode}", response_model=ItemMaster)
async def find_item_by_any_barcode(
    barcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Find item by any barcode (primary or alternative)
    """
    item = await item_crud.find_item_by_any_barcode(db, barcode)
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found with this barcode"
        )
    return item


@router.patch("/{item_id}", response_model=ItemMaster)
async def update_item(
    item_id: UUID,
    item_update: ItemMasterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """
    Update item details
    
    Supports partial updates - only send the fields you want to change
    """
    try:
        item = await item_crud.update_item(
            db, 
            item_id, 
            item_update,
            updated_by=current_user.username
        )
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found"
            )
        return item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: UUID,
    hard_delete: bool = Query(False, description="Hard delete (permanent) if true, soft delete if false"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """
    Delete an item
    
    - Soft delete (default): Sets active=False, keeps record in database
    - Hard delete: Permanently removes record (admin only, use with caution)
    """
    if hard_delete:
        deleted = await item_crud.hard_delete_item(db, item_id)
    else:
        deleted = await item_crud.delete_item(db, item_id, updated_by=current_user.username)
    
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    return None


# ============================================================================
# BATCH OPERATIONS
# ============================================================================

@router.post("/bulk", response_model=Dict[str, Any])
async def bulk_create_items(
    items_data: List[ItemMasterCreate],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """
    Create multiple items in bulk
    
    Returns summary with created items and any errors
    """
    result = await item_crud.bulk_create_items(
        db, 
        items_data,
        created_by=current_user.username
    )
    
    return {
        "message": f"Created {result['total_created']} items, {result['total_errors']} errors",
        "total_created": result['total_created'],
        "total_errors": result['total_errors'],
        "errors": result['errors']
    }


# ============================================================================
# VELOCITY MANAGEMENT
# ============================================================================

@router.patch("/{item_id}/velocity", response_model=ItemMaster)
async def update_item_velocity(
    item_id: UUID,
    velocity_update: ItemVelocityUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """
    Manually update item velocity class
    
    Velocity classes:
    - A: Fast movers (top 20%)
    - B: Medium movers (middle 30%)
    - C: Slow movers (bottom 50%)
    """
    item = await item_crud.update_item_velocity(
        db=db,
        item_id=item_id,
        velocity_class=velocity_update.velocity_class,
        updated_by=current_user.username,
        reason=velocity_update.reason
    )
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    
    return item


@router.post("/velocity/recalculate", response_model=Dict[str, Any])
async def recalculate_velocity(
    days: int = Query(90, description="Number of days to look back"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """
    Recalculate velocity classes for all items based on historical data
    
    This is a heavy operation that should be run as a scheduled job
    """
    result = await item_crud.calculate_velocity_for_all_items(db, days=days)
    
    return {
        "message": f"Processed {result['total_processed']} items",
        "total_processed": result['total_processed'],
        "changed": result['changed'],
        "summary": result['summary'],
        "errors": result['errors']
    }


# ============================================================================
# PICK FACE MANAGEMENT
# ============================================================================

@router.get("/pick-face/eligible", response_model=List[ItemMaster])
async def get_pick_face_eligible_items(
    velocity_class: str = Query('A', description="Filter by velocity class"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get items eligible for pick face storage
    """
    items = await item_crud.get_pick_face_eligible_items(
        db=db,
        velocity_class=velocity_class
    )
    return items


@router.patch("/{item_id}/pick-face", response_model=ItemMaster)
async def update_pick_face_config(
    item_id: UUID,
    eligible: bool = Query(..., description="Whether item is eligible for pick face"),
    capacity: Optional[float] = Query(None, description="Maximum quantity in pick face"),
    replenishment_point: Optional[float] = Query(None, description="When to replenish"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """
    Update pick face configuration for an item
    """
    item = await item_crud.update_pick_face_config(
        db=db,
        item_id=item_id,
        eligible=eligible,
        updated_by=current_user.username,
        capacity=capacity,
        replenishment_point=replenishment_point
    )
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    
    return item


# ============================================================================
# COMPATIBILITY RULES
# ============================================================================

@router.get("/{item_id}/compatible", response_model=List[ItemMaster])
async def get_compatible_items(
    item_id: UUID,
    limit: int = Query(100, description="Maximum number of items to return"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get items that are compatible with the given item
    """
    items = await item_crud.get_compatible_items(db, item_id, limit=limit)
    return items


@router.post("/compatibility/check", response_model=Dict[str, Any])
async def check_compatibility(
    item1_id: UUID,
    item2_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Check if two items can be stored together
    """
    result = await item_crud.check_compatibility(db, item1_id, item2_id)
    return result


# ============================================================================
# HAZARDOUS ITEMS
# ============================================================================

@router.get("/hazardous/list", response_model=List[ItemMaster])
async def get_hazardous_items(
    hazard_class: Optional[str] = Query(None, description="Filter by hazard class"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get all hazardous items, optionally filtered by hazard class
    """
    items = await item_crud.get_hazardous_items(
        db=db,
        hazard_class=hazard_class,
        skip=skip,
        limit=limit
    )
    return items


@router.get("/hazardous/stats", response_model=Dict[str, int])
async def get_hazardous_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get statistics about hazardous items by hazard class
    """
    stats = await item_crud.get_hazardous_items_by_class(db)
    return stats


# ============================================================================
# QUALITY/INSPECTION
# ============================================================================

@router.get("/inspection/required", response_model=List[ItemMaster])
async def get_items_requiring_inspection(
    inspection_rule: Optional[str] = Query(None, description="Filter by inspection rule (SAMPLING, FULL, NONE)"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get items that require inspection
    """
    items = await item_crud.get_items_requiring_inspection(
        db=db,
        inspection_rule=inspection_rule,
        skip=skip,
        limit=limit
    )
    return items


@router.get("/{item_id}/inspection-sample", response_model=Dict[str, Any])
async def calculate_inspection_sample(
    item_id: UUID,
    received_quantity: float,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_quality_inspector)
):
    """
    Calculate inspection sample size based on item rules
    """
    result = await item_crud.get_inspection_sample_size(
        db=db,
        item_id=item_id,
        received_quantity=received_quantity
    )
    return result


# ============================================================================
# BARCODE MANAGEMENT
# ============================================================================

@router.patch("/{item_id}/barcode", response_model=ItemMaster)
async def update_primary_barcode(
    item_id: UUID,
    barcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """
    Update primary barcode for an item
    """
    try:
        item = await item_crud.update_item_barcode(
            db=db,
            item_id=item_id,
            barcode=barcode,
            updated_by=current_user.username
        )
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found"
            )
        return item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{item_id}/barcode/alternative", response_model=ItemMaster)
async def add_alternative_barcode(
    item_id: UUID,
    barcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """
    Add an alternative barcode to an item
    """
    try:
        item = await item_crud.add_alternative_barcode(
            db=db,
            item_id=item_id,
            barcode=barcode,
            updated_by=current_user.username
        )
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found"
            )
        return item
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.delete("/{item_id}/barcode/alternative", response_model=ItemMaster)
async def remove_alternative_barcode(
    item_id: UUID,
    barcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """
    Remove an alternative barcode from an item
    """
    item = await item_crud.remove_alternative_barcode(
        db=db,
        item_id=item_id,
        barcode=barcode,
        updated_by=current_user.username
    )
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Item not found"
        )
    return item


# ============================================================================
# STATISTICS
# ============================================================================

@router.get("/statistics/summary", response_model=Dict[str, Any])
async def get_item_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Get comprehensive statistics about items
    """
    stats = await item_crud.get_item_statistics(db)
    return stats


# ============================================================================
# UOM CONVERSION
# ============================================================================

@router.post("/{item_id}/convert", response_model=Dict[str, Any])
async def convert_quantity(
    item_id: UUID,
    quantity: float,
    from_uom: str,
    to_uom: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Convert quantity between different units of measure
    
    Example: Convert 10 BOXES to EA (pieces)
    """
    try:
        result = await item_crud.convert_quantity(
            db=db,
            item_id=item_id,
            quantity=quantity,
            from_uom=from_uom,
            to_uom=to_uom
        )
        return result
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )