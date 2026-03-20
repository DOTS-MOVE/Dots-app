'use client';

import Link from 'next/link';
import { Event } from '@/types';
import ProfileAvatar from '@/components/ProfileAvatar';

interface EventRowCompactProps {
  event: Event;
}

export default function EventRowCompact({ event }: EventRowCompactProps) {
  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const host = event.host;
  const subtitle = host?.full_name || event.sport?.name || event.location;

  return (
    <div className="flex items-center gap-3 py-3.5 border-b border-gray-100 last:border-0">
      <Link href={`/events/${event.id}`} className="flex flex-1 min-w-0 items-center gap-3">
        {host ? (
          <ProfileAvatar
            userId={host.id}
            avatarUrl={host.avatar_url}
            fullName={host.full_name}
            size="sm"
            linkToProfile={false}
            className="shrink-0"
          />
        ) : (
          <div className="w-10 h-10 shrink-0 rounded-full bg-gray-100 flex items-center justify-center text-lg leading-none">
            {event.sport?.icon || '📅'}
          </div>
        )}
        <div className="min-w-0 flex-1 text-left">
          <p className="font-bold text-gray-900 text-sm tabular-nums">{formatTime(event.start_time)}</p>
          <p className="font-bold text-gray-900 text-xs uppercase tracking-wide truncate mt-0.5">
            {event.title}
          </p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wide truncate mt-0.5">
            {subtitle}
          </p>
        </div>
      </Link>
      <Link
        href={`/events/${event.id}`}
        className="shrink-0 px-4 py-2 border border-gray-900 rounded-md text-xs font-semibold text-gray-900 bg-white hover:bg-gray-50"
      >
        View
      </Link>
    </div>
  );
}
