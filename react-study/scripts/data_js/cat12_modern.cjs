const { createCard } = require("../js_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 137,
  category: "Modern ECMAScript Standards",
  concept: "Optional Chaining (?.) & Short-Circuiting",
  priority: "must-know",
  difficulty: "beginner",
  question: "How does Optional Chaining (?.) work, and how does it short-circuit method and array calls?",
  answer: "Optional Chaining (`?.`) reads deeply nested property values without throwing a `TypeError` if an intermediate reference is nullish (`null` or `undefined`). If the reference before `?.` is nullish, expression evaluation immediately short-circuits and returns `undefined`.",
  explanation: "Optional chaining works for: 1) Property access: `obj?.prop`, 2) Bracket access: `obj?.[expr]` or `arr?.[0]`, 3) Function / Method calls: `fn?.()`. It does NOT suppress errors if the property exists but is not a function (e.g. `({ a: 123 }).a?.()` throws TypeError because 123 is not callable).",
  code: `const user = {
  profile: {
    getAvatar: () => "avatar.png"
  }
};

// 1. Property access
console.log(user?.profile?.name); // undefined (No TypeError thrown!)

// 2. Method call short-circuiting
console.log(user?.profile?.getAvatar?.()); // "avatar.png"
console.log(user?.settings?.getTheme?.()); // undefined (Short-circuits without calling!)

// 3. Array access
const list = null;
console.log(list?.[0]); // undefined`,
  recallHint: "Optional Chaining: returns undefined if nullish before ?.. Works for properties, brackets, and fn calls.",
  interviewTip: "Warn about the common pitfall: `obj?.fn()` only checks if `obj` or `fn` is nullish; if `obj.fn` is a number or string, calling it still throws `TypeError: not a function`.",
  tags: ["optional-chaining", "es2020", "short-circuiting", "defensive-coding"]
}));

cards.push(createCard({
  idNum: 138,
  category: "Modern ECMAScript Standards",
  concept: "Logical Assignment Operators (&&=, ||=, ??=)",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What are Logical Assignment Operators (&&=, ||=, ??=) and how do they differ from simple assignment?",
  answer: "Logical assignment operators combine logical operations with assignment, but with a critical difference: **they assign ONLY if the condition is met (short-circuit assignment)**. 1) `a ||= b`: assigns `b` only if `a` is falsy. 2) `a &&= b`: assigns `b` only if `a` is truthy. 3) `a ??= b`: assigns `b` only if `a` is nullish (`null` or `undefined`).",
  explanation: "Unlike `a = a || b`, which ALWAYS performs a write to property `a` (triggering setters even if `a` was already truthy), `a ||= b` performs NO write if `a` is already truthy. This avoids unnecessary setter invocations or reactive state triggers in frameworks.",
  code: `const config = {
  timeout: 0,
  title: ""
};

// Nullish assignment (??=): preserves 0 and empty string!
config.timeout ??= 3000;
console.log(config.timeout); // 0 (Preserved! Not overwritten)

config.missingHost ??= "localhost";
console.log(config.missingHost); // "localhost" (Was undefined, assigned!)

// Logical OR assignment (||=): assigns if falsy
config.title ||= "Default Title";
console.log(config.title); // "Default Title" (empty string was overwritten)

// Logical AND assignment (&&=): assigns if truthy
let user = { role: "admin" };
user.role &&= user.role.toUpperCase();
console.log(user.role); // "ADMIN"`,
  recallHint: "??= assigns only if nullish. ||= assigns only if falsy. &&= assigns only if truthy. Short-circuits writes!",
  interviewTip: "Mention that logical assignment avoids triggering property setters when the value doesn't need to change, which is a key performance win in reactive Proxy architectures.",
  tags: ["logical-assignment", "es2021", "nullish-assignment", "reactivity"]
}));

