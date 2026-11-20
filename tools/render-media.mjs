// 由虚构种子数据（tools/demo-data.mjs）构造 listing 媒体：插件真实色板（Ghostty 深色）的界面渲染图。
// 用法：node tools/render-media.mjs [zh|en]（默认 zh）→ assets/screenshots/<locale>/*.svg + assets/icon.svg
// 再用 rsvg-convert 栅格化为 PNG。不含任何真实数据；作者已确认以此类构造图作为脱敏媒体。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as D from "./demo-data.mjs";

const LOCALE = process.argv[2] === "en" ? "en" : "zh";
const L = (zh, en) => (LOCALE === "en" ? en : zh);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "assets", "screenshots", LOCALE);
fs.mkdirSync(outDir, { recursive: true });

const TITLES_EN = [
  "Demo issue: handoff prompt flows to qa_passed first",
  "Demo issue: add recommended / what-if-not-chosen to judging material",
  "Demo issue: digital human entry copy tweak",
  "Demo issue: sync complexity score to ticket attachments",
  "Demo issue: architect model cost tiers",
  "Demo issue: executor namespace boundary check",
  "Demo issue: report callback deduction dedupe",
  "Demo issue: split approval card read-only fields",
  "Demo issue: QA-exempt ticket gate prompt",
  "Demo issue: snapshot zero-diff index sync",
];
const titleOf = (i) => (LOCALE === "en" ? TITLES_EN[i] : D.issueTitles[i]);
const AGENT_NAMES_EN = ["Stardust·Demo Agent", "Bluewhale·Demo Agent", "Amber·Demo Agent", "Celadon·Demo Agent"];
const agentName = (i) => (LOCALE === "en" ? AGENT_NAMES_EN[i] : D.agents[i].name);
const PROJECTS_EN = ["Demo Project·Flow Repo", "Demo Project·Ads Console"];
const projectName = (i) => (LOCALE === "en" ? PROJECTS_EN[i] : D.projects[i].title);
const RUNTIMES_EN = ["Demo Runtime·A", "Demo Runtime·B"];
const runtimeName = (i) => (LOCALE === "en" ? RUNTIMES_EN[i] : D.runtimes[i].custom_name);
const STATUS_EN = { backlog: "Backlog", todo: "Todo", in_progress: "In progress", in_review: "In review", done: "Done", closed: "Closed" };
const statusName = (cat) => (LOCALE === "en" ? STATUS_EN[cat] : D.statuses.find((s) => s.category === cat)?.name);
const relTime = (isoStr) => {
  const m = Math.round((Date.now() - Date.parse(isoStr)) / 60000);
  if (LOCALE === "en") return m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
  return D.relTime(isoStr);
};

