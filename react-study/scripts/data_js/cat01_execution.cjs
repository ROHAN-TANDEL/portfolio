const { createCard } = require("../js_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 1,
  category: "Execution Context & Scope",
  concept: "Execution Context & Call Stack",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is an Execution Context in JavaScript, and what are its constituent components?",
  answer: "An Execution Context is an abstract environment created by the JavaScript engine to evaluate and execute code. It consists of three primary components: a Variable Environment (for var declarations), a Lexical Environment (for let/const and scope bindings), and a 'this' binding. Execution contexts are managed via a LIFO Call Stack.",
  explanation: "Whenever JavaScript code runs, it executes inside an Execution Context. The engine creates a Global Execution Context (GEC) by default upon startup. When a function is invoked, a new Function Execution Context (FEC) is pushed onto the Call Stack. Each execution context undergoes two phases: Creation Phase (allocating memory for variables and functions) and Execution Phase (line-by-line evaluation). When function execution finishes, its context is popped off the Call Stack.",
  code: `function multiply(a, b) {
  // Function Execution Context pushed onto Call Stack
  const result = a * b;
  return result;
}

// Global Execution Context active
const total = multiply(4, 5); // pushes multiply FEC, executes, then pops off`,
  recallHint: "EC = Environment Record + Outer Scope Reference + 'this' binding. Managed via LIFO Call Stack.",
  interviewTip: "Distinguish between the Creation Phase (where hoisting and scope chaining setup happen) and Execution Phase (where code actually assigns values and runs). Mention that V8 manages this on the native C++ call stack.",
  tags: ["execution-context", "call-stack", "internals"]
}));

cards.push(createCard({
  idNum: 2,
  category: "Execution Context & Scope",
  concept: "Creation Phase vs Execution Phase",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What happens during the Creation Phase vs the Execution Phase of an Execution Context?",
  answer: "During the Creation Phase, the engine sets up memory space for variables and functions (hoisting), initializes the scope chain, and determines the 'this' binding. In the Execution Phase, the engine executes code line by line, assigns actual values to variables, and executes function calls.",
  explanation: "In the Creation Phase: 1) The engine scans for 'function' declarations and stores the complete function reference in memory. 2) Variables declared with 'var' are registered and initialized to 'undefined'. 3) Variables declared with 'let' and 'const' are registered in the Lexical Environment but left UNINITIALIZED (entering the Temporal Dead Zone). In the Execution Phase, expressions are evaluated, variable assignments take place, and function calls push new frames to the call stack.",
  code: `console.log(a); // undefined (var hoisted & initialized to undefined)
// console.log(b); // ReferenceError: Cannot access 'b' before initialization (TDZ)

var a = 10;
let b = 20;

sayHello(); // "Hello!" (Function declaration fully hoisted with body)

function sayHello() {
  console.log("Hello!");
}`,
  recallHint: "Creation Phase = allocate & initialize bindings (hoist). Execution Phase = assign & run.",
  interviewTip: "Interviewers love testing whether functions or var declarations hoist first. Functions are hoisted first and completely, while var is hoisted with undefined. let/const are hoisted without initialization.",
  tags: ["creation-phase", "execution-phase", "hoisting"]
}));

cards.push(createCard({
  idNum: 3,
  category: "Execution Context & Scope",
  concept: "Lexical Environment vs Variable Environment",
  priority: "advanced",
  difficulty: "advanced",
  question: "What is the difference between a Lexical Environment and a Variable Environment in ECMAScript specification?",
  answer: "Both are specification types consisting of an Environment Record and an outer reference. The Variable Environment specifically tracks bindings created by 'var' statements and function declarations in the enclosing execution context. The Lexical Environment tracks block-scoped bindings ('let', 'const', 'class') and changes dynamically when entering blocks.",
  explanation: "In the ECMAScript spec, an Execution Context has two environment slots: LexicalEnvironment and VariableEnvironment. Initially, both point to the same Environment Record. However, when entering a block statement (e.g. if, for, while), the engine creates a new LexicalEnvironment pointing to the outer one, while the VariableEnvironment remains unchanged. This allows 'var' to ignore blocks and remain function-scoped, while 'let' and 'const' remain strictly block-scoped.",
  code: `function demo() {
  var x = 1; // Stored in VariableEnvironment of demo FEC
  
  if (true) {
    var y = 2; // Still in VariableEnvironment of demo FEC
    let z = 3; // Stored in a NEW LexicalEnvironment created for this block
    console.log(x, y, z); // 1, 2, 3
  }
  
  console.log(y); // 2 (accessible because it ignores block scope)
  // console.log(z); // ReferenceError: z is not defined
}`,
  recallHint: "VariableEnvironment = function-scoped (var). LexicalEnvironment = block-scoped (let/const) with outer link.",
  interviewTip: "This is a great differentiator for senior candidates. Explaining that entering an if-block creates a fresh LexicalEnvironment linked to the parent explains how block scoping works under the spec.",
  tags: ["spec", "lexical-environment", "variable-environment"]
}));

