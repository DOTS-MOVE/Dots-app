# ADR-009: Vercel Web Analytics Integration

- Status: Proposed
- Date: 2026-04-07
- Owners: Frontend Team
- Decision Type: Observability / Frontend

## Context

Dots currently has no production analytics instrumentation. There is no visibility into:

- Which pages users visit and how frequently.
- Where users drop off in the auth and onboarding funnel.
- How often core engagement actions (RSVP, buddy requests, event creation) occur.
- Referral sources and geographic distribution of users.

Two categories of observability exist in the codebase but neither serves this purpose:

- `authDiagnostics.ts` — auth-specific debug logging for local development.
- `apiDebug.ts` — API request/error logging, also debug-only.

Without product analytics, the team is making feature prioritization decisions without behavioral data.

## Problem Statement

We need a lightweight, privacy-respecting analytics solution that:

- Tracks pageviews automatically across all routes.
- Supports custom event tracking for high-value user actions.
- Requires minimal setup and maintenance overhead.
- Does not introduce cookie consent requirements.
- Integrates cleanly with the existing Next.js 16 App Router architecture.

## Decision Drivers

- **Low integration cost**: The frontend is Next.js deployed on Vercel; first-party tooling should be preferred when it meets requirements.
- **Privacy by default**: No cookies, no PII storage, no consent banner required.
- **Signal quality**: Bot filtering, anonymized visitor hashing (24-hour expiry), and automatic route change detection.
- **Vercel plan alignment**: The project is already on Vercel; Web Analytics is available on Pro and above.

## Decision

Adopt **Vercel Web Analytics** (`@vercel/analytics`) for frontend observability.

### Package

```bash
cd frontend && npm install @vercel/analytics --legacy-peer-deps
```

### Provider Setup

Add the `Analytics` component to the root layout. This enables automatic pageview tracking across all routes with no further configuration.

```tsx
// frontend/app/layout.tsx
import { Analytics } from '@vercel/analytics/next';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### Custom Event Tracking

Use the `track()` API at call sites in page and component files — not inside `lib/api.ts` — so each event carries contextually relevant properties.

```ts
import { track } from '@vercel/analytics';

track('event_rsvp', { sport: event.sport, capacity: event.capacity });
```

## Instrumentation Plan

Events are organized into three tiers by insight value.

### Tier 1 — Core Engagement Loop

These events map directly to the app's primary value proposition (finding sports buddies and events). They should be instrumented first.

| Event Name | Trigger | Location |
|---|---|---|
| `event_created` | `createEvent()` resolves successfully | `app/events/create/page.tsx` |
| `event_rsvp` | `rsvpEvent()` resolves successfully | `app/events/[id]/page.tsx` |
| `event_rsvp_cancelled` | `cancelRsvp()` resolves successfully | `app/events/[id]/page.tsx` |
| `buddy_request_sent` | `createBuddy()` resolves successfully | `app/buddies/page.tsx` or `components/BuddyGrid.tsx` |
| `buddy_request_accepted` | `updateBuddy({ status: 'accepted' })` resolves | `app/buddies/page.tsx` |

### Tier 2 — Auth & Activation Funnel

These events measure the conversion from visitor to active user.

| Event Name | Trigger | Location |
|---|---|---|
| `user_registered` | Supabase `signUp()` resolves successfully | `lib/auth.tsx` in `register()` |
| `profile_completed` | `completeProfile()` resolves successfully | `lib/api.ts` wrapper or onboarding component |
| `waitlist_joined` | Waitlist form submission succeeds | `app/waitlist/page.tsx` |

### Tier 3 — Social & Retention

These events measure ongoing engagement after activation.

| Event Name | Trigger | Location |
|---|---|---|
| `post_created` | `createPost()` resolves successfully | `components/CreatePostForm.tsx` |
| `post_liked` | `likePost()` resolves successfully | `app/profile/page.tsx` |
| `message_sent` | `sendMessage()` resolves successfully | `app/messages/page.tsx` |
| `group_created` | `createGroup()` resolves successfully | `app/messages/page.tsx` |

## Alternatives Considered

### Segment + Amplitude / Mixpanel

Full-featured product analytics platforms with richer querying and funnel analysis.

**Rejected because**: Higher integration cost (SDK setup, identify calls, destination configuration), requires cookie consent for GDPR compliance, adds third-party data sharing, and is over-engineered for the current team size and traffic volume.

### Google Analytics 4 (GA4)

Widely adopted, free, deep integration with Google Ads.

**Rejected because**: Cookie-based by default, requires consent banners in relevant jurisdictions, and data is shared with Google. Adds compliance overhead disproportionate to current needs.

### Plausible / Fathom

Privacy-first, cookieless alternatives to GA4.

**Not selected because**: Vercel Web Analytics meets the same privacy bar at lower cost (already included in the Vercel plan) without adding a third-party vendor.

## Consequences

### Positive

- Automatic pageview tracking across all Next.js routes with a single component addition.
- No cookie consent banner required (cookieless, anonymized).
- Bot traffic filtered automatically.
- Zero backend changes required.
- Dashboard is co-located with deployment infrastructure in the Vercel console.

### Negative / Trade-offs

- Custom event tracking (`track()`) requires a Vercel Pro plan or higher.
- Analytics data is only collected in production (not localhost). Local testing of event calls requires deploying to a preview environment.
- Less queryable than a dedicated analytics warehouse — no funnel analysis, cohort retention, or SQL access. If those become necessary, the custom events here can be replicated to a richer destination later.
- Vercel Analytics data retention and export policies are dictated by Vercel's terms; the team does not own the raw data.

## Activation Steps

1. `npm install @vercel/analytics` in `frontend/`.
2. Add `<Analytics />` to `app/layout.tsx`.
3. Enable Web Analytics in the Vercel dashboard (Analytics tab → Enable).
4. Deploy to production or a preview environment.
5. Instrument Tier 1 custom events.
6. Instrument Tier 2 custom events.
7. Instrument Tier 3 custom events.
8. Verify events appear in the Vercel Analytics dashboard within 24 hours of first traffic.

## Summary Checklist

### Setup

- [x] `cd frontend && npm install @vercel/analytics --legacy-peer-deps`
- [x] Add `<Analytics />` to `app/layout.tsx`
- [ ] Enable Web Analytics in Vercel dashboard (Analytics tab → Enable)
- [ ] Deploy to production or preview environment

### Tier 1 — Core Engagement Loop

- [ ] `event_created` — `app/events/create/page.tsx`
- [ ] `event_rsvp` — `app/events/[id]/page.tsx`
- [ ] `event_rsvp_cancelled` — `app/events/[id]/page.tsx`
- [ ] `buddy_request_sent` — `app/buddies/page.tsx` or `components/BuddyGrid.tsx`
- [ ] `buddy_request_accepted` — `app/buddies/page.tsx`

### Tier 2 — Auth and Activation Funnel

- [ ] `user_registered` — `lib/auth.tsx`
- [ ] `profile_completed` — `lib/api.ts` or onboarding component
- [ ] `waitlist_joined` — `app/waitlist/page.tsx`

### Tier 3 — Social and Retention

- [ ] `post_created` — `components/CreatePostForm.tsx`
- [ ] `post_liked` — `app/profile/page.tsx`
- [ ] `message_sent` — `app/messages/page.tsx`
- [ ] `group_created` — `app/messages/page.tsx`

### Verification

- [ ] Confirm events appear in Vercel Analytics dashboard within 24 hours of first traffic
