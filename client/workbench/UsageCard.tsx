import { t } from "./i18n";
import { Icon } from "@getpaseo/plugin/client/ui";
import { Text, View } from "react-native";
import { asList, num, str, useQuery } from "./api";
import { Bars, Btn, Card, Divider, ErrorNote, SectionHeader, Stat, Tag, useUi } from "./bits";
import { useWorkbench } from "./context";

interface UsageRow {
  date?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  cache_read_tokens?: number;
  task_count?: number;
}

interface FailureRow {
  date?: string;
  failure_reason?: string;
  task_count?: number;
}

interface RuntimeRow {
  date?: string;
  total_seconds?: number;
  task_count?: number;
  failed_count?: number;
  cancelled_count?: number;
}

function compact(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function duration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return t("UsageCard.1");
  if (seconds < 60) return t("UsageCard.2", { a: Math.round(seconds) });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t("UsageCard.3", { a: minutes });
  const hours = Math.floor(minutes / 60);
  return t("UsageCard.4", { a: hours, b: minutes % 60 });
}

export function UsageCard() {
  const ctx = useWorkbench();
  const ui = useUi(ctx.theme, ctx.compact);
  const key = `${ctx.workspaceId}:${ctx.bump}`;

  const daily = useQuery(ctx.api, "/api/dashboard/usage/daily", { select: (data) => asList<UsageRow>(data) }, key);
  const failures = useQuery(ctx.api, "/api/dashboard/failures/daily", { select: (data) => asList<FailureRow>(data) }, key);
  const runtime = useQuery(ctx.api, "/api/dashboard/runtime/daily", { select: (data) => asList<RuntimeRow>(data) }, key);

  const days = new Map<string, { tokens: number; tasks: number }>();
  for (const row of daily.data ?? []) {
    const date = str(row.date);
    if (!date) continue;
    const entry = days.get(date) ?? { tokens: 0, tasks: 0 };
    entry.tokens += num(row.input_tokens) + num(row.output_tokens);
    entry.tasks += num(row.task_count);
    days.set(date, entry);
  }
  const points = Array.from(days.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7)
    .map(([date, entry]) => ({ label: date.slice(5), value: entry.tokens }));

  const totalTokens = Array.from(days.values()).reduce((sum, entry) => sum + entry.tokens, 0);
  const totalTasks = Array.from(days.values()).reduce((sum, entry) => sum + entry.tasks, 0);

  const failureRows = (failures.data ?? []).filter((row) => str(row.failure_reason));
  const failureCount = failureRows.reduce((sum, row) => sum + num(row.task_count), 0);
  const reasons = new Map<string, number>();
  for (const row of failureRows) {
    const reason = str(row.failure_reason);
    reasons.set(reason, (reasons.get(reason) ?? 0) + num(row.task_count));
  }

  const runtimeSeconds = (runtime.data ?? []).reduce((sum, row) => sum + num(row.total_seconds), 0);
  const runtimeTasks = (runtime.data ?? []).reduce((sum, row) => sum + num(row.task_count), 0);

  const loading = daily.loading && !daily.data;
  const refresh = () => {
    daily.refresh();
    failures.refresh();
    runtime.refresh();
  };

  return (
    <Card ui={ui} style={{ gap: 12 }}>
      <SectionHeader
        ui={ui}
        title={t("UsageCard.5")}
        trailing={<Btn ui={ui} label={t("Nav.14")} icon="RefreshCw" onPress={refresh} />}
      />
      {daily.error ? <ErrorNote ui={ui} message={daily.error} onRetry={daily.refresh} /> : null}
      <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
        <Stat ui={ui} label="Tokens" value={loading ? "…" : compact(totalTokens)} icon="Cpu" hint={t("UsageCard.7")} />
        <Stat ui={ui} label={t("RuntimeDetail.9")} value={loading ? "…" : totalTasks} icon="CheckCircle2" hint={t("UsageCard.9")} />
        <Stat
          ui={ui}
          label={t("UsageCard.10")}
          value={failures.loading && !failures.data ? "…" : failureCount}
          icon="AlertTriangle"
          tone={failureCount > 0 ? ui.c.danger : undefined}
          hint={t("UsageCard.11", { a: failureRows.length })}
        />
        <Stat
          ui={ui}
          label={t("UsageCard.12")}
          value={runtimeTasks > 0 ? duration(runtimeSeconds / runtimeTasks) : "—"}
          icon="Timer"
          hint={t("UsageCard.13", { a: runtimeTasks })}
        />
      </View>

      {points.length > 0 ? (
        <View style={{ gap: 6 }}>
          <View style={[ui.s.row, { justifyContent: "space-between" }]}>
            <Text style={ui.s.label}>{t("UsageCard.14")}</Text>
            <Text style={ui.s.tiny}>{points.map((point) => point.label).join(" · ")}</Text>
          </View>
          <Bars ui={ui} points={points} height={56} />
        </View>
      ) : null}

      {reasons.size > 0 ? (
        <>
          <Divider ui={ui} />
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>{t("UsageCard.15")}</Text>
            {Array.from(reasons.entries())
              .sort(([, a], [, b]) => b - a)
              .slice(0, 4)
              .map(([reason, count]) => (
                <View key={reason} style={[ui.s.row, { gap: 8 }]}>
                  <Icon name="AlertTriangle" size={13} color={ui.c.warning} />
                  <Text numberOfLines={1} style={[ui.s.tiny, { flex: 1, fontFamily: "Menlo" }]}>
                    {reason}
                  </Text>
                  <Tag ui={ui} label={t("UsageCard.16", { a: count })} tone="warning" />
                </View>
              ))}
          </View>
        </>
      ) : null}
    </Card>
  );
}
