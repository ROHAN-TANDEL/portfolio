const { createCard } = require("../js_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 63,
  category: "Asynchronous JavaScript",
  concept: "Browser Event Loop: Call Stack, Web APIs, & Queues",
  priority: "must-know",
  difficulty: "beginner",
  question: "How does the JavaScript runtime achieve non-blocking concurrency with a single-threaded Call Stack?",
  answer: "JavaScript delegates long-running tasks (network requests, DOM timers, file reads) to the browser host environment's multi-threaded C++ Web APIs. When a Web API completes, its callback is placed into an event queue. The Event Loop continuously checks if the Call Stack is empty; once empty, it dequeues callbacks and pushes them onto the Call Stack for execution.",
  explanation: "The runtime consists of: 1) Call Stack (synchronous execution, single thread). 2) Web APIs (background threads handling `fetch`, `setTimeout`, DOM events). 3) Task Queue / Macrotask Queue. 4) Microtask Queue (Promises, queueMicrotask). The event loop is the single coordinator moving tasks from queues to the stack.",
  code: `console.log("1: Synchronous start");

// Web API handles timer in background thread
setTimeout(() => {
  console.log("4: Macrotask timer callback");
}, 0);

// Microtask scheduled
Promise.resolve().then(() => {
  console.log("3: Microtask promise callback");
});

console.log("2: Synchronous end");

// Output Order: 1 -> 2 -> 3 -> 4`,
  recallHint: "Call Stack runs sync code. Web APIs run async tasks. Event loop moves callbacks to stack when empty.",
  interviewTip: "Clarify that JavaScript the engine (V8) is single-threaded, but the host runtime (browser/Node) provides multi-threaded background workers via Web APIs and Libuv.",
  tags: ["event-loop", "call-stack", "web-apis", "concurrency"]
}));

cards.push(createCard({
  idNum: 64,
  category: "Asynchronous JavaScript",
  concept: "Microtasks vs Macrotasks (Task Queues)",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is the priority difference between the Microtask Queue and the Macrotask (Task) Queue?",
  answer: "The Microtask Queue has absolute priority over the Macrotask Queue. After EVERY macrotask completes (or when the call stack empties), the event loop MUST drain the ENTIRE Microtask Queue to completion (including any microtasks queued during draining) before executing the next macrotask or performing a DOM render.",
  explanation: "Macrotasks: `setTimeout`, `setInterval`, `setImmediate` (Node), I/O, UI rendering events. Microtasks: `Promise.then/catch/finally`, `queueMicrotask()`, `MutationObserver`, `process.nextTick` (Node). If microtasks continuously schedule more microtasks, the event loop starves and UI rendering is blocked.",
  code: `console.log("Start");

setTimeout(() => console.log("Macrotask 1"), 0);

Promise.resolve()
  .then(() => {
    console.log("Microtask 1");
    return Promise.resolve();
  })
  .then(() => {
    console.log("Microtask 2 (queued during microtask phase)");
  });

setTimeout(() => console.log("Macrotask 2"), 0);

console.log("End");

// Output:
// Start -> End -> Microtask 1 -> Microtask 2 -> Macrotask 1 -> Macrotask 2`,
  recallHint: "Microtasks drain COMPLETELY before the next single macrotask can execute.",
  interviewTip: "Explain that DOM re-rendering occurs between macrotasks, AFTER the microtask queue has completely drained.",
  tags: ["microtasks", "macrotasks", "event-loop-priority"]
}));

