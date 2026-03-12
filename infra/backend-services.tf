# ------------------------------------------------------------------------------
# Backend services for the global HTTP(S) load balancer
# ------------------------------------------------------------------------------
resource "google_compute_backend_service" "frontend" {
  name                  = "frontend-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"

  backend {
    group = google_compute_region_network_endpoint_group.frontend_neg.id
  }
}

resource "google_compute_backend_service" "backend" {
  name                  = "backend-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"

  backend {
    group = google_compute_region_network_endpoint_group.backend_neg.id
  }
}

resource "google_compute_backend_service" "frontend_staging" {
  count                 = var.staging_frontend_domain != "" ? 1 : 0
  name                  = "frontend-staging-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"

  backend {
    group = google_compute_region_network_endpoint_group.frontend_staging_neg[0].id
  }
}

resource "google_compute_backend_service" "backend_staging" {
  count                 = var.staging_backend_domain != "" ? 1 : 0
  name                  = "backend-staging-backend"
  load_balancing_scheme = "EXTERNAL_MANAGED"
  protocol              = "HTTP"

  backend {
    group = google_compute_region_network_endpoint_group.backend_staging_neg[0].id
  }
}
