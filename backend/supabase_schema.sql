-- Supabase Database Schema for Dots App
-- Run this SQL in your Supabase SQL Editor to create all required tables
-- Tables are created in dependency order to avoid foreign key errors

-- ============================================================================
-- STEP 1: Create ENUM types (no dependencies)
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('user', 'premium', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE buddy_status AS ENUM ('pending', 'accepted', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE rsvp_status AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE subscription_tier AS ENUM ('free', 'premium');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- STEP 2: Create base tables (no foreign key dependencies)
-- ============================================================================

-- Users table (referenced by many other tables)
-- Note: hashed_password is nullable because Supabase Auth handles authentication
-- We sync users from auth.users to this table via trigger
CREATE TABLE IF NOT EXISTS public.users (
    id SERIAL PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    hashed_password VARCHAR,  -- Nullable: Supabase Auth handles passwords
    full_name VARCHAR,
    age INTEGER,
    bio TEXT,
    location VARCHAR,
    avatar_url VARCHAR,
    cover_image_url VARCHAR,
    role user_role DEFAULT 'user',
    is_active BOOLEAN DEFAULT true,
    is_discoverable BOOLEAN DEFAULT false,
    profile_completed BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE
);

-- Sports table (referenced by events and user_sports)
CREATE TABLE IF NOT EXISTS public.sports (
    id SERIAL PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL,
    icon VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Goals table (referenced by user_goals)
CREATE TABLE IF NOT EXISTS public.goals (
    id SERIAL PRIMARY KEY,
    name VARCHAR UNIQUE NOT NULL,
    description VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Waitlist table (no dependencies)
CREATE TABLE IF NOT EXISTS public.waitlist_entries (
    id SERIAL PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    name VARCHAR,
    city VARCHAR,
    message VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- STEP 3: Create tables that depend on users only
-- ============================================================================

-- User Photos table (depends on users)
CREATE TABLE IF NOT EXISTS public.user_photos (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    photo_url VARCHAR NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_user_photos_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Subscriptions table (depends on users)
CREATE TABLE IF NOT EXISTS public.subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE NOT NULL,
    tier subscription_tier DEFAULT 'free',
    is_active BOOLEAN DEFAULT true,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_subscriptions_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Posts table (depends on users)
CREATE TABLE IF NOT EXISTS public.posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    content TEXT NOT NULL,
    image_url VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_posts_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Buddies table (depends on users - self-referencing)
CREATE TABLE IF NOT EXISTS public.buddies (
    id SERIAL PRIMARY KEY,
    user1_id INTEGER NOT NULL,
    user2_id INTEGER NOT NULL,
    match_score FLOAT,
    status buddy_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_buddies_user1 FOREIGN KEY (user1_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_buddies_user2 FOREIGN KEY (user2_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT check_different_users CHECK (user1_id != user2_id)
);

-- Group Chats table (depends on users)
CREATE TABLE IF NOT EXISTS public.group_chats (
    id SERIAL PRIMARY KEY,
    name VARCHAR NOT NULL,
    description TEXT,
    avatar_url VARCHAR,
    created_by_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_group_chats_created_by FOREIGN KEY (created_by_id) REFERENCES public.users(id)
);

-- ============================================================================
-- STEP 4: Create tables that depend on users and sports
-- ============================================================================

-- Events table (depends on users and sports)
CREATE TABLE IF NOT EXISTS public.events (
    id SERIAL PRIMARY KEY,
    title VARCHAR NOT NULL,
    description TEXT,
    sport_id INTEGER NOT NULL,
    host_id INTEGER NOT NULL,
    location VARCHAR NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE,
    max_participants INTEGER,
    is_cancelled BOOLEAN DEFAULT false,
    is_public BOOLEAN DEFAULT true,
    image_url VARCHAR,
    cover_image_url VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT fk_events_sport FOREIGN KEY (sport_id) REFERENCES public.sports(id),
    CONSTRAINT fk_events_host FOREIGN KEY (host_id) REFERENCES public.users(id)
);

-- ============================================================================
-- STEP 5: Create junction/association tables (many-to-many relationships)
-- ============================================================================

-- User-Sports association table (depends on users and sports)
CREATE TABLE IF NOT EXISTS public.user_sports (
    user_id INTEGER NOT NULL,
    sport_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, sport_id),
    CONSTRAINT fk_user_sports_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_sports_sport FOREIGN KEY (sport_id) REFERENCES public.sports(id) ON DELETE CASCADE
);

-- User-Goals association table (depends on users and goals)
CREATE TABLE IF NOT EXISTS public.user_goals (
    user_id INTEGER NOT NULL,
    goal_id INTEGER NOT NULL,
    PRIMARY KEY (user_id, goal_id),
    CONSTRAINT fk_user_goals_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_goals_goal FOREIGN KEY (goal_id) REFERENCES public.goals(id) ON DELETE CASCADE
);

-- Event RSVPs table (depends on events and users)
CREATE TABLE IF NOT EXISTS public.event_rsvps (
    event_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    attended BOOLEAN DEFAULT false,
    status rsvp_status DEFAULT 'approved',
    rsvp_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (event_id, user_id),
    CONSTRAINT fk_event_rsvps_event FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
    CONSTRAINT fk_event_rsvps_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Group Members table (depends on group_chats and users)
CREATE TABLE IF NOT EXISTS public.group_members (
    group_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id),
    CONSTRAINT fk_group_members_group FOREIGN KEY (group_id) REFERENCES public.group_chats(id) ON DELETE CASCADE,
    CONSTRAINT fk_group_members_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- Likes table (depends on posts and users)
CREATE TABLE IF NOT EXISTS public.likes (
    id SERIAL PRIMARY KEY,
    post_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(post_id, user_id),
    CONSTRAINT fk_likes_post FOREIGN KEY (post_id) REFERENCES public.posts(id) ON DELETE CASCADE,
    CONSTRAINT fk_likes_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE
);

-- ============================================================================
-- STEP 6: Create tables that depend on multiple tables
-- ============================================================================

-- Messages table (depends on users, events, and group_chats)
CREATE TABLE IF NOT EXISTS public.messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL,
    receiver_id INTEGER,
    event_id INTEGER,
    group_id INTEGER,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT fk_messages_sender FOREIGN KEY (sender_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_receiver FOREIGN KEY (receiver_id) REFERENCES public.users(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_event FOREIGN KEY (event_id) REFERENCES public.events(id) ON DELETE CASCADE,
    CONSTRAINT fk_messages_group FOREIGN KEY (group_id) REFERENCES public.group_chats(id) ON DELETE CASCADE
);

-- ============================================================================
-- STEP 7: Create indexes for performance
-- ============================================================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON public.users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_is_discoverable ON public.users(is_discoverable);

-- Sports indexes
CREATE INDEX IF NOT EXISTS idx_sports_name ON public.sports(name);

-- Goals indexes
CREATE INDEX IF NOT EXISTS idx_goals_name ON public.goals(name);

-- User Photos indexes
CREATE INDEX IF NOT EXISTS idx_user_photos_user_id ON public.user_photos(user_id);

-- Events indexes
CREATE INDEX IF NOT EXISTS idx_events_title ON public.events(title);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON public.events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_host_id ON public.events(host_id);
CREATE INDEX IF NOT EXISTS idx_events_sport_id ON public.events(sport_id);

-- Event RSVPs indexes
CREATE INDEX IF NOT EXISTS idx_event_rsvps_event_id ON public.event_rsvps(event_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_user_id ON public.event_rsvps(user_id);
CREATE INDEX IF NOT EXISTS idx_event_rsvps_status ON public.event_rsvps(status);

-- Buddies indexes
CREATE INDEX IF NOT EXISTS idx_buddies_user1_id ON public.buddies(user1_id);
CREATE INDEX IF NOT EXISTS idx_buddies_user2_id ON public.buddies(user2_id);
CREATE INDEX IF NOT EXISTS idx_buddies_status ON public.buddies(status);

-- Posts indexes
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON public.posts(created_at);

-- Likes indexes
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON public.likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user_id ON public.likes(user_id);

-- Messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON public.messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_event_id ON public.messages(event_id);
CREATE INDEX IF NOT EXISTS idx_messages_group_id ON public.messages(group_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at);

-- Group Chats indexes
CREATE INDEX IF NOT EXISTS idx_group_chats_created_by_id ON public.group_chats(created_by_id);

-- Group Members indexes
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members(user_id);

-- Subscriptions indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON public.subscriptions(user_id);

-- Waitlist indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_entries_email ON public.waitlist_entries(email);

-- ============================================================================
-- STEP 8: Grant permissions to PostgREST (Supabase API)
-- ============================================================================

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant table permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant sequence permissions (for SERIAL columns)
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Grant function permissions
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres, anon, authenticated, service_role;

-- ============================================================================
-- STEP 9: Create function to sync users from Supabase Auth
-- ============================================================================

-- Function to handle new user creation from Supabase Auth
-- This automatically creates a record in public.users and public.subscriptions when a user signs up via Supabase Auth
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

    -- Ensure a free subscription exists for this user (idempotent)
    INSERT INTO public.subscriptions (user_id, tier)
    VALUES (new_user_id, 'free')
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically create user record when Supabase Auth user is created
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 10: Notify PostgREST to reload schema cache
-- ============================================================================

-- This tells PostgREST to refresh its schema cache and recognize the new tables
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- Verification Query (optional - run this to verify all tables were created)
-- ============================================================================

-- Uncomment the following to verify tables were created:
-- SELECT 
--     table_schema, 
--     table_name,
--     table_type
-- FROM information_schema.tables 
-- WHERE table_schema = 'public' 
-- AND table_name IN (
--     'users', 'sports', 'goals', 'user_sports', 'user_goals',
--     'user_photos', 'events', 'event_rsvps', 'buddies', 'posts',
--     'likes', 'messages', 'group_chats', 'group_members',
--     'subscriptions', 'waitlist_entries'
-- )
-- ORDER BY table_name;
