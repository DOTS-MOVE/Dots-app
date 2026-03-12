'use client';

import Link from 'next/link';
import { Event } from '@/types';
import { IconUsers } from '@/components/Icons';

interface EventCardProps {
  event: Event;
}

export default function EventCard({ event }: EventCardProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  // Get sport emoji/icon
  const sportIcons: { [key: string]: string } = {
    'Running': '🏃',
    'Cycling': '🚴',
    'Swimming': '🏊',
    'Yoga': '🧘',
    'Basketball': '🏀',
    'Tennis': '🎾',
    'Weightlifting': '🏋️',
    'Hiking': '🥾',
  };

  const sportIcon = event.sport ? sportIcons[event.sport.name] || '🏃' : '🏃';

  return (
    <Link href={`/events/${event.id}`}>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
        <div className="flex items-start space-x-4">
          {/* Circular thumbnail */}
          <div className="w-16 h-16 bg-gradient-to-br from-[#0ef9b4] to-[#0dd9a0] rounded-full flex items-center justify-center text-2xl flex-shrink-0">
            {sportIcon}
          </div>
          
          {/* Event details */}
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base mb-1 line-clamp-1">
              {event.title}
            </h3>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span>{formatDate(event.start_time)}</span>
              <span>·</span>
              <span className="truncate">{event.location}</span>
            </div>
            {event.description && (
              <p className="text-sm text-gray-500 mt-1 line-clamp-1">
                {event.description}
              </p>
            )}
            <div className="flex items-center space-x-3 mt-2">
              <span className="text-xs text-gray-500">
                <span className="flex items-center gap-1">
                  <IconUsers className="w-4 h-4 flex-shrink-0" />
                  {event.participant_count} {event.participant_count === 1 ? 'participant' : 'participants'}
                </span>
              </span>
              {event.max_participants && (
                <span className="text-xs text-gray-400">
                  / {event.max_participants} max
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}

