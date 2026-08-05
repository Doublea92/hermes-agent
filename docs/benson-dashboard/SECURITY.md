# Security

## Boundary

Benson is intended only for Aaron's trusted local network. Do not publish port 8765 through a router, public reverse proxy, tunnel, or cloud load balancer without a separate threat review and stronger identity provider.

## Controls in the MVP

- Non-loopback startup fails closed when no dashboard auth provider is active.
- Passwords are stored as scrypt hashes; secrets and hashes are excluded from documentation and UI.
- Signed session cookies and WebSocket tickets are provided by Hermes.
- Password login is rate-limited per source IP and does not reveal whether the username exists.
- The Jarvis aggregate endpoint returns status, counts, task metadata, and bounded source metadata only.
- Recursive secret-shaped-key validation blocks unsafe aggregate payloads.
- Forms use typed JSON APIs and backend validation; no HTML string injection is used by the Benson page.
- No browser shell or arbitrary command endpoint exists.
- Meaningful authentication events use the Hermes dashboard audit log.
- Runtime dependency audit on 2026-08-05 reported zero production vulnerabilities.

## Credentials

- Keep credentials in `/opt/data/.hermes/.env` or approved profile secret storage with mode 0600.
- Never commit `.env`, password hashes, signing secrets, API tokens, cookies, raw auth logs, or session transcripts.
- `.env.example` contains names and safe placeholders only.
- UI and logs must redact token/key/password/secret-like fields.

## Network

- Application bind: container interface `0.0.0.0:8765`, required because the service runs on a Docker bridge.
- External target: host LAN addresses `192.168.0.193` and `192.168.0.195`; port 8765 is not yet published. No router-port or external-firewall changes.
- HTTP is acceptable only on this trusted LAN for the MVP. Add HTTPS before depending on microphone APIs or expanding access.

## Command and workflow policy

The dashboard must never pass arbitrary user text to a shell. Workflow launchers must map an operation ID to server-defined executable arguments, validate parameters, present a dry-run/impact summary, enforce approval policy, log the action, and apply a timeout. Destructive or consequential actions remain owner-approved.

## Approval-required changes

- Public exposure or router/firewall modification
- Credential/authentication changes
- Production data or destructive database changes
- Container/volume deletion
- Service deployment that recreates the Hermes container
- External communications or paid service use
- Merge to the main branch

## Open risks

1. Python's linked SQLite 3.46.1 has the WAL-reset corruption vulnerability. Target 3.51.3+ or patched 3.50.7/3.44.6.
2. Trusted-LAN HTTP does not protect credentials from a compromised LAN segment. HTTPS is roadmap item 2.
3. Durable s6 deployment is prepared but not applied; until deployed, a standalone Benson process does not recover after container recreation.
4. The repository has upstream divergence and requires careful reconciliation before merge.

## Incident response

1. Stop only the Benson process; do not repeatedly restart it.
2. Preserve logs and Git status without copying secrets into reports.
3. Check auth audit, backend log, `/api/status`, and `/api/jarvis/overview` separately.
4. Roll back to the prior tested commit and rebuild if a code change caused the incident.
5. Rotate credentials only with explicit owner approval when compromise is suspected.
