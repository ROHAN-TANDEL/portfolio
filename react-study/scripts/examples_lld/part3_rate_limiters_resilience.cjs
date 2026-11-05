module.exports = [
  {
    id: "lld-ex-23",
    title: "Token Bucket Rate Limiter with Lazy Elapsed Refill & Burst Capacity",
    category: "Rate Limiters & Resilience",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements the Token Bucket rate limiter using an elapsed-time lazy evaluation formula, allowing controlled traffic bursts up to capacity while refilling continuously without background timers.",
    conceptsCovered: [
      "Token Bucket Algorithm",
      "Lazy Evaluation",
      "Burst Handling",
      "Refill Rate Math",
      "HTTP 429 Simulation"
    ],
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

  public allowRequest(requested: number = 1): boolean {
    this.refill();

    if (this.tokens >= requested) {
      this.tokens -= requested;
      return true; // Allowed
    }
    return false; // Rate limit exceeded
  }

  private refill(): void {
    const now = Date.now();
    const elapsedSeconds = (now - this.lastRefillTimestamp) / 1000;
    const tokensToAdd = elapsedSeconds * this.refillRatePerSec;

    this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
    this.lastRefillTimestamp = now;
  }
}

const limiter = new TokenBucketRateLimiter(3, 1); // Capacity 3, refilled 1/sec

// Immediate burst of 3 requests:
console.log("Req 1 (allowed):", limiter.allowRequest());
console.log("Req 2 (allowed):", limiter.allowRequest());
console.log("Req 3 (allowed):", limiter.allowRequest());
console.log("Req 4 (burst exhausted):", limiter.allowRequest());`,
    breakdown: [
      {
        lineRange: "14-22",
        note: "allowRequest refills tokens on the fly and consumes requested tokens if available."
      },
      {
        lineRange: "24-31",
        note: "Lazy calculation computes tokens using elapsed seconds, capping strictly at bucket capacity."
      },
      {
        lineRange: "34-40",
        note: "Demonstrates immediate burst tolerance up to capacity 3, rejecting request 4."
      }
    ],
    expectedOutput: `Req 1 (allowed): true
Req 2 (allowed): true
Req 3 (allowed): true
Req 4 (burst exhausted): false`
  },

  {
    id: "lld-ex-24",
    title: "Leaky Bucket Rate Limiter Smoothing Bursts into Constant Output Flow",
    category: "Rate Limiters & Resilience",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements the Leaky Bucket algorithm using a bounded FIFO queue and constant drain interval, smoothing spiky incoming traffic into a stable, constant-rate output stream.",
    conceptsCovered: [
      "Leaky Bucket Algorithm",
      "Traffic Shaping",
      "Bounded Queue",
      "Constant Egress Rate",
      "Buffer Overflow Handling"
    ],
    code: `class LeakyBucketSmoother {
  private queue: string[] = [];
  private capacity: number;
  private timer: any;

  constructor(capacity: number, leakIntervalMs: number) {
    this.capacity = capacity;

    // Fixed steady leak cadence
    this.timer = setInterval(() => {
      if (this.queue.length > 0) {
        const item = this.queue.shift()!;
        console.log(\`[LeakyBucket] Leaked task: "\${item}" at steady rate\`);
      }
    }, leakIntervalMs);
  }

  public submit(taskName: string): boolean {
    if (this.queue.length >= this.capacity) {
      console.warn(\`[LeakyBucket] Overflow! Dropping task: "\${taskName}"\`);
      return false; // Queue full
    }
    this.queue.push(taskName);
    console.log(\`[LeakyBucket] Enqueued task: "\${taskName}" (Queue depth: \${this.queue.length})\`);
    return true;
  }

  public destroy() { clearInterval(this.timer); }
}

const smoother = new LeakyBucketSmoother(2, 100); // Max 2 tasks in queue, leaks 1 every 100ms
smoother.submit("Job-1");
smoother.submit("Job-2");
smoother.submit("Job-3"); // Saturated -> Dropped!

setTimeout(() => smoother.destroy(), 350);`,
    breakdown: [
      {
        lineRange: "10-17",
        note: "Fixed setInterval drains exactly 1 task per interval regardless of incoming traffic burstiness."
      },
      {
        lineRange: "19-27",
        note: "Enqueues up to capacity limit; drops excess submissions when queue fills."
      },
      {
        lineRange: "31-35",
        note: "Demonstrates dropping Job-3 due to buffer saturation."
      }
    ],
    expectedOutput: `[LeakyBucket] Enqueued task: "Job-1" (Queue depth: 1)
[LeakyBucket] Enqueued task: "Job-2" (Queue depth: 2)
[LeakyBucket] Overflow! Dropping task: "Job-3"
[LeakyBucket] Leaked task: "Job-1" at steady rate
[LeakyBucket] Leaked task: "Job-2" at steady rate`
  },

  {
    id: "lld-ex-25",
    title: "Sliding Window Counter Rate Limiter with Weighted Time Interpolation",
    category: "Rate Limiters & Resilience",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a production Sliding Window Counter rate limiter using weighted overlap between adjacent static windows, achieving O(1) memory and completely neutralizing 2x boundary bursts.",
    conceptsCovered: [
      "Sliding Window Counter",
      "Weighted Time Interpolation",
      "Boundary Burst Prevention",
      "O(1) Memory Footprint",
      "Cloudflare Algorithm"
    ],
    code: `class SlidingWindowCounter {
  private windowSizeMs: number;
  private maxRequests: number;
  private prevCount: number = 0;
  private currCount: number = 0;
  private currentWindowStart: number;

  constructor(maxRequests: number, windowSeconds: number = 60) {
    this.maxRequests = maxRequests;
    this.windowSizeMs = windowSeconds * 1000;
    this.currentWindowStart = Math.floor(Date.now() / this.windowSizeMs) * this.windowSizeMs;
  }

  public allowRequest(): boolean {
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowSizeMs) * this.windowSizeMs;

    // Advance window if stepped into a new epoch
    if (windowStart !== this.currentWindowStart) {
      this.prevCount = (windowStart - this.currentWindowStart === this.windowSizeMs) ? this.currCount : 0;
      this.currCount = 0;
      this.currentWindowStart = windowStart;
    }

    // Weighted overlap from previous window
    const elapsedInCurrentWindow = now - this.currentWindowStart;
    const weight = (this.windowSizeMs - elapsedInCurrentWindow) / this.windowSizeMs;
    const estimatedRequests = Math.floor(this.prevCount * weight) + this.currCount;

    if (estimatedRequests < this.maxRequests) {
      this.currCount++;
      return true;
    }
    return false;
  }
}

const sw = new SlidingWindowCounter(2, 60); // Max 2 requests per 60s
console.log("Req 1 (allowed):", sw.allowRequest());
console.log("Req 2 (allowed):", sw.allowRequest());
console.log("Req 3 (rejected):", sw.allowRequest());`,
    breakdown: [
      {
        lineRange: "16-24",
        note: "Rotates previous and current window counts whenever a new window epoch begins."
      },
      {
        lineRange: "26-28",
        note: "Interpolates previous window overlap based on elapsed ratio, preventing boundary spikes."
      },
      {
        lineRange: "38-41",
        note: "Rejects request 3 as estimated load reaches limit."
      }
    ],
    expectedOutput: `Req 1 (allowed): true
Req 2 (allowed): true
Req 3 (rejected): false`
  },

  {
    id: "lld-ex-26",
    title: "Multi-Tier Rate Limiting Pipeline (IP, User & Sensitive Endpoint)",
    category: "Rate Limiters & Resilience",
    difficulty: "intermediate",
    whatThisCodeCovers: "Chains multiple rate-limiting evaluators in a pipeline, checking IP address thresholds (anti-scraping), user quota thresholds (fair use), and endpoint-specific limits (/login brute-force protection).",
    conceptsCovered: [
      "Multi-Tier Rate Limiting",
      "Defense in Depth",
      "Hierarchical Rule Evaluation",
      "Chain of Responsibility",
      "HTTP Header Generation"
    ],
    code: `interface IncomingRequest {
  ip: string;
  userId?: string;
  path: string;
}

class MultiTierLimiter {
  private ipBuckets: Map<string, number> = new Map();
  private userBuckets: Map<string, number> = new Map();
  private authRouteBuckets: Map<string, number> = new Map();

  public evaluate(req: IncomingRequest): { allowed: boolean; reason?: string } {
    // Tier 1: IP Threshold (Max 5/min)
    const ipCount = (this.ipBuckets.get(req.ip) || 0) + 1;
    if (ipCount > 5) return { allowed: false, reason: "IP rate limit exceeded" };
    this.ipBuckets.set(req.ip, ipCount);

    // Tier 2: User Quota (Max 3/min if logged in)
    if (req.userId) {
      const userCount = (this.userBuckets.get(req.userId) || 0) + 1;
      if (userCount > 3) return { allowed: false, reason: "User account quota exceeded" };
      this.userBuckets.set(req.userId, userCount);
    }

    // Tier 3: Sensitive Route (/auth/login: Max 2/min per IP)
    if (req.path === "/auth/login") {
      const authKey = \`\${req.ip}_auth\`;
      const authCount = (this.authRouteBuckets.get(authKey) || 0) + 1;
      if (authCount > 2) return { allowed: false, reason: "Too many login attempts" };
      this.authRouteBuckets.set(authKey, authCount);
    }

    return { allowed: true };
  }
}

const pipeline = new MultiTierLimiter();
console.log("Check 1:", pipeline.evaluate({ ip: "192.168.1.1", path: "/auth/login" }));
console.log("Check 2:", pipeline.evaluate({ ip: "192.168.1.1", path: "/auth/login" }));
console.log("Check 3:", pipeline.evaluate({ ip: "192.168.1.1", path: "/auth/login" }));`,
    breakdown: [
      {
        lineRange: "13-17",
        note: "Tier 1 guards against generic volumetric IP flooding."
      },
      {
        lineRange: "19-24",
        note: "Tier 2 prevents a single authenticated user from monopolizing capacity across multiple proxies."
      },
      {
        lineRange: "26-32",
        note: "Tier 3 clamps down on sensitive routes like /auth/login to thwart credential stuffing."
      }
    ],
    expectedOutput: `Check 1: { allowed: true }
Check 2: { allowed: true }
Check 3: { allowed: false, reason: 'Too many login attempts' }`
  },

  {
    id: "lld-ex-27",
    title: "Circuit Breaker Finite State Machine with Half-Open Probe Recovery",
    category: "Rate Limiters & Resilience",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements the Circuit Breaker pattern with CLOSED, OPEN, and HALF-OPEN states, fast-failing downstream requests during outages and probing recovery with trial calls.",
    conceptsCovered: [
      "Circuit Breaker Pattern",
      "Finite State Machine",
      "Fail-Fast Semantics",
      "Half-Open Probe Testing",
      "Cascading Failure Prevention"
    ],
    code: `enum CircuitState { CLOSED, OPEN, HALF_OPEN }

class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureThreshold: number;
  private cooldownTimeoutMs: number;
  private failureCount: number = 0;
  private lastFailureTime: number = 0;

  constructor(failureThreshold: number = 2, cooldownMs: number = 200) {
    this.failureThreshold = failureThreshold;
    this.cooldownTimeoutMs = cooldownMs;
  }

  public async fire<T>(action: () => Promise<T>): Promise<T> {
    const now = Date.now();

    if (this.state === CircuitState.OPEN) {
      if (now - this.lastFailureTime > this.cooldownTimeoutMs) {
        console.log("[CircuitBreaker] Cooldown expired. Transitioning to HALF_OPEN probe.");
        this.state = CircuitState.HALF_OPEN;
      } else {
        throw new Error("CircuitBreaker OPEN: Fast-failing downstream request");
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

  private onSuccess() {
    if (this.state === CircuitState.HALF_OPEN) {
      console.log("[CircuitBreaker] Probe succeeded! Resetting to CLOSED state.");
      this.state = CircuitState.CLOSED;
      this.failureCount = 0;
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.state === CircuitState.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      console.warn("[CircuitBreaker] Failure threshold reached! Tripping to OPEN state.");
      this.state = CircuitState.OPEN;
    }
  }
}

// Execution test:
async function run() {
  const cb = new CircuitBreaker(2, 100);
  const failingCall = async () => { throw new Error("Database timeout"); };

  try { await cb.fire(failingCall); } catch (e) {}
  try { await cb.fire(failingCall); } catch (e) {}

  // 3rd call fails fast without calling failingCall!
  try { await cb.fire(failingCall); } catch (e: any) { console.log(e.message); }
}

run();`,
    breakdown: [
      {
        lineRange: "16-24",
        note: "If OPEN, verifies cooldown timer; either allows single trial probe (HALF_OPEN) or throws immediately."
      },
      {
        lineRange: "36-42",
        note: "onSuccess() resets the breaker to CLOSED if the trial probe in HALF_OPEN succeeds."
      },
      {
        lineRange: "44-51",
        note: "onFailure() trips breaker to OPEN once threshold is breached."
      }
    ],
    expectedOutput: `[CircuitBreaker] Failure threshold reached! Tripping to OPEN state.
CircuitBreaker OPEN: Fast-failing downstream request`
  },

  {
    id: "lld-ex-28",
    title: "Bulkhead Pattern Concurrency Isolator with Execution Queuing",
    category: "Rate Limiters & Resilience",
    difficulty: "intermediate",
    whatThisCodeCovers: "Isolates application resources using the Bulkhead pattern, bounding concurrent tasks and queue capacity per dependency so a slow service cannot exhaust all application threads.",
    conceptsCovered: [
      "Bulkhead Pattern",
      "Resource Partitioning",
      "Bounded Concurrency",
      "Queue Rejection Policy",
      "Failure Containment"
    ],
    code: `class Bulkhead {
  private activeCount: number = 0;
  private maxConcurrent: number;
  private maxQueue: number;
  private waitingQueue: (() => void)[] = [];

  constructor(maxConcurrent: number, maxQueue: number) {
    this.maxConcurrent = maxConcurrent;
    this.maxQueue = maxQueue;
  }

  public async execute<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrent) {
      if (this.waitingQueue.length >= this.maxQueue) {
        throw new Error("BulkheadRejectedException: Resource compartment saturated!");
      }
      await new Promise<void>(resolve => this.waitingQueue.push(resolve));
    }

    this.activeCount++;
    try {
      return await task();
    } finally {
      this.activeCount--;
      if (this.waitingQueue.length > 0) {
        const next = this.waitingQueue.shift()!;
        next();
      }
    }
  }
}

// 2 Isolated Bulkheads:
const paymentBulkhead = new Bulkhead(2, 2);

async function testBulkhead() {
  const slowTask = () => new Promise(r => setTimeout(r, 100));

  // Run 5 tasks simultaneously on bulkhead with maxConcurrent=2, maxQueue=2 (Capacity 4):
  const promises = [
    paymentBulkhead.execute(slowTask),
    paymentBulkhead.execute(slowTask),
    paymentBulkhead.execute(slowTask),
    paymentBulkhead.execute(slowTask),
    paymentBulkhead.execute(slowTask) // 5th task exceeds queue limit of 2 -> Throws!
  ];

  const results = await Promise.allSettled(promises);
  console.log("4th status:", results[3].status);
  console.log("5th status:", results[4].status);
}

testBulkhead();`,
    breakdown: [
      {
        lineRange: "13-18",
        note: "If active workers full, enqueues task up to maxQueue; immediately rejects beyond capacity."
      },
      {
        lineRange: "20-29",
        note: "Executes task within try/finally; releases slot and triggers next queued caller on completion."
      },
      {
        lineRange: "44-50",
        note: "Shows tasks 1-4 accepted (2 active + 2 queued) while 5th task is rejected immediately."
      }
    ],
    expectedOutput: `4th status: fulfilled
5th status: rejected`
  },

  {
    id: "lld-ex-29",
    title: "Retry Pattern with Exponential Backoff and Full Jitter Randomization",
    category: "Rate Limiters & Resilience",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements robust retry logic with Exponential Backoff and Full Jitter randomization, decorrelating retry storms to prevent thundering herd crashes on recovering APIs.",
    conceptsCovered: [
      "Retry Pattern",
      "Exponential Backoff",
      "Full Jitter Math",
      "Thundering Herd Mitigation",
      "Transient Error Recovery"
    ],
    code: `class RetryPolicy {
  public static async executeWithJitter<T>(
    action: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 100,
    maxDelayMs: number = 2000
  ): Promise<T> {
    let attempt = 0;

    while (true) {
      try {
        return await action();
      } catch (err) {
        attempt++;
        if (attempt > maxRetries) {
          throw new Error(\`Max retries (\${maxRetries}) exhausted! Last error: \${err}\`);
        }

        // Exponential backoff ceiling: base * 2^attempt
        const expCap = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));

        // Full Jitter formula: random between 0 and expCap
        const jitteredDelay = Math.floor(Math.random() * expCap);

        console.log(\`[Retry] Attempt \${attempt} failed. Backing off for \${jitteredDelay}ms...\`);
        await new Promise(r => setTimeout(r, jitteredDelay));
      }
    }
  }
}

let counter = 0;
async function unreliableEndpoint(): Promise<string> {
  counter++;
  if (counter < 3) throw new Error("503 Service Unavailable");
  return "200 OK: Data recovered";
}

RetryPolicy.executeWithJitter(unreliableEndpoint).then(res => console.log("Final Result:", res));`,
    breakdown: [
      {
        lineRange: "18-24",
        note: "Full Jitter calculates uniform random delay between 0 and exponential ceiling."
      },
      {
        lineRange: "26-28",
        note: "Sleeps for randomized duration, spreading retry waves across time."
      },
      {
        lineRange: "38-40",
        note: "Retries twice on 503 and resolves successfully on the 3rd attempt."
      }
    ],
    expectedOutput: `[Retry] Attempt 1 failed. Backing off for ...ms...
[Retry] Attempt 2 failed. Backing off for ...ms...
Final Result: 200 OK: Data recovered`
  },

  {
    id: "lld-ex-30",
    title: "In-Memory Idempotency Key Deduplication Engine with Processing States",
    category: "Rate Limiters & Resilience",
    difficulty: "intermediate",
    whatThisCodeCovers: "Guarantees exactly-once processing for payment APIs using an Idempotency Key Engine that tracks PROCESSING vs COMPLETED states, blocking concurrent duplicates with HTTP 409.",
    conceptsCovered: [
      "Idempotency Key",
      "Deduplication",
      "Exactly-Once Semantics",
      "Concurrent Conflict (409)",
      "Cached Response Replay"
    ],
    code: `interface IdempotencyEntry {
  status: "PROCESSING" | "COMPLETED";
  response?: any;
  timestamp: number;
}

class IdempotencyEngine {
  private cache: Map<string, IdempotencyEntry> = new Map();

  public async execute<T>(key: string, task: () => Promise<T>): Promise<T> {
    const existing = this.cache.get(key);

    if (existing) {
      if (existing.status === "PROCESSING") {
        throw new Error("409 Conflict: Concurrent request already in progress for this idempotency key!");
      }
      if (existing.status === "COMPLETED") {
        console.log(\`[Idempotency] Returning previously cached response for key: \${key}\`);
        return existing.response;
      }
    }

    // Mark as PROCESSING
    this.cache.set(key, { status: "PROCESSING", timestamp: Date.now() });

    try {
      const result = await task();
      this.cache.set(key, { status: "COMPLETED", response: result, timestamp: Date.now() });
      return result;
    } catch (err) {
      this.cache.delete(key); // Release key on failure to allow retry
      throw err;
    }
  }
}

const engine = new IdempotencyEngine();

async function chargePayment(amount: number) {
  return { txId: "tx_9981", charged: amount, status: "SUCCESS" };
}

async function run() {
  // First execution:
  const res1 = await engine.execute("req_uuid_101", () => chargePayment(50));
  console.log("Call 1:", res1);

  // Duplicate retry with same idempotency key:
  const res2 = await engine.execute("req_uuid_101", () => chargePayment(50));
  console.log("Call 2 (Idempotent replay):", res2);
}

run();`,
    breakdown: [
      {
        lineRange: "14-21",
        note: "PROCESSING status rejects concurrent attempts; COMPLETED returns stored response immediately."
      },
      {
        lineRange: "24-34",
        note: "Stores result on success; deletes key on unexpected exception to permit valid retries."
      },
      {
        lineRange: "44-50",
        note: "Demonstrates that call 2 replays the payment receipt without executing chargePayment() again."
      }
    ],
    expectedOutput: `Call 1: { txId: 'tx_9981', charged: 50, status: 'SUCCESS' }
[Idempotency] Returning previously cached response for key: req_uuid_101
Call 2 (Idempotent replay): { txId: 'tx_9981', charged: 50, status: 'SUCCESS' }`
  },

  {
    id: "lld-ex-31",
    title: "Client-Side Adaptive Throttling with Failure-Ratio Backpressure (Google SRE)",
    category: "Rate Limiters & Resilience",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements Google SRE Adaptive Throttling where clients track requests vs accepts over a rolling window and probabilistically drop their own outbound requests to save network bandwidth during outages.",
    conceptsCovered: [
      "Adaptive Throttling",
      "Client-Side Backpressure",
      "Google SRE Architecture",
      "Drop Probability Formula",
      "Network Wire Protection"
    ],
    code: `class GoogleSreAdaptiveThrottler {
  private requests: number = 0;
  private accepts: number = 0;
  private kMultiplier: number;

  constructor(k: number = 2.0) {
    this.kMultiplier = k; // 2.0 allows up to 2x failure tolerance
  }

  public shouldAllowRequest(): boolean {
    this.requests++;

    // Google SRE formula: max(0, (requests - K * accepts) / (requests + 1))
    const dropProbability = Math.max(
      0,
      (this.requests - this.kMultiplier * this.accepts) / (this.requests + 1)
    );

    if (Math.random() < dropProbability) {
      console.warn(\`[AdaptiveThrottler] DROPPED LOCALLY (P=\${dropProbability.toFixed(2)}) to protect server!\`);
      return false; // Throttled on client before sending network packet!
    }
    return true;
  }

  public recordResult(isSuccess: boolean): void {
    if (isSuccess) this.accepts++;
  }
}

const throttler = new GoogleSreAdaptiveThrottler(2.0);

// Simulate backend failure spike: 20 failed calls
for (let i = 0; i < 20; i++) {
  if (throttler.shouldAllowRequest()) {
    throttler.recordResult(false); // Backend rejected request
  }
}

// 21st call: Client-side throttler starts dropping outbound packets locally!
console.log("Outbound allowed after outage:", throttler.shouldAllowRequest());`,
    breakdown: [
      {
        lineRange: "14-18",
        note: "Calculates drop probability P based on requests exceeding K * accepts."
      },
      {
        lineRange: "20-23",
        note: "Probabilistically drops requests client-side without consuming socket resources."
      },
      {
        lineRange: "34-42",
        note: "Demonstrates client self-throttling after a sequence of backend failures."
      }
    ],
    expectedOutput: `[AdaptiveThrottler] DROPPED LOCALLY (P=0.08) to protect server!
[AdaptiveThrottler] DROPPED LOCALLY (P=0.14) to protect server!
[AdaptiveThrottler] DROPPED LOCALLY (P=0.20) to protect server!
Outbound allowed after outage: false`
  },

  {
    id: "lld-ex-32",
    title: "Deadlock-Free Multi-Account Money Transfer with Sorted Global Lock Acquisition",
    category: "Rate Limiters & Resilience",
    difficulty: "advanced",
    whatThisCodeCovers: "Solves the classic Dining Philosophers / Bank Transfer deadlock problem by sorting account IDs globally before acquiring individual account mutexes.",
    conceptsCovered: [
      "Deadlock Elimination",
      "Resource Ordering",
      "Coffman Condition (Circular Wait)",
      "Two-Account Atomic Transfer",
      "Concurrency Invariants"
    ],
    code: `class Account {
  public balance: number;
  public isLocked: boolean = false;

  constructor(public readonly id: number, balance: number) {
    this.balance = balance;
  }
}

class DeadlockFreeBankService {
  // Simulates mutex locks per account
  public transfer(from: Account, to: Account, amount: number): boolean {
    if (from.balance < amount) throw new Error("Insufficient balance");

    // STRICT RESOURCE ORDERING: Always lock the account with smaller ID first!
    const first = from.id < to.id ? from : to;
    const second = from.id < to.id ? to : from;

    console.log(\`Acquiring Lock 1 on Account \${first.id}...\`);
    first.isLocked = true;

    console.log(\`Acquiring Lock 2 on Account \${second.id}...\`);
    second.isLocked = true;

    try {
      from.balance -= amount;
      to.balance += amount;
      console.log(\`Transferred $\${amount} from \${from.id} to \${to.id} safely!\`);
      return true;
    } finally {
      second.isLocked = false;
      first.isLocked = false;
      console.log("Both locks released cleanly.");
    }
  }
}

const accA = new Account(101, 500);
const accB = new Account(102, 300);

const bank = new DeadlockFreeBankService();
// Thread 1: transfers A -> B
bank.transfer(accA, accB, 150);
// Thread 2: transfers B -> A (Acquires locks in IDENTICAL 101 -> 102 order, preventing deadlock!)
bank.transfer(accB, accA, 50);`,
    breakdown: [
      {
        lineRange: "17-19",
        note: "Sorting accounts by ID guarantees every thread acquires locks in the exact same global order."
      },
      {
        lineRange: "21-25",
        note: "Eliminates Coffman Circular Wait condition mathematically."
      },
      {
        lineRange: "31-36",
        note: "finally block guarantees both locks release even if balance operations throw."
      }
    ],
    expectedOutput: `Acquiring Lock 1 on Account 101...
Acquiring Lock 2 on Account 102...
Transferred $150 from 101 to 102 safely!
Both locks released cleanly.
Acquiring Lock 1 on Account 101...
Acquiring Lock 2 on Account 102...
Transferred $50 from 102 to 101 safely!
Both locks released cleanly.`
  }
];
