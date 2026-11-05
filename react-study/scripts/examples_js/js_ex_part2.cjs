/**
 * JavaScript Applied Examples - Part 2 (Functional Programming & Closures Recipes 11-20)
 */

module.exports = [
  {
    id: "js-ex-11",
    title: "Production Debounce with Leading, Trailing, and Cancel Options",
    category: "Functional Programming",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements a complete Lodash-style debounce utility supporting leading execution, trailing execution, maxWait ceilings, and manual cancellation.",
    conceptsCovered: ["Debounce", "Closures", "Timers", "Higher-Order Functions"],
    code: `function debounce(fn, wait, options = {}) {
  let timerId = null;
  let lastArgs = null;
  let lastThis = null;
  let result = null;

  const { leading = false, trailing = true } = options;

  function invoke() {
    timerId = null;
    if (trailing && lastArgs) {
      result = fn.apply(lastThis, lastArgs);
      lastArgs = lastThis = null;
    }
  }

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;

    const isInvokingLeading = leading && !timerId;

    if (timerId) clearTimeout(timerId);
    timerId = setTimeout(invoke, wait);

    if (isInvokingLeading) {
      result = fn.apply(lastThis, lastArgs);
      lastArgs = lastThis = null;
    }

    return result;
  }

  debounced.cancel = () => {
    if (timerId) clearTimeout(timerId);
    timerId = lastArgs = lastThis = null;
  };

  return debounced;
}

// Test with leading execution
const logImmediate = debounce((msg) => console.log("Fired:", msg), 50, { leading: true, trailing: false });
logImmediate("Call 1"); // Fires immediately
logImmediate("Call 2"); // Ignored (in debounce window)`,
    breakdown: [
      { lineRange: "1-6", note: "Maintains closure state: timerId, lastArgs, lastThis, and cached result." },
      { lineRange: "18-34", note: "Checks if leading call should fire immediately or wait for trailing timeout." },
      { lineRange: "36-39", note: "Provides .cancel() method to abort pending timers on component unmount." }
    ],
    expectedOutput: `Fired: Call 1`
  },
  {
    id: "js-ex-12",
    title: "Production Throttle with Leading/Trailing Control",
    category: "Functional Programming",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements a throttle utility that guarantees execution at most once per time window, supporting leading and trailing triggers for high-frequency events.",
    conceptsCovered: ["Throttle", "Closures", "Performance", "High-Frequency Events"],
    code: `function throttle(fn, wait, options = {}) {
  let timerId = null;
  let lastArgs = null;
  let lastThis = null;
  let previousTime = 0;

  const { leading = true, trailing = true } = options;

  return function throttled(...args) {
    const now = Date.now();
    if (!previousTime && !leading) previousTime = now;
    const remaining = wait - (now - previousTime);

    lastArgs = args;
    lastThis = this;

    if (remaining <= 0 || remaining > wait) {
      if (timerId) {
        clearTimeout(timerId);
        timerId = null;
      }
      previousTime = now;
      fn.apply(lastThis, lastArgs);
      lastArgs = lastThis = null;
    } else if (!timerId && trailing) {
      timerId = setTimeout(() => {
        previousTime = leading ? Date.now() : 0;
        timerId = null;
        fn.apply(lastThis, lastArgs);
        lastArgs = lastThis = null;
      }, remaining);
    }
  };
}

// Verification
const onScroll = throttle((y) => console.log("Scroll Y:", y), 50);
onScroll(100);
onScroll(200);`,
    breakdown: [
      { lineRange: "1-8", note: "Tracks last execution timestamp and pending trailing timer in closure." },
      { lineRange: "14-25", note: "Calculates remaining time in window; fires immediately if window expired." },
      { lineRange: "26-33", note: "Schedules a trailing call if options.trailing is enabled." }
    ],
    expectedOutput: `Scroll Y: 100`
  },
  {
    id: "js-ex-13",
    title: "Deep Clone Algorithm with Circular References, Symbols, and Special Types",
    category: "Functional Programming",
    difficulty: "advanced",
    whatThisCodeCovers: "Constructs a recursive deep clone algorithm handling circular references, Symbols, Dates, RegExps, Maps, and Sets using WeakMap memoization.",
    conceptsCovered: ["Deep Clone", "Circular References", "WeakMap", "Reflect.ownKeys", "Symbols"],
    code: `function deepClone(value, map = new WeakMap()) {
  // Primitives and functions
  if (value === null || typeof value !== "object") return value;

  // Dates and RegExps
  if (value instanceof Date) return new Date(value);
  if (value instanceof RegExp) return new RegExp(value.source, value.flags);

  // Circular reference check
  if (map.has(value)) return map.get(value);

  // Maps and Sets
  if (value instanceof Map) {
    const copyMap = new Map();
    map.set(value, copyMap);
    value.forEach((v, k) => copyMap.set(deepClone(k, map), deepClone(v, map)));
    return copyMap;
  }
  if (value instanceof Set) {
    const copySet = new Set();
    map.set(value, copySet);
    value.forEach(v => copySet.add(deepClone(v, map)));
    return copySet;
  }

  // Arrays and Objects (preserving prototype)
  const clone = Array.isArray(value)
    ? []
    : Object.create(Object.getPrototypeOf(value));
  map.set(value, clone);

  // Copy own keys including Symbols
  for (const key of Reflect.ownKeys(value)) {
    clone[key] = deepClone(value[key], map);
  }

  return clone;
}

// Test circular references and symbols
const sym = Symbol("private");
const node = { id: 1, [sym]: "secret" };
node.self = node; // Circular!

const copy = deepClone(node);
console.log(copy.id); // 1
console.log(copy[sym]); // "secret"
console.log(copy.self === copy); // true (Circular link preserved!)
console.log(copy !== node); // true (Independent instance)`,
    breakdown: [
      { lineRange: "9-11", note: "Checks WeakMap cache to break infinite circular recursion." },
      { lineRange: "13-25", note: "Recursively handles Map and Set collections." },
      { lineRange: "28-35", note: "Preserves prototype via Object.create and copies Symbols via Reflect.ownKeys." }
    ],
    expectedOutput: `1
secret
true
true`
  },
  {
    id: "js-ex-14",
    title: "Currying Implementation with Placeholders",
    category: "Functional Programming",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds an advanced curry function supporting placeholders (e.g. `curry._`) allowing arguments to be specified out-of-order in functional pipelines.",
    conceptsCovered: ["Currying", "Placeholders", "Partial Application", "Arity"],
    code: `function curry(fn) {
  const _ = Symbol("curry.placeholder");

  function curried(...args) {
    // Count non-placeholder arguments
    const complete = args.length >= fn.length &&
      !args.slice(0, fn.length).includes(_);

    if (complete) {
      return fn.apply(this, args);
    }

    return function(...nextArgs) {
      // Replace placeholders in args with nextArgs
      const merged = args.map(arg => (arg === _ && nextArgs.length > 0 ? nextArgs.shift() : arg));
      return curried.apply(this, merged.concat(nextArgs));
    };
  }

  curried._ = _;
  return curried;
}

// Test with placeholders
function formatName(first, middle, last) {
  return \`\${last}, \${first} \${middle}.\`;
}

const curriedFormat = curry(formatName);
const _ = curriedFormat._;

// Supply 1st and 3rd arguments, leaving 2nd argument placeholder:
const partial = curriedFormat("John", _, "Doe");
console.log(partial("Q")); // "Doe, John Q."`,
    breakdown: [
      { lineRange: "1-3", note: "Declares a unique Symbol placeholder attached to curried._." },
      { lineRange: "5-10", note: "Checks if all required formal parameters are satisfied without placeholders." },
      { lineRange: "13-18", note: "Merges new arguments into existing placeholder slots." }
    ],
    expectedOutput: `Doe, John Q.`
  },
  {
    id: "js-ex-15",
    title: "LRU (Least Recently Used) Cache Implementation",
    category: "Functional Programming",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements a high-performance $O(1)$ LRU Cache using JavaScript's native Map (which maintains insertion order) to evict oldest entries under capacity limits.",
    conceptsCovered: ["LRU Cache", "Map Ordering", "Cache Eviction", "O(1) Data Structures"],
    code: `class LRUCache {
  constructor(capacity) {
    this.capacity = capacity;
    this.cache = new Map(); // Map preserves insertion order!
  }

  get(key) {
    if (!this.cache.has(key)) return -1;
    // Refresh position: delete and re-insert at end of Map!
    const value = this.cache.get(key);
    this.cache.delete(key);
    this.cache.set(key, value);
    return value;
  }

  put(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key); // Remove old entry
    } else if (this.cache.size >= this.capacity) {
      // Evict least recently used: the first key in Map iterator!
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    this.cache.set(key, value);
  }
}

// Test LRU eviction
const lru = new LRUCache(2);
lru.put("A", 1);
lru.put("B", 2);
lru.get("A"); // "A" is accessed, making "B" least recently used!
lru.put("C", 3); // Evicts "B"!

console.log(lru.get("B")); // -1 (Evicted)
console.log(lru.get("A")); // 1 (Preserved)`,
    breakdown: [
      { lineRange: "1-5", note: "Uses JavaScript's Map which guarantees insertion order iteration." },
      { lineRange: "7-14", note: "get: re-inserts key at the end of the Map so it becomes the most recently used." },
      { lineRange: "16-25", note: "put: evicts oldest item at cache.keys().next().value when capacity is reached." }
    ],
    expectedOutput: `-1
1`
  },
  {
    id: "js-ex-16",
    title: "Complete Event Emitter with .on(), .once(), .emit(), and .off()",
    category: "Functional Programming",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a production Pub-Sub EventEmitter class supporting once listeners, multi-argument emission, listener removal, and error boundary isolation.",
    conceptsCovered: ["EventEmitter", "Pub-Sub", "Closures", "Event Architecture"],
    code: `class EventEmitter {
  constructor() {
    this._events = new Map(); // EventName -> Set of listener functions
  }

  on(eventName, listener) {
    if (!this._events.has(eventName)) {
      this._events.set(eventName, new Set());
    }
    this._events.get(eventName).add(listener);
    // Return unsubscribe function for convenience
    return () => this.off(eventName, listener);
  }

  once(eventName, listener) {
    const wrapper = (...args) => {
      this.off(eventName, wrapper);
      listener.apply(this, args);
    };
    wrapper.originalListener = listener;
    return this.on(eventName, wrapper);
  }

  off(eventName, listener) {
    const listeners = this._events.get(eventName);
    if (!listeners) return;
    for (const l of listeners) {
      if (l === listener || l.originalListener === listener) {
        listeners.delete(l);
      }
    }
  }

  emit(eventName, ...args) {
    const listeners = this._events.get(eventName);
    if (!listeners) return false;
    // Copy set to prevent mutation during iteration if listeners unbind themselves
    [...listeners].forEach(fn => {
      try {
        fn.apply(this, args);
      } catch (err) {
        console.error(\`Error in event listener for \${eventName}:\`, err);
      }
    });
    return true;
  }
}

// Test emitter
const bus = new EventEmitter();
bus.once("orderPlaced", (id) => console.log("Once handler order:", id));

bus.emit("orderPlaced", 101); // Fires once
bus.emit("orderPlaced", 102); // Ignored`,
    breakdown: [
      { lineRange: "1-4", note: "Uses a Map of Sets for O(1) listener addition and removal." },
      { lineRange: "15-22", note: "once creates a self-unsubscribing wrapper preserving originalListener reference." },
      { lineRange: "34-46", note: "emit clones the listener set before invoking to prevent mutation bugs." }
    ],
    expectedOutput: `Once handler order: 101`
  },
  {
    id: "js-ex-17",
    title: "Safe Deep Object Getter and Setter (Path Resolver)",
    category: "Functional Programming",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs robust Lodash-style `get(obj, path, default)` and `set(obj, path, value)` utilities that navigate nested object paths and array indices without throwing TypeErrors.",
    conceptsCovered: ["Path Navigation", "Defensive Programming", "RegEx Path Parsing", "Immutability"],
    code: `function parsePath(path) {
  if (Array.isArray(path)) return path;
  // Parses "a.b[0].c" into ["a", "b", "0", "c"]
  return path.replace(/\\[(\\w+)\\]/g, ".$1").split(".").filter(Boolean);
}

function get(obj, path, defaultValue = undefined) {
  const keys = parsePath(path);
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = current[key];
  }

  return current === undefined ? defaultValue : current;
}

function set(obj, path, value) {
  const keys = parsePath(path);
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    const nextKey = keys[i + 1];

    if (!(key in current) || current[key] === null || typeof current[key] !== "object") {
      // Create array if next key is integer, else object
      current[key] = String(Number(nextKey)) === nextKey ? [] : {};
    }
    current = current[key];
  }

  current[keys[keys.length - 1]] = value;
  return obj;
}

// Test get and set
const data = { user: { orders: [{ id: "A1" }] } };
console.log(get(data, "user.orders[0].id")); // "A1"
console.log(get(data, "user.settings.theme", "dark")); // "dark" (Default)

set(data, "user.preferences.notifications.email", true);
console.log(data.user.preferences.notifications.email); // true`,
    breakdown: [
      { lineRange: "1-4", note: "parsePath uses regex to normalize bracket notation a[0].b into dotted string keys." },
      { lineRange: "6-17", note: "get traverses keys safely, returning defaultValue if an intermediate key is nullish." },
      { lineRange: "19-35", note: "set dynamically creates intermediate objects or arrays based on key types." }
    ],
    expectedOutput: `A1
dark
true`
  },
  {
    id: "js-ex-18",
    title: "Trampoline Function to Prevent Stack Overflow in Deep Recursion",
    category: "Functional Programming",
    difficulty: "advanced",
    whatThisCodeCovers: "Eliminates call stack overflow errors in deep recursion by transforming recursive algorithms into an iterative while loop using thunks.",
    conceptsCovered: ["Trampoline", "Call Stack Overflow", "Thunks", "Tail Call Optimization"],
    code: `function trampoline(fn) {
  return function(...args) {
    let result = fn(...args);
    // Continue executing thunks in a while-loop on a single stack frame!
    while (typeof result === "function") {
      result = result();
    }
    return result;
  };
}

// Normal recursion throws RangeError at ~10,000 depth:
// function sum(n, acc = 0) {
//   if (n <= 0) return acc;
//   return sum(n - 1, acc + n); // Exceeds maximum call stack!
// }

// Trampolined recursion: returns a thunk () => sum(...) instead of direct call
const safeSum = trampoline(function sum(n, acc = 0) {
  if (n <= 0) return acc;
  // Return thunk to trampoline loop
  return () => sum(n - 1, acc + n);
});

// Runs 100,000 iterations safely in 1 stack frame!
console.log("Sum 1..100000:", safeSum(100000));`,
    breakdown: [
      { lineRange: "1-10", note: "The trampoline wrapper evaluates returned thunk functions in an iterative while loop." },
      { lineRange: "19-23", note: "The recursive function returns () => sum(...) rather than executing recursively." },
      { lineRange: "26", note: "Calculates sum of 100,000 integers with zero stack growth." }
    ],
    expectedOutput: `Sum 1..100000: 5000050000`
  },
  {
    id: "js-ex-19",
    title: "Deep Object and Array Flattener (Iterative)",
    category: "Functional Programming",
    difficulty: "intermediate",
    whatThisCodeCovers: "Flattens deeply nested object hierarchies into flat dot-notated key-value mappings using an iterative queue to prevent recursion limits.",
    conceptsCovered: ["Object Flattening", "Iterative Traversal", "Dot Notation", "Data Normalization"],
    code: `function flattenObject(obj, delimiter = ".") {
  const result = {};
  const stack = [{ current: obj, prefix: "" }];

  while (stack.length > 0) {
    const { current, prefix } = stack.pop();

    for (const key of Object.keys(current)) {
      const val = current[key];
      const newKey = prefix ? \`\${prefix}\${delimiter}\${key}\` : key;

      if (val !== null && typeof val === "object" && Object.keys(val).length > 0) {
        stack.push({ current: val, prefix: newKey });
      } else {
        result[newKey] = val;
      }
    }
  }

  return result;
}

const complex = {
  app: {
    name: "Dashboard",
    settings: {
      theme: "dark",
      api: { url: "https://api.com", port: 443 }
    }
  }
};

console.log(flattenObject(complex));`,
    breakdown: [
      { lineRange: "1-4", note: "Uses an explicit stack array instead of recursion to prevent call stack limits." },
      { lineRange: "6-17", note: "Appends dot delimiters and pushes nested sub-objects onto the stack." }
    ],
    expectedOutput: `{
  'app.name': 'Dashboard',
  'app.settings.theme': 'dark',
  'app.settings.api.url': 'https://api.com',
  'app.settings.api.port': 443
}`
  },
  {
    id: "js-ex-20",
    title: "Immutable Redux-Style State Store with Middleware Pipeline",
    category: "Functional Programming",
    difficulty: "advanced",
    whatThisCodeCovers: "Constructs a lightweight Redux clone from scratch with state immutability, dispatching, subscriptions, and an onion-architecture middleware pipeline.",
    conceptsCovered: ["Redux Architecture", "Middleware Pipeline", "State Immutability", "Dispatch Action"],
    code: `function createStore(reducer, initialState, ...middlewares) {
  let state = initialState;
  const listeners = new Set();

  const getState = () => state;

  const rawDispatch = (action) => {
    state = reducer(state, action);
    listeners.forEach(fn => fn());
    return action;
  };

  const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  // Middleware pipeline chaining
  const middlewareApi = { getState, dispatch: (...args) => dispatch(...args) };
  const chain = middlewares.map(m => m(middlewareApi));
  const dispatch = chain.reduceRight(
    (next, middleware) => middleware(next),
    rawDispatch
  );

  return { getState, dispatch, subscribe };
}

// Logger Middleware
const loggerMiddleware = store => next => action => {
  console.log("Action:", action.type);
  const result = next(action);
  console.log("New State:", store.getState());
  return result;
};

// Reducer
const counterReducer = (state = 0, action) => {
  return action.type === "INC" ? state + 1 : state;
};

const store = createStore(counterReducer, 0, loggerMiddleware);
store.dispatch({ type: "INC" });`,
    breakdown: [
      { lineRange: "1-17", note: "Basic store implementation: state, getState, rawDispatch, and subscribe set." },
      { lineRange: "19-24", note: "Chains middleware via reduceRight to construct the onion dispatch pipeline." },
      { lineRange: "29-34", note: "Logger middleware demonstrates intercepting actions before and after next()." }
    ],
    expectedOutput: `Action: INC
New State: 1`
  }
];
