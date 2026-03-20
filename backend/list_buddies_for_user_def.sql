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
