const { createCard } = require("../js_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 89,
  category: "Iterators & Generators",
  concept: "The Iterable and Iterator Protocols",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What are the Iterable Protocol and Iterator Protocol in the ECMAScript specification?",
  answer: "The Iterable Protocol requires an object to have a method at key `[Symbol.iterator]` that returns an Iterator. The Iterator Protocol requires an object to have a `next()` method that returns an object conforming to `{ value: any, done: boolean }`. When `done: true`, iteration terminates.",
  explanation: "Built-in iterables include: `Array`, `String`, `Map`, `Set`, `TypedArray`, and `arguments`. Plain object literals `{}` are intentionally NOT iterable because there is no unambiguous universal order or definition (keys vs values vs entries). Any custom object can become iterable by implementing `[Symbol.iterator]`.",
  code: `// Custom Iterable Object
const countUpToThree = {
  [Symbol.iterator]() {
    let current = 1;
    return {
      next() {
        if (current <= 3) {
          return { value: current++, done: false };
        }
        return { value: undefined, done: true };
      }
    };
  }
};

// Works seamlessly with for...of loops and spread:
for (const num of countUpToThree) {
  console.log(num); // 1, 2, 3
}

console.log([...countUpToThree]); // [1, 2, 3]`,
  recallHint: "Iterable has [Symbol.iterator]() -> returns Iterator with next() -> returns { value, done }.",
  interviewTip: "Explain why plain objects don't implement Symbol.iterator by default (ambiguity between keys/values/prototypes) and how `Object.keys/values/entries` solves this.",
  tags: ["iterables", "iterator-protocol", "symbol-iterator", "for-of"]
}));

cards.push(createCard({
  idNum: 90,
  category: "Iterators & Generators",
  concept: "Generator Functions (function*) & yield",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How do Generator functions work and what does the yield operator do?",
  answer: "A generator function (`function*`) is a pausable function that returns a Generator object (which implements both Iterable and Iterator protocols). When invoked, its body does not execute immediately. Calling `gen.next()` runs execution until the next `yield` expression, which pauses execution and emits `{ value, done: false }`.",
  explanation: "Generators act as pausable coroutines. Unlike normal functions that run-to-completion, a generator yields control back to the caller while freezing its entire execution context, stack frame, and local variables in memory until `next()` is called again.",
  code: `function* idGenerator() {
  console.log("Started");
  yield 101;
  console.log("Resumed 1");
  yield 102;
  console.log("Resumed 2");
  return 103; // Final value with done: true
}

const gen = idGenerator(); // No console logs yet!

console.log(gen.next()); // "Started", { value: 101, done: false }
console.log(gen.next()); // "Resumed 1", { value: 102, done: false }
console.log(gen.next()); // "Resumed 2", { value: 103, done: true }`,
  recallHint: "function* returns generator. yield pauses execution, next() resumes.",
  interviewTip: "Note that `for...of` loops discard the `return` value of a generator because `done: true` indicates iteration is complete. Only `yield` values are processed by `for...of`.",
  tags: ["generators", "yield", "coroutines", "pausable-functions"]
}));

cards.push(createCard({
  idNum: 91,
  category: "Iterators & Generators",
  concept: "Two-Way Communication with generator.next(value)",
  priority: "advanced",
  difficulty: "advanced",
  question: "How does two-way communication work with generator functions via next(value)?",
  answer: "`yield` is an expression that both sends data out and receives data in. When `gen.next(arg)` is called, the argument passed into `next()` becomes the evaluated return value of the currently paused `yield` expression inside the generator.",
  explanation: "On the very first `gen.next()`, any argument passed is ignored because there is no paused `yield` waiting for a value; the first `next()` starts the generator up to the first `yield`. Subsequent `gen.next(val)` calls inject values directly back into the running generator state machine.",
  code: `function* conversation() {
  const name = yield "What is your name?";
  const language = yield \`Hello \${name}! What is your favorite language?\`;
  return \`Awesome, \${name} loves \${language}!\`;
}

const bot = conversation();

// 1. Start generator (arg ignored on first call)
console.log(bot.next().value); // "What is your name?"

// 2. Send "Alice" into the paused yield
console.log(bot.next("Alice").value); // "Hello Alice! What is your favorite language?"

// 3. Send "JavaScript" into the next paused yield
console.log(bot.next("JavaScript").value); // "Awesome, Alice loves JavaScript!"`,
  recallHint: "gen.next(val): val replaces the paused `yield` expression inside the generator.",
  interviewTip: "Remember that the first `.next()` can never receive an argument because no `yield` expression is waiting. Passing an argument to the 1st `next()` is silently ignored.",
  tags: ["generators", "two-way-communication", "next-args"]
}));

