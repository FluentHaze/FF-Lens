import { test } from "node:test";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import postcss from "postcss";
import tailwindV3 from "tailwindcss-v3";
import { compile } from "tailwindcss-v4";
import { groups } from "./model.ts";
import { tailwindSnapshot } from "./tailwind.ts";
import { buttonSnapshot } from "../tests/fixture.ts";
import type { Group } from "./model.ts";

for (const version of ["3", "4"] as const) {
  test(`Tailwind v${version} 编译器能生成所有导出的类名`, async () => {
    const snapshot = buttonSnapshot();
    snapshot.styles["font-family"] = '"My_Font SC", sans-serif';
    const output = tailwindSnapshot(
      snapshot,
      Object.keys(groups) as Group[],
      version,
    );
    const candidates = output.classes.split(" ");
    const css =
      version === "3"
        ? (
            await postcss([
              tailwindV3({
                content: [{ raw: "<div></div>" }],
                safelist: candidates,
              }),
            ]).process("@tailwind utilities;", { from: undefined })
          ).css
        : (
            await compile(
              readFileSync(
                new URL(
                  "../node_modules/tailwindcss-v4/theme.css",
                  import.meta.url,
                ),
                "utf8",
              ) + "\n@tailwind utilities;",
            )
          ).build(candidates);
    const selectors = new Set<string>();
    postcss.parse(css).walkRules((rule) => {
      selectors.add(
        rule.selector
          .slice(1)
          .replace(
            /\\([0-9a-f]{1,6})\s?|\\(.)/gi,
            (_match, hex: string | undefined, literal: string) =>
              hex ? String.fromCodePoint(parseInt(hex, 16)) : literal,
          ),
      );
    });
    for (const candidate of candidates) {
      assert.ok(selectors.has(candidate), `未生成类名 ${candidate}`);
    }
    assert.ok(candidates.includes("py-3"));
    assert.ok(candidates.includes("px-5"));
    if (version === "3") {
      assert.match(css, /padding-top:\s*0.75rem/);
      assert.match(css, /padding-left:\s*1.25rem/);
    } else
      assert.match(
        css,
        /padding-(?:inline|left):\s*calc\(var\(--spacing\) \* 5\)/,
      );
    assert.match(css, /font-family:\s*["']My_Font SC["'], sans-serif/);
    assert.match(css, /transform:\s*matrix\(1, 0, 0, 1, 0, 0\)/);
  });
}
