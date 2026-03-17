import { Event, Sport, User, Buddy, GroupChat, Conversation, Goal, Message, GroupMember, Post } from '@/types';
import { logApiEnv, logApiRequest, logApiError } from './apiDebug';
import { supabase } from './supabase';
import { classifyAuthFailure, createAuthRequestId, logAuthEvent, recordAuthFailure } from './authDiagnostics';

/** Retry only on transient errors (timeout, network). Does not retry on AbortError or 4xx. */
function isRetryableError(e: any): boolean {
  if (e?.name === 'AbortError') return false;
  const msg = e?.message ?? '';
  return (
    msg === 'Request timeout' ||
    msg.includes('timeout') ||
    msg === 'Failed to fetch' ||
    msg.includes('fetch') ||
    msg.includes('Unable to connect')
  );
}

async function withRetry<T>(
  fn: () => Promise<T>,
  opts: { retries?: number; delayMs?: number } = {}
): Promise<T> {
  const { retries = 2, delayMs = 1200 } = opts;
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (e: any) {
      lastError = e;
      if (attempt < retries && isRetryableError(e)) {
        await new Promise((r) => setTimeout(r, delayMs));
        continue;
      }
      throw e;
    }
  }
  throw lastError;
}

export class ApiClient {
  private localBuddies: Buddy[] = [];
  private localMessages: Message[] = [];
  private localEvents: Event[] = [];
  private rsvpEvents: Set<number> = new Set();
  private baseUrl: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  private _debugLogged = false;
  private refreshInFlight: Promise<string | null> | null = null;

  private ensureDebugLogged() {
    if (this._debugLogged || typeof window === 'undefined') return;
    this._debugLogged = true;
    logApiEnv();
  }

  async getToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    this.ensureDebugLogged();

    // Check if Supabase is properly configured
    // Note: NEXT_PUBLIC_ variables are embedded at BUILD TIME in Next.js
    // If you just added them to Vercel, you need to trigger a new deployment
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;
    
