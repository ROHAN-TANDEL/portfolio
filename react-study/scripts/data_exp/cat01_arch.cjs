const { createCard } = require("../exp_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 1,
  category: "Architecture & Application Setup",
  concept: "Express.js Core Architecture & Relationship with http.Server",
  priority: "must-know",
  difficulty: "beginner",
  question: "What is Express.js, what is its internal relationship with Node.js http.Server, and what are its core architectural layers?",
  answer: "Express.js is a minimalist, unopinionated web routing and middleware framework built directly on top of Node.js's native 'http' module. An Express app instance is fundamentally a JavaScript function with signature (req, res) passed directly as the request listener callback to http.createServer(app). It adds two major architectural layers: a linear Middleware Pipeline and a Router matching engine.",
  explanation: "When you call `const app = express()`, it returns an event-driven function inheriting from `EventEmitter` and prototyping onto the Express application prototype. Calling `app.listen(3000)` is syntactic sugar for: `const server = http.createServer(app); server.listen(3000)`. Express does not replace Node's HTTP engine; it enhances `http.IncomingMessage` (as `req`) and `http.ServerResponse` (as `res`) with helper methods like `res.json()`, `res.status()`, and `req.params`.",
  code: `import express from "express";
import http from "node:http";

const app = express();

app.get("/api/health", (req, res) => {
  res.json({ status: "UP", timestamp: Date.now() });
});

// app.listen() is sugar for creating and binding a native http.Server:
const server = http.createServer(app);
server.listen(3000, () => {
  console.log("Server listening on port 3000 via native http.Server bridge");
});`,
  recallHint: "Express app = request listener function (req, res) passed to http.createServer(app).",
  interviewTip: "Interviewers love asking how to integrate WebSockets (ws or socket.io) with Express. Because WebSockets require an HTTP upgrade listener, you must use `http.createServer(app)` explicitly rather than bare `app.listen()`.",
  tags: ["express", "http-server", "architecture", "internals"]
}));

cards.push(createCard({
  idNum: 2,
  category: "Architecture & Application Setup",
  concept: "The express() Application Factory & Settings",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How do application settings work in Express.js via app.set(), app.get(), app.enable(), and app.disable()?",
  answer: "The Express application maintains an internal settings table (`app.settings`). Settings configure runtime behavior, including view engines, JSON formatting, URL parsing, case sensitivity, and reverse proxy trust. Methods: `app.set(name, value)` sets a value, `app.get(name)` retrieves it, while `app.enable(name)` and `app.disable(name)` toggle boolean settings.",
  explanation: "Express defines several built-in configuration keys: 1) `'env'`: environment mode (defaults to `process.env.NODE_ENV` or `'development'`). 2) `'trust proxy'`: controls whether `X-Forwarded-*` headers are respected. 3) `'json spaces'`: indentation for formatted JSON output. 4) `'case sensitive routing'`: treats `/Foo` and `/foo` differently. 5) `'strict routing'`: treats `/users` and `/users/` as distinct paths. 6) `'x-powered-by'`: toggles the `X-Powered-By: Express` response header.",
  code: `import express from "express";

const app = express();

// Configure application settings
app.set("title", "Production API Gateway");
app.enable("case sensitive routing"); // /User !== /user
app.disable("x-powered-by");          // Security: Hide Express header

console.log("App title:", app.get("title"));
console.log("X-Powered-By enabled?", app.enabled("x-powered-by")); // false`,
  recallHint: "app.set/get manages config table. Built-in keys: env, trust proxy, strict routing, x-powered-by.",
  interviewTip: "Always mention disabling `'x-powered-by'` (`app.disable('x-powered-by')`) as a mandatory baseline security step to prevent technology fingerprinting by attackers.",
  tags: ["app-settings", "configuration", "app-set", "security"]
}));

