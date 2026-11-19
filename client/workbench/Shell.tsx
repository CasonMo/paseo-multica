import { Icon, Loading, Modal } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Btn, Card, Dot, Empty, ErrorNote, IconBtn, useUi } from "./bits";
import { useWorkbench, type PageKey } from "./context";
import { initials } from "./model";
import { ApiExplorerPage } from "./pages/ApiExplorer";
import { AutomationPage } from "./pages/Automation";
import { ChatPage } from "./pages/Chat";
import { InboxPage } from "./pages/Inbox";
import { IssueDetailPage } from "./pages/IssueDetail";
import { IssuesPage } from "./pages/Issues";
import { LabelsPage } from "./pages/Labels";
import { OverviewPage } from "./pages/Overview";
import { ProjectsPage } from "./pages/Projects";
import { SettingsPage } from "./pages/Settings";
import { TeamPage } from "./pages/Team";
import { WorkflowsPage } from "./pages/Workflows";

const NAV: { key: PageKey; label: string; icon: string }[] = [
  { key: "overview", label: "概览", icon: "LayoutDashboard" },
  { key: "issues", label: "需求", icon: "ListTodo" },
  { key: "projects", label: "项目", icon: "FolderKanban" },
  { key: "inbox", label: "收件箱", icon: "Bell" },
  { key: "team", label: "团队", icon: "Users" },
  { key: "chat", label: "聊天", icon: "MessagesSquare" },
  { key: "autopilot", label: "自动化", icon: "Bot" },
  { key: "workflows", label: "工作流", icon: "Workflow" },
  { key: "labels", label: "标签", icon: "Tags" },
  { key: "api", label: "接口", icon: "Plug" },
  { key: "settings", label: "设置", icon: "Settings2" },
];

