// hide_searchpill.js
// Root-served Cyanide RepoTweak. Hides the home-screen search pill with conservative iOS 26-safe view calls.

(function () {
    "use strict";

    var VERSION = "1.0.5";
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

        // v1.0.4 could crash SpringBoard before the next log. Keep this path
        // boring: no removeFromSuperview, no sbh_* glass category calls, no
        // CALayer messaging, and no layout forcing. On iOS 26 those can touch
        // deallocated Liquid Glass internals through RemoteCall/NSInvocation.
        msgMain(view, "setHidden:", 1);
        if (responds(view, "setUserInteractionEnabled:")) msgMain(view, "setUserInteractionEnabled:", 0);
        say("[Hide Search Pill] Hid " + label + ".");
        return true;
    }

    function hideChild(view, sel, label) {
        if (!isPtr(view) || !responds(view, sel)) return false;
        var child = msgMain(view, sel);
        return hide(child, label);
    }

    function hideSearchPillView(pill, labelPrefix) {
        if (!isPtr(pill)) return false;
        var ok = false;

        ok = hideChild(pill, "contentContainerView", labelPrefix + ".contentContainerView") || ok;
        ok = hideChild(pill, "searchLabel", labelPrefix + ".searchLabel") || ok;
        ok = hideChild(pill, "searchGlyphImageView", labelPrefix + ".searchGlyphImageView") || ok;
        ok = hideChild(pill, "searchAffordanceContentView", labelPrefix + ".searchAffordanceContentView") || ok;
        ok = hideChild(pill, "searchAffordanceReferenceView", labelPrefix + ".searchAffordanceReferenceView") || ok;
        ok = hideChild(pill, "backgroundView", labelPrefix + ".backgroundView") || ok;
        ok = hideChild(pill, "searchAffordanceBackgroundView", labelPrefix + ".searchAffordanceBackgroundView") || ok;
        ok = hideChild(pill, "searchAffordanceReferenceBackgroundView", labelPrefix + ".searchAffordanceReferenceBackgroundView") || ok;
        ok = hide(pill, labelPrefix) || ok;
        return ok;
    }

    function refreshRootLayout(rootView) {
        if (!isPtr(rootView)) return;
        if (responds(rootView, "setSearchHidden:")) {
            msgMain(rootView, "setSearchHidden:", 1);
            say("[Hide Search Pill] Set rootFolderView.searchHidden=YES.");
        }
        // Do not call setNeedsLayout/layoutIfNeeded/layoutSearchableViews here.
        // The iOS 26 search accessory rebuild path has been crashy under JS RemoteCall.
    }

    var mgr = iconManager();
    var rootView = rootFolderView(mgr);
    var ok = false;

    if (isPtr(rootView)) {
        refreshRootLayout(rootView);

        say("[Hide Search Pill] Fetching search accessory views...");
        var aux = call(rootView, "scrollAccessoryAuxiliaryView", true);
        ok = hideSearchPillView(aux, "scrollAccessoryAuxiliaryView") || ok;

        var bg = call(rootView, "scrollAccessoryBackgroundView", true);
        ok = hide(bg, "scrollAccessoryBackgroundView") || ok;

        // Legacy/fallback views. These are direct root properties only; no scans.
        ok = hide(call(rootView, "searchPresentableView", true), "searchPresentableView") || ok;
        ok = hide(call(rootView, "pullDownSearchView", true), "pullDownSearchView") || ok;
    }

    say(ok ? "[Hide Search Pill] SUCCESS: search pill hidden." : "[Hide Search Pill] Search pill not found (possibly already hidden).");
})();
