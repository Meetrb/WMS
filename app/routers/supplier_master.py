from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.api import deps
from app.schemas.supplier_master import SupplierMaster, SupplierMasterCreate, SupplierMasterUpdate
from app.schemas.user import User
from app.crud import supplier_master as supplier_crud
from app.db.session import get_db

router = APIRouter(prefix="/suppliers", tags=["Supplier Master"])


@router.post("/", response_model=SupplierMaster, status_code=status.HTTP_201_CREATED)
async def create_supplier(
    supplier_data: SupplierMasterCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Create a new supplier master"""
    # Check if code already exists
    existing = await supplier_crud.get_supplier_by_code(db, supplier_data.code)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Supplier with code {supplier_data.code} already exists"
        )
    
    # Check if GSTIN already exists
    if supplier_data.gstin:
        existing_gstin = await supplier_crud.get_supplier_by_gstin(db, supplier_data.gstin)
        if existing_gstin:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Supplier with GSTIN {supplier_data.gstin} already exists"
            )
    
    supplier = await supplier_crud.create_supplier(db, supplier_data)
    return supplier


@router.get("/", response_model=List[SupplierMaster])
async def read_suppliers(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    active_only: bool = True,
    search: Optional[str] = None,
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get list of suppliers"""
    suppliers = await supplier_crud.get_suppliers(
        db, 
        skip=skip, 
        limit=limit,
        active_only=active_only,
        search=search
    )
    return suppliers


@router.get("/{supplier_id}", response_model=SupplierMaster)
async def read_supplier(
    supplier_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get supplier by ID"""
    supplier = await supplier_crud.get_supplier(db, supplier_id)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )
    return supplier


@router.get("/code/{code}", response_model=SupplierMaster)
async def read_supplier_by_code(
    code: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_current_active_user)
):
    """Get supplier by code"""
    supplier = await supplier_crud.get_supplier_by_code(db, code)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )
    return supplier


@router.patch("/{supplier_id}", response_model=SupplierMaster)
async def update_supplier(
    supplier_id: UUID,
    supplier_update: SupplierMasterUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Update supplier"""
    supplier = await supplier_crud.update_supplier(db, supplier_id, supplier_update)
    if not supplier:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )
    return supplier


@router.delete("/{supplier_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_supplier(
    supplier_id: UUID,
    hard_delete: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Delete supplier (soft delete by default)"""
    deleted = await supplier_crud.delete_supplier(db, supplier_id, hard_delete)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Supplier not found"
        )
    return None