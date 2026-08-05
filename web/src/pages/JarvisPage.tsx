/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { GatewayClient } from "@/lib/gatewayClient";
import { api, type JarvisOverview } from "@/lib/api";
import "./jarvis-dashboard.css";
import {
  Accessibility,
  Activity,
  Bot,
  Box,
  CalendarDays,
  Check,
  ChevronRight,
  CircleGauge,
  Clock3,
  Cpu,
  Database,
  FileStack,
  FolderKanban,
  HardDrive,
  LayoutDashboard,
  Mail,
  MemoryStick,
  MessageSquareText,
  Network,
  Orbit,
  Radio,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
  Zap,
} from "lucide-react";

const serviceNodes = [
  { id: "agents", label: "Agents", meta: "6 active", Icon: UsersRound, x: 50, y: 18 },
  { id: "messaging", label: "Messaging", meta: "12 channels", Icon: MessageSquareText, x: 25, y: 34 },
  { id: "automations", label: "Automations", meta: "28 flows", Icon: Workflow, x: 75, y: 34 },
  { id: "calendar", label: "Calendar", meta: "3 upcoming", Icon: CalendarDays, x: 25, y: 68 },
  { id: "files", label: "Files", meta: "42 recent", Icon: FileStack, x: 75, y: 68 },
  { id: "vault", label: "Vault", meta: "12.8k notes", Icon: Database, x: 50, y: 84 },
];

const agentOps = [
  { name: "Builder", task: "Rendering main dashboard", load: 86, tone: "green" },
  { name: "Researcher", task: "Reviewing voice mapping", load: 68, tone: "green" },
  { name: "Planner", task: "Sequencing agent hierarchy", load: 54, tone: "cyan" },
  { name: "Memory", task: "Indexing Obsidian context", load: 47, tone: "cyan" },
  { name: "Monitor", task: "Watching service health", load: 32, tone: "cyan" },
  { name: "Messenger", task: "Waiting for dispatch", load: 12, tone: "muted" },
];

const events = [
  ["10:42:08", "Memory vault synchronized", "green"],
  ["10:41:52", "Builder opened design context", "cyan"],
  ["10:40:16", "Voice core channel connected", "cyan"],
  ["10:38:03", "Approval requested: deployment", "amber"],
];

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Could not read recording"));
    reader.readAsDataURL(blob);
  });
}

function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type)) || "";
}

const VOICE_STAGE_LABELS = {
  idle: "Idle",
  arming: "Arming mic",
  listening: "Listening",
  heard_speech: "Heard speech",
  endpoint: "Silence detected",
  transcribing: "Transcribing",
  thinking: "Thinking",
  using_tool: "Using tool",
  speaking: "Speaking",
  reopening: "Reopening mic",
  paused: "Paused",
  error: "Error",
};

const VOICE_MODE_CONFIG = {
  fast: {
    label: "Fast",
    ack: "On it.",
    maxWords: 35,
    instruction: "Voice-fast mode: answer in one or two short spoken sentences, skip markdown, avoid extra context, and ask at most one follow-up only if needed. If tools are needed, acknowledge briefly first and keep the final answer concise.",
  },
  balanced: {
    label: "Balanced",
    ack: "Let me check.",
    maxWords: 70,
    instruction: "Voice-balanced mode: answer conversationally for speech, use short paragraphs, avoid long markdown, and summarize tool results clearly. Ask one follow-up only when it changes the action.",
  },
  quality: {
    label: "Quality",
    ack: "I’ll take a closer look.",
    maxWords: 120,
    instruction: "Voice-quality mode: use full Benson reasoning and tool depth when helpful, but keep the spoken response organized and concise. Prefer a brief answer first, then key details.",
  },
};

function buildVoicePrompt(transcript, mode) {
  const config = VOICE_MODE_CONFIG[mode] || VOICE_MODE_CONFIG.balanced;
  return `${config.instruction}\nKeep the spoken response under about ${config.maxWords} words unless the user explicitly asks for detail.\n\nUser said: ${transcript}`;
}

const FREE_BENSON_VOICES = [
  { id: "en-US-AriaNeural", label: "Aria", provider: "edge", tone: "current streaming default" },
  { id: "en-US-BrianNeural", label: "Brian", provider: "edge", tone: "warm male" },
  { id: "en-US-AndrewNeural", label: "Andrew", provider: "edge", tone: "calm male" },
  { id: "en-US-GuyNeural", label: "Guy", provider: "edge", tone: "clear male" },
  { id: "en-US-ChristopherNeural", label: "Christopher", provider: "edge", tone: "deep male" },
  { id: "en-US-SteffanNeural", label: "Steffan", provider: "edge", tone: "polished male" },
];

function voiceNow() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

function summarizeVoiceTrace(events) {
  if (!events.length) return { total_ms: 0, stages: [], p50_ms: 0, p90_ms: 0, p95_ms: 0 };
  const first = events[0].at;
  const last = events[events.length - 1].at;
  const deltas = events.slice(1).map((event, index) => Math.max(0, Math.round(event.at - events[index].at)));
  const sorted = [...deltas].sort((a, b) => a - b);
  const pick = (p) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * p))] : 0;
  return {
    total_ms: Math.max(0, Math.round(last - first)),
    stages: events.slice(-8).map((event) => ({ ...event, elapsed_ms: Math.max(0, Math.round(event.at - first)) })),
    p50_ms: pick(0.5),
    p90_ms: pick(0.9),
    p95_ms: pick(0.95),
  };
}

function formatLatency(ms) {
  const value = Number(ms) || 0;
  return value >= 1000 ? `${(value / 1000).toFixed(1)}s` : `${Math.round(value)}ms`;
}

function formatCount(value, fallback = "0") {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString() : fallback;
}

function formatPercent(value, fallback = 0) {
  const number = Number(value);
  return Math.max(0, Math.min(100, Number.isFinite(number) ? Math.round(number) : fallback));
}

function overviewStatusTone(status) {
  if (status === "available" || status === "ok" || status === "healthy") return "green";
  if (status === "setup_needed" || status === "unknown") return "amber";
  return "red";
}

function liveServiceNodes(overview) {
  const agentStatus = overview?.agent_status;
  const memory = overview?.memory_vault?.obsidian;
  const cron = overview?.service_health?.cron;
  return serviceNodes.map((node) => {
    if (node.id === "agents") return { ...node, meta: `${formatCount(agentStatus?.active_agents)} active` };
    if (node.id === "messaging") return { ...node, meta: `${formatCount(agentStatus?.connected_platforms)}/${formatCount(agentStatus?.configured_platforms)} connected` };
    if (node.id === "automations") return { ...node, meta: `${formatCount(cron?.enabled)} enabled` };
    if (node.id === "files") return { ...node, meta: `${formatCount(memory?.recent_notes?.length)} recent` };
    if (node.id === "vault") return { ...node, meta: `${formatCount(memory?.note_count)} notes` };
    return node;
  });
}

