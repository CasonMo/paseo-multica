import { t } from "./i18n";
import { Icon } from "@getpaseo/plugin/client/ui";
import { useRpc } from "@getpaseo/plugin/client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View, type TextStyle } from "react-native";
import { issueInsightsRpc, taskLogRpc } from "../../shared/contracts";
import { asList, useQuery, type ApiFn } from "./api";
import { Avatar, Btn, IconBtn, Tag, useUi, type Ui } from "./bits";
import { relTime, type Agent, type Comment, type IssueStatusEntry } from "./model";

export interface TaskRun {
  id: string;
  agent_id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  kind?: string;
  result?: { output?: string } | null;
  error?: string | null;
  attempt?: number;
  attribution?: {
    source?: string;
    initiator?: { id?: string; name?: string } | null;
    evidence?: { kind?: string; ref_id?: string } | null;
  } | null;
  usage?: { provider?: string; model?: string; input_tokens?: number; output_tokens?: number; cache_read_tokens?: number; cache_write_tokens?: number }[];
}

export type ActiveTask = TaskRun;

export function RunningChip({ ui, agent, compact }: { ui: Ui; agent: { name: string; avatar_url?: string | null }; compact?: boolean }) {
  return (
    <View
      style={[
        ui.s.row,
        {
          gap: 6,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: `${ui.c.success}1a`,
          borderWidth: 1,
          borderColor: `${ui.c.success}55`,
        },
      ]}
    >
      <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={16} />
      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "500", color: ui.c.success, maxWidth: compact ? 90 : 160 }}>
        {agent.name} {t("Execution.1")}
      </Text>
      <ActivityIndicator size="small" color={ui.c.success} />
    </View>
  );
}

/** 触发评论下的「智能体正在响应」行：实时步骤文本 + 计时 + 展开日志 + 停止。 */
export function RunningResponseRow({
  ui,
  task,
  agent,
  onOpenLog,
  onStop,
}: {
  ui: Ui;
  task: TaskRun;
  agent: Agent | null;
  onOpenLog(id: string): void;
  onStop(task: TaskRun): void;
}) {
  const logRpc = useRpc(taskLogRpc);
  const logRef = useRef(logRpc);
  logRef.current = logRpc;
  const [step, setStep] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const taskId = task.id;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = async () => {
      try {
        const result = await logRef.current({ taskId });
        if (!alive) return;
        const msgs = (result.messages ?? []) as { type?: string; tool?: string; input?: Record<string, unknown>; content?: string }[];
        for (let i = msgs.length - 1; i >= 0; i--) {
          const m = msgs[i];
          const input = m.input ?? {};
          const text =
            m.type === "tool_use"
              ? str(input.description) || str(input.command).split("\n")[0] || str(input.file_path) || str(input.pattern) || (m.tool ? t("Execution.2", { a: m.tool }) : "")
              : m.type === "text" || m.type === "assistant" || m.type === "thinking" || m.type === "think"
                ? (m.content ?? "").split("\n")[0]
                : "";
          if (text.trim()) {
            setStep(text.trim().slice(0, 140));
            return;
          }
        }
        setStep(null);
      } catch {
        // 取步骤失败保留上一次文本，下一轮轮询自愈
      } finally {
        // messages 运行中可能长轮询：串行续 poll，避免请求堆积堵死 RPC 通道
        if (alive) timer = setTimeout(() => void load(), 4000);
      }
    };
    void load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [taskId]);

  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [taskId]);

  const name = agent?.name ?? t("AgentDetail.23");
  return (
    <View style={[ui.s.row, { gap: 4, paddingLeft: 32, paddingRight: 8, paddingVertical: 6 }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Execution.4", { a: name })}
        onPress={() => onOpenLog(task.id)}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          ui.s.row,
          { flex: 1, gap: 8, borderRadius: 6, paddingVertical: 2 },
          hovered && { backgroundColor: ui.c.fillHover },
          pressed && ui.s.pressed,
        ]}
      >
        <Avatar ui={ui} name={name} url={agent?.avatar_url} size={16} />
        <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: "500", color: ui.c.fg, flexShrink: 0 }}>
          {name}
        </Text>
        <ActivityIndicator size="small" color={ui.c.brand} />
        <Text numberOfLines={1} style={{ fontSize: 13, color: ui.c.muted, flex: 1 }}>
          {step ?? t("Execution.5")}
        </Text>
        <Text style={ui.s.tiny}>{fmtDuration(runDurationMs(task))}</Text>
        <Icon name="ChevronRight" size={12} color={ui.c.faint} />
      </Pressable>
      <IconBtn ui={ui} icon="Square" label={t("Execution.6")} onPress={() => onStop(task)} />
    </View>
  );
}

