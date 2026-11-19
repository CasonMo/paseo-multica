import { Icon, Markdown, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Avatar, Btn, Card, Chips, Divider, Empty, ErrorNote, Field, IconBtn, LoadingRow, Tag, useUi } from "../bits";
import { asList, useQuery } from "../api";
import { useWorkbench } from "../context";
import { priorityMeta, projectStatusMeta, relTime, type Issue, type Project } from "../model";
import { IssueRow } from "../parts";

type StatusFilter = "all" | "planned" | "in_progress" | "paused" | "completed" | "cancelled" | "archived";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "planned", label: "规划中" },
  { value: "in_progress", label: "进行中" },
  { value: "paused", label: "已暂停" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
  { value: "archived", label: "已归档" },
];

const EDIT_STATUS: { value: string; label: string }[] = [
  { value: "planned", label: "规划中" },
  { value: "in_progress", label: "进行中" },
  { value: "paused", label: "已暂停" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" },
];

const EDIT_PRIORITY: { value: string; label: string }[] = [
  { value: "none", label: "无" },
  { value: "low", label: "低" },
  { value: "medium", label: "中" },
  { value: "high", label: "高" },
  { value: "urgent", label: "紧急" },
];

export function ProjectsPage() {
  const ctx = useWorkbench();
  const { theme, compact, api, statuses, bump, workspaceId, navigate, toast, invalidate } = ctx;
  const ui = useUi(theme, compact);
  const key = `${workspaceId}:${bump}`;

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [busy, setBusy] = useState(false);

  const projectsQuery = useQuery(
    api,
    "/api/projects",
    { query: { include_archived: true }, select: (data) => asList<Project>(data, "projects") },
    key,
  );
  const membersQuery = useQuery(
    api,
    workspaceId ? `/api/workspaces/${workspaceId}/members` : null,
    { select: (data) => asList<Record<string, unknown>>(data, "members") },
    key,
  );
  const list = projectsQuery.data ?? [];
  const archivedCount = list.filter((project) => project.archived_at).length;
  const members = useMemo(
    () =>
      (membersQuery.data ?? []).map((item) => ({
        id: String(item.id ?? ""),
        userId: String(item.user_id ?? ""),
        name: String(item.name ?? item.email ?? "成员"),
        email: String(item.email ?? ""),
        avatarUrl: (item.avatar_url as string | null) ?? null,
        role: String(item.role ?? ""),
      })),
    [membersQuery.data],
  );
  const active = list.find((project) => project.id === activeId) ?? null;
  const needle = search.trim().toLowerCase();

  const filtered = useMemo(
    () =>
      list.filter((project) => {
        if (status === "archived") {
          if (!project.archived_at) return false;
        } else {
          if (project.archived_at) return false;
          if (status !== "all" && (project.status ?? "planned") !== status) return false;
        }
        if (!needle) return true;
        return `${project.title} ${project.description ?? ""}`.toLowerCase().includes(needle);
      }),
    [list, needle, status],
  );

  const issuesQuery = useQuery(
    api,
    activeId ? "/api/issues" : null,
    { query: { project_id: activeId ?? "", limit: 20, sort: "updated_at", direction: "desc" } },
    `${key}:${activeId ?? ""}`,
  );
  const projectIssues = asList<Issue>(issuesQuery.data, "issues");

  const leadOf = (project: Project) =>
    members.find((member) => member.id === project.lead_id || member.userId === project.lead_id) ?? null;

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (project: Project) => {
    setEditing(project);
    setFormOpen(true);
  };

  const archive = async (project: Project) => {
    setBusy(true);
    const result = await api({ method: "POST", path: `/api/projects/${project.id}/archive` });
    setBusy(false);
    if (result.ok) {
      toast.show("项目已归档", { variant: "success" });
      projectsQuery.refresh();
      invalidate();
    } else toast.error(result.error ?? "归档失败");
  };

  const restore = async (project: Project) => {
    setBusy(true);
    const result = await api({ method: "POST", path: `/api/projects/${project.id}/restore` });
    setBusy(false);
    if (result.ok) {
      toast.show("项目已取消归档", { variant: "success" });
      setActiveId(null);
      projectsQuery.refresh();
      invalidate();
    } else toast.error(result.error ?? "取消归档失败");
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    const result = await api({ method: "DELETE", path: `/api/projects/${confirmDelete.id}` });
    setBusy(false);
    if (result.ok) {
      toast.show("项目已删除", { variant: "success" });
      setConfirmDelete(null);
      setActiveId(null);
      projectsQuery.refresh();
      invalidate();
    } else toast.error(result.error ?? "删除失败");
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: compact ? 12 : 18, gap: 12, paddingBottom: 48 }}>
        <View style={[ui.s.row, { gap: 10 }]}>
          <View style={ui.s.grow}>
            <Text style={[ui.s.title, { fontSize: compact ? 18 : 21 }]}>项目</Text>
            <Text style={ui.s.muted}>
              共 {list.length - archivedCount} 个项目
              {archivedCount > 0 ? ` · 已归档 ${archivedCount}` : ""} · 跟踪交付进度与关联需求
            </Text>
          </View>
          <Btn ui={ui} label="新建" icon="Plus" tone="primary" onPress={openCreate} />
        </View>

        <View
          style={[
            ui.s.row,
            {
              gap: 7,
              paddingHorizontal: 11,
              borderRadius: 9,
              borderWidth: 1,
              borderColor: ui.c.border,
              backgroundColor: ui.c.surface1,
              minHeight: 38,
            },
          ]}
        >
          <Icon name="Search" size={15} color={ui.c.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="搜索项目名称或描述…"
            placeholderTextColor={ui.c.muted}
            style={{ flex: 1, color: ui.c.fg, fontSize: 13, paddingVertical: 8 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="清空搜索"
              onPress={() => setSearch("")}
              style={({ pressed }) => pressed && ui.s.pressed}
            >
              <Icon name="X" size={14} color={ui.c.muted} />
            </Pressable>
          ) : null}
        </View>

        <Chips<StatusFilter> ui={ui} options={STATUS_OPTIONS} value={status} onChange={setStatus} />

        {projectsQuery.loading && list.length === 0 ? (
          <Card ui={ui}>
            <LoadingRow ui={ui} />
          </Card>
        ) : projectsQuery.error ? (
          <Card ui={ui}>
            <ErrorNote ui={ui} message={projectsQuery.error} onRetry={projectsQuery.refresh} />
          </Card>
        ) : filtered.length === 0 ? (
          <Card ui={ui}>
            <Empty
              ui={ui}
              icon="FolderKanban"
              title={needle || status !== "all" ? "没有匹配的项目" : "还没有项目"}
              description="项目把需求、进度与负责人聚在一起，便于按里程碑推进。"
              action={<Btn ui={ui} label="新建项目" icon="Plus" tone="primary" onPress={openCreate} />}
            />
          </Card>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {filtered.map((project) => (
              <ProjectCard
                key={project.id}
                ui={ui}
                project={project}
                lead={leadOf(project)}
                compact={compact}
                onPress={() => setActiveId(project.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <Modal
        title={active ? active.title : "项目详情"}
        icon={<Icon name="FolderKanban" size={16} color={ui.c.muted} />}
        open={Boolean(active)}
        onOpenChange={(next) => {
          if (!next) setActiveId(null);
        }}
      >
        <Modal.Content>
          {active ? (
            <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 12 }}>
              <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
                <Tag ui={ui} label={projectStatusMeta(active.status).label} tone={projectStatusMeta(active.status).tone} />
                {active.archived_at ? <Tag ui={ui} label="已归档" tone="danger" /> : null}
                {active.priority && active.priority !== "none" ? (
                  <Tag ui={ui} label={priorityMeta(active.priority).label} tone={priorityMeta(active.priority).tone} />
                ) : null}
                <View style={ui.s.grow} />
                <IconBtn ui={ui} icon="Pencil" label="编辑项目" onPress={() => openEdit(active)} />
                {active.archived_at ? (
                  <IconBtn ui={ui} icon="ArchiveRestore" label="取消归档" busy={busy} onPress={() => void restore(active)} />
                ) : (
                  <IconBtn ui={ui} icon="Archive" label="归档项目" busy={busy} onPress={() => void archive(active)} />
                )}
                <IconBtn ui={ui} icon="Trash2" label="删除项目" color={ui.c.danger} onPress={() => setConfirmDelete(active)} />
              </View>

              <View style={{ gap: 6 }}>
                <Progress value={active.done_count ?? 0} total={active.issue_count ?? 0} ui={ui} />
                <View style={[ui.s.row, { gap: 12, flexWrap: "wrap" }]}>
                  <Text style={ui.s.tiny}>需求 {active.issue_count ?? 0} 条</Text>
                  <Text style={ui.s.tiny}>已完成 {active.done_count ?? 0} 条</Text>
                  {active.due_date ? <Text style={ui.s.tiny}>截止 {active.due_date}</Text> : null}
                  <Text style={ui.s.tiny}>更新 {relTime(active.updated_at)}</Text>
                </View>
              </View>

              {leadOf(active) ? (
                <View style={[ui.s.row, { gap: 8 }]}>
                  <Avatar ui={ui} name={leadOf(active)!.name} url={leadOf(active)!.avatarUrl} size={26} />
                  <View style={{ flex: 1 }}>
                    <Text style={ui.s.body}>{leadOf(active)!.name}</Text>
                    <Text style={ui.s.tiny}>项目负责人</Text>
                  </View>
                </View>
              ) : null}

              {active.description ? (
                <Card ui={ui}>
                  <Markdown>{active.description}</Markdown>
                </Card>
              ) : (
                <Text style={[ui.s.muted, { fontStyle: "italic" }]}>暂无项目描述</Text>
              )}

              {members.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <Text style={ui.s.label}>工作区成员</Text>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    {members.map((member) => (
                      <View
                        key={member.id}
                        style={[ui.s.row, { gap: 6, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 999, backgroundColor: ui.c.surface2 }]}
                      >
                        <Avatar ui={ui} name={member.name} url={member.avatarUrl} size={18} />
                        <Text style={ui.s.tiny}>{member.name}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              <View style={{ gap: 6 }}>
                <Text style={ui.s.label}>关联需求</Text>
                <Card ui={ui} padded={false}>
                  {issuesQuery.loading && projectIssues.length === 0 ? (
                    <LoadingRow ui={ui} />
                  ) : projectIssues.length === 0 ? (
                    <Empty ui={ui} icon="ListTodo" title="还没有关联需求" description="新建需求时选择该项目，或把已有需求移入。" />
                  ) : (
                    <View style={{ paddingBottom: 4 }}>
                      {projectIssues.map((issue, index) => (
                        <View key={issue.id}>
                          {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 12 }} /> : null}
                          <IssueRow
                            ui={ui}
                            issue={issue}
                            statuses={statuses}
                            onPress={() => {
                              setActiveId(null);
                              navigate("issue", { id: issue.id });
                            }}
                          />
                        </View>
                      ))}
                    </View>
                  )}
                </Card>
                <Btn
                  ui={ui}
                  label="查看全部需求"
                  icon="ArrowRight"
                  onPress={() => {
                    setActiveId(null);
                    navigate("issues", { project: active.id });
                  }}
                />
              </View>
            </ScrollView>
          ) : null}
        </Modal.Content>
      </Modal>

      <ProjectFormModal
        open={formOpen}
        project={editing}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          setFormOpen(false);
          projectsQuery.refresh();
          invalidate();
          if (saved?.id) setActiveId(saved.id);
        }}
        toast={toast}
      />

      <Modal
        title="删除项目"
        icon={<Icon name="TriangleAlert" size={16} color={ui.c.danger} />}
        open={Boolean(confirmDelete)}
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(null);
        }}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>确定删除「{confirmDelete?.title}」？项目下的需求不会被删除，但会解除关联。</Text>
            <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8 }]}>
              <Btn ui={ui} label="取消" onPress={() => setConfirmDelete(null)} />
              <Btn ui={ui} label="删除" tone="danger" busy={busy} onPress={() => void remove()} />
            </View>
          </View>
        </Modal.Content>
      </Modal>
    </View>
  );
}

