import { Icon, Markdown, Modal } from "@getpaseo/plugin/client/ui";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, type ViewStyle } from "react-native";
import { Avatar, Btn, Divider, Empty, ErrorNote, Field, LoadingRow, Tag, useUi } from "../bits";
import { asList, asRecord, useQuery } from "../api";
import { useWorkbench } from "../context";
import {
  fmtDateTime,
  issueStatusColor,
  issueStatusLabel,
  priorityMeta,
  relTime,
  type Agent,
  type Comment,
  type Issue,
  type Label,
  type Project,
} from "../model";
import { PriorityTag, StatusPill } from "../parts";

const PRIORITIES = ["urgent", "high", "medium", "low", "none"] as const;

const groupStyle = (ui: ReturnType<typeof useUi>): ViewStyle => ({
  borderWidth: 1,
  borderColor: ui.c.border,
  borderRadius: 10,
  overflow: "hidden",
  backgroundColor: ui.c.surface2,
});

export function IssueDetailPage({ issueId }: { issueId: string }) {
  const ctx = useWorkbench();
  const { theme, compact, api, statuses, workspaceId, navigate, toast, invalidate, bump } = ctx;
  const ui = useUi(theme, compact);
  const key = `${workspaceId}:${bump}`;
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);
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
  const [threadBusy, setThreadBusy] = useState<string | null>(null);

  const issueQuery = useQuery(api, issueId ? `/api/issues/${issueId}` : null, {}, key);
  const issue = issueQuery.data && typeof issueQuery.data === "object" ? (issueQuery.data as Issue) : null;
  const parentQuery = useQuery(api, issue?.parent_issue_id ? `/api/issues/${issue.parent_issue_id}` : null, {}, `${key}:parent`);
  const parent = parentQuery.data && typeof parentQuery.data === "object" ? (parentQuery.data as Issue) : null;
  const commentsQuery = useQuery(
    api,
    issueId ? `/api/issues/${issueId}/comments` : null,
    { select: (data) => asList<Comment>(data, "comments") },
    key,
  );
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

  const sendComment = async () => {
    if (!issue || !comment.trim()) return;
    setSending(true);
    const body: Record<string, unknown> = { content: comment.trim() };
    if (replyTo) body.parent_id = replyTo.id;
    const result = await api({ method: "POST", path: `/api/issues/${issue.id}/comments`, body });
    setSending(false);
    if (result.ok) {
      setComment("");
      setReplyTo(null);
      commentsQuery.refresh();
      toast.show(replyTo ? "回复已发送" : "评论已发送", { variant: "success" });
    } else toast.error(result.error ?? "发送失败");
  };

  const toggleResolve = async (item: Comment) => {
    const resolved = Boolean(item.resolved_at);
    setThreadBusy(item.id);
    const result = await api({ method: resolved ? "DELETE" : "POST", path: `/api/comments/${item.id}/resolve` });
    setThreadBusy(null);
    if (result.ok) {
      commentsQuery.refresh();
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
    if (result.ok) toast.show(message, { variant: "success" });
    else toast.error(result.error ?? "操作失败");
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

  const comments = commentsQuery.data ?? [];
  const commentById = new Map(comments.map((item) => [item.id, item]));
  const roots = comments.filter((item) => !item.parent_id || !commentById.has(item.parent_id));
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
  const statusColor = issueStatusColor(issue, statuses);
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

  return (
    <View style={{ flex: 1 }}>
      <View
        style={[
          ui.s.row,
          {
            gap: 7,
            paddingHorizontal: compact ? 10 : 14,
            paddingVertical: 7,
            borderBottomWidth: 1,
            borderBottomColor: ui.c.border,
            backgroundColor: ui.c.surface1,
          },
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="返回"
          onPress={() => navigate("issues")}
          style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
        >
          <Icon name="ArrowLeft" size={15} color={ui.c.muted} />
        </Pressable>
        <Text numberOfLines={1} style={{ fontSize: 12.5, color: ui.c.muted }}>
          {project?.title ?? "任务"}
        </Text>
        <Icon name="ChevronRight" size={12} color={ui.c.muted} />
        <Text style={{ fontSize: 12, fontFamily: "Menlo", color: ui.c.fg }}>{issue.identifier}</Text>
        <View style={ui.s.grow} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="编辑任务"
          onPress={openEdit}
          style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
        >
          <Icon name="Pencil" size={15} color={ui.c.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="重跑任务"
          onPress={() => void rerun()}
          style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
        >
          <Icon name="RotateCw" size={15} color={ui.c.muted} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="删除任务"
          onPress={() => setConfirmDelete(true)}
          style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
        >
          <Icon name="Trash2" size={15} color={ui.c.danger} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: compact ? 14 : 20, paddingBottom: 48 }}>
        <View style={{ flexDirection: compact ? "column" : "row", gap: compact ? 16 : 24, alignItems: "flex-start" }}>
          <View style={{ flex: 1, minWidth: 0, gap: 14 }}>
            <Text
              style={{
                color: ui.c.fg,
                fontSize: compact ? 19 : 22,
                fontWeight: "700",
                lineHeight: compact ? 26 : 30,
                letterSpacing: -0.2,
              }}
            >
              {issue.title}
            </Text>
            <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
              <StatusPill ui={ui} issue={issue} statuses={statuses} />
              <PriorityTag ui={ui} priority={issue.priority} />
              {issue.due_date ? <Tag ui={ui} label={`截止 ${issue.due_date}`} tone="warning" icon="CalendarClock" /> : null}
              <Text style={ui.s.tiny}>更新于 {relTime(issue.updated_at)}</Text>
            </View>

            <View style={{ paddingTop: 2 }}>
              {issue.description ? (
                <Markdown>{issue.description}</Markdown>
              ) : (
                <Text style={[ui.s.muted, { fontStyle: "italic" }]}>暂无描述</Text>
              )}
            </View>

            <Divider ui={ui} />

            <View style={{ gap: 6 }}>
              <View style={[ui.s.row, { gap: 8 }]}>
                <Text style={[ui.s.label, { flex: 1 }]}>子任务 · {children.length}</Text>
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
                <View style={[ui.s.row, { gap: 6, paddingVertical: 6 }]}>
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
                        backgroundColor: ui.c.surface2,
                        minHeight: 32,
                      },
                    ]}
                  >
                    <Icon name="CornerDownRight" size={13} color={ui.c.muted} />
                    <TextInput
                      value={childTitle}
                      onChangeText={setChildTitle}
                      placeholder="子任务标题，回车创建"
                      placeholderTextColor={ui.c.muted}
                      onSubmitEditing={() => void addChild()}
                      autoFocus
                      style={{ flex: 1, color: ui.c.fg, fontSize: 12.5, paddingVertical: 5 }}
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
                <View style={groupStyle(ui)}>
                  {parent ? (
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`父任务 ${parent.identifier}`}
                      onPress={() => navigate("issue", { id: parent.id })}
                      style={({ pressed }) => [
                        { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, paddingVertical: 10 },
                        pressed && ui.s.pressed,
                      ]}
                    >
                      <Text style={{ fontSize: 10.5, color: ui.c.muted, fontWeight: "700" }}>父任务</Text>
                      <Text style={{ fontSize: 11.5, fontFamily: "Menlo", color: ui.c.muted }}>{parent.identifier}</Text>
                      <Text numberOfLines={1} style={[ui.s.body, { flex: 1 }]}>
                        {parent.title}
                      </Text>
                      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: issueStatusColor(parent, statuses) }} />
                    </Pressable>
                  ) : null}
                  {children.map((child, index) => {
                    const owner = personOf(child.assignee_type, child.assignee_id);
                    return (
                      <View key={child.id}>
                        {index > 0 || parent ? <Divider ui={ui} color={`${ui.c.fg}1f`} /> : null}
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => navigate("issue", { id: child.id })}
                          style={({ pressed }) => [ui.s.listRow, pressed && ui.s.pressed]}
                        >
                          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: issueStatusColor(child, statuses) }} />
                          <Text style={[ui.s.tiny, { fontFamily: "Menlo" }]}>{child.identifier}</Text>
                          <Text numberOfLines={1} style={[ui.s.body, { flex: 1 }]}>
                            {child.title}
                          </Text>
                          {owner ? (
                            <View style={[ui.s.row, { gap: 4 }]}>
                              <Avatar ui={ui} name={owner.name} url={owner.url} size={16} />
                              <Text numberOfLines={1} style={[ui.s.tiny, { maxWidth: 90 }]}>
                                {owner.name}
                              </Text>
                            </View>
                          ) : null}
                          <Text style={ui.s.tiny}>{issueStatusLabel(child, statuses)}</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </View>
              ) : !childOpen ? (
                <Text style={[ui.s.tiny, { paddingVertical: 4 }]}>暂无子任务</Text>
              ) : null}
            </View>

            <Divider ui={ui} />

            <View style={{ gap: 6 }}>
              <Text style={ui.s.label}>评论 · {comments.length}</Text>
              {commentsQuery.loading && comments.length === 0 ? (
                <View style={groupStyle(ui)}>
                  <View style={{ padding: 12 }}>
                    <LoadingRow ui={ui} />
                  </View>
                </View>
              ) : comments.length === 0 ? (
                <View style={groupStyle(ui)}>
                  <Text style={[ui.s.tiny, { padding: 12 }]}>还没有评论，@ 智能体即可触发协作。</Text>
                </View>
              ) : (
                <View style={{ gap: 10 }}>
                  {roots.map((root) => {
                    const replies = threadOf(root.id);
                    return (
                      <View key={root.id} style={groupStyle(ui)}>
                        <CommentCard
                          ui={ui}
                          item={root}
                          agents={agents}
                          members={members}
                          busy={threadBusy === root.id}
                          onReply={() => setReplyTo(root)}
                          onResolve={() => void toggleResolve(root)}
                        />
                        {replies.length > 0 ? (
                          <View>
                            <Divider ui={ui} color={`${ui.c.fg}1f`} />
                            <View
                              style={{
                                marginLeft: 16,
                                borderLeftWidth: 1,
                                borderLeftColor: `${ui.c.fg}1f`,
                              }}
                            >
                              {replies.map((reply, replyIndex) => (
                                <View key={reply.id}>
                                  {replyIndex > 0 ? <Divider ui={ui} color={`${ui.c.fg}1f`} /> : null}
                                  <CommentCard
                                    ui={ui}
                                    item={reply}
                                    agents={agents}
                                    members={members}
                                    replyToName={commentAuthor(commentById.get(reply.parent_id ?? "") ?? null, agents, members).name}
                                    busy={threadBusy === reply.id}
                                    onReply={() => setReplyTo(reply)}
                                    onResolve={() => void toggleResolve(reply)}
                                  />
                                </View>
                              ))}
                            </View>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              )}
              <View style={{ gap: 8, paddingTop: 6 }}>
                {replyTo ? (
                  <View
                    style={[
                      ui.s.row,
                      {
                        gap: 6,
                        paddingHorizontal: 8,
                        paddingVertical: 5,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: `${ui.c.accent}55`,
                        backgroundColor: `${ui.c.accent}14`,
                      },
                    ]}
                  >
                    <Icon name="CornerDownRight" size={12} color={ui.c.accent} />
                    <Text numberOfLines={1} style={{ flex: 1, fontSize: 12, color: ui.c.fg }}>
                      回复 {commentAuthor(replyTo, agents, members).name}：{replyTo.content.replace(/\s+/g, " ").slice(0, 40)}
                    </Text>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="取消回复"
                      onPress={() => setReplyTo(null)}
                      style={({ pressed }) => [pressed && ui.s.pressed]}
                    >
                      <Icon name="X" size={12} color={ui.c.muted} />
                    </Pressable>
                  </View>
                ) : null}
                <Field
                  ui={ui}
                  value={comment}
                  onChangeText={setComment}
                  placeholder={replyTo ? "写下回复，支持 Markdown 与 @智能体…" : "写下评论，支持 Markdown 与 @智能体…"}
                  multiline
                />
                <View style={[ui.s.row, { justifyContent: "flex-end" }]}>
                  <Btn
                    ui={ui}
                    label={replyTo ? "发送回复" : "发送评论"}
                    icon="Send"
                    tone="primary"
                    busy={sending}
                    disabled={!comment.trim()}
                    onPress={() => void sendComment()}
                  />
                </View>
              </View>
            </View>
          </View>

          <View
            style={{
              width: compact ? "100%" : 288,
              gap: 16,
              borderLeftWidth: compact ? 0 : 1,
              borderLeftColor: ui.c.border,
              paddingLeft: compact ? 0 : 20,
            }}
          >
            <View style={{ gap: 2 }}>
              <Text style={ui.s.label}>属性</Text>
              <View style={{ borderTopWidth: 1, borderTopColor: ui.c.border }}>
                <PropRow ui={ui} label="状态" onPress={() => setPick("status")}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: statusColor }} />
                  <Text numberOfLines={1} style={[ui.s.body, { flex: 1 }]}>
                    {issueStatusLabel(issue, statuses)}
                  </Text>
                  <Icon name="ChevronDown" size={13} color={ui.c.muted} />
                </PropRow>
                <PropRow ui={ui} label="优先级" onPress={() => setPick("priority")}>
                  <Icon name="Flag" size={13} color={ui.c.muted} />
                  <Text numberOfLines={1} style={[ui.s.body, { flex: 1 }]}>
                    {priorityMeta(issue.priority).label}
                  </Text>
                  <Icon name="ChevronDown" size={13} color={ui.c.muted} />
                </PropRow>
                <PropRow ui={ui} label="负责人" onPress={() => setAssignOpen(true)}>
                  {assignee ? <Avatar ui={ui} name={assignee.name} url={assignee.url} size={18} /> : null}
                  <Text numberOfLines={1} style={[ui.s.body, { flex: 1 }]}>
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
                  <Text numberOfLines={1} style={[ui.s.body, { flex: 1 }]}>
                    {project?.title ?? "未关联"}
                  </Text>
                </PropRow>
                <PropRow ui={ui} label="工作流" onPress={() => navigate("workflows")}>
                  <Icon name="Workflow" size={13} color={ui.c.muted} />
                  <Text numberOfLines={1} style={[ui.s.body, { flex: 1 }]}>
                    {issue.stage || "默认流程"}
                  </Text>
                </PropRow>
                <PropRow ui={ui} label="标签" last>
                  <View style={{ flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                    {issueLabels.length === 0 ? <Text style={ui.s.muted}>未添加</Text> : null}
                    {issueLabels.map((label) => (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`移除标签 ${label.name}`}
                        key={label.id}
                        onPress={() => void detachLabel(label)}
                        style={({ pressed }) => [
                          {
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            paddingHorizontal: 7,
                            paddingVertical: 2,
                            borderRadius: 999,
                            borderWidth: 1,
                            borderColor: `${label.color}55`,
                            backgroundColor: `${label.color}1f`,
                          },
                          pressed && ui.s.pressed,
                        ]}
                      >
                        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: label.color }} />
                        <Text style={[ui.s.tiny, { color: label.color, fontWeight: "600" }]}>{label.name}</Text>
                        <Icon name="X" size={10} color={label.color} />
                      </Pressable>
                    ))}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="添加标签"
                    onPress={() => setLabelsOpen(true)}
                    style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
                  >
                    <Icon name="Plus" size={14} color={ui.c.muted} />
                  </Pressable>
                </PropRow>
              </View>
            </View>

            <View style={{ gap: 3 }}>
              <Text style={ui.s.label}>详情</Text>
              <Text style={ui.s.tiny}>编号 {issue.identifier}</Text>
              <Text style={ui.s.tiny}>创建于 {fmtDateTime(issue.created_at)}</Text>
              <Text style={ui.s.tiny}>更新于 {fmtDateTime(issue.updated_at)}</Text>
            </View>

            <View style={{ gap: 6 }}>
              <Text style={ui.s.label}>操作</Text>
              <Btn ui={ui} label="标记已读" icon="CheckCheck" onPress={() => void quick("read", "已标记为已读")} />
              <Btn ui={ui} label="强制重跑" icon="RotateCw" busy={busy} onPress={() => void rerun()} />
              <Btn ui={ui} label="打开接口视图" icon="Plug" onPress={() => navigate("api", { q: "issues" })} />
            </View>
          </View>
        </View>
      </ScrollView>

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
                      style={({ pressed }) => [ui.s.listRow, active && { backgroundColor: ui.c.surface2 }, pressed && ui.s.pressed]}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: entry.color }} />
                      <Text style={[ui.s.body, { flex: 1 }, active && { fontWeight: "700" }]}>{entry.name}</Text>
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
                      style={({ pressed }) => [ui.s.listRow, active && { backgroundColor: ui.c.surface2 }, pressed && ui.s.pressed]}
                    >
                      <Text style={[ui.s.body, { flex: 1 }, active && { fontWeight: "700" }]}>{meta.label}</Text>
                      {active ? <Icon name="Check" size={14} color={ui.c.accent} /> : null}
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
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 4 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setAssignOpen(false);
                void updateIssue({ assignee_type: null, assignee_id: null }, "已取消指派");
              }}
              style={({ pressed }) => [ui.s.listRow, pressed && ui.s.pressed]}
            >
              <Icon name="UserMinus" size={16} color={ui.c.muted} />
              <Text style={[ui.s.body, { flex: 1 }]}>取消指派</Text>
            </Pressable>
            <Text style={[ui.s.label, { paddingHorizontal: 14, paddingTop: 8 }]}>智能体</Text>
            {agents.map((agent) => (
              <Pressable
                accessibilityRole="button"
                key={`agent-${agent.id}`}
                onPress={() => {
                  setAssignOpen(false);
                  void updateIssue({ assignee_type: "agent", assignee_id: agent.id }, `已指派给 ${agent.name}`);
                }}
                style={({ pressed }) => [ui.s.listRow, pressed && ui.s.pressed]}
              >
                <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={26} />
                <Text style={[ui.s.body, { flex: 1 }]}>{agent.name}</Text>
                {issue.assignee_id === agent.id ? <Icon name="Check" size={14} color={ui.c.accent} /> : null}
              </Pressable>
            ))}
            <Text style={[ui.s.label, { paddingHorizontal: 14, paddingTop: 8 }]}>成员</Text>
            {members.map((member) => (
              <Pressable
                accessibilityRole="button"
                key={`member-${member.id}`}
                onPress={() => {
                  setAssignOpen(false);
                  void updateIssue({ assignee_type: "member", assignee_id: member.id }, `已指派给 ${member.name}`);
                }}
                style={({ pressed }) => [ui.s.listRow, pressed && ui.s.pressed]}
              >
                <Avatar ui={ui} name={member.name} url={member.avatar_url} size={26} />
                <View style={{ flex: 1 }}>
                  <Text style={[ui.s.body]}>{member.name}</Text>
                  <Text style={ui.s.tiny}>{member.email}</Text>
                </View>
                {issue.assignee_id === member.id ? <Icon name="Check" size={14} color={ui.c.accent} /> : null}
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
                style={({ pressed }) => [ui.s.listRow, pressed && ui.s.pressed]}
              >
                <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: label.color }} />
                <View style={{ flex: 1 }}>
                  <Text style={ui.s.body}>{label.name}</Text>
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
    </View>
  );
}

