const { makeItem } = require('../builder_helper.cjs');

const category = "6. Concurrency, Clustering & Worker Threads";

const items = [
  makeItem({
    idNum: 71,
    category,
    concept: "Multi-Core Scaling Strategies in Node.js",
    priority: "must-know",
    difficulty: "Foundational",
    question: "Why does a single Node.js process only utilize 1 CPU core and how do you scale across all available cores?",
    quickAnswer: "Node's single thread runs on one CPU core; scale via Cluster module, process managers (PM2), or container replicas (Kubernetes/ECS).",
    answer: "Because Node.js executes JavaScript on a single thread, a default process running on an 8-core or 64-core server will only utilize 1 core (leaving the remaining cores idle at 0% utilization). To utilize all cores, developers use multi-process scaling: 1) The native `node:cluster` module forks N processes sharing server ports, 2) Process managers like PM2 run cluster mode automatically, or 3) Container orchestrators (Docker + Kubernetes / AWS ECS) scale horizontal container replicas per CPU core.",
    explanation: "Multi-processing achieves true parallel execution: 8 processes handle 8 requests truly in parallel across 8 hardware cores.",
    code: "import cluster from 'node:cluster';\nimport os from 'node:os';\nimport http from 'node:http';\n\nif (cluster.isPrimary) {\n  const numCPUs = os.cpus().length;\n  console.log(`Primary ${process.pid} is forking ${numCPUs} workers...`);\n  for (let i = 0; i < numCPUs; i++) cluster.fork();\n  cluster.on('exit', (worker) => cluster.fork()); // Auto-restart on crash\n} else {\n  http.createServer((req, res) => res.end('Served by worker ' + process.pid)).listen(8000);\n}",
    recallHint: "1 Node process = 1 Core. Scale via cluster.fork(), PM2 cluster mode, or Kubernetes container replicas.",
    interviewTip: "Clarify that in modern cloud setups (Kubernetes), container-per-core or auto-scaling pods is preferred over in-process Node cluster mode.",
    tags: ["cluster", "concurrency", "multi-core", "scaling", "pm2"]
  }),

  makeItem({
    idNum: 72,
    category,
    concept: "Node.js Cluster Module Architecture (cluster.fork)",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How does the Node.js Cluster module allow multiple worker processes to share the same HTTP listening port?",
    quickAnswer: "The primary process binds the port and distributes incoming connections to workers using round-robin (or OS SO_REUSEPORT).",
    answer: "In standard operating systems, two processes cannot bind to the exact same TCP port (causing `EADDRINUSE`). The Node.js `cluster` module circumvents this: 1) The Primary process binds the TCP listening socket (e.g. port 3000), 2) When new client TCP connections arrive, the primary accepts the socket and hands off the connection handle to worker processes using Round-Robin load balancing (default on non-Windows platforms), and 3) The worker process's HTTP parser reads the request and writes the response directly back to the client socket.",
    explanation: "This allows seamless multi-core distribution without needing an external load balancer on the local machine.",
    code: "// Inspecting cluster worker distribution:\nimport cluster from 'node:cluster';\nimport http from 'node:http';\n\nif (cluster.isWorker) {\n  http.createServer((req, res) => {\n    res.writeHead(200);\n    res.end(`Worker PID: ${process.pid} handled request\\n`);\n  }).listen(3000);\n}",
    recallHint: "Primary binds port; hands raw socket handles to workers via round-robin IPC.",
    interviewTip: "Candidate trap: Workers do NOT bind the port independently; the primary binds and passes the underlying socket handle.",
    tags: ["cluster", "eaddrinuse", "round-robin", "ipc", "sockets"]
  }),

  makeItem({
    idNum: 73,
    category,
    concept: "Inter-Process Communication (IPC) in Cluster Mode",
    priority: "important",
    difficulty: "Intermediate",
    question: "How do primary and worker processes communicate in Node.js Cluster mode?",
    quickAnswer: "Via built-in IPC channels using process.send() and process.on('message') to serialize JSON payloads over UNIX domain sockets/named pipes.",
    answer: "When a worker process is forked via `cluster.fork()`, Node.js creates a dedicated Inter-Process Communication (IPC) channel between the primary and the worker (backed by UNIX domain sockets on POSIX or named pipes on Windows).",
    explanation: "Processes exchange data by calling `worker.send(message)` in the primary or `process.send(message)` in the worker, triggering `'message'` event listeners. Payloads are serialized using JSON under the hood.",
    code: "import cluster from 'node:cluster';\n\nif (cluster.isPrimary) {\n  const worker = cluster.fork();\n  worker.on('message', (msg) => {\n    console.log('Primary received message from worker:', msg);\n  });\n  worker.send({ command: 'UPDATE_CONFIG', version: 2 });\n} else {\n  process.on('message', (msg) => {\n    console.log('Worker received command:', msg);\n    process.send({ status: 'ACK', workerPid: process.pid });\n  });\n}",
    recallHint: "process.send() and on('message') communicate over OS IPC pipes using JSON serialization.",
    interviewTip: "Mention that IPC incurs serialization overhead; avoid streaming high-volume multi-megabyte payloads over standard IPC.",
    tags: ["ipc", "cluster", "process-send", "named-pipes"]
  }),

  makeItem({
    idNum: 74,
    category,
    concept: "Worker Threads Module (node:worker_threads)",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "What are Worker Threads in Node.js and how do they differ from the Cluster module?",
    quickAnswer: "Worker Threads run multiple threads inside ONE process sharing memory; Cluster runs multiple OS processes with isolated memory.",
    answer: "The `node:worker_threads` module enables true multi-threaded JavaScript execution within a single Node.js process. Each Worker Thread runs in its own V8 Isolate with its own event loop and call stack, but shares the same process PID, file descriptors, and OS memory space.",
    explanation: "Key Difference: 1) Cluster: Independent processes, separate memory (cannot share variables), higher RAM overhead (~30MB+ per process), ideal for web server scaling. 2) Worker Threads: Lightweight threads, shared memory possible via `SharedArrayBuffer`, fast instantiation, ideal for CPU-bound computations (cryptography, image manipulation, data parsing).",
    code: "import { Worker, isMainThread, parentPort } from 'node:worker_threads';\n\nif (isMainThread) {\n  const worker = new Worker(new URL(import.meta.url));\n  worker.on('message', (result) => console.log('Worker finished:', result));\n  worker.postMessage({ task: 'COMPUTE', iterations: 1000000 });\n} else {\n  parentPort.on('message', (data) => {\n    let sum = 0;\n    for (let i = 0; i < data.iterations; i++) sum += i;\n    parentPort.postMessage({ sum });\n  });\n}",
    recallHint: "Cluster = Multi-Process (web servers); Worker Threads = Multi-Thread (CPU-bound tasks).",
    interviewTip: "Clarify that Worker Threads do NOT make synchronous I/O faster; they only prevent CPU tasks from blocking the main event loop.",
    tags: ["worker-threads", "cluster", "concurrency", "multithreading"]
  }),

  makeItem({
    idNum: 75,
    category,
    concept: "SharedArrayBuffer & Atomics for Lockless Memory",
    priority: "important",
    difficulty: "Advanced",
    question: "How do SharedArrayBuffer and Atomics enable lockless shared memory between Worker Threads?",
    quickAnswer: "SharedArrayBuffer maps the same physical memory chunk into multiple threads; Atomics provides thread-safe, race-free read/write operations.",
    answer: "Normally, passing data to a Worker Thread serializes and copies the payload (Structured Clone), which is slow for large arrays (e.g. 100MB image buffers). `SharedArrayBuffer` creates a piece of binary memory that can be simultaneously read and written by multiple Worker Threads without copying.",
    explanation: "Because concurrent read/writes to shared memory cause race conditions, the `Atomics` object provides atomic operations (`Atomics.add`, `Atomics.load`, `Atomics.store`, `Atomics.wait`, `Atomics.notify`) that guarantee uninterrupted CPU instructions, enabling lock-free queues and thread synchronization.",
    code: "import { Worker, isMainThread, workerData } from 'node:worker_threads';\n\nif (isMainThread) {\n  // Allocate 4 bytes of shared memory (1 Int32)\n  const sharedBuffer = new SharedArrayBuffer(4);\n  const sharedArray = new Int32Array(sharedBuffer);\n  \n  const worker = new Worker(new URL(import.meta.url), { workerData: sharedBuffer });\n  worker.on('exit', () => {\n    console.log('Final Atomic Counter Value:', Atomics.load(sharedArray, 0)); // 1000\n  });\n} else {\n  const sharedArray = new Int32Array(workerData);\n  for (let i = 0; i < 1000; i++) {\n    Atomics.add(sharedArray, 0, 1); // Atomic, thread-safe increment!\n  }\n}",
    recallHint: "SharedArrayBuffer = Zero-copy shared RAM; Atomics = Thread-safe race-free operations (Atomics.add, load).",
    interviewTip: "Mention that due to Spectre hardware CPU vulnerabilities, SharedArrayBuffer requires specific COOP and COEP cross-origin isolation headers in browsers.",
    tags: ["sharedarraybuffer", "atomics", "multithreading", "concurrency", "lockless"]
  }),

  makeItem({
    idNum: 76,
    category,
    concept: "Transferable Objects for Zero-Copy Data Transfer",
    priority: "important",
    difficulty: "Advanced",
    question: "What are Transferable Objects and how do they eliminate memory copying when messaging Worker Threads?",
    quickAnswer: "Transferring an ArrayBuffer moves its underlying memory pointer to the worker, detaching it from the sender in zero copy time.",
    answer: "When messaging a Worker Thread via `port.postMessage(buffer)`, the default behavior creates a deep copy of the memory. For multi-megabyte payloads, this causes high CPU usage and double memory consumption. Passing the underlying `ArrayBuffer` in the transfer list (`[buffer.buffer]`) TRANSFERS ownership instead of copying.",
    explanation: "Zero-Copy: The pointer to the memory block is transferred in O(1) time directly to the destination thread. The original buffer in the sender thread is instantly 'neutered' (detached), leaving its `byteLength` at 0 so it can no longer be read or written by the sender.",
    code: "import { Worker, isMainThread, parentPort } from 'node:worker_threads';\n\nif (isMainThread) {\n  const worker = new Worker(new URL(import.meta.url));\n  const u8 = new Uint8Array(100 * 1024 * 1024); // 100MB buffer\n  console.log('Before transfer length:', u8.byteLength); // 104857600\n\n  // Transfer memory pointer (Zero-Copy!):\n  worker.postMessage({ data: u8 }, [u8.buffer]);\n  console.log('After transfer length:', u8.byteLength); // 0 (Neutered!)\n} else {\n  parentPort.on('message', ({ data }) => {\n    console.log('Worker received 100MB buffer instantly:', data.byteLength);\n  });\n}",
    recallHint: "Transferable objects move memory ownership in O(1) time; original buffer is neutered (byteLength = 0).",
    interviewTip: "Zero-copy memory transfer is standard in high-performance Node applications processing raw video frames or audio buffers.",
    tags: ["transferable", "arraybuffer", "zero-copy", "worker-threads", "performance"]
  }),

  makeItem({
    idNum: 77,
    category,
    concept: "Child Process: spawn vs exec vs execFile vs fork",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "What is the difference between child_process.spawn(), exec(), execFile(), and fork()?",
    quickAnswer: "spawn streams I/O; exec buffers in shell; execFile executes binary directly without shell; fork creates a Node process with IPC.",
    answer: "The `node:child_process` module provides four methods to execute external OS commands: 1) `spawn`: Launches a command in a new process, streaming data via `stdout`/`stderr` streams. Ideal for long-running processes or large data. 2) `exec`: Spawns a shell (`/bin/sh` or `cmd.exe`) and buffers the entire output in memory (maxBuffer default 1MB) before calling a callback. Vulnerable to shell injection! 3) `execFile`: Invokes an executable binary directly WITHOUT a shell, making it faster and immune to shell injection. 4) `fork`: A special case of `spawn` designed specifically for Node.js scripts, automatically setting up an IPC messaging channel between processes.",
    explanation: "Security rule: Never pass unvalidated user input to `exec()`; use `execFile()` or `spawn()` with an array of arguments.",
    code: "import { spawn, execFile, fork } from 'node:child_process';\n\n// 1. spawn for streaming:\nconst ls = spawn('ls', ['-lh', '/usr']);\nls.stdout.on('data', (chunk) => console.log(`Chunk: ${chunk}`));\n\n// 2. execFile for secure execution (No shell injection risk):\nexecFile('git', ['status'], (err, stdout) => console.log(stdout));\n\n// 3. fork for background Node scripts with IPC:\nconst child = fork('./background-task.js');\nchild.send({ start: true });",
    recallHint: "spawn = Stream; exec = Shell + Buffer; execFile = Binary (No shell injection); fork = Node process with IPC.",
    interviewTip: "Highlight that exec() invokes an OS shell, whereas execFile() invokes the binary directly via the OS execve() syscall.",
    tags: ["child-process", "spawn", "exec", "execfile", "fork", "security"]
  }),

  makeItem({
    idNum: 78,
    category,
    concept: "Preventing Shell Injection in Child Process",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How do Command Injection vulnerabilities occur in child_process.exec() and how do you prevent them?",
    quickAnswer: "exec() evaluates shell metacharacters (; | &&); attackers inject commands. Prevent by using execFile or spawn with argument arrays.",
    answer: "When using `child_process.exec(\"cat \" + userInput)`, the command is passed to `/bin/sh -c`. If `userInput` is `file.txt; rm -rf /`, the shell executes both commands sequentially. This is Command Injection, allowing attackers to take complete control of the host server.",
    explanation: "Defense: 1) Never use `exec()` with user input. 2) Use `execFile()` or `spawn()` with a strict array of arguments: `execFile('cat', [userInput])`. The operating system treats `userInput` strictly as a single literal argument string, completely neutralizing shell metacharacters (`;`, `|`, `&&`, `$()`).",
    code: "// VULNERABLE TO COMMAND INJECTION:\n// exec(`ping -c 1 ${userIp}`); // Attacker supplies: \"127.0.0.1; cat /etc/passwd\"\n\n// SECURE: Argument array cannot be interpreted as shell commands:\nimport { execFile } from 'node:child_process';\n\nexecFile('ping', ['-c', '1', userIp], (err, stdout) => {\n  console.log(stdout);\n});",
    recallHint: "Never concatenate strings into child_process.exec(); use execFile(cmd, [argsArray]) for shell immunity.",
    interviewTip: "Candidate security check: Pointing out that argument arrays bypass the shell entirely is the expected senior answer.",
    tags: ["shell-injection", "security", "child-process", "command-injection"]
  }),

  makeItem({
    idNum: 79,
    category,
    concept: "Worker Thread Pools with Piscina",
    priority: "important",
    difficulty: "Advanced",
    question: "Why should you use a thread pool library like Piscina instead of spawning new Worker instances per request?",
    quickAnswer: "Spawning a Worker has high memory/V8 isolate startup overhead; Piscina pools threads and queues tasks efficiently.",
    answer: "Instantiating a `new Worker()` involves creating a brand new V8 Isolate, compiling the script, setting up libuv thread handles, and allocating memory (~15MB-30MB RAM overhead). If an API endpoint creates a `new Worker()` for every incoming HTTP request under heavy traffic, the server will quickly crash due to CPU exhaustion and thread thrashing.",
    explanation: "Production pattern: Use a Worker Thread Pool (like `piscina`). A thread pool maintains a fixed number of warm, pre-allocated worker threads matching CPU cores (e.g. 8 threads) and manages a task queue, dispatching jobs to available workers with minimal latency.",
    code: "// Conceptual thread pool usage with Piscina:\n// import Piscina from 'piscina';\n// const pool = new Piscina({ filename: path.resolve(__dirname, 'worker.js') });\n// \n// // In request handler (reuses warm worker instantly!):\n// app.post('/hash', async (req, res) => {\n//   const hash = await pool.run({ password: req.body.password });\n//   res.json({ hash });\n// });",
    recallHint: "Creating Workers per request causes V8 isolate thrashing. Use Piscina to reuse warm worker pools.",
    interviewTip: "Connecting thread pools in Node to HikariCP in Java or database connection pools demonstrates architectural consistency.",
    tags: ["piscina", "thread-pool", "worker-threads", "performance"]
  }),

  makeItem({
    idNum: 80,
    category,
    concept: "Zombie Processes & Child Process Exit Cleanup",
    priority: "important",
    difficulty: "Advanced",
    question: "What is a Zombie Process and how do you prevent them when spawning child processes in Node.js?",
    quickAnswer: "A Zombie process has terminated but still exists in the OS process table because its parent hasn't read its exit status.",
    answer: "When a child process terminates on a POSIX operating system, it enters the 'zombie' (defunct) state. The OS retains its process ID and exit code in the kernel process table until the parent process 'reaps' it by reading its exit status via `waitpid()`. If a Node.js parent process spawns thousands of child processes and ignores their exit lifecycle, the OS process table fills with zombie PIDs, eventually preventing the OS from spawning any new processes.",
    explanation: "In Node.js, `child_process.spawn` automatically reaps children when you listen to the `'exit'` or `'close'` event. If the parent exits, ensure child processes are terminated by catching `SIGTERM`/`SIGINT`.",
    code: "import { spawn } from 'node:child_process';\n\nconst child = spawn('ffmpeg', ['-i', 'input.mp4', 'output.avi']);\n\n// Mandatory: Listen to exit/close to ensure the OS reaps the process ID:\nchild.on('exit', (code, signal) => {\n  console.log(`Child process reaped with exit code ${code}`);\n});\n\n// Parent exit cleanup:\nprocess.on('SIGTERM', () => {\n  child.kill('SIGTERM'); // Terminate child so it does not become orphaned!\n  process.exit(0);\n});",
    recallHint: "Zombie = Dead child waiting for parent to read exit code. Always listen to child.on('exit').",
    interviewTip: "Mention that in Docker containers, if Node.js runs as PID 1, it must act as the init system to reap orphaned zombie processes (or use dumb-init / tini).",
    tags: ["zombie-process", "child-process", "pid1", "docker", "posix"]
  }),

  makeItem({
    idNum: 81,
    category,
    concept: "MessageChannel & MessagePort Communication",
    priority: "important",
    difficulty: "Advanced",
    question: "How do MessageChannel and MessagePort enable direct peer-to-peer communication between two Worker Threads?",
    quickAnswer: "MessageChannel creates two connected MessagePorts (port1, port2); transferring port2 to another worker allows direct thread-to-thread messaging.",
    answer: "In `node:worker_threads`, communication between the main thread and a worker typically uses `parentPort`. However, if Worker A needs to communicate with Worker B, routing messages through the main thread creates a bottleneck.",
    explanation: "Solution: Create a `MessageChannel()`, which produces two entangled ports: `port1` and `port2`. The main thread sends `port2` to Worker B via Worker A using the transfer list. From that point forward, Worker A and Worker B communicate directly peer-to-peer over their dedicated `MessagePort` channel with zero main thread involvement.",
    code: "import { MessageChannel, Worker } from 'node:worker_threads';\n\nconst { port1, port2 } = new MessageChannel();\n\n// Send port1 to Worker A, and port2 to Worker B:\n// workerA.postMessage({ port: port1 }, [port1]);\n// workerB.postMessage({ port: port2 }, [port2]);\n\n// Worker A can now post directly to Worker B:\n// port1.postMessage('Direct P2P message between threads!');",
    recallHint: "MessageChannel creates 2 ports; transfer ports to workers to establish direct peer-to-peer thread communication.",
    interviewTip: "Explain that MessagePort adheres to the standard HTML5 Web Messaging specification.",
    tags: ["messagechannel", "messageport", "worker-threads", "p2p"]
  }),

  makeItem({
    idNum: 82,
    category,
    concept: "SO_REUSEPORT & Linux Kernel Connection Distribution",
    priority: "good-to-know",
    difficulty: "Advanced",
    question: "How does SO_REUSEPORT differ from Node.js cluster round-robin on modern Linux kernels?",
    quickAnswer: "SO_REUSEPORT lets multiple sockets bind the same port and delegates load balancing to the Linux kernel network stack.",
    answer: "In default Node.js cluster mode, the primary process accepts all incoming TCP sockets and passes handles over IPC to workers (Round-Robin). While effective, this can create an IPC bottleneck at 100k+ connections/sec.",
    explanation: "Modern Linux kernels (3.9+) support the `SO_REUSEPORT` socket option. When enabled, multiple independent worker processes can bind directly to the same IP and port. The Linux kernel's networking stack automatically distributes incoming TCP SYN packets evenly across all worker listening sockets in kernel space, eliminating IPC overhead completely.",
    code: "// Concept: SO_REUSEPORT allows multiple independent processes to bind port 8080:\n// Handled automatically by native bindings or frameworks like HyperExpress / uWebSockets.js\n// Eliminates master IPC bottleneck for millions of req/sec.",
    recallHint: "SO_REUSEPORT = Linux kernel distributes TCP packets across workers; zero IPC overhead.",
    interviewTip: "Connecting cluster mechanics to the Linux kernel socket layer demonstrates staff-level systems engineering depth.",
    tags: ["so_reuseport", "linux-kernel", "networking", "cluster", "performance"]
  }),

  makeItem({
    idNum: 83,
    category,
    concept: "Worker Thread Termination & worker.terminate()",
    priority: "important",
    difficulty: "Intermediate",
    question: "What does worker.terminate() do and why must long-running workers be safely managed?",
    quickAnswer: "worker.terminate() forcefully stops the worker thread's V8 Isolate immediately, returning a promise resolving to the exit code.",
    answer: "Calling `worker.terminate()` immediately halts the JavaScript execution inside the target Worker Thread's V8 Isolate, cleans up its libuv thread handles, and destroys the thread. It returns a Promise that resolves when the thread has stopped.",
    explanation: "Caution: Forcefully terminating a worker while it is half-way through writing to a file or updating a database can leave external resources in an inconsistent state. Best practice: Send a 'SHUTDOWN' message over `parentPort` to allow the worker to finish its active task and exit cleanly via `process.exit(0)`, reserving `worker.terminate()` for hard timeout watchdog triggers.",
    code: "import { Worker } from 'node:worker_threads';\n\nconst worker = new Worker('./heavy-task.js');\n\n// Watchdog timer: kill worker if it exceeds 10 seconds:\nconst timeout = setTimeout(async () => {\n  console.warn('Worker exceeded execution deadline. Forcing termination.');\n  await worker.terminate();\n}, 10000);\n\nworker.on('message', () => clearTimeout(timeout));",
    recallHint: "worker.terminate() forces immediate thread shutdown; prefer cooperative shutdown messages with timeout watchdog.",
    interviewTip: "Discuss timeout watchdog patterns to protect Node servers from rogue infinite loops in worker threads.",
    tags: ["worker-threads", "terminate", "watchdog", "timeouts"]
  })
];

module.exports = items;
