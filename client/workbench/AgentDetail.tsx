import { t } from "./i18n";
import { Icon, Markdown, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { asList, asRecord, str, usePagedQuery, useQuery, useRuntimeModels } from "./api";
import { Avatar, Btn, Divider, Empty, ErrorNote, Field, IconBtn, LoadingRow, LoadMore, Tag, useUi , Select } from "./bits";
import { useWorkbench } from "./context";
import { agentStatusMeta, fmtDateTime, relTime, type Agent, type AgentRuntime, type Label, type Skill } from "./model";

type DetailTab = "overview" | "skills" | "tasks" | "env" | "mcp" | "labels";

const TABS: { key: DetailTab; label: string; icon: string }[] = [
  { key: "overview", label: "AgentDetail.1", icon: "Info" },
  { key: "skills", label: "AgentDetail.2", icon: "Blocks" },
  { key: "tasks", label: "AgentDetail.3", icon: "ListChecks" },
  { key: "env", label: "AgentDetail.4", icon: "KeyRound" },
  { key: "mcp", label: "AgentDetail.112", icon: "Plug" },
  { key: "labels", label: "AgentDetail.5", icon: "Tags" },
];

type AgentTask = {
  id: string;
  status?: string;
  issue_id?: string;
  error?: string | null;
  attempt?: number;
  max_attempts?: number;
  dispatched_at?: string;
  completed_at?: string;
  result?: { output?: string; pr_url?: string } | null;
};

const TASK_STATUS: Record<string, { label: string; tone: "success" | "danger" | "accent" | "warning" | "muted" }> = {
  completed: { label: "AgentDetail.6", tone: "success" },
  failed: { label: "AgentDetail.7", tone: "danger" },
  error: { label: "AgentDetail.7", tone: "danger" },
  cancelled: { label: "AgentDetail.9", tone: "muted" },
  running: { label: "AgentDetail.10", tone: "accent" },
  started: { label: "AgentDetail.10", tone: "accent" },
  dispatched: { label: "AgentDetail.12", tone: "warning" },
  claimed: { label: "AgentDetail.13", tone: "warning" },
};

function runtimeLabelOf(agent: Agent, runtimes: AgentRuntime[]): string {
  if (!agent.runtime_id) return t("AgentDetail.14");
  const runtime = runtimes.find((item) => item.id === agent.runtime_id);
  if (!runtime) return agent.runtime_availability === "offline" ? t("AgentDetail.15") : t("AgentDetail.16");
  return t("AgentDetail.17", { a: runtime.custom_name || runtime.name, b: runtime.status === "online" ? "" : t("AgentDetail.18") });
}

export function AgentDetailModal({
  agentId,
  onClose,
  onChat,
  runtimeList,
}: {
  agentId: string | null;
  onClose(): void;
  onChat(agent: Agent): void;
  runtimeList: AgentRuntime[];
  runtimesLoading?: boolean;
}) {
  const ctx = useWorkbench();
  const { theme, compact, api, toast, invalidate } = ctx;
  const ui = useUi(theme, compact);
  const [tab, setTab] = useState<DetailTab>("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!agentId) {
      setTab("overview");
      setEditOpen(false);
      setArchiveOpen(false);
    }
  }, [agentId]);

  const detail = useQuery<Agent | null>(
    api,
    agentId ? `/api/agents/${agentId}` : null,
    { select: (data) => (data && typeof data === "object" ? (data as Agent) : null) },
    agentId ?? "",
  );
  const agent = detail.data;
  const key = agentId ?? "";

  const archive = async () => {
    if (!agent) return;
    setBusy(true);
    const result = await api({ method: "POST", path: `/api/agents/${agent.id}/archive` });
    setBusy(false);
    if (result.ok) {
      setArchiveOpen(false);
      toast.show(t("AgentDetail.19"), { variant: "success" });
      invalidate();
      onClose();
    } else toast.error(result.error ?? t("AgentDetail.20"));
  };

  const restore = async () => {
    if (!agent) return;
    setBusy(true);
    const result = await api({ method: "POST", path: `/api/agents/${agent.id}/restore` });
    setBusy(false);
    if (result.ok) {
      toast.show(t("AgentDetail.21"), { variant: "success" });
      invalidate();
      detail.refresh();
    } else toast.error(result.error ?? t("AgentDetail.22"));
  };

  return (
    <>
      <Modal
        title={agent?.name ?? t("AgentDetail.23")}
        icon={<Icon name="Bot" size={16} color={ui.c.muted} />}
        open={Boolean(agentId)}
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
      >
        <Modal.Content>
          {detail.loading && !agent ? (
            <LoadingRow ui={ui} />
          ) : detail.error ? (
            <ErrorNote ui={ui} message={detail.error} onRetry={detail.refresh} />
          ) : agent ? (
            <View style={{ gap: 12 }}>
              <View style={[ui.s.row, { gap: 10 }]}>
                <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={42} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ color: ui.c.fg, fontSize: 17, fontWeight: "700" }}>{agent.name}</Text>
                  <Text style={ui.s.tiny}>
                    {agent.model || t("AgentDetail.24")} {t("AgentDetail.25")} {agent.max_concurrent_tasks ?? "—"}
                  </Text>
                </View>
                <Tag ui={ui} label={agentStatusMeta(agent.status).label} tone={agentStatusMeta(agent.status).tone} />
              </View>

              <View style={[ui.s.row, { flexWrap: "wrap", gap: 6 }]}>
                {TABS.map((entry) => {
                  const active = tab === entry.key;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={entry.key}
                      onPress={() => setTab(entry.key)}
                      style={({ pressed }) => [ui.s.chip, active && ui.s.chipActive, pressed && ui.s.pressed]}
                    >
                      <Icon name={entry.icon} size={12} color={active ? ui.c.accentFg : ui.c.muted} />
                      <Text style={[ui.s.chipText, active && ui.s.chipTextActive]}>{t(entry.label)}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 12 }}>
                {tab === "overview" ? (
                  <>
                    {agent.description ? <Text style={ui.s.body}>{agent.description}</Text> : null}
                    <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
                      <Tag ui={ui} label={runtimeLabelOf(agent, runtimeList)} tone="muted" icon="Server" />
                      <Tag
                        ui={ui}
                        label={agent.permission_mode === "private" ? t("AgentDetail.26") : t("AgentDetail.27")}
                        tone="muted"
                        icon="Shield"
                      />
                      {agent.archived_at ? <Tag ui={ui} label={t("AgentDetail.28")} tone="danger" /> : null}
                    </View>

                    {agent.skills && agent.skills.length > 0 ? (
                      <View style={{ gap: 6 }}>
                        <Text style={ui.s.label}>{t("AgentDetail.2")}</Text>
                        <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
                          {agent.skills.map((skill, index) => (
                            <Tag
                              key={`${skill.id ?? skill.name ?? index}`}
                              ui={ui}
                              label={skill.name ?? skill.slug ?? t("AgentDetail.2")}
                              tone="accent"
                            />
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {agent.instructions ? (
                      <View style={{ gap: 6 }}>
                        <Text style={ui.s.label}>{t("AgentDetail.31")}</Text>
                        <Markdown>{agent.instructions}</Markdown>
                      </View>
                    ) : null}

                    <Text style={ui.s.tiny}>{t("AgentDetail.32")} {fmtDateTime(agent.updated_at)}</Text>
                  </>
                ) : null}

                {tab === "skills" ? <SkillsPanel ui={ui} api={api} agentId={agent.id} toast={toast} /> : null}
                {tab === "tasks" ? <TasksPanel ui={ui} api={api} agentId={agent.id} /> : null}
                {tab === "env" ? <EnvPanel ui={ui} api={api} agentId={agent.id} toast={toast} /> : null}
                {tab === "mcp" ? <McpPanel ui={ui} api={api} agentId={agent.id} toast={toast} /> : null}
                {tab === "labels" ? <LabelPanel ui={ui} api={api} agentId={agent.id} toast={toast} key={key} /> : null}
              </ScrollView>

              <Divider ui={ui} />

              <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }]}>
                <Btn ui={ui} label={t("AgentDetail.33")} icon="Pencil" onPress={() => setEditOpen(true)} />
                {agent.archived_at ? (
                  <Btn ui={ui} label={t("AgentDetail.34")} icon="ArchiveRestore" busy={busy} onPress={() => void restore()} />
                ) : (
                  <Btn ui={ui} label={t("AgentDetail.35")} icon="Archive" tone="danger" busy={busy} onPress={() => setArchiveOpen(true)} />
                )}
                <Btn ui={ui} label={t("AgentDetail.36")} icon="MessagesSquare" tone="primary" onPress={() => onChat(agent)} />
              </View>
            </View>
          ) : null}
        </Modal.Content>
      </Modal>

      <Modal
        title={t("AgentDetail.37")}
        icon={<Icon name="Archive" size={16} color={ui.c.danger} />}
        open={archiveOpen && Boolean(agent)}
        onOpenChange={(next) => !next && setArchiveOpen(false)}
      >
        <Modal.Content>
          <Text style={ui.s.body}>
            {t("AgentDetail.38")}{agent?.name ?? ""}{t("AgentDetail.39")}
          </Text>
          <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
            <Btn ui={ui} label={t("AgentDetail.40")} onPress={() => setArchiveOpen(false)} />
            <Btn ui={ui} label={t("AgentDetail.35")} tone="danger" busy={busy} onPress={() => void archive()} />
          </View>
        </Modal.Content>
      </Modal>

      <EditAgentModal
        ui={ui}
        api={api}
        agent={editOpen ? agent : null}
        runtimes={runtimeList}
        onClose={() => setEditOpen(false)}
        onSaved={() => {
          setEditOpen(false);
          detail.refresh();
          invalidate();
        }}
      />
    </>
  );
}

