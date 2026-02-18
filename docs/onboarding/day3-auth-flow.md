# Day 3 Auth Flow

Document how authentication works across frontend, backend, and Supabase.

## 1) Auth Components

| Component | Responsibility | File(s) |
|---|---|---|
| Supabase client | Session/token retrieval | `frontend/lib/supabase.ts` |
| Frontend auth context | Auth state for UI | `frontend/lib/auth.tsx` |
| API client token injection | Bearer propagation | `frontend/lib/api.ts` |
| Backend token validation | Current user resolution | `backend/api/auth.py` |
| Security helpers | Password/JWT helpers | `backend/core/security.py` |

## 2) Login/Register Flow

### Register
1. Frontend action: `useAuth().register(...)` in `frontend/lib/auth.tsx` calls `supabase.auth.signUp(...)`.
2. Endpoint called: Supabase Auth API (not backend `/auth/register` in normal frontend flow).
3. Token issued by: Supabase session/token flow after confirmation (frontend does not use backend register token path).
4. User record creation path: Supabase Auth user creation + Supabase-side user sync logic (see `backend/supabase_schema.sql` trigger design).
5. Redirect/session behavior: registration returns `needsConfirmation`; user is directed to email confirmation and callback route (`/auth/callback`), then login.
   Callback branching note: callback route may redirect to `/login` (default), to `next` query target, or to `/reset-password` for recovery flows.

### Login
1. Frontend action: `useAuth().login(...)` calls `supabase.auth.signInWithPassword(...)`.
2. Endpoint called: Supabase Auth API (not backend `/auth/login` in normal frontend flow).
3. Token/session source: Supabase session (`data.session.access_token`).
4. Where token is stored: Supabase client-managed session storage (`persistSession: true`).
5. How token reaches backend calls: `frontend/lib/api.ts` gets token via `supabase.auth.getSession()` and sends `Authorization: Bearer <token>`.

## 3) Authenticated Request Flow

```text
User action -> frontend/lib/api.ts -> Bearer token from Supabase session
-> FastAPI route dependency/get_current_user -> Supabase auth.get_user(token)
-> user lookup -> route logic
```

Current hybrid nuance:

```text
Backend /auth/register and /auth/login -> SQLAlchemy users table + local JWT creation
BUT most protected routes -> get_current_user() -> Supabase token validation + Supabase users table lookup
```

## 4) Token and Session Details

- Token type: Bearer token.
- Token issuer:
  - Primary runtime path: Supabase-issued access token.
  - Secondary/hybrid path: backend-local JWT issued by `/auth/register` and `/auth/login`.
- Expiration behavior:
  - Supabase token expiry handled by Supabase auth/session settings.
  - Local JWT expiry uses `ACCESS_TOKEN_EXPIRE_MINUTES` in backend settings.
- Refresh behavior:
  - Frontend Supabase client configured with `autoRefreshToken: true`.
  - Local JWT refresh endpoint is not present in reviewed backend routes.
- Failure behavior when session missing:
  - Frontend API client throws `Not authenticated` when no token is available.
  - Backend protected routes return 401 (`detail: Not authenticated` / `Invalid token`).

## 5) Authorization Rules by Domain

| Domain | Who Can Access | Where Enforced | Notes |
|---|---|---|---|
| User profile update | Authenticated current user | `Depends(get_current_user)` in `backend/api/users.py` | User-scoped operations use current user id from auth dependency. |
| Event update/delete | Event host only | Checks in `backend/api/events.py` after auth dependency | Host ownership validated in-route per endpoint. |
| Group membership changes | Group admin (or self in some remove flows) | Checks in `backend/api/groups.py` after auth dependency | Add/update paths admin-only; self-leave supported with creator restriction. |
| Post delete/like | Authenticated user; delete additionally requires post owner | Checks in `backend/api/posts.py` | Like is authenticated toggle; delete is ownership-restricted. |

## 6) Auth Edge Cases

- [ ] Missing `Authorization` header behavior verified via runtime test (`401 Not authenticated` expected).
- [ ] Expired token behavior verified via runtime test.
- [ ] Invalid token behavior verified via runtime test (`401 Invalid token` / authentication failed expected).
- [ ] Supabase outage/error behavior verified via runtime test (code indicates 401 or soft fallback behavior).
- [ ] Frontend no-session behavior verified via runtime test (`Not authenticated` or sign-out/null user handling expected).

## 7) Risks and Recommendations

- Risk: Hybrid auth contract (Supabase validation for protected routes + local JWT issuance in `/auth/*`) can create token/provider mismatch and migration confusion.
- Recommendation: Implement ADR-002 auth-provider abstraction with explicit mode (`supabase`, `local`, `hybrid`) and add contract tests per mode.
- Risk: Frontend auth depends on Supabase environment variables and session APIs; misconfiguration can fail all protected API usage.
- Recommendation: Add startup diagnostics and a smoke test validating env + token retrieval + `/users/me` success path.

## 8) Test Cases to Add

- [ ] `401` contract for protected routes.
- [ ] Optional-auth routes return safe fallback behavior.
- [ ] Frontend API client handles missing session gracefully.
- [ ] Token error message consistency for UI.
- [ ] Hybrid-mode token compatibility test (`supabase` token accepted on protected routes; local token behavior documented/enforced).
- [ ] Auth callback flow test (`/auth/callback` recovery and confirmation redirects).