export function Shell() {
  const ctx = useWorkbench();
  const { theme, compact, page, params, navigate, server, user, workspaces, workspaceId } = ctx;
  const ui = useUi(theme, compact);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeNav = page === "issue" ? "issues" : page;
  const workspaceName = workspaces.find((item) => item.id === workspaceId)?.name ?? server?.workspaceSlug ?? "未选择工作区";

  const switchWorkspace = async (id: string) => {
    setPickerOpen(false);
    if (id === workspaceId) return;
    setBusy(true);
    await ctx.selectWorkspace(id);
    setBusy(false);
  };

  const refreshAll = async () => {
    setBusy(true);
    await ctx.reloadBootstrap();
    ctx.invalidate();
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, backgroundColor: ui.c.surface0 }}>
      <View
        style={{
          paddingHorizontal: compact ? 12 : 18,
          paddingTop: compact ? 12 : 16,
          paddingBottom: 10,
          borderBottomWidth: 1,
          borderBottomColor: ui.c.border,
          backgroundColor: ui.c.surface1,
        }}
      >
        <View style={[ui.s.row, { gap: 10 }]}>
          <View
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: ui.c.accent,
            }}
          >
            <Icon name="Boxes" size={18} color={ui.c.accentFg} />
          </View>
          <View style={ui.s.grow}>
            <Text numberOfLines={1} style={{ color: ui.c.fg, fontSize: compact ? 15 : 16, fontWeight: "700" }}>
              Multica 工作台
            </Text>
            <View style={[ui.s.row, { gap: 5 }]}>
              {server ? <Dot color={ui.c.success} size={6} /> : <Dot color={ui.c.danger} size={6} />}
              <Text numberOfLines={1} style={ui.s.tiny}>
                {server ? server.name : "未连接"} · {workspaceName}
              </Text>
            </View>
          </View>

          {server ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`切换工作区，当前 ${workspaceName}`}
              onPress={() => setPickerOpen(true)}
              style={({ pressed }) => [ui.s.chip, pressed && ui.s.pressed, { maxWidth: compact ? 128 : 240 }]}
            >
              <Icon name="Layers" size={13} color={ui.c.muted} />
              <Text numberOfLines={1} style={[ui.s.chipText, { flexShrink: 1 }]}>
                {workspaceName}
              </Text>
              <Icon name="ChevronDown" size={13} color={ui.c.muted} />
            </Pressable>
          ) : null}
          {server ? <IconBtn ui={ui} icon="RefreshCw" label="刷新" busy={busy} onPress={refreshAll} /> : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="打开设置"
            onPress={() => navigate("settings")}
            style={({ pressed }) => [
              {
                width: 30,
                height: 30,
                borderRadius: 15,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: ui.c.surface2,
              },
              pressed && ui.s.pressed,
            ]}
          >
            <Text style={{ color: ui.c.fg, fontSize: 11.5, fontWeight: "700" }}>{initials(user?.name ?? "M")}</Text>
          </Pressable>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6, paddingTop: 12 }}
        >
          {NAV.map((item) => {
            const active = activeNav === item.key;
            return (
              <Pressable
                accessibilityRole="button"
                key={item.key}
                accessibilityLabel={item.label}
                accessibilityState={{ selected: active }}
                onPress={() => navigate(item.key)}
                style={({ pressed }) => [
                  {
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    paddingHorizontal: 11,
                    paddingVertical: 7,
                    borderRadius: 999,
                    backgroundColor: active ? ui.c.accent : ui.c.surface2,
                  },
                  pressed && ui.s.pressed,
                ]}
              >
                <Icon name={item.icon} size={14} color={active ? ui.c.accentFg : ui.c.muted} />
                <Text
                  style={{
                    color: active ? ui.c.accentFg : ui.c.fg,
                    fontSize: 12.5,
                    fontWeight: active ? "700" : "500",
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <View style={{ flex: 1 }}>
        {!server ? (
          <NoConnection loading={ctx.loading} error={ctx.bootstrapError} onSetup={() => navigate("settings")} />
        ) : page === "overview" ? (
          <OverviewPage />
        ) : page === "issues" ? (
          <IssuesPage />
        ) : page === "issue" ? (
          <IssueDetailPage issueId={params.id ?? ""} />
        ) : page === "projects" ? (
          <ProjectsPage />
        ) : page === "inbox" ? (
          <InboxPage />
        ) : page === "labels" ? (
          <LabelsPage />
        ) : page === "workflows" ? (
          <WorkflowsPage />
        ) : page === "team" ? (
          <TeamPage />
        ) : page === "chat" ? (
          <ChatPage sessionId={params.sessionId} agentId={params.agentId} />
        ) : page === "autopilot" ? (
          <AutomationPage />
        ) : page === "api" ? (
          <ApiExplorerPage />
        ) : (
          <SettingsPage />
        )}
      </View>

      <Modal
        title="切换工作区"
        icon={<Icon name="Layers" size={16} color={ui.c.muted} />}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      >
        <Modal.Content>
          <View style={{ gap: 8 }}>
            {workspaces.length === 0 ? (
              <Empty ui={ui} icon="Layers" title="没有可用工作区" description="当前 API Key 在此服务器上还没有工作区。" />
            ) : (
              workspaces.map((workspace) => {
                const active = workspace.id === workspaceId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={workspace.id}
                    accessibilityLabel={`切换到 ${workspace.name}`}
                    accessibilityState={{ selected: active }}
                    onPress={() => void switchWorkspace(workspace.id)}
                    style={({ pressed }) => [
                      {
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                        padding: 12,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: active ? ui.c.accent : ui.c.border,
                        backgroundColor: active ? ui.c.surface2 : ui.c.surface0,
                      },
                      pressed && ui.s.pressed,
                    ]}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: ui.c.surface2,
                      }}
                    >
                      <Text style={{ color: ui.c.fg, fontWeight: "700", fontSize: 12 }}>
                        {initials(workspace.name)}
                      </Text>
                    </View>
                    <View style={{ flex: 1, gap: 2 }}>
                      <Text style={[ui.s.body, { fontWeight: "600" }]}>{workspace.name}</Text>
                      <Text style={ui.s.tiny}>
                        {workspace.slug}
                        {workspace.issue_prefix ? ` · ${workspace.issue_prefix}` : ""}
                      </Text>
                    </View>
                    {active ? <Icon name="Check" size={16} color={ui.c.accent} /> : null}
                  </Pressable>
                );
              })
            )}
          </View>
        </Modal.Content>
      </Modal>
    </View>
  );
}

function NoConnection({
  loading,
  error,
  onSetup,
}: {
  loading: boolean;
  error: string | null;
  onSetup: () => void;
}) {
  const { theme, compact } = useWorkbench();
  const ui = useUi(theme, compact);
  if (loading) return <Loading />;
  return (
    <ScrollView contentContainerStyle={{ padding: compact ? 16 : 28 }}>
      <Card ui={ui} style={{ padding: compact ? 18 : 26, gap: 12, alignItems: "flex-start" }}>
        <View
          style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: ui.c.surface2,
          }}
        >
          <Icon name="PlugZap" size={22} color={ui.c.accent} />
        </View>
        <Text style={{ color: ui.c.fg, fontSize: 18, fontWeight: "700" }}>连接你的 Multica</Text>
        <Text style={ui.s.muted}>
          支持官方云与自建服务器。填入 API Key 后即可浏览需求、智能体、聊天、自动化，并直接调试全部
          Multica 接口。
        </Text>
        {error ? <ErrorNote ui={ui} message={error} /> : null}
        <Btn ui={ui} label="配置连接" icon="ArrowRight" tone="primary" onPress={onSetup} />
      </Card>
    </ScrollView>
  );
}
