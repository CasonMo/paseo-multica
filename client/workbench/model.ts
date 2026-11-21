import { t } from "./i18n";
export type Tone = "default" | "accent" | "success" | "warning" | "danger" | "muted";

export interface IssueStatusEntry {
  id: string;
  key: string;
  name: string;
  description?: string;
  category: "unstarted" | "started" | "done" | "closed" | (string & {});
  color: string;
  icon?: string | null;
  is_system?: boolean;
  position?: number;
}

export type IssueCategory = "unstarted" | "started" | "done" | "closed";

export interface Issue {
  id: string;
  identifier: string;
  number?: number;
  title: string;
  description?: string | null;
  status: string;
  status_category?: IssueCategory;
  status_name?: string;
  priority: "urgent" | "high" | "medium" | "low" | "none";
  assignee_type?: "member" | "agent" | "squad" | null;
  assignee_id?: string | null;
  creator_type?: string;
  creator_id?: string;
  project_id?: string | null;
  parent_issue_id?: string | null;
  due_date?: string | null;
  start_date?: string | null;
  stage?: string | null;
  labels?: { id: string; name: string; color: string }[];
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}

export interface IssueListResponse {
  issues?: Issue[];
  total?: number;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  avatar_url?: string | null;
  runtime_id?: string;
  runtime_bound?: boolean;
  runtime_availability?: "online" | "unstable" | "offline";
  status?: "idle" | "working" | "blocked" | "error" | "offline" | (string & {});
  model?: string;
  max_concurrent_tasks?: number;
  visibility?: string;
  permission_mode?: string;
  skills?: { id?: string; name?: string; slug?: string }[];
  archived_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AgentRuntime {
  id: string;
  name: string;
  custom_name?: string | null;
  provider?: string;
  status: "online" | "offline";
  device_info?: string;
  owner_id?: string | null;
  visibility?: string;
  last_seen_at?: string | null;
  created_at?: string;
}

export interface Squad {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  avatar_url?: string | null;
  leader_id?: string;
  member_count?: number;
  member_preview?: { id?: string; name?: string; avatar_url?: string | null }[];
  archived_at?: string | null;
  created_at?: string;
}

export interface Skill {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  source?: string;
  enabled?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface ChatSession {
  id: string;
  agent_id: string;
  title: string;
  status: "active" | "archived" | (string & {});
  has_unread?: boolean;
  unread_count?: number;
  pinned?: boolean;
  last_message?: { role?: string; content?: string; created_at?: string } | null;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | (string & {});
  content: string;
  task_id?: string | null;
  failure_reason?: string | null;
  created_at: string;
  elapsed_ms?: number | null;
  quick_actions?: (string | { text?: string; label?: string; title?: string })[] | null;
}

export interface Autopilot {
  id: string;
  title: string;
  description?: string | null;
  project_id?: string | null;
  assignee_type: "agent" | "squad";
  assignee_id: string;
  status: "active" | "paused" | "archived" | (string & {});
  execution_mode?: "create_issue" | "run_only" | (string & {});
  trigger_kinds?: string[];
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_run_status?: string | null;
  can_write?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface InboxItem {
  id: string;
  type: string;
  severity?: string;
  issue_id?: string | null;
  issue_identifier?: string | null;
  title: string;
  body?: string | null;
  issue_status?: string | null;
  issue_priority?: string | null;
  read: boolean;
  archived: boolean;
  snoozed_until?: string | null;
  created_at: string;
}

export interface Project {
  id: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  status?: string;
  priority?: string;
  lead_type?: string | null;
  lead_id?: string | null;
  issue_count?: number;
  done_count?: number;
  start_date?: string | null;
  due_date?: string | null;
  created_at?: string;
  updated_at?: string;
  archived_at?: string | null;
}

export interface Label {
  id: string;
  name: string;
  color: string;
  description?: string | null;
  resource_type?: string;
  usage_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface WorkflowHandler {
  type: "none" | "member" | "agent" | "squad" | (string & {});
  id?: string | null;
}

export interface WorkflowStep {
  status_key: string;
  handler?: WorkflowHandler;
  instructions?: string;
  next_status_key?: string | null;
  back_status_key?: string | null;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  is_default?: boolean;
  owner_id?: string | null;
  steps?: WorkflowStep[];
  project_ids?: string[];
  created_at?: string;
  updated_at?: string;
}

export const PROJECT_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  planned: { label: "model.1", tone: "muted" },
  in_progress: { label: "Execution.60", tone: "accent" },
  paused: { label: "Nav.43", tone: "warning" },
  completed: { label: "AgentDetail.6", tone: "success" },
  cancelled: { label: "AgentDetail.9", tone: "danger" },
};

export function projectStatusMeta(status?: string | null) {
  const meta = PROJECT_STATUS_META[status ?? "planned"];
  return meta ? { ...meta, label: t(meta.label) } : { label: status ?? t("AgentDetail.57"), tone: "muted" as Tone };
}

export const HANDLER_LABEL: Record<string, string> = {
  none: "model.7",
  project_lead: "model.8",
  member: "Execution.11",
  agent: "AgentDetail.23",
  squad: "Nav.36",
};

export interface Comment {
  id: string;
  issue_id?: string;
  parent_id?: string | null;
  content: string;
  author_type?: string;
  author_id?: string;
  author_name?: string;
  created_at: string;
  updated_at?: string;
  resolved?: boolean;
  resolved_at?: string | null;
  source_task_id?: string | null;
  attachments?: { id: string; name?: string; url?: string; size?: number }[];
}

export const CATEGORY_META: Record<IssueCategory, { label: string; tone: Tone }> = {
  unstarted: { label: "model.12", tone: "muted" },
  started: { label: "Execution.60", tone: "accent" },
  done: { label: "AgentDetail.6", tone: "success" },
  closed: { label: "model.15", tone: "danger" },
};

const BUILTIN_CATEGORY: Record<string, IssueCategory> = {
  backlog: "unstarted",
  todo: "unstarted",
  in_progress: "started",
  in_review: "started",
  blocked: "started",
  done: "done",
  cancelled: "closed",
};

const BUILTIN_COLOR: Record<string, string> = {
  backlog: "#8b8b93",
  todo: "#5b6b7c",
  in_progress: "#5b8def",
  in_review: "#a78bfa",
  blocked: "#f97316",
  done: "#22c55e",
  cancelled: "#ef4444",
};

export function issueCategory(issue: Issue, statuses: IssueStatusEntry[]): IssueCategory {
  if (issue.status_category) return issue.status_category as IssueCategory;
  const entry = statuses.find((status) => status.key === issue.status);
  if (entry) return entry.category as IssueCategory;
  return BUILTIN_CATEGORY[issue.status] ?? "unstarted";
}

export function issueStatusEntry(issue: Issue, statuses: IssueStatusEntry[]): IssueStatusEntry | null {
  return statuses.find((status) => status.key === issue.status) ?? null;
}

// 内置状态键统一走双语 catalog，避免 zh 界面混排服务端原始英文名；
// 工作区若重命名过内置状态（服务端名 ≠ 默认英文名）或自定义状态，保留服务端名
const BUILTIN_STATUS_LABEL: Record<string, string> = {
  backlog: "Issues.6",
  todo: "Issues.7",
  unstarted: "model.12",
  in_progress: "Execution.60",
  started: "Execution.60",
  blocked: "model.35",
  in_review: "Issues.9",
  review: "Issues.9",
  done: "AgentDetail.6",
  completed: "AgentDetail.6",
  cancelled: "AgentDetail.9",
  closed: "AgentDetail.9",
};

const BUILTIN_STATUS_EN: Record<string, string> = {
  backlog: "backlog",
  todo: "todo",
  unstarted: "not started",
  in_progress: "in progress",
  started: "in progress",
  blocked: "blocked",
  in_review: "in review",
  review: "in review",
  done: "done",
  completed: "completed",
  cancelled: "cancelled",
  closed: "closed",
};

function isDefaultStatusName(key: string, name?: string | null): boolean {
  if (!name || !name.trim()) return true;
  return name.trim().toLowerCase() === (BUILTIN_STATUS_EN[key] ?? key).toLowerCase();
}

export function statusLabel(status: IssueStatusEntry): string {
  const key = BUILTIN_STATUS_LABEL[status.key];
  return key && isDefaultStatusName(status.key, status.name) ? t(key) : status.name;
}

/** 展示用：把 [@名字](mention://agent/<id>) 还原为 @名字，避免原始 URI 暴露给用户。 */
export function displayMentions(text: string): string {
  return text.replace(/\[@([^\]]+)\]\(mention:\/\/[^)]*\)/g, "@$1");
}

export function issueStatusLabel(issue: Issue, statuses: IssueStatusEntry[]): string {
  const builtin = BUILTIN_STATUS_LABEL[issue.status];
  if (builtin && isDefaultStatusName(issue.status, issue.status_name)) return t(builtin);
  if (issue.status_name) return issue.status_name;
  const entry = issueStatusEntry(issue, statuses);
  if (entry) return statusLabel(entry);
  const category = issueCategory(issue, statuses);
  const meta = CATEGORY_META[category];
  return meta ? t(meta.label) : issue.status;
}

export function issueStatusColor(issue: Issue, statuses: IssueStatusEntry[]): string {
  const entry = issueStatusEntry(issue, statuses);
  if (entry?.color) return entry.color;
  return BUILTIN_COLOR[issue.status] ?? "#8b8b93";
}

const STATUS_ICON: Record<string, string> = {
  backlog: "CircleDashed",
  todo: "Circle",
  unstarted: "Circle",
  in_progress: "CircleDot",
  started: "CircleDot",
  blocked: "CircleAlert",
  in_review: "CircleCheck",
  review: "CircleCheck",
  done: "CheckCheck",
  completed: "CheckCheck",
  cancelled: "CircleSlash",
  closed: "CircleSlash",
};

export function issueStatusIcon(issue: Issue, statuses: IssueStatusEntry[]): string {
  return STATUS_ICON[issue.status] ?? STATUS_ICON[issueCategory(issue, statuses)] ?? "Circle";
}

export function statusColor(status: IssueStatusEntry): string {
  return status.color || BUILTIN_COLOR[status.key] || "#8b8b93";
}

export const PRIORITY_META: Record<string, { label: string; tone: Tone; icon: string }> = {
  urgent: { label: "model.16", tone: "danger", icon: "Flame" },
  high: { label: "model.17", tone: "warning", icon: "SignalHigh" },
  medium: { label: "model.18", tone: "accent", icon: "SignalMedium" },
  low: { label: "model.19", tone: "muted", icon: "SignalLow" },
  none: { label: "model.20", tone: "muted", icon: "Minus" },
};

export function priorityMeta(priority?: string | null) {
  const meta = PRIORITY_META[priority ?? "none"] ?? PRIORITY_META.none;
  return { ...meta, label: t(meta.label) };
}

export const AGENT_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  idle: { label: "model.21", tone: "success" },
  working: { label: "model.22", tone: "accent" },
  blocked: { label: "model.23", tone: "warning" },
  error: { label: "model.24", tone: "danger" },
  offline: { label: "RuntimeDetail.4", tone: "muted" },
};

