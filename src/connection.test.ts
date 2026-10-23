import { test } from "node:test";
import assert from "node:assert/strict";
import { ensurePageConnection, pageConnectionError } from "./connection.ts";

test("已有脚本直接复用，不重复注入", async () => {
  let injected = false;
  await ensurePageConnection({
    ping: async () => ({}),
    inject: async () => {
      injected = true;
    },
  });
  assert.equal(injected, false);
});

test("首次未连接时注入脚本，然后握手", async () => {
  const steps: string[] = [];
  await ensurePageConnection({
    ping: async () => {
      steps.push("ping");
      if (steps.length === 1) throw Error("Receiving end does not exist");
      return {};
    },
    inject: async () => {
      steps.push("inject");
    },
  });
  assert.deepEqual(steps, ["ping", "inject", "ping"]);
});

test("缺少页面权限时保留注入错误，不继续发送消息", async () => {
  let attempts = 0;
  const denied = Error(
    "Cannot access contents of the page. Extension manifest must request permission to access the respective host.",
  );
  await assert.rejects(
    ensurePageConnection({
      ping: async () => {
        attempts++;
        throw Error("Receiving end does not exist");
      },
      inject: async () => {
        throw denied;
      },
    }),
    (error) => error === denied,
  );
  assert.equal(attempts, 1);
  assert.match(pageConnectionError(denied), /工具栏/);
});

test("连接缺失和受保护页面显示不同恢复提示", () => {
  assert.match(
    pageConnectionError(
      Error("Could not establish connection. Receiving end does not exist."),
    ),
    /检查脚本尚未连接/,
  );
  assert.match(
    pageConnectionError(Error("Cannot access a chrome:// URL")),
    /受浏览器保护/,
  );
});
