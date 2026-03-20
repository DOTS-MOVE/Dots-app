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
