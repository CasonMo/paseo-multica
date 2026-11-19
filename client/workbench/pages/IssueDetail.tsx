import { Icon, Markdown, Modal } from "@getpaseo/plugin/client/ui";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Avatar, Btn, Card, Divider, Empty, ErrorNote, Field, LoadingRow, SectionHeader, Tag, useUi } from "../bits";
import { asList, asRecord, useQuery } from "../api";
import { useWorkbench } from "../context";
import {
  fmtDateTime,
  issueCategory,
  issueStatusColor,
  issueStatusLabel,
  priorityMeta,
  relTime,
  type Agent,
  type Comment,
  type Issue,
  type Label,
} from "../model";
import { PriorityTag, StatusPill } from "../parts";

interface MemberUser {
  id: string;
  name?: string;
  email?: string;
  avatar_url?: string | null;
}

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

  const issueQuery = useQuery(api, issueId ? `/api/issues/${issueId}` : null, {}, key);
  const issue = issueQuery.data && typeof issueQuery.data === "object" ? (issueQuery.data as Issue) : null;
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

  const refreshAll = () => {
    issueQuery.refresh();
    commentsQuery.refresh();
    childrenQuery.refresh();
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
    await updateIssue({ title: editTitle.trim(), description: editDescription }, "需求已更新");
  };

  const sendComment = async () => {
    if (!issue || !comment.trim()) return;
    setSending(true);
    const result = await api({ method: "POST", path: `/api/issues/${issue.id}/comments`, body: { content: comment.trim() } });
    setSending(false);
    if (result.ok) {
      setComment("");
      commentsQuery.refresh();
      toast.show("评论已发送", { variant: "success" });
    } else toast.error(result.error ?? "发送失败");
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

  const removeIssue = async () => {
    if (!issue) return;
    setBusy(true);
    const result = await api({ method: "DELETE", path: `/api/issues/${issue.id}` });
    setBusy(false);
    setConfirmDelete(false);
    if (result.ok) {
      toast.show("需求已删除", { variant: "success" });
      invalidate();
      navigate("issues");
    } else toast.error(result.error ?? "删除失败");
  };

  if (!issueId) {
    return <Empty ui={ui} icon="AlertCircle" title="缺少需求 ID" action={<Btn ui={ui} label="返回列表" onPress={() => navigate("issues")} />} />;
  }

  if (issueQuery.loading && !issue) return <LoadingRow ui={ui} label="读取需求…" />;
  if (issueQuery.error && !issue) {
    return (
      <View style={{ padding: 16 }}>
        <ErrorNote ui={ui} message={issueQuery.error} onRetry={issueQuery.refresh} />
        <View style={{ marginTop: 10 }}>
          <Btn ui={ui} label="返回需求列表" icon="ArrowLeft" onPress={() => navigate("issues")} />
        </View>
      </View>
    );
  }
  if (!issue) return null;

  const comments = commentsQuery.data ?? [];
  const children = childrenQuery.data ?? [];
  const issueLabels = issueLabelsQuery.data ?? [];
  const attachedIds = new Set(issueLabels.map((label) => label.id));
  const availableLabels = (allLabelsQuery.data ?? []).filter(
    (label) => (label.resource_type ?? "issue") === "issue" && !attachedIds.has(label.id),
  );
  const statusColor = issueStatusColor(issue, statuses);

  return (
    <ScrollView contentContainerStyle={{ padding: compact ? 12 : 18, gap: 14, paddingBottom: 48 }}>
      <View style={[ui.s.row, { gap: 8 }]}>
        <Btn ui={ui} label="返回" icon="ArrowLeft" onPress={() => navigate("issues")} />
        <View style={ui.s.grow} />
        <Btn ui={ui} label="编辑" icon="Pencil" onPress={openEdit} />
        <Btn ui={ui} label="重跑" icon="RotateCw" busy={busy} onPress={() => void rerun()} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="删除需求"
          onPress={() => setConfirmDelete(true)}
          style={({ pressed }) => [ui.s.chip, pressed && ui.s.pressed, { borderColor: `${ui.c.danger}55` }]}
        >
          <Icon name="Trash2" size={13} color={ui.c.danger} />
        </Pressable>
      </View>

      <Card ui={ui} style={{ gap: 10 }}>
        <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
          <Text style={[ui.s.tiny, { fontFamily: "Menlo", color: ui.c.muted }]}>{issue.identifier}</Text>
          <StatusPill ui={ui} issue={issue} statuses={statuses} />
          <PriorityTag ui={ui} priority={issue.priority} />
          {issue.due_date ? <Tag ui={ui} label={`截止 ${issue.due_date}`} tone="warning" icon="CalendarClock" /> : null}
        </View>
        <Text style={{ color: ui.c.fg, fontSize: compact ? 18 : 22, fontWeight: "700", lineHeight: compact ? 25 : 30 }}>
          {issue.title}
        </Text>
        <View style={[ui.s.row, { gap: 12, flexWrap: "wrap" }]}>
          <Text style={ui.s.tiny}>创建于 {fmtDateTime(issue.created_at)}</Text>
          <Text style={ui.s.tiny}>更新于 {relTime(issue.updated_at)}</Text>
          {issue.project_id ? <Text style={ui.s.tiny}>项目 {issue.project_id.slice(0, 8)}</Text> : null}
        </View>
      </Card>

      <View style={{ flexDirection: compact ? "column" : "row", gap: 14, alignItems: "flex-start" }}>
        <View style={{ flex: compact ? undefined : 1.6, gap: 14, width: compact ? "100%" : undefined }}>
          <Card ui={ui} style={{ gap: 12 }}>
            <SectionHeader ui={ui} title="描述" />
            {issue.description ? (
              <Markdown>{issue.description}</Markdown>
            ) : (
              <Text style={[ui.s.muted, { fontStyle: "italic" }]}>暂无描述</Text>
            )}
          </Card>

          {children.length > 0 ? (
            <Card ui={ui} padded={false}>
              <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
                <SectionHeader ui={ui} title={`子需求 · ${children.length}`} />
              </View>
              <View style={{ paddingBottom: 6 }}>
                {children.map((child, index) => (
                  <View key={child.id}>
                    {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 14 }} /> : null}
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
                      <Text style={ui.s.tiny}>{issueStatusLabel(child, statuses)}</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <Card ui={ui} padded={false}>
            <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
              <SectionHeader ui={ui} title={`评论 · ${comments.length}`} />
            </View>
            {commentsQuery.loading && comments.length === 0 ? (
              <LoadingRow ui={ui} />
            ) : comments.length === 0 ? (
              <Empty ui={ui} icon="MessageSquare" title="还没有评论" description="留下第一条评论，@ 智能体即可触发协作。" />
            ) : (
              <View style={{ gap: 2 }}>
                {comments.map((item) => (
                  <CommentRow key={item.id} ui={ui} item={item} agents={agents} members={members} />
                ))}
              </View>
            )}
            <View style={{ padding: 14, gap: 8, borderTopWidth: 1, borderTopColor: ui.c.border }}>
              <Field
                ui={ui}
                value={comment}
                onChangeText={setComment}
                placeholder="写下评论，支持 Markdown 与 @智能体…"
                multiline
              />
              <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8 }]}>
                <Btn
                  ui={ui}
                  label="发送评论"
                  icon="Send"
                  tone="primary"
                  busy={sending}
                  disabled={!comment.trim()}
                  onPress={() => void sendComment()}
                />
              </View>
            </View>
          </Card>
        </View>

        <View style={{ flex: compact ? undefined : 1, gap: 14, width: compact ? "100%" : undefined }}>
          <Card ui={ui} style={{ gap: 12 }}>
            <SectionHeader ui={ui} title="属性" />
            <View style={{ gap: 6 }}>
              <Text style={ui.s.label}>状态</Text>
              <View style={{ gap: 6 }}>
                {(statuses.length > 0 ? statuses : []).map((entry) => {
                  const active = entry.key === issue.status;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={entry.id}
                      disabled={busy}
                      onPress={() => void updateIssue({ status: entry.key }, "状态已更新")}
                      style={({ pressed }) => [
                        {
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          paddingVertical: 7,
                          paddingHorizontal: 9,
                          borderRadius: 8,
                          backgroundColor: active ? `${entry.color}1f` : "transparent",
                        },
                        pressed && ui.s.pressed,
                      ]}
                    >
                      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: entry.color }} />
                      <Text style={[ui.s.body, { flex: 1 }, active && { fontWeight: "700" }]}>{entry.name}</Text>
                      {active ? <Icon name="Check" size={14} color={entry.color} /> : null}
                    </Pressable>
                  );
                })}
                {statuses.length === 0 ? <Text style={ui.s.muted}>无法读取状态列表</Text> : null}
              </View>
            </View>
            <Divider ui={ui} />
            <View style={{ gap: 6 }}>
              <Text style={ui.s.label}>优先级</Text>
              <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
                {(["urgent", "high", "medium", "low", "none"] as const).map((value) => {
                  const meta = priorityMeta(value);
                  const active = issue.priority === value;
                  return (
                    <Pressable
                      accessibilityRole="button"
                      key={value}
                      disabled={busy}
                      onPress={() => void updateIssue({ priority: value }, "优先级已更新")}
                      style={({ pressed }) => [
                        ui.s.chip,
                        active && { borderColor: ui.c.accent, backgroundColor: `${ui.c.accent}1f` },
                        pressed && ui.s.pressed,
                      ]}
                    >
                      <Text style={[ui.s.chipText, active && { fontWeight: "700" }]}>{meta.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <Divider ui={ui} />
            <View style={{ gap: 6 }}>
              <Text style={ui.s.label}>负责人</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => setAssignOpen(true)}
                style={({ pressed }) => [ui.s.row, { gap: 8 }, pressed && ui.s.pressed]}
              >
                {assignee ? (
                  <>
                    <Avatar ui={ui} name={assignee.name} url={assignee.url} size={26} />
                    <View style={{ flex: 1 }}>
                      <Text style={[ui.s.body, { fontWeight: "600" }]}>{assignee.name}</Text>
                      <Text style={ui.s.tiny}>{assignee.kind}</Text>
                    </View>
                  </>
                ) : (
                  <Text style={ui.s.muted}>未指派</Text>
                )}
                <Icon name="ChevronRight" size={14} color={ui.c.muted} />
              </Pressable>
            </View>
            <Divider ui={ui} />
            <View style={{ gap: 6 }}>
              <View style={[ui.s.row, { justifyContent: "space-between" }]}>
                <Text style={ui.s.label}>标签</Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="添加标签"
                  onPress={() => setLabelsOpen(true)}
                  style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
                >
                  <Icon name="Plus" size={14} color={ui.c.muted} />
                </Pressable>
              </View>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
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
                        gap: 5,
                        paddingHorizontal: 8,
                        paddingVertical: 4,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: `${label.color}55`,
                        backgroundColor: `${label.color}1f`,
                      },
                      pressed && ui.s.pressed,
                    ]}
                  >
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: label.color }} />
                    <Text style={[ui.s.tiny, { color: label.color, fontWeight: "600" }]}>{label.name}</Text>
                    <Icon name="X" size={11} color={label.color} />
                  </Pressable>
                ))}
                {issueLabels.length === 0 ? <Text style={ui.s.muted}>未添加标签</Text> : null}
              </View>
            </View>
          </Card>

          <Card ui={ui} style={{ gap: 10 }}>
            <SectionHeader ui={ui} title="快捷操作" />
            <Btn ui={ui} label="标记已读" icon="CheckCheck" onPress={() => void quick("read", "已标记为已读")} />
            <Btn ui={ui} label="强制重跑" icon="RotateCw" busy={busy} onPress={() => void rerun()} />
            <Btn ui={ui} label="打开接口视图" icon="Plug" onPress={() => navigate("api", { q: "issues" })} />
          </Card>
        </View>
      </View>

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
              <Empty ui={ui} icon="Tags" title="没有可添加的标签" description="在标签页新建标签后即可绑定到需求。" />
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
        title="编辑需求"
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
        title="删除需求"
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
    </ScrollView>
  );

  async function quick(action: "read", message: string) {
    if (!issue) return;
    const result = await api({ method: "POST", path: `/api/issues/${issue.id}/${action}` });
    if (result.ok) toast.show(message, { variant: "success" });
    else toast.error(result.error ?? "操作失败");
  }
}

