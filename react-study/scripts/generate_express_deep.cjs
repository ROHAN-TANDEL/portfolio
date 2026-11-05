const fs = require("fs");
const path = require("path");

const deepChapters = [
  {
    id: "exp-deep-01",
    title: "Express Router Internals, Layer Stack & Path-to-Regexp Compilation",
    category: "Router Internals",
    readTimeMinutes: 16,
    overview: "At the core of Express is an undocumented internal routing engine based on an array of `Layer` instances. Understanding how `app._router`, `Router`, `Route`, and `Layer` interact reveals why route order matters, how `next('route')` and `next('router')` short-circuit execution, and how route strings compile into regular expressions.",
    diagram: `+-------------------------------------------------------------------------+
|                  EXPRESS ROUTER INTERNAL LAYER TOPOLOGY                 |
+-------------------------------------------------------------------------+
|                                                                         |
|  app._router.stack (Array of Layer objects)                             |
|  +-------------------------------------------------------------------+  |
|  | Layer 1: Global Middleware (e.g. cors)                            |  |
|  | - path: undefined (matches all)                                   |  |
|  | - handle: fn(req, res, next)                                      |  |
|  +-------------------------------------------------------------------+  |
|  | Layer 2: Mounted Sub-Router (/api)                                |  |
|  | - path: '/api' (fast_slash: false)                                |  |
|  | - handle: subRouter.handle (dispatches nested stack)              |  |
|  |   +-------------------------------------------------------------+ |  |
|  |   | SubRouter.stack                                             | |  |
|  |   | - Layer 2.1: Router-level middleware (auth)                 | |  |
|  |   | - Layer 2.2: Route Layer (/users/:id)                       | |  |
|  |   |   +-------------------------------------------------------+ | |  |
|  |   |   | Route.stack (Handlers for HTTP verbs)                 | | |  |
|  |   |   | - Layer: GET -> userController.getById                | | |  |
|  |   |   | - Layer: PUT -> userController.update                 | | |  |
|  |   |   +-------------------------------------------------------+ | |  |
|  |   +-------------------------------------------------------------+ |  |
|  +-------------------------------------------------------------------+  |
|  | Layer 3: Catch-All 404 Handler (fn.length === 3)                  |  |
|  +-------------------------------------------------------------------+  |
|  | Layer 4: Global Error Middleware (fn.length === 4)                |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Layer Abstraction and Stack Iteration",
        explanation: "Every middleware, sub-router, and route handler registered via `app.use()`, `app.get()`, or `router.use()` is wrapped in a `Layer` object. A Layer possesses a `regexp` property (compiled from the route path using `path-to-regexp`), a `keys` array (capturing parameter names like `id`), and a `handle` function. During a request, Express initializes an internal cursor index `idx = 0` and calls `next()`. The router iterates sequentially through `_router.stack`, running `layer.match(req.path)` until a matching layer is found.",
        codeExample: `// Peeking into Express internals (for architectural insight)
const express = require('express');
const app = express();

app.use(express.json());
app.get('/users/:id', (req, res) => res.send('user'));

// Inspect the compiled Layer stack
console.log(app._router.stack.map(layer => ({
  name: layer.name, // 'jsonParser' or 'bound dispatch'
  regexp: layer.regexp,
  hasRoute: !!layer.route
})));`
      },
      {
        subheading: "2. The Difference Between Router Layer and Route Layer",
        explanation: "When you register a route via `app.get('/path', h1, h2)`, Express creates TWO layers: 1. A Layer in `app._router.stack` matching `/path` that points to a `Route` instance. 2. Inside that `Route` instance, another internal `route.stack` containing Layers for each handler (`h1`, `h2`). When `next('route')` is invoked inside `h1`, it tells Express to break out of the current `Route.stack` and jump back to `app._router.stack`, immediately evaluating the next route matching the URL.",
        codeExample: `// Route-level branching with next('route')
app.get('/users/:id', (req, res, next) => {
  if (req.params.id === 'special-admin') {
    // Skip remaining handlers in this Route stack!
    return next('route');
  }
  res.send('Regular user handler');
});

// Target of next('route') jump:
app.get('/users/:id', (req, res) => {
  res.send('Special Admin bypass handler');
});`
      },
      {
        subheading: "3. Path-To-Regexp Compilation & Param Population",
        explanation: "When a route string `/orgs/:orgId/teams/:teamId` is defined, `path-to-regexp` converts it into a compiled regular expression: `^\\/orgs\\/(?:([^\\/]+?))\\/teams\\/(?:([^\\/]+?))(?:\\/)?$`. It extracts parameter descriptors `[{ name: 'orgId' }, { name: 'teamId' }]`. When a request matches the regex, `layer.params` extracts the captured regex groups by index and binds them into `req.params = { orgId: match[1], teamId: match[2] }`.",
        codeExample: `// Dynamic parameter binding
const router = express.Router({ mergeParams: true });

// mergeParams preserves parent route params across nested routers
// Parent: /orgs/:orgId -> Child: /projects/:projectId
// Final req.params contains both: { orgId: '...', projectId: '...' }`
      }
    ],
    edgeCasesAndPitfalls: [
      "Mounting routers with regex special characters without proper escaping throws compilation errors in path-to-regexp v8.",
      "Calling `next('route')` from middleware mounted via `app.use()` does nothing useful; it only works inside verb handlers (`app.get`, `app.post`) bound to a `Route`.",
      "Overusing deep router nesting (`router.use('/a', r1.use('/b', r2...))`) incurs O(N) regex evaluation overhead on every single HTTP request."
    ],
    keyTakeaways: [
      "Express routes and middleware are stored in a flat sequential Array of Layers.",
      "Route matching is strictly sequential; declare specific routes before parameterized catch-alls.",
      "Use `next('route')` to bypass remaining handlers in a route, and `mergeParams: true` to pass parent params to child routers."
    ]
  },
  {
    id: "exp-deep-02",
    title: "The Complete Onion Middleware Lifecycle & Next Dispatch Loop",
    category: "Middleware Architecture",
    readTimeMinutes: 15,
    overview: "Express is often described as an 'onion' or pipeline of middleware functions. While Koa uses true coroutine-based onion unwinding with `await next()`, Express uses callback-based continuation passing. Understanding how the recursive `next()` function operates, how headers commit, and how to safely run downstream logic is vital for building interceptors, timers, and telemetry.",
    diagram: `+-------------------------------------------------------------------------+
|                  EXPRESS ONION EXECUTION & DISPATCH LOOP                |
+-------------------------------------------------------------------------+
|                                                                         |
|  Incoming HTTP Request ---> [ Layer 1: Logger Middleware ]              |
|                                     |                                   |
|                                     v next()                            |
|                             [ Layer 2: Auth Guard ]                     |
|                                     |                                   |
|                                     v next()                            |
|                             [ Layer 3: Controller Handler ]             |
|                                     |                                   |
|                                     v res.json() (Headers & Body Sent)  |
|                                                                         |
|  Outgoing HTTP Response <--- [ Socket write chunk & FIN ]               |
|                                                                         |
|  Post-Response Cleanup / Interceptors (via on-headers / on-finished)    |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Recursive next() Dispatch Loop",
        explanation: "Internally, Express's router defines `function next(err) { ... }`. When a middleware calls `next()`, it increments an internal pointer `idx++`, extracts `const layer = stack[idx]`, and executes `layer.handle_request(req, res, next)`. If an error argument is provided (`next(new Error())`), Express jumps past all normal 3-argument middlewares, scanning until it finds a layer whose `handle.length === 4` (error middleware).",
        codeExample: `// Simplified conceptual model of Express router next loop
function dispatch(req, res, stack) {
  let idx = 0;
  function next(err) {
    if (idx >= stack.length) return; // End of chain
    const layer = stack[idx++];
    
    if (err) {
      // Error mode: find 4-arg error handler
      if (layer.handle.length === 4) {
        return layer.handle(err, req, res, next);
      }
      return next(err); // Skip normal middleware
    }
    
    // Normal mode: find 3-arg middleware
    if (layer.handle.length < 4) {
      return layer.handle(req, res, next);
    }
    next(); // Skip error middleware
  }
  next();
}`
      },
      {
        subheading: "2. The Limitation of await next() in Express vs Koa",
        explanation: "In Koa, writing `await next()` pauses the current middleware until downstream handlers return, executing post-handler code seamlessly. In Express 4, `next()` does NOT return a Promise; calling `await next()` does NOT guarantee that the response has completed before downstream execution resumes. To run post-response logic in Express, developers must hook into `res.on('finish')` or use libraries like `on-headers` and `on-finished`.",
        codeExample: `// PROPER WAY to measure response latency in Express:
app.use((req, res, next) => {
  const startHrTime = process.hrtime.bigint();

  // res.on('finish') fires when response chunks are fully written to TCP socket
  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startHrTime;
    const elapsedMs = Number(elapsedNs) / 1e6;
    console.log(\`[\${req.method}] \${req.originalUrl} - \${res.statusCode} (\${elapsedMs.toFixed(2)}ms)\`);
  });

  next();
});`
      },
      {
        subheading: "3. Double Next and Mutated State Corruption",
        explanation: "Calling `next()` multiple times inside a single middleware function causes catastrophic race conditions. The downstream stack executes twice for a single request, triggering duplicate database mutations, duplicated response transmissions, and `ERR_HTTP_HEADERS_SENT` crashes. Every branch in a middleware MUST conclude with either `return next()`, `return res.send()`, or `return next(err)`.",
        codeExample: `// DEADLY BUG: Missing return statement!
app.use((req, res, next) => {
  if (!req.headers['x-api-key']) {
    res.status(401).json({ error: 'Missing key' });
    // BUG: Missing return! Execution continues downward!
  }
  next(); // CRITICAL BUG: next() called even after 401 response sent!
});

// SAFE PATTERN: Always return early
app.use((req, res, next) => {
  if (!req.headers['x-api-key']) {
    return res.status(401).json({ error: 'Missing key' });
  }
  return next();
});`
      }
    ],
    edgeCasesAndPitfalls: [
      "Calling `next()` after sending `res.json()` causes downstream middleware to attempt writing to a closed socket.",
      "Assuming `next()` returns a promise in Express 4 results in broken execution order when using `await next()`.",
      "Mutating `req` properties without cloning can cause unexpected side effects if downstream middlewares mutate the same object."
    ],
    keyTakeaways: [
      "Express uses continuation-passing callbacks, not async coroutines; use `res.on('finish')` for post-response logic.",
      "Always prefix middleware exits with `return` (`return next()`, `return res.json()`).",
      "Passing any argument to `next(arg)` switches the dispatch engine into error mode, bypassing normal handlers."
    ]
  },
  {
    id: "exp-deep-03",
    title: "Advanced Async Control Flow & Express 4 vs 5 Error Handling Engine",
    category: "Error Architecture",
    readTimeMinutes: 16,
    overview: "Asynchronous error handling has historically been Express's most prominent vulnerability. An unhandled promise rejection in Express 4 bypasses the error pipeline, causing silent memory leaks or process crashes. This chapter contrasts Express 4's monkey-patching workarounds with Express 5's native promise rejection engine and analyzes modern operational error design.",
    diagram: `+-------------------------------------------------------------------------+
|                  EXPRESS 4 VS EXPRESS 5 ASYNC ERROR ROUTING             |
+-------------------------------------------------------------------------+
|                                                                         |
|  EXPRESS 4 (Async Failure Pitfall):                                     |
|  async (req, res, next) => { throw new Error('DB Down'); }              |
|        |                                                                |
|        v Returns rejected Promise                                       |
|  [ Express 4 ignores returned Promise ]                                 |
|        |                                                                |
|        v                                                                |
|  [ UnhandledPromiseRejection ] ---> Process CRASH (Node v16+)          |
|                                                                         |
|  ---------------------------------------------------------------------  |
|                                                                         |
|  EXPRESS 5 (Native Promise Inspection):                                 |
|  async (req, res, next) => { throw new Error('DB Down'); }              |
|        |                                                                |
|        v Returns rejected Promise                                       |
|  [ Express 5: Promise.resolve(fn()).catch(next) ]                       |
|        |                                                                |
|        v Automatically caught!                                          |
|  [ app.use((err, req, res, next) => ...) ] ---> Clean HTTP 500 Response |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Under-the-Hood Promise Detection in Express 5",
        explanation: "Express 5 completely rewrote the internal handler execution inside `router/layer.js`. In Express 4, the handler was invoked as `fn(req, res, next)`. In Express 5, the execution evaluates whether the return value is a thenable: `if (val && typeof val.then === 'function') { val.catch(next); }`. This single architectural change guarantees that all native async errors, rejected promises, and unhandled rejections inside route handlers automatically divert into the 4-argument error pipeline.",
        codeExample: `// Express 4 Polyfill Pattern:
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Required in Express 4:
app.get('/users', asyncHandler(async (req, res) => {
  const users = await db.query('SELECT * FROM users');
  res.json(users);
}));

// Express 5: Native, zero-wrapper code!
app.get('/users', async (req, res) => {
  const users = await db.query('SELECT * FROM users');
  res.json(users);
});`
      },
      {
        subheading: "2. The isOperational Error Pattern & Crash Policy",
        explanation: "Enterprise systems distinguish between Operational Errors (runtime failures: bad input, expired tokens, 404s, DB timeouts) and Programmer Bugs (type errors, syntax bugs, memory corruption). Custom error classes mark operational errors with `this.isOperational = true`. The central error handler inspects this flag: operational errors receive graceful HTTP error responses, whereas programmer bugs trigger alerts, heap captures, and scheduled process termination to prevent data corruption.",
        codeExample: `class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Global Central Error Handler
app.use((err, req, res, next) => {
  if (err.isOperational) {
    // Known operational anomaly: return safe response
    return res.status(err.statusCode).json({
      status: 'fail',
      message: err.message
    });
  }

  // Programmer Bug / Infrastructure Failure
  logger.fatal({ err, reqId: req.id }, 'CRITICAL UNEXPECTED EXCEPTION');

  // Generic 500: Never leak stack traces or internals in production
  res.status(500).json({ status: 'error', message: 'Internal Server Error' });

  // Initiate graceful restart if process state is tainted
  // restartWorker();
});`
      },
      {
        subheading: "3. Handling Mid-Stream Failures (res.headersSent)",
        explanation: "When an error occurs halfway through streaming a large file or SSE response, HTTP status 200 headers have already been sent down the TCP wire. Calling `res.status(500).json(...)` at this point throws `ERR_HTTP_HEADERS_SENT`. The error middleware must check `if (res.headersSent) return next(err);`. Express's default fallback handler intercepts this and destroys the underlying socket, signaling the client that the transfer failed.",
        codeExample: `app.use((err, req, res, next) => {
  // CRUCIAL: Check if HTTP headers are already committed
  if (res.headersSent) {
    return next(err); // Delegates to default handler to destroy TCP socket
  }

  res.status(err.statusCode || 500).json({ error: err.message });
});`
      }
    ],
    edgeCasesAndPitfalls: [
      "Relying on `express-async-errors` in Express 5 can cause unexpected double-wrapped handlers; remove the package when migrating.",
      "Throwing errors inside asynchronous callback functions (e.g. `fs.readFile(path, (err, data) => { throw err; })`) escapes both Express 4 and 5; callbacks must call `next(err)` explicitly.",
      "Swallowing errors inside dangling `.catch(() => {})` blocks prevents error telemetry from ever capturing critical failures."
    ],
    keyTakeaways: [
      "Express 5 natively intercepts rejected promises and routes them to error middleware.",
      "Differentiate operational errors from programmer bugs with an `isOperational` flag.",
      "Always check `if (res.headersSent) return next(err)` to prevent `ERR_HTTP_HEADERS_SENT` crashes during streams."
    ]
  },
  {
    id: "exp-deep-04",
    title: "Hardened Production Security Matrix (OWASP Top 10 in Express)",
    category: "Security Engineering",
    readTimeMinutes: 18,
    overview: "Express is deliberately minimal out of the box, shipping with zero default security headers, no rate limiting, and permissive query parsing. In production, building a resilient API requires systematically hardening the application against the OWASP Top 10 vulnerabilities: injection, broken authentication, parameter pollution, XSS, and SSRF.",
    diagram: `+-------------------------------------------------------------------------+
|                  EXPRESS PRODUCTION DEFENSE-IN-DEPTH MATRIX             |
+-------------------------------------------------------------------------+
|                                                                         |
|  Incoming HTTP Request                                                  |
|       |                                                                 |
|       v                                                                 |
|  [ 1. Network Boundary: Reverse Proxy / Cloudflare CDN ]                 |
|       | (DDoS Mitigation, TLS Termination, WAF)                          |
|       v                                                                 |
|  [ 2. HTTP Header Hardening: helmet() ]                                 |
|       | (HSTS, CSP, X-Frame-Options: DENY, X-Content-Type: nosniff)     |
|       v                                                                 |
|  [ 3. Origin Defense: cors() ]                                          |
|       | (Explicit Whitelists, Preflight OPTIONS, Disallowing * with Auth)|
|       v                                                                 |
|  [ 4. Traffic Throttling: express-rate-limit + Redis ]                  |
|       | (Sliding Window Limits per IP / User ID, Brute-Force Shields)   |
|       v                                                                 |
|  [ 5. Input Sanitization: hpp() + express-mongo-sanitize ]              |
|       | (HTTP Parameter Pollution Defense, NoSQL Operator Stripping)    |
|       v                                                                 |
|  [ 6. Schema Assertion: Zod validation ]                                |
|       | (Fail-Fast 400 Bad Request, Mass-Assignment Field Stripping)    |
|       v                                                                 |
|  [ 7. Data Access: Parameterized Queries ($1, $2) ]                     |
|       | (Zero Raw SQL Concatenation, Complete SQL Injection Immunity)   |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Helmet Suite & Content Security Policy (CSP)",
        explanation: "Helmet injects critical defensive headers into every HTTP response. Among these, `Content-Security-Policy` (CSP) is the single most powerful defense against Cross-Site Scripting (XSS). It defines strict whitelists of trusted domains from which scripts, styles, fonts, and media can execute. For modern Single Page Applications (SPAs) and server-rendered views, generating cryptographic nonces per request allows authorized inline scripts while blocking any injected attacker scripts.",
        codeExample: `const helmet = require('helmet');

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", (req, res) => \`'nonce-\${res.locals.nonce}'\`],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https://cdn.myapp.com'],
      objectSrc: ["'none'"], // Completely disables vulnerable plugins (Flash/Java)
      upgradeInsecureRequests: [] // Rewrites HTTP URLs to HTTPS
    }
  },
  hsts: {
    maxAge: 31536000, // Enforces HTTPS for 1 year
    includeSubDomains: true,
    preload: true
  }
}));`
      },
      {
        subheading: "2. CORS Preflights and Credential Traps",
        explanation: "CORS is a browser security mechanism, not a firewall. When a web frontend on `https://app.com` makes an authenticated fetch to `https://api.com`, the browser issues a preflight `OPTIONS` request. A catastrophic security vulnerability occurs when servers use `origin: true` or reflect the incoming `Origin` header dynamically while setting `credentials: true`. This permits ANY malicious website to make cross-origin authenticated requests and read responses.",
        codeExample: `const cors = require('cors');

const ALLOWED_ORIGINS = new Set([
  'https://dashboard.myapp.com',
  'https://portal.myapp.com'
]);

app.use(cors({
  origin: (origin, callback) => {
    // Block requests with invalid origins when credentials are sent
    if (!origin || ALLOWED_ORIGINS.has(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Disallowed by CORS security policy'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  maxAge: 86400 // Cache preflight response for 24h
}));`
      },
      {
        subheading: "3. Distributed Rate Limiting with Redis Sliding Windows",
        explanation: "In-memory rate limiters fail in containerized environments: 10 Kubernetes pods mean 10 isolated counters, granting an attacker 10x the allowed attempts. Furthermore, fixed-window rate limiters suffer from the 'burst at the boundary' flaw (where an attacker sends max requests at 00:59 and another max at 01:01). A distributed sliding window algorithm in Redis records timestamps in sorted sets (`ZADD`, `ZREMRANGEBYSCORE`), enforcing mathematically accurate rates across all instances.",
        codeExample: `const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { createClient } = require('redis');

const redisClient = createClient({ url: process.env.REDIS_URL });

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 failed attempts per IP
  standardHeaders: true, // Return RateLimit-* headers
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:auth:'
  }),
  message: { error: 'Too many attempts. Please try again in 15 minutes.' }
});`
      }
    ],
    edgeCasesAndPitfalls: [
      "Using `cors({ origin: '*' })` with `credentials: true` will be rejected by browsers, but `origin: (o, cb) => cb(null, o)` bypasses the browser check while opening a severe security hole.",
      "Leaving `x-powered-by: Express` enabled exposes framework fingerprints to automated CVE vulnerability scanners.",
      "Validating input only on the frontend without server-side schema guards leaves your database open to direct API manipulation via curl/Postman."
    ],
    keyTakeaways: [
      "Apply `helmet()` before all route handlers to establish strict browser defense boundaries.",
      "Never reflect untrusted origins with `credentials: true` in CORS configurations.",
      "Use distributed Redis stores for rate limiting to synchronize quotas across containerized replicas."
    ]
  },
  {
    id: "exp-deep-05",
    title: "High-Throughput Streaming, Chunking & Memory-Safe Backpressure",
    category: "Streams & Performance",
    readTimeMinutes: 16,
    overview: "Handling multi-gigabyte file downloads, exports, or live audio/video streams in Express without consuming massive memory requires understanding Node.js Streams and the TCP backpressure mechanism. Express's `res` object implements `WritableStream`. Mismanaging streams leads to catastrophic memory spikes and Out-Of-Memory (OOM) crashes.",
    diagram: `+-------------------------------------------------------------------------+
|                  EXPRESS STREAMING & TCP BACKPRESSURE                   |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ File / DB Cursor ReadableStream ]                                    |
|          | (highWaterMark = 64KB chunks)                                |
|          v                                                              |
|  [ res.write(chunk) ] ----------------------------------------------+   |
|          |                                                          |   |
|          | Returns true (Socket buffer has space)                   |   |
|          v                                                          |   |
|  [ Network Socket pushes bytes to Client ]                          |   |
|                                                                     |   |
|  SLOW CLIENT SCENARIO:                                              |   |
|  Network buffer fills up!                                           |   |
|  res.write(chunk) returns FALSE!                                    |   |
|          |                                                          |   |
|          v                                                          |   |
|  [ BACKPRESSURE TRIGGERED: readableStream.pause() ]                 |   |
|          | (Halts reading from disk / DB, protecting RAM!)          |   |
|          v                                                          |   |
|  [ Socket emits 'drain' event once buffer empties ]                 |   |
|          |                                                          |   |
|          v                                                          |   |
|  [ readableStream.resume() ] (Resumes streaming)                    |   |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Backpressure Mechanism in Express Responses",
        explanation: "When you read data from a fast source (a local SSD or database cursor) and send it over the network to a slow mobile client, data accumulates in Node's memory if reading outpaces sending. `res.write(chunk)` returns `false` when internal socket write buffers exceed `highWaterMark`. If you ignore this return value, Node buffers the excess chunks in V8 heap memory until the process crashes with `JavaScript heap out of memory`. Using `stream.pipeline` manages backpressure automatically.",
        codeExample: `const fs = require('fs');
const { pipeline } = require('stream/promises');

app.get('/api/export/archive.zip', async (req, res, next) => {
  const archivePath = '/var/data/big_archive.zip';

  res.set({
    'Content-Type': 'application/zip',
    'Content-Disposition': 'attachment; filename="archive.zip"'
  });

  const sourceStream = fs.createReadStream(archivePath);

  try {
    // pipeline handles backpressure, pauses source on slow client,
    // and cleans up descriptors automatically!
    await pipeline(sourceStream, res);
  } catch (err) {
    if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      next(err);
    }
  }
});`
      },
      {
        subheading: "2. Streaming Database Cursors (Postgres & Mongo)",
        explanation: "Fetching 100,000 rows with `SELECT * FROM transactions` into a JavaScript array deserializes 100,000 JSON objects into V8 memory, causing a massive GC pause. Using streaming cursors (like `pg-query-stream`), rows are fetched in small batches (e.g. 500 rows at a time), transformed into CSV or JSON lines, and streamed straight to the client with flat, near-zero memory consumption.",
        codeExample: `const QueryStream = require('pg-query-stream');
