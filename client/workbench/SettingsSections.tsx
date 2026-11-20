import { Icon, Modal, copyText } from "@getpaseo/plugin/client/ui";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { asList, asRecord, str, useQuery, type ApiFn } from "./api";
import { Avatar, Btn, Card, Chips, Empty, ErrorNote, Field, LoadingRow, Tag, useUi, type Ui } from "./bits";
import { useWorkbench } from "./context";
import { relTime } from "./model";

type Toast = ReturnType<typeof useWorkbench>["toast"];

interface TokenRow {
  id: string;
  name: string;
  token_prefix: string;
  expires_at: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  name?: string;
  email?: string;
  avatar_url?: string | null;
}

type InviteRow = Record<string, unknown>;

const ROLE_LABEL: Record<string, string> = { owner: "所有者", admin: "管理员", member: "成员" };
const roleLabel = (role: string) => ROLE_LABEL[role] ?? role;

export function AccountSettings() {
  const ctx = useWorkbench();
  const ui = useUi(ctx.theme, ctx.compact);
  return (
    <>
      <ProfileCard ui={ui} api={ctx.api} user={ctx.user} bump={ctx.bump} toast={ctx.toast} onSaved={ctx.reloadBootstrap} />
      <TokensCard ui={ui} api={ctx.api} bump={ctx.bump} toast={ctx.toast} />
      <NotificationCard ui={ui} api={ctx.api} bump={ctx.bump} toast={ctx.toast} />
    </>
  );
}

export function WorkspaceMembersSettings() {
  const ctx = useWorkbench();
  const ui = useUi(ctx.theme, ctx.compact);
  return (
    <>
      <MembersCard ui={ui} api={ctx.api} workspaceId={ctx.workspaceId} bump={ctx.bump} toast={ctx.toast} />
      <InvitationCard ui={ui} api={ctx.api} workspaceId={ctx.workspaceId} bump={ctx.bump} toast={ctx.toast} />
    </>
  );
}

function ProfileCard({
  ui,
  api,
  user,
  bump,
  toast,
  onSaved,
}: {
  ui: Ui;
  api: ApiFn;
  user: ReturnType<typeof useWorkbench>["user"];
  bump: number;
  toast: Toast;
  onSaved(): void | Promise<void>;
}) {
  const query = useQuery(api, "/api/me", { select: asRecord }, `${bump}:${user?.id ?? "me"}`);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const profile = query.data ?? {};
  const current = str(profile.name) || user?.name || "";
  const language = str(profile.language);
  const timezone = str(profile.timezone);

  useEffect(() => {
    setName(str(query.data?.name));
  }, [query.data]);

  const save = async () => {
    const next = name.trim();
    if (!next) return setError("名称不能为空");
    setBusy(true);
    setError(null);
    const result = await api({ method: "PATCH", path: "/api/me", body: { name: next } });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? "保存失败");
    toast.show("个人资料已更新", { variant: "success" });
    query.refresh();
    await onSaved();
  };

  return (
    <Card ui={ui} style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text style={ui.s.h2}>个人资料</Text>
        <Text style={ui.s.tiny}>名称会显示在任务、评论与成员列表中。</Text>
      </View>
      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      <View style={[ui.s.row, { gap: 10 }]}>
        <Avatar ui={ui} name={current} url={str(profile.avatar_url) || user?.avatar_url} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[ui.s.body, { fontWeight: "700" }]}>{current || "—"}</Text>
          <Text style={ui.s.tiny}>{str(profile.email) || user?.email}</Text>
        </View>
      </View>
      <Field ui={ui} label="名称" value={name} onChangeText={setName} placeholder="你的显示名称" />
      <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
        <Tag ui={ui} label={`语言 ${language || "未设置"}`} tone="muted" icon="Globe" />
        <Tag ui={ui} label={`时区 ${timezone || "未设置"}`} tone="muted" icon="Clock" />
        {str(profile.onboarded_at) ? <Tag ui={ui} label="已完成引导" tone="success" icon="Check" /> : null}
      </View>
      {error ? <ErrorNote ui={ui} message={error} /> : null}
      <View style={[ui.s.row, { justifyContent: "flex-end" }]}>
        <Btn
          ui={ui}
          label="保存"
          tone="primary"
          busy={busy}
          disabled={!name.trim() || name.trim() === current}
          onPress={() => void save()}
        />
      </View>
    </Card>
  );
}

