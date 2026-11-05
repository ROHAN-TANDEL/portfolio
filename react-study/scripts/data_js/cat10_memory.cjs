const { createCard } = require("../js_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 113,
  category: "Memory & Garbage Collection",
  concept: "JavaScript Memory Lifecycle (Allocation, Usage, Release)",
  priority: "must-know",
  difficulty: "beginner",
  question: "What are the three stages of the JavaScript memory lifecycle, and how does release differ from low-level languages?",
  answer: "The three stages are: 1) Allocate (memory is reserved by the engine when variables/objects are declared), 2) Use (read/write operations in code), and 3) Release (freeing memory when no longer needed). Unlike C/C++ where release is manual (`free()`), JavaScript employs an automatic Garbage Collector (GC) that periodically reclaims unreachable memory.",
  explanation: "Because memory management is automatic, developers often falsely assume they cannot cause memory leaks. However, memory leaks in JavaScript happen whenever an object is no longer needed by business logic, but remains reachable through the application's root reference graph.",
  code: `// 1. Allocation (Stack for primitives, Heap for objects)
let primitiveVal = 42; 
let heapObj = { name: "Project", data: new Array(1000) };

// 2. Usage (reading & mutating)
heapObj.name = "Updated Project";

// 3. Release (Garbage Collection)
// Nulling out root pointer makes the heap object unreachable!
heapObj = null; // Eligible for garbage collection on next GC cycle`,
  recallHint: "Memory lifecycle: Allocate -> Use -> Release. GC only releases UNREACHABLE memory.",
  interviewTip: "Clarify that garbage collection algorithms determine *reachability*, not *intent*. If a variable is reachable from a root, GC cannot release it, even if you never use it again.",
  tags: ["memory-lifecycle", "garbage-collection", "allocation"]
}));

cards.push(createCard({
  idNum: 114,
  category: "Memory & Garbage Collection",
  concept: "Stack vs Heap Memory in V8",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does the V8 engine partition memory between the Stack and the Heap?",
  answer: "The Stack stores static execution state: call stack execution context frames, primitive values, and references (memory addresses). Stack operations are extremely fast, managed automatically via LIFO CPU stack pointer adjustments. The Heap is a large, unstructured pool of memory used for dynamic, reference-type data (objects, arrays, functions, closures), managed by the Garbage Collector.",
  explanation: "Stack memory is bounded (causing 'Maximum call stack size exceeded' if blown). Heap memory is bounded by `--max-old-space-size` (~1.4GB on 64-bit systems by default, expandable to 4GB+). Objects and arrays always live on the Heap; stack variables merely store 64-bit pointer addresses pointing to those heap allocations.",
  code: `function runTask() {
  // 'id' and 'isActive' primitives allocated directly on stack frame
  const id = 101;
  const isActive = true;

  // 'user' pointer allocated on stack frame,
  // pointing to the object allocated in Heap memory!
  const user = { id, name: "Alice" };

  return user; // Function pops off stack, but user object survives in Heap!
}

const activeUser = runTask();`,
  recallHint: "Stack: execution contexts, primitives, memory pointers (LIFO). Heap: dynamic objects, arrays, closures (GC).",
  interviewTip: "Explain why closures force local variables to be allocated on the Heap rather than the Stack: because stack frames unwind on return, but closed-over variables must outlive the function.",
  tags: ["stack", "heap", "v8", "memory-architecture"]
}));

cards.push(createCard({
  idNum: 115,
  category: "Memory & Garbage Collection",
  concept: "Reference Counting GC vs Mark-and-Sweep",
  priority: "must-know",
  difficulty: "intermediate",
  question: "Why did modern JavaScript engines abandon Reference Counting in favor of Mark-and-Sweep garbage collection?",
  answer: "Reference Counting tracked the count of references pointing to each object, reclaiming memory when count hit 0. However, it completely fails on **Circular References**: if two objects reference each other, their counts never reach zero, causing permanent memory leaks. Modern engines use **Mark-and-Sweep**, which operates on 'reachability from roots' rather than reference count.",
  explanation: "In Mark-and-Sweep, the GC maintains a list of 'roots' (Global Object, active call stack execution contexts, DOM tree). It traverses the entire object graph, marking every object it can reach. In the sweep phase, any object that was not marked is reclaimed. Circular references that are disconnected from the roots are safely collected.",
  code: `// Circular reference problem (Killed Reference Counting GC):
function createCycle() {
  const objA = {};
  const objB = {};

  objA.other = objB; // objB refCount = 2
  objB.other = objA; // objA refCount = 2

  // Function finishes, stack references destroyed...
  // In Reference Counting: refCount is still 1 for both! Memory leaked!
  // In Mark-and-Sweep: Neither objA nor objB is reachable from Roots!
  // Both are swept and reclaimed cleanly!
}
createCycle();`,
  recallHint: "Reference counting fails on circular references. Mark-and-Sweep traces reachability from Roots.",
  interviewTip: "Explain what 'Roots' are in Mark-and-Sweep: 1) Global variables (`window`/`globalThis`), 2) Current call stack variables and execution contexts, 3) Active DOM trees.",
  tags: ["garbage-collection", "mark-and-sweep", "reference-counting", "circular-references"]
}));

