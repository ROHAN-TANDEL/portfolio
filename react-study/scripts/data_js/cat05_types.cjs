const { createCard } = require("../js_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 51,
  category: "Types & Coercion",
  concept: "Primitive Types vs Reference Types",
  priority: "must-know",
  difficulty: "beginner",
  question: "What are the 7 Primitive Types in JavaScript, and how do they differ from Reference Types in memory?",
  answer: "The 7 primitive types are: string, number, bigint, boolean, undefined, symbol, and null. Primitives are immutable and stored directly in stack frames by value. Reference types (Object, Array, Function, Map, Set, Date) are mutable and stored in the Heap; variables on the stack hold memory pointers (addresses) pointing to the heap object.",
  explanation: "When you assign a primitive, a separate copy of the value is created: `let a = 5; let b = a; b = 10;` leaves `a = 5`. When you assign a reference type: `let x = { v: 1 }; let y = x;`, both variables hold the exact same memory pointer, meaning mutations on `y.v` immediately affect `x.v`.",
  code: `// Primitive by value
let num1 = 42;
let num2 = num1;
num2 = 100;
console.log(num1); // 42 (unchanged)

// Reference by address pointer
let obj1 = { name: "Alice" };
let obj2 = obj1;
obj2.name = "Bob";
console.log(obj1.name); // "Bob" (mutated via shared reference!)

// Memory check:
console.log(obj1 === obj2); // true (same heap address)`,
  recallHint: "7 Primitives: string, number, bigint, boolean, undefined, symbol, null (by value). Objects (by reference).",
  interviewTip: "Never forget `symbol` and `bigint` when reciting the 7 primitives. Many candidates only mention 5.",
  tags: ["primitives", "reference-types", "stack-vs-heap", "memory"]
}));

cards.push(createCard({
  idNum: 52,
  category: "Types & Coercion",
  concept: "typeof Operator & Historical Quirks",
  priority: "must-know",
  difficulty: "beginner",
  question: "What does the typeof operator return for null and functions, and why does typeof null return 'object'?",
  answer: "`typeof null === 'object'` due to a historical bug from the first 1995 JavaScript implementation. Values were stored with a 32-bit tag where type tag 000 indicated an object, and null was represented as the NULL pointer (0x00, all zeroes), falsely matching the object tag. `typeof function() {}` returns 'function', which is an implementation-level convenience despite functions being objects.",
  explanation: "A proposed fix in ECMAScript (`typeof null === 'null'`) was rejected because it would break millions of existing websites. To accurately check for null, use strict equality: `val === null`. To check for general objects safely: `typeof val === 'object' && val !== null`.",
  code: `console.log(typeof "hello");      // "string"
console.log(typeof 42);           // "number"
console.log(typeof true);         // "boolean"
console.log(typeof undefined);    // "undefined"
console.log(typeof Symbol());     // "symbol"
console.log(typeof 10n);          // "bigint"
console.log(typeof function() {}); // "function"

// Quirks & Traps:
console.log(typeof null);         // "object" (Historical bug!)
console.log(typeof []);           // "object"
console.log(typeof NaN);          // "number" (Not-a-Number is numeric type!)

// Safe null check
const isNull = (x) => x === null;`,
  recallHint: "typeof null === 'object' (32-bit type tag 000 bug). typeof NaN === 'number'.",
  interviewTip: "Explaining the 32-bit type-tag 000 representation for the `typeof null === 'object'` bug always impresses interviewers.",
  tags: ["typeof", "quirks", "null", "type-system"]
}));

