import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import EventCardLarge from '@/components/EventCardLarge';
import type { Event } from '@/types';

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: unknown; href: string }) => <a href={href}>{children as any}</a>,
}));

vi.mock('@/components/ProfileAvatar', () => ({
  default: () => <div data-testid="profile-avatar" />,
}));

const baseEvent: Event = {
  id: 101,
  title: 'Sunrise Run',
  description: 'Easy pace group run',
  sport_id: 1,
  host_id: 2,
  location: 'Prospect Park',
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
  sport: { id: 1, name: 'Running', icon: '🏃' },
};

describe('EventCardLarge image fallback behavior', () => {
  it('renders sport icon fallback when image field contains an emoji value', () => {
    render(
      <EventCardLarge
        event={{
          ...baseEvent,
          image_url: '🏀',
          sport: { id: 6, name: 'Basketball', icon: '🏀' },
        }}
      />
    );

    expect(document.querySelector('img')).toBeNull();
    expect(screen.getByText('🏀')).toBeTruthy();
  });

  it('renders an image when image_url is a valid URL', () => {
    render(
      <EventCardLarge
        event={{
          ...baseEvent,
          image_url: 'https://example.com/event-cover.jpg',
        }}
      />
    );

    const image = document.querySelector('img');
    expect(image).not.toBeNull();
    expect(image?.getAttribute('src')).toBe('https://example.com/event-cover.jpg');
  });
});