function PropRow({
  ui,
  label,
  children,
  onPress,
  last,
}: {
  ui: ReturnType<typeof useUi>;
  label: string;
  children: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        { gap: 5, paddingVertical: 8, borderBottomWidth: last ? 0 : 1, borderBottomColor: ui.c.border },
        pressed && ui.s.pressed,
      ]}
    >
      <Text style={{ fontSize: 11.5, color: ui.c.muted, fontWeight: "600" }}>{label}</Text>
      <View style={[ui.s.row, { gap: 7, minHeight: 20 }]}>{children}</View>
    </Pressable>
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

function CommentAction({
  ui,
  icon,
  label,
  onPress,
  disabled,
}: {
  ui: ReturnType<typeof useUi>;
  icon: string;
  label: string;
  onPress(): void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        ui.s.row,
        { gap: 4, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, opacity: disabled ? 0.45 : 1 },
        pressed && ui.s.pressed,
      ]}
    >
      <Icon name={icon} size={12} color={ui.c.muted} />
      <Text style={{ fontSize: 11.5, color: ui.c.muted }}>{label}</Text>
    </Pressable>
  );
}

function CommentCard({
  ui,
  item,
  agents,
  members,
  replyToName,
  busy,
  onReply,
  onResolve,
}: {
  ui: ReturnType<typeof useUi>;
  item: Comment;
  agents: Agent[];
  members: { id: string; name: string; avatar_url?: string | null }[];
  replyToName?: string;
  busy?: boolean;
  onReply(): void;
  onResolve(): void;
}) {
  const author = commentAuthor(item, agents, members);
  const resolved = Boolean(item.resolved_at);
  return (
    <View style={{ gap: 6, padding: 12, backgroundColor: resolved ? `${ui.c.success}0f` : "transparent" }}>
      <View style={[ui.s.row, { gap: 7, flexWrap: "wrap" }]}>
        <Avatar ui={ui} name={author.name} url={author.url} size={22} />
        <Text style={[ui.s.body, { fontWeight: "600" }]}>{author.name}</Text>
        {item.author_type === "agent" ? <Tag ui={ui} label="智能体" tone="accent" /> : null}
        <Text style={ui.s.tiny}>{relTime(item.created_at)}</Text>
        {replyToName ? <Text style={ui.s.tiny}>回复 {replyToName}</Text> : null}
        <View style={ui.s.grow} />
        {resolved ? <Tag ui={ui} label="已解决" tone="success" icon="Check" /> : null}
        <CommentAction ui={ui} icon="CornerDownRight" label="回复" onPress={onReply} />
        <CommentAction
          ui={ui}
          icon={resolved ? "CircleX" : "Check"}
          label={resolved ? "取消解决" : "解决"}
          onPress={onResolve}
          disabled={busy}
        />
      </View>
      {item.content ? (
        <View style={{ paddingLeft: 29 }}>
          <Markdown>{item.content}</Markdown>
        </View>
      ) : (
        <Text style={[ui.s.tiny, { paddingLeft: 29, fontStyle: "italic" }]}>（空评论）</Text>
      )}
      {item.resolved_at ? (
        <Text style={[ui.s.tiny, { paddingLeft: 29 }]}>解决于 {fmtDateTime(item.resolved_at)}</Text>
      ) : null}
    </View>
  );
}