cards.push(createCard({
  idNum: 139,
  category: "Modern ECMAScript Standards",
  concept: "Dynamic import() & Top-Level await",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How do dynamic import() and Top-Level await transform modular JavaScript loading?",
  answer: "`import(specifier)` is a function-like expression that asynchronously loads an ES Module on demand at runtime, returning a Promise that resolves to the module namespace object. **Top-Level await** (ES2022) allows the `await` keyword to be used at the root level of ES modules without wrapping in an `async function`.",
  explanation: "`import()` enables code splitting, route-based lazy loading, and conditional module loading (e.g. loading a 10MB chart library only when the user opens the analytics tab). Top-Level await pauses module execution until dependencies or initialization configs resolve, blocking modules that depend on it until ready.",
  code: `// 1. Dynamic import on button click (Code Splitting)
async function renderChart() {
  const { Chart } = await import("./heavyChartLibrary.js");
  const chart = new Chart();
  chart.render();
}

// 2. Top-Level await in ES Module (configuration boot)
// --- config.js ---
// const connection = await db.connect(); // Pauses module loading until connected!
// export { connection };`,
  recallHint: "dynamic import(): loads module on demand (returns Promise). Top-Level await: await at module root.",
  interviewTip: "Point out that dynamic `import()` works in both ES Modules AND CommonJS scripts, providing a clean bridge between module systems.",
  tags: ["dynamic-import", "top-level-await", "code-splitting", "modules"]
}));

cards.push(createCard({
  idNum: 140,
  category: "Modern ECMAScript Standards",
  concept: "Array.prototype.at() for Relative Indexing",
  priority: "must-know",
  difficulty: "beginner",
  question: "Why was Array.prototype.at() introduced in ES2022, and how does it simplify negative indexing?",
  answer: "`arr.at(index)` accepts positive and negative integers. Negative integers count backward from the last element (`arr.at(-1)` is the last item). It replaces the clunky `arr[arr.length - 1]` syntax and works uniformly on Arrays, Strings, and TypedArrays.",
  explanation: "Standard bracket notation `arr[-1]` looks for the literal string property `'-1'` on the array object, returning `undefined`. `arr.slice(-1)[0]` works, but allocates a temporary 1-element array in memory. `arr.at(-1)` achieves clean relative lookup in $O(1)$ memory.",
  code: `const colors = ["red", "green", "blue", "yellow"];

// Old approaches to get last element:
console.log(colors[colors.length - 1]); // "yellow" (Verbose)
console.log(colors.slice(-1)[0]);       // "yellow" (Allocates temp array)

// Modern ES2022 approach with .at():
console.log(colors.at(-1)); // "yellow" (Last element)
console.log(colors.at(-2)); // "blue"   (Second to last)
console.log(colors.at(0));  // "red"    (First element)

// Also works on strings!
console.log("JavaScript".at(-1)); // "t"`,
  recallHint: "arr.at(-1) returns last element. Works on Arrays, Strings, and TypedArrays without temp allocations.",
  interviewTip: "Mention that `.at()` is read-only; you cannot assign to it (`arr.at(-1) = 'val'` is invalid). For negative index assignment, a Proxy is required.",
  tags: ["array-at", "es2022", "negative-indexing", "syntax"]
}));

cards.push(createCard({
  idNum: 141,
  category: "Modern ECMAScript Standards",
  concept: "Immutable Array Methods: toSorted, toReversed, toSpliced, with (ES2023)",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What are the 4 non-mutating Array methods introduced in ES2023?",
  answer: "1) `toSorted(compareFn)`: returns a sorted copy without mutating original. 2) `toReversed()`: returns a reversed copy. 3) `toSpliced(start, deleteCount, ...items)`: returns a copy with elements spliced. 4) `with(index, value)`: returns a copy with the element at `index` replaced by `value`.",
  explanation: "Historically, `arr.sort()`, `arr.reverse()`, and `arr.splice()` mutated the array in place, requiring defensive cloning (`[...arr].sort()`) to preserve immutability in React state or Redux reducers. ES2023 standardized native non-mutating versions.",
  code: `const numbers = [3, 1, 4, 1, 5, 9];

// 1. toSorted()
const sorted = numbers.toSorted((a, b) => a - b);
console.log(sorted);  // [1, 1, 3, 4, 5, 9]
console.log(numbers); // [3, 1, 4, 1, 5, 9] (Original untouched!)

// 2. toReversed()
console.log(numbers.toReversed()); // [9, 5, 1, 4, 1, 3]

// 3. toSpliced()
console.log(numbers.toSpliced(1, 2, 99)); // [3, 99, 1, 5, 9]

// 4. with(index, value) - single element immutable update
const updated = numbers.with(0, 100);
console.log(updated); // [100, 1, 4, 1, 5, 9]`,
  recallHint: "ES2023 Change-Array-by-Copy: toSorted, toReversed, toSpliced, with. None mutate original!",
  interviewTip: "Emphasize `arr.with(index, value)`. It is the cleanest way to immutably update a single array item in React state without spreading or slicing.",
  tags: ["es2023", "immutability", "tosorted", "toreversed", "tospliced", "with"]
}));

