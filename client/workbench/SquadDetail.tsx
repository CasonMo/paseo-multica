import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { asList, useQuery } from "./api";
import { Avatar, Btn, Chips, Divider, ErrorNote, Field, LoadingRow, Tag, useUi } from "./bits";
import { useWorkbench } from "./context";
import type { Agent, Squad } from "./model";

interface SquadMember {
  id?: string;
  member_type?: string;
  member_id?: string;
  role?: string;
}

export function SquadDetailModal({
  squadId,
  agents,
  onClose,
  onChanged,
}: {
  squadId: string | null;
  agents: Agent[];
  onClose(): void;
  onChanged(): void;
}) {
  const { theme, compact, api, toast } = useWorkbench();
  const ui = useUi(theme, compact);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  const squad = useQuery<Squad | null>(
    api,
    squadId ? `/api/squads/${squadId}` : null,
    { select: (data) => (data && typeof data === "object" ? (data as Squad) : null) },
    squadId ?? "",
  );
  const members = useQuery(
    api,
    squadId ? `/api/squads/${squadId}/members` : null,
    { select: (data) => asList<SquadMember>(data, "members") },
    squadId ?? "",
  );

  const rows = members.data ?? [];
  const leaderId = squad.data?.leader_id;
  const memberIds = new Set(rows.map((row) => String(row.member_id ?? "")));
  const candidates = agents.filter((agent) => !agent.archived_at && !memberIds.has(agent.id));
  const nameOf = (id: unknown) => {
    const value = String(id ?? "");
    return agents.find((agent) => agent.id === value)?.name ?? (value ? value.slice(0, 8) : "—");
  };

  const addMember = async (agent: Agent) => {
    if (!squadId) return;
    setBusy(true);
    const result = await api({
      method: "POST",
      path: `/api/squads/${squadId}/members`,
      body: { member_type: "agent", member_id: agent.id },
    });
    setBusy(false);
    if (result.ok) {
      setAdding(false);
      members.refresh();
      squad.refresh();
      onChanged();
    } else {
      toast.error(result.error ?? "添加成员失败");
    }
  };

  const removeMember = async (member: SquadMember) => {
    if (!squadId) return;
    const result = await api({
      method: "DELETE",
      path: `/api/squads/${squadId}/members`,
      body: { member_type: member.member_type ?? "agent", member_id: member.member_id },
    });
    if (result.ok) {
      members.refresh();
      squad.refresh();
      onChanged();
    } else {
      toast.error(result.error ?? "移除成员失败");
    }
  };

  const removeSquad = async () => {
    if (!squadId) return;
    setBusy(true);
    const result = await api({ method: "DELETE", path: `/api/squads/${squadId}` });
    setBusy(false);
    if (result.ok) {
      setConfirmDelete(false);
      onChanged();
      onClose();
    } else {
      toast.error(result.error ?? "删除小队失败");
    }
  };

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
          <View style={{ gap: 12 }}>
            {squad.data.description ? <Text style={ui.s.body}>{squad.data.description}</Text> : null}
            <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
              <Btn ui={ui} label="添加成员" icon="UserPlus" onPress={() => setAdding(true)} />
              <Btn ui={ui} label="编辑" icon="Pencil" onPress={() => setEditing(true)} />
              <Btn ui={ui} label="删除小队" icon="Trash2" tone="danger" onPress={() => setConfirmDelete(true)} />
            </View>
            <Divider ui={ui} />
            <View style={{ gap: 2 }}>
              <Text style={ui.s.label}>成员 · {rows.length}</Text>
              {rows.length === 0 ? (
                <Text style={ui.s.muted}>还没有成员</Text>
              ) : (
                rows.map((member, index) => {
                  const isLeader = member.role === "leader" || (leaderId && member.member_id === leaderId);
                  return (
                    <View key={String(member.id ?? member.member_id ?? index)} style={[ui.s.row, { gap: 8, paddingVertical: 5 }]}>
                      <Avatar ui={ui} name={nameOf(member.member_id)} size={24} />
                      <Text numberOfLines={1} style={[ui.s.body, { flex: 1 }]}>
                        {nameOf(member.member_id)}
                      </Text>
                      {isLeader ? (
                        <Tag ui={ui} label="队长" tone="accent" />
                      ) : (
                        <Tag ui={ui} label="成员" tone="muted" />
                      )}
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`移除 ${nameOf(member.member_id)}`}
                        onPress={() => void removeMember(member)}
                        style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
                      >
                        <Icon name="X" size={13} color={ui.c.muted} />
                      </Pressable>
                    </View>
                  );
                })
              )}
            </View>
            {squad.data.instructions ? (
              <View style={{ gap: 6 }}>
                <Text style={ui.s.label}>协作指令</Text>
                <Text style={ui.s.body}>{squad.data.instructions}</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </Modal.Content>

      <Modal
        title="添加成员"
        icon={<Icon name="UserPlus" size={16} color={ui.c.muted} />}
        open={adding}
        onOpenChange={(next) => !next && setAdding(false)}
      >
        <Modal.Content>
          {candidates.length === 0 ? (
            <Text style={ui.s.muted}>所有智能体都已在小队中。</Text>
          ) : (
            <View style={{ gap: 2 }}>
              {candidates.map((agent) => (
                <Pressable
                  key={agent.id}
                  accessibilityRole="button"
                  accessibilityLabel={`添加 ${agent.name}`}
                  disabled={busy}
                  onPress={() => void addMember(agent)}
                  style={({ pressed }) => [ui.s.listRow, pressed && ui.s.pressed]}
                >
                  <Avatar ui={ui} name={agent.name} url={agent.avatar_url} size={26} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text style={[ui.s.body, { fontWeight: "600" }]}>{agent.name}</Text>
                    <Text numberOfLines={1} style={ui.s.tiny}>
                      {agent.description || "—"}
                    </Text>
                  </View>
                  <Icon name="Plus" size={15} color={ui.c.accent} />
                </Pressable>
              ))}
            </View>
          )}
        </Modal.Content>
      </Modal>

      <EditSquadModal
        squad={editing ? squad.data ?? null : null}
        agents={agents}
        onClose={() => setEditing(false)}
        onSaved={() => {
          squad.refresh();
          onChanged();
        }}
      />

      <Modal
        title="删除小队"
        icon={<Icon name="Trash2" size={16} color={ui.c.danger} />}
        open={confirmDelete}
        onOpenChange={(next) => !next && setConfirmDelete(false)}
      >
        <Modal.Content>
          <Text style={ui.s.body}>删除「{squad.data?.name}」后成员关系不可恢复，智能体本身不受影响。</Text>
          <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
            <Btn ui={ui} label="取消" onPress={() => setConfirmDelete(false)} />
            <Btn ui={ui} label="删除" tone="danger" busy={busy} onPress={() => void removeSquad()} />
          </View>
        </Modal.Content>
      </Modal>
    </Modal>
  );
}

