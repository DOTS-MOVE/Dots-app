"""add_event_admin_features

Revision ID: add_event_admin
Revises: add_cover_image
Create Date: 2025-01-20 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_event_admin'
down_revision: Union[str, None] = 'add_cover_image'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_public and cover_image_url to events
    op.add_column('events', sa.Column('is_public', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('events', sa.Column('cover_image_url', sa.String(), nullable=True))
    
    # Add status column to event_rsvps table
    op.add_column('event_rsvps', sa.Column('status', sa.String(), nullable=False, server_default='approved'))


def downgrade() -> None:
    op.drop_column('event_rsvps', 'status')
    op.drop_column('events', 'cover_image_url')
    op.drop_column('events', 'is_public')
