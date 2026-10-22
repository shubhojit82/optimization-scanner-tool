#!/usr/bin/env bash
# Finds the blank data disk attached by Terraform, formats it once, and mounts it at /srv/geo-data.
# Safe to run again: it never formats a disk that already has a filesystem.
set -euo pipefail

DATA_GB="${1:?usage: mount-data.sh <data-volume-gb>}"
MOUNT=/srv/geo-data
mkdir -p "$MOUNT"

if mountpoint -q "$MOUNT"; then
  echo "already mounted"
else
  want=$(( DATA_GB * 1024 * 1024 * 1024 ))
  dev=""
  # Disk with no partitions, no filesystem and about the requested size.
  for _ in $(seq 1 30); do
    while read -r name size type; do
      [ "$type" = "disk" ] || continue
      lsblk -no NAME "/dev/$name" | tail -n +2 | grep -q . && continue
      [ -z "$(lsblk -no FSTYPE "/dev/$name")" ] || continue
      diff=$(( size > want ? size - want : want - size ))
      if [ "$diff" -lt $(( want / 50 )) ]; then dev="/dev/$name"; break; fi
    done < <(lsblk -dnb -o NAME,SIZE,TYPE)
    [ -n "$dev" ] && break
    sleep 2
  done

  if [ -z "$dev" ]; then
    # Nothing blank. If the data disk was already formatted earlier, mount it by label.
    if blkid -L geo-data >/dev/null 2>&1; then dev="$(blkid -L geo-data)"; else echo "data disk not found" >&2; exit 1; fi
  else
    mkfs.ext4 -q -L geo-data "$dev"
  fi

  uuid=$(blkid -s UUID -o value "$dev")
  grep -q "$uuid" /etc/fstab || echo "UUID=$uuid $MOUNT ext4 defaults,nofail 0 2" >> /etc/fstab
  mount "$MOUNT"
fi

mkdir -p "$MOUNT/app" "$MOUNT/caddy"
chown 1000:1000 "$MOUNT/app"
echo "data disk ready at $MOUNT"
