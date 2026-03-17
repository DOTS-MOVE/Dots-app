"""add_image_url_to_events

Revision ID: 572cabfaf6d0
Revises: 3cf5c47f0f38
Create Date: 2025-11-19 17:05:04.215222

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '572cabfaf6d0'
down_revision: Union[str, None] = '3cf5c47f0f38'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('events', sa.Column('image_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('events', 'image_url')

