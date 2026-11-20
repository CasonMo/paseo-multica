import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import os from "node:os";

export interface WecomBinding {
  sessionId: string;
  agentId: string;
  label: string;
  updatedAt: string;
}

export interface WecomConfig {
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

const storeDir = path.join(process.env.PASEO_HOME?.trim() || path.join(os.homedir(), ".paseo"), "multica");
const storeFile = path.join(storeDir, "wecom.json");

let cached: WecomConfig | null = null;
let writing: Promise<unknown> = Promise.resolve();

function seed(): WecomConfig {
  return {
    enabled: false,
    botId: "",
    secret: "",
    agentId: null,
    pushUnread: true,
    delegate: false,
    pushIntervalSec: 60,
    targetChatId: "",
    bindings: {},
    pushedIds: [],
    updatedAt: new Date().toISOString(),
  };
}

function coerce(raw: unknown): WecomConfig {
  const fallback = seed();
  if (!raw || typeof raw !== "object") return fallback;
  const input = raw as Partial<WecomConfig>;
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
        updatedAt: typeof binding.updatedAt === "string" ? binding.updatedAt : fallback.updatedAt,
      };
    }
  }
  const interval = Number(input.pushIntervalSec);
  return {
    enabled: input.enabled === true,
    botId: typeof input.botId === "string" ? input.botId : "",
    secret: typeof input.secret === "string" ? input.secret : "",
    agentId: typeof input.agentId === "string" && input.agentId ? input.agentId : null,
    pushUnread: input.pushUnread !== false,
    delegate: input.delegate === true,
    pushIntervalSec: Number.isFinite(interval) && interval >= 15 ? Math.min(600, Math.round(interval)) : 60,
    targetChatId: typeof input.targetChatId === "string" ? input.targetChatId : "",
    bindings,
    pushedIds: Array.isArray(input.pushedIds) ? input.pushedIds.filter((id): id is string => typeof id === "string").slice(-200) : [],
    updatedAt: typeof input.updatedAt === "string" ? input.updatedAt : fallback.updatedAt,
  };
}

async function load(): Promise<WecomConfig> {
  if (cached) return cached;
  try {
    cached = coerce(JSON.parse(await readFile(storeFile, "utf8")));
  } catch {
    cached = seed();
  }
  return cached;
}

async function persist(state: WecomConfig) {
  await mkdir(storeDir, { recursive: true, mode: 0o700 });
  const tmp = `${storeFile}.${randomBytes(4).toString("hex")}.tmp`;
  await writeFile(tmp, JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(tmp, storeFile);
  await chmod(storeFile, 0o600);
  cached = state;
}

export function mutateWecom<T>(fn: (state: WecomConfig) => T | Promise<T>): Promise<T> {
  const task = writing.then(async () => {
    const state = await load();
    const result = await fn(state);
    state.updatedAt = new Date().toISOString();
    await persist(state);
    return result;
  });
  writing = task.catch(() => undefined);
  return task;
}

export async function readWecom(): Promise<WecomConfig> {
  return load();
}

export function maskSecret(secret: string): string {
  if (!secret) return "";
  if (secret.length <= 8) return "…";
  return `${secret.slice(0, 3)}…${secret.slice(-4)}`;
}

export function wecomStorePath() {
  return storeFile;
}