cards.push(createCard({
  idNum: 3,
  category: "Architecture & Application Setup",
  concept: "'trust proxy' Setting & Reverse Proxy IP Resolution",
  priority: "must-know",
  difficulty: "advanced",
  question: "What does the 'trust proxy' setting do in Express, and what are the security risks of misconfiguring it?",
  answer: "When Express runs behind a reverse proxy or load balancer (Nginx, Cloudflare, AWS ALB), client TCP connections terminate at the proxy, meaning `req.socket.remoteAddress` is the proxy's IP address. Enabling `'trust proxy'` tells Express to parse the 'X-Forwarded-For' (XFF), 'X-Forwarded-Proto', and 'X-Forwarded-Host' headers to populate `req.ip`, `req.ips`, and `req.protocol`. Misconfiguring it (e.g. setting `app.set('trust proxy', true)` without a trusted proxy boundary) allows external attackers to spoof their IP address by injecting arbitrary X-Forwarded-For headers, bypassing IP rate limits and geo-fences.",
  explanation: "Values for `'trust proxy'`: 1) `false` (default): ignore all `X-Forwarded-*` headers; `req.ip` is the socket IP. 2) `true`: trust the last hop blindly (vulnerable if clients connect directly). 3) Number `n`: trust the $n^{\\text{th}}$ hop from the front-facing proxy. 4) IP / Subnet string: trust specific proxy IPs, e.g. `'loopback, 10.0.0.0/8'` or `'172.16.0.0/12'`. 5) Custom predicate function: `(ip) => boolean`.",
  code: `import express from "express";

const app = express();

// Secure configuration: trust only known private CIDR blocks / local proxies
app.set("trust proxy", "loopback, linklocal, uniquelocal");

app.get("/api/client-ip", (req, res) => {
  // req.ip correctly resolves the genuine client IP from X-Forwarded-For
  res.json({
    clientIp: req.ip,
    proxyHops: req.ips, // Array of client IPs from closest to farthest
    secureProtocol: req.protocol // 'https' if X-Forwarded-Proto was https
  });
});`,
  recallHint: "trust proxy: parses X-Forwarded-For headers. Never set 'true' unconditionally; whitelist proxy CIDRs.",
  interviewTip: "This is a critical security interview question. Explain that setting `trust proxy: true` without a fronting proxy allows attackers to bypass `express-rate-limit` by sending fake `X-Forwarded-For: 1.2.3.4` headers.",
  tags: ["trust-proxy", "x-forwarded-for", "networking", "security"]
}));

cards.push(createCard({
  idNum: 4,
  category: "Architecture & Application Setup",
  concept: "Case-Sensitive and Strict Routing Settings",
  priority: "intermediate",
  difficulty: "beginner",
  question: "What is the difference between 'case sensitive routing' and 'strict routing' in Express?",
  answer: "'case sensitive routing' determines whether casing in URL paths is treated as distinct (e.g. `/Users` vs `/users`). By default it is disabled (case-insensitive). 'strict routing' determines whether trailing slashes in URLs are treated as distinct (e.g. `/users` vs `/users/`). By default it is disabled, meaning trailing slashes are treated identically.",
  explanation: "When `'case sensitive routing'` is enabled (`app.set('case sensitive routing', true)`), `/api/order` and `/api/Order` match separate route handlers. When `'strict routing'` is enabled (`app.set('strict routing', true)`), `/reports` will not match `/reports/`. Routers can also configure these settings independently via `express.Router({ caseSensitive: true, strict: true })`.",
  code: `import express from "express";

const app = express();

app.enable("strict routing");
app.enable("case sensitive routing");

// Matches ONLY exact lowercase without trailing slash:
app.get("/items", (req, res) => {
  res.send("Matches /items strictly");
});

// Matches ONLY with trailing slash:
app.get("/items/", (req, res) => {
  res.send("Matches /items/ with trailing slash");
});`,
  recallHint: "case sensitive: /user !== /User. strict routing: /user !== /user/.",
  interviewTip: "Mention that search engines (SEO) treat `/page` and `/page/` as duplicate content. Enabling strict routing or configuring canonical 301 redirects fixes duplicate URL indexing.",
  tags: ["routing", "case-sensitive", "strict-routing", "seo"]
}));

cards.push(createCard({
  idNum: 5,
  category: "Architecture & Application Setup",
  concept: "Sub-App Mounting (app.use) & app.mountpath",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "How does Sub-Application mounting work in Express using app.use(), and what is app.mountpath?",
  answer: "In Express, an `express()` application can be mounted as middleware inside another parent Express application using `app.use('/prefix', subApp)`. The property `subApp.mountpath` returns the path pattern on which the sub-app was mounted. Mounting triggers a `'mount'` event on the sub-app, passing the parent app instance.",
  explanation: "Sub-apps provide full encapsulation: a sub-app has its own settings, view engine, middleware stack, and routes. This pattern enables clean modular monolith architectures where distinct domain modules (e.g. `adminApp`, `billingApp`, `apiApp`) are developed independently and mounted to a master gateway app.",
  code: `import express from "express";

const adminApp = express();
adminApp.get("/", (req, res) => {
  res.send(\`Admin Dashboard mounted at: \${adminApp.mountpath}\`);
});

adminApp.on("mount", (parent) => {
  console.log("Admin sub-app mounted onto parent gateway!");
});

const mainApp = express();
// Mount admin sub-app at /admin prefix
mainApp.use("/admin", adminApp);

// Visiting /admin renders "Admin Dashboard mounted at: /admin"`,
  recallHint: "Sub-app mounting: app.use('/path', subApp). subApp.mountpath exposes mount prefix.",
  interviewTip: "Contrast sub-apps with `express.Router()`. Routers share the parent app's settings and view engines; sub-apps are complete independent applications with isolated settings tables.",
  tags: ["sub-apps", "mountpath", "modular-architecture", "app-use"]
}));

