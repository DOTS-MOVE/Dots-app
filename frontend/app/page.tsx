'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import EventCardLarge from '@/components/EventCardLarge';
import SearchBar from '@/components/SearchBar';
import FilterChips from '@/components/FilterChips';
import { api } from '@/lib/api';
import { Event, Sport } from '@/types';
import Link from 'next/link';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<Event[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSport, setSelectedSport] = useState<number | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!loading && mounted) {
      // Only redirect if we're sure user is not logged in (after a delay to allow auth to load)
      const checkAuth = setTimeout(() => {
        if (!user) {
          router.push('/login');
          return;
        }
        loadData();
      }, 500);
      return () => clearTimeout(checkAuth);
    } else if (user && mounted) {
      loadData();
    }
  }, [user, loading, mounted]);

  useEffect(() => {
    filterEvents();
  }, [searchQuery, selectedSport, allEvents]);

  const loadData = async () => {
    try {
      const [eventsData, sportsData] = await Promise.all([
        api.getEvents(),
        api.getSports(),
      ]);
      // Sort events by start time (upcoming first)
      const sortedEvents = eventsData.sort((a, b) => 
        new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
      );
      setAllEvents(sortedEvents);
      setEvents(sortedEvents);
      setSports(sportsData);
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoadingData(false);
    }
  };

  const filterEvents = () => {
    let filtered = [...allEvents];

    // Filter by sport
    if (selectedSport !== null) {
      filtered = filtered.filter(event => event.sport?.id === selectedSport);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(event =>
        event.title.toLowerCase().includes(query) ||
        event.description?.toLowerCase().includes(query) ||
        event.location.toLowerCase().includes(query) ||
        event.sport?.name.toLowerCase().includes(query)
      );
    }

    setEvents(filtered);
  };

  if (loading || loadingData || !mounted) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Check if profile is incomplete - only show if missing essential fields
  const profileIncomplete = !user?.full_name || !user?.location || !user?.sports || user.sports.length === 0 || !user?.goals || user.goals.length === 0;

  // Get featured events (first 3)
  const featuredEvents = events.slice(0, 3);
  const otherEvents = events.slice(3);

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0 animate-in fade-in duration-300">
      <Navbar />
      
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#00D9A5] via-[#00B88A] to-[#00D9A5] pt-12 pb-16">
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
                    className="inline-block bg-[#00D9A5] text-black px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-[#00B88A] transition-all duration-300 shadow-sm hover:shadow-md"
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
            <SearchBar value={searchQuery} onChange={setSearchQuery} />
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
        {/* Featured Events */}
        {featuredEvents.length > 0 && (
          <div className="mb-20 animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-3xl font-bold text-gray-900">Featured Events</h2>
              <Link 
                href="/events" 
                className="text-[#00D9A5] hover:text-[#00B88A] font-semibold text-sm transition-colors"
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

        {/* All Events */}
        {otherEvents.length > 0 && (
          <div className="animate-in fade-in duration-500">
            <div className="flex items-center justify-between mb-10">
              <h2 className="text-3xl font-bold text-gray-900">All Events</h2>
              <Link 
                href="/events/create" 
                className="bg-[#00D9A5] text-black px-6 py-2.5 rounded-xl font-semibold hover:bg-[#00B88A] transition-all duration-300 shadow-md hover:shadow-lg"
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

        {/* Empty State */}
        {events.length === 0 && (
          <div className="text-center py-16 animate-in fade-in duration-500">
            <div className="text-6xl mb-4">🎯</div>
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
              className="inline-block bg-[#00D9A5] text-black px-6 py-3 rounded-xl font-semibold hover:bg-[#00B88A] transition-all duration-300 shadow-md hover:shadow-lg"
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