export interface IssueUsage {
  cost_usd_ticks?: number;
  task_count?: number;
  terminal_task_count?: number;
  total_input_tokens?: number;
  total_output_tokens?: number;
  total_cache_read_tokens?: number;
  total_cache_write_tokens?: number;
  unreported_task_count?: number;
}

export interface TimelineEntry {
  type: "activity" | "comment" | (string & {});
  id: string;
  actor_type?: string;
  actor_id?: string;
  actor_name?: string;
  created_at: string;
  action?: string;
  details?: Record<string, unknown>;
  content?: string;
  source_task_id?: string | null;
}

const AGENT_HUES = ["#7aa2f7", "#3fb950", "#e3b341", "#f0883e", "#b48ead", "#56b6c2", "#ff7b72", "#a1a1aa"];

export function runDurationMs(run: TaskRun): number {
  if (!run.started_at) return 0;
  const end = run.completed_at ? Date.parse(run.completed_at) : Date.now();
  return Math.max(0, end - Date.parse(run.started_at));
}

export function runTokens(run: TaskRun): number {
  return (run.usage ?? []).reduce((sum, u) => sum + (u.input_tokens ?? 0) + (u.output_tokens ?? 0) + (u.cache_read_tokens ?? 0) + (u.cache_write_tokens ?? 0), 0);
}

export function runModel(run: TaskRun): string {
  return run.usage?.[0]?.model ?? "—";
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

export function fmtClock(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((startOf(now) - startOf(d)) / 86400_000);
  if (diff === 0) return t("Execution.7");
  if (diff === 1) return t("Execution.8");
  return t("Execution.9", { a: d.getMonth() + 1, b: d.getDate() });
}

export interface WorkingAgent {
  id: string;
  name: string;
  avatar_url: string | null;
  running_task_count: number;
  issue_ids: string[];
}

/** 工作区里正在跑任务的智能体 → issue 映射，供看板/列表打运行中标记。 */
export function useWorkingAgents(api: ApiFn, key: string): Map<string, WorkingAgent> {
  const query = useQuery(api, "/api/working-agents", { pollMs: 10000, select: (data) => asList<WorkingAgent>(data, "agents", "working_agents") }, key);
  return useMemo(() => {
    const map = new Map<string, WorkingAgent>();
    for (const agent of query.data ?? []) {
      for (const issueId of agent.issue_ids ?? []) map.set(issueId, agent);
    }
    return map;
  }, [query.data]);
}

export interface IssueInsights {
  runs: TaskRun[];
  usage: IssueUsage | null;
  timeline: TimelineEntry[];
  comments: Comment[];
}

/** 服务端聚合 task-runs / usage / timeline / comments，避免客户端逐条查询的不稳定。 */
export function useIssueInsights(issueId: string, bump: number, ready = true): IssueInsights & { loading: boolean; refresh: () => void } {
  const fetchRpc = useRpc(issueInsightsRpc);
  const fetchRef = useRef(fetchRpc);
  fetchRef.current = fetchRpc;
  const [data, setData] = useState<IssueInsights>({ runs: [], usage: null, timeline: [], comments: [] });
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!issueId || !ready) return;
    let alive = true;
    const load = async () => {
      try {
        const result = await fetchRef.current({ issueId });
        if (!alive) return;
        const runs = (result.runs ?? []) as unknown as TaskRun[];
        const timeline = (result.timeline ?? []) as unknown as TimelineEntry[];
        const comments = (result.comments ?? []) as unknown as Comment[];
        const usage = (result.usage ?? null) as IssueUsage | null;
        setData((prev) => ({
          runs: runs.length > 0 ? runs : prev.runs,
          usage: usage && Object.keys(usage).length > 0 ? usage : prev.usage,
          timeline: timeline.length > 0 ? timeline : prev.timeline,
          comments: comments.length > 0 ? comments : prev.comments,
        }));
        setLoading(false);
      } catch {
        // 保留上一次数据，下一轮轮询自愈；退出 loading 避免永久转圈
        setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), 8000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [issueId, bump, tick, ready]);

  return { ...data, loading, refresh: () => setTick((v) => v + 1) };
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

/** 把 timeline 活动按时间归到它前面最近的一条根评论下（官方「N 条动态」的形式）。 */
export function activitiesByRoot(timeline: TimelineEntry[], roots: Comment[]): Map<string, TimelineEntry[]> {
  const map = new Map<string, TimelineEntry[]>();
  const sortedRoots = [...roots].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  const activities = timeline.filter((e) => e.type === "activity").sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
  for (const activity of activities) {
    const t = Date.parse(activity.created_at);
    let owner: string | null = null;
    for (const root of sortedRoots) {
      if (Date.parse(root.created_at) <= t) owner = root.id;
      else break;
    }
    if (!owner) continue;
    const list = map.get(owner) ?? [];
    list.push(activity);
    map.set(owner, list);
  }
  return map;
}

function activityText(entry: TimelineEntry, statuses: IssueStatusEntry[], agents: Agent[], runs: TaskRun[]): string {
  const statusName = (key: string) => statuses.find((s) => s.key === key)?.name ?? key;
  const actorName = (type: string | undefined, id: string | undefined) =>
    type === "agent" ? agents.find((a) => a.id === id)?.name ?? t("AgentDetail.23") : entry.actor_name ?? t("Execution.11");
  switch (entry.action) {
    case "status_changed":
      return t("Execution.12", { a: statusName(str(entry.details?.from)), b: statusName(str(entry.details?.to)) });
    case "task_completed": {
      const prior = runs.filter((r) => r.agent_id === entry.actor_id && r.completed_at && Date.parse(r.completed_at) <= Date.parse(entry.created_at)).length;
      return t("Execution.13", { a: prior > 0 ? t("Execution.14", { a: prior }) : "" });
    }
    case "task_failed":
      return t("Execution.15");
    case "assignee_changed":
      return t("Execution.16", { a: actorName(str(entry.details?.from_type), str(entry.details?.from_id)), b: actorName(str(entry.details?.to_type), str(entry.details?.to_id)) });
    case "created":
      return t("Execution.17");
    default:
      return entry.action ?? t("Execution.18");
  }
}

const ACTION_ICON: Record<string, { icon: string; tone: "accent" | "success" | "danger" | "muted" }> = {
  status_changed: { icon: "RefreshCw", tone: "accent" },
  task_completed: { icon: "CheckCircle2", tone: "success" },
  task_failed: { icon: "TriangleAlert", tone: "danger" },
  assignee_changed: { icon: "UserCheck", tone: "accent" },
  created: { icon: "FilePlus", tone: "muted" },
};

export function ActivityList({
  ui,
  entries,
  statuses,
  agents,
  runs,
}: {
  ui: Ui;
  entries: TimelineEntry[];
  statuses: IssueStatusEntry[];
  agents: Agent[];
  runs: TaskRun[];
}) {
  return (
    <View style={{ gap: 2 }}>
      {entries.map((entry) => {
        const meta = ACTION_ICON[entry.action ?? ""] ?? { icon: "Activity", tone: "muted" as const };
        const color = meta.tone === "accent" ? ui.c.brand : meta.tone === "success" ? ui.c.success : meta.tone === "danger" ? ui.c.danger : ui.c.muted;
        const actor = entry.actor_type === "agent" ? agents.find((a) => a.id === entry.actor_id) : null;
        return (
          <View key={entry.id} style={[ui.s.row, { gap: 8, paddingHorizontal: 16, paddingVertical: 6 }]}>
            {actor ? <Avatar ui={ui} name={actor.name} url={actor.avatar_url} size={16} /> : <Icon name={meta.icon} size={14} color={color} />}
            <Text style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: ui.c.fg }}>
              <Text style={{ fontWeight: "600" }}>{actor?.name ?? entry.actor_name ?? t("Execution.11")}</Text>
              {" "}{activityText(entry, statuses, agents, runs)}
            </Text>
            <Text style={ui.s.tiny}>{relTime(entry.created_at)}</Text>
          </View>
        );
      })}
    </View>
  );
}

