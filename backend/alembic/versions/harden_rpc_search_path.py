"""harden_rpc_search_path

Revision ID: harden_rpc_search_path
Revises: add_endpoint_rpc_optimizations
Create Date: 2026-03-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "harden_rpc_search_path"
down_revision: Union[str, None] = "add_endpoint_rpc_optimizations"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.get_user_profile_bundle(_user_id integer)
        RETURNS TABLE(
            id integer,
            email text,
            full_name text,
            age integer,
            bio text,
            location text,
            avatar_url text,
            cover_image_url text,
            is_discoverable boolean,
            profile_completed boolean,
            created_at timestamptz,
            updated_at timestamptz,
            sports jsonb,
            goals jsonb,
            photos jsonb
        )
        SET search_path = public, pg_temp
        LANGUAGE sql
        AS $$
        SELECT
            u.id,
            u.email,
            u.full_name,
            u.age,
            u.bio,
            u.location,
            u.avatar_url,
            u.cover_image_url,
            COALESCE(u.is_discoverable, false) AS is_discoverable,
            COALESCE(u.profile_completed, false) AS profile_completed,
            u.created_at,
            u.updated_at,
            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object('id', s.id, 'name', s.name, 'icon', s.icon)
                        ORDER BY s.id
                    )
                    FROM user_sports us
                    JOIN sports s ON s.id = us.sport_id
                    WHERE us.user_id = u.id
                ),
                '[]'::jsonb
            ) AS sports,
            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object('id', g.id, 'name', g.name)
                        ORDER BY g.id
                    )
                    FROM user_goals ug
                    JOIN goals g ON g.id = ug.goal_id
                    WHERE ug.user_id = u.id
                ),
                '[]'::jsonb
            ) AS goals,
            COALESCE(
                (
                    SELECT jsonb_agg(
                        jsonb_build_object(
                            'id', up.id,
                            'photo_url', up.photo_url,
                            'display_order', up.display_order
                        )
                        ORDER BY up.display_order
                    )
                    FROM user_photos up
                    WHERE up.user_id = u.id
                ),
                '[]'::jsonb
            ) AS photos
        FROM users u
        WHERE u.id = _user_id;
        $$
        ;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.list_buddies_for_user(_user_id integer, _status_filter text DEFAULT NULL)
        RETURNS TABLE(
            id integer,
            user1_id integer,
            user2_id integer,
            match_score double precision,
            status text,
            created_at timestamptz,
            user1 jsonb,
            user2 jsonb
        )
        SET search_path = public, pg_temp
        LANGUAGE sql
        AS $$
        WITH filtered_buddies AS (
            SELECT b.id, b.user1_id, b.user2_id, b.match_score, b.status, b.created_at
            FROM buddies b
            WHERE (b.user1_id = _user_id OR b.user2_id = _user_id)
            AND (_status_filter IS NULL OR b.status::text = _status_filter)
        )
        SELECT
            b.id,
            b.user1_id,
            b.user2_id,
            b.match_score,
            b.status::text AS status,
            b.created_at,
            jsonb_build_object(
                'id', COALESCE(u1.id, b.user1_id),
                'full_name', u1.full_name,
                'age', u1.age,
                'location', u1.location,
                'avatar_url', u1.avatar_url,
                'bio', u1.bio,
                'sports', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object('id', s.id, 'name', s.name, 'icon', s.icon)
                            ORDER BY s.id
                        )
                        FROM user_sports us
                        JOIN sports s ON s.id = us.sport_id
                        WHERE us.user_id = b.user1_id
                    ),
                    '[]'::jsonb
                ),
                'goals', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object('id', g.id, 'name', g.name)
                            ORDER BY g.id
                        )
                        FROM user_goals ug
                        JOIN goals g ON g.id = ug.goal_id
                        WHERE ug.user_id = b.user1_id
                    ),
                    '[]'::jsonb
                )
            ) AS user1,
            jsonb_build_object(
                'id', COALESCE(u2.id, b.user2_id),
                'full_name', u2.full_name,
                'age', u2.age,
                'location', u2.location,
                'avatar_url', u2.avatar_url,
                'bio', u2.bio,
                'sports', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object('id', s.id, 'name', s.name, 'icon', s.icon)
                            ORDER BY s.id
                        )
                        FROM user_sports us
                        JOIN sports s ON s.id = us.sport_id
                        WHERE us.user_id = b.user2_id
                    ),
                    '[]'::jsonb
                ),
                'goals', COALESCE(
                    (
                        SELECT jsonb_agg(
                            jsonb_build_object('id', g.id, 'name', g.name)
                            ORDER BY g.id
                        )
                        FROM user_goals ug
                        JOIN goals g ON g.id = ug.goal_id
                        WHERE ug.user_id = b.user2_id
                    ),
                    '[]'::jsonb
                )
            ) AS user2
        FROM filtered_buddies b
        LEFT JOIN users u1 ON u1.id = b.user1_id
        LEFT JOIN users u2 ON u2.id = b.user2_id
        ORDER BY b.created_at DESC;
        $$
        ;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.list_conversations_for_user(_user_id integer)
        RETURNS TABLE(
            conversation_type text,
            conversation_id integer,
            name text,
            avatar_url text,
            member_count integer,
            last_message_content text,
            last_message_created_at timestamptz,
            unread_count integer
        )
        SET search_path = public, pg_temp
        LANGUAGE sql
        AS $$
        WITH user_peer_ids AS (
            SELECT DISTINCT x.other_user_id
            FROM (
                SELECT receiver_id AS other_user_id
                FROM messages
                WHERE sender_id = _user_id
                  AND receiver_id IS NOT NULL
                  AND event_id IS NULL
                  AND group_id IS NULL
                UNION
                SELECT sender_id AS other_user_id
                FROM messages
                WHERE receiver_id = _user_id
                  AND sender_id IS NOT NULL
                  AND event_id IS NULL
                  AND group_id IS NULL
            ) x
        ),
        user_conversations AS (
            SELECT
                'user'::text AS conversation_type,
                p.other_user_id AS conversation_id,
                COALESCE(u.full_name, 'Unknown') AS name,
                u.avatar_url,
                0::int AS member_count,
                lm.content AS last_message_content,
                lm.created_at AS last_message_created_at,
                COALESCE((
                    SELECT COUNT(*)
                    FROM messages m2
                    WHERE m2.receiver_id = _user_id
                      AND m2.sender_id = p.other_user_id
                      AND m2.event_id IS NULL
                      AND m2.group_id IS NULL
                      AND m2.is_read = false
                ), 0)::int AS unread_count
            FROM user_peer_ids p
            JOIN users u ON u.id = p.other_user_id
            LEFT JOIN LATERAL (
                SELECT m.content, m.created_at
                FROM messages m
                WHERE (
                    (m.sender_id = _user_id AND m.receiver_id = p.other_user_id) OR
                    (m.sender_id = p.other_user_id AND m.receiver_id = _user_id)
                )
                AND m.event_id IS NULL
                AND m.group_id IS NULL
                ORDER BY m.created_at DESC
                LIMIT 1
            ) lm ON TRUE
        ),
        event_ids AS (
            SELECT DISTINCT m.event_id
            FROM messages m
            WHERE m.sender_id = _user_id
              AND m.event_id IS NOT NULL
        ),
        event_conversations AS (
            SELECT
                'event'::text AS conversation_type,
                e.id AS conversation_id,
                COALESCE(e.title, 'Unknown Event') AS name,
                e.image_url AS avatar_url,
                0::int AS member_count,
                lm.content AS last_message_content,
                lm.created_at AS last_message_created_at,
                0::int AS unread_count
            FROM event_ids ev
            JOIN events e ON e.id = ev.event_id
            LEFT JOIN LATERAL (
                SELECT m.content, m.created_at
                FROM messages m
                WHERE m.event_id = ev.event_id
                ORDER BY m.created_at DESC
                LIMIT 1
            ) lm ON TRUE
        ),
        group_ids AS (
            SELECT DISTINCT gm.group_id
            FROM group_members gm
            WHERE gm.user_id = _user_id
        ),
        group_member_counts AS (
            SELECT gm.group_id, COUNT(*)::int AS member_count
            FROM group_members gm
            GROUP BY gm.group_id
        ),
        group_conversations AS (
            SELECT
                'group'::text AS conversation_type,
                gc.id AS conversation_id,
                COALESCE(gc.name, 'Unknown Group') AS name,
                gc.avatar_url,
                COALESCE(gmc.member_count, 0) AS member_count,
                lm.content AS last_message_content,
                lm.created_at AS last_message_created_at,
                0::int AS unread_count
            FROM group_ids gi
            JOIN group_chats gc ON gc.id = gi.group_id
            LEFT JOIN group_member_counts gmc ON gmc.group_id = gi.group_id
            LEFT JOIN LATERAL (
                SELECT m.content, m.created_at
                FROM messages m
                WHERE m.group_id = gi.group_id
                ORDER BY m.created_at DESC
                LIMIT 1
            ) lm ON TRUE
        )
        SELECT
            conversation_type,
            conversation_id,
            name,
            avatar_url,
            member_count,
            last_message_content,
            last_message_created_at,
            unread_count
        FROM (
            SELECT * FROM user_conversations
            UNION ALL
            SELECT * FROM event_conversations
            UNION ALL
            SELECT * FROM group_conversations
        ) all_conversations
        ORDER BY last_message_created_at DESC NULLS LAST;
        $$
        ;
        """
    )


