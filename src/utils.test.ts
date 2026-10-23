import { test } from "node:test";
import assert from "node:assert/strict";
import { colorHex, cssSnapshot, tokens } from "./utils.ts";
import type { Snapshot, Scan } from "./model.ts";
import { buttonSnapshot } from "../tests/fixture.ts";
test("CSS 可选 HEX 转换覆盖颜色、渐变、简写边框与阴影", () => {
  const snapshot = buttonSnapshot();
  snapshot.styles["background-image"] =
    "linear-gradient(rgb(255, 0, 16), rgba(0, 0, 0, 0))";
  for (const side of ["top", "right", "bottom", "left"])
    snapshot.styles[`border-${side}`] = "1px solid rgb(0, 128, 255)";
  const original = structuredClone(snapshot);
  const selected = ["颜色", "外观"] as const;
  const css = cssSnapshot(
    snapshot,
    ".test",
    [...selected],
    false,
    true,
    true,
    true,
  );
  assert.ok(css.includes("color: #ffffff;"));
  assert.ok(css.includes("background-color: #156f56;"));
  assert.ok(css.includes("linear-gradient(#ff0010, #00000000)"));
  assert.ok(css.includes("border: 1px solid #0080ff;"));
  assert.ok(css.includes("0px 2px 8px 0px #0000001a"));
  assert.ok(
    cssSnapshot(snapshot, ".test", [...selected]).includes(
      "rgb(255, 255, 255)",
    ),
  );
  assert.deepEqual(snapshot, original);
});
test("完整快照 HEX 转换保留字符串、URL 和其他色彩空间", () => {
  const snapshot = buttonSnapshot();
  snapshot.full = {
    color: "rgba(255, 0, 16, 0.5)",
    content: '"rgb(1, 2, 3)"',
    "font-family": "'rgb(4, 5, 6)'",
    "background-image":
      'url("https://example.com/rgb(1,2,3).png"), linear-gradient(rgb(0 128 255), color(display-p3 1 0 0))',
  };
  const css = cssSnapshot(snapshot, ".test", [], true, true, true, true);
  assert.ok(css.includes("color: #ff001080;"));
  assert.ok(css.includes('content: "rgb(1, 2, 3)";'));
  assert.ok(css.includes("font-family: 'rgb(4, 5, 6)';"));
  assert.ok(css.includes('url("https://example.com/rgb(1,2,3).png")'));
  assert.ok(css.includes("linear-gradient(#0080ff, color(display-p3 1 0 0))"));
});
test("颜色归一化保留透明度", () => {
  assert.equal(colorHex("rgba(255, 0, 16, 0.5)"), "#ff001080");
  assert.equal(colorHex("rgb(0, 128, 255)"), "#0080ff");
  assert.equal(colorHex("rgba(0, 0, 0, 0)"), "#00000000");
  assert.equal(colorHex("color(display-p3 1 0 0)"), "color(display-p3 1 0 0)");
});
test("CSS 按分组输出并去重，完整快照单独读取", () => {
  const s: Snapshot = {
    tag: "div",
    id: "",
    classes: "",
    rect: { width: 10, height: 10 },
    styles: { display: "flex", gap: "12px", color: "rgb(0, 0, 0)" },
    parent: false,
    full: { "z-index": "2", color: "red" },
  };
  const css = cssSnapshot(s, ".test", ["布局", "Flex", "Grid"]);
  assert.equal(css.match(/gap:/g)?.length, 1);
  assert.ok(!css.includes("color:"));
  assert.ok(
    cssSnapshot(s, ".test", [], true).indexOf("color:") <
      cssSnapshot(s, ".test", [], true).indexOf("z-index:"),
  );
});
test("设计变量采用中性编号，包含字体与字重", () => {
  const scan: Scan = {
    colors: [{ value: "#112233", count: 2 }],
    fonts: [{ value: "Arial", count: 2 }],
    fontSizes: [{ value: "16px", count: 2 }],
    fontWeights: [{ value: "400", count: 2 }],
    visited: 2,
    partial: false,
  };
  const value = tokens(scan);
  assert.ok(value.includes("--ff-color-01: #112233;"));
  assert.ok(value.includes("--ff-font-family-01: Arial;"));
  assert.ok(value.includes("--ff-font-weight-01: 400;"));
});
