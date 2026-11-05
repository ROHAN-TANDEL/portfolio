const { createCard } = require("../exp_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 13,
  category: "Routing & Route Engine",
  concept: "Route Paths: Strings, Patterns, and Regular Expressions",
  priority: "must-know",
  difficulty: "beginner",
  question: "What types of path patterns are supported by the Express router?",
  answer: "Express supports three types of route paths: 1) Exact strings (`'/about'`), 2) String patterns with special characters like `?`, `+`, `*`, `()` (e.g. `'/ab?cd'`, `'/ab+cd'`), and 3) Raw Regular Expressions (e.g. `/a/`, `/.*fly$/`). Paths are converted into regular expressions internally using the 'path-to-regexp' library.",
  explanation: "In string patterns: `?` makes the preceding character optional (`'/acd'` or `'/abcd'`). `+` means 1 or more of preceding character (`'/abbcd'`). `*` matches arbitrary text (`'/ab*cd'`). Regular expression routes allow precise matching: `app.get(/.*fly$/, ...)` matches `/butterfly` and `/dragonfly`.",
  code: `import express from "express";

const app = express();

// 1. Exact string path
app.get("/users", (req, res) => res.send("Exact /users"));

// 2. String pattern with optional character: matches /acd and /abcd
app.get("/ab?cd", (req, res) => res.send("Matches /acd or /abcd"));

// 3. Regular expression route: matches anything ending with 'fly'
app.get(/.*fly$/, (req, res) => res.send("Matches butterfly, dragonfly, etc."));`,
  recallHint: "Route paths: exact strings, string patterns with wildcards, and raw RegExp. Uses path-to-regexp.",
  interviewTip: "Note that Express 5 upgraded path-to-regexp to version 8+, modifying how wildcards and regex characters inside string paths behave.",
  tags: ["routing", "route-paths", "regex", "path-to-regexp"]
}));

cards.push(createCard({
  idNum: 14,
  category: "Routing & Route Engine",
  concept: "Route Parameters (:param) & Extraction",
  priority: "must-know",
  difficulty: "beginner",
  question: "How do route parameters work in Express, and where are captured values stored?",
  answer: "Route parameters are named URL segments declared with a leading colon (e.g. `'/users/:userId'`). Captured values are parsed from the URL path and populated into the `req.params` object with parameter names as keys (e.g. `req.params.userId`). Parameter values are ALWAYS strings.",
  explanation: "The name of route parameters must be made up of 'word characters' ([A-Za-z0-9_]). Hyphen (`-`) and dot (`.`) can be used for composite parameters: `'/flights/:from-:to'` captures `{ from: 'JFK', to: 'LHR' }`, and `'/data/:filename.:ext'` captures `{ filename: 'report', ext: 'pdf' }`.",
  code: `import express from "express";

const app = express();

// Basic named parameter
app.get("/users/:userId", (req, res) => {
  const userId = req.params.userId; // string!
  res.json({ userId, parsedNumber: parseInt(userId, 10) });
});

// Composite parameters with hyphen and dot delimiters
app.get("/flights/:from-:to", (req, res) => {
  const { from, to } = req.params;
  res.send(\`Flight from \${from} to \${to}\`);
});`,
  recallHint: "Route params (:param) populate req.params. Always strings; numbers require parseInt().",
  interviewTip: "A common bug is forgetting that `req.params.id` is a string. If using strict equality (`===`) against a database numeric ID, it will evaluate to false unless cast with `Number()` or `parseInt()`.",
  tags: ["route-params", "req-params", "routing", "url-parsing"]
}));

