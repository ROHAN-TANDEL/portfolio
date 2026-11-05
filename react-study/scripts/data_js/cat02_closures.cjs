const { createCard } = require("../js_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 13,
  category: "Closures & Scope",
  concept: "Closure Definition & Internal [[Scopes]] Slot",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is a Closure in JavaScript, and how does the V8 engine store captured variables?",
  answer: "A closure is the combination of a function bundled together with references to its surrounding lexical environment. In V8, when an inner function accesses variables from an outer function, the engine detects this during parsing and allocates those variables on the Heap inside a 'Context' object, linked via the function's internal [[Scopes]] slot, surviving stack frame unwinding.",
  explanation: "Under normal circumstances, when a function finishes executing, its stack frame is popped and its local variables are destroyed. However, if an inner function outlives the outer function (e.g. returned, passed as callback, assigned to an event listener) and references outer variables, those variables are heap-allocated within an Environment Record. The inner function maintains a hidden reference via its internal `[[Scopes]]` property to this Heap Context.",
  code: `function createCounter(initialValue = 0) {
  // 'count' is allocated on the Heap Context because the returned function references it
  let count = initialValue;

  return {
    increment() { count++; return count; },
    decrement() { count--; return count; },
    getCount() { return count; }
  };
}

const counter = createCounter(10);
console.log(counter.increment()); // 11
console.log(counter.getCount());  // 11`,
  recallHint: "Closure = Function + Lexical Scope reference. Captured variables reside on the Heap via [[Scopes]].",
  interviewTip: "Distinguish between stack allocation and heap allocation. When an interviewer asks 'where do closed-over variables live?', the answer is: on the V8 Heap in a Context object, NOT on the execution stack.",
  tags: ["closures", "v8", "memory", "lexical-environment"]
}));

cards.push(createCard({
  idNum: 14,
  category: "Closures & Scope",
  concept: "The Classic Loop Counter Closure Problem",
  priority: "must-know",
  difficulty: "beginner",
  question: "Why does a 'var' loop with setTimeout print the final index, and how do 'let' and closures fix it?",
  answer: "Because 'var' is function-scoped, a single shared binding 'i' exists across all loop iterations. By the time the asynchronous setTimeout callbacks execute, the loop has completed and 'i' equals its final value. 'let' solves this because it creates a brand new binding and lexical environment per iteration.",
  explanation: "With 'var i = 0', every setTimeout callback captures the exact same reference to 'i'. With 'let i = 0', the ECMAScript specification explicitly specifies that each iteration receives a fresh Lexical Environment where 'i' is initialized with the current iteration's value. Alternatively, wrapping in an IIFE creates a closed-over function scope per iteration.",
  code: `// Problem with 'var': prints 3, 3, 3
for (var i = 0; i < 3; i++) {
  setTimeout(() => console.log("var:", i), 10);
}

// Solution 1: ES6 'let' (fresh lexical binding per iteration) -> prints 0, 1, 2
for (let j = 0; j < 3; j++) {
  setTimeout(() => console.log("let:", j), 10);
}

// Solution 2: Pre-ES6 IIFE closure -> prints 0, 1, 2
for (var k = 0; k < 3; k++) {
  ((index) => {
    setTimeout(() => console.log("iife:", index), 10);
  })(k);
}`,
  recallHint: "var in for-loop = 1 shared binding. let in for-loop = 1 new binding PER iteration.",
  interviewTip: "This is one of the most frequently asked junior-to-mid interview questions. Explain that 'let' in a for-loop is specially treated by the JS engine to re-bind per iteration.",
  tags: ["closures", "loops", "settimeout", "var-vs-let"]
}));

