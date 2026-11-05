const { createCard } = require("../js_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 101,
  category: "Metaprogramming & Proxies",
  concept: "Metaprogramming in JavaScript (Introspection vs Intercession)",
  priority: "advanced",
  difficulty: "advanced",
  question: "What is Metaprogramming in JavaScript, and what are its three levels?",
  answer: "Metaprogramming is programming where code inspects, manipulates, or alters the runtime behavior of other code (or itself). The three levels are: 1) Introspection (read-only inspection of types, keys, descriptors via `typeof`, `Object.keys()`, `instanceof`). 2) Self-Modification (mutating code structure at runtime, e.g. monkey-patching methods). 3) Intercession (intercepting and redefining fundamental language operations like property access, assignment, function invocation via `Proxy` and `Reflect`).",
  explanation: "Before ES6, JavaScript only had basic introspection and crude self-modification (`Object.defineProperty`). ES6 introduced true intercession via `Proxy` and `Reflect`, allowing developers to trap and redefine fundamental internal engine operations (like `[[Get]]`, `[[Set]]`, `[[HasProperty]]`, `[[Call]]`).",
  code: `// Level 1: Introspection (inspect)
const user = { name: "Alice" };
console.log(Reflect.has(user, "name")); // true

// Level 2: Self-Modification (alter)
user.greet = function() { return \`Hi, \${this.name}\`; };

// Level 3: Intercession (intercept core language semantics with Proxy)
const trappedUser = new Proxy(user, {
  get(target, prop) {
    console.log(\`Intercepted read on: \${String(prop)}\`);
    return target[prop] ?? "DEFAULT_VALUE";
  }
});
console.log(trappedUser.nonExistent); // Logs interception -> "DEFAULT_VALUE"`,
  recallHint: "Metaprogramming: 1) Introspection (inspect), 2) Self-Modification (mutate), 3) Intercession (intercept with Proxy).",
  interviewTip: "Distinguish between `Object.defineProperty` (which only works on existing properties on a specific object) and `Proxy` (which virtualizes the entire object, intercepting operations on properties that don't even exist yet).",
  tags: ["metaprogramming", "proxy", "reflect", "intercession"]
}));

cards.push(createCard({
  idNum: 102,
  category: "Metaprogramming & Proxies",
  concept: "The Proxy Object & Core Handler Traps",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is the Proxy object and what are the essential handler traps?",
  answer: "A `Proxy` wraps a target object and intercepts fundamental low-level operations. Common traps include: `get(target, prop, receiver)` (property read), `set(target, prop, value, receiver)` (property write, must return boolean), `has(target, prop)` (`in` operator), `deleteProperty(target, prop)` (`delete` operator), and `apply(target, thisArg, argList)` (function call).",
  explanation: "Every trap corresponds directly to an internal specification method on ECMAScript objects (`[[Get]]`, `[[Set]]`, `[[HasProperty]]`, `[[Delete]]`, `[[Call]]`). If a trap is not defined in the handler, the operation falls through directly to the target object.",
  code: `const target = { balance: 100 };

const validator = new Proxy(target, {
  get(target, prop, receiver) {
    if (prop === "secret") return "Access Denied";
    return Reflect.get(target, prop, receiver);
  },
  set(target, prop, value, receiver) {
    if (prop === "balance" && (typeof value !== "number" || value < 0)) {
      throw new TypeError("Balance must be a non-negative number");
    }
    return Reflect.set(target, prop, value, receiver); // Must return boolean!
  },
  has(target, prop) {
    if (prop.startsWith("_")) return false; // Hide private props from 'in'
    return Reflect.has(target, prop);
  }
});

validator.balance = 250; // Valid
// validator.balance = -50; // TypeError: Balance must be a non-negative number`,
  recallHint: "Proxy traps: get, set (return bool!), has ('in'), deleteProperty ('delete'), apply (function call).",
  interviewTip: "Critical gotcha: the `set` trap MUST return `true` on success. In strict mode, returning `false` or a falsy value throws a `TypeError: 'set' on proxy: trap returned falsish`.",
  tags: ["proxy", "proxy-traps", "validation", "get-set"]
}));

