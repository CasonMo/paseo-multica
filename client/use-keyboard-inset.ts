import { useEffect, useState, type ComponentRef, type RefObject } from "react";
import { Dimensions, Keyboard, Platform, View, type KeyboardEvent } from "react-native";
import { observeWebKeyboardInset } from "./web";

/**
 * 键盘弹出时把面板底部输入区顶上去，返回需要让出的底部高度（调用方加到根节点 marginBottom）。
 * - web（iPad Safari 等）：键盘只收缩 visualViewport，布局视口不变，见 client/web.ts。
 * - iOS 原生（Paseo iPad/iPhone App）：监听键盘事件拿真实键盘高度，减去面板底边到屏幕底的间隙。
 * 两者都用「加回当前已让出 margin」的方式避免「收缩→再测」的正反馈抖动。
 * 不用 KeyboardAvoidingView：它按自身 frame 估算抬升量并扣掉底部安全区，抬升不足。
 */
export function useKeyboardInset(rootRef: RefObject<ComponentRef<typeof View> | null>): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (Platform.OS === "web") {
      return observeWebKeyboardInset(() => rootRef.current, setInset);
    }

    if (Platform.OS !== "ios") return;

    let applied = 0;
    const apply = (keyboardHeight: number) => {
      const commit = (next: number) => {
        applied = next;
        setInset(next);
      };
      const node = rootRef.current;
      if (!node || typeof node.measureInWindow !== "function") {
        commit(Math.max(0, Math.round(keyboardHeight)));
        return;
      }
      node.measureInWindow((_x, y, _width, height) => {
        const screenHeight = Dimensions.get("window").height;
        // 加回已让出的 margin，还原面板未抬升时的底边，得到宿主底部间隙。
        const rawBottom = y + height + applied;
        const gap = screenHeight - rawBottom;
        commit(Math.max(0, Math.round(keyboardHeight - gap)));
      });
    };
    const onChange = (event: KeyboardEvent) => apply(event.endCoordinates?.height ?? 0);
    const onHide = () => apply(0);
    const subscriptions = [
      Keyboard.addListener("keyboardWillChangeFrame", onChange),
      Keyboard.addListener("keyboardWillHide", onHide),
    ];
    return () => {
      for (const subscription of subscriptions) subscription.remove();
    };
  }, [rootRef]);

  return inset;
}