function TokensCard({
  ui,
  api,
  bump,
  toast,
}: {
  ui: Ui;
  api: ApiFn;
  bump: number;
  toast: Toast;
}) {
  const query = useQuery(api, "/api/tokens", { select: (data) => asList<TokenRow>(data, "tokens") }, String(bump));
  const tokens = query.data ?? [];
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<TokenRow | null>(null);

  const create = async () => {
    const next = name.trim();
    if (!next) return setError("请填写令牌名称");
    setBusy(true);
    setError(null);
    const result = await api({ method: "POST", path: "/api/tokens", body: { name: next } });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? "创建失败");
    const token = str(asRecord(result.data).token);
    setCreating(false);
    setName("");
    query.refresh();
    if (token) setFresh(token);
    toast.show("令牌已创建", { variant: "success" });
  };

  const remove = async (item: TokenRow) => {
    setConfirmRemove(null);
    const result = await api({ method: "DELETE", path: `/api/tokens/${item.id}` });
    if (!result.ok) return toast.error(result.error ?? "撤销失败");
    query.refresh();
    toast.show("令牌已撤销", { variant: "success" });
  };

  return (
    <Card ui={ui} style={{ gap: 10 }}>
      <View style={[ui.s.row, { justifyContent: "space-between" }]}>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={ui.s.h2}>访问令牌</Text>
          <Text style={ui.s.tiny}>用于 CLI、自建服务或第三方集成调用 Multica API。</Text>
        </View>
        <Btn ui={ui} label="新建" icon="Plus" tone="primary" onPress={() => setCreating(true)} />
      </View>
      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      {query.loading && !query.data ? (
        <LoadingRow ui={ui} label="读取令牌…" />
      ) : tokens.length === 0 ? (
        <Empty ui={ui} icon="Key" title="还没有访问令牌" description="创建一个令牌后只显示一次完整密钥。" />
      ) : (
        tokens.map((token) => {
          const expired = token.expires_at ? Date.parse(token.expires_at) < Date.now() : false;
          return (
            <View
              key={token.id}
              style={[ui.s.row, { gap: 9, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: ui.c.border, backgroundColor: ui.c.surface0 }]}
            >
              <Icon name="Key" size={15} color={expired ? ui.c.danger : ui.c.muted} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={[ui.s.row, { gap: 6 }]}>
                  <Text numberOfLines={1} style={[ui.s.body, { fontWeight: "600" }]}>{token.name}</Text>
                  {expired ? <Tag ui={ui} label="已过期" tone="danger" /> : <Tag ui={ui} label="有效" tone="success" />}
                </View>
                <Text style={[ui.s.tiny, { fontFamily: "Menlo" }]}>{token.token_prefix}…</Text>
                <Text style={ui.s.tiny}>
                  创建 {relTime(token.created_at)} · 最近使用 {token.last_used_at ? relTime(token.last_used_at) : "从未"}
                  {token.expires_at ? ` · 到期 ${relTime(token.expires_at)}` : " · 永不过期"}
                </Text>
              </View>
              <Btn ui={ui} label="撤销" tone="danger" onPress={() => setConfirmRemove(token)} />
            </View>
          );
        })
      )}

      <Modal title="新建访问令牌" icon={<Icon name="Key" size={16} color={ui.c.muted} />} open={creating} onOpenChange={(next) => !next && setCreating(false)}>
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Field ui={ui} label="名称" value={name} onChangeText={setName} placeholder="例如：paseo-cli" hint="用用途命名，方便日后识别与撤销。" />
            {error ? <ErrorNote ui={ui} message={error} /> : null}
            <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
              <Btn ui={ui} label="取消" onPress={() => setCreating(false)} />
              <Btn ui={ui} label="创建" tone="primary" busy={busy} onPress={() => void create()} />
            </View>
          </View>
        </Modal.Content>
      </Modal>

      <Modal
        title="令牌已创建"
        icon={<Icon name="Check" size={16} color={ui.c.success} />}
        open={Boolean(fresh)}
        onOpenChange={(next) => !next && setFresh(null)}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <View style={{ gap: 4 }}>
              <Text style={ui.s.body}>复制并妥善保存，关闭后将无法再次查看完整令牌。</Text>
              <Text selectable style={[ui.s.tiny, { fontFamily: "Menlo", padding: 10, borderRadius: 8, backgroundColor: ui.c.surface2 }]}>
                {fresh ?? ""}
              </Text>
            </View>
            <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
              <Btn
                ui={ui}
                label="复制"
                icon="Copy"
                onPress={async () => {
                  if (!fresh) return;
                  await copyText(fresh);
                  toast.show("令牌已复制", { variant: "success" });
                }}
              />
              <Btn ui={ui} label="完成" tone="primary" onPress={() => setFresh(null)} />
            </View>
          </View>
        </Modal.Content>
      </Modal>

      <Modal
        title="撤销令牌"
        icon={<Icon name="Trash2" size={16} color={ui.c.danger} />}
        open={Boolean(confirmRemove)}
        onOpenChange={(next) => !next && setConfirmRemove(null)}
      >
        <Modal.Content>
          <Text style={ui.s.body}>撤销「{confirmRemove?.name}」后，使用该令牌的调用会立即失效且不可恢复。</Text>
          <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
            <Btn ui={ui} label="取消" onPress={() => setConfirmRemove(null)} />
            <Btn ui={ui} label="撤销" tone="danger" onPress={() => confirmRemove && void remove(confirmRemove)} />
          </View>
        </Modal.Content>
      </Modal>
    </Card>
  );
}

