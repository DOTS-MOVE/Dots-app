import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

import EventDetailPage from '@/app/events/[id]/page';
import type { Event } from '@/types';

const mocks = vi.hoisted(() => ({
  getEvent: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: unknown; href: string }) => <a href={href}>{children as any}</a>,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useParams: () => ({ id: '101' }),
}));

vi.mock('@/lib/auth', () => ({
  useAuth: () => ({ user: { id: 2 } }),
}));

vi.mock('@/lib/api', () => ({
  api: {
    getEvent: mocks.getEvent,
    rsvpEvent: vi.fn(),
    cancelRsvp: vi.fn(),
  },
}));

vi.mock('@/components/Navbar', () => ({
  default: () => <div data-testid="navbar" />,
}));

vi.mock('@/components/BottomNav', () => ({
  default: () => <div data-testid="bottom-nav" />,
}));

vi.mock('@/components/ProfileAvatar', () => ({
  default: () => <div data-testid="profile-avatar" />,
}));

vi.mock('@/components/SkeletonLoader', () => ({
  EventDetailSkeleton: () => <div data-testid="event-detail-skeleton" />,
}));

const baseEvent: Event = {
  id: 101,
  title: 'City Basketball Session',
  description: 'Bring your own ball',
  sport_id: 6,
  host_id: 2,
  location: 'Main Court',
  start_time: '2026-03-10T12:00:00Z',
  end_time: null,
  max_participants: 12,
  is_cancelled: false,
  is_public: true,
  image_url: null,
  cover_image_url: null,
  created_at: '2026-03-01T10:00:00Z',
  updated_at: null,
  participant_count: 3,
  pending_requests_count: 0,
  sport: { id: 6, name: 'Basketball', icon: '🏀' },
  host: {
    id: 2,
    email: 'host@example.com',
    full_name: 'Host User',
    age: null,
    bio: null,
    location: null,
    avatar_url: null,
    created_at: '2026-03-01T10:00:00Z',
    updated_at: null,
  },
  participants: [],
};

describe('Event detail hero fallback behavior', () => {
  beforeEach(() => {
    mocks.getEvent.mockReset();
  });

  it('falls back to sport icon hero when image fields are emoji values', async () => {
    mocks.getEvent.mockResolvedValue({
      ...baseEvent,
      image_url: '🏀',
      cover_image_url: '🏀',
    });

    render(<EventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('City Basketball Session')).toBeTruthy();
    });

    expect(document.querySelector('img')).toBeNull();
    expect(screen.getAllByText('🏀').length).toBeGreaterThan(0);
  });

  it('renders hero image when image_url is a valid URL', async () => {
    mocks.getEvent.mockResolvedValue({
      ...baseEvent,
      image_url: 'https://example.com/hero.jpg',
      cover_image_url: null,
    });

    render(<EventDetailPage />);

    await waitFor(() => {
      expect(screen.getByText('City Basketball Session')).toBeTruthy();
    });

    const image = document.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('https://example.com/hero.jpg');
  });
});
