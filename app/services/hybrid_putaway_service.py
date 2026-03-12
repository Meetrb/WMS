from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from typing import List, Optional, Dict, Any, Tuple
from uuid import UUID
from datetime import datetime, timedelta, date
from decimal import Decimal
import heapq
import logging

from app.models.putaway import PutawayTask, WorkerWorkload, PutawayTaskHistory
from app.models.inbound import GRN, GRNItem, ASNShipmentItem, InboundShipment
from app.models.item_master import ItemMaster
from app.models.warehouse import Bin, Zone
from app.models.user import User
from app.crud import warehouse as bin_crud
from app.schemas.putaway import PutawayTaskCreate
from app.crud.putaway import get_task

logger = logging.getLogger(__name__)


class PutawayQueue:
    """
    Priority queue for putaway tasks
    Uses heap queue for efficient priority-based processing
    """
    
    def __init__(self):
        self.queue = []  # Heap queue: (priority_score, created_at, task_id)
        self.task_map = {}  # task_id -> (priority_score, created_at)
    
    def add_task(self, task_id: UUID, priority: int, created_at: datetime):
        """
        Add task to queue with priority
        Lower priority_score = higher priority
        """
        # Calculate priority score (lower is better)
        # Priority 1-10: 1 is highest, 10 is lowest
        # Older tasks get slight boost (0.1 point per hour)
        hours_waiting = (datetime.utcnow() - created_at).total_seconds() / 3600
        priority_score = priority - (hours_waiting * 0.1)  # Older tasks get slightly higher priority
        
        heapq.heappush(self.queue, (priority_score, created_at, task_id))
        self.task_map[task_id] = (priority_score, created_at)
    
    def get_next_task(self) -> Optional[UUID]:
        """Get the highest priority task from queue"""
        if self.queue:
            priority_score, created_at, task_id = heapq.heappop(self.queue)
            del self.task_map[task_id]
            return task_id
        return None
    
    def remove_task(self, task_id: UUID):
        """Remove task from queue (when assigned/completed)"""
        if task_id in self.task_map:
            # Rebuild queue without this task
            self.queue = [(p, c, tid) for p, c, tid in self.queue if tid != task_id]
            heapq.heapify(self.queue)
            del self.task_map[task_id]
    
    def peek(self) -> Optional[UUID]:
        """Look at next task without removing it"""
        if self.queue:
            return self.queue[0][2]
        return None
    
    def size(self) -> int:
        return len(self.queue)


class PutawayGroup:
    """Represents a group of items that will form one putaway task"""
    
    def __init__(self, strategy: str, items: List[Dict], reason: str, **kwargs):
        self.strategy = strategy  # 'item-wise', 'pallet-wise', 'zone-wise'
        self.items = items
        self.reason = reason
        self.metadata = kwargs
        
    @property
    def total_quantity(self) -> Decimal:
        return sum(item['accepted_quantity'] for item in self.items)
    
    @property
    def unique_items(self) -> int:
        return len(set(item['item_master_id'] for item in self.items))
    
    @property
    def first_item(self) -> Optional[Dict]:
        return self.items[0] if self.items else None
    
    def __repr__(self):
        return f"<PutawayGroup strategy={self.strategy} items={len(self.items)} reason={self.reason}>"


