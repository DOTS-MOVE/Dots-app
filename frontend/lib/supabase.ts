'use client';

import { createClient } from '@supabase/supabase-js';
import { User } from '@/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';

// Check if environment variables are missing (in production)
if (typeof window !== 'undefined' && (!supabaseUrl || !supabasePublishableKey)) {
  console.error('⚠️ SUPABASE_URL is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY in your environment variables.');
}

// Create a dummy client during build if env vars are missing
let supabaseClient: ReturnType<typeof createClient>;

if (!supabaseUrl || !supabasePublishableKey) {
  // During build time, create a dummy client to avoid errors
  // This will be replaced with the real client at runtime
  if (typeof window === 'undefined') {
    // Server-side/build time: use dummy values
    supabaseClient = createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  } else {
    // Client-side: warn but still create client (will fail gracefully)
    console.warn('⚠️ Supabase URL or Publishable Key not configured. Please check your environment variables.');
    console.warn('For Vercel: Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY in Project Settings → Environment Variables');
    supabaseClient = createClient(supabaseUrl || 'https://placeholder.supabase.co', supabasePublishableKey || 'placeholder-key', {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      global: { headers: { 'X-Requested-With': 'XMLHttpRequest' } },
    });
  }
} else {
  supabaseClient = createClient(supabaseUrl, supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      // Required by Supabase Auth: "Must specify one of: origin, x-requested-with"
      headers: { 'X-Requested-With': 'XMLHttpRequest' },
    },
  });
}

export const supabase = supabaseClient;

// Helper function to convert Supabase user to our User type
export function mapSupabaseUser(supabaseUser: any): User | null {
  if (!supabaseUser) return null;
  
  return {
    id: parseInt(supabaseUser.id) || 0,
    email: supabaseUser.email || '',
    full_name: supabaseUser.user_metadata?.full_name || supabaseUser.user_metadata?.name || null,
    age: supabaseUser.user_metadata?.age || null,
    bio: supabaseUser.user_metadata?.bio || null,
    location: supabaseUser.user_metadata?.location || null,
    avatar_url: supabaseUser.user_metadata?.avatar_url || null,
    cover_image_url: supabaseUser.user_metadata?.cover_image_url || null,
    is_discoverable: supabaseUser.user_metadata?.is_discoverable || false,
    profile_completed: supabaseUser.user_metadata?.profile_completed || false,
    created_at: supabaseUser.created_at || new Date().toISOString(),
    updated_at: supabaseUser.updated_at || null,
  };
}
