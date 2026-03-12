# ------------------------------------------------------------------------------
# Serverless NEGs (point to Cloud Run services)
# ------------------------------------------------------------------------------
resource "google_compute_region_network_endpoint_group" "frontend_neg" {
  name                  = "frontend-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.frontend.id
  }
}

resource "google_compute_region_network_endpoint_group" "backend_neg" {
  name                  = "backend-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.backend.id
  }
}

resource "google_compute_region_network_endpoint_group" "frontend_staging_neg" {
  count                 = var.staging_frontend_domain != "" ? 1 : 0
  name                  = "frontend-staging-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.frontend_staging[0].id
  }
}

resource "google_compute_region_network_endpoint_group" "backend_staging_neg" {
  count                 = var.staging_backend_domain != "" ? 1 : 0
  name                  = "backend-staging-neg"
  region                = var.region
  network_endpoint_type = "SERVERLESS"

  cloud_run {
    service = google_cloud_run_v2_service.backend_staging[0].id
  }
}
