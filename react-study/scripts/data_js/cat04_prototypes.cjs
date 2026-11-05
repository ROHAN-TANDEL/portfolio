const { createCard } = require("../js_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 37,
  category: "Objects & Prototypes",
  concept: "Prototypal vs Classical Inheritance",
  priority: "must-know",
  difficulty: "beginner",
  question: "How does JavaScript's Prototypal Inheritance fundamentally differ from Classical (class-based) Inheritance?",
  answer: "In classical inheritance (Java/C++), classes act as static compile-time blueprints from which concrete instances are copied. In JavaScript's prototypal inheritance, objects inherit directly from other live objects via dynamic delegate links (the Prototype Chain). There are no classes at the engine level; ES6 'class' syntax is sugar over prototype links.",
  explanation: "Classical inheritance involves copying methods and structure down an inheritance hierarchy. Prototypal inheritance uses delegation: if an object does not have a property, the runtime traverses its `[[Prototype]]` link to query its parent object. If the parent's prototype is mutated at runtime, all child objects immediately reflect the new behavior.",
  code: `const animal = {
  eats: true,
  walk() { return "Walking..."; }
};

// rabbit delegates directly to animal
const rabbit = Object.create(animal);
rabbit.jumps = true;

console.log(rabbit.eats); // true (delegated to animal)
console.log(rabbit.walk()); // "Walking..."

// Mutating prototype at runtime affects all delegates immediately!
animal.sleep = () => "Sleeping...";
console.log(rabbit.sleep()); // "Sleeping..."`,
  recallHint: "Classical = copy from blueprint. Prototypal = dynamic delegation to live prototype object.",
  interviewTip: "Emphasize delegation vs copying. Prototypal inheritance is dynamic delegation at runtime.",
  tags: ["prototypes", "inheritance", "delegation"]
}));

cards.push(createCard({
  idNum: 38,
  category: "Objects & Prototypes",
  concept: "prototype vs __proto__ vs [[Prototype]]",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is the difference between 'prototype', '__proto__', and '[[Prototype]]' in JavaScript?",
  answer: "1) '[[Prototype]]' is the internal, hidden specification slot on every object pointing to its parent prototype. 2) '__proto__' is the legacy accessor property (getter/setter on Object.prototype) exposing [[Prototype]]. 3) 'prototype' is a regular property that exists ONLY on constructor functions, defining what [[Prototype]] will be assigned to instances created via 'new'.",
  explanation: "Only functions that can be used as constructors possess a `.prototype` object. Normal object literals (`{}`) do NOT have a `.prototype` property; they have an internal `[[Prototype]]` slot pointing to `Object.prototype`. In modern JavaScript, `Object.getPrototypeOf(obj)` and `Object.setPrototypeOf(obj, proto)` replace `__proto__`.",
  code: `function Dog(name) {
  this.name = name;
}
Dog.prototype.bark = function() { return "Woof!"; };

const myDog = new Dog("Buddy");

// 1. [[Prototype]] of myDog points to Dog.prototype
console.log(Object.getPrototypeOf(myDog) === Dog.prototype); // true

// 2. Legacy __proto__ accessor
console.log(myDog.__proto__ === Dog.prototype); // true

// 3. Object instances do not have .prototype
console.log(myDog.prototype); // undefined
console.log(typeof Dog.prototype); // "object"`,
  recallHint: "Constructor has .prototype. Instances have [[Prototype]] (accessed via Object.getPrototypeOf).",
  interviewTip: "Never use `__proto__` in production. Always mention `Object.getPrototypeOf()` and `Object.setPrototypeOf()` as the ECMAScript standard methods.",
  tags: ["prototype", "__proto__", "internal-slots"]
}));

