'use client';

import { useMemo, useState } from 'react';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import EventCardLarge from '@/components/EventCardLarge';
import EventsCalendar from '@/components/EventsCalendar';
import SearchBar from '@/components/SearchBar';
import FilterChips from '@/components/FilterChips';
import { Skeleton } from '@/components/SkeletonLoader';
import { useEvents, useSports } from '@/lib/hooks';
import { Event } from '@/types';
import Link from 'next/link';

export default function EventsPage() {
  const { events: allEvents, isLoading: eventsLoading } = useEvents();
  const { sports, isLoading: sportsLoading } = useSports();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const loading = eventsLoading || sportsLoading;

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

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
        <Navbar />
        <div className="bg-gradient-to-br from-[#0ef9b4] via-[#0dd9a0] to-[#0ef9b4] pt-12 pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <Skeleton className="h-12 w-96 mx-auto mb-6" />
              <Skeleton className="h-6 w-80 mx-auto" />
            </div>
            <div className="max-w-3xl mx-auto space-y-6">
              <Skeleton className="h-12 w-full" />
              <div className="flex gap-2">
                {[1, 2, 3, 4].map(i => (
                  <Skeleton key={i} className="h-8 w-20" />
                ))}
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-10">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-10 w-32" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <Skeleton className="h-48 w-full" />
                <div className="p-6">
                  <Skeleton className="h-6 w-3/4 mb-3" />
                  <Skeleton className="h-4 w-full mb-2" />
                  <Skeleton className="h-4 w-2/3 mb-4" />
                  <Skeleton className="h-10 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 animate-in fade-in duration-300">
      <Navbar />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#0ef9b4] via-[#0dd9a0] to-[#0ef9b4] pt-12 pb-16 relative">
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
        <div className="flex items-center justify-between mb-10 animate-in fade-in duration-500">
          <h2 className="text-3xl font-bold text-gray-900">
            {events.length} {events.length === 1 ? 'Event' : 'Events'} Found
          </h2>
          <div className="flex items-center space-x-4">
            {/* View Toggle */}
            <div className="flex items-center bg-white rounded-xl p-1 shadow-md border border-gray-200">
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
              className="bg-[#0ef9b4] text-black px-6 py-2.5 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-all duration-300 shadow-md hover:shadow-lg"
            >
              + Create Event
            </Link>
          </div>
        </div>

        {/* Events Grid or Calendar */}
        {events.length === 0 ? (
          <div className="text-center py-16 animate-in fade-in duration-500">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
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
          <div className="animate-in fade-in duration-500">
            <EventsCalendar events={events} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {events.map((event, index) => (
              <div key={event.id} className="animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 50}ms` }}>
                <EventCardLarge event={event} />
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}

