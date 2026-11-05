const { makeItem } = require('../builder_helper.cjs');

const category = "1. Architecture, V8 & Libuv Internals";

const items = [
  makeItem({
    idNum: 1,
    category,
    concept: "Node.js Runtime Architecture",
    priority: "must-know",
    difficulty: "Foundational",
    question: "What is Node.js, and what are its core architectural components?",
    quickAnswer: "Node.js combines Chrome's V8 engine with libuv, C++ bindings, and core JS APIs to execute non-blocking, event-driven JavaScript on the server.",
    answer: "Node.js is an open-source, cross-platform JavaScript runtime environment built on Google's V8 engine. It executes JavaScript outside the browser using an event-driven, non-blocking I/O model supported by libuv for cross-platform asynchronous system operations.",
    explanation: "Architecturally, Node.js consists of: 1) V8 engine (compiles and executes JavaScript), 2) libuv (C library providing the event loop, thread pool, and non-blocking I/O), 3) C/C++ core bindings (binding Node.js internal features to OS system calls via OpenSSL, zlib, c-ares, llhttp), and 4) Core JavaScript standard library (fs, http, stream, path, events).",
    code: "// Node.js environment introspection:\nimport v8 from 'node:v8';\n\nconsole.log(`Node version: ${process.version}`);\nconsole.log(`Platform: ${process.platform} (${process.arch})`);\nconsole.log(`Libuv version: ${process.versions.uv}`);\nconsole.log(`V8 version: ${process.versions.v8}`);\nconsole.log(`V8 Heap limit: ${(v8.getHeapStatistics().heap_size_limit / 1024 / 1024).toFixed(0)} MB`);",
    recallHint: "Node.js = V8 (JS execution) + Libuv (Asynchronous I/O & Event Loop) + C++ Core Bindings + Standard Library.",
    interviewTip: "Interviewers want to see that you understand Node.js is NOT a framework or a language; it is a C++ runtime embedding the V8 engine.",
    tags: ["architecture", "v8", "libuv", "runtime"]
  }),

  makeItem({
    idNum: 2,
    category,
    concept: "V8 Engine Internals (Ignition & TurboFan)",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How does the V8 engine compile and execute JavaScript code in Node.js?",
    quickAnswer: "V8 parses JS into an AST, generates bytecode with the Ignition interpreter, and optimizes hot functions into machine code using TurboFan.",
    answer: "The V8 engine compiles JavaScript directly into native machine code. It uses a two-tier compilation pipeline: 1) Ignition: a fast interpreter that parses source code into an Abstract Syntax Tree (AST) and generates compact bytecode, and 2) TurboFan: an optimizing JIT compiler that monitors execution profiles ('hot code') and compiles heavily called functions into highly optimized native machine code.",
    explanation: "If a function receives unexpected data types that violate previous type assumptions (polymorphic or megamorphic call sites), TurboFan initiates 'deoptimization', discarding the optimized machine code and dropping execution back to Ignition bytecode. Writing monomorphic code allows TurboFan to generate the fastest machine code.",
    code: "// Monomorphic (TurboFan optimizes efficiently):\nfunction add(a, b) {\n  return a + b;\n}\nfor (let i = 0; i < 100000; i++) add(i, i + 1); // Fast: consistently receives integers\n\n// Deoptimized (Deopt occurs when types change dynamically):\nadd('hello', 'world'); // Violation of type feedback -> TurboFan deopts back to Ignition",
    recallHint: "Ignition compiles AST to Bytecode; TurboFan optimizes hot bytecode to Machine Code with type feedback.",
    interviewTip: "Mention that avoiding hidden class transitions and preserving monomorphic call sites prevents TurboFan deoptimization churn.",
    tags: ["v8", "turbofan", "ignition", "jit", "compiler"]
  }),

  makeItem({
    idNum: 3,
    category,
    concept: "Libuv Platform Abstraction Layer",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "What is libuv and what role does it play in the Node.js architecture?",
    quickAnswer: "libuv is a cross-platform C library that abstracts asynchronous I/O and provides Node.js with its event loop, thread pool, and OS event demultiplexing.",
    answer: "libuv is a high-performance C library designed specifically for Node.js to abstract asynchronous non-blocking I/O operations across different operating systems. It provides the event loop implementation, manages the background worker thread pool, and wraps OS-specific event demultiplexing mechanisms.",
    explanation: "libuv interfaces directly with OS-level polling mechanisms: epoll on Linux, kqueue on macOS/BSD, and IOCP (I/O Completion Ports) on Windows. It also provides abstractions for file system operations, child processes, asynchronous DNS resolution, signal handling, and high-resolution timers.",
    code: "// libuv exposes its underlying thread pool for certain operations:\n// UV_THREADPOOL_SIZE controls worker threads for fs, crypto, zlib, and dns.lookup\n// Example: Running 8 crypto hashes in parallel\nimport crypto from 'node:crypto';\n\nconst start = Date.now();\nfor (let i = 0; i < 8; i++) {\n  crypto.pbkdf2('password', 'salt', 100000, 512, 'sha512', () => {\n    console.log(`Task ${i + 1} completed at: ${Date.now() - start}ms`);\n  });\n}",
    recallHint: "libuv = Event Loop + Worker Thread Pool + OS Demultiplexing (epoll/kqueue/IOCP).",
    interviewTip: "Differentiate what libuv handles on the main thread via OS non-blocking notifications (networking) versus what it offloads to the worker thread pool (file system, crypto, zlib).",
    tags: ["libuv", "threads", "epoll", "kqueue", "iocp"]
  }),

  makeItem({
    idNum: 4,
    category,
    concept: "The 6 Event Loop Phases",
    priority: "must-know",
    difficulty: "Advanced",
    question: "What are the six phases of the Node.js event loop, and in what order do they execute?",
    quickAnswer: "Timers -> Pending Callbacks -> Idle/Prepare -> Poll -> Check -> Close Callbacks.",
    answer: "Each iteration of the libuv event loop progresses through six sequential phases: 1) Timers: executes callbacks from setTimeout() and setInterval(), 2) Pending Callbacks: executes deferred I/O callbacks from the previous loop iteration (e.g., TCP errors), 3) Idle, Prepare: internal libuv housekeeping, 4) Poll: retrieves new I/O events from the OS and blocks if needed, 5) Check: executes setImmediate() callbacks, and 6) Close Callbacks: executes close events like socket.on('close').",
    explanation: "The Poll phase is the heart of the loop. If the Poll queue is empty and there are setImmediate() callbacks waiting in the Check phase, the event loop advances immediately to Check. If no setImmediate() callbacks exist, the Poll phase blocks and waits for new incoming I/O events up to the smallest active timer threshold.",
    code: "// Demonstrating phase execution order:\nsetTimeout(() => console.log('1. Timers phase: setTimeout'), 0);\nsetImmediate(() => console.log('3. Check phase: setImmediate'));\nprocess.nextTick(() => console.log('0. Microtask queue: nextTick'));\n\n// Output:\n// 0. Microtask queue: nextTick (runs before loop advances)\n// 1. Timers phase: setTimeout\n// 3. Check phase: setImmediate",
    recallHint: "Phases: Timers -> Pending -> Idle/Prepare -> Poll -> Check -> Close.",
    interviewTip: "Emphasize that microtask queues (process.nextTick and Promise.then) drain after EVERY single callback in modern Node.js, not merely between phases.",
    tags: ["event-loop", "phases", "timers", "poll", "check"]
  }),

  makeItem({
    idNum: 5,
    category,
    concept: "Libuv Worker Thread Pool (UV_THREADPOOL_SIZE)",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "Which operations use the libuv worker thread pool and how is it configured?",
    quickAnswer: "File system operations, crypto, zlib compression, and dns.lookup use the thread pool (default 4 threads, configurable up to 1024 via UV_THREADPOOL_SIZE).",
    answer: "Because file systems across operating systems lack universal, non-blocking asynchronous APIs, libuv uses a background thread pool to make synchronous OS calls appear asynchronous to JavaScript. The operations that use the libuv thread pool are: 1) fs operations (fs.readFile, fs.writeFile, etc.), 2) crypto CPU-bound methods (pbkdf2, scrypt, randomBytes), 3) zlib compression methods, and 4) dns.lookup.",
    explanation: "Network I/O (http, net, dgram, tls) does NOT use the thread pool; it uses OS non-blocking sockets with epoll/kqueue. The default thread pool size is 4. It can be tuned at process startup using the environment variable `UV_THREADPOOL_SIZE=N` (up to 1024). It must be set before any Node.js code triggers asynchronous I/O.",
    code: "// Setting UV_THREADPOOL_SIZE via shell before launching Node:\n// $ UV_THREADPOOL_SIZE=16 node server.js\n\n// Demonstrating thread pool saturation:\nimport crypto from 'node:crypto';\n\n// 4 tasks run simultaneously on default 4 threads;\n// tasks 5-8 wait in line until threads free up!\nfor (let i = 1; i <= 8; i++) {\n  crypto.pbkdf2('pass', 'salt', 100000, 64, 'sha512', () => {\n    console.log(`Hash ${i} done`);\n  });\n}",
    recallHint: "Thread Pool covers: FS + Crypto + Zlib + dns.lookup. Default size = 4. Network I/O does NOT use it.",
    interviewTip: "Candidate mistake: Claiming network requests use the thread pool. Correct answer: Network sockets use non-blocking OS descriptors (epoll/kqueue).",
    tags: ["threadpool", "libuv", "concurrency", "uv_threadpool_size"]
  }),

  makeItem({
    idNum: 6,
    category,
    concept: "Single-Threaded Concurrency Model",
    priority: "must-know",
    difficulty: "Foundational",
    question: "How does Node.js handle thousands of concurrent requests if JavaScript is single-threaded?",
    quickAnswer: "Node.js delegates I/O to the OS kernel via non-blocking sockets and the libuv event loop, handling events reactively without blocking the main thread.",
    answer: "In Node.js, JavaScript executes on a single main thread (one call stack, one memory heap). However, Node.js achieves immense concurrency by offloading I/O operations to the operating system kernel. When a client connects or data arrives on a socket, the OS kernel notifies libuv via epoll/kqueue, which enqueues a callback into the event loop. The single thread quickly switches between callbacks rather than waiting synchronously for I/O to finish.",
    explanation: "This pattern is known as the Reactor Pattern. Concurrency is high for I/O-bound tasks because threads are never idle waiting on network or database responses. However, if the main thread performs a heavy CPU computation (e.g., synchronous JSON parsing or regex evaluation), it blocks the entire process.",
    code: "// Non-blocking concurrent requests:\nimport http from 'node:http';\n\nconst server = http.createServer((req, res) => {\n  // Database query initiated: callback registered, thread is instantly free for next request!\n  setTimeout(() => {\n    res.writeHead(200, { 'Content-Type': 'application/json' });\n    res.end(JSON.stringify({ status: 'ok', handledAt: Date.now() }));\n  }, 50);\n});\nserver.listen(3000);",
    recallHint: "Single-threaded JS execution; multi-threaded OS kernel I/O demultiplexing via the Reactor Pattern.",
    interviewTip: "Mention the 'Reactor Pattern' and contrast Node's event-driven model with the thread-per-request model used in Apache or legacy Tomcat servers.",
    tags: ["concurrency", "single-threaded", "reactor-pattern", "event-driven"]
  }),

  makeItem({
    idNum: 7,
    category,
    concept: "OS Event Demultiplexing: Epoll, Kqueue & IOCP",
    priority: "important",
    difficulty: "Advanced",
    question: "How do epoll, kqueue, and IOCP work under the hood in Node.js?",
    quickAnswer: "They are OS-level I/O notification mechanisms that monitor thousands of file descriptors and notify the process only when descriptors are ready for read/write.",
    answer: "Instead of having a thread actively poll every open network socket (which scales with O(N) overhead), modern operating systems provide event demultiplexers: epoll on Linux, kqueue on macOS/BSD, and IOCP on Windows. libuv registers file descriptors (FDs) with the OS kernel. The OS monitors the network hardware and wakes up the libuv event loop with an O(1) list of descriptors that are ready for reading or writing.",
    explanation: "This allows a single Node.js process to maintain 100,000+ open persistent socket connections (e.g. WebSockets) consuming virtually zero CPU while idle, only waking up when bytes actually arrive on the network card.",
    code: "// Under the hood, Node net.createServer uses epoll/kqueue:\nimport net from 'node:net';\n\nconst server = net.createServer((socket) => {\n  // Kernel triggers readable event when packets arrive in OS socket buffer\n  socket.on('data', (chunk) => {\n    socket.write(`Echo: ${chunk}`);\n  });\n});\nserver.listen(8080);",
    recallHint: "epoll (Linux), kqueue (macOS), IOCP (Windows) provide O(1) kernel notifications for active sockets.",
    interviewTip: "Connecting libuv to OS kernel primitives proves deep systems-level comprehension beyond standard JavaScript.",
    tags: ["epoll", "kqueue", "iocp", "networking", "internals"]
  }),

  makeItem({
    idNum: 8,
    category,
    concept: "Libuv Handles vs Requests",
    priority: "important",
    difficulty: "Advanced",
    question: "What is the difference between a libuv 'Handle' and a 'Request'?",
    quickAnswer: "A Handle represents a long-lived resource (e.g. TCP server, timer); a Request represents a short-lived operation on a handle (e.g. write, connect).",
    answer: "In libuv's C architecture: 1) Handles (uv_handle_t) represent long-lived active objects that can do work while active, such as TCP sockets (uv_tcp_t), UDP handles, timers (uv_timer_t), and signals. As long as an active handle is unreferenced, it keeps the event loop alive. 2) Requests (uv_req_t) represent short-lived, transient operations executed either on a handle or asynchronously in the thread pool, such as a write request (uv_write_t), connection request (uv_connect_t), or file system read (uv_fs_t).",
    explanation: "In Node.js, `ref()` and `unref()` methods directly toggle whether a handle keeps the event loop alive. Calling `timer.unref()` allows Node to terminate naturally if no other active handles remain.",
    code: "// Demonstrating Handle unref:\nconst timerHandle = setInterval(() => {\n  console.log('Heartbeat...');\n}, 1000);\n\n// Unreferencing the handle allows the process to exit even though the timer exists:\ntimerHandle.unref();\n\n// Process exits immediately if no other handles or requests are active!",
    recallHint: "Handle = Long-lived resource (socket, timer); Request = Short-lived operation (write, connect, fs read).",
    interviewTip: "Explain how timer.unref() is used in background cleanup tasks and keep-alive sockets to avoid preventing graceful process termination.",
    tags: ["libuv", "handles", "requests", "unref"]
  }),

  makeItem({
    idNum: 9,
    category,
    concept: "CPU-Bound vs I/O-Bound Bottlenecks",
    priority: "must-know",
    difficulty: "Foundational",
    question: "Why does Node.js excel at I/O-bound tasks but struggle with CPU-bound tasks on the main thread?",
    quickAnswer: "I/O tasks yield control to the OS while waiting; CPU tasks monopolize the single thread, blocking the event loop and delaying all concurrent requests.",
    answer: "Node.js excels at I/O-bound workloads (web APIs, database operations, microservices, file streaming) because waiting for network packets or disk data does not consume CPU cycles; the main thread quickly registers a callback and moves on to serve other clients. Conversely, CPU-bound workloads (image processing, video transcoding, heavy cryptography, machine learning, complex mathematical sorting) execute on the single main thread, blocking the event loop from processing any incoming HTTP requests until the computation finishes.",
    explanation: "To handle CPU-bound tasks in Node.js without stalling the event loop, engineers offload work to: 1) Worker Threads (`node:worker_threads`), 2) Child Processes (`child_process.fork`), or 3) Dedicated background task queues (e.g. BullMQ, SQS, Redis).",
    code: "// CPU-Bound Trap (Blocks entire server):\nfunction fibonacci(n) {\n  if (n <= 1) return n;\n  return fibonacci(n - 1) + fibonacci(n - 2); // Synchronous recursive CPU burn\n}\n\n// While fibonacci(45) executes, NO OTHER HTTP REQUESTS CAN BE SERVED!\n// Solution: Offload to worker thread pool or background service.",
    recallHint: "I/O yields to the event loop; CPU blocks the thread. Offload CPU to Worker Threads or external queues.",
    interviewTip: "Always propose concrete solutions (Worker Threads, child processes, microservices) when asked how to handle CPU-bound operations in Node.",
    tags: ["cpu-bound", "io-bound", "performance", "worker-threads"]
  }),

  makeItem({
    idNum: 10,
    category,
    concept: "Node.js C++ Addons & Node-API (N-API)",
    priority: "important",
    difficulty: "Advanced",
    question: "What is Node-API (formerly N-API) and why is it preferred over raw V8 C++ addons?",
    quickAnswer: "Node-API provides an ABI-stable C interface that guarantees native addons compile once and run across different Node.js major versions without recompilation.",
    answer: "Node-API (Application Binary Interface) is a C API that provides native C/C++ modules with access to the underlying JavaScript runtime. Before Node-API, native addons interacted directly with internal V8 C++ classes. Whenever Node.js updated its V8 version, the C++ APIs broke, requiring every native module to be recompiled (using nan). Node-API provides an ABI-stable abstraction layer guaranteed to remain binary compatible across major Node.js releases.",
    explanation: "Use cases for Node-API include interfacing with low-level OS hardware, integrating high-performance C/C++ libraries (e.g., sqlite3, sharp, canvas), or running high-performance numerical algorithms.",
    code: "// Concept: C++ addon compiled via node-addon-api:\n// #include <napi.h>\n// Napi::String Method(const Napi::CallbackInfo& info) {\n//   Napi::Env env = info.Env();\n//   return Napi::String::New(env, \"Hello from C++\");\n// }\n\n// In JavaScript, imported like a standard module:\n// import addon from './build/Release/myaddon.node';\n// console.log(addon.hello());",
    recallHint: "Node-API = ABI stability for C/C++ native modules across major Node.js version updates.",
    interviewTip: "Explain that ABI stability means native npm packages do not break when upgrading from Node 18 to Node 20 or Node 22.",
    tags: ["n-api", "c++", "addons", "v8", "abi"]
  }),

  makeItem({
    idNum: 11,
    category,
    concept: "Event Loop Tick Lifecycle & Sleep Mechanics",
    priority: "important",
    difficulty: "Advanced",
    question: "What happens when the Node.js event loop has no immediate tasks to run?",
    quickAnswer: "The Poll phase calculates the minimum timeout to the next pending timer and puts the thread to sleep in the OS kernel until events arrive.",
    answer: "When all active queues (Timers, Pending, Check) are empty, the event loop enters the Poll phase. It calculates the time remaining until the earliest scheduled timer. If no timers exist, it calculates an infinite timeout. It then issues a blocking epoll_wait (or kqueue) system call, allowing the OS kernel to put the process thread into sleep mode (consuming 0% CPU).",
    explanation: "The kernel immediately wakes the thread up when either: 1) Data arrives on a monitored network/socket descriptor, 2) A background libuv worker thread finishes a task and notifies the loop via an async handle, or 3) The calculated timer duration expires.",
    code: "// An idle Node.js server consumes 0% CPU while waiting for traffic:\nimport http from 'node:http';\n\nconst server = http.createServer((req, res) => res.end('ok'));\nserver.listen(4000, () => {\n  console.log('Server waiting in Poll phase. Thread sleeps in kernel until request arrives.');\n});",
    recallHint: "Poll phase blocks with calculated timeout in epoll_wait/kqueue; thread sleeps in kernel at 0% CPU.",
    interviewTip: "Highlight that Node does NOT busy-wait or loop constantly in user-space; it delegates sleeping to the OS kernel.",
    tags: ["event-loop", "poll-phase", "epoll_wait", "sleep-mechanics"]
  }),

  makeItem({
    idNum: 12,
    category,
    concept: "V8 Isolate Concept in Node.js",
    priority: "important",
    difficulty: "Advanced",
    question: "What is a V8 Isolate, and how does Node.js utilize Isolates for isolation?",
    quickAnswer: "An Isolate is an independent instance of the V8 runtime with its own heap, call stack, and garbage collector. Worker Threads each run in their own Isolate.",
    answer: "A V8 Isolate represents a completely isolated, single-threaded instance of the V8 JavaScript engine. Each Isolate possesses its own memory heap manager, garbage collector, call stack, and execution context. One Isolate cannot directly mutate or access the JavaScript objects of another Isolate without explicit inter-isolate communication.",
    explanation: "In Node.js: The main thread runs in one V8 Isolate. When you create a `Worker` from `node:worker_threads`, Node.js instantiates a brand new V8 Isolate on a separate OS thread. They exchange data through message serialization (Structured Clone) or SharedArrayBuffer.",
    code: "// Worker Threads run in separate V8 Isolates:\nimport { Worker, isMainThread } from 'node:worker_threads';\n\nif (isMainThread) {\n  const worker = new Worker(new URL(import.meta.url));\n  worker.on('message', (msg) => console.log('Received from separate isolate:', msg));\n} else {\n  // In this worker thread, this is a completely distinct V8 isolate and heap!\n  import('node:worker_threads').then(({ parentPort }) => {\n    parentPort.postMessage({ memoryUsed: process.memoryUsage().heapUsed });\n  });\n}",
    recallHint: "V8 Isolate = Independent V8 instance with dedicated Heap, Stack, and GC. Worker threads = Separate Isolates.",
    interviewTip: "Distinguish between multi-process (Cluster) and multi-isolate (Worker Threads in one process).",
    tags: ["v8", "isolate", "worker-threads", "memory"]
  }),

  makeItem({
    idNum: 13,
    category,
    concept: "Libuv Timers Phase Priority & Drift",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "Why are Node.js timers (setTimeout/setInterval) not guaranteed to fire at exact millisecond intervals?",
    quickAnswer: "Timers specify a minimum threshold, not an exact time. CPU-bound code or blocking I/O in the Poll phase causes timer drift.",
    answer: "The millisecond delay passed to `setTimeout(fn, delay)` specifies the MINIMUM threshold after which the callback may be executed, not a precise guarantee. In libuv, timers are stored in a min-heap indexed by expiration time. When the event loop enters the Timers phase, it compares the current time against the heap root.",
    explanation: "If a preceding event loop phase (like Poll or a synchronous callback) takes 50ms, a timer configured for 10ms will experience a 40ms timer drift. Node.js is not a real-time operating system (RTOS) and cannot guarantee sub-millisecond real-time execution guarantees.",
    code: "// Demonstrating timer drift caused by event loop blockage:\nconst start = Date.now();\nsetTimeout(() => {\n  console.log(`Expected ~20ms, actual fired after: ${Date.now() - start}ms`);\n}, 20);\n\n// Synchronously block the thread for 100ms:\nconst blockUntil = Date.now() + 100;\nwhile (Date.now() < blockUntil) {} // Busy wait burns CPU and delays timer phase!",
    recallHint: "setTimeout(fn, delay) defines minimum wait threshold; event loop blocking causes timer drift.",
    interviewTip: "Explain why high-frequency financial or industrial trading applications do not use standard Node.js setTimeout for microsecond execution.",
    tags: ["timers", "drift", "event-loop", "settimeout"]
  }),

  makeItem({
    idNum: 14,
    category,
    concept: "System Call Delegation in Node.js",
    priority: "important",
    difficulty: "Advanced",
    question: "How does a high-level JavaScript call like fs.readFile transition down into OS kernel system calls?",
    quickAnswer: "JS calls C++ binding (node_file.cc), which delegates to a libuv uv_fs_* task dispatched to the worker thread pool, executing the OS read() syscall.",
    answer: "When you execute `fs.readFile('data.txt', callback)`: 1) JavaScript standard library validates arguments and invokes internal C++ bindings (`node_file.cc`), 2) The C++ layer packages the request into a `uv_fs_t` struct, 3) libuv posts this request to its background worker thread pool queue, 4) A worker thread picks up the request and issues the blocking OS `open()` and `read()` system calls, 5) Once complete, the worker thread posts an async completion signal back to the main thread's event loop Poll queue, and 6) The event loop triggers the original JavaScript callback with data.",
    explanation: "This clear multi-layered architecture completely decouples the JavaScript developer from OS-specific file descriptor semantics.",
    code: "// High-level call -> C++ binding -> Libuv uv_fs_t -> Worker Thread -> OS read() syscall:\nimport fs from 'node:fs';\n\nfs.readFile('/etc/hosts', (err, buffer) => {\n  if (err) throw err;\n  console.log(`Bytes read from kernel: ${buffer.length}`);\n});",
    recallHint: "JS fs.readFile -> C++ binding -> Libuv uv_fs_t -> Thread Pool -> OS open/read syscall -> Event loop callback.",
    interviewTip: "Tracing a function call down through all runtime layers demonstrates true engineering mastery.",
    tags: ["syscalls", "libuv", "fs", "internals"]
  }),

  makeItem({
    idNum: 15,
    category,
    concept: "Node.js Native C/C++ Dependencies",
    priority: "good-to-know",
    difficulty: "Intermediate",
    question: "What core open-source C/C++ libraries are statically compiled into the Node.js binary?",
    quickAnswer: "V8 (JavaScript), libuv (I/O & Loop), OpenSSL (Crypto & TLS), zlib (Compression), llhttp (HTTP parsing), c-ares (Async DNS), and ICU (Internationalization).",
    answer: "Node.js is not just V8; it embeds several industry-standard C/C++ libraries compiled into a single executable binary: 1) V8: Google's JavaScript and WebAssembly engine, 2) libuv: Event loop and cross-platform asynchronous I/O, 3) OpenSSL / BoringSSL: Cryptographic algorithms, TLS/SSL networking, 4) zlib: Deflate, Gzip, and Brotli compression, 5) llhttp: Ultra-fast C-based HTTP parser, 6) c-ares: Asynchronous DNS resolver library, and 7) ICU: Full internationalization and unicode support (Intl).",
    explanation: "Because these libraries are compiled directly into the binary, Node.js does not require external runtime dependencies on Linux, Windows, or macOS systems.",
    code: "// Inspecting versions of bundled C/C++ libraries:\nconsole.log(process.versions);\n// {\n//   node: '22.0.0',\n//   v8: '12.4.254.14-node.9',\n//   uv: '1.48.0',\n//   zlib: '1.3.0.1-motley-24c8073',\n//   brotli: '1.1.0',\n//   ares: '1.28.1',\n//   modules: '127',\n//   nghttp2: '1.61.0',\n//   openssl: '3.0.13+quic'\n// }",
    recallHint: "V8 + Libuv + OpenSSL + Zlib + llhttp + c-ares + ICU = Node.js binary.",
    interviewTip: "Mentioning llhttp (which replaced http-parser) and c-ares shows up-to-date knowledge of the Node.js codebase.",
    tags: ["dependencies", "openssl", "zlib", "c-ares", "llhttp"]
  })
];

module.exports = items;
