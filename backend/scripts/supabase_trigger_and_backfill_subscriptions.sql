-- ============================================================================
-- Run in Supabase SQL Editor: trigger + backfill subscriptions to free
-- ============================================================================

-- 1. Trigger function: create public.users + public.subscriptions on new Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_user_id INTEGER;
BEGIN
    INSERT INTO public.users (email, full_name, age, bio, location, avatar_url, cover_image_url, is_discoverable, profile_completed)
    VALUES (
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
        CASE WHEN NEW.raw_user_meta_data->>'age' IS NOT NULL THEN (NEW.raw_user_meta_data->>'age')::INTEGER ELSE NULL END,
        NEW.raw_user_meta_data->>'bio',
        NEW.raw_user_meta_data->>'location',
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.raw_user_meta_data->>'cover_image_url',
        COALESCE((NEW.raw_user_meta_data->>'is_discoverable')::BOOLEAN, false),
        COALESCE((NEW.raw_user_meta_data->>'profile_completed')::BOOLEAN, false)
    )
    ON CONFLICT (email) DO UPDATE SET
        full_name = COALESCE(EXCLUDED.full_name, users.full_name),
        age = COALESCE(EXCLUDED.age, users.age),
        bio = COALESCE(EXCLUDED.bio, users.bio),
        location = COALESCE(EXCLUDED.location, users.location),
        avatar_url = COALESCE(EXCLUDED.avatar_url, users.avatar_url),
        cover_image_url = COALESCE(EXCLUDED.cover_image_url, users.cover_image_url)
    RETURNING id INTO new_user_id;

    INSERT INTO public.subscriptions (user_id, tier)
    VALUES (new_user_id, 'free'::subscription_tier)
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Attach trigger to auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill: give every existing user without a subscription a free subscription
INSERT INTO public.subscriptions (user_id, tier)
SELECT u.id, 'free'::subscription_tier
FROM public.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.subscriptions s WHERE s.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Optional: see how many were backfilled
-- SELECT COUNT(*) FROM public.subscriptions WHERE tier = 'free';

NOTIFY pgrst, 'reload schema';
