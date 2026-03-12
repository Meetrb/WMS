from sqlalchemy import Column, String, Boolean, Enum, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)
    full_name = Column(String, nullable=False, default='')
    role = Column(
        Enum('admin', 'General manager', 'GRN manager', 'putaway worker', 'picker', 'packer',
             name="user_roles"),
        nullable=False,
        default='picker'
    )
    default_warehouse_id = Column(UUID(as_uuid=True), ForeignKey("warehouses.id"), nullable=True)
    is_active = Column(Boolean, default=True)
    last_login = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    default_warehouse = relationship("Warehouse", foreign_keys=[default_warehouse_id])


class UserPermissions(Base):
    __tablename__ = "user_permissions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    permission = Column(String, nullable=False)
    resource_type = Column(String, nullable=True)
    resource_id = Column(UUID(as_uuid=True), nullable=True)
    granted = Column(Boolean, default=True)
    granted_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    granted_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    
    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    grantor = relationship("User", foreign_keys=[granted_by])
    
    __table_args__ = (UniqueConstraint('user_id', 'permission', 'resource_type', 'resource_id', 
                                       name='uix_user_permission'),)