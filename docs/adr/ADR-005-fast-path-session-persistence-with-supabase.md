# ADR-005: Fast-Path Session Persistence Using Existing Supabase Auth

- Status: Proposed
- Date: 2026-02-20
- Owners: Backend + Frontend Team
- Decision Type: Authentication / UX Reliability

## Context

DOTS users are being prompted to sign in again after closing and reopening browser tabs/windows, especially in mobile-first usage patterns.

Current implementation already uses Supabase Auth in frontend session management (`frontend/lib/supabase.ts`, `frontend/lib/auth.tsx`) and API token acquisition (`frontend/lib/api.ts`), but app-start session restoration is vulnerable to false unauthenticated states due to timeout/event handling choices.

In parallel, ADR-002 defines a longer-term auth-provider abstraction and migration path to provider-agnostic auth behavior.

## Problem Statement

We need to improve "stay signed in" behavior quickly, with minimal change and low migration risk, while avoiding conflict with ADR-002 long-term architecture.

## Decision Drivers

- Reduce immediate user friction for repeated sign-ins.
- Minimize implementation time and blast radius.
- Avoid introducing parallel auth mechanisms during active architecture transition.
- Preserve a clear path to ADR-002 target state.

## Decision

Adopt a short-term fast path that hardens existing Supabase session restore/refresh behavior, without introducing backend refresh-token cookies yet.

Specifically:

1. Keep Supabase Auth as current source of truth for frontend session persistence.
2. Improve auth bootstrap logic to avoid false signed-out states on slow networks/app start.
3. Handle restored session events (`INITIAL_SESSION`) and perform one refresh/retry path before declaring user unauthenticated.
4. Keep backend token validation behavior unchanged for this phase.

## Scope

In scope:

- `frontend/lib/auth.tsx` auth initialization and auth state event handling.
- `frontend/lib/api.ts` token refresh-and-retry behavior for `401` responses.
- Small UX-safe loading/auth state handling updates needed to prevent premature sign-out redirects.

Out of scope:

- New backend refresh-token endpoints/cookie lifecycle.
- Provider abstraction implementation (`AUTH_PROVIDER=local|supabase|hybrid`) from ADR-002.
- Full migration away from Supabase-managed frontend auth sessions.

## Implementation Plan (Fast Path)

1. Auth bootstrap hardening
- Do not treat single timeout as definitive anonymous state.
- Keep auth loading state until session resolution completes or retry path fails.
- Process `INITIAL_SESSION` consistently with signed-in path.

2. Silent refresh + retry once
- On first authenticated API `401`, trigger Supabase session refresh.
- Retry the failed request exactly once.
- If retry fails, transition to unauthenticated state.

3. Guard rails
- Preserve explicit sign-out behavior.
- Avoid infinite refresh loops.
- Add debug logging around session restore failures (no secrets/tokens in logs).

## Risks

1. Continued architectural mismatch between current backend local JWT issuance and Supabase-validated protected route auth.
2. Reliance on Supabase session behavior remains until ADR-002 migration.
3. If loading/timeout thresholds are too strict, false signed-out states may still occur on weak mobile networks.

## Mitigations

- Treat this ADR as explicitly temporary.
- Add exit criteria and sunset trigger aligned to ADR-002 rollout.
- Add targeted tests around auth bootstrap and 401 retry flow.

## Validation and Success Criteria

- Closing/reopening browser tab/window no longer consistently forces immediate re-login for active users.
- App start does not prematurely redirect authenticated users to login during slow session restore.
- First `401` from expired session recovers via silent refresh + single retry in normal cases.
- No infinite retry loops or auth event thrashing observed.

## Rollback Strategy

- Revert frontend auth bootstrap and retry changes if regressions appear.
- Keep existing Supabase session defaults (`persistSession`, `autoRefreshToken`) unchanged.

## Consequences

Positive:

- Fastest path to improve "stay signed in" UX with low code churn.
- Minimal risk to in-flight ADR-001/ADR-002 architecture work.

Negative:

- Does not resolve long-term provider coupling.
- Defers backend-owned refresh-token security/lifecycle controls.

## Exit Criteria (Sunset This ADR)

This fast path is considered complete and ready to retire when:

1. ADR-002 provider abstraction is implemented and stable in target mode.
2. Backend-owned access+refresh session lifecycle is live (including rotation/revocation policy).
3. Frontend session bootstrap no longer depends on Supabase SDK as the primary auth authority.

## Cross-References

- `docs/adr/ADR-001-sqlalchemy-only-persistence-layer.md`
- `docs/adr/ADR-002-auth-provider-abstraction.md`
- `docs/adr/ADR-003-schema-governance-and-drift-remediation.md`
- `docs/adr/ADR-004-api-error-contract-and-minimal-observability.md`
