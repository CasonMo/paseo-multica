import { t } from "../i18n";
import { Icon, Modal, copyText } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { asList, asRecord, usePagedQuery, useQuery, type ApiFn } from "../api";
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
  LoadMore,
  nearBottom,
  Tag,
  useUi,
  type Ui,
} from "../bits";
import { useWorkbench, type WorkbenchValue } from "../context";
import { fmtDateTime, relTime, type Agent, type Autopilot, type Squad } from "../model";

const RUN_STATUS: Record<string, { label: string; tone: "success" | "danger" | "muted" | "warning" | "accent" }> = {
  issue_created: { label: t("Automation.1"), tone: "accent" },
  running: { label: t("AgentDetail.10"), tone: "accent" },
  completed: { label: t("AgentDetail.6"), tone: "success" },
  failed: { label: t("AgentDetail.7"), tone: "danger" },
  skipped: { label: t("Automation.5"), tone: "warning" },
};

const TRIGGER_LABEL: Record<string, string> = { schedule: t("Automation.6"), webhook: "Webhook", api: "API" };

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

  const query = usePagedQuery<Autopilot>(api, "/api/autopilots", { pageSize: 30 }, key, "autopilots");
  const agentsQuery = useQuery(api, "/api/agents", { query: { limit: 50 }, select: (data) => asList<Agent>(data, "agents") }, key);
  const squadsQuery = useQuery(api, "/api/squads", { query: { limit: 50 }, select: (data) => asList<Squad>(data, "squads") }, key);
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
    if (item.assignee_type === "squad") return squads.find((s) => s.id === item.assignee_id)?.name ?? t("Nav.36");
    return agents.find((a) => a.id === item.assignee_id)?.name ?? t("AgentDetail.23");
  };

  const list = useMemo(
    () => query.items.filter((item) => filter === "all" || item.status === filter),
    [query.items, filter],
  );

  const counts = useMemo(() => {
    const all = query.items;
    return {
      all: query.total,
      active: all.filter((item) => item.status === "active").length,
      paused: all.filter((item) => item.status === "paused").length,
    };
  }, [query.items, query.total]);

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
      toast.show(t("Automation.9"), { variant: "success" });
      refreshAll();
    } else toast.error(result.error ?? t("Automation.10"));
  };

  const toggle = async (item: Autopilot) => {
    const next = item.status === "active" ? "paused" : "active";
    setBusyId(item.id);
    const result = await api({ method: "PATCH", path: `/api/autopilots/${item.id}`, body: { status: next } });
    setBusyId(null);
    if (result.ok) {
      toast.show(next === "active" ? t("Automation.11") : t("Nav.43"), { variant: "success" });
      refreshAll();
    } else toast.error(result.error ?? t("Automation.13"));
  };

  const remove = async () => {
    if (!deleteFor) return;
    setBusyId(deleteFor.id);
    const result = await api({ method: "DELETE", path: `/api/autopilots/${deleteFor.id}` });
    setBusyId(null);
    if (result.ok) {
      toast.show(t("Automation.14"), { variant: "success" });
      if (detailFor?.id === deleteFor.id) setDetailFor(null);
      setDeleteFor(null);
      refreshAll();
    } else toast.error(result.error ?? t("Automation.15"));
  };

  return (
    <ScrollView
      contentContainerStyle={{ padding: compact ? 12 : 20, gap: 12, paddingBottom: 40 }}
      onScroll={(e) => {
        if (nearBottom(e)) query.loadMore();
      }}
      scrollEventThrottle={200}
    >
      <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
        <View style={ui.s.grow}>
          <Text style={ui.s.title}>{t("Nav.6")}</Text>
          <Text style={ui.s.muted}>{t("Automation.17")}</Text>
        </View>
        <Btn ui={ui} label={t("Nav.10")} icon="Plus" tone="primary" onPress={() => setCreateOpen(true)} />
        <IconBtn ui={ui} icon="RefreshCw" label={t("Nav.14")} busy={query.loadingMore} onPress={refreshAll} />
      </View>

      {quotaUsed !== null && quotaLimit !== null ? (
        <Card ui={ui} style={{ gap: 6 }}>
          <View style={[ui.s.row, { gap: 8 }]}>
            <Icon name="Gauge" size={14} color={ui.c.muted} />
            <Text style={ui.s.label}>{t("Automation.20")}</Text>
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
          { value: "all", label: t("Automation.21", { a: counts.all }) },
          { value: "active", label: t("Automation.22", { a: counts.active }) },
          { value: "paused", label: t("Automation.23", { a: counts.paused }) },
        ]}
      />

      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      {query.loading && query.items.length === 0 ? <LoadingRow ui={ui} /> : null}
      {!query.loading && list.length === 0 ? (
        <Card ui={ui} padded={false}>
          <Empty
            ui={ui}
            icon="Bot"
            title={counts.all === 0 ? t("Automation.24") : t("Automation.25")}
            description={
              counts.all === 0
                ? t("Automation.26")
                : t("Automation.27")
            }
            action={
              counts.all === 0 ? (
                <Btn ui={ui} label={t("Automation.28")} icon="Plus" tone="primary" onPress={() => setCreateOpen(true)} />
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
                accessibilityLabel={t("Automation.29", { a: item.title })}
                onPress={() => setDetailFor(item)}
                style={({ pressed }) => [{ flex: 1, gap: 4 }, pressed && ui.s.pressed]}
              >
                <Text style={[ui.s.body, { fontWeight: "600" }]}>{item.title}</Text>
                <Text numberOfLines={2} style={ui.s.muted}>
                  {item.description || t("Automation.30")}
                </Text>
              </Pressable>
              <Tag
                ui={ui}
                label={item.status === "active" ? t("AgentDetail.10") : item.status === "paused" ? t("Nav.43") : item.status}
                tone={item.status === "active" ? "success" : item.status === "paused" ? "warning" : "muted"}
                icon={item.status === "active" ? "Radio" : "Pause"}
              />
            </View>

            <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
              <Tag ui={ui} label={nameOf(item)} icon={item.assignee_type === "squad" ? "Users" : "Bot"} />
              <Tag
                ui={ui}
                label={item.execution_mode === "create_issue" ? t("Automation.33") : t("Automation.34")}
                tone="muted"
                icon={item.execution_mode === "create_issue" ? "ListTodo" : "Play"}
              />
              {(item.trigger_kinds ?? []).map((kind) => (
                <Tag key={kind} ui={ui} label={TRIGGER_LABEL[kind] ?? kind} tone="accent" icon="Zap" />
              ))}
            </View>

            <View style={{ gap: 3 }}>
              <View style={[ui.s.row, { justifyContent: "space-between" }]}>
                <Text style={ui.s.tiny}>{t("Automation.35")}</Text>
                <Text style={ui.s.tiny}>{item.next_run_at ? fmtDateTime(item.next_run_at) : "—"}</Text>
              </View>
              <View style={[ui.s.row, { justifyContent: "space-between" }]}>
                <Text style={ui.s.tiny}>{t("Automation.36")}</Text>
                <Text style={ui.s.tiny}>
                  {item.last_run_status ? RUN_STATUS[item.last_run_status]?.label ?? item.last_run_status : "—"}
                  {item.last_run_at ? ` · ${relTime(item.last_run_at)}` : ""}
                </Text>
              </View>
            </View>

            <View style={[ui.s.row, { gap: 6, justifyContent: "flex-end" }]}>
              <IconBtn ui={ui} icon="Pencil" label={t("Automation.37")} onPress={() => setEditFor(item)} />
              <IconBtn ui={ui} icon="Trash2" label={t("Automation.38")} color={ui.c.danger} onPress={() => setDeleteFor(item)} />
              <Btn ui={ui} label={t("Automation.39")} icon="Zap" onPress={() => setDetailFor(item)} />
              <Btn
                ui={ui}
                label={item.status === "active" ? t("Automation.40") : t("AgentDetail.34")}
                icon={item.status === "active" ? "Pause" : "Play"}
                busy={busyId === item.id}
                onPress={() => void toggle(item)}
              />
              <Btn ui={ui} label={t("Automation.42")} icon="Play" tone="primary" busy={busyId === item.id} onPress={() => void trigger(item)} />
            </View>
          </Card>
        ))}
      </View>
      <LoadMore
        ui={ui}
        loaded={query.items.length}
        total={query.total}
        hasMore={query.hasMore}
        loadingMore={query.loadingMore}
        loading={query.loading}
        onLoadMore={query.loadMore}
      />

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
            toast.error(result.error ?? t("SettingsSections.18"));
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
            if (!triggerResult.ok) toast.error(triggerResult.error ?? t("Automation.44"));
          }
          toast.show(t("Automation.45"), { variant: "success" });
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
          toast.show(t("Automation.46"), { variant: "success" });
        }}
        onError={(message) => toast.error(message)}
      />

      <Modal
        title={t("Automation.38")}
        icon={<Icon name="Trash2" size={16} color={ui.c.danger} />}
        open={Boolean(deleteFor)}
        onOpenChange={(next) => !next && setDeleteFor(null)}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>
              {t("Automation.48")}{deleteFor?.title ?? ""}{t("Automation.49")}
            </Text>
            <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
              <Btn ui={ui} label={t("AgentDetail.40")} onPress={() => setDeleteFor(null)} />
              <Btn ui={ui} label={t("SquadDetail.21")} icon="Trash2" tone="danger" busy={busyId === deleteFor?.id} onPress={() => void remove()} />
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
    <Modal title={t("Automation.28")} icon={<Icon name="Bot" size={16} color={ui.c.muted} />} open={open} onOpenChange={(next) => !next && onClose()}>
      <Modal.Content>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 12 }}>
          <Field ui={ui} label={t("AgentDetail.95")} value={title} onChangeText={setTitle} placeholder={t("Automation.54")} />
          <Field ui={ui} label={t("AgentDetail.97")} value={description} onChangeText={setDescription} multiline placeholder={t("Automation.56")} />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("Automation.57")}</Text>
            <Chips<"create_issue" | "run_only">
              ui={ui}
              value={mode}
              onChange={setMode}
              options={[
                { value: "create_issue", label: t("Automation.58"), icon: "ListTodo" },
                { value: "run_only", label: t("Automation.34"), icon: "Play" },
              ]}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("Automation.60")}</Text>
            <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 6 }}>
              {targets.length === 0 ? (
                <Text style={ui.s.muted}>{t("Automation.61")}</Text>
              ) : null}
              {targets.map((item) => {
                const active = target === `${item.kind}:${item.id}`;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Automation.62", { a: item.name })}
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
                    <Text style={ui.s.tiny}>{item.kind === "squad" ? t("Nav.36") : t("AgentDetail.23")}</Text>
                    {active ? <Icon name="Check" size={14} color={ui.c.accent} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("Automation.65")}</Text>
            <Chips<"schedule" | "webhook">
              ui={ui}
              value={kind}
              onChange={setKind}
              options={[
                { value: "schedule", label: t("Automation.6"), icon: "Clock" },
                { value: "webhook", label: "Webhook", icon: "Webhook" },
              ]}
            />
          </View>
          {kind === "schedule" ? (
            <>
              <Field
                ui={ui}
                label={t("Automation.67")}
                value={cron}
                onChangeText={setCron}
                code
                hint={t("Automation.68")}
              />
              <View style={{ gap: 6 }}>
                <Text style={ui.s.label}>{t("Automation.69")}</Text>
                <Chips<string> ui={ui} value={timezone} onChange={setTimezone} options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))} />
              </View>
              <CronPreview ui={ui} api={api} cron={cron} timezone={timezone} />
            </>
          ) : (
            <Text style={ui.s.muted}>{t("Automation.70")}</Text>
          )}
          <Field ui={ui} label={t("Automation.71")} value={label} onChangeText={setLabel} placeholder={t("Automation.72")} />
          {error ? <ErrorNote ui={ui} message={error} /> : null}
        </ScrollView>
        <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
          <Btn ui={ui} label={t("AgentDetail.40")} onPress={onClose} />
          <Btn
            ui={ui}
            label={t("SettingsSections.30")}
            tone="primary"
            busy={busy}
            onPress={async () => {
              if (!title.trim()) return setError(t("AgentDetail.92"));
              if (!target) return setError(t("Automation.76"));
              if (kind === "schedule" && cron.trim() === "") return setError(t("Automation.77"));
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
      <Text style={ui.s.label}>{t("Automation.78")}</Text>
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
      toast.error(t("Automation.79"));
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
      toast.show(kind === "schedule" ? t("Automation.80") : t("Automation.81"), { variant: "success" });
      afterChange();
    } else toast.error(result.error ?? t("AgentDetail.84"));
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
    else toast.error(result.error ?? t("Automation.13"));
  };

  const removeTrigger = async (item: AutopilotTrigger) => {
    if (!autopilot) return;
    setBusy(item.id);
    const result = await api({ method: "DELETE", path: `/api/autopilots/${autopilot.id}/triggers/${item.id}` });
    setBusy(null);
    if (result.ok) {
      toast.show(t("Automation.84"), { variant: "success" });
      afterChange();
    } else toast.error(result.error ?? t("Automation.15"));
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
      toast.show(t("Automation.86"), { variant: "success" });
      afterChange();
    } else toast.error(result.error ?? t("Automation.87"));
  };

  return (
    <Modal
      title={autopilot ? t("Automation.88", { a: autopilot.title }) : t("Automation.39")}
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
                label={live.status === "active" ? t("AgentDetail.10") : live.status === "paused" ? t("Nav.43") : live.status}
                tone={live.status === "active" ? "success" : live.status === "paused" ? "warning" : "muted"}
              />
              <Tag ui={ui} label={live.execution_mode === "create_issue" ? t("Automation.33") : t("Automation.34")} tone="muted" />
              <Tag ui={ui} label={live.next_run_at ? t("Automation.94", { a: fmtDateTime(live.next_run_at) }) : t("Automation.95")} icon="Clock" />
            </View>
          ) : null}

          <View style={{ gap: 8 }}>
            <Text style={ui.s.label}>{t("Automation.96")}</Text>
            {query.loading && triggers.length === 0 ? <LoadingRow ui={ui} /> : null}
            {!query.loading && triggers.length === 0 ? (
              <Text style={ui.s.muted}>{t("Automation.97")}</Text>
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
                  {!item.enabled ? <Tag ui={ui} label={t("AgentDetail.48")} tone="muted" /> : null}
                  <View style={ui.s.grow} />
                  <IconBtn
                    ui={ui}
                    icon={item.enabled ? "ToggleRight" : "ToggleLeft"}
                    label={item.enabled ? t("Automation.99") : t("Automation.100")}
                    busy={busy === item.id}
                    onPress={() => void toggleTrigger(item)}
                  />
                  <IconBtn
                    ui={ui}
                    icon="Trash2"
                    label={t("Automation.101")}
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
                      {item.next_run_at ? t("Automation.102", { a: fmtDateTime(item.next_run_at) }) : ""}
                      {item.last_fired_at ? t("Automation.103", { a: relTime(item.last_fired_at) }) : ""}
                    </Text>
                  </View>
                ) : (
                  <View style={{ gap: 6 }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t("Automation.104")}
                      onPress={async () => {
                        const url = item.webhook_url ?? item.webhook_path ?? "";
                        if (!url) return;
                        await copyText(url);
                        toast.show(t("Automation.105"), { variant: "success" });
                      }}
                      style={({ pressed }) => [ui.s.row, { gap: 6 }, pressed && ui.s.pressed]}
                    >
                      <Text selectable numberOfLines={1} style={[ui.s.mono, { flex: 1 }]}>
                        {item.webhook_url ?? item.webhook_path ?? "—"}
                      </Text>
                      <Icon name="Copy" size={13} color={ui.c.muted} />
                    </Pressable>
                    <View style={[ui.s.row, { gap: 6 }]}>
                      <Btn ui={ui} label={t("Automation.106")} icon="RefreshCw" busy={busy === item.id} onPress={() => void rotate(item)} />
                      {item.has_signing_secret ? <Tag ui={ui} label={t("Automation.107")} tone="success" icon="ShieldCheck" /> : null}
                    </View>
                  </View>
                )}
              </View>
            ))}
          </View>

          <Divider ui={ui} />

          <View style={{ gap: 8 }}>
            <Text style={ui.s.label}>{t("Automation.108")}</Text>
            <Chips<"schedule" | "webhook">
              ui={ui}
              value={kind}
              onChange={setKind}
              options={[
                { value: "schedule", label: t("Automation.6"), icon: "Clock" },
                { value: "webhook", label: "Webhook", icon: "Webhook" },
              ]}
            />
            {kind === "schedule" ? (
              <>
                <Field ui={ui} label={t("Automation.110")} value={cron} onChangeText={setCron} code />
                <Chips<string> ui={ui} value={timezone} onChange={setTimezone} options={TIMEZONES.map((tz) => ({ value: tz, label: tz }))} />
                <CronPreview ui={ui} api={api} cron={cron} timezone={timezone} />
              </>
            ) : (
              <Text style={ui.s.muted}>{t("Automation.111")}</Text>
            )}
            <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
              <Btn ui={ui} label={t("Automation.108")} icon="Plus" tone="primary" busy={busy === "add"} onPress={() => void addTrigger()} />
            </View>
          </View>

          <Divider ui={ui} />

          <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
            <Btn ui={ui} label={t("Execution.31")} icon="History" onPress={onRuns} />
            <Btn ui={ui} label={t("AgentDetail.33")} icon="Pencil" onPress={onEdit} />
            <View style={ui.s.grow} />
            <Btn ui={ui} label={t("Automation.38")} icon="Trash2" tone="danger" onPress={onDelete} />
          </View>
          {live?.last_run_at ? (
            <Text style={ui.s.tiny}>
              {t("Automation.36")} {relTime(live.last_run_at)}
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
      onError(t("AgentDetail.92"));
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
    else onError(result.error ?? t("AgentDetail.64"));
  };

  return (
    <Modal
      title={t("Automation.37")}
      icon={<Icon name="Pencil" size={16} color={ui.c.muted} />}
      open={Boolean(autopilot)}
      onOpenChange={(next) => !next && onClose()}
    >
      <Modal.Content>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 12 }}>
          <Field ui={ui} label={t("AgentDetail.95")} value={title} onChangeText={setTitle} />
          <Field ui={ui} label={t("AgentDetail.97")} value={description} onChangeText={setDescription} multiline />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("Automation.57")}</Text>
            <Chips<"create_issue" | "run_only">
              ui={ui}
              value={mode}
              onChange={setMode}
              options={[
                { value: "create_issue", label: t("Automation.58"), icon: "ListTodo" },
                { value: "run_only", label: t("Automation.34"), icon: "Play" },
              ]}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("Automation.60")}</Text>
            <ScrollView style={{ maxHeight: 180 }} contentContainerStyle={{ gap: 6 }}>
              {targets.map((item) => {
                const active = target === `${item.kind}:${item.id}`;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Automation.62", { a: item.name })}
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
          <Btn ui={ui} label={t("AgentDetail.40")} onPress={onClose} />
          <Btn ui={ui} label={t("AgentDetail.72")} tone="primary" busy={busy} onPress={() => void save()} />
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
  const query = usePagedQuery<Record<string, unknown>>(
    ctx.api,
    item ? `/api/autopilots/${item.id}/runs` : null,
    { pageSize: 20 },
    item?.id,
    "runs",
  );
  return (
    <Modal title={item ? t("Automation.129", { a: item.title }) : t("Execution.31")} open={Boolean(item)} onOpenChange={(next) => !next && onClose()}>
      <Modal.Content>
        {query.loading && query.items.length === 0 ? <LoadingRow ui={ui} /> : null}
        {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
        {!query.loading && query.items.length === 0 ? (
          <Empty ui={ui} icon="History" title={t("Automation.131")} description={t("Automation.132")} />
        ) : null}
        <ScrollView
          style={{ maxHeight: 420 }}
          contentContainerStyle={{ gap: 6 }}
          onScroll={(e) => {
            if (nearBottom(e, 120)) query.loadMore();
          }}
          scrollEventThrottle={200}
        >
          {query.items.map((run) => {
            const status = String(run.status ?? "");
            const meta = RUN_STATUS[status] ?? { label: status || t("AgentDetail.57"), tone: "muted" as const };
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
                  <Btn ui={ui} label={t("AgentDetail.3")} onPress={() => { onClose(); onOpenIssue(issueId); }} />
                ) : null}
              </View>
            );
          })}
        </ScrollView>
        <LoadMore
          ui={ui}
          loaded={query.items.length}
          total={query.total}
          hasMore={query.hasMore}
          loadingMore={query.loadingMore}
        loading={query.loading}
          onLoadMore={query.loadMore}
        />
      </Modal.Content>
    </Modal>
  );
}
