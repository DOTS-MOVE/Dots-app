# Day 3 API Catalog

Capture the full API surface and contract expectations.

## 1) API Overview

- Base URL (local): `http://localhost:8000`
- Auth model (Bearer token source): Supabase session access token from frontend (`frontend/lib/api.ts`), validated in backend via `get_current_user` (`backend/api/auth.py`).
- Docs URL: `http://localhost:8000/docs`
- Global error pattern:
  - Primary: FastAPI `HTTPException` with `{ "detail": "..." }`.
  - Inconsistency: some list endpoints swallow backend errors and return empty arrays instead of 5xx.
  - Auth pattern: 401 for missing/invalid tokens in most protected routes.

## 2) Endpoint Inventory

Fill one row per endpoint.

| Method | Path | Router File | Auth Required | Request Model | Response Model | Key Status Codes | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| POST | `/auth/register` | `backend/api/auth.py` | No | `UserRegister` | `Token` | `201`, `400` | Uses SQLAlchemy `get_db` path. |
| POST | `/auth/login` | `backend/api/auth.py` | No | `OAuth2PasswordRequestForm` | `Token` | `200`, `401`, `400` | Uses SQLAlchemy `get_db` path. |
| GET | `/users/me` | `backend/api/users.py` | Yes | None | `UserProfile` | `200`, `400`, `500` | Reads user + photos/sports/goals via Supabase joins. |
| GET | `/users/search` | `backend/api/users.py` | No | Query: `q`, `limit` | `List[UserProfile]` | `200`, `500` | In-Python filtering; no DB-side OR query. |
| GET | `/users/{user_id}` | `backend/api/users.py` | No | Path: `user_id` | `UserProfile` | `200`, `404`, `500` | Public profile lookup. |
| PUT | `/users/me` | `backend/api/users.py` | Yes | `UserUpdate` | `UserProfile` | `200`, `400`, `500` | Replaces user_sports/user_goals on update. |
| POST | `/users/me/photos` | `backend/api/users.py` | Yes | `UserPhotoCreate` | `UserPhotoResponse` | `201`, `400`, `500` | Max 4 photos enforced. |
| DELETE | `/users/me/photos/{photo_id}` | `backend/api/users.py` | Yes | Path: `photo_id` | None | `204`, `404`, `500` | Ownership enforced by user_id + photo_id filter. |
| POST | `/users/me/complete-profile` | `backend/api/users.py` | Yes | `CompleteProfileRequest` | `UserProfile` | `200`, `400`, `500` | Requires current user full_name + age. |
| POST | `/events` | `backend/api/events.py` | Yes | `EventCreate` | `EventResponse` | `201`, `400`, `404`, `500` | Host auto-RSVP insert attempted. |
| GET | `/events` | `backend/api/events.py` | No | Query: `sport_id`, `location`, `start_date`, `end_date`, `search` | `List[EventResponse]` | `200`, `500` | Search partly done in Python; current implementation may return `200 []` on backend query failures. |
| GET | `/events/{event_id}` | `backend/api/events.py` | Optional | Path: `event_id` | `EventDetail` | `200`, `404`, `500` | Uses optional auth to include caller RSVP status. |
| PUT | `/events/{event_id}` | `backend/api/events.py` | Yes | `EventUpdate` | `EventResponse` | `200`, `400`, `403`, `404`, `500` | Host-only updates. |
| DELETE | `/events/{event_id}` | `backend/api/events.py` | Yes | Path: `event_id` | None | `204`, `403`, `404`, `500` | Host-only delete. |
| POST | `/events/{event_id}/rsvp` | `backend/api/events.py` | Yes | Path: `event_id` | `EventDetail` | `200`, `400`, `404`, `500` | Creates pending RSVP in current implementation. |
| DELETE | `/events/{event_id}/rsvp` | `backend/api/events.py` | Yes | Path: `event_id` | None | `204`, `400`, `500` | Deletes caller RSVP row. |
| GET | `/events/user/me` | `backend/api/events.py` | Yes | None | `dict` | `200`, `400`, `500` | Returns owned/attending/attended buckets. |
| GET | `/events/{event_id}/rsvps` | `backend/api/events.py` | Yes | Path: `event_id` | `dict` | `200`, `403`, `404`, `500` | Host-only RSVP administration view. |
| POST | `/events/{event_id}/rsvps/{user_id}/approve` | `backend/api/events.py` | Yes | Path: `event_id`, `user_id` | None | `204`, `400`, `403`, `404`, `500` | Host-only status transition. |
| POST | `/events/{event_id}/rsvps/{user_id}/reject` | `backend/api/events.py` | Yes | Path: `event_id`, `user_id` | None | `204`, `403`, `404`, `500` | Host-only status transition. |
| DELETE | `/events/{event_id}/rsvps/{user_id}` | `backend/api/events.py` | Yes | Path: `event_id`, `user_id` | None | `204`, `403`, `404`, `500` | Host-only participant removal. |
| GET | `/buddies/suggested` | `backend/api/buddies.py` | Yes | Query: `limit`, `min_score`, `offset` | `List[dict]` | `200`, `400`, `403`, `500` | Requires `is_discoverable=true`. |
| POST | `/buddies` | `backend/api/buddies.py` | Yes | `BuddyRequest` | `BuddyResponse` | `201`, `400`, `404`, `500` | Prevents self/duplicate buddy requests. |
| GET | `/buddies` | `backend/api/buddies.py` | Yes | Query: `status` | `List[BuddyDetail]` | `200`, `400`, `500` | Returns both directions user1/user2. |
| DELETE | `/buddies/{buddy_id}` | `backend/api/buddies.py` | Yes | Path: `buddy_id` | None | `204`, `403`, `404`, `500` | Only participant can delete. |
| PUT | `/buddies/{buddy_id}` | `backend/api/buddies.py` | Yes | `BuddyUpdate` | `BuddyResponse` | `200`, `403`, `404`, `500` | Only receiver (`user2`) can update status. |
| POST | `/messages` | `backend/api/messages.py` | Yes | `MessageCreate` | `MessageResponse` | `201`, `400`, `403`, `404`, `500` | Supports direct/event/group message contexts. |
| GET | `/messages/conversations` | `backend/api/messages.py` | Yes | None | `List[dict]` | `200`, `400`, `500` | Aggregates user/event/group conversations. |
| POST | `/messages/conversations/{conversation_id}/mark-read` | `backend/api/messages.py` | Yes | Query: `conversation_type` | None | `204`, `400`, `500` | Marks messages read; failures may be swallowed. |
| GET | `/messages/conversations/{conversation_id}` | `backend/api/messages.py` | Yes | Query: `conversation_type` | `List[MessageDetail]` | `200`, `400`, `403`, `500` | Group conversation checks membership. |
| WS | `/messages/ws/{token}` | `backend/api/messages.py` | Yes | Path: token | WebSocket stream | Close `1008` on auth errors | Token checked against Supabase auth user endpoint. |
| POST | `/groups` | `backend/api/groups.py` | Yes | `GroupChatCreate` | `GroupChatResponse` | `201`, `400`, `404`, `500` | Creator auto-added as admin member. |
| GET | `/groups` | `backend/api/groups.py` | Yes | None | `List[GroupChatResponse]` | `200`, `400`, `500` | Lists groups caller is a member of. |
| GET | `/groups/{group_id}` | `backend/api/groups.py` | Yes | Path: `group_id` | `GroupChatDetail` | `200`, `403`, `404`, `500` | Member-only visibility. |
| PUT | `/groups/{group_id}` | `backend/api/groups.py` | Yes | `GroupChatUpdate` | `GroupChatResponse` | `200`, `403`, `404`, `500` | Admin-only updates. |
| POST | `/groups/{group_id}/members` | `backend/api/groups.py` | Yes | `dict` (`user_ids`) | `dict` | `200`, `400`, `403`, `404`, `500` | Admin-only add members; partial add behavior. |
| DELETE | `/groups/{group_id}/members/{user_id}` | `backend/api/groups.py` | Yes | Path params | None | `204`, `400`, `403`, `404`, `500` | Admin or self-removal; creator protected. |
| POST | `/groups/{group_id}/leave` | `backend/api/groups.py` | Yes | Path: `group_id` | None | `204`, `400`, `404`, `500` | Creator cannot leave group. |
| POST | `/posts` | `backend/api/posts.py` | Yes | `PostCreate` | `PostResponse` | `201`, `400`, `500` | Includes hydrated `user`, like_count, is_liked. |
| GET | `/posts` | `backend/api/posts.py` | Optional | Query: `user_id`, `limit`, `offset` | `List[PostResponse]` | `200`, `500` | Current implementation may return `200 []` on backend query failures. |
| GET | `/posts/{post_id}` | `backend/api/posts.py` | Optional | Path: `post_id` | `PostResponse` | `200`, `404`, `500` | Optional auth only affects `is_liked`. |
| DELETE | `/posts/{post_id}` | `backend/api/posts.py` | Yes | Path: `post_id` | None | `204`, `403`, `404`, `500` | Owner-only delete. |
| POST | `/posts/{post_id}/like` | `backend/api/posts.py` | Yes | Path: `post_id` | `PostResponse` | `200`, `404`, `500` | Toggle-like semantics. |
| GET | `/sports` | `backend/api/sports.py` | No | None | `List[dict]` | `200`, `500` | 5-minute in-memory cache; stale-on-error behavior. |
| GET | `/goals` | `backend/api/goals.py` | No | None | `List[dict]` | `200`, `500` | Simple lookup endpoint. |
| POST | `/waitlist` | `backend/api/waitlist.py` | No | `WaitlistEntryCreate` | `WaitlistEntryResponse` | `201`, `400`, `500` | Duplicate email mapped to 400. |