cards.push(createCard({
  idNum: 15,
  category: "Closures & Scope",
  concept: "Data Privacy & Encapsulation via Closures",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How do closures enable true data privacy and encapsulation in JavaScript without classes?",
  answer: "By defining private variables inside an outer function scope and exposing only privileged methods (getters/setters) that close over them. External code cannot directly read or mutate the private variables because they are not properties of any object.",
  explanation: "Before ES2022 private class fields (`#field`), closures were the only mechanism in JavaScript to achieve true runtime privacy. The closed-over variables exist solely in the function's heap Environment Record. Privileged methods defined in that scope can manipulate them, but no object introspection (like `Object.keys()` or `for...in`) can access or tamper with them.",
  code: `function createBankAccount(owner, initialBalance) {
  // Completely private variables — inaccessible from outside
  let balance = initialBalance;
  const transactionLog = [];

  return {
    getOwner: () => owner,
    getBalance: () => balance,
    deposit: (amount) => {
      if (amount <= 0) throw new Error("Amount must be positive");
      balance += amount;
      transactionLog.push({ type: "DEPOSIT", amount, timestamp: new Date() });
      return balance;
    },
    getStatement: () => [...transactionLog] // Returns defensive shallow clone
  };
}

const account = createBankAccount("Alice", 1000);
account.deposit(500);
console.log(account.getBalance()); // 1500
console.log(account.balance);       // undefined (private!)`,
  recallHint: "Variables trapped in closure are invisible to external property inspection.",
  interviewTip: "Highlight that returning a defensive clone (`[...transactionLog]`) prevents external mutation of internal reference arrays.",
  tags: ["closures", "encapsulation", "data-privacy"]
}));

cards.push(createCard({
  idNum: 16,
  category: "Closures & Scope",
  concept: "The Module Pattern (IIFE)",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is the Module Pattern in JavaScript, and how does it leverage IIFEs and closures?",
  answer: "The Module Pattern uses an Immediately Invoked Function Expression (IIFE) that executes once and returns an object literal containing public methods and properties, while keeping private variables and helper functions hidden in the closure scope.",
  explanation: "Before native ES Modules (import/export), the Module Pattern was the cornerstone of architectural design in JavaScript. It prevents polluting the global namespace, encapsulates internal state, and provides a clear public API contract. The Revealing Module Pattern is a variation where private functions are defined first, and the returned object simply maps public names to internal function references.",
  code: `// Revealing Module Pattern
const ShoppingCart = (() => {
  // Private module state
  const items = [];

  function calculateTax(subtotal) {
    return subtotal * 0.08;
  }

  // Public methods
  function addItem(name, price) {
    items.push({ name, price });
  }

  function getTotal() {
    const subtotal = items.reduce((sum, item) => sum + item.price, 0);
    return subtotal + calculateTax(subtotal);
  }

  // Expose public API
  return {
    addItem,
    getTotal
  };
})();

ShoppingCart.addItem("Laptop", 1200);
console.log(ShoppingCart.getTotal()); // 1296
// ShoppingCart.calculateTax is undefined (private)`,
  recallHint: "Module Pattern = IIFE + private state + returned public API object.",
  interviewTip: "Explain how the Module Pattern solved the global namespace collision crisis in large client-side web apps before Webpack and ESM.",
  tags: ["module-pattern", "iife", "design-patterns"]
}));

cards.push(createCard({
  idNum: 17,
  category: "Closures & Scope",
  concept: "Memoization via Closures",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is memoization in JavaScript and how is it implemented using a closure cache?",
  answer: "Memoization is an optimization technique that caches the return values of expensive, pure function calls based on their input arguments. A higher-order function maintains a private cache object (or Map) in a closure, returning a wrapped function that checks the cache before executing.",
  explanation: "When the memoized function is called, it serializes its arguments into a cache key (or uses a Map for single objects). If the key exists, it returns the cached result immediately ($O(1)$ lookup time). If not, it executes the original function, stores the output in the closure cache, and returns it. Memoization requires functions to be pure (same input always produces same output with no side effects).",
  code: `function memoize(fn) {
  const cache = new Map(); // Private cache in closure scope

  return function(...args) {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key); // Cache hit
    }
    const result = fn.apply(this, args);
    cache.set(key, result);
    return result;
  };
}

const factorial = memoize(function(n) {
  if (n <= 1) return 1;
  return n * factorial(n - 1);
});

console.log(factorial(5)); // 120 (computed)
console.log(factorial(5)); // 120 (instant cache hit)`,
  recallHint: "Memoize = High-Order Function + private Map cache in closure. Only works on pure functions.",
  interviewTip: "Point out that `JSON.stringify(args)` works for simple primitives, but can fail for circular references, functions, or unordered object keys. In production, specialized key-generators or WeakMaps are preferred.",
  tags: ["memoization", "closures", "performance", "pure-functions"]
}));

