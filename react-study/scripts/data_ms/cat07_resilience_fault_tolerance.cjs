const { card } = require("../ms_builder_helper.cjs");

const cards = [
  card(
    73,
    "Cascading Failures & The Microservice Domino Effect",
    "Reliability",
    "Mastery",
    "Cascading failure occurs when a latency spike or outage in a single downstream dependency causes calling services to back up, exhaust connection pools and threads, and trigger a domino effect of crashes across the entire microservices topology.",
    `// The Anatomy of a Cascading Failure Domino:
// 1. Service D (Recommendations) slows down from 50ms to 8,000ms due to a database lock.
// 2. Service C (Product Detail) calls Service D synchronously without a timeout.
// 3. Service C exhausts its Express/Node.js or Tomcat thread/socket pool waiting for D.
// 4. Service B (Order Flow) calls Service C; its requests also block and pool exhausts.
// 5. Ingress API Gateway exhausts its epoll/worker connection limit; returns 504 to ALL users.
// 6. Entire enterprise goes down because of a slow recommendation widget!

// Anti-Pattern: Unbounded Call without Circuit Breaking or Timeout
export async function getProductDetailsUnsafe(productId: string) {
  // Dangerous: No timeout! If recommendations hang, this request hangs forever.
  const [product, reviews, recs] = await Promise.all([
    fetch(\`http://product-srv/items/\${productId}\`).then(r => r.json()),
    fetch(\`http://review-srv/reviews/\${productId}\`).then(r => r.json()),
    fetch(\`http://recommendation-srv/items/\${productId}/recs\`).then(r => r.json())
  ]);
  return { product, reviews, recs };
}

// Correct Pattern: Bounded Deadlines + Fallback Stubbing
export async function getProductDetailsSafe(productId: string) {
  const [product, reviews, recs] = await Promise.allSettled([
    fetchWithTimeout(\`http://product-srv/items/\${productId}\`, 400),
    fetchWithTimeout(\`http://review-srv/reviews/\${productId}\`, 300),
    fetchWithTimeout(\`http://recommendation-srv/items/\${productId}/recs\`, 200)
  ]);

  if (product.status === "rejected") {
    throw new Error("Core product unavailable");
  }

  return {
    product: product.value,
    reviews: reviews.status === "fulfilled" ? reviews.value : [],
    recs: recs.status === "fulfilled" ? recs.value : [] // Graceful degradation
  };
}`,
    ["Cascading Failure", "Domino Effect", "Thread Exhaustion", "Resilience", "Resource Starvation"],
    [
      { title: "Google SRE: Addressing Cascading Failures", url: "https://sre.google/sre-book/addressing-cascading-failures/" }
    ],
    "Why does increasing resource limits (CPU/RAM/Thread Count) fail to prevent cascading failures?",
    "Increasing resources simply delays the failure and increases the blast radius. If downstream responses take 10 seconds, doubling worker threads merely allows twice as many requests to queue up before memory runs out, amplifying the load hitting the failing downstream service.",
    "What is the single most critical defense against cascading failures?",
    "Enforcing strict, aggressive timeouts on all outbound remote network calls and decoupling synchronous dependencies with circuit breakers, bulkheads, and asynchronous messaging."
  ),

  card(
    74,
    "Circuit Breaker Pattern: State Machine & Transition Rules",
    "Reliability",
    "Mastery",
    "The Circuit Breaker pattern wraps remote calls in a finite state machine (CLOSED, OPEN, HALF-OPEN). When consecutive failures exceed a threshold, the circuit trips to OPEN, instantly failing fast without placing additional load on the distressed downstream service.",
    `// Circuit Breaker Finite State Machine Implementation:
type State = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private state: State = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = Date.now();

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetTimeoutMs = 15000,
    private readonly halfOpenSuccessThreshold = 2
  ) {}

  async execute<T>(action: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() > this.nextAttempt) {
        this.state = "HALF_OPEN";
        console.log("[CircuitBreaker] Transitioned to HALF_OPEN (Probing downstream)");
      } else {
        // Fast-fail: Avoid making network call altogether!
        return fallback();
      }
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      return fallback();
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccessThreshold) {
        this.state = "CLOSED";
        this.successCount = 0;
        console.log("[CircuitBreaker] Recovered! Transitioned to CLOSED");
      }
    }
  }

  private onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold || this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
      this.successCount = 0;
      console.warn(\`[CircuitBreaker] Tripped to OPEN! Failing fast for \${this.resetTimeoutMs}ms\`);
    }
  }
}`,
    ["Circuit Breaker", "State Machine", "Fail Fast", "Half-Open", "Self-Healing"],
    [
      { title: "Martin Fowler: Circuit Breaker", url: "https://martinfowler.com/bliki/CircuitBreaker.html" }
    ],
    "What is the operational purpose of the `HALF_OPEN` state in a circuit breaker?",
    "It acts as a canary probe. After a cooldown duration, the circuit breaker permits a small, restricted trial of requests through to the downstream service to test if it has recovered, preventing a thundering herd of thousands of queued requests from instantly crashing it again.",
    "What criteria should count as a failure for tripping a circuit breaker?",
    "Transport timeouts, TCP connection resets, and 5xx server errors (e.g. 500, 502, 503, 504). Business logic responses like 400 Bad Request, 404 Not Found, or 422 Unprocessable Entity must NOT trip the breaker, as they indicate valid client errors rather than service infrastructure failure."
  ),

  card(
    75,
    "Bulkhead Isolation: Thread Pools vs Semaphore Concurrency",
    "Reliability",
    "Deep Dive",
    "Inspired by watertight compartments in ships, the Bulkhead pattern partitions computational resources (worker threads, connection pools, memory) across dependencies so that a failure in one partition cannot exhaust resources for others.",
    `// Bulkhead Isolation Approaches:
// 1. Thread Pool Bulkhead: Dedicated thread pool per dependency (e.g., Netflix Hystrix / Java Executor).
//    Pros: Isolated queues, can interrupt running threads on timeout.
//    Cons: Context switching overhead, high memory footprint.

// 2. Semaphore Bulkhead (Concurrency Limiter): Uses atomic counters to limit concurrent in-flight calls.
//    Pros: Extremely lightweight, zero context-switch overhead, ideal for Node.js / Go event loops.
//    Cons: Cannot interrupt a long-running synchronous execution.

// Semaphore Bulkhead Implementation in TypeScript:
export class SemaphoreBulkhead {
  private inFlight = 0;

  constructor(
    private readonly maxConcurrent: number,
    private readonly maxQueue: number
  ) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.inFlight >= this.maxConcurrent) {
      throw new Error(\`Bulkhead limit exceeded (\${this.maxConcurrent}). Request shed.\`);
    }

    this.inFlight++;
    try {
      return await fn();
    } finally {
      this.inFlight--;
    }
  }
}

// Applying isolated bulkheads to microservice client calls:
const paymentBulkhead = new SemaphoreBulkhead(50, 10);
const recommendationBulkhead = new SemaphoreBulkhead(10, 0); // Strict shed

export async function checkout(orderData: any) {
  // If recommendations fail or lock up, max 10 slots are consumed.
  // 50 slots remain guaranteed for processing critical payments!
  return paymentBulkhead.run(() => callPaymentService(orderData));
}`,
    ["Bulkhead", "Thread Pool", "Semaphore", "Resource Isolation", "Capacity Limits"],
    [
      { title: "Microsoft Architecture: Bulkhead Pattern", url: "https://learn.microsoft.com/en-us/azure/architecture/patterns/bulkhead" }
    ],
    "Why is a shared global HTTP client or thread pool without bulkheads dangerous in microservices?",
    "If one non-essential dependency (e.g. currency conversion API) degrades and locks up 100 connections, the entire global client pool is exhausted. Critical workflows (user login, checkout) are starved of connections and fail despite their underlying services being completely healthy.",
    "How does a Semaphore Bulkhead differ from a Rate Limiter?",
    "A Rate Limiter restricts the number of requests per unit of time (e.g. 100 req/second). A Bulkhead limits the number of concurrent in-flight requests executing at any exact instant in time (e.g. max 20 simultaneous calls)."
  ),

  card(
    76,
    "Timeout Budgets & Distributed Deadline Propagation",
    "Reliability",
    "Mastery",
    "Static hardcoded timeouts at every microservice hop fail to protect systems. Distributed Deadline Propagation forwards a remaining time budget across call chains; if upstream has only 200ms left before timing out, downstream aborts early rather than wasting work.",
    `// Distributed Deadline Propagation over HTTP (using gRPC Deadline or 'Request-Timeout' Header):
// [Client (Budget: 1000ms)] -> Gateway (Spent 100ms, Remaining 900ms)
//                            -> Order Service (Spent 300ms, Remaining 600ms)
//                            -> Payment Service (Spent 650ms -> DEADLINE EXCEEDED!)

import { Request, Response, NextFunction } from "express";

export function deadlinePropagationMiddleware(req: Request, res: Response, next: NextFunction) {
  const incomingDeadline = req.headers["x-request-deadline"]; // Unix timestamp in ms
  const defaultTimeoutMs = 1500;

  const deadlineTimestamp = incomingDeadline 
    ? parseInt(incomingDeadline as string, 10) 
    : Date.now() + defaultTimeoutMs;

  const remainingBudgetMs = deadlineTimestamp - Date.now();

  if (remainingBudgetMs <= 0) {
    // Upstream has already timed out: Fail Fast immediately!
    return res.status(504).json({
      error: "Gateway Timeout",
      message: "Client deadline already expired before processing could begin."
    });
  }

  // Create AbortController bound to remaining budget
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, remainingBudgetMs);

  // Attach context to request
  (req as any).deadline = {
    timestamp: deadlineTimestamp,
    remainingMs: () => Math.max(0, deadlineTimestamp - Date.now()),
    signal: controller.signal
  };

  res.on("finish", () => clearTimeout(timer));
  next();
}

// Downstream call forwards adjusted deadline:
export async function callDownstream(url: string, req: any) {
  const remaining = req.deadline.remainingMs();
  return fetch(url, {
    signal: req.deadline.signal,
    headers: {
      "x-request-deadline": req.deadline.timestamp.toString()
    }
  });
}`,
    ["Timeout Budget", "Deadline Propagation", "Wasted Computation", "Fail Fast", "gRPC Deadlines"],
    [
      { title: "Google SRE: Distributed System Latency", url: "https://sre.google/sre-book/addressing-cascading-failures/#deadlines" }
    ],
    "Why is processing a request when its upstream client has already timed out considered a critical anti-pattern?",
    "It wastes CPU, database locks, and I/O capacity on generating a response that the client will discard. In times of system distress, this wasted computation accelerates cluster collapse.",
    "How does gRPC natively handle distributed deadline propagation?",
    "Every gRPC context carries a `grpc-timeout` header indicating remaining duration. When a gRPC call reaches an intermediate service, the gRPC runtime automatically decrements the elapsed time and propagates the adjusted timeout to all sub-RPCs."
  ),

  card(
    77,
    "Retries with Exponential Backoff & Full Jitter",
    "Reliability",
    "Mastery",
    "Blind retries during an outage create a 'Retry Storm' (Thundering Herd) that amplifies server overload. Exponential Backoff with Full Jitter decorrelates client retry timings across a randomized spectrum, allowing downstream services to recover.",
    `// Full Jitter Backoff Formula (AWS Architecture Standard):
// sleep = random_between(0, min(cap, base * 2 ^ attempt))

export async function retryWithFullJitter<T>(
  operation: () => Promise<T>,
  maxAttempts = 4,
  baseDelayMs = 100,
  maxDelayMs = 3000
): Promise<T> {
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      if (attempt >= maxAttempts || !isTransientError(err)) {
        throw err;
      }

      // Calculate exponential backoff ceiling
      const exponentialCeiling = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));

      // Apply Full Jitter: randomize uniformly between 0 and ceiling
      const sleepDuration = Math.floor(Math.random() * exponentialCeiling);

      console.warn(\`[Retry] Attempt \${attempt} failed. Backing off for \${sleepDuration}ms with full jitter.\`);
      await new Promise(resolve => setTimeout(resolve, sleepDuration));
    }
  }

  throw new Error("Retry ceiling exceeded");
}

function isTransientError(err: any): boolean {
  // Only retry transient network glitches or 503/429 status codes
  const status = err.response?.status || err.statusCode;
  return status === 429 || status === 503 || status === 504 || err.code === "ECONNRESET";
}`,
    ["Exponential Backoff", "Full Jitter", "Retry Storm", "Thundering Herd", "Idempotent Retries"],
    [
      { title: "AWS Architecture Blog: Exponential Backoff And Jitter", url: "https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/" }
    ],
    "Why does standard Exponential Backoff without Jitter fail during high-concurrency outages?",
    "Without jitter, thousands of clients that failed at the exact same second will calculate the exact same backoff delay (e.g. exactly 200ms, then 400ms, then 800ms). They will retry in synchronized, periodic lockstep waves, repeatedly hammering and crashing the recovering service.",
    "What rule must ALWAYS be verified before enabling retries on an HTTP endpoint?",
    "The operation MUST be strictly idempotent. Retrying non-idempotent operations (such as un-keyed `POST /orders` or `POST /charges`) will result in duplicate payments or duplicate records in database tables."
  ),

  card(
    78,
    "Fail-Fast vs Graceful Degradation & Fallback Stubs",
    "Reliability",
    "Core",
    "When a subsystem degrades, a microservice should prioritize graceful degradation: returning cached stubs, static fallbacks, or partial results rather than crashing the primary user experience.",
    `// Graceful Degradation Strategy Matrix:
// 1. Static Fallbacks: Return hardcoded default values (e.g. generic greeting when Profile Service is down).
// 2. Cache Fallbacks: Return stale or Redis cached records with a "stale: true" telemetry marker.
// 3. Feature Degradation: Hide non-essential UI widgets (e.g. Recommendations, Review stars).
// 4. Fail-Fast: For critical flows (Debit Account, Finalize Order), immediately abort with clear status.

export class UserDashboardService {
  constructor(
    private readonly profileClient: ProfileClient,
    private readonly creditScoreClient: CreditScoreClient,
    private readonly localCache: CacheStore
  ) {}

  async getDashboard(userId: string) {
    // 1. Critical Call: Must Fail Fast if user profile does not exist
    const profile = await this.profileClient.getProfile(userId);

    // 2. Non-critical Call: Graceful Degradation fallback
    let creditScore: number | null = null;
    try {
      creditScore = await this.creditScoreClient.getScore(userId, { timeoutMs: 250 });
    } catch (err) {
      console.warn(\`[Degradation] Credit score failed for \${userId}. Falling back to cache.\`);
      creditScore = await this.localCache.get(\`score:\${userId}\`) || null;
    }

    return {
      user: profile,
      creditScore: creditScore ?? "UNAVAILABLE_TRY_LATER",
      degraded: creditScore === null
    };
  }
}`,
    ["Fail-Fast", "Graceful Degradation", "Fallback Stubs", "Resilience", "User Experience"],
    [
      { title: "Martin Fowler: Microservice Resilience & Graceful Degradation", url: "https://martinfowler.com/articles/microservices.html" }
    ],
    "What is the difference between Fail-Fast and Graceful Degradation?",
    "Fail-Fast halts execution immediately and surfaces an error without wasting resources when a core prerequisite cannot be met. Graceful Degradation catches non-fatal dependency failures and returns alternative, partial, or cached data to keep the primary user journey functional.",
    "What is the danger of returning silent fallback stubs without alerting or metrics?",
    "Silent failure blindness. If a recommendation service fails and returns empty lists without emitting error telemetry, the system appears 'healthy' on dashboards while business metrics (conversion rates, revenue) plummet silently."
  ),

  card(
    79,
    "Load Shedding & Adaptive Concurrency Limits (Little's Law)",
    "Performance",
    "Deep Dive",
    "When an overloaded microservice queues requests indefinitely, latency skyrockets and throughput collapses. Load Shedding rejects low-priority traffic early based on Little's Law (`L = λ * W`) and adaptive in-flight limits, keeping active latency within optimal bounds.",
    `// Adaptive Concurrency Limiter based on Netflix Vegas Algorithm:
// Measures Round Trip Time (RTT) and dynamically adjusts maximum in-flight requests (InFlightMax).
// When RTT exceeds baseline * threshold, InFlightMax is reduced.

export class AdaptiveConcurrencyLimiter {
  private minRtt = Infinity;
  private maxConcurrency = 50;
  private inFlight = 0;

  async execute<T>(priority: "HIGH" | "LOW", task: () => Promise<T>): Promise<T> {
    // Load Shedding: If approaching concurrency ceiling, drop low-priority requests!
    if (this.inFlight >= this.maxConcurrency) {
      if (priority === "LOW") {
        throw new Error("HTTP 503: Load Shedding active. Low priority request dropped.");
      }
      if (this.inFlight >= this.maxConcurrency * 1.2) {
        throw new Error("HTTP 503: Hard limit reached. Emergency load shedding.");
      }
    }

    this.inFlight++;
    const start = Date.now();

    try {
      const result = await task();
      const rtt = Date.now() - start;
      this.updateLimits(rtt);
      return result;
    } finally {
      this.inFlight--;
    }
  }

  private updateLimits(rtt: number) {
    if (rtt < this.minRtt) this.minRtt = rtt;

    // If measured RTT exceeds 2x minimum RTT, we are queuing: throttle concurrency ceiling
    if (rtt > this.minRtt * 2.0) {
      this.maxConcurrency = Math.max(10, Math.floor(this.maxConcurrency * 0.9));
    } else if (this.inFlight >= this.maxConcurrency * 0.8) {
      // Under healthy RTT and high saturation: probe higher concurrency
      this.maxConcurrency = Math.min(200, this.maxConcurrency + 1);
    }
  }
}`,
    ["Load Shedding", "Little's Law", "Adaptive Concurrency", "Netflix Vegas", "Throughput Collapse"],
    [
      { title: "Netflix TechBlog: Performance Under Extreme Load", url: "https://netflixtechblog.com/performance-under-extreme-load-with-adaptive-concurrency-limits-c340a6ab902b" }
    ],
    "Why does allowing requests to queue up indefinitely lead to 'Throughput Collapse' in a microservice?",
    "When the queue grows, requests sit waiting for seconds before worker threads even start processing them. By the time processing begins, the client or gateway has already timed out. The server spends 100% of its CPU completing dead requests, reducing useful throughput to zero.",
    "What HTTP status code and header must be returned when a microservice performs load shedding?",
    "HTTP `503 Service Unavailable` with a `Retry-After: <seconds>` header, explicitly indicating to upstream proxies that the node is shedding load due to capacity limits rather than internal crashes."
  ),

  card(
    80,
    "Health Check Probe Anti-Patterns: The Liveness DB Ping Trap",
    "Reliability",
    "Mastery",
    "Microservice health probes must distinguish between Liveness (is the container alive or deadlocked?) and Readiness (is the container ready to receive network traffic?). Pinging downstream databases inside liveness probes is a catastrophic anti-pattern.",
    `// CATASTROPHIC ANTI-PATTERN: Pinging Database in Liveness Probe
// app.get("/healthz/liveness", async (req, res) => {
//   await db.query("SELECT 1"); // WRONG! IF DB BLIPS, KUBERNETES KILLS ALL PODS!
//   res.status(200).send("OK");
// });

// CORRECT HEALTH PROBE ARCHITECTURE (Express / Kubernetes):
import express from "express";
const app = express();

let isReady = false;
let isShuttingDown = false;

// 1. Startup Probe: Validates initialization (schema migration, warmup)
app.get("/healthz/startup", (req, res) => {
  if (isReady) return res.status(200).send("Initialized");
  return res.status(503).send("Warming up");
});

// 2. Liveness Probe: Strictly checks internal process health (Event loop alive, no deadlocks)
// NEVER check external dependencies here!
app.get("/healthz/liveness", (req, res) => {
  if (isShuttingDown) return res.status(503).send("Shutting down");
  // If this endpoint responds, the Node.js event loop is ticking.
  return res.status(200).send("Alive");
});

// 3. Readiness Probe: Checks if service can actively process requests (DB reachable, cache warm)
app.get("/healthz/readiness", async (req, res) => {
  if (isShuttingDown) return res.status(503).send("Draining");

  try {
    // Check if critical dependencies are reachable
    await db.query("SELECT 1");
    return res.status(200).send("Ready");
  } catch (err) {
    // Returning 503 removes pod from Service endpoints WITHOUT restarting the container!
    return res.status(503).send("Dependencies not ready");
  }
});`,
    ["Health Check", "Liveness Probe", "Readiness Probe", "Kubernetes", "Anti-Patterns"],
    [
      { title: "Kubernetes Health Checking Best Practices", url: "https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/" }
    ],
    "What catastrophe occurs when a database ping is included in a Kubernetes Liveness probe during a temporary DB spike?",
    "Every pod's liveness check fails simultaneously. Kubernetes concludes that all application pods are broken and forcefully terminates and restarts every container in the cluster, multiplying connection storms and ensuring the database never recovers.",
    "What action does Kubernetes take when a Readiness probe fails versus when a Liveness probe fails?",
    "When a Readiness probe fails, Kubernetes stops routing ingress network traffic to the pod (removes it from the Service endpoints) but keeps the container running. When a Liveness probe fails, Kubernetes kills the container process and restarts it."
  ),

  card(
    81,
    "Connection Pool Exhaustion & Database Starvation",
    "Performance",
    "Deep Dive",
    "In microservices, multiple pod replicas independently connect to relational databases. If connection pool settings are uncoordinated, a sudden pod auto-scale event will instantly exhaust the database's `max_connections`, freezing the entire service.",
    `// Mathematical Coordination of Connection Pools:
// Total Connections = (Pod Replicas) * (Pool maxConnections per Pod)
// If PostgreSQL max_connections = 200, and Pod max = 20:
// 10 pods * 20 = 200 connections (100% capacity).
// If traffic spikes and HPA scales to 15 pods:
// 15 * 20 = 300 connections -> "FATAL: remaining connection slots are reserved for non-superuser connections"!

// Solution 1: Deploy PgBouncer (Connection Pooler) between Microservices and Database:
// [Microservice Pods (50 pods x 20 conn)] -> [PgBouncer (Transaction Pooling)] -> [PostgreSQL (30 active conn)]

// Solution 2: Strict Node.js Pool Tuning with connection timeouts:
import { Pool } from "pg";

export const dbPool = new Pool({
  host: process.env.DB_HOST,
  max: 10, // Keep pool small per pod!
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000, // Never wait > 2s to checkout connection
  statement_timeout: 5000 // Kill rogue queries taking > 5s
});

// Proper checkout and release hygiene:
export async function querySafe(sql: string, params: any[]) {
  const client = await dbPool.connect();
  try {
    return await client.query(sql, params);
  } finally {
    client.release(); // Crucial: Always release in finally block to prevent leaks!
  }
}`,
    ["Connection Pool", "PgBouncer", "Database Starvation", "PostgreSQL", "Resource Leaks"],
    [
      { title: "HikariCP: Pool Sizing Guidelines", url: "https://github.com/brettwooldridge/HikariCP/wiki/About-Pool-Sizing" }
    ],
    "Why is a smaller database connection pool (e.g. 10 connections per pod) often faster than a large pool (e.g. 100)?",
    "PostgreSQL uses a process-per-connection model. When hundreds of connections compete for CPU, context switching and disk I/O contention degrade performance. A smaller pool matching available CPU cores keeps execution in L1/L2 cache, maximizing throughput.",
    "What occurs if code omits `client.release()` inside a JavaScript `catch` block?",
    "Connection leak. The borrowed connection never returns to the pool. Over time, all available slots are permanently held in limbo until the pool is exhausted, causing all subsequent queries to hang indefinitely."
  ),

  card(
    82,
    "Backpressure & Reactive Streaming in Microservices",
    "Performance",
    "Deep Dive",
    "Backpressure is a flow-control mechanism where a slow consumer signals to a fast producer to slow down or pause message emission, preventing consumer buffers from overflowing and triggering Out-Of-Memory (OOM) crashes.",
    `// Node.js Stream Backpressure Implementation:
// Fast Producer reading from Kafka, slow consumer writing to legacy disk/database
import { Readable, Writable } from "node:stream";

export function pipeWithBackpressure(kafkaStream: Readable, dbWriter: Writable) {
  kafkaStream.on("data", (chunk) => {
    // write() returns false if internal buffer exceeds highWaterMark
    const canAcceptMore = dbWriter.write(chunk);
    if (!canAcceptMore) {
      console.warn("[Backpressure] Consumer buffer full! Pausing upstream Kafka consumption.");
      kafkaStream.pause();
    }
  });

  // 'drain' event fires when consumer buffer flushes below threshold
  dbWriter.on("drain", () => {
    console.log("[Backpressure] Buffer drained. Resuming upstream Kafka consumption.");
    kafkaStream.resume();
  });

  dbWriter.on("error", (err) => console.error("Writer error", err));
}

// Reactive Streams Protocol Specification (RSocket / Project Reactor):
// In Reactive Streams, the consumer actively pulls: request(n) asks for exactly N records.
// Producer CANNOT send N+1 records until explicitly requested.`,
    ["Backpressure", "Reactive Streams", "Flow Control", "Node.js Streams", "Buffer Overflow"],
    [
      { title: "Reactive Streams Specification", url: "https://www.reactive-streams.org/" }
    ],
    "What happens when backpressure is ignored in a high-throughput message consumer?",
    "The consumer reads messages from the network buffer faster than its internal workers can process them. Unprocessed messages accumulate in memory, heap usage balloons, garbage collection cycles choke the process, and the OS kills the container with an Out-of-Memory (OOMKilled) exit code 137.",
    "How does TCP flow control implement backpressure at the network socket layer?",
    "Via the TCP Receive Window (rwnd). When a receiving process fails to read bytes from the kernel socket buffer, the receiver advertises an `rwnd = 0` window update in TCP ACK packets, forcing the sender's TCP stack to halt transmitting packets until the buffer clears."
  ),

  card(
    83,
    "Chaos Engineering: Principles, GameDays & Production Drills",
    "Reliability",
    "Mastery",
    "Chaos Engineering is the discipline of experimenting on a distributed system to build confidence in the system's capability to withstand turbulent conditions in production by proactively injecting controlled failures (killing pods, severing network partitions, corrupting packets).",
    `// The 4 Steps of a Chaos Experiment:
// 1. Define 'Steady State': Baseline metrics representing normal behavior (e.g. 99.8% checkout success, p99 latency < 200ms).
// 2. Hypothesize: "If we terminate 50% of Payment Service pods, the API Gateway and Order Service will gracefully retry, and checkout success will not drop below 99%."
// 3. Inject Variable: Introduce real-world catastrophe (e.g. Chaos Mesh PodKill / AWS Fault Injection Simulator).
// 4. Verify & Improve: Disprove hypothesis, identify hidden single points of failure (SPOFs), and patch code.

// Chaos Mesh Experiment Manifest (Kubernetes Network Partition):
/*
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: partition-order-and-payment
  namespace: production
spec:
  action: partition
  mode: all
  selector:
    namespaces:
      - production
    labelSelectors:
      "app": "order-service"
  direction: to
  target:
    selector:
      namespaces:
        - production
      labelSelectors:
        "app": "payment-service"
    mode: all
  duration: "5m"
*/`,
    ["Chaos Engineering", "Chaos Mesh", "Steady State", "Blast Radius", "Resilience Drills"],
    [
      { title: "Principles of Chaos Engineering", url: "https://principlesofchaos.org/" }
    ],
    "Why must Chaos Experiments always define an automated 'Blast Radius' and 'Kill Switch'?",
    "If the injected fault cascades beyond the hypothesized scope and degrades actual customer revenue or critical telemetry, the automated kill switch must instantly terminate the experiment and restore steady-state networking before irreparable damage occurs.",
    "What is the difference between Disaster Recovery (DR) testing and Chaos Engineering?",
    "DR testing is typically an annual, scheduled checklist verifying backup restoration and datacenter failover. Chaos Engineering is an ongoing, continuous practice of injecting fine-grained faults into production to discover emergent systemic weaknesses."
  ),

  card(
    84,
    "Self-Healing Microservices & Horizontal Pod Autoscaler Tuning",
    "Reliability",
    "Mastery",
    "Self-healing microservices automatically detect degraded state and remediate without human intervention. Tuning the Kubernetes Horizontal Pod Autoscaler (HPA) requires balancing stabilization windows to prevent rapid scaling thrashing (flapping).",
    `// Production-Grade Kubernetes HorizontalPodAutoscaler (v2) Manifest:
/*
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: order-service-hpa
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: order-service
  minReplicas: 4
  maxReplicas: 30
  metrics:
    # 1. Resource Metric: Average CPU utilization
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 65
    # 2. Custom Metric: Envoy Requests Per Second per pod
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: "800m"
  behavior:
    # Scale Up aggressively: Add 100% capacity every 15 seconds during sudden spikes
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
    # Scale Down conservatively: Wait 5 minutes to prevent thrashing/flapping
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 10
          periodSeconds: 60
*/`,
    ["HPA", "Horizontal Autoscaling", "Self-Healing", "Kubernetes", "Flapping Prevention"],
    [
      { title: "Kubernetes Horizontal Pod Autoscaler", url: "https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/" }
    ],
    "Why is a scale-down stabilization window (e.g. 300 seconds) essential in HPA configurations?",
    "To prevent 'flapping' (or thrashing)—where pods scale down immediately after a brief drop in traffic, only to be overwhelmed 30 seconds later by the next traffic wave, causing continuous pod initialization and termination cycles.",
    "Why is relying solely on CPU utilization insufficient for microservices autoscaling?",
    "I/O-bound microservices (waiting on external APIs or database queries) may experience request queue backups and thread exhaustion while maintaining low CPU utilization (< 20%). Effective autoscaling must incorporate L7 request metrics (HTTP requests per second, queue depth, or latency)."
  )
];

module.exports = { cards };
