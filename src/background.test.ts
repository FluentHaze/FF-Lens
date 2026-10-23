import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

test("工具栏点击在用户手势内打开面板，并通知已打开的面板重连", async () => {
  const calls: string[] = [];
  let click: ((tab: { id: number; windowId: number }) => void) | undefined;
  const chrome = {
    sidePanel: {
      setPanelBehavior: async (behavior: {
        openPanelOnActionClick: boolean;
      }) => {
        assert.equal(behavior.openPanelOnActionClick, false);
        calls.push("configure");
      },
      open: async ({ windowId }: { windowId: number }) => {
        assert.equal(windowId, 5);
        calls.push("open");
      },
    },
    runtime: {
      onInstalled: { addListener: () => {} },
      sendMessage: async (event: { kind: string; tabId: number }) => {
        assert.equal(event.kind, "reconnect");
        assert.equal(event.tabId, 42);
        calls.push("reconnect");
      },
    },
    action: {
      onClicked: {
        addListener: (listener: typeof click) => {
          click = listener;
        },
      },
    },
  };
  runInNewContext(
    readFileSync(new URL("./background.ts", import.meta.url), "utf8"),
    { chrome, console },
  );
  assert.ok(click);
  click({ id: 42, windowId: 5 });
  assert.deepEqual(calls, ["configure", "open"]);
  await Promise.resolve();
  assert.deepEqual(calls, ["configure", "open", "reconnect"]);
});
