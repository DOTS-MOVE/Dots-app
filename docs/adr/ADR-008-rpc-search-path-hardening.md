# ADR-008: Harden Supabase RPC functions with explicit search_path

## Status
Proposed

## Date
2026-03-16

## Context
After ADR-007 introduced RPC-based endpoint optimizations for `/me`, `/buddies`, and `/messages/conversations`, one of the production concerns surfaced from Supabase analysis: RPCs can be created without an explicit `search_path`.

In PostgreSQL, `search_path` controls how unqualified identifiers are resolved. A function without an explicit setting may resolve names differently across environments or roles.

## Problem
- `public.list_conversations_for_user` (and potentially other endpoint RPCs) was defined without `SET search_path`.
- Unqualified table/function/type references inside a function can resolve unpredictably if `search_path` changes.
- This can cause:
  - Non-deterministic behavior between environments.
  - Accidental shadowing of objects through schema order.
  - Increased operational fragility under role/session variation.
  - A subtle security risk from name resolution attacks in shared environments.

## Decision
Adopt a hardening rule for all new/modified RPC functions:
1. Explicitly pin function schema resolution at creation time.
2. Prefer schema-qualified object references inside the function body.

## Implementation
1. Update RPC definitions to include explicit search path, for example:
   - `SET search_path = public, pg_temp`
2. Audit existing RPC functions used by backend endpoints and qualify unqualified references where practical.
3. For functions that need changed privileges, evaluate `SECURITY DEFINER` only with careful ownership and grants.

## Migration requirements
1. Add a dedicated Alembic migration for this hardening step.
2. The migration must include both:
   - `upgrade()` that applies explicit `SET search_path` and object-qualification updates.
   - `downgrade()` that restores the previous function definitions exactly.
3. Store and use the pre-change function definitions from:
   - `backend/get_user_profile_bundle_def.sql`
   - `backend/list_buddies_for_user_def.sql`
   - `backend/conversations_def.sql`
4. Validate rollback in staging before production:
   - apply migration,
   - run endpoint RPC smoke tests,
   - run `alembic downgrade -1`,
   - verify restored function definitions using `pg_get_functiondef`,
   - re-apply migration and verify stability again.

## Expected outcome
- Deterministic function behavior regardless of caller session search path.
- Reduced risk of accidental resolution to non-intended objects.
- Better portability across local, staging, and production environments.
- Clearer operations posture for future migrations and audits.

## Consequences
- Slightly stricter SQL function contract and review overhead.
- Lower risk of future regressions from schema churn.

## Acceptance criteria
1. `alembic upgrade head` succeeds.
2. `alembic downgrade -1` succeeds without residual errors.
3. `pg_get_functiondef` output for each function is preserved after downgrade compared to snapshot files.
4. Endpoint behavior remains correct after upgrade and rollback via smoke tests:
   - `/users/me` via `get_user_profile_bundle`
   - `/buddies` via `list_buddies_for_user`
   - `/messages/conversations` via `list_conversations_for_user`

## Relation to ADR-007
- ADR-007 introduced endpoint-level RPC optimization in Supabase for latency reasons.
- ADR-008 ensures those RPCs remain safe and deterministic in production operations.
