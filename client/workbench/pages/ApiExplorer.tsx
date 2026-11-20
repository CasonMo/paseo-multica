import { Icon, Modal, copyText } from "@getpaseo/plugin/client/ui";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import {
  API_ROUTES,
  domainLabel,
  handlerLabel,
  isInternalRoute,
  routeDomain,
  type ApiRouteTuple,
  type HttpMethod,
} from "../../../shared/routes";
import { Btn, Card, Empty, ErrorNote, Tag, useUi, type Ui } from "../bits";
import { useWorkbench } from "../context";

const METHODS: (HttpMethod | "ALL")[] = ["ALL", "GET", "POST", "PUT", "PATCH", "DELETE"];

const METHOD_COLOR: Record<HttpMethod, string> = {
  GET: "#22c55e",
  POST: "#3b82f6",
  PUT: "#f59e0b",
  PATCH: "#a855f7",
  DELETE: "#ef4444",
};

const PARAM_RE = /\{([^/]+)\}/g;

function paramNames(path: string): string[] {
  return Array.from(path.matchAll(PARAM_RE)).map((match) => match[1]!);
}

export function ApiExplorerPage() {
  const ctx = useWorkbench();
  const { theme, compact } = ctx;
  const allowInternal = ctx.connections?.allowInternal ?? false;
  const ui = useUi(theme, compact);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState<HttpMethod | "ALL">("ALL");
  const [domain, setDomain] = useState<string>("all");
  const [selected, setSelected] = useState<ApiRouteTuple | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const visibleRoutes = useMemo(
    () => API_ROUTES.filter((route) => !isInternalRoute(route[1]) || allowInternal),
    [allowInternal],
  );

  const domains = useMemo(() => {
    const counts = new Map<string, number>();
    for (const route of visibleRoutes) {
      const key = routeDomain(route[1]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [visibleRoutes]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return visibleRoutes.filter((route) => {
      if (method !== "ALL" && route[0] !== method) return false;
      if (domain !== "all" && routeDomain(route[1]) !== domain) return false;
      if (!needle) return true;
      return (
        route[1].toLowerCase().includes(needle) ||
        route[2].toLowerCase().includes(needle) ||
        domainLabel(routeDomain(route[1])).includes(needle)
      );
    });
  }, [visibleRoutes, search, method, domain]);

  const open = (route: ApiRouteTuple) => {
    setSelected(route);
    if (compact) setDetailOpen(true);
  };

  const countLabel = search || method !== "ALL" || domain !== "all"
    ? `${filtered.length} / ${visibleRoutes.length}`
    : `${visibleRoutes.length} 个接口`;

  const list = (
    <View style={{ flex: 1, minWidth: 0, gap: 10 }}>
      <View style={{ gap: 8 }}>
        <View style={[ui.s.input, ui.s.row, { gap: 7, paddingVertical: 4, paddingHorizontal: 10, minHeight: 38 }]}>
          <Icon name="Search" size={14} color={ui.c.muted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="搜索路径或接口名，例如 issues / comments"
            placeholderTextColor={ui.c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={{ flex: 1, color: ui.c.fg, fontSize: 13, paddingVertical: 6 }}
          />
          {search ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="清空搜索"
              onPress={() => setSearch("")}
              style={({ pressed }) => [ui.s.iconBtn, pressed && ui.s.pressed]}
            >
              <Icon name="X" size={14} color={ui.c.muted} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {METHODS.map((item) => {
            const active = method === item;
            const color = item === "ALL" ? ui.c.accent : METHOD_COLOR[item];
            return (
              <Pressable
                accessibilityRole="button"
                key={item}
                onPress={() => setMethod(item)}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                    borderRadius: 7,
                    borderWidth: 1,
                    borderColor: active ? color : ui.c.border,
                    backgroundColor: active ? `${color}1f` : ui.c.surface1,
                  },
                  pressed && ui.s.pressed,
                ]}
              >
                <Text style={{ color: active ? color : ui.c.muted, fontSize: 12, fontWeight: "600", fontFamily: "Menlo" }}>
                  {item}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          <DomainChip ui={ui} active={domain === "all"} label="全部" count={visibleRoutes.length} onPress={() => setDomain("all")} />
          {domains.map(([key, count]) => (
            <DomainChip
              key={key}
              ui={ui}
              active={domain === key}
              label={domainLabel(key)}
              count={count}
              onPress={() => setDomain(key)}
            />
          ))}
        </ScrollView>
        <Text style={ui.s.tiny}>{countLabel} · 点击查看并直接调用</Text>
      </View>

      <Card ui={ui} padded={false}>
        <ScrollView style={{ maxHeight: compact ? undefined : 620 }} contentContainerStyle={{ paddingVertical: 4 }}>
          {filtered.length === 0 ? (
            <Empty ui={ui} icon="SearchX" title="没有匹配的接口" description="换个关键词或清空筛选条件试试。" />
          ) : (
            filtered.map((route) => {
              const active = selected?.[0] === route[0] && selected[1] === route[1];
              return (
                <Pressable
                  accessibilityRole="button"
                  key={`${route[0]} ${route[1]}`}
                  onPress={() => open(route)}
                  style={({ pressed }) => [
                    { paddingVertical: 9, paddingHorizontal: 11, gap: 3 },
                    active && { backgroundColor: ui.c.surface2 },
                    pressed && ui.s.pressed,
                  ]}
                >
                  <View style={[ui.s.row, { gap: 7 }]}>
                    <Text style={{ fontFamily: "Menlo", fontSize: 11, fontWeight: "600", color: METHOD_COLOR[route[0]], width: 48 }}>
                      {route[0]}
                    </Text>
                    <Text numberOfLines={1} style={{ fontFamily: "Menlo", fontSize: 12, color: ui.c.fg, flex: 1 }}>
                      {route[1]}
                    </Text>
                  </View>
                  <View style={[ui.s.row, { gap: 6, paddingLeft: 55 }]}>
                    <Text numberOfLines={1} style={[ui.s.tiny, { flex: 1 }]}>
                      {handlerLabel(route[2])}
                    </Text>
                    <Text style={ui.s.tiny}>{domainLabel(routeDomain(route[1]))}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </Card>
    </View>
  );

  if (compact) {
    return (
      <View style={{ flex: 1, padding: 12 }}>
        {list}
        <Modal
          title={selected ? `${selected[0]} ${selected[1]}` : "接口详情"}
          icon={<Icon name="Plug" size={16} color={ui.c.muted} />}
          open={detailOpen}
          onOpenChange={setDetailOpen}
        >
          <Modal.Content>
            {selected ? <RouteDetail ui={ui} route={selected} /> : null}
          </Modal.Content>
        </Modal>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, flexDirection: "row" }}>
      <View style={{ width: 380, borderRightWidth: 1, borderRightColor: ui.c.border, padding: 14 }}>
        <ScrollView contentContainerStyle={{ gap: 10 }}>{list}</ScrollView>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {selected ? (
          <ScrollView contentContainerStyle={{ padding: 18 }}>
            <RouteDetail ui={ui} route={selected} />
          </ScrollView>
        ) : (
          <Empty
            ui={ui}
            icon="Plug"
            title="选择左侧接口开始调试"
            description="全部 Multica 后台接口都在这里：路径参数、查询参数与请求体都可直接编辑并调用。"
          />
        )}
      </View>
    </View>
  );
}

function DomainChip({
  ui,
  active,
  label,
  count,
  onPress,
}: {
  ui: Ui;
  active: boolean;
  label: string;
  count: number;
  onPress(): void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [ui.s.chip, active && ui.s.chipActive, pressed && ui.s.pressed]}
    >
      <Text style={[ui.s.chipText, active && ui.s.chipTextActive]}>{label}</Text>
      <Text style={[ui.s.tiny, { color: active ? ui.c.accentFg : ui.c.muted }]}>{count}</Text>
    </Pressable>
  );
}

function RouteDetail({ ui, route }: { ui: Ui; route: ApiRouteTuple }) {
  const ctx = useWorkbench();
  const { api, server, toast } = ctx;
  const params = useMemo(() => paramNames(route[1]), [route]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [queryText, setQueryText] = useState("");
  const [bodyText, setBodyText] = useState("");
  const [response, setResponse] = useState<{ ok: boolean; status: number; durationMs: number; body: string; error?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setValues(Object.fromEntries(params.map((name) => [name, ""])));
    setQueryText("");
    setBodyText("");
    setResponse(null);
    setError(null);
  }, [route]);

  const hasBody = route[0] !== "GET" && route[0] !== "DELETE";

  const run = async () => {
    setError(null);
    const missing = params.find((name) => !values[name]?.trim());
    if (missing) {
      setError(`请填写路径参数 ${missing}`);
      return;
    }
    let path = route[1];
    for (const name of params) path = path.replace(`{${name}}`, encodeURIComponent(values[name]!.trim()));
    let query: Record<string, string> | undefined;
    if (queryText.trim()) {
      try {
        const parsed = JSON.parse(queryText) as Record<string, unknown>;
        query = Object.fromEntries(
          Object.entries(parsed).map(([key, value]) => [key, typeof value === "string" ? value : JSON.stringify(value)]),
        );
      } catch {
        setError("查询参数不是合法 JSON");
        return;
      }
    }
    let body: unknown;
    if (hasBody && bodyText.trim()) {
      try {
        body = JSON.parse(bodyText);
      } catch {
        setError("请求体不是合法 JSON");
        return;
      }
    }
    setBusy(true);
    const result = await api({
      method: route[0],
      path,
      query,
      body: hasBody ? body : undefined,
      allowInternal: isInternalRoute(route[1]) ? true : undefined,
    });
    setBusy(false);
    setResponse({
      ok: result.ok,
      status: result.status,
      durationMs: result.durationMs,
      error: result.error,
      body: JSON.stringify(result.data ?? (result.error ? { error: result.error, code: result.code } : null), null, 2),
    });
    if (!result.ok) toast.error(result.error ?? `请求失败 (HTTP ${result.status})`);
  };

  const curl = useMemo(() => {
    let path = route[1];
    for (const name of params) path = path.replace(`{${name}}`, values[name]?.trim() || `{${name}}`);
    const base = server?.baseUrl ?? "https://api.multica.ai";
    const parts = [`curl -X ${route[0]} '${base}${path}'`];
    parts.push(`  -H 'Authorization: Bearer $MULTICA_TOKEN'`);
    if (server?.workspaceId) parts.push(`  -H 'X-Workspace-ID: ${server.workspaceId}'`);
    if (hasBody && bodyText.trim()) {
      parts.push(`  -H 'Content-Type: application/json'`);
      parts.push(`  -d '${bodyText.replace(/'/g, "'\\''")}'`);
    }
    return parts.join(" \\\n");
  }, [route, params, values, server, hasBody, bodyText]);

  return (
    <View style={{ gap: 12 }}>
      <Card ui={ui} style={{ gap: 10 }}>
        <View style={[ui.s.row, { gap: 8 }]}>
          <Text style={{ fontFamily: "Menlo", fontSize: 12, fontWeight: "700", color: METHOD_COLOR[route[0]] }}>
            {route[0]}
          </Text>
          <Text selectable style={{ fontFamily: "Menlo", fontSize: 12, color: ui.c.fg, flex: 1 }}>
            {route[1]}
          </Text>
        </View>
        <View style={[ui.s.row, { gap: 6, flexWrap: "wrap" }]}>
          <Tag ui={ui} label={handlerLabel(route[2])} tone="muted" icon="Code" />
          <Tag ui={ui} label={domainLabel(routeDomain(route[1]))} tone="accent" />
          {isInternalRoute(route[1]) ? <Tag ui={ui} label="内部接口" tone="warning" icon="ShieldAlert" /> : null}
        </View>

        {params.length > 0 ? (
          <View style={{ gap: 8 }}>
            <Text style={ui.s.label}>路径参数</Text>
            {params.map((name) => (
              <View key={name} style={[ui.s.row, { gap: 8 }]}>
                <Text style={[ui.s.mono, { width: 96 }]} numberOfLines={1}>
                  {name}
                </Text>
                <TextInput
                  value={values[name] ?? ""}
                  onChangeText={(text) => setValues((prev) => ({ ...prev, [name]: text }))}
                  placeholder={`输入 ${name}`}
                  placeholderTextColor={ui.c.muted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={[ui.s.input, { flex: 1, minHeight: 34, paddingVertical: 6 }]}
                />
              </View>
            ))}
          </View>
        ) : null}

        <View style={{ gap: 6 }}>
          <Text style={ui.s.label}>查询参数（JSON）</Text>
          <TextInput
            value={queryText}
            onChangeText={setQueryText}
            placeholder={'{"limit": 20, "q": "关键词"}'}
            placeholderTextColor={ui.c.muted}
            autoCapitalize="none"
            autoCorrect={false}
            multiline
            style={[ui.s.input, ui.s.inputCode, { minHeight: 62, textAlignVertical: "top" }]}
          />
        </View>

        {hasBody ? (
          <View style={{ gap: 6 }}>
            <Text style={ui.s.label}>请求体（JSON）</Text>
            <TextInput
              value={bodyText}
              onChangeText={setBodyText}
              placeholder={'{"title": "新任务"}'}
              placeholderTextColor={ui.c.muted}
              autoCapitalize="none"
              autoCorrect={false}
              multiline
              style={[ui.s.input, ui.s.inputCode, { minHeight: 92, textAlignVertical: "top" }]}
            />
          </View>
        ) : null}

        {error ? <ErrorNote ui={ui} message={error} /> : null}

        <View style={[ui.s.row, { gap: 8, flexWrap: "wrap" }]}>
          <Btn ui={ui} label="发送请求" icon="Send" tone="primary" busy={busy} onPress={() => void run()} />
          <Btn
            ui={ui}
            label="复制 curl"
            icon="Terminal"
            onPress={async () => {
              await copyText(curl);
              toast.show("已复制 curl 命令", { variant: "success" });
            }}
          />
        </View>
      </Card>

      {response ? (
        <Card ui={ui} style={{ gap: 8 }}>
          <View style={[ui.s.row, { gap: 8 }]}>
            <Tag
              ui={ui}
              label={`HTTP ${response.status}`}
              tone={response.ok ? "success" : "danger"}
              icon={response.ok ? "CheckCircle2" : "XCircle"}
            />
            <Text style={ui.s.tiny}>{response.durationMs} ms</Text>
            <View style={ui.s.grow} />
            <Btn
              ui={ui}
              label="复制响应"
              icon="Copy"
              onPress={async () => {
                await copyText(response.body);
                toast.show("已复制响应", { variant: "success" });
              }}
            />
          </View>
          <Text selectable style={ui.s.code}>
            {response.body || "（空响应）"}
          </Text>
        </Card>
      ) : null}

      <Card ui={ui} style={{ gap: 6 }}>
        <Text style={ui.s.label}>curl 预览</Text>
        <Text selectable style={ui.s.code}>
          {curl}
        </Text>
        <Text style={ui.s.tiny}>API Key 只在本地服务器使用，命令中以环境变量代替，不会泄露到界面。</Text>
      </Card>
    </View>
  );
}