cards.push(createCard({
  idNum: 103,
  category: "Metaprogramming & Proxies",
  concept: "The Reflect API & Receiver Binding",
  priority: "must-know",
  difficulty: "advanced",
  question: "Why should you always use Reflect inside Proxy traps, and what is the 'receiver' argument?",
  answer: "The `Reflect` API provides methods that mirror every Proxy trap and internal engine operation. Crucially, passing the `receiver` argument to `Reflect.get(target, prop, receiver)` ensures that if the property is an inherited getter, its 'this' context binds to the **Proxy** (the receiver) rather than the raw target object, preserving reactivity.",
  explanation: "If you use `target[prop]` inside a `get` trap instead of `Reflect.get(target, prop, receiver)`, any getter on a prototype will have `this` bound to `target`. If that getter accesses other properties on `this`, those secondary accesses bypass the proxy entirely! `Reflect.get` with `receiver` guarantees that all downstream property reads remain trapped by the proxy.",
  code: `const parent = {
  get name() {
    return this._name; // Relies on 'this'
  }
};

const child = { _name: "Child Object" };
Object.setPrototypeOf(child, parent);

// WRONG: using target[prop] breaks 'this' binding
const badProxy = new Proxy(child, {
  get(target, prop) {
    return target[prop]; // 'this' inside parent.name getter becomes 'child', NOT badProxy!
  }
});

// CORRECT: using Reflect.get with receiver preserves proxy context
const goodProxy = new Proxy(child, {
  get(target, prop, receiver) {
    console.log("Trapped property read:", prop);
    return Reflect.get(target, prop, receiver); // 'this' is goodProxy!
  }
});

console.log(goodProxy.name); // Traps 'name' AND traps '_name'!`,
  recallHint: "Always use Reflect inside traps. Pass receiver to preserve 'this' binding in inherited getters.",
  interviewTip: "Explaining the `receiver` parameter and why `target[prop]` breaks inherited getter reactivity is the number one question differentiating senior engineers from mid-level engineers regarding Proxies.",
  tags: ["reflect", "receiver", "proxy", "getters", "advanced"]
}));

cards.push(createCard({
  idNum: 104,
  category: "Metaprogramming & Proxies",
  concept: "Building an Observable / Reactive State System (Vue 3 Style)",
  priority: "must-know",
  difficulty: "advanced",
  question: "How do modern reactive frameworks like Vue 3 implement reactivity using Proxy and WeakMap?",
  answer: "By wrapping state objects in a `Proxy`. In the `get` trap, active effect functions (subscribers) are recorded in a global dependency registry (`WeakMap<Target, Map<Prop, Set<Effects>>>`). In the `set` trap, updating a property triggers and re-executes all registered effect callbacks associated with that target property.",
  explanation: "Unlike Vue 2's `Object.defineProperty` (which could not detect added/deleted properties or array index changes without special helper APIs), Proxy intercepts property addition, deletion, and array mutations (`push`, `pop`, `splice`) transparently.",
  code: `let activeEffect = null;
const targetMap = new WeakMap(); // Target -> Map(key -> Set(effects))

function track(target, key) {
  if (!activeEffect) return;
  let depsMap = targetMap.get(target);
  if (!depsMap) targetMap.set(target, (depsMap = new Map()));
  let dep = depsMap.get(key);
  if (!dep) depsMap.set(key, (dep = new Set()));
  dep.add(activeEffect);
}

function trigger(target, key) {
  const depsMap = targetMap.get(target);
  if (!depsMap) return;
  const effects = depsMap.get(key);
  if (effects) effects.forEach(effect => effect());
}

function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key); // Dependency tracking
      return Reflect.get(target, key, receiver);
    },
    set(target, key, val, receiver) {
      const result = Reflect.set(target, key, val, receiver);
      trigger(target, key); // Trigger subscribers
      return result;
    }
  });
}

function watchEffect(fn) {
  activeEffect = fn;
  fn(); // Run once to collect dependencies
  activeEffect = null;
}

// Test reactivity
const state = reactive({ count: 0 });
watchEffect(() => console.log("State Count changed to:", state.count));
state.count = 1; // Automatically re-runs watcher! Logs: "State Count changed to: 1"`,
  recallHint: "Reactivity: Proxy get -> track dependencies. Proxy set -> trigger effects. Stored in WeakMap.",
  interviewTip: "Walk the interviewer through the exact data structure: `WeakMap<Target, Map<Key, Set<Effect>>>`. This shows direct understanding of Vue 3 / MobX internals.",
  tags: ["reactivity", "vue3", "proxy", "observable", "weakmap"]
}));