cards.push(createCard({
  idNum: 18,
  category: "Closures & Scope",
  concept: "Function Currying & Partial Application",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is the difference between Currying and Partial Application?",
  answer: "Currying transforms a function of arity N into a sequence of N unary functions (each taking exactly 1 argument). Partial Application transforms a function of arity N into a function of lower arity by pre-fixing a subset of arguments.",
  explanation: "Currying: `f(a, b, c)` becomes `f(a)(b)(c)`. Partial application: `f(a, b, c)` becomes `f'(b, c)` by fixing `a`. Both rely heavily on closures to hold onto accumulated arguments until the required number of parameters has been supplied.",
  code: `// Generic Curry implementation
function curry(fn) {
  return function curried(...args) {
    if (args.length >= fn.length) {
      return fn.apply(this, args);
    }
    return function(...moreArgs) {
      return curried.apply(this, args.concat(moreArgs));
    };
  };
}

function multiply(a, b, c) {
  return a * b * c;
}

const curriedMult = curry(multiply);
console.log(curriedMult(2)(3)(4)); // 24
console.log(curriedMult(2, 3)(4)); // 24

// Partial application using bind
const double = multiply.bind(null, 2);
console.log(double(3, 4)); // 24`,
  recallHint: "Currying = takes 1 arg at a time until arity reached. Partial = fixes some args now, takes rest later.",
  interviewTip: "Explain `fn.length` in JavaScript: it represents the number of formal parameters declared on a function definition (excluding default values and rest parameters).",
  tags: ["currying", "partial-application", "functional-programming"]
}));

cards.push(createCard({
  idNum: 19,
  category: "Closures & Scope",
  concept: "Closure Memory Retention & Accidental Leaks",
  priority: "advanced",
  difficulty: "advanced",
  question: "How can closures inadvertently cause memory leaks in JavaScript applications?",
  answer: "When a closure retains a reference to an outer Lexical Environment, ALL variables in that scope shared across siblings can be retained on the Heap, even if the inner function only uses a small fraction of them. If the inner function is kept alive (e.g. global listener, timer), the entire scope cannot be garbage collected.",
  explanation: "In V8, closures that share the same outer context share a single Heap Context object. If one closure references a massive 50MB array and another closure references only a tiny integer, BOTH closures keep the entire Context object alive. If the tiny closure is stored in a global listener or timer, the 50MB array cannot be collected by GC.",
  code: `function setupListener() {
  const hugeData = new Array(1000000).fill("heavy string");
  const id = 12345;

  // Accidental leak: this closure captures 'id', but because of shared Context,
  // 'hugeData' might remain uncollected in certain JS engine optimization contexts
  // if another closure in the same scope references it!
  window.addEventListener("click", () => {
    console.log("Clicked:", id);
  });
}

// Clean pattern: isolate or null out large references
function setupListenerClean() {
  let hugeData = new Array(1000000).fill("heavy string");
  const processed = hugeData.length;
  hugeData = null; // Explicitly break reference for GC

  window.addEventListener("click", () => {
    console.log("Count:", processed);
  });
}`,
  recallHint: "Closures retain their enclosing Heap Context. Clear large unused references or remove listeners.",
  interviewTip: "Cite the famous Meteor.js closure leak bug ('Anatomy of a JavaScript Memory Leak') where sibling closures sharing an environment record kept large buffers pinned in memory.",
  tags: ["memory-leaks", "closures", "v8-heap", "garbage-collection"]
}));

