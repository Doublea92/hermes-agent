# Benson Dashboard

A local-network command cockpit for Aaron Olson, built into Hermes Agent with an original calm, high-contrast interface.

## Address

- Planned primary LAN URL: **http://192.168.0.193:8765/benson**
- Planned alternate LAN URL: **http://192.168.0.195:8765/benson**
- Current verified container URL: **http://172.18.0.2:8765/benson** (container-local; redirects to `/jarvis` after authentication)
- Canonical application route: `/jarvis` (`/benson` redirects there)
- Bind inside the Hermes container: `0.0.0.0:8765`; Docker host publishing must be added before either LAN URL works. No router or external-firewall changes are part of this project.

Port 8765 was verified free before startup on 2026-08-05. Both LAN URLs were explicitly tested and are currently unavailable because the container does not publish 8765.

## Project

- Repository: `/opt/data/hermes-agent`
- Branch: `feature/benson-dashboard`
- Operational documentation: `/opt/data/hermes-agent/docs/benson-dashboard`
- Frontend: React 19, TypeScript, Vite, CSS, Lucide icons
- Backend: Hermes FastAPI application
- Agent transport: authenticated Hermes Gateway WebSocket (`prompt.submit`)
- Status transport: authenticated REST (`/api/jarvis/overview`, `/api/status`, `/api/system/stats`)
- Authentication: Hermes dashboard username/password provider, scrypt password hash, signed session cookies, per-IP login rate limiting
- State: Hermes profiles, Kanban SQLite boards, cron state, session history, and Obsidian vault remain authoritative; the dashboard does not create a parallel source of truth.

## Start, stop, and verify

```bash
cd /opt/data/hermes-agent
./scripts/benson-dashboard-start.sh
./scripts/benson-dashboard-health.sh
./scripts/benson-dashboard-stop.sh
```

For supervised container deployment, use `deploy/benson-dashboard-s6/run` as an s6 service definition after the host publishes port 8765. Adding it to the live container service tree or changing Docker port mappings is a deployment action and requires owner approval.

## Development and tests

```bash
cd /opt/data/hermes-agent
npx --yes npm@12.0.2 run test --workspace web -- --run src/pages/JarvisPage.layout.test.ts
npx --yes npm@12.0.2 run typecheck --workspace web
npx --yes npm@12.0.2 run build --workspace web

SITE=$(/opt/hermes/.venv/bin/python -c 'import site; print(site.getsitepackages()[0])')
PYTHONPATH=.:$SITE uv run --no-project --with pytest python -m pytest -q tests/hermes_cli/test_jarvis_overview.py
```

## Current MVP capabilities

- Benson landing route and responsive cockpit
- Authenticated text and voice chat through Hermes Gateway
- Live date/time and explicit operational status ribbon
- Dashboard, gateway, CPU, memory, disk, and network-interface health
- Agent/task, approval, activity, service/integration, and memory panels
- Mobile/tablet/desktop responsive layouts
- Persistent reduced-motion control plus OS preference support
- Safe, read-only aggregate status endpoint with secret-key rejection
- Meaningful dashboard authentication audit trail inherited from Hermes

## Known limitations

- The dashboard currently binds HTTP on a trusted LAN. Microphone APIs require HTTPS or a browser exception; text chat is unaffected.
- Automatic container-restart recovery needs the prepared s6 service and host port publication to be deployed with owner approval.
- SQLite 3.46.1 in the current Python runtime has the documented WAL-reset corruption vulnerability. Upgrade Hermes/runtime SQLite to 3.51.3+ or a patched backport during a separately tested maintenance window.
- The repository is ahead of and behind upstream; do not merge until upstream reconciliation and full regression testing are complete.

See [ROADMAP.md](ROADMAP.md), [ARCHITECTURE.md](ARCHITECTURE.md), [SECURITY.md](SECURITY.md), and [NIGHTLY_REPORT.md](NIGHTLY_REPORT.md).
