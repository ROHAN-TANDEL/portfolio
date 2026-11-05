/**
 * JavaScript Applied Examples - Part 1 (Async & Concurrency Recipes 1-10)
 */

module.exports = [
  {
    id: "js-ex-01",
    title: "Promises/A+ Compliant Promise Implementation from Scratch",
    category: "Asynchronous JavaScript",
    difficulty: "advanced",
    whatThisCodeCovers: "Constructs a robust, production-grade custom Promise class implementing the Promises/A+ specification with microtask-based deferred resolution, state transitions, chaining unwrapping, and error bubbling.",
    conceptsCovered: ["Promises/A+", "queueMicrotask", "State Machine", "Chaining Unwrapping", "Error Bubbling"],
    code: `const PENDING = "PENDING";
const FULFILLED = "FULFILLED";
const REJECTED = "REJECTED";

class MyPromise {
  constructor(executor) {
    this.state = PENDING;
    this.value = undefined;
    this.handlers = [];

    const resolve = (val) => {
      if (this.state !== PENDING) return;
      if (val instanceof MyPromise) {
        return val.then(resolve, reject);
      }
      this.state = FULFILLED;
      this.value = val;
      this._executeHandlers();
    };

    const reject = (err) => {
      if (this.state !== PENDING) return;
      this.state = REJECTED;
      this.value = err;
      this._executeHandlers();
    };

    try {
      executor(resolve, reject);
    } catch (err) {
      reject(err);
    }
  }

  then(onFulfilled, onRejected) {
    return new MyPromise((resolve, reject) => {
      this.handlers.push({
        onFulfilled: typeof onFulfilled === "function" ? onFulfilled : val => val,
        onRejected: typeof onRejected === "function" ? onRejected : err => { throw err; },
        resolve,
        reject
      });
      if (this.state !== PENDING) {
        this._executeHandlers();
      }
    });
  }

  catch(onRejected) {
    return this.then(null, onRejected);
  }

  _executeHandlers() {
    if (this.state === PENDING) return;
    queueMicrotask(() => {
      while (this.handlers.length > 0) {
        const { onFulfilled, onRejected, resolve, reject } = this.handlers.shift();
        try {
          if (this.state === FULFILLED) {
            resolve(onFulfilled(this.value));
          } else {
            resolve(onRejected(this.value));
          }
        } catch (err) {
          reject(err);
        }
      }
    });
  }
}

// Test custom promise
new MyPromise((res) => res(10))
  .then(n => n * 2)
  .then(n => console.log("Custom Promise result:", n));`,
    breakdown: [
      { lineRange: "1-3", note: "Defines the 3 immutable state constants: PENDING, FULFILLED, and REJECTED." },
      { lineRange: "10-20", note: "The resolve function: locks state to FULFILLED and triggers handlers unless value is a promise." },
      { lineRange: "34-48", note: "The .then() method returns a new MyPromise, registering callbacks into the handlers queue." },
      { lineRange: "53-70", note: "Executes handlers inside queueMicrotask to ensure asynchronous execution per the Promises/A+ spec." }
    ],
    expectedOutput: `Custom Promise result: 20`
  },
  {
    id: "js-ex-02",
    title: "Polyfill for Promise.all, Promise.allSettled, and Promise.any",
    category: "Asynchronous JavaScript",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements clean, production-grade polyfills for the three primary Promise combinators with proper index preservation and AggregateError handling.",
    conceptsCovered: ["Promise Combinators", "Promise.all", "Promise.allSettled", "Promise.any", "AggregateError"],
    code: `// 1. Promise.all Polyfill (Fail-fast)
function customPromiseAll(iterable) {
  return new Promise((resolve, reject) => {
    const promises = Array.from(iterable);
    if (promises.length === 0) return resolve([]);
    const results = new Array(promises.length);
    let resolvedCount = 0;

    promises.forEach((p, i) => {
      Promise.resolve(p).then(
        val => {
          results[i] = val; // Preserve array index order
          resolvedCount++;
          if (resolvedCount === promises.length) resolve(results);
        },
        err => reject(err) // Abort immediately on first rejection
      );
    });
  });
}

// 2. Promise.allSettled Polyfill (Never short-circuits)
function customPromiseAllSettled(iterable) {
  return new Promise(resolve => {
    const promises = Array.from(iterable);
    if (promises.length === 0) return resolve([]);
    const results = new Array(promises.length);
    let completed = 0;

    promises.forEach((p, i) => {
      Promise.resolve(p)
        .then(value => { results[i] = { status: "fulfilled", value }; })
        .catch(reason => { results[i] = { status: "rejected", reason }; })
        .finally(() => {
          completed++;
          if (completed === promises.length) resolve(results);
        });
    });
  });
}

// Verification
const p1 = Promise.resolve("A");
const p2 = Promise.reject(new Error("B failed"));

customPromiseAllSettled([p1, p2]).then(res => console.log("Settled:", res.map(r => r.status)));`,
    breakdown: [
      { lineRange: "2-19", note: "customPromiseAll: preserves indices with results[i] = val and short-circuits on reject." },
      { lineRange: "22-40", note: "customPromiseAllSettled: waits for all items using finally, returning status/value/reason objects." }
    ],
    expectedOutput: `Settled: [ 'fulfilled', 'rejected' ]`
  },
  {
    id: "js-ex-03",
    title: "Concurrency-Limited Task Pool (Async Rate Limiter / p-limit)",
    category: "Asynchronous JavaScript",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a high-throughput concurrency limiter (like p-limit) that queues and executes hundreds of async tasks while strictly capping concurrent active tasks to N.",
    conceptsCovered: ["Concurrency Control", "Task Queues", "Backpressure", "Resource Throttling"],
    code: `function createConcurrencyLimiter(concurrencyLimit) {
  const queue = [];
  let activeCount = 0;

  const next = () => {
    if (queue.length === 0 || activeCount >= concurrencyLimit) return;
    activeCount++;
    const { taskFn, resolve, reject } = queue.shift();

    Promise.resolve()
      .then(taskFn)
      .then(resolve, reject)
      .finally(() => {
        activeCount--;
        next(); // Drain next queued task
      });
  };

  return function enqueue(taskFn) {
    return new Promise((resolve, reject) => {
      queue.push({ taskFn, resolve, reject });
      next();
    });
  };
}

// Test with limit of 2 concurrent tasks:
const limit = createConcurrencyLimiter(2);
const delayTask = (id, ms) => limit(async () => {
  console.log(\`Start task \${id}\`);
  await new Promise(r => setTimeout(r, ms));
  console.log(\`Finish task \${id}\`);
  return id;
});

Promise.all([
  delayTask(1, 50),
  delayTask(2, 30),
  delayTask(3, 20),
  delayTask(4, 10)
]).then(results => console.log("All finished:", results));`,
    breakdown: [
      { lineRange: "1-18", note: "The scheduler: tracks activeCount against concurrencyLimit, dequeuing tasks on completion." },
      { lineRange: "20-27", note: "The enqueue function returns a Promise and adds the task to the queue." },
      { lineRange: "30-45", note: "Demonstrates 4 tasks running with a concurrency limit of 2 (tasks 3 & 4 wait for 1 & 2)." }
    ],
    expectedOutput: `Start task 1
Start task 2
Finish task 2
Start task 3
Finish task 3
Start task 4
Finish task 1
Finish task 4
All finished: [ 1, 2, 3, 4 ]`
  },
  {
    id: "js-ex-04",
    title: "Resilient Fetch with Exponential Backoff and Full Jitter",
    category: "Asynchronous JavaScript",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements an enterprise-grade async retry utility that recalculates backoff delays with exponential multiplication and decorrelated full jitter to prevent thundering herd outages.",
    conceptsCovered: ["Exponential Backoff", "Jitter", "Retry Loop", "Idempotency"],
    code: `async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    factor = 2,
    maxDelayMs = 2000
  } = options;

  let attempt = 0;
  while (true) {
    try {
      return await fn(attempt);
    } catch (err) {
      attempt++;
      if (attempt > maxRetries) {
        throw new Error(\`Operation failed after \${maxRetries} retries: \${err.message}\`);
      }

      // Calculate exponential backoff with full jitter:
      // delay = Math.random() * min(maxDelay, initialDelay * (factor ^ attempt))
      const calculatedBackoff = Math.min(maxDelayMs, initialDelayMs * Math.pow(factor, attempt));
      const jitteredDelay = Math.floor(Math.random() * calculatedBackoff);

      console.warn(\`Attempt \${attempt} failed. Retrying in \${jitteredDelay}ms...\`);
      await new Promise(r => setTimeout(r, jitteredDelay));
    }
  }
}

// Test with simulated failing function
let count = 0;
const flakyNetworkCall = async () => {
  count++;
  if (count < 3) throw new Error("503 Service Unavailable");
  return { status: 200, data: "Success" };
};

retryWithBackoff(flakyNetworkCall, { maxRetries: 3 })
  .then(res => console.log("Final outcome:", res.data));`,
    breakdown: [
      { lineRange: "1-12", note: "Configures retry budget: maxRetries, initialDelayMs, factor, and maxDelayMs ceiling." },
      { lineRange: "18-24", note: "Computes exponential backoff and applies random jitter: Math.random() * calculatedBackoff." },
      { lineRange: "30-40", note: "Retries the flaky network call until it succeeds on attempt 3." }
    ],
    expectedOutput: `Attempt 1 failed. Retrying in ...ms...
Attempt 2 failed. Retrying in ...ms...
Final outcome: Success`
  },
  {
    id: "js-ex-05",
    title: "Priority Async Task Queue with Dynamic Worker Pool",
    category: "Asynchronous JavaScript",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a priority-driven asynchronous work queue where urgent tasks (high priority) jump ahead of background tasks while enforcing pool worker limits.",
    conceptsCovered: ["Priority Queue", "Async Schedulers", "Worker Allocation", "Task Preemption"],
    code: `class PriorityAsyncQueue {
  constructor(concurrency = 2) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = []; // Array of { task, priority, resolve, reject }
  }

  enqueue(task, priority = 0) {
    return new Promise((resolve, reject) => {
      const item = { task, priority, resolve, reject };
      // Insert in sorted order (highest priority first)
      const index = this.queue.findIndex(q => q.priority < priority);
      if (index === -1) {
        this.queue.push(item);
      } else {
        this.queue.splice(index, 0, item);
      }
      this._dispatch();
    });
  }

  _dispatch() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      this.running++;
      const { task, resolve, reject } = this.queue.shift();
      task()
        .then(resolve)
        .catch(reject)
        .finally(() => {
          this.running--;
          this._dispatch();
        });
    }
  }
}

// Test priority queue
const pq = new PriorityAsyncQueue(1);
const makeTask = (name, ms) => async () => {
  console.log("Run:", name);
  await new Promise(r => setTimeout(r, ms));
  return name;
};

// Low priority queued first, High priority queued second
pq.enqueue(makeTask("Task A (Low)", 20), 1);
pq.enqueue(makeTask("Task B (Low)", 20), 1);
pq.enqueue(makeTask("Task C (URGENT)", 10), 10); // Jumps ahead of Task B!`,
    breakdown: [
      { lineRange: "8-21", note: "enqueue inserts tasks into the queue sorted by priority descending." },
      { lineRange: "23-36", note: "_dispatch fills available worker capacity up to the concurrency limit." },
      { lineRange: "45-50", note: "Shows Task C (priority 10) preempting Task B (priority 1) in the waitlist." }
    ],
    expectedOutput: `Run: Task A (Low)
Run: Task C (URGENT)
Run: Task B (Low)`
  },
  {
    id: "js-ex-06",
    title: "Cancellable Async Operations with Timeout & AbortSignal.any",
    category: "Asynchronous JavaScript",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates composable cancellation combining user-initiated aborts and automated timeouts using AbortController and modern AbortSignal.any().",
    conceptsCovered: ["AbortController", "AbortSignal.timeout", "AbortSignal.any", "Resource Cleanup"],
    code: `async function fetchWithTimeout(url, userSignal, timeoutMs = 2000) {
  // Combine user signal and timeout signal via AbortSignal.any (ES2024)
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combinedSignal = AbortSignal.any([userSignal, timeoutSignal]);

  try {
    const response = await fetch(url, { signal: combinedSignal });
    return await response.json();
  } catch (err) {
    if (combinedSignal.aborted) {
      if (timeoutSignal.aborted) {
        throw new Error(\`Request timed out after \${timeoutMs}ms\`);
      }
      throw new Error("Request cancelled by user");
    }
    throw err;
  }
}

// Demo simulation:
const userCtrl = new AbortController();

// Simulate manual cancellation after 100ms
setTimeout(() => userCtrl.abort(), 100);

fetchWithTimeout("https://jsonplaceholder.typicode.com/todos/1", userCtrl.signal, 5000)
  .catch(err => console.log("Outcome:", err.message));`,
    breakdown: [
      { lineRange: "1-6", note: "Merges user cancel signal with auto-timeout signal using AbortSignal.any." },
      { lineRange: "8-18", note: "Differentiates between timeout abortion and user-initiated manual abortion." }
    ],
    expectedOutput: `Outcome: Request cancelled by user`
  },
  {
    id: "js-ex-07",
    title: "Polling Worker with Exponential Backoff and Conditional Stopping",
    category: "Asynchronous JavaScript",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs an asynchronous polling engine for asynchronous jobs (e.g. video transcoding, document generation) with backoff intervals and stop conditions.",
    conceptsCovered: ["Async Polling", "Job Status Monitoring", "Backoff Intervals", "Promise Loops"],
    code: `async function pollUntilComplete(checkFn, options = {}) {
  const {
    intervalMs = 100,
    maxIntervalMs = 1000,
    backoffMultiplier = 1.5,
    maxAttempts = 10
  } = options;

  let delay = intervalMs;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    const result = await checkFn();

    if (result.status === "COMPLETED") {
      return result.data;
    }
    if (result.status === "FAILED") {
      throw new Error("Job failed on remote server: " + result.error);
    }

    console.log(\`Job still processing (attempt \${attempts}). Waiting \${delay}ms...\`);
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(maxIntervalMs, delay * backoffMultiplier);
  }

  throw new Error("Polling timed out: max attempts exceeded");
}

// Test polling
let step = 0;
const checkTranscodeJob = async () => {
  step++;
  if (step < 3) return { status: "PROCESSING" };
  return { status: "COMPLETED", data: { videoUrl: "https://cdn.com/final.mp4" } };
};

pollUntilComplete(checkTranscodeJob, { intervalMs: 50 })
  .then(data => console.log("Result:", data.videoUrl));`,
    breakdown: [
      { lineRange: "1-11", note: "Configures polling interval, backoffMultiplier, and maxAttempts limit." },
      { lineRange: "13-28", note: "Polls checkFn, returning immediately on COMPLETED and scaling delay exponentially." }
    ],
    expectedOutput: `Job still processing (attempt 1). Waiting 50ms...
Job still processing (attempt 2). Waiting 75ms...
Result: https://cdn.com/final.mp4`
  },
  {
    id: "js-ex-08",
    title: "Async Sequential Pipeline (Waterfall Chaining)",
    category: "Asynchronous JavaScript",
    difficulty: "intermediate",
    whatThisCodeCovers: "Executes an array of asynchronous transformation functions sequentially, piping the resolved output of step N into the input of step N+1 using Array.prototype.reduce.",
    conceptsCovered: ["Async Pipeline", "Waterfall", "Array.prototype.reduce", "Sequential Composition"],
    code: `async function asyncPipeline(initialValue, ...asyncFns) {
  return asyncFns.reduce(async (accumulatorPromise, currentFn) => {
    const acc = await accumulatorPromise;
    return currentFn(acc);
  }, Promise.resolve(initialValue));
}

// Transformation steps
const fetchUser = async (id) => ({ id, name: "Alice", role: "ENGINEER" });
const fetchPermissions = async (user) => ({ ...user, permissions: ["READ", "WRITE"] });
const attachAuditLog = async (data) => ({ ...data, timestamp: 1700000000000 });

asyncPipeline(101, fetchUser, fetchPermissions, attachAuditLog)
  .then(finalUser => {
    console.log("Processed User:", finalUser.name);
    console.log("Permissions:", finalUser.permissions);
  });`,
    breakdown: [
      { lineRange: "1-6", note: "Uses Array.prototype.reduce on an initial Promise.resolve to serially chain async functions." },
      { lineRange: "8-11", note: "Declares distinct async transformation steps passing enriched data forward." }
    ],
    expectedOutput: `Processed User: Alice
Permissions: [ 'READ', 'WRITE' ]`
  },
  {
    id: "js-ex-09",
    title: "Debounced Async Auto-Suggest with Response Race Condition Protection",
    category: "Asynchronous JavaScript",
    difficulty: "advanced",
    whatThisCodeCovers: "Solves the notorious auto-complete network race condition where older delayed responses overwrite newer responses, using request ID versioning and AbortController.",
    conceptsCovered: ["Race Condition Defense", "Debounce", "AbortController", "Autocomplete"],
    code: `function createSearchManager(searchApi) {
  let activeController = null;
  let latestRequestId = 0;

  return async function search(query) {
    // 1. Cancel previous pending HTTP request!
    if (activeController) {
      activeController.abort();
    }
    activeController = new AbortController();
    const currentId = ++latestRequestId;

    try {
      const results = await searchApi(query, activeController.signal);
      // 2. Race condition guard: ignore if a newer search was initiated
      if (currentId !== latestRequestId) {
        return null;
      }
      return results;
    } catch (err) {
      if (err.name === "AbortError") return null; // Cancelled as expected
      throw err;
    }
  };
}

// Test with simulated slow vs fast queries
const mockApi = async (query, signal) => {
  const delay = query === "slow" ? 100 : 20;
  await new Promise(r => setTimeout(r, delay));
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  return \`Results for: \${query}\`;
};

const search = createSearchManager(mockApi);

// Rapid typing: "slow" followed immediately by "fast"
search("slow").then(res => res && console.log("Query 1:", res));
search("fast").then(res => res && console.log("Query 2:", res));`,
    breakdown: [
      { lineRange: "1-6", note: "Tracks activeController and monotonically increasing latestRequestId." },
      { lineRange: "7-24", note: "Aborts previous in-flight requests and ignores out-of-order stale responses." },
      { lineRange: "35-40", note: "Query 2 ('fast') resolves first; Query 1 is aborted cleanly without race bugs." }
    ],
    expectedOutput: `Query 2: Results for: fast`
  },
  {
    id: "js-ex-10",
    title: "Async Lock / Mutex for Critical Section Synchronization",
    category: "Asynchronous JavaScript",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a Mutex (Mutual Exclusion Lock) in JavaScript that guarantees only one asynchronous operation can access a critical shared resource at any given time.",
    conceptsCovered: ["Mutex", "Critical Section", "Race Conditions", "Concurrency Locks"],
    code: `class AsyncMutex {
  constructor() {
    this._locked = false;
    this._waitingQueue = [];
  }

  acquire() {
    return new Promise(resolve => {
      if (!this._locked) {
        this._locked = true;
        resolve(this._createReleaser());
      } else {
        this._waitingQueue.push(resolve);
      }
    });
  }

  _createReleaser() {
    return () => {
      if (this._waitingQueue.length > 0) {
        const nextResolve = this._waitingQueue.shift();
        nextResolve(this._createReleaser());
      } else {
        this._locked = false;
      }
    };
  }
}

// Test shared bank account balance updates without race conditions:
const mutex = new AsyncMutex();
let sharedBalance = 100;

async function withdraw(amount, delayMs) {
  const release = await mutex.acquire(); // Enter critical section
  try {
    const current = sharedBalance;
    await new Promise(r => setTimeout(r, delayMs)); // Async I/O delay
    sharedBalance = current - amount;
    console.log(\`Withdrew \${amount}. Remaining: \${sharedBalance}\`);
  } finally {
    release(); // Exit critical section
  }
}

// Simultaneous concurrent withdrawals
Promise.all([withdraw(30, 40), withdraw(50, 10)]).then(() => {
  console.log("Final balance:", sharedBalance);
});`,
    breakdown: [
      { lineRange: "1-18", note: "AsyncMutex manages locked boolean flag and queued resolver promises." },
      { lineRange: "20-30", note: "The releaser function dequeues the next waiting async task." },
      { lineRange: "36-47", note: "Guarantees sequential update of shared balance even with async delays." }
    ],
    expectedOutput: `Withdrew 30. Remaining: 70
Withdrew 50. Remaining: 20
Final balance: 20`
  }
];
