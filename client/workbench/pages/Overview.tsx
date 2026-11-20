import { Icon } from "@getpaseo/plugin/client/ui";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Btn, Card, Divider, Empty, ErrorNote, LoadingRow, LoadMore, nearBottom, SectionHeader, Stat, Tag, useUi } from "../bits";
import { asList, asRecord, num, usePagedQuery, useQuery } from "../api";
import { useWorkbench } from "../context";
import { relTime, type Agent, type AgentRuntime, type InboxItem, type Issue, type Project } from "../model";
import { AgentRow, InboxRow, IssueRow } from "../parts";
import { UsageCard } from "../UsageCard";

export function OverviewPage() {
  const ctx = useWorkbench();
  const { theme, compact, api, statuses, bump, user, workspaceId, navigate, invalidate, toast } = ctx;
  const ui = useUi(theme, compact);
  const key = `${workspaceId}:${bump}`;

  const recent = usePagedQuery<Issue>(
    api,
    "/api/issues",
    { query: { sort: "updated_at", direction: "desc" }, pageSize: 12 },
    key,
    "issues",
  );
  const started = useQuery(api, "/api/issues", { query: { limit: 1, status_category: "started" } }, key);
  const unread = useQuery(api, "/api/inbox/unread-count", {}, key);
  const agents = usePagedQuery<Agent>(api, "/api/agents", { pageSize: 8 }, key, "agents");
  const runtimes = useQuery(api, "/api/runtimes", { query: { limit: 50 } }, key);
  const inbox = useQuery(api, "/api/inbox", { query: { limit: 20 } }, key);
  const projects = useQuery(api, "/api/projects", { query: { limit: 5 } }, key);

  const recentList = recent.items;
  const totalIssues = recent.total;
  const startedTotal = num(asRecord(started.data).total, 0);
  const unreadCount =
    typeof unread.data === "number" ? unread.data : num(asRecord(unread.data).count ?? asRecord(unread.data).unread, 0);
  const agentList = agents.items;
  const runtimeList = asList<AgentRuntime>(runtimes.data, "runtimes", "devices");
  const inboxList = asList<InboxItem>(inbox.data, "items", "inbox");
  const inboxTotal = num(asRecord(inbox.data).total, inboxList.length);
  const projectList = asList<Project>(projects.data, "projects");
  const onlineRuntimes = runtimeList.filter((runtime) => runtime.status === "online");
  const agentsTotal = agents.total;

  const markRead = async (item: InboxItem) => {
    const result = await api({ method: "POST", path: `/api/inbox/${item.id}/read` });
    if (result.ok) {
      toast.show("已标记为已读", { variant: "success" });
      inbox.refresh();
      unread.refresh();
    } else toast.error(result.error ?? "操作失败");
  };

  const archive = async (item: InboxItem) => {
    const result = await api({ method: "POST", path: `/api/inbox/${item.id}/archive` });
    if (result.ok) {
      toast.show("已归档", { variant: "success" });
      inbox.refresh();
      unread.refresh();
    } else toast.error(result.error ?? "操作失败");
  };

  const openItem = (item: InboxItem) => {
    if (item.issue_id) navigate("issue", { id: item.issue_id });
  };

  const heroActions = (
    <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
      <Btn ui={ui} label="新建需求" icon="Plus" tone="primary" onPress={() => navigate("issues", { create: "1" })} />
      <Btn ui={ui} label="团队" icon="Users" onPress={() => navigate("team")} />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: compact ? 12 : 18, gap: 14, paddingBottom: 40 }}>
      <Card
        ui={ui}
        padded={false}
        style={{ overflow: "hidden" }}
      >
        <View style={{ padding: compact ? 16 : 20, gap: 12 }}>
          <View style={[ui.s.row, { gap: 12, alignItems: "flex-start" }]}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: `${ui.c.accent}1f`,
              }}
            >
              <Icon name="Sparkles" size={22} color={ui.c.accent} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: ui.c.fg, fontSize: compact ? 17 : 19, fontWeight: "700" }}>
                {greeting()}，{user?.name ?? "朋友"}
              </Text>
              <Text style={ui.s.muted}>
                这里汇总了工作区的需求流转、收件箱与智能体状态。上次同步 {relTime(new Date().toISOString())}。
              </Text>
            </View>
          </View>
          {heroActions}
        </View>
        <View
          style={{
            flexDirection: "row",
            borderTopWidth: 1,
            borderTopColor: ui.c.border,
            backgroundColor: ui.c.surface2,
          }}
        >
          <HeroMetric ui={ui} label="需求总数" value={totalIssues} loading={recent.loading} icon="ListTodo" />
          <HeroMetric ui={ui} label="进行中" value={startedTotal} loading={started.loading} icon="Loader" />
          <HeroMetric ui={ui} label="未读通知" value={unreadCount} loading={unread.loading} icon="Bell" />
          <HeroMetric
            ui={ui}
            label="在线运行时"
            value={`${onlineRuntimes.length}/${runtimeList.length || 0}`}
            loading={runtimes.loading}
            icon="Server"
          />
        </View>
      </Card>

      <UsageCard />

      <View style={{ flexDirection: compact ? "column" : "row", gap: 14, alignItems: "stretch", height: compact ? undefined : 700 }}>
        <View style={{ flex: compact ? undefined : 1.5, gap: 14, width: compact ? "100%" : undefined, height: compact ? undefined : 700 }}>
          <Card ui={ui} padded={false} style={{ flex: 1, overflow: "hidden" }}>
            <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
              <SectionHeader
                ui={ui}
                title="最近更新的需求"
                trailing={<LinkBtn ui={ui} label="全部" onPress={() => navigate("issues")} />}
              />
            </View>
            {recent.loading && recentList.length === 0 ? (
              <LoadingRow ui={ui} />
            ) : recent.error ? (
              <View style={{ padding: 12 }}>
                <ErrorNote ui={ui} message={recent.error} onRetry={recent.refresh} />
              </View>
            ) : recentList.length === 0 ? (
              <Empty ui={ui} icon="Inbox" title="还没有需求" description="创建第一条需求，让智能体开始协作。" action={<Btn ui={ui} label="新建需求" tone="primary" icon="Plus" onPress={() => navigate("issues", { create: "1" })} />} />
            ) : (
              <View style={{ flex: compact ? 0 : 1 }}>
                <ScrollView
                  style={{ flex: compact ? 0 : 1, height: compact ? 300 : undefined, minHeight: compact ? undefined : 240 }}
                  contentContainerStyle={{ paddingBottom: 6 }}
                  onScroll={(e) => {
                    if (nearBottom(e)) recent.loadMore();
                  }}
                  scrollEventThrottle={200}
                >
                  {recentList.map((issue, index) => (
                    <View key={issue.id}>
                      {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 14 }} /> : null}
                      <IssueRow ui={ui} issue={issue} statuses={statuses} onPress={() => navigate("issue", { id: issue.id })} />
                    </View>
                  ))}
                </ScrollView>
                <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.c.line }}>
                  <LoadMore
                    ui={ui}
                    loaded={recentList.length}
                    total={totalIssues}
                    hasMore={recent.hasMore}
                    loadingMore={recent.loadingMore}
                    loading={recent.loading}
                    onLoadMore={recent.loadMore}
                  />
                </View>
              </View>
            )}
          </Card>

          <Card ui={ui} padded={false} style={{ flexShrink: 0 }}>
            <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
              <SectionHeader
                ui={ui}
                title="项目进展"
                trailing={<LinkBtn ui={ui} label="全部" onPress={() => navigate("projects")} />}
              />
            </View>
            {projectList.length === 0 ? (
              <Empty ui={ui} icon="FolderKanban" title="暂无项目" />
            ) : (
              <View style={{ paddingHorizontal: 14, paddingBottom: 14, gap: 12 }}>
                {projectList.slice(0, 5).map((project) => (
                  <ProjectBar key={project.id} ui={ui} project={project} />
                ))}
              </View>
            )}
          </Card>
        </View>

        <View style={{ flex: compact ? undefined : 1, gap: 14, width: compact ? "100%" : undefined, height: compact ? undefined : 700 }}>
          <Card ui={ui} padded={false} style={{ overflow: "hidden", flexShrink: 0 }}>
            <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
              <SectionHeader
                ui={ui}
                title="收件箱"
                trailing={
                  <View style={[ui.s.row, { gap: 6 }]}>
                    {unreadCount > 0 ? <Tag ui={ui} label={`${unreadCount} 未读`} tone="accent" /> : null}
                    <Btn ui={ui} label="全部已读" onPress={() => void markAll()} />
                  </View>
                }
              />
            </View>
            {inbox.loading && inboxList.length === 0 ? (
              <LoadingRow ui={ui} />
            ) : inboxList.length === 0 ? (
              <Empty ui={ui} icon="BellOff" title="收件箱已清空" />
            ) : (
              <View>
                <ScrollView
                  style={{ height: compact ? 280 : 360 }}
                  contentContainerStyle={{ paddingBottom: 6 }}
                >
                  {inboxList.map((item, index) => (
                    <View key={item.id}>
                      {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 14 }} /> : null}
                      <InboxRow
                        ui={ui}
                        item={item}
                        onPress={() => openItem(item)}
                        onRead={item.read ? undefined : () => void markRead(item)}
                        onArchive={() => void archive(item)}
                      />
                    </View>
                  ))}
                </ScrollView>
                <View
                  style={[
                    ui.s.row,
                    {
                      justifyContent: "space-between",
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderTopWidth: StyleSheet.hairlineWidth,
                      borderTopColor: ui.c.line,
                    },
                  ]}
                >
                  <Text style={ui.s.tiny}>共 {inboxTotal} 条</Text>
                  <LinkBtn ui={ui} label="查看全部" onPress={() => navigate("inbox")} />
                </View>
              </View>
            )}
          </Card>

          <Card ui={ui} padded={false} style={{ flex: 1, overflow: "hidden" }}>
            <View style={{ paddingHorizontal: 14, paddingTop: 14 }}>
              <SectionHeader
                ui={ui}
                title="智能体"
                trailing={<LinkBtn ui={ui} label="管理" onPress={() => navigate("team")} />}
              />
            </View>
            {agents.loading && agentList.length === 0 ? (
              <LoadingRow ui={ui} />
            ) : agentList.length === 0 ? (
              <Empty ui={ui} icon="Bot" title="还没有智能体" description="在 Multica 后台创建智能体后会显示在这里。" />
            ) : (
              <View style={{ flex: compact ? 0 : 1 }}>
                <ScrollView
                  style={{ flex: compact ? 0 : 1, height: compact ? 260 : undefined, minHeight: compact ? undefined : 140 }}
                  contentContainerStyle={{ paddingBottom: 6 }}
                  onScroll={(e) => {
                    if (nearBottom(e)) agents.loadMore();
                  }}
                  scrollEventThrottle={200}
                >
                  {agentList.map((agent, index) => (
                    <View key={agent.id}>
                      {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 14 }} /> : null}
                      <AgentRow
                        ui={ui}
                        agent={agent}
                        runtimeLabel={runtimeLabelFor(agent, runtimeList)}
                        onPress={() => navigate("team", { agent: agent.id })}
                      />
                    </View>
                  ))}
                </ScrollView>
                <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.c.line }}>
                  <LoadMore
                    ui={ui}
                    loaded={agentList.length}
                    total={agentsTotal}
                    hasMore={agents.hasMore}
                    loadingMore={agents.loadingMore}
                    loading={agents.loading}
                    onLoadMore={agents.loadMore}
                  />
                </View>
              </View>
            )}
          </Card>
        </View>
      </View>
    </ScrollView>
  );

  async function markAll() {
    const result = await api({ method: "POST", path: "/api/inbox/mark-all-read" });
    if (result.ok) {
      toast.show("收件箱已全部标记为已读", { variant: "success" });
      inbox.refresh();
      unread.refresh();
      invalidate();
    } else toast.error(result.error ?? "操作失败");
  }
}

