const fs = require('fs');
const path = require('path');

const productionTopics = [
  // 1. Graceful Shutdown
  {
    id: "prod-node-001",
    topic: "Zero-Downtime Graceful Shutdown & Keep-Alive Socket Draining",
    category: "Reliability & Resilience",
    severity: "Critical / High Availability",
    theProblem: "When a containerized Node.js service receives a SIGTERM from Kubernetes or Docker, abruptly calling process.exit(0) cuts off hundreds of in-flight HTTP requests and breaks ongoing database transactions, causing 502 Bad Gateway errors for clients and corrupted database state.",
    howItWorksInternally: "The operating system sends POSIX signal SIGTERM. Node.js must catch this event, stop accepting NEW incoming connections via server.close(), set 'Connection: close' headers on active responses, wait for active keep-alive sockets to drain within a grace timeout, gracefully close database pools and Redis connections, and finally exit clean.",
    productionCode: `import http from 'node:http';

export function setupGracefulShutdown(server, dbPool, timeoutMs = 15000) {
  let isShuttingDown = false;
  const connections = new Set();

  // Track active client sockets:
  server.on('connection', (socket) => {
    connections.add(socket);
    socket.on('close', () => connections.delete(socket));
  });

  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log(\`Received \${signal}. Starting zero-downtime shutdown...\`);

    // 1. Hard safety timer: Force exit if cleanup hangs
    const forceExitTimer = setTimeout(() => {
      console.error('Graceful shutdown timeout exceeded. Forcing exit.');
      process.exit(1);
    }, timeoutMs);
    forceExitTimer.unref(); // Prevent timer from keeping event loop alive

    try {
      // 2. Stop accepting new connections:
      await new Promise((resolve) => server.close(resolve));
      console.log('HTTP server closed to new connections.');

      // 3. Destroy remaining idle keep-alive sockets:
      for (const socket of connections) {
        socket.destroy();
      }

      // 4. Close database pool connections cleanly:
      if (dbPool && typeof dbPool.end === 'function') {
        await dbPool.end();
        console.log('Database pool connections drained.');
      }

      console.log('Graceful shutdown complete.');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}`,
    monitoringMetrics: [
      "active_http_connections_total",
      "shutdown_duration_seconds",
      "abrupt_termination_counter"
    ],
    productionChecklist: [
      "Always configure timer.unref() on the force exit timer so it does not block natural shutdown.",
      "Track and terminate idle keep-alive sockets; otherwise server.close() will hang indefinitely waiting for clients to disconnect.",
      "Ensure Kubernetes terminationGracePeriodSeconds is configured higher than the Node timeout (e.g., 30s vs 15s).",
      "Drain and close database and message queue connections only AFTER the HTTP server has fully stopped."
    ]
  },

  // 2. Event Loop Lag Load Shedding
  {
    id: "prod-node-002",
    topic: "Event Loop Lag Telemetry & Dynamic 503 Load Shedding",
    category: "Performance & Protection",
    severity: "High / DOS Protection",
    theProblem: "When Node.js is hit by sudden traffic spikes or heavy synchronous processing, the event loop lag spikes into hundreds of milliseconds. Continuing to accept new HTTP connections causes memory pressure, connection queuing, and eventual cascading server crashes.",
    howItWorksInternally: "Using Node's native perf_hooks.monitorEventLoopDelay(), the V8 runtime records high-resolution event loop delay histograms at the C++ layer. If p99 lag exceeds an engineering threshold (e.g., 80ms), a load-shedding middleware rejects new requests immediately with HTTP 503 Service Unavailable and a Retry-After header before the process runs out of memory.",
    productionCode: `import { monitorEventLoopDelay } from 'node:perf_hooks';

// 1. Initialize high-resolution histogram with 10ms resolution
const h = monitorEventLoopDelay({ resolution: 10 });
h.enable();

// 2. Production middleware for dynamic load shedding
export function eventLoopGuardMiddleware(maxLagMs = 75) {
  return (req, res, next) => {
    // Convert nanoseconds to milliseconds:
    const p99LagMs = h.percentile(99) / 1e6;

    if (p99LagMs > maxLagMs) {
      console.warn(\`[LoadShed] Rejecting request: Event loop p99 lag is \${p99LagMs.toFixed(2)}ms\`);
      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Retry-After': 3
      });
      return res.end(JSON.stringify({
        error: 'Service Overloaded',
        message: 'System is experiencing high CPU pressure. Please retry shortly.',
        retryAfterSeconds: 3
      }));
    }

    next();
  };
}`,
    monitoringMetrics: [
      "nodejs_eventloop_lag_p50_milliseconds",
      "nodejs_eventloop_lag_p99_milliseconds",
      "load_shed_rejected_requests_total"
    ],
    productionChecklist: [
      "Monitor p99 and max event loop lag, not just p50 or average lag.",
      "Send a standard 'Retry-After' response header when load-shedding to prevent aggressive client reconnect storms.",
      "Integrate event loop lag directly into Kubernetes readiness probes to temporarily route traffic away from saturated pods."
    ]
  },

  // 3. Automated Memory Leak Diagnostics
  {
    id: "prod-node-003",
    topic: "Automated Memory Leak Detection & Production Heap Profiling",
    category: "Memory & Diagnostics",
    severity: "Critical / Out-Of-Memory Defense",
    theProblem: "In long-running production containers, subtle memory leaks (e.g. unevicted caches, retained closures, dangling EventEmitter listeners) cause RSS memory to climb over days. Eventually, the Linux OOM Killer kills the process (exit code 137) during peak traffic without leaving diagnostic trace files.",
    howItWorksInternally: "A background health watchdog periodically checks process.memoryUsage(). If heapUsed or RSS exceeds 80% of container limits for multiple consecutive checks, the service automatically initiates a programmatic heap dump using v8.getHeapSnapshot(), pipes the dump through zlib Gzip compression to disk or S3, and notifies the team via alerting before the process runs out of memory.",
    productionCode: `import v8 from 'node:v8';
import fs from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

export class MemoryWatchdog {
  constructor(thresholdPercent = 85, checkIntervalMs = 30000) {
    this.thresholdPercent = thresholdPercent;
    this.checkIntervalMs = checkIntervalMs;
    this.isDumping = false;
  }

  start() {
    const timer = setInterval(async () => {
      const stats = v8.getHeapStatistics();
      const usedPercent = (stats.used_heap_size / stats.heap_size_limit) * 100;

      if (usedPercent > this.thresholdPercent && !this.isDumping) {
        this.isDumping = true;
        console.error(\`[CRITICAL] Heap usage at \${usedPercent.toFixed(1)}%! Capturing emergency heap dump...\`);
        await this.captureSnapshot();
      }
    }, this.checkIntervalMs);

    timer.unref();
  }

  async captureSnapshot() {
    const filename = \`emergency-heap-\${Date.now()}.heapsnapshot.gz\`;
    const snapshotStream = v8.getHeapSnapshot();
    const fileStream = fs.createWriteStream(filename);

    try {
      await pipeline(snapshotStream, createGzip(), fileStream);
      console.log(\`Emergency heap snapshot saved to \${filename}\`);
    } catch (err) {
      console.error('Failed to capture heap dump:', err);
    }
  }
}`,
    monitoringMetrics: [
      "nodejs_heap_used_bytes",
      "nodejs_heap_size_limit_bytes",
      "nodejs_resident_set_size_bytes",
      "v8_gc_pause_seconds_total"
    ],
    productionChecklist: [
      "Never set --max-old-space-size equal to container memory limit; leave 25%-30% headroom for OS buffers and C++ memory.",
      "Compress heap snapshots on the fly with zlib to prevent filling container ephemeral storage.",
      "Ensure container has permission to write heap dumps to a persistent volume or upload directly to object storage (S3)."
    ]
  },

  // 4. Zero-Downtime Reloads & Cluster Orchestration
  {
    id: "prod-node-004",
    topic: "Zero-Downtime Rolling Reloads & PM2 / Cluster Orchestration",
    category: "Reliability & Resilience",
    severity: "High / High Availability",
    theProblem: "Deploying code updates by killing the existing Node.js process and starting a new one drops active connections during the 2-5 second process startup window, causing client request drops and downtime during deployments.",
    howItWorksInternally: "Zero-downtime rolling reloads spawn a new worker process first. Once the new worker has bound its server port, verified database connectivity, and emitted an 'online' signal, the primary process signals the old worker to stop accepting new requests, drain active sockets, and terminate. At no point is the port unlistened.",
    productionCode: `import cluster from 'node:cluster';
import os from 'node:os';

if (cluster.isPrimary) {
  const numWorkers = os.cpus().length;
  console.log(\`Primary \${process.pid} managing \${numWorkers} workers\`);

  for (let i = 0; i < numWorkers; i++) cluster.fork();

  // Zero-downtime rolling reload on SIGUSR2 / deployment signal:
  process.on('SIGUSR2', async () => {
    console.log('Beginning zero-downtime rolling worker restart...');
    const workerIds = Object.keys(cluster.workers);

    for (const id of workerIds) {
      const oldWorker = cluster.workers[id];
      if (!oldWorker) continue;

      // 1. Spawn replacement worker
      const newWorker = cluster.fork();

      // 2. Wait for new worker to be online and ready before killing old:
      await new Promise((resolve) => newWorker.once('listening', resolve));
      console.log(\`New worker \${newWorker.process.pid} is ready. Retiring old worker \${oldWorker.process.pid}...\`);

      // 3. Politely disconnect old worker (drains active requests):
      oldWorker.disconnect();
      const killTimer = setTimeout(() => oldWorker.kill(), 10000);
      killTimer.unref();
    }
    console.log('Rolling reload completed with zero dropped requests.');
  });
}`,
    monitoringMetrics: [
      "cluster_workers_online_count",
      "cluster_workers_restarts_total",
      "deployment_duration_seconds"
    ],
    productionChecklist: [
      "Wait for the 'listening' or 'online' event on new workers before triggering disconnect() on old workers.",
      "Use oldWorker.disconnect() rather than oldWorker.kill() to allow in-flight HTTP transactions to finish.",
      "Configure PM2 with 'pm2 reload all --wait-ready --listen-timeout 10000' for automated production zero-downtime reloads."
    ]
  },

  // 5. Circuit Breaker Pattern
  {
    id: "prod-node-005",
    topic: "Circuit Breaker Pattern for Downstream Service Isolation",
    category: "Reliability & Resilience",
    severity: "Critical / Cascading Outage Defense",
    theProblem: "When a downstream microservice or payment gateway slows down or fails, upstream Node.js services continue sending requests. Sockets queue up, event loops stall, and memory exhausts—causing a cascading failure that takes down the entire application fleet.",
    howItWorksInternally: "The Circuit Breaker pattern wraps outbound calls in a state machine: 1) CLOSED: Normal operation. If error rate exceeds threshold (e.g. 50%), circuit flips to OPEN. 2) OPEN: All outbound calls are immediately rejected locally without making network calls, returning a cached or graceful fallback response. 3) HALF-OPEN: After a reset timeout (e.g. 10s), trial requests test if downstream recovered. If successful, circuit resets to CLOSED.",
    productionCode: `export class CircuitBreaker {
  constructor(actionFn, { failureThreshold = 5, resetTimeoutMs = 10000 } = {}) {
    this.actionFn = actionFn;
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
    this.state = 'CLOSED'; // CLOSED | OPEN | HALF_OPEN
    this.failureCount = 0;
    this.nextAttempt = Date.now();
  }

  async execute(...args) {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttempt) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('CircuitBreaker[OPEN]: Downstream service unavailable. Failing fast.');
      }
    }

    try {
      const result = await this.actionFn(...args);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.state = 'CLOSED';
  }

  onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold || this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
      console.warn(\`[CircuitBreaker] Tripped to OPEN state! Next trial at \${new Date(this.nextAttempt).toISOString()}\`);
    }
  }
}`,
    monitoringMetrics: [
      "circuit_breaker_state (0=Closed, 1=Half-Open, 2=Open)",
      "circuit_breaker_tripped_total",
      "downstream_failure_rate"
    ],
    productionChecklist: [
      "Always define a local fallback response (cached data or degraded UI) when the breaker is in OPEN state.",
      "Pair the circuit breaker with strict outbound HTTP timeouts (e.g. 2-3s) so slow calls trip the breaker quickly.",
      "Export circuit breaker state to Prometheus/Datadog dashboards for real-time upstream alerting."
    ]
  },

  // 6. Distributed Tracing in Microservices
  {
    id: "prod-node-006",
    topic: "Distributed Tracing & Context Propagation in Microservice Meshes",
    category: "Observability & Performance",
    severity: "High / Distributed Diagnostics",
    theProblem: "In a microservice architecture with 20+ services, diagnosing why a single user request took 3 seconds is impossible when logs are scattered across separate servers with no common identifier.",
    howItWorksInternally: "OpenTelemetry and W3C Trace Context standardize the traceparent header: 00-<trace_id>-<parent_span_id>-<flags>. Node.js captures incoming headers, stores the trace ID in AsyncLocalStorage, and transparently injects the trace ID into all outbound HTTP calls, database queries, and log records across the entire request graph.",
    productionCode: `import { AsyncLocalStorage } from 'node:async_hooks';
import http from 'node:http';

export const traceContext = new AsyncLocalStorage();

// 1. Middleware extracts or creates W3C Trace Context:
export function traceMiddleware(req, res, next) {
  const incomingTrace = req.headers['traceparent'];
  const traceId = incomingTrace ? incomingTrace.split('-')[1] : crypto.randomUUID().replace(/-/g, '');
  const spanId = crypto.randomUUID().replace(/-/g, '').substring(0, 16);
  const traceparent = \`00-\${traceId}-\${spanId}-01\`;

  res.setHeader('traceparent', traceparent);

  traceContext.run({ traceId, spanId, traceparent }, () => {
    next();
  });
}

// 2. Outgoing fetch wrapper auto-propagates traceparent header:
export async function tracedFetch(url, options = {}) {
  const store = traceContext.getStore();
  const headers = new Headers(options.headers || {});

  if (store?.traceparent) {
    headers.set('traceparent', store.traceparent);
  }

  return fetch(url, { ...options, headers });
}`,
    monitoringMetrics: [
      "http_request_duration_seconds{service, path}",
      "distributed_spans_total",
      "untraced_requests_ratio"
    ],
    productionChecklist: [
      "Ensure all logging statements automatically include traceId from AsyncLocalStorage.",
      "Always forward the traceparent header to downstream HTTP services, message queues (Kafka/RabbitMQ), and Redis jobs.",
      "Use W3C Trace Context standards rather than vendor-specific headers (e.g. X-B3-TraceId) for universal mesh interop."
    ]
  },

  // 7. Database Connection Pool Exhaustion
  {
    id: "prod-node-007",
    topic: "Database Connection Pool Sizing & Leak Prevention",
    category: "Database & Data Layer",
    severity: "Critical / Data Layer Availability",
    theProblem: "Under traffic spikes, acquiring database connections blocks indefinitely if all pool sockets are in use. Alternatively, forgetting to call client.release() in a catch block leaks connections until the pool is permanently starved, crashing all database queries.",
    howItWorksInternally: "A PostgreSQL or MySQL connection pool maintains a fixed number of open TCP sockets. When pool.connect() is called, a client is checked out. If all clients are checked out, callers queue up until connectionTimeoutMillis expires. Using client.release() in a finally block guarantees the client is returned to the pool even if queries throw errors.",
    productionCode: `import pg from 'pg';

export const dbPool = new pg.Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  max: 20,                          // Maximum 20 pooled connections
  idleTimeoutMillis: 30000,         // Close idle clients after 30s
  connectionTimeoutMillis: 5000,    // Fail fast if pool cannot provide client in 5s
  statement_timeout: 10000          // Hard cancel queries running > 10s at DB engine
});

// POOL ERROR LISTENER: Critical to prevent unhandled background socket crashes
dbPool.on('error', (err, client) => {
  console.error('Unexpected error on idle database client in pool:', err);
});

// SAFE TRANSACTION PATTERN (Guarantees client.release in finally):
export async function executeTransaction(workFn) {
  const client = await dbPool.connect();
  try {
    await client.query('BEGIN');
    const result = await workFn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release(); // MANDATORY: Returns client to pool under all circumstances!
  }
}`,
    monitoringMetrics: [
      "db_pool_total_connections",
      "db_pool_idle_connections",
      "db_pool_waiting_queries_count",
      "db_query_duration_seconds"
    ],
    productionChecklist: [
      "Always attach a dbPool.on('error', ...) listener; unhandled idle socket drops will crash Node processes.",
      "Always wrap pool.connect() checkouts in try / finally { client.release(); } blocks.",
      "Configure statement_timeout in the PostgreSQL pool to prevent rogue runaway queries from locking tables.",
      "Formula for pool size: (Core Count * 2) + Effective Spindle Count (typically 10-25 connections per Node pod)."
    ]
  },

  // 8. Stream Backpressure in High-Throughput Microservices
  {
    id: "prod-node-008",
    topic: "Stream Backpressure & HighWaterMark Tuning in Microservices",
    category: "Streams & File I/O",
    severity: "High / OOM Prevention",
    theProblem: "When transferring large payloads between microservices or processing big datasets, reading faster than writing causes intermediate buffers to grow unbounded in memory, triggering sudden Out-Of-Memory heap crashes.",
    howItWorksInternally: "When a writable stream's buffer exceeds highWaterMark, write(chunk) returns false, signaling backpressure. The readable source must call pause() and stop reading. Once the consumer flushes data to the destination, it emits 'drain', prompting the source to call resume(). Using stream.pipeline() automates this flow control and guarantees proper cleanup.",
    productionCode: `import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Transform } from 'node:stream';

export async function transformAndStreamReport(inputPath, outputPath) {
  const transformer = new Transform({
    highWaterMark: 64 * 1024, // 64KB buffer
    transform(chunk, encoding, callback) {
      try {
        const row = chunk.toString().trim();
        this.push(row + '\\n');
        callback(); // Tells upstream producer this chunk is processed!
      } catch (err) {
        callback(err);
      }
    }
  });

  // pipeline automatically coordinates backpressure between SSD and network socket:
  await pipeline(
    createReadStream(inputPath, { highWaterMark: 64 * 1024 }),
    transformer,
    createWriteStream(outputPath, { highWaterMark: 64 * 1024 })
  );
  console.log('Stream completed with flat 40MB RSS memory footprint.');
}`,
    monitoringMetrics: [
      "stream_backpressure_pause_events_total",
      "stream_buffer_bytes_current",
      "process_resident_set_size_bytes"
    ],
    productionChecklist: [
      "Never use stream.pipe() in production; use stream.pipeline() or stream/promises pipeline() for error cleanup.",
      "Tune highWaterMark to 64KB or 128KB for file I/O to avoid excessive system call thrashing.",
      "Ensure custom Transform streams always call callback() in _transform; omitting it permanently stalls the pipeline."
    ]
  },

  // 9. Hardened Docker Containerization
  {
    id: "prod-node-009",
    topic: "Hardened Docker Containerization for Node.js (PID 1, Tini, Non-Root)",
    category: "Containerization & DevOps",
    severity: "Critical / Security & Operations",
    theProblem: "Running Node.js as root (UID 0) inside Docker containers creates high security privilege escalation vulnerabilities. Running Node as PID 1 causes SIGTERM signals to be ignored (hanging docker stop) and leads to zombie process accumulation.",
    howItWorksInternally: "A multi-stage Docker build separates dependency installation from runtime artifacts. Running as the unprivileged 'node' user prevents container escape attacks. Using dumb-init or tini as PID 1 ensures proper POSIX signal forwarding (SIGTERM) and automatic child process zombie reaping.",
    productionCode: `# Multi-stage hardened production Dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts
COPY . .
RUN npm run build && npm prune --production

FROM node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
# Run as built-in unprivileged node user (non-root):
USER node

COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/dist ./dist

EXPOSE 3000
# dumb-init acts as PID 1 to forward signals and reap zombie processes:
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]`,
    monitoringMetrics: [
      "container_cpu_usage_seconds_total",
      "container_memory_working_set_bytes",
      "container_restart_count"
    ],
    productionChecklist: [
      "Never run Node.js containers as root; always specify USER node.",
      "Use dumb-init or tini as container ENTRYPOINT to properly handle SIGTERM and reap zombies.",
      "Use multi-stage builds to avoid shipping compilers (gcc, python) or devDependencies into production.",
      "Use .dockerignore to exclude .git, node_modules, and .env files from the build context."
    ]
  },

  // 10. Kubernetes Probes Architecture
  {
    id: "prod-node-010",
    topic: "Kubernetes Readiness vs Liveness Probes Architecture",
    category: "Containerization & DevOps",
    severity: "High / High Availability",
    theProblem: "If an engineer checks external database connectivity inside a Kubernetes Liveness probe, a momentary database blip causes Kubernetes to simultaneously kill and reboot all Node pods in the cluster, creating a massive cascading reboot storm.",
    howItWorksInternally: "Liveness probes only check if the Node process is alive and the event loop is responsive; if it fails, the pod is restarted. Readiness probes check if the pod is ready to accept user traffic (database reachable, caches warmed); if it fails, Kubernetes stops routing traffic to the pod without rebooting it.",
    productionCode: `import http from 'node:http';

export function setupKubernetesHealthEndpoints(server, dbCheckFn, redisCheckFn) {
  return async (req, res) => {
    // 1. LIVENESS: Is the event loop responding? (Fast in-memory check only!)
    if (req.url === '/healthz/liveness') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ status: 'ALIVE', uptime: process.uptime() }));
    }

    // 2. READINESS: Can the service actually serve traffic? (Checks dependencies)
    if (req.url === '/healthz/readiness') {
      try {
        const isDbHealthy = await dbCheckFn();
        const isRedisHealthy = await redisCheckFn();

        if (isDbHealthy && isRedisHealthy) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'READY' }));
        } else {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ status: 'NOT_READY', db: isDbHealthy, redis: isRedisHealthy }));
        }
      } catch (err) {
        res.writeHead(503);
        return res.end(JSON.stringify({ status: 'ERROR', error: err.message }));
      }
    }
  };
}`,
    monitoringMetrics: [
      "kube_pod_status_ready",
      "health_check_duration_milliseconds",
      "pod_liveness_failures_total"
    ],
    productionChecklist: [
      "Never check external dependencies (databases, third-party APIs) in Liveness probes.",
      "Check databases and message brokers strictly in Readiness probes.",
      "Configure initialDelaySeconds and timeoutSeconds to give pods adequate warm-up time."
    ]
  },

  // 11. Production Error Handling & Recovery
  {
    id: "prod-node-011",
    topic: "Production Error Handling & Uncaught Exception Recovery",
    category: "Reliability & Resilience",
    severity: "Critical / State Integrity",
    theProblem: "Suppressing fatal uncaught exceptions using empty catch blocks or continuing execution after uncaughtException leaves memory, database handles, and closures in an unknown, corrupted state that leads to data corruption.",
    howItWorksInternally: "Node.js follows the 'fail-fast' philosophy: when an uncaught exception occurs, the process must log the error with stack traces, flush pending logs, close active network handles, and exit with code 1. A process supervisor (Docker, Kubernetes, PM2) immediately boots a clean, fresh instance.",
    productionCode: `export function setupProcessCrashGuard(logger, server) {
  function handleFatalCrash(err, origin) {
    console.error(\`FATAL PROCESS CRASH (\${origin}):\`, err);

    // 1. Set 1.5s hard exit timeout
    const forceExitTimer = setTimeout(() => {
      process.exit(1);
    }, 1500);
    forceExitTimer.unref();

    // 2. Stop accepting incoming requests
    if (server && typeof server.close === 'function') {
      server.close();
    }

    // 3. Flush logs and exit with code 1
    if (logger && typeof logger.flush === 'function') {
      logger.flush(() => process.exit(1));
    } else {
      process.exit(1);
    }
  }

  process.on('uncaughtException', (err, origin) => handleFatalCrash(err, origin));
  process.on('unhandledRejection', (reason) => handleFatalCrash(reason, 'unhandledRejection'));
}`,
    monitoringMetrics: [
      "process_crash_events_total",
      "unhandled_promise_rejections_total",
      "fatal_uncaught_exceptions_total"
    ],
    productionChecklist: [
      "Always exit the process on uncaughtException; never attempt to resume normal execution.",
      "Ensure --unhandled-rejections=strict is active (default in Node 15+).",
      "Flush asynchronous loggers before calling process.exit(1) to avoid losing critical crash stack traces."
    ]
  },

  // 12. Security Hardening Defense-in-Depth
  {
    id: "prod-node-012",
    topic: "Defense-in-Depth Security Hardening in Production",
    category: "Security & Hardening",
    severity: "Critical / Security Hardening",
    theProblem: "Web APIs deployed with default Node.js configurations are vulnerable to header information leakage, prototype pollution, cross-site scripting (XSS), and clickjacking attacks.",
    howItWorksInternally: "Defense-in-depth layers multiple security mitigations: freezing Object.prototype at startup to neutralize Prototype Pollution, setting Helmet HTTP security headers (CSP, HSTS, nosniff), enforcing strict request body size limits, and sanitizing inputs.",
    productionCode: `export function applyProductionSecurityHardening(app, server) {
  // 1. Neutralize Prototype Pollution at runtime startup:
  Object.freeze(Object.prototype);

  // 2. HTTP Security Headers Middleware:
  app.use((req, res, next) => {
    res.removeHeader('X-Powered-By');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none';");
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
  });

  // 3. Prevent Slowloris header drip attacks:
  server.headersTimeout = 15000;
  server.requestTimeout = 30000;
}`,
    monitoringMetrics: [
      "security_header_violations_total",
      "rejected_payload_size_total",
      "auth_failures_per_ip"
    ],
    productionChecklist: [
      "Remove X-Powered-By header to avoid revealing framework details to scanners.",
      "Set Strict-Transport-Security with includeSubDomains and preload to mandate HTTPS.",
      "Freeze Object.prototype at startup or use Object.create(null) for dictionary maps."
    ]
  },

  // 13. CPU Task Isolation with Piscina
  {
    id: "prod-node-013",
    topic: "CPU-Intensive Task Isolation with Piscina Thread Pools",
    category: "Concurrency & Performance",
    severity: "High / Latency Protection",
    theProblem: "Running heavy synchronous calculations (PDF generation, bcrypt hashing, image compression) on the main Node.js thread blocks the event loop, causing API response times for all other users to spike from 10ms to several seconds.",
    howItWorksInternally: "Piscina manages a worker thread pool sized according to available CPU cores. Tasks are dispatched to idle worker threads. Each worker executes the CPU-intensive task in its own V8 Isolate, allowing the primary event loop to continue serving incoming HTTP traffic without latency degradation.",
    productionCode: `import Piscina from 'piscina';
import path from 'node:path';
import os from 'node:os';

// Initialize thread pool matching container CPU quota:
export const cpuThreadPool = new Piscina({
  filename: path.resolve('./dist/workers/heavy-computation.worker.js'),
  minThreads: 2,
  maxThreads: Math.max(2, os.cpus().length),
  idleTimeout: 30000
});

// Route handler delegating heavy CPU work to thread pool:
export async function handleHeavyDataProcessing(req, res) {
  try {
    // Dispatches task to warm background thread:
    const result = await cpuThreadPool.run(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ error: 'Computation failed', details: err.message });
  }
}`,
    monitoringMetrics: [
      "piscina_active_threads_count",
      "piscina_queue_size",
      "piscina_task_duration_seconds"
    ],
    productionChecklist: [
      "Size maxThreads based on container CPU limits, not bare-metal host cores.",
      "Pre-warm worker threads during server startup to eliminate cold-start latency.",
      "Monitor piscina_queue_size to detect when CPU task arrival rate exceeds worker capacity."
    ]
  },

  // 14. Outbound HTTP Agent Tuning & DNS Caching
  {
    id: "prod-node-014",
    topic: "Outbound HTTP Agent Tuning & DNS Caching for High-Throughput APIs",
    category: "Networking & Performance",
    severity: "High / Microservice Throughput",
    theProblem: "Making frequent outbound HTTP requests using default Node.js settings opens a new TCP connection per request and triggers synchronous dns.lookup() in the libuv thread pool, exhausting both ephemeral TCP ports and worker threads.",
    howItWorksInternally: "Configuring a persistent http.Agent with keepAlive: true pools sockets, eliminating TCP/TLS handshakes. Adding a DNS cache (like agentkeepalive or c-ares) caches IP addresses, preventing repetitive DNS queries from saturating the libuv worker thread pool.",
    productionCode: `import http from 'node:http';
import https from 'node:https';

export const highThroughputHttpAgent = new http.Agent({
  keepAlive: true,
  keepAliveMsecs: 15000,
  maxSockets: 200,       // Max concurrent active sockets per destination host
  maxFreeSockets: 50,    // Max idle sockets retained in pool
  timeout: 30000
});

export const highThroughputHttpsAgent = new https.Agent({
  keepAlive: true,
  keepAliveMsecs: 15000,
  maxSockets: 200,
  maxFreeSockets: 50,
  timeout: 30000
});

export function getAgentForUrl(targetUrl) {
  return targetUrl.startsWith('https') ? highThroughputHttpsAgent : highThroughputHttpAgent;
}`,
    monitoringMetrics: [
      "outbound_http_socket_pool_active_count",
      "outbound_http_socket_pool_free_count",
      "outbound_request_duration_seconds"
    ],
    productionChecklist: [
      "Reuse global http.Agent / https.Agent singletons across all outbound HTTP calls.",
      "Set maxSockets to prevent opening thousands of outbound connections simultaneously.",
      "Use dns.resolve4 or in-memory DNS caching to prevent dns.lookup from exhausting the libuv thread pool."
    ]
  }
];

const outputPath = path.resolve(__dirname, '../data/nodejs.production.json');
fs.writeFileSync(outputPath, JSON.stringify(productionTopics, null, 2), 'utf-8');
console.log(`Successfully generated ${productionTopics.length} comprehensive Production Mastery topics to ${outputPath}`);
