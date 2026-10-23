import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transpileModule, ModuleKind } from "typescript";
import { groups, type Event, type Request } from "./model.ts";
import { colorHex } from "./utils.ts";

test("选中后仍监听 Esc，取消后释放交互监听并清除所选元素", () => {
  type Input = {
    target?: ElementStub;
    key?: string;
    preventDefault: () => void;
    stopImmediatePropagation: () => void;
  };
  const listeners = new Map<string, Set<(event: Input) => void>>();
  const events: Event[] = [];
  class ElementStub {
    isConnected = true;
    tagName = "BUTTON";
    id = "target";
    parentElement = null;
    hidden = true;
    style = {};
    classList: string[] = [];
    setAttribute() {}
    getAttribute() {
      return "";
    }
    getBoundingClientRect() {
      return { width: 160, height: 48, top: 40, left: 40 };
    }
    attachShadow() {
      return {
        innerHTML: "",
        querySelector: (selector: string) => (selector === "div" ? box : label),
      };
    }
  }
  const box = new ElementStub(),
    label = new ElementStub();
  let receive:
    | ((
        request: Request,
        sender: object,
        reply: (value: unknown) => void,
      ) => void)
    | undefined;
  const context = {
    require: (name: string) => (name === "./model" ? { groups } : { colorHex }),
    exports: {},
    Element: ElementStub,
    document: {
      createElement: () => new ElementStub(),
      documentElement: { append: () => {} },
    },
    window: {
      addEventListener: (type: string, fn: (event: Input) => void) => {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type)!.add(fn);
      },
      removeEventListener: (type: string, fn: (event: Input) => void) =>
        listeners.get(type)?.delete(fn),
    },
    MutationObserver: class {
      observe() {}
    },
    requestAnimationFrame: () => 1,
    getComputedStyle: () => ({ getPropertyValue: () => "", display: "block" }),
    chrome: {
      runtime: {
        sendMessage: async (event: Event) => {
          events.push(event);
        },
        onConnect: { addListener: () => {} },
        onMessage: {
          addListener: (fn: typeof receive) => {
            receive = fn;
          },
        },
      },
    },
  };
  const source = readFileSync(new URL("./content.ts", import.meta.url), "utf8");
  runInNewContext(
    transpileModule(source, {
      compilerOptions: { module: ModuleKind.CommonJS },
    }).outputText,
    context,
  );
  const command = (command: Request["command"]) =>
    receive?.({ source: "ff-lens", command }, {}, () => {});
  command("PICK");
  let prevented = false;
  for (const click of listeners.get("click") ?? [])
    click({
      target: new ElementStub(),
      preventDefault: () => {
        prevented = true;
      },
      stopImmediatePropagation: () => {},
    });
  assert.equal(prevented, true);
  assert.equal(listeners.get("click")?.size, 0);
  assert.equal(listeners.get("keydown")?.size, 1);
  assert.ok(events.some((event) => event.kind === "selected"));
  for (const key of listeners.get("keydown") ?? [])
    key({
      key: "Escape",
      preventDefault: () => {},
      stopImmediatePropagation: () => {},
    });
  assert.equal(events.at(-1)?.kind, "cleared");
  assert.equal(listeners.get("keydown")?.size, 0);
  assert.equal(listeners.get("pointerdown")?.size, 0);
  assert.equal(box.hidden, true);
  let selected: unknown;
  receive?.({ source: "ff-lens", command: "PING" }, {}, (value) => {
    selected = (value as { snapshot?: unknown }).snapshot;
  });
  assert.equal(selected, undefined);
  command("PICK");
  command("CLEAR");
  assert.equal(listeners.get("click")?.size, 0);
  assert.equal(listeners.get("keydown")?.size, 0);
});