cards.push(createCard({
  idNum: 142,
  category: "Modern ECMAScript Standards",
  concept: "Error.cause & Structured Error Chaining (ES2022)",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does the Error.cause option (ES2022) improve error handling and debugging?",
  answer: "Passing `{ cause: originalError }` as the second argument to `new Error(message, { cause })` links the low-level cause to a high-level domain error. It creates an error chain preserving the original stack trace, root cause, and context across application layers.",
  explanation: "Before `Error.cause`, catching a database error and throwing a high-level `AppError('Failed to fetch user')` swallowed the original database error and stack trace unless you manually assigned custom properties. `error.cause` is standard and automatically formatted in modern console and error logging tools.",
  code: `async function fetchUserProfile(userId) {
  try {
    const res = await fetch(\`/api/users/\${userId}\`);
    if (!res.ok) throw new Error(\`HTTP \${res.status}: \${res.statusText}\`);
    return await res.json();
  } catch (originalError) {
    // Wrap low-level network error in domain error, preserving root cause!
    throw new Error(\`Failed to load user profile for ID \${userId}\`, {
      cause: originalError
    });
  }
}

// In error logger:
try {
  await fetchUserProfile(99);
} catch (err) {
  console.error("Top-level Error:", err.message);
  console.error("Original Root Cause:", err.cause.message);
}`,
  recallHint: "new Error(msg, { cause: err }): chains errors while preserving original stack trace.",
  interviewTip: "Mention that modern error tracking APMs (Sentry, Datadog) automatically inspect `.cause` to group errors by their underlying root cause.",
  tags: ["error-cause", "es2022", "error-handling", "debugging"]
}));

cards.push(createCard({
  idNum: 143,
  category: "Modern ECMAScript Standards",
  concept: "Array Grouping: Object.groupBy and Map.groupBy (ES2024)",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What are Object.groupBy() and Map.groupBy() in ES2024 and how do they replace lodash.groupBy?",
  answer: "`Object.groupBy(iterable, callback)` groups elements of an iterable into a plain object based on the string key returned by the callback. `Map.groupBy(iterable, callback)` groups elements into a `Map`, allowing arbitrary object keys or complex group identities.",
  explanation: "Array grouping is one of the most common data transformation tasks in application development. Previously, developers either used `lodash.groupBy` or wrote verbose `reduce()` accumulator loops. ES2024 standardized both object and Map-based grouping natively.",
  code: `const inventory = [
  { name: "Asparagus", type: "vegetables", quantity: 5 },
  { name: "Banana", type: "fruit", quantity: 0 },
  { name: "Goat", type: "meat", quantity: 23 },
  { name: "Cherries", type: "fruit", quantity: 5 }
];

// 1. Object.groupBy: keys are strings
const byType = Object.groupBy(inventory, item => item.type);
console.log(byType.fruit);
// [{ name: "Banana", ... }, { name: "Cherries", ... }]

// 2. Map.groupBy: keys can be complex objects or booleans
const byStock = Map.groupBy(inventory, item => (item.quantity > 0 ? "IN_STOCK" : "OUT_OF_STOCK"));
console.log(byStock.get("OUT_OF_STOCK"));
// [{ name: "Banana", type: "fruit", quantity: 0 }]`,
  recallHint: "ES2024: Object.groupBy() (string keys) & Map.groupBy() (any keys). Native replacement for lodash.groupBy.",
  interviewTip: "Highlight that `Object.groupBy` creates a null-prototype dictionary (`Object.create(null)` under the hood), meaning it has no prototype pollution vulnerabilities.",
  tags: ["object-groupby", "map-groupby", "es2024", "grouping"]
}));

