# ------------------------------------------------------------------------------
# Prod Cloud Run services
# ------------------------------------------------------------------------------
# Staging backend uses these when staging-specific Supabase secrets are not set (one Supabase project).
locals {
  staging_supabase_url_secret = var.staging_supabase_url_secret_id != null ? var.staging_supabase_url_secret_id : var.prod_supabase_url_secret_id
  staging_supabase_key_secret  = var.staging_supabase_key_secret_id != null ? var.staging_supabase_key_secret_id : var.prod_supabase_key_secret_id
}

resource "google_cloud_run_v2_service" "frontend" {
  name     = "frontend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    containers {
      image = "${var.registry_url}/${var.frontend_image_name}@${var.frontend_image_sha}"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = false
      }
    }
    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
    timeout = "300s"
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

resource "google_cloud_run_v2_service" "backend" {
  name     = "backend"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    containers {
      image = "${var.registry_url}/${var.backend_image_name}@${var.backend_image_sha}"

      ports {
        container_port = 8080
      }

      dynamic "env" {
        for_each = var.prod_backend_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = var.prod_supabase_url_secret_id != null ? [1] : []
        content {
          name = "SUPABASE_URL"
          value_source {
            secret_key_ref {
              secret  = var.prod_supabase_url_secret_id
              version = "latest"
            }
          }
        }
      }

      dynamic "env" {
        for_each = var.prod_supabase_key_secret_id != null ? [1] : []
        content {
          name = "SUPABASE_KEY"
          value_source {
            secret_key_ref {
              secret  = var.prod_supabase_key_secret_id
              version = "latest"
            }
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = false
      }
    }
    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
    timeout = "300s"
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

# ------------------------------------------------------------------------------
# Staging Cloud Run services (only when staging domains are set)
# ------------------------------------------------------------------------------
resource "google_cloud_run_v2_service" "frontend_staging" {
  count    = var.staging_frontend_domain != "" ? 1 : 0
  name     = "frontend-staging"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    containers {
      image = "${var.registry_url}/${var.frontend_image_name}@${var.staging_frontend_image_sha != "" ? var.staging_frontend_image_sha : var.frontend_image_sha}"

      ports {
        container_port = 8080
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = false
      }
    }
    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
    timeout = "300s"
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}

resource "google_cloud_run_v2_service" "backend_staging" {
  count    = var.staging_backend_domain != "" ? 1 : 0
  name     = "backend-staging"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_INTERNAL_LOAD_BALANCER"

  template {
    containers {
      image = "${var.registry_url}/${var.backend_image_name}@${var.staging_backend_image_sha != "" ? var.staging_backend_image_sha : var.backend_image_sha}"

      ports {
        container_port = 8080
      }

      dynamic "env" {
        for_each = var.staging_backend_env
        content {
          name  = env.key
          value = env.value
        }
      }

      dynamic "env" {
        for_each = local.staging_supabase_url_secret != null ? [1] : []
        content {
          name = "SUPABASE_URL"
          value_source {
            secret_key_ref {
              secret  = local.staging_supabase_url_secret
              version = "latest"
            }
          }
        }
      }

      dynamic "env" {
        for_each = local.staging_supabase_key_secret != null ? [1] : []
        content {
          name = "SUPABASE_KEY"
          value_source {
            secret_key_ref {
              secret  = local.staging_supabase_key_secret
              version = "latest"
            }
          }
        }
      }

      resources {
        limits = {
          cpu    = "1"
          memory = "512Mi"
        }
        cpu_idle          = true
        startup_cpu_boost = false
      }
    }
    scaling {
      min_instance_count = 0
      max_instance_count = 10
    }
    timeout = "300s"
  }

  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }
}
