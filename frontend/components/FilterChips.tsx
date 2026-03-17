'use client';

import { Sport } from '@/types';

interface FilterChipsProps {
  sports: Sport[];
  selectedSport: number | null;
  onSportChange: (sportId: number | null) => void;
}

export default function FilterChips({ sports, selectedSport, onSportChange }: FilterChipsProps) {
  return (
    <div className="flex items-center space-x-3 overflow-x-auto pb-2 scrollbar-hide">
      <button
        onClick={() => onSportChange(null)}
        className={`px-5 py-3 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 ${
          selectedSport === null
            ? 'bg-white/95 backdrop-blur-md text-gray-900 shadow-lg border border-white/30'
            : 'bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white/90 border border-white/20'
        }`}
      >
        All Events
      </button>
      {sports.map((sport) => (
        <button
          key={sport.id}
          onClick={() => onSportChange(sport.id)}
          className={`px-5 py-3 rounded-full text-sm font-medium whitespace-nowrap transition-all duration-300 flex items-center space-x-2 ${
            selectedSport === sport.id
              ? 'bg-white/95 backdrop-blur-md text-gray-900 shadow-lg border border-white/30'
              : 'bg-white/80 backdrop-blur-sm text-gray-700 hover:bg-white/90 border border-white/20'
          }`}
        >
          <span>{sport.icon}</span>
          <span>{sport.name}</span>
        </button>
      ))}
    </div>
  );
}