cards.push(createCard({
  idNum: 39,
  category: "Objects & Prototypes",
  concept: "The Prototype Chain & Lookup Resolution",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does property lookup resolution proceed along the Prototype Chain, and where does it terminate?",
  answer: "When a property is accessed on an object, the engine first checks the object's own properties. If not found, it traverses the [[Prototype]] link to the parent object, continuing recursively up the chain until it either finds the property or reaches `Object.prototype.[[Prototype]]`, which is 'null'. If reached, it returns 'undefined'.",
  explanation: "Property lookup is $O(N)$ with respect to chain depth. Property assignment (`obj.prop = value`), however, does NOT traverse the prototype chain to mutate the prototype; it creates an 'own property' on `obj` directly (shadowing the prototype property), unless a setter exists on the prototype chain.",
  code: `const grandParent = { familyName: "Smith" };
const parent = Object.create(grandParent);
const child = Object.create(parent);

// Lookup traverses: child -> parent -> grandParent
console.log(child.familyName); // "Smith"

// Setting property shadows it on child, without mutating grandParent
child.familyName = "Johnson";
console.log(child.familyName);       // "Johnson" (own property)
console.log(grandParent.familyName); // "Smith" (unaffected)

// Top of the chain terminates at null
console.log(Object.getPrototypeOf(Object.prototype)); // null`,
  recallHint: "Lookup: own properties -> parent prototype -> ... -> Object.prototype -> null (returns undefined).",
  interviewTip: "Explain that writes shadow properties on the child instance rather than modifying the prototype, preventing accidental global prototype pollution.",
  tags: ["prototype-chain", "lookup-resolution", "shadowing"]
}));

cards.push(createCard({
  idNum: 40,
  category: "Objects & Prototypes",
  concept: "Object.create() Mechanics",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does Object.create() work, and how does it enable prototype delegation without running a constructor?",
  answer: "`Object.create(proto, [propertiesObject])` creates a brand new object whose internal [[Prototype]] is linked directly to the specified `proto` object. It creates the delegation link cleanly without executing constructor code or instantiating unwanted instance properties.",
  explanation: "Before ES6 `class`, establishing inheritance between constructors required setting `Child.prototype = Object.create(Parent.prototype)` and resetting `Child.prototype.constructor = Child`. If you used `Child.prototype = new Parent()`, the Parent constructor would execute prematurely, leaking instance fields onto the prototype.",
  code: `// Clean prototypal inheritance with Object.create
const vehicle = {
  hasWheels: true,
  drive() { return "Moving forward"; }
};

// Create motorcycle delegating to vehicle with custom descriptors
const motorcycle = Object.create(vehicle, {
  wheels: { value: 2, writable: true, enumerable: true },
  model: { value: "Ducati", enumerable: true }
});

console.log(motorcycle.wheels); // 2
console.log(motorcycle.hasWheels); // true (delegated)
console.log(motorcycle.drive()); // "Moving forward" (delegated)
console.log(Object.getPrototypeOf(motorcycle) === vehicle); // true`,
  recallHint: "Object.create(proto): creates new object linked to proto without invoking constructors.",
  interviewTip: "Mention that passing `Object.create(null)` creates a dictionary object with NO prototype, completely free of default methods like `toString` or `hasOwnProperty`.",
  tags: ["object-create", "prototypes", "clean-inheritance"]
}));

cards.push(createCard({
  idNum: 41,
  category: "Objects & Prototypes",
  concept: "Dictionary Objects (Object.create(null))",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What is an Object.create(null) object, and why is it used for secure hash maps?",
  answer: "`Object.create(null)` creates an object with no prototype (`[[Prototype]] === null`). It has zero inherited properties (`toString`, `valueOf`, `constructor`, `__proto__`), making it immune to accidental prototype lookups and prototype pollution attacks when used as a key-value dictionary.",
  explanation: "In a standard object literal `{}`: `'toString' in obj` evaluates to `true`. If an attacker submits a payload with key `'constructor'` or `'__proto__'`, a standard object hash map might accidentally overwrite or invoke prototype methods. An `Object.create(null)` object has no prototype baggage.",
  code: `const normalObj = {};
console.log("toString" in normalObj); // true (inherited from Object.prototype!)

const secureMap = Object.create(null);
console.log("toString" in secureMap); // false!
console.log(Object.getPrototypeOf(secureMap)); // null

secureMap["username"] = "admin";
console.log(secureMap["username"]); // "admin"

// normalObj.hasOwnProperty("foo") works, but secureMap.hasOwnProperty throws!
// Must use Object.hasOwn(secureMap, "username") in modern JS:
console.log(Object.hasOwn(secureMap, "username")); // true`,
  recallHint: "Object.create(null) = bare object with no prototype. Immune to inherited key collisions.",
  interviewTip: "Highlight that calling `secureMap.hasOwnProperty('key')` will throw a TypeError because the method doesn't exist. Use `Object.hasOwn(secureMap, key)` instead.",
  tags: ["object-create-null", "security", "dictionary", "hash-map"]
}));

