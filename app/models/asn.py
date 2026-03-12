from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, Date, Numeric
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db.base import Base


class ASN(Base):
    __tablename__ = "asns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asn_number = Column(String(50), unique=True, index=True, nullable=False)
    asn_date = Column(DateTime, nullable=False, default=datetime.utcnow)
    shipment_id = Column(String(50), nullable=False)
    expected_date = Column(DateTime, nullable=False)
    status = Column(String(20), nullable=False, default="draft")
    notes = Column(Text, nullable=True)
    
    # Reference to Supplier Master
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier_master.id"), nullable=True)
    
    # Audit fields
    created_by = Column(String(100), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_by = Column(String(100), nullable=True)
    updated_at = Column(DateTime, nullable=True, onupdate=datetime.utcnow)
    
    # Relationships
    shipments = relationship("Shipment", back_populates="asn", cascade="all, delete-orphan")
    supplier = relationship("SupplierMaster", foreign_keys=[supplier_id], back_populates="asns")


class Shipment(Base):
    __tablename__ = "shipments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    asn_id = Column(UUID(as_uuid=True), ForeignKey("asns.id", ondelete="CASCADE"), nullable=False)
    po_number = Column(String(50), nullable=False)
    
    # Reference to Supplier Master for this specific shipment
    supplier_id = Column(UUID(as_uuid=True), ForeignKey("supplier_master.id"), nullable=True)
    
    # Relationships
    asn = relationship("ASN", back_populates="shipments")
    supplier = relationship("SupplierMaster", foreign_keys=[supplier_id], back_populates="shipments")
    items = relationship("ShipmentItem", back_populates="shipment", cascade="all, delete-orphan")


class ShipmentItem(Base):
    __tablename__ = "shipment_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    shipment_id = Column(UUID(as_uuid=True), ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False)
    
    # Reference to Item Master
    item_master_id = Column(UUID(as_uuid=True), ForeignKey("item_master.id"), nullable=False)
    
    # ASN-specific details
    quantity = Column(Numeric(18, 3), nullable=False)
    unit = Column(String(20), nullable=False)
    unit_price = Column(Numeric(18, 4), nullable=True)
    total_price = Column(Numeric(18, 4), nullable=True)
    lot = Column(String(50), nullable=True)
    expiry_date = Column(Date, nullable=True)
    
    # Relationships
    shipment = relationship("Shipment", back_populates="items")
    item_master = relationship("ItemMaster", foreign_keys=[item_master_id], back_populates="shipment_items")