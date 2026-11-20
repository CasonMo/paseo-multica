import { Icon, Markdown, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { Avatar, Btn, Divider, Empty, ErrorNote, Field, IconBtn, LoadingRow, Tag, useUi, type Ui } from "../bits";
import { asList, asRecord, useQuery } from "../api";
import { refreshInboxBadge } from "../badge";
import { useWorkbench } from "../context";
import {
  fmtDateTime,
  issueStatusColor,
  issueStatusIcon,
  issueStatusLabel,
  pickTextColor,
  priorityMeta,
  relTime,
  type Agent,
  type Comment,
  type Issue,
  type Label,
  type Project,
} from "../model";
import { PriorityMark, StatusMark } from "../parts";
import {
  ActivityList,
  ExecutionLogSection,
  RunLogModal,
  RunningChip,
  RunsModal,
  activitiesByRoot,
  fmtDuration,
  runDurationMs,
  useIssueInsights,
  type ActiveTask,
  type TaskRun,
} from "../Execution";

const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;

export function IssueDetailPage({ issueId }: { issueId: string }) {
  const ctx = useWorkbench();
  const { theme, compact, narrow, stacked, api, statuses, workspaceId, navigate, toast, invalidate, bump } = ctx;
  const ui = useUi(theme, compact);
  const key = `${workspaceId}:${bump}`;
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [mentions, setMentions] = useState<Record<string, { id: string; name: string }[]>>({});
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [mentionFor, setMentionFor] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<null | "status" | "priority">(null);
  const [childOpen, setChildOpen] = useState(false);
  const [childTitle, setChildTitle] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [threadBusy, setThreadBusy] = useState<string | null>(null);
  const scrollRef = useRef<ScrollView | null>(null);
  const metrics = useRef({ y: 0, viewH: 0, contentH: 0 });
  const [scrollState, setScrollState] = useState({ canScroll: false, atBottom: true });
  const [seenCount, setSeenCount] = useState(0);

  const issueQuery = useQuery(api, issueId ? `/api/issues/${issueId}` : null, {}, key);
  const issue = issueQuery.data && typeof issueQuery.data === "object" ? (issueQuery.data as Issue) : null;
  const parentQuery = useQuery(api, issue?.parent_issue_id ? `/api/issues/${issue.parent_issue_id}` : null, {}, `${key}:parent`);
  const parent = parentQuery.data && typeof parentQuery.data === "object" ? (parentQuery.data as Issue) : null;
  const childrenQuery = useQuery(
    api,
    issueId ? `/api/issues/${issueId}/children` : null,
    { select: (data) => asList<Issue>(data, "issues", "children") },
    key,
  );
  const issueLabelsQuery = useQuery(
    api,
    issueId ? `/api/issues/${issueId}/labels` : null,
    { select: (data) => asList<Label>(data, "labels") },
    key,
  );
  const allLabelsQuery = useQuery(
    api,
    labelsOpen ? "/api/labels" : null,
    { select: (data) => asList<Label>(data, "labels") },
    `${key}:labels`,
  );
  const projectsQuery = useQuery(
    api,
    "/api/projects",
    { query: { limit: 100 }, select: (data) => asList<Project>(data, "projects") },
    key,
  );
  const agentsQuery = useQuery(api, "/api/agents", { query: { limit: 100 }, select: (data) => asList<Agent>(data, "agents") }, key);
  const membersQuery = useQuery(
    api,
    workspaceId ? `/api/workspaces/${workspaceId}/members` : null,
    { select: (data) => asList<Record<string, unknown>>(data, "members") },
    key,
  );

  const members = useMemo(
    () =>
      (membersQuery.data ?? []).map((raw) => {
        const user = asRecord(raw.user);
        return {
          id: String(user.id ?? raw.user_id ?? raw.id ?? ""),
          name: String(user.name ?? raw.name ?? ""),
          email: String(user.email ?? ""),
          avatar_url: (user.avatar_url as string | null) ?? null,
          role: String(raw.role ?? ""),
        };
      }),
    [membersQuery.data],
  );
  const agents = agentsQuery.data ?? [];

  const activeTaskQuery = useQuery(
    api,
    issueId ? `/api/issues/${issueId}/active-task` : null,
    { pollMs: 5000, select: (data) => asList<ActiveTask>(data, "tasks") },
    key,
  );
  const activeTask = (activeTaskQuery.data ?? []).find((task) => task.status === "running") ?? null;
  const activeAgent = activeTask ? agents.find((agent) => agent.id === activeTask.agent_id) ?? null : null;

  const insights = useIssueInsights(issueId, bump);
  const runs = insights.runs;
  const [runsOpen, setRunsOpen] = useState(false);
  const [runLogId, setRunLogId] = useState<string | null>(null);
  const [openActivity, setOpenActivity] = useState<Record<string, boolean>>({});

  const assignee = useMemo(() => {
    if (!issue?.assignee_id) return null;
    if (issue.assignee_type === "agent") {
      const agent = agents.find((item) => item.id === issue.assignee_id);
      return { name: agent?.name ?? "智能体", url: agent?.avatar_url ?? null, kind: "智能体" };
    }
    if (issue.assignee_type === "squad") return { name: "小队", url: null, kind: "小队" };
    const member = members.find((item) => item.id === issue.assignee_id);
    return { name: member?.name || "成员", url: member?.avatar_url ?? null, kind: "成员" };
  }, [issue, agents, members]);

  const commentCount = insights.comments.length;

  const applyMetrics = () => {
    const { y, viewH, contentH } = metrics.current;
    const canScroll = contentH > viewH + 24;
    const atBottom = y + viewH >= contentH - 24;
    setScrollState((prev) => (prev.canScroll === canScroll && prev.atBottom === atBottom ? prev : { canScroll, atBottom }));
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    metrics.current = { y: contentOffset.y, viewH: layoutMeasurement.height, contentH: contentSize.height };
    applyMetrics();
  };

  const onContentSizeChange = (_width: number, height: number) => {
    metrics.current.contentH = height;
    applyMetrics();
  };

  const onScrollLayout = (event: { nativeEvent: { layout: { height: number } } }) => {
    metrics.current.viewH = event.nativeEvent.layout.height;
    applyMetrics();
  };

  useEffect(() => {
    if (scrollState.atBottom) setSeenCount(commentCount);
  }, [scrollState.atBottom, commentCount]);

  const newCount = Math.max(0, commentCount - seenCount);

  const jump = () => {
    if (scrollState.atBottom) scrollRef.current?.scrollTo({ y: 0, animated: true });
    else scrollRef.current?.scrollToEnd({ animated: true });
    setSeenCount(commentCount);
  };

  const updateIssue = async (body: Record<string, unknown>, success: string) => {
    if (!issue) return;
    setBusy(true);
    const result = await api({ method: "PUT", path: `/api/issues/${issue.id}`, body });
    setBusy(false);
    if (result.ok) {
      toast.show(success, { variant: "success" });
      issueQuery.refresh();
      invalidate();
    } else toast.error(result.error ?? "更新失败");
  };

  const openEdit = () => {
    if (!issue) return;
    setEditTitle(issue.title ?? "");
    setEditDescription(issue.description ?? "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editTitle.trim()) {
      toast.error("标题不能为空");
      return;
    }
    setEditOpen(false);
    await updateIssue({ title: editTitle.trim(), description: editDescription }, "任务已更新");
  };

  const closeComposer = () => {
    setReplyTo(null);
    setMentionFor(null);
  };

  const sendComment = async (key: string, parentId: string | null) => {
    if (!issue) return;
    const draft = (drafts[key] ?? "").trim();
    if (!draft) return;
    const content = (mentions[key] ?? []).reduce(
      (text, item) => text.split(`@${item.name}`).join(`[@${item.name}](mention://agent/${item.id})`),
      draft,
    );
    setSendingKey(key);
    const body: Record<string, unknown> = { content };
    if (parentId) body.parent_id = parentId;
    const result = await api({ method: "POST", path: `/api/issues/${issue.id}/comments`, body });
    setSendingKey(null);
    if (result.ok) {
      setDrafts((prev) => ({ ...prev, [key]: "" }));
      setMentions((prev) => ({ ...prev, [key]: [] }));
      closeComposer();
      insights.refresh();
      toast.show(parentId ? "回复已发送" : "评论已发送", { variant: "success" });
    } else toast.error(result.error ?? "发送失败");
  };

  const insertMention = (agent: Agent) => {
    const key = mentionFor ?? "root";
    setDrafts((prev) => {
      const current = prev[key] ?? "";
      const sep = current && !current.endsWith(" ") ? " " : "";
      return { ...prev, [key]: `${current}${sep}@${agent.name} ` };
    });
    setMentions((prev) => ({ ...prev, [key]: [...(prev[key] ?? []).filter((item) => item.id !== agent.id), { id: agent.id, name: agent.name }] }));
    setMentionFor(null);
  };

  const toggleResolve = async (item: Comment) => {
    const resolved = Boolean(item.resolved_at);
    setThreadBusy(item.id);
    const result = await api({ method: resolved ? "DELETE" : "POST", path: `/api/comments/${item.id}/resolve` });
    setThreadBusy(null);
    if (result.ok) {
      insights.refresh();
      toast.show(resolved ? "已取消解决" : "已标记解决", { variant: "success" });
    } else toast.error(result.error ?? "操作失败");
  };

  const addChild = async () => {
    if (!issue || !childTitle.trim()) return;
    setBusy(true);
    const body: Record<string, unknown> = { title: childTitle.trim(), parent_issue_id: issue.id };
    if (issue.project_id) body.project_id = issue.project_id;
    const result = await api({ method: "POST", path: "/api/issues", body });
    setBusy(false);
    if (result.ok) {
      setChildTitle("");
      setChildOpen(false);
      childrenQuery.refresh();
      invalidate();
      toast.show("子任务已创建", { variant: "success" });
    } else toast.error(result.error ?? "创建子任务失败");
  };

  const attachLabel = async (label: Label) => {
    if (!issue) return;
    setBusy(true);
    const result = await api({ method: "POST", path: `/api/issues/${issue.id}/labels`, body: { label_id: label.id } });
    setBusy(false);
    if (result.ok) {
      toast.show(`已添加标签 ${label.name}`, { variant: "success" });
      setLabelsOpen(false);
      issueLabelsQuery.refresh();
      invalidate();
    } else toast.error(result.error ?? "添加标签失败");
  };

  const detachLabel = async (label: Label) => {
    if (!issue) return;
    const result = await api({ method: "DELETE", path: `/api/issues/${issue.id}/labels/${label.id}` });
    if (result.ok) {
      toast.show(`已移除标签 ${label.name}`, { variant: "success" });
      issueLabelsQuery.refresh();
      invalidate();
    } else toast.error(result.error ?? "移除标签失败");
  };

  const rerun = async () => {
    if (!issue) return;
    setBusy(true);
    const result = await api({ method: "POST", path: `/api/issues/${issue.id}/rerun` });
    setBusy(false);
    if (result.ok) toast.show("已触发重跑", { variant: "success" });
    else toast.error(result.error ?? "重跑失败");
  };

  const quick = async (action: "read", message: string) => {
    if (!issue) return;
    const result = await api({ method: "POST", path: `/api/issues/${issue.id}/${action}` });
    if (result.ok) {
      toast.show(message, { variant: "success" });
      refreshInboxBadge();
    } else toast.error(result.error ?? "操作失败");
  };

  const removeIssue = async () => {
    if (!issue) return;
    setBusy(true);
    const result = await api({ method: "DELETE", path: `/api/issues/${issue.id}` });
    setBusy(false);
    setConfirmDelete(false);
    if (result.ok) {
      toast.show("任务已删除", { variant: "success" });
      invalidate();
      navigate("issues");
    } else toast.error(result.error ?? "删除失败");
  };

  if (!issueId) {
    return <Empty ui={ui} icon="AlertCircle" title="缺少任务 ID" action={<Btn ui={ui} label="返回列表" onPress={() => navigate("issues")} />} />;
  }

  if (issueQuery.loading && !issue) return <LoadingRow ui={ui} label="读取任务…" />;
  if (issueQuery.error && !issue) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorNote ui={ui} message={issueQuery.error} onRetry={issueQuery.refresh} />
        <View style={{ marginTop: 10 }}>
          <Btn ui={ui} label="返回任务列表" icon="ArrowLeft" onPress={() => navigate("issues")} />
        </View>
      </View>
    );
  }
  if (!issue) return null;

  const comments = insights.comments;
  const commentById = new Map(comments.map((item) => [item.id, item]));
  const roots = comments.filter((item) => !item.parent_id || !commentById.has(item.parent_id));
  const activityMap = activitiesByRoot(insights.timeline, roots);
  const runLogRun = runLogId ? runs.find((run) => run.id === runLogId) ?? null : null;
  const threadOf = (id: string) =>
    comments.filter((item) => {
      let cursor = item.parent_id ?? null;
      const seen = new Set<string>();
      while (cursor && !seen.has(cursor)) {
        if (cursor === id) return true;
        seen.add(cursor);
        cursor = commentById.get(cursor)?.parent_id ?? null;
      }
      return false;
    });
  const children = childrenQuery.data ?? [];
  const issueLabels = issueLabelsQuery.data ?? [];
  const attachedIds = new Set(issueLabels.map((label) => label.id));
  const availableLabels = (allLabelsQuery.data ?? []).filter(
    (label) => (label.resource_type ?? "issue") === "issue" && !attachedIds.has(label.id),
  );
  const project = (projectsQuery.data ?? []).find((item) => item.id === issue.project_id) ?? null;
  const personOf = (type?: string | null, id?: string | null) => {
    if (!id) return null;
    if (type === "agent") {
      const agent = agents.find((item) => item.id === id);
      return { name: agent?.name ?? "智能体", url: agent?.avatar_url ?? null };
    }
    if (type === "squad") return { name: "小队", url: null };
    const member = members.find((item) => item.id === id);
    return { name: member?.name || "成员", url: member?.avatar_url ?? null };
  };
  const openReply = (rootId: string, item: Comment) => {
    setReplyTo(item);
    setCollapsed((prev) => ({ ...prev, [rootId]: false }));
    setMentionFor(null);
  };
  const replyChip = (item: Comment) => (
    <View
      style={[
        ui.s.row,
        {
          gap: 6,
          paddingHorizontal: 8,
          paddingVertical: 5,
          borderRadius: 6,
          backgroundColor: `${ui.c.brand}14`,
        },
      ]}
    >
      <Icon name="CornerDownRight" size={12} color={ui.c.brand} />
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: ui.c.fg }}>
        回复 {commentAuthor(item, agents, members).name}：
        {item.content.replace(/\[@([^\]]+)\]\(mention:\/\/[^)]+\)/g, "@$1").replace(/\s+/g, " ").slice(0, 40)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="取消回复"
        onPress={closeComposer}
        style={({ pressed }) => [pressed && ui.s.pressed]}
      >
        <Icon name="X" size={12} color={ui.c.muted} />
      </Pressable>
    </View>
  );

  const pad = compact || stacked ? 16 : narrow ? 20 : 28;
  const half = `${ui.c.line}80`;
  const hasNew = newCount > 0 && !scrollState.atBottom;
  const jumpButton = scrollState.canScroll ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={scrollState.atBottom ? "回到顶部" : hasNew ? `到底部，有 ${newCount} 条新评论` : "到底部"}
      onPress={jump}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        ui.s.row,
        {
          position: "absolute",
          right: 14,
          bottom: 14,
          gap: 6,
          paddingHorizontal: 12,
          paddingVertical: 7,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: hasNew ? `${ui.c.brand}66` : ui.c.border,
          backgroundColor: hasNew ? `${ui.c.brand}1f` : ui.c.card,
          boxShadow: ui.c.shadowLift,
          zIndex: 20,
        },
        hovered && { borderColor: ui.c.brand },
        pressed && ui.s.pressed,
      ]}
    >
      <Icon name={scrollState.atBottom ? "ArrowUp" : "ArrowDown"} size={14} color={hasNew ? ui.c.brand : ui.c.muted} />
      <Text style={{ fontSize: 12, fontWeight: "500", color: hasNew ? ui.c.brand : ui.c.fg }}>
        {scrollState.atBottom ? "回顶部" : hasNew ? `${newCount} 条新评论` : "到底部"}
      </Text>
    </Pressable>
  ) : null;

  const content = (
    <>
      <View style={{ gap: 8 }}>
        <Text style={{ color: ui.c.fg, fontSize: compact ? 20 : 24, fontWeight: "600", lineHeight: compact ? 28 : 32 }}>
          {issue.title}
        </Text>
        <View style={[ui.s.row, { gap: 10, flexWrap: "wrap" }]}>
          <Text style={ui.s.tiny}>更新于 {relTime(issue.updated_at)}</Text>
          {issue.due_date ? (
            <View style={[ui.s.row, { gap: 4 }]}>
              <Icon name="CalendarClock" size={12} color={ui.c.warning} />
              <Text style={ui.s.tiny}>截止 {issue.due_date}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {issue.description ? (
        <Markdown>{issue.description}</Markdown>
      ) : (
        <Text style={[ui.s.muted, { fontStyle: "italic" }]}>暂无描述</Text>
      )}

      <View style={{ gap: 8 }}>
        <View style={[ui.s.row, { gap: 8 }]}>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: "500", color: ui.c.fg }}>
            子任务{children.length > 0 ? ` · ${children.length}` : ""}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="添加子任务"
            onPress={() => setChildOpen((value) => !value)}
            style={({ pressed }) => [ui.s.row, { gap: 4 }, pressed && ui.s.pressed]}
          >
            <Icon name="Plus" size={13} color={ui.c.muted} />
            <Text style={ui.s.tiny}>添加子任务</Text>
          </Pressable>
        </View>

        {childOpen ? (
          <View style={[ui.s.row, { gap: 6 }]}>
            <View
              style={[
                ui.s.row,
                {
                  flex: 1,
                  gap: 6,
                  paddingHorizontal: 8,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: ui.c.border,
                  backgroundColor: ui.c.card,
                  height: 32,
                },
              ]}
            >
              <Icon name="CornerDownRight" size={13} color={ui.c.muted} />
              <TextInput
                value={childTitle}
                onChangeText={setChildTitle}
                placeholder="子任务标题，回车创建"
                placeholderTextColor={ui.c.faint}
                onSubmitEditing={() => void addChild()}
                autoFocus
                style={{ flex: 1, color: ui.c.fg, fontSize: 13, paddingVertical: 5 }}
              />
            </View>
            <Btn
              ui={ui}
              label="添加"
              icon="Plus"
              tone="primary"
              busy={busy}
              disabled={!childTitle.trim()}
              onPress={() => void addChild()}
            />
          </View>
        ) : null}

        {parent || children.length > 0 ? (
          <View style={[ui.s.panel, { borderRadius: 8, borderColor: ui.c.line }]}>
            {parent ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`父任务 ${parent.identifier}`}
                onPress={() => navigate("issue", { id: parent.id })}
                style={({ pressed }) => [
                  ui.s.row,
                  { gap: 8, paddingHorizontal: 12, paddingVertical: 8, minHeight: 37 },
                  pressed && ui.s.pressed,
                ]}
              >
                <Text style={{ fontSize: 12, color: ui.c.muted, fontWeight: "500" }}>父任务</Text>
                <Text style={ui.s.idText}>{parent.identifier}</Text>
                <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: ui.c.fg }}>
                  {parent.title}
                </Text>
                <Icon name={issueStatusIcon(parent, statuses)} size={14} color={issueStatusColor(parent, statuses)} />
              </Pressable>
            ) : null}
            {children.map((child, index) => {
              const owner = personOf(child.assignee_type, child.assignee_id);
              return (
                <View key={child.id}>
                  {index > 0 || parent ? <Divider ui={ui} color={half} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`${child.identifier} ${child.title}`}
                    onPress={() => navigate("issue", { id: child.id })}
                    style={({ pressed }) => [
                      ui.s.row,
                      { gap: 10, paddingHorizontal: 12, paddingVertical: 8, minHeight: 37 },
                      pressed && ui.s.pressed,
                    ]}
                  >
                    <Icon name={issueStatusIcon(child, statuses)} size={14} color={issueStatusColor(child, statuses)} />
                    <Text style={ui.s.idText}>{child.identifier}</Text>
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: ui.c.fg }}>
                      {child.title}
                    </Text>
                    {owner ? <Avatar ui={ui} name={owner.name} url={owner.url} size={20} /> : null}
                    <Text numberOfLines={1} style={[ui.s.tiny, { maxWidth: 96 }]}>
                      {issueStatusLabel(child, statuses)}
                    </Text>
                  </Pressable>
                </View>
              );
            })}
          </View>
        ) : !childOpen ? (
          <Text style={ui.s.tiny}>暂无子任务</Text>
        ) : null}
      </View>

      <View style={{ gap: 10 }}>
        <Text style={{ fontSize: 14, fontWeight: "500", color: ui.c.fg }}>
          评论{comments.length > 0 ? ` · ${comments.length}` : ""}
        </Text>
        {insights.loading && comments.length === 0 ? (
          <View style={ui.s.panel}>
            <LoadingRow ui={ui} />
          </View>
        ) : comments.length === 0 ? (
          <View style={ui.s.panel}>
            <Text style={[ui.s.tiny, { padding: 16 }]}>还没有评论，@ 智能体即可触发协作。</Text>
          </View>
        ) : (
          <View style={{ gap: 12 }}>
            {roots.map((root) => {
              const replies = threadOf(root.id);
              const folded = collapsed[root.id] === true;
              const target = replyTo && (replyTo.id === root.id || replies.some((item) => item.id === replyTo.id)) ? replyTo : null;
              const activities = activityMap.get(root.id) ?? [];
              const actOpen = openActivity[root.id] === true;
              return (
                <View key={root.id}>
                  <View style={[ui.s.panel, mentionFor === root.id && { overflow: "visible" }]}>
                    <CommentCard
                      ui={ui}
                      item={root}
                      agents={agents}
                      members={members}
                      runs={runs}
                      onOpenRun={setRunLogId}
                      busy={threadBusy === root.id}
                      onReply={() => openReply(root.id, root)}
                      onResolve={() => void toggleResolve(root)}
                    />
                    {folded
                      ? null
                      : replies.map((reply) => (
                          <View key={reply.id}>
                            <Divider ui={ui} color={half} />
                            <CommentCard
                              ui={ui}
                              item={reply}
                              agents={agents}
                              members={members}
                              runs={runs}
                              onOpenRun={setRunLogId}
                              replyToName={commentAuthor(commentById.get(reply.parent_id ?? "") ?? null, agents, members).name}
                              busy={threadBusy === reply.id}
                              onReply={() => openReply(root.id, reply)}
                              onResolve={() => void toggleResolve(reply)}
                            />
                          </View>
                        ))}
                    <Divider ui={ui} color={half} />
                    <ReplyBand
                      ui={ui}
                      value={drafts[root.id] ?? ""}
                      onChangeText={(text) => setDrafts((prev) => ({ ...prev, [root.id]: text }))}
                      chip={target ? replyChip(target) : null}
                      busy={sendingKey === root.id}
                      agents={agents}
                      mentionOpen={mentionFor === root.id}
                      onMention={() => setMentionFor((prev) => (prev === root.id ? null : root.id))}
                      onCloseMention={() => setMentionFor(null)}
                      onPickAgent={insertMention}
                      onSend={() => void sendComment(root.id, target ? target.id : root.id)}
                    />
                    {activities.length > 0 ? (
                      <>
                        <Divider ui={ui} color={half} />
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={actOpen ? `收起 ${activities.length} 条动态` : `展开 ${activities.length} 条动态`}
                          accessibilityState={{ expanded: actOpen }}
                          onPress={() => setOpenActivity((prev) => ({ ...prev, [root.id]: !actOpen }))}
                          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                            ui.s.row,
                            { gap: 5, paddingHorizontal: 16, paddingVertical: 7 },
                            hovered && { backgroundColor: ui.c.fillHover },
                            pressed && ui.s.pressed,
                          ]}
                        >
                          <Icon name={actOpen ? "ChevronDown" : "ChevronRight"} size={13} color={ui.c.muted} />
                          <Text style={{ fontSize: 12, color: ui.c.muted }}>{activities.length} 条动态</Text>
                        </Pressable>
                        {actOpen ? (
                          <View style={{ paddingBottom: 8 }}>
                            <ActivityList ui={ui} entries={activities} statuses={statuses} agents={agents} runs={runs} />
                          </View>
                        ) : null}
                      </>
                    ) : null}
                  </View>
                  {replies.length > 0 ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={folded ? `展开 ${replies.length} 条回复` : `收起 ${replies.length} 条回复`}
                      accessibilityState={{ expanded: !folded }}
                      onPress={() => setCollapsed((prev) => ({ ...prev, [root.id]: !folded }))}
                      style={({ pressed }) => [
                        ui.s.row,
                        { gap: 5, paddingHorizontal: 4, paddingVertical: 7 },
                        pressed && ui.s.pressed,
                      ]}
                    >
                      <Icon name={folded ? "ChevronRight" : "ChevronDown"} size={13} color={ui.c.muted} />
                      <Text style={{ fontSize: 12, color: ui.c.muted }}>{replies.length} 条回复</Text>
                    </Pressable>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </>
  );

  const composer = (
    <CommentComposer
      ui={ui}
      value={drafts.root ?? ""}
      onChangeText={(text) => setDrafts((prev) => ({ ...prev, root: text }))}
      placeholder="留下评论，@ 智能体可触发协作…"
      busy={sendingKey === "root"}
      agents={agents}
      mentionOpen={mentionFor === "root"}
      onMention={() => setMentionFor((prev) => (prev === "root" ? null : "root"))}
      onCloseMention={() => setMentionFor(null)}
      onPickAgent={insertMention}
      onSend={() => void sendComment("root", null)}
    />
  );

  const panel = (
    <>
      <PanelSection ui={ui} title="属性">
        <PropRow ui={ui} label="状态" onPress={() => setPick("status")}>
          <StatusMark ui={ui} issue={issue} statuses={statuses} />
          <View style={ui.s.grow} />
          <Icon name="ChevronDown" size={13} color={ui.c.muted} />
        </PropRow>
        <PropRow ui={ui} label="优先级" onPress={() => setPick("priority")}>
          {issue.priority && issue.priority !== "none" ? (
            <PriorityMark ui={ui} priority={issue.priority} />
          ) : (
            <Text style={{ fontSize: 13, color: ui.c.muted }}>无</Text>
          )}
          <View style={ui.s.grow} />
          <Icon name="ChevronDown" size={13} color={ui.c.muted} />
        </PropRow>
        <PropRow ui={ui} label="负责人" onPress={() => setAssignOpen(true)}>
          {assignee ? <Avatar ui={ui} name={assignee.name} url={assignee.url} size={20} /> : null}
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: ui.c.fg }}>
            {assignee?.name ?? "未指派"}
          </Text>
          <Icon name="ChevronDown" size={13} color={ui.c.muted} />
        </PropRow>
        <PropRow
          ui={ui}
          label="项目"
          onPress={project ? () => navigate("issues", { project: project.id }) : undefined}
        >
          <Icon name="FolderKanban" size={13} color={ui.c.muted} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: ui.c.fg }}>
            {project?.title ?? "未关联"}
          </Text>
        </PropRow>
        <PropRow ui={ui} label="工作流" onPress={() => navigate("workflows")}>
          <Icon name="Workflow" size={13} color={ui.c.muted} />
          <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: ui.c.fg }}>
            {issue.stage || "默认流程"}
          </Text>
        </PropRow>
        <PropRow ui={ui} label="标签">
          <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
            {issueLabels.length === 0 ? <Text style={{ fontSize: 13, color: ui.c.muted }}>未添加</Text> : null}
            {issueLabels.map((label) => {
              const ink = pickTextColor(label.color);
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`移除标签 ${label.name}`}
                  key={label.id}
                  onPress={() => void detachLabel(label)}
                  style={({ pressed }) => [
                    ui.s.row,
                    {
                      gap: 4,
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 6,
                      backgroundColor: label.color,
                    },
                    pressed && ui.s.pressed,
                  ]}
                >
                  <Text style={{ fontSize: 12, fontWeight: "500", color: ink }}>{label.name}</Text>
                  <Icon name="X" size={10} color={ink} />
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="添加标签"
              onPress={() => setLabelsOpen(true)}
              style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
            >
              <Icon name="Plus" size={14} color={ui.c.muted} />
            </Pressable>
          </View>
        </PropRow>
      </PanelSection>

      <PanelSection ui={ui} title="详情">
        <View style={{ paddingHorizontal: 7, gap: 6 }}>
          <DetailLine ui={ui} label="编号" value={issue.identifier} />
          <DetailLine ui={ui} label="创建于" value={fmtDateTime(issue.created_at)} />
          <DetailLine ui={ui} label="更新于" value={fmtDateTime(issue.updated_at)} />
          {assignee ? <DetailLine ui={ui} label="类型" value={assignee.kind} /> : null}
        </View>
      </PanelSection>

      <PanelSection ui={ui} title={`执行日志 · ${runs.length}`}>
        <ExecutionLogSection
          ui={ui}
          runs={runs}
          usage={insights.usage}
          agents={agents}
          onOpenRuns={() => setRunsOpen(true)}
          onOpenRun={setRunLogId}
        />
      </PanelSection>

      <PanelSection ui={ui} title="操作">
        <View style={{ gap: 6, paddingHorizontal: 7 }}>
          <Btn ui={ui} label="标记已读" icon="CheckCheck" onPress={() => void quick("read", "已标记为已读")} />
          <Btn ui={ui} label="强制重跑" icon="RotateCw" busy={busy} onPress={() => void rerun()} />
          <Btn ui={ui} label="打开接口视图" icon="Plug" onPress={() => navigate("api", { q: "issues" })} />
        </View>
      </PanelSection>
    </>
  );

  return (
    <View style={{ flex: 1 }}>
      <View
        style={[
          ui.s.row,
          {
            gap: 6,
            paddingHorizontal: compact ? 10 : 16,
            height: 48,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: ui.c.line,
            backgroundColor: ui.c.canvas,
          },
        ]}
      >
        <IconBtn ui={ui} icon="ArrowLeft" label="返回" onPress={() => navigate("issues")} />
        <Text numberOfLines={1} style={{ fontSize: 14, color: ui.c.muted, flexShrink: 1 }}>
          {project?.title ?? "任务"}
        </Text>
        <Icon name="ChevronRight" size={12} color={ui.c.faint} />
        <Text style={{ fontSize: 12, color: ui.c.fg }}>{issue.identifier}</Text>
        {activeAgent ? <RunningChip ui={ui} agent={activeAgent} compact={compact || narrow} /> : null}
        <View style={ui.s.grow} />
        <IconBtn ui={ui} icon="Pencil" label="编辑任务" onPress={openEdit} />
        <IconBtn ui={ui} icon="RotateCw" label="重跑任务" onPress={() => void rerun()} />
        <IconBtn ui={ui} icon="Trash2" label="删除任务" color={ui.c.danger} onPress={() => setConfirmDelete(true)} />
      </View>

      {compact || stacked ? (
        <View style={{ flex: 1, position: "relative" }}>
          <ScrollView
            ref={scrollRef}
            onScroll={onScroll}
            onContentSizeChange={onContentSizeChange}
            onLayout={onScrollLayout}
            scrollEventThrottle={16}
            style={{ flex: 1 }}
            contentContainerStyle={{ padding: pad, paddingBottom: 32, gap: 20 }}
          >
            {content}
            {composer}
            <View style={{ gap: 16 }}>{panel}</View>
          </ScrollView>
          {jumpButton}
        </View>
      ) : (
        <View style={{ flex: 1, flexDirection: "row", minHeight: 0 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flex: 1, position: "relative" }}>
              <ScrollView
                ref={scrollRef}
                onScroll={onScroll}
                onContentSizeChange={onContentSizeChange}
                onLayout={onScrollLayout}
                scrollEventThrottle={16}
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: pad, paddingBottom: 24 }}
              >
                <View style={{ width: "100%", maxWidth: 896, alignSelf: "center", gap: 24 }}>{content}</View>
              </ScrollView>
              {jumpButton}
            </View>
            <View style={{ paddingHorizontal: pad, paddingBottom: 16 }}>
              <View style={{ width: "100%", maxWidth: 896, alignSelf: "center" }}>{composer}</View>
            </View>
          </View>
          <ScrollView
            style={{ width: narrow ? 224 : 248, flexGrow: 0, flexShrink: 0 }}
            contentContainerStyle={{ padding: 14, paddingBottom: 28, gap: 14 }}
          >
            {panel}
          </ScrollView>
        </View>
      )}

      <Modal
        title={pick === "status" ? "选择状态" : "选择优先级"}
        icon={<Icon name={pick === "status" ? "CircleDot" : "Flag"} size={16} color={ui.c.muted} />}
        open={pick !== null}
        onOpenChange={(next) => {
          if (!next) setPick(null);
        }}
      >
        <Modal.Content>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 2 }}>
            {pick === "status"
              ? statuses.map((entry) => {
                  const active = entry.key === issue.status;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={entry.id}
                      disabled={busy}
                      onPress={() => {
                        setPick(null);
                        void updateIssue({ status: entry.key }, "状态已更新");
                      }}
                      style={({ pressed }) => [ui.s.menuItem, active && ui.s.hoverSurface, pressed && ui.s.pressed]}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: entry.color }} />
                      <Text style={{ flex: 1, fontSize: 14, color: ui.c.fg, fontWeight: active ? "600" : "400" }}>
                        {entry.name}
                      </Text>
                      {active ? <Icon name="Check" size={14} color={entry.color} /> : null}
                    </Pressable>
                  );
                })
              : PRIORITIES.map((value) => {
                  const meta = priorityMeta(value);
                  const active = issue.priority === value;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={value}
                      disabled={busy}
                      onPress={() => {
                        setPick(null);
                        void updateIssue({ priority: value }, "优先级已更新");
                      }}
                      style={({ pressed }) => [ui.s.menuItem, active && ui.s.hoverSurface, pressed && ui.s.pressed]}
                    >
                      <Icon name={meta.icon} size={14} color={ui.c.muted} />
                      <Text style={{ flex: 1, fontSize: 14, color: ui.c.fg, fontWeight: active ? "600" : "400" }}>
                        {meta.label}
                      </Text>
                      {active ? <Icon name="Check" size={14} color={ui.c.brand} /> : null}
                    </Pressable>
                  );
                })}
          </ScrollView>
        </Modal.Content>
      </Modal>

      <Modal
        title="指派负责人"
        icon={<Icon name="UserPlus" size={16} color={ui.c.muted} />}
        open={assignOpen}
        onOpenChange={setAssignOpen}
      >
        <Modal.Content>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 2 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAssignOpen(false);
                void updateIssue({ assignee_type: null, assignee_id: null }, "已取消指派");
              }}
              style={({ pressed }) => [ui.s.menuItem, pressed && ui.s.pressed]}
            >
              <Icon name="UserMinus" size={16} color={ui.c.muted} />
              <Text style={{ flex: 1, fontSize: 14, color: ui.c.fg }}>取消指派</Text>
            </Pressable>
            <Text style={[ui.s.label, { paddingHorizontal: 8, paddingTop: 8 }]}>智能体</Text>
            {agents.map((agent) => (
              <Pressable
                accessibilityRole="button"
                key={`agent-${agent.id}`}
                onPress={() => {
                  setAssignOpen(false);
                  void updateIssue({ assignee_type: "agent", assignee_id: agent.id }, `已指派给 ${agent.name}`);
                }}
                style={({ pressed }) => [ui.s.menuItem, pressed && ui.s.pressed]}
              >
                <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={24} />
                <Text style={{ flex: 1, fontSize: 14, color: ui.c.fg }}>{agent.name}</Text>
                {issue.assignee_id === agent.id ? <Icon name="Check" size={14} color={ui.c.brand} /> : null}
              </Pressable>
            ))}
            <Text style={[ui.s.label, { paddingHorizontal: 8, paddingTop: 8 }]}>成员</Text>
            {members.map((member) => (
              <Pressable
                accessibilityRole="button"
                key={`member-${member.id}`}
                onPress={() => {
                  setAssignOpen(false);
                  void updateIssue({ assignee_type: "member", assignee_id: member.id }, `已指派给 ${member.name}`);
                }}
                style={({ pressed }) => [ui.s.menuItem, pressed && ui.s.pressed]}
              >
                <Avatar ui={ui} name={member.name} url={member.avatar_url} size={24} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: ui.c.fg }}>{member.name}</Text>
                  <Text style={ui.s.tiny}>{member.email}</Text>
                </View>
                {issue.assignee_id === member.id ? <Icon name="Check" size={14} color={ui.c.brand} /> : null}
              </Pressable>
            ))}
          </ScrollView>
        </Modal.Content>
      </Modal>

      <Modal
        title="添加标签"
        icon={<Icon name="Tags" size={16} color={ui.c.muted} />}
        open={labelsOpen}
        onOpenChange={setLabelsOpen}
      >
        <Modal.Content>
          <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 2 }}>
            {allLabelsQuery.loading && availableLabels.length === 0 ? <LoadingRow ui={ui} /> : null}
            {!allLabelsQuery.loading && availableLabels.length === 0 ? (
              <Empty ui={ui} icon="Tags" title="没有可添加的标签" description="在标签页新建标签后即可绑定到任务。" />
            ) : null}
            {availableLabels.map((label) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`添加标签 ${label.name}`}
                key={label.id}
                disabled={busy}
                onPress={() => void attachLabel(label)}
                style={({ pressed }) => [ui.s.menuItem, pressed && ui.s.pressed]}
              >
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: label.color }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 14, color: ui.c.fg }}>{label.name}</Text>
                  {label.description ? <Text style={ui.s.tiny}>{label.description}</Text> : null}
                </View>
                <Icon name="Plus" size={14} color={ui.c.muted} />
              </Pressable>
            ))}
          </ScrollView>
        </Modal.Content>
      </Modal>

      <Modal
        title="编辑任务"
        icon={<Icon name="Pencil" size={16} color={ui.c.muted} />}
        open={editOpen}
        onOpenChange={setEditOpen}
      >
        <Modal.Content>
          <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 12 }}>
            <Field ui={ui} label="标题" value={editTitle} onChangeText={setEditTitle} placeholder="用一句话描述要做的事" />
            <Field
              ui={ui}
              label="描述"
              value={editDescription}
              onChangeText={setEditDescription}
              multiline
              placeholder="补充背景、验收标准…（支持 Markdown）"
            />
          </ScrollView>
          <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8, marginTop: 12 }]}>
            <Btn ui={ui} label="取消" onPress={() => setEditOpen(false)} />
            <Btn ui={ui} label="保存" tone="primary" onPress={() => void saveEdit()} />
          </View>
        </Modal.Content>
      </Modal>

      <Modal
        title="删除任务"
        icon={<Icon name="TriangleAlert" size={16} color={ui.c.danger} />}
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>确定删除 {issue.identifier}？此操作不可撤销。</Text>
            <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8 }]}>
              <Btn ui={ui} label="取消" onPress={() => setConfirmDelete(false)} />
              <Btn ui={ui} label="删除" tone="danger" busy={busy} onPress={() => void removeIssue()} />
            </View>
          </View>
        </Modal.Content>
      </Modal>

      <RunsModal
        ui={ui}
        open={runsOpen}
        onClose={() => setRunsOpen(false)}
        issueIdentifier={issue.identifier}
        issueTitle={issue.title}
        runs={runs}
        usage={insights.usage}
        agents={agents}
        onOpenRun={(id) => { setRunsOpen(false); setRunLogId(id); }}
      />
      <RunLogModal
        ui={ui}
        run={runLogRun}
        agents={agents}
        comments={comments}
        onClose={() => setRunLogId(null)}
      />
    </View>
  );
}

