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
  | "api"
  | "settings";

export interface WorkbenchValue {
  theme: PluginTheme;
  compact: boolean;
  /** 插件面板实测宽度；两侧栏与详情右栏按它收窄，保证主内容优先。 */
  width: number;
  narrow: boolean;
  stacked: boolean;
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
  bump: number;
  invalidate: () => void;
}

const WorkbenchContext = createContext<WorkbenchValue | null>(null);

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
  const toast = useToast();
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
  const alive = useRef(true);

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
        toast.error(`读取连接配置失败：${cause instanceof Error ? cause.message : String(cause)}`);
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
          error: cause instanceof Error ? cause.message : String(cause),
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
        toast.show(`已切换到 ${workspace?.name ?? "新工作区"}`, { variant: "success" });
      } catch (cause) {
        toast.error(`切换工作区失败：${cause instanceof Error ? cause.message : String(cause)}`);
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
    api,
    toast,
    page,
    params,
    navigate,
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
