# Day 2 Domain Model

Use this document to capture the DOTS object model and business entity behavior.

## 1) Entity Glossary

Document each entity in plain language.

| Entity | Purpose | Primary Keys / IDs | Owned By | Notes |
|---|---|---|---|---|
| `User` | Core actor profile for auth, discovery, and social features. | `users.id` (int), unique `email`. | Application domain root. | Central hub for almost all relationships. |
| `Event` | Fitness meetup/activity posted by a host user. | `events.id`. | Hosted by `User` via `host_id`. | Supports public/private RSVP with status. |
| `Buddy` | User-to-user connection request/match record. | `buddies.id`. | Between two users (`user1_id`, `user2_id`). | Uses status lifecycle (`pending/accepted/rejected`). |
| `Message` | Chat message for DM, event thread, or group chat. | `messages.id`. | Created by `sender_id`. | Context selected by nullable `receiver_id`/`event_id`/`group_id`. |
| `GroupChat` | Multi-user chat space with optional admins. | `group_chats.id`. | Created by `created_by_id` user. | Membership stored in `group_members`. |
| `Post` | Social feed post authored by a user. | `posts.id`. | Owned by `user_id`. | Supports optional `image_url` and likes. |
| `Sport` | Lookup taxonomy for activities and user interests. | `sports.id`. | Reference data. | Connected to users and events. |
| `Goal` | Lookup taxonomy for user fitness goals. | `goals.id`. | Reference data. | Connected to users via join table. |
| `Subscription` | User plan state (free/premium). | `subscriptions.id`; unique `user_id`. | One-to-one with user. | Created on register flow in auth route. |
| `UserPhoto` | Ordered profile gallery photos. | `user_photos.id`. | Owned by `user_id`. | `display_order` controls ordering. |
| `Waitlist` | Pre-signup interest capture. | `waitlist_entries.id`. | Standalone. | Minimal dependencies, intake-only. |

## 2) Critical Fields and Semantics

Capture important behavior tied to specific fields.

| Entity.Field | Meaning | Allowed Values | Validation Rules | Side Effects |
|---|---|---|---|---|
| `users.is_discoverable` | User can appear in buddy suggestions/search. | `true/false`. | Defaults `false`; enabled via profile completion flow. | Drives buddy candidate eligibility. |
| `users.profile_completed` | Onboarding completion marker. | `true/false`. | Defaults `false`; set when onboarding complete endpoint is called. | Gates discovery/readiness semantics in UI. |
| `events.is_public` | Event RSVP policy. | `true/false`. | Defaults `true`. | `false` implies host approval workflow via RSVP status. |
| `event_rsvps.status` | RSVP state machine value. | `pending`, `approved`, `rejected`. | Default `approved`; transitions controlled by event admin endpoints. | Affects participant visibility/capacity and messaging eligibility. |
| `users.role` | Authorization tier marker. | `user`, `premium`, `admin` (model enum). | Default user role. | Currently low explicit enforcement in reviewed routes. |

## 3) Relationship Notes

Write down confirmed relationship behavior from models/migrations.

- User <-> Sport: many-to-many through `user_sports`.
- User <-> Goal: many-to-many through `user_goals`.
- User <-> Event (host): one-to-many (`events.host_id`).
- User <-> Event (participant/rsvp): many-to-many through `event_rsvps` with extra fields (`attended`, `status`, `rsvp_at`).
- User <-> Buddy: self-referencing directed edges via `buddies.user1_id` and `buddies.user2_id`.
- User <-> Message: one-to-many as sender and receiver; messages can also be event/group scoped.
- User <-> GroupChat: many-to-many through `group_members` (`is_admin`, `joined_at`).
- User <-> Post/Like: one-to-many posts; one-to-many likes; post has one-to-many likes with uniqueness on (`post_id`, `user_id`).
- User <-> UserPhoto: one-to-many with cascade delete-orphan at ORM level.

## 4) Lifecycle Rules

Describe create/update/delete lifecycle constraints and expectations.

### User Lifecycle
- Create: hybrid today; `/auth/register` creates SQLAlchemy `User` + `Subscription`, while Supabase auth trigger path can also create users in Supabase schema.
- Update: mostly via Supabase table updates in user routes (`users`, `user_sports`, `user_goals`, `user_photos`).
- Deactivate/Delete: `is_active` soft-state exists; hard delete behavior varies by table FK constraints and route implementation.

### Event Lifecycle
- Create: route inserts event and usually host RSVP row.
- RSVP flow: create/delete RSVP row for public events; pending/approve/reject for private/admin workflows.
- Update: host-only updates in route logic, with participant and pending counts recalculated.
- Cancel/Delete: cancellation uses `is_cancelled`; delete endpoint hard deletes event in Supabase route path.

### Buddy Lifecycle
- Request/create: inserted with `pending` status and calculated `match_score`.
- Accept/reject: status update endpoint transitions request state.
- Remove: delete endpoint removes buddy relationship row.

## 5) Data Ownership and Source of Truth

Clarify where truth lives per concern.

| Concern | Source of Truth | Access Path | Notes |
|---|---|---|---|
| Auth identity | Supabase JWT + SQLAlchemy users (hybrid) | `get_current_user` uses Supabase token verification; `/auth/register`/`/auth/login` use SQLAlchemy `get_db` | Current model is mixed and not fully aligned. |
| User profile | Supabase `users` + related tables | Route-level Supabase table calls in `backend/api/users.py` | SQLAlchemy model exists but is not primary read/write path for most profile APIs. |
| Events | Supabase tables (`events`, `event_rsvps`) | Route-level Supabase in `backend/api/events.py` | Model definitions mirror intended shape, but routes bypass ORM repos. |
| Messaging | Supabase tables (`messages`, `group_*`, `events`) | Route-level Supabase in `backend/api/messages.py` | Highly query-heavy in route handlers. |

## 6) Risks / Ambiguities

- [x] Hybrid persistence model (Supabase + SQLAlchemy) increases mental and operational complexity.
- [x] Auth inconsistency: token validation uses Supabase while register/login use local SQLAlchemy user table.
- [x] Migration/schema drift risk: initial migration creates `matches`, while runtime model/API use `buddies`.

## 7) File References Reviewed

- `backend/models/user.py`
- `backend/models/event.py`
- `backend/models/buddy.py`
- `backend/models/message.py`
- `backend/models/group_chat.py`
- `backend/models/post.py`
- `backend/models/sport.py`
- `backend/models/goal.py`
- `backend/models/subscription.py`
- `backend/models/user_photo.py`
- `backend/models/waitlist.py`
- `backend/schemas/*.py`
- `backend/alembic/versions/*.py`

## 8) End-of-Day Summary

- Confirmed model truths:
  - Entity graph is rich and coherent at SQLAlchemy model level.
  - Runtime route behavior largely bypasses ORM relationships and uses Supabase table operations directly.
  - User is the central aggregate with social, event, and messaging links.
- Assumptions still unverified:
  - Exact production schema state relative to Alembic history across environments.
  - Degree of FK/constraint parity between local Postgres and Supabase.
- Questions to carry into Day 3 API mapping:
  - Which route contracts assume Supabase-specific response shapes?
  - Which endpoints are safest to migrate first to service/repository pattern?
  - Where are auth/identity assumptions encoded in frontend API client behavior?
