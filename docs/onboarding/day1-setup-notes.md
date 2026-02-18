# Day 1 Setup Notes

Use this as a running log while you bootstrap the DOTS app locally.

## 1) Machine + Tooling Snapshot

- Date: 2026-02-17
- OS: macOS Tahoe
- Node version: 24.12.0
- npm version: 11.6.2
- Python version: 4.14.2
- Docker version: 29.12.0
- Docker Compose version: 5.0.2

## 2) Setup Commands Executed

Record exact commands run (copy/paste from terminal history).

Commands listed in README.md worked fine to setup dev env.
```bash
# Example:
# cd backend
# python3 -m venv venv
# source venv/bin/activate
# pip install -r requirements.txt
```

## 3) Environment File Status

- Backend env file present: `yes/no`
- Frontend env file present: `yes/no`
- Variables configured:
  - [x] `SUPABASE_URL`
  - [x] `SUPABASE_KEY`
  - [x] `DATABASE_URL`
  - [x] `NEXT_PUBLIC_SUPABASE_URL`
  - [x] `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
  - [x] `NEXT_PUBLIC_API_URL`

## 4) Startup Verification

### Backend
README.md was correct
- Command used:
- Result:
- URL verified:
- Health check result:
- API docs result:

### Frontend
README.md was correct
- Command used:
- Result:
- URL verified:
- Initial page loaded:

### Database
README.md was correct
- Startup method:
- Connection result:
- Migrations run:

## 5) Issues Encountered

For each issue, capture symptom, likely cause, and fix.

| Issue | Symptom/Error | Root Cause | Fix Applied | Status |
|---|---|---|---|---|
| Could not perform migration | migration failed  | alembic not installed  | ran: pip install alembic  | fixed  |
| Could not start db | docker-compose not found | I'm using docker compose v2 | ran: docker compose ... | fixed |

## 6) Known Warnings (Not Blocking)

- need to audit node packages for security

## 7) Evidence Links / References

- Relevant file references:
  - `README.md`
  - `docker-compose.yml`
  - `run.sh`
  - `backend/core/config.py`
  - `frontend/lib/supabase.ts`
- Log files:
  - `backend.log` (if generated)
  - `frontend.log` (if generated)

## 8) Day 1 Exit Criteria

- [x] App runs locally end-to-end.
- [x] Required env vars identified and documented.
- [x] Local architecture understood at a high level.
- [x] Open questions prepared for Day 2 domain deep dive.

## 9) Hand-off Summary (Optional)

Write a short summary another engineer can read in 2 minutes.

- Current state: Everything you need to get started should be in the README.md file
- Biggest blocker: alembic install
- Next action:
