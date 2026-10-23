import type { Group, Snapshot } from "./model.ts";
import { cssDeclarations, colorHex } from "./utils.ts";
import { standardUtilities } from "./tailwind-utilities.ts";
export type TailwindVersion = "3" | "4";
export interface TailwindExport {
  classes: string;
  omitted: { property: string; value: string }[];
}

const keywords: Record<string, Record<string, string>> = {
  display: {
    block: "block",
    "inline-block": "inline-block",
    inline: "inline",
    flex: "flex",
    "inline-flex": "inline-flex",
    grid: "grid",
    "inline-grid": "inline-grid",
    none: "hidden",
    contents: "contents",
    "flow-root": "flow-root",
  },
  position: {
    static: "static",
    relative: "relative",
    absolute: "absolute",
    fixed: "fixed",
    sticky: "sticky",
  },
  "box-sizing": { "border-box": "box-border", "content-box": "box-content" },
  "flex-direction": {
    row: "flex-row",
    "row-reverse": "flex-row-reverse",
    column: "flex-col",
    "column-reverse": "flex-col-reverse",
  },
  "flex-wrap": {
    nowrap: "flex-nowrap",
    wrap: "flex-wrap",
    "wrap-reverse": "flex-wrap-reverse",
  },
  "justify-content": {
    center: "justify-center",
    "flex-start": "justify-start",
    "flex-end": "justify-end",
    "space-between": "justify-between",
    "space-around": "justify-around",
    "space-evenly": "justify-evenly",
  },
  "align-items": {
    center: "items-center",
    "flex-start": "items-start",
    "flex-end": "items-end",
    stretch: "items-stretch",
    baseline: "items-baseline",
  },
  "box-shadow": { none: "shadow-none" },
};
const lengths: Record<string, string> = {
  width: "w",
  height: "h",
  padding: "p",
  margin: "m",
  "padding-top": "pt",
  "padding-right": "pr",
  "padding-bottom": "pb",
  "padding-left": "pl",
  "margin-top": "mt",
  "margin-right": "mr",
  "margin-bottom": "mb",
  "margin-left": "ml",
  gap: "gap",
  "letter-spacing": "tracking",
  "line-height": "leading",
  "border-radius": "rounded",
  "grid-template-columns": "grid-cols",
  "grid-template-rows": "grid-rows",
  "z-index": "z",
  opacity: "opacity",
};

// Arbitrary properties retain computed pixels, font lists and complex values.
// We do not infer theme tokens, root font size, hover or breakpoint variants.
export function tailwindSnapshot(
  snapshot: Snapshot,
  selected: Group[],
  version: TailwindVersion,
  omitDefaults = true,
  preferUtilities = true,
): TailwindExport {
  const declarations = cssDeclarations(
    snapshot,
    selected,
    false,
    true,
    omitDefaults,
  );
  const classes: string[] = [];
  const omitted: TailwindExport["omitted"] = [];
  for (const [property, raw] of Object.entries(declarations)) {
    let value = raw.trim();
    if (preferUtilities) {
      const utilities = standardUtilities(property, value, snapshot, version);
      if (utilities) {
        classes.push(...utilities);
        continue;
      }
    }
    const keyword = keywords[property]?.[value];
    if (keyword) {
      classes.push(keyword);
      continue;
    }
    if (
      property === "overflow" ||
      property === "overflow-x" ||
      property === "overflow-y"
    ) {
      if (["auto", "hidden", "clip", "visible", "scroll"].includes(value)) {
        classes.push(`${property}-${value}`);
        continue;
      }
    }
    // CSS-wide values, URL encodings and literal brackets need a CSS fallback.
    if (
      /[\[\]{};\\\n\r]/.test(value) ||
      /url\(|^inherit$|^initial$|^revert(?:-layer)?$/i.test(value)
    ) {
      omitted.push({ property, value });
      continue;
    }
    if (property.includes("color")) value = colorHex(value);
    // Prefer CSS single quotes for pasting into double-quoted HTML attributes.
    value = value.replace(/"([^"]*)"/g, (original, text: string) =>
      text.includes("'") ? original : `'${text}'`,
    );
    if (property === "border" && /^(0(?:px)?\s+none|none\b)/.test(value)) {
      classes.push("[border:0_none]");
      continue;
    }
    const encoded = value.replace(/_/g, "\\_").replace(/\s+/g, "_");
    if (property === "transform" && value !== "none") {
      classes.push(
        version === "4" ? `transform-[${encoded}]` : `[transform:${encoded}]`,
      );
      continue;
    }
    const prefix = lengths[property];
    if (prefix) {
      if (
        [
          "padding",
          "margin",
          "padding-top",
          "padding-right",
          "padding-bottom",
          "padding-left",
          "margin-top",
          "margin-right",
          "margin-bottom",
          "margin-left",
          "gap",
        ].includes(property) &&
        /^0(?:px)?$/.test(value)
      )
        classes.push(`${prefix}-0`);
      else if (
        (property === "width" || property === "height") &&
        value === "auto"
      )
        classes.push(`${prefix}-auto`);
      else classes.push(`${prefix}-[${encoded}]`);
    } else if (property === "font-family")
      classes.push(`font-[family-name:${encoded}]`);
    else if (property === "font-size") classes.push(`text-[length:${encoded}]`);
    else if (property === "color") classes.push(`text-[color:${encoded}]`);
    else if (property === "background-color")
      classes.push(`bg-[color:${encoded}]`);
    else classes.push(`[${property}:${encoded}]`);
  }
  return { classes: [...new Set(classes)].join(" "), omitted };
}
