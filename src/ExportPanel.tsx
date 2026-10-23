import { useEffect, useState } from "react";
import { groups, type Group, type Snapshot, type Command } from "./model";
import { cssDeclarations, cssSnapshot } from "./utils";
import { tailwindSnapshot, type TailwindVersion } from "./tailwind";
import { Icon } from "./Icons";
interface Props {
  snapshot: Snapshot;
  command: (command: Command) => Promise<boolean>;
  copy: (value: string) => Promise<boolean>;
}
export function ExportPanel({ snapshot, command, copy }: Props) {
  const [mode, setMode] = useState<"css" | "tailwind">("css");
  const [version, setVersion] = useState<TailwindVersion>("4");
  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local
        .get("tailwindVersion")
        .then((value) => {
          if (value.tailwindVersion === "3" || value.tailwindVersion === "4")
            setVersion(value.tailwindVersion);
        })
        .catch(() => {});
    }
  }, []);
  const [selector, setSelector] = useState(".element");
  const [omitDefaults, setOmitDefaults] = useState(true);
  const [hexColors, setHexColors] = useState(false);
  const [preferUtilities, setPreferUtilities] = useState(true);
  const [full, setFull] = useState(false),
    [shorthand, setShorthand] = useState(true),
    [copied, setCopied] = useState(false);
  const applicable = (Object.keys(groups) as Group[])
    .filter((g) => g !== "Flex" || snapshot.styles.display.includes("flex"))
    .filter(
      (g) =>
        g !== "Grid" ||
        snapshot.styles.display.includes("grid") ||
        snapshot.parentDisplay?.includes("grid"),
    );
  const [selected, setSelected] = useState<Group[]>(
    applicable.filter((g) => g !== "效果"),
  );
  const activeGroups = selected.filter((group) => applicable.includes(group));
  const selectorError =
    mode === "css" &&
    (!selector.trim() ||
      /[{}\n\r]/.test(selector) ||
      !CSS.supports(`selector(${selector})`));
  const tw = tailwindSnapshot(
    snapshot,
    activeGroups,
    version,
    omitDefaults,
    preferUtilities,
  );
  const output =
    mode === "css"
      ? cssSnapshot(
          snapshot,
          selector,
          activeGroups,
          full,
          shorthand,
          omitDefaults,
          hexColors,
        )
      : tw.classes;
  const waiting = mode === "css" && full && !snapshot.full;
  const hasDeclarations =
    mode === "css"
      ? Object.keys(
          cssDeclarations(
            snapshot,
            activeGroups,
            full,
            shorthand,
            omitDefaults,
          ),
        ).length > 0
      : tw.classes.length > 0;
  useEffect(() => {
    // Refreshing or selecting a parent replaces a previously loaded full snapshot.
    if (!snapshot.full) setFull(false);
  }, [snapshot]);
  useEffect(() => {
    setCopied(false);
  }, [output]);
  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);
  return (
    <section className="export-panel section-surface" aria-label="代码导出">
      <div className="section-heading">
        <div>
          <h3>代码导出</h3>
          <p>将当前样式带到你的项目。</p>
        </div>
        <Icon name="code" size={24} />
      </div>
      <div className="segmented" aria-label="导出格式">
        <button aria-pressed={mode === "css"} onClick={() => setMode("css")}>
          CSS
        </button>
        <button
          aria-pressed={mode === "tailwind"}
          onClick={() => setMode("tailwind")}
        >
          Tailwind CSS
        </button>
      </div>
      {mode === "css" ? (
        <>
          <label htmlFor="export-selector">导出规则名</label>
          <input
            id="export-selector"
            value={selector}
            maxLength={160}
            aria-invalid={selectorError}
            aria-describedby="selector-help"
            onChange={(e) => setSelector(e.target.value)}
          />
          <p
            id="selector-help"
            className={selectorError ? "field-error" : "hint"}
          >
            {selectorError
              ? "请输入有效的 CSS 选择器，例如 .card 或 #submit。"
              : ".element 是导出的规则名，可修改，不影响网页。"}
          </p>
        </>
      ) : (
        <>
          <label htmlFor="tailwind-version">项目 Tailwind 版本</label>
          <select
            id="tailwind-version"
            value={version}
            onChange={(e) => {
              const value = e.target.value as TailwindVersion;
              setVersion(value);
              if (typeof chrome !== "undefined" && chrome.storage?.local)
                void chrome.storage.local
                  .set({ tailwindVersion: value })
                  .catch(() => {});
            }}
          >
            <option value="4">Tailwind CSS v4</option>
            <option value="3">Tailwind CSS v3.4</option>
          </select>
          <p className="hint">
            {preferUtilities
              ? "按默认主题与 1rem = 16px 匹配标准类名，不取整。"
              : "保留精确计算值，优先任意值。"}{" "}
            输出 class 列表。粘贴到 class /
            className，确保构建器能扫描到这些类名。 含反斜杠时，JSX 需用
            String.raw 保留转义。
          </p>
        </>
      )}
      <details className="export-settings">
        <summary>
          <span>
            <Icon name="settings" size={16} />
            导出设置
          </span>
          <small>
            {activeGroups.length} 个分组{omitDefaults ? " · 已过滤默认值" : ""}
          </small>
        </summary>
        <fieldset>
          <legend>包含的样式</legend>
          <div className="checks">
            {applicable.map((g) => (
              <label key={g}>
                <input
                  type="checkbox"
                  checked={selected.includes(g)}
                  disabled={mode === "css" && full}
                  onChange={(e) =>
                    setSelected(
                      e.target.checked
                        ? [...selected, g]
                        : selected.filter((x) => x !== g),
                    )
                  }
                />
                {g}
              </label>
            ))}
          </div>
        </fieldset>
        {mode === "tailwind" && (
          <label className="check">
            <input
              type="checkbox"
              checked={preferUtilities}
              onChange={(event) => setPreferUtilities(event.target.checked)}
            />
            优先标准工具类 <small>无法匹配时使用任意值</small>
          </label>
        )}
        <label className="check">
          <input
            type="checkbox"
            checked={omitDefaults}
            disabled={mode === "css" && full}
            onChange={(event) => setOmitDefaults(event.target.checked)}
          />
          过滤默认值 <small>精简 CSS 与 Tailwind 输出</small>
        </label>
        <p className="hint">
          过滤常见初始值，不判断原 CSS
          是否显式声明。粘贴到不同页面时可能需要补充重置；取消勾选可保留。
        </p>
        {mode === "css" && (
          <div className="export-options">
            <label className="check">
              <input
                type="checkbox"
                checked={hexColors}
                onChange={(event) => setHexColors(event.target.checked)}
              />
              颜色转 HEX <small>RGB / RGBA，保留透明度</small>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={shorthand}
                disabled={full}
                onChange={(e) => setShorthand(e.target.checked)}
              />
              合并简写 <small>padding、margin、border</small>
            </label>
            <label className="check">
              <input
                type="checkbox"
                checked={full}
                onChange={async (e) => {
                  const checked = e.target.checked;
                  setFull(checked);
                  if (checked && !(await command("FULL"))) setFull(false);
                }}
              />
              完整计算样式 <small>原始快照，不合并</small>
            </label>
          </div>
        )}
      </details>
      <div className="code-caption">
        <span>
          {mode === "css"
            ? "CSS 预览"
            : `Tailwind v${version} · ${tw.classes ? tw.classes.split(" ").length : 0} 个类`}
        </span>
        <span>只读</span>
      </div>
      <pre className="code-preview" tabIndex={0} aria-label="导出代码预览">
        <code>
          {waiting
            ? "正在读取完整快照…"
            : !hasDeclarations
              ? activeGroups.length === 0
                ? "选择至少一组样式以生成代码"
                : "没有可导出的非默认样式，可取消过滤默认值。"
              : output}
        </code>
      </pre>
      {mode === "tailwind" && tw.omitted.length > 0 && (
        <details className="fallback-note">
          <summary>{tw.omitted.length} 项复杂值需使用 CSS</summary>
          <p className="hint">
            含 URL 或特殊转义的值保留为 CSS，避免生成无法编译的类名。
          </p>
          <pre>
            {tw.omitted.map((x) => `${x.property}: ${x.value};`).join("\n")}
          </pre>
          <button
            onClick={() =>
              void copy(
                tw.omitted.map((x) => `${x.property}: ${x.value};`).join("\n"),
              )
            }
          >
            复制补充 CSS
          </button>
        </details>
      )}
      <button
        className={"primary copy-action" + (copied ? " copied" : "")}
        disabled={
          !!selectorError ||
          waiting ||
          !output ||
          !hasDeclarations ||
          (!(mode === "css" && full) && activeGroups.length === 0)
        }
        onClick={async () => {
          if (await copy(output)) setCopied(true);
        }}
      >
        <Icon name={copied ? "check" : "copy"} />
        {copied
          ? "已复制"
          : mode === "css"
            ? "复制 CSS"
            : `复制 Tailwind v${version} 类名`}
      </button>
      <p className="hint export-footnote">
        {mode === "css"
          ? "这是计算样式快照，不包含原始来源和交互状态。"
          : "按计算值转换，保留精确尺寸；不推断主题变量、断点或 hover。自定义主题和已有类可能影响还原效果。"}
      </p>
    </section>
  );
}
