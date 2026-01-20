'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter, useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import { api } from '@/lib/api';
import { Event } from '@/types';

export default function EventDetailPage() {
  const { user } = useAuth();
  const router = useRouter();
  const params = useParams();
  const eventId = parseInt(params.id as string);
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [rsvping, setRsvping] = useState(false);
  const [isParticipant, setIsParticipant] = useState(false);

  useEffect(() => {
    loadEvent();
  }, [user, eventId]);

  const loadEvent = async () => {
    try {
      const eventData = await api.getEvent(eventId);
      setEvent(eventData);
      setIsParticipant(eventData.participants?.some(p => p.id === user?.id) || false);
    } catch (error) {
      console.error('Failed to load event:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRsvp = async () => {
    setRsvping(true);
    try {
      await api.rsvpEvent(eventId);
      await loadEvent();
    } catch (error: any) {
      alert(error.message || 'Failed to RSVP');
    } finally {
      setRsvping(false);
    }
  };

  const handleCancelRsvp = async () => {
    setRsvping(true);
    try {
      await api.cancelRsvp(eventId);
      await loadEvent();
    } catch (error: any) {
      alert(error.message || 'Failed to cancel RSVP');
    } finally {
      setRsvping(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-600">Event not found</div>
        </div>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formatDateTime = (dateString: string) => {
    return `${formatDate(dateString)} at ${formatTime(dateString)}`;
  };

  // Get sport emoji/icon and gradient
  const sportStyles: { [key: string]: { icon: string; gradient: string } } = {
    'Running': { icon: '🏃', gradient: 'from-orange-400 to-red-500' },
    'Cycling': { icon: '🚴', gradient: 'from-blue-400 to-cyan-500' },
    'Swimming': { icon: '🏊', gradient: 'from-blue-500 to-indigo-600' },
    'Yoga': { icon: '🧘', gradient: 'from-purple-400 to-pink-500' },
    'Basketball': { icon: '🏀', gradient: 'from-orange-500 to-red-600' },
    'Tennis': { icon: '🎾', gradient: 'from-green-400 to-emerald-500' },
    'Weightlifting': { icon: '🏋️', gradient: 'from-gray-600 to-gray-800' },
    'Hiking': { icon: '🥾', gradient: 'from-green-500 to-teal-600' },
  };

  const sportStyle = event.sport ? sportStyles[event.sport.name] || { icon: '🏃', gradient: 'from-[#0ef9b4] to-[#0dd9a0]' } : { icon: '🏃', gradient: 'from-[#0ef9b4] to-[#0dd9a0]' };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      {/* Hero Image Section */}
      <div className="relative w-full h-96 md:h-[500px] overflow-hidden">
        {event.image_url || event.cover_image_url ? (
          <>
            <img 
              src={(event.image_url || event.cover_image_url) ?? undefined} 
              alt={event.title}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </>
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${sportStyle.gradient} flex items-center justify-center`}>
            <div className="text-9xl opacity-50">
              {sportStyle.icon}
            </div>
          </div>
        )}
        
        {/* Event Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8 text-white">
          <h1 className="text-4xl md:text-5xl font-bold mb-2 drop-shadow-lg">{event.title}</h1>
          {event.sport && (
            <div className="flex items-center space-x-2">
              <span className="text-2xl">{event.sport.icon}</span>
              <span className="text-lg font-medium">{event.sport.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Event Details Card */}
            <div className="bg-white rounded-3xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">About this event</h2>
              
              {event.description ? (
                <p className="text-gray-700 leading-relaxed text-lg mb-6">{event.description}</p>
              ) : (
                <p className="text-gray-500 italic mb-6">No description provided.</p>
              )}

              {/* Event Info Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-gray-200">
                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-[#E6F9F4] rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">📅</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Date & Time</p>
                    <p className="text-gray-900 font-medium">{formatDate(event.start_time)}</p>
                    <p className="text-gray-600">{formatTime(event.start_time)}</p>
                    {event.end_time && (
                      <p className="text-gray-500 text-sm mt-1">Until {new Date(event.end_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-[#E6F9F4] rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">📍</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Location</p>
                    <p className="text-gray-900 font-medium">{event.location}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-4">
                  <div className="w-12 h-12 bg-[#E6F9F4] rounded-xl flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl">👥</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Participants</p>
                    <p className="text-gray-900 font-medium">
                      {event.participant_count}
                      {event.max_participants && ` / ${event.max_participants}`}
                    </p>
                    {event.max_participants && (
                      <p className="text-gray-500 text-sm mt-1">
                        {event.max_participants - event.participant_count} spots remaining
                      </p>
                    )}
                  </div>
                </div>

                {event.host && (
                  <div className="flex items-start space-x-4">
                    <div className="w-12 h-12 bg-[#E6F9F4] rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">👤</span>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Hosted by</p>
                      <p className="text-gray-900 font-medium">{event.host.full_name || 'Anonymous'}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Participants Section */}
            <div className="bg-white rounded-3xl shadow-lg p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                Participants ({event.participant_count})
              </h2>
              {event.participants && event.participants.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {event.participants.map(participant => (
                    <div key={participant.id} className="flex items-center space-x-3 p-3 rounded-xl hover:bg-gray-50 transition-colors">
                      <div className="w-12 h-12 bg-gradient-to-br from-[#0ef9b4] to-[#0dd9a0] rounded-full flex items-center justify-center text-white font-bold flex-shrink-0">
                        {participant.avatar_url ? (
                          <img src={participant.avatar_url} alt={participant.full_name || ''} className="w-12 h-12 rounded-full object-cover" />
                        ) : (
                          <span>{participant.full_name?.[0] || 'U'}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {participant.full_name || 'Anonymous'}
                          {participant.id === event.host_id && (
                            <span className="ml-2 text-xs bg-[#E6F9F4] text-[#0dd9a0] px-2 py-0.5 rounded-full font-medium">Host</span>
                          )}
                        </p>
                        {participant.location && (
                          <p className="text-sm text-gray-500 truncate">{participant.location}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No participants yet. Be the first to join!</p>
              )}
            </div>
          </div>

          {/* Right Column - Action Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-3xl shadow-lg p-6 sticky top-8">
              {event.host_id !== user?.id && (
                <div className="space-y-4">
                  {isParticipant ? (
                    <>
                      <div className="flex items-center space-x-2 text-[#0dd9a0] mb-4">
                        <span className="text-2xl">✓</span>
                        <span className="font-semibold">You're going!</span>
                      </div>
                      <button
                        onClick={handleCancelRsvp}
                        disabled={rsvping}
                        className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-300 transition-colors disabled:opacity-50"
                      >
                        {rsvping ? 'Cancelling...' : 'Cancel RSVP'}
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={handleRsvp}
                      disabled={rsvping || (event.max_participants ? event.participant_count >= event.max_participants : false)}
                      className="w-full px-6 py-4 bg-[#0ef9b4] text-black rounded-xl font-bold text-lg hover:bg-[#0dd9a0] transition-colors disabled:opacity-50 shadow-lg hover:shadow-xl"
                    >
                      {rsvping ? 'RSVPing...' : 'RSVP to Event'}
                    </button>
                  )}
                  {event.max_participants && event.participant_count >= event.max_participants && !isParticipant && (
                    <p className="text-sm text-red-500 text-center">Event is full</p>
                  )}
                </div>
              )}

              {/* Quick Info */}
              <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Event Details</p>
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2 text-sm">
                      <span>📅</span>
                      <span className="text-gray-700">{formatDate(event.start_time)}</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <span>🕐</span>
                      <span className="text-gray-700">{formatTime(event.start_time)}</span>
                    </div>
                    <div className="flex items-start space-x-2 text-sm">
                      <span>📍</span>
                      <span className="text-gray-700">{event.location}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

