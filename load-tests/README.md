# Load Testing Guide

This directory contains k6 load testing scripts and documentation for Rota.

## Prerequisites

1. Ensure the PostgreSQL database is migrated and seeded with at least 10,000 activity events:
   ```powershell
   npm run db:migrate
   npm run db:seed
   ```
2. Ensure the API server and Redis are running:
   ```powershell
   npm run dev:server
   ```

## Running the Activity Feed Load Test

A portable Windows x64 binary of k6 (v0.56.0) is available in `load-tests/bin/k6-v0.56.0-windows-amd64/k6.exe`.

### Quick Run
```powershell
./load-tests/bin/k6-v0.56.0-windows-amd64/k6.exe run load-tests/feed.js
```

### Run with Summary Export
```powershell
./load-tests/bin/k6-v0.56.0-windows-amd64/k6.exe run --summary-export=docs/performance/k6-latest.json load-tests/feed.js
```

### Configuration Options
You can configure target URLs and team IDs via environment variables:
- `BASE_URL`: Base API URL (defaults to `http://localhost:3000`)
- `TEAM_ID`: Tenant team ID (defaults to `3f5ad975-2152-4f57-9558-58a90ea3bda3`)

```powershell
k6 run -e BASE_URL=http://localhost:3000 -e TEAM_ID=3f5ad975-2152-4f57-9558-58a90ea3bda3 load-tests/feed.js
```

## Reports
- For the full benchmark results comparing Cache OFF vs. Cache ON with 200 concurrent users, see [load-tests/REPORT.md](REPORT.md).
