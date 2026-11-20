import type { ApiRequestOutput } from "../shared/contracts";
import { OFFICIAL_BASE_URL } from "../shared/contracts";
import { findRoute, isBlockedRoute, isInternalRoute, routeMatches } from "../shared/routes";
import type { ResolvedServer } from "./store";

const REQUEST_TIMEOUT_MS = 30_000;

export function normalizeBaseUrl(raw: string): string {
  let value = raw.trim();
  if (!value) return OFFICIAL_BASE_URL;
  if (!/^https?:\/\//i.test(value)) {
    const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?/i.test(value);
    value = `${local ? "http" : "https"}://${value}`;
  }
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase();
    if (host === "multica.ai" || host === "app.multica.ai" || host === "www.multica.ai") {
      return OFFICIAL_BASE_URL;
    }
    let pathname = url.pathname.replace(/\/+$/, "");
    pathname = pathname.replace(/\/api$/i, "");
    return `${url.protocol}//${url.host}${pathname}`;
  } catch {
    return value.replace(/\/+$/, "").replace(/\/api$/i, "");
  }
}

interface RequestOptions {
  server: ResolvedServer;
  method: string;
  path: string;
  query?: Record<string, string | number | boolean>;
  body?: unknown;
  allowInternal?: boolean;
  timeoutMs?: number;
  skipRouteCheck?: boolean;
}

function buildUrl(server: ResolvedServer, path: string, query?: Record<string, string | number | boolean>) {
  const url = new URL(`${server.baseUrl}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function authHeaders(server: ResolvedServer, workspaceId?: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "paseo-multica/0.2",
  };
  if (server.token) headers.Authorization = `Bearer ${server.token}`;
  if (workspaceId) headers["X-Workspace-ID"] = workspaceId;
  return headers;
}

export async function requestMultica(
  options: RequestOptions & { workspaceId?: string | null },
): Promise<ApiRequestOutput> {
  const started = Date.now();
  const { server, method, path } = options;
  const upper = method.toUpperCase();
  // 路由白名单按端点匹配，query 不属于路由；内嵌 query 的 path 需剥离后再校验
  const routePath = path.split("?")[0];

  if (!path.startsWith("/api/")) {
    return { ok: false, status: 0, error: "仅支持 /api 下的 Multica 接口", code: "invalid_path", durationMs: 0 };
  }
  if (path.includes("..") || path.includes("//") || path.length > 2000) {
    return { ok: false, status: 0, error: "接口路径不合法", code: "invalid_path", durationMs: 0 };
  }
  if (isBlockedRoute(routePath)) {
    return { ok: false, status: 0, error: "该接口不接受个人访问令牌，已阻止", code: "blocked_route", durationMs: 0 };
  }
  if (!options.skipRouteCheck && !routeMatches(upper, routePath)) {
    return {
      ok: false,
      status: 0,
      error: `未在路由表中找到 ${upper} ${routePath}，请检查参数占位符`,
      code: "unknown_route",
      durationMs: 0,
    };
  }
  if (isInternalRoute(routePath) && !options.allowInternal && !server.allowInternal) {
    return {
      ok: false,
      status: 0,
      error: "守护进程接口属于执行器内部协议，请在设置中开启「允许内部接口」后再调用",
      code: "internal_route",
      durationMs: 0,
    };
  }
  if (!server.token) {
    return { ok: false, status: 0, error: "尚未配置 API Key，请到 Multica 设置中填写", code: "no_token", durationMs: 0 };
  }

  const headers = authHeaders(server, options.workspaceId ?? server.workspaceId);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  const init: RequestInit = { method: upper, headers, signal: controller.signal };
  if (options.body !== undefined && upper !== "GET") {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  try {
    const response = await fetch(buildUrl(server, path, options.query), init);
    const text = await response.text();
    let data: unknown = text;
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = text;
      }
    } else {
      data = null;
    }
    if (response.ok) {
      return { ok: true, status: response.status, data, durationMs: Date.now() - started };
    }
    const payload = (data && typeof data === "object" ? data : {}) as { error?: unknown; code?: unknown; message?: unknown };
    const error =
      typeof payload.error === "string"
        ? payload.error
        : typeof payload.message === "string"
          ? payload.message
          : typeof data === "string" && data.trim()
            ? data.trim().slice(0, 300)
            : `请求失败 (HTTP ${response.status})`;
    return {
      ok: false,
      status: response.status,
      data,
      error,
      code: typeof payload.code === "string" ? payload.code : undefined,
      durationMs: Date.now() - started,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const friendly = /timeout|aborted/i.test(message)
      ? "请求超时，请检查网络或服务器地址"
      : /fetch failed|ENOTFOUND|ECONNREFUSED|EAI_AGAIN/i.test(message)
        ? `无法连接到 ${server.baseUrl}，请检查地址、网络或代理`
        : message;
    return { ok: false, status: 0, error: friendly, code: "network_error", durationMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

export interface ProbeResult {
  ok: boolean;
  error?: string;
  user?: { id: string; name: string; email: string; avatar_url?: string | null } | null;
  workspaces?: Array<{ id: string; name: string; slug: string; issue_prefix?: string; description?: string | null; avatar_url?: string | null }>;
}

export async function probeConnection(server: ResolvedServer): Promise<ProbeResult> {
  const me = await requestMultica({ server, method: "GET", path: "/api/me", skipRouteCheck: true });
  if (!me.ok) return { ok: false, error: me.error ?? `HTTP ${me.status}` };
  const workspaces = await requestMultica({ server, method: "GET", path: "/api/workspaces", skipRouteCheck: true });
  return {
    ok: true,
    user: (me.data as ProbeResult["user"]) ?? null,
    workspaces: workspaces.ok && Array.isArray(workspaces.data) ? (workspaces.data as ProbeResult["workspaces"]) : [],
  };
}

/** Resolve a route's templated path into a concrete one. */
export function fillRoutePath(template: string, values: Record<string, string>): string {
  return template.replace(/\{([^/]+)\}/g, (_match, key: string) => encodeURIComponent(values[key] ?? `{${key}}`));
}

export function describeRoute(method: string, path: string): string {
  const match = findRoute(method, path);
  return match ? `${match[0]} ${match[1]}` : `${method} ${path}`;
}
