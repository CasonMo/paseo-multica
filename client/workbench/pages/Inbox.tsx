import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Btn, Card, Chips, Divider, Empty, ErrorNote, LoadingRow, Tag, useUi } from "../bits";
import { asList, asRecord, num, useQuery } from "../api";
import { refreshInboxBadge } from "../badge";
import { useWorkbench } from "../context";
import { relTime, type InboxItem, type Issue } from "../model";
import { InboxRow } from "../parts";

type Tab = "inbox" | "archived" | "snoozed";

const TABS: { value: Tab; label: string }[] = [
  { value: "inbox", label: "收件箱" },
  { value: "archived", label: "已归档" },
  { value: "snoozed", label: "已搁置" },
];

const SNOOZE_OPTIONS: { label: string; until(): Date }[] = [
  { label: "1 小时后", until: () => new Date(Date.now() + 3600_000) },
  { label: "4 小时后", until: () => new Date(Date.now() + 4 * 3600_000) },
  {
    label: "明天 9:00",
    until: () => {
      const next = new Date();
      next.setDate(next.getDate() + 1);
      next.setHours(9, 0, 0, 0);
      return next;
    },
  },
  { label: "1 周后", until: () => new Date(Date.now() + 7 * 86400_000) },
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

  const itemsQuery = useQuery(
    api,
    tab === "inbox" ? "/api/inbox" : tab === "archived" ? "/api/inbox/archived" : "/api/inbox/snoozed",
    { query: { limit: 50 } },
    `${key}:${tab}`,
  );
  const unreadQuery = useQuery(api, "/api/inbox/unread-count", { pollMs: 8000 }, key);
  const snoozedIssuesQuery = useQuery(
    api,
    tab === "snoozed" ? "/api/issues" : null,
    { query: { limit: 100 }, select: (data) => asList<Issue>(data, "issues") },
    key,
  );
  const issueById = useMemo(
    () => new Map((snoozedIssuesQuery.data ?? []).map((issue) => [issue.id, issue])),
    [snoozedIssuesQuery.data],
  );
  const items = useMemo(
    () =>
      asList<InboxItem & { item_id?: string; snoozed_at?: string }>(itemsQuery.data, "items", "inbox").map((item) => {
        if (!item.item_id) return item;
        const issue = item.issue_id ? issueById.get(item.issue_id) : undefined;
        return {
          id: item.item_id,
          type: item.type ?? "issue_updated",
          issue_id: item.issue_id ?? null,
          issue_identifier: issue?.identifier ?? null,
          title: issue?.title ?? "需求更新",
          read: true,
          archived: false,
          snoozed_until: item.snoozed_until ?? null,
          created_at: item.snoozed_at ?? item.created_at ?? "",
        };
      }),
    [itemsQuery.data, issueById],
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
    } else toast.error(result.error ?? "操作失败");
  };

  const markAllRead = async (silent = false) => {
    const result = await api({ method: "POST", path: "/api/inbox/mark-all-read" });
    if (result.ok) {
      if (!silent) toast.show("收件箱已全部标记为已读", { variant: "success" });
      refreshAll();
    } else if (!silent) toast.error(result.error ?? "操作失败");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, unreadCount]);

  const archiveAll = async () => {
    setBusy(true);
    const result = await api({ method: "POST", path: "/api/inbox/archive-all" });
    setBusy(false);
    setConfirmArchiveAll(false);
    if (result.ok) {
      toast.show("已归档全部通知", { variant: "success" });
      refreshAll();
    } else toast.error(result.error ?? "归档失败");
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setBusy(true);
    const result = await api({ method: "DELETE", path: `/api/inbox/${confirmDelete.id}` });
    setBusy(false);
    if (result.ok) {
      toast.show("通知已删除", { variant: "success" });
      setConfirmDelete(null);
      refreshAll();
    } else toast.error(result.error ?? "删除失败");
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
      toast.show("已搁置该通知", { variant: "success" });
      setSnoozeItem(null);
      refreshAll();
    } else toast.error(result.error ?? "搁置失败");
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
        <Text style={{ color: ui.c.fg, fontSize: 14, fontWeight: "600" }}>收件箱</Text>
        {unreadCount > 0 ? <Tag ui={ui} label={`${unreadCount} 未读`} tone="accent" /> : null}
        <View style={ui.s.grow} />
        <Btn ui={ui} label="全部已读" icon="CheckCheck" onPress={() => void markAllRead()} />
        {tab === "inbox" ? (
          <Btn ui={ui} label="全部归档" icon="Archive" onPress={() => setConfirmArchiveAll(true)} />
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
        <Chips<Tab> ui={ui} options={TABS} value={tab} onChange={setTab} />
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
            placeholder="搜索通知标题或需求编号…"
            placeholderTextColor={ui.c.faint}
            style={{ flex: 1, color: ui.c.fg, fontSize: 13, paddingVertical: 5 }}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {search ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="清空搜索"
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
              title={tab === "inbox" ? "收件箱已清空" : tab === "archived" ? "还没有归档通知" : "没有搁置的通知"}
              description={tab === "inbox" ? "新的需求变更和智能体结果会出现在这里。" : undefined}
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
                        ? () => void action(`/api/inbox/${item.id}/read`, "POST", "已标记为已读")
                        : undefined
                    }
                    extra={
                      <View style={[ui.s.row, { gap: 2 }]}>
                        {tab === "inbox" && item.read ? (
                          <IconBtnSmall
                            ui={ui}
                            icon="MailOpen"
                            label="标记未读"
                            onPress={() => {
                              manualUnread.current = true;
                              void action(`/api/inbox/${item.id}/unread`, "POST", "已标记为未读");
                            }}
                          />
                        ) : null}
                        {tab === "inbox" ? (
                          <IconBtnSmall ui={ui} icon="AlarmClock" label="搁置通知" onPress={() => setSnoozeItem(item)} />
                        ) : null}
                        {tab === "inbox" ? (
                          <IconBtnSmall
                            ui={ui}
                            icon="Archive"
                            label="归档通知"
                            onPress={() => void action(`/api/inbox/${item.id}/archive`, "POST", "已归档")}
                          />
                        ) : null}
                        {tab === "snoozed" && item.snoozed_until ? (
                          <Text style={ui.s.tiny}>至 {shortTime(item.snoozed_until)}</Text>
                        ) : null}
                        {tab === "archived" ? (
                          <IconBtnSmall
                            ui={ui}
                            icon="ArchiveRestore"
                            label="取消归档"
                            onPress={() => void action(`/api/inbox/${item.id}/unarchive`, "POST", "已取消归档")}
                          />
                        ) : null}
                        {tab === "snoozed" ? (
                          <IconBtnSmall
                            ui={ui}
                            icon="AlarmClockOff"
                            label="取消搁置"
                            onPress={() => void action(`/api/inbox/${item.id}/unsnooze`, "POST", "已取消搁置")}
                          />
                        ) : null}
                        <IconBtnSmall
                          ui={ui}
                          icon="Trash2"
                          label="删除通知"
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
            共 {filtered.length} 条 · 最近一条 {relTime(filtered[0]?.created_at)}
          </Text>
        </View>
      ) : null}

      <Modal
        title="归档全部通知"
        icon={<Icon name="Archive" size={16} color={ui.c.muted} />}
        open={confirmArchiveAll}
        onOpenChange={setConfirmArchiveAll}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>把当前收件箱里的通知全部归档？归档后仍可在「已归档」里查看。</Text>
            <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8 }]}>
              <Btn ui={ui} label="取消" onPress={() => setConfirmArchiveAll(false)} />
              <Btn ui={ui} label="全部归档" icon="Archive" busy={busy} onPress={() => void archiveAll()} />
            </View>
          </View>
        </Modal.Content>
      </Modal>

      <Modal
        title="删除通知"
        icon={<Icon name="TriangleAlert" size={16} color={ui.c.danger} />}
        open={Boolean(confirmDelete)}
        onOpenChange={(next) => {
          if (!next) setConfirmDelete(null);
        }}
      >
        <Modal.Content>
          <View style={{ gap: 12 }}>
            <Text style={ui.s.body}>确定删除「{confirmDelete?.title}」？</Text>
            <View style={[ui.s.row, { justifyContent: "flex-end", gap: 8 }]}>
              <Btn ui={ui} label="取消" onPress={() => setConfirmDelete(null)} />
              <Btn ui={ui} label="删除" tone="danger" busy={busy} onPress={() => void remove()} />
            </View>
          </View>
        </Modal.Content>
      </Modal>

      <Modal
        title="搁置通知"
        icon={<Icon name="AlarmClock" size={16} color={ui.c.muted} />}
        open={Boolean(snoozeItem)}
        onOpenChange={(next) => {
          if (!next) setSnoozeItem(null);
        }}
      >
        <Modal.Content>
          <View style={{ gap: 10 }}>
            <Text style={ui.s.muted}>「{snoozeItem?.title}」将在选定时间后重新回到收件箱。</Text>
            <View style={{ gap: 6 }}>
              {SNOOZE_OPTIONS.map((option) => (
                <Btn ui={ui} key={option.label} label={option.label} icon="Clock" busy={busy} onPress={() => void snooze(option.until())} />
              ))}
            </View>
            <Btn ui={ui} label="取消" onPress={() => setSnoozeItem(null)} />
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
