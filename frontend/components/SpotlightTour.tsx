'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import {
  SPOTLIGHT_TOUR_ANCHOR_PATH,
  SPOTLIGHT_TOUR_STEPS,
  getSpotlightTourPending,
  markSpotlightTourDone,
  queryVisibleTourTarget,
} from '@/lib/spotlightTour';

const AUTH_PREFIXES = ['/login', '/register', '/auth', '/waitlist', '/forgot-password', '/reset-password'];

type FlowPhase = 'idle' | 'welcome' | 'tour' | 'next_steps';

type TourPlacement = { stepIndex: number; rect: DOMRect | null };

const NEXT_STEP_OPTIONS: { label: string; description: string; href: string }[] = [
  { label: 'Browse events', description: 'Find workouts to join', href: '/events' },
  { label: 'Find buddies', description: 'Meet people with similar goals', href: '/buddies' },
  { label: 'Open messages', description: 'Chat with your crew', href: '/messages' },
  { label: 'Edit my profile', description: 'Photos, sports, and settings', href: '/profile?tab=edit' },
  { label: 'Go to home', description: 'Featured picks and search', href: '/' },
];

const INITIAL_PLACEMENT: TourPlacement = { stepIndex: -1, rect: null };

export default function SpotlightTour() {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [flowPhase, setFlowPhase] = useState<FlowPhase>('idle');
  const [stepIndex, setStepIndex] = useState(0);
  /** Only trust rect when stepIndex matches — avoids showing the previous step’s position after Next. */
  const [placement, setPlacement] = useState<TourPlacement>(INITIAL_PLACEMENT);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setFlowPhase('idle');
      return;
    }
    const pending = getSpotlightTourPending();
    if (!pending) {
      setFlowPhase((p) => (p === 'next_steps' ? p : 'idle'));
      return;
    }
    setFlowPhase((p) => (p === 'idle' ? 'welcome' : p));
  }, [user, loading]);

  const step = SPOTLIGHT_TOUR_STEPS[stepIndex];
  const isAuthPage = pathname && AUTH_PREFIXES.some((p) => pathname.startsWith(p));
  const tourActive = flowPhase === 'tour';

  const aligned =
    placement.stepIndex === stepIndex &&
    placement.rect != null &&
    placement.rect.width >= 4 &&
    placement.rect.height >= 4;

  /** Measure before paint + rAF retries so we never flash the tooltip at a stale corner. */
  useLayoutEffect(() => {
    if (!tourActive || !step || isAuthPage || pathname !== SPOTLIGHT_TOUR_ANCHOR_PATH) {
      return;
    }

    let cancelled = false;
    let rafId = 0;

    const tryMeasure = (): boolean => {
      const el = queryVisibleTourTarget(step.targetSelector);
      if (!el) return false;
      setPlacement({ stepIndex, rect: el.getBoundingClientRect() });
      el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'auto' });
      return true;
    };

    if (tryMeasure()) {
      return () => {
        cancelled = true;
      };
    }

    let attempts = 0;
    const maxAttempts = 80;
    const tick = () => {
      if (cancelled) return;
      if (tryMeasure()) return;
      attempts += 1;
      if (attempts < maxAttempts) {
        rafId = requestAnimationFrame(tick);
      } else {
        setPlacement({ stepIndex, rect: null });
      }
    };
    rafId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [tourActive, stepIndex, step, pathname, isAuthPage]);

  useEffect(() => {
    if (!tourActive || !step || pathname !== SPOTLIGHT_TOUR_ANCHOR_PATH) return;
    if (!aligned) return;

    const onResize = () => {
      const el = queryVisibleTourTarget(step.targetSelector);
      if (el) {
        setPlacement({ stepIndex, rect: el.getBoundingClientRect() });
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [tourActive, step, stepIndex, pathname, aligned]);

  const dismissWelcome = useCallback(() => {
    markSpotlightTourDone();
    setFlowPhase('idle');
  }, []);

  const startTour = useCallback(() => {
    setStepIndex(0);
    setPlacement(INITIAL_PLACEMENT);
    setFlowPhase('tour');
    if (pathname !== SPOTLIGHT_TOUR_ANCHOR_PATH) {
      router.replace(SPOTLIGHT_TOUR_ANCHOR_PATH);
    }
  }, [pathname, router]);

  const endTourAndShowNext = useCallback(() => {
    markSpotlightTourDone();
    setPlacement(INITIAL_PLACEMENT);
    setFlowPhase('next_steps');
  }, []);

  const dismissNextSteps = useCallback(() => {
    setFlowPhase('idle');
  }, []);

  const goNextStep = useCallback(
    (href: string) => {
      setFlowPhase('idle');
      router.push(href);
    },
    [router]
  );

  const tourNext = useCallback(() => {
    if (stepIndex >= SPOTLIGHT_TOUR_STEPS.length - 1) {
      endTourAndShowNext();
      return;
    }
    setStepIndex((i) => i + 1);
  }, [stepIndex, endTourAndShowNext]);

  const tourSkip = useCallback(() => {
    endTourAndShowNext();
  }, [endTourAndShowNext]);

  const showChrome = !loading && !!user && !isAuthPage;

  if (!showChrome || flowPhase === 'idle') {
    return null;
  }

  if (flowPhase === 'welcome') {
    return (
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-[2px]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotlight-welcome-title"
      >
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0aa885]">You’re in</p>
          <h2 id="spotlight-welcome-title" className="mt-2 text-xl sm:text-[1.3125rem] font-bold text-gray-900 tracking-tight">
            Welcome to Dots
          </h2>
          <p className="mt-3 text-sm text-gray-600 leading-relaxed">
            We’ll stay on Home and highlight each item in the menu—Home, Events, Buddies, Messages, and Profile—so you
            know where to tap without jumping between pages.
          </p>
          <div className="mt-6 flex flex-col-reverse sm:flex-row gap-3">
            <button
              type="button"
              onClick={dismissWelcome}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200"
            >
              Not now
            </button>
            <button
              type="button"
              onClick={startTour}
              className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-black bg-[#0ef9b4] hover:bg-[#0dd9a0]"
            >
              Start the tour
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (flowPhase === 'next_steps') {
    return (
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-[2px] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="spotlight-next-title"
      >
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 shadow-2xl my-auto">
          <p className="text-xs font-semibold uppercase tracking-wide text-[#0aa885]">You’re all set</p>
          <h2 id="spotlight-next-title" className="mt-2 text-xl sm:text-[1.3125rem] font-bold text-gray-900 tracking-tight">
            What do you want to do next?
          </h2>
          <p className="mt-2 text-sm text-gray-600 leading-relaxed">Pick a place to jump in—we’ll take you there.</p>
          <ul className="mt-5 space-y-2">
            {NEXT_STEP_OPTIONS.map((opt) => (
              <li key={opt.href}>
                <button
                  type="button"
                  onClick={() => goNextStep(opt.href)}
                  className="w-full text-left rounded-xl border border-gray-200 px-4 py-3 transition-colors hover:border-[#0ef9b4]/60 hover:bg-[#0ef9b4]/5"
                >
                  <span className="font-semibold text-gray-900">{opt.label}</span>
                  <span className="block text-xs text-gray-500 mt-0.5">{opt.description}</span>
                </button>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={dismissNextSteps}
            className="mt-4 w-full px-4 py-3 rounded-xl text-sm font-semibold text-gray-500 hover:text-gray-800 hover:bg-gray-50"
          >
            Just explore the app
          </button>
        </div>
      </div>
    );
  }

  if (flowPhase !== 'tour' || !step) {
    return null;
  }

  if (pathname !== SPOTLIGHT_TOUR_ANCHOR_PATH) {
    return (
      <div
        className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/65 backdrop-blur-[2px] pointer-events-auto"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <p className="text-sm font-medium text-white/90 px-4 text-center">Taking you to Home for the tour…</p>
      </div>
    );
  }

  const pad = 10;
  const total = SPOTLIGHT_TOUR_STEPS.length;

  const tourCard = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#0aa885]">
        Quick tour · {stepIndex + 1} / {total}
      </p>
      <h2 id="spotlight-tour-title" className="mt-1 text-base font-bold text-gray-900">
        {step.title}
      </h2>
      <p className="mt-2 text-sm text-gray-600 leading-relaxed">{step.body}</p>
      {placement.stepIndex === stepIndex && !placement.rect && (
        <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
          Finding this control… use Next if it appears, or Skip tour.
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={tourSkip}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200"
        >
          Skip tour
        </button>
        <button
          type="button"
          onClick={tourNext}
          className="px-4 py-2 rounded-xl text-sm font-semibold text-black bg-[#0ef9b4] hover:bg-[#0dd9a0]"
        >
          {stepIndex >= total - 1 ? 'Done' : 'Next'}
        </button>
      </div>
    </>
  );

  const rect = aligned ? placement.rect! : null;
  const tooltipMaxW = 320;

  let tooltipTop = 0;
  let tooltipLeft = 0;
  if (rect) {
    const spaceBelow = window.innerHeight - rect.bottom;
    const preferBelow = spaceBelow > 200;
    if (preferBelow) {
      tooltipTop = rect.bottom + pad + 16;
    } else {
      tooltipTop = Math.max(16, rect.top - pad - 200);
    }
    const centerX = rect.left + rect.width / 2;
    tooltipLeft = Math.min(
      window.innerWidth - tooltipMaxW - 16,
      Math.max(16, centerX - tooltipMaxW / 2)
    );
  }

  return (
    <div
      className="fixed inset-0 z-[300] pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="spotlight-tour-title"
    >
      {aligned && rect ? (
        <div
          className="fixed pointer-events-none rounded-xl border-2 border-[#0ef9b4] shadow-[0_0_0_9999px_rgba(15,23,42,0.78)]"
          style={{
            top: rect.top - pad,
            left: rect.left - pad,
            width: rect.width + pad * 2,
            height: rect.height + pad * 2,
            zIndex: 301,
          }}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-900/75 z-[300]" aria-hidden />
      )}

      {aligned && rect ? (
        <div
          className="fixed z-[302] w-[min(100vw-2rem,320px)] rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl"
          style={{ top: tooltipTop, left: tooltipLeft }}
        >
          {tourCard}
        </div>
      ) : (
        <div className="fixed z-[302] left-1/2 top-1/2 w-[min(100vw-2rem,320px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-gray-200 bg-white p-5 shadow-2xl">
          {tourCard}
        </div>
      )}
    </div>
  );
}
