# Day 2 ERD and Migration Notes

Use this file to capture the relational model and schema evolution.

## 1) ERD (Text Draft)

Start with a text graph before creating a visual ERD.

```text
users
  1 -> many events (events.host_id)
  many <-> many sports (user_sports)
  many <-> many goals (user_goals)
  many <-> many events (event_rsvps) + status/attended metadata
  1 -> many buddies (as user1_id)
  1 -> many buddies (as user2_id)
  1 -> many messages (sender_id)
  1 -> many messages (receiver_id)
  many <-> many group_chats (group_members) + is_admin/joined_at
  1 -> many posts
  1 -> many likes
  1 -> 1 subscriptions
  1 -> many user_photos

sports
  1 -> many events
  many <-> many users (user_sports)

goals
  many <-> many users (user_goals)

events
  1 -> many messages (event scoped)
  many <-> many users (event_rsvps)

group_chats
  1 -> many messages (group scoped)
  many <-> many users (group_members)

posts
  1 -> many likes
```

## 2) Table Inventory

| Table | Purpose | Primary Key | Important FKs | Notes |
|---|---|---|---|---|
| `users` | Core user profile/account row. | `id` | n/a | Unique email; discovery/onboarding flags. |
| `events` | Hosted fitness events. | `id` | `sport_id -> sports.id`, `host_id -> users.id` | Public/private control + media fields. |
| `event_rsvps` | Event participant join table + state. | (`event_id`, `user_id`) | `event_id -> events.id`, `user_id -> users.id` | Includes `status`, `attended`, `rsvp_at`. |
| `buddies` | User-user buddy relationship. | `id` | `user1_id -> users.id`, `user2_id -> users.id` | Status-based relationship lifecycle. |
| `messages` | Direct/event/group messages. | `id` | `sender_id`, `receiver_id`, `event_id`, `group_id` | Polymorphic conversation context via nullable FKs. |
| `group_chats` | Group conversation container. | `id` | `created_by_id -> users.id` | Group metadata and owner. |
| `group_members` | Group membership join table. | (`group_id`, `user_id`) | `group_id -> group_chats.id`, `user_id -> users.id` | Includes `is_admin`, `joined_at`. |
| `posts` | Social feed content. | `id` | `user_id -> users.id` | Supports optional image. |
| `likes` | Post reaction join-like table. | `id` | `post_id -> posts.id`, `user_id -> users.id` | Unique (`post_id`, `user_id`). |
| `sports` | Sport taxonomy lookup. | `id` | n/a | Used by events + user preferences. |
| `goals` | Goal taxonomy lookup. | `id` | n/a | Used by user goals join table. |
| `subscriptions` | User plan/tier record. | `id` | `user_id -> users.id` | One row per user (unique user_id). |
| `user_photos` | Profile gallery rows. | `id` | `user_id -> users.id` | Ordered by `display_order`. |
| `waitlist_entries` | Pre-signup leads. | `id` | n/a | Standalone intake table. |

## 3) Cardinality and Constraints

Document key constraints and expected invariants.

| Relationship | Cardinality | Constraint | Behavior Impact |
|---|---|---|---|
| User -> hosted events | 1:N | `events.host_id` FK not null | Each event has exactly one host user. |
| User <-> event RSVPs | M:N | Composite PK (`event_id`, `user_id`) | Prevents duplicate RSVP rows per user/event pair. |
| User <-> buddies | Directed self M:N via two 1:N edges | Two user FKs (`user1_id`, `user2_id`) | Relationship direction + status must be handled in code. |
| Group chat <-> members | M:N | Composite PK (`group_id`, `user_id`) | Membership uniqueness and admin flag per membership row. |

## 4) Migration Timeline

List migrations in order and summarize what changed.

| Migration File | Approx Order | Change Summary | Backward Compatibility Risk |
|---|---|---|---|
| `backend/alembic/versions/3cf5c47f0f38_initial_migration.py` | 1 (initial) | Creates core tables (`users`, `sports`, `goals`, `events`, `subscriptions`, `user_sports`, `user_goals`, `event_rsvps`, `messages`) and `matches`. | Medium: uses `matches` table name not aligned with current `buddies` model/API. |
| `backend/alembic/versions/add_event_admin_features.py` | later | Adds `events.is_public`, `events.cover_image_url`, and `event_rsvps.status`. | Low-Medium: status default/type differences may vary across environments. |
| `backend/alembic/versions/add_profile_onboarding.py` | later | Adds `users.is_discoverable`, `users.profile_completed`, and `user_photos` table. | Low: additive, but required for onboarding/profile UX. |
| `backend/alembic/versions/80bc45e7151c_add_group_chats.py` | later | Adds `group_chats`, `group_members`, and `messages.group_id` FK. | Medium: impacts messaging query assumptions. |
| `backend/alembic/versions/add_posts_and_likes.py` | later | Adds social feed tables `posts` and `likes` with unique like index. | Low: additive, but contract-sensitive for feed endpoints. |

## 5) Schema Drift Checks

- [ ] Models align with Alembic migrations.
  - Drift found: model/API use `buddies`, initial Alembic migration defines `matches`.
- [ ] Models align with runtime DB state.
  - Requires verification against actual local/prod DB schema.
- [x] `supabase_schema.sql` aligns with active app behavior.
  - `supabase_schema.sql` defines `buddies`, `event_rsvps.status`, group chat tables, and other tables used in routes.
- [ ] Enum values and constraints match API assumptions.
  - Needs runtime validation for enum storage and route update semantics.

## 6) ERD Deliverable

Link or embed your final ERD artifact.

- Diagram file path: `docs/onboarding/day2-erd.md` (text ERD draft complete; visual ERD pending)
- Tool used: Text draft from model/migration/source analysis
- Last updated: 2026-02-18

## 7) Open Questions

- [ ] Is `matches -> buddies` fully migrated in every live environment?
- [ ] Are all FK constraints in Supabase identical to local Alembic-managed schema?
- [ ] Should Alembic be treated as source of truth, or is `supabase_schema.sql` currently canonical?
