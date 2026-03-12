'use client';

import { useState, useRef, useEffect } from 'react';
import PhotoGallery from './PhotoGallery';
import ProfileAvatar from './ProfileAvatar';
import { IconCheck, IconMapPin, IconCalendar, IconTarget } from '@/components/Icons';

interface SwipeableCardProps {
  user: {
    id: number;
    full_name: string | null;
    age: number | null;
    location: string | null;
    avatar_url: string | null;
    bio: string | null;
    sports?: Array<{ id: number; name: string; icon?: string }>;
    goals?: Array<{ id: number; name: string }>;
    recent_events?: Array<{ id: number; title: string; sport: { id: number; name: string; icon?: string } | null; start_time: string }>;
    badges?: Array<{ name: string; icon: string }>;
    event_count?: number;
    photos?: string[];
  };
  score: number;
  onSwipe: (direction: 'left' | 'right') => void;
  onViewProfile: () => void;
  index: number;
  total: number;
}

export default function SwipeableCard({ user, score, onSwipe, onViewProfile, index, total }: SwipeableCardProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const cardRef = useRef<HTMLDivElement>(null);

  const initials = user.full_name
    ? user.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setStartPos({ x: clientX, y: clientY });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;

    const deltaX = clientX - startPos.x;
    const deltaY = clientY - startPos.y;
    
    setPosition({ x: deltaX, y: deltaY });
    setRotation(deltaX * 0.1);
  };

  const handleEnd = () => {
    if (!isDragging) return;
    
    const threshold = 100;
    if (Math.abs(position.x) > threshold) {
      const exitX = position.x > 0 ? 500 : -500;
      setPosition({ x: exitX, y: position.y });
      setRotation(position.x > 0 ? 30 : -30);
      
      onSwipe(position.x > 0 ? 'right' : 'left');
      
      setTimeout(() => {
        setPosition({ x: 0, y: 0 });
        setRotation(0);
      }, 300);
    } else {
      setPosition({ x: 0, y: 0 });
      setRotation(0);
    }
    setIsDragging(false);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    handleStart(e.clientX, e.clientY);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      handleMove(e.clientX, e.clientY);
    }
  };

  const handleMouseUp = () => {
    handleEnd();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    handleStart(touch.clientX, touch.clientY);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (isDragging) {
      const touch = e.touches[0];
      handleMove(touch.clientX, touch.clientY);
    }
  };

  const handleTouchEnd = () => {
    handleEnd();
  };

  const scale = 1 - (index * 0.05);
  const opacity = 1 - (index * 0.2);
  const zIndex = total - index;

  const getSwipeOpacity = () => {
    if (position.x === 0) return 0;
    return Math.min(Math.abs(position.x) / 200, 1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div
      ref={cardRef}
      className="w-full h-full"
      style={{
        transform: `translate(${position.x}px, ${position.y}px) rotate(${rotation}deg) scale(${scale})`,
        opacity: opacity,
        zIndex: zIndex,
        transition: isDragging ? 'none' : 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease-out',
        cursor: isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="bg-white rounded-3xl shadow-xl hover:shadow-2xl overflow-hidden flex transition-shadow duration-300" style={{ height: '550px', minHeight: '550px' }}>
        {/* Swipe indicators */}
        {position.x > 50 && (
          <div 
            className="absolute inset-0 bg-[#0ef9b4]/20 flex items-center justify-center z-10 rounded-3xl"
            style={{ opacity: getSwipeOpacity() }}
          >
            <div className="text-6xl font-bold text-[#0ef9b4] transform rotate-12"><IconCheck className="w-16 h-16" /></div>
          </div>
        )}
        {position.x < -50 && (
          <div 
            className="absolute inset-0 bg-red-500/20 flex items-center justify-center z-10 rounded-3xl"
            style={{ opacity: getSwipeOpacity() }}
          >
            <div className="text-6xl font-bold text-red-500 transform -rotate-12">✗</div>
          </div>
        )}

        {/* Left Side - Photo Gallery */}
        <div 
          className="relative flex-shrink-0 overflow-hidden"
          style={{ width: '450px', minWidth: '450px' }}
        >
          <PhotoGallery
            photos={user.photos || []}
            initials={initials}
            onPhotoClick={() => {
              if (!isDragging) {
                onViewProfile();
              }
            }}
          />
          
          {/* Avatar Badge - links to profile */}
          <div className="absolute top-4 left-4 z-10" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white/95 backdrop-blur-md rounded-full p-1 shadow-lg border-2 border-white/30">
              <ProfileAvatar
                userId={user.id}
                avatarUrl={user.avatar_url}
                fullName={user.full_name}
                size="lg"
              />
            </div>
          </div>

          {/* Badges overlay on image */}
          {user.badges && user.badges.length > 0 && (
            <div className="absolute bottom-16 left-4 right-4 flex gap-2 flex-wrap z-10">
              {user.badges.map((badge, idx) => (
                <div
                  key={idx}
                  className="px-3 py-1.5 bg-white/95 backdrop-blur-md rounded-lg text-xs font-semibold text-[#0dd9a0] flex items-center gap-1.5 shadow-lg"
                  title={badge.name}
                >
                  <span>{badge.icon}</span>
                  <span>{badge.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Side - Full User Info */}
        <div className="flex-1 p-8 flex flex-col bg-white overflow-y-auto min-h-0 scrollbar-hide">
          {/* Header */}
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {user.full_name || 'Anonymous'}
            </h2>
            <div className="flex items-center gap-4 mb-4">
              {user.age && (
                <span className="text-base text-gray-600">{user.age} years old</span>
              )}
              {user.location && (
                <div className="flex items-center text-gray-600">
                  <IconMapPin className="w-4 h-4 mr-1 flex-shrink-0" />
                  <span className="text-base">{user.location}</span>
                </div>
              )}
            </div>

            {/* Stats Bar */}
            <div className="flex items-center gap-6 mb-4 pb-4 border-b border-gray-200">
              {user.event_count !== undefined && (
                <div className="flex items-center gap-2">
                  <IconCalendar className="w-5 h-5 text-gray-600 flex-shrink-0" />
                  <div>
                    <div className="text-lg font-bold text-gray-900">{user.event_count}</div>
                    <div className="text-xs text-gray-500">Events</div>
                  </div>
                </div>
              )}
              {user.sports && user.sports.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xl">🏃</span>
                  <div>
                    <div className="text-lg font-bold text-gray-900">{user.sports.length}</div>
                    <div className="text-xs text-gray-500">Sports</div>
                  </div>
                </div>
              )}
              {user.goals && user.goals.length > 0 && (
                <div className="flex items-center gap-2">
                  <IconTarget className="w-5 h-5 text-gray-600 flex-shrink-0" />
                  <div>
                    <div className="text-lg font-bold text-gray-900">{user.goals.length}</div>
                    <div className="text-xs text-gray-500">Goals</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Bio */}
          {user.bio && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-2 uppercase tracking-wide">About</h3>
              <p className="text-gray-700 leading-relaxed">
                {user.bio}
              </p>
            </div>
          )}

          {/* Recent Events */}
          {user.recent_events && user.recent_events.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Recent Events Attended</h3>
              <div className="space-y-3">
                {user.recent_events.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">
                    {event.sport?.icon && (
                      <div className="text-2xl flex-shrink-0">{event.sport.icon}</div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-gray-900 mb-1">{event.title}</div>
                      {event.start_time && (
                        <div className="text-xs text-gray-500">{formatDate(event.start_time)}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sports Interests */}
          {user.sports && user.sports.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Sports Interests</h3>
              <div className="flex flex-wrap gap-2">
                {user.sports.map((sport) => (
                  <span
                    key={sport.id}
                    className="px-4 py-2 bg-[#E6F9F4] text-[#0dd9a0] rounded-full text-sm font-semibold flex items-center gap-2"
                  >
                    {sport.icon && <span>{sport.icon}</span>}
                    <span>{sport.name}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Fitness Goals */}
          {user.goals && user.goals.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-600 mb-3 uppercase tracking-wide">Fitness Goals</h3>
              <div className="flex flex-wrap gap-2">
                {user.goals.map((goal) => (
                  <span
                    key={goal.id}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-medium"
                  >
                    {goal.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
