import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useRpc } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  bootstrapRpc,
  wecomListRpc,
  wecomPushRpc,
  wecomRemoveRpc,
  wecomSaveRpc,
  wecomTestRpc,
  wecomUnbindRpc,
  type RemoteWorkspace,
  type ServerView,
  type WecomBotView,
  type WecomListView,
} from "../../shared/contracts";
import { asList, useQuery, type ApiFn } from "./api";
import { Avatar, Btn, Card, Divider, Empty, ErrorNote, Field, Tag, useUi, type Ui } from "./bits";
import { useWorkbench } from "./context";
import { relTime, type Agent } from "./model";

const INTERVALS = [30, 60, 120, 300];

const KIND_META: Record<string, { icon: string; tone: "accent" | "success" | "warning" | "danger" | "muted" }> = {
  in: { icon: "MessageSquare", tone: "accent" },
  out: { icon: "Bot", tone: "success" },
  push: { icon: "BellRing", tone: "warning" },
  error: { icon: "TriangleAlert", tone: "danger" },
  system: { icon: "Info", tone: "muted" },
};

function Switch({ ui, value, onChange, label }: { ui: Ui; value: boolean; onChange(next: boolean): void; label: string }) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value }}
      aria-checked={value}
      onPress={() => onChange(!value)}
      style={({ pressed }) => [
        {
          width: 40,
          height: 22,
          borderRadius: 11,
          padding: 2,
          justifyContent: "center",
          backgroundColor: value ? (ui.c.dark ? "#2ea043" : ui.c.success) : ui.c.fillStrong,
        },
        pressed && ui.s.pressed,
      ]}
    >
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 9,
          backgroundColor: "#ffffff",
          borderWidth: 1,
          borderColor: ui.c.dark ? "transparent" : ui.c.faint,
          alignSelf: value ? "flex-end" : "flex-start",
          boxShadow: ui.c.shadow,
        }}
      />
    </Pressable>
  );
}

