import { useSyncExternalStore } from "react";

let version = 0;
const listeners = new Set<() => void>();

/** 侧边栏徽章在工作台 Provider 之外，靠这个信号在收件箱变更后立刻重取，而不必等轮询。 */
export function refreshInboxBadge() {
  version += 1;
  for (const listener of listeners) listener();
}

export function useInboxBadgeVersion(): number {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => version,
    () => version,
  );
}