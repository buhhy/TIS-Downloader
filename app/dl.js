var extensionId = "omebceocojbigcbancdjmpekobelcjgg";

var currentFileEntry;

chrome.runtime.onMessageExternal.addListener(function (request, sender, sendResponse) {
  if (sender.id === extensionId) {
    if (request.type === "saveImage") {
      if (currentFileEntry) {
        var imgData = request.data;
        var imgName = getFileName(imgData.newFilePath);
        console.log("Received request to save image `" + imgName + "`");

        // Uint8Array is mangled by the extension -> app communication to an index -> value map
        var array = [];
        for (var key in imgData.content) {
          if (imgData.content.hasOwnProperty(key))
            array[key] = imgData.content[key];
        }
        writeFile(
            dirEntry,
            getFileName(imgData.newFilePath),
            new Uint8Array(array),
            function () {
              sendResponse({ success: true });
            },
            function () {
              console.error("Write error while saving image `" + imgName + "`");
              sendResponse({ success: false });
            });
      } else {
        console.error("No current file error detected...");
        sendResponse({ success: false });
      }
    }

    return true;
  }
});

$("#saveButton").click(function () {
  chrome.fileSystem.chooseEntry({
    type: "openDirectory"
  }, function (dirEntry) {
    currentFileEntry = dirEntry;

    copyTemplateFiles(function (templateFiles) {
      templateFiles.forEach(function (file) {
        writeFile(dirEntry, file.name, file.content);
      });
    });

    requestManualNavData(function (navTreeRoot, hostName) {
      console.log(navTreeRoot);
      console.log(hostName);

      var navJsonFile = generateNavJsonFile(navTreeRoot);
      writeFile(dirEntry, navJsonFile.name, navJsonFile.content);

      requestManualAllPageData(dirEntry, hostName, navTreeRoot, function () {
        requestManualAllResourceData(dirEntry, hostName, function () {
          console.log("Download complete!")
        });
      });
    });
  });
});

function requestManualNavData(callback) {
  console.log("Retrieving navigation tree catalog...");
  chrome.runtime.sendMessage(
      extensionId,
      { type: "fetchNav" },
      function (response) {
        console.log("Navigation data retrieval successful!");
        callback(response.navTree, response.hostName);
      });
}

function requestManualPageData(dirEntry, hostName, pageNavEntry, callback) {
  console.log("Retrieving page `" + pageNavEntry.title + "`...");
  chrome.runtime.sendMessage(
      extensionId,
      {
        type: "fetchPage",
        pageNavEntry: pageNavEntry
      },
      function (response) {
        withFolder(dirEntry, pageNavEntry.folderPathArray, function (dirEntry) {
          writeFile(
              dirEntry,
              pageNavEntry.fileName,
              replaceUrlsInHtml(
                  response.pageContent,
                  response.pageResourceEntry,
                  new UrlCache(response.localCacheMap),
                  hostName),
              callback);
        });
      });
}

function requestManualAllPageData(dirEntry, hostName, pageNavRoot, callback) {
  var ajaxCount = 0;

  var tempRunCount = 0;

  var finalCallback = function () {
    ajaxCount --;
    console.log(ajaxCount);
    if (ajaxCount === 0)
      callback();
  };

  var recurseFn = function (entry) {
    if (entry.isLeaf) {
      //tempRunCount ++;

      //if (tempRunCount < 999999) {
        ajaxCount ++;
        requestManualPageData(dirEntry, hostName, entry, finalCallback);
      //}
    } else {
      entry.children.forEach(recurseFn);
    }
  };

  recurseFn(pageNavRoot);
}

