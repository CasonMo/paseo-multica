import { Icon } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, Text, View } from "react-native";
import { asList, asRecord, num, useQuery } from "./api";
import { useUi } from "./bits";
import { useWorkbench, type PageKey } from "./context";
import { initials, type Project } from "./model";

/** RN-web 的 Pressable 会带 hovered，但 RN 0.81 的类型里没有声明。 */
type NavPressState = { pressed: boolean; hovered?: boolean };

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
  const { theme, compact, navCollapsed, toggleNav, page, navigate, server, user, workspaces, workspaceId } = ctx;
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
    const plain = options?.plain === true || navCollapsed;
    const box = navCollapsed ? 32 : compact ? 36 : 40;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected }}
        key={key}
        onPress={onPress}
        style={({ pressed, hovered }: NavPressState) => [
          {
            width: plain ? 30 : box,
            height: plain ? 30 : box,
            borderRadius: plain ? 8 : 10,
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
          },
          hovered && !selected && { backgroundColor: ui.c.fillHover },
          selected && { backgroundColor: ui.c.fillStrong },
          pressed && ui.s.pressed,
        ]}
      >
        {options?.busy ? (
          <ActivityIndicator size="small" color={ui.c.muted} />
        ) : (
          <Icon name={icon} size={compact ? 15 : 16} color={selected ? ui.c.fg : ui.c.muted} />
        )}
        {plain ? null : (
          <Text
            numberOfLines={1}
            style={{
              fontSize: compact ? 9 : 10,
              lineHeight: compact ? 11 : 12,
              color: selected ? ui.c.fg : ui.c.muted,
              fontWeight: selected ? "500" : "400",
            }}
          >
            {label}
          </Text>
        )}
      </Pressable>
    );
  };

  return (
    <View
      style={{
        width: navCollapsed ? 40 : compact ? 44 : 48,
        backgroundColor: ui.c.shell,
        paddingTop: 12,
        paddingBottom: 8,
        alignItems: "center",
        gap: 2,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="切换工作区"
        onPress={onWorkspacePicker}
        style={({ pressed, hovered }: NavPressState) => [
          {
            width: 30,
            height: 30,
            borderRadius: 9,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: hovered ? ui.c.fillStrong : ui.c.fillHover,
            marginBottom: 6,
          },
          pressed && ui.s.pressed,
        ]}
      >
        <Text style={{ color: ui.c.fg, fontSize: 12, fontWeight: "600" }}>
          {initials(workspace?.name ?? server?.name ?? "M")}
        </Text>
      </Pressable>

      {cell("create", "SquarePen", "新建", () => navigate("issues", { create: "1" }), { plain: true })}
      {cell("search", "Search", "搜索", () => navigate("issues", { focus: "search" }), { plain: true })}

      <View style={{ height: 1, width: 24, backgroundColor: ui.c.line, marginVertical: 6 }} />

      <ScrollView
        style={{ flex: 1, width: "100%" }}
        contentContainerStyle={{ alignItems: "center", gap: 2 }}
        showsVerticalScrollIndicator={false}
      >
        {RAIL.map((entry) =>
          cell(entry.key, entry.icon, entry.label, () => navigate(entry.key), { selected: active === entry.key }),
        )}
      </ScrollView>

      {cell(
        "nav-toggle",
        navCollapsed ? "PanelLeftOpen" : "PanelLeftClose",
        navCollapsed ? "展开导航" : "收起导航",
        toggleNav,
        { plain: true },
      )}
      {cell("refresh", "RefreshCw", "刷新", () => void refresh(), { busy, plain: true })}
      {cell("settings", "Settings", "设置", () => navigate("settings"), { selected: page === "settings" })}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="账户"
        onPress={() => navigate("settings", { tab: "account" })}
        style={({ pressed }) => [{ marginTop: 6, borderRadius: 14 }, pressed && ui.s.pressed]}
      >
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: ui.c.primary,
          }}
        >
          <Text style={{ color: ui.c.primaryFg, fontSize: 11, fontWeight: "600" }}>
            {initials(user?.name ?? "M")}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

/** 二级侧栏只保留该分区独有、且主区域没有的内容；其余分区直接让位给主内容。 */
const SIDEBAR_PAGES: PageKey[] = ["issues", "issue", "team", "autopilot", "settings"];

export function SectionSidebar() {
  const { compact, stacked, narrow, navCollapsed, page } = useWorkbench();
  if (compact || stacked || navCollapsed || !SIDEBAR_PAGES.includes(page)) return null;
  return (
    <View style={{ width: narrow ? 196 : 224 }}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 8, paddingTop: 10, paddingBottom: 24 }}>
        {page === "issues" || page === "issue" ? (
          <WorkNav />
        ) : page === "team" ? (
          <TeamNav />
        ) : page === "autopilot" ? (
          <AutomationNav />
        ) : (
          <SettingsNav />
        )}
      </ScrollView>
    </View>
  );
}

const GROUP_KEY = "multica.navGroups";
type LocalStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };
function groupStore(): LocalStore | null {
  return (globalThis as { localStorage?: LocalStore }).localStorage ?? null;
}
function readGroupOpen(id: string, fallback: boolean): boolean {
  try {
    const raw = groupStore()?.getItem(GROUP_KEY);
    if (!raw) return fallback;
    const map = JSON.parse(raw) as Record<string, boolean>;
    return typeof map[id] === "boolean" ? map[id] : fallback;
  } catch {
    return fallback;
  }
}
function writeGroupOpen(id: string, open: boolean) {
  try {
    const store = groupStore();
    if (!store) return;
    const map = JSON.parse(store.getItem(GROUP_KEY) ?? "{}") as Record<string, boolean>;
    map[id] = open;
    store.setItem(GROUP_KEY, JSON.stringify(map));
  } catch {
    //  写不进去就只保留本次会话状态
  }
}

