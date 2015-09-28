var HTML_ARTICLE_TYPE = 1;
var HTML_RESOURCE_TYPE = 2;
var CSS_TYPE = 5;
var BLOB_TYPE = 10;

function removeUrlQuery(url) {
  var qpos = url.indexOf("?");
  if (qpos !== -1)
    return url.slice(0, qpos);
  return url;
}

function extractUrlResourceName(url) {
  var spos = url.lastIndexOf("/");
  if (spos !== -1)
    return url.slice(spos + 1);
  return url;
}

function extractUrlResourcePath(url) {
  var spos = url.lastIndexOf("/");
  if (spos !== -1)
    return url.slice(0, spos + 1);
  return url;
}

function simplifyUrl(url) {
  var dots = "/..";
  var match = -1;
  while ((match = url.lastIndexOf(dots)) !== -1) {
    var nextMatch = url.lastIndexOf("/", match - 1);
    if (nextMatch !== -1)
      url = url.slice(0, nextMatch) + url.slice(match + dots.length);
  }
  return url;
}

// Functional convenience functions
var fn = {
  filterNotNull: function (e) { return e !== null && e !== undefined; }
};
