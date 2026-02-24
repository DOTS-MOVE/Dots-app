'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase, mapSupabaseUser } from './supabase';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  /** True only when user was fetched from API (users table). False when using fallback - never show profile onboarding in that case. */
  userFromApi: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userFromApi, setUserFromApi] = useState(false);
  const [loading, setLoading] = useState(true);

  // Helper to check if user email is confirmed
  const isEmailConfirmed = (supabaseUser: any): boolean => {
    return supabaseUser?.email_confirmed_at !== null && supabaseUser?.email_confirmed_at !== undefined;
  };

  useEffect(() => {
    let cancelled = false;

    const hydrateFromSession = async (session: any | null) => {
      if (cancelled) return;

      if (!session?.user) {
        setUser(null);
        setUserFromApi(false);
        setLoading(false);
        return;
      }

      if (!isEmailConfirmed(session.user)) {
        await supabase.auth.signOut();
        if (cancelled) return;
        setUser(null);
        setUserFromApi(false);
        setLoading(false);
        return;
      }

      try {
        const { api } = await import('./api');
        const fullUser = await api.getCurrentUser(session?.access_token ?? undefined);
        if (cancelled) return;
        setUser(fullUser);
        setUserFromApi(true);
      } catch (apiError: any) {
        if (cancelled) return;
        if (apiError?.name === 'AbortError' || (apiError?.message ?? '').toLowerCase().includes('aborted')) return;
        const mapped = mapSupabaseUser(session.user);
        if (mapped) {
          setUser(mapped);
          setUserFromApi(false);
        } else {
          setUser(null);
          setUserFromApi(false);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const initializeAuth = async () => {
      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Auth init timeout')), 4000)
          ),
        ]);
        if (cancelled) return;

        if (result.error) {
          console.warn('Session error:', result.error.message);
        }

        await hydrateFromSession(result.data?.session ?? null);
      } catch (error: any) {
        if (cancelled) return;
        if (error?.name === 'AbortError' || (error?.message ?? '').toLowerCase().includes('aborted')) return;

        if (error?.message === 'Auth init timeout') {
          console.warn('Auth init slow - attempting session refresh.');
          try {
            const refreshed = await Promise.race([
              supabase.auth.refreshSession(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Auth refresh timeout')), 4000)
              ),
            ]);
            if (cancelled) return;
            await hydrateFromSession(refreshed.data?.session ?? null);
            return;
          } catch (refreshError: any) {
            if (cancelled) return;
            console.warn('Auth init refresh failed:', refreshError?.message || refreshError);
            await hydrateFromSession(null);
            return;
          }
        }

        console.error('Failed to initialize auth:', error.message || error);
        await hydrateFromSession(null);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setUserFromApi(false);
        setLoading(false);
        return;
      }

      // Defer to next tick to avoid lock race with signInWithPassword (Supabase auth-js locks.ts AbortError)
      const runAfter = event === 'SIGNED_IN'
        ? () => setTimeout(() => { void hydrateFromSession(session); }, 0)
        : () => { void hydrateFromSession(session); };
      runAfter();
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const refreshUser = async () => {
    try {
      const { data: { user: supabaseUser }, error } = await supabase.auth.getUser();
      if (error) {
        setUser(null);
        setUserFromApi(false);
        return;
      }

      if (supabaseUser && isEmailConfirmed(supabaseUser)) {
        try {
          const { api } = await import('./api');
          const fullUser = await api.getCurrentUser();
          setUser(fullUser);
          setUserFromApi(true);
        } catch (apiError: any) {
          console.warn('Failed to fetch full user profile from API:', apiError.message);
          const mapped = mapSupabaseUser(supabaseUser);
          setUser(mapped);
          setUserFromApi(false);
        }
      } else {
        setUser(null);
        setUserFromApi(false);
      }
    } catch (error: any) {
      if (error?.name === 'AbortError' || (error?.message ?? '').toLowerCase().includes('aborted')) return;
      console.error('Failed to fetch user:', error);
      setUser(null);
      setUserFromApi(false);
    }
  };

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.user) {
      if (!isEmailConfirmed(data.user)) {
        await supabase.auth.signOut();
        throw new Error('Please confirm your email before signing in. Check your inbox for the confirmation link.');
      }
      // Use token from signIn response - avoids getSession call that can hang
      const token = data.session?.access_token;
      try {
        const { api } = await import('./api');
        const fullUser = await api.getCurrentUser(token);
        setUser(fullUser);
        setUserFromApi(true);
      } catch (apiError) {
        const mapped = mapSupabaseUser(data.user);
        setUser(mapped);
        setUserFromApi(false);
      }
    }
  };

  const register = async (email: string, password: string, fullName: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    // Don't set user - they need to confirm email first
    // Return status to show confirmation message
    return {
      needsConfirmation: data.user !== null && !isEmailConfirmed(data.user),
    };
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Error signing out:', error);
    }
    setUser(null);
    setUserFromApi(false);
  };

  return (
    <AuthContext.Provider value={{ user, userFromApi, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
