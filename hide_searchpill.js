// hide_searchpill.js
// Root-served Cyanide RepoTweak. Hides the home-screen search pill using iOS 26+ and legacy-safe direct paths.

(function () {
    "use strict";

    var VERSION = "1.0.4";
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
    function count(arrayObj) { var c = parseInt(msg(arrayObj, "count"), 0); return isFinite(c) ? c : 0; }
    function isKind(obj, className) {
        var c = cls(className);
        return isPtr(c) && truthy(msg(obj, "isKindOfClass:", c));
    }

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

    function clearGlass(view, label) {
        if (!isPtr(view)) return false;
        var ok = false;
        if (responds(view, "sbh_pauseSpecularHighlightAnimationOnSearchPillGlass")) {
            msgMain(view, "sbh_pauseSpecularHighlightAnimationOnSearchPillGlass");
            ok = true;
        }
        if (responds(view, "setHasVisibleGlass:")) {
            msgMain(view, "setHasVisibleGlass:", 0);
            ok = true;
        }
        if (responds(view, "updateGlassVisibility:")) {
            msgMain(view, "updateGlassVisibility:", 0);
            ok = true;
        }
        if (responds(view, "sbh_removeGlass")) {
            msgMain(view, "sbh_removeGlass");
            ok = true;
        }
        var clear = msg(cls("UIColor"), "clearColor");
        if (isPtr(clear) && responds(view, "setBackgroundColor:")) msgMain(view, "setBackgroundColor:", clear);
        var layer = call(view, "layer", true);
        if (isPtr(layer)) {
            if (responds(layer, "removeAllAnimations")) msgMain(layer, "removeAllAnimations");
            if (responds(layer, "setHidden:")) msgMain(layer, "setHidden:", 1);
        }
        if (ok) say("[Hide Search Pill] Cleared glass from " + label + ".");
        return ok;
    }

    function hide(view, label) {
        if (!isPtr(view)) return false;
        clearGlass(view, label);
        msgMain(view, "setHidden:", 1);
        if (responds(view, "setUserInteractionEnabled:")) msgMain(view, "setUserInteractionEnabled:", 0);
        msgMain(view, "setNeedsLayout");
        say("[Hide Search Pill] Hid " + label + ".");
        return true;
    }

    function removeOnly(view, label) {
        if (!isPtr(view)) return false;
        if (responds(view, "removeFromSuperview")) {
            msgMain(view, "removeFromSuperview");
            say("[Hide Search Pill] Removed " + label + ".");
            return true;
        }
        return false;
    }

    function remove(view, label) {
        if (!isPtr(view)) return false;
        hide(view, label);
        // Important: never message this pointer again after removeFromSuperview.
        // The iOS 26 glass/search views can be deallocated immediately, and a
        // later RemoteCall objc_msgSend can PAC-fail SpringBoard.
        return removeOnly(view, label);
    }

    function hideChild(view, sel, label, removeIt) {
        if (!responds(view, sel)) return false;
        var child = msgMain(view, sel);
        return removeIt ? remove(child, label) : hide(child, label);
    }

    function queueUniqueView(list, seen, view, label) {
        if (!isPtr(view)) return false;
        var key = String(view);
        if (seen[key]) return false;
        seen[key] = true;
        list.push({ view: view, label: label });
        return true;
    }

    function hideSearchPillView(pill, labelPrefix) {
        if (!isPtr(pill)) return false;
        var ok = false;

        // SBHSearchPillView owns the text/glyph, while iOS 26 Liquid Glass can
        // live in separate background/reference views. Hide/remove those first.
        ok = clearGlass(pill, labelPrefix) || ok;
        var removeLater = [];
        var removeSeen = {};
        if (responds(pill, "backgroundView")) {
            queueUniqueView(removeLater, removeSeen, msgMain(pill, "backgroundView"), labelPrefix + ".backgroundView");
        }
        if (responds(pill, "searchAffordanceBackgroundView")) {
            queueUniqueView(removeLater, removeSeen, msgMain(pill, "searchAffordanceBackgroundView"), labelPrefix + ".searchAffordanceBackgroundView");
        }
        if (responds(pill, "searchAffordanceReferenceBackgroundView")) {
            queueUniqueView(removeLater, removeSeen, msgMain(pill, "searchAffordanceReferenceBackgroundView"), labelPrefix + ".searchAffordanceReferenceBackgroundView");
        }
        ok = hideChild(pill, "searchAffordanceContentView", labelPrefix + ".searchAffordanceContentView", false) || ok;
        ok = hideChild(pill, "searchAffordanceReferenceView", labelPrefix + ".searchAffordanceReferenceView", false) || ok;
        ok = hideChild(pill, "contentContainerView", labelPrefix + ".contentContainerView", false) || ok;
        ok = hideChild(pill, "searchLabel", labelPrefix + ".searchLabel", false) || ok;
        ok = hideChild(pill, "searchGlyphImageView", labelPrefix + ".searchGlyphImageView", false) || ok;
        for (var i = 0; i < removeLater.length; i++) {
            var item = removeLater[i];
            ok = remove(item.view, item.label) || ok;
        }
        ok = hide(pill, labelPrefix) || ok;
        return ok;
    }

    function scrubKnownSearchGlass(root, labelPrefix) {
        if (!isPtr(root)) return false;
        var queue = [{ v: root, label: labelPrefix, depth: 0 }];
        var seen = {};
        var scanned = 0;
        var ok = false;

        while (queue.length > 0 && scanned < 64) {
            var item = queue.shift();
            var view = item.v;
            var key = String(view);
            if (seen[key]) continue;
            seen[key] = true;
            scanned++;

            if (isKind(view, "SBHSearchPillView")) {
                ok = hideSearchPillView(view, item.label + ".SBHSearchPillView") || ok;
            } else if (isKind(view, "SBHMultiplexingWrapperGlassBackgroundView")) {
                // Do not remove views found during the scan: we still need the
                // pointer for subview walking below. Hide/clear only; direct
                // removal happens on explicitly-owned root views after the scan.
                ok = hide(view, item.label + ".SBHMultiplexingWrapperGlassBackgroundView") || ok;
            } else if (responds(view, "searchAffordanceBackgroundView") ||
                       responds(view, "searchAffordanceContentView") ||
                       responds(view, "searchLabel") ||
                       responds(view, "searchGlyphImageView")) {
                ok = hideSearchPillView(view, item.label + ".searchAffordance") || ok;
            } else if (responds(view, "setHasVisibleGlass:") ||
                       responds(view, "updateGlassVisibility:")) {
                ok = clearGlass(view, item.label) || ok;
            }

            if (item.depth >= 2) continue;
            var subviews = msg(view, "subviews");
            var n = count(subviews);
            if (n <= 0 || n > 40) continue;
            for (var i = 0; i < n; i++) {
                var child = msg(subviews, "objectAtIndex:", i);
                if (isPtr(child)) queue.push({ v: child, label: item.label + ".subview" + i, depth: item.depth + 1 });
            }
        }

        if (ok) say("[Hide Search Pill] Scrubbed iOS 26 glass near " + labelPrefix + " (" + scanned + " view(s)).");
        return ok;
    }

    function refreshRootLayout(rootView) {
        if (!isPtr(rootView)) return;
        if (responds(rootView, "setSearchHidden:")) {
            msgMain(rootView, "setSearchHidden:", 1);
            say("[Hide Search Pill] Set rootFolderView.searchHidden=YES.");
        }
        // Do not force layoutSearchableViews/layoutIfNeeded here on iOS 26:
        // it can recreate the Liquid Glass backing view while we are removing it.
        msgMain(rootView, "setNeedsLayout");
    }

    var mgr = iconManager();
    var rootView = rootFolderView(mgr);
    var ok = false;

    if (isPtr(rootView)) {
        refreshRootLayout(rootView);

        // iOS 26 direct path from SBRootFolderView. Avoid any deep scan here:
        // QuickLoader has a 15s limit and remote isKind/subview walks are slow.
        var aux = call(rootView, "scrollAccessoryAuxiliaryView", true);
        ok = hideSearchPillView(aux, "scrollAccessoryAuxiliaryView") || ok;
        ok = scrubKnownSearchGlass(aux, "scrollAccessoryAuxiliaryView") || ok;

        var bg = call(rootView, "scrollAccessoryBackgroundView", true);
        if (isPtr(bg)) {
            ok = scrubKnownSearchGlass(bg, "scrollAccessoryBackgroundView") || ok;
            // Remove only after all inspection is done; do not reuse bg after this.
            ok = remove(bg, "scrollAccessoryBackgroundView") || ok;
        }

        // v1.0.2 wedged here on iOS 26 when asking rootFolderView for
        // scrollAccessoryView. Walk up from the already-known auxiliary view
        // instead; this reaches the same container without invoking that getter.
        var parent = call(aux, "superview", false);
        if (isPtr(parent)) {
            ok = scrubKnownSearchGlass(parent, "scrollAccessoryAuxiliaryView.superview") || ok;
            if (isKind(parent, "SBFolderScrollAccessoryView") ||
                isKind(parent, "SBHMultiplexingWrapperGlassBackgroundView") ||
                responds(parent, "setHasVisibleGlass:") ||
                responds(parent, "updateGlassVisibility:")) {
                ok = clearGlass(parent, "scrollAccessoryAuxiliaryView.superview") || ok;
            }
            var grand = call(parent, "superview", false);
            if (isPtr(grand) && String(grand) !== String(rootView)) {
                ok = scrubKnownSearchGlass(grand, "scrollAccessoryAuxiliaryView.superview.superview") || ok;
            }
        }

        ok = hide(call(rootView, "searchPresentableView", true), "searchPresentableView") || ok;
        ok = hide(call(rootView, "pullDownSearchView", true), "pullDownSearchView") || ok;
    }

    say(ok ? "[Hide Search Pill] SUCCESS: search pill hidden." : "[Hide Search Pill] Search pill not found (possibly already hidden)." );
})();
