output "load_balancer_ip" {
  value       = google_compute_global_address.lb_ip.address
  description = "Global static IP for the load balancer. Point prod and staging DNS A records to this IP."
}

output "frontend_domain" {
  value       = var.frontend_domain
  description = "Prod frontend hostname."
}

output "backend_domain" {
  value       = var.backend_domain
  description = "Prod backend hostname."
}

output "staging_frontend_domain" {
  value       = var.staging_frontend_domain != "" ? var.staging_frontend_domain : null
  description = "Staging frontend hostname when staging is enabled."
}

output "staging_backend_domain" {
  value       = var.staging_backend_domain != "" ? var.staging_backend_domain : null
  description = "Staging backend hostname when staging is enabled."
}