cards.push(createCard({
  idNum: 65,
  category: "Asynchronous JavaScript",
  concept: "queueMicrotask() API vs setTimeout(fn, 0)",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "Why should queueMicrotask() be preferred over setTimeout(fn, 0) for deferring async execution?",
  answer: "`queueMicrotask(fn)` schedules work directly into the Microtask Queue, executing immediately after the current synchronous stack unwinds and BEFORE browser rendering or macrotasks. `setTimeout(fn, 0)` schedules into the Macrotask Queue, introduces a mandatory minimum 4ms clamp delay in nested calls, and waits for a full event loop rotation.",
  explanation: "Using `setTimeout(fn, 0)` to defer state updates can cause visible UI flickers because the browser may render a frame before the timeout executes. `queueMicrotask` guarantees execution before the browser paints the next frame, with zero timer overhead or clamping.",
  code: `function deferTask(action) {
  // Executes right after synchronous code, before render
  queueMicrotask(() => {
    action();
  });
}

console.log("A");
setTimeout(() => console.log("C: setTimeout(0)"), 0);
queueMicrotask(() => console.log("B: queueMicrotask"));
console.log("D");

// Output: A -> D -> B -> C`,
  recallHint: "queueMicrotask: runs before paint/macrotasks, no 4ms timer clamp, zero UI flicker.",
  interviewTip: "Highlight that `queueMicrotask` is standard across both browsers and Node.js (Node 11+), making it the universal standard for microtask scheduling.",
  tags: ["queuemicrotask", "settimeout", "performance", "event-loop"]
}));

cards.push(createCard({
  idNum: 66,
  category: "Asynchronous JavaScript",
  concept: "Evolution of Async: Callbacks & Inversion of Control",
  priority: "must-know",
  difficulty: "beginner",
  question: "What were the fundamental problems with asynchronous callbacks that led to Promises?",
  answer: "1) Callback Hell (Pyramid of Doom): deeply nested indentation making code unreadable. 2) Inversion of Control: handing your callback over to a 3rd-party function with no guarantees on whether it will be called never, once, or multiple times. 3) Fragmented Error Handling: requiring error-first parameters (`err, data`) manually checked at every level.",
  explanation: "Inversion of control is the most critical design flaw. When you pass `callback` to `externalLibrary.chargeCard(callback)`, you have zero control over whether they invoke it zero times, twice, or with an uncaught exception. Promises inverted this back: instead of passing your callback away, the function returns a Promise object to YOU, and you retain control over handling resolution.",
  code: `// Callback Hell & Inversion of Control
getUser(userId, (err, user) => {
  if (err) return handleError(err);
  getOrders(user.id, (err, orders) => {
    if (err) return handleError(err);
    getOrderDetails(orders[0].id, (err, details) => {
      if (err) return handleError(err);
      console.log(details);
    });
  });
});

// Promises flatten this into a linear pipeline:
getUser(userId)
  .then(user => getOrders(user.id))
  .then(orders => getOrderDetails(orders[0].id))
  .then(details => console.log(details))
  .catch(handleError);`,
  recallHint: "Callbacks suffer from: Pyramid of Doom, Inversion of Control, and manual error propagation.",
  interviewTip: "Focus on 'Inversion of Control'. Most candidates only mention readability, but losing control over callback execution is the real architectural problem Promises solved.",
  tags: ["callbacks", "inversion-of-control", "promises", "history"]
}));

cards.push(createCard({
  idNum: 67,
  category: "Asynchronous JavaScript",
  concept: "Promises: States & Promises/A+ Specification",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What are the three states of a JavaScript Promise and how is state immutability guaranteed?",
  answer: "A Promise has three mutually exclusive states: 1) Pending (initial state), 2) Fulfilled (operation succeeded with a value), 3) Rejected (operation failed with a reason). Once a Promise transitions to Fulfilled or Rejected, it becomes 'Settled' and permanently immutable; its state and value cannot change.",
  explanation: "Per the Promises/A+ spec: calling `resolve()` followed by `reject()` in an executor has no effect—the first state transition locks the Promise. Attaching `.then()` to an already-settled Promise still executes the callback asynchronously in a future microtask.",
  code: `const promise = new Promise((resolve, reject) => {
  resolve("First Success");
  reject("Ignored Error"); // No effect! Promise is already settled
  resolve("Second Success"); // No effect!
});

promise.then(val => console.log(val)); // "First Success"

// Attaching handler to settled promise still runs asynchronously
promise.then(val => console.log("Later handler:", val));
console.log("Synchronous code runs first!");

// Output:
// Synchronous code runs first!
// First Success
// Later handler: First Success`,
  recallHint: "States: Pending -> Fulfilled OR Rejected. Once settled, state is permanently locked and immutable.",
  interviewTip: "Emphasize that even if a Promise is ALREADY resolved, any `.then()` handler attached to it is guaranteed to execute asynchronously in a microtask, never synchronously.",
  tags: ["promises", "promises-aplus", "immutability"]
}));

