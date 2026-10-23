import { colorHex } from "./utils.ts";
import { paletteV3, paletteV4 } from "./tailwind-colors.ts";
import type { Snapshot } from "./model.ts";
import type { TailwindVersion } from "./tailwind.ts";

const spacing = new Set([
  0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24,
  28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96,
]);
const fonts: Record<string, string> = {
  12: "xs",
  14: "sm",
  16: "base",
  18: "lg",
  20: "xl",
  24: "2xl",
  30: "3xl",
  36: "4xl",
  48: "5xl",
  60: "6xl",
  72: "7xl",
  96: "8xl",
  128: "9xl",
};
const fontHeights: Record<string, number> = {
  12: 16,
  14: 20,
  16: 24,
  18: 28,
  20: 28,
  24: 32,
  30: 36,
  36: 40,
  48: 48,
  60: 60,
  72: 72,
  96: 96,
  128: 128,
};
const weights: Record<string, string> = {
  100: "thin",
  200: "extralight",
  300: "light",
  400: "normal",
  500: "medium",
  600: "semibold",
  700: "bold",
  800: "extrabold",
  900: "black",
  normal: "normal",
  bold: "bold",
};
const lineRatios: Record<string, string> = {
  1: "none",
  1.25: "tight",
  1.375: "snug",
  1.5: "normal",
  1.625: "relaxed",
  2: "loose",
};
const tracking: Record<string, string> = {
  "-0.05": "tighter",
  "-0.025": "tight",
  0: "normal",
  0.025: "wide",
  0.05: "wider",
  0.1: "widest",
};
const spacingPrefixes: Record<string, string> = {
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
};
function numberPx(value: string): number | undefined {
  return /^-?\d+(?:\.\d+)?(?:px)?$/.test(value) ? parseFloat(value) : undefined;
}
function space(value: string, version: TailwindVersion): string | undefined {
  if (value === "auto") return "auto";
  const px = numberPx(value);
  if (px === undefined) return;
  const unit = Math.abs(px) / 4;
  if (spacing.has(unit) || (version === "4" && Number.isInteger(unit)))
    return `${px < 0 ? "-" : ""}${unit}`;
}
function spaceClass(
  prefix: string,
  value: string,
  version: TailwindVersion,
): string | undefined {
  const token = space(value, version);
  if (token === undefined) return;
  if (token === "auto" && !prefix.startsWith("m")) return;
  if (token.startsWith("-"))
    return prefix.startsWith("m") ? `-${prefix}-${token.slice(1)}` : undefined;
  return `${prefix}-${token}`;
}
function fontLineHeight(
  snapshot: Snapshot,
  version: TailwindVersion,
): string | undefined {
  const size = numberPx(snapshot.styles["font-size"] ?? "");
  if (size === undefined || !fonts[size]) return;
  const height = snapshot.styles["line-height"];
  const px = numberPx(height ?? "");
  if (px === fontHeights[size]) return "";
  return height === "normal"
    ? "[normal]"
    : px === undefined
      ? undefined
      : (lineRatios[px / size] ?? space(height, version));
}
export function standardColor(
  value: string,
  version: TailwindVersion,
): string | undefined {
  const hex = colorHex(value).toLowerCase();
  if (hex === "#000000" || value === "black") return "black";
  if (hex === "#ffffff" || value === "white") return "white";
  if (hex === "#00000000" || value === "transparent") return "transparent";
  return (version === "3" ? paletteV3 : paletteV4)[
    version === "3" ? hex : value.toLowerCase().replace(/\s+/g, " ").trim()
  ];
}

