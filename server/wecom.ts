import { WSClient, type WsFrame, type WsFrameHeaders } from "@wecom/aibot-node-sdk";

export interface WecomInbound {
  frame: WsFrameHeaders;
  msgid: string;
  fromUser: string;
  chatid: string;
  text: string;
  quote?: string;
}

export type WecomStatus = "idle" | "connecting" | "connected" | "error";

/** 企业微信智能机器人长连接通道（websocket 模式，无需公网回调地址）。 */
export class WecomChannel {
  private client: WSClient | null = null;
  private stopped = true;
  private lastError = "";
  private authenticated = false;

  start(input: { botId: string; secret: string; onMessage: (message: WecomInbound) => void; onStatus?: () => void }): void {
    this.stop();
    this.stopped = false;
    this.lastError = "";
    this.authenticated = false;
    const client = new WSClient({
      botId: input.botId,
      secret: input.secret,
      maxReconnectAttempts: -1,
      maxAuthFailureAttempts: 3,
      logger: {
        debug: () => undefined,
        info: () => undefined,
        warn: (message: string) => console.warn("[multica] wecom", message),
        error: (message: string) => console.error("[multica] wecom", message),
      },
    });
    this.client = client;
    client.on("connected", () => input.onStatus?.());
    client.on("authenticated", () => {
      this.authenticated = true;
      this.lastError = "";
      console.log("[multica] wecom authenticated");
      input.onStatus?.();
    });
    client.on("disconnected", (reason) => {
      this.authenticated = false;
      console.warn("[multica] wecom disconnected", reason);
      input.onStatus?.();
    });
    client.on("reconnecting", () => input.onStatus?.());
    client.on("error", (error) => {
      this.lastError = error.message;
      console.error("[multica] wecom error", error.message);
      input.onStatus?.();
    });
    client.on("message.text", (frame: WsFrame) => {
      const body = frame.body as
        | {
            msgid?: string;
            chatid?: string;
            from?: { userid?: string };
            text?: { content?: string };
            quote?: { msgtype?: string; text?: { content?: string }; voice?: { content?: string } };
          }
        | undefined;
      const text = body?.text?.content ?? "";
      const quote =
        body?.quote?.text?.content ??
        body?.quote?.voice?.content ??
        (body?.quote ? `[引用的${body.quote.msgtype ?? "消息"}]` : "");
      if (!text.trim() && !quote.trim()) return;
      const fromUser = body?.from?.userid ?? "";
      const chatid = body?.chatid ?? fromUser;
      const msgid = body?.msgid ?? frame.headers.req_id;
      input.onMessage({
        frame: { headers: frame.headers },
        msgid: msgid || `${fromUser}:${Date.now()}`,
        fromUser,
        chatid,
        text,
        quote: quote.trim() || undefined,
      });
    });
    client.connect();
  }

  stop(): void {
    this.stopped = true;
    this.authenticated = false;
    if (this.client) {
      try {
        this.client.disconnect();
      } catch {
        //  disconnect 在已关闭时抛错属正常，忽略
      }
      this.client = null;
    }
  }

  get status(): WecomStatus {
    if (this.stopped || !this.client) return "idle";
    if (this.lastError && !this.authenticated) return "error";
    return this.authenticated && this.client.isConnected ? "connected" : "connecting";
  }

  get error(): string {
    return this.lastError;
  }

  async send(chatid: string, markdown: string): Promise<void> {
    if (!this.client) throw new Error("企业微信机器人未连接");
    await this.client.sendMessage(chatid, { msgtype: "markdown", markdown: { content: markdown } });
  }

  async replyStream(frame: WsFrameHeaders, streamId: string, content: string, finish: boolean): Promise<void> {
    if (!this.client) throw new Error("企业微信机器人未连接");
    await this.client.replyStream(frame, streamId, content, finish);
  }
}