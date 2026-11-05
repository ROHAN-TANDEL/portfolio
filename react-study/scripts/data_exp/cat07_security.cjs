const { createCard } = require("../exp_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 73,
    category: "Security Hardening & Defensive Middleware",
    concept: "Helmet Security Headers Suite (CSP, HSTS, X-Frame-Options, X-Content-Type-Options)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What HTTP response headers does `helmet()` configure by default, and what vulnerabilities does each prevent?",
    quickAnswer: "`helmet()` is an Express middleware bundle that sets crucial HTTP security headers: `Content-Security-Policy` (stops XSS/data injection), `Strict-Transport-Security` (enforces HTTPS), `X-Frame-Options` (blocks clickjacking), `X-Content-Type-Options: nosniff` (stops MIME-type sniffing), `Referrer-Policy`, and strips `X-Powered-By`.",
    detailedAnswer: "Key Helmet Headers:\n1. `Content-Security-Policy` (CSP): Restricts origins for scripts, styles, fonts, and WebSocket connections.\n2. `Strict-Transport-Security` (HSTS): Forces browsers to communicate exclusively over HTTPS for a defined duration (`max-age=15552000; includeSubDomains`).\n3. `X-Frame-Options: SAMEORIGIN`: Prevents framing by third-party sites to defeat clickjacking attacks.\n4. `X-Content-Type-Options: nosniff`: Prevents browsers from guessing/executing non-script files (e.g. an uploaded PNG containing malicious script) as JavaScript.\n5. `X-DNS-Prefetch-Control: off`: Disables prefetching to reduce DNS query leakage.",
    code: `const express = require('express');
const helmet = require('helmet');
const app = express();

// Standard hardened Helmet setup
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://trustedscripts.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://cdn.myapp.com"],
      connectSrc: ["'self'", "https://api.myapp.com"]
    }
  },
  hsts: {
    maxAge: 31536000, // 1 year in seconds
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' } // Block iframe embedding completely
}));`,
    recallHint: "Helmet sets CSP (XSS defense), HSTS (force HTTPS), X-Frame-Options (anti-clickjacking), and nosniff (anti-MIME sniffing).",
    interviewTip: "Always recommend invoking `app.use(helmet())` as the very first middleware before any route definitions or static file servers.",
    tags: ["helmet", "security-headers", "csp", "hsts", "clickjacking", "nosniff"]
  }),

  createCard({
    idNum: 74,
    category: "Security Hardening & Defensive Middleware",
    concept: "CORS Configuration & Preflight (OPTIONS) Handshake",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the Cross-Origin Resource Sharing (CORS) protocol work in Express, and how do you configure preflight requests securely?",
    quickAnswer: "CORS is a browser security enforcement that prevents cross-origin web apps from reading API responses unless the server returns permitted `Access-Control-Allow-Origin` headers. For non-simple requests (methods like `PUT`/`DELETE`, custom headers, or JSON content), browsers send an initial preflight `OPTIONS` request. The `cors` middleware handles both preflight responses and origin validation.",
    detailedAnswer: "CORS Rules & Preflights:\n- Simple requests (`GET`, `POST` with standard form types) execute directly, but responses are blocked by the browser if CORS headers are missing.\n- Non-simple requests trigger an `OPTIONS` preflight handshake. The browser checks `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`.\n\nSecurity Best Practice:\nNever use `cors({ origin: '*' })` on endpoints handling authenticated requests or cookies (`credentials: true`). Browsers explicitly reject `Access-Control-Allow-Origin: *` when credentials are included.",
    code: `const express = require('express');
const cors = require('cors');
const app = express();

const whitelist = ['https://dashboard.myapp.com', 'https://mobile.myapp.com'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser requests (like mobile apps or curl) or whitelisted domains
    if (!origin || whitelist.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true, // Allow cookies and auth headers
  maxAge: 86400 // Cache preflight OPTIONS response for 24 hours (reduces traffic)
};

// Apply to all routes (automatically handles OPTIONS preflights)
app.use(cors(corsOptions));`,
    recallHint: "Never use origin: '*' with credentials: true. Preflight OPTIONS requests are handled automatically by configured cors() middleware.",
    interviewTip: "Clarify that CORS is enforced entirely by the browser, NOT by curl, Postman, or server-to-server HTTP requests. CORS protects browser users, not servers.",
    tags: ["cors", "preflight", "options-method", "access-control-allow-origin", "security"]
  }),

  createCard({
    idNum: 75,
    category: "Security Hardening & Defensive Middleware",
    concept: "Rate Limiting Architectures (Memory vs Distributed Redis Sliding Window)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you implement rate limiting in Express, and why is an in-memory store inadequate for production clusters?",
    quickAnswer: "Rate limiting prevents brute force, denial-of-service (DoS), and API abuse by capping the number of requests per IP or user within a time window. While `MemoryStore` works for single-process local dev, production clusters require a distributed store (e.g. `rate-limit-redis`) with Redis sliding window algorithms to synchronize rate counts across all container instances.",
    detailedAnswer: "Limitations of In-Memory Rate Limiting:\n- In a horizontally scaled cluster of 10 Kubernetes pods, an attacker has 10x the allowed rate limit because each pod tracks counters independently in isolated memory.\n- Node restarts reset all rate counters.\n\nRedis Distributed Rate Limiting:\nUses atomic Redis transactions (`INCR`, `EXPIRE`) or sliding window logs to track global request frequencies per IP or API key, returning `429 Too Many Requests` when limits are breached.",
    code: `const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { createClient } = require('redis');

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

// Sensitive endpoint limiter (e.g., login brute-force prevention)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 failed login attempts per window
  standardHeaders: true, // Return RateLimit-* headers (RFC draft)
  legacyHeaders: false, // Disable X-RateLimit-* legacy headers
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:auth:'
  }),
  message: {
    status: 429,
    error: 'Too many login attempts. Please try again in 15 minutes.'
  }
});

app.post('/api/auth/login', authLimiter, (req, res) => {
  res.json({ message: 'Login endpoint' });
});`,
    recallHint: "Rate limiting stops brute-force (429 Too Many Requests); production requires RedisStore to synchronize counts across clustered workers.",
    interviewTip: "Mention that rate limiters should support tiered rules: strict for authentication (`/login`), moderate for general APIs, and keyed by user ID rather than IP when behind enterprise NATs.",
    tags: ["rate-limiting", "express-rate-limit", "redis", "brute-force", "http-429"]
  }),

  createCard({
    idNum: 76,
    category: "Security Hardening & Defensive Middleware",
    concept: "HTTP Parameter Pollution (HPP) Attacks and Defense",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is HTTP Parameter Pollution (HPP), how can it bypass authorization or crash Express, and how do you prevent it?",
    quickAnswer: "HPP occurs when an attacker supplies multiple query parameters with the same key (e.g. `?role=user&role=admin`). Express's query parser converts duplicate keys into an array (`['user', 'admin']`). If code expects a string and does `req.query.role.toUpperCase()`, it crashes with a TypeError (DoS) or bypasses equality checks. The `hpp` middleware defers duplicates to an array or keeps only the last value.",
    detailedAnswer: "Vulnerability Scenarios:\n1. Denial of Service (DoS): Code doing `req.query.search.trim()` throws `TypeError: req.query.search.trim is not a function` when `search` is an Array.\n2. Security Bypass: A WAF or check inspects `req.query.id`, but downstream SQL builders concatenate array values or behave unexpectedly.\n\nDefense:\nUse `hpp()` middleware. It cleans `req.query` and `req.body`, retaining only the last parameter value unless explicitly whitelisted in `whitelist` options.",
    code: `const express = require('express');
const hpp = require('hpp');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Protect against parameter pollution on query and body
app.use(hpp({
  whitelist: ['tags', 'filter'] // Allow array values ONLY for these whitelisted keys
}));

// Request: GET /api/users?status=active&status=banned
app.get('/api/users', (req, res) => {
  // Without hpp: req.query.status is ['active', 'banned']
  // With hpp: req.query.status is sanitized to the last string: 'banned'
  console.log(typeof req.query.status); // 'string'
  res.json({ status: req.query.status });
});`,
    recallHint: "Duplicate query keys become arrays in Express; hpp middleware sanitizes them to single strings, preventing DoS and auth bypass.",
    interviewTip: "Explain how HPP can bypass security filters: if a security middleware checks `if (req.query.admin === 'true')` and sees an array, the check may evaluate to `false`, yet downstream logic might treat the array truthy.",
    tags: ["hpp", "parameter-pollution", "security", "dos-prevention", "query-sanitization"]
  }),

  createCard({
    idNum: 77,
    category: "Security Hardening & Defensive Middleware",
    concept: "Cross-Site Request Forgery (CSRF / XSRF) Mitigation Strategies",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you protect Express applications against CSRF, and why are SameSite cookies and the Double Submit Cookie pattern used?",
    quickAnswer: "CSRF tricks a victim's browser into executing unwanted actions on an authenticated web app. Protection strategies include: 1. `SameSite=Lax` or `SameSite=Strict` cookie flags (preventing cross-origin cookie delivery). 2. Custom request headers (e.g. `X-Requested-With` or `Authorization: Bearer`), which browsers cannot send cross-origin without CORS preflight approval. 3. Anti-CSRF token verification (Double Submit Cookie pattern via `csurf` or modern token generators).",
    detailedAnswer: "How CSRF Works:\nIf session authentication relies solely on cookies, a malicious site containing `<img src=\"https://bank.com/transfer?to=attacker&amount=1000\">` causes the browser to automatically attach the user's valid session cookie.\n\nModern Defense Hierarchy:\n1. Modern SPAs & REST APIs: Pure stateless Bearer tokens in headers are inherently immune to CSRF because browsers never automatically attach custom `Authorization` headers cross-origin.\n2. Cookie-based apps: Use `SameSite=Lax/Strict` attributes.\n3. State-changing mutations (POST/PUT/DELETE): Validate an encrypted CSRF token sent in the request header (`X-CSRF-Token`) against the cookie.",
    code: `const cookieParser = require('cookie-parser');
const crypto = require('crypto');

app.use(cookieParser('cookie-secret'));

// Double-Submit Cookie CSRF Middleware
app.get('/api/csrf-token', (req, res) => {
  const csrfToken = crypto.randomBytes(32).toString('hex');

  // Set CSRF cookie
  res.cookie('XSRF-TOKEN', csrfToken, {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false // Accessible by frontend JS (Axios/Angular) to echo back in header
  });

  res.json({ csrfToken });
});

function verifyCsrf(req, res, next) {
  // Safe read-only methods are exempt
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const tokenFromHeader = req.get('x-xsrf-token') || req.get('x-csrf-token');
  const tokenFromCookie = req.cookies['XSRF-TOKEN'];

  if (!tokenFromHeader || tokenFromHeader !== tokenFromCookie) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }

  next();
}

app.post('/api/transfer-funds', verifyCsrf, (req, res) => {
  res.json({ success: true, message: 'Transfer completed safely' });
});`,
    recallHint: "SameSite cookie flags and custom request headers block CSRF; Double Submit Cookie compares header token with cookie token.",
    interviewTip: "Point out why Bearer token APIs do not need CSRF tokens: browsers do not attach custom headers on cross-site form submissions or image tags.",
    tags: ["csrf", "xsrf", "double-submit-cookie", "samesite", "security"]
  }),

  createCard({
    idNum: 78,
    category: "Security Hardening & Defensive Middleware",
    concept: "Information Disclosure: Disabling x-powered-by and Server Signature Stripping",
    priority: "must-know",
    difficulty: "beginner",
    question: "Why should you disable the `X-Powered-By` header in Express, and how do you do it?",
    quickAnswer: "Express sends `X-Powered-By: Express` by default. This advertises the underlying technology stack to potential attackers, enabling automated vulnerability scanners to target known Express or Node.js CVEs. Disable it via `app.disable('x-powered-by')` or `app.set('x-powered-by', false)` (or automatically via `helmet()`).",
    detailedAnswer: "Security through obscurity does not replace fundamental security, but stripping stack identifiers increases attacker reconnaissance cost and prevents automated mass-scanning exploits targeting specific framework fingerprints.\n\nIn addition, reverse proxies (Nginx/Cloudflare) should be configured to strip `Server` response headers (`server_tokens off;`).",
    code: `const express = require('express');
const app = express();

// Method 1: Built-in Express application setting
app.disable('x-powered-by');

// Method 2: Equivalent alternative
// app.set('x-powered-by', false);

// Method 3: Automatically handled by Helmet
// const helmet = require('helmet');
// app.use(helmet.hidePoweredBy());

app.get('/api/ping', (req, res) => {
  res.send('Pong'); // Response headers will NOT include X-Powered-By: Express
});`,
    recallHint: "app.disable('x-powered-by') strips the Express fingerprint to reduce reconnaissance exposure.",
    interviewTip: "This is a quick, high-impact security check commonly scrutinized during SOC2, ISO 27001, and automated penetration test audits.",
    tags: ["x-powered-by", "information-disclosure", "hardening", "express-settings"]
  }),

  createCard({
    idNum: 79,
    category: "Security Hardening & Defensive Middleware",
    concept: "NoSQL Injection Prevention & Mongo Sanitize Middleware",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does NoSQL injection occur in Express MongoDB applications, and how do you prevent it?",
    quickAnswer: "NoSQL injection occurs when unvalidated user input contains MongoDB query operator keys (like `$gt`, `$ne`, or `$regex`). When passed directly to Mongoose or the MongoDB driver, `{ username: 'admin', password: { $ne: null } }` matches any non-null password, bypassing authentication. The `express-mongo-sanitize` middleware strips prohibited `$` and `.` characters from `req.body`, `req.query`, and `req.params`.",
    detailedAnswer: "Exploit Scenario:\nAttacker sends JSON body: `{\"email\": \"admin@corp.com\", \"password\": {\"$ne\": \"\"}}`.\nA naive query `User.findOne({ email: req.body.email, password: req.body.password })` evaluates to `password is not empty`, successfully logging in without the password.\n\nMitigation:\n1. Middleware sanitization: `app.use(mongoSanitize())` recursively removes any key starting with `$` or containing `.`. \n2. Schema validation: Validate using Zod/Joi ensuring `password` is strictly a string.",
    code: `const express = require('express');
const mongoSanitize = require('express-mongo-sanitize');
const app = express();

app.use(express.json());

// Sanitize all request data against NoSQL query operator injection
app.use(mongoSanitize({
  replaceWith: '_' // Replaces prohibited '$' with '_'
}));

app.post('/api/login', async (req, res) => {
  // If attacker sent { "password": { "$ne": null } },
  // mongoSanitize converted it to { "password": { "_ne": null } }, neutralizing injection.
  const user = await User.findOne({
    email: req.body.email,
    password: req.body.password
  });

  res.json({ success: !!user });
});`,
    recallHint: "NoSQL injection uses operator objects ($ne, $gt) in request bodies; use express-mongo-sanitize and strict string validation schemas.",
    interviewTip: "Emphasize that schema validation (e.g. Zod `z.string()`) provides the strongest defense because it rejects objects outright where strings are expected.",
    tags: ["nosql-injection", "mongodb", "mongo-sanitize", "security", "owasp"]
  }),

  createCard({
    idNum: 80,
    category: "Security Hardening & Defensive Middleware",
    concept: "SQL Injection Prevention with Parameterized Queries in Express Repositories",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you guarantee SQL injection prevention in Express data access layers?",
    quickAnswer: "Never concatenate or interpolate user input strings directly into SQL queries (`WHERE id = ' + req.params.id`). Always use parameterized / prepared queries (e.g. `$1, $2` in `pg`, `?, ?` in `mysql2`, or typed ORM builders like Prisma/Drizzle). The database engine compiles the query structure first, treating parameterized values strictly as literals.",
    detailedAnswer: "SQL Injection Mechanics:\nString concatenation allows attackers to supply SQL tokens: `' OR '1'='1` or `'; DROP TABLE users; --`.\n\nParameterized Query Safety:\nThe database driver transmits the SQL command and the parameter values in separate protocol packets or passes them to the database engine's prepared statement parser. The input is never evaluated as SQL syntax, rendering injection impossible.",
    code: `const { Pool } = require('pg');
const pool = new Pool();

// VULNERABLE ANTI-PATTERN: NEVER DO THIS!
// const query = \`SELECT * FROM users WHERE email = '\${req.body.email}'\`;

// SECURE: Parameterized Query using $1, $2 placeholders
app.post('/api/users/search', async (req, res, next) => {
  try {
    const { email, role } = req.body;

    const queryText = \`
      SELECT id, email, full_name, role 
      FROM users 
      WHERE email = $1 AND role = $2
    \`;

    // Values passed separately as array; driver escapes and binds safely
    const result = await pool.query(queryText, [email, role]);

    res.json({ users: result.rows });
  } catch (err) {
    next(err);
  }
});`,
    recallHint: "Never concatenate strings in SQL; always use parameterized queries ($1, ?) or type-safe ORMs.",
    interviewTip: "Mention dynamic identifiers (like column names in `ORDER BY`): parameters only work for data literals, not column names. Whitelist column names explicitly: `const allowedColumns = ['name', 'date'];`.",
    tags: ["sql-injection", "parameterized-queries", "postgres", "database-security", "owasp"]
  }),

  createCard({
    idNum: 81,
    category: "Security Hardening & Defensive Middleware",
    concept: "Slowloris and Slow HTTP Request Attacks Defense (Timeouts & Headers Timeout)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a Slowloris attack against Express/Node.js, and how do you configure HTTP socket timeouts to defend against it?",
    quickAnswer: "Slowloris is a denial-of-service attack where an attacker opens hundreds of TCP connections and sends HTTP request headers agonizingly slowly (e.g. one byte every 10 seconds). This keeps connections open indefinitely, exhausting the server's available file descriptors and connection pool. Defend by configuring `server.headersTimeout`, `server.requestTimeout`, and `server.keepAliveTimeout`.",
    detailedAnswer: "Node.js HTTP Server Timeouts:\n- `headersTimeout`: Maximum time allowed for receiving all HTTP request headers (defaults to 60s in modern Node; reduce to 20-30s in production).\n- `requestTimeout`: Maximum time allowed for receiving the complete HTTP request including body.\n- `keepAliveTimeout`: Inactivity delay before an idle keep-alive socket is closed.\n\nIn addition, reverse proxies (Nginx, AWS ALB, Cloudflare) buffer requests before forwarding them to Express, mitigating Slowloris at the edge.",
    code: `const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

// Defend against Slowloris and slow body attacks
server.headersTimeout = 20000; // 20 seconds to receive headers completely
server.requestTimeout = 30000; // 30 seconds for entire request
server.keepAliveTimeout = 5000; // 5 seconds for idle keep-alive sockets

// Optional: Per-request middleware timeout
const timeout = (ms) => (req, res, next) => {
  res.setTimeout(ms, () => {
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request Timeout' });
    }
  });
  next();
};

app.use(timeout(15000));`,
    recallHint: "Slowloris sends headers byte-by-byte to exhaust file descriptors; defend with server.headersTimeout and edge reverse proxies.",
    interviewTip: "Clarify that Node.js v18+ lowered default `headersTimeout` to 60 seconds specifically to address Slowloris CVEs.",
    tags: ["slowloris", "dos-defense", "headersTimeout", "socket-timeout", "resilience"]
  }),

  createCard({
    idNum: 82,
    category: "Security Hardening & Defensive Middleware",
    concept: "Secure File Uploads (Multer, Magic Numbers MIME Sniffing, Disk vs Memory Storage)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are the security vulnerabilities associated with file uploads in Express, and how do you implement a secure upload pipeline?",
    quickAnswer: "File upload risks include Remote Code Execution (uploading executable `.js`/`.php`), Denial of Service (oversized files filling disk/RAM), and Path Traversal. Secure pipelines: 1. Enforce strict file size limits (`limits.fileSize`). 2. Verify true MIME types by inspecting file Magic Numbers (binary file signatures via `file-type`), not spoofable extensions. 3. Generate randomized server-side filenames. 4. Store uploads in S3/Blob storage rather than local disk.",
    detailedAnswer: "Spoofed Extensions Vulnerability:\nAn attacker can rename `malicious.sh` to `photo.jpg`. If the server only checks `file.mimetype` or the file extension, it accepts malicious executables.\n\nMagic Number Sniffing:\nThe first few bytes of any file contain unique binary signatures (e.g. `FF D8 FF` for JPEG, `89 50 4E 47` for PNG). Inspecting file buffer bytes with `file-type` guarantees true file format.",
    code: `const multer = require('multer');
const { fileTypeFromBuffer } = require('file-type');

// Store temporarily in memory to inspect magic numbers before permanent save
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5 MB maximum
  }
});

app.post('/api/upload/avatar', upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Inspect actual binary magic numbers (independent of client-supplied mime type)
    const detectedType = await fileTypeFromBuffer(req.file.buffer);
    const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

    if (!detectedType || !ALLOWED_MIMES.includes(detectedType.mime)) {
      return res.status(400).json({ error: 'Invalid file format. Only JPEG, PNG, and WebP are permitted.' });
    }

    // Safe randomized key for S3 / Cloud storage
    const storageKey = \`avatars/\${crypto.randomUUID()}.\${detectedType.ext}\`;
    await s3Client.upload(storageKey, req.file.buffer);

    res.json({ success: true, url: \`https://cdn.myapp.com/\${storageKey}\` });
  } catch (err) {
    next(err);
  }
});`,
    recallHint: "Never trust client file extensions or mimetypes; inspect binary magic numbers with file-type and stream to S3/Cloud storage.",
    interviewTip: "Highlight the dangers of `multer.diskStorage()` uploading directly into the public web root: on some servers, navigating to `https://site.com/uploads/exploit.php` immediately executes code.",
    tags: ["file-upload", "multer", "magic-numbers", "file-type", "rce-defense"]
  }),

  createCard({
    idNum: 83,
    category: "Security Hardening & Defensive Middleware",
    concept: "Content Security Policy (CSP) Directives and Nonce Generation in Express",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do cryptographic nonces work in Express Content Security Policy (CSP) to allow inline scripts safely?",
    quickAnswer: "A CSP nonce (number used once) is a cryptographically random token generated per-request in middleware. Express sets this nonce in the `Content-Security-Policy: script-src 'nonce-<random>'` header and injects it into valid HTML `<script nonce=\"...\">` tags. The browser executes only inline scripts possessing the exact matching nonce, blocking malicious injected XSS scripts.",
    detailedAnswer: "Why Nonces?\nModern web applications frequently require dynamic inline scripts or hydration tags. Allowing `'unsafe-inline'` completely nullifies CSP protections against XSS. Nonces provide a mathematically sound balance: every request generates a fresh random base64 string, attached via `res.locals.nonce` and verified by the browser.",
    code: `const crypto = require('crypto');
const helmet = require('helmet');

// 1. Generate unique cryptographic nonce per request
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// 2. Configure Helmet CSP using the dynamic per-request nonce
app.use((req, res, next) => {
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", \`'nonce-\${res.locals.cspNonce}'\`]
    }
  })(req, res, next);
});

// 3. Render template using valid nonce
app.get('/app', (req, res) => {
  res.send(\`
    <!DOCTYPE html>
    <html>
      <head><title>Secure Dashboard</title></head>
      <body>
        <h1>Welcome</h1>
        <!-- Valid inline script authorized by CSP nonce -->
        <script nonce="\${res.locals.cspNonce}">
          console.log('Authorized script executed');
        </script>
      </body>
    </html>
  \`);
});`,
    recallHint: "Generate random nonce per request, inject into CSP script-src header and <script nonce=\"...\"> tag to permit safe inline scripts.",
    interviewTip: "Nonces must be unique per HTTP request and unpredictably random; never hardcode or reuse nonces across requests.",
    tags: ["csp", "nonce", "xss-defense", "helmet", "web-security"]
  }),

  createCard({
    idNum: 84,
    category: "Security Hardening & Defensive Middleware",
    concept: "Prototype Pollution Prevention in JSON Body Parsers",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Prototype Pollution in Express body parsing, and how do you protect your application?",
    quickAnswer: "Prototype Pollution occurs when malicious JSON payloads containing keys like `__proto__`, `constructor`, or `prototype` are merged into JavaScript objects, mutating `Object.prototype`. This can cause Denial of Service or Remote Code Execution. Defend by using up-to-date body parsers, validating schemas with Zod, and freezing `Object.prototype` in critical environments.",
    detailedAnswer: "Exploit Mechanism:\nAn attacker sends `{\"__proto__\": {\"isAdmin\": true}}`. If naive object deep-merge utilities (`lodash.merge` in older versions) process this input, every subsequent object in the Node.js process inherits `{ isAdmin: true }`.\n\nDefenses:\n1. Keep `body-parser` and `express` updated (modern versions strip `__proto__`).\n2. Use schema assertion (Zod rejects unrecognized keys by default).\n3. Use `Object.create(null)` for key-value dictionary lookups so objects have no prototype.\n4. Call `Object.freeze(Object.prototype)` during server bootstrap.",
    code: `// Defense 1: Freeze Object.prototype at application bootstrap
Object.freeze(Object.prototype);

// Defense 2: Schema validation rejecting prototype poisoning keys
const { z } = require('zod');

const SafeUserSchema = z.object({
  username: z.string().min(3),
  email: z.string().email()
}).strict(); // strict() rejects any unexpected prototype or extra properties

app.post('/api/users', (req, res, next) => {
  try {
    const validatedData = SafeUserSchema.parse(req.body);
    res.json({ success: true, user: validatedData });
  } catch (err) {
    next(err);
  }
});`,
    recallHint: "Prototype pollution mutates Object.prototype via __proto__; defeat via modern body parsers, strict Zod schemas, and Object.freeze.",
    interviewTip: "Demonstrate knowledge of Node.js `--disable-proto=delete` CLI flag, which disables the `__proto__` setter entirely at the V8 runtime level.",
    tags: ["prototype-pollution", "vulnerability", "object-freeze", "zod", "security"]
  })
];

module.exports = cards;
