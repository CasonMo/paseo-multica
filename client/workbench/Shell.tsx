import { Icon, Loading, Modal } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Btn, Card, Empty, ErrorNote, useUi } from "./bits";
import { useWorkbench } from "./context";
import { initials } from "./model";
import { RailNav, SectionSidebar } from "./Nav";
import { ApiExplorerPage } from "./pages/ApiExplorer";
import { AutomationPage, type Filter } from "./pages/Automation";
import { ChatPage } from "./pages/Chat";
import { InboxPage } from "./pages/Inbox";
import { IssueDetailPage } from "./pages/IssueDetail";
import { IssuesPage } from "./pages/Issues";
import { LabelsPage } from "./pages/Labels";
import { OverviewPage } from "./pages/Overview";
import { ProjectsPage } from "./pages/Projects";
import { SettingsPage } from "./pages/Settings";
import { TeamPage, type Tab } from "./pages/Team";
import { WorkflowsPage } from "./pages/Workflows";

export function Shell() {
  const ctx = useWorkbench();
  const { theme, compact, page, params, navigate, server, workspaces, workspaceId } = ctx;
  const ui = useUi(theme, compact);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const switchWorkspace = async (id: string) => {
    setPickerOpen(false);
    if (id === workspaceId) return;
    setBusy(true);
    await ctx.selectWorkspace(id);
    setBusy(false);
  };

  return (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: ui.c.surface0 }}>
      <RailNav onWorkspacePicker={() => setPickerOpen(true)} />
      <SectionSidebar />

      <View style={{ flex: 1, minWidth: 0 }}>
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
          <TeamPage key={params.tab ?? "agents"} initialTab={params.tab as Tab} />
        ) : page === "chat" ? (
          <ChatPage sessionId={params.sessionId} agentId={params.agentId} />
        ) : page === "autopilot" ? (
          <AutomationPage key={params.filter ?? "all"} initialFilter={params.filter as Filter} />
        ) : page === "api" ? (
          <ApiExplorerPage />
        ) : (
          <SettingsPage key={params.tab ?? "connection"} initialTab={params.tab as "connection" | "workspace" | "account"} />
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
            <View style={{ marginTop: 4 }}>
              <Btn
                ui={ui}
                label={busy ? "切换中…" : "管理服务器连接"}
                icon="Plug"
                onPress={() => {
                  setPickerOpen(false);
                  navigate("settings");
                }}
              />
            </View>
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