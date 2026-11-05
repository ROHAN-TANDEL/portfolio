const { makeItem } = require('../builder_helper.cjs');

const category = "12. Modern Node.js 20-22 LTS Features";

const items = [
  makeItem({
    idNum: 143,
    category,
    concept: "Native fetch() API & Undici Engine",
    priority: "must-know",
    difficulty: "Foundational",
    question: "How does native global fetch() work in modern Node.js and why did it replace node-fetch / Axios?",
    quickAnswer: "Native fetch() is built into Node 18+ powered by Undici; it provides standard web API parity without third-party dependencies.",
    answer: "Historically, making HTTP requests in Node required third-party libraries (`axios`, `node-fetch`, `got`) or verbose raw `node:http`. In Node.js 18+ (and stabilized in Node 20/22 LTS), the WHATWG standard `fetch()`, `Request`, `Response`, and `Headers` APIs are available globally without importing anything.",
    explanation: "Under the hood, native `fetch()` is powered by `undici`, a high-performance HTTP/1.1 and HTTP/2 client written from scratch by the Node.js core team. It provides pipelining, connection pooling, and connection reuse with up to 2x-3x higher throughput than legacy `http.request()`.",
    code: "// Native global fetch with AbortSignal in Node 20/22:\nconst res = await fetch('https://api.github.com/users/octocat', {\n  headers: { 'User-Agent': 'Node-App' },\n  signal: AbortSignal.timeout(5000) // Native timeout in modern Node!\n});\n\nif (!res.ok) throw new Error(`HTTP error: ${res.status}`);\nconst user = await res.json();\nconsole.log('User login:', user.login);",
    recallHint: "Native fetch() is powered by Undici in Node 18+; eliminates Axios/node-fetch and supports AbortSignal.timeout.",
    interviewTip: "Candidate check: Point out AbortSignal.timeout(ms) as the modern, clean replacement for manual setTimeout cancellation.",
    tags: ["fetch", "undici", "node20", "node22", "web-standards"]
  }),

  makeItem({
    idNum: 144,
    category,
    concept: "Native Test Runner (node:test) & node:assert/strict",
    priority: "must-know",
    difficulty: "Foundational",
    question: "How does the built-in Node.js Test Runner (node:test) replace Jest and Mocha?",
    quickAnswer: "node:test provides native test, describe, it, before/after hooks, mocking, and coverage (node --test) without external packages.",
    answer: "Node.js 18+ (stabilized in Node 20/22 LTS) includes a native, blazingly fast test runner module (`node:test`) and strict assertions (`node:assert/strict`). It eliminates the need for heavyweight external test frameworks like Jest or Mocha.",
    explanation: "Features: 1) Supports `describe`, `it`, `test`, `suite`, 2) Full lifecycle hooks (`before`, `after`, `beforeEach`, `afterEach`), 3) Native function mocking and timers (`mock.fn()`), 4) Native test runner CLI: `node --test` discovers and runs all `*.test.js` files, 5) Built-in code coverage: `node --test --experimental-test-coverage`.",
    code: "import { test, describe, it, mock } from 'node:test';\nimport assert from 'node:assert/strict';\n\ndescribe('Math Service', () => {\n  it('should add numbers correctly', () => {\n    assert.equal(1 + 2, 3);\n  });\n\n  it('should handle async operations and mocking', async () => {\n    const fn = mock.fn((x) => x * 2);\n    assert.equal(fn(5), 10);\n    assert.equal(fn.mock.callCount(), 1);\n  });\n});",
    recallHint: "node:test + node:assert/strict = Zero-dependency native testing with describe, it, mocking, and coverage.",
    interviewTip: "Highlight that native node:test starts in milliseconds, completely avoiding the slow Jest Babel/transpiler overhead.",
    tags: ["node-test", "test-runner", "mocking", "assert", "zero-dependency"]
  }),

  makeItem({
    idNum: 145,
    category,
    concept: "Native Watch Mode (node --watch)",
    priority: "must-know",
    difficulty: "Foundational",
    question: "What is node --watch and why does it eliminate Nodemon in modern Node.js workflows?",
    quickAnswer: "node --watch natively monitors imported files and restarts the process upon file changes without third-party tools.",
    answer: "Historically, developers installed `nodemon` or `ts-node-dev` to restart Node processes during local development when source files changed. Node.js 18.11+ (stable in Node 20/22) introduced the native `--watch` CLI flag.",
    explanation: "When launched with `node --watch server.js`, Node automatically monitors the entry file and ALL imported dependencies in the module graph, restarting the process instantly when any watched file is modified. You can also specify `--watch-path` to watch additional static directories.",
    code: "# Modern development workflow without Nodemon:\n# node --watch server.js\n\n# Watch specific directories and ignore dist:\n# node --watch-path=./src --watch-path=./config server.js",
    recallHint: "node --watch natively restarts on file changes; eliminates nodemon from package.json devDependencies.",
    interviewTip: "Showcasing node --watch in npm scripts shows that you prioritize lean dependencies over legacy tools.",
    tags: ["watch-mode", "nodemon", "developer-experience", "node20", "cli"]
  }),

  makeItem({
    idNum: 146,
    category,
    concept: "Built-in .env File Support (node --env-file)",
    priority: "must-know",
    difficulty: "Foundational",
    question: "How does node --env-file replace the dotenv package in modern Node.js?",
    quickAnswer: "node --env-file=.env automatically loads environmental variables into process.env before evaluating any application code.",
    answer: "For over a decade, virtually every Node.js application installed `dotenv` to load local configuration variables from a `.env` file. Node.js 20.6+ introduced native support for `.env` files via the `--env-file` command-line flag.",
    explanation: "Launching with `node --env-file=.env server.js` loads the file and populates `process.env` BEFORE any JavaScript is evaluated, ensuring environment variables are available to top-level module imports and configuration files without `import 'dotenv/config'`.",
    code: "# Load .env file natively:\n# node --env-file=.env server.js\n\n# Load multiple cascading env files (local overrides production):\n# node --env-file=.env.production --env-file=.env.local server.js",
    recallHint: "node --env-file=.env populates process.env natively before code evaluates; eliminates dotenv.",
    interviewTip: "Candidate check: Mention that cascading multiple --env-file flags allows clean environment staging.",
    tags: ["env-file", "dotenv", "configuration", "process-env", "node20"]
  }),

  makeItem({
    idNum: 147,
    category,
    concept: "Built-in SQLite Module (node:sqlite)",
    priority: "important",
    difficulty: "Intermediate",
    question: "What is the native node:sqlite module introduced in modern Node.js (v22.5+)?",
    quickAnswer: "node:sqlite provides a synchronous and asynchronous embedded SQLite engine compiled directly into the Node binary.",
    answer: "Node.js 22.5+ introduced experimental built-in support for SQLite via `node:sqlite`. Historically, using SQLite in Node required native C++ addons (`better-sqlite3`, `sqlite3`) that required Python and C++ compilers (`node-gyp`) during installation.",
    explanation: "With `node:sqlite`, SQLite is embedded directly into the Node.js executable binary. Features: In-memory or file databases, prepared statements, synchronous execution (for zero-latency caching), and native transactions.",
    code: "import { DatabaseSync } from 'node:sqlite';\n\n// Embedded in-memory database with zero npm dependencies:\nconst db = new DatabaseSync(':memory:');\n\ndb.exec(`\n  CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, email TEXT);\n  INSERT INTO users (name, email) VALUES ('Alice', 'alice@test.com');\n`);\n\nconst query = db.prepare('SELECT * FROM users WHERE name = ?');\nconst user = query.get('Alice');\nconsole.log('User from embedded SQLite:', user);",
    recallHint: "node:sqlite embeds SQLite directly in Node 22+ binary; no C++ compilers or node-gyp needed.",
    interviewTip: "Highlight using in-memory SQLite for high-speed local caching, embedded state, and fast integration tests.",
    tags: ["sqlite", "node-sqlite", "node22", "embedded-db", "zero-dependency"]
  }),

  makeItem({
    idNum: 148,
    category,
    concept: "Native WebSocket Client in Node.js 21/22",
    priority: "important",
    difficulty: "Intermediate",
    question: "How does the global WebSocket client in modern Node.js match browser standards?",
    quickAnswer: "Node 21/22 provides standard global WebSocket client matching browser APIs without installing the ws npm package.",
    answer: "Historically, Node.js had no built-in client for WebSockets, requiring developers to install `ws`. In Node.js 21 and stabilized in Node.js 22, the WHATWG standard `WebSocket` client class is available globally on `globalThis`.",
    explanation: "This enables isomorphic real-time client code that runs identically in browser DevTools and on the Node.js backend without shims.",
    code: "// Global native WebSocket client in Node 22:\nconst ws = new WebSocket('wss://echo.websocket.org');\n\nws.addEventListener('open', () => {\n  console.log('Connected to WebSocket server natively!');\n  ws.send('Hello from modern Node.js!');\n});\n\nws.addEventListener('message', (event) => {\n  console.log('Received:', event.data);\n  ws.close();\n});",
    recallHint: "Global WebSocket client is built into modern Node 21/22, providing browser parity without npm packages.",
    interviewTip: "Clarify that this is a WebSocket CLIENT; running a WebSocket SERVER still typically uses the ws package.",
    tags: ["websocket", "node21", "node22", "web-standards", "realtime"]
  }),

  makeItem({
    idNum: 149,
    category,
    concept: "Single Executable Applications (SEA)",
    priority: "important",
    difficulty: "Advanced",
    question: "What are Single Executable Applications (SEA) in Node.js and how do they package code into a binary?",
    quickAnswer: "SEA bundles JavaScript code directly into the official Node.js binary, producing a standalone executable with no runtime install needed.",
    answer: "Node.js 20+ introduced native support for Single Executable Applications (SEA). Historically, packaging a Node app into a standalone binary required third-party tools like `pkg` or `nexe` that relied on fragile runtime patching.",
    explanation: "With SEA: 1) Bundle your application into a single `.js` file (via esbuild or rollup), 2) Generate a SEA blob configuration using `node --experimental-sea-config sea-config.json`, 3) Inject the blob into a copy of the official `node` binary using `postject`. The resulting binary executes natively on end-user machines without requiring Node.js to be pre-installed.",
    code: "// sea-config.json:\n// {\n//   \"main\": \"dist/bundle.js\",\n//   \"output\": \"sea-prep.blob\",\n//   \"disableExperimentalSEAWarning\": true\n// }\n\n// Build steps:\n// $ node --experimental-sea-config sea-config.json\n// $ cp $(command -v node) myapp\n// $ postject myapp NODE_SEA_BLOB sea-prep.blob --sentinel-fuse ...",
    recallHint: "SEA injects bundled JS into the Node binary, producing a single standalone .exe / binary.",
    interviewTip: "Ideal for shipping enterprise CLI tools, internal DevOps utilities, and desktop distribution.",
    tags: ["sea", "single-executable", "packaging", "node20", "cli"]
  }),

  makeItem({
    idNum: 150,
    category,
    concept: "Native TypeScript Execution (--experimental-strip-types)",
    priority: "must-know",
    difficulty: "Intermediate",
    question: "How does Node.js 22.6+ natively execute TypeScript files with --experimental-strip-types?",
    quickAnswer: "Node parses TypeScript and strips type annotations in memory via @swc/wasm, running the JS without compile steps.",
    answer: "In Node.js 22.6+, Node introduced native support for executing `.ts` files directly without installing `tsx`, `ts-node`, or running `tsc` build steps. Enabled via `node --experimental-strip-types app.ts`.",
    explanation: "How it works: Node.js embeds a fast C++/Wasm parser (powered by SWC) that strips out type annotations, interfaces, and type imports in memory in milliseconds, and immediately passes the clean un-typed JavaScript to V8. It does NOT perform type-checking (type checking is left to your IDE or `tsc --noEmit`), making startup almost instant.",
    code: "// app.ts (Executed natively in Node 22.6+):\ninterface User {\n  id: number;\n  name: string;\n}\n\nfunction greet(user: User): string {\n  return `Hello, ${user.name}!`;\n}\n\nconsole.log(greet({ id: 1, name: 'Alice' }));\n\n// Run directly without build step:\n// $ node --experimental-strip-types app.ts",
    recallHint: "node --experimental-strip-types executes .ts files directly in Node 22+ by stripping types in memory.",
    interviewTip: "Highlight that type-stripping avoids runtime overhead, while tsc --noEmit in CI ensures full type safety.",
    tags: ["typescript", "strip-types", "node22", "dx", "swc"]
  }),

  makeItem({
    idNum: 151,
    category,
    concept: "Diagnostic Channel (node:diagnostics_channel)",
    priority: "important",
    difficulty: "Advanced",
    question: "What is node:diagnostics_channel and how does it decouple instrumentation from business logic?",
    quickAnswer: "It provides a lightweight pub/sub bus inside the Node process for APM agents and loggers to capture telemetry without monkey-patching.",
    answer: "Historically, APM vendors (Datadog, New Relic, Dynatrace) instrumented libraries by 'monkey-patching' internal methods (wrapping `http.request` or `pg.query`), which caused brittle bugs and performance regressions. `node:diagnostics_channel` provides a native, low-overhead pub/sub channel for diagnostics.",
    explanation: "Libraries emit telemetry events into named channels (e.g. `http.client.request.start`). APM subscribers listen to these channels. If no subscriber is active, the channel check is a fast single-pointer comparison that consumes virtually zero CPU.",
    code: "import diagnosticsChannel from 'node:diagnostics_channel';\n\n// 1. Framework or library instruments an event:\nconst channel = diagnosticsChannel.channel('my-app.order.processed');\n\nfunction processOrder(orderId) {\n  // If anyone is listening, publish telemetry:\n  if (channel.hasSubscribers) {\n    channel.publish({ orderId, timestamp: Date.now() });\n  }\n}\n\n// 2. APM Agent or logger subscribes cleanly without monkey-patching:\ndiagnosticsChannel.subscribe('my-app.order.processed', (message) => {\n  console.log('[Telemetry Capture]', message);\n});",
    recallHint: "diagnostics_channel provides native, non-intrusive telemetry pub/sub without monkey-patching.",
    interviewTip: "OpenTelemetry and native Node HTTP instrumentation now standardize on diagnostics_channel.",
    tags: ["diagnostics-channel", "telemetry", "apm", "observability", "instrumentation"]
  }),

  makeItem({
    idNum: 152,
    category,
    concept: "Web Cryptography API (crypto.subtle) in Node.js",
    priority: "important",
    difficulty: "Intermediate",
    question: "How does crypto.subtle provide standard W3C Web Cryptography in modern Node.js?",
    quickAnswer: "crypto.subtle is a Promise-based Web standard API for hashing, encryption (AES-GCM), and signatures (HMAC, ECDSA).",
    answer: "While `node:crypto` provides legacy OpenSSL-style synchronous and streaming methods, `crypto.subtle` implements the W3C Web Cryptography standard globally. It is fully asynchronous and Promise-based, matching browser crypto APIs.",
    explanation: "Methods include: `subtle.digest('SHA-256', data)`, `subtle.encrypt()`, `subtle.decrypt()`, `subtle.sign()`, and `subtle.verify()`. Using `crypto.subtle` enables isomorphic cryptographic code that runs identically in Cloudflare Workers, browsers, and Node.",
    code: "// Generating SHA-256 hash using standard Web Crypto:\nconst text = 'Hello Web Crypto';\nconst encoded = new TextEncoder().encode(text);\n\nconst hashBuffer = await crypto.subtle.digest('SHA-256', encoded);\nconst hashArray = Array.from(new Uint8Array(hashBuffer));\nconst hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');\nconsole.log('SHA-256 Hex:', hashHex);",
    recallHint: "crypto.subtle is the standard Promise-based Web Cryptography API matching browsers and Edge workers.",
    interviewTip: "Recommend crypto.subtle for any new shared cryptographic utilities designed for isomorphic environments.",
    tags: ["crypto-subtle", "web-crypto", "standards", "isomorphic", "sha256"]
  }),

  makeItem({
    idNum: 153,
    category,
    concept: "Corepack & Modern Package Manager Management",
    priority: "good-to-know",
    difficulty: "Foundational",
    question: "What is Corepack in Node.js and how does it guarantee team consistency between npm, yarn, and pnpm?",
    quickAnswer: "Corepack is a built-in bridge that auto-downloads and enforces the exact package manager version specified in package.json.",
    answer: "In team environments, developers often use differing versions of Yarn or pnpm, leading to divergent lockfiles and CI build breaks. Corepack is a tool shipped with Node.js that manages package managers without manual global installation.",
    explanation: "When you declare `\"packageManager\": \"pnpm@9.1.0\"` in `package.json`, Corepack intercepts `pnpm` commands, automatically downloads that exact version in the background, and ensures all team members and CI runners use the identical package manager binary.",
    code: "// package.json:\n// {\n//   \"name\": \"enterprise-app\",\n//   \"packageManager\": \"pnpm@9.5.0+sha512.140003...\"\n// }\n\n// Enable corepack in environment:\n// $ corepack enable\n// $ pnpm install # Corepack ensures exact version 9.5.0 runs!",
    recallHint: "Corepack enforces the packageManager field in package.json, guaranteeing identical tool versions across teams.",
    interviewTip: "Mention that Corepack eliminates the need for global npm install -g pnpm/yarn in Dockerfiles.",
    tags: ["corepack", "pnpm", "yarn", "package-manager", "devops"]
  })
];

module.exports = items;
