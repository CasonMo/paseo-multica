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
  inboxBadgeRpc,
  issueInsightsRpc,
  preferencesSaveRpc,
  workspaceSelectRpc,
  taskLogRpc,
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
  type ResolvedServer,
} from "./store";

export function createHandlers() {
  const logInflight = new Map<string, Promise<RpcOutput<typeof taskLogRpc>>>();
  const list = async () => readConnections();

  const save = async (
    input: RpcInput<typeof connectionsSaveRpc>,
  ): Promise<RpcOutput<typeof connectionsSaveRpc>> => {
    const name = input.name.trim();
    if (!name) throw new Error("err.name_required");
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    if (!/^https?:\/\/[^/\s]+/i.test(baseUrl)) throw new Error("err.invalid_url");
    const token = input.token?.trim();
    if (token && !/^[A-Za-z0-9_\-.]{8,}$/.test(token)) throw new Error("err.invalid_token");
    // 目的地变更时禁止沿用旧 Key：旧凭据绝不能发往/留存到新服务器
    if (input.id) {
      const stored = (await readConnections()).servers.find((server) => server.id === input.id);
      if (stored && stored.baseUrl !== baseUrl && !token) {
        throw new Error("err.destination_key_required");
      }
    }
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
      if (input.id && baseUrl && baseUrl !== stored.baseUrl && !token) {
        return { ok: false, error: "err.destination_key_required" };
      }
      baseUrl = baseUrl || stored.baseUrl;
      token = token || stored.token;
      workspaceId = workspaceId ?? stored.workspaceId;
    }
    if (!token) return { ok: false, error: "err.no_token" };
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
        error: "err.no_token",
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
        error: probe.error ?? "err.connect_failed",
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

  const inboxBadge = async (): Promise<RpcOutput<typeof inboxBadgeRpc>> => {
    const fetchedAt = new Date().toISOString();
    let server: ResolvedServer;
    try {
      server = await resolveServer();
    } catch {
      return { count: 0, serverId: null, workspaceId: null, error: null, fetchedAt };
    }
    const base = { serverId: server.id, workspaceId: server.workspaceId, fetchedAt };
    if (!server.token) return { ...base, count: 0, error: null };
    const result = await requestMultica({
      server,
      method: "GET",
      path: "/api/inbox/unread-count",
      workspaceId: server.workspaceId,
      allowInternal: server.allowInternal,
    });
    if (!result.ok) return { ...base, count: 0, error: result.error ?? "err.inbox_read" };
    const payload = result.data && typeof result.data === "object" ? (result.data as Record<string, unknown>) : {};
    const raw = typeof result.data === "number" ? result.data : Number(payload.count ?? payload.unread ?? 0);
    const count = Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0;
    return { ...base, count, error: null };
  };

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

  const issueInsights = async (
    input: RpcInput<typeof issueInsightsRpc>,
  ): Promise<RpcOutput<typeof issueInsightsRpc>> => {
    const server = await resolveServer();
    const call = async (path: string) => {
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 12000));
      const fetch = requestMultica({ server, method: "GET", path, workspaceId: server.workspaceId, allowInternal: server.allowInternal, timeoutMs: 12000 }).then((r) => (r.ok ? r.data : null));
      return Promise.race([fetch, timeout]);
    };
    const [runsRaw, usageRaw, timelineRaw, commentsRaw] = await Promise.all([
      call(`/api/issues/${input.issueId}/task-runs?limit=200`),
      call(`/api/issues/${input.issueId}/usage`),
      call(`/api/issues/${input.issueId}/timeline?limit=200`),
      call(`/api/issues/${input.issueId}/comments?limit=200`),
    ]);
    const asArr = (v: unknown): Record<string, unknown>[] => {
      if (Array.isArray(v)) return v as Record<string, unknown>[];
      if (v && typeof v === "object") {
        for (const key of ["tasks", "runs", "timeline", "entries", "items", "comments"]) {
          const inner = (v as Record<string, unknown>)[key];
          if (Array.isArray(inner)) return inner as Record<string, unknown>[];
        }
      }
      return [];
    };
    const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : v);
    const runs = asArr(runsRaw).map((r) => ({ ...r, result: r.result && typeof r.result === "object" ? { ...r.result, output: clip((r.result as Record<string, unknown>).output, 300) } : r.result }));
    const timeline = asArr(timelineRaw).map((e) => ({ ...e, details: e.details && typeof e.details === "object" ? { ...e.details, handoff_note: clip((e.details as Record<string, unknown>).handoff_note, 400) } : e.details }));
    const comments = asArr(commentsRaw).map((c) => ({ ...c, content: clip(c.content, 4000) }));
    return {
      runs,
      usage: usageRaw && typeof usageRaw === "object" && !Array.isArray(usageRaw) ? (usageRaw as Record<string, unknown>) : {},
      timeline,
      comments,
      error: null,
    };
  };

  const taskLog = async (
    input: RpcInput<typeof taskLogRpc>,
  ): Promise<RpcOutput<typeof taskLogRpc>> => {
    // 运行中 messages 可能长轮询：同 task 的并发请求合并为一次上游 fetch，避免占满连接池
    const existing = logInflight.get(input.taskId);
    if (existing) return existing;
    const promise = (async (): Promise<RpcOutput<typeof taskLogRpc>> => {
      const server = await resolveServer();
      const result = await requestMultica({ server, method: "GET", path: `/api/tasks/${input.taskId}/messages`, workspaceId: server.workspaceId, allowInternal: server.allowInternal });
      const data = result.ok ? result.data : null;
      const raw = Array.isArray(data) ? data : data && typeof data === "object" && Array.isArray((data as Record<string, unknown>).messages) ? (data as Record<string, unknown>).messages : [];
      const clip = (v: unknown, n: number) => (typeof v === "string" ? v.slice(0, n) : undefined);
      const messages = (raw as Record<string, unknown>[]).slice(-300).map((m) => {
        const input = (m.input ?? {}) as Record<string, unknown>;
        return {
          call_id: m.call_id,
          seq: m.seq,
          type: m.type,
          tool: m.tool,
          created_at: m.created_at,
          input: {
            command: clip(input.command, 1500),
            description: clip(input.description, 300),
            file_path: clip(input.file_path, 300),
            pattern: clip(input.pattern, 300),
          },
          output: clip(m.output, 1500),
          content: clip(m.content, 1500),
        };
      });
      return { messages: messages as Record<string, unknown>[], error: result.ok ? null : result.error ?? "err.steps_read" };
    })();
    logInflight.set(input.taskId, promise);
    const clear = () => logInflight.delete(input.taskId);
    promise.then(clear, clear);
    return promise;
  };

  return {
    list: listHandler,
    save,
    remove,
    activate,
    test,
    bootstrap,
    request,
    selectWorkspace: selectWorkspaceHandler,
    preferences,
    inboxBadge,
    issueInsights,
    taskLog,
  };
}