cards.push(createCard({
  idNum: 6,
  category: "Architecture & Application Setup",
  concept: "Express Request Lifecycle Pipeline",
  priority: "must-know",
  difficulty: "intermediate",
  question: "Trace the complete lifecycle of an HTTP request through an Express.js application from socket arrival to response termination.",
  answer: "1) TCP socket handshake finishes and Node.js 'http' server emits a 'request' event with native (req, res). 2) Express initializes request: augments prototypes (adding Express helper methods) and sets res.locals. 3) The request enters the Router middleware pipeline, traversing matching Layer instances sequentially. 4) Body parsers read incoming data streams and populate `req.body`. 5) Route handler matches path and executes business logic. 6) Handler invokes `res.send()` / `res.json()`, setting headers and writing chunks to the TCP socket stream. 7) Node flushes the response buffer, emits 'finish', and closes or keeps the socket alive.",
  explanation: "If an error occurs at any point (synchronous throw or calling `next(err)`), Express skips all remaining standard middleware layers and jumps straight to the 4-argument Error Handling middleware stack `(err, req, res, next)`. If no handler ends the response, execution falls through to the 404 handler.",
  code: `import express from "express";

const app = express();

// Lifecycle stage 1: Global telemetry middleware
app.use((req, res, next) => {
  req.startTime = performance.now();
  res.on("finish", () => {
    const elapsed = (performance.now() - req.startTime).toFixed(2);
    console.log(\`[\${req.method}] \${req.url} -> \${res.statusCode} (\${elapsed}ms)\`);
  });
  next();
});

// Lifecycle stage 2: Body parser stream consumer
app.use(express.json());

// Lifecycle stage 3: Route execution & response flush
app.get("/api/users", (req, res) => {
  res.json([{ id: 1, name: "Alice" }]); // Flushes response
});`,
  recallHint: "Lifecycle: Node http event -> Express prototype wrap -> Middleware layers -> Route -> res.send -> Socket flush.",
  interviewTip: "Always mention `res.on('finish')`. It is the standard event fired when the last response chunk has been handed off to the operating system network subsystem.",
  tags: ["request-lifecycle", "pipeline", "internals", "architecture"]
}));

cards.push(createCard({
  idNum: 7,
  category: "Architecture & Application Setup",
  concept: "Express App vs Express Router",
  priority: "must-know",
  difficulty: "beginner",
  question: "What are the fundamental differences between the express() Application and express.Router()?",
  answer: "The Express App (`express()`) is the top-level application singleton that binds to Node's HTTP server (`app.listen()`), manages global configuration settings (`app.set()`), mounts template view engines (`app.engine()`), and holds the root routing table. `express.Router()` is an isolated mini-application incapable of listening on a port or holding global settings; it is purely a routing and middleware dispatch container designed to be mounted onto an app.",
  explanation: "Routers are modular, mountable route handlers. You organize your codebase into resource routers (`userRouter`, `orderRouter`, `authRouter`) and mount them via `app.use('/users', userRouter)`. Routers can be nested inside other routers arbitrarily deep.",
  code: `import express from "express";

// 1. Top-level Application
const app = express();
app.set("view engine", "ejs"); // App-level setting

// 2. Resource Router
const productRouter = express.Router();
productRouter.get("/", (req, res) => res.json({ products: [] }));
productRouter.get("/:id", (req, res) => res.json({ id: req.params.id }));

// 3. Mount Router onto App
app.use("/api/v1/products", productRouter);

app.listen(3000); // Only App can listen!`,
  recallHint: "App = top-level server, holds settings, calls listen(). Router = modular mini-router, mounts via app.use().",
  interviewTip: "Interviewers frequently ask: 'Can a Router have its own middleware?' Yes! `router.use(authMiddleware)` applies middleware strictly to that router's routes without affecting parent app routes.",
  tags: ["app-vs-router", "router", "modularity", "architecture"]
}));

