'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Event } from '@/types';
import ProfileAvatar from './ProfileAvatar';

interface EventCardLargeProps {
  event: Event;
}

export default function EventCardLarge({ event }: EventCardLargeProps) {
  const [imageError, setImageError] = useState(false);
  const isRenderableImageSrc = (value: string | null | undefined) => {
    if (!value) return false;
    const src = value.trim();
    return (
      src.startsWith('http://') ||
      src.startsWith('https://') ||
      src.startsWith('/') ||
      src.startsWith('data:image/') ||
      src.startsWith('blob:')
    );
  };
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

  // Get sport emoji/icon and gradient
  const sportStyles: { [key: string]: { icon: string; gradient: string } } = {
    'Running': { icon: '🏃', gradient: 'from-orange-400 to-red-500' },
    'Cycling': { icon: '🚴', gradient: 'from-blue-400 to-cyan-500' },
    'Swimming': { icon: '🏊', gradient: 'from-blue-500 to-indigo-600' },
    'Yoga': { icon: '🧘', gradient: 'from-purple-400 to-pink-500' },
    'Basketball': { icon: '🏀', gradient: 'from-orange-500 to-red-600' },
    'Tennis': { icon: '🎾', gradient: 'from-green-400 to-emerald-500' },
    'Weightlifting': { icon: '🏋️', gradient: 'from-gray-600 to-gray-800' },
    'Hiking': { icon: '🥾', gradient: 'from-green-500 to-teal-600' },
  };

  const sportStyle = event.sport ? sportStyles[event.sport.name] || { icon: '🏃', gradient: 'from-[#0ef9b4] to-[#0dd9a0]' } : { icon: '🏃', gradient: 'from-[#0ef9b4] to-[#0dd9a0]' };
  const fallbackSportIcon = event.sport?.icon || sportStyle.icon;
  const imageSrc = (event.image_url || event.cover_image_url || '').trim() || null;
  const hasImage = isRenderableImageSrc(imageSrc) && !imageError;

  const headerBgClass = hasImage ? 'relative h-64 overflow-hidden' : 'relative h-64 overflow-hidden bg-gradient-to-br ' + sportStyle.gradient;

  return (
    <div className="group bg-white rounded-3xl overflow-hidden border border-gray-100 hover:shadow-2xl transition-all duration-300 hover:-translate-y-1.5">
      <Link href={'/events/' + event.id} className="block">
        {/* Event Image/Header */}
        <div className={headerBgClass}>
          {hasImage ? (
            <>
              <img 
                src={imageSrc ?? undefined}
                alt={event.title}
                className="w-full h-full object-cover"
                onError={() => setImageError(true)}
                onLoad={() => setImageError(false)}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
            </>
          ) : (
            <>
              <div className={'absolute inset-0 bg-gradient-to-br ' + sportStyle.gradient} />
              <div className="relative z-10 flex items-center justify-center h-full">
                <div className="text-6xl transform group-hover:scale-110 transition-transform duration-300">
                  {fallbackSportIcon}
                </div>
              </div>
            </>
          )}
          <div className="absolute inset-0 bg-black/5 group-hover:bg-black/10 transition-colors duration-300" />
          
          {/* Date Badge */}
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-md rounded-2xl px-3 py-1.5 shadow-lg border border-white/20">
            <div className="text-xs font-semibold text-gray-700 uppercase">
              {formatDate(event.start_time)}
            </div>
            <div className="text-xs text-gray-500">
              {formatTime(event.start_time)}
            </div>
          </div>

          {/* Participants Badge */}
          <div className="absolute top-4 right-4 bg-white/95 backdrop-blur-md rounded-full px-3 py-1.5 shadow-lg border border-white/20 flex items-center space-x-1">
            <span className="text-xs">👥</span>
            <span className="text-xs font-semibold text-gray-700">
              {event.participant_count}
              {event.max_participants != null && '/' + event.max_participants}
            </span>
          </div>
        </div>

        {/* Event Content */}
        <div className="p-8">
          <h3 className="font-bold text-xl text-gray-900 mb-3 line-clamp-2 group-hover:text-[#0ef9b4] transition-colors duration-300">
            {event.title}
          </h3>
          
          {event.description && (
            <p className="text-sm text-gray-600 mb-6 line-clamp-2 leading-relaxed">
              {event.description}
            </p>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <span className="text-base">📍</span>
              <span className="truncate max-w-[200px]">{event.location}</span>
            </div>

            {event.sport && (
              <span className="px-3 py-1.5 bg-[#E6F9F4] text-[#0dd9a0] rounded-full text-xs font-semibold">
                {event.sport.name}
              </span>
            )}
          </div>
        </div>
      </Link>

      {/* Host - separate link to profile */}
      {event.host && (
        <Link
          href={'/profile?userId=' + event.host.id}
          className="flex items-center space-x-3 p-8 pt-4 border-t border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <ProfileAvatar
            userId={event.host.id}
            avatarUrl={event.host.avatar_url}
            fullName={event.host.full_name}
            size="sm"
            linkToProfile={false}
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Hosted by</p>
            <p className="text-sm font-semibold text-gray-900 truncate">
              {event.host.full_name || 'Unknown'}
            </p>
          </div>
        </Link>
      )}
    </div>
  );
}
