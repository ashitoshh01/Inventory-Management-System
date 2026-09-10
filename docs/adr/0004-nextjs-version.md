# ADR 0004 — Next.js 16.x Active LTS and React 19.x

## Status

Accepted

## Context

The frontend application (`apps/web`) requires a modern, production-grade web framework supporting React Server Components, efficient server rendering, strong TypeScript integration, and long-term stability.

Earlier documentation references varied between Next.js 15+ and generic Next.js 16+ without specifying release channel or stability constraints. React 19 is the current major foundation for React Server Components and modern web performance.

## Decision

1. Standardize `apps/web` on the **Next.js 16.x Active LTS** release line alongside **React 19.x**.
2. Restrict usage to stable, documented APIs. Do not enable experimental Next.js 16 flags or canary features unless an explicit architectural requirement is approved.
3. Ensure all frontend components remain strictly decoupled from the database layer, consuming the backend NestJS API via standard HTTP/JSON contracts.

## Consequences

### Positive

- Predictable production stability under the Active LTS release lifecycle.
- Full compatibility with React 19 Server Components, streaming SSR, and modern CSS tooling.
- Eliminates ambiguity in dependency pinning and CI build environments.

### Negative

- Requires maintaining discipline against adopting bleeding-edge experimental APIs prematurely.
