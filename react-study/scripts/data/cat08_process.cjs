const { makeItem } = require('../builder_helper.cjs');

const category = "8. Process Lifecycle, Signals & Diagnostics";

const items = [
  makeItem({
    idNum: 97,
    category,
    concept: "POSIX Process Signals (SIGINT, SIGTERM, SIGHUP, SIGUSR2)",
    priority: "must-know",
    difficulty: "Foundational",
    question: "What are the common POSIX signals in Node.js and what does each indicate to the process?",
    quickAnswer: "SIGINT is Ctrl+C; SIGTERM is termination from K8s/Docker; SIGHUP is terminal close/reload; SIGUSR2 is custom user signal.",
    answer: "POSIX signals are asynchronous notifications sent by the OS kernel or other processes to a Node.js process: 1) `SIGINT` (Signal Interrupt): Triggered when a user presses Ctrl+C in the terminal. 2) `SIGTERM` (Signal Terminate): The standard polite request to terminate sent by Kubernetes, Docker (`docker stop`), or systemd before forcefully killing the process. 3) `SIGKILL` (Signal 9): Forceful immediate termination by the OS kernel; CANNOT be caught, intercepted, or ignored. 4) `SIGHUP` (Signal Hangup): Emitted when the controlling terminal closes; commonly used to trigger configuration reloads. 5) `SIGUSR2`: Custom user-defined signal; commonly used by Nodemon or tools to trigger memory heap dumps.",
    explanation: "Listening to signals is done via `process.on('SIGTERM', handler)`. If you attach a listener to `SIGINT` or `SIGTERM`, Node will NOT exit automatically; you must call `process.exit()` explicitly.",
    code: "import process from 'node:process';\n\n// Handle graceful shutdown on Docker/K8s termination:\nprocess.on('SIGTERM', () => {\n  console.log('Received SIGTERM from orchestrator. Closing servers...');\n  // Complete shutdown logic, then:\n  process.exit(0);\n});\n\nprocess.on('SIGINT', () => {\n  console.log('Received SIGINT (Ctrl+C). Terminating...');\n  process.exit(0);\n});",
    recallHint: "SIGTERM = Orchestrator stop; SIGINT = Ctrl+C; SIGKILL = Hard kill (uncatchable). SIGHUP = Config reload.",
    interviewTip: "Candidate gotcha: Mention that SIGKILL and SIGSTOP cannot have event listeners attached; the OS enforces immediate termination.",
    tags: ["signals", "sigterm", "sigint", "posix", "process-lifecycle"]
  }),

  makeItem({
    idNum: 98,
    category,
    concept: "Zero-Downtime Graceful Shutdown Sequence",
    priority: "must-know",
    difficulty: "Advanced",
    question: "What is the exact step-by-step sequence required for a zero-downtime graceful shutdown in Node.js?",
    quickAnswer: "1) Catch SIGTERM, 2) Stop accepting new traffic (server.close), 3) Destroy idle sockets, 4) Drain DB/queues, 5) Exit 0 with watchdog timer.",
    answer: "A production graceful shutdown sequence follows five strict sequential steps: 1) Catch `SIGTERM` / `SIGINT` signals, 2) Set process readiness state to unhealthy so Kubernetes load balancers stop routing new traffic, 3) Call `server.close()` to stop accepting new TCP connections and allow in-flight HTTP requests to complete, 4) Destroy idle keep-alive sockets (which would otherwise keep `server.close()` hanging forever), 5) Cleanly drain and close database connection pools, Redis clients, and message queues, 6) Set a hard watchdog safety timer (e.g. 15s) using `timer.unref()`, and 7) Call `process.exit(0)`.",
    explanation: "Skipping step 4 (destroying idle keep-alive sockets) causes servers to hang until Kubernetes hard-kills them with SIGKILL after `terminationGracePeriodSeconds`.",
    code: "export function setupGracefulShutdown(server, dbPool, timeoutMs = 15000) {\n  const connections = new Set();\n  server.on('connection', (sock) => {\n    connections.add(sock);\n    sock.on('close', () => connections.delete(sock));\n  });\n\n  const shutdown = async () => {\n    // Safety watchdog\n    const forceTimer = setTimeout(() => process.exit(1), timeoutMs);\n    forceTimer.unref();\n\n    server.close(); // Stop accepting new requests\n    for (const sock of connections) sock.destroy(); // Destroy idle sockets\n    if (dbPool) await dbPool.end(); // Drain DB pool\n    process.exit(0);\n  };\n\n  process.on('SIGTERM', shutdown);\n  process.on('SIGINT', shutdown);\n}",
    recallHint: "Catch signal -> server.close() -> destroy idle keep-alive sockets -> drain DB pools -> process.exit(0).",
    interviewTip: "Every staff/principal interview evaluates whether you understand why idle keep-alive sockets prevent server.close() from finishing.",
    tags: ["graceful-shutdown", "sigterm", "kubernetes", "sockets", "reliability"]
  }),

  makeItem({
    idNum: 99,
    category,
    concept: "Process Exit Codes & Meanings",
    priority: "important",
    difficulty: "Intermediate",
    question: "What do standard Node.js exit codes (0, 1, 137, 139) indicate to monitoring systems and orchestrators?",
    quickAnswer: "0 = Success; 1 = Uncaught error; 137 = SIGKILL / OS OOM killer (128 + 9); 139 = Segmentation fault (128 + 11).",
    answer: "When a process terminates, it returns an integer exit code to the parent process: 1) `0`: Success (clean termination, no more work in event loop), 2) `1`: Fatal uncaught error (unhandled exception or unhandled promise rejection in strict mode), 3) `128 + N`: Terminated by signal N (e.g. `137 = 128 + 9 (SIGKILL)`, typically caused by the Linux Out-Of-Memory OOM Killer terminating the container; `143 = 128 + 15 (SIGTERM)`), 4) `139 = 128 + 11 (SIGSEGV)`: Segmentation fault (C++ native addon memory violation).",
    explanation: "In Node.js, `process.exitCode = 1` sets the exit code gracefully without abruptly halting active handles, whereas `process.exit(1)` terminates immediately.",
    code: "// Graceful exit code setting:\nprocess.exitCode = 1; // Process will finish current tasks, then exit with code 1\n\n// Abrupt forced termination:\n// process.exit(1); // Terminates immediately, dropping active handles!",
    recallHint: "0 = Clean; 1 = Uncaught Error; 137 = OOM Killed (SIGKILL); prefer process.exitCode = 1 over process.exit(1).",
    interviewTip: "When diagnosing a Kubernetes pod restart with exit code 137, immediately inspect container memory limits vs peak usage.",
    tags: ["exit-codes", "oom-killer", "sigkill", "process", "monitoring"]
  }),

  makeItem({
    idNum: 100,
    category,
    concept: "Active Handles & Active Requests (process._getActiveHandles)",
    priority: "important",
    difficulty: "Advanced",
    question: "Why does a Node.js process stay running, and how do you find what active handles are keeping it alive?",
    quickAnswer: "Node stays alive as long as active libuv handles (servers, timers, sockets) exist; inspect via process._getActiveHandles() or wtfnode.",
    answer: "The Node.js event loop terminates automatically when there is no more asynchronous work scheduled. Work is tracked by libuv as: 1) Active Handles (open network servers, connected sockets, active timers without `.unref()`, child processes), and 2) Active Requests (pending file system I/O, DNS lookups).",
    explanation: "If a background script or unit test hangs and refuses to exit, an unclosed handle is keeping the loop alive. To diagnose: use the internal `process._getActiveHandles()` and `process._getActiveRequests()`, or the `wtfnode` npm package, which prints a human-readable list of open file descriptors and active timers.",
    code: "// Diagnosing why a script is hanging:\nimport process from 'node:process';\n\nfunction debugHangingProcess() {\n  const handles = process._getActiveHandles();\n  console.log(`Active handles keeping event loop alive (${handles.length}):`);\n  for (const h of handles) {\n    console.log('Handle constructor:', h.constructor.name);\n  }\n}\n\n// setInterval keeps process alive indefinitely unless unref() is called:\nconst t = setInterval(() => {}, 1000);\n// t.unref(); // Calling unref allows process to exit!",
    recallHint: "Event loop stays alive if active handles > 0. Use timer.unref() or process._getActiveHandles() to debug.",
    interviewTip: "Mention how Jest tests frequently throw 'A worker process has failed to exit' due to unclosed database connections or timers.",
    tags: ["active-handles", "event-loop", "unref", "debugging", "hang"]
  }),

  makeItem({
    idNum: 101,
    category,
    concept: "process.stdin, stdout & stderr Synchronous Traps",
    priority: "important",
    difficulty: "Advanced",
    question: "Why can console.log() synchronously block the event loop in Node.js on POSIX systems?",
    quickAnswer: "When stdout is redirected to a pipe, file, or synchronous terminal, writes block the event loop until the OS buffer flushes.",
    answer: "Many developers assume `console.log()` is always asynchronous. In reality, `process.stdout` and `process.stderr` behavior depends on the destination: 1) Files on POSIX/Windows: Synchronous write (blocks the event loop!), 2) TTYs (terminals): Asynchronous on Windows; Synchronous on POSIX (macOS/Linux), 3) Pipes (e.g. `node app.js | grep foo`): Synchronous on POSIX if the pipe buffer fills up.",
    explanation: "Performance consequence: High-throughput applications logging thousands of JSON lines per second via `console.log()` will suffer massive event loop latency spikes. Solution: Use high-performance asynchronous loggers like Pino with sonic-boom.",
    code: "// High-performance asynchronous logging with Pino:\n// import pino from 'pino';\n// const logger = pino(pino.destination({ sync: false })); // Non-blocking buffer writes\n// logger.info('Asynchronous, high-throughput non-blocking log statement');",
    recallHint: "console.log can be synchronous depending on OS and pipes; use Pino with async sonic-boom in production.",
    interviewTip: "Explain why logging in tight loops degrades server throughput by 50%+ due to synchronous stdout blocking.",
    tags: ["console-log", "stdout", "stderr", "synchronous-io", "pino"]
  }),

  makeItem({
    idNum: 102,
    category,
    concept: "Environmental Variables & process.env Performance Costs",
    priority: "important",
    difficulty: "Intermediate",
    question: "Why is frequently reading process.env inside hot execution paths a performance anti-pattern?",
    quickAnswer: "process.env is a C++ getter that allocates new JavaScript strings on every single access, causing V8 garbage churn.",
    answer: "In Node.js, `process.env` is not a plain JavaScript object; it is a C++ accessor property. Every time you access `process.env.MY_VAR`: 1) Node makes a boundary crossing into C++, 2) It queries the OS environment table, 3) It allocates a brand new JavaScript string in V8 memory.",
    explanation: "Performance fix: Read and validate environment variables ONCE during application startup (e.g. using Zod or a config singleton), cache them in a plain JavaScript object, and read from that object throughout your application.",
    code: "// ANTI-PATTERN: Called millions of times in hot loops:\nfunction isDebugEnabled() {\n  return process.env.NODE_ENV === 'development'; // C++ boundary crossing every time!\n}\n\n// PRODUCTION BEST PRACTICE: Cache config in startup singleton:\nexport const config = Object.freeze({\n  isDevelopment: process.env.NODE_ENV === 'development',\n  port: parseInt(process.env.PORT || '3000', 10)\n});\n// Reading config.isDevelopment is an instant in-memory property access!",
    recallHint: "process.env crosses C++ boundary and allocates strings on every read. Cache config once at startup.",
    interviewTip: "Candidate check: Demonstrating that process.env has measurable overhead in micro-benchmarks shows deep systems sensitivity.",
    tags: ["process-env", "performance", "configuration", "c++", "optimization"]
  }),

  makeItem({
    idNum: 103,
    category,
    concept: "Container PID 1 Problem & dumb-init in Docker",
    priority: "must-know",
    difficulty: "Advanced",
    question: "What is the PID 1 problem when running Node.js in Docker containers and how does dumb-init solve it?",
    quickAnswer: "As PID 1, Node doesn't handle default signal masks (ignores SIGTERM) and doesn't reap zombies; init systems (dumb-init/tini) fix this.",
    answer: "In Linux, Process ID 1 (PID 1) is the `init` process with special kernel responsibilities: 1) Special Signal Handling: The kernel does NOT apply default signal handlers to PID 1. If Node.js runs as PID 1 and has no explicit listener for `SIGTERM`, the signal is silently ignored, making `docker stop` hang until it hard-kills the container with SIGKILL after 10 seconds. 2) Zombie Reaping: When background child processes exit, their parent must reap them. If the parent dies, orphans are adopted by PID 1. Standard Node.js does not automatically reap adopted zombie processes, leading to PID exhaustion.",
    explanation: "Solution: Use a lightweight init system like `dumb-init` or `tini` as the container entrypoint (`ENTRYPOINT [\"dumb-init\", \"--\"]`), or run Docker with `--init`.",
    code: "# Dockerfile Best Practice with dumb-init:\n# FROM node:22-alpine\n# RUN apk add --no-cache dumb-init\n# USER node\n# ENTRYPOINT [\"dumb-init\", \"--\"]\n# CMD [\"node\", \"server.js\"]",
    recallHint: "Node as PID 1 ignores SIGTERM and leaks zombies; use dumb-init or tini as Docker container entrypoint.",
    interviewTip: "Explaining the PID 1 problem proves hands-on experience deploying Node.js in Kubernetes and Docker production environments.",
    tags: ["pid1", "docker", "dumb-init", "tini", "kubernetes", "signals"]
  }),

  makeItem({
    idNum: 104,
    category,
    concept: "Crash Diagnostics: Core Dumps & Node.js Diagnostic Reports",
    priority: "important",
    difficulty: "Advanced",
    question: "What are Node.js Diagnostic Reports (--report-on-fatalerror) and how do they aid production post-mortems?",
    quickAnswer: "They generate human-readable JSON files containing stack traces, OS metadata, libuv handles, and native memory stats on crash.",
    answer: "When a Node.js process crashes unexpectedly (especially due to out-of-memory or native segmentation faults), post-mortem debugging can be difficult without core dumps. Node.js provides built-in Diagnostic Reporting (`node:report`).",
    explanation: "Starting Node with `--report-on-fatalerror` or `--report-on-signal` automatically writes a diagnostic JSON report on crash. It details: JavaScript stack traces, native C++ stack traces, V8 heap statistics, active libuv handles, loaded shared libraries, and OS resource limits.",
    code: "// Trigger report programmatically:\nimport process from 'node:process';\n\nif (process.report) {\n  process.report.reportOnFatalError = true;\n  process.report.reportOnSignal = true;\n  \n  // Generate snapshot on demand:\n  // const reportFilename = process.report.writeReport();\n}",
    recallHint: "--report-on-fatalerror generates JSON crash dumps with JS/C++ stacks and active handles.",
    interviewTip: "Mention that diagnostic reports are vastly easier to parse than multi-gigabyte Linux core dump binary files.",
    tags: ["diagnostic-report", "crash", "post-mortem", "debugging", "v8"]
  }),

  makeItem({
    idNum: 105,
    category,
    concept: "Container Readiness & Liveness Probes in Node.js",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How do Kubernetes Liveness and Readiness probes differ, and how should Node.js endpoints implement them?",
    quickAnswer: "Liveness restarts dead processes (checks event loop responsiveness); Readiness routes traffic (checks DB/Redis connectivity).",
    answer: "In Kubernetes container orchestration: 1) Liveness Probe (`/healthz/liveness`): Checks if the Node.js process is alive. If this fails, Kubernetes kills the pod and spawns a new one. It should only verify that the event loop is responsive; NEVER check external database connections here (if the database goes down, restarting all Node pods causes a cascading restart storm!). 2) Readiness Probe (`/healthz/readiness`): Checks if the pod is ready to accept user traffic. It checks critical dependencies (database connection, Redis pool, warming caches). If it fails, Kubernetes stops routing traffic to the pod without killing it.",
    explanation: "Implement these as dedicated HTTP endpoints with low timeout thresholds.",
    code: "import http from 'node:http';\n\nconst server = http.createServer(async (req, res) => {\n  if (req.url === '/healthz/liveness') {\n    // Liveness: Process is alive and event loop responds\n    res.writeHead(200); return res.end('OK');\n  }\n  \n  if (req.url === '/healthz/readiness') {\n    // Readiness: Check DB connectivity\n    const isDbConnected = await checkDatabaseHealth();\n    if (isDbConnected) {\n      res.writeHead(200); res.end('READY');\n    } else {\n      res.writeHead(503); res.end('DATABASE_DISCONNECTED');\n    }\n    return;\n  }\n});",
    recallHint: "Liveness = Process alive (restart on fail); Readiness = Dependencies healthy (stop traffic on fail).",
    interviewTip: "Never check external databases in Liveness probes—this is a classic rookie mistake that causes cascading outages.",
    tags: ["kubernetes", "liveness", "readiness", "health-checks", "devops"]
  }),

  makeItem({
    idNum: 106,
    category,
    concept: "process.hrtime.bigint() High-Resolution Monotonic Clock",
    priority: "important",
    difficulty: "Intermediate",
    question: "Why should performance benchmarking use process.hrtime.bigint() instead of Date.now()?",
    quickAnswer: "Date.now() uses wall-clock time which can jump backwards due to NTP synchronization; hrtime is monotonic and nanosecond-accurate.",
    answer: "`Date.now()` is subject to the system wall clock. If the operating system synchronizes its clock via NTP (Network Time Protocol), the clock can drift forward or even jump backwards, resulting in negative elapsed time. Furthermore, `Date.now()` only has millisecond resolution.",
    explanation: "`process.hrtime.bigint()` returns the current high-resolution monotonic time in nanoseconds as a `BigInt`. Monotonic clocks are guaranteed to never jump backwards and are independent of system clock adjustments, making them mandatory for latency telemetry, micro-benchmarks, and APM tracking.",
    code: "import process from 'node:process';\n\nconst start = process.hrtime.bigint();\n\n// Execute operation to benchmark...\nfor (let i = 0; i < 100000; i++) Math.sqrt(i);\n\nconst end = process.hrtime.bigint();\nconst durationNanoseconds = end - start;\nconst durationMilliseconds = Number(durationNanoseconds) / 1e6;\n\nconsole.log(`Execution took: ${durationMilliseconds.toFixed(3)} ms`);",
    recallHint: "process.hrtime.bigint() is monotonic and nanosecond-precise; Date.now() can drift with NTP updates.",
    interviewTip: "Mention that performance.now() is also available globally in modern Node.js matching web browser standards.",
    tags: ["hrtime", "benchmarking", "monotonic-clock", "performance", "nanoseconds"]
  }),

  makeItem({
    idNum: 107,
    category,
    concept: "Daemonizing Processes vs Foreground Container Execution",
    priority: "good-to-know",
    difficulty: "Intermediate",
    question: "Why should Node.js applications run in the foreground inside Docker containers rather than as background daemons?",
    quickAnswer: "Containers track PID 1; if a process daemonizes into the background, PID 1 exits and Docker assumes the container finished.",
    answer: "In traditional VM deployments, applications were often daemonized into background services using `nohup`, `&`, or init scripts. However, Docker containers monitor the primary foreground process (PID 1). If a Node.js process forks into the background and exits the initial foreground shell, Docker immediately considers the container completed and terminates the entire container.",
    explanation: "Best practice: Always run Node.js in the foreground in containers (`CMD [\"node\", \"server.js\"]`). Let the container orchestrator (Kubernetes, AWS ECS) manage process lifecycle, log capturing, and health restarts.",
    code: "# Correct container execution (Foreground):\n# CMD [\"node\", \"server.js\"]\n\n# INCORRECT (Daemonized, container will exit immediately):\n# CMD [\"node\", \"server.js\", \"&\"]",
    recallHint: "Containers require foreground processes; background daemonizing causes containers to terminate immediately.",
    interviewTip: "Reinforces cloud-native 12-factor application architecture principles (Factor XI: Treat logs as event streams).",
    tags: ["docker", "daemon", "foreground", "containers", "12-factor"]
  })
];

module.exports = items;