cards.push(createCard({
  idNum: 8,
  category: "Architecture & Application Setup",
  concept: "Serving Static Files with express.static()",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does express.static() serve assets, and what production options should be configured?",
  answer: "`express.static(root, [options])` is Express's built-in static file server middleware powered by the 'send' module. In production, you must configure options: `maxAge` (Cache-Control headers), `etag` (ETag generation), `dotfiles` (ignoring hidden files), `immutable` (caching immutable hashed assets for 1 year), and `setHeaders` for custom security headers.",
  explanation: "By default, `express.static` does not serve hidden files (`dotfiles: 'ignore'`). Setting `maxAge: '1y', immutable: true` tells browser caches and CDNs to cache bundled JS/CSS indefinitely. In high-traffic production environments, static files are typically offloaded to Nginx or AWS S3/CloudFront, but configuring `express.static` properly is vital for containerized microservices.",
  code: `import express from "express";
import path from "node:path";

const app = express();

const staticOptions = {
  dotfiles: "ignore",       // Block .env, .git, etc.
  etag: true,               // Enable 304 Not Modified validation
  index: false,             // Disable automatic directory index.html
  maxAge: "1d",             // Cache for 24 hours
  redirect: false,          // Disable trailing slash redirects
  setHeaders: (res, path) => {
    // Add security headers on static assets
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
};

app.use("/static", express.static(path.join(process.cwd(), "public"), staticOptions));`,
  recallHint: "express.static options: maxAge, etag, dotfiles: 'ignore', immutable, setHeaders.",
  interviewTip: "Highlight the `dotfiles: 'ignore'` option. If misconfigured to `'allow'`, malicious users could download `.env` configuration files or `.git` directories if placed in the public root.",
  tags: ["static-files", "caching", "express-static", "security"]
}));

cards.push(createCard({
  idNum: 9,
  category: "Architecture & Application Setup",
  concept: "View Engine Pipeline & Template Rendering",
  priority: "intermediate",
  difficulty: "beginner",
  question: "How does the template rendering pipeline work in Express via res.render() and app.engine()?",
  answer: "When `res.render(view, [locals], callback)` is called, Express resolves the view file using `'views'` directory setting and `'view engine'` extension setting. It passes `app.locals` merged with `res.locals` and call-level `locals` to the registered rendering engine (e.g. EJS, Pug, Handlebars). The engine compiles the template into an HTML string and sends it via `res.send()`.",
  explanation: "Custom template engines can be registered using `app.engine(ext, callback)`. Locals precedence order: call-site `locals` override `res.locals`, which override `app.locals`. In modern decoupled architectures (React/Vue/Angular), SSR is handled by Next.js or Vite, but `res.render()` remains essential for transactional email templates and HTML report generation.",
  code: `import express from "express";
import path from "node:path";

const app = express();

app.set("views", path.join(process.cwd(), "views"));
app.set("view engine", "ejs");

// Global locals available to all templates:
app.locals.siteName = "Enterprise Portal";

app.get("/welcome", (req, res) => {
  // Request-scoped locals:
  res.locals.user = { name: "Alice" };

  // Render 'welcome.ejs' with merged locals
  res.render("welcome", { pageTitle: "Home Page" });
});`,
  recallHint: "res.render merges app.locals + res.locals + call options, passes to template engine, sends HTML.",
  interviewTip: "Explain that `app.locals` persists across the entire application lifetime, whereas `res.locals` is scoped strictly to a single HTTP request lifecycle.",
  tags: ["view-engine", "res-render", "template-engines", "locals"]
}));

cards.push(createCard({
  idNum: 10,
  category: "Architecture & Application Setup",
  concept: "Integrating WebSockets alongside Express on a Shared HTTP Server",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How do you run a WebSocket server (ws / Socket.io) alongside an Express application on the exact same TCP port?",
  answer: "By creating an explicit Node.js `http.Server` wrapping the Express app instance (`const server = http.createServer(app)`), and attaching the WebSocket server to the shared `server` instance. The HTTP server delegates normal HTTP requests to Express, and handles HTTP 'upgrade' requests for WebSockets.",
  explanation: "WebSockets begin as standard HTTP requests with an `Upgrade: websocket` header. When the client requests an upgrade, Node's `http.Server` emits an `'upgrade'` event. If you use `app.listen()`, the server instance is created internally, making it harder to intercept upgrade events or share the socket cleanly across multiple transports.",
  code: `import express from "express";
import http from "node:http";
import { WebSocketServer } from "ws";

const app = express();
app.get("/api/status", (req, res) => res.json({ status: "API OK" }));

// 1. Shared Node.js HTTP Server
const server = http.createServer(app);

// 2. Attach WebSocket Server to shared HTTP server
const wss = new WebSocketServer({ server, path: "/ws" });

wss.on("connection", (socket, req) => {
  console.log("WebSocket connected from:", req.socket.remoteAddress);
  socket.send(JSON.stringify({ event: "CONNECTED" }));
});

// Single port for BOTH REST and WebSockets!
server.listen(8080, () => {
  console.log("REST on http://localhost:8080 and WS on ws://localhost:8080/ws");
});`,
  recallHint: "Use http.createServer(app) to bind both Express REST routes and WebSocketServer on 1 port.",
  interviewTip: "Highlight that running REST and WebSockets on the same port eliminates CORS/port issues and allows sharing reverse proxy SSL/TLS certificates.",
  tags: ["websockets", "http-server", "ws", "socket-io"]
}));

