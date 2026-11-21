import { t, errorMessage, useI18n, bindTranslation, useLocaleOverride, messagesFor } from "./i18n";
import type { PluginTheme } from "@getpaseo/plugin";
import { useRpc } from "@getpaseo/plugin/client";
import { useToast } from "@getpaseo/plugin/client/ui";
import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import {
  bootstrapRpc,
  connectionsListRpc,
  workspaceSelectRpc,
  type ConnectionsView,
  type RemoteUser,
  type RemoteWorkspace,
  type ServerView,
} from "../../shared/contracts";
import { asList, useApi, useQuery, type ApiFn } from "./api";
import type { IssueStatusEntry } from "./model";

export type PageKey =
  | "overview"
  | "issues"
  | "issue"
  | "projects"
  | "inbox"
  | "labels"
  | "workflows"
  | "team"
  | "chat"
  | "autopilot"
  | "settings";

export interface WorkbenchValue {
  theme: PluginTheme;
  compact: boolean;
  /** 插件面板实测宽度；两侧栏与详情右栏按它收窄，保证主内容优先。 */
  width: number;
  narrow: boolean;
  stacked: boolean;
  /** 左侧导航（图标栏文字 + 二级侧栏）是否收起，持久化到本机。 */
  navCollapsed: boolean;
  toggleNav: () => void;
  api: ApiFn;
  toast: ReturnType<typeof useToast>;
  page: PageKey;
  params: Record<string, string>;
  navigate: (page: PageKey, params?: Record<string, string>) => void;
  connections: ConnectionsView | null;
  server: ServerView | null;
  servers: ServerView[];
  user: RemoteUser | null;
  workspaces: RemoteWorkspace[];
  workspaceId: string;
  bootstrapError: string | null;
  loading: boolean;
  reloadConnections: () => Promise<void>;
  reloadBootstrap: () => Promise<void>;
  selectWorkspace: (workspaceId: string) => Promise<void>;
  statuses: IssueStatusEntry[];
  statusesLoading: boolean;
  locale: string;
  bump: number;
  invalidate: () => void;
}

const WorkbenchContext = createContext<WorkbenchValue | null>(null);

const NAV_KEY = "multica.navCollapsed";
type LocalStore = { getItem(key: string): string | null; setItem(key: string, value: string): void };
function localStore(): LocalStore | null {
  return (globalThis as { localStorage?: LocalStore }).localStorage ?? null;
}
function readNavCollapsed(): boolean {
  try {
    return localStore()?.getItem(NAV_KEY) === "1";
  } catch {
    return false;
  }
}
function writeNavCollapsed(value: boolean) {
  try {
    localStore()?.setItem(NAV_KEY, value ? "1" : "0");
  } catch {
    //  _native/隐私模式下写不进去就只保留本次会话状态
  }
}

export function useWorkbench(): WorkbenchValue {
  const value = useContext(WorkbenchContext);
  if (!value) throw new Error("useWorkbench must be used inside WorkbenchProvider");
  return value;
}