function SkillsPanel({
  ui,
  api,
  agentId,
  toast,
}: {
  ui: ReturnType<typeof useUi>;
  api: ReturnType<typeof useWorkbench>["api"];
  agentId: string;
  toast: ReturnType<typeof useWorkbench>["toast"];
}) {
  const ctx = useWorkbench();
  const key = `${ctx.bump}:${agentId}`;
  const all = useQuery(api, "/api/skills", { query: { limit: 50 }, select: (data) => asList<Skill>(data, "skills") }, key);
  const bound = useQuery(api, `/api/agents/${agentId}/skills`, { select: (data) => asList<Skill>(data, "skills") }, key);
  const [busyId, setBusyId] = useState<string | null>(null);

  const boundMap = useMemo(() => new Map((bound.data ?? []).map((skill) => [skill.id, skill])), [bound.data]);
  const items = all.data ?? [];

  const setBound = async (skill: Skill, next: boolean) => {
    setBusyId(skill.id);
    const result = next
      ? await api({ method: "POST", path: `/api/agents/${agentId}/skills/add`, body: { skill_ids: [skill.id] } })
      : await api({ method: "DELETE", path: `/api/agents/${agentId}/skills/${skill.id}` });
    setBusyId(null);
    if (result.ok) bound.refresh();
    else toast.error(result.error ?? t("AgentDetail.42"));
  };

  const setEnabled = async (skill: Skill, next: boolean) => {
    setBusyId(skill.id);
    const result = await api({
      method: "PUT",
      path: `/api/agents/${agentId}/skills/${skill.id}/enabled`,
      body: { enabled: next },
    });
    setBusyId(null);
    if (result.ok) bound.refresh();
    else toast.error(result.error ?? t("AgentDetail.42"));
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.s.tiny}>{t("AgentDetail.44")}</Text>
      {all.loading && items.length === 0 ? <LoadingRow ui={ui} /> : null}
      {!all.loading && items.length === 0 ? (
        <Empty ui={ui} icon="Blocks" title={t("AgentDetail.45")} description={t("AgentDetail.46")} />
      ) : null}
      {items.map((skill) => {
        const linked = boundMap.get(skill.id);
        const enabled = linked ? linked.enabled !== false : false;
        return (
          <View key={skill.id} style={[ui.s.row, { gap: 8, padding: 9, borderRadius: 9, backgroundColor: ui.c.surface0 }]}>
            <Icon name="Blocks" size={14} color={linked ? ui.c.accent : ui.c.muted} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={[ui.s.body, { fontWeight: "600" }]}>
                {skill.name}
              </Text>
              <Text numberOfLines={2} style={ui.s.tiny}>
                {skill.description || skill.slug || "—"}
              </Text>
            </View>
            {linked ? <Tag ui={ui} label={enabled ? t("AgentDetail.47") : t("AgentDetail.48")} tone={enabled ? "success" : "muted"} /> : null}
            {linked ? (
              <IconBtn
                ui={ui}
                icon={enabled ? "ToggleRight" : "ToggleLeft"}
                label={enabled ? t("AgentDetail.49") : t("AgentDetail.50")}
                color={enabled ? ui.c.accent : ui.c.muted}
                busy={busyId === skill.id}
                onPress={() => void setEnabled(skill, !enabled)}
              />
            ) : null}
            <IconBtn
              ui={ui}
              icon={linked ? "Minus" : "Plus"}
              label={linked ? t("AgentDetail.51", { a: skill.name }) : t("AgentDetail.52", { a: skill.name })}
              color={linked ? ui.c.danger : ui.c.accent}
              busy={busyId === skill.id}
              onPress={() => void setBound(skill, !linked)}
            />
          </View>
        );
      })}
    </View>
  );
}

