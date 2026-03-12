from pydantic import BaseModel, Field, validator
from uuid import UUID
from datetime import datetime, date, timezone
from typing import List, Optional, Dict, Any
from decimal import Decimal

from app.schemas.item_master import ItemMaster
from app.schemas.supplier_master import SupplierMaster
from app.schemas.warehouse import Warehouse
from app.schemas.user import User
from pydantic import model_validator


# ==================== ASN Shipment Item Schemas ====================

class ASNShipmentItemBase(BaseModel):
    sku: str
    description: str
    expected_quantity: Decimal = Field(alias="quantity")
    unit: str
    unit_price: Optional[Decimal] = Field(None, alias="unitPrice")
    total_price: Optional[Decimal] = Field(None, alias="totalPrice")
    lot_number: Optional[str] = Field(None, alias="lot")
    expiry_date: Optional[date] = Field(None, alias="expiryDate")
    manufacturing_date: Optional[date] = Field(None, alias="manufacturingDate")
    primary_barcode: Optional[str] = Field(None, alias="barcode")


class ASNShipmentItemCreate(ASNShipmentItemBase):
    pass

    class Config:
        populate_by_name = True


class ASNShipmentItem(ASNShipmentItemBase):
    id: UUID
    asn_shipment_id: UUID
    item_master_id: UUID
    received_quantity: Decimal
    rejected_quantity: Decimal
    is_fully_received: bool
    item_master: Optional[ItemMaster] = None

    class Config:
        from_attributes = True
        populate_by_name = True


# ==================== ASN Shipment (PO) Schemas ====================

class ASNShipmentBase(BaseModel):
    po_number: str = Field(alias="poNumber")
    supplier_code: Optional[str] = Field(None, alias="supplierCode")


class ASNShipmentCreate(ASNShipmentBase):
    items: List[ASNShipmentItemCreate]

    class Config:
        populate_by_name = True


class ASNShipment(ASNShipmentBase):
    id: UUID
    inbound_shipment_id: UUID
    supplier_id: Optional[UUID] = None
    supplier: Optional[SupplierMaster] = None
    items: List[ASNShipmentItem] = []

    class Config:
        from_attributes = True
        populate_by_name = True


# ==================== TODAY'S ARRIVED ITEM SCHEMA ====================

# class TodayArrivedItemSchema(BaseModel):
#     """Item details with barcode for today's arrived ASN"""
#     sku: str
#     description: str
#     primary_barcode: Optional[str] = Field(None, alias="barcode")
#     expected_quantity: Decimal = Field(alias="expectedQuantity")
#     received_quantity: Decimal = Field(Decimal('0'), alias="receivedQuantity")
#     accepted_quantity: Decimal = Field(Decimal('0'), alias="acceptedQuantity")
#     rejected_quantity: Decimal = Field(Decimal('0'), alias="rejectedQuantity")
#     unit: str
#     lot_number: Optional[str] = Field(None, alias="lot")
#     expiry_date: Optional[date] = Field(None, alias="expiryDate")
#     batch_no: Optional[str] = Field(None, alias="batchNo")
#     hsn_code: Optional[str] = Field(None, alias="hsnCode")
#     item_master_id: UUID
    
#     class Config:
#         populate_by_name = True
#         from_attributes = True
class TodayArrivedItemSchema(BaseModel):
    """Item details with barcode for today's arrived ASN"""
    # Add this field at the top
    asn_shipment_item_id: UUID = Field(alias="asnShipmentItemId")  # 👈 ADD THIS
    sku: str
    description: str
    primary_barcode: Optional[str] = Field(None, alias="barcode")
    expected_quantity: Decimal = Field(alias="expectedQuantity")
    received_quantity: Decimal = Field(Decimal('0'), alias="receivedQuantity")
    accepted_quantity: Decimal = Field(Decimal('0'), alias="acceptedQuantity")
    rejected_quantity: Decimal = Field(Decimal('0'), alias="rejectedQuantity")
    unit: str
    lot_number: Optional[str] = Field(None, alias="lot")
    expiry_date: Optional[date] = Field(None, alias="expiryDate")
    batch_no: Optional[str] = Field(None, alias="batchNo")
    hsn_code: Optional[str] = Field(None, alias="hsnCode")
    item_master_id: UUID
    
    class Config:
        populate_by_name = True
        from_attributes = True

