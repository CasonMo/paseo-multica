import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { asList, useQuery } from "../api";
import {
  Avatar,
  Btn,
  Card,
  Chips,
  Empty,
  ErrorNote,
  Field,
  IconBtn,
  LoadingRow,
  Tag,
  useUi,
  type Ui,
} from "../bits";
import { useWorkbench } from "../context";
import { fmtDateTime, relTime, type Agent, type Autopilot, type Squad } from "../model";

const RUN_STATUS: Record<string, { label: string; tone: "success" | "danger" | "muted" | "warning" | "accent" }> = {
  issue_created: { label: "已创建任务", tone: "accent" },
  running: { label: "运行中", tone: "accent" },
  completed: { label: "已完成", tone: "success" },
  failed: { label: "失败", tone: "danger" },
  skipped: { label: "已跳过", tone: "warning" },
};

const TRIGGER_LABEL: Record<string, string> = { schedule: "定时", webhook: "Webhook", api: "API" };

type Filter = "all" | "active" | "paused";

export function AutomationPage() {
  const ctx = useWorkbench();
  const { theme, compact, api, workspaceId, toast, invalidate, bump, navigate } = ctx;
  const ui = useUi(theme, compact);
  const key = `${workspaceId}:${bump}`;
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [runsFor, setRunsFor] = useState<Autopilot | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useQuery(
    api,
    "/api/autopilots",
    { query: { limit: 100 }, select: (data) => asList<Autopilot>(data, "autopilots") },
    key,
  );
  const agentsQuery = useQuery(api, "/api/agents", { query: { limit: 100 }, select: (data) => asList<Agent>(data, "agents") }, key);
  const squadsQuery = useQuery(api, "/api/squads", { select: (data) => asList<Squad>(data, "squads") }, key);
  const agents = agentsQuery.data ?? [];
  const squads = squadsQuery.data ?? [];

  const nameOf = (item: Autopilot) => {
    if (item.assignee_type === "squad") return squads.find((s) => s.id === item.assignee_id)?.name ?? "小队";
    return agents.find((a) => a.id === item.assignee_id)?.name ?? "智能体";
  };

  const list = useMemo(
    () => (query.data ?? []).filter((item) => filter === "all" || item.status === filter),
    [query.data, filter],
  );

  const counts = useMemo(() => {
    const all = query.data ?? [];
    return {
      all: all.length,
      active: all.filter((item) => item.status === "active").length,
      paused: all.filter((item) => item.status === "paused").length,
    };
  }, [query.data]);

  const trigger = async (item: Autopilot) => {
    setBusyId(item.id);
    const result = await api({ method: "POST", path: `/api/autopilots/${item.id}/trigger` });
    setBusyId(null);
    if (result.ok) {
      toast.show("已触发一次运行", { variant: "success" });
      query.refresh();
      invalidate();
    } else toast.error(result.error ?? "触发失败");
  };

  const toggle = async (item: Autopilot) => {
    const next = item.status === "active" ? "paused" : "active";
    setBusyId(item.id);
    const result = await api({ method: "PATCH", path: `/api/autopilots/${item.id}`, body: { status: next } });
    setBusyId(null);
    if (result.ok) {
      toast.show(next === "active" ? "已恢复" : "已暂停", { variant: "success" });
      query.refresh();
      invalidate();
    } else toast.error(result.error ?? "操作失败");
  };

  return (
    <ScrollView contentContainerStyle={{ padding: compact ? 12 : 20, gap: 12 }}>
      <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
        <View style={ui.s.grow}>
          <Text style={ui.s.title}>自动化</Text>
          <Text style={ui.s.muted}>定时或通过 Webhook / API 触发的智能体任务</Text>
        </View>
        <Btn ui={ui} label="新建" icon="Plus" tone="primary" onPress={() => setCreateOpen(true)} />
        <IconBtn ui={ui} icon="RefreshCw" label="刷新" busy={query.refreshing} onPress={query.refresh} />
      </View>

      <Chips<Filter>
        ui={ui}
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: `全部 ${counts.all}` },
          { value: "active", label: `运行中 ${counts.active}` },
          { value: "paused", label: `已暂停 ${counts.paused}` },
        ]}
      />

      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      {query.loading && !query.data ? <LoadingRow ui={ui} /> : null}
      {!query.loading && list.length === 0 ? (
        <Card ui={ui} padded={false}>
          <Empty
            ui={ui}
            icon="Bot"
            title="还没有自动化"
            description="创建一条自动化，让智能体按时或按事件自动开始工作。"
            action={<Btn ui={ui} label="新建自动化" icon="Plus" tone="primary" onPress={() => setCreateOpen(true)} />}
          />
        </Card>
      ) : null}

      <View style={{ flexDirection: compact ? "column" : "row", flexWrap: "wrap", gap: 12 }}>
        {list.map((item) => (
          <Card
            key={item.id}
            ui={ui}
            style={{ width: compact ? "100%" : "48%", gap: 10, minWidth: compact ? undefined : 300 }}
          >
            <View style={[ui.s.rowTop, { gap: 10 }]}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[ui.s.body, { fontWeight: "700", fontSize: 14.5 }]}>{item.title}</Text>
                <Text numberOfLines={2} style={ui.s.muted}>
                  {item.description || "没有描述"}
                </Text>
              </View>
              <Tag
                ui={ui}
                label={item.status === "active" ? "运行中" : item.status === "paused" ? "已暂停" : item.status}
                tone={item.status === "active" ? "success" : item.status === "paused" ? "warning" : "muted"}
                icon={item.status === "active" ? "Radio" : "Pause"}
              />
            </View>

            <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
              <Tag ui={ui} label={nameOf(item)} icon={item.assignee_type === "squad" ? "Users" : "Bot"} />
              <Tag
                ui={ui}
                label={item.execution_mode === "create_issue" ? "创建任务" : "直接执行"}
                tone="muted"
                icon={item.execution_mode === "create_issue" ? "ListTodo" : "Play"}
              />
              {(item.trigger_kinds ?? []).map((kind) => (
                <Tag key={kind} ui={ui} label={TRIGGER_LABEL[kind] ?? kind} tone="accent" icon="Zap" />
              ))}
            </View>

            <View style={{ gap: 3 }}>
              <View style={[ui.s.row, { justifyContent: "space-between" }]}>
                <Text style={ui.s.tiny}>下次运行</Text>
                <Text style={ui.s.tiny}>{item.next_run_at ? fmtDateTime(item.next_run_at) : "—"}</Text>
              </View>
              <View style={[ui.s.row, { justifyContent: "space-between" }]}>
                <Text style={ui.s.tiny}>上次运行</Text>
                <Text style={ui.s.tiny}>
                  {item.last_run_status ? RUN_STATUS[item.last_run_status]?.label ?? item.last_run_status : "—"}
                  {item.last_run_at ? ` · ${relTime(item.last_run_at)}` : ""}
                </Text>
              </View>
            </View>

            <View style={[ui.s.row, { gap: 6, justifyContent: "flex-end" }]}>
              <Btn ui={ui} label="运行记录" onPress={() => setRunsFor(item)} />
              <Btn
                ui={ui}
                label={item.status === "active" ? "暂停" : "恢复"}
                icon={item.status === "active" ? "Pause" : "Play"}
                busy={busyId === item.id}
                onPress={() => void toggle(item)}
              />
              <Btn ui={ui} label="立即运行" icon="Zap" tone="primary" busy={busyId === item.id} onPress={() => void trigger(item)} />
            </View>
          </Card>
        ))}
      </View>

      <CreateAutopilotModal
        ui={ui}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        agents={agents}
        squads={squads}
        onCreate={async (body, cron, timezone) => {
          const result = await api({ method: "POST", path: "/api/autopilots", body });
          if (!result.ok) {
            toast.error(result.error ?? "创建失败");
            return false;
          }
          const created = result.data as { id?: string; autopilot?: { id?: string } } | null;
          const id = created?.id ?? created?.autopilot?.id;
          if (id && cron.trim()) {
            const triggerResult = await api({
              method: "POST",
              path: `/api/autopilots/${id}/triggers`,
              body: { kind: "schedule", cron_expression: cron.trim(), timezone },
            });
            if (!triggerResult.ok) toast.error(triggerResult.error ?? "触发计划创建失败");
          }
          toast.show("自动化已创建", { variant: "success" });
          setCreateOpen(false);
          query.refresh();
          invalidate();
          return true;
        }}
      />

      <RunsModal ui={ui} item={runsFor} onClose={() => setRunsFor(null)} onOpenIssue={(id) => navigate("issue", { id })} />
    </ScrollView>
  );
}

