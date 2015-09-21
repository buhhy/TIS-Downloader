chrome.app.runtime.onLaunched.addListener(function() {
  chrome.app.window.create('window.html', {
    'outerBounds': {
      'width': 400,
      'height': 500
    }
  });

  runDownload();
});

function runDownload() {
  var url = "https://techinfo.toyota.com/t3Portal/resources/jsp/siviewer/nav.jsp?"
      + "dir=rm%2FRM30G0U&openSource=null&href=xhtml%2FRM1000000006BKQ.html&t3Id=RM1000000006BKQ&"
      + "pubNo=RM30G0U&docId=1974527&objectType=rm&locale=en&home=null&docTitle=null&modelyear=2015";
  var $bufferFrame = $("<div></div>");
  var itemRegex = /var TREE_ITEMS = \[(.+?)\];/g

  $.ajax({
    url: url,
    method: "GET"
  }).done(function (results) {
    $bufferFrame.html(results.trim());
    var treeScript = $bufferFrame.children("#tree").find("script").filter(function (_, elem) {
      return !$(elem).attr("src");
    });
    var data = eval(itemRegex.exec(treeScript.text().trim())[1]);
    var root = {
      title: data[0],
      children: data.filter(function (elem) {
        return elem.constructor === Array;
      }).map(function (elem) {
        $.ajax({
          url: elem[1],
          method: "GET"
        }).done(function (results) {

        });
      })
    };
    console.log(root);
  });
}