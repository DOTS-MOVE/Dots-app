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

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Production (Vercel)

1. **Set environment variables** in Vercel Project Settings → Environment Variables:
   - `NEXT_PUBLIC_SUPABASE_URL` – Your Supabase project URL (e.g. `https://xxx.supabase.co`)
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` – Supabase anon/public key
   - `NEXT_PUBLIC_API_URL` – Backend API URL (e.g. Cloud Run URL)

2. **Redeploy after adding vars** – `NEXT_PUBLIC_` variables are embedded at build time; changes require a new deployment.

## License

MIT