cards.push(createCard({
  idNum: 20,
  category: "Closures & Scope",
  concept: "Event Handlers & Closure Capture",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "How do DOM event handlers utilize closures, and why is cleanup important?",
  answer: "DOM event listeners capture the variables of the scope where they were attached via closure. If the DOM element or the component is removed but the event listener is not unregistered (`removeEventListener`), the closure keeps the outer scope and DOM elements alive in memory.",
  explanation: "In modern SPAs (React, Vue), attaching event listeners to `window` or `document` inside a component mounts a long-lived closure reference. When the component unmounts, the global window still holds the callback, which holds the component's state and props via its `[[Scopes]]`. This leads to zombie callbacks and severe memory leaks.",
  code: `function attachHandler(element, config) {
  let clickCount = 0;

  function handleClick(e) {
    clickCount++;
    console.log(\`Clicked \${clickCount} times with config:\`, config.name);
  }

  element.addEventListener("click", handleClick);

  // Always return a cleanup function!
  return function cleanup() {
    element.removeEventListener("click", handleClick);
  };
}`,
  recallHint: "Event listener + closure = permanent retention until removeEventListener is called.",
  interviewTip: "Tie this directly to React's `useEffect` cleanup return function or Vue's `onUnmounted` hook.",
  tags: ["event-listeners", "dom", "cleanup", "closures"]
}));

cards.push(createCard({
  idNum: 21,
  category: "Closures & Scope",
  concept: "Function Composition (pipe & compose)",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "How do 'pipe' and 'compose' utilities leverage closures to chain operations?",
  answer: "'pipe' and 'compose' are higher-order functions that accept an array of functions and return a new function. When executed, they pass the output of one function as the input to the next. 'pipe' evaluates left-to-right, while 'compose' evaluates right-to-left.",
  explanation: "Both utilities use `Array.prototype.reduce` (or `reduceRight`) to sequentially apply functions. Closures capture the list of functions in the outer scope, creating a reusable data transformation pipeline with zero intermediate variable pollution.",
  code: `// pipe: left-to-right (f -> g -> h)
const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);

// compose: right-to-left (h(g(f(x))))
const compose = (...fns) => (x) => fns.reduceRight((v, f) => f(v), x);

const trim = (str) => str.trim();
const toLower = (str) => str.toLowerCase();
const wrapInTag = (tag) => (str) => \`<\${tag}>\${str}</\${tag}>\`;

const formatHeading = pipe(trim, toLower, wrapInTag("h1"));

console.log(formatHeading("   JavaScript Closures   ")); // "<h1>javascript closures</h1>"`,
  recallHint: "pipe = reduce left-to-right. compose = reduceRight right-to-left. Closed over function lists.",
  interviewTip: "Mention that pipe is favored in modern codebases because it reads naturally in the order of execution.",
  tags: ["pipe", "compose", "functional-programming", "closures"]
}));

cards.push(createCard({
  idNum: 22,
  category: "Closures & Scope",
  concept: "The 'once' Higher-Order Function",
  priority: "must-know",
  difficulty: "beginner",
  question: "How do you implement a 'once' function that guarantees a function runs only once?",
  answer: "By wrapping the target function in an outer function that maintains a boolean flag ('hasRun') and a cached result variable in its closure. On subsequent calls, it skips execution and returns the cached result.",
  explanation: "The 'once' pattern is essential for initialization logic, payment processing buttons, or teardown tasks. The closure retains `hasRun` and `result`. After the first execution, `fn` reference can even be set to `null` to allow GC of the original function and its bound dependencies.",
  code: `function once(fn) {
  let hasRun = false;
  let result;

  return function(...args) {
    if (!hasRun) {
      hasRun = true;
      result = fn.apply(this, args);
      fn = null; // Free function reference for Garbage Collection
    }
    return result;
  };
}

const initializeDatabase = once((dbName) => {
  console.log("Connecting to:", dbName);
  return { connected: true };
});

console.log(initializeDatabase("ProdDB")); // "Connecting to: ProdDB", returns { connected: true }
console.log(initializeDatabase("ProdDB")); // Returns { connected: true } without running again`,
  recallHint: "once = flag + cached result in closure. Nullify fn for GC optimization.",
  interviewTip: "Highlight setting `fn = null` inside `once`. Senior interviewers love seeing candidates actively thinking about memory and garbage collection.",
  tags: ["once", "high-order-functions", "closures"]
}));

