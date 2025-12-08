import { Event, Sport, User, Match, GroupChat, Conversation, Goal, Message } from '@/types';
import {
  mockUsers,
  mockEvents,
  mockMatches,
  mockSuggestedMatches,
  mockConversations,
  mockMessages,
  mockGroupChats,
  mockSports,
  mockGoals,
  currentUser,
} from './mockData';

// Use mock data - simulate API delays
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class ApiClient {
  private token: string | null = null;
  private localMatches: Match[] = [...mockMatches];
  private localMessages: Message[] = [...mockMessages];
  private localEvents: Event[] = [...mockEvents];
  private rsvpEvents: Set<number> = new Set();

  constructor() {
    if (typeof window !== 'undefined') {
      this.token = localStorage.getItem('token');
    }
  }

  setToken(token: string | null) {
    this.token = token;
    if (token && typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    } else if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
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
    await delay(200);
    return currentUser;
  }

  async getUser(userId: number): Promise<User> {
    await delay(200);
    const user = mockUsers.find(u => u.id === userId);
    if (!user) throw new Error('User not found');
    return user;
  }

  async updateUser(data: any): Promise<User> {
    await delay(300);
    return { ...currentUser, ...data };
  }

  // Events
  async getEvents(params?: { sport_id?: number; location?: string; search?: string }): Promise<Event[]> {
    await delay(300);
    let events = [...this.localEvents];
    
    if (params?.sport_id) {
      events = events.filter(e => e.sport_id === params.sport_id);
    }
    if (params?.location) {
      events = events.filter(e => e.location.toLowerCase().includes(params.location!.toLowerCase()));
    }
    if (params?.search) {
      const search = params.search.toLowerCase();
      events = events.filter(e => 
        e.title.toLowerCase().includes(search) ||
        e.description?.toLowerCase().includes(search) ||
        e.location.toLowerCase().includes(search) ||
        e.sport?.name.toLowerCase().includes(search)
      );
    }
    
    return events;
  }

  async getEvent(eventId: number): Promise<Event> {
    await delay(200);
    const event = this.localEvents.find(e => e.id === eventId);
    if (!event) throw new Error('Event not found');
    return event;
  }

  async createEvent(data: any): Promise<Event> {
    await delay(300);
    const newEvent: Event = {
      id: this.localEvents.length + 1,
      ...data,
      participant_count: 0,
      is_cancelled: false,
      created_at: new Date().toISOString(),
      updated_at: null,
      sport: mockSports.find(s => s.id === data.sport_id),
      host: currentUser,
      participants: [],
    };
    this.localEvents.push(newEvent);
    return newEvent;
  }

  async updateEvent(eventId: number, data: any): Promise<Event> {
    await delay(300);
    const event = this.localEvents.find(e => e.id === eventId);
    if (!event) throw new Error('Event not found');
    Object.assign(event, data, { updated_at: new Date().toISOString() });
    return event;
  }

  async rsvpEvent(eventId: number): Promise<void> {
    await delay(300);
    const event = this.localEvents.find(e => e.id === eventId);
    if (event) {
      event.participant_count++;
      this.rsvpEvents.add(eventId);
    }
  }

  async cancelRsvp(eventId: number): Promise<void> {
    await delay(300);
    const event = this.localEvents.find(e => e.id === eventId);
    if (event && event.participant_count > 0) {
      event.participant_count--;
      this.rsvpEvents.delete(eventId);
    }
  }

  // Matches
  async getSuggestedMatches(limit = 10, minScore = 30, offset = 0): Promise<any[]> {
    await delay(300);
    return mockSuggestedMatches.slice(offset, offset + limit);
  }

  async getMatches(status?: string): Promise<Match[]> {
    await delay(200);
    if (status) {
      return this.localMatches.filter(m => m.status === status);
    }
    return this.localMatches;
  }

  async createMatch(user2Id: number): Promise<Match> {
    await delay(300);
    const user2 = mockUsers.find(u => u.id === user2Id);
    if (!user2) throw new Error('User not found');
    
    const newMatch: Match = {
      id: this.localMatches.length + 1,
      user1_id: currentUser.id,
      user2_id: user2Id,
      match_score: 75 + Math.floor(Math.random() * 20),
      status: 'accepted',
      created_at: new Date().toISOString(),
      user1: currentUser,
      user2: user2,
    };
    this.localMatches.push(newMatch);
    return newMatch;
  }

  async updateMatch(matchId: number, status: 'accepted' | 'rejected'): Promise<Match> {
    await delay(300);
    const match = this.localMatches.find(m => m.id === matchId);
    if (!match) throw new Error('Match not found');
    match.status = status;
    return match;
  }

  async deleteMatch(matchId: number): Promise<void> {
    await delay(300);
    const index = this.localMatches.findIndex(m => m.id === matchId);
    if (index > -1) {
      this.localMatches.splice(index, 1);
    }
  }

  // Messages
  async getConversations(): Promise<Conversation[]> {
    await delay(300);
    return mockConversations;
  }

  async getConversation(conversationId: number, type: 'user' | 'event' | 'group' = 'user'): Promise<Message[]> {
    await delay(200);
    if (type === 'user') {
      return this.localMessages.filter(m => 
        (m.receiver_id === conversationId && m.sender_id === currentUser.id) ||
        (m.sender_id === conversationId && m.receiver_id === currentUser.id)
      ).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (type === 'event') {
      return this.localMessages.filter(m => m.event_id === conversationId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    } else if (type === 'group') {
      return this.localMessages.filter(m => m.group_id === conversationId)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    }
    return [];
  }

  async sendMessage(data: { content: string; receiver_id?: number; event_id?: number; group_id?: number }): Promise<Message> {
    await delay(300);
    const newMessage: Message = {
      id: this.localMessages.length + 1,
      sender_id: currentUser.id,
      receiver_id: data.receiver_id || null,
      event_id: data.event_id || null,
      group_id: data.group_id || null,
      content: data.content,
      is_read: false,
      created_at: new Date().toISOString(),
      sender: currentUser,
    };
    this.localMessages.push(newMessage);
    return newMessage;
  }

  // Group Chats
  async getGroups(): Promise<GroupChat[]> {
    await delay(200);
    return mockGroupChats;
  }

  async getGroup(groupId: number): Promise<GroupChat> {
    await delay(200);
    const group = mockGroupChats.find(g => g.id === groupId);
    if (!group) throw new Error('Group not found');
    return group;
  }

  async createGroup(data: { name: string; description?: string; member_ids: number[] }): Promise<GroupChat> {
    await delay(300);
    const newGroup: GroupChat = {
      id: mockGroupChats.length + 1,
      name: data.name,
      description: data.description || null,
      avatar_url: `https://picsum.photos/seed/group${mockGroupChats.length + 1}/400/400`,
      created_by_id: currentUser.id,
      created_at: new Date().toISOString(),
      updated_at: null,
      members: [
        { id: currentUser.id, full_name: currentUser.full_name, avatar_url: currentUser.avatar_url, is_admin: true },
        ...data.member_ids.map(id => {
          const user = mockUsers.find(u => u.id === id);
          return user ? { id: user.id, full_name: user.full_name, avatar_url: user.avatar_url, is_admin: false } : null;
        }).filter((m): m is GroupMember => m !== null),
      ],
      created_by: { id: currentUser.id, full_name: currentUser.full_name, avatar_url: currentUser.avatar_url, is_admin: true },
    };
    mockGroupChats.push(newGroup);
    return newGroup;
  }

  async updateGroup(groupId: number, data: { name?: string; description?: string; avatar_url?: string }): Promise<GroupChat> {
    await delay(300);
    const group = mockGroupChats.find(g => g.id === groupId);
    if (!group) throw new Error('Group not found');
    Object.assign(group, data, { updated_at: new Date().toISOString() });
    return group;
  }

  async addGroupMembers(groupId: number, user_ids: number[]): Promise<void> {
    await delay(300);
    const group = mockGroupChats.find(g => g.id === groupId);
    if (group && group.members) {
      user_ids.forEach(id => {
        const user = mockUsers.find(u => u.id === id);
        if (user && !group.members?.some(m => m.id === id)) {
          group.members.push({ id: user.id, full_name: user.full_name, avatar_url: user.avatar_url, is_admin: false });
        }
      });
    }
  }

  async removeGroupMember(groupId: number, userId: number): Promise<void> {
    await delay(300);
    const group = mockGroupChats.find(g => g.id === groupId);
    if (group && group.members) {
      const index = group.members.findIndex(m => m.id === userId);
      if (index > -1) {
        group.members.splice(index, 1);
      }
    }
  }

  async leaveGroup(groupId: number): Promise<void> {
    await delay(300);
    const group = mockGroupChats.find(g => g.id === groupId);
    if (group && group.members) {
      const index = group.members.findIndex(m => m.id === currentUser.id);
      if (index > -1) {
        group.members.splice(index, 1);
      }
    }
  }

  // Sports & Goals
  async getSports(): Promise<Sport[]> {
    await delay(200);
    return mockSports;
  }

  async getGoals(): Promise<Goal[]> {
    await delay(200);
    return mockGoals;
  }
}

export const api = new ApiClient();

