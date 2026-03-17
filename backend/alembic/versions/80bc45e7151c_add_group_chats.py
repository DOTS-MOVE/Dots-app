"""add_group_chats

Revision ID: 80bc45e7151c
Revises: 572cabfaf6d0
Create Date: 2025-11-19 17:18:39.912103

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '80bc45e7151c'
down_revision: Union[str, None] = '572cabfaf6d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create group_chats table
    op.create_table(
        'group_chats',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('avatar_url', sa.String(), nullable=True),
        sa.Column('created_by_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['created_by_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_group_chats_id'), 'group_chats', ['id'], unique=False)
    
    # Create group_members association table
    op.create_table(
        'group_members',
        sa.Column('group_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('is_admin', sa.Boolean(), nullable=True),
        sa.Column('joined_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['group_id'], ['group_chats.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('group_id', 'user_id')
    )
    
    # Add group_id to messages table
    op.add_column('messages', sa.Column('group_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_messages_group_id', 'messages', 'group_chats', ['group_id'], ['id'])


def downgrade() -> None:
    op.drop_constraint('fk_messages_group_id', 'messages', type_='foreignkey')
    op.drop_column('messages', 'group_id')
    op.drop_table('group_members')
    op.drop_index(op.f('ix_group_chats_id'), table_name='group_chats')
    op.drop_table('group_chats')