export function WorkbenchProvider({
  theme,
  compact,
  page,
  params,
  navigate,
  children,
}: {
  theme: PluginTheme;
  compact: boolean;
  page: PageKey;
  params: Record<string, string>;
  navigate: (page: PageKey, params?: Record<string, string>) => void;
  children: ReactNode;
}) {
  const api = useApi();
  const override = useLocaleOverride();
  const { locale: hostLocale, t: translate } = useI18n(messagesFor(override));
  bindTranslation((key, args) => translate(key as never, args as never));
  const locale = override === "auto" ? hostLocale : override;
  const hostToast = useToast();
  // 成功提示默认 3 秒收起，避免「已标记为已读」一类 toast 长时间停留
  const toast = useMemo<ReturnType<typeof useToast>>(
    () => ({
      show: (message, options) => hostToast.show(message, { durationMs: 3000, ...options }),
      error: (message) => hostToast.error(message),
    }),
    [hostToast],
  );
  const listRpc = useRpc(connectionsListRpc);
  const bootstrapRpcFn = useRpc(bootstrapRpc);
  const selectRpc = useRpc(workspaceSelectRpc);

  const [connections, setConnections] = useState<ConnectionsView | null>(null);
  const [remote, setRemote] = useState<{
    server: ServerView | null;
    user: RemoteUser | null;
    workspaces: RemoteWorkspace[];
    error: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [bump, setBump] = useState(0);
  const [width, setWidth] = useState(0);
  const [navCollapsed, setNavCollapsed] = useState(() => readNavCollapsed());
  const alive = useRef(true);

  const toggleNav = useCallback(() => {
    setNavCollapsed((prev) => {
      const next = !prev;
      writeNavCollapsed(next);
      return next;
    });
  }, []);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const reloadConnections = useCallback(async () => {
    try {
      const next = await listRpc({});
      if (alive.current) setConnections(next);
    } catch (cause) {
      if (alive.current) {
        toast.error(t("context.1", { a: errorMessage(cause) }));
      }
    }
  }, [listRpc, toast]);

  const reloadBootstrap = useCallback(async () => {
    setLoading(true);
    try {
      const next = await bootstrapRpcFn({});
      if (alive.current) setRemote(next);
    } catch (cause) {
      if (alive.current) {
        setRemote({
          server: null,
          user: null,
          workspaces: [],
          error: errorMessage(cause),
        });
      }
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [bootstrapRpcFn]);

  useEffect(() => {
    void (async () => {
      await reloadConnections();
      await reloadBootstrap();
    })();
  }, [reloadConnections, reloadBootstrap]);

  const server = useMemo(() => {
    if (remote?.server) return remote.server;
    if (!connections) return null;
    return connections.servers.find((item) => item.id === connections.activeServerId) ?? connections.servers[0] ?? null;
  }, [remote, connections]);

  const servers = connections?.servers ?? [];
  const workspaceId = server?.workspaceId ?? "";

  const invalidate = useCallback(() => setBump((value) => value + 1), []);

  const selectWorkspace = useCallback(
    async (nextWorkspaceId: string) => {
      if (!server) return;
      try {
        const next = await selectRpc({ serverId: server.id, workspaceId: nextWorkspaceId });
        if (alive.current) setConnections(next);
        await reloadBootstrap();
        await reloadConnections();
        invalidate();
        const workspace = remote?.workspaces.find((item) => item.id === nextWorkspaceId);
        toast.show(t("context.2", { a: workspace?.name ?? t("context.3") }), { variant: "success" });
      } catch (cause) {
        toast.error(t("context.4", { a: cause instanceof Error ? cause.message : String(cause) }));
      }
    },
    [server, selectRpc, reloadBootstrap, reloadConnections, invalidate, remote, toast],
  );

  const statusQuery = useQuery<IssueStatusEntry[]>(
    api,
    "/api/issue-statuses",
    { enabled: Boolean(server), select: (data) => asList<IssueStatusEntry>(data, "statuses") },
    `${server?.id ?? ""}:${bump}`,
  );

  const value: WorkbenchValue = {
    theme,
    compact,
    width,
    narrow: width > 0 && width < 1000,
    stacked: width > 0 && width < 820,
    navCollapsed,
    toggleNav,
    api,
    toast,
    page,
    params,
    navigate,
    locale,
    connections,
    server,
    servers,
    user: remote?.user ?? null,
    workspaces: remote?.workspaces ?? [],
    workspaceId,
    bootstrapError: remote?.error ?? null,
    loading,
    reloadConnections,
    reloadBootstrap,
    selectWorkspace,
    statuses: statusQuery.data ?? [],
    statusesLoading: statusQuery.loading,
    bump,
    invalidate,
  };

  return (
    <WorkbenchContext.Provider value={value}>
      <View style={{ flex: 1 }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {children}
      </View>
    </WorkbenchContext.Provider>
  );
}
