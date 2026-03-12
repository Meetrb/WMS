from pydantic import BaseModel, Field, validator
from uuid import UUID
from datetime import datetime, date, timezone
from typing import List, Optional
from decimal import Decimal

from app.schemas.item_master import ItemMaster
from app.schemas.supplier_master import SupplierMaster



# ==================== CREATE SCHEMAS (for input) ====================

class ShipmentItemCreate(BaseModel):
    sku: str
    description: str
    quantity: Decimal
    unit: str
    unitPrice: Optional[Decimal] = Field(None, alias="unit_price")
    totalPrice: Optional[Decimal] = Field(None, alias="total_price")
    lot: Optional[str] = None
    expiryDate: Optional[date] = Field(None, alias="expiry_date")
    hsnCode: Optional[str] = Field(None, alias="hsn_code")

    class Config:
        populate_by_name = True


class ShipmentCreate(BaseModel):
    poNumber: str = Field(alias="po_number")
    supplierCode: Optional[str] = Field(None, alias="supplier_code")
    items: List[ShipmentItemCreate]

    class Config:
        populate_by_name = True


class ASNCreate(BaseModel):
    asnNumber: str = Field(alias="asn_number")
    asnDate: datetime = Field(alias="asn_date")
    shipmentId: str = Field(alias="shipment_id")
    expectedDate: datetime = Field(alias="expected_date")
    status: str = "draft"
    notes: Optional[str] = None
    supplierCode: Optional[str] = Field(None, alias="supplier_code")
    shipments: List[ShipmentCreate]

    @validator('asnDate', 'expectedDate', pre=True, always=True)
    def convert_datetime_to_naive(cls, v):
        """Convert timezone-aware datetime to naive UTC datetime"""
        if v is None:
            return v
        if isinstance(v, datetime):
            if v.tzinfo is not None:
                # Convert to UTC and remove timezone info
                return v.astimezone(timezone.utc).replace(tzinfo=None)
        return v

    class Config:
        populate_by_name = True


# ==================== RESPONSE SCHEMAS (for output) ====================

class ShipmentItemResponse(BaseModel):
    id: UUID
    shipment_id: UUID
    quantity: Decimal
    unit: str
    unit_price: Optional[Decimal] = Field(None, alias="unitPrice")
    total_price: Optional[Decimal] = Field(None, alias="totalPrice")
    lot: Optional[str] = None
    expiry_date: Optional[date] = Field(None, alias="expiryDate")
    item_master: ItemMaster

    class Config:
        from_attributes = True
        populate_by_name = True


class ShipmentResponse(BaseModel):
    id: UUID
    asn_id: UUID
    po_number: str = Field(alias="poNumber")
    supplier: Optional[SupplierMaster] = None
    items: List[ShipmentItemResponse] = []

    class Config:
        from_attributes = True
        populate_by_name = True


class ASNResponse(BaseModel):
    id: UUID
    asn_number: str = Field(alias="asnNumber")
    asn_date: datetime = Field(alias="asnDate")
    shipment_id: str = Field(alias="shipmentId")
    expected_date: datetime = Field(alias="expectedDate")
    status: str
    notes: Optional[str] = None
    supplier: Optional[SupplierMaster] = None
    shipments: List[ShipmentResponse] = []
    created_by: str
    created_at: datetime
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        populate_by_name = True


class ASNListResponse(BaseModel):
    id: UUID
    asn_number: str
    asn_date: datetime
    shipment_id: str
    expected_date: datetime
    status: str
    created_by: str
    created_at: datetime

    class Config:
        from_attributes = True


# ==================== UPDATE SCHEMAS ====================

class ASNUpdate(BaseModel):
    asnNumber: Optional[str] = Field(None, alias="asn_number")
    asnDate: Optional[datetime] = Field(None, alias="asn_date")
    shipmentId: Optional[str] = Field(None, alias="shipment_id")
    expectedDate: Optional[datetime] = Field(None, alias="expected_date")
    status: Optional[str] = None
    notes: Optional[str] = None
    supplierCode: Optional[str] = Field(None, alias="supplier_code")

    @validator('asnDate', 'expectedDate', pre=True, always=True)
    def convert_datetime_to_naive(cls, v):
        """Convert timezone-aware datetime to naive UTC datetime"""
        if v is None:
            return v
        if isinstance(v, datetime):
            if v.tzinfo is not None:
                # Convert to UTC and remove timezone info
                return v.astimezone(timezone.utc).replace(tzinfo=None)
        return v

    class Config:
        populate_by_name = True