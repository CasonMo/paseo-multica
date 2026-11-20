import { Icon } from "@getpaseo/plugin/client/ui";
import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { asList, asRecord, useQuery, type ApiFn } from "./api";
import { Avatar, Tag, useUi, type Ui } from "./bits";
import { relTime, type Agent } from "./model";

export interface ActiveTask {
  id: string;
  agent_id: string;
  status: string;
  started_at: string | null;
  kind?: string;
}

export interface WorkingAgent {
  id: string;
  name: string;
  avatar_url: string | null;
  running_task_count: number;
  issue_ids: string[];
}

export interface TaskMessage {
  call_id: string;
  seq: number;
  type: "tool_use" | "tool_result" | (string & {});
  tool: string;
  input?: Record<string, unknown>;
  output?: string;
  created_at: string;
}

const TOOL_ICON: Record<string, string> = {
  Bash: "Terminal",
  Read: "FileText",
  Edit: "Pencil",
  Write: "FilePlus",
  Glob: "Search",
  Grep: "Search",
  Task: "Bot",
  Agent: "Bot",
  WebFetch: "Globe",
  WebSearch: "Globe",
  TodoWrite: "ListChecks",
};

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function stepLabel(message: TaskMessage): { title: string; detail: string } {
  const input = message.input ?? {};
  const description = str(input.description);
  const command = str(input.command);
  const file = str(input.file_path) || str(input.path);
  const pattern = str(input.pattern) || str(input.query) || str(input.url);
  const prompt = str(input.prompt);
  if (description) return { title: description, detail: command || file || pattern || prompt };
  if (command) return { title: command.split("\n")[0].slice(0, 120), detail: command };
  if (file) return { title: file, detail: file };
  if (pattern) return { title: pattern, detail: pattern };
  if (prompt) return { title: prompt.split("\n")[0].slice(0, 120), detail: prompt };
  return { title: message.tool, detail: "" };
}

/** 工作区里正在跑任务的智能体 → issue 映射，供看板/列表打运行中标记。 */
export function useWorkingAgents(api: ApiFn, key: string): Map<string, WorkingAgent> {
  const query = useQuery(api, "/api/working-agents", { pollMs: 10000, select: (data) => asList<WorkingAgent>(data, "agents", "working_agents") }, key);
  return useMemo(() => {
    const map = new Map<string, WorkingAgent>();
    for (const agent of query.data ?? []) {
      for (const issueId of agent.issue_ids ?? []) map.set(issueId, agent);
    }
    return map;
  }, [query.data]);
}

export function RunningChip({ ui, agent, compact }: { ui: Ui; agent: { name: string; avatar_url?: string | null }; compact?: boolean }) {
  return (
    <View
      style={[
        ui.s.row,
        {
          gap: 6,
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 999,
          backgroundColor: `${ui.c.success}1a`,
          borderWidth: 1,
          borderColor: `${ui.c.success}55`,
        },
      ]}
    >
      <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={16} />
      <Text numberOfLines={1} style={{ fontSize: 12, fontWeight: "500", color: ui.c.success, maxWidth: compact ? 90 : 160 }}>
        {agent.name} 在工作
      </Text>
      <ActivityIndicator size="small" color={ui.c.success} />
    </View>
  );
}

