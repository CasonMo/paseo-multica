// 虚构种子数据：脱敏演示服务器与 listing 媒体渲染的唯一数据源。
// 不含任何真实姓名、账号、工作区/需求 ID、token 或内网主机名。
const now = Date.now();
export const iso = (msAgo) => new Date(now - msAgo).toISOString();
export const MIN = 60_000;

export const me = { id: "usr-demo-0001", name: "演示用户", email: "demo@example.com", avatar_url: null };
export const workspaces = [
  { id: "ws-demo-0001", name: "示例工作区", slug: "demo-workspace", issue_prefix: "DEMO", description: "虚构演示工作区", avatar_url: null },
];
export const statuses = [
  { id: "st-1", key: "backlog", name: "待规划", category: "backlog", color: "#81818b", position: 1 },
  { id: "st-2", key: "todo", name: "待办", category: "todo", color: "#64636e", position: 2 },
  { id: "st-3", key: "in_progress", name: "进行中", category: "in_progress", color: "#0070e3", position: 3 },
  { id: "st-4", key: "in_review", name: "审核中", category: "in_review", color: "#e3b341", position: 4 },
  { id: "st-5", key: "done", name: "已完成", category: "done", color: "#3fb950", position: 5 },
  { id: "st-6", key: "closed", name: "已取消", category: "closed", color: "#a1a1aa", position: 6 },
];
export const agents = [
  { id: "agent-demo-1", name: "星尘·示例智能体", avatar_url: "emoji:🦄", status: "working", runtime_id: "rt-demo-1", runtime_bound: true, description: "虚构的需求分析智能体", archived_at: null },
  { id: "agent-demo-2", name: "蓝鲸·示例智能体", avatar_url: "emoji:🐳", status: "idle", runtime_id: "rt-demo-1", runtime_bound: true, description: "虚构的实现智能体", archived_at: null },
  { id: "agent-demo-3", name: "琥珀·示例智能体", avatar_url: "emoji:🦊", status: "idle", runtime_id: "rt-demo-2", runtime_bound: true, description: "虚构的评审智能体", archived_at: null },
  { id: "agent-demo-4", name: "青瓷·示例智能体", avatar_url: "emoji:🐨", status: "idle", runtime_id: null, runtime_bound: false, description: "虚构的测试智能体", archived_at: null },
];
export const runtimes = [
  { id: "rt-demo-1", name: "demo-runtime-01", custom_name: "示例运行时·甲", provider: "claude", status: "online", device_info: "Demo Mac mini", visibility: "workspace", last_seen_at: iso(1 * MIN) },
  { id: "rt-demo-2", name: "demo-runtime-02", custom_name: "示例运行时·乙", provider: "claude", status: "offline", device_info: "Demo Laptop", visibility: "workspace", last_seen_at: iso(26 * 60 * MIN) },
];
export const members = [
  { id: "mem-demo-01", user_id: me.id, name: me.name, email: me.email, role: "owner", avatar_url: null },
  { id: "mem-demo-02", user_id: "usr-demo-0002", name: "示例协作者", email: "teammate@example.com", role: "member", avatar_url: null },
];
export const projects = [
  { id: "proj-demo-01", title: "示例项目·流程仓", description: "虚构项目", status: "active", issue_count: 12, done_count: 7, lead_id: "mem-demo-01", archived_at: null, due_date: null },
  { id: "proj-demo-02", title: "示例项目·投放台", description: "虚构项目", status: "planned", issue_count: 4, done_count: 1, lead_id: "mem-demo-02", archived_at: null, due_date: null },
];
export const issueTitles = [
  "示例需求：交接提示先流转 qa_passed",
  "示例需求：判断类材料补推荐与不选会怎样",
  "示例需求：数字人调整入口文案",
  "示例需求：复杂度评分同步工单附件",
  "示例需求：架构师模型降本分档",
  "示例需求：执行器命名空间边界校验",
  "示例需求：报表回传扣减防重",
  "示例需求：审批卡字段读区拆出",
  "示例需求：免 QA 单门禁提示",
  "示例需求：快照零差异索引同步",
];
export const catByIndex = ["in_progress", "todo", "backlog", "in_review", "done", "in_progress", "todo", "done", "backlog", "closed"];
export const issues = issueTitles.map((title, i) => ({
  id: `issue-demo-${i + 1}`,
  identifier: `DEMO-${i + 1}`,
  title,
  description: "虚构描述：仅用于脱敏截图，不含任何真实数据。",
  status: statuses.find((s) => s.category === catByIndex[i])?.key ?? "todo",
  status_category: catByIndex[i],
  priority: ["urgent", "high", "medium", "low", "none"][i % 5],
  assignee_type: i % 3 === 0 ? "agent" : "member",
  assignee_id: i % 3 === 0 ? agents[i % 4].id : members[i % 2].id,
  project_id: projects[i % 2].id,
  parent_issue_id: null,
  created_at: iso((i + 3) * 24 * 60 * MIN),
  updated_at: iso((i + 1) * 7 * MIN),
  label_ids: [],
}));
export const runs = [
  { id: "task-demo-1", agent_id: "agent-demo-1", status: "completed", kind: "comment", started_at: iso(52 * MIN), completed_at: iso(49 * MIN), created_at: iso(52 * MIN), attempt: 1, result: { output: "虚构产出：已完成示例分析。" }, attribution: { source: "direct_human", initiator: { id: me.id, name: me.name }, evidence: { kind: "comment", ref_id: "cmt-demo-1" } }, usage: [{ provider: "anthropic", model: "claude-demo", input_tokens: 180000, output_tokens: 26000, cache_read_tokens: 90000 }] },
  { id: "task-demo-2", agent_id: "agent-demo-3", status: "completed", kind: "comment", started_at: iso(35 * MIN), completed_at: iso(33 * MIN), created_at: iso(35 * MIN), attempt: 1, result: { output: "虚构产出：评审通过。" }, attribution: { source: "direct_human", initiator: { id: me.id, name: me.name }, evidence: { kind: "comment", ref_id: "cmt-demo-3" } }, usage: [{ provider: "anthropic", model: "claude-demo", input_tokens: 95000, output_tokens: 12000 }] },
  { id: "task-demo-3", agent_id: "agent-demo-2", status: "running", kind: "comment", started_at: iso(2 * MIN), completed_at: null, created_at: iso(2 * MIN), attempt: 1, attribution: { source: "direct_human", initiator: { id: me.id, name: me.name }, evidence: { kind: "comment", ref_id: "cmt-demo-2" } }, usage: [] },
];
export const comments = [
  { id: "cmt-demo-1", issue_id: "issue-demo-1", parent_id: null, author_type: "agent", author_id: "agent-demo-1", author_name: agents[0].name, source_task_id: "task-demo-1", resolved_at: null, created_at: iso(49 * MIN), content: "【示例分析】通过\n\n已按虚构门禁确认 4 项清单：`DEMO_ARCH` 与 `DEMO_SENIOR` 的步骤正文与检查项回读一致，无人工项。\n\n快照 `demo.py --check` 通过，86 个文件零差异。" },
  { id: "cmt-demo-2", issue_id: "issue-demo-1", parent_id: "cmt-demo-1", author_type: "member", author_id: me.id, author_name: me.name, source_task_id: null, resolved_at: null, created_at: iso(3 * MIN), content: "下一步要做什么？请继续示例流程。" },
  { id: "cmt-demo-3", issue_id: "issue-demo-1", parent_id: "cmt-demo-1", author_type: "agent", author_id: "agent-demo-3", author_name: agents[2].name, source_task_id: "task-demo-2", resolved_at: null, created_at: iso(33 * MIN), content: "【示例评审】通过：净差异只有本单内容，冲突保留双方。" },
];
export const timeline = [
  { type: "activity", id: "tl-1", actor_type: "agent", actor_id: "agent-demo-1", actor_name: agents[0].name, action: "status_changed", created_at: iso(49 * MIN), details: { from: "todo", to: "in_progress" } },
  { type: "activity", id: "tl-2", actor_type: "agent", actor_id: "agent-demo-1", actor_name: agents[0].name, action: "task_completed", created_at: iso(49 * MIN), details: {} },
  { type: "activity", id: "tl-3", actor_type: "member", actor_id: me.id, actor_name: me.name, action: "assignee_changed", created_at: iso(30 * MIN), details: { from: null, to: agents[1].name } },
];
export const messages = [
  { call_id: "call-1", seq: 1, type: "text", created_at: iso(2 * MIN), content: "开始处理示例请求。" },
  { call_id: "call-2", seq: 2, type: "tool_use", tool: "Bash", created_at: iso(110 * 1000), input: { command: "demo-cli status --workspace demo", description: "查看示例工作区状态" } },
  { call_id: "call-2", seq: 3, type: "tool_result", created_at: iso(100 * 1000), output: "demo: ok" },
  { call_id: "call-4", seq: 4, type: "tool_use", tool: "Read", created_at: iso(60 * 1000), input: { file_path: "/demo/README.md", description: "读取示例说明" } },
];
export const inbox = [
  { id: "in-demo-1", type: "new_comment", severity: "info", issue_id: "issue-demo-1", issue_identifier: "DEMO-1", title: "示例需求：交接提示先流转 qa_passed", body: "虚构评论：下一步要做什么？", read: false, archived: false, snoozed_until: null, created_at: iso(3 * MIN) },
  { id: "in-demo-2", type: "assignee_changed", severity: "info", issue_id: "issue-demo-4", issue_identifier: "DEMO-4", title: "示例需求：复杂度评分同步工单附件", body: "负责人变更为 星尘·示例智能体", read: false, archived: false, snoozed_until: null, created_at: iso(11 * MIN) },
  { id: "in-demo-3", type: "issue_updated", severity: "warning", issue_id: "issue-demo-6", issue_identifier: "DEMO-6", title: "示例需求：执行器命名空间边界校验", body: "状态变更为 审核中", read: false, archived: false, snoozed_until: null, created_at: iso(26 * MIN) },
  { id: "in-demo-4", type: "task_failed", severity: "error", issue_id: "issue-demo-7", issue_identifier: "DEMO-7", title: "示例需求：报表回传扣减防重", body: "虚构失败原因：demo_provider_timeout", read: true, archived: false, snoozed_until: null, created_at: iso(2 * 60 * MIN) },
  { id: "in-demo-5", type: "new_comment", severity: "info", issue_id: "issue-demo-2", issue_identifier: "DEMO-2", title: "示例需求：判断类材料补推荐与不选会怎样", body: "虚构评论：材料已补齐。", read: true, archived: false, snoozed_until: null, created_at: iso(5 * 60 * MIN) },
  { id: "in-demo-6", type: "issue_updated", severity: "info", issue_id: "issue-demo-9", issue_identifier: "DEMO-9", title: "示例需求：免 QA 单门禁提示", body: "优先级变更为 高", read: true, archived: false, snoozed_until: null, created_at: iso(9 * 60 * MIN) },
];
export const days = Array.from({ length: 7 }, (_, i) => new Date(now - (6 - i) * 24 * 60 * MIN).toISOString().slice(0, 10));
export const usageDaily = days.map((date, i) => ({ date, model: "claude-demo", input_tokens: 1_200_000 + i * 260_000, output_tokens: 210_000 + i * 40_000, cache_read_tokens: 600_000 + i * 90_000, task_count: 120 + i * 30 }));
export const failuresDaily = days.map((date, i) => ({ date, failure_reason: ["demo_provider_timeout", "demo_unknown", "demo_auth"][i % 3], task_count: [30, 10, 5][i % 3] }));
export const runtimeDaily = days.map((date, i) => ({ date, total_seconds: 9000 + i * 1500, task_count: 120 + i * 30, failed_count: 4 + (i % 3), cancelled_count: 1 }));
export const labels = [
  { id: "lb-1", name: "示例标签·门禁", color: "#0070e3", resource_type: "issue", usage_count: 6, description: "虚构标签", updated_at: iso(3 * 24 * 60 * MIN), created_at: iso(9 * 24 * 60 * MIN) },
  { id: "lb-2", name: "示例标签·降本", color: "#3fb950", resource_type: "issue", usage_count: 3, description: "虚构标签", updated_at: iso(5 * 24 * 60 * MIN), created_at: iso(9 * 24 * 60 * MIN) },
  { id: "lb-3", name: "示例标签·评审", color: "#e3b341", resource_type: "agent", usage_count: 2, description: "虚构标签", updated_at: iso(7 * 24 * 60 * MIN), created_at: iso(9 * 24 * 60 * MIN) },
];
export const squads = [{ id: "sq-demo-1", name: "示例小队", avatar_url: null, leader_id: "agent-demo-1", member_count: 3, member_preview: ["agent-demo-1", "agent-demo-2", "agent-demo-3"], description: "虚构小队" }];
export const skills = [
  { id: "sk-1", name: "demo-snapshot", slug: "demo-snapshot", description: "虚构技能：快照零差异检查", source: "workspace" },
  { id: "sk-2", name: "demo-review", slug: "demo-review", description: "虚构技能：评审清单回读", source: "workspace" },
];
export const autopilots = [{ id: "ap-demo-1", title: "示例自动化·每日巡检", description: "虚构定时任务", assignee_type: "agent", assignee_id: "agent-demo-3", status: "active", execution_mode: "create_issue", trigger_kinds: ["schedule"], next_run_at: iso(-6 * 60 * MIN), last_run_at: iso(18 * 60 * MIN), last_run_status: "completed", project_id: "proj-demo-01", created_at: iso(20 * 24 * 60 * MIN) }];
export const workflows = [{ id: "wf-demo-1", name: "默认流程", description: "虚构工作流", is_default: true, steps: statuses.map((s) => ({ status_key: s.key })), project_ids: ["proj-demo-01"], updated_at: iso(4 * 24 * 60 * MIN), created_at: iso(30 * 24 * 60 * MIN) }];
export const sessions = [{ id: "sess-demo-1", agent_id: "agent-demo-1", title: "示例对话", pinned: false, updated_at: iso(40 * MIN), created_at: iso(2 * 24 * 60 * MIN) }];
export const sessionMessages = [
  { id: "sm-1", role: "user", content: "示例问题：流程仓当前状态？", created_at: iso(42 * MIN) },
  { id: "sm-2", role: "assistant", content: "示例回答：一切正常，零差异。", created_at: iso(40 * MIN) },
];
export const tokens = [{ id: "tok-demo-1", name: "demo-token", token_prefix: "mul_demo", created_at: iso(12 * 24 * 60 * MIN), last_used_at: iso(2 * 60 * MIN), expires_at: null }];
export const relTime = (isoStr) => {
  const ms = now - Date.parse(isoStr);
  const m = Math.round(ms / MIN);
  if (m < 60) return `${m} 分钟前`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} 小时前`;
  return `${Math.round(h / 24)} 天前`;
};