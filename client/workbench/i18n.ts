import { defineTranslations, useTranslation, type PluginTranslations } from "@getpaseo/plugin/client";
import { useSyncExternalStore } from "react";
import { resources } from "./i18n-resources";

export const messages = defineTranslations({ resources });
// 插件内强制语言：把目标语言作为 en 资源注册，t() 即恒返回该语言（仅用 SDK 公开 API）
const messagesEn = defineTranslations({ resources: { en: resources.en } });
const messagesZh = defineTranslations({ resources: { en: resources["zh-CN"] } });

export type LocaleOverride = "auto" | "en" | "zh-CN";
const STORE_KEY = "multica.locale";
const listeners = new Set<() => void>();
const read = (): LocaleOverride => {
  try {
    const v = localStorage.getItem(STORE_KEY);
    return v === "en" || v === "zh-CN" ? v : "auto";
  } catch {
    return "auto";
  }
};
let override: LocaleOverride = read();

export function getLocaleOverride(): LocaleOverride {
  return override;
}
export function setLocaleOverride(next: LocaleOverride): void {
  override = next;
  try {
    localStorage.setItem(STORE_KEY, next);
  } catch {
    // 存储不可用时仅本次会话生效
  }
  listeners.forEach((fn) => fn());
}
export function useLocaleOverride(): LocaleOverride {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getLocaleOverride,
    () => "auto" as LocaleOverride,
  );
}
export function messagesFor(override: LocaleOverride) {
  return override === "en" ? messagesEn : override === "zh-CN" ? messagesZh : messages;
}

type Args = Record<string, string | number | boolean | Date>;
let runtime: ((key: string, args?: Args) => string) | null = null;

/** 由 WorkbenchProvider 在渲染期绑定当前语言的 t；纯函数（model 等）也能取到当前语言。 */
export function bindTranslation(fn: (key: string, args?: Args) => string): void {
  runtime = fn;
}

export function t(key: string, args?: Args): string {
  if (runtime) {
    try {
      return runtime(key, args);
    } catch {
      // 未知 key（如误传已翻译文本）会抛错并炸掉整个插件表面；回退嵌套表/原串降级
    }
  }
  const table = (resources as unknown as Record<string, unknown>)[override === "en" ? "en" : "zh-CN"];
  let node: unknown = table;
  for (const part of key.split(".")) node = (node as Record<string, unknown> | undefined)?.[part];
  let out = typeof node === "string" ? node : key;
  if (args) for (const [name, value] of Object.entries(args)) out = out.split(`{{${name}}}`).join(String(value));
  return out;
}

export function useI18n(bundle: PluginTranslations = messages) {
  return useTranslation(bundle);
}

// daemon 侧错误以稳定码回传（err.<code> [args…]），界面按当前语言还原；上游 Multica 原文透传
const SERVER_ERR: Record<string, string> = {
  name_required: "ServerErr.1",
  invalid_url: "ServerErr.2",
  invalid_token: "ServerErr.3",
  destination_key_required: "ServerErr.4",
  no_token: "ServerErr.5",
  no_server: "ServerErr.6",
  invalid_path: "ServerErr.7",
  bad_path: "ServerErr.8",
  blocked_route: "ServerErr.9",
  route_not_found: "ServerErr.10",
  internal_disabled: "ServerErr.11",
  http_status: "ServerErr.12",
  timeout: "ServerErr.13",
  unreachable: "ServerErr.14",
  connect_failed: "ServerErr.15",
  inbox_read: "ServerErr.16",
  steps_read: "ServerErr.17",
};

export function localizeError(message: string | null | undefined): string | null {
  if (!message) return null;
  if (!message.startsWith("err.")) return message;
  const [code, ...rest] = message.slice(4).split(" ");
  const key = SERVER_ERR[code];
  if (!key) return message;
  if (code === "route_not_found") return t(key, { a: rest[0] ?? "", b: rest.slice(1).join(" ") });
  if (code === "http_status") return t(key, { a: rest[0] ?? "" });
  return t(key);
}

export function errorMessage(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);
  return localizeError(raw) ?? raw;
}