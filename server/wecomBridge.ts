import { requestMultica } from "./multica";
import { resolveServer } from "./store";
import { maskSecret, mutateWecom, readWecom, wecomStorePath, type WecomConfig } from "./wecomStore";
import { WecomChannel, type WecomInbound, type WecomStatus } from "./wecom";

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

export interface WecomView {
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
  storePath: string;
}

const REPLY_TIMEOUT_MS = 120_000;
const REPLY_POLL_MS = 2_500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class WecomBridge {
  private channel = new WecomChannel();
  private activity: WecomActivity[] = [];
  private pushTimer: ReturnType<typeof setInterval> | null = null;
  private handling = new Set<string>();
  private lastStatus: WecomStatus = "idle";
  private seq = 0;

  private log(kind: WecomActivity["kind"], text: string) {
    this.seq += 1;
    this.activity = [{ id: `act_${this.seq}`, at: new Date().toISOString(), kind, text }, ...this.activity].slice(0, 40);
  }

  private noteStatus() {
    const status = this.channel.status;
    if (status !== this.lastStatus) {
      this.lastStatus = status;
      this.log("system", `连接状态：${status}${this.channel.error ? `（${this.channel.error}）` : ""}`);
    }
  }

  /** 依据当前配置启动/停止长连接与未读推送循环。 */
  async apply(): Promise<void> {
    const config = await readWecom();
    if (!config.enabled || !config.botId || !config.secret) {
      this.channel.stop();
      this.stopPush();
      this.noteStatus();
      return;
    }
    this.channel.start({
      botId: config.botId,
      secret: config.secret,
      onMessage: (message) => void this.handle(message),
      onStatus: () => this.noteStatus(),
    });
    this.noteStatus();
    this.restartPush(config);
  }

  shutdown(): void {
    this.channel.stop();
    this.stopPush();
  }

  private stopPush() {
    if (this.pushTimer) {
      clearInterval(this.pushTimer);
      this.pushTimer = null;
    }
  }

  private restartPush(config: WecomConfig) {
    this.stopPush();
    if (!config.pushUnread) return;
    this.pushTimer = setInterval(() => void this.pushCycle(false), config.pushIntervalSec * 1000);
  }

  private async api(method: "GET" | "POST", path: string, body?: Record<string, unknown>) {
    const server = await resolveServer();
    return requestMultica({ server, method, path, body, workspaceId: server.workspaceId, allowInternal: server.allowInternal });
  }

  private async agentName(agentId: string): Promise<string> {
    const result = await this.api("GET", "/api/agents");
    if (!result.ok) return agentId;
    const agents = asList<{ id?: string; name?: string }>(result.data, "agents");
    return agents.find((agent) => agent.id === agentId)?.name ?? agentId;
  }

  private async ensureSession(config: WecomConfig, chatid: string, label: string): Promise<string> {
    const existing = config.bindings[chatid];
    if (existing && config.agentId && existing.agentId === config.agentId) return existing.sessionId;
    if (!config.agentId) throw new Error("尚未绑定 Multica 智能体");
    const created = await this.api("POST", "/api/chat/sessions", { agent_id: config.agentId });
    if (!created.ok) throw new Error(created.error ?? "创建会话失败");
    const sessionId = asRecord(created.data).id;
    if (typeof sessionId !== "string" || !sessionId) throw new Error("创建会话返回缺少 id");
    await mutateWecom((state) => {
      state.bindings[chatid] = { sessionId, agentId: config.agentId as string, label, updatedAt: new Date().toISOString() };
      state.targetChatId = chatid;
    });
    this.log("system", `企业微信会话 ${chatid.slice(0, 12)}… 已绑定到 Multica 会话 ${sessionId.slice(0, 8)}…`);
    return sessionId;
  }

  private async waitReply(sessionId: string, baseline: Set<string>): Promise<string | null> {
    const deadline = Date.now() + REPLY_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await sleep(REPLY_POLL_MS);
      const result = await this.api("GET", `/api/chat/sessions/${sessionId}/messages`);
      if (!result.ok) continue;
      const messages = asList<{ id?: string; role?: string; content?: string }>(result.data, "messages");
      const reply = [...messages].reverse().find((message) => message.role === "assistant" && message.id && !baseline.has(message.id) && (message.content ?? "").trim());
      if (reply?.content) return reply.content;
    }
    return null;
  }

  private async baselineIds(sessionId: string): Promise<Set<string>> {
    const result = await this.api("GET", `/api/chat/sessions/${sessionId}/messages`);
    if (!result.ok) return new Set();
    return new Set(asList<{ id?: string }>(result.data, "messages").map((message) => message.id ?? "").filter(Boolean));
  }

  private async handle(message: WecomInbound): Promise<void> {
    if (this.handling.has(message.msgid)) return;
    this.handling.add(message.msgid);
    setTimeout(() => this.handling.delete(message.msgid), 60_000);
    const config = await readWecom();
    if (!config.enabled) return;
    this.log("in", `${message.fromUser || message.chatid}：${message.text.slice(0, 80)}`);
    const say = async (text: string, finish: boolean) => {
      try {
        await this.channel.replyStream(message.frame, message.msgid, text, finish);
      } catch {
        if (finish && message.chatid) await this.channel.send(message.chatid, text.slice(0, 1200)).catch(() => undefined);
      }
    };
    try {
      const server = await resolveServer();
      if (!server.token) {
        await say("Multica 尚未配置 API Key，请先到 Paseo 的 Multica 设置里填写。", true);
        return;
      }
      if (!config.agentId) {
        await say("还没有绑定智能体。请到 Paseo → Multica → 设置 → 企业微信，选择一个智能体（例如 Mika）后再试。", true);
        return;
      }
      const name = await this.agentName(config.agentId);
      const sessionId = await this.ensureSession(config, message.chatid, `${name} · ${message.fromUser || message.chatid}`);
      await say(`已收到，交给 ${name} 处理…`, false);
      const baseline = await this.baselineIds(sessionId);
      const content = message.quote ? `${message.text}\n\n> 引用：${message.quote}` : message.text;
      const sent = await this.api("POST", `/api/chat/sessions/${sessionId}/messages`, { content });
      if (!sent.ok) {
        await say(`发送失败：${sent.error ?? "未知错误"}`, true);
        this.log("error", `发送失败：${sent.error ?? "未知错误"}`);
        return;
      }
      const reply = await this.waitReply(sessionId, baseline);
      if (reply) {
        await say(reply.slice(0, 4000), true);
        this.log("out", `${name}：${reply.slice(0, 80)}`);
      } else {
        await say(`${name} 仍在处理，可稍后在 Multica 会话 ${sessionId} 中查看结果。`, true);
        this.log("system", `等待 ${name} 回复超时，会话 ${sessionId.slice(0, 8)}…`);
      }
    } catch (cause) {
      const text = cause instanceof Error ? cause.message : String(cause);
      this.log("error", text);
      await say(`处理失败：${text}`, true).catch(() => undefined);
    }
  }

  /** 拉取未读通知推送到企业微信；delegate 开启时交给绑定智能体处理并回传结论。 */
  async pushCycle(manual: boolean): Promise<number> {
    const config = await readWecom();
    if (!config.enabled || !config.pushUnread) return 0;
    if (this.channel.status !== "connected") {
      if (manual) throw new Error("企业微信机器人未连接");
      return 0;
    }
    const chatid = config.targetChatId;
    if (!chatid) {
      if (manual) throw new Error("还没有企业微信会话，先在企微里给机器人发一条消息");
      return 0;
    }
    const result = await this.api("GET", "/api/inbox");
    if (!result.ok) {
      if (manual) throw new Error(result.error ?? "读取收件箱失败");
      return 0;
    }
    const items = asList<{ id?: string; read?: boolean; archived?: boolean; title?: string; issue_identifier?: string | null; type?: string; created_at?: string }>(result.data, "items", "inbox");
    const pushed = new Set(config.pushedIds);
    const fresh = items.filter((item) => item.id && !item.read && !item.archived && !pushed.has(item.id)).slice(0, 5);
    if (fresh.length === 0) {
      if (manual) this.log("push", "没有新的未读通知");
      return 0;
    }
    const lines = fresh.map((item) => `- **${item.issue_identifier ?? "通知"}** ${item.title ?? ""}`);
    const markdown = [`### Multica 未读通知（${fresh.length} 条）`, ...lines, "", manual ? "手动推送" : "自动推送"].join("\n");
    await this.channel.send(chatid, markdown);
    await mutateWecom((state) => {
      state.pushedIds = [...state.pushedIds, ...fresh.map((item) => item.id as string)].slice(-200);
    });
    this.log("push", `推送 ${fresh.length} 条未读通知到企业微信`);
    if (config.delegate && config.agentId) {
      const item = fresh[0];
      try {
        const name = await this.agentName(config.agentId);
        const sessionId = await this.ensureSession(config, chatid, `${name} · 通知处理`);
        const baseline = await this.baselineIds(sessionId);
        const instruction = `【Multica 未读通知转发】\n${item.issue_identifier ?? ""} ${item.title ?? ""}\n请处理这条通知对应的任务，并给出简短结论。`;
        const sent = await this.api("POST", `/api/chat/sessions/${sessionId}/messages`, { content: instruction });
        if (sent.ok) {
          const reply = await this.waitReply(sessionId, baseline);
          if (reply) {
            await this.channel.send(chatid, `**${name} 的处理结论**\n${reply.slice(0, 3000)}`);
            this.log("out", `${name} 处理通知：${reply.slice(0, 80)}`);
          }
        }
      } catch (cause) {
        this.log("error", `委托处理失败：${cause instanceof Error ? cause.message : String(cause)}`);
      }
    }
    return fresh.length;
  }

  async test(): Promise<void> {
    const config = await readWecom();
    if (this.channel.status !== "connected") throw new Error(this.channel.error || "企业微信机器人未连接");
    if (!config.targetChatId) throw new Error("还没有企业微信会话，先在企微里给机器人发一条消息");
    await this.channel.send(config.targetChatId, "### Multica 连接测试\n企业微信机器人链路正常，未读通知与智能体回复会推送到这里。");
    this.log("push", "发送连接测试消息");
  }

  async view(): Promise<WecomView> {
    const config = await readWecom();
    this.noteStatus();
    return {
      enabled: config.enabled,
      botId: config.botId,
      secretMasked: maskSecret(config.secret),
      configured: Boolean(config.botId && config.secret),
      agentId: config.agentId,
      pushUnread: config.pushUnread,
      delegate: config.delegate,
      pushIntervalSec: config.pushIntervalSec,
      targetChatId: config.targetChatId,
      status: this.channel.status,
      error: this.channel.error,
      bindings: Object.entries(config.bindings).map(([chatid, binding]) => ({ chatid, ...binding })),
      activity: this.activity,
      pushedCount: config.pushedIds.length,
      storePath: wecomStorePath(),
    };
  }
}

export const wecomBridge = new WecomBridge();