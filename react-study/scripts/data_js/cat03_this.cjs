const { createCard } = require("../js_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 25,
  category: "this & Function Invocations",
  concept: "The Four Rules of 'this' Binding",
  priority: "must-know",
  difficulty: "beginner",
  question: "What are the four rules that determine the value of 'this' in JavaScript?",
  answer: "The four rules in precedence order: 1) 'new' Binding (points to the newly instantiated object). 2) Explicit Binding (`call`, `apply`, `bind` specify 'this'). 3) Implicit Binding (function called as an object method: `obj.fn()`, 'this' is `obj`). 4) Default Binding (standalone function call: global object in non-strict mode, `undefined` in strict mode).",
  explanation: "In JavaScript, 'this' is NOT author-time or lexical (except in arrow functions). It is determined dynamically by the Call-Site (how the function was invoked). Precedence from highest to lowest: `new` > Explicit (`bind`/`call`/`apply`) > Implicit (`obj.fn()`) > Default (`fn()`).",
  code: `function identify() {
  return this.name;
}

const userA = { name: "Alice", identify };
const userB = { name: "Bob" };

// 1. Implicit
console.log(userA.identify()); // "Alice"

// 2. Explicit
console.log(identify.call(userB)); // "Bob"

// 3. new Binding
function Person(name) {
  this.name = name;
}
const person = new Person("Charlie");
console.log(person.name); // "Charlie"

// 4. Default
// identify(); // In strict mode: TypeError (this is undefined)`,
  recallHint: "Order: new > call/apply/bind > obj.method() > undefined/window.",
  interviewTip: "Always memorize the precedence: new > explicit > implicit > default. If an arrow function is involved, it overrides all four because it resolves lexically.",
  tags: ["this", "binding-rules", "call-site"]
}));

cards.push(createCard({
  idNum: 26,
  category: "this & Function Invocations",
  concept: "Explicit Binding: call vs apply vs bind",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What are the differences between call(), apply(), and bind()?",
  answer: "`call()` invokes the function immediately with an explicit 'this' and comma-separated arguments. `apply()` invokes the function immediately with an explicit 'this' and an array (or array-like) of arguments. `bind()` does NOT invoke the function immediately; it returns a new bound function with 'this' and initial arguments permanently locked.",
  explanation: "`call` and `apply` execute immediately, differing only in how parameters are passed: `fn.call(ctx, 1, 2)` vs `fn.apply(ctx, [1, 2])`. `bind` creates a hard-bound wrapper function using the internal `[[BoundTargetFunction]]` and `[[BoundThis]]` slots, rendering it immune to subsequent `call` or `apply` re-bindings.",
  code: `function introduce(greeting, punctuation) {
  return \`\${greeting}, I am \${this.name}\${punctuation}\`;
}

const person = { name: "Sarah" };

// call: comma-separated args
console.log(introduce.call(person, "Hello", "!")); // "Hello, I am Sarah!"

// apply: array of args
console.log(introduce.apply(person, ["Hey", "?"])); // "Hey, I am Sarah?"

// bind: returns new function
const boundIntro = introduce.bind(person, "Greetings");
console.log(boundIntro(".")); // "Greetings, I am Sarah."`,
  recallHint: "call = comma args. apply = array args. bind = returns bound function.",
  interviewTip: "Remember the mnemonic: C for Call (Comma), A for Apply (Array), B for Bind (Bound function).",
  tags: ["call", "apply", "bind", "explicit-binding"]
}));

