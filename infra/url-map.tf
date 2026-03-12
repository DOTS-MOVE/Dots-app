# ------------------------------------------------------------------------------
# One URL map: prod host rules always; staging host rules only when staging enabled
# ------------------------------------------------------------------------------
resource "google_compute_url_map" "main" {
  name            = "dots-url-map"
  default_service = google_compute_backend_service.frontend.id

  # Prod frontend
  host_rule {
    hosts        = [var.frontend_domain]
    path_matcher = "frontend"
  }
  path_matcher {
    name            = "frontend"
    default_service = google_compute_backend_service.frontend.id
  }

  # Prod backend
  host_rule {
    hosts        = [var.backend_domain]
    path_matcher = "backend"
  }
  path_matcher {
    name            = "backend"
    default_service = google_compute_backend_service.backend.id
  }

  # Staging frontend (only when staging_frontend_domain is set)
  dynamic "host_rule" {
    for_each = var.staging_frontend_domain != "" ? [1] : []
    content {
      hosts        = [var.staging_frontend_domain]
      path_matcher = "frontend-staging"
    }
  }
  dynamic "path_matcher" {
    for_each = var.staging_frontend_domain != "" ? [1] : []
    content {
      name            = "frontend-staging"
      default_service = google_compute_backend_service.frontend_staging[0].id
    }
  }

  # Staging backend (only when staging_backend_domain is set)
  dynamic "host_rule" {
    for_each = var.staging_backend_domain != "" ? [1] : []
    content {
      hosts        = [var.staging_backend_domain]
      path_matcher = "backend-staging"
    }
  }
  dynamic "path_matcher" {
    for_each = var.staging_backend_domain != "" ? [1] : []
    content {
      name            = "backend-staging"
      default_service = google_compute_backend_service.backend_staging[0].id
    }
  }
}

resource "google_compute_target_http_proxy" "main" {
  name    = "dots-http-proxy"
  url_map = google_compute_url_map.main.id
}

# Reserve one global static IP; point prod and staging DNS (A records) to this IP.
resource "google_compute_global_address" "lb_ip" {
  name = "dots-lb-ip"
}

resource "google_compute_global_forwarding_rule" "http" {
  name                  = "dots-http-forwarding-rule"
  target                = google_compute_target_http_proxy.main.id
  port_range            = "80"
  load_balancing_scheme = "EXTERNAL"
  ip_address            = google_compute_global_address.lb_ip.address
}