cards.push(createCard({
  idNum: 105,
  category: "Metaprogramming & Proxies",
  concept: "Python-style Negative Array Indexing via Proxy",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "How can you use a Proxy to enable Python-style negative array indexing (e.g. arr[-1]) in JavaScript?",
  answer: "By wrapping an array in a Proxy whose `get` and `set` traps check if the requested property is an integer string. If the integer is negative, it adds the array's length (`index = target.length + negativeIndex`) to calculate the offset from the end.",
  explanation: "While ES2022 introduced `Array.prototype.at(-1)` for reading negative indices, it does not support assignment (`arr.at(-1) = val` is invalid syntax). A Proxy allows both negative reading AND negative writing seamlessly.",
  code: `function createPythonArray(...items) {
  const arr = [...items];

  return new Proxy(arr, {
    get(target, prop, receiver) {
      const index = Number(prop);
      if (Number.isInteger(index) && index < 0) {
        prop = String(target.length + index);
      }
      return Reflect.get(target, prop, receiver);
    },
    set(target, prop, value, receiver) {
      const index = Number(prop);
      if (Number.isInteger(index) && index < 0) {
        prop = String(target.length + index);
      }
      return Reflect.set(target, prop, value, receiver);
    }
  });
}

const pyArr = createPythonArray("A", "B", "C", "D");
console.log(pyArr[-1]); // "D" (Last item)
console.log(pyArr[-2]); // "C" (Second to last)

pyArr[-1] = "Z"; // Overwrite last element
console.log(pyArr[3]); // "Z"`,
  recallHint: "Negative indexing proxy: if int < 0, map prop to `length + index` in get/set traps.",
  interviewTip: "Mention that while `arr.at(-1)` solves reading, only a Proxy can enable negative index assignment.",
  tags: ["proxy", "array-tricks", "metaprogramming"]
}));

cards.push(createCard({
  idNum: 106,
  category: "Metaprogramming & Proxies",
  concept: "Revocable Proxies (Proxy.revocable)",
  priority: "advanced",
  difficulty: "advanced",
  question: "What is a Revocable Proxy (Proxy.revocable) and when should it be used?",
  answer: "`Proxy.revocable(target, handler)` creates a proxy alongside a `revoke()` function. Once `revoke()` is called, the proxy is immediately permanently disabled; any subsequent operation on the proxy throws a TypeError. It is used to implement secure capability-based security and temporary resource access.",
  explanation: "Use cases: 1) Handing temporary access of internal state or APIs to 3rd-party untrusted plugins. Once the plugin finishes its operation, call `revoke()`, ensuring the plugin can no longer read or mutate internal data. 2) Memory management: ensuring temporary event bridge proxies can be cleanly detached.",
  code: `const sensitiveData = { apiKey: "SECRET_XYZ_123", accessCount: 0 };

// Create revocable proxy
const { proxy, revoke } = Proxy.revocable(sensitiveData, {
  get(target, prop) {
    target.accessCount++;
    return target[prop];
  }
});

console.log(proxy.apiKey); // "SECRET_XYZ_123"
console.log(proxy.accessCount); // 1

// Revoke access!
revoke();

// Any subsequent attempt throws TypeError:
// console.log(proxy.apiKey);
// TypeError: Cannot perform 'get' on a proxy that has been revoked`,
  recallHint: "Proxy.revocable: returns { proxy, revoke }. Calling revoke() turns all future operations into TypeErrors.",
  interviewTip: "Highlight the security implications: passing a revocable proxy to a plugin allows deterministic revocation of privileges without mutating the underlying object.",
  tags: ["revocable-proxy", "security", "sandboxing", "capabilities"]
}));

cards.push(createCard({
  idNum: 107,
  category: "Metaprogramming & Proxies",
  concept: "Well-Known Symbols: Symbol.toPrimitive",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "How does Symbol.toPrimitive customize type coercion on objects?",
  answer: "`[Symbol.toPrimitive](hint)` is a well-known symbol method called by the engine when an object needs to be converted into a primitive value. The engine supplies a string hint ('number', 'string', or 'default'), and the method must return a primitive.",
  explanation: "Before ES6, coercion relied on `.valueOf()` and `.toString()`. `Symbol.toPrimitive` takes absolute precedence over both, allowing a single method to cleanly define conversion behavior for numeric math, string formatting, and loose equality.",
  code: `class Money {
  constructor(amount, currency) {
    this.amount = amount;
    this.currency = currency;
  }

  [Symbol.toPrimitive](hint) {
    switch (hint) {
      case "string":
        return \`\${this.currency} \${this.amount.toFixed(2)}\`;
      case "number":
        return this.amount;
      default: // e.g. + operator
        return this.amount;
    }
  }
}

const price = new Money(49.95, "USD");

console.log(\`Price is: \${price}\`); // "Price is: USD 49.95" (hint: string)
console.log(price + 10);             // 59.95 (hint: default)
console.log(+price);                 // 49.95 (hint: number)`,
  recallHint: "[Symbol.toPrimitive](hint): overrides valueOf and toString for coercion.",
  interviewTip: "Point out the 3 hints: 'number' (e.g. unary + or Math methods), 'string' (template literals), and 'default' (binary + or loose equality ==).",
  tags: ["symbols", "symbol-toprimitive", "coercion", "metaprogramming"]
}));