cards.push(createCard({
  idNum: 27,
  category: "this & Function Invocations",
  concept: "Polyfill for Function.prototype.bind",
  priority: "advanced",
  difficulty: "advanced",
  question: "How do you implement a polyfill for Function.prototype.bind that supports the 'new' operator?",
  answer: "A complete bind polyfill must return a function that applies the bound context and prepends bound arguments. Crucially, it must detect if it is being invoked as a constructor via 'new' (using `this instanceof boundFn`), in which case 'this' must point to the newly created instance rather than the bound context.",
  explanation: "The ECMAScript specification mandates that the `new` operator overrides a previous `bind()`. If `const Bound = Fn.bind(obj)`, calling `new Bound()` creates a new object whose prototype is `Fn.prototype`, ignoring `obj`. A production polyfill uses a clean prototype bridge (`Object.create`) to ensure instance integrity.",
  code: `Function.prototype.myBind = function(context, ...boundArgs) {
  if (typeof this !== "function") {
    throw new TypeError("Function.prototype.myBind - what is trying to be bound is not callable");
  }

  const originalFn = this;

  function boundFunction(...callArgs) {
    // Check if called via 'new'
    const isNew = this instanceof boundFunction;
    return originalFn.apply(
      isNew ? this : context,
      boundArgs.concat(callArgs)
    );
  }

  // Preserve prototype chain for 'new' instances
  if (originalFn.prototype) {
    boundFunction.prototype = Object.create(originalFn.prototype);
  }

  return boundFunction;
};`,
  recallHint: "Polyfill bind: return wrapper, check `this instanceof boundFunction` for 'new', preserve prototype.",
  interviewTip: "Senior interviewers look specifically for whether your polyfill handles the `new` operator. If you don't check `this instanceof boundFunction`, the polyfill is incomplete.",
  tags: ["polyfill", "bind", "prototypes", "new-operator"]
}));

cards.push(createCard({
  idNum: 28,
  category: "this & Function Invocations",
  concept: "Arrow Functions & Lexical this",
  priority: "must-know",
  difficulty: "beginner",
  question: "How do arrow functions handle 'this', 'arguments', and the 'new' keyword?",
  answer: "Arrow functions do NOT have their own 'this', 'arguments', 'super', or 'new.target' bindings. They resolve 'this' lexically from their enclosing parent scope at definition time. Consequently, they cannot be used as constructors with 'new' and have no 'prototype' property.",
  explanation: "In the engine, arrow functions lack the internal `[[Construct]]` method, so invoking `new (() => {})` throws a `TypeError: ... is not a constructor`. Calling `.call(ctx)` or `.apply(ctx)` on an arrow function has zero effect on 'this'—the first argument is simply ignored. They do not have an `arguments` object; rest parameters (`...args`) should be used instead.",
  code: `const timer = {
  seconds: 0,
  start() {
    // Regular function callback loses 'this'
    // setInterval(function() { this.seconds++; }, 1000); // Bug! this is window/undefined

    // Arrow function captures 'this' from 'start()' execution context
    setInterval(() => {
      this.seconds++;
      console.log(this.seconds);
    }, 1000);
  }
};

const arrow = () => {};
console.log(arrow.prototype); // undefined
// new arrow(); // TypeError: arrow is not a constructor`,
  recallHint: "Arrow functions have no 'this' or prototype. They capture 'this' lexically from enclosing scope.",
  interviewTip: "Never use arrow functions for object methods that need access to the object (`const obj = { val: 1, get: () => this.val }`), because 'this' will resolve to global/module scope.",
  tags: ["arrow-functions", "lexical-this", "constructor"]
}));

cards.push(createCard({
  idNum: 29,
  category: "this & Function Invocations",
  concept: "Method Borrowing",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What is method borrowing in JavaScript, and what are common examples?",
  answer: "Method borrowing is the practice of invoking a method belonging to one object on a completely different object using `.call()` or `.apply()`. Common examples include using `Array.prototype` methods on array-like objects (`arguments` or NodeLists) or `Object.prototype.hasOwnProperty`.",
  explanation: "Array-like objects have numeric indices and a `.length` property, but lack array prototype methods (`slice`, `map`, `filter`). By borrowing `Array.prototype.slice.call(arguments)`, you can treat non-arrays like arrays. In modern JS, `Array.from()` or the spread operator `[...nodeList]` is preferred, but method borrowing remains fundamental for safe utility checks like `Object.prototype.toString.call(val)`.",
  code: `// 1. Borrowing Array methods on array-like objects
function sumAll() {
  // 'arguments' is array-like, lacks .reduce()
  return Array.prototype.reduce.call(arguments, (acc, n) => acc + n, 0);
}
console.log(sumAll(10, 20, 30)); // 60

// 2. Safe type identification
console.log(Object.prototype.toString.call([]));          // "[object Array]"
console.log(Object.prototype.toString.call(new Date()));  // "[object Date]"

// 3. Safe hasOwnProperty check (immune to object overriding property)
const malicious = Object.create(null); // No prototype!
malicious.hasOwnProperty = () => true; // Shadowed
console.log(Object.prototype.hasOwnProperty.call(malicious, "foo")); // false`,
  recallHint: "Method borrowing: `TargetPrototype.method.call(recipient, ...args)`.",
  interviewTip: "Mention `Object.hasOwn(obj, prop)` introduced in ES2022 as the modern replacement for borrowing `Object.prototype.hasOwnProperty.call(obj, prop)`.",
  tags: ["method-borrowing", "call", "apply", "array-like"]
}));

