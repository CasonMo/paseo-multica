import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const OFFICIAL_BASE_URL = "https://api.multica.ai";
export const OFFICIAL_WEB_URL = "https://multica.ai";

export const serverViewSchema = z.object({
  id: z.string(),
  name: z.string(),
  baseUrl: z.string(),
  workspaceId: z.string().nullable(),
  workspaceSlug: z.string().nullable(),
  tokenConfigured: z.boolean(),
  tokenMasked: z.string(),
  isOfficial: z.boolean(),
  updatedAt: z.string(),
});
export type ServerView = z.infer<typeof serverViewSchema>;

export const connectionsViewSchema = z.object({
  activeServerId: z.string().nullable(),
  servers: z.array(serverViewSchema),
  allowInternal: z.boolean(),
  storePath: z.string(),
});
export type ConnectionsView = z.infer<typeof connectionsViewSchema>;

export const saveConnectionInput = z.object({
  id: z.string().optional(),
  name: z.string(),
  baseUrl: z.string(),
  token: z.string().optional(),
  workspaceId: z.string().nullable().optional(),
});
export type SaveConnectionInput = z.infer<typeof saveConnectionInput>;

export const connectionTestInput = z.object({
  baseUrl: z.string().optional(),
  token: z.string().optional(),
  id: z.string().optional(),
  workspaceId: z.string().optional(),
});

export const remoteUserSchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string(),
  avatar_url: z.string().nullable().optional(),
});
export type RemoteUser = z.infer<typeof remoteUserSchema>;

export const remoteWorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  issue_prefix: z.string().optional(),
  description: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
});
export type RemoteWorkspace = z.infer<typeof remoteWorkspaceSchema>;

export const connectionTestOutput = z.object({
  ok: z.boolean(),
  error: z.string().optional(),
  user: remoteUserSchema.nullable().optional(),
  workspaces: z.array(remoteWorkspaceSchema).optional(),
});
export type ConnectionTestOutput = z.infer<typeof connectionTestOutput>;

const jsonValue: z.ZodType<unknown> = z.unknown();

export const apiRequestInput = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string(),
  query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
  body: jsonValue.optional(),
  serverId: z.string().optional(),
  workspaceId: z.string().nullable().optional(),
  allowInternal: z.boolean().optional(),
});

export const apiRequestOutput = z.object({
  ok: z.boolean(),
  status: z.number(),
  data: jsonValue.optional(),
  error: z.string().optional(),
  code: z.string().optional(),
  durationMs: z.number(),
});
export type ApiRequestOutput = z.infer<typeof apiRequestOutput>;

export const connectionsListRpc = defineRpc({
  name: "connections.list",
  input: z.object({}),
  output: connectionsViewSchema,
});

export const connectionsSaveRpc = defineRpc({
  name: "connections.save",
  input: saveConnectionInput,
  output: connectionsViewSchema,
});

export const connectionsRemoveRpc = defineRpc({
  name: "connections.remove",
  input: z.object({ id: z.string() }),
  output: connectionsViewSchema,
});

export const connectionsActivateRpc = defineRpc({
  name: "connections.activate",
  input: z.object({ id: z.string() }),
  output: connectionsViewSchema,
});

export const connectionsTestRpc = defineRpc({
  name: "connections.test",
  input: connectionTestInput,
  output: connectionTestOutput,
});

export const workspaceSelectRpc = defineRpc({
  name: "connections.select_workspace",
  input: z.object({ serverId: z.string(), workspaceId: z.string().nullable() }),
  output: connectionsViewSchema,
});

export const preferencesSaveRpc = defineRpc({
  name: "connections.preferences",
  input: z.object({ allowInternal: z.boolean().optional() }),
  output: connectionsViewSchema,
});

export const bootstrapRpc = defineRpc({
  name: "workbench.bootstrap",
  input: z.object({ serverId: z.string().optional() }),
  output: z.object({
    server: serverViewSchema.nullable(),
    user: remoteUserSchema.nullable(),
    workspaces: z.array(remoteWorkspaceSchema),
    error: z.string().nullable(),
    fetchedAt: z.string(),
  }),
});

export const apiRequestRpc = defineRpc({
  name: "multica.request",
  input: apiRequestInput,
  output: apiRequestOutput,
});
