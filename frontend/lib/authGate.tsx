'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface AuthGateContextType {
  openAuthGate: (redirectTo: string) => void;
}

const AuthGateContext = createContext<AuthGateContextType | null>(null);

export function useAuthGate() {
  const ctx = useContext(AuthGateContext);
  if (!ctx) throw new Error('useAuthGate must be used inside AuthGateProvider');
  return ctx;
}

interface AuthGateProviderProps {
  children: ReactNode;
}

export function AuthGateProvider({ children }: AuthGateProviderProps) {
  const [redirectTo, setRedirectTo] = useState<string | null>(null);

  const openAuthGate = useCallback((path: string) => {
    setRedirectTo(path);
  }, []);

  const close = useCallback(() => setRedirectTo(null), []);

  return (
    <AuthGateContext.Provider value={{ openAuthGate }}>
      {children}
      {redirectTo !== null && (
        <AuthGateModal redirectTo={redirectTo} onClose={close} />
      )}
    </AuthGateContext.Provider>
  );
}

function AuthGateModal({ redirectTo, onClose }: { redirectTo: string; onClose: () => void }) {
  const encodedRedirect = encodeURIComponent(redirectTo);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-gate-title"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-[#0ef9b4]/20 flex items-center justify-center mb-5">
          <svg className="w-8 h-8 text-[#0dd9a0]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>

        <h2 id="auth-gate-title" className="text-xl font-bold text-gray-900 mb-2">
          Join Dots to view this event
        </h2>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          Create an account or sign in to see full event details, RSVP, and connect with other athletes.
        </p>

        <div className="w-full flex flex-col gap-3">
          <a
            href={`/register?redirect=${encodedRedirect}`}
            className="w-full py-3 px-6 bg-[#0ef9b4] text-black font-semibold rounded-xl hover:bg-[#0dd9a0] transition-colors text-center"
          >
            Create account
          </a>
          <a
            href={`/login?redirect=${encodedRedirect}`}
            className="w-full py-3 px-6 bg-white text-gray-900 font-semibold rounded-xl border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-colors text-center"
          >
            Sign in
          </a>
        </div>

        <p className="mt-6 text-xs text-gray-400">
          Free to join &middot; No credit card required
        </p>
      </div>
    </div>
  );
}
