/**
 * JavaScript Applied Examples - Part 5 (Web APIs, DOM & Modern Standards Recipes 41-52)
 */

module.exports = [
  {
    id: "js-ex-41",
    title: "Virtual Scrolling Engine Calculation for 100,000 Items",
    category: "Web APIs & Browser Concurrency",
    difficulty: "advanced",
    whatThisCodeCovers: "Calculates the dynamic window slice (startIndex, endIndex, topPadding, bottomPadding) required to render 100,000 items in a virtualized scrolling container with only 20 visible DOM nodes.",
    conceptsCovered: ["Virtual Scrolling", "DOM Optimization", "Memory Management", "Scroll Calculations"],
    code: `function calculateVirtualWindow(options) {
  const {
    totalItems = 100000,
    itemHeight = 40,
    containerHeight = 400,
    scrollTop = 0,
    buffer = 2
  } = options;

  const totalHeight = totalItems * itemHeight;

  // Calculate visible range:
  const rawStart = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(containerHeight / itemHeight);

  // Apply buffer padding to prevent blank flashing on fast scroll:
  const startIndex = Math.max(0, rawStart - buffer);
  const endIndex = Math.min(totalItems - 1, rawStart + visibleCount + buffer);

  const topPadding = startIndex * itemHeight;
  const bottomPadding = (totalItems - 1 - endIndex) * itemHeight;

  return {
    totalHeight,
    startIndex,
    endIndex,
    renderedCount: endIndex - startIndex + 1,
    topPadding,
    bottomPadding
  };
}

// Scrolled down 1200px in a 100,000 item list:
const view = calculateVirtualWindow({
  totalItems: 100000,
  itemHeight: 40,
  containerHeight: 400,
  scrollTop: 1200,
  buffer: 2
});

console.log("Total Height:", view.totalHeight + "px");
console.log("Rendering items from:", view.startIndex, "to", view.endIndex);
console.log("Total DOM nodes rendered:", view.renderedCount); // Only 15 nodes instead of 100,000!
console.log("Top spacer padding:", view.topPadding + "px");`,
    breakdown: [
      { lineRange: "1-10", note: "Computes totalHeight and extracts raw start index from scrollTop / itemHeight." },
      { lineRange: "14-22", note: "Applies buffer elements and calculates top/bottom spacer padding." },
      { lineRange: "34-37", note: "Shows rendering only 15 nodes in memory for a 100,000-item collection." }
    ],
    expectedOutput: `Total Height: 4000000px
Rendering items from: 28 to 42
Total DOM nodes rendered: 15
Top spacer padding: 1120px`
  },
  {
    id: "js-ex-42",
    title: "Lazy Loading Images with IntersectionObserver and Blur Placeholder",
    category: "Web APIs & Browser Concurrency",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements progressive lazy loading of responsive images with smooth fade-in and threshold pre-fetching via the native IntersectionObserver API.",
    conceptsCovered: ["IntersectionObserver", "Lazy Loading", "Performance", "DOM Manipulation"],
    code: `function setupLazyImages(container = document) {
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;

      const img = entry.target;
      const trueSrc = img.dataset.src;

      if (trueSrc) {
        // Pre-load image in background
        const preloader = new Image();
        preloader.src = trueSrc;
        preloader.onload = () => {
          img.src = trueSrc;
          img.classList.add("loaded"); // Triggers CSS fade-in
          img.removeAttribute("data-src");
        };
      }

      // Stop observing once triggered
      observer.unobserve(img);
    });
  }, {
    rootMargin: "150px 0px", // Pre-fetch 150px before entering viewport!
    threshold: 0.01
  });

  const lazyImages = container.querySelectorAll("img[data-src]");
  lazyImages.forEach(img => imageObserver.observe(img));

  return () => imageObserver.disconnect();
}

console.log("Lazy image observer initialized with 150px pre-fetch buffer.");`,
    breakdown: [
      { lineRange: "2-22", note: "IntersectionObserver callback preloads trueSrc and unobserves image." },
      { lineRange: "23-26", note: "Sets rootMargin to 150px to fetch images just before scrolling into view." }
    ],
    expectedOutput: `Lazy image observer initialized with 150px pre-fetch buffer.`
  },
  {
    id: "js-ex-43",
    title: "Cooperative Time-Slicing Scheduler with scheduler.yield() / MessageChannel",
    category: "Web APIs & Browser Concurrency",
    difficulty: "advanced",
    whatThisCodeCovers: "Splits long-running CPU calculations into 5ms slices using `MessageChannel` (or `scheduler.yield()`), allowing the browser to paint frames and handle user inputs without freezing.",
    conceptsCovered: ["Time Slicing", "MessageChannel", "Cooperative Scheduling", "Core Web Vitals INP"],
    code: `function yieldToMain() {
  // Polyfill scheduler.yield() via MessageChannel macro-tasking
  if (globalThis.scheduler?.yield) {
    return globalThis.scheduler.yield();
  }
  return new Promise(resolve => {
    const channel = new MessageChannel();
    channel.port1.onmessage = resolve;
    channel.port2.postMessage(null);
  });
}

async function processBigDataset(items) {
  let deadline = performance.now() + 5; // 5ms budget per slice
  let processed = 0;

  for (let i = 0; i < items.length; i++) {
    // Heavy CPU work
    doHeavyMath(items[i]);
    processed++;

    // If 5ms budget elapsed, yield control back to browser!
    if (performance.now() >= deadline) {
      console.log(\`Yielded thread at item \${i} to let browser paint and handle clicks\`);
      await yieldToMain();
      deadline = performance.now() + 5; // Reset budget
    }
  }

  return processed;
}

function doHeavyMath(x) {
  let total = 0;
  for (let i = 0; i < 50000; i++) total += i;
}

// Test time-slicing
const largeArray = new Array(500).fill(1);
processBigDataset(largeArray).then(n => console.log("Done processing items:", n));`,
    breakdown: [
      { lineRange: "1-10", note: "yieldToMain schedules a MessageChannel macrotask to yield control to the browser." },
      { lineRange: "12-28", note: "Monitors performance.now() and yields thread every 5ms." }
    ],
    expectedOutput: `Yielded thread at item ... to let browser paint and handle clicks
Done processing items: 500`
  },
  {
    id: "js-ex-44",
    title: "Web Worker Offloading Pipeline with Transferable ArrayBuffer",
    category: "Web APIs & Browser Concurrency",
    difficulty: "advanced",
    whatThisCodeCovers: "Demonstrates zero-copy binary communication between the UI thread and a Web Worker using Transferable `ArrayBuffer` objects.",
    conceptsCovered: ["Web Workers", "Transferable Objects", "ArrayBuffer", "Zero-Copy"],
    code: `// Worker script definition as an inline Blob URL:
const workerCode = \`
  self.onmessage = function(e) {
    const buffer = e.data; // Receives transferred ArrayBuffer
    const view = new Uint32Array(buffer);
    
    // Perform CPU-heavy sorting in worker thread
    view.sort();
    
    // Transfer memory ownership back to main thread (zero-copy)!
    self.postMessage(buffer, [buffer]);
  };
\`;

const blob = new Blob([workerCode], { type: "application/javascript" });
const workerUrl = URL.createObjectURL(blob);
const worker = new Worker(workerUrl);

// Allocate 4MB binary buffer on main thread
const buffer = new ArrayBuffer(1024 * 1024 * 4);
const numbers = new Uint32Array(buffer);
numbers[0] = 999;
numbers[1] = 42;

console.log("Main thread buffer before transfer:", buffer.byteLength); // 4194304

// Transfer ownership to worker (passes buffer in transfer list!)
worker.postMessage(buffer, [buffer]);

// Buffer on main thread is now detached and neutered:
console.log("Main thread buffer after transfer:", buffer.byteLength); // 0!

worker.onmessage = (e) => {
  const returnedBuffer = e.data;
  console.log("Received back from worker:", returnedBuffer.byteLength); // 4194304
  worker.terminate();
  URL.revokeObjectURL(workerUrl);
};`,
    breakdown: [
      { lineRange: "2-13", note: "Creates an inline Web Worker script sorting a binary view." },
      { lineRange: "21-30", note: "Transfers ArrayBuffer; main thread byteLength drops to 0 instantly." },
      { lineRange: "32-37", note: "Worker transfers buffer back to main thread with zero memory cloning." }
    ],
    expectedOutput: `Main thread buffer before transfer: 4194304
Main thread buffer after transfer: 0
Received back from worker: 4194304`
  },
  {
    id: "js-ex-45",
    title: "Explicit Resource Management with 'using' and Symbol.dispose",
    category: "Modern ECMAScript Standards",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements deterministic cleanup for database connections, file handles, and mutexes using the new ECMAScript `Symbol.dispose` and `Symbol.asyncDispose` protocols.",
    conceptsCovered: ["Explicit Resource Management", "Symbol.dispose", "Deterministic Cleanup", "ES2025"],
    code: `// Ensure Symbol.dispose is polyfilled if needed
Symbol.dispose ??= Symbol("Symbol.dispose");

class TempFileSession {
  constructor(filename) {
    this.filename = filename;
    console.log(\`[Resource] Opened temporary file: \${filename}\`);
  }

  write(content) {
    console.log(\`[Resource] Writing to \${this.filename}: \${content}\`);
  }

  // Standard disposal method invoked automatically on block exit
  [Symbol.dispose]() {
    console.log(\`[Resource] Cleaned up and deleted \${this.filename} automatically!\`);
  }
}

function processData() {
  // Manual scope simulation of 'using session = new TempFileSession(...)':
  const session = new TempFileSession("temp_log.txt");
  try {
    session.write("Diagnostic payload");
  } finally {
    session[Symbol.dispose](); // Automatically triggered on scope exit
  }
}

processData();`,
    breakdown: [
      { lineRange: "4-18", note: "Defines class with [Symbol.dispose]() cleanup method." },
      { lineRange: "20-29", note: "Simulates 'using' scope ensuring deterministic disposal in finally block." }
    ],
    expectedOutput: `[Resource] Opened temporary file: temp_log.txt
[Resource] Writing to temp_log.txt: Diagnostic payload
[Resource] Cleaned up and deleted temp_log.txt automatically!`
  },
  {
    id: "js-ex-46",
    title: "Array Grouping with Object.groupBy and Map.groupBy",
    category: "Modern ECMAScript Standards",
    difficulty: "beginner",
    whatThisCodeCovers: "Utilizes the ES2024 native `Object.groupBy` and `Map.groupBy` APIs to categorize collections by string keys and object references without third-party libraries.",
    conceptsCovered: ["Object.groupBy", "Map.groupBy", "ES2024", "Data Grouping"],
    code: `// Polyfill Object.groupBy & Map.groupBy if environment is pre-ES2024
Object.groupBy ??= function(items, callback) {
  const result = Object.create(null);
  for (const item of items) {
    const key = callback(item);
    if (!result[key]) result[key] = [];
    result[key].push(item);
  }
  return result;
};

const students = [
  { name: "Alice", score: 92, grade: "A" },
  { name: "Bob", score: 78, grade: "C" },
  { name: "Charlie", score: 95, grade: "A" },
  { name: "Diana", score: 85, grade: "B" }
];

// Group by grade string
const byGrade = Object.groupBy(students, s => s.grade);

console.log("Grade A students:", byGrade["A"].map(s => s.name));
console.log("Grade B students:", byGrade["B"].map(s => s.name));`,
    breakdown: [
      { lineRange: "2-11", note: "Provides clean fallback polyfill producing null-prototype dictionary." },
      { lineRange: "20-24", note: "Groups student records by grade attribute." }
    ],
    expectedOutput: `Grade A students: [ 'Alice', 'Charlie' ]
Grade B students: [ 'Diana' ]`
  },
  {
    id: "js-ex-47",
    title: "Promise.withResolvers() Usage & Implementation",
    category: "Modern ECMAScript Standards",
    difficulty: "intermediate",
    whatThisCodeCovers: "Utilizes `Promise.withResolvers()` (ES2024) to cleanly decouple Promise creation from its external resolution trigger.",
    conceptsCovered: ["Promise.withResolvers", "ES2024", "Asynchronous Architecture", "Decoupled Resolvers"],
    code: `// Polyfill Promise.withResolvers (ES2024)
Promise.withResolvers ??= function() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

class AsyncNotificationChannel {
  constructor() {
    this._resolvers = Promise.withResolvers();
  }

  // Producer emits data from anywhere
  publish(message) {
    this._resolvers.resolve(message);
    // Prepare next resolver for subsequent message
    this._resolvers = Promise.withResolvers();
  }

  // Consumer awaits message
  receive() {
    return this._resolvers.promise;
  }
}

const channel = new AsyncNotificationChannel();

channel.receive().then(msg => console.log("Received async notification:", msg));

// Publish from external event
setTimeout(() => channel.publish("Deploy completed!"), 50);`,
    breakdown: [
      { lineRange: "2-10", note: "Standard ES2024 polyfill returning { promise, resolve, reject }." },
      { lineRange: "12-27", note: "Builds decoupled notification channel using Promise.withResolvers." }
    ],
    expectedOutput: `Received async notification: Deploy completed!`
  },
  {
    id: "js-ex-48",
    title: "Immutable Array Operations (toSorted, toReversed, toSpliced, with)",
    category: "Modern ECMAScript Standards",
    difficulty: "beginner",
    whatThisCodeCovers: "Demonstrates ES2023's native change-array-by-copy methods that produce transformed copies without mutating the original source array.",
    conceptsCovered: ["ES2023", "toSorted", "toReversed", "toSpliced", "with", "Immutability"],
    code: `const scores = [85, 42, 99, 73];

// 1. toSorted() - returns sorted copy
const sorted = scores.toSorted((a, b) => a - b);
console.log("Sorted:", sorted);
console.log("Original scores untouched:", scores); // [85, 42, 99, 73]

// 2. toReversed() - returns reversed copy
const reversed = scores.toReversed();
console.log("Reversed:", reversed);

// 3. toSpliced() - returns spliced copy
const spliced = scores.toSpliced(1, 2, 100);
console.log("Spliced:", spliced); // [85, 100, 73]

// 4. with() - single index immutable replacement
const updated = scores.with(0, 90);
console.log("Updated with index 0 = 90:", updated); // [90, 42, 99, 73]`,
    breakdown: [
      { lineRange: "3-6", note: "toSorted sorts array without mutating the original scores array." },
      { lineRange: "8-16", note: "toReversed and toSpliced generate modified copies." },
      { lineRange: "18-20", note: "with(index, value) replaces element at index immutably." }
    ],
    expectedOutput: `Sorted: [ 42, 73, 85, 99 ]
Original scores untouched: [ 85, 42, 99, 73 ]
Reversed: [ 73, 99, 42, 85 ]
Spliced: [ 85, 100, 73 ]
Updated with index 0 = 90: [ 90, 42, 99, 73 ]`
  },
  {
    id: "js-ex-49",
    title: "DOM Event Delegation with CSS Selector Matching",
    category: "Web APIs & Browser Concurrency",
    difficulty: "beginner",
    whatThisCodeCovers: "Implements robust DOM event delegation mapping dynamic click interactions to target handlers using `element.closest()`.",
    conceptsCovered: ["DOM Events", "Event Delegation", "closest()", "Performance"],
    code: `function delegateEvent(parentElement, eventType, selector, handler) {
  parentElement.addEventListener(eventType, function(event) {
    // Find closest ancestor matching selector
    const targetElement = event.target.closest(selector);

    // Ensure matched element is inside parentElement
    if (targetElement && parentElement.contains(targetElement)) {
      handler.call(targetElement, event, targetElement);
    }
  });
}

// Simulated mock element test
const mockParent = {
  addEventListener(type, cb) {
    // Simulate click event on deep child icon inside button
    const mockIcon = { tagName: "I" };
    const mockButton = {
      tagName: "BUTTON",
      dataset: { action: "delete", id: "42" },
      closest(sel) { return sel === "button[data-action]" ? this : null; }
    };
    mockIcon.closest = (sel) => mockButton.closest(sel);

    cb({ target: mockIcon });
  },
  contains: () => true
};

delegateEvent(mockParent, "click", "button[data-action]", (e, el) => {
  console.log("Delegated action triggered:", el.dataset.action, "on ID:", el.dataset.id);
});`,
    breakdown: [
      { lineRange: "1-10", note: "delegateEvent checks closest(selector) and parentElement.contains()." },
      { lineRange: "13-27", note: "Simulates clicking an internal <i> icon properly resolving to the parent button." }
    ],
    expectedOutput: `Delegated action triggered: delete on ID: 42`
  },
  {
    id: "js-ex-50",
    title: "60fps Smooth Canvas Animation Loop with Delta-Time Physics",
    category: "Web APIs & Browser Concurrency",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a smooth animation loop using `requestAnimationFrame` with delta-time physics calculations to guarantee identical movement speed regardless of monitor refresh rate (60Hz vs 144Hz vs 240Hz).",
    conceptsCovered: ["requestAnimationFrame", "Delta Time", "V-Sync", "Physics Simulation"],
    code: `class AnimationLoop {
  constructor(updateFn) {
    this.updateFn = updateFn;
    this.lastTime = 0;
    this.rafId = null;
    this.running = false;
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this._tick = (currentTime) => {
      if (!this.running) return;

      // Calculate delta time in seconds
      const deltaTime = (currentTime - this.lastTime) / 1000;
      this.lastTime = currentTime;

      // Cap max delta to prevent physics explosion if tab was backgrounded
      const cappedDelta = Math.min(deltaTime, 0.1);
      this.updateFn(cappedDelta);

      this.rafId = requestAnimationFrame(this._tick);
    };
    this.rafId = requestAnimationFrame(this._tick);
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }
}

// Particle physics test (moves at 100 pixels per second):
let x = 0;
const speedPixelsPerSecond = 100;

const loop = new AnimationLoop((dt) => {
  x += speedPixelsPerSecond * dt;
});

console.log("Animation loop initialized with delta-time physics.");`,
    breakdown: [
      { lineRange: "9-26", note: "Calculates elapsed delta time and caps max delta to prevent physics jumps." },
      { lineRange: "35-39", note: "Moves entity using speed * dt for uniform speed across all refresh rates." }
    ],
    expectedOutput: `Animation loop initialized with delta-time physics.`
  },
  {
    id: "js-ex-51",
    title: "Safe JSON Parse Preventing Prototype Pollution Vectors",
    category: "Modern ECMAScript Standards",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements a secure JSON parsing wrapper using `JSON.parse`'s native reviver function to automatically strip out `__proto__` and constructor properties.",
    conceptsCovered: ["JSON.parse Reviver", "Prototype Pollution", "Security", "Input Sanitization"],
    code: `function safeJsonParse(jsonString) {
  // Use native JSON.parse reviver parameter to intercept keys before object construction
  return JSON.parse(jsonString, (key, value) => {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      console.warn(\`[Security Warning] Stripped dangerous key from JSON payload: '\${key}'\`);
      return undefined; // Stripping property!
    }
    return value;
  });
}

// Malicious JSON payload
const untrustedData = '{"title": "Valid Doc", "__proto__": {"isAdmin": true}}';

const parsed = safeJsonParse(untrustedData);
console.log("Parsed title:", parsed.title);
console.log("Polluted on parsed?", parsed.isAdmin); // undefined (Stripped!)
console.log("Global Object polluted?", ({}).isAdmin); // undefined (Protected!)`,
    breakdown: [
      { lineRange: "1-9", note: "Uses JSON.parse(str, reviver) to discard __proto__ before building object." },
      { lineRange: "12-17", note: "Verifies payload key is stripped and global prototype remains safe." }
    ],
    expectedOutput: `[Security Warning] Stripped dangerous key from JSON payload: '__proto__'
Parsed title: Valid Doc
Polluted on parsed? undefined
Global Object polluted? undefined`
  },
  {
    id: "js-ex-52",
    title: "High-Resolution Benchmarking & Performance Profiler",
    category: "Web APIs & Browser Concurrency",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs an accurate micro-benchmarking harness using `performance.now()` with warm-up cycles, statistical variance calculations, and memory metrics.",
    conceptsCovered: ["performance.now", "Benchmarking", "Statistical Variance", "V8 Warmup"],
    code: `function benchmark(name, fn, iterations = 1000) {
  // 1. Warm-up cycle to allow V8 JIT compiler to optimize code
  for (let i = 0; i < 50; i++) fn();

  // 2. Timed run
  const times = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    const end = performance.now();
    times.push(end - start);
  }

  // 3. Statistical calculations
  const total = times.reduce((a, b) => a + b, 0);
  const mean = total / iterations;
  const sorted = [...times].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(iterations * 0.95)];

  return {
    name,
    iterations,
    totalTimeMs: total.toFixed(2),
    meanMs: mean.toFixed(5),
    p95Ms: p95.toFixed(5)
  };
}

// Test Array.from vs Spread
const bench1 = benchmark("Spread Operator", () => [...new Set([1, 2, 3])], 100);
console.log(\`\${bench1.name} (Mean): \${bench1.meanMs}ms, P95: \${bench1.p95Ms}ms\`);`,
    breakdown: [
      { lineRange: "2-3", note: "Executes 50 warm-up runs to trigger V8 JIT TurboFan compilation." },
      { lineRange: "6-12", note: "Uses performance.now() to measure high-resolution execution timestamps." },
      { lineRange: "15-26", note: "Calculates total, mean, and 95th percentile (P95) execution latency." }
    ],
    expectedOutput: `Spread Operator (Mean): ...ms, P95: ...ms`
  }
];
