# ADR-002: Introduce Auth Provider Abstraction (Supabase and Local JWT)

- Status: Proposed
- Date: 2026-02-18
- Owners: Backend Team
- Decision Type: Architecture / Auth

## Context

Current auth behavior is tightly coupled to Supabase in key flows:

- Frontend sign-in/sign-up/session management uses Supabase Auth.
- Backend `get_current_user` validates Supabase tokens and resolves user data via Supabase.

In parallel, we are proposing SQLAlchemy-only persistence for backend data operations (ADR-001). To enable a safe transition and optional long-term provider flexibility, auth should not be hardwired to one provider implementation.

## Problem Statement

We need a way to support both:

- existing Supabase auth flows (for compatibility), and
- local JWT auth flows (for local-db-first and potential provider independence),

without rewriting route authorization logic each time.

## Decision Drivers

- Minimize migration risk and avoid hard cutovers.
- Keep route and service layers provider-agnostic.
- Enable staged rollout and rollback.
- Preserve production stability while local-only architecture evolves.

## Decision

Adopt an auth-provider abstraction in backend with pluggable implementations.

1. Define a provider interface used by auth dependencies.
2. Implement `SupabaseAuthProvider`.
3. Implement `LocalJwtAuthProvider`.
4. Select provider by configuration (`AUTH_PROVIDER`).
5. Add transitional dual-provider mode (`AUTH_PROVIDER=hybrid`) to accept both token types during migration.

## Scope

In scope:

- Backend auth dependency flow (`get_current_user`, optional auth dependency).
- Provider interface and implementations.
- Token validation and identity normalization.
- Config-driven provider selection.

Out of scope (initially):

- Full frontend auth provider migration.
- Replacing frontend Supabase SDK immediately.

## Target Architecture

```text
Route -> auth dependency -> AuthProvider interface -> provider impl
                                            |-> SupabaseAuthProvider
                                            |-> LocalJwtAuthProvider
```

## Interface Contract

Suggested interface:

- `authenticate_token(token: str) -> AuthIdentity | None`
- `get_user(identity: AuthIdentity) -> UserContext`
- `register(...)` (optional if backend owns registration)
- `login(...)` (optional if backend owns login)

Normalized identity:

- `user_id: int | str`
- `email: str`
- `roles: list[str]`
- `provider: Literal["supabase", "local"]`
- `claims: dict`

## Configuration

Add:

- `AUTH_PROVIDER=local|supabase|hybrid`
- `AUTH_HYBRID_ORDER=local_first|supabase_first` (optional)

Behavior:

- `local`: only local JWT accepted.
- `supabase`: only Supabase tokens accepted.
- `hybrid`: accept both; use configured precedence.

## Migration Plan

1. Add abstraction and Supabase provider first (no behavior change).
2. Add Local JWT provider and tests.
3. Enable `hybrid` in non-prod; validate both token paths.
4. Update backend auth endpoints to issue local JWTs (if chosen).
5. Migrate frontend to local JWT over time.
6. Switch prod to `local` once Supabase token usage reaches zero.
7. Remove Supabase provider if no longer needed.

## Risks

1. Confusion in hybrid mode if token precedence is unclear.
2. Inconsistent identity mapping between providers.
3. Security regressions in token parsing/validation.
4. Operational complexity during transition period.

## Mitigations

- Define strict precedence and document it.
- Normalize identity contract and enforce with tests.
- Add contract tests for protected routes per provider mode.
- Add auth metrics/logging by provider path.
- Time-box hybrid mode and define exit criteria.

## Validation and Success Criteria

- Protected routes authenticate correctly in `supabase`, `local`, and `hybrid` modes.
- Route code no longer directly depends on Supabase auth client.
- Identity object consumed by routes/services is provider-agnostic.
- Frontend migration can be performed independently without backend rewrites.

## Rollback Strategy

- Switch `AUTH_PROVIDER` back to `supabase`.
- Keep provider abstraction in place; rollback is configuration-first.
- Revert local JWT issuance only if needed, without route-level changes.

## Consequences

Positive:

- Decouples authorization checks from provider implementation.
- Enables controlled migration with low blast radius.
- Improves long-term flexibility for auth strategy.

Negative:

- Adds short-term abstraction complexity.
- Requires careful test coverage for multiple modes.

## Open Questions

- Final location for refresh-token/session lifecycle ownership.
- Whether backend or frontend should own registration flow long-term.
- Timeline and criteria to sunset Supabase provider.

## Cross-Reference

- Related ADR: `docs/adr/ADR-003-schema-governance-and-drift-remediation.md`
- Related ADR: `docs/adr/ADR-004-api-error-contract-and-minimal-observability.md`
