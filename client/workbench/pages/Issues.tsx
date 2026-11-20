import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Avatar, Btn, Card, Chips, Divider, Empty, ErrorNote, Field, LoadingRow, useUi } from "../bits";
import { asList, asRecord, num, str, useQuery } from "../api";
import { useWorkbench } from "../context";
import { issueStatusColor, relTime, type Agent, type Issue, type IssueStatusEntry, type Project } from "../model";
import { IssueRow } from "../parts";

const VIEW_LABEL: Record<string, string> = {
  all: "全部任务",
  mine: "我的工作",
  active: "执行中",
  done: "已完成",
  closed: "已取消",
};

const BOARD: { key: string; label: string; icon: string; color: string; categories: string[]; status: string }[] = [
  { key: "backlog", label: "待规划", icon: "CircleDashed", color: "#9CA3AF", categories: ["backlog"], status: "backlog" },
  { key: "todo", label: "待办", icon: "Circle", color: "#9CA3AF", categories: ["todo", "unstarted"], status: "todo" },
  {
    key: "started",
    label: "进行中",
    icon: "CircleDot",
    color: "#F59E0B",
    categories: ["in_progress", "started", "blocked"],
    status: "in_progress",
  },
  {
    key: "review",
    label: "审核中",
    icon: "CircleCheck",
    color: "#22C55E",
    categories: ["in_review", "review"],
    status: "in_review",
  },
  { key: "done", label: "已完成", icon: "CheckCheck", color: "#16A34A", categories: ["done", "completed"], status: "done" },
  {
    key: "closed",
    label: "已取消",
    icon: "CircleSlash",
    color: "#9CA3AF",
    categories: ["cancelled", "closed"],
    status: "cancelled",
  },
];

function bucketOf(issue: Issue, statuses: IssueStatusEntry[]): string {
  const entry = statuses.find((status) => status.key === issue.status);
  const raw = String(issue.status_category ?? entry?.category ?? "unstarted");
  return BOARD.find((column) => column.categories.includes(raw))?.key ?? "todo";
}