function liveEvents(overview) {
  if (!overview) return events;
  const generated = overview.generated_at ? new Date(overview.generated_at) : null;
  const stamp = generated && !Number.isNaN(generated.getTime()) ? generated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "Live";
  const memory = overview.memory_vault?.obsidian;
  return [
    [stamp, memory?.message || "Jarvis overview synchronized", overviewStatusTone(memory?.status)],
    [stamp, `${formatCount(overview.todos?.length)} owner tasks loaded`, overview.todos?.length ? "amber" : "green"],
    [stamp, `${formatCount(overview.service_health?.cron?.enabled)} automations enabled`, "cyan"],
    [stamp, `${formatCount(overview.agent_status?.active_sessions)} active sessions`, "cyan"],
  ];
}

function liveAgentOps(overview) {
  const profiles = overview?.agent_status?.profiles || [];
  if (!profiles.length) return agentOps;
  return profiles.slice(0, 6).map((profile) => {
    const open = Number(profile.open_count || 0);
    const blocked = Number(profile.blocked_count || 0);
    const load = Math.max(8, Math.min(96, open * 12 + blocked * 18));
    return {
      name: profile.name,
      task: profile.needs_attention
        ? `${formatCount(blocked)} blocked / ${formatCount(open)} open`
        : profile.role || profile.state || "Monitoring",
      load,
      tone: profile.needs_attention ? "amber" : open ? "green" : "cyan",
    };
  });
}

function voiceEnvelope(time) {
  const seconds = time * 0.001;
  const phrase = Math.max(0, Math.sin(seconds * 0.92) * 0.72 + Math.sin(seconds * 2.3) * 0.22);
  const syllables = Math.abs(Math.sin(seconds * 7.1) * 0.62 + Math.sin(seconds * 11.8) * 0.25);
  const amplitude = Math.min(1, phrase * (0.42 + syllables));
  return {
    amplitude,
    low: Math.min(1, amplitude * 1.14 + Math.abs(Math.sin(seconds * 3.1)) * 0.12),
    mid: Math.min(1, amplitude * 0.9 + Math.abs(Math.sin(seconds * 8.7)) * 0.18),
    high: Math.min(1, amplitude * 0.68 + Math.abs(Math.sin(seconds * 15.3)) * 0.16),
  };
}

