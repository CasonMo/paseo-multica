import { t } from "../i18n";
import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Btn, Card, Chips, Divider, Dot, Empty, ErrorNote, Field, IconBtn, LoadingRow, LoadMore, nearBottom, Tag, useUi , Select } from "../bits";
import { asList, usePagedQuery, useQuery } from "../api";
import { useWorkbench } from "../context";
import {
  HANDLER_LABEL,
  relTime,
  statusLabel as statusLabelOf,
  type Agent,
  type IssueStatusEntry,
  type Project,
  type Workflow,
  type WorkflowHandler,
  type WorkflowStep,
} from "../model";

type Member = { id: string; userId: string; name: string; email: string; avatarUrl: string | null };
type HandlerType = "none" | "project_lead" | "member" | "agent";

const HANDLER_OPTIONS: { value: HandlerType; label: string }[] = [
  { value: "none", label: "model.7" },
  { value: "project_lead", label: "model.8" },
  { value: "member", label: "Execution.11" },
  { value: "agent", label: "AgentDetail.23" },
];

export function WorkflowsPage() {
  const ctx = useWorkbench();
  const { theme, compact, api, statuses, bump, workspaceId, toast, invalidate } = ctx;
  const ui = useUi(theme, compact);
  const key = `${workspaceId}:${bump}`;
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Workflow | null>(null);
  const [stepEdit, setStepEdit] = useState<{ workflow: Workflow; step: WorkflowStep } | null>(null);
  const [statusSetFor, setStatusSetFor] = useState<Workflow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Workflow | null>(null);
  const [busy, setBusy] = useState(false);

  const workflowsQuery = usePagedQuery<Workflow>(api, "/api/issue-workflows", { pageSize: 30 }, key, "workflows");
  const agentsQuery = useQuery(
    api,
    "/api/agents",
    { query: { limit: 50 }, select: (data) => asList<Agent>(data, "agents") },
    key,
  );
  const membersQuery = useQuery(
    api,
    workspaceId ? `/api/workspaces/${workspaceId}/members` : null,
    { query: { limit: 50 }, select: (data) => asList<Record<string, unknown>>(data, "members") },
    key,
  );
  const projectsQuery = useQuery(api, "/api/projects", { query: { limit: 50 }, select: (data) => asList<Project>(data, "projects") }, key);

  const workflowList = workflowsQuery.items;
  const agentList = agentsQuery.data ?? [];
  const members: Member[] = useMemo(
    () =>
      (membersQuery.data ?? []).map((item) => ({
        id: String(item.id ?? ""),
        userId: String(item.user_id ?? ""),
        name: String(item.name ?? item.email ?? t("Execution.11")),
        email: String(item.email ?? ""),
        avatarUrl: (item.avatar_url as string | null) ?? null,
      })),
    [membersQuery.data],
  );
  const projectList = projectsQuery.data ?? [];
  const active = workflowList.find((workflow) => workflow.id === activeId) ?? null;
  const needle = search.trim().toLowerCase();
  const filtered = workflowList.filter(
    (workflow) => !needle || `${workflow.name} ${workflow.description ?? ""}`.toLowerCase().includes(needle),
  );

  const statusOf = (statusKey: string): IssueStatusEntry | null =>
    statuses.find((status) => status.key === statusKey) ?? null;
  const statusName = (statusKey: string) => {
    const entry = statusOf(statusKey);
    return entry ? statusLabelOf(entry) : statusKey;
  };

  const handlerText = (handler?: WorkflowHandler | null): string => {
    if (!handler || handler.type === "none") return t(HANDLER_LABEL.none);
    if (handler.type === "project_lead") return t(HANDLER_LABEL.project_lead);
    if (handler.type === "agent") {
      const agent = agentList.find((item) => item.id === handler.id);
      return t("Workflows.6", { a: t(HANDLER_LABEL.agent), b: agent?.name ?? handler.id ?? t("Workflows.7") });
    }
    if (handler.type === "member") {
      const member = members.find((item) => item.id === handler.id || item.userId === handler.id);
      return t("Workflows.6", { a: t(HANDLER_LABEL.member), b: member?.name ?? handler.id ?? t("Workflows.7") });
    }
    return HANDLER_LABEL[handler.type] ? t(HANDLER_LABEL[handler.type]) : handler.type;
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    const result = await api({ method: "DELETE", path: `/api/issue-workflows/${confirmDelete.id}` });
    setBusy(false);
    if (result.ok) {
      toast.show(t("Workflows.10"), { variant: "success" });
      setConfirmDelete(null);
      setActiveId(null);
      workflowsQuery.refresh();
      invalidate();
    } else toast.error(result.error ?? t("Automation.15"));
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: compact ? 12 : 18, gap: 12, paddingBottom: 48 }}
        onScroll={(e) => {
          if (nearBottom(e)) workflowsQuery.loadMore();
        }}
        scrollEventThrottle={200}
      >
        <View style={[ui.s.row, { gap: 10 }]}>
          <View style={ui.s.grow}>
            <Text style={[ui.s.title, { fontSize: compact ? 18 : 21 }]}>{t("Nav.7")}</Text>
            <Text style={ui.s.muted}>
              {t("Inbox.40")} {workflowList.length} {t("Workflows.14")}
            </Text>
          </View>
          <Btn
            ui={ui}
            label={t("Nav.10")}
            icon="Plus"
            tone="primary"
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          />
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
            placeholder={t("Workflows.16")}
            placeholderTextColor={ui.c.muted}
            style={{ flex: 1, color: ui.c.fg, fontSize: 13, paddingVertical: 8 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Card ui={ui} padded={false}>
          {workflowsQuery.loading && workflowList.length === 0 ? (
            <LoadingRow ui={ui} />
          ) : workflowsQuery.error ? (
            <View style={{ padding: 14 }}>
              <ErrorNote ui={ui} message={workflowsQuery.error} onRetry={workflowsQuery.refresh} />
            </View>
          ) : filtered.length === 0 ? (
            <Empty
              ui={ui}
              icon="Workflow"
              title={needle ? t("Workflows.17") : t("Workflows.18")}
              description={t("Workflows.19")}
              action={
                <Btn
                  ui={ui}
                  label={t("Workflows.20")}
                  icon="Plus"
                  tone="primary"
                  onPress={() => {
                    setEditing(null);
                    setFormOpen(true);
                  }}
                />
              }
            />
          ) : (
            <View style={{ paddingBottom: 6 }}>
              {filtered.map((workflow, index) => (
                <View key={workflow.id}>
                  {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 14 }} /> : null}
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t("Workflows.21", { a: workflow.name })}
                    onPress={() => setActiveId(workflow.id)}
                    style={({ pressed }) => [ui.s.listRow, { alignItems: "flex-start" }, pressed && ui.s.pressed]}
                  >
                    <View
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        marginTop: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: workflow.is_default ? `${ui.c.accent}1f` : ui.c.surface2,
                      }}
                    >
                      <Icon name="Workflow" size={15} color={workflow.is_default ? ui.c.accent : ui.c.muted} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
                        <Text numberOfLines={1} style={[ui.s.body, { fontWeight: "600" }]}>
                          {workflow.name}
                        </Text>
                        {workflow.is_default ? <Tag ui={ui} label={t("Workflows.22")} tone="accent" /> : null}
                      </View>
                      {workflow.description ? (
                        <Text numberOfLines={2} style={ui.s.tiny}>
                          {workflow.description}
                        </Text>
                      ) : null}
                      <Text style={ui.s.tiny}>
                        {workflow.steps?.length ?? 0} {t("Workflows.23")}{" "}
                        {workflow.project_ids?.length ? t("Workflows.24", { a: workflow.project_ids.length }) : t("Workflows.25")} ·{" "}
                        {relTime(workflow.updated_at ?? workflow.created_at)}
                      </Text>
                    </View>
                    <Icon name="ChevronRight" size={15} color={ui.c.muted} />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </Card>
        <LoadMore
          ui={ui}
          loaded={workflowList.length}
          total={workflowsQuery.total}
          hasMore={workflowsQuery.hasMore}
          loadingMore={workflowsQuery.loadingMore}
          loading={workflowsQuery.loading}
          onLoadMore={workflowsQuery.loadMore}
        />
      </ScrollView>

      <Modal
        title={active ? active.name : t("Workflows.26")}
        icon={<Icon name="Workflow" size={16} color={ui.c.muted} />}
        open={Boolean(active)}
        onOpenChange={(next) => {
          if (!next) setActiveId(null);
        }}
      >
        <Modal.Content>
          {active ? (
            <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 12 }}>
              <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
                {active.is_default ? <Tag ui={ui} label={t("IssueDetail.73")} tone="accent" /> : null}
                <Tag ui={ui} label={t("Workflows.28", { a: active.steps?.length ?? 0 })} tone="muted" />
                <View style={ui.s.grow} />
                <IconBtn
                  ui={ui}
                  icon="Pencil"
                  label={t("Workflows.29")}
                  onPress={() => {
                    setEditing(active);
                    setFormOpen(true);
                  }}
                />
                <IconBtn ui={ui} icon="ListChecks" label={t("Workflows.30")} onPress={() => setStatusSetFor(active)} />
                <IconBtn
                  ui={ui}
                  icon="Trash2"
                  label={t("Workflows.31")}
                  color={ui.c.danger}
                  onPress={() => setConfirmDelete(active)}
                />
              </View>

              {active.description ? <Text style={ui.s.body}>{active.description}</Text> : null}
              <Text style={ui.s.tiny}>
                {t("Projects.48")} {relTime(active.updated_at)}
                {active.project_ids?.length
                  ? t("Workflows.33", { a: active.project_ids
                      .map((id) => projectList.find((project) => project.id === id)?.title ?? id)
                      .join(t("Workflows.155")) })
                  : t("Workflows.34")}
              </Text>

              <Divider ui={ui} />

              <View style={{ gap: 8 }}>
                {(active.steps ?? []).length === 0 ? (
                  <Empty ui={ui} icon="ListChecks" title={t("Workflows.35")} description={t("Workflows.36")} />
                ) : (
                  (active.steps ?? []).map((step) => {
                    const entry = statusOf(step.status_key);
                    const configured =
                      (step.handler && step.handler.type !== "none") || Boolean(step.instructions?.trim());
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={t("Workflows.37", { a: statusName(step.status_key) })}
                        key={step.status_key}
                        onPress={() => setStepEdit({ workflow: active, step })}
                        style={({ pressed }) => [
                          {
                            gap: 5,
                            padding: 10,
                            borderRadius: 9,
                            borderWidth: 1,
                            borderColor: ui.c.border,
                            backgroundColor: ui.c.surface0,
                          },
                          pressed && ui.s.pressed,
                        ]}
                      >
                        <View style={[ui.s.row, { gap: 7, flexWrap: "wrap" }]}>
                          <Dot color={entry?.color || ui.c.muted} size={8} />
                          <Text style={[ui.s.body, { fontWeight: "600" }]}>{statusName(step.status_key)}</Text>
                          <View style={ui.s.grow} />
                          <Tag
                            ui={ui}
                            label={handlerText(step.handler)}
                            tone={configured ? "accent" : "muted"}
                          />
                          <Icon name="Pencil" size={12} color={ui.c.muted} />
                        </View>
                        {step.next_status_key || step.back_status_key ? (
                          <Text style={ui.s.tiny}>
                            {step.next_status_key ? `→ ${statusName(step.next_status_key)}` : ""}
                            {step.next_status_key && step.back_status_key ? t("Workflows.156") : ""}
                            {step.back_status_key ? `↩ ${statusName(step.back_status_key)}` : ""}
                          </Text>
                        ) : null}
                        {step.instructions?.trim() ? (
                          <Text numberOfLines={2} style={ui.s.tiny}>
                            {step.instructions}
                          </Text>
                        ) : null}
                      </Pressable>
                    );
                  })
                )}
              </View>
            </ScrollView>
          ) : null}
        </Modal.Content>
      </Modal>

      <WorkflowFormModal
        open={formOpen}
        workflow={editing}
        statuses={statuses}
        onClose={() => setFormOpen(false)}
        onSaved={(saved) => {
          setFormOpen(false);
          workflowsQuery.refresh();
          invalidate();
          if (saved) setActiveId(saved.id);
        }}
        toast={toast}
      />

      <StepModal
        target={stepEdit}
        workflowSteps={stepEdit?.workflow.steps ?? []}
        statuses={statuses}
        agents={agentList}
        members={members}
        onClose={() => setStepEdit(null)}
        onSaved={() => {
          setStepEdit(null);
          workflowsQuery.refresh();
          invalidate();
        }}
        toast={toast}
      />

      <StatusSetModal
        workflow={statusSetFor}
        statuses={statuses}
        onClose={() => setStatusSetFor(null)}
        onSaved={() => {
          setStatusSetFor(null);
          workflowsQuery.refresh();
          invalidate();
        }}
        toast={toast}
      />

      <Modal
        title={t("Workflows.31")}
        icon={<Icon name="TriangleAlert" size={16} color={ui.c.danger} />}
        open={Boolean(confirmDelete)}
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(null);
        }}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>
              {t("Automation.48")}{confirmDelete?.name}{t("Workflows.40")}
            </Text>
            <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8 }]}>
              <Btn ui={ui} label={t("AgentDetail.40")} onPress={() => setConfirmDelete(null)} />
              <Btn ui={ui} label={t("SquadDetail.21")} tone="danger" busy={busy} onPress={() => void remove()} />
            </View>
          </View>
        </Modal.Content>
      </Modal>
    </View>
  );
}

