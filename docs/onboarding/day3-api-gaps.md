# Day 3 API Gaps and Risks

Track inconsistencies, brittle contracts, and test priorities discovered during API mapping.

## 1) Findings (Order by Severity)

Use this section as a triage list.

| Severity | Area | Endpoint/File | Finding | Impact | Suggested Fix | Test Needed |
| --- | --- | --- | --- | --- | --- | --- |
| High | Auth architecture | `backend/api/auth.py` | Hybrid auth path: token validation reads Supabase user, but register/login write/read SQLAlchemy local user table. | User identity can diverge across flows; protected routes may fail despite successful local login in some environments. | Implement provider abstraction (ADR-002) and explicitly define token compatibility mode (`supabase`, `local`, `hybrid`). | Integration tests for register/login + protected route access with each provider mode. |
| High | Error contract reliability | `backend/api/events.py`, `backend/api/posts.py` | Some query failures are swallowed and return empty arrays instead of 5xx (e.g., events/posts list). | Outages degrade into silent “no data” states; observability and debugging are impaired. | Standardize failure semantics: operational DB failures return 5xx; only true empty result sets return `[]`. | Contract tests asserting error status/body for simulated backend failures. |
| High | Schema drift risk | `backend/alembic/versions/3cf5c47f0f38_initial_migration.py`, `backend/models/buddy.py`, Supabase schema | Drift between migration history (`matches`) and runtime table usage (`buddies`). | Migration/deploy unpredictability; high risk for local/CI/prod mismatch. | Execute ADR-003 reconciliation migration plan and enforce Alembic governance. | Schema integrity test in CI validating expected tables/columns/indexes. |
| Medium | Request contract typing | `backend/api/groups.py` (`POST /groups/{group_id}/members`) | Raw `dict` request body (`user_ids`) instead of typed Pydantic schema. | Weak validation, brittle client assumptions, inconsistent docs generation. | Introduce typed request schema (e.g., `GroupMembersAddRequest`). | Validation tests for malformed payloads and missing fields. |
| Medium | Query efficiency/behavior | `backend/api/users.py` (`GET /users/search`) | Search uses broad fetch + Python filtering due to query limitations. | Latency and result quality degrade as dataset grows; pagination semantics may skew. | Move to DB-side search strategy and explicit pagination contract. | Performance + contract tests for limit/ordering/search behavior. |
| Medium | Async consistency | `backend/api/messages.py` | Real-time and REST paths both write/read messages with mixed soft-fail behavior. | Potential read-after-write and unread-count inconsistencies under concurrency. | Define explicit message consistency rules and consolidate duplicated query logic. | Integration tests for DM/group/event message ordering and read-state transitions. |
| Low | Response shape consistency | Multiple list/detail endpoints | Mix of strict Pydantic responses and ad hoc `dict` responses (`events/user/me`, `groups/.../members`, conversation endpoints). | Frontend coupling to implicit shapes; refactor risk increases. | Add typed response schemas for dict-heavy endpoints. | Schema contract snapshot tests for high-traffic endpoints. |

## 2) Contract Inconsistencies

| Contract Topic | Expected | Actual | Affected Consumers | Action |
| --- | --- | --- | --- | --- |
| Error payload shape | Uniform `HTTPException` with stable status + `detail` | Mixed: many routes follow pattern, but some swallow failures and return `[]` | `frontend/lib/api.ts`, events/posts UI | Normalize operational failures to 5xx and keep `detail` contract stable. |
| ID types | Integer IDs across model/API | Mostly integer, but some untyped `dict` endpoints can obscure shape | Groups/messages/event admin flows | Add typed schemas for currently untyped request/response bodies. |
| Nullability | Explicit nullable fields from Pydantic schemas | Some fallback responses inject synthetic defaults (`Unknown`, empty arrays) | Profile, events, posts renderers | Document nullable vs fallback fields and enforce with tests. |
| Date/time format | ISO-8601 timestamps | Mostly ISO strings; conversion logic mixed across endpoints | Frontend timeline/chat components | Centralize datetime serialization expectations in schema tests. |
| Pagination pattern | Consistent `limit/offset` semantics and explicit metadata | Mixed usage, inconsistent defaults, and Python-side filtering paths | Posts, users search, buddies suggested | Standardize pagination query params and return metadata (or document no metadata). |

