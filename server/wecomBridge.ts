import { requestMultica } from "./multica";
import { resolveServer } from "./store";
import { maskSecret, mutateWecom, newBotId, readWecom, wecomStorePath, type WecomBot } from "./wecomStore";
import { WecomChannel, type WecomInbound, type WecomStatus } from "./wecom";

export interface WecomActivity {
  id: string;
  at: string;
  kind: "in" | "out" | "push" | "error" | "system";
  text: string;
}

export interface WecomBindingView {
  chatid: string;
  sessionId: string;
  agentId: string;
  label: string;
  updatedAt: string;
}

export interface WecomBotView {
  id: string;
  serverId: string;
  workspaceId: string | null;
  enabled: boolean;
  botId: string;
  secretMasked: string;
  configured: boolean;
  agentId: string | null;
  pushUnread: boolean;
  delegate: boolean;
  pushIntervalSec: number;
  targetChatId: string;
  status: WecomStatus;
  error: string;
  bindings: WecomBindingView[];
  activity: WecomActivity[];
  pushedCount: number;
  updatedAt: string;
}

export interface WecomListView {
  bots: WecomBotView[];
  storePath: string;
}

const REPLY_TIMEOUT_MS = 120_000;
const REPLY_POLL_MS = 2_500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" ? (data as Record<string, unknown>) : {};
}

function asList<T>(data: unknown, ...keys: string[]): T[] {
  if (Array.isArray(data)) return data as T[];
  for (const key of keys) {
    const value = asRecord(data)[key];
    if (Array.isArray(value)) return value as T[];
  }
  return [];
}

interface BotRuntime {
  channel: WecomChannel;
  activity: WecomActivity[];
  pushTimer: ReturnType<typeof setInterval> | null;
  handling: Set<string>;
  lastStatus: WecomStatus;
  seq: number;
  creds: string;
}

/** 每个「服务器 + 工作区」的企业微信机器人各自一条长连接与推送循环，互不干扰。 */
class WecomBridge {
  private runtimes = new Map<string, BotRuntime>();

  private runtime(id: string): BotRuntime {
    let runtime = this.runtimes.get(id);
    if (!runtime) {
      runtime = {
        channel: new WecomChannel(),
        activity: [],
        pushTimer: null,
        handling: new Set(),
        lastStatus: "idle",
        seq: 0,
        creds: "",
      };
      this.runtimes.set(id, runtime);
    }
    return runtime;
  }

  private log(runtime: BotRuntime, kind: WecomActivity["kind"], text: string) {
    runtime.seq += 1;
    runtime.activity = [{ id: `act_${runtime.seq}`, at: new Date().toISOString(), kind, text }, ...runtime.activity].slice(0, 40);
  }

  private noteStatus(runtime: BotRuntime) {
    const status = runtime.channel.status;
    if (status !== runtime.lastStatus) {
      runtime.lastStatus = status;
      this.log(runtime, "system", `连接状态：${status}${runtime.channel.error ? `（${runtime.channel.error}）` : ""}`);
    }
  }

  private stopRuntime(id: string) {
    const runtime = this.runtimes.get(id);
    if (!runtime) return;
    runtime.channel.stop();
    if (runtime.pushTimer) clearInterval(runtime.pushTimer);
    runtime.pushTimer = null;
    this.runtimes.delete(id);
  }

  /** 依据配置 reconciling：启用的建/重连，停用或删除的断开。 */
  async apply(): Promise<void> {
    const state = await readWecom();
    const wanted = new Map(state.bots.filter((bot) => bot.enabled && bot.botId && bot.secret).map((bot) => [bot.id, bot]));
    for (const id of [...this.runtimes.keys()]) {
      if (!wanted.has(id)) this.stopRuntime(id);
    }
    for (const bot of wanted.values()) {
      const runtime = this.runtime(bot.id);
      const creds = `${bot.botId}:${bot.secret}`;
      if (runtime.creds !== creds) {
        runtime.channel.stop();
        if (runtime.pushTimer) clearInterval(runtime.pushTimer);
        runtime.pushTimer = null;
        runtime.creds = creds;
        runtime.channel.start({
          botId: bot.botId,
          secret: bot.secret,
          onMessage: (message) => void this.handle(bot.id, message),
          onStatus: () => this.noteStatus(runtime),
        });
      }
      this.noteStatus(runtime);
      if (runtime.pushTimer) clearInterval(runtime.pushTimer);
      runtime.pushTimer = bot.pushUnread ? setInterval(() => void this.pushCycle(bot.id, false), bot.pushIntervalSec * 1000) : null;
    }
  }

  shutdown(): void {
    for (const id of [...this.runtimes.keys()]) this.stopRuntime(id);
  }

  private async bot(id: string): Promise<WecomBot | null> {
    const state = await readWecom();
    return state.bots.find((bot) => bot.id === id) ?? null;
  }

