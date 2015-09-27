var HTML_TYPE = 1;
var CSS_TYPE = 2;
var BLOB_TYPE = 3;

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

// Functional convenience functions
var fn = {
  filterNotNull: function (e) { return e !== null && e !== undefined; }
};
