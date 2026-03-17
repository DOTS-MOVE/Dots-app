# Day 4 Frontend-API Map

Map each major UI surface to its backend calls and data contracts.

## 1) Screen to Endpoint Mapping

| Screen/Page | File | User Action | Frontend Caller | Backend Endpoint | Auth Required | Notes |
|---|---|---|---|---|---|---|
| Home | `frontend/app/page.tsx` | Load feed, search people/events | `useEvents`, `useSports`, direct fetch for people search | `GET /events`, `GET /sports`, `GET /users/search` | Mixed | People search optionally sends bearer token; events/sports are public. |
| Login | `frontend/app/login/page.tsx` | Sign in | `useAuth().login` | Supabase Auth + `GET /users/me` (post-login profile hydrate) | Yes (for `/users/me`) | Primary login path is Supabase, not backend `/auth/login`. |
| Register | `frontend/app/register/page.tsx` | Sign up | `useAuth().register` | Supabase Auth | No | Email confirmation flow via `/auth/callback`. |
| Profile | `frontend/app/profile/page.tsx` | View/edit profile, upload photos, posts, events | `api.getUser`, `api.updateUser`, `api.addUserPhoto`, `api.deleteUserPhoto`, `api.getPosts`, `api.getMyEvents`, `api.createBuddy` | `/users/*`, `/posts`, `/events/user/me`, `/buddies` | Mixed | Own profile uses protected endpoints; viewing other user profile uses public `/users/{id}` and `/posts`. |
| Buddies | `frontend/app/buddies/page.tsx` | Discover, request, accept/reject, remove | `api.getSuggestedBuddies`, `api.createBuddy`, `api.updateBuddy`, `api.deleteBuddy` | `/buddies/suggested`, `/buddies`, `/buddies/{id}` | Yes | Discovery flow depends on `is_discoverable`. |
| Events | `frontend/app/events/page.tsx` | Browse/search/filter events | `useEvents`, `useSports` | `GET /events`, `GET /sports` | No | Client-side filtering applied on top of API results. |
| Event Detail | `frontend/app/events/[id]/page.tsx` | View event, RSVP/cancel RSVP | `api.getEvent`, `api.rsvpEvent`, `api.cancelRsvp` | `/events/{id}`, `/events/{id}/rsvp` | Mixed | Event read supports optional auth; RSVP requires auth. |
| Create Event | `frontend/app/events/create/page.tsx` | Create event | `api.getSports`, `api.createEvent` | `GET /sports`, `POST /events` | Yes (create) | Redirects to login if unauthenticated. |
| Messages | `frontend/app/messages/page.tsx` | List conversations, view conversation, send message, mark read | `api.getConversations`, `api.getConversation`, `api.sendMessage`, `api.markConversationRead` | `/messages/conversations*`, `/messages` | Yes | Supports `user`, `event`, `group` conversation types. |

## 2) API Client Method Map

