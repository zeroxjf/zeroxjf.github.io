// hide_homebar.js
//
// Repo-served JS wrapper for Cyanide's stable Hide Home Bar file-page zero path.
//
// Credits:
// - C4ndyF1sh / ZeroCalories for the MaterialKit home-indicator target
// - jailbreakdotparty / dirtyZero for the original page-zeroing idea
// - zeroxjf for the Cyanide/Lightsaber JS port

(function () {
    "use strict";

    var target = "/System/Library/PrivateFrameworks/MaterialKit.framework/Assets.car";

    function say(msg) {
        var line = "[HideHomeBar] " + String(msg);
        try {
            if (typeof log === "function") {
                log(line);
                return;
            }
        } catch (_) {}
        try {
            if (typeof LOG === "function") {
                LOG(line);
                return;
            }
        } catch (_) {}
        try {
            if (typeof console !== "undefined" && console.log) console.log(line);
        } catch (_) {}
    }

    if (typeof dz_zero_system_file_page !== "function") {
        say("ERROR: Cyanide build does not expose dz_zero_system_file_page yet. Update Cyanide, refresh this source, then install again.");
        return;
    }

    say("Zeroing MaterialKit Assets.car page using Cyanide's stable file-page zero path...");
    var ok = dz_zero_system_file_page(target, 0);
    if (ok) {
        say("SUCCESS: home bar asset page zeroed. Respring to refresh SpringBoard assets.");
    } else {
        say("ERROR: page zero failed.");
    }
})();
