'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { api } from '@/lib/api';
import Logo from './Logo';

const SOCIAL_LINKS = [
  {
    label: 'Instagram',
    href: 'https://www.instagram.com/dotsmove?igsh=MTQxNWg3dnFwNDlvOQ==',
    icon: (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
      </svg>
    ),
  },
  // {
  //   label: 'X (Twitter)',
  //   href: '#',
  //   icon: (
  //     <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
  //       <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  //     </svg>
  //   ),
  // },
  // {
  //   label: 'TikTok',
  //   href: '#',
  //   icon: (
  //     <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
  //       <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.75a4.85 4.85 0 01-1.01-.06z" />
  //     </svg>
  //   ),
  // },
];

function SocialIcons() {
  return (
    <div className="flex items-center gap-1">
      {SOCIAL_LINKS.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.label}
          className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-all"
        >
          {s.icon}
        </a>
      ))}
    </div>
  );
}

export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const loadUnreadCount = async () => {
      try {
        const conversations = await api.getConversations();
        const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
        setUnreadCount(totalUnread);
      } catch (err) {
        setUnreadCount(0);
        // Stop polling on auth/network errors so we don't spam 401s
        if (pollingRef.current) {
          clearInterval(pollingRef.current);
          pollingRef.current = null;
        }
      }
    };

    loadUnreadCount();
    pollingRef.current = setInterval(loadUnreadCount, 30000);
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [user]);

  // While auth is loading, show neutral header (no Sign In/Join) so we don't flash logged-out state on refresh
  if (loading) {
    return (
      <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center h-16">
              <Logo size="small" />
            </div>
            <div className="w-24" aria-hidden />
          </div>
        </div>
      </nav>
    );
  }

  if (!user) {
    return (
      <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50 hidden md:block">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center h-16">
              <Logo size="small" />
            </div>
            <div className="flex items-center space-x-3">
              <SocialIcons />
              <div className="w-px h-5 bg-gray-200" />
              <Link href="/login" className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-all">
                Sign In
              </Link>
              <Link href="/register" className="px-4 py-2 text-sm font-semibold text-black bg-[#0ef9b4] rounded-xl hover:bg-[#0dd9a0] transition-all shadow-sm">
                Join
              </Link>
            </div>
          </div>
        </div>
      </nav>
    );
  }

  const navLinks = [
    { href: '/', label: 'Home' },
    { href: '/events', label: 'Events' },
    { href: '/buddies', label: 'Buddies' },
    { href: '/messages', label: 'Messages' },
  ];

  const isActive = (href: string) => {
    if (href === '/') {
      return pathname === '/';
    }
    return pathname?.startsWith(href);
  };

  return (
    <nav className="bg-white/95 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50 hidden md:block">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-8">
            <div className="flex items-center h-16">
              <Logo size="small" />
            </div>
            <div className="flex space-x-1">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                const showBadge = link.href === '/messages' && unreadCount > 0;
                const tour =
                  link.href === '/'
                    ? 'tour-nav-home'
                    : link.href === '/events'
                      ? 'tour-nav-events'
                      : link.href === '/buddies'
                        ? 'tour-nav-buddies'
                        : link.href === '/messages'
                          ? 'tour-nav-messages'
                          : undefined;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    data-tour={tour}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all relative ${
                      active
                        ? 'bg-[#E6F9F4] text-[#0dd9a0] font-semibold'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    {link.label}
                    {showBadge && (
                      <span className="absolute -top-1 -right-1 bg-[#0ef9b4] text-black text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <SocialIcons />
            <div className="w-px h-5 bg-gray-200" />
            <Link
              href="/profile"
              data-tour="tour-nav-profile"
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                pathname === '/profile'
                  ? 'bg-[#E6F9F4] text-[#0dd9a0] font-semibold'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-500 hover:text-gray-900 rounded-xl hover:bg-gray-100 transition-all"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

