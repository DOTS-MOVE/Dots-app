CREATE OR REPLACE FUNCTION public.get_user_profile_bundle(_user_id integer)
 RETURNS TABLE(id integer, email text, full_name text, age integer, bio text, location text, avatar_url text, cover_image_url text, gender text, is_organisation boolean, is_verified boolean, has_disability boolean, is_discoverable boolean, profile_completed boolean, created_at timestamp with time zone, updated_at timestamp with time zone, sports jsonb, goals jsonb, photos jsonb)
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
            u.gender,
            COALESCE(u.is_organisation, false) AS is_organisation,
            COALESCE(u.is_verified, false) AS is_verified,
            COALESCE(u.has_disability, false) AS has_disability,
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
