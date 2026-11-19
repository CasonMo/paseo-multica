import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Btn, Card, Chips, Divider, Dot, Empty, ErrorNote, Field, IconBtn, LoadingRow, Tag, useUi } from "../bits";
import { asList, useQuery } from "../api";
import { useWorkbench } from "../context";
import {
  HANDLER_LABEL,
  relTime,
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
  { value: "none", label: "无处理人" },
  { value: "project_lead", label: "项目负责人" },
  { value: "member", label: "成员" },
  { value: "agent", label: "智能体" },
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

  const workflowsQuery = useQuery(api, "/api/issue-workflows", { select: (data) => asList<Workflow>(data, "workflows") }, key);
  const agentsQuery = useQuery(
    api,
    "/api/agents",
    { query: { limit: 100 }, select: (data) => asList<Agent>(data, "agents") },
    key,
  );
  const membersQuery = useQuery(
    api,
    workspaceId ? `/api/workspaces/${workspaceId}/members` : null,
    { select: (data) => asList<Record<string, unknown>>(data, "members") },
    key,
  );
  const projectsQuery = useQuery(api, "/api/projects", { select: (data) => asList<Project>(data, "projects") }, key);

  const workflowList = workflowsQuery.data ?? [];
  const agentList = agentsQuery.data ?? [];
  const members: Member[] = useMemo(
    () =>
      (membersQuery.data ?? []).map((item) => ({
        id: String(item.id ?? ""),
        userId: String(item.user_id ?? ""),
        name: String(item.name ?? item.email ?? "成员"),
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
  const statusName = (statusKey: string) => statusOf(statusKey)?.name ?? statusKey;

  const handlerText = (handler?: WorkflowHandler | null): string => {
    if (!handler || handler.type === "none") return HANDLER_LABEL.none;
    if (handler.type === "project_lead") return HANDLER_LABEL.project_lead;
    if (handler.type === "agent") {
      const agent = agentList.find((item) => item.id === handler.id);
      return `${HANDLER_LABEL.agent} · ${agent?.name ?? handler.id ?? "未指定"}`;
    }
    if (handler.type === "member") {
      const member = members.find((item) => item.id === handler.id || item.userId === handler.id);
      return `${HANDLER_LABEL.member} · ${member?.name ?? handler.id ?? "未指定"}`;
    }
    return HANDLER_LABEL[handler.type] ?? handler.type;
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    const result = await api({ method: "DELETE", path: `/api/issue-workflows/${confirmDelete.id}` });
    setBusy(false);
    if (result.ok) {
      toast.show("工作流已删除", { variant: "success" });
      setConfirmDelete(null);
      setActiveId(null);
      workflowsQuery.refresh();
      invalidate();
    } else toast.error(result.error ?? "删除失败");
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: compact ? 12 : 18, gap: 12, paddingBottom: 48 }}>
        <View style={[ui.s.row, { gap: 10 }]}>
          <View style={ui.s.grow}>
            <Text style={[ui.s.title, { fontSize: compact ? 18 : 21 }]}>工作流</Text>
            <Text style={ui.s.muted}>
              共 {workflowList.length} 个流程 · 每个状态可指定处理人、指令与流转方向
            </Text>
          </View>
          <Btn
            ui={ui}
            label="新建"
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
            placeholder="搜索工作流…"
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
              title={needle ? "没有匹配的工作流" : "还没有工作流"}
              description="工作流定义需求在每个状态下由谁处理、执行什么指令、下一步流向哪里。"
              action={
                <Btn
                  ui={ui}
                  label="新建工作流"
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
                    accessibilityLabel={`打开工作流 ${workflow.name}`}
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
                        {workflow.is_default ? <Tag ui={ui} label="默认" tone="accent" /> : null}
                      </View>
                      {workflow.description ? (
                        <Text numberOfLines={2} style={ui.s.tiny}>
                          {workflow.description}
                        </Text>
                      ) : null}
                      <Text style={ui.s.tiny}>
                        {workflow.steps?.length ?? 0} 个状态 ·{" "}
                        {workflow.project_ids?.length ? `${workflow.project_ids.length} 个项目绑定` : "未绑定项目"} ·{" "}
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
      </ScrollView>

      <Modal
        title={active ? active.name : "工作流详情"}
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
                {active.is_default ? <Tag ui={ui} label="默认流程" tone="accent" /> : null}
                <Tag ui={ui} label={`${active.steps?.length ?? 0} 个状态`} tone="muted" />
                <View style={ui.s.grow} />
                <IconBtn
                  ui={ui}
                  icon="Pencil"
                  label="编辑流程信息"
                  onPress={() => {
                    setEditing(active);
                    setFormOpen(true);
                  }}
                />
                <IconBtn ui={ui} icon="ListChecks" label="编辑状态集合" onPress={() => setStatusSetFor(active)} />
                <IconBtn
                  ui={ui}
                  icon="Trash2"
                  label="删除工作流"
                  color={ui.c.danger}
                  onPress={() => setConfirmDelete(active)}
                />
              </View>

              {active.description ? <Text style={ui.s.body}>{active.description}</Text> : null}
              <Text style={ui.s.tiny}>
                更新 {relTime(active.updated_at)}
                {active.project_ids?.length
                  ? ` · 绑定项目：${active.project_ids
                      .map((id) => projectList.find((project) => project.id === id)?.title ?? id)
                      .join("、")}`
                  : " · 未绑定项目"}
              </Text>

              <Divider ui={ui} />

              <View style={{ gap: 8 }}>
                {(active.steps ?? []).length === 0 ? (
                  <Empty ui={ui} icon="ListChecks" title="没有状态" description="点击右上角状态集合，选择这个流程包含的状态。" />
                ) : (
                  (active.steps ?? []).map((step) => {
                    const entry = statusOf(step.status_key);
                    const configured =
                      (step.handler && step.handler.type !== "none") || Boolean(step.instructions?.trim());
                    return (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`编辑状态 ${statusName(step.status_key)}`}
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
                            {step.next_status_key && step.back_status_key ? "　" : ""}
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
        title="删除工作流"
        icon={<Icon name="TriangleAlert" size={16} color={ui.c.danger} />}
        open={Boolean(confirmDelete)}
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(null);
        }}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>
              确定删除「{confirmDelete?.name}」？已绑定该流程的项目需要重新选择流程。
            </Text>
            <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8 }]}>
              <Btn ui={ui} label="取消" onPress={() => setConfirmDelete(null)} />
              <Btn ui={ui} label="删除" tone="danger" busy={busy} onPress={() => void remove()} />
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
      toast.error("请填写工作流名称");
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
      toast.show(workflow ? "工作流已更新" : "工作流已创建", { variant: "success" });
      const saved = result.data && typeof result.data === "object" ? (result.data as Workflow) : null;
      onSaved(saved);
    } else toast.error(result.error ?? "保存失败");
  };

  return (
    <Modal
      title={workflow ? "编辑工作流" : "新建工作流"}
      icon={<Icon name="Workflow" size={16} color={ui.c.muted} />}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Content>
        <View style={{ gap: 12 }}>
          <Field ui={ui} label="名称" value={name} onChangeText={setName} placeholder="例如 缺陷修复流程" autoFocus />
          <Field
            ui={ui}
            label="描述"
            value={description}
            onChangeText={setDescription}
            placeholder="这个流程解决什么场景？"
            multiline
          />
          {workflow ? (
            <Text style={ui.s.tiny}>状态集合请在工作流详情里用「编辑状态集合」调整，避免覆盖已配置的处理人。</Text>
          ) : (
            <View style={{ gap: 6 }}>
              <Text style={ui.s.label}>包含状态</Text>
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
              <Text style={ui.s.tiny}>待办、已完成、已取消会默认包含，无需选择。</Text>
            </View>
          )}
          <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8, paddingTop: 4 }]}>
            <Btn ui={ui} label="取消" onPress={onClose} />
            <Btn
              ui={ui}
              label={workflow ? "保存" : "创建工作流"}
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
  const statusLabel = (statusKey: string) => statuses.find((entry) => entry.key === statusKey)?.name ?? statusKey;

  const save = async () => {
    if (!target || !step) return;
    if ((handlerType === "agent" || handlerType === "member") && !handlerId) {
      toast.error(handlerType === "agent" ? "请选择智能体" : "请选择成员");
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
      toast.show("状态配置已保存", { variant: "success" });
      onSaved();
    } else toast.error(result.error ?? "保存失败");
  };

  return (
    <Modal
      title={status ? `状态 · ${status.name || status.key}` : "状态配置"}
      icon={<Icon name="ListChecks" size={16} color={ui.c.muted} />}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Content>
        <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 12 }}>
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>处理人</Text>
            <Chips<HandlerType> ui={ui} options={HANDLER_OPTIONS} value={handlerType} onChange={setHandlerType} />
          </View>

          {handlerType === "agent" ? (
            <View style={{ gap: 6 }}>
              <Text style={ui.s.label}>选择智能体</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {agents.length === 0 ? (
                  <Text style={ui.s.tiny}>这个工作区还没有智能体。</Text>
                ) : (
                  agents.map((agent) => (
                    <ToggleChip
                      key={agent.id}
                      ui={ui}
                      label={agent.name}
                      active={handlerId === agent.id}
                      onPress={() => setHandlerId(agent.id)}
                    />
                  ))
                )}
              </View>
            </View>
          ) : null}

          {handlerType === "member" ? (
            <View style={{ gap: 6 }}>
              <Text style={ui.s.label}>选择成员</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {members.length === 0 ? (
                  <Text style={ui.s.tiny}>没有可选的成员。</Text>
                ) : (
                  members.map((member) => (
                    <ToggleChip
                      key={member.id}
                      ui={ui}
                      label={member.name}
                      active={handlerId === member.id || handlerId === member.userId}
                      onPress={() => setHandlerId(member.userId || member.id)}
                    />
                  ))
                )}
              </View>
            </View>
          ) : null}

          <Field
            ui={ui}
            label="执行指令"
            value={instructions}
            onChangeText={setInstructions}
            placeholder="这个状态该做什么、产出什么、不要做什么…"
            multiline
            hint="指令会随需求进入该状态时交给处理人。"
          />

          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>下一状态</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <ToggleChip ui={ui} label="不设置" active={!nextKey} onPress={() => setNextKey(null)} />
              {otherKeys.map((statusKey) => (
                <ToggleChip
                  key={statusKey}
                  ui={ui}
                  label={statusLabel(statusKey)}
                  active={nextKey === statusKey}
                  onPress={() => setNextKey(statusKey)}
                />
              ))}
            </View>
          </View>

          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>回退状态</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <ToggleChip ui={ui} label="不设置" active={!backKey} onPress={() => setBackKey(null)} />
              {otherKeys.map((statusKey) => (
                <ToggleChip
                  key={statusKey}
                  ui={ui}
                  label={statusLabel(statusKey)}
                  active={backKey === statusKey}
                  onPress={() => setBackKey(statusKey)}
                />
              ))}
            </View>
          </View>

          <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8, paddingTop: 4 }]}>
            <Btn ui={ui} label="取消" onPress={onClose} />
            <Btn ui={ui} label="保存" icon="Check" tone="primary" busy={busy} onPress={() => void save()} />
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
      toast.error(patch.error ?? "保存失败");
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
    toast.show(`已保存 ${picked.length} 个状态`, { variant: "success" });
    onSaved();
  };

  return (
    <Modal
      title={workflow ? `状态集合 · ${workflow.name}` : "状态集合"}
      icon={<Icon name="ListChecks" size={16} color={ui.c.muted} />}
      open={Boolean(workflow)}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Content>
        <ScrollView style={{ maxHeight: 560 }} contentContainerStyle={{ gap: 12 }}>
          <Text style={ui.s.tiny}>
            选择这个流程包含的状态。保存会重建状态集合，已保留状态的处理人与指令会自动恢复。
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
            <Btn ui={ui} label="取消" onPress={onClose} />
            <Btn ui={ui} label="保存" icon="Check" tone="primary" busy={busy} onPress={() => void save()} />
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
