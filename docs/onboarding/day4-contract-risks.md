# Day 4 Frontend-Backend Contract Risks

Record integration risks discovered while mapping frontend calls to API contracts.

## 1) Findings by Severity

| Severity | Area | Frontend File | Backend Endpoint/File | Risk | User Impact | Recommendation |
|---|---|---|---|---|---|---|
| High | Auth contract coupling | `frontend/lib/auth.tsx`, `frontend/lib/api.ts` | `backend/api/auth.py` and protected routes | Frontend relies on Supabase tokens while backend auth and persistence remain hybrid. | Login/session can appear valid in UI but fail on protected API paths in edge environments. | Execute ADR-002 with explicit provider mode and compatibility tests. |
| High | Silent failure semantics | `frontend/lib/api.ts` (events/posts/buddies getters) | `backend/api/events.py`, `backend/api/posts.py` | Several API methods fallback to `[]` on transport/server failures. | Users see empty states instead of actionable errors; outages are hidden. | Standardize 5xx handling and distinguish “no data” from “backend failure.” |
| High | Schema drift exposure | `frontend/app/*` consumers of buddies/events | Migration/runtime mismatch (`matches` vs `buddies`) | Frontend assumes endpoints/tables that may not exist in drifted environments. | Breakage across local/CI/prod despite same UI code. | Implement ADR-003 reconciliation + CI schema checks. |
| Medium | Untyped request/response surfaces | `frontend/lib/api.ts` groups/messages handling | `POST /groups/{group_id}/members`, multiple dict endpoints | Raw dict contracts reduce validation guarantees. | Runtime parsing errors and brittle UI assumptions. | Introduce typed request/response schemas for dict-heavy endpoints. |
| Medium | Query behavior variability | `frontend/app/page.tsx`, `frontend/app/events/page.tsx` | `GET /users/search`, `GET /events` | Server + client side filtering and fallback behavior can produce inconsistent results. | Search/list UX may feel unreliable as data scales. | Move filtering/pagination semantics into explicit backend contracts. |
| Low | Optional nested object variance | `frontend/components/*` event/profile/post cards | Various enriched endpoints (`host`, `sport`, `user`) | Nested objects are sometimes partial/fallback and sometimes full. | UI requires extensive defensive rendering. | Define summary vs detail response schemas and enforce consistently. |

## 2) Type and Shape Mismatches

| Contract Topic | Frontend Expectation | Backend Reality | Breakage Mode | Fix Plan |
|---|---|---|---|---|
| Nullability | Nullable fields handled but core records expected when authenticated | Some paths fallback to synthetic defaults (`Unknown`, empty arrays), others return hard errors | Inconsistent UI states and confusing user messaging | Document nullability contract and remove synthetic fallbacks where possible. |
| Enum values | `Buddy.status` and `Event.rsvp_status` expected in fixed sets | Mostly aligned, but lifecycle transitions are route-logic dependent | Unexpected button states when transitions fail silently | Add state-transition tests and explicit error mapping for invalid transitions. |
| Date formats | ISO strings parseable by JS `Date` | Mostly ISO, but constructed/converted inconsistently in routes | Sorting/render anomalies in edge cases | Add API contract tests for timestamp format and timezone consistency. |
| Pagination | `limit/offset` semantics implied across list APIs | Mixed patterns and defaults; some endpoints do Python-side filtering after fetch | Missing/duplicate results across pages | Normalize pagination parameters and return metadata or cursor design. |
| Nested objects | Optional `host/sport/user/participants` objects | Response depth varies by endpoint and failure fallback branch | Rendering logic becomes complex and error-prone | Split into explicit summary/detail schemas and typed frontend models. |

## 3) Auth and Session Risks

| Scenario | Current Behavior | Risk | Recommendation |
|---|---|---|---|
| Missing session token | API client throws `Not authenticated`; many pages redirect to login for protected actions. | User can encounter abrupt flow interruptions when session expires mid-action. | Add consistent guard UX and retry/login prompts at action boundaries. |
| Expired token | Supabase handles refresh, but failures surface as auth errors in API client. | Intermittent failures if refresh/session retrieval fails during navigation. | Add centralized auth error interceptor and silent re-auth flow where possible. |
| Invalid token | Backend returns 401 (`Invalid token` / `Authentication failed`). | Protected workflows break until session reset. | Detect 401 globally and force logout + redirect with user-facing message. |
| Supabase env misconfiguration | Frontend throws explicit configuration errors in token retrieval path. | App appears broken in deployed env if build-time vars absent/invalid. | Add startup env smoke test and deployment checklist gating. |

## 4) Runtime Error Handling Risks

| Caller | Error Type | Current UI Behavior | Desired Behavior | Priority |
|---|---|---|---|---|
| `frontend/lib/api.ts` | Timeout | Many list methods return empty data silently. | Show user-visible transient error + retry affordance while preserving stale data. | High |
| `frontend/lib/api.ts` | Network failure | Often mapped to generic message or empty list depending on method. | Consistent offline/banner handling across pages. | High |
| page/component | 4xx validation error | Mixed handling (`alert`, inline error, silent fail). | Standardized inline error presentation with actionable text. | Medium |

## 5) Tests to Add from Risks

- [ ] Frontend integration test for missing auth token path.
- [ ] Contract test for high-risk response shape mismatch.
- [ ] E2E smoke test for login -> profile -> events flow.
- [ ] API test for standardized error payload behavior.
- [ ] Frontend integration test for list endpoint backend failure (should not silently render as legitimate empty state).
- [ ] API contract test for `groups/{id}/members` typed payload and structured partial-success response (after schema addition).
- [ ] E2E smoke test for buddy discovery disabled-state (`is_discoverable=false`) and enablement flow.

## 6) References

- `docs/adr/ADR-004-api-error-contract-and-minimal-observability.md`
- `docs/onboarding/day3-api-gaps.md`
