// hide_searchpill.js
// Root-served Cyanide RepoTweak. Hides the home-screen search pill using iOS 26+ and legacy paths.

(function () {
    "use strict";

    var VERSION = "1.0.1";
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
        if (responds(view, "setUserInteractionEnabled:")) msgMain(view, "setUserInteractionEnabled:", 0);
        msgMain(view, "setNeedsLayout");
        say("[Hide Search Pill] Hid " + label + ".");
        return true;
    }

    function remove(view, label) {
        if (!isPtr(view)) return false;
        hide(view, label);
        if (responds(view, "removeFromSuperview")) {
            msgMain(view, "removeFromSuperview");
            say("[Hide Search Pill] Removed " + label + ".");
        }
        return true;
    }

    function hideChild(view, sel, label, aggressive) {
        if (!responds(view, sel)) return false;
        var child = msgMain(view, sel);
        return aggressive ? remove(child, label) : hide(child, label);
    }

    function hideSearchPillView(pill, labelPrefix) {
        if (!isPtr(pill)) return false;
        var ok = false;

        // iOS 26 SBHSearchPillView keeps Liquid Glass/material in separate
        // background views. Hiding only the label/glyph leaves the glass pill
        // visible, so remove the background siblings too.
        ok = hideChild(pill, "backgroundView", labelPrefix + ".backgroundView", true) || ok;
        ok = hideChild(pill, "searchAffordanceBackgroundView", labelPrefix + ".searchAffordanceBackgroundView", true) || ok;
        ok = hideChild(pill, "searchAffordanceReferenceBackgroundView", labelPrefix + ".searchAffordanceReferenceBackgroundView", true) || ok;
        ok = hideChild(pill, "searchAffordanceReferenceView", labelPrefix + ".searchAffordanceReferenceView", false) || ok;
        ok = hideChild(pill, "contentContainerView", labelPrefix + ".contentContainerView", false) || ok;
        ok = hideChild(pill, "searchLabel", labelPrefix + ".searchLabel", false) || ok;
        ok = hideChild(pill, "searchGlyphImageView", labelPrefix + ".searchGlyphImageView", false) || ok;

        ok = hide(pill, labelPrefix) || ok;
        return ok;
    }

    function hideAccessoryParts(accessory, labelPrefix) {
        var ok = false;
        if (responds(accessory, "backgroundView")) ok = remove(msgMain(accessory, "backgroundView"), labelPrefix + ".backgroundView") || ok;
        if (responds(accessory, "auxiliaryView")) {
            var auxiliary = msgMain(accessory, "auxiliaryView");
            ok = hideSearchPillView(auxiliary, labelPrefix + ".auxiliaryView") || ok;
        }
        ok = hideSearchPillView(accessory, labelPrefix) || ok;
        if (!ok) ok = hide(accessory, labelPrefix);
        return ok;
    }

    function findAndHideMatching(root, classes, labelPrefix, aggressiveMaterials) {
        if (!isPtr(root) || !classes || classes.length === 0) return false;
        var queue = [{ view: root, depth: 0 }];
        var budget = 160;
        var ok = false;
        while (queue.length && budget-- > 0) {
            var item = queue.shift();
            var view = item.view;
            for (var cidx = 0; cidx < classes.length; cidx++) {
                var clsPtr = classes[cidx].cls;
                if (isPtr(clsPtr) && isKind(view, clsPtr)) {
                    if (classes[cidx].accessory) ok = hideAccessoryParts(view, labelPrefix + "." + classes[cidx].name) || ok;
                    else if (classes[cidx].pill) ok = hideSearchPillView(view, labelPrefix + "." + classes[cidx].name) || ok;
                    else if (aggressiveMaterials) ok = remove(view, labelPrefix + "." + classes[cidx].name) || ok;
                    else ok = hide(view, labelPrefix + "." + classes[cidx].name) || ok;
                }
            }
            if (item.depth >= 6) continue;
            var subs = call(view, "subviews", true);
            var c = count(subs);
            for (var i = 0; i < c && queue.length < 160; i++) {
                var child = msgMain(subs, "objectAtIndex:", i);
                if (isPtr(child)) queue.push({ view: child, depth: item.depth + 1 });
            }
        }
        return ok;
    }

    var mgr = iconManager();
    var rootView = rootFolderView(mgr);
    var ok = false;

    // iOS 26+ path from SpringBoardHome 26.0.1 class dump: SBRootFolderView
    // exposes scrollAccessoryAuxiliaryView / scrollAccessoryBackgroundView /
    // scrollAccessoryView directly.
    if (isPtr(rootView)) {
        if (responds(rootView, "scrollAccessoryAuxiliaryView")) ok = hideSearchPillView(msgMain(rootView, "scrollAccessoryAuxiliaryView"), "scrollAccessoryAuxiliaryView") || ok;
        if (responds(rootView, "scrollAccessoryBackgroundView")) ok = remove(msgMain(rootView, "scrollAccessoryBackgroundView"), "scrollAccessoryBackgroundView") || ok;

        // Always continue into scrollAccessoryView. The auxiliary direct path
        // can hide only the Search text on iOS 26 while leaving the Liquid
        // Glass overlay in SBHSearchPillView/backgroundView.
        if (responds(rootView, "scrollAccessoryView")) {
            var scrollAccessory = msgMain(rootView, "scrollAccessoryView");
            ok = hideAccessoryParts(scrollAccessory, "scrollAccessoryView") || ok;
            ok = findAndHideMatching(scrollAccessory, [
                { name: "SBHSearchPillView", cls: cls("SBHSearchPillView"), pill: true },
                { name: "SBHomeScreenMaterialView", cls: cls("SBHomeScreenMaterialView") },
                { name: "SBHMultiplexingWrapperGlassBackgroundView", cls: cls("SBHMultiplexingWrapperGlassBackgroundView") },
                { name: "MTMaterialView", cls: cls("MTMaterialView") }
            ], "scrollAccessoryView", true) || ok;
        }
    }

    // Legacy/deep fallback: find SBFolderScrollAccessoryView under folderView/rootView.
    ok = findAndHideMatching(rootView, [
        { name: "SBHSearchPillView", cls: cls("SBHSearchPillView"), pill: true },
        { name: "SBFolderScrollAccessoryView", cls: cls("SBFolderScrollAccessoryView"), accessory: true }
    ], "rootScan", false) || ok;

    say(ok ? "[Hide Search Pill] SUCCESS: search pill hidden." : "[Hide Search Pill] Search pill not found (possibly already hidden)." );
})();
