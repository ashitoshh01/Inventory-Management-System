# Engineering Decisions

Use this file only for short-lived project decisions that do not warrant a full ADR.

Long-lived architecture decisions belong in `docs/adr/`.

Current assumptions:

- initial scale: ~100 concurrent active users;
- modular monolith;
- PostgreSQL authoritative;
- Redis non-authoritative;
- stock ledger immutable;
- stock mutations transactional;
- API versioned under `/api/v1`;
- production uses containers;
- large exports/imports are asynchronous.