cards.push(createCard({
  idNum: 15,
  category: "Routing & Route Engine",
  concept: "router.param() Pre-Condition Middleware",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is router.param() in Express, and how is it used for automatic resource loading and validation?",
  answer: "`router.param(name, callback)` defines trigger callback middleware that executes automatically whenever a route matching the parameter `name` is hit. The callback has signature `(req, res, next, paramValue, paramName)`. It is used to load resources from a database once, validate IDs, or attach entities to `req` before route handlers run.",
  explanation: "`router.param` runs only ONCE per request-response cycle, even if the parameter appears in multiple matching routes. If the entity does not exist in the database, the param middleware can return a 404 response immediately, preventing repetitive database lookups across CRUD route handlers.",
  code: `import express from "express";

const router = express.Router();

// Pre-condition middleware for :userId
router.param("userId", async (req, res, next, id) => {
  try {
    const user = await fakeDatabaseLookup(id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    req.loadedUser = user; // Attach loaded entity to request object!
    next();
  } catch (err) {
    next(err);
  }
});

// Handlers no longer need to query DB for user!
router.get("/users/:userId", (req, res) => {
  res.json(req.loadedUser);
});

router.delete("/users/:userId", (req, res) => {
  res.json({ message: \`Deleted \${req.loadedUser.name}\` });
});`,
  recallHint: "router.param(name, (req, res, next, val)): loads entity once, attaches to req, fast-fails 404.",
  interviewTip: "Showcasing `router.param()` proves architectural maturity: it eliminates repetitive `const user = await db.find(req.params.id); if (!user) return 404;` boilerplate across route handlers.",
  tags: ["router-param", "pre-conditions", "dry", "middleware"]
}));

cards.push(createCard({
  idNum: 16,
  category: "Routing & Route Engine",
  concept: "Chained Route Handlers with app.route()",
  priority: "intermediate",
  difficulty: "beginner",
  question: "How does app.route() create modular, chainable route handlers for a single URL path?",
  answer: "`app.route(path)` returns an instance of a single route which you can then chain with multiple HTTP verb handlers (`.get()`, `.post()`, `.put()`, `.delete()`). It eliminates redundant path string typing and groups all HTTP verbs for a specific resource path together.",
  explanation: "Instead of writing `app.get('/book', ...)`, `app.post('/book', ...)`, and `app.delete('/book', ...)`, `app.route('/book')` organizes REST CRUD endpoints for a resource in one unified block.",
  code: `import express from "express";

const app = express();

app.route("/api/books")
  .get((req, res) => {
    res.json({ books: ["Clean Code", "Design Patterns"] });
  })
  .post((req, res) => {
    res.status(201).json({ message: "Book created" });
  })
  .delete((req, res) => {
    res.json({ message: "All books cleared" });
  });`,
  recallHint: "app.route('/path').get(...).post(...).put(...): groups HTTP verbs for single path cleanly.",
  interviewTip: "Mention that `app.route()` is ideal for resource-centric REST endpoints because all HTTP methods for that URI live in one readable code block.",
  tags: ["app-route", "rest", "crud", "chaining"]
}));

cards.push(createCard({
  idNum: 17,
  category: "Routing & Route Engine",
  concept: "Multiple Callback Handlers & Route Pipelines",
  priority: "must-know",
  difficulty: "intermediate",
  question: "Can an Express route have multiple callback functions, and how do they pass control?",
  answer: "Yes, an Express route method can accept multiple callback functions (as individual arguments, an array of functions, or combinations of both). They behave like route-level middleware and execute sequentially. Each callback must either end the request-response cycle (e.g. `res.send()`) or invoke `next()` to pass execution to the subsequent handler in the pipeline.",
  explanation: "This pattern is standard for attaching route-specific security guards: e.g. `app.post('/admin', requireAuth, requireRole('ADMIN'), validatePayload, handler)`. If `requireAuth` detects an invalid token, it returns a 401 response and omits calling `next()`, aborting downstream handlers.",
  code: `import express from "express";

const app = express();

const checkAuth = (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next(); // Pass to next handler
};

const checkAdmin = (req, res, next) => {
  if (req.headers["x-role"] !== "admin") {
    return res.status(403).json({ error: "Forbidden: Admins only" });
  }
  next(); // Pass to next handler
};

// Route pipeline with multiple guard callbacks:
app.post("/api/admin/deploy", [checkAuth, checkAdmin], (req, res) => {
  res.json({ message: "Deployment triggered successfully" });
});`,
  recallHint: "Routes accept arrays of handlers: [guard1, guard2, controller]. next() chains to next handler.",
  interviewTip: "Explain that an array of middlewares can be mixed with standalone functions: `app.get('/path', [mw1, mw2], mw3, controller)`.",
  tags: ["route-pipeline", "guards", "middleware-chain", "next"]
}));