def downgrade() -> None:
    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.get_user_profile_bundle(_user_id integer)
         RETURNS TABLE(id integer, email text, full_name text, age integer, bio text, location text, avatar_url text, cover_image_url text, is_discoverable boolean, profile_completed boolean, created_at timestamp with time zone, updated_at timestamp with time zone, sports jsonb, goals jsonb, photos jsonb)
         LANGUAGE sql
        AS $function$
                SELECT
                    u.id,
                    u.email,
                    u.full_name,
                    u.age,
                    u.bio,
                    u.location,
                    u.avatar_url,
                    u.cover_image_url,
                    COALESCE(u.is_discoverable, false) AS is_discoverable,
                    COALESCE(u.profile_completed, false) AS profile_completed,
                    u.created_at,
                    u.updated_at,
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object('id', s.id, 'name', s.name, 'icon', s.icon)
                                ORDER BY s.id
                            )
                            FROM user_sports us
                            JOIN sports s ON s.id = us.sport_id
                            WHERE us.user_id = u.id
                        ),
                        '[]'::jsonb
                    ) AS sports,
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object('id', g.id, 'name', g.name)
                                ORDER BY g.id
                            )
                            FROM user_goals ug
                            JOIN goals g ON g.id = ug.goal_id
                            WHERE ug.user_id = u.id
                        ),
                        '[]'::jsonb
                    ) AS goals,
                    COALESCE(
                        (
                            SELECT jsonb_agg(
                                jsonb_build_object(
                                    'id', up.id,
                                    'photo_url', up.photo_url,
                                    'display_order', up.display_order
                                )
                                ORDER BY up.display_order
                            )
                            FROM user_photos up
                            WHERE up.user_id = u.id
                        ),
                        '[]'::jsonb
                    ) AS photos
                FROM users u
                WHERE u.id = _user_id;
                $function$
        ;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.list_buddies_for_user(_user_id integer, _status_filter text DEFAULT NULL::text)
         RETURNS TABLE(id integer, user1_id integer, user2_id integer, match_score double precision, status text, created_at timestamp with time zone, user1 jsonb, user2 jsonb)
         LANGUAGE sql
        AS $function$
                WITH filtered_buddies AS (
                    SELECT b.id, b.user1_id, b.user2_id, b.match_score, b.status, b.created_at
                    FROM buddies b
                    WHERE (b.user1_id = _user_id OR b.user2_id = _user_id)
                    AND (_status_filter IS NULL OR b.status::text = _status_filter)
                )
                SELECT
                    b.id,
                    b.user1_id,
                    b.user2_id,
                    b.match_score,
                    b.status::text AS status,
                    b.created_at,
                    jsonb_build_object(
                        'id', COALESCE(u1.id, b.user1_id),
                        'full_name', u1.full_name,
                        'age', u1.age,
                        'location', u1.location,
                        'avatar_url', u1.avatar_url,
                        'bio', u1.bio,
                        'sports', COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object('id', s.id, 'name', s.name, 'icon', s.icon)
                                    ORDER BY s.id
                                )
                                FROM user_sports us
                                JOIN sports s ON s.id = us.sport_id
                                WHERE us.user_id = b.user1_id
                            ),
                            '[]'::jsonb
                        ),
                        'goals', COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object('id', g.id, 'name', g.name)
                                    ORDER BY g.id
                                )
                                FROM user_goals ug
                                JOIN goals g ON g.id = ug.goal_id
                                WHERE ug.user_id = b.user1_id
                            ),
                            '[]'::jsonb
                        )
                    ) AS user1,
                    jsonb_build_object(
                        'id', COALESCE(u2.id, b.user2_id),
                        'full_name', u2.full_name,
                        'age', u2.age,
                        'location', u2.location,
                        'avatar_url', u2.avatar_url,
                        'bio', u2.bio,
                        'sports', COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object('id', s.id, 'name', s.name, 'icon', s.icon)
                                    ORDER BY s.id
                                )
                                FROM user_sports us
                                JOIN sports s ON s.id = us.sport_id
                                WHERE us.user_id = b.user2_id
                            ),
                            '[]'::jsonb
                        ),
                        'goals', COALESCE(
                            (
                                SELECT jsonb_agg(
                                    jsonb_build_object('id', g.id, 'name', g.name)
                                    ORDER BY g.id
                                )
                                FROM user_goals ug
                                JOIN goals g ON g.id = ug.goal_id
                                WHERE ug.user_id = b.user2_id
                            ),
                            '[]'::jsonb
                        )
                    ) AS user2
                FROM filtered_buddies b
                LEFT JOIN users u1 ON u1.id = b.user1_id
                LEFT JOIN users u2 ON u2.id = b.user2_id
                ORDER BY b.created_at DESC;
                $function$
        ;
        """
    )

    op.execute(
        """
        CREATE OR REPLACE FUNCTION public.list_conversations_for_user(_user_id integer)
         RETURNS TABLE(conversation_type text, conversation_id integer, name text, avatar_url text, member_count integer, last_message_content text, last_message_created_at timestamp with time zone, unread_count integer)
         LANGUAGE sql
        AS $function$
                WITH user_peer_ids AS (
                    SELECT DISTINCT x.other_user_id
                    FROM (
                        SELECT receiver_id AS other_user_id
                        FROM messages
                        WHERE sender_id = _user_id
                          AND receiver_id IS NOT NULL
                          AND event_id IS NULL
                          AND group_id IS NULL
                        UNION
                        SELECT sender_id AS other_user_id
                        FROM messages
                        WHERE receiver_id = _user_id
                          AND sender_id IS NOT NULL
                          AND event_id IS NULL
                          AND group_id IS NULL
                    ) x
                ),
                user_conversations AS (
                    SELECT
                        'user'::text AS conversation_type,
                        p.other_user_id AS conversation_id,
                        COALESCE(u.full_name, 'Unknown') AS name,
                        u.avatar_url,
                        0::int AS member_count,
                        lm.content AS last_message_content,
                        lm.created_at AS last_message_created_at,
                        COALESCE((
                            SELECT COUNT(*)
                            FROM messages m2
                            WHERE m2.receiver_id = _user_id
                              AND m2.sender_id = p.other_user_id
                              AND m2.event_id IS NULL
                              AND m2.group_id IS NULL
                              AND m2.is_read = false
                        ), 0)::int AS unread_count
                    FROM user_peer_ids p
                    JOIN users u ON u.id = p.other_user_id
                    LEFT JOIN LATERAL (
                        SELECT m.content, m.created_at
                        FROM messages m
                        WHERE (
                            (m.sender_id = _user_id AND m.receiver_id = p.other_user_id) OR
                            (m.sender_id = p.other_user_id AND m.receiver_id = _user_id)
                        )
                        AND m.event_id IS NULL
                        AND m.group_id IS NULL
                        ORDER BY m.created_at DESC
                        LIMIT 1
                    ) lm ON TRUE
                ),
                event_ids AS (
                    SELECT DISTINCT m.event_id
                    FROM messages m
                    WHERE m.sender_id = _user_id
                      AND m.event_id IS NOT NULL
                ),
                event_conversations AS (
                    SELECT
                        'event'::text AS conversation_type,
                        e.id AS conversation_id,
                        COALESCE(e.title, 'Unknown Event') AS name,
                        e.image_url AS avatar_url,
                        0::int AS member_count,
                        lm.content AS last_message_content,
                        lm.created_at AS last_message_created_at,
                        0::int AS unread_count
                    FROM event_ids ev
                    JOIN events e ON e.id = ev.event_id
                    LEFT JOIN LATERAL (
                        SELECT m.content, m.created_at
                        FROM messages m
                        WHERE m.event_id = ev.event_id
                        ORDER BY m.created_at DESC
                        LIMIT 1
                    ) lm ON TRUE
                ),
                group_ids AS (
                    SELECT DISTINCT gm.group_id
                    FROM group_members gm
                    WHERE gm.user_id = _user_id
                ),
                group_member_counts AS (
                    SELECT gm.group_id, COUNT(*)::int AS member_count
                    FROM group_members gm
                    GROUP BY gm.group_id
                ),
                group_conversations AS (
                    SELECT
                        'group'::text AS conversation_type,
                        gc.id AS conversation_id,
                        COALESCE(gc.name, 'Unknown Group') AS name,
                        gc.avatar_url,
                        COALESCE(gmc.member_count, 0) AS member_count,
                        lm.content AS last_message_content,
                        lm.created_at AS last_message_created_at,
                        0::int AS unread_count
                    FROM group_ids gi
                    JOIN group_chats gc ON gc.id = gi.group_id
                    LEFT JOIN group_member_counts gmc ON gmc.group_id = gi.group_id
                    LEFT JOIN LATERAL (
                        SELECT m.content, m.created_at
                        FROM messages m
                        WHERE m.group_id = gi.group_id
                        ORDER BY m.created_at DESC
                        LIMIT 1
                    ) lm ON TRUE
                )
                SELECT
                    conversation_type,
                    conversation_id,
                    name,
                    avatar_url,
                    member_count,
                    last_message_content,
                    last_message_created_at,
                    unread_count
                FROM (
                    SELECT * FROM user_conversations
                    UNION ALL
                    SELECT * FROM event_conversations
                    UNION ALL
                    SELECT * FROM group_conversations
                ) all_conversations
                ORDER BY last_message_created_at DESC NULLS LAST;
                $function$
        ;
        """
    )
