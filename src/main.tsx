import { ElementDetails } from "./ElementDetails";
import { Icon } from "./Icons";
import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { type Snapshot, type Scan, type Event, type Command } from "./model";
import { tokens } from "./utils";
import { ensurePageConnection, pageConnectionError } from "./connection";
import "./style.css";
const hasExtension = typeof chrome !== "undefined" && !!chrome.tabs;
function App() {
  const [snapshot, setSnapshot] = useState<Snapshot>(),
    [scan, setScan] = useState<Scan>(),
    [tab, setTab] = useState("element"),
    [picking, setPicking] = useState(false),
    [scanning, setScanning] = useState(false),
    [count, setCount] = useState(0),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [manual, setManual] = useState(""),
    [page, setPage] = useState({ title: "当前页面", url: "" }),
    [theme, setTheme] = useState("system"),
    [settings, setSettings] = useState(false),
    [help, setHelp] = useState(false);
  const port = useRef<chrome.runtime.Port | undefined>(undefined);
  const tabId = useRef<number | undefined>(undefined),
    generation = useRef(0);
  async function connect() {
    const run = ++generation.current;
    port.current?.disconnect();
    port.current = undefined;
    tabId.current = undefined;
    setError("");
    setPicking(false);
    setScanning(false);
    setSnapshot(undefined);
    setScan(undefined);
    try {
      if (!hasExtension)
        throw Error(
          "这是扩展界面预览。请构建并在 Chrome 加载 dist 文件夹，然后在普通网页点击扩展图标。",
        );
      const [current] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (run !== generation.current) return;
      setPage({ title: current?.title ?? "当前页面", url: current?.url ?? "" });
      if (!current?.id) throw Error("未找到当前标签页");
      if (current.url && !/^https?:|^file:/.test(current.url))
        throw Error("浏览器内部页面无法检查。请切换到普通网页后点击扩展图标。");
      const id = current.id;
      const response = await ensurePageConnection({
        ping: () =>
          chrome.tabs.sendMessage(id, {
            source: "ff-lens",
            command: "PING",
          }),
        inject: () =>
          chrome.scripting.executeScript({
            target: { tabId: id },
            files: ["content.js"],
          }),
      });
      if (run === generation.current) {
        tabId.current = id;
        port.current = chrome.tabs.connect(id, {
          name: "ff-lens-panel",
        });
        setSnapshot(response?.snapshot);
        return id;
      }
    } catch (e) {
      if (run === generation.current) setError(pageConnectionError(e));
    }
  }
  async function command(command: Command) {
    setError("");
    const id = tabId.current ?? (await connect());
    if (id === undefined) {
      setPicking(false);
      setScanning(false);
      return false;
    }
    if (command === "PICK") setPicking(true);
    if (command === "SCAN") setScanning(true);
    const run = generation.current;
    try {
      await Promise.race([
        chrome.tabs.sendMessage(id, { source: "ff-lens", command }),
        new Promise((_, reject) =>
          setTimeout(() => reject(Error("页面响应超时，请重新连接")), 5000),
        ),
      ]);
      return true;
    } catch (e) {
      if (run !== generation.current) return false;
      tabId.current = undefined;
      setError(pageConnectionError(e));
      setPicking(false);
      setScanning(false);
      return false;
    }
  }
  function clearSelection() {
    setSnapshot(undefined);
    setPicking(false);
    if (tabId.current !== undefined) void command("CLEAR");
  }
  useEffect(() => {
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape" && (picking || snapshot)) {
        event.preventDefault();
        clearSelection();
      }
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [picking, snapshot]);
  useEffect(() => {
    void connect();
    if (!hasExtension) return;
    chrome.storage.local
      .get("theme")
      .then((v) => setTheme(typeof v.theme === "string" ? v.theme : "system"));
    const listener = (event: Event, sender: chrome.runtime.MessageSender) => {
      if (
        event.source === "ff-lens" &&
        event.kind === "reconnect" &&
        !sender.tab
      ) {
        chrome.tabs
          .query({ active: true, currentWindow: true })
          .then(([active]) => {
            if (active?.id === event.tabId) void connect();
          })
          .catch((error) => setError(pageConnectionError(error)));
        return;
      }
      if (event.source !== "ff-lens" || sender.tab?.id !== tabId.current)
        return;
      if (event.kind === "selected") {
        setSnapshot(event.snapshot);
        setPicking(false);
      }
      if (event.kind === "invalid") {
        setSnapshot(undefined);
        setError("选中的元素已失效，请重新选择");
      }
      if (event.kind === "stopped") setPicking(false);
      if (event.kind === "cleared") {
        setPicking(false);
        setSnapshot(undefined);
      }
      if (event.kind === "progress") setCount(event.count);
      if (event.kind === "scan") {
        setScan(event.scan);
        setScanning(false);
      }
    };
    const activated = () => void connect();
    const updated = (id: number, info: chrome.tabs.OnUpdatedInfo) => {
      if (id === tabId.current && info.status === "loading") {
        generation.current++;
        tabId.current = undefined;
        port.current?.disconnect();
        port.current = undefined;
        setSnapshot(undefined);
        setScan(undefined);
        setPicking(false);
        setScanning(false);
        setError("页面正在导航，加载完成后请重新连接");
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    chrome.tabs.onActivated.addListener(activated);
    chrome.tabs.onUpdated.addListener(updated);
    return () => {
      port.current?.disconnect();
      chrome.runtime.onMessage.removeListener(listener);
      chrome.tabs.onActivated.removeListener(activated);
      chrome.tabs.onUpdated.removeListener(updated);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    if (hasExtension) void chrome.storage.local.set({ theme });
  }, [theme]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2200);
    return () => clearTimeout(timer);
  }, [notice]);
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("已复制到剪贴板");
      return true;
    } catch {
      setManual(value);
      setError("剪贴板不可用，请在下方文本框中手动复制");
      return false;
    }
  }
  function download(value: string, extension: string) {
    const url = URL.createObjectURL(
      new Blob([value], {
        type: extension === "json" ? "application/json" : "text/css",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `ff-lens-tokens.${extension}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <header>
        <div className="brand">
          <img className="logo" src="/logo.svg" width="44" height="44" alt="" />
          <div>
            <h1>FF Lens</h1>
            <small>页面样式检查器</small>
          </div>
        </div>
        <button
          className="icon-button"
          aria-label="设置"
          aria-expanded={settings}
          onClick={() => setSettings(!settings)}
        >
          <Icon name="settings" size={20} />
        </button>
      </header>
      <main>
        <section className="page">
          <span className="page-icon">
            <Icon name="globe" size={19} />
          </span>
          <div className="page-info">
            <h2 title={page.title}>{page.title}</h2>
            <small>
              {(() => {
                try {
                  return new URL(page.url).hostname;
                } catch {
                  return "等待连接网页";
                }
              })()}
            </small>
          </div>
          <button
            className="icon-button reconnect"
            aria-label="重新连接"
            title="重新连接页面"
            onClick={() => void connect()}
          >
            <Icon name="refresh" size={17} />
          </button>
        </section>
        {settings && (
          <section className="card settings-panel">
            <h3>偏好设置</h3>
            <label>
              界面主题{" "}
              <select value={theme} onChange={(e) => setTheme(e.target.value)}>
                <option value="system">跟随系统</option>
                <option value="dark">深色</option>
                <option value="light">浅色</option>
              </select>
            </label>
          </section>
        )}
        <div className="picker-toolbar">
          <button
            className={"pick " + (picking ? "active" : "")}
            onClick={async () => {
              if (picking) {
                await command("STOP");
                setPicking(false);
              } else {
                setPicking(true);
                await command("PICK");
              }
            }}
          >
            <Icon name="target" size={21} />{" "}
            {picking
              ? "正在拾取 · 点击退出"
              : snapshot
                ? "重新选择元素"
                : "选择页面元素"}
            {!snapshot && <Icon name="chevron" size={17} />}
          </button>
          {(snapshot || picking) && (
            <button
              className="cancel-selection"
              onClick={clearSelection}
              title="取消选择（Esc）"
            >
              <Icon name="close" />
              取消 <kbd>Esc</kbd>
            </button>
          )}
        </div>
        {picking && (
          <p role="status" className="hint">
            移动鼠标查看高亮，点击固定选择，Esc 退出。
          </p>
        )}
        {error && (
          <div className="alert" role="alert">
            {error}
          </div>
        )}
        {manual && (
          <label>
            手动复制
            <textarea
              readOnly
              value={manual}
              onFocus={(e) => e.target.select()}
            />
            <button onClick={() => setManual("")}>关闭</button>
          </label>
        )}
        <nav aria-label="检查内容">
          <button
            aria-pressed={tab === "element"}
            className={tab === "element" ? "current" : ""}
            onClick={() => setTab("element")}
          >
            <Icon name="target" size={17} />
            元素详情
          </button>
          <button
            aria-pressed={tab === "resources"}
            className={tab === "resources" ? "current" : ""}
            onClick={() => setTab("resources")}
          >
            <Icon name="layers" size={17} />
            页面资源{scan && <b>{scan.colors.length}</b>}
          </button>
        </nav>
        {tab === "element" ? (
          snapshot ? (
            <ElementDetails
              snapshot={snapshot}
              command={command}
              copy={copy}
              onClear={clearSelection}
            />
          ) : (
            <section className="empty">
              <div className="crosshair">
                <Icon name="target" size={42} />
                <span className="sample-tag">button</span>
              </div>
              <h2>选中它，读懂它。</h2>
              <p>
                选择页面上的任意元素，
                <br />
                查看它的字体、颜色与布局。
              </p>
              <div className="steps">
                <span>
                  <Icon name="target" />
                  悬停高亮
                </span>
                <span>
                  <Icon name="layers" />
                  查看样式
                </span>
                <span>
                  <Icon name="code" />
                  复制代码
                </span>
              </div>
            </section>
          )
        ) : (
          <>
            <section className="card">
              <h3>
                页面视觉资源 <Icon name="layers" />
              </h3>
              <p className="hint">
                扫描参与布局的元素，最多 5,000 个。结果为当前 DOM
                快照，页面变化后请重新扫描。
              </p>
              <button
                className="primary"
                onClick={async () => {
                  if (scanning) {
                    await command("CANCEL");
                    setScanning(false);
                  } else {
                    setScanning(true);
                    setCount(0);
                    setScan(undefined);
                    await command("SCAN");
                  }
                }}
              >
                {scanning ? `已扫描 ${count} 个 · 取消` : "扫描当前页面"}
              </button>
              {scan && (
                <p className="hint">
                  已扫描 {scan.visited} 个元素 ·{" "}
                  {scan.partial ? "部分结果：达到数量上限" : "扫描完成"}
                </p>
              )}
            </section>
            {scan && (
              <>
                <div className="stats">
                  <div>
                    <strong>{scan.colors.length}</strong>颜色
                  </div>
                  <div>
                    <strong>{scan.fonts.length}</strong>字体列表
                  </div>
                  <div>
                    <strong>{scan.fontSizes.length}</strong>字号
                  </div>
                </div>
                {(
                  [
                    ["颜色", scan.colors],
                    ["字体列表", scan.fonts],
                    ["字号", scan.fontSizes],
                    ["字重", scan.fontWeights],
                  ] as const
                ).map(([title, items]) => (
                  <section className="card" key={title}>
                    <h3>
                      {title}
                      <small>元素数</small>
                    </h3>
                    <div className="resource-list">
                      {items.map((item) => (
                        <button
                          className="resource"
                          key={item.value}
                          onClick={() => void copy(item.value)}
                        >
                          {title === "颜色" && (
                            <i
                              className="swatch"
                              style={{ background: item.value }}
                            />
                          )}
                          <code>{item.value}</code>
                          <b>{item.count}</b>
                        </button>
                      ))}
                    </div>
                  </section>
                ))}
                <section className="card">
                  <h3>导出设计变量</h3>
                  <div className="actions">
                    <button onClick={() => download(tokens(scan), "css")}>
                      下载 CSS
                    </button>
                    <button
                      onClick={() =>
                        download(JSON.stringify(scan, null, 2), "json")
                      }
                    >
                      下载 JSON
                    </button>
                    <button
                      onClick={() => void copy(JSON.stringify(scan, null, 2))}
                    >
                      复制 JSON
                    </button>
                  </div>
                </section>
              </>
            )}
            <p className="hint">
              字体列表不代表实际绘制字体。透明背景不推断底色；不分析图片、Canvas、iframe
              或 Shadow DOM。
            </p>
          </>
        )}
        <footer>
          <span>
            <Icon name="shield" size={15} /> 本地分析，不上传页面数据
          </span>
          <button className="text" onClick={() => setHelp(!help)}>
            帮助
          </button>
        </footer>
        {help && (
          <section className="card">
            <h3>关于 FF Lens</h3>
            <p>
              在普通网页点击扩展图标授权，然后开启拾取。选择点击将阻止原操作，Esc
              恢复正常浏览。支持主文档普通 DOM；iframe 与 Shadow DOM
              内部不支持。
            </p>
            <p>
              如页面导航后无法连接，请再次点击工具栏图标授权。file
              页面需在扩展详情中允许访问文件网址。
            </p>
          </section>
        )}
      </main>
      <div className="toast" role="status">
        {notice}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
