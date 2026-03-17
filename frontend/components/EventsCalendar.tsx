'use client';

import { useState, useMemo } from 'react';
import { Event } from '@/types';
import Link from 'next/link';

interface EventsCalendarProps {
  events: Event[];
  onDateSelect?: (date: Date) => void;
}

export default function EventsCalendar({ events, onDateSelect }: EventsCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // Group events by date
  const eventsByDate = useMemo(() => {
    const grouped: { [key: string]: Event[] } = {};
    events.forEach(event => {
      if (!event.start_time) return; // Skip events without start_time
      try {
        const date = new Date(event.start_time);
        // Check if date is valid
        if (isNaN(date.getTime())) return;
        const dateKey = date.toISOString().split('T')[0];
        if (!grouped[dateKey]) {
          grouped[dateKey] = [];
        }
        grouped[dateKey].push(event);
      } catch (error) {
        console.error('Error parsing event date:', error, event);
      }
    });
    return grouped;
  }, [events]);

  const monthStart = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const monthEnd = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
  const startDate = new Date(monthStart);
  startDate.setDate(startDate.getDate() - startDate.getDay());
  const endDate = new Date(monthEnd);
  endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));

  const days = [];
  const day = new Date(startDate);
  while (day <= endDate) {
    days.push(new Date(day));
    day.setDate(day.getDate() + 1);
  }

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getDateKey = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

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
          onClick={nextMonth}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map(day => (
          <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((date, idx) => {
          const dateKey = getDateKey(date);
          const dayEvents = eventsByDate[dateKey] || [];
          const hasEvents = dayEvents.length > 0;

          return (
            <div
              key={idx}
              onClick={() => onDateSelect && onDateSelect(date)}
              className={`
                min-h-[60px] p-1 border border-gray-100 rounded-lg cursor-pointer transition-all
                ${isCurrentMonth(date) ? 'bg-white' : 'bg-gray-50'}
                ${isToday(date) ? 'ring-2 ring-[#0ef9b4]' : ''}
                ${hasEvents ? 'hover:bg-[#0ef9b4]/10' : 'hover:bg-gray-50'}
              `}
            >
              <div className={`text-sm font-medium mb-1 ${isCurrentMonth(date) ? 'text-gray-900' : 'text-gray-400'}`}>
                {date.getDate()}
              </div>
              {hasEvents && (
                <div className="space-y-0.5">
                  {dayEvents.slice(0, 2).map(event => (
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
                    <div className="text-xs text-gray-500 px-1">
                      +{dayEvents.length - 2} more
                    </div>
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
