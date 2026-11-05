const fs = require("fs");
const path = require("path");

const productionTopics = [
  {
    id: "exp-prod-01",
    topic: "Zero-Downtime Rolling Deploys, Kubernetes Pod Lifecycle & Ingress Lag",
    category: "DevOps & Infrastructure",
    severity: "Critical / 502 Bad Gateway Outage",
    theProblem: "During continuous deployments in Kubernetes or container clusters, orchestrators send SIGTERM to terminate old pods while routing new traffic to new pods. If Express terminates immediately with process.exit(0) upon receiving SIGTERM, in-flight HTTP requests are abruptly severed. Furthermore, because load balancer routing tables (AWS ALB, Nginx Ingress) take 2-5 seconds to propagate pod deregistration, incoming requests continue hitting the dying pod for several seconds, producing thousands of 502 Bad Gateway errors during every deployment.",
    howItWorksInternally: "When Kubernetes initiates pod termination: 1. The pod enters Terminating state. 2. The endpoint controller removes the pod IP from the Service endpoint slice. 3. Simultaneously, Kubelet executes the preStop hook and sends SIGTERM. Ingress controllers and iptables do not update instantaneously; network propagation introduces a 2-5 second delay. If Express calls server.close() immediately, TCP connections are dropped while the load balancer is still routing traffic to that pod IP. A production lifecycle requires: a preStop or in-process delay, signaling 503 on readiness probes, draining active connections via server.close(), terminating idle keep-alive sockets via server.closeIdleConnections(), and closing database pools cleanly.",
    productionCode: `const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

// Keep-alive synchronization: Express timeout must exceed upstream proxy (ALB = 60s)
server.keepAliveTimeout = 65000;
server.headersTimeout = 66000;

let isShuttingDown = false;

// 1. Readiness probe signals unready immediately to trigger ingress removal
app.get('/healthz/ready', (req, res) => {
  if (isShuttingDown) {
    return res.status(503).json({ status: 'shutting_down' });
  }
  res.status(200).json({ status: 'ready' });
});

// 2. Middleware tagging in-flight responses during draining phase
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.setHeader('Connection', 'close'); // Instruct client not to reuse TCP socket
  }
  next();
});

// 3. Graceful shutdown orchestrator
async function shutdown(signal) {
  console.log(\`Received \${signal}. Starting graceful shutdown sequence...\`);
  isShuttingDown = true;

  // STEP A: Wait 4 seconds for Ingress / ALB to remove pod from routing table
  await new Promise(r => setTimeout(r, 4000));

  // STEP B: Stop accepting new TCP connections
  server.close(async () => {
    console.log('HTTP server closed. Draining database connection pools...');
    try {
      await dbPool.end();
      await redisClient.quit();
      console.log('Teardown complete. Exiting cleanly.');
      process.exit(0);
    } catch (err) {
      console.error('Error during cleanup:', err);
      process.exit(1);
    }
  });

  // STEP C: Close idle persistent Keep-Alive sockets (Node 19+)
  if (typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }

  // STEP D: Watchdog safety timer - force exit if active requests hang
  setTimeout(() => {
    console.error('Graceful shutdown timeout exceeded. Forcing exit.');
    process.exit(1);
  }, 25000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));`,
    monitoringMetrics: [
      "HTTP 502 / 504 Bad Gateway rate during deployment rollouts > 0.01% [Severity: Critical]",
      "Active connections count draining duration > 20s [Severity: High]",
      "Pod termination watchdog timeouts triggered [Severity: Critical]",
      "Kubernetes pod restart count > 0 during steady state [Severity: High]"
    ],
    productionChecklist: [
      "Configure `server.keepAliveTimeout = 65000` (exceeding AWS ALB / Ingress 60s idle timeout).",
      "Implement a 3-5 second delay after receiving `SIGTERM` before invoking `server.close()`.",
      "Immediately return HTTP 503 on `/healthz/ready` to remove pod from load balancer pool.",
      "Call `server.closeIdleConnections()` to terminate persistent keep-alive connections.",
      "Attach `.unref()` to watchdog timeout to allow the event loop to exit naturally if work finishes earlier."
    ]
  },

  {
    id: "exp-prod-02",
    topic: "Memory Leak Profiling & Heap Snapshot Forensics in Express Services",
    category: "Memory & Performance",
    severity: "Critical / Out of Memory Process Crashes",
    theProblem: "In long-running Express microservices handling millions of requests, subtle memory leaks (unbounded global arrays, un-removed event listeners, closures holding request references, unevicted caches) gradually consume V8 heap memory. Over days, memory climbs from 150MB to 2GB until Node crashes with 'JavaScript heap out of memory' (Exit Code 134), triggering rolling container restarts and degraded API throughput.",
    howItWorksInternally: "V8 garbage collection (Scavenge for young generation, Mark-Sweep-Compact for old generation) reclaims memory by traversing references starting from GC Roots (global object, execution stack, DOM/C++ bindings). A memory leak in Node occurs when an object that is no longer needed remains reachable from a root. For example, pushing `{ req, timestamp }` into a global telemetry array pins the entire `req` object, its headers, socket, buffers, and all closures referenced by handlers in RAM permanently. Diagnosing leaks requires capturing sequential V8 Heap Snapshots and comparing 'Objects allocated between Snapshot 1 and Snapshot 2'.",
    productionCode: `const express = require('express');
const v8 = require('v8');
const fs = require('fs');
const app = express();

// Diagnostic endpoint: Secure programmatic heap snapshot for staging environments
app.post('/api/admin/diagnostics/heap-dump', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({ error: 'Heap dump disabled in production' });
  }

  const filename = \`heap-\${Date.now()}.heapsnapshot\`;
  const dumpPath = v8.writeHeapSnapshot(filename);

  res.json({
    message: 'Heap snapshot created successfully',
    path: dumpPath,
    memoryUsage: process.memoryUsage()
  });
});

// Production Safe Caching: Enforce LRU eviction bounds (NEVER use raw plain objects!)
const { LRUCache } = require('lru-cache');
const safeCache = new LRUCache({
  max: 5000, // Maximum 5,000 items in memory
  maxSize: 50 * 1024 * 1024, // 50MB max cache size
  sizeCalculation: (val) => JSON.stringify(val).length,
  ttl: 1000 * 60 * 10 // 10-minute TTL
});

// Periodic heap memory telemetry
setInterval(() => {
  const mem = process.memoryUsage();
  const heapUsedMb = (mem.heapUsed / 1024 / 1024).toFixed(2);
  const rssMb = (mem.rss / 1024 / 1024).toFixed(2);

  if (mem.heapUsed > 1024 * 1024 * 1024) { // > 1GB
    console.warn(\`[HIGH MEMORY ALERT] HeapUsed: \${heapUsedMb}MB | RSS: \${rssMb}MB\`);
  }
}, 30000).unref();`,
    monitoringMetrics: [
      "process.memoryUsage().heapUsed continuously increasing over 24h [Severity: Critical]",
      "process.memoryUsage().rss approaching container memory limits (e.g. > 85%) [Severity: High]",
      "V8 Garbage Collection pause duration > 100ms [Severity: High]",
      "Container restarts with OOMKilled (Exit Code 137) [Severity: Critical]"
    ],
    productionChecklist: [
      "Never store in-memory caches in unbounded JavaScript objects or Maps; always use bounded `lru-cache`.",
      "Ensure all custom `EventEmitter` listeners on sockets or requests are removed in `finish` or `close`.",
      "Avoid capturing entire `req` or `res` objects inside long-lived promises or async timers.",
      "Profile heap leaks by loading `.heapsnapshot` files into Chrome DevTools Memory tab.",
      "Configure container memory limits with appropriate headroom: set `NODE_OPTIONS=\"--max-old-space-size=1536\"` for a 2GB container."
    ]
  },

  {
    id: "exp-prod-03",
    topic: "Database Connection Pool Exhaustion, Latency Spikes & Deadlock Prevention",
    category: "Database & Persistence",
    severity: "Critical / Total Service Unavailability",
    theProblem: "Under high concurrent traffic spikes (e.g. flash sales, marketing campaigns), Express endpoints bottleneck on database queries. If pool sizes are misconfigured, queries hold connections during third-party HTTP calls, or transactions fail to release connections in error paths, the pool's available connections drop to 0. Subsequent requests queue up waiting for connections, request latency jumps from 20ms to 30,000ms, and the entire API freezes with 504 Gateway Timeouts.",
    howItWorksInternally: "PostgreSQL forks an operating system process per connection. Having 200 connections across 10 Express pods (2,000 DB processes) overwhelms database CPU due to OS context switching. In Express, pg.Pool maintains idle connections. When all connections are busy, queries queue in pool.waitingCount. If a transaction holds a checkout while executing await fetch('https://stripe.com'), that database connection is blocked for seconds. To maximize throughput: 1. Keep pool size small (15-25 connections per pod). 2. Enforce strict connection acquisition timeouts (connectionTimeoutMillis: 5000). 3. Always release clients in finally blocks. 4. Never execute external network calls inside active SQL transactions.",
    productionCode: `const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // 20 connections max per container instance
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000, // Fail fast: throw error if checkout takes > 5s
  statement_timeout: 10000 // Abort queries taking longer than 10s
});

// Pool saturation telemetry
setInterval(() => {
  if (pool.waitingCount > 0) {
    console.warn(\`[DB POOL BOTTLENECK] Waiting queries: \${pool.waitingCount} | Active: \${pool.totalCount - pool.idleCount}/\${pool.totalCount}\`);
  }
}, 5000).unref();

// Bulletproof Transaction Runner Helper
async function runTransaction(operation) {
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
    // MANDATORY: Guarantees client release even on unhandled exceptions!
    client.release();
  }
}

// Controller demonstrating atomic execution without leak risk
app.post('/api/checkout', async (req, res, next) => {
  try {
    // Pre-calculate external API calls BEFORE opening database transaction!
    const payment = await stripeService.charge(req.body.token);

    // Short, fast database transaction (< 20ms)
    const order = await runTransaction(async (client) => {
      await orderRepo.create(client, req.body, payment.id);
      await inventoryRepo.decrement(client, req.body.items);
      return { orderId: 'ord_99', status: 'confirmed' };
    });

    res.status(201).json(order);
  } catch (err) {
    next(err);
  }
});`,
    monitoringMetrics: [
      "pg.Pool waitingCount > 5 queries queued [Severity: High]",
      "pg.Pool idleCount === 0 continuously for > 15s [Severity: Critical]",
      "Database query execution latency p99 > 250ms [Severity: High]",
      "Database connection acquisition timeouts (5000ms breached) [Severity: Critical]"
    ],
    productionChecklist: [
      "Set `connectionTimeoutMillis: 5000` to fail fast rather than hanging incoming HTTP sockets indefinitely.",
      "Enforce PostgreSQL `statement_timeout = 10000` to automatically cancel runaway queries.",
      "NEVER execute external HTTP calls, crypto operations, or disk I/O while holding an open DB transaction.",
      "Always call `client.release()` inside a `finally` block.",
      "Use PgBouncer or AWS RDS Proxy between Express and PostgreSQL for multi-thousand connection multiplexing."
    ]
  },

  {
    id: "exp-prod-04",
    topic: "Event Loop Starvation, CPU Starvation & Worker Thread Offloading",
    category: "Performance & Threading",
    severity: "Critical / High Latency & Request Dropping",
    theProblem: "Because Node.js executes JavaScript on a single thread, any CPU-intensive synchronous task (e.g. processing large JSON bodies, CSV generation, image transcoding, catastrophic backtracking regular expressions, cryptographic operations) blocks the event loop. While the loop is blocked, Express cannot accept new connections, handle incoming network packets, or resolve database callbacks, causing all concurrent users to experience extreme latency spikes.",
    howItWorksInternally: "The libuv event loop processes phases: Timers -> Pending Callbacks -> Poll -> Check -> Close. When synchronous code runs for 300ms, the Poll phase is starved: the OS network buffer fills with incoming TCP SYN packets until the kernel drops them. To prevent event loop starvation: 1. Monitor event loop lag using perf_hooks. 2. Offload CPU-bound calculations to worker_threads (which execute on separate OS threads). 3. Reject ReDoS vulnerabilities by banning nested quantifiers in user input regexes. 4. Stream large file transformations instead of buffering in memory.",
    productionCode: `const express = require('express');
const { Worker } = require('worker_threads');
const { monitorEventLoopDelay } = require('perf_hooks');

const app = express();

// 1. Continuous Event Loop Delay Monitoring
const lagSampler = monitorEventLoopDelay({ resolution: 20 });
lagSampler.enable();

// Telemetry logging every 10 seconds
setInterval(() => {
  const p99Ms = Number(lagSampler.percentile(99)) / 1e6;
  if (p99Ms > 50) {
    console.warn(\`[EVENT LOOP LAG ALERT] p99 Delay: \${p99Ms.toFixed(2)}ms (CPU starved!)\`);
  }
  lagSampler.reset();
}, 10000).unref();

// 2. Offload CPU-Heavy Computation to Dedicated Worker Thread
function runHeavyCalculationInWorker(data) {
  return new Promise((resolve, reject) => {
    // Spawns task onto background OS thread, keeping main event loop responsive!
    const worker = new Worker('./workers/computeWorker.js', { workerData: data });
    worker.on('message', resolve);
    worker.on('error', reject);
    worker.on('exit', (code) => {
      if (code !== 0) reject(new Error(\`Worker terminated with exit code \${code}\`));
    });
  });
}

app.post('/api/reports/heavy-aggregate', async (req, res, next) => {
  try {
    // Main event loop stays at < 1ms lag while heavy worker calculates!
    const aggregate = await runHeavyCalculationInWorker(req.body);
    res.json(aggregate);
  } catch (err) {
    next(err);
  }
});`,
    monitoringMetrics: [
      "Event loop p99 delay via monitorEventLoopDelay > 50ms [Severity: High]",
      "Node.js process CPU utilization > 85% [Severity: High]",
      "HTTP response time p99 / p50 skew ratio > 10x [Severity: Medium]",
      "Socket connection backlog drops [Severity: Critical]"
    ],
    productionChecklist: [
      "Instrument `perf_hooks.monitorEventLoopDelay()` and ship p50/p90/p99 lag to Prometheus/Datadog.",
      "Offload CPU tasks taking > 20ms to `worker_threads` or asynchronous background worker queues (BullMQ).",
      "Audit all regular expressions for catastrophic backtracking (ReDoS) using tools like `safe-regex`.",
      "Never use synchronous methods (`fs.readFileSync`, `crypto.pbkdf2Sync`, `bcrypt.hashSync`) in route handlers.",
      "Implement automated 503 Load Shedding when event loop lag crosses safety thresholds."
    ]
  },

  {
    id: "exp-prod-05",
    topic: "Horizontal Scaling: PM2 Multi-Core Clustering vs Kubernetes Pods",
    category: "Architecture & Scaling",
    severity: "High / Sub-Optimal Compute Resource Utilization",
    theProblem: "Running a single Express process on an 8-core, 16GB RAM production server utilizes only 1 CPU core (12.5% CPU capacity), while the remaining 7 cores sit idle. Teams struggle to choose between using Node's cluster module / PM2 process manager vs containerized Kubernetes replica sets, frequently misconfiguring shared state, file uploads, and session persistence.",
    howItWorksInternally: "Operating systems schedule processes onto CPU cores. In Node clustering: A master process creates child workers via fork() and shares the server TCP listening port via SO_REUSEPORT or internal master IPC socket handover (round-robin on Linux). However, clustered workers share ZERO memory: in-memory variables (sessions, counters, rate limits) are isolated to each worker process. In Kubernetes: horizontal pod autoscaling (HPA) scales independent 1-CPU container pods, managing traffic routing via kube-proxy / iptables. Architectural rule: All shared state (sessions, rate limits, caches) MUST be externalized to Redis or databases.",
    productionCode: `// ecosystem.config.js (PM2 Production Multi-Core Cluster Configuration)
module.exports = {
  apps: [
    {
      name: 'express-api',
      script: './src/server.js',
      instances: 'max', // Utilizes 100% of available CPU cores
      exec_mode: 'cluster',
      watch: false,
      max_memory_restart: '1G', // Auto-restarts worker if memory leaks past 1GB
      kill_timeout: 10000, // Waits 10s for graceful request draining on reload
      wait_ready: true, // Waits for process.send('ready') before routing traffic
      listen_timeout: 8000,
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
};

// In src/server.js: Signal PM2 zero-downtime readiness
const server = app.listen(process.env.PORT || 3000, () => {
  console.log(\`Worker \${process.pid} listening on port \${process.env.PORT || 3000}\`);
  // Signals PM2 that database connections and warmup are complete!
  if (process.send) {
    process.send('ready');
  }
});`,
    monitoringMetrics: [
      "Per-core CPU utilization balance across worker processes [Severity: Medium]",
      "Worker process restart count (PM2 / Kubernetes pod restarts) [Severity: High]",
      "External Redis connection pool count across workers [Severity: Medium]",
      "Memory distribution skew across clustered workers [Severity: Medium]"
    ],
    productionChecklist: [
      "Never store session data or rate-limit counters in worker memory; use Redis.",
      "Use `pm2 reload ecosystem.config.js` for zero-downtime rolling cluster restarts.",
      "Signal `process.send('ready')` only after database and cache connections are established.",
      "In Kubernetes, favor running 1 container per 1 CPU core with HPA rather than clustering inside the container.",
      "Set `max_memory_restart` as a safety net against undetected memory leaks in legacy codebases."
    ]
  },

  {
    id: "exp-prod-06",
    topic: "Hardened HTTP Response Security Headers & Dynamic CSP Nonce Engineering",
    category: "Security & Compliance",
    severity: "Critical / Cross-Site Scripting (XSS) & Clickjacking",
    theProblem: "Express returns zero default security headers out of the box, advertising framework fingerprints via X-Powered-By: Express and leaving web apps vulnerable to Cross-Site Scripting (XSS), Clickjacking, MIME-type confusion attacks, and Man-in-the-Middle downgrades. Automated penetration tests and enterprise compliance audits (SOC2, ISO 27001, PCI-DSS) immediately fail applications lacking strict Content Security Policies.",
    howItWorksInternally: "Modern browsers enforce client-side security policies defined in HTTP response headers. Helmet configures 15 sub-middlewares: Content-Security-Policy (CSP) restricts origins from which scripts, styles, fonts, and WebSocket connections can execute; Strict-Transport-Security (HSTS) instructs browsers to refuse unencrypted HTTP for 1-2 years; X-Frame-Options: DENY blocks iframe embedding (clickjacking); and X-Content-Type-Options: nosniff stops MIME sniffing. Dynamic CSP nonces allow trusted inline scripts while completely neutralizing injected XSS payloads.",
    productionCode: `const express = require('express');
const helmet = require('helmet');
const crypto = require('crypto');

const app = express();

// 1. Generate unique base64 nonce per request
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// 2. Production Hardened Helmet Configuration
app.use((req, res, next) => {
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Only scripts with the dynamic nonce can execute: blocks all injected XSS!
        scriptSrc: ["'self'", \`'nonce-\${res.locals.cspNonce}'\`],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https://cdn.myapp.com'],
        connectSrc: ["'self'", 'https://api.myapp.com', 'wss://realtime.myapp.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        objectSrc: ["'none'"], // Disables vulnerable plugins (Flash/Java)
        upgradeInsecureRequests: [] // Rewrites HTTP URLs to HTTPS
      }
    },
    hsts: {
      maxAge: 31536000, // Enforce HTTPS for 1 full year
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' }, // Anti-Clickjacking
    noSniff: true, // Stops MIME sniffing
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  })(req, res, next);
});

// Explicitly disable framework signature
app.disable('x-powered-by');`,
    monitoringMetrics: [
      "CSP Violation Reports via report-uri / report-to [Severity: High]",
      "Unencrypted HTTP traffic attempts (HSTS redirects) [Severity: Medium]",
      "Vulnerability scan findings for missing security headers [Severity: High]",
      "MIME-type sniffing rejection counts [Severity: Low]"
    ],
    productionChecklist: [
      "Always call `app.use(helmet(...))` before declaring any static file servers or route handlers.",
      "Call `app.disable('x-powered-by')` to strip framework fingerprints.",
      "Use dynamic per-request nonces (`'nonce-...'`) rather than `'unsafe-inline'` for script execution.",
      "Enable HSTS with `includeSubDomains: true` and `preload: true` for domain preloading.",
      "Verify headers using online scanners like securityheaders.com targeting an A+ rating."
    ]
  },

  {
    id: "exp-prod-07",
    topic: "Distributed Rate Limiting & Denial-of-Service Defense with Redis Sliding Windows",
    category: "Security & Rate Limiting",
    severity: "Critical / Brute-Force & Denial of Service",
    theProblem: "Publicly accessible authentication and transaction endpoints are constant targets for credential stuffing, brute-force password spraying, scraping, and Denial of Service (DoS). In-memory rate limiters fail completely in Kubernetes clusters: 10 pods give attackers 10x the allowed rate. Furthermore, fixed-window rate limiters suffer from edge bursting (allowing 2x traffic bursts at window boundaries).",
    howItWorksInternally: "Distributed rate limiting coordinates request counters across all application nodes using Redis. Fixed-window algorithms increment a key (e.g. rate:ip:minute) with EXPIRE. Sliding window algorithms maintain a Redis Sorted Set (ZSET) where each entry's score and value are the microsecond timestamp of the request. On each request: 1. Remove expired timestamps: ZREMRANGEBYSCORE key 0 (now - window). 2. Count remaining timestamps: ZCARD key. 3. If count < limit, add request: ZADD key now now and allow. 4. If count >= limit, reject with 429 Too Many Requests and RateLimit-* headers.",
    productionCode: `const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { createClient } = require('redis');

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

// 1. Tiered Limiter: Strict for Auth Endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15-minute window
  max: 5, // 5 failed attempts per IP
  standardHeaders: true, // Returns RateLimit-Limit, RateLimit-Remaining, RateLimit-Reset
  legacyHeaders: false,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:auth:'
  }),
  message: {
    status: 429,
    error: 'Too many login attempts. Account temporarily locked. Please try again in 15 minutes.'
  }
});

// 2. Tiered Limiter: Moderate for General API Endpoints
const globalApiLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  standardHeaders: true,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:global:'
  }),
  // Key by authenticated User ID if logged in, fallback to IP
  keyGenerator: (req) => req.user?.id || req.ip
});

app.post('/api/auth/login', authLimiter, (req, res) => res.json({ status: 'ok' }));
app.use('/api/', globalApiLimiter);`,
    monitoringMetrics: [
      "HTTP 429 Too Many Requests response rates [Severity: Medium / High if > 5%]",
      "Redis latency for rate-limiting ZSET commands > 5ms [Severity: High]",
      "Brute force attempt alerts on /api/auth/login [Severity: High]",
      "Unique IP diversity during traffic surges [Severity: Medium]"
    ],
    productionChecklist: [
      "Use `rate-limit-redis` with a shared Redis cluster to synchronize quotas across all container replicas.",
      "Key rate limits by `req.user.id` for authenticated endpoints and `req.ip` for public endpoints.",
      "Verify `app.set('trust proxy', ...)` is properly configured so `req.ip` reflects true client IPs.",
      "Return standard `RateLimit-*` draft RFC response headers to enable client-side backoff.",
      "Implement IP whitelisting for internal webhooks and health-check monitoring probes."
    ]
  },

  {
    id: "exp-prod-08",
    topic: "Stateless JWT vs Distributed Redis Session Performance & Security Matrix",
    category: "Identity & Authentication",
    severity: "High / Credential Compromise & Revocation Lag",
    theProblem: "Engineering teams frequently debate between purely stateless JWTs vs stateful Redis sessions. Stateless JWTs cannot be revoked instantly if a user's password changes, permissions are stripped, or a device is stolen, because the token remains cryptographically valid until expiration. Conversely, naive database sessions introduce a database query on every single HTTP request, creating severe latency bottlenecks.",
    howItWorksInternally: "Stateless JWTs encode claims in JSON signed via HMAC-SHA256 or RS256. Verification is CPU-bound (signature calculation) with zero database I/O. However, immediate revocation requires maintaining a distributed token blacklist (bringing state back into the system!). Stateful Redis sessions store session data in RAM, requiring a sub-millisecond Redis GET on every request, but permit instant session invalidation (redis.del(sessionId)). The enterprise compromise: Short-lived access tokens (10-15 mins) kept in memory + Refresh tokens in HttpOnly cookies verified against a database/Redis allow list on refresh.",
    productionCode: `// Architecture Comparison: Dual-Token Hybrid (Best of Both Worlds)
const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

// Fast stateless access token verification (0 database queries!)
function authenticateAccessToken(req, res, next) {
  const authHeader = req.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing Bearer token' });
  }

  try {
    const token = authHeader.split(' ')[1];
    // Pure CPU cryptographic verification: ultra-fast (sub-millisecond)
    req.user = jwt.verify(token, ACCESS_SECRET, { algorithms: ['HS256'] });
    next();
  } catch (err) {
    res.status(401).json({ error: 'Token expired or invalid', code: 'TOKEN_EXPIRED' });
  }
}

// Refresh token endpoint: State-checked against Redis for instant revocation ability!
app.post('/api/auth/refresh', async (req, res) => {
  const refreshToken = req.cookies.refreshToken;
  if (!refreshToken) return res.status(401).json({ error: 'No refresh token' });

  const decoded = jwt.verify(refreshToken, REFRESH_SECRET);

  // Instant Revocation Check: Is this session active in Redis?
  const sessionActive = await redisClient.get(\`sess:\${decoded.userId}:\${decoded.sessionId}\`);
  if (!sessionActive) {
    res.clearCookie('refreshToken');
    return res.status(403).json({ error: 'Session revoked. Re-login required.' });
  }

  // Issue fresh 15-minute access token
  const newAccessToken = jwt.sign({ id: decoded.userId, role: decoded.role }, ACCESS_SECRET, { expiresIn: '15m' });
  res.json({ accessToken: newAccessToken });
});`,
    monitoringMetrics: [
      "JWT verification failure rate (signature mismatch vs expiration) [Severity: Medium]",
      "Redis session lookup latency p99 > 2ms [Severity: High]",
      "Session revocation event latency to all nodes [Severity: Low]",
      "Token refresh frequency surges (potential refresh storms) [Severity: High]"
    ],
    productionChecklist: [
      "Keep stateless access token lifetimes short (10-15 minutes max) to bound the revocation delay window.",
      "Store refresh tokens exclusively in `HttpOnly`, `Secure`, `SameSite=Strict` cookies.",
      "Explicitly enforce `{ algorithms: ['HS256'] }` or `RS256` to prevent `\"alg\": \"none\"` vulnerabilities.",
      "Maintain a centralized Redis session registry for instant user logout and permission revocations.",
      "Never store sensitive PII (passwords, credit card tokens) inside JWT claims (base64 is readable by anyone)."
    ]
  },

  {
    id: "exp-prod-09",
    topic: "Real-Time Streaming: Server-Sent Events (SSE) vs WebSockets Scalability",
    category: "Real-Time & Streaming",
    severity: "High / Connection Limits & Gateway Buffering",
    theProblem: "When implementing real-time data feeds (AI/LLM token streaming, notifications, financial tickers), teams often jump straight to WebSockets, introducing complex framing protocols, dedicated load balancing sticky sessions, and stateful socket servers. Conversely, teams attempting Server-Sent Events (SSE) in Express suffer from Nginx buffering responses, HTTP/1.1 6-connection browser limits, and zombie connection memory leaks.",
    howItWorksInternally: "WebSockets upgrade HTTP to a bidirectional TCP protocol, requiring dedicated stateful gateway infrastructure and complex reconnection logic. Server-Sent Events (SSE) is pure unidirectional HTTP: the server keeps an HTTP connection open with Content-Type: text/event-stream, writing data chunks formatted as data: <payload>\\n\\n. When running over HTTP/2 or HTTP/3, the browser's 6-connection per domain limit is eliminated via multiplexing. In production Express, you MUST set X-Accel-Buffering: no to prevent Nginx/ALB reverse proxies from buffering SSE tokens.",
    productionCode: `const express = require('express');
const app = express();

app.get('/api/stream/events', (req, res) => {
  // 1. Mandatory SSE Response Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // CRITICAL: Disables response buffering in Nginx / Cloudflare!
  });

  // Flush initial connection event
  res.write('data: {"status": "connected"}\\n\\n');

  // Push updates every 2 seconds
  const interval = setInterval(() => {
    const payload = JSON.stringify({ timestamp: new Date().toISOString(), memory: process.memoryUsage().heapUsed });
    res.write(\`data: \${payload}\\n\\n\`);
  }, 2000);

  // 2. CRUCIAL: Detect client connection drops and clear intervals to prevent memory leaks!
  req.on('close', () => {
    clearInterval(interval);
    res.end();
    console.log(\`SSE client disconnected: \${req.ip}\`);
  });
});`,
    monitoringMetrics: [
      "Open persistent SSE connections count [Severity: Medium]",
      "Active socket count vs OS file descriptor limits (`ulimit -n`) [Severity: Critical]",
      "SSE chunk delivery latency from write to client render [Severity: Medium]",
      "Zombie connection accumulation after client unmounts [Severity: High]"
    ],
    productionChecklist: [
      "Always set `'X-Accel-Buffering': 'no'` to disable Nginx reverse proxy chunk buffering.",
      "Always attach a `req.on('close')` listener to clear timers, generators, and listeners when clients disconnect.",
      "Serve SSE over HTTP/2 to overcome the browser HTTP/1.1 limit of 6 concurrent connections per domain.",
      "Format all SSE chunks strictly with `data: <json>\\n\\n` (double newline is required by the W3C spec).",
      "Include a periodic heartbeat comment (`: keepalive\\n\\n`) every 15-30s to keep firewalls from dropping idle sockets."
    ]
  },

  {
    id: "exp-prod-10",
    topic: "Structured JSON Telemetry, Correlation Tracing & OpenTelemetry APM",
    category: "Observability & Monitoring",
    severity: "High / Mean-Time-To-Resolution (MTTR) Inflation",
    theProblem: "Using raw console.log('user logged in ' + id) produces unstructured, un-queryable text logs. When an incident occurs in a microservices cluster, engineers cannot correlate which frontend user action triggered a cascading database failure across 10 distributed services. Debugging takes hours instead of minutes, severely inflating Mean-Time-To-Resolution (MTTR).",
    howItWorksInternally: "Structured logging formats all log output as JSON objects containing standard fields (timestamp, level, correlationId, service, environment, userId). High-performance loggers like Pino write to stdout asynchronously without blocking the event loop (unlike console.log which is synchronous on stdout when redirected to files on Linux!). Distributed tracing propagates a W3C traceparent header (containing trace-id and parent-id) across HTTP boundaries, enabling OpenTelemetry, Jaeger, and Datadog to reconstruct the entire distributed call tree.",
    productionCode: `const express = require('express');
const pino = require('pino');
const pinoHttp = require('pino-http');
const crypto = require('crypto');

const app = express();

// High-performance asynchronous JSON logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label })
  }
});

// HTTP Request Logging Middleware with Correlation IDs
app.use(pinoHttp({
  logger,
  genReqId: (req) => req.get('x-correlation-id') || req.get('traceparent') || crypto.randomUUID(),
  customLogLevel: (req, res, err) => {
    if (res.statusCode >= 500 || err) return 'error';
    if (res.statusCode >= 400) return 'warn';
    return 'info';
  },
  serializers: {
    req: (req) => ({
      id: req.id,
      method: req.method,
      url: req.url,
      ip: req.ip
    }),
    res: (res) => ({
      statusCode: res.statusCode
    })
  }
}));

app.get('/api/orders/:id', (req, res) => {
  // Access request-scoped logger with correlation ID automatically attached!
  req.log.info({ orderId: req.params.id }, 'Fetching order details');
  res.json({ id: req.params.id, status: 'Shipped' });
});`,
    monitoringMetrics: [
      "Log ingestion volume and dropped log rates [Severity: Medium]",
      "5xx Error log frequency anomalies [Severity: High]",
      "Request duration percentiles (p50, p95, p99) extracted from access logs [Severity: High]",
      "Missing correlation ID percentage across distributed services [Severity: Medium]"
    ],
    productionChecklist: [
      "Use `pino` or `winston` instead of raw `console.log` for non-blocking asynchronous JSON output.",
      "Extract or generate a unique correlation ID on ingress and propagate it across all downstream HTTP/gRPC calls.",
      "Echo the `X-Correlation-ID` header back in API responses so users can provide it in support tickets.",
      "Never log sensitive PII (credit cards, passwords, authorization tokens, medical records).",
      "Configure log levels dynamically via environment variables (`info` in prod, `debug` in staging)."
    ]
  },

  {
    id: "exp-prod-11",
    topic: "Reverse Proxy Coordination: AWS ALB, Nginx & Cloudflare Keep-Alive Synchronization",
    category: "Networking & Infrastructure",
    severity: "Critical / Intermittent 502 Bad Gateway Errors",
    theProblem: "A classic production issue in AWS, GCP, and Nginx environments is sporadic 502 Bad Gateway errors occurring under low-to-medium traffic. Developers search Express error logs and find zero errors. The root cause is a race condition between the reverse proxy and Node.js keep-alive timeouts: Node closes an idle keep-alive socket at the exact millisecond the proxy forwards a new request onto that socket.",
    howItWorksInternally: "When HTTP Keep-Alive is enabled, reverse proxies (AWS Application Load Balancer, Nginx, Cloudflare) maintain persistent TCP connection pools to backend Express instances. If the backend server closes an idle socket first, a request in flight from the proxy arrives at a closed socket, resulting in an immediate TCP RST packet. The proxy cannot retry non-idempotent requests (POST/PUT), returning 502 Bad Gateway to the user. Rule: The backend Express server's keep-alive timeout MUST be strictly GREATER than the upstream proxy's idle timeout.",
    productionCode: `const express = require('express');
const http = require('http');

const app = express();
const server = http.createServer(app);

// TIMEOUT HIERARCHY RULES FOR AWS ALB / NGINX:
// Upstream AWS ALB Idle Timeout: 60 seconds (60000ms)
// Backend Express keepAliveTimeout: MUST BE GREATER than ALB (e.g. 65000ms)
// Backend Express headersTimeout: MUST BE GREATER than keepAliveTimeout (e.g. 66000ms)

server.keepAliveTimeout = 65000;  // 65 seconds (ALB is 60s)
server.headersTimeout = 66000;    // 66 seconds (exceeds keepAliveTimeout)
server.requestTimeout = 30000;    // 30 seconds max for receiving request payload

// Configure trust proxy with explicit private VPC subnets
app.set('trust proxy', ['loopback', '10.0.0.0/8', '172.16.0.0/12']);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

server.listen(process.env.PORT || 3000);`,
    monitoringMetrics: [
      "AWS ALB HTTPCode_Target_5XX_Count metrics [Severity: Critical]",
      "TargetConnectionErrors on load balancer metrics [Severity: High]",
      "Premature socket close occurrences (`ECONNRESET`) in proxy logs [Severity: High]",
      "Keep-alive socket reuse ratio [Severity: Medium]"
    ],
    productionChecklist: [
      "Always set `server.keepAliveTimeout` higher than your load balancer's idle timeout (e.g. 65s vs 60s).",
      "Always set `server.headersTimeout` higher than `server.keepAliveTimeout` (e.g. 66s vs 65s).",
      "Never set `app.set('trust proxy', true)` blindly; specify exact VPC CIDR blocks to prevent IP spoofing.",
      "Verify reverse proxies buffer client requests before forwarding to mitigate Slowloris attacks.",
      "Enable HTTP/2 on the reverse proxy edge to multiplex client traffic into consolidated backend keep-alive connections."
    ]
  },

  {
    id: "exp-prod-12",
    topic: "Microservice Resilience: Circuit Breakers (Opossum), Retries & Fallbacks",
    category: "Distributed Systems & Resilience",
    severity: "Critical / Cascading System-Wide Outages",
    theProblem: "In a microservices architecture, when a non-critical downstream service (e.g. recommendations, email notifications, currency conversion) experiences latency or crashes, an Express API gateway continues sending thousands of requests. Requests queue up waiting for timeouts, exhausting Express socket pools, thread workers, and memory until the API gateway ITSELF crashes, turning a minor downstream issue into a catastrophic total platform outage.",
    howItWorksInternally: "The Circuit Breaker pattern acts like an electrical circuit breaker: 1. CLOSED (Normal): Requests pass through to downstream service. 2. OPEN (Failing): When failure rate crosses a threshold (e.g. 50%), the breaker trips OPEN. Subsequent requests immediately fail-fast or return cached fallbacks without touching the failing service. 3. HALF-OPEN (Testing): After a reset timeout (e.g. 30s), a single probe request is allowed through. If it succeeds, the breaker resets to CLOSED; if it fails, it trips back to OPEN. This shields downstream services and isolates failures completely.",
    productionCode: `const express = require('express');
const CircuitBreaker = require('opossum');

const app = express();

// Downstream microservice call with strict AbortSignal timeout
async function fetchUserRecommendations(userId) {
  const response = await fetch(\`http://recommendations.internal:5005/users/\${userId}\`, {
    signal: AbortSignal.timeout(2000) // 2-second timeout
  });
  if (!response.ok) throw new Error(\`Downstream failed with status \${response.status}\`);
  return response.json();
}

// Circuit Breaker Configuration
const breakerOptions = {
  timeout: 2500, // Trigger failure if call takes > 2.5s
  errorThresholdPercentage: 50, // Trip OPEN if > 50% calls fail in window
  resetTimeout: 30000, // Wait 30s before entering HALF-OPEN state
  rollingCountTimeout: 10000 // 10-second monitoring window
};

const breaker = new CircuitBreaker(fetchUserRecommendations, breakerOptions);

// Fallback logic when circuit is OPEN
breaker.fallback((userId) => ({
  userId,
  recommendations: ['default_trending_item_1', 'default_trending_item_2'],
  isFallback: true
}));

// Observability telemetry
breaker.on('open', () => console.warn('[CIRCUIT BREAKER] Recommendations service TRIPPED TO OPEN!'));
breaker.on('halfOpen', () => console.log('[CIRCUIT BREAKER] Testing recommendations service in HALF-OPEN state...'));
breaker.on('close', () => console.log('[CIRCUIT BREAKER] Recommendations service RECOVERED (CLOSED).'));

app.get('/api/users/:id/feed', async (req, res, next) => {
  try {
    const recommendations = await breaker.fire(req.params.id);
    res.json({ success: true, data: recommendations });
  } catch (err) {
    next(err);
  }
});`,
    monitoringMetrics: [
      "Circuit Breaker state transitions (CLOSED -> OPEN alerts) [Severity: Critical]",
      "Downstream call timeout frequencies [Severity: High]",
      "Fallback invocation percentage [Severity: Medium]",
      "Half-Open probe recovery success rates [Severity: Medium]"
    ],
    productionChecklist: [
      "Wrap all external HTTP, gRPC, and third-party API calls in Circuit Breakers (Opossum).",
      "Always enforce strict request timeouts using `AbortSignal.timeout(ms)`.",
      "Provide meaningful fallback responses (cached data, default recommendations) when circuits trip.",
      "Configure Prometheus/Datadog alerts on `breaker.on('open')` events.",
      "Implement exponential backoff with full jitter on retry attempts to prevent thundering herds."
    ]
  },

  {
    id: "exp-prod-13",
    topic: "Multi-Tenant Data Isolation: Schema vs Discriminator Strategies",
    category: "Architecture & Multi-Tenancy",
    severity: "Critical / Cross-Tenant Data Leakage & Compliance Breach",
    theProblem: "In B2B multi-tenant SaaS, tenant data leakage is a company-ending security vulnerability (e.g. Tenant A viewing Tenant B's invoices or proprietary customer records). Implementing multi-tenancy without rigorous architectural boundaries leads to developer oversights where a missing `WHERE tenant_id = ?` clause accidentally exposes all tenants' data.",
    howItWorksInternally: "Two primary database isolation models exist: 1. Discriminator Column (Shared Table): All tenants share the same database tables. Queries must strictly append `WHERE tenant_id = ?`. Risk: developer forgot WHERE clause. Mitigation: PostgreSQL Row-Level Security (RLS) enforces tenant filtering automatically at the database engine level via `SET LOCAL app.current_tenant_id = ?`. 2. Schema-per-Tenant: Each tenant has a dedicated PostgreSQL schema (`tenant_acme`). Queries set `SET search_path TO \"tenant_acme\"`. Isolation is physically separated in database catalogs, making cross-tenant data leaks impossible.",
    productionCode: `const express = require('express');
const { AsyncLocalStorage } = require('async_hooks');

const tenantContext = new AsyncLocalStorage();
const app = express();

// 1. Multi-Tenant Identification Middleware
app.use(async (req, res, next) => {
  const host = req.get('host') || '';
  const subdomain = host.split('.')[0];
  const tenantSlug = req.get('X-Tenant-ID') || subdomain;

  if (!tenantSlug || ['www', 'api', 'app'].includes(tenantSlug)) {
    return res.status(400).json({ error: 'Tenant identifier required' });
  }

  const tenant = await tenantCache.get(tenantSlug);
  if (!tenant || !tenant.isActive) {
    return res.status(404).json({ error: 'Tenant not found or inactive' });
  }

  // Cross-tenant access validation: user must belong to this tenant
  if (req.user && !req.user.tenantIds.includes(tenant.id)) {
    return res.status(403).json({ error: 'Access to this tenant denied' });
  }

  // Bind tenant context using AsyncLocalStorage
  tenantContext.run({ id: tenant.id, schema: tenant.schemaName }, () => {
    next();
  });
});

// 2. Safe Schema-Scoped Database Query Helper
async function withTenantDb(pool, callback) {
  const store = tenantContext.getStore();
  if (!store) throw new Error('No active tenant context');

  const client = await pool.connect();
  try {
    // Physical isolation: scope query to tenant's private schema
    await client.query(\`SET search_path TO "\${store.schema}", public\`);
    return await callback(client);
  } finally {
    // CRITICAL: Reset search_path to prevent connection poisoning!
    await client.query('RESET search_path');
    client.release();
  }
}

app.get('/api/invoices', async (req, res, next) => {
  try {
    const invoices = await withTenantDb(req.app.locals.pool, async (client) => {
      const { rows } = await client.query('SELECT * FROM invoices LIMIT 50');
      return rows;
    });
    res.json(invoices);
  } catch (err) {
    next(err);
  }
});`,
    monitoringMetrics: [
      "Cross-tenant access rejection counts (HTTP 403) [Severity: High]",
      "Database schema search_path execution errors [Severity: High]",
      "PostgreSQL RLS violation attempt counts [Severity: Critical]",
      "Tenant database migration latency per schema [Severity: Medium]"
    ],
    productionChecklist: [
      "Verify tenant identification matches authenticated user memberships on every request.",
      "Use `AsyncLocalStorage` to propagate tenant context across services without parameter drilling.",
      "Always execute `RESET search_path` before returning pooled database connections to prevent poisoning.",
      "When using shared tables with discriminator columns, enforce PostgreSQL Row-Level Security (RLS).",
      "Automate tenant schema migrations using robust migration engines to keep schemas in sync."
    ]
  },

  {
    id: "exp-prod-14",
    topic: "Complete Express 4 to Express 5 Migration Checklist & Runtime Breaking Changes",
    category: "Modernization & Upgrades",
    severity: "High / Startup Crashes & Deprecated Method Failures",
    theProblem: "Upgrading legacy enterprise codebases from Express 4 to Express 5 frequently triggers fatal crashes on server bootstrap or unhandled runtime exceptions. Deprecated methods that worked loosely in Express 4 (`res.send(404)`, `app.del()`, unescaped wildcard route paths `*`) now throw fatal errors in Express 5.",
    howItWorksInternally: "Express 5 modernizes the engine by: 1. Upgrading `path-to-regexp` from v0.1.7 to v8.x (strict regular expressions, named parameter wildcards `/{*splat}`). 2. Introducing native Promise rejection catching in the routing Layer stack, eliminating the need for `express-async-errors`. 3. Removing ambiguous numeric status methods (`res.send(200)` and `res.json(500, obj)`). 4. Setting the default query parser to `'extended'` (`qs`). 5. Bumping minimum engine requirement to Node.js 18+.",
    productionCode: `// EXPRESS 4 VS EXPRESS 5 MIGRATION CODE MATRIX:

// 1. ROUTE WILDCARDS:
// Express 4 (CRASHES in Express 5 with TypeError: Unexpected *):
// app.get('*', (req, res) => ...);
// Express 5 Compliant:
app.all('/{*splat}', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 2. NATIVE ASYNC HANDLERS (Delete express-async-errors!):
// Express 4 required asyncHandler wrappers or monkey-patching.
// Express 5: Native async/await execution!
app.get('/api/users/:id', async (req, res) => {
  // Rejected promises or thrown errors automatically route to error middleware!
  const user = await userRepo.findById(req.params.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json(user);
});

// 3. REMOVED METHODS AUDIT:
// Express 4: res.send(404, 'Not found'); // Deprecated signature
// Express 5: Explicit chaining or sendStatus
res.status(404).send('Not found');
res.sendStatus(204); // Sends 204 No Content

// 4. VERB ALIASES:
// Express 4: app.del('/user', handler);
// Express 5: app.delete('/user', handler);
app.delete('/user', (req, res) => res.sendStatus(204));`,
    monitoringMetrics: [
      "Server startup crash count post-upgrade [Severity: Critical]",
      "Route matching regex compilation errors [Severity: High]",
      "Unhandled promise rejection warnings in Node logs [Severity: High]",
      "Query parsing discrepancies with bracketed query strings [Severity: Medium]"
    ],
    productionChecklist: [
      "Audit and replace all wildcard `*` route patterns with named wildcards `/{*splat}`.",
      "Remove `express-async-errors` and custom `asyncHandler` wrappers to leverage native handling.",
      "Replace all occurrences of `res.send(status, body)` with `res.status(code).send(body)`.",
      "Replace `app.del()` with `app.delete()` across all route definitions.",
      "Verify Node.js runtime version is >= 18.0.0 before deploying Express 5 to production."
    ]
  }
];

// Validate production topics
const requiredFields = [
  "id",
  "topic",
  "category",
  "severity",
  "theProblem",
  "howItWorksInternally",
  "productionCode",
  "monitoringMetrics",
  "productionChecklist"
];

for (const t of productionTopics) {
  for (const field of requiredFields) {
    if (t[field] === undefined || t[field] === null || t[field] === "") {
      console.error(`Production topic ${t.id} missing field: ${field}`);
    }
  }
}

const outputPath = path.join(__dirname, "../data/express.production.json");
fs.writeFileSync(outputPath, JSON.stringify(productionTopics, null, 2), "utf-8");

console.log(`Successfully generated Express Production Mastery:`);
console.log(`- ${productionTopics.length} Topics -> ${outputPath}`);
