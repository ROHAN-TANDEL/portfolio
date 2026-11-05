const { createCard } = require("../exp_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 109,
    category: "Modern Standards, Express 5 & Performance",
    concept: "Express 5 Breaking Changes and Migration Guide from Express 4",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are the major breaking changes and architectural upgrades introduced in Express 5?",
    quickAnswer: "Express 5 brings: 1. Native asynchronous error handling (promises that reject in route handlers are caught automatically). 2. Upgraded `path-to-regexp` (v8) with stricter route pattern syntax (no unescaped wildcards or bare `*`). 3. Removal of deprecated methods (`res.send(status)`, `res.json(status, obj)`, `app.del()`). 4. `req.query` defaults to the `'extended'` parser. 5. Node.js minimum engine version bumped to Node 18+.",
    detailedAnswer: "Express 5 Migration Checklist:\n- Native Async: You can delete `express-async-errors` or custom `asyncHandler` wrappers.\n- Route Wildcards: Route `/*` must be migrated to `/{*splat}` or explicit named parameters.\n- Removed Signatures: `res.send(404)` is gone; replace with `res.sendStatus(404)` or `res.status(404).send()`.\n- Query Parser: Default changed to extended (`qs` library), supporting nested objects by default.\n- Prototype methods: `res.header()` and `req.header()` are strictly aliases to `res.set()` and `req.get()`.",
    code: `// EXPRESS 4 (Legacy patterns that break in Express 5):
// app.get('*', (req, res) => res.send(404, 'Not found')); // Throws in Express 5!
// app.del('/user', handler); // app.del removed!

// EXPRESS 5 MIGRATION (Modern compliant code):
const express = require('express');
const app = express();

// 1. Clean native async handler (no try/catch or wrapper required)
app.get('/api/users/:id', async (req, res) => {
  const user = await userRepository.find(req.params.id);
  if (!user) {
    // 2. Explicit res.status().json()
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

// 3. Modern path-to-regexp v8 syntax for catch-all
app.all('/{*splat}', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});`,
    recallHint: "Express 5 = native async promise rejection, path-to-regexp v8 ({*splat}), removal of res.send(status) and app.del().",
    interviewTip: "Interviewers love asking about Express 5's long release cycle. Highlighting native promise handling and the `path-to-regexp` v8 overhaul shows you are current with the modern ecosystem.",
    tags: ["express-5", "breaking-changes", "migration", "async-handlers", "path-to-regexp"]
  }),

  createCard({
    idNum: 110,
    category: "Modern Standards, Express 5 & Performance",
    concept: "Native Promise Rejection Handling in Express 5 vs express-async-errors",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Express 5 eliminate the need for `express-async-errors` and custom `asyncHandler` wrappers?",
    quickAnswer: "In Express 4, if an `async` function threw an error, the returned Promise rejected unhandled unless wrapped in `try/catch` and passed to `next(err)`. In Express 5, the router internally inspects the return value of every middleware and route handler: if it detects a Promise, it automatically attaches `.catch(next)`, piping all unhandled promise rejections directly into the error-handling pipeline.",
    detailedAnswer: "Under the Hood:\nExpress 5 wraps handler execution in Promise resolution:\n```javascript\nconst result = fn(req, res, next);\nif (result && typeof result.then === 'function') {\n  result.catch(next);\n}\n```\nThis eliminates monkey-patching packages like `express-async-errors` (which overwrote `Layer.prototype.handle_request`) and boilerplate wrapper functions like `const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);`.",
    code: `// EXPRESS 5: Zero wrapper boilerplate!
app.get('/api/dashboard', async (req, res) => {
  // If fetchAnalytics throws or rejects, Express 5 automatically catches it
  // and invokes app.use((err, req, res, next) => ...)
  const analytics = await fetchAnalytics();
  res.json(analytics);
});

// Global error handler receives any async rejections automatically
app.use((err, req, res, next) => {
  res.status(500).json({
    success: false,
    message: err.message
  });
});`,
    recallHint: "Express 5 attaches .catch(next) to returned promises automatically, eliminating asyncHandler wrappers.",
    interviewTip: "Contrast Express 4's monkey-patching approach (`express-async-errors`) with Express 5's native event loop promise chaining.",
    tags: ["express-5", "async-await", "promise-handling", "async-errors", "clean-code"]
  }),

  createCard({
    idNum: 111,
    category: "Modern Standards, Express 5 & Performance",
    concept: "Path-to-Regexp Evolution (v0.1.x to v8.x in Express 5) & Regex Syntax Changes",
    priority: "must-know",
    difficulty: "advanced",
    question: "What changed in route path matching with Express 5's upgrade to `path-to-regexp` v8?",
    quickAnswer: "Express 4 used `path-to-regexp` v0.1.7, which permitted loose regular expression syntax, bare asterisks (`*`), and unescaped special characters. Express 5 upgrades to `path-to-regexp` v8, which requires strict parameter naming: wildcards must use named parameters with modifier syntax (e.g. `/{*splat}` or `/:file*`), and raw regular expression characters like `?`, `+`, `*`, `(`, `)` must be escaped.",
    detailedAnswer: "Key Syntax Changes in Express 5:\n- Wildcards: `app.get('*', ...)` throws a TypeError! Use `app.get('/{*splat}', ...)` instead.\n- Optional parameters: `/users/:id?` is replaced by `/users{/:id}` or named parameter patterns.\n- Regular expressions in routes: `/flights/:from-:to` now enforces strict character boundaries.\n- Performance: `path-to-regexp` v8 is significantly faster and compiles to more efficient native RegEx objects.",
    code: `// EXPRESS 4 (Breaks in Express 5!):
// app.get('/files/*', (req, res) => { ... });

// EXPRESS 5 COMPLIANT ROUTING:
const express = require('express');
const app = express();

// Named wildcard with modifier
app.get('/files/{*filePath}', (req, res) => {
  // Matched path accessible via req.params.filePath
  const path = req.params.filePath; // e.g. 'docs/2026/report.pdf'
  res.json({ requestedFile: path });
});

// Optional path segments
app.get('/users{/:userId}', (req, res) => {
  const userId = req.params.userId; // Defined if provided, undefined if omitted
  res.json({ userId: userId || 'current_user' });
});`,
    recallHint: "Express 5 uses path-to-regexp v8; raw asterisks (*) throw errors, use named wildcards like /{*\splat} and explicit segment groups.",
    interviewTip: "This is a frequent migration blocker when upgrading large codebases to Express 5: legacy 404 handlers using `app.use('*', ...)` immediately crash on server startup.",
    tags: ["path-to-regexp", "route-syntax", "wildcards", "express-5", "breaking-changes"]
  }),

  createCard({
    idNum: 112,
    category: "Modern Standards, Express 5 & Performance",
    concept: "Deprecated and Removed Methods in Express 5 (res.send, res.json, app.del)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Which deprecated methods and signatures were completely removed in Express 5?",
    quickAnswer: "1. `res.send(status, body)` and `res.send(status)` were removed; use `res.status(code).send(body)` or `res.sendStatus(code)`. 2. `res.json(status, obj)` and `res.jsonp(status, obj)` were removed; use `res.status(code).json(obj)`. 3. `app.del()` was removed; use `app.delete()`. 4. `app.param(fn)` custom parameter logic was simplified. 5. `req.param(name)` was removed in favor of explicit `req.params`, `req.query`, or `req.body`.",
    detailedAnswer: "Why Were They Removed?\nIn Express 3 and 4, polymorphic methods with numeric status arguments caused widespread bugs (e.g. `res.send(200)` was misinterpreted as sending the number 200 vs setting status code 200).\n`req.param(name)` checked params, then body, then query in arbitrary priority, enabling parameter injection vulnerabilities.\n\nExpress 5 enforces clean, unambiguous, explicit API calls.",
    code: `// DEPRECATED & REMOVED (Express 4):
// res.send(404, 'Not Found');
// res.json(500, { error: 'Fatal' });
// req.param('userId');
// app.del('/item', handler);

// EXPRESS 5 MODERN STANDARD:
// 1. Explicit chained status + send/json
res.status(404).send('Not Found');
res.status(500).json({ error: 'Fatal' });

// 2. Dedicated sendStatus for empty body responses
res.sendStatus(204); // Sends 'No Content' with status 204

// 3. Explicit parameter access
const userId = req.params.userId || req.query.userId || req.body.userId;

// 4. Standard HTTP verb method
app.delete('/item', (req, res) => res.sendStatus(204));`,
    recallHint: "res.send(status, body) and req.param() are removed in Express 5; use res.status().json() and req.params/query explicitly.",
    interviewTip: "Highlight that removing `req.param()` fixes a significant security flaw: attackers could inject query parameters that overrode critical route params.",
    tags: ["deprecated-methods", "express-5", "api-cleanup", "sendStatus", "security"]
  }),

  createCard({
    idNum: 113,
    category: "Modern Standards, Express 5 & Performance",
    concept: "HTTP Keep-Alive and Socket Reuse in Node.js & Express",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does HTTP Keep-Alive impact Express performance, and how do you configure socket reuse?",
    quickAnswer: "HTTP Keep-Alive allows a single TCP connection to serve multiple consecutive HTTP requests, eliminating the expensive 3-way TCP handshake and TLS negotiation latency for subsequent requests. By default in Node 19+, Keep-Alive is enabled with a default timeout of 5 seconds (`server.keepAliveTimeout`).",
    detailedAnswer: "Performance Impact:\nEstablishing a TLS connection takes 1-2 network round trips (~50-100ms). Without Keep-Alive, high-throughput microservices waste up to 40% of CPU and network bandwidth negotiating new TCP/TLS connections on every request.\n\nProxy Coordination:\nWhen sitting behind reverse proxies (AWS ALB, Nginx):\nSet `server.keepAliveTimeout` higher than the upstream proxy's keep-alive timeout (e.g. ALB = 60s, Express = 65s) to prevent race conditions where Express closes an idle socket just as the proxy routes a new request (causing 502 Bad Gateway).",
    code: `const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

// Keep-Alive Configuration for AWS ALB / Nginx reverse proxies
server.keepAliveTimeout = 65000; // 65 seconds (must be higher than upstream proxy)
server.headersTimeout = 66000; // 66 seconds (must be higher than keepAliveTimeout)

app.get('/api/ping', (req, res) => {
  // TCP socket stays open for subsequent requests from same client/proxy
  res.json({ pong: true });
});

server.listen(3000);`,
    recallHint: "Keep-Alive reuses TCP/TLS connections across requests; Express keepAliveTimeout must exceed upstream proxy timeout to avoid 502s.",
    interviewTip: "The 502 Bad Gateway issue between AWS ALB and Node.js keep-alive timeouts is a legendary production gotcha. Explaining `server.keepAliveTimeout = 65000` proves real AWS production experience.",
    tags: ["keep-alive", "tcp-sockets", "alb", "nginx", "performance", "networking"]
  }),

  createCard({
    idNum: 114,
    category: "Modern Standards, Express 5 & Performance",
    concept: "Response Compression (Gzip / Brotli) and When NOT to Compress (CRIME / BREACH)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you configure response compression in Express, and when should compression be avoided for security reasons?",
    quickAnswer: "The `compression` middleware compresses HTTP response bodies using Gzip or Brotli, reducing network payload sizes by up to 70-80%. However, compression must be disabled or carefully scoped when responses contain both secret tokens (CSRF tokens, sessions) and user-reflected input to prevent BREACH / CRIME side-channel attacks.",
    detailedAnswer: "BREACH & CRIME Attacks:\nAn attacker who can inject text into an HTTPS page and observe the compressed response size can deduce secret session tokens character by character by measuring compression dictionary efficiency.\n\nBest Practices:\n1. Filter small responses: Never compress payloads smaller than 1KB (`threshold: 1024`); the compression header overhead actually increases size.\n2. Do NOT compress binary images, videos, or PDFs (already compressed; wastes server CPU).\n3. Offload compression to Nginx, Cloudflare, or AWS CloudFront CDN edge whenever possible.",
    code: `const express = require('express');
const compression = require('compression');
const app = express();

app.use(compression({
  // Only compress responses larger than 1KB
  threshold: 1024,
  filter: (req, res) => {
    // Check if client explicitly requested no compression
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Fallback to standard compression filter (checks content-type)
    return compression.filter(req, res);
  }
}));

app.get('/api/large-dataset', (req, res) => {
  // Automatically compressed with gzip or br depending on client Accept-Encoding
  res.json({ data: new Array(5000).fill({ id: 1, name: 'Sample Item' }) });
});`,
    recallHint: "compression middleware uses gzip/brotli for payloads > 1KB; beware BREACH attacks when reflecting secrets and user input together.",
    interviewTip: "State clearly that in high-scale production, compression is best offloaded to edge reverse proxies or CDNs (Cloudflare, Fastly) to save Node.js CPU cycles.",
    tags: ["compression", "gzip", "brotli", "breach-attack", "performance", "cdn"]
  }),

  createCard({
    idNum: 115,
    category: "Modern Standards, Express 5 & Performance",
    concept: "Node.js Multi-Core Clustering & PM2 Process Management for Express",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you scale an Express application across all available CPU cores using Node's `cluster` module or PM2?",
    quickAnswer: "Node.js runs single-threaded by default, utilizing only 1 CPU core regardless of server capacity. Using Node's native `cluster` module or process managers like PM2 (`pm2 start app.js -i max`), the master process forks worker processes that share the same server port via OS socket sharing, scaling throughput linearly with CPU cores.",
    detailedAnswer: "Clustering Mechanics:\n- Master process forks N workers (typically `os.cpus().length`).\n- Master handles worker death events and spawns replacement workers (zero-downtime crash recovery).\n- TCP connection distribution: On Linux/macOS, Node's cluster module distributes incoming connections across workers using round-robin scheduling.\n- In Kubernetes/Docker containers, clustering is often omitted in favor of running 1 container per 1 CPU core and letting Kubernetes orchestrate pod scaling.",
    code: `// cluster.js (Native Node.js Clustering)
const cluster = require('cluster');
const os = require('os');
const http = require('http');

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(\`Primary \${process.pid} is running. Forking \${numCPUs} workers...\`);

  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Auto-restart dead workers
  cluster.on('exit', (worker, code, signal) => {
    console.warn(\`Worker \${worker.process.pid} died. Forking replacement...\`);
    cluster.fork();
  });
} else {
  // Workers share the TCP connection port
  const express = require('express');
  const app = express();

  app.get('/api/work', (req, res) => {
    res.send(\`Handled by worker \${process.pid}\`);
  });

  app.listen(3000, () => {
    console.log(\`Worker \${process.pid} listening on port 3000\`);
  });
}`,
    recallHint: "Cluster module or PM2 forks workers per CPU core sharing port 3000; Kubernetes alternatives run 1 process per container.",
    interviewTip: "Explain statefulness in clustered environments: in-memory state (sessions, counters, socket.io connections) breaks in a cluster without shared external state (Redis).",
    tags: ["cluster", "pm2", "multi-core", "concurrency", "horizontal-scaling"]
  }),

  createCard({
    idNum: 116,
    category: "Modern Standards, Express 5 & Performance",
    concept: "HTTP Conditional Requests, ETags, and 304 Not Modified Caching Mechanics",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do ETags and conditional HTTP requests work in Express to save bandwidth and improve client performance?",
    quickAnswer: "Express generates weak ETags (`W/\"...\"`) by default for response bodies. The client caches the response and sends the ETag back in the `If-None-Match` header on subsequent requests. If the generated ETag matches, Express sends `HTTP 304 Not Modified` with an empty body, saving bandwidth and network transfer time.",
    detailedAnswer: "ETag Mechanics:\n1. Server sends: `ETag: W/\"4a-18b0f92\"` with 200 OK.\n2. Browser caches response.\n3. On refresh, browser sends: `If-None-Match: W/\"4a-18b0f92\"`.\n4. Express checks `req.fresh`. If true, `res.send()` sends `304 Not Modified` with 0 byte body.\n\nConfiguration:\n- `app.set('etag', 'weak')` (default): Fast CRC32 or hash of content length.\n- `app.set('etag', 'strong')`: Exact SHA-1 byte match.\n- `app.set('etag', false)`: Disables ETag generation completely to save CPU if a reverse proxy handles caching.",
    code: `const express = require('express');
const app = express();

// Configure ETag generation mode
app.set('etag', 'weak'); // Default

app.get('/api/catalogs', (req, res) => {
  const catalog = getProductCatalog();

  // Set explicit Cache-Control header
  res.set('Cache-Control', 'public, max-age=300, must-revalidate');

  // res.json / res.send generates ETag automatically.
  // If client sent matching If-None-Match header, Express
  // immediately returns 304 Not Modified without sending the body!
  res.json(catalog);
});`,
    recallHint: "ETags enable 304 Not Modified conditional responses; saves bandwidth by letting clients reuse browser-cached bodies.",
    interviewTip: "Point out that while 304 responses save network transfer bandwidth, your server still had to compute the data to calculate the ETag. For maximum performance, combine ETags with Redis caching.",
    tags: ["etags", "http-304", "conditional-requests", "caching", "cache-control"]
  }),

  createCard({
    idNum: 117,
    category: "Modern Standards, Express 5 & Performance",
    concept: "Memory Leak Detection and Heap Profiling in Express Applications",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are the most common memory leak sources in Express applications, and how do you profile heap usage?",
    quickAnswer: "Common leak sources: 1. Unbounded global arrays/caches (growing indefinitely). 2. Forgotten event listeners (`req.on('data')` without cleanup). 3. Closures retaining references to request objects. 4. Uncollected timers/intervals. Diagnose using Node's `--inspect` flag with Chrome DevTools heap snapshots or taking programmatic snapshots with `v8.writeHeapSnapshot()`.",
    detailedAnswer: "Detecting Leaks:\n- Symptom: Server process memory (`process.memoryUsage().heapUsed`) continuously climbs and never plateaus after garbage collection (sawtooth pattern turns into steady upward slope until OOM crash).\n- Inspection: Take two heap snapshots 10 minutes apart under load. Filter by 'Objects allocated between Snapshot 1 and Snapshot 2' in Chrome DevTools to pinpoint uncollected objects.",
    code: `const v8 = require('v8');
const fs = require('fs');

// Diagnostic endpoint to trigger heap snapshot in staging/production
app.post('/api/admin/debug/heap-dump', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).send('Disabled in production');
  }

  const filename = \`heap-\${Date.now()}.heapsnapshot\`;
  const snapshotPath = v8.writeHeapSnapshot(filename);

  res.json({ message: 'Heap snapshot created', path: snapshotPath });
});

// MEMORY LEAK EXAMPLE:
const requestHistory = []; // LEAK: Global array never purged!
app.use((req, res, next) => {
  // Retaining closures or whole req objects leaks massive memory
  requestHistory.push({ path: req.path, time: new Date() });
  next();
});`,
    recallHint: "Leaks occur via unbounded global arrays, uncollected listeners, and closures; diagnose with v8.writeHeapSnapshot and Chrome DevTools.",
    interviewTip: "Never store in-memory caches in plain JavaScript objects or arrays without an eviction policy (like LRU cache with max capacity) in production.",
    tags: ["memory-leaks", "heap-dump", "v8", "profiling", "garbage-collection"]
  }),

  createCard({
    idNum: 118,
    category: "Modern Standards, Express 5 & Performance",
    concept: "Event Loop Lag Monitoring and Load Shedding Under Heavy Traffic",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Event Loop Lag in Express, why is it dangerous, and how do you implement Load Shedding?",
    quickAnswer: "Event loop lag is the delay between when an asynchronous callback is scheduled and when the single-threaded event loop actually executes it. High lag (> 50-100ms) indicates CPU starvation. Load shedding detects extreme event loop lag or queue backlog and rejects incoming requests with `503 Service Unavailable`, preventing total server collapse and allowing the event loop to recover.",
    detailedAnswer: "Why Load Shedding?\nWhen an Express server is overwhelmed, queueing more requests increases latency for ALL users until every request times out. Load shedding drops a percentage of traffic immediately, preserving low latency and reliability for in-flight requests.\n\nMonitoring Event Loop Lag:\nNode's `perf_hooks` provides `monitorEventLoopDelay()`, calculating percentile delays (p50, p99).",
    code: `const { monitorEventLoopDelay } = require('perf_hooks');

// Measure event loop delay with 20ms resolution
const h = monitorEventLoopDelay({ resolution: 20 });
h.enable();

const MAX_EVENT_LOOP_LAG_MS = 100; // 100ms threshold

// Load Shedding Middleware
app.use((req, res, next) => {
  // Convert nanoseconds to milliseconds (p99 delay)
  const p99LagMs = Number(h.percentile(99)) / 1e6;

  if (p99LagMs > MAX_EVENT_LOOP_LAG_MS) {
    console.warn(\`[Load Shedding] Event loop lag \${p99LagMs.toFixed(2)}ms exceeds threshold. Rejecting request.\`);

    res.set('Retry-After', '5'); // Tell client to retry in 5 seconds
    return res.status(503).json({
      error: 'Service Overloaded',
      message: 'Server is currently experiencing high load. Please retry shortly.'
    });
  }

  next();
});`,
    recallHint: "Event loop lag > 50-100ms means CPU starvation; load shedding rejects new requests with 503 to let the event loop recover.",
    interviewTip: "Explain why returning 503 quickly with a `Retry-After` header is far superior to letting requests queue indefinitely until client 504 Gateway Timeouts occur.",
    tags: ["load-shedding", "event-loop-lag", "perf_hooks", "resilience", "rate-limiting"]
  }),

  createCard({
    idNum: 119,
    category: "Modern Standards, Express 5 & Performance",
    concept: "Server-Sent Events (SSE) Streaming Pipeline with Express",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you implement a real-time Server-Sent Events (SSE) streaming endpoint in Express?",
    quickAnswer: "SSE provides a one-way, real-time HTTP streaming channel from server to browser. The endpoint sets `Content-Type: text/event-stream`, `Cache-Control: no-cache`, and `Connection: keep-alive`. Data is formatted as `data: <json>\\n\\n` and written via `res.write()`. Clean up listeners when the client disconnects via `req.on('close')`.",
    detailedAnswer: "SSE vs WebSockets:\n- SSE is unidirectional (server to client), runs over standard HTTP/1.1 or HTTP/2, supports automatic reconnection out of the box, and works through corporate firewalls without special protocols.\n- Ideal for: LLM AI streaming responses (ChatGPT style), stock tickers, notifications, live status dashboards.",
    code: `app.get('/api/stream/notifications', (req, res) => {
  // 1. Mandatory SSE HTTP headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disables Nginx response buffering
  });

  // Send initial connected event
  res.write('data: {"status": "connected"}\\n\\n');

  // Interval or event emitter pushing data
  const intervalId = setInterval(() => {
    const payload = JSON.stringify({ time: new Date().toISOString(), memory: process.memoryUsage().heapUsed });
    res.write(\`data: \${payload}\\n\\n\`);
  }, 3000);

  // 2. CRUCIAL: Clean up on client disconnect to prevent memory leak
  req.on('close', () => {
    clearInterval(intervalId);
    res.end();
    console.log('SSE client disconnected cleanly');
  });
});`,
    recallHint: "SSE requires Content-Type: text/event-stream; stream data with res.write('data: ...\\n\\n'); always clear timers on req.on('close').",
    interviewTip: "Always mention `'X-Accel-Buffering': 'no'`: if your Express server is behind an Nginx reverse proxy, Nginx buffers the SSE stream by default, preventing real-time chunk delivery unless this header is set.",
    tags: ["sse", "server-sent-events", "real-time", "streaming", "http-event-stream"]
  }),

  createCard({
    idNum: 120,
    category: "Modern Standards, Express 5 & Performance",
    concept: "Microservice Architecture: Express as an API Gateway (Reverse Proxy & Circuit Breakers)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How can Express be architected as an API Gateway with reverse proxying and circuit breaker patterns?",
    quickAnswer: "An Express API Gateway acts as a single entry point for client applications. It orchestrates cross-cutting concerns (authentication, rate limiting, logging, SSL termination) and reverse-proxies requests to downstream microservices using `http-proxy-middleware`. Circuit breakers (e.g. `opossum`) prevent cascading failures by tripping open when downstream services fail.",
    detailedAnswer: "API Gateway Responsibilities:\n1. Unified Ingress: Single external domain routing to internal service meshes (`/api/orders` -> `orders-service:4001`).\n2. Cross-Cutting Concerns: Authenticate JWT once at the gateway; pass trusted `x-user-id` headers to internal services.\n3. Circuit Breaker Pattern:\n   - Closed: Normal operation; requests pass through.\n   - Open: Service failure rate exceeds 50%; gateway immediately fails fast with fallback responses without hitting the broken downstream service.\n   - Half-Open: Tests occasional requests to see if downstream service recovered.",
    code: `const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const CircuitBreaker = require('opossum');

const app = express();

// Gateway Auth & Rate Limiting runs here first!
app.use(gatewayAuthMiddleware);

// Proxy configuration to downstream User Microservice
const userProxy = createProxyMiddleware({
  target: 'http://user-service.internal:4001',
  changeOrigin: true,
  onProxyReq: (proxyReq, req) => {
    // Inject verified user metadata into internal headers
    if (req.user) {
      proxyReq.setHeader('x-user-id', req.user.id);
      proxyReq.setHeader('x-user-roles', req.user.roles.join(','));
    }
  }
});

// Circuit Breaker options
const breakerOptions = {
  timeout: 3000, // 3s request timeout
  errorThresholdPercentage: 50, // Trip if >50% fail
  resetTimeout: 30000 // Test recovery after 30s
};

app.use('/api/users', userProxy);`,
    recallHint: "Express API Gateway centralizes auth/rate-limits and proxies downstream; circuit breakers prevent cascading failures.",
    interviewTip: "Discuss the trade-off: Express is great for lightweight, agile gateways, but for 100k+ RPS enterprise ingress, compiled gateways like Envoy, Kong, or Traefik offer lower latency and higher throughput.",
    tags: ["api-gateway", "microservices", "circuit-breaker", "http-proxy-middleware", "architecture"]
  })
];

module.exports = cards;
