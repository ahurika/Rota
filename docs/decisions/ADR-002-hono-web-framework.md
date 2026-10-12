# ADR-002: Hono Web Framework for Backend API
Date: 2026-10-12   Status: accepted

## Problem
We need a lightweight, fast, TypeScript-first web framework for Node.js to power the Rota API with standard middleware ordering, high request throughput, clean routing, and minimal overhead.

## Options considered
1. **Express**:
   - Pros: Battle-tested, vast ecosystem.
   - Cons: Legacy asynchronous error handling issues, heavy middleware overhead, dated type definitions requiring external augmentations.
2. **Fastify**:
   - Pros: Fast, schema validation built-in.
   - Cons: Complex plugin encapsulation model, higher cognitive load for developers learning backend system design.
3. **Hono (with `@hono/node-server`)**:
   - Pros: Modern Web Standards API (`Request`, `Response`, `fetch`), first-class TypeScript inference, extremely low latency and memory footprint, simple middleware chain, works seamlessly in Node.js and can port to edge runtimes if needed.
   - Cons: Smaller ecosystem than Express, but has official Node.js adapter and first-class middleware support.

## Decision
We chose Hono with `@hono/node-server` as specified in PRD Section 8.1.

## Why
1. Clean, intuitive middleware composition (`requestId` -> `logger` -> `rateLimit` -> `auth` -> `requireRole` -> `handler`).
2. Native support for standard Web APIs makes unit and integration testing fast with `app.request()` without needing to spin up TCP network listeners.
3. Full TypeScript type safety across routes, parameters, and context variables.

## Consequences
- Handlers run via standard web request/response patterns.
- Tests can execute requests in memory using `app.request('/path')`, resulting in sub-millisecond integration tests.