cards.push(createCard({
  idNum: 116,
  category: "Memory & Garbage Collection",
  concept: "V8 Generational Garbage Collection (Young vs Old Generation)",
  priority: "advanced",
  difficulty: "advanced",
  question: "How does V8's Generational Garbage Collector exploit the 'Weak Generational Hypothesis'?",
  answer: "The Weak Generational Hypothesis states that 'most objects die young'. V8 splits the Heap into two spaces: 1) **Young Generation** (Nursery + Intermediate Semi-Spaces, managed by the fast **Scavenger / Minor GC** using the Cheney copying algorithm). 2) **Old Generation** (long-lived objects, managed by the **Major GC / Mark-Sweep-Compact**).",
  explanation: "New objects are allocated in the Nursery. When Minor GC runs, surviving objects are copied to the Intermediate space. If an object survives a second GC cycle, it is 'tenured' (promoted) into the Old Generation. Because Minor GC only copies surviving objects and ignores dead ones, it takes only 1–3ms. Major GC runs less frequently because full compaction is expensive.",
  code: `// Short-lived objects (collected rapidly in Young Gen Scavenge cycle):
function processBatch(items) {
  for (const item of items) {
    const formatted = { text: item.trim(), time: Date.now() }; // Dies within milliseconds!
    send(formatted);
  }
}

// Long-lived object (promoted to Old Generation):
const applicationCache = new Map(); // Lives for the lifetime of the process`,
  recallHint: "Weak Generational Hypothesis: most objects die young. Young Gen = Scavenger (fast). Old Gen = Mark-Sweep-Compact.",
  interviewTip: "Mentioning Cheney's copying algorithm and object promotion ('tenuring') from Young Generation to Old Generation signals senior/architect-level engine depth.",
  tags: ["v8", "generational-gc", "scavenger", "minor-gc", "major-gc"]
}));

cards.push(createCard({
  idNum: 117,
  category: "Memory & Garbage Collection",
  concept: "Memory Leak Pattern 1: Accidental Global Variables",
  priority: "must-know",
  difficulty: "beginner",
  question: "How do accidental global variables cause memory leaks in JavaScript and how is it prevented?",
  answer: "In non-strict mode, assigning to an undeclared variable (e.g. `foo = 'bar'`) or calling a function with unbound 'this' automatically attaches properties to the Global Object (`window` or `globalThis`). Because the Global Object is a permanent GC root that is never collected, all attached data remains pinned in memory forever. It is prevented using `'use strict'` or ES Modules.",
  explanation: "In modern JavaScript, writing in ES Modules (`type='module'`) enforces strict mode automatically. If you assign to an undeclared variable, it throws a `ReferenceError` instead of creating an accidental global leak.",
  code: `// Bug in non-strict script:
function leakData() {
  // Missing 'const' or 'let' -> attaches to window.leakedArray!
  leakedArray = new Array(1000000).fill("uncollected data");
  
  // Unbound 'this' in standalone function attaches to window!
  this.extraLeak = "more leaked data";
}
// leakData(); // Window holds permanent references to both!

// Defense: Strict mode throws ReferenceError
"use strict";
function safeData() {
  // badVar = 100; // ReferenceError: badVar is not defined
}`,
  recallHint: "Accidental globals: undeclared variables attach to window (a permanent GC root). Prevent with strict mode.",
  interviewTip: "Always emphasize that ES modules (`import/export`) operate in strict mode by default, eliminating accidental global leaks in modern toolchains.",
  tags: ["memory-leaks", "globals", "strict-mode"]
}));

