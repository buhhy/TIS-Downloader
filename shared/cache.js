var UrlCache = function (seedMap) {
  if (seedMap !== undefined)
    this.map = seedMap;
  else
    this.map = {};
};

UrlCache.prototype.processUrl = function (absoluteUrl) {
  var processedUrl = absoluteUrl.toLowerCase();
  return removeUrlQuery(processedUrl);
};

UrlCache.prototype.processUrl = function (absoluteUrl) {
  var processedUrl = absoluteUrl.toLowerCase();
  return removeUrlQuery(processedUrl);
};

UrlCache.prototype.writeToCache = function (absoluteUrl, type, newFolderPathArray, newFileName) {
  var entry = {
    type: type,
    isLoaded: false,
    newFilePath: newFolderPathArray.concat([ newFileName ])
  };
  this.map[this.processUrl(absoluteUrl)] = entry;
  return entry;
};

UrlCache.prototype.get = function (absoluteUrl) {
  if (this.existsInCache(absoluteUrl))
    return this.map[this.processUrl(absoluteUrl)];
  return null;
};

UrlCache.prototype.set = function (absoluteUrl, entry) {
  this.map[this.processUrl(absoluteUrl)] = entry;
  return entry;
};

UrlCache.prototype.existsInCache = function (absoluteUrl) {
  return this.map[this.processUrl(absoluteUrl)] !== undefined;
};

UrlCache.prototype.clearCache = function () {
  this.map = {};
};

UrlCache.prototype.toMap = function () {
  return this.map;
};

UrlCache.prototype.size = function () {
  return this.map.keys().length;
};
