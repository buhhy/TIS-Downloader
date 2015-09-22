var rootUrl = "https://techinfo.toyota.com/t3Portal/resources/jsp/siviewer/";
var startingPoint = "nav.jsp?"
    + "dir=rm%2FRM30G0U&openSource=null&href=xhtml%2FRM1000000006BKQ.html&t3Id=RM1000000006BKQ&"
    + "pubNo=RM30G0U&docId=1974527&objectType=rm&locale=en&home=null&docTitle=null&modelyear=2015";
var $bufferFrame = $("<div></div>");
var itemRegex = /var TREE_ITEMS = \[(.+?)\];/

function downloadNavData(callback) {
  fetchNavData(startingPoint, function (data) {
    // Top-level section (General, Brake, Drivetrain, etc) DOM tree isn't loaded until they are
    // clicked, and even then only 1 can be open at a time. Hence we need to loop through each top
    // level section to get the sub-sections. Once a sub-section is loaded, the entire sub-section
    // tree is populated at once.
    var allNavUrls = data.filter(function (elem) {
      return isArray(elem);
    }).map(function (elem) {
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
    url: rootUrl + url,
    method: "GET"
  }).done(function (results) {
    $bufferFrame.html(results.trim());
    var treeScript = $bufferFrame.find("#tree").children("script").filter(function (_, elem) {
      return !$(elem).attr("src");
    });
    var script = treeScript.text().trim();
    var regexResult = itemRegex.exec(script);
    var data = eval(regexResult[1]);
    callback(data);
  });
}

function parseAllNavData(results) {
  var navs = results.map(function (result) {
    return result.find(function (elem) {
      return isArray(elem) && elem.length > 3;
    });
  });

  console.log(navs);
}

function isArray(obj) {
  return obj.constructor === Array;
}

chrome.browserAction.onClicked.addListener(function (tab) {
  downloadNavData(parseAllNavData);
});
