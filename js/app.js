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
                                p[item.attr('href').split(".html")[0]] = {folder: item.html().split(" - ")[0]};
                                return p
                            }, {});
                    }
                });
                return mapper
            })
            .then(function(mapper) {
                var meta = {};
                var targets = []
                zip.forEach(function (relativePath, zipEntry) {  // 2) print entries
                    if (relativePath.match(/^photos\/\S*html/)) {
                        targets.push(zipEntry)
                    }
                })
                var promises = targets.map(function(zipEntry){
                    return zipEntry.async("string").then(function(fileData){
                        var html = $.parseHTML(fileData);
                        html.forEach(function(el) {
                            $(el).find(".block")
                                .toArray()
                                .forEach(function(v, i) {
                                    var link = $(v).find('img').attr('src');
                                    var parts = link.split('.jpg')[0].split('/');
                                    var id = parts[parts.length - 1].split('_')[1];
                                    var taken = $(v).find('div div.meta').html();
                                    meta[id] = {"date": taken}
                                    var tablemeta = $(v).find('div table.meta');
                                    $(tablemeta).find('tr').toArray().forEach(function(m, ii) {
                                        var kk = $(m).find('th').html();
                                        var val = $(m).find('td').html();
                                        meta[id][kk] = val
                                    })
                                }, {});
                        });
                    })
                })
                return Promise.all(promises).then(function(){
                    return {"mapper": mapper, "meta": meta}
                })
            })
            .then(function(info) {
                var mapper = info['mapper'];
                var meta = info['meta'];
                zip.forEach(function (relativePath, zipEntry) {  // 2) print entries
                    var name;
                    if (relativePath.match(/^photos\/\S*\/\S*jpg/)) {
                        var index = relativePath.lastIndexOf("/");
                        var base = mapper[relativePath.substring(0, index)].folder;
                        var photo = relativePath.substring(index);
                        if (base === undefined) {
                            base = relativePath.substring(0, index)
                        }
                        var photoId = photo.replace("/", "").replace(".jpg", "")

                        console.log(meta[photoId])

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
