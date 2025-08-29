// Relay dates found in any frame to the TOP frame for logging with the resort slug
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (!sender?.tab?.id) return;

  if (msg?.type === "DATES_FOUND") {
    // Forward to TOP frame (frameId 0) in the same tab
    chrome.tabs.sendMessage(sender.tab.id, { type: "DATES_FOUND", payload: msg.payload }, { frameId: 0 });
  }
});