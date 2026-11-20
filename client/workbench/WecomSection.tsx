import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useRpc } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import {
  wecomGetRpc,
  wecomPushRpc,
  wecomSaveRpc,
  wecomTestRpc,
  wecomUnbindRpc,
  type WecomView,
} from "../../shared/contracts";
import { asList, useQuery } from "./api";
import { Avatar, Btn, Card, Divider, Empty, Field, Tag, useUi, type Ui } from "./bits";
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

export function WecomSection() {
  const ctx = useWorkbench();
  const { theme, compact, api, workspaceId, bump, navigate, toast } = ctx;
  const ui = useUi(theme, compact);
  const getRpc = useRpc(wecomGetRpc);
  const saveRpc = useRpc(wecomSaveRpc);
  const testRpc = useRpc(wecomTestRpc);
  const pushRpc = useRpc(wecomPushRpc);
  const unbindRpc = useRpc(wecomUnbindRpc);

  const [view, setView] = useState<WecomView | null>(null);
  const [botId, setBotId] = useState("");
  const [secret, setSecret] = useState("");
  const [agentId, setAgentId] = useState<string | null>(null);
  const [interval, setIntervalSec] = useState(60);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [confirmUnbind, setConfirmUnbind] = useState<string | null>(null);

  const agentsQuery = useQuery(api, "/api/agents", { query: { limit: 100 }, select: (data) => asList<Agent>(data, "agents") }, `${workspaceId}:${bump}`);
  const agents = agentsQuery.data ?? [];
  const boundAgent = agents.find((agent) => agent.id === (agentId ?? view?.agentId));

  const refresh = useCallback(async () => {
    try {
      const next = await getRpc({});
      setView(next);
      return next;
    } catch {
      return null;
    }
  }, [getRpc]);

  useEffect(() => {
    void refresh().then((next) => {
      if (!next) return;
      setBotId(next.botId);
      setAgentId(next.agentId);
      setIntervalSec(next.pushIntervalSec);
    });
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [refresh]);

  const persist = async (patch: Parameters<typeof saveRpc>[0], message?: string) => {
    setSaving(true);
    try {
      const next = await saveRpc(patch);
      setView(next);
      setDirty(false);
      if (message) toast.show(message, { variant: "success" });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  const saveDraft = () =>
    void persist(
      { botId, secret: secret.trim() || undefined, agentId, pushIntervalSec: interval },
      "企业微信配置已保存",
    );

  const statusTag = !view
    ? null
    : !view.configured
      ? <Tag ui={ui} label="未配置" tone="muted" />
      : view.status === "connected"
        ? <Tag ui={ui} label="已连接" tone="success" icon="Check" />
        : view.status === "error"
          ? <Tag ui={ui} label="连接错误" tone="danger" icon="TriangleAlert" />
          : <Tag ui={ui} label="连接中" tone="warning" icon="Loader" />;

  return (
    <View style={{ gap: 14 }}>
      <Card ui={ui} style={{ gap: 12 }}>
        <View style={[ui.s.row, { gap: 8 }]}>
          <Icon name="MessagesSquare" size={16} color={ui.c.brand} />
          <Text style={[ui.s.h2, { flex: 1 }]}>企业微信智能机器人</Text>
          {statusTag}
          <Switch
            ui={ui}
            label="启用企业微信机器人"
            value={view?.enabled ?? false}
            onChange={(next) => void persist({ enabled: next }, next ? "已启用企业微信机器人" : "已停用企业微信机器人")}
          />
        </View>
        <Text style={ui.s.tiny}>
          通过企业微信智能机器人的 websocket 长连接对接（无需公网回调地址）。在企微里给机器人发消息会创建对应的 Multica 聊天会话；未读通知也会推送到企微。
        </Text>
        {view?.error ? (
          <View style={[ui.s.row, { gap: 6, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8, backgroundColor: `${ui.c.danger}14` }]}>
            <Icon name="TriangleAlert" size={13} color={ui.c.danger} />
            <Text style={[ui.s.tiny, { flex: 1, color: ui.c.danger }]}>{view.error}</Text>
          </View>
        ) : null}

        <Field ui={ui} label="机器人 BotId" value={botId} onChangeText={(text) => { setBotId(text); setDirty(true); }} placeholder="在企业微信后台「智能机器人」中获取" />
        <Field
          ui={ui}
          label="机器人 Secret"
          value={secret}
          onChangeText={(text) => { setSecret(text); setDirty(true); }}
          placeholder={view?.secretMasked ? `已保存 ${view.secretMasked}，留空则不修改` : "在企业微信后台获取"}
          secureTextEntry
        />

        <Row ui={ui} label="绑定智能体" hint="企微消息与未读通知都会交给它处理">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="选择绑定智能体"
            onPress={() => setAgentOpen(true)}
            style={({ pressed }) => [
              ui.s.row,
              { gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: ui.c.border, backgroundColor: ui.c.card },
              pressed && ui.s.pressed,
            ]}
          >
            {boundAgent ? <Avatar ui={ui} name={boundAgent.name} url={boundAgent.avatar_url} size={20} /> : <Icon name="Bot" size={14} color={ui.c.muted} />}
            <Text style={{ fontSize: 13, color: ui.c.fg }}>{boundAgent?.name ?? "未绑定"}</Text>
            <Icon name="ChevronDown" size={13} color={ui.c.muted} />
          </Pressable>
        </Row>

        <Row ui={ui} label="推送未读通知" hint="把 Multica 收件箱的新未读推送到企微会话">
          <Switch ui={ui} label="推送未读通知" value={view?.pushUnread ?? true} onChange={(next) => void persist({ pushUnread: next })} />
        </Row>
        <Row ui={ui} label="交给绑定智能体处理" hint="推送后自动让智能体处理通知并回传结论">
          <Switch ui={ui} label="交给绑定智能体处理" value={view?.delegate ?? false} onChange={(next) => void persist({ delegate: next })} />
        </Row>
        <Row ui={ui} label="推送间隔" hint="检查未读通知的频率">
          <View style={[ui.s.row, { gap: 4 }]}>
            {INTERVALS.map((sec) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${sec} 秒`}
                key={sec}
                onPress={() => { setIntervalSec(sec); void persist({ pushIntervalSec: sec }); }}
                style={({ pressed }) => [
                  ui.s.chip,
                  interval === sec && ui.s.chipActive,
                  pressed && ui.s.pressed,
                ]}
              >
                <Text style={[ui.s.chipText, interval === sec && ui.s.chipTextActive]}>{sec}s</Text>
              </Pressable>
            ))}
          </View>
        </Row>

        <Divider ui={ui} />
        <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
          <Btn ui={ui} label={saving ? "保存中…" : "保存配置"} icon="Check" tone="primary" busy={saving} disabled={!dirty} onPress={saveDraft} />
          <Btn
            ui={ui}
            label="发送测试消息"
            icon="Send"
            busy={testing}
            onPress={() => {
              setTesting(true);
              void testRpc({})
                .then((result) => {
                  if (result.ok) toast.show("测试消息已发送到企业微信", { variant: "success" });
                  else toast.error(result.error ?? "发送失败");
                  return refresh();
                })
                .finally(() => setTesting(false));
            }}
          />
          <Btn
            ui={ui}
            label="立即推送未读"
            icon="BellRing"
            busy={pushing}
            onPress={() => {
              setPushing(true);
              void pushRpc({})
                .then((result) => {
                  if (result.ok) toast.show(result.pushed > 0 ? `已推送 ${result.pushed} 条未读` : "没有新的未读通知", { variant: "success" });
                  else toast.error(result.error ?? "推送失败");
                  return refresh();
                })
                .finally(() => setPushing(false));
            }}
          />
        </View>
        <Text style={ui.s.tiny}>
          当前推送目标：{view?.targetChatId ? `${view.targetChatId.slice(0, 16)}…` : "暂无（先在企微里给机器人发一条消息）"} · 配置存于 {view?.storePath ?? "本机"}
        </Text>
      </Card>

      <Card ui={ui} style={{ gap: 10 }}>
        <View style={[ui.s.row, { gap: 8 }]}>
          <Icon name="Link" size={15} color={ui.c.muted} />
          <Text style={[ui.s.h2, { flex: 1 }]}>会话绑定</Text>
          <Text style={ui.s.tiny}>{view?.bindings.length ?? 0} 个</Text>
        </View>
        {!view || view.bindings.length === 0 ? (
          <Text style={ui.s.tiny}>还没有绑定。在企微里给机器人发第一条消息后，会自动创建 Multica 会话并绑定。</Text>
        ) : (
          <View style={{ gap: 6 }}>
            {view.bindings.map((binding) => (
              <View key={binding.chatid} style={[ui.s.row, { gap: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: ui.c.fill }]}>
                <Icon name="MessagesSquare" size={14} color={ui.c.muted} />
                <View style={{ flex: 1, gap: 1 }}>
                  <Text numberOfLines={1} style={{ fontSize: 13, color: ui.c.fg }}>{binding.label}</Text>
                  <Text style={ui.s.tiny}>企微 {binding.chatid.slice(0, 14)}… · 更新于 {relTime(binding.updatedAt)}</Text>
                </View>
                <Btn ui={ui} label="打开会话" icon="ArrowUpRight" onPress={() => navigate("chat", { sessionId: binding.sessionId })} />
                <Btn ui={ui} label="解绑" icon="Unlink" onPress={() => setConfirmUnbind(binding.chatid)} />
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card ui={ui} style={{ gap: 10 }}>
        <View style={[ui.s.row, { gap: 8 }]}>
          <Icon name="Activity" size={15} color={ui.c.muted} />
          <Text style={[ui.s.h2, { flex: 1 }]}>最近动态</Text>
          <Text style={ui.s.tiny}>已推送 {view?.pushedCount ?? 0} 条</Text>
        </View>
        {!view || view.activity.length === 0 ? (
          <Empty ui={ui} icon="Activity" title="还没有动态" description="启用并连接后，收发消息与推送会记录在这里。" />
        ) : (
          <View style={{ gap: 4 }}>
            {view.activity.slice(0, 12).map((entry) => {
              const meta = KIND_META[entry.kind] ?? KIND_META.system;
              const color =
                meta.tone === "accent" ? ui.c.brand : meta.tone === "success" ? ui.c.success : meta.tone === "warning" ? ui.c.warning : meta.tone === "danger" ? ui.c.danger : ui.c.muted;
              return (
                <View key={entry.id} style={[ui.s.rowTop, { gap: 8, paddingVertical: 4 }]}>
                  <Icon name={meta.icon} size={13} color={color} />
                  <Text style={[ui.s.tiny, { flex: 1, color: ui.c.fg }]}>{entry.text}</Text>
                  <Text style={ui.s.tiny}>{relTime(entry.at)}</Text>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <Modal title="选择绑定智能体" icon={<Icon name="Bot" size={16} color={ui.c.muted} />} open={agentOpen} onOpenChange={setAgentOpen}>
        <Modal.Content>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 2 }}>
            {agents.length === 0 ? <Empty ui={ui} icon="Bot" title="没有可用智能体" description="先在团队页创建智能体。" /> : null}
            {agents.map((agent) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`绑定 ${agent.name}`}
                key={agent.id}
                onPress={() => { setAgentId(agent.id); setDirty(true); setAgentOpen(false); }}
                style={({ pressed }) => [ui.s.menuItem, pressed && ui.s.pressed]}
              >
                <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={24} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: ui.c.fg }}>{agent.name}</Text>
                  <Text style={ui.s.tiny}>{agent.model ?? "未设置模型"}</Text>
                </View>
                {(agentId ?? view?.agentId) === agent.id ? <Icon name="Check" size={14} color={ui.c.brand} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </Modal.Content>
      </Modal>

      <Modal title="解绑会话" icon={<Icon name="Unlink" size={16} color={ui.c.danger} />} open={confirmUnbind !== null} onOpenChange={(next) => { if (!next) setConfirmUnbind(null); }}>
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>解绑后，该企微会话的下一条消息会创建新的 Multica 会话。已有会话不会被删除。</Text>
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
                  void unbindRpc({ chatid }).then((next) => { setView(next); toast.show("已解绑", { variant: "success" }); });
                }}
              />
            </View>
          </View>
        </Modal.Content>
      </Modal>
    </View>
  );
}