class TodayArrivedShipmentSchema(BaseModel):
    """Shipment/PO details for today's arrived ASN"""
    po_number: str = Field(alias="poNumber")
    supplier_code: Optional[str] = Field(None, alias="supplierCode")
    supplier_name: Optional[str] = Field(None, alias="supplierName")
    items: List[TodayArrivedItemSchema]
    
    class Config:
        populate_by_name = True
        from_attributes = True


class TodayArrivedASNResponse(BaseModel):
    """Complete today's arrived ASN response with all details"""
    # ASN Header Information
    asn_number: str = Field(alias="asnNumber")
    asn_date: datetime = Field(alias="asnDate")
    expected_arrival_date: datetime = Field(alias="expectedDate")
    actual_arrival_date: datetime = Field(alias="actualArrivalDate")
    shipment_id: str = Field(alias="shipmentId")
    status: str
    inbound_shipment_id: UUID = Field(alias="inboundId")
    
    # Warehouse Information
    warehouse_code: str = Field(alias="warehouseCode")
    warehouse_name: Optional[str] = Field(None, alias="warehouseName")
    receiving_dock: Optional[str] = Field(None, alias="receivingDock")
    
    # Supplier Information
    supplier_code: Optional[str] = Field(None, alias="supplierCode")
    supplier_name: Optional[str] = Field(None, alias="supplierName")
    supplier_gst: Optional[str] = Field(None, alias="supplierGST")
    
    # Driver Information
    driver_name: Optional[str] = Field(None, alias="driverName")
    driver_phone: Optional[str] = Field(None, alias="driverPhone")
    vehicle_number: Optional[str] = Field(None, alias="vehicleNumber")
    
    # GRN Information (if any)
    grn_number: Optional[str] = Field(None, alias="grnNumber")
    grn_id: Optional[UUID] = Field(None, alias="grnId")
    grn_status: Optional[str] = Field(None, alias="grnStatus")
    
    # Summary Statistics
    total_items: int = 0
    total_expected_quantity: Decimal = Field(Decimal('0'), alias="totalExpectedQty")
    total_received_quantity: Decimal = Field(Decimal('0'), alias="totalReceivedQty")
    total_accepted_quantity: Decimal = Field(Decimal('0'), alias="totalAcceptedQty")
    total_rejected_quantity: Decimal = Field(Decimal('0'), alias="totalRejectedQty")
    
    # Shipments with Items
    shipments: List[TodayArrivedShipmentSchema]
    
    class Config:
        populate_by_name = True
        from_attributes = True


class TodayArrivedSummaryResponse(BaseModel):
    """Summary of today's arrived ASNs"""
    date: str
    total_arrived: int
    total_with_grn: int
    total_pending_grn: int
    total_expected_quantity: Decimal = Field(Decimal('0'), alias="totalExpectedQty")
    total_received_quantity: Decimal = Field(Decimal('0'), alias="totalReceivedQty")
    total_accepted_quantity: Decimal = Field(Decimal('0'), alias="totalAcceptedQty")
    total_rejected_quantity: Decimal = Field(Decimal('0'), alias="totalRejectedQty")
    arrived_asns: List[TodayArrivedASNResponse]
    
    class Config:
        populate_by_name = True


# ==================== EXISTING SCHEMAS (Keep all your existing schemas below) ====================

# [Keep all your existing schemas here - InboundShipmentBase, InboundShipmentCreate, 
#  InboundShipment, InboundShipmentList, ReceivingTask schemas, Inspection schemas, 
#  GRN schemas, ArrivalConfirmation schemas, etc.]

class InboundShipmentBase(BaseModel):
    asn_number: str = Field(alias="asnNumber")
    asn_date: datetime = Field(alias="asnDate")
    expected_arrival_date: datetime = Field(alias="expectedDate")
    shipment_id: str = Field(alias="shipmentId")
    warehouse_code: str = Field(alias="warehouseCode")
    supplier_code: Optional[str] = Field(None, alias="supplierCode")
    driver_name: Optional[str] = Field(None, alias="driverName")
    driver_phone: Optional[str] = Field(None, alias="driverPhone")
    vehicle_number: Optional[str] = Field(None, alias="vehicleNumber")
    receiving_dock: Optional[str] = Field(None, alias="receivingDock")
    notes: Optional[str] = None

    @validator('asn_date', 'expected_arrival_date', pre=True, always=True)
    def convert_datetime_to_naive(cls, v):
        """Convert timezone-aware datetime to naive UTC datetime"""
        if v is None:
            return v
        if isinstance(v, datetime):
            if v.tzinfo is not None:
                return v.astimezone(timezone.utc).replace(tzinfo=None)
        return v


