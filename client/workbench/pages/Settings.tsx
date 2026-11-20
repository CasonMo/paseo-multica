import { t } from "../i18n";
import { Icon, Modal, copyText, useToast } from "@getpaseo/plugin/client/ui";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRpc } from "@getpaseo/plugin/client";
import { API_ROUTES, isInternalRoute } from "../../../shared/routes";
import { PLUGIN_VERSION } from "../../../shared/version";
import {
  OFFICIAL_BASE_URL,
  OFFICIAL_WEB_URL,
  connectionsActivateRpc,
  connectionsRemoveRpc,
  connectionsSaveRpc,
  connectionsTestRpc,
  preferencesSaveRpc,
  type ConnectionTestOutput,
  type ServerView,
} from "../../../shared/contracts";
import { Avatar, Btn, Card, Chips, Divider, Empty, ErrorNote, Field, Tag, useUi } from "../bits";
import { useWorkbench } from "../context";
import { relTime } from "../model";
import { AccountSettings, WorkspaceMembersSettings } from "../SettingsSections";
import { ApiExplorerPage } from "./ApiExplorer";
import { openExternalUrl } from "@getpaseo/plugin/client";

export function SettingsPage({ initialTab }: { initialTab?: "connection" | "workspace" | "account" | "api" }) {
  const ctx = useWorkbench();
  const { theme, compact, connections, server, servers, user, workspaces, workspaceId, toast, locale } = ctx;
  const ui = useUi(theme, compact);
  const saveRpc = useRpc(connectionsSaveRpc);
  const removeRpc = useRpc(connectionsRemoveRpc);
  const activateRpc = useRpc(connectionsActivateRpc);
  const testRpc = useRpc(connectionsTestRpc);
  const prefRpc = useRpc(preferencesSaveRpc);

  const [tab, setTab] = useState<"connection" | "workspace" | "account" | "api">(initialTab ?? "connection");
  const [editing, setEditing] = useState<ServerView | "new" | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<ServerView | null>(null);
  const [allowInternalBusy, setAllowInternalBusy] = useState(false);

  const afterChange = async (message?: string) => {
    await ctx.reloadBootstrap();
    await ctx.reloadConnections();
    ctx.invalidate();
    if (message) toast.show(message, { variant: "success" });
  };

  const activate = async (item: ServerView) => {
    setBusyId(item.id);
    try {
      await activateRpc({ id: item.id });
      await afterChange(t("context.2", { a: item.name }));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (item: ServerView) => {
    setConfirmRemove(null);
    setBusyId(item.id);
    try {
      await removeRpc({ id: item.id });
      await afterChange(t("Settings.2"));
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusyId(null);
    }
  };

  const toggleInternal = async () => {
    if (!connections) return;
    setAllowInternalBusy(true);
    try {
      await prefRpc({ allowInternal: !connections.allowInternal });
      await ctx.reloadConnections();
      toast.show(connections.allowInternal ? t("Settings.3") : t("Settings.4"), { variant: "success" });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setAllowInternalBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={{ paddingHorizontal: compact ? 12 : 20, paddingTop: compact ? 12 : 20, gap: 14 }}>
        <View>
          <Text style={ui.s.title}>{t("Nav.15")}</Text>
          <Text style={ui.s.muted}>{t("Settings.6")}{PLUGIN_VERSION} · {locale}</Text>
        </View>

        {ctx.bootstrapError && server ? <ErrorNote ui={ui} message={ctx.bootstrapError} onRetry={() => void ctx.reloadBootstrap()} /> : null}

        <Chips
          ui={ui}
          options={[
            { value: "connection", label: t("Settings.7"), icon: "Plug" },
            { value: "workspace", label: t("Nav.47"), icon: "Users" },
            { value: "api", label: t("Nav.48"), icon: "Terminal" },
            { value: "account", label: t("Nav.16"), icon: "User" },
          ] as const}
          value={tab}
          onChange={(next) => setTab(next as typeof tab)}
        />
      </View>

      {tab === "api" ? (
        <View style={{ flex: 1, minHeight: 0 }}>
          <ApiExplorerPage />
        </View>
      ) : (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: compact ? 12 : 20, paddingTop: 14, gap: 14 }}>

      {tab === "connection" ? (
      <Card ui={ui} style={{ gap: 10 }}>
        <View style={[ui.s.row, { justifyContent: "space-between" }]}>
          <View style={{ gap: 2 }}>
            <Text style={ui.s.h2}>{t("Nav.46")}</Text>
            <Text style={ui.s.tiny}>{t("Settings.12")}</Text>
          </View>
          <Btn ui={ui} label={t("IssueDetail.51")} icon="Plus" tone="primary" onPress={() => setEditing("new")} />
        </View>

        {servers.length === 0 ? (
          <Empty
            ui={ui}
            icon="ServerOff"
            title={t("Settings.14")}
            description={t("Settings.15")}
            action={<Btn ui={ui} label={t("Settings.16")} icon="Cloud" tone="primary" onPress={() => setEditing("new")} />}
          />
        ) : (
          servers.map((item) => {
            const active = item.id === (connections?.activeServerId ?? "");
            return (
              <View
                key={item.id}
                style={{
                  borderRadius: 11,
                  borderWidth: 1,
                  borderColor: active ? `${ui.c.accent}77` : ui.c.border,
                  backgroundColor: active ? `${ui.c.accent}0d` : ui.c.surface0,
                  padding: 11,
                  gap: 8,
                }}
              >
                <View style={[ui.s.rowTop, { gap: 9 }]}>
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 9,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: active ? ui.c.accent : ui.c.surface2,
                    }}
                  >
                    <Icon name={item.isOfficial ? "Cloud" : "Server"} size={16} color={active ? ui.c.accentFg : ui.c.muted} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <View style={[ui.s.row, { gap: 6 }]}>
                      <Text numberOfLines={1} style={[ui.s.body, { fontWeight: "700" }]}>
                        {item.name}
                      </Text>
                      {active ? <Tag ui={ui} label={t("Settings.17")} tone="success" /> : null}
                      {item.isOfficial ? <Tag ui={ui} label={t("Settings.18")} tone="accent" /> : null}
                    </View>
                    <Text numberOfLines={1} style={[ui.s.tiny, { fontFamily: "Menlo" }]}>
                      {item.baseUrl}
                    </Text>
                    <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
                      <Text style={ui.s.tiny}>
                        {item.tokenConfigured ? `Key ${item.tokenMasked}` : t("Settings.19")}
                      </Text>
                      {item.workspaceSlug ? <Text style={ui.s.tiny}>{t("Nav.47")} {item.workspaceSlug}</Text> : null}
                      <Text style={ui.s.tiny}>{t("Projects.48")} {relTime(item.updatedAt)}</Text>
                    </View>
                  </View>
                </View>
                <View style={[ui.s.row, { gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }]}>
                  {!active ? (
                    <Btn ui={ui} label={t("Settings.22")} busy={busyId === item.id} onPress={() => void activate(item)} />
                  ) : null}
                  <Btn ui={ui} label={t("AgentDetail.33")} icon="Pencil" onPress={() => setEditing(item)} />
                  <Btn ui={ui} label={t("SquadDetail.21")} icon="Trash2" tone="danger" onPress={() => setConfirmRemove(item)} />
                </View>
              </View>
            );
          })
        )}
      </Card>
      ) : null}

      {tab === "workspace" ? (
      <>
      {server ? (
        <Card ui={ui} style={{ gap: 10 }}>
          <View style={{ gap: 2 }}>
            <Text style={ui.s.h2}>{t("Nav.47")}</Text>
            <Text style={ui.s.tiny}>{t("Settings.26")}</Text>
          </View>
          {workspaces.length === 0 ? (
            <Empty ui={ui} icon="Layers" title={t("Shell.2")} description={t("Settings.28")} />
          ) : (
            <View style={{ gap: 6 }}>
              {workspaces.map((workspace) => {
                const active = workspace.id === workspaceId;
                return (
                  <Pressable
                    accessibilityRole="button"
                    key={workspace.id}
                    onPress={() => !active && void ctx.selectWorkspace(workspace.id)}
                    style={({ pressed }) => [
                      ui.s.row,
                      {
                        gap: 9,
                        padding: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: active ? ui.c.accent : ui.c.border,
                        backgroundColor: active ? `${ui.c.accent}0d` : ui.c.surface0,
                      },
                      pressed && ui.s.pressed,
                    ]}
                  >
                    <Avatar ui={ui} name={workspace.name} url={workspace.avatar_url} size={28} />
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
              })}
            </View>
          )}
        </Card>
      ) : null}
      <WorkspaceMembersSettings />
      </>
      ) : null}

      {tab === "account" ? <AccountSettings /> : null}

      {tab === "connection" ? (
      <>
      <Card ui={ui} style={{ gap: 10 }}>
        <Text style={ui.s.h2}>{t("Settings.29")}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void toggleInternal()}
          disabled={allowInternalBusy}
          style={({ pressed }) => [ui.s.row, { gap: 10, paddingVertical: 4 }, pressed && ui.s.pressed]}
        >
          <Icon name="ShieldAlert" size={17} color={connections?.allowInternal ? ui.c.warning : ui.c.muted} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[ui.s.body, { fontWeight: "600" }]}>{t("Settings.30")}</Text>
            <Text style={ui.s.tiny}>{t("Settings.31")}</Text>
          </View>
          <View
            style={{
              width: 40,
              height: 23,
              borderRadius: 12,
              padding: 2,
              alignItems: connections?.allowInternal ? "flex-end" : "flex-start",
              backgroundColor: connections?.allowInternal ? ui.c.accent : ui.c.surface2,
            }}
          >
            <View style={{ width: 19, height: 19, borderRadius: 10, backgroundColor: connections?.allowInternal ? ui.c.accentFg : ui.c.muted }} />
          </View>
        </Pressable>
        <Divider ui={ui} />
        <View style={{ gap: 4 }}>
          <Text style={ui.s.tiny}>{t("Settings.32")}</Text>
          <Text selectable style={[ui.s.tiny, { fontFamily: "Menlo" }]}>
            {connections?.storePath ?? "—"}
          </Text>
          <Btn
            ui={ui}
            label={t("Settings.33")}
            icon="Copy"
            onPress={async () => {
              if (!connections?.storePath) return;
              await copyText(connections.storePath);
              toast.show(t("Settings.34"), { variant: "success" });
            }}
          />
        </View>
      </Card>

      <Card ui={ui} style={{ gap: 8 }}>
        <Text style={ui.s.h2}>{t("Settings.35")}</Text>
        <Text style={ui.s.muted}>
          {t("Settings.36")}
        </Text>
        {user ? (
          <View style={[ui.s.row, { gap: 8, paddingVertical: 4 }]}>
            <Avatar ui={ui} name={user.name} url={user.avatar_url} size={26} />
            <View style={{ flex: 1 }}>
              <Text style={ui.s.body}>{user.name}</Text>
              <Text style={ui.s.tiny}>{user.email}</Text>
            </View>
          </View>
        ) : null}
        <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
          <Btn ui={ui} label={t("Settings.37")} icon="Globe" onPress={() => void openExternalUrl(OFFICIAL_WEB_URL)} />
          <Btn ui={ui} label={t("Settings.38")} icon="BookOpen" onPress={() => void openExternalUrl(`${OFFICIAL_WEB_URL}/docs`)} />
          <Btn ui={ui} label={t("Settings.39")} icon="Terminal" onPress={() => setTab("api")} />
        </View>
        <Text style={ui.s.tiny}>
          {t("Settings.40")} {API_ROUTES.filter((route) => !isInternalRoute(route[1]) || connections?.allowInternal).length} {t("Settings.41")}
        </Text>
      </Card>
      </>
      ) : null}
      </ScrollView>
      )}

      <ConnectionModal
        ui={ui}
        target={editing}
        onClose={() => setEditing(null)}
        onSave={async (input) => {
          try {
            await saveRpc(input);
            setEditing(null);
            await afterChange(t("Settings.42"));
            return null;
          } catch (cause) {
            return cause instanceof Error ? cause.message : String(cause);
          }
        }}
        onTest={(input) => testRpc(input)}
      />

      <Modal
        title={t("Settings.43")}
        icon={<Icon name="Trash2" size={16} color={ui.c.danger} />}
        open={Boolean(confirmRemove)}
        onOpenChange={(next) => !next && setConfirmRemove(null)}
      >
        <Modal.Content>
          <Text style={ui.s.body}>{t("Automation.48")}{confirmRemove?.name}{t("Settings.45")}</Text>
          <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
            <Btn ui={ui} label={t("AgentDetail.40")} onPress={() => setConfirmRemove(null)} />
            <Btn ui={ui} label={t("SquadDetail.21")} tone="danger" onPress={() => confirmRemove && void remove(confirmRemove)} />
          </View>
        </Modal.Content>
      </Modal>
    </View>
  );
}


