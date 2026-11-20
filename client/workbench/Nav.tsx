import { Icon } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { asList, asRecord, num, useQuery } from "./api";
import { useUi } from "./bits";
import { useWorkbench, type PageKey } from "./context";
import { initials, type Project } from "./model";

const RAIL: { key: PageKey; label: string; icon: string }[] = [
  { key: "overview", label: "概览", icon: "LayoutDashboard" },
  { key: "issues", label: "工作", icon: "ListTodo" },
  { key: "projects", label: "项目", icon: "FolderKanban" },
  { key: "team", label: "团队", icon: "Users" },
  { key: "chat", label: "聊天", icon: "MessagesSquare" },
  { key: "autopilot", label: "自动化", icon: "Bot" },
  { key: "workflows", label: "工作流", icon: "Workflow" },
  { key: "labels", label: "标签", icon: "Tags" },
  { key: "api", label: "接口", icon: "Plug" },
];

export function RailNav({ onWorkspacePicker }: { onWorkspacePicker(): void }) {
  const ctx = useWorkbench();
  const { theme, compact, page, navigate, server, user, workspaces, workspaceId } = ctx;
  const ui = useUi(theme, compact);
  const [busy, setBusy] = useState(false);
  const active = page === "issue" ? "issues" : page;
  const workspace = workspaces.find((item) => item.id === workspaceId);

  const refresh = async () => {
    setBusy(true);
    await ctx.reloadBootstrap();
    ctx.invalidate();
    setBusy(false);
  };

  const cell = (
    key: string,
    icon: string,
    label: string,
    onPress: () => void,
    options?: { selected?: boolean; busy?: boolean; plain?: boolean },
  ) => {
    const selected = options?.selected === true;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        key={key}
        onPress={onPress}
        style={({ pressed }) => [
          {
            width: compact ? 46 : 54,
            paddingVertical: 7,
            borderRadius: 10,
            alignItems: "center",
            gap: 3,
          },
          selected && { backgroundColor: ui.c.surface2 },
          pressed && ui.s.pressed,
        ]}
      >
        <Icon
          name={icon}
          size={compact ? 17 : 19}
          color={selected ? ui.c.fg : ui.c.muted}
        />
        {options?.busy ? <ActivityIndicator size="small" color={ui.c.muted} /> : null}
        {options?.plain ? null : (
          <Text style={{ fontSize: 10, color: selected ? ui.c.fg : ui.c.muted, fontWeight: selected ? "600" : "400" }}>
            {label}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View
      style={{
        width: compact ? 58 : 72,
        backgroundColor: ui.c.surface1,
        borderRightWidth: 1,
        borderRightColor: ui.c.border,
        paddingVertical: 10,
        alignItems: "center",
        gap: 2,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="切换工作区"
        onPress={onWorkspacePicker}
        style={({ pressed }) => [
          {
            width: 34,
            height: 34,
            borderRadius: 9,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: ui.c.surface2,
            marginBottom: 8,
          },
          pressed && ui.s.pressed,
        ]}
      >
        <Text style={{ color: ui.c.fg, fontSize: 13, fontWeight: "700" }}>
          {initials(workspace?.name ?? server?.name ?? "M")}
        </Text>
      </Pressable>

      {cell("create", "SquarePen", "新建", () => navigate("issues", { create: "1" }), { plain: true })}
      {cell("search", "Search", "搜索", () => navigate("issues", { focus: "search" }), { plain: true })}

      <View style={{ height: 1, width: 26, backgroundColor: ui.c.border, marginVertical: 6 }} />

      {RAIL.map((entry) =>
        cell(entry.key, entry.icon, entry.label, () => navigate(entry.key), { selected: active === entry.key }),
      )}

      <View style={{ flex: 1 }} />

      {cell("refresh", "RefreshCw", "刷新", () => void refresh(), { busy, plain: true })}
      {cell("settings", "Settings", "设置", () => navigate("settings"), { selected: page === "settings" })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="账户"
        onPress={() => navigate("settings", { tab: "account" })}
        style={({ pressed }) => [{ marginTop: 4, borderRadius: 15 }, pressed && ui.s.pressed]}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: ui.c.accent,
          }}
        >
          <Text style={{ color: ui.c.accentFg, fontSize: 11, fontWeight: "700" }}>
            {initials(user?.name ?? "M")}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

export function SectionSidebar() {
  const { theme, compact, page } = useWorkbench();
  const ui = useUi(theme, compact);
  if (compact || page === "chat" || page === "api") return null;
  return (
    <View
      style={{
        width: 252,
        backgroundColor: ui.c.surface1,
        borderRightWidth: 1,
        borderRightColor: ui.c.border,
      }}
    >
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 28 }}>
        {page === "issues" || page === "issue" ? (
          <WorkNav />
        ) : page === "team" ? (
          <TeamNav />
        ) : page === "autopilot" ? (
          <AutomationNav />
        ) : (
          <GenericNav />
        )}
      </ScrollView>
    </View>
  );
}

function SectionTitle({ ui, title, action }: { ui: ReturnType<typeof useUi>; title: string; action?: React.ReactNode }) {
  return (
    <View style={[ui.s.row, { paddingHorizontal: 6, paddingTop: 2, paddingBottom: 6 }]}>
      <Text style={{ flex: 1, color: ui.c.fg, fontSize: 19, fontWeight: "700", letterSpacing: -0.2 }}>{title}</Text>
      {action}
    </View>
  );
}

function GroupLabel({ ui, label, action }: { ui: ReturnType<typeof useUi>; label: string; action?: React.ReactNode }) {
  return (
    <View style={[ui.s.row, { paddingHorizontal: 8, paddingTop: 12, paddingBottom: 4 }]}>
      <Text style={{ flex: 1, color: ui.c.muted, fontSize: 11.5, fontWeight: "600" }}>{label}</Text>
      {action}
    </View>
  );
}

function NavRow({
  ui,
  icon,
  label,
  count,
  selected,
  onPress,
  indent,
}: {
  ui: ReturnType<typeof useUi>;
  icon?: string;
  label: string;
  count?: number | null;
  selected?: boolean;
  onPress(): void;
  indent?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: selected === true }}
      onPress={onPress}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          height: 31,
          paddingHorizontal: 8,
          paddingLeft: indent ? 18 : 8,
          borderRadius: 7,
        },
        selected && { backgroundColor: ui.c.surface2 },
        pressed && ui.s.pressed,
      ]}
    >
      {icon ? (
        <Icon name={icon} size={14} color={selected ? ui.c.fg : ui.c.muted} />
      ) : (
        <View style={{ width: 14 }} />
      )}
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: selected ? ui.c.fg : ui.c.fg, fontWeight: selected ? "600" : "400" }}>
        {label}
      </Text>
      {count != null ? <Text style={{ fontSize: 11.5, color: ui.c.muted }}>{count}</Text> : null}
    </Pressable>
  );
}

