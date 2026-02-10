# Initial Page Load Performance – Research Summary

## What we found

Initial navigation felt slow on every page because of **blocking on auth** and **heavy main bundle** work on first load.

### 1. Auth blocking the entire shell (main cause)

- **Root layout** wraps the app in `AuthProvider`, which on mount runs:
  1. `supabase.auth.getSession()` (with a **15 second** timeout)
  2. If a session exists, then `api.getCurrentUser()` (8s timeout)
- `AuthProvider` keeps `loading === true` until both finish.
- The **home page** does: `if (loading || loadingData) return <FullPageSkeleton />`.
- So the user sees a full-page skeleton until **both** auth and data (events + sports) are done. That makes every first load feel like a “massive” wait, especially when Supabase or the API is slow.

**Conclusion:** The UI was intentionally waiting for auth before showing any real content on the home page, so auth latency (and the long 15s timeout) directly caused the perceived “massive loading times.”

### 2. Heavy `api` module on the critical path

- `lib/api.ts` **statically imports** the whole `lib/mockData.ts` module (600+ lines: mock users, events, buddies, conversations, etc.).
- Many entry points pull in `api`: root layout (via auth dynamic import), `lib/hooks.ts` (used by home and events), `Navbar`, and multiple pages.
- So the **main bundle** (or a very common chunk) includes the full API client and all mock data, even though:
  - Real endpoints (`getEvents`, `getSports`, `getCurrentUser`, etc.) use `fetch`, not mock arrays.
  - The only use of mock data in `api.ts` was initializing `localBuddies`, `localMessages`, `localEvents`, which are **never read** in the current code paths.
- That increases **parse/compile time** and **initial JS size** on every page load.

**Conclusion:** Unnecessary mock data in the main bundle made first load heavier and slower.

### 3. No “show shell first” strategy

- The app could show the **shell** (navbar, bottom nav, hero, search/filters) and **public content** (e.g. events list) as soon as events/sports data is ready.
- Instead, the home page required **auth** to finish before showing that content, so a slow auth path delayed everything.

### 4. Other notes

- **Leaflet** is only used in `EventsMap.tsx`, which is not in the main navigation; `optimizePackageImports` for leaflet is already in place for when the map is used.
- **Profile page** blocks on `authLoading` by design (profile is user-specific); that’s acceptable. The main win is making **home** and **shared shell** fast.
- **Fonts** (Geist, Geist Mono) in the root layout can block text rendering; using `display: 'swap'` avoids invisible text and can improve perceived load.

---

## Fixes applied

1. **Home page:** Only block on **data** loading (`loadingData`), not on auth. Show shell + events (or events loading state) immediately; show “Complete profile” and other user-only UI only when auth has resolved (`!loading && user`).
2. **Auth timeout:** Reduced the initial `getSession()` timeout from **15s to 4s** so a slow Supabase doesn’t hang the app.
3. **Bundle size:** Removed the static `mockData` import from `api.ts` and initialized the unused `localBuddies`, `localMessages`, `localEvents` as empty arrays so the large mock module is no longer in the main bundle.
4. **Fonts:** Set `display: 'swap'` on the root layout fonts so text can paint sooner.

These changes should significantly improve perceived load on initial navigation, especially on the home page.
