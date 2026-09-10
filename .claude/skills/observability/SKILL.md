---
name: observability
description: Structured JSON logging, OpenTelemetry tracing, Prometheus metrics, and error tracking standards.
---

# Purpose

Governs system telemetry, structured logging, distributed request tracing, metric collection, and production error monitoring.

# When To Use

- When configuring loggers, tracing interceptors, or metrics collectors.
- When adding diagnostic context to HTTP requests, database queries, or background jobs.
- When setting up error monitoring and health alerting thresholds.

# Responsibilities

- Provide immediate operational visibility into system health, API latency, worker progress, and error spikes.
- Ensure every incoming request carries a correlation ID propagated across HTTP boundaries, database transactions, and background queues.
- Separate operational debugging logs from immutable business/security audit logs.

# Rules

1. **Structured JSON Logs**: Logs in production must be formatted as structured JSON with required fields:
   `timestamp`, `level`, `service`, `environment`, `requestId`, `organizationId`, `actorId`, `route`, `statusCode`, `durationMs`.
2. **Strict Redaction**: Never log passwords, tokens, API keys, session cookies, credit cards, or sensitive personal data.
3. **Trace Propagation**: Correlation IDs (`x-request-id`) must be captured from headers or generated on ingress, passed down through service layers, and returned in response envelopes.
4. **Distinct Audit Events**: Operational logs are ephemeral and debug-oriented. Business audit events (`AuditEvent`) are immutable database records tracking who modified what resource and when. Never substitute logs for audit records.
5. **Key Metrics Tracking**: Measure request rates, error counts, p50/p95/p99 latency, DB connection pool utilization, queue depths, and job failure rates.

# Required Checks

- [ ] Confirm request ID is included in log statements, error responses, and background jobs.
- [ ] Verify sensitive payload fields are masked in logs and traces.
- [ ] Ensure uncaught exceptions report to error tracking with full stack traces while returning sanitized envelopes to users.
- [ ] Check that metrics instrumentation does not add measurable latency to request execution.

# Common Mistakes

- Logging sensitive credentials, authorization headers, or full database rows containing user hashes.
- Printing unformatted strings using `console.log` instead of structured loggers.
- Relying on ephemeral console logs for business compliance audits instead of the `AuditEvent` database table.
- Failing to correlate background job execution with the original triggering request ID.

# Definition Of Done

- Structured JSON logging is active with request ID correlation.
- Sensitive fields are demonstrably redacted from logs.
- Liveness and readiness probes export operational metrics.
- Unhandled errors are captured and routed to error tracking without leaking internal details.