## 3) Route Ownership Map

Group endpoints by file/module.

### `backend/api/auth.py`

- `POST /auth/register`
- `POST /auth/login`
- Dependencies exported for other routers: `get_current_user`, `get_current_user_optional`

### `backend/api/users.py`

- `GET /users/me`
- `GET /users/search`
- `GET /users/{user_id}`
- `PUT /users/me`
- `POST /users/me/photos`
- `DELETE /users/me/photos/{photo_id}`
- `POST /users/me/complete-profile`

### `backend/api/events.py`

- `POST /events`
- `GET /events`
- `GET /events/{event_id}`
- `PUT /events/{event_id}`
- `DELETE /events/{event_id}`
- `POST /events/{event_id}/rsvp`
- `DELETE /events/{event_id}/rsvp`
- `GET /events/user/me`
- `GET /events/{event_id}/rsvps`
- `POST /events/{event_id}/rsvps/{user_id}/approve`
- `POST /events/{event_id}/rsvps/{user_id}/reject`
- `DELETE /events/{event_id}/rsvps/{user_id}`

### `backend/api/buddies.py`

- `GET /buddies/suggested`
- `POST /buddies`
- `GET /buddies`
- `DELETE /buddies/{buddy_id}`
- `PUT /buddies/{buddy_id}`