cards.push(createCard({
  idNum: 53,
  category: "Types & Coercion",
  concept: "Symbols & Symbol.for() Global Registry",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What is the Symbol primitive type, and what is the difference between Symbol() and Symbol.for()?",
  answer: "`Symbol()` creates a guaranteed unique, immutable primitive value used for collision-free object property keys and private-like metadata. `Symbol.for(key)` looks up or registers a shared symbol in the runtime's global Symbol registry across the entire process, including iframes and service workers.",
  explanation: "Every `Symbol('desc')` call produces a completely distinct symbol: `Symbol('x') !== Symbol('x')`. Symbols are hidden from `Object.keys()` and `JSON.stringify()`, accessible only via `Object.getOwnPropertySymbols()` or `Reflect.ownKeys()`. In contrast, `Symbol.for('key')` is global and idempotent: `Symbol.for('id') === Symbol.for('id')`.",
  code: `// 1. Symbol() is always unique
const s1 = Symbol("id");
const s2 = Symbol("id");
console.log(s1 === s2); // false!

// 2. Symbol.for() is globally shared
const g1 = Symbol.for("app.user");
const g2 = Symbol.for("app.user");
console.log(g1 === g2); // true!
console.log(Symbol.keyFor(g1)); // "app.user"

// 3. Object property keys using Symbol
const user = {
  name: "Alice",
  [s1]: 98765 // Hidden metadata key
};
console.log(Object.keys(user)); // ["name"] (Symbol key excluded!)
console.log(user[s1]); // 98765`,
  recallHint: "Symbol() = unique every time. Symbol.for(key) = global shared registry. Invisible to Object.keys.",
  interviewTip: "Highlight that Symbols are not truly private because `Object.getOwnPropertySymbols(obj)` and `Reflect.ownKeys(obj)` can still inspect them.",
  tags: ["symbols", "symbol-for", "metaprogramming", "primitives"]
}));

cards.push(createCard({
  idNum: 54,
  category: "Types & Coercion",
  concept: "BigInt & Mixed Arithmetic Constraints",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What is BigInt, what problem does it solve, and why does JavaScript forbid mixing BigInt and Number in arithmetic?",
  answer: "BigInt represents arbitrarily large integers beyond JavaScript's standard IEEE 754 float limit (`Number.MAX_SAFE_INTEGER = 2^53 - 1`). JavaScript strictly forbids mixing BigInt and Number arithmetic (e.g. `10n + 5` throws TypeError) because converting between arbitrary-precision integers and lossy floats could silently cause precision loss.",
  explanation: "Standard JavaScript numbers use 64-bit double-precision floats, which only have 53 bits of integer mantissa precision. Integers $> 9,007,199,254,740,991$ lose precision (e.g. `9007199254740992 === 9007199254740993` is true!). BigInt handles arbitrary length (e.g. cryptographic hashes, database 64-bit IDs). To mix them, explicit conversion (`BigInt(x)` or `Number(x)`) is required.",
  code: `// Standard Number precision failure:
console.log(9007199254740991 + 1); // 9007199254740992
console.log(9007199254740991 + 2); // 9007199254740992 (Precision lost!)

// BigInt resolves this accurately:
const bigA = 9007199254740991n;
console.log(bigA + 2n); // 9007199254740993n (Exact!)

// Mixed arithmetic requires explicit casting:
// const mixed = 10n + 5; // TypeError: Cannot mix BigInt and other types
const valid = 10n + BigInt(5);
console.log(valid); // 15n`,
  recallHint: "BigInt: for ints > 2^53 - 1. Cannot implicitly mix with Number (throws TypeError).",
  interviewTip: "Mention that BigInt cannot be serialized by `JSON.stringify` by default (throws TypeError), and must have a custom `.toJSON()` serializer for API responses.",
  tags: ["bigint", "ieee-754", "numbers", "precision"]
}));

cards.push(createCard({
  idNum: 55,
  category: "Types & Coercion",
  concept: "The Abstract Equality Algorithm (==)",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does the ECMAScript Abstract Equality Comparison (==) algorithm work?",
  answer: "If the types are identical, it performs strict equality (`===`). If types differ: 1) `null == undefined` is always true. 2) If comparing Number and String, String is coerced to Number. 3) If comparing Boolean to anything, Boolean is coerced to Number (`true -> 1`, `false -> 0`). 4) If comparing Object to Primitive, Object is coerced to Primitive via `ToPrimitive`.",
  explanation: "Because `==` performs loose type coercion, it produces infamous counter-intuitive results: `[] == ![]` is true (because `![]` becomes `false`, which becomes `0`, and `[]` coerces via `ToPrimitive` to `''`, which coerces to `0`). Always use strict equality (`===`) in production code to avoid these coercion pitfalls.",
  code: `// Common Loose Equality Quirks:
console.log(null == undefined); // true (Spec rule)
console.log(null == 0);         // false (null only equals undefined with ==)
console.log("" == 0);           // true ("" converts to 0)
console.log("0" == false);      // true (both convert to 0)

// The famous [] == ![]:
// 1. ![] becomes false (objects are truthy)
// 2. [] == false -> [] == 0
// 3. [].toString() becomes "" -> "" == 0 -> 0 == 0
console.log([] == ![]); // true!`,
  recallHint: "== coerces: null==undefined, String->Number, Boolean->Number, Object->ToPrimitive.",
  interviewTip: "Walk the interviewer through `[] == ![]` step by step. It demonstrates that you actually know the ECMAScript specification rules rather than just guessing.",
  tags: ["loose-equality", "coercion", "abstract-equality", "spec"]
}));

