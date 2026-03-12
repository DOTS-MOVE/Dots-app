# ------------------------------------------------------------------------------
# GCP
# ------------------------------------------------------------------------------
variable "gcp_project_id" {
  type        = string
  description = "GCP project ID (one project for prod and staging)."
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "Region for Cloud Run and regional NEGs."
}

# ------------------------------------------------------------------------------
# Container images (digest or tag; CI passes image digest after push)
# ------------------------------------------------------------------------------
variable "registry_url" {
  type        = string
  description = "Container registry base URL, e.g. gcr.io/PROJECT or docker.pkg.dev/PROJECT/REPO."
}

variable "frontend_image_name" {
  type        = string
  default     = "dots-frontend"
  description = "Frontend image name (no registry)."
}

variable "backend_image_name" {
  type        = string
  default     = "dots-backend"
  description = "Backend image name (no registry)."
}

variable "frontend_image_sha" {
  type        = string
  description = "Frontend image digest for prod, e.g. sha256:abc...."
}

variable "backend_image_sha" {
  type        = string
  description = "Backend image digest for prod, e.g. sha256:def...."
}

# ------------------------------------------------------------------------------
# Prod hostnames (routing)
# ------------------------------------------------------------------------------
variable "frontend_domain" {
  type        = string
  description = "Prod frontend hostname, e.g. app.example.com."
}

variable "backend_domain" {
  type        = string
  description = "Prod backend hostname, e.g. api.example.com."
}

# ------------------------------------------------------------------------------
# Staging (optional; leave empty to skip all staging resources)
# ------------------------------------------------------------------------------
variable "staging_frontend_domain" {
  type        = string
  default     = ""
  description = "Staging frontend hostname, e.g. staging.example.com. Set to empty to disable staging."
}

variable "staging_backend_domain" {
  type        = string
  default     = ""
  description = "Staging backend hostname, e.g. api-staging.example.com. Set to empty to disable staging backend."
}

variable "staging_frontend_image_sha" {
  type        = string
  default     = ""
  description = "Staging frontend image digest. If empty, prod frontend image is used."
}

variable "staging_backend_image_sha" {
  type        = string
  default     = ""
  description = "Staging backend image digest. If empty, prod backend image is used."
}

# ------------------------------------------------------------------------------
# Backend env (prod) – optional; can be set in GCP Console or Secret Manager
# ------------------------------------------------------------------------------
variable "prod_backend_env" {
  type        = map(string)
  default     = {}
  sensitive   = true
  description = "Optional env vars for prod backend (e.g. DEBUG=False). Supabase can come from secrets."
}

# ------------------------------------------------------------------------------
# Staging backend env and secrets (only when staging_backend_domain != "")
# ------------------------------------------------------------------------------
variable "staging_backend_env" {
  type        = map(string)
  default     = {}
  sensitive   = true
  description = "Env vars for backend-staging: API_URL, WEBSITE_URL, DEPLOYMENT_ENV=staging, etc."
}

variable "staging_supabase_url_secret_id" {
  type        = string
  default     = null
  description = "GCP Secret Manager secret ID for staging Supabase URL. Optional. If unset, backend-staging uses prod Supabase (prod_supabase_url_secret_id) for one-project setup."
}

variable "staging_supabase_key_secret_id" {
  type        = string
  default     = null
  sensitive   = true
  description = "GCP Secret Manager secret ID for staging Supabase service role key. Optional. If unset, backend-staging uses prod key for one-project setup."
}

# ------------------------------------------------------------------------------
# Prod backend secrets (optional)
# ------------------------------------------------------------------------------
variable "prod_supabase_url_secret_id" {
  type        = string
  default     = null
  description = "GCP Secret Manager secret ID for prod Supabase URL. Optional."
}

variable "prod_supabase_key_secret_id" {
  type        = string
  default     = null
  sensitive   = true
  description = "GCP Secret Manager secret ID for prod Supabase service role key. Optional."
}
