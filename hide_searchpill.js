// hide_searchpill.js
// Root-served Cyanide RepoTweak. Hides the home-screen search pill using iOS 26+ and legacy-safe direct paths.

(function () {
    "use strict";

    var VERSION = "1.0.2";
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

    function hideChild(view, sel, label, removeIt) {
        if (!responds(view, sel)) return false;
        var child = msgMain(view, sel);
        return removeIt ? remove(child, label) : hide(child, label);
    }

    function hideSearchPillView(pill, labelPrefix) {
        if (!isPtr(pill)) return false;
        var ok = false;

        // SBHSearchPillView owns the text/glyph, while iOS 26 Liquid Glass can
        // live in separate background/reference views. Hide/remove those first.
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

    function refreshRootLayout(rootView) {
        if (!isPtr(rootView)) return;
        if (responds(rootView, "setSearchHidden:")) {
            msgMain(rootView, "setSearchHidden:", 1);
            say("[Hide Search Pill] Set rootFolderView.searchHidden=YES.");
        }
        if (responds(rootView, "layoutSearchableViews")) msgMain(rootView, "layoutSearchableViews");
        msgMain(rootView, "setNeedsLayout");
        if (responds(rootView, "layoutIfNeeded")) msgMain(rootView, "layoutIfNeeded");
    }

    var mgr = iconManager();
    var rootView = rootFolderView(mgr);
    var ok = false;

    if (isPtr(rootView)) {
        refreshRootLayout(rootView);

        // iOS 26 direct path from SBRootFolderView. Avoid any deep scan here:
        // QuickLoader has a 15s limit and remote isKind/subview walks are slow.
        ok = hideSearchPillView(call(rootView, "scrollAccessoryAuxiliaryView", true), "scrollAccessoryAuxiliaryView") || ok;
        ok = remove(call(rootView, "scrollAccessoryBackgroundView", true), "scrollAccessoryBackgroundView") || ok;

        var accessory = call(rootView, "scrollAccessoryView", true);
        if (isPtr(accessory)) {
            ok = remove(call(accessory, "backgroundView", true), "scrollAccessoryView.backgroundView") || ok;
            // Last-resort iOS 26 path: if the glass is the accessory's own layer
            // or gets recreated after layout, hide the container too. This may
            // also hide page dots, but it removes the persistent glass pill.
            ok = hide(accessory, "scrollAccessoryView") || ok;
        }

        ok = hide(call(rootView, "searchPresentableView", true), "searchPresentableView") || ok;
        ok = hide(call(rootView, "pullDownSearchView", true), "pullDownSearchView") || ok;
    }

    say(ok ? "[Hide Search Pill] SUCCESS: search pill hidden." : "[Hide Search Pill] Search pill not found (possibly already hidden)." );
})();