| API Client Method (`frontend/lib/api.ts`) | Endpoint | Response Type | Callers | Error Handling Path |
|---|---|---|---|---|
| `getCurrentUser` | `GET /users/me` | `User` | Auth bootstrap, profile, navbar | Throws on auth/network errors; caller may fallback to mapped Supabase user. |
| `getEvents` | `GET /events` | `Event[]` | Home, Events list, hooks | Returns `[]` on timeout/fetch failures in current implementation. |
| `getEvent` | `GET /events/{id}` | `Event` | Event detail page | Throws detailed errors for non-OK responses. |
| `createEvent` | `POST /events` | `Event` | Create event page | Throws with parsed backend `detail`. |
| `rsvpEvent` / `cancelRsvp` | `POST/DELETE /events/{id}/rsvp` | `Event` / `void` | Event detail page | Converts auth/network failures to actionable messages. |
| `getSuggestedBuddies` | `GET /buddies/suggested` | `any[]` | Buddies page | Returns `[]` on many transport/server errors. |
| `getBuddies` | `GET /buddies` | `Buddy[]` | Profile, Buddies tab | Returns `[]` on timeout/network/5xx-like conditions. |
| `createBuddy` | `POST /buddies` (+ optional `POST /messages`) | `Buddy` | Buddies page, profile connect flow | Creates buddy then best-effort initial message send. |
| `getConversations` | `GET /messages/conversations` | `Conversation[]` | Messages page, navbar unread | Handles parse/fetch errors; may fallback to empty set at caller layer. |
| `getConversation` | `GET /messages/conversations/{id}` | `Message[]` | Messages page | Throws on non-OK unless handled by SWR caller. |
| `sendMessage` | `POST /messages` | `Message` | Messages page | Throws with backend `detail` on validation/auth errors. |
| `getPosts` / `createPost` / `likePost` / `deletePost` | `/posts*` | `Post[]` / `Post` / `void` | Profile, post components | `getPosts` may return `[]` on failures; mutations throw. |
| `getSports` / `getGoals` | `/sports`, `/goals` | `Sport[]`, `Goal[]` | Home/events/profile onboarding/create event | Timeout-safe fallback patterns in API layer. |
| `addToWaitlist` | `POST /waitlist` | `void` | Waitlist page | Raises backend `detail` message on duplicate email/error. |
| `getMyEvents` | `GET /events/user/me` | `{ owned, attending, attended }` | Profile page | Caller often falls back to empty buckets on failure. |

## 3) Type Contract Alignment

| Frontend Type (`frontend/types/index.ts`) | Backend Schema/Response | Mismatch? | Impact | Fix |
|---|---|---|---|---|
| `User` | `UserProfile` / user dicts from events/messages/posts routes | Partial | Some backend fallback user dicts omit full user fields; UI may rely on nullable handling. | Keep nullable-safe rendering and formalize minimal user summary schema. |
| `Event` | `EventResponse` / `EventDetail` | Partial | Some endpoints return enriched `host/sport/participants`, others summary-only dicts; consumers branch on optional fields. | Keep `Event` optional fields, add explicit summary vs detail type distinction. |
| `Buddy` | `BuddyResponse` / `BuddyDetail` | Partial | Suggested buddies endpoint returns `List[dict]`, not strict `Buddy` shape. | Add typed schema for suggested response; frontend should model separate suggested type. |
| `Message` | `MessageResponse` / `MessageDetail` | Partial | Conversation endpoint enriches nested fields variably; some paths may lack sender/receiver details on failures. | Define stable message detail contract and enforce in API tests. |
| `Post` | `PostResponse` | Mostly aligned | `user` may be null or fallback “Unknown User” object; UI expects optional user. | Preserve optional `user` and document fallback semantics. |

## 4) Data Loading and State Notes

- Fetching patterns observed: SWR hooks (`useEvents`, `useSports`, `useGoals`, `useBuddies`, `useConversations`) are used for shared/cached lists, while detail views (`/profile`, `/events/[id]`, `/messages`) rely on page-level effects with AbortController cleanup.
- Timeouts/retry patterns: many API methods use `Promise.race` with timeout promises, and SWR retries are configured selectively (for example, conversations retries skip auth errors).
- Optimistic updates: optimistic behavior is limited; most flows refetch after mutation (`mutate*` or reload method). Buddy connect performs buddy creation, then sends an optional initial message as best effort.
- Caching behavior: SWR deduping/TTL is used heavily, and `/sports` also has backend in-memory caching.
- Loading skeleton usage: strong skeleton coverage exists across home, events, profile, messages, and buddies pages.

## 5) Priority Risks

- [x] Hybrid auth dependency: frontend token source is Supabase while backend auth and persistence are mixed.
- [x] Silent-failure patterns (`[]` fallbacks) can hide backend outages and degrade UX trust.
- [x] Contract shape variability (`dict` endpoints and enriched/summary variants) increases frontend coupling risk.
