import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Avatar, Btn, Chips, Empty, ErrorNote, Field, LoadingRow, LoadMore, nearBottom, useUi, type Ui } from "../bits";
import { asList, asRecord, num, str, usePagedQuery, useQuery } from "../api";
import { useWorkbench } from "../context";
import { priorityMeta, relTime, type Agent, type Issue, type IssueStatusEntry, type Project } from "../model";
import { IssueRow } from "../parts";
import { WORK_VIEWS } from "../Nav";
import { useWorkingAgents, type WorkingAgent } from "../Execution";

const VIEW_LABEL: Record<string, string> = {
  all: "全部任务",
  mine: "我的工作",
  active: "执行中",
  done: "已完成",
  closed: "已取消",
};

const BOARD: { key: string; label: string; icon: string; categories: string[]; status: string }[] = [
  { key: "backlog", label: "待规划", icon: "CircleDashed", categories: ["backlog"], status: "backlog" },
  { key: "todo", label: "待办", icon: "Circle", categories: ["todo", "unstarted"], status: "todo" },
  {
    key: "started",
    label: "进行中",
    icon: "CircleDot",
    categories: ["in_progress", "started", "blocked"],
    status: "in_progress",
  },
  {
    key: "review",
    label: "审核中",
    icon: "CircleCheck",
    categories: ["in_review", "review"],
    status: "in_review",
  },
  { key: "done", label: "已完成", icon: "CheckCheck", categories: ["done", "completed"], status: "done" },
  {
    key: "closed",
    label: "已取消",
    icon: "CircleSlash",
    categories: ["cancelled", "closed"],
    status: "cancelled",
  },
];

