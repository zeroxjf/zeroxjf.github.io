(() => {
  class Native {
    static #baseAddr;
    static #dlsymAddr;
    static #memcpyAddr;
    static #mallocAddr;
    static #argMem = 0n;
    static #argPtr = 0n;
    static #dlsymCache = {};

    static init() {
      const buff = new BigUint64Array(nativeCallBuff);
      this.#baseAddr = buff[20];
      this.#dlsymAddr = buff[21];
      this.#memcpyAddr = buff[22];
      this.#mallocAddr = buff[23];
      this.#argMem = this.#nativeCallAddr(this.#mallocAddr, 0x1000n);
      this.#argPtr = this.#argMem;
    }

    static write(ptr, buff) {
      if (!ptr) return false;
      const buff8 = new Uint8Array(nativeCallBuff);
      let offs = 0;
      let left = buff.byteLength;
      while (left) {
        let len = left;
        if (len > 0x1000) len = 0x1000;
        buff8.set(new Uint8Array(buff, offs, len), 0x1000);
        this.#nativeCallAddr(this.#memcpyAddr, ptr + BigInt(offs), this.#baseAddr + 0x1000n, BigInt(len));
        left -= len;
        offs += len;
      }
      return true;
    }

    static writeString(ptr, str) {
      this.write(ptr, this.stringToBytes(str, true));
    }

    static stringToBytes(str, nullTerminated = false) {
      const buff = new ArrayBuffer(str.length + (nullTerminated ? 1 : 0));
      const s8 = new Uint8Array(buff);
      for (let i = 0; i < str.length; i++) s8[i] = str.charCodeAt(i);
      if (nullTerminated) s8[str.length] = 0;
      return s8.buffer;
    }

    static #toNative(value) {
      if (!value) return 0n;
      if (typeof value === "string") {
        const ptr = this.#argPtr;
        this.writeString(ptr, value);
        this.#argPtr += BigInt(value.length + 1);
        return ptr;
      }
      if (typeof value === "bigint") return value;
      return BigInt(value);
    }

    static #dlsym(name) {
      if (!name) return 0n;
      let addr = this.#dlsymCache[name];
      if (addr) return addr;
      const RTLD_DEFAULT = 0xfffffffffffffffen;
      const nameBytes = this.stringToBytes(name, true);
      const buff8 = new Uint8Array(nativeCallBuff);
      buff8.set(new Uint8Array(nameBytes), 0x1000);
      addr = this.#nativeCallAddr(this.#dlsymAddr, RTLD_DEFAULT, this.#baseAddr + 0x1000n);
      if (addr) this.#dlsymCache[name] = addr;
      return addr;
    }

    static #nativeCallAddr(addr, x0 = 0n, x1 = 0n, x2 = 0n, x3 = 0n, x4 = 0n, x5 = 0n, x6 = 0n, x7 = 0n) {
      const buff = new BigInt64Array(nativeCallBuff);
      buff[0] = addr;
      buff[100] = x0;
      buff[101] = x1;
      buff[102] = x2;
      buff[103] = x3;
      buff[104] = x4;
      buff[105] = x5;
      buff[106] = x6;
      buff[107] = x7;
      invoker();
      return buff[200];
    }

    static callSymbol(name, x0, x1, x2, x3, x4, x5, x6, x7) {
      this.#argPtr = this.#argMem;
      x0 = this.#toNative(x0);
      x1 = this.#toNative(x1);
      x2 = this.#toNative(x2);
      x3 = this.#toNative(x3);
      x4 = this.#toNative(x4);
      x5 = this.#toNative(x5);
      x6 = this.#toNative(x6);
      x7 = this.#toNative(x7);
      const funcAddr = this.#dlsym(name);
      const ret64 = this.#nativeCallAddr(funcAddr, x0, x1, x2, x3, x4, x5, x6, x7);
      this.#argPtr = this.#argMem;
      if (ret64 < 0xffffffffn && ret64 > -0xffffffffn) return Number(ret64);
      return ret64;
    }

    static bridgeInfo() {
      const buff = new BigUint64Array(nativeCallBuff);
      return { jsContextObj: buff[33] };
    }
  }

  function u64(v) { return v ? BigInt.asUintN(64, BigInt(v)) : 0n; }
  function isNonZero(v) { return u64(v) !== 0n; }

  function log(msg) {
    try {
      const tagged = "[ATRIA] " + msg;
      const ptr = Native.callSymbol("malloc", BigInt(tagged.length + 1));
      if (!ptr) return;
      Native.writeString(ptr, tagged);
      Native.callSymbol("syslog", 5, ptr);
      Native.callSymbol("free", ptr);
    } catch (_) {}
  }

  function sel(name) { return Native.callSymbol("sel_registerName", name); }
  function objc(obj, selectorName, ...args) { return Native.callSymbol("objc_msgSend", obj, sel(selectorName), ...args); }
  function cfstr(str) { return Native.callSymbol("CFStringCreateWithCString", 0n, str, 0x08000100); }

  function canRespond(obj, selectorName) {
    if (!isNonZero(obj)) return false;
    return isNonZero(objc(obj, "respondsToSelector:", sel(selectorName)));
  }

  function tryObjSelector(obj, selectorNames) {
    for (const s of selectorNames) {
      if (!canRespond(obj, s)) continue;
      const out = objc(obj, s);
      if (isNonZero(out)) return out;
    }
    return 0n;
  }

  function tryObjLogged(obj, tag, selectorNames) {
    if (!isNonZero(obj)) { log("  " + tag + ": nil receiver"); return 0n; }
    for (const s of selectorNames) {
      log("  " + tag + ".canRespond(" + s + ")...");
      const can = canRespond(obj, s);
      log("  " + tag + ".canRespond(" + s + ")=" + (can ? 1 : 0));
      if (!can) continue;
      log("  " + tag + "." + s + " call...");
      const out = objc(obj, s);
      log("  " + tag + "." + s + "=0x" + u64(out).toString(16));
      if (isNonZero(out)) return out;
    }
    return 0n;
  }

  function clampInt(v, lo, hi, def) {
    const n = Number(v);
    if (!Number.isFinite(n)) return def;
    return Math.max(lo, Math.min(hi, Math.floor(n)));
  }

  function stampGrid(cfg, cols, rows, tag) {
    if (!isNonZero(cfg)) { log("  stampGrid(" + tag + "): nil cfg"); return false; }
    log("  stampGrid(" + tag + ") cfg=0x" + u64(cfg).toString(16) + " -> " + cols + "x" + rows);
    log("  stampGrid(" + tag + ") canRespond(setNumberOfPortraitColumns:)...");
    const hasSetter = canRespond(cfg, "setNumberOfPortraitColumns:");
    log("  stampGrid(" + tag + ") canRespond(setNumberOfPortraitColumns:)=" + (hasSetter ? 1 : 0));
    if (!hasSetter) return false;
    if (canRespond(cfg, "numberOfPortraitColumns")) {
      const before = u64(objc(cfg, "numberOfPortraitColumns"));
      log("  stampGrid(" + tag + ") portraitColumns before=" + before.toString());
    }
    if (canRespond(cfg, "numberOfPortraitRows")) {
      const before = u64(objc(cfg, "numberOfPortraitRows"));
      log("  stampGrid(" + tag + ") portraitRows before=" + before.toString());
    }
    log("  stampGrid(" + tag + ") setNumberOfPortraitColumns:" + cols);
    objc(cfg, "setNumberOfPortraitColumns:", BigInt(cols));
    log("  stampGrid(" + tag + ") setNumberOfPortraitColumns returned");
    log("  stampGrid(" + tag + ") setNumberOfPortraitRows:" + rows);
    objc(cfg, "setNumberOfPortraitRows:", BigInt(rows));
    log("  stampGrid(" + tag + ") setNumberOfPortraitRows returned");
    if (canRespond(cfg, "setNumberOfLandscapeColumns:")) {
      log("  stampGrid(" + tag + ") setNumberOfLandscapeColumns:" + rows);
      objc(cfg, "setNumberOfLandscapeColumns:", BigInt(rows));
      log("  stampGrid(" + tag + ") setNumberOfLandscapeRows:" + cols);
      objc(cfg, "setNumberOfLandscapeRows:", BigInt(cols));
      log("  stampGrid(" + tag + ") landscape setters returned");
    } else {
      log("  stampGrid(" + tag + ") no landscape setter");
    }
    if (canRespond(cfg, "numberOfPortraitColumns")) {
      const after = u64(objc(cfg, "numberOfPortraitColumns"));
      log("  stampGrid(" + tag + ") portraitColumns after=" + after.toString());
    }
    return true;
  }

  function patchProviderLocation(provider, locationStr, cols, rows) {
    log("patchProviderLocation(" + locationStr + ") begin");
    if (!isNonZero(provider)) { log("  nil provider"); return false; }
    log("  provider.canRespond(layoutForIconLocation:)...");
    if (!canRespond(provider, "layoutForIconLocation:")) { log("  no layoutForIconLocation:"); return false; }
    log("  cfstr('" + locationStr + "')...");
    const loc = cfstr(locationStr);
    log("  cfstr result=0x" + u64(loc).toString(16));
    if (!isNonZero(loc)) return false;
    log("  provider.layoutForIconLocation: call...");
    const layout = objc(provider, "layoutForIconLocation:", loc);
    log("  layout=0x" + u64(layout).toString(16));
    if (!isNonZero(layout)) { log("  " + locationStr + ": no layout"); return false; }
    const cfg = tryObjLogged(layout, "layout", ["layoutConfiguration"]);
    if (!isNonZero(cfg)) { log("  " + locationStr + ": no cfg"); return false; }
    const ok = stampGrid(cfg, cols, rows, locationStr);
    log("patchProviderLocation(" + locationStr + ") " + cols + "x" + rows + (ok ? " ok" : " fail"));
    return ok;
  }

  function patchListViewGrid(listView, cols, rows, tag) {
    log("patchListViewGrid(" + tag + ") listView=0x" + u64(listView).toString(16));
    if (!isNonZero(listView)) return false;
    const layout = tryObjLogged(listView, tag + ".listView", ["layout"]);
    if (!isNonZero(layout)) return false;
    const cfg = tryObjLogged(layout, tag + ".layout", ["layoutConfiguration"]);
    if (!isNonZero(cfg)) return false;
    return stampGrid(cfg, cols, rows, tag);
  }

  function findProvider(iconCtrl) {
    log("findProvider begin");
    const names = ["iconListLayoutProvider", "_iconListLayoutProvider", "layoutProvider"];
    let p = tryObjLogged(iconCtrl, "iconCtrl", names);
    if (isNonZero(p)) return p;
    log("findProvider: trying via iconManager...");
    const iconMgr = tryObjLogged(iconCtrl, "iconCtrl", ["iconManager"]);
    if (isNonZero(iconMgr)) {
      p = tryObjLogged(iconMgr, "iconMgr", names);
      if (isNonZero(p)) return p;
    }
    log("findProvider: trying via rootFolderController...");
    const rootFolder = tryObjLogged(iconCtrl, "iconCtrl", ["rootFolderController", "_rootFolderController"]);
    if (isNonZero(rootFolder)) {
      p = tryObjLogged(rootFolder, "rootFolder", names);
      if (isNonZero(p)) return p;
    }
    log("findProvider: none found");
    return 0n;
  }

  function findDockListView(iconCtrl) {
    log("findDockListView begin");
    const direct = tryObjLogged(iconCtrl, "iconCtrl", ["dockListView"]);
    if (isNonZero(direct)) return direct;
    const iconMgr = tryObjLogged(iconCtrl, "iconCtrl", ["iconManager"]);
    if (isNonZero(iconMgr)) {
      const d = tryObjLogged(iconMgr, "iconMgr", ["dockListView"]);
      if (isNonZero(d)) return d;
    }
    log("findDockListView: none found");
    return 0n;
  }

  function forEachRootListView(iconCtrl, fn) {
    log("forEachRootListView begin");
    const rootFolder = tryObjLogged(iconCtrl, "iconCtrl", ["rootFolderController", "_rootFolderController"]);
    const container = isNonZero(rootFolder) ? rootFolder : iconCtrl;
    log("  container=0x" + u64(container).toString(16) + (isNonZero(rootFolder) ? " (rootFolder)" : " (iconCtrl fallback)"));
    const arr = tryObjLogged(container, "container", ["rootIconLists", "iconListViews", "visibleIconLists"]);
    if (!isNonZero(arr)) { log("  no list view array"); return 0; }
    log("  arr.canRespond(count)...");
    if (!canRespond(arr, "count")) { log("  arr no count"); return 0; }
    log("  arr.count call...");
    const countRaw = objc(arr, "count");
    const count = Number(u64(countRaw));
    log("  arr.count=" + count);
    let n = 0;
    for (let i = 0; i < count; i++) {
      log("  arr.objectAtIndex:" + i + " call...");
      const v = objc(arr, "objectAtIndex:", BigInt(i));
      log("  arr[" + i + "]=0x" + u64(v).toString(16));
      if (isNonZero(v)) { fn(v, i); n++; }
    }
    log("forEachRootListView touched=" + n);
    return n;
  }

  function relayout(iconCtrl) {
    log("relayout begin");
    const selectors = ["_relayoutIconLists", "relayoutIconLists", "_relayoutAllIconLists"];
    for (const s of selectors) {
      log("  iconCtrl.canRespond(" + s + ")...");
      const can = canRespond(iconCtrl, s);
      log("  iconCtrl.canRespond(" + s + ")=" + (can ? 1 : 0));
      if (!can) continue;
      log("  iconCtrl." + s + " call...");
      objc(iconCtrl, s);
      log("  iconCtrl." + s + " returned");
      return true;
    }
    log("relayout: no selector matched");
    return false;
  }

  function applyAtria() {
    try {
      log("=== applyAtria main-thread entry ===");
      const hsCols = clampInt(globalThis.__atria_hs_cols, 3, 8, 5);
      const hsRows = clampInt(globalThis.__atria_hs_rows, 4, 10, 7);
      const dockCols = clampInt(globalThis.__atria_dock_cols, 2, 8, 5);
      const dockRows = clampInt(globalThis.__atria_dock_rows, 1, 3, 1);
      log("cfg hs=" + hsCols + "x" + hsRows + " dock=" + dockCols + "x" + dockRows);

      log("lookup SBIconController class...");
      const SBIconController = Native.callSymbol("objc_getClass", "SBIconController");
      log("SBIconController=0x" + u64(SBIconController).toString(16));
      if (!isNonZero(SBIconController)) { log("ABORT: SBIconController missing"); return false; }

      log("call +[SBIconController sharedInstance]...");
      const iconCtrl = objc(SBIconController, "sharedInstance");
      log("iconCtrl=0x" + u64(iconCtrl).toString(16));
      if (!isNonZero(iconCtrl)) { log("ABORT: iconCtrl nil"); return false; }

      const provider = findProvider(iconCtrl);
      log("final provider=0x" + u64(provider).toString(16));
      if (isNonZero(provider)) {
        log("-- patching provider layouts --");
        patchProviderLocation(provider, "SBIconLocationRoot", hsCols, hsRows);
        patchProviderLocation(provider, "SBIconLocationRootWithWidgets", hsCols, hsRows);
        patchProviderLocation(provider, "SBIconLocationDock", dockCols, dockRows);
        patchProviderLocation(provider, "SBIconLocationFloatingDock", dockCols, dockRows);
      } else {
        log("provider nil, skipping provider-level patches");
      }

      log("-- walking root list views --");
      const rootTouched = forEachRootListView(iconCtrl, (lv, idx) => {
        patchListViewGrid(lv, hsCols, hsRows, "root[" + idx + "]");
      });
      log("root list views patched=" + rootTouched);

      log("-- dock list view --");
      const dockLv = findDockListView(iconCtrl);
      if (isNonZero(dockLv)) {
        patchListViewGrid(dockLv, dockCols, dockRows, "dock");
        log("dock list view patched");
      } else {
        log("no dock list view");
      }

      log("-- relayout --");
      if (!relayout(iconCtrl)) {
        log("relayout selectors unavailable");
      } else {
        log("relayout dispatched");
      }
      log("=== applyAtria complete ===");
      return true;
    } catch (e) {
      log("applyAtria fatal: " + String(e) + " stack: " + (e && e.stack ? e.stack : "N/A"));
      return false;
    }
  }

  function runOnMainEvaluate(script) {
    const jsctxObj = globalThis.__atria_jsctx_obj;
    if (!isNonZero(jsctxObj)) return false;
    const s = cfstr(script);
    if (!isNonZero(s)) return false;
    objc(jsctxObj, "performSelectorOnMainThread:withObject:waitUntilDone:", sel("evaluateScript:"), s, 0);
    return true;
  }

  try {
    log("=== atria_light.js entry ===");
    Native.init();
    log("Native.init() ok, baseAddr=0x" + new BigUint64Array(nativeCallBuff)[20].toString(16));

    const diagBuff = new BigUint64Array(nativeCallBuff);
    log("PAC ptrs: dlsym=0x" + diagBuff[21].toString(16) + " memcpy=0x" + diagBuff[22].toString(16) + " malloc=0x" + diagBuff[23].toString(16));
    log("PAC ptrs: paciaGadget=0x" + diagBuff[31].toString(16) + " kbase=0x" + diagBuff[30].toString(16));
    log("PAC ptrs: jsctx=0x" + diagBuff[25].toString(16) + " jsContextObj=0x" + diagBuff[33].toString(16));

    log("test malloc...");
    const testMalloc = Native.callSymbol("malloc", 16n);
    log("test malloc=0x" + u64(testMalloc).toString(16) + (testMalloc ? " OK" : " FAILED"));
    if (testMalloc) Native.callSymbol("free", testMalloc);

    log("test dlsym(objc_getClass)...");
    const testObjcGetClass = Native.callSymbol("dlsym", 0xfffffffffffffffen, "objc_getClass");
    log("test dlsym(objc_getClass)=0x" + u64(testObjcGetClass).toString(16));

    log("test objc_getClass(SBIconController) (injected thread)...");
    const testSB = Native.callSymbol("objc_getClass", "SBIconController");
    log("test SBIconController=0x" + u64(testSB).toString(16) + (testSB ? " (found)" : " (NOT FOUND - wrong process?)"));

    log("config: hs_cols=" + globalThis.__atria_hs_cols + " hs_rows=" + globalThis.__atria_hs_rows + " dock_cols=" + globalThis.__atria_dock_cols + " dock_rows=" + globalThis.__atria_dock_rows);

    const bi = Native.bridgeInfo();
    globalThis.__atria_jsctx_obj = bi.jsContextObj;
    globalThis.__atria_apply = applyAtria;
    globalThis.__atria_log = log;
    log("stashed globals, jsContextObj=0x" + u64(bi.jsContextObj).toString(16));

    log("about to runOnMainEvaluate (performSelectorOnMainThread) - PAC violation would happen here or inside applyAtria on main thread");
    runOnMainEvaluate("try{__atria_log('main-thread dispatch alive');__atria_apply();}catch(e){__atria_log('main-pass err: '+e+' stack='+(e&&e.stack?e.stack:'N/A'));}");
    // Intentionally no log() call after runOnMainEvaluate: with waitUntilDone:NO
    // the main thread may already be using the shared nativeCallBuff and a
    // Native.callSymbol("syslog",...) here would race. Exit bare.
  } catch (e) {
    log("fatal: " + String(e));
  }
})();