function PanelSection({ ui, title, children }: { ui: Ui; title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <View style={{ gap: 2 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={({ pressed }) => [
          ui.s.row,
          { gap: 4, height: 28, paddingHorizontal: 7, borderRadius: 6 },
          pressed && ui.s.pressed,
        ]}
      >
        <Icon name={open ? "ChevronDown" : "ChevronRight"} size={13} color={ui.c.muted} />
        <Text style={ui.s.sectionHead}>{title}</Text>
      </Pressable>
      {open ? <View style={{ gap: 2 }}>{children}</View> : null}
    </View>
  );
}

function PropRow({
  ui,
  label,
  children,
  onPress,
}: {
  ui: Ui;
  label: string;
  children: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        ui.s.row,
        { gap: 8, minHeight: 32, paddingHorizontal: 7, borderRadius: 6 },
        pressed && ui.s.pressed,
      ]}
    >
      <Text style={{ width: 48, fontSize: 13, color: ui.c.muted }}>{label}</Text>
      <View style={[ui.s.row, { flex: 1, gap: 6, minWidth: 0 }]}>{children}</View>
    </Pressable>
  );
}

function DetailLine({ ui, label, value }: { ui: Ui; label: string; value: string }) {
  return (
    <View style={[ui.s.row, { gap: 8 }]}>
      <Text style={{ width: 48, fontSize: 12, color: ui.c.muted }}>{label}</Text>
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: ui.c.fg }}>
        {value}
      </Text>
    </View>
  );
}

