import { t } from "../i18n";
import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Btn, Card, Chips, Divider, Empty, ErrorNote, Field, IconBtn, LoadingRow, LoadMore, nearBottom, Tag, useUi , Select } from "../bits";
import { usePagedQuery } from "../api";
import { useWorkbench } from "../context";
import { pickTextColor, relTime, type Label } from "../model";

const COLORS = ["#3b82f6", "#8b5cf6", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#64748b", "#a855f7", "#f97316"];

type KindFilter = "all" | "issue" | "agent";

const KIND_OPTIONS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "ApiExplorer.4" },
  { value: "issue", label: "Labels.2" },
  { value: "agent", label: "Labels.3" },
];

export function LabelsPage() {
  const ctx = useWorkbench();
  const { theme, compact, api, bump, workspaceId, toast, invalidate } = ctx;
  const ui = useUi(theme, compact);
  const key = `${workspaceId}:${bump}`;
  const [kind, setKind] = useState<KindFilter>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Label | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Label | null>(null);
  const [busy, setBusy] = useState(false);

  const labelsQuery = usePagedQuery<Label>(api, "/api/labels", { pageSize: 50 }, key, "labels");
  const labels = labelsQuery.items;
  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const label of labels) map[label.resource_type ?? "issue"] = (map[label.resource_type ?? "issue"] ?? 0) + 1;
    return map;
  }, [labels]);
  const needle = search.trim().toLowerCase();
  const filtered = labels.filter((label) => {
    if (kind !== "all" && (label.resource_type ?? "issue") !== kind) return false;
    return !needle || `${label.name} ${label.description ?? ""}`.toLowerCase().includes(needle);
  });

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    const result = await api({ method: "DELETE", path: `/api/labels/${confirmDelete.id}` });
    setBusy(false);
    if (result.ok) {
      toast.show(t("Labels.4"), { variant: "success" });
      setConfirmDelete(null);
      labelsQuery.refresh();
      invalidate();
    } else toast.error(result.error ?? t("Automation.15"));
  };

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerStyle={{ padding: compact ? 12 : 18, gap: 12, paddingBottom: 48 }}
        onScroll={(e) => {
          if (nearBottom(e)) labelsQuery.loadMore();
        }}
        scrollEventThrottle={200}
      >
        <View style={[ui.s.row, { gap: 10 }]}>
          <View style={ui.s.grow}>
            <Text style={[ui.s.title, { fontSize: compact ? 18 : 21 }]}>{t("AgentDetail.5")}</Text>
            <Text style={ui.s.muted}>
              {t("Inbox.40")} {labelsQuery.total} {t("Labels.8")} {counts.issue ?? 0} {t("Labels.9")} {counts.agent ?? 0}
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

        <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
          <Chips<KindFilter> ui={ui} options={KIND_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))} value={kind} onChange={setKind} />
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
            placeholder={t("Labels.11")}
            placeholderTextColor={ui.c.muted}
            style={{ flex: 1, color: ui.c.fg, fontSize: 13, paddingVertical: 8 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>

        <Card ui={ui} padded={false}>
          {labelsQuery.loading && labels.length === 0 ? (
            <LoadingRow ui={ui} />
          ) : labelsQuery.error ? (
            <View style={{ padding: 14 }}>
              <ErrorNote ui={ui} message={labelsQuery.error} onRetry={labelsQuery.refresh} />
            </View>
          ) : filtered.length === 0 ? (
            <Empty
              ui={ui}
              icon="Tags"
              title={needle || kind !== "all" ? t("Labels.12") : t("Labels.13")}
              description={t("Labels.14")}
              action={
                <Btn
                  ui={ui}
                  label={t("Labels.15")}
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
              {filtered.map((label, index) => (
                <View key={label.id}>
                  {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 14 }} /> : null}
                  <View style={[ui.s.listRow, { alignItems: "flex-start" }]}>
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        marginTop: 1,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: `${label.color || "#64748b"}22`,
                      }}
                    >
                      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: label.color || "#64748b" }} />
                    </View>
                    <View style={{ flex: 1, gap: 3 }}>
                      <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
                        <Text numberOfLines={1} style={[ui.s.body, { fontWeight: "600" }]}>
                          {label.name}
                        </Text>
                        <Tag ui={ui} label={label.resource_type === "agent" ? t("AgentDetail.23") : t("Labels.17")} tone="muted" />
                      </View>
                      {label.description ? (
                        <Text numberOfLines={2} style={ui.s.tiny}>
                          {label.description}
                        </Text>
                      ) : null}
                      <Text style={ui.s.tiny}>
                        {t("Labels.18")} {label.usage_count ?? 0} {t("Labels.19")} {relTime(label.updated_at ?? label.created_at)}
                      </Text>
                    </View>
                    <View style={[ui.s.row, { gap: 2 }]}>
                      <IconBtn
                        ui={ui}
                        icon="Pencil"
                        label={t("Labels.20", { a: label.name })}
                        onPress={() => {
                          setEditing(label);
                          setFormOpen(true);
                        }}
                      />
                      <IconBtn
                        ui={ui}
                        icon="Trash2"
                        label={t("Labels.21", { a: label.name })}
                        color={ui.c.danger}
                        onPress={() => setConfirmDelete(label)}
                      />
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
        <LoadMore
          ui={ui}
          loaded={labels.length}
          total={labelsQuery.total}
          hasMore={labelsQuery.hasMore}
          loadingMore={labelsQuery.loadingMore}
          loading={labelsQuery.loading}
          onLoadMore={labelsQuery.loadMore}
        />

        {labelsQuery.loadingMore ? <Text style={[ui.s.tiny, { textAlign: "center" }]}>{t("Labels.22")}</Text> : null}
      </ScrollView>

      <LabelFormModal
        open={formOpen}
        label={editing}
        defaultKind={kind === "all" ? "issue" : kind}
        onClose={() => setFormOpen(false)}
        onSaved={() => {
          setFormOpen(false);
          labelsQuery.refresh();
          invalidate();
        }}
        toast={toast}
      />

      <Modal
        title={t("Labels.23")}
        icon={<Icon name="TriangleAlert" size={16} color={ui.c.danger} />}
        open={Boolean(confirmDelete)}
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(null);
        }}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>
              {t("Labels.24")}{confirmDelete?.name}{t("Labels.25")} {confirmDelete?.usage_count ?? 0} {t("Labels.26")}
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