function CommentRow({
  ui,
  item,
  agents,
  members,
}: {
  ui: ReturnType<typeof useUi>;
  item: Comment;
  agents: Agent[];
  members: { id: string; name: string; avatar_url: string | null }[];
}) {
  const name =
    item.author_name ||
    (item.author_type === "agent"
      ? agents.find((agent) => agent.id === item.author_id)?.name
      : members.find((member) => member.id === item.author_id)?.name) ||
    (item.author_type === "agent" ? "智能体" : "成员");
  const avatarUrl =
    item.author_type === "agent"
      ? agents.find((agent) => agent.id === item.author_id)?.avatar_url ?? null
      : members.find((member) => member.id === item.author_id)?.avatar_url ?? null;
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 10, gap: 6 }}>
      <View style={[ui.s.row, { gap: 8 }]}>
        <Avatar ui={ui} name={name} url={avatarUrl} size={22} />
        <Text style={[ui.s.body, { fontWeight: "600" }]}>{name}</Text>
        <Text style={ui.s.tiny}>{relTime(item.created_at)}</Text>
        {item.resolved ? <Tag ui={ui} label="已解决" tone="success" /> : null}
      </View>
      <View style={{ paddingLeft: 30 }}>
        {item.content ? <Markdown>{item.content}</Markdown> : <Text style={[ui.s.tiny, { fontStyle: "italic" }]}>（空评论）</Text>}
      </View>
    </View>
  );
}
