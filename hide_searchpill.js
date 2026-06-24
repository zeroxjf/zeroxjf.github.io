// hide_searchpill.js
// Root-served Cyanide RepoTweak. Hides the home-screen search pill using iOS 26+ and legacy paths.

(function () {
    "use strict";

    var VERSION = "1.0.0";
    say("[Hide Search Pill] Running v" + VERSION + "...");

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
    function responds(obj, sel) { if (!isPtr(obj)) return false; try { return typeof r_responds === "function" ? truthy(r_responds(obj, sel)) : true; } catch (_) { return false; } }
    function call(obj, sel, main, a1, a2, a3, a4) { if (!isPtr(obj) || !responds(obj, sel)) return 0; return main ? msgMain(obj, sel, a1, a2, a3, a4) : msg(obj, sel, a1, a2, a3, a4); }
    function count(arrayObj) { var c = msgMain(arrayObj, "count"); var n = parseInt(c, 0); return isFinite(n) ? n : 0; }
    function isKind(obj, classPtr) { return isPtr(obj) && isPtr(classPtr) && truthy(msgMain(obj, "isKindOfClass:", classPtr)); }

    function iconManager() {
        var ctrl = msg(cls("SBIconController"), "sharedInstance");
        return msg(ctrl, "iconManager");
    }

    function rootFolderView(mgr) {
        var rootController = call(mgr, "rootFolderController", false);
        var rootView = call(rootController, "rootFolderView", true);
        if (!isPtr(rootView)) rootView = call(rootController, "rootFolderViewIfLoaded", true);
        if (!isPtr(rootView)) rootView = call(rootController, "folderView", true);
        return rootView;
    }

    function hide(view, label) {
        if (!isPtr(view)) return false;
        msgMain(view, "setHidden:", 1);
        msgMain(view, "setNeedsLayout");
        say("[Hide Search Pill] Hid " + label + ".");
        return true;
    }

    function hideAccessoryParts(accessory, labelPrefix) {
        var ok = false;
        if (responds(accessory, "auxiliaryView")) ok = hide(msgMain(accessory, "auxiliaryView"), labelPrefix + ".auxiliaryView") || ok;
        if (responds(accessory, "backgroundView")) ok = hide(msgMain(accessory, "backgroundView"), labelPrefix + ".backgroundView") || ok;
        if (!ok) ok = hide(accessory, labelPrefix);
        return ok;
    }

    function findAccessory(root, accessoryCls) {
        if (!isPtr(root) || !isPtr(accessoryCls)) return 0;
        var queue = [{ view: root, depth: 0 }];
        var budget = 160;
        while (queue.length && budget-- > 0) {
            var item = queue.shift();
            var view = item.view;
            if (isKind(view, accessoryCls)) return view;
            if (item.depth >= 5) continue;
            var subs = call(view, "subviews", true);
            var c = count(subs);
            for (var i = 0; i < c && queue.length < 160; i++) {
                var child = msgMain(subs, "objectAtIndex:", i);
                if (isPtr(child)) queue.push({ view: child, depth: item.depth + 1 });
            }
        }
        return 0;
    }

    var mgr = iconManager();
    var rootView = rootFolderView(mgr);
    var ok = false;

    // iOS 26+ path from SpringBoardHome 26.0.1 class dump: SBRootFolderView
    // exposes scrollAccessoryAuxiliaryView / scrollAccessoryBackgroundView /
    // scrollAccessoryView directly.
    if (isPtr(rootView)) {
        if (responds(rootView, "scrollAccessoryAuxiliaryView")) ok = hide(msgMain(rootView, "scrollAccessoryAuxiliaryView"), "scrollAccessoryAuxiliaryView") || ok;
        if (responds(rootView, "scrollAccessoryBackgroundView")) ok = hide(msgMain(rootView, "scrollAccessoryBackgroundView"), "scrollAccessoryBackgroundView") || ok;
        if (!ok && responds(rootView, "scrollAccessoryView")) ok = hideAccessoryParts(msgMain(rootView, "scrollAccessoryView"), "scrollAccessoryView") || ok;
    }

    // Legacy/deep fallback: find SBFolderScrollAccessoryView under folderView/rootView.
    if (!ok) {
        var accessoryCls = cls("SBFolderScrollAccessoryView");
        var found = findAccessory(rootView, accessoryCls);
        if (isPtr(found)) ok = hideAccessoryParts(found, "SBFolderScrollAccessoryView") || ok;
    }

    say(ok ? "[Hide Search Pill] SUCCESS: search pill hidden." : "[Hide Search Pill] Search pill not found (possibly already hidden)." );
})();
