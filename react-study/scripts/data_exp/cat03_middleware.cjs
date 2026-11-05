const { createCard } = require("../exp_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 25,
  category: "Middleware Pipeline",
  concept: "The Middleware Contract & (req, res, next) Signature",
  priority: "must-know",
  difficulty: "beginner",
  question: "What is middleware in Express.js, and what are the responsibilities of the (req, res, next) signature?",
  answer: "Middleware functions are functions that have access to the request object (req), the response object (res), and the next middleware function in the application's request-response cycle. A middleware must perform one of two actions: 1) End the request-response cycle (by sending a response via `res.send()`, `res.json()`, etc.), OR 2) Pass control to the next middleware in the pipeline by invoking `next()`.",
  explanation: "If a middleware neither sends a response nor calls `next()`, the client request will hang indefinitely until the browser or client times out. Middleware can execute any code, mutate `req` and `res` objects (e.g. attaching user sessions or correlation IDs), and catch and forward errors by passing an argument to `next(err)`.",
  code: `import express from "express";

const app = express();

// Custom logging middleware
const requestLogger = (req, res, next) => {
  console.log(\`[\${new Date().toISOString()}] \${req.method} \${req.url}\`);
  // Must call next() to pass execution forward!
  next();
};

app.use(requestLogger);

app.get("/", (req, res) => {
  res.send("Hello World"); // Ends request-response cycle
});`,
  recallHint: "Middleware: (req, res, next). MUST either send response OR call next().",
  interviewTip: "A staple interview question: 'What happens if a middleware omits calling next() and doesn't send a response?' Answer: the client request hangs forever until socket timeout.",
  tags: ["middleware", "next", "signature", "fundamentals"]
}));

cards.push(createCard({
  idNum: 26,
  category: "Middleware Pipeline",
  concept: "The 5 Types of Middleware in Express",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What are the 5 official types of middleware categorized in the Express.js documentation?",
  answer: "1) **Application-level middleware**: bound directly to an app instance via `app.use()` or `app.METHOD()`. 2) **Router-level middleware**: bound to an instance of `express.Router()` via `router.use()`. 3) **Error-handling middleware**: defined with 4 arguments `(err, req, res, next)`. 4) **Built-in middleware**: provided by Express itself (`express.json()`, `express.static()`, `express.urlencoded()`). 5) **Third-party middleware**: external npm packages (`helmet`, `cors`, `morgan`, `cookie-parser`).",
  explanation: "All 5 types share the same underlying pipeline execution mechanics, differing only in how they are bound to scopes (global app vs sub-router) and their function arity (4 arguments exclusively designates error handlers).",
  code: `import express from "express";
import cors from "cors";

const app = express();
const router = express.Router();

// 1. Built-in middleware
app.use(express.json());

// 2. Third-party middleware
app.use(cors());

// 3. Application-level middleware
app.use((req, res, next) => next());

// 4. Router-level middleware
router.use((req, res, next) => next());

// 5. Error-handling middleware (4 parameters!)
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});`,
  recallHint: "5 Types: Application-level, Router-level, Error-handling, Built-in, Third-party.",
  interviewTip: "Emphasize how Express distinguishes normal middleware from error middleware: it inspects `fn.length` (the number of formal arguments). If `fn.length === 4`, it treats it as an error handler.",
  tags: ["middleware-types", "architecture", "built-in", "third-party"]
}));