function WorkflowFormModal({
  open,
  workflow,
  statuses,
  onClose,
  onSaved,
  toast,
}: {
  open: boolean;
  workflow: Workflow | null;
  statuses: IssueStatusEntry[];
  onClose(): void;
  onSaved(saved: Workflow | null): void;
  toast: ReturnType<typeof useWorkbench>["toast"];
}) {
  const { theme, compact, api } = useWorkbench();
  const ui = useUi(theme, compact);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(workflow?.name ?? "");
    setDescription(workflow?.description ?? "");
    setPicked((workflow?.steps ?? []).map((step) => step.status_key));
  }, [open, workflow]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error(t("Workflows.43"));
      return;
    }
    setBusy(true);
    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
    };
    if (!workflow) body.steps = picked.map((statusKey) => ({ status_key: statusKey }));
    const result = workflow
      ? await api({ method: "PATCH", path: `/api/issue-workflows/${workflow.id}`, body })
      : await api({ method: "POST", path: "/api/issue-workflows", body });
    setBusy(false);
    if (result.ok) {
      toast.show(workflow ? t("Workflows.44") : t("Workflows.45"), { variant: "success" });
      const saved = result.data && typeof result.data === "object" ? (result.data as Workflow) : null;
      onSaved(saved);
    } else toast.error(result.error ?? t("AgentDetail.64"));
  };

  return (
    <Modal
      title={workflow ? t("Workflows.47") : t("Workflows.20")}
      icon={<Icon name="Workflow" size={16} color={ui.c.muted} />}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Content>
        <View style={{ gap: 12 }}>
          <Field ui={ui} label={t("AgentDetail.95")} value={name} onChangeText={setName} placeholder={t("Workflows.50")} autoFocus />
          <Field
            ui={ui}
            label={t("AgentDetail.97")}
            value={description}
            onChangeText={setDescription}
            placeholder={t("Workflows.52")}
            multiline
          />
          {workflow ? (
            <Text style={ui.s.tiny}>{t("Workflows.53")}</Text>
          ) : (
            <View style={{ gap: 6 }}>
              <Text style={ui.s.label}>{t("Workflows.54")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {statuses.map((status) => (
                  <ToggleChip
                    key={status.key}
                    ui={ui}
                    label={status.name || status.key}
                    color={status.color}
                    active={picked.includes(status.key)}
                    onPress={() =>
                      setPicked((value) =>
                        value.includes(status.key)
                          ? value.filter((entry) => entry !== status.key)
                          : [...value, status.key],
                      )
                    }
                  />
                ))}
              </View>
              <Text style={ui.s.tiny}>{t("Workflows.55")}</Text>
            </View>
          )}
          <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8, paddingTop: 4 }]}>
            <Btn ui={ui} label={t("AgentDetail.40")} onPress={onClose} />
            <Btn
              ui={ui}
              label={workflow ? t("AgentDetail.72") : t("Workflows.58")}
              icon="Check"
              tone="primary"
              busy={busy}
              onPress={() => void submit()}
            />
          </View>
        </View>
      </Modal.Content>
    </Modal>
  );
}

