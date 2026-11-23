import { t } from "./i18n";
import { openExternalUrl, useRpc } from "@getpaseo/plugin/client";
import { Icon } from "@getpaseo/plugin/client/ui";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { preferencesSaveRpc } from "../../shared/contracts";
import { useUi } from "./bits";
import { useWorkbench } from "./context";

const REPOSITORY_URL = "https://github.com/CasonMo/paseo-multica";
const ISSUE_URL = `${REPOSITORY_URL}/issues/new`;
const PULL_REQUEST_URL = `${REPOSITORY_URL}/pulls`;

function openCommunityLink(url: string) {
  void openExternalUrl(url).catch((error) => {
    console.error("Failed to open Multica community link", error);
  });
}

export function CommunityBanner() {
  const { theme, compact, connections, reloadConnections, toast } = useWorkbench();
  const ui = useUi(theme, compact);
  const savePrefs = useRpc(preferencesSaveRpc);
  const [dismissing, setDismissing] = useState(false);
  if (!connections || connections.coCreateDismissed) return null;

  const dismiss = async () => {
    if (dismissing) return;
    setDismissing(true);
    try {
      await savePrefs({ coCreateDismissed: true });
      await reloadConnections();
    } catch {
      toast.error(t("Community.8"));
    } finally {
      setDismissing(false);
    }
  };

  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 8,
        backgroundColor: ui.c.surface2,
        borderColor: ui.c.border,
        borderLeftColor: ui.c.accent,
        borderWidth: 1,
        borderLeftWidth: 3,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <View style={{ flex: 1, minWidth: compact ? "100%" : 240, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <Icon name="Sparkles" size={15} color={ui.c.accent} />
        <Text style={{ flex: 1, fontSize: 12, color: ui.c.fg, lineHeight: 18 }}>
          <Text style={{ color: ui.c.accent, fontWeight: "700" }}>{t("Community.1")}</Text>
          {` · ${t("Community.2")}`}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("Community.5")}
          hitSlop={6}
          onPress={() => openCommunityLink(ISSUE_URL)}
          style={({ pressed }) => [
            {
              minHeight: 34,
              justifyContent: "center",
              paddingHorizontal: 8,
              paddingVertical: 5,
              borderRadius: 6,
              backgroundColor: ui.c.surface1,
            },
            pressed && ui.s.pressed,
          ]}
        >
          <Text style={{ fontSize: 11, fontWeight: "600", color: ui.c.accent }}>{t("Community.3")}</Text>
        </Pressable>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={t("Community.6")}
          hitSlop={6}
          onPress={() => openCommunityLink(PULL_REQUEST_URL)}
          style={({ pressed }) => [
            {
              minHeight: 34,
              justifyContent: "center",
              paddingHorizontal: 8,
              paddingVertical: 5,
              borderRadius: 6,
              backgroundColor: ui.c.surface1,
            },
            pressed && ui.s.pressed,
          ]}
        >
          <Text style={{ fontSize: 11, fontWeight: "600", color: ui.c.accent }}>{t("Community.4")}</Text>
        </Pressable>
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("Community.7")}
        accessibilityState={{ disabled: dismissing }}
        disabled={dismissing}
        hitSlop={8}
        onPress={() => void dismiss()}
        style={{ minWidth: 28, minHeight: 28, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, paddingVertical: 2 }}
      >
        <Text style={{ fontSize: 12, color: ui.c.muted }}>✕</Text>
      </Pressable>
    </View>
  );
}
