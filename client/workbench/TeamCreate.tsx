import { t } from "./i18n";
import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { Text, View } from "react-native";
import { Btn, Chips, ErrorNote, Field, useUi , Select } from "./bits";
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
      setError(t("TeamCreate.1"));
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
      setError(result.error ?? t("TeamCreate.2"));
    }
  };

  return (
    <Modal
      title={t("TeamCreate.3")}
      icon={<Icon name="Bot" size={16} color={ui.c.muted} />}
      open={open}
      onOpenChange={(next) => !next && onClose()}
    >
      <Modal.Content>
        <View style={{ gap: 12 }}>
          <Field ui={ui} label={t("AgentDetail.95")} value={name} onChangeText={setName} placeholder={t("TeamCreate.5")} autoFocus />
          <Field
            ui={ui}
            label={t("AgentDetail.97")}
            value={description}
            onChangeText={setDescription}
            placeholder={t("TeamCreate.7")}
          />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("AgentDetail.16")}</Text>
            {runtimes.length === 0 ? (
              <Text style={ui.s.muted}>{t("TeamCreate.9")}</Text>
            ) : (
              <Select
                ui={ui}
                value={selectedRuntime || null}
                placeholder={t("AgentDetail.108")}
                onChange={(next) => setRuntimeId(next)}
                options={runtimes.map((runtime) => ({ value: runtime.id, label: runtimeName(runtime) }))}
              />
            )}
          </View>
          <Field ui={ui} label={t("AgentDetail.99")} value={model} onChangeText={setModel} placeholder={t("TeamCreate.11")} />
          <Field
            ui={ui}
            label={t("TeamCreate.12")}
            value={instructions}
            onChangeText={setInstructions}
            placeholder={t("TeamCreate.13")}
            multiline
          />
          {error ? <ErrorNote ui={ui} message={error} /> : null}
          <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
            <Btn ui={ui} label={t("AgentDetail.40")} onPress={onClose} />
            <Btn ui={ui} label={t("SettingsSections.30")} tone="primary" busy={busy} onPress={() => void submit()} />
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
      setError(t("SquadDetail.22"));
      return;
    }
    if (!selectedLeader) {
      setError(t("TeamCreate.17"));
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
      setError(result.error ?? t("TeamCreate.18"));
    }
  };

  return (
    <Modal
      title={t("TeamCreate.19")}
      icon={<Icon name="UsersRound" size={16} color={ui.c.muted} />}
      open={open}
      onOpenChange={(next) => !next && onClose()}
    >
      <Modal.Content>
        <View style={{ gap: 12 }}>
          <Field ui={ui} label={t("AgentDetail.95")} value={name} onChangeText={setName} placeholder={t("TeamCreate.21")} autoFocus />
          <Field
            ui={ui}
            label={t("AgentDetail.97")}
            value={description}
            onChangeText={setDescription}
            placeholder={t("SquadDetail.27")}
          />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("SquadDetail.10")}</Text>
            {active.length === 0 ? (
              <Text style={ui.s.muted}>{t("TeamCreate.25")}</Text>
            ) : (
              <Select
                ui={ui}
                value={selectedLeader || null}
                placeholder={t("TeamCreate.17")}
                onChange={(next) => setLeaderId(next)}
                options={active.map((agent) => ({ value: agent.id, label: agent.name }))}
              />
            )}
          </View>
          <Field
            ui={ui}
            label={t("SquadDetail.13")}
            value={instructions}
            onChangeText={setInstructions}
            placeholder={t("TeamCreate.27")}
            multiline
          />
          {error ? <ErrorNote ui={ui} message={error} /> : null}
          <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
            <Btn ui={ui} label={t("AgentDetail.40")} onPress={onClose} />
            <Btn ui={ui} label={t("SettingsSections.30")} tone="primary" busy={busy} onPress={() => void submit()} />
          </View>
        </View>
      </Modal.Content>
    </Modal>
  );
}

