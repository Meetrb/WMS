# app/db/session.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import AsyncGenerator

from app.core.config import settings

# Create async engine
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,           # Turned off to keep logs clean
    pool_size=20,         # Connection pool size
    max_overflow=10,      # Max overflow connections
    pool_pre_ping=True    # Verify connections before using
)

# Create session factory - EXPORT THIS AS AsyncSessionLocal
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False
)

# Keep the original for backward compatibility
SessionLocal = AsyncSessionLocal
async_session_local = AsyncSessionLocal  # This is what your worker needs

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for FastAPI endpoints - yields a database session
    Session is automatically closed when the request ends
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()