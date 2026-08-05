# Architecture

## Decision summary

Benson is implemented as a first-party Hermes dashboard surface, not a separate application. This minimizes duplicate authentication, gateway code, configuration, deployment, and state.

## Runtime

```text
LAN browser
  │ HTTP + signed session cookie
  ▼
Hermes FastAPI dashboard :8765
  ├── static React/Vite bundle
  ├── /api/status
  ├── /api/system/stats
  ├── /api/jarvis/overview (sanitized read-only aggregate)
  ├── /api/auth/* (Hermes auth provider)
  └── WebSocket ticket + GatewayClient
          │ prompt.submit / streaming events
          ▼
      Hermes gateway and agent runtime
          ├── profiles and active sessions
          ├── Kanban boards and task history
          ├── cron jobs
          ├── integrations
          └── Obsidian memory vault
```

## Project placement

The source lives in `/opt/data/hermes-agent` because the required authenticated API, Gateway WebSocket client, status models, and React application already exist there. A separate `/benson-dashboard` repository would duplicate security-critical infrastructure and drift from Hermes.

## Frontend

- React/TypeScript/Vite route `/jarvis`; `/benson` is a stable alias.
- Plain CSS for low-overhead original visual design.
- 15-second status refresh by default; no model call is used for routine health rendering.
- Voice canvas respects both OS and saved reduced-motion preferences.
- Responsive breakpoints at 1180, 820, and 540 pixels.

## Backend

- FastAPI serves the built frontend and authenticated APIs.
- `/api/jarvis/overview` composes bounded counts/status from existing endpoints and authoritative sources.
- Potential secret-shaped keys are rejected recursively before the aggregate is returned.
- System network data is limited to byte counters and interface up/total counts—no addresses, routes, or packet content.

## Authentication

A non-loopback bind activates Hermes' fail-closed auth gate. The trusted-LAN deployment uses the bundled basic provider:

- scrypt password hash (no plaintext password in repository)
- stable HMAC signing secret stored outside Git
- signed session cookies
- per-client-IP login rate limit
- generic invalid-credential responses
- dashboard auth audit log

## Agent communication

Text/voice turns obtain an authenticated one-shot WebSocket ticket and use `GatewayClient` with `prompt.submit`. The dashboard does not expose a shell endpoint. Future workflow controls must call named, allowlisted operations only.

## Process lifecycle

- Development/session start: `scripts/benson-dashboard-start.sh`
- Stop: `scripts/benson-dashboard-stop.sh`
- Health: `scripts/benson-dashboard-health.sh`
- Durable target: prepared s6 service under `deploy/benson-dashboard-s6/run`

The live Hermes gateway and the existing port-9119 dashboard are independent and must not be restarted for Benson frontend changes.

## Versioning and rollback

- Dedicated branch: `feature/benson-dashboard`
- Small commits tied to a Kanban task and nightly report
- Build artifacts are generated from source after tests
- Rollback before merge: stop Benson, check out the prior tested commit, rebuild, start, health-check
- No direct merge to `main`; owner-approved tested merge only