function EditSquadModal({
  squad,
  agents,
  onClose,
  onSaved,
}: {
  squad: Squad | null;
  agents: Agent[];
  onClose(): void;
  onSaved(): void;
}) {
  const { theme, compact, api } = useWorkbench();
  const ui = useUi(theme, compact);
  const [form, setForm] = useState<{ name: string; description: string; instructions: string; leaderId: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(null);
  }, [squad?.id]);

  const current = form ?? (squad ? {
    name: squad.name,
    description: squad.description ?? "",
    instructions: squad.instructions ?? "",
    leaderId: squad.leader_id ?? "",
  } : null);
  const patch = (next: Partial<NonNullable<typeof current>>) => current && setForm({ ...current, ...next });

  const save = async () => {
    if (!squad || !current) return;
    const name = current.name.trim();
    if (!name) {
      setError("请填写小队名称");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await api({
      method: "PUT",
      path: `/api/squads/${squad.id}`,
      body: {
        name,
        description: current.description.trim(),
        instructions: current.instructions.trim(),
        leader_id: current.leaderId || undefined,
      },
    });
    setBusy(false);
    if (result.ok) {
      setForm(null);
      onSaved();
      onClose();
    } else {
      setError(result.error ?? "保存失败");
    }
  };

  return (
    <Modal
      title="编辑小队"
      icon={<Icon name="Pencil" size={16} color={ui.c.muted} />}
      open={Boolean(squad) && Boolean(current)}
      onOpenChange={(next) => !next && onClose()}
    >
      <Modal.Content>
        {current ? (
          <View style={{ gap: 12 }}>
            <Field ui={ui} label="名称" value={current.name} onChangeText={(value) => patch({ name: value })} />
            <Field
              ui={ui}
              label="描述"
              value={current.description}
              onChangeText={(value) => patch({ description: value })}
              placeholder="小队负责什么问题域"
            />
            <View style={{ gap: 6 }}>
              <Text style={ui.s.label}>队长</Text>
              <Chips
                ui={ui}
                options={agents.filter((agent) => !agent.archived_at).map((agent) => ({ value: agent.id, label: agent.name }))}
                value={current.leaderId}
                onChange={(next) => patch({ leaderId: next })}
              />
            </View>
            <Field
              ui={ui}
              label="协作指令"
              value={current.instructions}
              onChangeText={(value) => patch({ instructions: value })}
              multiline
            />
            {error ? <ErrorNote ui={ui} message={error} /> : null}
            <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
              <Btn ui={ui} label="取消" onPress={onClose} />
              <Btn ui={ui} label="保存" tone="primary" busy={busy} onPress={() => void save()} />
            </View>
          </View>
        ) : null}
      </Modal.Content>
    </Modal>
  );
}