function HeroMetric({
  ui,
  label,
  value,
  loading,
  icon,
}: {
  ui: ReturnType<typeof useUi>;
  label: string;
  value: number | string;
  loading?: boolean;
  icon: string;
}) {
  return (
    <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12, gap: 4 }}>
      <View style={[ui.s.row, { gap: 5 }]}>
        <Icon name={icon} size={11} color={ui.c.muted} />
        <Text style={ui.s.tiny}>{label}</Text>
      </View>
      <Text style={{ color: ui.c.fg, fontSize: 20, fontWeight: "700" }}>{loading ? "…" : value}</Text>
    </View>
  );
}

function LinkBtn({ ui, label, onPress }: { ui: ReturnType<typeof useUi>; label: string; onPress(): void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [ui.s.row, { gap: 3 }, pressed && ui.s.pressed]}
    >
      <Text style={[ui.s.tiny, { color: ui.c.accent, fontWeight: "600" }]}>{label}</Text>
      <Icon name="ChevronRight" size={12} color={ui.c.accent} />
    </Pressable>
  );
}

function ProjectBar({ ui, project }: { ui: ReturnType<typeof useUi>; project: Project }) {
  const total = project.issue_count ?? 0;
  const done = project.done_count ?? 0;
  const ratio = total > 0 ? Math.min(1, done / total) : 0;
  return (
    <View style={{ gap: 5 }}>
      <View style={[ui.s.row, { justifyContent: "space-between" }]}>
        <Text numberOfLines={1} style={[ui.s.body, { fontWeight: "600", flex: 1 }]}>
          {project.title}
        </Text>
        <Text style={ui.s.tiny}>
          {done}/{total}
        </Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: ui.c.surface2, overflow: "hidden" }}>
        <View
          style={{
            width: `${Math.round(ratio * 100)}%`,
            height: "100%",
            borderRadius: 3,
            backgroundColor: ratio >= 1 ? ui.c.success : ui.c.accent,
          }}
        />
      </View>
      {project.due_date ? <Text style={ui.s.tiny}>截止 {project.due_date}</Text> : null}
    </View>
  );
}

export function runtimeLabelFor(agent: Agent, runtimes: AgentRuntime[]): string | undefined {
  if (!agent.runtime_id) return undefined;
  const runtime = runtimes.find((item) => item.id === agent.runtime_id);
  if (!runtime) return agent.runtime_bound ? "运行时" : "未绑定";
  return runtime.custom_name?.trim() || runtime.name;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return "夜深了";
  if (hour < 11) return "早上好";
  if (hour < 14) return "中午好";
  if (hour < 18) return "下午好";
  return "晚上好";
}
