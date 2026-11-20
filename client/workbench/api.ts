import { t } from "./i18n";
import { useRpc } from "@getpaseo/plugin/client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequestRpc } from "../../shared/contracts";
import type { z } from "zod";
import type { apiRequestInput } from "../../shared/contracts";

type ApiRequestInput = z.infer<typeof apiRequestInput>;

export interface ApiResponse {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: string;
  code?: string;
  durationMs: number;
}

export type ApiFn = (input: ApiRequestInput) => Promise<ApiResponse>;

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

export function useApi(): ApiFn {
  return useRpc(apiRequestRpc) as unknown as ApiFn;
}

export interface QueryResult<T> {
  data: T | null;
  error: string | null;
  status: number | null;
  loading: boolean;
  refreshing: boolean;
  lastUpdated: number | null;
  refresh: () => void;
  setData: (data: T | null) => void;
}

export interface QueryOptions<T> {
  query?: QueryParams;
  enabled?: boolean;
  pollMs?: number;
  select?: (data: unknown) => T;
  serverId?: string;
  workspaceId?: string;
}

/**
 * GET helper with manual refresh, optional polling and stale-response protection.
 * `key` should change whenever the caller wants a fresh request.
 */
export function useQuery<T = unknown>(
  api: ApiFn,
  path: string | null,
  options: QueryOptions<T> = {},
  key?: string,
): QueryResult<T> {
  const { query, enabled = true, pollMs, select, serverId, workspaceId } = options;
  const queryKey = JSON.stringify(query ?? {});
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(path) && enabled);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const seq = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const manualRefresh = useRef(false);
  const selectRef = useRef(select);
  selectRef.current = select;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (isManual: boolean) => {
      if (!path || !enabled) return;
      // 慢接口（如运行中 messages 长轮询）时跳过本轮自动轮询，避免请求堆积堵死 RPC 通道
      if (!isManual && inFlight.current) return;
      inFlight.current = true;
      const ticket = ++seq.current;
      if (isManual) setRefreshing(true);
      else setLoading(true);
      try {
        const parsed = JSON.parse(queryKey) as QueryParams;
        const result = await api({
          method: "GET",
          path,
          query: parsed as ApiRequestInput["query"],
          serverId,
          workspaceId,
        });
        if (!mounted.current || ticket !== seq.current) return;
        setStatus(result.status || null);
        if (result.ok) {
          const next = selectRef.current ? selectRef.current(result.data) : (result.data as T);
          setData(next);
          setError(null);
          setLastUpdated(Date.now());
        } else {
          setError(result.error ?? t("api.1", { a: result.status }));
        }
      } catch (cause) {
        if (!mounted.current || ticket !== seq.current) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        inFlight.current = false;
        if (mounted.current && ticket === seq.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [api, path, enabled, queryKey, serverId, workspaceId],
  );

  useEffect(() => {
    if (!path || !enabled) {
      setLoading(false);
      return;
    }
    void run(manualRefresh.current);
    manualRefresh.current = false;
     
  }, [run, key]);

  useEffect(() => {
    if (!pollMs || !path || !enabled) return;
    const timer = setInterval(() => void run(false), pollMs);
    return () => clearInterval(timer);
  }, [pollMs, path, enabled, run]);

  const refresh = useCallback(() => {
    manualRefresh.current = true;
    void run(true);
  }, [run]);

  return { data, error, status, loading, refreshing, lastUpdated, refresh, setData };
}

export interface PagedResult<T> {
  items: T[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

/** offset 分页 + 瀑布流：一次只取一页、串行防请求堆积；key/查询变化时重置回第一页。 */
export function usePagedQuery<T = Record<string, unknown>>(
  api: ApiFn,
  path: string | null,
  options: { query?: QueryParams; pageSize?: number; enabled?: boolean; serverId?: string; workspaceId?: string } = {},
  key?: string,
  ...listKeys: string[]
): PagedResult<T> {
  const { query, pageSize = 30, enabled = true, serverId, workspaceId } = options;
  const queryKey = JSON.stringify(query ?? {});
  const keysKey = listKeys.join("|");
  const keysRef = useRef(listKeys);
  keysRef.current = listKeys;
  const [items, setItems] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(Boolean(path) && enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const inFlight = useRef(false);
  const mounted = useRef(true);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(
    async (reset: boolean) => {
      if (!path || !enabled || inFlight.current) return;
      inFlight.current = true;
      const ticket = ++seq.current;
      if (reset) setLoading(true);
      else setLoadingMore(true);
      try {
        const parsed = JSON.parse(queryKey) as QueryParams;
        const result = await api({
          method: "GET",
          path,
          query: { ...parsed, limit: pageSize, offset: reset ? 0 : itemsRef.current.length },
          serverId,
          workspaceId,
        });
        if (!mounted.current || ticket !== seq.current) return;
        if (result.ok) {
          const list = asList<T>(result.data, ...keysRef.current);
          const envelope =
            result.data && typeof result.data === "object" && !Array.isArray(result.data)
              ? (result.data as Record<string, unknown>)
              : {};
          const nextTotal = Number(envelope.total ?? NaN);
          setItems((prev) => (reset ? list : [...prev, ...list]));
          setTotal(Number.isFinite(nextTotal) ? nextTotal : reset ? list.length : itemsRef.current.length + list.length);
          setError(null);
        } else {
          setError(result.error ?? t("api.1", { a: result.status }));
        }
      } catch (cause) {
        if (mounted.current && ticket === seq.current) setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        inFlight.current = false;
        if (mounted.current && ticket === seq.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [api, path, enabled, queryKey, pageSize, serverId, workspaceId],
  );

  useEffect(() => {
    if (!path || !enabled) {
      setLoading(false);
      return;
    }
    setItems([]);
    setTotal(0);
    void run(true);
     
  }, [run, key, keysKey]);

  const hasMore = items.length < total;
  const loadMore = useCallback(() => {
    if (hasMore) void run(false);
  }, [hasMore, run]);
  const refresh = useCallback(() => {
    void run(true);
  }, [run]);

  return { items, total, loading, loadingMore, error, hasMore, loadMore, refresh };
}

export function asList<T = Record<string, unknown>>(data: unknown, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === "object") {
    for (const key of keys) {
      const value = (data as Record<string, unknown>)[key];
      if (Array.isArray(value)) return value as T[];
    }
    for (const fallback of ["items", "list", "results", "data"]) {
      const value = (data as Record<string, unknown>)[fallback];
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}

export function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

export function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : typeof value === "number" ? String(value) : fallback;
}

export function bool(value: unknown): boolean {
  return value === true || value === "true" || value === 1;
}
