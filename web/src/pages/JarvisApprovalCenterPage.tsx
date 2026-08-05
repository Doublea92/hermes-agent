import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  History,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  UserRound,
  XCircle,
} from "lucide-react";
import { api, type JarvisOverview } from "@/lib/api";
import {
  approvalStatusLabel,
  buildApprovalRequestRecords,
  type ApprovalRequestRecord,
  type ApprovalRequestStatus,
} from "@/lib/approval-center";
import "./approval-center.css";

const FILTERS: Array<{ id: "all" | ApprovalRequestStatus; label: string }> = [
  { id: "all", label: "All" },
  { id: "waiting_input", label: "Waiting input" },
  { id: "pending_review", label: "Pending review" },
  { id: "ready_for_action", label: "Ready" },
  { id: "in_progress", label: "In progress" },
  { id: "delayed", label: "Delayed" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

function formatTimestamp(value: number | null): string {
  if (!value) return "Timestamp missing";
  return new Date(value * 1000).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusIcon(status: ApprovalRequestStatus) {
  const Icon =
    status === "approved" ? CheckCircle2
    : status === "rejected" ? XCircle
    : status === "delayed" ? Clock3
    : status === "in_progress" ? RefreshCw
    : ShieldAlert;
  return <Icon aria-hidden="true" />;
}

function statusSummary(records: ApprovalRequestRecord[]) {
  return FILTERS.slice(1).map((filter) => ({
    ...filter,
    count: records.filter((record) => record.status === filter.id).length,
  }));
}

function ApprovalCard({ record, selected, onSelect }: { record: ApprovalRequestRecord; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      className={`approval-request-card ${selected ? "is-selected" : ""}`}
      data-risk={record.risk}
      onClick={onSelect}
    >
      <div className="approval-request-card__topline">
        <span>{record.id}</span>
        <strong>{record.risk}</strong>
      </div>
      <h2>{record.title}</h2>
      <div className="approval-request-card__meta">
        <span>
          {statusIcon(record.status)}
          {approvalStatusLabel(record.status)}
        </span>
        <span>{record.product}</span>
      </div>
      <p>{record.exactEffect}</p>
    </button>
  );
}

function ApprovalDetail({ record }: { record: ApprovalRequestRecord }) {
  return (
    <section className="approval-detail-panel" aria-label="Approval request details">
      <div className="approval-detail-header" data-risk={record.risk}>
        <div>
          <span className="approval-eyebrow">Actionable ID</span>
          <h1>{record.id}</h1>
        </div>
        <div className="approval-status-pill">
          {statusIcon(record.status)}
          {approvalStatusLabel(record.status)}
        </div>
      </div>

      <div className="approval-detail-grid">
        <section>
          <span className="approval-eyebrow">Risk</span>
          <strong className="approval-risk-word" data-risk={record.risk}>{record.risk}</strong>
        </section>
        <section>
          <span className="approval-eyebrow">Requester</span>
          <strong><UserRound aria-hidden="true" /> {record.requester}</strong>
        </section>
        <section>
          <span className="approval-eyebrow">Timestamp</span>
          <strong>{formatTimestamp(record.timestamp)}</strong>
        </section>
        <section>
          <span className="approval-eyebrow">Available action</span>
          <Link to={record.href}>{record.availableAction}<ExternalLink aria-hidden="true" /></Link>
        </section>
      </div>

      <section className="approval-copy-block">
        <h2>Exact effect</h2>
        <p>{record.exactEffect}</p>
      </section>

      <section className="approval-copy-block">
        <h2><RotateCcw aria-hidden="true" /> Rollback plan</h2>
        <p>{record.rollbackPlan}</p>
      </section>

      <section className={`approval-validation-block ${record.validationErrors.length ? "has-errors" : ""}`}>
        <h2><AlertTriangle aria-hidden="true" /> Required metadata validation</h2>
        {record.validationErrors.length ? (
          <ul>{record.validationErrors.map((error) => <li key={error}>{error}</li>)}</ul>
        ) : (
          <p>All required approval metadata is present: ID, risk, exact effect, rollback plan, requester, timestamp, status, and action.</p>
        )}
      </section>

      <section className="approval-history-block">
        <h2><History aria-hidden="true" /> Audit history</h2>
        <ol>
          {record.history.map((entry, index) => (
            <li key={`${entry.label}-${entry.timestamp ?? index}`}>
              <span>{entry.label}</span>
              <time>{formatTimestamp(entry.timestamp)}</time>
              <p>{entry.detail}</p>
            </li>
          ))}
        </ol>
      </section>
    </section>
  );
}

export default function JarvisApprovalCenterPage() {
  const [overview, setOverview] = useState<JarvisOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.getJarvisOverview()
      .then((data) => {
        if (cancelled) return;
        setOverview(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load approval requests");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const records = useMemo(() => buildApprovalRequestRecords(overview), [overview]);
  const filtered = filter === "all" ? records : records.filter((record) => record.status === filter);
  const selected = filtered.find((record) => record.id === selectedId) ?? filtered[0] ?? null;

  return (
    <main className="approval-center-page">
      <header className="approval-center-hero">
        <div>
          <span className="approval-eyebrow">Benson approval request center</span>
          <h1>Owner-visible approvals with explicit risk, effect, rollback, and audit metadata.</h1>
          <p>
            Requests are built from the Jarvis product boards and remain navigation-only here: opening an action takes you to the source kanban task for the controlled approval path.
          </p>
        </div>
        <div className="approval-center-hero__stats" aria-label="Approval request status summary">
          {statusSummary(records).map((item) => (
            <span key={item.id}>
              <strong>{item.count}</strong>
              {item.label}
            </span>
          ))}
        </div>
      </header>

      <nav className="approval-center-filters" aria-label="Approval status filters">
        {FILTERS.map((item) => (
          <button key={item.id} type="button" className={filter === item.id ? "is-active" : ""} onClick={() => setFilter(item.id)}>
            {item.label}
          </button>
        ))}
      </nav>

      {loading ? (
        <section className="approval-center-state">Loading approval requests…</section>
      ) : error ? (
        <section className="approval-center-state is-error">{error}</section>
      ) : filtered.length === 0 ? (
        <section className="approval-center-state">No approval requests match this filter. Watch blocked/review kanban tasks for new owner actions.</section>
      ) : (
        <div className="approval-center-layout">
          <aside className="approval-request-list" aria-label="Approval requests">
            {filtered.map((record) => (
              <ApprovalCard key={record.id} record={record} selected={selected?.id === record.id} onSelect={() => setSelectedId(record.id)} />
            ))}
          </aside>
          {selected ? <ApprovalDetail record={selected} /> : null}
        </div>
      )}
    </main>
  );
}
