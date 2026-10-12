# ADR-001: Monorepo Structure with npm Workspaces
Date: 2026-10-12   Status: accepted

## Problem
Rota consists of a React Native (Expo) mobile client, a backend API and worker service, load-test suites, and extensive documentation and test evidence. We needed a repository structure that keeps the codebase organized, allows shared linting/scripts, and avoids managing multiple disconnected repositories during a fast-paced 1-week build.

## Options considered
1. **Multi-repo (separate repos for app and server)**:
   - Pros: Completely isolated dependencies and CI workflows.
   - Cons: Slower cross-cutting development (e.g., synchronizing API contracts, schema updates, shared documentation), overhead of managing multiple Git repositories and pull requests for single feature slices.
2. **Monorepo with npm workspaces (`/server`, `/app`, `/load-tests`, `/docs`)**:
   - Pros: Native npm workspaces support without complex extra tooling (Turborepo/Nx); single source of truth for PRD, ADRs, test results, and architecture docs; unified scripts in root `package.json` (`npm run dev:server`, `npm run dev:app`).
   - Cons: Need clean boundary enforcement so server packages/secrets are never accidentally bundled into Expo.

## Decision
We chose a lightweight monorepo with standard npm workspaces containing `server` and `app` packages, with `docs` and `load-tests` at the root.

## Why
1. Meets the PRD requirements directly.
2. Avoids build-tool complexity while keeping all evidence and documentation unified.
3. Allows root-level test and lint execution as specified in `AGENTS.md`.

## Consequences
- We must enforce strict separation of environment variables: server secrets stay in `server/.env`, and only explicitly approved `EXPO_PUBLIC_` variables are allowed in `app/`.
- CI/local scripts can be run from root or from workspace directories.
