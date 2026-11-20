import type {
  PluginClientContext,
  PluginScreenProps,
  PluginSidebarItemProps,
  PluginSurfaceProps,
} from "@getpaseo/plugin/client";
import { useRpc } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { MULTICA_LOGO_SVG } from "./client/workbench/Logo";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text } from "react-native";
import { WorkbenchProvider, type PageKey } from "./client/workbench/context";
import { useInboxBadgeVersion } from "./client/workbench/badge";
import { Shell } from "./client/workbench/Shell";
import { SettingsPage } from "./client/workbench/pages/Settings";
import { inboxBadgeRpc } from "./shared/contracts";

const SCREEN_ID = "multica";
const SETTINGS_ID = "multica-connections";

const PAGE_KEYS: PageKey[] = [
  "overview",
  "issues",
  "issue",
  "projects",
  "inbox",
  "labels",
  "workflows",
  "team",
  "chat",
  "autopilot",
  "settings",
];

function asPage(value: string | undefined): PageKey | null {
  return value && (PAGE_KEYS as string[]).includes(value) ? (value as PageKey) : null;
}

const LAST_SCREEN_KEY = "multica.lastScreen";
type LocalStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };
function localStore(): LocalStore | null {
  return (globalThis as { localStorage?: LocalStore }).localStorage ?? null;
}
function readLastScreen(): Record<string, string> | null {
  try {
    const raw = localStore()?.getItem(LAST_SCREEN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, string>) : null;
  } catch {
    return null;
  }
}
function writeLastScreen(params: Record<string, string>) {
  try {
    localStore()?.setItem(LAST_SCREEN_KEY, JSON.stringify(params));
  } catch {
    //  写不进去就退回到默认概览
  }
}

function WorkbenchScreen({ theme, layout, params }: PluginScreenProps) {
  const [page, setPage] = useState<PageKey>(asPage(params.page) ?? "overview");
  const [pageParams, setPageParams] = useState<Record<string, string>>(params);
  const lastParams = useRef(params);

  useEffect(() => {
    if (lastParams.current === params) return;
    lastParams.current = params;
    const next = asPage(params.page);
    if (next) {
      setPage(next);
      setPageParams(params);
    }
  }, [params]);

  const navigate = (next: PageKey, nextParams: Record<string, string> = {}) => {
    setPage(next);
    setPageParams(nextParams);
  };

  useEffect(() => {
    writeLastScreen({ page, ...pageParams });
  }, [page, pageParams]);

  return (
    <WorkbenchProvider
      theme={theme}
      compact={layout.compact}
      page={page}
      params={pageParams}
      navigate={navigate}
    >
      <Shell />
    </WorkbenchProvider>
  );
}

function ConnectionsScreen({ theme, layout }: PluginSurfaceProps) {
  return (
    <WorkbenchProvider theme={theme} compact={layout.compact} page="settings" params={{}} navigate={() => {}}>
      <SettingsPage />
    </WorkbenchProvider>
  );
}

function WorkbenchSidebarRow({ currentScreen, openScreen, theme }: PluginSidebarItemProps) {
  const fetchBadge = useRpc(inboxBadgeRpc);
  const fetchRef = useRef(fetchBadge);
  fetchRef.current = fetchBadge;
  const version = useInboxBadgeVersion();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const result = await fetchRef.current({});
        if (alive) setUnread(result.count);
      } catch {
        // 取数失败时保留上一次的计数，避免徽章闪烁；下一轮轮询会自愈。
      }
    };
    void load();
    const timer = setInterval(() => void load(), 20000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [version]);

  const open = currentScreen?.screenId === SCREEN_ID;
  const trailing =
    unread > 0 ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`查看 ${unread} 条未读通知`}
        onPress={() => openScreen({ screenId: SCREEN_ID, params: { page: "inbox" } })}
        style={({ pressed }) => [
          {
            minWidth: 18,
            height: 18,
            borderRadius: 9,
            paddingHorizontal: 5,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: theme.colors.accent,
          },
          pressed && { opacity: 0.7 },
        ]}
      >
        <Text style={{ color: theme.colors.accentForeground, fontSize: 10, fontWeight: "600" }}>
          {unread > 99 ? "99+" : unread}
        </Text>
      </Pressable>
    ) : undefined;

  return (
    <SidebarRow
      icon={{ svg: MULTICA_LOGO_SVG }}
      label={unread > 0 ? `Multica，${unread > 99 ? "99+" : unread} 条未读通知` : "Multica"}
      active={open}
      trailing={trailing}
      onPress={() => {
        openScreen({
          screenId: SCREEN_ID,
          params: open ? currentScreen.params : (readLastScreen() ?? { page: "overview" }),
        });
      }}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  const cleanups = [
    client.addScreen({ id: SCREEN_ID, title: "Multica", Component: WorkbenchScreen }),
    client.addSettingsScreen({
      id: SETTINGS_ID,
      title: "Multica 连接",
      icon: { svg: MULTICA_LOGO_SVG },
      Component: ConnectionsScreen,
    }),
    client.addSidebarHeaderItem({
      id: "multica-sidebar",
      title: "Multica",
      Component: WorkbenchSidebarRow,
    }),
    client.addCommandCenterItem({
      id: "multica-open",
      title: "打开 Multica",
      icon: { svg: MULTICA_LOGO_SVG },
      keywords: ["multica", "工作台", "issuance", "issue", "任务", "智能体"],
      context: "global",
      onSelect({ openScreen }) {
        openScreen({ screenId: SCREEN_ID });
      },
    }),
    client.addCommandCenterItem({
      id: "multica-issues",
      title: "搜索 Multica 需求",
      icon: "ListTodo",
      keywords: ["multica", "需求", "任务", "issue"],
      context: "global",
      onSelect({ openScreen }) {
        openScreen({ screenId: SCREEN_ID, params: { page: "issues" } });
      },
    }),
    client.addCommandCenterItem({
      id: "multica-chat",
      title: "打开 Multica 对话",
      icon: "MessagesSquare",
      keywords: ["multica", "聊天", "对话", "chat", "智能体"],
      context: "global",
      onSelect({ openScreen }) {
        openScreen({ screenId: SCREEN_ID, params: { page: "chat" } });
      },
    }),
    client.addCommandCenterItem({
      id: "multica-automation",
      title: "打开 Multica 自动化",
      icon: "Bot",
      keywords: ["multica", "自动化", "autopilot", "定时"],
      context: "global",
      onSelect({ openScreen }) {
        openScreen({ screenId: SCREEN_ID, params: { page: "autopilot" } });
      },
    }),
    client.addCommandCenterItem({
      id: "multica-api",
      title: "Multica 接口调试",
      icon: "Terminal",
      keywords: ["multica", "api", "接口", "调试"],
      context: "global",
      onSelect({ openScreen }) {
        openScreen({ screenId: SCREEN_ID, params: { page: "settings", tab: "api" } });
      },
    }),
    client.addCommandCenterItem({
      id: "multica-settings",
      title: "Multica 连接设置",
      icon: "Settings2",
      keywords: ["multica", "设置", "连接", "服务器", "api key"],
      context: "global",
      onSelect({ openSettings }) {
        openSettings(SETTINGS_ID);
      },
    }),
  ];

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}
