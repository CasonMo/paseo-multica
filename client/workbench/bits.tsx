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

export type Tone = "default" | "accent" | "success" | "warning" | "danger" | "muted";

export function useUi(theme: PluginTheme, compact: boolean) {
  return useMemo(() => {
    const c = theme.colors;
    const styles = StyleSheet.create({
      card: {
        backgroundColor: c.surface1,
        borderColor: c.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 14,
      },
      cardPad: { padding: compact ? 12 : 16 },
      row: { flexDirection: "row", alignItems: "center" },
      rowTop: { flexDirection: "row", alignItems: "flex-start" },
      grow: { flex: 1, minWidth: 0 },
      gap4: { gap: 4 },
      gap6: { gap: 6 },
      gap8: { gap: 8 },
      gap12: { gap: 12 },
      gap16: { gap: 16 },
      title: { color: c.foreground, fontSize: 20, fontWeight: "700", letterSpacing: -0.3 },
      h2: { color: c.foreground, fontSize: 15, fontWeight: "600" },
      h3: { color: c.foreground, fontSize: 14, fontWeight: "600" },
      body: { color: c.foreground, fontSize: 13.5, lineHeight: 20 },
      muted: { color: c.foregroundMuted, fontSize: 12.5 },
      tiny: { color: c.foregroundMuted, fontSize: 11.5 },
      mono: { color: c.foreground, fontSize: 12, fontFamily: "Menlo" },
      label: {
        color: c.foregroundMuted,
        fontSize: 11,
        fontWeight: "600",
        letterSpacing: 0.5,
        textTransform: "uppercase",
      },
      press: { borderRadius: 8 },
      pressed: { opacity: 0.65 },
      divider: { height: StyleSheet.hairlineWidth, backgroundColor: c.border },
      input: {
        backgroundColor: c.surface0,
        borderColor: c.border,
        borderWidth: 1,
        borderRadius: 9,
        paddingHorizontal: 11,
        paddingVertical: 9,
        color: c.foreground,
        fontSize: 13.5,
        minHeight: 38,
      },
      inputMulti: { minHeight: 110, textAlignVertical: "top", paddingTop: 10 },
      inputCode: { fontFamily: "Menlo", fontSize: 12 },
      chip: {
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface1,
      },
      chipActive: { backgroundColor: c.accent, borderColor: c.accent },
      chipText: { color: c.foreground, fontSize: 12, fontWeight: "500" },
      chipTextActive: { color: c.accentForeground },
      btn: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        paddingHorizontal: 13,
        paddingVertical: 8,
        borderRadius: 9,
        borderWidth: 1,
        borderColor: c.border,
        backgroundColor: c.surface2,
        minHeight: 36,
      },
      btnPrimary: { backgroundColor: c.accent, borderColor: c.accent },
      btnDanger: { backgroundColor: "transparent", borderColor: c.statusDanger },
      btnGhost: { backgroundColor: "transparent" },
      btnDisabled: { opacity: 0.45 },
      btnText: { color: c.foreground, fontSize: 13, fontWeight: "600" },
      btnTextPrimary: { color: c.accentForeground },
      btnTextDanger: { color: c.statusDanger },
      iconBtn: { padding: 7, borderRadius: 8 },
      badge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 6,
        borderWidth: 1,
      },
      badgeText: { fontSize: 11, fontWeight: "600" },
      dot: { width: 7, height: 7, borderRadius: 4 },
      avatar: { alignItems: "center", justifyContent: "center", overflow: "hidden" },
      avatarText: { fontWeight: "700" },
      empty: { alignItems: "center", justifyContent: "center", paddingVertical: 36, gap: 8 },
      statValue: { color: c.foreground, fontSize: 26, fontWeight: "700", letterSpacing: -0.6 },
      statLabel: { color: c.foregroundMuted, fontSize: 11.5, fontWeight: "500" },
      listRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: compact ? 12 : 14,
      },
      hoverSurface: { backgroundColor: c.surface2 },
      table: { borderTopWidth: StyleSheet.hairlineWidth, borderColor: c.border },
      navItem: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        borderRadius: 9,
        minHeight: 38,
      },
      navActive: { backgroundColor: c.surface2 },
      navText: { color: c.foregroundMuted, fontSize: 13, fontWeight: "500" },
      navTextActive: { color: c.foreground, fontWeight: "600" },
      kbd: {
        borderWidth: 1,
        borderColor: c.border,
        borderRadius: 5,
        paddingHorizontal: 5,
        paddingVertical: 1,
      },
      code: {
        backgroundColor: c.surface0,
        borderColor: c.border,
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: 8,
        padding: 10,
        fontFamily: "Menlo",
        fontSize: 11.5,
        color: c.foreground,
      },
      bar: { borderRadius: 3, backgroundColor: c.accent, opacity: 0.85 },
      barTrack: { flex: 1, justifyContent: "flex-end" },
    });

    const palette = {
      c,
      accent: c.accent,
      accentFg: c.accentForeground,
      success: c.statusSuccess,
      warning: c.statusWarning,
      danger: c.statusDanger,
      muted: c.foregroundMuted,
      border: c.border,
      surface0: c.surface0,
      surface1: c.surface1,
      surface2: c.surface2,
      fg: c.foreground,
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

export function Divider({ ui, style }: { ui: Ui; style?: StyleProp<ViewStyle> }) {
  return <View style={[ui.s.divider, style]} />;
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
        <ActivityIndicator size="small" color={tone === "primary" ? ui.c.c.accentForeground : ui.c.fg} />
      ) : icon ? (
        <Icon name={icon} size={15} color={tone === "primary" ? ui.c.c.accentForeground : tone === "danger" ? ui.c.danger : ui.c.fg} />
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
  size = 17,
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
  return (
    <View style={[ui.s.badge, { borderColor: `${toneColor}55`, backgroundColor: `${toneColor}18` }]}>
      {icon ? <Icon name={icon} size={11} color={toneColor} /> : null}
      <Text style={[ui.s.badgeText, { color: toneColor }]}>{label}</Text>
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
          backgroundColor: color ?? `${ui.c.accent}30`,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: ui.c.border,
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
        placeholderTextColor={ui.c.muted}
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
            onPress={() => onChange(option.value)}
            style={({ pressed }) => [ui.s.chip, active && ui.s.chipActive, pressed && ui.s.pressed]}
          >
            {option.icon ? <Icon name={option.icon} size={12} color={active ? ui.c.c.accentForeground : ui.c.muted} /> : null}
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
          borderRadius: 22,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: ui.c.surface2,
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
        borderRadius: 10,
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
