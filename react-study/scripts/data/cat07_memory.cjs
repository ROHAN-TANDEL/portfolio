const { makeItem } = require('../builder_helper.cjs');

const category = "7. Memory Lifecycle, V8 Heap & Garbage Collection";

const items = [
  makeItem({
    idNum: 84,
    category,
    concept: "V8 Memory Layout (RSS, Heap Used, Heap Total, External)",
    priority: "must-know",
    difficulty: "Foundational",
    question: "What is the difference between RSS, Heap Total, Heap Used, and External memory in process.memoryUsage()?",
    quickAnswer: "RSS is total OS RAM for the process; Heap Total is V8 allocated memory; Heap Used is actual JS objects; External is C++ Buffers.",
    answer: "Calling `process.memoryUsage()` returns four critical metrics: 1) `rss` (Resident Set Size): The total physical RAM allocated to the Node.js process by the OS kernel, including V8 heap, C++ code, and thread stacks. 2) `heapTotal`: The total memory V8 has committed from the OS for JavaScript objects. 3) `heapUsed`: The actual memory currently occupied by active JavaScript objects. 4) `external`: Memory bound to C++ objects managed outside the V8 heap (primarily Node.js `Buffer` instances and C++ addon memory). 5) `arrayBuffers`: Memory allocated for ArrayBuffers/SharedArrayBuffers.",
    explanation: "If `external` is high, your application is buffering binary data or streams. If `heapUsed` climbs continuously without dropping after GC, you have a JavaScript memory leak.",
    code: "// Memory introspection in MB:\nconst formatMB = (bytes) => (bytes / 1024 / 1024).toFixed(2) + ' MB';\nconst mem = process.memoryUsage();\n\nconsole.log({\n  rss: formatMB(mem.rss),\n  heapTotal: formatMB(mem.heapTotal),\n  heapUsed: formatMB(mem.heapUsed),\n  external: formatMB(mem.external)\n});",
    recallHint: "RSS = Total OS RAM; HeapTotal = V8 allocated; HeapUsed = Active JS objects; External = C++ Buffers.",
    interviewTip: "Candidate trap: Confusing heapUsed with RSS. A process can have 50MB heapUsed but 800MB RSS due to Buffer allocations or native C++ libraries.",
    tags: ["memory", "rss", "heapused", "heaptotal", "external", "v8"]
  }),

  makeItem({
    idNum: 85,
    category,
    concept: "V8 Generational Garbage Collection: Young vs Old Generation",
    priority: "must-know",
    difficulty: "Advanced",
    question: "How does V8's Generational Garbage Collection hypothesis work (Young vs Old Generation)?",
    quickAnswer: "Most objects die young (The Generational Hypothesis); V8 divides memory into Young Generation (frequent fast Scavenge) and Old Generation (infrequent Mark-Sweep).",
    answer: "V8's garbage collector is built on the Generational Hypothesis: most objects die shortly after creation (short-lived variables, function scopes). To optimize performance, V8 divides the heap into two main generations: 1) Young Generation: Holds freshly allocated objects, small in size (16MB-64MB), collected frequently with minimal pauses using the Scavenge algorithm. 2) Old Generation: Holds objects that have survived two Young Generation GC cycles ('promoted' objects) and long-lived singletons, collected infrequently using the Mark-Sweep-Compact algorithm.",
    explanation: "This generational separation avoids scanning the entire multi-gigabyte heap on every minor allocation, ensuring fast sub-millisecond minor GC pauses.",
    code: "// Short-lived object (Lives and dies in Young Generation):\nfunction processRequest() {\n  const temp = { id: 1, timestamp: Date.now() }; // Collected in fast Scavenge GC\n}\n\n// Long-lived object (Survives Scavenge and gets promoted to Old Generation):\nconst globalCache = new Map(); // Promoted to Old Generation; stays until app shutdown",
    recallHint: "Young Generation = Fast frequent Scavenge GC; Old Generation = Promoted survivors, Mark-Sweep-Compact.",
    interviewTip: "Always mention the 'Generational Hypothesis' when explaining why V8 separates heap generations.",
    tags: ["garbage-collection", "generational-gc", "young-generation", "old-generation", "v8"]
  }),

  makeItem({
    idNum: 86,
    category,
    concept: "Scavenge GC & Cheney's Copying Algorithm",
    priority: "important",
    difficulty: "Advanced",
    question: "How does the Minor GC (Scavenge) collect memory in the Young Generation using Cheney's copying algorithm?",
    quickAnswer: "The Young Generation is split into From-Space and To-Space; live objects are copied to To-Space while dead objects are abandoned.",
    answer: "The Young Generation is divided into two equally sized semi-spaces: `From-Space` and `To-Space`. New objects are allocated in `From-Space`. When `From-Space` fills up, Minor GC (Scavenge) is triggered: 1) V8 traces object references starting from root pointers, 2) Surviving (live) objects are copied contiguously into `To-Space` (which automatically defragments memory), 3) Any dead objects left in `From-Space` are abandoned en masse, and 4) The roles of `From-Space` and `To-Space` are swapped.",
    explanation: "If an object survives a second Scavenge cycle, it is promoted to the Old Generation. Because Scavenge only visits live objects (which are few in the young space), it is blazingly fast (1-3ms).",
    code: "// Scavenge in action:\n// [ From-Space (Allocations) ] ---> Scavenge triggers ---> [ To-Space (Copied Survivors) ]\n// Dead objects are cleared in O(1) time simply by swapping pointers!",
    recallHint: "Scavenge copies live objects between From-Space and To-Space; dead memory is abandoned instantly.",
    interviewTip: "Highlight that copying live objects automatically compacts memory without an expensive defragmentation pass.",
    tags: ["scavenge", "minor-gc", "from-space", "to-space", "v8"]
  }),

  makeItem({
    idNum: 87,
    category,
    concept: "Mark-Sweep-Compact Algorithm (Major GC)",
    priority: "must-know",
    difficulty: "Advanced",
    question: "How does the Major GC (Mark-Sweep-Compact) reclaim memory in the Old Generation?",
    quickAnswer: "It marks live reachable objects from roots, sweeps (reclaims) unmarked dead memory, and compacts remaining fragmented pages.",
    answer: "When the Old Generation exceeds dynamic capacity thresholds, V8 initiates a Major GC (Mark-Sweep-Compact): 1) Marking: V8 traverses the entire object reference graph starting from root pointers (global variables, active call stacks, DOM/C++ bindings) and marks all reachable objects as live. 2) Sweeping: V8 iterates through the heap memory pages, identifying all memory addresses that were NOT marked, and adds their pointers to free-lists for future allocations. 3) Compacting: To prevent memory fragmentation (where free memory is scattered in small chunks unable to fit large objects), V8 shifts surviving objects contiguously, updating all memory pointers.",
    explanation: "Because full compaction is slow, V8 only compacts heavily fragmented pages, leaving unfragmented pages swept in place.",
    code: "// Major GC is triggered when Old Generation approaches limits:\n// $ node --trace-gc server.js\n// [1234:0x104000] 1500 ms: Mark-sweep 120.4 (135.2) -> 85.2 (110.1) MB, 14.2 / 0.0 ms",
    recallHint: "Mark (find live objects) -> Sweep (free dead memory addresses) -> Compact (defragment pages).",
    interviewTip: "Explain why Major GC pauses are longer than Minor GC pauses: Major GC must traverse the entire heap graph.",
    tags: ["major-gc", "mark-sweep", "compact", "garbage-collection", "v8"]
  }),

  makeItem({
    idNum: 88,
    category,
    concept: "Concurrent, Incremental & Parallel GC Optimizations",
    priority: "important",
    difficulty: "Advanced",
    question: "How does modern V8 prevent long 'Stop-The-World' GC pauses using Incremental Marking and Concurrent Sweeping?",
    quickAnswer: "Incremental marking breaks GC work into tiny chunks interleaved with JS execution; concurrent background threads sweep memory in parallel.",
    answer: "Historically, Major GC was a 'Stop-The-World' event: JavaScript execution was completely paused for 100ms-500ms while the GC ran, causing major latency spikes in web APIs. Modern V8 (Orinoco project) virtually eliminates long pauses using: 1) Incremental Marking: V8 breaks the marking phase into tiny 1ms increments interleaved between normal JavaScript execution, 2) Concurrent Marking: Background helper threads traverse and mark the object graph while the main JavaScript thread continues running concurrently, and 3) Parallel & Concurrent Sweeping: Background threads sweep dead memory pages without blocking the main event loop.",
    explanation: "This reduced typical Major GC pause times from hundreds of milliseconds to under 5ms-15ms.",
    code: "// Orinoco GC execution model:\n// Main Thread:   [JS Code] -> [Mark 1ms] -> [JS Code] -> [Quick Pause 5ms]\n// Worker Thread 1: ---------[Concurrent Marking]-----------------------\n// Worker Thread 2: -------------------------[Concurrent Sweeping]------",
    recallHint: "Incremental marking splits pauses; concurrent background threads mark and sweep while JS runs.",
    interviewTip: "Mention the 'Orinoco' GC project in V8 to showcase expert-level knowledge of modern runtime optimizations.",
    tags: ["orinoco", "incremental-marking", "concurrent-gc", "v8", "latency"]
  }),

  makeItem({
    idNum: 89,
    category,
    concept: "--max-old-space-size & Node.js Memory Limits",
    priority: "must-know",
    difficulty: "Foundational",
    question: "What is --max-old-space-size and what happens when a Node.js process exceeds it?",
    quickAnswer: "It configures the maximum V8 Old Generation memory ceiling (in MB); exceeding it triggers an immediate OOM process crash.",
    answer: "By default on 64-bit systems, V8 historically capped Old Generation memory to ~1.4GB-2GB (in modern Node.js, it defaults to roughly half or three-quarters of available container RAM up to ~4GB). If an application attempts to allocate more heap memory than this limit, V8 executes multiple aggressive fallback Major GCs. If memory cannot be freed, the process crashes immediately with `FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory`.",
    explanation: "Configuration: Use `--max-old-space-size=N` (in MB) at launch to raise or lower the ceiling (e.g. `node --max-old-space-size=8192 server.js` for an 8GB heap).",
    code: "// Setting heap limit via command line:\n// $ node --max-old-space-size=4096 app.js\n\n// Inspecting configured heap limit in code:\nimport v8 from 'node:v8';\nconst heapStats = v8.getHeapStatistics();\nconsole.log(`Max Heap Limit: ${(heapStats.heap_size_limit / 1024 / 1024).toFixed(0)} MB`);",
    recallHint: "node --max-old-space-size=N (in MB) sets V8 heap ceiling. Exceeding it crashes with OOM error.",
    interviewTip: "Warning for Docker/Kubernetes: Setting max-old-space-size higher than the container RAM limit causes the Linux OOM Killer (exit code 137) to kill the container abruptly.",
    tags: ["max-old-space-size", "oom", "heap-limit", "v8", "kubernetes"]
  }),

  makeItem({
    idNum: 90,
    category,
    concept: "Common Memory Leak 1: Unbounded Closures",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How do JavaScript closures cause accidental memory leaks in Node.js?",
    quickAnswer: "A long-lived closure sharing a lexical scope retains large variables from that scope even if the closure never uses them.",
    answer: "In JavaScript, closures retain references to their outer lexical environment. If two closures are created in the same parent scope, V8 shares a single lexical environment object between them. If one closure is exported to a long-lived scope (e.g. global cache or event listener) and the second closure references a massive 100MB buffer, the entire lexical environment object remains retained in memory, preventing the 100MB buffer from ever being garbage collected.",
    explanation: "This is known as the Meteor 'Meteor Leaks' / shared scope closure leak. Solution: Explicitly set unused large variables to `null` before creating long-lived callbacks.",
    code: "// The Shared Scope Closure Memory Leak:\nlet leakedHolder = null;\n\nfunction leakGenerator() {\n  const largeBuffer = new Array(10000000); // 10 million items\n\n  // Closure 1 (uses largeBuffer, never exported):\n  function unused() {\n    if (largeBuffer) return true;\n  }\n\n  // Closure 2 (retained globally, does NOT use largeBuffer, but shares the lexical scope!):\n  leakedHolder = function() {\n    return 'Hello';\n  };\n}\n// Every call to leakGenerator() permanently leaks 10 million items into RAM!",
    recallHint: "Closures sharing a lexical environment retain all variables referenced in that scope. Clear large vars with null.",
    interviewTip: "Explaining how V8 shares lexical environments between closures in the same parent function is a hallmark of senior JS expertise.",
    tags: ["memory-leak", "closures", "lexical-scope", "v8"]
  }),

  makeItem({
    idNum: 91,
    category,
    concept: "Common Memory Leak 2: Dangling EventEmitter Listeners",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "Why does adding event listeners inside request handlers cause memory leaks and MaxListenersExceededWarnings?",
    quickAnswer: "Attaching listeners to long-lived emitters (db, redis, process) inside short-lived request handlers keeps closures and req in memory forever.",
    answer: "In Node.js, `EventEmitter` instances maintain arrays of callback functions. If you attach a listener to a long-lived object (such as a database connection pool, global event bus, or `process`) inside an HTTP request handler without removing it, every incoming request adds a new function reference to the array.",
    explanation: "Because each listener closure captures the `req` and `res` objects of that request, thousands of old requests and their associated memory cannot be garbage collected. When listener count exceeds 10, Node prints `MaxListenersExceededWarning: Possible EventEmitter memory leak detected`.",
    code: "// MEMORY LEAK:\nimport { EventEmitter } from 'node:events';\nconst globalBus = new EventEmitter();\n\napp.get('/user', (req, res) => {\n  // Leaky: Adds a new listener on EVERY request; req/res never garbage collected!\n  globalBus.on('notification', () => {\n    res.send('Got update');\n  });\n});\n\n// FIX: Use once() or removeListener in res.on('close'):\napp.get('/user-safe', (req, res) => {\n  const handler = () => res.send('Got update');\n  globalBus.on('notification', handler);\n  res.on('close', () => globalBus.removeListener('notification', handler)); // Cleaned up!\n});",
    recallHint: "Never attach listeners to global emitters inside request handlers without removing them on res.on('close').",
    interviewTip: "Never advise simply calling emitter.setMaxListeners(0) to silence the warning; explain that it masks the underlying leak.",
    tags: ["memory-leak", "eventemitter", "maxlistenersexceededwarning", "cleanup"]
  }),

  makeItem({
    idNum: 92,
    category,
    concept: "Common Memory Leak 3: Global Variables & Unbounded Caches",
    priority: "must-know",
    difficulty: "Foundational",
    question: "Why are in-memory objects/Maps without eviction policies dangerous in production Node.js services?",
    quickAnswer: "They act as root pointers in the GC graph; entries grow unbounded with traffic, consuming RAM until an OOM crash occurs.",
    answer: "Because global variables and module-level variables are reachable from the root pointers of the V8 garbage collector, anything stored inside them is NEVER garbage collected. Using a standard JavaScript `new Map()` or object literal `{}` as an in-memory cache without an eviction policy (like LRU - Least Recently Used) or Time-To-Live (TTL) is guaranteed to leak memory as user traffic scales.",
    explanation: "Solution: 1) Use an LRU Cache library (e.g. `lru-cache`) with a hard `max` item ceiling or memory limit, 2) Offload caching to external distributed stores (Redis, Memcached), or 3) Use `WeakMap` if keys are object references.",
    code: "// ANTI-PATTERN (Unbounded Memory Leak):\nconst cache = new Map();\nexport function getCachedUser(id, userData) {\n  cache.set(id, userData); // Grows infinitely until process crashes!\n  return cache.get(id);\n}\n\n// PRODUCTION BEST PRACTICE (Bounded LRU Cache):\nimport { LRUCache } from 'lru-cache';\nconst safeCache = new LRUCache({\n  max: 5000, // Maximum 5,000 items in RAM\n  ttl: 1000 * 60 * 5 // Auto-evict items after 5 minutes\n});",
    recallHint: "Plain Maps/Objects grow unbounded; always use bounded LRU caches with max entries and TTL limits.",
    interviewTip: "Differentiate between in-process memory caching (fast, but memory-constrained) and external caching (Redis, scalable across horizontal pods).",
    tags: ["memory-leak", "lru-cache", "caching", "unbounded-map", "redis"]
  }),

  makeItem({
    idNum: 93,
    category,
    concept: "Programmatic Heap Snapshots (node:v8)",
    priority: "must-know",
    difficulty: "Advanced",
    question: "How do you capture a V8 heap snapshot programmatically in a production Node.js service without stopping it?",
    quickAnswer: "Use v8.getHeapSnapshot() to stream the complete V8 memory graph into a file for analysis in Chrome DevTools.",
    answer: "In production containers, you cannot easily attach an interactive Chrome DevTools debugger. Modern Node.js provides `node:v8.getHeapSnapshot()`, which returns a Readable stream representing the full serialization of all active JavaScript objects in the V8 heap at that exact moment.",
    explanation: "Workflow: 1) Expose an administrative endpoint or listen for an OS signal (`SIGUSR2`), 2) Call `v8.getHeapSnapshot()`, 3) Stream the snapshot to disk or upload to AWS S3, and 4) Load the `.heapsnapshot` file into Chrome DevTools Memory tab for retainer analysis.",
    code: "import v8 from 'node:v8';\nimport fs from 'node:fs';\nimport { pipeline } from 'node:stream/promises';\n\nexport async function captureHeapDump(filePath = `heap-${Date.now()}.heapsnapshot`) {\n  console.log('Capturing V8 heap snapshot to:', filePath);\n  const snapshotStream = v8.getHeapSnapshot();\n  const fileStream = fs.createWriteStream(filePath);\n  await pipeline(snapshotStream, fileStream);\n  console.log('Heap snapshot successfully saved.');\n}\n\n// Trigger via POSIX signal:\nprocess.on('SIGUSR2', () => captureHeapDump());",
    recallHint: "v8.getHeapSnapshot() streams V8 memory graph to .heapsnapshot file; inspect in Chrome DevTools Memory tab.",
    interviewTip: "Warn that taking a heap snapshot pauses the main thread for 1-5 seconds while serializing gigabytes of memory; take pods out of rotation first.",
    tags: ["heap-snapshot", "v8", "debugging", "memory-leak", "diagnostics"]
  }),

  makeItem({
    idNum: 94,
    category,
    concept: "Heap Profiling & Retainer Tree Analysis in Chrome DevTools",
    priority: "must-know",
    difficulty: "Advanced",
    question: "How do you analyze a heap snapshot in Chrome DevTools to locate the root cause of a memory leak?",
    quickAnswer: "Compare snapshots using the 3-Snapshot technique, sort by Retained Size, and inspect the Retainer Tree down to the GC root.",
    answer: "The industry standard workflow for isolating memory leaks is the 3-Snapshot Technique: 1) Take Snapshot 1 (Baseline: after app startup), 2) Apply load (e.g. 10,000 HTTP requests via Autocannon) and wait for load to stop, then take Snapshot 2, 3) Wait 30 seconds for GC and take Snapshot 3. If memory is leaking, Snapshot 3 will have significantly higher retained size than Snapshot 1.",
    explanation: "In Chrome DevTools: Select Snapshot 3, switch the view dropdown to 'Objects allocated between Snapshot 1 and 2'. Sort by 'Retained Size' (total memory freed if this object is deleted). Expand the object's 'Retainers' tree: look for the chain of parent references leading all the way up to a global variable, listener, or closure.",
    code: "// Key metrics in Chrome DevTools Memory Tab:\n// Shallow Size: Memory held directly by the object itself (e.g. primitive values)\n// Retained Size: Memory held by the object + all other objects kept alive through it\n// Retainer Graph: The path from GC Root (window/global) holding the object in RAM",
    recallHint: "Take 3 snapshots; sort by Retained Size; trace Retainer tree to identify what root keeps the object alive.",
    interviewTip: "Explain the vital distinction between Shallow Size (tiny) and Retained Size (huge, includes entire subtree).",
    tags: ["chrome-devtools", "retainers", "shallow-size", "retained-size", "profiling"]
  }),

  makeItem({
    idNum: 95,
    category,
    concept: "Analyzing V8 Garbage Collection Traces (--trace-gc)",
    priority: "important",
    difficulty: "Intermediate",
    question: "What does the --trace-gc flag output and what does 'Ineffective mark-compacts' indicate?",
    quickAnswer: "--trace-gc logs every GC event with pause duration and heap delta; 'ineffective mark-compacts' means Major GC is failing to free memory.",
    answer: "Launching Node with `node --trace-gc server.js` prints real-time telemetry whenever V8 runs a Minor or Major GC event. Log format: `[PID] <timestamp> ms: <GC Type> <Heap Used Before> (<Heap Total Before>) -> <Heap Used After> (<Heap Total After>) MB, <Pause Duration> ms`.",
    explanation: "'Ineffective mark-compacts' warning: Indicates that V8 performed a full Major GC, but the amount of memory freed was negligible (< few percent), and heap usage is approaching `--max-old-space-size`. This is the immediate precursor to a fatal JavaScript heap out of memory crash.",
    code: "// Example --trace-gc log line:\n// [4892:0x103000] 1205 ms: Scavenge 24.5 (32.0) -> 12.1 (32.0) MB, 1.8 / 0.0 ms  (Fast minor GC!)\n// [4892:0x103000] 4500 ms: Mark-sweep 1350.2 (1400.0) -> 1345.1 (1400.0) MB, 120.4 ms (Warning: Ineffective!)",
    recallHint: "--trace-gc exposes Scavenge vs Mark-sweep pauses and heap deltas; highlights ineffective GCs before crashes.",
    interviewTip: "Mention that analyzing GC pause durations helps identify whether API tail latency spikes are caused by GC pauses.",
    tags: ["trace-gc", "diagnostics", "v8", "telemetry", "latency"]
  }),

  makeItem({
    idNum: 96,
    category,
    concept: "WeakRef & FinalizationRegistry for Memory Tracking",
    priority: "good-to-know",
    difficulty: "Advanced",
    question: "What are WeakRef and FinalizationRegistry in modern JavaScript and when are they used in Node.js?",
    quickAnswer: "WeakRef holds a reference without preventing garbage collection; FinalizationRegistry registers cleanup callbacks when objects are GC'd.",
    answer: "1) `WeakRef`: Holds a weak reference to a target object. It allows you to reference an object without preventing the V8 garbage collector from reclaiming it if no strong references exist. 2) `FinalizationRegistry`: Allows you to register a callback that fires after a target object has been collected by the garbage collector.",
    explanation: "Use cases: Building memory-sensitive caches that let the GC evict unused entries when under memory pressure, or tracking down memory leaks in test suites by asserting that objects are properly cleaned up.",
    code: "// Monitoring object garbage collection:\nconst registry = new FinalizationRegistry((heldValue) => {\n  console.log(`Object with key [${heldValue}] was successfully garbage collected!`);\n});\n\nfunction createTemporaryUser() {\n  let user = { id: 101, name: 'Alice' };\n  registry.register(user, 'User#101');\n  // user goes out of scope here; will be collected on next GC!\n}\ncreateTemporaryUser();",
    recallHint: "WeakRef doesn't block GC; FinalizationRegistry notifies when an object has been garbage collected.",
    interviewTip: "Caution: Do not use FinalizationRegistry for critical business logic, as GC timing is unpredictable and not guaranteed.",
    tags: ["weakref", "finalizationregistry", "garbage-collection", "memory"]
  })
];

module.exports = items;
