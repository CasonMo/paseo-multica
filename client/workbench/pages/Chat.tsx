import { t } from "../i18n";
import { Icon, Markdown, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, type TextStyle } from "react-native";
import { asList, useQuery } from "../api";
import { Avatar, Btn, Empty, ErrorNote, LoadingRow, enterToSend, useUi, type Ui , Select } from "../bits";
import { TaskStepsBlock } from "../Execution";
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
  const [pickAgentId, setPickAgentId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sentAt, setSentAt] = useState<number | null>(null);
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
    { query: { limit: 50 }, select: (data) => asList<Agent>(data, "agents") },
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
      } else toast.error(result.error ?? t("Chat.1"));
    })();
    return () => {
      cancelled = true;
    };
     
  }, [agentId]);

  const active = sessions.find((session) => session.id === activeId) ?? null;
  const messagesQuery = useQuery(
    api,
    activeId ? `/api/chat/sessions/${activeId}/messages` : null,
    { pollMs: activeId ? 4000 : undefined, select: (data) => asList<ChatMessage>(data, "messages") },
    `${key}:${activeId ?? ""}`,
  );
  const messages = messagesQuery.data ?? [];
  const pendingQuery = useQuery(
    api,
    activeId ? "/api/chat/pending-tasks" : null,
    {
      query: { session_id: activeId ?? "" },
      pollMs: 4000,
      select: (data) => asList<{ id: string; status?: string; started_at?: string | null }>(data, "tasks"),
    },
    `${key}:pending:${activeId ?? ""}`,
  );
  const runningTask = (pendingQuery.data ?? []).find((task) => task.status === "running") ?? (pendingQuery.data ?? [])[0] ?? null;

  useEffect(() => {
    if (!activeId) return;
    setSentAt(null);
    void api({ method: "POST", path: `/api/chat/sessions/${activeId}/read` });
  }, [activeId, api]);

  // 服务端未产生任务（如智能体离线）时不让占位行永久停留
  useEffect(() => {
    if (sentAt == null || runningTask) return;
    const timer = setTimeout(() => setSentAt(null), 45000);
    return () => clearTimeout(timer);
  }, [sentAt, runningTask]);

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
      // 乐观挂运行行：不等 task_id 关联，发送后立即显示「正在思考中」
      setSentAt(Date.now());
      messagesQuery.refresh();
      pendingQuery.refresh();
      sessionsQuery.refresh();
      invalidate();
    } else {
      setDraft(content);
      toast.error(result.error ?? t("Chat.2"));
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
    } else toast.error(result.error ?? t("Automation.13"));
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
    } else toast.error(result.error ?? t("Chat.1"));
  };

  const list = (
    <View style={{ flex: 1, minWidth: 0, borderRightWidth: compact ? 0 : 1, borderRightColor: ui.c.border }}>
      <View style={[ui.s.row, { padding: 10, gap: 8, borderBottomWidth: 1, borderBottomColor: ui.c.border }]}>
        <Text style={[ui.s.h3, ui.s.grow]}>{t("Chat.5")}</Text>
        <Btn ui={ui} label={t("Chat.6")} icon="Plus" tone="primary" busy={creating} onPress={() => setPickerOpen(true)} />
      </View>
      <ScrollView contentContainerStyle={{ paddingVertical: 6 }}>
        {sessionsQuery.loading && sessions.length === 0 ? (
          <LoadingRow ui={ui} />
        ) : sessions.length === 0 ? (
          <Empty
            ui={ui}
            icon="MessagesSquare"
            title={t("Chat.7")}
            description={t("Chat.8")}
            action={<Btn ui={ui} label={t("Chat.6")} icon="Plus" tone="primary" onPress={() => setPickerOpen(true)} />}
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
                      {session.title || agent?.name || t("Chat.10")}
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
                  <Text numberOfLines={1} style={[ui.s.tiny, isActive && runningTask ? { color: ui.c.brand } : null]}>
                    {isActive && runningTask ? t("Chat.38") : (session.last_message?.content ?? t("Chat.11"))}
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
            accessibilityLabel={t("Chat.12")}
            onPress={() => setShowList(true)}
            style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
          >
            <Icon name="ChevronLeft" size={17} color={ui.c.muted} />
          </Pressable>
        ) : null}
        <Avatar ui={ui} name={agentMap.get(active.agent_id)?.name ?? "AI"} url={agentMap.get(active.agent_id)?.avatar_url} size={26} />
        <View style={ui.s.grow}>
          <Text numberOfLines={1} style={[ui.s.body, { fontWeight: "700" }]}>
            {active.title || t("Chat.5")}
          </Text>
          <Text style={ui.s.tiny}>{agentMap.get(active.agent_id)?.name ?? t("AgentDetail.23")}</Text>
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
          onPress={() => void mutateSession("PATCH", `/api/chat/sessions/${active.id}/archive`, { archived: true }, t("AgentDetail.28"))}
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
            <Text style={ui.s.h3}>{t("Chat.16")} {agentMap.get(active.agent_id)?.name ?? t("AgentDetail.23")} {t("Chat.5")}</Text>
            <Text style={[ui.s.muted, { textAlign: "center" }]}>
              {t("Chat.19")}
            </Text>
          </View>
        ) : null}
        {messages.map((message, index) => {
          const isLast = index === messages.length - 1;
          const pending =
            isLast && message.role === "user" && (runningTask || sentAt != null)
              ? {
                  taskId: runningTask?.id ?? null,
                  startedAt: runningTask?.started_at ?? (sentAt != null ? new Date(sentAt).toISOString() : null),
                }
              : null;
          return (
            <Bubble
              key={message.id}
              ui={ui}
              message={message}
              agentName={agentMap.get(active.agent_id)?.name}
              runningTask={runningTask}
              pending={pending}
              onQuickAction={(text) => setDraft(text)}
            />
          );
        })}
      </ScrollView>

      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: ui.c.border,
          padding: compact ? 10 : 12,
          gap: 8,
          backgroundColor: ui.c.surface2,
        }}
      >
        <View style={[ui.s.rowTop, { gap: 8 }]}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder={t("Chat.20")}
            placeholderTextColor={ui.c.muted}
            multiline
            blurOnSubmit={false}
            {...enterToSend(() => void send())}
            style={[
              ui.s.input,
              { flex: 1, minHeight: 42, maxHeight: 140, paddingTop: 11, backgroundColor: ui.c.surface0 },
            ]}
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
        <Text style={ui.s.tiny}>{t("Chat.21")} {busy ? t("Chat.22") : t("Chat.23")}</Text>
      </View>
    </View>
  ) : (
    <View style={{ flex: 1 }}>
      <Empty
        ui={ui}
        icon="MessagesSquare"
        title={t("Chat.24")}
        description={t("Chat.25")}
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
        title={t("Chat.26")}
        icon={<Icon name="Bot" size={16} color={ui.c.muted} />}
        open={pickerOpen}
        onOpenChange={(next) => {
          setPickerOpen(next);
          if (next) setPickAgentId(null);
        }}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            {agents.length === 0 ? (
              <Empty ui={ui} icon="Bot" title={t("Chat.27")} description={t("Chat.28")} />
            ) : (
              <>
                <Select
                  ui={ui}
                  value={pickAgentId}
                  placeholder={t("Chat.26")}
                  onChange={setPickAgentId}
                  options={agents.map((agent) => ({ value: agent.id, label: agent.name, icon: "Bot" }))}
                />
                <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8 }]}>
                  <Btn ui={ui} label={t("AgentDetail.40")} onPress={() => setPickerOpen(false)} />
                  <Btn
                    ui={ui}
                    label={t("Chat.6")}
                    icon="Plus"
                    tone="primary"
                    disabled={!pickAgentId}
                    onPress={() => {
                      const agent = agents.find((item) => item.id === pickAgentId);
                      if (agent) {
                        setPickerOpen(false);
                        void createChat(agent);
                      }
                    }}
                  />
                </View>
              </>
            )}
          </View>
        </Modal.Content>
      </Modal>
    </View>
  );
}