cards.push(createCard({
  idNum: 92,
  category: "Iterators & Generators",
  concept: "Generator Error Handling (.throw() & .return())",
  priority: "advanced",
  difficulty: "advanced",
  question: "How do generator.throw() and generator.return() alter generator execution from the outside?",
  answer: "`gen.throw(error)` injects an exception into the generator at the exact point where it is currently paused, triggering any enclosing `try...catch` block inside the generator. `gen.return(val)` immediately terminates the generator, executing any `finally` cleanup block and returning `{ value: val, done: true }`.",
  explanation: "These methods allow external orchestrators (like async runners or Redux Saga) to cancel generators or propagate errors into pausable coroutines cleanly. If the generator has a `try...finally` block, `gen.return()` guarantees that `finally` runs before closing.",
  code: `function* fileProcessor() {
  try {
    yield "Open file";
    yield "Read chunk";
  } catch (err) {
    console.log("Handled inside generator:", err.message);
  } finally {
    console.log("Cleanup: File closed");
  }
}

// 1. Testing .throw()
const gen1 = fileProcessor();
gen1.next(); // "Open file"
gen1.throw(new Error("Corrupt sector")); // Caught in try/catch!
// Logs: "Handled inside generator: Corrupt sector" -> "Cleanup: File closed"

// 2. Testing .return() early termination
const gen2 = fileProcessor();
gen2.next();
console.log(gen2.return("Aborted")); // { value: "Aborted", done: true }
// Logs: "Cleanup: File closed"`,
  recallHint: "gen.throw(err) injects error at paused yield. gen.return(val) forces early exit + runs finally.",
  interviewTip: "This is the architectural foundation of Redux Saga's cancellation and error handling mechanisms.",
  tags: ["generators", "error-handling", "redux-saga", "cleanup"]
}));

cards.push(createCard({
  idNum: 93,
  category: "Iterators & Generators",
  concept: "Infinite Sequences & Lazy Evaluation",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How do generators enable infinite sequences and lazy evaluation with zero memory bloat?",
  answer: "Because generators compute their next value strictly on demand when `next()` is invoked, they can contain infinite loops (`while (true)`) without hanging the browser or overflowing memory. Values are generated lazily one at a time, consuming $O(1)$ memory.",
  explanation: "Standard arrays must evaluate and allocate all elements up front. If you need Fibonacci numbers or unique incremental IDs, creating an array of 1,000,000 items allocates megabytes of heap memory. An infinite generator computes each number only when asked, holding only the current state in memory.",
  code: `// Infinite Fibonacci Sequence in O(1) memory
function* fibonacci() {
  let prev = 0;
  let curr = 1;
  while (true) {
    yield curr;
    [prev, curr] = [curr, prev + curr];
  }
}

const fib = fibonacci();

// Take the first 5 numbers on demand
for (let i = 0; i < 5; i++) {
  console.log(fib.next().value); // 1, 1, 2, 3, 5
}

// Memory footprint remains constant O(1)!`,
  recallHint: "Generators evaluate on demand. while(true) yields infinite sequence in O(1) memory.",
  interviewTip: "Highlight that generators decouple the production of data from the consumption of data, allowing consumers to pull only what they need.",
  tags: ["generators", "infinite-sequences", "lazy-evaluation", "fibonacci"]
}));

cards.push(createCard({
  idNum: 94,
  category: "Iterators & Generators",
  concept: "Delegating Generators with yield*",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What does the yield* operator do and how does it delegate iteration?",
  answer: "`yield* iterable` delegates iteration control to another generator or iterable. It traverses the delegated iterable and yields each of its values directly to the outer caller. Furthermore, if the delegated generator returns a value (`return val`), `yield*` evaluates to that return value.",
  explanation: "Instead of writing an explicit `for (const item of subGen) yield item`, `yield* subGen` handles recursive delegation automatically, including forwarding `.next(val)`, `.throw(err)`, and `.return()` calls into the sub-generator.",
  code: `function* subTask() {
  yield "Step 1";
  yield "Step 2";
  return "Subtask Result"; // Return value captured by yield*!
}

function* mainTask() {
  yield "Main Start";
  const result = yield* subTask(); // Delegates to subTask
  yield \`Resumed with: \${result}\`;
  yield* [10, 20]; // Also delegates to normal iterables!
}

const runner = mainTask();
console.log([...runner]);
// ["Main Start", "Step 1", "Step 2", "Resumed with: Subtask Result", 10, 20]`,
  recallHint: "yield* delegates to another iterable. Evaluates to the return value of delegated generator.",
  interviewTip: "Point out that `yield*` captures the `return` value of the delegated generator, which is otherwise inaccessible to normal `for...of` loops.",
  tags: ["yield-star", "delegation", "generators", "composition"]
}));

