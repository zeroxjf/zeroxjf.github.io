// Hide Home Bar for Cyanide repo packages.
// Credits: C4ndyF1sh/ZeroCalories for the Home Bar target,
// jailbreakdotparty/dirtyZero for the page-zeroing idea,
// and zeroxjf for the Cyanide bridge/wrapper.
(function () {
  log("Hide Home Bar v1.0.0...");

  if (typeof r_hide_home_bar !== "function") {
    log("ERROR: this package needs a Cyanide build with the r_hide_home_bar repo bridge.");
    log("Use Cyanide's built-in Hide Home Bar package until your app build includes that bridge.");
    return;
  }

  log("Zeroing MaterialKit home-indicator asset page...");
  var ok = !!r_hide_home_bar();
  if (ok) {
    log("OK: home bar asset page zeroed. Respring now so SpringBoard reloads assets.");
  } else {
    log("FAIL: Cyanide could not zero the home bar asset page.");
  }
})();
