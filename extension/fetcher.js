var TIS_HOST_NAME = "https://techinfo.toyota.com";
var TIS_NAV_BASE_URL = TIS_HOST_NAME + "/t3Portal/resources/jsp/siviewer/";
//var startingPoint = "nav.jsp?"
//    + "dir=rm%2FRM30G0U&openSource=null&href=xhtml%2FRM1000000006BKQ.html&t3Id=RM1000000006BKQ&"
//    + "pubNo=RM30G0U&docId=1974527&objectType=rm&locale=en&home=null&docTitle=null&modelyear=2015";
var startingPoint = "nav.jsp?" +
    "dir=ncf%2FNM30G0U&openSource=null&href=xhtml%2FNM10000000060CP.html&t3Id=NM10000000060CP&" +
    "pubNo=NM30G0U&docId=1979880&objectType=ncf&locale=en&home=null&docTitle=null&modelyear=2015";
var $bufferFrame = $("<div></div>");
var navItemRegex = /var TREE_ITEMS = \[(.+?)\];/;
var pageRedirectRegex = /location='(.+?)'\+location.hash/;

var HTML_ROOT_FOLDER = [ "pages" ];
var HTML_ARTICLES_FOLDER = [ "pages", "articles" ];
var HTML_RESOURCES_FOLDER = [ "pages", "resources" ];
var IMG_FOLDER = [ "img" ];
var CSS_FOLDER = [ "css" ];

var MISSING_NAV_URLS = {
  "Engine / Hybrid System": "nav.jsp?" +
      "locale=en&dir=ncf%2FNM30G0U&modelyear=2015&pcd=06/2014-08/2015&startDate=201406&" +
      "endDate=201508&docTitle=null&section=Engine+%2F+Hybrid+System&pcdChangeBack=null"
};

// Cache for checking which resources have loaded
var resourceMetadataCache = new UrlCache();

var imageFetcher = new ImageFetcher();
var documentFetcher = new DocumentFetcher();

function downloadEntireManual(callback) {
  downloadNavMetadata(function (navTree) {
    callback(navTree, globalLoadedResources);
  });
}

// Nav download ---------------------------------

function downloadNavMetadata(callback) {
  fetchNavData(startingPoint, function (data) {
    // Top-level section (General, Brake, Drivetrain, etc) DOM tree isn't loaded until they are
    // clicked, and even then only 1 can be open at a time. Hence we need to loop through each top
    // level section to get the sub-sections. Once a sub-section is loaded, the entire sub-section
    // tree is populated at once.
    var allNavUrls = data.filter(arrayFilter).map(function (elem) {
      if (elem[1].length > 0)
        return elem[1];
      if (MISSING_NAV_URLS[elem[0]])
        return MISSING_NAV_URLS[elem[0]];
      throw "Nav entry `" + elem[0] + "` not found.";
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
            parseAllNavData(allNavData, callback);
        });
      }
    });
  });
}

