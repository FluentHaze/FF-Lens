// Development-only fixture. This entry is not included in the extension build.
import { buttonSnapshot } from "./fixture";
import type { Event, Request, Snapshot } from "../src/model";
let snapshot: Snapshot | undefined = buttonSnapshot();
let listener:
  ((event: Event, sender: chrome.runtime.MessageSender) => void) | undefined;
const preferences: Record<string, string> = { theme: "light" };
const send = (event: Event) =>
  listener?.(event, { tab: { id: 1 } as chrome.tabs.Tab });
Object.defineProperty(globalThis, "chrome", {
  configurable: true,
  value: {
    runtime: {
      onMessage: {
        addListener: (fn: typeof listener) => {
          listener = fn;
        },
        removeListener: () => {},
      },
    },
    storage: {
      local: {
        get: async (key: string) => ({ [key]: preferences[key] }),
        set: async (value: Record<string, string>) => {
          Object.assign(preferences, value);
        },
      },
    },
    tabs: {
      query: async () => [
        {
          id: 1,
          title: "组件测试页 · 确认按钮",
          url: "https://example.test/checkout",
        },
      ],
      connect: () => ({ disconnect: () => {} }),
      sendMessage: async (_id: number, message: Request) => {
        if (message.command === "PING") return { ok: true, snapshot };
        if (message.command === "CLEAR") {
          snapshot = undefined;
          send({ source: "ff-lens", kind: "cleared" });
        }
        if (message.command === "PICK")
          setTimeout(() => {
            snapshot = buttonSnapshot();
            send({ source: "ff-lens", kind: "selected", snapshot });
          }, 50);
        if (
          message.command === "FULL" ||
          message.command === "REFRESH" ||
          message.command === "PARENT"
        ) {
          snapshot = buttonSnapshot();
          if (message.command === "FULL")
            snapshot.full = { ...snapshot.styles };
          send({ source: "ff-lens", kind: "selected", snapshot });
        }
        return { ok: true };
      },
      onActivated: { addListener: () => {}, removeListener: () => {} },
      onUpdated: { addListener: () => {}, removeListener: () => {} },
    },
  },
});
await import("../src/main");
