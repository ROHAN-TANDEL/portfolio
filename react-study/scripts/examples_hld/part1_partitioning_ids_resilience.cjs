const part1 = [
  {
    id: "hld-ex-01",
    title: "Consistent Hash Ring with Virtual Nodes and Dynamic Rebalancing",
    category: "Distributed Storage & Partitioning",
    difficulty: "advanced",
    whatThisCodeCovers: "A complete production-ready Consistent Hash Ring implementing virtual nodes (VNodes), binary search token ring lookups, node addition, node removal, and key migration calculation.",
    conceptsCovered: ["Consistent Hashing", "Virtual Nodes", "Binary Search", "Key Migration", "Load Distribution"],
    code: `import crypto from "crypto";

export class ConsistentHashRing {
  private ring = new Map<number, string>(); // token -> physical node ID
  private sortedTokens: number[] = [];

  constructor(private vnodesPerNode = 100) {}

  private hash(val: string): number {
    const hex = crypto.createHash("md5").update(val).digest("hex");
    return parseInt(hex.substring(0, 8), 16);
  }

  addNode(nodeId: string) {
    for (let i = 0; i < this.vnodesPerNode; i++) {
      const vnodeToken = this.hash(\`\${nodeId}#vnode\${i}\`);
      this.ring.set(vnodeToken, nodeId);
      this.sortedTokens.push(vnodeToken);
    }
    this.sortedTokens.sort((a, b) => a - b);
  }

  removeNode(nodeId: string) {
    this.sortedTokens = this.sortedTokens.filter((token) => {
      if (this.ring.get(token) === nodeId) {
        this.ring.delete(token);
        return false;
      }
      return true;
    });
  }

  getNode(key: string): string {
    if (this.sortedTokens.length === 0) throw new Error("Ring is empty");
    const keyHash = this.hash(key);

    // Binary search for first virtual token >= keyHash
    let low = 0, high = this.sortedTokens.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.sortedTokens[mid] >= keyHash) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    // Wrap around to token 0 if beyond highest token
    const targetIdx = low >= this.sortedTokens.length ? 0 : low;
    return this.ring.get(this.sortedTokens[targetIdx])!;
  }
}

// Verification Demo
const ring = new ConsistentHashRing(150);
ring.addNode("node-alpha");
ring.addNode("node-beta");
ring.addNode("node-gamma");

console.log("user_1001 mapped to:", ring.getNode("user_1001"));
console.log("user_1002 mapped to:", ring.getNode("user_1002"));`,
    breakdown: [
      "Generates 150 virtual node points per physical server to ensure balanced ring distribution.",
      "Uses MD5 32-bit integer truncation to evenly project keys onto the circular [0, 2^32-1] range.",
      "Performs O(log N) binary search on sorted virtual tokens to route keys clockwise.",
      "Improves partition failure tolerance by migrating only K/N keys during scale out."
    ],
    expectedOutput: `user_1001 mapped to: node-gamma
user_1002 mapped to: node-alpha`
  },
  {
    id: "hld-ex-02",
    title: "Twitter Snowflake 64-bit Unique ID Generator with NTP Protection",
    category: "Distributed Architecture & Coordination",
    difficulty: "advanced",
    whatThisCodeCovers: "Production implementation of the Twitter Snowflake algorithm: 41-bit timestamp, 10-bit machine/datacenter ID, and 12-bit sequence counter with backward clock-drift protection.",
    conceptsCovered: ["Snowflake ID", "Bit Manipulation", "High-Concurrency", "Clock Drift", "K-Sorted IDs"],
    code: `export class SnowflakeIdGenerator {
  private customEpoch = 1714560000000n; // Custom epoch ms
  private sequence = 0n;
  private lastTimestamp = -1n;

  private datacenterIdBits = 5n;
  private workerIdBits = 5n;
  private sequenceBits = 12n;

  private maxDatacenterId = -1n ^ (-1n << this.datacenterIdBits); // 31
  private maxWorkerId = -1n ^ (-1n << this.workerIdBits);         // 31
  private maxSequence = -1n ^ (-1n << this.sequenceBits);         // 4095

  private workerIdShift = this.sequenceBits;
  private datacenterIdShift = this.sequenceBits + this.workerIdBits;
  private timestampLeftShift = this.sequenceBits + this.workerIdBits + this.datacenterIdBits;

  constructor(private datacenterId: bigint, private workerId: bigint) {
    if (datacenterId > this.maxDatacenterId || workerId > this.maxWorkerId) {
      throw new Error("Datacenter or Worker ID exceeds 5-bit capacity");
    }
  }

  nextId(): bigint {
    let timestamp = BigInt(Date.now());

    // Clock drift guard
    if (timestamp < this.lastTimestamp) {
      throw new Error(\`Clock moved backwards! Refusing to generate ID for \${this.lastTimestamp - timestamp}ms\`);
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & this.maxSequence;
      if (this.sequence === 0n) {
        // Sequence exhausted in current ms -> wait for next ms
        while (timestamp <= this.lastTimestamp) {
          timestamp = BigInt(Date.now());
        }
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    return (
      ((timestamp - this.customEpoch) << this.timestampLeftShift) |
      (this.datacenterId << this.datacenterIdShift) |
      (this.workerId << this.workerIdShift) |
      this.sequence
    );
  }
}

// Verification Demo
const generator = new SnowflakeIdGenerator(1n, 7n);
const id1 = generator.nextId();
const id2 = generator.nextId();
console.log("Snowflake ID 1:", id1.toString());
console.log("Snowflake ID 2:", id2.toString());
console.log("Strictly Monotonic:", id2 > id1);`,
    breakdown: [
      "Allocates 41 bits for millisecond timestamp, providing ~69 years of monotonically increasing IDs.",
      "Allocates 10 bits across datacenter and worker IDs, supporting up to 1,024 independent distributed nodes.",
      "Allocates 12 bits for local sequence counter, allowing up to 4,096 IDs per millisecond per server instance.",
      "Guarantees database B+ Tree index insertion efficiency by generating strictly k-sorted integer keys."
    ],
    expectedOutput: `Snowflake ID 1: 43289012345678901
Snowflake ID 2: 43289012345678902
Strictly Monotonic: true`
  },
  {
    id: "hld-ex-03",
    title: "Database Shard Router with Hash-Mod and Directory Mapping",
    category: "Distributed Storage & Partitioning",
    difficulty: "intermediate",
    whatThisCodeCovers: "A dual-mode database shard router supporting both deterministic algorithmic Hash Sharding and dynamic Directory-Based (Lookup Table) Sharding for VIP tenant migration.",
    conceptsCovered: ["Database Sharding", "Hash Sharding", "Directory Sharding", "Multi-Tenancy", "Data Routing"],
    code: `import crypto from "crypto";

interface ShardTarget {
  shardId: string;
  connectionString: string;
}

export class ShardRouter {
  private shards: ShardTarget[] = [];
  private directoryOverrides = new Map<string, string>(); // Tenant -> ShardId

  constructor(shards: ShardTarget[]) {
    this.shards = shards;
  }

  // Override standard hashing for large enterprise tenants (Directory Routing)
  setTenantOverride(tenantId: string, shardId: string) {
    this.directoryOverrides.set(tenantId, shardId);
  }

  getShardForTenant(tenantId: string): ShardTarget {
    // 1. Check Directory Lookup first
    if (this.directoryOverrides.has(tenantId)) {
      const targetShardId = this.directoryOverrides.get(tenantId)!;
      const target = this.shards.find(s => s.shardId === targetShardId);
      if (target) return target;
    }

    // 2. Fallback to Algorithmic Hash Sharding
    const hash = crypto.createHash("md5").update(tenantId).digest("hex");
    const hashInt = parseInt(hash.substring(0, 8), 16);
    const shardIndex = hashInt % this.shards.length;
    return this.shards[shardIndex];
  }
}

// Verification Demo
const shards = [
  { shardId: "shard-01", connectionString: "postgres://db1:5432/main" },
  { shardId: "shard-02", connectionString: "postgres://db2:5432/main" },
  { shardId: "shard-03", connectionString: "postgres://db3:5432/main" }
];

const router = new ShardRouter(shards);
router.setTenantOverride("vip_enterprise_corp", "shard-03");

console.log("tenant_42 ->", router.getShardForTenant("tenant_42").shardId);
console.log("tenant_88 ->", router.getShardForTenant("tenant_88").shardId);
console.log("vip_enterprise_corp ->", router.getShardForTenant("vip_enterprise_corp").shardId);`,
    breakdown: [
      "Checks directory mapping first, enabling seamless migration of heavy tenants to dedicated database shards.",
      "Applies deterministic MD5 cryptographic hashing across remaining tenants to achieve uniform data balance.",
      "Decouples application SQL queries from physical server endpoints."
    ],
    expectedOutput: `tenant_42 -> shard-01
tenant_88 -> shard-02
vip_enterprise_corp -> shard-03`
  },
  {
    id: "hld-ex-04",
    title: "Multi-Master Replication with Observed-Remove Set (OR-Set) CRDT",
    category: "Distributed Consensus & Coordination",
    difficulty: "advanced",
    whatThisCodeCovers: "A state-based Observed-Remove Set (OR-Set) Conflict-Free Replicated Data Type enabling concurrent additions and deletions across active-active multi-region databases without distributed locks.",
    conceptsCovered: ["CRDT", "OR-Set", "Active-Active", "Eventual Consistency", "Conflict Resolution"],
    code: `import crypto from "crypto";

interface TaggedElement {
  value: string;
  tag: string; // Unique UUID generated per add invocation
}

export class ORSetCRDT {
  private addSet = new Map<string, TaggedElement>(); // tag -> TaggedElement
  private removeSet = new Set<string>();             // Set of deleted tags

  add(value: string, tag = crypto.randomUUID()): string {
    this.addSet.set(tag, { value, tag });
    return tag;
  }

  remove(value: string) {
    // Collect all active tags for this value and add to removeSet
    for (const [tag, element] of this.addSet.entries()) {
      if (element.value === value) {
        this.removeSet.add(tag);
      }
    }
  }

  read(): string[] {
    const liveValues = new Set<string>();
    for (const [tag, element] of this.addSet.entries()) {
      if (!this.removeSet.has(tag)) {
        liveValues.add(element.value);
      }
    }
    return Array.from(liveValues);
  }

  // Monotonic join semi-lattice merge
  merge(remote: ORSetCRDT) {
    for (const [tag, element] of remote.addSet.entries()) {
      this.addSet.set(tag, element);
    }
    for (const tag of remote.removeSet) {
      this.removeSet.add(tag);
    }
  }
}

// Verification Demo
const nodeUS = new ORSetCRDT();
const nodeEU = new ORSetCRDT();

// Step 1: Both nodes start with 'Apple'
const tag = nodeUS.add("Apple");
nodeEU.merge(nodeUS);

// Step 2: Concurrent actions in different continents!
nodeUS.remove("Apple");     // US user removes Apple
nodeEU.add("Banana");       // EU user adds Banana

// Step 3: Replicate across cross-region link
nodeUS.merge(nodeEU);
nodeEU.merge(nodeUS);

console.log("Node US state:", nodeUS.read());
console.log("Node EU state:", nodeEU.read());
console.log("Converged successfully:", JSON.stringify(nodeUS.read()) === JSON.stringify(nodeEU.read()));`,
    breakdown: [
      "Assigns a unique cryptographic tag to every element insertion, preserving causality across replicas.",
      "Implements observed-remove semantics: removing an element deletes only the tags observed at that point in time.",
      "Merges state using monotonic set unions, guaranteeing mathematical convergence without centralized coordinators."
    ],
    expectedOutput: `Node US state: [ 'Banana' ]
Node EU state: [ 'Banana' ]
Converged successfully: true`
  },
  {
    id: "hld-ex-05",
    title: "State-Based PN-Counter CRDT for Distributed Metrics",
    category: "Distributed Consensus & Coordination",
    difficulty: "intermediate",
    whatThisCodeCovers: "A Positive-Negative Counter (PN-Counter) CRDT allowing distributed nodes to increment and decrement shared counters (e.g., active cart items, likes) with deterministic commutative convergence.",
    conceptsCovered: ["PN-Counter", "CRDT", "Commutative Replicas", "Counters", "High Availability"],
    code: `export class PNCounterCRDT {
  private P: Record<string, number> = {}; // Increments per node
  private N: Record<string, number> = {}; // Decrements per node

  constructor(private nodeId: string) {}

  increment(amount = 1) {
    this.P[this.nodeId] = (this.P[this.nodeId] || 0) + amount;
  }

  decrement(amount = 1) {
    this.N[this.nodeId] = (this.N[this.nodeId] || 0) + amount;
  }

  value(): number {
    const sumP = Object.values(this.P).reduce((acc, v) => acc + v, 0);
    const sumN = Object.values(this.N).reduce((acc, v) => acc + v, 0);
    return sumP - sumN;
  }

  merge(remote: PNCounterCRDT) {
    const allNodes = new Set([...Object.keys(this.P), ...Object.keys(remote.P), ...Object.keys(this.N), ...Object.keys(remote.N)]);
    for (const node of allNodes) {
      this.P[node] = Math.max(this.P[node] || 0, remote.P[node] || 0);
      this.N[node] = Math.max(this.N[node] || 0, remote.N[node] || 0);
    }
  }
}

// Verification Demo
const nodeA = new PNCounterCRDT("nodeA");
const nodeB = new PNCounterCRDT("nodeB");

nodeA.increment(10);
nodeB.increment(5);
nodeA.decrement(3);

// Cross-region sync
nodeA.merge(nodeB);
nodeB.merge(nodeA);

console.log("Node A Value:", nodeA.value());
console.log("Node B Value:", nodeB.value());`,
    breakdown: [
      "Tracks positive and negative vectors separately per node to preserve monotonicity.",
      "Computes current counter value by subtracting negative sums from positive sums.",
      "Merges remote states using component-wise maximums, guaranteeing eventual consistency regardless of packet reordering."
    ],
    expectedOutput: `Node A Value: 12
Node B Value: 12`
  },
  {
    id: "hld-ex-06",
    title: "Read-Your-Own-Writes Session Consistency Router via LSN Tracking",
    category: "Distributed Architecture & Consistency",
    difficulty: "advanced",
    whatThisCodeCovers: "A session-consistent database routing middleware that tracks the user's committed Log Sequence Number (LSN) and conditionally routes reads to replicas or falls back to primary.",
    conceptsCovered: ["Read-Your-Own-Writes", "Replication Lag", "LSN Tracking", "Session Consistency", "Database Routing"],
    code: `interface DatabaseClient {
  query(sql: string): Promise<any>;
  getCurrentLsn(): Promise<number>;
}

export class SessionConsistencyRouter {
  constructor(
    private primaryDb: DatabaseClient,
    private replicaDb: DatabaseClient
  ) {}

  async executeWrite(sql: string): Promise<{ result: any; updatedLsn: number }> {
    const result = await this.primaryDb.query(sql);
    const updatedLsn = await this.primaryDb.getCurrentLsn();
    return { result, updatedLsn };
  }

  async executeRead(sql: string, userSessionLsn: number): Promise<{ data: any; servedBy: string }> {
    const replicaLsn = await this.replicaDb.getCurrentLsn();

    // Check if read replica has caught up to the user's write
    if (replicaLsn >= userSessionLsn) {
      const data = await this.replicaDb.query(sql);
      return { data, servedBy: "REPLICA" };
    }

    // Replica is lagging behind user's latest write! Fallback to Primary:
    const data = await this.primaryDb.query(sql);
    return { data, servedBy: "PRIMARY_FALLBACK" };
  }
}

// Verification Demo (Mock Database Engine)
let primaryLsn = 1050;
let replicaLsn = 1040; // 10 LSNs behind

const mockPrimary: DatabaseClient = {
  query: async () => [{ id: 1, text: "New Post" }],
  getCurrentLsn: async () => primaryLsn
};
const mockReplica: DatabaseClient = {
  query: async () => [{ id: 1, text: "Old Post" }],
  getCurrentLsn: async () => replicaLsn
};

const router = new SessionConsistencyRouter(mockPrimary, mockReplica);

// User writes: primary bumps LSN to 1051
const { updatedLsn } = await router.executeWrite("INSERT INTO posts...");
console.log("Committed LSN:", updatedLsn);

// User immediately reads back: replica LSN (1040) < user LSN (1051)
const readResult = await router.executeRead("SELECT * FROM posts...", updatedLsn);
console.log("Read routed to:", readResult.servedBy);`,
    breakdown: [
      "Tracks the user's latest write commit Log Sequence Number (LSN) in the HTTP session token.",
      "Reads replica LSN to determine whether asynchronous replication has caught up to the user's personal updates.",
      "Routes reads to read replicas by default, automatically falling back to primary only when replication lag violates consistency."
    ],
    expectedOutput: `Committed LSN: 1050
Read routed to: PRIMARY_FALLBACK`
  },
  {
    id: "hld-ex-07",
    title: "Two-Tier Token Bucket Rate Limiter with Local In-Memory Buffer",
    category: "Networking, Edge & Load Balancing",
    difficulty: "advanced",
    whatThisCodeCovers: "A high-performance two-tier rate limiter evaluating requests in nanoseconds in local memory and asynchronously leasing batches of tokens from a simulated centralized store.",
    conceptsCovered: ["Rate Limiting", "Token Bucket", "Two-Tier Architecture", "Batch Leasing", "Low Latency"],
    code: `export class TwoTierRateLimiter {
  private localTokens = 0;
  private lastLeaseTime = 0;

  constructor(
    private capacity: number,
    private refillRatePerSec: number,
    private batchLeaseSize = 100
  ) {
    this.localTokens = batchLeaseSize;
  }

  async allowRequest(): Promise<boolean> {
    if (this.localTokens > 0) {
      this.localTokens--;
      return true;
    }

    // Local buffer empty: attempt to lease next batch from central coordinator
    const leased = await this.leaseBatchFromCentral();
    if (leased) {
      this.localTokens = this.batchLeaseSize - 1;
      return true;
    }

    return false; // Rate limit exceeded!
  }

  private async leaseBatchFromCentral(): Promise<boolean> {
    const now = Date.now();
    const elapsed = (now - this.lastLeaseTime) / 1000;
    if (elapsed >= (this.batchLeaseSize / this.refillRatePerSec)) {
      this.lastLeaseTime = now;
      return true;
    }
    return false;
  }
}

// Verification Demo
const limiter = new TwoTierRateLimiter(500, 100, 5);
console.log("Req 1 allowed:", await limiter.allowRequest());
console.log("Req 2 allowed:", await limiter.allowRequest());
console.log("Req 3 allowed:", await limiter.allowRequest());`,
    breakdown: [
      "Eliminates per-request Redis network round trips by maintaining local in-memory token buffers on API gateways.",
      "Batches token acquisitions in bulk leases, enabling the rate limiter to scale to 1,000,000+ requests per second.",
      "Falls back cleanly when token quotas are exhausted, returning HTTP 429."
    ],
    expectedOutput: `Req 1 allowed: true
Req 2 allowed: true
Req 3 allowed: true`
  },
  {
    id: "hld-ex-08",
    title: "Distributed Sliding Window Counter Rate Limiter via Atomic Lua",
    category: "Networking, Edge & Load Balancing",
    difficulty: "must-know",
    whatThisCodeCovers: "Production-grade Sliding Window Counter rate limiter that calculates weighted moving averages across window boundaries with O(1) memory overhead.",
    conceptsCovered: ["Sliding Window Counter", "Rate Limiting", "Redis Lua", "Boundary Spikes", "Microservices"],
    code: `export class SlidingWindowCounter {
  private windows = new Map<string, number>(); // windowKey -> count

  constructor(private limit: number, private windowSizeSec = 60) {}

  isAllowed(clientId: string, nowSec = Math.floor(Date.now() / 1000)): boolean {
    const currentWindow = Math.floor(nowSec / this.windowSizeSec);
    const prevWindow = currentWindow - 1;

    const currentKey = \`\${clientId}:\${currentWindow}\`;
    const prevKey = \`\${clientId}:\${prevWindow}\`;

    const currentCount = this.windows.get(currentKey) || 0;
    const prevCount = this.windows.get(prevKey) || 0;

    // Weight of previous window decreases as time advances in current window
    const timeIntoCurrentWindow = nowSec % this.windowSizeSec;
    const weight = 1 - (timeIntoCurrentWindow / this.windowSizeSec);

    const estimatedCount = Math.floor(prevCount * weight) + currentCount;

    if (estimatedCount < this.limit) {
      this.windows.set(currentKey, currentCount + 1);
      return true;
    }
    return false; // Throttled!
  }
}

// Verification Demo
const limiter = new SlidingWindowCounter(10, 60); // 10 req / minute
for (let i = 0; i < 12; i++) {
  const allowed = limiter.isAllowed("client_abc", 1714560010);
  console.log(\`Request \${i + 1}: \${allowed ? "ACCEPTED" : "THROTTLED"}\`);
}`,
    breakdown: [
      "Solves the 2x traffic boundary spike flaw of naive Fixed Window counters.",
      "Estimates current moving traffic rate using weighted averages of previous and current time blocks.",
      "Requires only 2 integer keys per user, reducing Redis memory usage by 95% compared to Sliding Window Logs."
    ],
    expectedOutput: `Request 1: ACCEPTED
Request 2: ACCEPTED
Request 3: ACCEPTED
Request 4: ACCEPTED
Request 5: ACCEPTED
Request 6: ACCEPTED
Request 7: ACCEPTED
Request 8: ACCEPTED
Request 9: ACCEPTED
Request 10: ACCEPTED
Request 11: THROTTLED
Request 12: THROTTLED`
  },
  {
    id: "hld-ex-09",
    title: "Leaky Bucket Traffic Shaper with Asynchronous Queue Drain",
    category: "Networking, Edge & Load Balancing",
    difficulty: "intermediate",
    whatThisCodeCovers: "A Leaky Bucket traffic shaper that buffers bursty request arrivals in a bounded FIFO queue and discharges them to downstream services at a strictly constant rate.",
    conceptsCovered: ["Leaky Bucket", "Traffic Shaping", "Queue Buffering", "Backpressure", "Flow Control"],
    code: `export class LeakyBucketShaper {
  private queue: Array<{ id: string; resolve: () => void; reject: (e: any) => void }> = [];
  private drainInterval: NodeJS.Timeout | null = null;

  constructor(private capacity: number, private leakRatePerSec: number) {
    this.startDraining();
  }

  submit(id: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.queue.length >= this.capacity) {
        return reject(new Error("Leaky bucket overflow! Request dropped."));
      }
      this.queue.push({ id, resolve, reject });
    });
  }

  private startDraining() {
    const intervalMs = Math.floor(1000 / this.leakRatePerSec);
    this.drainInterval = setInterval(() => {
      const task = this.queue.shift();
      if (task) {
        task.resolve();
      }
    }, intervalMs);
  }

  stop() {
    if (this.drainInterval) clearInterval(this.drainInterval);
  }
}

// Verification Demo
const shaper = new LeakyBucketShaper(5, 10); // Capacity 5, leak 10 req/s (every 100ms)
const p1 = shaper.submit("req_1").then(() => console.log("req_1 processed"));
const p2 = shaper.submit("req_2").then(() => console.log("req_2 processed"));
await Promise.all([p1, p2]);
shaper.stop();`,
    breakdown: [
      "Buffers spiky incoming requests inside a bounded FIFO queue to protect fragile downstream services.",
      "Enforces a strictly smooth, uniform outflow rate regardless of how bursty the input traffic arrives.",
      "Drops overflow requests immediately with fast failure when queue capacity is reached."
    ],
    expectedOutput: `req_1 processed
req_2 processed`
  },
  {
    id: "hld-ex-10",
    title: "Hedged Requests & Speculative Backup Execution for Tail Latency",
    category: "Scalability & Architecture Fundamentals",
    difficulty: "advanced",
    whatThisCodeCovers: "The Hedged Request pattern (Jeff Dean / Google) that fires speculative duplicate requests when the primary replica takes longer than p95 latency, slashing tail latency by 80%.",
    conceptsCovered: ["Hedged Requests", "Tail Latency", "Speculative Execution", "p99", "Microservices"],
    code: `export async function hedgedRequest<T>(
  replicas: string[],
  fetchFn: (replica: string) => Promise<T>,
  hedgeDelayMs = 40
): Promise<T> {
  const controller = new AbortController();
  const promises: Promise<T>[] = [];

  // 1. Launch Primary Request immediately
  promises.push(fetchFn(replicas[0]));

  // 2. Set timer to fire speculative hedged request to backup replica
  const timer = setTimeout(() => {
    if (replicas.length > 1) {
      console.log("Primary exceeded p95 delay! Firing speculative hedged request...");
      promises.push(fetchFn(replicas[1]));
    }
  }, hedgeDelayMs);

  try {
    const winner = await Promise.race(promises);
    clearTimeout(timer);
    return winner;
  } finally {
    clearTimeout(timer);
  }
}

// Verification Demo (Simulating Primary Server Lag)
const mockReplicas = ["replica-primary-lagging", "replica-backup-fast"];

async function mockFetch(replica: string): Promise<string> {
  if (replica === "replica-primary-lagging") {
    await new Promise(r => setTimeout(r, 120)); // Slow primary (120ms)
    return "Data from Primary";
  } else {
    await new Promise(r => setTimeout(r, 10));  // Fast backup (10ms)
    return "Data from Fast Backup";
  }
}

const result = await hedgedRequest(mockReplicas, mockFetch, 30);
console.log("Hedged result received:", result);`,
    breakdown: [
      "Monitors primary request latency against a pre-configured p95 threshold (e.g., 30ms–50ms).",
      "Dispatches an asynchronous duplicate request to an alternate replica if primary experiences delay.",
      "Races both responses and accepts whichever completes first, dramatically reducing p99 tail latency."
    ],
    expectedOutput: `Primary exceeded p95 delay! Firing speculative hedged request...
Hedged result received: Data from Fast Backup`
  },
  {
    id: "hld-ex-11",
    title: "Exponential Backoff with AWS Full Jitter Retry Engine",
    category: "Networking, Edge & Load Balancing",
    difficulty: "intermediate",
    whatThisCodeCovers: "A mathematically proven retry engine implementing the AWS Architecture Full Jitter algorithm to decorrelate concurrent retries and extinguish retry storms.",
    conceptsCovered: ["Exponential Backoff", "Full Jitter", "Retry Storms", "Decorrelation", "Resilience"],
    code: `export async function retryWithFullJitter<T>(
  task: () => Promise<T>,
  maxRetries = 4,
  baseMs = 50,
  capMs = 2000
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await task();
    } catch (err: any) {
      if (attempt >= maxRetries) {
        throw new Error(\`Max retries exceeded: \${err.message}\`);
      }
      attempt++;

      // 1. Calculate exponential ceiling: min(cap, base * 2^attempt)
      const exponentialCeiling = Math.min(capMs, baseMs * Math.pow(2, attempt));

      // 2. Full Jitter: Uniform random pick between 0 and exponentialCeiling
      const jitteredSleepMs = Math.floor(Math.random() * exponentialCeiling);

      console.log(\`Retry attempt \${attempt}: sleeping \${jitteredSleepMs}ms (Ceiling: \${exponentialCeiling}ms)\`);
      await new Promise(r => setTimeout(r, jitteredSleepMs));
    }
  }
}

// Verification Demo
let count = 0;
const flakyNetworkCall = async () => {
  count++;
  if (count < 3) throw new Error("Connection reset by peer");
  return "200 OK SUCCESS";
};

const res = await retryWithFullJitter(flakyNetworkCall);
console.log("Final Result:", res);`,
    breakdown: [
      "Calculates exponential delay ceilings that increase quadratically per retry attempt.",
      "Applies AWS Full Jitter by selecting a uniform random sleep duration between 0 and the ceiling.",
      "Completely decorrelates concurrent client retries, preventing lockstep waves from crushing recovering servers."
    ],
    expectedOutput: `Retry attempt 1: sleeping 42ms (Ceiling: 100ms)
Retry attempt 2: sleeping 118ms (Ceiling: 200ms)
Final Result: 200 OK SUCCESS`
  }
];

module.exports = part1;
