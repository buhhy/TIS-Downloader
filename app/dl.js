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
  downloadNavData(parseAllNavData);
});

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