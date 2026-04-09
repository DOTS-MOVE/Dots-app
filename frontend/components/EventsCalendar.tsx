'use client';

import { useState, useMemo } from 'react';
import { Event } from '@/types';
import Link from 'next/link';
import { dateKeyLocal, groupEventsByLocalDate } from '@/lib/date-keys';

interface EventsCalendarProps {
  events: Event[];
  onDateSelect?: (date: Date) => void;
  highlightDate?: Date | null;
}

export default function EventsCalendar({
  events,
  onDateSelect,
  highlightDate = null,
}: EventsCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const base = highlightDate ?? new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });

  const eventsByDate = useMemo(() => groupEventsByLocalDate(events), [events]);
  const highlightKey = highlightDate ? dateKeyLocal(highlightDate) : null;

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  const endDate = new Date(monthEnd);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const days: Date[] = [];
  const day = new Date(startDate);
  while (day <= endDate) {
    days.push(new Date(day));
    day.setDate(day.getDate() + 1);
  }

  const monthNames = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getDateKey = (date: Date) => dateKeyLocal(date);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentMonth.getMonth();
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={prevMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-xl font-bold text-gray-900">
          {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
        </h2>
        <button
          type="button"
          onClick={nextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((d) => (
          <div key={d} className="text-center text-sm font-semibold text-gray-600 py-2">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((date, idx) => {
          const dateKey = getDateKey(date);
          const dayEvents = eventsByDate[dateKey] || [];
          const hasEvents = dayEvents.length > 0;
          const isHighlighted = highlightKey !== null && dateKey === highlightKey;

          return (
            <div
              key={idx}
              role="button"
              tabIndex={0}
              onClick={() => onDateSelect?.(date)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onDateSelect?.(date);
                }
              }}
              className={`
                min-h-[44px] md:min-h-[60px] p-1 border border-gray-100 rounded-lg cursor-pointer transition-all
                ${isCurrentMonth(date) ? 'bg-white' : 'bg-gray-50'}
                ${isHighlighted ? 'ring-2 ring-gray-900 ring-offset-1' : ''}
                ${!isHighlighted && isToday(date) ? 'ring-2 ring-[#0ef9b4]' : ''}
                ${hasEvents ? 'hover:bg-[#0ef9b4]/10' : 'hover:bg-gray-50'}
              `}
            >
              <div
                className={`text-sm font-medium mb-1 ${isCurrentMonth(date) ? 'text-gray-900' : 'text-gray-400'}`}
              >
                {date.getDate()}
              </div>

              {/* Mobile: dot indicator only */}
              {hasEvents && (
                <div className="flex justify-center  gap-0.5 md:hidden mt-0.5">
                  {dayEvents.slice(0, 3).map((_, i) => (
                    <span
                      key={i}
                      className={`block rounded-full ${isCurrentMonth(date) ? 'bg-[#0ef9b4]' : 'bg-[#0ef9b4]/40'}`}
                      style={{ width: 5, height: 5 }}
                    />
                  ))}
                </div>
              )}

              {/* Desktop: event title chips */}
              {hasEvents && (
                <div className="hidden md:block space-y-0.5">
                  {dayEvents.slice(0, 2).map((event) => (
                    <Link
                      key={event.id}
                      href={`/events/${event.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="block text-xs bg-[#0ef9b4] text-black px-1 py-0.5 rounded truncate hover:bg-[#0dd9a0] transition-colors"
                      title={event.title}
                    >
                      {event.title}
                    </Link>
                  ))}
                  {dayEvents.length > 2 && (
                    <div className="text-xs text-gray-500 px-1">+{dayEvents.length - 2} more</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
