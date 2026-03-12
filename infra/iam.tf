# Allow unauthenticated invocations so the global load balancer can reach Cloud Run.
resource "google_cloud_run_v2_service_iam_member" "frontend_invoker" {
  name     = google_cloud_run_v2_service.frontend.name
  location = google_cloud_run_v2_service.frontend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "backend_invoker" {
  name     = google_cloud_run_v2_service.backend.name
  location = google_cloud_run_v2_service.backend.location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "frontend_staging_invoker" {
  count    = var.staging_frontend_domain != "" ? 1 : 0
  name     = google_cloud_run_v2_service.frontend_staging[0].name
  location = google_cloud_run_v2_service.frontend_staging[0].location
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "backend_staging_invoker" {
  count    = var.staging_backend_domain != "" ? 1 : 0
  name     = google_cloud_run_v2_service.backend_staging[0].name
  location = google_cloud_run_v2_service.backend_staging[0].location
  role     = "roles/run.invoker"
  member   = "allUsers"
}
