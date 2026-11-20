import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import os from "node:os";
import type { ConnectionsView, SaveConnectionInput, ServerView } from "../shared/contracts";
import { OFFICIAL_BASE_URL } from "../shared/contracts";
import { normalizeBaseUrl } from "./multica";

interface StoredServer {
  id: string;
  name: string;
  baseUrl: string;
  token: string;
  workspaceId: string | null;
  workspaceSlug: string | null;
  createdAt: string;
  updatedAt: string;
}

interface StoredState {
  version: 1;
  activeServerId: string | null;
  allowInternal: boolean;
  servers: StoredServer[];
}

const storeDir = path.join(process.env.PASEO_HOME?.trim() || path.join(os.homedir(), ".paseo"), "multica");
const storeFile = path.join(storeDir, "connections.json");

let cached: StoredState | null = null;
let writing: Promise<unknown> = Promise.resolve();

function officialName() {
  return "Multica 官方云";
}

function newId() {
  return `srv_${randomBytes(5).toString("hex")}`;
}

function maskToken(token: string) {
  if (!token) return "";
  const prefix = token.startsWith("mul_") ? "mul_" : token.slice(0, 2);
  if (token.length <= 12) return `${prefix}…`;
  return `${prefix}…${token.slice(-4)}`;
}

function seedState(): StoredState {
  const envToken = process.env.MULTICA_API_TOKEN?.trim() || "";
  const envBase = process.env.MULTICA_BASE_URL?.trim();
  const baseUrl = normalizeBaseUrl(envBase || OFFICIAL_BASE_URL);
  const now = new Date().toISOString();
  const server: StoredServer = {
    id: newId(),
    name: envBase ? "环境变量服务器" : officialName(),
    baseUrl,
    token: envToken,
    workspaceId: process.env.MULTICA_WORKSPACE_ID?.trim() || null,
    workspaceSlug: process.env.MULTICA_WORKSPACE_SLUG?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };
  return { version: 1, activeServerId: server.id, allowInternal: false, servers: [server] };
}

function coerceState(raw: unknown): StoredState {
  const fallback = seedState();
  if (!raw || typeof raw !== "object") return fallback;
  const input = raw as Partial<StoredState>;
  const servers = Array.isArray(input.servers)
    ? input.servers
        .filter((item): item is StoredServer => !!item && typeof item === "object" && typeof (item as StoredServer).baseUrl === "string")
        .map((item) => ({
          id: typeof item.id === "string" && item.id ? item.id : newId(),
          name: typeof item.name === "string" && item.name ? item.name : officialName(),
          baseUrl: normalizeBaseUrl(item.baseUrl),
          token: typeof item.token === "string" ? item.token : "",
          workspaceId: typeof item.workspaceId === "string" ? item.workspaceId : null,
          workspaceSlug: typeof item.workspaceSlug === "string" ? item.workspaceSlug : null,
          createdAt: typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString(),
          updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
        }))
    : [];
  if (servers.length === 0) return fallback;
  const activeServerId =
    typeof input.activeServerId === "string" && servers.some((server) => server.id === input.activeServerId)
      ? input.activeServerId
      : servers[0].id;
  return { version: 1, activeServerId, allowInternal: input.allowInternal === true, servers };
}

async function load(): Promise<StoredState> {
  if (cached) return cached;
  try {
    const text = await readFile(storeFile, "utf8");
    cached = coerceState(JSON.parse(text));
  } catch {
    cached = seedState();
  }
  return cached;
}

