import type { Snapshot } from "./model.ts";

export interface PageConnection {
  ping: () => Promise<{ snapshot?: Snapshot }>;
  inject: () => Promise<unknown>;
}

export async function ensurePageConnection(connection: PageConnection) {
  try {
    return await connection.ping();
  } catch {
    // Receiving-end errors are expected before the first injection.
    // If injection is denied, propagate that error and do not send commands.
    await connection.inject();
    return connection.ping();
  }
}

export function pageConnectionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (
    /chrome:\/\/|edge:\/\/|extensions gallery|webstore|cannot be scripted/i.test(
      message,
    )
  ) {
    return "此页面受浏览器保护，无法检查。请打开普通 http/https 网页，再点击工具栏中的 FF Lens 图标。";
  }
  if (
    /cannot access|host permission|permission to access|not allowed to access/i.test(
      message,
    )
  ) {
    return "当前网页尚未授权或不允许注入。请点击浏览器工具栏中的 FF Lens 图标授权并重连；文件页面还需在扩展详情中开启“允许访问文件网址”。";
  }
  if (
    /receiving end does not exist|could not establish connection|message port closed/i.test(
      message,
    )
  ) {
    return "页面检查脚本尚未连接。请在目标网页点击工具栏中的 FF Lens 图标；扩展更新后请刷新网页再试。";
  }
  if (/extension context invalidated/i.test(message)) {
    return "扩展已更新，请刷新目标网页，关闭侧边栏后重新点击工具栏中的 FF Lens 图标。";
  }
  return message || "连接失败，请在目标网页点击工具栏中的 FF Lens 图标后重试。";
}
