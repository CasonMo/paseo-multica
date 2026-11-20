import { Icon, Markdown, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { asList, asRecord, str, useQuery } from "./api";
import { Avatar, Btn, Chips, Divider, Empty, ErrorNote, Field, IconBtn, LoadingRow, Tag, useUi } from "./bits";
import { useWorkbench } from "./context";
import { agentStatusMeta, fmtDateTime, relTime, type Agent, type AgentRuntime, type Label, type Skill } from "./model";

type DetailTab = "overview" | "skills" | "tasks" | "env" | "mcp" | "labels";

const TABS: { key: DetailTab; label: string; icon: string }[] = [
  { key: "overview", label: "概览", icon: "Info" },
  { key: "skills", label: "技能", icon: "Blocks" },
  { key: "tasks", label: "任务", icon: "ListChecks" },
  { key: "env", label: "环境变量", icon: "KeyRound" },
  { key: "mcp", label: "MCP", icon: "Plug" },
  { key: "labels", label: "标签", icon: "Tags" },
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
  completed: { label: "已完成", tone: "success" },
  failed: { label: "失败", tone: "danger" },
  error: { label: "失败", tone: "danger" },
  cancelled: { label: "已取消", tone: "muted" },
  running: { label: "运行中", tone: "accent" },
  started: { label: "运行中", tone: "accent" },
  dispatched: { label: "已派发", tone: "warning" },
  claimed: { label: "已领取", tone: "warning" },
};

function runtimeLabelOf(agent: Agent, runtimes: AgentRuntime[]): string {
  if (!agent.runtime_id) return "未绑定运行时";
  const runtime = runtimes.find((item) => item.id === agent.runtime_id);
  if (!runtime) return agent.runtime_availability === "offline" ? "运行时离线" : "运行时";
  return `${runtime.custom_name || runtime.name}${runtime.status === "online" ? "" : "（离线）"}`;
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
      toast.show("智能体已归档", { variant: "success" });
      invalidate();
      onClose();
    } else toast.error(result.error ?? "归档失败");
  };

  const restore = async () => {
    if (!agent) return;
    setBusy(true);
    const result = await api({ method: "POST", path: `/api/agents/${agent.id}/restore` });
    setBusy(false);
    if (result.ok) {
      toast.show("智能体已恢复", { variant: "success" });
      invalidate();
      detail.refresh();
    } else toast.error(result.error ?? "恢复失败");
  };

  return (
    <>
      <Modal
        title={agent?.name ?? "智能体"}
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
                    {agent.model || "未设置模型"} · 最大并发 {agent.max_concurrent_tasks ?? "—"}
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
                      <Text style={[ui.s.chipText, active && ui.s.chipTextActive]}>{entry.label}</Text>
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
                        label={agent.permission_mode === "private" ? "私有调用" : "公开调用"}
                        tone="muted"
                        icon="Shield"
                      />
                      {agent.archived_at ? <Tag ui={ui} label="已归档" tone="danger" /> : null}
                    </View>

                    {agent.skills && agent.skills.length > 0 ? (
                      <View style={{ gap: 6 }}>
                        <Text style={ui.s.label}>技能</Text>
                        <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
                          {agent.skills.map((skill, index) => (
                            <Tag
                              key={`${skill.id ?? skill.name ?? index}`}
                              ui={ui}
                              label={skill.name ?? skill.slug ?? "技能"}
                              tone="accent"
                            />
                          ))}
                        </View>
                      </View>
                    ) : null}

                    {agent.instructions ? (
                      <View style={{ gap: 6 }}>
                        <Text style={ui.s.label}>指令</Text>
                        <Markdown>{agent.instructions}</Markdown>
                      </View>
                    ) : null}

                    <Text style={ui.s.tiny}>更新于 {fmtDateTime(agent.updated_at)}</Text>
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
                <Btn ui={ui} label="编辑" icon="Pencil" onPress={() => setEditOpen(true)} />
                {agent.archived_at ? (
                  <Btn ui={ui} label="恢复" icon="ArchiveRestore" busy={busy} onPress={() => void restore()} />
                ) : (
                  <Btn ui={ui} label="归档" icon="Archive" tone="danger" busy={busy} onPress={() => setArchiveOpen(true)} />
                )}
                <Btn ui={ui} label="开始聊天" icon="MessagesSquare" tone="primary" onPress={() => onChat(agent)} />
              </View>
            </View>
          ) : null}
        </Modal.Content>
      </Modal>

      <Modal
        title="归档智能体"
        icon={<Icon name="Archive" size={16} color={ui.c.danger} />}
        open={archiveOpen && Boolean(agent)}
        onOpenChange={(next) => !next && setArchiveOpen(false)}
      >
        <Modal.Content>
          <Text style={ui.s.body}>
            归档后「{agent?.name ?? ""}」将不再出现在智能体列表中，已派发的任务不受影响。可在归档区恢复。
          </Text>
          <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
            <Btn ui={ui} label="取消" onPress={() => setArchiveOpen(false)} />
            <Btn ui={ui} label="归档" tone="danger" busy={busy} onPress={() => void archive()} />
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
        onError={(message) => toast.error(message)}
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
  const all = useQuery(api, "/api/skills", { select: (data) => asList<Skill>(data, "skills") }, key);
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
    else toast.error(result.error ?? "更新失败");
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
    else toast.error(result.error ?? "更新失败");
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.s.tiny}>技能为智能体提供可复用的工具与知识，绑定后可在开关里单独停用。</Text>
      {all.loading && items.length === 0 ? <LoadingRow ui={ui} /> : null}
      {!all.loading && items.length === 0 ? (
        <Empty ui={ui} icon="Blocks" title="工作区还没有技能" description="在 Multica 后台创建技能后回到「团队 → 技能」即可看到并绑定。" />
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
            {linked ? <Tag ui={ui} label={enabled ? "已启用" : "已停用"} tone={enabled ? "success" : "muted"} /> : null}
            {linked ? (
              <IconBtn
                ui={ui}
                icon={enabled ? "ToggleRight" : "ToggleLeft"}
                label={enabled ? "停用技能" : "启用技能"}
                color={enabled ? ui.c.accent : ui.c.muted}
                busy={busyId === skill.id}
                onPress={() => void setEnabled(skill, !enabled)}
              />
            ) : null}
            <IconBtn
              ui={ui}
              icon={linked ? "Minus" : "Plus"}
              label={linked ? `解绑技能 ${skill.name}` : `绑定技能 ${skill.name}`}
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
  const query = useQuery(
    api,
    `/api/agents/${agentId}/tasks`,
    { query: { limit: 20 }, select: (data) => asList<AgentTask>(data, "tasks") },
    `${ctx.bump}:${agentId}`,
  );
  const items = query.data ?? [];

  return (
    <View style={{ gap: 8 }}>
      <View style={[ui.s.row, { justifyContent: "space-between" }]}>
        <Text style={ui.s.tiny}>最近 20 条任务派发记录</Text>
        <IconBtn ui={ui} icon="RefreshCw" label="刷新任务" busy={query.refreshing} onPress={query.refresh} />
      </View>
      {query.loading && items.length === 0 ? <LoadingRow ui={ui} /> : null}
      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      {!query.loading && !query.error && items.length === 0 ? (
        <Empty ui={ui} icon="ListChecks" title="暂无任务" description="智能体被派发需求或对话后会在这里留下记录。" />
      ) : null}
      {items.map((task) => {
        const meta = TASK_STATUS[task.status ?? ""] ?? { label: task.status || "未知", tone: "muted" as const };
        const output = task.result?.output?.trim();
        const cost = task.completed_at
          ? Math.max(0, Math.round((Date.parse(task.completed_at) - Date.parse(task.dispatched_at ?? task.completed_at)) / 1000))
          : null;
        return (
          <View key={task.id} style={{ gap: 4, padding: 9, borderRadius: 9, backgroundColor: ui.c.surface0 }}>
            <View style={[ui.s.row, { gap: 8 }]}>
              <Tag ui={ui} label={meta.label} tone={meta.tone} />
              <Text numberOfLines={1} style={[ui.s.tiny, ui.s.grow]}>
                {task.issue_id ? `需求 ${task.issue_id.slice(0, 8)}` : "对话任务"} · 第 {task.attempt ?? 1}/
                {task.max_attempts ?? 1} 次
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
        setError(`变量名 ${name} 不合法`);
        return;
      }
      custom_env[name] = row.value;
    }
    setBusy(true);
    setError(null);
    const result = await api({ method: "PUT", path: `/api/agents/${agentId}/env`, body: { custom_env } });
    setBusy(false);
    if (result.ok) {
      toast.show("环境变量已保存", { variant: "success" });
      query.refresh();
      ctx.invalidate();
    } else setError(result.error ?? "保存失败");
  };

  const update = (index: number, patch: Partial<{ key: string; value: string }>) =>
    setRows((list) => list.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  return (
    <View style={{ gap: 10 }}>
      <View style={[ui.s.row, { justifyContent: "space-between" }]}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[ui.s.body, { fontWeight: "600" }]}>自定义环境变量</Text>
          <Text style={ui.s.tiny}>在每次运行该智能体时注入，值可以为空。</Text>
        </View>
        <IconBtn ui={ui} icon={reveal ? "EyeOff" : "Eye"} label={reveal ? "隐藏变量值" : "显示变量值"} onPress={() => setReveal((v) => !v)} />
      </View>

      {rows.length === 0 ? <Text style={ui.s.muted}>还没有自定义环境变量。</Text> : null}

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
            label="删除变量"
            onPress={() => setRows((list) => list.filter((_, i) => i !== index))}
          />
        </View>
      ))}

      {error ? <ErrorNote ui={ui} message={error} /> : null}

      <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
        <Btn ui={ui} label="添加变量" icon="Plus" onPress={() => setRows((list) => [...list, { key: "", value: "" }])} />
        <View style={ui.s.grow} />
        <Btn ui={ui} label="保存" icon="Save" tone="primary" busy={busy} onPress={() => void save()} />
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
    else toast.error(result.error ?? "更新失败");
  };

  const remove = async (item: Record<string, unknown>) => {
    const serverId = str(item.id ?? item.server_id);
    if (!serverId) return;
    setBusyId(serverId);
    const result = await api({ method: "DELETE", path: `/api/agents/${agentId}/mcp-servers/${serverId}` });
    setBusyId(null);
    if (result.ok) {
      toast.show("已移除 MCP 服务器", { variant: "success" });
      query.refresh();
    } else toast.error(result.error ?? "移除失败");
  };

  return (
    <View style={{ gap: 8 }}>
      <Text style={ui.s.tiny}>管理员在 Multica 后台或此处添加的 MCP 服务器，可按智能体启用或移除。</Text>
      {query.loading && items.length === 0 ? <LoadingRow ui={ui} /> : null}
      {!query.loading && items.length === 0 ? (
        <Empty ui={ui} icon="Plug" title="未连接 MCP 服务器" description="在工作区设置中添加 MCP 服务器后，可在这里为智能体启用。" />
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
            <Tag ui={ui} label={enabled ? "已启用" : "已停用"} tone={enabled ? "success" : "muted"} />
            <IconBtn
              ui={ui}
              icon={enabled ? "ToggleRight" : "ToggleLeft"}
              label={enabled ? "停用 MCP 服务器" : "启用 MCP 服务器"}
              color={enabled ? ui.c.accent : ui.c.muted}
              busy={busyId === id}
              onPress={() => void toggle(item)}
            />
            <IconBtn ui={ui} icon="Trash2" label="移除 MCP 服务器" color={ui.c.danger} busy={busyId === id} onPress={() => void remove(item)} />
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
  const all = useQuery(api, "/api/labels", { select: (data) => asList<Label>(data, "labels") }, key);
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
    } else toast.error(result.error ?? "添加失败");
  };

  const detach = async (label: Label) => {
    setBusyId(label.id);
    const result = await api({ method: "DELETE", path: `/api/agents/${agentId}/labels/${label.id}` });
    setBusyId(null);
    if (result.ok) {
      attached.refresh();
      ctx.invalidate();
    } else toast.error(result.error ?? "移除失败");
  };

  return (
    <View style={{ gap: 12 }}>
      <View style={{ gap: 6 }}>
        <Text style={ui.s.label}>已绑定</Text>
        {current.length === 0 ? (
          <Text style={ui.s.muted}>该智能体还没有标签。</Text>
        ) : (
          <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
            {current.map((label) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`移除标签 ${label.name}`}
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
        <Text style={ui.s.label}>可添加</Text>
        {available.length === 0 ? (
          <Text style={ui.s.muted}>没有可用的智能体标签，可在「标签」页新建。</Text>
        ) : (
          <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
            {available.map((label) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`添加标签 ${label.name}`}
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
  onError,
}: {
  ui: ReturnType<typeof useUi>;
  api: ReturnType<typeof useWorkbench>["api"];
  agent: Agent | null;
  runtimes: AgentRuntime[];
  onClose(): void;
  onSaved(): void;
  onError(message: string): void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [model, setModel] = useState("");
  const [maxTasks, setMaxTasks] = useState("");
  const [permission, setPermission] = useState<"public" | "private">("public");
  const [runtimeId, setRuntimeId] = useState("");
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
      setError("请填写名称");
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
    else setError(result.error ?? "保存失败");
  };

  return (
    <Modal title="编辑智能体" icon={<Icon name="Pencil" size={16} color={ui.c.muted} />} open={Boolean(agent)} onOpenChange={(next) => !next && onClose()}>
      <Modal.Content>
        <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 12 }}>
          <Field ui={ui} label="名称" value={name} onChangeText={setName} placeholder="智能体名称" />
          <Field ui={ui} label="描述" value={description} onChangeText={setDescription} multiline placeholder="这个智能体负责什么" />
          <Field ui={ui} label="模型" value={model} onChangeText={setModel} placeholder="例如 gpt-5.1-codex" hint="留空则使用运行时默认模型。" />
          <Field
            ui={ui}
            label="最大并发任务"
            value={maxTasks}
            onChangeText={setMaxTasks}
            placeholder="留空表示不限制"
          />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>调用权限</Text>
            <Chips<"public" | "private">
              ui={ui}
              value={permission}
              onChange={setPermission}
              options={[
                { value: "public", label: "公开调用", icon: "Globe" },
                { value: "private", label: "仅私有", icon: "Lock" },
              ]}
            />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>运行时</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              <ChipButton ui={ui} active={!runtimeId} label="不绑定" onPress={() => setRuntimeId("")} />
              {runtimes.map((runtime) => (
                <ChipButton
                  key={runtime.id}
                  ui={ui}
                  active={runtimeId === runtime.id}
                  label={runtime.custom_name || runtime.name}
                  onPress={() => setRuntimeId(runtime.id)}
                />
              ))}
            </ScrollView>
          </View>
          <Field ui={ui} label="指令" value={instructions} onChangeText={setInstructions} multiline placeholder="系统提示词 / 工作规则" hint="支持 Markdown。" />
          {error ? <ErrorNote ui={ui} message={error} /> : null}
        </ScrollView>
        <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
          <Btn ui={ui} label="取消" onPress={onClose} />
          <Btn ui={ui} label="保存" tone="primary" busy={busy} onPress={() => void save()} />
        </View>
      </Modal.Content>
    </Modal>
  );
}

function ChipButton({ ui, active, label, onPress }: { ui: ReturnType<typeof useUi>; active: boolean; label: string; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [ui.s.chip, active && ui.s.chipActive, pressed && ui.s.pressed]}
    >
      <Text style={[ui.s.chipText, active && ui.s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

