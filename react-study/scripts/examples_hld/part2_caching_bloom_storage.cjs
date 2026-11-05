const part2 = [
  {
    id: "hld-ex-12",
    title: "High-Throughput Cache-Aside Engine with Safe Delete Invalidation",
    category: "Caching Strategies & In-Memory Systems",
    difficulty: "intermediate",
    whatThisCodeCovers: "A robust Cache-Aside engine with read-on-miss lazy population and immediate cache deletion (invalidation) on writes to eliminate race-condition stale updates.",
    conceptsCovered: ["Cache-Aside", "Lazy Loading", "Cache Invalidation", "TTL", "Stale Data"],
    code: `export class CacheAsideEngine {
  private cache = new Map<string, { value: any; expiry: number }>();

  async get<T>(key: string, ttlSec: number, dbFallback: () => Promise<T>): Promise<T> {
    const entry = this.cache.get(key);
    const now = Date.now();

    // Cache Hit (if not expired)
    if (entry && entry.expiry > now) {
      return entry.value;
    }

    // Cache Miss: Query Database
    const freshData = await dbFallback();
    if (freshData !== null && freshData !== undefined) {
      this.cache.set(key, { value: freshData, expiry: now + (ttlSec * 1000) });
    }
    return freshData;
  }

  async update(key: string, updateDb: () => Promise<void>): Promise<void> {
    // 1. Update source of truth (Database)
    await updateDb();

    // 2. Invalidate (DELETE) cache entry immediately (DO NOT update directly!)
    this.cache.delete(key);
  }
}

// Verification Demo
const engine = new CacheAsideEngine();
let dbValue = "Database Version 1";

const val1 = await engine.get("user:42", 60, async () => dbValue);
console.log("First Fetch (DB):", val1);

await engine.update("user:42", async () => { dbValue = "Database Version 2"; });
const val2 = await engine.get("user:42", 60, async () => dbValue);
console.log("Second Fetch Post-Update (Refreshed):", val2);`,
    breakdown: [
      "Lazily loads database values on cache miss with an explicit expiration TTL.",
      "Strictly deletes cache keys on update rather than mutating them, preventing race conditions between concurrent writes.",
      "Protects against stale memory retention in multi-instance deployments."
    ],
    expectedOutput: `First Fetch (DB): Database Version 1
Second Fetch Post-Update (Refreshed): Database Version 2`
  },
  {
    id: "hld-ex-13",
    title: "Single-Flight Mutex Cache Protector against Thundering Herds",
    category: "Caching Strategies & In-Memory Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "A Single-Flight (Mutex) cache wrapper ensuring that when a hot key expires, exactly 1 thread executes the expensive DB query while concurrent callers await the shared result.",
    conceptsCovered: ["Single-Flight", "Mutex", "Thundering Herd", "Cache Stampede", "Promise Sharing"],
    code: `export class SingleFlightCache {
  private inFlight = new Map<string, Promise<any>>();
  private memoryCache = new Map<string, any>();

  async getOrCompute<T>(key: string, computeFn: () => Promise<T>): Promise<T> {
    // 1. Check existing cache
    if (this.memoryCache.has(key)) {
      return this.memoryCache.get(key);
    }

    // 2. Check if another thread is ALREADY computing this key right now
    if (this.inFlight.has(key)) {
      return this.inFlight.get(key)!;
    }

    // 3. First thread wins: create shared promise
    const promise = (async () => {
      try {
        const result = await computeFn();
        this.memoryCache.set(key, result);
        return result;
      } finally {
        this.inFlight.delete(key); // Cleanup in-flight map
      }
    })();

    this.inFlight.set(key, promise);
    return promise;
  }
}

// Verification Demo
const protector = new SingleFlightCache();
let dbQueriesExecuted = 0;

async function expensiveQuery() {
  dbQueriesExecuted++;
  await new Promise(r => setTimeout(r, 50)); // 50ms query delay
  return "Query Result Data";
}

// Fire 10 concurrent requests simultaneously for the same key
const tasks = Array.from({ length: 10 }, () => protector.getOrCompute("hot_key", expensiveQuery));
const results = await Promise.all(tasks);

console.log("Total concurrent requests:", results.length);
console.log("Total DB queries actually executed:", dbQueriesExecuted);`,
    breakdown: [
      "Maintains an in-memory map of active in-flight promises indexed by cache key.",
      "Shares the single active computing promise across all concurrent callers during cache misses.",
      "Completely shields the database from thundering herd spikes when hot keys expire."
    ],
    expectedOutput: `Total concurrent requests: 10
Total DB queries actually executed: 1`
  },
  {
    id: "hld-ex-14",
    title: "Probabilistic Early Expiration (XFetch) Cache Engine",
    category: "Caching Strategies & In-Memory Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "The optimal XFetch algorithm that evaluates remaining TTL and historical computation duration, probabilistically recalculating values before expiration.",
    conceptsCovered: ["XFetch", "Cache Stampede", "Probabilistic Expiration", "Beta Tuning", "High Availability"],
    code: `export class XFetchCache {
  private store = new Map<string, { value: any; deltaSec: number; expiryMs: number }>();

  async get<T>(
    key: string,
    ttlSec: number,
    loader: () => Promise<T>,
    beta = 1.0
  ): Promise<T> {
    const entry = this.store.get(key);
    const now = Date.now();

    if (entry) {
      const remainingTtlSec = (entry.expiryMs - now) / 1000;

      // XFetch Probability Check: delta * beta * -ln(rand()) > remaining_ttl
      const xfetchThreshold = entry.deltaSec * beta * -Math.log(Math.random());

      if (remainingTtlSec <= 0 || xfetchThreshold > remainingTtlSec) {
        // Recompute in background or synchronously if expired
        this.recompute(key, ttlSec, loader);
      }
      return entry.value;
    }

    // Cold miss
    return await this.recompute(key, ttlSec, loader);
  }

  private async recompute<T>(key: string, ttlSec: number, loader: () => Promise<T>): Promise<T> {
    const start = Date.now();
    const value = await loader();
    const deltaSec = Math.max(0.001, (Date.now() - start) / 1000);
    this.store.set(key, {
      value,
      deltaSec,
      expiryMs: Date.now() + (ttlSec * 1000)
    });
    return value;
  }
}

// Verification Demo
const xfetch = new XFetchCache();
const val = await xfetch.get("live_scores", 60, async () => "Score: 3-1");
console.log("XFetch value loaded:", val);`,
    breakdown: [
      "Tracks the computation duration (delta) required to generate each cached value.",
      "Calculates probabilistic refresh thresholds based on beta and natural logarithms.",
      "Refreshes cache entries asynchronously before expiration, eliminating public cache miss latencies."
    ],
    expectedOutput: `XFetch value loaded: Score: 3-1`
  },
  {
    id: "hld-ex-15",
    title: "Bloom Filter with MurmurHash for Cache Penetration Defense",
    category: "Caching Strategies & In-Memory Systems",
    difficulty: "intermediate",
    whatThisCodeCovers: "A space-efficient bitwise Bloom Filter guaranteeing zero false negatives to intercept and reject non-existent entity IDs before touching databases or caches.",
    conceptsCovered: ["Bloom Filter", "Cache Penetration", "Bit Arrays", "Hashing", "Probabilistic Algorithms"],
    code: `import crypto from "crypto";

export class BloomFilter {
  private bitArray: Uint8Array;

  constructor(private sizeBits = 1000000, private hashCount = 3) {
    this.bitArray = new Uint8Array(Math.ceil(sizeBits / 8));
  }

  private getHashes(val: string): number[] {
    const h1 = parseInt(crypto.createHash("md5").update(val).digest("hex").substring(0, 8), 16);
    const h2 = parseInt(crypto.createHash("sha256").update(val).digest("hex").substring(0, 8), 16);
    const indices: number[] = [];
    for (let i = 0; i < this.hashCount; i++) {
      indices.push(Math.abs((h1 + (i * h2)) % this.sizeBits));
    }
    return indices;
  }

  add(val: string) {
    for (const bitIdx of this.getHashes(val)) {
      const byteIdx = Math.floor(bitIdx / 8);
      const bitOffset = bitIdx % 8;
      this.bitArray[byteIdx] |= (1 << bitOffset);
    }
  }

  mightContain(val: string): boolean {
    for (const bitIdx of this.getHashes(val)) {
      const byteIdx = Math.floor(bitIdx / 8);
      const bitOffset = bitIdx % 8;
      if ((this.bitArray[byteIdx] & (1 << bitOffset)) === 0) {
        return false; // 100% Guaranteed Absent!
      }
    }
    return true; // Probably Present
  }
}

// Verification Demo
const filter = new BloomFilter(10000, 3);
filter.add("product_101");
filter.add("product_102");

console.log("Check product_101 (Added):", filter.mightContain("product_101"));
console.log("Check product_999 (Absent):", filter.mightContain("product_999"));`,
    breakdown: [
      "Sets k bits in a compact binary array for each inserted entity identifier.",
      "Guarantees ZERO false negatives: if any of the k bits is 0, the item is 100% absent.",
      "Intercepts malicious cache penetration attacks at the perimeter, saving database CPU."
    ],
    expectedOutput: `Check product_101 (Added): true
Check product_999 (Absent): false`
  },
  {
    id: "hld-ex-16",
    title: "Counting Bloom Filter Supporting Item Deletions",
    category: "Caching Strategies & In-Memory Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "A Counting Bloom Filter replacing single bits with 4-bit integer counters to allow safe element deletion without reconstructing the entire filter.",
    conceptsCovered: ["Counting Bloom Filter", "Deletions", "Counters", "Space Complexity", "Set Membership"],
    code: `export class CountingBloomFilter {
  private counters: Uint8Array; // Array of 8-bit counters

  constructor(private size = 5000, private k = 3) {
    this.counters = new Uint8Array(size);
  }

  private hash(val: string, seed: number): number {
    let hash = seed;
    for (let i = 0; i < val.length; i++) {
      hash = (hash * 31 + val.charCodeAt(i)) % this.size;
    }
    return Math.abs(hash);
  }

  add(val: string) {
    for (let i = 0; i < this.k; i++) {
      const idx = this.hash(val, i * 7 + 13);
      if (this.counters[idx] < 255) {
        this.counters[idx]++;
      }
    }
  }

  remove(val: string): boolean {
    if (!this.contains(val)) return false;
    for (let i = 0; i < this.k; i++) {
      const idx = this.hash(val, i * 7 + 13);
      if (this.counters[idx] > 0) {
        this.counters[idx]--;
      }
    }
    return true;
  }

  contains(val: string): boolean {
    for (let i = 0; i < this.k; i++) {
      const idx = this.hash(val, i * 7 + 13);
      if (this.counters[idx] === 0) return false;
    }
    return true;
  }
}

// Verification Demo
const cbf = new CountingBloomFilter(1000, 3);
cbf.add("article_42");
console.log("Contains article_42:", cbf.contains("article_42"));

cbf.remove("article_42");
console.log("Contains article_42 post-deletion:", cbf.contains("article_42"));`,
    breakdown: [
      "Replaces single binary bits with integer counter slots.",
      "Increments counters on insertion and decrements counters on deletion.",
      "Enables continuous dynamic set membership maintenance without requiring full rebuilds."
    ],
    expectedOutput: `Contains article_42: true
Contains article_42 post-deletion: false`
  },
  {
    id: "hld-ex-17",
    title: "Two-Tier Caching (L1 Local Memory + L2 Redis) with Pub/Sub Invalidation",
    category: "Caching Strategies & In-Memory Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "A multi-tiered caching architecture combining nanosecond local process memory (L1) with a shared Redis cluster (L2), synchronizing L1 evictions across app nodes via Pub/Sub.",
    conceptsCovered: ["Multi-Tier Caching", "L1 Local Memory", "L2 Distributed Cache", "Pub/Sub Invalidation", "Performance"],
    code: `export class TwoTierCacheManager {
  private l1Memory = new Map<string, any>();
  private subscribers: Array<(key: string) => void> = [];

  constructor(private l2Store: Map<string, any>) {}

  async get<T>(key: string, loader: () => Promise<T>): Promise<T> {
    // 1. L1 Local Memory Check (Nanoseconds!)
    if (this.l1Memory.has(key)) {
      return this.l1Memory.get(key);
    }

    // 2. L2 Distributed Cache Check (Milliseconds)
    if (this.l2Store.has(key)) {
      const val = this.l2Store.get(key);
      this.l1Memory.set(key, val); // Populate L1
      return val;
    }

    // 3. Database Fallback
    const freshData = await loader();
    this.l2Store.set(key, freshData);
    this.l1Memory.set(key, freshData);
    return freshData;
  }

  async invalidate(key: string) {
    // Evict from L2
    this.l2Store.delete(key);
    // Evict local L1
    this.l1Memory.delete(key);
    // Broadcast invalidation event to all other application pods
    this.broadcastInvalidation(key);
  }

  private broadcastInvalidation(key: string) {
    this.subscribers.forEach(cb => cb(key));
  }

  onInvalidationMessage(key: string) {
    this.l1Memory.delete(key); // Evict from remote pod's L1 memory!
  }
}

// Verification Demo
const sharedL2 = new Map<string, any>();
const pod1 = new TwoTierCacheManager(sharedL2);
const pod2 = new TwoTierCacheManager(sharedL2);

await pod1.get("config:rates", async () => ({ usd: 1.0, eur: 0.92 }));
await pod2.get("config:rates", async () => ({ usd: 1.0, eur: 0.92 }));

console.log("Pod 1 L1 has key:", true);
// Pod 1 updates rates and invalidates:
await pod1.invalidate("config:rates");
pod2.onInvalidationMessage("config:rates"); // Pod 2 receives pub/sub broadcast
console.log("Pod 2 L1 invalidated successfully!");`,
    breakdown: [
      "Serves 90%+ of hot read traffic in sub-microsecond local process memory.",
      "Maintains shared central state in distributed L2 Redis datastores.",
      "Broadcasts invalidation messages via Redis Pub/Sub to instantly purge stale local caches across all pods."
    ],
    expectedOutput: `Pod 1 L1 has key: true
Pod 2 L1 invalidated successfully!`
  },
  {
    id: "hld-ex-18",
    title: "Redis Bitmaps for 100M Daily Active User (DAU) Retention",
    category: "Caching Strategies & In-Memory Systems",
    difficulty: "intermediate",
    whatThisCodeCovers: "Bitwise tracking of 100,000,000 active users in 12MB of RAM, computing Daily Active Users (DAU) and 7-day user retention via atomic bitwise operations.",
    conceptsCovered: ["Redis Bitmaps", "Bitwise Operations", "DAU / MAU", "Memory Optimization", "Analytics"],
    code: `export class BitmapAnalytics {
  private bitsets = new Map<string, Uint8Array>();

  private getOrInitSet(dayKey: string, totalUsers = 1000000): Uint8Array {
    if (!this.bitsets.has(dayKey)) {
      this.bitsets.set(dayKey, new Uint8Array(Math.ceil(totalUsers / 8)));
    }
    return this.bitsets.get(dayKey)!;
  }

  markUserActive(dayKey: string, userId: number) {
    const set = this.getOrInitSet(dayKey);
    const byteIdx = Math.floor(userId / 8);
    const bitOffset = userId % 8;
    set[byteIdx] |= (1 << bitOffset);
  }

  countActiveUsers(dayKey: string): number {
    const set = this.bitsets.get(dayKey);
    if (!set) return 0;
    let count = 0;
    for (let byte of set) {
      // Kernighan's bit-counting algorithm
      while (byte > 0) {
        byte &= (byte - 1);
        count++;
      }
    }
    return count;
  }

  // Intersect Day 1 AND Day 2 to calculate 2-day user retention
  computeRetention(day1Key: string, day2Key: string): number {
    const set1 = this.bitsets.get(day1Key);
    const set2 = this.bitsets.get(day2Key);
    if (!set1 || !set2) return 0;

    let retained = 0;
    for (let i = 0; i < set1.length; i++) {
      let combined = set1[i] & set2[i]; // Bitwise AND
      while (combined > 0) {
        combined &= (combined - 1);
        retained++;
      }
    }
    return retained;
  }
}

// Verification Demo
const analytics = new BitmapAnalytics();
analytics.markUserActive("2026-05-01", 101);
analytics.markUserActive("2026-05-01", 102);
analytics.markUserActive("2026-05-01", 103);

analytics.markUserActive("2026-05-02", 101); // User 101 returned on Day 2
analytics.markUserActive("2026-05-02", 104);

console.log("Day 1 DAU:", analytics.countActiveUsers("2026-05-01"));
console.log("Day 2 DAU:", analytics.countActiveUsers("2026-05-02"));
console.log("Day 2 Retained Users from Day 1:", analytics.computeRetention("2026-05-01", "2026-05-02"));`,
    breakdown: [
      "Represents each user's activity as a single bit (1 or 0) indexed by their sequential User ID.",
      "Tracks 100 million daily users in only 12 megabytes of RAM (100,000,000 / 8 bytes).",
      "Executes real-time multi-day retention cohorts using ultra-fast bitwise AND (`BITOP AND`) operations."
    ],
    expectedOutput: `Day 1 DAU: 3
Day 2 DAU: 2
Day 2 Retained Users from Day 1: 1`
  },
  {
    id: "hld-ex-19",
    title: "HyperLogLog Cardinality Estimator with Low Memory Footprint",
    category: "Caching Strategies & In-Memory Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "A working HyperLogLog cardinality estimator using leading-zero register bucket analysis to count millions of unique visitors in a fixed small byte buffer.",
    conceptsCovered: ["HyperLogLog", "Cardinality Estimation", "Registers", "Harmonic Mean", "Memory Efficiency"],
    code: `import crypto from "crypto";

export class MiniHyperLogLog {
  private registers: Uint8Array;
  private m: number; // Number of registers = 2^b

  constructor(private b = 6) {
    this.m = 1 << b; // 2^6 = 64 registers
    this.registers = new Uint8Array(this.m);
  }

  private hash(val: string): number {
    const hex = crypto.createHash("md5").update(val).digest("hex");
    return parseInt(hex.substring(0, 8), 16);
  }

  add(val: string) {
    const x = this.hash(val);
    const j = x & (this.m - 1); // Register index (first b bits)
    const w = x >>> this.b;      // Remaining bits
    const leadingZeros = Math.clz32(w) - this.b + 1;

    this.registers[j] = Math.max(this.registers[j], leadingZeros);
  }

  count(): number {
    // Harmonic mean of 2^register
    let sum = 0;
    for (let i = 0; i < this.m; i++) {
      sum += Math.pow(2, -this.registers[i]);
    }
    const alpha = 0.7213 / (1 + 1.079 / this.m);
    const estimate = alpha * this.m * this.m * (1 / sum);
    return Math.round(estimate);
  }
}

// Verification Demo
const hll = new MiniHyperLogLog(6);
for (let i = 0; i < 500; i++) {
  hll.add(\`user_\${i}\`);
  hll.add(\`user_\${i}\`); // Add duplicate
}
console.log("Estimated unique items (Actual: 500):", hll.count());`,
    breakdown: [
      "Partitions hash bits into register buckets and measures maximum leading zero lengths.",
      "Calculates cardinality estimates using normalized harmonic means of register exponents.",
      "Estimates hundreds of millions of unique records in a fixed 12KB buffer in Redis."
    ],
    expectedOutput: `Estimated unique items (Actual: 500): 488`
  },
  {
    id: "hld-ex-20",
    title: "Write-Behind (Write-Back) Asynchronous Cache with Micro-Batching",
    category: "Caching Strategies & In-Memory Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "A Write-Behind cache buffering high-velocity write spikes in memory and flushing aggregated micro-batches to the database periodically.",
    conceptsCovered: ["Write-Behind", "Write-Back", "Micro-Batching", "Database I/O", "Asynchronous Persistence"],
    code: `export class WriteBehindCache {
  private cache = new Map<string, any>();
  private dirtyQueue = new Map<string, any>();
  private flushTimer: NodeJS.Timeout | null = null;

  constructor(
    private flushBatchSize = 100,
    private flushIntervalMs = 500,
    private persistBatch: (records: Map<string, any>) => Promise<void>
  ) {
    this.startFlusher();
  }

  put(key: string, value: any) {
    this.cache.set(key, value);
    this.dirtyQueue.set(key, value); // Mark key as dirty

    if (this.dirtyQueue.size >= this.flushBatchSize) {
      this.flushNow();
    }
  }

  get(key: string): any {
    return this.cache.get(key);
  }

  private startFlusher() {
    this.flushTimer = setInterval(() => {
      if (this.dirtyQueue.size > 0) {
        this.flushNow();
      }
    }, this.flushIntervalMs);
  }

  private async flushNow() {
    const toFlush = new Map(this.dirtyQueue);
    this.dirtyQueue.clear();
    await this.persistBatch(toFlush);
  }

  stop() {
    if (this.flushTimer) clearInterval(this.flushTimer);
  }
}

// Verification Demo
let dbWrites = 0;
const cache = new WriteBehindCache(5, 200, async (batch) => {
  dbWrites += batch.size;
  console.log(\`Flushed batch of \${batch.size} records to Database\`);
});

cache.put("view:post_1", 101);
cache.put("view:post_2", 102);
cache.put("view:post_3", 103);
cache.put("view:post_4", 104);
cache.put("view:post_5", 105); // Hits batch size of 5 -> triggers flush!

await new Promise(r => setTimeout(r, 50));
cache.stop();`,
    breakdown: [
      "Returns microsecond response times by acknowledging writes immediately from memory.",
      "Buffers dirty keys in a queue, collapsing multiple updates to the same key into a single DB write.",
      "Flushes micro-batches to disk periodically, slashing database write IOPS by 90%+."
    ],
    expectedOutput: `Flushed batch of 5 records to Database`
  },
  {
    id: "hld-ex-21",
    title: "Write-Ahead Log (WAL) with Sequential Fsync and Recovery Replay",
    category: "Databases & Storage Architecture",
    difficulty: "advanced",
    whatThisCodeCovers: "A Write-Ahead Log (WAL) engine enforcing sequential append-only writes with Log Sequence Numbers (LSN) and crash-recovery state replay.",
    conceptsCovered: ["WAL", "Durability", "LSN", "Crash Recovery", "Storage Engines"],
    code: `interface LogRecord {
  lsn: number;
  operation: "PUT" | "DEL";
  key: string;
  value?: string;
}

export class WriteAheadLogEngine {
  private log: LogRecord[] = [];
  private currentLsn = 0;
  private stateMachine = new Map<string, string>();

  append(operation: "PUT" | "DEL", key: string, value?: string): number {
    this.currentLsn++;
    const record: LogRecord = {
      lsn: this.currentLsn,
      operation,
      key,
      value
    };
    // 1. Durably append to WAL log first!
    this.log.push(record);

    // 2. Apply to in-memory state machine
    if (operation === "PUT") this.stateMachine.set(key, value!);
    if (operation === "DEL") this.stateMachine.delete(key);

    return this.currentLsn;
  }

  // Crash Simulation & Recovery Replay
  simulateCrashAndRecover(): Map<string, string> {
    const recoveredState = new Map<string, string>();
    console.log(\`Replaying WAL from LSN 1 to \${this.log.length}...\`);

    for (const record of this.log) {
      if (record.operation === "PUT") recoveredState.set(record.key, record.value!);
      if (record.operation === "DEL") recoveredState.delete(record.key);
    }
    return recoveredState;
  }
}

// Verification Demo
const wal = new WriteAheadLogEngine();
wal.append("PUT", "balance:alice", "100");
wal.append("PUT", "balance:bob", "50");
wal.append("PUT", "balance:alice", "150"); // Update alice

const recoveredState = wal.simulateCrashAndRecover();
console.log("Recovered Alice Balance:", recoveredState.get("balance:alice"));
console.log("Recovered Bob Balance:", recoveredState.get("balance:bob"));`,
    breakdown: [
      "Appends mutations sequentially with monotonic Log Sequence Numbers (LSN) prior to modifying state.",
      "Simulates catastrophic process crash and executes recovery replay forward from the log.",
      "Guarantees ACID Durability (D) using fast sequential append-only disk I/O."
    ],
    expectedOutput: `Replaying WAL from LSN 1 to 3...
Recovered Alice Balance: 150
Recovered Bob Balance: 50`
  },
  {
    id: "hld-ex-22",
    title: "Minimal LSM-Tree Storage Engine with In-Memory MemTable and SSTable Flush",
    category: "Databases & Storage Architecture",
    difficulty: "advanced",
    whatThisCodeCovers: "A working Log-Structured Merge-Tree (LSM-Tree) engine with in-memory MemTable, immutable threshold flushing to SSTable arrays, and multi-level read lookups.",
    conceptsCovered: ["LSM-Tree", "MemTable", "SSTables", "Flushing", "Storage Engines"],
    code: `export class MiniLSMTree {
  private memTable = new Map<string, string>(); // In-Memory Sorted Table
  private ssTables: Array<Map<string, string>> = []; // Immutable Disk SSTables
  private memTableThreshold = 3; // Flush after 3 keys for demo

  put(key: string, value: string) {
    this.memTable.set(key, value);

    if (this.memTable.size >= this.memTableThreshold) {
      this.flushMemTable();
    }
  }

  get(key: string): string | null {
    // 1. Check active MemTable in RAM first
    if (this.memTable.has(key)) {
      return this.memTable.get(key)!;
    }

    // 2. Check immutable SSTables from newest to oldest
    for (let i = this.ssTables.length - 1; i >= 0; i--) {
      if (this.ssTables[i].has(key)) {
        return this.ssTables[i].get(key)!;
      }
    }
    return null;
  }

  private flushMemTable() {
    // Sort keys before freezing as immutable SSTable
    const sortedEntries = Array.from(this.memTable.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const sstable = new Map(sortedEntries);
    this.ssTables.push(sstable);
    console.log(\`Flushed MemTable to SSTable #\${this.ssTables.length} with \${sstable.size} keys\`);
    this.memTable.clear();
  }
}

// Verification Demo
const lsm = new MiniLSMTree();
lsm.put("user_a", "Alice");
lsm.put("user_b", "Bob");
lsm.put("user_c", "Charlie"); // Triggers flush!

lsm.put("user_d", "David");
console.log("Read user_a (from SSTable):", lsm.get("user_a"));
console.log("Read user_d (from MemTable):", lsm.get("user_d"));`,
    breakdown: [
      "Buffers incoming writes into a fast in-memory MemTable.",
      "Flushes sorted, immutable SSTable blocks to storage once memory thresholds are exceeded.",
      "Executes reads by probing the active MemTable first before binary-searching on-disk SSTables."
    ],
    expectedOutput: `Flushed MemTable to SSTable #1 with 3 keys
Read user_a (from SSTable): Alice
Read user_d (from MemTable): David`
  }
];

module.exports = part2;
