'use client';

import { useRef, useEffect, useState, useCallback, ReactNode } from 'react';

interface CarouselProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  autoScrollInterval?: number;
}

export default function Carousel<T>({ items, renderItem, autoScrollInterval = 4000 }: CarouselProps<T>) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const activeIndexRef = useRef(0);
  const dragStart = useRef({ x: 0, scrollLeft: 0 });

  const scrollToIndex = useCallback((index: number) => {
    if (!trackRef.current) return;
    const cards = Array.from(trackRef.current.children) as HTMLElement[];
    const card = cards[index];
    if (!card) return;
    trackRef.current.scrollTo({ left: card.offsetLeft, behavior: 'smooth' });
    activeIndexRef.current = index;
    setActiveIndex(index);
  }, []);

  const goNext = useCallback(() => {
    scrollToIndex((activeIndexRef.current + 1) % items.length);
  }, [items.length, scrollToIndex]);

  const goPrev = useCallback(() => {
    scrollToIndex((activeIndexRef.current - 1 + items.length) % items.length);
  }, [items.length, scrollToIndex]);

  useEffect(() => {
    if (isPaused || isDragging || items.length <= 1) return;
    const timer = setInterval(goNext, autoScrollInterval);
    return () => clearInterval(timer);
  }, [goNext, isPaused, isDragging, autoScrollInterval, items.length]);

  const onScroll = useCallback(() => {
    if (!trackRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = trackRef.current;
    // If we've scrolled to the very end, snap to last item
    if (scrollWidth - scrollLeft - clientWidth < 10) {
      activeIndexRef.current = items.length - 1;
      setActiveIndex(items.length - 1);
      return;
    }
    const cards = Array.from(trackRef.current.children) as HTMLElement[];
    let best = 0;
    let bestDist = Infinity;
    cards.forEach((el, i) => {
      const dist = Math.abs(el.offsetLeft - scrollLeft);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    activeIndexRef.current = best;
    setActiveIndex(best);
  }, [items.length]);

  const onMouseDown = (e: React.MouseEvent) => {
    if (!trackRef.current) return;
    setIsDragging(true);
    dragStart.current = { x: e.pageX, scrollLeft: trackRef.current.scrollLeft };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !trackRef.current) return;
    e.preventDefault();
    trackRef.current.scrollLeft = dragStart.current.scrollLeft - (e.pageX - dragStart.current.x) * 1.2;
  };

  const onMouseUp = () => setIsDragging(false);

  if (items.length === 0) return null;

  return (
    <div
      className="relative select-none"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => { setIsPaused(false); setIsDragging(false); }}
    >
      {/* Previous arrow */}
      {items.length > 1 && activeIndex > 0 && (
        <button
          onClick={goPrev}
          aria-label="Previous"
          className="absolute -left-5 top-[42%] -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 hidden sm:flex items-center justify-center hover:bg-gray-50 hover:shadow-xl active:scale-95 transition-all duration-200"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Next arrow */}
      {items.length > 1 && activeIndex < items.length - 1 && (
        <button
          onClick={goNext}
          aria-label="Next"
          className="absolute -right-5 top-[42%] -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-white shadow-lg border border-gray-100 hidden sm:flex items-center justify-center hover:bg-gray-50 hover:shadow-xl active:scale-95 transition-all duration-200"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Track */}
      <div
        ref={trackRef}
        className={`flex items-stretch gap-6 overflow-x-auto snap-x snap-mandatory pb-4 ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onScroll={onScroll}
      >
        {items.map((item, i) => (
          <div key={i} className="snap-start flex-shrink-0 w-[82vw] sm:w-[46vw] lg:w-[380px]">
            {renderItem(item, i)}
          </div>
        ))}
      </div>

      {/* Dot indicators */}
      {items.length > 1 && (
        <div className="flex justify-center gap-2 mt-3">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => scrollToIndex(i)}
              aria-label={`Go to slide ${i + 1}`}
              className={`rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? 'w-6 h-2 bg-[#0ef9b4]'
                  : 'w-2 h-2 bg-gray-300 hover:bg-gray-400'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