function CreateAutopilotModal({
  ui,
  open,
  onClose,
  agents,
  squads,
  onCreate,
}: {
  ui: Ui;
  open: boolean;
  onClose(): void;
  agents: Agent[];
  squads: Squad[];
  onCreate(body: Record<string, unknown>, cron: string, timezone: string): Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"create_issue" | "run_only">("create_issue");
  const [target, setTarget] = useState("");
  const [cron, setCron] = useState("0 9 * * 1-5");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets = [
    ...agents.map((agent) => ({ id: agent.id, name: agent.name, kind: "agent" as const, avatar: agent.avatar_url })),
    ...squads.map((squad) => ({ id: squad.id, name: squad.name, kind: "squad" as const, avatar: squad.avatar_url })),
  ];

  return (
    <Modal title="新建自动化" icon={<Icon name="Bot" size={16} color={ui.c.muted} />} open={open} onOpenChange={(next) => !next && onClose()}>
      <Modal.Content>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 12 }}>
          <Field ui={ui} label="名称" value={title} onChangeText={setTitle} placeholder="例如：每天早上总结未完成任务" />
          <Field ui={ui} label="描述" value={description} onChangeText={setDescription} multiline placeholder="这条自动化要做什么" />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>执行方式</Text>
            <Chips<"create_issue" | "run_only">
              ui={ui}
              value={mode}
              onChange={setMode}
              options={[
                { value: "create_issue", label: "创建任务并执行", icon: "ListTodo" },
                { value: "run_only", label: "直接执行", icon: "Play" },
              ]}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>执行者</Text>
            <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 6 }}>
              {targets.length === 0 ? (
                <Text style={ui.s.muted}>当前工作区还没有可用的智能体或小队，请先在「团队」页创建。</Text>
              ) : null}
              {targets.map((item) => {
                const active = target === `${item.kind}:${item.id}`;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={`${item.kind}:${item.id}`}
                    onPress={() => setTarget(`${item.kind}:${item.id}`)}
                    style={({ pressed }) => [
                      ui.s.row,
                      {
                        gap: 8,
                        padding: 9,
                        borderRadius: 9,
                        borderWidth: 1,
                        borderColor: active ? ui.c.accent : ui.c.border,
                        backgroundColor: active ? `${ui.c.accent}12` : ui.c.surface0,
                      },
                      pressed && ui.s.pressed,
                    ]}
                  >
                    <Avatar ui={ui} name={item.name} url={item.avatar} size={24} />
                    <Text style={[ui.s.body, { flex: 1 }]}>{item.name}</Text>
                    <Text style={ui.s.tiny}>{item.kind === "squad" ? "小队" : "智能体"}</Text>
                    {active ? <Icon name="Check" size={14} color={ui.c.accent} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <Field
            ui={ui}
            label="定时表达式（Cron）"
            value={cron}
            onChangeText={setCron}
            code
            hint="留空则不创建定时触发器，之后仍可手动或通过 API 触发。"
          />
          {error ? <ErrorNote ui={ui} message={error} /> : null}
        </ScrollView>
        <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
          <Btn ui={ui} label="取消" onPress={onClose} />
          <Btn
            ui={ui}
            label="创建"
            tone="primary"
            busy={busy}
            onPress={async () => {
              if (!title.trim()) return setError("请填写名称");
              if (!target) return setError("请选择执行者");
              const [kind, id] = target.split(":");
              setBusy(true);
              setError(null);
              const done = await onCreate(
                {
                  title: title.trim(),
                  description: description.trim() || undefined,
                  assignee_type: kind,
                  assignee_id: id,
                  execution_mode: mode,
                },
                cron,
                "Asia/Shanghai",
              );
              setBusy(false);
              if (done) {
                setTitle("");
                setDescription("");
                setTarget("");
              }
            }}
          />
        </View>
      </Modal.Content>
    </Modal>
  );
}

function RunsModal({
  ui,
  item,
  onClose,
  onOpenIssue,
}: {
  ui: Ui;
  item: Autopilot | null;
  onClose(): void;
  onOpenIssue(id: string): void;
}) {
  const ctx = useWorkbench();
  const query = useQuery(
    ctx.api,
    item ? `/api/autopilots/${item.id}/runs` : null,
    { query: { limit: 30 }, select: (data) => asList<Record<string, unknown>>(data, "runs") },
    item?.id,
  );
  return (
    <Modal title={item ? `运行记录 · ${item.title}` : "运行记录"} open={Boolean(item)} onOpenChange={(next) => !next && onClose()}>
      <Modal.Content>
        {query.loading ? <LoadingRow ui={ui} /> : null}
        {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
        {!query.loading && (query.data ?? []).length === 0 ? (
          <Empty ui={ui} icon="History" title="还没有运行记录" description="触发一次运行后，这里会显示结果。" />
        ) : null}
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 6 }}>
          {(query.data ?? []).map((run) => {
            const status = String(run.status ?? "");
            const meta = RUN_STATUS[status] ?? { label: status || "未知", tone: "muted" as const };
            const issueId = typeof run.issue_id === "string" ? run.issue_id : null;
            return (
              <View
                key={String(run.id)}
                style={[ui.s.row, { gap: 8, padding: 9, borderRadius: 9, backgroundColor: ui.c.surface0 }]}
              >
                <Tag ui={ui} label={meta.label} tone={meta.tone} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={ui.s.tiny}>{fmtDateTime(String(run.triggered_at ?? ""))}</Text>
                  {run.failure_reason ? (
                    <Text numberOfLines={2} style={[ui.s.tiny, { color: ui.c.danger }]}>
                      {String(run.failure_reason)}
                    </Text>
                  ) : null}
                </View>
                <Text style={ui.s.tiny}>{String(run.source ?? "")}</Text>
                {issueId ? (
                  <Btn ui={ui} label="任务" onPress={() => { onClose(); onOpenIssue(issueId); }} />
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      </Modal.Content>
    </Modal>
  );
}