cards.push(createCard({
  idNum: 23,
  category: "Closures & Scope",
  concept: "Closures vs Classes for Object Encapsulation",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What are the trade-offs between using Closures (factory functions) vs ES6 Classes for object encapsulation?",
  answer: "Closures (factory functions) provide true hard privacy and immunity to 'this' binding errors, but each instance re-allocates function closures in memory. Classes share methods via the prototype chain ($O(1)$ method memory), but historically lacked true privacy and suffer from 'this' context loss.",
  explanation: "With factory closures: `function create() { return { method() {} } }`, every instance gets its own copy of `method` in heap memory. With ES6 classes: methods live once on `Class.prototype`. In modern JavaScript (ES2022+), classes support private fields (`#private`), closing the privacy gap while preserving prototype memory efficiency.",
  code: `// Closure Factory: true privacy, but creates new function instances per object
function createPointClosure(x, y) {
  return {
    distance: () => Math.hypot(x, y) // New closure instance for each point
  };
}

// Class with Prototype: methods shared across all instances
class PointClass {
  #x; #y; // ES2022 private fields
  constructor(x, y) {
    this.#x = x;
    this.#y = y;
  }
  distance() {
    return Math.hypot(this.#x, this.#y); // Defined once on PointClass.prototype
  }
}`,
  recallHint: "Factory/Closure = true privacy, higher memory per instance. Class = shared prototype, lower memory.",
  interviewTip: "Explain that for 100,000 instances, classes are significantly more memory-efficient because methods reside on the prototype rather than being duplicated in every closure.",
  tags: ["classes", "factory-functions", "memory", "encapsulation"]
}));

cards.push(createCard({
  idNum: 24,
  category: "Closures & Scope",
  concept: "Closure Serialization & Worker Limitations",
  priority: "advanced",
  difficulty: "advanced",
  question: "Why cannot closures be serialized via JSON.stringify or passed to Web Workers via postMessage?",
  answer: "Closures cannot be serialized because they are bound to a runtime execution environment (the engine's internal [[Scopes]] and heap Context pointers). JSON and the HTML5 Structured Clone Algorithm only serialize data graphs, not executable code with active engine scope references.",
  explanation: "A closure is not just code; it is code + live memory environment. If you pass a closure to a Web Worker, that worker runs in a separate thread with its own isolated V8 Isolate and memory heap. The worker has no access to the main thread's heap variables. Thus, `postMessage` throws a `DataCloneError` when attempting to clone functions or closures.",
  code: `const secret = "my-secret-token";
const getSecret = () => secret;

// JSON serialization drops functions
console.log(JSON.stringify({ fn: getSecret })); // "{}"

// Web Worker structured clone throws DataCloneError
// const worker = new Worker("worker.js");
// worker.postMessage({ callback: getSecret }); 
// Uncaught DOMException: Failed to execute 'postMessage' on 'Worker': () => secret could not be cloned.`,
  recallHint: "Closures hold live heap pointers. Structured clone and JSON cannot serialize runtime memory environments.",
  interviewTip: "Great question when discussing Web Workers or Service Workers. Mention that code must be passed as strings or separate script files, and communication must be purely message/data driven.",
  tags: ["web-workers", "serialization", "structured-clone", "closures"]
}));

module.exports = cards;
