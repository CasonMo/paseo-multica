import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Btn, Card, Chips, Divider, Empty, ErrorNote, Field, LoadingRow, SectionHeader, useUi } from "../bits";
import { asList, asRecord, num, useQuery } from "../api";
import { useWorkbench } from "../context";
import type { Issue, Project } from "../model";
import { IssueRow } from "../parts";

type CategoryFilter = "all" | "unstarted" | "started" | "done" | "closed";
type PriorityFilter = "all" | "urgent" | "high" | "medium" | "low" | "none";

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "unstarted", label: "未开始" },
  { value: "started", label: "进行中" },
  { value: "done", label: "已完成" },
  { value: "closed", label: "已关闭" },
];

const PRIORITY_OPTIONS: { value: PriorityFilter; label: string }[] = [
  { value: "all", label: "全部优先级" },
  { value: "urgent", label: "紧急" },
  { value: "high", label: "高" },
  { value: "medium", label: "中" },
  { value: "low", label: "低" },
  { value: "none", label: "无" },
];

export function IssuesPage() {
  const ctx = useWorkbench();
  const { theme, compact, api, statuses, bump, workspaceId, navigate, params, toast, invalidate } = ctx;
  const ui = useUi(theme, compact);

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [priority, setPriority] = useState<PriorityFilter>("all");
  const [limit, setLimit] = useState(25);
  const [createOpen, setCreateOpen] = useState(params.create === "1");
  const [projectId, setProjectId] = useState<string | null>(params.project ?? null);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setLimit(25);
  }, [search, category, priority, projectId]);

  const listKey = `${workspaceId}:${bump}`;
  const request = useMemo(() => {
    const when: Record<string, string | number> = { limit, offset: 0, sort: "updated_at", direction: "desc" };
    if (search) when.q = search;
    if (category !== "all") when.status_category = category;
    if (priority !== "all") when.priority = priority;
    if (projectId) when.project_id = projectId;
    return when;
  }, [limit, search, category, priority, projectId]);

  const issues = useQuery(api, "/api/issues", { query: request }, listKey);
  const projects = useQuery(
    api,
    projectId ? "/api/projects" : null,
    { select: (data) => asList<Project>(data, "projects") },
    listKey,
  );
  const activeProject = (projects.data ?? []).find((project) => project.id === projectId) ?? null;
  const list = asList<Issue>(issues.data, "issues");
  const total = num(asRecord(issues.data).total, list.length);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: compact ? 12 : 18, gap: 12, paddingBottom: 48 }}>
        <View style={[ui.s.row, { gap: 10 }]}>
          <View style={ui.s.grow}>
            <Text style={[ui.s.title, { fontSize: compact ? 18 : 21 }]}>需求</Text>
            <Text style={ui.s.muted}>
              共 {total} 条 · 与 Multica 实时同步
            </Text>
          </View>
          <Btn ui={ui} label="新建" icon="Plus" tone="primary" onPress={() => setCreateOpen(true)} />
        </View>

        <View style={[ui.s.row, { gap: 8 }]}>
          <View
            style={[
              ui.s.row,
              {
                flex: 1,
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
              value={query}
              onChangeText={setQuery}
              placeholder="搜索标题、编号或描述…"
              placeholderTextColor={ui.c.muted}
              style={{ flex: 1, color: ui.c.fg, fontSize: 13, paddingVertical: 8 }}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="清空搜索"
                onPress={() => setQuery("")}
                style={({ pressed }) => pressed && ui.s.pressed}
              >
                <Icon name="X" size={14} color={ui.c.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>

        {projectId ? (
          <View
            style={[
              ui.s.row,
              {
                gap: 7,
                paddingHorizontal: 11,
                paddingVertical: 8,
                borderRadius: 9,
                borderWidth: 1,
                borderColor: `${ui.c.accent}55`,
                backgroundColor: `${ui.c.accent}14`,
              },
            ]}
          >
            <Icon name="FolderKanban" size={14} color={ui.c.accent} />
            <Text numberOfLines={1} style={[ui.s.body, { flex: 1, color: ui.c.accent, fontWeight: "600" }]}>
              {activeProject ? activeProject.title : "已按项目筛选"}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="清除项目筛选"
              onPress={() => setProjectId(null)}
              style={({ pressed }) => [ui.s.row, { gap: 3 }, pressed && ui.s.pressed]}
            >
              <Text style={[ui.s.tiny, { color: ui.c.accent }]}>清除</Text>
              <Icon name="X" size={13} color={ui.c.accent} />
            </Pressable>
          </View>
        ) : null}

        <View style={{ gap: 6 }}>
          <Chips<CategoryFilter> ui={ui} options={CATEGORY_OPTIONS} value={category} onChange={setCategory} />
          <Chips<PriorityFilter> ui={ui} options={PRIORITY_OPTIONS} value={priority} onChange={setPriority} />
        </View>

        <Card ui={ui} padded={false}>
          {issues.loading && list.length === 0 ? (
            <LoadingRow ui={ui} />
          ) : issues.error ? (
            <View style={{ padding: 14 }}>
              <ErrorNote ui={ui} message={issues.error} onRetry={issues.refresh} />
            </View>
          ) : list.length === 0 ? (
            <Empty
              ui={ui}
              icon="Inbox"
              title={search || category !== "all" || priority !== "all" || projectId ? "没有匹配的需求" : "还没有需求"}
              description="调整筛选条件，或创建一条新需求。"
              action={<Btn ui={ui} label="新建需求" icon="Plus" tone="primary" onPress={() => setCreateOpen(true)} />}
            />
          ) : (
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
          )}
        </Card>

        {list.length > 0 && list.length < total ? (
          <View style={{ alignItems: "center" }}>
            <Btn
              ui={ui}
              label={issues.loading ? "加载中…" : `加载更多（已显示 ${list.length}/${total}）`}
              icon="ChevronDown"
              busy={issues.loading}
              onPress={() => setLimit((value) => value + 25)}
            />
          </View>
        ) : list.length > 0 ? (
          <Text style={[ui.s.tiny, { textAlign: "center" }]}>已显示全部 {total} 条需求</Text>
        ) : null}
      </ScrollView>

      <CreateIssueModal
        open={createOpen}
        projectId={projectId}
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

function CreateIssueModal({
  open,
  projectId,
  onClose,
  onCreated,
  toast,
}: {
  open: boolean;
  projectId?: string | null;
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
    setStatus(statuses[0]?.key ?? "todo");
  }, [open, statuses]);

  const submit = async () => {
    if (!title.trim()) {
      toast.error("请填写需求标题");
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
      toast.show("需求已创建", { variant: "success" });
      const created = result.data && typeof result.data === "object" ? (result.data as Issue) : null;
      onCreated(created);
    } else {
      toast.error(result.error ?? "创建失败");
    }
  };

  return (
    <Modal
      title="新建需求"
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
            <Btn ui={ui} label="创建需求" icon="Check" tone="primary" busy={busy} onPress={() => void submit()} />
          </View>
        </View>
      </Modal.Content>
    </Modal>
  );
}