cards.push(createCard({
  idNum: 56,
  category: "Types & Coercion",
  concept: "Strict Equality (===) vs Object.is()",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What are the two specific edge cases where Object.is() differs from strict equality (===)?",
  answer: "`Object.is()` differs from `===` in exactly two cases: 1) `NaN`: `Object.is(NaN, NaN)` is `true`, whereas `NaN === NaN` is `false`. 2) `-0` vs `+0`: `Object.is(-0, +0)` is `false`, whereas `-0 === +0` is `true`.",
  explanation: "Strict equality (`===`) follows the IEEE 754 floating-point standard where `NaN` is not equal to anything, including itself. `Object.is()` implements the SameValue specification algorithm, testing mathematical and bitwise identity. React uses `Object.is()` internally in `React.memo` and `useEffect` dependency arrays to perform shallow equality checks.",
  code: `// Case 1: NaN comparison
console.log(NaN === NaN);            // false!
console.log(Object.is(NaN, NaN));     // true!
console.log(Number.isNaN(NaN));      // true

// Case 2: Negative Zero vs Positive Zero
console.log(-0 === +0);              // true!
console.log(Object.is(-0, +0));       // false!

// Why -0 matters (division produces -Infinity):
console.log(1 / -0); // -Infinity
console.log(1 / +0); // Infinity`,
  recallHint: "Object.is(): NaN equals NaN (true), -0 does NOT equal +0 (false). Used by React shallow comparison.",
  interviewTip: "Tie `Object.is()` directly to React. React uses `Object.is` to determine if state changed in `useState` and `useEffect`.",
  tags: ["object-is", "strict-equality", "nan", "negative-zero", "react"]
}));

cards.push(createCard({
  idNum: 57,
  category: "Types & Coercion",
  concept: "The ToPrimitive Abstract Operation",
  priority: "advanced",
  difficulty: "advanced",
  question: "How does the ToPrimitive abstract operation convert objects to primitives?",
  answer: "When an object is used in a primitive context, the engine calls `ToPrimitive(hint)`. If `obj[Symbol.toPrimitive]` is defined, it is invoked with hint ('number', 'string', or 'default'). If not defined: for hint 'string', it calls `.toString()` then `.valueOf()`; for hint 'number' or 'default', it calls `.valueOf()` then `.toString()`.",
  explanation: "Arithmetic operations like subtraction (`obj - 5`) pass hint `'number'`. Template literals (`` `${obj}` ``) pass hint `'string'`. The addition operator (`obj + '5'` or `obj + 5`) passes hint `'default'`. Implementing `[Symbol.toPrimitive]` allows complete custom control over coercion behavior.",
  code: `const account = {
  balance: 500,
  currency: "USD",

  // Custom ToPrimitive hook
  [Symbol.toPrimitive](hint) {
    if (hint === "number") {
      return this.balance;
    }
    if (hint === "string") {
      return \`\${this.balance} \${this.currency}\`;
    }
    return this.balance; // 'default' hint (+ operator)
  }
};

console.log(+account);         // 500 (hint: "number")
console.log(\`Total: \${account}\`); // "Total: 500 USD" (hint: "string")
console.log(account + 100);    // 600 (hint: "default")`,
  recallHint: "ToPrimitive: checks [Symbol.toPrimitive](hint), else valueOf/toString depending on hint.",
  interviewTip: "Mention that ordinary objects return `[object Object]` because their default `valueOf` returns the object itself, forcing fallback to `toString()`.",
  tags: ["toprimitive", "coercion", "symbol-toprimitive", "internals"]
}));