cards.push(createCard({
  idNum: 18,
  category: "Routing & Route Engine",
  concept: "next('route') Control Flow",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What does next('route') do in Express, and how does it differ from next()?",
  answer: "`next('route')` bypasses all remaining middleware functions in the CURRENT route stack and passes control immediately to the NEXT matching route handler for that path. Calling standard `next()` advances to the very next callback function within the current route.",
  explanation: "`next('route')` works ONLY inside middleware loaded using `app.METHOD()` or `router.METHOD()`, NOT in generic `app.use()`. It is useful for conditional route branching: e.g. if a user is a VIP, handle them with a dedicated premium handler, otherwise call `next('route')` to fall back to the standard handler.",
  code: `import express from "express";

const app = express();

// Route Handler 1 for /user/:id
app.get("/user/:id", (req, res, next) => {
  if (req.params.id === "special") {
    console.log("Special ID! Skipping remaining handlers in this route...");
    return next("route"); // Jumps to Route Handler 2 below!
  }
  // Normal processing
  next();
}, (req, res) => {
  res.send("Standard User Handler");
});

// Route Handler 2 for /user/:id (Fallback / Alternative handler)
app.get("/user/:id", (req, res) => {
  res.send("Special VIP User Handler");
});`,
  recallHint: "next('route') skips remaining callbacks in current route, jumping to the NEXT matching route.",
  interviewTip: "Clarify that `next('route')` only works in `app.METHOD` or `router.METHOD`, never in bare `app.use()`. Passing any string other than `'route'` or `'router'` to `next()` is treated as an error!",
  tags: ["next-route", "control-flow", "routing", "branching"]
}));

cards.push(createCard({
  idNum: 19,
  category: "Routing & Route Engine",
  concept: "next('router') Control Flow",
  priority: "advanced",
  difficulty: "advanced",
  question: "What does next('router') do, and when was it introduced?",
  answer: "`next('router')` skips all remaining middleware and route handlers in the CURRENT sub-router instance completely, immediately passing control back out to the parent router or application middleware stack.",
  explanation: "If you have a sub-router mounted at `/api`, and an authorization check inside that router discovers that the entire API subsystem is disabled for this tenant, calling `next('router')` exits the `/api` router entirely, resuming execution at the next middleware in the parent application.",
  code: `import express from "express";

const app = express();
const apiRouter = express.Router();

apiRouter.use((req, res, next) => {
  if (req.headers["x-maintenance-mode"]) {
    return next("router"); // Exit apiRouter entirely!
  }
  next();
});

apiRouter.get("/data", (req, res) => res.send("Active API data"));

// Mount router
app.use("/api", apiRouter);

// Parent fallback handler
app.use("/api", (req, res) => {
  res.status(503).send("API temporarily in maintenance mode");
});`,
  recallHint: "next('router') exits the current sub-router entirely and returns to parent router stack.",
  interviewTip: "Distinguish: `next()` = next middleware. `next('route')` = next matching route. `next('router')` = exit sub-router entirely. `next(err)` = jump to error middleware.",
  tags: ["next-router", "sub-routers", "control-flow", "advanced"]
}));