function TasksPanel({
  ui,
  api,
  agentId,
}: {
  ui: ReturnType<typeof useUi>;
  api: ReturnType<typeof useWorkbench>["api"];
  agentId: string;
}) {
  const ctx = useWorkbench();
  const query = usePagedQuery<AgentTask>(
    api,
    `/api/agents/${agentId}/tasks`,
    { pageSize: 20 },
    `${ctx.bump}:${agentId}`,
    "tasks",
  );
  const items = query.items;

  return (
    <View style={{ gap: 8 }}>
      <View style={[ui.s.row, { justifyContent: "space-between" }]}>
        <Text style={ui.s.tiny}>{t("AgentDetail.53")}</Text>
        <IconBtn ui={ui} icon="RefreshCw" label={t("AgentDetail.54")} busy={query.loadingMore} onPress={query.refresh} />
      </View>
      {query.loading && items.length === 0 ? <LoadingRow ui={ui} /> : null}
      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      {!query.loading && !query.error && items.length === 0 ? (
        <Empty ui={ui} icon="ListChecks" title={t("AgentDetail.55")} description={t("AgentDetail.56")} />
      ) : null}
      {items.map((task) => {
        const taskMeta = TASK_STATUS[task.status ?? ""];
        const meta = taskMeta ? { ...taskMeta, label: t(taskMeta.label) } : { label: task.status || t("AgentDetail.57"), tone: "muted" as const };
        const output = task.result?.output?.trim();
        const cost = task.completed_at
          ? Math.max(0, Math.round((Date.parse(task.completed_at) - Date.parse(task.dispatched_at ?? task.completed_at)) / 1000))
          : null;
        return (
          <View key={task.id} style={{ gap: 4, padding: 9, borderRadius: 9, backgroundColor: ui.c.surface0 }}>
            <View style={[ui.s.row, { gap: 8 }]}>
              <Tag ui={ui} label={meta.label} tone={meta.tone} />
              <Text numberOfLines={1} style={[ui.s.tiny, ui.s.grow]}>
                {task.issue_id ? t("AgentDetail.58", { a: task.issue_id.slice(0, 8) }) : t("AgentDetail.59")} {t("AgentDetail.60")} {task.attempt ?? 1}/
                {task.max_attempts ?? 1} {t("AgentDetail.61")}
              </Text>
              <Text style={ui.s.tiny}>{cost === null ? relTime(task.dispatched_at) : `${cost}s`}</Text>
            </View>
            {task.error ? (
              <Text numberOfLines={3} style={[ui.s.tiny, { color: ui.c.danger }]}>
                {task.error}
              </Text>
            ) : output ? (
              <Text numberOfLines={3} style={ui.s.tiny}>
                {output}
              </Text>
            ) : null}
          </View>
        );
      })}
      <LoadMore
        ui={ui}
        loaded={items.length}
        total={query.total}
        hasMore={query.hasMore}
        loadingMore={query.loadingMore}
        loading={query.loading}
        onLoadMore={query.loadMore}
      />
    </View>
  );
}