cards.push(createCard({
  idNum: 30,
  category: "this & Function Invocations",
  concept: "The 'new' Operator Algorithm",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What exact 4 steps occur when the 'new' operator is invoked in JavaScript?",
  answer: "When 'new Constructor(...args)' is executed: 1) A brand new empty object is created in memory. 2) The new object's [[Prototype]] is linked to Constructor.prototype. 3) The Constructor function is called with 'this' bound to the new object. 4) If the constructor returns its own non-primitive object, that object is returned; otherwise, the newly created object is returned.",
  explanation: "Step 4 is a critical interview edge case: if a constructor explicitly returns a primitive (`return 42` or `return 'hello'`), JavaScript ignores the return value and returns the newly created `this` instance. If it explicitly returns an object (`return { a: 1 }`), that object replaces `this` as the result of the `new` expression.",
  code: `// Custom implementation of the 'new' operator
function customNew(Constructor, ...args) {
  // 1 & 2: Create object linked to constructor prototype
  const instance = Object.create(Constructor.prototype);

  // 3: Execute constructor with 'this' set to instance
  const result = Constructor.apply(instance, args);

  // 4: Return result if it is an object/function, else return instance
  const isObject = result !== null && (typeof result === "object" || typeof result === "function");
  return isObject ? result : instance;
}

function Car(make, model) {
  this.make = make;
  this.model = model;
}

const myCar = customNew(Car, "Tesla", "Model 3");
console.log(myCar instanceof Car); // true
console.log(myCar.make); // "Tesla"`,
  recallHint: "new: 1) create obj, 2) link prototype, 3) bind this and call, 4) return obj or this.",
  interviewTip: "Writing `customNew` on a whiteboard is one of the classic senior frontend interview questions. Be sure to check `typeof result === 'object' && result !== null` for step 4.",
  tags: ["new-operator", "constructors", "prototypes", "internals"]
}));

cards.push(createCard({
  idNum: 31,
  category: "this & Function Invocations",
  concept: "Losing 'this' Binding (Callback Loss)",
  priority: "must-know",
  difficulty: "beginner",
  question: "Why does a method lose its 'this' binding when passed as a callback, and how is it fixed?",
  answer: "When an object method is passed as a callback (e.g. `setTimeout(obj.method, 100)`), you are passing a bare function reference without its object context. When the caller invokes it, it invokes a standalone function, triggering default binding (`undefined` or `window`). It is fixed via `.bind(obj)`, wrapping in an arrow function, or class field arrow functions.",
  explanation: "Extracting a method (`const fn = obj.method`) strips the call-site reference. The call-site becomes `fn()`, which invokes the default binding rule. In React, this is why event handlers previously required `.bind(this)` in constructors before class field arrow functions or functional components became standard.",
  code: `const counter = {
  count: 0,
  increment() {
    this.count++;
    console.log(this.count);
  }
};

// 1. Loss of context
const rawFn = counter.increment;
// rawFn(); // TypeError: Cannot read properties of undefined (reading 'count')

// Solution A: .bind()
setTimeout(counter.increment.bind(counter), 100);

// Solution B: Arrow function wrapper (keeps call-site intact)
setTimeout(() => counter.increment(), 100);`,
  recallHint: "Passing `obj.method` passes the function reference, NOT the invocation. Fix with bind or arrow wrapper.",
  interviewTip: "Demonstrate that `setTimeout(obj.method)` is equivalent to `const f = obj.method; setTimeout(f)`. The call site is detached from `obj`.",
  tags: ["this", "callbacks", "callback-loss", "event-handlers"]
}));