cards.push(createCard({
  idNum: 118,
  category: "Memory & Garbage Collection",
  concept: "Memory Leak Pattern 2: Forgotten Timers & Callbacks",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How do forgotten setInterval timers and dangling callbacks cause memory leaks in single-page applications?",
  answer: "When `setInterval(callback, delay)` is initiated, the browser's internal timer Web API retains a live reference to the `callback` function. The callback's closure retains all variables in its enclosing scope. Even if the DOM element or UI component is destroyed, the timer keeps firing and prevents all captured objects from being garbage collected until `clearInterval()` is called.",
  explanation: "In React, if you start a timer in `useEffect` and forget to return a cleanup function `() => clearInterval(id)`, every time the component re-mounts, a new uncollected timer is spawned, multiplying memory consumption over time.",
  code: `// Memory Leak:
function mountComponent() {
  const hugeData = new Array(1000000).fill("heavy data");
  
  // Timer runs indefinitely in background Web API thread:
  setInterval(() => {
    console.log("Status check, data length:", hugeData.length);
  }, 1000);
}

// Clean Implementation: Always preserve ID and clear on teardown!
function mountComponentClean() {
  const hugeData = new Array(1000000).fill("heavy data");
  
  const timerId = setInterval(() => {
    console.log("Status check:", hugeData.length);
  }, 1000);

  return function unmount() {
    clearInterval(timerId); // Breaks Web API reference; allows GC!
  };
}`,
  recallHint: "setInterval stays alive in Web API root until clearInterval() is called. Always clean up timers.",
  interviewTip: "Tie this directly to React `useEffect` cleanup functions or Vue `onBeforeUnmount` lifecycle hooks.",
  tags: ["memory-leaks", "setinterval", "timers", "react-useeffect"]
}));

cards.push(createCard({
  idNum: 119,
  category: "Memory & Garbage Collection",
  concept: "Memory Leak Pattern 3: Detached DOM Trees",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is a Detached DOM Tree memory leak and why can a single JavaScript reference leak thousands of elements?",
  answer: "A Detached DOM Tree occurs when a DOM element is removed from the active document tree via `element.remove()` or `parent.removeChild()`, but a JavaScript variable or cache continues to hold a reference to that element (or any of its child nodes). The browser cannot garbage collect the element or ANY of its descendants.",
  explanation: "DOM nodes form a bidirectional tree: every child has a pointer to its parent (`parentNode`). If you remove a `<table>` with 10,000 rows, but your JavaScript holds a reference to a single `<td>` cell inside it, the entire `<table>` and all 10,000 siblings remain pinned in heap memory because the tree is transitively reachable.",
  code: `// Detached DOM leak example:
let cachedButton;

function setupUI() {
  const container = document.createElement("div");
  const button = document.createElement("button");
  container.appendChild(button);
  document.body.appendChild(container);

  // Storing reference in global variable
  cachedButton = button;

  // Later: UI is destroyed
  container.remove(); // Removed from active DOM tree!
  
  // BUT: cachedButton still references button!
  // Because button references container via parentNode,
  // the entire <div> subtree is now a DETACHED DOM LEAK!
}

// Fix: Nullify references when removing DOM nodes
function cleanupUI() {
  cachedButton = null; // Detached tree can now be garbage collected!
}`,
  recallHint: "Detached DOM: removed from document but retained in JS. A single child reference leaks the entire tree.",
  interviewTip: "Mention how to spot this in Chrome DevTools: search for 'Detached HTMLDivElement' (yellow/red text) in Heap Snapshots.",
  tags: ["detached-dom", "memory-leaks", "dom-nodes", "chrome-devtools"]
}));

