var extensionId = "omebceocojbigcbancdjmpekobelcjgg";

var hostName = "https://localhost:1234";

var testNavTree = {
  title: "root",
  isRoot: true,
  isLeaf: false,
  children: [
    {
      title: "section 1",
      url: hostName + "/section1",
      isLeaf: false,
      children: [
        {
          title: "sub section 1",
          url: hostName + "/subsection1",
          isLeaf: false,
          children: [
            {
              title: "leaf item 1",
              url: hostName + "/pages/leaf1.html",
              isLeaf: true
            }, {
              title: "leaf item 2",
              url: hostName + "/pages/leaf2.html",
              isLeaf: true
            }, {
              title: "leaf item 3",
              url: hostName + "/pages/leaf3.html",
              isLeaf: true
            }
          ]
        }
      ]
    }, {
      title: "section 2",
      url: hostName + "/section3",
      isLeaf: false,
      children: [
        {
          title: "leaf item 4",
          url: hostName + "/pages/leaf4.html",
          isLeaf: true
        },
        {
          title: "leaf item 5",
          url: hostName + "/pages/leaf5.html",
          isLeaf: true
        }
      ]
    }
  ]
};

var testResourceCache = {
  hostName + "/pages/leaf1.html": {
    type: 1,
    content: "<html><body><span>page 1</span><a href='/pages/leaf2.html'>test link 2</a></body></html>"
  },
  hostName + "/pages/leaf2.html": {
    type: 1,
    content: "<html><head><link href='/css/abc/css_file1' /></head><body><span>page 1</span><img src='/imgs/def/randomImage1.png' /><a href='/pages/leaf3.html'>test link 3</a><a href='/pages/leaf4.html'>test link 4</a></body></html>"
  },
  hostName + "/pages/leaf3.html": {
    type: 1,
    content: "<html><body><span>page 1</span><a href='/pages/leaf4.html'>test link 4</a></body></html>"
  },
  hostName + "/pages/leaf4.html": {
    type: 1,
    content: "<html><body><span>page 1</span><a href='/pages/leaf5.html'>test link 5</a></body></html>"
  },
  hostName + "/pages/leaf5.html": {
    type: 1,
    content: "<html><link href='/css/abc/css_file2' /><body><span>page 1</span><a href='/pages/leaf1.html'>test link 1</a></body></html>"
  },
};

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
      chrome.fileSystem.getDisplayPath(fileEntry, function (path) {
        console.log("Writing template files to `" + path + "`");
      });

      var navJsonFile = generateNavJsonFile(testNavTree);

      templateFiles.forEach(function (file) {
        writeFile(fileEntry, file.name, file.content);
      });
      writeFile(fileEntry, navJsonFile.name, navJsonFile.content);
    });
  });
});

function requestManualData(callback) {
  chrome.runtime.sendMessage(extensionId, {}, function (response) {
    var headerTree = response.headerTree;
    var resourceCache = response.resourceCache;
    var hostName = response.hostName;
    console.log("Data retrieval successful!");
  });
}

function generateNavJsonFile(navTree) {
  return {
    name: "nav.json",
    content: JSON.stringify(navTree, undefined, 2)
  };
}

function copyTemplateFiles(callback) {
  var copyFiles = [ "index.html", "index.css", "index.js" ];
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

function replaceUrlsInHtml(html, resourceCache) {
  var hrefMatches = regexAllMatches(html, /href\s?=\s?(".+?"|'.+?')/g);
  var srcMatches = regexAllMatches(html, /src\s?=\s?(".+?"|'.+?')/g);
}

function regexAllMatches(text, regex) {
  var match;
  var indices= [];

  while (match = regex.exec(text)) {
    // remove the quotation marks
    var url = match[1].slice(1, -1);

    indices.push({
      start: match.index + 1,
      end: match.index + url.length,
      matched: url
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