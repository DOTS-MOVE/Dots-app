# Auth & Database: Why You See Authentication Errors Locally

When you run a **local instance of the server** and use the app, you can see authentication-related errors in **DevTools → Network** (e.g. 401 on `/users/me`) and in the **Console** (e.g. `[AuthDiag]` logs, Supabase warnings). Login/logout often "fixes" the problem because it establishes a fresh Supabase session and clears stale state. This doc explains why that happens and how it ties to current tech debt.

## Current Architecture (Supabase only)

- **Frontend auth**: Supabase Auth only. Sign-in, sign-up, and session (including refresh) are handled by the Supabase JS client.
- **Backend auth**: Every protected route depends on `get_current_user`, which:
  1. Reads the **Supabase JWT** from the `Authorization: Bearer <token>` header.
  2. Validates that token with **Supabase** (`supabase.auth.get_user(token)`).
  3. Loads the user row from the **Supabase `users` table**.
- **Backend data**: All API routes use **Supabase** for data (no local SQLAlchemy at request time). New users signing up via Supabase Auth get a row in `public.users` (and a default subscription) via a database trigger.

## Why You See Errors in Network & Console

1. **No session or stale session**
   - On first load (or after clearing storage), there is no Supabase session. The app still calls `/users/me` with no token or an expired token → backend returns **401**.
   - The frontend's auth diagnostics then run: it may try to refresh the session, log `auth.request.401.initial`, `auth.refresh.start/done`, and sometimes `auth.refresh.failed` or `AUTH_MISCONFIG_SUSPECTED` if 401s keep happening after refresh.

2. **Backend validates against Supabase only**
   - The local server does **not** issue or validate its own JWTs for the main UI flow. It only validates Supabase tokens and then reads the user from Supabase's `users` table.
   - If the token is missing, expired, or invalid, or if the user doesn't exist in Supabase's `users` table, the backend returns **401** or **404**, which shows up in Network and can trigger the `[AuthDiag]` logs.

3. **Diagnostic logging**
   - `frontend/lib/authDiagnostics.ts` logs auth events (`logAuthEvent`, `recordAuthFailure`) to the console. So any 401, refresh attempt, or retry shows up as `[AuthDiag]` in DevTools. That's intentional for debugging but can look like "lots of auth errors" when the real cause is simply "not logged in yet" or "session expired".

4. **Supabase client warnings**
   - If env vars are missing or wrong, `frontend/lib/supabase.ts` logs warnings. In local dev, if you ever hit the placeholder/dummy client path, you'll see those in the console too.

So the errors you see are a combination of:

- **Expected** 401s when there's no valid session (e.g. before login or after expiry).
- **Diagnostic** logging that surfaces every 401 and refresh attempt.
- **Architecture**: everything goes through Supabase for auth and most data, so any misconfiguration or stale state (e.g. old token, different Supabase project) will show up as auth/network errors.

## Why Login/Logout "Fixes" It

- **Login**: Creates a new Supabase session and stores a valid access token. Subsequent calls to `/users/me` (and other APIs) send that token; the backend validates it with Supabase and finds the user in Supabase's `users` table → 200 and no auth errors.
- **Logout**: Clears the Supabase session and in-memory user state. You stop calling protected endpoints with a bad token, so you stop getting 401s and the associated diagnostics until you hit a protected route again without being logged in.

So you're not fixing a bug in the code; you're aligning app state (and token) with what the backend expects (valid Supabase token + user in Supabase).

## Is This "a Problem"?

- **For production** (Supabase-backed): No. As long as Supabase and env vars are correct, auth and data are consistent.
- **For local dev**: You may still see 401s and console noise when the session is missing or stale (e.g. before login). That's expected. The backend no longer has its own register/login endpoints; all auth is Supabase, so the "local" server still depends on Supabase being configured and reachable.

The app is now **Supabase-only** at runtime: no dual persistence or local JWT auth.

## Practical Takeaways

- **401 on `/users/me` (and similar) before login** → Expected; diagnostics will log it.
- **Errors after login** → Usually means token/session issue (e.g. wrong project, expired session, or user missing in Supabase `users`). Login again to get a fresh token.
- **Less console noise**: You could gate or reduce `[AuthDiag]` verbosity in development (e.g. only `warn`/`error` in dev, or only after the first 401) if desired; the current behavior is to log every auth event for debugging.
- **True local-only** → Would require a different architecture (e.g. ADR-001/002: SQLAlchemy-only persistence and auth provider abstraction). Current design is Supabase-only at runtime.
