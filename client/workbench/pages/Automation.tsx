import { Icon, Modal, copyText } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { asList, asRecord, useQuery, type ApiFn } from "../api";
import {
  Avatar,
  Btn,
  Card,
  Chips,
  Divider,
  Empty,
  ErrorNote,
  Field,
  IconBtn,
  LoadingRow,
  Tag,
  useUi,
  type Ui,
} from "../bits";
import { useWorkbench, type WorkbenchValue } from "../context";
import { fmtDateTime, relTime, type Agent, type Autopilot, type Squad } from "../model";

const RUN_STATUS: Record<string, { label: string; tone: "success" | "danger" | "muted" | "warning" | "accent" }> = {
  issue_created: { label: "已创建任务", tone: "accent" },
  running: { label: "运行中", tone: "accent" },
  completed: { label: "已完成", tone: "success" },
  failed: { label: "失败", tone: "danger" },
  skipped: { label: "已跳过", tone: "warning" },
};

const TRIGGER_LABEL: Record<string, string> = { schedule: "定时", webhook: "Webhook", api: "API" };

const TIMEZONES = [
  "Asia/Shanghai",
  "Asia/Tokyo",
  "UTC",
  "Europe/London",
  "America/New_York",
  "America/Los_Angeles",
];

export type Filter = "all" | "active" | "paused";

interface AutopilotTrigger {
  id: string;
  kind: string;
  enabled: boolean;
  cron_expression?: string | null;
  timezone?: string | null;
  next_run_at?: string | null;
  webhook_url?: string | null;
  webhook_path?: string | null;
  has_signing_secret?: boolean;
  label?: string | null;
  last_fired_at?: string | null;
}

