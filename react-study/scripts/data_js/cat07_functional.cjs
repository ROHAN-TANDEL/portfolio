const { createCard } = require("../js_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 77,
  category: "Functional Programming",
  concept: "Pure Functions & Referential Transparency",
  priority: "must-know",
  difficulty: "beginner",
  question: "What defines a Pure Function and what is Referential Transparency?",
  answer: "A Pure Function satisfies two rules: 1) Deterministic (given the same input arguments, it always returns the exact same output). 2) Zero Side Effects (it does not mutate external state, modify its arguments, or perform I/O). Referential Transparency means an expression or function call can be replaced with its evaluated return value anywhere in the program without altering system behavior.",
  explanation: "Impure functions interact with external mutable state: reading `Date.now()`, `Math.random()`, querying the DOM, mutating variables outside their scope, or making HTTP calls. Pure functions are trivially unit-testable, inherently thread-safe, and safely memoizable.",
  code: `// Impure: relies on and mutates external state
let taxRate = 0.08;
function calculateTotalImpure(subtotal) {
  return subtotal + (subtotal * taxRate); // Impure: taxRate can change externally
}

// Pure: deterministic, zero side effects
function calculateTotalPure(subtotal, rate) {
  return subtotal + (subtotal * rate);
}

// Referential Transparency:
// calculateTotalPure(100, 0.08) can be replaced with 108 everywhere without bug risk.`,
  recallHint: "Pure Function: Same input -> same output, zero side effects. Can replace call with result.",
  interviewTip: "Mention that React components and Redux reducers are designed around the pure function contract.",
  tags: ["pure-functions", "referential-transparency", "functional-programming"]
}));

cards.push(createCard({
  idNum: 78,
  category: "Functional Programming",
  concept: "Array.prototype.reduce Polyfill & Mechanics",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does Array.prototype.reduce work, and how do you implement its polyfill handling initial values and empty arrays?",
  answer: "`reduce(callback, [initialValue])` executes a reducer function on each element of the array, passing the accumulated result from the previous iteration. If `initialValue` is provided, accumulator starts at `initialValue` and index starts at 0. If omitted, the first array element becomes the initial accumulator and iteration starts at index 1. Calling reduce on an empty array without an initialValue throws a TypeError.",
  explanation: "A robust polyfill must check for empty arrays without initial values (`TypeError: Reduce of empty array with no initial value`) and must correctly skip sparse array holes (`if (index in array)`).",
  code: `Array.prototype.myReduce = function(callback, initialValue) {
  if (this == null) throw new TypeError("Array.prototype.myReduce called on null or undefined");
  if (typeof callback !== "function") throw new TypeError(callback + " is not a function");

  const array = Object(this);
  const len = array.length >>> 0;
  let index = 0;
  let accumulator;

  if (arguments.length >= 2) {
    accumulator = initialValue;
  } else {
    // Find first non-empty hole
    while (index < len && !(index in array)) {
      index++;
    }
    if (index >= len) {
      throw new TypeError("Reduce of empty array with no initial value");
    }
    accumulator = array[index++];
  }

  while (index < len) {
    if (index in array) {
      accumulator = callback(accumulator, array[index], index, array);
    }
    index++;
  }

  return accumulator;
};

console.log([1, 2, 3, 4].myReduce((acc, n) => acc + n, 0)); // 10`,
  recallHint: "reduce: if no initialValue, 1st item is acc, start at index 1. Empty array without initialValue throws TypeError.",
  interviewTip: "Highlight handling sparse arrays (`index in array`) and throwing TypeError on empty arrays with no initial value. Senior interviewers specifically look for these edge cases.",
  tags: ["reduce", "polyfill", "array-methods", "edge-cases"]
}));

