// dump-views.js
// @param: slider | delaySec | Delay (Seconds) | 5 | 0-20
// Root-served Cyanide RepoTweak diagnostic helper. Dumps visible SpringBoard windows to /tmp and tries to present a share sheet.

(function () {
    "use strict";

    var VERSION = "1.0.0";

    function say(msg) {
        try { if (typeof log === "function") { log(String(msg)); return; } } catch (_) {}
        try { if (typeof console !== "undefined" && console.log) console.log(String(msg)); } catch (_) {}
    }

    function isPtr(v) {
        if (v === null || v === undefined) return false;
        if (typeof v === "number") return v !== 0;
        if (typeof v === "string") return v !== "" && v !== "0" && v !== "0x0";
        return true;
    }

    function truthy(v) {
        if (typeof v === "number") return v !== 0;
        if (typeof v === "string") return v !== "" && v !== "0" && v !== "0x0";
        return !!v;
    }

    function cls(name) { try { return r_class(name); } catch (_) { return 0; } }
    function msg(obj, sel, a1, a2, a3, a4) { if (!isPtr(obj)) return 0; try { return r_msg2(obj, sel, a1 || 0, a2 || 0, a3 || 0, a4 || 0); } catch (_) { return 0; } }
    function msgMain(obj, sel, a1, a2, a3, a4) { if (!isPtr(obj)) return 0; try { return r_msg2_main(obj, sel, a1 || 0, a2 || 0, a3 || 0, a4 || 0); } catch (_) { return 0; } }
    function ns(str) { try { return r_nsstr(String(str)); } catch (_) { return 0; } }
    function count(arrayObj) { var c = msgMain(arrayObj, "count"); var n = parseInt(c, 0); return isFinite(n) ? n : 0; }

    var delaySeconds = Number((typeof delaySec !== "undefined") ? delaySec : 5);
    if (!isFinite(delaySeconds)) delaySeconds = 5;
    if (delaySeconds < 0) delaySeconds = 0;
    if (delaySeconds > 20) delaySeconds = 20;
    var delayMs = Math.floor(delaySeconds * 1000);

    say("[Dump-Views] v" + VERSION + ": waiting " + delaySeconds + "s. Navigate to the target view now...");

    setTimeout(function () {
        say("[Dump-Views] Generating visible window dump...");

        var app = msgMain(cls("UIApplication"), "sharedApplication");
        var windows = msgMain(app, "windows");
        var winCount = count(windows);
        var fullDump = msgMain(cls("NSMutableString"), "string");
        var foundCount = 0;
        var rootVC = 0;

        for (var i = winCount - 1; i >= 0; i--) {
            var win = msgMain(windows, "objectAtIndex:", i);
            if (!isPtr(win)) continue;
            if (!rootVC && truthy(msgMain(win, "isHidden")) === false) {
                rootVC = msgMain(win, "rootViewController");
            }
            if (truthy(msgMain(win, "isHidden"))) continue;
            var dumpStr = msgMain(win, "recursiveDescription");
            if (!isPtr(dumpStr)) continue;
            msgMain(fullDump, "appendString:", ns("==========================================\n"));
            msgMain(fullDump, "appendString:", ns("WINDOW " + i + "\n"));
            msgMain(fullDump, "appendString:", ns("==========================================\n"));
            msgMain(fullDump, "appendString:", dumpStr);
            msgMain(fullDump, "appendString:", ns("\n\n"));
            foundCount++;
        }

        if (foundCount <= 0) {
            say("[Dump-Views] ERROR: no visible windows returned recursiveDescription.");
            return;
        }

        var timestamp = Math.floor(Date.now() / 1000);
        var path = "/tmp/UITreeDump_" + timestamp + ".txt";
        var pathStr = ns(path);
        var ok = msgMain(fullDump, "writeToFile:atomically:encoding:error:", pathStr, 1, 4, 0);
        if (!truthy(ok)) {
            say("[Dump-Views] ERROR: could not save " + path);
            return;
        }

        say("[Dump-Views] Wrote " + path + " (" + foundCount + " window(s)).");

        var keyWin = msgMain(app, "keyWindow");
        if (isPtr(keyWin)) {
            var keyRoot = msgMain(keyWin, "rootViewController");
            if (isPtr(keyRoot)) rootVC = keyRoot;
        }
        if (!isPtr(rootVC)) {
            say("[Dump-Views] No root view controller for share sheet; pull the file from /tmp manually.");
            return;
        }

        var fileUrl = msgMain(cls("NSURL"), "fileURLWithPath:", pathStr);
        var itemsArray = msgMain(cls("NSArray"), "arrayWithObject:", fileUrl);
        var activityVC = msgMain(msg(cls("UIActivityViewController"), "alloc"), "initWithActivityItems:applicationActivities:", itemsArray, 0);
        if (!isPtr(activityVC)) {
            say("[Dump-Views] Could not create share sheet; pull the file from /tmp manually.");
            return;
        }
        msgMain(rootVC, "presentViewController:animated:completion:", activityVC, 1, 0);
        say("[Dump-Views] Presented share sheet.");
    }, delayMs);
})();