function MembersCard({
  ui,
  api,
  workspaceId,
  bump,
  toast,
}: {
  ui: Ui;
  api: ApiFn;
  workspaceId: string;
  bump: number;
  toast: Toast;
}) {
  const query = useQuery(
    api,
    `/api/workspaces/${workspaceId}/members`,
    { select: (data) => asList<MemberRow>(data, "members") },
    `${workspaceId}:${bump}`,
  );
  const members = query.data ?? [];
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<MemberRow | null>(null);

  const invite = async () => {
    const next = email.trim();
    if (!next) return setError("请填写邮箱");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) return setError("邮箱格式不正确");
    setBusy(true);
    setError(null);
    const result = await api({ method: "POST", path: `/api/workspaces/${workspaceId}/members`, body: { email: next, role } });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? "邀请失败");
    setInviting(false);
    setEmail("");
    query.refresh();
    toast.show("邀请已发送", { variant: "success" });
  };

  const changeRole = async (member: MemberRow, next: "member" | "admin") => {
    const result = await api({ method: "PATCH", path: `/api/workspaces/${workspaceId}/members/${member.id}`, body: { role: next } });
    if (!result.ok) return toast.error(result.error ?? "修改角色失败");
    query.refresh();
    toast.show(`已将 ${member.name ?? member.email ?? "成员"} 设为${roleLabel(next)}`, { variant: "success" });
  };

  const remove = async (member: MemberRow) => {
    setConfirmRemove(null);
    const result = await api({ method: "DELETE", path: `/api/workspaces/${workspaceId}/members/${member.id}` });
    if (!result.ok) return toast.error(result.error ?? "移除失败");
    query.refresh();
    toast.show("成员已移除", { variant: "success" });
  };

  return (
    <Card ui={ui} style={{ gap: 10 }}>
      <View style={[ui.s.row, { justifyContent: "space-between" }]}>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={ui.s.h2}>成员</Text>
          <Text style={ui.s.tiny}>工作区共 {members.length} 位成员。</Text>
        </View>
        <Btn ui={ui} label="邀请" icon="UserPlus" tone="primary" onPress={() => setInviting(true)} />
      </View>
      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      {query.loading && !query.data ? <LoadingRow ui={ui} label="读取成员…" /> : null}
      {members.map((member) => {
        const isOwner = member.role === "owner";
        return (
          <View
            key={member.id}
            style={[ui.s.row, { gap: 9, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: ui.c.border, backgroundColor: ui.c.surface0, flexWrap: "wrap" }]}
          >
            <Avatar ui={ui} name={member.name} url={member.avatar_url} size={30} />
            <View style={{ flex: 1, minWidth: 140, gap: 2 }}>
              <View style={[ui.s.row, { gap: 6 }]}>
                <Text numberOfLines={1} style={[ui.s.body, { fontWeight: "600" }]}>{member.name ?? member.email ?? member.user_id}</Text>
                <Tag ui={ui} label={roleLabel(member.role)} tone={isOwner ? "accent" : member.role === "admin" ? "success" : "muted"} />
              </View>
              <Text style={ui.s.tiny}>{member.email ?? member.user_id}</Text>
            </View>
            {!isOwner ? (
              <View style={[ui.s.row, { gap: 6 }]}>
                <Btn
                  ui={ui}
                  label={member.role === "admin" ? "设为成员" : "设为管理员"}
                  onPress={() => void changeRole(member, member.role === "admin" ? "member" : "admin")}
                />
                <Btn ui={ui} label="移除" icon="UserMinus" tone="danger" onPress={() => setConfirmRemove(member)} />
              </View>
            ) : null}
          </View>
        );
      })}

      <Modal title="邀请成员" icon={<Icon name="UserPlus" size={16} color={ui.c.muted} />} open={inviting} onOpenChange={(next) => !next && setInviting(false)}>
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Field ui={ui} label="邮箱" value={email} onChangeText={setEmail} placeholder="teammate@example.com" hint="对方会收到加入工作区的邀请邮件。" />
            <View style={{ gap: 6 }}>
              <Text style={ui.s.label}>角色</Text>
              <Chips
                ui={ui}
                options={[
                  { value: "member", label: "成员", icon: "User" },
                  { value: "admin", label: "管理员", icon: "Shield" },
                ] as const}
                value={role}
                onChange={(next) => setRole(next as typeof role)}
              />
            </View>
            {error ? <ErrorNote ui={ui} message={error} /> : null}
            <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
              <Btn ui={ui} label="取消" onPress={() => setInviting(false)} />
              <Btn ui={ui} label="发送邀请" tone="primary" busy={busy} onPress={() => void invite()} />
            </View>
          </View>
        </Modal.Content>
      </Modal>

      <Modal
        title="移除成员"
        icon={<Icon name="UserMinus" size={16} color={ui.c.danger} />}
        open={Boolean(confirmRemove)}
        onOpenChange={(next) => !next && setConfirmRemove(null)}
      >
        <Modal.Content>
          <Text style={ui.s.body}>
            确定将「{confirmRemove?.name ?? confirmRemove?.email ?? ""}」移出工作区吗？该成员已分配的任务会保留。
          </Text>
          <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
            <Btn ui={ui} label="取消" onPress={() => setConfirmRemove(null)} />
            <Btn ui={ui} label="移除" tone="danger" onPress={() => confirmRemove && void remove(confirmRemove)} />
          </View>
        </Modal.Content>
      </Modal>
    </Card>
  );
}

