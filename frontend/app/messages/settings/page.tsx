'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import BottomNav from '@/components/BottomNav';
import Link from 'next/link';

export default function MessagesSettingsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState({
    messageSounds: true,
    messagePreview: true,
    groupNotifications: true,
  });

  useEffect(() => {
    // Load saved settings from localStorage
    const saved = localStorage.getItem('messageSettings');
    if (saved) {
      setNotifications(JSON.parse(saved));
    }
  }, [user]);

  const handleToggle = (key: keyof typeof notifications) => {
    const updated = { ...notifications, [key]: !notifications[key] };
    setNotifications(updated);
    localStorage.setItem('messageSettings', JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <Navbar />
      
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center space-x-4 mb-6">
          <Link
            href="/messages"
            className="text-gray-600 hover:text-gray-900"
          >
            ← Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Messages Settings</h1>
        </div>

        {/* Notifications Section */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Notifications</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors">
              <div>
                <p className="font-semibold text-gray-900">Message Sounds</p>
                <p className="text-sm text-gray-500">Play sound when receiving messages</p>
              </div>
              <button
                onClick={() => handleToggle('messageSounds')}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.messageSounds ? 'bg-[#0ef9b4]' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                    notifications.messageSounds ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors">
              <div>
                <p className="font-semibold text-gray-900">Message Preview</p>
                <p className="text-sm text-gray-500">Show message preview in notifications</p>
              </div>
              <button
                onClick={() => handleToggle('messagePreview')}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.messagePreview ? 'bg-[#0ef9b4]' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                    notifications.messagePreview ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors">
              <div>
                <p className="font-semibold text-gray-900">Group Notifications</p>
                <p className="text-sm text-gray-500">Receive notifications for group messages</p>
              </div>
              <button
                onClick={() => handleToggle('groupNotifications')}
                className={`w-12 h-6 rounded-full transition-colors ${
                  notifications.groupNotifications ? 'bg-[#0ef9b4]' : 'bg-gray-300'
                }`}
              >
                <div
                  className={`w-5 h-5 bg-white rounded-full shadow-md transform transition-transform ${
                    notifications.groupNotifications ? 'translate-x-6' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Privacy Section */}
        <div className="bg-white rounded-3xl shadow-lg p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Privacy</h2>
          
          <div className="space-y-4">
            <div className="p-4 rounded-xl hover:bg-gray-50 transition-colors">
              <p className="font-semibold text-gray-900 mb-1">Last Seen</p>
              <p className="text-sm text-gray-500">Control who can see when you were last active</p>
              <select className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0ef9b4]">
                <option>Everyone</option>
                <option>My Contacts</option>
                <option>Nobody</option>
              </select>
            </div>

            <div className="p-4 rounded-xl hover:bg-gray-50 transition-colors">
              <p className="font-semibold text-gray-900 mb-1">Read Receipts</p>
              <p className="text-sm text-gray-500">Let others know when you've read their messages</p>
              <select className="mt-2 w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#0ef9b4]">
                <option>On</option>
                <option>Off</option>
              </select>
            </div>
          </div>
        </div>

        {/* Storage Section */}
        <div className="bg-white rounded-3xl shadow-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Storage & Data</h2>
          
          <div className="space-y-4">
            <button className="w-full p-4 rounded-xl hover:bg-gray-50 transition-colors text-left">
              <p className="font-semibold text-gray-900">Manage Storage</p>
              <p className="text-sm text-gray-500">View and manage your message storage</p>
            </button>

            <button className="w-full p-4 rounded-xl hover:bg-gray-50 transition-colors text-left">
              <p className="font-semibold text-gray-900">Export Chat</p>
              <p className="text-sm text-gray-500">Download your chat history</p>
            </button>

            <button className="w-full p-4 rounded-xl hover:bg-red-50 transition-colors text-left">
              <p className="font-semibold text-red-600">Clear All Chats</p>
              <p className="text-sm text-red-500">Delete all your messages</p>
            </button>
          </div>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

