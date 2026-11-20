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
  wecomListRpc,
  wecomPushRpc,
  wecomRemoveRpc,
  wecomSaveRpc,
  wecomTestRpc,
  wecomUnbindRpc,
} from "./shared/contracts";
import { createHandlers } from "./server/handlers";
import { connectionsStorePath } from "./server/store";
import { wecomBridge } from "./server/wecomBridge";

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
  server.handle(wecomListRpc, handlers.wecomList);
  server.handle(wecomSaveRpc, handlers.wecomSave);
  server.handle(wecomRemoveRpc, handlers.wecomRemove);
  server.handle(wecomTestRpc, handlers.wecomTest);
  server.handle(wecomPushRpc, handlers.wecomPush);
  server.handle(wecomUnbindRpc, handlers.wecomUnbind);

  void wecomBridge.apply().catch((cause) => console.error("[multica] wecom start failed", cause));

  console.log(`[multica] server ready, connections: ${connectionsStorePath()}`);
  return () => {
    wecomBridge.shutdown();
  };
}