  private async api(bot: WecomBot, method: "GET" | "POST", path: string, body?: Record<string, unknown>) {
    const server = await resolveServer(bot.serverId || undefined);
    return requestMultica({
      server,
      method,
      path,
      body,
      workspaceId: bot.workspaceId ?? server.workspaceId,
      allowInternal: server.allowInternal,
    });
  }

  private async agentName(bot: WecomBot, agentId: string): Promise<string> {
    const result = await this.api(bot, "GET", "/api/agents");
    if (!result.ok) return agentId;
    const agents = asList<{ id?: string; name?: string }>(result.data, "agents");
    return agents.find((agent) => agent.id === agentId)?.name ?? agentId;
  }

  private async ensureSession(bot: WecomBot, chatid: string, label: string): Promise<string> {
    const existing = bot.bindings[chatid];
    if (existing && bot.agentId && existing.agentId === bot.agentId) return existing.sessionId;
    if (!bot.agentId) throw new Error("尚未绑定 Multica 智能体");
    const created = await this.api(bot, "POST", "/api/chat/sessions", { agent_id: bot.agentId });
    if (!created.ok) throw new Error(created.error ?? "创建会话失败");
    const sessionId = asRecord(created.data).id;
    if (typeof sessionId !== "string" || !sessionId) throw new Error("创建会话返回缺少 id");
    await mutateWecom((state) => {
      const target = state.bots.find((item) => item.id === bot.id);
      if (!target) return;
      target.bindings[chatid] = { sessionId, agentId: bot.agentId as string, label, updatedAt: new Date().toISOString() };
      target.targetChatId = chatid;
    });
    const runtime = this.runtime(bot.id);
    this.log(runtime, "system", `企微会话 ${chatid.slice(0, 12)}… 绑定到 Multica 会话 ${sessionId.slice(0, 8)}…`);
    return sessionId;
  }

  private async baselineIds(bot: WecomBot, sessionId: string): Promise<Set<string>> {
    const result = await this.api(bot, "GET", `/api/chat/sessions/${sessionId}/messages`);
    if (!result.ok) return new Set();
    return new Set(asList<{ id?: string }>(result.data, "messages").map((message) => message.id ?? "").filter(Boolean));
  }