/** 右栏「执行日志」分区：汇总 + 最近运行 + 详情入口。 */
export function ExecutionLogSection({
  ui,
  runs,
  usage,
  agents,
  onOpenRuns,
  onOpenRun,
}: {
  ui: Ui;
  runs: TaskRun[];
  usage: IssueUsage | null;
  agents: Agent[];
  onOpenRuns(): void;
  onOpenRun(id: string): void;
}) {
  const totalTokens = (usage?.total_input_tokens ?? 0) + (usage?.total_output_tokens ?? 0) + (usage?.total_cache_read_tokens ?? 0) + (usage?.total_cache_write_tokens ?? 0);
  const workMs = runs.reduce((sum, r) => sum + runDurationMs(r), 0);
  const failed = runs.filter((r) => r.status === "failed" || r.status === "error").length;
  const recent = [...runs].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at)).slice(0, 3);
  return (
    <View style={{ gap: 8 }}>
      <View style={[ui.s.row, { gap: 10, paddingHorizontal: 7 }]}>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: ui.c.fg }}>${((usage?.cost_usd_ticks ?? 0) / 1_000_000).toFixed(2)}</Text>
          <Text style={ui.s.tiny}>{t("Execution.20")}</Text>
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: ui.c.fg }}>{fmtTokens(totalTokens)}</Text>
          <Text style={ui.s.tiny}>Token</Text>
        </View>
        <View style={{ flex: 1, gap: 1 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: ui.c.fg }}>{fmtDuration(workMs)}</Text>
          <Text style={ui.s.tiny}>{t("Execution.21")}</Text>
        </View>
      </View>
      <View style={{ gap: 2 }}>
        {recent.map((run) => {
          const agent = agents.find((a) => a.id === run.agent_id);
          const ok = run.status === "completed";
          return (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("Execution.22", { a: run.id.slice(0, 8) })}
              key={run.id}
              onPress={() => onOpenRun(run.id)}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                ui.s.row,
                { gap: 7, paddingHorizontal: 7, paddingVertical: 6, borderRadius: 6 },
                hovered && { backgroundColor: ui.c.fillHover },
                pressed && ui.s.pressed,
              ]}
            >
              {agent ? <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={16} /> : <Icon name="Bot" size={14} color={ui.c.muted} />}
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: ui.c.fg }}>
                {run.attribution?.evidence?.kind === "comment" ? t("Execution.23") : run.kind === "direct" ? t("Execution.24") : t("Execution.25")}
                {run.result?.output ? ` · ${run.result.output.slice(0, 24)}` : ""}
              </Text>
              <Icon name={ok ? "CheckCircle2" : run.status === "running" ? "Loader" : "TriangleAlert"} size={13} color={ok ? ui.c.success : run.status === "running" ? ui.c.brand : ui.c.danger} />
            </Pressable>
          );
        })}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Execution.26")}
        onPress={onOpenRuns}
        style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
          ui.s.row,
          { gap: 5, paddingHorizontal: 7, paddingVertical: 5, borderRadius: 6 },
          hovered && { backgroundColor: ui.c.fillHover },
          pressed && ui.s.pressed,
        ]}
      >
        <Text style={{ fontSize: 12, color: ui.c.muted }}>{t("Execution.27")} {runs.length} {t("Execution.28")}{failed > 0 ? t("Execution.29", { a: failed }) : ""}</Text>
        <Icon name="ChevronRight" size={12} color={ui.c.muted} />
      </Pressable>
    </View>
  );
}