function StepModal({
  target,
  workflowSteps,
  statuses,
  agents,
  members,
  onClose,
  onSaved,
  toast,
}: {
  target: { workflow: Workflow; step: WorkflowStep } | null;
  workflowSteps: WorkflowStep[];
  statuses: IssueStatusEntry[];
  agents: Agent[];
  members: Member[];
  onClose(): void;
  onSaved(): void;
  toast: ReturnType<typeof useWorkbench>["toast"];
}) {
  const { theme, compact, api } = useWorkbench();
  const ui = useUi(theme, compact);
  const [handlerType, setHandlerType] = useState<HandlerType>("none");
  const [handlerId, setHandlerId] = useState<string | null>(null);
  const [instructions, setInstructions] = useState("");
  const [nextKey, setNextKey] = useState<string | null>(null);
  const [backKey, setBackKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const step = target?.step ?? null;
  useEffect(() => {
    if (!step) return;
    const type = (step.handler?.type ?? "none") as HandlerType;
    setHandlerType(type);
    setHandlerId(step.handler?.id ?? null);
    setInstructions(step.instructions ?? "");
    setNextKey(step.next_status_key ?? null);
    setBackKey(step.back_status_key ?? null);
  }, [step]);

  const open = Boolean(target);
  const status = step ? statuses.find((entry) => entry.key === step.status_key) ?? null : null;
  const otherKeys = workflowSteps.map((entry) => entry.status_key).filter((entry) => entry !== step?.status_key);
  const statusLabel = (statusKey: string) => {
    const entry = statuses.find((item) => item.key === statusKey);
    return entry ? statusLabelOf(entry) : statusKey;
  };

  const save = async () => {
    if (!target || !step) return;
    if ((handlerType === "agent" || handlerType === "member") && !handlerId) {
      toast.error(handlerType === "agent" ? t("Workflows.59") : t("Workflows.60"));
      return;
    }
    setBusy(true);
    const handler =
      handlerType === "none"
        ? { type: "none" }
        : handlerType === "project_lead"
          ? { type: "project_lead" }
          : { type: handlerType, id: handlerId };
    const result = await api({
      method: "PUT",
      path: `/api/issue-workflows/${target.workflow.id}/handoffs/${step.status_key}`,
      body: {
        handler,
        instructions: instructions.trim(),
        next_status_key: nextKey,
        back_status_key: backKey,
      },
    });
    setBusy(false);
    if (result.ok) {
      toast.show(t("Workflows.61"), { variant: "success" });
      onSaved();
    } else toast.error(result.error ?? t("AgentDetail.64"));
  };

  return (
    <Modal
      title={status ? t("Workflows.63", { a: status.name || status.key }) : t("Workflows.64")}
      icon={<Icon name="ListChecks" size={16} color={ui.c.muted} />}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Content>
        <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("Workflows.65")}</Text>
            <Select<HandlerType> ui={ui} options={HANDLER_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))} value={handlerType} onChange={setHandlerType} searchable={false} />
          </View>

          {handlerType === "agent" ? (
            <View style={{ gap: 6 }}>
              <Text style={ui.s.label}>{t("Chat.26")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {agents.length === 0 ? (
                  <Text style={ui.s.tiny}>{t("Workflows.67")}</Text>
                ) : (
                  <Select
                    ui={ui}
                    value={handlerId || null}
                    placeholder={t("Chat.26")}
                    onChange={setHandlerId}
                    options={agents.map((agent) => ({ value: agent.id, label: agent.name, icon: "Bot" }))}
                  />
                )}
              </View>
            </View>
          ) : null}

          {handlerType === "member" ? (
            <View style={{ gap: 6 }}>
              <Text style={ui.s.label}>{t("Workflows.68")}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {members.length === 0 ? (
                  <Text style={ui.s.tiny}>{t("Workflows.69")}</Text>
                ) : (
                  <Select
                    ui={ui}
                    value={handlerId || null}
                    placeholder={t("Workflows.68")}
                    onChange={setHandlerId}
                    options={members.map((member) => ({ value: member.userId || member.id, label: member.name, icon: "User" }))}
                  />
                )}
              </View>
            </View>
          ) : null}

          <Field
            ui={ui}
            label={t("Workflows.70")}
            value={instructions}
            onChangeText={setInstructions}
            placeholder={t("Workflows.71")}
            multiline
            hint={t("Workflows.72")}
          />

          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("Workflows.73")}</Text>
            <Select
              ui={ui}
              value={nextKey ?? ""}
              onChange={(next) => setNextKey(next || null)}
              searchable={false}
              options={[{ value: "", label: t("Workflows.74") }, ...otherKeys.map((statusKey) => ({ value: statusKey, label: statusLabel(statusKey) }))]}
            />
          </View>

          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("Workflows.75")}</Text>
            <Select
              ui={ui}
              value={backKey ?? ""}
              onChange={(next) => setBackKey(next || null)}
              searchable={false}
              options={[{ value: "", label: t("Workflows.74") }, ...otherKeys.map((statusKey) => ({ value: statusKey, label: statusLabel(statusKey) }))]}
            />
          </View>

          <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8, paddingTop: 4 }]}>
            <Btn ui={ui} label={t("AgentDetail.40")} onPress={onClose} />
            <Btn ui={ui} label={t("AgentDetail.72")} icon="Check" tone="primary" busy={busy} onPress={() => void save()} />
          </View>
        </ScrollView>
      </Modal.Content>
    </Modal>
  );
}