cards.push(createCard({
  idNum: 32,
  category: "this & Function Invocations",
  concept: "'this' in DOM Event Listeners",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What does 'this' point to inside a standard DOM event listener vs an arrow function event listener?",
  answer: "Inside a standard function listener (`element.addEventListener('click', function(e) {})`), 'this' is set to `e.currentTarget` (the element to which the event handler was attached). Inside an arrow function listener, 'this' is NOT the element; it resolves lexically to the surrounding scope.",
  explanation: "The DOM event specification explicitly binds 'this' to the event handler's target element for standard functions. However, arrow functions ignore this dynamic binding and retain their outer lexical 'this'. In modern DOM programming, accessing `e.currentTarget` or `e.target` directly is preferred over relying on 'this', making code immune to function syntax changes.",
  code: `const button = document.createElement("button");
button.textContent = "Click Me";

// Standard function: 'this' === e.currentTarget
button.addEventListener("click", function(e) {
  console.log(this === button); // true
  console.log(this === e.currentTarget); // true
});

// Arrow function: 'this' is outer scope (window/module)
button.addEventListener("click", (e) => {
  console.log(this === button); // false (points to window/globalThis)
  console.log(e.currentTarget === button); // true (always reliable!)
});`,
  recallHint: "Standard listener: this = e.currentTarget. Arrow listener: this = lexical outer scope.",
  interviewTip: "Emphasize using `e.currentTarget` (the listener element) instead of `this` in event handlers so arrow functions can be used without bugs.",
  tags: ["dom", "event-listeners", "this", "current-target"]
}));

cards.push(createCard({
  idNum: 33,
  category: "this & Function Invocations",
  concept: "Class Field Initializers & Auto-Binding",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "How do arrow class fields achieve auto-binding, and what is their memory trade-off compared to prototype methods?",
  answer: "Class field arrow functions (`method = () => {}`) run during instance construction and bind 'this' to the specific newly created instance. The trade-off is memory: arrow fields are instantiated on every object instance, whereas standard class methods live once on the class prototype.",
  explanation: "Standard class methods (`method() {}`) reside on `Class.prototype`. All 10,000 instances share that single function reference. Arrow property initializers (`method = () => {}`) are assigned in the constructor body to `this.method`. If you instantiate 10,000 objects, 10,000 separate closure instances are allocated on the heap.",
  code: `class ButtonPrototype {
  handleClick() {
    console.log(this);
  }
}
// ButtonPrototype.prototype has handleClick (1 function in memory)

class ButtonArrowField {
  handleClick = () => {
    console.log(this); // Auto-bound to instance, safe for callbacks
  };
}
// Each 'new ButtonArrowField()' gets a NEW function instance attached to 'this'`,
  recallHint: "Arrow class fields auto-bind 'this', but duplicate function instances in memory per object.",
  interviewTip: "In React class components, developers used arrow fields to avoid constructor binding. Acknowledge the trade-off between convenience and memory footprint.",
  tags: ["classes", "class-fields", "auto-bind", "memory"]
}));

