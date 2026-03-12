# app/main.py
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from datetime import datetime

from app.db.session import engine
from app.db.base import Base
from app.core.config import settings
from app.routers import auth, user, asn, item_master, supplier_master, warehouse, inbound, putaway
from app.workers.putaway_worker import start_putaway_worker, stop_putaway_worker, putaway_worker


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    print("=" * 60)
    print("🚀 Starting WMS API...")
    print("=" * 60)
    
    # Create database tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created/verified")
    
    # Start background worker
    try:
        await start_putaway_worker()
        print("✅ Putaway background worker started")
    except Exception as e:
        print(f"❌ Failed to start putaway worker: {e}")
    
    print("=" * 60)
    print("✅ WMS API is ready!")
    print("=" * 60)
    
    yield
    
    # Shutdown
    print("=" * 60)
    print("🛑 Shutting down WMS API...")
    print("=" * 60)
    
    # Stop background worker
    try:
        await stop_putaway_worker()
        print("✅ Putaway background worker stopped")
    except Exception as e:
        print(f"❌ Error stopping putaway worker: {e}")
    
    # Close database connections
    await engine.dispose()
    print("✅ Database connections closed")
    print("👋 Goodbye!")
    print("=" * 60)


# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    lifespan=lifespan,
)


# ============================================================================
# CORS CONFIGURATION
# ============================================================================

if settings.ALLOW_ALL_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    print("⚠️  CORS configured to allow ALL origins (DEVELOPMENT MODE)")
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS_LIST,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    print(f"✅ CORS configured with origins: {settings.CORS_ORIGINS_LIST}")


# ============================================================================
# ROUTERS
# ============================================================================

app.include_router(auth.router)
app.include_router(user.router)
app.include_router(item_master.router)
app.include_router(supplier_master.router)
app.include_router(warehouse.router)
app.include_router(asn.router)
app.include_router(inbound.router)
app.include_router(putaway.router)


# ============================================================================
# HEALTH CHECK
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint with worker status"""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "worker_running": putaway_worker.is_running if hasattr(putaway_worker, 'is_running') else False,
        "worker_check_interval": settings.WORKER_CHECK_INTERVAL,
        "environment": "production" if settings.IS_PRODUCTION else "development"
    }


# ============================================================================
# REQUEST LOGGING
# ============================================================================

@app.middleware("http")
async def log_requests(request: Request, call_next):
    print(f"📥 {request.method} {request.url.path}")
    response = await call_next(request)
    print(f"📤 Response status: {response.status_code}")
    return response


# ============================================================================
# ROOT ENDPOINT
# ============================================================================

@app.get("/")
async def root():
    return {
        "message": f"Welcome to {settings.APP_NAME} API",
        "version": "1.0.0",
        "status": "operational"
    }