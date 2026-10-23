import { groups, type Group, type Snapshot, type Scan } from "./model.ts";
export function colorHex(value: string): string {
  const match = value.match(
    /^rgba?\(\s*([\d.]+)[, ]+([\d.]+)[, ]+([\d.]+)(?:\s*[,/]\s*([\d.]+))?\s*\)$/,
  );
  if (!match) return value;
  const bytes = match
    .slice(1, 4)
    .map((n) => Math.max(0, Math.min(255, Math.round(Number(n)))));
  if (match[4] !== undefined && Number(match[4]) < 1)
    bytes.push(Math.round(Number(match[4]) * 255));
  return "#" + bytes.map((n) => n.toString(16).padStart(2, "0")).join("");
}
export function cssSnapshot(
  snapshot: Snapshot,
  selector: string,
  selected: Group[],
  full = false,
  shorthand = true,
  omitDefaults = true,
  hexColors = false,
) {
  const declarations = cssDeclarations(
    snapshot,
    selected,
    full,
    shorthand,
    omitDefaults,
  );
  return `/* FF Lens: computed style snapshot */\n${selector.trim() || ".element"} {\n${Object.entries(
    declarations,
  )
    .map(([p, v]) => `  ${p}: ${hexColors ? cssColorsToHex(v) : v};`)
    .join("\n")}\n}`;
}

function cssColorsToHex(value: string): string {
  // Skip strings and URLs so font names, content and image addresses stay intact.
  return value.replace(
    /"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\burl\((?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\\.|[^)"'\\])*\)|\brgba?\([^()]*\)/gi,
    (token) =>
      /^rgba?\(/i.test(token) ? colorHex(token.toLowerCase()) : token,
  );
}

export function cssDeclarations(
  snapshot: Snapshot,
  selected: Group[],
  full = false,
  shorthand = true,
  omitDefaults = true,
): Record<string, string> {
  const properties = full
    ? Object.keys(snapshot.full ?? {}).sort()
    : [...new Set(selected.flatMap((g) => [...groups[g]]))];
  const styles = full ? (snapshot.full ?? {}) : snapshot.styles;
  let declarations = Object.fromEntries(
    properties.filter((p) => styles[p]).map((p) => [p, styles[p]]),
  );
  if (full) return declarations;
  if (shorthand) {
    for (const property of ["padding", "margin", "border-width"]) {
      const keys = ["top", "right", "bottom", "left"].map((side) =>
        property === "border-width"
          ? `border-${side}-width`
          : `${property}-${side}`,
      );
      if (keys.every((key) => declarations[key] !== undefined)) {
        const values = keys.map((key) => declarations[key]);
        const first = keys[0];
        const reduced =
          values[1] === values[3]
            ? values[0] === values[2]
              ? values[0] === values[1]
                ? values.slice(0, 1)
                : values.slice(0, 2)
              : values.slice(0, 3)
            : values;
        declarations = Object.fromEntries(
          Object.entries(declarations).flatMap(([key, value]) =>
            key === first
              ? [
                  [
                    property,
                    reduced
                      .map((value) => (value === "0px" ? "0" : value))
                      .join(" "),
                  ],
                ]
              : keys.includes(key)
                ? []
                : [[key, value]],
          ),
        );
      }
    }
    const sides = ["top", "right", "bottom", "left"];
    if (sides.every((side) => declarations[`border-${side}`])) {
      delete declarations["border-width"];
      for (const side of sides) delete declarations[`border-${side}-width`];
      const borders = sides.map((side) => declarations[`border-${side}`]);
      if (borders.every((value) => value === borders[0])) {
        for (const side of sides) delete declarations[`border-${side}`];
        declarations.border = borders[0];
      }
    }
    if (declarations["overflow-x"] === declarations.overflow)
      delete declarations["overflow-x"];
    if (declarations["overflow-y"] === declarations.overflow)
      delete declarations["overflow-y"];
  }
  if (omitDefaults) {
    declarations = Object.fromEntries(
      Object.entries(declarations).filter(
        ([property, value]) =>
          !isDefaultDeclaration(snapshot.tag, property, value),
      ),
    );
  }
  return declarations;
}

const initialValues: Record<string, string[]> = {
  "font-weight": ["normal", "400"],
  "line-height": ["normal"],
  "letter-spacing": ["normal"],
  "background-image": ["none"],
  opacity: ["1"],
  "box-sizing": ["content-box"],
  position: ["static"],
  overflow: ["visible"],
  "overflow-x": ["visible"],
  "overflow-y": ["visible"],
  "z-index": ["auto"],
  "box-shadow": ["none"],
  transform: ["none"],
  "flex-direction": ["row"],
  "flex-wrap": ["nowrap"],
  "justify-content": ["normal"],
  "align-items": ["normal"],
  gap: ["normal"],
  "grid-template-columns": ["none"],
  "grid-template-rows": ["none"],
  "grid-column": ["auto", "auto / auto"],
  "grid-row": ["auto", "auto / auto"],
};
const blockTags = new Set(
  "html body div p section article header footer main aside nav address blockquote figure figcaption form fieldset h1 h2 h3 h4 h5 h6 ul ol pre hr details".split(
    " ",
  ),
);
function isDefaultDeclaration(
  tag: string,
  property: string,
  raw: string,
): boolean {
  const value = raw.trim();
  if (initialValues[property]?.includes(value)) return true;
  if (property === "display") {
    if (blockTags.has(tag)) return value === "block";
    if (
      [
        "span",
        "a",
        "strong",
        "em",
        "b",
        "i",
        "small",
        "label",
        "code",
      ].includes(tag)
    )
      return value === "inline";
  }
  if (property === "background-color")
    return value === "transparent" || /^#[\da-f]{6}00$/i.test(colorHex(value));
  if (
    /^(padding|margin)(-(top|right|bottom|left))?$/.test(property) ||
    property === "border-radius" ||
    property === "border-width" ||
    /^border-(top|right|bottom|left)-width$/.test(property)
  ) {
    return /^0(?:px)?(?:\s+0(?:px)?)*(?:\s*\/\s*0(?:px)?(?:\s+0(?:px)?)*)?$/.test(
      value,
    );
  }
  if (/^border(?:-(top|right|bottom|left))?$/.test(property))
    return (
      /^(?:0(?:px)?\s+|\S+\s+(?:none|hidden)\b)/.test(value) || value === "none"
    );
  if (property === "transition")
    return value === "none" || value === "all 0s ease 0s";
  if (property === "animation")
    return (
      /^(?:none|0s)(?:\s|$)/.test(value) &&
      !value.includes(",") &&
      /^none(?:\s|$)/.test(value)
    );
  return false;
}
export function tokens(scan: Scan) {
  return (
    ":root {\n" +
    [
      ["color", scan.colors],
      ["font-size", scan.fontSizes],
      ["font-family", scan.fonts],
      ["font-weight", scan.fontWeights],
    ]
      .flatMap(([name, items]) =>
        (items as Scan["colors"]).map(
          (item, i) =>
            `  --ff-${name}-${String(i + 1).padStart(2, "0")}: ${item.value};`,
        ),
      )
      .join("\n") +
    "\n}"
  );
}