cards.push(createCard({
  idNum: 20,
  category: "Routing & Route Engine",
  concept: "mergeParams in express.Router({ mergeParams: true })",
  priority: "must-know",
  difficulty: "intermediate",
  question: "Why is express.Router({ mergeParams: true }) required for nested resource routes?",
  answer: "By default, an `express.Router()` has isolated parameter scope; parameters defined in parent route paths (`app.use('/users/:userId/posts', postRouter)`) are NOT accessible inside the child router (`req.params.userId` is `undefined`). Setting `{ mergeParams: true }` instructs the child router to inherit and merge parameters from parent routers.",
  explanation: "In RESTful APIs with nested resources (e.g. `/organizations/:orgId/departments/:deptId/employees`), the employee controller must know both `:orgId` and `:deptId`. Without `{ mergeParams: true }`, child routes cannot read `:orgId`.",
  code: `import express from "express";

const app = express();

// Child Router for posts: MUST specify mergeParams: true!
const postRouter = express.Router({ mergeParams: true });

postRouter.get("/:postId", (req, res) => {
  // Can read BOTH parent :userId AND child :postId!
  const { userId, postId } = req.params;
  res.json({ userId, postId });
});

// Parent Route mounting child router:
app.use("/users/:userId/posts", postRouter);

// Request GET /users/42/posts/101 returns: { userId: "42", postId: "101" }`,
  recallHint: "Router({ mergeParams: true }): allows child router to access parent route parameters.",
  interviewTip: "This is one of the most common Express interview bugs: candidates write nested routers and wonder why `req.params.parentId` is undefined. The solution is always `{ mergeParams: true }`.",
  tags: ["mergeparams", "nested-routers", "rest-apis", "params"]
}));

cards.push(createCard({
  idNum: 21,
  category: "Routing & Route Engine",
  concept: "Route Order Precedence & Overlapping Collisions",
  priority: "must-know",
  difficulty: "beginner",
  question: "How does route declaration order determine matching precedence, and what is the parameter collision trap?",
  answer: "Express matches routes in the EXACT sequential order they are registered in code (`first-match-wins`). If a dynamic parameter route (`'/users/:id'`) is registered BEFORE a static route (`'/users/me'`), requesting `'/users/me'` will match `':id'` with value `'me'`, preventing the static route from ever executing.",
  explanation: "Because path matching stops at the first handler that ends the response, static, specific routes must ALWAYS be registered ABOVE generic or parameterized routes. If route order is flipped, the static route is completely shadowed.",
  code: `import express from "express";

const app = express();

// CORRECT ORDER: Specific static routes FIRST
app.get("/users/me", (req, res) => {
  res.send("Current Authenticated User Profile");
});

// Generic dynamic parameter routes SECOND
app.get("/users/:id", (req, res) => {
  res.send(\`User profile for ID: \${req.params.id}\`);
});

// TRAP: If /users/:id were placed above /users/me,
// GET /users/me would execute /users/:id with req.params.id === 'me'!`,
  recallHint: "First-match-wins: Always declare specific static routes before dynamic parameter routes.",
  interviewTip: "A classic junior/mid interview trap. Always point out that Express does not calculate 'specificity' like CSS; it matches in strict sequential top-to-bottom order.",
  tags: ["route-order", "precedence", "first-match-wins", "shadowing"]
}));

cards.push(createCard({
  idNum: 22,
  category: "Routing & Route Engine",
  concept: "Catch-All 404 Not Found Route Handling",
  priority: "must-know",
  difficulty: "beginner",
  question: "How do you properly implement a 404 Not Found catch-all handler in Express?",
  answer: "By placing a middleware function (`app.use((req, res, next) => ...)`) at the very end of the middleware stack, immediately after all route definitions, but immediately BEFORE any error-handling middleware. If no preceding route handled the request, execution naturally falls through to this catch-all handler, returning a 404 status.",
  explanation: "In Express, a 404 is NOT an internal error; it simply means no route handler handled the request. If you omit a 404 handler, Express returns a default HTML response `'Cannot GET /url'`. In REST APIs, the 404 handler should return structured JSON.",
  code: `import express from "express";

const app = express();

// Active routes
app.get("/api/items", (req, res) => res.json([]));

// 404 Catch-All Handler: placed AFTER all active routes!
app.use((req, res, next) => {
  res.status(404).json({
    error: "Not Found",
    message: \`Cannot \${req.method} \${req.originalUrl}\`,
    timestamp: new Date().toISOString()
  });
});

// Error-Handling Middleware: placed AFTER 404 handler!
app.use((err, req, res, next) => {
  res.status(500).json({ error: "Internal Server Error" });
});`,
  recallHint: "404 handler: app.use() placed after all routes, before error middleware. Returns status(404).",
  interviewTip: "Clarify that 404 is not an error (don't pass it to `next(err)` unless using custom error classes). It is simply an unmatched request.",
  tags: ["404", "catch-all", "not-found", "middleware-order"]
}));