class InboundShipmentCreate(InboundShipmentBase):
    shipments: List[ASNShipmentCreate]

    class Config:
        populate_by_name = True


class InboundShipmentUpdate(BaseModel):
    expected_arrival_date: Optional[datetime] = Field(None, alias="expectedDate")
    driver_name: Optional[str] = Field(None, alias="driverName")
    driver_phone: Optional[str] = Field(None, alias="driverPhone")
    vehicle_number: Optional[str] = Field(None, alias="vehicleNumber")
    receiving_dock: Optional[str] = Field(None, alias="receivingDock")
    notes: Optional[str] = None
    status: Optional[str] = None

    @validator('expected_arrival_date', pre=True, always=True)
    def convert_datetime_to_naive(cls, v):
        if v is None:
            return v
        if isinstance(v, datetime):
            if v.tzinfo is not None:
                return v.astimezone(timezone.utc).replace(tzinfo=None)
        return v


class InboundShipment(InboundShipmentBase):
    id: UUID
    actual_arrival_date: Optional[datetime] = None
    status: str
    warehouse: Warehouse
    supplier: Optional[SupplierMaster] = None
    shipments: List[ASNShipment] = []
    created_by: str
    created_at: datetime
    updated_by: Optional[str] = None
    updated_at: Optional[datetime] = None

    @model_validator(mode='before')
    @classmethod
    def set_warehouse_code(cls, data):
        """Set warehouse_code from warehouse relationship before validation"""
        if isinstance(data, dict):
            if 'warehouse' in data and data['warehouse']:
                if hasattr(data['warehouse'], 'code'):
                    data['warehouse_code'] = data['warehouse'].code
                elif isinstance(data['warehouse'], dict) and 'code' in data['warehouse']:
                    data['warehouse_code'] = data['warehouse']['code']
        elif hasattr(data, 'warehouse') and data.warehouse:
            data.warehouse_code = data.warehouse.code
        return data

    class Config:
        from_attributes = True
        populate_by_name = True


class InboundShipmentList(BaseModel):
    id: UUID
    asn_number: str
    asn_date: datetime
    expected_arrival_date: datetime
    actual_arrival_date: Optional[datetime] = None
    shipment_id: str
    warehouse_code: str
    supplier_name: Optional[str] = None
    status: str
    created_at: datetime
    is_arrived: bool = False
    arrival_status: str = "NOT_ARRIVED"

    @model_validator(mode='before')
    @classmethod
    def set_derived_fields(cls, data):
        """Set warehouse_code and supplier_name from relationships and calculate arrival info"""
        today = datetime.now().date()
        
        # If data is a SQLAlchemy model instance
        if not isinstance(data, dict):
            # SAFELY check if warehouse is already loaded WITHOUT triggering lazy load
            warehouse_loaded = 'warehouse' in data.__dict__
            if warehouse_loaded and data.warehouse is not None:
                data.warehouse_code = data.warehouse.code
            else:
                data.warehouse_code = None
                
            supplier_loaded = 'supplier' in data.__dict__
            if supplier_loaded and data.supplier is not None:
                data.supplier_name = data.supplier.name
            else:
                data.supplier_name = None
            
            # Calculate arrival status
            if data.actual_arrival_date:
                data.is_arrived = True
                if data.actual_arrival_date.date() == today:
                    data.arrival_status = "ARRIVED_TODAY"
                else:
                    data.arrival_status = "ARRIVED_EARLIER"
            else:
                data.is_arrived = False
                if data.expected_arrival_date and data.expected_arrival_date.date() < today:
                    data.arrival_status = "OVERDUE"
                else:
                    data.arrival_status = "NOT_ARRIVED"
            
            return data
        
        # If data is a dict (from API)
        if 'warehouse' in data and data['warehouse']:
            if isinstance(data['warehouse'], dict):
                data['warehouse_code'] = data['warehouse'].get('code', '')
            else:
                try:
                    if hasattr(data['warehouse'], 'code'):
                        data['warehouse_code'] = data['warehouse'].code
                except:
                    data['warehouse_code'] = None
        
        if 'supplier' in data and data['supplier']:
            if isinstance(data['supplier'], dict):
                data['supplier_name'] = data['supplier'].get('name')
            else:
                try:
                    if hasattr(data['supplier'], 'name'):
                        data['supplier_name'] = data['supplier'].name
                except:
                    data['supplier_name'] = None
        
        # Calculate arrival status for dict
        actual_arrival = data.get('actual_arrival_date')
        expected_arrival = data.get('expected_arrival_date')
        
        if actual_arrival:
            data['is_arrived'] = True
            if actual_arrival.date() == today:
                data['arrival_status'] = "ARRIVED_TODAY"
            else:
                data['arrival_status'] = "ARRIVED_EARLIER"
        else:
            data['is_arrived'] = False
            if expected_arrival and expected_arrival.date() < today:
                data['arrival_status'] = "OVERDUE"
            else:
                data['arrival_status'] = "NOT_ARRIVED"
        
        return data

    class Config:
        from_attributes = True
        populate_by_name = True



