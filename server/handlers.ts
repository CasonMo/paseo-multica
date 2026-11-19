import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import {
  apiRequestRpc,
  bootstrapRpc,
  connectionTestOutput,
  connectionsActivateRpc,
  connectionsListRpc,
  connectionsRemoveRpc,
  connectionsSaveRpc,
  connectionsTestRpc,
  preferencesSaveRpc,
  workspaceSelectRpc,
} from "../shared/contracts";
import { normalizeBaseUrl, probeConnection, requestMultica } from "./multica";
import {
  activateConnection,
  readConnections,
  removeConnection,
  resolveServer,
  saveConnection,
  savePreferences,
  selectWorkspace,
  updateWorkspaceMeta,
} from "./store";

export function createHandlers() {
  const list = async () => readConnections();

  const save = async (
    input: RpcInput<typeof connectionsSaveRpc>,
  ): Promise<RpcOutput<typeof connectionsSaveRpc>> => {
    const name = input.name.trim();
    if (!name) throw new Error("请填写服务器名称");
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    if (!/^https?:\/\/[^/\s]+/i.test(baseUrl)) throw new Error("服务器地址不合法");
    const token = input.token?.trim();
    if (token && !/^[A-Za-z0-9_\-.]{8,}$/.test(token)) throw new Error("API Key 格式不正确");
    return saveConnection({ ...input, name, baseUrl, token: token || undefined });
  };

  const test = async (
    input: RpcInput<typeof connectionsTestRpc>,
  ): Promise<RpcOutput<typeof connectionsTestRpc>> => {
    let baseUrl = input.baseUrl?.trim() ? normalizeBaseUrl(input.baseUrl) : "";
    let token = input.token?.trim() || "";
    let workspaceId: string | null = input.workspaceId?.trim() || null;
    if (input.id || !baseUrl) {
      const stored = await resolveServer(input.id);
      baseUrl = baseUrl || stored.baseUrl;
      token = token || stored.token;
      workspaceId = workspaceId ?? stored.workspaceId;
    }
    if (!token) return { ok: false, error: "请填写 API Key" };
    const result = await probeConnection({
      id: "probe",
      name: "probe",
      baseUrl,
      token,
      workspaceId,
      workspaceSlug: null,
      allowInternal: false,
    });
    return connectionTestOutput.parse(result);
  };

  const bootstrap = async (
    input: RpcInput<typeof bootstrapRpc>,
  ): Promise<RpcOutput<typeof bootstrapRpc>> => {
    const server = await resolveServer(input.serverId);
    const fetchedAt = new Date().toISOString();
    if (!server.token) {
      const view = await readConnections();
      return {
        server: view.servers.find((item) => item.id === server.id) ?? null,
        user: null,
        workspaces: [],
        error: "尚未配置 API Key",
        fetchedAt,
      };
    }
    const probe = await probeConnection(server);
    if (!probe.ok) {
      const view = await readConnections();
      return {
        server: view.servers.find((item) => item.id === server.id) ?? null,
        user: null,
        workspaces: [],
        error: probe.error ?? "连接失败",
        fetchedAt,
      };
    }
    const workspaces = probe.workspaces ?? [];
    if (workspaces.length > 0) {
      const current = workspaces.find((workspace) => workspace.id === server.workspaceId);
      if (current) {
        if (current.slug !== server.workspaceSlug) await updateWorkspaceMeta(server.id, current.id, current.slug);
      } else {
        const first = workspaces[0];
        await updateWorkspaceMeta(server.id, first.id, first.slug);
      }
    }
    const view = await readConnections();
    return {
      server: view.servers.find((item) => item.id === server.id) ?? null,
      user: probe.user ?? null,
      workspaces,
      error: null,
      fetchedAt,
    };
  };

  const request = async (
    input: RpcInput<typeof apiRequestRpc>,
  ): Promise<RpcOutput<typeof apiRequestRpc>> => {
    const server = await resolveServer(input.serverId);
    const workspaceId = input.workspaceId === undefined ? server.workspaceId : input.workspaceId;
    return requestMultica({
      server,
      method: input.method,
      path: input.path,
      query: input.query,
      body: input.body,
      workspaceId,
      allowInternal: server.allowInternal,
    });
  };

  const selectWorkspaceHandler = async (
    input: RpcInput<typeof workspaceSelectRpc>,
  ): Promise<RpcOutput<typeof workspaceSelectRpc>> => selectWorkspace(input.serverId, input.workspaceId);

  const preferences = async (
    input: RpcInput<typeof preferencesSaveRpc>,
  ): Promise<RpcOutput<typeof preferencesSaveRpc>> => savePreferences(input);

  const remove = async (
    input: RpcInput<typeof connectionsRemoveRpc>,
  ): Promise<RpcOutput<typeof connectionsRemoveRpc>> => removeConnection(input.id);

  const activate = async (
    input: RpcInput<typeof connectionsActivateRpc>,
  ): Promise<RpcOutput<typeof connectionsActivateRpc>> => activateConnection(input.id);

  const listHandler = async (
    _input: RpcInput<typeof connectionsListRpc>,
  ): Promise<RpcOutput<typeof connectionsListRpc>> => list();

  return { list: listHandler, save, remove, activate, test, bootstrap, request, selectWorkspace: selectWorkspaceHandler, preferences };
}
