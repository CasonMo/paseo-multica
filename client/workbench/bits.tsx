import type { PluginTheme } from "@getpaseo/plugin";
import { Icon } from "@getpaseo/plugin/client/ui";
import type { ReactNode } from "react";
import { useMemo } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { pickTextColor } from "./model";

export type Tone = "default" | "accent" | "success" | "warning" | "danger" | "muted";

const LIGHT = {
  fg: "#09090b",
  muted: "#64636e",
  faint: "#81818b",
  shell: "#f3f3f4",
  canvas: "#fbfbfb",
  card: "#ffffff",
  fill: "#f4f4f5",
  fillStrong: "#e9e9eb",
  border: "#e4e4e7",
  line: "#ececef",
  primary: "#18181b",
  primaryFg: "#fafafa",
  brand: "#0070e3",
  success: "#1c882d",
  warning: "#dba400",
  danger: "#e40014",
  info: "#0074c9",
  high: "#ec6f00",
  shadow: "0 1px 2px rgba(15,23,42,0.04), 0 1px 1px rgba(15,23,42,0.03)",
  shadowLift: "0 8px 24px rgba(15,23,42,0.08), 0 2px 6px rgba(15,23,42,0.05)",
  scrim: "rgba(15,23,42,0.32)",
  scrollThumb: "rgba(0,0,0,0.10)",
  scrollThumbHover: "rgba(0,0,0,0.18)",
};

const DARK: typeof LIGHT = {
  fg: "#fafafa",
  muted: "#c8ccd8",
  faint: "#a0a4b2",
  shell: "#21252d",
  canvas: "#282c34",
  card: "#2f333d",
  fill: "#383c48",
  fillStrong: "#4a4f5e",
  border: "#3f4454",
  line: "#454b5b",
  primary: "#fafafa",
  primaryFg: "#282c34",
  brand: "#7aa2f7",
  success: "#3fb950",
  warning: "#e3b341",
  danger: "#ff7b72",
  info: "#58a6ff",
  high: "#f0883e",
  shadow: "0 1px 2px rgba(0,0,0,0.28), 0 1px 1px rgba(0,0,0,0.20)",
  shadowLift: "0 8px 24px rgba(0,0,0,0.42), 0 2px 6px rgba(0,0,0,0.30)",
  scrim: "rgba(16,18,24,0.62)",
  scrollThumb: "rgba(255,255,255,0.16)",
  scrollThumbHover: "rgba(255,255,255,0.26)",
};

function isDark(surface: string): boolean {
  const hex = surface.replace("#", "");
  if (hex.length < 6) return false;
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
}

const CHROME_ID = "multica-workbench-chrome";
const CHROME_CSS = `
[data-testid="multica-workbench"] * { scrollbar-width: thin; }
[data-testid="multica-workbench"] ::-webkit-scrollbar { width: 10px; height: 10px; }
[data-testid="multica-workbench"] ::-webkit-scrollbar-track { background: transparent; }
[data-testid="multica-workbench"] ::-webkit-scrollbar-corner { background: transparent; }
[data-testid="multica-workbench"] ::-webkit-scrollbar-thumb {
  border: 3px solid transparent; background-clip: content-box; border-radius: 999px;
}
`;

type ChromeStyle = { textContent: string };
type ChromeDoc = {
  createElement(tag: "style"): ChromeStyle & { id: string };
  getElementById(id: string): ChromeStyle | null;
  head: { appendChild(node: unknown): void };
};

/** The host leaves scrollbars and text font at the browser default; both read as "not Multica". */
export function injectChrome(dark: boolean) {
  const doc = (globalThis as { document?: ChromeDoc }).document;
  if (!doc) return;
  let style = doc.getElementById(CHROME_ID);
  if (!style) {
    const created = doc.createElement("style");
    created.id = CHROME_ID;
    doc.head.appendChild(created);
    style = created;
  }
  const t = dark ? DARK : LIGHT;
  style.textContent =
    CHROME_CSS +
    `[data-testid="multica-workbench"] * { scrollbar-color: ${t.scrollThumb} transparent; }
[data-testid="multica-workbench"] ::-webkit-scrollbar-thumb { background-color: ${t.scrollThumb}; }
[data-testid="multica-workbench"] ::-webkit-scrollbar-thumb:hover { background-color: ${t.scrollThumbHover}; }
`;
}

