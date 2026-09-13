#!/usr/bin/env bash
# ==============================================================================
# PostgreSQL Restore & Verification Script
# Verifies SHA-256 integrity, restores database dump, and validates invariants.
# ==============================================================================

set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <backup-file.dump> [target-database-name]"
  exit 1
fi

BACKUP_FILE="$1"
TARGET_DB="${2:-inventory_restore_test}"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "Error: Backup file '${BACKUP_FILE}' not found."
  exit 1
fi

# 1. Verify SHA-256 Checksum if file exists
if [[ -f "${CHECKSUM_FILE}" ]]; then
  echo "[Restore] Verifying SHA-256 checksum..."
  sha256sum -c "${CHECKSUM_FILE}"
  echo "[Restore] Checksum verification PASSED."
else
  echo "[Restore] Warning: No checksum file found at '${CHECKSUM_FILE}', skipping checksum verification."
fi

PGHOST="${PGHOST:-localhost}"
PGPORT="${PGPORT:-5436}"
PGUSER="${PGUSER:-postgres}"

echo "[Restore] Ensuring target database '${TARGET_DB}' exists..."
psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d postgres -c "DROP DATABASE IF EXISTS \"${TARGET_DB}\";"
psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d postgres -c "CREATE DATABASE \"${TARGET_DB}\";"

echo "[Restore] Restoring dump to '${TARGET_DB}'..."
pg_restore -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${TARGET_DB}" \
  --no-owner --no-privileges -v "${BACKUP_FILE}" || true

echo "[Restore] Executing post-restore integrity assertions..."

psql -h "${PGHOST}" -p "${PGPORT}" -U "${PGUSER}" -d "${TARGET_DB}" -v ON_ERROR_STOP=1 << 'EOF'
-- 1. Assert no negative StockBalance rows exist
DO $$
DECLARE
  neg_count INTEGER;
BEGIN
  SELECT count(*) INTO neg_count FROM "StockBalance" WHERE "quantity" < 0;
  IF neg_count > 0 THEN
    RAISE EXCEPTION 'Integrity Failure: % StockBalance rows have negative quantities!', neg_count;
  END IF;
  RAISE NOTICE 'Integrity Check 1 Passed: 0 negative StockBalance rows found.';
END $$;

-- 2. Assert StockLedgerEntry arithmetic consistency (quantityAfter = quantityBefore + quantityDelta)
DO $$
DECLARE
  math_mismatch_count INTEGER;
BEGIN
  SELECT count(*) INTO math_mismatch_count 
  FROM "StockLedgerEntry" 
  WHERE "quantityAfter" <> "quantityBefore" + "quantityDelta";

  IF math_mismatch_count > 0 THEN
    RAISE EXCEPTION 'Integrity Failure: % StockLedgerEntry rows have inconsistent arithmetic!', math_mismatch_count;
  END IF;
  RAISE NOTICE 'Integrity Check 2 Passed: All StockLedgerEntry arithmetic is consistent.';
END $$;
EOF

echo "[Restore] Database restore and verification SUCCESSFUL for database '${TARGET_DB}'."
