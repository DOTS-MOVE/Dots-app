# Production and Staging Deployment

One GCP project, one container registry (GCR), one global load balancer. Production and staging are separate Cloud Run services; the same external IP is used and routing is by host (e.g. `app.example.com` → prod frontend, `staging.example.com` → staging frontend).

## Architecture

- **Prod:** Cloud Run services `frontend` and `backend`; hostnames set by `frontend_domain` and `backend_domain`.
- **Staging:** Cloud Run services `frontend-staging` and `backend-staging` (only when staging domain variables are set); hostnames set by `staging_frontend_domain` and `staging_backend_domain`.
- **Database:** Supabase only (no Cloud SQL, no Redis unless the app adds it). You can use **one Supabase project** for both prod and staging—see [One Supabase project](#one-supabase-project) below.
- **DNS:** Point all hostnames (prod and staging) to the **same** load balancer IP (A records). The URL map routes by host.

### One Supabase project

If you have only one Supabase project:

- **Prod and staging backends** use the **same** Supabase URL and service role key (same credentials for both).
- **Same data and auth:** Staging and prod share the same tables and the same auth users. Be careful: avoid destructive or heavy test data on staging, since it’s the same DB as prod.
- **Migrations:** Run once against that DB (e.g. in prod deploy or manually). You can run `alembic upgrade head` in the staging workflow too so the shared DB is up to date before deploying staging, or skip migrations in staging.
- **Config:** Set only prod Supabase secrets in Terraform (or Cloud Run). Backend-staging is wired to use the same Supabase secrets when you don’t set separate staging Supabase secrets.
- **Later:** If you add a second Supabase project for staging, set `staging_supabase_url_secret_id` and `staging_supabase_key_secret_id` in Terraform and use a separate `STAGING_DATABASE_URL` for migrations; then staging will use the new project and data will be isolated.

---

## 1. Required GitHub configuration

### Secrets (Settings → Secrets and variables → Actions)

| Secret | Used by | Description |
|--------|---------|-------------|
| `GCP_SA_KEY` | Prod + Staging | JSON key for a GCP service account with: Cloud Run Admin, Cloud Build Editor, Storage Admin (for GCR), Compute Admin (for LB/NEGs), Secret Manager Secret Accessor (if using Supabase from secrets). |
| `STAGING_DATABASE_URL` | Staging | (Optional.) Postgres connection string for running Alembic migrations in the staging workflow. With **one Supabase project**, use the **same** project’s connection string (same as prod). Only needed if you run migrations in CI. |

### Variables – Production (Settings → Variables)

| Variable | Description |
|----------|-------------|
| `GCP_PROJECT_ID` | GCP project ID (e.g. `dots-488014`). |
| `GCP_REGION` | Region for Cloud Run (e.g. `us-central1`). |
| `FRONTEND_DOMAIN` | Prod frontend hostname (e.g. `app.example.com`). |
| `BACKEND_DOMAIN` | Prod backend hostname (e.g. `api.example.com`). |
| `BACKEND_URL` | Full prod API URL for frontend build (e.g. `https://api.example.com`). |
| `NEXT_PUBLIC_SUPABASE_URL` | Prod Supabase project URL (frontend build). |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Prod Supabase anon/publishable key (frontend build). |

### Variables – Staging (for `dev` branch / staging workflow)

| Variable | Description |
|----------|-------------|
| `STAGING_FRONTEND_DOMAIN` | Staging frontend hostname (e.g. `staging.example.com`). |
| `STAGING_BACKEND_DOMAIN` | Staging backend hostname (e.g. `api-staging.example.com`). |
| `STAGING_FRONTEND_URL` | Full staging frontend URL (e.g. `https://staging.example.com`). |
| `STAGING_BACKEND_URL` | Full staging backend URL (e.g. `https://api-staging.example.com`). |
| `STAGING_SUPABASE_URL` | Staging frontend build: Supabase URL. With **one Supabase**, use the **same** as prod (`NEXT_PUBLIC_SUPABASE_URL`). |
| `STAGING_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | Staging frontend build: Supabase anon key. With **one Supabase**, use the **same** as prod. |

Optional (if you use them in the app):

- `STAGING_PRIVY_APP_ID`, `STAGING_PRIVY_CLIENT_ID` (or same as prod if one app).
- `STAGING_POSTHOG_KEY`, `STAGING_USER_APP_DOMAIN`, etc.

Prod vars (`FRONTEND_DOMAIN`, `BACKEND_DOMAIN`, `BACKEND_URL`, etc.) are also used by the staging workflow when running Terraform so prod resources are not changed.

---

## 2. DNS

1. Run Terraform (prod) once and get the load balancer IP:
   ```bash
   cd infra && terraform output -raw load_balancer_ip
   ```
2. Create **A records** pointing to that single IP:
   - `FRONTEND_DOMAIN` (e.g. `app.example.com`) → LB IP
   - `BACKEND_DOMAIN` (e.g. `api.example.com`) → LB IP
   - `STAGING_FRONTEND_DOMAIN` (e.g. `staging.example.com`) → LB IP
   - `STAGING_BACKEND_DOMAIN` (e.g. `api-staging.example.com`) → LB IP

No CNAME for the API if you use a subdomain; use A records to the same IP so the global URL map can route by host.

---

## 3. Auth provider (e.g. Privy)

Add the **staging** origin to allowed origins so login works on staging:

- Example: `https://staging.example.com` (value of `STAGING_FRONTEND_URL`).

---

## 4. Supabase and backend secrets

- **One Supabase project:** Use the **same** Supabase URL and service role key for both prod and staging backends. In Terraform, set only `prod_supabase_url_secret_id` and `prod_supabase_key_secret_id`; leave `staging_supabase_*` unset so backend-staging uses the same secrets as prod.
- **Prod backend:** Configure `SUPABASE_URL` and `SUPABASE_KEY` via GCP Secret Manager and reference them in Terraform (`prod_supabase_url_secret_id`, `prod_supabase_key_secret_id`), or set env in Cloud Run manually.
- **Staging backend:** With one Supabase, it uses the same credentials as prod (see above). If you later add a separate Supabase project for staging, set `staging_supabase_url_secret_id` and `staging_supabase_key_secret_id` in Terraform.
- **Migrations:** With one Supabase, run Alembic against that single DB (e.g. in prod deploy or in the staging workflow with the same `DATABASE_URL`). Optional: run migrations in the staging workflow using the same connection string as prod so the shared DB is up to date.

---

## 5. Terraform state (recommended)

For team use, configure a remote backend (e.g. GCS) in `infra/versions.tf`:

```hcl
terraform {
  backend "gcs" {
    bucket = "your-tf-state-bucket"
    prefix = "dots/infra"
  }
}
```

Then run `terraform init` once. Both prod and staging workflows will use the same state so staging applies don’t overwrite prod.

---

## 6. Workflow summary

**Note:** Deploy production at least once so that Cloud Run services `frontend` and `backend` exist; the staging workflow reads their current image digests so Terraform does not change prod.

| Branch | Workflow | What it does |
|--------|----------|----------------|
| `main` | Deploy Production | Lint, test, build frontend (prod env) and backend, push images with tag `{sha}`, run Terraform **without** staging domain vars → only prod Cloud Run and LB are updated. |
| `dev` | Deploy Staging | Lint, test, build frontend (staging env) and backend, push images with tag `{sha}-staging-{run_id}`, run Alembic migrations for staging DB, run Terraform with **staging** domain vars and **staging** image digests, **prod** image digests (from current Cloud Run) so prod is unchanged; apply only staging targets + URL map. |

---

## 7. Checklist

- [ ] One GCP project, one registry (GCR), one LB; prod and staging Cloud Run services.
- [ ] Supabase: one project for both (same credentials for prod and staging backends); or optionally a second project for staging and set staging Supabase secrets in Terraform.
- [ ] Terraform: staging resources created only when `staging_frontend_domain` / `staging_backend_domain` are set; staging deploy uses targeted apply with prod digests for prod and staging digests for staging.
- [ ] Staging workflow: unique image tag per run; staging DB migrations; Terraform apply only staging targets.
- [ ] GitHub vars set for prod and staging domains/URLs and auth (see above).
- [ ] DNS: A records for all hostnames pointing to the same LB IP.
- [ ] Auth provider: staging origin (e.g. `https://staging.example.com`) allowlisted.
- [ ] Backend accepts `DEPLOYMENT_ENV=staging`; backend-staging sets it via Terraform `staging_backend_env`.
