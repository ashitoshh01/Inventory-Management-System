---
name: performance
description: Concurrency targets, query optimization, caching strategies, and latency budget enforcement.
---

# Purpose
Governs performance standards, concurrency scalability (~100 active concurrent users), query execution efficiency, and latency limits across the system.

# When To Use
- When designing high-frequency read or write endpoints.
- When creating dashboard aggregations, reports, or export mechanisms.
- When tuning database indexes, Redis caches, or connection pools.

# Responsibilities
- Ensure the modular monolith achieves target latency budgets:
  - Normal API reads: p95 < 500 ms (ideal reads < 200 ms).
  - Stock mutations: p95 < 750 ms.
  - Dashboard initial paint: fast load without firing dozens of separate requests.
- Prevent database connection pool exhaustion and query bottlenecks under concurrent load.
- Optimize database access patterns and enforce asynchronous processing for large data jobs.

# Rules
1. **Benchmark Before Tuning**: Profile with realistic concurrent workloads and `EXPLAIN ANALYZE` before making speculative optimizations.
2. **Safe Caching Only**: Redis caching is permitted for low-churn data (categories, brands, user permissions metadata, short-TTL dashboard aggregates). Mutable stock balances must NEVER be cached as authoritative truth.
3. **No Unbounded Queries**: Enforce maximum page limits on all collections. Avoid wide table scans by indexing filter and sort columns.
4. **Asynchronous Heavy Computations**: Large CSV/Excel imports, bulk data exports, and periodic reconciliation reports must be dispatched to BullMQ background queues.
5. **Connection Pool Discipline**: Keep transactions as short as possible; never perform external network calls (e.g. S3 upload, email sending) inside an open database transaction.

# Required Checks
- [ ] Verify query plans (`EXPLAIN ANALYZE`) use indexes and avoid sequential table scans.
- [ ] Check that dashboard endpoints consolidate aggregations rather than causing N+1 queries.
- [ ] Ensure database transactions release row locks immediately upon completion.
- [ ] Confirm background workers handle heavy workloads without starving the HTTP API event loop.

# Common Mistakes
- Keeping a database transaction open while awaiting an external HTTP request or S3 upload.
- Fetching entire database tables into Node.js memory to perform array `.filter()` or `.reduce()`.
- Caching stock balances in Redis and creating cache invalidation race conditions.
- Firing 15 independent API calls from the frontend when loading the dashboard page.

# Definition Of Done
- Target latency budgets (p95 < 500 ms reads, p95 < 750 ms writes) are met under simulated 100-user load.
- Query execution plans confirm efficient index utilization.
- Heavy operations execute asynchronously via BullMQ without blocking the main event loop.
