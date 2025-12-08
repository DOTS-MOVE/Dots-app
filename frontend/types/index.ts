export interface User {
  id: number;
  email: string;
  full_name: string | null;
  age: number | null;
  bio: string | null;
  location: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string | null;
  sports?: Sport[];
  goals?: Goal[];
}

export interface Sport {
  id: number;
  name: string;
  icon?: string;
}

export interface Goal {
  id: number;
  name: string;
  description?: string;
}

export interface Event {
  id: number;
  title: string;
  description: string | null;
  sport_id: number;
  host_id: number;
  location: string;
  start_time: string;
  end_time: string | null;
  max_participants: number | null;
  is_cancelled: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string | null;
  participant_count: number;
  sport?: Sport;
  host?: User;
  participants?: User[];
}

export interface Match {
  id: number;
  user1_id: number;
  user2_id: number;
  match_score: number | null;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  user1?: User;
  user2?: User;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number | null;
  event_id: number | null;
  group_id: number | null;
  content: string;
  is_read: boolean;
  created_at: string;
  sender?: User;
  receiver?: User;
  event?: Event;
}

export interface Conversation {
  type: 'user' | 'event' | 'group';
  id: number;
  name: string;
  avatar_url: string | null;
  member_count?: number;
  last_message: {
    content: string | null;
    created_at: string | null;
  };
  unread_count: number;
}

export interface GroupMember {
  id: number;
  full_name: string | null;
  avatar_url: string | null;
  is_admin: boolean;
}

export interface GroupChat {
  id: number;
  name: string;
  description: string | null;
  avatar_url: string | null;
  created_by_id: number;
  created_at: string;
  updated_at: string | null;
  members?: GroupMember[];
  created_by?: GroupMember;
}

