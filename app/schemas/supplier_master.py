from pydantic import BaseModel, EmailStr, Field
from uuid import UUID
from datetime import datetime
from typing import Optional


class SupplierMasterBase(BaseModel):
    code: str
    name: str
    gstin: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    active: bool = True


class SupplierMasterCreate(SupplierMasterBase):
    pass


class SupplierMasterUpdate(BaseModel):
    name: Optional[str] = None
    gstin: Optional[str] = None
    contact_person: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    address: Optional[str] = None
    payment_terms: Optional[str] = None
    active: Optional[bool] = None


class SupplierMasterInDB(SupplierMasterBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SupplierMaster(SupplierMasterInDB):
    pass