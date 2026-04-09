'use client';

import { useRouter } from 'next/navigation';
import { Event } from '@/types';
import { MapPinIcon, UsersIcon } from '@/components/Icons';
import { useAuth } from '@/lib/auth';
import { useAuthGate } from '@/lib/authGate';

interface EventCardProps {
  event: Event;
}

const sportStyles: { [key: string]: { gradient: string; accent: string } } = {
  'Running':       { gradient: 'from-orange-400 to-red-500',    accent: 'bg-orange-500' },
  'Cycling':       { gradient: 'from-blue-400 to-cyan-500',     accent: 'bg-blue-500' },
  'Swimming':      { gradient: 'from-blue-500 to-indigo-600',   accent: 'bg-indigo-500' },
  'Yoga':          { gradient: 'from-purple-400 to-pink-500',   accent: 'bg-purple-500' },
  'Basketball':    { gradient: 'from-orange-500 to-red-600',    accent: 'bg-red-500' },
  'Tennis':        { gradient: 'from-green-400 to-emerald-500', accent: 'bg-emerald-500' },
  'Weightlifting': { gradient: 'from-gray-600 to-gray-800',     accent: 'bg-gray-700' },
  'Hiking':        { gradient: 'from-green-500 to-teal-600',    accent: 'bg-teal-600' },
};

const DEFAULT_STYLE = { gradient: 'from-[#0ef9b4] to-[#0dd9a0]', accent: 'bg-[#0dd9a0]' };

export default function EventCard({ event }: EventCardProps) {
  const style = event.sport ? (sportStyles[event.sport.name] ?? DEFAULT_STYLE) : DEFAULT_STYLE;
  const { user } = useAuth();
  const { openAuthGate } = useAuthGate();
  const router = useRouter();

  const handleClick = () => {
    if (!user) {
      openAuthGate(`/events/${event.id}`);
    } else {
      router.push(`/events/${event.id}`);
    }
  };

  const date = new Date(event.start_time);
  const dayNum  = date.toLocaleDateString('en-US', { day:   'numeric' });
  const month   = date.toLocaleDateString('en-US', { month: 'short'   });
  const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
  const time    = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

  return (
    <div onClick={handleClick} className="cursor-pointer">
      <div className="group bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 flex items-stretch overflow-hidden">

        {/* Left date column */}
        <div className={`bg-gradient-to-b ${style.gradient} flex flex-col items-center justify-center w-16 flex-shrink-0 py-4 px-2 text-white`}>
          <span className="text-[10px] font-bold uppercase tracking-wider opacity-80 leading-none">{month}</span>
          <span className="text-2xl font-extrabold leading-tight">{dayNum}</span>
          <span className="text-[10px] font-semibold uppercase opacity-80 leading-none">{dayName}</span>
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0 px-4 py-3.5 flex flex-col justify-between gap-1.5">
          <div>
            {event.sport && (
              <div className="flex items-center gap-1.5 mb-1">
                <span className={`w-1.5 h-1.5 rounded-full ${style.accent} flex-shrink-0`} />
                <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{event.sport.name}</span>
              </div>
            )}
            <h3 className="font-bold text-gray-900 text-sm leading-snug line-clamp-2 group-hover:text-[#0dd9a0] transition-colors">
              {event.title}
            </h3>
          </div>

          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="opacity-70">{time}</span>
            <span className="flex items-center gap-1 min-w-0">
              <MapPinIcon className="w-3 h-3 flex-shrink-0" aria-hidden />
              <span className="truncate">{event.location}</span>
            </span>
            <span className="flex items-center gap-1 flex-shrink-0 ml-auto">
              <UsersIcon className="w-3 h-3 flex-shrink-0" aria-hidden />
              {event.participant_count}{event.max_participants ? `/${event.max_participants}` : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
