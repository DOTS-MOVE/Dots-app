"""Optimize endpoint performance with composite indexes

Revision ID: perf_optimize_endpoints_indexes
Revises: add_profile_onboarding
Create Date: 2026-03-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'perf_optimize_endpoints_indexes'
down_revision: Union[str, None] = 'add_profile_onboarding'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
        IF to_regclass('public.messages') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS ix_messages_receiver_sender_dm
        ON messages (receiver_id, sender_id, created_at DESC)
        WHERE event_id IS NULL AND group_id IS NULL;
        END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$ BEGIN
        IF to_regclass('public.messages') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS ix_messages_sender_receiver_dm
        ON messages (sender_id, receiver_id, created_at DESC)
        WHERE event_id IS NULL AND group_id IS NULL;
        END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$ BEGIN
        IF to_regclass('public.messages') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS ix_messages_event_created_at
        ON messages (event_id, created_at DESC)
        WHERE event_id IS NOT NULL;
        END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$ BEGIN
        IF to_regclass('public.messages') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS ix_messages_group_created_at
        ON messages (group_id, created_at DESC)
        WHERE group_id IS NOT NULL;
        END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$ BEGIN
        IF to_regclass('public.messages') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS ix_messages_receiver_unread
        ON messages (receiver_id, is_read, created_at DESC)
        WHERE event_id IS NULL AND group_id IS NULL;
        END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$ BEGIN
        IF to_regclass('public.event_rsvps') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS ix_event_rsvps_user_status_at
        ON event_rsvps (user_id, status, rsvp_at DESC);
        END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$ BEGIN
        IF to_regclass('public.user_sports') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS ix_user_sports_user_id
        ON user_sports (user_id);
        END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$ BEGIN
        IF to_regclass('public.user_goals') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS ix_user_goals_user_id
        ON user_goals (user_id);
        END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$ BEGIN
        IF to_regclass('public.buddies') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS ix_buddies_user1_status_created
        ON buddies (user1_id, status, created_at DESC);
        END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$ BEGIN
        IF to_regclass('public.buddies') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS ix_buddies_user2_status_created
        ON buddies (user2_id, status, created_at DESC);
        END IF;
        END $$;
        """
    )

    op.execute(
        """
        DO $$ BEGIN
        IF to_regclass('public.user_photos') IS NOT NULL THEN
        CREATE INDEX IF NOT EXISTS ix_user_photos_user_order
        ON user_photos (user_id, display_order);
        END IF;
        END $$;
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_user_photos_user_order;")
    op.execute("DROP INDEX IF EXISTS ix_buddies_user2_status_created;")
    op.execute("DROP INDEX IF EXISTS ix_buddies_user1_status_created;")
    op.execute("DROP INDEX IF EXISTS ix_user_goals_user_id;")
    op.execute("DROP INDEX IF EXISTS ix_user_sports_user_id;")
    op.execute("DROP INDEX IF EXISTS ix_event_rsvps_user_status_at;")
    op.execute("DROP INDEX IF EXISTS ix_messages_receiver_unread;")
    op.execute("DROP INDEX IF EXISTS ix_messages_group_created_at;")
    op.execute("DROP INDEX IF EXISTS ix_messages_event_created_at;")
    op.execute("DROP INDEX IF EXISTS ix_messages_sender_receiver_dm;")
    op.execute("DROP INDEX IF EXISTS ix_messages_receiver_sender_dm;")
