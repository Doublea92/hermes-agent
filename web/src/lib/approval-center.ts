import type { JarvisOverview, JarvisProduct, JarvisTask } from "@/lib/api";

export type ApprovalRisk = "critical" | "high" | "medium" | "low";
export type ApprovalRequestStatus =
  | "pending_review"
  | "waiting_input"
  | "ready_for_action"
  | "in_progress"
  | "delayed"
  | "rejected"
  | "approved"
  | "unknown";

export interface ApprovalHistoryEntry {
  label: string;
  timestamp: number | null;
  detail: string;
}

export interface ApprovalRequestRecord {
  id: string;
  product: string;
  board: string;
  taskId: string;
  title: string;
  risk: ApprovalRisk;
  exactEffect: string;
  rollbackPlan: string;
  requester: string;
  timestamp: number | null;
  status: ApprovalRequestStatus;
  availableAction: string;
  href: string;
  reason: string | null;
  validationErrors: string[];
  history: ApprovalHistoryEntry[];
}

const REQUIRED_FIELDS: Array<keyof Pick<ApprovalRequestRecord, "id" | "risk" | "exactEffect" | "rollbackPlan" | "requester" | "timestamp" | "status" | "availableAction">> = [
  "id",
  "risk",
  "exactEffect",
  "rollbackPlan",
  "requester",
  "timestamp",
  "status",
  "availableAction",
];

function text(value: unknown): string {
  return String(value ?? "").trim();
}

function hasApprovalSignal(task: JarvisTask): boolean {
  const status = text(task.status).toLowerCase();
  const kind = text(task.block_kind).toLowerCase();
  const action = text(task.attention_action).toLowerCase();
  const reason = text(task.attention_reason).toLowerCase();
  const title = text(task.title).toLowerCase();
  return (
    status === "review" ||
    status === "ready" ||
    kind === "needs_input" ||
    action.includes("answer") ||
    action.includes("review") ||
    reason.includes("approval") ||
    reason.includes("review-required") ||
    title.includes("approve") ||
    title.includes("approval") ||
    title.includes("review")
  );
}

export function approvalStatusForTask(task: JarvisTask): ApprovalRequestStatus {
  const status = text(task.status).toLowerCase();
  const kind = text(task.block_kind).toLowerCase();
  const reason = text(task.attention_reason).toLowerCase();
  if (status === "done" || status === "completed") return "approved";
  if (status === "cancelled" || status === "archived" || reason.includes("rejected")) return "rejected";
  if (status === "blocked" && kind === "needs_input") return "waiting_input";
  if (status === "blocked" && (kind === "transient" || reason.includes("delay") || reason.includes("delayed"))) return "delayed";
  if (status === "review") return "pending_review";
  if (status === "ready") return "ready_for_action";
  if (status === "running") return "in_progress";
  if (status === "blocked") return "waiting_input";
  return "unknown";
}

export function approvalRiskForTask(task: JarvisTask, product: JarvisProduct): ApprovalRisk {
  const haystack = [task.title, task.attention_reason, product.approval_note, product.trust_rule, ...(product.safety_notes ?? [])]
    .map(text)
    .join(" ")
    .toLowerCase();
  if (/production|deploy|payment|subscription|financial|secret|permission|regulatory|regulation|publish/.test(haystack)) return "critical";
  if (/merge|database|source|access|owner|admin|approval/.test(haystack)) return "high";
  if (/review|ready|blocked|rollback|qa/.test(haystack)) return "medium";
  return "low";
}

function rollbackPlanFor(product: JarvisProduct, task: JarvisTask): string {
  const safety = product.safety_notes?.find((item: string) => text(item));
  if (safety) return safety;
  const reason = text(task.attention_reason);
  if (reason.includes("review-required:")) return "Keep the branch/task blocked until review is complete; request changes instead of approving if the exact effect is not acceptable.";
  if (product.approval_note) return `Do not execute the guarded action automatically. Roll back by leaving the task blocked and following ${product.name}'s approval boundary: ${product.approval_note}`;
  return "No rollback metadata was supplied; keep this request blocked until the requester adds a rollback plan.";
}

function exactEffectFor(product: JarvisProduct, task: JarvisTask): string {
  const reason = text(task.attention_reason);
  const title = text(task.title) || "Untitled approval request";
  if (reason) return `${title} — ${reason}`;
  return `${title} on ${product.name}. Open the linked task before acting to verify the exact effect.`;
}

function validate(record: Omit<ApprovalRequestRecord, "validationErrors">): string[] {
  return REQUIRED_FIELDS.flatMap((field) => {
    const value = record[field];
    if (value === null || value === undefined || text(value) === "") return [`Missing ${field}`];
    return [];
  });
}

function recordFromTask(product: JarvisProduct, task: JarvisTask): ApprovalRequestRecord {
  const status = approvalStatusForTask(task);
  const timestamp = task.attention_since ?? task.started_at ?? task.created_at ?? null;
  const record = {
    id: `${product.board.slug}:${task.id}`,
    product: product.name,
    board: product.board.slug,
    taskId: task.id,
    title: text(task.title) || "Untitled approval request",
    risk: approvalRiskForTask(task, product),
    exactEffect: exactEffectFor(product, task),
    rollbackPlan: rollbackPlanFor(product, task),
    requester: text(task.assignee) || "Unassigned requester",
    timestamp,
    status,
    availableAction: text(task.attention_action) || (status === "ready_for_action" ? "Open ready task" : "Open approval task"),
    href: task.task_href || `/plugins/kanban?board=${encodeURIComponent(product.board.slug)}&task=${encodeURIComponent(task.id)}`,
    reason: text(task.attention_reason) || null,
    history: [
      { label: "Created", timestamp: task.created_at ?? null, detail: "Request entered the board." },
      ...(task.started_at ? [{ label: "Started", timestamp: task.started_at, detail: "A worker picked up the task." }] : []),
      ...(timestamp ? [{ label: "Attention needed", timestamp, detail: text(task.attention_reason) || text(task.attention_action) || "Request requires review." }] : []),
      ...(task.completed_at ? [{ label: "Completed", timestamp: task.completed_at, detail: "Task is marked complete." }] : []),
    ],
  } satisfies Omit<ApprovalRequestRecord, "validationErrors">;
  return { ...record, validationErrors: validate(record) };
}

export function buildApprovalRequestRecords(overview: JarvisOverview | null | undefined): ApprovalRequestRecord[] {
  if (!overview) return [];
  const byId = new Map<string, ApprovalRequestRecord>();
  for (const product of overview.products ?? []) {
    const candidates = [
      ...(product.board.review_tasks ?? []),
      ...(product.board.blocked_tasks ?? []),
      ...(product.board.open_tasks ?? []),
      ...(product.approval_summary.examples ?? []),
      ...(product.blocker_summary.examples ?? []),
    ];
    for (const task of candidates) {
      if (!task?.id || !hasApprovalSignal(task)) continue;
      const record = recordFromTask(product, task);
      byId.set(record.id, record);
    }
  }
  return Array.from(byId.values()).sort((a, b) => {
    const riskRank: Record<ApprovalRisk, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return riskRank[a.risk] - riskRank[b.risk] || (a.timestamp ?? 0) - (b.timestamp ?? 0) || a.id.localeCompare(b.id);
  });
}

export function approvalStatusLabel(status: ApprovalRequestStatus): string {
  return {
    approved: "Approved",
    delayed: "Delayed",
    in_progress: "In progress",
    pending_review: "Pending review",
    ready_for_action: "Ready",
    rejected: "Rejected",
    unknown: "Unknown",
    waiting_input: "Waiting input",
  }[status];
}
