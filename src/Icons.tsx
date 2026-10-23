import type { CSSProperties } from "react";
const paths = {
  globe:
    "M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3c5 5 5 13 0 18-5-5-5-13 0-18",
  target:
    "M7 3H4a1 1 0 0 0-1 1v3m14-4h3a1 1 0 0 1 1 1v3M3 17v3a1 1 0 0 0 1 1h3m10 0h3a1 1 0 0 0 1-1v-3M12 8v8m-4-4h8",
  close: "m6 6 12 12M18 6 6 18",
  copy: "M9 9h11v11H9zM15 5V3H3v12h2",
  check: "m5 12 4 4L19 6",
  settings:
    "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z",
  arrow: "m8 14 4-4 4 4M12 10v10M5 4h14",
  refresh: "M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 14 6M4 12a8 8 0 0 0 14 6",
  code: "m8 6-6 6 6 6m8-12 6 6-6 6m-3-15-2 18",
  layers: "m12 3 10 6-10 6L2 9zm-9 11 9 6 9-6",
  chevron: "m9 5 7 7-7 7",
  shield: "m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6zm-4 10 3 3 5-6",
} as const;
export function Icon({
  name,
  size = 18,
  style,
}: {
  name: keyof typeof paths;
  size?: number;
  style?: CSSProperties;
}) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
    >
      <path d={paths[name]} />
    </svg>
  );
}
