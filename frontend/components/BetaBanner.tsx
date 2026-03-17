'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function BetaBanner() {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) {
    return null;
  }

  return (
    <div className="relative bg-gradient-to-r from-[#0ef9b4]/15 via-[#0ef9b4]/10 to-[#0ef9b4]/5 border-b border-[#0ef9b4]/30 overflow-hidden">
      {/* Subtle pattern overlay */}
      <div className="absolute inset-0 opacity-[0.03]" style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, #0ef9b4 1px, transparent 0)',
        backgroundSize: '24px 24px'
      }}></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-6 py-5">
          <div className="flex items-start gap-4 flex-1 min-w-0">
            <div className="flex-shrink-0 mt-1.5">
              <div className="relative">
                <div className="w-3 h-3 rounded-full bg-[#0ef9b4] shadow-sm"></div>
                <div className="absolute inset-0 w-3 h-3 rounded-full bg-[#0ef9b4] animate-ping opacity-75"></div>
              </div>
            </div>
            <p className="text-base text-gray-800 leading-relaxed flex-1 font-medium">
              <span className="font-bold text-gray-900">We&apos;re in beta!</span>{' '}
              Dots is live in the <span className="font-semibold text-gray-900">Washington, D.C. metro area</span> as we onboard our first community of users and events. 
              We&apos;re partnering, learning, and expanding quickly—{' '}
              <Link 
                href="/waitlist" 
                className="inline-flex items-center gap-1.5 text-[#0dd9a0] hover:text-[#0bb88a] font-semibold transition-colors group relative"
              >
                <span className="relative">
                  share your feedback
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#0ef9b4] group-hover:bg-[#0dd9a0] transition-colors"></span>
                </span>
                <svg className="w-4 h-4 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              {' '}and let us know where Dots should launch next.
            </p>
          </div>
          <button
            onClick={() => setIsDismissed(true)}
            className="flex-shrink-0 text-gray-500 hover:text-gray-700 transition-colors p-2 rounded-md hover:bg-gray-200/50 focus:outline-none focus:ring-2 focus:ring-gray-300"
            aria-label="Dismiss banner"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
