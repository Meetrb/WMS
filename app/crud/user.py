from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, update
from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timedelta

from app.models.user import User, UserPermissions
from app.schemas.user import UserCreate, UserUpdate, UserPermissionCreate, UserPermissionUpdate
from app.core.security import get_password_hash, verify_password


# ============================================================================
# USER CRUD OPERATIONS
# ============================================================================

async def get_user(db: AsyncSession, user_id: UUID) -> Optional[User]:
    """Get user by ID"""
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> Optional[User]:
    """Alias for get_user - Get user by ID"""
    return await get_user(db, user_id)


async def get_user_by_username(db: AsyncSession, username: str) -> Optional[User]:
    """Get user by username"""
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def get_user_by_email(db: AsyncSession, email: str) -> Optional[User]:
    """Get user by email"""
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_email_or_username(db: AsyncSession, identifier: str) -> Optional[User]:
    """Get user by email or username"""
    result = await db.execute(
        select(User).where(
            or_(User.username == identifier, User.email == identifier)
        )
    )
    return result.scalar_one_or_none()


async def get_users(
    db: AsyncSession, 
    skip: int = 0, 
    limit: int = 100,
    active_only: bool = True,
    role: Optional[str] = None,
    search: Optional[str] = None
) -> List[User]:
    """
    Get list of users with optional filters
    
    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        active_only: Return only active users
        role: Filter by user role
        search: Search by username, email, or full name
    """
    query = select(User)
    
    if active_only:
        query = query.where(User.is_active == True)
    
    if role:
        query = query.where(User.role == role)
    
    if search:
        search_term = f"%{search}%"
        query = query.where(
            or_(
                User.username.ilike(search_term),
                User.email.ilike(search_term),
                User.full_name.ilike(search_term)
            )
        )
    
    query = query.offset(skip).limit(limit).order_by(User.username)
    result = await db.execute(query)
    return result.scalars().all()