const VIEWS: { key: string; label: string; icon: string; query: Record<string, string | number> }[] = [
  { key: "all", label: "全部任务", icon: "ListChecks", query: {} },
  { key: "mine", label: "我的工作", icon: "CircleUser", query: { mine: 1 } },
  { key: "active", label: "执行中", icon: "Play", query: { status_category: "started" } },
  { key: "done", label: "已完成", icon: "CircleCheck", query: { status_category: "done" } },
  { key: "closed", label: "已取消", icon: "CircleSlash", query: { status_category: "closed" } },
];

function WorkNav() {
  const ctx = useWorkbench();
  const { theme, compact, api, workspaceId, bump, params, navigate, user } = ctx;
  const ui = useUi(theme, compact);
  const key = `${workspaceId}:${bump}`;
  const total = (data: unknown) => num(asRecord(data).total, 0);

  const all = useQuery(api, "/api/issues", { query: { limit: 1 }, select: total }, key);
  const mine = useQuery(
    api,
    user?.id ? "/api/issues" : null,
    { query: { limit: 1, assignee_id: user?.id ?? "" }, select: total },
    key,
  );
  const active = useQuery(
    api,
    "/api/issues",
    { query: { limit: 1, status_category: "started" }, select: total },
    key,
  );
  const done = useQuery(api, "/api/issues", { query: { limit: 1, status_category: "done" }, select: total }, key);
  const closed = useQuery(api, "/api/issues", { query: { limit: 1, status_category: "closed" }, select: total }, key);
  const projects = useQuery(
    api,
    "/api/projects",
    { query: { limit: 100 }, select: (data) => asList<Project>(data, "projects") },
    key,
  );
  const unread = useQuery(api, "/api/inbox/unread-count", {}, key);
  const preview = useQuery(api, "/api/inbox", { query: { limit: 3 }, select: (data) => asList<{ id: string; title?: string; type?: string }>(data, "items", "inbox") }, `${key}:preview`);

  const unreadCount =
    typeof unread.data === "number" ? unread.data : num(asRecord(unread.data).count ?? asRecord(unread.data).unread, 0);
  const counts: Record<string, number | null> = {
    all: all.data,
    mine: user?.id ? mine.data : null,
    active: active.data,
    done: done.data,
    closed: closed.data,
  };
  const view = params.view ?? "all";
  const projectId = params.project ?? null;
  const list = projects.data ?? [];
  const previewList = (preview.data ?? []).slice(0, 3);

  return (
    <View>
      <SectionTitle ui={ui} title={params.id ? "任务" : "工作"} />
      <GroupLabel ui={ui} label="收件箱" />
      <NavRow ui={ui} icon="Bell" label="收件箱" count={unreadCount} onPress={() => navigate("inbox")} />
      {previewList.length === 0 ? (
        <Text style={[ui.s.tiny, { paddingHorizontal: 10, paddingVertical: 6 }]}>暂无通知</Text>
      ) : (
        previewList.map((item) => (
          <Pressable
            accessibilityRole="button"
            key={item.id}
            onPress={() => navigate("inbox")}
            style={({ pressed }) => [
              { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
              pressed && ui.s.pressed,
            ]}
          >
            <Text numberOfLines={1} style={{ fontSize: 12, color: ui.c.fg }}>
              {item.title || "通知"}
            </Text>
          </Pressable>
        ))
      )}

      <GroupLabel ui={ui} label="视图" action={<Icon name="Plus" size={13} color={ui.c.muted} />} />
      {VIEWS.map((entry) => (
        <NavRow
          key={entry.key}
          ui={ui}
          icon={entry.icon}
          label={entry.label}
          count={counts[entry.key]}
          selected={view === entry.key && !projectId}
          onPress={() => navigate("issues", { view: entry.key })}
        />
      ))}

      <GroupLabel ui={ui} label="项目" action={<Icon name="Plus" size={13} color={ui.c.muted} />} />
      {list.length === 0 ? (
        <Text style={[ui.s.tiny, { paddingHorizontal: 10, paddingVertical: 6 }]}>暂无项目</Text>
      ) : (
        list.map((project) => (
          <NavRow
            key={project.id}
            ui={ui}
            icon="FolderKanban"
            label={project.title}
            count={project.issue_count}
            selected={projectId === project.id}
            onPress={() => navigate("issues", { project: project.id })}
          />
        ))
      )}
      <NavRow ui={ui} icon="Plus" label="新建项目" onPress={() => navigate("projects")} />
    </View>
  );
}

function TeamNav() {
  const { theme, compact, navigate, params } = useWorkbench();
  const ui = useUi(theme, compact);
  const tab = params.tab ?? "agents";
  const items = [
    { key: "agents", label: "智能体", icon: "Bot" },
    { key: "squads", label: "小队", icon: "UsersRound" },
    { key: "runtimes", label: "运行时", icon: "Server" },
    { key: "skills", label: "技能", icon: "Blocks" },
  ];
  return (
    <View>
      <SectionTitle ui={ui} title="团队" />
      <GroupLabel ui={ui} label="组织" />
      {items.map((entry) => (
        <NavRow
          key={entry.key}
          ui={ui}
          icon={entry.icon}
          label={entry.label}
          selected={tab === entry.key}
          onPress={() => navigate("team", { tab: entry.key })}
        />
      ))}
    </View>
  );
}

function AutomationNav() {
  const { theme, compact, navigate, params } = useWorkbench();
  const ui = useUi(theme, compact);
  const filter = params.filter ?? "all";
  const items = [
    { key: "all", label: "全部自动化", icon: "LayoutList" },
    { key: "active", label: "运行中", icon: "Activity" },
    { key: "paused", label: "已暂停", icon: "Pause" },
  ];
  return (
    <View>
      <SectionTitle ui={ui} title="自动化" />
      <GroupLabel ui={ui} label="任务" action={<Icon name="Plus" size={13} color={ui.c.muted} />} />
      {items.map((entry) => (
        <NavRow
          key={entry.key}
          ui={ui}
          icon={entry.icon}
          label={entry.label}
          selected={filter === entry.key}
          onPress={() => navigate("autopilot", { filter: entry.key })}
        />
      ))}
    </View>
  );
}

const GENERIC: Record<string, { title: string; desc: string; links: { label: string; icon: string; page: PageKey; params?: Record<string, string> }[] }> = {
  overview: {
    title: "概览",
    desc: "工作区概况与用量",
    links: [
      { label: "需求看板", icon: "ListTodo", page: "issues" },
      { label: "团队", icon: "Users", page: "team" },
      { label: "自动化", icon: "Bot", page: "autopilot" },
    ],
  },
  inbox: {
    title: "收件箱",
    desc: "需求流转、智能体结果与 @ 提醒",
    links: [
      { label: "全部任务", icon: "ListChecks", page: "issues" },
      { label: "团队", icon: "Users", page: "team" },
    ],
  },
  projects: {
    title: "项目",
    desc: "按项目组织需求与进度",
    links: [
      { label: "全部任务", icon: "ListChecks", page: "issues" },
      { label: "标签", icon: "Tags", page: "labels" },
    ],
  },
  workflows: {
    title: "工作流",
    desc: "状态定义与流转规则",
    links: [
      { label: "全部任务", icon: "ListChecks", page: "issues" },
      { label: "团队", icon: "Users", page: "team" },
    ],
  },
  labels: {
    title: "标签",
    desc: "需求的分类标记",
    links: [{ label: "全部任务", icon: "ListChecks", page: "issues" }],
  },
  settings: {
    title: "设置",
    desc: "服务器、工作区与账户",
    links: [
      { label: "服务器连接", icon: "Plug", page: "settings", params: { tab: "connection" } },
      { label: "工作区", icon: "Layers", page: "settings", params: { tab: "workspace" } },
      { label: "账户", icon: "CircleUser", page: "settings", params: { tab: "account" } },
      { label: "接口调试", icon: "Plug", page: "api" },
    ],
  },
};

function GenericNav() {
  const { theme, compact, page, params, navigate } = useWorkbench();
  const ui = useUi(theme, compact);
  const meta = GENERIC[page] ?? { title: "Multica", desc: "", links: [] };
  return (
    <View>
      <SectionTitle ui={ui} title={meta.title} />
      {meta.desc ? <Text style={[ui.s.tiny, { paddingHorizontal: 6, paddingBottom: 4 }]}>{meta.desc}</Text> : null}
      <GroupLabel ui={ui} label="导航" />
      {meta.links.map((entry) => (
        <NavRow
          key={`${entry.page}:${entry.label}`}
          ui={ui}
          icon={entry.icon}
          label={entry.label}
          selected={page === entry.page && (entry.params?.tab ? params.tab === entry.params.tab : !params.tab)}
          onPress={() => navigate(entry.page, entry.params)}
        />
      ))}
    </View>
  );
}