"""Add new fields to item_master

Revision ID: 85bfa72b17dc
Revises: 
Create Date: 2026-02-28 10:39:44.344530

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON, UUID

# revision identifiers, used by Alembic.
revision: str = '85bfa72b17dc'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade():
    # Add all the new columns we discussed
    op.add_column('item_master', sa.Column('short_description', sa.String(200), nullable=True))
    op.add_column('item_master', sa.Column('rfid_tag', sa.String(100), nullable=True))
    op.add_column('item_master', sa.Column('uom_hierarchy', JSON, nullable=True))
    op.add_column('item_master', sa.Column('pallet_quantity', sa.Numeric(18, 3), nullable=True))
    op.add_column('item_master', sa.Column('case_quantity', sa.Numeric(18, 3), nullable=True))
    op.add_column('item_master', sa.Column('inner_quantity', sa.Numeric(18, 3), nullable=True))
    op.add_column('item_master', sa.Column('item_category', sa.String(30), nullable=True))
    op.add_column('item_master', sa.Column('velocity_score', sa.Numeric(10, 2), nullable=True))
    op.add_column('item_master', sa.Column('last_velocity_calc', sa.DateTime(), nullable=True))
    op.add_column('item_master', sa.Column('pick_frequency', sa.Integer(), nullable=True, server_default='0'))
    op.add_column('item_master', sa.Column('pick_face_eligible', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('item_master', sa.Column('pick_face_capacity', sa.Numeric(18, 3), nullable=True))
    op.add_column('item_master', sa.Column('pick_face_replenishment_point', sa.Numeric(18, 3), nullable=True))
    op.add_column('item_master', sa.Column('preferred_bin_types', JSON, nullable=True))
    op.add_column('item_master', sa.Column('picking_strategy', sa.String(20), nullable=True))
    op.add_column('item_master', sa.Column('max_stack_height', sa.Integer(), nullable=True))
    op.add_column('item_master', sa.Column('max_qty_per_bin', sa.Numeric(18, 3), nullable=True))
    op.add_column('item_master', sa.Column('is_hazardous', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('item_master', sa.Column('hazard_class', sa.String(30), nullable=True))
    op.add_column('item_master', sa.Column('hazmat_code', sa.String(30), nullable=True))
    op.add_column('item_master', sa.Column('requires_inspection', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('item_master', sa.Column('inspection_rule', sa.String(50), nullable=True))
    op.add_column('item_master', sa.Column('sample_percentage', sa.Integer(), nullable=True, server_default='100'))
    op.add_column('item_master', sa.Column('quarantine_on_failure', sa.Boolean(), nullable=True, server_default='false'))
    op.add_column('item_master', sa.Column('tax_rate', sa.Numeric(10, 2), nullable=True))
    op.add_column('item_master', sa.Column('created_by', sa.String(100), nullable=True))
    op.add_column('item_master', sa.Column('updated_by', sa.String(100), nullable=True))
    
    # Create unique constraint for rfid_tag
    op.create_unique_constraint('uq_item_master_rfid_tag', 'item_master', ['rfid_tag'])


def downgrade():
    # Drop unique constraint first
    op.drop_constraint('uq_item_master_rfid_tag', 'item_master', type_='unique')
    
    # Remove columns if we need to rollback
    op.drop_column('item_master', 'short_description')
    op.drop_column('item_master', 'rfid_tag')
    op.drop_column('item_master', 'uom_hierarchy')
    op.drop_column('item_master', 'pallet_quantity')
    op.drop_column('item_master', 'case_quantity')
    op.drop_column('item_master', 'inner_quantity')
    op.drop_column('item_master', 'item_category')
    op.drop_column('item_master', 'velocity_score')
    op.drop_column('item_master', 'last_velocity_calc')
    op.drop_column('item_master', 'pick_frequency')
    op.drop_column('item_master', 'pick_face_eligible')
    op.drop_column('item_master', 'pick_face_capacity')
    op.drop_column('item_master', 'pick_face_replenishment_point')
    op.drop_column('item_master', 'preferred_bin_types')
    op.drop_column('item_master', 'picking_strategy')
    op.drop_column('item_master', 'max_stack_height')
    op.drop_column('item_master', 'max_qty_per_bin')
    op.drop_column('item_master', 'is_hazardous')
    op.drop_column('item_master', 'hazard_class')
    op.drop_column('item_master', 'hazmat_code')
    op.drop_column('item_master', 'requires_inspection')
    op.drop_column('item_master', 'inspection_rule')
    op.drop_column('item_master', 'sample_percentage')
    op.drop_column('item_master', 'quarantine_on_failure')
    op.drop_column('item_master', 'tax_rate')
    op.drop_column('item_master', 'created_by')
    op.drop_column('item_master', 'updated_by')