import { Event, Sport, User, Buddy, GroupChat, Conversation, Goal, Message, GroupMember, Post } from '@/types';
import {
  mockUsers,
  mockEvents,
  mockBuddies,
  mockSuggestedBuddies,
  mockConversations,
  mockMessages,
  mockGroupChats,
  mockSports,
  mockGoals,
  currentUser,
} from './mockData';
import { supabase } from './supabase';

// Use mock data - simulate API delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class ApiClient {
  private localBuddies: Buddy[] = [...mockBuddies];
  private localMessages: Message[] = [...mockMessages];
  private localEvents: Event[] = [...mockEvents];
  private rsvpEvents: Set<number> = new Set();
  private baseUrl: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  async getToken(): Promise<string | null> {
    if (typeof window === 'undefined') return null;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token || null;
    } catch (error) {
      console.error('Failed to get token:', error);
      return null;
    }
  }

  setToken(token: string | null) {
    // Token is managed by Supabase, this is kept for compatibility
  }

  // Auth
  async register(email: string, password: string, fullName: string): Promise<{ access_token: string; token_type: string }> {
    await delay(300);
    this.setToken('mock_token');
    return { access_token: 'mock_token', token_type: 'bearer' };
  }

  async login(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
    await delay(300);
    this.setToken('mock_token');
    return { access_token: 'mock_token', token_type: 'bearer' };
  }

  // Users
  async getCurrentUser(): Promise<User> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      const response = await fetch(`${this.baseUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to fetch user profile');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
          if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
            // Backend not available - throw error with user-friendly message
            console.warn('Backend not available for getCurrentUser:', this.baseUrl);
            throw new Error('Unable to connect to the server. Please check your connection.');
          }
      // Re-throw other errors
      throw error;
    }
  }

  async getUser(userId: number): Promise<User> {
    const token = await this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const response = await fetch(`${this.baseUrl}/users/${userId}`, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ detail: 'Failed to fetch user' }));
        throw new Error(errorData.detail || 'Failed to fetch user');
      }
      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
          if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
            throw new Error('Unable to connect to the server. Please check your connection.');
          }
      throw error;
    }
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

  // Events
  async getEvents(params?: { sport_id?: number; location?: string; search?: string }): Promise<Event[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const queryParams = new URLSearchParams();
      if (params?.sport_id) {
        queryParams.append('sport_id', params.sport_id.toString());
      }
      if (params?.location) {
        queryParams.append('location', params.location);
      }
      if (params?.search) {
        queryParams.append('search', params.search);
      }

      const queryString = queryParams.toString();
      const url = `${this.baseUrl}/events${queryString ? `?${queryString}` : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to fetch events');
        console.error('getEvents error:', errorText);
        throw new Error(errorText || 'Failed to fetch events');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
        console.warn('Backend not available for getEvents, returning empty array');
        return [];
      }
      console.error('getEvents error:', error);
      throw error;
    }
  }

  async getEvent(eventId: number): Promise<Event> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/events/${eventId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to fetch event');
        console.error('getEvent error:', errorText);
        throw new Error(errorText || 'Failed to fetch event');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
        console.warn('Backend not available for getEvent');
        throw new Error('Failed to fetch event');
      }
      console.error('getEvent error:', error);
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
        throw new Error('Failed to cancel RSVP');
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

  // Buddies
  async getSuggestedBuddies(limit = 10, minScore = 30, offset = 0): Promise<any[]> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('limit', limit.toString());
      queryParams.append('min_score', minScore.toString());
      queryParams.append('offset', offset.toString());

      const response = await fetch(`${this.baseUrl}/buddies/suggested?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to fetch suggested buddies');
        console.error('getSuggestedBuddies error:', errorText);
        throw new Error(errorText || 'Failed to fetch suggested buddies');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
        console.warn('Backend not available for getSuggestedBuddies, returning empty array');
        return [];
      }
      console.error('getSuggestedBuddies error:', error);
      throw error;
    }
  }

  async getBuddies(status?: string): Promise<Buddy[]> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
      let url = `${this.baseUrl}/buddies`;
      if (status) {
        url += `?status=${status}`;
      }

      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error('Failed to fetch buddies');
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

  // Messages
  async getConversations(): Promise<Conversation[]> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/messages/conversations`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to fetch conversations');
        console.error('getConversations error:', errorText);
        throw new Error(errorText || 'Failed to fetch conversations');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
        console.warn('Backend not available for getConversations, returning empty array');
        return [];
      }
      console.error('getConversations error:', error);
      throw error;
    }
  }

  async getConversation(conversationId: number, type: 'user' | 'event' | 'group' = 'user'): Promise<Message[]> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const queryParams = new URLSearchParams();
      queryParams.append('conversation_type', type);

      const response = await fetch(`${this.baseUrl}/messages/conversations/${conversationId}?${queryParams.toString()}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to fetch conversation');
        console.error('getConversation error:', errorText);
        throw new Error(errorText || 'Failed to fetch conversation');
      }

      // Mark messages as read after fetching them
      this.markConversationRead(conversationId, type).catch(err => {
        console.warn('Failed to mark conversation as read:', err);
      });

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
        console.warn('Backend not available for getConversation, returning empty array');
        return [];
      }
      console.error('getConversation error:', error);
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

  async getGroup(groupId: number): Promise<GroupChat> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(`${this.baseUrl}/groups/${groupId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to fetch group');
        console.error('getGroup error:', errorText);
        throw new Error(errorText || 'Failed to fetch group');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
        console.warn('Backend not available for getGroup');
        throw new Error('Failed to fetch group');
      }
      console.error('getGroup error:', error);
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

  // Sports & Goals
  async getSports(): Promise<Sport[]> {
    // Try to fetch from API first, fallback to mock data
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${this.baseUrl}/sports`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        return data || [];
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('Request timeout for sports');
      } else if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
        console.warn('Backend not available for sports, returning empty array');
        return [];
      } else {
        console.warn('Failed to fetch sports:', error);
      }
    }
    // Return empty array instead of mock data
    return [];
  }

  async getGoals(): Promise<Goal[]> {
    // Try to fetch from API first, fallback to mock data
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(`${this.baseUrl}/goals`, {
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        return data || [];
      }
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.warn('Request timeout for goals');
      } else if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
        console.warn('Backend not available for goals, returning empty array');
        return [];
      } else {
        console.warn('Failed to fetch goals:', error);
      }
    }
    // Return empty array instead of mock data
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
  async getPosts(userId?: number, limit = 20, offset = 0): Promise<Post[]> {
    const token = await this.getToken();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const params = new URLSearchParams();
    if (userId) params.append('user_id', userId.toString());
    params.append('limit', limit.toString());
    params.append('offset', offset.toString());

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch(`${this.baseUrl}/posts?${params}`, {
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to fetch posts');
        console.error('getPosts error response:', errorText);
        throw new Error(errorText || 'Failed to fetch posts');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
        // Backend is not running - return empty array instead of throwing
        // This allows the UI to still render with empty data
        console.warn('Backend not available, returning empty data:', this.baseUrl);
        return [];
      }
      console.error('getPosts error:', error);
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

  // User Events
  async getMyEvents(): Promise<{ owned: Event[]; attending: Event[]; attended: Event[] }> {
    const token = await this.getToken();
    if (!token) {
      throw new Error('Not authenticated');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    try {
      const response = await fetch(`${this.baseUrl}/events/user/me`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Failed to fetch user events');
        console.error('getMyEvents error:', errorText);
        throw new Error(errorText || 'Failed to fetch user events');
      }

      return response.json();
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout - please check your connection');
      }
      if (error.message === 'Failed to fetch' || error.message.includes('fetch')) {
        // Backend is not running - return empty events object instead of throwing
        // This allows the UI to still render with empty data
        console.warn('Backend not available, returning empty events:', this.baseUrl);
        return { owned: [], attending: [], attended: [] };
      }
      console.error('getMyEvents error:', error);
      throw error;
    }
  }
}

export const api = new ApiClient();

