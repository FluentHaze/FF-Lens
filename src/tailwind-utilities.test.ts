import { test } from "node:test";
import assert from "node:assert/strict";
import { buttonSnapshot } from "../tests/fixture.ts";
import { tailwindSnapshot } from "./tailwind.ts";
import { standardColor, standardUtilities } from "./tailwind-utilities.ts";

test("默认优先生成标准工具类，特殊尺寸不取整", () => {
  const snapshot = buttonSnapshot();
  Object.assign(snapshot.styles, {
    color: "rgb(0, 0, 0)",
    width: "236.328px",
    height: "77px",
  });
  const result = tailwindSnapshot(
    snapshot,
    ["字体", "颜色", "盒模型", "布局", "Flex", "外观"],
    "3",
  ).classes.split(" ");
  for (const name of [
    "text-base",
    "font-medium",
    "text-black",
    "py-3",
    "px-5",
    "gap-2",
    "rounded-lg",
    "tracking-normal",
    "w-[236.328px]",
    "h-[77px]",
  ])
    assert.ok(result.includes(name), name);
  assert.ok(!result.includes("text-[length:16px]"));
  assert.ok(!result.includes("p-[12px_20px]"));
  assert.ok(!result.includes("leading-normal"));
});

test("字体工具类不误把 CSS normal 行高改成 1.5，并可选择精确值模式", () => {
  const snapshot = buttonSnapshot();
  snapshot.styles["line-height"] = "normal";
  assert.ok(
    tailwindSnapshot(snapshot, ["字体"], "4").classes.includes(
      "text-base/[normal]",
    ),
  );
  assert.ok(
    tailwindSnapshot(snapshot, ["字体"], "4", true, false).classes.includes(
      "text-[length:16px]",
    ),
  );
  snapshot.styles["font-weight"] = "400";
  assert.ok(
    tailwindSnapshot(snapshot, ["字体"], "4", false).classes.includes(
      "font-normal",
    ),
  );
});

test("按版本匹配默认圆角、间距和颜色，不把 v3 的颜色冒充 v4 色板", () => {
  const snapshot = buttonSnapshot();
  assert.deepEqual(standardUtilities("border-radius", "4px", snapshot, "3"), [
    "rounded",
  ]);
  assert.deepEqual(standardUtilities("border-radius", "4px", snapshot, "4"), [
    "rounded-sm",
  ]);
  assert.deepEqual(standardUtilities("margin", "-4px 8px", snapshot, "3"), [
    "-my-1",
    "mx-2",
  ]);
  assert.deepEqual(standardUtilities("opacity", "0.5", snapshot, "4"), [
    "opacity-50",
  ]);
  assert.equal(standardColor("rgb(239, 68, 68)", "3"), "red-500");
  assert.equal(standardColor("rgb(239, 68, 68)", "4"), undefined);
  assert.equal(standardColor("oklch(63.7% 0.237 25.331)", "4"), "red-500");
});