function fetchNavData(url, callback) {
  $.ajax(TIS_NAV_BASE_URL + url).done(function (results) {
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

function parseAllNavData(results, callback) {
  var navs = results.map(function (result) {
    return result.find(function (elem) {
      return isArray(elem) && elem.length > 3;
    });
  });

  var recurseTree = function (dirPathArray) {
    return function (node) {
      var entry = {
        title: node[0],
        url: node[1] ? TIS_HOST_NAME + node[1] : undefined,
        isLeaf: !!node[1]
      };
      var name = formatSectionNameForUrl(entry.title);

      if (entry.isLeaf) {
        entry.folderPathArray = dirPathArray;
        entry.shortTitle = simpleSectionName(entry.title);
        entry.fileName = name + ".html";
        var resEntry =
            resourceMetadataCache.writeToCache(entry.url, HTML_ARTICLE_TYPE, dirPathArray, entry.fileName);
        entry.filePathArray = resEntry.newFilePath;
      } else {
        entry.children = node.filter(arrayFilter).map(recurseTree(dirPathArray.concat([ name ])));
      }

      return entry;
    };
  };

  callback({
    title: "root",
    isRoot: true,
    isLeaf: false,
    children: navs.map(recurseTree(HTML_ARTICLES_FOLDER))
  });
}

// Page download ---------------------------------

function downloadCssResourceMetadata(resourceEntry, localCache, callback) {
  documentFetcher.addDocumentToQueue(
      removeUrlQuery(resourceEntry.fullUrl),
      function (results) {
        var rootUrl = extractUrlResourcePath(resourceEntry.fullUrl);
        var urlRegex = /url\((.+?)\)/g;
        var match;

        while (match = urlRegex.exec(results)) {
          var absoluteUrl = simplifyUrl(rootUrl + match[1]);
          if (!resourceMetadataCache.existsInCache(absoluteUrl)) {
            var entry = resourceMetadataCache.writeToCache(
                absoluteUrl, BLOB_TYPE, IMG_FOLDER, extractUrlResourceName(absoluteUrl));
            localCache.set(absoluteUrl, entry);
          } else {
            localCache.set(absoluteUrl, resourceMetadataCache.get(absoluteUrl));
          }
          callback();
        }
      });
}

function downloadPageMetadata(pageNavEntry, callback) {
  var absoluteUrl = removeUrlQuery(pageNavEntry.url) + "?locale=en";
  var localCache = new UrlCache();

  var ajaxCallback = function (absoluteUrl, loadedPage) {
    var container = $("<div></div>");

    var ajaxCount = 0;
    var finalCallback = function () {
      ajaxCount --;
      if (ajaxCount === 0)
        callback(loadedPage, entry, localCache);
    };

    container.html(loadedPage);

    // Check for and load missing resources as blobs
    unique(container.find("img[src*='/']").map(jqAttrMap("src")).toArray()).forEach(
      function (url) {
        var absoluteUrl = TIS_HOST_NAME + url;
        if (!resourceMetadataCache.existsInCache(absoluteUrl)) {
          var entry = resourceMetadataCache.writeToCache(
              absoluteUrl, BLOB_TYPE, IMG_FOLDER, extractUrlResourceName(url));
          localCache.set(absoluteUrl, entry);
        } else {
          localCache.set(absoluteUrl, resourceMetadataCache.get(absoluteUrl));
        }
      });

    // Check for and load missing css
    unique(container.find("link[href*='/']").map(jqAttrMap("href")).toArray()).forEach(
      function (url) {
        var absoluteUrl = TIS_HOST_NAME + url;
        if (!resourceMetadataCache.existsInCache(absoluteUrl)) {
          var entry = resourceMetadataCache.writeToCache(
              absoluteUrl, CSS_TYPE, CSS_FOLDER, extractUrlResourceName(url));
          localCache.set(absoluteUrl, entry);

          ajaxCount ++;
          downloadCssResourceMetadata(entry, localCache, function () {
            finalCallback();
          });
        } else {
          localCache.set(absoluteUrl, resourceMetadataCache.get(absoluteUrl));
        }
      });

    // Check for and load missing links
    unique(container.find("a[href*='/']").map(jqAttrMap("href")).toArray()).forEach(
      function (url) {
        var absoluteUrl = TIS_HOST_NAME + url;
        if (!resourceMetadataCache.existsInCache(absoluteUrl)) {
          var entry = resourceMetadataCache.writeToCache(
              absoluteUrl, HTML_RESOURCE_TYPE, HTML_RESOURCES_FOLDER, extractUrlResourceName(url));
          localCache.set(absoluteUrl, entry);
        } else {
          localCache.set(absoluteUrl, resourceMetadataCache.get(absoluteUrl));
        }
      });

    // No need to write page to global cache, since it has already been seeded with the nav entries
    var entry = localCache.writeToCache(
        absoluteUrl, HTML_ARTICLE_TYPE, pageNavEntry.folderPathArray, pageNavEntry.fileName);
    ajaxCount ++;
    finalCallback();
  };

  documentFetcher.addDocumentToQueue(absoluteUrl, function (results) {
    // Not sure why they return an empty script with redirect url sometimes...
    var regexCheck = pageRedirectRegex.exec(results);
    if (regexCheck === null) {
      ajaxCallback(absoluteUrl, results);
    } else {
      documentFetcher.addDocumentToQueue(TIS_HOST_NAME + regexCheck[1], function (results) {
        ajaxCallback(TIS_HOST_NAME + regexCheck[1], results);
      });
    }
  });
}

// Resource loading

function getResourceMetadataEntries() {
  var resourceEntries = [];

  resourceMetadataCache.forEach(function (key, value) {
    if (value.type !== HTML_ARTICLE_TYPE)
      resourceEntries.push(value);
  });

  return resourceEntries;
}

function downloadResource(resourceEntry, callback) {
  if (resourceEntry.type === BLOB_TYPE) {
    imageFetcher.addImageToQueue(resourceEntry.fullUrl, function (uint8Array) {
      callback(uint8Array);
    });
    return true;
  } else if (resourceEntry.type === CSS_TYPE) {
    documentFetcher.addDocumentToQueue(resourceEntry.fullUrl, function (results) {
      callback(results);
    });
    return true;
  }

  return false;
}

//function fetchPageData(absoluteUrl, newFolderPath, callback) {
//  absoluteUrl = removeUrlQuery(absoluteUrl) + "?locale=en";
//
//  var remainingCallCount = 0; // synchronizer count
//  var doneCallCount = 0;
//
//  var finalCallback = function (callCount) {
//    remainingCallCount --;
//    doneCallCount += callCount;
//    if (remainingCallCount === 0)
//      callback(remainingCallCount);
//  };
//
//  var ajaxCallback = function (absoluteUrl, loadedPage) {
//    var container = $("<div></div>");
//
//    container.html(loadedPage);
//
//    // Check for and load missing resources as blobs
//    unique(container.find("img[src*='/']").map(jqAttrMap("src")).toArray()).forEach(
//        function (url) {
//          var absoluteUrl = TIS_HOST_NAME + url;
//          if (!existsInCache(absoluteUrl)) {
//            // Fetch and save to cache
//            remainingCallCount ++;
//            blobGetRequest(absoluteUrl, function (data) {
//              writeToCache(absoluteUrl, BLOB_TYPE, data);
//              setNewPathInCache(absoluteUrl, IMG_FOLDER, extractUrlResourceName(url));
//              finalCallback(1);
//            });
//          }
//        });
//
//    // Check for and load missing css
//    unique(container.find("link[href*='/']").map(jqAttrMap("href")).toArray()).forEach(
//        function (url) {
//          var absoluteUrl = TIS_HOST_NAME + url;
//          if (!existsInCache(absoluteUrl)) {
//            // Fetch and save to cache
//            remainingCallCount ++;
//            $.ajax(absoluteUrl).done(function (results) {
//              writeToCache(absoluteUrl, CSS_TYPE, results);
//              setNewPathInCache(absoluteUrl, CSS_FOLDER, extractUrlResourceName(url));
//              finalCallback(1);
//            });
//          }
//        });
//
//    // Check for and load missing links
//    unique(container.find("a[href*='/']").map(jqAttrMap("href")).toArray()).forEach(
//        function (url) {
//          var absoluteUrl = TIS_HOST_NAME + url;
//          if (!existsInCache(absoluteUrl)) {
//            // Recursively fetch page and save to cache
//            remainingCallCount ++;
//            fetchPageData(absoluteUrl, function (callCount) {
//              setNewPathInCache(absoluteUrl, HTML_FOLDER, undefined);
//              finalCallback(callCount);
//            });
//          }
//        });
//
//    // Write page to global cache
//    writeToCache(absoluteUrl, HTML_TYPE, loadedPage);
//  };
//
//  $.ajax(absoluteUrl).done(function (results) {
//    // Not sure why they return an empty script with redirect url sometimes...
//    var regexCheck = pageRedirectRegex.exec(results);
//    if (regexCheck === null) {
//      ajaxCallback(absoluteUrl, results);
//    } else {
//      $.ajax(TIS_HOST_NAME + regexCheck[1]).done(function (results) {
//        ajaxCallback(TIS_HOST_NAME + regexCheck[1], results);
//      });
//    }
//  });
//}
//
//function downloadPages(navTree, callback) {
//  var remainingCallCount = 0;
//
//  var recurseTree = function (node) {
//    var nodePathName = formatSectionNameForUrl(node.title);
//
//    if (node.isLeaf) {
//      var absoluteUrl = node.url;
//
//      remainingCallCount ++;
//      fetchPageData(absoluteUrl, function (callCount) {
//        console.log("Fetched " + callCount + " resources for url `" + node.url + "`");
//
//        // set relative url to rewrite to once on the hard disk
//        setNewPathInCache(absoluteUrl, HTML_FOLDER, nodePathName + ".html");
//        remainingCallCount --;
//        if (remainingCallCount === 0)
//          callback(navTree);
//      });
//    } else {
//      node.children.forEach(recurseTree);
//    }
//  };
//
//  recurseTree(navTree);
//}

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
    var defluffed = removeUrlQuery(item);
    return seen.hasOwnProperty(defluffed) ? false : (seen[defluffed] = true);
  });
}

function simpleSectionName(name) {
  var scIndex = name.indexOf(";");
  if (scIndex !== -1)
    name = name.slice(0, scIndex);
  return name;
}

function formatSectionNameForUrl(name) {
  // change to lower case, remove anything after a ';' character, replace spaces, and remove all
  // non alpha-numeric characters
  return simpleSectionName(name).toLowerCase().replace(/ /g, "_").replace(/\W/g, '');
}

/**
 * Cache functions
 */

