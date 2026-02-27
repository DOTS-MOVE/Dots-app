# ADR-003: Schema Governance and Drift Remediation

- Status: Proposed
- Date: 2026-02-18
- Owners: Backend Team
- Decision Type: Data Architecture / Operational Governance

## Context

Day 2 domain review identified schema drift risk between multiple schema definitions:

- SQLAlchemy model layer (`backend/models/*`)
- Alembic migration history (`backend/alembic/versions/*`)
- Supabase SQL bootstrap snapshot (`backend/supabase_schema.sql`)
- Runtime query behavior in route handlers (mostly Supabase table calls)

A concrete example exists:

- Initial Alembic migration defines `matches`.
- Runtime models/routes and Supabase schema use `buddies`.

Without a formal governance policy, environment-specific schema changes can diverge and cause runtime, deployment, and test instability.

## Problem Statement

We need to eliminate existing schema drift and prevent future drift across local, CI, staging, and production.

## Decision Drivers

- Runtime reliability across environments.
- Predictable deploy and rollback behavior.
- Data integrity and contract stability.
- Faster onboarding and lower debugging overhead.
- Alignment with ADR-001 (SQLAlchemy-only persistence direction).

## Decision

Adopt a strict schema governance model with Alembic as the canonical source of truth for backend schema evolution.

1. All schema changes must be introduced through Alembic migrations.
2. Manual production schema changes are disallowed unless followed immediately by an equivalent migration PR.
3. Drift checks must run in CI and block merges on mismatch.
4. Existing drift must be reconciled via forward-only reconciliation migrations.

## Scope

In scope:

- Backend relational schema (`users`, events, buddies/messages/groups/posts, lookup tables, joins).
- Alembic migration workflow and CI checks.
- Reconciliation of known drifted objects.

Out of scope:

- Frontend auth provider migration details (covered by ADR-002).
- Non-relational or external managed schemas outside backend ownership.

## Source of Truth Policy

- Canonical: Alembic migration history + `alembic_version`.
- Derived artifact: `backend/supabase_schema.sql` (documentation/bootstrap helper only).
- SQLAlchemy models must remain migration-aligned but are not the authoritative migration record.

## Known Drift (Initial List)

1. `matches` (Alembic initial migration) vs `buddies` (runtime model/API/Supabase schema).
2. Potential enum/type/default mismatches (example: RSVP status column representation).
3. Possible FK/index differences between local migration-applied DB and Supabase runtime DB.

## Remediation Strategy

### Phase 1: Baseline and Audit

1. Snapshot schemas for each environment (local, CI DB, staging, production).
2. Compare against Alembic head and model expectations.
3. Produce a drift report categorized by severity:
   - Blocking (breaks runtime)
   - Integrity risk
   - Cosmetic/non-blocking

### Phase 2: Reconciliation Migrations

1. Create forward-only reconciliation migrations for drifted objects.
2. Prefer safe transforms (rename/data migration) over destructive drop/create.
3. Validate on staging snapshot before production rollout.

### Phase 3: Enforce Guardrails

1. Add CI gate to verify schema at migration head.
2. Add policy check requiring migration files for schema-affecting PRs.
3. Add release checklist item: verify `alembic_version` and migration status in target environment.

## Migration/Deployment Policy

- Forward-only migrations in production.
- Rollback by forward corrective migration, not ad hoc hotfix SQL.
- Every deploy includes migration application and verification steps.

## CI/Automation Requirements

Minimum checks:

1. Spin up test DB.
2. Apply migrations to head.
3. Run backend startup smoke and critical contract tests.
4. Optional drift assertion: compare generated metadata/migration state to expected schema signature.

## Risks

1. Reconciliation migration may affect live data if drift is large.
2. Hidden environment-specific hotfixes may surface late.
3. Team friction if policy is strict without automation support.

## Mitigations

- Stage-first rehearsal with data snapshot.
- Backups before production migration.
- Explicit runbooks for migration and incident rollback.
- Automated CI checks to reduce manual burden.

## Success Criteria

- No known blocking drift across local/CI/staging/production.
- All environments report same Alembic head revision.
- New schema changes are introduced only via migrations.
- Runtime errors caused by missing/renamed schema objects trend to zero.

## Rollback Strategy

- If reconciliation migration fails:
  - restore from verified backup or snapshot,
  - deploy forward corrective migration after root-cause analysis.
- Keep migration artifacts and logs for auditability.

## Consequences

Positive:

- Higher reliability and reproducibility.
- Better confidence in releases and tests.
- Reduced onboarding ambiguity about "real" schema.

Negative:

- Additional process rigor and CI complexity.
- One-time effort to reconcile existing drift.

## Open Questions

- Should `supabase_schema.sql` remain as generated artifact or be retired after reconciliation?
- Which environment should be treated as baseline if conflicts exist during first reconciliation?
- Do we require online migration compatibility constraints for zero-downtime deploys?

## Cross-References

- `docs/adr/ADR-001-sqlalchemy-only-persistence-layer.md`
- `docs/adr/ADR-002-auth-provider-abstraction.md`
- `docs/adr/ADR-004-api-error-contract-and-minimal-observability.md`
- `docs/onboarding/day2-domain-model.md`
- `docs/onboarding/day2-erd.md`