cards.push(createCard({
  idNum: 4,
  category: "Execution Context & Scope",
  concept: "Hoisting Mechanics & Order",
  priority: "must-know",
  difficulty: "beginner",
  question: "How does hoisting work in JavaScript for functions, var, let, and const?",
  answer: "Hoisting is the JavaScript engine's behavior of reserving memory for declarations during the creation phase before execution. Function declarations are hoisted completely with their definitions. 'var' variables are hoisted and initialized to 'undefined'. 'let' and 'const' are hoisted into the temporal dead zone (uninitialized) until their declaration line is evaluated.",
  explanation: "Function expressions (e.g., 'var fn = function() {}') hoist the variable declaration ('var fn = undefined'), NOT the function body. Function declarations take precedence over var declarations with the same name during hoisting. Invoking a let/const variable before its declaration causes a ReferenceError due to the TDZ.",
  code: `// Function declaration vs function expression
foo(); // "Declared function executed!"
// bar(); // TypeError: bar is not a function (bar is undefined here)

function foo() {
  console.log("Declared function executed!");
}

var bar = function() {
  console.log("Function expression executed!");
};`,
  recallHint: "Functions hoist body. var hoists undefined. let/const hoist uninitialized (TDZ).",
  interviewTip: "Clarify that JavaScript does NOT physically move code to the top of the file. Hoisting is simply a mental model for the engine's creation-phase memory allocation.",
  tags: ["hoisting", "functions", "declarations"]
}));

cards.push(createCard({
  idNum: 5,
  category: "Execution Context & Scope",
  concept: "Temporal Dead Zone (TDZ)",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is the Temporal Dead Zone (TDZ) and why was it introduced in ES6?",
  answer: "The Temporal Dead Zone (TDZ) is the time span between entering a scope and the actual line where a 'let' or 'const' variable is declared. Accessing or typeof the variable within this window throws a ReferenceError. It was introduced to prevent accessing uninitialized variables, catching bugs early.",
  explanation: "Unlike 'var', which defaults to 'undefined' upon entering scope, ES6 'let' and 'const' exist in an uninitialized state in their Lexical Environment. Even 'typeof' is not safe inside the TDZ: 'typeof x' will throw a ReferenceError if 'let x' is declared later in that scope. Once execution passes the initialization statement, the TDZ ends.",
  code: `{
  // TDZ for myVar starts here
  // console.log(typeof myVar); // ReferenceError: Cannot access 'myVar' before initialization
  
  const fn = () => myVar; // Valid to define, as long as it is NOT invoked yet
  
  let myVar = 42; // TDZ for myVar ends here
  console.log(fn()); // 42 (safe to invoke now)
}`,
  recallHint: "TDZ = scope entry until variable declaration line. Access throws ReferenceError.",
  interviewTip: "Highlight that TDZ is temporal (time-based), not spatial (line-based). A function declared above a let variable can safely read that variable as long as the function is CALLED after the variable declaration executes.",
  tags: ["tdz", "let", "const", "scoping"]
}));

cards.push(createCard({
  idNum: 6,
  category: "Execution Context & Scope",
  concept: "Scope Chain & Identifier Resolution",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does the Scope Chain resolve identifiers in nested scopes?",
  answer: "When code references an identifier, the JavaScript engine looks for the variable in the current Lexical Environment's Environment Record. If not found, it traverses up the Scope Chain via the 'outer' environment reference until it reaches the Global Environment. If not found in global scope, a ReferenceError is thrown.",
  explanation: "The Scope Chain is resolved lexically (where functions are defined in source code, not where they are called). Every Environment Record contains a pointer to its enclosing outer Environment Record. This linked list of environments constitutes the Scope Chain. Scope lookup always moves outward/upward, never downward into child scopes.",
  code: `const globalVal = "GLOBAL";

function outer() {
  const outerVal = "OUTER";
  
  function inner() {
    const innerVal = "INNER";
    // Lookups: innerVal (local) -> outerVal (parent) -> globalVal (global)
    console.log(innerVal, outerVal, globalVal);
  }
  
  inner();
}

outer();`,
  recallHint: "Scope Chain = linked list of Lexical Environments via outer references. Resolves lexically at author time.",
  interviewTip: "Emphasize that the scope chain is determined at function definition time (lexical scoping), not invocation time. This is the exact mechanism that enables closures.",
  tags: ["scope-chain", "lexical-scope", "identifiers"]
}));