function EnvPanel({
  ui,
  api,
  agentId,
  toast,
}: {
  ui: ReturnType<typeof useUi>;
  api: ReturnType<typeof useWorkbench>["api"];
  agentId: string;
  toast: ReturnType<typeof useWorkbench>["toast"];
}) {
  const ctx = useWorkbench();
  const query = useQuery(
    api,
    `/api/agents/${agentId}/env`,
    { select: (data) => asRecord(asRecord(data).custom_env) as Record<string, string> },
    `${ctx.bump}:${agentId}`,
  );
  const [rows, setRows] = useState<{ key: string; value: string }[]>([]);
  const [reveal, setReveal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query.data) return;
    setRows(Object.entries(query.data).map(([key, value]) => ({ key, value: String(value) })));
  }, [query.data]);

  const save = async () => {
    const custom_env: Record<string, string> = {};
    for (const row of rows) {
      const name = row.key.trim();
      if (!name) continue;
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        setError(t("AgentDetail.62", { a: name }));
        return;
      }
      custom_env[name] = row.value;
    }
    setBusy(true);
    setError(null);
    const result = await api({ method: "PUT", path: `/api/agents/${agentId}/env`, body: { custom_env } });
    setBusy(false);
    if (result.ok) {
      toast.show(t("AgentDetail.63"), { variant: "success" });
      query.refresh();
      ctx.invalidate();
    } else setError(result.error ?? t("AgentDetail.64"));
  };

  const update = (index: number, patch: Partial<{ key: string; value: string }>) =>
    setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <View style={{ gap: 10 }}>
      <View style={[ui.s.row, { justifyContent: "space-between" }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[ui.s.body, { fontWeight: "600" }]}>{t("AgentDetail.65")}</Text>
          <Text style={ui.s.tiny}>{t("AgentDetail.66")}</Text>
        </View>
        <IconBtn ui={ui} icon={reveal ? "EyeOff" : "Eye"} label={reveal ? t("AgentDetail.67") : t("AgentDetail.68")} onPress={() => setReveal((v) => !v)} />
      </View>

      {rows.length === 0 ? <Text style={ui.s.muted}>{t("AgentDetail.69")}</Text> : null}

      {rows.map((row, index) => (
        <View key={index} style={[ui.s.row, { gap: 6 }]}>
          <TextInput
            value={row.key}
            onChangeText={(text) => update(index, { key: text })}
            placeholder="KEY"
            placeholderTextColor={ui.c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[ui.s.input, ui.s.inputCode, { flex: 1, minWidth: 100 }]}
          />
          <TextInput
            value={row.value}
            onChangeText={(text) => update(index, { value: text })}
            placeholder="value"
            placeholderTextColor={ui.c.muted}
            secureTextEntry={!reveal}
            autoCapitalize="none"
            autoCorrect={false}
            style={[ui.s.input, ui.s.inputCode, { flex: 1.4, minWidth: 100 }]}
          />
          <IconBtn
            ui={ui}
            icon="X"
            label={t("AgentDetail.70")}
            onPress={() => setRows((list) => list.filter((_, i) => i !== index))}
          />
        </View>
      ))}

      {error ? <ErrorNote ui={ui} message={error} /> : null}

      <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
        <Btn ui={ui} label={t("AgentDetail.71")} icon="Plus" onPress={() => setRows((list) => [...list, { key: "", value: "" }])} />
        <View style={ui.s.grow} />
        <Btn ui={ui} label={t("AgentDetail.72")} icon="Save" tone="primary" busy={busy} onPress={() => void save()} />
      </View>
    </View>
  );
}

