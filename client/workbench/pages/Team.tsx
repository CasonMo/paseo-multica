import { Icon, Markdown, Modal } from "@getpaseo/plugin/client/ui";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Avatar, Btn, Card, Divider, Dot, Empty, ErrorNote, LoadingRow, SectionHeader, Tag, useUi } from "../bits";
import { asList, asRecord, useQuery } from "../api";
import { useWorkbench } from "../context";
import {
  agentStatusMeta,
  fmtDateTime,
  relTime,
  runtimeName,
  type Agent,
  type AgentRuntime,
  type Skill,
  type Squad,
} from "../model";
import { AgentRow } from "../parts";

type Tab = "agents" | "squads" | "runtimes" | "skills";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "agents", label: "智能体", icon: "Bot" },
  { key: "squads", label: "小队", icon: "UsersRound" },
  { key: "runtimes", label: "运行时", icon: "Server" },
  { key: "skills", label: "技能", icon: "Blocks" },
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

  const agentsQuery = useQuery(api, "/api/agents", { query: { limit: 100 }, select: (data) => asList<Agent>(data, "agents") }, key);
  const runtimesQuery = useQuery(api, "/api/runtimes", { select: (data) => asList<AgentRuntime>(data, "runtimes") }, key);
  const squadsQuery = useQuery(api, "/api/squads", { select: (data) => asList<Squad>(data, "squads") }, key);
  const skillsQuery = useQuery(api, "/api/skills", { select: (data) => asList<Skill>(data, "skills") }, key);

  const agents = agentsQuery.data ?? [];
  const runtimes = runtimesQuery.data ?? [];
  const squads = squadsQuery.data ?? [];
  const skills = skillsQuery.data ?? [];
  const needle = search.trim().toLowerCase();

  const filteredAgents = useMemo(
    () => agents.filter((agent) => !needle || `${agent.name} ${agent.description ?? ""}`.toLowerCase().includes(needle)),
    [agents, needle],
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
      toast.error(result.error ?? "创建会话失败");
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: compact ? 12 : 18, gap: 12, paddingBottom: 48 }}>
        <View style={[ui.s.row, { gap: 10 }]}>
          <View style={ui.s.grow}>
            <Text style={[ui.s.title, { fontSize: compact ? 18 : 21 }]}>团队</Text>
            <Text style={ui.s.muted}>智能体、小队、运行时与技能</Text>
          </View>
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
                <Text style={[ui.s.chipText, active && ui.s.chipTextActive]}>{entry.label}</Text>
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
            placeholder={`搜索${TABS.find((entry) => entry.key === tab)?.label ?? ""}…`}
            placeholderTextColor={ui.c.muted}
            style={{ flex: 1, color: ui.c.fg, fontSize: 13, paddingVertical: 8 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        {tab === "agents" ? (
          <Card ui={ui} padded={false}>
            {agentsQuery.loading && agents.length === 0 ? (
              <LoadingRow ui={ui} />
            ) : agentsQuery.error ? (
              <View style={{ padding: 14 }}>
                <ErrorNote ui={ui} message={agentsQuery.error} onRetry={agentsQuery.refresh} />
              </View>
            ) : filteredAgents.length === 0 ? (
              <Empty ui={ui} icon="Bot" title="没有智能体" description="在 Multica 后台创建智能体，或调整搜索条件。" />
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
              <Empty ui={ui} icon="UsersRound" title="没有小队" description="小队让多个智能体围绕同一问题协作。" />
            ) : (
              <View style={{ paddingBottom: 6 }}>
                {filteredSquads.map((squad, index) => {
                  const leader = agents.find((agent) => agent.id === squad.leader_id);
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
                            队长 {leader?.name ?? "—"} · {squad.member_count ?? squad.member_preview?.length ?? 0} 位成员
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
              <Empty ui={ui} icon="Server" title="没有运行时" description="在 Multica 中连接一台运行时设备后即可调度智能体。" />
            ) : (
              <View style={{ paddingBottom: 6 }}>
                {filteredRuntimes.map((runtime, index) => {
                  const online = runtime.status === "online";
                  return (
                    <View key={runtime.id}>
                      {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 14 }} /> : null}
                      <View style={[ui.s.listRow, { alignItems: "flex-start" }]}>
                        <View style={{ marginTop: 4 }}>
                          <Dot color={online ? ui.c.success : ui.c.muted} size={8} />
                        </View>
                        <View style={{ flex: 1, gap: 3 }}>
                          <Text style={[ui.s.body, { fontWeight: "600" }]}>{runtimeName(runtime)}</Text>
                          <Text numberOfLines={1} style={ui.s.tiny}>
                            {runtime.provider ?? "provider"} · {runtime.device_info || "未知设备"}
                          </Text>
                          <Text style={ui.s.tiny}>
                            {online ? "在线" : `最后在线 ${relTime(runtime.last_seen_at)}`}
                          </Text>
                        </View>
                        <Tag ui={ui} label={runtime.visibility === "private" ? "私有" : "工作区"} tone="muted" />
                      </View>
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
              <Empty ui={ui} icon="Blocks" title="没有技能" description="技能为智能体提供可复用的工具与知识。" />
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
      </ScrollView>

      <AgentDetailModal
        agentId={agentId}
        onClose={() => setAgentId(null)}
        onChat={(agent) => void openChat(agent)}
        runtimeList={runtimes}
        runtimesLoading={runtimesQuery.loading}
      />
      <SquadDetailModal squadId={squadId} onClose={() => setSquadId(null)} />
    </View>
  );
}

function runtimeLabel(agent: Agent, runtimes: AgentRuntime[]): string {
  if (!agent.runtime_id) return "未绑定运行时";
  const runtime = runtimes.find((item) => item.id === agent.runtime_id);
  if (!runtime) return agent.runtime_availability === "offline" ? "运行时离线" : "运行时";
  return `${runtimeName(runtime)}${runtime.status === "online" ? "" : "（离线）"}`;
}

function AgentDetailModal({
  agentId,
  onClose,
  onChat,
  runtimeList,
}: {
  agentId: string | null;
  onClose(): void;
  onChat(agent: Agent): void;
  runtimeList: AgentRuntime[];
  runtimesLoading: boolean;
}) {
  const ctx = useWorkbench();
  const { theme, compact, api, toast, invalidate } = ctx;
  const ui = useUi(theme, compact);
  const detail = useQuery<Agent | null>(
    api,
    agentId ? `/api/agents/${agentId}` : null,
    { select: (data) => (data && typeof data === "object" ? (data as Agent) : null) },
    agentId ?? "",
  );
  const agent = detail.data;
  const [busy, setBusy] = useState(false);

  const archive = async () => {
    if (!agent) return;
    setBusy(true);
    const result = await api({ method: "POST", path: `/api/agents/${agent.id}/archive` });
    setBusy(false);
    if (result.ok) {
      toast.show("智能体已归档", { variant: "success" });
      invalidate();
      onClose();
    } else toast.error(result.error ?? "归档失败");
  };

  const restore = async () => {
    if (!agent) return;
    setBusy(true);
    const result = await api({ method: "POST", path: `/api/agents/${agent.id}/restore` });
    setBusy(false);
    if (result.ok) {
      toast.show("智能体已恢复", { variant: "success" });
      invalidate();
      detail.refresh();
    } else toast.error(result.error ?? "恢复失败");
  };

  return (
    <Modal
      title={agent?.name ?? "智能体"}
      icon={<Icon name="Bot" size={16} color={ui.c.muted} />}
      open={Boolean(agentId)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Content>
        {detail.loading && !agent ? (
          <LoadingRow ui={ui} />
        ) : detail.error ? (
          <ErrorNote ui={ui} message={detail.error} onRetry={detail.refresh} />
        ) : agent ? (
          <View style={{ gap: 12 }}>
            <View style={[ui.s.row, { gap: 10 }]}>
              <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={42} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ color: ui.c.fg, fontSize: 17, fontWeight: "700" }}>{agent.name}</Text>
                <Text style={ui.s.tiny}>
                  {agent.model || "未设置模型"} · 最大并发 {agent.max_concurrent_tasks ?? "—"}
                </Text>
              </View>
              <Tag ui={ui} label={agentStatusMeta(agent.status).label} tone={agentStatusMeta(agent.status).tone} />
            </View>

            {agent.description ? <Text style={ui.s.body}>{agent.description}</Text> : null}

            <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
              <Tag ui={ui} label={runtimeLabel(agent, runtimeList)} tone="muted" icon="Server" />
              <Tag ui={ui} label={agent.permission_mode === "private" ? "私有调用" : "公开调用"} tone="muted" icon="Shield" />
              {agent.archived_at ? <Tag ui={ui} label="已归档" tone="danger" /> : null}
            </View>

            {agent.skills && agent.skills.length > 0 ? (
              <View style={{ gap: 6 }}>
                <Text style={ui.s.label}>技能</Text>
                <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
                  {agent.skills.map((skill, index) => (
                    <Tag key={`${skill.id ?? skill.name ?? index}`} ui={ui} label={skill.name ?? skill.slug ?? "技能"} tone="accent" />
                  ))}
                </View>
              </View>
            ) : null}

            {agent.instructions ? (
              <View style={{ gap: 6 }}>
                <Text style={ui.s.label}>指令</Text>
                <View style={{ maxHeight: 260 }}>
                  <ScrollView nestedScrollEnabled>
                    <Markdown>{agent.instructions}</Markdown>
                  </ScrollView>
                </View>
              </View>
            ) : null}

            <Text style={ui.s.tiny}>更新于 {fmtDateTime(agent.updated_at)}</Text>

            <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }]}>
              {agent.archived_at ? (
                <Btn ui={ui} label="恢复" icon="ArchiveRestore" busy={busy} onPress={() => void restore()} />
              ) : (
                <Btn ui={ui} label="归档" icon="Archive" tone="danger" busy={busy} onPress={() => void archive()} />
              )}
              <Btn ui={ui} label="开始聊天" icon="MessagesSquare" tone="primary" onPress={() => onChat(agent)} />
            </View>
          </View>
        ) : null}
      </Modal.Content>
    </Modal>
  );
}

function SquadDetailModal({ squadId, onClose }: { squadId: string | null; onClose(): void }) {
  const ctx = useWorkbench();
  const { theme, compact, api } = ctx;
  const ui = useUi(theme, compact);
  const squad = useQuery<Squad | null>(
    api,
    squadId ? `/api/squads/${squadId}` : null,
    { select: (data) => (data && typeof data === "object" ? (data as Squad) : null) },
    squadId ?? "",
  );
  const members = useQuery(
    api,
    squadId ? `/api/squads/${squadId}/members` : null,
    { select: (data) => asList<Record<string, unknown>>(data, "members") },
    squadId ?? "",
  );

  return (
    <Modal
      title={squad.data?.name ?? "小队"}
      icon={<Icon name="UsersRound" size={16} color={ui.c.muted} />}
      open={Boolean(squadId)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Content>
        {squad.loading && !squad.data ? (
          <LoadingRow ui={ui} />
        ) : squad.data ? (
          <View style={{ gap: 10 }}>
            {squad.data.description ? <Text style={ui.s.body}>{squad.data.description}</Text> : null}
            <Text style={ui.s.label}>成员 · {(members.data ?? []).length}</Text>
            {(members.data ?? []).length === 0 ? (
              <Text style={ui.s.muted}>暂无成员信息</Text>
            ) : (
              (members.data ?? []).map((member, index) => {
                const id = String(member.member_id ?? member.id ?? index);
                const role = String(member.role ?? "member");
                return (
                  <View key={id} style={[ui.s.row, { gap: 8, paddingVertical: 4 }]}>
                    <Avatar ui={ui} name={id.slice(0, 2)} size={24} />
                    <Text style={[ui.s.body, { flex: 1 }]} numberOfLines={1}>
                      {String(member.name ?? member.member_id ?? id)}
                    </Text>
                    <Tag ui={ui} label={role === "leader" ? "队长" : role} tone={role === "leader" ? "accent" : "muted"} />
                  </View>
                );
              })
            )}
            {squad.data.instructions ? (
              <View style={{ gap: 6 }}>
                <Text style={ui.s.label}>协作指令</Text>
                <Markdown>{squad.data.instructions}</Markdown>
              </View>
            ) : null}
          </View>
        ) : null}
      </Modal.Content>
    </Modal>
  );
}
