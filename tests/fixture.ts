import type { Snapshot } from "../src/model.ts";
export function buttonSnapshot(): Snapshot {
  const styles: Record<string, string> = {
    display: "flex",
    position: "static",
    overflow: "visible",
    "overflow-x": "visible",
    "overflow-y": "visible",
    "z-index": "auto",
    width: "160px",
    height: "48px",
    "box-sizing": "border-box",
    "font-family": '"PingFang SC", sans-serif',
    "font-size": "16px",
    "font-weight": "500",
    "line-height": "24px",
    "letter-spacing": "0px",
    color: "rgb(255, 255, 255)",
    "background-color": "rgb(21, 111, 86)",
    "background-image": "none",
    opacity: "1",
    "border-radius": "8px",
    "box-shadow": "0px 2px 8px 0px rgba(0, 0, 0, 0.1)",
    "flex-direction": "row",
    "justify-content": "center",
    "align-items": "center",
    gap: "8px",
    "flex-wrap": "nowrap",
    transform: "matrix(1, 0, 0, 1, 0, 0)",
    transition: "all 0s ease 0s",
    animation: "none 0s ease 0s 1 normal none running",
  };
  for (const side of ["top", "right", "bottom", "left"]) {
    styles[`padding-${side}`] =
      side === "top" || side === "bottom" ? "12px" : "20px";
    styles[`margin-${side}`] = "0px";
    styles[`border-${side}-width`] = "0px";
    styles[`border-${side}`] = "0px none rgb(255, 255, 255)";
  }
  return {
    tag: "button",
    id: "confirm",
    classes: "checkout-button primary",
    rect: { width: 160, height: 48 },
    styles,
    parent: true,
    parentDisplay: "flex",
  };
}