cards.push(createCard({
  idNum: 68,
  category: "Asynchronous JavaScript",
  concept: "Promise Chaining & Return Value Unwrapping",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does Promise chaining work and how does returning a Promise inside .then() unwrap values?",
  answer: "Every call to `.then()` returns a brand new Promise. If the handler returns a primitive or object, the new Promise resolves with that value. If the handler returns another Promise, the outer Promise pauses and automatically 'unwraps' (adopts the state and resolved value of) the returned inner Promise.",
  explanation: "This automatic unwrapping prevents nested Promises (`Promise<Promise<T>>`). If a handler throws an error, the returned Promise immediately rejects with that error, bubbling down the chain until caught by the nearest `.catch()`.",
  code: `Promise.resolve(10)
  .then(val => {
    console.log("Step 1:", val); // 10
    // Returning a Promise automatically unwraps:
    return new Promise(resolve => setTimeout(() => resolve(val * 2), 50));
  })
  .then(val => {
    console.log("Step 2 (unwrapped):", val); // 20
    return val + 5; // Returning raw value wraps in resolved Promise
  })
  .then(val => {
    console.log("Step 3:", val); // 25
    throw new Error("Something broke!");
  })
  .catch(err => {
    console.log("Caught:", err.message); // "Caught: Something broke!"
  });`,
  recallHint: ".then() returns new Promise. Returning a Promise unwraps automatically. Throws bubble to .catch().",
  interviewTip: "Point out that forgetting to `return` inside `.then()` resolves the next step with `undefined`, which is a common developer bug.",
  tags: ["promise-chaining", "unwrapping", "error-bubbling"]
}));

cards.push(createCard({
  idNum: 69,
  category: "Asynchronous JavaScript",
  concept: "async/await Syntactic Desugaring",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does async/await work under the hood in the JavaScript engine?",
  answer: "`async/await` is syntactic sugar over Promises and Generator functions (coroutines). An `async` function always returns a Promise. When the engine encounters `await`, it pauses the function's execution context, wraps the awaited value in `Promise.resolve()`, attaches a microtask continuation callback, and returns control to the event loop.",
  explanation: "V8 models `async/await` as a pausable state machine. When the awaited Promise resolves, V8 pushes a microtask that resumes the function's Execution Context right where it paused, restoring its local variables and evaluating the next line.",
  code: `// async/await syntax:
async function fetchUserData(id) {
  try {
    const res = await fetch(\`/api/user/\${id}\`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("Error:", err);
  }
}

// Conceptual desugaring using Generator + Promise runner:
function spawn(generatorFn) {
  return function(...args) {
    const gen = generatorFn.apply(this, args);
    return new Promise((resolve, reject) => {
      function step(nextFn) {
        let next;
        try { next = nextFn(); } catch (e) { return reject(e); }
        if (next.done) return resolve(next.value);
        Promise.resolve(next.value).then(
          v => step(() => gen.next(v)),
          e => step(() => gen.throw(e))
        );
      }
      step(() => gen.next());
    });
  };
}`,
  recallHint: "async returns Promise. await pauses execution context, resumes on microtask resolution.",
  interviewTip: "Explaining how async/await can be polyfilled using Generators + Promises (`co` library pattern) demonstrates true mastery of JS concurrency.",
  tags: ["async-await", "generators", "desugaring", "coroutines"]
}));

