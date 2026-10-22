output "public_ip" {
  description = "Floating IP of the server."
  value       = ibm_is_floating_ip.app.address
}

output "ssh_command" {
  value = "ssh ubuntu@${ibm_is_floating_ip.app.address}"
}

output "public_hostname" {
  description = "Free DNS name that resolves to the server (sslip.io). Replace with your own domain when you have one."
  value       = "${replace(ibm_is_floating_ip.app.address, ".", "-")}.sslip.io"
}

output "app_url" {
  value = "https://${replace(ibm_is_floating_ip.app.address, ".", "-")}.sslip.io"
}

output "backup_bucket" {
  value = ibm_cos_bucket.backups.bucket_name
}

output "backup_endpoint" {
  description = "Public S3 endpoint for the backup bucket."
  value       = "s3.${var.region}.cloud-object-storage.appdomain.cloud"
}

output "backup_access_key" {
  value     = ibm_resource_key.cos_writer.credentials["cos_hmac_keys.access_key_id"]
  sensitive = true
}

output "backup_secret_key" {
  value     = ibm_resource_key.cos_writer.credentials["cos_hmac_keys.secret_access_key"]
  sensitive = true
}