function Bubble({
  ui,
  message,
  agentName,
  runningTask,
  pending,
  onQuickAction,
}: {
  ui: Ui;
  message: ChatMessage;
  agentName?: string;
  runningTask?: { id: string; started_at?: string | null } | null;
  pending?: { taskId: string | null; startedAt: string | null } | null;
  onQuickAction?(text: string): void;
}) {
  const mine = message.role === "user";
  const failed = Boolean(message.failure_reason);
  const turnRunning = Boolean(mine && runningTask && runningTask.id === message.task_id);
  const quickActions = Array.isArray(message.quick_actions) ? message.quick_actions : [];
  return (
    <View style={{ alignItems: mine ? "flex-end" : "flex-start", gap: 4 }}>
      <View style={[ui.s.row, { gap: 6 }]}>
        <Text style={ui.s.tiny}>{mine ? t("Chat.33") : agentName ?? t("AgentDetail.23")}</Text>
        <Text style={ui.s.tiny}>{relTime(message.created_at)}</Text>
        {message.elapsed_ms ? <Text style={ui.s.tiny}>{Math.round(message.elapsed_ms / 1000)}s</Text> : null}
      </View>
      <View
        style={{
          maxWidth: "88%",
          minWidth: 0,
          paddingHorizontal: 12,
          paddingVertical: 9,
          borderRadius: 12,
          borderTopRightRadius: mine ? 4 : 12,
          borderTopLeftRadius: mine ? 12 : 4,
          backgroundColor: failed ? `${ui.c.danger}14` : mine ? ui.c.accent : ui.c.surface2,
          borderWidth: mine && !failed ? 0 : 1,
          borderColor: failed ? `${ui.c.danger}55` : ui.c.border,
        }}
      >
        {failed ? (
          <View style={[ui.s.row, { gap: 6, marginBottom: 4 }]}>
            <Icon name="AlertTriangle" size={13} color={ui.c.danger} />
            <Text style={[ui.s.tiny, { color: ui.c.danger }]}>
              {message.failure_reason === "timeout" ? t("Chat.35") : t("Chat.36")}
            </Text>
          </View>
        ) : null}
        {mine ? (
          <Text style={{ color: ui.c.accentFg, fontSize: 14, lineHeight: 21, overflowWrap: "anywhere" } as TextStyle}>{message.content}</Text>
        ) : message.content ? (
          <Markdown>{message.content}</Markdown>
        ) : (
          <Text style={ui.s.muted}>{t("Chat.37")}</Text>
        )}
        {message.failure_reason && message.content ? (
          <Text style={[ui.s.tiny, { color: ui.c.danger, marginTop: 6 }]}>{message.failure_reason}</Text>
        ) : null}
      </View>
      {message.task_id && (!mine || turnRunning) ? (
        <View style={{ alignSelf: "stretch", maxWidth: "88%" }}>
          <TaskStepsBlock
            ui={ui}
            taskId={message.task_id}
            running={turnRunning}
            startedAt={runningTask?.started_at ?? message.created_at}
            elapsedMs={mine ? null : message.elapsed_ms}
          />
          {!mine && quickActions.length > 0 ? (
            <View style={[ui.s.row, { gap: 6, flexWrap: "wrap", marginTop: 6, alignItems: "center" }]}>
              <Text style={ui.s.tiny}>{t("Chat.42")}</Text>
              {quickActions.map((action, i) => {
                const text =
                  typeof action === "string"
                    ? action
                    : String((action as Record<string, unknown>).text ?? (action as Record<string, unknown>).label ?? (action as Record<string, unknown>).title ?? "");
                if (!text) return null;
                return <Btn key={i} ui={ui} label={text.slice(0, 40)} onPress={() => onQuickAction?.(text)} />;
              })}
            </View>
          ) : null}
        </View>
      ) : pending ? (
        <View style={{ alignSelf: "stretch", maxWidth: "88%" }}>
          <TaskStepsBlock ui={ui} taskId={pending.taskId} running startedAt={pending.startedAt} elapsedMs={null} />
        </View>
      ) : null}
    </View>
  );
}