cards.push(createCard({
  idNum: 95,
  category: "Iterators & Generators",
  concept: "Async Iterators & Symbol.asyncIterator",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is an Async Iterator and how does it differ from a synchronous Iterator?",
  answer: "An Async Iterator implements `[Symbol.asyncIterator]()` and returns an object whose `next()` method returns a **Promise** resolving to `{ value: any, done: boolean }`. It is designed for streaming data, web sockets, paginated network APIs, and file chunk streams.",
  explanation: "Synchronous iterators block execution until `{ value, done }` is returned. Async iterators allow the consumer to await each piece of data non-blockingly. They are consumed using the `for await...of` loop.",
  code: `// Custom Async Iterable
const slowClock = {
  [Symbol.asyncIterator]() {
    let tick = 1;
    return {
      async next() {
        if (tick <= 3) {
          await new Promise(r => setTimeout(r, 500)); // Simulate async delay
          return { value: tick++, done: false };
        }
        return { value: undefined, done: true };
      }
    };
  }
};

(async () => {
  for await (const time of slowClock) {
    console.log("Tick:", time); // Emits every 500ms
  }
})();`,
  recallHint: "Async Iterator: next() returns Promise<{ value, done }>. Consumed with for await...of.",
  interviewTip: "Mention that Node.js Readable streams and Web Streams API natively implement `Symbol.asyncIterator`.",
  tags: ["async-iterators", "symbol-asynciterator", "streaming", "for-await-of"]
}));

cards.push(createCard({
  idNum: 96,
  category: "Iterators & Generators",
  concept: "Async Generator Functions (async function*)",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is an Async Generator function and when should you use it?",
  answer: "An Async Generator (`async function*`) combines `async/await` and generator `yield`. It can both `await` asynchronous promises and `yield` values to the caller, producing an Async Generator Object consumed by `for await...of`.",
  explanation: "Async generators are the cleanest architectural pattern for streaming data: paginated REST API fetchers, database cursor streaming, and infinite server-sent event loops. They naturally manage backpressure: the generator will not fetch the next page until the consumer finishes processing the current item.",
  code: `// Paginated API fetcher using Async Generator
async function* fetchPages(baseUrl) {
  let page = 1;
  while (true) {
    const res = await fetch(\`\${baseUrl}?page=\${page}\`);
    const data = await res.json();
    if (!data.items || data.items.length === 0) break;

    for (const item of data.items) {
      yield item; // Yield items one-by-one!
    }
    page++;
  }
}

// Consumer handles streaming items with built-in backpressure:
// for await (const item of fetchPages('/api/items')) {
//   await processItem(item);
// }`,
  recallHint: "async function*: can await promises AND yield values. Ideal for paginated APIs & streams.",
  interviewTip: "Stress that async generators provide built-in backpressure: if `processItem` takes 5 seconds, the generator automatically pauses before fetching the next page.",
  tags: ["async-generators", "streaming", "pagination", "backpressure"]
}));

cards.push(createCard({
  idNum: 97,
  category: "Iterators & Generators",
  concept: "for await...of Loop Mechanics & Error Handling",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does the for await...of loop work and how does it handle errors in async streams?",
  answer: "`for await (const x of asyncIterable)` pauses the enclosing async function on each iteration, awaiting the Promise returned by `next()`. If a promise rejects, the loop catches or bubbles the error immediately, invoking the async iterator's `.return()` method to clean up resources.",
  explanation: "Can also be used with arrays of regular Promises: `for await (const res of [p1, p2, p3])`. It guarantees serial order, waiting for each Promise to resolve before advancing to the next iteration. Wrapping in `try...catch` handles stream errors cleanly.",
  code: `async function processStream(stream) {
  try {
    for await (const chunk of stream) {
      if (chunk.includes("ERROR")) {
        throw new Error("Stream data corruption detected");
      }
      console.log("Processing chunk:", chunk);
    }
  } catch (err) {
    console.error("Stream failed gracefully:", err.message);
  } finally {
    console.log("Stream reader closed");
  }
}`,
  recallHint: "for await...of awaits each next() promise serially. Rejection aborts loop and triggers finally.",
  interviewTip: "Explain that `for await...of` works on arrays of Promises (`[Promise1, Promise2]`), processing them sequentially in array order.",
  tags: ["for-await-of", "error-handling", "async-iteration"]
}));

