import { Icon, Markdown, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { asList, useQuery } from "../api";
import { Avatar, Btn, Card, Dot, Empty, ErrorNote, LoadingRow, useUi, type Ui } from "../bits";
import { useWorkbench } from "../context";
import { relTime, type Agent, type ChatMessage, type ChatSession } from "../model";

export function ChatPage({ sessionId, agentId }: { sessionId?: string; agentId?: string }) {
  const ctx = useWorkbench();
  const { theme, compact, api, workspaceId, toast, invalidate, bump, navigate } = ctx;
  const ui = useUi(theme, compact);
  const key = `${workspaceId}:${bump}`;

  const [activeId, setActiveId] = useState<string | null>(sessionId ?? null);
  const [showList, setShowList] = useState(compact);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [creating, setCreating] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const sessionsQuery = useQuery(
    api,
    "/api/chat/sessions",
    { query: { limit: 60 }, select: (data) => asList<ChatSession>(data, "sessions") },
    key,
  );
  const agentsQuery = useQuery(
    api,
    "/api/agents",
    { query: { limit: 100 }, select: (data) => asList<Agent>(data, "agents") },
    key,
  );
  const agents = agentsQuery.data ?? [];
  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const agent of agents) map.set(agent.id, agent);
    return map;
  }, [agents]);

  const sessions = useMemo(
    () =>
      [...(sessionsQuery.data ?? [])]
        .filter((session) => session.status !== "archived" || session.id === activeId)
        .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || b.updated_at.localeCompare(a.updated_at)),
    [sessionsQuery.data, activeId],
  );

  useEffect(() => {
    if (sessionId) {
      setActiveId(sessionId);
      setShowList(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (!activeId && sessions.length > 0 && !compact) setActiveId(sessions[0]!.id);
  }, [activeId, sessions, compact]);

  // `agentId` arrives from the team screen; create a fresh chat for it once.
  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    setCreating(true);
    void (async () => {
      const result = await api({ method: "POST", path: "/api/chat/sessions", body: { agent_id: agentId } });
      if (cancelled) return;
      setCreating(false);
      if (result.ok) {
        const created = result.data as { id?: string } | null;
        const id = created?.id;
        if (id) {
          setActiveId(id);
          setShowList(false);
          navigate("chat", { sessionId: id });
          sessionsQuery.refresh();
          invalidate();
        }
      } else toast.error(result.error ?? "创建对话失败");
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const active = sessions.find((session) => session.id === activeId) ?? null;
  const messagesQuery = useQuery(
    api,
    activeId ? `/api/chat/sessions/${activeId}/messages` : null,
    { pollMs: activeId ? 4000 : undefined, select: (data) => asList<ChatMessage>(data, "messages") },
    `${key}:${activeId ?? ""}`,
  );
  const messages = messagesQuery.data ?? [];

  useEffect(() => {
    if (!activeId) return;
    void api({ method: "POST", path: `/api/chat/sessions/${activeId}/read` });
  }, [activeId, api]);

  const select = (id: string) => {
    setActiveId(id);
    setShowList(compact);
    navigate("chat", { sessionId: id });
  };

  const send = async () => {
    if (!activeId || !draft.trim() || sending) return;
    const content = draft.trim();
    setSending(true);
    setDraft("");
    const result = await api({
      method: "POST",
      path: `/api/chat/sessions/${activeId}/messages`,
      body: { content },
    });
    setSending(false);
    if (result.ok) {
      messagesQuery.refresh();
      sessionsQuery.refresh();
      invalidate();
    } else {
      setDraft(content);
      toast.error(result.error ?? "发送失败");
    }
  };

  const mutateSession = async (method: "PATCH" | "DELETE", path: string, body?: unknown, done?: string) => {
    if (!active) return;
    setBusy(true);
    const result = await api({ method, path, body });
    setBusy(false);
    if (result.ok) {
      if (done) toast.show(done, { variant: "success" });
      sessionsQuery.refresh();
      invalidate();
    } else toast.error(result.error ?? "操作失败");
  };

  const createChat = async (agent: Agent) => {
    setPickerOpen(false);
    setCreating(true);
    const result = await api({ method: "POST", path: "/api/chat/sessions", body: { agent_id: agent.id } });
    setCreating(false);
    if (result.ok) {
      const created = result.data as { id?: string } | null;
      if (created?.id) select(created.id);
      sessionsQuery.refresh();
      invalidate();
    } else toast.error(result.error ?? "创建对话失败");
  };

  const list = (
    <View style={{ flex: 1, minWidth: 0, borderRightWidth: compact ? 0 : 1, borderRightColor: ui.c.border }}>
      <View style={[ui.s.row, { padding: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: ui.c.border }]}>
        <Text style={[ui.s.h3, ui.s.grow]}>对话</Text>
        <Btn ui={ui} label="新对话" icon="Plus" tone="primary" busy={creating} onPress={() => setPickerOpen(true)} />
      </View>
      <ScrollView contentContainerStyle={{ paddingVertical: 6 }}>
        {sessionsQuery.loading && sessions.length === 0 ? (
          <LoadingRow ui={ui} />
        ) : sessions.length === 0 ? (
          <Empty
            ui={ui}
            icon="MessagesSquare"
            title="还没有对话"
            description="选择一个智能体，开始你的第一段对话。"
            action={<Btn ui={ui} label="新对话" icon="Plus" tone="primary" onPress={() => setPickerOpen(true)} />}
          />
        ) : (
          sessions.map((session) => {
            const agent = agentMap.get(session.agent_id);
            const isActive = session.id === activeId;
            return (
              <Pressable
                accessibilityRole="button"
                key={session.id}
                onPress={() => select(session.id)}
                style={({ pressed }) => [
                  ui.s.listRow,
                  isActive && { backgroundColor: ui.c.surface2 },
                  pressed && ui.s.pressed,
                ]}
              >
                <Avatar ui={ui} name={agent?.name ?? "AI"} url={agent?.avatar_url} size={30} />
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={[ui.s.row, { gap: 5 }]}>
                    {session.pinned ? <Icon name="Pin" size={11} color={ui.c.muted} /> : null}
                    <Text numberOfLines={1} style={[ui.s.body, { fontWeight: isActive ? "700" : "600", flex: 1 }]}>
                      {session.title || agent?.name || "未命名对话"}
                    </Text>
                    {session.unread_count ? (
                      <View
                        style={{
                          minWidth: 16,
                          height: 16,
                          paddingHorizontal: 4,
                          borderRadius: 8,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: ui.c.accent,
                        }}
                      >
                        <Text style={{ color: ui.c.accentFg, fontSize: 10, fontWeight: "700" }}>
                          {session.unread_count}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <Text numberOfLines={1} style={ui.s.tiny}>
                    {session.last_message?.content ?? "还没有消息"}
                  </Text>
                </View>
                <Text style={ui.s.tiny}>{relTime(session.updated_at)}</Text>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </View>
  );

  const thread = active ? (
    <View style={{ flex: 1, minWidth: 0 }}>
      <View
        style={[
          ui.s.row,
          { paddingHorizontal: 12, paddingVertical: 9, gap: 8, borderBottomWidth: 1, borderBottomColor: ui.c.border },
        ]}
      >
        {compact ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="返回会话列表"
            onPress={() => setShowList(true)}
            style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
          >
            <Icon name="ChevronLeft" size={17} color={ui.c.muted} />
          </Pressable>
        ) : null}
        <Avatar ui={ui} name={agentMap.get(active.agent_id)?.name ?? "AI"} url={agentMap.get(active.agent_id)?.avatar_url} size={26} />
        <View style={ui.s.grow}>
          <Text numberOfLines={1} style={[ui.s.body, { fontWeight: "700" }]}>
            {active.title || "对话"}
          </Text>
          <Text style={ui.s.tiny}>{agentMap.get(active.agent_id)?.name ?? "智能体"}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            void mutateSession("PATCH", `/api/chat/sessions/${active.id}/pin`, { pinned: !active.pinned })
          }
          style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
        >
          <Icon name="Pin" size={15} color={active.pinned ? ui.c.accent : ui.c.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void mutateSession("PATCH", `/api/chat/sessions/${active.id}/archive`, { archived: true }, "已归档")}
          style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
        >
          <Icon name="Archive" size={15} color={ui.c.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => messagesQuery.refresh()}
          style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
        >
          <Icon name="RefreshCw" size={15} color={ui.c.muted} />
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        contentContainerStyle={{ padding: compact ? 12 : 18, gap: 12 }}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {messagesQuery.loading && messages.length === 0 ? <LoadingRow ui={ui} /> : null}
        {messagesQuery.error ? <ErrorNote ui={ui} message={messagesQuery.error} onRetry={messagesQuery.refresh} /> : null}
        {!messagesQuery.loading && messages.length === 0 ? (
          <View style={{ paddingVertical: 32, alignItems: "center", gap: 6 }}>
            <Icon name="Sparkles" size={22} color={ui.c.accent} />
            <Text style={ui.s.h3}>开始和 {agentMap.get(active.agent_id)?.name ?? "智能体"} 对话</Text>
            <Text style={[ui.s.muted, { textAlign: "center" }]}>
              直接描述你的问题，智能体会给出答复并可以为你创建任务。
            </Text>
          </View>
        ) : null}
        {messages.map((message) => (
          <Bubble key={message.id} ui={ui} message={message} agentName={agentMap.get(active.agent_id)?.name} />
        ))}
      </ScrollView>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: ui.c.border,
          padding: compact ? 10 : 12,
          gap: 8,
          backgroundColor: ui.c.surface1,
        }}
      >
        <View style={[ui.s.rowTop, { gap: 8 }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="输入消息，Enter 发送…"
            placeholderTextColor={ui.c.muted}
            multiline
            onSubmitEditing={() => void send()}
            blurOnSubmit={false}
            style={[ui.s.input, { flex: 1, minHeight: 42, maxHeight: 140, paddingTop: 11 }]}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => void send()}
            disabled={sending || !draft.trim()}
            style={({ pressed }) => [
              {
                width: 42,
                height: 42,
                borderRadius: 10,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: draft.trim() ? ui.c.accent : ui.c.surface2,
              },
              (sending || !draft.trim()) && ui.s.btnDisabled,
              pressed && ui.s.pressed,
            ]}
          >
            <Icon name={sending ? "Loader" : "ArrowUp"} size={18} color={draft.trim() ? ui.c.accentFg : ui.c.muted} />
          </Pressable>
        </View>
        <Text style={ui.s.tiny}>每 4 秒自动刷新 · {busy ? "同步中…" : "已同步"}</Text>
      </View>
    </View>
  ) : (
    <View style={{ flex: 1 }}>
      <Empty
        ui={ui}
        icon="MessagesSquare"
        title="选择一段对话"
        description="左侧列出你的全部对话；也可以新建对话与任意智能体交流。"
      />
    </View>
  );

  return (
    <View style={{ flex: 1, flexDirection: compact && showList ? "column" : "row" }}>
      {compact ? (showList ? list : thread) : (
        <>
          <View style={{ width: 280 }}>{list}</View>
          {thread}
        </>
      )}

      <Modal
        title="选择智能体"
        icon={<Icon name="Bot" size={16} color={ui.c.muted} />}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      >
        <Modal.Content>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 8 }}>
            {agents.length === 0 ? (
              <Empty ui={ui} icon="Bot" title="没有智能体" description="先在团队页创建或启用一个智能体。" />
            ) : (
              agents.map((agent) => (
                <Pressable
                  accessibilityRole="button"
                  key={agent.id}
                  onPress={() => void createChat(agent)}
                  style={({ pressed }) => [
                    {
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 10,
                      padding: 11,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: ui.c.border,
                      backgroundColor: ui.c.surface0,
                    },
                    pressed && ui.s.pressed,
                  ]}
                >
                  <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={30} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[ui.s.body, { fontWeight: "600" }]}>{agent.name}</Text>
                    <Text numberOfLines={1} style={ui.s.tiny}>
                      {agent.model ?? "默认模型"} · {agent.status === "idle" ? "空闲" : agent.status === "working" ? "工作中" : "离线"}
                    </Text>
                  </View>
                  <Dot color={agent.status === "working" ? ui.c.accent : agent.status === "idle" ? ui.c.success : ui.c.muted} />
                </Pressable>
              ))
            )}
          </ScrollView>
        </Modal.Content>
      </Modal>
    </View>
  );
}

function Bubble({ ui, message, agentName }: { ui: Ui; message: ChatMessage; agentName?: string }) {
  const mine = message.role === "user";
  const failed = Boolean(message.failure_reason);
  return (
    <View style={{ alignItems: mine ? "flex-end" : "flex-start", gap: 4 }}>
      <View style={[ui.s.row, { gap: 6 }]}>
        <Text style={ui.s.tiny}>{mine ? "我" : agentName ?? "智能体"}</Text>
        <Text style={ui.s.tiny}>{relTime(message.created_at)}</Text>
        {message.elapsed_ms ? <Text style={ui.s.tiny}>{Math.round(message.elapsed_ms / 1000)}s</Text> : null}
      </View>
      <View
        style={{
          maxWidth: "88%",
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderRadius: 12,
          borderTopRightRadius: mine ? 4 : 12,
          borderTopLeftRadius: mine ? 12 : 4,
          backgroundColor: failed ? `${ui.c.danger}14` : mine ? ui.c.accent : ui.c.surface1,
          borderWidth: mine && !failed ? 0 : 1,
          borderColor: failed ? `${ui.c.danger}55` : ui.c.border,
        }}
      >
        {failed ? (
          <View style={[ui.s.row, { gap: 6, marginBottom: 4 }]}>
            <Icon name="AlertTriangle" size={13} color={ui.c.danger} />
            <Text style={[ui.s.tiny, { color: ui.c.danger }]}>
              {message.failure_reason === "timeout" ? "响应超时" : "执行失败"}
            </Text>
          </View>
        ) : null}
        {mine ? (
          <Text style={{ color: ui.c.accentFg, fontSize: 13.5, lineHeight: 20 }}>{message.content}</Text>
        ) : message.content ? (
          <Markdown>{message.content}</Markdown>
        ) : (
          <Text style={ui.s.muted}>（无回复内容）</Text>
        )}
        {message.failure_reason && message.content ? (
          <Text style={[ui.s.tiny, { color: ui.c.danger, marginTop: 6 }]}>{message.failure_reason}</Text>
        ) : null}
      </View>
    </View>
  );
}