export function IssuesPage() {
  const ctx = useWorkbench();
  const { theme, compact, narrow, stacked, navCollapsed, api, statuses, bump, workspaceId, navigate, params, toast, invalidate, user } = ctx;
  const ui = useUi(theme, compact);
  const sidebarHidden = compact || stacked || navCollapsed;

  const view = params.view ?? "all";
  const projectId = params.project ?? null;
  const [mode, setMode] = useState<"board" | "list">(compact ? "list" : "board");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(params.create === "1");
  const [createStatus, setCreateStatus] = useState<string | undefined>();
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const listKey = `${workspaceId}:${bump}`;
  const workingAgents = useWorkingAgents(api, listKey);
  const request = useMemo(() => {
    const when: Record<string, string | number> = {
      sort: "updated_at",
      direction: "desc",
    };
    if (search) when.q = search;
    if (projectId) when.project_id = projectId;
    if (view === "mine" && user?.id) when.assignee_id = user.id;
    if (mode === "list") {
      if (view === "active") when.status_category = "started";
      if (view === "done") when.status_category = "done";
      if (view === "closed") when.status_category = "closed";
    }
    return when;
  }, [mode, search, projectId, view, user?.id]);

  const paged = usePagedQuery<Issue>(
    api,
    mode === "list" ? "/api/issues" : null,
    { query: request, pageSize: 25 },
    listKey,
    "issues",
  );
  const projects = useQuery(
    api,
    "/api/projects",
    { query: { limit: 50 }, select: (data) => asList<Project>(data, "projects") },
    listKey,
  );
  const agents = useQuery(
    api,
    "/api/agents",
    { query: { limit: 50 }, select: (data) => asList<Agent>(data, "agents") },
    listKey,
  );
  const members = useQuery(
    api,
    workspaceId ? `/api/workspaces/${workspaceId}/members` : null,
    { select: (data) => asList<Record<string, unknown>>(data, "members") },
    listKey,
  );

  const list = paged.items;
  const total = paged.total;
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

  const visibleColumns = useMemo(() => {
    if (view === "active") return BOARD.filter((column) => column.key === "started");
    if (view === "done") return BOARD.filter((column) => column.key === "done");
    if (view === "closed") return BOARD.filter((column) => column.key === "closed");
    return BOARD;
  }, [view]);

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
            minHeight: 48,
            paddingVertical: 8,
            flexWrap: "wrap",
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: ui.c.line,
            backgroundColor: ui.c.canvas,
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
                backgroundColor: ui.c.fill,
              },
            ]}
          >
            <Icon name="FolderKanban" size={11} color={ui.c.muted} />
            <Text style={{ fontSize: 12, color: ui.c.fg }}>{activeProject.title}</Text>
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
        {sidebarHidden ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="视图与项目筛选"
            onPress={() => setFilterOpen(true)}
            style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
              ui.s.row,
              {
                gap: 5,
                paddingHorizontal: 8,
                height: 30,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: ui.c.border,
                backgroundColor: hovered ? ui.c.fillHover : ui.c.card,
              },
              pressed && ui.s.pressed,
            ]}
          >
            <Icon name="SlidersHorizontal" size={13} color={ui.c.muted} />
            <Text style={{ fontSize: 12, color: ui.c.fg }}>{title}</Text>
            <Icon name="ChevronDown" size={12} color={ui.c.muted} />
          </Pressable>
        ) : null}
        <View
          style={[
            ui.s.row,
            {
              gap: 7,
              flex: 1,
              minWidth: compact ? 120 : 180,
              paddingHorizontal: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: ui.c.border,
              backgroundColor: ui.c.card,
              height: 32,
            },
          ]}
        >
          <Icon name="Search" size={14} color={ui.c.muted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="搜索任务…"
            placeholderTextColor={ui.c.faint}
            autoFocus={params.focus === "search"}
            style={{ flex: 1, color: ui.c.fg, fontSize: 13, paddingVertical: 5 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <View style={[ui.s.row, { gap: 2, padding: 2, borderRadius: 8, backgroundColor: ui.c.fill }]}>
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
                    backgroundColor: active ? ui.c.card : "transparent",
                    boxShadow: active ? ui.c.shadow : undefined,
                  },
                  pressed && ui.s.pressed,
                ]}
              >
                <Icon name={entry === "board" ? "Columns3" : "List"} size={13} color={active ? ui.c.fg : ui.c.muted} />
                <Text style={{ fontSize: 13, color: active ? ui.c.fg : ui.c.muted, fontWeight: active ? "500" : "400" }}>
                  {entry === "board" ? "看板" : "列表"}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Btn ui={ui} label="新建" icon="Plus" onPress={() => openCreate()} />
      </View>

      {mode === "list" && paged.loading && list.length === 0 ? (
        <LoadingRow ui={ui} />
      ) : mode === "list" && paged.error ? (
        <View style={{ padding: 16 }}>
          <ErrorNote ui={ui} message={paged.error} onRetry={paged.refresh} />
        </View>
      ) : mode === "list" && list.length === 0 ? (
        <Empty
          ui={ui}
          icon="Inbox"
          title={search || view !== "all" || projectId ? "没有匹配的任务" : "还没有任务"}
          description="调整筛选条件，或创建一条新任务。"
          action={<Btn ui={ui} label="新建任务" icon="Plus" tone="primary" onPress={() => openCreate()} />}
        />
      ) : mode === "board" ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ flexGrow: 1, gap: narrow ? 12 : 16, padding: compact || narrow ? 12 : 16 }}
        >
          {visibleColumns.map((column) => (
            <BoardColumn
              key={column.key}
              ui={ui}
              column={column}
              statuses={statuses}
              query={request}
              listKey={listKey}
              width={compact ? 232 : narrow ? 252 : 272}
              projectMap={projectMap}
              assigneeMap={assigneeMap}
              workingAgents={workingAgents}
              onOpen={(id) => navigate("issue", { id })}
              onCreate={openCreate}
            />
          ))}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: compact ? 12 : 16, paddingBottom: 40 }}
          onScroll={(e) => {
            if (nearBottom(e)) paged.loadMore();
          }}
          scrollEventThrottle={200}
        >
          <View>
            {list.map((issue) => (
              <IssueRow
                key={issue.id}
                ui={ui}
                issue={issue}
                statuses={statuses}
                running={workingAgents.get(issue.id)}
                onPress={() => navigate("issue", { id: issue.id })}
              />
            ))}
          </View>
          <LoadMore
            ui={ui}
            loaded={list.length}
            total={total}
            hasMore={paged.hasMore}
            loadingMore={paged.loadingMore}
            loading={paged.loading}
            onLoadMore={paged.loadMore}
          />
        </ScrollView>
      )}

      <Modal
        title="视图与项目"
        icon={<Icon name="SlidersHorizontal" size={16} color={ui.c.muted} />}
        open={filterOpen}
        onOpenChange={setFilterOpen}
      >
        <Modal.Content>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: 2 }}>
            <Text style={[ui.s.label, { paddingHorizontal: 8, paddingTop: 4 }]}>视图</Text>
            {WORK_VIEWS.map((entry) => {
              const active = view === entry.key && !projectId;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={entry.label}
                  key={entry.key}
                  onPress={() => { setFilterOpen(false); navigate("issues", { view: entry.key }); }}
                  style={({ pressed }) => [ui.s.menuItem, active && ui.s.hoverSurface, pressed && ui.s.pressed]}
                >
                  <Icon name={entry.icon} size={14} color={active ? ui.c.fg : ui.c.muted} />
                  <Text style={{ flex: 1, fontSize: 14, color: ui.c.fg, fontWeight: active ? "600" : "400" }}>{entry.label}</Text>
                  {active ? <Icon name="Check" size={14} color={ui.c.brand} /> : null}
                </Pressable>
              );
            })}
            <Text style={[ui.s.label, { paddingHorizontal: 8, paddingTop: 10 }]}>项目</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="全部项目"
              onPress={() => { setFilterOpen(false); navigate("issues", { view }); }}
              style={({ pressed }) => [ui.s.menuItem, !projectId && ui.s.hoverSurface, pressed && ui.s.pressed]}
            >
              <Icon name="Layers" size={14} color={ui.c.muted} />
              <Text style={{ flex: 1, fontSize: 14, color: ui.c.fg }}>全部项目</Text>
              {!projectId ? <Icon name="Check" size={14} color={ui.c.brand} /> : null}
            </Pressable>
            {(projects.data ?? []).map((project) => {
              const active = projectId === project.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={project.title}
                  key={project.id}
                  onPress={() => { setFilterOpen(false); navigate("issues", { view, project: project.id }); }}
                  style={({ pressed }) => [ui.s.menuItem, active && ui.s.hoverSurface, pressed && ui.s.pressed]}
                >
                  <Icon name="FolderKanban" size={14} color={active ? ui.c.fg : ui.c.muted} />
                  <Text numberOfLines={1} style={{ flex: 1, fontSize: 14, color: ui.c.fg, fontWeight: active ? "600" : "400" }}>
                    {project.title}
                  </Text>
                  {active ? <Icon name="Check" size={14} color={ui.c.brand} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </Modal.Content>
      </Modal>

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
  project,
  assignee,
  running,
  onPress,
}: {
  ui: ReturnType<typeof useUi>;
  issue: Issue;
  project?: Project;
  assignee?: { name: string; url?: string | null };
  running?: { name: string; avatar_url?: string | null };
  onPress(): void;
}) {
  const priority = priorityMeta(issue.priority);
  const priorityColor =
    priority.tone === "danger"
      ? ui.c.danger
      : priority.tone === "warning"
        ? ui.c.high
        : priority.tone === "accent"
          ? ui.c.brand
          : ui.c.muted;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${issue.identifier} ${issue.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingVertical: 12,
          paddingHorizontal: 10,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: running ? `${ui.c.success}66` : ui.c.border,
          backgroundColor: ui.c.card,
          boxShadow: ui.c.shadow,
        },
        pressed && ui.s.pressed,
      ]}
    >
      <View style={[ui.s.row, { gap: 6 }]}>
        {issue.priority && issue.priority !== "none" ? (
          <Icon name={priority.icon} size={14} color={priorityColor} />
        ) : null}
        <Text style={ui.s.idText}>{issue.identifier}</Text>
        {running ? (
          <View style={[ui.s.row, { gap: 4, marginLeft: "auto" }]}>
            <ActivityIndicator size="small" color={ui.c.success} />
            <Text style={{ fontSize: 11, fontWeight: "500", color: ui.c.success }}>运行中</Text>
          </View>
        ) : null}
      </View>
      <Text numberOfLines={2} style={{ fontSize: 14, lineHeight: 21, fontWeight: "500", color: ui.c.fg, marginTop: 4 }}>
        {issue.title}
      </Text>
      {project ? (
        <View style={[ui.s.row, { gap: 4, alignSelf: "flex-start", marginTop: 6 }]}>
          <Icon name="FolderKanban" size={11} color={ui.c.muted} />
          <Text numberOfLines={1} style={{ fontSize: 12, color: ui.c.muted }}>
            {project.title}
          </Text>
        </View>
      ) : null}
      <View style={[ui.s.row, { gap: 6, marginTop: 8 }]}>
        {assignee ? (
          <Avatar ui={ui} name={assignee.name} url={assignee.url} size={20} />
        ) : (
          <View style={{ width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: ui.c.border }} />
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

function BoardColumn({
  ui,
  column,
  statuses,
  query,
  listKey,
  width,
  projectMap,
  assigneeMap,
  workingAgents,
  onOpen,
  onCreate,
}: {
  ui: Ui;
  column: (typeof BOARD)[number];
  statuses: IssueStatusEntry[];
  query: Record<string, string | number>;
  listKey: string;
  width: number;
  projectMap: Map<string, Project>;
  assigneeMap: Map<string, { name: string; url?: string | null }>;
  workingAgents: Map<string, WorkingAgent>;
  onOpen(id: string): void;
  onCreate(status?: string): void;
}) {
  const { api } = useWorkbench();
  const cats = useMemo(() => {
    const present = new Set(statuses.map((status) => String(status.category ?? "")));
    const list = column.categories.filter((category) => present.has(category));
    return list.length > 0 ? list : [column.categories[0]];
  }, [statuses, column]);
  const primary = usePagedQuery<Issue>(
    api,
    "/api/issues",
    { query: { ...query, status_category: cats[0] }, pageSize: 20 },
    `${listKey}:col:${column.key}`,
    "issues",
  );
  const secondary = usePagedQuery<Issue>(
    api,
    cats[1] ? "/api/issues" : null,
    { query: { ...query, status_category: cats[1] }, pageSize: 20 },
    `${listKey}:col:${column.key}:2`,
    "issues",
  );
  const items = useMemo(
    () => [...primary.items, ...secondary.items].sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)),
    [primary.items, secondary.items],
  );
  const total = primary.total + secondary.total;
  const hasMore = primary.hasMore || secondary.hasMore;
  const loadMore = () => {
    primary.loadMore();
    secondary.loadMore();
  };
  const loading = primary.loading && items.length === 0;
  return (
    <View style={{ width, flexGrow: 1, borderRadius: 12, backgroundColor: `${ui.c.fill}66`, padding: 8 }}>
      <View style={[ui.s.row, { gap: 6, height: 28, paddingHorizontal: 6, marginBottom: 8 }]}>
        <Icon name={column.icon} size={12} color={ui.c.muted} />
        <Text style={{ fontSize: 13, fontWeight: "500", color: ui.c.fg }}>{column.label}</Text>
        <Text style={{ fontSize: 12, color: ui.c.muted }}>{total}</Text>
        <View style={ui.s.grow} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`新建${column.label}任务`}
          onPress={() => onCreate(column.status)}
          style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
        >
          <Icon name="Plus" size={14} color={ui.c.muted} />
        </Pressable>
      </View>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: 8, gap: 8 }}
        showsVerticalScrollIndicator={false}
        onScroll={(e) => {
          if (nearBottom(e, 160)) loadMore();
        }}
        scrollEventThrottle={200}
      >
        {loading ? (
          <View style={{ paddingVertical: 18, alignItems: "center" }}>
            <ActivityIndicator size="small" color={ui.c.muted} />
          </View>
        ) : items.length === 0 ? (
          <Text style={[ui.s.tiny, { textAlign: "center", paddingVertical: 26 }]}>无任务</Text>
        ) : (
          items.map((issue) => (
            <IssueCard
              key={issue.id}
              ui={ui}
              issue={issue}
              project={issue.project_id ? projectMap.get(issue.project_id) : undefined}
              assignee={issue.assignee_id ? assigneeMap.get(issue.assignee_id) : undefined}
              running={workingAgents.get(issue.id)}
              onPress={() => onOpen(issue.id)}
            />
          ))
        )}
        {hasMore ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`加载更多${column.label}任务`}
            onPress={loadMore}
            style={({ pressed }) => [
              ui.s.row,
              { justifyContent: "center", gap: 6, paddingVertical: 8, borderRadius: 8 },
              pressed && ui.s.pressed,
            ]}
          >
            {primary.loadingMore || secondary.loadingMore ? (
              <ActivityIndicator size="small" color={ui.c.muted} />
            ) : (
              <Icon name="ChevronDown" size={13} color={ui.c.muted} />
            )}
            <Text style={ui.s.tiny}>加载更多（{items.length}/{total}）</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}