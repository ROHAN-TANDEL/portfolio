module.exports = [
  {
    id: "exp-ex-43",
    title: "Controller-Service-Repository Architecture with PostgreSQL Pool",
    category: "Architecture & Database",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates the complete Controller-Service-Repository separation of concerns, decoupling HTTP routing from business logic and database queries.",
    conceptsCovered: [
      "Controller-Service-Repository",
      "Separation of Concerns",
      "Repository Pattern",
      "pg.Pool Singleton",
      "Unit Testability"
    ],
    code: `const express = require('express');

// 1. REPOSITORY LAYER (Pure Data Access)
class UserRepository {
  constructor(pool) {
    this.pool = pool;
  }
  async findById(id) {
    const { rows } = await this.pool.query('SELECT id, name, email FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  }
}

// 2. SERVICE LAYER (Pure Domain Logic - zero HTTP awareness)
class UserService {
  constructor(userRepo) {
    this.userRepo = userRepo;
  }
  async getUser(id) {
    const user = await this.userRepo.findById(id);
    if (!user) {
      const err = new Error('User not found');
      err.statusCode = 404;
      throw err;
    }
    return user;
  }
}

// 3. CONTROLLER LAYER (Express HTTP Transport)
class UserController {
  constructor(userService) {
    this.userService = userService;
  }
  getUserById = async (req, res, next) => {
    try {
      const user = await this.userService.getUser(req.params.id);
      res.json(user);
    } catch (err) {
      next(err);
    }
  };
}

// Composition Root
function buildUserApp(pool) {
  const app = express();
  const repo = new UserRepository(pool);
  const service = new UserService(repo);
  const controller = new UserController(service);

  app.get('/api/users/:id', controller.getUserById);
  return app;
}

module.exports = { buildUserApp, UserRepository, UserService, UserController };`,
    breakdown: [
      {
        lineRange: "4-12",
        note: "Repository encapsulates SQL query execution and maps database rows to plain objects."
      },
      {
        lineRange: "15-28",
        note: "Service encapsulates domain logic and can be tested 100% in isolation without mocking req/res."
      },
      {
        lineRange: "31-43",
        note: "Controller delegates to service and handles HTTP response dispatch and error piping."
      }
    ],
    expectedOutput: "GET /api/users/1 -> 200 { id: 1, name: 'Alice', email: 'alice@test.com' }"
  },

  {
    id: "exp-ex-44",
    title: "Multi-Operation Database Transaction Runner with Automatic Rollback",
    category: "Database Integration",
    difficulty: "advanced",
    whatThisCodeCovers: "Constructs a robust withTransaction helper that executes multiple repository queries within a single ACID transaction, releasing connections in finally.",
    conceptsCovered: [
      "ACID Transactions",
      "BEGIN / COMMIT / ROLLBACK",
      "Connection Pool Checkout",
      "finally Release Block",
      "Atomicity"
    ],
    code: `const express = require('express');
const app = express();
app.use(express.json());

// Reusable Transaction Runner Helper
async function withTransaction(pool, operation) {
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
    // CRUCIAL: Release client back to pool unconditionally!
    client.release();
  }
}

// Bank transfer endpoint demonstrating atomic operations
app.post('/api/transfers', async (req, res, next) => {
  const { fromAccountId, toAccountId, amount } = req.body;

  try {
    const transferRecord = await withTransaction(req.app.locals.dbPool, async (client) => {
      // Step 1: Debit sender
      await client.query(
        'UPDATE accounts SET balance = balance - $1 WHERE id = $2 AND balance >= $1',
        [amount, fromAccountId]
      );

      // Step 2: Credit recipient
      await client.query(
        'UPDATE accounts SET balance = balance + $1 WHERE id = $2',
        [amount, toAccountId]
      );

      // Step 3: Record ledger entry
      const { rows } = await client.query(
        'INSERT INTO ledger (from_id, to_id, amount) VALUES ($1, $2, $3) RETURNING id',
        [fromAccountId, toAccountId, amount]
      );

      return rows[0];
    });

    res.status(201).json({ success: true, transfer: transferRecord });
  } catch (err) {
    next(err);
  }
});

module.exports = { app, withTransaction };`,
    breakdown: [
      {
        lineRange: "6-20",
        note: "withTransaction wraps operation in BEGIN, COMMIT, ROLLBACK and guarantees client.release() in finally."
      },
      {
        lineRange: "26-47",
        note: "All 3 SQL mutations execute on the same client; failure in step 2 or 3 rolls back step 1 automatically."
      }
    ],
    expectedOutput: "Successful transfer -> 201 { success: true, transfer: { id: 101 } }\nBalance error -> All changes rolled back."
  },

  {
    id: "exp-ex-45",
    title: "Read/Write Split Router (Primary Master vs Read Replica Pool)",
    category: "Database Integration",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements read/write database query splitting in Express, routing GET requests to read-replica pools and mutations to the primary master pool.",
    conceptsCovered: [
      "Read/Write Splitting",
      "Primary Master Pool",
      "Read Replica Pool",
      "CQRS",
      "Horizontal Read Scaling"
    ],
    code: `const express = require('express');
const app = express();

class DatabaseRouter {
  constructor(masterPool, replicaPool) {
    this.master = masterPool;
    this.replica = replicaPool;
  }

  // Returns replica for reads, master for writes or transactions
  getPool(isWrite = false) {
    return isWrite ? this.master : this.replica;
  }
}

// Middleware attaching read/write pool access
function attachDb(dbRouter) {
  return (req, res, next) => {
    const isMutation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    req.db = dbRouter.getPool(isMutation);
    next();
  };
}

// Mock pools
const masterPool = { name: 'Primary-Master', query: async (sql) => ({ pool: 'master' }) };
const replicaPool = { name: 'Read-Replica', query: async (sql) => ({ pool: 'replica' }) };
const dbRouter = new DatabaseRouter(masterPool, replicaPool);

app.use(attachDb(dbRouter));

// GET uses read replica
app.get('/api/products', async (req, res) => {
  const result = await req.db.query('SELECT * FROM products');
  res.json({ servedFrom: req.db.name });
});

// POST uses primary master
app.post('/api/products', async (req, res) => {
  const result = await req.db.query('INSERT INTO products ...');
  res.status(201).json({ savedTo: req.db.name });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "4-13",
        note: "DatabaseRouter encapsulates master and replica pools, selecting pool based on write intent."
      },
      {
        lineRange: "16-22",
        note: "attachDb middleware inspects HTTP verb, binding the read-replica for GET and master for mutations."
      }
    ],
    expectedOutput: "GET /api/products -> { servedFrom: 'Read-Replica' }\nPOST /api/products -> { savedTo: 'Primary-Master' }"
  },

  {
    id: "exp-ex-46",
    title: "Cache-Aside Pattern with Redis Invalidation and TTL Management",
    category: "Caching & Performance",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements the Cache-Aside pattern in Express services: checks Redis on read, falls back to SQL database with TTL on miss, and purges cache on update.",
    conceptsCovered: [
      "Cache-Aside Pattern",
      "Redis GET / SET EX",
      "Cache Invalidation",
      "TTL Expiration",
      "Stampede Mitigation"
    ],
    code: `const express = require('express');
const app = express();
app.use(express.json());

// Mock Redis and Database
const redisCache = new Map();
const sqlDatabase = new Map([
  ['sku_100', { id: 'sku_100', name: 'Wireless Headphones', price: 99.99 }]
]);

class ProductService {
  async getProduct(sku) {
    const cacheKey = \`product:\${sku}\`;

    // 1. Check Redis Cache (Cache HIT)
    const cached = redisCache.get(cacheKey);
    if (cached) {
      console.log('Cache HIT for:', sku);
      return JSON.parse(cached);
    }

    // 2. Query Database (Cache MISS)
    console.log('Cache MISS for:', sku);
    const product = sqlDatabase.get(sku);
    if (!product) return null;

    // 3. Write to Redis with 5-minute TTL
    redisCache.set(cacheKey, JSON.stringify(product));
    return product;
  }

  async updateProduct(sku, updateData) {
    // 1. Update Database
    const existing = sqlDatabase.get(sku);
    if (!existing) return null;
    const updated = { ...existing, ...updateData };
    sqlDatabase.set(sku, updated);

    // 2. Invalidate Redis Cache immediately
    redisCache.delete(\`product:\${sku}\`);
    console.log('Cache INVALIDATED for:', sku);
    return updated;
  }
}

const productService = new ProductService();

app.get('/api/products/:sku', async (req, res) => {
  const product = await productService.getProduct(req.params.sku);
  if (!product) return res.status(404).json({ error: 'Product not found' });
  res.json(product);
});

app.put('/api/products/:sku', async (req, res) => {
  const updated = await productService.updateProduct(req.params.sku, req.body);
  res.json(updated);
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "12-28",
        note: "Reads from Redis; on miss queries SQL database and populates Redis cache with TTL."
      },
      {
        lineRange: "30-40",
        note: "Mutations update SQL database and purge Redis key immediately to eliminate stale reads."
      }
    ],
    expectedOutput: "First GET -> Cache MISS\nSecond GET -> Cache HIT\nPUT -> Cache INVALIDATED"
  },

  {
    id: "exp-ex-47",
    title: "Multi-Tenant Schema Isolation with PostgreSQL SET search_path",
    category: "Multi-Tenancy",
    difficulty: "advanced",
    whatThisCodeCovers: "Enforces schema-per-tenant isolation by dynamically executing SET search_path TO tenant_schema and safely calling RESET search_path before connection release.",
    conceptsCovered: [
      "Multi-Tenancy",
      "PostgreSQL search_path",
      "Dynamic Schema Switching",
      "Connection Poisoning Defense",
      "RESET search_path"
    ],
    code: `const express = require('express');
const app = express();

async function withTenantSchema(pool, tenantSchema, callback) {
  const client = await pool.connect();
  try {
    // Dynamically scope current connection to the tenant's private schema
    await client.query(\`SET search_path TO "\${tenantSchema}", public\`);
    return await callback(client);
  } finally {
    // CRITICAL: Reset search_path before returning connection to pool!
    // Prevents connection poisoning where other tenants reuse the tainted connection!
    await client.query('RESET search_path');
    client.release();
  }
}

// Tenant middleware
app.use((req, res, next) => {
  const tenantId = req.get('X-Tenant-ID');
  if (!tenantId) return res.status(400).json({ error: 'X-Tenant-ID header required' });
  req.tenantSchema = \`tenant_\${tenantId.replace(/[^a-zA-Z0-9_]/g, '')}\`;
  next();
});

app.get('/api/orders', async (req, res, next) => {
  try {
    const orders = await withTenantSchema(req.app.locals.pool, req.tenantSchema, async (client) => {
      // Automatically resolves tables inside req.tenantSchema!
      const { rows } = await client.query('SELECT * FROM orders LIMIT 50');
      return rows;
    });

    res.json({ tenant: req.tenantSchema, orders });
  } catch (err) {
    next(err);
  }
});

module.exports = { app, withTenantSchema };`,
    breakdown: [
      {
        lineRange: "4-16",
        note: "Executes SET search_path on checkout and RESET search_path in finally to prevent connection poisoning."
      },
      {
        lineRange: "18-24",
        note: "Extracts tenant ID and sanitizes schema identifier to prevent SQL injection in schema names."
      }
    ],
    expectedOutput: "GET /api/orders (X-Tenant-ID: acme) -> Queries tenant_acme.orders with physical table isolation."
  },

  {
    id: "exp-ex-48",
    title: "Real-Time Server-Sent Events (SSE) AI / LLM Streaming Endpoint",
    category: "Real-Time & Streaming",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a production Server-Sent Events (SSE) endpoint streaming real-time tokens to clients with proper headers (text/event-stream) and disconnect cleanup.",
    conceptsCovered: [
      "Server-Sent Events (SSE)",
      "text/event-stream",
      "res.write('data: ...')",
      "req.on('close') Teardown",
      "LLM Token Streaming"
    ],
    code: `const express = require('express');
const app = express();

app.get('/api/stream/completion', (req, res) => {
  const { prompt } = req.query;

  // 1. Mandatory SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disables Nginx buffering
  });

  // Send initial handshake
  res.write('data: {"status": "started"}\\n\\n');

  // Simulated LLM token stream
  const tokens = ['The', ' future', ' of', ' Express', ' is', ' modern', ' streaming.'];
  let tokenIdx = 0;

  const intervalId = setInterval(() => {
    if (tokenIdx < tokens.length) {
      const payload = JSON.stringify({ token: tokens[tokenIdx++] });
      res.write(\`data: \${payload}\\n\\n\`);
    } else {
      res.write('data: [DONE]\\n\\n');
      clearInterval(intervalId);
      res.end();
    }
  }, 100);

  // 2. CRUCIAL: Clean up timer when client closes browser or cancels
  req.on('close', () => {
    clearInterval(intervalId);
    console.log('SSE connection closed by client');
  });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "7-13",
        note: "Configures text/event-stream headers and sets X-Accel-Buffering: no to prevent Nginx buffering."
      },
      {
        lineRange: "21-30",
        note: "Streams data in data: <payload>\\n\\n format and emits data: [DONE]\\n\\n at completion."
      },
      {
        lineRange: "32-36",
        note: "req.on('close') clears the interval to prevent timer leaks when clients disconnect."
      }
    ],
    expectedOutput: "GET /api/stream/completion -> Real-time chunked text/event-stream tokens pushed every 100ms."
  },

  {
    id: "exp-ex-49",
    title: "Express API Gateway Reverse Proxy with Header Injection",
    category: "Microservices & Gateway",
    difficulty: "advanced",
    whatThisCodeCovers: "Configures Express as an API Gateway using http-proxy-middleware, stripping sensitive client headers and injecting authenticated user claims downstream.",
    conceptsCovered: [
      "API Gateway",
      "http-proxy-middleware",
      "Reverse Proxying",
      "Header Normalization",
      "Service Meshes"
    ],
    code: `const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

// Gateway Auth Middleware
app.use((req, res, next) => {
  // In real gateway: verify JWT
  req.user = { id: 'usr_42', tenant: 'tenant_omega', roles: ['billing_admin'] };
  next();
});

// Proxy to downstream Billing Microservice
const billingProxy = createProxyMiddleware({
  target: 'http://billing-service.internal:5001',
  changeOrigin: true,
  pathRewrite: { '^/api/billing': '/v1' },
  onProxyReq: (proxyReq, req) => {
    // Inject verified user metadata into private internal network
    if (req.user) {
      proxyReq.setHeader('x-gateway-user-id', req.user.id);
      proxyReq.setHeader('x-gateway-tenant', req.user.tenant);
      proxyReq.setHeader('x-gateway-roles', req.user.roles.join(','));
    }
    // Remove client cookie to prevent leaking external credentials
    proxyReq.removeHeader('cookie');
  },
  onError: (err, req, res) => {
    res.status(502).json({ error: 'Billing microservice unavailable' });
  }
});

app.use('/api/billing', billingProxy);

module.exports = app;`,
    breakdown: [
      {
        lineRange: "14-29",
        note: "createProxyMiddleware forwards streaming requests without buffering request bodies in memory."
      },
      {
        lineRange: "18-24",
        note: "Injects verified user identity headers (x-gateway-user-id) for downstream microservice consumption."
      }
    ],
    expectedOutput: "Incoming /api/billing/invoices -> Proxied to http://billing-service.internal:5001/v1/invoices with x-gateway-* headers."
  },

  {
    id: "exp-ex-50",
    title: "Resilient Circuit Breaker Integration with Opossum",
    category: "Reliability & Resilience",
    difficulty: "advanced",
    whatThisCodeCovers: "Integrates Opossum Circuit Breaker into Express route handlers to prevent cascading failures when third-party microservices fail.",
    conceptsCovered: [
      "Circuit Breaker Pattern",
      "Opossum",
      "Fail-Fast",
      "Fallback Responses",
      "Closed / Open / Half-Open"
    ],
    code: `const express = require('express');
const CircuitBreaker = require('opossum');

const app = express();

// Downstream external API call
async function fetchWeather(city) {
  const res = await fetch(\`https://weather-api.internal/cities/\${city}\`, {
    signal: AbortSignal.timeout(1500) // 1.5s timeout
  });
  if (!res.ok) throw new Error('Weather API service failure');
  return res.json();
}

// Circuit Breaker configuration
const breakerOptions = {
  timeout: 2000, // 2s execution timeout
  errorThresholdPercentage: 50, // Trip open if >50% calls fail
  resetTimeout: 10000 // Test recovery after 10s (Half-Open)
};

const weatherBreaker = new CircuitBreaker(fetchWeather, breakerOptions);

// Define fallback when circuit is OPEN
weatherBreaker.fallback((city) => ({
  city,
  temperature: 20,
  isCachedFallback: true,
  notice: 'Live weather service temporarily degraded'
}));

app.get('/api/weather/:city', async (req, res, next) => {
  try {
    const data = await weatherBreaker.fire(req.params.city);
    res.json({
      data,
      circuitState: weatherBreaker.status.stats
    });
  } catch (err) {
    next(err);
  }
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "16-20",
        note: "Configures errorThresholdPercentage (50%) and resetTimeout (10s) for state transitions."
      },
      {
        lineRange: "24-29",
        note: "Fallback handler executes instantly when the circuit is OPEN without touching the failing API."
      }
    ],
    expectedOutput: "Downstream failure -> Circuit trips OPEN -> Returns instant fallback without waiting for timeouts."
  },

  {
    id: "exp-ex-51",
    title: "Event Loop Lag Monitoring & Automated 503 Load Shedding",
    category: "Reliability & Resilience",
    difficulty: "advanced",
    whatThisCodeCovers: "Monitors single-threaded event loop delay via perf_hooks and sheds load by rejecting requests with 503 Service Unavailable when delay exceeds 100ms.",
    conceptsCovered: [
      "Load Shedding",
      "monitorEventLoopDelay",
      "Event Loop Lag",
      "503 Service Unavailable",
      "Retry-After Header"
    ],
    code: `const express = require('express');
const { monitorEventLoopDelay } = require('perf_hooks');

const app = express();

// Monitor event loop delay with 20ms resolution
const lagMonitor = monitorEventLoopDelay({ resolution: 20 });
lagMonitor.enable();

const MAX_EVENT_LOOP_LAG_MS = 100;

// Load shedding middleware
app.use((req, res, next) => {
  // Always permit health checks to pass through
  if (req.path.startsWith('/healthz')) return next();

  // Convert nanoseconds to milliseconds (p99 percentile delay)
  const p99LagMs = Number(lagMonitor.percentile(99)) / 1e6;

  if (p99LagMs > MAX_EVENT_LOOP_LAG_MS) {
    console.warn(\`[LOAD SHEDDING] Event loop lag \${p99LagMs.toFixed(2)}ms > \${MAX_EVENT_LOOP_LAG_MS}ms. Dropping request.\`);

    res.setHeader('Retry-After', '3'); // Ask client to retry in 3 seconds
    return res.status(503).json({
      error: 'Service Overloaded',
      message: 'Server is currently shedding traffic to recover event loop health.'
    });
  }

  next();
});

app.get('/api/work', (req, res) => res.json({ status: 'ok' }));

module.exports = app;`,
    breakdown: [
      {
        lineRange: "7-8",
        note: "monitorEventLoopDelay samples event loop tick delays in the background with zero CPU overhead."
      },
      {
        lineRange: "18-29",
        note: "Rejects incoming traffic with HTTP 503 and Retry-After: 3 when p99 delay exceeds 100ms."
      }
    ],
    expectedOutput: "Normal load -> 200 { status: 'ok' }\nEvent loop lag > 100ms -> 503 { error: 'Service Overloaded' } with Retry-After: 3"
  },

  {
    id: "exp-ex-52",
    title: "Multi-Core Clustering with Node.js cluster Module and Worker Recovery",
    category: "Performance & Scaling",
    difficulty: "advanced",
    whatThisCodeCovers: "Scales Express across multi-core processors using Node's cluster module, automatically spawning replacement workers when child processes crash.",
    conceptsCovered: [
      "Node.js cluster Module",
      "Multi-Core Scaling",
      "Worker Crash Recovery",
      "cluster.fork()",
      "Primary-Worker Architecture"
    ],
    code: `const cluster = require('cluster');
const os = require('os');
const express = require('express');

if (cluster.isPrimary) {
  const numCPUs = os.cpus().length;
  console.log(\`[Primary \${process.pid}] Forking \${numCPUs} worker processes...\`);

  // Fork a worker per CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  // Auto-restart workers if they crash
  cluster.on('exit', (worker, code, signal) => {
    console.warn(\`[Primary] Worker \${worker.process.pid} died (exit code \${code}). Spawning replacement...\`);
    cluster.fork();
  });
} else {
  // Workers share the TCP connection port 3000
  const app = express();

  app.get('/api/info', (req, res) => {
    res.json({
      handledByWorkerPid: process.pid,
      uptimeSeconds: process.uptime()
    });
  });

  app.listen(3000, () => {
    console.log(\`[Worker \${process.pid}] Listening on port 3000\`);
  });
}`,
    breakdown: [
      {
        lineRange: "5-19",
        note: "Primary process detects CPU count, forks workers, and listens to 'exit' to restart dead workers."
      },
      {
        lineRange: "21-34",
        note: "Workers share port 3000 via OS socket sharing, scaling throughput linearly with CPU cores."
      }
    ],
    expectedOutput: "[Primary 1001] Forking 8 worker processes...\n[Worker 1002] Listening on port 3000\n[Worker 1003] Listening on port 3000"
  }
];
