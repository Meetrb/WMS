from datetime import datetime, timedelta
from typing import Optional, Union, Any, Dict
from jose import JWTError, jwt
import bcrypt
from fastapi.security import OAuth2PasswordBearer
from app.core.config import settings

# OAuth2 scheme for token authentication
# This tells FastAPI where to look for the token (in the login endpoint)
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login/form", auto_error=False)


# ============================================================================
# PASSWORD HASHING
# ============================================================================

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verify a plain password against a hashed password
    
    Args:
        plain_password: Plain text password
        hashed_password: Hashed password from database
    
    Returns:
        True if password matches, False otherwise
    """
    if not plain_password or not hashed_password:
        return False
    
    try:
        # Convert to bytes if they are strings
        if isinstance(plain_password, str):
            plain_password_bytes = plain_password.encode('utf-8')
        else:
            plain_password_bytes = plain_password
            
        if isinstance(hashed_password, str):
            hashed_password_bytes = hashed_password.encode('utf-8')
        else:
            hashed_password_bytes = hashed_password
        
        return bcrypt.checkpw(plain_password_bytes, hashed_password_bytes)
    except Exception as e:
        print(f"Error verifying password: {e}")
        return False


def get_password_hash(password: str) -> str:
    """
    Hash a password using bcrypt
    
    Args:
        password: Plain text password
    
    Returns:
        Hashed password as string
    """
    try:
        if isinstance(password, str):
            password_bytes = password.encode('utf-8')
        else:
            password_bytes = password
        
        # bcrypt.hashpw returns bytes, decode to store as string
        hashed = bcrypt.hashpw(password_bytes, bcrypt.gensalt())
        return hashed.decode('utf-8')
    except Exception as e:
        print(f"Error hashing password: {e}")
        raise


# ============================================================================
# JWT TOKEN FUNCTIONS
# ============================================================================

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT access token
    
    Args:
        data: Data to encode in token (usually {'sub': user_id})
        expires_delta: Optional custom expiration time
    
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    # Add standard claims
    to_encode.update({
        "exp": expire,
        "type": "access",
        "iat": datetime.utcnow()
    })
    
    try:
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt
    except Exception as e:
        print(f"Error creating access token: {e}")
        raise


def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """
    Create a JWT refresh token (longer expiration)
    
    Args:
        data: Data to encode in token (usually {'sub': user_id})
        expires_delta: Optional custom expiration time
    
    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()
    
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        # Default refresh token valid for 7 days
        expire = datetime.utcnow() + timedelta(days=7)
    
    to_encode.update({
        "exp": expire,
        "type": "refresh",
        "iat": datetime.utcnow()
    })
    
    try:
        encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
        return encoded_jwt
    except Exception as e:
        print(f"Error creating refresh token: {e}")
        raise


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Decode and validate a JWT token
    
    Args:
        token: JWT token string
    
    Returns:
        Decoded payload as dict if valid, None otherwise
    """
    try:
        payload = jwt.decode(
            token, 
            settings.SECRET_KEY, 
            algorithms=[settings.ALGORITHM]
        )
        return payload
    except jwt.ExpiredSignatureError:
        print("Token has expired")
        return None
    except jwt.JWTClaimsError as e:
        print(f"Invalid claims: {e}")
        return None
    except JWTError as e:
        print(f"Error decoding token: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error decoding token: {e}")
        return None


def verify_token_type(token: str, expected_type: str) -> bool:
    """
    Verify that the token has the expected type (access or refresh)
    
    Args:
        token: JWT token string
        expected_type: Expected token type ('access' or 'refresh')
    
    Returns:
        True if token type matches, False otherwise
    """
    payload = decode_token(token)
    if not payload:
        return False
    
    token_type = payload.get("type")
    return token_type == expected_type


def get_token_subject(token: str) -> Optional[str]:
    """
    Extract subject (user_id) from token
    
    Args:
        token: JWT token string
    
    Returns:
        Subject (user_id) if token valid, None otherwise
    """
    payload = decode_token(token)
    if not payload:
        return None
    
    return payload.get("sub")


def refresh_access_token(refresh_token: str) -> Optional[str]:
    """
    Create a new access token from a valid refresh token
    
    Args:
        refresh_token: Valid refresh token
    
    Returns:
        New access token if refresh token valid, None otherwise
    """
    # Verify token type and decode
    if not verify_token_type(refresh_token, "refresh"):
        return None
    
    payload = decode_token(refresh_token)
    if not payload:
        return None
    
    # Create new access token with same subject
    user_id = payload.get("sub")
    if not user_id:
        return None
    
    return create_access_token(data={"sub": user_id})