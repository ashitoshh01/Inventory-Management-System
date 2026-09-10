# Observability

## Logs

Use structured JSON logs in production.

Required fields:

- timestamp
- level
- service
- environment
- requestId
- organizationId when applicable
- actorId when applicable
- route
- statusCode
- durationMs

Business events should include:

- event name;
- resource ID;
- outcome.

Do not log secrets or raw sensitive request bodies.

## Metrics

Track:

- request count;
- error count;
- p50/p95/p99 latency;
- DB connection pool usage;
- slow query count;
- queue depth;
- job failures;
- cache hit rate;
- login failures;
- file upload failures;
- export duration.

Business metrics:

- stock adjustments;
- stock transfers;
- sales;
- low-stock count;
- expired stock count;
- failed imports.

## Tracing

Add traces around:

- HTTP request;
- DB queries for slow paths;
- external provider calls;
- background jobs.

Propagate request/correlation IDs.

## Alerts

Start with:

- high 5xx rate;
- sustained latency;
- DB unavailable;
- connection pool exhaustion;
- queue backlog;
- worker failures;
- disk/storage issues;
- backup failure.

Do not alert on every low-priority warning.

## Audit vs logs

Operational logs are for debugging.

Audit events are business/security records.

Do not substitute application logs for audit history.