function InvitationCard({
  ui,
  api,
  workspaceId,
  bump,
  toast,
}: {
  ui: Ui;
  api: ApiFn;
  workspaceId: string;
  bump: number;
  toast: Toast;
}) {
  const query = useQuery(
    api,
    `/api/workspaces/${workspaceId}/invitations`,
    { select: (data) => asList<InviteRow>(data, "invitations") },
    `${workspaceId}:${bump}`,
  );
  const rows = query.data ?? [];

  const revoke = async (row: InviteRow) => {
    const id = str(row.id);
    const result = await api({ method: "DELETE", path: `/api/workspaces/${workspaceId}/invitations/${id}` });
    if (!result.ok) return toast.error(result.error ?? "撤销邀请失败");
    query.refresh();
    toast.show("邀请已撤销", { variant: "success" });
  };

  return (
    <Card ui={ui} style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text style={ui.s.h2}>待处理邀请</Text>
        <Text style={ui.s.tiny}>已发出但尚未被接受的邀请。</Text>
      </View>
      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      {rows.length === 0 ? (
        <Text style={ui.s.muted}>暂无待处理邀请。</Text>
      ) : (
        rows.map((row, index) => {
          const id = str(row.id) || String(index);
          const email = str(row.email) || str(row.invitee_email) || str(row.invited_email);
          const inviteRole = str(row.role) || "member";
          return (
            <View
              key={id}
              style={[ui.s.row, { gap: 9, padding: 10, borderRadius: 10, borderWidth: 1, borderColor: ui.c.border, backgroundColor: ui.c.surface0 }]}
            >
              <Icon name="Mail" size={15} color={ui.c.muted} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={[ui.s.body, { fontWeight: "600" }]}>{email || id}</Text>
                <Text style={ui.s.tiny}>
                  {roleLabel(inviteRole)} · 发出 {relTime(str(row.created_at) || str(row.invited_at))}
                </Text>
              </View>
              <Btn ui={ui} label="撤销" tone="danger" onPress={() => void revoke(row)} />
            </View>
          );
        })
      )}
    </Card>
  );
}

