import { Icon, Modal } from "@getpaseo/plugin/client/ui";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Btn, Card, Chips, Divider, Empty, ErrorNote, LoadingRow, Tag, useUi } from "../bits";
import { asList, asRecord, num, useQuery } from "../api";
import { useWorkbench } from "../context";
import { relTime, type InboxItem } from "../model";
import { InboxRow } from "../parts";

type Tab = "inbox" | "archived" | "snoozed";

const TABS: { value: Tab; label: string }[] = [
  { value: "inbox", label: "收件箱" },
  { value: "archived", label: "已归档" },
  { value: "snoozed", label: "已搁置" },
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
  const [busy, setBusy] = useState(false);

  const itemsQuery = useQuery(
    api,
    tab === "inbox" ? "/api/inbox" : tab === "archived" ? "/api/inbox/archived" : "/api/inbox/snoozed",
    { query: { limit: 50 } },
    `${key}:${tab}`,
  );
  const unreadQuery = useQuery(api, "/api/inbox/unread-count", {}, key);
  const items = asList<InboxItem>(itemsQuery.data, "items", "inbox");
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
  };

  const action = async (path: string, method: "POST" | "DELETE", message: string) => {
    const result = await api({ method, path });
    if (result.ok) {
      toast.show(message, { variant: "success" });
      refreshAll();
    } else toast.error(result.error ?? "操作失败");
  };

  const markAllRead = async () => {
    const result = await api({ method: "POST", path: "/api/inbox/mark-all-read" });
    if (result.ok) {
      toast.show("收件箱已全部标记为已读", { variant: "success" });
      refreshAll();
    } else toast.error(result.error ?? "操作失败");
  };

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

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: compact ? 12 : 18, gap: 12, paddingBottom: 48 }}>
        <View style={[ui.s.row, { gap: 10, flexWrap: "wrap" }]}>
          <View style={ui.s.grow}>
            <View style={[ui.s.row, { gap: 8 }]}>
              <Text style={[ui.s.title, { fontSize: compact ? 18 : 21 }]}>收件箱</Text>
              {unreadCount > 0 ? <Tag ui={ui} label={`${unreadCount} 未读`} tone="accent" /> : null}
            </View>
            <Text style={ui.s.muted}>需求流转、智能体结果与 @ 提醒都在这里</Text>
          </View>
          <View style={[ui.s.row, { gap: 6 }]}>
            <Btn ui={ui} label="全部已读" icon="CheckCheck" onPress={() => void markAllRead()} />
            {tab === "inbox" ? (
              <Btn ui={ui} label="全部归档" icon="Archive" onPress={() => setConfirmArchiveAll(true)} />
            ) : null}
          </View>
        </View>

        <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
          <Chips<Tab> ui={ui} options={TABS} value={tab} onChange={setTab} />
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
            placeholder="搜索通知标题或需求编号…"
            placeholderTextColor={ui.c.muted}
            style={{ flex: 1, color: ui.c.fg, fontSize: 13, paddingVertical: 8 }}
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
            <View style={{ paddingBottom: 6 }}>
              {filtered.map((item, index) => (
                <View key={item.id}>
                  {index > 0 ? <Divider ui={ui} style={{ marginHorizontal: 14 }} /> : null}
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
                            onPress={() => void action(`/api/inbox/${item.id}/unread`, "POST", "已标记为未读")}
                          />
                        ) : null}
                        {tab === "inbox" ? (
                          <IconBtnSmall
                            ui={ui}
                            icon="Archive"
                            label="归档通知"
                            onPress={() => void action(`/api/inbox/${item.id}/archive`, "POST", "已归档")}
                          />
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

        {filtered.length > 0 ? (
          <Text style={[ui.s.tiny, { textAlign: "center" }]}>
            共 {filtered.length} 条 · 最近一条 {relTime(filtered[0]?.created_at)}
          </Text>
        ) : null}
      </ScrollView>

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
    </View>
  );
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
