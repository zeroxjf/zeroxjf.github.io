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

  function clampInt(v, lo, hi, def) {
    const n = Number(v);
    if (!Number.isFinite(n)) return def;
    return Math.max(lo, Math.min(hi, Math.floor(n)));
  }

  function stampGrid(cfg, cols, rows) {
    if (!isNonZero(cfg)) return false;
    if (!canRespond(cfg, "setNumberOfPortraitColumns:")) return false;
    objc(cfg, "setNumberOfPortraitColumns:", BigInt(cols));
    objc(cfg, "setNumberOfPortraitRows:", BigInt(rows));
    if (canRespond(cfg, "setNumberOfLandscapeColumns:")) {
      objc(cfg, "setNumberOfLandscapeColumns:", BigInt(rows));
      objc(cfg, "setNumberOfLandscapeRows:", BigInt(cols));
    }
    return true;
  }

  function patchProviderLocation(provider, locationStr, cols, rows) {
    if (!isNonZero(provider)) return false;
    if (!canRespond(provider, "layoutForIconLocation:")) return false;
    const loc = cfstr(locationStr);
    if (!isNonZero(loc)) return false;
    const layout = objc(provider, "layoutForIconLocation:", loc);
    if (!isNonZero(layout)) { log(locationStr + ": no layout"); return false; }
    const cfg = tryObjSelector(layout, ["layoutConfiguration"]);
    if (!isNonZero(cfg)) { log(locationStr + ": no cfg"); return false; }
    const ok = stampGrid(cfg, cols, rows);
    log(locationStr + " " + cols + "x" + rows + (ok ? " ok" : " fail"));
    return ok;
  }

  function patchListViewGrid(listView, cols, rows) {
    if (!isNonZero(listView)) return false;
    const layout = tryObjSelector(listView, ["layout"]);
    if (!isNonZero(layout)) return false;
    const cfg = tryObjSelector(layout, ["layoutConfiguration"]);
    if (!isNonZero(cfg)) return false;
    return stampGrid(cfg, cols, rows);
  }

  function findProvider(iconCtrl) {
    const names = ["iconListLayoutProvider", "_iconListLayoutProvider", "layoutProvider"];
    let p = tryObjSelector(iconCtrl, names);
    if (isNonZero(p)) return p;
    const iconMgr = tryObjSelector(iconCtrl, ["iconManager"]);
    if (isNonZero(iconMgr)) {
      p = tryObjSelector(iconMgr, names);
      if (isNonZero(p)) return p;
    }
    const rootFolder = tryObjSelector(iconCtrl, ["rootFolderController", "_rootFolderController"]);
    if (isNonZero(rootFolder)) {
      p = tryObjSelector(rootFolder, names);
      if (isNonZero(p)) return p;
    }
    return 0n;
  }

  function findDockListView(iconCtrl) {
    const direct = tryObjSelector(iconCtrl, ["dockListView"]);
    if (isNonZero(direct)) return direct;
    const iconMgr = tryObjSelector(iconCtrl, ["iconManager"]);
    if (isNonZero(iconMgr)) {
      const d = tryObjSelector(iconMgr, ["dockListView"]);
      if (isNonZero(d)) return d;
    }
    return 0n;
  }

  function forEachRootListView(iconCtrl, fn) {
    const rootFolder = tryObjSelector(iconCtrl, ["rootFolderController", "_rootFolderController"]);
    const container = isNonZero(rootFolder) ? rootFolder : iconCtrl;
    const arr = tryObjSelector(container, ["rootIconLists", "iconListViews", "visibleIconLists"]);
    if (!isNonZero(arr)) return 0;
    if (!canRespond(arr, "count")) return 0;
    const count = Number(u64(objc(arr, "count")));
    let n = 0;
    for (let i = 0; i < count; i++) {
      const v = objc(arr, "objectAtIndex:", BigInt(i));
      if (isNonZero(v)) { fn(v); n++; }
    }
    return n;
  }

  function relayout(iconCtrl) {
    const selectors = ["_relayoutIconLists", "relayoutIconLists", "_relayoutAllIconLists"];
    for (const s of selectors) {
      if (canRespond(iconCtrl, s)) { objc(iconCtrl, s); return true; }
    }
    return false;
  }

  function applyAtria() {
    log("applyAtria main-thread");
    const hsCols = clampInt(globalThis.__atria_hs_cols, 3, 8, 5);
    const hsRows = clampInt(globalThis.__atria_hs_rows, 4, 10, 7);
    const dockCols = clampInt(globalThis.__atria_dock_cols, 2, 8, 5);
    const dockRows = clampInt(globalThis.__atria_dock_rows, 1, 3, 1);
    log("hs=" + hsCols + "x" + hsRows + " dock=" + dockCols + "x" + dockRows);

    const SBIconController = Native.callSymbol("objc_getClass", "SBIconController");
    if (!isNonZero(SBIconController)) { log("no SBIconController"); return false; }
    const iconCtrl = objc(SBIconController, "sharedInstance");
    if (!isNonZero(iconCtrl)) { log("no iconCtrl"); return false; }

    const provider = findProvider(iconCtrl);
    log("provider=0x" + u64(provider).toString(16));
    if (isNonZero(provider)) {
      patchProviderLocation(provider, "SBIconLocationRoot", hsCols, hsRows);
      patchProviderLocation(provider, "SBIconLocationRootWithWidgets", hsCols, hsRows);
      patchProviderLocation(provider, "SBIconLocationDock", dockCols, dockRows);
      patchProviderLocation(provider, "SBIconLocationFloatingDock", dockCols, dockRows);
    }

    const rootTouched = forEachRootListView(iconCtrl, (lv) => {
      patchListViewGrid(lv, hsCols, hsRows);
    });
    log("root list views patched=" + rootTouched);

    const dockLv = findDockListView(iconCtrl);
    if (isNonZero(dockLv)) {
      patchListViewGrid(dockLv, dockCols, dockRows);
      log("dock list view patched");
    } else {
      log("no dock list view");
    }

    if (!relayout(iconCtrl)) {
      log("relayout selectors unavailable");
    } else {
      log("relayout dispatched");
    }
    return true;
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
    const bi = Native.bridgeInfo();
    globalThis.__atria_jsctx_obj = bi.jsContextObj;
    globalThis.__atria_apply = applyAtria;
    globalThis.__atria_log = log;
    log("loaded jsContextObj=0x" + u64(bi.jsContextObj).toString(16));
    runOnMainEvaluate("try{__atria_apply();}catch(e){__atria_log('main err: '+e);}");
    log("dispatched");
  } catch (e) {
    log("fatal: " + String(e));
  }
})();