/** 任务执行步骤 / 日志：tool_use 与 tool_result 按 call_id 配对，可展开看完整命令与输出。 */
export function ExecutionSteps({
  ui,
  api,
  issueId,
  assigneeType,
  assigneeId,
  agents,
  cacheKey,
}: {
  ui: Ui;
  api: ApiFn;
  issueId: string;
  assigneeType?: string | null;
  assigneeId?: string | null;
  agents: Agent[];
  cacheKey: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const [openCall, setOpenCall] = useState<string | null>(null);

  const activeQuery = useQuery(
    api,
    issueId ? `/api/issues/${issueId}/active-task` : null,
    { pollMs: 5000, select: (data) => asList<ActiveTask>(data, "tasks") },
    cacheKey,
  );
  const active = (activeQuery.data ?? []).find((task) => task.status === "running") ?? (activeQuery.data ?? [])[0] ?? null;

  const agentTasksQuery = useQuery(
    api,
    !active && assigneeType === "agent" && assigneeId ? `/api/agents/${assigneeId}/tasks` : null,
    { select: (data) => asList<ActiveTask & { issue_id?: string; created_at?: string }>(data, "tasks") },
    cacheKey,
  );
  const fallback = useMemo(() => {
    const list = (agentTasksQuery.data ?? []).filter((task) => task.issue_id === issueId);
    return list.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0] ?? null;
  }, [agentTasksQuery.data, issueId]);

  const task = active ?? fallback;
  const running = active?.status === "running";
  const messagesQuery = useQuery(
    api,
    task ? `/api/tasks/${task.id}/messages` : null,
    { pollMs: running ? 4000 : undefined, select: (data) => asList<TaskMessage>(data, "messages") },
    `${cacheKey}:${task?.id ?? ""}`,
  );

  const steps = useMemo(() => {
    const messages = messagesQuery.data ?? [];
    const results = new Map<string, TaskMessage>();
    for (const message of messages) if (message.type === "tool_result") results.set(message.call_id, message);
    return messages
      .filter((message) => message.type === "tool_use")
      .sort((a, b) => a.seq - b.seq)
      .map((message) => ({ message, result: results.get(message.call_id) ?? null }));
  }, [messagesQuery.data]);

  if (!task) return null;
  const agent = agents.find((item) => item.id === task.agent_id);
  const visible = showAll ? steps : steps.slice(-8);
  const hidden = steps.length - visible.length;

  return (
    <View style={{ gap: 8 }}>
      <View style={[ui.s.row, { gap: 8 }]}>
        <Icon name="Activity" size={14} color={running ? ui.c.success : ui.c.muted} />
        <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: ui.c.fg }}>执行步骤</Text>
        {running ? (
          <View style={[ui.s.row, { gap: 5 }]}>
            <ActivityIndicator size="small" color={ui.c.success} />
            <Text style={{ fontSize: 12, color: ui.c.success }}>运行中 · {steps.length} 步</Text>
          </View>
        ) : (
          <Text style={ui.s.tiny}>{steps.length} 步 · {relTime(task.started_at)}</Text>
        )}
      </View>

      <View style={[ui.s.panel, { borderRadius: 8 }]}>
        {messagesQuery.loading && steps.length === 0 ? (
          <View style={[ui.s.row, { gap: 8, padding: 14, justifyContent: "center" }]}>
            <ActivityIndicator size="small" color={ui.c.muted} />
            <Text style={ui.s.muted}>读取执行步骤…</Text>
          </View>
        ) : steps.length === 0 ? (
          <Text style={[ui.s.tiny, { padding: 14 }]}>该任务还没有工具调用记录。</Text>
        ) : (
          <>
            {hidden > 0 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`显示前面的 ${hidden} 个步骤`}
                onPress={() => setShowAll(true)}
                style={({ pressed }) => [
                  ui.s.row,
                  { gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: `${ui.c.line}80` },
                  pressed && ui.s.pressed,
                ]}
              >
                <Icon name="ChevronDown" size={13} color={ui.c.muted} />
                <Text style={{ fontSize: 12, color: ui.c.muted }}>显示前面的 {hidden} 个步骤</Text>
              </Pressable>
            ) : null}
            {visible.map(({ message, result }, index) => {
              const { title, detail } = stepLabel(message);
              const open = openCall === message.call_id;
              const output = str(result?.output);
              return (
                <View key={message.call_id}>
                  {index > 0 || hidden > 0 ? <View style={{ height: 1, backgroundColor: `${ui.c.line}80` }} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`步骤 ${message.seq}：${title}`}
                    accessibilityState={{ expanded: open }}
                    onPress={() => setOpenCall(open ? null : message.call_id)}
                    style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                      ui.s.row,
                      { gap: 8, paddingHorizontal: 12, paddingVertical: 8 },
                      hovered && { backgroundColor: ui.c.fillHover },
                      pressed && ui.s.pressed,
                    ]}
                  >
                    <Icon name={TOOL_ICON[message.tool] ?? "Wrench"} size={13} color={ui.c.muted} />
                    <Text numberOfLines={open ? undefined : 1} style={{ flex: 1, fontSize: 12.5, lineHeight: 18, color: ui.c.fg }}>
                      {title}
                    </Text>
                    <Tag ui={ui} label={message.tool} tone="muted" />
                    <Icon name={open ? "ChevronUp" : "ChevronRight"} size={13} color={ui.c.faint} />
                  </Pressable>
                  {open ? (
                    <View style={{ paddingHorizontal: 12, paddingBottom: 10, gap: 6 }}>
                      {detail ? (
                        <ScrollView style={{ maxHeight: 160 }} nestedScrollEnabled>
                          <Text selectable style={[ui.s.code, { fontSize: 11 }]}>{detail}</Text>
                        </ScrollView>
                      ) : null}
                      {output ? (
                        <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                          <Text selectable style={[ui.s.code, { fontSize: 11, backgroundColor: ui.c.fill }]}>{output.slice(0, 6000)}</Text>
                        </ScrollView>
                      ) : (
                        <Text style={ui.s.tiny}>{result ? "（无输出）" : "等待输出…"}</Text>
                      )}
                      <Text style={ui.s.tiny}>#{message.seq} · {relTime(message.created_at)}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
            {showAll && steps.length > 8 ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="收起步骤"
                onPress={() => setShowAll(false)}
                style={({ pressed }) => [
                  ui.s.row,
                  { gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderTopWidth: 1, borderTopColor: `${ui.c.line}80` },
                  pressed && ui.s.pressed,
                ]}
              >
                <Icon name="ChevronUp" size={13} color={ui.c.muted} />
                <Text style={{ fontSize: 12, color: ui.c.muted }}>收起，只看最近 8 步</Text>
              </Pressable>
            ) : null}
          </>
        )}
      </View>
      {agent ? (
        <Text style={ui.s.tiny}>执行者：{agent.name}{running ? " · 每 4 秒自动刷新" : ""}</Text>
      ) : null}
    </View>
  );
}