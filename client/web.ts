import { Platform } from "react-native";

type Viewport = {
  height: number;
  offsetTop: number;
  scale: number;
  addEventListener(type: "resize" | "scroll", fn: () => void): void;
  removeEventListener(type: "resize" | "scroll", fn: () => void): void;
};
type WebGlobals = {
  visualViewport?: Viewport;
  getComputedStyle?(node: unknown): { marginBottom: string };
  addEventListener(type: "resize", fn: () => void): void;
  removeEventListener(type: "resize", fn: () => void): void;
};
type DomNode = { getBoundingClientRect(): { bottom: number } };

/**
 * 触屏 web（iPad Safari 等）的键盘遮挡测量：键盘只收缩 visualViewport，布局视口不变，
 * 所以贴在布局视口底部的输入框会被盖住，这里用可视底边实测被遮了多少。
 * 非 web 平台返回 no-op；原生 iOS 分支见 use-keyboard-inset.ts。
 */
export function observeWebKeyboardInset(
  getNode: () => unknown,
  apply: (inset: number) => void,
): () => void {
  if (Platform.OS !== "web") return () => {};
  const web = globalThis as unknown as WebGlobals;
  const viewport = web.visualViewport;
  const computedStyle = web.getComputedStyle?.bind(web);
  if (!viewport || !computedStyle) return () => {};

  const measure = () => {
    const node = getNode() as DomNode | null;
    if (!node || typeof node.getBoundingClientRect !== "function") return;
    // 双指缩放不是键盘遮挡，不处理。
    if (Math.abs(viewport.scale - 1) > 0.01) {
      apply(0);
      return;
    }
    // 加回已让出的 margin，还原未抬升时的底边，避免「收缩→再测」的正反馈抖动。
    const applied = Number.parseFloat(computedStyle(node).marginBottom) || 0;
    const bottom = node.getBoundingClientRect().bottom + applied;
    apply(Math.max(0, Math.round(bottom - viewport.offsetTop - viewport.height)));
  };

  measure();
  viewport.addEventListener("resize", measure);
  viewport.addEventListener("scroll", measure);
  web.addEventListener("resize", measure);
  return () => {
    viewport.removeEventListener("resize", measure);
    viewport.removeEventListener("scroll", measure);
    web.removeEventListener("resize", measure);
  };
}