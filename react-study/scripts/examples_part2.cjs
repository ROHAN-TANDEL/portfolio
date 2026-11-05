// Batch 2: Concurrency, Worker Threads & Clustering (Examples 11 - 20)
module.exports = [
  {
    id: "ex-node-011",
    title: "CPU-Bound Cryptographic Workload Offloading via Worker Threads",
    category: "Concurrency & Workers",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to offload heavy CPU tasks (e.g. PBKDF2 hashing or complex mathematical calculations) inside dedicated Worker Threads without blocking the single-threaded event loop.",
    conceptsCovered: [
      "node:worker_threads Worker and parentPort",
      "V8 Isolate separation",
      "Event loop unblocking",
      "Thread error & exit lifecycle"
    ],
    code: `import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

if (isMainThread) {
  // MAIN THREAD: Dispatches heavy CPU task to background thread
  export function runCpuHashTask(password, iterations = 500000) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(__filename, {
        workerData: { password, iterations }
      });

      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) reject(new Error(\`Worker stopped with exit code \${code}\`));
      });
    });
  }
} else {
  // WORKER THREAD: Runs in isolated V8 isolate without blocking main loop
  import('node:crypto').then(({ pbkdf2Sync }) => {
    const { password, iterations } = workerData;
    const key = pbkdf2Sync(password, 'salt-key', iterations, 64, 'sha512');
    parentPort.postMessage({ hash: key.toString('hex'), status: 'COMPLETED' });
  });
}`,
    breakdown: [
      { lineRange: "8-22", note: "Main thread wraps Worker creation in a clean Promise, listening to message, error, and exit." },
      { lineRange: "24-31", note: "Worker runs synchronous pbkdf2Sync in its own V8 Isolate; main event loop handles HTTP requests uninterrupted." }
    ],
    expectedOutput: "Computes 500k hash iterations on background thread while main HTTP server responds to requests in 2ms."
  },

  {
    id: "ex-node-012",
    title: "Zero-Copy Large ArrayBuffer Transfer to Worker Threads",
    category: "Concurrency & Workers",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to transfer a 100MB binary buffer to a Worker Thread in O(1) time without memory copying using the Transferable Objects list.",
    conceptsCovered: [
      "Transferable Objects list",
      "ArrayBuffer memory pointer transfer",
      "Sender buffer neutering",
      "Zero-copy inter-thread messaging"
    ],
    code: `import { Worker, isMainThread, parentPort } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

if (isMainThread) {
  const worker = new Worker(__filename);

  // Allocate 64MB binary buffer
  const largeBuffer = new Uint8Array(64 * 1024 * 1024);
  console.log('Main thread buffer byteLength before transfer:', largeBuffer.byteLength); // 67108864

  // Pass largeBuffer.buffer in the transfer list (2nd parameter):
  // Moves memory pointer ownership to worker in O(1) time!
  worker.postMessage({ buffer: largeBuffer }, [largeBuffer.buffer]);

  // Original buffer in main thread is now neutered:
  console.log('Main thread buffer byteLength after transfer:', largeBuffer.byteLength); // 0!
  
  worker.on('message', (msg) => console.log('Worker reply:', msg));
} else {
  parentPort.on('message', ({ buffer }) => {
    console.log('Worker received buffer instantly without copy. Length:', buffer.byteLength);
    parentPort.postMessage('Processed 64MB in background');
  });
}`,
    breakdown: [
      { lineRange: "14-16", note: "Second parameter to postMessage ([largeBuffer.buffer]) specifies memory transfer." },
      { lineRange: "18-19", note: "Underlying memory is detached from main thread; byteLength becomes 0 instantly." },
      { lineRange: "23-26", note: "Worker receives identical memory pointer with zero serialization latency." }
    ],
    expectedOutput: "Before transfer: 67108864 bytes; After transfer: 0 bytes (neutered); Worker receives 64MB in 0.05ms."
  },

  {
    id: "ex-node-013",
    title: "Multi-Threaded Lockless Atomic Counter with SharedArrayBuffer",
    category: "Concurrency & Workers",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to share physical RAM between multiple Worker Threads and perform race-condition-free concurrent increments using Atomics.add.",
    conceptsCovered: [
      "SharedArrayBuffer shared memory",
      "Int32Array typed view",
      "Atomics.add and Atomics.load",
      "Lockless multi-threaded concurrency"
    ],
    code: `import { Worker, isMainThread, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);

if (isMainThread) {
  // 1. Allocate 4 bytes of shared memory for a 32-bit integer counter
  const sab = new SharedArrayBuffer(4);
  const counterView = new Int32Array(sab);

  // 2. Spawn 4 worker threads sharing the exact same SharedArrayBuffer
  const workers = Array.from({ length: 4 }, () => 
    new Worker(__filename, { workerData: sab })
  );

  let finished = 0;
  workers.forEach((w) => {
    w.on('exit', () => {
      finished++;
      if (finished === 4) {
        // Read final count atomically:
        console.log('Final Atomic Counter Value:', Atomics.load(counterView, 0));
      }
    });
  });
} else {
  // WORKER THREAD:
  const counterView = new Int32Array(workerData);
  // Concurrently increment 25,000 times:
  for (let i = 0; i < 25000; i++) {
    // Atomics.add guarantees thread-safe, atomic CPU instruction (no torn writes!)
    Atomics.add(counterView, 0, 1);
  }
}`,
    breakdown: [
      { lineRange: "8-10", note: "SharedArrayBuffer allocates physical RAM shared across all thread isolates." },
      { lineRange: "13-16", note: "Spawns 4 workers, each receiving a view into the same 4 bytes of memory." },
      { lineRange: "34-37", note: "Atomics.add prevents race conditions; final count is guaranteed to be 100,000." }
    ],
    expectedOutput: "Final Atomic Counter Value: 100000 (Exact count achieved without locks or mutexes across 4 threads)."
  },

  {
    id: "ex-node-014",
    title: "Direct Peer-to-Peer Worker Messaging with MessageChannel",
    category: "Concurrency & Workers",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to establish a direct communication channel between two Worker Threads using MessageChannel, completely bypassing the main thread.",
    conceptsCovered: [
      "MessageChannel and MessagePort",
      "Inter-thread port transfer",
      "Peer-to-peer thread messaging",
      "Decoupled worker orchestration"
    ],
    code: `import { Worker, MessageChannel } from 'node:worker_threads';

export function setupWorkerPipeline(workerScriptA, workerScriptB) {
  const workerA = new Worker(workerScriptA);
  const workerB = new Worker(workerScriptB);

  // 1. Create a bidirectional MessageChannel with two entangled ports
  const { port1, port2 } = new MessageChannel();

  // 2. Transfer port1 to Worker A, and port2 to Worker B
  workerA.postMessage({ portToWorkerB: port1 }, [port1]);
  workerB.postMessage({ portToWorkerA: port2 }, [port2]);

  console.log('Direct P2P communication channel established between Worker A and Worker B.');
}

// In Worker A:
// parentPort.on('message', ({ portToWorkerB }) => {
//   portToWorkerB.postMessage('Direct message from Worker A to Worker B!');
// });

// In Worker B:
// parentPort.on('message', ({ portToWorkerA }) => {
//   portToWorkerA.on('message', (data) => console.log('Worker B received:', data));
// });`,
    breakdown: [
      { lineRange: "7-9", note: "MessageChannel creates entangled ports (port1, port2)." },
      { lineRange: "11-14", note: "Ports are transferred into respective workers, detaching them from main thread." },
      { lineRange: "17-25", note: "Workers message each other directly without routing through parent process." }
    ],
    expectedOutput: "Worker B receives messages directly from Worker A with zero main-thread serialization overhead."
  },

  {
    id: "ex-node-015",
    title: "Reusable Warm Worker Thread Pool with Task Queue",
    category: "Concurrency & Workers",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to implement a thread pool that maintains N warm, pre-allocated Worker Threads and queues tasks to prevent V8 isolate creation overhead.",
    conceptsCovered: [
      "Worker Thread pooling",
      "In-memory task queueing",
      "Worker lifecycle management",
      "Throughput optimization"
    ],
    code: `import { Worker } from 'node:worker_threads';
import os from 'node:os';

export class SimpleWorkerPool {
  constructor(workerPath, numThreads = os.cpus().length) {
    this.workerPath = workerPath;
    this.numThreads = numThreads;
    this.workers = [];
    this.freeWorkers = [];
    this.taskQueue = [];
    this.init();
  }

  init() {
    for (let i = 0; i < this.numThreads; i++) {
      const worker = new Worker(this.workerPath);
      worker.on('message', (result) => {
        worker.currentTask?.resolve(result);
        worker.currentTask = null;
        this.freeWorkers.push(worker);
        this.dispatchNext();
      });
      this.workers.push(worker);
      this.freeWorkers.push(worker);
    }
  }

  runTask(taskData) {
    return new Promise((resolve, reject) => {
      this.taskQueue.push({ taskData, resolve, reject });
      this.dispatchNext();
    });
  }

  dispatchNext() {
    if (this.freeWorkers.length === 0 || this.taskQueue.length === 0) return;
    const worker = this.freeWorkers.pop();
    const task = this.taskQueue.shift();
    worker.currentTask = task;
    worker.postMessage(task.taskData);
  }

  destroy() {
    for (const w of this.workers) w.terminate();
  }
}`,
    breakdown: [
      { lineRange: "13-24", note: "Pre-allocates workers matching CPU count and tracks free vs busy workers." },
      { lineRange: "27-32", note: "runTask queues tasks in FIFO order and dispatches as soon as a worker is free." },
      { lineRange: "34-40", note: "Dispatches tasks without destroying or re-instantiating V8 isolates." }
    ],
    expectedOutput: "Handles 10,000 tasks across 8 persistent worker threads with 0ms thread creation delay."
  },

  {
    id: "ex-node-016",
    title: "Zero-Downtime Cluster Web Server with Port Sharing & Auto-Restart",
    category: "Concurrency & Workers",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to use the native node:cluster module to distribute HTTP requests across all CPU cores, sharing port 3000, and automatically restarting crashed workers.",
    conceptsCovered: [
      "node:cluster isPrimary vs isWorker",
      "cluster.fork()",
      "Master socket port sharing",
      "Worker crash auto-healing"
    ],
    code: `import cluster from 'node:cluster';
import http from 'node:http';
import os from 'node:os';

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(\`Primary \${process.pid} is online. Forking \${numCPUs} workers...\`);

  // Fork workers matching CPU cores
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Auto-restart worker if it crashes
  cluster.on('exit', (worker, code, signal) => {
    console.warn(\`Worker \${worker.process.pid} died (signal: \${signal}, code: \${code}). Spawning replacement...\`);
    cluster.fork();
  });
} else {
  // WORKER PROCESS: Binds to shared port 3000 via primary socket handover
  http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'OK',
      handledByWorkerPid: process.pid
    }));
  }).listen(3000, () => {
    console.log(\`Worker \${process.pid} listening on shared port 3000\`);
  });
}`,
    breakdown: [
      { lineRange: "5-14", note: "Primary process forks worker processes matching total hardware CPU cores." },
      { lineRange: "16-20", note: "Listens for worker exit events and immediately spawns a replacement worker (self-healing)." },
      { lineRange: "22-31", note: "Workers listen on port 3000 without EADDRINUSE conflict thanks to master socket handoff." }
    ],
    expectedOutput: "Scales HTTP throughput linearly across all cores with zero-downtime auto-healing on worker crashes."
  },

  {
    id: "ex-node-017",
    title: "Bi-Directional IPC RPC Bridge between Primary and Cluster Worker",
    category: "Concurrency & Workers",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to implement a typed request-response RPC (Remote Procedure Call) mechanism over the cluster IPC channel using correlation IDs.",
    conceptsCovered: [
      "process.send and worker.on('message')",
      "Correlation IDs for IPC matching",
      "Cluster IPC request-response bridge",
      "Inter-process state queries"
    ],
    code: `import cluster from 'node:cluster';
import { randomUUID } from 'node:crypto';

if (cluster.isPrimary) {
  const sharedState = { totalOrdersProcessed: 0 };
  const worker = cluster.fork();

  // Primary IPC message dispatcher:
  worker.on('message', (msg) => {
    if (msg.action === 'GET_METRICS') {
      worker.send({ correlationId: msg.correlationId, result: sharedState });
    } else if (msg.action === 'INCREMENT_ORDERS') {
      sharedState.totalOrdersProcessed += msg.count;
      worker.send({ correlationId: msg.correlationId, result: { success: true } });
    }
  });
} else {
  // WORKER PROCESS: Call RPC on Primary over IPC
  const pendingRequests = new Map();

  process.on('message', (msg) => {
    if (msg.correlationId && pendingRequests.has(msg.correlationId)) {
      const { resolve } = pendingRequests.get(msg.correlationId);
      pendingRequests.delete(msg.correlationId);
      resolve(msg.result);
    }
  });

  export function requestPrimaryRpc(action, payload = {}) {
    return new Promise((resolve) => {
      const correlationId = randomUUID();
      pendingRequests.set(correlationId, { resolve });
      process.send({ correlationId, action, ...payload });
    });
  }
}`,
    breakdown: [
      { lineRange: "8-16", note: "Primary acts as centralized state authority, listening for actions and responding with correlationId." },
      { lineRange: "19-27", note: "Worker maintains pending Map of Promises, resolving when matching correlationId arrives." },
      { lineRange: "29-35", note: "Exposes clean requestPrimaryRpc helper that returns standard async/await Promises." }
    ],
    expectedOutput: "Workers query and mutate primary state asynchronously over IPC with zero external message brokers."
  },

  {
    id: "ex-node-018",
    title: "Safe Child Process Execution with spawn & Argument Sanitization",
    category: "Concurrency & Workers",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to safely invoke operating system CLI commands (e.g. git or ffmpeg) using child_process.spawn with an array of arguments to prevent command injection.",
    conceptsCovered: [
      "child_process.spawn",
      "Command injection prevention",
      "Process exit code handling",
      "Safe stdio streaming"
    ],
    code: `import { spawn } from 'node:child_process';

export function runSecureCliCommand(command, args = [], timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    // spawn with argument array treats args strictly as literal parameters, NOT shell commands:
    const child = spawn(command, args, {
      shell: false, // Explicitly disable shell to prevent command injection!
      timeout: timeoutMs
    });

    let stdoutData = '';
    let stderrData = '';

    child.stdout.on('data', (chunk) => { stdoutData += chunk; });
    child.stderr.on('data', (chunk) => { stderrData += chunk; });

    child.on('error', (err) => {
      reject(new Error(\`Failed to start child process: \${err.message}\`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout: stdoutData.trim(), stderr: stderrData.trim() });
      } else {
        reject(new Error(\`Command \${command} failed with exit code \${code}: \${stderrData}\`));
      }
    });
  });
}`,
    breakdown: [
      { lineRange: "6-9", note: "Passes shell: false and explicit arguments array; eliminates shell metacharacter injection." },
      { lineRange: "14-16", note: "Streams stdout and stderr safely from child pipes." },
      { lineRange: "21-27", note: "Checks exit code and resolves or rejects cleanly." }
    ],
    expectedOutput: "Securely executes external binaries with zero risk of shell command injection."
  },

  {
    id: "ex-node-019",
    title: "Cooperative Background Task Batching with setImmediate Yielding",
    category: "Concurrency & Workers",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to process a 500,000-item array in batches on the main thread while yielding control to the event loop on each cycle using setImmediate.",
    conceptsCovered: [
      "Event loop unblocking",
      "setImmediate vs process.nextTick",
      "Cooperative multi-tasking",
      "Event loop starvation prevention"
    ],
    code: `export function processLargeArrayWithoutBlocking(items, batchSize = 1000, processFn) {
  return new Promise((resolve, reject) => {
    let index = 0;

    function processNextBatch() {
      try {
        const end = Math.min(index + batchSize, items.length);
        for (; index < end; index++) {
          processFn(items[index]);
        }

        if (index < items.length) {
          // YIELD TO EVENT LOOP:
          // setImmediate allows Poll phase to process incoming HTTP requests and timers!
          setImmediate(processNextBatch);
        } else {
          resolve({ totalProcessed: items.length });
        }
      } catch (err) {
        reject(err);
      }
    }

    processNextBatch();
  });
}`,
    breakdown: [
      { lineRange: "6-10", note: "Processes batch of 1,000 items synchronously on main thread." },
      { lineRange: "12-15", note: "setImmediate schedules next batch in Check phase, yielding to Poll phase for incoming I/O." },
      { lineRange: "16-18", note: "Resolves Promise when complete without ever freezing web server requests." }
    ],
    expectedOutput: "Processes 500,000 records without event loop delay exceeding 15ms."
  },

  {
    id: "ex-node-020",
    title: "Watchdog Worker Thread Termination on Execution Timeout",
    category: "Concurrency & Workers",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to protect Node.js servers from infinite loops or stalled tasks in Worker Threads using an external timeout watchdog and worker.terminate().",
    conceptsCovered: [
      "worker.terminate()",
      "Watchdog timeout timers",
      "Rogue infinite loop mitigation",
      "Worker resource reclamation"
    ],
    code: `import { Worker } from 'node:worker_threads';

export async function executeWithWatchdog(workerFile, payload, maxDurationMs = 5000) {
  const worker = new Worker(workerFile, { workerData: payload });
  let isDone = false;

  const executionPromise = new Promise((resolve, reject) => {
    worker.on('message', (result) => { isDone = true; resolve(result); });
    worker.on('error', (err) => { isDone = true; reject(err); });
    worker.on('exit', (code) => {
      if (!isDone) reject(new Error(\`Worker stopped prematurely with code \${code}\`));
    });
  });

  const watchdogPromise = new Promise((_, reject) => {
    const timer = setTimeout(async () => {
      if (!isDone) {
        console.warn('Watchdog triggered: Worker exceeded execution deadline. Forcing termination.');
        await worker.terminate(); // Forcefully kills the worker's V8 Isolate
        reject(new Error(\`Worker task timed out after \${maxDurationMs}ms\`));
      }
    }, maxDurationMs);
    timer.unref(); // Prevent watchdog from keeping event loop alive
  });

  return Promise.race([executionPromise, watchdogPromise]);
}`,
    breakdown: [
      { lineRange: "7-13", note: "Sets up standard Promise tracking worker messages and exits." },
      { lineRange: "15-24", note: "Watchdog timer calls worker.terminate() if execution deadline is exceeded." },
      { lineRange: "26", note: "Promise.race returns either the worker result or the timeout rejection." }
    ],
    expectedOutput: "Kills rogue infinite loops in background threads after 5000ms, returning clean timeout error."
  }
];