### `backend/api/messages.py`

- `WS /messages/ws/{token}`
- `POST /messages`
- `GET /messages/conversations`
- `POST /messages/conversations/{conversation_id}/mark-read`
- `GET /messages/conversations/{conversation_id}`

### `backend/api/groups.py`

- `POST /groups`
- `GET /groups`
- `GET /groups/{group_id}`
- `PUT /groups/{group_id}`
- `POST /groups/{group_id}/members`
- `DELETE /groups/{group_id}/members/{user_id}`
- `POST /groups/{group_id}/leave`

### `backend/api/posts.py`

- `POST /posts`
- `GET /posts`
- `GET /posts/{post_id}`
- `DELETE /posts/{post_id}`
- `POST /posts/{post_id}/like`

### `backend/api/sports.py`

- `GET /sports`

### `backend/api/goals.py`

- `GET /goals`

### `backend/api/waitlist.py`

- `POST /waitlist`

## 4) Frontend Callers

Map frontend API client methods/pages to backend paths.

| Frontend Caller | Backend Endpoint(s) | Contract Assumptions | Risk Level |
| --- | --- | --- | --- |
| `frontend/lib/api.ts` | Most REST endpoints above (`/users`, `/events`, `/buddies`, `/messages`, `/groups`, `/posts`, `/sports`, `/goals`, `/waitlist`) | Bearer token is always from Supabase session; `detail` error shape often expected; some methods treat failures as empty arrays. | High |
| `frontend/lib/auth.tsx` | Indirectly `/users/me` via API client after Supabase login/session state changes | Backend token acceptance must remain compatible with Supabase access token format. | High |
| `frontend/app/events/page.tsx` | Primarily `/events`, plus `/sports` | Event list and sport enrichment fields must be present and stable. | Medium |
| `frontend/app/events/[id]/page.tsx` | `/events/{id}`, RSVP/admin RSVP endpoints | Expects consistent RSVP lifecycle and permissions responses. | High |
| `frontend/app/profile/page.tsx` | `/users/me`, `/users/me/photos`, `/users/me/complete-profile`, `/events/user/me`, `/posts` | Expects nullable-safe profile fields and complete-profile side effects. | High |

## 5) Error Contract Notes

Record common error payload shapes and inconsistencies.

| Endpoint | Expected Error Shape | Actual Error Shape | Consistent? | Notes |
| --- | --- | --- | --- | --- |
| Protected routes (general) | `{"detail": "..."} + 401/403` | Mostly aligned via `HTTPException` | Partial | Good baseline, but auth backend is hybrid (Supabase validate + SQLAlchemy register/login). |
| `GET /posts` | 5xx on backend query failure | Returns `[]` on some failures | No | Can mask outages and make debugging harder. |
| `GET /events` | 5xx on backend query failure | Often returns `[]` for fetch/query errors | No | Same masking issue as posts. |
| `GET /users/search` | Proper DB query errors | Fetches broad set then Python-filters | Partial | Results may vary with row volume and query limits. |
| `POST /groups/{id}/members` | Strict typed body contract | Uses raw `dict` expecting `user_ids` | No | Weak contract typing; less schema-level validation. |

## 6) High-Priority Contract Tests to Add

- [ ] Auth required routes reject missing tokens with expected status/body.
- [ ] Event list returns stable response shape.
- [ ] User profile endpoints maintain field compatibility with frontend types.
- [ ] RSVP endpoints enforce state transitions correctly.

## 7) Open Questions

- [ ] Should endpoints that currently return `[]` on DB failure move to explicit 5xx contracts?
- [ ] Do we standardize request bodies for raw `dict` endpoints (`groups/{id}/members`) into Pydantic schemas?
- [ ] Should auth token handling be formalized before API contract hardening (given ADR-002 hybrid-provider proposal)?
