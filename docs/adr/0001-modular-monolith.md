# ADR 0001 — Modular Monolith

## Status
Accepted

## Context

The system initially targets roughly 100 concurrent active users and contains highly transactional inventory workflows.

## Decision

Use a modular monolith with separate Next.js web and NestJS API applications.

## Consequences

Positive:
- simple deployment;
- strong database transactions;
- easy local development;
- lower infrastructure cost;
- simpler observability.

Negative:
- one API deployment unit;
- modules require discipline to avoid coupling;
- future extraction may require explicit boundaries.

## Revisit when

Consider service extraction only when:
- a module has materially different scaling needs;
- deployment independence is required;
- reliability isolation is required;
- team ownership requires separation;
- measured performance/availability data justifies it.