cards.push(createCard({
  idNum: 42,
  category: "Objects & Prototypes",
  concept: "ES6 Class Syntax as Prototype Sugar",
  priority: "must-know",
  difficulty: "beginner",
  question: "Why is the ES6 'class' syntax considered syntactic sugar over prototypes?",
  answer: "Under the hood, an ES6 `class` compiles down to a constructor function, and methods declared inside the class body are placed directly onto the constructor's `prototype` object. It introduces no new object-oriented inheritance model to the engine.",
  explanation: "Although it looks like classical Java/C++ classes, `typeof MyClass === 'function'`. Methods defined in a class are non-enumerable properties on `MyClass.prototype`. Classes do introduce specific safeguards: they cannot be invoked without 'new' (throws TypeError), class bodies run in strict mode by default, and class declarations are not hoisted.",
  code: `class Rectangle {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }
  area() {
    return this.width * this.height;
  }
}

// Verification that it is pure prototype mechanics:
console.log(typeof Rectangle); // "function"
console.log(Rectangle.prototype.area); // [Function: area]

const rect = new Rectangle(10, 20);
console.log(Object.getPrototypeOf(rect) === Rectangle.prototype); // true
console.log(rect.area()); // 200`,
  recallHint: "class syntax is sugar: creates constructor function and places methods on Class.prototype.",
  interviewTip: "Mention the two differences between a class and a function constructor: classes cannot be called without 'new' and class methods are non-enumerable by default.",
  tags: ["classes", "syntactic-sugar", "prototypes", "es6"]
}));

cards.push(createCard({
  idNum: 43,
  category: "Objects & Prototypes",
  concept: "The 'super' Keyword & [[HomeObject]]",
  priority: "advanced",
  difficulty: "advanced",
  question: "How does the 'super' keyword resolve methods, and what role does [[HomeObject]] play?",
  answer: "In class and object method definitions, 'super.method()' resolves via an internal specification slot called [[HomeObject]] (the object where the method was defined). It looks up `[[HomeObject]].[[Prototype]]` to find the parent method, ensuring that 'super' statically binds to the correct prototype regardless of dynamic 'this' re-binding.",
  explanation: "Before ES6, calling a super-method required `Parent.prototype.method.call(this)`. ES6 introduced `[[HomeObject]]` to allow methods defined via concise syntax (`method() {}`) to statically know their enclosing object. In derived class constructors, `super(...args)` must be called before accessing `this`, because the parent constructor is responsible for initializing `this`.",
  code: `class Base {
  greet() {
    return "Hello from Base";
  }
}

class Derived extends Base {
  greet() {
    // super.greet() uses [[HomeObject]] (Derived.prototype) to look up Base.prototype.greet
    return \`\${super.greet()} and Derived!\`;
  }
}

const instance = new Derived();
console.log(instance.greet()); // "Hello from Base and Derived!"`,
  recallHint: "super uses internal [[HomeObject]].[[Prototype]] to resolve parent methods statically.",
  interviewTip: "Explain why accessing `this` before `super()` in a subclass constructor throws a ReferenceError: the engine requires the base class constructor to initialize the instance memory first.",
  tags: ["super", "home-object", "inheritance", "classes"]
}));

