"""
Measure response times for profile and buddies-related API endpoints.

Usage:
  1. Start the backend (e.g. uvicorn main:app --reload).
  2. Get a Bearer token (e.g. sign in via the app, then DevTools > Application > Local Storage
     or Network tab; or use Supabase to get a JWT for a user).
  3. Run from backend directory:
     AUTH_TOKEN=<your-jwt> python scripts/measure_profile_endpoints.py
     Optional: BASE_URL=http://localhost:8000 OTHER_USER_ID=2 (another user id for profile/status)

  Or with a .env file in backend containing AUTH_TOKEN=... and optionally BASE_URL, OTHER_USER_ID:
     python scripts/measure_profile_endpoints.py

Requirements: pip install requests python-dotenv
"""
import os
import sys
import time
from typing import Optional
from urllib.parse import urljoin

try:
    import requests
except ImportError:
    print("Install requests: pip install requests")
    sys.exit(1)

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8000").rstrip("/")
AUTH_TOKEN = os.environ.get("AUTH_TOKEN", "").strip()
OTHER_USER_ID = os.environ.get("OTHER_USER_ID", "")
RUNS = int(os.environ.get("RUNS", "3"))  # number of runs per endpoint for averaging


def measure(name: str, method: str, path: str, params: Optional[dict] = None) -> tuple:
    """Call endpoint and return (elapsed_seconds, status_code, ok)."""
    url = urljoin(BASE_URL + "/", path.lstrip("/"))
    headers = {"Authorization": f"Bearer {AUTH_TOKEN}"} if AUTH_TOKEN else {}
    start = time.perf_counter()
    try:
        if method.upper() == "GET":
            r = requests.get(url, headers=headers, params=params or {}, timeout=30)
        else:
            r = requests.request(method, url, headers=headers, json=params or {}, timeout=30)
        elapsed = time.perf_counter() - start
        return (elapsed, r.status_code, 200 <= r.status_code < 300)
    except Exception:
        elapsed = time.perf_counter() - start
        return (elapsed, -1, False)


def main() -> None:
    if not AUTH_TOKEN:
        print("Missing AUTH_TOKEN. Set it in the environment or in backend/.env")
        print("Example: AUTH_TOKEN=eyJ... python scripts/measure_profile_endpoints.py")
        sys.exit(1)

    other_id = OTHER_USER_ID.strip()
    if other_id and not other_id.isdigit():
        print("OTHER_USER_ID must be a numeric user id (optional).")
        sys.exit(1)
    other_id = int(other_id) if other_id else None

    endpoints = [
        ("GET /users/me", "GET", "/users/me"),
        ("GET /buddies", "GET", "/buddies"),
        ("GET /buddies/suggested (limit=10)", "GET", "/buddies/suggested", {"limit": 10, "offset": 0}),
        ("GET /events/user/me", "GET", "/events/user/me"),
        ("GET /posts (my)", "GET", "/posts", {"user_id": None}),  # will be set from /users/me
    ]

    if other_id:
        endpoints.extend([
            (f"GET /users/{other_id}", "GET", f"/users/{other_id}"),
            (f"GET /buddies/status?user_id={other_id}", "GET", "/buddies/status", {"user_id": other_id}),
        ])

    # Resolve "my" user id for GET /posts?user_id=...
    me_id = None
    for _ in range(3):
        t, status, ok = measure("GET /users/me", "GET", "/users/me")
        if ok:
            try:
                r = requests.get(
                    urljoin(BASE_URL + "/", "users/me"),
                    headers={"Authorization": f"Bearer {AUTH_TOKEN}"},
                    timeout=30,
                )
                if r.status_code == 200:
                    me_id = r.json().get("id")
            except Exception:
                pass
            break
        time.sleep(0.5)
    if me_id is not None:
        for i, e in enumerate(endpoints):
            if e[0] == "GET /posts (my)" and len(e) >= 4 and e[3] is not None:
                continue
            if e[0] == "GET /posts (my)":
                endpoints[i] = ("GET /posts (my)", "GET", "/posts", {"user_id": me_id})

    print(f"Base URL: {BASE_URL}")
    print(f"Runs per endpoint: {RUNS}")
    if other_id:
        print(f"Other user id: {other_id}")
    print()

    results: list = []  # (name, times, status, ok)

    for run in range(RUNS):
        if RUNS > 1:
            print(f"--- Run {run + 1}/{RUNS} ---")
        for item in endpoints:
            name = item[0]
            method = item[1]
            path = item[2]
            params = item[3] if len(item) > 3 else None
            if params is not None and params.get("user_id") is None:
                params = None  # will use resolved me_id from endpoint list
            elapsed, status, ok = measure(name, method, path, params)
            status_str = str(status) if status >= 0 else "error"
            ok_str = "ok" if ok else "FAIL"
            ms = elapsed * 1000
            if run == 0:
                results.append((name, [elapsed], status, ok))
            else:
                for r in results:
                    if r[0] == name:
                        r[1].append(elapsed)
                        break
            print(f"  {name}: {ms:.0f} ms  [{status_str}] {ok_str}")
        if RUNS > 1 and run < RUNS - 1:
            print()

    print()
    print("=== Summary (averaged over {} run(s)) ===".format(RUNS))
    print()
    for name, times, status, ok in results:
        avg_ms = (sum(times) / len(times)) * 1000
        min_ms = min(times) * 1000
        max_ms = max(times) * 1000
        status_str = str(status) if status >= 0 else "error"
        ok_str = "ok" if ok else "FAIL"
        print(f"  {name}")
        print(f"    avg: {avg_ms:.0f} ms   min: {min_ms:.0f} ms   max: {max_ms:.0f} ms   [{status_str}] {ok_str}")
        print()

    failed = [r[0] for r in results if not r[3]]
    if failed:
        print("Failed endpoints:", ", ".join(failed))
        sys.exit(1)


if __name__ == "__main__":
    main()