export function useUi(theme: PluginTheme, compact: boolean) {
  return useMemo(() => {
    const dark = isDark(theme.colors.surface0);
    const t = dark ? DARK : LIGHT;
    const styles = StyleSheet.create({
      card: {
        backgroundColor: t.card,
        borderColor: t.border,
        borderWidth: 1,
        borderRadius: 12,
        boxShadow: t.shadow,
      },
      cardPad: { padding: compact ? 12 : 16 },
      panel: {
        backgroundColor: t.card,
        borderColor: t.border,
        borderWidth: 1,
        borderRadius: 12,
        overflow: "hidden",
        boxShadow: t.shadow,
      },
      menu: {
        backgroundColor: t.card,
        borderColor: t.border,
        borderWidth: 1,
        borderRadius: 12,
        padding: 6,
        boxShadow: t.shadowLift,
      },
      menuItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 32,
        paddingHorizontal: 8,
        paddingVertical: 6,
        borderRadius: 6,
      },
      row: { flexDirection: "row", alignItems: "center" },
      rowTop: { flexDirection: "row", alignItems: "flex-start" },
      grow: { flex: 1, minWidth: 0 },
      gap4: { gap: 4 },
      gap6: { gap: 6 },
      gap8: { gap: 8 },
      gap12: { gap: 12 },
      gap16: { gap: 16 },
      title: { color: t.fg, fontSize: 20, fontWeight: "600", letterSpacing: -0.2 },
      h2: { color: t.fg, fontSize: 14, fontWeight: "600" },
      h3: { color: t.fg, fontSize: 13, fontWeight: "600" },
      sectionHead: { color: t.fg, fontSize: 13, fontWeight: "500" },
      body: { color: t.fg, fontSize: 14, lineHeight: 20 },
      muted: { color: t.muted, fontSize: 13 },
      tiny: { color: t.muted, fontSize: 12 },
      idText: { color: t.muted, fontSize: 12 },
      mono: { color: t.fg, fontSize: 12, fontFamily: "Menlo" },
      label: { color: t.muted, fontSize: 12, fontWeight: "500" },
      press: { borderRadius: 8 },
      pressed: { opacity: 0.65 },
      divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.line },
      input: {
        backgroundColor: t.card,
        borderColor: t.border,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 11,
        paddingVertical: 8,
        color: t.fg,
        fontSize: 14,
        minHeight: 32,
      },
      inputMulti: { minHeight: 110, textAlignVertical: "top", paddingTop: 10 },
      inputCode: { fontFamily: "Menlo", fontSize: 12 },
      chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "transparent",
        backgroundColor: t.fill,
      },
      chipActive: { backgroundColor: t.card, borderColor: t.border, boxShadow: t.shadow },
      chipText: { color: t.muted, fontSize: 13, fontWeight: "500" },
      chipTextActive: { color: t.fg, fontWeight: "600" },
      btn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.card,
        minHeight: 32,
      },
      btnPrimary: { backgroundColor: t.primary, borderColor: t.primary },
      btnDanger: { backgroundColor: "transparent", borderColor: t.danger },
      btnGhost: { backgroundColor: "transparent", borderColor: "transparent" },
      btnDisabled: { opacity: 0.45 },
      btnText: { color: t.fg, fontSize: 13, fontWeight: "500" },
      btnTextPrimary: { color: t.primaryFg },
      btnTextDanger: { color: t.danger },
      iconBtn: { padding: 6, borderRadius: 6 },
      badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
      },
      badgeText: { fontSize: 12, fontWeight: "500" },
      dot: { width: 7, height: 7, borderRadius: 4 },
      avatar: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
      avatarText: { fontWeight: "600" },
      empty: { alignItems: "center", justifyContent: "center", paddingVertical: 36, gap: 8 },
      statValue: { color: t.fg, fontSize: 24, fontWeight: "600", letterSpacing: -0.4 },
      statLabel: { color: t.muted, fontSize: 12, fontWeight: "500" },
      listRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        minHeight: 32,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 6,
      },
      hoverSurface: { backgroundColor: t.fill },
      table: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: t.line },
      navItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        minHeight: 32,
      },
      navActive: { backgroundColor: t.fillStrong },
      navText: { color: t.muted, fontSize: 14, fontWeight: "400" },
      navTextActive: { color: t.fg, fontWeight: "500" },
      kbd: {
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: 5,
        paddingHorizontal: 5,
        paddingVertical: 1,
      },
      code: {
        backgroundColor: t.fill,
        borderColor: t.line,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 6,
        padding: 10,
        fontFamily: "Menlo",
        fontSize: 12,
        color: t.fg,
      },
      bar: { borderRadius: 3, backgroundColor: t.brand, opacity: 0.9 },
      barTrack: { flex: 1, justifyContent: "flex-end" },
    });

    const palette = {
      ...t,
      dark,
      accent: t.brand,
      accentFg: "#ffffff",
      surface0: t.canvas,
      surface1: t.card,
      surface2: t.fill,
    };
    return { c: palette, s: styles, compact };
  }, [theme, compact]);
}

export type Ui = ReturnType<typeof useUi>;