cards.push(createCard({
  idNum: 27,
  category: "Middleware Pipeline",
  concept: "The Onion Middleware Execution Lifecycle",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does the 'Onion' execution model operate in Express middleware compared to Koa?",
  answer: "In Express, middleware executes sequentially forward down the pipeline. While Express is often compared to an 'onion' model, in Express 4 it is primarily a forward pipeline: once `next()` is called, control moves forward. To perform actions 'on the way out' (after downstream handlers finish), Express middleware must listen to response stream events: `res.on('finish')` or `res.on('close')`. (Unlike Koa, where `await next()` naturally unwinds in reverse like a true onion).",
  explanation: "In Koa, code written after `await next()` executes when downstream handlers return. In Express, code written after `next()` runs synchronously immediately after the downstream handler relinquishes the synchronous tick, NOT after the HTTP response has been sent! To reliably calculate response time in Express, you must listen to `res.on('finish')`.",
  code: `import express from "express";

const app = express();

// Correct 'On the way out' timing in Express:
app.use((req, res, next) => {
  const start = performance.now();

  // Listen for the response stream to finish writing to socket
  res.on("finish", () => {
    const duration = (performance.now() - start).toFixed(2);
    console.log(\`Response finished in \${duration}ms with status \${res.statusCode}\`);
  });

  next(); // Pass forward
});

app.get("/slow", async (req, res) => {
  await new Promise(r => setTimeout(r, 100));
  res.send("Done");
});`,
  recallHint: "Express pipeline moves forward. To hook 'on the way out', listen to res.on('finish').",
  interviewTip: "A classic senior interview question! Explain why writing `const start = Date.now(); next(); console.log(Date.now() - start);` in Express fails: it measures only synchronous dispatch time, not asynchronous response completion time.",
  tags: ["onion-model", "koa-vs-express", "res-finish", "timing"]
}));

cards.push(createCard({
  idNum: 28,
  category: "Middleware Pipeline",
  concept: "Calling next() Multiple Times (ERR_HTTP_HEADERS_SENT)",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What happens if a middleware calls next() multiple times or sends a response after calling next()?",
  answer: "Calling `next()` multiple times causes downstream middleware to execute repeatedly for a single request, leading to duplicate database queries, state corruption, and ultimately throwing `Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client` when multiple handlers attempt to send response headers.",
  explanation: "Always use `return next()` or `return res.send()` to terminate execution within conditional branches. If an asynchronous callback invokes `next()` inside a callback and forgets to `return`, code following the callback will execute concurrently, triggering duplicate pipeline dispatches.",
  code: `import express from "express";

const app = express();

// BUGGY PATTERN: Missing 'return'
app.use((req, res, next) => {
  if (!req.headers.authorization) {
    res.status(401).send("Unauthorized");
    // BUG: Missing 'return'! Execution continues below!
  }
  next(); // Double execution! Triggers ERR_HTTP_HEADERS_SENT downstream!
});

// CORRECT PATTERN: Always return when exiting branches
app.use((req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send("Unauthorized");
  }
  return next();
});`,
  recallHint: "Always use 'return next()' or 'return res.json()' to prevent multiple executions and ERR_HTTP_HEADERS_SENT.",
  interviewTip: "`ERR_HTTP_HEADERS_SENT` is the #1 most common error in Express applications. Emphasize returning early from conditional guards.",
  tags: ["headers-sent", "control-flow", "bugs", "return-next"]
}));

cards.push(createCard({
  idNum: 29,
  category: "Middleware Pipeline",
  concept: "Built-in Body Parsers: express.json() & express.urlencoded()",
  priority: "must-know",
  difficulty: "beginner",
  question: "How do express.json() and express.urlencoded() work, and why were they added back into core Express in 4.16+?",
  answer: "`express.json()` parses incoming HTTP requests with `Content-Type: application/json` streams and populates `req.body` with the parsed JavaScript object. `express.urlencoded()` parses URL-encoded form data (`application/x-www-form-urlencoded`). In Express 4.0, all body-parsers were extracted into the external 'body-parser' package. In Express 4.16+, they were re-bundled into core Express as built-in middleware for developer convenience.",
  explanation: "Both parsers read the raw incoming byte stream from Node's `req` stream asynchronously, buffer the bytes up to a configured size ceiling, parse the string (via `JSON.parse` or `querystring`/`qs`), and attach the resulting object to `req.body`. If the content-type does not match, the middleware skips parsing and invokes `next()`.",
  code: `import express from "express";

const app = express();

// Parse JSON bodies (Content-Type: application/json)
app.use(express.json({ limit: "1mb" }));

// Parse form-urlencoded bodies (Content-Type: application/x-www-form-urlencoded)
// extended: true uses 'qs' library (supports nested objects); false uses 'querystring'
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.post("/api/users", (req, res) => {
  console.log("Parsed body:", req.body);
  res.status(201).json(req.body);
});`,
  recallHint: "express.json() parses JSON into req.body. express.urlencoded({ extended: true }) parses forms via qs.",
  interviewTip: "Explain `extended: true` vs `extended: false` in `urlencoded`: `extended: true` uses the rich `qs` library allowing nested objects (`user[name]=Alice`), whereas `false` uses Node's legacy `querystring` which only parses flat key-values.",
  tags: ["body-parser", "express-json", "urlencoded", "built-in"]
}));