cards.push(createCard({
  idNum: 79,
  category: "Functional Programming",
  concept: "Shallow Copy vs Deep Copy",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is the difference between a Shallow Copy and a Deep Copy, and what are their modern implementations?",
  answer: "A Shallow Copy duplicates the top-level properties of an object/array, but any nested objects or arrays retain their original memory references (pointers). A Deep Copy recursively duplicates all levels of the object graph, creating completely independent copies at every depth. Modern standard: `structuredClone(obj)`.",
  explanation: "Shallow copy methods: Spread operator `{ ...obj }`, `Object.assign({}, obj)`, `[...arr]`, `arr.slice()`. Deep copy methods: 1) `structuredClone(obj)` (native modern web API, handles nested circular references, Sets, Maps, Dates, ArrayBuffers). 2) `JSON.parse(JSON.stringify(obj))` (flawed: drops functions, Symbols, undefined, converts Dates to strings, crashes on circular references). 3) Recursive custom clone.",
  code: `const original = {
  name: "Project",
  tags: ["alpha", "beta"],
  created: new Date()
};

// 1. Shallow Copy (Spread)
const shallow = { ...original };
shallow.tags.push("gamma"); // Mutates original.tags!
console.log(original.tags); // ["alpha", "beta", "gamma"] (Polluted!)

// 2. Native Deep Copy with structuredClone (ES2022)
const deep = structuredClone(original);
deep.tags.push("delta");
console.log(original.tags); // ["alpha", "beta", "gamma"] (Protected!)
console.log(deep.created instanceof Date); // true (Preserves rich types!)`,
  recallHint: "Shallow copy: copies pointers for nested objects. Deep copy: recursively duplicates all memory. Use structuredClone.",
  interviewTip: "Always recommend `structuredClone()`. Point out that `JSON.parse(JSON.stringify())` fails for Dates (stringified), undefined (stripped), and circular references (throws TypeError).",
  tags: ["shallow-copy", "deep-copy", "structuredclone", "immutability"]
}));

cards.push(createCard({
  idNum: 80,
  category: "Functional Programming",
  concept: "Custom Deep Clone Algorithm with Circular References",
  priority: "advanced",
  difficulty: "advanced",
  question: "How do you implement a recursive deepClone function that handles circular references?",
  answer: "By creating a recursive function that tracks cloned objects in a `WeakMap`. Before cloning an object, it checks if the object already exists in the WeakMap: if so, it returns the cached clone reference (breaking the infinite circular cycle); otherwise, it instantiates a new clone, stores it in the WeakMap, and recursively clones own properties via `Reflect.ownKeys()`.",
  explanation: "Using `WeakMap` is critical because it avoids memory leaks by allowing keys to be garbage-collected once cloning finishes. Using `Reflect.ownKeys` ensures both string and Symbol properties are copied.",
  code: `function deepClone(obj, hash = new WeakMap()) {
  // Handle primitives and null/undefined
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // Handle Dates and RegExps
  if (obj instanceof Date) return new Date(obj);
  if (obj instanceof RegExp) return new RegExp(obj.source, obj.flags);

  // Circular reference check
  if (hash.has(obj)) {
    return hash.get(obj);
  }

  // Create clone matching original prototype
  const clone = Array.isArray(obj) ? [] : Object.create(Object.getPrototypeOf(obj));
  hash.set(obj, clone);

  // Copy own keys (strings and Symbols)
  for (const key of Reflect.ownKeys(obj)) {
    clone[key] = deepClone(obj[key], hash);
  }

  return clone;
}

// Circular reference test:
const circularObj = { name: "Root" };
circularObj.self = circularObj;

const cloned = deepClone(circularObj);
console.log(cloned !== circularObj); // true
console.log(cloned.self === cloned);  // true (Circular link preserved!)`,
  recallHint: "deepClone with circular: WeakMap memoizes visited objects -> return hash.get(obj) if seen.",
  interviewTip: "Handling circular references with WeakMap is a standard top-tier interview question (FAANG/Tier-1). Be prepared to write this cleanly.",
  tags: ["deep-clone", "weakmap", "circular-references", "algorithms"]
}));