cards.push(createCard({
  idNum: 70,
  category: "Asynchronous JavaScript",
  concept: "Promise.all() vs Promise.allSettled()",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is the difference between Promise.all() and Promise.allSettled()?",
  answer: "`Promise.all()` runs promises concurrently and rejects immediately (fail-fast) if ANY promise rejects, discarding the results of the others. `Promise.allSettled()` (ES2020) waits for ALL promises to complete, never short-circuiting on rejection, and returns an array of outcome objects: `{ status: 'fulfilled', value }` or `{ status: 'rejected', reason }`.",
  explanation: "Use `Promise.all` when all operations are interdependent and one failure invalidates the entire batch (e.g. multi-table database transaction). Use `Promise.allSettled` when operations are independent and you want partial success (e.g. sending 100 emails, logging analytics, batch dashboard metrics).",
  code: `const p1 = Promise.resolve("Data 1");
const p2 = Promise.reject(new Error("Network Failure"));
const p3 = Promise.resolve("Data 3");

// Promise.all: fails immediately on p2
Promise.all([p1, p2, p3])
  .then(results => console.log("All success:", results))
  .catch(err => console.log("All rejected with:", err.message));
// Logs: "All rejected with: Network Failure"

// Promise.allSettled: waits for all 3
Promise.allSettled([p1, p2, p3]).then(results => {
  results.forEach(res => {
    if (res.status === "fulfilled") {
      console.log("Success:", res.value);
    } else {
      console.log("Failed:", res.reason.message);
    }
  });
});`,
  recallHint: "Promise.all = fail-fast (1 error aborts all). Promise.allSettled = waits for all, reports status/value/reason.",
  interviewTip: "Highlight that in `Promise.all([p1, p2])`, if `p2` rejects, `p1` still continues running in background—Promise.all simply stops waiting for it; it does not cancel running operations.",
  tags: ["promise-all", "promise-allsettled", "concurrency", "error-handling"]
}));

cards.push(createCard({
  idNum: 71,
  category: "Asynchronous JavaScript",
  concept: "Promise.race() vs Promise.any()",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is the difference between Promise.race() and Promise.any()?",
  answer: "`Promise.race()` settles with the first promise that settles (whether it resolves OR rejects). `Promise.any()` (ES2021) ignores rejections and resolves with the FIRST promise that FULFILLS. It rejects only if ALL promises reject, returning an `AggregateError`.",
  explanation: "`Promise.race` is primarily used to implement network request timeouts (`Promise.race([fetchData(), timeout(5000)])`). `Promise.any` is used for fastest-replica architectures (querying 3 mirror servers or CDNs simultaneously and taking the first successful response).",
  code: `const slowSuccess = new Promise(r => setTimeout(() => r("Slow success"), 100));
const fastFail = new Promise((_, r) => setTimeout(() => r(new Error("Fast error")), 10));

// Promise.race: fastFail settles first -> rejects!
Promise.race([slowSuccess, fastFail])
  .then(res => console.log("Race won:", res))
  .catch(err => console.log("Race failed:", err.message));
// Logs: "Race failed: Fast error"

// Promise.any: ignores fastFail, waits for slowSuccess!
Promise.any([slowSuccess, fastFail])
  .then(res => console.log("Any succeeded:", res))
  .catch(err => console.log("All failed:", err.errors));
// Logs: "Any succeeded: Slow success"`,
  recallHint: "Promise.race = first to settle (resolve or reject). Promise.any = first to succeed (fulfill only).",
  interviewTip: "Mention that if all promises reject in `Promise.any()`, it throws an `AggregateError` whose `.errors` property contains the array of rejection reasons.",
  tags: ["promise-race", "promise-any", "aggregate-error", "timeouts"]
}));

