# Profile & Buddies Loading – Changes Summary

This document lists all code changes made when executing the [Profile & Buddies Loading Improvement Plan](./PROFILE_BUDDIES_LOADING_IMPROVEMENT_PLAN.md).

---

## 1. Buddy status endpoint (Profile – other user)

**Goal:** Avoid loading the full buddies list when viewing another user’s profile; show Connect button state quickly.

### Backend

- **`backend/api/buddies.py`**
  - Added **`GET /buddies/status?user_id=<id>`**.
  - Returns `{ "status": "none" | "pending" | "accepted" | "rejected" }`.
  - Uses two small queries (user1→user2 and user2→user1) instead of listing all buddies.

### Frontend

- **`frontend/lib/api.ts`**
  - Added **`getBuddyStatus(otherUserId: number, opts?)`** calling `GET /buddies/status?user_id=...`.
  - Returns `Promise<{ status: 'none' | 'pending' | 'accepted' | 'rejected' }>`.

- **`frontend/app/profile/page.tsx`**
  - When viewing another user (`?userId=...`): loads **user** and **buddy status** in parallel via `Promise.all([api.getUser(userId), api.getBuddyStatus(userId)])`.
  - **`checkBuddyStatus`** now uses **`api.getBuddyStatus(otherUserId)`** instead of **`api.getBuddies()`**.
  - Removed unused **`Buddy`** import from `@/types`.

---

## 2. Batch get_my_events (remove N+1)

**Goal:** Fix N+1 in `GET /events/user/me` so response time doesn’t grow with number of events.

### Backend

- **`backend/api/events.py`**
  - Reworked **`get_my_events`** to use batched queries:
    - Load owned / attending / attended event rows as before.
    - **One** query for all `event_rsvps` for those event ids → compute `participant_count` (approved, excluding host) and `pending_requests_count` per event.
    - **One** query for all sports by `sport_id`.
    - **One** query for all hosts (users) by `host_id`.
  - Replaced per-event **`format_event()`** (4 queries per event) with **`build_event_response()`** that only reads from the pre-built maps.
  - Total queries are now a small constant (~5–6) instead of 4× number of events.

---

## 3. Batch get_posts (remove N+1)

**Goal:** Fix N+1 in `GET /posts` so response time doesn’t grow with number of posts.

### Backend

- **`backend/api/posts.py`**
  - Reworked **`get_posts`** to use batched queries:
    - Load posts as before.
    - **One** query for all **likes** with `post_id in (post_ids)` → in Python: `like_count` per post and `is_liked` for current user.
    - **One** query for all author **users** by id.
  - Build **`PostResponse`** list from these maps instead of 3 queries per post.
  - Total queries are now 2–3 instead of 3× number of posts.

---

## 4. Suggested buddies: fetch & score only a page

**Goal:** Avoid loading and scoring up to 300 users when the client only needs one page (e.g. 10).

### Backend

- **`backend/api/buddies.py`**
  - **`get_suggested_buddies`** now calls **`find_potential_buddies(current_user, supabase, limit=offset + limit, min_score=0.0)`** instead of `limit=None`.
  - Pagination slice remains **`all_buddies[offset:offset + limit]`**, but **`all_buddies`** is only as large as needed for this page.

- **`backend/services/buddying.py`**
  - In **`find_potential_buddies`**, changed **`fetch_limit = (limit + 20) if limit else 300`** to **`fetch_limit = limit if limit else 300`**.
  - When the API passes `limit = offset + limit`, only that many discoverable users are fetched and scored (e.g. 10 for first page, 20 for second).

---

## 5. Parallelize GET /users/me and GET /users/:id

**Goal:** Run independent Supabase calls in parallel to reduce profile load time.

### Backend

- **`backend/api/users.py`**
  - Added **`import asyncio`** and **`from concurrent.futures import ThreadPoolExecutor`**.
  - Added a shared **`_executor = ThreadPoolExecutor(max_workers=4)`**.
  - Added helpers (blocking, run in executor):
    - **`_fetch_user_photos(supabase, uid)`**
    - **`_fetch_user_sports(supabase, uid)`**
    - **`_fetch_user_goals(supabase, uid)`**
  - **`get_current_user_profile` (GET /users/me):** Fetches **photos**, **sports**, and **goals** in parallel via **`asyncio.gather(loop.run_in_executor(_executor, _fetch_*, supabase, user_id), ...)`**.
  - **`get_user_profile` (GET /users/:id):** After loading the user row, fetches **sports** and **goals** in parallel the same way.

---

## 6. Don’t block Buddies page on suggested

**Goal:** Show the Buddies shell (tabs) as soon as the buddies list has loaded; let Discover show its own loading state until suggested loads.

### Frontend

- **`frontend/app/buddies/page.tsx`**
  - Full-page **`loading`** changed from:
    - `!!user && ((isBuddiesLoading && buddies.length === 0) || (activeTab === 'discover' && isSuggestedLoading && suggested.length === 0))`
  - To:
    - **`!!user && (isBuddiesLoading && buddies.length === 0)`**
  - The Discover tab still uses **`isSuggestedLoading && suggested.length === 0`** inside its content to show “Loading buddies…” until suggested data is ready.

---

## Files touched

| Area        | File |
|------------|------|
| Backend    | `backend/api/buddies.py` |
| Backend    | `backend/api/events.py` |
| Backend    | `backend/api/posts.py` |
| Backend    | `backend/api/users.py` |
| Backend    | `backend/services/buddying.py` |
| Frontend   | `frontend/lib/api.ts` |
| Frontend   | `frontend/app/profile/page.tsx` |
| Frontend   | `frontend/app/buddies/page.tsx` |

No new environment variables or config changes were introduced. The improvement plan doc remains at **`docs/PROFILE_BUDDIES_LOADING_IMPROVEMENT_PLAN.md`**.

---

## Measuring endpoint response times

A script is provided to call the profile/buddies endpoints and report response times:

- **Path:** `backend/scripts/measure_profile_endpoints.py`
- **Requirements:** `pip install requests python-dotenv`
- **Usage (with backend running):**
  ```bash
  cd backend
  AUTH_TOKEN=<your-supabase-jwt> python scripts/measure_profile_endpoints.py
  ```
  Optional env: `BASE_URL` (default `http://localhost:8000`), `OTHER_USER_ID` (to measure GET /users/:id and GET /buddies/status), `RUNS` (default 3).
