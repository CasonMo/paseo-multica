// 一次性 codemod（单遍、嵌套模板安全）：抽取含中文/中文标点的字符串、JSX 文本、模板串，
// 复用 tools/i18n-zh.json 已有 key（按值去重），新值分配新 key；调用点替换为 t("key") / t("key", {a:…})。
// 比较运算（===/switch）中的字面量不动，避免破坏逻辑。
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const catalogPath = path.join(root, "tools", "i18n-zh.json");
const catalog = fs.existsSync(catalogPath) ? JSON.parse(fs.readFileSync(catalogPath, "utf8")) : {};
const byValue = new Map(Object.entries(catalog).map(([k, v]) => [v, k]));
let seq = Object.keys(catalog).reduce((m, k) => Math.max(m, Number(k.split(".").pop()) || 0), 0);

const files = [];
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (/\.(tsx|ts)$/.test(e.name)) files.push(p);
  }
};
walk(path.join(root, "client"));
files.push(path.join(root, "index.client.tsx"));

const CJK = /[一-鿿　-〿＀-￯]/;
const report = [];

for (const file of files) {
  const base = path.basename(file).replace(/\.(tsx|ts)$/, "");
  const src = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  const addKey = (zh) => {
    const hit = byValue.get(zh);
    if (hit) return hit;
    const key = `${base}.${++seq}`;
    catalog[key] = zh;
    byValue.set(zh, key);
    return key;
  };
  const skip = (node) => {
    const p = node.parent;
    if (!p) return false;
    if (ts.isBinaryExpression(p) && [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(p.operatorToken.kind)) return true;
    if (ts.isCaseClause(p)) return true;
    return false;
  };
  // 递归收集 edits；模板串整体替换，其插值表达式内部的字符串/模板递归转换后拼进参数源码
  const collect = (node) => {
    if (ts.isJsxText(node)) {
      const raw = node.getText(sf);
      const trimmed = raw.trim();
      if (trimmed && CJK.test(trimmed)) {
        const key = addKey(trimmed.replace(/\s+/g, " "));
        const lead = raw.match(/^\s*/)[0];
        const trail = raw.match(/\s*$/)[0];
        edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `${lead}{t(${JSON.stringify(key)})}${trail}` });
      }
      return;
    }
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && CJK.test(node.text)) {
      if (skip(node)) {
        report.push(`SKIP-COMPARE ${base}: ${node.text}`);
        return;
      }
      const key = addKey(node.text);
      const repl = `t(${JSON.stringify(key)})`;
      edits.push({ start: node.getStart(sf), end: node.getEnd(), text: ts.isJsxAttribute(node.parent) ? `{${repl}}` : repl });
      return;
    }
    if (ts.isTemplateExpression(node) && CJK.test(node.getText(sf))) {
      let zh = node.head.text;
      const args = [];
      node.templateSpans.forEach((span, i) => {
        const name = String.fromCharCode(97 + i);
        const inner = [];
        const collectInner = (n) => {
          const saved = edits.length;
          collect(n);
          // 把子 edits 限制在表达式范围内并拼接源码
          const sub = edits.splice(saved).filter((e) => e.start >= span.expression.getStart(sf) && e.end <= span.expression.getEnd());
          let text = span.expression.getText(sf);
          sub.sort((a, b) => b.start - a.start);
          for (const e of sub) text = text.slice(0, e.start - span.expression.getStart(sf)) + e.text + text.slice(e.end - span.expression.getStart(sf));
          inner.push(text);
        };
        collectInner(span.expression);
        args.push(`${name}: ${inner[0] ?? span.expression.getText(sf)}`);
        zh += `{{${name}}}` + span.literal.text;
      });
      const key = addKey(zh);
      if (zh.length > 200) { console.log("DEBUG-HUGE", base, node.getStart(sf), JSON.stringify(zh.slice(0,80)), ts.SyntaxKind[node.kind]); }
      edits.push({ start: node.getStart(sf), end: node.getEnd(), text: `t(${JSON.stringify(key)}, { ${args.join(", ")} })` });
      return; // 不再深入模板子节点
    }
    ts.forEachChild(node, collect);
  };
  collect(sf);
  if (edits.length) {
    edits.sort((a, b) => b.start - a.start);
    let out = src;
    for (const e of edits) out = out.slice(0, e.start) + e.text + out.slice(e.end);
    if (!/from "\.\/i18n"|from "\.\.\/i18n"|from "\.\.\/\.\.\/i18n"/.test(out)) {
      const rel = path.relative(path.dirname(file), path.join(root, "client", "workbench", "i18n")).replace(/\\/g, "/");
      const imp = `import { t } from "${rel.startsWith(".") ? rel : "./" + rel}";\n`;
      const m = out.match(/^import[^\n]*\n/);
      out = m ? out.slice(0, m.index) + imp + out.slice(m.index) : imp + out;
    }
    fs.writeFileSync(file, out);
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
    console.log(`${base}: ${edits.length} replacements`);
  }
}
fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));
console.log("keys:", Object.keys(catalog).length);
console.log(report.join("\n"));