cards.push(createCard({
  idNum: 108,
  category: "Metaprogramming & Proxies",
  concept: "Well-Known Symbols: Symbol.toStringTag",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What does Symbol.toStringTag do, and how does it customize Object.prototype.toString?",
  answer: "`Symbol.toStringTag` is a string-valued well-known symbol property used to customize the default string description returned by `Object.prototype.toString.call(obj)` (e.g. transforming `[object Object]` into `[object CustomType]`).",
  explanation: "Standard built-in objects have pre-defined tags: `Map.prototype[Symbol.toStringTag] === 'Map'`, `Promise.prototype[Symbol.toStringTag] === 'Promise'`. Custom classes can implement `get [Symbol.toStringTag]()` to provide clean, identifiable type tags for logging and debugging.",
  code: `class DatabasePool {
  get [Symbol.toStringTag]() {
    return "DatabasePool";
  }
}

const pool = new DatabasePool();

// Standard toString inspection:
console.log(Object.prototype.toString.call(pool)); // "[object DatabasePool]"!
console.log(String(pool)); // "[object DatabasePool]" (instead of "[object Object]")`,
  recallHint: "Symbol.toStringTag: customizes [object CustomType] string returned by Object.prototype.toString.",
  interviewTip: "Useful for custom library authoring to ensure utility functions like `lodash.isDate` or type inspectors identify your class cleanly.",
  tags: ["symbols", "symbol-tostringtag", "debugging", "introspection"]
}));

cards.push(createCard({
  idNum: 109,
  category: "Metaprogramming & Proxies",
  concept: "Well-Known Symbols: Symbol.species",
  priority: "advanced",
  difficulty: "advanced",
  question: "What is Symbol.species and how does it control the constructor used for derived objects?",
  answer: "`Symbol.species` is a static accessor property on built-in classes (`Array`, `Promise`, `RegExp`, `Map`) that specifies the constructor function used to create derived objects in methods like `map()`, `filter()`, `slice()`, or `then()`.",
  explanation: "If a subclass `MyArray extends Array` executes `this.map(...)`, should the returned mapped collection be an instance of `MyArray` or standard `Array`? By default, it returns `MyArray`. By overriding `static get [Symbol.species]() { return Array; }`, you force all derived array operations to return standard vanilla arrays.",
  code: `class CustomArray extends Array {
  // Overwrite species to standard Array
  static get [Symbol.species]() {
    return Array;
  }
}

const custom = new CustomArray(1, 2, 3);
const mapped = custom.map(x => x * 2);

console.log(mapped instanceof CustomArray); // false!
console.log(mapped instanceof Array);       // true! (Standard Array returned)`,
  recallHint: "Symbol.species: static getter specifying constructor for derived operations (map, filter).",
  interviewTip: "Note that modern TC39 proposals are moving toward deprecating Symbol.species in future editions because of engine optimization complexities, but it remains a staple in interview questions.",
  tags: ["symbols", "symbol-species", "subclassing", "spec"]
}));

