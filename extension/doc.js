var DocumentFetcher = function () {
  this.maxConcurrentRequests = 15;
  this.documentFetchQueue = [];
  this.concurrentRequestCount = 0;
};

DocumentFetcher.prototype.addDocumentToQueue = function (url, callback) {
  this.documentFetchQueue.push({
    url: url,
    callback: callback
  });

  this.processQueue();
};

DocumentFetcher.prototype.processQueue = function () {
  if (this.concurrentRequestCount < this.maxConcurrentRequests
      && this.documentFetchQueue.length > 0) {
    var elem = this.documentFetchQueue.shift();
    $.ajax(elem.url).done(elem.callback);
  }
};