  private async waitReply(bot: WecomBot, sessionId: string, baseline: Set<string>): Promise<string | null> {
    const deadline = Date.now() + REPLY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(REPLY_POLL_MS);
      const result = await this.api(bot, "GET", `/api/chat/sessions/${sessionId}/messages`);
      if (!result.ok) continue;
      const messages = asList<{ id?: string; role?: string; content?: string }>(result.data, "messages");
      const reply = [...messages].reverse().find((message) => message.role === "assistant" && message.id && !baseline.has(message.id) && (message.content ?? "").trim());
      if (reply?.content) return reply.content;
    }
    return null;
  }

  private async handle(botId: string, message: WecomInbound): Promise<void> {
    const bot = await this.bot(botId);
    if (!bot || !bot.enabled) return;
    const runtime = this.runtime(botId);
    if (runtime.handling.has(message.msgid)) return;
    runtime.handling.add(message.msgid);
    setTimeout(() => runtime.handling.delete(message.msgid), 60_000);
    this.log(runtime, "in", `${message.fromUser || message.chatid}：${message.text.slice(0, 80)}`);
    const say = async (text: string, finish: boolean) => {
      try {
        await runtime.channel.replyStream(message.frame, message.msgid, text, finish);
      } catch {
        if (finish && message.chatid) await runtime.channel.send(message.chatid, text.slice(0, 1200)).catch(() => undefined);
      }
    };
    try {
      const server = await resolveServer(bot.serverId || undefined);
      if (!server.token) {
        await say("该 Multica 服务器尚未配置 API Key，请先到 Paseo 的 Multica 设置里填写。", true);
        return;
      }
      if (!bot.agentId) {
        await say("还没有绑定智能体。请到 Paseo → Multica → 设置 → 企业微信，为这个机器人选择一个智能体后再试。", true);
        return;
      }
      const name = await this.agentName(bot, bot.agentId);
      const sessionId = await this.ensureSession(bot, message.chatid, `${name} · ${message.fromUser || message.chatid}`);
      await say(`已收到，交给 ${name} 处理…`, false);
      const baseline = await this.baselineIds(bot, sessionId);
      const content = message.quote ? `${message.text}\n\n> 引用：${message.quote}` : message.text;
      const sent = await this.api(bot, "POST", `/api/chat/sessions/${sessionId}/messages`, { content });
      if (!sent.ok) {
        await say(`发送失败：${sent.error ?? "未知错误"}`, true);
        this.log(runtime, "error", `发送失败：${sent.error ?? "未知错误"}`);
        return;
      }
      const reply = await this.waitReply(bot, sessionId, baseline);
      if (reply) {
        await say(reply.slice(0, 4000), true);
        this.log(runtime, "out", `${name}：${reply.slice(0, 80)}`);
      } else {
        await say(`${name} 仍在处理，可稍后在 Multica 会话 ${sessionId} 中查看结果。`, true);
        this.log(runtime, "system", `等待 ${name} 回复超时，会话 ${sessionId.slice(0, 8)}…`);
      }
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      this.log(runtime, "error", text);
      await say(`处理失败：${text}`, true).catch(() => undefined);
    }
  }

  async pushCycle(botId: string, manual: boolean): Promise<number> {
    const bot = await this.bot(botId);
    if (!bot || !bot.enabled || !bot.pushUnread) return 0;
    const runtime = this.runtime(botId);
    if (runtime.channel.status !== "connected") {
      if (manual) throw new Error("企业微信机器人未连接");
      return 0;
    }
    const chatid = bot.targetChatId;
    if (!chatid) {
      if (manual) throw new Error("还没有企业微信会话，先在企微里给机器人发一条消息");
      return 0;
    }
    const result = await this.api(bot, "GET", "/api/inbox");
    if (!result.ok) {
      if (manual) throw new Error(result.error ?? "读取收件箱失败");
      return 0;
    }
    const items = asList<{ id?: string; read?: boolean; archived?: boolean; title?: string; issue_identifier?: string | null }>(result.data, "items", "inbox");
    const pushed = new Set(bot.pushedIds);
    const fresh = items.filter((item) => item.id && !item.read && !item.archived && !pushed.has(item.id)).slice(0, 5);
    if (fresh.length === 0) {
      if (manual) this.log(runtime, "push", "没有新的未读通知");
      return 0;
    }
    const lines = fresh.map((item) => `- **${item.issue_identifier ?? "通知"}** ${item.title ?? ""}`);
    const markdown = [`### Multica 未读通知（${fresh.length} 条）`, ...lines, "", manual ? "手动推送" : "自动推送"].join("\n");
    await runtime.channel.send(chatid, markdown);
    await mutateWecom((state) => {
      const target = state.bots.find((item) => item.id === botId);
      if (target) target.pushedIds = [...target.pushedIds, ...fresh.map((item) => item.id as string)].slice(-200);
    });
    this.log(runtime, "push", `推送 ${fresh.length} 条未读通知到企业微信`);
    if (bot.delegate && bot.agentId) {
      const item = fresh[0];
      try {
        const name = await this.agentName(bot, bot.agentId);
        const sessionId = await this.ensureSession(bot, chatid, `${name} · 通知处理`);
        const baseline = await this.baselineIds(bot, sessionId);
        const instruction = `【Multica 未读通知转发】\n${item.issue_identifier ?? ""} ${item.title ?? ""}\n请处理这条通知对应的任务，并给出简短结论。`;
        const sent = await this.api(bot, "POST", `/api/chat/sessions/${sessionId}/messages`, { content: instruction });
        if (sent.ok) {
          const reply = await this.waitReply(bot, sessionId, baseline);
          if (reply) {
            await runtime.channel.send(chatid, `**${name} 的处理结论**\n${reply.slice(0, 3000)}`);
            this.log(runtime, "out", `${name} 处理通知：${reply.slice(0, 80)}`);
          }
        }
      } catch (cause) {
        this.log(runtime, "error", `委托处理失败：${cause instanceof Error ? cause.message : String(cause)}`);
      }
    }
    return fresh.length;
  }

  async test(botId: string): Promise<void> {
    const bot = await this.bot(botId);
    if (!bot) throw new Error("机器人不存在");
    const runtime = this.runtime(botId);
    if (runtime.channel.status !== "connected") throw new Error(runtime.channel.error || "企业微信机器人未连接");
    if (!bot.targetChatId) throw new Error("还没有企业微信会话，先在企微里给机器人发一条消息");
    await runtime.channel.send(bot.targetChatId, "### Multica 连接测试\n企业微信机器人链路正常，未读通知与智能体回复会推送到这里。");
    this.log(runtime, "push", "发送连接测试消息");
  }

  async view(): Promise<WecomListView> {
    const state = await readWecom();
    const bots: WecomBotView[] = state.bots.map((bot) => {
      const runtime = this.runtimes.get(bot.id);
      if (runtime) this.noteStatus(runtime);
      return {
        id: bot.id,
        serverId: bot.serverId,
        workspaceId: bot.workspaceId,
        enabled: bot.enabled,
        botId: bot.botId,
        secretMasked: maskSecret(bot.secret),
        configured: Boolean(bot.botId && bot.secret),
        agentId: bot.agentId,
        pushUnread: bot.pushUnread,
        delegate: bot.delegate,
        pushIntervalSec: bot.pushIntervalSec,
        targetChatId: bot.targetChatId,
        status: runtime ? runtime.channel.status : "idle",
        error: runtime ? runtime.channel.error : "",
        bindings: Object.entries(bot.bindings).map(([chatid, binding]) => ({ chatid, ...binding })),
        activity: runtime ? runtime.activity : [],
        pushedCount: bot.pushedIds.length,
        updatedAt: bot.updatedAt,
      };
    });
    return { bots, storePath: wecomStorePath() };
  }
}

export const wecomBridge = new WecomBridge();
export { newBotId };