function McpPanel({
  ui,
  api,
  agentId,
  toast,
}: {
  ui: ReturnType<typeof useUi>;
  api: ReturnType<typeof useWorkbench>["api"];
  agentId: string;
  toast: ReturnType<typeof useWorkbench>["toast"];
}) {
  const ctx = useWorkbench();
  const query = useQuery(
    api,
    `/api/agents/${agentId}/mcp-servers`,
    { select: (data) => asList<Record<string, unknown>>(data, "servers", "mcp_servers") },
    `${ctx.bump}:${agentId}`,
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (!query.loading) {
      setSlow(false);
      return;
    }
    const timer = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(timer);
  }, [query.loading]);
  const items = query.data ?? [];

  const toggle = async (item: Record<string, unknown>) => {
    const serverId = str(item.id ?? item.server_id);
    if (!serverId) return;
    setBusyId(serverId);
    const next = item.enabled !== true;
    const result = await api({
      method: "PUT",
      path: `/api/agents/${agentId}/mcp-servers/${serverId}/enabled`,
      body: { enabled: next },
    });
    setBusyId(null);
    if (result.ok) query.refresh();
    else toast.error(result.error ?? t("AgentDetail.42"));
  };

  const remove = async (item: Record<string, unknown>) => {
    const serverId = str(item.id ?? item.server_id);
    if (!serverId) return;
    setBusyId(serverId);
    const result = await api({ method: "DELETE", path: `/api/agents/${agentId}/mcp-servers/${serverId}` });
    setBusyId(null);
    if (result.ok) {
      toast.show(t("AgentDetail.74"), { variant: "success" });
      query.refresh();
    } else toast.error(result.error ?? t("AgentDetail.75"));
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.s.tiny}>{t("AgentDetail.76")}</Text>
      {query.loading && items.length === 0 ? <LoadingRow ui={ui} /> : null}
      {query.loading && slow && items.length === 0 ? (
        <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
          <Text style={ui.s.tiny}>{t("AgentDetail.113")}</Text>
          <Btn ui={ui} label={t("Nav.14")} icon="RefreshCw" onPress={query.refresh} />
        </View>
      ) : null}
      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      {!query.loading && !query.error && items.length === 0 ? (
        <Empty ui={ui} icon="Plug" title={t("AgentDetail.77")} description={t("AgentDetail.78")} />
      ) : null}
      {items.map((item, index) => {
        const id = str(item.id ?? item.server_id ?? index);
        const enabled = item.enabled === true;
        const detailText = str(item.url ?? item.command ?? item.transport ?? "");
        return (
          <View
            key={id}
            style={[ui.s.row, { gap: 8, padding: 9, borderRadius: 9, backgroundColor: ui.c.surface0 }]}
          >
            <Icon name="Plug" size={14} color={enabled ? ui.c.accent : ui.c.muted} />
            <View style={{ flex: 1, gap: 2 }}>
              <Text numberOfLines={1} style={[ui.s.body, { fontWeight: "600" }]}>
                {str(item.name ?? item.server_name ?? id)}
              </Text>
              {detailText ? (
                <Text numberOfLines={1} style={[ui.s.tiny, { fontFamily: "Menlo" }]}>
                  {detailText}
                </Text>
              ) : null}
            </View>
            <Tag ui={ui} label={enabled ? t("AgentDetail.47") : t("AgentDetail.48")} tone={enabled ? "success" : "muted"} />
            <IconBtn
              ui={ui}
              icon={enabled ? "ToggleRight" : "ToggleLeft"}
              label={enabled ? t("AgentDetail.81") : t("AgentDetail.82")}
              color={enabled ? ui.c.accent : ui.c.muted}
              busy={busyId === id}
              onPress={() => void toggle(item)}
            />
            <IconBtn ui={ui} icon="Trash2" label={t("AgentDetail.83")} color={ui.c.danger} busy={busyId === id} onPress={() => void remove(item)} />
          </View>
        );
      })}
    </View>
  );
}

