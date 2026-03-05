# ADR-006: RSVP Auto-Approve via Feature Flag for Beta

- Status: Proposed
- Date: 2026-03-04
- Owners: Backend + Frontend Team
- Decision Type: Event RSVP Workflow / Beta Operations

## Context

DOTS event hosts currently need to manually process attendee requests. During early beta, this creates operational burden and slows event participation.

The product direction is to eventually support host-level policy (`auto-approve` vs `manual approval`), but we need a low-complexity, reversible solution now.

## Fundamental Problem

Manual RSVP approval creates too much host overhead in the beta phase:

1. Hosts must continuously review pending requests.
2. Attendees experience extra delay before joining events.
3. Participation growth is throttled by host availability rather than event capacity.

## Current Workflow

### Event Creation

1. Authenticated user creates event (`POST /events`).
2. User is stored as `host_id`.
3. Host is automatically inserted into `event_rsvps` as `status="approved"`.

### Attendee RSVP

1. Attendee calls `POST /events/{event_id}/rsvp`.
2. API checks event existence, cancellation status, duplicate RSVP, and capacity.
3. RSVP is inserted with `status="pending"` (hardcoded).
4. Host must later approve or reject via:
   - `POST /events/{event_id}/rsvps/{user_id}/approve`
   - `POST /events/{event_id}/rsvps/{user_id}/reject`

### Problems in Current Workflow

1. Pending queue accumulation for hosts.
2. Slower attendee conversion to active participants.
3. Host moderation panel becomes a frequent required task instead of occasional moderation.
4. Friction is high for public events where immediate join is typically expected.

## Decision

Introduce global feature flag `AUTO_APPROVE_RSVPS` in backend configuration and use it in RSVP creation logic:

1. If `AUTO_APPROVE_RSVPS=true`, new RSVPs are created with `status="approved"`.
2. If `AUTO_APPROVE_RSVPS=false`, current behavior remains (`status="pending"`).
3. Keep approval/rejection/removal endpoints in place as moderation fallback.

### Explicit RSVP Contract

`POST /events/{event_id}/rsvp` treats RSVP as a single membership record per `(event_id, user_id)`.

1. If any RSVP row already exists for that user/event (`pending`, `approved`, or `rejected`), the endpoint returns:
   - HTTP `400`
   - `detail="Already RSVP'd to this event"`
2. A `rejected` RSVP is terminal in current policy and cannot be re-submitted by the attendee.

## Why This Is the Right Decision

1. Lowest implementation complexity for beta timeline.
2. Reversible at runtime via environment configuration (no urgent code rollback needed).
3. Keeps future host-level policy options open without forcing immediate schema/API expansion.
4. Limits blast radius to one RSVP decision point while preserving existing admin controls.

## Considered Alternatives

1. Hardcode `approved` in RSVP path.
- Pros: fastest code change.
- Cons: no runtime rollback switch; riskier release operations.

2. Use `is_public` to auto-approve only public events.
- Pros: aligns with public/private semantics.
- Cons: does not solve burden for private events; not "auto-approve all" for beta.

3. Insert as pending, then auto-promote immediately.
- Pros: minimal conceptual shift in existing flow.
- Cons: extra write, possible transient states/races, more operational complexity than needed.

## Downstream Effects and Mitigations

1. Effect: New pending queue volume drops sharply.
- Mitigation: Keep host moderation endpoints and UI paths available for rejects/removals when needed.

2. Effect: Approved-only capabilities become immediate for new RSVPs (participant visibility, event messaging eligibility).
- Mitigation: Retain duplicate RSVP checks and capacity checks; add/verify RSVP rate limiting as abuse guard.

3. Effect: Mixed state during rollout (existing `pending` rows + new `approved` rows).
- Mitigation: Choose explicit policy before rollout:
  - one-time migration to approve existing pending, or
  - leave existing pending for manual cleanup.

4. Effect: "My events" semantics can drift when modes change.
- Mitigation: Ensure attending lists only include `status="approved"` RSVPs (exclude pending/rejected rows).

5. Effect: Product metrics shift (approved RSVPs increase sooner).
- Mitigation: Add telemetry dimension for RSVP creation mode (`auto_approved` vs `pending`) to preserve trend interpretability.

6. Effect (Known Limitation for current beta): `GET /events/user/me` can include users in `attending` based on RSVP row presence and `attended=false`, even when RSVP `status` is `rejected`.
- Impact: a rejected attendee may still appear in "attending" in profile views.
- Current decision: document and accept for this beta phase; no behavior change in this ADR implementation.
- Follow-up: update `get_my_events` attending selection to include only `status="approved"` RSVPs.

## Implementation Plan

1. Add `AUTO_APPROVE_RSVPS` config key in backend settings with default `false`.
2. Update RSVP handler decision point to derive `rsvp_status` from config.
3. Keep existing host approval/rejection/remove endpoints unchanged.
4. Apply selected policy for existing pending rows (migration or no migration).
5. Add startup/config log to confirm effective flag value in each environment.

## Testing Strategy

### Automated Tests

1. RSVP creation with flag OFF:
- Assert new RSVP status is `pending`.

2. RSVP creation with flag ON:
- Assert new RSVP status is `approved`.

3. Capacity enforcement with flag ON:
- Assert RSVP fails with "Event is full" when approved count meets limit.

4. Duplicate RSVP protection:
- Assert second RSVP attempt is rejected in both modes.

5. My-events filtering:
- Assert attending list includes only approved RSVPs (pending excluded).

### Integration / API Contract Checks

1. `GET /events/{id}` returns expected `rsvp_status` for requester in both modes.
2. `GET /events/{id}/rsvps` grouping still correct (`approved`, `pending`, `rejected`).
3. Host moderation endpoints still work for fallback moderation.

### Manual Smoke Tests (Beta Readiness)

1. Host creates event; non-host RSVPs; confirm immediate participant status with flag ON.
2. Host rejects/removes attendee after auto-approval; confirm attendee access updates correctly.
3. Toggle flag in staging and re-run RSVP flow to validate rollback behavior.

## Rollout and Rollback

1. Rollout: enable `AUTO_APPROVE_RSVPS=true` in staging, verify smoke tests, then enable in beta.
2. Rollback: set `AUTO_APPROVE_RSVPS=false` (no code deploy required).
3. Post-rollback note: if existing pending rows were migrated to approved, rollback affects only new RSVPs.

## Consequences

Positive:

1. Substantially reduced host workload in beta.
2. Faster attendee conversion and lower RSVP friction.
3. Operationally safe rollout due to feature flag control.

Negative:

1. Less pre-join host gatekeeping by default.
2. Possible need for more post-join moderation actions.
3. Analytics interpretation requires awareness of mode change.

## Exit Criteria

This ADR can be superseded when host-level RSVP policy is implemented (per-event/per-host auto-approve settings with explicit product controls).