cards.push(createCard({
  idNum: 44,
  category: "Objects & Prototypes",
  concept: "instanceof Operator & Symbol.hasInstance",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does the 'instanceof' operator work, and how can its behavior be customized via Symbol.hasInstance?",
  answer: "`a instanceof B` traverses the prototype chain of `a`, checking if `B.prototype` appears anywhere in `a`'s [[Prototype]] chain. It returns true if found, false if reaching null. Classes can customize this behavior by defining a static method with the well-known symbol `[Symbol.hasInstance](instance)`.",
  explanation: "The default `instanceof` check is: `Object.getPrototypeOf(a) === B.prototype` (iterating up the chain). Because it relies on prototype identity, `instanceof` fails across different browser execution contexts (e.g. `arr instanceof Array` returns false if `arr` was created in an `<iframe>`). Custom `Symbol.hasInstance` hooks allow structural or domain-specific type checking.",
  code: `class EvenNumber {
  // Custom instanceof check via Symbol.hasInstance
  static [Symbol.hasInstance](num) {
    return typeof num === "number" && num % 2 === 0;
  }
}

console.log(4 instanceof EvenNumber);  // true!
console.log(7 instanceof EvenNumber);  // false
console.log("8" instanceof EvenNumber); // false

// Standard prototype chain check:
function Animal() {}
function Dog() {}
Dog.prototype = Object.create(Animal.prototype);

const d = new Dog();
console.log(d instanceof Dog);    // true
console.log(d instanceof Animal); // true (Animal.prototype is in chain)`,
  recallHint: "instanceof checks if Constructor.prototype exists in object's prototype chain. Overridable via Symbol.hasInstance.",
  interviewTip: "Always mention the iframe problem: `arr instanceof Array` returns `false` across iframes because each iframe has its own distinct `Array.prototype`. Use `Array.isArray(arr)` instead.",
  tags: ["instanceof", "symbol-hasinstance", "prototype-chain"]
}));

cards.push(createCard({
  idNum: 45,
  category: "Objects & Prototypes",
  concept: "Object.prototype.hasOwnProperty vs Object.hasOwn",
  priority: "must-know",
  difficulty: "beginner",
  question: "Why was Object.hasOwn() introduced in ES2022 to replace Object.prototype.hasOwnProperty()?",
  answer: "`Object.hasOwn(obj, prop)` is a static method that checks if a property exists directly on the object without traversing the prototype chain. It was introduced because `obj.hasOwnProperty()` fails if the object was created with `Object.create(null)` (no prototype) or if the property name 'hasOwnProperty' was shadowed/overridden.",
  explanation: "Before ES2022, robust code had to use the verbose boilerplate: `Object.prototype.hasOwnProperty.call(obj, prop)`. `Object.hasOwn(obj, prop)` standardizes this directly, working safely on all objects including `Object.create(null)` dictionaries.",
  code: `// Problem 1: Object.create(null) has no prototype methods
const nullProtoObj = Object.create(null);
nullProtoObj.id = 123;
// nullProtoObj.hasOwnProperty("id"); // TypeError: nullProtoObj.hasOwnProperty is not a function

// Problem 2: Shadowed property
const shadowed = {
  hasOwnProperty: false,
  id: 456
};
// shadowed.hasOwnProperty("id"); // TypeError: shadowed.hasOwnProperty is not a function

// ES2022 Solution: Object.hasOwn (safe and clean!)
console.log(Object.hasOwn(nullProtoObj, "id")); // true
console.log(Object.hasOwn(shadowed, "id"));      // true
console.log(Object.hasOwn(shadowed, "fake"));    // false`,
  recallHint: "Object.hasOwn(obj, prop) is the safe ES2022 standard, immune to null-prototype and shadowed properties.",
  interviewTip: "Citing `Object.hasOwn` immediately demonstrates that you are current with modern ECMAScript standards (ES2022+).",
  tags: ["object-hasown", "hasownproperty", "es2022", "best-practices"]
}));