function requestManualAllResourceData(dirEntry, hostName, callback) {
  var ajaxCount = 0;
  var finalCallback = function () {
    ajaxCount --;
    if (ajaxCount === 0)
      callback();
  };

  chrome.runtime.sendMessage(
      extensionId,
      { type: "getMetadataCache" },
      function (response) {
        console.log("Loading " + response.resourceMetadataEntries.length + " resource files...");

        var metadataCache = new UrlCache(response.metadataCache);

        response.resourceMetadataEntries.forEach(function (resEntry) {
          ajaxCount ++;
          chrome.runtime.sendMessage(
              extensionId,
              {
                type: "fetchResource",
                resourceEntry: resEntry
              },
              function (response) {
                if (response.success) {
                  var content;

                  if (resEntry.type === BLOB_TYPE) {
                    var imgData = response.data;

                    // Uint8Array is mangled by the extension -> app communication to an
                    // index -> value map
                    var array = [];
                    for (var key in imgData) {
                      if (imgData.hasOwnProperty(key))
                        array[key] = imgData[key];
                    }

                    content = new Uint8Array(array);
                  } else if (resEntry.type === CSS_TYPE) {
                    var cssData = response.data;
                    content = replaceUrlsInCss(cssData, resEntry, metadataCache, hostName);
                  } else if (resEntry.type === HTML_RESOURCE_TYPE) {
                    var htmlData = response.data;
                    content = replaceUrlsInHtml(htmlData, resEntry, metadataCache, hostName);
                  } else {
                    content = response.textData;
                  }

                  withFolder(dirEntry, resEntry.folderPathArray, function (dirEntry) {
                    writeFile(
                        dirEntry,
                        resEntry.fileName,
                        content,
                        finalCallback,
                        finalCallback);
                  });
                } else {
                  finalCallback();
                }
              });
        });
      });
}

// Template files

function copyTemplateFiles(callback) {
  var copyFiles = [ "index.html", "index.css", "index.js", "jquery.js" ];
  var remainingApiCalls = copyFiles.length;
  var apiResults = [];

  copyFiles.forEach(function (fn) {
    $.ajax("templates/" + fn).done(function (file) {
      apiResults.push({
          name: fn,
          content: file
        });
      remainingApiCalls --;
      if (remainingApiCalls === 0)
        callback(apiResults);
    });
  });
}

function generateNavJsonFile(navTree) {
  var recurse = function (node) {
    var newNode = {
      title: node.title,
      shortTitle: node.shortTitle,
      isLeaf: node.isLeaf,
      isRoot: node.isRoot
    };

    if (node.isLeaf)
      newNode.url = makeFullPath(node.filePathArray);
    else
      newNode.children = node.children
          .filter(fn.filterNotNull)
          .map(recurse)
          .filter(fn.filterNotNull);

    return newNode;
  };

  return {
    name: "nav.json",
    content: JSON.stringify(recurse(navTree), null, 2)
  };
}

//function writeResourceFiles(dirEntry, resourceCache, hostName) {
//  for (var url in resourceCache) {
//    if (resourceCache.hasOwnProperty(url)) {
//      (function (url) {
//        var value = resourceCache[url];
//        dirEntry.getDirectory(
//          makeFullPath(getFolderPath(value.newFilePath)),
//          { create: true },
//          function (dirEntry) {
//            if (value.type === HTML_TYPE) {
//              var html = replaceUrlsInHtml(value, resourceCache, hostName);
//              writeFile(dirEntry, getFileName(value.newFilePath), html);
//            } else if (value.type === BLOB_TYPE) {
//              // Uint8Array is mangled by the extension -> app communication to an index -> value map
//              var array = [];
//              for (var key in value.content) {
//                if (value.content.hasOwnProperty(key))
//                  array[key] = value.content[key];
//              }
//              writeFile(dirEntry, getFileName(value.newFilePath), new Uint8Array(array));
//            } else if (value.type === CSS_TYPE) {
//              // TODO(tlei): rewrite CSS
//              writeFile(dirEntry, getFileName(value.newFilePath), value.content);
//            }
//          });
//      })(url);
//    }
//  }
//}

// HTML rewriting tools

function replaceUrlsInCss(html, pageResourceEntry, resourceCache, hostName) {
  return replaceInHtml(
      /(url)(\(.+?\))/,
      html,
      pageResourceEntry,
      resourceCache,
      hostName,
      { start: "(", end: ")" });
}