cards.push(createCard({
  idNum: 23,
  category: "Routing & Route Engine",
  concept: "Regular Expression Constraints on Route Parameters",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "How do you apply regular expression constraints directly to route parameters?",
  answer: "By enclosing the regular expression pattern in parentheses immediately after the parameter name: `'/users/:id(\\\\d+)'`. The route will match ONLY if the parameter matches the regex constraint; otherwise, the router ignores the route and falls through to subsequent handlers.",
  explanation: "This allows distinguishing between numeric IDs and alphanumeric slugs on the same base path: `'/products/:id(\\d+)'` handles numeric product lookups, while `'/products/:slug([a-z-]+)'` handles SEO friendly slugs without collision.",
  code: `import express from "express";

const app = express();

// Matches only numeric IDs: /users/123 (ignores /users/abc)
app.get("/users/:id(\\\\d+)", (req, res) => {
  res.json({ type: "NUMERIC_ID", id: req.params.id });
});

// Matches only 3-letter currency codes: /exchange/USD
app.get("/exchange/:currency([A-Z]{3})", (req, res) => {
  res.json({ currency: req.params.currency });
});`,
  recallHint: "Parameter regex: :param(regex). E.g. :id(\\d+) restricts param to digits.",
  interviewTip: "Note that double backslashes `\\\\d+` are required in string paths because the backslash must be escaped in JavaScript string literals.",
  tags: ["regex-params", "parameter-validation", "routing"]
}));

cards.push(createCard({
  idNum: 24,
  category: "Routing & Route Engine",
  concept: "Sub-Router Prefixing & Deep Modular Nesting",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How do you structure deeply nested resource routers for large enterprise REST APIs in Express?",
  answer: "By creating modular `express.Router()` instances in dedicated module files and mounting them hierarchically using `app.use('/prefix', router)`. Child routers can themselves mount sub-routers, creating a clean tree of route prefixes matching REST resource hierarchy.",
  explanation: "Example topology: `app.use('/api/v1', apiV1Router)`. Inside `apiV1Router`: `apiV1Router.use('/users', userRouter)` and `apiV1Router.use('/orders', orderRouter)`. Each router remains focused entirely on relative paths (`'/'`, `'/:id'`), completely unaware of its top-level mount prefix.",
  code: `import express from "express";

// --- routes/orders.js ---
const orderRouter = express.Router();
orderRouter.get("/", (req, res) => res.json({ orders: [] }));
orderRouter.get("/:id", (req, res) => res.json({ id: req.params.id }));

// --- routes/apiV1.js ---
const v1Router = express.Router();
v1Router.use("/orders", orderRouter); // Nested: /api/v1/orders

// --- app.js ---
const app = express();
app.use("/api/v1", v1Router); // Root: /api/v1

// Final resolved paths:
// GET /api/v1/orders
// GET /api/v1/orders/:id`,
  recallHint: "Modular routers: app.use('/api', v1Router) -> v1Router.use('/orders', orderRouter). Relative paths inside.",
  interviewTip: "Highlight that modular sub-routers allow versioning APIs cleanly (`/api/v1` vs `/api/v2`) without touching individual route handler definitions.",
  tags: ["modular-routers", "nesting", "api-versioning", "architecture"]
}));

module.exports = cards;
