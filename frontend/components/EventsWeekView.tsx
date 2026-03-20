'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Event } from '@/types';
import { dateKeyLocal, groupEventsByLocalDate, startOfWeekSunday } from '@/lib/date-keys';

interface EventsWeekViewProps {
  events: Event[];
  /** When this calendar date changes, the visible week snaps to include it. */
  weekAnchorDate: Date;
}

export default function EventsWeekView({ events, weekAnchorDate }: EventsWeekViewProps) {
  const [weekStart, setWeekStart] = useState(() => startOfWeekSunday(weekAnchorDate));
  const grouped = useMemo(() => groupEventsByLocalDate(events), [events]);

  const anchorKey = dateKeyLocal(weekAnchorDate);
  useEffect(() => {
    setWeekStart(startOfWeekSunday(weekAnchorDate));
  }, [anchorKey]);

  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const prevWeek = () => {
    const n = new Date(weekStart);
    n.setDate(n.getDate() - 7);
    setWeekStart(n);
  };

  const nextWeek = () => {
    const n = new Date(weekStart);
    n.setDate(n.getDate() + 7);
    setWeekStart(n);
  };

  const rangeLabel = `${weekDays[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekDays[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
  const todayKey = dateKeyLocal(new Date());

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <button
          type="button"
          onClick={prevWeek}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
          aria-label="Previous week"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="text-lg font-bold text-gray-900 text-center min-w-0 truncate">{rangeLabel}</h2>
        <button
          type="button"
          onClick={nextWeek}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
          aria-label="Next week"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-2 min-w-0">
        {weekDays.map((d) => {
          const key = dateKeyLocal(d);
          const dayEvents = grouped[key] || [];
          const isToday = key === todayKey;

          return (
            <div
              key={key}
              className={`min-h-[220px] rounded-lg border flex flex-col min-w-0 ${
                isToday
                  ? 'border-[#0ef9b4] bg-[#0ef9b4]/5'
                  : 'border-gray-100 bg-gray-50/60'
              }`}
            >
              <div className="text-center py-2 px-1 border-b border-gray-200/80 shrink-0">
                <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div
                  className={`text-base font-bold tabular-nums ${
                    isToday ? 'text-[#0aa885]' : 'text-gray-900'
                  }`}
                >
                  {d.getDate()}
                </div>
              </div>
              <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto max-h-[300px] scrollbar-hide">
                {dayEvents.length === 0 ? (
                  <p className="text-[10px] text-gray-400 text-center py-2">—</p>
                ) : (
                  dayEvents.map((ev) => (
                    <Link
                      key={ev.id}
                      href={`/events/${ev.id}`}
                      className="block text-left p-2 rounded-md bg-white border border-gray-100 hover:border-[#0ef9b4] shadow-sm transition-colors"
                    >
                      <div className="text-[10px] font-bold text-gray-900 tabular-nums">
                        {new Date(ev.start_time).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </div>
                      <div className="text-[11px] font-semibold text-gray-800 leading-snug line-clamp-3 mt-0.5">
                        {ev.title}
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
