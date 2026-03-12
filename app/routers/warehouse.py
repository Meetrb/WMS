from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from decimal import Decimal

from app.api import deps
from app.schemas.warehouse import (
    Warehouse, WarehouseCreate, WarehouseUpdate, WarehouseWithDetails,
    Zone, ZoneCreate, ZoneUpdate, ZoneWithBins, ZoneStatistics,
    Bin, BinCreate, BinUpdate, BinContentUpdate, BinWithHistory,
    BinHistory
)
from app.schemas.user import User
from app.crud import warehouse as warehouse_crud
from app.db.session import get_db

router = APIRouter(tags=["Warehouse Master"])


# ============================================================================
# WAREHOUSE ENDPOINTS
# ============================================================================

warehouse_router = APIRouter(prefix="/warehouses")


@warehouse_router.post("/", response_model=Warehouse, status_code=status.HTTP_201_CREATED)
async def create_warehouse(
    warehouse_data: WarehouseCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Create a new warehouse"""
    existing = await warehouse_crud.get_warehouse_by_code(db, warehouse_data.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Warehouse with code {warehouse_data.code} already exists"
        )
    return await warehouse_crud.create_warehouse(db, warehouse_data)


@warehouse_router.get("/", response_model=List[Warehouse])
async def read_warehouses(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    active_only: bool = True,
    search: Optional[str] = None,
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get list of warehouses with optional search"""
    return await warehouse_crud.get_warehouses(
        db, skip=skip, limit=limit, active_only=active_only, search=search
    )


@warehouse_router.get("/{warehouse_id}", response_model=WarehouseWithDetails)
async def read_warehouse(
    warehouse_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get warehouse by ID with zones and bins"""
    warehouse = await warehouse_crud.get_warehouse(db, warehouse_id)
    if not warehouse:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return warehouse


@warehouse_router.get("/code/{code}", response_model=WarehouseWithDetails)
async def read_warehouse_by_code(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get warehouse by code"""
    warehouse = await warehouse_crud.get_warehouse_by_code(db, code)
    if not warehouse:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return warehouse


@warehouse_router.patch("/{warehouse_id}", response_model=Warehouse)
async def update_warehouse(
    warehouse_id: UUID,
    warehouse_update: WarehouseUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Update warehouse"""
    warehouse = await warehouse_crud.update_warehouse(db, warehouse_id, warehouse_update)
    if not warehouse:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return warehouse


@warehouse_router.delete("/{warehouse_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_warehouse(
    warehouse_id: UUID,
    hard_delete: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Delete warehouse (soft delete by default)"""
    deleted = await warehouse_crud.delete_warehouse(db, warehouse_id, hard_delete)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return None


@warehouse_router.get("/{warehouse_id}/statistics", response_model=Dict[str, Any])
async def get_warehouse_statistics(
    warehouse_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get comprehensive statistics for a warehouse"""
    stats = await warehouse_crud.get_warehouse_statistics(db, warehouse_id)
    if not stats:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Warehouse not found")
    return stats


# ============================================================================
# ZONE ENDPOINTS
# ============================================================================

zone_router = APIRouter(prefix="/zones")


@zone_router.post("/", response_model=Zone, status_code=status.HTTP_201_CREATED)
async def create_zone(
    zone_data: ZoneCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Create a new zone within a warehouse"""
    try:
        return await warehouse_crud.create_zone(db, zone_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@zone_router.get("/warehouse/{warehouse_id}", response_model=List[Zone])
async def read_zones_by_warehouse(
    warehouse_id: UUID,
    zone_type: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get all zones for a warehouse"""
    return await warehouse_crud.get_zones_by_warehouse(
        db, warehouse_id, zone_type=zone_type, active_only=active_only
    )


@zone_router.get("/{zone_id}", response_model=ZoneWithBins)
async def read_zone(
    zone_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get zone by ID with its bins"""
    zone = await warehouse_crud.get_zone(db, zone_id)
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")
    return zone


@zone_router.patch("/{zone_id}", response_model=Zone)
async def update_zone(
    zone_id: UUID,
    zone_update: ZoneUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Update zone"""
    zone = await warehouse_crud.update_zone(db, zone_id, zone_update)
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")
    return zone


@zone_router.delete("/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_zone(
    zone_id: UUID,
    hard_delete: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Delete zone (soft delete by default; blocked if bins exist unless hard_delete)"""
    deleted = await warehouse_crud.delete_zone(db, zone_id, hard_delete)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Zone not found or cannot be deleted (contains bins). Use hard_delete=true to force."
        )
    return None


@zone_router.get("/{zone_id}/statistics", response_model=Dict[str, Any])
async def get_zone_statistics(
    zone_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get statistics for a specific zone"""
    stats = await warehouse_crud.get_zone_statistics(db, zone_id)
    if not stats:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Zone not found")
    return stats


# ============================================================================
# BIN ENDPOINTS
# ============================================================================

bin_router = APIRouter(prefix="/bins")


@bin_router.post("/", response_model=Bin, status_code=status.HTTP_201_CREATED)
async def create_bin(
    bin_data: BinCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Create a new bin"""
    try:
        return await warehouse_crud.create_bin(db, bin_data)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@bin_router.post("/bulk", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def bulk_create_bins(
    warehouse_id: UUID,
    bin_configs: List[Dict[str, Any]],
    zone_id: Optional[UUID] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Create multiple bins in bulk (e.g., for a new rack or aisle)"""
    result = await warehouse_crud.bulk_create_bins(
        db, warehouse_id, zone_id, bin_configs, created_by=current_user.email
    )
    return result


@bin_router.get("/", response_model=List[Bin])
async def read_bins(
    warehouse_id: Optional[UUID] = None,
    zone_id: Optional[UUID] = None,
    bin_type: Optional[str] = None,
    status: Optional[str] = None,
    is_empty: Optional[bool] = None,
    item_id: Optional[UUID] = None,
    active_only: bool = True,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get bins with optional filters"""
    return await warehouse_crud.get_bins(
        db,
        warehouse_id=warehouse_id,
        zone_id=zone_id,
        bin_type=bin_type,
        status=status,
        is_empty=is_empty,
        item_id=item_id,
        active_only=active_only,
        skip=skip,
        limit=limit
    )


@bin_router.get("/{bin_id}", response_model=BinWithHistory)
async def read_bin(
    bin_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get bin by ID"""
    bin_ = await warehouse_crud.get_bin(db, bin_id)
    if not bin_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found")
    return bin_


@bin_router.get("/barcode/{barcode}", response_model=Bin)
async def read_bin_by_barcode(
    barcode: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get bin by barcode scan"""
    bin_ = await warehouse_crud.get_bin_by_barcode(db, barcode)
    if not bin_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found")
    return bin_


@bin_router.get("/warehouse/{warehouse_id}/code/{code}", response_model=Bin)
async def read_bin_by_code(
    warehouse_id: UUID,
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get bin by warehouse and bin code"""
    bin_ = await warehouse_crud.get_bin_by_code(db, warehouse_id, code)
    if not bin_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found")
    return bin_


@bin_router.patch("/{bin_id}", response_model=Bin)
async def update_bin(
    bin_id: UUID,
    bin_update: BinUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Update bin details"""
    try:
        bin_ = await warehouse_crud.update_bin(db, bin_id, bin_update)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not bin_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found")
    return bin_


@bin_router.delete("/{bin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_bin(
    bin_id: UUID,
    hard_delete: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Delete bin (soft delete by default; blocked if non-empty unless hard_delete)"""
    try:
        deleted = await warehouse_crud.delete_bin(db, bin_id, hard_delete)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found")
    return None


# ---- Bin Content Operations ----

@bin_router.post("/{bin_id}/contents", response_model=Bin)
async def update_bin_contents(
    bin_id: UUID,
    content_update: BinContentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """
    Update bin contents via ADD / REMOVE / SET operation.
    Used for putaway and picking transactions.
    """
    try:
        bin_ = await warehouse_crud.update_bin_contents(
            db,
            bin_id,
            content_update,
            changed_by_id=current_user.id,
            changed_by_name=current_user.full_name or current_user.email
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not bin_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found")
    return bin_


# ---- Bin Reservation ----

@bin_router.post("/{bin_id}/reserve", response_model=Bin)
async def reserve_bin(
    bin_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Reserve an empty bin for an incoming putaway"""
    try:
        bin_ = await warehouse_crud.reserve_bin(db, bin_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    if not bin_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found")
    return bin_


@bin_router.post("/{bin_id}/unreserve", response_model=Bin)
async def unreserve_bin(
    bin_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Release reservation on a bin"""
    bin_ = await warehouse_crud.unreserve_bin(db, bin_id)
    if not bin_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found")
    return bin_


# ---- Bin Blocking ----

@bin_router.post("/{bin_id}/block", response_model=Bin)
async def block_bin(
    bin_id: UUID,
    reason: str = Query(..., description="Reason for blocking the bin"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Block a bin (maintenance, damage, QC hold, etc.)"""
    bin_ = await warehouse_crud.block_bin(db, bin_id, reason)
    if not bin_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found")
    return bin_


@bin_router.post("/{bin_id}/unblock", response_model=Bin)
async def unblock_bin(
    bin_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Unblock a bin and return it to ACTIVE status"""
    bin_ = await warehouse_crud.unblock_bin(db, bin_id)
    if not bin_:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found")
    return bin_


# ---- Bin Statistics & History ----

@bin_router.get("/{bin_id}/statistics", response_model=Dict[str, Any])
async def get_bin_statistics(
    bin_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get statistics and recent activity for a bin"""
    stats = await warehouse_crud.get_bin_statistics(db, bin_id)
    if not stats:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bin not found")
    return stats


@bin_router.get("/{bin_id}/history", response_model=List[BinHistory])
async def get_bin_history(
    bin_id: UUID,
    limit: int = Query(100, ge=1, le=500),
    change_type: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get movement history for a bin"""
    return await warehouse_crud.get_bin_history(db, bin_id, limit=limit, change_type=change_type)


# ---- Bulk Status Update ----

@bin_router.patch("/bulk/status", response_model=Dict[str, int])
async def bulk_update_bin_status(
    bin_ids: List[UUID],
    status: str = Query(..., description="Target status: ACTIVE, BLOCKED, INACTIVE"),
    reason: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Update status for multiple bins at once"""
    updated = await warehouse_crud.bulk_update_bin_status(
        db, bin_ids, status, reason=reason, updated_by=current_user.email
    )
    return {"updated_count": updated}


# ---- Putaway & Picking Suggestions ----

@bin_router.get("/suggest/putaway", response_model=Optional[Bin])
async def suggest_putaway_bin(
    warehouse_id: UUID,
    item_id: UUID,
    quantity: Decimal = Query(..., gt=0),
    lot_number: Optional[str] = None,
    batch_number: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Suggest the best bin for a putaway operation"""
    try:
        bin_ = await warehouse_crud.suggest_bin_for_putaway(
            db, warehouse_id, item_id, quantity,
            lot_number=lot_number, batch_number=batch_number
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    return bin_


@bin_router.get("/suggest/picking", response_model=List[Bin])
async def suggest_picking_bins(
    warehouse_id: UUID,
    item_id: UUID,
    quantity: Decimal = Query(..., gt=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Suggest bins to pick from, ordered by optimal picking sequence"""
    return await warehouse_crud.suggest_picking_location(db, item_id, quantity, warehouse_id)


# ---- Item History (cross-bin) ----

@bin_router.get("/item/{item_id}/history", response_model=List[BinHistory])
async def get_item_bin_history(
    item_id: UUID,
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get movement history of an item across all bins"""
    return await warehouse_crud.get_item_history(db, item_id, limit=limit)


# ---- Maintenance ----

@bin_router.post("/maintenance/cleanup-reservations", response_model=Dict[str, int])
async def cleanup_stale_reservations(
    warehouse_id: Optional[UUID] = None,
    hours_threshold: int = Query(24, ge=1, description="Clear reservations older than this many hours"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Clear stale bin reservations that were never fulfilled"""
    cleared = await warehouse_crud.cleanup_empty_reserved_bins(
        db, warehouse_id=warehouse_id, hours_threshold=hours_threshold
    )
    return {"cleared_count": cleared}


# ============================================================================
# REGISTER ALL SUB-ROUTERS
# ============================================================================

router.include_router(warehouse_router)
router.include_router(zone_router)
router.include_router(bin_router)