import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { ScrollView, Text, View } from "react-native";
import { asList, asRecord, num, str, useQuery } from "./api";
import { Bars, Btn, Divider, ErrorNote, LoadingRow, Stat, Tag, useUi } from "./bits";
import { useWorkbench } from "./context";
import { relTime, type Agent, type AgentRuntime } from "./model";

interface ActivityPoint {
  hour: number;
  count: number;
}

interface UsageRow {
  runtime_id?: string;
  date?: string;
  provider?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  cache_write_tokens?: number;
  cost_usd_ticks?: number;
}

interface AgentUsageRow extends UsageRow {
  agent_id?: string;
  task_count?: number;
}

function compact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

export function RuntimeDetailModal({
  runtime,
  agents,
  onClose,
}: {
  runtime: AgentRuntime | null;
  agents: Agent[];
  onClose(): void;
}) {
  const ctx = useWorkbench();
  const ui = useUi(ctx.theme, ctx.compact);
  const api = ctx.api;
  const key = runtime?.id ?? "";

  const activity = useQuery(
    api,
    runtime ? `/api/runtimes/${runtime.id}/activity` : null,
    { select: (data) => asList<ActivityPoint>(data) },
    key,
  );
  const usage = useQuery(
    api,
    runtime ? `/api/runtimes/${runtime.id}/usage` : null,
    { select: (data) => asList<UsageRow>(data) },
    key,
  );
  const byAgent = useQuery(
    api,
    runtime ? `/api/runtimes/${runtime.id}/usage/by-agent` : null,
    { select: (data) => asList<AgentUsageRow>(data) },
    key,
  );
  const rateLimits = useQuery(
    api,
    runtime ? `/api/runtimes/${runtime.id}/rate-limits` : null,
    { select: (data) => asRecord(asRecord(data).rate_limits) },
    key,
  );

  const points = activity.data ?? [];
  const usageRows = usage.data ?? [];
  const agentRows = byAgent.data ?? [];
  const limits = rateLimits.data ?? {};
  const hasLimits = Object.keys(limits).length > 0;
  const online = runtime?.status === "online";

  const sum = (rows: UsageRow[], field: keyof UsageRow) =>
    rows.reduce((total, row) => total + num(row[field]), 0);
  const tasks = points.reduce((total, point) => total + num(point.count), 0);
  const byHour = new Map(points.map((point) => [num(point.hour), num(point.count)]));
  const hourly = Array.from({ length: 24 }, (_, hour) => ({ label: String(hour), value: byHour.get(hour) ?? 0 }));

  const agentName = (id: string) => agents.find((item) => item.id === id)?.name ?? id.slice(0, 8);

  const refreshAll = () => {
    activity.refresh();
    usage.refresh();
    byAgent.refresh();
    rateLimits.refresh();
  };

  return (
    <Modal
      title={runtime ? runtime.custom_name || runtime.name : "运行时"}
      icon={<Icon name="Server" size={16} color={ui.c.muted} />}
      open={Boolean(runtime)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Content>
        {!runtime ? null : (
          <View style={{ gap: 12 }}>
            <View style={[ui.s.rowTop, { gap: 10 }]}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: online ? `${ui.c.success}20` : ui.c.surface2,
                }}
              >
                <Icon name="Server" size={18} color={online ? ui.c.success : ui.c.muted} />
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={{ color: ui.c.fg, fontSize: 16, fontWeight: "700" }}>{runtime.custom_name || runtime.name}</Text>
                <Text style={ui.s.tiny}>
                  {runtime.provider ?? "provider"} · {runtime.device_info || "未知设备"}
                </Text>
                <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
                  <Tag ui={ui} label={online ? "在线" : "离线"} tone={online ? "success" : "muted"} />
                  <Tag ui={ui} label={runtime.visibility === "private" ? "私有" : "工作区"} tone="muted" />
                  <Tag ui={ui} label={online ? "刚刚活跃" : `最后在线 ${relTime(runtime.last_seen_at)}`} tone="muted" icon="Clock" />
                </View>
              </View>
            </View>

            <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
              <Stat ui={ui} label="任务数" value={tasks} icon="Activity" />
              <Stat ui={ui} label="输入 Tokens" value={compact(sum(usageRows, "input_tokens"))} icon="ArrowDown" />
              <Stat ui={ui} label="输出 Tokens" value={compact(sum(usageRows, "output_tokens"))} icon="ArrowUp" />
              <Stat ui={ui} label="缓存读取" value={compact(sum(usageRows, "cache_read_tokens"))} icon="Database" />
            </View>

            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 12 }}>
              {activity.error ? <ErrorNote ui={ui} message={activity.error} onRetry={activity.refresh} /> : null}
              <View style={{ gap: 8 }}>
                <View style={[ui.s.row, { justifyContent: "space-between" }]}>
                  <Text style={ui.s.label}>24 小时任务分布</Text>
                  <Btn ui={ui} label="刷新" icon="RefreshCw" onPress={refreshAll} />
                </View>
                {activity.loading && !activity.data ? (
                  <LoadingRow ui={ui} label="读取活动…" />
                ) : tasks === 0 ? (
                  <Text style={ui.s.muted}>暂无活动记录。</Text>
                ) : (
                  <Bars ui={ui} points={hourly} height={56} />
                )}
              </View>

              <Divider ui={ui} />

              <View style={{ gap: 6 }}>
                <Text style={ui.s.label}>按日用量</Text>
                {usage.loading && !usage.data ? (
                  <LoadingRow ui={ui} label="读取用量…" />
                ) : usageRows.length === 0 ? (
                  <Text style={ui.s.muted}>该运行时暂无 Token 用量。</Text>
                ) : (
                  usageRows.map((row, index) => (
                    <View
                      key={`${str(row.date)}-${str(row.model)}-${index}`}
                      style={{ gap: 3, padding: 9, borderRadius: 9, borderWidth: 1, borderColor: ui.c.border, backgroundColor: ui.c.surface0 }}
                    >
                      <View style={[ui.s.row, { gap: 6 }]}>
                        <Text style={[ui.s.body, { fontWeight: "600" }]}>{str(row.date) || "—"}</Text>
                        <Text numberOfLines={1} style={[ui.s.tiny, { flex: 1 }]}>{str(row.model) || "未知模型"}</Text>
                      </View>
                      <Text style={ui.s.tiny}>
                        输入 {compact(num(row.input_tokens))} · 输出 {compact(num(row.output_tokens))} · 缓存读{" "}
                        {compact(num(row.cache_read_tokens))}
                      </Text>
                    </View>
                  ))
                )}
              </View>

              <View style={{ gap: 6 }}>
                <Text style={ui.s.label}>按智能体</Text>
                {byAgent.error ? <ErrorNote ui={ui} message={byAgent.error} onRetry={byAgent.refresh} /> : null}
                {byAgent.loading && !byAgent.data ? (
                  <LoadingRow ui={ui} label="读取智能体用量…" />
                ) : agentRows.length === 0 ? (
                  <Text style={ui.s.muted}>暂无智能体用量。</Text>
                ) : (
                  agentRows.map((row, index) => (
                    <View key={`${str(row.agent_id)}-${index}`} style={[ui.s.row, { gap: 8, paddingVertical: 4 }]}>
                      <Icon name="Bot" size={14} color={ui.c.muted} />
                      <View style={{ flex: 1, gap: 1 }}>
                        <Text style={[ui.s.body, { fontWeight: "600" }]}>{agentName(str(row.agent_id))}</Text>
                        <Text style={ui.s.tiny}>
                          {num(row.task_count)} 个任务 · 输入 {compact(num(row.input_tokens))} · 输出{" "}
                          {compact(num(row.output_tokens))}
                        </Text>
                      </View>
                      <Text style={[ui.s.tiny, { fontFamily: "Menlo" }]}>{compact(num(row.cache_read_tokens))}</Text>
                    </View>
                  ))
                )}
              </View>

              <Divider ui={ui} />
              <View style={{ gap: 4 }}>
                <Text style={ui.s.label}>速率限制</Text>
                <Text style={ui.s.muted}>
                  {rateLimits.status === 404 ? "该运行时未上报速率限制。" : hasLimits ? JSON.stringify(limits).slice(0, 300) : "该运行时未上报速率限制。"}
                </Text>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal.Content>
    </Modal>
  );
}
