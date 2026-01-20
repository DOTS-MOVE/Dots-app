'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import Logo from './Logo';

export default function Navbar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [unreadCount, setUnreadCount] = useState(0);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  useEffect(() => {
    const loadUnreadCount = async () => {
      if (!user) {
        setUnreadCount(0);
        return;
      }

      try {
        const conversations = await api.getConversations();
        const totalUnread = conversations.reduce((sum, conv) => sum + (conv.unread_count || 0), 0);
        setUnreadCount(totalUnread);
      } catch (error) {
        console.error('Failed to load unread count:', error);
        setUnreadCount(0);
      }
    };

    loadUnreadCount();
    // Refresh unread count every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, [user]);

  if (!user) {
    return (
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 backdrop-blur-sm bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center h-16">
              <Logo size="small" />
            </div>
            <div className="flex items-center space-x-4">
              <Link href="/login" className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors">
                Sign In
              </Link>
              <Link href="/register" className="px-4 py-2 text-sm font-medium text-white bg-[#0ef9b4] rounded-lg hover:bg-[#0dd9a0] transition-colors">
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
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 backdrop-blur-sm bg-white/95 hidden md:block transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <div className="flex items-center space-x-8">
            <div className="flex items-center h-16">
              <Logo size="small" />
            </div>
            <div className="flex space-x-2">
              {navLinks.map((link) => {
                const active = isActive(link.href);
                const showBadge = link.href === '/messages' && unreadCount > 0;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 relative ${
                      active
                        ? 'bg-[#E6F9F4] text-[#0dd9a0] font-semibold'
                        : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
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
          <div className="flex items-center space-x-4">
            <Link
              href="/profile"
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                pathname === '/profile'
                  ? 'bg-[#E6F9F4] text-[#0dd9a0] font-semibold'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              Profile
            </Link>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}

