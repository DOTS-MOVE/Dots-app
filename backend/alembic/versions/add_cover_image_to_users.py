"""add_cover_image_to_users

Revision ID: add_cover_image
Revises: add_posts_likes
Create Date: 2025-01-20 13:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_cover_image'
down_revision: Union[str, None] = 'add_posts_likes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('cover_image_url', sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'cover_image_url')
