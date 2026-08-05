# Benson Dashboard Roadmap

Priority is always: broken functionality → security → reliability/performance → usability → integrations → proactive intelligence → visual polish.

## Next 20 controlled enhancements

1. **Durable supervised service** — deploy the prepared s6 definition and verify container restart recovery.
2. **HTTPS on the LAN** — add a trusted local certificate/reverse proxy so microphone features work without browser exceptions.
3. **End-to-end chat test harness** — verify Gateway WebSocket tickets, prompt submission, streaming, timeout, and cancellation.
4. **Task progress cards** — show queued/running/blocked/completed state from Kanban and active sessions with safe cancellation.
5. **Notification center** — durable read/acknowledged state, severity filters, and links to owner actions.
6. **Audit activity timeline** — combine dashboard auth audit, agent actions, approvals, and service events with redaction.
7. **Error boundaries and source health** — separate frontend, backend, gateway, and integration failures with recovery actions.
8. **Daily agenda** — unified calendar events and owner tasks with conflict and travel-time indicators.
9. **Calendar integration** — read-only next-event and schedule briefing with explicit source freshness.
10. **Email briefing** — prioritized read-only summary with recruiter alerts and no send action by default.
11. **Slack briefing** — channel/thread summaries and owner mentions; external posting remains approval-gated.
12. **Server and Docker page** — container health, restart counts, resource trends, and log excerpts with secret redaction.
13. **Home Assistant summary** — read-only rooms/devices first, then allowlisted control actions with confirmation.
14. **Workflow launcher** — natural-language matching to explicitly allowlisted workflows, dry-run preview, approval, and audit.
15. **Approval inbox** — actionable IDs, impact/risk/rollback details, and one-use approval semantics.
16. **Searchable memory** — scoped Obsidian/session search with citations, freshness, and privacy controls.
17. **Daily briefing automation** — overnight preparation and morning review card, without consequential automatic actions.
18. **Agent operations map** — real-time visual map of specialized agents, dependencies, task states, and blockers.
19. **Second-brain graph** — interactive Obsidian relationship map with bounded real-time activity overlays.
20. **Voice maturity** — wake phrase, push-to-talk fallback, visible microphone state, mute, interruption, latency budgets, and voice preferences.

When fewer than five actionable items remain, replenish this roadmap to at least twenty using production evidence, owner feedback, security findings, and observed operational friction. Do not add speculative animation work ahead of reliability or usability work.