export function AutomationPage({ initialFilter }: { initialFilter?: Filter }) {
  const ctx = useWorkbench();
  const { theme, compact, api, workspaceId, toast, invalidate, bump, navigate } = ctx;
  const ui = useUi(theme, compact);
  const key = `${workspaceId}:${bump}`;
  const [filter, setFilter] = useState<Filter>(initialFilter ?? "all");
  const [createOpen, setCreateOpen] = useState(false);
  const [runsFor, setRunsFor] = useState<Autopilot | null>(null);
  const [detailFor, setDetailFor] = useState<Autopilot | null>(null);
  const [editFor, setEditFor] = useState<Autopilot | null>(null);
  const [deleteFor, setDeleteFor] = useState<Autopilot | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const query = useQuery(
    api,
    "/api/autopilots",
    { query: { limit: 100 }, select: (data) => asList<Autopilot>(data, "autopilots") },
    key,
  );
  const agentsQuery = useQuery(api, "/api/agents", { query: { limit: 100 }, select: (data) => asList<Agent>(data, "agents") }, key);
  const squadsQuery = useQuery(api, "/api/squads", { select: (data) => asList<Squad>(data, "squads") }, key);
  const usageQuery = useQuery(
    api,
    "/api/autopilots/usage",
    { select: (data) => asRecord(data) },
    key,
  );
  const agents = agentsQuery.data ?? [];
  const squads = squadsQuery.data ?? [];
  const usage = usageQuery.data;
  const quotaUsed = typeof usage?.used === "number" ? usage.used : null;
  const quotaLimit = typeof usage?.limit === "number" ? usage.limit : null;

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

  const refreshAll = () => {
    query.refresh();
    usageQuery.refresh();
    invalidate();
  };

  const trigger = async (item: Autopilot) => {
    setBusyId(item.id);
    const result = await api({ method: "POST", path: `/api/autopilots/${item.id}/trigger` });
    setBusyId(null);
    if (result.ok) {
      toast.show("已触发一次运行", { variant: "success" });
      refreshAll();
    } else toast.error(result.error ?? "触发失败");
  };

  const toggle = async (item: Autopilot) => {
    const next = item.status === "active" ? "paused" : "active";
    setBusyId(item.id);
    const result = await api({ method: "PATCH", path: `/api/autopilots/${item.id}`, body: { status: next } });
    setBusyId(null);
    if (result.ok) {
      toast.show(next === "active" ? "已恢复" : "已暂停", { variant: "success" });
      refreshAll();
    } else toast.error(result.error ?? "操作失败");
  };

  const remove = async () => {
    if (!deleteFor) return;
    setBusyId(deleteFor.id);
    const result = await api({ method: "DELETE", path: `/api/autopilots/${deleteFor.id}` });
    setBusyId(null);
    if (result.ok) {
      toast.show("自动化已删除", { variant: "success" });
      if (detailFor?.id === deleteFor.id) setDetailFor(null);
      setDeleteFor(null);
      refreshAll();
    } else toast.error(result.error ?? "删除失败");
  };

  return (
    <ScrollView contentContainerStyle={{ padding: compact ? 12 : 20, gap: 12, paddingBottom: 40 }}>
      <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
        <View style={ui.s.grow}>
          <Text style={ui.s.title}>自动化</Text>
          <Text style={ui.s.muted}>定时或通过 Webhook / API 触发的智能体任务</Text>
        </View>
        <Btn ui={ui} label="新建" icon="Plus" tone="primary" onPress={() => setCreateOpen(true)} />
        <IconBtn ui={ui} icon="RefreshCw" label="刷新" busy={query.refreshing} onPress={refreshAll} />
      </View>

      {quotaUsed !== null && quotaLimit !== null ? (
        <Card ui={ui} style={{ gap: 6 }}>
          <View style={[ui.s.row, { gap: 8 }]}>
            <Icon name="Gauge" size={14} color={ui.c.muted} />
            <Text style={ui.s.label}>本月自动化额度</Text>
            <View style={ui.s.grow} />
            <Text style={ui.s.tiny}>
              {quotaUsed} / {quotaLimit}
            </Text>
          </View>
          <View style={{ height: 6, borderRadius: 3, backgroundColor: ui.c.surface2, overflow: "hidden" }}>
            <View
              style={{
                height: 6,
                width: `${Math.min(100, Math.round((quotaUsed / Math.max(quotaLimit, 1)) * 100))}%`,
                backgroundColor: ui.c.accent,
              }}
            />
          </View>
        </Card>
      ) : null}

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
            title={counts.all === 0 ? "还没有自动化" : "没有匹配的自动化"}
            description={
              counts.all === 0
                ? "创建一条自动化，让智能体按时或按事件自动开始工作。"
                : "换个筛选条件看看。"
            }
            action={
              counts.all === 0 ? (
                <Btn ui={ui} label="新建自动化" icon="Plus" tone="primary" onPress={() => setCreateOpen(true)} />
              ) : undefined
            }
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
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`打开自动化 ${item.title}`}
                onPress={() => setDetailFor(item)}
                style={({ pressed }) => [{ flex: 1, gap: 4 }, pressed && ui.s.pressed]}
              >
                <Text style={[ui.s.body, { fontWeight: "700", fontSize: 14.5 }]}>{item.title}</Text>
                <Text numberOfLines={2} style={ui.s.muted}>
                  {item.description || "没有描述"}
                </Text>
              </Pressable>
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
              <IconBtn ui={ui} icon="Pencil" label="编辑自动化" onPress={() => setEditFor(item)} />
              <IconBtn ui={ui} icon="Trash2" label="删除自动化" color={ui.c.danger} onPress={() => setDeleteFor(item)} />
              <Btn ui={ui} label="触发器" icon="Zap" onPress={() => setDetailFor(item)} />
              <Btn
                ui={ui}
                label={item.status === "active" ? "暂停" : "恢复"}
                icon={item.status === "active" ? "Pause" : "Play"}
                busy={busyId === item.id}
                onPress={() => void toggle(item)}
              />
              <Btn ui={ui} label="立即运行" icon="Play" tone="primary" busy={busyId === item.id} onPress={() => void trigger(item)} />
            </View>
          </Card>
        ))}
      </View>

      <CreateAutopilotModal
        ui={ui}
        api={api}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        agents={agents}
        squads={squads}
        onCreate={async (body, kind, schedule) => {
          const result = await api({ method: "POST", path: "/api/autopilots", body });
          if (!result.ok) {
            toast.error(result.error ?? "创建失败");
            return false;
          }
          const created = asRecord(result.data);
          const autopilot = asRecord(created.autopilot);
          const id = String(created.id ?? autopilot.id ?? "");
          if (id) {
            const triggerResult = await api({
              method: "POST",
              path: `/api/autopilots/${id}/triggers`,
              body:
                kind === "webhook"
                  ? { kind: "webhook" }
                  : { kind: "schedule", cron_expression: schedule.cron.trim(), timezone: schedule.timezone },
            });
            if (!triggerResult.ok) toast.error(triggerResult.error ?? "触发器创建失败");
          }
          toast.show("自动化已创建", { variant: "success" });
          setCreateOpen(false);
          refreshAll();
          return true;
        }}
      />

      <AutopilotDetailModal
        ui={ui}
        api={api}
        autopilot={detailFor}
        workspaceId={workspaceId}
        bump={bump}
        toast={toast}
        onClose={() => setDetailFor(null)}
        onEdit={() => detailFor && setEditFor(detailFor)}
        onDelete={() => detailFor && setDeleteFor(detailFor)}
        onChanged={refreshAll}
        onRuns={() => {
          if (detailFor) setRunsFor(detailFor);
        }}
      />

      <EditAutopilotModal
        ui={ui}
        api={api}
        autopilot={editFor}
        agents={agents}
        squads={squads}
        onClose={() => setEditFor(null)}
        onSaved={() => {
          setEditFor(null);
          refreshAll();
          toast.show("自动化已更新", { variant: "success" });
        }}
        onError={(message) => toast.error(message)}
      />

      <Modal
        title="删除自动化"
        icon={<Icon name="Trash2" size={16} color={ui.c.danger} />}
        open={Boolean(deleteFor)}
        onOpenChange={(next) => !next && setDeleteFor(null)}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>
              确定删除「{deleteFor?.title ?? ""}」吗？删除后它的触发器与运行记录将一并移除，无法恢复。
            </Text>
            <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
              <Btn ui={ui} label="取消" onPress={() => setDeleteFor(null)} />
              <Btn ui={ui} label="删除" icon="Trash2" tone="danger" busy={busyId === deleteFor?.id} onPress={() => void remove()} />
            </View>
          </View>
        </Modal.Content>
      </Modal>

      <RunsModal ui={ui} item={runsFor} onClose={() => setRunsFor(null)} onOpenIssue={(id) => navigate("issue", { id })} />
    </ScrollView>
  );
}

