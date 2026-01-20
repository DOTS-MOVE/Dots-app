'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Logo from '@/components/Logo';
import { supabase } from '@/lib/supabase';

function ResetPasswordPageContent() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if we have a valid session (user came from email link)
    // Supabase automatically processes the token from URL hash when detectSessionInUrl is true
    let mounted = true;

    const checkSession = async () => {
      // Check if there's a token in the URL hash (Supabase password recovery)
      const hash = window.location.hash;
      
      if (hash && hash.includes('access_token')) {
        // Token is in URL - Supabase client will process it automatically
        // Listen for auth state changes to detect when token is processed
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
            if (mounted && !loading) {
              // Token processed successfully, user can now reset password
              if (!session) {
                setError('Invalid or expired reset link. Please request a new password reset.');
              }
            }
            subscription.unsubscribe();
          }
        });

        // Also check for session after a delay
        setTimeout(async () => {
          if (!mounted) return;
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            if (mounted) {
              const errorMsg = error.message || 'Invalid or expired reset link. Please request a new password reset.';
              setError(errorMsg);
            }
            subscription.unsubscribe();
            return;
          }
          
          if (!session) {
            // Token might not have been processed yet, wait a bit more
            setTimeout(async () => {
              if (!mounted) return;
              const { data: { session: retrySession }, error: retryError } = await supabase.auth.getSession();
              subscription.unsubscribe();
              if (!mounted) return;
              
              if (retryError) {
                const errorMsg = retryError.message || 'Invalid or expired reset link. Please request a new password reset.';
                setError(errorMsg);
              } else if (!retrySession) {
                setError('Invalid or expired reset link. Please request a new password reset.');
              }
            }, 2000);
          } else {
            subscription.unsubscribe();
          }
        }, 1500);
      } else {
        // No token in URL - check if we already have a session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        
        if (error) {
          const errorMsg = error.message || 'Invalid or expired reset link. Please request a new password reset.';
          setError(errorMsg);
        } else if (!session) {
          setError('Invalid or expired reset link. Please request a new password reset.');
        }
      }
    };
    
    checkSession();

    return () => {
      mounted = false;
    };
  }, [loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      // First verify we have a valid session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session) {
        throw new Error(sessionError?.message || 'No active session. The reset link may have expired. Please request a new password reset.');
      }

      // Update the password
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        throw new Error(error.message);
      }

      setSuccess(true);
      // Redirect to login after 2 seconds
      setTimeout(() => {
        router.push('/login?message=Password reset successful. Please sign in with your new password.');
      }, 2000);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to reset password';
      setError(errorMsg);
      console.error('Password reset error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6">
          <div className="flex flex-col items-center space-y-3">
            <Logo size="large" />
          </div>

          <div className="bg-green-50 border border-green-200 rounded-xl p-6 space-y-4">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto mb-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset Successful!</h2>
              <p className="text-gray-700 mb-4">
                Your password has been successfully reset. Redirecting to login...
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-8">
        <div className="flex flex-col items-center space-y-3">
          <Logo size="large" />
          <p className="text-gray-700 text-sm font-medium">Meet. Move. Motivate.</p>
        </div>

        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">Reset Password</h2>
          <p className="text-sm text-gray-600 text-center mb-6">
            Enter your new password below.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
              <span className="block sm:inline">{error}</span>
            </div>
          )}
          <div className="relative">
            <label htmlFor="password" className="sr-only">New Password</label>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#0ef9b4] focus:border-[#0ef9b4] sm:text-sm pr-10"
              placeholder="New Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
              disabled={loading}
            >
              {showPassword ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.879 16.121A4.995 4.995 0 0112 15c.794 0 1.547.173 2.236.498m-1.268-1.268a10.05 10.05 0 013.139-3.139L21 12c-1.275 4.057-5.065 7-9.543 7a9.97 9.97 0 01-3.029-1.563m-2.858-5.858a3 3 0 11-4.243-4.243" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          <div className="relative">
            <label htmlFor="confirmPassword" className="sr-only">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-[#0ef9b4] focus:border-[#0ef9b4] sm:text-sm pr-10"
              placeholder="Confirm Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-500 hover:text-gray-700"
              disabled={loading}
            >
              {showConfirmPassword ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.879 16.121A4.995 4.995 0 0112 15c.794 0 1.547.173 2.236.498m-1.268-1.268a10.05 10.05 0 013.139-3.139L21 12c-1.275 4.057-5.065 7-9.543 7a9.97 9.97 0 01-3.029-1.563m-2.858-5.858a3 3 0 11-4.243-4.243" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
              )}
            </button>
          </div>

          <div>
            <button
              type="submit"
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-black bg-[#0ef9b4] hover:bg-[#0dd9a0] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#0ef9b4] disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>

        <div className="text-sm text-center">
          <Link href="/login" className="font-medium text-[#0ef9b4] hover:text-[#0dd9a0]">
            Back to Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex flex-col items-center space-y-3">
            <Logo size="large" />
            <p className="text-gray-700 text-sm font-medium">Meet. Move. Motivate.</p>
          </div>
          <div className="text-center text-gray-500">Loading...</div>
        </div>
      </div>
    }>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
