import sys
from pathlib import Path

# Add your project to path
sys.path.append(str(Path(__file__).parent.parent))

from app.models.item_master import ItemMaster
from app.db.base import Base

target_metadata = Base.metadata