cards.push(createCard({
  idNum: 58,
  category: "Types & Coercion",
  concept: "Implicit Coercion in Arithmetic & String Concatenation",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does the '+' operator decide between string concatenation and numeric addition?",
  answer: "If either operand evaluates to a String (or converts to a string via ToPrimitive), the '+' operator performs string concatenation on both operands. All other mathematical operators (`-`, `*`, `/`, `%`) ALWAYS coerce operands to Numbers.",
  explanation: "With `1 + '2'`, the presence of a string forces `1` to coerce to `'1'`, resulting in `'12'`. With `'6' - '2'`, the subtraction operator has no string definition, so both strings are coerced to numbers, resulting in numeric `4`. With boolean addition: `true + true === 2` because booleans coerce to `1`.",
  code: `console.log(1 + "2");      // "12" (String concatenation)
console.log("6" - "2");    // 4    (Numeric subtraction)
console.log("6" * "2");    // 12   (Numeric multiplication)
console.log("6" / "2");    // 3    (Numeric division)

// Unary '+' coerces directly to number
console.log(+"42");        // 42
console.log(+true);        // 1
console.log(+false);       // 0
console.log(+null);        // 0
console.log(+undefined);   // NaN

// Boolean addition
console.log(true + true);  // 2 (1 + 1)`,
  recallHint: "+ prefers string concatenation if any string present. -, *, / always force numeric coercion.",
  interviewTip: "Highlight that `+undefined` produces `NaN`, whereas `+null` produces `0`. This is a very common source of silent mathematical bugs.",
  tags: ["type-coercion", "arithmetic", "plus-operator"]
}));

cards.push(createCard({
  idNum: 59,
  category: "Types & Coercion",
  concept: "Truthy vs Falsy Values in JavaScript",
  priority: "must-know",
  difficulty: "beginner",
  question: "What are the exact falsy values in JavaScript?",
  answer: "There are exactly 8 falsy values in JavaScript: `false`, `0`, `-0`, `0n` (BigInt zero), `\"\"` (empty string), `null`, `undefined`, and `NaN`. Everything else is truthy, including empty arrays `[]`, empty objects `{}`, and the string `'0'`.",
  explanation: "Any value can be explicitly coerced to a boolean using `Boolean(val)` or the double NOT operator `!!val`. In conditional statements (`if`, `while`, ternary), values are coerced implicitly using the abstract `ToBoolean` operation. Empty collections (`[]`, `{}`) are objects and therefore evaluate to `true`.",
  code: `// The 8 Falsy Values:
const falsyList = [false, 0, -0, 0n, "", null, undefined, NaN];
falsyList.forEach(v => console.log(Boolean(v))); // All print false

// Trap: These are TRUTHY!
console.log(Boolean([]));    // true (empty array is an object)
console.log(Boolean({}));    // true (empty object is an object)
console.log(Boolean("0"));   // true (non-empty string)
console.log(Boolean("false")); // true (non-empty string)
console.log(Boolean(() => {})); // true (function is an object)`,
  recallHint: "8 Falsy: false, 0, -0, 0n, '', null, undefined, NaN. Empty [] and {} are TRUTHY.",
  interviewTip: "Watch out for `if (arr.length)` vs `if (arr)`. `if (arr)` is always true even if the array is empty!",
  tags: ["truthy", "falsy", "boolean-coercion"]
}));

cards.push(createCard({
  idNum: 60,
  category: "Types & Coercion",
  concept: "Boxing and Unboxing (Primitive Wrappers)",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What is Boxing and Unboxing in JavaScript, and how do primitives have methods?",
  answer: "Boxing (autoboxing) is the temporary wrapping of a primitive value into its corresponding object wrapper (`String`, `Number`, `Boolean`, `Symbol`, `BigInt`) when accessing a property or method (e.g. `'hello'.toUpperCase()`). Once the property access finishes, the temporary wrapper object is immediately discarded for garbage collection.",
  explanation: "Primitives themselves do not have methods or properties. When `'test'.length` is executed, the JavaScript engine implicitly executes `new String('test').length`, extracts the primitive number, and discards the wrapper object. Unboxing is the reverse: converting a wrapper object back to a primitive via `.valueOf()`.",
  code: `// Autoboxing in action
const str = "hello";
console.log(str.toUpperCase()); // "HELLO"
// Engine internally does: Object(str).toUpperCase()

// Trap: You cannot assign properties to boxed primitives!
str.customProp = 123; // In non-strict mode: silently succeeds on temporary wrapper
console.log(str.customProp); // undefined! (Temporary wrapper was immediately GC'd)

// Manual boxing & unboxing
const boxed = new Number(42); // Object wrapper
console.log(typeof boxed);     // "object"
const unboxed = boxed.valueOf(); // 42 primitive
console.log(typeof unboxed);   // "number"`,
  recallHint: "Boxing: Engine temporarily creates Object(primitive) to read methods, then immediately discards it.",
  interviewTip: "Never instantiate wrappers manually with `new Number(5)` or `new Boolean(false)`. `new Boolean(false)` is an object and therefore evaluates to TRUTHY in an if-statement!",
  tags: ["autoboxing", "unboxing", "primitive-wrappers", "internals"]
}));

