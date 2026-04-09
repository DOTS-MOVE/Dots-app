'use client';

import { useEffect, useMemo, useRef } from 'react';
import { dateKeyLocal, startOfWeekSunday } from '@/lib/date-keys';

interface EventDateStripProps {
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  eventDateKeys?: Set<string>;
}

export default function EventDateStrip({ selectedDate, onSelectDate, eventDateKeys }: EventDateStripProps) {
  const selectedRef = useRef<HTMLButtonElement>(null);
  const selectedKey = dateKeyLocal(selectedDate);

  const days = useMemo(() => {
    const start = startOfWeekSunday(selectedDate);
    start.setDate(start.getDate() - 7);
    const out: Date[] = [];
    for (let i = 0; i < 48; i++) {
      const x = new Date(start);
      x.setDate(start.getDate() + i);
      out.push(x);
    }
    return out;
  }, [selectedKey]);

  useEffect(() => {
    selectedRef.current?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
  }, [selectedKey]);

  const longLabel = selectedDate.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-3 pt-3 pb-2">
      <div className="flex gap-0.5 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
        {days.map((d) => {
          const key = dateKeyLocal(d);
          const isSel = key === selectedKey;
          const hasEvent = eventDateKeys?.has(key) ?? false;
          const weekday = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();

          return (
            <button
              key={`${key}-${d.getTime()}`}
              ref={isSel ? selectedRef : undefined}
              type="button"
              onClick={() =>
                onSelectDate(new Date(d.getFullYear(), d.getMonth(), d.getDate()))
              }
              className="flex flex-col items-center min-w-[3.25rem] shrink-0 py-2 px-1 rounded-lg hover:bg-gray-50"
            >
              <span
                className={`text-[10px] font-semibold tracking-wide ${
                  isSel ? 'text-gray-900' : 'text-gray-400'
                }`}
              >
                {weekday}
              </span>
              <span
                className={`text-base tabular-nums leading-tight mt-0.5 ${
                  isSel ? 'text-gray-900 font-bold' : 'text-gray-400 font-medium'
                }`}
              >
                {d.getDate()}
              </span>
              {isSel ? (
                <span className="h-1 w-9 bg-gray-900 rounded-full mt-1.5" aria-hidden />
              ) : hasEvent ? (
                <span className="h-1.5 w-1.5 bg-[#0ef9b4] rounded-full mt-1.5" aria-hidden />
              ) : (
                <span className="h-1 w-9 mt-1.5" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
      <p className="text-sm text-gray-500 font-medium px-1 pb-1">{longLabel}</p>
    </div>
  );
}