cards.push(createCard({
  idNum: 30,
  category: "Middleware Pipeline",
  concept: "Request Body Parsing Limits & Denial-of-Service Defense",
  priority: "must-know",
  difficulty: "intermediate",
  question: "Why should you always configure payload limits on express.json(), and what error is thrown if exceeded?",
  answer: "By default, `express.json()` limits request bodies to 100kb (`limit: '100kb'`). If left unconfigured on file upload endpoints or set to infinity, an attacker can stream gigabytes of raw JSON into memory, causing Node.js to exhaust heap memory and crash (Denial-of-Service). When a payload exceeds the configured limit, `express.json` aborts stream consumption and forwards an error with status 413 ('Payload Too Large' / `entity.too.large`) to error middleware.",
  explanation: "Setting sensible limits (`limit: '1mb'` for standard REST APIs, `'10mb'` for image upload endpoints) prevents buffer bloat and V8 JSON parsing CPU spikes.",
  code: `import express from "express";

const app = express();

// Strict limit for general API
app.use(express.json({ limit: "200kb" }));

// Custom error handler catching 413 Payload Too Large
app.use((err, req, res, next) => {
  if (err.type === "entity.too.large" || err.status === 413) {
    return res.status(413).json({
      error: "Payload Too Large",
      message: \`Request body exceeded maximum limit of \${err.limit} bytes\`
    });
  }
  next(err);
});`,
  recallHint: "Always set limit: '100kb' on express.json(). Exceeding limit throws 413 Payload Too Large.",
  interviewTip: "Highlight that for multipart file uploads (images/videos), `express.json()` should NEVER be used with a 100MB limit. Use streaming multipart libraries like Multer or Busboy instead.",
  tags: ["payload-limit", "security", "dos-protection", "413-payload-too-large"]
}));

cards.push(createCard({
  idNum: 31,
  category: "Middleware Pipeline",
  concept: "Configurable Middleware Factories (Higher-Order Functions)",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is a Middleware Factory in Express, and how do you write configurable middleware?",
  answer: "A Middleware Factory is a higher-order function that accepts configuration options and returns a standard Express middleware function `(req, res, next)`. This pattern allows creating reusable, parameterized middleware (like rate-limiters, role guards, and cache controllers).",
  explanation: "Popular third-party middleware (`cors({ origin: '...' })`, `helmet()`, `express.static(...)`) are all middleware factories. The outer function runs once during setup time, closing over the configuration parameters; the returned inner function runs on every incoming HTTP request.",
  code: `import express from "express";

const app = express();

// Middleware Factory: accepts permitted roles configuration
function authorizeRoles(...permittedRoles) {
  // Returns standard Express middleware closure
  return function(req, res, next) {
    const userRole = req.headers["x-user-role"];

    if (!userRole || !permittedRoles.includes(userRole)) {
      return res.status(403).json({
        error: "Forbidden",
        message: \`Requires one of the following roles: \${permittedRoles.join(", ")}\`
      });
    }

    next();
  };
}

// Configurable usage:
app.delete("/api/system", authorizeRoles("SUPER_ADMIN"), (req, res) => {
  res.send("System purged");
});

app.post("/api/posts", authorizeRoles("ADMIN", "EDITOR"), (req, res) => {
  res.send("Post created");
});`,
  recallHint: "Middleware factory = HOF returning (req, res, next). Closes over configuration arguments.",
  interviewTip: "Demonstrating how to write configurable middleware factories proves you can build clean, reusable architectural libraries.",
  tags: ["middleware-factory", "higher-order-functions", "closures", "design-patterns"]
}));

