// 由 tools/i18n-zh.json 与 tools/i18n-en.json 生成 client/workbench/i18n-resources.ts。
// 校验：key 双向齐全、插值占位符一致；按 key 路径嵌套（SDK 要求顶层 key 不含点）。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const zh = JSON.parse(fs.readFileSync(path.join(root, "tools", "i18n-zh.json"), "utf8"));
const en = JSON.parse(fs.readFileSync(path.join(root, "tools", "i18n-en.json"), "utf8"));
const missing = Object.keys(zh).filter((k) => !(k in en));
const extra = Object.keys(en).filter((k) => !(k in zh));
if (missing.length || extra.length) {
  console.error("MISSING", missing, "EXTRA", extra);
  process.exit(1);
}
const ph = (s) => (s.match(/\{\{[a-z]\}\}/g) || []).sort().join(",");
const bad = Object.keys(zh).filter((k) => ph(zh[k]) !== ph(en[k]));
if (bad.length) {
  console.error("PLACEHOLDER-MISMATCH", bad);
  process.exit(1);
}
const nest = (flat) => {
  const out = {};
  for (const [k, v] of Object.entries(flat)) {
    const parts = k.split(".");
    let node = out;
    for (const p of parts.slice(0, -1)) node = node[p] ??= {};
    node[parts[parts.length - 1]] = v;
  }
  return out;
};
const ser = (o) => JSON.stringify(o, null, 2);
fs.writeFileSync(
  path.join(root, "client", "workbench", "i18n-resources.ts"),
  "// 由 tools/i18n-build.mjs 生成：en 与 zh-CN 双语 catalog（按 key 路径嵌套，与调用点 t() 对应）。\nexport const resources = {\n  en: " + ser(nest(en)) + ",\n  \"zh-CN\": " + ser(nest(zh)) + ",\n} as const;\n",
);
console.log("resources written:", Object.keys(zh).length, "keys");