function ConnectionModal({
  ui,
  target,
  onClose,
  onSave,
  onTest,
}: {
  ui: ReturnType<typeof useUi>;
  target: ServerView | "new" | null;
  onClose(): void;
  onSave(input: { id?: string; name: string; baseUrl: string; token?: string; workspaceId?: string | null }): Promise<string | null>;
  onTest(input: { baseUrl?: string; token?: string; id?: string }): Promise<ConnectionTestOutput>;
}) {
  const toast = useToast();
  const existing = target && target !== "new" ? target : null;
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState(OFFICIAL_BASE_URL);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ConnectionTestOutput | null>(null);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const targetKey = target ? (target === "new" ? "new" : target.id) : null;

  useEffect(() => {
    setName(existing?.name ?? t("Settings.48"));
    setBaseUrl(existing?.baseUrl ?? OFFICIAL_BASE_URL);
    setToken("");
    setError(null);
    setResult(null);
    setWorkspaceId(existing?.workspaceId ?? null);
    // Re-hydrate only when the modal opens for a different server.
     
  }, [targetKey]);

  return (
    <Modal
      title={existing ? t("Settings.49") : t("Settings.50")}
      icon={<Icon name="Plug" size={16} color={ui.c.muted} />}
      open={Boolean(target)}
      onOpenChange={(next) => !next && onClose()}
    >
      <Modal.Content>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 12 }}>
          <Field ui={ui} label={t("AgentDetail.95")} value={name} onChangeText={setName} placeholder={t("Settings.52")} />
          <Field
            ui={ui}
            label={t("Settings.53")}
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="https://api.multica.ai"
            hint={t("Settings.54")}
            code
          />
          <Field
            ui={ui}
            label="API Key"
            value={token}
            onChangeText={setToken}
            placeholder={existing?.tokenConfigured ? t("Settings.55", { a: existing.tokenMasked }) : "mul_…"}
            secureTextEntry
            hint={t("Settings.56")}
          />

          <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
            <Btn
              ui={ui}
              label={t("Settings.57")}
              icon="Activity"
              busy={testing}
              onPress={async () => {
                setTesting(true);
                setError(null);
                try {
                  const next = await onTest({
                    baseUrl: baseUrl.trim(),
                    token: token.trim() || undefined,
                    id: existing?.id,
                  });
                  setResult(next);
                  if (!next.ok) setError(next.error ?? t("Settings.58"));
                  else {
                    setWorkspaceId(next.workspaces?.[0]?.id ?? workspaceId);
                    toast.show(t("Settings.59", { a: next.workspaces?.length ?? 0 }), { variant: "success" });
                  }
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : String(cause));
                } finally {
                  setTesting(false);
                }
              }}
            />
            {existing?.isOfficial || baseUrl.includes("multica.ai") ? (
              <Btn ui={ui} label={t("Settings.60")} icon="Cloud" onPress={() => setBaseUrl(OFFICIAL_BASE_URL)} />
            ) : null}
          </View>

          {error ? <ErrorNote ui={ui} message={error} /> : null}

          {result?.ok ? (
            <View style={{ gap: 8 }}>
              {result.user ? (
                <View style={[ui.s.row, { gap: 8 }]}>
                  <Avatar ui={ui} name={result.user.name} url={result.user.avatar_url} size={26} />
                  <View style={{ flex: 1 }}>
                    <Text style={ui.s.body}>{result.user.name}</Text>
                    <Text style={ui.s.tiny}>{result.user.email}</Text>
                  </View>
                  <Tag ui={ui} label={t("Settings.61")} tone="success" icon="Check" />
                </View>
              ) : null}
              {(result.workspaces ?? []).length > 0 ? (
                <View style={{ gap: 6 }}>
                  <Text style={ui.s.label}>{t("Settings.62")}</Text>
                  {(result.workspaces ?? []).map((workspace) => {
                    const active = workspaceId === workspace.id;
                    return (
                      <Pressable
                        accessibilityRole="button"
                        key={workspace.id}
                        onPress={() => setWorkspaceId(workspace.id)}
                        style={({ pressed }) => [
                          ui.s.row,
                          {
                            gap: 8,
                            padding: 9,
                            borderRadius: 9,
                            borderWidth: 1,
                            borderColor: active ? ui.c.accent : ui.c.border,
                            backgroundColor: active ? `${ui.c.accent}0d` : ui.c.surface0,
                          },
                          pressed && ui.s.pressed,
                        ]}
                      >
                        <Avatar ui={ui} name={workspace.name} url={workspace.avatar_url} size={24} />
                        <Text style={[ui.s.body, { flex: 1 }]}>{workspace.name}</Text>
                        <Text style={ui.s.tiny}>{workspace.slug}</Text>
                        {active ? <Icon name="Check" size={14} color={ui.c.accent} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>

        <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
          <Btn ui={ui} label={t("AgentDetail.40")} onPress={onClose} />
          <Btn
            ui={ui}
            label={t("AgentDetail.72")}
            tone="primary"
            busy={busy}
            onPress={async () => {
              if (!name.trim()) return setError(t("AgentDetail.92"));
              if (!baseUrl.trim()) return setError(t("Settings.66"));
              if (!existing && !token.trim()) return setError(t("Settings.67"));
              setBusy(true);
              setError(null);
              const failure = await onSave({
                id: existing?.id,
                name: name.trim(),
                baseUrl: baseUrl.trim(),
                token: token.trim() || undefined,
                workspaceId: workspaceId ?? undefined,
              });
              setBusy(false);
              if (failure) setError(failure);
            }}
          />
        </View>
      </Modal.Content>
    </Modal>
  );
}