const C = {
  shell: "#21252d", canvas: "#282c34", card: "#2f333d", fill: "#383c48", fillStrong: "#31353c",
  border: "#3f4454", line: "#454b5b", fg: "#fafafa", muted: "#c8ccd8", faint: "#a0a4b2",
  brand: "#7aa2f7", success: "#3fb950", warning: "#e3b341", danger: "#ff7b72", info: "#58a6ff", high: "#f0883e",
};
const PAIRS = [["#7aa2f7", "#56b6c2"], ["#3fb950", "#56b6c2"], ["#e3b341", "#f0883e"], ["#b48ead", "#7aa2f7"], ["#ff7b72", "#b48ead"], ["#a8b0c2", "#8b93a7"]];
const FONT = "PingFang SC, Hiragino Sans GB, Helvetica Neue, Arial, sans-serif";
const MONO = "SF Mono, Menlo, Consolas, monospace";
const W = 1600, H = 900;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const cw = (ch, size) => (ch.charCodeAt(0) > 0x2e80 ? size : /[ A-Z]/.test(ch) ? size * 0.62 : size * 0.55);
const tw = (s, size) => [...String(s)].reduce((w, ch) => w + cw(ch, size), 0);
const fit = (s, maxW, size) => {
  let out = "";
  for (const ch of String(s)) {
    if (tw(out + ch, size) > maxW - size) return out + "…";
    out += ch;
  }
  return out;
};
const rect = (x, y, w, h, o = {}) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.r ?? 0}" fill="${o.fill ?? "none"}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 1}"` : ""}${o.opacity != null ? ` opacity="${o.opacity}"` : ""}/>`;
const text = (x, y, s, o = {}) => `<text x="${x}" y="${y}" font-family="${o.mono ? MONO : FONT}" font-size="${o.size ?? 13}" fill="${o.fill ?? C.fg}"${o.weight ? ` font-weight="${o.weight}"` : ""}${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.opacity != null ? ` opacity="${o.opacity}"` : ""}>${esc(s)}</text>`;
const line = (x1, y1, x2, y2, stroke = C.line, sw = 1) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"/>`;
const circle = (cx, cy, r, o = {}) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${o.fill ?? "none"}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw ?? 1}"` : ""}/>`;
const card = (x, y, w, h) => rect(x, y, w, h, { r: 12, fill: C.card, stroke: C.border });
const chip = (x, y, label, o = {}) => {
  const size = o.size ?? 11;
  const w = tw(label, size) + 14;
  return rect(x, y, w, 20, { r: 6, fill: o.bg ?? C.fill }) + text(x + 7, y + 14, label, { size, fill: o.fg ?? C.muted, weight: 500 });
};
let gradSeq = 0;
const defs = [];
const avatar = (x, y, size, seedChar, pairIdx) => {
  const pair = PAIRS[pairIdx % PAIRS.length];
  const id = `av${gradSeq++}`;
  defs.push(`<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pair[0]}"/><stop offset="1" stop-color="${pair[1]}"/></linearGradient>`);
  return circle(x + size / 2, y + size / 2, size / 2, { fill: `url(#${id})` }) + text(x + size / 2, y + size / 2 + size * 0.18, seedChar, { size: size * 0.42, fill: "#111111", weight: 700, anchor: "middle" });
};
const dot = (x, y, color) => circle(x, y, 4, { fill: color });
const bell = (x, y, color = C.faint) => `<path d="M${x} ${y + 8} q0 -6 5 -6 q5 0 5 6 l1.5 3 h-13 z" fill="none" stroke="${color}" stroke-width="1.4"/><path d="M${x + 3.5} ${y + 12.5} q1.5 2 3 0" fill="none" stroke="${color}" stroke-width="1.4"/>`;
const commentIcon = (x, y, color = C.faint) => `<path d="M${x} ${y} h12 v8 h-7 l-3 3 v-3 h-2 z" fill="none" stroke="${color}" stroke-width="1.4"/>`;
const warn = (x, y, color = C.warning) => `<path d="M${x + 6} ${y} l6 11 h-12 z" fill="none" stroke="${color}" stroke-width="1.4"/><line x1="${x + 6}" y1="${y + 4}" x2="${x + 6}" y2="${y + 7.5}" stroke="${color}" stroke-width="1.4"/>`;
const spinner = (x, y, color = C.brand) => `<path d="M${x + 7} ${y} a7 7 0 1 1 -7 7" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round"/>`;
const chevron = (x, y, color = C.faint) => `<path d="M${x} ${y} l4 4 l-4 4" fill="none" stroke="${color}" stroke-width="1.6" stroke-linecap="round"/>`;
const btn = (x, y, label, o = {}) => {
  const size = 12;
  const w = tw(label, size) + 24;
  return { svg: rect(x, y, w, 30, { r: 8, fill: o.primary ? C.fg : C.card, stroke: o.primary ? undefined : C.border }) + text(x + 12, y + 19.5, label, { size, fill: o.primary ? C.canvas : C.muted, weight: 500 }), w };
};

