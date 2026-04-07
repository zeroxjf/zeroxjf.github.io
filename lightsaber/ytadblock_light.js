(() => {
  // ytadblock_light.js
  //
  // YouTube ad-block payload for the lightsaber JS-injection chain. Meant to
  // be injected into the com.google.ios.youtube process via the same
  // InjectJS primitive used for fiveicondock_light.js and powercuff_light.js.
  //
  // This is NOT a full YTLite port. It implements only the subset of YTLite's
  // ad-blocking hooks that can be expressed as pure constant-return IMP
  // replacements, because that's the only hook flavor reachable from the
  // lightsaber environment without a MobileSubstrate-style method swizzle
  // framework.
  //
  // Covered features (9 hooks):
  //   - Background playback                  (2 hooks, return YES)
  //   - Monetization check always NO         (breaks ad-serving pipeline)
  //   - Spam / tracking signals always nil   (2 hooks, breaks signal collection)
  //   - Ad context decorator no-ops          (2 hooks)
  //   - Commerce + promo alert no-ops        (2 hooks, no "buy Premium" popups)
  //
  // Not covered (these need %orig-capable swizzling, future work):
  //   - Home-feed element-level ad filtering (YTIElementRenderer.elementData)
  //   - Promoted-section removal             (YTSectionListViewController.loadWithModel:)
  //   - Shorts hiding                        (same element-level filter)
  //
  // Persistence: hooks live inside YouTube's address space, so they die the
  // moment YouTube is killed or resprung. For the initial PoC the user re-runs
  // the chain when they want ads gone. A mediaplaybackd-hosted re-injector
  // watcher is a planned phase 2 improvement.
  //
  // All IMPs are sourced without allocating new executable memory (which iOS
  // blocks for non-JIT processes). "return NO / nil" is stolen from
  // -[NSObject isProxy], which ARM64 compiles to "mov w0, #0; ret" and takes
  // only (self, _cmd). "return YES" is scanned out of libSystem's .text
  // segment as a "mov w0, #1; ret" byte pattern, then installed via the same
  // method_setImplementation call. Void no-op methods safely reuse the "NO"
  // IMP because a caller of a void method ignores w0 anyway.

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

    static resolveSymbol(name) {
      return this.#dlsym(name);
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
      const tagged = "[YTADBLOCK] " + msg;
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

  function objcGetClass(name) {
    return Native.callSymbol("objc_getClass", name);
  }

  // Steal the IMP of -[NSObject isProxy], which on every iOS build compiles
  // to "mov w0, #0; ret" and ignores self / _cmd beyond the standard prologue
  // (actually it doesn't even have a prologue since it doesn't touch the
  // frame pointer). Reusing it as the IMP for any zero-arg instance method
  // whose return type fits in w0 (BOOL / id / pointer-width int) gives us
  // a safe "return 0 / NO / nil" replacement. Because the caller of a void
  // method ignores w0, the same IMP also works as a void-no-op stand-in.
  function getReturnZeroImp() {
    const NSObject = objcGetClass("NSObject");
    if (!isNonZero(NSObject)) {
      log("NSObject class missing - cannot source return-zero IMP");
      return 0n;
    }
    const method = Native.callSymbol("class_getInstanceMethod", NSObject, sel("isProxy"));
    if (!isNonZero(method)) {
      log("-[NSObject isProxy] Method handle missing");
      return 0n;
    }
    const imp = Native.callSymbol("method_getImplementation", method);
    log("returnZeroImp = 0x" + u64(imp).toString(16) + " (from -[NSObject isProxy])");
    return imp;
  }

  // Scan libSystem's .text region for an ARM64 "mov w0, #1 ; ret" gadget,
  // which is the smallest possible function body that returns YES / 1 from
  // a zero-arg method. Starting address is any known libSystem symbol; we
  // walk outward in 64KB chunks looking for the 8-byte pattern
  //   52 80 00 20   d2800020  mov w0, #1   (little-endian uint32 0x52800020)
  //   c0 03 5f d6   d65f03c0  ret          (little-endian uint32 0xd65f03c0)
  // Once we find it, return the address of the "mov" instruction. We skip
  // scanning backward past page boundaries we haven't mapped, so this is a
  // forward-only scan from strlen's address over ~4 MB, which comfortably
  // covers libSystem.B.dylib's text segment.
  function findReturnYesGadget() {
    const strlenAddr = Native.resolveSymbol("strlen");
    if (!isNonZero(strlenAddr)) {
      log("cannot dlsym strlen - YES gadget scan aborted");
      return 0n;
    }
    log("scanning for YES gadget starting at strlen = 0x" + u64(strlenAddr).toString(16));
    const CHUNK = 0x10000; // 64 KB
    const SCAN_RANGE = 0x400000; // 4 MB
    const MOV_W0_1 = 0x52800020;
    const RET = 0xd65f03c0;
    for (let chunkOff = 0; chunkOff < SCAN_RANGE; chunkOff += CHUNK) {
      let buff;
      try {
        buff = Native.read(strlenAddr + BigInt(chunkOff), CHUNK);
      } catch (e) {
        log("read failed at +0x" + chunkOff.toString(16) + ", stopping scan");
        break;
      }
      if (!buff) break;
      const view = new DataView(buff);
      for (let i = 0; i <= CHUNK - 8; i += 4) {
        if (view.getUint32(i, true) !== MOV_W0_1) continue;
        if (view.getUint32(i + 4, true) !== RET) continue;
        const found = strlenAddr + BigInt(chunkOff + i);
        log("YES gadget at 0x" + u64(found).toString(16) + " (offset +0x" + (chunkOff + i).toString(16) + ")");
        return found;
      }
    }
    log("YES gadget not found in " + SCAN_RANGE.toString(16) + " bytes");
    return 0n;
  }

  // Install a single method hook by swapping the target Method's IMP to
  // newImp. classMethod = true targets +[Class selector], false targets
  // -[Class selector]. Returns true on success, false if the class or
  // method couldn't be resolved (usually because the YouTube version we
  // injected into doesn't have that private class anymore).
  function installHook(className, selectorName, newImp, classMethod) {
    if (!isNonZero(newImp)) {
      log("SKIP " + className + " " + selectorName + " (no IMP)");
      return false;
    }
    const cls = objcGetClass(className);
    if (!isNonZero(cls)) {
      log("MISS class " + className);
      return false;
    }
    let targetCls = cls;
    if (classMethod) {
      targetCls = Native.callSymbol("object_getClass", cls);
      if (!isNonZero(targetCls)) {
        log("MISS metaclass for " + className);
        return false;
      }
    }
    const method = Native.callSymbol("class_getInstanceMethod", targetCls, sel(selectorName));
    if (!isNonZero(method)) {
      log("MISS method " + (classMethod ? "+" : "-") + "[" + className + " " + selectorName + "]");
      return false;
    }
    const oldImp = Native.callSymbol("method_getImplementation", method);
    Native.callSymbol("method_setImplementation", method, newImp);
    log("HOOK " + (classMethod ? "+" : "-") + "[" + className + " " + selectorName + "]"
        + " oldImp=0x" + u64(oldImp).toString(16)
        + " newImp=0x" + u64(newImp).toString(16));
    return true;
  }

  function applyAdBlock() {
    log("=== ytadblock_light entry ===");

    // Sanity check: make sure we're actually running inside the YouTube app.
    // If we can't find a single one of YouTube's private classes we are
    // almost certainly running in the wrong process and should bail without
    // touching anything.
    const probe = objcGetClass("YTIPlayerResponse");
    if (!isNonZero(probe)) {
      log("YTIPlayerResponse class missing - wrong process? bailing out");
      return false;
    }
    log("probe YTIPlayerResponse=0x" + u64(probe).toString(16) + " (YouTube OK)");

    const returnZeroImp = getReturnZeroImp();
    if (!isNonZero(returnZeroImp)) {
      log("no returnZeroImp, cannot install NO/nil/void hooks");
      return false;
    }

    const returnYesImp = findReturnYesGadget();
    // returnYesImp may be zero - that just means background playback hooks
    // get skipped, the rest of the ad-block still works.

    let installed = 0;
    let attempted = 0;

    // Background playback (return YES) - graceful degrade if no YES gadget.
    if (isNonZero(returnYesImp)) {
      attempted += 2;
      if (installHook("YTIPlayabilityStatus", "isPlayableInBackground", returnYesImp, false)) installed++;
      if (installHook("MLVideo", "playableInBackground", returnYesImp, false)) installed++;
    } else {
      log("skipping background-playback hooks (no YES gadget)");
    }

    // isMonetized -> NO. Kills the top-level ad decision that gates pre/mid-roll.
    attempted += 1;
    if (installHook("YTIPlayerResponse", "isMonetized", returnZeroImp, false)) installed++;

    // spamSignals dictionaries -> nil. Breaks signal collection that feeds
    // YouTube's anti-adblock detector.
    attempted += 2;
    if (installHook("YTDataUtils", "spamSignalsDictionary", returnZeroImp, true)) installed++;
    if (installHook("YTDataUtils", "spamSignalsDictionaryWithoutIDFA", returnZeroImp, true)) installed++;

    // decorateContext: -> void no-op. Stops ad context injection into the
    // InnerTube request pipeline, which is how ad requests get tagged.
    attempted += 2;
    if (installHook("YTAdsInnerTubeContextDecorator", "decorateContext:", returnZeroImp, false)) installed++;
    if (installHook("YTAccountScopedAdsInnerTubeContextDecorator", "decorateContext:", returnZeroImp, false)) installed++;

    // addEventHandlers -> void no-op. Suppresses the commerce / interstitial
    // promo handlers that fire the "buy Premium" popups.
    attempted += 2;
    if (installHook("YTCommerceEventGroupHandler", "addEventHandlers", returnZeroImp, false)) installed++;
    if (installHook("YTInterstitialPromoEventGroupHandler", "addEventHandlers", returnZeroImp, false)) installed++;

    log("ytadblock: installed " + installed + "/" + attempted + " hooks");
    return installed > 0;
  }

  try {
    log("=== ytadblock_light.js loaded ===");
    Native.init();
    log("Native.init ok, baseAddr=0x" + new BigUint64Array(nativeCallBuff)[20].toString(16));
    const ok = applyAdBlock();
    log("ytadblock_light result=" + ok);
  } catch (e) {
    log("fatal: " + String(e) + " stack: " + (e.stack || "N/A"));
  }
})();
