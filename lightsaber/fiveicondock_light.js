(() => {
  const DOCK_ICONS = 5;
  const ENABLE_UNSAFE_IVAR_WRITES = false;
  const ENABLE_METHOD_ENUMERATION = false;
  const ENABLE_MODEL_GRID_SIZE_CHANGE = true;
  const ENABLE_LAYOUT_COLUMN_PATCH = true;
  const ENABLE_FORCE_RELAYOUT = false;
  const ENABLE_SECOND_PASS = false;
  // Experimental: also bump the home screen grid to 5 columns to match the
  // 5-icon dock. Uses the same layout-config setter pattern the dock patch
  // already relies on, walked over SBIconController's root list views.
  const ENABLE_HOMESCREEN_COL_PATCH = true;
  const HOMESCREEN_TARGET_COLS = 5;

  class Native {
    static #baseAddr;
    static #dlsymAddr;
    static #memcpyAddr;
    static #mallocAddr;
    static mem = 0n;
    static memSize = 0x4000;
    static #argMem = 0n;
    static #argPtr = 0n;
    static #dlsymCache = {};

    static init() {
      const buff = new BigUint64Array(nativeCallBuff);
      this.#baseAddr = buff[20];
      this.#dlsymAddr = buff[21];
      this.#memcpyAddr = buff[22];
      this.#mallocAddr = buff[23];
      this.mem = this.#nativeCallAddr(this.#mallocAddr, BigInt(this.memSize));
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

    static read(ptr, length) {
      if (!ptr) return null;
      const buff = new ArrayBuffer(length);
      const buff8 = new Uint8Array(buff);
      let offs = 0;
      let left = length;
      while (left) {
        let len = left;
        if (len > 0x1000) len = 0x1000;
        this.#nativeCallAddr(this.#memcpyAddr, this.#baseAddr + 0x1000n, ptr + BigInt(offs), BigInt(len));
        buff8.set(new Uint8Array(nativeCallBuff, 0x1000, len), offs);
        left -= len;
        offs += len;
      }
      return buff;
    }

    static readPtr(ptr) {
      const dv = new DataView(this.read(ptr, 8));
      return dv.getBigUint64(0, true);
    }

    static read32(ptr) {
      const dv = new DataView(this.read(ptr, 4));
      return dv.getUint32(0, true);
    }

    static writeString(ptr, str) {
      this.write(ptr, this.stringToBytes(str, true));
    }

    static readString(ptr, len = 512) {
      return this.bytesToString(this.read(ptr, len), false);
    }

    static bytesToString(bytes, includeNullChar = true) {
      const bytes8 = new Uint8Array(bytes);
      let str = "";
      for (let i = 0; i < bytes8.length; i++) {
        if (!includeNullChar && !bytes8[i]) break;
        str += String.fromCharCode(bytes8[i]);
      }
      return str;
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
      return {
        jsctx: buff[25],
        jsContextObj: buff[33],
      };
    }
  }

  function u64(v) {
    if (!v) return 0n;
    return BigInt.asUintN(64, BigInt(v));
  }

  function isNonZero(v) {
    return u64(v) !== 0n;
  }

  function log(msg) {
    try {
      const tagged = "[FIVEICON] " + msg;
      const ptr = Native.callSymbol("malloc", BigInt(tagged.length + 1));
      if (!ptr) return;
      Native.writeString(ptr, tagged);
      Native.callSymbol("syslog", 5, ptr);
      Native.callSymbol("free", ptr);
    } catch (_) {}
  }

  function sel(name) {
    return Native.callSymbol("sel_registerName", name);
  }

  function objc(obj, selectorName, ...args) {
    return Native.callSymbol("objc_msgSend", obj, sel(selectorName), ...args);
  }

  function cfstr(str) {
    return Native.callSymbol("CFStringCreateWithCString", 0n, str, 0x08000100);
  }

  function canRespond(obj, selectorName) {
    if (!isNonZero(obj)) return false;
    const ret = objc(obj, "respondsToSelector:", sel(selectorName));
    return isNonZero(ret);
  }

  function tryObjSelector(obj, selectorNames) {
    for (const selectorName of selectorNames) {
      if (!canRespond(obj, selectorName)) continue;
      const out = objc(obj, selectorName);
      if (isNonZero(out)) return out;
    }
    return 0n;
  }

  function writeU32(ptr, value) {
    const buff = new ArrayBuffer(4);
    const dv = new DataView(buff);
    dv.setUint32(0, value >>> 0, true);
    Native.write(ptr, buff);
  }

  function writeU64(ptr, value) {
    const buff = new ArrayBuffer(8);
    const dv = new DataView(buff);
    dv.setBigUint64(0, u64(value), true);
    Native.write(ptr, buff);
  }

  function patchIvarU32(obj, ivarName, value) {
    const cls = Native.callSymbol("object_getClass", obj);
    if (!isNonZero(cls)) return false;
    const ivar = Native.callSymbol("class_getInstanceVariable", cls, ivarName);
    if (!isNonZero(ivar)) return false;
    const offset = Number(Native.callSymbol("ivar_getOffset", ivar));
    const ptr = u64(obj) + BigInt(offset);
    const before = Native.read32(ptr);
    writeU32(ptr, value);
    const after = Native.read32(ptr);
    log("ivar " + ivarName + " (u32) 0x" + before.toString(16) + " -> 0x" + after.toString(16));
    return true;
  }

  function patchGridSize(model) {
    const cls = Native.callSymbol("object_getClass", model);
    if (!isNonZero(cls)) return false;
    const ivar = Native.callSymbol("class_getInstanceVariable", cls, "_gridSize");
    if (!isNonZero(ivar)) return false;
    const offset = Number(Native.callSymbol("ivar_getOffset", ivar));
    const ptr = u64(model) + BigInt(offset);
    const oldVal = Native.read32(ptr) >>> 0;
    const low = oldVal & 0xffff;
    const high = (oldVal >>> 16) & 0xffff;

    let newVal = oldVal;
    if (low === 4 || low === DOCK_ICONS) {
      newVal = (oldVal & 0xffff0000) | DOCK_ICONS;
    } else if (high === 4 || high === DOCK_ICONS) {
      newVal = (DOCK_ICONS << 16) | (oldVal & 0xffff);
    } else {
      // Default to the common packing {rows:high16, cols:low16}.
      newVal = (oldVal & 0xffff0000) | DOCK_ICONS;
    }

    writeU32(ptr, newVal >>> 0);
    const after = Native.read32(ptr) >>> 0;
    log("_gridSize 0x" + oldVal.toString(16) + " -> 0x" + after.toString(16));
    return true;
  }

  function patchIvarU64(obj, ivarName, value) {
    const cls = Native.callSymbol("object_getClass", obj);
    if (!isNonZero(cls)) return false;
    const ivar = Native.callSymbol("class_getInstanceVariable", cls, ivarName);
    if (!isNonZero(ivar)) return false;
    const offset = Number(Native.callSymbol("ivar_getOffset", ivar));
    const ptr = u64(obj) + BigInt(offset);
    const before = Native.readPtr(ptr);
    writeU64(ptr, value);
    const after = Native.readPtr(ptr);
    log("ivar " + ivarName + " (u64) " + before.toString() + " -> " + after.toString());
    return true;
  }

  function trySetU64(obj, setterName, value) {
    if (!isNonZero(obj)) return false;
    if (!canRespond(obj, setterName)) return false;
    objc(obj, setterName, BigInt(value));
    log("setter " + setterName + " <- " + value);
    return true;
  }

  function logGetterU64(obj, getterName, tag) {
    if (!isNonZero(obj)) return;
    if (!canRespond(obj, getterName)) return;
    const v = objc(obj, getterName);
    log(tag + "." + getterName + "=" + u64(v).toString());
  }

  function dumpMethodsForKeywords(obj, tag, keywords) {
    if (!ENABLE_METHOD_ENUMERATION) return;
    if (!isNonZero(obj)) return;
    const cls = Native.callSymbol("object_getClass", obj);
    if (!isNonZero(cls)) return;

    const countPtr = Native.callSymbol("malloc", 4n);
    writeU32(countPtr, 0);
    const list = Native.callSymbol("class_copyMethodList", cls, countPtr);
    const count = Native.read32(countPtr) >>> 0;
    Native.callSymbol("free", countPtr);
    if (!isNonZero(list) || count === 0) return;

    try {
      for (let i = 0; i < count; i++) {
        const method = Native.readPtr(u64(list) + BigInt(i * 8));
        if (!isNonZero(method)) continue;
        const nameSel = Native.callSymbol("method_getName", method);
        if (!isNonZero(nameSel)) continue;
        const namePtr = Native.callSymbol("sel_getName", nameSel);
        if (!isNonZero(namePtr)) continue;
        const name = Native.readString(namePtr, 256);
        const lower = name.toLowerCase();
        let keep = false;
        for (const kw of keywords) {
          if (lower.indexOf(kw) >= 0) {
            keep = true;
            break;
          }
        }
        if (keep) log(tag + ".method " + name);
      }
    } catch (e) {
      log(tag + ".method-dump err: " + String(e));
    }

    Native.callSymbol("free", list);
  }

  function patchModelGridSize(model) {
    if (!isNonZero(model)) return false;
    if (!canRespond(model, "gridSize")) return false;

    const oldGrid = u64(objc(model, "gridSize")) & 0xffffffffn;
    const oldCols = Number(oldGrid & 0xffffn);
    const oldRows = Number((oldGrid >> 16n) & 0xffffn);
    const newGrid = ((oldGrid & 0xffff0000n) | BigInt(DOCK_ICONS)) & 0xffffffffn;

    if (canRespond(model, "setGridSize:")) {
      objc(model, "setGridSize:", newGrid);
    } else if (canRespond(model, "changeGridSize:options:")) {
      objc(model, "changeGridSize:options:", newGrid, 0n);
    } else {
      return false;
    }

    const afterGrid = canRespond(model, "gridSize") ? (u64(objc(model, "gridSize")) & 0xffffffffn) : 0n;
    const afterCols = Number(afterGrid & 0xffffn);
    const afterRows = Number((afterGrid >> 16n) & 0xffffn);
    log(
      "gridSize cols/rows " +
      oldCols + "/" + oldRows + " -> " +
      afterCols + "/" + afterRows +
      " (0x" + oldGrid.toString(16) + " -> 0x" + afterGrid.toString(16) + ")"
    );
    return true;
  }

  function patchLayoutColumns(dockListView) {
    if (!isNonZero(dockListView)) return false;
    const layout = tryObjSelector(dockListView, ["layout"]);
    if (!isNonZero(layout)) return false;
    const cfg = tryObjSelector(layout, ["layoutConfiguration"]);
    if (!isNonZero(cfg)) return false;

    if (!canRespond(cfg, "numberOfPortraitRows")) return false;
    if (!canRespond(cfg, "numberOfPortraitColumns")) return false;
    if (!canRespond(cfg, "setNumberOfPortraitColumns:")) return false;

    const rows = u64(objc(cfg, "numberOfPortraitRows"));
    const beforeCols = u64(objc(cfg, "numberOfPortraitColumns"));
    if (rows !== 1n) {
      log("cfg.portraitRows=" + rows.toString() + " (skip non-dock layout)");
      return false;
    }

    objc(cfg, "setNumberOfPortraitColumns:", BigInt(DOCK_ICONS));
    const afterCols = u64(objc(cfg, "numberOfPortraitColumns"));
    log("cfg.portraitRows=" + rows.toString() + " portraitColumns " + beforeCols.toString() + " -> " + afterCols.toString());

    if (canRespond(cfg, "numberOfLandscapeColumns")) {
      log("cfg.landscapeColumns=" + u64(objc(cfg, "numberOfLandscapeColumns")).toString());
    }

    if (canRespond(dockListView, "layoutOrientation") && canRespond(layout, "numberOfColumnsForOrientation:")) {
      const orient = u64(objc(dockListView, "layoutOrientation"));
      const cols = u64(objc(layout, "numberOfColumnsForOrientation:", orient));
      log("layout.columnsForOrientation(" + orient.toString() + ")=" + cols.toString());
    }

    return afterCols === BigInt(DOCK_ICONS);
  }

  function runOnMainEvaluate(script) {
    const jsctxObj = globalThis.__fiveicon_jsctx_obj;
    log("runOnMainEvaluate: jsctxObj=0x" + u64(jsctxObj).toString(16) + " scriptLen=" + script.length);
    if (!isNonZero(jsctxObj)) {
      log("runOnMainEvaluate: jsctxObj is NULL, aborting");
      return false;
    }
    const s = cfstr(script);
    log("runOnMainEvaluate: cfstr=0x" + u64(s).toString(16) + " calling performSelectorOnMainThread (waitUntilDone:NO)");
    objc(jsctxObj, "performSelectorOnMainThread:withObject:waitUntilDone:", sel("evaluateScript:"), s, 0);
    log("runOnMainEvaluate: performSelector returned, skipping CFRelease (main thread owns cfstr now)");
    // NOTE: Do NOT CFRelease the cfstr here. With waitUntilDone:NO, the main
    // thread retains/releases the object via performSelector's autorelease pool.
    // Releasing on the injected thread races with main thread access and causes
    // PAC violations on the release path (objc_release -> objc_msgSend with a
    // PAC-signed isa that was signed for main thread context).
    return true;
  }

  function patchRootListViewCols(listView, targetCols) {
    if (!isNonZero(listView)) return false;
    const layout = tryObjSelector(listView, ["layout"]);
    if (!isNonZero(layout)) return false;
    const cfg = tryObjSelector(layout, ["layoutConfiguration"]);
    if (!isNonZero(cfg)) return false;
    if (!canRespond(cfg, "setNumberOfPortraitColumns:")) return false;
    if (!canRespond(cfg, "numberOfPortraitColumns")) return false;
    const beforeCols = u64(objc(cfg, "numberOfPortraitColumns"));
    const beforeRows = canRespond(cfg, "numberOfPortraitRows") ? u64(objc(cfg, "numberOfPortraitRows")) : 0n;
    // Skip if this looks like a dock config (rows==1) - the dock path owns it.
    if (beforeRows === 1n) return false;
    objc(cfg, "setNumberOfPortraitColumns:", BigInt(targetCols));
    const afterCols = u64(objc(cfg, "numberOfPortraitColumns"));
    if (canRespond(cfg, "setNumberOfLandscapeRows:")) {
      objc(cfg, "setNumberOfLandscapeRows:", BigInt(targetCols));
    }
    log("root cfg portraitRows=" + beforeRows.toString() + " portraitColumns " + beforeCols.toString() + " -> " + afterCols.toString());
    return afterCols === BigInt(targetCols);
  }

  function patchHomescreenCols(iconCtrl, targetCols) {
    if (!isNonZero(iconCtrl)) return 0;
    const rootFolder = tryObjSelector(iconCtrl, ["rootFolderController", "_rootFolderController"]);
    const container = isNonZero(rootFolder) ? rootFolder : iconCtrl;
    const arr = tryObjSelector(container, ["iconListViews", "rootIconListViews", "visibleIconLists"]);
    if (!isNonZero(arr)) { log("patchHomescreenCols: no root list view array"); return 0; }
    if (!canRespond(arr, "count")) { log("patchHomescreenCols: list view array missing count"); return 0; }
    const count = Number(u64(objc(arr, "count")));
    log("patchHomescreenCols: walking " + count + " root list views (target=" + targetCols + ")");
    let touched = 0;
    for (let i = 0; i < count; i++) {
      const lv = objc(arr, "objectAtIndex:", BigInt(i));
      if (!isNonZero(lv)) continue;
      if (patchRootListViewCols(lv, targetCols)) touched++;
    }
    log("patchHomescreenCols: touched=" + touched + "/" + count);
    return touched;
  }

  function forceRelayout(dockListView) {
    const selectors = ["layoutIconsNow", "setNeedsLayout", "layoutIfNeeded"];
    for (const selectorName of selectors) {
      if (canRespond(dockListView, selectorName)) objc(dockListView, selectorName);
    }
    const superview = tryObjSelector(dockListView, ["superview"]);
    if (isNonZero(superview)) {
      if (canRespond(superview, "setNeedsLayout")) objc(superview, "setNeedsLayout");
      if (canRespond(superview, "layoutIfNeeded")) objc(superview, "layoutIfNeeded");
    }
  }

  function applyDockPatch(passTag) {
    log("applyDockPatch(" + passTag + ") entered - running on main thread");
    const SBIconController = Native.callSymbol("objc_getClass", "SBIconController");
    if (!isNonZero(SBIconController)) {
      log("SBIconController missing - are we in SpringBoard?");
      return false;
    }
    log("SBIconController=0x" + u64(SBIconController).toString(16));

    const iconCtrl = objc(SBIconController, "sharedInstance");
    if (!isNonZero(iconCtrl)) {
      log("icon controller unavailable");
      return false;
    }

    const iconMgr = tryObjSelector(iconCtrl, ["iconManager"]);
    let dockListView = 0n;
    if (isNonZero(iconMgr)) {
      dockListView = tryObjSelector(iconMgr, ["dockListView"]);
    }
    if (!isNonZero(dockListView)) {
      dockListView = tryObjSelector(iconCtrl, ["dockListView"]);
    }
    if (!isNonZero(dockListView)) {
      log("dock list view unavailable");
      return false;
    }

    let model = tryObjSelector(dockListView, ["model", "iconListModel"]);
    if (!isNonZero(model)) {
      model = tryObjSelector(dockListView, ["displayedModel"]);
    }
    if (!isNonZero(model)) {
      log("dock model unavailable");
      return false;
    }

    let touched = 0;
    if (ENABLE_MODEL_GRID_SIZE_CHANGE && patchModelGridSize(model)) touched++;
    if (ENABLE_LAYOUT_COLUMN_PATCH && patchLayoutColumns(dockListView)) touched++;

    if (ENABLE_UNSAFE_IVAR_WRITES) {
      if (patchGridSize(model)) touched++;
    }

    if (ENABLE_FORCE_RELAYOUT && touched > 0) {
      forceRelayout(dockListView);
    }
    logGetterU64(dockListView, "iconsInRowForSpacingCalculation", "dockListView");
    logGetterU64(model, "maxNumberOfIcons", "model");
    logGetterU64(model, "numberOfIcons", "model");
    if (canRespond(model, "allowsAddingIconCount:")) {
      const canAdd = u64(objc(model, "allowsAddingIconCount:", 1n));
      log("model.allowsAddingIconCount(1)=" + canAdd.toString());
    }

    if (ENABLE_HOMESCREEN_COL_PATCH) {
      try {
        const rootTouched = patchHomescreenCols(iconCtrl, HOMESCREEN_TARGET_COLS);
        if (rootTouched > 0) touched++;
      } catch (hsErr) {
        log("patchHomescreenCols threw: " + String(hsErr));
      }
    }

    log("pass=" + passTag + " touched=" + touched + " dock=0x" + u64(dockListView).toString(16) + " model=0x" + u64(model).toString(16));
    return touched > 0;
  }

  try {
    log("=== fiveicondock_light.js entry ===");
    Native.init();
    log("Native.init() ok, baseAddr=0x" + new BigUint64Array(nativeCallBuff)[20].toString(16));
    const bi = Native.bridgeInfo();
    globalThis.__fiveicon_jsctx_obj = bi.jsContextObj;
    globalThis.__fiveicon_apply_once = applyDockPatch;
    globalThis.__fiveicon_log = log;

    log("loaded jsctx=0x" + u64(bi.jsctx).toString(16) + " jsContextObj=0x" + u64(bi.jsContextObj).toString(16));

    // PAC diagnostic: verify dlsym/memcpy/malloc pointers are non-zero
    const diagBuff = new BigUint64Array(nativeCallBuff);
    log("PAC ptrs: dlsym=0x" + diagBuff[21].toString(16) + " memcpy=0x" + diagBuff[22].toString(16) + " malloc=0x" + diagBuff[23].toString(16));
    log("PAC ptrs: paciaGadget=0x" + diagBuff[31].toString(16) + " kbase=0x" + diagBuff[30].toString(16));

    // Test a simple native call before touching ObjC
    const testMalloc = Native.callSymbol("malloc", 16n);
    log("test malloc=0x" + u64(testMalloc).toString(16) + (testMalloc ? " OK" : " FAILED"));
    if (testMalloc) Native.callSymbol("free", testMalloc);

    // Test dlsym works
    const testObjcGetClass = Native.callSymbol("dlsym", 0xfffffffffffffffen, "objc_getClass");
    log("test dlsym(objc_getClass)=0x" + u64(testObjcGetClass).toString(16));

    // Test objc_getClass before main dispatch
    const testSB = Native.callSymbol("objc_getClass", "SBIconController");
    log("test SBIconController=0x" + u64(testSB).toString(16) + (testSB ? " (found)" : " (NOT FOUND - wrong process?)"));

    log("about to runOnMainEvaluate (performSelectorOnMainThread) - PAC violation happens here if PAC context is stale");
    runOnMainEvaluate("try{__fiveicon_log('main-thread dispatch alive');__fiveicon_apply_once('main-pass-1');}catch(e){__fiveicon_log('main-pass-1 err: '+e);}");
    log("runOnMainEvaluate returned (async dispatch, no crash on injected thread)");

    if (ENABLE_SECOND_PASS) {
      Native.callSymbol("usleep", 1200000);
      log("about to runOnMainEvaluate pass 2");
      runOnMainEvaluate("try{__fiveicon_apply_once('main-pass-2');}catch(e){__fiveicon_log('main-pass-2 err: '+e);}");
      log("pass 2 dispatched");
    }
  } catch (e) {
    log("fatal: " + String(e) + " stack: " + (e.stack || "N/A"));
  }
})();
