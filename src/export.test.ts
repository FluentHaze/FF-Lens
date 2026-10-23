import { test } from "node:test";
import assert from "node:assert/strict";
import { buttonSnapshot } from "../tests/fixture.ts";
import { cssDeclarations, cssSnapshot } from "./utils.ts";
import { tailwindSnapshot } from "./tailwind.ts";
import type { Group } from "./model.ts";

test("CSS 简写压缩四边值，保留负 margin 与不对称边框", () => {
  for (const [values, expected] of [
    [["4px", "4px", "4px", "4px"], "4px"],
    [["4px", "8px", "4px", "8px"], "4px 8px"],
    [["4px", "8px", "12px", "8px"], "4px 8px 12px"],
    [["-4px", "8px", "12px", "16px"], "-4px 8px 12px 16px"],
  ] as const) {
    const snapshot = buttonSnapshot();
    ["top", "right", "bottom", "left"].forEach(
      (side, index) => (snapshot.styles[`margin-${side}`] = values[index]),
    );
    const declarations = cssDeclarations(
      snapshot,
      ["盒模型", "外观"],
      false,
      true,
      false,
    );
    assert.equal(declarations.margin, expected);
    assert.equal(declarations.padding, "12px 20px");
    assert.equal(declarations.border, "0px none rgb(255, 255, 255)");
    assert.ok(!("padding-top" in declarations));
    snapshot.styles["border-left"] = "2px solid rgb(0, 0, 0)";
    const asymmetric = cssDeclarations(snapshot, ["盒模型", "外观"]);
    assert.equal(asymmetric["border-left"], "2px solid rgb(0, 0, 0)");
    assert.ok(!("border" in asymmetric));
  }
});

test("精简输出过滤默认值，但保留颜色、尺寸与裁剪行为", () => {
  const snapshot = buttonSnapshot();
  snapshot.tag = "div";
  Object.assign(snapshot.styles, {
    "font-weight": "400",
    "line-height": "normal",
    "letter-spacing": "normal",
    color: "rgb(0, 0, 0)",
    "background-color": "rgba(0, 0, 0, 0)",
    display: "block",
    "box-sizing": "content-box",
    overflow: "clip",
    "overflow-x": "clip",
    "overflow-y": "clip",
    "border-radius": "0px",
    "box-shadow": "none",
  });
  for (const side of ["top", "right", "bottom", "left"])
    snapshot.styles[`padding-${side}`] = "0px";
  const selected: Group[] = ["字体", "颜色", "盒模型", "布局", "外观"];
  const declarations = cssDeclarations(snapshot, selected);
  for (const property of [
    "font-weight",
    "line-height",
    "letter-spacing",
    "background-color",
    "background-image",
    "opacity",
    "padding",
    "margin",
    "display",
    "position",
    "box-sizing",
    "z-index",
    "border-radius",
    "box-shadow",
    "border",
  ])
    assert.ok(!(property in declarations), property);
  assert.equal(declarations.overflow, "clip");
  assert.equal(declarations.color, "rgb(0, 0, 0)");
  assert.equal(declarations["font-size"], "16px");
  assert.equal(declarations.width, "160px");
  assert.equal(
    cssDeclarations(snapshot, selected, false, true, false).opacity,
    "1",
  );
  snapshot.full = { ...snapshot.styles };
  assert.equal(cssDeclarations(snapshot, selected, true).opacity, "1");
  const tw = tailwindSnapshot(snapshot, selected, "4").classes;
  assert.ok(!tw.includes("opacity-[1]"));
  assert.ok(tw.includes("overflow-clip"));
  assert.ok(
    tailwindSnapshot(snapshot, selected, "4", false, false).classes.includes(
      "opacity-[1]",
    ),
  );
});

test("精简过滤不影响非默认布局、透明叠加、负间距和简写内的零值", () => {
  const snapshot = buttonSnapshot();
  snapshot.tag = "span";
  Object.assign(snapshot.styles, {
    display: "block",
    position: "relative",
    opacity: "0.5",
    "background-color": "rgba(0, 0, 0, 0.5)",
    "padding-top": "0px",
    "padding-bottom": "0px",
    "margin-top": "-4px",
  });
  const declarations = cssDeclarations(snapshot, ["盒模型", "布局", "颜色"]);
  assert.equal(declarations.display, "block");
  assert.equal(declarations.position, "relative");
  assert.equal(declarations.opacity, "0.5");
  assert.equal(declarations["background-color"], "rgba(0, 0, 0, 0.5)");
  assert.equal(declarations.padding, "0 20px");
  assert.equal(declarations.margin, "-4px 0 0");
  for (const side of ["top", "right", "bottom", "left"])
    snapshot.styles[`border-${side}-width`] = "2px";
  assert.equal(cssDeclarations(snapshot, ["盒模型"])["border-width"], "2px");
});

test("取消简写与完整快照保留原始声明，规则名只改变导出内容", () => {
  const snapshot = buttonSnapshot();
  assert.equal(
    cssDeclarations(snapshot, ["盒模型"], false, false)["padding-top"],
    "12px",
  );
  snapshot.full = { ...snapshot.styles };
  assert.equal(cssDeclarations(snapshot, [], true)["padding-top"], "12px");
  assert.match(
    cssSnapshot(snapshot, ".purchase-button", ["盒模型"]),
    /\.purchase-button \{/,
  );
  assert.equal(snapshot.id, "confirm");
});

test("Tailwind 保留像素、透明度、字体空格与下划线，不进行主题尺寸猜测", () => {
  const snapshot = buttonSnapshot();
  snapshot.styles.color = "rgba(255, 0, 16, 0.5)";
  snapshot.styles["font-family"] = '"My_Font SC", sans-serif';
  const { classes, omitted } = tailwindSnapshot(
    snapshot,
    ["字体", "颜色", "盒模型", "布局", "Flex"],
    "4",
    true,
    false,
  );
  assert.ok(classes.includes("flex"));
  assert.ok(classes.includes("p-[12px_20px]"));
  assert.ok(classes.includes("text-[color:#ff001080]"));
  assert.ok(classes.includes("My\\_Font_SC"));
  assert.ok(!classes.includes("p-3"));
  assert.equal(omitted.length, 0);
});

test("Tailwind 两个版本使用对应语法，无法安全编码的值明确回退", () => {
  const snapshot = buttonSnapshot();
  snapshot.styles["background-image"] = 'url("https://example.test/a_b.png")';
  const groups: Group[] = ["效果", "颜色"];
  const v3 = tailwindSnapshot(snapshot, groups, "3");
  const v4 = tailwindSnapshot(snapshot, groups, "4");
  assert.ok(v3.classes.includes("[transform:matrix("));
  assert.ok(v4.classes.includes("transform-[matrix("));
  assert.equal(v4.omitted[0].property, "background-image");
  assert.ok(!v4.classes.includes("example.test"));
  assert.equal(tailwindSnapshot(snapshot, [], "4").classes, "");
});