cards.push(createCard({
  idNum: 72,
  category: "Asynchronous JavaScript",
  concept: "Cancellation with AbortController & AbortSignal",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How do AbortController and AbortSignal enable cancellation of asynchronous tasks and fetch requests?",
  answer: "An `AbortController` instance exposes an `abort()` method and a `signal` (`AbortSignal`) property. Passing `signal` into `fetch()` or async operations allows the caller to cancel the in-flight operation by invoking `controller.abort()`, which aborts underlying socket I/O and rejects the promise with an 'AbortError'.",
  explanation: "Before AbortController, promises were notoriously non-cancellable. `AbortSignal` is now the universal web standard for cancellation across browser `fetch`, DOM event listeners (`{ signal }`), Web Streams, and Node.js (`fs.promises`, `timers/promises`, `crypto`). `AbortSignal.timeout(ms)` (ES2022) provides declarative timeout cancellation.",
  code: `// 1. Manual cancellation
const controller = new AbortController();
const { signal } = controller;

fetch("https://api.example.com/data", { signal })
  .then(res => res.json())
  .catch(err => {
    if (err.name === "AbortError") {
      console.log("Fetch successfully cancelled by client!");
    }
  });

// Cancel after 200ms
setTimeout(() => controller.abort(), 200);

// 2. Modern declarative timeout with AbortSignal.timeout (ES2022)
fetch("https://api.example.com/slow", { signal: AbortSignal.timeout(3000) })
  .catch(err => console.log("Timed out after 3s:", err.name));`,
  recallHint: "AbortController: controller.abort() triggers signal.aborted -> rejects fetch with AbortError.",
  interviewTip: "Mention using `{ signal }` in `addEventListener(type, handler, { signal })` to cleanly remove event listeners without keeping function references.",
  tags: ["abort-controller", "abort-signal", "cancellation", "fetch"]
}));

cards.push(createCard({
  idNum: 73,
  category: "Asynchronous JavaScript",
  concept: "Unhandled Promise Rejections",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What happens when a Promise rejects and there is no .catch() attached, and how do you monitor it?",
  answer: "In the browser, an unhandled rejection emits an `'unhandledrejection'` event on `window`. In modern Node.js (15+), unhandled rejections trigger `--unhandled-rejections=strict`, which throws an uncaught exception and terminates the Node process with exit code 1. Global monitoring is set up via `window.addEventListener('unhandledrejection', handler)`.",
  explanation: "Historically in Node.js, unhandled rejections merely printed a deprecation warning. Because unhandled async errors represent corrupt state or silent failures, modern Node.js and browser telemetry treat them as critical fatal events. The event provides `.promise` and `.reason` properties.",
  code: `// Global browser listener
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled async error caught globally:", event.reason);
  // Prevent browser default console logging:
  event.preventDefault();
  // Send to error monitoring service (Sentry, Datadog):
  sendTelemetry({ error: event.reason, type: "UNHANDLED_PROMISE" });
});

// Trigger unhandled rejection
Promise.reject(new Error("Database connection lost"));`,
  recallHint: "Unhandled rejection: window 'unhandledrejection' event. In Node 15+, strictly crashes process.",
  interviewTip: "Always mention calling `event.preventDefault()` inside the `unhandledrejection` handler to suppress default console noise after shipping telemetry.",
  tags: ["unhandled-rejection", "error-monitoring", "telemetry"]
}));

cards.push(createCard({
  idNum: 74,
  category: "Asynchronous JavaScript",
  concept: "Async Execution Order Puzzle (Timers vs Promises)",
  priority: "must-know",
  difficulty: "advanced",
  question: "Predict the exact console output order of nested timers, promises, and synchronous code.",
  answer: "Synchronous code runs first. When stack empties, all microtasks drain completely. Next, the first macrotask executes; its completion triggers another full microtask drain before moving to subsequent macrotasks.",
  explanation: "Tracing the execution step-by-step: 1) Synchronous statements log immediately. 2) Microtasks queued during sync execution drain. 3) First timer macrotask executes, and any microtasks it schedules run immediately before the second timer macrotask can start.",
  code: `console.log("1");

setTimeout(() => {
  console.log("2");
  Promise.resolve().then(() => console.log("3"));
}, 0);

new Promise((resolve) => {
  console.log("4"); // Executor runs SYNCHRONOUSLY!
  resolve();
}).then(() => {
  console.log("5");
});

setTimeout(() => {
  console.log("6");
}, 0);

console.log("7");

// Step-by-step resolution:
// 1. Sync: logs "1", logs "4" (inside Promise constructor), logs "7"
// 2. Microtask queue: logs "5"
// 3. Macrotask queue timer 1: logs "2" -> queues microtask "3"
// 4. Microtask drain: logs "3"
// 5. Macrotask queue timer 2: logs "6"
// Output: 1, 4, 7, 5, 2, 3, 6`,
  recallHint: "Promise constructor executor runs synchronously! Output: 1 -> 4 -> 7 -> 5 -> 2 -> 3 -> 6.",
  interviewTip: "The most common trap in this puzzle is line 8: candidates often forget that the `new Promise(executor)` callback runs SYNCHRONOUSLY during instantiation, not in a microtask.",
  tags: ["event-loop", "interview-puzzle", "execution-order", "timers-vs-promises"]
}));

