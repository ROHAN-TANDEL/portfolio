const { createCard } = require("../exp_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 97,
    category: "Database Integration & ORM Patterns",
    concept: "Database Connection Pool Lifecycle and Avoiding Connection Exhaustion",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does connection pooling work in Express applications, and how do you prevent connection pool exhaustion?",
    quickAnswer: "A connection pool maintains a set of reusable, pre-warmed TCP connections to the database. Creating a new TCP connection on every HTTP request is slow and exhausts database resources. Pool exhaustion occurs when queries hold connections too long, connections fail to release in error paths, or the pool size is misconfigured.",
    detailedAnswer: "Connection Pool Sizing & Mechanics:\n- Sizing Formula: Pool size should be based on available database hardware (e.g. `(cores * 2) + effective_spindle_count`), typically 10-30 connections per Express worker.\n- Checkout & Release: `pool.query()` automatically checks out a client from the pool, executes the query, and releases it back immediately.\n- Dedicated Checkout: When doing manual transactions (`pool.connect()`), the client MUST be released in a `finally` block, otherwise the pool leaks and exhausts within minutes.",
    code: `const { Pool } = require('pg');

// Initialize singleton pool once during application startup
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20, // Maximum active connections in the pool
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 5000 // Error if client checkout takes > 5s
});

// SAFE: pool.query automatically checks out and releases connection back to pool
app.get('/api/users', async (req, res, next) => {
  try {
    const { rows } = await pool.query('SELECT id, name FROM users LIMIT 50');
    res.json(rows);
  } catch (err) {
    next(err);
  }
});`,
    recallHint: "Use a singleton connection pool; pool.query automatically checks out and returns connections, avoiding expensive TCP reconnects.",
    interviewTip: "Never create a `new Pool()` inside route handlers or middlewares. A pool is an application-level singleton created once at startup.",
    tags: ["connection-pooling", "postgres", "pg-pool", "database-lifecycle", "performance"]
  }),

  createCard({
    idNum: 98,
    category: "Database Integration & ORM Patterns",
    concept: "Controller-Service-Repository Pattern in Express",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Controller-Service-Repository pattern, and why is it essential for enterprise Express applications?",
    quickAnswer: "It is a layered architectural pattern that separates concerns into three distinct layers: 1. Controller: Handles HTTP concerns (`req`, `res`, status codes). 2. Service: Pure business logic, orchestration, and domain rules (HTTP-agnostic). 3. Repository: Pure data access and SQL/ORM queries. This separation ensures testability, reusability, and maintainability.",
    detailedAnswer: "Layer Responsibilities:\n- Controller: Never contains SQL or business formulas. Parses request, calls service, returns HTTP response.\n- Service: Never touches `req` or `res`. Unit-testable in pure isolation without mocking Express HTTP objects.\n- Repository: Encapsulates database tables and SQL queries. Can be swapped from PostgreSQL to MongoDB without modifying business services.",
    code: `// 1. REPOSITORY (Pure Data Access)
class UserRepository {
  async findById(id) {
    const { rows } = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0] || null;
  }
}

// 2. SERVICE (Pure Business Logic)
class UserService {
  constructor(userRepo) {
    this.userRepo = userRepo;
  }

  async getUserSummary(userId) {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new NotFoundError('User not found');
    return { id: user.id, displayName: \`\${user.first_name} \${user.last_name}\` };
  }
}

// 3. CONTROLLER (HTTP Orchestration)
class UserController {
  constructor(userService) {
    this.userService = userService;
  }

  getUser = async (req, res, next) => {
    try {
      const summary = await this.userService.getUserSummary(req.params.id);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  };
}`,
    recallHint: "Controller = HTTP req/res; Service = pure business logic; Repository = SQL/ORM queries. Zero layer leakage.",
    interviewTip: "Emphasize that keeping services free of Express `req` and `res` makes them 100% unit-testable and allows them to be invoked from background CLI jobs or WebSocket handlers without modification.",
    tags: ["controller-service-repository", "clean-architecture", "separation-of-concerns", "layering"]
  }),

  createCard({
    idNum: 99,
    category: "Database Integration & ORM Patterns",
    concept: "Transaction Boundaries (ACID) Across Multiple Repository Operations",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you manage database transaction boundaries across multiple repository calls in Express?",
    quickAnswer: "A transaction checkout reserves a dedicated database client, executes `BEGIN`, runs multiple repository queries on that same client, and calls `COMMIT` on success or `ROLLBACK` on error. Using a transaction runner helper with `try/catch/finally` guarantees that connections are released back to the pool even if queries fail.",
    detailedAnswer: "Why Transactions?\nIf deducting account balance succeeds but creating the ledger entry fails, the database is in an inconsistent state. ACID transactions guarantee atomicity: either all operations succeed, or none do.\n\nConnection Scoping:\nAll repository queries participating in a transaction must execute on the exact same checked-out client connection.",
    code: `async function withTransaction(pool, callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // Crucial: release back to pool in finally!
  }
}

// Service orchestrating transfer across multiple repositories
app.post('/api/transfers', async (req, res, next) => {
  try {
    const { fromId, toId, amount } = req.body;

    const transactionResult = await withTransaction(pool, async (client) => {
      // Both operations share the same dedicated transaction client
      await accountRepo.debit(client, fromId, amount);
      await accountRepo.credit(client, toId, amount);
      const auditLog = await auditRepo.record(client, { fromId, toId, amount });
      return auditLog;
    });

    res.json({ success: true, transfer: transactionResult });
  } catch (err) {
    next(err);
  }
});`,
    recallHint: "withTransaction helper wraps BEGIN/COMMIT/ROLLBACK on a checked-out client, releasing it back to the pool in finally.",
    interviewTip: "Never forget the `finally { client.release(); }` block. If an error is thrown before release, the connection remains checked out indefinitely, causing a pool leak.",
    tags: ["transactions", "acid", "postgres-transactions", "rollback", "withTransaction"]
  }),

  createCard({
    idNum: 100,
    category: "Database Integration & ORM Patterns",
    concept: "Preventing Connection Leaks in Express Request Lifecycles",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do database connection leaks happen in Express, and how do you diagnose and prevent them?",
    quickAnswer: "Connection leaks happen when checked-out database clients (`pool.connect()`) are not returned to the pool via `client.release()` due to unhandled exceptions, forgotten returns, or missing `finally` blocks. Over time, the pool runs out of available clients, causing all subsequent incoming requests to freeze and time out.",
    detailedAnswer: "Common Causes of Leaks:\n1. Error thrown before `client.release()` without a `try...finally` wrapper.\n2. Returning early from a conditional branch without calling release.\n3. Request timeout or aborted client connection before query completes.\n\nDiagnosis:\nMonitor pool metrics: `pool.totalCount`, `pool.idleCount`, `pool.waitingCount`. If `waitingCount > 0` and `idleCount === 0` continuously, the pool has leaked.",
    code: `// LEAKY ANTI-PATTERN:
async function leakyEndpoint(req, res) {
  const client = await pool.connect();
  const data = await client.query('SELECT * FROM data');
  if (data.rows.length === 0) {
    return res.status(404).send('Not found'); // BUG! client never released!
  }
  client.release();
  res.json(data.rows);
}

// SAFE PATTERN: Always release in finally block
async function safeEndpoint(req, res, next) {
  const client = await pool.connect();
  try {
    const data = await client.query('SELECT * FROM data');
    if (data.rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.json(data.rows);
  } catch (err) {
    next(err);
  } finally {
    client.release(); // GUARANTEED to execute on return or error!
  }
}`,
    recallHint: "Always call client.release() in a finally block; monitor pool.waitingCount to detect leaking connections early.",
    interviewTip: "Explain how to set `connectionTimeoutMillis: 5000` on pg pool: if a leak occurs, queries fail fast with a timeout rather than hanging indefinitely until the HTTP socket aborts.",
    tags: ["connection-leaks", "resource-exhaustion", "finally-block", "pg-pool", "monitoring"]
  }),

  createCard({
    idNum: 101,
    category: "Database Integration & ORM Patterns",
    concept: "Prisma ORM Integration with Express",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How should Prisma Client be instantiated and integrated into an Express application for optimal performance?",
    quickAnswer: "Instantiate `PrismaClient` as a process-wide singleton in a shared database module. In development, attach it to globalThis to prevent hot-reloading from creating hundreds of database connections. Use Prisma extensions or middleware for query logging and soft deletes, and disconnect cleanly on server shutdown.",
    detailedAnswer: "Prisma Architecture in Express:\n- Prisma runs an underlying query engine in a child process or native binary.\n- Creating `new PrismaClient()` on every request spawns multiple database connection pools, quickly exceeding database connection limits.\n- Singleton pattern guarantees a single centralized pool across all route handlers.",
    code: `// db/prisma.js (Singleton module)
const { PrismaClient } = require('@prisma/client');

const globalForPrisma = global;

const prisma = globalForPrisma.prisma || new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error']
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

module.exports = prisma;

// routes/userRoute.js
const express = require('express');
const router = express.Router();
const prisma = require('../db/prisma');

router.get('/api/users', async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { active: true },
      select: { id: true, email: true, name: true }
    });
    res.json(users);
  } catch (err) {
    next(err);
  }
});`,
    recallHint: "Instantiate PrismaClient as a singleton on globalThis in dev; never instantiate new PrismaClient() per request.",
    interviewTip: "Mention that Prisma Client automatically manages internal connection pooling, so you configure pool limits via the database URL query string (`?connection_limit=20`).",
    tags: ["prisma", "orm", "singleton", "database-connection", "type-safety"]
  }),

  createCard({
    idNum: 102,
    category: "Database Integration & ORM Patterns",
    concept: "TypeORM / MikroORM Entity Lifecycles and Scoped Request Contexts",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Identity Map ORMs (like MikroORM or TypeORM) manage per-request EntityManager contexts in Express?",
    quickAnswer: "Identity Map ORMs track managed entities in an `EntityManager` (fork). To prevent entity cross-contamination and race conditions between concurrent HTTP requests, Express middleware forks a scoped `EntityManager` for each incoming request using `AsyncLocalStorage` or `res.locals`, isolating per-request entity states.",
    detailedAnswer: "Why Scoped EntityManagers?\nIf Request A loads User #1 and mutates its email in memory, and Request B concurrently queries User #1 from the shared root EntityManager, Request B sees dirty, uncommitted changes.\n\nMikroORM RequestContext:\nMikroORM uses `RequestContext.create(orm.em, next)` middleware backed by Node's `AsyncLocalStorage` so all repositories called within that request automatically share the same isolated fork.",
    code: `const { MikroORM, RequestContext } = require('@mikro-orm/core');

async function bootstrap() {
  const orm = await MikroORM.init(mikroOrmConfig);

  // Scoped EntityManager middleware per HTTP request
  app.use((req, res, next) => {
    RequestContext.create(orm.em, next);
  });

  app.get('/api/posts/:id', async (req, res, next) => {
    try {
      // Automatically resolves the request-scoped EntityManager fork
      const postRepo = orm.em.getRepository(Post);
      const post = await postRepo.findOne(req.params.id);
      res.json(post);
    } catch (err) {
      next(err);
    }
  });
}`,
    recallHint: "Use RequestContext middleware (AsyncLocalStorage) to fork a clean EntityManager per request, preventing dirty state leaks.",
    interviewTip: "Explain the Identity Map pattern: within a single request fork, querying the same entity ID twice returns the exact same object reference from identity map memory rather than issuing two SQL queries.",
    tags: ["mikro-orm", "typeorm", "entity-manager", "identity-map", "request-context"]
  }),

  createCard({
    idNum: 103,
    category: "Database Integration & ORM Patterns",
    concept: "Drizzle ORM Modern Lightweight Type-Safe SQL in Express",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why is Drizzle ORM gaining popularity in Express applications, and how does it compare to heavyweight ORMs?",
    quickAnswer: "Drizzle ORM is a lightweight, zero-dependency, type-safe SQL query builder and ORM with zero runtime overhead. Unlike Prisma (which uses a separate binary process) or TypeORM (which relies on reflection decorators), Drizzle outputs pure SQL, has instant cold starts (ideal for serverless), and infers TypeScript types directly from schema definitions.",
    detailedAnswer: "Key Advantages of Drizzle in Express:\n1. Zero Binary Overhead: Uses Node's standard `pg` driver directly.\n2. SQL-Like Syntax: Queries read like pure SQL (`db.select().from(users).where(eq(users.id, 1))`).\n3. Relational Queries: Supports nested relational querying without heavy identity map overhead.\n4. Blazing Cold Starts: No schema generation step or query engine child process.",
    code: `const { drizzle } = require('drizzle-orm/node-postgres');
const { pgTable, serial, text, boolean } = require('drizzle-orm/pg-core');
const { eq } = require('drizzle-orm');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

// Schema definition
const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  active: boolean('active').default(true)
});

// Express route using Drizzle
app.get('/api/users/:id', async (req, res, next) => {
  try {
    const result = await db.select().from(users).where(eq(users.id, Number(req.params.id)));
    if (result.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result[0]);
  } catch (err) {
    next(err);
  }
});`,
    recallHint: "Drizzle is a zero-overhead, type-safe SQL builder using standard pg drivers; zero binary overhead and instant cold starts.",
    interviewTip: "Highlight that Drizzle gives you 'if you know SQL, you know Drizzle' predictability with full compile-time TypeScript type checking.",
    tags: ["drizzle-orm", "type-safe-sql", "lightweight-orm", "node-postgres", "performance"]
  }),

  createCard({
    idNum: 104,
    category: "Database Integration & ORM Patterns",
    concept: "Mongoose ODM Connection Management and Schema Hooks",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do Mongoose connection pooling and pre/post middleware hooks work inside Express applications?",
    quickAnswer: "Mongoose connects to MongoDB using an internal connection pool configured via `mongoose.connect()`. Schema pre/post hooks allow intercepting lifecycle events (e.g. `pre('save')` for password hashing, `pre('find')` for tenant filtering) transparently before database queries execute.",
    detailedAnswer: "Mongoose Integration Best Practices:\n1. Connection Buffering: Mongoose buffers model queries before the initial connection succeeds, but production apps should await `mongoose.connect()` before calling `app.listen()`.\n2. Connection Event Monitoring: Attach listeners to `mongoose.connection.on('error')` and `'disconnected'`.\n3. Schema Hooks: Use standard functions rather than arrow functions for `pre('save', function (next) { ... })` so `this` refers to the document instance.",
    code: `const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

// Pre-save hook: Hash password before persisting
userSchema.pre('save', async function (next) {
  // Only hash if password field was modified
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

const User = mongoose.model('User', userSchema);

// Connect once during startup
async function startServer() {
  await mongoose.connect(process.env.MONGO_URI, { maxPoolSize: 25 });
  console.log('MongoDB connected');
  app.listen(3000);
}`,
    recallHint: "Await mongoose.connect before app.listen(); use pre('save') hooks for hashing with standard functions to preserve this.",
    interviewTip: "Warn against arrow functions in Mongoose hooks: arrow functions bind lexical `this` from the surrounding scope, breaking access to the active document `this`.",
    tags: ["mongoose", "mongodb", "schema-hooks", "pre-save", "connection-management"]
  }),

  createCard({
    idNum: 105,
    category: "Database Integration & ORM Patterns",
    concept: "Read Replicas vs Write Master Routing in Express Services",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you architecture database read/write splitting in Express to offload read traffic onto read replicas?",
    quickAnswer: "Maintain two connection pools: a Primary/Master pool (read-write) and a Replica pool (read-only) distributed behind a read-replica load balancer. Repositories or service methods route queries based on intent: `GET` endpoints use the replica pool, while mutating operations (`POST`, `PUT`, `DELETE`, and active transactions) target the primary pool.",
    detailedAnswer: "Read/Write Splitting Architecture:\n- 80-90% of web traffic is read-only (`SELECT`). Offloading reads to 3-5 read replicas scales horizontal throughput without overwhelming the master database.\n- Replication Lag Gotcha (Read-Your-Own-Writes):\n  If a user updates their profile and immediately redirects to the profile page, replication lag (typically 10-100ms) may cause the read replica to return stale data.\n  Solution: Pin subsequent reads to the Master pool for 2-5 seconds following a write for that user.",
    code: `const { Pool } = require('pg');

const masterPool = new Pool({ connectionString: process.env.DB_MASTER_URL });
const replicaPool = new Pool({ connectionString: process.env.DB_REPLICA_URL });

class ProductRepository {
  // Read queries route to read replica
  async findById(id) {
    const { rows } = await replicaPool.query('SELECT * FROM products WHERE id = $1', [id]);
    return rows[0];
  }

  // Write queries route to primary master
  async create(data) {
    const { rows } = await masterPool.query(
      'INSERT INTO products (name, price) VALUES ($1, $2) RETURNING *',
      [data.name, data.price]
    );
    return rows[0];
  }
}`,
    recallHint: "Master pool handles writes and transactions; replica pool handles high-volume SELECT reads; beware replication lag.",
    interviewTip: "Mention the 'Read-Your-Own-Writes' consistency challenge: explain how session-based replication lag pinning routes reads to master immediately after a write.",
    tags: ["read-replicas", "master-slave", "cqrs", "database-scaling", "replication-lag"]
  }),

  createCard({
    idNum: 106,
    category: "Database Integration & ORM Patterns",
    concept: "Redis Caching Pattern (Cache-Aside, Write-Through, Invalidation)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you implement the Cache-Aside pattern with Redis in Express, and how do you handle cache invalidation?",
    quickAnswer: "In the Cache-Aside pattern, the service checks Redis for a cached key. On a cache hit, it returns data immediately without querying the database. On a cache miss, it fetches data from the database, stores it in Redis with an explicit TTL (Time-To-Live), and returns the response. On updates/deletes, the cached key is invalidated immediately via `redis.del()`.",
    detailedAnswer: "Cache-Aside Lifecycle:\n1. Read: `const cached = await redis.get(key)`.\n2. If found, `return JSON.parse(cached)`.\n3. If missing, query SQL database.\n4. Write to Redis with expiration: `await redis.set(key, JSON.stringify(data), { EX: 300 })` (5 min TTL).\n5. Invalidation: On `UPDATE` or `DELETE`, delete the cache key: `await redis.del(key)`.\n\nCache Stampede Defense:\nUse mutex locking or jittered TTLs to prevent 10,000 concurrent requests from hitting the database simultaneously when a hot key expires.",
    code: `const { createClient } = require('redis');
const redis = createClient({ url: process.env.REDIS_URL });
redis.connect().catch(console.error);

async function getProductById(id) {
  const cacheKey = \`product:\${id}\`;

  // 1. Check Redis Cache
  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    return JSON.parse(cachedData); // Cache HIT
  }

  // 2. Cache MISS: Query Database
  const product = await productRepo.findById(id);
  if (!product) return null;

  // 3. Populate Redis with 10-minute TTL
  await redis.set(cacheKey, JSON.stringify(product), { EX: 600 });
  return product;
}

async function updateProduct(id, updateData) {
  // Update DB first
  const updated = await productRepo.update(id, updateData);

  // Invalidate Redis cache immediately
  await redis.del(\`product:\${id}\`);
  return updated;
}`,
    recallHint: "Cache-Aside: Read from Redis -> on miss query DB & set with TTL -> delete key on update or delete.",
    interviewTip: "Always set an explicit TTL on Redis cache entries. Storing cached objects without expiration causes stale data issues and Redis memory exhaustion.",
    tags: ["redis", "cache-aside", "cache-invalidation", "ttl", "performance"]
  }),

  createCard({
    idNum: 107,
    category: "Database Integration & ORM Patterns",
    concept: "Database Health Check Endpoints (/healthz, /live, /ready)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you implement Kubernetes-compliant liveness and readiness health checks with database verification in Express?",
    quickAnswer: "Liveness (`/livez`) checks if the Express process is running and event loop is responsive (returns 200). Readiness (`/readyz`) verifies external dependencies: it executes a lightweight query (`SELECT 1` on PostgreSQL or `ping()` on Redis). If dependencies fail, it returns HTTP 503, signaling load balancers and Kubernetes to stop routing traffic to this pod.",
    detailedAnswer: "Liveness vs Readiness:\n- `/livez` (Liveness): If this fails (e.g. infinite loop, process deadlock), Kubernetes restarts the container.\n  NEVER ping the database in `/livez`! If the database has a momentary hiccup, Kubernetes will restart all 50 app pods at once, causing a catastrophic cascading outage.\n- `/readyz` (Readiness): Checks if the pod can actively accept user traffic. If DB or Redis is down, pod returns 503 and is removed from the load balancer pool without being restarted.",
    code: `// Liveness: Process is alive and event loop is running
app.get('/healthz/live', (req, res) => {
  res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Readiness: External dependencies (Database, Redis) are healthy
app.get('/healthz/ready', async (req, res) => {
  try {
    // 1. Verify PostgreSQL pool can execute a query
    await pool.query('SELECT 1');

    // 2. Verify Redis responsiveness
    const redisPing = await redisClient.ping();
    if (redisPing !== 'PONG') throw new Error('Redis ping failed');

    res.status(200).json({ status: 'ready', database: 'connected', redis: 'connected' });
  } catch (err) {
    // 503 Service Unavailable: Pod stops receiving traffic until DB recovers
    res.status(503).json({
      status: 'unready',
      error: err.message
    });
  }
});`,
    recallHint: "Liveness (/livez) checks if process is alive; Readiness (/readyz) verifies DB with SELECT 1. Never check DB in liveness!",
    interviewTip: "This is a critical DevOps and systems design interview point: explaining why you never check database connectivity in a Kubernetes liveness probe demonstrates true production experience.",
    tags: ["health-check", "liveness", "readiness", "kubernetes", "devops"]
  }),

  createCard({
    idNum: 108,
    category: "Database Integration & ORM Patterns",
    concept: "Graceful Database Disconnection on Express Worker Shutdown",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you gracefully close database pools and ODM connections when an Express server is terminated?",
    quickAnswer: "When closing an Express HTTP server, hook into the server shutdown callback to invoke `pool.end()` (pg), `prisma.$disconnect()`, or `mongoose.connection.close()`. This allows in-flight database transactions to commit cleanly, closes open TCP sockets gracefully, and prevents leaving orphaned idle connections on the database server.",
    detailedAnswer: "Orphaned Connections Problem:\nAbruptly killing Node workers with `process.exit()` leaves TCP connections in `CLOSE_WAIT` on the database server. After several container restarts, the database reaches `max_connections` (e.g. 100), rejecting new application instances.\n\nTeardown Sequence:\n1. Stop accepting new HTTP requests: `server.close()`.\n2. Wait for in-flight requests to complete.\n3. Close all database connection pools cleanly (`await pool.end()`).\n4. Disconnect Redis and message queues.\n5. Exit process.",
    code: `const server = app.listen(3000);

async function gracefulTeardown() {
  console.log('Initiating database connection teardown...');

  server.close(async () => {
    try {
      // Close pg connection pool
      await pool.end();
      console.log('PostgreSQL pool closed successfully.');

      // Disconnect Prisma (if used)
      // await prisma.$disconnect();

      // Disconnect Mongoose (if used)
      // await mongoose.connection.close(false);

      process.exit(0);
    } catch (err) {
      console.error('Error during database pool termination:', err);
      process.exit(1);
    }
  });
}

process.on('SIGTERM', gracefulTeardown);
process.on('SIGINT', gracefulTeardown);`,
    recallHint: "Call pool.end() or mongoose.connection.close() inside server.close callback to prevent orphaned TCP connections.",
    interviewTip: "Explain that database connection limits are shared across all microservices; cleanly terminating pools prevents exhausted DB limits during blue-green deployments.",
    tags: ["graceful-shutdown", "pool.end", "orphaned-connections", "teardown", "sigterm"]
  })
];

module.exports = cards;