cards.push(createCard({
  idNum: 120,
  category: "Memory & Garbage Collection",
  concept: "WeakMap and WeakSet: Garbage-Collectable Collections",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How do WeakMap and WeakSet prevent memory leaks compared to standard Map and Set?",
  answer: "In a standard `Map`, keys are held strongly: as long as the Map exists, the key object cannot be garbage collected. In a `WeakMap`, object keys are held **weakly**: if there are no other strong references to a key object anywhere else in the application, the object AND its value are automatically garbage collected.",
  explanation: "Key properties of `WeakMap`: 1) Keys MUST be objects (or registered symbols), not primitives. 2) Not enumerable (no `size`, no `keys()`, no `forEach()`), because GC timing is non-deterministic. Perfect for associating private metadata with DOM nodes or third-party objects without preventing GC.",
  code: `// Standard Map leaks memory:
const strongMap = new Map();
let domNode = document.createElement("div");
strongMap.set(domNode, { metadata: "Important data" });

domNode.remove();
domNode = null; 
// Leaked! strongMap STILL holds strong pointer to the div element!

// WeakMap automatically garbage collects:
const weakMap = new WeakMap();
let activeElement = document.createElement("button");
weakMap.set(activeElement, { clicks: 0 });

activeElement.remove();
activeElement = null; 
// Clean! On next GC cycle, button element and clicks metadata are reclaimed automatically!`,
  recallHint: "WeakMap: holds keys weakly. If no other strong references exist, key + value are garbage collected.",
  interviewTip: "Explain why WeakMaps have no `.size` or `.forEach`: because garbage collection is non-deterministic, the collection size could change mid-loop depending on engine GC passes.",
  tags: ["weakmap", "weakset", "garbage-collection", "memory-management"]
}));

cards.push(createCard({
  idNum: 121,
  category: "Memory & Garbage Collection",
  concept: "WeakRef & FinalizationRegistry (ES2021)",
  priority: "advanced",
  difficulty: "advanced",
  question: "What are WeakRef and FinalizationRegistry (introduced in ES2021), and what are their use cases and caveats?",
  answer: "`WeakRef` allows holding a weak reference to a target object without preventing it from being garbage collected, accessed via `ref.deref()`. `FinalizationRegistry` allows registering a cleanup callback that is executed by the engine AFTER a target object has been garbage collected.",
  explanation: "Use cases: Large memory caches (e.g. image buffers) where cached items can be safely dropped by GC under memory pressure, and native resource cleanup wrappers. Caveats: The TC39 specification explicitly warns against relying on `FinalizationRegistry` for critical business logic because GC runs non-deterministically and cleanup callbacks may be delayed or never executed before process exit.",
  code: `// 1. FinalizationRegistry: cleanup hook
const registry = new FinalizationRegistry((heldValue) => {
  console.log(\`Resource for \${heldValue} was just garbage collected!\`);
});

let heavyResource = { id: "res_987", data: new Uint8Array(1000000) };
registry.register(heavyResource, "heavyResource #987");

// 2. WeakRef: non-owning reference
const weakRef = new WeakRef(heavyResource);

// Accessing: deref() returns object if alive, undefined if collected
console.log(weakRef.deref()?.id); // "res_987"

// Release strong pointer
heavyResource = null;
// After next GC cycle: weakRef.deref() returns undefined, and registry logs cleanup!`,
  recallHint: "WeakRef: deref() reads object weakly. FinalizationRegistry: callback runs after object is collected.",
  interviewTip: "Quote the spec: 'Garbage collection is non-deterministic. Do not use FinalizationRegistry for essential state mutations or persistent storage saves.'",
  tags: ["weakref", "finalizationregistry", "es2021", "advanced-memory"]
}));

cards.push(createCard({
  idNum: 122,
  category: "Memory & Garbage Collection",
  concept: "Memory Profiling in Chrome DevTools (Heap Snapshots)",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What are the three essential memory profiling views in Chrome DevTools, and what is Shallow Size vs Retained Size?",
  answer: "The three views are: 1) **Heap Snapshot** (point-in-time memory state), 2) **Allocation instrumentation on timeline** (tracks memory allocations over time in blue/gray bars), 3) **Allocation Sampling** (low-overhead CPU-level heap sampling). **Shallow Size** is the memory held by the object itself (its properties and immediate pointers). **Retained Size** is the total memory that would be freed if this object were deleted (the object + its entire dependent retained subtree).",
  explanation: "When debugging memory leaks, sort constructors by **Retained Size**. A single tiny root object with a Shallow Size of only 32 bytes might have a Retained Size of 150MB because it holds the only reference preventing a massive data tree from being collected.",
  code: `// Visualizing Shallow vs Retained Size:
class Node {
  constructor() {
    this.buffer = new Array(1000000).fill("data"); // 8MB buffer
  }
}

const root = {
  // Shallow Size of 'root' = ~48 bytes (just holds pointer references)
  // Retained Size of 'root' = ~8MB + 48 bytes (freeing root frees buffer too!)
  head: new Node()
};`,
  recallHint: "Shallow Size: bytes of object itself. Retained Size: total bytes freed if this object is collected.",
  interviewTip: "Explain the '3-snapshot technique': 1) Take baseline snapshot, 2) Perform user action, 3) Perform reverse action, 4) Take 2nd snapshot, 5) Compare snapshots using 'Objects allocated between Snapshot 1 and 2'.",
  tags: ["chrome-devtools", "heap-snapshots", "profiling", "retained-size"]
}));

