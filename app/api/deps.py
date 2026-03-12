from typing import Optional, Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import TokenData

# OAuth2 scheme for token authentication
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login/form", auto_error=False)


async def get_current_user(
    token: Annotated[Optional[str], Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> Optional[User]:
    """Get current authenticated user from JWT token (optional)"""
    if token is None:
        return None
    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
    except JWTError:
        return None
    
    # Convert string to UUID for lookup
    from uuid import UUID
    try:
        user_uuid = UUID(user_id)
    except ValueError:
        return None
    
    result = await db.execute(
        select(User).where(User.id == user_uuid)
    )
    user = result.scalar_one_or_none()
    
    return user


async def get_current_active_user(
    current_user: Annotated[Optional[User], Depends(get_current_user)]
) -> User:
    """Get current active user (requires authentication)"""
    if current_user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not current_user.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Inactive user"
        )
    return current_user


# ============================================================================
# ROLE-BASED DEPENDENCIES - All possible roles from your User model
# ============================================================================

async def get_admin_user(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """Require admin role"""
    if current_user.role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Admin privileges required. Your role: {current_user.role}"
        )
    return current_user


async def get_general_manager_user(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """Require General manager role"""
    allowed_roles = ["admin", "General manager"]
    if current_user.role.lower() not in [r.lower() for r in allowed_roles]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"General Manager privileges required. Your role: {current_user.role}"
        )
    return current_user


async def get_supervisor_user(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """Require supervisor role (admin or General manager)"""
    allowed_roles = ["admin", "General manager"]
    if current_user.role.lower() not in [r.lower() for r in allowed_roles]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Supervisor privileges required. Your role: {current_user.role}"
        )
    return current_user


async def get_grn_manager_user(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """Require GRN manager role"""
    allowed_roles = ["admin", "GRN manager"]
    if current_user.role.lower() not in [r.lower() for r in allowed_roles]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"GRN Manager privileges required. Your role: {current_user.role}"
        )
    return current_user


async def get_putaway_worker(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """Require putaway worker role"""
    allowed_roles = ["admin", "General manager", "putaway worker"]
    if current_user.role.lower() not in [r.lower() for r in allowed_roles]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Putaway worker privileges required. Your role: {current_user.role}"
        )
    return current_user


async def get_picker(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """Require picker role"""
    allowed_roles = ["admin", "General manager", "picker"]
    if current_user.role.lower() not in [r.lower() for r in allowed_roles]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Picker privileges required. Your role: {current_user.role}"
        )
    return current_user


async def get_packer(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """Require packer role"""
    allowed_roles = ["admin", "General manager", "packer"]
    if current_user.role.lower() not in [r.lower() for r in allowed_roles]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Packer privileges required. Your role: {current_user.role}"
        )
    return current_user


async def get_quality_inspector(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """Require quality inspector role"""
    # Note: Your User model doesn't have 'quality inspector' role, so we'll allow admin and General manager
    allowed_roles = ["admin", "General manager"]
    if current_user.role.lower() not in [r.lower() for r in allowed_roles]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Quality inspector privileges required. Your role: {current_user.role}"
        )
    return current_user


async def get_receiving_worker(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """Require receiving worker role"""
    # Note: Your User model doesn't have 'receiving worker', so we'll allow admin, General manager, and putaway worker
    allowed_roles = ["admin", "General manager", "putaway worker"]
    if current_user.role.lower() not in [r.lower() for r in allowed_roles]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Receiving worker privileges required. Your role: {current_user.role}"
        )
    return current_user


async def get_inventory_manager(
    current_user: Annotated[User, Depends(get_current_active_user)]
) -> User:
    """Require inventory manager role"""
    # Note: Your User model doesn't have 'inventory manager', so we'll allow admin and General manager
    allowed_roles = ["admin", "General manager"]
    if current_user.role.lower() not in [r.lower() for r in allowed_roles]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Inventory manager privileges required. Your role: {current_user.role}"
        )
    return current_user


# ============================================================================
# GENERIC ROLE CHECKER - For any custom role
# ============================================================================

async def require_roles(
    current_user: Annotated[User, Depends(get_current_active_user)],
    allowed_roles: list
) -> User:
    """Generic role checker - pass in list of allowed roles"""
    allowed_lower = [r.lower() for r in allowed_roles]
    if current_user.role.lower() not in allowed_lower:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Access denied. Required roles: {allowed_roles}. Your role: {current_user.role}"
        )
    return current_user


# ============================================================================
# OPTIONAL: Get current user with optional authentication
# ============================================================================

async def get_optional_current_user(
    token: Annotated[Optional[str], Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)]
) -> Optional[User]:
    """Get current user if token provided, otherwise return None"""
    if token is None:
        return None
    
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        user_id: str = payload.get("sub")
        if user_id is None:
            return None
        
        from uuid import UUID
        try:
            user_uuid = UUID(user_id)
        except ValueError:
            return None
        
        result = await db.execute(
            select(User).where(User.id == user_uuid)
        )
        user = result.scalar_one_or_none()
        return user
    except JWTError:
        return None