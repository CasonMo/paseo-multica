import { t } from "../i18n";
import { Icon, Markdown, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Avatar, Btn, Card, Chips, Divider, Empty, ErrorNote, Field, IconBtn, LoadingRow, LoadMore, nearBottom, Tag, useUi } from "../bits";
import { asList, usePagedQuery, useQuery } from "../api";
import { useWorkbench } from "../context";
import { priorityMeta, projectStatusMeta, relTime, type Issue, type Project } from "../model";
import { IssueRow } from "../parts";

type StatusFilter = "all" | "planned" | "in_progress" | "paused" | "completed" | "cancelled" | "archived";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "ApiExplorer.4" },
  { value: "planned", label: "model.1" },
  { value: "in_progress", label: "Execution.60" },
  { value: "paused", label: "Nav.43" },
  { value: "completed", label: "AgentDetail.6" },
  { value: "cancelled", label: "AgentDetail.9" },
  { value: "archived", label: "AgentDetail.28" },
];

const EDIT_STATUS: { value: string; label: string }[] = [
  { value: "planned", label: "model.1" },
  { value: "in_progress", label: "Execution.60" },
  { value: "paused", label: "Nav.43" },
  { value: "completed", label: "AgentDetail.6" },
  { value: "cancelled", label: "AgentDetail.9" },
];

