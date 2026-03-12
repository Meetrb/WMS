from app.db.base import Base
from app.db.session import engine
from app.models import (
    User, UserPermissions,
    ItemMaster,
    SupplierMaster,
    Warehouse,
    ASN, Shipment, ShipmentItem,
    # Add all inbound models
    InboundShipment, ASNShipment, ASNShipmentItem,
    ReceivingTask, ReceivingTaskItem,
    InspectionRecord, InspectionDetail,
    GRN, GRNItem,
    PutawayTask, PutawayTaskHistory, WorkerWorkload
)


async def init_db():
    """Create database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created successfully")