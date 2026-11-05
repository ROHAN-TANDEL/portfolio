const { createCard } = require("../exp_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 37,
    category: "Request & Response Objects",
    concept: "req.params, req.query, and req.body Parsing Mechanics",
    priority: "must-know",
    difficulty: "beginner",
    question: "How do `req.params`, `req.query`, and `req.body` differ in Express, and how are they populated?",
    quickAnswer: "`req.params` contains matched URL route parameters, `req.query` contains parsed URL search query parameters (using simple or qs parser), and `req.body` contains parsed HTTP request body payloads populated exclusively by body-parsing middleware like `express.json()`.",
    detailedAnswer: "In Express:\n1. `req.params`: Parsed by Express router path regex (e.g., `/users/:id` -> `{ id: '42' }`). Always contains strings unless transformed.\n2. `req.query`: Populated by Express query parser (`app.set('query parser', 'extended')` uses `qs` supporting nested objects like `filter[status]=active`, while `'simple'` uses Node's `querystring`).\n3. `req.body`: Undefined by default until explicit middleware (`express.json()`, `express.urlencoded({ extended: true })`, or multer) decodes incoming chunk streams and attaches the deserialized object.\n4. Accessing `req.body` before middleware execution results in `undefined`.",
    code: `const express = require('express');
const app = express();

app.use(express.json()); // Essential for populating req.body
app.set('query parser', 'extended'); // Supports nested query objects

// GET /api/organizations/org_99/members?role=admin&sort[by]=created_at
app.get('/api/organizations/:orgId/members', (req, res) => {
  const { orgId } = req.params; // 'org_99'
  const { role, sort } = req.query; // role: 'admin', sort: { by: 'created_at' }

  res.json({ orgId, filterRole: role, sortBy: sort?.by });
});

// POST /api/organizations/org_99/members
app.post('/api/organizations/:orgId/members', (req, res) => {
  const { orgId } = req.params;
  const { email, role } = req.body; // Parsed from JSON payload

  res.status(201).json({ success: true, member: { orgId, email, role } });
});`,
    recallHint: "Params = URL path variables; Query = URL question mark search params; Body = HTTP POST/PUT payload parsed by middleware.",
    interviewTip: "Highlight that `req.body` is completely undefined unless body-parser middleware runs first, and mention how 'extended' query parsing can introduce object injection if untrusted query keys are directly passed to database queries.",
    tags: ["req.params", "req.query", "req.body", "request-parsing", "express-params"]
  }),

  createCard({
    idNum: 38,
    category: "Request & Response Objects",
    concept: "Header Extraction with req.get() and Content Negotiation with req.accepts()",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do `req.get()` and `req.accepts()` work for HTTP header extraction and content negotiation in Express?",
    quickAnswer: "`req.get(headerName)` (aliased to `req.header()`) retrieves incoming HTTP request headers in a case-insensitive manner with special handling for 'referrer'. `req.accepts(types)` checks the client's `Accept` header to negotiate the preferred representation (JSON, HTML, XML).",
    detailedAnswer: "`req.get(field)` abstracts Node's lowercased `req.headers` object, permitting case-insensitive lookup (e.g. `req.get('Content-Type')` and `req.get('content-type')` both return identical values). It also treats `'referer'` and `'referrer'` interchangeably.\n\n`req.accepts()` performs RFC-compliant HTTP content negotiation based on `Accept` header priorities and MIME quality values (`q=0.9`). If none of the supplied types are acceptable, it returns `false`, allowing the server to issue a `406 Not Acceptable` response.",
    code: `app.get('/api/reports/:id', (req, res) => {
  // Case-insensitive header extraction
  const authHeader = req.get('Authorization');
  const userAgent = req.get('User-Agent');
  const correlationId = req.get('X-Correlation-ID') || crypto.randomUUID();

  // Content negotiation based on client 'Accept' header
  const acceptedType = req.accepts(['json', 'html', 'csv']);

  if (!acceptedType) {
    return res.status(406).json({ error: 'Not Acceptable', supported: ['json', 'html', 'csv'] });
  }

  const reportData = { id: req.params.id, revenue: 154000 };

  if (acceptedType === 'json') {
    return res.json(reportData);
  }
  if (acceptedType === 'html') {
    return res.send(\`<h1>Report \${reportData.id}</h1><p>Revenue: \${reportData.revenue}</p>\`);
  }
  if (acceptedType === 'csv') {
    res.set('Content-Type', 'text/csv');
    return res.send(\`id,revenue\\n\${reportData.id},\${reportData.revenue}\`);
  }
});`,
    recallHint: "req.get() is case-insensitive header lookup; req.accepts() inspects the Accept header for format negotiation or returns false (406).",
    interviewTip: "Emphasize that `req.headers` in raw Node is already lowercased, but `req.get()` is the idiomatic Express method that safely normalizes names and aliases Referer/Referrer.",
    tags: ["headers", "req.get", "content-negotiation", "req.accepts", "http-spec"]
  }),

  createCard({
    idNum: 39,
    category: "Request & Response Objects",
    concept: "IP Resolution, Reverse Proxy IP Spoofing, and req.ips",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Express determine client IP address via `req.ip` and `req.ips`, and how do you prevent IP spoofing behind reverse proxies?",
    quickAnswer: "`req.ip` returns the client IP address. When `app.set('trust proxy', ...)` is enabled, Express reads the leftmost untrusted IP from the `X-Forwarded-For` header; `req.ips` lists the full upstream proxy chain. Without proper trust configuration, attackers can forge `X-Forwarded-For` headers to bypass IP-based rate limiting or security controls.",
    detailedAnswer: "Direct socket connections yield `req.socket.remoteAddress`. In modern infrastructure, Express sits behind reverse proxies (Nginx, Cloudflare, AWS ALB, Kubernetes Ingress), which append client IPs to `X-Forwarded-For`.\n\nSecurity Vulnerability:\nIf `trust proxy` is set to `true` indiscriminately, Express trusts any client-supplied `X-Forwarded-For: 127.0.0.1` header. An attacker can spoof their IP, bypassing rate limiters, geolocation guards, or IP whitelists.\n\nBest Practice:\nConfigure `trust proxy` explicitly with exact subnet ranges or hop counts (e.g. `app.set('trust proxy', 'loopback, linklocal, uniquelocal')` or matching VPC CIDR blocks).",
    code: `const express = require('express');
const app = express();

// SAFE: Trust only known private subnets or Cloudflare/AWS VPC CIDRs
app.set('trust proxy', ['loopback', '10.0.0.0/8', '172.16.0.0/12']);

app.get('/api/client-telemetry', (req, res) => {
  // req.ip: Evaluated client IP after stripping trusted proxies
  const clientIp = req.ip;

  // req.ips: Array of upstream proxy hops from client to closest proxy
  // e.g. ['203.0.113.195', '10.0.0.15']
  const proxyChain = req.ips;

  res.json({
    clientIp,
    proxyChain,
    remoteSocket: req.socket.remoteAddress
  });
});`,
    recallHint: "req.ip inspects X-Forwarded-For only when 'trust proxy' is configured; never set trust proxy to true blindly to prevent header spoofing.",
    interviewTip: "Explain what happens if rate limiters key on `req.ip` while `trust proxy` is misconfigured: attackers send randomized `X-Forwarded-For` headers to evade rate limits entirely.",
    tags: ["req.ip", "req.ips", "trust-proxy", "x-forwarded-for", "security", "spoofing"]
  }),

  createCard({
    idNum: 40,
    category: "Request & Response Objects",
    concept: "res.json() vs res.send() vs res.end() Serialization Pipeline",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the exact differences between `res.json()`, `res.send()`, and `res.end()` in Express?",
    quickAnswer: "`res.end()` is Node's core method that terminates the stream without setting content-type or etag headers. `res.send()` inspects data types, sets `Content-Type` accordingly (HTML, Buffer, or JSON), generates ETags, and calculates `Content-Length`. `res.json()` explicitly serializes input using `JSON.stringify()` (respecting app settings like `json replacer` and `json spaces`) and sets `application/json`.",
    detailedAnswer: "1. `res.end([data])`: Direct wrapper around Node `http.ServerResponse.prototype.end`. Sends raw bytes or string without default HTTP headers. Often used for 204 No Content responses.\n2. `res.send(body)`: Smart polymorphic responder. If passed a string, it defaults to `text/html`. If passed a Buffer, it defaults to `application/octet-stream`. If passed an Object or Array, it delegates internally to `res.json()`. It calculates `Content-Length` and generates weak `ETag` headers.\n3. `res.json(obj)`: Explicitly converts null/objects to JSON strings via `JSON.stringify()`, enforces `Content-Type: application/json; charset=utf-8`, and formats output if `app.set('json spaces', 2)` is active.",
    code: `// 1. res.json(): explicit JSON serialization with application/json
app.get('/user', (req, res) => {
  res.json({ id: 1, name: 'Alice' });
});

// 2. res.send(): polymorphic response handler
app.get('/auto-detect', (req, res) => {
  // String -> text/html; charset=utf-8
  res.send('<h1>Express Server</h1>');
  
  // Buffer -> application/octet-stream
  // res.send(Buffer.from('binary data'));
});

// 3. res.end(): raw stream termination without automated header formatting
app.delete('/api/session', (req, res) => {
  res.status(204).end(); // No body, no Content-Type required
});`,
    recallHint: "res.end = raw Node stream terminator; res.send = polymorphic with automatic mime types; res.json = dedicated JSON serializer with formatting options.",
    interviewTip: "Mention that calling `res.send(200)` is deprecated in Express 4/5—always use `res.sendStatus(200)` or `res.status(200).send()`, otherwise numeric parameters were historically misinterpreted as status codes.",
    tags: ["res.json", "res.send", "res.end", "http-response", "serialization"]
  }),

  createCard({
    idNum: 41,
    category: "Request & Response Objects",
    concept: "HTTP Status Codes, Chained Methods, and Idempotent Responses",
    priority: "must-know",
    difficulty: "beginner",
    question: "How does method chaining work on Express `res`, and how do you ensure appropriate HTTP status codes?",
    quickAnswer: "Express response methods return `this` (the `res` object) for chained configuration methods like `res.status(code)` and `res.set(headers)`. Final dispatch methods like `res.json()`, `res.send()`, and `res.end()` terminate the HTTP response lifecycle.",
    detailedAnswer: "In Express, methods are split into two categories:\n1. Mutator/Configuration methods: Return `res` allowing chaining:\n   - `res.status(201)`\n   - `res.set('X-RateLimit-Remaining', '10')`\n   - `res.cookie('token', jwt)`\n   - `res.type('json')`\n2. Terminal/Dispatch methods: Send the HTTP response and end the TCP payload stream:\n   - `res.json()`, `res.send()`, `res.end()`, `res.sendFile()`, `res.sendStatus()`\n\nAttempting to call another terminal method or chain after dispatching causes `ERR_HTTP_HEADERS_SENT`.",
    code: `app.post('/api/products', (req, res) => {
  const { title, price } = req.body;

  if (!title || price <= 0) {
    // 400 Bad Request
    return res.status(400).json({ error: 'Title and positive price are required' });
  }

  const createdProduct = { id: 101, title, price, createdAt: new Date() };

  // Chained status, custom headers, and JSON termination
  res.status(201)
     .set('Location', \`/api/products/\${createdProduct.id}\`)
     .set('X-Custom-Header', 'ProductCreated')
     .json(createdProduct);
});`,
    recallHint: "res.status() sets the code and returns res; terminal methods like res.json() commit headers and end the stream.",
    interviewTip: "Always use `return res.status(...).json(...)` when branching early inside conditionals to avoid accidentally continuing execution into downstream response calls.",
    tags: ["res.status", "method-chaining", "http-status", "res.set", "idempotence"]
  }),

  createCard({
    idNum: 42,
    category: "Request & Response Objects",
    concept: "res.sendFile() and Safe Static File Transfer with Security Bounds",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does `res.sendFile()` safely stream local files, and how does it prevent path traversal attacks?",
    quickAnswer: "`res.sendFile(path, [options], [callback])` transfers files at the given path, automatically deriving `Content-Type` from the file extension and setting `Content-Length`. To prevent directory traversal (e.g. `../../etc/passwd`), it requires either an absolute path or a `root` option that restricts file resolution to a safe directory.",
    detailedAnswer: "`res.sendFile()` uses the `send` library under the hood. It supports:\n- Range requests for video/audio seeking (HTTP 206 Partial Content).\n- Automatic `Last-Modified` and `ETag` generation with HTTP 304 conditional cache support.\n- Path traversal prevention: If a requested path resolves outside the configured `root` directory, `res.sendFile()` throws a 403 Forbidden error or invokes the error callback.\n- Dotfile handling options (`'ignore'`, `'allow'`, `'deny'`).",
    code: `const path = require('path');

app.get('/downloads/:filename', (req, res, next) => {
  const { filename } = req.params;
  const safeBaseDirectory = path.join(__dirname, 'public', 'downloads');

  const options = {
    root: safeBaseDirectory,
    dotfiles: 'deny',
    headers: {
      'x-timestamp': Date.now(),
      'x-sent': true
    }
  };

  // Safe file transfer restricted to root directory
  res.sendFile(filename, options, (err) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'File not found' });
      }
      // Pass other errors (like 403 traversal attempts) to global error handler
      next(err);
    }
  });
});`,
    recallHint: "res.sendFile requires an absolute path or root option; blocks path traversal attacks and handles HTTP 206 range requests out of the box.",
    interviewTip: "Always check for `res.headersSent` inside the error callback before sending an error response, because the error could have occurred mid-stream after headers were already transmitted.",
    tags: ["res.sendFile", "file-download", "path-traversal", "security", "static-files"]
  }),

  createCard({
    idNum: 43,
    category: "Request & Response Objects",
    concept: "Cookie Management (res.cookie, res.clearCookie, signed, httpOnly, sameSite, secure)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How are cookies created, secured, and cleared in Express using `res.cookie()` and `cookie-parser`?",
    quickAnswer: "`res.cookie(name, value, [options])` sets the `Set-Cookie` HTTP header. Critical production security attributes include `httpOnly: true` (blocks XSS JavaScript access), `secure: true` (transmits over HTTPS only), `sameSite: 'strict' | 'lax'` (defends against CSRF), and `signed: true` (signs the cookie value with HMAC SHA-256 via `cookie-parser`).",
    detailedAnswer: "When `cookie-parser(secret)` middleware is installed:\n1. Standard cookies are read from `req.cookies`.\n2. Signed cookies are verified with HMAC using the provided secret and accessible on `req.signedCookies`. Tampered cookies evaluate to `false`.\n3. `res.cookie()` options:\n   - `httpOnly: true`: Inaccessible to `document.cookie` in browsers, mitigating credential theft via Cross-Site Scripting (XSS).\n   - `secure: true`: Sent only over encrypted TLS connections.\n   - `sameSite: 'lax' | 'strict'`: Prevents browser from sending cookie on cross-site requests, mitigating Cross-Site Request Forgery (CSRF).\n   - `maxAge` / `expires`: Controls cookie expiration lifetime.\n4. `res.clearCookie(name, [options])` clears the cookie by expiring it immediately (must match path and domain options).",
    code: `const express = require('express');
const cookieParser = require('cookie-parser');
const app = express();

app.use(cookieParser('production-super-secret-key'));

app.post('/api/auth/login', (req, res) => {
  const sessionToken = 'sess_' + crypto.randomUUID();

  // Set hardened session cookie
  res.cookie('sessionId', sessionToken, {
    httpOnly: true, // Immune to document.cookie XSS theft
    secure: process.env.NODE_ENV === 'production', // HTTPS only
    sameSite: 'lax', // CSRF protection
    signed: true, // HMAC-SHA256 signature verification
    maxAge: 24 * 60 * 60 * 1000 // 1 day in milliseconds
  });

  res.json({ message: 'Authenticated successfully' });
});

app.get('/api/auth/me', (req, res) => {
  // Read verified signed cookie
  const validSession = req.signedCookies.sessionId;
  if (!validSession) {
    return res.status(401).json({ error: 'Invalid or tampered session' });
  }
  res.json({ session: validSession });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('sessionId', { path: '/' });
  res.json({ message: 'Logged out' });
});`,
    recallHint: "Production cookies require httpOnly: true, secure: true, sameSite: 'lax'/'strict', and signed: true for HMAC integrity.",
    interviewTip: "Highlight that signed cookies are tamper-proof but NOT encrypted. Anyone can still read the plaintext value, so never store sensitive secrets in signed cookies without encryption.",
    tags: ["cookies", "res.cookie", "cookie-parser", "httpOnly", "sameSite", "security"]
  }),

  createCard({
    idNum: 44,
    category: "Request & Response Objects",
    concept: "URL Redirection (res.redirect) Status Codes and Open Redirect Vulnerability",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does `res.redirect()` function, what HTTP status codes does it support, and how do you protect against Open Redirect vulnerabilities?",
    quickAnswer: "`res.redirect([status], url)` sends an HTTP redirect response (defaulting to 302 Found) and sets the `Location` header. Open Redirect occurs when an untrusted user query parameter (e.g. `?next=https://evil.com`) is passed directly to `res.redirect()` without origin validation.",
    detailedAnswer: "HTTP Redirect Status Codes:\n- `301 Moved Permanently`: Browser and search engines permanently cache new destination.\n- `302 Found`: Default temporary redirect; client re-requests target (historically may mutate POST to GET).\n- `307 Temporary Redirect`: Temporary redirect strictly preserving HTTP method and request body.\n- `308 Permanent Redirect`: Permanent redirect strictly preserving HTTP method and request body.\n\nOpen Redirect Defense:\nNever redirect to unvalidated URLs. Check that target URLs start with a single `/` (avoiding protocol-relative `//attacker.com`) or validate against an explicit whitelist of allowed domain origins.",
    code: `const ALLOWED_ORIGINS = new Set(['https://myapp.com', 'https://auth.myapp.com']);

app.get('/login-redirect', (req, res) => {
  const targetUrl = req.query.returnTo || '/dashboard';

  // 1. Prevent protocol-relative URL bypass (e.g., "//evil.com")
  if (targetUrl.startsWith('/') && !targetUrl.startsWith('//') && !targetUrl.startsWith('/\\\\')) {
    return res.redirect(302, targetUrl); // Safe relative path
  }

  // 2. Validate absolute external redirects against whitelist
  try {
    const parsed = new URL(targetUrl);
    if (ALLOWED_ORIGINS.has(parsed.origin)) {
      return res.redirect(302, targetUrl);
    }
  } catch {
    // Malformed URL
  }

  // Fallback to safe default
  res.redirect(302, '/dashboard');
});`,
    recallHint: "res.redirect defaults to 302; always validate relative paths and whitelist origins to defeat Open Redirect phishing exploits.",
    interviewTip: "Demonstrate knowledge of protocol-relative URLs (`//attacker.com`) which browsers treat as `http://attacker.com` or `https://attacker.com` if server checks merely `target.startsWith('/')`.",
    tags: ["res.redirect", "open-redirect", "status-301", "status-302", "security"]
  }),

  createCard({
    idNum: 45,
    category: "Request & Response Objects",
    concept: "Streaming Data to Response with stream.pipe(res) and Backpressure Handling",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you stream large datasets or files directly to Express responses using Streams and backpressure management?",
    quickAnswer: "Express's `res` object implements Node's `WritableStream` interface. Piping a `ReadableStream` into `res` via `readable.pipe(res)` or `stream.promises.pipeline(readable, res)` streams chunks incrementally without buffering entire multi-gigabyte payloads in memory, automatically managing TCP backpressure.",
    detailedAnswer: "Buffering large files (like database exports or videos) via `fs.readFile()` forces the entire payload into V8 heap memory, risking Out-Of-Memory (OOM) crashes under concurrent traffic.\n\nUsing streams:\n1. Node streams send chunks of `64KB` (or configured `highWaterMark`) over the network.\n2. Backpressure: If the client download speed is slower than the server read speed, `res.write()` returns `false`, signaling the readable stream to pause until the network socket drains (`drain` event).\n3. `stream.pipeline` handles error cleanup automatically, closing both source and target descriptors if the connection aborts mid-transfer.",
    code: `const fs = require('fs');
const { pipeline } = require('stream/promises');

app.get('/api/export/logs', async (req, res, next) => {
  const logFilePath = '/var/log/audit.log';

  res.set({
    'Content-Type': 'text/plain',
    'Content-Disposition': 'attachment; filename="audit.log"'
  });

  const fileStream = fs.createReadStream(logFilePath);

  try {
    // pipeline handles error propagation and automatically destroys streams on client abort
    await pipeline(fileStream, res);
  } catch (err) {
    if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      next(err);
    }
  }
});`,
    recallHint: "res is a WritableStream; use pipeline(readable, res) to prevent memory OOM crashes and respect TCP backpressure.",
    interviewTip: "Never use `fs.readFile` for file downloads. Always use `fs.createReadStream` piped to `res` with `stream.pipeline` for automatic error and premature abort cleanup.",
    tags: ["streams", "pipeline", "backpressure", "writable-stream", "performance"]
  }),

  createCard({
    idNum: 46,
    category: "Request & Response Objects",
    concept: "res.locals Request Scoping and Per-Request View/Controller Data Propagation",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is `res.locals`, what is its lifecycle, and how does it differ from `app.locals`?",
    quickAnswer: "`res.locals` is an object scoped exclusively to the lifetime of a single HTTP request/response cycle. It is used to share contextual data (authenticated user, tenant ID, request timing, view variables) across multiple middlewares and controllers for that specific request. `app.locals` is application-wide and persists across all requests for the lifetime of the server process.",
    detailedAnswer: "Key differences:\n1. Lifetime: `res.locals` is initialized as a blank object `{}` on every incoming request and garbage-collected when the response completes. `app.locals` lives as long as the Express process runs.\n2. Scope: `app.locals` stores global configuration (app title, global helpers, analytics tags). `res.locals` stores per-request contextual data (e.g. `res.locals.user`, `res.locals.traceId`, `res.locals.tenant`).\n3. Template Rendering: When calling `res.render('template', options)`, Express merges `app.locals`, `res.locals`, and `options` into the template context, with `res.locals` overriding `app.locals`.",
    code: `// Global application locals
app.locals.siteName = 'Enterprise Cloud';
app.locals.supportEmail = 'support@enterprise.com';

// Middleware attaching per-request scoped state
app.use((req, res, next) => {
  res.locals.traceId = crypto.randomUUID();
  res.locals.requestStartTime = process.hrtime.bigint();
  next();
});

// Authentication middleware setting authenticated identity
app.use(async (req, res, next) => {
  const token = req.get('Authorization');
  if (token) {
    res.locals.currentUser = await verifyToken(token);
  }
  next();
});

// Controller accessing shared per-request locals
app.get('/dashboard', (req, res) => {
  const user = res.locals.currentUser;
  const trace = res.locals.traceId;
  res.json({ user, trace });
});`,
    recallHint: "app.locals = global server lifetime; res.locals = single HTTP request lifetime, shared across middlewares and view templates.",
    interviewTip: "Contrast `res.locals` with `req.user` or dynamic properties on `req`: `res.locals` is the official Express-documented storage for per-request state and is automatically exposed to template engines.",
    tags: ["res.locals", "app.locals", "request-lifecycle", "state-sharing", "middleware"]
  }),

  createCard({
    idNum: 47,
    category: "Request & Response Objects",
    concept: "Client Connection Abort Detection via req.on('close') and Halting Expensive Work",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you detect when a client cancels or aborts an HTTP request mid-flight, and how do you halt expensive database or AI operations?",
    quickAnswer: "When a client drops connection (e.g. closing browser tab or canceling an fetch request), Node emits the `'close'` event on `req` (`res.writableEnded` remains `false`). By attaching an `AbortController` to `req.on('close')`, long-running queries, downstream API calls, or LLM streams can be aborted immediately, saving server resources.",
    detailedAnswer: "Problem:\nIf a client triggers an expensive operation (e.g. generating an heavy CSV report or running a 10-second SQL aggregate) and closes the browser after 500ms, standard Express code continues processing to completion, wasting CPU, database connections, and memory.\n\nSolution:\nMonitor `req.on('close', ...)` or use standard `AbortController`. Pass `abortController.signal` to database drivers (pg, prisma), `fetch()`, or streaming APIs so they immediately cancel when the client disconnects.",
    code: `app.get('/api/analytics/heavy-export', async (req, res, next) => {
  const abortController = new AbortController();

  // Detect premature client disconnection
  req.on('close', () => {
    if (!res.writableEnded) {
      console.warn(\`[Client Aborted] Request \${req.id} canceled by client\`);
      abortController.abort(); // Signals active DB query / fetch to cancel
    }
  });

  try {
    // Pass signal to cancelable database query or external fetch
    const response = await fetch('https://analytics-service.internal/aggregate', {
      signal: abortController.signal
    });

    const data = await response.json();
    res.json({ success: true, data });
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Downstream call aborted cleanly on client disconnect');
      return; // Do not attempt to respond to closed client
    }
    next(err);
  }
});`,
    recallHint: "req.on('close') fires on client drop; wire it to an AbortController signal to stop expensive background work immediately.",
    interviewTip: "Mention that in Express 5, unhandled promise rejections on aborted connections require careful handling because attempting to write `res.status(500)` after `req` closed throws `ERR_HTTP_HEADERS_SENT` or write errors.",
    tags: ["req.close", "abort-controller", "client-disconnect", "cancellation", "resource-saving"]
  }),

  createCard({
    idNum: 48,
    category: "Request & Response Objects",
    concept: "Custom Response Helpers and Extending Express response Prototype Safely",
    priority: "good-to-know",
    difficulty: "advanced",
    question: "How can you extend Express's `response` and `request` prototypes safely to establish standard API response contracts?",
    quickAnswer: "Express exposes `express.response` and `express.request` prototype objects. Adding methods like `res.success(data)` or `res.apiError(status, message)` standardizes JSON response schemas across all endpoints, eliminating repetitive boilerplate.",
    detailedAnswer: "In large enterprise microservices, teams enforce standard response wrappers (e.g. JSend or custom JSON:API format). Instead of rewriting `{ success: true, data, timestamp }` in every controller, you can augment `express.response`.\n\nTypeScript considerations:\nDeclare module augmentation in an `express.d.ts` file so TypeScript recognizes custom methods with full type inference.",
    code: `const express = require('express');

// Extend Express response prototype
express.response.apiSuccess = function (data, statusCode = 200) {
  return this.status(statusCode).json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString()
    }
  });
};

express.response.apiError = function (message, statusCode = 400, details = null) {
  return this.status(statusCode).json({
    success: false,
    error: {
      message,
      code: statusCode,
      details
    },
    meta: {
      timestamp: new Date().toISOString()
    }
  });
};

const app = express();

app.get('/api/items', (req, res) => {
  const items = [{ id: 1, name: 'Gadget' }];
  // Clean, uniform response across the entire codebase
  return res.apiSuccess(items);
});`,
    recallHint: "Extend express.response prototype with helpers like res.apiSuccess() and res.apiError() for uniform enterprise API envelopes.",
    interviewTip: "Discuss trade-offs: prototype extension provides universal convenience, but helper utility functions or middleware wrappers avoid potential prototype collisions when upgrading Express versions.",
    tags: ["prototype", "res.apiSuccess", "custom-helpers", "response-envelope", "architecture"]
  })
];

module.exports = cards;