// Match only exact default-theme values. Never round a measurement to a token.
export function standardUtilities(
  property: string,
  value: string,
  snapshot: Snapshot,
  version: TailwindVersion,
): string[] | undefined {
  const px = numberPx(value);
  if (property === "font-size" && px !== undefined && fonts[px]) {
    // text-* also sets line-height. Preserve the original height explicitly,
    // including CSS normal, which is different from Tailwind leading-normal.
    const leading = fontLineHeight(snapshot, version);
    return [`text-${fonts[px]}${leading ? "/" + leading : ""}`];
  }
  if (property === "font-weight" && weights[value])
    return [`font-${weights[value]}`];
  if (property === "color" || property === "background-color") {
    const color = standardColor(value, version);
    if (color) return [`${property === "color" ? "text" : "bg"}-${color}`];
  }
  if (property === "background-image" && value === "none") return ["bg-none"];
  if (property === "line-height" && px !== undefined) {
    if (fontLineHeight(snapshot, version) !== undefined) return [];
    const font = numberPx(snapshot.styles["font-size"] ?? "");
    if (font && lineRatios[px / font])
      return [`leading-${lineRatios[px / font]}`];
    const token = space(value, version);
    if (token !== undefined) return [`leading-${token}`];
  }
  if (property === "letter-spacing" && px !== undefined) {
    const font = numberPx(snapshot.styles["font-size"] ?? "");
    if (font && tracking[px / font]) return [`tracking-${tracking[px / font]}`];
  }
  if (property === "padding" || property === "margin") {
    const values = value.split(/\s+/);
    if (values.length > 4) return;
    const [top, right = top, bottom = top, left = right] = values;
    const prefix = spacingPrefixes[property];
    const entries =
      top === right && top === bottom && top === left
        ? [[prefix, top]]
        : top === bottom && right === left
          ? [
              [prefix + "y", top],
              [prefix + "x", right],
            ]
          : right === left
            ? [
                [prefix + "t", top],
                [prefix + "x", right],
                [prefix + "b", bottom],
              ]
            : [
                [prefix + "t", top],
                [prefix + "r", right],
                [prefix + "b", bottom],
                [prefix + "l", left],
              ];
    const classes = entries.map(([p, v]) => spaceClass(p, v, version));
    return classes.every((item): item is string => item !== undefined)
      ? classes
      : undefined;
  }
  if (spacingPrefixes[property]) {
    const result = spaceClass(spacingPrefixes[property], value, version);
    if (result) return [result];
  }
  if (property === "width" || property === "height") {
    const prefix = property === "width" ? "w" : "h";
    const keyword: Record<string, string> = {
      auto: "auto",
      "100%": "full",
      "50%": "1/2",
      "25%": "1/4",
      "75%": "3/4",
      "min-content": "min",
      "max-content": "max",
      "fit-content": "fit",
    };
    if (keyword[value]) return [`${prefix}-${keyword[value]}`];
    const token = space(value, version);
    if (token !== undefined && !token.startsWith("-"))
      return [`${prefix}-${token}`];
  }
  if (property === "border-radius" && px !== undefined) {
    const radii: Record<string, string> = {
      0: "none",
      2: version === "3" ? "sm" : "xs",
      4: version === "3" ? "" : "sm",
      6: "md",
      8: "lg",
      12: "xl",
      16: "2xl",
      24: "3xl",
    };
    if (px in radii) return [`rounded${radii[px] ? "-" + radii[px] : ""}`];
    if (version === "4" && px === 32) return ["rounded-4xl"];
  }
  if (property === "opacity") {
    const amount = Number(value) * 100;
    if (
      (version === "4" &&
        Number.isInteger(amount) &&
        amount >= 0 &&
        amount <= 100) ||
      [0, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100].includes(
        amount,
      )
    )
      return [`opacity-${amount}`];
  }
  if (
    property === "z-index" &&
    (value === "auto" ||
      (version === "4"
        ? /^-?\d+$/.test(value)
        : ["0", "10", "20", "30", "40", "50"].includes(value)))
  )
    return [value.startsWith("-") ? `-z-${value.slice(1)}` : `z-${value}`];
  if (
    property === "border-width" &&
    px !== undefined &&
    [0, 1, 2, 4, 8].includes(px)
  )
    return [px === 1 ? "border" : `border-${px}`];
  if (property === "border") {
    const match = value.match(
      /^(\d+(?:\.\d+)?px)\s+(solid|dashed|dotted|double|none)\s+(.+)$/,
    );
    if (match) {
      const width = parseFloat(match[1]);
      if (width === 0) return ["border-0"];
      const color = standardColor(match[3], version);
      if ([1, 2, 4, 8].includes(width) && color)
        return [
          width === 1 ? "border" : `border-${width}`,
          `border-${match[2]}`,
          `border-${color}`,
        ];
    }
  }
  if (property === "transform" && value === "none") return ["transform-none"];
}
