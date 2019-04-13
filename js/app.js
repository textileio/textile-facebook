$(document).ready(function() {
    var dropZone = document.getElementById('dropZone');

    dropZone.addEventListener('dragenter', function (e) {
        e.stopPropagation();
        e.preventDefault();
        $('#dropZone').addClass("drag");
    });

    dropZone.addEventListener('dragover', function (e) {
        e.stopPropagation();
        e.preventDefault();
        $('#dropZone').addClass("drag");
    });
    dropZone.addEventListener('dragleave', function (e) {
        e.stopPropagation();
        e.preventDefault();
        $('#dropZone').removeClass("drag");
    });

    dropZone.addEventListener('drop', function (e) {
        e.stopPropagation();
        e.preventDefault();
        $('#dropZone').removeClass("drag");
        var files = e.dataTransfer.files; // Array of all files

        for (var i = 0, file; file = files[i]; i++) {
            if (file.type.match('application/zip') || file.type.match('application/x-zip-compressed')) {
                console.log("received: ", file.name);
                var reader = new FileReader();
                // //
                reader.onload = function (e2) {
                    console.log("read: file data");
                    Textile.loadZip(e2.target.result)
                };
                reader.readAsArrayBuffer(file); // start reading the file data.
            } else {
                console.log("no: ", file.type)
            }
        }
    });
    $('.full-caution').hide();
    $('.partial-caution').click(function(){ $('.full-caution').show(); });

});

var Textile = {
    file: new JSZip(),
    loadZip: function(data) {
        JSZip.loadAsync(data)
            .then(Textile.parseZip)
    },
    parseZip: function(zip) {
        console.log("parsing: zip data");
        if (zip.file("html/photos.htm")) {
            Textile.parseHtml(zip);
        }
        else {
            Textile.parseJson(zip);
        }
    },
    parseZipMap: function(dirname, zip, mapper) {
        zip.forEach(function (relativePath, zipEntry) {
            var name;
            var matchPath = ["^" + dirname, "\\S*", "\\S*jpg"];
            var matchRegExp = new RegExp(matchPath.join("\\/"));
            if (relativePath.match(matchRegExp)) {
                var index = relativePath.lastIndexOf("/");
                var base = mapper[relativePath.substring(0, index)];
                var photo = relativePath.substring(index);
                if (base === undefined) {
                    base = relativePath.substring(0, index)
                }
                Textile.file.file("Photos/" + base + photo, zipEntry._data)
            }

            if (relativePath.match(/^messages\/\S*jpg/)) {
                var splitPath = relativePath.split("/");
                name = splitPath[splitPath.length - 1];
                Textile.file.file("Photos/Messages/"+name, zipEntry._data)
            }
        });
        return true
    },
    parseJson: function(zip) {
        console.warn("Cannot find 'html/photos.htm'.");
        console.warn("Assuming JSON export!");

        var photoRoot = "photos_and_videos";
        var albumRoot = "photos_and_videos/album/";
        zip.file(new RegExp(albumRoot + ".*\.json"))
            .forEach(function(jsonFile, i) {
                jsonFile.async("text")
                .then(JSON.parse)
                .then(function(album) {
                    if (album) {
                        var albumPhotos = album["photos"];
                    }
                    var albumMap = {};
                    if (albumPhotos) {
                        return albumPhotos.reduce(function(p, c) {
                            p[c["uri"]] = album["name"];
                            return p;
                        }, albumMap);
                    }
                    return albumMap;
                })
                .then(function(mapper) {
                    Textile.parseZipMap(photoRoot, zip, mapper);
                })
                .then(function() {
                    Textile.addDownload();
                });
            });
    },
    parseHtml: function(zip) {
        zip.file("html/photos.htm")
            .async("text")
            .then(function(txt) {
                var html = $.parseHTML(txt);
                var mapper = {};
                html.forEach(function(el) {
                    if (el.className === "contents") {
                        mapper = $(el)
                            .find(".block div a")
                            .toArray()
                            .reduce(function(p, c) {
                                var item = $(c);
                                p[item.attr('href').split(".html")[0]] = item.html().split(" - ")[0];
                                return p
                            }, {});
                    }
                });
                return mapper
            })
            .then(function(mapper) {
                zip.forEach(function (relativePath, zipEntry) {  // 2) print entries
                    var name;
                    if (relativePath.match(/^photos\/\S*\/\S*jpg/)) {
                        var index = relativePath.lastIndexOf("/");
                        var base = mapper[relativePath.substring(0, index)];
                        var photo = relativePath.substring(index);
                        if (base === undefined) {
                            base = relativePath.substring(0, index)
                        }
                        Textile.file.file("Photos/" + base + photo, zipEntry._data)
                    }

                    if (relativePath.match(/^messages\/\S*jpg/)) {
                        var splitPath = relativePath.split("/");
                        name = splitPath[splitPath.length - 1];
                        Textile.file.file("Photos/Messages/"+name, zipEntry._data)
                    }
                });
                return true
            })
            .then(function() {
                Textile.addDownload();
            })
    },
    addDownload: function() {
        $('#generate').html('<div id="wrapper"><button id="blob" class="btn btn-primary">click to download</button></div>');
        $("#blob").on("click", function () {
            Textile.file.generateAsync({type:"blob"})
                .then(function(content) {
                    saveAs(content, "facebook-photos.zip");
                });
        });
    }
};
