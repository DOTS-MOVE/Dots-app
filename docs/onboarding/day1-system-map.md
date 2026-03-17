# Day 1 System Map

Use this document to capture how DOTS is wired end-to-end after your first local run.

## 1) Local Run Checklist

- [ ] Backend dependencies installed
- [ ] Frontend dependencies installed
- [ ] Database started (`docker-compose up db -d`)
- [ ] Backend running (`uvicorn main:app --reload`)
- [ ] Frontend running (`npm run dev`)
- [ ] API docs reachable (`http://localhost:8000/docs`)
- [ ] Frontend reachable (`http://localhost:3000`)

## 2) Runtime Boundaries

Fill in what each layer is responsible for:

- Frontend (Next.js):
- Backend (FastAPI):
- Database (PostgreSQL):
- Supabase (Auth/DB usage):
- Deployment (Vercel + backend target):

## 3) Environment Variables Map

Document each variable, where it is defined, and who consumes it.

| Variable | Scope (frontend/backend) | File/Platform Source | Used In | Required in Local | Required in Prod | Notes |
|---|---|---|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | frontend  |  |  |  |  |  |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | frontend |  |  |  |  |  |
| `NEXT_PUBLIC_API_URL` | frontend |  |  |  |  |  |
| `SUPABASE_URL` | backend |  |  |  |  |  |
| `SUPABASE_KEY` | backend |  |  |  |  |  |
| `DATABASE_URL` | backend |  |  |  |  |  |
| `SECRET_KEY` | backend |  |  |  |  |  |

## 4) Request Flow Map

Describe one request per critical flow:

### A) Authenticated User Profile Fetch
1. UI action:
2. Frontend API call (`frontend/lib/api.ts`):
3. Backend route (`backend/api/...`):
4. Data store touched:
5. Response shape:
6. Failure modes:

### B) Events List Fetch
1. UI action:
2. Frontend API call:
3. Backend route:
4. Data store touched:
5. Response shape:
6. Failure modes:

## 5) Architecture Diagram (Text Version)

```text
[Browser / Next.js UI]
        |
        | HTTP (Bearer token)
        v
[FastAPI Backend]
   |             \
   | SQLAlchemy   \ Supabase client
   v               v
[PostgreSQL]    [Supabase Auth/DB]
```

Update this with concrete connections you confirm in code.

## 6) Deployment Notes

- Frontend deploy target:
- Backend deploy target:
- Build-time env vars:
- Runtime env vars:
- Known deploy scripts:
- Known caveats:

## 7) Open Questions

- [ ] 
- [ ] 
- [ ] 

## 8) End-of-Day Summary

- What is confirmed:
- What is assumed:
- Biggest risk discovered:
- Next investigation target for Day 2:

