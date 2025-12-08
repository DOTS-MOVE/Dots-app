'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, user } = useAuth();
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/');
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      // Login updates user state, useEffect will handle redirect
    } catch (err: any) {
      setError(err.message || 'Failed to login');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center space-y-3">
          <Logo size="large" />
          <p className="text-gray-700 text-sm font-medium">Meet. Move. Motivate.</p>
        </div>

        {/* Admin Credentials */}
        <div className="bg-[#E6F9F4] border border-[#00D9A5] rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-[#00B88A] mb-2">🔑 Admin Access:</p>
          <div className="text-xs text-gray-700 space-y-1">
            <p><strong>Email:</strong> admin@dots.app</p>
            <p><strong>Password:</strong> admin123</p>
          </div>
        </div>

        {/* Sign In Form */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Returning user?</span>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="bg-[#4A4A4A] text-white px-6 py-2 rounded-lg font-medium text-sm hover:bg-[#3A3A3A] transition-colors disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'SIGN IN'}
            </button>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            <div>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D9A5] focus:border-transparent"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            
            <div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#00D9A5] focus:border-transparent"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </form>
        </div>

        {/* Join Button */}
        <div>
          <Link
            href="/register"
            className="w-full bg-[#00D9A5] text-black px-6 py-4 rounded-lg font-bold text-center block hover:bg-[#00B88A] transition-colors"
          >
            JOIN
          </Link>
        </div>
      </div>
    </div>
  );
}

