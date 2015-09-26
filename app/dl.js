var extensionId = "omebceocojbigcbancdjmpekobelcjgg";

var HTML_TYPE = 1;
var CSS_TYPE = 2;
var BLOB_TYPE = 3;

$("#folderPicker").click(function (evt) {
  chrome.fileSystem.chooseEntry({
    type: "openDirectory"
  }, function (fileEntry) {
    chrome.fileSystem.getDisplayPath(fileEntry, function (path) {
      console.log(path);
    });
    writeFile(fileEntry, "amrapa.txt", "abcdef")
  });
});

$("#saveButton").click(function (evt) {
  copyTemplateFiles(function (templateFiles) {
    chrome.fileSystem.chooseEntry({
      type: "openDirectory"
    }, function (fileEntry) {
      requestManualData(function (headerTree, resourceCache, hostName) {
        chrome.fileSystem.getDisplayPath(fileEntry, function (path) {
          console.log("Writing template files to `" + path + "`");
        });

        var navJsonFile = generateNavJsonFile(headerTree, resourceCache);

        templateFiles.forEach(function (file) {
          writeFile(fileEntry, file.name, file.content);
        });
        writeFile(fileEntry, navJsonFile.name, navJsonFile.content);
        writeResourceFiles(fileEntry, resourceCache, hostName);
      });
    });
  });
});

function requestManualData(callback) {
  chrome.runtime.sendMessage(extensionId, {}, function (response) {
    var headerTree = response.headerTree;
    var resourceCache = response.resourceCache;
    var hostName = response.hostName;
    console.log("Data retrieval successful!");
    callback(headerTree, resourceCache, hostName);
  });
}

function generateNavJsonFile(navTree, resourceCache) {
  var recurse = function (node) {
    var newNode = {
      title: node.title,
      isLeaf: node.isLeaf,
      isRoot: node.isRoot
    };

    if (node.isLeaf) {
      var resource = resourceCache[node.url];
      if (resource === undefined)
        return null
      newNode.url = makeFullPath(resource.newFilePath);
    } else {
      newNode.children = node.children.map(recurse).filter(function (x) { return x !== null; });
    }

    return newNode;
  };

  return {
    name: "nav.json",
    content: JSON.stringify(recurse(navTree, resourceCache), undefined, 2)
  };
}

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

function writeResourceFiles(dirEntry, resourceCache, hostName) {
  for (var url in resourceCache) {
    if (resourceCache.hasOwnProperty(url)) {
      (function (url) {
        var value = resourceCache[url];
        dirEntry.getDirectory(
          makeFullPath(getFolderPath(value.newFilePath)),
          { create: true },
          function (dirEntry) {
            if (value.type === HTML_TYPE) {
              var html = replaceUrlsInHtml(value, resourceCache, hostName);
              writeFile(dirEntry, getFileName(value.newFilePath), html);
            } else if (value.type === BLOB_TYPE) {
              // Uint8Array is mangled by the extension -> app communication to an index -> value map
              var array = [];
              for (var key in value.content) {
                if (value.content.hasOwnProperty(key))
                  array[key] = value.content[key];
              }
              writeFile(dirEntry, getFileName(value.newFilePath), new Uint8Array(array));
            } else if (value.type === CSS_TYPE) {
              // TODO(tlei): rewrite CSS
              writeFile(dirEntry, getFileName(value.newFilePath), value.content);
            }
          });
      })(url);
    }
  }
}

function replaceUrlsInHtml(currentResource, resourceCache, hostName) {
  var hrefReplaced = replaceInHtml(
        /(href\s?=\s?)(".+?"|'.+?')/,
        currentResource.content,
        currentResource,
        resourceCache,
        hostName);
  var srcReplaced = replaceInHtml(
        /(src\s?=\s?)(".+?"|'.+?')/,
        hrefReplaced,
        currentResource,
        resourceCache,
        hostName);
  return srcReplaced;
}

function replaceInHtml(regex, html, currentResource, resourceCache, hostName) {
  var match;
  var currentHtml = "";
  var remainingHtml = html;

  while (match = regex.exec(remainingHtml)) {
    var start = match.index + match[1].length;
    var end = start + match[2].length;
    var matched = match[2].slice(1, -1); // remove the quotation marks

    var resource = resourceCache[hostName + matched];
    var relativePathArray = makeRelativePathArray(
        getFolderPath(currentResource.newFilePath),
        getFolderPath(resource.newFilePath));
    relativePathArray.push(getFileName(resource.newFilePath));

    currentHtml += remainingHtml.slice(0, start)
    if (resource !== undefined) {
      currentHtml += "'" + makeFullPath(relativePathArray) + "'";
    } else {
      console.error("No resource found for url `" + hostName + matched + "`");
      currentHtml += "'" + matched + "'";
    }
    remainingHtml = remainingHtml.slice(end);
  }

  currentHtml += remainingHtml;
  return currentHtml;
}

function regexAllMatches(text, regex) {
  var match;
  var indices= [];

  while (match = regex.exec(text)) {
    var start = match.index + match[1].length;

    indices.push({
      start: start,
      end: start + match[2].length,
      matched: match[2].slice(1, -1) // remove the quotation marks
    });
  }
  return indices;
}

function writeFile(dirEntry, fileName, content) {
  chrome.fileSystem.getWritableEntry(dirEntry, function(_) {
    dirEntry.getFile(
      fileName,
      { create: true },
      function (entry) {
        entry.createWriter(function (writer) {
          writer.onwrite = function () {
            writer.onwrite = null;
            writer.truncate(writer.position);
            console.log("Writing to `" + fileName + "` successful!");
          };

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
  for (var i = commonIndex; i < currentPathArray.length; i++)
    newPathArray.push("..");
  for (var i = commonIndex; i < targetPathArray.length; i++)
    newPathArray.push(targetPathArray[i]);
  return newPathArray;
}