function LabelFormModal({
  open,
  label,
  defaultKind,
  onClose,
  onSaved,
  toast,
}: {
  open: boolean;
  label: Label | null;
  defaultKind: "issue" | "agent";
  onClose(): void;
  onSaved(): void;
  toast: ReturnType<typeof useWorkbench>["toast"];
}) {
  const { theme, compact, api } = useWorkbench();
  const ui = useUi(theme, compact);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [kind, setKind] = useState<"issue" | "agent">(defaultKind);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(label?.name ?? "");
    setDescription(label?.description ?? "");
    setColor(label?.color ?? COLORS[0]);
    setKind(label?.resource_type === "agent" ? "agent" : "issue");
  }, [open, label]);

  const submit = async () => {
    if (!name.trim()) {
      toast.error(t("Labels.29"));
      return;
    }
    setBusy(true);
    const body: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      color,
      resource_type: kind,
    };
    const result = label
      ? await api({ method: "PUT", path: `/api/labels/${label.id}`, body })
      : await api({ method: "POST", path: "/api/labels", body });
    setBusy(false);
    if (result.ok) {
      toast.show(label ? t("Labels.30") : t("Labels.31"), { variant: "success" });
      onSaved();
    } else toast.error(result.error ?? t("AgentDetail.64"));
  };

  return (
    <Modal
      title={label ? t("Labels.33") : t("Labels.15")}
      icon={<Icon name="Tags" size={16} color={ui.c.muted} />}
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Modal.Content>
        <View style={{ gap: 12 }}>
          <Field ui={ui} label={t("AgentDetail.95")} value={name} onChangeText={setName} placeholder={t("Labels.36")} autoFocus />
          <Field
            ui={ui}
            label={t("AgentDetail.97")}
            value={description}
            onChangeText={setDescription}
            placeholder={t("Labels.38")}
          />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("Labels.39")}</Text>
            <Select<"issue" | "agent">
              ui={ui}
              searchable={false}
              options={[
                { value: "issue", label: t("Labels.17"), icon: "ListTodo" },
                { value: "agent", label: t("AgentDetail.23"), icon: "Bot" },
              ]}
              value={kind}
              onChange={setKind}
            />
          </View>
          <View style={{ gap: 8 }}>
            <Text style={ui.s.label}>{t("Labels.42")}</Text>
            <Select
              ui={ui}
              value={COLORS.includes(color) ? color : null}
              placeholder={t("Labels.44")}
              searchable={false}
              onChange={setColor}
              options={COLORS.map((entry) => ({ value: entry, label: entry, color: entry }))}
            />
            <View style={[ui.s.row, { gap: 8 }]}>
              <View style={{ width: 120 }}>
                <Field ui={ui} label={t("Labels.44")} value={color} onChangeText={setColor} placeholder="#3b82f6" code />
              </View>
              <View style={{ paddingTop: 18 }}>
                <Tag ui={ui} label={name.trim() || t("Labels.45")} color={color} />
              </View>
            </View>
          </View>
          <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8, paddingTop: 4 }]}>
            <Btn ui={ui} label={t("AgentDetail.40")} onPress={onClose} />
            <Btn ui={ui} label={label ? t("AgentDetail.72") : t("Labels.48")} icon="Check" tone="primary" busy={busy} onPress={() => void submit()} />
          </View>
        </View>
      </Modal.Content>
    </Modal>
  );
}
