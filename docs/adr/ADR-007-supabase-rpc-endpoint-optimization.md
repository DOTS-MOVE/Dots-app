# ADR-007: Optimize Friends/Family Beta Endpoints with Supabase RPC Functions

## Status
Accepted

## Date
2026-03-16

## Positioning
This ADR is a **temporary beta-focused performance optimization** for the `/me`, `/buddies`, and `/messages/conversations` endpoints.
It is **not** a change in the long-term persistence strategy and remains compatible with the eventual SQLAlchemy-first direction defined in `ADR-001`.

## Context
Telemetry for the DOTS backend (`/me`, `/buddies`, and `/messages/conversations`) showed repeated Supabase calls per request while loading profile, buddy list, and conversations payloads. The service repeatedly executed separate queries against multiple tables (users, sports, goals, posts/events, photos, messages), creating elevated latency and extra DB round-trips.

The observed pattern matched the classic **N+1 query problem**: one top-level query plus additional per-item queries to fetch related data.

## Problem
1. `/me` assembled profile data from users, user_sports, sports, user_goals, and goals in multiple queries.
2. `/buddies` loaded buddy rows and then required additional per-row user lookups and hydration.
3. `/messages/conversations` queried messages/participants and computed derived conversation metadata through separate steps.
4. In production telemetry, these fan-out queries showed up as multiple DB calls per endpoint invocation and contributed to p95 latency.

## 1 + N problem
The **1 + N problem** occurred as:
1. One initial request for the parent list (for example, buddies or users).
2. N follow-up requests to fetch related records for each parent row.
3. N grows with list size, so latency and DB load increase non-linearly across active users and pages.

This became a direct bottleneck for `/me`, `/buddies`, and `/messages/conversations` during the friends-and-family beta.

## Alternatives considered

### 1. Views
- Pros: Centralized query logic for read shaping, simpler than app-side joins.
- Cons: still requires multiple dependent queries for nested payloads and cannot encapsulate all conditional and cross-table aggregation in one reusable API call with strong response shaping.

### 2. Materialized Views
- Pros: fast read for snapshot-style aggregation and reporting-style precomputed data.
- Cons: stale data unless refresh strategy exists; extra operational complexity for freshness and writes with low-latency chat/interaction endpoints.

### 3. RPC Functions
- Pros: single logical call can execute complex SQL with joins/subqueries and return a pre-shaped JSON/relational payload; best match for endpoint-specific projection. Easier to evolve per endpoint.
- Cons: more coupling to DB layer and versioned SQL migration management.

## Decision
We chose **RPC functions**.

Reasons:
1. They replaced multiple endpoint calls with endpoint-specific single query paths.
2. They map directly to the endpoint contract (`/me`, `/buddies`, `/messages/conversations`).
3. They provide better performance for nested payload assembly than table-level REST chains.
4. They avoid staleness concerns while still using transactional source tables.

### Related ADRs
- `docs/adr/ADR-001-sqlalchemy-only-persistence-layer.md` — long-term target architecture; this ADR is a performance implementation that should be revisited during the SQLAlchemy migration.

## Required schema updates
1. New enum and indexes for performance on relevant join/filter columns.
2. New `buddies` and `waitlist_entries` tables/constraints in Alembic for schema consistency with Supabase.
3. New self-reference/consistency constraints (`check_different_users`) for buddy rows.
4. RPC function definitions for endpoint read bundling:
   - `public.get_user_profile_bundle(_user_id integer)`
   - `public.list_buddies_for_user(_user_id integer, _status_filter text default null)`
   - `public.list_conversations_for_user(_user_id integer)`

## Implementation
### Schema and migration work
1. Added performance migration for composite/index support to reduce scan costs.
2. Added migration to create missing tables `buddies` and `waitlist_entries` (initially absent in migrations but present in production Supabase).
3. Added migration for buddy guard constraint (`check_different_users`).
4. Added migration for endpoint-optimized RPC function creation and grants for anonymous/service usage as required.

### Backend refactor
1. `backend/api/users.py`:
   - Replaced `/users/me` multi-call assembly with `get_user_profile_bundle` RPC.
2. `backend/api/buddies.py`:
   - Replaced list endpoint with `list_buddies_for_user` RPC and parameterized status filtering.
3. `backend/api/messages.py`:
   - Replaced conversation listing with `list_conversations_for_user` RPC.

## Consequences
1. Lower endpoint latency and fewer DB round-trips.
2. Reduced Python-side fan-out and hydration logic.
3. Better alignment with Supabase/PostgREST RPC semantics and future endpoint-specific query evolution.
4. Added operational requirement: RPC contract changes now require schema migration management and versioning.

## Verification and rollout
- Migrations were applied successfully to local and production Supabase via Alembic.
- RPC existence and callability were validated through Supabase Functions listing and curl testing.
- Endpoint payload behavior was updated and verified in production before declaration.

## Current status
Completed and deployed to production.

## Future follow-up
1. Consider read-through fallback strategy only if an RPC call fails transiently.
2. Add endpoint contract tests around payload shape for `/me`, `/buddies`, and `/messages/conversations`.
3. Continue telemetry validation on p95/p99 as traffic grows beyond beta.
