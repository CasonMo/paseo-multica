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
  planned: { label: "规划中", tone: "muted" },
  in_progress: { label: "进行中", tone: "accent" },
  paused: { label: "已暂停", tone: "warning" },
  completed: { label: "已完成", tone: "success" },
  cancelled: { label: "已取消", tone: "danger" },
};

export function projectStatusMeta(status?: string | null) {
  return PROJECT_STATUS_META[status ?? "planned"] ?? { label: status ?? "未知", tone: "muted" as Tone };
}

export const HANDLER_LABEL: Record<string, string> = {
  none: "无处理人",
  project_lead: "项目负责人",
  member: "成员",
  agent: "智能体",
  squad: "小队",
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
}

export const CATEGORY_META: Record<IssueCategory, { label: string; tone: Tone }> = {
  unstarted: { label: "未开始", tone: "muted" },
  started: { label: "进行中", tone: "accent" },
  done: { label: "已完成", tone: "success" },
  closed: { label: "已关闭", tone: "danger" },
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

export function issueStatusLabel(issue: Issue, statuses: IssueStatusEntry[]): string {
  if (issue.status_name) return issue.status_name;
  const entry = issueStatusEntry(issue, statuses);
  if (entry) return entry.name;
  const category = issueCategory(issue, statuses);
  return CATEGORY_META[category]?.label ?? issue.status;
}

export function issueStatusColor(issue: Issue, statuses: IssueStatusEntry[]): string {
  const entry = issueStatusEntry(issue, statuses);
  if (entry?.color) return entry.color;
  return BUILTIN_COLOR[issue.status] ?? "#8b8b93";
}

export function statusColor(status: IssueStatusEntry): string {
  return status.color || BUILTIN_COLOR[status.key] || "#8b8b93";
}

export const PRIORITY_META: Record<string, { label: string; tone: Tone; icon: string }> = {
  urgent: { label: "紧急", tone: "danger", icon: "Flame" },
  high: { label: "高", tone: "warning", icon: "SignalHigh" },
  medium: { label: "中", tone: "accent", icon: "SignalMedium" },
  low: { label: "低", tone: "muted", icon: "SignalLow" },
  none: { label: "无", tone: "muted", icon: "Minus" },
};

export function priorityMeta(priority?: string | null) {
  return PRIORITY_META[priority ?? "none"] ?? PRIORITY_META.none;
}

export const AGENT_STATUS_META: Record<string, { label: string; tone: Tone }> = {
  idle: { label: "空闲", tone: "success" },
  working: { label: "工作中", tone: "accent" },
  blocked: { label: "阻塞", tone: "warning" },
  error: { label: "异常", tone: "danger" },
  offline: { label: "离线", tone: "muted" },
};

export function agentStatusMeta(status?: string | null) {
  return AGENT_STATUS_META[status ?? "offline"] ?? { label: status ?? "未知", tone: "muted" as Tone };
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

export function pickTextColor(hex: string): string {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return "#ffffff";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#111111" : "#ffffff";
}

export function relTime(value?: string | null): string {
  if (!value) return "—";
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return "—";
  const diff = Date.now() - time;
  if (diff < 0) {
    const ahead = -diff;
    if (ahead < 60_000) return "即将";
    if (ahead < 3_600_000) return `${Math.round(ahead / 60_000)} 分钟后`;
    if (ahead < 86_400_000) return `${Math.round(ahead / 3_600_000)} 小时后`;
    return `${Math.round(ahead / 86_400_000)} 天后`;
  }
  if (diff < 60_000) return "刚刚";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
  if (diff < 7 * 86_400_000) return `${Math.floor(diff / 86_400_000)} 天前`;
  const date = new Date(time);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
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
