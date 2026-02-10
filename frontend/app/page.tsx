'use client';

import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/lib/auth';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import EventCardLarge from '@/components/EventCardLarge';
import ProfileAvatar from '@/components/ProfileAvatar';
import SearchBar from '@/components/SearchBar';
import FilterChips from '@/components/FilterChips';
import { Skeleton } from '@/components/SkeletonLoader';
import { useEvents, useSports } from '@/lib/hooks';
import { api } from '@/lib/api';
import { Event, User } from '@/types';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();
  const { events: eventsData, isLoading: eventsLoading } = useEvents();
  const { sports, isLoading: sportsLoading } = useSports();
  const [people, setPeople] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState<number | null>(null);
  const [searchMode, setSearchMode] = useState<'all' | 'events' | 'people'>('all');

  // Sort events by start time (upcoming first) - memoized
  const allEvents = useMemo(() => {
    return [...eventsData].sort((a, b) =>
      new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
    );
  }, [eventsData]);

  // Filter events based on search and sport selection
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

  useEffect(() => {
    if (searchQuery.trim() && (searchMode === 'all' || searchMode === 'people')) {
      searchPeople();
    } else {
      setPeople([]);
    }
  }, [searchQuery, searchMode]);

  const loadingData = eventsLoading || sportsLoading;

  const searchPeople = async () => {
    if (!searchQuery.trim()) {
      setPeople([]);
      return;
    }

    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = await api.getToken();
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        const response = await fetch(`${baseUrl}/users/search?q=${encodeURIComponent(searchQuery)}&limit=20`, {
          headers,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const users = await response.json();
          setPeople(users);
        } else {
          setPeople([]);
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name !== 'AbortError') {
          console.error('Failed to search people:', error);
        }
        setPeople([]);
      }
    } catch (error) {
      console.error('Failed to search people:', error);
      setPeople([]);
    }
  };

  // Only block on data (events/sports). Don't block on auth so the shell and
  // events can show immediately; profile banner and user-specific UI use !loading && user.
  if (loadingData) {
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
          <Skeleton className="h-8 w-48 mb-10" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[1, 2, 3, 4].map(i => (
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

  // Only show profile completion when auth has resolved (avoid flash/wrong state)
  const profileIncomplete = !loading && user && user.profile_completed !== true && (!user.full_name || !user.location || !user.sports || user.sports.length === 0 || !user.goals || user.goals.length === 0);

  // Get featured events (first 3)
  const featuredEvents = events.slice(0, 3);
  const otherEvents = events.slice(3);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 animate-in fade-in duration-300">
      <Navbar />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#0ef9b4] via-[#0dd9a0] to-[#0ef9b4] pt-12 pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Profile Completion Banner */}
          {profileIncomplete && (
            <div className="bg-white/95 backdrop-blur-md border border-white/30 rounded-2xl p-5 mb-8 shadow-xl animate-in slide-in-from-top-4 duration-500">
              <div className="flex items-start space-x-4">
                <span className="text-2xl">✨</span>
                <div className="flex-1">
                  <h3 className="font-bold text-gray-900 text-lg mb-2">Complete your profile</h3>
                  <p className="text-sm text-gray-700 mb-4">For recommendations, messaging and more!</p>
                  <Link
                    href="/profile"
                    className="inline-block bg-[#0ef9b4] text-black px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-[#0dd9a0] transition-all duration-300 shadow-sm hover:shadow-md"
                  >
                    Complete Profile
                  </Link>
                </div>
              </div>
            </div>
          )}

          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
              Discover Your Next Workout
            </h1>
            <p className="text-xl text-white/90 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
              Find events, connect with partners, and stay active
            </p>
          </div>

          {/* Search and Filters */}
          <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
            <div className="space-y-3">
              <SearchBar value={searchQuery} onChange={setSearchQuery} />
              {searchQuery.trim() && (
                <div className="flex items-center justify-center gap-3 text-sm text-white/90">
                  <button
                    onClick={() => setSearchMode('all')}
                    className={`px-4 py-1.5 rounded-lg font-medium transition-all ${
                      searchMode === 'all'
                        ? 'bg-white/20 text-white shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setSearchMode('events')}
                    className={`px-4 py-1.5 rounded-lg font-medium transition-all ${
                      searchMode === 'events'
                        ? 'bg-white/20 text-white shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    Events
                  </button>
                  <button
                    onClick={() => setSearchMode('people')}
                    className={`px-4 py-1.5 rounded-lg font-medium transition-all ${
                      searchMode === 'people'
                        ? 'bg-white/20 text-white shadow-md'
                        : 'text-white/70 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    People
                  </button>
                </div>
              )}
            </div>
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
        {/* Search Results - People */}
        {searchQuery.trim() && (searchMode === 'all' || searchMode === 'people') && people.length > 0 && (
          <div className="mb-12 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">People</h2>
              <span className="text-sm text-gray-500">{people.length} result{people.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {people.map((person) => (
                <Link
                  key={person.id}
                  href={`/profile?userId=${person.id}`}
                  className="bg-white rounded-xl p-4 shadow-md border border-gray-200 hover:shadow-lg transition-all duration-300 hover:scale-[1.02]"
                >
                  <div className="flex items-center gap-3">
                    <ProfileAvatar
                      userId={person.id}
                      avatarUrl={person.avatar_url}
                      fullName={person.full_name}
                      size="md"
                      linkToProfile={false}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 truncate">{person.full_name || 'User'}</p>
                      {person.location && (
                        <p className="text-sm text-gray-600 truncate">{person.location}</p>
                      )}
                      {person.sports && person.sports.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {person.sports.slice(0, 2).map((sport: any) => (
                            <span key={sport.id} className="text-xs bg-[#E6F9F4] text-[#0dd9a0] px-2 py-0.5 rounded-full">
                              {sport.icon} {sport.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Search Results - Events */}
        {searchQuery.trim() && (searchMode === 'all' || searchMode === 'events') && events.length > 0 && (
          <div className="mb-12 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Events</h2>
              <span className="text-sm text-gray-500">{events.length} result{events.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {events.map((event) => (
                <div key={event.id} className="animate-in fade-in slide-in-from-bottom-4">
                  <EventCardLarge event={event} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No Search Results */}
        {searchQuery.trim() && events.length === 0 && people.length === 0 && (
          <div className="text-center py-16 animate-in fade-in duration-500">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-200 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">No results found</h3>
            <p className="text-gray-600 mb-6">
              Try adjusting your search or filters
            </p>
          </div>
        )}

        {/* Featured Events - Only show when not searching */}
        {!searchQuery.trim() && featuredEvents.length > 0 && (
          <div className="mb-20 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-3xl font-bold text-gray-900">Featured Events</h2>
              <Link 
                href="/events" 
                className="bg-[#0ef9b4] text-black px-6 py-2.5 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-all duration-300 shadow-md hover:shadow-lg"
              >
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {featuredEvents.map((event, index) => (
                <div key={event.id} className="animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 100}ms` }}>
                  <EventCardLarge event={event} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Events - Only show when not searching */}
        {!searchQuery.trim() && otherEvents.length > 0 && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-3xl font-bold text-gray-900">All Events</h2>
              <Link 
                href="/events/create" 
                className="bg-[#0ef9b4] text-black px-6 py-2.5 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-all duration-300 shadow-md hover:shadow-lg"
              >
                + Create Event
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {otherEvents.map((event, index) => (
                <div key={event.id} className="animate-in fade-in slide-in-from-bottom-4" style={{ animationDelay: `${index * 50}ms` }}>
                  <EventCardLarge event={event} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State - Only show when not searching */}
        {!searchQuery.trim() && events.length === 0 && (
          <div className="text-center py-16 animate-in fade-in duration-500">
            <div className="text-6xl mb-4">🎯</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">
              {selectedSport ? 'No events found' : 'No events yet'}
            </h3>
            <p className="text-gray-600 mb-6">
              {selectedSport 
                ? 'Try adjusting your filters'
                : 'Be the first to create an event!'}
            </p>
            <Link 
              href="/events/create" 
              className="inline-block bg-[#0ef9b4] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#0dd9a0] transition-all duration-300 shadow-md hover:shadow-lg"
            >
              Create Your First Event
            </Link>
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
