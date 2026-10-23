export const groups = {
  字体: [
    "font-family",
    "font-size",
    "font-weight",
    "line-height",
    "letter-spacing",
  ],
  颜色: ["color", "background-color", "background-image", "opacity"],
  盒模型: [
    "width",
    "height",
    "box-sizing",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
  ],
  布局: [
    "display",
    "position",
    "overflow",
    "overflow-x",
    "overflow-y",
    "z-index",
  ],
  Flex: [
    "flex-direction",
    "justify-content",
    "align-items",
    "gap",
    "flex-wrap",
  ],
  Grid: [
    "grid-template-columns",
    "grid-template-rows",
    "grid-column",
    "grid-row",
    "gap",
  ],
  外观: [
    "border-radius",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "box-shadow",
  ],
  效果: ["transform", "transition", "animation"],
} as const;
export type Group = keyof typeof groups;
export interface Snapshot {
  parentDisplay?: string;
  tag: string;
  id: string;
  classes: string;
  rect: { width: number; height: number };
  styles: Record<string, string>;
  full?: Record<string, string>;
  parent: boolean;
}
export interface Count {
  value: string;
  count: number;
}
export interface Scan {
  colors: Count[];
  fonts: Count[];
  fontSizes: Count[];
  fontWeights: Count[];
  visited: number;
  partial: boolean;
}
export type Command =
  | "PING"
  | "PICK"
  | "STOP"
  | "REFRESH"
  | "PARENT"
  | "FULL"
  | "SCAN"
  | "CANCEL"
  | "CLEAR";
export interface Request {
  source: "ff-lens";
  command: Command;
}
export type Event =
  | { source: "ff-lens"; kind: "reconnect"; tabId: number }
  | { source: "ff-lens"; kind: "selected"; snapshot: Snapshot }
  | { source: "ff-lens"; kind: "invalid" | "stopped" | "cleared" }
  | { source: "ff-lens"; kind: "progress"; count: number }
  | { source: "ff-lens"; kind: "scan"; scan: Scan };
