const fs = require('fs');
const path = require('path');

const productionRunbooks = [
  {
    id: "lld-prod-01",
    topic: "Deadlocks and Lock Inversions in Multi-Resource Concurrent Transfers",
    category: "Concurrency & Synchronization",
    severity: "Critical / Application Thread Freeze",
    theProblem: "When transferring money between accounts or booking multiple hotel rooms/seats simultaneously, threads lock resources in differing orders. If Thread 1 locks Account A then Account B, while Thread 2 concurrently locks Account B then Account A, both threads freeze indefinitely in a Circular Wait deadlock, hanging web server worker threads until thread pool starvation halts the entire service.",
    howItWorksInternally: "Deadlock occurs when the 4 Coffman conditions are simultaneously met: Mutual Exclusion, Hold and Wait, No Preemption, and Circular Wait. In an un-ordered transfer, Thread 1 obtains the mutex for Account 101 and attempts to acquire Account 102. Concurrently, Thread 2 acquires Account 102 and attempts to acquire Account 101. The OS kernel puts both threads to sleep waiting for the other's lock release. Because neither thread can proceed to release its held lock, both remain permanently suspended in uninterruptible sleep.",
    productionCode: `// Production Solution: Global Natural Resource Ordering
class BankAccount {
  constructor(public readonly id: number, public balanceCents: number) {}
}

class DeadlockFreeTransferEngine {
  public transfer(from: BankAccount, to: BankAccount, amountCents: number): void {
    if (from.id === to.id) throw new Error("Cannot transfer to identical account");

    // Enforce GLOBAL LEXICOGRAPHICAL ORDERING across all threads:
    // Always lock the smaller ID first, then the larger ID!
    const firstLockTarget = from.id < to.id ? from : to;
    const secondLockTarget = from.id < to.id ? to : from;

    console.log(\`Acquiring Lock 1 on Account ID \${firstLockTarget.id}...\`);
    console.log(\`Acquiring Lock 2 on Account ID \${secondLockTarget.id}...\`);

    try {
      if (from.balanceCents < amountCents) throw new Error("Insufficient funds");
      from.balanceCents -= amountCents;
      to.balanceCents += amountCents;
      console.log(\`Transferred $\${amountCents / 100} safely without deadlock hazard.\`);
    } finally {
      console.log(\`Releasing Lock 2 on Account ID \${secondLockTarget.id}...\`);
      console.log(\`Releasing Lock 1 on Account ID \${firstLockTarget.id}...\`);
    }
  }
}`,
    monitoringMetrics: [
      "JVM Thread count in BLOCKED / WAITING state > 10 [Severity: Critical]",
      "Thread dump analysis indicating 'Found one Java-level deadlock' [Severity: Critical]",
      "API request latency p99 spiking to maximum HTTP socket timeout (30s) [Severity: Critical]",
      "Database active transactions duration > 15s [Severity: High]"
    ],
    productionChecklist: [
      "Sort multi-resource lock acquisitions by unique ID ascending before acquiring mutexes.",
      "Always acquire locks within `try-finally` blocks to guarantee unlock on exceptions.",
      "Use `tryLock(timeout)` with a bounded wait timeout instead of unbounded blocking `lock()`.",
      "Run automated Thread Dump analysis in CI/CD stress tests using jstack or async-profiler.",
      "Avoid nesting synchronized blocks across distinct domain services."
    ]
  },

  {
    id: "lld-prod-02",
    topic: "High-Concurrency Double-Booking and Race Conditions in Seat Reservations",
    category: "Real-World System Modeling",
    severity: "Critical / Revenue Loss & Inventory Inconsistency",
    theProblem: "During concert or movie ticket flash sales, multiple users attempt to reserve the same popular VIP seats at the exact same millisecond. A check-then-act race condition occurs: User A and User B both verify `seat.isAvailable() === true` simultaneously; both proceed to complete payment, resulting in double-booking the exact same physical seat to two different customers.",
    howItWorksInternally: "In non-atomic check-then-act code, execution interleaves between the check (`if (seat.status == AVAILABLE)`) and the mutation (`seat.status = BOOKED`). Because checking and mutating are two separate instructions, context switching allows Thread 2 to inspect the seat before Thread 1 updates it. Without an atomic reservation primitive or database `SELECT ... FOR UPDATE` row lock, both threads proceed past the guard check.",
    productionCode: `// Production Solution: Atomic 2-Phase Seat Hold with TTL
enum SeatState { AVAILABLE, LOCKED, BOOKED }

class ProductionSeatManager {
  private seats: Map<string, { state: SeatState; userId: string | null; expiresAt: number }> = new Map();

  // Atomic reservation: checks and locks ALL requested seats simultaneously
  public tryAcquireSeatHold(seatIds: string[], userId: string, ttlMs: number = 600000): boolean {
    const now = Date.now();

    // PHASE 1: Verify 100% of requested seats are free of holds
    for (const id of seatIds) {
      const seat = this.seats.get(id);
      if (!seat) return false;
      const isLocked = seat.state === SeatState.LOCKED && now < seat.expiresAt;
      if (seat.state === SeatState.BOOKED || isLocked) {
        return false; // Abort completely if even 1 seat is held!
      }
    }

    // PHASE 2: Atomically lock all seats under the user's ID
    const expiry = now + ttlMs;
    for (const id of seatIds) {
      this.seats.set(id, { state: SeatState.LOCKED, userId, expiresAt: expiry });
    }
    return true;
  }
}`,
    monitoringMetrics: [
      "Rate of double-booking conflict exceptions > 0 [Severity: Critical]",
      "Seat hold TTL expiration rate > 30% [Severity: Medium]",
      "Concurrent seat hold rejection rate (HTTP 409 Conflict) spikes [Severity: High]",
      "Payment gateway refund rate caused by expired seat holds [Severity: High]"
    ],
    productionChecklist: [
      "Enforce an intermediate `LOCKED` state with an absolute TTL expiration timestamp.",
      "Ensure multi-seat reservations are strictly atomic: if 1 seat is unavailable, acquire zero seats.",
      "Use distributed locks (Redis Redlock / SETNX EX) or database row locks in multi-pod environments.",
      "Validate user ownership and TTL expiration inside the payment confirmation webhook before marking BOOKED.",
      "Automatically initiate payment refund workflows if payment succeeds after seat hold expiration."
    ]
  },

  {
    id: "lld-prod-03",
    topic: "Memory Leaks from Dangling Strong References in Observer & Event Registries",
    category: "Design Patterns & Memory Management",
    severity: "High / Gradual OOM Heap Exhaustion",
    theProblem: "Long-lived subjects (such as global EventBuses, StockTickers, or Window Managers) maintain strong references to short-lived observers (such as temporary UI dialogs or per-request listeners). If observers fail to explicitly unsubscribe when destroyed, the garbage collector cannot reclaim their memory (the Lapsed Listener Problem), resulting in unbounded heap growth and eventual OutOfMemoryError.",
    howItWorksInternally: "Garbage collectors determine object reachability via root reference chains. When a long-lived subject stores an observer in an internal `List<Observer>` or `Set<EventHandler>`, a strong pointer exists from root -> Subject -> Observer. Even if the application drops all other references to the Observer, the Subject's internal collection keeps the observer and its entire referenced object graph alive in heap memory forever.",
    productionCode: `// Production Solution: Auto-Disposable Subscription Tokens & WeakRefs
type EventCallback = (payload: any) => void;

class LeakSafeEventBus {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  // Returns a mandatory Disposable Subscription token
  public subscribe(event: string, callback: EventCallback): { unsubscribe: () => void } {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(callback);

    // RAII / Cleanup closure
    let isDisposed = false;
    return {
      unsubscribe: () => {
        if (!isDisposed) {
          set.delete(callback);
          if (set.size === 0) this.listeners.delete(event);
          isDisposed = true;
          console.log(\`[EventBus] Unsubscribed callback from event "\${event}". Memory freed.\`);
        }
      }
    };
  }
}`,
    monitoringMetrics: [
      "Total active observer count in EventBus growing monotonically without drops [Severity: High]",
      "JVM Old Generation memory utilization trending upward post-GC [Severity: Critical]",
      "Heap dump analysis showing high percentage of retained heap in listener collections [Severity: High]"
    ],
    productionChecklist: [
      "Always return a disposable `{ unsubscribe }` interface from subscription methods.",
      "Tie subscription lifecycles to component lifecycles (`onDestroy`, `componentWillUnmount`).",
      "Consider using `WeakReference` or `WeakSet` where observers can be garbage-collected automatically.",
      "Instrument metrics tracking active subscriber counts per topic to detect subscriber leaks in staging.",
      "Audit event listeners in code reviews for missing `removeListener()` or `unsubscribe()` calls."
    ]
  },

  {
    id: "lld-prod-04",
    topic: "Liskov Substitution Principle Violations Breaking Runtime Polymorphism",
    category: "Object-Oriented Design & Principles",
    severity: "High / Unhandled Runtime Exceptions",
    theProblem: "Subclasses override parent methods by throwing `UnsupportedOperationException`, returning null, or violating post-conditions (e.g. `ReadOnlyCollection` inheriting from `Collection` and throwing on `add()`, or `Ostrich` extending `Bird` and throwing on `fly()`). Client code written against the base abstraction unexpectedly crashes in production with unhandled runtime errors.",
    howItWorksInternally: "Polymorphism assumes behavioral equivalence: code written for type $T$ must function correctly when given any subtype $S$. When a subtype strengthens preconditions (demands stricter inputs) or weakens postconditions (fails to guarantee expected outputs/invariants), it breaks the contract established by the interface. Callers are forced to add defensive `instanceof` checks, polluting high-level business code and violating OCP.",
    productionCode: `// Anti-Pattern: LSP Violation
// class Bird { fly(): void { ... } }
// class Ostrich extends Bird { fly(): void { throw new Error("Ostriches cannot fly!"); } }

// Production Solution: Segregate Capabilities into Distinct Interfaces (ISP + LSP)
interface Bird {
  eat(): void;
  sleep(): void;
}

interface FlyingBird extends Bird {
  fly(): void; // Segregated capability
}

class Sparrow implements FlyingBird {
  eat() { console.log("Sparrow eating seeds"); }
  sleep() { console.log("Sparrow sleeping"); }
  fly() { console.log("Sparrow flying across trees"); }
}

class Ostrich implements Bird {
  eat() { console.log("Ostrich eating plants"); }
  sleep() { console.log("Ostrich sleeping on ground"); }
  // Does NOT implement FlyingBird; zero invalid fly() methods exist!
}

// Client functions declare exact requirements:
function migrateFlock(flock: FlyingBird[]) {
  flock.forEach(bird => bird.fly()); // 100% Safe: Compiler guarantees all members fly!
}`,
    monitoringMetrics: [
      "Count of UnsupportedOperationException in production logs > 0 [Severity: Critical]",
      "Prevalence of `instanceof` and down-casting checks in service classes [Severity: Medium]",
      "Subtype unit test assertion failures on base class contract test suites [Severity: High]"
    ],
    productionChecklist: [
      "Never override a method in a subclass by throwing an unsupported operation exception.",
      "Segregate capabilities into narrow interfaces (e.g. `Flyable`, `Readable`, `Writable`).",
      "Write contract tests: run the base class test suite against all concrete subclasses.",
      "Never weaken postconditions or strengthen preconditions in derived classes.",
      "Favor composition over inheritance to model capabilities dynamically."
    ]
  },

  {
    id: "lld-prod-05",
    topic: "State Pattern Explosions and Invalid Transitions in Distributed Order Workflows",
    category: "Behavioral Patterns & State Orchestration",
    severity: "Critical / Financial State Corruption",
    theProblem: "Order processing lifecycles (Created, Paid, Shipped, Delivered, Refunded, Cancelled) degenerate into chaotic states when concurrent webhooks or out-of-order events arrive. An order is marked `CANCELLED` by user request, but an asynchronous payment confirmation webhook arrives 200ms later and transitions the order back to `PAID`, dispatching goods to a user who already received a refund.",
    howItWorksInternally: "Without a formal Finite State Machine (FSM), state transitions are managed by ad-hoc setter calls (`order.setStatus('PAID')`). When distributed message queues deliver events out of order, or network retries fire duplicate webhooks, the entity transitions along illegal edges in the state graph. An FSM strictly rejects transitions that do not exist in the defined directed state transition matrix.",
    productionCode: `// Production Solution: Strict Directed State Machine Matrix
enum OrderStatus { CREATED, PAID, SHIPPED, DELIVERED, CANCELLED, REFUNDED }

class OrderStateMachine {
  // Formal Transition Matrix: Defines valid (fromState -> toStates[])
  private static readonly VALID_TRANSITIONS: Map<OrderStatus, Set<OrderStatus>> = new Map([
    [OrderStatus.CREATED, new Set([OrderStatus.PAID, OrderStatus.CANCELLED])],
    [OrderStatus.PAID, new Set([OrderStatus.SHIPPED, OrderStatus.REFUNDED])],
    [OrderStatus.SHIPPED, new Set([OrderStatus.DELIVERED])],
    [OrderStatus.DELIVERED, new Set([OrderStatus.REFUNDED])],
    [OrderStatus.CANCELLED, new Set()], // Terminal state: Zero outgoing transitions!
    [OrderStatus.REFUNDED, new Set()]   // Terminal state
  ]);

  private currentStatus: OrderStatus = OrderStatus.CREATED;

  public transitionTo(newStatus: OrderStatus): void {
    const allowed = OrderStateMachine.VALID_TRANSITIONS.get(this.currentStatus);
    if (!allowed || !allowed.has(newStatus)) {
      throw new Error(
        \`IllegalStateTransitionException: Cannot transition Order from \${OrderStatus[this.currentStatus]} to \${OrderStatus[newStatus]}!\`
      );
    }

    console.log(\`[Order FSM] Transitioning: \${OrderStatus[this.currentStatus]} -> \${OrderStatus[newStatus]}\`);
    this.currentStatus = newStatus;
  }

  public getStatus(): OrderStatus { return this.currentStatus; }
}`,
    monitoringMetrics: [
      "IllegalStateTransitionException events in logs > 0 [Severity: Critical]",
      "Out-of-order event arrivals detected in message queues [Severity: High]",
      "Orders residing in non-terminal states for > 14 days [Severity: Medium]"
    ],
    productionChecklist: [
      "Maintain a centralized, immutable transition matrix defining all valid (from -> to) edges.",
      "Make terminal states (CANCELLED, REFUNDED) strictly immutable with zero outgoing transitions.",
      "Check transition validity before updating database records.",
      "Use optimistic version locking (`version = version + 1`) to reject concurrent state updates.",
      "Ensure all incoming webhook consumers verify the current entity state before mutating."
    ]
  },

  {
    id: "lld-prod-06",
    topic: "Thundering Herd & Cache Stampedes on TTL Expiration in High-Throughput Caches",
    category: "In-Memory Caches & Storage",
    severity: "Critical / Database Outage under Peak Traffic",
    theProblem: "When a popular in-memory cache key (e.g. home page banner, flash sale catalog) expires its TTL, thousands of concurrent user threads simultaneously experience a cache miss. All thousands of threads concurrently execute the heavy SQL query against the database, resulting in database CPU hitting 100%, connection pool exhaustion, and cascading microservice downtime.",
    howItWorksInternally: "In naive caching (`if (!cache.get(key)) { data = db.query(); cache.set(key, data); }`), multiple threads read `null` simultaneously before any single thread finishes writing the cache back. The database receives a sudden square-wave spike of identical redundant queries. The threads queue up, holding HTTP worker sockets open, cascading into gateway 504 Gateway Timeouts.",
    productionCode: `// Production Solution: Mutex Locking via Singleflight Pattern
class SingleflightCacheProtector {
  private inFlightQueries: Map<string, Promise<any>> = new Map();

  public async getOrFetch<T>(
    key: string,
    cacheGet: () => T | null,
    cacheSet: (val: T) => void,
    dbFetch: () => Promise<T>
  ): Promise<T> {
    // 1. Check in-memory cache
    const cached = cacheGet();
    if (cached !== null) return cached;

    // 2. Coalesce concurrent cache-miss calls into 1 single database promise
    if (this.inFlightQueries.has(key)) {
      console.log(\`[Singleflight] Coalescing concurrent request for key "\${key}"\`);
      return this.inFlightQueries.get(key)!;
    }

    const promise = (async () => {
      try {
        console.log(\`[Database] Executing primary query for key "\${key}"\`);
        const result = await dbFetch();
        cacheSet(result);
        return result;
      } finally {
        this.inFlightQueries.delete(key); // Cleanup upon completion
      }
    })();

    this.inFlightQueries.set(key, promise);
    return promise;
  }
}`,
    monitoringMetrics: [
      "Database active connections spiking to pool maximum [Severity: Critical]",
      "Cache miss rate spiking from < 1% to > 50% for hot keys [Severity: High]",
      "Database CPU utilization > 90% during TTL boundary windows [Severity: Critical]",
      "HTTP 504 Gateway Timeout rate during cache invalidations [Severity: Critical]"
    ],
    productionChecklist: [
      "Use Singleflight / Request Coalescing to ensure only 1 thread queries the database per key.",
      "Implement Probabilistic Early Expiration (XFetch algorithm) to re-warm keys before they expire.",
      "Add jitter to TTL durations (`ttl = baseTtl + random(0, 30s)`) to prevent simultaneous expirations.",
      "Serve stale cache data (`stale-while-revalidate`) while a background worker updates the fresh copy.",
      "Ensure database connection pools have strict timeout limits."
    ]
  },

  {
    id: "lld-prod-07",
    topic: "Token Bucket Drift & Concurrency Bottlenecks Under High-Velocity Request Spikes",
    category: "Traffic Control & Rate Limiting",
    severity: "High / Rate Limiting Degradation & Lock Contention",
    theProblem: "In high-throughput microservice gateways (100k+ req/sec), evaluating Token Bucket rate limiters guarded by synchronized mutexes causes severe thread contention. Furthermore, floating-point timestamp calculations cause rounding drift, resulting in either throttling legitimate users or allowing illegal bursts beyond configured SLAs.",
    howItWorksInternally: "If every incoming HTTP request locks a shared mutex to update `tokens` and `lastRefillTime`, threads spend 80% of their execution time waiting for lock handoffs, creating a massive serialization bottleneck. Additionally, calculating `tokensToAdd = (now - lastRefill) * rate` using floating-point arithmetic accumulates precision loss over millions of iterations.",
    productionCode: `// Production Solution: Lock-Free Atomic Token Bucket with Millisecond Integer Math
class HighThroughputTokenBucket {
  private capacityNano: bigint;
  private refillPerMsNano: bigint;
  private tokensNano: bigint;
  private lastRefillMs: number;

  constructor(capacity: number, refillRatePerSec: number) {
    // Scale integers by 1,000,000 to eliminate floating-point drift completely!
    this.capacityNano = BigInt(capacity) * 1000000n;
    this.refillPerMsNano = (BigInt(refillRatePerSec) * 1000000n) / 1000n;
    this.tokensNano = this.capacityNano;
    this.lastRefillMs = Date.now();
  }

  public allowRequest(cost: number = 1): boolean {
    const costNano = BigInt(cost) * 1000000n;
    const now = Date.now();
    const elapsedMs = BigInt(now - this.lastRefillMs);

    if (elapsedMs > 0n) {
      const addedTokens = elapsedMs * this.refillPerMsNano;
      const potential = this.tokensNano + addedTokens;
      this.tokensNano = potential > this.capacityNano ? this.capacityNano : potential;
      this.lastRefillMs = now;
    }

    if (this.tokensNano >= costNano) {
      this.tokensNano -= costNano;
      return true;
    }
    return false;
  }
}`,
    monitoringMetrics: [
      "Mutex lock contention time in rate limiter > 2ms [Severity: High]",
      "Token drift variance from target SLA rate > 2% [Severity: Medium]",
      "Gateway p99 processing overhead attributable to rate limiting > 5ms [Severity: High]"
    ],
    productionChecklist: [
      "Use scaled integer arithmetic (BigInt / fixed-point nano-tokens) instead of floating-point math.",
      "Avoid global mutex locks: partition rate limiters per user ID across concurrent hash maps.",
      "In Redis, use atomic Lua scripts to execute token refill and decrement in 1 round-trip.",
      "Set reasonable maximum burst capacities to protect downstream service stability.",
      "Monitor rate limiter execution latency in API gateway telemetry."
    ]
  },

  {
    id: "lld-prod-08",
    topic: "Circular Dependency Graphs in Debt Simplification and Financial Ledgers",
    category: "Real-World System Modeling",
    severity: "High / Infinite Recursion & Incorrect Settlements",
    theProblem: "In group expense sharing (Splitwise), debts form complex cyclic graphs (A owes B $50, B owes C $50, C owes A $50). Naive graph traversal algorithms enter infinite recursion loops or produce invalid negative settlement transactions where users are prompted to pay negative balances.",
    howItWorksInternally: "Traversing debt edges directly without cycle cancellation leads to $O(2^N)$ path explosions. If algorithm state updates a pairwise debt before zeroing out the opposite edge, circular paths propagate phantom debts. The mathematically sound approach eliminates the graph edges entirely by reducing the system to a single Net Balance vector before computing settlements.",
    productionCode: `// Production Solution: Net Balance Vector Reduction (Cycle-Free)
class RobustDebtSimplifier {
  public static simplify(debts: { from: string; to: string; amount: number }[]): { from: string; to: string; amount: number }[] {
    const net: Map<string, number> = new Map();

    // 1. Flatten all graph edges into a 1-dimensional Net Balance Vector
    // Zero possibility of graph cycles because edges are destroyed!
    for (const d of debts) {
      net.set(d.from, (net.get(d.from) || 0) - d.amount);
      net.set(d.to, (net.get(d.to) || 0) + d.amount);
    }

    const debtors: { user: string; amount: number }[] = [];
    const creditors: { user: string; amount: number }[] = [];

    for (const [user, balance] of net.entries()) {
      const rounded = Math.round(balance * 100) / 100;
      if (rounded < -0.01) debtors.push({ user, amount: -rounded });
      else if (rounded > 0.01) creditors.push({ user, amount: rounded });
    }

    // Sort to optimize settlement pairings
    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const transactions: { from: string; to: string; amount: number }[] = [];
    let dIdx = 0, cIdx = 0;

    while (dIdx < debtors.length && cIdx < creditors.length) {
      const settled = Math.min(debtors[dIdx].amount, creditors[cIdx].amount);
      transactions.push({ from: debtors[dIdx].user, to: creditors[cIdx].user, amount: Math.round(settled * 100) / 100 });

      debtors[dIdx].amount -= settled;
      creditors[cIdx].amount -= settled;

      if (debtors[dIdx].amount <= 0.01) dIdx++;
      if (creditors[cIdx].amount <= 0.01) cIdx++;
    }

    return transactions;
  }
}`,
    monitoringMetrics: [
      "Debt simplification execution duration > 100ms [Severity: High]",
      "Sum of all net balances post-calculation != 0 [Severity: Critical]",
      "Transactions generated count > (totalParticipants - 1) [Severity: High]"
    ],
    productionChecklist: [
      "Always convert pairwise debt graphs into a 1D Net Balance vector before calculating settlements.",
      "Assert the Zero-Sum Invariant: `sum(all net balances) === 0` before and after simplification.",
      "Round currency calculations to integer cents at every intermediate step.",
      "Handle self-debts (A owes A) by filtering them out during initial ingestion.",
      "Limit group size for real-time simplification (e.g. max 50 participants per group)."
    ]
  },

  {
    id: "lld-prod-09",
    topic: "Thread Pool Starvation & Synchronous Blocking in Asynchronous Event Loops",
    category: "Concurrency & Synchronization",
    severity: "Critical / Zero-Throughput Event Loop Freeze",
    theProblem: "In asynchronous event loop architectures (Node.js, Netty, Vert.x) or fixed thread pools, a developer invokes a synchronous blocking call (e.g. `fs.readFileSync()`, `Thread.sleep()`, or synchronous database query) inside a request handler. The single event loop thread freezes completely, preventing all other concurrent HTTP requests, health checks, and timer ticks from executing.",
    howItWorksInternally: "Event-driven runtimes use a small number of worker threads (often 1 thread per CPU core) to multiplex thousands of non-blocking I/O sockets via `epoll`/`kqueue`. When synchronous CPU-intensive hashing or synchronous I/O blocks that thread, the event loop cannot process the next event in its queue. Sockets back up in the OS TCP backlog queue until the server stops accepting connections entirely.",
    productionCode: `// Anti-Pattern: Blocking the Event Loop
// app.get('/hash', (req, res) => {
//   const hash = crypto.pbkdf2Sync(req.body.pwd, salt, 500000, 64, 'sha512'); // BLOCKS EVENT LOOP FOR 500ms!
// });

// Production Solution: Offload Blocking Work to Worker Pool / Worker Threads
const { Worker } = require('worker_threads');

class AsyncWorkerDispatcher {
  public static executeCpuTask<T>(taskPayload: any): Promise<T> {
    return new Promise((resolve, reject) => {
      // Offload to background worker thread, leaving main event loop 100% free!
      const worker = new Worker(\`
        const { parentPort } = require('worker_threads');
        parentPort.on('message', (payload) => {
          // Heavy CPU / crypto math here...
          parentPort.postMessage({ result: "Heavy work completed without blocking!" });
        });
      \`, { eval: true });

      worker.postMessage(taskPayload);
      worker.on('message', (data) => { worker.terminate(); resolve(data.result); });
      worker.on('error', reject);
    });
  }
}`,
    monitoringMetrics: [
      "Event Loop Lag / Delay > 50ms [Severity: High], > 200ms [Severity: Critical]",
      "HTTP active connections queue depth growing while CPU utilization is low [Severity: High]",
      "Kubernetes liveness probe timeouts resulting in pod restarts [Severity: Critical]"
    ],
    productionChecklist: [
      "Never execute synchronous I/O (`readFileSync`, `sleep`) inside web request handlers.",
      "Offload CPU-intensive operations (image resizing, PDF generation, bcrypt hashing) to worker pools.",
      "Monitor Event Loop Delay metrics (`event_loop_lag_seconds`) in production.",
      "Set reasonable timeouts on all outbound database and network sockets.",
      "Use asynchronous non-blocking stream APIs for large file processing."
    ]
  },

  {
    id: "lld-prod-10",
    topic: "Silent Data Corruption from Non-Thread-Safe Collections (`HashMap`, `ArrayList`)",
    category: "Concurrency & Data Structures",
    severity: "Critical / Data Corruption & Infinite Loops",
    theProblem: "Using standard non-thread-safe collections (Java `HashMap`, `ArrayList`, C++ `std::unordered_map`) in multi-threaded environments causes silent data corruption, lost updates, null pointer exceptions, and in older Java versions, infinite loops during internal hash bucket resizing that peg CPU to 100%.",
    howItWorksInternally: "When two threads invoke `map.put(k, v)` concurrently, both threads can hash to the same bucket at the same time. Thread A begins modifying linked list pointers in the bucket. Thread B context switches in and overwrites Thread A's pointer changes, creating a circular linked list reference. Subsequent `get()` operations traverse the circular list forever, consuming 100% CPU on an infinite loop.",
    productionCode: `// Production Solution: Concurrent Collections with CAS & Striping
// In Java: ConcurrentHashMap and CopyOnWriteArrayList
// In TypeScript: Mutex-Guarded Collection

class ThreadSafeDictionary<K, V> {
  private map: Map<K, V> = new Map();
  private lock = new AsyncMutex();

  public async set(key: K, value: V): Promise<void> {
    await this.lock.withLock(async () => {
      this.map.set(key, value);
    });
  }

  public async get(key: K): Promise<V | null> {
    return await this.lock.withLock(async () => {
      return this.map.get(key) ?? null;
    });
  }

  // Atomic compute-if-absent prevents read-modify-write race conditions
  public async computeIfAbsent(key: K, factory: () => Promise<V>): Promise<V> {
    return await this.lock.withLock(async () => {
      if (this.map.has(key)) return this.map.get(key)!;
      const created = await factory();
      this.map.set(key, created);
      return created;
    });
  }
}`,
    monitoringMetrics: [
      "CPU utilization pinned at 100% with threads stuck in HashMap.get() [Severity: Critical]",
      "ConcurrentModificationException occurrences in production logs [Severity: Critical]",
      "Discrepancies in collection size() vs actual entries counted [Severity: High]"
    ],
    productionChecklist: [
      "Always use `ConcurrentHashMap` instead of `HashMap` or `Hashtable` in multi-threaded code.",
      "Use atomic operations (`computeIfAbsent`, `putIfAbsent`) instead of manual `if (!map.has) put()`.",
      "For read-heavy rarely-modified lists, use `CopyOnWriteArrayList`.",
      "Never pass non-thread-safe collections across thread boundaries without defensive copying.",
      "Audit static variables to ensure collections are synchronized."
    ]
  },

  {
    id: "lld-prod-11",
    topic: "Unbounded Memory Growth in Undo/Redo Stacks and Memento History Managers",
    category: "Design Patterns & Memory Management",
    severity: "High / Progressive Heap Saturation",
    theProblem: "Implementing the Command pattern or Memento pattern for document history without a strict capacity ceiling results in unbounded memory consumption. As users edit documents over hours, hundreds of thousands of Command objects and snapshot states accumulate in `undoStack`, eventually crashing the browser tab or server process with Out of Memory.",
    howItWorksInternally: "Each Command or Memento holds references to modified text buffers, image layers, or domain aggregates. Without a capacity bounding strategy (Ring Buffer / Deque), the stacks grow linearly with user activity: $O(N)$ space complexity with no upper bound. Furthermore, if Mementos store complete deep clones of the entire document rather than incremental deltas, memory explodes by megabytes on every keystroke.",
    productionCode: `// Production Solution: Bounded Ring-Buffer History with Delta Snapshots
interface ReversibleDelta {
  position: number;
  inserted: string;
  deleted: string;
}

class BoundedHistoryManager {
  private maxHistory: number;
  private historyQueue: ReversibleDelta[] = [];
  private redoQueue: ReversibleDelta[] = [];

  constructor(maxHistory: number = 50) {
    this.maxHistory = maxHistory;
  }

  public recordChange(delta: ReversibleDelta): void {
    this.historyQueue.push(delta);
    // Strict bounding: Evict oldest undo states when limit exceeded!
    if (this.historyQueue.length > this.maxHistory) {
      this.historyQueue.shift(); // Reclaims memory immediately
    }
    this.redoQueue = []; // Invalidate redo tree on fresh mutation
  }

  public getHistoryDepth(): number { return this.historyQueue.length; }
}`,
    monitoringMetrics: [
      "Application heap usage correlating linearly with user session duration [Severity: High]",
      "Undo stack depth reaching configured maximum limit [Severity: Medium]",
      "Memory footprint per active document editing session > 50MB [Severity: High]"
    ],
    productionChecklist: [
      "Always enforce a strict `maxHistory` cap (e.g. 50 or 100 operations) using a bounded Deque.",
      "Store incremental deltas (diffs) rather than deep cloning the entire document state.",
      "Group rapid sequential character keystrokes into word-level compound commands.",
      "Clear redo stacks immediately whenever a new operation branches the history tree.",
      "Dispose of history managers when user tabs or editing sessions close."
    ]
  },

  {
    id: "lld-prod-12",
    topic: "Starvation & Elevator Scheduling Pathological Delays under Peak Traffic",
    category: "Real-World System Modeling",
    severity: "High / Excessive Passenger Wait Times & Thrashing",
    theProblem: "In a high-rise office building during morning rush hour, hundreds of passengers arrive at the Lobby (Floor 1). Naive elevator algorithms (SSTF - Shortest Seek Time First) repeatedly service passengers between Floors 1 and 4 because the distances are short, causing passengers waiting on Floor 45 to starve indefinitely for 30+ minutes.",
    howItWorksInternally: "Greedy local-optimization algorithms (like SSTF) prioritize requests closest to the current car location. Under heavy localized traffic at lower floors, the car's local seek neighborhood remains concentrated at the bottom of the building. The variance in passenger wait times explodes, producing pathological worst-case latencies for upper-floor occupants.",
    productionCode: `// Production Solution: Hybrid LOOK with Wait-Time Aging Priority Boost
class ElevatorRequest {
  constructor(public floor: number, public requestTime: number = Date.now()) {}
}

class AntiStarvationElevatorDispatcher {
  public static selectNextStop(
    currentFloor: number,
    requests: ElevatorRequest[],
    maxWaitToleranceMs: number = 180000 // 3 minutes
  ): number | null {
    if (requests.length === 0) return null;
    const now = Date.now();

    // 1. STARVATION OVERRIDE: Check if any request has exceeded max wait tolerance
    const starvedRequest = requests.find(r => (now - r.requestTime) > maxWaitToleranceMs);
    if (starvedRequest) {
      console.warn(\`[STARVATION OVERRIDE] Floor \${starvedRequest.floor} waited > 3 mins! Servicing immediately.\`);
      return starvedRequest.floor;
    }

    // 2. Normal LOOK algorithm: Service nearest floor in current direction
    requests.sort((a, b) => Math.abs(a.floor - currentFloor) - Math.abs(b.floor - currentFloor));
    return requests[0].floor;
  }
}`,
    monitoringMetrics: [
      "Maximum passenger wait time > 300 seconds [Severity: Critical]",
      "Elevator dispatch queue length standard deviation > 15 [Severity: High]",
      "Starvation override activation frequency [Severity: Medium]"
    ],
    productionChecklist: [
      "Implement Aging: boost the scheduling priority of waiting requests as elapsed time grows.",
      "Use Sectoring during peak hours (e.g. Car 1 serves Floors 1-20, Car 2 serves Floors 20-40).",
      "Incorporate maximum wait time thresholds that override distance-minimizing heuristics.",
      "Model passenger weight limits to prevent full elevators from stopping at intermediate floors.",
      "Simulate high-traffic peak conditions (morning up-peak, evening down-peak) in unit tests."
    ]
  },

  {
    id: "lld-prod-13",
    topic: "Fragile Base Class Problem & Inheritance Rigidity Breaking Domain Extensibility",
    category: "Object-Oriented Design & Principles",
    severity: "High / Architectural Brittleness & Regressions",
    theProblem: "A base class method is modified or enhanced in an enterprise library (e.g. `CustomList.addAll()` is optimized to call `add()` internally). Subclasses that override both `add()` and `addAll()` to count elements suddenly count items twice, corrupting domain metrics and breaking production subclasses across multiple microservices.",
    howItWorksInternally: "Inheritance is 'white-box' reuse: subclasses depend intimately on internal implementation details of the parent class. If the parent class changes internal self-invocation patterns between its methods, subclasses break without any compiler warnings or syntax errors. This architectural brittleness is known as the Fragile Base Class Problem.",
    productionCode: `// Anti-Pattern: Fragile Base Class (Double-counting bug)
// class InstrumentedSet extends HashSet {
//   private count = 0;
//   add(e) { this.count++; super.add(e); }
//   addAll(list) { this.count += list.length; super.addAll(list); } // HashSet.addAll calls add() internally -> double counts!
// }

// Production Solution: Composition with Forwarding Wrapper (Decorator Pattern)
interface CustomSet<T> {
  add(item: T): boolean;
  addAll(items: T[]): boolean;
  size(): number;
}

class InstrumentedSet<T> implements CustomSet<T> {
  private count: number = 0;

  // Composition: Holds private reference to backing implementation
  constructor(private backingSet: CustomSet<T>) {}

  public add(item: T): boolean {
    this.count++;
    return this.backingSet.add(item);
  }

  public addAll(items: T[]): boolean {
    this.count += items.length;
    // Forwards cleanly without relying on parent class internal method dispatch!
    return this.backingSet.addAll(items);
  }

  public getAddedCount(): number { return this.count; }
  public size(): number { return this.backingSet.size(); }
}`,
    monitoringMetrics: [
      "Regression test failure count after upgrading shared base library versions [Severity: High]",
      "Inheritance depth > 3 levels across domain model hierarchies [Severity: Medium]",
      "Prevalence of `super.method()` invocations with stateful side effects [Severity: Medium]"
    ],
    productionChecklist: [
      "Favor Object Composition over Class Inheritance ('Favor Has-A over Is-A').",
      "Design and document for inheritance or else prohibit it (mark classes `final` or `sealed`).",
      "Use the Forwarding Decorator pattern instead of subclassing to add instrumentation.",
      "Keep inheritance hierarchies shallow (maximum 2 levels deep).",
      "Avoid internal self-use of overridable methods in base classes."
    ]
  },

  {
    id: "lld-prod-14",
    topic: "Non-Idempotent Command Execution Causing Duplicate Charges & State Drift",
    category: "Behavioral Patterns & Transactions",
    severity: "Critical / Double-Charging & Stale State Drift",
    theProblem: "When executing financial payment commands or inventory deductions over unreliable networks, transient TCP timeouts cause clients to retry requests. If the Command execution is non-idempotent, retrying a timed-out `ChargeCustomerCommand` executes the payment a second time, charging the user's credit card twice for a single order.",
    howItWorksInternally: "Network communication is inherently unreliable: a timeout can mean the request failed to reach the server, OR the server completed the charge and only the response was dropped. When a client retries, a non-idempotent server treats it as a brand-new transaction. Without a persistent deduplication key and an atomic state check, the state machine mutates twice.",
    productionCode: `// Production Solution: Idempotent Command with Atomic Deduplication Lock
interface CommandContext {
  idempotencyKey: string;
  orderId: string;
  amountCents: number;
}

class IdempotentPaymentCommand {
  private static executedKeys: Map<string, { status: string; resultTxId: string }> = new Map();

  public async execute(ctx: CommandContext): Promise<{ success: boolean; txId: string }> {
    // 1. Atomic Deduplication Guard
    if (IdempotentPaymentCommand.executedKeys.has(ctx.idempotencyKey)) {
      const prev = IdempotentPaymentCommand.executedKeys.get(ctx.idempotencyKey)!;
      console.log(\`[Idempotent Command] Replaying cached response for key: \${ctx.idempotencyKey}\`);
      return { success: true, txId: prev.resultTxId };
    }

    // 2. Execute external payment gateway charge
    console.log(\`[Gateway API] Charging $\${ctx.amountCents / 100} for Order \${ctx.orderId}...\`);
    const generatedTxId = \`tx_\${Date.now()}_\${ctx.orderId}\`;

    // 3. Persist idempotency result
    IdempotentPaymentCommand.executedKeys.set(ctx.idempotencyKey, {
      status: "COMPLETED",
      resultTxId: generatedTxId
    });

    return { success: true, txId: generatedTxId };
  }
}`,
    monitoringMetrics: [
      "Duplicate transaction charge rate detected in payment audit reconciliation [Severity: Critical]",
      "Idempotency cache hit rate during network degradation events [Severity: High]",
      "Customer chargeback requests citing double-billing [Severity: Critical]"
    ],
    productionChecklist: [
      "Mandate unique `Idempotency-Key` headers on all mutating POST and PUT commands.",
      "Check and record idempotency status atomically before executing external financial mutations.",
      "Store idempotency responses with a reasonable TTL (e.g. 24 hours) in persistent storage.",
      "Never retry non-idempotent operations without explicit user confirmation.",
      "Verify that all compensating transactions in Sagas are completely idempotent."
    ]
  }
];

const outputPath = path.join(__dirname, '../data/lld.production.json');
fs.writeFileSync(outputPath, JSON.stringify(productionRunbooks, null, 2), 'utf-8');
console.log(`Successfully wrote ${productionRunbooks.length} production runbooks to ${outputPath}`);
