"""add_profile_onboarding

Revision ID: add_profile_onboarding
Revises: add_event_admin
Create Date: 2025-01-20 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_profile_onboarding'
down_revision: Union[str, None] = 'add_event_admin'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_discoverable and profile_completed to users
    op.add_column('users', sa.Column('is_discoverable', sa.Boolean(), nullable=False, server_default='false'))
    op.add_column('users', sa.Column('profile_completed', sa.Boolean(), nullable=False, server_default='false'))
    
    # Create user_photos table
    op.create_table(
        'user_photos',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('photo_url', sa.String(), nullable=False),
        sa.Column('display_order', sa.Integer(), nullable=True, server_default='0'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_user_photos_id'), 'user_photos', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_user_photos_id'), table_name='user_photos')
    op.drop_table('user_photos')
    op.drop_column('users', 'profile_completed')
    op.drop_column('users', 'is_discoverable')