function ProjectCard({
  ui,
  project,
  lead,
  compact,
  onPress,
}: {
  ui: ReturnType<typeof useUi>;
  project: Project;
  lead: { name: string; avatarUrl: string | null } | null;
  compact: boolean;
  onPress(): void;
}) {
  const meta = projectStatusMeta(project.status);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`打开项目 ${project.title}`}
      onPress={onPress}
      style={({ pressed }) => [
        ui.s.card,
        {
          padding: compact ? 12 : 14,
          gap: 10,
          width: compact ? "100%" : 268,
          flexGrow: 1,
          flexBasis: compact ? undefined : 268,
          maxWidth: compact ? undefined : 420,
        },
        pressed && ui.s.pressed,
      ]}
    >
      <View style={[ui.s.rowTop, { gap: 10 }]}>
        <View
          style={{
            width: 34,
            height: 34,
            borderRadius: 9,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: `${ui.c.accent}1f`,
          }}
        >
          <Icon name="FolderKanban" size={17} color={ui.c.accent} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text numberOfLines={2} style={[ui.s.body, { fontWeight: "700" }]}>
            {project.title}
          </Text>
          <Text style={ui.s.tiny}>
            {project.archived_at ? "已归档" : meta.label}
            {project.due_date ? ` · 截止 ${project.due_date}` : ""}
          </Text>
        </View>
      </View>
      {project.description ? (
        <Text numberOfLines={2} style={ui.s.muted}>
          {plainText(project.description)}
        </Text>
      ) : null}
      <Progress value={project.done_count ?? 0} total={project.issue_count ?? 0} ui={ui} />
      <View style={[ui.s.row, { justifyContent: "space-between" }]}>
        {lead ? (
          <View style={[ui.s.row, { gap: 5 }]}>
            <Avatar ui={ui} name={lead.name} url={lead.avatarUrl} size={18} />
            <Text style={ui.s.tiny}>{lead.name}</Text>
          </View>
        ) : (
          <Text style={ui.s.tiny}>未指派负责人</Text>
        )}
        <Text style={ui.s.tiny}>
          {project.done_count ?? 0}/{project.issue_count ?? 0} 需求
        </Text>
      </View>
    </Pressable>
  );
}