cards.push(createCard({
  idNum: 34,
  category: "this & Function Invocations",
  concept: "Hard Binding vs Soft Binding",
  priority: "advanced",
  difficulty: "advanced",
  question: "What is the difference between Hard Binding (`Function.prototype.bind`) and Soft Binding?",
  answer: "Hard Binding (`bind`) permanently fixes 'this', making it impossible to override via subsequent `call()`, `apply()`, or implicit method calls. Soft Binding provides a default fallback context for 'this' if default binding would occur, while still permitting manual override via implicit method calls (`obj.fn()`) or `call()`/`apply()`.",
  explanation: "Once a function is hard-bound with `.bind(obj)`, invoking `boundFn.call(otherObj)` still executes with `obj`. Soft binding (popularized by Kyle Simpson's 'You Don't Know JS') checks if `this` is null, undefined, or the global object: if so, it uses the fallback; otherwise, it preserves the dynamically passed `this`.",
  code: `// Soft Binding utility
Function.prototype.softBind = function(obj, ...boundArgs) {
  const fn = this;
  return function(...callArgs) {
    const isGlobal = !this || this === globalThis;
    return fn.apply(
      isGlobal ? obj : this,
      boundArgs.concat(callArgs)
    );
  };
};

function identify() {
  return this.name;
}

const obj1 = { name: "obj1" };
const obj2 = { name: "obj2" };

const softFn = identify.softBind(obj1);
console.log(softFn()); // "obj1" (falls back to soft bound obj1)

// Soft binding allows manual override!
obj2.fn = softFn;
console.log(obj2.fn()); // "obj2" (overridden by implicit binding!)`,
  recallHint: "Hard bind: permanently locked. Soft bind: fallback if default, allows override.",
  interviewTip: "Discussing soft binding showcases deep knowledge of the ECMAScript 'this' resolution algorithm beyond standard textbook definitions.",
  tags: ["soft-bind", "hard-bind", "advanced-this"]
}));

cards.push(createCard({
  idNum: 35,
  category: "this & Function Invocations",
  concept: "'this' in Object Getters and Setters",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "How is 'this' bound inside Object accessor properties (getters and setters)?",
  answer: "Inside an accessor property (getter/setter), 'this' is bound to the object on which the property access occurred (the target receiver), even if the getter was defined on an inherited prototype.",
  explanation: "If object `child` inherits from prototype `parent`, and `parent` defines a getter `get fullName() { return this.first + ' ' + this.last; }`, evaluating `child.fullName` binds 'this' to `child`, NOT `parent`. The receiver of the property access becomes 'this'.",
  code: `const personProto = {
  get fullName() {
    return \`\${this.firstName} \${this.lastName}\`;
  },
  set fullName(name) {
    [this.firstName, this.lastName] = name.split(" ");
  }
};

const user = Object.create(personProto);
user.firstName = "Alan";
user.lastName = "Turing";

console.log(user.fullName); // "Alan Turing" (this is user)
user.fullName = "Ada Lovelace";
console.log(user.firstName); // "Ada" (mutates user, not personProto)`,
  recallHint: "Getters/setters bind 'this' to the receiver object that initiated the property lookup.",
  interviewTip: "Link this to `Reflect.get(target, prop, receiver)`. The 3rd argument 'receiver' is what becomes 'this' inside the getter.",
  tags: ["getters", "setters", "accessors", "prototypes"]
}));

cards.push(createCard({
  idNum: 36,
  category: "this & Function Invocations",
  concept: "'this' Precedence Edge Case: new with bind",
  priority: "advanced",
  difficulty: "advanced",
  question: "What happens when you use the 'new' operator on a function that was previously hard-bound with bind()?",
  answer: "The 'new' operator overrides hard binding: 'this' is bound to the newly created instance, completely ignoring the object that was previously specified in bind(). However, any arguments that were pre-bound via bind() are still preserved and prepended.",
  explanation: "According to the ECMAScript specification for `[[Construct]]` on Bound Function Exotic Objects, the bound 'this' is discarded in favor of the newly allocated instance. This design enables partial application (currying) of constructor arguments while preserving normal instantiation.",
  code: `function Widget(type, color) {
  this.type = type;
  this.color = color;
}

const dummyObj = { dummy: true };

// Hard-bind to dummyObj with pre-filled 'type' argument
const BoundWidget = Widget.bind(dummyObj, "Button");

// Instantiate with 'new'
const myWidget = new BoundWidget("Red");

console.log(myWidget.type);  // "Button" (bound argument preserved!)
console.log(myWidget.color); // "Red"
console.log(myWidget instanceof Widget); // true
console.log(dummyObj.type);  // undefined ('this' was NOT dummyObj!)`,
  recallHint: "'new' beats bind() for 'this' binding, but keeps pre-bound arguments.",
  interviewTip: "This is the ultimate 'this' precedence test. It proves that 'new' is the highest priority binding rule in JavaScript.",
  tags: ["this-precedence", "new-operator", "bind", "edge-cases"]
}));

module.exports = cards;
