from pydantic import BaseModel, EmailStr
from uuid import UUID
from datetime import datetime
from typing import Optional, List


class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: str
    role: str
    default_warehouse_id: Optional[UUID] = None
    is_active: bool = True


class UserCreate(BaseModel):
    email: EmailStr
    username: str
    password: str
    full_name: str
    role: str = "picker"
    default_warehouse_id: Optional[UUID] = None


class UserUpdate(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = None
    full_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    default_warehouse_id: Optional[UUID] = None
    is_active: Optional[bool] = None


class UserLogin(BaseModel):
    username: str
    password: str


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[UUID] = None


class UserPermissionBase(BaseModel):
    permission: str
    resource_type: Optional[str] = None
    resource_id: Optional[UUID] = None
    granted: bool = True
    expires_at: Optional[datetime] = None


class UserPermissionCreate(UserPermissionBase):
    user_id: UUID


class UserPermissionUpdate(BaseModel):
    granted: Optional[bool] = None
    expires_at: Optional[datetime] = None


class UserPermission(UserPermissionBase):
    id: UUID
    user_id: UUID
    granted_by: Optional[UUID] = None
    granted_at: datetime

    class Config:
        from_attributes = True


class UserInDB(UserBase):
    id: UUID
    last_login: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class User(UserInDB):
    permissions: List[UserPermission] = []