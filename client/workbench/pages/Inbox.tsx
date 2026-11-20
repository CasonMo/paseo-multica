import { t } from "../i18n";
import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Btn, Card, Chips, Divider, Empty, ErrorNote, LoadingRow, LoadMore, nearBottom, Tag, useUi } from "../bits";
import { asList, asRecord, num, usePagedQuery, useQuery } from "../api";
import { refreshInboxBadge } from "../badge";
import { useWorkbench } from "../context";
import { relTime, type InboxItem, type Issue } from "../model";
import { InboxRow } from "../parts";

type Tab = "inbox" | "archived" | "snoozed";

const TABS: { value: Tab; label: string }[] = [
  { value: "inbox", label: "Nav.27" },
  { value: "archived", label: "AgentDetail.28" },
  { value: "snoozed", label: "Inbox.3" },
];

const SNOOZE_OPTIONS: { label: string; until(): Date }[] = [
  { label: "Inbox.4", until: () => new Date(Date.now() + 3600_000) },
  { label: "Inbox.5", until: () => new Date(Date.now() + 4 * 3600_000) },
  {
    label: "Inbox.6",
    until: () => {
      const next = new Date();
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      return next;
    },
  },
  { label: "Inbox.7", until: () => new Date(Date.now() + 7 * 86400_000) },
];

