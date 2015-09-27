var ImageFetcher = function () {
  this.maxConcurrentRequests = 2;
  this.imageFetchQueue = [];
  this.concurrentRequestCount = 0;
};

ImageFetcher.prototype.addImageToQueue = function (url, callback) {
  this.imageFetchQueue.push({
    url: url,
    callback: callback
  });

  this.processQueue();
};

ImageFetcher.prototype.processQueue = function () {
  if (this.concurrentRequestCount < this.maxConcurrentRequests && this.imageFetchQueue.length > 0) {
    var elem = this.imageFetchQueue.shift();
    this.sendRequest(elem.url, elem.callback);
  }
};

ImageFetcher.prototype.sendRequest = function (url, callback) {
  var xhr = new XMLHttpRequest();
  var self = this;
  xhr.open("GET", url, true);
  xhr.responseType = "arraybuffer";

  xhr.onload = function() {
    // response is unsigned 8 bit integer
    self.concurrentRequestCount --;
    self.processQueue();
    callback(new Uint8Array(this.response));
  };

  this.concurrentRequestCount ++;
  xhr.send();
};