export function agentStatusMeta(status?: string | null) {
  const meta = AGENT_STATUS_META[status ?? "offline"];
  return meta ? { ...meta, label: t(meta.label) } : { label: status ?? t("AgentDetail.57"), tone: "muted" as Tone };
}

export function runtimeName(runtime: AgentRuntime): string {
  return runtime.custom_name?.trim() || runtime.name;
}

export function initials(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "?";
  const ascii = /^[A-Za-z0-9 ._-]+$/.test(trimmed);
  if (ascii) {
    const parts = trimmed.split(/[\s._-]+/).filter(Boolean);
    return parts
      .slice(0, 2)
      .map((part) => part[0]!.toUpperCase())
      .join("");
  }
  return trimmed.slice(0, 1);
}

export function withAlpha(hex: string, alpha: number): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return hex;
  const value = Math.max(0, Math.min(255, Math.round(alpha * 255)));
  return hex + value.toString(16).padStart(2, "0");
}

function channelLuminance(hex: string): number {
  const value = parseInt(hex.slice(1), 16);
  const linear = (shift: number) => {
    const channel = ((value >> shift) & 255) / 255;
    return channel <= 0.03928 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(16) + 0.7152 * linear(8) + 0.0722 * linear(0);
}

export function pickTextColor(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "#ffffff";
  const background = channelLuminance(hex);
  const contrast = (ink: string) => {
    const other = channelLuminance(ink);
    return (Math.max(background, other) + 0.05) / (Math.min(background, other) + 0.05);
  };
  return contrast("#ffffff") >= contrast("#111111") ? "#ffffff" : "#111111";
}

export function relTime(value?: string | null): string {
  if (!value) return "—";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "—";
  const diff = Date.now() - time;
  if (diff < 0) {
    const ahead = -diff;
    if (ahead < 60_000) return t("model.27");
    if (ahead < 3_600_000) return t("model.28", { a: Math.round(ahead / 60_000) });
    if (ahead < 86_400_000) return t("model.29", { a: Math.round(ahead / 3_600_000) });
    return t("model.30", { a: Math.round(ahead / 86_400_000) });
  }
  if (diff < 60_000) return t("model.31");
  if (diff < 3_600_000) return t("model.32", { a: Math.floor(diff / 60_000) });
  if (diff < 86_400_000) return t("model.33", { a: Math.floor(diff / 3_600_000) });
  if (diff < 7 * 86_400_000) return t("model.34", { a: Math.floor(diff / 86_400_000) });
  const date = new Date(time);
  return t("Execution.9", { a: date.getMonth() + 1, b: date.getDate() });
}

export function fmtDateTime(value?: string | null): string {
  if (!value) return "—";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return value;
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fmtNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 10_000) return `${(value / 1_000).toFixed(1)}k`;
  return String(value);
}

export function fmtCost(value: unknown): string {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return "—";
  return `$${n.toFixed(n >= 1 ? 2 : 4)}`;
}

export function fmtDuration(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m${Math.round((ms % 60_000) / 1000)}s`;
}
