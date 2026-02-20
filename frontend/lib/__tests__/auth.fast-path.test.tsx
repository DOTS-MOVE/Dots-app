import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthProvider, useAuth } from '../auth';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
  getUser: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChange: vi.fn(),
  getCurrentUser: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      refreshSession: mocks.refreshSession,
      getUser: mocks.getUser,
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      signOut: mocks.signOut,
      onAuthStateChange: mocks.onAuthStateChange,
    },
  },
  mapSupabaseUser: vi.fn((user: any) => ({
    id: 1,
    email: user?.email ?? 'fallback@example.com',
    full_name: null,
    age: null,
    bio: null,
    location: null,
    avatar_url: null,
    cover_image_url: null,
    is_discoverable: false,
    profile_completed: false,
    created_at: new Date().toISOString(),
    updated_at: null,
  })),
}));

vi.mock('../api', () => ({
  api: {
    getCurrentUser: mocks.getCurrentUser,
  },
}));

function AuthProbe() {
  const { loading, user, userFromApi } = useAuth();

  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="email">{user?.email ?? ''}</div>
      <div data-testid="user-from-api">{String(userFromApi)}</div>
    </div>
  );
}

describe('AuthProvider fast-path scaffolding', () => {
  beforeEach(() => {
    mocks.getCurrentUser.mockReset();
    mocks.getSession.mockReset();
    mocks.refreshSession.mockReset();
    mocks.getUser.mockReset();
    mocks.signInWithPassword.mockReset();
    mocks.signUp.mockReset();
    mocks.signOut.mockReset();
    mocks.onAuthStateChange.mockReset();

    mocks.onAuthStateChange.mockImplementation((cb: any) => {
      // Keep callback for tests that need to trigger events.
      (mocks.onAuthStateChange as any)._cb = cb;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
  });

  it('hydrates authenticated user from API when session is available', async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-1',
          user: { email: 'a@dots.test', email_confirmed_at: '2026-02-20T00:00:00Z' },
        },
      },
      error: null,
    });

    mocks.getCurrentUser.mockResolvedValue({
      id: 123,
      email: 'a@dots.test',
      full_name: 'A',
      age: null,
      bio: null,
      location: null,
      avatar_url: null,
      cover_image_url: null,
      is_discoverable: true,
      profile_completed: true,
      created_at: '2026-02-20T00:00:00Z',
      updated_at: null,
      sports: [],
      goals: [],
      photos: [],
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('email').textContent).toBe('a@dots.test');
    expect(screen.getByTestId('user-from-api').textContent).toBe('true');
  });

  it('does not force anonymous state when init times out but refresh succeeds', async () => {
    mocks.getSession.mockRejectedValue(new Error('Auth init timeout'));
    mocks.refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-2',
          user: { email: 'b@dots.test', email_confirmed_at: '2026-02-20T00:00:00Z' },
        },
      },
      error: null,
    });
    mocks.getCurrentUser.mockResolvedValue({
      id: 456,
      email: 'b@dots.test',
      full_name: 'B',
      age: null,
      bio: null,
      location: null,
      avatar_url: null,
      cover_image_url: null,
      is_discoverable: true,
      profile_completed: true,
      created_at: '2026-02-20T00:00:00Z',
      updated_at: null,
      sports: [],
      goals: [],
      photos: [],
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('email').textContent).toBe('b@dots.test');
  });

  it('treats INITIAL_SESSION with valid session as authenticated hydration path', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });
    mocks.getCurrentUser.mockResolvedValue({
      id: 789,
      email: 'c@dots.test',
      full_name: 'C',
      age: null,
      bio: null,
      location: null,
      avatar_url: null,
      cover_image_url: null,
      is_discoverable: true,
      profile_completed: true,
      created_at: '2026-02-20T00:00:00Z',
      updated_at: null,
      sports: [],
      goals: [],
      photos: [],
    });

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('email').textContent).toBe('');

    await act(async () => {
      await (mocks.onAuthStateChange as any)._cb('INITIAL_SESSION', {
        access_token: 'token-3',
        user: { email: 'c@dots.test', email_confirmed_at: '2026-02-20T00:00:00Z' },
      });
    });

    await waitFor(() => expect(screen.getByTestId('email').textContent).toBe('c@dots.test'));
    expect(screen.getByTestId('user-from-api').textContent).toBe('true');
  });

  it('transitions to signed-out state when init timeout refresh fails', async () => {
    mocks.getSession.mockRejectedValue(new Error('Auth init timeout'));
    mocks.refreshSession.mockRejectedValue(new Error('refresh failed'));

    render(
      <AuthProvider>
        <AuthProbe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('email').textContent).toBe('');
    expect(screen.getByTestId('user-from-api').textContent).toBe('false');
  });
});
