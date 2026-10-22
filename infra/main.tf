locals {
  tags = ["app:geo", "managed-by:terraform"]
  # Volumes carrying this tag are picked up by the daily snapshot policy below.
  backup_tag = "geo-backup:true"
}

data "ibm_resource_group" "rg" {
  name = var.resource_group
}

data "ibm_is_image" "ubuntu" {
  name = var.image_name
}

resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# ---------------------------------------------------------------- network
resource "ibm_is_vpc" "vpc" {
  name           = "${var.name_prefix}-vpc"
  resource_group = data.ibm_resource_group.rg.id
  tags           = local.tags
}

resource "ibm_is_subnet" "subnet" {
  name                     = "${var.name_prefix}-subnet"
  vpc                      = ibm_is_vpc.vpc.id
  zone                     = var.zone
  total_ipv4_address_count = 16
  resource_group           = data.ibm_resource_group.rg.id
  tags                     = local.tags
}

resource "ibm_is_security_group" "app" {
  name           = "${var.name_prefix}-sg"
  vpc            = ibm_is_vpc.vpc.id
  resource_group = data.ibm_resource_group.rg.id
  tags           = local.tags
}

# SSH only from the administrator's address.
resource "ibm_is_security_group_rule" "ssh" {
  group     = ibm_is_security_group.app.id
  direction = "inbound"
  remote    = var.admin_cidr
  protocol  = "tcp"
  port_min  = 22
  port_max  = 22
}

# Web traffic. Port 80 is required for the HTTPS certificate challenge and redirects to 443.
resource "ibm_is_security_group_rule" "http" {
  group     = ibm_is_security_group.app.id
  direction = "inbound"
  remote    = "0.0.0.0/0"
  protocol  = "tcp"
  port_min  = 80
  port_max  = 80
}

resource "ibm_is_security_group_rule" "https" {
  group     = ibm_is_security_group.app.id
  direction = "inbound"
  remote    = "0.0.0.0/0"
  protocol  = "tcp"
  port_min  = 443
  port_max  = 443
}

resource "ibm_is_security_group_rule" "egress" {
  group     = ibm_is_security_group.app.id
  direction = "outbound"
  remote    = "0.0.0.0/0"
}

# ---------------------------------------------------------------- compute
resource "ibm_is_ssh_key" "admin" {
  name           = "${var.name_prefix}-admin-key"
  public_key     = var.ssh_public_key
  resource_group = data.ibm_resource_group.rg.id
  tags           = local.tags
}

# The database lives on its own block volume. Deleting or rebuilding the server does not delete it.
resource "ibm_is_volume" "data" {
  name           = "${var.name_prefix}-data"
  profile        = "general-purpose"
  zone           = var.zone
  capacity       = var.data_volume_gb
  resource_group = data.ibm_resource_group.rg.id
  tags           = concat(local.tags, [local.backup_tag])

  lifecycle {
    prevent_destroy = true
  }
}

resource "ibm_is_instance" "app" {
  name           = "${var.name_prefix}-app"
  vpc            = ibm_is_vpc.vpc.id
  zone           = var.zone
  profile        = var.profile
  image          = data.ibm_is_image.ubuntu.id
  keys           = [ibm_is_ssh_key.admin.id]
  resource_group = data.ibm_resource_group.rg.id
  tags           = local.tags

  primary_network_interface {
    subnet          = ibm_is_subnet.subnet.id
    security_groups = [ibm_is_security_group.app.id]
  }

  boot_volume {
    name = "${var.name_prefix}-boot"
    size = var.boot_volume_gb
  }

  volumes = [ibm_is_volume.data.id]

  user_data = templatefile("${path.module}/cloud-init.yaml.tftpl", {
    data_volume_gb = var.data_volume_gb
    mount_script   = filebase64("${path.module}/scripts/mount-data.sh")
    backup_script  = filebase64("${path.module}/scripts/geo-backup.sh")
  })
}

resource "ibm_is_floating_ip" "app" {
  name           = "${var.name_prefix}-ip"
  target         = ibm_is_instance.app.primary_network_interface[0].id
  resource_group = data.ibm_resource_group.rg.id
  tags           = local.tags
}

# ------------------------------------------------ daily disk snapshots
# VPC backup policies need a service-to-service authorization to snapshot volumes.
resource "ibm_iam_authorization_policy" "backup_to_volume" {
  source_service_name  = "is"
  source_resource_type = "backup-policy"
  target_service_name  = "is"
  target_resource_type = "volume"
  roles                = ["Operator"]
  description          = "Allow the GEO backup policy to snapshot the data volume."
}

resource "ibm_is_backup_policy" "daily" {
  name                = "${var.name_prefix}-daily-snapshots"
  match_user_tags     = [local.backup_tag]
  match_resource_type = "volume"
  resource_group      = data.ibm_resource_group.rg.id

  depends_on = [ibm_iam_authorization_policy.backup_to_volume]
}

resource "ibm_is_backup_policy_plan" "daily" {
  backup_policy_id = ibm_is_backup_policy.daily.id
  name             = "${var.name_prefix}-daily-0300utc"
  cron_spec        = "0 3 * * *"

  deletion_trigger {
    delete_after = var.snapshot_retention_days
  }
}

# ------------------------------------------- off-server database backups
resource "ibm_resource_instance" "cos" {
  name              = "${var.name_prefix}-cos"
  service           = "cloud-object-storage"
  plan              = var.cos_plan
  location          = "global"
  resource_group_id = data.ibm_resource_group.rg.id
  tags              = local.tags
}

resource "ibm_cos_bucket" "backups" {
  bucket_name          = "${var.name_prefix}-db-backups-${random_string.suffix.result}"
  resource_instance_id = ibm_resource_instance.cos.id
  region_location      = var.region
  storage_class        = "smart"

  # Write-once retention: nobody, including a stolen key, can delete or overwrite a backup
  # before this period ends.
  retention_rule {
    default   = var.backup_retention_days
    minimum   = 1
    maximum   = 365
    permanent = false
  }

  expire_rule {
    rule_id = "expire-old-backups"
    enable  = true
    days    = var.backup_retention_days + 1
    prefix  = "geo-"
  }

  lifecycle {
    prevent_destroy = true
  }
}

# HMAC credentials let the server upload with any S3 client.
resource "ibm_resource_key" "cos_writer" {
  name                 = "${var.name_prefix}-backup-writer"
  role                 = "Writer"
  resource_instance_id = ibm_resource_instance.cos.id
  parameters           = { HMAC = true }
  tags                 = local.tags
}