cards.push(createCard({
  idNum: 7,
  category: "Execution Context & Scope",
  concept: "Block Scope vs Function Scope vs Global Scope",
  priority: "must-know",
  difficulty: "beginner",
  question: "What are the differences between Global Scope, Function Scope, and Block Scope?",
  answer: "Global scope is accessible anywhere in the program. Function scope restricts variables ('var', functions) to the enclosing function body. Block scope restricts variables ('let', 'const', classes) to the nearest enclosing pair of curly braces '{ ... }' (loops, if-blocks, try-catch).",
  explanation: "Before ES6, JavaScript only had Global and Function scope. 'var' ignores curly braces like if-statements and for-loops, leaking into the enclosing function. ES6 introduced Block Scope via 'let' and 'const', creating a localized Environment Record discarded when exiting the block. The global object (window/globalThis) holds var declarations in non-module scripts.",
  code: `var globalX = "global";

function testScope() {
  var funcScoped = "function";
  
  if (true) {
    var leaked = "leaked from if";
    let blockScoped = "trapped in if";
    const alsoBlock = "also trapped";
  }
  
  console.log(leaked); // "leaked from if" (var ignores block)
  // console.log(blockScoped); // ReferenceError: blockScoped is not defined
}
testScope();`,
  recallHint: "Global = everywhere. Function = inside function (var). Block = inside { ... } (let, const).",
  interviewTip: "Note that in ES modules, top-level variables do not become properties of window/globalThis, unlike scripts with top-level var declarations.",
  tags: ["block-scope", "function-scope", "var", "let"]
}));

cards.push(createCard({
  idNum: 8,
  category: "Execution Context & Scope",
  concept: "Variable Shadowing & Illegal Shadowing",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What is variable shadowing in JavaScript, and what constitutes 'illegal shadowing'?",
  answer: "Variable shadowing occurs when an inner scope declares a variable with the same name as an outer scope, masking access to the outer variable. Illegal shadowing occurs when attempting to cross-declare an outer 'let' or 'const' variable using 'var' inside an inner block scope, resulting in a SyntaxError.",
  explanation: "Shadowing an outer 'var' with an inner 'let' or 'const' is completely valid because 'let' is confined to the block. However, shadowing an outer 'let' using 'var' within the same block or a child block throws a SyntaxError: Identifier has already been declared. This happens because 'var' hoists to the function boundary, colliding with the outer 'let'.",
  code: `// Valid shadowing
let x = 10;
if (true) {
  let x = 20; // Shadows outer x inside this block
  console.log(x); // 20
}
console.log(x); // 10

// Illegal shadowing
let y = 30;
function testIllegal() {
  // if (true) {
  //   var y = 40; // SyntaxError: Identifier 'y' has already been declared
  // }
}`,
  recallHint: "Valid: let shadows let, let shadows var. Illegal: var shadows let in the same function scope.",
  interviewTip: "Explain why illegal shadowing throws: because var ignores block boundaries and attempts to hoist to the enclosing function level, clashing with the let variable already registered in that scope.",
  tags: ["shadowing", "syntax-error", "scope"]
}));

cards.push(createCard({
  idNum: 9,
  category: "Execution Context & Scope",
  concept: "Call Stack Overflow & Recursion Limits",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What causes a Call Stack Overflow (Maximum call stack size exceeded) and how can it be prevented?",
  answer: "A Call Stack Overflow occurs when functions are invoked recursively without an exit base case, continuously pushing new Execution Context frames until the engine exceeds its maximum allocated stack memory limit. It can be prevented using tail-call optimization, iterative loops, or trampoline functions.",
  explanation: "V8 typically allocates ~10,000–15,000 stack frames depending on memory limits. When functions call themselves synchronously without returning, stack frames accumulate until the engine throws 'RangeError: Maximum call stack size exceeded'. To handle deep or unbounded recursion: 1) Convert to an iterative loop with a custom heap array stack, 2) Use trampolining (returning thunks), or 3) Yield via event loop microtasks.",
  code: `// Stack overflow
function recursive(n) {
  return recursive(n + 1); // RangeError: Maximum call stack size exceeded
}

// Trampoline pattern: prevents stack growth by executing in a while loop
function trampoline(fn) {
  return function(...args) {
    let result = fn(...args);
    while (typeof result === "function") {
      result = result();
    }
    return result;
  };
}

const safeSum = trampoline(function sum(n, acc = 0) {
  return n === 0 ? acc : () => sum(n - 1, acc + n);
});
console.log(safeSum(100000)); // 5000050000 without stack overflow!`,
  recallHint: "Stack Overflow = too many nested function calls exceeding stack memory. Fix with iteration or trampolining.",
  interviewTip: "Mention that while ES6 specified Tail Call Optimization (TCO), only Safari's WebKit implemented it; V8 and SpiderMonkey did not adopt it due to debugging/stack trace complexities.",
  tags: ["call-stack", "stack-overflow", "trampoline", "recursion"]
}));

