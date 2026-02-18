# ADR-004: API Error Contract Hardening for List Endpoints (Phase 1)

- Status: Proposed
- Date: 2026-02-18
- Owners: Backend Team
- Decision Type: API Contract / Observability

## Context

During onboarding review and route inspection, we identified that several list endpoints return `200 []` when operational errors occur (query failures, transport issues, dependency failures).

This behavior is currently confirmed for:

- `GET /events` (`backend/api/events.py`)
- `GET /posts` (`backend/api/posts.py`)

When failures are converted to empty lists, the system loses a clear distinction between:

- legitimate empty result sets, and
- backend operational failures.

This masks incidents, complicates debugging, and creates low-trust UX behavior.

## Problem Statement

We need to stop silent failure masking for the two highest-impact list endpoints while keeping initial change scope small and low risk.

## Decision Drivers

- Faster incident detection and debugging.
- Clear and predictable API contract semantics.
- Minimal blast radius for first rollout.
- Compatibility with existing incremental architecture changes.

## Decision

Phase 1 will harden only two endpoints:

1. `GET /events`
2. `GET /posts`

For these endpoints:

- Operational failures in the primary list query path will return explicit `5xx` (`503` preferred for dependency/query runtime failure).
- Genuine empty datasets will continue to return `200 []`.
- Backend will log operational failures at the failure boundary using `logger.exception(...)` with safe context (route + filter/pagination parameters, no secrets/tokens/PII).

## Scope

In scope:

- `backend/api/events.py` list handler (`GET /events`)
- `backend/api/posts.py` list handler (`GET /posts`)
- Minimal logger wiring in those modules only

Out of scope (Phase 1):

- Full backend-wide exception policy refactor
- Global middleware/error handler redesign
- Frontend-wide error UX redesign
- Route-by-route hardening outside the two target endpoints

## Implementation Approach (Minimal)

1. Add module logger in each target file:
- `import logging`
- `logger = logging.getLogger(__name__)`

2. Replace only the core query swallow blocks:
- Current pattern: `except Exception: ... return []`
- Target pattern:
  - `logger.exception(...)`
  - `raise HTTPException(status_code=503, detail="Service temporarily unavailable")`

3. Leave enrichment/fallback soft-fail branches unchanged for this phase, unless they currently suppress the primary list query failure.

## API Contract Policy (Phase 1)

- `200 []`: valid query executed and returned no rows.
- `5xx`: operational failure prevented valid list retrieval.
- Error body shape remains FastAPI standard:
  - `{"detail": "..."}`

## Observability Policy (Phase 1)

Required in each hardened route failure branch:

- Endpoint name.
- Safe request context (e.g., `sport_id`, `search`, `limit`, `offset`).
- Full exception stack trace via `logger.exception`.

Must not log:

- Access tokens.
- Secrets.
- Sensitive user payloads.

## Risks

1. Behavior change from silent empty states to explicit errors may surface new frontend error states.
2. Some screens currently normalize errors to empty arrays, so UX may still look empty in certain views until frontend updates are completed.
3. Inconsistent behavior across non-migrated endpoints remains temporarily.

## Mitigations

- Restrict Phase 1 scope to two endpoints.
- Keep frontend compatibility path temporarily where needed.
- Add targeted contract tests for both endpoints before broad rollout.

## Validation and Success Criteria

- `GET /events` returns `5xx` on simulated query failure and logs exception context.
- `GET /posts` returns `5xx` on simulated query failure and logs exception context.
- Both endpoints still return `200 []` for true empty datasets.
- Developers can distinguish empty data from outage in logs and API responses.

## Rollout Plan

1. Merge Phase 1 backend changes for events/posts.
2. Verify in local and staging using failure simulation.
3. Decide frontend handling strategy:
- Short-term compatibility: map backend `5xx` to current empty-state behavior in selected clients while logging.
- Preferred: explicit UI error states for list retrieval failures.
4. Start Phase 2 route inventory and prioritize next endpoints.

## Phase 2 (Deferred)

- Extend contract hardening pattern route-by-route.
- Standardize error-code taxonomy beyond `detail`.
- Consider global exception mapping/middleware once endpoint behavior is stabilized.

## Consequences

Positive:

- Clearer backend behavior and better debugging signal for high-traffic lists.
- Reduced chance of silent outage masking in core discovery surfaces.

Negative:

- Temporary inconsistency remains across endpoints not yet migrated.
- Potential short-term frontend mismatch until UI error handling is aligned.

## Open Questions

- Should `500` or `503` be the default for dependency/query runtime failures in this codebase?
- How long should frontend compatibility fallback remain after backend contract hardening?
- Should Phase 2 be policy-driven by endpoint criticality (traffic/UX impact) or by code ownership boundaries?

## Cross-References

- `docs/adr/ADR-001-sqlalchemy-only-persistence-layer.md`
- `docs/adr/ADR-002-auth-provider-abstraction.md`
- `docs/adr/ADR-003-schema-governance-and-drift-remediation.md`
- `docs/onboarding/day3-api-gaps.md`
- `docs/onboarding/day4-contract-risks.md`
