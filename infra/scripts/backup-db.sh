#!/usr/bin/env bash
# ==============================================================================
# PostgreSQL Backup Script
# Creates a compressed, custom-format pg_dump with SHA-256 integrity checksum.
# ==============================================================================

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./infra/backups}"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
BACKUP_FILE="${BACKUP_DIR}/ims_backup_${TIMESTAMP}.dump"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

mkdir -p "${BACKUP_DIR}"

echo "[Backup] Starting PostgreSQL backup at ${TIMESTAMP}..."

if [[ -n "${DATABASE_URL:-}" ]]; then
  echo "[Backup] Dumping from DATABASE_URL connection..."
  pg_dump -d "${DATABASE_URL}" -Fc -v -f "${BACKUP_FILE}"
else
  PGHOST="${PGHOST:-localhost}"
  PGPORT="${PGPORT:-5436}"
  PGUSER="${PGUSER:-postgres}"
  PGDATABASE="${PGDATABASE:-inventory_dev}"

  echo "[Backup] Dumping from host=${PGHOST} port=${PGPORT} db=${PGDATABASE}..."
  pg_dump -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${PGDATABASE}" -Fc -v -f "${BACKUP_FILE}"
fi

echo "[Backup] Computing SHA-256 checksum..."
sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"

FILESIZE="$(du -h "${BACKUP_FILE}" | cut -f1)"
echo "[Backup] Backup completed successfully:"
echo "  File:     ${BACKUP_FILE} (${FILESIZE})"
echo "  Checksum: ${CHECKSUM_FILE}"
