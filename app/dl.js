var extensionId = "omebceocojbigcbancdjmpekobelcjgg";

var testNavTree = {
  title: "root",
  isRoot: true,
  isLeaf: false,
  children: [
    {
      title: "section 1",
      url: "https://localhost:1234/section1",
      isLeaf: false,
      children: [
        {
          title: "sub section 1",
          url: "https://localhost:1234/subsection1",
          isLeaf: false,
          children: [
            {
              title: "leaf item 1",
              url: "https://localhost:1234/pages/leaf1.html",
              isLeaf: true
            }, {
              title: "leaf item 2",
              url: "https://localhost:1234/pages/leaf2.html",
              isLeaf: true
            }, {
              title: "leaf item 3",
              url: "https://localhost:1234/pages/leaf3.html",
              isLeaf: true
            }
          ]
        }
      ]
    }, {
      title: "section 2",
      url: "https://localhost:1234/section3",
      isLeaf: false,
      children: [
        {
          title: "leaf item 4",
          url: "https://localhost:1234/pages/leaf4.html",
          isLeaf: true
        },
        {
          title: "leaf item 5",
          url: "https://localhost:1234/pages/leaf5.html",
          isLeaf: true
        }
      ]
    }
  ]
};

var testResourceCache = {
  "https://localhost:1234/pages/leaf1.html": {
    type: 1,
    content: "<html><body><span>page 1</span><a href='/pages/leaf2.html'>test link 2</a></body></html>"
  },
  "https://localhost:1234/pages/leaf2.html": {
    type: 1,
    content: "<html><body><span>page 1</span><a href='/pages/leaf3.html'>test link 3</a></body></html>"
  },
  "https://localhost:1234/pages/leaf3.html": {
    type: 1,
    content: "<html><body><span>page 1</span><a href='/pages/leaf4.html'>test link 4</a></body></html>"
  },
  "https://localhost:1234/pages/leaf4.html": {
    type: 1,
    content: "<html><body><span>page 1</span><a href='/pages/leaf5.html'>test link 5</a></body></html>"
  },
  "https://localhost:1234/pages/leaf5.html": {
    type: 1,
    content: "<html><body><span>page 1</span><a href='/pages/leaf1.html'>test link 1</a></body></html>"
  },
}

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