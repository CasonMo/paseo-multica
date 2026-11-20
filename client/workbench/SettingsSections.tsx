import { t } from "./i18n";
import { Icon, Modal, copyText } from "@getpaseo/plugin/client/ui";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { asList, asRecord, str, usePagedQuery, useQuery, type ApiFn } from "./api";
import { Avatar, Btn, Card, Chips, Empty, ErrorNote, Field, LoadingRow, LoadMore, Tag, useUi, type Ui } from "./bits";
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

const ROLE_LABEL: Record<string, string> = { owner: "SettingsSections.1", admin: "SettingsSections.2", member: "Execution.11" };
const roleLabel = (role: string) => (ROLE_LABEL[role] ? t(ROLE_LABEL[role]) : role);

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
    if (!next) return setError(t("SettingsSections.4"));
    setBusy(true);
    setError(null);
    const result = await api({ method: "PATCH", path: "/api/me", body: { name: next } });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? t("AgentDetail.64"));
    toast.show(t("SettingsSections.6"), { variant: "success" });
    query.refresh();
    await onSaved();
  };

  return (
    <Card ui={ui} style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text style={ui.s.h2}>{t("SettingsSections.7")}</Text>
        <Text style={ui.s.tiny}>{t("SettingsSections.8")}</Text>
      </View>
      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      <View style={[ui.s.row, { gap: 10 }]}>
        <Avatar ui={ui} name={current} url={str(profile.avatar_url) || user?.avatar_url} size={40} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={[ui.s.body, { fontWeight: "700" }]}>{current || "—"}</Text>
          <Text style={ui.s.tiny}>{str(profile.email) || user?.email}</Text>
        </View>
      </View>
      <Field ui={ui} label={t("AgentDetail.95")} value={name} onChangeText={setName} placeholder={t("SettingsSections.10")} />
      <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
        <Tag ui={ui} label={t("SettingsSections.11", { a: language || t("SettingsSections.12") })} tone="muted" icon="Globe" />
        <Tag ui={ui} label={t("SettingsSections.13", { a: timezone || t("SettingsSections.12") })} tone="muted" icon="Clock" />
        {str(profile.onboarded_at) ? <Tag ui={ui} label={t("SettingsSections.15")} tone="success" icon="Check" /> : null}
      </View>
      {error ? <ErrorNote ui={ui} message={error} /> : null}
      <View style={[ui.s.row, { justifyContent: "flex-end" }]}>
        <Btn
          ui={ui}
          label={t("AgentDetail.72")}
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
  const query = usePagedQuery<TokenRow>(api, "/api/tokens", { pageSize: 30 }, String(bump), "tokens");
  const tokens = query.items;
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<TokenRow | null>(null);

  const create = async () => {
    const next = name.trim();
    if (!next) return setError(t("SettingsSections.17"));
    setBusy(true);
    setError(null);
    const result = await api({ method: "POST", path: "/api/tokens", body: { name: next } });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? t("SettingsSections.18"));
    const token = str(asRecord(result.data).token);
    setCreating(false);
    setName("");
    query.refresh();
    if (token) setFresh(token);
    toast.show(t("SettingsSections.19"), { variant: "success" });
  };

  const remove = async (item: TokenRow) => {
    setConfirmRemove(null);
    const result = await api({ method: "DELETE", path: `/api/tokens/${item.id}` });
    if (!result.ok) return toast.error(result.error ?? t("SettingsSections.20"));
    query.refresh();
    toast.show(t("SettingsSections.21"), { variant: "success" });
  };

  return (
    <Card ui={ui} style={{ gap: 10 }}>
      <View style={[ui.s.row, { justifyContent: "space-between" }]}>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={ui.s.h2}>{t("SettingsSections.22")}</Text>
          <Text style={ui.s.tiny}>{t("SettingsSections.23")}</Text>
        </View>
        <Btn ui={ui} label={t("Nav.10")} icon="Plus" tone="primary" onPress={() => setCreating(true)} />
      </View>
      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      {query.loading && tokens.length === 0 ? (
        <LoadingRow ui={ui} label={t("SettingsSections.25")} />
      ) : tokens.length === 0 ? (
        <Empty ui={ui} icon="Key" title={t("SettingsSections.26")} description={t("SettingsSections.27")} />
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
                  {expired ? <Tag ui={ui} label={t("SettingsSections.28")} tone="danger" /> : <Tag ui={ui} label={t("SettingsSections.29")} tone="success" />}
                </View>
                <Text style={[ui.s.tiny, { fontFamily: "Menlo" }]}>{token.token_prefix}…</Text>
                <Text style={ui.s.tiny}>
                  {t("SettingsSections.30")} {relTime(token.created_at)} {t("SettingsSections.31")} {token.last_used_at ? relTime(token.last_used_at) : t("SettingsSections.32")}
                  {token.expires_at ? t("SettingsSections.33", { a: relTime(token.expires_at) }) : t("SettingsSections.34")}
                </Text>
              </View>
              <Btn ui={ui} label={t("SettingsSections.35")} tone="danger" onPress={() => setConfirmRemove(token)} />
            </View>
          );
        })
      )}
      <LoadMore
        ui={ui}
        loaded={tokens.length}
        total={query.total}
        hasMore={query.hasMore}
        loadingMore={query.loadingMore}
        loading={query.loading}
        onLoadMore={query.loadMore}
      />

      <Modal title={t("SettingsSections.36")} icon={<Icon name="Key" size={16} color={ui.c.muted} />} open={creating} onOpenChange={(next) => !next && setCreating(false)}>
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Field ui={ui} label={t("AgentDetail.95")} value={name} onChangeText={setName} placeholder={t("SettingsSections.38")} hint={t("SettingsSections.39")} />
            {error ? <ErrorNote ui={ui} message={error} /> : null}
            <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
              <Btn ui={ui} label={t("AgentDetail.40")} onPress={() => setCreating(false)} />
              <Btn ui={ui} label={t("SettingsSections.30")} tone="primary" busy={busy} onPress={() => void create()} />
            </View>
          </View>
        </Modal.Content>
      </Modal>

      <Modal
        title={t("SettingsSections.19")}
        icon={<Icon name="Check" size={16} color={ui.c.success} />}
        open={Boolean(fresh)}
        onOpenChange={(next) => !next && setFresh(null)}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <View style={{ gap: 4 }}>
              <Text style={ui.s.body}>{t("SettingsSections.43")}</Text>
              <Text selectable style={[ui.s.tiny, { fontFamily: "Menlo", padding: 10, borderRadius: 8, backgroundColor: ui.c.surface2 }]}>
                {fresh ?? ""}
              </Text>
            </View>
            <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
              <Btn
                ui={ui}
                label={t("SettingsSections.44")}
                icon="Copy"
                onPress={async () => {
                  if (!fresh) return;
                  await copyText(fresh);
                  toast.show(t("SettingsSections.45"), { variant: "success" });
                }}
              />
              <Btn ui={ui} label={t("SettingsSections.46")} tone="primary" onPress={() => setFresh(null)} />
            </View>
          </View>
        </Modal.Content>
      </Modal>

      <Modal
        title={t("SettingsSections.47")}
        icon={<Icon name="Trash2" size={16} color={ui.c.danger} />}
        open={Boolean(confirmRemove)}
        onOpenChange={(next) => !next && setConfirmRemove(null)}
      >
        <Modal.Content>
          <Text style={ui.s.body}>{t("SettingsSections.48")}{confirmRemove?.name}{t("SettingsSections.49")}</Text>
          <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
            <Btn ui={ui} label={t("AgentDetail.40")} onPress={() => setConfirmRemove(null)} />
            <Btn ui={ui} label={t("SettingsSections.35")} tone="danger" onPress={() => confirmRemove && void remove(confirmRemove)} />
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
  const query = usePagedQuery<MemberRow>(
    api,
    `/api/workspaces/${workspaceId}/members`,
    { pageSize: 30 },
    `${workspaceId}:${bump}`,
    "members",
  );
  const members = query.items;
  const [inviting, setInviting] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<MemberRow | null>(null);

  const invite = async () => {
    const next = email.trim();
    if (!next) return setError(t("SettingsSections.52"));
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(next)) return setError(t("SettingsSections.53"));
    setBusy(true);
    setError(null);
    const result = await api({ method: "POST", path: `/api/workspaces/${workspaceId}/members`, body: { email: next, role } });
    setBusy(false);
    if (!result.ok) return setError(result.error ?? t("SettingsSections.54"));
    setInviting(false);
    setEmail("");
    query.refresh();
    toast.show(t("SettingsSections.55"), { variant: "success" });
  };

  const changeRole = async (member: MemberRow, next: "member" | "admin") => {
    const result = await api({ method: "PATCH", path: `/api/workspaces/${workspaceId}/members/${member.id}`, body: { role: next } });
    if (!result.ok) return toast.error(result.error ?? t("SettingsSections.56"));
    query.refresh();
    toast.show(t("SettingsSections.57", { a: member.name ?? member.email ?? t("Execution.11"), b: roleLabel(next) }), { variant: "success" });
  };

  const remove = async (member: MemberRow) => {
    setConfirmRemove(null);
    const result = await api({ method: "DELETE", path: `/api/workspaces/${workspaceId}/members/${member.id}` });
    if (!result.ok) return toast.error(result.error ?? t("AgentDetail.75"));
    query.refresh();
    toast.show(t("SettingsSections.60"), { variant: "success" });
  };

  return (
    <Card ui={ui} style={{ gap: 10 }}>
      <View style={[ui.s.row, { justifyContent: "space-between" }]}>
        <View style={{ gap: 2, flex: 1 }}>
          <Text style={ui.s.h2}>{t("Execution.11")}</Text>
          <Text style={ui.s.tiny}>{t("SettingsSections.62")} {members.length} {t("SettingsSections.63")}</Text>
        </View>
        <Btn ui={ui} label={t("SettingsSections.64")} icon="UserPlus" tone="primary" onPress={() => setInviting(true)} />
      </View>
      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      {query.loading && members.length === 0 ? <LoadingRow ui={ui} label={t("SettingsSections.65")} /> : null}
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
                  label={member.role === "admin" ? t("SettingsSections.66") : t("SettingsSections.67")}
                  onPress={() => void changeRole(member, member.role === "admin" ? "member" : "admin")}
                />
                <Btn ui={ui} label={t("SettingsSections.68")} icon="UserMinus" tone="danger" onPress={() => setConfirmRemove(member)} />
              </View>
            ) : null}
          </View>
        );
      })}
      <LoadMore
        ui={ui}
        loaded={members.length}
        total={query.total}
        hasMore={query.hasMore}
        loadingMore={query.loadingMore}
        loading={query.loading}
        onLoadMore={query.loadMore}
      />

      <Modal title={t("SettingsSections.69")} icon={<Icon name="UserPlus" size={16} color={ui.c.muted} />} open={inviting} onOpenChange={(next) => !next && setInviting(false)}>
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Field ui={ui} label={t("SettingsSections.70")} value={email} onChangeText={setEmail} placeholder="teammate@example.com" hint={t("SettingsSections.71")} />
            <View style={{ gap: 6 }}>
              <Text style={ui.s.label}>{t("SettingsSections.72")}</Text>
              <Chips
                ui={ui}
                options={[
                  { value: "member", label: t("Execution.11"), icon: "User" },
                  { value: "admin", label: t("SettingsSections.2"), icon: "Shield" },
                ] as const}
                value={role}
                onChange={(next) => setRole(next as typeof role)}
              />
            </View>
            {error ? <ErrorNote ui={ui} message={error} /> : null}
            <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end" }]}>
              <Btn ui={ui} label={t("AgentDetail.40")} onPress={() => setInviting(false)} />
              <Btn ui={ui} label={t("SettingsSections.76")} tone="primary" busy={busy} onPress={() => void invite()} />
            </View>
          </View>
        </Modal.Content>
      </Modal>

      <Modal
        title={t("SettingsSections.77")}
        icon={<Icon name="UserMinus" size={16} color={ui.c.danger} />}
        open={Boolean(confirmRemove)}
        onOpenChange={(next) => !next && setConfirmRemove(null)}
      >
        <Modal.Content>
          <Text style={ui.s.body}>
            {t("SettingsSections.78")}{confirmRemove?.name ?? confirmRemove?.email ?? ""}{t("SettingsSections.79")}
          </Text>
          <View style={[ui.s.row, { gap: 8, justifyContent: "flex-end", marginTop: 12 }]}>
            <Btn ui={ui} label={t("AgentDetail.40")} onPress={() => setConfirmRemove(null)} />
            <Btn ui={ui} label={t("SettingsSections.68")} tone="danger" onPress={() => confirmRemove && void remove(confirmRemove)} />
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
  const query = usePagedQuery<InviteRow>(
    api,
    `/api/workspaces/${workspaceId}/invitations`,
    { pageSize: 30 },
    `${workspaceId}:${bump}`,
    "invitations",
  );
  const rows = query.items;

  const revoke = async (row: InviteRow) => {
    const id = str(row.id);
    const result = await api({ method: "DELETE", path: `/api/workspaces/${workspaceId}/invitations/${id}` });
    if (!result.ok) return toast.error(result.error ?? t("SettingsSections.82"));
    query.refresh();
    toast.show(t("SettingsSections.83"), { variant: "success" });
  };

  return (
    <Card ui={ui} style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text style={ui.s.h2}>{t("SettingsSections.84")}</Text>
        <Text style={ui.s.tiny}>{t("SettingsSections.85")}</Text>
      </View>
      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      {rows.length === 0 ? (
        <Text style={ui.s.muted}>{t("SettingsSections.86")}</Text>
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
                  {roleLabel(inviteRole)} {t("SettingsSections.87")} {relTime(str(row.created_at) || str(row.invited_at))}
                </Text>
              </View>
              <Btn ui={ui} label={t("SettingsSections.35")} tone="danger" onPress={() => void revoke(row)} />
            </View>
          );
        })
      )}
      <LoadMore
        ui={ui}
        loaded={rows.length}
        total={query.total}
        hasMore={query.hasMore}
        loadingMore={query.loadingMore}
        loading={query.loading}
        onLoadMore={query.loadMore}
      />
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
    if (!result.ok) return toast.error(result.error ?? t("AgentDetail.64"));
    query.refresh();
    toast.show(next === "muted" ? t("SettingsSections.90") : t("SettingsSections.91"), { variant: "success" });
  };

  return (
    <Card ui={ui} style={{ gap: 10 }}>
      <View style={{ gap: 2 }}>
        <Text style={ui.s.h2}>{t("SettingsSections.92")}</Text>
        <Text style={ui.s.tiny}>{t("SettingsSections.93")}</Text>
      </View>
      {query.error ? <ErrorNote ui={ui} message={query.error} onRetry={query.refresh} /> : null}
      <View style={[ui.s.row, { gap: 8, flexWrap: "wrap", opacity: busy ? 0.6 : 1 }]}>
        <View style={{ flex: 1, minWidth: 180, gap: 2 }}>
          <Text style={[ui.s.body, { fontWeight: "600" }]}>{t("SettingsSections.94")}</Text>
          <Text style={ui.s.tiny}>{t("SettingsSections.95")}</Text>
        </View>
        <Chips
          ui={ui}
          options={[
            { value: "all", label: t("Nav.30"), icon: "Bell" },
            { value: "muted", label: t("SettingsSections.97"), icon: "BellOff" },
          ] as const}
          value={current}
          onChange={(next) => void update(next)}
        />
      </View>
    </Card>
  );
}
