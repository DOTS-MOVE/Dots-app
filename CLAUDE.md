# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Dots is a full-stack social fitness app for finding sports buddies and events. It has two independent applications:
- **Frontend**: Next.js 16 (React 18, TypeScript) — runs on port 3000
- **Backend**: FastAPI (Python) — runs on port 8000

## Commands

### Running the App

```bash
# Start both frontend and backend together
npm run dev

# Start individually
npm run frontend    # Next.js dev server
npm run backend     # uvicorn main:app --reload

# First-time setup
npm run install     # Creates Python venv and installs all deps
```

### Frontend

```bash
cd frontend
npm run dev
npm run build
npm run lint
npm run test          # Vitest single run
npm run test:watch    # Vitest watch mode
```

### Backend

```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Tests
pytest
pytest tests/test_specific_file.py -v

# Database migrations
alembic revision --autogenerate -m "description"
alembic upgrade head
alembic downgrade -1
```

## Architecture

### Frontend (`frontend/`)

- **Auth**: Supabase Auth via React Context in [lib/auth.tsx](frontend/lib/auth.tsx). Email confirmation is required before login. Tokens expire after 30 minutes with custom refresh logic.
- **API Client**: Custom `ApiClient` class in [lib/api.ts](frontend/lib/api.ts). Has built-in retry logic for transient errors, request IDs for tracing, and token refresh on 401. Uses `Promise.race` for timeouts (not `AbortController`) to avoid race conditions.
- **Data Fetching**: SWR for caching and revalidation; React Context only for auth state.
- **Routing**: Next.js App Router under `app/`. Pages are feature-organized.
- **Maps**: Leaflet + react-leaflet for event location display.

### Backend (`backend/`)

- **Structure**: Router-based with feature modules under `api/` (auth, users, events, buddies, messages, groups, sports, goals, posts, waitlist).
- **Database**: Supabase PostgreSQL as primary. SQLAlchemy 2.0 ORM for queries. Schema defined in `supabase_schema.sql`; migrations tracked via Alembic.
- **Auth**: JWT tokens verified in `core/security.py`. The service role Supabase key is used for admin operations.
- **Config**: All configuration centralized in `core/config.py` (Pydantic Settings). Reads from `.env.local` then `.env`.
- **RPC Functions**: Several Supabase stored procedures defined in `*_def.sql` files (e.g., `conversations_def.sql`, `get_user_profile_bundle_def.sql`).
- **Startup Check**: Backend verifies Supabase connectivity on startup (`main.py`) but does not crash if unavailable.

### Environment Variables

**Backend** (`.env.local`):
```
SUPABASE_URL=
SUPABASE_KEY=          # Service role key
SECRET_KEY=
CORS_ORIGINS=["http://localhost:3000"]
AUTO_APPROVE_RSVPS=false
```

**Frontend** (`.env.local`):
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Frontend Test Setup

Tests live in `frontend/lib/**/*.test.ts(x)` and run in a jsdom environment. Setup file: `frontend/tests/setup.ts`. Config: `frontend/vitest.config.ts`.

### Local Database (Docker)

```bash
docker-compose up -d   # Start local PostgreSQL on port 5432
# Local DB URL: postgresql://postgres:postgres@localhost:5432/dots
```
