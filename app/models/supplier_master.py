from sqlalchemy import Column, String, Text, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db.base import Base


class SupplierMaster(Base):
    __tablename__ = "supplier_master"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Core Supplier Information
    code = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    gstin = Column(String(15), unique=True, nullable=True)
    contact_person = Column(String(100), nullable=True)
    phone = Column(String(20), nullable=True)
    email = Column(String(100), nullable=True)
    address = Column(Text, nullable=True)
    payment_terms = Column(String(50), nullable=True)
    
    # Status
    active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    asns = relationship("ASN", back_populates="supplier", foreign_keys="ASN.supplier_id")
    shipments = relationship("Shipment", back_populates="supplier", foreign_keys="Shipment.supplier_id")
    
    def __repr__(self):
        return f"<SupplierMaster {self.code}: {self.name}>"