cards.push(createCard({
  idNum: 32,
  category: "Middleware Pipeline",
  concept: "Conditional Middleware Execution",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "How do you conditionally execute middleware based on route paths, headers, or environment?",
  answer: "Conditional middleware execution can be achieved in two ways: 1) Path-based mounting: passing a URL pattern to `app.use('/api', middleware)`, so it executes only on matching paths. 2) Programmatic branching: wrapping the middleware inside an outer middleware that inspects `req` and decides whether to invoke the target middleware or immediately call `next()`.",
  explanation: "Programmatic branching is ideal when you want to bypass authentication on webhook endpoints (like Stripe) or disable CSRF/rate-limiting on health check routes (`/health`).",
  code: `import express from "express";

const app = express();

// Helper: conditional middleware wrapper
function unless(predicate, middleware) {
  return function(req, res, next) {
    if (predicate(req)) {
      return next(); // Bypass middleware!
    }
    return middleware(req, res, next); // Execute middleware
  };
}

const authGuard = (req, res, next) => {
  if (!req.headers.authorization) return res.status(401).send("Unauthorized");
  next();
};

// Bypass authGuard for /public and /health endpoints:
app.use(unless(req => req.path === "/health" || req.path.startsWith("/public"), authGuard));

app.get("/health", (req, res) => res.send("OK")); // No auth required
app.get("/api/data", (req, res) => res.send("Protected")); // Auth required!`,
  recallHint: "Conditional middleware: app.use('/prefix', mw) or wrapper checking predicate before calling mw.",
  interviewTip: "Mention the `express-unless` npm package, which standardizes the `unless()` predicate pattern for third-party middleware.",
  tags: ["conditional-middleware", "branching", "auth-bypass"]
}));

cards.push(createCard({
  idNum: 33,
  category: "Middleware Pipeline",
  concept: "Async Middleware & Unhandled Promise Rejections",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is the primary danger of using async/await inside Express 4 middleware, and how is it solved?",
  answer: "In Express 4, the router is NOT promise-aware. If an `async` middleware function throws an error or rejects a Promise without a `try/catch` block, Express 4 cannot catch it. The error bypasses Express's error-handling middleware completely, triggering an `unhandledRejection` event on the Node.js process and crashing the server in Node 15+. It is solved by wrapping async handlers in a helper function (`fn(req, res, next).catch(next)`), using `express-async-errors`, or upgrading to Express 5.",
  explanation: "Express 5 natively catches rejected promises returned by route handlers. In Express 4, you must wrap every async route handler or use the `express-async-errors` monkey-patching package.",
  code: `import express from "express";

const app = express();

// The Async Handler Wrapper for Express 4:
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Safe async route in Express 4:
app.get("/api/user", asyncHandler(async (req, res) => {
  const user = await databaseCall(); // If this throws, asyncHandler catches and calls next(err)!
  res.json(user);
}));

// Centralized error handler receives the error smoothly:
app.use((err, req, res, next) => {
  res.status(500).json({ error: err.message });
});`,
  recallHint: "Express 4 ignores rejected promises -> crashes process. Wrap with asyncHandler: fn(req,res,next).catch(next).",
  interviewTip: "This is one of the most critical Express 4 architectural topics. Explain that Express 5 solves this natively by automatically routing rejected promises to `next(err)`.",
  tags: ["async-middleware", "unhandled-rejection", "async-handler", "express4-vs-express5"]
}));

cards.push(createCard({
  idNum: 34,
  category: "Middleware Pipeline",
  concept: "Request Tracing & Context with AsyncLocalStorage",
  priority: "advanced",
  difficulty: "advanced",
  question: "How do you achieve request-scoped tracing and dependency injection in Express without drilling 'req' through services?",
  answer: "By using Node.js's native `AsyncLocalStorage` (ALS) from `node:async_hooks`. An early middleware creates a store context (`{ traceId, tenantId, user }`) and wraps subsequent pipeline execution inside `asyncLocalStorage.run(store, () => next())`. Any service, repository, or utility downstream can read `asyncLocalStorage.getStore()` anywhere in the asynchronous call stack without passing `req` down through function arguments.",
  explanation: "This pattern decouples business domain services from Express HTTP transport semantics. Distributed trace IDs (`x-correlation-id`), tenant identifiers, and audit logs can be accessed transparently across database queries and microservice RPC calls.",
  code: `import express from "express";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";

const app = express();
export const requestContext = new AsyncLocalStorage();

// Trace ID & Context Middleware
app.use((req, res, next) => {
  const traceId = req.headers["x-request-id"] || randomUUID();
  res.setHeader("X-Request-Id", traceId);

  const contextStore = {
    traceId,
    startTime: performance.now(),
    user: null
  };

  // Run downstream pipeline inside async local storage context:
  requestContext.run(contextStore, () => {
    next();
  });
});

// Domain Service (No 'req' parameter needed!):
class OrderService {
  static async processOrder(orderId) {
    const store = requestContext.getStore();
    console.log(\`[Trace \${store.traceId}] Processing order \${orderId}\`);
  }
}`,
  recallHint: "AsyncLocalStorage: run(contextStore, () => next()). Allows services to read request context without drilling req.",
  interviewTip: "Highlight that `AsyncLocalStorage` is the standard engine behind distributed APM tracing tools like OpenTelemetry, Datadog, and New Relic in Node.js.",
  tags: ["asynclocalstorage", "tracing", "correlation-id", "architecture"]
}));