class HybridPutawayStrategy:
    """
    Determines the best putaway strategy for each situation
    Combines item-wise, pallet-wise, and zone-wise approaches
    """
    
    # Configuration thresholds
    PALLET_THRESHOLD = 50  # units per pallet (can be overridden by item.pallet_quantity)
    MAX_ITEMS_PER_TASK = 5  # maximum items to combine in one task
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def determine_strategy(self, grn_items: List[Dict]) -> List[PutawayGroup]:
        """
        Determine the optimal grouping strategy for GRN items
        Returns list of groups (each group becomes one task)
        """
        groups = []
        
        # Step 1: First, separate items that need individual handling
        individual_items = []
        potential_group_items = []
        
        for item_data in grn_items:
            if await self._requires_individual_handling(item_data):
                # These become individual tasks
                individual_items.append(item_data)
            else:
                # These can potentially be grouped
                potential_group_items.append(item_data)
        
        # Step 2: Create individual tasks for special items
        for item in individual_items:
            groups.append(PutawayGroup(
                strategy='item-wise',
                items=[item],
                reason=await self._get_individual_reason(item)
            ))
        
        # Step 3: Try pallet-wise grouping first
        pallet_groups = await self._group_by_pallet(potential_group_items)
        for group_data in pallet_groups:
            groups.append(PutawayGroup(
                strategy='pallet-wise',
                items=group_data['items'],
                reason=f"Full pallet of {group_data['items'][0]['sku_code']}",
                pallet_id=group_data['pallet_id'],
                pallet_quantity=group_data['pallet_quantity']
            ))
        
        # Step 4: Group remaining items by zone
        remaining_items = [item for item in potential_group_items 
                          if not any(item in g.items for g in groups)]
        
        zone_groups = await self._group_by_zone(remaining_items)
        for zone_name, zone_items in zone_groups.items():
            # Further split if zone group is too large
            if len(zone_items) > self.MAX_ITEMS_PER_TASK:
                # Split into multiple groups
                chunks = [zone_items[i:i+self.MAX_ITEMS_PER_TASK] 
                         for i in range(0, len(zone_items), self.MAX_ITEMS_PER_TASK)]
                for i, chunk in enumerate(chunks):
                    groups.append(PutawayGroup(
                        strategy='zone-wise',
                        items=chunk,
                        reason=f"Zone {zone_name} - Group {i+1}",
                        zone=zone_name
                    ))
            else:
                groups.append(PutawayGroup(
                    strategy='zone-wise',
                    items=zone_items,
                    reason=f"All items for zone {zone_name}",
                    zone=zone_name
                ))
        
        return groups
    
    async def _requires_individual_handling(self, item_data: Dict) -> bool:
        """Check if item needs individual handling"""
        item_master = item_data.get('item_master')
        
        if not item_master:
            return False
        
        # Check 1: Hazardous materials
        if hasattr(item_master, 'is_hazardous') and item_master.is_hazardous:
            return True
        
        # Check 2: Temperature controlled
        if hasattr(item_master, 'storage_condition') and item_master.storage_condition in ['FROZEN', 'CHILLED']:
            return True
        
        # Check 3: Very large quantity (more than 3 pallets)
        pallet_qty = getattr(item_master, 'pallet_quantity', self.PALLET_THRESHOLD)
        if item_data['accepted_quantity'] > pallet_qty * 3:
            return True
        
        # Check 4: High priority
        if hasattr(item_master, 'velocity_class') and item_master.velocity_class == 'A':
            return True
        
        # Check 5: Special handling from compatibility rules
        if hasattr(item_master, 'compatibility_rules') and item_master.compatibility_rules:
            rules = item_master.compatibility_rules
            if rules.get('special_handling'):
                return True
        
        return False
    
    async def _get_individual_reason(self, item_data: Dict) -> str:
        """Get reason for individual handling"""
        item_master = item_data.get('item_master')
        reasons = []
        
        if hasattr(item_master, 'is_hazardous') and item_master.is_hazardous:
            reasons.append("Hazardous")
        if hasattr(item_master, 'storage_condition') and item_master.storage_condition in ['FROZEN', 'CHILLED']:
            reasons.append(f"Temperature: {item_master.storage_condition}")
        if hasattr(item_master, 'velocity_class') and item_master.velocity_class == 'A':
            reasons.append("High Priority")
        
        return f"Individual handling required: {', '.join(reasons)}" if reasons else "Individual item"
    
    async def _group_by_pallet(self, items: List[Dict]) -> List[Dict]:
        """Group items that form full pallets"""
        pallet_groups = []
        items_to_remove = []
        
        for i, item_data in enumerate(items):
            item_master = item_data.get('item_master')
            
            # Check if this item has pallet quantity defined
            pallet_quantity = None
            if hasattr(item_master, 'pallet_quantity') and item_master.pallet_quantity:
                pallet_quantity = float(item_master.pallet_quantity)
            else:
                pallet_quantity = self.PALLET_THRESHOLD
            
            # Calculate how many full pallets
            quantity = float(item_data['accepted_quantity'])
            pallet_count = int(quantity / pallet_quantity)
            
            for p in range(pallet_count):
                # Create a copy of item data for this pallet
                pallet_item = item_data.copy()
                pallet_item['accepted_quantity'] = Decimal(str(pallet_quantity))
                pallet_item['original_quantity'] = quantity
                pallet_item['pallet_number'] = p + 1
                
                pallet_groups.append({
                    'items': [pallet_item],
                    'pallet_id': f"PALLET-{i+1}-{p+1}",
                    'pallet_quantity': pallet_quantity
                })
            
            # Update the remaining quantity in the original item
            remaining = quantity - (pallet_count * pallet_quantity)
            if remaining > 0:
                item_data['accepted_quantity'] = Decimal(str(remaining))
            else:
                items_to_remove.append(item_data)
        
        # Remove items that were fully palletized
        for item in items_to_remove:
            if item in items:
                items.remove(item)
        
        return pallet_groups
    
    async def _group_by_zone(self, items: List[Dict]) -> Dict[str, List[Dict]]:
        """Group remaining items by their destination zone"""
        zone_groups = {}
        
        for item_data in items:
            if item_data['accepted_quantity'] <= 0:
                continue
            
            # Get suggested bin for this item
            suggested_bin = await self._get_suggested_bin(item_data)
            zone_name = "UNKNOWN"
            
            if suggested_bin and suggested_bin.zone:
                zone_name = suggested_bin.zone.name or f"Zone-{suggested_bin.zone_id}"
            elif suggested_bin and suggested_bin.zone_id:
                zone_name = f"Zone-{suggested_bin.zone_id}"
            
            if zone_name not in zone_groups:
                zone_groups[zone_name] = []
            
            zone_groups[zone_name].append(item_data)
        
        return zone_groups
    
    async def _get_suggested_bin(self, item_data: Dict) -> Optional[Bin]:
        """Get suggested bin for an item"""
        try:
            item_master = item_data.get('item_master')
            inbound_shipment = item_data.get('inbound_shipment')
            
            if not item_master or not inbound_shipment:
                return None
            
            # Use existing bin suggestion logic
            suggested_bin = await bin_crud.suggest_bin_for_putaway(
                self.db,
                warehouse_id=inbound_shipment.warehouse_id,
                item_id=item_master.id,
                quantity=item_data['accepted_quantity'],
                lot_number=item_data.get('lot_number'),
                batch_number=None
            )
            
            return suggested_bin
        except Exception as e:
            logger.warning(f"Error getting suggested bin: {e}")
            return None


