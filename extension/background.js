chrome.browserAction.onClicked.addListener(function (tab) {
  clearCache();
  downloadNavData(parseAllNavData);
});