cards.push(createCard({
  idNum: 61,
  category: "Types & Coercion",
  concept: "Nullish Coalescing (??) vs Logical OR (||)",
  priority: "must-know",
  difficulty: "beginner",
  question: "What is the difference between the Nullish Coalescing operator (??) and the Logical OR operator (||)?",
  answer: "`||` returns the right-hand operand if the left operand is ANY falsy value (`0`, `\"\"`, `false`, `null`, `undefined`, `NaN`). `??` returns the right-hand operand ONLY if the left operand is nullish (`null` or `undefined`).",
  explanation: "Using `||` for default parameter values is dangerous when valid values can be `0`, `false`, or `\"\"`. For example, `timeout = config.timeout || 3000` overrides a valid `0ms` timeout with `3000`. `??` safely preserves `0`, `false`, and `\"\"`, triggering default fallback exclusively for `null` and `undefined`.",
  code: `const config = {
  animationSpeed: 0,
  showTitle: false,
  emptyText: ""
};

// Logical OR (||) treats 0, false, "" as falsy and overwrites them:
console.log(config.animationSpeed || 100); // 100 (BUG: 0 was intended!)
console.log(config.showTitle || true);     // true (BUG: false was intended!)
console.log(config.emptyText || "Default"); // "Default" (BUG: "" was intended!)

// Nullish Coalescing (??) preserves valid falsy values:
console.log(config.animationSpeed ?? 100); // 0 (Correct!)
console.log(config.showTitle ?? true);     // false (Correct!)
console.log(config.emptyText ?? "Default"); // "" (Correct!)
console.log(config.nonExistent ?? "Fallback"); // "Fallback"`,
  recallHint: "|| triggers on ALL 8 falsy values. ?? triggers ONLY on null and undefined.",
  interviewTip: "Always recommend `??` for configuration defaults and optional options to avoid overriding legitimate zero or boolean false values.",
  tags: ["nullish-coalescing", "logical-or", "es2020", "best-practices"]
}));

cards.push(createCard({
  idNum: 62,
  category: "Types & Coercion",
  concept: "NaN Detection & Number.isNaN vs isNaN",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is the critical difference between the global isNaN() function and Number.isNaN()?",
  answer: "The global `isNaN(val)` function first coerces its argument to a Number before checking (`isNaN('hello')` is `true` because `'hello'` coerces to `NaN`). `Number.isNaN(val)` (introduced in ES6) performs NO type coercion; it returns `true` ONLY if the value is currently of type Number AND is exactly `NaN`.",
  explanation: "Because `NaN !== NaN`, testing for `NaN` requires a specialized function. Global `isNaN('abc')` is misleading because `'abc'` is a string, not NaN. `Number.isNaN('abc')` correctly returns `false`. `Number.isNaN` can be polyfilled as: `val !== val && typeof val === 'number'`.",
  code: `// Global isNaN coerces argument to number first:
console.log(isNaN("hello"));    // true (Coerces "hello" to NaN)
console.log(isNaN(undefined));  // true (Coerces undefined to NaN)
console.log(isNaN({}));         // true (Coerces {} to NaN)

// Number.isNaN (strict, no coercion):
console.log(Number.isNaN("hello"));    // false! (It is a string, not NaN)
console.log(Number.isNaN(undefined));  // false!
console.log(Number.isNaN({}));         // false!

// True NaN values:
console.log(Number.isNaN(NaN));        // true
console.log(Number.isNaN(0 / 0));      // true

// Elegant polyfill:
const checkNaN = (x) => x !== x;`,
  recallHint: "Global isNaN coerces to number (buggy). Number.isNaN checks if value is strictly NaN without coercion.",
  interviewTip: "Mention the one-line polyfill `x !== x`. Since NaN is the only value in JavaScript not equal to itself, `x !== x` is 100% reliable for identifying NaN.",
  tags: ["nan", "number-isnan", "type-coercion"]
}));

module.exports = cards;