cards.push(createCard({
  idNum: 144,
  category: "Modern ECMAScript Standards",
  concept: "Promise.withResolvers() (ES2024)",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is Promise.withResolvers() in ES2024 and what architectural problem does it solve?",
  answer: "`Promise.withResolvers()` returns an object containing a new `promise` and its corresponding `resolve` and `reject` functions: `{ promise, resolve, reject }`. It eliminates the need to extract `resolve` and `reject` from the `new Promise((res, rej) => {})` constructor closure into outer variables.",
  explanation: "In event-driven architectures, streams, or worker bridges, you frequently need to create a Promise and resolve it later from an external event handler. Previously, this required the awkward pattern: `let resolve; const p = new Promise(r => resolve = r);`. `Promise.withResolvers()` standardizes this directly.",
  code: `// Old, clunky extraction pattern:
let outerResolve, outerReject;
const oldPromise = new Promise((res, rej) => {
  outerResolve = res;
  outerReject = rej;
});

// Modern ES2024 standard:
const { promise, resolve, reject } = Promise.withResolvers();

// Resolve from anywhere (e.g. event listener or web socket handler)
function onSocketMessage(data) {
  if (data.success) {
    resolve(data.payload);
  } else {
    reject(new Error(data.error));
  }
}

promise.then(result => console.log("Received:", result));`,
  recallHint: "Promise.withResolvers(): returns { promise, resolve, reject }. No more extracting callbacks from constructor.",
  interviewTip: "This is one of the most practical additions in ES2024 for asynchronous queues, streaming buffers, and testing harnesses.",
  tags: ["promise-withresolvers", "es2024", "async", "design-patterns"]
}));

cards.push(createCard({
  idNum: 145,
  category: "Modern ECMAScript Standards",
  concept: "Explicit Resource Management: using & Symbol.dispose (ES2025)",
  priority: "advanced",
  difficulty: "advanced",
  question: "What is Explicit Resource Management (the 'using' declaration and Symbol.dispose) in JavaScript?",
  answer: "Explicit Resource Management introduces the `using` keyword and `[Symbol.dispose]()` / `[Symbol.asyncDispose]()` methods. Variables declared with `using` are guaranteed to have their disposal method automatically called when exiting the enclosing block scope `{ ... }`, ensuring deterministic cleanup of file handles, database connections, and locks without manual `try...finally` boilerplate.",
  explanation: "Similar to Python's `with` statement, C#'s `using`, or Go's `defer`. Even if an error is thrown inside the block, the engine guarantees that the `[Symbol.dispose]` method executes as the block unwinds.",
  code: `// Custom Disposable Resource
class DatabaseConnection {
  constructor(url) {
    this.url = url;
    console.log("Connected to DB");
  }

  query(sql) {
    return \`Result of \${sql}\`;
  }

  // Mandatory disposal hook
  [Symbol.dispose]() {
    console.log("Closed DB connection automatically on scope exit!");
  }
}

function runDatabaseTask() {
  // 'using' declaration binds lifetime to this block
  using conn = new DatabaseConnection("postgres://localhost:5432");
  
  console.log(conn.query("SELECT * FROM users"));
  // Block ends here: conn[Symbol.dispose]() is invoked AUTOMATICALLY!
}

runDatabaseTask();
// Output:
// Connected to DB
// Result of SELECT * FROM users
// Closed DB connection automatically on scope exit!`,
  recallHint: "using & Symbol.dispose: automatic deterministic resource cleanup on block exit. Replaces try/finally.",
  interviewTip: "Mention that this is Stage 3 (standardized for ES2025) and already supported in TypeScript 5.2+ and modern V8, revolutionizing resource cleanup.",
  tags: ["explicit-resource-management", "symbol-dispose", "using-declaration", "es2025"]
}));

cards.push(createCard({
  idNum: 146,
  category: "Modern ECMAScript Standards",
  concept: "Import Attributes & JSON Modules",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "How do Import Attributes (`with { type: 'json' }`) secure JSON module imports in modern JavaScript?",
  answer: "Import Attributes allow module import statements to specify expected metadata using the `with { ... }` syntax (e.g. `import config from './data.json' with { type: 'json' };`). It prevents security attacks where a server might deceptively serve executable JavaScript with a `.json` extension; the engine verifies that the MIME type and format match the attribute before execution.",
  explanation: "Formerly known as 'Import Assertions' (`assert { type: 'json' }`), TC39 updated the specification to 'Import Attributes' using the `with` keyword. Dynamic import also supports attributes: `import('./data.json', { with: { type: 'json' })`.",
  code: `// Static import with Import Attributes (ES2024/ES2025 standard)
// import packageData from "./package.json" with { type: "json" };
// console.log(packageData.version);

// Dynamic import with attributes:
async function loadConfig() {
  const config = await import("./config.json", {
    with: { type: "json" }
  });
  console.log("Loaded port:", config.default.port);
}`,
  recallHint: "Import Attributes: import data from './file.json' with { type: 'json' }. Prevents MIME confusion attacks.",
  interviewTip: "Note the syntax evolution: `assert { type: 'json' }` was deprecated and replaced with `with { type: 'json' }` in modern standards.",
  tags: ["import-attributes", "json-modules", "esm", "security"]
}));