cards.push(createCard({
  idNum: 81,
  category: "Functional Programming",
  concept: "High-Order Functions: map vs flatMap",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is the difference between Array.prototype.map() and Array.prototype.flatMap()?",
  answer: "`map()` projects each element to a new value and returns an array of the same length. `flatMap()` (ES2019) maps each element using a mapping function and then flattens the result into a new array by depth 1. It is identical to `arr.map(fn).flat(1)`, but significantly more efficient as it performs mapping and flattening in a single iteration.",
  explanation: "`flatMap` is particularly useful for filtering and adding multiple items simultaneously: returning `[]` removes an element, returning `[x]` keeps one, and returning `[x, y]` expands it into multiple elements.",
  code: `const sentences = ["Hello world", "JavaScript functional"];

// map creates nested arrays:
console.log(sentences.map(s => s.split(" ")));
// [["Hello", "world"], ["JavaScript", "functional"]]

// flatMap maps and flattens in 1 pass:
console.log(sentences.flatMap(s => s.split(" ")));
// ["Hello", "world", "JavaScript", "functional"]

// Filter and expand simultaneously:
const numbers = [1, 2, 3, 4];
const result = numbers.flatMap(n => (n % 2 === 0 ? [n, n * 10] : []));
console.log(result); // [2, 20, 4, 40] (Odd numbers removed, even expanded!)`,
  recallHint: "flatMap = map + flat(1) in a single pass. Returning [] filters out, [a, b] expands.",
  interviewTip: "Demonstrate using `flatMap` to simultaneously filter and transform an array in one pass instead of chaining `.filter().map()` which traverses the array twice.",
  tags: ["flatmap", "map", "array-methods", "performance"]
}));

cards.push(createCard({
  idNum: 82,
  category: "Functional Programming",
  concept: "Idempotence in Functional JavaScript",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What is Idempotence in software engineering and JavaScript function design?",
  answer: "A function or operation is Idempotent if applying it multiple times produces the exact same state or result as applying it once: $f(f(x)) = f(x)$.",
  explanation: "Examples in math: `Math.abs(Math.abs(-5)) === Math.abs(-5)`. Examples in web: HTTP GET, PUT, and DELETE methods are idempotent (calling DELETE 5 times produces the same deleted state). In JavaScript state management, setting a status `user.status = 'ACTIVE'` is idempotent, whereas `user.loginCount++` is not. Idempotent functions make distributed systems and retry loops safe.",
  code: `// Idempotent: safe to retry repeatedly
function setFavorite(user, item) {
  return {
    ...user,
    favorites: Array.from(new Set([...user.favorites, item])) // Set deduplicates
  };
}

// Non-idempotent: retries corrupt state
function addFavoriteImpure(user, item) {
  user.favorites.push(item); // Calling 3 times adds 3 duplicates
  return user;
}`,
  recallHint: "Idempotent: f(f(x)) === f(x). Multiple invocations produce same outcome as 1 invocation.",
  interviewTip: "Tie idempotence to HTTP methods (GET/PUT/DELETE vs POST) and async network retry logic with exponential backoff.",
  tags: ["idempotence", "distributed-systems", "functional-design"]
}));

cards.push(createCard({
  idNum: 83,
  category: "Functional Programming",
  concept: "Point-Free Programming (Tacit Programming)",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What is Point-Free (Tacit) programming in JavaScript, and what are its pros and cons?",
  answer: "Point-free programming is a functional style where function definitions do not explicitly declare their arguments (the 'points'). Instead, functions are composed using existing functions whose signatures match.",
  explanation: "Example: instead of `words.map(w => w.toUpperCase())` or `numbers.filter(x => isEven(x))`, you write `numbers.filter(isEven)`. Pros: clean, concise, eliminates boilerplate. Cons: can obscure readability if overused, and risky if the consumer passes unintended extra arguments (e.g. `['1', '2', '3'].map(parseInt)` bug).",
  code: `// Point-ful style (explicit arguments)
const isPositive = (n) => n > 0;
const numbers = [-2, -1, 0, 1, 2];
const positivesPointful = numbers.filter((n) => isPositive(n));

// Point-free style (argument omitted)
const positivesPointFree = numbers.filter(isPositive);

// Famous Point-Free Pitfall:
// map passes (element, index, array) to parseInt!
console.log(["1", "2", "3"].map(parseInt)); 
// [1, NaN, NaN] (parseInt('2', 1) is NaN, parseInt('3', 2) is NaN!)

// Safe Point-Free:
console.log(["1", "2", "3"].map(Number)); // [1, 2, 3] (Number only takes 1 arg)`,
  recallHint: "Point-free: omit explicit argument declarations. Watch out for extra params in callbacks (map + parseInt).",
  interviewTip: "Always bring up `['1', '2', '3'].map(parseInt)` when discussing point-free programming. It is the classic JavaScript trivia question.",
  tags: ["point-free", "tacit-programming", "parseint-trap", "functional"]
}));