# ==================== TODAY ASN Response Schemas ====================

class TodayASNItemSchema(BaseModel):
    sku: str
    description: str
    expected_quantity: Decimal = Field(alias="quantity")
    received_quantity: Decimal = 0
    unit: str
    unit_price: Optional[Decimal] = None
    total_price: Optional[Decimal] = None
    lot_number: Optional[str] = Field(None, alias="lot")
    hsn_code: Optional[str] = None
    
    class Config:
        populate_by_name = True
        from_attributes = True


class TodayASNShipmentSchema(BaseModel):
    po_number: str = Field(alias="poNumber")
    supplier_code: Optional[str] = Field(None, alias="supplierCode")
    supplier_name: Optional[str] = Field(None, alias="supplierName")
    items: List[TodayASNItemSchema]
    
    class Config:
        populate_by_name = True
        from_attributes = True


class TodayASNResponse(BaseModel):
    asn_number: str = Field(alias="asnNumber")
    asn_date: datetime = Field(alias="asnDate")
    expected_arrival_date: datetime = Field(alias="expectedDate")
    actual_arrival_date: Optional[datetime] = Field(None, alias="actualArrivalDate")
    shipment_id: str = Field(alias="shipmentId")
    status: str
    warehouse_code: Optional[str] = Field(None, alias="warehouseCode")
    supplier_code: Optional[str] = Field(None, alias="supplierCode")
    supplier_name: Optional[str] = Field(None, alias="supplierName")
    driver_name: Optional[str] = Field(None, alias="driverName")
    driver_phone: Optional[str] = Field(None, alias="driverPhone")
    vehicle_number: Optional[str] = Field(None, alias="vehicleNumber")
    receiving_dock: Optional[str] = Field(None, alias="receivingDock")
    notes: Optional[str] = None
    
    # Today's specific fields
    is_arrived: bool
    arrival_time: Optional[str] = None
    arrival_status: str  # EXPECTED_TODAY, ARRIVED_TODAY, OVERDUE
    items_count: int
    total_quantity: Decimal
    
    # Nested data
    shipments: List[TodayASNShipmentSchema]
    
    class Config:
        populate_by_name = True
        from_attributes = True


class TodayASNSummaryResponse(BaseModel):
    date: str
    summary: Dict[str, Any]
    quantities: Dict[str, Any]
    expected: List[TodayASNResponse]
    arrived: List[TodayASNResponse]
    overdue: List[TodayASNResponse]


# ==================== Receiving Task Schemas ====================

class ReceivingTaskItemCreate(BaseModel):
    asn_shipment_item_id: UUID
    received_quantity: Decimal
    rejected_quantity: Decimal = 0
    rejection_reason: Optional[str] = None


class ReceivingTaskCreate(BaseModel):
    inbound_shipment_id: UUID
    assigned_to_id: Optional[UUID] = Field(None, alias="assignedToId")
    items: List[ReceivingTaskItemCreate]


