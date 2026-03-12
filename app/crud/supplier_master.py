from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from typing import List, Optional
from uuid import UUID
from datetime import datetime

from app.models.supplier_master import SupplierMaster
from app.schemas.supplier_master import SupplierMasterCreate, SupplierMasterUpdate


async def get_supplier(db: AsyncSession, supplier_id: UUID) -> Optional[SupplierMaster]:
    result = await db.execute(select(SupplierMaster).where(SupplierMaster.id == supplier_id))
    return result.scalar_one_or_none()


async def get_supplier_by_code(db: AsyncSession, code: str) -> Optional[SupplierMaster]:
    result = await db.execute(select(SupplierMaster).where(SupplierMaster.code == code))
    return result.scalar_one_or_none()


async def get_supplier_by_gstin(db: AsyncSession, gstin: str) -> Optional[SupplierMaster]:
    result = await db.execute(select(SupplierMaster).where(SupplierMaster.gstin == gstin))
    return result.scalar_one_or_none()


async def get_suppliers(
    db: AsyncSession, 
    skip: int = 0, 
    limit: int = 100,
    active_only: bool = True,
    search: Optional[str] = None
) -> List[SupplierMaster]:
    query = select(SupplierMaster)
    
    if active_only:
        query = query.where(SupplierMaster.active == True)
    
    if search:
        query = query.where(
            or_(
                SupplierMaster.code.ilike(f"%{search}%"),
                SupplierMaster.name.ilike(f"%{search}%"),
                SupplierMaster.gstin.ilike(f"%{search}%")
            )
        )
    
    query = query.offset(skip).limit(limit).order_by(SupplierMaster.code)
    result = await db.execute(query)
    return result.scalars().all()


async def create_supplier(db: AsyncSession, supplier_data: SupplierMasterCreate) -> SupplierMaster:
    db_supplier = SupplierMaster(**supplier_data.dict())
    db.add(db_supplier)
    await db.commit()
    await db.refresh(db_supplier)
    return db_supplier


async def update_supplier(
    db: AsyncSession, 
    supplier_id: UUID, 
    supplier_data: SupplierMasterUpdate
) -> Optional[SupplierMaster]:
    db_supplier = await get_supplier(db, supplier_id)
    if not db_supplier:
        return None
    
    update_data = supplier_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_supplier, key, value)
    
    db_supplier.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(db_supplier)
    return db_supplier


async def delete_supplier(db: AsyncSession, supplier_id: UUID, hard_delete: bool = False) -> bool:
    db_supplier = await get_supplier(db, supplier_id)
    if not db_supplier:
        return False
    
    if hard_delete:
        await db.delete(db_supplier)
    else:
        db_supplier.active = False
        db_supplier.updated_at = datetime.utcnow()
    
    await db.commit()
    return True