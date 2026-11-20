import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { Text, View } from "react-native";
import { Btn, Chips, ErrorNote, Field, useUi } from "./bits";
import { useWorkbench } from "./context";
import { runtimeName, type Agent, type AgentRuntime } from "./model";

export function CreateAgentModal({
  open,
  runtimes,
  onClose,
  onDone,
}: {
  open: boolean;
  runtimes: AgentRuntime[];
  onClose(): void;
  onDone(): void;
}) {
  const { theme, compact, api } = useWorkbench();
  const ui = useUi(theme, compact);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [model, setModel] = useState("");
  const [instructions, setInstructions] = useState("");
  const [runtimeId, setRuntimeId] = useState<string | null>(null);
  const selectedRuntime = runtimeId ?? runtimes[0]?.id ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setDescription("");
    setModel("");
    setInstructions("");
    setError(null);
  };

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请填写智能体名称");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await api({
      method: "POST",
      path: "/api/agents",
      body: {
        name: trimmed,
        description: description.trim() || undefined,
        model: model.trim() || undefined,
        instructions: instructions.trim() || undefined,
        runtime_id: selectedRuntime || undefined,
      },
    });
    setBusy(false);
    if (result.ok) {
      reset();
      onClose();
      onDone();
    } else {
      setError(result.error ?? "创建智能体失败");
    }
  };

  return (
    <Modal
      title="新建智能体"
      icon={<Icon name="Bot" size={16} color={ui.c.muted} />}
      open={open}
      onOpenChange={(next) => !next && onClose()}
    >
      <Modal.Content>
        <View style={{ gap: 12 }}>
          <Field ui={ui} label="名称" value={name} onChangeText={setName} placeholder="例如：代码审查员" autoFocus />
          <Field
            ui={ui}
            label="描述"
            value={description}
            onChangeText={setDescription}
            placeholder="一句话说明这个智能体擅长什么"
          />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>运行时</Text>
            {runtimes.length === 0 ? (
              <Text style={ui.s.muted}>暂无可用运行时，创建后可在智能体详情中绑定。</Text>
            ) : (
              <Chips
                ui={ui}
                options={runtimes.map((runtime) => ({ value: runtime.id, label: runtimeName(runtime) }))}
                value={selectedRuntime}
                onChange={(next) => setRuntimeId(next)}
              />
            )}
          </View>
          <Field ui={ui} label="模型" value={model} onChangeText={setModel} placeholder="留空则由运行时决定" />
          <Field
            ui={ui}
            label="系统指令"
            value={instructions}
            onChangeText={setInstructions}
            placeholder="描述角色、边界与输出要求"
            multiline
          />
          {error ? <ErrorNote ui={ui} message={error} /> : null}
          <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
            <Btn ui={ui} label="取消" onPress={onClose} />
            <Btn ui={ui} label="创建" tone="primary" busy={busy} onPress={() => void submit()} />
          </View>
        </View>
      </Modal.Content>
    </Modal>
  );
}

export function CreateSquadModal({
  open,
  agents,
  onClose,
  onDone,
}: {
  open: boolean;
  agents: Agent[];
  onClose(): void;
  onDone(): void;
}) {
  const { theme, compact, api } = useWorkbench();
  const ui = useUi(theme, compact);
  const active = agents.filter((agent) => !agent.archived_at);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [instructions, setInstructions] = useState("");
  const [leaderId, setLeaderId] = useState<string | null>(null);
  const selectedLeader = leaderId ?? active[0]?.id ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("请填写小队名称");
      return;
    }
    if (!selectedLeader) {
      setError("请选择队长");
      return;
    }
    setBusy(true);
    setError(null);
    const result = await api({
      method: "POST",
      path: "/api/squads",
      body: {
        name: trimmed,
        leader_id: selectedLeader,
        description: description.trim() || undefined,
        instructions: instructions.trim() || undefined,
      },
    });
    setBusy(false);
    if (result.ok) {
      setName("");
      setDescription("");
      setInstructions("");
      setError(null);
      onClose();
      onDone();
    } else {
      setError(result.error ?? "创建小队失败");
    }
  };

  return (
    <Modal
      title="新建小队"
      icon={<Icon name="UsersRound" size={16} color={ui.c.muted} />}
      open={open}
      onOpenChange={(next) => !next && onClose()}
    >
      <Modal.Content>
        <View style={{ gap: 12 }}>
          <Field ui={ui} label="名称" value={name} onChangeText={setName} placeholder="例如：发布保障小队" autoFocus />
          <Field
            ui={ui}
            label="描述"
            value={description}
            onChangeText={setDescription}
            placeholder="小队负责什么问题域"
          />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>队长</Text>
            {active.length === 0 ? (
              <Text style={ui.s.muted}>请先创建智能体，再由它担任队长。</Text>
            ) : (
              <Chips
                ui={ui}
                options={active.map((agent) => ({ value: agent.id, label: agent.name }))}
                value={selectedLeader}
                onChange={(next) => setLeaderId(next)}
              />
            )}
          </View>
          <Field
            ui={ui}
            label="协作指令"
            value={instructions}
            onChangeText={setInstructions}
            placeholder="约定成员分工、交接与验收方式"
            multiline
          />
          {error ? <ErrorNote ui={ui} message={error} /> : null}
          <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
            <Btn ui={ui} label="取消" onPress={onClose} />
            <Btn ui={ui} label="创建" tone="primary" busy={busy} onPress={() => void submit()} />
          </View>
        </View>
      </Modal.Content>
    </Modal>
  );
}

