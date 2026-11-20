// 脱敏演示服务器：仅含虚构种子数据（tools/demo-data.mjs），用于本地体验与媒体渲染对照。
// 启动：node tools/demo-server.mjs [port]（默认 4173）。用完关闭进程并删除演示连接。
import http from "node:http";
import * as D from "./demo-data.mjs";

const port = Number(process.argv[2] ?? 4173);
const inbox = D.inbox.map((i) => ({ ...i }));

const routes = [
  [/^\/api\/me$/, () => D.me],
  [/^\/api\/workspaces$/, () => D.workspaces],
  [/^\/api\/issue-statuses$/, () => ({ statuses: D.statuses })],
  [/^\/api\/issues$/, () => ({ issues: D.issues, total: D.issues.length, created_by_user_id: D.me.id })],
  [/^\/api\/issues\/([^/]+)$/, (m) => D.issues.find((i) => i.id === m[1]) ?? D.issues[0]],
  [/^\/api\/issues\/([^/]+)\/children$/, () => ({ issues: [] })],
  [/^\/api\/issues\/([^/]+)\/labels$/, () => ({ labels: [D.labels[0]] })],
  [/^\/api\/issues\/([^/]+)\/comments$/, () => ({ comments: D.comments })],
  [/^\/api\/issues\/([^/]+)\/timeline$/, () => ({ timeline: D.timeline })],
  [/^\/api\/issues\/([^/]+)\/task-runs$/, () => ({ tasks: D.runs })],
  [/^\/api\/issues\/([^/]+)\/active-task$/, () => ({ tasks: D.runs.filter((r) => r.status === "running") })],
  [/^\/api\/issues\/([^/]+)\/usage$/, () => ({ cost_usd_ticks: 4_200_000, task_count: 3, terminal_task_count: 2, total_input_tokens: 275_000, total_output_tokens: 38_000, total_cache_read_tokens: 90_000, unreported_task_count: 0 })],
  [/^\/api\/agents$/, () => ({ agents: D.agents, total: D.agents.length })],
  [/^\/api\/runtimes$/, () => ({ runtimes: D.runtimes })],
  [/^\/api\/projects$/, () => ({ projects: D.projects })],
  [/^\/api\/labels$/, () => ({ labels: D.labels, total: D.labels.length })],
  [/^\/api\/skills$/, () => ({ skills: D.skills })],
  [/^\/api\/squads$/, () => ({ squads: D.squads })],
  [/^\/api\/working-agents$/, () => ({ agents: [{ id: "agent-demo-2", name: D.agents[1].name, avatar_url: D.agents[1].avatar_url, running_task_count: 1, issue_ids: ["issue-demo-1"] }] })],
  [/^\/api\/inbox$/, () => ({ items: inbox, total: inbox.length })],
  [/^\/api\/inbox\/unread-count$/, () => ({ count: inbox.filter((i) => !i.read && !i.archived).length })],
  [/^\/api\/inbox\/archived$/, () => ({ items: [], total: 0 })],
  [/^\/api\/inbox\/snoozed$/, () => ({ items: [], total: 0 })],
  [/^\/api\/dashboard\/usage\/daily$/, () => D.usageDaily],
  [/^\/api\/dashboard\/failures\/daily$/, () => D.failuresDaily],
  [/^\/api\/dashboard\/runtime\/daily$/, () => D.runtimeDaily],
  [/^\/api\/chat\/sessions$/, () => D.sessions],
  [/^\/api\/chat\/sessions\/([^/]+)\/messages$/, () => ({ messages: D.sessionMessages })],
  [/^\/api\/autopilots$/, () => ({ autopilots: D.autopilots })],
  [/^\/api\/autopilots\/usage$/, () => ({ used: 3, limit: 100 })],
  [/^\/api\/autopilots\/([^/]+)\/runs$/, () => ({ runs: [{ id: "run-1", status: "completed", triggered_at: D.iso(18 * D.MIN), source: "schedule", issue_id: "issue-demo-5" }] })],
  [/^\/api\/issue-workflows$/, () => ({ workflows: D.workflows })],
  [/^\/api\/workspaces\/([^/]+)\/members$/, () => ({ members: D.members })],
  [/^\/api\/tokens$/, () => ({ tokens: D.tokens })],
  [/^\/api\/tasks\/([^/]+)\/messages$/, () => ({ messages: D.messages })],
];

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${port}`);
  const send = (data) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  if (req.method === "GET") {
    for (const [re, fn] of routes) {
      const m = url.pathname.match(re);
      if (m) return send(fn(m));
    }
    return send({});
  }
  if (url.pathname.startsWith("/api/inbox/") && req.method === "POST") {
    const id = url.pathname.split("/")[3];
    const item = inbox.find((i) => i.id === id);
    if (item) {
      if (url.pathname.endsWith("/read")) item.read = true;
      if (url.pathname.endsWith("/unread")) item.read = false;
      if (url.pathname.endsWith("/archive")) item.archived = true;
    }
    if (url.pathname.endsWith("/mark-all-read")) inbox.forEach((i) => (i.read = true));
  }
  send({ ok: true });
});
server.listen(port, "127.0.0.1", () => console.log(`demo server on http://127.0.0.1:${port}`));