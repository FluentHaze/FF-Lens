import type { Event, Request } from "../src/model";
type Listener = (
  message: Request,
  sender: chrome.runtime.MessageSender,
  reply: (value: unknown) => void,
) => void;
let receive: Listener | undefined;
let clicks = 0;
const status = document.querySelector("output")!;
Object.defineProperty(globalThis, "chrome", {
  configurable: true,
  value: {
    runtime: {
      sendMessage: async (event: Event) => {
        status.textContent = event.kind;
      },
      onMessage: {
        addListener: (listener: Listener) => {
          receive = listener;
        },
      },
      onConnect: { addListener: () => {} },
    },
  },
});
await import("../src/content");
function command(command: Request["command"]) {
  receive?.({ source: "ff-lens", command }, {}, () => {});
}
document.querySelector("#pick")!.addEventListener("click", () => {
  command("PICK");
  status.textContent = "picking";
});
document
  .querySelector("#clear")!
  .addEventListener("click", () => command("CLEAR"));
document.querySelector("#target")!.addEventListener("click", (event) => {
  (event.target as HTMLElement).textContent = `页面按钮 · 点击 ${++clicks} 次`;
});
status.textContent = "ready";