export function IssuesPage() {
  const ctx = useWorkbench();
  const { theme, compact, api, statuses, bump, workspaceId, navigate, params, toast, invalidate, user } = ctx;
  const ui = useUi(theme, compact);

  const view = params.view ?? "all";
  const projectId = params.project ?? null;
  const [mode, setMode] = useState<"board" | "list">(compact ? "list" : "board");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(25);
  const [createOpen, setCreateOpen] = useState(params.create === "1");
  const [createStatus, setCreateStatus] = useState<string | undefined>();

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setLimit(25);
  }, [search, view, projectId]);

  const listKey = `${workspaceId}:${bump}`;
  const request = useMemo(() => {
    const when: Record<string, string | number> = {
      limit: mode === "board" ? 200 : limit,
      offset: 0,
      sort: "updated_at",
      direction: "desc",
    };
    if (search) when.q = search;
    if (projectId) when.project_id = projectId;
    if (view === "mine" && user?.id) when.assignee_id = user.id;
    if (view === "active") when.status_category = "started";
    if (view === "done") when.status_category = "done";
    if (view === "closed") when.status_category = "closed";
    return when;
  }, [limit, mode, search, projectId, view, user?.id]);

  const issues = useQuery(api, "/api/issues", { query: request }, listKey);
  const projects = useQuery(
    api,
    "/api/projects",
    { query: { limit: 100 }, select: (data) => asList<Project>(data, "projects") },
    listKey,
  );
  const agents = useQuery(
    api,
    "/api/agents",
    { query: { limit: 100 }, select: (data) => asList<Agent>(data, "agents") },
    listKey,
  );
  const members = useQuery(
    api,
    workspaceId ? `/api/workspaces/${workspaceId}/members` : null,
    { select: (data) => asList<Record<string, unknown>>(data, "members") },
    listKey,
  );

  const list = asList<Issue>(issues.data, "issues");
  const total = num(asRecord(issues.data).total, list.length);
  const projectMap = useMemo(
    () => new Map((projects.data ?? []).map((project) => [project.id, project])),
    [projects.data],
  );
  const assigneeMap = useMemo(() => {
    const map = new Map<string, { name: string; url?: string | null }>();
    for (const agent of agents.data ?? []) map.set(agent.id, { name: agent.name, url: agent.avatar_url });
    for (const raw of members.data ?? []) {
      const person = asRecord(raw.user);
      const id = str(person.id ?? raw.user_id ?? raw.id);
      if (id) map.set(id, { name: str(person.name ?? raw.name) || "成员", url: str(person.avatar_url) || null });
    }
    return map;
  }, [agents.data, members.data]);
  const activeProject = projectId ? projectMap.get(projectId) : null;
  const title = VIEW_LABEL[view] ?? "全部任务";

  const columns = useMemo(() => {
    const grouped: Record<string, Issue[]> = {};
    for (const issue of list) {
      const key = bucketOf(issue, statuses);
      (grouped[key] ??= []).push(issue);
    }
    return BOARD.map((column) => ({ ...column, items: grouped[column.key] ?? [] }));
  }, [list, statuses]);

  const openCreate = (status?: string) => {
    setCreateStatus(status);
    setCreateOpen(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <View
        style={[
          ui.s.row,
          {
            gap: 8,
            paddingHorizontal: compact ? 12 : 16,
            paddingVertical: 9,
            borderBottomWidth: 1,
            borderBottomColor: ui.c.border,
            backgroundColor: ui.c.surface1,
          },
        ]}
      >
        <Icon name="ListChecks" size={16} color={ui.c.muted} />
        <Text style={{ color: ui.c.fg, fontSize: 14, fontWeight: "600" }}>{title}</Text>
        {activeProject ? (
          <View
            style={[
              ui.s.row,
              {
                gap: 4,
                paddingHorizontal: 7,
                paddingVertical: 2,
                borderRadius: 6,
                backgroundColor: ui.c.surface2,
              },
            ]}
          >
            <Icon name="FolderKanban" size={11} color={ui.c.muted} />
            <Text style={{ fontSize: 11.5, color: ui.c.fg }}>{activeProject.title}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="清除项目筛选"
              onPress={() => navigate("issues", { view })}
            >
              <Icon name="X" size={11} color={ui.c.muted} />
            </Pressable>
          </View>
        ) : null}
        <Text style={ui.s.tiny}>共 {total} 条</Text>
        <View style={ui.s.grow} />

        <View
          style={[
            ui.s.row,
            {
              gap: 7,
              width: compact ? 140 : 220,
              paddingHorizontal: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: ui.c.border,
              backgroundColor: ui.c.surface0,
              minHeight: 30,
            },
          ]}
        >
          <Icon name="Search" size={13} color={ui.c.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="搜索任务…"
            placeholderTextColor={ui.c.muted}
            autoFocus={params.focus === "search"}
            style={{ flex: 1, color: ui.c.fg, fontSize: 12.5, paddingVertical: 5 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={[ui.s.row, { gap: 2, padding: 2, borderRadius: 8, backgroundColor: ui.c.surface2 }]}>
          {(["board", "list"] as const).map((entry) => {
            const active = mode === entry;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={entry === "board" ? "看板视图" : "列表视图"}
                accessibilityState={{ selected: active }}
                key={entry}
                onPress={() => setMode(entry)}
                style={({ pressed }) => [
                  ui.s.row,
                  {
                    gap: 5,
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                    backgroundColor: active ? ui.c.surface1 : "transparent",
                  },
                  pressed && ui.s.pressed,
                ]}
              >
                <Icon name={entry === "board" ? "Columns3" : "List"} size={13} color={active ? ui.c.fg : ui.c.muted} />
                <Text style={{ fontSize: 12, color: active ? ui.c.fg : ui.c.muted, fontWeight: active ? "600" : "400" }}>
                  {entry === "board" ? "看板" : "列表"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Btn ui={ui} label="新建" icon="Plus" tone="primary" onPress={() => openCreate()} />
      </View>

      {issues.loading && list.length === 0 ? (
        <LoadingRow ui={ui} />
      ) : issues.error ? (
        <View style={{ padding: 16 }}>
          <ErrorNote ui={ui} message={issues.error} onRetry={issues.refresh} />
        </View>
      ) : list.length === 0 ? (
        <Empty
          ui={ui}
          icon="Inbox"
          title={search || view !== "all" || projectId ? "没有匹配的任务" : "还没有任务"}
          description="调整筛选条件，或创建一条新任务。"
          action={<Btn ui={ui} label="新建任务" icon="Plus" tone="primary" onPress={() => openCreate()} />}
        />
      ) : mode === "board" ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1 }}>
          {columns.map((column, index) => (
            <View
              key={column.key}
              style={{
                width: compact ? 230 : 268,
                flexGrow: 1,
                borderRightWidth: index === columns.length - 1 ? 0 : 1,
                borderRightColor: ui.c.border,
              }}
            >
              <View style={[ui.s.row, { gap: 6, paddingHorizontal: 12, paddingVertical: 9 }]}>
                <Icon name={column.icon} size={14} color={column.color} />
                <Text style={{ fontSize: 13, fontWeight: "600", color: ui.c.fg }}>{column.label}</Text>
                <Text style={{ fontSize: 12, color: ui.c.muted }}>{column.items.length}</Text>
                <View style={ui.s.grow} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`新建${column.label}任务`}
                  onPress={() => openCreate(column.status)}
                  style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
                >
                  <Icon name="Plus" size={14} color={ui.c.muted} />
                </Pressable>
              </View>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 24, gap: 8 }}>
                {column.items.length === 0 ? (
                  <Text style={[ui.s.tiny, { textAlign: "center", paddingVertical: 26 }]}>无任务</Text>
                ) : (
                  column.items.map((issue) => (
                    <IssueCard
                      key={issue.id}
                      ui={ui}
                      issue={issue}
                      statuses={statuses}
                      project={issue.project_id ? projectMap.get(issue.project_id) : undefined}
                      assignee={issue.assignee_id ? assigneeMap.get(issue.assignee_id) : undefined}
                      onPress={() => navigate("issue", { id: issue.id })}
                    />
                  ))
                )}
              </ScrollView>
            </View>
          ))}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: compact ? 12 : 16, paddingBottom: 40 }}>
          <Card ui={ui} padded={false}>
            <View style={{ paddingBottom: 6 }}>
              {list.map((issue, index) => (
                <View key={issue.id}>
                  {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 14 }} /> : null}
                  <IssueRow
                    ui={ui}
                    issue={issue}
                    statuses={statuses}
                    onPress={() => navigate("issue", { id: issue.id })}
                  />
                </View>
              ))}
            </View>
          </Card>
          {list.length < total ? (
            <View style={{ alignItems: "center", marginTop: 12 }}>
              <Btn
                ui={ui}
                label={issues.loading ? "加载中…" : `加载更多（已显示 ${list.length}/${total}）`}
                icon="ChevronDown"
                busy={issues.loading}
                onPress={() => setLimit((value) => value + 25)}
              />
            </View>
          ) : null}
        </ScrollView>
      )}

      <CreateIssueModal
        open={createOpen}
        projectId={projectId}
        initialStatus={createStatus}
        onClose={() => setCreateOpen(false)}
        onCreated={(issue) => {
          setCreateOpen(false);
          invalidate();
          if (issue?.id) navigate("issue", { id: issue.id });
        }}
        toast={toast}
      />
    </View>
  );
}

