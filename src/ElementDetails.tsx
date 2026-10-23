import { useState } from "react";
import { groups, type Group, type Snapshot, type Command } from "./model";
import { colorHex } from "./utils";
import { ExportPanel } from "./ExportPanel";
import { Icon } from "./Icons";
interface Props {
  snapshot: Snapshot;
  command: (command: Command) => Promise<boolean>;
  copy: (value: string) => Promise<boolean>;
  onClear: () => void;
}
export function ElementDetails({ snapshot, command, copy, onClear }: Props) {
  const s = snapshot.styles;
  const [format, setFormat] = useState("hex");
  const [view, setView] = useState<"inspect" | "export">("inspect");
  return (
    <>
      <section className="card identity">
        <div className="section-title">
          <span className="eyebrow">
            <i />
            已选中元素
          </span>
          <span className="badge">{s.display}</span>
        </div>
        <h2 className="element-name">
          &lt;{snapshot.tag}
          {snapshot.id ? "#" + snapshot.id : ""}&gt;
        </h2>
        <details>
          <summary>class · {snapshot.classes || "无"}</summary>
          <pre>{snapshot.classes || "无 class"}</pre>
          <button onClick={() => void copy(snapshot.classes)}>
            复制 class
          </button>
        </details>
        <div className="dimensions">
          <div>
            <span>可视宽度</span>
            <strong>
              {snapshot.rect.width.toFixed(1)}
              <small>px</small>
            </strong>
          </div>
          <div>
            <span>可视高度</span>
            <strong>
              {snapshot.rect.height.toFixed(1)}
              <small>px</small>
            </strong>
          </div>
        </div>
        {s.transform !== "none" && (
          <p className="transform-note">已应用变换，尺寸为可视外接矩形</p>
        )}
        <div className="actions">
          <button
            disabled={!snapshot.parent}
            onClick={() => void command("PARENT")}
          >
            <Icon name="arrow" />
            父元素
          </button>
          <button onClick={() => void command("REFRESH")}>
            <Icon name="refresh" />
            刷新
          </button>
          <button
            aria-label="取消选择"
            onClick={() => {
              onClear();
            }}
          >
            <Icon name="close" />
            取消
          </button>
        </div>
      </section>
      <div
        className="inspector-tabs"
        role="tablist"
        aria-label="元素操作"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          const next =
            event.key === "Home"
              ? "inspect"
              : event.key === "End"
                ? "export"
                : view === "inspect"
                  ? "export"
                  : "inspect";
          setView(next);
          event.currentTarget
            .querySelectorAll<HTMLButtonElement>("button")
            [next === "inspect" ? 0 : 1].focus();
        }}
      >
        <button
          role="tab"
          aria-selected={view === "inspect"}
          tabIndex={view === "inspect" ? 0 : -1}
          onClick={() => setView("inspect")}
        >
          <Icon name="layers" />
          样式详情
        </button>
        <button
          role="tab"
          aria-selected={view === "export"}
          tabIndex={view === "export" ? 0 : -1}
          onClick={() => setView("export")}
        >
          <Icon name="code" />
          复制代码
        </button>
      </div>
      {view === "export" ? (
        <ExportPanel snapshot={snapshot} command={command} copy={copy} />
      ) : (
        <>
          <section className="card box-card">
            <h3>
              盒模型 <small>悬停查看区域说明</small>
            </h3>
            <div className="box margin" title="margin：外边距，保留负值">
              <span>margin</span>
              <Edges prefix="margin" styles={s} />
              <div className="box border" title="border：边框宽度">
                <span>border</span>
                <Edges prefix="border" styles={s} />
                <div className="box padding" title="padding：内边距">
                  <span>padding</span>
                  <Edges prefix="padding" styles={s} />
                  <div className="content" title="content：计算内容尺寸">
                    {(() => {
                      const size = (axis: "width" | "height") => {
                        let v = parseFloat(s[axis]);
                        if (s["box-sizing"] === "border-box")
                          for (const side of axis === "width"
                            ? ["left", "right"]
                            : ["top", "bottom"])
                            v -=
                              parseFloat(s[`padding-${side}`]) +
                              parseFloat(s[`border-${side}-width`]);
                        return Number.isFinite(v)
                          ? Math.max(0, v).toFixed(1)
                          : s[axis];
                      };
                      return `${size("width")} × ${size("height")}`;
                    })()}
                  </div>
                </div>
              </div>
            </div>
            <p className="hint">
              计算值示意，不模拟外边距折叠。CSS 尺寸 {s.width} × {s.height} ·{" "}
              {s["box-sizing"]}
            </p>
          </section>
          <div className="property-groups">
            {(Object.keys(groups) as Group[])
              .filter((g) => g !== "Flex" || s.display.includes("flex"))
              .filter(
                (g) =>
                  g !== "Grid" ||
                  s.display.includes("grid") ||
                  snapshot.parentDisplay?.includes("grid"),
              )
              .map((g) => (
                <details
                  className="card group"
                  key={g}
                  open={["字体", "颜色"].includes(g)}
                >
                  <summary>
                    {g}
                    <small>{groups[g].length} 项</small>
                  </summary>
                  {g === "颜色" && (
                    <div className="actions">
                      <button
                        onClick={() =>
                          setFormat(format === "hex" ? "rgb" : "hex")
                        }
                      >
                        {format.toUpperCase()} ⇄
                      </button>
                    </div>
                  )}
                  {groups[g].map((p) => (
                    <div className="property" key={p}>
                      <code>{p}</code>
                      <button
                        title="点击复制完整值"
                        onClick={() =>
                          void copy(
                            p.includes("color") && format === "hex"
                              ? colorHex(s[p])
                              : s[p],
                          )
                        }
                      >
                        {p.includes("color") && (
                          <i className="swatch" style={{ background: s[p] }} />
                        )}
                        {p.includes("color") && format === "hex"
                          ? colorHex(s[p])
                          : s[p]}
                      </button>
                    </div>
                  ))}
                </details>
              ))}
          </div>
        </>
      )}
    </>
  );
}
function Edges({
  prefix,
  styles,
}: {
  prefix: string;
  styles: Record<string, string>;
}) {
  return (
    <>
      {["top", "right", "bottom", "left"].map((side) => (
        <em key={side} className={side}>
          {styles[`${prefix}-${side}${prefix === "border" ? "-width" : ""}`]}
        </em>
      ))}
    </>
  );
}
