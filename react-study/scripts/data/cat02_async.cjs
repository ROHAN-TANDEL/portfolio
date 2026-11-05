const { makeItem } = require('../builder_helper.cjs');

const category = "2. Asynchronous Model & Microtask Queues";

const items = [
  makeItem({
    idNum: 16,
    category,
    concept: "Microtasks vs Macrotasks Execution Order",
    priority: "must-know",
    difficulty: "Foundational",
    question: "What is the difference between microtasks and macrotasks in Node.js?",
    quickAnswer: "Microtasks (process.nextTick, Promises) drain with top priority after the current call stack; macrotasks (timers, I/O, setImmediate) run in designated event loop phases.",
    answer: "In Node.js, asynchronous operations are divided into two distinct queues: 1) Microtask Queue: consists of `process.nextTick()` and resolved Promise reactions (`.then()`, `.catch()`, `.finally()`, and `queueMicrotask()`). They are processed immediately when the current JavaScript call stack empties, before the event loop advances. 2) Macrotask Queue: consists of tasks managed by libuv event loop phases, including Timers (`setTimeout`, `setInterval`), I/O callbacks, and `setImmediate()` (Check phase).",
    explanation: "Microtasks ALWAYS take precedence over macrotasks. If a microtask schedules another microtask, all nested microtasks must be completely drained before the next macrotask can execute.",
    code: "// Demonstrating execution precedence:\nconsole.log('1. Synchronous script start');\n\nsetTimeout(() => console.log('4. Macrotask: setTimeout'), 0);\n\nPromise.resolve().then(() => console.log('3. Microtask: Promise.then'));\n\nprocess.nextTick(() => console.log('2. Microtask: process.nextTick'));\n\nconsole.log('1. Synchronous script end');\n\n// Output Order:\n// 1. Synchronous script start\n// 1. Synchronous script end\n// 2. Microtask: process.nextTick\n// 3. Microtask: Promise.then\n// 4. Macrotask: setTimeout",
    recallHint: "Call Stack -> process.nextTick -> Promise Microtasks -> Next Event Loop Macrotask.",
    interviewTip: "Candidate trap: Believing process.nextTick runs on the next tick of the event loop. In reality, it runs immediately after the current operation, before the next tick begins.",
    tags: ["microtasks", "macrotasks", "event-loop", "promises", "nexttick"]
  }),

  makeItem({
    idNum: 17,
    category,
    concept: "process.nextTick() Mechanics & Precedence",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How does process.nextTick() work, and why does it take precedence over Promise microtasks?",
    quickAnswer: "process.nextTick() writes to an internal Node.js nextTickQueue that V8 drains completely before examining the Promise microtask queue.",
    answer: "`process.nextTick()` is a Node.js-specific API (not part of the ECMAScript standard). It adds callbacks to an internal array called `nextTickQueue`. When the current synchronous execution context finishes, Node.js checks `nextTickQueue` and drains all pending callbacks before it processes the V8 Promise microtask queue.",
    explanation: "Common use cases for `process.nextTick()`: 1) Allowing a constructor to finish initialization before triggering an event listener callback, 2) Allowing user code to attach event listeners before an asynchronous operation emits events, and 3) Error handling simplification.",
    code: "import { EventEmitter } from 'node:events';\n\nclass DataEmitter extends EventEmitter {\n  constructor() {\n    super();\n    // Using nextTick allows the caller to attach listeners before the event fires!\n    process.nextTick(() => {\n      this.emit('ready', { timestamp: Date.now() });\n    });\n  }\n}\n\nconst emitter = new DataEmitter();\n// Listener is attached synchronously AFTER constructor, but catches the event because of nextTick:\nemitter.on('ready', (data) => console.log('Received ready event:', data));",
    recallHint: "process.nextTick() drains before Promise microtasks; useful for emitting events after constructor initialization.",
    interviewTip: "Highlight the classic EventEmitter pattern where nextTick guarantees listeners are attached before events are emitted.",
    tags: ["nexttick", "event-emitter", "microtasks", "priority"]
  }),

  makeItem({
    idNum: 18,
    category,
    concept: "queueMicrotask() vs process.nextTick()",
    priority: "important",
    difficulty: "Intermediate",
    question: "What is the difference between queueMicrotask() and process.nextTick()?",
    quickAnswer: "queueMicrotask() is standard cross-platform JavaScript (same as Promise.resolve().then()); process.nextTick() is Node.js-specific and has higher priority.",
    answer: "`queueMicrotask()` was introduced as a standardized, cross-platform ECMAScript/Web API to enqueue microtasks in both Node.js and browsers without creating Promise instances. `process.nextTick()` is a legacy Node.js-specific API. Under the hood, `process.nextTick()` executes before `queueMicrotask()` because Node.js drains the `nextTickQueue` prior to the standard microtask queue.",
    explanation: "Modern Node.js recommendation: For cross-platform isomorphic code (running in browser and Node.js), use `queueMicrotask()`. For Node.js-specific event emitter scheduling requiring highest priority, use `process.nextTick()`.",
    code: "// Execution priority between queueMicrotask and nextTick:\nqueueMicrotask(() => console.log('2. queueMicrotask (Standard Web API)'));\nprocess.nextTick(() => console.log('1. process.nextTick (Node.js nextTickQueue)'));\n\n// Output:\n// 1. process.nextTick\n// 2. queueMicrotask",
    recallHint: "process.nextTick() runs first; queueMicrotask() runs with standard Promise microtasks (cross-platform).",
    interviewTip: "Emphasize writing isomorphic code: prefer queueMicrotask in shared libraries meant for both browser and Node.js runtimes.",
    tags: ["queuemicrotask", "nexttick", "standards", "isomorphic"]
  }),

  makeItem({
    idNum: 19,
    category,
    concept: "Event Loop Microtask Interleaving (Node 11+)",
    priority: "must-know",
    difficulty: "Advanced",
    question: "How did Node.js 11 change the execution order of microtasks between event loop callbacks?",
    quickAnswer: "Node 11 aligned with the HTML5 browser spec: microtasks now drain immediately after each individual macrotask callback, rather than at phase transitions.",
    answer: "Prior to Node.js 11, the event loop would execute ALL callbacks in a given phase queue (e.g., all expired `setTimeout` callbacks) before draining the microtask queue. In Node.js 11+, Node aligned with the Web/browser standard: the microtask queue is now drained immediately after EACH INDIVIDUAL macrotask callback finishes, even if more callbacks remain in the same phase queue.",
    explanation: "This resolved subtle timing discrepancies between Node.js and browser environments and ensures Promise reactions execute as quickly as possible.",
    code: "// Behavior in Node.js 11+ (matches browser behavior):\nsetTimeout(() => {\n  console.log('Timeout 1');\n  Promise.resolve().then(() => console.log('Promise inside Timeout 1'));\n}, 0);\n\nsetTimeout(() => {\n  console.log('Timeout 2');\n}, 0);\n\n// Node 11+ Output:\n// Timeout 1\n// Promise inside Timeout 1 (Microtask drains immediately!)\n// Timeout 2\n\n// (In legacy Node 10 and earlier, Output was: Timeout 1, Timeout 2, Promise)",
    recallHint: "Node 11+ drains microtasks after EVERY individual callback, not at phase boundaries.",
    interviewTip: "Knowing this historic behavioral change demonstrates deep historical understanding of the Node.js event loop evolution.",
    tags: ["node11", "microtasks", "interleaving", "event-loop"]
  }),

  makeItem({
    idNum: 20,
    category,
    concept: "setImmediate() vs setTimeout(fn, 0)",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "What is the difference between setImmediate() and setTimeout(fn, 0), and when is execution deterministic?",
    quickAnswer: "setImmediate runs in the Check phase; setTimeout(fn, 0) runs in the Timers phase. Inside an I/O callback, setImmediate ALWAYS executes first.",
    answer: "`setTimeout(fn, 0)` schedules a callback in the Timers phase after a minimum delay of 1ms (Node clamps 0ms to 1ms). `setImmediate(fn)` schedules a callback in the Check phase, which runs immediately after the Poll phase. At the top level of a main script, their execution order is non-deterministic because it depends on the operating system clock accuracy and process startup speed.",
    explanation: "However, inside any I/O cycle (e.g. inside `fs.readFile` or a network callback), `setImmediate` is GUARANTEED to execute before `setTimeout(fn, 0)`. This is because the I/O callback executes in the Poll phase; from Poll, the event loop advances directly to Check (executing setImmediate) before cycling back to Timers.",
    code: "import fs from 'node:fs';\n\n// Inside an I/O callback, order is 100% deterministic:\nfs.readFile(new URL(import.meta.url), () => {\n  setTimeout(() => console.log('2. setTimeout (Timers phase)'), 0);\n  setImmediate(() => console.log('1. setImmediate (Check phase)'));\n  // Guaranteed Output:\n  // 1. setImmediate (Check phase always runs before next Timers phase!)\n  // 2. setTimeout\n});",
    recallHint: "Inside I/O: setImmediate ALWAYS beats setTimeout(0). At top level: non-deterministic clock drift.",
    interviewTip: "This is one of the most common senior Node.js interview screening questions. Always mention the Poll -> Check phase transition.",
    tags: ["setimmediate", "settimeout", "timers", "check-phase", "poll-phase"]
  }),

  makeItem({
    idNum: 21,
    category,
    concept: "Event Loop Starvation through Microtask Recursion",
    priority: "must-know",
    difficulty: "Advanced",
    question: "What is event loop starvation, and how does recursive microtask scheduling cause it?",
    quickAnswer: "Starvation occurs when the microtask queue continuously enqueues new tasks, preventing the event loop from ever advancing to I/O or timers.",
    answer: "Event loop starvation happens when the main thread is monopolized by tasks that never allow the event loop to advance to the Poll phase. Because Node.js guarantees that the microtask queue (especially `process.nextTick`) must be completely empty before the next event loop phase can begin, recursively scheduling microtasks creates an infinite loop in the microtask layer.",
    explanation: "During microtask starvation, all incoming HTTP connections stall, existing timers never expire, and file descriptors are never serviced. To yield control back to the event loop in recursive loops, use `setImmediate()` instead of `process.nextTick()`.",
    code: "// Infinite Microtask Starvation (Freezes Server):\n// function recursiveTick() {\n//   process.nextTick(recursiveTick); // Blocks event loop permanently!\n// }\n\n// Safe Concurrency (Yields to the Event Loop):\nfunction safeRecursiveProcess(items) {\n  if (items.length === 0) return;\n  const item = items.shift();\n  // Process item...\n  setImmediate(() => safeRecursiveProcess(items)); // Yields to Poll phase for I/O!\n}",
    recallHint: "Recursive nextTick/Promises starve the loop; setImmediate yields to the event loop every cycle.",
    interviewTip: "Point out that batch background processing scripts in Node should always use setImmediate to yield CPU time back to network I/O.",
    tags: ["starvation", "event-loop", "setimmediate", "nexttick", "concurrency"]
  }),

  makeItem({
    idNum: 22,
    category,
    concept: "Unhandled Promise Rejections in Node.js",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How does Node.js handle unhandled promise rejections, and what does --unhandled-rejections=strict do?",
    quickAnswer: "In modern Node.js (v15+), unhandled rejections terminate the process with exit code 1 by default (--unhandled-rejections=strict).",
    answer: "An unhandled promise rejection occurs when a Promise rejects and has no `.catch()` handler or `try...catch` block attached within the current tick. Historically, Node.js merely printed a deprecation warning and continued running in a degraded state. In Node.js 15+, the default behavior changed to `strict`, meaning any unhandled rejection immediately throws an unhandled exception and crashes the process with non-zero exit code 1.",
    explanation: "This fail-fast behavior prevents applications from running in an inconsistent or corrupt state (e.g., halfway through a database transaction). You can listen to `process.on('unhandledRejection', ...)` for custom telemetry before exiting.",
    code: "// Catching unhandled rejections globally:\nprocess.on('unhandledRejection', (reason, promise) => {\n  console.error('Unhandled Promise Rejection detected:', reason);\n  // Recommended: log error, flush telemetry, and exit process gracefully\n  process.exit(1);\n});\n\n// Trigger rejection:\nPromise.reject(new Error('Database connection failed'));",
    recallHint: "Modern Node crashes by default on unhandled rejections (strict mode). Always catch or listen globally.",
    interviewTip: "Never advise suppressing unhandled rejections; explain that running with unhandled state leads to silent data corruption in production.",
    tags: ["promises", "unhandledrejection", "error-handling", "process"]
  }),

  makeItem({
    idNum: 23,
    category,
    concept: "Uncaught Exceptions & Process Stability",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "Why should a Node.js process restart after catching an uncaughtException?",
    quickAnswer: "Because an uncaught exception leaves the application in an indeterminate, corrupted state where memory, sockets, or closures may be compromised.",
    answer: "When a synchronous error is thrown and not caught by any `try...catch` block, it bubbles up to `process.on('uncaughtException')`. The official Node.js documentation strictly mandates that when an `uncaughtException` occurs, the process MUST restart. Continuing to run is dangerous because the runtime cannot guarantee that object memory, database connections, or mutexes are in a safe state.",
    explanation: "Best practice: Log the fatal error with stack trace, trigger a quick 1-second timeout to close active HTTP server handles, and call `process.exit(1)`. Rely on process managers (PM2, Docker, Kubernetes) to spawn a fresh, clean instance.",
    code: "process.on('uncaughtException', (err, origin) => {\n  console.error(`Fatal Uncaught Exception (${origin}):`, err);\n  \n  // Clean shutdown attempt\n  setTimeout(() => {\n    process.exit(1); // Force exit if graceful shutdown hangs\n  }, 1000).unref();\n\n  // Exit immediately\n  process.exit(1);\n});\n\n// Synchronous throw with no catch:\nnonExistentFunction();",
    recallHint: "uncaughtException = Corrupted state. Log, flush, and process.exit(1). Let orchestrator restart.",
    interviewTip: "Highlight that trying to resume execution after uncaughtException causes memory leaks and unpredictable cascading failures.",
    tags: ["uncaughtexception", "reliability", "crash", "process-manager"]
  }),

  makeItem({
    idNum: 24,
    category,
    concept: "Async/Await Desugaring & Stack Trace Preservation",
    priority: "important",
    difficulty: "Advanced",
    question: "How does V8 implement async/await under the hood, and how does zero-cost async stack traces work?",
    quickAnswer: "V8 compiles async functions into generators yielding promises; zero-cost stack traces reconstruct async call stacks using Promise reaction metadata.",
    answer: "Under the hood, `async/await` is syntactic sugar over generator functions and Promise reactions. When an `await` expression is evaluated, V8 captures the current execution context, wraps the expression in `Promise.resolve()`, suspends function execution, and returns control to the caller. When the promise resolves, V8 resumes execution at the exact suspension point.",
    explanation: "Historically, asynchronous callbacks lost their parent stack traces. V8 implemented 'Zero-Cost Async Stack Traces' by walking the chain of awaited Promise reaction records stored in V8 memory without adding runtime performance overhead during normal happy-path execution.",
    code: "async function fetchUserData(userId) {\n  const user = await db.findUser(userId); // Suspends execution until resolved\n  const orders = await db.findOrders(user.id);\n  return { user, orders };\n}\n\n// V8 captures clean async stack trace across both awaits on error:\n// Error: DB Connection Failed\n//   at db.findUser (/app/db.js:14:9)\n//   at async fetchUserData (/app/services.js:2:16)",
    recallHint: "async/await = Generators + Promises; V8 reconstructs async stack traces via Promise reactions.",
    interviewTip: "Mention that awaiting in a loop runs serially, whereas Promise.all runs concurrent awaits.",
    tags: ["async-await", "v8", "stack-traces", "generators"]
  }),

  makeItem({
    idNum: 25,
    category,
    concept: "Promise.all vs Promise.allSettled vs Promise.race",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "When should you choose Promise.all, Promise.allSettled, or Promise.race in Node.js backend services?",
    quickAnswer: "Promise.all fails fast on first error; Promise.allSettled waits for all outcomes; Promise.race returns the fastest result.",
    answer: "1) `Promise.all`: Executes multiple promises concurrently. Fails fast—if ANY single promise rejects, the entire aggregate rejects immediately, ignoring remaining promises. Ideal when all sub-tasks are mandatory (e.g. creating an order and transaction). 2) `Promise.allSettled`: Waits for ALL promises to complete, returning an array of `{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }`. Ideal for independent batch jobs (e.g. sending 100 email notifications). 3) `Promise.race`: Resolves or rejects as soon as the FASTEST promise settles. Commonly used for request timeouts.",
    explanation: "In Node.js 15+, `Promise.any` was also introduced, which resolves on the first SUCCESSFUL promise and only rejects if ALL promises fail.",
    code: "// Request timeout using Promise.race:\nfunction withTimeout(promise, timeoutMs = 5000) {\n  const timeout = new Promise((_, reject) => {\n    setTimeout(() => reject(new Error('Operation timed out')), timeoutMs);\n  });\n  return Promise.race([promise, timeout]);\n}\n\n// Batch operations with Promise.allSettled:\nconst results = await Promise.allSettled([\n  sendEmail('user1@test.com'),\n  sendEmail('user2@test.com')\n]);\nconst failed = results.filter(r => r.status === 'rejected');",
    recallHint: "Promise.all = All or nothing (fail fast); allSettled = Complete report; race = First to finish.",
    interviewTip: "Candidate gotcha: In Promise.all, if one promise rejects, background promises may STILL continue running unless explicitly cancelled via AbortSignal.",
    tags: ["promises", "promise-all", "promise-allsettled", "concurrency"]
  }),

  makeItem({
    idNum: 26,
    category,
    concept: "AbortController & AbortSignal in Asynchronous APIs",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How is AbortController used for cancellation across Node.js core modules?",
    quickAnswer: "AbortController emits an abort event via AbortSignal, allowing cooperative cancellation of HTTP requests, timers, streams, and child processes.",
    answer: "Node.js adopted the standard `AbortController` and `AbortSignal` APIs across its entire core library (Node 16+). When an operation is initiated (such as `fetch()`, `fs.readFile()`, `stream.pipeline()`, or `http.request()`), an `{ signal }` option can be passed. Calling `abortController.abort()` emits the `'abort'` event, prompting the runtime to immediately cancel pending I/O, abort network sockets, and reject the promise with an `AbortError`.",
    explanation: "This is crucial in backend engineering to prevent 'zombie work'—if a client disconnects an HTTP request, the backend should abort ongoing database queries and upstream API calls to conserve resources.",
    code: "// Cancelling an async operation after 2 seconds:\nconst ac = new AbortController();\nconst timeout = setTimeout(() => ac.abort(), 2000);\n\ntry {\n  const res = await fetch('https://api.example.com/huge-dataset', {\n    signal: ac.signal\n  });\n  const data = await res.json();\n} catch (err) {\n  if (err.name === 'AbortError') {\n    console.warn('Request was cleanly aborted due to timeout.');\n  }\n} finally {\n  clearTimeout(timeout);\n}",
    recallHint: "AbortController provides standard cooperative cancellation for fetch, streams, fs, and timers.",
    interviewTip: "Explain how passing req.signal from an incoming Express/Fastify request down to database calls prevents waste when clients cancel.",
    tags: ["abortcontroller", "abortsignal", "cancellation", "fetch", "streams"]
  }),

  makeItem({
    idNum: 27,
    category,
    concept: "Async Generators & for await...of Iteration",
    priority: "important",
    difficulty: "Intermediate",
    question: "How do async generators and for await...of loops simplify asynchronous stream processing?",
    quickAnswer: "Async generators yield promises sequentially, allowing stream chunks and paginated APIs to be consumed using clean synchronous-looking loops.",
    answer: "An async generator (`async function*`) produces an asynchronous iterator that yields values wrapped in Promises. The `for await...of` loop pauses execution until each yielded promise resolves, managing the stream's internal backpressure automatically. Node.js Readable streams are natively asynchronous iterables.",
    explanation: "Consuming a stream with `for await...of` is cleaner than manual `.on('data')` listeners because backpressure is automatically handled: the loop will not pull the next chunk until the current loop iteration finishes.",
    code: "import { createReadStream } from 'node:fs';\n\n// Consuming file stream with automatic backpressure:\nasync function processFile(filePath) {\n  const stream = createReadStream(filePath, { encoding: 'utf8' });\n  \n  for await (const chunk of stream) {\n    // Backpressure handled: stream pauses reading while this async work runs!\n    await processChunkInDatabase(chunk);\n  }\n  console.log('File fully processed.');\n}",
    recallHint: "for await...of on Readable streams provides automatic backpressure and clean sequential consumption.",
    interviewTip: "Highlight that for await...of automatically respects stream backpressure, unlike raw stream.on('data') listeners.",
    tags: ["async-generators", "iterators", "streams", "backpressure"]
  }),

  makeItem({
    idNum: 28,
    category,
    concept: "Callback Hell vs Promises vs Async/Await Evolution",
    priority: "foundational",
    difficulty: "Foundational",
    question: "How did asynchronous error handling and control flow evolve from callbacks to modern async/await?",
    quickAnswer: "Callbacks had error-first inversion of control (callback hell); Promises provided chainable composability; async/await provided synchronous readability.",
    answer: "1) Callbacks: Used the 'error-first' convention `(err, data) => {}`. Deep nesting led to 'Pyramid of Doom' (callback hell), difficult error bubbling, and inversion of control. 2) Promises: Introduced in ES6, encapsulated future values with `.then()` and `.catch()`, enabling linear chaining and centralized error handling. 3) Async/Await: Introduced in ES2017, syntactic sugar allowing asynchronous code to be written with standard `try...catch` blocks and linear flow while retaining non-blocking execution.",
    explanation: "Node.js provides `node:util.promisify` to instantly convert legacy error-first callback APIs into modern Promise-returning functions.",
    code: "import fs from 'node:fs';\nimport { promisify } from 'node:util';\n\n// Legacy callback:\nfs.readFile('file.txt', (err, data) => {\n  if (err) return console.error(err);\n  console.log(data);\n});\n\n// Converted via promisify to modern async/await:\nconst readFileAsync = promisify(fs.readFile);\nconst data = await readFileAsync('file.txt');",
    recallHint: "Error-first callbacks -> Promise chaining -> Async/await with try/catch. Use util.promisify to bridge.",
    interviewTip: "Mention that promisify relies on the standard (err, result) convention; APIs that do not follow this require custom wrapper promises.",
    tags: ["evolution", "callbacks", "promises", "promisify"]
  }),

  makeItem({
    idNum: 29,
    category,
    concept: "Asynchronous Context Propagation Challenges",
    priority: "important",
    difficulty: "Advanced",
    question: "Why do asynchronous operations in Node.js lose their execution context across await boundaries?",
    quickAnswer: "Because each await yields execution back to the event loop, detaching subsequent callbacks from thread-local variables.",
    answer: "In traditional multi-threaded languages (Java, C#), each request runs on a dedicated OS thread where thread-local storage (`ThreadLocal`) easily stores user identity, transactions, and request IDs. In Node.js, thousands of concurrent requests interleave on the same single thread. When an asynchronous operation awaits a database call, execution suspends, and the thread serves other requests before returning.",
    explanation: "Consequently, global or module-scoped variables cannot store per-request state. To solve this without parameter drilling, Node.js introduced `node:async_hooks` and `AsyncLocalStorage` to preserve context across asynchronous boundaries.",
    code: "// Anti-pattern: Module-level variable is corrupted across concurrent requests!\nlet currentUserId;\n\nexport async function handleRequest(userId) {\n  currentUserId = userId; // Concurrently overwritten by another request during await!\n  await db.query();\n  console.log(`Processing for: ${currentUserId}`); // Bug: Prints wrong user!\n}\n// Solution: Use AsyncLocalStorage instead of module variables.",
    recallHint: "Node single thread interleaves requests; module variables leak across await ticks. Use AsyncLocalStorage.",
    interviewTip: "This is the classic concurrency trap for developers transitioning from Java/Spring to Node.js.",
    tags: ["context", "asynclocalstorage", "concurrency", "threadlocal"]
  })
];

module.exports = items;