function replaceUrlsInHtml(html, pageResourceEntry, resourceCache, hostName) {
  var hrefReplaced = replaceInHtml(
      /(href\s?=\s?)(".+?"|'.+?')/,
      html,
      pageResourceEntry,
      resourceCache,
      hostName);
  return replaceInHtml(
      /(src\s?=\s?)(".+?"|'.+?')/,
      hrefReplaced,
      pageResourceEntry,
      resourceCache,
      hostName);
}

function replaceInHtml(regex, html, pageResourceEntry, resourceCache, hostName, options) {
  var opts = options || { start: "'", end: "'" };
  var match;
  var currentHtml = "";
  var remainingHtml = html;

  while (match = regex.exec(remainingHtml)) {
    var start = match.index + match[1].length;
    var end = start + match[2].length;
    var matched = match[2].slice(opts.start.length, -opts.end.length); // remove the quotation marks

    var absoluteUrl;
    if (matched.startsWith("/"))
      absoluteUrl = simplifyUrl(hostName + matched);
    else
      absoluteUrl = simplifyUrl(extractUrlResourcePath(pageResourceEntry.fullUrl) + matched);

    currentHtml += remainingHtml.slice(0, start);
    if (resourceCache.existsInCache(absoluteUrl)) {
      var resourceEntry = resourceCache.get(absoluteUrl);
      var relativePathArray = makeRelativePathArray(
          getFolderPath(pageResourceEntry.newFilePath),
          getFolderPath(resourceEntry.newFilePath));
      relativePathArray.push(getFileName(resourceEntry.newFilePath));
      currentHtml += opts.start + makeFullPath(relativePathArray) + opts.end;
    } else {
      console.error("No resource found for url `" + absoluteUrl + "`");
      currentHtml += opts.start + matched + opts.end;
    }
    remainingHtml = remainingHtml.slice(end);
  }

  currentHtml += remainingHtml;
  return currentHtml;
}

// File utils

function withFolder(dirEntry, folderPathArray, callback) {
  var onNextFolder = function (index) {
    if (index === folderPathArray.length) {
      return callback;
    } else {
      return function (dirEntry) {
        dirEntry.getDirectory(
            folderPathArray[index],
            {create: true},
            onNextFolder(index + 1));
      };
    }
  };

  onNextFolder(0)(dirEntry);
}

function writeFile(dirEntry, fileName, content, onWriteSuccess, onWriteError) {
  chrome.fileSystem.getWritableEntry(dirEntry, function() {
    dirEntry.getFile(
      fileName,
      { create: true },
      function (entry) {
        entry.createWriter(function (writer) {
          writer.onwrite = function () {
            writer.onwrite = null;
            writer.truncate(writer.position);
            console.log("Writing to `" + fileName + "` successful!");
            if (onWriteSuccess)
              onWriteSuccess();
          };

          writer.onerror = onWriteError;

          writer.write(new Blob([ content ], { type: "" }));
        });
      });
  });
}

function getFolderPath(fullPathArray) {
  return fullPathArray.slice(0, -1);
}

function getFileName(fullPathArray) {
  return fullPathArray[fullPathArray.length - 1];
}

function makeFullPath(fullPathArray) {
  return fullPathArray.join("/");
}

function makeRelativePathArray(currentPathArray, targetPathArray) {
  var commonIndex = 0;
  for (; commonIndex < currentPathArray.length && commonIndex < targetPathArray.length; commonIndex++) {
    if (currentPathArray[commonIndex] !== targetPathArray[commonIndex])
      break;
  }

  var newPathArray = [];
  var i;
  for (i = commonIndex; i < currentPathArray.length; i++)
    newPathArray.push("..");
  for (i = commonIndex; i < targetPathArray.length; i++)
    newPathArray.push(targetPathArray[i]);
  return newPathArray;
}
