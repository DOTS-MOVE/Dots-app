"""add_buddies_self_check

Revision ID: add_buddies_self_check
Revises: add_buddies_and_waitlist_entries
Create Date: 2026-03-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'add_buddies_self_check'
down_revision: Union[str, None] = 'add_buddies_and_waitlist_entries'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF to_regclass('public.buddies') IS NOT NULL THEN
                IF NOT EXISTS (
                    SELECT 1
                    FROM pg_constraint
                    WHERE conname = 'check_different_users'
                      AND conrelid = 'public.buddies'::regclass
                ) THEN
                    ALTER TABLE public.buddies
                    ADD CONSTRAINT check_different_users CHECK (user1_id <> user2_id);
                END IF;
            END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF to_regclass('public.buddies') IS NOT NULL AND EXISTS (
                SELECT 1
                FROM pg_constraint
                WHERE conname = 'check_different_users'
                  AND conrelid = 'public.buddies'::regclass
            ) THEN
                ALTER TABLE public.buddies
                DROP CONSTRAINT check_different_users;
            END IF;
        END $$;
        """
    )
