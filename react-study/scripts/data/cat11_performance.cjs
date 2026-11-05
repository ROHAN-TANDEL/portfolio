const { makeItem } = require('../builder_helper.cjs');

const category = "11. Performance, Profiling & Observability";

const items = [
  makeItem({
    idNum: 131,
    category,
    concept: "AsyncLocalStorage & Context Propagation Internals",
    priority: "must-know",
    difficulty: "Advanced",
    question: "How does AsyncLocalStorage track execution contexts across asynchronous boundaries under the hood?",
    quickAnswer: "It hooks into V8's promise execution lifecycle via async_hooks, propagating a store reference across every await and then callback.",
    answer: "In Node.js, `AsyncLocalStorage` (from `node:async_hooks`) provides asynchronous continuation-local storage. It creates a store associated with the current asynchronous execution flow. When `asyncLocalStorage.run(store, callback)` is called, Node captures the store reference. Whenever an asynchronous operation (Promise, I/O callback, timer) is initiated within that scope, the underlying V8 promise execution hooks preserve and restore that exact store reference when the callback resumes.",
    explanation: "This allows request-level metadata (correlation IDs, tenant codes, authenticated user identity) to be accessed anywhere in deeply nested business logic without passing `req` down through function arguments.",
    code: "import { AsyncLocalStorage } from 'node:async_hooks';\n\nconst asyncLocalStorage = new AsyncLocalStorage();\n\n// 1. Establish context in middleware:\nexport function withRequestContext(requestId, fn) {\n  const store = new Map();\n  store.set('traceId', requestId);\n  return asyncLocalStorage.run(store, fn);\n}\n\n// 2. Read context anywhere in deep database or service layers:\nexport function getTraceId() {\n  const store = asyncLocalStorage.getStore();\n  return store ? store.get('traceId') : 'no-trace';\n}",
    recallHint: "AsyncLocalStorage uses V8 promise hooks to propagate stores across await ticks without parameter drilling.",
    interviewTip: "Mention that in early Node versions async_hooks had high overhead, but modern V8 optimized AsyncLocalStorage to < 1-2% CPU overhead.",
    tags: ["asynclocalstorage", "async-hooks", "tracing", "observability", "context"]
  }),

  makeItem({
    idNum: 132,
    category,
    concept: "Event Loop Delay Monitoring (perf_hooks.monitorEventLoopDelay)",
    priority: "must-know",
    difficulty: "Advanced",
    question: "How do you measure Event Loop Lag in real-time using perf_hooks.monitorEventLoopDelay()?",
    quickAnswer: "monitorEventLoopDelay() uses high-resolution C++ timers to record a histogram of event loop latency percentiles (p50, p99, max).",
    answer: "Event Loop Delay (Lag) is the primary indicator of Node.js performance degradation. It measures the delay between when a timer or I/O callback was scheduled to run and when the event loop actually picked it up. High lag means synchronous JavaScript is blocking the main thread.",
    explanation: "`node:perf_hooks.monitorEventLoopDelay({ resolution: 10 })` samples event loop delay at the C++ layer with sub-millisecond precision, maintaining a high-dynamic-range (HDR) histogram. Methods: `histogram.percentile(50)`, `histogram.percentile(99)`, and `histogram.max` return latency values in nanoseconds.",
    code: "import { monitorEventLoopDelay } from 'node:perf_hooks';\n\nconst histogram = monitorEventLoopDelay({ resolution: 10 });\nhistogram.enable();\n\nsetInterval(() => {\n  const p50Ms = histogram.percentile(50) / 1e6;\n  const p99Ms = histogram.percentile(99) / 1e6;\n  const maxMs = histogram.max / 1e6;\n\n  console.log(`Event Loop Lag -> p50: ${p50Ms.toFixed(2)}ms, p99: ${p99Ms.toFixed(2)}ms, Max: ${maxMs.toFixed(2)}ms`);\n  histogram.reset(); // Reset histogram for next interval\n}, 5000);",
    recallHint: "monitorEventLoopDelay records HDR histograms of event loop delay; p99 lag > 50ms indicates thread blockage.",
    interviewTip: "Candidate check: Always monitor p99 and max lag, not average lag, because averages mask severe intermittent latency spikes.",
    tags: ["event-loop-lag", "perf-hooks", "telemetry", "p99", "monitoring"]
  }),

  makeItem({
    idNum: 133,
    category,
    concept: "CPU Profiling & Flamegraph Analysis (--cpu-prof)",
    priority: "must-know",
    difficulty: "Advanced",
    question: "How do you generate and interpret a CPU profile / Flamegraph in Node.js to locate CPU bottlenecks?",
    quickAnswer: "Run with --cpu-prof to generate a .cpuprofile file; wide blocks on the Flamegraph indicate functions consuming the most CPU time.",
    answer: "When a Node.js process is experiencing 100% CPU utilization, CPU Profiling is used to identify hot functions. Launching Node with `node --cpu-prof app.js` causes the V8 sampling profiler to sample the call stack at regular intervals (default 1000 microseconds) and write a `.cpuprofile` JSON file upon process exit.",
    explanation: "How to interpret a Flamegraph in Chrome DevTools: The X-axis represents the percentage of total CPU time; the Y-axis represents the call stack depth. Wide bars represent functions that occupied the CPU for the longest time. Focus on 'Self Time' (time spent in the function body itself, rather than calling child functions).",
    code: "// Generating CPU profile on a running server programmatically via inspector:\nimport inspector from 'node:inspector/promises';\nimport fs from 'node:fs/promises';\n\nexport async function captureCpuProfile(durationMs = 5000) {\n  const session = new inspector.Session();\n  session.connect();\n  await session.post('Profiler.enable');\n  await session.post('Profiler.start');\n\n  await new Promise(r => setTimeout(r, durationMs)); // Sample under load\n\n  const { profile } = await session.post('Profiler.stop');\n  await fs.writeFile(`profile-${Date.now()}.cpuprofile`, JSON.stringify(profile));\n  session.disconnect();\n}",
    recallHint: "--cpu-prof generates .cpuprofile; wide horizontal bars in Chrome DevTools Flamegraph indicate CPU bottlenecks.",
    interviewTip: "Emphasize looking for 'Self Time' to distinguish between functions that do heavy work vs wrapper functions that merely call others.",
    tags: ["cpu-profiling", "flamegraph", "chrome-devtools", "performance", "inspector"]
  }),

  makeItem({
    idNum: 134,
    category,
    concept: "High-Performance Structured Logging with Pino",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "Why is Winston/console.log significantly slower than Pino in high-throughput Node.js microservices?",
    quickAnswer: "Pino serializes JSON synchronously in memory and writes asynchronously via sonic-boom worker threads, avoiding event loop stalls.",
    answer: "In high-throughput Node.js applications, logging is frequently the hidden bottleneck. `console.log()` and legacy Winston configurations perform synchronous formatting and blocking writes on the main thread, cutting API throughput by up to 50%-70%.",
    explanation: "`pino` achieves extreme speed by: 1) Performing JSON serialization in-process using optimized routines, 2) Offloading log formatting and pretty-printing to external processes (`pino-pretty`), and 3) Writing logs asynchronously through non-blocking OS buffers using `sonic-boom` without stalling the event loop.",
    code: "import pino from 'pino';\n\n// Fast asynchronous production logger:\nexport const logger = pino({\n  level: process.env.LOG_LEVEL || 'info',\n  base: { service: 'order-service', env: process.env.NODE_ENV },\n  timestamp: pino.stdTimeFunctions.isoTime\n}, pino.destination({ sync: false })); // Asynchronous destination\n\nlogger.info({ orderId: 'ord-123', amount: 99.5 }, 'Order processed successfully');",
    recallHint: "Pino writes asynchronously via sonic-boom; never run pretty-printing on the production main thread.",
    interviewTip: "Candidate check: Highlight that in production containers, logs should be raw JSON output to stdout for Datadog/ELK collectors to parse.",
    tags: ["pino", "logging", "performance", "structured-logging", "winston"]
  }),

  makeItem({
    idNum: 135,
    category,
    concept: "Distributed Tracing with OpenTelemetry W3C Trace Context",
    priority: "must-know",
    difficulty: "Advanced",
    question: "How does OpenTelemetry propagate distributed trace headers (traceparent) across microservices in Node.js?",
    quickAnswer: "OpenTelemetry extracts the W3C traceparent header, stores it in AsyncLocalStorage, and injects it into outbound HTTP requests.",
    answer: "Distributed tracing tracks a single user request as it traverses dozens of microservices, databases, and message queues. The W3C Trace Context specification defines the standard `traceparent` header: `00-<trace_id>-<parent_id>-<trace_flags>` (e.g. `00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01`).",
    explanation: "In Node.js, OpenTelemetry uses `AsyncLocalStorage` under the hood: when an incoming HTTP request arrives, the SDK extracts the `traceparent` header, starts a new Span with the same `trace_id`, and stores it in the async context. Whenever the app makes an outbound `fetch()` or database call, the SDK automatically injects the current trace ID into downstream headers.",
    code: "// W3C traceparent structure:\n// version-trace_id-parent_span_id-trace_flags\n// 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01\n\n// Reading active trace context programmatically:\n// import { trace } from '@opentelemetry/api';\n// const currentSpan = trace.getActiveSpan();\n// console.log('Active Trace ID:', currentSpan.spanContext().traceId);",
    recallHint: "W3C traceparent header + AsyncLocalStorage = Distributed trace propagation across microservices.",
    interviewTip: "Connecting AsyncLocalStorage directly to OpenTelemetry span propagation demonstrates real-world distributed systems depth.",
    tags: ["opentelemetry", "distributed-tracing", "w3c-trace-context", "spans", "microservices"]
  }),

  makeItem({
    idNum: 136,
    category,
    concept: "Optimizing JSON Serialization (fast-json-stringify)",
    priority: "important",
    difficulty: "Advanced",
    question: "Why is native JSON.stringify() slow and how does fast-json-stringify achieve 2x-5x speedups?",
    quickAnswer: "JSON.stringify inspects types dynamically at runtime; fast-json-stringify compiles a fixed JSON schema into dedicated C-style string concatenation code.",
    answer: "`JSON.stringify()` must dynamically inspect every object property, verify types, handle circular references, and escape strings at runtime on every single call. For large API responses (e.g. 500KB JSON arrays of products), this consumes significant CPU time on the single thread.",
    explanation: "`fast-json-stringify` (used by Fastify) requires a declared JSON Schema. It pre-compiles a dedicated JavaScript function specifically tailored to that schema using `new Function()`, stringifying fields via direct string concatenation without dynamic property reflection, achieving 2x to 5x higher throughput.",
    code: "import fastJson from 'fast-json-stringify';\n\n// Pre-compile schema into optimized stringifier:\nconst stringify = fastJson({\n  title: 'UserSchema',\n  type: 'object',\n  properties: {\n    id: { type: 'integer' },\n    name: { type: 'string' },\n    active: { type: 'boolean' }\n  }\n});\n\n// Up to 3x faster than JSON.stringify:\nconst json = stringify({ id: 101, name: 'Alice', active: true });",
    recallHint: "fast-json-stringify pre-compiles JSON Schemas into static string concatenators; used in Fastify for top speed.",
    interviewTip: "Explain why Fastify outperforms Express by 2x: pre-compiled schema validation (ajv) and serialization (fast-json-stringify).",
    tags: ["json-stringify", "fastify", "fast-json-stringify", "performance", "schemas"]
  }),

  makeItem({
    idNum: 137,
    category,
    concept: "Micro-Benchmarking Pitfalls & JIT Optimization Traps",
    priority: "important",
    difficulty: "Advanced",
    question: "Why are micro-benchmarks with for-loops misleading in Node.js due to V8 Dead Code Elimination?",
    quickAnswer: "V8's TurboFan compiler detects unused loop variables and optimizes the entire loop away to a no-op.",
    answer: "Writing micro-benchmarks like `const start = Date.now(); for(let i=0; i<1e6; i++) { calculate(); }` produces misleading results in JavaScript: 1) Dead Code Elimination: If the return value of `calculate()` is not used outside the loop, TurboFan compiler realizes the calculation has no side-effects and deletes the entire loop from the machine code! 2) Lack of JIT Warmup: V8 takes time to compile bytecode to TurboFan optimized machine code; measuring cold runs measures the Ignition interpreter, not production speed.",
    explanation: "Best practice: Use established benchmarking frameworks (Benchmark.js, Tinybench) that enforce JIT warmup cycles and consume return values to prevent dead code elimination.",
    code: "// DEAD CODE ELIMINATION TRAP:\nfunction benchmarkTrap() {\n  const start = performance.now();\n  for (let i = 0; i < 10000000; i++) {\n    const x = i * 2; // Unused variable! TurboFan deletes this entire loop!\n  }\n  console.log(`Finished in ${performance.now() - start}ms`); // Reports 0.01ms (Fake speed!)\n}",
    recallHint: "TurboFan deletes unused calculations via Dead Code Elimination. Use Tinybench with JIT warmup cycles.",
    interviewTip: "Candidate check: Call out that benchmarking an isolated 10-line function never reflects real-world performance under heavy production I/O.",
    tags: ["benchmarking", "dead-code-elimination", "turbofan", "v8", "microbenchmarks"]
  }),

  makeItem({
    idNum: 138,
    category,
    concept: "Load Testing Node.js with Autocannon",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How do you load test a Node.js server using Autocannon and what metrics determine maximum throughput?",
    quickAnswer: "Autocannon generates concurrent HTTP/pipelining load; key metrics are 2xx req/sec, p99 latency, and event loop lag under load.",
    answer: "Autocannon is a modern, HTTP/1.1 benchmarking tool written in Node.js that outperforms ApacheBench (`ab`) and `wrk`. It measures how a server handles thousands of concurrent connections.",
    explanation: "Execution: `autocannon -c 100 -d 30 http://localhost:3000` (100 concurrent connections for 30 seconds). Key metrics to evaluate: 1) Requests/sec (throughput), 2) Latency percentiles: p50, p90, and especially p99 (tail latency), 3) Non-2xx responses (detects whether server dropped requests or threw 500/503 errors).",
    code: "// Running Autocannon programmatically in test suites:\nimport autocannon from 'autocannon';\n\nconst instance = autocannon({\n  url: 'http://localhost:3000/api/users',\n  connections: 50, // 50 concurrent virtual users\n  duration: 10     // 10 seconds test\n}, (err, result) => {\n  console.log(`Requests/sec: ${result.requests.average}`);\n  console.log(`p99 Latency: ${result.latency.p99} ms`);\n});",
    recallHint: "Autocannon tests concurrent HTTP throughput; watch for p99 latency spikes and non-2xx error rates.",
    interviewTip: "Always measure CPU usage and memory RSS alongside Autocannon to verify the server didn't plateau due to CPU saturation.",
    tags: ["autocannon", "load-testing", "benchmarking", "p99", "throughput"]
  }),

  makeItem({
    idNum: 139,
    category,
    concept: "Diagnosing V8 Hidden Class Transitions (Monomorphic vs Megamorphic)",
    priority: "important",
    difficulty: "Advanced",
    question: "What are V8 Hidden Classes (Shapes) and how do dynamic property additions degrade function call site performance?",
    quickAnswer: "V8 creates hidden classes for object shapes; adding properties dynamically or in different orders forces slow megamorphic lookups.",
    answer: "JavaScript is dynamically typed, but V8 optimizes property access by generating internal C++ descriptors called 'Hidden Classes' (Shapes/Maps). Objects created with identical properties in the EXACT same order share the same hidden class, allowing TurboFan to access properties at fixed memory offsets using Inline Caches (ICs).",
    explanation: "If you add properties dynamically in varying orders (`obj.b = 1; obj.a = 2` vs `obj.a = 2; obj.b = 1`), V8 branches into new hidden classes. When a function receives objects with more than 4 different shapes (Megamorphic call site), TurboFan abandons inline caching and falls back to slow runtime hash-table lookups.",
    code: "// FAST (Monomorphic: All objects share the exact same hidden class shape):\nclass Point {\n  constructor(x, y) {\n    this.x = x; // Always initialize properties in the same order!\n    this.y = y;\n  }\n}\n\n// SLOW (Deoptimized: Dynamic property additions create differing hidden classes):\nconst p1 = {}; p1.x = 1; p1.y = 2;\nconst p2 = {}; p2.y = 2; p2.x = 1; // Different order -> Different hidden class!",
    recallHint: "Always initialize object properties in the same order; prevents hidden class transitions and megamorphic IC lookups.",
    interviewTip: "Advise initializing all optional fields in constructors with null rather than adding them later dynamically.",
    tags: ["hidden-classes", "shapes", "inline-cache", "monomorphic", "turbofan"]
  }),

  makeItem({
    idNum: 140,
    category,
    concept: "Native Node.js Performance Hooks (PerformanceObserver)",
    priority: "important",
    difficulty: "Intermediate",
    question: "How do you use PerformanceObserver in node:perf_hooks to measure function execution and resource timing?",
    quickAnswer: "Use performance.mark() and performance.measure(); observe entries with PerformanceObserver matching Web Performance APIs.",
    answer: "Node.js implements the W3C User Timing and Performance Timeline specifications via `node:perf_hooks`. It provides standard `performance.mark()` and `performance.measure()` APIs to profile internal code bottlenecks.",
    explanation: "`PerformanceObserver` asynchronously collects performance timeline entries (measures, function calls, HTTP timings) without adding overhead to the measured functions, making it ideal for continuous APM telemetry in production services.",
    code: "import { performance, PerformanceObserver } from 'node:perf_hooks';\n\n// 1. Setup observer:\nconst obs = new PerformanceObserver((items) => {\n  for (const entry of items.getEntries()) {\n    console.log(`[Metric] ${entry.name}: ${entry.duration.toFixed(2)} ms`);\n  }\n});\nobs.observe({ entryTypes: ['measure'] });\n\n// 2. Measure business operation:\nperformance.mark('db-query-start');\nawait new Promise(r => setTimeout(r, 45)); // Simulated DB query\nperformance.mark('db-query-end');\nperformance.measure('Database Query Duration', 'db-query-start', 'db-query-end');",
    recallHint: "performance.mark + measure + PerformanceObserver = Standard W3C performance metrics in Node.js.",
    interviewTip: "Highlight that PerformanceObserver decouples metric emission from metric consumption.",
    tags: ["perf-hooks", "performanceobserver", "user-timing", "metrics", "w3c"]
  }),

  makeItem({
    idNum: 141,
    category,
    concept: "V8 Inline Caches (ICs) & Polymorphism",
    priority: "important",
    difficulty: "Advanced",
    question: "What is an Inline Cache (IC) in V8 and what is the difference between monomorphic, polymorphic, and megamorphic code?",
    quickAnswer: "ICs cache memory offsets of object properties: Monomorphic (1 shape, fastest), Polymorphic (2-4 shapes, fast), Megamorphic (>4 shapes, slow).",
    answer: "An Inline Cache (IC) is a critical optimization in V8 that remembers the memory offset of an object property at a specific call site. 1) Monomorphic: The function always sees objects of the exact same hidden class shape. The property lookup compiles directly to a single C++ assembly instruction. 2) Polymorphic: The function encounters 2 to 4 different shapes. V8 checks a small cache of shapes. 3) Megamorphic: The function encounters 5 or more different shapes. V8 gives up caching and falls back to a slow global hash table lookup.",
    explanation: "Writing functions that consistently accept the same object shape ensures monomorphic inline caching and maximum TurboFan optimization.",
    code: "// Monomorphic function (Blazingly fast):\nfunction getFullName(user) {\n  return user.firstName + ' ' + user.lastName; // IC caches memory offsets for user shape\n}\n\n// If called with { firstName, lastName } millions of times -> Monomorphic!\n// If called with { firstName, lastName, age }, then { id, firstName, lastName }, etc. -> Degrades to Megamorphic!",
    recallHint: "Monomorphic = 1 shape (fastest); Polymorphic = 2-4 shapes; Megamorphic = 5+ shapes (slow hash lookup).",
    interviewTip: "Candidate check: Explain that TypeScript interfaces do NOT guarantee monomorphism at runtime if property declaration order varies in JS objects.",
    tags: ["inline-cache", "monomorphic", "megamorphic", "turbofan", "v8"]
  }),

  makeItem({
    idNum: 142,
    category,
    concept: "Backpressure Telemetry & Queue Depth Monitoring",
    priority: "important",
    difficulty: "Advanced",
    question: "What telemetry metrics should you export to Prometheus to monitor Node.js stream and task queue health?",
    quickAnswer: "Export stream buffer byte depth, event loop lag p99, active handles count, and task queue processing latency.",
    answer: "In production stream processing and async message consumer services (RabbitMQ, Kafka, SQS), silent degradation happens when incoming throughput exceeds processing capacity. Exporting key telemetry to Prometheus or Datadog allows automated scaling and alerting.",
    explanation: "Key metrics: 1) `nodejs_eventloop_lag_p99_milliseconds`: Spikes above 100ms indicate CPU blocking. 2) `nodejs_active_handles_total`: Tracks open connections and timers (detects socket leaks). 3) `queue_depth_items`: Measures pending in-memory tasks. 4) `stream_buffer_bytes_current`: Monitors writable stream buffer size to detect backpressure saturation before OOM crashes.",
    code: "// Prometheus custom metrics example (prom-client):\nimport client from 'prom-client';\n\nconst streamBufferGauge = new client.Gauge({\n  name: 'stream_buffer_bytes_current',\n  help: 'Current byte depth of stream writable buffer'\n});\n\n// Update gauge during stream backpressure:\n// streamBufferGauge.set(writable.writableLength);",
    recallHint: "Export event loop lag, active handles, queue depth, and stream writableLength to Prometheus.",
    interviewTip: "Emphasize setting alerts on rate of change: if queue depth or active handles climbs monotonically over 15 minutes, trigger a PagerDuty alert.",
    tags: ["prometheus", "telemetry", "observability", "queue-depth", "monitoring"]
  })
];

module.exports = items;
