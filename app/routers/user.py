from typing import List
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.api import deps
from app.schemas.user import (
    User, UserCreate, UserUpdate, UserPermission, 
    UserPermissionCreate, UserPermissionUpdate
)
from app.crud import user as user_crud
from app.db.session import get_db

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=User)
async def read_user_me(
    current_user: User = Depends(deps.get_current_active_user),
    db: AsyncSession = Depends(get_db)  # Add this line
):
    """Get current user info"""
    # Get permissions
    permissions = await user_crud.get_user_permissions(db, current_user.id)
    current_user.permissions = permissions
    return current_user


@router.get("/", response_model=List[User])
async def read_users(
    db: AsyncSession = Depends(get_db),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    active_only: bool = True,
    current_user: User = Depends(deps.get_admin_user)
):
    """Get all users (admin only)"""
    users = await user_crud.get_users(db, skip=skip, limit=limit, active_only=active_only)
    return users


@router.get("/{user_id}", response_model=User)
async def read_user(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Get user by ID (admin only)"""
    user = await user_crud.get_user(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Get permissions
    permissions = await user_crud.get_user_permissions(db, user_id)
    user.permissions = permissions
    return user


@router.post("/", response_model=User, status_code=status.HTTP_201_CREATED)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Create new user (admin only)"""
    # Check if username exists
    existing = await user_crud.get_user_by_username(db, user_data.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    
    # Check if email exists
    existing_email = await user_crud.get_user_by_email(db, user_data.email)
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    user = await user_crud.create_user(db, user_data)
    return user


@router.patch("/{user_id}", response_model=User)
async def update_user(
    user_id: UUID,
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Update user (admin only)"""
    # Prevent updating yourself to inactive
    if user_id == current_user.id and user_update.is_active == False:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot deactivate your own account"
        )
    
    updated_user = await user_crud.update_user(db, user_id, user_update)
    if not updated_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return updated_user


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: UUID,
    hard_delete: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Delete user (admin only)"""
    # Prevent deleting yourself
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    deleted = await user_crud.delete_user(db, user_id, hard_delete)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return None


# User Permissions endpoints
@router.get("/{user_id}/permissions", response_model=List[UserPermission])
async def read_user_permissions(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Get all permissions for a user"""
    permissions = await user_crud.get_user_permissions(db, user_id)
    return permissions


@router.post("/{user_id}/permissions", response_model=UserPermission)
async def create_user_permission(
    user_id: UUID,
    permission_data: UserPermissionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Create a permission for a user"""
    # Ensure user_id in path matches permission data
    permission_data.user_id = user_id
    
    permission = await user_crud.create_user_permission(
        db, 
        permission_data, 
        granted_by=current_user.id
    )
    return permission


@router.patch("/permissions/{permission_id}", response_model=UserPermission)
async def update_user_permission(
    permission_id: UUID,
    permission_update: UserPermissionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Update a permission"""
    permission = await user_crud.update_user_permission(
        db, 
        permission_id, 
        permission_update
    )
    if not permission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    return permission


@router.delete("/permissions/{permission_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user_permission(
    permission_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(deps.get_admin_user)
):
    """Delete a permission"""
    deleted = await user_crud.delete_user_permission(db, permission_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Permission not found"
        )
    return None