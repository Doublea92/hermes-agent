import { describe, expect, it } from "vitest";
import { buildApprovalRequestRecords, approvalStatusForTask } from "./approval-center";
import type { JarvisOverview, JarvisProduct, JarvisTask } from "./api";

const task = (overrides: Partial<JarvisTask>): JarvisTask => ({
  id: "t_approval",
  title: "Approve deploy",
  status: "blocked",
  assignee: "bob",
  priority: 1,
  board: "cast-and-tag",
  created_at: 100,
  started_at: 110,
  completed_at: null,
  block_kind: "needs_input",
  attention_reason: "review-required: approve deployment rollback",
  attention_action: "Answer needed",
  attention_since: 120,
  task_href: "/plugins/kanban?board=cast-and-tag&task=t_approval",
  last_failure_error: null,
  ...overrides,
});

const product = (approvalTask: JarvisTask): JarvisProduct => ({
  slug: "cast-and-tag",
  name: "Cast & Tag",
  health: "attention",
  summary: "summary",
  phase: "phase",
  last_updated: null,
  priorities: [],
  next_actions: [],
  safety_notes: ["Revert the branch and leave publishing disabled."],
  blockers: [],
  approval_note: "Production, publication, regulatory, financial, secret, and permission changes require explicit approval.",
  trust_rule: "Official source rule",
  owner_action: {
    kind: "approval",
    label: "Answer needed",
    task_id: approvalTask.id,
    title: approvalTask.title,
    reason: approvalTask.attention_reason,
    age_label: null,
    href: approvalTask.task_href,
    source: "kanban",
  },
  primary_cta: { label: "Open approval task", href: approvalTask.task_href, kind: "approval_task" },
  freshness: { status: "fresh", last_updated: null, age_days: null, message: "fresh", sources: [] },
  blocker_summary: { total: 1, needs_input: 1, capability: 0, transient: 0, unknown: 0, examples: [approvalTask] },
  approval_summary: { total: 1, review: 0, ready: 1, examples: [approvalTask], approval_note: "note" },
  status_path: "/tmp/status.md",
  charter_path: "/tmp/charter.md",
  board: {
    slug: "cast-and-tag",
    available: true,
    counts: { blocked: 1 },
    blocked_count: 1,
    review_count: 1,
    open_tasks: [approvalTask],
    blocked_tasks: [approvalTask],
    review_tasks: [approvalTask],
  },
  links: [],
});

const overview = (approvalTask: JarvisTask): JarvisOverview => ({
  generated_at: "2026-08-05T00:00:00Z",
  refresh_after_seconds: 30,
  agent_status: {
    overall: "ok",
    gateway_state: "running",
    active_agents: 0,
    active_sessions: 0,
    auth_required: false,
    connected_platforms: 0,
    configured_platforms: 0,
    profiles: [],
    components: {},
  },
  todos: [],
  products: [product(approvalTask)],
  memory_vault: {
    obsidian: {
      configured: false,
      status: "unavailable",
      label: "Obsidian Memory",
      path: null,
      source: "not_configured",
      href: "#",
      message: "unavailable",
      note_count: 0,
      decision_count: 0,
      product_note_count: 0,
      recent_notes: [],
      quick_links: [],
    },
  },
  service_health: {
    overall: "ok",
    gateway: {},
    dashboard: {},
    storage: {},
    platforms: {},
    system: {},
    cron: {
      available: true,
      total: 0,
      enabled: 0,
      paused: 0,
      recent_failures: 0,
      local_only: 0,
    },
  },
  sources: [],
});

describe("approval center model", () => {
  it("builds validated approval requests with required metadata", () => {
    const records = buildApprovalRequestRecords(overview(task({})));
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      id: "cast-and-tag:t_approval",
      risk: "critical",
      exactEffect: "Approve deploy — review-required: approve deployment rollback",
      rollbackPlan: "Revert the branch and leave publishing disabled.",
      requester: "bob",
      timestamp: 120,
      status: "waiting_input",
      availableAction: "Answer needed",
    });
    expect(records[0]?.validationErrors).toEqual([]);
    expect(records[0]?.history.map((entry) => entry.label)).toContain("Attention needed");
  });

  it("maps the specified status states from board data", () => {
    expect(approvalStatusForTask(task({ status: "review", block_kind: null }))).toBe("pending_review");
    expect(approvalStatusForTask(task({ status: "ready", block_kind: null }))).toBe("ready_for_action");
    expect(approvalStatusForTask(task({ status: "running", block_kind: null }))).toBe("in_progress");
    expect(approvalStatusForTask(task({ status: "blocked", block_kind: "transient" }))).toBe("delayed");
    expect(approvalStatusForTask(task({ status: "done", block_kind: null }))).toBe("approved");
    expect(approvalStatusForTask(task({ status: "cancelled", block_kind: null }))).toBe("rejected");
  });
});
