# ADR-001: Migrate Backend Persistence to SQLAlchemy-Only Data Access Layer

- Status: Proposed
- Date: 2026-02-18
- Owners: Backend Team
- Decision Type: Architecture / Refactor

## Context

The current backend mixes two persistence paths:

- Supabase client calls (`get_supabase()`) in most route modules.
- SQLAlchemy session (`get_db()`) in selected auth endpoints.

This creates a hybrid architecture where:

- domain logic is coupled to transport/storage details in route handlers,
- auth and non-auth data paths are inconsistent,
- local development behavior differs by endpoint,
- test setup is harder because routes require Supabase for most behaviors.

## Problem Statement

We need a single, consistent persistence architecture that supports complete local database use and simplifies testing and maintenance.

## Decision Drivers

- Consistency of data access patterns across all endpoints.
- Ability to run app and tests locally without external Supabase dependency.
- Clear separation of concerns: API layer vs domain logic vs persistence.
- Easier contract/integration testing with deterministic local Postgres state.
- Reduced operational ambiguity in local and CI environments.

## Decision

Adopt a SQLAlchemy-only persistence model for backend runtime operations.

1. Route handlers will no longer call `get_supabase()` directly.
2. Route handlers will no longer issue raw SQLAlchemy queries directly via `get_db()`.
3. Route handlers will depend on service layer interfaces.
4. Services will depend on repository/data-access interfaces backed by SQLAlchemy sessions.
5. Supabase client usage will be removed from request-time backend data operations.

## Scope

In scope:

- `backend/api/*` route modules
- service and repository/data-access layers
- auth current-user resolution path
- local/CI environment and testing support

Out of scope (initially):

- frontend auth provider migration details
- non-runtime operational scripts unless required by migration

## Architecture Changes Required

### Current

```text
Route -> get_supabase() OR get_db() -> database
```

### Target

```text
Route -> Service -> Repository (SQLAlchemy) -> Postgres
```

### Required Refactor Elements

- Add repository modules per domain (users, events, buddies, messages, groups, posts, sports, goals, waitlist).
- Move persistence logic from routes into repositories.
- Move business rules from routes into services.
- Standardize dependency wiring in FastAPI for service injection.
- Replace Supabase-based `get_current_user` behavior with local JWT + SQLAlchemy user resolution.

## Considered Alternatives

1. Keep hybrid model (Supabase + SQLAlchemy)
- Rejected: continues inconsistency and complexity.

2. Full Supabase-only backend data access
- Rejected: does not satisfy local-db-only objective and test determinism goals.

3. SQLAlchemy-only with service/repository layering (chosen)
- Accepted: highest consistency and testability.

## Risks

1. Behavioral regressions during endpoint rewrites.
2. Auth migration errors (token validation/current-user resolution).
3. Schema drift between model assumptions and live DB.
4. Temporary slowdown while dual paths are being removed.

## Mitigations

- Migrate in phases by domain, not all-at-once.
- Add contract tests for each migrated endpoint before and after migration.
- Use feature flags or route-level cutover checkpoints where needed.
- Validate migration order with staging/local verification checklist.

## Migration Plan

1. Introduce service/repository scaffolding and patterns.
2. Migrate auth dependency path (`get_current_user`) to SQLAlchemy-backed user lookup.
3. Migrate domains incrementally:
   - users -> events -> buddies/messages/groups -> posts -> sports/goals/waitlist
4. Remove direct `get_supabase()` calls from route modules.
5. Remove Supabase runtime dependency from backend config once unused.
6. Finalize tests and CI for SQLAlchemy-only path.

## Rollback Strategy

- Domain-by-domain rollback by reverting specific migrated modules.
- Preserve endpoint contracts while changing internals.
- Keep migrations idempotent and schema-compatible during transition.

## Validation and Success Criteria

- All backend runtime endpoints execute without `get_supabase()`.
- All route modules use service dependencies rather than raw persistence calls.
- Auth + app flows run locally against local Postgres only.
- Contract tests pass for critical endpoints.
- Day 5 test strategy baseline is operational in CI.

## Consequences

Positive:

- Consistent architecture and clearer ownership boundaries.
- Better local developer experience.
- Stronger testability and easier debugging.

Negative:

- Medium-sized refactor touching many endpoints.
- Short-term risk and coordination overhead.

## Open Questions

- Final backend JWT/session strategy details.
- Whether any Supabase feature (outside persistence) remains required.
- Exact timeline for frontend auth alignment, if needed.

## Cross-Reference

- Related ADR: `docs/adr/ADR-002-auth-provider-abstraction.md`
- Related ADR: `docs/adr/ADR-003-schema-governance-and-drift-remediation.md`
- Related ADR: `docs/adr/ADR-004-api-error-contract-and-minimal-observability.md`
- Relationship: ADR-001 defines persistence-layer direction (SQLAlchemy-only data access). ADR-002 defines authentication provider decoupling and transition strategy.
- Recommended sequencing: implement provider abstraction from ADR-002 early to reduce migration risk while executing ADR-001 domain-by-domain.