cards.push(createCard({
  idNum: 123,
  category: "Memory & Garbage Collection",
  concept: "V8 Hidden Classes (Shapes) & Inline Caching",
  priority: "advanced",
  difficulty: "advanced",
  question: "How do V8 Hidden Classes (Shapes) and Inline Caches (IC) optimize property access, and how can bad coding break them?",
  answer: "Because JavaScript is dynamic, accessing `obj.x` would normally require an expensive dictionary hash lookup. V8 dynamically generates internal C++ structures called **Hidden Classes (Shapes)** that track property memory offsets. An **Inline Cache (IC)** remembers property offsets for specific call-sites, converting property reads into raw memory pointer dereferences.",
  explanation: "If you dynamically add properties to objects in different orders (`obj1.a = 1; obj1.b = 2` vs `obj2.b = 2; obj2.a = 1`), V8 creates divergent shape transition trees. If a function encounters objects with more than 4 distinct shapes, the Inline Cache drops from Monomorphic (fastest) to Megamorphic (slowest dictionary lookup).",
  code: `// Fast: Monomorphic (identical shape transition order)
class Point {
  constructor(x, y) {
    this.x = x; // Shape Point_0 -> Point_1
    this.y = y; // Shape Point_1 -> Point_2
  }
}
const p1 = new Point(1, 2);
const p2 = new Point(3, 4);

// Slow: Polymorphic / Megamorphic (inconsistent property initialization)
const bad1 = {};
bad1.x = 1; bad1.y = 2; // Shape A -> B

const bad2 = {};
bad2.y = 2; bad2.x = 1; // Shape C -> D (Divergent Shapes!)

function getX(point) {
  return point.x; // Monomorphic for Point, Megamorphic for bad1/bad2!
}`,
  recallHint: "Hidden Classes (Shapes): V8 tracks property offsets. Inline Cache: caches offset. Keep initialization order consistent.",
  interviewTip: "Always recommend initializing all object properties in constructor functions in the exact same order and avoiding `delete obj.prop` (which forces dictionary mode).",
  tags: ["v8", "hidden-classes", "shapes", "inline-cache", "monomorphic"]
}));

cards.push(createCard({
  idNum: 124,
  category: "Memory & Garbage Collection",
  concept: "Avoiding Garbage Collection Spikes (Object Pooling)",
  priority: "advanced",
  difficulty: "advanced",
  question: "How does Object Pooling prevent Garbage Collection stutter in high-frequency applications like 60fps animations and games?",
  answer: "In 60fps games or high-throughput financial tickers, instantiating thousands of temporary objects per second forces frequent Minor GC cycles. When GC runs, it briefly pauses JavaScript execution ('stop-the-world' pauses), causing dropped frames and UI stutter. **Object Pooling** pre-allocates a fixed pool of reusable objects, acquiring them when needed and recycling them back to the pool rather than letting them be garbage collected.",
  explanation: "By resetting and reusing the same objects, zero new heap allocations occur during rendering loops, reducing GC pauses to zero.",
  code: `class ParticlePool {
  constructor(size) {
    this.pool = new Array(size).fill(null).map(() => ({ x: 0, y: 0, active: false }));
  }

  acquire(x, y) {
    const particle = this.pool.find(p => !p.active);
    if (!particle) return null; // Pool exhausted
    particle.x = x;
    particle.y = y;
    particle.active = true;
    return particle;
  }

  release(particle) {
    particle.active = false; // Recycled back to pool, zero GC work!
  }
}

const pool = new ParticlePool(1000);
// In animation loop: acquire particle -> update -> release. Zero allocations!`,
  recallHint: "Object Pooling: pre-allocate reusable objects to prevent frequent allocations and GC frame drops.",
  interviewTip: "Connect Object Pooling to Node.js `Buffer.allocUnsafe` and high-performance game loops or WebGL rendering engines.",
  tags: ["object-pooling", "gc-pauses", "performance", "high-frequency"]
}));

module.exports = cards;
