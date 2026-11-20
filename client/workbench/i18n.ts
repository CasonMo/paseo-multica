import { defineTranslations, useTranslation } from "@getpaseo/plugin/client";
import { resources } from "./i18n-resources";

export const messages = defineTranslations({ resources });

type Args = Record<string, string | number | boolean | Date>;
let runtime: ((key: string, args?: Args) => string) | null = null;

/** 由 WorkbenchProvider 在渲染期绑定 SDK 运行时；纯函数（model 等）也能取到当前语言。 */
export function bindTranslation(fn: (key: string, args?: Args) => string): void {
  runtime = fn;
}

export function t(key: string, args?: Args): string {
  if (runtime) return runtime(key, args);
  const zh = (resources as unknown as Record<string, Record<string, string>>)["zh-CN"];
  let out = zh[key] ?? key;
  if (args) for (const [name, value] of Object.entries(args)) out = out.split(`{{${name}}}`).join(String(value));
  return out;
}

export function useI18n() {
  return useTranslation(messages);
}