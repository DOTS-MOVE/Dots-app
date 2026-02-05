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

    const initializeAuth = async () => {
      try {
        // getSession can hang; use getSession (faster, storage) with timeout fallback
        let session: { user: any } | null = null;
        try {
          const result = await Promise.race([
            supabase.auth.getSession(),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error('Auth init timeout')), 15000)
            ),
          ]);
          session = result.data?.session ?? null;
          if (result.error) {
            console.warn('Session error:', result.error.message);
          }
        } catch (timeoutErr: any) {
          // AbortError/signal aborted: request cancelled (navigation, unmount) - treat as no session
          if (timeoutErr?.name === 'AbortError' || (timeoutErr?.message ?? '').toLowerCase().includes('aborted')) {
            session = null;
          } else if (timeoutErr?.message === 'Auth init timeout') {
            console.warn('Auth init slow – using anonymous session. Check Supabase config/network.');
          } else {
            console.warn('Auth init:', timeoutErr?.message || timeoutErr);
          }
        }

        if (cancelled) return;
        if (session?.user) {
          if (isEmailConfirmed(session.user)) {
            try {
              const { api } = await import('./api');
              const fullUser = await api.getCurrentUser();
              if (cancelled) return;
              setUser(fullUser);
              setUserFromApi(true);
            } catch (apiError: any) {
              if (cancelled) return;
              const mapped = mapSupabaseUser(session.user);
              if (mapped) {
                setUser(mapped);
                setUserFromApi(false);
              }
            }
          } else {
            await supabase.auth.signOut();
            setUser(null);
            setUserFromApi(false);
          }
        } else {
          setUser(null);
          setUserFromApi(false);
        }
      } catch (error: any) {
        if (cancelled) return;
        if (error?.name === 'AbortError' || (error?.message ?? '').toLowerCase().includes('aborted')) return;
        console.error('Failed to initialize auth:', error.message || error);
        setUser(null);
        setUserFromApi(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') return;

      if (event === 'SIGNED_OUT' || !session) {
        setUser(null);
        setUserFromApi(false);
        setLoading(false);
        return;
      }

      // Defer to next tick to avoid lock race with signInWithPassword (Supabase auth-js locks.ts AbortError)
      const runAfter = event === 'SIGNED_IN' ? () => setTimeout(handleSignedIn, 0) : () => handleSignedIn();
      runAfter();

      async function handleSignedIn() {
        if (cancelled) return;
        if (session?.user) {
          if (isEmailConfirmed(session.user)) {
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
              }
            }
          } else {
            setUser(null);
            setUserFromApi(false);
          }
        } else {
          setUser(null);
          setUserFromApi(false);
        }
        setLoading(false);
      }
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
