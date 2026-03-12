from app.db.base import Base

# ============================================================================
# IMPORT ALL MODELS FOR ALEMBIC
# Alembic needs to see all models to generate migrations correctly
# ============================================================================

# Core Models
from app.models.user import User, UserPermissions
from app.models.supplier_master import SupplierMaster
from app.models.item_master import ItemMaster
from app.models.warehouse import Warehouse, Zone, Bin, BinHistory
from app.models.asn import ASN, Shipment, ShipmentItem

# Inbound Models
from app.models.inbound import (
    InboundShipment, ASNShipment, ASNShipmentItem,
    ReceivingTask, ReceivingTaskItem,
    InspectionRecord, InspectionDetail,
    GRN, GRNItem
)

# Putaway Models (NEW)
from app.models.putaway import (
    PutawayTask,
    PutawayTaskHistory,
    WorkerWorkload
)


# ============================================================================
# EXPORT ALL MODELS
# This makes them available when importing from app.models
# ============================================================================

__all__ = [
    # Base
    'Base',
    
    # Core Models
    'User',
    'UserPermissions',
    'SupplierMaster',
    'ItemMaster',
    'Warehouse',
    'Zone',              # NEW
    'Bin',               # NEW
    'BinHistory',        # NEW
    'ASN',
    'Shipment',
    'ShipmentItem',
    
    # Inbound Models
    'InboundShipment',
    'ASNShipment',
    'ASNShipmentItem',
    'ReceivingTask',
    'ReceivingTaskItem',
    'InspectionRecord',
    'InspectionDetail',
    'GRN',
    'GRNItem',
    
    # Putaway Models (NEW)
    'PutawayTask',
    'PutawayTaskHistory',
    'WorkerWorkload'
]