    if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
      console.error('Supabase environment check failed:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        urlValue: supabaseUrl?.substring(0, 20) + '...',
      });
      throw new Error('Authentication failed: Supabase environment variables are not available. If you just added them to Vercel, please trigger a new deployment. Environment variables prefixed with NEXT_PUBLIC_ are embedded at build time and require a redeploy.');
    }
    
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Supabase auth error:', error);
        throw new Error(error.message || 'Authentication failed');
      }
      
      return session?.access_token || null;
    } catch (error: any) {
      // AbortError: getSession/refresh was cancelled (e.g. navigation, unmount) - treat as no token
      if (error?.name === 'AbortError' || (error?.message ?? '').toLowerCase().includes('aborted')) {
        return null;
      }
      console.error('Failed to get token:', error);
      
      // If it's already our custom error, re-throw it
      if (error.message && error.message.includes('Supabase is not configured')) {
        throw error;
      }
      
      // For other Supabase errors, provide helpful message
      if (error.message && error.message.includes('Invalid API key') || error.message.includes('Invalid URL')) {
        throw new Error('Authentication failed: Supabase configuration is invalid. Please check your environment variables.');
      }
      
      throw new Error(error.message || 'Authentication failed. Please check your connection and try again.');
    }
  }

  setToken(token: string | null) {
    // Token is managed by Supabase, this is kept for compatibility
  }

  private async refreshAccessToken(requestId?: string): Promise<string | null> {
    if (!this.refreshInFlight) {
      logAuthEvent('log', 'auth.refresh.start', {
        method: 'getCurrentUser',
        path: '/users/me',
        requestId,
        refreshAttempted: true,
      });
      this.refreshInFlight = (async () => {
        try {
          const { data, error } = await supabase.auth.refreshSession();
          const token = error ? null : (data.session?.access_token || null);
          logAuthEvent('log', 'auth.refresh.done', {
            method: 'getCurrentUser',
            path: '/users/me',
            requestId,
            refreshAttempted: true,
            refreshSucceeded: !!token,
            reason: token ? undefined : 'refresh_failed',
          });
          return token;
        } catch {
          logAuthEvent('warn', 'auth.refresh.done', {
            method: 'getCurrentUser',
            path: '/users/me',
            requestId,
            refreshAttempted: true,
            refreshSucceeded: false,
            reason: 'refresh_failed',
          });
          return null;
        } finally {
          this.refreshInFlight = null;
        }
      })();
    } else {
      logAuthEvent('log', 'auth.refresh.reuse', {
        method: 'getCurrentUser',
        path: '/users/me',
        requestId,
        refreshAttempted: true,
      });
    }
    return this.refreshInFlight;
  }

  // Auth is handled by Supabase in lib/auth.tsx; these are unused stubs.
  async register(_email: string, _password: string, _fullName: string): Promise<{ access_token: string; token_type: string }> {
    throw new Error('Use the auth context (register) for sign-up.');
  }

  async login(_email: string, _password: string): Promise<{ access_token: string; token_type: string }> {
    throw new Error('Use the auth context (login) for sign-in.');
  }

  // Users - Uses Promise.race for timeout (no AbortController) to avoid "signal is aborted" errors. Retries on timeout/network.
  async getCurrentUser(accessToken?: string | null): Promise<User> {
    this.ensureDebugLogged();
    const initialToken = accessToken ?? (await this.getToken());
    const requestId = createAuthRequestId();
    if (!initialToken) {
      logApiRequest('getCurrentUser', `${this.baseUrl}/users/me`, { hasToken: false });
      const reason = classifyAuthFailure({ hasToken: false });
      logAuthEvent('warn', 'auth.request.unauthenticated', {
        method: 'getCurrentUser',
        path: '/users/me',
        requestId,
        refreshAttempted: false,
        reason,
      });
      recordAuthFailure({
        method: 'getCurrentUser',
        path: '/users/me',
        requestId,
        refreshAttempted: false,
        reason,
      });
      throw new Error('Not authenticated');
    }

    const url = `${this.baseUrl}/users/me`;
    logApiRequest('getCurrentUser', url, { hasToken: true });
    const timeoutMs = 8000; // 8s - fast fallback for login
    const fetchWithTimeout = async (token: string) => {
      const fetchPromise = fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Request-ID': requestId,
        },
      });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeoutMs)
      );
      return Promise.race([fetchPromise, timeoutPromise]);
    };

    try {
      let response = await fetchWithTimeout(initialToken);
      let refreshAttempted = false;
      let refreshSucceeded = false;

      if (response.status === 401) {
        refreshAttempted = true;
        logAuthEvent('warn', 'auth.request.401.initial', {
          method: 'getCurrentUser',
          path: '/users/me',
          requestId,
          status: response.status,
          refreshAttempted,
          refreshSucceeded: false,
          reason: classifyAuthFailure({
            hasToken: true,
            status: response.status,
          }),
        });

        const refreshedToken = await this.refreshAccessToken(requestId);
        if (!refreshedToken) {
          const reason = classifyAuthFailure({
            hasToken: true,
            status: response.status,
            refreshAttempted: true,
            refreshSucceeded: false,
          });
          logAuthEvent('error', 'auth.refresh.failed', {
            method: 'getCurrentUser',
            path: '/users/me',
            requestId,
            status: response.status,
            refreshAttempted: true,
            refreshSucceeded: false,
            reason,
          });
          recordAuthFailure({
            method: 'getCurrentUser',
            path: '/users/me',
            requestId,
            status: response.status,
            refreshAttempted: true,
            refreshSucceeded: false,
            reason,
          });
          throw new Error('Not authenticated');
        }

        refreshSucceeded = true;
        response = await fetchWithTimeout(refreshedToken);
      }
      if (!response.ok) {
        const reason = classifyAuthFailure({
          hasToken: true,
          status: response.status,
          retryStatus: response.status,
          refreshAttempted,
          refreshSucceeded,
        });
        logAuthEvent('warn', 'auth.request.failed', {
          method: 'getCurrentUser',
          path: '/users/me',
          requestId,
          status: response.status,
          retryStatus: response.status,
          refreshAttempted,
          refreshSucceeded,
          reason,
        });
        recordAuthFailure({
          method: 'getCurrentUser',
          path: '/users/me',
          requestId,
          status: response.status,
          retryStatus: response.status,
          refreshAttempted,
          refreshSucceeded,
          reason,
        });
        await logApiError('getCurrentUser', url, response, { hasToken: true });
        throw new Error('Failed to fetch user profile');
      }
      return response.json();
    } catch (e: any) {
      if (e?.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      if (e?.message === 'Failed to fetch') {
        throw new Error('Unable to connect to the server. Please check your connection.');
      }
      throw e;
    }
  }

  async getUser(userId: number, opts?: { signal?: AbortSignal }): Promise<User> {
    return withRetry(async () => {
      const token = await this.getToken();
      const headers: HeadersInit = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

      const fetchPromise = fetch(`${this.baseUrl}/users/${userId}`, { headers, signal: opts?.signal });
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 18000)
      );
      try {
        const response = await Promise.race([fetchPromise, timeoutPromise]);
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch user' }));
          throw new Error(errorData.detail || 'Failed to fetch user');
        }
        return response.json();
      } catch (error: any) {
        if (error?.name === 'AbortError') throw error;
        if (error?.message === 'Failed to fetch' || error?.message?.includes('fetch')) {
          throw new Error('Unable to connect to the server. Please check your connection.');
        }
        throw error;
      }
    }, { retries: 2, delayMs: 1000 });
  }

  async updateUser(data: any): Promise<User> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased to 15 seconds

    try {
      console.log('Sending updateUser request to:', `${this.baseUrl}/users/me`);
      console.log('Request data:', data);
      const response = await fetch(`${this.baseUrl}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('updateUser response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('updateUser error response:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { detail: errorText || 'Failed to update user' };
        }
        throw new Error(error.detail || error.message || 'Failed to update user');
      }

      const result = await response.json();
      console.log('updateUser success:', result);
      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('updateUser error:', error);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - the server may be slow or unavailable. Please try again.');
      }
          if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
            throw new Error('Unable to connect to the server. Please check your connection.');
          }
      throw error;
    }
  }

  async addUserPhoto(photoUrl: string, displayOrder: number = 0): Promise<any> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.baseUrl}/users/me/photos`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ photo_url: photoUrl, display_order: displayOrder }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to add photo' }));
        throw new Error(error.detail || 'Failed to add photo');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async deleteUserPhoto(photoId: number): Promise<void> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.baseUrl}/users/me/photos/${photoId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete photo' }));
        throw new Error(error.detail || 'Failed to delete photo');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async completeProfile(isDiscoverable: boolean): Promise<User> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // Increased to 15 seconds

    try {
      console.log('Sending completeProfile request to:', `${this.baseUrl}/users/me/complete-profile`);
      console.log('Request data:', { is_discoverable: isDiscoverable });
      const response = await fetch(`${this.baseUrl}/users/me/complete-profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ is_discoverable: isDiscoverable }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      console.log('completeProfile response status:', response.status);
      if (!response.ok) {
        const errorText = await response.text();
        console.error('completeProfile error response:', errorText);
        let error;
        try {
          error = JSON.parse(errorText);
        } catch {
          error = { detail: errorText || 'Failed to complete profile' };
        }
        throw new Error(error.detail || error.message || 'Failed to complete profile');
      }

      const result = await response.json();
      console.log('completeProfile success:', result);
      return result;
    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error('completeProfile error:', error);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - the server may be slow or unavailable. Please try again.');
      }
          if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
            throw new Error('Unable to connect to the server. Please check your connection.');
          }
      throw error;
    }
  }

  // Events - Promise.race for timeout (no AbortController)
  async getEvents(params?: { sport_id?: number; location?: string; search?: string }): Promise<Event[]> {
    const queryParams = new URLSearchParams();
    if (params?.sport_id) queryParams.append('sport_id', params.sport_id.toString());
    if (params?.location) queryParams.append('location', params.location);
    if (params?.search) queryParams.append('search', params.search);
    const queryString = queryParams.toString();
    const url = `${this.baseUrl}/events${queryString ? `?${queryString}` : ''}`;

    const fetchPromise = fetch(url, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 10000)
    );

    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      if (!response.ok) {
        const parsed = await logApiError('getEvents', url, response);
        const msg = typeof parsed === 'string' ? parsed : (parsed as { detail?: string })?.detail || 'Failed to fetch events';
        throw new Error(msg);
      }
      return response.json();
    } catch (error: any) {
      if (error.message === 'Failed to fetch' || error.message?.includes('fetch')) {
        console.warn('Backend not available for getEvents, returning empty array');
        return [];
      }
      if (error.message === 'Request timeout') {
        console.warn('getEvents timeout');
        return [];
      }
      throw error;
    }
  }

  async getEvent(eventId: number, opts?: { signal?: AbortSignal }): Promise<Event> {
    const token = await this.getToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const fetchPromise = fetch(`${this.baseUrl}/events/${eventId}`, {
      method: 'GET',
      headers,
      signal: opts?.signal,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 10000)
    );

    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to fetch event');
        console.error('getEvent error:', errorText);
        throw new Error(errorText || 'Failed to fetch event');
      }

      return response.json();
    } catch (error: any) {
      if (error?.name === 'AbortError') throw error;
      if (error?.message === 'Request timeout') throw new Error('Request timeout - please check your connection');
      if (error?.message === 'Failed to fetch' || error?.message?.includes?.('fetch')) {
        throw new Error('Failed to fetch event');
      }
      throw error;
    }
  }

  async createEvent(data: any): Promise<Event> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create event' }));
        throw new Error(error.detail || 'Failed to create event');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async updateEvent(eventId: number, data: any): Promise<Event> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/events/${eventId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update event' }));
        throw new Error(error.detail || 'Failed to update event');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async deleteEvent(eventId: number): Promise<void> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete event' }));
        throw new Error(error.detail || 'Failed to delete event');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async rsvpEvent(eventId: number): Promise<Event> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.baseUrl}/events/${eventId}/rsvp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to RSVP' }));
        throw new Error(error.detail || 'Failed to RSVP');
      }

      const event = await response.json();
      this.rsvpEvents.add(eventId);
      return event;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async cancelRsvp(eventId: number): Promise<void> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.baseUrl}/events/${eventId}/rsvp`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        const message = (errBody as { detail?: string })?.detail ?? 'Failed to cancel RSVP';
        throw new Error(message);
      }

      this.rsvpEvents.delete(eventId);
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  // Event Admin Methods
  async getEventRSVPs(eventId: number): Promise<{ approved: User[]; pending: User[]; rejected: User[] }> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.baseUrl}/events/${eventId}/rsvps`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to fetch RSVPs');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async approveRSVP(eventId: number, userId: number): Promise<void> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.baseUrl}/events/${eventId}/rsvps/${userId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to approve RSVP' }));
        throw new Error(error.detail || 'Failed to approve RSVP');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async rejectRSVP(eventId: number, userId: number): Promise<void> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.baseUrl}/events/${eventId}/rsvps/${userId}/reject`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to reject RSVP' }));
        throw new Error(error.detail || 'Failed to reject RSVP');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async removeParticipant(eventId: number, userId: number): Promise<void> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.baseUrl}/events/${eventId}/rsvps/${userId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to remove participant' }));
        throw new Error(error.detail || 'Failed to remove participant');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  // Buddies
  async getSuggestedBuddies(limit = 10, minScore = 30, offset = 0, opts?: { signal?: AbortSignal }): Promise<any[]> {
    const token = await this.getToken();
    if (!token) return [];
    if (opts?.signal?.aborted) return [];

    const queryParams = new URLSearchParams();
    queryParams.append('limit', limit.toString());
    queryParams.append('min_score', minScore.toString());
    queryParams.append('offset', offset.toString());

    const fetchPromise = fetch(`${this.baseUrl}/buddies/suggested?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      signal: opts?.signal,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 15000)
    );

    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let detail = 'Failed to fetch suggested buddies';
        try {
          const errJson = JSON.parse(errorText);
          detail = errJson.detail || detail;
        } catch {
          detail = errorText || detail;
        }
        const detailStr = typeof detail === 'string' ? detail : JSON.stringify(detail);
        const detailLower = detailStr.toLowerCase();
        if (
          response.status === 401 ||
          response.status === 403 ||
          response.status >= 500 ||
          detailLower.includes('discovery') ||
          detailLower.includes('server disconnected') ||
          detailLower.includes('authentication failed')
        ) {
          return [];
        }
        throw new Error(detailStr);
      }

      return response.json();
    } catch (error: any) {
      if (error?.name === 'AbortError') return [];
      if (error?.message === 'Request timeout') return [];
      if (error?.message === 'Failed to fetch' || error?.message?.includes?.('fetch')) return [];
      throw error;
    }
  }

  async getBuddies(status?: string, opts?: { signal?: AbortSignal }): Promise<Buddy[]> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }
    if (opts?.signal?.aborted) return [];

    let url = `${this.baseUrl}/buddies`;
    if (status) url += `?status=${status}`;
    const fetchPromise = fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` },
      signal: opts?.signal,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 10000)
    );
    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        let detail = 'Failed to fetch buddies';
        try {
          const err = JSON.parse(errorText);
          detail = err.detail || detail;
        } catch {
          detail = errorText || detail;
        }
        if (response.status >= 500 || (detail && typeof detail === 'string' && detail.toLowerCase().includes('server disconnected'))) {
          return [];
        }
        throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
      }

      return response.json();
    } catch (error: any) {
      if (error?.name === 'AbortError') return [];
      if (error?.message === 'Request timeout') return [];
      if (error?.message === 'Failed to fetch' || error?.message?.includes('fetch')) return [];
      throw error;
    }
  }

  async createBuddy(user2Id: number, message?: string): Promise<Buddy> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.baseUrl}/buddies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ user2_id: user2Id }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create buddy request' }));
        throw new Error(error.detail || 'Failed to create buddy request');
      }

      const buddy = await response.json();

      // If message provided, send it after creating the buddy
      if (message && buddy.id) {
        try {
          await this.sendMessage({
            content: message,
            receiver_id: user2Id,
          });
        } catch (error) {
          console.warn('Failed to send initial message, but buddy request was created:', error);
        }
      }

      return buddy;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async updateBuddy(buddyId: number, status: 'accepted' | 'rejected'): Promise<Buddy> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.baseUrl}/buddies/${buddyId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update buddy' }));
        throw new Error(error.detail || 'Failed to update buddy');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async deleteBuddy(buddyId: number): Promise<void> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.baseUrl}/buddies/${buddyId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to delete buddy' }));
        throw new Error(error.detail || 'Failed to delete buddy');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  // Messages - single-flight when no signal; direct fetch with signal for abort-on-navigate
  private _conversationsPromise: Promise<Conversation[]> | null = null;

  async getConversations(opts?: { signal?: AbortSignal }): Promise<Conversation[]> {
    if (opts?.signal) return this._fetchConversations(opts.signal);
    if (this._conversationsPromise) return this._conversationsPromise;

    this._conversationsPromise = this._fetchConversations();
    try {
      return await this._conversationsPromise;
    } finally {
      this._conversationsPromise = null;
    }
  }

  private async _fetchConversations(signal?: AbortSignal): Promise<Conversation[]> {
    const token = await this.getToken();
    if (!token) throw new Error('Not authenticated');
    if (signal?.aborted) return [];

    const url = `${this.baseUrl}/messages/conversations`;
    const fetchPromise = fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      signal,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 15000)
    );

    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        const parsed = await logApiError('getConversations', url, response, { hasToken: !!token });
        // 401 = token missing/expired/invalid - return empty and don't throw to avoid repeated console errors from polling
        if (response.status === 401) {
          if (typeof window !== 'undefined') {
            console.warn('[API] Conversations: not authenticated (401). Sign in again if needed.');
          }
          return [];
        }
        let detail = 'Failed to fetch conversations';
        if (typeof parsed === 'object' && parsed !== null && 'detail' in parsed) {
          detail = (parsed as { detail: unknown }).detail as string;
        } else if (typeof parsed === 'string') {
          detail = parsed;
        }
        const detailStr = typeof detail === 'string' ? detail : JSON.stringify(detail);
        if (response.status >= 500 || detailStr.toLowerCase().includes('server disconnected')) {
          return [];
        }
        throw new Error(detailStr);
      }

      return response.json();
    } catch (error: any) {
      if (error?.name === 'AbortError') return [];
      if (error.message === 'Request timeout') return [];
      if (error.message === 'Failed to fetch' || error.message?.includes('fetch')) return [];
      throw error;
    }
  }

  async getConversation(conversationId: number, type: 'user' | 'event' | 'group' = 'user', opts?: { signal?: AbortSignal }): Promise<Message[]> {
    const token = await this.getToken();
    if (!token) throw new Error('Not authenticated');
    if (opts?.signal?.aborted) return [];

    const queryParams = new URLSearchParams();
    queryParams.append('conversation_type', type);

    const fetchPromise = fetch(`${this.baseUrl}/messages/conversations/${conversationId}?${queryParams.toString()}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      signal: opts?.signal,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 10000)
    );

    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to fetch conversation');
        throw new Error(errorText || 'Failed to fetch conversation');
      }

      this.markConversationRead(conversationId, type).catch(() => {});

      return response.json();
    } catch (error: any) {
      if (error?.name === 'AbortError') return [];
      if (error?.message === 'Request timeout') return [];
      if (error?.message === 'Failed to fetch' || error?.message?.includes?.('fetch')) return [];
      throw error;
    }
  }

  async markConversationRead(conversationId: number, type: 'user' | 'event' | 'group' = 'user'): Promise<void> {
    const token = await this.getToken();
    if (!token) {
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('conversation_type', type);

      const response = await fetch(`${this.baseUrl}/messages/conversations/${conversationId}/mark-read?${queryParams.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        // Don't throw error, just log warning
        console.warn('Failed to mark conversation as read');
      }
    } catch (error: any) {
      clearTimeout(timeoutId);
      // Silently fail - this is not critical
      console.warn('Failed to mark conversation as read:', error);
    }
  }

  async sendMessage(data: { content: string; receiver_id?: number; event_id?: number; group_id?: number }): Promise<Message> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to send message' }));
        throw new Error(error.detail || 'Failed to send message');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  // Group Chats
  async getGroups(): Promise<GroupChat[]> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/groups`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to fetch groups');
        console.error('getGroups error:', errorText);
        throw new Error(errorText || 'Failed to fetch groups');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
        console.warn('Backend not available for getGroups, returning empty array');
        return [];
      }
      console.error('getGroups error:', error);
      throw error;
    }
  }

  async getGroup(groupId: number, opts?: { signal?: AbortSignal }): Promise<GroupChat> {
    const token = await this.getToken();
    if (!token) throw new Error('Not authenticated');
    if (opts?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');

    const fetchPromise = fetch(`${this.baseUrl}/groups/${groupId}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      signal: opts?.signal,
    });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 10000)
    );

    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to fetch group');
        throw new Error(errorText || 'Failed to fetch group');
      }

      return response.json();
    } catch (error: any) {
      if (error?.name === 'AbortError') throw error;
      if (error?.message === 'Request timeout') throw new Error('Request timeout - please check your connection');
      if (error?.message === 'Failed to fetch' || error?.message?.includes?.('fetch')) {
        throw new Error('Failed to fetch group');
      }
      throw error;
    }
  }

  async createGroup(data: { name: string; description?: string; member_ids: number[] }): Promise<GroupChat> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/groups`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to create group' }));
        throw new Error(error.detail || 'Failed to create group');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async updateGroup(groupId: number, data: { name?: string; description?: string; avatar_url?: string }): Promise<GroupChat> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/groups/${groupId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to update group' }));
        throw new Error(error.detail || 'Failed to update group');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async addGroupMembers(groupId: number, user_ids: number[]): Promise<void> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/groups/${groupId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ user_ids }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to add members' }));
        throw new Error(error.detail || 'Failed to add members');
      }

      return;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async removeGroupMember(groupId: number, userId: number): Promise<void> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/groups/${groupId}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to remove member' }));
        throw new Error(error.detail || 'Failed to remove member');
      }

      return;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  async leaveGroup(groupId: number): Promise<void> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/groups/${groupId}/leave`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Failed to leave group' }));
        throw new Error(error.detail || 'Failed to leave group');
      }

      return;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      throw error;
    }
  }

  // Sports & Goals - Promise.race for timeout (no AbortController)
  async getSports(): Promise<Sport[]> {
    const url = `${this.baseUrl}/sports`;
    try {
      const fetchPromise = fetch(url);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 8000)
      );
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      if (response.ok) {
        const data = await response.json();
        return data || [];
      }
      await logApiError('getSports', url, response);
    } catch (error: any) {
      if (error.message === 'Failed to fetch' || error.message?.includes('fetch')) {
        console.warn('Backend not available for sports');
      } else if (error.message === 'Request timeout') {
        console.warn('Sports request timeout');
      }
    }
    return [];
  }

  async getGoals(): Promise<Goal[]> {
    const url = `${this.baseUrl}/goals`;
    try {
      const fetchPromise = fetch(url);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), 8000)
      );
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      if (response.ok) {
        const data = await response.json();
        return data || [];
      }
      await logApiError('getGoals', url, response);
    } catch (error: any) {
      if (error.message === 'Failed to fetch' || error.message?.includes('fetch')) {
        console.warn('Backend not available for goals');
      } else if (error.message === 'Request timeout') {
        console.warn('Goals request timeout');
      }
    }
    return [];
  }

  // Waitlist
  async addToWaitlist(data: {
    email: string;
    name?: string;
    city?: string;
    message?: string;
  }): Promise<any> {
    const response = await fetch(`${this.baseUrl}/waitlist`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to add to waitlist' }));
      throw new Error(error.detail || 'Failed to add to waitlist');
    }

    return response.json();
  }

  // Posts
  async getPosts(userId?: number, limit = 20, offset = 0, opts?: { signal?: AbortSignal }): Promise<Post[]> {
    const token = await this.getToken();
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (opts?.signal?.aborted) return [];

    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId.toString());
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const url = `${this.baseUrl}/posts?${params}`;
    const fetchPromise = fetch(url, { headers, signal: opts?.signal });
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), 15000)
    );
    try {
      const response = await Promise.race([fetchPromise, timeoutPromise]);
      if (!response.ok) {
        const parsed = await logApiError('getPosts', url, response, { hasToken: !!token });
        const msg = typeof parsed === 'string' ? parsed : (parsed as { detail?: string })?.detail || 'Failed to fetch posts';
        throw new Error(msg);
      }
      return response.json();
    } catch (error: any) {
      if (error?.name === 'AbortError') return [];
      if (error?.message === 'Failed to fetch' || error?.message?.includes('fetch')) return [];
      throw error;
    }
  }

  async createPost(data: { content: string; image_url?: string }): Promise<Post> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/posts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Failed to create post' }));
      throw new Error(error.detail || 'Failed to create post');
    }

    return response.json();
  }

  async likePost(postId: number): Promise<Post> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/posts/${postId}/like`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to like post');
    }

    return response.json();
  }

  async deletePost(postId: number): Promise<void> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${this.baseUrl}/posts/${postId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to delete post');
    }
  }

  // User Events - retries on timeout/network; surfaces error so UI can show retry instead of silent empty
  async getMyEvents(opts?: { signal?: AbortSignal }): Promise<{ owned: Event[]; attending: Event[]; attended: Event[] }> {
    if (opts?.signal?.aborted) return { owned: [], attending: [], attended: [] };

    return withRetry(
      async () => {
        const token = await this.getToken();
        if (!token) throw new Error('Not authenticated');
        if (opts?.signal?.aborted) return { owned: [], attending: [], attended: [] };

        const url = `${this.baseUrl}/events/user/me`;
        const fetchPromise = fetch(url, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          signal: opts?.signal,
        });
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 18000)
        );
        try {
          const response = await Promise.race([fetchPromise, timeoutPromise]);
          if (!response.ok) {
            const parsed = await logApiError('getMyEvents', url, response, { hasToken: !!token });
            const msg = typeof parsed === 'string' ? parsed : (parsed as { detail?: string })?.detail || 'Failed to fetch user events';
            throw new Error(msg);
          }
          return response.json();
        } catch (error: any) {
          if (error?.name === 'AbortError') return { owned: [], attending: [], attended: [] };
          if (error?.message === 'Failed to fetch' || error?.message?.includes('fetch')) {
            throw new Error('Unable to load events. Please check your connection.');
          }
          throw error;
        }
      },
      { retries: 2, delayMs: 1000 }
    );
  }
}

export const api = new ApiClient();
