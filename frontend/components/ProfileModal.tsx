'use client';

import { useEffect } from 'react';
import { IconMapPin, IconCheck } from '@/components/Icons';

interface ProfileModalProps {
  user: {
    id: number;
    full_name: string | null;
    age: number | null;
    location: string | null;
    avatar_url: string | null;
    bio: string | null;
    sports?: Array<{ id: number; name: string; icon?: string }>;
    goals?: Array<{ id: number; name: string }>;
  };
  score: number;
  isOpen: boolean;
  onClose: () => void;
}

export default function ProfileModal({ user, score, isOpen, onClose }: ProfileModalProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const initials = user.full_name
    ? user.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl animate-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Image */}
        <div className="relative h-64 bg-gradient-to-br from-[#0ef9b4] via-[#0dd9a0] to-[#0ef9b4] flex items-center justify-center">
          {user.avatar_url ? (
            <img 
              src={user.avatar_url} 
              alt={user.full_name || ''} 
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-32 h-32 bg-white/20 rounded-full flex items-center justify-center text-white text-5xl font-bold backdrop-blur-sm">
              {initials}
            </div>
          )}
          
          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-4 left-4 w-10 h-10 bg-white/95 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-colors"
          >
            <span className="text-2xl">×</span>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Name and Location */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-3xl font-bold text-gray-900">
                {user.full_name || 'Anonymous'}
                {user.age && <span className="text-2xl text-gray-600 font-normal ml-2">{user.age}</span>}
              </h2>
            </div>
            {user.location && (
              <div className="flex items-center text-gray-600">
                <IconMapPin className="w-5 h-5 mr-2 flex-shrink-0" />
                <span className="text-base">{user.location}</span>
              </div>
            )}
          </div>

          {/* Bio */}
          {user.bio && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-600 uppercase mb-2">About</h3>
              <p className="text-gray-700 leading-relaxed">{user.bio}</p>
            </div>
          )}

          {/* Sports */}
          {user.sports && user.sports.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">Sports Interests</h3>
              <div className="flex flex-wrap gap-2">
                {user.sports.map((sport) => (
                  <span
                    key={sport.id}
                    className="px-4 py-2 bg-[#E6F9F4] text-[#0dd9a0] rounded-full text-sm font-semibold"
                  >
                    {sport.icon && <span className="mr-1">{sport.icon}</span>}
                    {sport.name}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Goals */}
          {user.goals && user.goals.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-gray-600 uppercase mb-3">Fitness Goals</h3>
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

          {/* Buddy Details */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <div className="bg-[#E6F9F4] rounded-2xl p-4">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Why you're a great buddy:</h3>
              <ul className="text-sm text-gray-600 space-y-1">
                {user.location && <li className="flex items-center gap-2"><IconCheck className="w-4 h-4 flex-shrink-0" /> Located nearby</li>}
                {user.sports && user.sports.length > 0 && <li className="flex items-center gap-2"><IconCheck className="w-4 h-4 flex-shrink-0" /> Shared sports interests</li>}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