cards.push(createCard({
  idNum: 46,
  category: "Objects & Prototypes",
  concept: "Property Descriptors: Attributes & Object.defineProperty",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What are the four attributes of a JavaScript property descriptor, and what do they control?",
  answer: "1) `value`: the actual data stored. 2) `writable`: if true, the value can be changed via assignment. 3) `enumerable`: if true, the property shows up in `for...in` loops and `Object.keys()`. 4) `configurable`: if true, descriptor attributes can be altered and the property can be deleted.",
  explanation: "When creating properties normally (`obj.prop = 1`), `writable`, `enumerable`, and `configurable` default to `true`. When using `Object.defineProperty(obj, prop, descriptor)`, all boolean attributes default to `false` if omitted! If `configurable: false`, the property can never be deleted, and attempting to re-define it throws a TypeError.",
  code: `const user = {};

Object.defineProperty(user, "ssn", {
  value: "123-45-6789",
  writable: false,      // Cannot be reassigned
  enumerable: false,    // Hidden from loops and Object.keys()
  configurable: false   // Cannot be deleted or reconfigured
});

console.log(user.ssn); // "123-45-6789"
console.log(Object.keys(user)); // [] (ssn is hidden)

// user.ssn = "999"; // TypeError in strict mode
// delete user.ssn;  // TypeError in strict mode

console.log(Object.getOwnPropertyDescriptor(user, "ssn"));`,
  recallHint: "Descriptors: value, writable (modify?), enumerable (loop?), configurable (delete/alter?).",
  interviewTip: "Watch out for the defaults trap: normal assignment defaults attributes to true, but `Object.defineProperty` defaults missing flags to false.",
  tags: ["property-descriptors", "object-defineproperty", "immutability"]
}));

cards.push(createCard({
  idNum: 47,
  category: "Objects & Prototypes",
  concept: "Object Immutability: preventExtensions vs seal vs freeze",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What are the differences between Object.preventExtensions(), Object.seal(), and Object.freeze()?",
  answer: "1) `Object.preventExtensions(obj)`: Prevents adding new properties (existing properties can still be modified and deleted). 2) `Object.seal(obj)`: Prevents adding or deleting properties (`configurable: false`), but existing writable properties can still be modified. 3) `Object.freeze(obj)`: Completely locks down the object; no adding, deleting, or modifying existing properties (`writable: false, configurable: false`).",
  explanation: "All three methods operate SHALLOWLY. If an object property references a nested object or array, that nested object remains completely mutable. To make an entire object tree immutable, a recursive `deepFreeze` function must be used.",
  code: `const obj = { a: 1, nested: { b: 2 } };

Object.freeze(obj);

// 1. Shallow properties cannot be modified
// obj.a = 99; // TypeError in strict mode

// 2. Nested objects are NOT frozen!
obj.nested.b = 999;
console.log(obj.nested.b); // 999 (mutated!)

// Comparison helper:
// preventExtensions: Can't add. (Can edit, Can delete)
// seal:              Can't add, Can't delete. (Can edit)
// freeze:            Can't add, Can't delete, Can't edit.`,
  recallHint: "preventExtensions = no adds. seal = no adds/deletes. freeze = no adds/deletes/edits. All shallow!",
  interviewTip: "Always clarify that `Object.freeze` is shallow. Interviewers will immediately follow up asking you how to implement `deepFreeze`.",
  tags: ["immutability", "object-freeze", "object-seal", "prevent-extensions"]
}));

cards.push(createCard({
  idNum: 48,
  category: "Objects & Prototypes",
  concept: "Implementing deepFreeze()",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "How do you implement a recursive deepFreeze() function to make nested objects completely immutable?",
  answer: "By freezing the root object with `Object.freeze()`, retrieving all own property names/symbols via `Reflect.ownKeys()`, and recursively calling `deepFreeze` on any property whose value is an object or function and not already frozen.",
  explanation: "A robust `deepFreeze` must handle circular references (using a WeakSet to avoid infinite recursion) and must freeze Symbols using `Reflect.ownKeys()`, which captures both string and symbol keys. Functions should also be frozen as they are objects.",
  code: `function deepFreeze(obj, seen = new WeakSet()) {
  // Primitives and already seen objects
  if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
    return obj;
  }

  if (seen.has(obj)) {
    return obj; // Prevent infinite circular recursion
  }

  seen.add(obj);

  // Freeze own properties first
  Object.freeze(obj);

  // Recursively freeze nested objects
  for (const key of Reflect.ownKeys(obj)) {
    const val = obj[key];
    if (val !== null && (typeof val === "object" || typeof val === "function")) {
      deepFreeze(val, seen);
    }
  }

  return obj;
}

const config = deepFreeze({
  api: { url: "https://api.com", timeout: 5000 }
});

// config.api.timeout = 10000; // TypeError in strict mode!`,
  recallHint: "deepFreeze: Object.freeze(obj) -> loop Reflect.ownKeys -> recursively deepFreeze children with WeakSet seen guard.",
  interviewTip: "Using `Reflect.ownKeys()` instead of `Object.keys()` is crucial because it ensures non-enumerable properties and Symbol keys are also frozen.",
  tags: ["deep-freeze", "recursion", "immutability", "weakset"]
}));

