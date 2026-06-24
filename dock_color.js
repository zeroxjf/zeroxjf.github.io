// dock_color.js
// @param: color | dockColor | Dock Color | #FF0000
// Root-served Cyanide RepoTweak. Uses guarded iOS 26+ and pre-iOS 26 dock paths.

(function () {
    "use strict";

    var VERSION = "1.0.0";
    say("[DockColor] Starting v" + VERSION + "...");

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

    function cls(name) {
        try { return r_class(name); } catch (_) { return 0; }
    }

    function msg(obj, sel, a1, a2, a3, a4) {
        if (!isPtr(obj)) return 0;
        try { return r_msg2(obj, sel, a1 || 0, a2 || 0, a3 || 0, a4 || 0); } catch (_) { return 0; }
    }

    function msgMain(obj, sel, a1, a2, a3, a4) {
        if (!isPtr(obj)) return 0;
        try { return r_msg2_main(obj, sel, a1 || 0, a2 || 0, a3 || 0, a4 || 0); } catch (_) { return 0; }
    }

    function responds(obj, sel) {
        if (!isPtr(obj)) return false;
        try { return typeof r_responds === "function" ? truthy(r_responds(obj, sel)) : true; } catch (_) { return false; }
    }

    function call(obj, sel, main, a1, a2, a3, a4) {
        if (!isPtr(obj) || !responds(obj, sel)) return 0;
        return main ? msgMain(obj, sel, a1, a2, a3, a4) : msg(obj, sel, a1, a2, a3, a4);
    }

    function ns(str) {
        try { return r_nsstr(String(str)); } catch (_) { return 0; }
    }

    function release(obj) {
        if (isPtr(obj)) msg(obj, "release");
    }

    function validHexColor(input) {
        var s = String(input || "").trim();
        if (!s) s = "#FF0000";
        if (s.charAt(0) === "#") s = s.slice(1);
        if (/^[0-9a-fA-F]{3}$/.test(s)) {
            s = s.charAt(0) + s.charAt(0) + s.charAt(1) + s.charAt(1) + s.charAt(2) + s.charAt(2);
        }
        if (!/^[0-9a-fA-F]{6}$/.test(s)) {
            say("[DockColor] Invalid color; using #FF0000.");
            s = "FF0000";
        }
        return s.toUpperCase();
    }

    function colorFromHex(input) {
        var hex = validHexColor(input);
        var r = parseInt(hex.substring(0, 2), 16) / 255.0;
        var g = parseInt(hex.substring(2, 4), 16) / 255.0;
        var b = parseInt(hex.substring(4, 6), 16) / 255.0;
        var colorString = r + " " + g + " " + b + " 1.0";
        var colorStr = ns(colorString);
        var ciColor = msg(cls("CIColor"), "colorWithString:", colorStr);
        var uiColor = msg(cls("UIColor"), "colorWithCIColor:", ciColor);
        release(colorStr);
        return uiColor;
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

    function addTarget(targets, view, label) {
        if (!isPtr(view)) return;
        var key = String(view);
        for (var i = 0; i < targets.length; i++) if (String(targets[i].view) === key) return;
        targets.push({ view: view, label: label });
    }

    function dockTargets() {
        var targets = [];
        var mgr = iconManager();
        var rootView = rootFolderView(mgr);

        // iOS 26+ SpringBoardHome path: SBRootFolderView -> SBDockView -> backgroundView.
        var dockView = call(rootView, "dockView", true);
        if (isPtr(dockView) && responds(dockView, "backgroundView")) {
            addTarget(targets, msgMain(dockView, "backgroundView"), "SBDockView.backgroundView");
        }

        // iPad/floating dock path on newer builds.
        var floatingController = call(mgr, "floatingDockViewController", false);
        var floatingDock = call(floatingController, "dockView", true);
        var platter = call(floatingDock, "mainPlatterView", true);
        addTarget(targets, platter, "SBFloatingDockView.mainPlatterView");
        if (responds(platter, "backgroundView")) addTarget(targets, msgMain(platter, "backgroundView"), "floating platter backgroundView");

        // Pre-iOS 26 fallback: icon manager/controller dock list superview.
        var ctrl = msg(cls("SBIconController"), "sharedInstance");
        var dockList = call(mgr, "dockListView", false);
        if (!isPtr(dockList)) dockList = call(ctrl, "dockListView", false);
        var legacyDock = msgMain(dockList, "superview");
        if (!isPtr(legacyDock)) legacyDock = dockList;
        if (isPtr(legacyDock) && responds(legacyDock, "backgroundView")) {
            addTarget(targets, msgMain(legacyDock, "backgroundView"), "legacy dock.backgroundView");
        }

        return targets;
    }

    function colorView(view, label, color) {
        if (!isPtr(view) || !isPtr(color)) return false;
        msgMain(view, "setHidden:", 0);
        msgMain(view, "setBackgroundColor:", color);
        msgMain(view, "setNeedsLayout");
        say("[DockColor] Colored " + label + ".");
        return true;
    }

    var color = colorFromHex((typeof dockColor !== "undefined" && dockColor !== "") ? dockColor : "#FF0000");
    if (!isPtr(color)) {
        say("[DockColor] ERROR: Could not create UIColor.");
        return;
    }

    var targets = dockTargets();
    var applied = 0;
    for (var i = 0; i < targets.length; i++) {
        if (colorView(targets[i].view, targets[i].label, color)) applied++;
    }

    say(applied > 0 ? "[DockColor] SUCCESS: colored " + applied + " dock view(s)." : "[DockColor] ERROR: no dock background/platter found.");
})();
