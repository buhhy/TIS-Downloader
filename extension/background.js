var appId = "lmonlndnffkpimppiabjefgdlmnbmlbj";

chrome.browserAction.onClicked.addListener(function () {
  resourceMetadataCache.clearCache();
  downloadEntireManual(function (headerTree, resourceCache) {
    console.log("Done downloading " + resourceCache.size() + " resources");
  });
});

chrome.runtime.onMessageExternal.addListener(function (request, sender, sendResponse) {
  if (sender.id == appId) {
    if (request.type === "fetchNav") {
      downloadNavMetadata(function (navTree) {
        sendResponse({
          hostName: TIS_HOST_NAME,
          navTree: navTree
        });
      });
    } else if (request.type === "clearCache") {
      resourceMetadataCache.clearCache();
      sendResponse();
    } else if (request.type === "fetchPage") {
      downloadPageMetadata(
          request.pageNavEntry,
          function (pageContent, pageMetadata, localCache) {
            sendResponse({
              pageContent: pageContent,
              pageResourceEntry: pageMetadata,
              localCacheMap: localCache.toMap()
            });
          });
    }
    //downloadEntireManual(function (headerTree, resourceCache) {
    //  sendResponse({
    //    hostName: TIS_HOST_NAME,
    //    headerTree: headerTree,
    //    resourceCache: resourceCache
    //  });
    //});
    
    // sendResponse({
    //   hostName: testHostName,
    //   headerTree: testNavTree,
    //   resourceCache: testResourceCache
    // });
    return true;
  }
});
