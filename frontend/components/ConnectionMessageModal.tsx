'use client';

import { useState } from 'react';

interface ConnectionMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSend: (message: string) => void;
  userName: string;
  userSports?: Array<{ name: string; icon?: string }>;
}

export default function ConnectionMessageModal({
  isOpen,
  onClose,
  onSend,
  userName,
  userSports = [],
}: ConnectionMessageModalProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const suggestedMessages = [
    `Let's go for a run!`,
    `Want to hit the gym together?`,
    `Let's grab a workout!`,
    `Up for a training session?`,
    `Let's stay active together!`,
  ];

  // Generate sport-specific message if user has sports
  const sportSpecificMessage = userSports.length > 0
    ? `Let's go ${userSports[0].name.toLowerCase()} together!`
    : null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    
    setSending(true);
    try {
      await onSend(message.trim());
      setMessage('');
      onClose();
    } catch (error: any) {
      console.error('Failed to send message:', error);
      alert(error.message || 'Failed to send connection request. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleQuickMessage = (msg: string) => {
    setMessage(msg);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in slide-in-from-bottom-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">Connect with {userName}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <p className="text-gray-600 mb-4">Send a message to start the conversation:</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="e.g., Let's go for a run!"
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[#0ef9b4] focus:border-transparent resize-none"
            disabled={sending}
          />

          {/* Quick message suggestions */}
          <div className="space-y-2">
            <p className="text-sm text-gray-500">Quick messages:</p>
            <div className="flex flex-wrap gap-2">
              {sportSpecificMessage && (
                <button
                  type="button"
                  onClick={() => handleQuickMessage(sportSpecificMessage)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {sportSpecificMessage}
                </button>
              )}
              {suggestedMessages.map((msg, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleQuickMessage(msg)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                >
                  {msg}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={sending}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={sending || !message.trim()}
              className="flex-1 px-4 py-2 bg-[#0ef9b4] text-black rounded-lg font-semibold hover:bg-[#0dd9a0] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? 'Sending...' : 'Send & Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
