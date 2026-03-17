'use client';

import { useState } from 'react';

interface PhotoGalleryProps {
  photos: string[];
  initials: string;
  onPhotoClick?: () => void;
}

export default function PhotoGallery({ photos, initials, onPhotoClick }: PhotoGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [imageError, setImageError] = useState(false);

  // If no photos or error, show placeholder
  if (!photos || photos.length === 0 || imageError) {
    return (
      <div className="w-full h-full bg-gradient-to-br from-[#0ef9b4] via-[#0dd9a0] to-[#0ef9b4] flex items-center justify-center" style={{ height: '100%', minHeight: '550px' }}>
        <div className="w-40 h-40 bg-white/20 rounded-full flex items-center justify-center text-white text-6xl font-bold backdrop-blur-sm">
          {initials}
        </div>
      </div>
    );
  }

  const handlePrevious = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? photos.length - 1 : prev - 1));
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex((prev) => (prev === photos.length - 1 ? 0 : prev + 1));
  };

  const handleDotClick = (index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentIndex(index);
  };

  return (
    <div 
      className="relative w-full h-full bg-gradient-to-br from-[#0ef9b4] via-[#0dd9a0] to-[#0ef9b4] overflow-hidden cursor-pointer"
      style={{ height: '100%', minHeight: '550px' }}
      onClick={onPhotoClick}
    >
      {/* Main Image */}
      <img 
        src={photos[currentIndex]} 
        alt={`Photo ${currentIndex + 1}`}
        className="w-full h-full object-cover"
        onError={() => {
          setImageError(true);
        }}
        onLoad={() => {
          setImageError(false);
        }}
        key={currentIndex} // Force re-render on index change
      />

      {/* Navigation Arrows */}
      {photos.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all duration-300 z-20"
            aria-label="Previous photo"
          >
            <span className="text-xl text-gray-700">←</span>
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 backdrop-blur-md rounded-full flex items-center justify-center shadow-lg hover:bg-white transition-all duration-300 z-20"
            aria-label="Next photo"
          >
            <span className="text-xl text-gray-700">→</span>
          </button>
        </>
      )}

      {/* Photo Indicators */}
      {photos.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-20">
          {photos.map((_, index) => (
            <button
              key={index}
              onClick={(e) => handleDotClick(index, e)}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'bg-white w-8'
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to photo ${index + 1}`}
            />
          ))}
        </div>
      )}

      {/* Photo Counter */}
      {photos.length > 1 && (
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md rounded-lg px-3 py-1.5 shadow-lg z-20">
          <span className="text-xs font-semibold text-gray-700">
            {currentIndex + 1} / {photos.length}
          </span>
        </div>
      )}
    </div>
  );
}

