from pydantic import BaseModel
from typing import Optional


class Token(BaseModel):
    """Token response schema"""
    access_token: str
    token_type: str


class TokenData(BaseModel):
    """Token data stored in JWT payload"""
    username: Optional[str] = None


class LoginRequest(BaseModel):
    """Login request schema"""
    username: str
    password: str


class LoginResponse(BaseModel):
    """Login response schema"""
    access_token: str
    token_type: str
    username: str
    email: str
    full_name: Optional[str] = None
    role: str