# Changelog

All notable Benson dashboard changes are recorded here. Dates use America/Detroit.

## 2026-08-05

### Added

- Dedicated `feature/benson-dashboard` branch and Kanban task `t_c0d2e088`.
- Explicit operational status ribbon for dashboard, gateway, CPU, memory, disk, and network interfaces.
- Network counters and interface availability in the safe system-status aggregate.
- Persistent reduced-motion toggle that also reduces canvas animation work.
- Responsive status layouts for desktop, tablet, and mobile.
- Benson dashboard architecture, security, roadmap, environment, and nightly operations documentation.
- Start, stop, health-check, and prepared s6 service scripts.

### Security

- Reused Hermes non-loopback authentication gate instead of creating a second auth implementation.
- Kept the overview read-only and bounded to sanitized status/count data.
- Production dependency audit reported zero known runtime vulnerabilities.

### Known risks

- Current runtime SQLite 3.46.1 requires a patched upgrade for the WAL-reset issue.
- Durable s6 deployment and Docker port publication are prepared but not applied without owner deployment approval.
