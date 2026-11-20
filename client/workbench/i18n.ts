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
  if (runtime) return runtime(key, args);
  const table = (resources as unknown as Record<string, Record<string, string>>)[override === "en" ? "en" : "zh-CN"];
  let out = table[key] ?? key;
  if (args) for (const [name, value] of Object.entries(args)) out = out.split(`{{${name}}}`).join(String(value));
  return out;
}

export function useI18n(bundle: PluginTranslations = messages) {
  return useTranslation(bundle);
}