# Backup, Recovery & Disaster Restoration Runbook

This runbook specifies the authoritative procedures, integrity verification steps, and operational requirements for database backup and recovery in the Inventory Management System.

---

## 1. Objectives & SLAs

- **RPO (Recovery Point Objective)**: < 1 hour. In production cloud environments, continuous Write-Ahead Log (WAL) archiving (e.g. AWS WAL-G / pgBackRest / GCP Cloud SQL continuous backup) delivers point-in-time recovery to within minutes of an incident.
- **RTO (Recovery Time Objective)**: < 4 hours from incident declaration to verified operational state.
- **Data Invariant Integrity**: Zero tolerance for corrupted StockBalance or orphaned StockLedgerEntry rows.

---

## 2. Backup Strategy

### Local / Staging Baseline

- Automated scheduled logical dumps via PostgreSQL custom archive format (`pg_dump -Fc`).
- Compression and deterministic cryptographic hashing via SHA-256 (`.dump.sha256`).
- Script: `infra/scripts/backup-db.sh`

### Production Topology Expectations

1. **Full Database Snapshots**: Executed daily during minimum traffic windows (e.g., 02:00 UTC).
2. **Continuous WAL Archiving**: Streamed to off-site, immutable, versioned S3-compatible cloud storage.
3. **Retention Policy**:
   - Daily dumps retained for 30 days.
   - Weekly snapshots retained for 12 weeks.
   - Monthly backups retained for 1 year.
4. **Access Control**: Encrypted at rest (AES-256 / KMS) with least-privilege IAM policy.

---

## 3. Disaster Recovery Execution (Step-by-Step)

### Step 1 — Quiesce & Isolate

If corruption or disaster is detected:

1. Terminate or drain incoming traffic from load balancers to prevent split-brain stock mutations:
   ```bash
   # Scale API instances to 0 or point load balancer to maintenance page
   ```
2. Capture a diagnostic snapshot of current database state if partially intact.

### Step 2 — Verify Backup Integrity

Prior to restoring, verify cryptographic signature and checksum:

```bash
sha256sum -c infra/backups/ims_backup_<timestamp>.dump.sha256
```

Ensure output states: `ims_backup_<timestamp>.dump: OK`.

### Step 3 — Restore Database

Execute the restore script against the target PostgreSQL host:

```bash
./infra/scripts/restore-db.sh infra/backups/ims_backup_<timestamp>.dump <target_database_name>
```

### Step 4 — Automated Post-Restore Invariant Assertions

The restore script automatically executes the following critical SQL integrity checks:

```sql
-- 1. Assert non-negative StockBalance invariant
DO $$
DECLARE neg_count INTEGER;
BEGIN
  SELECT count(*) INTO neg_count FROM "StockBalance" WHERE "quantity" < 0;
  IF neg_count > 0 THEN
    RAISE EXCEPTION 'CRITICAL INTEGRITY FAILURE: % negative StockBalance records found!', neg_count;
  END IF;
END $$;

-- 2. Assert StockLedgerEntry mathematical conservation
DO $$
DECLARE math_mismatch INTEGER;
BEGIN
  SELECT count(*) INTO math_mismatch
  FROM "StockLedgerEntry"
  WHERE "quantityAfter" <> "quantityBefore" + "quantityDelta";
  IF math_mismatch > 0 THEN
    RAISE EXCEPTION 'CRITICAL INTEGRITY FAILURE: % StockLedgerEntry records violate arithmetic conservation!', math_mismatch;
  END IF;
END $$;
```

### Step 5 — Verify Application Readiness

1. Deploy API pointed at restored database.
2. Execute readiness health check:
   ```bash
   curl -f http://localhost:4000/api/v1/health/readiness
   ```
3. Run smoke tests (non-destructive product / warehouse / category reads).
4. Re-enable user traffic.