function CreateAutopilotModal({
  ui,
  api,
  open,
  onClose,
  agents,
  squads,
  onCreate,
}: {
  ui: Ui;
  api: ApiFn;
  open: boolean;
  onClose(): void;
  agents: Agent[];
  squads: Squad[];
  onCreate(body: Record<string, unknown>, kind: "schedule" | "webhook", schedule: { cron: string; timezone: string }): Promise<boolean>;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"create_issue" | "run_only">("create_issue");
  const [target, setTarget] = useState("");
  const [kind, setKind] = useState<"schedule" | "webhook">("schedule");
  const [cron, setCron] = useState("0 9 * * 1-5");
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [label, setLabel] = useState("");
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
                    accessibilityLabel={`选择执行者 ${item.name}`}
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
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>触发方式</Text>
            <Chips<"schedule" | "webhook">
              ui={ui}
              value={kind}
              onChange={setKind}
              options={[
                { value: "schedule", label: "定时", icon: "Clock" },
                { value: "webhook", label: "Webhook", icon: "Webhook" },
              ]}
            />
          </View>
          {kind === "schedule" ? (
            <>
              <Field
                ui={ui}
                label="定时表达式（Cron）"
                value={cron}
                onChangeText={setCron}
                code
                hint="留空则不创建定时触发器，之后仍可手动或通过 API 触发。"
              />
              <View style={{ gap: 6 }}>
                <Text style={ui.s.label}>时区</Text>
                <Chips<string> ui={ui} value={timezone} onChange={setTimezone} options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))} />
              </View>
              <CronPreview ui={ui} api={api} cron={cron} timezone={timezone} />
            </>
          ) : (
            <Text style={ui.s.muted}>创建后会生成一个 Webhook URL，向它 POST 任意 JSON 即可触发。</Text>
          )}
          <Field ui={ui} label="触发器标签（可选）" value={label} onChangeText={setLabel} placeholder="例如：工作日早上" />
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
              if (kind === "schedule" && cron.trim() === "") return setError("请填写 Cron 表达式，或切换为 Webhook 触发");
              const [targetKind, id] = target.split(":");
              setBusy(true);
              setError(null);
              const done = await onCreate(
                {
                  title: title.trim(),
                  description: description.trim() || undefined,
                  assignee_type: targetKind,
                  assignee_id: id,
                  execution_mode: mode,
                },
                kind,
                { cron, timezone },
              );
              setBusy(false);
              if (done) {
                setTitle("");
                setDescription("");
                setTarget("");
                setLabel("");
              }
            }}
          />
        </View>
      </Modal.Content>
    </Modal>
  );
}