cards.push(createCard({
  idNum: 98,
  category: "Iterators & Generators",
  concept: "Custom Range Generator Utility",
  priority: "intermediate",
  difficulty: "beginner",
  question: "How do you implement a Python-like range() utility in JavaScript using generators?",
  answer: "By creating a generator function `function* range(start, end, step = 1)` that yields numbers in sequence, consuming zero array memory.",
  explanation: "In Python, `range(1, 1000000)` creates an iterator. In JavaScript, naive developers often write `Array.from({ length: 1000000 })`, which allocates massive memory. A generator range computes values on the fly in $O(1)$ memory.",
  code: `function* range(start, end, step = 1) {
  if (end === undefined) {
    end = start;
    start = 0;
  }

  if (step > 0) {
    for (let i = start; i < end; i += step) {
      yield i;
    }
  } else if (step < 0) {
    for (let i = start; i > end; i += step) {
      yield i;
    }
  }
}

// Clean usage
for (const n of range(0, 10, 2)) {
  console.log(n); // 0, 2, 4, 6, 8
}

console.log([...range(5)]); // [0, 1, 2, 3, 4]`,
  recallHint: "range generator: function* range yields i in loop. Zero array allocation overhead.",
  interviewTip: "Contrasting `range()` generator ($O(1)$ space) with `Array.from({ length })` ($O(N)$ space) shows strong performance awareness.",
  tags: ["generators", "range-utility", "memory-optimization"]
}));

cards.push(createCard({
  idNum: 99,
  category: "Iterators & Generators",
  concept: "Generators as Cooperative Multitasking Coroutines",
  priority: "advanced",
  difficulty: "advanced",
  question: "How can generators be used to implement cooperative multitasking on the main thread?",
  answer: "By yielding control back to a central scheduler after processing a chunk of work. The scheduler uses `requestIdleCallback` or `setTimeout` to allow the browser to paint and handle user input events before calling `gen.next()` to resume the next work chunk.",
  explanation: "JavaScript is single-threaded. If a calculation takes 500ms, the UI completely freezes. By writing the heavy calculation as a generator that yields periodically (e.g. every 50 iterations), a scheduler can slice execution across frames, maintaining a smooth 60fps UI.",
  code: `function* heavyTask(items) {
  for (let i = 0; i < items.length; i++) {
    // Process item
    doHeavyMath(items[i]);
    // Yield every 100 items to yield thread
    if (i % 100 === 0) yield;
  }
}

function runCooperative(generator) {
  function step() {
    const start = performance.now();
    // Run for up to 10ms per frame
    while (performance.now() - start < 10) {
      const { done } = generator.next();
      if (done) return console.log("Task completed without freezing UI!");
    }
    // Yield thread to browser for render, resume on next frame
    requestAnimationFrame(step);
  }
  step();
}`,
  recallHint: "Cooperative multitasking: generator yields periodically, scheduler uses rAF to keep 60fps.",
  interviewTip: "Tie this directly to React Fiber. React Fiber's scheduler is fundamentally a cooperative multitasking reconciler inspired by this coroutine pattern.",
  tags: ["coroutines", "multitasking", "performance", "react-fiber"]
}));

cards.push(createCard({
  idNum: 100,
  category: "Iterators & Generators",
  concept: "Converting Object to Iterable with Object.entries()",
  priority: "beginner",
  difficulty: "beginner",
  question: "How do you make an ordinary object iterable using [Symbol.iterator] and Object.entries()?",
  answer: "By assigning `Object.entries(this)[Symbol.iterator]` to the object's `[Symbol.iterator]` property, or by implementing a generator method `*[Symbol.iterator]()` that yields `[key, value]` pairs.",
  explanation: "While plain objects cannot be looped with `for...of` out of the box, you can either loop over `Object.entries(obj)` directly, or attach `*[Symbol.iterator]() { for (const k of Object.keys(this)) yield [k, this[k]]; }` to the object or its prototype.",
  code: `const user = {
  name: "Alice",
  role: "Engineer",
  level: "Senior",

  // Make this specific object natively iterable:
  *[Symbol.iterator]() {
    for (const key of Object.keys(this)) {
      yield [key, this[key]];
    }
  }
};

// Now works directly with for...of:
for (const [key, value] of user) {
  console.log(\`\${key}: \${value}\`);
}
// name: Alice, role: Engineer, level: Senior`,
  recallHint: "Make object iterable: *[Symbol.iterator]() { for (const k in this) yield [k, this[k]]; }.",
  interviewTip: "Highlight that in standard code, `for (const [k, v] of Object.entries(obj))` is preferred over mutating prototypes, but knowing how to implement `Symbol.iterator` proves understanding of the protocol.",
  tags: ["object-iterable", "symbol-iterator", "object-entries"]
}));

module.exports = cards;