cards.push(createCard({
  idNum: 84,
  category: "Functional Programming",
  concept: "Transducers (Composable Transformation Pipelines)",
  priority: "advanced",
  difficulty: "advanced",
  question: "What problem do Transducers solve when chaining array methods on massive datasets?",
  answer: "Chaining standard array methods (`arr.filter().map().slice()`) creates intermediate temporary arrays in memory at every single step, requiring multiple full passes over the dataset. Transducers compose transformations into a single reducing function, processing each element through the entire pipeline in a single pass with $O(1)$ intermediate memory.",
  explanation: "If you have an array with 1,000,000 items, `arr.filter(f).map(m)` allocates a new 1,000,000-item array after `filter`, and another new array after `map`. A transducer combines `f` and `m` into a single reducer that processes one item at a time without allocating intermediate collections.",
  code: `// Transducer building blocks
const mapTransducer = (transform) => (step) => (acc, val) => step(acc, transform(val));
const filterTransducer = (predicate) => (step) => (acc, val) => predicate(val) ? step(acc, val) : acc;

// Standard push reducer step
const pushReducer = (acc, val) => { acc.push(val); return acc; };

// Compose transducers:
const pipe = (...fns) => (x) => fns.reduce((v, f) => f(v), x);

const isEven = (x) => x % 2 === 0;
const double = (x) => x * 2;

// Pipeline: filter even -> double
const xform = pipe(
  filterTransducer(isEven),
  mapTransducer(double)
)(pushReducer);

const bigData = [1, 2, 3, 4, 5, 6];
const result = bigData.reduce(xform, []); // Single pass, zero intermediate arrays!
console.log(result); // [4, 8, 12]`,
  recallHint: "Transducers: compose map/filter into single reducer. 1 pass, 0 intermediate arrays.",
  interviewTip: "Mentioning transducers demonstrates staff/principal-level functional programming maturity, particularly relevant for data-heavy analytics pipelines.",
  tags: ["transducers", "functional-programming", "performance", "reducers"]
}));

cards.push(createCard({
  idNum: 85,
  category: "Functional Programming",
  concept: "The Maybe Monad for Null-Safe Chaining",
  priority: "advanced",
  difficulty: "advanced",
  question: "What is the Maybe Monad and how does it encapsulate null/undefined checks in functional JavaScript?",
  answer: "The Maybe Monad is a functional wrapper type that represents optional values. It has two subtypes: `Just(value)` (representing a present value) and `Nothing()` (representing empty/null/undefined). Calling `.map(fn)` on a `Just` executes the function and re-wraps the result; calling `.map(fn)` on a `Nothing` safely short-circuits without executing the function or throwing errors.",
  explanation: "Before optional chaining (`?.`), deeply nested object lookups (`user.address.geo.lat`) were prone to `TypeError: Cannot read properties of undefined`. The Maybe monad solves this algebraically by containerizing values and abstracting away null checks.",
  code: `class Maybe {
  constructor(value) {
    this.$value = value;
  }

  static of(value) {
    return new Maybe(value);
  }

  isNothing() {
    return this.$value === null || this.$value === undefined;
  }

  map(fn) {
    return this.isNothing() ? this : Maybe.of(fn(this.$value));
  }

  getOrElse(fallback) {
    return this.isNothing() ? fallback : this.$value;
  }
}

// Safe chaining without crashes:
const user = { profile: null };

const city = Maybe.of(user)
  .map(u => u.profile)
  .map(p => p.address)
  .map(a => a.city)
  .getOrElse("Unknown City");

console.log(city); // "Unknown City" (No TypeError thrown!)`,
  recallHint: "Maybe Monad: Just(val) executes map(fn); Nothing() short-circuits. Safe null handling.",
  interviewTip: "Acknowledge that while optional chaining (`user?.profile?.address?.city ?? 'Unknown'`) is standard in modern JS, Monads provide a composable mathematical structure for complex functional pipelines.",
  tags: ["monads", "maybe-monad", "category-theory", "functional"]
}));

