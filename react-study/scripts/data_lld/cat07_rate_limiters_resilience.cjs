const { createCard } = require('../lld_builder_helper.cjs');

const category = "Rate Limiters, Resilience & Flow Control";

module.exports = [
  createCard({
    idNum: 73,
    category,
    concept: "Token Bucket Rate Limiting Algorithm",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the Token Bucket algorithm work, how does it handle bursts, and how is it implemented without background timers?",
    answer: "The Token Bucket holds up to `capacity` tokens. Tokens are refilled at a constant rate (e.g. 10 tokens/sec). Each request consumes 1 token. If tokens $\\ge 1$, the request is allowed; otherwise rejected. It allows bursts of traffic up to the bucket capacity. It is implemented lazily without background timers by calculating tokens refilled since the last request timestamp.",
    explanation: "Running a timer for each user creates thousands of active timers, exhausting memory. Instead, compute tokens on the fly during incoming calls: `tokensToAdd = (now - lastRefillTime) * refillRate`. Cap at `capacity`, subtract 1 token, update `lastRefillTime = now`. This achieves $O(1)$ time and $O(1)$ space per user with zero background polling.",
    code: `class TokenBucketRateLimiter {
  private capacity: number;
  private refillRatePerSec: number;
  private tokens: number;
  private lastRefillTimestamp: number;

  constructor(capacity: number, refillRatePerSec: number) {
    this.capacity = capacity;
    this.refillRatePerSec = refillRatePerSec;
    this.tokens = capacity;
    this.lastRefillTimestamp = Date.now();
  }

  public allowRequest(tokensRequested: number = 1): boolean {
    this.refill();

    if (this.tokens >= tokensRequested) {
      this.tokens -= tokensRequested;
      return true; // Request allowed
    }
    return false; // Throttled (HTTP 429 Too Many Requests)
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTimestamp) / 1000;
    const tokensToAdd = elapsedSeconds * this.refillRatePerSec;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTimestamp = now;
  }
}`,
    recallHint: "Bucket fills at constant rate; request takes tokens; bursts allowed up to capacity. Refill lazily on call.",
    practice: [
      "Implement a multi-tenant Token Bucket tracking rate limits per API key in a Hash Map",
      "Model Token Bucket in Redis using Lua scripts for atomic token calculation"
    ],
    interviewTip: "When designing rate limiters in LLD, always explain the lazy refill calculation based on elapsed time rather than proposing a background cron or timer thread.",
    tags: ["Rate Limiter", "Token Bucket", "Resilience", "Algorithms"]
  }),

  createCard({
    idNum: 74,
    category,
    concept: "Leaky Bucket Rate Limiting Algorithm",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Leaky Bucket algorithm and how does it guarantee a smooth, constant egress rate to downstream services?",
    answer: "The Leaky Bucket algorithm models a bucket with a small hole in the bottom. Incoming requests enter a FIFO queue (the bucket). Requests leak out of the bucket and are processed at a constant, fixed rate regardless of incoming traffic bursts. If the queue is full, incoming requests overflow and are dropped.",
    explanation: "Unlike Token Bucket (which permits short traffic bursts up to bucket capacity), Leaky Bucket enforces a strictly smoothed output rate. It is ideal for egress traffic shaping when communicating with fragile downstream third-party APIs or legacy databases that cannot tolerate sudden spikes.",
    code: `class LeakyBucketQueue {
  private queue: (() => void)[] = [];
  private capacity: number;
  private leakRatePerSec: number;
  private leakTimer: any;

  constructor(capacity: number, leakRatePerSec: number) {
    this.capacity = capacity;
    this.leakRatePerSec = leakRatePerSec;

    // Drain queue at a constant, steady rate
    const intervalMs = 1000 / leakRatePerSec;
    this.leakTimer = setInterval(() => this.leak(), intervalMs);
  }

  public submitTask(task: () => void): boolean {
    if (this.queue.length >= this.capacity) {
      console.warn("[LeakyBucket] Bucket overflow! Dropping incoming request.");
      return false; // Bucket full: request dropped
    }
    this.queue.push(task);
    return true;
  }

  private leak(): void {
    if (this.queue.length > 0) {
      const task = this.queue.shift()!;
      task(); // Process task at strictly constant cadence
    }
  }

  public destroy() { clearInterval(this.leakTimer); }
}`,
    recallHint: "FIFO queue with fixed leak rate; smooths bursts into a constant trickle, drops if full.",
    practice: [
      "Compare Token Bucket vs Leaky Bucket for an API Gateway dealing with spiky webhooks",
      "Implement Leaky Bucket without a background interval using timestamps"
    ],
    interviewTip: "Token Bucket allows bursts (good for user web traffic); Leaky Bucket smooths traffic to a constant rate (good for protecting slow downstream databases).",
    tags: ["Rate Limiter", "Leaky Bucket", "Traffic Shaping", "Egress Smoothing"]
  }),

  createCard({
    idNum: 75,
    category,
    concept: "Fixed Window Counter & 2x Boundary Burst Vulnerability",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Fixed Window Counter algorithm and what is the 2x Boundary Burst problem?",
    answer: "Fixed Window divides time into static windows (e.g. 10:00:00 to 10:01:00) with a max counter. If a client sends 100 requests at 10:00:59 (the end of window 1), and another 100 requests at 10:01:01 (the start of window 2), both windows are individually valid, but 200 requests were executed within a 2-second interval—twice the configured rate limit (2x Boundary Burst).",
    explanation: "Fixed Window counters are simple to store (e.g. `INCR key` with TTL in Redis), but the boundary vulnerability allows double the allowed traffic to hammer backend servers during window boundaries. This flaw led to the invention of Sliding Window algorithms.",
    code: `class FixedWindowRateLimiter {
  private windowSizeMs: number;
  private maxRequests: number;
  private currentWindowStart: number;
  private counter: number = 0;

  constructor(maxRequests: number, windowSizeSeconds: number) {
    this.maxRequests = maxRequests;
    this.windowSizeMs = windowSizeSeconds * 1000;
    this.currentWindowStart = Date.now();
  }

  public allow(): boolean {
    const now = Date.now();
    // Check if we entered a new static time window
    if (now - this.currentWindowStart >= this.windowSizeMs) {
      this.currentWindowStart = now;
      this.counter = 0; // Reset counter for new window
    }

    if (this.counter < this.maxRequests) {
      this.counter++;
      return true;
    }
    return false; // Exceeded limit in current window
  }
}`,
    recallHint: "Static time windows; simple counter reset. Vulnerable to 2x burst traffic around window boundaries.",
    practice: [
      "Diagram the 2x boundary burst attack on a 1-minute 60-request Fixed Window limiter",
      "Model Fixed Window in Redis using INCR and EXPIRE commands"
    ],
    interviewTip: "Always bring up the 2x Boundary Burst vulnerability when discussing Fixed Window counters, and transition naturally into how Sliding Window solves it.",
    tags: ["Rate Limiter", "Fixed Window", "Vulnerabilities", "Boundary Problem"]
  }),

  createCard({
    idNum: 76,
    category,
    concept: "Sliding Window Log Algorithm",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the Sliding Window Log algorithm achieve 100% precision, and what is its memory trade-off?",
    answer: "Sliding Window Log records a timestamp for every single incoming request in a sorted set (or deque). When a request arrives at timestamp $T$, the limiter purges all timestamps older than $T - \\text{windowSize}$. If the remaining log count is $< \\text{limit}$, append $T$ and allow; otherwise reject. It guarantees 100% boundary accuracy, but consumes high memory storing timestamps for high-volume endpoints.",
    explanation: "Unlike Fixed Window, Sliding Window Log calculates the exact rolling window back in time from the current millisecond. The boundary problem is eliminated. However, if a user sends 10,000 requests per minute, the server must store 10,000 timestamps in memory per active user, making it expensive for high-throughput public APIs.",
    code: `class SlidingWindowLogLimiter {
  private windowSizeMs: number;
  private maxRequests: number;
  private timestamps: number[] = [];

  constructor(maxRequests: number, windowSizeSeconds: number) {
    this.maxRequests = maxRequests;
    this.windowSizeMs = windowSizeSeconds * 1000;
  }

  public allow(): boolean {
    const now = Date.now();
    const windowStart = now - this.windowSizeMs;

    // 1. Evict all expired timestamps outside the rolling window
    while (this.timestamps.length > 0 && this.timestamps[0] <= windowStart) {
      this.timestamps.shift();
    }

    // 2. Check if remaining requests in rolling window exceed limit
    if (this.timestamps.length < this.maxRequests) {
      this.timestamps.push(now);
      return true;
    }
    return false;
  }
}`,
    recallHint: "Keep sorted log of request timestamps; drop entries older than now - windowSize. 100% precise, high RAM.",
    practice: [
      "Implement Sliding Window Log in Redis using ZADD, ZREMRANGEBYSCORE, and ZCARD",
      "Calculate memory footprint for 1,000,000 users making 100 requests/minute using 64-bit integer timestamps"
    ],
    interviewTip: "In interviews, state that while Sliding Window Log is mathematically exact, its memory footprint is $O(M)$ per user (where $M$ is request volume), leading to the more practical Sliding Window Counter.",
    tags: ["Rate Limiter", "Sliding Window Log", "Precision", "Algorithms"]
  }),

  createCard({
    idNum: 77,
    category,
    concept: "Sliding Window Counter Algorithm (Weighted Interpolation)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the Sliding Window Counter algorithm achieve memory efficiency using weighted interpolation across adjacent windows?",
    answer: "The Sliding Window Counter combines Fixed Window memory efficiency ($O(1)$ counters) with Sliding Window accuracy. It estimates requests in the current rolling window by taking the current window counter plus a weighted percentage of the previous window counter: `estimated = prevCount * (1 - timeElapsedRatio) + currCount`.",
    explanation: "If window is 1 minute, current time is 30 seconds into the current window (ratio = 0.5), and previous window had 100 requests while current has 30, the estimated rolling count is $100 \\times (1 - 0.5) + 30 = 80$. This prevents boundary bursts, requires only two integer counters per user, and has an error rate of $< 0.05\\%$.",
    code: `class SlidingWindowCounterLimiter {
  private windowSizeMs: number;
  private maxRequests: number;
  private prevCount: number = 0;
  private currCount: number = 0;
  private currentWindowStart: number;

  constructor(maxRequests: number, windowSizeSeconds: number) {
    this.maxRequests = maxRequests;
    this.windowSizeMs = windowSizeSeconds * 1000;
    this.currentWindowStart = Math.floor(Date.now() / this.windowSizeMs) * this.windowSizeMs;
  }

  public allow(): boolean {
    const now = Date.now();
    const currentWindow = Math.floor(now / this.windowSizeMs) * this.windowSizeMs;

    if (currentWindow !== this.currentWindowStart) {
      // Transition to next window: shift curr to prev, reset curr
      if (currentWindow - this.currentWindowStart === this.windowSizeMs) {
        this.prevCount = this.currCount;
      } else {
        this.prevCount = 0; // Gap of more than 1 window
      }
      this.currCount = 0;
      this.currentWindowStart = currentWindow;
    }

    // Calculate weighted overlap from previous window
    const timeElapsedInCurr = now - this.currentWindowStart;
    const weight = (this.windowSizeMs - timeElapsedInCurr) / this.windowSizeMs;
    const estimatedRequests = Math.floor(this.prevCount * weight) + this.currCount;

    if (estimatedRequests < this.maxRequests) {
      this.currCount++;
      return true;
    }
    return false;
  }
}`,
    recallHint: "Estimated = prevCount * (remaining overlap %) + currCount. O(1) memory, zero boundary burst.",
    practice: [
      "Prove why the error rate of Sliding Window Counter is bounded under 5%",
      "Implement the Cloudflare / Nginx rate limiting approximation algorithm"
    ],
    interviewTip: "Cloudflare and modern high-scale API Gateways use the Sliding Window Counter algorithm because it uses constant $O(1)$ memory while completely neutralizing 2x boundary bursts.",
    tags: ["Rate Limiter", "Sliding Window Counter", "Cloudflare", "Production Optimization"]
  }),

  createCard({
    idNum: 78,
    category,
    concept: "Thread-Safe In-Memory Concurrency for Rate Limiters",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do race conditions break rate limiters under high concurrent traffic, and how do you achieve thread-safety?",
    answer: "A rate limiter performs a read-modify-write cycle: check remaining tokens -> if available, decrement tokens -> save state. Under high concurrency, 50 threads can read `tokens = 1` simultaneously, all 50 approve their requests, and the system allows 50x more traffic than the configured limit. Thread-safety requires atomic CAS updates, synchronized blocks, or Lua script atomicity in Redis.",
    explanation: "In single-node in-memory rate limiters, using non-thread-safe collections (like raw HashMap) results in race conditions or infinite loops. Guarding each rate limiter instance with a Mutex or using Java's `AtomicInteger` / CAS loops guarantees that the token check and decrement execute as an atomic transaction.",
    code: `// Conceptual Thread-Safe Token Bucket using Mutex
class ConcurrentTokenBucket {
  private tokens: number;
  private capacity: number;
  private refillRate: number;
  private lastRefill: number = Date.now();
  private isLocked: boolean = false;

  constructor(capacity: number, refillRate: number) {
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.tokens = capacity;
  }

  // Atomic critical section
  public async tryAcquire(): Promise<boolean> {
    await this.acquireLock();
    try {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens--;
        return true;
      }
      return false;
    } finally {
      this.releaseLock();
    }
  }

  private refill() {
    const now = Date.now();
    const toAdd = ((now - this.lastRefill) / 1000) * this.refillRate;
    this.tokens = Math.min(this.capacity, this.tokens + toAdd);
    this.lastRefill = now;
  }

  private async acquireLock() { /* Mutex lock */ }
  private releaseLock() { /* Mutex release */ }
}`,
    recallHint: "Read-modify-write race condition causes token over-allocation; wrap in atomic CAS or mutex.",
    practice: [
      "Write a multi-threaded stress test spawning 100 threads against a rate limiter and verify token counts",
      "Write a Redis Lua script executing atomic Token Bucket checks across distributed workers"
    ],
    interviewTip: "In coding interviews, writing a rate limiter without addressing concurrency is an immediate red flag. Explicitly mention synchronization or atomic primitives.",
    tags: ["Rate Limiter", "Concurrency", "Race Conditions", "Thread Safety"]
  }),

  createCard({
    idNum: 79,
    category,
    concept: "Multi-Tier Hierarchical Rate Limiting",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why do production systems enforce Multi-Tier Rate Limiting across IP, User ID, and Global Endpoints?",
    answer: "A single rate limit cannot prevent all abuse. Multi-tier rate limiting evaluates multiple orthogonal rules in sequence: 1. Tier 1: Per-IP limiter (prevents DDoS/scraping), 2. Tier 2: Per-User account limiter (prevents account credential stuffing/API abuse), 3. Tier 3: Sensitive endpoint limiter (e.g. Max 5 /auth/login attempts per 15 min), 4. Tier 4: Global platform capacity cap.",
    explanation: "If you only rate limit by User ID, an unauthenticated attacker can hammer `/login` or `/register` from an IP botnet. If you only rate limit by IP, multiple users behind a corporate NAT gateway share one IP and get falsely blocked. Chaining tier evaluators via Chain of Responsibility provides defense-in-depth.",
    code: `interface RequestTelemetry {
  clientIp: string;
  userId?: string;
  endpoint: string;
}

class MultiTierRateLimiter {
  private ipLimiter = new Map<string, TokenBucketRateLimiter>();
  private userLimiter = new Map<string, TokenBucketRateLimiter>();
  private loginLimiter = new Map<string, TokenBucketRateLimiter>();

  public checkAllowed(req: RequestTelemetry): { allowed: boolean; reason?: string } {
    // Tier 1: Per-IP Check (100 req/sec)
    const ipBucket = this.getOrCreate(this.ipLimiter, req.clientIp, 100, 100);
    if (!ipBucket.allowRequest()) return { allowed: false, reason: "IP rate limit exceeded" };

    // Tier 2: Per-User Account Check (if authenticated, 50 req/sec)
    if (req.userId) {
      const userBucket = this.getOrCreate(this.userLimiter, req.userId, 50, 50);
      if (!userBucket.allowRequest()) return { allowed: false, reason: "User quota exceeded" };
    }

    // Tier 3: Sensitive Endpoint Check (/login: max 5 req/min)
    if (req.endpoint === "/api/login") {
      const loginKey = \`\${req.clientIp}_login\`;
      const loginBucket = this.getOrCreate(this.loginLimiter, loginKey, 5, 5 / 60);
      if (!loginBucket.allowRequest()) return { allowed: false, reason: "Too many login attempts" };
    }

    return { allowed: true };
  }

  private getOrCreate(map: Map<string, TokenBucketRateLimiter>, key: string, cap: number, rate: number) {
    if (!map.has(key)) map.set(key, new TokenBucketRateLimiter(cap, rate));
    return map.get(key)!;
  }
}`,
    recallHint: "Defense in depth: IP tier (DDoS) -> User tier (fair use) -> Endpoint tier (brute force protection).",
    practice: [
      "Implement a Chain of Responsibility where each middleware evaluates one rate-limiting tier",
      "Design tier fallback headers returning standard HTTP response headers (X-RateLimit-Remaining, Retry-After)"
    ],
    interviewTip: "In API gateway design questions, always proactively suggest multi-tier rate limiting (IP + User + Route) to showcase holistic production security awareness.",
    tags: ["Rate Limiter", "Multi-Tier", "Defense in Depth", "API Security"]
  }),

  createCard({
    idNum: 80,
    category,
    concept: "Circuit Breaker Pattern & Finite State Machine",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the Circuit Breaker pattern prevent cascading failures across microservices, and how do its 3 states operate?",
    answer: "A Circuit Breaker wraps calls to external dependencies. It has 3 states: 1. CLOSED: Normal operation; requests pass through. Failures increment a counter. 2. OPEN: When failure rate exceeds threshold (e.g. 50%), the breaker trips OPEN. All calls immediately fail fast without touching the broken dependency. 3. HALF-OPEN: After a timeout, a test probe is allowed. If successful, it resets to CLOSED; if it fails, it trips back to OPEN.",
    explanation: "If a downstream payment service goes down, upstream services keep waiting for 30-second timeouts. Incoming requests pile up, worker threads exhaust, and the entire system experiences a cascading crash. The Circuit Breaker fails fast in 0ms during outages, shedding load and giving the downstream service breathing room to recover.",
    code: `enum CircuitState { CLOSED, OPEN, HALF_OPEN }

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureThreshold: number;
  private resetTimeoutMs: number;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;

  constructor(failureThreshold: number = 3, resetTimeoutMs: number = 10000) {
    this.failureThreshold = failureThreshold;
    this.resetTimeoutMs = resetTimeoutMs;
  }

  public async execute<T>(action: () => Promise<T>): Promise<T> {
    const now = Date.now();

    // Check if OPEN breaker should transition to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      if (now - this.lastFailureTime > this.resetTimeoutMs) {
        console.log("[CircuitBreaker] Timeout elapsed. Entering HALF_OPEN state probe.");
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error("CircuitBreaker OPEN: Fast-failing downstream call!");
      }
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      console.log("[CircuitBreaker] Probe succeeded. Resetting to CLOSED state.");
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      console.warn("[CircuitBreaker] Failure threshold reached! Tripping to OPEN state.");
      this.state = CircuitState.OPEN;
    }
  }
}`,
    recallHint: "CLOSED (normal) -> failure threshold exceeded -> OPEN (fail fast) -> timeout -> HALF-OPEN (probe test).",
    practice: [
      "Combine Circuit Breaker with a Fallback Strategy (e.g. return cached recommendations when ML service trips)",
      "Explain Netflix Hystrix / Resilience4j sliding window failure metrics"
    ],
    interviewTip: "Pair Circuit Breaker with Fallback execution. When an interviewer asks what happens when the breaker is open, explain that the client returns a graceful fallback (cached data, default values).",
    tags: ["Resilience", "Circuit Breaker", "Fail Fast", "Fault Tolerance"]
  }),

  createCard({
    idNum: 81,
    category,
    concept: "Bulkhead Pattern (Failure Domain Isolation)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Bulkhead Pattern (inspired by ship hulls) and how does it prevent one misbehaving dependency from sinking the entire application?",
    answer: "The Bulkhead pattern partitions system resources (thread pools, connection pools, memory) into isolated compartments (bulkheads). If one downstream service (e.g. Analytics reporting) becomes slow or fails, its dedicated bulkhead exhausts, but other critical bulkheads (e.g. Payment processing, User login) continue operating unaffected.",
    explanation: "If a web server has a single shared pool of 200 HTTP worker threads, and the PDF export service hangs on 200 concurrent requests, all 200 threads become stuck waiting for PDFs. The entire server stops responding to login and payment requests. Bulkhead allocates 150 threads to Core, 30 to Payments, and 20 to Reporting.",
    code: `class BulkheadExecutor {
  private activeTasks: number = 0;
  private maxConcurrency: number;
  private queue: (() => void)[] = [];
  private maxQueue: number;

  constructor(maxConcurrency: number, maxQueue: number) {
    this.maxConcurrency = maxConcurrency;
    this.maxQueue = maxQueue;
  }

  public async run<T>(action: () => Promise<T>): Promise<T> {
    if (this.activeTasks >= this.maxConcurrency) {
      if (this.queue.length >= this.maxQueue) {
        throw new Error("Bulkhead saturated! Rejecting to protect host system.");
      }
      await new Promise(resolve => this.queue.push(resolve));
    }

    this.activeTasks++;
    try {
      return await action();
    } finally {
      this.activeTasks--;
      if (this.queue.length > 0) {
        const next = this.queue.shift()!;
        next();
      }
    }
  }
}

// Separate bulkheads per dependency:
const paymentBulkhead = new BulkheadExecutor(50, 100);
const analyticsBulkhead = new BulkheadExecutor(10, 20); // Analytics can NEVER consume payment threads!`,
    recallHint: "Partition resources into separate pools; failure in one compartment doesn't sink the entire ship.",
    practice: [
      "Implement thread pool isolation in Java using multiple ThreadPoolExecutor instances",
      "Contrast Bulkhead (resource partition) with Circuit Breaker (temporal fail-fast)"
    ],
    interviewTip: "Always mention both Circuit Breaker AND Bulkhead together when asked about high availability and microservice fault tolerance.",
    tags: ["Resilience", "Bulkhead Pattern", "Fault Isolation", "Resource Allocation"]
  }),

  createCard({
    idNum: 82,
    category,
    concept: "Retry with Exponential Backoff & Full Jitter",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why does naive retry logic cause distributed self-inflicted DDoS attacks, and how does Exponential Backoff with Full Jitter solve it?",
    answer: "Naive retries retry immediately or at fixed intervals. If an API has a transient hiccup, 10,000 clients retry simultaneously in lockstep, creating synchronized retry waves that crash the recovering server (retry storm). Exponential Backoff doubles the wait time after each failure, while Full Jitter randomizes the sleep interval: `sleep = random(0, base * 2^attempt)` to decorrelate traffic.",
    explanation: "AWS research proved that Exponential Backoff alone still causes clustered retry pulses. Adding Full Jitter completely smooths the arrival rate of retried requests across the time spectrum, maximizing system recovery capacity.",
    code: `class RetryWithJitter {
  public static async execute<T>(
    action: () => Promise<T>,
    maxRetries: number = 4,
    baseDelayMs: number = 200,
    maxDelayMs: number = 5000
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await action();
      } catch (error) {
        attempt++;
        if (attempt > maxRetries) {
          throw new Error(\`Operation failed after \${maxRetries} retries: \${error}\`);
        }

        // Calculate Exponential Backoff ceiling: base * 2^attempt
        const expCeiling = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));

        // Full Jitter: Uniform random between 0 and expCeiling
        const sleepDuration = Math.random() * expCeiling;

        console.log(\`[Retry] Attempt \${attempt} failed. Sleeping for \${Math.floor(sleepDuration)}ms...\`);
        await new Promise(resolve => setTimeout(resolve, sleepDuration));
      }
    }
  }
}`,
    recallHint: "Sleep = random(0, base * 2^attempt); decorrelates retry pulses to eliminate thundering herd storms.",
    practice: [
      "Implement Decorrelated Jitter (sleep = min(maxDelay, random(base, prevSleep * 3)))",
      "Add idempotent retry filters so POST requests without idempotency keys are never retried"
    ],
    interviewTip: "Never propose retries without explicitly specifying: 1. Exponential Backoff, 2. Full Jitter, and 3. Idempotency guarantees.",
    tags: ["Resilience", "Retry Pattern", "Exponential Backoff", "Jitter"]
  }),

  createCard({
    idNum: 83,
    category,
    concept: "Adaptive Throttling & Client-Side Backpressure",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Adaptive Throttling (as defined in Google SRE Book) and how do clients self-throttle before sending requests?",
    answer: "Adaptive Throttling is client-side backpressure. Clients track the total requests sent (`requests`) and successful responses received (`accepts`) over a rolling window. When the backend failure rate increases, the client probabilistically drops a percentage of its own outbound requests locally: $P = \\max(0, \\frac{\\text{requests} - K \\times \\text{accepts}}{\\text{requests} + 1})$, saving network bandwidth.",
    explanation: "If a server is rejecting 90% of requests with 503 or 429, continuing to send 100,000 requests/sec burns network bandwidth, CPU serialization, and TLS handshakes. The client calculates that the server is overloaded and drops requests client-side before they ever touch the network wire, enabling the server to stabilize.",
    code: `class AdaptiveClientThrottler {
  private requests: number = 0;
  private accepts: number = 0;
  private kMultiplier: number; // Google SRE recommended K = 2.0 (allows 2x headroom)

  constructor(kMultiplier: number = 2.0) {
    this.kMultiplier = kMultiplier;
  }

  public shouldAllowClientRequest(): boolean {
    this.requests++;
    // Calculate client-side drop probability
    const dropProbability = Math.max(
      0,
      (this.requests - this.kMultiplier * this.accepts) / (this.requests + 1)
    );

    if (Math.random() < dropProbability) {
      console.warn("[AdaptiveThrottling] Dropped locally to protect overloaded backend!");
      return false; // Throttled client-side without network packet!
    }
    return true;
  }

  public recordResponse(isSuccess: boolean): void {
    if (isSuccess) this.accepts++;
  }
}`,
    recallHint: "Client probabilistically drops its own requests when backend rejects increase; saves network wire.",
    practice: [
      "Simulate a backend outage and observe Adaptive Throttling drop rates stabilize traffic",
      "Contrast Adaptive Throttling with Reactive Streams backpressure (pull vs push)"
    ],
    interviewTip: "Citing Google's SRE Book Adaptive Throttling formula is an extraordinary flex in Senior/Staff LLD and Distributed Systems interviews.",
    tags: ["Resilience", "Adaptive Throttling", "Backpressure", "Google SRE"]
  }),

  createCard({
    idNum: 84,
    category,
    concept: "Idempotency Key Engine & Deduplication",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you design an In-Memory Idempotency Key Engine to guarantee exactly-once execution of payment operations?",
    answer: "The client generates a unique `Idempotency-Key` (UUIDv4) and includes it in request headers. The server checks an in-memory store: 1. If key is missing, insert with state 'PROCESSING' and execute operation. 2. If key exists with state 'PROCESSING', reject with 409 Conflict (in-flight duplicate). 3. If key exists with state 'COMPLETED', return cached response immediately without re-executing.",
    explanation: "If a network timeout occurs while charging a credit card, the client doesn't know if the charge succeeded. The client retries the same request with the identical Idempotency-Key. The server detects that the charge already finished, returns the previous payment receipt, and never charges the user's card twice.",
    code: `interface IdempotencyRecord {
  status: "PROCESSING" | "COMPLETED";
  response?: any;
  createdAt: number;
}

class IdempotencyEngine {
  private store: Map<string, IdempotencyRecord> = new Map();

  public async executeIdempotent<T>(
    idempotencyKey: string,
    action: () => Promise<T>
  ): Promise<T> {
    const existing = this.store.get(idempotencyKey);

    if (existing) {
      if (existing.status === "PROCESSING") {
        throw new Error("409 Conflict: Concurrent duplicate request in progress");
      }
      if (existing.status === "COMPLETED") {
        console.log(\`[Idempotency] Returning cached response for key: \${idempotencyKey}\`);
        return existing.response;
      }
    }

    // Mark as PROCESSING
    this.store.set(idempotencyKey, { status: "PROCESSING", createdAt: Date.now() });

    try {
      const result = await action();
      // Cache completed response
      this.store.set(idempotencyKey, {
        status: "COMPLETED",
        response: result,
        createdAt: Date.now()
      });
      return result;
    } catch (error) {
      this.store.delete(idempotencyKey); // Allow retry on fatal failure
      throw error;
    }
  }
}`,
    recallHint: "Check key -> PROCESSING returns 409 -> COMPLETED returns cached result -> missing executes action.",
    practice: [
      "Implement TTL expiration for idempotency keys to bound memory growth",
      "Explain how distributed payment gateways (Stripe) enforce idempotency using Redis and Postgres"
    ],
    interviewTip: "Any payment, ordering, or financial transfer system design MUST include an Idempotency Key mechanism to protect against double-charging on network retries.",
    tags: ["Idempotency", "Payment Systems", "Deduplication", "API Design"]
  })
];