const RAIL_ITEMS = ["overview", "issues", "projects", "team", "chat", "autopilot", "workflows", "labels"];
const railIcon = (key, x, y, color) => {
  const s = { fill: "none", stroke: color, sw: 1.5 };
  switch (key) {
    case "overview": return rect(x, y, 7, 7, { r: 1.5, ...s }) + rect(x + 9, y, 7, 7, { r: 1.5, ...s }) + rect(x, y + 9, 7, 7, { r: 1.5, ...s }) + rect(x + 9, y + 9, 7, 7, { r: 1.5, ...s });
    case "issues": return line(x, y + 2, x + 16, y + 2, color, 1.5) + line(x, y + 8, x + 16, y + 8, color, 1.5) + line(x, y + 14, x + 10, y + 14, color, 1.5);
    case "projects": return `<path d="M${x} ${y + 3} h6 l2 2 h8 v9 h-16 z" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    case "team": return circle(x + 5, y + 5, 3, { stroke: color, sw: 1.5 }) + circle(x + 12, y + 6, 2.5, { stroke: color, sw: 1.5 }) + `<path d="M${x} ${y + 14} q5 -5 10 0 M${x + 9} ${y + 14} q3.5 -4 7 0" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    case "chat": return `<path d="M${x} ${y} h16 v10 h-9 l-4 4 v-4 h-3 z" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    case "autopilot": return rect(x + 2, y + 4, 12, 9, { r: 2, stroke: color, sw: 1.5 }) + line(x + 8, y, x + 8, y + 4, color, 1.5) + circle(x + 5.5, y + 8.5, 1.2, { fill: color }) + circle(x + 10.5, y + 8.5, 1.2, { fill: color });
    case "workflows": return circle(x + 3, y + 3, 2.5, { stroke: color, sw: 1.5 }) + circle(x + 13, y + 13, 2.5, { stroke: color, sw: 1.5 }) + `<path d="M${x + 5.5} ${y + 3} h5 q2 0 2 2 v5" fill="none" stroke="${color}" stroke-width="1.5"/>`;
    default: return `<path d="M${x} ${y + 2} h8 l6 6 l-8 8 l-6 -6 z" fill="none" stroke="${color}" stroke-width="1.5"/>` + circle(x + 4, y + 6, 1.2, { fill: color });
  }
};
const rail = (active) => {
  let s = rect(0, 0, 48, H, { fill: C.shell }) + line(48, 0, 48, H, C.border);
  RAIL_ITEMS.forEach((key, i) => {
    const y = 14 + i * 44;
    if (key === active) s += rect(6, y - 6, 36, 36, { r: 10, fill: C.fillStrong });
    s += railIcon(key, 16, y + 2, key === active ? C.brand : C.faint);
  });
  s += circle(24, H - 62, 8, { stroke: C.faint, sw: 1.5 }) + circle(24, H - 62, 2.5, { fill: C.faint });
  s += circle(24, H - 26, 9, { fill: C.fill }) + text(24, H - 22, L("演", "D"), { size: 10, fill: C.muted, anchor: "middle" });
  return s;
};
const sidebar = (activeNav) => {
  let s = rect(48, 0, 224, H, { fill: C.shell }) + line(272, 0, 272, H, C.border);
  s += rect(60, 14, 200, 34, { r: 8, fill: C.fill }) + text(72, 35, L("示例工作区", "Demo Workspace"), { size: 13, weight: 600 }) + chevron(244, 27);
  s += bell(66, 62, C.muted) + text(88, 74, L("收件箱", "Inbox"), { size: 13, fill: C.muted });
  s += chip(214, 60, "3", { bg: C.brand, fg: "#111111", size: 10 });
  s += text(64, 108, L("视图", "Views"), { size: 11, fill: C.faint, weight: 600 });
  const views = [[L("全部任务", "All issues"), "10"], [L("我的工作", "My work"), "4"], [L("执行中", "Active"), "2"], [L("已完成", "Done"), "2"], [L("已取消", "Closed"), "1"]];
  views.forEach(([label, count], i) => {
    const y = 122 + i * 30;
    if (label === activeNav) s += rect(58, y - 4, 204, 28, { r: 8, fill: C.fillStrong });
    s += text(70, y + 14, label, { size: 13, fill: label === activeNav ? C.fg : C.muted }) + text(250, y + 14, count, { size: 11, fill: C.faint, anchor: "end" });
  });
  s += text(64, 292, L("项目", "Projects"), { size: 11, fill: C.faint, weight: 600 });
  D.projects.forEach((p, i) => {
    const y = 306 + i * 30;
    s += circle(74, y + 10, 3, { fill: i === 0 ? C.brand : C.faint }) + text(86, y + 14, fit(projectName(i), 160, 13), { size: 13, fill: C.muted });
  });
  return s;
};
const statusColor = (cat) => D.statuses.find((s) => s.category === cat)?.color ?? C.faint;
const prioMark = (x, y, prio) => {
  const color = { urgent: C.danger, high: C.high, medium: C.warning, low: C.info, none: C.faint }[prio] ?? C.faint;
  const bars = { urgent: 4, high: 3, medium: 2, low: 1, none: 0 }[prio] ?? 0;
  let s = "";
  for (let i = 0; i < 4; i++) s += rect(x + i * 3.4, y + 8 - (i + 1) * 2, 2.4, (i + 1) * 2, { r: 0.8, fill: i < bars ? color : C.fill });
  return s;
};
const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs.join("")}</defs>${rect(0, 0, W, H, { fill: C.canvas })}${body}</svg>`;

const overview = () => {
  defs.length = 0; gradSeq = 0;
  let s = rail("overview");
  const x = 66, mw = W - x - 18;
  s += card(x, 18, mw, 148);
  s += rect(x + 20, 36, 44, 44, { r: 13, fill: "#2F9169" }) + text(x + 42, 64, "✳", { size: 22, fill: "#fff", anchor: "middle" });
  s += text(x + 78, 55, L("下午好，演示用户", "Good afternoon, Demo User"), { size: 19, weight: 700 });
  s += text(x + 78, 76, L("这里汇总了工作区的需求流转、收件箱与智能体状态。上次同步 刚刚。", "Workspace issue flow, inbox and agent status at a glance. Last sync just now."), { size: 12.5, fill: C.muted });
  let bx = x + 20;
  for (const [label, primary] of [[L("新建需求", "New issue"), true], [L("团队", "Team"), false]]) {
    const b = btn(bx, 96, label, { primary });
    s += b.svg; bx += b.w + 8;
  }
  const metrics = [[L("需求总数", "Total issues"), String(D.issues.length)], [L("进行中", "In progress"), String(D.issues.filter((i) => i.status_category === "in_progress").length)], [L("未读通知", "Unread"), String(D.inbox.filter((i) => !i.read).length)], [L("在线运行时", "Runtimes online"), "1/2"]];
  metrics.forEach(([label, value], i) => {
    const mx = x + i * (mw / 4);
    if (i > 0) s += line(mx, 130, mx, 166, C.border);
    s += text(mx + 16, 146, label, { size: 11, fill: C.faint }) + text(mx + 16, 162, value, { size: 17, weight: 700 });
  });
  s += line(x, 130, x + mw, 130, C.border);
  s += card(x, 180, mw, 152);
  s += text(x + 16, 204, L("用量与稳定性", "Usage & stability"), { size: 14, weight: 600 }) + text(x + mw - 16, 204, L("刷新", "Refresh"), { size: 12, fill: C.faint, anchor: "end" });
  const tokens = D.usageDaily.reduce((t, d) => t + d.input_tokens + d.output_tokens + d.cache_read_tokens, 0);
  const tasks = D.usageDaily.reduce((t, d) => t + d.task_count, 0);
  const fails = D.failuresDaily.reduce((t, d) => t + d.task_count, 0);
  const stats = [["Tokens", `${(tokens / 1e6).toFixed(1)}M`], [L("任务数", "Tasks"), String(tasks)], [L("失败任务", "Failed tasks"), String(fails)], [L("平均耗时", "Avg duration"), L("1 分钟", "1 min")]];
  stats.forEach(([label, value], i) => {
    const sx = x + 16 + i * 200;
    s += rect(sx, 216, 188, 62, { r: 10, fill: C.canvas, stroke: C.border });
    s += text(sx + 12, 236, label, { size: 11, fill: C.faint }) + text(sx + 12, 262, value, { size: 18, weight: 700, fill: i === 2 ? C.danger : C.fg });
  });
  const maxDay = Math.max(...D.usageDaily.map((d) => d.input_tokens + d.output_tokens));
  D.usageDaily.forEach((d, i) => {
    const h = 8 + 34 * ((d.input_tokens + d.output_tokens) / maxDay);
    s += rect(x + 830 + i * 40, 272 - h, 30, h, { r: 3, fill: C.brand, opacity: 0.85 });
    s += text(x + 845 + i * 40, 286, d.date.slice(5), { size: 9, fill: C.faint, anchor: "middle" });
  });
  ["demo_provider_timeout", "demo_unknown", "demo_auth"].forEach((reason, i) => {
    const y = 222 + i * 22;
    s += warn(x + 1130, y, C.warning) + text(x + 1150, y + 10, reason, { size: 10.5, fill: C.muted, mono: true });
    s += chip(x + mw - 60, y - 4, L(`${[30, 10, 5][i]} 次`, `${[30, 10, 5][i]}×`), { bg: "rgba(227,179,65,0.15)", fg: C.warning, size: 10 });
  });
  const gy = 346, lw = 900, rx = x + lw + 14, rw = mw - lw - 14;
  s += card(x, gy, lw, 380);
  s += text(x + 16, gy + 26, L("最近更新的需求", "Recently updated issues"), { size: 14, weight: 600 }) + text(x + lw - 16, gy + 26, L("全部 ›", "All ›"), { size: 12, fill: C.brand, anchor: "end" });
  D.issues.slice(0, 8).forEach((issue, i) => {
    const y = gy + 44 + i * 41;
    if (i > 0) s += line(x + 14, y - 6, x + lw - 14, y - 6, C.line);
    s += dot(x + 24, y + 12, statusColor(issue.status_category));
    s += text(x + 40, y + 16, issue.identifier, { size: 11.5, fill: C.faint, mono: true });
    s += text(x + 110, y + 16, fit(titleOf(i), lw - 220, 13), { size: 13 });
    s += text(x + lw - 16, y + 16, relTime(issue.updated_at), { size: 11, fill: C.faint, anchor: "end" });
  });
  s += card(x, gy + 394, lw, 142);
  s += text(x + 16, gy + 420, L("项目进展", "Project progress"), { size: 14, weight: 600 }) + text(x + lw - 16, gy + 420, L("全部 ›", "All ›"), { size: 12, fill: C.brand, anchor: "end" });
  D.projects.forEach((p, i) => {
    const y = gy + 440 + i * 46;
    s += text(x + 16, y + 12, projectName(i), { size: 13, weight: 600 }) + text(x + lw - 16, y + 12, `${p.done_count}/${p.issue_count}`, { size: 11, fill: C.faint, anchor: "end" });
    s += rect(x + 16, y + 20, lw - 32, 6, { r: 3, fill: C.fill });
    s += rect(x + 16, y + 20, (lw - 32) * (p.done_count / p.issue_count), 6, { r: 3, fill: i === 0 ? C.brand : C.success });
  });
  s += card(rx, gy, rw, 300);
  s += text(rx + 16, gy + 26, L("收件箱", "Inbox"), { size: 14, weight: 600 });
  s += chip(rx + 70, gy + 12, L("3 未读", "3 unread"), { bg: "rgba(122,162,247,0.15)", fg: C.brand, size: 10 });
  s += text(rx + rw - 16, gy + 26, L("全部已读", "Mark all read"), { size: 12, fill: C.muted, anchor: "end" });
  const inboxBodies = [
    L("虚构评论：下一步要做什么？", "Fictional comment: what next?"),
    L("负责人变更为 星尘·示例智能体", "Assignee changed to Stardust·Demo Agent"),
    L("状态变更为 审核中", "Status changed to In review"),
    L("虚构失败原因：demo_provider_timeout", "Fictional failure: demo_provider_timeout"),
  ];
  D.inbox.slice(0, 4).forEach((item, i) => {
    const y = gy + 44 + i * 56;
    if (i > 0) s += line(rx + 14, y - 6, rx + rw - 14, y - 6, C.line);
    s += item.type === "new_comment" ? commentIcon(rx + 18, y + 4, C.brand) : bell(rx + 18, y + 2, item.severity === "warning" ? C.warning : C.faint);
    s += text(rx + 42, y + 14, fit(titleOf(D.issues.findIndex((q) => q.id === item.issue_id)), rw - 120, 12.5), { size: 12.5, weight: item.read ? 400 : 600 });
    s += text(rx + 42, y + 30, fit(inboxBodies[i], rw - 120, 11.5), { size: 11.5, fill: C.faint });
    s += text(rx + 42, y + 44, `${item.issue_identifier} · ${relTime(item.created_at)}`, { size: 10.5, fill: C.faint, mono: true });
  });
  s += line(rx, gy + 270, rx + rw, gy + 270, C.line);
  s += text(rx + 16, gy + 288, L("共 6 条", "6 items"), { size: 11, fill: C.faint }) + text(rx + rw - 16, gy + 288, L("查看全部 ›", "View all ›"), { size: 11, fill: C.brand, anchor: "end" });
  s += card(rx, gy + 314, rw, 222);
  s += text(rx + 16, gy + 340, L("智能体", "Agents"), { size: 14, weight: 600 }) + text(rx + rw - 16, gy + 340, L("管理 ›", "Manage ›"), { size: 12, fill: C.brand, anchor: "end" });
  D.agents.forEach((a, i) => {
    const y = gy + 356 + i * 40;
    if (i > 0) s += line(rx + 14, y - 5, rx + rw - 14, y - 5, C.line);
    s += avatar(rx + 16, y, 24, agentName(i)[0], i);
    s += text(rx + 50, y + 12, fit(agentName(i), rw - 160, 13), { size: 13, weight: 500 });
    s += text(rx + 50, y + 26, fit(a.runtime_id ? runtimeName(D.runtimes.findIndex((r) => r.id === a.runtime_id)) : L("未绑定运行时", "No runtime bound"), rw - 160, 10.5), { size: 10.5, fill: C.faint });
    s += chip(rx + rw - 76, y + 4, a.status === "working" ? L("在工作", "Working") : L("空闲", "Idle"), { bg: a.status === "working" ? "rgba(63,185,80,0.15)" : C.fill, fg: a.status === "working" ? C.success : C.faint, size: 10 });
  });
  s += text(rx + 16, gy + 528, L("已加载 4 / 4", "Loaded 4 / 4"), { size: 10.5, fill: C.faint });
  return wrap(s);
};

const kanban = () => {
  defs.length = 0; gradSeq = 0;
  let s = rail("issues") + sidebar(L("全部任务", "All issues"));
  const x = 288, mw = W - x - 16;
  s += text(x, 34, L("全部任务", "All issues"), { size: 15, weight: 600 });
  s += rect(x + 90, 16, 320, 30, { r: 8, fill: C.card, stroke: C.border }) + text(x + 102, 35, L("搜索需求标题或编号…", "Search issue title or number…"), { size: 12, fill: C.faint });
  s += rect(x + mw - 150, 16, 96, 30, { r: 8, fill: C.fill }) + rect(x + mw - 148, 18, 46, 26, { r: 6, fill: C.card }) + text(x + mw - 125, 35, L("看板", "Board"), { size: 12, anchor: "middle" }) + text(x + mw - 78, 35, L("列表", "List"), { size: 12, fill: C.faint, anchor: "middle" });
  s += btn(x + mw - 44, 16, L("新建", "New"), {}).svg;
  const cols = ["backlog", "todo", "in_progress", "in_review", "done", "closed"];
  const cw = (mw - 5 * 12) / 6;
  cols.forEach((cat, ci) => {
    const cx = x + ci * (cw + 12);
    const items = D.issues.map((issue, i) => ({ issue, i })).filter(({ issue }) => issue.status_category === cat);
    s += rect(cx, 60, cw, H - 76, { r: 12, fill: C.fill, opacity: 0.4 });
    s += dot(cx + 16, 80, statusColor(cat)) + text(cx + 28, 84, statusName(cat), { size: 13, weight: 500 }) + text(cx + 28 + tw(statusName(cat), 13) + 8, 84, String(items.length), { size: 11.5, fill: C.faint });
    s += text(cx + cw - 16, 84, "+", { size: 15, fill: C.faint, anchor: "end" });
    items.forEach(({ issue, i }, k) => {
      const cy = 96 + k * 108;
      s += rect(cx + 8, cy, cw - 16, 100, { r: 10, fill: C.card, stroke: C.border });
      s += text(cx + 18, cy + 20, issue.identifier, { size: 10.5, fill: C.faint, mono: true });
      s += prioMark(cx + cw - 40, cy + 10, issue.priority);
      const t = titleOf(i).replace(/^(示例需求：|Demo issue: )/, "");
      s += text(cx + 18, cy + 40, fit(t, cw - 36, 12.5), { size: 12.5, weight: 500 });
      s += text(cx + 18, cy + 56, fit(t.slice(LOCALE === "en" ? 24 : 10), cw - 36, 12.5), { size: 12.5, weight: 500, fill: C.muted });
      const ai = issue.assignee_type === "agent" ? D.agents.findIndex((a) => a.id === issue.assignee_id) : -1;
      s += avatar(cx + 18, cy + 68, 18, ai >= 0 ? agentName(ai)[0] : L("演", "D"), ai >= 0 ? ai : 5);
      s += chip(cx + 42, cy + 68, fit(projectName(D.projects.findIndex((p) => p.id === issue.project_id)).replace(/^(示例项目·|Demo Project·)/, ""), 70, 10), { size: 10 });
    });
  });
  return wrap(s);
};

const issueDetail = () => {
  defs.length = 0; gradSeq = 0;
  let s = rail("issues") + sidebar(L("全部任务", "All issues"));
  const x = 288, pw = 296, px = W - 16 - pw, cw = px - x - 14;
  s += text(x, 30, L("任务 / DEMO-1", "Issues / DEMO-1"), { size: 12, fill: C.faint });
  s += text(x, 62, titleOf(0), { size: 19, weight: 700 });
  s += chip(x, 76, L("进行中", "In progress"), { bg: "rgba(0,112,227,0.15)", fg: C.info, size: 11 });
  s += chip(x + 70, 76, L("优先级 高", "Priority High"), { bg: "rgba(240,136,62,0.15)", fg: C.high, size: 11 });
  s += text(x, 116, fit(L("虚构描述：仅用于脱敏截图，不含任何真实数据。", "Fictional description: desensitized media only, no real data."), cw, 13), { size: 13, fill: C.muted });
  let y = 140;
  s += card(x, y, cw, 190);
  s += avatar(x + 16, y + 16, 22, agentName(0)[0], 0);
  s += text(x + 46, y + 31, agentName(0), { size: 13.5, weight: 600 });
  s += chip(x + 46 + tw(agentName(0), 13.5) + 8, y + 17, L("智能体", "Agent"), { bg: "rgba(122,162,247,0.15)", fg: C.brand, size: 10 });
  s += text(x + cw - 16, y + 31, L("49 分钟前", "49 min ago"), { size: 11.5, fill: C.faint, anchor: "end" });
  s += text(x + 46, y + 62, L("【示例分析】通过", "[Demo analysis] passed"), { size: 13.5, weight: 700 });
  s += text(x + 46, y + 86, L("已按虚构门禁确认 4 项清单：DEMO_ARCH 与 DEMO_SENIOR 的步骤正文与", "Fictional gate check confirmed 4 items: DEMO_ARCH and DEMO_SENIOR step bodies and"), { size: 12.5, fill: C.muted });
  s += text(x + 46, y + 104, L("检查项回读一致，无人工项。", "check items read back consistently, no manual items."), { size: 12.5, fill: C.muted });
  s += rect(x + 46, y + 116, 150, 20, { r: 5, fill: C.fill }) + text(x + 54, y + 130, "demo.py --check", { size: 11, fill: C.muted, mono: true });
  s += text(x + 204, y + 130, L("通过，86 个文件零差异。", "passed, 86 files zero diff."), { size: 12.5, fill: C.muted });
  s += text(x + 46, y + 166, L("运行日志 · 3m", "Run log · 3m"), { size: 11.5, fill: C.faint }) + chevron(x + 46 + tw(L("运行日志 · 3m", "Run log · 3m"), 11.5) + 6, y + 158);
  y += 204;
  s += card(x, y, cw, 252);
  s += avatar(x + 16, y + 16, 22, L("演", "D"), 5);
  s += text(x + 46, y + 31, L("演示用户", "Demo User"), { size: 13.5, weight: 600 });
  s += text(x + 46 + tw(L("演示用户", "Demo User"), 13.5) + 8, y + 31, L("回复 星尘·示例智能体", "Reply to Stardust·Demo Agent"), { size: 11.5, fill: C.faint });
  s += text(x + cw - 16, y + 31, L("3 分钟前", "3 min ago"), { size: 11.5, fill: C.faint, anchor: "end" });
  s += text(x + 46, y + 60, L("下一步要做什么？请继续示例流程。", "What next? Continue the demo flow."), { size: 13 });
  s += rect(x + 16, y + 76, cw - 32, 34, { r: 8, fill: C.canvas });
  s += avatar(x + 24, y + 83, 20, agentName(1)[0], 1);
  s += text(x + 52, y + 97, agentName(1), { size: 12.5, weight: 500 });
  s += spinner(x + 52 + tw(agentName(1), 12.5) + 10, y + 86);
  s += text(x + 52 + tw(agentName(1), 12.5) + 32, y + 97, L("查看示例工作区状态", "Check demo workspace status"), { size: 12.5, fill: C.muted });
  s += text(x + cw - 70, y + 97, "1m 10s", { size: 11, fill: C.faint, anchor: "end" });
  s += chevron(x + cw - 56, y + 89);
  s += rect(x + cw - 40, y + 86, 12, 12, { r: 2.5, stroke: C.faint, sw: 1.5 });
  s += line(x + 16, y + 122, x + cw - 16, y + 122, C.line);
  s += avatar(x + 16, y + 134, 22, agentName(2)[0], 2);
  s += text(x + 46, y + 149, agentName(2), { size: 13.5, weight: 600 });
  s += text(x + cw - 16, y + 149, L("33 分钟前", "33 min ago"), { size: 11.5, fill: C.faint, anchor: "end" });
  s += text(x + 46, y + 176, L("【示例评审】通过：净差异只有本单内容，冲突保留双方。", "[Demo review] passed: net diff only this issue, conflicts keep both sides."), { size: 13 });
  s += line(x + 16, y + 196, x + cw - 16, y + 196, C.line);
  s += rect(x + 16, y + 208, cw - 32, 30, { r: 8, fill: C.canvas, stroke: C.border });
  s += text(x + 28, y + 227, L("回复…", "Reply…"), { size: 12.5, fill: C.faint });
  s += text(x + cw - 60, y + 227, "@", { size: 13, fill: C.faint }) + `<path d="M${x + cw - 40} ${y + 220} l14 6 l-14 6 l3 -6 z" fill="${C.faint}"/>`;
  y += 266;
  s += chevron(x + 4, y + 4) + text(x + 18, y + 14, L("2 条动态", "2 activities"), { size: 12, fill: C.muted });
  s += card(px, 140, pw, 300);
  s += text(px + 14, 166, L("属性", "Attributes"), { size: 13, weight: 600 });
  const attrs = [[L("状态", "Status"), L("进行中", "In progress")], [L("优先级", "Priority"), L("高", "High")], [L("负责人", "Assignee"), agentName(1)], [L("项目", "Project"), projectName(0)], [L("标签", "Labels"), L("示例标签·门禁", "Demo Label·Gate")]];
  attrs.forEach(([k, v], i) => {
    const ay = 186 + i * 34;
    s += text(px + 14, ay + 12, k, { size: 12, fill: C.faint });
    s += text(px + 76, ay + 12, fit(v, pw - 92, 12.5), { size: 12.5 });
    if (i < attrs.length - 1) s += line(px + 14, ay + 22, px + pw - 14, ay + 22, C.line);
  });
  s += card(px, 454, pw, 220);
  s += text(px + 14, 480, L("执行日志 · 3", "Execution log · 3"), { size: 13, weight: 600 });
  const ex = [["$0.42", L("已花费", "Spent")], ["403K", "Token"], ["5m", L("智能体工作", "Agent work")]];
  ex.forEach(([v, k], i) => {
    const exx = px + 14 + i * 92;
    s += text(exx, 510, v, { size: 15, weight: 700 }) + text(exx, 526, k, { size: 10.5, fill: C.faint });
  });
  s += text(px + 14, 552, L("详情 · 3 次运行", "Details · 3 runs"), { size: 11.5, fill: C.brand });
  D.runs.slice(0, 2).forEach((r, i) => {
    const ry = 566 + i * 44;
    s += line(px + 14, ry, px + pw - 14, ry, C.line);
    const ai = D.agents.findIndex((g) => g.id === r.agent_id);
    s += avatar(px + 14, ry + 10, 18, agentName(ai)[0], ai);
    s += text(px + 40, ry + 22, fit(agentName(ai), pw - 110, 12), { size: 12 });
    s += text(px + pw - 14, ry + 22, r.status === "completed" ? "3m" : L("运行中", "Running"), { size: 11, fill: r.status === "completed" ? C.faint : C.success, anchor: "end" });
  });
  return wrap(s);
};

fs.writeFileSync(path.join(outDir, "overview.svg"), overview());
fs.writeFileSync(path.join(outDir, "kanban.svg"), kanban());
fs.writeFileSync(path.join(outDir, "issue-detail.svg"), issueDetail());
const logoSrc = fs.readFileSync(path.join(root, "client", "workbench", "Logo.tsx"), "utf8");
const logo = logoSrc.match(/`(<svg[\s\S]*?<\/svg>)`/)[1].replace('width="24" height="24"', 'width="256" height="256"');
fs.writeFileSync(path.join(root, "assets", "icon.svg"), logo);
console.log("wrote", LOCALE, fs.readdirSync(outDir).join(", "), "+ icon.svg");