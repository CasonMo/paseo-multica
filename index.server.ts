import type { PluginServerContext } from "@getpaseo/plugin/server";
import {
  apiRequestRpc,
  bootstrapRpc,
  connectionsActivateRpc,
  connectionsListRpc,
  connectionsRemoveRpc,
  connectionsSaveRpc,
  connectionsTestRpc,
  inboxBadgeRpc,
  issueInsightsRpc,
  preferencesSaveRpc,
  taskLogRpc,
  workspaceSelectRpc,
} from "./shared/contracts";
import { createHandlers } from "./server/handlers";
import { connectionsStorePath } from "./server/store";

export default function contribute(server: PluginServerContext) {
  const handlers = createHandlers();
  server.handle(connectionsListRpc, handlers.list);
  server.handle(connectionsSaveRpc, handlers.save);
  server.handle(connectionsRemoveRpc, handlers.remove);
  server.handle(connectionsActivateRpc, handlers.activate);
  server.handle(connectionsTestRpc, handlers.test);
  server.handle(workspaceSelectRpc, handlers.selectWorkspace);
  server.handle(preferencesSaveRpc, handlers.preferences);
  server.handle(bootstrapRpc, handlers.bootstrap);
  server.handle(apiRequestRpc, handlers.request);
  server.handle(inboxBadgeRpc, handlers.inboxBadge);
  server.handle(issueInsightsRpc, handlers.issueInsights);
  server.handle(taskLogRpc, handlers.taskLog);

  console.log(`[multica] server ready, connections: ${connectionsStorePath()}`);
  return () => {};
}