export function Card({
  ui,
  children,
  style,
  padded = true,
}: {
  ui: Ui;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  return <View style={[ui.s.card, padded && ui.s.cardPad, style]}>{children}</View>;
}

export function Divider({ ui, style, color }: { ui: Ui; style?: StyleProp<ViewStyle>; color?: string }) {
  return <View style={[ui.s.divider, color ? { backgroundColor: color } : null, style]} />;
}

export function Btn({
  ui,
  label,
  icon,
  onPress,
  tone = "ghost",
  disabled,
  busy,
  style,
}: {
  ui: Ui;
  label?: string;
  icon?: string;
  onPress(): void;
  tone?: "ghost" | "primary" | "danger";
  disabled?: boolean;
  busy?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const textStyle: TextStyle[] = [ui.s.btnText];
  if (tone === "primary") textStyle.push(ui.s.btnTextPrimary);
  if (tone === "danger") textStyle.push(ui.s.btnTextDanger);
  const ink = tone === "primary" ? ui.c.primaryFg : tone === "danger" ? ui.c.danger : ui.c.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => [
        ui.s.btn,
        tone === "primary" && ui.s.btnPrimary,
        tone === "danger" && ui.s.btnDanger,
        tone === "ghost" && ui.s.btnGhost,
        (disabled || busy) && ui.s.btnDisabled,
        pressed && ui.s.pressed,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={ink} />
      ) : icon ? (
        <Icon name={icon} size={15} color={ink} />
      ) : null}
      {label ? <Text style={textStyle}>{label}</Text> : null}
    </Pressable>
  );
}

export function IconBtn({
  ui,
  icon,
  onPress,
  label,
  color,
  size = 16,
  busy,
}: {
  ui: Ui;
  icon: string;
  onPress(): void;
  label: string;
  color?: string;
  size?: number;
  busy?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={busy}
      onPress={onPress}
      style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color ?? ui.c.muted} />
      ) : (
        <Icon name={icon} size={size} color={color ?? ui.c.muted} />
      )}
    </Pressable>
  );
}

export function Tag({
  ui,
  label,
  color,
  tone = "default",
  icon,
}: {
  ui: Ui;
  label: string;
  color?: string;
  tone?: Tone;
  icon?: string;
}) {
  const toneColor =
    color ??
    (tone === "accent"
      ? ui.c.accent
      : tone === "success"
        ? ui.c.success
        : tone === "warning"
          ? ui.c.warning
          : tone === "danger"
            ? ui.c.danger
            : tone === "muted"
              ? ui.c.muted
              : ui.c.fg);
  const ink = pickTextColor(toneColor);
  return (
    <View style={[ui.s.badge, { backgroundColor: toneColor }]}>
      {icon ? <Icon name={icon} size={11} color={ink} /> : null}
      <Text style={[ui.s.badgeText, { color: ink }]}>{label}</Text>
    </View>
  );
}

export function Dot({ color, size = 7 }: { color: string; size?: number }) {
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />;
}

export function Avatar({
  name,
  url,
  size = 28,
  color,
  ui,
}: {
  name: string | null | undefined;
  url?: string | null;
  size?: number;
  color?: string;
  ui: Ui;
}) {
  const initials = (name ?? "?").trim().slice(0, 2).toUpperCase() || "?";
  return (
    <View
      style={[
        ui.s.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color ?? `${ui.c.accent}24`,
        },
      ]}
    >
      {url ? (
        <Image source={{ uri: url }} style={{ width: size, height: size }} />
      ) : (
        <Text style={[ui.s.avatarText, { color: color ?? ui.c.fg, fontSize: Math.max(9, size * 0.36) }]}>{initials}</Text>
      )}
    </View>
  );
}