function NotificationCard({
  ui,
  api,
  bump,
  toast,
}: {
  ui: Ui;
  api: ApiFn;
  bump: number;
  toast: Toast;
}) {
  const query = useQuery(
    api,
    "/api/notification-preferences",
    { select: (data) => asRecord(asRecord(data).preferences) },
    String(bump),
  );
  const [busy, setBusy] = useState(false);
  const current = str(query.data?.status_changes) === "muted" ? "muted" : "all";

  const update = async (next: "all" | "muted") => {
    if (next === current) return;
    setBusy(true);
    const result = await api({ method: "PATCH", path: "/api/notification-preferences", body: { preferences: { status_changes: next } } });
    setBusy(false);
    if (!result.ok) return toast.error(result.error ?? "保存失败");
    query.refresh();
    toast.show(next === "muted" ? "已静音状态变更通知" : "已开启状态变更通知", { variant: "success" });
  };

  return (
    <Card ui={ui} style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text style={ui.s.h2}>通知偏好</Text>
        <Text style={ui.s.tiny}>控制任务状态变化时是否向你发送通知。</Text>
      </View>
      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      <View style={[ui.s.row, { gap: 8, flexWrap: "wrap", opacity: busy ? 0.6 : 1 }]}>
        <View style={{ flex: 1, minWidth: 180, gap: 2 }}>
          <Text style={[ui.s.body, { fontWeight: "600" }]}>状态变更</Text>
          <Text style={ui.s.tiny}>任务进入新状态、被阻塞或完成时提醒。</Text>
        </View>
        <Chips
          ui={ui}
          options={[
            { value: "all", label: "通知", icon: "Bell" },
            { value: "muted", label: "静音", icon: "BellOff" },
          ] as const}
          value={current}
          onChange={(next) => void update(next)}
        />
      </View>
    </Card>
  );
}