function LabelPanel({
  ui,
  api,
  agentId,
  toast,
}: {
  ui: ReturnType<typeof useUi>;
  api: ReturnType<typeof useWorkbench>["api"];
  agentId: string;
  toast: ReturnType<typeof useWorkbench>["toast"];
}) {
  const ctx = useWorkbench();
  const key = `${ctx.bump}:${agentId}`;
  const attached = useQuery(
    api,
    `/api/agents/${agentId}/labels`,
    { select: (data) => asList<Label>(data, "labels") },
    key,
  );
  const all = useQuery(api, "/api/labels", { query: { limit: 50 }, select: (data) => asList<Label>(data, "labels") }, key);
  const [busyId, setBusyId] = useState<string | null>(null);

  const current = attached.data ?? [];
  const currentIds = useMemo(() => new Set(current.map((label) => label.id)), [current]);
  const available = (all.data ?? []).filter(
    (label) => (label.resource_type ?? "issue") === "agent" && !currentIds.has(label.id),
  );

  const attach = async (label: Label) => {
    setBusyId(label.id);
    const result = await api({ method: "POST", path: `/api/agents/${agentId}/labels`, body: { label_id: label.id } });
    setBusyId(null);
    if (result.ok) {
      attached.refresh();
      ctx.invalidate();
    } else toast.error(result.error ?? t("AgentDetail.84"));
  };

  const detach = async (label: Label) => {
    setBusyId(label.id);
    const result = await api({ method: "DELETE", path: `/api/agents/${agentId}/labels/${label.id}` });
    setBusyId(null);
    if (result.ok) {
      attached.refresh();
      ctx.invalidate();
    } else toast.error(result.error ?? t("AgentDetail.75"));
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text style={ui.s.label}>{t("AgentDetail.86")}</Text>
        {current.length === 0 ? (
          <Text style={ui.s.muted}>{t("AgentDetail.87")}</Text>
        ) : (
          <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
            {current.map((label) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("AgentDetail.88", { a: label.name })}
                key={label.id}
                onPress={() => void detach(label)}
                style={({ pressed }) => [ui.s.row, { gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, borderWidth: 1, borderColor: `${label.color || ui.c.accent}66`, backgroundColor: `${label.color || ui.c.accent}18` }, pressed && ui.s.pressed]}
              >
                <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: label.color || ui.c.accent }} />
                <Text style={[ui.s.tiny, { color: ui.c.fg }]}>{label.name}</Text>
                <Icon name="X" size={11} color={ui.c.muted} />
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={{ gap: 6 }}>
        <Text style={ui.s.label}>{t("AgentDetail.89")}</Text>
        {available.length === 0 ? (
          <Text style={ui.s.muted}>{t("AgentDetail.90")}</Text>
        ) : (
          <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
            {available.map((label) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t("AgentDetail.91", { a: label.name })}
                key={label.id}
                disabled={busyId === label.id}
                onPress={() => void attach(label)}
                style={({ pressed }) => [ui.s.chip, pressed && ui.s.pressed]}
              >
                <Icon name="Plus" size={11} color={ui.c.muted} />
                <Text style={ui.s.chipText}>{label.name}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function EditAgentModal({
  ui,
  api,
  agent,
  runtimes,
  onClose,
  onSaved,
}: {
  ui: ReturnType<typeof useUi>;
  api: ReturnType<typeof useWorkbench>["api"];
  agent: Agent | null;
  runtimes: AgentRuntime[];
  onClose(): void;
  onSaved(): void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState("");
  const [maxTasks, setMaxTasks] = useState("");
  const [permission, setPermission] = useState<"public" | "private">("public");
  const [runtimeId, setRuntimeId] = useState("");
  const { models: modelOptions } = useRuntimeModels(api, runtimeId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!agent) return;
    setName(agent.name ?? "");
    setDescription(agent.description ?? "");
    setInstructions(agent.instructions ?? "");
    setModel(agent.model ?? "");
    setMaxTasks(agent.max_concurrent_tasks ? String(agent.max_concurrent_tasks) : "");
    setPermission(agent.permission_mode === "private" ? "private" : "public");
    setRuntimeId(agent.runtime_id ?? "");
    setError(null);
  }, [agent]);

  const save = async () => {
    if (!agent) return;
    if (!name.trim()) {
      setError(t("AgentDetail.92"));
      return;
    }
    setBusy(true);
    setError(null);
    const limit = Number.parseInt(maxTasks, 10);
    const result = await api({
      method: "PUT",
      path: `/api/agents/${agent.id}`,
      body: {
        name: name.trim(),
        description: description.trim(),
        instructions,
        model: model.trim() || null,
        max_concurrent_tasks: Number.isFinite(limit) && limit > 0 ? limit : null,
        permission_mode: permission,
        runtime_id: runtimeId || null,
      },
    });
    setBusy(false);
    if (result.ok) onSaved();
    else setError(result.error ?? t("AgentDetail.64"));
  };

  return (
    <Modal title={t("AgentDetail.94")} icon={<Icon name="Pencil" size={16} color={ui.c.muted} />} open={Boolean(agent)} onOpenChange={(next) => !next && onClose()}>
      <Modal.Content>
        <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 12 }}>
          <Field ui={ui} label={t("AgentDetail.95")} value={name} onChangeText={setName} placeholder={t("AgentDetail.96")} />
          <Field ui={ui} label={t("AgentDetail.97")} value={description} onChangeText={setDescription} multiline placeholder={t("AgentDetail.98")} />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("AgentDetail.99")}</Text>
            {modelOptions.length > 0 ? (
              <Select
                ui={ui}
                value={model || null}
                placeholder={t("AgentDetail.101")}
                onChange={setModel}
                options={modelOptions.map((m) => ({ value: m.id, label: m.label }))}
              />
            ) : (
              <Field ui={ui} label="" value={model} onChangeText={setModel} placeholder={t("AgentDetail.100")} hint={t("AgentDetail.101")} />
            )}
          </View>
          <Field
            ui={ui}
            label={t("AgentDetail.102")}
            value={maxTasks}
            onChangeText={setMaxTasks}
            placeholder={t("AgentDetail.103")}
          />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("AgentDetail.104")}</Text>
            <Select<"public" | "private">
              ui={ui}
              value={permission}
              onChange={setPermission}
              searchable={false}
              options={[
                { value: "public", label: t("AgentDetail.27"), icon: "Globe" },
                { value: "private", label: t("AgentDetail.106"), icon: "Lock" },
              ]}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("AgentDetail.16")}</Text>
            <Select
              ui={ui}
              value={runtimeId || null}
              placeholder={t("AgentDetail.108")}
              onChange={(next) => setRuntimeId(next)}
              options={[
                { value: "", label: t("AgentDetail.108") },
                ...runtimes.map((runtime) => ({ value: runtime.id, label: runtime.custom_name || runtime.name })),
              ]}
            />
          </View>
          <Field ui={ui} label={t("AgentDetail.31")} value={instructions} onChangeText={setInstructions} multiline placeholder={t("AgentDetail.110")} hint={t("AgentDetail.111")} />
          {error ? <ErrorNote ui={ui} message={error} /> : null}
        </ScrollView>
        <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
          <Btn ui={ui} label={t("AgentDetail.40")} onPress={onClose} />
          <Btn ui={ui} label={t("AgentDetail.72")} tone="primary" busy={busy} onPress={() => void save()} />
        </View>
      </Modal.Content>
    </Modal>
  );
}


