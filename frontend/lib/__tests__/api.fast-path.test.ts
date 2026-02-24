import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiClient } from '../api';

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock('../supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
      refreshSession: mocks.refreshSession,
    },
  },
}));

vi.mock('../apiDebug', () => ({
  logApiEnv: vi.fn(),
  logApiRequest: vi.fn(),
  logApiError: vi.fn().mockResolvedValue({ detail: 'error' }),
}));

describe('ApiClient auth scaffolding', () => {
  beforeEach(() => {
    mocks.getSession.mockReset();
    mocks.refreshSession.mockReset();
    vi.stubGlobal('fetch', vi.fn());
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY', 'pk_test_123');
  });

  it('returns access token from supabase session', async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'access-123',
        },
      },
      error: null,
    });

    const client = new ApiClient();
    await expect(client.getToken()).resolves.toBe('access-123');
  });

  it('throws not authenticated when getCurrentUser has no token', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: null },
      error: null,
    });

    const client = new ApiClient();
    await expect(client.getCurrentUser()).rejects.toThrow('Not authenticated');
  });

  it('on first 401, refreshes session and retries request once', async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'expired-token',
        },
      },
      error: null,
    });
    mocks.refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'fresh-token',
        },
      },
      error: null,
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ email: 'user@dots.test' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient();
    const user = await client.getCurrentUser();

    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(user).toEqual({ email: 'user@dots.test' });
  });

  it('does not retry indefinitely when repeated 401 responses occur', async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'expired-token',
        },
      },
      error: null,
    });
    mocks.refreshSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'fresh-token',
        },
      },
      error: null,
    });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient();
    await expect(client.getCurrentUser()).rejects.toThrow('Failed to fetch user profile');

    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares one refresh call across concurrent 401 requests', async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'expired-token',
        },
      },
      error: null,
    });

    let resolveRefresh: ((value: unknown) => void) | null = null;
    mocks.refreshSession.mockReturnValue(
      new Promise((resolve) => {
        resolveRefresh = resolve;
      })
    );

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ email: 'user1@dots.test' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ email: 'user2@dots.test' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient();
    const p1 = client.getCurrentUser();
    const p2 = client.getCurrentUser();

    resolveRefresh?.({
      data: {
        session: { access_token: 'fresh-token' },
      },
      error: null,
    });

    const [user1, user2] = await Promise.all([p1, p2]);
    expect(mocks.refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(user1).toEqual({ email: 'user1@dots.test' });
    expect(user2).toEqual({ email: 'user2@dots.test' });
  });

  it('clears refresh lock after refresh failure so subsequent calls can retry refresh', async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'expired-token',
        },
      },
      error: null,
    });

    mocks.refreshSession
      .mockResolvedValueOnce({
        data: { session: null },
        error: { message: 'failed' },
      })
      .mockResolvedValueOnce({
        data: { session: { access_token: 'fresh-token-2' } },
        error: null,
      });

    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ detail: 'Unauthorized' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ email: 'recovered@dots.test' }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const client = new ApiClient();
    await expect(client.getCurrentUser()).rejects.toThrow('Not authenticated');
    const recovered = await client.getCurrentUser();

    expect(mocks.refreshSession).toHaveBeenCalledTimes(2);
    expect(recovered).toEqual({ email: 'recovered@dots.test' });
  });
});