cards.push(createCard({
  idNum: 75,
  category: "Asynchronous JavaScript",
  concept: "Parallel vs Sequential Async Execution",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How do you distinguish between sequential execution and parallel execution in async/await?",
  answer: "Sequential execution occurs when `await` is placed directly in front of each asynchronous call (each operation waits for the previous one to finish, taking $T_1 + T_2$). Parallel execution initiates all operations immediately (calling functions without await to get Promise references), and then waits for all with `await Promise.all()`, taking $\\max(T_1, T_2)$.",
  explanation: "Writing `const a = await fetchA(); const b = await fetchB();` forces waterfall latency when the requests are independent. Parallel execution `const [a, b] = await Promise.all([fetchA(), fetchB()])` fires both requests simultaneously over separate HTTP connections.",
  code: `// Slow Sequential Waterfall: takes 100ms + 100ms = 200ms
async function fetchSequential() {
  const user = await fetchUser();       // Takes 100ms
  const posts = await fetchPosts();     // Takes 100ms
  return { user, posts };
}

// Fast Parallel Execution: takes max(100ms, 100ms) = 100ms
async function fetchParallel() {
  // Fire both requests concurrently!
  const userPromise = fetchUser();
  const postsPromise = fetchPosts();

  // Await both simultaneously
  const [user, posts] = await Promise.all([userPromise, postsPromise]);
  return { user, posts };
}`,
  recallHint: "Sequential: await one by one (waterfall sum). Parallel: fire all, await Promise.all (max duration).",
  interviewTip: "Look for accidental sequential awaits in loops! `for (const id of ids) await fetch(id)` is a sequential anti-pattern. Use `await Promise.all(ids.map(fetch))` instead.",
  tags: ["parallel", "sequential", "performance", "promise-all"]
}));

cards.push(createCard({
  idNum: 76,
  category: "Asynchronous JavaScript",
  concept: "Custom Promise.all Polyfill Implementation",
  priority: "advanced",
  difficulty: "advanced",
  question: "How do you implement a robust polyfill for Promise.all from scratch?",
  answer: "By returning a new Promise that tracks an array of results and a resolved counter. It iterates through the input iterable, wraps each item in `Promise.resolve()`, and on fulfillment stores the result at the exact original index and increments the counter. If the counter equals the total items, it resolves. If ANY item rejects, it immediately rejects the outer Promise.",
  explanation: "Crucial implementation details: 1) It must accept any iterable (like Sets), not just arrays. 2) An empty iterable `[]` must resolve immediately with `[]`. 3) Results must be stored by index (`results[i] = val`), not by `push()`, to preserve original ordering despite variable completion times.",
  code: `function promiseAll(iterable) {
  return new Promise((resolve, reject) => {
    const promises = Array.from(iterable);
    const total = promises.length;

    // Empty iterable resolves immediately
    if (total === 0) {
      return resolve([]);
    }

    const results = new Array(total);
    let completedCount = 0;

    promises.forEach((item, index) => {
      // Promise.resolve wraps raw values or promises
      Promise.resolve(item).then(
        (value) => {
          results[index] = value; // Preserve index position!
          completedCount++;
          if (completedCount === total) {
            resolve(results);
          }
        },
        (error) => {
          reject(error); // Fail-fast on first rejection
        }
      );
    });
  });
}`,
  recallHint: "Promise.all polyfill: counter + results array indexed by i. Fail-fast on reject, check counter === total.",
  interviewTip: "Never use `results.push(value)`! If promise #2 finishes before promise #1, pushing would corrupt the output array order. You must assign by index: `results[index] = value`.",
  tags: ["polyfill", "promise-all", "concurrency", "algorithms"]
}));

module.exports = cards;