async def create_user(db: AsyncSession, user_data: UserCreate) -> User:
    """Create a new user"""
    # Check if username already exists
    existing_username = await get_user_by_username(db, user_data.username)
    if existing_username:
        raise ValueError(f"Username '{user_data.username}' already exists")
    
    # Check if email already exists
    existing_email = await get_user_by_email(db, user_data.email)
    if existing_email:
        raise ValueError(f"Email '{user_data.email}' already exists")
    
    user_dict = user_data.dict()
    password = user_dict.pop('password')
    hashed_password = get_password_hash(password)
    
    db_user = User(
        **user_dict,
        password=hashed_password,
        created_at=datetime.utcnow()
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user


async def update_user(
    db: AsyncSession, 
    user_id: UUID, 
    user_data: UserUpdate,
    updated_by: Optional[str] = None
) -> Optional[User]:
    """Update user"""
    db_user = await get_user(db, user_id)
    if not db_user:
        return None
    
    update_data = user_data.dict(exclude_unset=True)
    
    # Check username uniqueness if being updated
    if 'username' in update_data and update_data['username'] != db_user.username:
        existing = await get_user_by_username(db, update_data['username'])
        if existing:
            raise ValueError(f"Username '{update_data['username']}' already exists")
    
    # Check email uniqueness if being updated
    if 'email' in update_data and update_data['email'] != db_user.email:
        existing = await get_user_by_email(db, update_data['email'])
        if existing:
            raise ValueError(f"Email '{update_data['email']}' already exists")
    
    # Hash password if it's being updated
    if 'password' in update_data:
        update_data['password'] = get_password_hash(update_data['password'])
    
    for key, value in update_data.items():
        setattr(db_user, key, value)
    
    db_user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(db_user)
    return db_user


async def delete_user(db: AsyncSession, user_id: UUID, hard_delete: bool = False) -> bool:
    """Delete user (soft delete by default)"""
    db_user = await get_user(db, user_id)
    if not db_user:
        return False
    
    if hard_delete:
        await db.delete(db_user)
    else:
        db_user.is_active = False
        db_user.updated_at = datetime.utcnow()
    
    await db.commit()
    return True


async def authenticate_user(db: AsyncSession, username: str, password: str) -> Optional[User]:
    """Authenticate user by username/email and password"""
    user = await get_user_by_email_or_username(db, username)
    if not user:
        return None
    
    if not verify_password(password, user.password):
        return None
    
    return user


async def update_last_login(db: AsyncSession, user_id: UUID) -> None:
    """Update user's last login timestamp"""
    db_user = await get_user(db, user_id)
    if db_user:
        db_user.last_login = datetime.utcnow()
        await db.commit()


async def change_password(
    db: AsyncSession,
    user_id: UUID,
    old_password: str,
    new_password: str
) -> bool:
    """Change user password"""
    db_user = await get_user(db, user_id)
    if not db_user:
        return False
    
    # Verify old password
    if not verify_password(old_password, db_user.password):
        return False
    
    # Set new password
    db_user.password = get_password_hash(new_password)
    db_user.updated_at = datetime.utcnow()
    await db.commit()
    
    return True


async def get_users_by_role(db: AsyncSession, role: str, active_only: bool = True) -> List[User]:
    """Get all users with a specific role"""
    query = select(User).where(User.role == role)
    
    if active_only:
        query = query.where(User.is_active == True)
    
    result = await db.execute(query.order_by(User.username))
    return result.scalars().all()


async def get_user_count(db: AsyncSession, active_only: bool = True) -> int:
    """Get total number of users"""
    from sqlalchemy import func
    
    query = select(func.count()).select_from(User)
    if active_only:
        query = query.where(User.is_active == True)
    
    result = await db.execute(query)
    return result.scalar() or 0


# ============================================================================
# USER PERMISSIONS CRUD
# ============================================================================

async def get_user_permissions(db: AsyncSession, user_id: UUID) -> List[UserPermissions]:
    """Get all permissions for a user"""
    result = await db.execute(
        select(UserPermissions)
        .where(UserPermissions.user_id == user_id)
        .order_by(UserPermissions.permission)
    )
    return result.scalars().all()


async def get_permission_by_id(db: AsyncSession, permission_id: UUID) -> Optional[UserPermissions]:
    """Get a permission by ID"""
    result = await db.execute(
        select(UserPermissions).where(UserPermissions.id == permission_id)
    )
    return result.scalar_one_or_none()


async def create_user_permission(
    db: AsyncSession, 
    permission_data: UserPermissionCreate,
    granted_by: UUID
) -> UserPermissions:
    """Create a new permission for a user"""
    # Check if permission already exists
    existing = await db.execute(
        select(UserPermissions).where(
            UserPermissions.user_id == permission_data.user_id,
            UserPermissions.permission == permission_data.permission,
            UserPermissions.resource_type == permission_data.resource_type,
            UserPermissions.resource_id == permission_data.resource_id
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("Permission already exists for this user")
    
    db_permission = UserPermissions(
        **permission_data.dict(),
        granted_by=granted_by,
        granted_at=datetime.utcnow()
    )
    db.add(db_permission)
    await db.commit()
    await db.refresh(db_permission)
    return db_permission


async def update_user_permission(
    db: AsyncSession,
    permission_id: UUID,
    permission_data: UserPermissionUpdate
) -> Optional[UserPermissions]:
    """Update a permission"""
    db_permission = await get_permission_by_id(db, permission_id)
    
    if not db_permission:
        return None
    
    update_data = permission_data.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_permission, key, value)
    
    await db.commit()
    await db.refresh(db_permission)
    return db_permission


async def delete_user_permission(db: AsyncSession, permission_id: UUID) -> bool:
    """Delete a permission"""
    db_permission = await get_permission_by_id(db, permission_id)
    
    if not db_permission:
        return False
    
    await db.delete(db_permission)
    await db.commit()
    return True


async def check_user_permission(
    db: AsyncSession,
    user_id: UUID,
    permission: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[UUID] = None
) -> bool:
    """Check if user has a specific permission"""
    query = select(UserPermissions).where(
        UserPermissions.user_id == user_id,
        UserPermissions.permission == permission,
        UserPermissions.granted == True
    )
    
    if resource_type:
        query = query.where(UserPermissions.resource_type == resource_type)
    
    if resource_id:
        query = query.where(UserPermissions.resource_id == resource_id)
    else:
        query = query.where(UserPermissions.resource_id.is_(None))
    
    query = query.where(
        or_(
            UserPermissions.expires_at.is_(None),
            UserPermissions.expires_at > datetime.utcnow()
        )
    )
    
    result = await db.execute(query)
    permission_record = result.scalar_one_or_none()
    
    return permission_record is not None


async def get_user_permissions_by_resource(
    db: AsyncSession,
    user_id: UUID,
    resource_type: Optional[str] = None,
    resource_id: Optional[UUID] = None
) -> List[UserPermissions]:
    """Get user permissions filtered by resource"""
    query = select(UserPermissions).where(UserPermissions.user_id == user_id)
    
    if resource_type:
        query = query.where(UserPermissions.resource_type == resource_type)
    
    if resource_id:
        query = query.where(UserPermissions.resource_id == resource_id)
    
    result = await db.execute(query)
    return result.scalars().all()


async def revoke_expired_permissions(db: AsyncSession) -> int:
    """Revoke (set granted=False) all expired permissions"""
    result = await db.execute(
        update(UserPermissions)
        .where(
            UserPermissions.expires_at < datetime.utcnow(),
            UserPermissions.granted == True
        )
        .values(granted=False)
        .returning(UserPermissions.id)
    )
    await db.commit()
    revoked_ids = result.scalars().all()
    return len(revoked_ids)


# ============================================================================
# BULK OPERATIONS
# ============================================================================

async def bulk_create_permissions(
    db: AsyncSession,
    permissions_data: List[UserPermissionCreate],
    granted_by: UUID
) -> Dict[str, Any]:
    """Create multiple permissions in bulk"""
    created = []
    errors = []
    
    for perm_data in permissions_data:
        try:
            permission = await create_user_permission(db, perm_data, granted_by)
            created.append(permission)
        except ValueError as e:
            errors.append({
                'user_id': str(perm_data.user_id),
                'permission': perm_data.permission,
                'error': str(e)
            })
    
    return {
        'created': created,
        'errors': errors,
        'total_created': len(created),
        'total_errors': len(errors)
    }


async def get_users_with_permission(
    db: AsyncSession,
    permission: str,
    resource_type: Optional[str] = None,
    resource_id: Optional[UUID] = None,
    active_only: bool = True
) -> List[User]:
    """Get all users who have a specific permission"""
    query = select(User).join(
        UserPermissions,
        User.id == UserPermissions.user_id
    ).where(
        UserPermissions.permission == permission,
        UserPermissions.granted == True
    )
    
    if resource_type:
        query = query.where(UserPermissions.resource_type == resource_type)
    
    if resource_id:
        query = query.where(UserPermissions.resource_id == resource_id)
    
    if active_only:
        query = query.where(User.is_active == True)
    
    result = await db.execute(query)
    return result.scalars().all()