function Progress({ ui, value, total }: { ui: ReturnType<typeof useUi>; value: number; total: number }) {
  const ratio = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={{ height: 6, borderRadius: 3, backgroundColor: ui.c.surface2, overflow: "hidden" }}>
      <View
        style={{
          width: `${Math.round(ratio * 100)}%`,
          height: "100%",
          borderRadius: 3,
          backgroundColor: ratio >= 1 && total > 0 ? ui.c.success : ui.c.accent,
        }}
      />
    </View>
  );
}

function plainText(value: string): string {
  return value
    .replace(/```[\s\S]*?```/g, "")
    .replace(/[#>*_`~-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ProjectFormModal({
  open,
  project,
  onClose,
  onSaved,
  toast,
}: {
  open: boolean;
  project: Project | null;
  onClose(): void;
  onSaved(project: Project | null): void;
  toast: ReturnType<typeof useWorkbench>["toast"];
}) {
  const { theme, compact, api } = useWorkbench();
  const ui = useUi(theme, compact);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("planned");
  const [priority, setPriority] = useState("none");
  const [dueDate, setDueDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(project?.title ?? "");
    setDescription(project?.description ?? "");
    setStatus(project?.status ?? "planned");
    setPriority(project?.priority ?? "none");
    setDueDate(project?.due_date ?? "");
    setStartDate(project?.start_date ?? "");
  }, [open, project]);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("请填写项目名称");
      return;
    }
    setBusy(true);
    const body: Record<string, unknown> = {
      title: title.trim(),
      description: description.trim() || null,
      status,
      priority,
      start_date: startDate.trim() || null,
      due_date: dueDate.trim() || null,
    };
    const result = project
      ? await api({ method: "PUT", path: `/api/projects/${project.id}`, body })
      : await api({ method: "POST", path: "/api/projects", body });
    setBusy(false);
    if (result.ok) {
      toast.show(project ? "项目已更新" : "项目已创建", { variant: "success" });
      const saved = result.data && typeof result.data === "object" ? (result.data as Project) : null;
      onSaved(saved);
    } else toast.error(result.error ?? "保存失败");
  };

  return (
    <Modal
      title={project ? "编辑项目" : "新建项目"}
      icon={<Icon name={project ? "Pencil" : "FolderKanban"} size={16} color={ui.c.muted} />}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Content>
        <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 12 }}>
          <Field ui={ui} label="项目名称" value={title} onChangeText={setTitle} placeholder="例如：Q4 增长实验" autoFocus />
          <Field
            ui={ui}
            label="描述"
            value={description}
            onChangeText={setDescription}
            placeholder="目标、范围、里程碑…（支持 Markdown）"
            multiline
          />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>状态</Text>
            <Chips ui={ui} options={EDIT_STATUS} value={status} onChange={setStatus} />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>优先级</Text>
            <Chips ui={ui} options={EDIT_PRIORITY} value={priority} onChange={setPriority} />
          </View>
          <View style={[ui.s.row, { gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Field ui={ui} label="开始日期" value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
            </View>
            <View style={{ flex: 1 }}>
              <Field ui={ui} label="截止日期" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
            </View>
          </View>
          <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8, paddingTop: 4 }]}>
            <Btn ui={ui} label="取消" onPress={onClose} />
            <Btn ui={ui} label={project ? "保存" : "创建项目"} icon="Check" tone="primary" busy={busy} onPress={() => void submit()} />
          </View>
        </ScrollView>
      </Modal.Content>
    </Modal>
  );
}
