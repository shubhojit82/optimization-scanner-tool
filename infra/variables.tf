variable "region" {
  description = "IBM Cloud region."
  type        = string
  default     = "us-east"
}

variable "zone" {
  description = "Availability zone inside the region."
  type        = string
  default     = "us-east-1"
}

variable "resource_group" {
  description = "Existing resource group that will own everything."
  type        = string
  default     = "Default"
}

variable "name_prefix" {
  description = "Prefix for resource names."
  type        = string
  default     = "geo"
}

variable "profile" {
  description = "VSI profile. cx2-2x4 = 2 vCPU / 4 GB, the smallest size that builds the Docker image comfortably."
  type        = string
  default     = "cx2-2x4"
}

variable "image_name" {
  description = "Exact name of an Ubuntu 24.04 stock image. Find it with: ibmcloud is images --visibility public | grep ubuntu-24"
  type        = string
}

variable "boot_volume_gb" {
  description = "Boot disk size in GB (holds OS and Docker images, not your data)."
  type        = number
  default     = 25
}

variable "data_volume_gb" {
  description = "Size of the separate data disk that holds the SQLite database and TLS certificates. Must be at least 10."
  type        = number
  default     = 20

  validation {
    condition     = var.data_volume_gb >= 10
    error_message = "data_volume_gb must be at least 10."
  }
}

variable "ssh_public_key" {
  description = "Contents of the public key (ssh-ed25519 ...) used to log in to the server."
  type        = string
}

variable "admin_cidr" {
  description = "Your public IP in CIDR form, e.g. 203.0.113.7/32. Only this address can reach SSH."
  type        = string

  validation {
    condition     = can(cidrhost(var.admin_cidr, 0)) && var.admin_cidr != "0.0.0.0/0"
    error_message = "admin_cidr must be a valid CIDR and must not be 0.0.0.0/0."
  }
}

variable "cos_plan" {
  description = "Object Storage plan. 'lite' is free but only one lite instance is allowed per account."
  type        = string
  default     = "standard"
}

variable "backup_retention_days" {
  description = "Days to keep nightly database backups in Object Storage."
  type        = number
  default     = 35
}

variable "snapshot_retention_days" {
  description = "Days to keep daily disk snapshots of the data volume."
  type        = number
  default     = 14
}
