$(document).ready(function() {
    var dropZone = document.getElementById('dropZone');

// Optional.   Show the copy icon when dragging over.  Seems to only work for chrome.
    dropZone.addEventListener('dragover', function (e) {
        e.stopPropagation();
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

// Get file data on drop
    dropZone.addEventListener('drop', function (e) {
        e.stopPropagation();
        e.preventDefault();
        var files = e.dataTransfer.files; // Array of all files

        for (var i = 0, file; file = files[i]; i++) {
            if (file.type.match('application/zip')) {
                console.log("received: ", file.name);
                var reader = new FileReader();
                // //
                reader.onload = function (e2) {
                    console.log("read: file data");
                    Textile.loadZip(e2.target.result)
                }
                reader.readAsArrayBuffer(file); // start reading the file data.
            } else {
                console.log("no: ", file.type)
            }
        }
    });

});

var Textile = {
    file: new JSZip(),
    loadZip: function(data) {
        JSZip.loadAsync(data)
            .then(Textile.parseZip)
    },
    parseZip: function(zip) {
        console.log("parsing: zip data");
        var p = 0
        zip.forEach(function (relativePath, zipEntry) {  // 2) print entries
            if (relativePath.match(/^photos\/\S*jpg/)) {
                Textile.file.file(relativePath, zipEntry._data)
            }

            if (relativePath.match(/^messages\/\S*jpg/)) {
                var splitPath = relativePath.split("/");
                var name = splitPath[splitPath.length - 1]
                Textile.file.file("messages/"+name, zipEntry._data)
            }
        });
        // Should be moved to when parsing is totally complete
        Textile.addDownload();
    },
    addDownload: function() {

        $('body').append('<button id="blob" class="btn btn-primary">click to download</button>');

        $("#blob").on("click", function () {
            Textile.file.generateAsync({type:"blob"})
                .then(function(content) {
                    saveAs(content, "example.zip");
                });
        });
    }
}