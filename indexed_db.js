

if ('indexedDB' in window) {
    console.log("ok");
} else {
    console.log("no");
}

var openRequest = indexedDB.open("test2", 101);
var db;
openRequest.onupgradeneeded = function(e) {
    console.log("Upgrading...");

    db = e.target.result;

    if(!db.objectStoreNames.contains("firstOS")) {
        db.createObjectStore("firstOS");
    }

    if(!db.objectStoreNames.contains("test")) {
        db.createObjectStore("test", {keyPath: "email"});
    }

    if(!db.objectStoreNames.contains("test2")) {
        db.createObjectStore("test2", {autoIncrement: true});
    }
};

openRequest.onsuccess = function(e) {
    console.log("open success!");
    db = e.target.result;


    var t = db.transaction(["firstOS"], "readwrite");

    t.oncomplete = function(event) {
        console.log("t compete " + event);
    };

    var store = t.objectStore("firstOS");
    var o = {p: 123};
    var request = store.put(o, 112);
    request.onerror = function(e) {
        console.log("request error: ",e.target.error.name);
    }

    request.onsuccess = function(e) {
        console.log("request succeed!");
    }
    request = store.put(o, 112);
    request = store.put(o, 112);
    request = store.put(o, 112);
    request = store.put(o, 112);
};

openRequest.onerror = function(e) {
    console.log("Error");
    console.dir(e);
};