function CronPreview({ ui, api, cron, timezone }: { ui: Ui; api: ApiFn; cron: string; timezone: string }) {
  const [debounced, setDebounced] = useState(cron.trim());
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(cron.trim()), 600);
    return () => clearTimeout(timer);
  }, [cron]);
  const query = useQuery(
    api,
    debounced ? "/api/autopilots/cron-preview" : null,
    { query: { expr: debounced, tz: timezone }, select: (data) => asList<string>(data, "next_runs") },
    `${debounced}|${timezone}`,
  );
  const next = query.data ?? [];
  if (!debounced) return null;
  if (query.error) return <Text style={[ui.s.tiny, { color: ui.c.danger }]}>{query.error}</Text>;
  if (next.length === 0) return null;
  return (
    <View style={{ gap: 3 }}>
      <Text style={ui.s.label}>接下来</Text>
      {next.slice(0, 3).map((value) => (
        <Text key={value} style={ui.s.tiny}>
          {fmtDateTime(value)} · {relTime(value)}
        </Text>
      ))}
    </View>
  );
}

function AutopilotDetailModal({
  ui,
  api,
  autopilot,
  workspaceId,
  bump,
  toast,
  onClose,
  onEdit,
  onDelete,
  onChanged,
  onRuns,
}: {
  ui: Ui;
  api: ApiFn;
  autopilot: Autopilot | null;
  workspaceId: string | null;
  bump: number;
  toast: WorkbenchValue["toast"];
  onClose(): void;
  onEdit(): void;
  onDelete(): void;
  onChanged(): void;
  onRuns(): void;
}) {
  const query = useQuery(
    api,
    autopilot ? `/api/autopilots/${autopilot.id}` : null,
    {
      select: (data) => {
        const record = asRecord(data);
        return {
          autopilot: asRecord(record.autopilot) as unknown as Autopilot,
          triggers: asList<AutopilotTrigger>(record, "triggers"),
        };
      },
    },
    `${workspaceId}:${bump}:${autopilot?.id ?? ""}`,
  );
  const triggers = query.data?.triggers ?? [];
  const live = query.data?.autopilot ?? autopilot;

  const [kind, setKind] = useState<"schedule" | "webhook">("schedule");
  const [cron, setCron] = useState("0 9 * * 1-5");
  const [timezone, setTimezone] = useState("Asia/Shanghai");
  const [busy, setBusy] = useState<string | null>(null);

  const afterChange = () => {
    query.refresh();
    onChanged();
  };

  const addTrigger = async () => {
    if (!autopilot) return;
    if (kind === "schedule" && !cron.trim()) {
      toast.error("请填写 Cron 表达式");
      return;
    }
    setBusy("add");
    const result = await api({
      method: "POST",
      path: `/api/autopilots/${autopilot.id}/triggers`,
      body: kind === "schedule" ? { kind: "schedule", cron_expression: cron.trim(), timezone } : { kind: "webhook" },
    });
    setBusy(null);
    if (result.ok) {
      toast.show(kind === "schedule" ? "定时触发器已添加" : "Webhook 触发器已添加", { variant: "success" });
      afterChange();
    } else toast.error(result.error ?? "添加失败");
  };

  const toggleTrigger = async (item: AutopilotTrigger) => {
    if (!autopilot) return;
    setBusy(item.id);
    const result = await api({
      method: "PATCH",
      path: `/api/autopilots/${autopilot.id}/triggers/${item.id}`,
      body: { enabled: !item.enabled },
    });
    setBusy(null);
    if (result.ok) afterChange();
    else toast.error(result.error ?? "操作失败");
  };

  const removeTrigger = async (item: AutopilotTrigger) => {
    if (!autopilot) return;
    setBusy(item.id);
    const result = await api({ method: "DELETE", path: `/api/autopilots/${autopilot.id}/triggers/${item.id}` });
    setBusy(null);
    if (result.ok) {
      toast.show("触发器已删除", { variant: "success" });
      afterChange();
    } else toast.error(result.error ?? "删除失败");
  };

  const rotate = async (item: AutopilotTrigger) => {
    if (!autopilot) return;
    setBusy(item.id);
    const result = await api({
      method: "POST",
      path: `/api/autopilots/${autopilot.id}/triggers/${item.id}/rotate-webhook-token`,
    });
    setBusy(null);
    if (result.ok) {
      toast.show("Webhook 链接已重置", { variant: "success" });
      afterChange();
    } else toast.error(result.error ?? "重置失败");
  };

  return (
    <Modal
      title={autopilot ? `触发器 · ${autopilot.title}` : "触发器"}
      icon={<Icon name="Zap" size={16} color={ui.c.muted} />}
      open={Boolean(autopilot)}
      onOpenChange={(next) => !next && onClose()}
    >
      <Modal.Content>
        <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 12 }}>
          {live ? (
            <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
              <Tag
                ui={ui}
                label={live.status === "active" ? "运行中" : live.status === "paused" ? "已暂停" : live.status}
                tone={live.status === "active" ? "success" : live.status === "paused" ? "warning" : "muted"}
              />
              <Tag ui={ui} label={live.execution_mode === "create_issue" ? "创建任务" : "直接执行"} tone="muted" />
              <Tag ui={ui} label={live.next_run_at ? `下次 ${fmtDateTime(live.next_run_at)}` : "未排期"} icon="Clock" />
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <Text style={ui.s.label}>已有触发器</Text>
            {query.loading && triggers.length === 0 ? <LoadingRow ui={ui} /> : null}
            {!query.loading && triggers.length === 0 ? (
              <Text style={ui.s.muted}>还没有触发器。添加定时或 Webhook 触发器后，自动化才会自动运行。</Text>
            ) : null}
            {triggers.map((item) => (
              <View
                key={item.id}
                style={{
                  gap: 7,
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: ui.c.border,
                  backgroundColor: ui.c.surface0,
                }}
              >
                <View style={[ui.s.row, { gap: 6 }]}>
                  <Tag
                    ui={ui}
                    label={TRIGGER_LABEL[item.kind] ?? item.kind}
                    icon={item.kind === "webhook" ? "Webhook" : "Clock"}
                    tone="accent"
                  />
                  {!item.enabled ? <Tag ui={ui} label="已停用" tone="muted" /> : null}
                  <View style={ui.s.grow} />
                  <IconBtn
                    ui={ui}
                    icon={item.enabled ? "ToggleRight" : "ToggleLeft"}
                    label={item.enabled ? "停用触发器" : "启用触发器"}
                    busy={busy === item.id}
                    onPress={() => void toggleTrigger(item)}
                  />
                  <IconBtn
                    ui={ui}
                    icon="Trash2"
                    label="删除触发器"
                    color={ui.c.danger}
                    onPress={() => void removeTrigger(item)}
                  />
                </View>
                {item.kind === "schedule" ? (
                  <View style={{ gap: 2 }}>
                    <Text selectable style={ui.s.mono}>
                      {item.cron_expression ?? "—"}
                    </Text>
                    <Text style={ui.s.tiny}>
                      {item.timezone ?? "UTC"}
                      {item.next_run_at ? ` · 下次 ${fmtDateTime(item.next_run_at)}` : ""}
                      {item.last_fired_at ? ` · 最近 ${relTime(item.last_fired_at)}` : ""}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 6 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="复制 Webhook 地址"
                      onPress={async () => {
                        const url = item.webhook_url ?? item.webhook_path ?? "";
                        if (!url) return;
                        await copyText(url);
                        toast.show("Webhook 地址已复制", { variant: "success" });
                      }}
                      style={({ pressed }) => [ui.s.row, { gap: 6 }, pressed && ui.s.pressed]}
                    >
                      <Text selectable numberOfLines={1} style={[ui.s.mono, { flex: 1 }]}>
                        {item.webhook_url ?? item.webhook_path ?? "—"}
                      </Text>
                      <Icon name="Copy" size={13} color={ui.c.muted} />
                    </Pressable>
                    <View style={[ui.s.row, { gap: 6 }]}>
                      <Btn ui={ui} label="重置 Webhook 链接" icon="RefreshCw" busy={busy === item.id} onPress={() => void rotate(item)} />
                      {item.has_signing_secret ? <Tag ui={ui} label="已配置签名" tone="success" icon="ShieldCheck" /> : null}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>

          <Divider ui={ui} />

          <View style={{ gap: 8 }}>
            <Text style={ui.s.label}>添加触发器</Text>
            <Chips<"schedule" | "webhook">
              ui={ui}
              value={kind}
              onChange={setKind}
              options={[
                { value: "schedule", label: "定时", icon: "Clock" },
                { value: "webhook", label: "Webhook", icon: "Webhook" },
              ]}
            />
            {kind === "schedule" ? (
              <>
                <Field ui={ui} label="Cron 表达式" value={cron} onChangeText={setCron} code />
                <Chips<string> ui={ui} value={timezone} onChange={setTimezone} options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))} />
                <CronPreview ui={ui} api={api} cron={cron} timezone={timezone} />
              </>
            ) : (
              <Text style={ui.s.muted}>添加后会立即生成 Webhook URL，向它 POST 即可触发。</Text>
            )}
            <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
              <Btn ui={ui} label="添加触发器" icon="Plus" tone="primary" busy={busy === "add"} onPress={() => void addTrigger()} />
            </View>
          </View>

          <Divider ui={ui} />

          <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
            <Btn ui={ui} label="运行记录" icon="History" onPress={onRuns} />
            <Btn ui={ui} label="编辑" icon="Pencil" onPress={onEdit} />
            <View style={ui.s.grow} />
            <Btn ui={ui} label="删除自动化" icon="Trash2" tone="danger" onPress={onDelete} />
          </View>
          {live?.last_run_at ? (
            <Text style={ui.s.tiny}>
              上次运行 {relTime(live.last_run_at)}
              {live.last_run_status ? ` · ${RUN_STATUS[live.last_run_status]?.label ?? live.last_run_status}` : ""}
            </Text>
          ) : null}
        </ScrollView>
      </Modal.Content>
    </Modal>
  );
}

function EditAutopilotModal({
  ui,
  api,
  autopilot,
  agents,
  squads,
  onClose,
  onSaved,
  onError,
}: {
  ui: Ui;
  api: ApiFn;
  autopilot: Autopilot | null;
  agents: Agent[];
  squads: Squad[];
  onClose(): void;
  onSaved(): void;
  onError(message: string): void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"create_issue" | "run_only">("create_issue");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!autopilot) return;
    setTitle(autopilot.title ?? "");
    setDescription(autopilot.description ?? "");
    setMode(autopilot.execution_mode === "run_only" ? "run_only" : "create_issue");
    setTarget(autopilot.assignee_id ? `${autopilot.assignee_type}:${autopilot.assignee_id}` : "");
  }, [autopilot?.id]);

  const targets = [
    ...agents.map((agent) => ({ id: agent.id, name: agent.name, kind: "agent" as const, avatar: agent.avatar_url })),
    ...squads.map((squad) => ({ id: squad.id, name: squad.name, kind: "squad" as const, avatar: squad.avatar_url })),
  ];

  const save = async () => {
    if (!autopilot) return;
    if (!title.trim()) {
      onError("请填写名称");
      return;
    }
    const [kind, id] = target.split(":");
    setBusy(true);
    const result = await api({
      method: "PATCH",
      path: `/api/autopilots/${autopilot.id}`,
      body: {
        title: title.trim(),
        description: description.trim() || null,
        execution_mode: mode,
        ...(kind && id ? { assignee_type: kind, assignee_id: id } : {}),
      },
    });
    setBusy(false);
    if (result.ok) onSaved();
    else onError(result.error ?? "保存失败");
  };

  return (
    <Modal
      title="编辑自动化"
      icon={<Icon name="Pencil" size={16} color={ui.c.muted} />}
      open={Boolean(autopilot)}
      onOpenChange={(next) => !next && onClose()}
    >
      <Modal.Content>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 12 }}>
          <Field ui={ui} label="名称" value={title} onChangeText={setTitle} />
          <Field ui={ui} label="描述" value={description} onChangeText={setDescription} multiline />
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
              {targets.map((item) => {
                const active = target === `${item.kind}:${item.id}`;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`选择执行者 ${item.name}`}
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
                    {active ? <Icon name="Check" size={14} color={ui.c.accent} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>
        <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
          <Btn ui={ui} label="取消" onPress={onClose} />
          <Btn ui={ui} label="保存" tone="primary" busy={busy} onPress={() => void save()} />
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