const { Transform } = require('stream');

app.get('/api/transactions/csv', async (req, res, next) => {
  const client = await pool.connect();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');

  const query = new QueryStream('SELECT id, amount, created_at FROM transactions');
  const stream = client.query(query);

  // Transform stream formatting rows to CSV lines
  const csvTransformer = new Transform({
    objectMode: true,
    transform(row, encoding, callback) {
      callback(null, \`\${row.id},\${row.amount},\${row.created_at.toISOString()}\\n\`);
    }
  });

  stream.on('end', () => client.release());
  stream.on('error', (err) => {
    client.release();
    if (!res.headersSent) res.status(500).send('Export failed');
  });

  stream.pipe(csvTransformer).pipe(res);
});`
      },
      {
        subheading: "3. AbortController & Client Disconnect Cleanup",
        explanation: "If a user closes their browser tab or cancels a fetch request mid-stream, Node emits `'close'` on the request object. If the server does not listen for this event, the database cursor and CPU-intensive file generation will keep running pointlessly. Wiring `req.on('close')` to an `AbortController` stops background work instantly when clients abort.",
        codeExample: `app.get('/api/ai/stream-completion', async (req, res) => {
  const abortController = new AbortController();

  req.on('close', () => {
    if (!res.writableEnded) {
      console.log('Client canceled stream. Aborting downstream AI generation.');
      abortController.abort();
    }
  });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');

  try {
    const aiStream = await llmClient.stream({ prompt: req.query.prompt, signal: abortController.signal });
    for await (const chunk of aiStream) {
      res.write(\`data: \${JSON.stringify({ text: chunk })}\\n\\n\`);
    }
    res.end();
  } catch (err) {
    if (err.name !== 'AbortError') throw err;
  }
});`
      }
    ],
    edgeCasesAndPitfalls: [
      "Using `fs.readFile` instead of streams loads entire multi-gigabyte files into V8 heap, causing server crashes under concurrent traffic.",
      "Failing to release database pool clients when stream errors occur permanently leaks database connections.",
      "Attempting to call `res.status(500)` after a stream has started will throw `ERR_HTTP_HEADERS_SENT`."
    ],
    keyTakeaways: [
      "Always use `stream.pipeline` instead of raw `.pipe()` to ensure proper error and premature-close cleanup.",
      "Use streaming database cursors to export large datasets with constant, minimal memory consumption.",
      "Listen for `req.on('close')` to abort downstream work when clients disconnect prematurely."
    ]
  },
  {
    id: "exp-deep-06",
    title: "Multi-Tenant SaaS Architecture: Subdomains, Header Routing & Dynamic Scoping",
    category: "Enterprise Architecture",
    readTimeMinutes: 17,
    overview: "Building multi-tenant B2B SaaS in Express requires bulletproof tenant isolation. A single software instance serves thousands of organizations while ensuring zero cross-tenant data leakage. This chapter breaks down subdomain extraction, dynamic database connection switching, PostgreSQL `search_path` schema isolation, and context propagation using `AsyncLocalStorage`.",
    diagram: `+-------------------------------------------------------------------------+
|                  EXPRESS MULTI-TENANT ISOLATION ARCHITECTURE            |
+-------------------------------------------------------------------------+
|                                                                         |
|  Incoming Request: https://acme.enterprise.com/api/invoices             |
|                                                                         |
|  [ 1. Tenant Resolution Middleware ]                                    |
|  - Extracts Subdomain: 'acme'                                           |
|  - DB Lookup: Resolves Tenant Metadata (id: 't_99', schema: 'tenant_acme')|
|  - Asserts Tenant Status (Active / Paid / Not Suspended)                |
|                                                                         |
|  [ 2. Context Storage: AsyncLocalStorage.run() ]                         |
|  - Stores Tenant Context for the duration of this async execution tree   |
|                                                                         |
|  [ 3. Dynamic Database Scoping ]                                        |
|  +-------------------------------------------------------------------+  |
|  | Strategy A: Schema-per-Tenant (PostgreSQL)                        |  |
|  | - Automatically executes: SET search_path TO "tenant_acme"         |  |
|  |-------------------------------------------------------------------|  |
|  | Strategy B: Discriminator Column (Shared Schema)                   |  |
|  | - Repository automatically appends: WHERE tenant_id = 't_99'     |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  [ 4. Response Dispatch ]                                               |
|  - Clean isolation guaranteed: Zero cross-tenant data exposure!         |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Subdomain and Header Extraction Mechanics",
        explanation: "Express provides `req.subdomains`, an array of subdomains ordered from closest to furthest (e.g. `['acme', 'portal']` for `acme.portal.domain.com`). In multi-tenant systems, tenant resolution middleware verifies the subdomain, cross-references it against cache or master database, and asserts that the authenticated user possesses valid credentials for that specific tenant.",
        codeExample: `function resolveTenant(tenantCache) {
  return async (req, res, next) => {
    // 1. Resolve tenant key from subdomain or B2B API header
    const host = req.get('host') || '';
    const subdomain = host.split('.')[0];
    const tenantKey = req.get('X-Tenant-ID') || subdomain;

    if (!tenantKey || ['www', 'api', 'app'].includes(tenantKey)) {
      return res.status(400).json({ error: 'Tenant identifier required' });
    }

    // 2. Fetch tenant metadata
    const tenant = await tenantCache.get(tenantKey);
    if (!tenant || !tenant.isActive) {
      return res.status(404).json({ error: 'Tenant not found or inactive' });
    }

    // 3. User tenant membership assertion
    if (req.user && !req.user.tenantIds.includes(tenant.id)) {
      return res.status(403).json({ error: 'Unauthorized access to this tenant' });
    }

    req.tenant = tenant;
    next();
  };
}`
      },
      {
        subheading: "2. AsyncLocalStorage for Ambient Tenant Propagation",
        explanation: "Drilling `tenantId` through 5 layers of service and repository function arguments (`orderService.create(data, tenantId)`) introduces brittle, error-prone code. Using Node.js's native `AsyncLocalStorage`, the tenant context is bound once in middleware and remains globally accessible across all downstream async calls within that request without argument drilling.",
        codeExample: `const { AsyncLocalStorage } = require('async_hooks');
const tenantStorage = new AsyncLocalStorage();

// Tenant Context Middleware
app.use((req, res, next) => {
  if (!req.tenant) return next();

  // Run the rest of the request within this async context store
  tenantStorage.run({ tenantId: req.tenant.id, schema: req.tenant.schemaName }, () => {
    next();
  });
});

// Deep inside a Repository (no req or tenantId passed!):
class InvoiceRepository {
  async listInvoices() {
    const store = tenantStorage.getStore();
    if (!store) throw new Error('No tenant context found');

    // Scoped query automatically isolated!
    return db.query('SELECT * FROM invoices WHERE tenant_id = $1', [store.tenantId]);
  }
}`
      },
      {
        subheading: "3. PostgreSQL Dynamic Schema Isolation (search_path)",
        explanation: "In enterprise SaaS, schema-per-tenant provides physical separation of tables. When a tenant client is checked out from the pool, the application executes `SET search_path TO \"tenant_<id>\"`. CRITICAL WARNING: When returning the connection back to the pool, `RESET search_path` must be executed to prevent connection poisoning where subsequent requests reuse the tainted search path.",
        codeExample: `async function withTenantClient(pool, schemaName, callback) {
  const client = await pool.connect();
  try {
    // Set tenant schema search path
    await client.query(\`SET search_path TO "\${schemaName}", public\`);
    return await callback(client);
  } finally {
    // CRITICAL: Reset search_path before returning connection to pool!
    await client.query('RESET search_path');
    client.release();
  }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Failing to call `RESET search_path` on pooled database connections causes connection poisoning where other tenants see wrong data.",
      "Relying solely on client-supplied `X-Tenant-ID` headers without verifying authenticated user membership allows simple IDOR tenant hopping.",
      "Overusing schema-per-tenant on systems with 50,000+ tenants can exhaust database metadata cache and migration execution times."
    ],
    keyTakeaways: [
      "Combine subdomain resolution with authenticated user membership checks to prevent tenant hopping.",
      "Use `AsyncLocalStorage` to propagate tenant context across services without parameter drilling.",
      "Always reset search_path or connection state when using pooled connections with dynamic schemas."
    ]
  },
  {
    id: "exp-deep-07",
    title: "Enterprise Authentication Architecture: Token Rotation, HttpOnly Cookies & Session Fixation",
    category: "Identity & Security",
    readTimeMinutes: 18,
    overview: "Modern web authentication requires balancing security against seamless user experience. Storing access tokens in localStorage exposes applications to XSS token theft, while static refresh tokens are vulnerable to replay attacks. This chapter covers the dual-token architecture with HttpOnly cookies, automatic refresh token rotation with reuse detection, and session fixation defenses.",
    diagram: `+-------------------------------------------------------------------------+
|                  ENTERPRISE TOKEN ROTATION & REUSE DETECTION            |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ Client SPA ]                                                         |
|  - Holds Access Token in memory (15-min expiry)                         |
|  - Refresh Token stored in Secure HttpOnly Cookie (7-day expiry)        |
|                                                                         |
|  TOKEN REFRESH CYCLE:                                                   |
|  1. POST /api/auth/refresh (Cookie automatically sent)                  |
|  2. Server verifies Refresh Token signature                            |
|  3. Server checks DB: Is token active or already consumed?              |
|                                                                         |
|  NORMAL PATH (Legitimate User):                                         |
|  - Token marked consumed/revoked                                        |
|  - Fresh Access Token + Fresh Refresh Token issued                      |
|  - New Refresh Token set in HttpOnly cookie                             |
|                                                                         |
|  ATTACK SCENARIO (Token Reuse Detected!):                               |
|  - Attacker attempts to use an already-consumed Refresh Token!          |
|  - REUSE DETECTION TRIGGERED!                                           |
|  - Server invalidates ENTIRE token family (all sessions for user revoked)|
|  - Attacker AND legitimate user logged out; security alert logged.      |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The In-Memory + HttpOnly Cookie Architecture",
        explanation: "Storing JWTs in `localStorage` or `sessionStorage` allows any Cross-Site Scripting (XSS) vulnerability to instantly exfiltrate tokens. The industry standard pattern:\n1. Short-lived Access Token (10-15 mins): Kept in JavaScript runtime memory only. If an XSS occurs, the token expires quickly.\n2. Long-lived Refresh Token (7-30 days): Stored in a `HttpOnly`, `Secure`, `SameSite=Strict` cookie, completely inaccessible to browser JavaScript.",
        codeExample: `// Issuing hardened auth cookies
res.cookie('refreshToken', refreshToken, {
  httpOnly: true, // Immune to document.cookie XSS theft
  secure: process.env.NODE_ENV === 'production', // Transmitted via HTTPS only
  sameSite: 'strict', // Immune to cross-site request forgery
  path: '/api/auth', // Scoped exclusively to the auth endpoint
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});`
      },
      {
        subheading: "2. Refresh Token Rotation and Reuse Detection",
        explanation: "In Refresh Token Rotation (RTR), every time a refresh token is used to issue a new access token, the refresh token itself is invalidated and replaced with a brand new one. If an attacker intercepts a refresh token and uses it, both the attacker and the victim now possess copies of that token family. When the legitimate user later tries to refresh using their old token, the server detects that the token was already consumed: this indicates token theft, triggering immediate revocation of all active tokens for that user account.",
        codeExample: `app.post('/api/auth/refresh', async (req, res) => {
  const incomingToken = req.cookies.refreshToken;
  if (!incomingToken) return res.status(401).json({ error: 'No refresh token' });

  const tokenRecord = await tokenDb.find(incomingToken);

  // REUSE DETECTION: Has this token already been used?
  if (tokenRecord && tokenRecord.isUsed) {
    console.error(\`[SECURITY BREACH] Token reuse detected for user \${tokenRecord.userId}!\`);
    // Invalidate ALL tokens in this family immediately!
    await tokenDb.revokeAllFamilyTokens(tokenRecord.familyId);
    res.clearCookie('refreshToken');
    return res.status(403).json({ error: 'Compromised session. Please re-authenticate.' });
  }

  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  // Mark current token consumed
  await tokenDb.markUsed(incomingToken);

  // Issue brand new token pair in the same family
  const newAccessToken = generateAccessToken(tokenRecord.userId);
  const newRefreshToken = generateRefreshToken(tokenRecord.userId, tokenRecord.familyId);
  await tokenDb.save(newRefreshToken);

  res.cookie('refreshToken', newRefreshToken, cookieOptions);
  res.json({ accessToken: newAccessToken });
});`
      },
      {
        subheading: "3. Session Fixation Defense in Stateful Sessions",
        explanation: "When using stateful sessions (`express-session`), an attacker can obtain a valid session ID from the application, trick a victim into authenticating using that session ID (via phishing link or cookie manipulation), and then hijack the authenticated session. Defense: ALWAYS regenerate the session ID via `req.session.regenerate()` immediately upon privilege elevation or successful login.",
        codeExample: `app.post('/api/auth/login', async (req, res, next) => {
  const user = await authService.validateUser(req.body.email, req.body.password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  // PREVENT SESSION FIXATION: Destroy pre-auth session and regenerate ID!
  req.session.regenerate((err) => {
    if (err) return next(err);

    req.session.userId = user.id;
    req.session.userRole = user.role;

    req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      res.json({ success: true, user: { id: user.id, email: user.email } });
    });
  });
});`
      }
    ],
    edgeCasesAndPitfalls: [
      "Storing refresh tokens in localStorage bypasses all HttpOnly protections, making complete account takeover trivial via XSS.",
      "Failing to regenerate session IDs upon login leaves the door wide open to Session Fixation exploits.",
      "Race conditions in SPAs: multiple simultaneous API calls when an access token expires can trigger multiple refresh requests; use token refresh mutex locking on the frontend."
    ],
    keyTakeaways: [
      "Keep short-lived access tokens in JS memory and long-lived refresh tokens in HttpOnly, SameSite=Strict cookies.",
      "Implement Refresh Token Rotation with token family tracking to detect and invalidate compromised sessions.",
      "Always call `req.session.regenerate()` upon login to defeat Session Fixation attacks."
    ]
  },
  {
    id: "exp-deep-08",
    title: "Resilient Database Lifecycles: Connection Pooling, Transactions & Leak Prevention",
    category: "Database Engineering",
    readTimeMinutes: 17,
    overview: "Database connection issues are the #1 cause of unhandled Express outages. Connecting to databases on every request destroys throughput; conversely, improper connection release in error handlers permanently exhausts connection pools. This chapter details pool lifecycle management, transaction boundaries, and programmatic leak detection.",
    diagram: `+-------------------------------------------------------------------------+
|                  CONNECTION POOLING & TRANSACTION ISOLATION             |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ Express Worker ]                                                     |
|          |                                                              |
|          v                                                              |
|  [ PostgreSQL Pool Manager ] (max: 20 connections)                     |
|  +-------------------------------------------------------------------+  |
|  | Idle Connections: [ C1, C2, C3, C4 ]                              |  |
|  | Active Connections: [ C5 (Query), C6 (Transaction) ]              |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  TRANSACTION LIFECYCLE:                                                 |
|  1. client = await pool.connect() (Dedicated checkout)                 |
|  2. try {                                                               |
|        await client.query('BEGIN');                                     |
|        await repoA.mutate(client);                                      |
|        await repoB.mutate(client);                                      |
|        await client.query('COMMIT');                                    |
|     } catch (err) {                                                     |
|        await client.query('ROLLBACK');                                  |
|        throw err;                                                       |
|     } finally {                                                         |
|        client.release(); // MANDATORY: Returns client to pool!          |
|     }                                                                   |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Pool Sizing Equation and Queuing Physics",
        explanation: "A common mistake is setting connection pool size too high (e.g. `max: 100`). PostgreSQL spawns a separate OS process per connection. Having 100 active connections causes severe OS context switching, degrading throughput. The PostgreSQL optimal formula:\n`connections = ((core_count * 2) + effective_spindle_count)`.\nA pool of 15-25 well-managed connections can easily serve 10,000+ requests per second in Express when queries are indexed and fast.",
        codeExample: `const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Strict maximum connection limit
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000 // Throw error if connection cannot be acquired in 5s
});