cards.push(createCard({
  idNum: 10,
  category: "Execution Context & Scope",
  concept: "Strict Mode ('use strict')",
  priority: "must-know",
  difficulty: "beginner",
  question: "What changes occur in the JavaScript runtime when 'use strict' is enabled?",
  answer: "'use strict' enforces stricter parsing and error handling: it prevents accidental global variable creation, makes silent assignment failures throw TypeErrors, forbids deleting non-configurable properties, sets 'this' to undefined (instead of global object) in plain functions, and disables 'with' statements.",
  explanation: "Strict mode can be enabled globally or per function. Modern ES Modules and ES6 Classes run in strict mode by default. Key strict mode differences: 1) Assigning to an undeclared variable throws ReferenceError. 2) Assigning to a non-writable property or getter-only throws TypeError. 3) Duplicate parameter names in function declarations throw SyntaxError. 4) 'this' in a standalone function call defaults to 'undefined'. 5) 'eval' creates its own sandboxed variable scope.",
  code: `"use strict";

// 1. No accidental globals
// undeclaredVar = 100; // ReferenceError: undeclaredVar is not defined

// 2. 'this' is undefined in standalone functions
function checkThis() {
  return this;
}
console.log(checkThis()); // undefined (would be window/global in non-strict mode)

// 3. Silent errors throw
const obj = Object.freeze({ prop: 42 });
// obj.prop = 99; // TypeError: Cannot assign to read only property 'prop'`,
  recallHint: "'use strict': No accidental globals, 'this' is undefined in standalone calls, silent errors throw.",
  interviewTip: "Always mention that all ES6 classes and ES modules (`<script type='module'>`) are automatically in strict mode; you don't need to write 'use strict' in modern modular code.",
  tags: ["strict-mode", "runtime", "best-practices"]
}));

cards.push(createCard({
  idNum: 11,
  category: "Execution Context & Scope",
  concept: "Lexical Scoping vs Dynamic Scoping",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What is the difference between Lexical (Static) Scoping and Dynamic Scoping?",
  answer: "In Lexical Scoping (used by JavaScript), scope is determined by where functions and variables are written in the source code at authoring time. In Dynamic Scoping (used by Bash/Perl), scope is determined by where and by whom a function is called at runtime.",
  explanation: "Because JavaScript uses lexical scoping, a function retains access to the variables of its parent scope where it was defined, regardless of where or when it is invoked later. This author-time scope topology is what makes closures possible. The only feature in JavaScript that behaves dynamically like dynamic scoping is the 'this' keyword, which binds based on invocation context.",
  code: `const x = 10;

function foo() {
  console.log(x); // Resolves lexically to outer x = 10
}

function bar() {
  const x = 20;
  foo(); // Invoked here, but foo looks at its definition scope, NOT bar's scope
}

bar(); // Logs 10! (If JS had dynamic scoping, it would log 20)`,
  recallHint: "Lexical scope = WHERE IT IS DEFINED. Dynamic scope = WHERE IT IS CALLED.",
  interviewTip: "A classic interview trap! If the interviewer asks what `bar()` logs in the code snippet above, the answer is always 10 because JavaScript is lexically scoped.",
  tags: ["lexical-scoping", "dynamic-scoping", "closures"]
}));

cards.push(createCard({
  idNum: 12,
  category: "Execution Context & Scope",
  concept: "Global Object & globalThis",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is globalThis, and how does it unify global object access across JavaScript runtimes?",
  answer: "globalThis is a standardized global property (introduced in ES2020) that returns the top-level global object regardless of the runtime environment (window/self in browsers, global in Node.js, self in Web Workers).",
  explanation: "Before ES2020, writing environment-agnostic JavaScript required brittle checks: `const getGlobal = () => (typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : this)`. globalThis standardizes universal access across browsers, Node.js, Deno, Bun, and Web Workers. In non-strict scripts, top-level var and function declarations attach to globalThis.",
  code: `// Universal global variable access
console.log(globalThis === (typeof window !== 'undefined' ? window : global)); // true

globalThis.appConfig = { env: "production", version: "2.4" };

function getEnv() {
  return globalThis.appConfig.env;
}
console.log(getEnv()); // "production"`,
  recallHint: "globalThis = standard global object across browser (window), Node (global), and Workers (self).",
  interviewTip: "Remind the interviewer that top-level 'let' and 'const' declarations in the global scope do NOT bind to globalThis; only 'var' and function declarations do in non-module scripts.",
  tags: ["globalthis", "es2020", "runtime-environments"]
}));

module.exports = cards;