function StatusSetModal({
  workflow,
  statuses,
  onClose,
  onSaved,
  toast,
}: {
  workflow: Workflow | null;
  statuses: IssueStatusEntry[];
  onClose(): void;
  onSaved(): void;
  toast: ReturnType<typeof useWorkbench>["toast"];
}) {
  const { theme, compact, api } = useWorkbench();
  const ui = useUi(theme, compact);
  const [picked, setPicked] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!workflow) return;
    setPicked((workflow.steps ?? []).map((step) => step.status_key));
  }, [workflow]);

  const save = async () => {
    if (!workflow) return;
    const kept = new Map((workflow.steps ?? []).map((step) => [step.status_key, step]));
    setBusy(true);
    const patch = await api({
      method: "PATCH",
      path: `/api/issue-workflows/${workflow.id}`,
      body: { steps: picked.map((statusKey) => ({ status_key: statusKey })) },
    });
    if (!patch.ok) {
      setBusy(false);
      toast.error(patch.error ?? t("AgentDetail.64"));
      return;
    }
    const restore = picked
      .map((statusKey) => kept.get(statusKey))
      .filter(
        (step): step is WorkflowStep =>
          Boolean(
            step &&
              ((step.handler && step.handler.type !== "none") ||
                step.instructions?.trim() ||
                step.next_status_key ||
                step.back_status_key),
          ),
      );
    for (const step of restore) {
      await api({
        method: "PUT",
        path: `/api/issue-workflows/${workflow.id}/handoffs/${step.status_key}`,
        body: {
          handler: step.handler ?? { type: "none" },
          instructions: step.instructions ?? "",
          next_status_key: step.next_status_key ?? null,
          back_status_key: step.back_status_key ?? null,
        },
      });
    }
    setBusy(false);
    toast.show(t("Workflows.80", { a: picked.length }), { variant: "success" });
    onSaved();
  };

  return (
    <Modal
      title={workflow ? t("Workflows.81", { a: workflow.name }) : t("Workflows.82")}
      icon={<Icon name="ListChecks" size={16} color={ui.c.muted} />}
      open={Boolean(workflow)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Content>
        <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 12 }}>
          <Text style={ui.s.tiny}>
            {t("Workflows.83")}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {statuses.map((status) => (
              <ToggleChip
                key={status.key}
                ui={ui}
                label={status.name || status.key}
                color={status.color}
                active={picked.includes(status.key)}
                onPress={() =>
                  setPicked((value) =>
                    value.includes(status.key)
                      ? value.filter((entry) => entry !== status.key)
                      : [...value, status.key],
                  )
                }
              />
            ))}
          </View>
          <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8, paddingTop: 4 }]}>
            <Btn ui={ui} label={t("AgentDetail.40")} onPress={onClose} />
            <Btn ui={ui} label={t("AgentDetail.72")} icon="Check" tone="primary" busy={busy} onPress={() => void save()} />
          </View>
        </ScrollView>
      </Modal.Content>
    </Modal>
  );
}

function ToggleChip({
  ui,
  label,
  active,
  color,
  onPress,
}: {
  ui: ReturnType<typeof useUi>;
  label: string;
  active: boolean;
  color?: string;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [ui.s.chip, active && ui.s.chipActive, pressed && ui.s.pressed]}
    >
      {color ? <Dot color={color} size={6} /> : null}
      <Text style={[ui.s.chipText, active && ui.s.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}