export function Field({
  ui,
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry,
  multiline,
  code,
  autoFocus,
  hint,
}: {
  ui: Ui;
  label?: string;
  value: string;
  onChangeText(value: string): void;
  placeholder?: string;
  secureTextEntry?: boolean;
  multiline?: boolean;
  code?: boolean;
  autoFocus?: boolean;
  hint?: string;
}) {
  return (
    <View style={ui.s.gap6}>
      {label ? <Text style={ui.s.label}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={ui.c.faint}
        secureTextEntry={secureTextEntry}
        multiline={multiline}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect={false}
        style={[
          ui.s.input,
          multiline && ui.s.inputMulti,
          code && ui.s.inputCode,
        ]}
      />
      {hint ? <Text style={ui.s.tiny}>{hint}</Text> : null}
    </View>
  );
}

export function Chips<T extends string>({
  ui,
  options,
  value,
  onChange,
}: {
  ui: Ui;
  options: readonly { value: T; label: string; icon?: string }[];
  value: T;
  onChange(value: T): void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[ui.s.row, ui.s.gap6]}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            accessibilityRole="button"
            key={option.value}
            accessibilityLabel={option.label}
            accessibilityState={{ selected: active }}
            aria-selected={active}
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [ui.s.chip, active && ui.s.chipActive, pressed && ui.s.pressed]}
          >
            {option.icon ? <Icon name={option.icon} size={12} color={active ? ui.c.fg : ui.c.muted} /> : null}
            <Text style={[ui.s.chipText, active && ui.s.chipTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Empty({
  ui,
  icon,
  title,
  description,
  action,
}: {
  ui: Ui;
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <View style={ui.s.empty}>
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: ui.c.fill,
        }}
      >
        <Icon name={icon} size={20} color={ui.c.muted} />
      </View>
      <Text style={[ui.s.h2, { textAlign: "center" }]}>{title}</Text>
      {description ? <Text style={[ui.s.muted, { textAlign: "center", maxWidth: 380 }]}>{description}</Text> : null}
      {action ? <View style={{ marginTop: 6 }}>{action}</View> : null}
    </View>
  );
}

export function LoadingRow({ ui, label = "加载中…" }: { ui: Ui; label?: string }) {
  return (
    <View style={[ui.s.row, ui.s.gap8, { paddingVertical: 24, justifyContent: "center" }]}>
      <ActivityIndicator size="small" color={ui.c.muted} />
      <Text style={ui.s.muted}>{label}</Text>
    </View>
  );
}

export function ErrorNote({ ui, message, onRetry }: { ui: Ui; message: string; onRetry?: () => void }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderColor: `${ui.c.danger}55`,
        borderWidth: 1,
        backgroundColor: `${ui.c.danger}12`,
        borderRadius: 8,
        padding: 10,
      }}
    >
      <Icon name="AlertCircle" size={16} color={ui.c.danger} />
      <Text style={[ui.s.muted, { color: ui.c.danger, flex: 1 }]}>{message}</Text>
      {onRetry ? <Btn ui={ui} label="重试" onPress={onRetry} /> : null}
    </View>
  );
}

export function Stat({
  ui,
  label,
  value,
  hint,
  icon,
  tone,
  onPress,
}: {
  ui: Ui;
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: string;
  tone?: string;
  onPress?: () => void;
}) {
  const body = (
    <Card ui={ui} style={{ flex: 1, minWidth: 120 }}>
      <View style={[ui.s.row, { justifyContent: "space-between" }]}>
        <Text style={ui.s.statLabel}>{label}</Text>
        {icon ? <Icon name={icon} size={14} color={tone ?? ui.c.muted} /> : null}
      </View>
      <Text style={[ui.s.statValue, { marginTop: 6, color: tone ?? ui.c.fg }]}>{value}</Text>
      {hint ? <Text style={ui.s.tiny}>{hint}</Text> : null}
    </Card>
  );
  if (!onPress) return body;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [{ flex: 1 }, pressed && ui.s.pressed]}
    >
      {body}
    </Pressable>
  );
}

export function Bars({
  ui,
  points,
  height = 64,
  color,
}: {
  ui: Ui;
  points: { label: string; value: number }[];
  height?: number;
  color?: string;
}) {
  const max = Math.max(1, ...points.map((point) => point.value));
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: 4, height }}>
      {points.map((point, index) => (
        <View key={`${point.label}-${index}`} style={[ui.s.barTrack, { height }]}>
          <View
            style={[
              ui.s.bar,
              {
                height: Math.max(3, Math.round((point.value / max) * height)),
                backgroundColor: color ?? ui.c.accent,
              },
            ]}
          />
        </View>
      ))}
    </View>
  );
}

export function SectionHeader({ ui, title, trailing }: { ui: Ui; title: string; trailing?: ReactNode }) {
  return (
    <View style={[ui.s.row, { justifyContent: "space-between", marginBottom: 8 }]}>
      <Text style={ui.s.h2}>{title}</Text>
      {trailing}
    </View>
  );
}

export function KV({ ui, k, v }: { ui: Ui; k: string; v: ReactNode }) {
  return (
    <View style={[ui.s.rowTop, { paddingVertical: 5, gap: 10 }]}>
      <Text style={[ui.s.muted, { width: 88 }]}>{k}</Text>
      {typeof v === "string" ? <Text style={[ui.s.body, { flex: 1 }]}>{v}</Text> : <View style={{ flex: 1 }}>{v}</View>}
    </View>
  );
}

export function ErrorBoundaryNote({ ui, error }: { ui: Ui; error: unknown }) {
  return (
    <View style={{ padding: 16 }}>
      <ErrorNote ui={ui} message={error instanceof Error ? error.message : String(error)} />
    </View>
  );
}