cards.push(createCard({
  idNum: 86,
  category: "Functional Programming",
  concept: "Immutable State Updates (Spread vs Mutations)",
  priority: "must-know",
  difficulty: "beginner",
  question: "How do you perform immutable updates on nested objects and arrays without libraries?",
  answer: "By creating shallow clones of each level of the object hierarchy being modified using the object spread (`{ ...obj }`) and array spread (`[...arr]`) operators, leaving unmodified branches untouched in memory (structural sharing).",
  explanation: "In React and Redux, state immutability is mandatory because change detection relies on shallow reference comparison (`prev !== next`). Mutating state directly (`state.user.name = 'Bob'`) fails to trigger re-renders because `state` retains the same memory pointer.",
  code: `const state = {
  user: {
    id: 1,
    preferences: { theme: "light", notifications: true }
  },
  posts: [101, 102]
};

// Immutable nested update: change theme to "dark" and add post 103
const nextState = {
  ...state,
  user: {
    ...state.user,
    preferences: {
      ...state.user.preferences,
      theme: "dark"
    }
  },
  posts: [...state.posts, 103]
};

// Structural Sharing verification:
console.log(nextState.user.preferences.theme); // "dark"
console.log(state.user.preferences.theme);     // "light" (Untouched!)
console.log(nextState.user.id === state.user.id); // true (Shared reference!)`,
  recallHint: "Immutable update: spread every level along the path of change. Unmodified branches share memory.",
  interviewTip: "Explain 'structural sharing': unmodified sub-trees are reused by reference, making immutable updates fast and memory-efficient.",
  tags: ["immutability", "spread-operator", "react-state", "structural-sharing"]
}));

cards.push(createCard({
  idNum: 87,
  category: "Functional Programming",
  concept: "The Either Monad for Functional Error Handling",
  priority: "advanced",
  difficulty: "advanced",
  question: "What is the Either Monad and how does it replace imperative try/catch blocks?",
  answer: "The Either Monad represents values with two possibilities: `Left(error)` representing failure, and `Right(value)` representing success. Functions chain operations on `Right` via `.map()`; if a step fails and returns `Left`, subsequent operations short-circuit and preserve the error.",
  explanation: "Imperative `try/catch` interrupts control flow and cannot be cleanly composed into functional pipelines (`pipe(f, g, h)`). The Either monad turns error handling into normal data transformation, keeping functions pure and composable.",
  code: `class Either {
  constructor(val) { this.$val = val; }
}

class Left extends Either {
  map() { return this; } // Short-circuit on error
  fold(errorFn, _) { return errorFn(this.$val); }
}

class Right extends Either {
  map(fn) { return Either.try(() => fn(this.$val)); }
  fold(_, successFn) { return successFn(this.$val); }
}

Either.try = (fn) => {
  try { return new Right(fn()); } catch (err) { return new Left(err.message); }
};

// Safe pipeline
const parseJson = (str) => Either.try(() => JSON.parse(str));
const extractId = (obj) => obj.id ? obj.id : (() => { throw new Error("Missing ID"); })();

parseJson('{"id": 42}')
  .map(extractId)
  .fold(
    err => console.log("Failed:", err),
    id => console.log("Success with ID:", id) // "Success with ID: 42"
  );`,
  recallHint: "Either Monad: Left = Error (short-circuits). Right = Success (continues). fold() resolves.",
  interviewTip: "Mention the convention: 'Right is right' (representing success), and 'Left' represents error/failure.",
  tags: ["either-monad", "error-handling", "functional-programming"]
}));

cards.push(createCard({
  idNum: 88,
  category: "Functional Programming",
  concept: "Debounce vs Throttle",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is the difference between Debounce and Throttle, and when should each be used?",
  answer: "Debounce delays function execution until after a specified wait time has elapsed since the LAST time the function was invoked (clustering burst calls into 1). Throttle guarantees that the function executes at most ONCE per specified time interval, regardless of how many times it is triggered.",
  explanation: "Use Debounce for: Search bar autocomplete inputs, window resize completion, auto-saving drafts. Use Throttle for: Scroll position tracking, mousemove tracking, infinite scroll triggers, game loop ticks.",
  code: `// Debounce implementation
function debounce(fn, delay) {
  let timerId;
  return function(...args) {
    clearTimeout(timerId);
    timerId = setTimeout(() => fn.apply(this, args), delay);
  };
}

// Throttle implementation
function throttle(fn, limit) {
  let inThrottle = false;
  return function(...args) {
    if (!inThrottle) {
      fn.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}`,
  recallHint: "Debounce: wait until typing stops. Throttle: execute at most once every X milliseconds.",
  interviewTip: "A staple interview question. Be ready to write both from scratch on a whiteboard with clean closures.",
  tags: ["debounce", "throttle", "performance", "high-order-functions"]
}));

module.exports = cards;
