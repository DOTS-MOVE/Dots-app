'use client';

import { Event } from '@/types';
import { useState } from 'react';
import Link from 'next/link';
import EventAdminPanel from './EventAdminPanel';

interface EventManagementMenuProps {
  event: Event;
  onEventUpdated?: () => void;
  onEventDeleted?: () => void;
}

export default function EventManagementMenu({ event, onEventUpdated, onEventDeleted }: EventManagementMenuProps) {
  const [expanded, setExpanded] = useState(false);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex-1 text-left">
          <h3 className="font-semibold text-gray-900">{event.title}</h3>
          <p className="text-sm text-gray-500 mt-1">
            {formatDate(event.start_time)} • {event.location}
          </p>
          <div className="flex items-center gap-2 mt-1">
            {event.is_cancelled && (
              <span className="inline-block px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700 rounded">
                Cancelled
              </span>
            )}
            {!event.is_public && (
              <span className="inline-block px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-700 rounded">
                Private
              </span>
            )}
            {event.pending_requests_count && event.pending_requests_count > 0 && (
              <span className="inline-block px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded">
                {event.pending_requests_count} pending
              </span>
            )}
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 transform transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-4">
          {event.description && (
            <p className="text-sm text-gray-600">{event.description}</p>
          )}
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>Participants: {event.participant_count}</span>
            {event.max_participants && (
              <span>• Max: {event.max_participants}</span>
            )}
          </div>
          
          {/* Admin Panel */}
          <EventAdminPanel
            event={event}
            onUpdate={() => onEventUpdated?.()}
            onEventDeleted={onEventDeleted}
          />
          
          <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
            <Link
              href={`/events/${event.id}`}
              className="flex-1 px-4 py-2 text-center bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors"
            >
              View Event
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