function SectionTitle({ ui, title }: { ui: ReturnType<typeof useUi>; title: string }) {
  return (
    <View style={[ui.s.row, { paddingHorizontal: 8, paddingTop: 2, paddingBottom: 6 }]}>
      <Text style={{ flex: 1, color: ui.c.fg, fontSize: 15, fontWeight: "600" }}>{title}</Text>
    </View>
  );
}

function Group({
  ui,
  id,
  label,
  defaultOpen = true,
  children,
}: {
  ui: ReturnType<typeof useUi>;
  id: string;
  label: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(() => readGroupOpen(id, defaultOpen));
  const toggle = () => {
    setOpen((prev) => {
      writeGroupOpen(id, !prev);
      return !prev;
    });
  };
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}，${open ? "收起" : "展开"}`}
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        onPress={toggle}
        style={({ pressed, hovered }: NavPressState) => [
          ui.s.row,
          { gap: 5, paddingHorizontal: 8, paddingTop: 12, paddingBottom: 4, borderRadius: 6 },
          hovered && { backgroundColor: ui.c.fillHover },
          pressed && ui.s.pressed,
        ]}
      >
        <Icon name={open ? "ChevronDown" : "ChevronRight"} size={12} color={ui.c.faint} />
        <Text style={{ flex: 1, color: ui.c.muted, fontSize: 12, fontWeight: "500" }}>{label}</Text>
      </Pressable>
      {open ? <View style={{ paddingTop: 2 }}>{children}</View> : null}
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
      style={({ pressed, hovered }: NavPressState) => [
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 7,
          height: 30,
          paddingHorizontal: 8,
          paddingLeft: indent ? 18 : 8,
          borderRadius: 7,
        },
        hovered && selected !== true && { backgroundColor: ui.c.fillHover },
        selected && { backgroundColor: ui.c.fillStrong },
        pressed && ui.s.pressed,
      ]}
    >
      {icon ? (
        <Icon name={icon} size={14} color={selected ? ui.c.fg : ui.c.muted} />
      ) : (
        <View style={{ width: 14 }} />
      )}
      <Text numberOfLines={1} style={{ flex: 1, fontSize: 13, color: ui.c.fg, fontWeight: selected ? "500" : "400" }}>
        {label}
      </Text>
      {count != null ? <Text style={{ fontSize: 12, color: ui.c.muted }}>{count}</Text> : null}
    </Pressable>
  );
}

export const WORK_VIEWS: { key: string; label: string; icon: string; query: Record<string, string | number> }[] = [
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
      <NavRow ui={ui} icon="Bell" label="收件箱" count={unreadCount} onPress={() => navigate("inbox")} />
      <Group ui={ui} id="work.preview" label="最近通知" defaultOpen={false}>
        {previewList.length === 0 ? (
          <Text style={[ui.s.tiny, { paddingHorizontal: 8, paddingVertical: 6 }]}>暂无通知</Text>
        ) : (
          previewList.map((item) => (
            <Pressable
              accessibilityRole="button"
              key={item.id}
              onPress={() => navigate("inbox")}
              style={({ pressed, hovered }: NavPressState) => [
                { minHeight: 28, justifyContent: "center", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 7 },
                hovered && { backgroundColor: ui.c.fillHover },
                pressed && ui.s.pressed,
              ]}
            >
              <Text numberOfLines={1} style={{ fontSize: 12, color: ui.c.muted }}>
                {item.title || "通知"}
              </Text>
            </Pressable>
          ))
        )}
      </Group>

      <Group ui={ui} id="work.views" label="视图">
        {WORK_VIEWS.map((entry) => (
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
      </Group>

      <Group ui={ui} id="work.projects" label="项目">
        {list.length === 0 ? (
          <Text style={[ui.s.tiny, { paddingHorizontal: 8, paddingVertical: 6 }]}>暂无项目</Text>
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
      </Group>
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
      <Group ui={ui} id="team.org" label="组织">
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
      </Group>
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
      <Group ui={ui} id="autopilot.tasks" label="任务">
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
      </Group>
    </View>
  );
}

function SettingsNav() {
  const { theme, compact, page, params, navigate } = useWorkbench();
  const ui = useUi(theme, compact);
  const links = [
    { label: "服务器连接", icon: "Plug", tab: "connection" },
    { label: "工作区", icon: "Layers", tab: "workspace" },
    { label: "企业微信", icon: "MessagesSquare", tab: "wecom" },
    { label: "账户", icon: "CircleUser", tab: "account" },
  ];
  return (
    <View>
      <SectionTitle ui={ui} title="设置" />
      <Group ui={ui} id="settings.tabs" label="设置项">
        {links.map((entry) => (
          <NavRow
            key={entry.tab}
            ui={ui}
            icon={entry.icon}
            label={entry.label}
            selected={page === "settings" && (params.tab ?? "connection") === entry.tab}
            onPress={() => navigate("settings", { tab: entry.tab })}
          />
        ))}
        <NavRow ui={ui} icon="Terminal" label="接口调试" onPress={() => navigate("api")} />
      </Group>
    </View>
  );
}