const EDIT_PRIORITY: { value: string; label: string }[] = [
  { value: "none", label: "model.20" },
  { value: "low", label: "model.19" },
  { value: "medium", label: "model.18" },
  { value: "high", label: "model.17" },
  { value: "urgent", label: "model.16" },
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

  const projectsQuery = usePagedQuery<Project>(
    api,
    "/api/projects",
    { query: { include_archived: true }, pageSize: 30 },
    key,
    "projects",
  );
  const membersQuery = useQuery(
    api,
    workspaceId ? `/api/workspaces/${workspaceId}/members` : null,
    { select: (data) => asList<Record<string, unknown>>(data, "members") },
    key,
  );
  const list = projectsQuery.items;
  const archivedCount = list.filter((project) => project.archived_at).length;
  const members = useMemo(
    () =>
      (membersQuery.data ?? []).map((item) => ({
        id: String(item.id ?? ""),
        userId: String(item.user_id ?? ""),
        name: String(item.name ?? item.email ?? t("Execution.11")),
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

  const issuesQuery = usePagedQuery<Issue>(
    api,
    activeId ? "/api/issues" : null,
    { query: { project_id: activeId ?? "", sort: "updated_at", direction: "desc" }, pageSize: 20 },
    `${key}:${activeId ?? ""}`,
    "issues",
  );
  const projectIssues = issuesQuery.items;

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
      toast.show(t("Projects.19"), { variant: "success" });
      projectsQuery.refresh();
      invalidate();
    } else toast.error(result.error ?? t("AgentDetail.20"));
  };

  const restore = async (project: Project) => {
    setBusy(true);
    const result = await api({ method: "POST", path: `/api/projects/${project.id}/restore` });
    setBusy(false);
    if (result.ok) {
      toast.show(t("Projects.21"), { variant: "success" });
      setActiveId(null);
      projectsQuery.refresh();
      invalidate();
    } else toast.error(result.error ?? t("Projects.22"));
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    const result = await api({ method: "DELETE", path: `/api/projects/${confirmDelete.id}` });
    setBusy(false);
    if (result.ok) {
      toast.show(t("Projects.23"), { variant: "success" });
      setConfirmDelete(null);
      setActiveId(null);
      projectsQuery.refresh();
      invalidate();
    } else toast.error(result.error ?? t("Automation.15"));
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: compact ? 12 : 18, gap: 12, paddingBottom: 48 }}
        onScroll={(e) => {
          if (nearBottom(e)) projectsQuery.loadMore();
        }}
        scrollEventThrottle={200}
      >
        <View style={[ui.s.row, { gap: 10 }]}>
          <View style={ui.s.grow}>
            <Text style={[ui.s.title, { fontSize: compact ? 18 : 21 }]}>{t("Nav.3")}</Text>
            <Text style={ui.s.muted}>
              {t("Inbox.40")} {list.length - archivedCount} {t("Projects.27")}
              {archivedCount > 0 ? t("Projects.28", { a: archivedCount }) : ""} {t("Projects.29")}
            </Text>
          </View>
          <Btn ui={ui} label={t("Nav.10")} icon="Plus" tone="primary" onPress={openCreate} />
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
            placeholder={t("Projects.31")}
            placeholderTextColor={ui.c.muted}
            style={{ flex: 1, color: ui.c.fg, fontSize: 13, paddingVertical: 8 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ApiExplorer.3")}
              onPress={() => setSearch("")}
              style={({ pressed }) => pressed && ui.s.pressed}
            >
              <Icon name="X" size={14} color={ui.c.muted} />
            </Pressable>
          ) : null}
        </View>

        <Chips<StatusFilter> ui={ui} options={STATUS_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))} value={status} onChange={setStatus} />

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
              title={needle || status !== "all" ? t("Projects.33") : t("Projects.34")}
              description={t("Projects.35")}
              action={<Btn ui={ui} label={t("Nav.34")} icon="Plus" tone="primary" onPress={openCreate} />}
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
        <LoadMore
          ui={ui}
          loaded={list.length}
          total={projectsQuery.total}
          hasMore={projectsQuery.hasMore}
          loadingMore={projectsQuery.loadingMore}
          loading={projectsQuery.loading}
          onLoadMore={projectsQuery.loadMore}
        />
      </ScrollView>

      <Modal
        title={active ? active.title : t("Projects.37")}
        icon={<Icon name="FolderKanban" size={16} color={ui.c.muted} />}
        open={Boolean(active)}
        onOpenChange={(next) => {
          if (!next) setActiveId(null);
        }}
      >
        <Modal.Content>
          {active ? (
            <ScrollView
              style={{ maxHeight: 520 }}
              contentContainerStyle={{ gap: 12 }}
              onScroll={(e) => {
                if (nearBottom(e, 120)) issuesQuery.loadMore();
              }}
              scrollEventThrottle={200}
            >
              <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
                <Tag ui={ui} label={projectStatusMeta(active.status).label} tone={projectStatusMeta(active.status).tone} />
                {active.archived_at ? <Tag ui={ui} label={t("AgentDetail.28")} tone="danger" /> : null}
                {active.priority && active.priority !== "none" ? (
                  <Tag ui={ui} label={priorityMeta(active.priority).label} tone={priorityMeta(active.priority).tone} />
                ) : null}
                <View style={ui.s.grow} />
                <IconBtn ui={ui} icon="Pencil" label={t("Projects.39")} onPress={() => openEdit(active)} />
                {active.archived_at ? (
                  <IconBtn ui={ui} icon="ArchiveRestore" label={t("Inbox.35")} busy={busy} onPress={() => void restore(active)} />
                ) : (
                  <IconBtn ui={ui} icon="Archive" label={t("Projects.41")} busy={busy} onPress={() => void archive(active)} />
                )}
                <IconBtn ui={ui} icon="Trash2" label={t("Projects.42")} color={ui.c.danger} onPress={() => setConfirmDelete(active)} />
              </View>

              <View style={{ gap: 6 }}>
                <Progress value={active.done_count ?? 0} total={active.issue_count ?? 0} ui={ui} />
                <View style={[ui.s.row, { gap: 12, flexWrap: "wrap" }]}>
                  <Text style={ui.s.tiny}>{t("Labels.17")} {active.issue_count ?? 0} {t("Issues.16")}</Text>
                  <Text style={ui.s.tiny}>{t("AgentDetail.6")} {active.done_count ?? 0} {t("Issues.16")}</Text>
                  {active.due_date ? <Text style={ui.s.tiny}>{t("IssueDetail.45")} {active.due_date}</Text> : null}
                  <Text style={ui.s.tiny}>{t("Projects.48")} {relTime(active.updated_at)}</Text>
                </View>
              </View>

              {leadOf(active) ? (
                <View style={[ui.s.row, { gap: 8 }]}>
                  <Avatar ui={ui} name={leadOf(active)!.name} url={leadOf(active)!.avatarUrl} size={26} />
                  <View style={{ flex: 1 }}>
                    <Text style={ui.s.body}>{leadOf(active)!.name}</Text>
                    <Text style={ui.s.tiny}>{t("model.8")}</Text>
                  </View>
                </View>
              ) : null}

              {active.description ? (
                <Card ui={ui}>
                  <Markdown>{active.description}</Markdown>
                </Card>
              ) : (
                <Text style={[ui.s.muted, { fontStyle: "italic" }]}>{t("Projects.50")}</Text>
              )}

              {members.length > 0 ? (
                <View style={{ gap: 6 }}>
                  <Text style={ui.s.label}>{t("Projects.51")}</Text>
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
                <Text style={ui.s.label}>{t("Projects.52")}</Text>
                <Card ui={ui} padded={false}>
                  {issuesQuery.loading && projectIssues.length === 0 ? (
                    <LoadingRow ui={ui} />
                  ) : projectIssues.length === 0 ? (
                    <Empty ui={ui} icon="ListTodo" title={t("Projects.53")} description={t("Projects.54")} />
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
                <LoadMore
                  ui={ui}
                  loaded={projectIssues.length}
                  total={issuesQuery.total}
                  hasMore={issuesQuery.hasMore}
                  loadingMore={issuesQuery.loadingMore}
                  loading={issuesQuery.loading}
                  onLoadMore={issuesQuery.loadMore}
                />
                <Btn
                  ui={ui}
                  label={t("Projects.55")}
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
        title={t("Projects.42")}
        icon={<Icon name="TriangleAlert" size={16} color={ui.c.danger} />}
        open={Boolean(confirmDelete)}
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(null);
        }}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>{t("Automation.48")}{confirmDelete?.title}{t("Projects.58")}</Text>
            <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8 }]}>
              <Btn ui={ui} label={t("AgentDetail.40")} onPress={() => setConfirmDelete(null)} />
              <Btn ui={ui} label={t("SquadDetail.21")} tone="danger" busy={busy} onPress={() => void remove()} />
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
      accessibilityLabel={t("Projects.61", { a: project.title })}
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
            {project.archived_at ? t("AgentDetail.28") : meta.label}
            {project.due_date ? t("Projects.63", { a: project.due_date }) : ""}
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
          <Text style={ui.s.tiny}>{t("Projects.64")}</Text>
        )}
        <Text style={ui.s.tiny}>
          {project.done_count ?? 0}/{project.issue_count ?? 0} {t("Labels.17")}
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
      toast.error(t("Projects.66"));
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
      toast.show(project ? t("Projects.67") : t("Projects.68"), { variant: "success" });
      const saved = result.data && typeof result.data === "object" ? (result.data as Project) : null;
      onSaved(saved);
    } else toast.error(result.error ?? t("AgentDetail.64"));
  };

  return (
    <Modal
      title={project ? t("Projects.39") : t("Nav.34")}
      icon={<Icon name={project ? "Pencil" : "FolderKanban"} size={16} color={ui.c.muted} />}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Content>
        <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 12 }}>
          <Field ui={ui} label={t("Projects.72")} value={title} onChangeText={setTitle} placeholder={t("Projects.73")} autoFocus />
          <Field
            ui={ui}
            label={t("AgentDetail.97")}
            value={description}
            onChangeText={setDescription}
            placeholder={t("Projects.75")}
            multiline
          />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("IssueDetail.65")}</Text>
            <Chips ui={ui} options={EDIT_STATUS.map((option) => ({ ...option, label: t(option.label) }))} value={status} onChange={setStatus} />
          </View>
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("IssueDetail.66")}</Text>
            <Chips ui={ui} options={EDIT_PRIORITY.map((option) => ({ ...option, label: t(option.label) }))} value={priority} onChange={setPriority} />
          </View>
          <View style={[ui.s.row, { gap: 10 }]}>
            <View style={{ flex: 1 }}>
              <Field ui={ui} label={t("Projects.78")} value={startDate} onChangeText={setStartDate} placeholder="YYYY-MM-DD" />
            </View>
            <View style={{ flex: 1 }}>
              <Field ui={ui} label={t("Projects.79")} value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" />
            </View>
          </View>
          <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8, paddingTop: 4 }]}>
            <Btn ui={ui} label={t("AgentDetail.40")} onPress={onClose} />
            <Btn ui={ui} label={project ? t("AgentDetail.72") : t("Projects.82")} icon="Check" tone="primary" busy={busy} onPress={() => void submit()} />
          </View>
        </ScrollView>
      </Modal.Content>
    </Modal>
  );
}
