var appId = "lmonlndnffkpimppiabjefgdlmnbmlbj";

chrome.browserAction.onClicked.addListener(function (tab) {
  clearCache();
  downloadEntireManual(function (headerTree, resourceCache) {
    console.log("Done downloading " + resourceCache.keySet().length + " resources");
  });
});

chrome.runtime.onMessageExternal.addListener(function (request, sender, sendResponse) {
  if (sender.id == appId) {
    downloadEntireManual(function (headerTree, resourceCache) {
      sendResponse({
        hostName: hostName,
        headerTree: headerTree,
        resourceCache: resourceCache
      });
    }
  }
});