class HybridPutawayService:
    """
    Main service for putaway operations using hybrid strategy
    Manages task generation, queue, and worker assignment
    """
    
    def __init__(self):
        self.task_queue = PutawayQueue()
        self.worker_loads = {}  # worker_id -> current_load
    
    async def generate_tasks_from_grn(
    self,
    db: AsyncSession,
    grn_id: UUID,
    override_suggestions: bool = False
) -> Tuple[List[PutawayTask], List[str]]:
        """
        Generate putaway tasks from a completed GRN using hybrid strategy
        This is called automatically when GRN is posted
        """
        logger.info(f"🔧 Generating putaway tasks for GRN: {grn_id}")
        
        # Get GRN with all items
        grn = await db.get(GRN, grn_id)
        if not grn:
            error_msg = f"GRN with ID {grn_id} not found"
            logger.error(f"❌ {error_msg}")
            raise ValueError(error_msg)
        
        logger.info(f"📦 GRN: {grn.grn_number}, Status: {grn.status}")
        
        # Check if tasks already generated
        if hasattr(grn, 'putaway_tasks_generated') and grn.putaway_tasks_generated:
            logger.info(f"⏩ Putaway tasks already generated for GRN {grn_id}")
            return [], [f"Tasks already generated for GRN {grn.grn_number}"]
        
        # Check if any tasks already exist for this GRN (backup check)
        existing_tasks = await db.execute(
            select(func.count()).select_from(PutawayTask).where(PutawayTask.grn_id == grn_id)
        )
        if existing_tasks.scalar() > 0:
            logger.info(f"⏩ Found existing putaway tasks for GRN {grn_id}")
            # Update GRN flag
            if hasattr(grn, 'putaway_tasks_generated'):
                grn.putaway_tasks_generated = True
                grn.putaway_tasks_generated_at = datetime.utcnow()
                await db.commit()
            return [], [f"Tasks already exist for GRN {grn.grn_number}"]
        
        # Get inbound shipment details
        inbound = await db.get(InboundShipment, grn.inbound_shipment_id)
        if not inbound:
            error_msg = f"Inbound shipment not found for GRN {grn_id}"
            logger.error(f"❌ {error_msg}")
            raise ValueError(error_msg)
        
        logger.info(f"🚚 Inbound Shipment: {inbound.asn_number}")
        
        # Get GRN items with related data
        grn_items_result = await db.execute(
            select(GRNItem).where(GRNItem.grn_id == grn_id)
        )
        grn_items = grn_items_result.scalars().all()
        
        if not grn_items:
            logger.warning(f"⚠️ No items found for GRN {grn_id}")
            return [], ["No items to process"]
        
        logger.info(f"📋 Found {len(grn_items)} GRN items")
        
        # Prepare item data for strategy
        items_data = []
        warnings = []
        
        for grn_item in grn_items:
            if grn_item.accepted_quantity <= 0:
                logger.debug(f"⏩ Skipping item with zero accepted quantity: {grn_item.id}")
                continue
                
            # Get ASN item details
            asn_item = await db.get(ASNShipmentItem, grn_item.asn_shipment_item_id)
            if not asn_item:
                warnings.append(f"ASN item not found for GRN item {grn_item.id}")
                continue
            
            # Get item master
            item = await db.get(ItemMaster, asn_item.item_master_id)
            if not item:
                warnings.append(f"Item master not found for ASN item {asn_item.id}")
                continue
            
            items_data.append({
                'grn_item_id': grn_item.id,
                'asn_shipment_item_id': grn_item.asn_shipment_item_id,
                'item_master_id': item.id,
                'item_master': item,
                'sku_code': item.sku_code,
                'description': item.description,
                'accepted_quantity': grn_item.accepted_quantity,
                'lot_number': asn_item.lot_number,
                'expiry_date': asn_item.expiry_date,
                'inbound_shipment': inbound
            })
            
            logger.debug(f"  - Item: {item.sku_code}, Qty: {grn_item.accepted_quantity}")
        
        if not items_data:
            logger.warning("⚠️ No valid items to process after filtering")
            return [], warnings + ["No valid items to process"]
        
        logger.info(f"✅ Prepared {len(items_data)} items for strategy processing")
        
        # Step 1: Apply hybrid strategy to group items
        strategy = HybridPutawayStrategy(db)
        groups = await strategy.determine_strategy(items_data)
        
        logger.info(f"📊 Strategy determined {len(groups)} groups")
        for i, group in enumerate(groups):
            logger.info(f"  Group {i+1}: {group.strategy} - {len(group.items)} items - {group.reason}")
        
        # Step 2: Create tasks for each group
        tasks = []
        for group in groups:
            task = await self._create_task_from_group(db, group, grn, inbound)
            tasks.append(task)
            logger.info(f"  ✅ Created task: {task.task_number}")
        
        # Step 3: Update GRN with task generation info
        if hasattr(grn, 'putaway_tasks_generated'):
            grn.putaway_tasks_generated = True
            grn.putaway_tasks_generated_at = datetime.utcnow()
        
        await db.commit()
        
        # Step 4: Add tasks to queue
        for task in tasks:
            self.task_queue.add_task(task.id, task.priority, task.created_at)
        
        logger.info(f"🎉 Generated {len(tasks)} putaway tasks for GRN {grn.grn_number}")
        
        # Refresh tasks to get all relationships
        refreshed_tasks = []
        for task in tasks:
            refreshed = await get_task(db, task.id)
            refreshed_tasks.append(refreshed)
        
        return refreshed_tasks, warnings
    
    async def _create_task_from_group(
        self, 
        db: AsyncSession, 
        group: PutawayGroup, 
        grn: GRN, 
        inbound: InboundShipment
    ) -> PutawayTask:
        """
        Create a putaway task from a group of items
        """
        # Generate task number
        task_count = await db.execute(select(func.count()).select_from(PutawayTask))
        count = task_count.scalar() or 0
        task_number = f"PT-{grn.grn_number}-{count + 1:04d}"
        
        # Get first item for reference
        first_item = group.first_item
        if not first_item:
            raise ValueError("Group has no items")
        
        # Get suggested bin
        suggested_bin = None
        if group.strategy == 'zone-wise':
            # For zone-wise tasks, use first item's suggested bin
            strategy = HybridPutawayStrategy(db)
            suggested_bin = await strategy._get_suggested_bin(first_item)
        elif group.strategy == 'pallet-wise':
            # For pallet-wise, use first item's suggested bin
            strategy = HybridPutawayStrategy(db)
            suggested_bin = await strategy._get_suggested_bin(first_item)
        
        # Calculate priority based on group
        priority = await self._calculate_group_priority(db, group)
        
        # Create task data
        task_data = {
            'task_number': task_number,
            'inbound_shipment_id': grn.inbound_shipment_id,
            'grn_id': grn.id,
            'asn_shipment_item_id': first_item['asn_shipment_item_id'],
            'item_id': first_item['item_master_id'],
            'item_sku': first_item['sku_code'],
            'item_description': first_item['description'],
            'quantity_to_put': group.total_quantity,
            'source_location': f"Receiving Dock {inbound.receiving_dock}" if inbound.receiving_dock else "Receiving Area",
            'suggested_bin_id': suggested_bin.id if suggested_bin else None,
            'lot_number': first_item.get('lot_number'),
            'expiry_date': first_item.get('expiry_date'),
            'priority': priority,
            'created_by_id': grn.created_by_id,
            'task_data': {
                'strategy': group.strategy,
                'reason': group.reason,
                'group_items': [str(item['grn_item_id']) for item in group.items],
                'items_count': len(group.items),
                'pallet_id': group.metadata.get('pallet_id'),
                'zone': group.metadata.get('zone')
            }
        }
        
        # Create task
        db_task = PutawayTask(**task_data)
        db.add(db_task)
        await db.flush()
        
        return db_task
    
    async def _calculate_group_priority(self, db: AsyncSession, group: PutawayGroup) -> int:
        """
        Calculate priority for a group (1 = highest, 10 = lowest)
        """
        base_priority = 5  # Default medium priority
        
        # Factor 1: Check item velocities in group
        for item_data in group.items:
            item_master = item_data.get('item_master')
            if item_master:
                if hasattr(item_master, 'velocity_class'):
                    if item_master.velocity_class == 'A':
                        base_priority = min(base_priority, 1)
                    elif item_master.velocity_class == 'B':
                        base_priority = min(base_priority, 3)
        
        # Factor 2: Check for expiring items
        for item_data in group.items:
            if item_data.get('expiry_date'):
                if isinstance(item_data['expiry_date'], datetime):
                    days_to_expiry = (item_data['expiry_date'].date() - datetime.now().date()).days
                else:
                    days_to_expiry = (item_data['expiry_date'] - datetime.now().date()).days
                if days_to_expiry < 30:
                    base_priority = max(1, base_priority - 2)
                elif days_to_expiry < 60:
                    base_priority = max(1, base_priority - 1)
        
        # Factor 3: Group size (larger groups get slightly higher priority)
        if len(group.items) > 3:
            base_priority = max(1, base_priority - 1)
        
        # Factor 4: Strategy-based adjustment
        if group.strategy == 'pallet-wise':
            base_priority = max(1, base_priority - 2)  # Pallets first
        elif group.strategy == 'item-wise' and 'hazardous' in group.reason.lower():
            base_priority = 1  # Hazardous items highest priority
        
        return base_priority
    
    async def assign_next_task(
        self,
        db: AsyncSession,
        worker_id: UUID
    ) -> Optional[PutawayTask]:
        """
        Assign the next available task to a worker
        Uses fair distribution based on worker workload
        """
        # Check worker workload
        workload = await self._get_or_create_workload(db, worker_id)
        
        if workload.total_active_tasks >= workload.max_concurrent_tasks:
            return None  # Worker at capacity
        
        # Get next task from queue
        next_task_id = self.task_queue.get_next_task()
        if not next_task_id:
            return None
        
        # Get task details
        task = await db.get(PutawayTask, next_task_id)
        if not task or task.status != 'PENDING':
            # Task not available, try again
            return await self.assign_next_task(db, worker_id)
        
        # Assign task to worker
        old_status = task.status
        task.status = 'ASSIGNED'
        task.assigned_to_id = worker_id
        task.assigned_at = datetime.utcnow()
        
        # Update workload
        workload.tasks_assigned += 1
        workload.total_active_tasks += 1
        workload.last_task_assigned_at = datetime.utcnow()
        
        # Create history record
        history = PutawayTaskHistory(
            task_id=task.id,
            old_status=old_status,
            new_status='ASSIGNED',
            new_assignee_id=worker_id,
            changed_by_id=worker_id,
            notes="Auto-assigned from queue"
        )
        db.add(history)
        
        await db.commit()
        await db.refresh(task)
        
        return task
    
    async def start_task(
        self,
        db: AsyncSession,
        task_id: UUID,
        worker_id: UUID
    ) -> Optional[PutawayTask]:
        """Worker starts working on a task"""
        task = await db.get(PutawayTask, task_id)
        if not task:
            return None
        
        # Verify worker is assigned to this task
        if task.assigned_to_id != worker_id:
            raise ValueError("Task not assigned to this worker")
        
        if task.status != 'ASSIGNED':
            raise ValueError(f"Task cannot be started from status {task.status}")
        
        # Update task
        old_status = task.status
        task.status = 'IN_PROGRESS'
        task.started_at = datetime.utcnow()
        
        # Update workload
        workload = await self._get_or_create_workload(db, worker_id)
        workload.tasks_assigned -= 1
        workload.tasks_in_progress += 1
        
        # Create history
        history = PutawayTaskHistory(
            task_id=task.id,
            old_status=old_status,
            new_status='IN_PROGRESS',
            changed_by_id=worker_id,
            notes="Task started"
        )
        db.add(history)
        
        await db.commit()
        await db.refresh(task)
        
        return task
    
    async def complete_task(
        self,
        db: AsyncSession,
        task_id: UUID,
        worker_id: UUID,
        actual_bin_id: UUID,
        quantity_put: Decimal
    ) -> Optional[PutawayTask]:
        """Worker completes a putaway task"""
        task = await db.get(PutawayTask, task_id)
        if not task:
            return None
        
        # Verify worker is assigned to this task
        if task.assigned_to_id != worker_id:
            raise ValueError("Task not assigned to this worker")
        
        if task.status != 'IN_PROGRESS':
            raise ValueError(f"Task cannot be completed from status {task.status}")
        
        # Verify quantity
        if quantity_put > task.quantity_to_put:
            raise ValueError("Cannot put more than task quantity")
        
        # Update task
        old_status = task.status
        task.status = 'COMPLETED'
        task.completed_at = datetime.utcnow()
        task.actual_bin_id = actual_bin_id
        task.quantity_put = quantity_put
        
        # Update bin contents
        from app.crud.warehouse import update_bin_contents
        from app.schemas.warehouse import BinContentUpdate
        
        content_update = BinContentUpdate(
            item_id=task.item_id,
            quantity=quantity_put,
            lot_number=task.lot_number,
            batch_number=task.batch_number,
            expiry_date=task.expiry_date,
            operation="ADD"
        )
        
        worker = await db.get(User, worker_id)
        await update_bin_contents(
            db,
            actual_bin_id,
            content_update,
            changed_by_id=worker_id,
            changed_by_name=worker.full_name if worker else None
        )
        
        # Update workload
        workload = await self._get_or_create_workload(db, worker_id)
        workload.tasks_in_progress -= 1
        workload.total_active_tasks -= 1
        workload.tasks_completed_today += 1
        workload.items_put_today += quantity_put
        workload.last_task_completed_at = datetime.utcnow()
        
        # Create history
        history = PutawayTaskHistory(
            task_id=task.id,
            old_status=old_status,
            new_status='COMPLETED',
            changed_by_id=worker_id,
            notes=f"Completed - Put to bin {actual_bin_id}"
        )
        db.add(history)
        
        await db.commit()
        await db.refresh(task)
        
        return task
    
    async def cancel_task(
        self,
        db: AsyncSession,
        task_id: UUID,
        reason: str,
        user_id: UUID
    ) -> Optional[PutawayTask]:
        """Cancel a task (admin only)"""
        task = await db.get(PutawayTask, task_id)
        if not task:
            return None
        
        old_status = task.status
        task.status = 'CANCELLED'
        task.notes = (task.notes or "") + f"\nCancelled: {reason}"
        
        # Remove from queue if pending
        if old_status == 'PENDING':
            self.task_queue.remove_task(task_id)
        
        # If assigned, update workload
        if task.assigned_to_id and old_status in ['ASSIGNED', 'IN_PROGRESS']:
            workload = await self._get_or_create_workload(db, task.assigned_to_id)
            if old_status == 'ASSIGNED':
                workload.tasks_assigned -= 1
            elif old_status == 'IN_PROGRESS':
                workload.tasks_in_progress -= 1
            workload.total_active_tasks -= 1
        
        # Create history
        history = PutawayTaskHistory(
            task_id=task.id,
            old_status=old_status,
            new_status='CANCELLED',
            changed_by_id=user_id,
            notes=reason
        )
        db.add(history)
        
        await db.commit()
        await db.refresh(task)
        
        return task
    
    async def requeue_task(
        self,
        db: AsyncSession,
        task_id: UUID,
        reason: str,
        new_priority: Optional[int] = None
    ) -> Optional[PutawayTask]:
        """Put a task back in queue (e.g., after worker drop)"""
        task = await db.get(PutawayTask, task_id)
        if not task:
            return None
        
        if task.status not in ['ASSIGNED', 'IN_PROGRESS']:
            raise ValueError(f"Task cannot be requeued from status {task.status}")
        
        # Update task
        old_status = task.status
        task.status = 'PENDING'
        task.assigned_to_id = None
        task.assigned_at = None
        task.started_at = None
        if new_priority:
            task.priority = new_priority
        task.notes = (task.notes or "") + f"\nRequeued: {reason}"
        
        # Update workload
        if task.assigned_to_id:
            workload = await self._get_or_create_workload(db, task.assigned_to_id)
            if old_status == 'ASSIGNED':
                workload.tasks_assigned -= 1
            elif old_status == 'IN_PROGRESS':
                workload.tasks_in_progress -= 1
            workload.total_active_tasks -= 1
        
        # Add back to queue
        self.task_queue.add_task(task.id, task.priority, task.created_at)
        
        # Create history
        history = PutawayTaskHistory(
            task_id=task.id,
            old_status=old_status,
            new_status='PENDING',
            changed_by_id=None,  # System
            notes=f"Requeued: {reason}"
        )
        db.add(history)
        
        await db.commit()
        await db.refresh(task)
        
        return task
    
    async def _get_or_create_workload(
        self,
        db: AsyncSession,
        worker_id: UUID
    ) -> WorkerWorkload:
        """Get or create workload record for a worker"""
        workload = await db.execute(
            select(WorkerWorkload).where(WorkerWorkload.worker_id == worker_id)
        )
        workload = workload.scalar_one_or_none()
        
        if not workload:
            # Get worker details
            worker = await db.get(User, worker_id)
            workload = WorkerWorkload(
                worker_id=worker_id,
                worker_name=worker.full_name or worker.email,
                max_concurrent_tasks=3  # Default
            )
            db.add(workload)
            await db.flush()
        
        return workload
    
    async def get_queue_info(self, db: AsyncSession) -> Dict[str, Any]:
        """Get information about the current queue"""
        # Get task counts by status
        pending_count = await db.execute(
            select(func.count()).select_from(PutawayTask).where(PutawayTask.status == 'PENDING')
        )
        assigned_count = await db.execute(
            select(func.count()).select_from(PutawayTask).where(PutawayTask.status == 'ASSIGNED')
        )
        in_progress_count = await db.execute(
            select(func.count()).select_from(PutawayTask).where(PutawayTask.status == 'IN_PROGRESS')
        )
        
        # Get oldest pending task
        oldest_pending = await db.execute(
            select(PutawayTask)
            .where(PutawayTask.status == 'PENDING')
            .order_by(PutawayTask.created_at.asc())
            .limit(1)
        )
        oldest_pending = oldest_pending.scalar_one_or_none()
        
        # Calculate average wait time for completed tasks today
        today_start = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        completed_today = await db.execute(
            select(PutawayTask)
            .where(
                PutawayTask.status == 'COMPLETED',
                PutawayTask.completed_at >= today_start
            )
        )
        completed_today = completed_today.scalars().all()
        
        wait_times = []
        for task in completed_today:
            if task.assigned_at and task.created_at:
                wait_time = (task.assigned_at - task.created_at).total_seconds() / 60
                wait_times.append(wait_time)
        
        avg_wait = sum(wait_times) / len(wait_times) if wait_times else None
        
        # Get tasks by priority
        priority_counts = {}
        for p in range(1, 11):
            count = await db.execute(
                select(func.count())
                .select_from(PutawayTask)
                .where(
                    PutawayTask.status == 'PENDING',
                    PutawayTask.priority == p
                )
            )
            if count.scalar() > 0:
                priority_counts[p] = count.scalar()
        
        # Get worker availability
        workers = await db.execute(select(WorkerWorkload))
        workers = workers.scalars().all()
        
        workers_available = sum(1 for w in workers if w.total_active_tasks < w.max_concurrent_tasks)
        workers_at_capacity = sum(1 for w in workers if w.total_active_tasks >= w.max_concurrent_tasks)
        
        return {
            "total_pending": pending_count.scalar() or 0,
            "total_assigned": assigned_count.scalar() or 0,
            "total_in_progress": in_progress_count.scalar() or 0,
            "average_wait_time_minutes": round(avg_wait, 2) if avg_wait else None,
            "oldest_task_waiting_minutes": round(
                (datetime.utcnow() - oldest_pending.created_at).total_seconds() / 60, 2
            ) if oldest_pending else None,
            "tasks_by_priority": priority_counts,
            "workers_available": workers_available,
            "workers_at_capacity": workers_at_capacity
        }