cards.push(createCard({
  idNum: 11,
  category: "Architecture & Application Setup",
  concept: "Combining Express with HTTP/2 and HTTPS",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "How do you run Express with native HTTPS and HTTP/2 multiplexing in Node.js?",
  answer: "By importing Node's native 'https' or 'http2' module, passing SSL/TLS certificates (`key` and `cert`), and supplying the Express `app` as the request listener. For HTTP/2, using the `http2.createSecureServer()` API with Express requires compatibility adapters or Express 5.",
  explanation: "In production, SSL/TLS termination is typically offloaded to reverse proxies (Nginx, AWS ALB, Cloudflare). However, in zero-trust internal service meshes or compliance environments (HIPAA/PCI-DSS), end-to-end encryption requires Express to serve HTTPS directly.",
  code: `import express from "express";
import https from "node:https";
import fs from "node:fs";

const app = express();
app.get("/api/secure", (req, res) => res.send("TLS Encrypted"));

// Read SSL/TLS certificates
const sslOptions = {
  key: fs.readFileSync("./certs/server.key"),
  cert: fs.readFileSync("./certs/server.crt")
};

// Bind Express to HTTPS server
const httpsServer = https.createServer(sslOptions, app);
httpsServer.listen(8443, () => {
  console.log("Secure Express running on https://localhost:8443");
});`,
  recallHint: "https.createServer({ key, cert }, app).listen(443). Usually offloaded to reverse proxy.",
  interviewTip: "Mention that in production, SSL termination at the reverse proxy (ALB/Nginx) is preferred to reduce CPU overhead on Node's single-threaded event loop.",
  tags: ["https", "http2", "ssl", "tls", "security"]
}));

cards.push(createCard({
  idNum: 12,
  category: "Architecture & Application Setup",
  concept: "Graceful Teardown & Active Connection Draining",
  priority: "must-know",
  difficulty: "advanced",
  question: "Why does calling server.close() not immediately terminate an Express app, and how do you drain keep-alive sockets?",
  answer: "`server.close()` stops the HTTP server from accepting NEW incoming connections, but it keeps the process alive until all EXISTING open connections (especially idle HTTP keep-alive connections) close naturally. To achieve zero-downtime rolling deploys in Kubernetes or Docker, the application must track active sockets or use Node 18+ `server.closeIdleConnections()` and `server.closeClientConnections()`.",
  explanation: "Browsers reuse TCP sockets via HTTP Keep-Alive for 5–60 seconds. If a pod receives a `SIGTERM` and merely calls `server.close()`, open keep-alive sockets will prevent the process from exiting until the Kubernetes 30s grace period expires and issues a hard `SIGKILL`, abruptly dropping in-flight user requests.",
  code: `import express from "express";
import http from "node:http";

const app = express();
const server = http.createServer(app);

server.listen(3000);

function gracefulShutdown(signal) {
  console.log(\`Received \${signal}. Starting graceful shutdown...\`);

  // 1. Stop accepting new connections
  server.close(() => {
    console.log("All HTTP connections closed cleanly. Exiting.");
    process.exit(0);
  });

  // 2. Node 18+ API: Close idle keep-alive connections immediately
  if (server.closeIdleConnections) {
    server.closeIdleConnections();
  }

  // 3. Force exit if active connections fail to drain within 10s timeout
  setTimeout(() => {
    console.error("Forcefully shutting down remaining connections.");
    if (server.closeClientConnections) server.closeClientConnections();
    process.exit(1);
  }, 10000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));`,
  recallHint: "server.close() waits for keep-alive sockets. Use server.closeIdleConnections() and force timeout.",
  interviewTip: "Explain why `setTimeout(...).unref()` is used: `unref()` allows the Node event loop to exit naturally if all connections finish before the timeout expires.",
  tags: ["graceful-shutdown", "keep-alive", "kubernetes", "signals"]
}));

module.exports = cards;
