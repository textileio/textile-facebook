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
    parseJsonYourPosts: function(mapper) {
        var status_updates = mapper["status_updates"];
        status_updates.forEach(function (status_update) {
            var milliUnix = 1000 * status_update["timestamp"];
            var attachments = status_update["attachments"];
            var isoDate = new Date(milliUnix).toISOString();
            if (attachments) {
                var statusFileCount = attachments.length;
                var msg = " files in a status on ";
                console.log(statusFileCount + msg + isoDate);
            }
            return;
        });
        return true
    },
    parseZipMap: function(dirname, zip, mapper) {
        zip.forEach(function (relativePath, zipEntry) {
            var name;

            var segment1nd = relativePath.split("/")[0];
            var segment2nd = relativePath.split("/")[1];
            var last_segment = relativePath.split("/").pop();
            var last_is_jpg = last_segment.split(".").pop() == "jpg";
            var photos_1st = segment1nd == dirname;

            if ((photos_1st) & (last_is_jpg)) {

                var index = relativePath.lastIndexOf("/");
                var mapKey = Textile.makeMapKey(relativePath);
                var photoRecord = mapper[mapKey] || {
                    fileName: relativePath.substring(index),
                    albumName: mapKey
                };
                var photo = photoRecord["fileName"];
                var base = photoRecord["albumName"];
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

        // TODO: Extract image files from posts
        var TODO_LOG_POSTS = false;
        if (TODO_LOG_POSTS) {
            zip.file("posts/your_posts.json")
                .async("text")
                .then(JSON.parse)
                .then(Textile.parseJsonYourPosts);
        }

        var photoRoot = "photos_and_videos";
        var albumRoot = "photos_and_videos/album/";
        var allJson = new RegExp(albumRoot + ".*\.json")

        var records = zip.file(allJson).map(function(jsonFile, i) {
            return jsonFile.async("text")
            .then(JSON.parse)
            .then(function(album) {
                if (album) {
                    var albumPhotos = album["photos"] || [];
                    console.log(album["name"] + " w/ " + albumPhotos.length);
                }
                return albumPhotos.map(function(photo) {
                    return Textile.makePhotoRecord(album, photo);
                });
            });
        });
        Promise.all(records)
        .then(function(photoRecordLists) {
            // Map every file name to a photo record
            return photoRecordLists.reduce(function(mapper, photoRecords) {
                return photoRecords.reduce(function(records, record) {
                    var uri = record["absolutePath"];
                    records[Textile.makeMapKey(uri)] = record;
                    return records;
                }, mapper);
            }, {});
        })
        .then(function(mapper) {
            Textile.parseZipMap(photoRoot, zip, mapper);
        })
        .then(function() {
            Textile.addDownload();
        });
    },
    makeMapKey: function(uri) {
        return uri;
    },
    makePhotoRecord: function(album, photo) {
        var absolutePath = photo["uri"];

        // var timestamp = album["last_modified_timestamp"];
        var timestamp = photo["creation_timestamp"];
        var milliUnix = 1000 * timestamp;
        var isoDate = new Date(milliUnix).toISOString();
        isoDate = isoDate.split(":")[0];

        // TODO: messy
        var fileName = (function(useDateAsName) {
            var index = absolutePath.lastIndexOf("/");
            var realName = absolutePath.substring(index);
            if (!useDateAsName) {
                return realName
            }
            return "/" + isoDate + realName;
        })(true);

        return {
            date: isoDate,
            fileName: fileName,
            albumName: album["name"],
            absolutePath: absolutePath
        };
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