## 3) Auth/Authorization Gaps

| Endpoint | Gap | Risk | Recommendation |
| --- | --- | --- | --- |
| `get_current_user` dependency (`backend/api/auth.py`) | Hard-coupled to Supabase token verification and Supabase user lookup while login/register are local SQLAlchemy. | Authentication mismatches and migration blockers. | Migrate to auth-provider abstraction with explicit compatibility mode. |
| `POST /auth/register` + `POST /auth/login` | Issues local JWT token but protected routes validate Supabase token path. | Token trust boundary ambiguity. | Define canonical token issuer per mode and enforce one validation path per mode. |
| `GET /events/{event_id}/rsvps`, approve/reject/remove | Host authorization implemented in-route, repeated across handlers. | Drift and missed checks during future edits. | Extract reusable authorization helper/service for event host checks. |
| `POST /groups/{group_id}/members` | Membership add contract accepts raw dict and partially ignores invalid member IDs. | Silent partial success can confuse clients. | Return structured result with added/skipped/failed members and typed request schema. |

## 4) Data Integrity and Race Risks

| Scenario | Risk | Where Observed | Recommendation |
| --- | --- | --- | --- |
| RSVP status transitions | Concurrent approvals can overrun `max_participants` check due to read-then-write pattern. | `backend/api/events.py` approve/rsvp paths | Use transaction/constraint strategy or optimistic retry with recheck on update. |
| Buddy creation duplication | Duplicate creation check is application-level and non-atomic across reversed pairs. | `backend/api/buddies.py` create flow | Add DB uniqueness strategy (canonicalized pair or unique index pattern) and handle conflict errors. |
| Message consistency | Conversation read/unread updates can race with new message writes; mixed soft-fail behavior masks issues. | `backend/api/messages.py` mark-read + list paths | Add deterministic ordering/read-state rules and tighten error handling/logging. |

## 5) Test Priority Matrix

| Priority | Test Name | Type | Why It Matters | Owner |
| --- | --- | --- | --- | --- |
| P0 | Protected route auth contract | API integration | Validates token compatibility and catches hybrid auth regressions early. | Backend |
| P0 | Events/posts failure contract | API integration | Prevents silent outage masking via empty-array fallbacks. | Backend |
| P0 | Schema conformance smoke | CI schema check | Detects drift (`matches` vs `buddies`) before runtime failures. | Platform/Backend |
| P1 | RSVP transition rules | API integration | Prevents capacity and state corruption in core event workflow. | Backend |
| P1 | Buddy duplicate prevention | API integration | Prevents duplicate relationship rows and UX inconsistency. | Backend |
| P1 | Frontend API error handling | Frontend unit/integration | Ensures UI handles explicit 4xx/5xx contracts predictably. | Frontend |

## 6) Immediate Actions (Next 48 Hours)

1. Lock API error contract policy: convert silent `[]` failure paths in events/posts list endpoints to explicit 5xx for backend failures.
2. Add typed request model for `POST /groups/{group_id}/members` and update catalog/docs accordingly.
3. Create initial CI drift check task (table/column assertions including `buddies` and `event_rsvps.status`) and link to ADR-003 execution plan.

## 7) Deferred Actions

- Auth provider abstraction rollout (ADR-002) with mode-based migration and telemetry.
- Full repository/service refactor (ADR-001) to remove route-level data access and repeated authorization logic.

## 8) References

- `docs/onboarding/day3-api-catalog.md`
- `docs/onboarding/day3-auth-flow.md`
- `docs/adr/ADR-004-api-error-contract-and-minimal-observability.md`
- Relevant backend route files in `backend/api/`
- Relevant frontend callers in `frontend/lib/api.ts`