class ReceivingTaskItem(BaseModel):
    id: UUID
    receiving_task_id: UUID
    asn_shipment_item_id: UUID
    received_quantity: Decimal
    rejected_quantity: Decimal
    rejection_reason: Optional[str]
    asn_shipment_item: Optional[ASNShipmentItem] = None

    class Config:
        from_attributes = True


class ReceivingTask(BaseModel):
    id: UUID
    task_number: str
    inbound_shipment_id: UUID
    assigned_to_id: Optional[UUID]
    assigned_to: Optional[User]
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    status: str
    items: List[ReceivingTaskItem]
    inbound_shipment: Optional[InboundShipmentList]

    class Config:
        from_attributes = True


# ==================== Inspection Schemas ====================

class InspectionDetailCreate(BaseModel):
    asn_shipment_item_id: UUID
    inspected_quantity: Decimal
    passed_quantity: Decimal
    rejected_quantity: Decimal
    rejection_reason: Optional[str] = None


class InspectionRecordCreate(BaseModel):
    inbound_shipment_id: UUID
    inspection_type: str
    inspector_id: Optional[UUID]
    details: List[InspectionDetailCreate]


class InspectionDetail(BaseModel):
    id: UUID
    inspection_id: UUID
    asn_shipment_item_id: UUID
    inspected_quantity: Decimal
    passed_quantity: Decimal
    rejected_quantity: Decimal
    rejection_reason: Optional[str]
    asn_shipment_item: Optional[ASNShipmentItem] = None

    class Config:
        from_attributes = True


class InspectionRecord(BaseModel):
    id: UUID
    inbound_shipment_id: UUID
    inspection_type: str
    inspector_id: Optional[UUID]
    inspector: Optional[User]
    inspection_date: datetime
    status: str
    comments: Optional[str]
    details: List[InspectionDetail]

    class Config:
        from_attributes = True


# ==================== GRN Schemas ====================

class GRNItemCreate(BaseModel):
    asn_shipment_item_id: UUID
    received_quantity: Decimal
    accepted_quantity: Decimal
    rejected_quantity: Decimal


class GRNCreate(BaseModel):
    inbound_shipment_id: UUID
    items: List[GRNItemCreate]


class GRNItem(BaseModel):
    id: UUID
    grn_id: UUID
    asn_shipment_item_id: UUID
    received_quantity: Decimal
    accepted_quantity: Decimal
    rejected_quantity: Decimal
    
    # Remove the nested relationship entirely
    # asn_shipment_item: Optional[ASNShipmentItem] = None  # ❌ DELETE THIS LINE

    class Config:
        from_attributes = True
        populate_by_name = True


class GRNSimpleResponse(BaseModel):
    """Simplified GRN response without relationships"""
    id: UUID
    grn_number: str
    inbound_shipment_id: UUID
    grn_date: datetime
    created_by_id: UUID
    status: str
    putaway_tasks_generated: bool = False
    putaway_tasks_generated_at: Optional[datetime] = None

    class Config:
        from_attributes = True
        populate_by_name = True


class GRN(BaseModel):
    id: UUID
    grn_number: str
    inbound_shipment_id: UUID
    grn_date: datetime
    created_by_id: UUID
    created_by: Optional[User] = None
    status: str
    putaway_tasks_generated: bool = False
    putaway_tasks_generated_at: Optional[datetime] = None
    items: List[GRNItem] = []
    
    # Make inbound_shipment optional to avoid lazy loading
    inbound_shipment: Optional[InboundShipmentList] = None

    class Config:
        from_attributes = True
        populate_by_name = True


# ==================== Arrival Confirmation Schemas ====================

class ArrivalConfirmation(BaseModel):
    actual_arrival_date: datetime = Field(default_factory=datetime.utcnow)
    receiving_dock: Optional[str] = None
    driver_name: Optional[str] = None
    driver_phone: Optional[str] = None
    vehicle_number: Optional[str] = None
    notes: Optional[str] = None


class ArrivalConfirmationWithWarehouse(ArrivalConfirmation):
    """Extended arrival confirmation that includes warehouse code"""
    warehouse_code: str


# ==================== Response Schema with creation info ====================

class InboundShipmentResponse(BaseModel):
    shipment: InboundShipment
    new_suppliers: List[str] = []
    new_items: List[str] = []
    updated_items: List[dict] = []
    warnings: List[str] = []

    class Config:
        from_attributes = True