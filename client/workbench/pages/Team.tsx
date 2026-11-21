import { t } from "../i18n";
import { Icon } from "@getpaseo/plugin/client/ui";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Avatar, Btn, Card, Divider, Dot, Empty, ErrorNote, LoadingRow, LoadMore, nearBottom, Tag, useUi } from "../bits";
import { asList, asRecord, usePagedQuery, useQuery } from "../api";
import { useWorkbench } from "../context";
import {
  relTime,
  runtimeName,
  type Agent,
  type AgentRuntime,
  type Skill,
  type Squad,
} from "../model";
import { AgentRow } from "../parts";
import { AgentDetailModal } from "../AgentDetail";
import { RuntimeDetailModal } from "../RuntimeDetail";
import { SquadDetailModal } from "../SquadDetail";
import { CreateAgentModal, CreateSquadModal } from "../TeamCreate";

export type Tab = "agents" | "squads" | "runtimes" | "skills";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "agents", label: "AgentDetail.23", icon: "Bot" },
  { key: "squads", label: "Nav.36", icon: "UsersRound" },
  { key: "runtimes", label: "AgentDetail.16", icon: "Server" },
  { key: "skills", label: "AgentDetail.2", icon: "Blocks" },
];

export function TeamPage({ initialTab }: { initialTab?: Tab }) {
  const ctx = useWorkbench();
  const { theme, compact, api, bump, workspaceId, params, navigate, toast } = ctx;
  const ui = useUi(theme, compact);
  const key = `${workspaceId}:${bump}`;
  const [tab, setTab] = useState<Tab>(initialTab ?? "agents");
  const [search, setSearch] = useState("");
  const [agentId, setAgentId] = useState<string | null>(params.agent ?? null);
  const [squadId, setSquadId] = useState<string | null>(null);
  const [runtimeId, setRuntimeId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [creatingSquad, setCreatingSquad] = useState(false);

  const agentsQuery = usePagedQuery<Agent>(
    api,
    tab === "agents" || tab === "squads" ? "/api/agents" : null,
    { query: { include_archived: "true" }, pageSize: 30 },
    key,
    "agents",
  );
  const runtimesQuery = usePagedQuery<AgentRuntime>(
    api,
    tab === "runtimes" ? "/api/runtimes" : null,
    { pageSize: 30 },
    key,
    "runtimes",
    "devices",
  );
  const squadsQuery = usePagedQuery<Squad>(api, tab === "squads" ? "/api/squads" : null, { pageSize: 30 }, key, "squads");
  const skillsQuery = usePagedQuery<Skill>(api, tab === "skills" ? "/api/skills" : null, { pageSize: 30 }, key, "skills");
  // 跨 tab 的小 lookup：只在需要时拉、封顶 50，避免整表下载
  const squadLeaders = useQuery(
    api,
    tab === "squads" ? "/api/agents" : null,
    { query: { limit: 50 }, select: (data) => asList<Agent>(data, "agents") },
    key,
  );
  const agentRuntimes = useQuery(
    api,
    tab === "agents" ? "/api/runtimes" : null,
    { query: { limit: 50 }, select: (data) => asList<AgentRuntime>(data, "runtimes", "devices") },
    key,
  );

  const agents = agentsQuery.items;
  const runtimes = tab === "runtimes" ? runtimesQuery.items : (agentRuntimes.data ?? []);
  const squads = squadsQuery.items;
  const skills = skillsQuery.items;
  const activePaged = tab === "agents" ? agentsQuery : tab === "squads" ? squadsQuery : tab === "runtimes" ? runtimesQuery : skillsQuery;
  const needle = search.trim().toLowerCase();

  const visibleAgents = useMemo(
    () => (showArchived ? agents : agents.filter((agent) => !agent.archived_at)),
    [agents, showArchived],
  );
  const archivedCount = useMemo(() => agents.filter((agent) => agent.archived_at).length, [agents]);
  const filteredAgents = useMemo(
    () => visibleAgents.filter((agent) => !needle || `${agent.name} ${agent.description ?? ""}`.toLowerCase().includes(needle)),
    [visibleAgents, needle],
  );
  const filteredSquads = useMemo(
    () => squads.filter((squad) => !needle || `${squad.name} ${squad.description ?? ""}`.toLowerCase().includes(needle)),
    [squads, needle],
  );
  const filteredRuntimes = useMemo(
    () => runtimes.filter((runtime) => !needle || `${runtimeName(runtime)} ${runtime.provider ?? ""}`.toLowerCase().includes(needle)),
    [runtimes, needle],
  );
  const filteredSkills = useMemo(
    () => skills.filter((skill) => !needle || `${skill.name} ${skill.description ?? ""}`.toLowerCase().includes(needle)),
    [skills, needle],
  );

  const openChat = async (agent: Agent) => {
    const result = await api({ method: "POST", path: "/api/chat/sessions", body: { agent_id: agent.id } });
    if (result.ok) {
      const session = asRecord(result.data);
      const id = String(session.id ?? "");
      setAgentId(null);
      if (id) navigate("chat", { sessionId: id });
      else navigate("chat", { agentId: agent.id });
    } else {
      toast.error(result.error ?? t("Team.5"));
    }
  };

  const currentTab = TABS.find((entry) => entry.key === tab);

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: compact ? 12 : 18, gap: 12, paddingBottom: 48 }}
        onScroll={(e) => {
          if (nearBottom(e)) activePaged.loadMore();
        }}
        scrollEventThrottle={200}
      >
        <View style={[ui.s.row, { gap: 10 }]}>
          <View style={ui.s.grow}>
            <Text style={[ui.s.title, { fontSize: compact ? 18 : 21 }]}>{t("Nav.4")}</Text>
            <Text style={ui.s.muted}>{t("Team.7")}</Text>
          </View>
          {tab === "agents" ? (
            <Btn ui={ui} label={t("TeamCreate.3")} icon="Plus" tone="primary" onPress={() => setCreatingAgent(true)} />
          ) : tab === "squads" ? (
            <Btn ui={ui} label={t("TeamCreate.19")} icon="Plus" tone="primary" onPress={() => setCreatingSquad(true)} />
          ) : null}
        </View>

        <View style={[ui.s.row, { flexWrap: "wrap", gap: 6 }]}>
          {TABS.map((entry) => {
            const active = tab === entry.key;
            return (
              <Pressable
                accessibilityRole="button"
                key={entry.key}
                onPress={() => setTab(entry.key)}
                style={({ pressed }) => [ui.s.chip, active && ui.s.chipActive, pressed && ui.s.pressed]}
              >
                <Icon name={entry.icon} size={12} color={active ? ui.c.accentFg : ui.c.muted} />
                <Text style={[ui.s.chipText, active && ui.s.chipTextActive]}>{t(entry.label)}</Text>
              </Pressable>
            );
          })}
        </View>

        <View
          style={[
            ui.s.row,
            {
              gap: 7,
              paddingHorizontal: 11,
              borderRadius: 9,
              borderWidth: 1,
              borderColor: ui.c.border,
              backgroundColor: ui.c.surface1,
              minHeight: 38,
            },
          ]}
        >
          <Icon name="Search" size={15} color={ui.c.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("Team.10", { a: currentTab ? t(currentTab.label) : "" })}
            placeholderTextColor={ui.c.muted}
            style={{ flex: 1, color: ui.c.fg, fontSize: 13, paddingVertical: 8 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {tab === "agents" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={showArchived ? t("Team.11") : t("Team.12")}
            onPress={() => setShowArchived((value) => !value)}
            style={({ pressed }) => [ui.s.row, { gap: 6, alignSelf: "flex-start" }, pressed && ui.s.pressed]}
          >
            <Icon name={showArchived ? "EyeOff" : "Archive"} size={13} color={ui.c.muted} />
            <Text style={ui.s.tiny}>
              {showArchived ? t("Team.13") : archivedCount > 0 ? t("Team.14", { a: archivedCount }) : t("Team.15")}
            </Text>
          </Pressable>
        ) : null}

        {tab === "agents" ? (
          <Card ui={ui} padded={false}>
            {agentsQuery.loading && agents.length === 0 ? (
              <LoadingRow ui={ui} />
            ) : agentsQuery.error ? (
              <View style={{ padding: 14 }}>
                <ErrorNote ui={ui} message={agentsQuery.error} onRetry={agentsQuery.refresh} />
              </View>
            ) : filteredAgents.length === 0 ? (
              <Empty ui={ui} icon="Bot" title={t("Chat.27")} description={t("Team.17")} />
            ) : (
              <View style={{ paddingBottom: 6 }}>
                {filteredAgents.map((agent, index) => (
                  <View key={agent.id}>
                    {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 14 }} /> : null}
                    <AgentRow
                      ui={ui}
                      agent={agent}
                      runtimeLabel={runtimeLabel(agent, runtimes)}
                      onPress={() => setAgentId(agent.id)}
                    />
                  </View>
                ))}
              </View>
            )}
          </Card>
        ) : null}

        {tab === "squads" ? (
          <Card ui={ui} padded={false}>
            {squadsQuery.loading && squads.length === 0 ? (
              <LoadingRow ui={ui} />
            ) : filteredSquads.length === 0 ? (
              <Empty ui={ui} icon="UsersRound" title={t("Team.18")} description={t("Team.19")} />
            ) : (
              <View style={{ paddingBottom: 6 }}>
                {filteredSquads.map((squad, index) => {
                  const leader = (squadLeaders.data ?? []).find((agent) => agent.id === squad.leader_id);
                  return (
                    <View key={squad.id}>
                      {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 14 }} /> : null}
                      <Pressable
                        accessibilityRole="button"
                        onPress={() => setSquadId(squad.id)}
                        style={({ pressed }) => [ui.s.listRow, pressed && ui.s.pressed]}
                      >
                        <Avatar ui={ui} name={squad.name} url={squad.avatar_url} size={34} color={`${ui.c.accent}26`} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text numberOfLines={1} style={[ui.s.body, { fontWeight: "600" }]}>
                            {squad.name}
                          </Text>
                          <Text numberOfLines={1} style={ui.s.tiny}>
                            {t("SquadDetail.10")} {leader?.name ?? "—"} · {squad.member_count ?? squad.member_preview?.length ?? 0} {t("Team.21")}
                          </Text>
                        </View>
                        <Icon name="ChevronRight" size={15} color={ui.c.muted} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        ) : null}

        {tab === "runtimes" ? (
          <Card ui={ui} padded={false}>
            {runtimesQuery.loading && runtimes.length === 0 ? (
              <LoadingRow ui={ui} />
            ) : filteredRuntimes.length === 0 ? (
              <Empty ui={ui} icon="Server" title={t("Team.22")} description={t("Team.23")} />
            ) : (
              <View style={{ paddingBottom: 6 }}>
                {filteredRuntimes.map((runtime, index) => {
                  const online = runtime.status === "online";
                  return (
                    <View key={runtime.id}>
                      {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 14 }} /> : null}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("Team.24", { a: runtimeName(runtime) })}
                        onPress={() => setRuntimeId(runtime.id)}
                        style={({ pressed }) => [ui.s.listRow, { alignItems: "flex-start" }, pressed && ui.s.pressed]}
                      >
                        <View style={{ marginTop: 4 }}>
                          <Dot color={online ? ui.c.success : ui.c.muted} size={8} />
                        </View>
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text style={[ui.s.body, { fontWeight: "600" }]}>{runtimeName(runtime)}</Text>
                          <Text numberOfLines={1} style={ui.s.tiny}>
                            {runtime.provider ?? "provider"} · {runtime.device_info || t("RuntimeDetail.2")}
                          </Text>
                          <Text style={ui.s.tiny}>
                            {online ? t("RuntimeDetail.3") : t("RuntimeDetail.8", { a: relTime(runtime.last_seen_at) })}
                          </Text>
                        </View>
                        <Tag ui={ui} label={runtime.visibility === "private" ? t("RuntimeDetail.5") : t("Nav.47")} tone="muted" />
                        <Icon name="ChevronRight" size={15} color={ui.c.muted} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </Card>
        ) : null}

        {tab === "skills" ? (
          <Card ui={ui} padded={false}>
            {skillsQuery.loading && skills.length === 0 ? (
              <LoadingRow ui={ui} />
            ) : skillsQuery.error ? (
              <View style={{ padding: 14 }}>
                <ErrorNote ui={ui} message={skillsQuery.error} onRetry={skillsQuery.refresh} />
              </View>
            ) : filteredSkills.length === 0 ? (
              <Empty ui={ui} icon="Blocks" title={t("Team.30")} description={t("Team.31")} />
            ) : (
              <View style={{ paddingBottom: 6 }}>
                {filteredSkills.map((skill, index) => (
                  <View key={skill.id}>
                    {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 14 }} /> : null}
                    <View style={[ui.s.listRow, { alignItems: "flex-start" }]}>
                      <View
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          alignItems: "center",
                          justifyContent: "center",
                          backgroundColor: ui.c.surface2,
                        }}
                      >
                        <Icon name="Blocks" size={14} color={ui.c.accent} />
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text style={[ui.s.body, { fontWeight: "600" }]}>{skill.name}</Text>
                        <Text numberOfLines={2} style={ui.s.tiny}>
                          {skill.description || skill.slug || "—"}
                        </Text>
                      </View>
                      {skill.source ? <Tag ui={ui} label={skill.source} tone="muted" /> : null}
                    </View>
                  </View>
                ))}
              </View>
            )}
          </Card>
        ) : null}
        <LoadMore
          ui={ui}
          loaded={activePaged.items.length}
          total={activePaged.total}
          hasMore={activePaged.hasMore}
          loadingMore={activePaged.loadingMore}
          loading={activePaged.loading}
          onLoadMore={activePaged.loadMore}
        />
      </ScrollView>

      <AgentDetailModal
        agentId={agentId}
        onClose={() => setAgentId(null)}
        onChat={(agent) => void openChat(agent)}
        runtimeList={runtimes}
        runtimesLoading={runtimesQuery.loading}
      />
      <SquadDetailModal
        squadId={squadId}
        agents={agents}
        onClose={() => setSquadId(null)}
        onChanged={() => {
          squadsQuery.refresh();
          agentsQuery.refresh();
        }}
      />
      <CreateAgentModal
        open={creatingAgent}
        runtimes={runtimes}
        onClose={() => setCreatingAgent(false)}
        onDone={() => {
          agentsQuery.refresh();
          toast.show(t("Team.32"), { variant: "success" });
        }}
      />
      <CreateSquadModal
        open={creatingSquad}
        agents={agents}
        onClose={() => setCreatingSquad(false)}
        onDone={() => {
          squadsQuery.refresh();
          toast.show(t("Team.33"), { variant: "success" });
        }}
      />
      <RuntimeDetailModal
        runtime={runtimes.find((item) => item.id === runtimeId) ?? null}
        agents={agents}
        onClose={() => setRuntimeId(null)}
      />
    </View>
  );
}

function runtimeLabel(agent: Agent, runtimes: AgentRuntime[]): string {
  if (!agent.runtime_id) return t("AgentDetail.14");
  const runtime = runtimes.find((item) => item.id === agent.runtime_id);
  if (!runtime) return agent.runtime_availability === "offline" ? t("AgentDetail.15") : t("AgentDetail.16");
  return t("AgentDetail.17", { a: runtimeName(runtime), b: runtime.status === "online" ? "" : t("AgentDetail.18") });
}
