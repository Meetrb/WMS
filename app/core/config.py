# app/core/config.py
from pydantic_settings import BaseSettings
from typing import Optional, List
from functools import lru_cache


class Settings(BaseSettings):
    # ============================================================================
    # APP SETTINGS
    # ============================================================================
    APP_NAME: str = "WMS Backend"
    DEBUG: bool = True
    
    # ============================================================================
    # CORS SETTINGS - CRITICAL FOR PREFLIGHT REQUESTS
    # ============================================================================
    CORS_ORIGINS: str = "http://localhost:3000,http://localhost:5173,http://127.0.0.1:3000,http://127.0.0.1:5173"
    ALLOW_ALL_ORIGINS: bool = True
    
    # ============================================================================
    # DATABASE SETTINGS
    # ============================================================================
    DB_HOST: str = "localhost"
    DB_PORT: int = 5432
    DB_USER: str = "postgres"
    DB_PASSWORD: str = "password"
    DB_NAME: str = "wms_db"
    
    # ============================================================================
    # JWT SETTINGS
    # ============================================================================
    SECRET_KEY: str = "your-secret-key-here-change-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # ============================================================================
    # WORKER SETTINGS
    # ============================================================================
    WORKER_CHECK_INTERVAL: int = 10
    WORKER_STALE_TASK_HOURS: int = 1
    WORKER_STUCK_TASK_HOURS: int = 4
    
    # ============================================================================
    # PYDANTIC V2 CONFIGURATION
    # ============================================================================
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": True,
        "extra": "ignore"
    }
    
    # ============================================================================
    # COMPUTED PROPERTIES
    # ============================================================================
    
    @property
    def DATABASE_URL(self) -> str:
        """Get async database URL"""
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    @property
    def SYNC_DATABASE_URL(self) -> str:
        """Get sync database URL (for migrations)"""
        return f"postgresql://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    @property
    def CORS_ORIGINS_LIST(self) -> List[str]:
        if self.ALLOW_ALL_ORIGINS:
            return ["*"]
        if not self.CORS_ORIGINS:
            return []
        origins = []
        for origin in self.CORS_ORIGINS.split(","):
            origin = origin.strip()
            if origin.endswith('/'):
                origin = origin[:-1]
            origins.append(origin)
        return origins
    
    @property
    def IS_PRODUCTION(self) -> bool:
        """Check if running in production"""
        return not self.DEBUG


# ============================================================================
# CACHED SETTINGS INSTANCE
# ============================================================================

@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    Use this function to import settings anywhere in the app.
    """
    return Settings()


# Create a global settings instance
settings = get_settings()