function IssueCard({
  ui,
  issue,
  statuses,
  project,
  assignee,
  onPress,
}: {
  ui: ReturnType<typeof useUi>;
  issue: Issue;
  statuses: IssueStatusEntry[];
  project?: Project;
  assignee?: { name: string; url?: string | null };
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${issue.identifier} ${issue.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        {
          gap: 6,
          padding: 10,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: ui.c.border,
          backgroundColor: ui.c.surface1,
        },
        pressed && ui.s.pressed,
      ]}
    >
      <View style={[ui.s.row, { gap: 6 }]}>
        <Text style={{ fontSize: 11, color: ui.c.muted, fontFamily: "Menlo" }}>{issue.identifier}</Text>
        <View style={ui.s.grow} />
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: issueStatusColor(issue, statuses) }} />
      </View>
      <Text numberOfLines={2} style={{ fontSize: 13.5, lineHeight: 19, fontWeight: "600", color: ui.c.fg }}>
        {issue.title}
      </Text>
      {project ? (
        <View style={[ui.s.row, { gap: 4, alignSelf: "flex-start" }]}>
          <Icon name="FolderKanban" size={11} color={ui.c.muted} />
          <Text numberOfLines={1} style={{ fontSize: 11.5, color: ui.c.muted }}>
            {project.title}
          </Text>
        </View>
      ) : null}
      <View style={[ui.s.row, { gap: 6, marginTop: 1 }]}>
        {assignee ? (
          <Avatar ui={ui} name={assignee.name} url={assignee.url} size={16} />
        ) : (
          <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 1, borderColor: ui.c.border }} />
        )}
        <Text numberOfLines={1} style={[ui.s.tiny, { flex: 1 }]}>
          {assignee?.name ?? "未指派"}
        </Text>
        <Text style={ui.s.tiny}>{relTime(issue.updated_at)}</Text>
      </View>
    </Pressable>
  );
}