async function persist(state: StoredState) {
  await mkdir(storeDir, { recursive: true, mode: 0o700 });
  const tmp = `${storeFile}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(tmp, storeFile);
  await chmod(storeFile, 0o600);
  cached = state;
}

function mutate<T>(fn: (state: StoredState) => T | Promise<T>): Promise<T> {
  const task = writing.then(async () => {
    const state = await load();
    const result = await fn(state);
    await persist(state);
    return result;
  });
  writing = task.catch(() => undefined);
  return task;
}

function toView(server: StoredServer): ServerView {
  return {
    id: server.id,
    name: server.name,
    baseUrl: server.baseUrl,
    workspaceId: server.workspaceId,
    workspaceSlug: server.workspaceSlug,
    tokenConfigured: server.token.length > 0,
    tokenMasked: maskToken(server.token),
    isOfficial: server.baseUrl === OFFICIAL_BASE_URL,
    updatedAt: server.updatedAt,
  };
}

function view(state: StoredState): ConnectionsView {
  return {
    activeServerId: state.activeServerId,
    servers: state.servers.map(toView),
    allowInternal: state.allowInternal,
    storePath: storeFile,
  };
}

export async function readConnections(): Promise<ConnectionsView> {
  return view(await load());
}

export interface ResolvedServer {
  id: string;
  name: string;
  baseUrl: string;
  token: string;
  workspaceId: string | null;
  workspaceSlug: string | null;
  allowInternal: boolean;
}

export async function resolveServer(serverId?: string): Promise<ResolvedServer> {
  const state = await load();
  const target =
    (serverId ? state.servers.find((server) => server.id === serverId) : undefined) ??
    state.servers.find((server) => server.id === state.activeServerId) ??
    state.servers[0];
  if (!target) throw new Error("尚未配置 Multica 服务器");
  return {
    id: target.id,
    name: target.name,
    baseUrl: target.baseUrl,
    token: target.token,
    workspaceId: target.workspaceId,
    workspaceSlug: target.workspaceSlug,
    allowInternal: state.allowInternal,
  };
}

export async function saveConnection(input: SaveConnectionInput): Promise<ConnectionsView> {
  return mutate((state) => {
    const now = new Date().toISOString();
    const baseUrl = normalizeBaseUrl(input.baseUrl);
    const existing = input.id ? state.servers.find((server) => server.id === input.id) : undefined;
    if (existing) {
      existing.name = input.name.trim() || existing.name;
      existing.baseUrl = baseUrl;
      if (typeof input.token === "string" && input.token.trim().length > 0) existing.token = input.token.trim();
      if (input.workspaceId !== undefined) existing.workspaceId = input.workspaceId;
      existing.updatedAt = now;
    } else {
      const server: StoredServer = {
        id: newId(),
        name: input.name.trim() || new URL(baseUrl).host,
        baseUrl,
        token: (input.token ?? "").trim(),
        workspaceId: input.workspaceId ?? null,
        workspaceSlug: null,
        createdAt: now,
        updatedAt: now,
      };
      state.servers.push(server);
      if (!state.activeServerId) state.activeServerId = server.id;
    }
    if (!state.activeServerId) state.activeServerId = state.servers[0]?.id ?? null;
    return view(state);
  });
}

export async function removeConnection(id: string): Promise<ConnectionsView> {
  return mutate((state) => {
    state.servers = state.servers.filter((server) => server.id !== id);
    if (state.activeServerId === id) state.activeServerId = state.servers[0]?.id ?? null;
    return view(state);
  });
}

export async function activateConnection(id: string): Promise<ConnectionsView> {
  return mutate((state) => {
    if (state.servers.some((server) => server.id === id)) state.activeServerId = id;
    return view(state);
  });
}

export async function selectWorkspace(serverId: string, workspaceId: string | null): Promise<ConnectionsView> {
  return mutate((state) => {
    const server = state.servers.find((item) => item.id === serverId);
    if (server) {
      server.workspaceId = workspaceId;
      server.updatedAt = new Date().toISOString();
    }
    return view(state);
  });
}

export async function updateWorkspaceMeta(serverId: string, workspaceId: string, slug: string): Promise<void> {
  await mutate((state) => {
    const server = state.servers.find((item) => item.id === serverId);
    if (server) {
      server.workspaceId = workspaceId;
      server.workspaceSlug = slug;
    }
  });
}

export async function savePreferences(input: { allowInternal?: boolean }): Promise<ConnectionsView> {
  return mutate((state) => {
    if (typeof input.allowInternal === "boolean") state.allowInternal = input.allowInternal;
    return view(state);
  });
}

export function connectionsStorePath() {
  return storeFile;
}
