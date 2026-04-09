# Dots - Fitness Buddy Matching & Event Discovery Platform

MVP implementation for connecting fitness enthusiasts with workout buddies and local sports events.

## Tech Stack

- **Frontend**: Next.js 14 (React) with TypeScript, Tailwind CSS
- **Backend**: FastAPI (Python) with SQLAlchemy ORM
- **Database**: PostgreSQL
- **Auth**: JWT tokens
- **Real-time**: WebSockets for messaging

## Getting Started

### Prerequisites 

- Node.js >= 20.9.0
- Python 3.11+
- PostgreSQL 15+ (or use Docker)
- Docker & Docker Compose (optional)

### Setup

1. **Clone and install dependencies:**

```bash
# Frontend
cd frontend
npm install

# Backend
cd ../backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

2. **Set up environment variables:**

```bash
# Backend
cd backend
cp env.example .env
# Edit .env with your database URL and secret key
```

3. **Start PostgreSQL (using Docker):**

```bash
docker-compose up db -d
```

4. **Run database migrations:**

```bash
cd backend
source venv/bin/activate
alembic upgrade head
```

5. **Start the servers:**

```bash
# Terminal 1 - Backend
cd backend
source venv/bin/activate
uvicorn main:app --reload

# Terminal 2 - Frontend
cd frontend
npm run dev
```

The app will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Docs: http://localhost:8000/docs

## Project Structure

```
dots/
├── frontend/          # Next.js frontend
├── backend/           # FastAPI backend
│   ├── api/          # Route handlers
│   ├── core/         # Config, database, security
│   ├── models/       # SQLAlchemy models
│   ├── schemas/      # Pydantic schemas
│   ├── services/     # Business logic
│   └── alembic/      # Database migrations
└── docker-compose.yml # Docker setup
```

## Development

### Database Migrations

```bash
# Create a new migration
alembic revision --autogenerate -m "description"

# By default this uses the local DATABASE_URL in your current environment.
# To run against Supabase, point DATABASE_URL at your Supabase Postgres endpoint first:
export DATABASE_URL="postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR_PROJECT_REF].supabase.co:5432/postgres?sslmode=require"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Environments & hosting

### Git branches

- **`dev`** — day-to-day work: push feature work here. This branch drives the **dev** frontend and the **development** backend.
- **`main`** — **production**. Treat it as stable: only merge **`dev` → `main`** when you are ready to release (avoid pushing experimental work straight to `main`).

### Google Cloud (backend)

The FastAPI API runs on **Google Cloud Run** in project `dots-490015` (override via CI secret `GCP_PROJECT_ID` if needed).

| What | Purpose |
|------|--------|
| **Cloud Run `dots-backend`** | Production API (deployed from **`main`** when `backend/` changes). |
| **Cloud Run `dots-backend-dev`** | Development API (deployed from **`dev`** when `backend/` changes). |
| **Cloud Build** | Builds the Docker image from `backend/cloudbuild.yaml` on each deploy. |
| **Container Registry (`gcr.io/...`)** | Stores built images tagged with the Git commit SHA in CI. |

**CI/CD:** `.github/workflows/deploy-backend.yml` runs on push to `main` or `dev` when files under `backend/` (or the workflow) change. Configure GitHub Actions secrets:

- `GCP_SA_KEY` — JSON key for the deploy service account (see workflow comments for IAM roles).
- `GCP_PROJECT_ID` — optional; defaults to `dots-490015`.

Set runtime secrets on each Cloud Run service in the GCP console (e.g. `SUPABASE_URL`, `SUPABASE_KEY`, `SECRET_KEY`, `CORS_ORIGINS`). **Dev** and **prod** can point at different values or the same Supabase project, depending on how you want to isolate data.

### Vercel (frontend)

Two logical environments:

| Environment | Git | Frontend URL | Backend (`NEXT_PUBLIC_API_URL`) |
|-------------|-----|----------------|-----------------------------------|
| **Production** | **`main`** | Production domain (e.g. dotsmove.com) | Cloud Run **`dots-backend`** URL |
| **Dev** | **`dev`** | **https://dev.dotsmove.com** | Cloud Run **`dots-backend-dev`** |

In **Vercel → Project → Settings → Environment Variables**, assign each variable to the right **environment** (**dev**, or a dedicated Preview branch for `dev`):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY`
- `NEXT_PUBLIC_API_URL` — **must** be the **dev** Cloud Run URL for builds from `dev`, and the **prod** Cloud Run URL for **`main`**.

`NEXT_PUBLIC_*` values are baked in at **build time**; change the URL, then **redeploy** that environment.

## License

MIT