function CreateIssueModal({
  open,
  projectId,
  initialStatus,
  onClose,
  onCreated,
  toast,
}: {
  open: boolean;
  projectId?: string | null;
  initialStatus?: string;
  onClose(): void;
  onCreated(issue: Issue | null): void;
  toast: ReturnType<typeof useWorkbench>["toast"];
}) {
  const { theme, compact, api, statuses } = useWorkbench();
  const ui = useUi(theme, compact);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("none");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setPriority("none");
    setStatus(initialStatus ?? statuses[0]?.key ?? "todo");
  }, [open, statuses, initialStatus]);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("请填写任务标题");
      return;
    }
    setBusy(true);
    const body: Record<string, unknown> = { title: title.trim(), priority };
    if (description.trim()) body.description = description.trim();
    if (status) body.status = status;
    if (projectId) body.project_id = projectId;
    const result = await api({ method: "POST", path: "/api/issues", body });
    setBusy(false);
    if (result.ok) {
      toast.show("任务已创建", { variant: "success" });
      const created = result.data && typeof result.data === "object" ? (result.data as Issue) : null;
      onCreated(created);
    } else {
      toast.error(result.error ?? "创建失败");
    }
  };

  return (
    <Modal
      title="新建任务"
      icon={<Icon name="Plus" size={16} color={ui.c.muted} />}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Content>
        <View style={{ gap: 12 }}>
          <Field ui={ui} label="标题" value={title} onChangeText={setTitle} placeholder="用一句话描述要做的事" autoFocus />
          <Field
            ui={ui}
            label="描述"
            value={description}
            onChangeText={setDescription}
            placeholder="补充背景、验收标准…（支持 Markdown）"
            multiline
          />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>状态</Text>
            <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
              {(statuses.length > 0 ? statuses : [{ key: "todo", name: "待办", color: "#8b8b93", id: "todo", category: "unstarted" }]).map((entry) => {
                const active = entry.key === status;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={entry.id}
                    onPress={() => setStatus(entry.key)}
                    style={({ pressed }) => [
                      ui.s.chip,
                      active && { borderColor: entry.color, backgroundColor: `${entry.color}22` },
                      pressed && ui.s.pressed,
                    ]}
                  >
                    <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: entry.color }} />
                    <Text style={[ui.s.chipText, active && { color: entry.color, fontWeight: "700" }]}>
                      {entry.name}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>优先级</Text>
            <Chips
              ui={ui}
              options={[
                { value: "none", label: "无" },
                { value: "low", label: "低" },
                { value: "medium", label: "中" },
                { value: "high", label: "高" },
                { value: "urgent", label: "紧急" },
              ]}
              value={priority}
              onChange={setPriority}
            />
          </View>
          <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8, paddingTop: 4 }]}>
            <Btn ui={ui} label="取消" onPress={onClose} />
            <Btn ui={ui} label="创建任务" icon="Check" tone="primary" busy={busy} onPress={() => void submit()} />
          </View>
        </View>
      </Modal.Content>
    </Modal>
  );
}