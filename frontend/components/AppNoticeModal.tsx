'use client';

import { useEffect } from 'react';

export type AppNoticeVariant = 'success' | 'error' | 'info';

type AppNoticeModalProps = {
  isOpen: boolean;
  onClose: () => void;
  variant?: AppNoticeVariant;
  title?: string;
  message: string;
};

function IconSuccess({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="22" className="fill-[#E6F9F4]" />
      <circle cx="24" cy="24" r="22" className="stroke-[#0ef9b4]/45" strokeWidth={1.5} fill="none" />
      <path
        d="M15 24l6 6 12-14"
        className="stroke-[#0aa885]"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconError({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="22" className="fill-red-50" />
      <circle cx="24" cy="24" r="22" className="stroke-red-200/90" strokeWidth={1.5} fill="none" />
      <path d="M24 17v11" className="stroke-red-500" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx="24" cy="34" r="1.25" className="fill-red-500" />
    </svg>
  );
}

function IconInfo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="22" className="fill-slate-50" />
      <circle cx="24" cy="24" r="22" className="stroke-slate-200" strokeWidth={1.5} fill="none" />
      <path
        className="fill-slate-500"
        d="M22 19h4v2h-2v7h-2v-9zm2 11.25a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5z"
      />
    </svg>
  );
}

export default function AppNoticeModal({
  isOpen,
  onClose,
  variant = 'info',
  title,
  message,
}: AppNoticeModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const defaultTitle =
    variant === 'success' ? 'You’re all set' : variant === 'error' ? 'That didn’t work' : 'Quick note';
  const heading = title ?? defaultTitle;

  const Icon =
    variant === 'success' ? IconSuccess : variant === 'error' ? IconError : IconInfo;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center p-5 sm:p-6 bg-slate-900/45 backdrop-blur-md animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="app-notice-title"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[380px] animate-in zoom-in-95 fade-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="relative overflow-hidden rounded-[1.35rem] bg-white shadow-[0_25px_50px_-12px_rgba(15,23,42,0.25),0_0_0_1px_rgba(15,23,42,0.06)]"
        >
          {/* soft top wash */}
          <div
            className={`absolute inset-x-0 top-0 h-28 opacity-90 pointer-events-none ${
              variant === 'success'
                ? 'bg-gradient-to-b from-[#E6F9F4] to-transparent'
                : variant === 'error'
                  ? 'bg-gradient-to-b from-red-50/90 to-transparent'
                  : 'bg-gradient-to-b from-slate-50 to-transparent'
            }`}
          />

          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="relative px-8 pb-8 pt-10 text-center">
            <div className="mx-auto mb-5 flex h-[4.5rem] w-[4.5rem] items-center justify-center">
              <Icon className="h-[4.5rem] w-[4.5rem]" />
            </div>

            <h2
              id="app-notice-title"
              className="text-[1.35rem] font-bold tracking-tight text-slate-900 sm:text-2xl"
            >
              {heading}
            </h2>
            <p className="mt-3 text-[0.9375rem] leading-relaxed text-slate-600 whitespace-pre-line px-1">
              {message}
            </p>

            <button
              type="button"
              onClick={onClose}
              className="mt-8 w-full rounded-2xl bg-[#0ef9b4] px-5 py-3.5 text-[0.9375rem] font-semibold text-slate-900 shadow-sm shadow-[#0ef9b4]/25 transition-all hover:bg-[#0dd9a0] hover:shadow-md hover:shadow-[#0dd9a0]/30 active:scale-[0.98]"
            >
              Got it
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
