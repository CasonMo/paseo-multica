import type {
  PluginClientContext,
  PluginScreenProps,
  PluginSidebarItemProps,
  PluginSurfaceProps,
} from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { useEffect, useRef, useState } from "react";
import { WorkbenchProvider, type PageKey } from "./client/workbench/context";
import { Shell } from "./client/workbench/Shell";
import { SettingsPage } from "./client/workbench/pages/Settings";

const SCREEN_ID = "multica-workbench";
const SETTINGS_ID = "multica-connections";

const PAGE_KEYS: PageKey[] = ["overview", "issues", "issue", "team", "chat", "autopilot", "api", "settings"];

function asPage(value: string | undefined): PageKey | null {
  return value && (PAGE_KEYS as string[]).includes(value) ? (value as PageKey) : null;
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

function WorkbenchSidebarRow({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="Boxes"
      label="Multica"
      active={currentScreen?.screenId === SCREEN_ID}
      onPress={() => {
        const params = currentScreen?.screenId === SCREEN_ID ? currentScreen.params : undefined;
        openScreen({ screenId: SCREEN_ID, params });
      }}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  const cleanups = [
    client.addScreen({ id: SCREEN_ID, title: "Multica 工作台", Component: WorkbenchScreen }),
    client.addSettingsScreen({
      id: SETTINGS_ID,
      title: "Multica 连接",
      icon: "Boxes",
      Component: ConnectionsScreen,
    }),
    client.addSidebarFooterItem({
      id: "multica-sidebar",
      title: "Multica",
      Component: WorkbenchSidebarRow,
    }),
    client.addCommandCenterItem({
      id: "multica-open",
      title: "打开 Multica 工作台",
      icon: "Boxes",
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
      icon: "Plug",
      keywords: ["multica", "api", "接口", "调试"],
      context: "global",
      onSelect({ openScreen }) {
        openScreen({ screenId: SCREEN_ID, params: { page: "api" } });
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