function Row({ ui, label, hint, children }: { ui: Ui; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View style={[ui.s.row, { gap: 10, minHeight: 34 }]}>
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ fontSize: 13, color: ui.c.fg }}>{label}</Text>
        {hint ? <Text style={ui.s.tiny}>{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function StatusTag({ ui, bot }: { ui: Ui; bot: WecomBotView }) {
  if (!bot.configured) return <Tag ui={ui} label="未配置" tone="muted" />;
  if (!bot.enabled) return <Tag ui={ui} label="已停用" tone="muted" />;
  if (bot.status === "connected") return <Tag ui={ui} label="已连接" tone="success" icon="Check" />;
  if (bot.status === "error") return <Tag ui={ui} label="连接错误" tone="danger" icon="TriangleAlert" />;
  return <Tag ui={ui} label="连接中" tone="warning" icon="Loader" />;
}

function BotCard({
  ui,
  api,
  bot,
  servers,
  onEdit,
  onRemove,
  onChanged,
}: {
  ui: Ui;
  api: ApiFn;
  bot: WecomBotView;
  servers: ServerView[];
  onEdit(): void;
  onRemove(): void;
  onChanged(next: WecomListView): void;
}) {
  const { navigate, toast, workspaceId } = useWorkbench();
  const saveRpc = useRpc(wecomSaveRpc);
  const testRpc = useRpc(wecomTestRpc);
  const pushRpc = useRpc(wecomPushRpc);
  const unbindRpc = useRpc(wecomUnbindRpc);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmUnbind, setConfirmUnbind] = useState<string | null>(null);

  const agentsQuery = useQuery(
    api,
    "/api/agents",
    { query: { limit: 100 }, serverId: bot.serverId || undefined, workspaceId: bot.workspaceId ?? undefined, select: (data) => asList<Agent>(data, "agents") },
    `wecom-card:${bot.id}`,
  );
  const boundAgent = (agentsQuery.data ?? []).find((agent) => agent.id === bot.agentId);
  const server = servers.find((item) => item.id === bot.serverId);
  const workspaceLabel = bot.workspaceId
    ? bot.workspaceId === workspaceId
      ? "当前工作区"
      : `工作区 ${bot.workspaceId.slice(0, 8)}…`
    : "跟随服务器当前工作区";

  const patch = async (input: Parameters<typeof saveRpc>[0], message?: string) => {
    setBusy("save");
    try {
      const next = await saveRpc({ id: bot.id, ...input });
      onChanged(next);
      if (message) toast.show(message, { variant: "success" });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card ui={ui} style={{ gap: 10 }}>
      <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
        <Icon name="MessagesSquare" size={16} color={ui.c.brand} />
        <View style={{ flex: 1, minWidth: 120, gap: 1 }}>
          <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "600", color: ui.c.fg }}>
            {server?.name ?? "未知服务器"}
          </Text>
          <Text style={ui.s.tiny}>{workspaceLabel}</Text>
        </View>
        <StatusTag ui={ui} bot={bot} />
        <Switch ui={ui} label="启用该机器人" value={bot.enabled} onChange={(next) => void patch({ enabled: next }, next ? "已启用" : "已停用")} />
        <Btn ui={ui} label="编辑" icon="Pencil" onPress={onEdit} />
        <Btn ui={ui} label="删除" icon="Trash2" tone="danger" onPress={onRemove} />
      </View>

      {bot.error ? (
        <View style={[ui.s.row, { gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: `${ui.c.danger}14` }]}>
          <Icon name="TriangleAlert" size={13} color={ui.c.danger} />
          <Text style={[ui.s.tiny, { flex: 1, color: ui.c.danger }]}>{bot.error}</Text>
        </View>
      ) : null}

      <Row ui={ui} label="绑定智能体" hint="该服务器的企微消息与未读通知交给它处理">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="选择绑定智能体"
          onPress={onEdit}
          style={({ pressed }) => [
            ui.s.row,
            { gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: ui.c.border, backgroundColor: ui.c.card },
            pressed && ui.s.pressed,
          ]}
        >
          {boundAgent ? <Avatar ui={ui} name={boundAgent.name} url={boundAgent.avatar_url} size={20} /> : <Icon name="Bot" size={14} color={ui.c.muted} />}
          <Text style={{ fontSize: 13, color: ui.c.fg }}>{boundAgent?.name ?? (bot.agentId ? `${bot.agentId.slice(0, 8)}…` : "未绑定")}</Text>
          <Icon name="ChevronDown" size={13} color={ui.c.muted} />
        </Pressable>
      </Row>

      <Row ui={ui} label="推送未读通知" hint="把该工作区收件箱的新未读推送到企微">
        <Switch ui={ui} label="推送未读通知" value={bot.pushUnread} onChange={(next) => void patch({ pushUnread: next })} />
      </Row>
      <Row ui={ui} label="交给绑定智能体处理" hint="推送后自动让智能体处理并回传结论">
        <Switch ui={ui} label="交给绑定智能体处理" value={bot.delegate} onChange={(next) => void patch({ delegate: next })} />
      </Row>
      <Row ui={ui} label="推送间隔">
        <View style={[ui.s.row, { gap: 4 }]}>
          {INTERVALS.map((sec) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${sec} 秒`}
              key={sec}
              onPress={() => void patch({ pushIntervalSec: sec })}
              style={({ pressed }) => [ui.s.chip, bot.pushIntervalSec === sec && ui.s.chipActive, pressed && ui.s.pressed]}
            >
              <Text style={[ui.s.chipText, bot.pushIntervalSec === sec && ui.s.chipTextActive]}>{sec}s</Text>
            </Pressable>
          ))}
        </View>
      </Row>

      <Divider ui={ui} />
      <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
        <Btn
          ui={ui}
          label="发送测试消息"
          icon="Send"
          busy={busy === "test"}
          onPress={() => {
            setBusy("test");
            void testRpc({ id: bot.id })
              .then((result) => {
                if (result.ok) toast.show("测试消息已发送到企业微信", { variant: "success" });
                else toast.error(result.error ?? "发送失败");
              })
              .finally(() => setBusy(null));
          }}
        />
        <Btn
          ui={ui}
          label="立即推送未读"
          icon="BellRing"
          busy={busy === "push"}
          onPress={() => {
            setBusy("push");
            void pushRpc({ id: bot.id })
              .then((result) => {
                if (result.ok) toast.show(result.pushed > 0 ? `已推送 ${result.pushed} 条未读` : "没有新的未读通知", { variant: "success" });
                else toast.error(result.error ?? "推送失败");
              })
              .finally(() => setBusy(null));
          }}
        />
        <Text style={[ui.s.tiny, { flex: 1, minWidth: 140 }]}>
          推送目标：{bot.targetChatId ? `${bot.targetChatId.slice(0, 14)}…` : "暂无（先在企微发一条消息）"}
        </Text>
      </View>

      {bot.bindings.length > 0 ? (
        <View style={{ gap: 6 }}>
          <Text style={ui.s.label}>会话绑定 · {bot.bindings.length}</Text>
          {bot.bindings.map((binding) => (
            <View key={binding.chatid} style={[ui.s.row, { gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: ui.c.fill }]}>
              <Icon name="MessagesSquare" size={14} color={ui.c.muted} />
              <View style={{ flex: 1, gap: 1 }}>
                <Text numberOfLines={1} style={{ fontSize: 13, color: ui.c.fg }}>{binding.label}</Text>
                <Text style={ui.s.tiny}>更新于 {relTime(binding.updatedAt)}</Text>
              </View>
              <Btn ui={ui} label="打开会话" icon="ArrowUpRight" onPress={() => navigate("chat", { sessionId: binding.sessionId })} />
              <Btn ui={ui} label="解绑" icon="Unlink" onPress={() => setConfirmUnbind(binding.chatid)} />
            </View>
          ))}
        </View>
      ) : null}

      {bot.activity.length > 0 ? (
        <View style={{ gap: 4 }}>
          <Text style={ui.s.label}>最近动态 · 已推送 {bot.pushedCount} 条</Text>
          {bot.activity.slice(0, 5).map((entry) => {
            const meta = KIND_META[entry.kind] ?? KIND_META.system;
            const color =
              meta.tone === "accent" ? ui.c.brand : meta.tone === "success" ? ui.c.success : meta.tone === "warning" ? ui.c.warning : meta.tone === "danger" ? ui.c.danger : ui.c.muted;
            return (
              <View key={entry.id} style={[ui.s.rowTop, { gap: 8, paddingVertical: 3 }]}>
                <Icon name={meta.icon} size={13} color={color} />
                <Text style={[ui.s.tiny, { flex: 1, color: ui.c.fg }]}>{entry.text}</Text>
                <Text style={ui.s.tiny}>{relTime(entry.at)}</Text>
              </View>
            );
          })}
        </View>
      ) : null}

      <Modal title="解绑会话" icon={<Icon name="Unlink" size={16} color={ui.c.danger} />} open={confirmUnbind !== null} onOpenChange={(next) => { if (!next) setConfirmUnbind(null); }}>
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>解绑后该企微会话的下一条消息会创建新的 Multica 会话，已有会话不会删除。</Text>
            <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8 }]}>
              <Btn ui={ui} label="取消" onPress={() => setConfirmUnbind(null)} />
              <Btn
                ui={ui}
                label="解绑"
                tone="danger"
                onPress={() => {
                  const chatid = confirmUnbind;
                  setConfirmUnbind(null);
                  if (!chatid) return;
                  void unbindRpc({ id: bot.id, chatid }).then((next) => { onChanged(next); toast.show("已解绑", { variant: "success" }); });
                }}
              />
            </View>
          </View>
        </Modal.Content>
      </Modal>
    </Card>
  );
}

function EditorModal({
  ui,
  api,
  open,
  initial,
  servers,
  onClose,
  onSaved,
}: {
  ui: Ui;
  api: ApiFn;
  open: boolean;
  initial: WecomBotView | null;
  servers: ServerView[];
  onClose(): void;
  onSaved(next: WecomListView): void;
}) {
  const { toast } = useWorkbench();
  const saveRpc = useRpc(wecomSaveRpc);
  const bootstrapRpcFn = useRpc(bootstrapRpc);
  const [serverId, setServerId] = useState("");
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [botId, setBotId] = useState("");
  const [secret, setSecret] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<RemoteWorkspace[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setServerId(initial?.serverId ?? servers[0]?.id ?? "");
    setWorkspaceId(initial?.workspaceId ?? null);
    setBotId(initial?.botId ?? "");
    setSecret("");
    setAgentId(initial?.agentId ?? null);
  }, [open, initial, servers]);

  useEffect(() => {
    if (!open || !serverId) return;
    let alive = true;
    void bootstrapRpcFn({ serverId })
      .then((result) => { if (alive) setWorkspaces(result.workspaces ?? []); })
      .catch(() => { if (alive) setWorkspaces([]); });
    return () => { alive = false; };
  }, [open, serverId, bootstrapRpcFn]);

  const agentsQuery = useQuery(
    api,
    open && serverId ? "/api/agents" : null,
    { query: { limit: 100 }, serverId: serverId || undefined, workspaceId: workspaceId ?? undefined, select: (data) => asList<Agent>(data, "agents") },
    `wecom-edit:${serverId}:${workspaceId ?? ""}`,
  );
  const agents = agentsQuery.data ?? [];

  const submit = async () => {
    if (!serverId) { toast.error("请选择 Multica 服务器"); return; }
    if (!botId.trim()) { toast.error("请填写机器人 BotId"); return; }
    if (!initial && !secret.trim()) { toast.error("请填写机器人 Secret"); return; }
    setSaving(true);
    try {
      const next = await saveRpc({
        id: initial?.id,
        serverId,
        workspaceId,
        botId: botId.trim(),
        secret: secret.trim() || undefined,
        agentId,
      });
      onSaved(next);
      toast.show(initial ? "机器人已更新" : "机器人已添加", { variant: "success" });
      onClose();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={initial ? "编辑企业微信机器人" : "添加企业微信机器人"} icon={<Icon name="MessagesSquare" size={16} color={ui.c.muted} />} open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <Modal.Content>
        <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>Multica 服务器</Text>
            <View style={{ gap: 2 }}>
              {servers.map((server) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={server.name}
                  key={server.id}
                  onPress={() => { setServerId(server.id); setWorkspaceId(null); setAgentId(null); }}
                  style={({ pressed }) => [ui.s.menuItem, serverId === server.id && ui.s.hoverSurface, pressed && ui.s.pressed]}
                >
                  <Icon name="Server" size={14} color={serverId === server.id ? ui.c.fg : ui.c.muted} />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: ui.c.fg }}>{server.name}</Text>
                  {serverId === server.id ? <Icon name="Check" size={14} color={ui.c.brand} /> : null}
                </Pressable>
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>工作区</Text>
            <View style={{ gap: 2 }}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="跟随服务器当前工作区"
                onPress={() => { setWorkspaceId(null); setAgentId(null); }}
                style={({ pressed }) => [ui.s.menuItem, workspaceId === null && ui.s.hoverSurface, pressed && ui.s.pressed]}
              >
                <Icon name="Layers" size={14} color={ui.c.muted} />
                <Text style={{ flex: 1, fontSize: 14, color: ui.c.fg }}>跟随服务器当前工作区</Text>
                {workspaceId === null ? <Icon name="Check" size={14} color={ui.c.brand} /> : null}
              </Pressable>
              {workspaces.map((workspace) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={workspace.name}
                  key={workspace.id}
                  onPress={() => { setWorkspaceId(workspace.id); setAgentId(null); }}
                  style={({ pressed }) => [ui.s.menuItem, workspaceId === workspace.id && ui.s.hoverSurface, pressed && ui.s.pressed]}
                >
                  <Icon name="FolderKanban" size={14} color={workspaceId === workspace.id ? ui.c.fg : ui.c.muted} />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: ui.c.fg }}>{workspace.name}</Text>
                  {workspaceId === workspace.id ? <Icon name="Check" size={14} color={ui.c.brand} /> : null}
                </Pressable>
              ))}
            </View>
          </View>

          <Field ui={ui} label="机器人 BotId" value={botId} onChangeText={setBotId} placeholder="在企业微信后台「智能机器人」中获取" />
          <Field
            ui={ui}
            label="机器人 Secret"
            value={secret}
            onChangeText={setSecret}
            placeholder={initial?.secretMasked ? `已保存 ${initial.secretMasked}，留空则不修改` : "在企业微信后台获取"}
            secureTextEntry
          />

          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>绑定智能体（该服务器/工作区）</Text>
            <View style={{ gap: 2 }}>
              {agents.length === 0 ? <Text style={ui.s.tiny}>{agentsQuery.loading ? "读取智能体…" : "该工作区暂无智能体"}</Text> : null}
              {agents.map((agent) => (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`绑定 ${agent.name}`}
                  key={agent.id}
                  onPress={() => setAgentId(agent.id)}
                  style={({ pressed }) => [ui.s.menuItem, agentId === agent.id && ui.s.hoverSurface, pressed && ui.s.pressed]}
                >
                  <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={22} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: ui.c.fg }}>{agent.name}</Text>
                    <Text style={ui.s.tiny}>{agent.model ?? "未设置模型"}</Text>
                  </View>
                  {agentId === agent.id ? <Icon name="Check" size={14} color={ui.c.brand} /> : null}
                </Pressable>
              ))}
            </View>
          </View>
        </ScrollView>
        <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8, marginTop: 12 }]}>
          <Btn ui={ui} label="取消" onPress={onClose} />
          <Btn ui={ui} label={initial ? "保存" : "添加"} icon="Check" tone="primary" busy={saving} onPress={() => void submit()} />
        </View>
      </Modal.Content>
    </Modal>
  );
}

export function WecomSection() {
  const ctx = useWorkbench();
  const { theme, compact, api, servers, toast } = ctx;
  const ui = useUi(theme, compact);
  const listRpc = useRpc(wecomListRpc);
  const removeRpc = useRpc(wecomRemoveRpc);
  const [view, setView] = useState<WecomListView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<WecomBotView | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<WecomBotView | null>(null);

  const refresh = useCallback(async () => {
    try {
      const next = await listRpc({});
      setView(next);
      setLoadError(null);
      return next;
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : String(cause));
      return null;
    }
  }, [listRpc]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const bots = view?.bots ?? [];

  return (
    <View style={{ gap: 14 }}>
      <Card ui={ui} style={{ gap: 10 }}>
        <View style={[ui.s.row, { gap: 8 }]}>
          <Icon name="MessagesSquare" size={16} color={ui.c.brand} />
          <Text style={[ui.s.h2, { flex: 1 }]}>企业微信智能机器人</Text>
          <Btn ui={ui} label="添加机器人" icon="Plus" tone="primary" onPress={() => { setEditing(null); setEditorOpen(true); }} />
        </View>
        <Text style={ui.s.tiny}>
          每个机器人绑定到「一台 Multica 服务器 + 一个工作区」，可同时运行多个、互不干扰。通过企业微信智能机器人 websocket 长连接对接（无需公网回调地址）：企微消息创建对应 Multica 会话，未读通知推送到企微。
        </Text>
        <Text style={ui.s.tiny}>配置存于 {view?.storePath ?? "本机"}（Secret 仅存 daemon 侧）</Text>
      </Card>

      {loadError ? <ErrorNote ui={ui} message={`读取企业微信配置失败：${loadError}`} onRetry={() => void refresh()} /> : null}

      {bots.length === 0 ? (
        <Card ui={ui}>
          <Empty
            ui={ui}
            icon="MessagesSquare"
            title="还没有企业微信机器人"
            description="添加一个机器人，选择它要服务的 Multica 服务器与工作区，再填入企微后台的 BotId / Secret。"
            action={<Btn ui={ui} label="添加机器人" icon="Plus" tone="primary" onPress={() => { setEditing(null); setEditorOpen(true); }} />}
          />
        </Card>
      ) : (
        bots.map((bot) => (
          <BotCard
            key={bot.id}
            ui={ui}
            api={api}
            bot={bot}
            servers={servers}
            onEdit={() => { setEditing(bot); setEditorOpen(true); }}
            onRemove={() => setConfirmRemove(bot)}
            onChanged={(next) => setView(next)}
          />
        ))
      )}

      <EditorModal
        ui={ui}
        api={api}
        open={editorOpen}
        initial={editing}
        servers={servers}
        onClose={() => setEditorOpen(false)}
        onSaved={(next) => setView(next)}
      />

      <Modal title="删除机器人" icon={<Icon name="Trash2" size={16} color={ui.c.danger} />} open={confirmRemove !== null} onOpenChange={(next) => { if (!next) setConfirmRemove(null); }}>
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>删除后该机器人断开连接，其会话绑定与推送记录一并移除。Multica 侧已有会话不受影响。</Text>
            <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8 }]}>
              <Btn ui={ui} label="取消" onPress={() => setConfirmRemove(null)} />
              <Btn
                ui={ui}
                label="删除"
                tone="danger"
                onPress={() => {
                  const bot = confirmRemove;
                  setConfirmRemove(null);
                  if (!bot) return;
                  void removeRpc({ id: bot.id }).then((next) => { setView(next); toast.show("机器人已删除", { variant: "success" }); });
                }}
              />
            </View>
          </View>
        </Modal.Content>
      </Modal>
    </View>
  );
}