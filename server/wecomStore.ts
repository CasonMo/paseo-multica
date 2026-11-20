import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import os from "node:os";
import { resolveServer } from "./store";

export interface WecomBinding {
  sessionId: string;
  agentId: string;
  label: string;
  updatedAt: string;
}

/** 一个企业微信机器人绑定到「某 Multica 服务器 + 某工作区」，可同时跑多个。 */
export interface WecomBot {
  id: string;
  serverId: string;
  workspaceId: string | null;
  enabled: boolean;
  botId: string;
  secret: string;
  agentId: string | null;
  pushUnread: boolean;
  delegate: boolean;
  pushIntervalSec: number;
  targetChatId: string;
  bindings: Record<string, WecomBinding>;
  pushedIds: string[];
  updatedAt: string;
}

export interface WecomState {
  version: 2;
  bots: WecomBot[];
}

const storeDir = path.join(process.env.PASEO_HOME?.trim() || path.join(os.homedir(), ".paseo"), "multica");
const storeFile = path.join(storeDir, "wecom.json");

let cached: WecomState | null = null;
let writing: Promise<unknown> = Promise.resolve();

function newId() {
  return `wx_${randomBytes(5).toString("hex")}`;
}

function coerceBot(raw: unknown, fallbackServer: string, fallbackWorkspace: string | null): WecomBot | null {
  if (!raw || typeof raw !== "object") return null;
  const input = raw as Partial<WecomBot>;
  if (typeof input.botId !== "string") return null;
  const bindings: Record<string, WecomBinding> = {};
  if (input.bindings && typeof input.bindings === "object") {
    for (const [chatid, value] of Object.entries(input.bindings)) {
      if (!value || typeof value !== "object") continue;
      const binding = value as Partial<WecomBinding>;
      if (typeof binding.sessionId !== "string" || typeof binding.agentId !== "string") continue;
      bindings[chatid] = {
        sessionId: binding.sessionId,
        agentId: binding.agentId,
        label: typeof binding.label === "string" ? binding.label : chatid,
        updatedAt: typeof binding.updatedAt === "string" ? binding.updatedAt : new Date().toISOString(),
      };
    }
  }
  const interval = Number(input.pushIntervalSec);
  return {
    id: typeof input.id === "string" && input.id ? input.id : newId(),
    serverId: typeof input.serverId === "string" && input.serverId ? input.serverId : fallbackServer,
    workspaceId: typeof input.workspaceId === "string" ? input.workspaceId : fallbackWorkspace,
    enabled: input.enabled === true,
    botId: input.botId,
    secret: typeof input.secret === "string" ? input.secret : "",
    agentId: typeof input.agentId === "string" && input.agentId ? input.agentId : null,
    pushUnread: input.pushUnread !== false,
    delegate: input.delegate === true,
    pushIntervalSec: Number.isFinite(interval) && interval >= 15 ? Math.min(600, Math.round(interval)) : 60,
    targetChatId: typeof input.targetChatId === "string" ? input.targetChatId : "",
    bindings,
    pushedIds: Array.isArray(input.pushedIds) ? input.pushedIds.filter((id): id is string => typeof id === "string").slice(-200) : [],
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : new Date().toISOString(),
  };
}

async function seed(): Promise<WecomState> {
  return { version: 2, bots: [] };
}

async function coerce(raw: unknown): Promise<WecomState> {
  const fallback = await seed();
  if (!raw || typeof raw !== "object") return fallback;
  const input = raw as Partial<WecomState> & Partial<WecomBot>;
  if (Array.isArray(input.bots)) {
    const bots = input.bots
      .map((bot) => coerceBot(bot, "", null))
      .filter((bot): bot is WecomBot => bot !== null);
    return { version: 2, bots };
  }
  //  v1 单机器人配置迁移为一条绑定到当前活跃服务器/工作区的记录
  const legacy = coerceBot(input, "", null);
  if (legacy && (legacy.botId || legacy.secret)) {
    try {
      const server = await resolveServer();
      legacy.serverId = server.id;
      legacy.workspaceId = server.workspaceId;
    } catch {
      //  尚未配置服务器时保留空值，界面会提示补选
    }
    return { version: 2, bots: [legacy] };
  }
  return fallback;
}

async function load(): Promise<WecomState> {
  if (cached) return cached;
  try {
    cached = await coerce(JSON.parse(await readFile(storeFile, "utf8")));
  } catch {
    cached = await seed();
  }
  return cached;
}

async function persist(state: WecomState) {
  await mkdir(storeDir, { recursive: true, mode: 0o700 });
  const tmp = `${storeFile}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(tmp, storeFile);
  await chmod(storeFile, 0o600);
  cached = state;
}

export function mutateWecom<T>(fn: (state: WecomState) => T | Promise<T>): Promise<T> {
  const task = writing.then(async () => {
    const state = await load();
    const result = await fn(state);
    await persist(state);
    return result;
  });
  writing = task.catch(() => undefined);
  return task;
}

export async function readWecom(): Promise<WecomState> {
  return load();
}

export function newBotId() {
  return newId();
}

export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "…";
  return `${secret.slice(0, 3)}…${secret.slice(-4)}`;
}

export function wecomStorePath() {
  return storeFile;
}