// Diagnostic monitoring of pool health
setInterval(() => {
  console.log({
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount // If > 0, requests are bottlenecking on DB connections!
  });
}, 10000).unref();`
      },
      {
        subheading: "2. The Transaction Runner Pattern",
        explanation: "To execute ACID transactions reliably without repeating boilerplate `BEGIN/COMMIT/ROLLBACK/release` in every service, encapsulate the lifecycle in a higher-order transaction runner. The runner guarantees that: 1. A client is checked out. 2. `BEGIN` executes. 3. The transaction commits on success. 4. `ROLLBACK` executes on failure. 5. The connection is released in `finally` unconditionally.",
        codeExample: `async function runInTransaction(pool, operation) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await operation(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // Guarantees release even on thrown exceptions or unhandled errors!
  }
}

// Clean usage in business service:
app.post('/api/checkout', async (req, res, next) => {
  try {
    const order = await runInTransaction(pool, async (client) => {
      const reservation = await inventoryRepo.reserve(client, req.body.items);
      const invoice = await billingRepo.create(client, req.body.payment);
      return { reservation, invoice };
    });
    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});`
      },
      {
        subheading: "3. Connection Leak Diagnostics & Detection",
        explanation: "A connection leak occurs when code checks out a client (`pool.connect()`) but an unhandled exception or early `return` bypasses `client.release()`. Over time, `pool.idleCount` drops to 0 and `pool.waitingCount` climbs indefinitely until the entire server hangs. You can diagnose leaks by attaching stack traces to checked-out clients and logging warnings if a client remains checked out for longer than 10 seconds.",
        codeExample: `// Leak detection wrapper for debugging environments
const originalConnect = pool.connect.bind(pool);
pool.connect = async () => {
  const client = await originalConnect();
  const checkoutStack = new Error().stack;
  
  const timer = setTimeout(() => {
    console.error('[POTENTIAL CONNECTION LEAK] Client checked out > 10s! Checkout origin:\\n', checkoutStack);
  }, 10000);

  const originalRelease = client.release.bind(client);
  client.release = (err) => {
    clearTimeout(timer);
    return originalRelease(err);
  };

  return client;
};`
      }
    ],
    edgeCasesAndPitfalls: [
      "Forgetting to wrap transaction checkouts in `try...finally` guarantees a connection leak whenever an SQL error is thrown.",
      "Setting `max: 100` on 10 container replicas creates 1,000 potential connections, exceeding PostgreSQL's `max_connections` and crashing the database.",
      "Running slow third-party HTTP API calls inside an active database transaction keeps the database connection locked, starving the pool."
    ],
    keyTakeaways: [
      "Keep pool sizes conservative (15-25 connections) to minimize OS context-switching overhead.",
      "Use a centralized `runInTransaction` wrapper to enforce automatic rollback and client release.",
      "Never execute external network requests or heavy CPU tasks while holding an open database transaction."
    ]
  },
  {
    id: "exp-deep-09",
    title: "Zero-Downtime Deployment, Keep-Alive Socket Draining & Graceful Shutdown",
    category: "DevOps & Infrastructure",
    readTimeMinutes: 16,
    overview: "In containerized Kubernetes or Docker environments, rolling updates send `SIGTERM` signals to terminate old pods. Abruptly killing Express processes aborts in-flight requests, leaving users with 502 Bad Gateway errors. This chapter covers the complete graceful shutdown sequence, HTTP keep-alive socket draining, and reverse proxy timeout synchronization.",
    diagram: `+-------------------------------------------------------------------------+
|                  ZERO-DOWNTIME GRACEFUL SHUTDOWN SEQUENCE               |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ Orchestrator / Kubernetes sends SIGTERM ]                            |
|       |                                                                 |
|       v                                                                 |
|  [ 1. Update Readiness Probe: Return 503 ]                             |
|       | (Ingress / ALB removes pod from routing pool; no new traffic)    |
|       v Wait ~5 seconds for Ingress routing tables to update            |
|  [ 2. Stop Accepting New Connections: server.close() ]                 |
|       |                                                                 |
|       v                                                                 |
|  [ 3. Drain In-Flight Requests & Terminate Idle Keep-Alive Sockets ]    |
|       | - Set Connection: close on active responses                     |
|       | - Destroy idle keep-alive sockets (server.closeIdleConnections)|
|       v                                                                 |
|  [ 4. Close External Persistence Pools ]                                |
|       | - await dbPool.end()                                            |
|       | - await redisClient.quit()                                      |
|       v                                                                 |
|  [ 5. Clean Exit: process.exit(0) ]                                     |
|       |                                                                 |
|  (Watchdog Safety Timer: Forces process.exit(1) if draining takes >30s) |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Ingress Deregistration Lag Problem",
        explanation: "When Kubernetes sends `SIGTERM`, it simultaneously updates the Service endpoint list to stop routing traffic to that pod. However, updating iptables or cloud load balancer targets takes between 1 to 5 seconds. If Express closes `server.close()` immediately upon receiving `SIGTERM`, incoming requests routed during that 3-second lag receive `ECONNREFUSED` / 502 errors. The solution is an initial sleep delay before closing the HTTP server.",
        codeExample: `let isShuttingDown = false;

// Readiness check endpoint
app.get('/healthz/ready', (req, res) => {
  if (isShuttingDown) {
    // 503 signals load balancer to remove this pod immediately
    return res.status(503).json({ status: 'shutting_down' });
  }
  res.status(200).json({ status: 'ready' });
});`
      },
      {
        subheading: "2. Keep-Alive Socket Draining with server.closeIdleConnections()",
        explanation: "Modern browsers and load balancers maintain persistent HTTP Keep-Alive TCP sockets. If you call `server.close()`, the server stops accepting NEW sockets, but existing idle keep-alive sockets keep the process alive indefinitely! In Node 19+, `server.closeIdleConnections()` terminates all sockets that are not currently processing a request, allowing graceful teardown to complete in seconds.",
        codeExample: `const http = require('http');
const server = http.createServer(app);

// Keep-alive timeout synchronization for AWS ALB (ALB timeout = 60s)
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

async function handleShutdown(signal) {
  console.log(\`Received \${signal}. Initiating graceful shutdown...\`);
  isShuttingDown = true;

  // 1. Wait 5s for Kubernetes Ingress endpoints to deregister
  await new Promise(resolve => setTimeout(resolve, 5000));

  // 2. Stop accepting new connections
  server.close(async () => {
    console.log('HTTP server closed. Closing database and cache connections...');
    try {
      await dbPool.end();
      await redisClient.quit();
      console.log('Teardown complete. Clean exit.');
      process.exit(0);
    } catch (err) {
      console.error('Error during cleanup:', err);
      process.exit(1);
    }
  });

  // 3. Immediately close idle keep-alive sockets (Node.js 19+)
  if (typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }

  // 4. Safety watchdog timer: force exit if active requests hang > 25s
  setTimeout(() => {
    console.error('Shutdown timeout reached! Forcing process termination.');
    process.exit(1);
  }, 25000).unref();
}

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));`
      },
      {
        subheading: "3. Rejecting In-Flight Requests During Shutdown",
        explanation: "To encourage clients to reconnect to an alternate pod, active in-flight requests that are served during the draining phase should include the `Connection: close` header. This instructs the client's browser or proxy to close the socket immediately after receiving the response rather than attempting to send a pipelined request on the same socket.",
        codeExample: `app.use((req, res, next) => {
  if (isShuttingDown) {
    // Tell client not to reuse this socket
    res.setHeader('Connection', 'close');
  }
  next();
});`
      }
    ],
    edgeCasesAndPitfalls: [
      "Calling `process.exit(0)` immediately upon receiving `SIGTERM` kills all in-flight user requests, creating 502 errors.",
      "Omitting a safety watchdog timer can cause containers to hang forever if a single hung database query never completes.",
      "Configuring Express `keepAliveTimeout` lower than your AWS ALB or Nginx proxy timeout causes random 502 Bad Gateway race conditions."
    ],
    keyTakeaways: [
      "Wait 2-5 seconds after `SIGTERM` before calling `server.close()` to allow load balancer routing tables to update.",
      "Use `server.closeIdleConnections()` to terminate persistent keep-alive sockets cleanly.",
      "Always set a safety timeout (e.g. 25-30s) using `.unref()` to force exit if in-flight requests hang."
    ]
  },
  {
    id: "exp-deep-10",
    title: "Event Loop Lag Monitoring, CPU Starvation & Load Shedding",
    category: "Reliability & Resilience",
    readTimeMinutes: 16,
    overview: "Node.js runs your JavaScript code on a single thread. When heavy synchronous computations, massive JSON parsing, or unbounded regexes block the event loop, every concurrent user experiences catastrophic latency spikes. This chapter covers event loop lag measurement using `perf_hooks`, proactive Load Shedding to prevent server meltdowns, and offloading heavy tasks.",
    diagram: `+-------------------------------------------------------------------------+
|                  EVENT LOOP DELAY & LOAD SHEDDING ARCHITECTURE          |
+-------------------------------------------------------------------------+
|                                                                         |
|  Incoming Traffic Burst (5,000 requests/sec)                            |
|       |                                                                 |
|       v                                                                 |
|  [ monitorEventLoopDelay() ]                                            |
|  - Measures p99 Event Loop Lag every 20ms                               |
|                                                                         |
|  NORMAL LOAD (Lag < 30ms):                                              |
|  - Request proceeds through standard middleware pipeline               |
|                                                                         |
|  OVERLOAD DETECTED (Lag > 100ms!):                                      |
|  - Event loop is starved! Server is on the brink of total collapse!     |
|                                                                         |
|  [ LOAD SHEDDING ACTIVATED! ]                                           |
|  - Rejects new incoming non-critical requests immediately               |
|  - Returns HTTP 503 Service Unavailable + Retry-After: 5                |
|  - Execution cost: ~0.1ms (Fast fail-fast!)                            |
|                                                                         |
|  RESULT:                                                                |
|  - In-flight requests complete with low latency                         |
|  - Event loop recovers within seconds instead of crashing the process   |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Measuring Event Loop Delay with perf_hooks",
        explanation: "Event loop lag is the delay between when a scheduled timer callback should run and when the event loop actually gets around to executing it. Node's `perf_hooks.monitorEventLoopDelay()` samples the event loop continuously with microsecond resolution, tracking percentiles (p50, p90, p99) without imposing CPU overhead.",
        codeExample: `const { monitorEventLoopDelay } = require('perf_hooks');

// Initialize event loop histogram sampler
const histogram = monitorEventLoopDelay({ resolution: 20 });
histogram.enable();

// Periodic telemetry logging
setInterval(() => {
  const p50 = (histogram.percentile(50) / 1e6).toFixed(2);
  const p99 = (histogram.percentile(99) / 1e6).toFixed(2);
  const max = (histogram.max / 1e6).toFixed(2);

  console.log(\`[Event Loop Health] p50: \${p50}ms | p99: \${p99}ms | max: \${max}ms\`);
  histogram.reset();
}, 5000).unref();`
      },
      {
        subheading: "2. Load Shedding Middleware Implementation",
        explanation: "When a server is overloaded, accepting more work makes every single user's request time out, degrading overall system availability to 0%. Load shedding preserves system stability: when p99 event loop lag crosses a safety threshold (e.g. 80ms), the server sheds load by immediately rejecting new incoming requests with `503 Service Unavailable` and a `Retry-After` header. This allows the event loop to clear its queue and recover.",
        codeExample: `const LAG_THRESHOLD_MS = 80;

function loadShedder(req, res, next) {
  // Allow health checks to pass through unconditionally
  if (req.path.startsWith('/healthz')) return next();

  const p99LagMs = histogram.percentile(99) / 1e6;

  if (p99LagMs > LAG_THRESHOLD_MS) {
    console.warn(\`[LOAD SHEDDING] Event loop lag \${p99LagMs.toFixed(1)}ms > \${LAG_THRESHOLD_MS}ms. Shedding request.\`);

    // Signal client/proxy to back off
    res.setHeader('Retry-After', '3');
    return res.status(503).json({
      error: 'Service Overloaded',
      message: 'Server is temporarily shedding load to maintain stability. Please retry shortly.'
    });
  }

  next();
}

app.use(loadShedder);`
      },
      {
        subheading: "3. Offloading CPU-Bound Work: Worker Threads & Child Processes",
        explanation: "Never execute heavy CPU tasks (PDF generation, image resizing, complex encryption, machine learning inference) on the main Express event loop thread. Doing so blocks the loop, freezing all concurrent requests. Offload heavy workloads to `worker_threads` (shared memory pool) or background task queues (BullMQ with Redis).",
        codeExample: `const { Worker } = require('worker_threads');

function runCpuTaskInWorker(workerData) {
  return new Promise((resolve, reject) => {
    const worker = new Worker('./workers/computeWorker.js', { workerData });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(\`Worker stopped with exit code \${code}\`));
    });
  });
}

app.post('/api/generate-pdf', async (req, res, next) => {
  try {
    // Non-blocking: Executes on dedicated background thread!
    const pdfBuffer = await runCpuTaskInWorker(req.body);
    res.setHeader('Content-Type', 'application/pdf');
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});`
      }
    ],
    edgeCasesAndPitfalls: [
      "Parsing huge JSON payloads (e.g. 50MB files) via `JSON.parse` is synchronous and completely freezes the event loop for hundreds of milliseconds.",
      "Regular expression Denial of Service (ReDoS) from catastrophic backtracking locks the event loop at 100% CPU usage indefinitely.",
      "Shedding health check endpoints will cause orchestrators to terminate healthy pods that are merely experiencing high traffic."
    ],
    keyTakeaways: [
      "Continuously monitor event loop lag using `perf_hooks.monitorEventLoopDelay()`.",
      "Implement proactive load shedding to return 503s fast during traffic spikes, protecting existing transactions.",
      "Offload all CPU-bound workloads to worker threads or external task queues."
    ]
  },
  {
    id: "exp-deep-11",
    title: "Express as an Enterprise API Gateway: Reverse Proxying & Circuit Breakers",
    category: "Distributed Systems",
    readTimeMinutes: 17,
    overview: "In a microservices topology, Express frequently serves as an API Gateway: a unified entry point handling authentication, rate limiting, request routing, and protocol translation. When downstream microservices fail, naive gateways suffer from cascading thread starvation. This chapter covers reverse proxying with `http-proxy-middleware` and resilience engineering via Circuit Breakers.",
    diagram: `+-------------------------------------------------------------------------+
|                  EXPRESS API GATEWAY & CIRCUIT BREAKER                  |
+-------------------------------------------------------------------------+
|                                                                         |
|  Client Request: POST /api/orders                                       |
|       |                                                                 |
|       v                                                                 |
|  [ Express API Gateway Ingress ]                                        |
|  - Rate Limiting -> Auth Verification -> Header Normalization           |
|       |                                                                 |
|       v                                                                 |
|  [ Circuit Breaker: Opossum ]                                           |
|  +-------------------------------------------------------------------+  |
|  | State: CLOSED (Normal Operation)                                  |  |
|  | - Forwards request to Orders Microservice: http://orders-svc:4002  |  |
|  |-------------------------------------------------------------------|  |
|  | If Error Rate > 50%: TRIPS TO OPEN STATE!                         |  |
|  | - Fails fast immediately: Returns cached fallback or HTTP 503    |  |
|  | - Zero network calls made to failing downstream service!          |  |
|  |-------------------------------------------------------------------|  |
|  | After 30s: Transitions to HALF-OPEN                              |  |
|  | - Allows 1 trial request through to test if service recovered     |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Reverse Proxying with http-proxy-middleware",
        explanation: "The gateway forwards client requests to downstream microservices using streaming HTTP reverse proxies. It strips external secrets, injects trusted identity headers (`X-User-Id`, `X-User-Roles`), and handles proxy error events without buffering request bodies in memory.",
        codeExample: `const { createProxyMiddleware } = require('http-proxy-middleware');

const ordersServiceProxy = createProxyMiddleware({
  target: 'http://orders-service.internal:4002',
  changeOrigin: true,
  pathRewrite: { '^/api/orders': '/orders' },
  onProxyReq: (proxyReq, req) => {
    // Inject verified user metadata into private internal microservice network
    if (req.user) {
      proxyReq.setHeader('x-authenticated-user-id', req.user.id);
      proxyReq.setHeader('x-authenticated-roles', req.user.roles.join(','));
    }
    // Remove sensitive client-facing headers
    proxyReq.removeHeader('cookie');
  },
  onError: (err, req, res) => {
    res.status(502).json({ error: 'Downstream orders service unreachable' });
  }
});

app.use('/api/orders', authenticateJwt, ordersServiceProxy);`
      },
      {
        subheading: "2. The Circuit Breaker Pattern (Opossum)",
        explanation: "When a downstream service goes down, incoming requests queue up waiting for timeouts (e.g. 30 seconds). Rapidly, the gateway exhausts all available sockets and memory, taking down the ENTIRE system (cascading failure). A Circuit Breaker monitors failure rates: when failures exceed a threshold (e.g. 50%), the circuit trips OPEN. Subsequent requests fail fast immediately without waiting, giving the downstream service breathing room to recover.",
        codeExample: `const CircuitBreaker = require('opossum');

async function fetchRecommendations(userId) {
  const response = await fetch(\`http://recommendations-svc.internal:4005/users/\${userId}\`, {
    signal: AbortSignal.timeout(2000) // 2-second strict timeout
  });
  if (!response.ok) throw new Error('Service error');
  return response.json();
}

// Circuit Breaker Configuration
const breaker = new CircuitBreaker(fetchRecommendations, {
  timeout: 3000, // 3s execution timeout
  errorThresholdPercentage: 50, // Trip if >50% fail
  resetTimeout: 30000 // Test recovery after 30 seconds (Half-Open)
});

// Fallback logic when circuit is OPEN
breaker.fallback(() => ({ recommendations: ['trending_default_1', 'trending_default_2'] }));

app.get('/api/users/:id/recommendations', async (req, res, next) => {
  try {
    const data = await breaker.fire(req.params.id);
    res.json(data);
  } catch (err) {
    next(err);
  }
});`
      },
      {
        subheading: "3. Correlation ID & Distributed Tracing Propagation",
        explanation: "Debugging a failure across 10 microservices requires tracking a single request through the entire chain. The gateway extracts `X-Correlation-ID` or `traceparent` (W3C standard) or generates a new UUID, attaching it to `req.correlationId` and injecting it into all downstream HTTP calls and log entries.",
        codeExample: `app.use((req, res, next) => {
  const correlationId = req.get('X-Correlation-ID') || crypto.randomUUID();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});`
      }
    ],
    edgeCasesAndPitfalls: [
      "Parsing the request body with `express.json()` before `http-proxy-middleware` without re-broadcasting the body will cause downstream proxies to hang forever waiting for stream bytes.",
      "Failing to set strict timeouts on downstream fetch calls will lead to threadpool starvation before circuit breakers have time to trip.",
      "Using Express as an API gateway for 500,000+ RPS without edge caching will result in high memory overhead compared to Envoy or Nginx."
    ],
    keyTakeaways: [
      "Use `http-proxy-middleware` to stream requests directly to downstream services without body buffering.",
      "Implement Circuit Breakers (Opossum) to prevent cascading failures when downstream microservices degrade.",
      "Propagate W3C `traceparent` or `X-Correlation-ID` across all microservices for distributed tracing."
    ]
  },
  {
    id: "exp-deep-12",
    title: "Complete Express 4 to Express 5 Migration Deep Dive & Ecosystem Evolution",
    category: "Architecture & Modernization",
    readTimeMinutes: 17,
    overview: "Express 5 represents the first major release in over a decade. While maintaining backward compatibility for core APIs, significant architectural changes, method removals, and path-matching updates require a deliberate migration strategy. This chapter provides a complete guide for upgrading legacy enterprise Express 4 codebases to modern Express 5 standards.",
    diagram: `+-------------------------------------------------------------------------+
|                  EXPRESS 4 TO EXPRESS 5 UPGRADE MATRIX                  |
+-------------------------------------------------------------------------+
|                                                                         |
|  FEATURE / API          EXPRESS 4                     EXPRESS 5         |
|  ---------------------------------------------------------------------  |
|  Async Error Catching   Requires express-async-errors  Built-in Native  |
|  Wildcard Routing       app.get('*', ...)             app.get('/{*s}')  |
|  path-to-regexp         v0.1.7 (Permissive)           v8.x (Strict)     |
|  res.send(status)       Permitted: res.send(404)      REMOVED (Throws!) |
|  app.del()              Permitted alias               REMOVED (Throws!) |
|  req.param(name)        Searches params, body, query  REMOVED (Throws!) |
|  req.query parser       Simple (querystring)          Extended (qs)     |
|  Minimum Node Engine    Node v0.10+                   Node v18+         |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Path-to-Regexp v8 Migration Strategy",
        explanation: "The most common migration error in Express 5 is `TypeError: Unexpected *`. Express 4 relied on `path-to-regexp` v0.1.7 which allowed unescaped wildcards and loose patterns. Express 5 uses `path-to-regexp` v8, where `*` must be attached to a named parameter or escaped.",
        codeExample: `// EXPRESS 4 (WILL CRASH ON EXPRESS 5 STARTUP):
// app.get('/files/*', (req, res) => ...);
// app.get('*', (req, res) => ...);
// app.get('/users/:id?', (req, res) => ...);

// EXPRESS 5 MIGRATION:
// 1. Wildcard segments require named parameters
app.get('/files/{*filePath}', (req, res) => {
  res.send(req.params.filePath);
});

// 2. Global catch-all routes
app.all('/{*splat}', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 3. Optional parameters
app.get('/users{/:id}', (req, res) => {
  res.send(req.params.id || 'default');
});`
      },
      {
        subheading: "2. Purging Deprecated and Removed Methods",
        explanation: "Express 5 removes legacy method signatures that caused polymorphic ambiguities or security vulnerabilities. Auditing your codebase for `res.send(status)`, `res.json(status, obj)`, `req.param()`, and `app.del()` is mandatory before bumping `package.json`.",
        codeExample: `// OLD (Express 4):
// app.del('/user', handler);
// res.send(404);
// res.json(500, { error: 'Failed' });
// const id = req.param('id');

// NEW (Express 5 Compliant):
app.delete('/user', handler);
res.sendStatus(404);
res.status(500).json({ error: 'Failed' });
const id = req.params.id || req.query.id || req.body.id;`
      },
      {
        subheading: "3. Retiring Async Wrappers & Modernizing the Codebase",
        explanation: "Once upgraded to Express 5, teams can safely eliminate external packages like `express-async-errors` and delete thousands of lines of repetitive `asyncHandler` wrappers. Route handlers become pure, native `async (req, res) => { ... }` functions, and TypeScript definitions reflect true Promise return types.",
        codeExample: `// Before (Express 4 with wrappers):
// import asyncHandler from 'express-async-handler';
// app.get('/data', asyncHandler(async (req, res) => { ... }));

// After (Express 5 Clean Native Architecture):
app.get('/data', async (req, res) => {
  const result = await dataService.compute();
  res.json(result);
});`
      }
    ],
    edgeCasesAndPitfalls: [
      "Catch-all routes declared as `app.use('*', ...)` or `app.get('*', ...)` will crash your server immediately upon startup in Express 5.",
      "Leaving `express-async-errors` in `package.json` can cause double-wrapping conflicts with Express 5's native rejection handling.",
      "Query strings with nested keys (`?filter[status]=active`) are parsed as nested objects by default in Express 5; ensure schemas expect objects rather than bracketed string keys."
    ],
    keyTakeaways: [
      "Migrate all route wildcard patterns from `*` to `/{*splat}` to comply with `path-to-regexp` v8.",
      "Replace all `res.send(status)` and `res.json(status, data)` with explicit `res.status().send/json()`.",
      "Remove `express-async-errors` and custom `asyncHandler` wrappers to leverage Express 5's native promise handling."
    ]
  }
];

// Validate deep chapters
const requiredFields = ["id", "title", "category", "readTimeMinutes", "overview", "diagram", "deepDive", "edgeCasesAndPitfalls", "keyTakeaways"];
for (const chap of deepChapters) {
  for (const field of requiredFields) {
    if (chap[field] === undefined || chap[field] === null || chap[field] === "") {
      console.error(`Chapter ${chap.id} missing field: ${field}`);
    }
  }
}

const outputPath = path.join(__dirname, "../data/express.deep.json");
fs.writeFileSync(outputPath, JSON.stringify(deepChapters, null, 2), "utf-8");

console.log(`Successfully generated Express Deeper Concepts:`);
console.log(`- ${deepChapters.length} Chapters -> ${outputPath}`);
