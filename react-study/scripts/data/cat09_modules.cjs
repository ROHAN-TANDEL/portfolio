const { makeItem } = require('../builder_helper.cjs');

const category = "9. Module Systems: ESM vs CommonJS";

const items = [
  makeItem({
    idNum: 108,
    category,
    concept: "CommonJS (CJS) Synchronous Loading Mechanics",
    priority: "must-know",
    difficulty: "Foundational",
    question: "How does CommonJS (require) load modules synchronously in Node.js?",
    quickAnswer: "require() resolves the path, checks require.cache, wraps code in a module wrapper function, and executes it synchronously.",
    answer: "CommonJS (`require` / `module.exports`) is Node.js's original module system. When `require('./module')` is called: 1) Resolution: Resolves the exact file path (checking extensions `.js`, `.json`, `.node`), 2) Caching: Checks `require.cache`; if present, returns the cached `module.exports` immediately, 3) Wrapping: Reads the file string and wraps it in a C++ function wrapper: `(function (exports, require, module, __filename, __dirname) { ... })`, 4) Execution: Executes the wrapped function synchronously and returns `module.exports`.",
    explanation: "Because `require()` is synchronous, it blocks the thread while reading from disk. This worked well on local filesystems, but cannot work across asynchronous network URLs.",
    code: "// The internal CommonJS module wrapper function:\n// (function(exports, require, module, __filename, __dirname) {\n//   Your code runs here with these 5 injected variables!\n// });\n\nconsole.log(__filename); // Injected by CJS wrapper\nconsole.log(__dirname);",
    recallHint: "require() resolves, checks require.cache, wraps code in function wrapper, executes synchronously.",
    interviewTip: "Candidate check: Explain that __dirname and __filename are NOT global variables; they are local parameters injected by the CJS wrapper function.",
    tags: ["commonjs", "require", "module-wrapper", "dirname", "caching"]
  }),

  makeItem({
    idNum: 109,
    category,
    concept: "ECMAScript Modules (ESM) Static Graph Resolution",
    priority: "must-know",
    difficulty: "Foundational",
    question: "How does ECMAScript Modules (ESM) resolution differ from CommonJS?",
    quickAnswer: "ESM has a 3-phase asynchronous lifecycle: Construction (parse static AST), Instantiation (link memory bindings), Evaluation (run code).",
    answer: "Unlike CommonJS's runtime synchronous execution, ESM (`import` / `export`) uses a three-phase asynchronous module lifecycle: 1) Construction: Parses all files into Abstract Syntax Trees (ASTs) to determine imports without executing any code. Static imports (`import x from 'y'`) must be at the top level. 2) Instantiation: Allocates memory boxes for exported values and links import and export pointers (Live Bindings). 3) Evaluation: Executes the code in top-to-bottom order, filling memory boxes with actual values.",
    explanation: "Because ESM builds a static dependency graph before executing any code, static analysis, tree-shaking, and dead code elimination are possible.",
    code: "// ESM enables static analysis and top-level await:\nimport fs from 'node:fs/promises';\n\n// Top-level await is natively supported in ESM!\nconst data = await fs.readFile('./package.json', 'utf8');\nexport const pkg = JSON.parse(data);",
    recallHint: "ESM phases: Construction (parse AST) -> Instantiation (link live bindings) -> Evaluation (execute).",
    interviewTip: "Highlight that ESM live bindings allow exports to update in real time, unlike CommonJS which copies primitive values.",
    tags: ["esm", "ecmascript-modules", "import", "export", "static-analysis"]
  }),

  makeItem({
    idNum: 110,
    category,
    concept: "Live Bindings in ESM vs Value Copies in CJS",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "What are Live Bindings in ESM and how do they differ from CommonJS exports?",
    quickAnswer: "ESM imports are live pointers to the exporter's memory location; CJS exports copy primitive values at require time.",
    answer: "In CommonJS, `module.exports = { count }` evaluates and COPIES the current value of `count`. If the exporter mutates `count` later, the importing module continues holding the stale copied value. In ESM, `import { count } from './module.js'` creates a 'Live Binding' (a read-only reference directly pointing to the exported memory cell in the exporter module).",
    explanation: "If the exporting module updates `count`, the importer's `count` variable reflects the new value immediately. However, the importer cannot reassign `count = 5` (it is a read-only live binding).",
    code: "// --- exporter.js (ESM) ---\nexport let counter = 0;\nexport function increment() { counter++; }\n\n// --- consumer.js (ESM) ---\nimport { counter, increment } from './exporter.js';\nconsole.log(counter); // 0\nincrement();\nconsole.log(counter); // 1 (Live binding updated automatically!)\n// counter = 10; // TypeError: Assignment to constant variable",
    recallHint: "ESM imports are read-only live pointers to exporter memory; CJS copies values at require time.",
    interviewTip: "Live bindings are a classic interview puzzle: ask candidates why circular references behave differently in ESM vs CJS.",
    tags: ["live-bindings", "esm", "commonjs", "module-system"]
  }),

  makeItem({
    idNum: 111,
    category,
    concept: "package.json 'type': 'module' & Extension Rules",
    priority: "must-know",
    difficulty: "Foundational",
    question: "How does Node.js determine whether a file should be treated as ESM or CommonJS?",
    quickAnswer: "Files with .mjs are always ESM; .cjs are always CJS; .js files inherit from package.json {'type': 'module'}.",
    answer: "Node.js uses file extensions and `package.json` to determine module format: 1) `.mjs` extension: ALWAYS treated as ECMAScript Module (ESM). 2) `.cjs` extension: ALWAYS treated as CommonJS (CJS). 3) `.js` extension: Inherits the setting from the nearest parent `package.json`: if `\"type\": \"module\"` is defined, `.js` files are ESM; otherwise (or if omitted), `.js` defaults to CommonJS.",
    explanation: "In pure ESM projects (`\"type\": \"module\"`), you cannot use `require()`, `__dirname`, or `__filename` directly; you must use `import` and `import.meta.url`.",
    code: "// package.json:\n// {\n//   \"name\": \"my-app\",\n//   \"type\": \"module\"\n// }\n\n// In an ESM file (.mjs or .js with type:module):\nimport path from 'node:path';\n// require('./lib.js'); // ReferenceError: require is not defined in ES module scope",
    recallHint: ".mjs = ESM; .cjs = CJS; .js depends on package.json \"type\": \"module\".",
    interviewTip: "Candidate tip: In ESM, local relative imports MUST include file extensions (import './user.js', not import './user').",
    tags: ["package-json", "type-module", "mjs", "cjs", "extensions"]
  }),

  makeItem({
    idNum: 112,
    category,
    concept: "Replacing __dirname & __filename in ESM (import.meta)",
    priority: "must-know",
    difficulty: "Foundational",
    question: "How do you replicate __dirname and __filename in ESM using import.meta.url?",
    quickAnswer: "Use fileURLToPath(import.meta.url) for __filename and path.dirname() for __dirname.",
    answer: "Because `__dirname` and `__filename` were parameters injected by the legacy CommonJS wrapper function, they do NOT exist in ECMAScript Modules (ESM). Accessing them throws `ReferenceError: __dirname is not defined`.",
    explanation: "To replicate them in modern Node.js: use `import.meta.url` (which provides the current file path as a standard `file:///` URL), and convert it to an OS filesystem path string using `node:url.fileURLToPath()`.",
    code: "import { fileURLToPath } from 'node:url';\nimport path from 'node:path';\n\n// Replicating __filename and __dirname in ESM:\nexport const __filename = fileURLToPath(import.meta.url);\nexport const __dirname = path.dirname(__filename);\n\nconsole.log('Current file path:', __filename);\nconsole.log('Current directory path:', __dirname);",
    recallHint: "__filename = fileURLToPath(import.meta.url); __dirname = path.dirname(__filename).",
    interviewTip: "In modern Node.js 20.11+ / 21+, import.meta.dirname and import.meta.filename were added as native built-ins!",
    tags: ["dirname", "filename", "import-meta", "esm", "url"]
  }),

  makeItem({
    idNum: 113,
    category,
    concept: "Dual Package Hazard & Conditional Exports",
    priority: "important",
    difficulty: "Advanced",
    question: "What is the Dual Package Hazard in npm publishing, and how does the package.json 'exports' field resolve it?",
    quickAnswer: "It happens when an app loads both CJS and ESM versions of the same package, creating duplicate singletons; exports maps format entry points.",
    answer: "When a library publishes both CommonJS and ESM builds, an application can accidentally load BOTH if some dependencies use `require()` while others use `import()`. This causes the package code to evaluate twice, creating two separate copies of internal singletons (e.g. database pools or state registries) in memory—known as the Dual Package Hazard.",
    explanation: "Solution: Modern `package.json` uses the `exports` field to define strict conditional entry points (`\"import\"` vs `\"require\"`), and stateful libraries use a CJS wrapper to ensure only a single instance of internal state exists.",
    code: "// package.json exports mapping:\n// {\n//   \"name\": \"my-library\",\n//   \"exports\": {\n//     \".\": {\n//       \"import\": \"./dist/index.mjs\",\n//       \"require\": \"./dist/index.cjs\",\n//       \"types\": \"./dist/index.d.ts\"\n//     }\n//   }\n// }",
    recallHint: "Dual Package Hazard = duplicate state when app loads both CJS and ESM. Fix with package.json exports map.",
    interviewTip: "Essential for library authors publishing packages consumed by both legacy and modern Node ecosystems.",
    tags: ["dual-package-hazard", "exports-field", "npm", "packaging", "esm"]
  }),

  makeItem({
    idNum: 114,
    category,
    concept: "Top-Level await in ESM and Event Loop Implications",
    priority: "important",
    difficulty: "Intermediate",
    question: "How does Top-Level await work in ESM and what are its execution implications?",
    quickAnswer: "It allows await outside async functions at the top level of a module, pausing dependent modules until the promise settles.",
    answer: "In ECMAScript Modules (ESM), `await` can be used directly at the top level of a module without wrapping it in an `async function` or IIFE. When a module uses top-level await, it becomes an asynchronous module. Any parent module that imports it will pause execution of its own module body until the imported module's top-level await resolves.",
    explanation: "Sibling modules in the dependency graph can still evaluate concurrently. Caution: A top-level await that hangs (e.g. stalled database connection) blocks the entire application from bootstrapping.",
    code: "// database.js (Top-Level await):\nimport { createConnection } from 'my-db-client';\n\n// Connects before any other module can use db connection:\nexport const connection = await createConnection('postgres://localhost:5432');\n\n// server.js:\nimport { connection } from './database.js'; // Waits for connection before running!\nconsole.log('Database connected, launching HTTP server...');",
    recallHint: "Top-level await pauses dependent importers until the promise resolves; ideal for bootstrapping connections.",
    interviewTip: "Candidate caution: Highlight that top-level await in CommonJS is a syntax error; it is strictly an ESM feature.",
    tags: ["top-level-await", "esm", "async", "module-lifecycle"]
  }),

  makeItem({
    idNum: 115,
    category,
    concept: "Circular Dependencies: CJS vs ESM Resolution",
    priority: "important",
    difficulty: "Advanced",
    question: "How do CommonJS and ESM handle circular dependencies differently?",
    quickAnswer: "CJS returns an incomplete, half-evaluated exports object; ESM uses live bindings, which can cause uninitialized TDZ errors.",
    answer: "When Module A imports Module B, and Module B imports Module A (circular dependency): 1) CommonJS: When B requires A, Node immediately returns A's `module.exports` in its CURRENT, partially evaluated state. If B tries to access a property that A hasn't attached yet, it receives `undefined`. 2) ESM: Does not execute code until the full dependency graph is parsed. B gets a live binding reference to A's export. If B attempts to access a `const` or `let` export from A before A's file has finished evaluating, it throws a `ReferenceError: Cannot access variable before initialization` (Temporal Dead Zone).",
    explanation: "Best architectural practice: Eliminate circular dependencies by extracting shared logic into a separate third module C.",
    code: "// CJS Circular Trap: module B receives empty {} from A because A is half-evaluated\n// ESM Circular Trap: module B triggers TDZ ReferenceError when accessing uninitialized export\n// Fix: Refactor to A -> C <- B",
    recallHint: "CJS circular = partial undefined exports object; ESM circular = Temporal Dead Zone (TDZ) ReferenceError.",
    interviewTip: "Senior interviewers use circular dependencies to test whether you understand how V8 handles module instantiation phases.",
    tags: ["circular-dependency", "commonjs", "esm", "tdz", "architecture"]
  }),

  makeItem({
    idNum: 116,
    category,
    concept: "Dynamic Imports (import()) for Code Splitting",
    priority: "important",
    difficulty: "Intermediate",
    question: "When should you use dynamic import() instead of static import in Node.js?",
    quickAnswer: "Use dynamic import() for conditional loading, code splitting, lazy loading large libraries, or importing ESM from CommonJS.",
    answer: "Static imports (`import x from 'y'`) are evaluated statically before any code runs. Dynamic `import('module')` is a function that returns a Promise resolving to the module's namespace object. Use cases: 1) Conditional loading (loading an OS-specific module or dev tool only when needed), 2) Lazy loading heavy libraries (loading image processing or PDF generation only when the endpoint is requested), 3) Importing pure ESM packages from within a legacy CommonJS codebase.",
    explanation: "Unlike static imports, dynamic `import()` can be used anywhere: inside function bodies, conditional `if` branches, and loops.",
    code: "async function generatePdfReport(data) {\n  // Lazy-load heavy PDF library only when this function is actually called:\n  const { PDFDocument } = await import('pdf-lib');\n  const doc = await PDFDocument.create();\n  // ...\n}",
    recallHint: "dynamic import() returns a Promise; enables lazy loading, conditional imports, and importing ESM into CJS.",
    interviewTip: "Highlight that import() is the ONLY way a CommonJS file can load a pure ESM module without transpilation.",
    tags: ["dynamic-import", "lazy-loading", "code-splitting", "performance"]
  }),

  makeItem({
    idNum: 117,
    category,
    concept: "Module Caching in require.cache & Memory Leaks",
    priority: "important",
    difficulty: "Advanced",
    question: "What is require.cache in CommonJS and how can mutating it cause memory leaks?",
    quickAnswer: "require.cache stores evaluated module exports by absolute path; deleting entries without clearing retainers causes memory leaks.",
    answer: "In CommonJS, modules are singletons: once a file is loaded via `require()`, its exported object is cached in `require.cache[absolutePath]`. Subsequent `require()` calls return the cached object without re-executing the file. Developers sometimes delete entries (`delete require.cache[path]`) to implement 'Hot Reloading' in development.",
    explanation: "Danger: Deleting an entry from `require.cache` does NOT garbage collect the old module if any other active code holds a reference to it or if it registered event listeners on `process`. Repeatedly reloading modules causes memory usage to climb rapidly.",
    code: "// Inspecting CommonJS module cache:\nimport path from 'node:path';\n\nconst fullPath = path.resolve('./config.json');\n// console.log(require.cache[fullPath]);\n\n// Hot reload anti-pattern in production (causes memory leaks!):\n// delete require.cache[fullPath];\n// const freshConfig = require(fullPath);",
    recallHint: "require.cache stores singletons by path; deleting cache entries without clearing closures causes memory leaks.",
    interviewTip: "Explain why production Node servers restart processes for updates instead of mutating require.cache.",
    tags: ["require-cache", "hot-reload", "memory-leaks", "commonjs"]
  }),

  makeItem({
    idNum: 118,
    category,
    concept: "package.json 'imports' Subpath Imports (#private)",
    priority: "good-to-know",
    difficulty: "Intermediate",
    question: "What are Subpath Imports (#) in package.json and how do they replace module aliases?",
    quickAnswer: "Subpath imports (#internal) create native internal aliases without build tools, allowing cleaner module paths.",
    answer: "Historically, avoiding messy relative paths (like `../../../utils/db.js`) required build tools (Webpack aliases, tsconfig paths, module-alias). Node.js 14.6+ introduced native Subpath Imports: keys in `package.json` starting with `#` map to internal directory paths.",
    explanation: "Subpath imports also support conditional mapping (mapping `#dep` to a mock in tests and real code in production) natively supported by Node.js runtime without any transpilation.",
    code: "// package.json:\n// {\n//   \"imports\": {\n//     \"#utils/*\": \"./src/utils/*\",\n//     \"#database\": \"./src/config/database.js\"\n//   }\n// }\n\n// In any file anywhere in the project:\n// import { connect } from '#database';\n// import { formatDate } from '#utils/date.js';",
    recallHint: "Subpath imports (#prefix in package.json) provide native module aliasing without Webpack or tsconfig paths.",
    interviewTip: "Promoting package.json native subpath imports demonstrates cutting-edge standard Node.js practices.",
    tags: ["subpath-imports", "package-json", "module-alias", "clean-code"]
  })
];

module.exports = items;
