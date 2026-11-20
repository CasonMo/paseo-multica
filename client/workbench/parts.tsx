import { t } from "./i18n";
import { Icon } from "@getpaseo/plugin/client/ui";
import type { ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { Ui } from "./bits";
import { Avatar, Dot, Tag } from "./bits";
import {
  issueStatusColor,
  issueStatusIcon,
  issueStatusLabel,
  priorityMeta,
  relTime,
  type Agent,
  type InboxItem,
  type Issue,
  type IssueStatusEntry,
} from "./model";

export function StatusMark({
  ui,
  issue,
  statuses,
}: {
  ui: Ui;
  issue: Issue;
  statuses: IssueStatusEntry[];
}) {
  return (
    <View style={[ui.s.row, { gap: 5 }]}>
      <Icon name={issueStatusIcon(issue, statuses)} size={14} color={issueStatusColor(issue, statuses)} />
      <Text numberOfLines={1} style={{ fontSize: 13, color: ui.c.fg }}>
        {issueStatusLabel(issue, statuses)}
      </Text>
    </View>
  );
}

export function PriorityMark({ ui, priority }: { ui: Ui; priority?: string | null }) {
  const meta = priorityMeta(priority);
  if (!priority || priority === "none") return null;
  const color =
    meta.tone === "danger"
      ? ui.c.danger
      : meta.tone === "warning"
        ? ui.c.high
        : meta.tone === "accent"
          ? ui.c.brand
          : ui.c.muted;
  return (
    <View style={[ui.s.row, { gap: 4 }]}>
      <Icon name={meta.icon} size={14} color={color} />
      <Text style={{ fontSize: 12, color: ui.c.muted }}>{meta.label}</Text>
    </View>
  );
}

export function IssueRow({
  ui,
  issue,
  statuses,
  onPress,
  subtitle,
  running,
}: {
  ui: Ui;
  issue: Issue;
  statuses: IssueStatusEntry[];
  onPress(): void;
  subtitle?: string;
  running?: { name: string; avatar_url?: string | null };
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${issue.identifier} ${issue.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        ui.s.row,
        { gap: 8, height: 36, paddingHorizontal: 8, borderRadius: 6 },
        pressed && ui.s.pressed,
      ]}
    >
      <Icon name={issueStatusIcon(issue, statuses)} size={14} color={issueStatusColor(issue, statuses)} />
      <Text numberOfLines={1} style={[ui.s.idText, { minWidth: 68 }]}>
        {issue.identifier}
      </Text>
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: ui.c.fg }}>
        {issue.title}
      </Text>
      {running ? (
        <View style={[ui.s.row, { gap: 4 }]}>
          <ActivityIndicator size="small" color={ui.c.success} />
          <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: "500", color: ui.c.success, maxWidth: 90 }}>
            {running.name}
          </Text>
        </View>
      ) : null}
      {subtitle ? (
        <Text numberOfLines={1} style={[ui.s.tiny, { maxWidth: 160 }]}>
          {subtitle}
        </Text>
      ) : null}
      <PriorityMark ui={ui} priority={issue.priority} />
      {issue.due_date ? <Text style={ui.s.tiny}>{t("IssueDetail.45")} {issue.due_date}</Text> : null}
      <Text style={[ui.s.tiny, { minWidth: 56, textAlign: "right" }]}>{relTime(issue.updated_at)}</Text>
    </Pressable>
  );
}

const INBOX_META: Record<string, { label: string; icon: string }> = {
  issue_created: { label: t("parts.2"), icon: "FilePlus" },
  issue_status_changed: { label: t("SettingsSections.94"), icon: "RefreshCw" },
  status_changed: { label: t("SettingsSections.94"), icon: "RefreshCw" },
  issue_assigned: { label: t("parts.5"), icon: "UserCheck" },
  assignee_changed: { label: t("parts.6"), icon: "UserCheck" },
  unassigned: { label: t("IssueDetail.100"), icon: "UserMinus" },
  issue_comment: { label: t("parts.8"), icon: "MessageSquare" },
  comment: { label: t("parts.8"), icon: "MessageSquare" },
  new_comment: { label: t("parts.8"), icon: "MessageSquare" },
  agent_started: { label: t("parts.11"), icon: "Bot" },
  agent_completed: { label: t("parts.12"), icon: "Bot" },
  agent_failed: { label: t("parts.13"), icon: "TriangleAlert" },
  task_failed: { label: t("parts.14"), icon: "TriangleAlert" },
  quick_create_done: { label: t("parts.15"), icon: "Sparkles" },
  mention: { label: t("parts.16"), icon: "AtSign" },
  workflow: { label: t("Nav.7"), icon: "Workflow" },
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
          {item.issue_identifier ? <Text style={ui.s.idText}>{item.issue_identifier}</Text> : null}
          <Text style={ui.s.tiny}>{relTime(item.created_at)}</Text>
        </View>
      </View>
      <View style={[ui.s.row, { gap: 2 }]}>
        {extra}
        {!item.read && onRead ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("IssueDetail.85")}
            onPress={onRead}
            style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
          >
            <Icon name="Check" size={14} color={ui.c.muted} />
          </Pressable>
        ) : null}
        {onArchive ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("Inbox.32")}
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
      accessibilityLabel={t("Nav.17", { a: agent.name, b: agent.status ?? t("parts.21") })}
      onPress={onPress}
      style={({ pressed }) => [ui.s.listRow, pressed && ui.s.pressed]}
    >
      <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={32} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text numberOfLines={1} style={[ui.s.body, { fontWeight: "600" }]}>
          {agent.name}
        </Text>
        <Text numberOfLines={1} style={ui.s.tiny}>
          {agent.model ? agent.model : t("AgentDetail.24")}
          {runtimeLabel ? ` · ${runtimeLabel}` : ""}
        </Text>
      </View>
      {agent.archived_at ? (
        <Tag ui={ui} label={t("AgentDetail.28")} tone="muted" />
      ) : (
        <View style={[ui.s.row, { gap: 5 }]}>
          <Dot color={tone} />
          <Text style={[ui.s.tiny, { color: tone }]}>
            {agent.status === "working"
              ? t("model.22")
              : agent.status === "blocked"
                ? t("model.23")
                : agent.status === "error"
                  ? t("model.24")
                  : agent.status === "idle"
                    ? t("model.21")
                    : t("RuntimeDetail.4")}
          </Text>
        </View>
      )}
      <Icon name="ChevronRight" size={15} color={ui.c.muted} />
    </Pressable>
  );
}