function VoiceCoreField({ speaking, activeNode, onSelectNode, onToggleSpeaking, nodes = serviceNodes, reducedMotion = false }) {
  const canvasRef = useRef(null);
  const stageRef = useRef(null);
  const externalFrame = useRef(null);

  useEffect(() => {
    const handleFrame = (event) => {
      const frame = event.detail || {};
      externalFrame.current = {
        amplitude: Math.max(0, Math.min(1, Number(frame.amplitude) || 0)),
        low: Math.max(0, Math.min(1, Number(frame.low) || 0)),
        mid: Math.max(0, Math.min(1, Number(frame.mid) || 0)),
        high: Math.max(0, Math.min(1, Number(frame.high) || 0)),
        receivedAt: performance.now(),
      };
    };
    window.addEventListener("jarvis:voice-frame", handleFrame);
    return () => window.removeEventListener("jarvis:voice-frame", handleFrame);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return undefined;

    const context = canvas.getContext("2d");
    const reduceMotion = reducedMotion || window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let ratio = 1;
    let frameId = 0;
    let lastDraw = 0;

    const resize = () => {
      const bounds = stage.getBoundingClientRect();
      ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(stage);
    resize();

    const drawArc = (cx, cy, radius, start, length, alpha, lineWidth = 1) => {
      context.beginPath();
      context.arc(cx, cy, radius, start, start + length);
      context.strokeStyle = `rgba(87, 218, 255, ${alpha})`;
      context.lineWidth = lineWidth;
      context.stroke();
    };

    const draw = (time) => {
      if (time - lastDraw < 32) {
        frameId = window.requestAnimationFrame(draw);
        return;
      }
      lastDraw = time;
      context.clearRect(0, 0, width, height);

      const center = { x: width * 0.5, y: height * 0.475 };
      const base = Math.min(width, height);
      const realFrame = externalFrame.current;
      const realIsFresh = realFrame && time - realFrame.receivedAt < 260;
      const signal = realIsFresh
        ? realFrame
        : speaking && !reduceMotion
          ? voiceEnvelope(time)
          : { amplitude: 0.035, low: 0.03, mid: 0.025, high: 0.02 };

      const amplitude = signal.amplitude;
      const low = signal.low;
      const mid = signal.mid;
      const high = signal.high;

      context.save();
      context.strokeStyle = "rgba(83, 206, 242, .09)";
      context.lineWidth = 1;
      for (let ring = 0; ring < 5; ring += 1) {
        context.beginPath();
        context.ellipse(
          center.x,
          center.y,
          base * (0.19 + ring * 0.078),
          base * (0.14 + ring * 0.055),
          0,
          0,
          Math.PI * 2,
        );
        context.stroke();
      }

      nodes.forEach((node, index) => {
        const point = { x: width * node.x * 0.01, y: height * node.y * 0.01 };
        const selected = node.id === activeNode;
        const curve = (index % 2 ? -1 : 1) * height * 0.055;
        context.beginPath();
        context.moveTo(center.x, center.y);
        context.bezierCurveTo(
          center.x + (point.x - center.x) * 0.3,
          center.y + curve,
          center.x + (point.x - center.x) * 0.72,
          point.y - curve,
          point.x,
          point.y,
        );
        context.strokeStyle = selected ? "rgba(144, 236, 255, .58)" : "rgba(71, 194, 231, .16)";
        context.lineWidth = selected ? 1.6 : 0.85;
        context.stroke();

        const packet = reduceMotion ? 0.54 : (time * 0.00005 + index * 0.158) % 1;
        const inv = 1 - packet;
        const p1x = center.x + (point.x - center.x) * 0.3;
        const p1y = center.y + curve;
        const p2x = center.x + (point.x - center.x) * 0.72;
        const p2y = point.y - curve;
        const px =
          inv ** 3 * center.x +
          3 * inv ** 2 * packet * p1x +
          3 * inv * packet ** 2 * p2x +
          packet ** 3 * point.x;
        const py =
          inv ** 3 * center.y +
          3 * inv ** 2 * packet * p1y +
          3 * inv * packet ** 2 * p2y +
          packet ** 3 * point.y;
        context.beginPath();
        context.arc(px, py, selected ? 2.7 : 1.5, 0, Math.PI * 2);
        context.fillStyle = selected ? "rgba(198, 246, 255, .92)" : "rgba(88, 217, 255, .52)";
        context.shadowColor = "#56d8ff";
        context.shadowBlur = selected ? 12 : 5;
        context.fill();
        context.shadowBlur = 0;
      });
      context.restore();

      context.save();
      context.shadowColor = "#50d8ff";
      context.shadowBlur = 9 + amplitude * 16;
      for (let orbit = 0; orbit < 3; orbit += 1) {
        context.beginPath();
        context.ellipse(
          center.x,
          center.y,
          base * (0.28 + orbit * 0.085),
          base * (0.19 + orbit * 0.055),
          orbit === 1 ? 0.03 : -0.03,
          0.24 + orbit * 0.46,
          Math.PI * (1.62 + orbit * 0.08),
        );
        context.strokeStyle = `rgba(75, 210, 250, ${0.17 + mid * 0.15})`;
        context.lineWidth = orbit === 1 ? 1.35 : 0.9;
        context.stroke();
      }
      context.restore();

      const glow = context.createRadialGradient(
        center.x,
        center.y,
        0,
        center.x,
        center.y,
        base * (0.19 + amplitude * 0.032),
      );
      glow.addColorStop(0, `rgba(223, 251, 255, ${0.92 + amplitude * 0.08})`);
      glow.addColorStop(0.12, `rgba(100, 224, 255, ${0.68 + amplitude * 0.2})`);
      glow.addColorStop(0.45, `rgba(34, 158, 215, ${0.18 + low * 0.22})`);
      glow.addColorStop(1, "rgba(10, 74, 104, 0)");
      context.fillStyle = glow;
      context.beginPath();
      context.arc(center.x, center.y, base * (0.19 + amplitude * 0.032), 0, Math.PI * 2);
      context.fill();

      context.save();
      context.translate(center.x, center.y);
      for (let ring = 0; ring < 7; ring += 1) {
        const radius = base * (0.085 + ring * 0.022) + low * (ring + 1) * 1.8;
        const segments = 8 + ring * 2;
        for (let segment = 0; segment < segments; segment += 1) {
          if ((segment + ring) % 4 === 0) continue;
          const start =
            (Math.PI * 2 * segment) / segments +
            (reduceMotion ? 0 : time * 0.000035 * (ring % 2 ? -1 : 1));
          const length = (Math.PI * 2) / segments * (0.5 + mid * 0.25);
          drawArc(0, 0, radius, start, length, 0.13 + ring * 0.025 + mid * 0.16, ring % 3 === 0 ? 1.4 : 0.8);
        }
      }
      context.restore();

      context.save();
      const coreRadius = base * (0.058 + low * 0.012);
      context.shadowColor = "#8beaff";
      context.shadowBlur = 22 + amplitude * 26;
      const core = context.createRadialGradient(
        center.x - coreRadius * 0.22,
        center.y - coreRadius * 0.26,
        1,
        center.x,
        center.y,
        coreRadius,
      );
      core.addColorStop(0, "#f5feff");
      core.addColorStop(0.2, "#b7f4ff");
      core.addColorStop(0.62, "#46caef");
      core.addColorStop(1, "rgba(9, 92, 133, .45)");
      context.fillStyle = core;
      context.beginPath();
      context.arc(center.x, center.y, coreRadius, 0, Math.PI * 2);
      context.fill();
      context.restore();

      const particleCount = 78;
      for (let index = 0; index < particleCount; index += 1) {
        const angle = index * 2.39996 + (reduceMotion ? 0 : time * 0.000015 * (index % 2 ? -1 : 1));
        const band = (index % 9) / 9;
        const radius = base * (0.086 + band * 0.145) + high * (10 + (index % 7) * 2.4);
        const x = center.x + Math.cos(angle) * radius;
        const y = center.y + Math.sin(angle) * radius * 0.72;
        context.beginPath();
        context.arc(x, y, index % 11 === 0 ? 2.1 : 1.05, 0, Math.PI * 2);
        context.fillStyle = `rgba(129, 231, 255, ${0.16 + high * 0.48})`;
        context.fill();
      }

      frameId = window.requestAnimationFrame(draw);
    };

    frameId = window.requestAnimationFrame(draw);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [activeNode, speaking, nodes, reducedMotion]);

  return (
    <div className="core-stage" ref={stageRef}>
      <canvas ref={canvasRef} aria-hidden="true" />
      <button
        className={`voice-core ${speaking ? "is-speaking" : ""}`}
        type="button"
        onClick={onToggleSpeaking}
        aria-pressed={speaking}
        aria-label="Toggle Jarvis open voice conversation"
      >
        <span>Hermes Core</span>
        <strong>{speaking ? "Speaking" : "Active"}</strong>
        <small>{speaking ? "Voice synchronized" : "Voice channel ready"}</small>
      </button>

      {nodes.map(({ id, label, meta, Icon, x, y }) => (
        <button
          key={id}
          type="button"
          className={`service-node ${activeNode === id ? "is-active" : ""}`}
          style={{ left: `${x}%`, top: `${y}%` }}
          onClick={() => onSelectNode(id)}
          aria-pressed={activeNode === id}
        >
          <span>
            <Icon aria-hidden="true" />
          </span>
          <strong>{label}</strong>
          <small>{meta}</small>
        </button>
      ))}
    </div>
  );
}

function DashboardNav() {
  const items = [
    ["Dashboard", LayoutDashboard, "/jarvis"],
    ["Memory", Network, "/jarvis/memory"],
    ["Agents", UsersRound, "/jarvis/agents"],
    ["Automations", Zap, "#automations"],
    ["Vault", Box, "/jarvis/memory"],
    ["Settings", Settings2, "#settings"],
  ];

  return (
    <nav className="dashboard-nav" aria-label="Primary navigation">
      {items.map(([label, Icon, href]) => (
        <Link key={label} to={href} className={label === "Dashboard" ? "is-current" : ""}>
          <Icon aria-hidden="true" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

export default function JarvisPage() {
  const [speaking, setSpeaking] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Open activation ready");
  const [listening, setListening] = useState(false);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [voiceReply, setVoiceReply] = useState("");
  const [voicePhase, setVoicePhase] = useState("idle");
  const [voiceMode, setVoiceMode] = useState("fast");
  const [selectedVoice, setSelectedVoice] = useState(FREE_BENSON_VOICES[0]);
  const [voicePreviewing, setVoicePreviewing] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [voiceTraceSummary, setVoiceTraceSummary] = useState(() => summarizeVoiceTrace([]));
  const [backendVoicePerf, setBackendVoicePerf] = useState(null);
  const [voiceTurns, setVoiceTurns] = useState([]);
  const [wakePhrase, setWakePhrase] = useState("benson");
  const [requireWakePhrase, setRequireWakePhrase] = useState(false);
  const [voiceTurnCount, setVoiceTurnCount] = useState(0);
  const [activeNode, setActiveNode] = useState("agents");
  const [approvalResolved, setApprovalResolved] = useState(false);
  const [synced, setSynced] = useState(false);
  const [overview, setOverview] = useState<JarvisOverview | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => {
    const saved = window.localStorage.getItem("benson-reduced-motion");
    return saved === "true" || (saved === null && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  });
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const voiceGatewayRef = useRef<GatewayClient | null>(null);
  const voiceSessionIdRef = useRef("");
  const voiceReplyBufferRef = useRef("");
  const conversationActiveRef = useRef(false);
  const analyserFrameRef = useRef<number | null>(null);
  const autoRestartTimerRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const voiceTraceRef = useRef([]);
  const voiceTurnIdRef = useRef(0);
  const voiceSettingsRef = useRef({ silenceMs: 1300, speechThreshold: 7, maxTurnMs: 12000, reopenMs: 450 });
  const activeResponseTurnRef = useRef(0);
  const ttsStreamRef = useRef(null);
  const ackAudioRef = useRef<HTMLAudioElement | null>(null);
  const wakeLockRef = useRef(null);

  const recordVoiceMark = (stage, detail = "") => {
    const at = voiceNow();
    if (stage === "capture_start") {
      voiceTraceRef.current = [];
      voiceTurnIdRef.current += 1;
      setVoiceTurnCount(voiceTurnIdRef.current);
    }
    voiceTraceRef.current = [
      ...voiceTraceRef.current,
      { turn_id: voiceTurnIdRef.current, stage, detail, at },
    ];
    const summary = summarizeVoiceTrace(voiceTraceRef.current);
    setVoiceTraceSummary(summary);
    window.dispatchEvent(new CustomEvent("jarvis:voice-latency", { detail: summary }));
  };

  const appendVoiceTurn = (role, text) => {
    const clean = String(text || "").trim();
    if (!clean) return;
    setVoiceTurns((turns) => [
      ...turns.slice(-5),
      { id: `${voiceTurnIdRef.current}-${role}-${voiceNow()}`, role, text: clean },
    ]);
  };

  const requestScreenWakeLock = async () => {
    if (!navigator.wakeLock?.request || wakeLockRef.current) return;
    try {
      wakeLockRef.current = await navigator.wakeLock.request("screen");
      recordVoiceMark("wake_lock_acquired");
      wakeLockRef.current.addEventListener?.("release", () => {
        wakeLockRef.current = null;
      });
    } catch {
      recordVoiceMark("wake_lock_unavailable");
    }
  };

  const releaseScreenWakeLock = () => {
    void wakeLockRef.current?.release?.();
    wakeLockRef.current = null;
  };

  const transcriptHasWakePhrase = (transcript) => {
    const phrase = wakePhrase.trim().toLowerCase();
    if (!requireWakePhrase || !phrase) return true;
    return transcript.toLowerCase().includes(phrase);
  };

  const selectedVoiceOptions = () => ({ provider: selectedVoice.provider, voice: selectedVoice.id });

  const previewSelectedVoice = async () => {
    setVoicePreviewing(true);
    setVoiceStatus(`Previewing ${selectedVoice.label}…`);
    recordVoiceMark("voice_preview_start", selectedVoice.id);
    try {
      const response = await api.speakText(`Benson voice preview using ${selectedVoice.label}. I am ready in the Jarvis dashboard.`, selectedVoiceOptions());
      voiceAudioRef.current?.pause();
      const audio = new Audio(response.data_url);
      voiceAudioRef.current = audio;
      audio.onended = () => setVoicePreviewing(false);
      recordVoiceMark("voice_preview_playback", selectedVoice.id);
      await audio.play();
    } catch (error) {
      setVoicePreviewing(false);
      setVoiceStatus(error instanceof Error ? `Voice preview failed: ${error.message}` : "Voice preview failed");
      recordVoiceMark("voice_preview_failed", selectedVoice.id);
    }
  };

  useEffect(() => () => {
    conversationActiveRef.current = false;
    voiceAudioRef.current?.pause();
    ackAudioRef.current?.pause();
    ttsStreamRef.current?.stop?.();
    if (recorderRef.current?.state && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    recorderStreamRef.current?.getTracks().forEach((track) => track.stop());
    if (analyserFrameRef.current) window.cancelAnimationFrame(analyserFrameRef.current);
    if (autoRestartTimerRef.current) window.clearTimeout(autoRestartTimerRef.current);
    void audioContextRef.current?.close();
    releaseScreenWakeLock();
    voiceGatewayRef.current?.close();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadOverview = async () => {
      try {
        const nextOverview = await api.getJarvisOverview();
        if (!cancelled) {
          setOverview(nextOverview);
          setOverviewError(null);
        }
      } catch (error) {
        if (!cancelled) setOverviewError(error instanceof Error ? error.message : "Overview unavailable");
      }
    };
    void loadOverview();
    const interval = window.setInterval(loadOverview, Math.max(15, overview?.refresh_after_seconds || 15) * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [overview?.refresh_after_seconds]);

  useEffect(() => {
    let cancelled = false;
    const loadBackendVoicePerf = async () => {
      try {
        const metrics = await api.getAudioPerformance();
        if (!cancelled) setBackendVoicePerf(metrics);
      } catch {
        if (!cancelled) setBackendVoicePerf(null);
      }
    };
    void loadBackendVoicePerf();
    const interval = window.setInterval(loadBackendVoicePerf, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const memoryVault = overview?.memory_vault?.obsidian;
  const serviceHealth = overview?.service_health;
  const agentStatus = overview?.agent_status;
  const diskPercent = formatPercent(serviceHealth?.system?.disk_percent, memoryVault?.configured ? 45 : 0);
  const cpuPercent = formatPercent(serviceHealth?.system?.cpu_percent, 0);
  const ramPercent = formatPercent(serviceHealth?.system?.memory_percent, 0);
  const networkHealth = serviceHealth?.system?.network;
  const gatewayState = serviceHealth?.gateway?.state || agentStatus?.gateway_state || "unknown";
  const dashboardState = overviewError ? "error" : serviceHealth?.dashboard?.status || (overview ? "ok" : "loading");
  const memoryStatus = overviewError ? "Unavailable" : memoryVault?.status === "setup_needed" ? "Setup needed" : memoryVault?.status === "available" ? "Healthy" : "Loading";
  const memoryTone = overviewError || memoryVault?.status === "unavailable" ? "red" : memoryVault?.status === "setup_needed" ? "amber" : "green";
  const activeAgentCount = agentStatus?.active_agents ?? 0;
  const queuedTaskCount = overview?.todos?.length ?? 0;
  const approvalCount = (overview?.todos || []).filter((task) => task.attention_action || task.block_kind === "needs_input").length;
  const liveNodes = liveServiceNodes(overview);
  const dashboardEvents = liveEvents(overview);
  const dashboardAgents = liveAgentOps(overview);
  const backendPerfSummary = backendVoicePerf?.summary || {};
  const backendPerfStages = ["/api/audio/transcribe:total", "/api/audio/transcribe:stt_provider", "/api/audio/speak-stream:first_chunk", "/api/audio/speak-stream:total", "/api/audio/speak:total", "/api/audio/speak:tts_provider"];

  const sync = () => {
    setSynced(true);
    window.setTimeout(() => setSynced(false), 1000);
  };

  const createStreamingTtsSpeaker = async (responseTurn) => {
    if (selectedVoice.id !== "en-US-AriaNeural") {
      recordVoiceMark("tts_stream_skipped_for_voice", selectedVoice.id);
      return null;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx || typeof WebSocket === "undefined") return null;

    const ctx = new AudioCtx();
    const url = await api.buildWsUrl("/api/audio/speak-stream");
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    let sampleRate = 24000;
    let nextStart = 0;
    let firstChunk = true;
    let firstText = true;
    let fallback = false;
    let ended = false;

    const opened = new Promise((resolve) => {
      ws.onopen = () => resolve(true);
      ws.onerror = () => resolve(false);
    });

    const finishPlayback = () => {
      if (responseTurn !== activeResponseTurnRef.current) return;
      const waitMs = Math.max(0, (nextStart - ctx.currentTime) * 1000) + 60;
      window.setTimeout(() => {
        if (responseTurn !== activeResponseTurnRef.current) return;
        setSpeaking(false);
        setVoicePhase("reopening");
        setVoiceStatus("Benson is listening again…");
        recordVoiceMark("playback_end", "stream");
        void ctx.close();
        if (conversationActiveRef.current) {
          autoRestartTimerRef.current = window.setTimeout(() => startBrowserListening(true), voiceSettingsRef.current.reopenMs);
        }
      }, waitMs);
    };

    ws.onmessage = (event) => {
      if (responseTurn !== activeResponseTurnRef.current) return;
      if (typeof event.data === "string") {
        const message = JSON.parse(event.data || "{}");
        if (message.type === "fallback") {
          fallback = true;
          recordVoiceMark("tts_stream_fallback");
          ws.close();
        } else if (message.type === "start") {
          sampleRate = Number(message.sample_rate || sampleRate);
          recordVoiceMark("tts_stream_start", `${sampleRate}hz`);
        } else if (message.type === "end") {
          ended = true;
          recordVoiceMark("tts_done", "stream");
          finishPlayback();
        }
        return;
      }

      const pcm = new Int16Array(event.data);
      if (!pcm.length) return;
      const buffer = ctx.createBuffer(1, pcm.length, sampleRate);
      const channel = buffer.getChannelData(0);
      for (let i = 0; i < pcm.length; i += 1) channel[i] = Math.max(-1, Math.min(1, pcm[i] / 32768));
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      const startAt = Math.max(ctx.currentTime + 0.02, nextStart || ctx.currentTime + 0.02);
      source.start(startAt);
      nextStart = startAt + buffer.duration;
      if (firstChunk) {
        firstChunk = false;
        ackAudioRef.current?.pause();
        ackAudioRef.current = null;
        setSpeaking(true);
        setVoicePhase("speaking");
        setVoiceStatus("Benson streaming response…");
        recordVoiceMark("playback_start", "stream");
      }
    };

    const stop = () => {
      activeResponseTurnRef.current += 1;
      try { ws.send(JSON.stringify({ stop: true })); } catch { /* best-effort shutdown */ }
      try { ws.close(); } catch { /* best-effort shutdown */ }
      void ctx.close();
    };

    return {
      sendText: async (text) => {
        const ok = await opened;
        if (!ok || fallback || ended || ws.readyState !== WebSocket.OPEN) return false;
        if (firstText) {
          firstText = false;
          recordVoiceMark("tts_start", "stream");
        }
        ws.send(JSON.stringify({ text }));
        return true;
      },
      done: async () => {
        const ok = await opened;
        if (!ok || fallback || ended || ws.readyState !== WebSocket.OPEN) return false;
        ws.send(JSON.stringify({ done: true }));
        return true;
      },
      stop,
      isFallback: () => fallback,
    };
  };

  const playThinkingAcknowledgment = (responseTurn) => {
    const ackText = (VOICE_MODE_CONFIG[voiceMode] || VOICE_MODE_CONFIG.balanced).ack;
    recordVoiceMark("ack_tts_start", ackText);
    void api.speakText(ackText, selectedVoiceOptions()).then((response) => {
      if (responseTurn !== activeResponseTurnRef.current || voiceReplyBufferRef.current) return;
      recordVoiceMark("ack_tts_done", response.provider || "");
      ackAudioRef.current?.pause();
      const audio = new Audio(response.data_url);
      ackAudioRef.current = audio;
      audio.onended = () => {
        if (ackAudioRef.current === audio) ackAudioRef.current = null;
      };
      recordVoiceMark("ack_playback_start");
      return audio.play();
    }).catch(() => recordVoiceMark("ack_failed"));
  };

  const speakFinalResponseFallback = (text, responseTurn) => {
    recordVoiceMark("tts_start", `${text.split(/\s+/).length} words`);
    void api.speakText(text, selectedVoiceOptions()).then((response) => {
      if (responseTurn !== activeResponseTurnRef.current) return;
      recordVoiceMark("tts_done", response.provider || "");
      ackAudioRef.current?.pause();
      voiceAudioRef.current?.pause();
      const audio = new Audio(response.data_url);
      voiceAudioRef.current = audio;
      audio.onended = () => {
        if (responseTurn !== activeResponseTurnRef.current) return;
        if (voiceAudioRef.current === audio) voiceAudioRef.current = null;
        setSpeaking(false);
        setVoicePhase("reopening");
        setVoiceStatus("Benson is listening again…");
        recordVoiceMark("playback_end");
        if (conversationActiveRef.current) {
          autoRestartTimerRef.current = window.setTimeout(() => startBrowserListening(true), voiceSettingsRef.current.reopenMs);
        }
      };
      audio.onerror = () => {
        setSpeaking(false);
        setVoiceStatus("Benson replied, but browser playback failed");
      };
      setSpeaking(true);
      recordVoiceMark("playback_start");
      return audio.play();
    }).catch((error) => {
      setSpeaking(false);
      setVoicePhase("error");
      setVoiceStatus(error instanceof Error ? `Benson reply playback error: ${error.message}` : "Benson reply playback error");
      recordVoiceMark("error", error instanceof Error ? error.message : "tts_or_playback_failed");
    });
  };

  const ensureVoiceGateway = async () => {
    if (!voiceGatewayRef.current) {
      const gw = new GatewayClient();
      voiceGatewayRef.current = gw;
      gw.on("message.delta", (event) => {
        const text = event.payload?.text || "";
        if (text) {
          if (!voiceReplyBufferRef.current) recordVoiceMark("llm_first_delta");
          voiceReplyBufferRef.current += text;
          void ttsStreamRef.current?.sendText?.(text);
        }
      });
      gw.on("message.complete", (event) => {
        const text = String(event.payload?.text || voiceReplyBufferRef.current || "").trim();
        voiceReplyBufferRef.current = "";
        if (!text) return;
        setVoiceReply(text);
        appendVoiceTurn("benson", text);
        setVoicePhase("speaking");
        setVoiceStatus("Benson replied — speaking response…");
        const responseTurn = activeResponseTurnRef.current;
        recordVoiceMark("llm_complete");
        void (async () => {
          const streamed = await ttsStreamRef.current?.done?.();
          if (!streamed || ttsStreamRef.current?.isFallback?.()) {
            ttsStreamRef.current = null;
            speakFinalResponseFallback(text, responseTurn);
          }
        })();
      });
      gw.on("error", (event) => {
        const message = event.payload?.message || "Benson voice gateway error";
        setVoiceStatus(message);
      });
      await gw.connect();
    }

    if (!voiceSessionIdRef.current) {
      const session = await voiceGatewayRef.current.request("session.create", {
        close_on_disconnect: true,
        source: "jarvis_browser_voice",
      });
      voiceSessionIdRef.current = String(session.session_id || "");
    }
    return voiceGatewayRef.current;
  };

  const interruptAssistantSpeech = () => {
    activeResponseTurnRef.current += 1;
    if (autoRestartTimerRef.current) window.clearTimeout(autoRestartTimerRef.current);
    ttsStreamRef.current?.stop?.();
    ttsStreamRef.current = null;
    ackAudioRef.current?.pause();
    ackAudioRef.current = null;
    voiceAudioRef.current?.pause();
    voiceAudioRef.current = null;
    setSpeaking(false);
    setVoicePhase("listening");
    setVoiceStatus("Barge-in detected — listening now…");
    recordVoiceMark("barge_in_interrupt");
  };

  const submitVoiceTranscript = async (text) => {
    const transcript = String(text || "").trim();
    if (!transcript) {
      setVoicePhase("listening");
      setVoiceStatus("I did not catch speech. Try again closer to the mic.");
      recordVoiceMark("empty_transcript");
      return;
    }
    if (!transcriptHasWakePhrase(transcript)) {
      setVoicePhase("reopening");
      setVoiceTranscript(transcript);
      setVoiceStatus(`Wake phrase "${wakePhrase}" not heard — staying ready.`);
      recordVoiceMark("wake_phrase_skipped", transcript.slice(0, 80));
      if (conversationActiveRef.current) autoRestartTimerRef.current = window.setTimeout(() => startBrowserListening(true), voiceSettingsRef.current.reopenMs);
      return;
    }
    setVoicePhase("thinking");
    setVoiceTranscript(transcript);
    appendVoiceTurn("you", transcript);
    setVoiceReply("");
    setVoiceStatus("Sending your voice to Benson…");
    voiceReplyBufferRef.current = "";
    const gw = await ensureVoiceGateway();
    ttsStreamRef.current?.stop?.();
    activeResponseTurnRef.current = voiceTurnIdRef.current;
    const responseTurn = activeResponseTurnRef.current;
    ttsStreamRef.current = await createStreamingTtsSpeaker(responseTurn);
    playThinkingAcknowledgment(responseTurn);
    const routedPrompt = buildVoicePrompt(transcript, voiceMode);
    recordVoiceMark("voice_mode", voiceMode);
    recordVoiceMark("llm_submit_start", transcript.slice(0, 80));
    await gw.request("prompt.submit", {
      session_id: voiceSessionIdRef.current,
      text: routedPrompt,
    });
    recordVoiceMark("llm_submit_done");
  };

  const stopRecordingForSubmit = () => {
    if (analyserFrameRef.current) {
      window.cancelAnimationFrame(analyserFrameRef.current);
      analyserFrameRef.current = null;
    }
    if (recorderRef.current?.state && recorderRef.current.state !== "inactive") {
      setVoicePhase("transcribing");
      setVoiceStatus("Transcribing your voice…");
      recordVoiceMark("recording_finalized");
      recorderRef.current.stop();
    }
  };

  const startBrowserListening = async (auto = false) => {
    if (recorderRef.current?.state && recorderRef.current.state !== "inactive") return;

    if (!window.isSecureContext) {
      setVoicePhase("error");
      setVoiceStatus("Mic requires HTTPS. Open the dashboard on https://<pi-ip>:9443/jarvis.");
      recordVoiceMark("error", "insecure_context");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setVoicePhase("error");
      setVoiceStatus("This browser does not expose microphone recording APIs.");
      recordVoiceMark("error", "missing_media_recorder");
      return;
    }

    try {
      setVoicePhase("arming");
      recordVoiceMark("capture_start", auto ? "auto" : "manual");
      voiceAudioRef.current?.pause();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recordVoiceMark("mic_ready");
      recorderStreamRef.current = stream;
      const chunks = [];
      const mimeType = pickRecorderMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onstop = async () => {
        setListening(false);
        if (analyserFrameRef.current) {
          window.cancelAnimationFrame(analyserFrameRef.current);
          analyserFrameRef.current = null;
        }
        stream.getTracks().forEach((track) => track.stop());
        recorderStreamRef.current = null;
        recorderRef.current = null;
        void audioContextRef.current?.close();
        audioContextRef.current = null;
        try {
          const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || "audio/webm" });
          if (!blob.size) {
            setVoicePhase("listening");
            setVoiceStatus("Open mic heard silence — listening again…");
            recordVoiceMark("empty_recording");
            if (conversationActiveRef.current) autoRestartTimerRef.current = window.setTimeout(() => startBrowserListening(true), 500);
            return;
          }
          const dataUrl = await blobToDataUrl(blob);
          recordVoiceMark("stt_start", `${Math.round(blob.size / 1024)}KB`);
          const result = await api.transcribeAudio(dataUrl, blob.type);
          recordVoiceMark("stt_done", result.provider || "");
          await submitVoiceTranscript(result.transcript);
        } catch (error) {
          setVoicePhase("error");
          setVoiceStatus(error instanceof Error ? `Benson could not hear you: ${error.message}` : "Benson could not hear you");
          recordVoiceMark("error", error instanceof Error ? error.message : "stt_failed");
          if (conversationActiveRef.current) autoRestartTimerRef.current = window.setTimeout(() => startBrowserListening(true), 1200);
        }
      };
      recorder.start();
      setListening(true);
      setSpeaking(false);
      setVoicePhase("listening");
      setVoiceStatus(auto ? "Open mic listening…" : "Open activation listening… pause to send");

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        const levels = new Uint8Array(analyser.fftSize);
        let heardVoice = false;
        let quietSince = 0;
        // Voice endpoint timing begins in this user-triggered async callback, not during render.
        // eslint-disable-next-line react-hooks/purity
        const startedAt = performance.now();
        const watchSilence = () => {
          analyser.getByteTimeDomainData(levels);
          let sum = 0;
          for (const value of levels) {
            const centered = value - 128;
            sum += centered * centered;
          }
          const rms = Math.sqrt(sum / levels.length);
          const settings = voiceSettingsRef.current;
          const normalized = Math.min(1, rms / 32);
          setMicLevel(normalized);
          window.dispatchEvent(new CustomEvent("jarvis:voice-frame", {
            detail: { amplitude: normalized, low: normalized, mid: normalized * 0.82, high: normalized * 0.64 },
          }));
          const now = performance.now();
          if (rms > settings.speechThreshold) {
            if (!heardVoice) recordVoiceMark("speech_detected", `rms=${rms.toFixed(1)}`);
            heardVoice = true;
            setVoicePhase("heard_speech");
            quietSince = 0;
          } else if (heardVoice) {
            quietSince ||= now;
          }
          if ((heardVoice && quietSince && now - quietSince > settings.silenceMs) || now - startedAt > settings.maxTurnMs) {
            recordVoiceMark(heardVoice ? "endpoint_detected" : "max_duration_endpoint");
            stopRecordingForSubmit();
            return;
          }
          analyserFrameRef.current = window.requestAnimationFrame(watchSilence);
        };
        analyserFrameRef.current = window.requestAnimationFrame(watchSilence);
      }
    } catch (error) {
      setListening(false);
      setMicLevel(0);
      setVoicePhase("error");
      if (auto) conversationActiveRef.current = false;
      setVoiceStatus(error instanceof Error ? `Mic unavailable: ${error.message}` : "Mic unavailable");
      recordVoiceMark("error", error instanceof Error ? error.message : "mic_unavailable");
    }
  };

  const toggleBrowserListening = async () => {
    if (speaking) {
      conversationActiveRef.current = true;
      void requestScreenWakeLock();
      interruptAssistantSpeech();
      await startBrowserListening(false);
      return;
    }
    if (conversationActiveRef.current || listening || (recorderRef.current?.state && recorderRef.current.state !== "inactive")) {
      conversationActiveRef.current = false;
      releaseScreenWakeLock();
      if (autoRestartTimerRef.current) window.clearTimeout(autoRestartTimerRef.current);
      stopRecordingForSubmit();
      setMicLevel(0);
      setVoicePhase("paused");
      setVoiceStatus("Open activation paused");
      return;
    }
    conversationActiveRef.current = true;
    void requestScreenWakeLock();
    await startBrowserListening(false);
  };

  useEffect(() => {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
      setVoicePhase("error");
      setVoiceStatus("Open activation needs HTTPS + browser mic permission");
      return;
    }
    conversationActiveRef.current = true;
    void requestScreenWakeLock();
    setVoicePhase("arming");
    setVoiceStatus("Open activation arming mic…");
    void startBrowserListening(true);
    // Open activation should arm once on load; dependencies would restart the mic loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={`dashboard-shell${reducedMotion ? " motion-reduced" : ""}`}>
      <header className="dashboard-topbar">
        <div className="dashboard-brand">
          <Orbit aria-hidden="true" />
          <span>Hermes OS</span>
          <i>/</i>
          <strong>Jarvis</strong>
        </div>
        <div className="dashboard-security">
          <span>
            <ShieldCheck aria-hidden="true" />
            Local Secure
          </span>
          <span>
            <i aria-hidden="true" />
            Live
          </span>
        </div>
        <div className="dashboard-time">
          <button type="button" onClick={sync}>
            <CircleGauge className={synced ? "is-spinning" : ""} aria-hidden="true" />
            {synced ? "Syncing" : "Synced"}
          </button>
          <time dateTime={new Date().toISOString()}>{new Date().toLocaleString([], { month: "short", day: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</time>
        </div>
      </header>

      <section className="status-ribbon" aria-label="Benson operational status">
        <div data-tone={overviewError ? "red" : "green"}>
          <Activity aria-hidden="true" />
          <span>Dashboard<small>{dashboardState}</small></span>
        </div>
        <div data-tone={gatewayState === "running" ? "green" : "amber"}>
          <Radio aria-hidden="true" />
          <span>Gateway<small>{gatewayState}</small></span>
        </div>
        <div data-tone={cpuPercent >= 90 ? "red" : cpuPercent >= 75 ? "amber" : "cyan"}>
          <Cpu aria-hidden="true" />
          <span>CPU<small>{cpuPercent}%</small></span>
        </div>
        <div data-tone={ramPercent >= 90 ? "red" : ramPercent >= 75 ? "amber" : "cyan"}>
          <MemoryStick aria-hidden="true" />
          <span>Memory<small>{ramPercent}%</small></span>
        </div>
        <div data-tone={diskPercent >= 90 ? "red" : diskPercent >= 75 ? "amber" : "cyan"}>
          <HardDrive aria-hidden="true" />
          <span>Disk<small>{diskPercent}%</small></span>
        </div>
        <div data-tone={networkHealth?.interfaces_up ? "green" : "amber"}>
          <Network aria-hidden="true" />
          <span>Network<small>{formatCount(networkHealth?.interfaces_up)}/{formatCount(networkHealth?.interfaces_total)} up</small></span>
        </div>
        <button
          type="button"
          className={reducedMotion ? "is-active" : ""}
          aria-pressed={reducedMotion}
          onClick={() => {
            const next = !reducedMotion;
            setReducedMotion(next);
            window.localStorage.setItem("benson-reduced-motion", String(next));
          }}
        >
          <Accessibility aria-hidden="true" />
          <span>Motion<small>{reducedMotion ? "Reduced" : "Standard"}</small></span>
        </button>
      </section>

      <main className="dashboard-grid">
        <aside className="agent-ops-panel hud-panel" id="agent-ops">
          <div className="panel-heading">
            <span>
              <UsersRound aria-hidden="true" />
              Agent Ops
            </span>
            <b>{formatCount(activeAgentCount)} active</b>
          </div>
          <div className="agent-summary">
            <div>
              <strong>{formatCount(activeAgentCount)}</strong>
              <span>Tasks running</span>
            </div>
            <div>
              <strong>{formatCount(queuedTaskCount)}</strong>
              <span>Queued</span>
            </div>
            <div>
              <strong className="green">98%</strong>
              <span>Success</span>
            </div>
          </div>
          <div className="agent-list">
            {dashboardAgents.map((agent) => (
              <button
                key={agent.name}
                type="button"
                className={agent.name.toLowerCase() === activeNode ? "is-active" : ""}
                onClick={() => setActiveNode("agents")}
              >
                <span className={`agent-status agent-status--${agent.tone}`} aria-hidden="true" />
                <span>
                  <strong>{agent.name}</strong>
                  <small>{agent.task}</small>
                </span>
                <em>{agent.load}%</em>
                <i style={{ "--load": `${agent.load}%` }} aria-hidden="true" />
              </button>
            ))}
          </div>
          <Link className="panel-link" to="/jarvis/agents">
            View hierarchy
            <ChevronRight aria-hidden="true" />
          </Link>
        </aside>

        <section className="command-center" aria-label="Jarvis command center">
          <div className="command-center__label">
            <span>
              <Radio aria-hidden="true" />
              Neural command field
            </span>
            <small>{voiceStatus}</small>
          </div>
          <VoiceCoreField
            speaking={speaking}
            activeNode={activeNode}
            nodes={liveNodes}
            reducedMotion={reducedMotion}
            onSelectNode={setActiveNode}
            onToggleSpeaking={toggleBrowserListening}
          />
          <div className="browser-voice-console" aria-live="polite">
            <button type="button" className={listening ? "is-listening" : ""} onClick={toggleBrowserListening}>
              {conversationActiveRef.current || listening ? "Pause open mic" : "Open mic"}
            </button>
            <div className="browser-voice-console__copy">
              <span>{VOICE_STAGE_LABELS[voicePhase] || voicePhase}</span>
              <small>{voiceTranscript ? `Heard: ${voiceTranscript}` : "Jarvis arms the mic automatically after HTTPS microphone permission."}</small>
              {voiceReply ? <small>Benson: {voiceReply}</small> : null}
            </div>
            <div className="voice-mode-control" aria-label="Voice response mode">
              {Object.entries(VOICE_MODE_CONFIG).map(([mode, config]) => (
                <button
                  key={mode}
                  type="button"
                  className={voiceMode === mode ? "is-active" : ""}
                  onClick={() => {
                    setVoiceMode(mode);
                    recordVoiceMark("voice_mode_selected", mode);
                  }}
                >
                  {config.label}
                </button>
              ))}
            </div>
            <div className="voice-free-selector" aria-label="Free Benson voice selector">
              <select
                value={selectedVoice.id}
                onChange={(event) => {
                  const next = FREE_BENSON_VOICES.find((voice) => voice.id === event.target.value) || FREE_BENSON_VOICES[0];
                  setSelectedVoice(next);
                  recordVoiceMark("free_voice_selected", next.id);
                }}
              >
                {FREE_BENSON_VOICES.map((voice) => (
                  <option key={voice.id} value={voice.id}>{voice.label} · {voice.tone}</option>
                ))}
              </select>
              <button type="button" onClick={previewSelectedVoice} disabled={voicePreviewing}>
                {voicePreviewing ? "Playing" : "Test"}
              </button>
            </div>
            <div className="voice-wake-control">
              <label>
                <input
                  type="checkbox"
                  checked={requireWakePhrase}
                  onChange={(event) => {
                    setRequireWakePhrase(event.target.checked);
                    recordVoiceMark("wake_phrase_required", String(event.target.checked));
                  }}
                />
                Wake phrase
              </label>
              <input
                aria-label="Jarvis wake phrase"
                value={wakePhrase}
                onChange={(event) => setWakePhrase(event.target.value)}
                placeholder="benson"
              />
            </div>
            <div className="voice-meter" aria-label={`Mic input ${Math.round(micLevel * 100)} percent`}>
              <i style={{ width: `${Math.round(micLevel * 100)}%` }} />
            </div>
            <div className="voice-latency-panel">
              <span>Turn {voiceTurnCount || "—"}</span>
              <b>{formatLatency(voiceTraceSummary.total_ms)}</b>
              <small>P50 {formatLatency(voiceTraceSummary.p50_ms)} · P90 {formatLatency(voiceTraceSummary.p90_ms)} · P95 {formatLatency(voiceTraceSummary.p95_ms)}</small>
              <ol>
                {voiceTraceSummary.stages.map((stage, index) => (
                  <li key={`${stage.stage}-${index}`}>
                    <span>{stage.stage}</span>
                    <em>{formatLatency(stage.elapsed_ms)}</em>
                  </li>
                ))}
              </ol>
              <div className="voice-backend-latency">
                <span>Backend {backendVoicePerf?.event_count ?? 0} events</span>
                {backendPerfStages.map((key) => {
                  const bucket = backendPerfSummary[key];
                  return (
                    <small key={key}>
                      {key.replace("/api/audio/", "")}: {bucket ? `P50 ${formatLatency(bucket.p50_ms)} / P95 ${formatLatency(bucket.p95_ms)}` : "—"}
                    </small>
                  );
                })}
              </div>
            </div>
            {voiceTurns.length ? (
              <div className="voice-rolling-transcript" aria-label="Recent Jarvis voice transcript">
                {voiceTurns.slice(-4).map((turn) => (
                  <p key={turn.id} className={`voice-rolling-transcript__${turn.role}`}>
                    <span>{turn.role === "you" ? "You" : "Benson"}</span>
                    {turn.text}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="vault-panel hud-panel">
          <div className="panel-heading">
            <span>
              <Database aria-hidden="true" />
              Data Vault
            </span>
            <b className={memoryTone}>{memoryStatus}</b>
          </div>
          <div className="vault-capacity">
            <span>
              <HardDrive aria-hidden="true" />
            </span>
            <div>
              <strong>{formatCount(memoryVault?.note_count)}</strong>
              <small>{memoryVault?.configured ? "Obsidian notes indexed" : "Vault not configured"}</small>
            </div>
            <em>{diskPercent}%</em>
          </div>
          <div className="vault-meter" aria-label={`Vault storage ${diskPercent} percent`}>
            <i style={{ width: `${diskPercent}%` }} />
          </div>
          <div className="vault-stats">
            <div>
              <FolderKanban aria-hidden="true" />
              <span>Projects</span>
              <strong>{formatCount(memoryVault?.product_note_count)}</strong>
            </div>
            <div>
              <MemoryStick aria-hidden="true" />
              <span>Memories</span>
              <strong>{formatCount(memoryVault?.note_count)}</strong>
            </div>
            <div>
              <Mail aria-hidden="true" />
              <span>Recent</span>
              <strong>{formatCount(memoryVault?.recent_notes?.length)}</strong>
            </div>
            <div>
              <Sparkles aria-hidden="true" />
              <span>Decisions</span>
              <strong>{formatCount(memoryVault?.decision_count)}</strong>
            </div>
          </div>
          <Link className="panel-link" to="/jarvis/memory">
            Open memory atlas
            <ChevronRight aria-hidden="true" />
          </Link>
        </aside>

        <section className="approval-strip hud-panel">
          <div className={approvalResolved ? "approval-icon is-resolved" : "approval-icon"}>
            {approvalResolved ? <Check aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
          </div>
          <div>
            <span>{approvalResolved ? "Approval resolved" : `${formatCount(approvalCount)} approval${approvalCount === 1 ? "" : "s"} waiting`}</span>
            <strong>
              {approvalResolved
                ? "Deployment request acknowledged"
                : overview?.todos?.[0]?.title || "Production deployment requires operator review"}
            </strong>
          </div>
          <button type="button" onClick={() => setApprovalResolved((value) => !value)}>
            {approvalResolved ? "Reopen" : "Review"}
          </button>
          <div className="health-metrics">
            <span>
              <Cpu aria-hidden="true" />
              CPU <strong>{formatPercent(serviceHealth?.system?.cpu_percent, 0)}%</strong>
            </span>
            <span>
              <MemoryStick aria-hidden="true" />
              Memory <strong>{formatPercent(serviceHealth?.system?.memory_percent, 0)}%</strong>
            </span>
            <span>
              <Activity aria-hidden="true" />
              Sessions <strong>{formatCount(agentStatus?.active_sessions)}</strong>
            </span>
            <span>
              <Bot aria-hidden="true" />
              Agents <strong>{formatCount(activeAgentCount)}</strong>
            </span>
          </div>
        </section>

        <section className="event-panel hud-panel">
          <div className="panel-heading">
            <span>
              <Activity aria-hidden="true" />
              System Events
            </span>
            <b>Live feed</b>
          </div>
          <div className="event-list">
            {dashboardEvents.map(([time, label, tone]) => (
              <div key={`${time}-${label}`}>
                <time>{time}</time>
                <i className={`event-dot event-dot--${tone}`} aria-hidden="true" />
                <span>{label}</span>
              </div>
            ))}
          </div>
        </section>
      </main>

      <DashboardNav />
    </div>
  );
}
