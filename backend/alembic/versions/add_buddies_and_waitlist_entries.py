"""add_buddies_and_waitlist_entries

Revision ID: add_buddies_and_waitlist_entries
Revises: perf_optimize_endpoints_indexes
Create Date: 2026-03-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_buddies_and_waitlist_entries'
down_revision: Union[str, None] = 'perf_optimize_endpoints_indexes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1
                FROM pg_type
                WHERE typname = 'buddy_status'
            ) THEN
                CREATE TYPE buddy_status AS ENUM ('pending', 'accepted', 'rejected');
            END IF;
        END $$;
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.buddies (
            id serial NOT NULL,
            user1_id integer NOT NULL,
            user2_id integer NOT NULL,
            match_score double precision,
            status buddy_status DEFAULT 'pending'::buddy_status,
            created_at timestamptz DEFAULT now(),
            updated_at timestamptz,
            CONSTRAINT buddies_pkey PRIMARY KEY (id),
            CONSTRAINT fk_buddies_user1 FOREIGN KEY (user1_id) REFERENCES users (id),
            CONSTRAINT fk_buddies_user2 FOREIGN KEY (user2_id) REFERENCES users (id)
        );
        CREATE INDEX IF NOT EXISTS ix_buddies_user1_id ON public.buddies (user1_id);
        CREATE INDEX IF NOT EXISTS ix_buddies_user2_id ON public.buddies (user2_id);
        CREATE INDEX IF NOT EXISTS ix_buddies_status ON public.buddies (status);
        """
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS public.waitlist_entries (
            id serial NOT NULL,
            email character varying NOT NULL,
            name character varying,
            city character varying,
            message character varying,
            created_at timestamptz DEFAULT now(),
            CONSTRAINT waitlist_entries_pkey PRIMARY KEY (id),
            CONSTRAINT waitlist_entries_email_key UNIQUE (email)
        );
        CREATE INDEX IF NOT EXISTS ix_waitlist_entries_email ON public.waitlist_entries (email);
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS public.waitlist_entries CASCADE;")
    op.execute("DROP TABLE IF EXISTS public.buddies CASCADE;")
    op.execute(
        """
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1
                FROM pg_type
                WHERE typname = 'buddy_status'
            ) THEN
                DROP TYPE buddy_status;
            END IF;
        END $$;
        """
    )
