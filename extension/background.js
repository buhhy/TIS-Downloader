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
    } else if (request.type === "getMetadataCache") {
      sendResponse({
        metadataCache: resourceMetadataCache.toMap(),
        resourceMetadataEntries: getResourceMetadataEntries()
      });
    } else if (request.type === "fetchResource") {
      var success = downloadResource(request.resourceEntry, function (data) {
        sendResponse({
          data: data,
          success: true
        });
      });

      if (!success) {
        sendResponse({
          success: false
        });
      }
    }
    return true;
  }
});
