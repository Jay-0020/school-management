#!/usr/bin/env bash
# Back up the app_uploads Docker volume (student/staff photos + note files) to
# off-server storage. The database is covered by managed-Postgres auto-backups,
# but uploaded FILES live only in this volume — if the droplet dies they're gone
# unless backed up separately. Run on a cron, e.g. daily:
#
#   0 3 * * *  /opt/school/backup-uploads.sh >> /var/log/uploads-backup.log 2>&1
#
# Requires: docker, and rclone configured with a remote (B2/S3/Spaces). Set:
#   VOLUME       Docker volume name            (default: app_uploads)
#   RCLONE_REMOTE  rclone remote:path           (e.g. b2:my-bucket/school-uploads)
#   KEEP_DAYS    delete local archives older than N days (default: 7)
set -euo pipefail

VOLUME="${VOLUME:-app_uploads}"
RCLONE_REMOTE="${RCLONE_REMOTE:-}"
KEEP_DAYS="${KEEP_DAYS:-7}"
OUT_DIR="${OUT_DIR:-/var/backups/school-uploads}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
ARCHIVE="$OUT_DIR/uploads-$STAMP.tar.gz"

mkdir -p "$OUT_DIR"

# Tar the volume contents from a throwaway container that mounts it read-only.
docker run --rm \
	-v "$VOLUME":/data:ro \
	-v "$OUT_DIR":/backup \
	alpine \
	tar czf "/backup/$(basename "$ARCHIVE")" -C /data .

echo "Created $ARCHIVE ($(du -h "$ARCHIVE" | cut -f1))"

# Push off-server if an rclone remote is configured.
if [ -n "$RCLONE_REMOTE" ]; then
	rclone copy "$ARCHIVE" "$RCLONE_REMOTE/"
	echo "Uploaded to $RCLONE_REMOTE/"
else
	echo "WARNING: RCLONE_REMOTE not set — archive kept locally only (not off-server)."
fi

# Prune old local archives.
find "$OUT_DIR" -name 'uploads-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "Done."
