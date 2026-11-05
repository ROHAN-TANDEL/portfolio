/**
 * JavaScript Applied Examples - Part 3 (Objects, Prototypes & Metaprogramming Recipes 21-30)
 */

module.exports = [
  {
    id: "js-ex-21",
    title: "Custom Implementation of the 'new' Operator",
    category: "Objects & Prototypes",
    difficulty: "intermediate",
    whatThisCodeCovers: "Re-creates the JavaScript engine's internal [[Construct]] algorithm from scratch, handling prototype linking, 'this' execution, and primitive vs object return overrides.",
    conceptsCovered: ["new Operator", "Object.create", "[[Construct]]", "Constructor Return Semantics"],
    code: `function customNew(Constructor, ...args) {
  if (typeof Constructor !== "function") {
    throw new TypeError("Constructor must be a function");
  }

  // 1 & 2: Allocate new object linked to Constructor's prototype
  const instance = Object.create(Constructor.prototype);

  // 3: Invoke constructor with 'this' bound to the new instance
  const result = Constructor.apply(instance, args);

  // 4: If constructor explicitly returns an object, return that object;
  // otherwise return the created instance!
  const isObject = result !== null && (typeof result === "object" || typeof result === "function");
  return isObject ? result : instance;
}

// Verification 1: Standard constructor
function Person(name, age) {
  this.name = name;
  this.age = age;
}
Person.prototype.greet = function() { return \`Hi, I am \${this.name}\`; };

const p = customNew(Person, "Alice", 28);
console.log(p instanceof Person); // true
console.log(p.greet()); // "Hi, I am Alice"

// Verification 2: Constructor returning primitive (ignored)
function ReturnPrimitive() {
  this.val = 100;
  return 999; // Ignored!
}
console.log(customNew(ReturnPrimitive).val); // 100

// Verification 3: Constructor returning explicit object (overrides this)
function ReturnObj() {
  this.val = 100;
  return { custom: true }; // Overrides this!
}
console.log(customNew(ReturnObj)); // { custom: true }`,
    breakdown: [
      { lineRange: "6-7", note: "Object.create(Constructor.prototype) creates the object and sets [[Prototype]]." },
      { lineRange: "9-10", note: "Constructor.apply(instance, args) runs initialization logic." },
      { lineRange: "12-14", note: "Checks if return value is an object; primitives are ignored per the ECMAScript spec." }
    ],
    expectedOutput: `true
Hi, I am Alice
100
{ custom: true }`
  },
  {
    id: "js-ex-22",
    title: "Complete Polyfill for Function.prototype.bind Supporting 'new'",
    category: "Objects & Prototypes",
    difficulty: "advanced",
    whatThisCodeCovers: "Constructs an ECMAScript-compliant polyfill for Function.prototype.bind handling currying, context binding, and constructor invocation with the 'new' operator.",
    conceptsCovered: ["Function.prototype.bind", "new Operator", "Currying", "Prototype Chaining"],
    code: `Function.prototype.myBind = function(context, ...boundArgs) {
  if (typeof this !== "function") {
    throw new TypeError("What is trying to be bound is not callable");
  }

  const targetFn = this;

  function boundFunction(...callArgs) {
    // Check if invoked via 'new':
    // If called with 'new', 'this' is an instance of boundFunction!
    const isNew = this instanceof boundFunction;

    return targetFn.apply(
      isNew ? this : context,
      boundArgs.concat(callArgs)
    );
  }

  // Preserve prototype chain for 'new' constructor instances
  if (targetFn.prototype) {
    boundFunction.prototype = Object.create(targetFn.prototype);
  }

  return boundFunction;
};

// Test with 'new'
function Point(x, y) {
  this.x = x;
  this.y = y;
}
Point.prototype.getCoordinates = function() { return \`\${this.x},\${this.y}\`; };

const BoundPoint = Point.myBind({ ignored: true }, 10);
const pt = new BoundPoint(20); // 'new' overrides bound context!

console.log(pt instanceof Point); // true
console.log(pt.getCoordinates()); // "10,20"`,
    breakdown: [
      { lineRange: "8-16", note: "Checks this instanceof boundFunction to detect invocation via the 'new' keyword." },
      { lineRange: "19-21", note: "Links boundFunction.prototype to targetFn.prototype via Object.create." },
      { lineRange: "31-36", note: "Demonstrates pre-bound argument 10 combined with call argument 20 under 'new'." }
    ],
    expectedOutput: `true
10,20`
  },
  {
    id: "js-ex-23",
    title: "Reactive State Engine with Proxy & Dependency Tracking (Vue 3 Signal)",
    category: "Metaprogramming & Proxies",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a production-style fine-grained reactive state container using ES6 Proxy, Reflect with receiver, and a WeakMap dependency graph.",
    conceptsCovered: ["Proxy", "Reflect", "WeakMap", "Reactive Signals", "Dependency Tracking"],
    code: `const targetMap = new WeakMap();
let activeEffect = null;

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
  if (effects) effects.forEach(fn => fn());
}

function reactive(obj) {
  return new Proxy(obj, {
    get(target, key, receiver) {
      track(target, key);
      return Reflect.get(target, key, receiver);
    },
    set(target, key, val, receiver) {
      const oldVal = target[key];
      const result = Reflect.set(target, key, val, receiver);
      if (oldVal !== val) {
        trigger(target, key);
      }
      return result;
    }
  });
}

function effect(fn) {
  activeEffect = fn;
  fn(); // Run immediately to track dependencies
  activeEffect = null;
}

// Test reactivity
const state = reactive({ price: 10, quantity: 2 });
let total = 0;

effect(() => {
  total = state.price * state.quantity;
  console.log("Calculated Total:", total);
});

state.quantity = 3; // Triggers effect!
state.price = 20;    // Triggers effect!`,
    breakdown: [
      { lineRange: "1-18", note: "track registers activeEffect in targetMap; trigger re-executes all dependent effects." },
      { lineRange: "20-36", note: "Proxy get trap calls track(); set trap calls trigger() on value change." },
      { lineRange: "44-55", note: "Demonstrates total updating automatically when state properties mutate." }
    ],
    expectedOutput: `Calculated Total: 20
Calculated Total: 30
Calculated Total: 60`
  },
  {
    id: "js-ex-24",
    title: "Schema Validation Proxy for Data Integrity",
    category: "Metaprogramming & Proxies",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a schema-enforced object wrapper using a Proxy that validates property types and required constraints at runtime on property assignment.",
    conceptsCovered: ["Proxy Validation", "Runtime Type Guards", "Schema Enforcement", "Defensive Objects"],
    code: `function createValidatedObject(schema) {
  const target = {};

  return new Proxy(target, {
    set(t, prop, value) {
      const rule = schema[prop];
      if (!rule) {
        throw new TypeError(\`Property '\${prop}' is not defined in schema\`);
      }

      if (typeof value !== rule.type) {
        throw new TypeError(\`Invalid type for '\${prop}'. Expected \${rule.type}, received \${typeof value}\`);
      }

      if (rule.validate && !rule.validate(value)) {
        throw new RangeError(\`Value \${value} failed validation for '\${prop}'\`);
      }

      t[prop] = value;
      return true; // Must return true on successful assignment!
    }
  });
}

// Define user schema
const userSchema = {
  name: { type: "string", validate: (v) => v.length >= 2 },
  age: { type: "number", validate: (v) => v >= 18 && v <= 120 },
  email: { type: "string", validate: (v) => v.includes("@") }
};

const user = createValidatedObject(userSchema);
user.name = "John";
user.age = 25;
user.email = "john@example.com";
console.log("User valid:", user.name, user.age);

// Trying bad age:
try {
  user.age = 15; // Fails validation!
} catch (err) {
  console.log("Validation blocked:", err.message);
}`,
    breakdown: [
      { lineRange: "1-20", note: "set trap inspects schema rules before mutating internal target object." },
      { lineRange: "23-27", note: "Declares strict schema with types and predicate validator functions." },
      { lineRange: "35-39", note: "Catches RangeError when age < 18 is assigned." }
    ],
    expectedOutput: `User valid: John 25
Validation blocked: Value 15 failed validation for 'age'`
  },
  {
    id: "js-ex-25",
    title: "Method Chaining Builder Pattern with Proxy",
    category: "Metaprogramming & Proxies",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs a dynamic query builder using Proxy that intercepts arbitrary method invocations without pre-defining every SQL/query clause.",
    conceptsCovered: ["Proxy apply trap", "Method Chaining", "Dynamic Introspection", "Query Builder"],
    code: `function createQueryBuilder(tableName) {
  const clauses = { table: tableName, where: [], selects: [] };

  const proxy = new Proxy({}, {
    get(target, prop) {
      if (prop === "build") {
        return () => {
          const selectClause = clauses.selects.length > 0 ? clauses.selects.join(", ") : "*";
          let sql = \`SELECT \${selectClause} FROM \${clauses.table}\`;
          if (clauses.where.length > 0) {
            sql += " WHERE " + clauses.where.map(w => \`\${w.col} = '\${w.val}'\`).join(" AND ");
          }
          return sql;
        };
      }

      // Dynamic chain handler for methods like select, where, orderBy:
      return function(...args) {
        if (prop === "select") {
          clauses.selects.push(...args);
        } else if (prop === "where") {
          clauses.where.push({ col: args[0], val: args[1] });
        }
        return proxy; // Return proxy to enable infinite chaining!
      };
    }
  });

  return proxy;
}

// Build query fluently
const sql = createQueryBuilder("users")
  .select("id", "name", "email")
  .where("status", "ACTIVE")
  .where("role", "ADMIN")
  .build();

console.log(sql);`,
    breakdown: [
      { lineRange: "4-15", note: "get trap returns terminal build() function when requested." },
      { lineRange: "17-26", note: "Dynamically returns chaining handlers that push clauses and return the proxy." }
    ],
    expectedOutput: `SELECT id, name, email FROM users WHERE status = 'ACTIVE' AND role = 'ADMIN'`
  },
  {
    id: "js-ex-26",
    title: "Revocable Proxy for Temporary Plugin Capabilities",
    category: "Metaprogramming & Proxies",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements capability-based security by passing a revocable proxy to an untrusted plugin and revoking all access after task completion.",
    conceptsCovered: ["Proxy.revocable", "Sandboxing", "Capability Security", "Access Control"],
    code: `function executePluginSafely(pluginFn, sensitiveContext) {
  // Create revocable proxy around sensitive context
  const { proxy, revoke } = Proxy.revocable(sensitiveContext, {
    set(target, prop, value) {
      console.log(\`Plugin set \${prop} = \${value}\`);
      target[prop] = value;
      return true;
    }
  });

  try {
    // Allow plugin to run during its permitted time window
    pluginFn(proxy);
  } finally {
    // Revoke all access permanently!
    revoke();
  }
}

const db = { connection: "live", activeQueries: 0 };

// Untrusted plugin
const plugin = (api) => {
  api.activeQueries++;
  console.log("Plugin executed query successfully");
};

executePluginSafely(plugin, db);

// If the plugin cached the 'api' proxy and tries to use it later:
// api.activeQueries++; // Throws TypeError: Cannot perform 'set' on a proxy that has been revoked!
console.log("DB queries:", db.activeQueries);`,
    breakdown: [
      { lineRange: "1-9", note: "Proxy.revocable creates { proxy, revoke }." },
      { lineRange: "15-18", note: "finally block guarantees that revoke() is called even if the plugin throws." },
      { lineRange: "29-33", note: "Demonstrates that internal state was updated, but future proxy access is revoked." }
    ],
    expectedOutput: `Plugin set activeQueries = 1
Plugin executed query successfully
DB queries: 1`
  },
  {
    id: "js-ex-27",
    title: "Prototype Pollution Sanitizer and Hardened Deep Merge",
    category: "Objects & Prototypes",
    difficulty: "advanced",
    whatThisCodeCovers: "Defends applications against prototype pollution vulnerabilities by rejecting `__proto__`, `constructor`, and `prototype` keys during deep object merging.",
    conceptsCovered: ["Prototype Pollution", "Security Hardening", "Deep Merge", "Object.create(null)"],
    code: `function safeDeepMerge(target, source) {
  if (target === null || typeof target !== "object") return source;
  if (source === null || typeof source !== "object") return target;

  for (const key of Object.keys(source)) {
    // DEFENSE 1: Block prototype pollution vectors!
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      console.warn(\`BLOCKED POTENTIAL EXPLOIT KEY: '\${key}'\`);
      continue;
    }

    const sourceVal = source[key];
    const targetVal = target[key];

    if (Array.isArray(sourceVal)) {
      target[key] = [...sourceVal];
    } else if (sourceVal !== null && typeof sourceVal === "object") {
      if (!targetVal || typeof targetVal !== "object") {
        target[key] = Object.create(null); // DEFENSE 2: Prototype-free nested objects
      }
      safeDeepMerge(target[key], sourceVal);
    } else {
      target[key] = sourceVal;
    }
  }

  return target;
}

// Simulated malicious payload:
const exploitPayload = JSON.parse('{"__proto__": {"isAdmin": true}, "validKey": 123}');

const appState = {};
safeDeepMerge(appState, exploitPayload);

console.log("App state validKey:", appState.validKey);
console.log("Global Object polluted?", ({}).isAdmin); // undefined (Protected!)`,
    breakdown: [
      { lineRange: "6-10", note: "Explicitly checks for and drops __proto__, constructor, and prototype keys." },
      { lineRange: "17-19", note: "Uses Object.create(null) for dynamic objects to ensure no prototype inheritance." },
      { lineRange: "31-35", note: "Verifies that empty objects ({}) remain unpolluted after merging malicious JSON." }
    ],
    expectedOutput: `BLOCKED POTENTIAL EXPLOIT KEY: '__proto__'
App state validKey: 123
Global Object polluted? undefined`
  },
  {
    id: "js-ex-28",
    title: "Custom EventEmitter Subclassing EventTarget",
    category: "Objects & Prototypes",
    difficulty: "intermediate",
    whatThisCodeCovers: "Leverages the browser and Node.js native `EventTarget` class to implement an event emitter with native `CustomEvent` dispatching and memory cleanup.",
    conceptsCovered: ["EventTarget", "CustomEvent", "Inheritance", "Native Web APIs"],
    code: `class StateStore extends EventTarget {
  constructor(initialData) {
    super();
    this._data = initialData;
  }

  get(key) {
    return this._data[key];
  }

  set(key, value) {
    const oldValue = this._data[key];
    this._data[key] = value;

    // Dispatch native CustomEvent with detail payload
    this.dispatchEvent(new CustomEvent("change", {
      detail: { key, oldValue, value }
    }));
  }
}

// Test StateStore
const store = new StateStore({ theme: "dark" });

// Clean addEventListener with AbortSignal auto-cleanup!
const controller = new AbortController();

store.addEventListener("change", (e) => {
  console.log(\`Key '\${e.detail.key}' changed from '\${e.detail.oldValue}' to '\${e.detail.value}'\`);
}, { signal: controller.signal });

store.set("theme", "light");

// Unsubscribe by aborting signal
controller.abort();
store.set("theme", "neon"); // Will not log because listener was cleanly unsubscribed!`,
    breakdown: [
      { lineRange: "1-4", note: "Extends native EventTarget class, inheriting native event dispatching methods." },
      { lineRange: "14-18", note: "Dispatches native CustomEvent with detail payload." },
      { lineRange: "25-29", note: "Uses modern { signal: controller.signal } to manage listener lifecycle cleanly." }
    ],
    expectedOutput: `Key 'theme' changed from 'dark' to 'light'`
  },
  {
    id: "js-ex-29",
    title: "Symbol.toPrimitive & Symbol.toStringTag Customization",
    category: "Metaprogramming & Proxies",
    difficulty: "intermediate",
    whatThisCodeCovers: "Customizes type coercion and inspection by implementing the well-known symbols `Symbol.toPrimitive` and `Symbol.toStringTag` on a mathematical Vector class.",
    conceptsCovered: ["Symbol.toPrimitive", "Symbol.toStringTag", "Type Coercion", "Vector Math"],
    code: `class Vector2D {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  get magnitude() {
    return Math.hypot(this.x, this.y);
  }

  // 1. Symbol.toStringTag customizes Object.prototype.toString
  get [Symbol.toStringTag]() {
    return "Vector2D";
  }

  // 2. Symbol.toPrimitive handles mathematical and string coercion
  [Symbol.toPrimitive](hint) {
    if (hint === "number") {
      return this.magnitude;
    }
    if (hint === "string") {
      return \`(\${this.x}, \${this.y})\`;
    }
    return this.magnitude; // 'default' hint (+ operator)
  }
}

const v1 = new Vector2D(3, 4);

// Inspection:
console.log(Object.prototype.toString.call(v1)); // "[object Vector2D]"

// String coercion:
console.log(\`Position: \${v1}\`); // "Position: (3, 4)"

// Numeric coercion (magnitude is Math.hypot(3, 4) = 5):
console.log(+v1);       // 5
console.log(v1 + 10);   // 15`,
    breakdown: [
      { lineRange: "11-14", note: "Symbol.toStringTag changes [object Object] into [object Vector2D]." },
      { lineRange: "16-25", note: "Symbol.toPrimitive handles 'number', 'string', and 'default' coercion hints." },
      { lineRange: "33-38", note: "Demonstrates arithmetic using the magnitude and template string interpolation." }
    ],
    expectedOutput: `[object Vector2D]
Position: (3, 4)
5
15`
  },
  {
    id: "js-ex-30",
    title: "Object Property Masking and Virtual Fields with Proxy",
    category: "Metaprogramming & Proxies",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses a Proxy to implement privacy masking (hiding SSNs and passwords) and virtual computed fields that do not physically exist on the underlying object.",
    conceptsCovered: ["Proxy", "Property Masking", "Virtual Properties", "Data Sanitization"],
    code: `function createSanitizedUser(rawUser) {
  return new Proxy(rawUser, {
    get(target, prop) {
      // 1. Mask sensitive fields
      if (prop === "ssn") {
        return "***-**-" + String(target.ssn).slice(-4);
      }
      if (prop === "password") {
        return "[REDACTED]";
      }

      // 2. Virtual computed field
      if (prop === "fullName") {
        return \`\${target.firstName} \${target.lastName}\`;
      }

      return target[prop];
    },

    // Hide sensitive keys from Object.keys() and for...in
    ownKeys(target) {
      return Reflect.ownKeys(target).filter(k => k !== "password" && k !== "ssn");
    }
  });
}

const raw = {
  firstName: "Ada",
  lastName: "Lovelace",
  ssn: "123-45-6789",
  password: "super_secret_password"
};

const user = createSanitizedUser(raw);
console.log("Full Name:", user.fullName); // Virtual property: "Ada Lovelace"
console.log("Masked SSN:", user.ssn);       // Masked: "***-**-6789"
console.log("Keys:", Object.keys(user));   // ['firstName', 'lastName'] (ssn & password hidden!)`,
    breakdown: [
      { lineRange: "4-11", note: "get trap masks sensitive properties like ssn and password on read." },
      { lineRange: "13-16", note: "Calculates virtual fullName property dynamically." },
      { lineRange: "20-23", note: "ownKeys trap filters out ssn and password from Object.keys and reflection." }
    ],
    expectedOutput: `Full Name: Ada Lovelace
Masked SSN: ***-**-6789
Keys: [ 'firstName', 'lastName' ]`
  }
];
