'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Event } from '@/types';
import ProfileAvatar from './ProfileAvatar';
import { MapPinIcon, UsersIcon, CalendarIcon } from '@/components/Icons';

interface EventCardLargeProps {
  event: Event;
}

const sportStyles: { [key: string]: { icon: string; gradient: string; accent: string } } = {
  'Running':      { icon: '🏃', gradient: 'from-orange-400 to-red-500',    accent: 'bg-orange-500' },
  'Cycling':      { icon: '🚴', gradient: 'from-blue-400 to-cyan-500',     accent: 'bg-blue-500' },
  'Swimming':     { icon: '🏊', gradient: 'from-blue-500 to-indigo-600',   accent: 'bg-indigo-500' },
  'Yoga':         { icon: '🧘', gradient: 'from-purple-400 to-pink-500',   accent: 'bg-purple-500' },
  'Basketball':   { icon: '🏀', gradient: 'from-orange-500 to-red-600',    accent: 'bg-red-500' },
  'Tennis':       { icon: '🎾', gradient: 'from-green-400 to-emerald-500', accent: 'bg-emerald-500' },
  'Weightlifting':{ icon: '🏋️', gradient: 'from-gray-600 to-gray-800',    accent: 'bg-gray-700' },
  'Hiking':       { icon: '🥾', gradient: 'from-green-500 to-teal-600',   accent: 'bg-teal-600' },
};

const DEFAULT_STYLE = { icon: '🏃', gradient: 'from-[#0ef9b4] to-[#0dd9a0]', accent: 'bg-[#0dd9a0]' };

export default function EventCardLarge({ event }: EventCardLargeProps) {
  const [imageError, setImageError] = useState(false);

  const isRenderableImageSrc = (value: string | null | undefined) => {
    if (!value) return false;
    const src = value.trim();
    return src.startsWith('http://') || src.startsWith('https://') || src.startsWith('/') || src.startsWith('data:image/') || src.startsWith('blob:');
  };

  const formatDay = (d: string) => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  const style = event.sport ? (sportStyles[event.sport.name] ?? DEFAULT_STYLE) : DEFAULT_STYLE;
  const fallbackIcon = event.sport?.icon || style.icon;
  const imageSrc = (event.image_url || event.cover_image_url || '').trim() || null;
  const hasImage = isRenderableImageSrc(imageSrc) && !imageError;

  const isPast = new Date(event.start_time) < new Date();

  return (
    <div className="group bg-white rounded-2xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col h-full">
      <Link href={`/events/${event.id}`} className="block flex-1 flex flex-col min-h-0">

        {/* ── Image / Gradient header ── */}
        <div className="relative h-48 overflow-hidden">
          {hasImage ? (
            <>
              <img
                src={imageSrc ?? undefined}
                alt={event.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                onError={() => setImageError(true)}
                onLoad={() => setImageError(false)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
            </>
          ) : (
            <div className={`absolute inset-0 bg-gradient-to-br ${style.gradient}`}>
              <div className="flex items-center justify-center h-full">
                <span className="text-7xl opacity-80 group-hover:scale-110 transition-transform duration-300 select-none">
                  {fallbackIcon}
                </span>
              </div>
              {/* subtle noise overlay */}
              <div className="absolute inset-0 bg-black/5" />
            </div>
          )}

          {/* Past dimmer */}
          {isPast && <div className="absolute inset-0 bg-black/25" />}

          {/* ── Overlay badges ── */}
          {/* Date pill – top left */}
          <div className="absolute top-3 left-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-xl px-2.5 py-1.5 shadow-md">
            <CalendarIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" aria-hidden />
            <span className="text-xs font-semibold text-gray-800 leading-none">{formatDay(event.start_time)}</span>
            <span className="text-xs text-gray-500 leading-none">· {formatTime(event.start_time)}</span>
          </div>

          {/* Participants – top right */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 bg-white/90 backdrop-blur-sm rounded-xl px-2.5 py-1.5 shadow-md">
            <UsersIcon className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" aria-hidden />
            <span className="text-xs font-semibold text-gray-800 leading-none">
              {event.participant_count}{event.max_participants != null ? `/${event.max_participants}` : ''}
            </span>
          </div>

          {/* Past label */}
          {isPast && (
            <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-sm text-white text-xs font-medium px-2.5 py-1 rounded-lg">
              Past event
            </div>
          )}
        </div>

        {/* ── Body ── */}
        <div className="p-5 flex flex-col flex-1">
          {/* Sport tag */}
          {event.sport && (
            <div className="flex items-center gap-1.5 mb-2.5">
              <span className={`w-2 h-2 rounded-full ${style.accent} flex-shrink-0`} />
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {event.sport.name}
              </span>
            </div>
          )}

          <h3 className="font-bold text-gray-900 text-lg leading-snug mb-2 line-clamp-2 group-hover:text-[#0dd9a0] transition-colors duration-200">
            {event.title}
          </h3>

          {event.description && (
            <p className="text-sm text-gray-500 line-clamp-2 leading-relaxed mb-3">
              {event.description}
            </p>
          )}

          {/* spacer pushes location to bottom of body */}
          <div className="flex-1" />

          <div className="flex items-center gap-1.5 text-sm text-gray-500 mt-3">
            <MapPinIcon className="w-3.5 h-3.5 flex-shrink-0 text-gray-400" aria-hidden />
            <span className="truncate">{event.location}</span>
          </div>
        </div>
      </Link>

      {/* ── Host footer ── */}
      {event.host && (
        <Link
          href={`/profile?userId=${event.host.id}`}
          className="flex items-center gap-3 px-5 py-3.5 border-t border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <ProfileAvatar
            userId={event.host.id}
            avatarUrl={event.host.avatar_url}
            fullName={event.host.full_name}
            size="sm"
            linkToProfile={false}
          />
          <div className="min-w-0">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider leading-none mb-0.5">Hosted by</p>
            <p className="text-sm font-semibold text-gray-800 truncate">{event.host.full_name || 'Unknown'}</p>
          </div>
        </Link>
      )}
    </div>
  );
}
