import { Event } from '@/types';

export function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function startOfWeekSunday(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  x.setDate(x.getDate() - day);
  return x;
}

export function groupEventsByLocalDate(events: Event[]): Record<string, Event[]> {
  const grouped: Record<string, Event[]> = {};
  for (const event of events) {
    if (!event.start_time) continue;
    const date = new Date(event.start_time);
    if (Number.isNaN(date.getTime())) continue;
    const key = dateKeyLocal(date);
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(event);
  }
  for (const key of Object.keys(grouped)) {
    grouped[key].sort(
      (a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }
  return grouped;
}
