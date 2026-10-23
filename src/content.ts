import {
  groups,
  type Snapshot,
  type Request,
  type Event,
  type Scan,
} from "./model";
import { colorHex } from "./utils";
// Injection is idempotent. DOM references never leave this isolated world.
if (!(globalThis as typeof globalThis & { __ffLens?: boolean }).__ffLens) {
  (globalThis as typeof globalThis & { __ffLens?: boolean }).__ffLens = true;
  let selected: Element | null = null,
    hovered: Element | null = null,
    picking = false,
    frame = 0,
    scanId = 0;
  const host = document.createElement("div");
  host.setAttribute("data-ff-lens", "");
  const shadow = host.attachShadow({ mode: "closed" });
  shadow.innerHTML =
    "<style>:host{all:initial;position:fixed;inset:0;pointer-events:none;z-index:2147483647}div{position:fixed;box-sizing:border-box;border:2px solid #6873dc;background:#6873dc18;pointer-events:none}span{position:absolute;left:-2px;top:-28px;white-space:nowrap;max-width:85vw;overflow:hidden;text-overflow:ellipsis;background:#202947;color:#e5e9ff;font:13px/26px monospace;padding:0 8px;border-radius:4px}</style><div hidden><span></span></div>";
  const box = shadow.querySelector("div")!,
    label = shadow.querySelector("span")!;
  function emit(event: Event) {
    chrome.runtime.sendMessage(event).catch(() => {});
  }
  function snapshot(full = false): Snapshot | undefined {
    if (!selected?.isConnected) {
      selected = null;
      box.hidden = true;
      if (!picking) window.removeEventListener("keydown", key, true);
      emit({ source: "ff-lens", kind: "invalid" });
      return;
    }
    const s = getComputedStyle(selected),
      r = selected.getBoundingClientRect();
    const styles = Object.fromEntries(
      [...new Set(Object.values(groups).flat())].map((p) => [
        p,
        s.getPropertyValue(p),
      ]),
    );
    return {
      tag: selected.tagName.toLowerCase(),
      id: selected.id,
      classes: selected.getAttribute("class") ?? "",
      rect: { width: r.width, height: r.height },
      styles,
      parent: !!selected.parentElement,
      parentDisplay: selected.parentElement
        ? getComputedStyle(selected.parentElement).display
        : undefined,
      ...(full
        ? {
            full: Object.fromEntries(
              Array.from(s).map((p) => [p, s.getPropertyValue(p)]),
            ),
          }
        : {}),
    };
  }
  function draw() {
    frame = 0;
    const el = picking ? hovered : selected;
    if (!el?.isConnected) {
      box.hidden = true;
      return;
    }
    if (!host.isConnected) document.documentElement.append(host);
    const r = el.getBoundingClientRect();
    box.hidden = false;
    Object.assign(box.style, {
      left: `${r.left}px`,
      top: `${r.top}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
    });
    label.textContent = `${el.tagName.toLowerCase()}${
      el.id
        ? "#" + el.id
        : Array.from(el.classList)
            .slice(0, 2)
            .map((name) => "." + name)
            .join("")
    } · ${r.width.toFixed(1)} × ${r.height.toFixed(1)}${getComputedStyle(el).transform !== "none" ? " · 已变换" : ""}`;
    label.style.top = r.top < 30 ? "0" : "-28px";
  }
  function schedule() {
    if (!frame) frame = requestAnimationFrame(draw);
  }
  function move(e: MouseEvent) {
    if (e.target instanceof Element && e.target !== host) {
      hovered = e.target;
      schedule();
    }
  }
  function stop(notify = true) {
    picking = false;
    window.removeEventListener("mousemove", move, true);
    window.removeEventListener("click", click, true);
    if (!selected) window.removeEventListener("keydown", key, true);
    for (const type of protectedEvents)
      window.removeEventListener(type, protect, true);
    hovered = null;
    schedule();
    if (notify) emit({ source: "ff-lens", kind: "stopped" });
  }
  const protectedEvents = [
    "pointerdown",
    "pointerup",
    "mousedown",
    "mouseup",
    "auxclick",
  ];
  function protect(event: globalThis.Event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  function click(e: MouseEvent) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.target instanceof Element && e.target !== host) {
      selected = e.target;
      stop();
      const s = snapshot();
      if (s) emit({ source: "ff-lens", kind: "selected", snapshot: s });
    }
  }
  function key(e: KeyboardEvent) {
    if (e.key === "Escape" && (picking || selected)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      clearSelection();
    }
  }
  function clearSelection() {
    selected = null;
    stop(false);
    box.hidden = true;
    emit({ source: "ff-lens", kind: "cleared" });
  }
  window.addEventListener("scroll", schedule, true);
  window.addEventListener("resize", schedule);
  const observer = new MutationObserver(() => {
    if (selected && !selected.isConnected) {
      selected = null;
      box.hidden = true;
      if (!picking) window.removeEventListener("keydown", key, true);
      emit({ source: "ff-lens", kind: "invalid" });
    } else if (selected) schedule();
  });
  observer.observe(document, { childList: true, subtree: true });
  async function scan() {
    const run = ++scanId;
    const maps = {
      colors: new Map<string, number>(),
      fonts: new Map<string, number>(),
      fontSizes: new Map<string, number>(),
      fontWeights: new Map<string, number>(),
    };
    const add = (map: Map<string, number>, value: string) =>
      map.set(value, (map.get(value) ?? 0) + 1);
    const walker = document.createTreeWalker(
      document.body ?? document.documentElement,
      NodeFilter.SHOW_ELEMENT,
    );
    let count = 0,
      processed = 0,
      node: Node | null = walker.currentNode;
    while (node && count < 5000) {
      if (run !== scanId) return;
      const el = node as Element;
      node = walker.nextNode();
      processed++;
      try {
        if (
          el === host ||
          el.closest("[data-ff-lens]") ||
          el.getClientRects().length === 0
        )
          continue;
        const s = getComputedStyle(el);
        if (
          s.visibility === "hidden" ||
          s.visibility === "collapse" ||
          s.display === "none"
        )
          continue;
        count++;
        const colors = new Set(
          [
            s.color,
            s.backgroundColor,
            ...(["Top", "Right", "Bottom", "Left"] as const)
              .filter(
                (side) =>
                  parseFloat(
                    s.getPropertyValue(`border-${side.toLowerCase()}-width`),
                  ) > 0,
              )
              .map((side) =>
                s.getPropertyValue(`border-${side.toLowerCase()}-color`),
              ),
          ].map(colorHex),
        );
        colors.forEach((c) => {
          if (c !== "#00000000" && !/^#[\da-f]{6}00$/i.test(c))
            add(maps.colors, c);
        });
        add(maps.fonts, s.fontFamily);
        add(maps.fontSizes, s.fontSize);
        add(maps.fontWeights, s.fontWeight);
      } catch {
        /* A detached or unreadable element does not abort the scan. */
      } finally {
        if (processed % 100 === 0) {
          emit({ source: "ff-lens", kind: "progress", count });
          await new Promise((r) => setTimeout(r, 0));
        }
      }
    }
    if (run !== scanId) return;
    const sorted = (map: Map<string, number>) =>
      [...map]
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
    const result: Scan = {
      colors: sorted(maps.colors),
      fonts: sorted(maps.fonts),
      fontSizes: sorted(maps.fontSizes),
      fontWeights: sorted(maps.fontWeights),
      visited: count,
      partial: !!node,
    };
    emit({ source: "ff-lens", kind: "scan", scan: result });
  }
  chrome.runtime.onConnect.addListener((port) => {
    if (port.name === "ff-lens-panel")
      port.onDisconnect.addListener(() => {
        clearSelection();
        scanId++;
      });
  });
  chrome.runtime.onMessage.addListener((message: Request, _sender, reply) => {
    if (message.source !== "ff-lens") return;
    switch (message.command) {
      case "PING":
        reply({ ok: true, snapshot: selected ? snapshot() : undefined });
        return;
      case "PICK":
        stop(false);
        picking = true;
        for (const type of protectedEvents)
          window.addEventListener(type, protect, true);
        window.addEventListener("mousemove", move, true);
        window.addEventListener("click", click, true);
        window.addEventListener("keydown", key, true);
        break;
      case "STOP":
        stop();
        break;
      case "CLEAR":
        clearSelection();
        break;
      case "PARENT":
        if (selected?.parentElement) selected = selected.parentElement;
      case "REFRESH":
      case "FULL": {
        const s = snapshot(message.command === "FULL");
        if (s) emit({ source: "ff-lens", kind: "selected", snapshot: s });
        schedule();
        break;
      }
      case "SCAN":
        void scan();
        break;
      case "CANCEL":
        scanId++;
        break;
    }
    reply({ ok: true });
  });
}
