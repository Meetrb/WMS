from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID
from datetime import datetime, date

from app.api import deps
from app.schemas.asn import ASNCreate, ASNUpdate, ASNResponse, ASNListResponse
from app.schemas.user import User
from app.crud import asn as asn_crud
from app.db.session import get_db

router = APIRouter(prefix="/asn", tags=["ASN"])


@router.post("/", response_model=ASNResponse, status_code=status.HTTP_201_CREATED)
async def create_asn(
    asn_data: ASNCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_grn_manager_user)
):
    """
    Create a new ASN with all shipments and items
    Integrates with Item Master and Supplier Master
    
    The endpoint automatically handles timezone conversion:
    - All datetime fields are converted to naive UTC before saving
    - Supports ISO format dates with timezone (e.g., 2026-02-27T16:30:00+05:30)
    """
    # Check if ASN number already exists
    existing_asn = await asn_crud.get_asn_by_number(db, asn_data.asnNumber)
    if existing_asn:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ASN with number {asn_data.asnNumber} already exists"
        )
    
    try:
        # Create ASN
        new_asn, result_info = await asn_crud.create_asn(
            db=db,
            asn_data=asn_data,
            created_by=current_user.username
        )
        
        return new_asn
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error creating ASN: {str(e)}"
        )


@router.get("/", response_model=List[ASNListResponse])
async def read_asns(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = Query(None, description="Filter by status (draft, in_transit, received, cancelled)"),
    from_date: Optional[datetime] = Query(None, description="Filter by expected date from"),
    to_date: Optional[datetime] = Query(None, description="Filter by expected date to"),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get list of ASNs with optional filters"""
    asns = await asn_crud.get_asns(
        db=db,
        skip=skip,
        limit=limit,
        status=status,
        from_date=from_date,
        to_date=to_date
    )
    return asns


@router.get("/search", response_model=List[ASNListResponse])
async def search_asns(
    q: str = Query(..., min_length=3, description="Search term for ASN number or shipment ID"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Search ASNs by ASN number or shipment ID"""
    asns = await asn_crud.search_asns(db, q)
    return asns


@router.get("/{asn_id}", response_model=ASNResponse)
async def read_asn(
    asn_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get ASN by ID with all details including shipments and items"""
    asn = await asn_crud.get_asn_by_id(db, asn_id)
    if not asn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ASN not found"
        )
    return asn


@router.get("/number/{asn_number}", response_model=ASNResponse)
async def read_asn_by_number(
    asn_number: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get ASN by ASN number with all details"""
    asn = await asn_crud.get_asn_by_number(db, asn_number)
    if not asn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ASN not found"
        )
    return asn


@router.patch("/{asn_id}", response_model=ASNResponse)
async def update_asn(
    asn_id: UUID,
    asn_update: ASNUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_grn_manager_user)
):
    """Update ASN details"""
    # Check if ASN exists
    existing_asn = await asn_crud.get_asn_by_id(db, asn_id)
    if not existing_asn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ASN not found"
        )
    
    # If updating ASN number, check if new number is already used
    if asn_update.asnNumber and asn_update.asnNumber != existing_asn.asn_number:
        duplicate = await asn_crud.get_asn_by_number(db, asn_update.asnNumber)
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"ASN with number {asn_update.asnNumber} already exists"
            )
    
    updated_asn = await asn_crud.update_asn(
        db=db,
        asn_id=asn_id,
        asn_update=asn_update,
        updated_by=current_user.username
    )
    
    if not updated_asn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ASN not found"
        )
    
    return updated_asn


@router.patch("/{asn_id}/status", response_model=ASNResponse)
async def update_asn_status(
    asn_id: UUID,
    status: str = Query(..., pattern="^(draft|in_transit|received|cancelled)$"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_grn_manager_user)
):
    """Update ASN status only"""
    asn = await asn_crud.update_asn_status(
        db=db,
        asn_id=asn_id,
        status=status,
        updated_by=current_user.username
    )
    
    if not asn:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ASN not found"
        )
    
    return asn


@router.delete("/{asn_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_asn(
    asn_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Delete an ASN and all related records (admin only)"""
    deleted = await asn_crud.delete_asn(db, asn_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="ASN not found"
        )
    
    return None


@router.get("/statistics/summary", response_model=dict)
async def get_asn_statistics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get statistics about ASNs (total, by status, expected today)"""
    stats = await asn_crud.get_asn_statistics(db)
    return stats


@router.get("/date-range/{start_date}/{end_date}", response_model=List[ASNListResponse])
async def get_asns_by_date_range(
    start_date: date,
    end_date: date,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get ASNs within a date range based on expected date"""
    if start_date > end_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start date cannot be after end date"
        )
    
    asns = await asn_crud.get_asns_by_date_range(db, start_date, end_date)
    return asns