import { Icon, Modal, copyText, useToast } from "@getpaseo/plugin/client/ui";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useRpc } from "@getpaseo/plugin/client";
import { API_ROUTES, isInternalRoute } from "../../../shared/routes";
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
import { openExternalUrl } from "@getpaseo/plugin/client";

export function SettingsPage({ initialTab }: { initialTab?: "connection" | "workspace" | "account" }) {
  const ctx = useWorkbench();
  const { theme, compact, connections, server, servers, user, workspaces, workspaceId, toast } = ctx;
  const ui = useUi(theme, compact);
  const saveRpc = useRpc(connectionsSaveRpc);
  const removeRpc = useRpc(connectionsRemoveRpc);
  const activateRpc = useRpc(connectionsActivateRpc);
  const testRpc = useRpc(connectionsTestRpc);
  const prefRpc = useRpc(preferencesSaveRpc);

  const [tab, setTab] = useState<"connection" | "workspace" | "account">(initialTab ?? "connection");
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
      await afterChange(`已切换到 ${item.name}`);
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
      await afterChange("连接已删除");
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
      toast.show(connections.allowInternal ? "已隐藏内部接口" : "已显示内部接口", { variant: "success" });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setAllowInternalBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: compact ? 12 : 20, gap: 14 }}>
      <View>
        <Text style={ui.s.title}>设置</Text>
        <Text style={ui.s.muted}>服务器连接、工作区与安全选项</Text>
      </View>

      {ctx.bootstrapError && server ? <ErrorNote ui={ui} message={ctx.bootstrapError} onRetry={() => void ctx.reloadBootstrap()} /> : null}

      <Chips
        ui={ui}
        options={[
          { value: "connection", label: "连接", icon: "Plug" },
          { value: "workspace", label: "工作区", icon: "Users" },
          { value: "account", label: "账户", icon: "User" },
        ] as const}
        value={tab}
        onChange={(next) => setTab(next as typeof tab)}
      />

      {tab === "connection" ? (
      <Card ui={ui} style={{ gap: 10 }}>
        <View style={[ui.s.row, { justifyContent: "space-between" }]}>
          <View style={{ gap: 2 }}>
            <Text style={ui.s.h2}>服务器连接</Text>
            <Text style={ui.s.tiny}>API Key 仅保存在本机 Paseo 后台，不会发送到客户端。</Text>
          </View>
          <Btn ui={ui} label="添加" icon="Plus" tone="primary" onPress={() => setEditing("new")} />
        </View>

        {servers.length === 0 ? (
          <Empty
            ui={ui}
            icon="ServerOff"
            title="还没有连接"
            description="连接官方 Multica 云，或填写自建服务器地址。"
            action={<Btn ui={ui} label="连接官方云" icon="Cloud" tone="primary" onPress={() => setEditing("new")} />}
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
                      {active ? <Tag ui={ui} label="当前" tone="success" /> : null}
                      {item.isOfficial ? <Tag ui={ui} label="官方" tone="accent" /> : null}
                    </View>
                    <Text numberOfLines={1} style={[ui.s.tiny, { fontFamily: "Menlo" }]}>
                      {item.baseUrl}
                    </Text>
                    <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
                      <Text style={ui.s.tiny}>
                        {item.tokenConfigured ? `Key ${item.tokenMasked}` : "未配置 Key"}
                      </Text>
                      {item.workspaceSlug ? <Text style={ui.s.tiny}>工作区 {item.workspaceSlug}</Text> : null}
                      <Text style={ui.s.tiny}>更新 {relTime(item.updatedAt)}</Text>
                    </View>
                  </View>
                </View>
                <View style={[ui.s.row, { gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }]}>
                  {!active ? (
                    <Btn ui={ui} label="启用" busy={busyId === item.id} onPress={() => void activate(item)} />
                  ) : null}
                  <Btn ui={ui} label="编辑" icon="Pencil" onPress={() => setEditing(item)} />
                  <Btn ui={ui} label="删除" icon="Trash2" tone="danger" onPress={() => setConfirmRemove(item)} />
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
            <Text style={ui.s.h2}>工作区</Text>
            <Text style={ui.s.tiny}>当前连接下的工作区，切换后所有页面会按新工作区重新加载。</Text>
          </View>
          {workspaces.length === 0 ? (
            <Empty ui={ui} icon="Layers" title="没有可用工作区" description="确认 API Key 在此服务器上拥有工作区权限。" />
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
        <Text style={ui.s.h2}>高级</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void toggleInternal()}
          disabled={allowInternalBusy}
          style={({ pressed }) => [ui.s.row, { gap: 10, paddingVertical: 4 }, pressed && ui.s.pressed]}
        >
          <Icon name="ShieldAlert" size={17} color={connections?.allowInternal ? ui.c.warning : ui.c.muted} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[ui.s.body, { fontWeight: "600" }]}>显示内部接口</Text>
            <Text style={ui.s.tiny}>包含 /api/internal 与 /api/daemon，仅供调试使用。</Text>
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
          <Text style={ui.s.tiny}>本地存储位置</Text>
          <Text selectable style={[ui.s.tiny, { fontFamily: "Menlo" }]}>
            {connections?.storePath ?? "—"}
          </Text>
          <Btn
            ui={ui}
            label="复制路径"
            icon="Copy"
            onPress={async () => {
              if (!connections?.storePath) return;
              await copyText(connections.storePath);
              toast.show("已复制存储路径", { variant: "success" });
            }}
          />
        </View>
      </Card>

      <Card ui={ui} style={{ gap: 8 }}>
        <Text style={ui.s.h2}>关于</Text>
        <Text style={ui.s.muted}>
          本工作台直接调用 Multica 后台 API，每一项操作与服务端一一对应，不经过任何中转存储。
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
          <Btn ui={ui} label="访问 Multica" icon="Globe" onPress={() => void openExternalUrl(OFFICIAL_WEB_URL)} />
          <Btn ui={ui} label="API 文档" icon="BookOpen" onPress={() => void openExternalUrl(`${OFFICIAL_WEB_URL}/docs`)} />
        </View>
        <Text style={ui.s.tiny}>
          已内置 {API_ROUTES.filter((route) => !isInternalRoute(route[1]) || connections?.allowInternal).length} 个接口入口 · 支持官方云与自建服务器
        </Text>
      </Card>
      </>
      ) : null}

      <ConnectionModal
        ui={ui}
        target={editing}
        onClose={() => setEditing(null)}
        onSave={async (input) => {
          try {
            await saveRpc(input);
            setEditing(null);
            await afterChange("连接已保存");
            return null;
          } catch (cause) {
            return cause instanceof Error ? cause.message : String(cause);
          }
        }}
        onTest={(input) => testRpc(input)}
      />

      <Modal
        title="删除连接"
        icon={<Icon name="Trash2" size={16} color={ui.c.danger} />}
        open={Boolean(confirmRemove)}
        onOpenChange={(next) => !next && setConfirmRemove(null)}
      >
        <Modal.Content>
          <Text style={ui.s.body}>确定删除「{confirmRemove?.name}」吗？保存在本机的 API Key 会一并移除。</Text>
          <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
            <Btn ui={ui} label="取消" onPress={() => setConfirmRemove(null)} />
            <Btn ui={ui} label="删除" tone="danger" onPress={() => confirmRemove && void remove(confirmRemove)} />
          </View>
        </Modal.Content>
      </Modal>
    </ScrollView>
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
    setName(existing?.name ?? "Multica 官方云");
    setBaseUrl(existing?.baseUrl ?? OFFICIAL_BASE_URL);
    setToken("");
    setError(null);
    setResult(null);
    setWorkspaceId(existing?.workspaceId ?? null);
    // Re-hydrate only when the modal opens for a different server.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey]);

  return (
    <Modal
      title={existing ? "编辑连接" : "添加连接"}
      icon={<Icon name="Plug" size={16} color={ui.c.muted} />}
      open={Boolean(target)}
      onOpenChange={(next) => !next && onClose()}
    >
      <Modal.Content>
        <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 12 }}>
          <Field ui={ui} label="名称" value={name} onChangeText={setName} placeholder="例如：官方云 / 公司自建" />
          <Field
            ui={ui}
            label="服务器地址"
            value={baseUrl}
            onChangeText={setBaseUrl}
            placeholder="https://api.multica.ai"
            hint="官方云填 https://api.multica.ai；自建服务填你自己的 API 域名。"
            code
          />
          <Field
            ui={ui}
            label="API Key"
            value={token}
            onChangeText={setToken}
            placeholder={existing?.tokenConfigured ? `留空保持不变（${existing.tokenMasked}）` : "mul_…"}
            secureTextEntry
            hint="只保存在本机 Paseo 后台，界面只显示掩码。"
          />

          <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
            <Btn
              ui={ui}
              label="测试连接"
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
                  if (!next.ok) setError(next.error ?? "连接失败");
                  else {
                    setWorkspaceId(next.workspaces?.[0]?.id ?? workspaceId);
                    toast.show(`连接成功，${next.workspaces?.length ?? 0} 个工作区`, { variant: "success" });
                  }
                } catch (cause) {
                  setError(cause instanceof Error ? cause.message : String(cause));
                } finally {
                  setTesting(false);
                }
              }}
            />
            {existing?.isOfficial || baseUrl.includes("multica.ai") ? (
              <Btn ui={ui} label="填入官方地址" icon="Cloud" onPress={() => setBaseUrl(OFFICIAL_BASE_URL)} />
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
                  <Tag ui={ui} label="已验证" tone="success" icon="Check" />
                </View>
              ) : null}
              {(result.workspaces ?? []).length > 0 ? (
                <View style={{ gap: 6 }}>
                  <Text style={ui.s.label}>默认工作区</Text>
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
          <Btn ui={ui} label="取消" onPress={onClose} />
          <Btn
            ui={ui}
            label="保存"
            tone="primary"
            busy={busy}
            onPress={async () => {
              if (!name.trim()) return setError("请填写名称");
              if (!baseUrl.trim()) return setError("请填写服务器地址");
              if (!existing && !token.trim()) return setError("请填写 API Key");
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
