/** Run once after signup onboarding (or Save & browse) to highlight real nav on each screen. */
export const SPOTLIGHT_TOUR_STORAGE_KEY = 'dots_spotlight_tour_v1';

/** Tour stays on Home and only highlights nav items (no route changes per step). */
export const SPOTLIGHT_TOUR_ANCHOR_PATH = '/';

export type SpotlightTourStep = {
  id: string;
  /** CSS selector; first visible matching element is highlighted */
  targetSelector: string;
  title: string;
  body: string;
};

export const SPOTLIGHT_TOUR_STEPS: SpotlightTourStep[] = [
  {
    id: 'home',
    targetSelector: '[data-tour="tour-nav-home"]',
    title: 'Home',
    body: 'Your hub for featured events, search, and what’s happening in the community.',
  },
  {
    id: 'events',
    targetSelector: '[data-tour="tour-nav-events"]',
    title: 'Events',
    body: 'Tap here to discover and join workouts. On larger screens you can switch between list and calendar.',
  },
  {
    id: 'buddies',
    targetSelector: '[data-tour="tour-nav-buddies"]',
    title: 'Buddies',
    body: 'Find people by sport and goals, send requests, and grow your crew.',
  },
  {
    id: 'messages',
    targetSelector: '[data-tour="tour-nav-messages"]',
    title: 'Messages',
    body: 'Chat with buddies and keep up with event conversations.',
  },
  {
    id: 'profile',
    targetSelector: '[data-tour="tour-nav-profile"]',
    title: 'Profile',
    body: 'Your posts, events, and Edit profile — same place you’ll manage photos and settings.',
  },
];

export function requestSpotlightTour() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SPOTLIGHT_TOUR_STORAGE_KEY, 'pending');
  } catch {
    /* ignore quota / private mode */
  }
}

export function markSpotlightTourDone() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SPOTLIGHT_TOUR_STORAGE_KEY, 'done');
  } catch {
    /* ignore */
  }
}

export function getSpotlightTourPending(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(SPOTLIGHT_TOUR_STORAGE_KEY) === 'pending';
  } catch {
    return false;
  }
}

export function queryVisibleTourTarget(selector: string): HTMLElement | null {
  const list = document.querySelectorAll(selector);
  for (let i = 0; i < list.length; i++) {
    const el = list[i] as HTMLElement;
    const r = el.getBoundingClientRect();
    const style = window.getComputedStyle(el);
    if (
      r.width >= 4 &&
      r.height >= 4 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0'
    ) {
      return el;
    }
  }
  return null;
}