cards.push(createCard({
  idNum: 35,
  category: "Middleware Pipeline",
  concept: "Router Middleware Isolation vs Application Scope",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "How does middleware scoping differ between app.use() and router.use()?",
  answer: "`app.use(mw)` registers middleware at the root application layer, executing for EVERY incoming request that matches the path across all routers. `router.use(mw)` registers middleware strictly within that specific router's internal layer stack, executing ONLY when requests match that router's mount path.",
  explanation: "This enables clean separation of concerns: public endpoints (login, register, health checks) can be mounted on an unauthenticated router, while secure administrative endpoints are mounted on an authenticated router with `adminRouter.use(authMiddleware)`.",
  code: `import express from "express";

const app = express();

// Global app-level middleware (runs for ALL requests)
app.use(express.json());

// Public Router (no auth)
const publicRouter = express.Router();
publicRouter.get("/health", (req, res) => res.send("OK"));

// Protected Router (auth isolated)
const protectedRouter = express.Router();
protectedRouter.use((req, res, next) => {
  if (!req.headers.authorization) return res.status(401).send("Unauthorized");
  next();
});
protectedRouter.get("/profile", (req, res) => res.send("Secret Profile"));

app.use("/public", publicRouter);
app.use("/api", protectedRouter);`,
  recallHint: "app.use = global application scope. router.use = isolated to that router only.",
  interviewTip: "Explain that middleware order in the parent app dictates when the router's middleware runs. If a parent middleware halts execution, the child router's middleware never executes.",
  tags: ["router-middleware", "scoping", "isolation", "security"]
}));

cards.push(createCard({
  idNum: 36,
  category: "Middleware Pipeline",
  concept: "The res.locals vs app.locals Scope Pipeline",
  priority: "must-know",
  difficulty: "beginner",
  question: "What is the difference between res.locals and app.locals in Express?",
  answer: "`app.locals` is an object whose properties are global singletons that persist for the entire lifetime of the Express application process. `res.locals` is an object whose properties are scoped strictly to the current HTTP request-response cycle and discarded when the response completes.",
  explanation: "Use `app.locals` for application metadata: site title, API version, global configuration constants. Use `res.locals` for request-specific state: the currently authenticated user (`res.locals.user`), validated payload data, or request-specific start timestamps. Both are automatically passed to view engines during `res.render()`.",
  code: `import express from "express";

const app = express();

// Application-level persistent singleton locals
app.locals.appName = "FinTech Portal";
app.locals.supportEmail = "support@fintech.com";

// Request-level scoped locals
app.use((req, res, next) => {
  res.locals.requestId = req.headers["x-request-id"] || "req_123";
  res.locals.currentUser = { id: 42, role: "USER" };
  next();
});

app.get("/dashboard", (req, res) => {
  res.json({
    app: app.locals.appName,
    user: res.locals.currentUser,
    reqId: res.locals.requestId
  });
});`,
  recallHint: "app.locals = global process singleton. res.locals = single request lifecycle.",
  interviewTip: "Highlight that `res.locals` is the recommended standard for passing authenticated user data between middleware and controllers rather than mutating `req.user`.",
  tags: ["locals", "res-locals", "app-locals", "request-state"]
}));

module.exports = cards;
