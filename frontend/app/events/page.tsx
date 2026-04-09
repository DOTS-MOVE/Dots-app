'use client';

import { useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import EventCardLarge from '@/components/EventCardLarge';
import EventDateStrip from '@/components/EventDateStrip';
import EventRowCompact from '@/components/EventRowCompact';
import EventsCalendar from '@/components/EventsCalendar';
import EventsWeekView from '@/components/EventsWeekView';
import SearchBar from '@/components/SearchBar';
import FilterChips from '@/components/FilterChips';
import LoadingScreen from '@/components/LoadingScreen';
import Carousel from '@/components/Carousel';
import { CalendarDaysIcon } from '@/components/Icons';
import { useEvents, useSports } from '@/lib/hooks';
import { dateKeyLocal, groupEventsByLocalDate } from '@/lib/date-keys';
import Link from 'next/link';

function startOfToday() {
  const t = new Date();
  return new Date(t.getFullYear(), t.getMonth(), t.getDate());
}

export default function EventsPage() {
  const { events: eventsData, isLoading: eventsLoading } = useEvents();
  const { sports, isLoading: sportsLoading } = useSports();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarSelectedDate, setCalendarSelectedDate] = useState(startOfToday);
  const [webCalendarScope, setWebCalendarScope] = useState<'month' | 'week'>('month');

  const loading = eventsLoading || sportsLoading;

  const allEvents = useMemo(() => {
    return [...eventsData].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [eventsData]);

  const events = useMemo(() => {
    let filtered = [...allEvents];

    if (selectedSport !== null) {
      filtered = filtered.filter(event => {
        const eventSportId = event.sport?.id ?? event.sport_id;
        return Number(eventSportId) === Number(selectedSport);
      });
    }
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query) ||
        event.location.toLowerCase().includes(query) ||
        event.sport?.name.toLowerCase().includes(query)
      );
    }
    return filtered;
  }, [allEvents, selectedSport, searchQuery]);

  const futureEvents = useMemo(() => {
    const now = new Date();
    return events.filter(e => new Date(e.start_time) >= now);
  }, [events]);

  const featuredEvents = useMemo(() => futureEvents.filter(e => e.is_featured === true), [futureEvents]);

  const pastEvents = useMemo(() => {
    const now = new Date();
    return [...events]
      .filter(e => new Date(e.start_time) < now)
      .sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());
  }, [events]);

  const eventsByLocalDate = useMemo(() => groupEventsByLocalDate(events), [events]);
  const calendarDayEvents = useMemo(() => {
    const key = dateKeyLocal(calendarSelectedDate);
    return eventsByLocalDate[key] ?? [];
  }, [eventsByLocalDate, calendarSelectedDate]);

  const eventDateKeys = useMemo(() => new Set(Object.keys(eventsByLocalDate)), [eventsByLocalDate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <LoadingScreen message="Loading events..." />
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 animate-in fade-in duration-300">
      <Navbar />
      
      {/* Hero Section */}
      <div className="dots-gradient-hero pt-12 pb-16 relative">
        <Link
          href="/"
          className="absolute top-4 left-4 md:top-6 md:left-6 flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 text-white rounded-xl font-medium transition-colors backdrop-blur-sm z-10"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </Link>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              Discover Events
            </h1>
            <p className="text-xl text-white/90 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
              Find your next workout, connect with others, and stay active
            </p>
          </div>

          {/* Search and Filters */}
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <SearchBar 
              value={searchQuery} 
              onChange={setSearchQuery}
              placeholder="Search events by title, description, or location..."
            />

            <FilterChips 
              sports={sports} 
              selectedSport={selectedSport} 
              onSportChange={setSelectedSport} 
            />
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-10 animate-in fade-in duration-500">
          <h2 className="text-2xl font-bold text-gray-900">
            {events.length} {events.length === 1 ? 'Event' : 'Events'} Found
          </h2>
          <div className="w-full md:w-auto flex flex-col sm:flex-row gap-3 md:gap-4">
            {/* View Toggle */}
            <div className="w-full sm:w-auto flex items-center justify-center bg-white rounded-xl p-1 shadow-md border border-gray-200">
              <button
                onClick={() => setViewMode('list')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                  viewMode === 'list'
                    ? 'bg-[#0ef9b4] text-black shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                List
              </button>
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 flex items-center gap-2 ${
                  viewMode === 'calendar'
                    ? 'bg-[#0ef9b4] text-black shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Calendar
              </button>
            </div>
              <Link
              href="/events/create"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 bg-[#0ef9b4] text-black px-5 py-2 rounded-xl font-semibold whitespace-nowrap hover:bg-[#0dd9a0] transition-all shadow-sm hover:shadow-md text-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Create Event
            </Link>
          </div>
        </div>

        {/* Events Grid or Calendar */}
        {events.length === 0 ? (
          <div className="text-center py-16 animate-in fade-in duration-500">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
              <CalendarDaysIcon className="w-8 h-8 text-gray-400" aria-hidden />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {searchQuery || selectedSport ? 'No events found' : 'No events yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchQuery || selectedSport
                ? 'Try adjusting your search or filters'
                : 'Be the first to create an event!'}
            </p>
            <Link 
              href="/events/create" 
              className="inline-block bg-[#0ef9b4] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-all duration-300 shadow-md hover:shadow-lg"
            >
              Create Your First Event
            </Link>
          </div>
        ) : viewMode === 'calendar' ? (
          <div className="animate-in fade-in duration-500 space-y-4">
            <div className="md:hidden space-y-4">
              <EventDateStrip
                selectedDate={calendarSelectedDate}
                onSelectDate={setCalendarSelectedDate}
                eventDateKeys={eventDateKeys}
              />
              <div className="flex items-center justify-between bg-white rounded-xl border border-gray-200 px-4 py-3">
                <div>
                  <p className="text-sm font-bold text-gray-900">All</p>
                  <p className="text-xs text-gray-500">
                    {calendarDayEvents.length}{' '}
                    {calendarDayEvents.length === 1 ? 'event' : 'events'}
                  </p>
                </div>
                <button
                  type="button"
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-50"
                  aria-label="Filter events"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"
                    />
                  </svg>
                </button>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 px-4">
                {calendarDayEvents.length === 0 ? (
                  <p className="py-10 text-center text-gray-500 text-sm">No events on this day.</p>
                ) : (
                  calendarDayEvents.map((event) => (
                    <EventRowCompact key={event.id} event={event} />
                  ))
                )}
              </div>
            </div>

            <div className="hidden md:block space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3">
                <div className="flex items-center justify-center bg-white rounded-xl p-1 shadow-md border border-gray-200 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setWebCalendarScope('month')}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 flex-1 sm:flex-none ${
                      webCalendarScope === 'month'
                        ? 'bg-[#0ef9b4] text-black shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setWebCalendarScope('week')}
                    className={`px-4 py-2 rounded-lg font-semibold text-sm transition-all duration-300 flex-1 sm:flex-none ${
                      webCalendarScope === 'week'
                        ? 'bg-[#0ef9b4] text-black shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    Week
                  </button>
                </div>
              </div>
              {webCalendarScope === 'month' ? (
                <EventsCalendar
                  events={events}
                  highlightDate={calendarSelectedDate}
                  onDateSelect={(d) =>
                    setCalendarSelectedDate(
                      new Date(d.getFullYear(), d.getMonth(), d.getDate())
                    )
                  }
                />
              ) : (
                <EventsWeekView events={events} weekAnchorDate={calendarSelectedDate} />
              )}
            </div>
          </div>
        ) : (
          <>
            {(searchQuery.trim() || selectedSport !== null) ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                {events.map((event, index) => (
                  <div
                    key={event.id}
                    className="animate-in fade-in slide-in-from-bottom-4 h-full"
                    style={{ animationDelay: `${index * 50}ms` }}
                  >
                    <EventCardLarge event={event} />
                  </div>
                ))}
              </div>
            ) : (
              <>
                {/* Featured Events Carousel */}
                {featuredEvents.length > 0 && (
                  <div className="mb-12 animate-in fade-in duration-500">
                    <h3 className="text-2xl font-bold text-gray-900 mb-8">Featured Events</h3>
                    <Carousel
                      items={featuredEvents}
                      autoScrollInterval={4500}
                      renderItem={(event) => <EventCardLarge event={event} />}
                    />
                  </div>
                )}

                {futureEvents.length > 0 && (
                  <div className="mb-16">
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">Upcoming Events</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                      {futureEvents.map((event, index) => (
                        <div
                          key={event.id}
                          className="animate-in fade-in slide-in-from-bottom-4 h-full"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <EventCardLarge event={event} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {pastEvents.length > 0 && (
                  <div className="mt-8">
                    <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-6">Previous Events</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
                      {pastEvents.map((event, index) => (
                        <div
                          key={event.id}
                          className="animate-in fade-in slide-in-from-bottom-4 opacity-90 h-full"
                          style={{ animationDelay: `${index * 50}ms` }}
                        >
                          <EventCardLarge event={event} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
