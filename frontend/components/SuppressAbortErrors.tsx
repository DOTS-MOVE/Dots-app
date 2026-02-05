'use client';

import { useEffect } from 'react';

/**
 * Suppresses AbortError from unhandled promise rejections.
 * Supabase auth-js (locks.ts) can throw these when auth ops are cancelled
 * (navigation, unmount, concurrent calls). They're harmless and shouldn't
 * surface as runtime errors.
 */
export default function SuppressAbortErrors() {
  useEffect(() => {
    const handler = (event: PromiseRejectionEvent) => {
      const err = event.reason;
      const isAbort =
        err?.name === 'AbortError' ||
        (typeof err?.message === 'string' && err.message.toLowerCase().includes('aborted'));
      if (isAbort) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('unhandledrejection', handler);
    return () => window.removeEventListener('unhandledrejection', handler);
  }, []);
  return null;
}
