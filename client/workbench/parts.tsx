import { Icon } from "@getpaseo/plugin/client/ui";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import type { Ui } from "./bits";
import { Avatar, Dot, Tag } from "./bits";
import {
  issueCategory,
  issueStatusColor,
  issueStatusLabel,
  priorityMeta,
  relTime,
  type Agent,
  type InboxItem,
  type Issue,
  type IssueStatusEntry,
} from "./model";

export function StatusPill({
  ui,
  issue,
  statuses,
}: {
  ui: Ui;
  issue: Issue;
  statuses: IssueStatusEntry[];
}) {
  const color = issueStatusColor(issue, statuses);
  return <Tag ui={ui} label={issueStatusLabel(issue, statuses)} color={color} />;
}

export function PriorityTag({ ui, priority }: { ui: Ui; priority?: string | null }) {
  const meta = priorityMeta(priority);
  if (!priority || priority === "none") return null;
  return <Tag ui={ui} label={meta.label} tone={meta.tone} icon={meta.icon} />;
}

export function IssueRow({
  ui,
  issue,
  statuses,
  onPress,
  subtitle,
}: {
  ui: Ui;
  issue: Issue;
  statuses: IssueStatusEntry[];
  onPress(): void;
  subtitle?: string;
}) {
  const category = issueCategory(issue, statuses);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${issue.identifier} ${issue.title}`}
      onPress={onPress}
      style={({ pressed }) => [ui.s.listRow, { alignItems: "flex-start" }, pressed && ui.s.pressed]}
    >
      <View style={{ marginTop: 4 }}>
        <Dot color={issueStatusColor(issue, statuses)} size={8} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <Text numberOfLines={2} style={[ui.s.body, { fontWeight: "600" }]}>
          {issue.title}
        </Text>
        <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
          <Text style={[ui.s.tiny, { fontFamily: "Menlo" }]}>{issue.identifier}</Text>
          <Text style={ui.s.tiny}>· {issueStatusLabel(issue, statuses)}</Text>
          {issue.due_date ? <Text style={ui.s.tiny}>· 截止 {issue.due_date}</Text> : null}
          {subtitle ? <Text style={ui.s.tiny}>· {subtitle}</Text> : null}
          <Text style={ui.s.tiny}>· {relTime(issue.updated_at)}</Text>
        </View>
      </View>
      <View style={[ui.s.row, { gap: 6, marginTop: 2 }]}>
        <PriorityTag ui={ui} priority={issue.priority} />
        {category === "done" ? <Icon name="CheckCheck" size={14} color={ui.c.success} /> : null}
      </View>
    </Pressable>
  );
}

const INBOX_META: Record<string, { label: string; icon: string }> = {
  issue_created: { label: "新需求", icon: "FilePlus" },
  issue_status_changed: { label: "状态变更", icon: "RefreshCw" },
  status_changed: { label: "状态变更", icon: "RefreshCw" },
  issue_assigned: { label: "指派给你", icon: "UserCheck" },
  assignee_changed: { label: "负责人变更", icon: "UserCheck" },
  unassigned: { label: "取消指派", icon: "UserMinus" },
  issue_comment: { label: "新评论", icon: "MessageSquare" },
  comment: { label: "新评论", icon: "MessageSquare" },
  new_comment: { label: "新评论", icon: "MessageSquare" },
  agent_started: { label: "智能体开始", icon: "Bot" },
  agent_completed: { label: "智能体完成", icon: "Bot" },
  agent_failed: { label: "智能体失败", icon: "TriangleAlert" },
  task_failed: { label: "任务失败", icon: "TriangleAlert" },
  quick_create_done: { label: "快速创建完成", icon: "Sparkles" },
  mention: { label: "提到你", icon: "AtSign" },
  workflow: { label: "工作流", icon: "Workflow" },
};

const INBOX_ICON: Record<string, string> = Object.fromEntries(
  Object.entries(INBOX_META).map(([type, meta]) => [type, meta.icon]),
);

function inboxIconFor(type: string): string {
  return INBOX_ICON[type] ?? "Bell";
}

export function InboxRow({
  ui,
  item,
  onPress,
  onRead,
  onArchive,
  extra,
}: {
  ui: Ui;
  item: InboxItem;
  onPress(): void;
  onRead?: () => void;
  onArchive?: () => void;
  extra?: ReactNode;
}) {
  const failed = item.type === "task_failed" || item.type === "agent_failed";
  const tone =
    item.severity === "error" || item.severity === "critical" || failed
      ? ui.c.danger
      : item.severity === "warning"
        ? ui.c.warning
        : ui.c.accent;
  const meta = INBOX_META[item.type];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.title}
      onPress={onPress}
      style={({ pressed }) => [ui.s.listRow, { alignItems: "flex-start" }, pressed && ui.s.pressed]}
    >
      <View
        style={{
          width: 22,
          height: 22,
          borderRadius: 7,
          marginTop: 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: `${tone}1f`,
        }}
      >
        <Icon name={item.read ? "BellOff" : inboxIconFor(item.type)} size={12} color={item.read ? ui.c.muted : tone} />
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        {meta ? (
          <Text style={[ui.s.tiny, { color: tone, fontWeight: "600" }]}>{meta.label}</Text>
        ) : null}
        <Text numberOfLines={2} style={[ui.s.body, { fontWeight: item.read ? "500" : "700" }]}>
          {item.title}
        </Text>
        {item.body ? (
          <Text numberOfLines={2} style={ui.s.muted}>
            {item.body}
          </Text>
        ) : null}
        <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
          {item.issue_identifier ? (
            <Text style={[ui.s.tiny, { fontFamily: "Menlo" }]}>{item.issue_identifier}</Text>
          ) : null}
          <Text style={ui.s.tiny}>{relTime(item.created_at)}</Text>
        </View>
      </View>
      <View style={[ui.s.row, { gap: 2 }]}>
        {extra}
        {!item.read && onRead ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="标记已读"
            onPress={onRead}
            style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
          >
            <Icon name="Check" size={14} color={ui.c.muted} />
          </Pressable>
        ) : null}
        {onArchive ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="归档通知"
            onPress={onArchive}
            style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
          >
            <Icon name="Archive" size={14} color={ui.c.muted} />
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export function AgentRow({
  ui,
  agent,
  runtimeLabel,
  onPress,
}: {
  ui: Ui;
  agent: Agent;
  runtimeLabel?: string;
  onPress(): void;
}) {
  const tone =
    agent.status === "working"
      ? ui.c.accent
      : agent.status === "error" || agent.status === "blocked"
        ? ui.c.danger
        : agent.status === "idle"
          ? ui.c.success
          : ui.c.muted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${agent.name}，${agent.status ?? "未知状态"}`}
      onPress={onPress}
      style={({ pressed }) => [ui.s.listRow, pressed && ui.s.pressed]}
    >
      <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={34} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[ui.s.body, { fontWeight: "600" }]}>
          {agent.name}
        </Text>
        <Text numberOfLines={1} style={ui.s.tiny}>
          {agent.model ? agent.model : "未设置模型"}
          {runtimeLabel ? ` · ${runtimeLabel}` : ""}
        </Text>
      </View>
      {agent.archived_at ? (
        <Tag ui={ui} label="已归档" tone="muted" />
      ) : (
        <View style={[ui.s.row, { gap: 5 }]}>
          <Dot color={tone} />
          <Text style={[ui.s.tiny, { color: tone }]}>
            {agent.status === "working"
              ? "工作中"
              : agent.status === "blocked"
                ? "阻塞"
                : agent.status === "error"
                  ? "异常"
                  : agent.status === "idle"
                    ? "空闲"
                    : "离线"}
          </Text>
        </View>
      )}
      <Icon name="ChevronRight" size={15} color={ui.c.muted} />
    </Pressable>
  );
}
