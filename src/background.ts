// Use the action event so toolbar clicks both grant activeTab and reconnect
// an already open panel. A click inside the panel cannot grant activeTab.
function configurePanel() {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: false })
    .catch(console.error);
}
configurePanel();
chrome.runtime.onInstalled.addListener(configurePanel);
chrome.action.onClicked.addListener((tab) => {
  // Keep open() directly in the user gesture, before any asynchronous work.
  chrome.sidePanel
    .open({ windowId: tab.windowId })
    .then(() => {
      if (tab.id === undefined) return;
      chrome.runtime
        .sendMessage({
          source: "ff-lens",
          kind: "reconnect",
          tabId: tab.id,
        })
        .catch(() => {
          // A newly opened panel connects on mount; it may not be listening yet.
        });
    })
    .catch(console.error);
});