function commentAuthor(
  item: Comment | null,
  agents: Agent[],
  members: { id: string; name: string; avatar_url?: string | null }[],
) {
  if (!item) return { name: "成员", url: null as string | null };
  const agent = item.author_type === "agent" ? agents.find((entry) => entry.id === item.author_id) : undefined;
  const member = members.find((entry) => entry.id === item.author_id);
  return {
    name: item.author_name || agent?.name || member?.name || (item.author_type === "agent" ? "智能体" : "成员"),
    url: agent?.avatar_url ?? member?.avatar_url ?? null,
  };
}

function MentionPopover({
  ui,
  agents,
  onPickAgent,
  onClose,
}: {
  ui: Ui;
  agents: Agent[];
  onPickAgent(agent: Agent): void;
  onClose(): void;
}) {
  return (
    <View
      style={{
        position: "absolute",
        bottom: "100%",
        left: 0,
        marginBottom: 6,
        width: 288,
        maxHeight: 300,
        zIndex: 30,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: ui.c.border,
        backgroundColor: ui.c.card,
        boxShadow: ui.c.shadowLift,
        paddingVertical: 4,
        overflow: "hidden",
      }}
    >
      <View style={[ui.s.row, { paddingHorizontal: 12, paddingVertical: 5 }]}>
        <Text style={{ flex: 1, fontSize: 11, fontWeight: "500", color: ui.c.muted }}>智能体</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="关闭提及选择"
          onPress={onClose}
          style={({ pressed }) => [pressed && ui.s.pressed]}
        >
          <Icon name="X" size={12} color={ui.c.muted} />
        </Pressable>
      </View>
      <ScrollView style={{ maxHeight: 252 }} keyboardShouldPersistTaps="handled">
        {agents.length === 0 ? (
          <Text style={[ui.s.tiny, { paddingHorizontal: 12, paddingVertical: 8 }]}>暂无智能体</Text>
        ) : (
          agents.map((agent) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`提及 ${agent.name}`}
              key={`mention-${agent.id}`}
              onPress={() => onPickAgent(agent)}
              style={({ pressed }) => [
                ui.s.row,
                { gap: 10, height: 32, paddingHorizontal: 12, paddingVertical: 6 },
                pressed && ui.s.pressed,
              ]}
            >
              <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={20} />
              <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: ui.c.fg }}>
                {agent.name}
              </Text>
              <Icon name="AtSign" size={12} color={ui.c.faint} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

/** 每个评论模块底部常驻的细回复条，对齐官方「回复...」band。 */
function ReplyBand({
  ui,
  value,
  onChangeText,
  chip,
  busy,
  agents,
  mentionOpen,
  onMention,
  onCloseMention,
  onPickAgent,
  onSend,
}: {
  ui: Ui;
  value: string;
  onChangeText(text: string): void;
  chip?: React.ReactNode;
  busy?: boolean;
  agents: Agent[];
  mentionOpen: boolean;
  onMention(): void;
  onCloseMention(): void;
  onPickAgent(agent: Agent): void;
  onSend(): void;
}) {
  return (
    <View
      style={{
        position: "relative",
        backgroundColor: ui.c.dark ? `${ui.c.fill}59` : ui.c.canvas,
      }}
    >
      {chip ? <View style={{ paddingHorizontal: 12, paddingTop: 8 }}>{chip}</View> : null}
      <View style={[ui.s.row, { gap: 8, paddingHorizontal: 12, paddingVertical: 7 }]}>
        <Icon name="Bot" size={14} color={ui.c.faint} />
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder="回复..."
          placeholderTextColor={ui.c.faint}
          multiline
          onSubmitEditing={onSend}
          style={{
            flex: 1,
            minHeight: 24,
            maxHeight: 120,
            color: ui.c.fg,
            fontSize: 13,
            lineHeight: 19,
            paddingVertical: 2,
          }}
        />
        <IconBtn
          ui={ui}
          icon="AtSign"
          label="提及智能体"
          size={15}
          color={mentionOpen ? ui.c.brand : ui.c.muted}
          onPress={onMention}
        />
        <IconBtn
          ui={ui}
          icon="Send"
          label="发送回复"
          size={15}
          color={value.trim() ? ui.c.primary : ui.c.faint}
          busy={busy}
          onPress={onSend}
        />
      </View>
      {mentionOpen ? (
        <MentionPopover ui={ui} agents={agents} onPickAgent={onPickAgent} onClose={onCloseMention} />
      ) : null}
    </View>
  );
}

function CommentComposer({
  ui,
  value,
  onChangeText,
  placeholder,
  busy,
  agents,
  mentionOpen,
  onMention,
  onCloseMention,
  onPickAgent,
  onSend,
}: {
  ui: Ui;
  value: string;
  onChangeText(text: string): void;
  placeholder: string;
  busy?: boolean;
  agents: Agent[];
  mentionOpen: boolean;
  onMention(): void;
  onCloseMention(): void;
  onPickAgent(agent: Agent): void;
  onSend(): void;
}) {
  return (
    <View
      style={{
        position: "relative",
        gap: 6,
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: ui.c.line,
        backgroundColor: ui.c.card,
        boxShadow: ui.c.shadow,
      }}
    >
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={ui.c.faint}
        multiline
        style={{
          minHeight: 36,
          maxHeight: 140,
          color: ui.c.fg,
          fontSize: 14,
          lineHeight: 20,
          paddingHorizontal: 4,
          paddingVertical: 4,
        }}
      />
      <View style={[ui.s.row, { gap: 2 }]}>
        <IconBtn ui={ui} icon="AtSign" label="提及智能体" onPress={onMention} color={mentionOpen ? ui.c.brand : ui.c.muted} />
        <View style={ui.s.grow} />
        <IconBtn
          ui={ui}
          icon="Send"
          label="发送"
          color={value.trim() ? ui.c.primary : ui.c.faint}
          busy={busy}
          onPress={onSend}
        />
      </View>
      {mentionOpen ? (
        <MentionPopover ui={ui} agents={agents} onPickAgent={onPickAgent} onClose={onCloseMention} />
      ) : null}
    </View>
  );
}

function CommentCard({
  ui,
  item,
  agents,
  members,
  runs,
  onOpenRun,
  replyToName,
  busy,
  onReply,
  onResolve,
}: {
  ui: Ui;
  item: Comment;
  agents: Agent[];
  members: { id: string; name: string; avatar_url?: string | null }[];
  runs: TaskRun[];
  onOpenRun(id: string): void;
  replyToName?: string;
  busy?: boolean;
  onReply(): void;
  onResolve(): void;
}) {
  const author = commentAuthor(item, agents, members);
  const resolved = Boolean(item.resolved_at);
  const sourceTask = item.source_task_id ? runs.find((run) => run.id === item.source_task_id) ?? null : null;
  const running = sourceTask?.status === "running";
  const elapsed = sourceTask ? runDurationMs(sourceTask) : 0;
  return (
    <View style={{ gap: 8, padding: 16, backgroundColor: resolved ? `${ui.c.success}0f` : "transparent" }}>
      <View style={[ui.s.row, { gap: 12 }]}>
        <Avatar ui={ui} name={author.name} url={author.url} size={20} />
        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: "500", color: ui.c.fg, flexShrink: 1 }}>
          {author.name}
        </Text>
        {item.author_type === "agent" ? <Tag ui={ui} label="智能体" tone="accent" /> : null}
        {replyToName ? (
          <Text numberOfLines={1} style={[ui.s.tiny, { flexShrink: 1 }]}>
            回复 {replyToName}
          </Text>
        ) : null}
        <Text style={{ fontSize: 13, color: ui.c.muted }}>{relTime(item.created_at)}</Text>
        <View style={ui.s.grow} />
        {resolved ? <Tag ui={ui} label="已解决" tone="success" icon="Check" /> : null}
        <IconBtn ui={ui} icon="CornerDownRight" label="回复" onPress={onReply} />
        <IconBtn
          ui={ui}
          icon={resolved ? "CircleX" : "Check"}
          label={resolved ? "取消解决" : "解决"}
          color={resolved ? ui.c.success : ui.c.muted}
          busy={busy}
          onPress={onResolve}
        />
      </View>
      {running ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看智能体运行日志"
          onPress={() => sourceTask && onOpenRun(sourceTask.id)}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
            ui.s.row,
            { gap: 8, paddingLeft: 32, paddingVertical: 4, borderRadius: 6 },
            hovered && { backgroundColor: ui.c.fillHover },
            pressed && ui.s.pressed,
          ]}
        >
          <ActivityIndicator size="small" color={ui.c.brand} />
          <Text style={{ fontSize: 13, color: ui.c.muted }}>等待智能体响应。</Text>
          <View style={ui.s.grow} />
          <Text style={ui.s.tiny}>{fmtDuration(elapsed)}</Text>
          <Icon name="ScrollText" size={14} color={ui.c.muted} />
        </Pressable>
      ) : item.content ? (
        <View style={{ paddingLeft: 32 }}>
          <Markdown>{item.content}</Markdown>
        </View>
      ) : (
        <Text style={[ui.s.tiny, { paddingLeft: 32, fontStyle: "italic" }]}>（空评论）</Text>
      )}
      {sourceTask && !running ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="查看该评论触发的运行日志"
          onPress={() => onOpenRun(sourceTask.id)}
          style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
            ui.s.row,
            { gap: 6, paddingLeft: 32, paddingVertical: 3, borderRadius: 6, alignSelf: "flex-start" },
            hovered && { backgroundColor: ui.c.fillHover },
            pressed && ui.s.pressed,
          ]}
        >
          <Icon name="ScrollText" size={13} color={ui.c.muted} />
          <Text style={{ fontSize: 12, color: ui.c.muted }}>运行日志 · {fmtDuration(runDurationMs(sourceTask))}</Text>
          <Icon name="ChevronRight" size={12} color={ui.c.faint} />
        </Pressable>
      ) : null}
      {item.resolved_at ? (
        <Text style={[ui.s.tiny, { paddingLeft: 32 }]}>解决于 {fmtDateTime(item.resolved_at)}</Text>
      ) : null}
    </View>
  );
}