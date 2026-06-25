log("[Hide Search Pill] Running script...");

var accessoryCls = r_class("SBFolderScrollAccessoryView");

var ctrl = r_msg2_main(r_class("SBIconController"), "sharedInstance");
var mgr = r_msg2_main(ctrl, "iconManager");
var rootFC = r_msg2_main(mgr, "rootFolderController");
if (rootFC === "0x0") rootFC = r_msg2_main(mgr, "_rootFolderController");

if (rootFC !== "0x0") {
    var folderView = r_msg2_main(rootFC, "folderView");
    
    if (folderView !== "0x0") {
        var subs = r_msg2_main(folderView, "subviews");
        if (subs !== "0x0") {
            var c = parseInt(r_msg2_main(subs, "count"));
            var found = false;
            
            for (var i = 0; i < c; i++) {
                var sub = r_msg2_main(subs, "objectAtIndex:", i);
                if (r_msg2_main(sub, "class") === accessoryCls) {
                    r_msg2_main(sub, "setHidden:", 1);
                    log("[Hide Search Pill] Search Pill hidden.");
                    found = true;
                    break;
                }
                
                // checking 1 level under
                var subSubs = r_msg2_main(sub, "subviews");
                if (subSubs !== "0x0") {
                    var sc = parseInt(r_msg2_main(subSubs, "count"));
                    for (var j = 0; j < sc; j++) {
                        var ss = r_msg2_main(subSubs, "objectAtIndex:", j);
                        if (r_msg2_main(ss, "class") === accessoryCls) {
                            r_msg2_main(ss, "setHidden:", 1);
                            found = true;
                            break;
                        }
                    }
                }
                if (found) break;
            }
            
            if (!found) {
                log("[Hide Search Pill] Search Pill not found (could be already hidden).");
            }
        }
    } else {
        log("[Hide Search Pill] ERROR: folderView not found.");
    }
} else {
    log("[Hide Search Pill] ERROR: RootFolderController non found.");
}