export function InboxPage() {
  const ctx = useWorkbench();
  const { theme, compact, api, bump, workspaceId, navigate, toast, invalidate } = ctx;
  const ui = useUi(theme, compact);
  const key = `${workspaceId}:${bump}`;
  const [tab, setTab] = useState<Tab>("inbox");
  const [search, setSearch] = useState("");
  const [confirmArchiveAll, setConfirmArchiveAll] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<InboxItem | null>(null);
  const [snoozeItem, setSnoozeItem] = useState<InboxItem | null>(null);
  const [busy, setBusy] = useState(false);

  const itemsQuery = usePagedQuery<InboxItem & { item_id?: string; snoozed_at?: string }>(
    api,
    tab === "inbox" ? "/api/inbox" : tab === "archived" ? "/api/inbox/archived" : "/api/inbox/snoozed",
    { pageSize: 30 },
    `${key}:${tab}`,
    "items",
    "inbox",
  );
  const unreadQuery = useQuery(api, "/api/inbox/unread-count", { pollMs: 8000 }, key);
  const snoozedIssuesQuery = useQuery(
    api,
    tab === "snoozed" ? "/api/issues" : null,
    { query: { limit: 30 }, select: (data) => asList<Issue>(data, "issues") },
    key,
  );
  const issueById = useMemo(
    () => new Map((snoozedIssuesQuery.data ?? []).map((issue) => [issue.id, issue])),
    [snoozedIssuesQuery.data],
  );
  const items = useMemo(
    () =>
      itemsQuery.items.map((item) => {
        if (!item.item_id) return item;
        const issue = item.issue_id ? issueById.get(item.issue_id) : undefined;
        return {
          id: item.item_id,
          type: item.type ?? "issue_updated",
          issue_id: item.issue_id ?? null,
          issue_identifier: issue?.identifier ?? null,
          title: issue?.title ?? t("Inbox.8"),
          read: true,
          archived: false,
          snoozed_until: item.snoozed_until ?? null,
          created_at: item.snoozed_at ?? item.created_at ?? "",
        };
      }),
    [itemsQuery.items, issueById],
  );
  const unreadCount =
    typeof unreadQuery.data === "number"
      ? unreadQuery.data
      : num(asRecord(unreadQuery.data).count ?? asRecord(unreadQuery.data).unread, 0);
  const needle = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      items.filter(
        (item) => !needle || `${item.title} ${item.issue_identifier ?? ""} ${item.body ?? ""}`.toLowerCase().includes(needle),
      ),
    [items, needle],
  );

  const refreshAll = () => {
    itemsQuery.refresh();
    unreadQuery.refresh();
    invalidate();
    refreshInboxBadge();
  };

  const action = async (path: string, method: "POST" | "DELETE", message: string) => {
    const result = await api({ method, path });
    if (result.ok) {
      toast.show(message, { variant: "success" });
      refreshAll();
    } else toast.error(result.error ?? t("Automation.13"));
  };

  const markAllRead = async (silent = false) => {
    const result = await api({ method: "POST", path: "/api/inbox/mark-all-read" });
    if (result.ok) {
      if (!silent) toast.show(t("Inbox.10"), { variant: "success" });
      refreshAll();
    } else if (!silent) toast.error(result.error ?? t("Automation.13"));
  };

  // 进入收件箱即视为已读：自动清未读，避免侧栏小徽章必须手动点才消失。
  // 但停留期间手动「标记未读」优先：本次停留不再自动已读，离开后再进入恢复自动。
  const autoReading = useRef(false);
  const manualUnread = useRef(false);
  useEffect(() => {
    if (tab !== "inbox") {
      manualUnread.current = false;
      return;
    }
    if (unreadCount <= 0 || autoReading.current || manualUnread.current) return;
    autoReading.current = true;
    void markAllRead(true).finally(() => {
      autoReading.current = false;
    });
     
  }, [tab, unreadCount]);

  const archiveAll = async () => {
    setBusy(true);
    const result = await api({ method: "POST", path: "/api/inbox/archive-all" });
    setBusy(false);
    setConfirmArchiveAll(false);
    if (result.ok) {
      toast.show(t("Inbox.12"), { variant: "success" });
      refreshAll();
    } else toast.error(result.error ?? t("AgentDetail.20"));
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    const result = await api({ method: "DELETE", path: `/api/inbox/${confirmDelete.id}` });
    setBusy(false);
    if (result.ok) {
      toast.show(t("Inbox.14"), { variant: "success" });
      setConfirmDelete(null);
      refreshAll();
    } else toast.error(result.error ?? t("Automation.15"));
  };

  const snooze = async (until: Date) => {
    if (!snoozeItem) return;
    setBusy(true);
    const result = await api({
      method: "POST",
      path: `/api/inbox/${snoozeItem.id}/snooze`,
      body: { until: until.toISOString() },
    });
    setBusy(false);
    if (result.ok) {
      toast.show(t("Inbox.16"), { variant: "success" });
      setSnoozeItem(null);
      refreshAll();
    } else toast.error(result.error ?? t("Inbox.17"));
  };

  return (
    <View style={{ flex: 1 }}>
      <View
        style={[
          ui.s.row,
          {
            gap: 8,
            paddingHorizontal: compact ? 12 : 16,
            height: 48,
            borderBottomWidth: StyleSheet.hairlineWidth,
            borderBottomColor: ui.c.line,
            backgroundColor: ui.c.canvas,
          },
        ]}
      >
        <Icon name="Bell" size={16} color={ui.c.muted} />
        <Text style={{ color: ui.c.fg, fontSize: 14, fontWeight: "600" }}>{t("Nav.27")}</Text>
        {unreadCount > 0 ? <Tag ui={ui} label={t("Inbox.19", { a: unreadCount })} tone="accent" /> : null}
        <View style={ui.s.grow} />
        <Btn ui={ui} label={t("Inbox.20")} icon="CheckCheck" onPress={() => void markAllRead()} />
        {tab === "inbox" ? (
          <Btn ui={ui} label={t("Inbox.21")} icon="Archive" onPress={() => setConfirmArchiveAll(true)} />
        ) : null}
      </View>

      <View
        style={[
          ui.s.row,
          {
            gap: 8,
            paddingHorizontal: compact ? 12 : 16,
            paddingVertical: 10,
            flexWrap: "wrap",
          },
        ]}
      >
        <Chips<Tab> ui={ui} options={TABS.map((option) => ({ ...option, label: t(option.label) }))} value={tab} onChange={setTab} />
        <View
          style={[
            ui.s.row,
            {
              flex: 1,
              minWidth: 160,
              gap: 7,
              paddingHorizontal: 8,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: ui.c.border,
              backgroundColor: ui.c.card,
              height: 32,
            },
          ]}
        >
          <Icon name="Search" size={14} color={ui.c.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t("Inbox.22")}
            placeholderTextColor={ui.c.faint}
            style={{ flex: 1, color: ui.c.fg, fontSize: 13, paddingVertical: 5 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t("ApiExplorer.3")}
              onPress={() => setSearch("")}
              style={({ pressed }) => pressed && ui.s.pressed}
            >
              <Icon name="X" size={14} color={ui.c.muted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: compact ? 12 : 16, paddingBottom: 16 }}
        onScroll={(e) => {
          if (nearBottom(e)) itemsQuery.loadMore();
        }}
        scrollEventThrottle={200}
      >
        <Card ui={ui} padded={false}>
          {itemsQuery.loading && items.length === 0 ? (
            <LoadingRow ui={ui} />
          ) : itemsQuery.error ? (
            <View style={{ padding: 14 }}>
              <ErrorNote ui={ui} message={itemsQuery.error} onRetry={itemsQuery.refresh} />
            </View>
          ) : filtered.length === 0 ? (
            <Empty
              ui={ui}
              icon={tab === "inbox" ? "BellOff" : tab === "archived" ? "Archive" : "AlarmClock"}
              title={tab === "inbox" ? t("Inbox.24") : tab === "archived" ? t("Inbox.25") : t("Inbox.26")}
              description={tab === "inbox" ? t("Inbox.27") : undefined}
            />
          ) : (
            <View>
              {filtered.map((item, index) => (
                <View key={item.id}>
                  {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 12 }} /> : null}
                  <InboxRow
                    ui={ui}
                    item={item}
                    onPress={() => {
                      if (item.issue_id) navigate("issue", { id: item.issue_id });
                    }}
                    onRead={
                      tab === "inbox" && !item.read
                        ? () => void action(`/api/inbox/${item.id}/read`, "POST", t("Inbox.28"))
                        : undefined
                    }
                    extra={
                      <View style={[ui.s.row, { gap: 2 }]}>
                        {tab === "inbox" && item.read ? (
                          <IconBtnSmall
                            ui={ui}
                            icon="MailOpen"
                            label={t("Inbox.29")}
                            onPress={() => {
                              manualUnread.current = true;
                              void action(`/api/inbox/${item.id}/unread`, "POST", t("Inbox.30"));
                            }}
                          />
                        ) : null}
                        {tab === "inbox" ? (
                          <IconBtnSmall ui={ui} icon="AlarmClock" label={t("Inbox.31")} onPress={() => setSnoozeItem(item)} />
                        ) : null}
                        {tab === "inbox" ? (
                          <IconBtnSmall
                            ui={ui}
                            icon="Archive"
                            label={t("Inbox.32")}
                            onPress={() => void action(`/api/inbox/${item.id}/archive`, "POST", t("AgentDetail.28"))}
                          />
                        ) : null}
                        {tab === "snoozed" && item.snoozed_until ? (
                          <Text style={ui.s.tiny}>{t("Inbox.34")} {shortTime(item.snoozed_until)}</Text>
                        ) : null}
                        {tab === "archived" ? (
                          <IconBtnSmall
                            ui={ui}
                            icon="ArchiveRestore"
                            label={t("Inbox.35")}
                            onPress={() => void action(`/api/inbox/${item.id}/unarchive`, "POST", t("Inbox.36"))}
                          />
                        ) : null}
                        {tab === "snoozed" ? (
                          <IconBtnSmall
                            ui={ui}
                            icon="AlarmClockOff"
                            label={t("Inbox.37")}
                            onPress={() => void action(`/api/inbox/${item.id}/unsnooze`, "POST", t("Inbox.38"))}
                          />
                        ) : null}
                        <IconBtnSmall
                          ui={ui}
                          icon="Trash2"
                          label={t("Inbox.39")}
                          color={ui.c.danger}
                          onPress={() => setConfirmDelete(item)}
                        />
                      </View>
                    }
                  />
                </View>
              ))}
            </View>
          )}
          {filtered.length > 0 ? (
            <LoadMore
              ui={ui}
              loaded={items.length}
              total={itemsQuery.total}
              hasMore={itemsQuery.hasMore}
              loadingMore={itemsQuery.loadingMore}
              loading={itemsQuery.loading}
              onLoadMore={itemsQuery.loadMore}
            />
          ) : null}
        </Card>
      </ScrollView>

      {filtered.length > 0 ? (
        <View
          style={[
            ui.s.row,
            {
              height: 28,
              paddingHorizontal: compact ? 12 : 16,
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: ui.c.line,
            },
          ]}
        >
          <Text style={ui.s.tiny}>
            {t("Inbox.40")} {itemsQuery.total} {t("Inbox.41")} {relTime(filtered[0]?.created_at)}
          </Text>
        </View>
      ) : null}

      <Modal
        title={t("Inbox.42")}
        icon={<Icon name="Archive" size={16} color={ui.c.muted} />}
        open={confirmArchiveAll}
        onOpenChange={setConfirmArchiveAll}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>{t("Inbox.43")}</Text>
            <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8 }]}>
              <Btn ui={ui} label={t("AgentDetail.40")} onPress={() => setConfirmArchiveAll(false)} />
              <Btn ui={ui} label={t("Inbox.21")} icon="Archive" busy={busy} onPress={() => void archiveAll()} />
            </View>
          </View>
        </Modal.Content>
      </Modal>

      <Modal
        title={t("Inbox.39")}
        icon={<Icon name="TriangleAlert" size={16} color={ui.c.danger} />}
        open={Boolean(confirmDelete)}
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(null);
        }}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>{t("Automation.48")}{confirmDelete?.title}{t("Inbox.149")}</Text>
            <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8 }]}>
              <Btn ui={ui} label={t("AgentDetail.40")} onPress={() => setConfirmDelete(null)} />
              <Btn ui={ui} label={t("SquadDetail.21")} tone="danger" busy={busy} onPress={() => void remove()} />
            </View>
          </View>
        </Modal.Content>
      </Modal>

      <Modal
        title={t("Inbox.31")}
        icon={<Icon name="AlarmClock" size={16} color={ui.c.muted} />}
        open={Boolean(snoozeItem)}
        onOpenChange={(next) => {
          if (!next) setSnoozeItem(null);
        }}
      >
        <Modal.Content>
          <View style={{ gap: 10 }}>
            <Text style={ui.s.muted}>{t("Inbox.150")}{snoozeItem?.title}{t("Inbox.51")}</Text>
            <View style={{ gap: 6 }}>
              {SNOOZE_OPTIONS.map((option) => (
                <Btn ui={ui} key={option.label} label={t(option.label)} icon="Clock" busy={busy} onPress={() => void snooze(option.until())} />
              ))}
            </View>
            <Btn ui={ui} label={t("AgentDetail.40")} onPress={() => setSnoozeItem(null)} />
          </View>
        </Modal.Content>
      </Modal>
    </View>
  );
}

function shortTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (input: number) => String(input).padStart(2, "0");
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function IconBtnSmall({
  ui,
  icon,
  label,
  onPress,
  color,
}: {
  ui: ReturnType<typeof useUi>;
  icon: string;
  label: string;
  onPress(): void;
  color?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
    >
      <Icon name={icon} size={14} color={color ?? ui.c.muted} />
    </Pressable>
  );
}
