import type { PluginServerContext } from "@getpaseo/plugin/server";
import {
  apiRequestRpc,
  bootstrapRpc,
  connectionsActivateRpc,
  connectionsListRpc,
  connectionsRemoveRpc,
  connectionsSaveRpc,
  connectionsTestRpc,
  preferencesSaveRpc,
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

  console.log(`[multica-workbench] server ready, connections: ${connectionsStorePath()}`);
  return () => {};
}