cards.push(createCard({
  idNum: 147,
  category: "Modern ECMAScript Standards",
  concept: "Numeric Separators and Numeric Literals",
  priority: "beginner",
  difficulty: "beginner",
  question: "How do Numeric Separators (_) and modern numeric literals improve readability without runtime overhead?",
  answer: "Numeric Separators (`_`) allow inserting underscores between digits in numeric literals (`1_000_000`, `0xFF_AA_00`, `0b1010_0001`, `1_000_000n`) to improve visual readability. The underscores are purely visual sugar removed during tokenization; the engine treats `1_000_000` identically to `1000000` with zero runtime or memory overhead.",
  explanation: "Rules: Underscores cannot be placed at the very beginning (`_100` is an identifier), at the very end (`100_`), next to a decimal point (`1_.5` or `1._5`), or consecutively (`1__000`).",
  code: `const oneBillion = 1_000_000_000;
const bytes = 0b1010_0001_1000_0101; // Binary separator
const hexColor = 0xFF_77_AA;         // Hex separator
const microSeconds = 0.000_001;      // Decimal separator
const largeBigInt = 9_007_199_254_740_991n; // BigInt separator

console.log(oneBillion === 1000000000); // true (Zero runtime difference)`,
  recallHint: "Numeric separators: underscores between digits for readability. 1_000_000 === 1000000.",
  interviewTip: "Demonstrate using binary (`0b...`) and hex (`0x...`) separators for byte masks and network packet parsing.",
  tags: ["numeric-separators", "es2021", "readability", "numbers"]
}));

cards.push(createCard({
  idNum: 148,
  category: "Modern ECMAScript Standards",
  concept: "Temporal API (Stage 3 Replacement for Date)",
  priority: "advanced",
  difficulty: "advanced",
  question: "Why was the native JavaScript Date object fundamentally flawed, and what is the upcoming Temporal API?",
  answer: "The legacy `Date` object has severe design flaws: it is mutable (causing accidental bugs when passed between functions), poorly supports timezones (only UTC and system local), parses strings inconsistently across browsers, and has zero-indexed months (`0 = January`). The upcoming **Temporal** API (Stage 3) is a modern, immutable replacement providing dedicated types for plain dates, plain times, zoned date-times, and durations.",
  explanation: "Temporal types include: `Temporal.Now` (current time), `Temporal.PlainDate` (calendar date without time/timezone), `Temporal.PlainTime` (time without date), `Temporal.ZonedDateTime` (complete timestamp with IANA timezone), and `Temporal.Duration` (for duration math). All Temporal objects are strictly immutable.",
  code: `// Temporal API usage (Standardized replacement for Date):
// 1. Current zoned time in Tokyo
// const nowTokyo = Temporal.Now.zonedDateTimeISO("Asia/Tokyo");
// console.log(nowTokyo.toString()); // e.g. "2026-11-03T18:30:00+09:00[Asia/Tokyo]"

// 2. Clear Date math with Durations:
// const date = Temporal.PlainDate.from("2026-05-15");
// const nextMonth = date.add({ months: 1 });
// console.log(nextMonth.toString()); // "2026-06-15"

// 3. Immutability:
// 'date' is completely untouched by the .add() calculation!`,
  recallHint: "Temporal API: immutable, timezone-safe replacement for broken legacy Date. Distinct PlainDate, ZonedDateTime, Duration.",
  interviewTip: "Discussing the Temporal API proves that you track upcoming TC39 ECMAScript standards and understand why libraries like Moment.js, date-fns, and Luxon were needed.",
  tags: ["temporal-api", "tc39", "date-handling", "immutability"]
}));

module.exports = cards;