function StatBlock({ ui, value, label }: { ui: Ui; value: string; label: string }) {
  return (
    <View style={{ gap: 2, minWidth: 90 }}>
      <Text style={{ fontSize: 18, fontWeight: "700", color: ui.c.fg }}>{value}</Text>
      <Text style={ui.s.tiny}>{label}</Text>
    </View>
  );
}

/** 图3：运行记录弹窗（汇总 + 按次/累计 + 费用/Token/工时 + 按智能体图表 + 按天分组明细）。 */
export function RunsModal({
  ui,
  open,
  onClose,
  issueIdentifier,
  issueTitle,
  runs,
  usage,
  agents,
  onOpenRun,
}: {
  ui: Ui;
  open: boolean;
  onClose(): void;
  issueIdentifier: string;
  issueTitle: string;
  runs: TaskRun[];
  usage: IssueUsage | null;
  agents: Agent[];
  onOpenRun(id: string): void;
}) {
  const [mode, setMode] = useState<"per" | "cum">("per");
  const [metric, setMetric] = useState<"cost" | "token" | "work">("work");
  const sorted = useMemo(() => [...runs].sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at)), [runs]);
  const totalTokens = (usage?.total_input_tokens ?? 0) + (usage?.total_output_tokens ?? 0) + (usage?.total_cache_read_tokens ?? 0) + (usage?.total_cache_write_tokens ?? 0);
  const workMs = runs.reduce((s, r) => s + runDurationMs(r), 0);
  const failed = runs.filter((r) => r.status === "failed" || r.status === "error").length;
  const cancelled = runs.filter((r) => r.status === "cancelled").length;

  const agentIds = useMemo(() => [...new Set(sorted.map((r) => r.agent_id))], [sorted]);
  const hueOf = (id: string) => AGENT_HUES[Math.max(0, agentIds.indexOf(id)) % AGENT_HUES.length];
  const valueOf = (r: TaskRun) => (metric === "token" ? runTokens(r) : metric === "work" ? runDurationMs(r) : 0);
  const bars = useMemo(() => {
    if (mode === "per") return sorted.map((r) => ({ key: r.id, label: fmtClock(r.created_at), value: valueOf(r), hue: hueOf(r.agent_id), run: r }));
    return agentIds.map((id) => {
      const list = sorted.filter((r) => r.agent_id === id);
      return { key: id, label: agents.find((a) => a.id === id)?.name ?? id.slice(0, 6), value: list.reduce((s, r) => s + valueOf(r), 0), hue: hueOf(id), run: null as TaskRun | null };
    });
  }, [mode, sorted, agentIds, metric, agents]);
  const maxBar = Math.max(1, ...bars.map((b) => b.value));

  const days = useMemo(() => {
    const groups: { label: string; rows: TaskRun[] }[] = [];
    for (const run of [...sorted].reverse()) {
      const label = dayLabel(run.created_at);
      const group = groups.find((g) => g.label === label);
      if (group) group.rows.push(run);
      else groups.push({ label, rows: [run] });
    }
    return groups;
  }, [sorted]);

  if (!open) return null;
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 60, backgroundColor: ui.c.scrim, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Pressable accessibilityLabel={t("Execution.30")} onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ width: "100%", maxWidth: 860, maxHeight: "92%", borderRadius: 12, borderWidth: 1, borderColor: ui.c.border, backgroundColor: ui.c.card, boxShadow: ui.c.shadowLift, overflow: "hidden" }}>
        <View style={[ui.s.row, { gap: 8, paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: ui.c.line }]}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: "600", color: ui.c.fg }}>{t("Execution.31")}</Text>
            <Text numberOfLines={1} style={ui.s.tiny}>{issueIdentifier} · {issueTitle}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={t("Execution.32")} onPress={onClose} style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}>
            <Icon name="X" size={16} color={ui.c.muted} />
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 620 }} contentContainerStyle={{ padding: 18, gap: 16 }}>
          <View style={[ui.s.row, { gap: 18, flexWrap: "wrap" }]}>
            <StatBlock ui={ui} value={`$${((usage?.cost_usd_ticks ?? 0) / 1_000_000).toFixed(2)}`} label={t("Execution.20")} />
            <StatBlock ui={ui} value={fmtTokens(totalTokens)} label={t("Execution.34", { a: fmtTokens(usage?.total_input_tokens ?? 0) })} />
            <StatBlock ui={ui} value={fmtTokens(usage?.total_output_tokens ?? 0)} label={t("Execution.35")} />
            <StatBlock ui={ui} value={fmtDuration(workMs)} label={t("Execution.21")} />
            <StatBlock ui={ui} value={`${runs.length}`} label={t("Execution.37", { a: failed, b: cancelled })} />
          </View>

          <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
            <View style={[ui.s.row, { gap: 2, padding: 2, borderRadius: 8, backgroundColor: ui.c.fill }]}>
              {(["per", "cum"] as const).map((m) => (
                <Pressable accessibilityRole="button" accessibilityLabel={m === "per" ? t("Execution.38") : t("Execution.39")} key={m} onPress={() => setMode(m)} style={({ pressed }) => [ui.s.row, { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, backgroundColor: mode === m ? ui.c.card : "transparent" }, pressed && ui.s.pressed]}>
                  <Text style={{ fontSize: 12, color: mode === m ? ui.c.fg : ui.c.muted, fontWeight: mode === m ? "600" : "400" }}>{m === "per" ? t("Execution.38") : t("Execution.39")}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[ui.s.row, { gap: 2, padding: 2, borderRadius: 8, backgroundColor: ui.c.fill }]}>
              {(["cost", "token", "work"] as const).map((m) => (
                <Pressable accessibilityRole="button" accessibilityLabel={m === "cost" ? t("Execution.42") : m === "token" ? "Token" : t("Execution.21")} key={m} onPress={() => setMetric(m)} style={({ pressed }) => [ui.s.row, { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 6, backgroundColor: metric === m ? ui.c.card : "transparent" }, pressed && ui.s.pressed]}>
                  <Text style={{ fontSize: 12, color: metric === m ? ui.c.fg : ui.c.muted, fontWeight: metric === m ? "600" : "400" }}>{m === "cost" ? t("Execution.42") : m === "token" ? "Token" : t("Execution.21")}</Text>
                </Pressable>
              ))}
            </View>
            <View style={[ui.s.row, { gap: 8, flexWrap: "wrap", flex: 1, justifyContent: "flex-end" }]}>
              {agentIds.slice(0, 8).map((id) => (
                <View key={id} style={[ui.s.row, { gap: 4 }]}>
                  <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: hueOf(id) }} />
                  <Text style={{ fontSize: 11, color: ui.c.muted }}>{agents.find((a) => a.id === id)?.name ?? id.slice(0, 6)}</Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ gap: 3, minHeight: 90, justifyContent: "flex-end" }}>
            {bars.length === 0 ? <Text style={ui.s.tiny}>{t("Execution.46")}</Text> : null}
            <View style={[ui.s.row, { gap: 2, alignItems: "flex-end", height: 80 }]}>
              {bars.slice(-60).map((b) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`${b.label} ${metric === "work" ? fmtDuration(b.value) : fmtTokens(b.value)}`}
                  key={b.key}
                  onPress={() => b.run && onOpenRun(b.run.id)}
                  style={{ flex: 1, minWidth: 3, height: Math.max(3, Math.round((b.value / maxBar) * 76)), backgroundColor: b.hue, borderRadius: 2, opacity: 0.9 }}
                />
              ))}
            </View>
            <View style={[ui.s.row, { justifyContent: "space-between" }]}>
              <Text style={ui.s.tiny}>{bars[0]?.label ?? ""}</Text>
              <Text style={ui.s.tiny}>{bars[bars.length - 1]?.label ?? ""}</Text>
            </View>
          </View>

          <View style={{ gap: 10 }}>
            <View style={[ui.s.row, { gap: 8, paddingHorizontal: 4 }]}>
              <Text style={[ui.s.tiny, { width: 44 }]}>{t("Execution.47")}</Text>
              <Text style={[ui.s.tiny, { flex: 1 }]}>{t("Execution.48")}</Text>
              <Text style={[ui.s.tiny, { width: 90 }]}>{t("AgentDetail.23")}</Text>
              <Text style={[ui.s.tiny, { width: 90 }]}>{t("AgentDetail.99")}</Text>
              <Text style={[ui.s.tiny, { width: 56, textAlign: "right" }]}>{t("Execution.51")}</Text>
              <Text style={[ui.s.tiny, { width: 56, textAlign: "right" }]}>Token</Text>
            </View>
            {days.map((day) => (
              <View key={day.label} style={{ gap: 2 }}>
                <Text style={[ui.s.label, { paddingHorizontal: 4, paddingTop: 6 }]}>{day.label}</Text>
                {day.rows.map((run) => {
                  const agent = agents.find((a) => a.id === run.agent_id);
                  return (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("Execution.52", { a: fmtClock(run.created_at), b: agent?.name ?? "" })}
                      key={run.id}
                      onPress={() => onOpenRun(run.id)}
                      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                        ui.s.row,
                        { gap: 8, paddingHorizontal: 4, paddingVertical: 7, borderRadius: 6 },
                        hovered && { backgroundColor: ui.c.fillHover },
                        pressed && ui.s.pressed,
                      ]}
                    >
                      <Text style={[ui.s.tiny, { width: 44 }]}>{fmtClock(run.created_at)}</Text>
                      <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: ui.c.fg }}>
                        {run.attribution?.evidence?.kind === "comment" ? t("Execution.23") : run.kind === "direct" ? t("Execution.54") : t("Execution.25")}
                        {run.result?.output ? ` · ${run.result.output.slice(0, 30)}` : ""}
                      </Text>
                      <View style={[ui.s.row, { gap: 4, width: 90 }]}>
                        {agent ? <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={14} /> : null}
                        <Text numberOfLines={1} style={{ fontSize: 11, color: ui.c.muted }}>{agent?.name ?? "—"}</Text>
                      </View>
                      <Text numberOfLines={1} style={{ fontSize: 11, color: ui.c.muted, width: 90 }}>{runModel(run)}</Text>
                      <Text style={[ui.s.tiny, { width: 56, textAlign: "right" }]}>{fmtDuration(runDurationMs(run))}</Text>
                      <Text style={[ui.s.tiny, { width: 56, textAlign: "right" }]}>{fmtTokens(runTokens(run))}</Text>
                      <Icon name="ChevronRight" size={12} color={ui.c.faint} />
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

interface Step {
  id: string;
  offsetMs: number;
  durationMs: number | null;
  kind: "tool" | "think" | "text";
  tool: string;
  title: string;
  detail: string;
}

/** 图5：单次运行日志（触发内容 / 产出 / 模型与工具时间条 / 可搜索步骤）。 */
export function RunLogModal({
  ui,
  run,
  agents,
  comments,
  onClose,
}: {
  ui: Ui;
  run: TaskRun | null;
  agents: Agent[];
  comments: Comment[];
  onClose(): void;
}) {
  const [search, setSearch] = useState("");
  const logRpc = useRpc(taskLogRpc);
  const logRef = useRef(logRpc);
  logRef.current = logRpc;
  const [messages, setMessages] = useState<{ call_id?: string; seq?: number; type?: string; tool?: string; input?: Record<string, unknown>; output?: string; content?: string; created_at?: string }[]>([]);
  const [logLoading, setLogLoading] = useState(true);
  const runId = run?.id ?? null;
  const runStatus = run?.status ?? null;

  useEffect(() => {
    if (!runId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    setLogLoading(true);
    const load = async () => {
      try {
        const result = await logRef.current({ taskId: runId });
        if (!alive) return;
        setMessages((result.messages ?? []) as typeof messages);
        setLogLoading(false);
      } catch {
        if (alive) setLogLoading(false);
      } finally {
        // 运行中 messages 可能长轮询：串行续 poll，避免请求堆积堵死 RPC 通道
        if (alive && runStatus === "running") timer = setTimeout(() => void load(), 4000);
      }
    };
    void load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [runId, runStatus]);
  const started = run?.started_at ? Date.parse(run.started_at) : 0;
  const totalMs = run ? runDurationMs(run) : 0;

  const steps: Step[] = useMemo(() => {
    const results = new Map<string, { created_at?: string }>();
    for (const m of messages) if (m.type === "tool_result" && m.call_id) results.set(m.call_id, m);
    const list: Step[] = [];
    for (const m of messages) {
      const at = m.created_at ? Date.parse(m.created_at) : started;
      if (m.type === "tool_use") {
        const input = m.input ?? {};
        const res = m.call_id ? results.get(m.call_id) : undefined;
        const dur = res?.created_at ? Math.max(0, Date.parse(res.created_at) - at) : null;
        const title = str(input.description) || str(input.command).split("\n")[0] || str(input.file_path) || str(input.pattern) || m.tool || t("Execution.56");
        list.push({ id: m.call_id ?? `s${m.seq}`, offsetMs: Math.max(0, at - started), durationMs: dur, kind: "tool", tool: m.tool ?? "Tool", title, detail: str(input.command) || str(input.file_path) || str(input.pattern) || "" });
      } else if (m.type === "thinking" || m.type === "think") {
        list.push({ id: `t${m.seq}`, offsetMs: Math.max(0, at - started), durationMs: null, kind: "think", tool: t("Execution.57"), title: (m.content ?? "").split("\n")[0].slice(0, 140), detail: m.content ?? "" });
      } else if (m.type === "text" || m.type === "assistant") {
        list.push({ id: `x${m.seq}`, offsetMs: Math.max(0, at - started), durationMs: null, kind: "text", tool: t("Execution.58"), title: (m.content ?? "").split("\n")[0].slice(0, 140), detail: m.content ?? "" });
      }
    }
    return list.sort((a, b) => a.offsetMs - b.offsetMs);
  }, [messages, started]);

  const toolMs = steps.reduce((s, x) => s + (x.durationMs ?? 0), 0);
  const modelMs = Math.max(0, totalMs - toolMs);
  const commandCount = steps.filter((s) => s.kind === "tool" && /bash|shell|exec/i.test(s.tool)).length;
  const needle = search.trim().toLowerCase();
  const visible = needle ? steps.filter((s) => `${s.title} ${s.detail} ${s.tool}`.toLowerCase().includes(needle)) : steps;
  const agent = run ? agents.find((a) => a.id === run.agent_id) : null;
  const triggerComment = run?.attribution?.evidence?.kind === "comment" ? comments.find((c) => c.id === run.attribution?.evidence?.ref_id) : null;
  const [openStep, setOpenStep] = useState<string | null>(null);

  if (!run) return null;
  const axisMax = Math.max(totalMs, 1000);
  return (
    <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 70, backgroundColor: ui.c.scrim, alignItems: "center", justifyContent: "center", padding: 24 }}>
      <Pressable accessibilityLabel={t("Execution.59")} onPress={onClose} style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} />
      <View style={{ width: "100%", maxWidth: 860, maxHeight: "92%", borderRadius: 12, borderWidth: 1, borderColor: ui.c.border, backgroundColor: ui.c.card, boxShadow: ui.c.shadowLift, overflow: "hidden" }}>
        <View style={[ui.s.row, { gap: 8, paddingHorizontal: 18, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: ui.c.line, flexWrap: "wrap" }]}>
          <Tag ui={ui} label={run.status === "running" ? t("Execution.60") : run.status === "completed" ? t("AgentDetail.6") : run.status === "failed" || run.status === "error" ? t("AgentDetail.7") : run.status} tone={run.status === "running" ? "accent" : run.status === "completed" ? "success" : "danger"} />
          {agent ? <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={18} /> : null}
          <Text style={{ fontSize: 13, fontWeight: "600", color: ui.c.fg }}>{agent?.name ?? t("AgentDetail.23")}</Text>
          <Text style={ui.s.tiny}>{run.attribution?.initiator?.name ?? ""} · {run.attribution?.evidence?.kind === "comment" ? t("Execution.23") : run.kind === "direct" ? t("Execution.24") : t("Execution.25")} {t("Execution.67")} {fmtDuration(totalMs)}</Text>
          <View style={{ flex: 1 }} />
          <Pressable accessibilityRole="button" accessibilityLabel={t("Execution.32")} onPress={onClose} style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}>
            <Icon name="X" size={16} color={ui.c.muted} />
          </Pressable>
        </View>
        <ScrollView style={{ maxHeight: 600 }} contentContainerStyle={{ padding: 18, gap: 14 }}>
          <View style={{ gap: 4 }}>
            <Text style={ui.s.label}>{t("Execution.69")}</Text>
            <Text style={{ fontSize: 13, color: ui.c.fg }}>
              {triggerComment?.content?.slice(0, 300) ??
                (run.attribution?.evidence?.kind === "comment"
                  ? t("Execution.23")
                  : run.attribution?.source === "direct_human"
                    ? t("Execution.71", { a: run.attribution?.initiator?.name ?? t("Execution.11") })
                    : run.attribution?.source === "schedule" || run.attribution?.source === "autopilot"
                      ? t("Execution.73")
                      : run.attribution?.source ?? "—")}
            </Text>
          </View>
          <View style={[ui.s.row, { gap: 8 }]}>
            <Text style={ui.s.label}>{t("Execution.74")}</Text>
            <View style={[ui.s.row, { gap: 5, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: ui.c.fill }]}>
              <Icon name="Terminal" size={12} color={ui.c.muted} />
              <Text style={{ fontSize: 12, color: ui.c.fg }}>{commandCount} {t("Execution.75")}</Text>
            </View>
          </View>
          <View style={{ gap: 6 }}>
            {[
              { label: t("AgentDetail.99"), ms: modelMs, hue: ui.c.brand },
              { label: t("Execution.56"), ms: toolMs, hue: ui.c.success },
            ].map((row) => (
              <View key={row.label} style={[ui.s.row, { gap: 8 }]}>
                <Text style={[ui.s.tiny, { width: 34 }]}>{row.label}</Text>
                <Text style={[ui.s.tiny, { width: 52 }]}>{fmtDuration(row.ms)}</Text>
                <View style={{ flex: 1, height: 10, borderRadius: 5, backgroundColor: ui.c.fill, overflow: "hidden" }}>
                  <View style={{ width: `${Math.min(100, (row.ms / axisMax) * 100)}%`, height: 10, borderRadius: 5, backgroundColor: row.hue }} />
                </View>
              </View>
            ))}
            <View style={[ui.s.row, { justifyContent: "space-between", paddingLeft: 94 }]}>
              <Text style={ui.s.tiny}>0s</Text>
              <Text style={ui.s.tiny}>{fmtDuration(axisMax / 2)}</Text>
              <Text style={ui.s.tiny}>{fmtDuration(axisMax)}</Text>
            </View>
          </View>
          <View style={[ui.s.row, { gap: 8, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: ui.c.border, backgroundColor: ui.c.card, height: 32 }]}>
            <Icon name="Search" size={13} color={ui.c.muted} />
            <TextInput value={search} onChangeText={setSearch} placeholder={t("Execution.78")} placeholderTextColor={ui.c.faint} style={{ flex: 1, fontSize: 12.5, color: ui.c.fg, paddingVertical: 4 }} />
            <Text style={ui.s.tiny}>{visible.length} {t("Execution.79")}</Text>
          </View>
          <View style={{ gap: 2 }}>
            {logLoading && steps.length === 0 ? (
              <View style={[ui.s.row, { gap: 8, justifyContent: "center", padding: 14 }]}>
                <ActivityIndicator size="small" color={ui.c.muted} />
                <Text style={ui.s.muted}>{t("Execution.80")}</Text>
              </View>
            ) : null}
            {visible.map((step) => {
              const open = openStep === step.id;
              return (
                <View key={step.id}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Execution.81", { a: fmtDuration(step.offsetMs), b: step.title })}
                    accessibilityState={{ expanded: open }}
                    onPress={() => setOpenStep(open ? null : step.id)}
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                      ui.s.row,
                      { gap: 8, paddingHorizontal: 6, paddingVertical: 7, borderRadius: 6 },
                      hovered && { backgroundColor: ui.c.fillHover },
                      pressed && ui.s.pressed,
                    ]}
                  >
                    <Text style={[ui.s.tiny, { width: 52, fontFamily: "Menlo" }]}>+{fmtDuration(step.offsetMs)}</Text>
                    <Icon name={step.kind === "tool" ? (/bash|shell|exec/i.test(step.tool) ? "Terminal" : "Wrench") : step.kind === "think" ? "Brain" : "MessageSquare"} size={13} color={ui.c.muted} />
                    <Text style={{ fontSize: 12, fontWeight: "600", color: ui.c.fg, width: 40 }}>{step.kind === "tool" ? step.tool : step.tool}</Text>
                    <Text numberOfLines={open ? undefined : 1} style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: ui.c.fg }}>{step.title}</Text>
                    {step.durationMs != null ? <Text style={ui.s.tiny}>{step.durationMs < 100 ? "<0.1s" : fmtDuration(step.durationMs)}</Text> : null}
                  </Pressable>
                  {open && step.detail ? (
                    <ScrollView style={{ maxHeight: 180, marginLeft: 60, marginBottom: 6 }} nestedScrollEnabled>
                      <Text selectable style={{ fontFamily: "Menlo", fontSize: 11, lineHeight: 16, color: ui.c.fg, backgroundColor: ui.c.fill, borderRadius: 6, padding: 8, overflowWrap: "anywhere" } as TextStyle}>{step.detail.slice(0, 6000)}</Text>
                    </ScrollView>
                  ) : null}
                </View>
              );
            })}
            {!logLoading && visible.length === 0 ? <Text style={[ui.s.tiny, { padding: 8 }]}>{t("Execution.82")}</Text> : null}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}