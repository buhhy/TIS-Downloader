var hostName = "https://techinfo.toyota.com";
var navUrl = hostName + "/t3Portal/resources/jsp/siviewer/";
var startingPoint = "nav.jsp?"
    + "dir=rm%2FRM30G0U&openSource=null&href=xhtml%2FRM1000000006BKQ.html&t3Id=RM1000000006BKQ&"
    + "pubNo=RM30G0U&docId=1974527&objectType=rm&locale=en&home=null&docTitle=null&modelyear=2015";
var $bufferFrame = $("<div></div>");
var navItemRegex = /var TREE_ITEMS = \[(.+?)\];/;
var pageRedirectRegex = /location='(.+?)'\+location.hash/;

var HTML_TYPE = 1;
var CSS_TYPE = 2;
var BLOB_TYPE = 3;

// Cache for checking which resources have loaded
var globalLoadedResources = {};

function downloadNavData(callback) {
  fetchNavData(startingPoint, function (data) {
    // Top-level section (General, Brake, Drivetrain, etc) DOM tree isn't loaded until they are
    // clicked, and even then only 1 can be open at a time. Hence we need to loop through each top
    // level section to get the sub-sections. Once a sub-section is loaded, the entire sub-section
    // tree is populated at once.
    var allNavUrls = data.filter(arrayFilter).map(function (elem) {
      return elem[1];
    });
    var count = 0;
    // This request already fetches the first top-level section, and there is no need to fetch
    // it twice (not to mention the url isn't provided for the currently open section).
    var allNavData = [ data ];

    allNavUrls.forEach(function (url, index) {
      if (url) {
        count ++;
        fetchNavData(url, function (data) {
          allNavData[index] = data;
          count --;
          if (count === 0)
            callback(allNavData);
        });
      }
    });
  });
}

function fetchNavData(url, callback) {
  $.ajax({
    url: navUrl + url,
  }).done(function (results) {
    $bufferFrame.html(results.trim());
    var treeScript = $bufferFrame.find("#tree").children("script").filter(function (_, elem) {
      return !$(elem).attr("src");
    });
    var script = treeScript.text().trim();
    var regexResult = navItemRegex.exec(script);
    var data = eval(regexResult[1]);
    callback(data);
  });
}

function fetchPageData(absoluteUrl) {
  absoluteUrl = removeUrlFluff(absoluteUrl) + "?locale=en";

  var callback = function (absoluteUrl, loadedPage) {
    var container = $("<div></div>");
    container.html(loadedPage);

    // Check for and load missing resources as blobs
    unique(container.find("img[src*='/']").map(jqAttrMap("src")).toArray()).forEach(
      function (url) {
        var absoluteUrl = hostName + url;
        if (!existsInCache(absoluteUrl)) {
          // Fetch and save to cache
          blobGetRequest(absoluteUrl, function (data) {
            writeToCache(absoluteUrl, BLOB_TYPE, data);
          });
        }
      });

    // Check for and load missing css
    unique(container.find("link[href*='/']").map(jqAttrMap("href")).toArray()).forEach(
      function (url) {
        var absoluteUrl = hostName + url;
        if (!existsInCache(absoluteUrl)) {
          // Fetch and save to cache
          $.ajax(absoluteUrl).done(function (results) {
            writeToCache(absoluteUrl, CSS_TYPE, results);
          });
        }
      });

    // Check for and load missing links
    unique(container.find("a[href*='/']").map(jqAttrMap("href")).toArray()).forEach(
      function (url) {
        var absoluteUrl = hostName + url;
        if (!existsInCache(absoluteUrl)) {
          // Recursively fetch page and save to cache
          fetchPageData(absoluteUrl);
        }
      });

    // Write page to global cache
    writeToCache(absoluteUrl, HTML_TYPE, loadedPage);
  };

  $.ajax({
    url: absoluteUrl,
  }).done(function (results) {
    // Not sure why they return an empty script with redirect url sometimes...
    var regexCheck = pageRedirectRegex.exec(results);
    if (regexCheck === null) {
      callback(absoluteUrl, results);
    } else {
      $.ajax({
        url: hostName + regexCheck[1],
      }).done(function (results) {
        callback(hostName + regexCheck[1], results);
      });
    }
  });
}

function downloadPages(navTree) {
  var ran = false;
  var recurseTree = function (node) {
    if (node.isLeaf && !ran) {
      console.log(node.url);
      fetchPageData(hostName + node.url);
      
      ran = true;
    }

    node.children.forEach(recurseTree);
  };

  recurseTree(navTree);
}

function parseAllNavData(results) {
  var navs = results.map(function (result) {
    return result.find(function (elem) {
      return isArray(elem) && elem.length > 3;
    });
  });

  var recurseTree = function (node) {
    return {
      title: node[0],
      url: node[1] || undefined,
      isLeaf: !!node[1],
      children: node.filter(arrayFilter).map(recurseTree)
    };
  };

  var parsedTree = {
    title: "root",
    isRoot: true,
    isLeaf: false,
    children: navs.map(recurseTree)
  };

  console.log(parsedTree);

  downloadPages(parsedTree);
}

/**
 * Helper functions
 */

function isArray(obj) {
  return obj.constructor === Array;
}

function arrayFilter(elem) {
  return isArray(elem);
}

function jqAttrMap(name) {
  return function (_, elem) {
    return $(elem).attr(name);
  };
}

function unique(urls) {
  var seen = {};
  return urls.filter(function (item) {
    var defluffed = removeUrlFluff(item);
    return seen.hasOwnProperty(defluffed) ? false : (seen[defluffed] = true);
  });
}

function blobGetRequest(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open("GET", url, true);
  xhr.responseType = "arraybuffer";

  xhr.onload = function(e) {
    // response is unsigned 8 bit integer
    callback(new Uint8Array(this.response));
  };
   
  xhr.send();
}

function removeUrlFluff(url) {
  var qpos = url.indexOf("?");
  if (qpos !== -1)
    return url.slice(0, qpos);
  return url;
}

function processUrl(absoluteUrl) {
  var processedUrl = absoluteUrl.toLowerCase();
  return removeUrlFluff(processedUrl);
}

/**
 * Cache functions
 */

function writeToCache(absoluteUrl, type, content) {
  globalLoadedResources[processUrl(absoluteUrl)] = {
    type: type,
    content: content
  };
}

function existsInCache(absoluteUrl) {
  return globalLoadedResources[processUrl(absoluteUrl)] !== undefined;
}

function clearCache() {
  globalLoadedResources = {};
}