cards.push(createCard({
  idNum: 49,
  category: "Objects & Prototypes",
  concept: "Prototype Pollution Vulnerabilities & Defenses",
  priority: "must-know",
  difficulty: "advanced",
  question: "What is Prototype Pollution in JavaScript, and how can applications be protected against it?",
  answer: "Prototype Pollution is a security vulnerability where an attacker exploits insecure recursive object merges or path-assignment logic to inject properties into `Object.prototype` (via `__proto__`, `constructor.prototype`). Because all objects inherit from `Object.prototype`, the injected malicious properties pollute every object across the entire application.",
  explanation: "If an attacker sends a JSON payload `{ \"__proto__\": { \"isAdmin\": true } }` into an insecure `lodash.merge` or deep clone utility, evaluating `({}).isAdmin` will suddenly return `true`, causing catastrophic authorization bypasses or remote code execution. Defenses: 1) Use `Object.create(null)` or `Map` for user dictionaries. 2) Freeze `Object.prototype` via `Object.freeze(Object.prototype)`. 3) Explicitly block `__proto__` and `constructor` keys in deep merge functions.",
  code: `// Vulnerable recursive merge function:
function unsafeMerge(target, source) {
  for (const key in source) {
    if (typeof source[key] === "object" && source[key] !== null) {
      if (!target[key]) target[key] = {};
      unsafeMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// Attack payload:
const payload = JSON.parse('{"__proto__": {"polluted": "CRITICAL"}}');
// unsafeMerge({}, payload);
// console.log(({}).polluted); // "CRITICAL" (All objects polluted!)

// Hardened Defense: Validate against dangerous prototype keys
function safeMerge(target, source) {
  for (const key of Object.keys(source)) {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      continue; // Block prototype pollution vectors!
    }
    if (typeof source[key] === "object" && source[key] !== null) {
      if (!target[key]) target[key] = {};
      safeMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}`,
  recallHint: "Prototype pollution: injecting onto Object.prototype via `__proto__`. Defense: block keys or Object.create(null).",
  interviewTip: "This is one of the highest-rated security topics in Node.js and fullstack JavaScript interviews. Always mention blocking `__proto__`, `constructor`, and `prototype` keys.",
  tags: ["security", "prototype-pollution", "hardening", "cve"]
}));

cards.push(createCard({
  idNum: 50,
  category: "Objects & Prototypes",
  concept: "Performance Impact of Modifying [[Prototype]]",
  priority: "advanced",
  difficulty: "advanced",
  question: "Why does invoking Object.setPrototypeOf() severely degrade V8 engine execution performance?",
  answer: "Calling `Object.setPrototypeOf(obj, newProto)` or mutating `obj.__proto__` alters the object's hidden class (Shape/Map) and invalidates all Inline Caches (IC) optimized by the V8 TurboFan JIT compiler for any code that interacts with that object or its descendants.",
  explanation: "V8 optimizes property access by predicting object Shapes. When an object's prototype is dynamically swapped at runtime, V8 is forced to de-optimize hot machine code and drop back to slow generic dictionary lookups for all property accesses along that chain. If prototype delegation is needed, objects should always be instantiated with their final prototype using `Object.create(proto)`.",
  code: `const protoA = { x: 1 };
const protoB = { x: 2 };

const obj = Object.create(protoA);

// Severe V8 de-optimization:
// Object.setPrototypeOf(obj, protoB); // De-optimizes hidden class & inline cache

// High-performance pattern: always set prototype at instantiation time
const fastObj = Object.create(protoB);`,
  recallHint: "Mutating [[Prototype]] post-creation invalidates V8 hidden classes and drops JIT optimizations.",
  interviewTip: "Mention the V8 team's warning: `Object.setPrototypeOf` is one of the slowest operations in JavaScript. Avoid dynamic prototype reassignment in performance-critical code.",
  tags: ["v8", "performance", "inline-cache", "setprototypeof"]
}));

module.exports = cards;