cards.push(createCard({
  idNum: 110,
  category: "Metaprogramming & Proxies",
  concept: "Well-Known Symbols: Symbol.isConcatSpreadable",
  priority: "intermediate",
  difficulty: "beginner",
  question: "What does Symbol.isConcatSpreadable do when passing objects or arrays to Array.prototype.concat()?",
  answer: "`Symbol.isConcatSpreadable` is a boolean property that configures whether `Array.prototype.concat()` flattens an array (default true) or array-like object (default false) into the resulting concatenated array.",
  explanation: "By setting `[Symbol.isConcatSpreadable]: false` on an array, `concat()` will treat the array as a single atomic element rather than flattening it. Conversely, setting it to `true` on an array-like object (`{ 0: 'a', length: 1 }`) forces `concat()` to flatten its elements into the destination array.",
  code: `const arr1 = ["a", "b"];
const arr2 = ["c", "d"];

// By default, concat flattens arr2:
console.log(arr1.concat(arr2)); // ["a", "b", "c", "d"]

// Disable flattening with Symbol.isConcatSpreadable:
arr2[Symbol.isConcatSpreadable] = false;
console.log(arr1.concat(arr2)); // ["a", "b", ["c", "d"]] (arr2 kept intact!)

// Enable flattening on array-like object:
const arrayLike = {
  [Symbol.isConcatSpreadable]: true,
  0: "X",
  1: "Y",
  length: 2
};
console.log(arr1.concat(arrayLike)); // ["a", "b", "X", "Y"]`,
  recallHint: "Symbol.isConcatSpreadable: controls whether concat() flattens the collection.",
  interviewTip: "Demonstrate using it on array-like objects to concatenate them cleanly without converting to real arrays first.",
  tags: ["symbols", "symbol-isconcatspreadable", "array-concat"]
}));

cards.push(createCard({
  idNum: 111,
  category: "Metaprogramming & Proxies",
  concept: "Proxy Invariants & Safety Violations",
  priority: "advanced",
  difficulty: "advanced",
  question: "What are Proxy Invariants and what happens if a Proxy trap violates them?",
  answer: "Proxy Invariants are strict ECMAScript specification rules designed to maintain fundamental object integrity. If a trap's return value violates an invariant (e.g. returning a different value for a non-configurable, non-writable property), the JavaScript engine immediately throws a TypeError.",
  explanation: "Example: If property `id` on target is defined with `{ value: 42, writable: false, configurable: false }`, the Proxy's `get` trap MUST return `42`. If the trap returns `99` or `undefined`, the engine throws `TypeError: 'get' on proxy: property 'id' is a read-only and non-configurable.. but the proxy did not return its actual value`.",
  code: `const target = {};
Object.defineProperty(target, "locked", {
  value: "LOCKED_VAL",
  writable: false,
  configurable: false
});

const invalidProxy = new Proxy(target, {
  get(t, prop) {
    if (prop === "locked") {
      return "HACKED_VAL"; // Violates invariant!
    }
    return t[prop];
  }
});

// Throws TypeError immediately!
// console.log(invalidProxy.locked);
// TypeError: 'get' on proxy: property 'locked' is a read-only and non-configurable...`,
  recallHint: "Proxy Invariants: Engine throws TypeError if trap violates non-configurable/non-writable rules.",
  interviewTip: "This proves that Proxies cannot break core JavaScript runtime guarantees—they can intercept, but cannot violate engine invariants.",
  tags: ["proxy-invariants", "security", "engine-internals", "spec"]
}));

cards.push(createCard({
  idNum: 112,
  category: "Metaprogramming & Proxies",
  concept: "Proxy Performance Overhead & Optimization Traps",
  priority: "advanced",
  difficulty: "advanced",
  question: "Why do Proxies introduce runtime performance overhead in the V8 engine compared to raw objects?",
  answer: "Proxies bypass V8's fast-path Inline Caches (IC) and Hidden Classes (Shapes). Every property read/write on a Proxy forces the engine to jump out of optimized JIT machine code, allocate an Arguments list, and execute the C++/JS trap callback, creating a 5x–20x performance penalty on micro-benchmarks.",
  explanation: "V8 optimizes standard object property access to a single assembly memory offset read. With a Proxy, that single machine instruction becomes an entire function call frame with trap resolution. Proxies should be used for architectural boundaries (reactivity, validation, SDK wrappers), NOT in tight inner loops running millions of times per second.",
  code: `// Tight loop performance comparison:
const rawObj = { x: 0 };
const proxyObj = new Proxy(rawObj, {});

// Raw access: JIT optimizes to raw memory load (1-2 CPU cycles)
// for (let i = 0; i < 1000000; i++) rawObj.x++;

// Proxy access: Triggers trap resolution & IC misses every loop (10-20x slower)
// for (let i = 0; i < 1000000; i++) proxyObj.x++;`,
  recallHint: "Proxies bypass V8 hidden classes and inline caches. Use for architecture, not inner loops.",
  interviewTip: "When asked about using Proxies for data processing, always mention the performance trade-off and why frameworks like Vue compile templates to avoid proxy traps in tight rendering loops.",
  tags: ["proxy", "v8-performance", "inline-cache", "optimization"]
}));

module.exports = cards;
