const { createCard } = require("../hld_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 37,
    category: "Caching Strategies & In-Memory Systems",
    concept: "Cache-Aside (Lazy Loading) vs Write-Through vs Write-Behind (Write-Back)",
    priority: "must-know",
    difficulty: "must-know",
    question: "Compare the mechanics, consistency trade-offs, and failure modes of Cache-Aside, Write-Through, Write-Behind (Write-Back), and Refresh-Ahead caching patterns.",
    answer: "Cache-Aside loads data on cache miss (lazy) with application-managed reads/writes; Write-Through synchronously writes to cache and database simultaneously, eliminating stale reads at the cost of write latency; Write-Behind asynchronously buffers writes in cache and flushes to database in batches, maximizing write performance but risking data loss if the cache crashes before flushing.",
    explanation: `Detailed Pattern Breakdown:
1. Cache-Aside (Lazy Loading):
   - Read Path: App queries Cache. If hit, return. If miss, app reads DB, populates Cache, and returns.
   - Write Path: App writes to DB, then invalidates (deletes) the cache entry.
   - Pros: Cache contains only requested data (memory efficient); cache failure doesn't crash the app (falls back to DB).
   - Cons: Cache miss penalty (3 round trips); potential stale data between write and eviction.
2. Write-Through:
   - App writes to Cache; Cache layer synchronously writes to DB before returning success.
   - Pros: Cache is always 100% consistent with DB; subsequent reads never miss.
   - Cons: Higher write latency (two synchronous writes).
3. Write-Behind (Write-Back):
   - App writes to Cache immediately; Cache acknowledges write instantly ($<1\\text{ms}$) and queues it.
   - Background worker asynchronously flushes updates to DB in micro-batches (e.g., every 5 seconds or 500 writes).
   - Pros: Extreme write throughput; absorbs write spikes; reduces database IOPS.
   - Cons: Data Loss Risk! If Redis/Memcached node crashes before flushing dirty writes, uncommitted data is permanently lost.
4. Refresh-Ahead:
   - System monitors access frequency and automatically re-fetches hot keys from DB before their TTL expires, preventing cache miss latency for users.`,
    code: `// Cache-Aside with Invalidation on Write (Production Pattern)
import Redis from "ioredis";
const redis = new Redis();

export async function getUserProfile(userId: string) {
  const cacheKey = \`user:\${userId}\`;
  const cached = await redis.get(cacheKey);
  if (cached) return JSON.parse(cached);

  // Cache Miss: Fetch from DB and set with TTL
  const user = await database.users.findById(userId);
  if (user) {
    await redis.setex(cacheKey, 3600, JSON.stringify(user)); // 1 hour TTL
  }
  return user;
}

export async function updateUserProfile(userId: string, data: any) {
  // Always update DB first
  await database.users.update(userId, data);
  // Invalidate cache immediately (DO NOT update cache directly to avoid race conditions)
  await redis.del(\`user:\${userId}\`);
}`,
    recallHint: "Aside: Read on miss, delete on write. Through: Write both at once. Behind: Write cache first, flush DB later.",
    interviewTip: "Never update the cache directly during a write in Cache-Aside; always DELETE the cache key. Updating the cache introduces race conditions between concurrent writes that leave stale data indefinitely.",
    tags: ["caching", "cache-aside", "write-through", "write-behind", "redis", "performance"]
  }),

  createCard({
    idNum: 38,
    category: "Caching Strategies & In-Memory Systems",
    concept: "Cache Eviction Policies (LRU, LFU, ARC, 2Q)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do LRU, LFU, Adaptive Replacement Cache (ARC), and Two-Queue (2Q) eviction policies decide which keys to discard when memory is full?",
    answer: "LRU (Least Recently Used) discards the item accessed furthest in the past; LFU (Least Frequently Used) discards items with the lowest access count; ARC (Adaptive Replacement Cache) dynamically tunes balance between recency and frequency in real-time; 2Q uses a FIFO queue for newly accessed items and a secondary LRU queue to prevent one-hit wonders from evicting hot working sets.",
    explanation: `Algorithm Analysis:
1. LRU (Least Recently Used):
   - Data structure: Hash Map + Doubly Linked List.
   - Flaw (Cache Pollution / Scan Vulnerability): If a batch job or table dump queries 1,000,000 keys once, LRU evicts the entire hot working set, filling the cache with items that will never be requested again.
2. LFU (Least Frequently Used):
   - Tracks total hit counter for each item.
   - Flaw (Frequency Starvation / Ghost Items): Historical items accessed 1,000,000 times during a morning flash sale remain trapped in the cache forever, blocking newer items with low counts. Requires periodic counter decay.
3. 2Q (Two Queue):
   - When key is first fetched, place it in an 'A1' FIFO queue.
   - If accessed a second time while in A1, promote to a long-term 'Am' LRU queue.
   - Single-access scan items are quickly ejected from A1 without polluting Am.
4. Redis Approximated LRU/LFU:
   - True LRU consumes 16 bytes per entry for doubly-linked pointers.
   - Redis uses Approximated LRU: samples 5 random keys (\`maxmemory-samples 5\`) and evicts the oldest from the sample. With 10 samples, it matches mathematical LRU with near-zero memory overhead.`,
    code: `// Redis maxmemory eviction configuration
/*
# redis.conf
maxmemory 8gb
maxmemory-policy allkeys-lru      # Evict least recently used key among all keys
# Alternatives:
# maxmemory-policy volatile-lru   # Evict LRU only among keys with an explicit TTL
# maxmemory-policy allkeys-lfu   # Evict least frequently used key (frequency counter)
# maxmemory-policy noeviction    # Return OOM error on writes when full
maxmemory-samples 10             # Higher accuracy sample pool
*/`,
    recallHint: "LRU = oldest access evicted. LFU = lowest count evicted. 2Q/ARC = prevent one-hit wonder pollution.",
    interviewTip: "Mention that Redis does not use a physical linked list for LRU due to pointer memory overhead; it samples random keys and tracks a 24-bit clock tick per object.",
    tags: ["caching", "lru", "lfu", "arc", "redis", "cache-eviction"]
  }),

  createCard({
    idNum: 39,
    category: "Caching Strategies & In-Memory Systems",
    concept: "Cache Stampede / Thundering Herd Prevention",
    priority: "must-know",
    difficulty: "advanced",
    question: "What causes a Cache Stampede (Thundering Herd), and how do Mutex Locks and Probabilistic Early Expiration (XFetch) eliminate it?",
    answer: "A cache stampede occurs when a high-traffic key expires, causing thousands of concurrent requests to simultaneously experience a cache miss and execute identical expensive database queries, crashing the database. It is resolved using Distributed Mutex Locks (single worker recomputes while others wait) or Probabilistic Early Expiration (XFetch algorithm recalculates key before expiration).",
    explanation: `The Thundering Herd Disaster:
Suppose key \`trending_products\` expires at 12:00:00 PM:
- The site receives 25,000 requests per second for this key.
- At 12:00:00.010, 250 requests encounter a cache miss within 10ms.
- All 250 requests execute \`SELECT * FROM products ... JOIN categories ...\` against the database.
- Database CPU reaches 100%, query latency jumps from 20ms to 5,000ms, and all connection pools exhaust.

Solution 1: Distributed Mutex Lock (Single Flight):
- First thread to encounter a miss acquires a short-lived Redis lock (\`SET lock:key token NX EX 5\`).
- Only that single thread queries the DB and repopulates the cache.
- The other 249 threads sleep for 50ms and retry reading the cache.

Solution 2: Probabilistic Early Expiration (XFetch Algorithm - Vattani et al.):
$$\\Delta - \\beta \\times \\ln(\\text{rand}()) > \\text{TTL}$$
- When reading a key, calculate an early refresh probability based on remaining TTL and computation time $\\Delta$.
- As TTL approaches 0, probability of early refresh approaches 1. Exactly one client refreshes the key in the background *before* it expires for the public.`,
    code: `// Single-Flight Mutex Pattern in Node.js
async function getWithMutex(key: string, ttlSec: number, fetchFn: () => Promise<any>) {
  const value = await redis.get(key);
  if (value) return JSON.parse(value);

  const lockKey = \`lock:\${key}\`;
  const acquired = await redis.set(lockKey, "1", "NX", "EX", 5);

  if (acquired) {
    try {
      // Sole winner fetches DB and populates cache
      const freshData = await fetchFn();
      await redis.setex(key, ttlSec, JSON.stringify(freshData));
      return freshData;
    } finally {
      await redis.del(lockKey);
    }
  } else {
    // Other concurrent requests sleep and read cache
    await new Promise((r) => setTimeout(r, 60));
    return getWithMutex(key, ttlSec, fetchFn);
  }
}`,
    recallHint: "Stampede: 10k threads slam DB on 1 key expire. Solve with Mutex or XFetch probabilistic refresh.",
    interviewTip: "If designing a caching system for high-concurrency read keys (e.g., homepage, sports live score), immediately proactively address the cache stampede problem using Single-Flight / Mutex.",
    tags: ["caching", "cache-stampede", "thundering-herd", "mutex", "xfetch", "redis"]
  }),

  createCard({
    idNum: 40,
    category: "Caching Strategies & In-Memory Systems",
    concept: "Cache Penetration vs Cache Breakdown vs Cache Avalanche",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Clearly define Cache Penetration, Cache Breakdown, and Cache Avalanche, detailing the exact mitigation strategy for each failure mode.",
    answer: "Cache Penetration occurs when requests query non-existent keys, repeatedly bypassing the cache to hit the database (fixed via Bloom Filters or caching null objects); Cache Breakdown happens when a single hot key expires under heavy load (fixed via Mutex locks or no-expiry keys); Cache Avalanche happens when hundreds of thousands of keys expire at the exact same second (fixed via TTL jitter/randomization).",
    explanation: `Failure Mode Matrix:
1. Cache Penetration (Malicious / Non-Existent Keys):
   - Scenario: Attacker requests \`/user/-9999\` or \`/user/random_hash_xyz\` 100,000 times.
   - Problem: Key never exists in Cache, and never exists in DB. Every single request falls through to the DB, overwhelming query threads.
   - Mitigation:
     - **Bloom Filter**: In-memory filter checks if ID could exist. If Bloom filter returns false, reject request immediately without touching cache or DB!
     - **Cache Nulls**: Store \`user:-9999 = "{}"\` with a short 60s TTL.
2. Cache Breakdown (Hotspot Key Expiration):
   - Scenario: A single viral celebrity tweet key expires.
   - Problem: Instantaneous spike of thousands of requests queries DB simultaneously.
   - Mitigation: Distributed Mutex (Single-flight) or background worker that periodically refreshes the key with no explicit TTL.
3. Cache Avalanche (Mass Expiration Synchronization):
   - Scenario: A batch job populates 2,000,000 product keys at 03:00 AM with a fixed 24-hour TTL (\`EX 86400\`).
   - Problem: At exactly 03:00 AM the next day, all 2,000,000 keys expire simultaneously. Cache hit rate drops from 99% to 0% in one millisecond.
   - Mitigation:
     - **TTL Jitter / Staggering**: Add a random delta to every TTL: \`TTL = baseTTL + random(-300, 300)\`.
     - Multi-tier caching with staggered expirations.`,
    code: `// Mitigating Cache Avalanche with TTL Jitter
function calculateJitteredTtl(baseTtlSeconds: number, jitterPercent = 0.2): number {
  const maxJitter = baseTtlSeconds * jitterPercent;
  const delta = (Math.random() * 2 - 1) * maxJitter; // between -maxJitter and +maxJitter
  return Math.floor(baseTtlSeconds + delta);
}

// Example: 1 hour base TTL produces random TTLs between 2880s and 4320s
const safeTtl = calculateJitteredTtl(3600);
await redis.setex(\`product:\${id}\`, safeTtl, data);`,
    recallHint: "Penetration = non-existent key (use Bloom). Breakdown = 1 hot key expires (use Mutex). Avalanche = all keys expire at once (use TTL jitter).",
    interviewTip: "Always recommend Bloom Filters for preventing Cache Penetration. It proves you understand memory-efficient probabilistic data structures in front of caching tiers.",
    tags: ["caching", "cache-penetration", "cache-breakdown", "cache-avalanche", "bloom-filter", "ttl-jitter"]
  }),

  createCard({
    idNum: 41,
    category: "Caching Strategies & In-Memory Systems",
    concept: "Bloom Filters & Counting Bloom Filters",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does a Bloom Filter determine set membership in $O(k)$ time with zero false negatives, and why are standard Bloom Filters incapable of item deletion?",
    answer: "A Bloom Filter is a space-efficient probabilistic data structure consisting of a bit array of size $m$ and $k$ independent cryptographic hash functions. It guarantees ZERO false negatives (if it says an element is absent, it is 100% definitely absent), but allows a tunable rate of false positives. Deletions are impossible because multiple keys share identical bit positions; Counting Bloom Filters enable deletion by replacing bits with integer counters.",
    explanation: `Mathematical Mechanics:
- Array: Bit array of $m$ bits, initially all 0s.
- Insertion of key $X$:
  - Calculate $k$ hashes: $h_1(X) \\pmod m, h_2(X) \\pmod m, \\dots, h_k(X) \\pmod m$.
  - Set all $k$ corresponding bits in the array to \`1\`.
- Query of key $Y$:
  - Calculate same $k$ hashes for $Y$.
  - Check the bit array at all $k$ indices:
    - If **ANY bit is 0**: Key $Y$ is **DEFINITELY NOT in the set** (Zero False Negatives).
    - If **ALL bits are 1**: Key $Y$ is **PROBABLY in the set** (False Positive Probability $\\approx (1 - e^{-kn/m})^k$).

Why Standard Bloom Filters Cannot Delete:
- If key $A$ set bit 42 to 1, and key $B$ also hashed to bit 42, clearing bit 42 to 'delete' key $A$ would falsely erase key $B$!
- Counting Bloom Filter (CBF) Solution: Uses 4-bit integer counters instead of single bits. Insertion increments the counter; deletion decrements the counter. Memory footprint is 4x larger.`,
    code: `// Minimal Bloom Filter Concept in TypeScript
import crypto from "crypto";

class BloomFilter {
  private bits: Uint8Array;
  constructor(private size = 1000000, private k = 3) {
    this.bits = new Uint8Array(Math.ceil(size / 8));
  }

  private getHashes(val: string): number[] {
    const h1 = parseInt(crypto.createHash("md5").update(val).digest("hex").substring(0, 8), 16);
    const h2 = parseInt(crypto.createHash("sha256").update(val).digest("hex").substring(0, 8), 16);
    return Array.from({ length: this.k }, (_, i) => Math.abs((h1 + i * h2) % this.size));
  }

  add(val: string) {
    for (const bitIdx of this.getHashes(val)) {
      this.bits[Math.floor(bitIdx / 8)] |= 1 << (bitIdx % 8);
    }
  }

  mightContain(val: string): boolean {
    for (const bitIdx of this.getHashes(val)) {
      if ((this.bits[Math.floor(bitIdx / 8)] & (1 << (bitIdx % 8))) === 0) {
        return false; // 100% Definitely Absent!
      }
    }
    return true; // Probably Present
  }
}`,
    recallHint: "Bloom Filter: Never lies about absence (0 false negatives). May say yes when it's no (false positive).",
    interviewTip: "Bloom filters are used in Google BigTable, Cassandra SSTables, and Medium (to track read articles). Cite them when designing search indexing or web crawlers.",
    tags: ["bloom-filter", "probabilistic-data-structures", "caching", "hashing", "algorithms"]
  }),

  createCard({
    idNum: 42,
    category: "Caching Strategies & In-Memory Systems",
    concept: "Redis Cluster Architecture & Hash Slots (CRC16)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Redis Cluster shard data horizontally across nodes using 16,384 Hash Slots, and how do Hash Tags ({...}) enforce multi-key operations on a single node?",
    answer: "Redis Cluster partitions the keyspace across 16,384 fixed hash slots using $\\text{CRC16}(key) \\pmod{16384}$. Each master node owns a contiguous subset of slots. Clients route requests directly to nodes, receiving \`MOVED\` or \`ASK\` redirections during cluster rebalancing. Hash Tags (\`{user123}:cart\`, \`{user123}:orders\`) force related keys into the identical hash slot, enabling multi-key transactions.",
    explanation: `Redis Cluster Mechanics:
- Why 16,384 Slots? Hash slots decouple keys from physical nodes. Adding or removing physical nodes simply moves ranges of slots between masters without re-hashing all individual keys.
- Slot Assignment:
  - Node A: Slots 0 – 5,460.
  - Node B: Slots 5,461 – 10,922.
  - Node C: Slots 10,923 – 16,383.
- Key Routing:
  $$\\text{slot} = \\text{CRC16}(\\text{key}) \\pmod{16384}$$
- Client Redirection (\`MOVED\` vs \`ASK\`):
  - \`MOVED 3999 10.0.0.2:6379\`: Permanent redirect. Client updates its internal slot-to-node cache table.
  - \`ASK 3999 10.0.0.3:6379\`: Temporary redirect during active slot migration; client does not update cache.

The Multi-Key Problem & Hash Tags:
Redis prohibits multi-key commands (\`MGET\`, \`MSET\`, Lua scripts, transactions) if keys reside on different hash slots on different nodes.
- Solution: Hash Tags \`{...}\`. Redis hashes only the text inside the curly brackets:
  - \`CRC16("{usr_42}.profile")\` hashes only \`usr_42\`.
  - \`CRC16("{usr_42}.orders")\` hashes only \`usr_42\`.
  - Both keys produce the exact same slot and are guaranteed to live on the same physical Redis master!`,
    code: `// Redis Cluster Hash Tag Usage in ioredis
import Redis from "ioredis";

const cluster = new Redis.Cluster([
  { host: "10.0.1.1", port: 6379 },
  { host: "10.0.1.2", port: 6379 }
]);

// Multi-key transaction guaranteed to succeed on same node via {user_99}
const pipeline = cluster.pipeline();
pipeline.set("{user_99}:profile", JSON.stringify({ name: "Alice" }));
pipeline.set("{user_99}:cart", JSON.stringify(["item_1", "item_2"]));
await pipeline.exec();`,
    recallHint: "Redis: 16,384 slots via CRC16. Use {tag} to lock multi-key queries to the same node.",
    interviewTip: "If an interviewer asks how to run Lua scripts or atomic multi-key transactions in a sharded Redis cluster, explain Hash Tags (`{user_id}`) to pin related keys to the same slot.",
    tags: ["redis", "redis-cluster", "hash-slots", "sharding", "hash-tags", "crc16"]
  }),

  createCard({
    idNum: 43,
    category: "Caching Strategies & In-Memory Systems",
    concept: "Multi-Tier Caching Architecture (L1 Local + L2 Distributed + L3 CDN)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Design a 3-tier caching hierarchy combining L1 Local Memory, L2 Distributed Redis, and L3 Edge CDN. How are invalidations propagated across tiers?",
    answer: "Multi-tier caching combines ultra-fast L1 local process memory (Go/Node.js in-process cache, sub-microsecond latency) with shared L2 distributed cache (Redis Cluster, 1–3ms latency) and L3 edge CDN (Cloudflare/CloudFront, closest to user). L1 invalidations are propagated across stateless app nodes using Redis Pub/Sub broadcast or local short TTLs.",
    explanation: `Multi-Tier Hierarchy Latency & Scope:
1. Tier 1: L1 Local In-Process Cache (e.g., node-cache, Guava, Caffeine):
   - Scope: Single app process RAM.
   - Latency: $< 1\\ \\mu\\text{s}$ (nanoseconds, zero network serialization).
   - Capacity: Small (e.g., 500MB).
   - Best for: Immutable reference data (country lists, currency exchange rates, high-frequency config).
2. Tier 2: L2 Distributed Shared Cache (e.g., Redis Cluster, Memcached):
   - Scope: Shared across all 1,000 application pods.
   - Latency: 1–3ms over VPC network.
   - Capacity: Large (e.g., 256GB–1TB).
   - Best for: Session states, user profiles, shopping carts.
3. Tier 3: L3 Edge CDN Cache (e.g., Cloudflare, CloudFront):
   - Scope: 250+ Edge POPs worldwide.
   - Latency: 5–20ms to end user browser.
   - Best for: Public catalog pages, static assets, thumbnail images.

The L1 Invalidation Problem (Ghost Data):
If Pod 1 updates a record, Pod 2 still holds the old record in its local L1 memory!
- Solution 1: Ultra-short L1 TTL (e.g., 5 seconds). Accept 5 seconds of bounded staleness.
- Solution 2: Redis Invalidation Pub/Sub. When Pod 1 updates DB, it publishes an invalidation event on Redis channel \`cache:invalidate\`. All app pods subscribe and evict the key from their local L1 caches immediately.`,
    code: `/*
Multi-Tier Read Pipeline:
Request ──> [ L1 Local RAM ] (Hit: 100ns)
                  │ Miss
            [ L2 Redis ]    (Hit: 1.5ms) ──> Populates L1
                  │ Miss
            [ Database ]    (Hit: 25ms)  ──> Populates L2 & L1
*/

// Two-Level Cache with Redis Pub/Sub Invalidation
class TwoTierCache {
  private l1 = new Map<string, any>();

  constructor(private redis: Redis, private sub: Redis) {
    this.sub.subscribe("l1:invalidate");
    this.sub.on("message", (channel, key) => {
      this.l1.delete(key); // Evict from local memory!
    });
  }

  async get(key: string, fetchDb: () => Promise<any>) {
    if (this.l1.has(key)) return this.l1.get(key);

    const l2 = await this.redis.get(key);
    if (l2) {
      const val = JSON.parse(l2);
      this.l1.set(key, val);
      return val;
    }

    const dbVal = await fetchDb();
    await this.redis.setex(key, 3600, JSON.stringify(dbVal));
    this.l1.set(key, dbVal);
    return dbVal;
  }
}`,
    recallHint: "L1 = nanosecond RAM. L2 = millisecond Redis. L3 = global Edge CDN. Sync L1 via Pub/Sub or short TTL.",
    interviewTip: "Proposing an in-process L1 cache in front of Redis reduces Redis cluster load by 80%+ during intense peak traffic, preventing Redis network interface saturation.",
    tags: ["multi-tier-caching", "l1-cache", "redis", "cdn", "invalidation", "performance"]
  }),

  createCard({
    idNum: 44,
    category: "Caching Strategies & In-Memory Systems",
    concept: "Advanced Redis Data Structures (HyperLogLog, GeoSets, Bitmaps, Streams)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Redis HyperLogLog, Geospatial Indexes (GeoSets), Bitmaps, and Streams solve hyper-scale system problems with minimal memory?",
    answer: "HyperLogLog estimates unique cardinalities (100M unique visitors) in a constant 12KB with 0.81% error; Bitmaps track boolean states (daily active users) using 1 bit per user; GeoSets index latitude/longitude via Geohash 52-bit integers in Sorted Sets for proximity search; Redis Streams provide append-only consumer-group messaging with persistent offsets.",
    explanation: `Specialized Redis Data Structures:
1. HyperLogLog (\`PFADD\`, \`PFCOUNT\`):
   - Problem: Count 500,000,000 unique IP addresses or user visits per day. Storing 500M UUIDs in a Set requires 16GB RAM.
   - Solution: HyperLogLog uses statistical register analysis of leading zeros. It handles millions of unique items using exactly 12KB of memory, with a standard error of 0.81%.
2. Bitmaps (\`SETBIT\`, \`BITCOUNT\`, \`BITOP\`):
   - Problem: Track user activity for 100,000,000 users over 30 days.
   - Solution: User ID = bit offset. If user 42 logs in today, \`SETBIT active:2026-05-01 42 1\`.
   - 100,000,000 bits = only 12MB of RAM per day!
   - Monthly active users (MAU) computed via bitwise \`BITOP OR monthly active:day1 active:day2...\`.
3. Geospatial Sets (\`GEOADD\`, \`GEOSEARCH\`):
   - Encodes (lat, lon) into a 52-bit Geohash integer stored in a Redis Sorted Set (ZSET).
   - Enables real-time nearby driver searches (\`GEOSEARCH drivers FROMLONLAT 139.69 35.68 BYRADIUS 5 km\`) in sub-millisecond time.
4. Redis Streams (\`XADD\`, \`XREADGROUP\`):
   - Append-only log with persistent consumer groups, acknowledgment tracking (\`XACK\`), and pending entry lists (PEL). Lightweight alternative to Kafka for sub-billion scale.`,
    code: `// Redis Bitmaps for Real-Time DAU / Retention
const todayKey = "active:2026-05-01";
// Mark user 88219 as active today
await redis.setbit(todayKey, 88219, 1);

// Count Daily Active Users in 1 millisecond
const dau = await redis.bitcount(todayKey);
console.log("Total DAU today:", dau);

// Redis HyperLogLog for Unique Video Views
await redis.pfadd("views:video_999", "ip_104_12", "ip_88_41", "ip_104_12");
const uniqueViews = await redis.pfcount("views:video_999");
console.log("Unique Viewers:", uniqueViews);`,
    recallHint: "HyperLogLog = 12KB for 100M unique counts. Bitmap = 12MB for 100M user DAU. Geo = ZSET 52-bit geohash.",
    interviewTip: "In analytics, metrics, or ride-hailing interviews, using HyperLogLog, Bitmaps, or GeoSets shows profound knowledge of memory optimization.",
    tags: ["redis", "hyperloglog", "bitmaps", "geospatial", "streams", "data-structures"]
  }),

  createCard({
    idNum: 45,
    category: "Caching Strategies & In-Memory Systems",
    concept: "Cache Invalidation & Dual-Write Inconsistencies",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why do dual-writes to database and cache inevitably lead to race-condition inconsistencies, and how does Change Data Capture (CDC) resolve this?",
    answer: "Dual writes fail because updating the database and cache in two separate commands is not atomic. Concurrent writes (Thread 1 writes DB, Thread 2 writes DB, Thread 2 updates Cache, Thread 1 updates Cache) produce inverted stale states in the cache permanently. Change Data Capture (CDC via Debezium) solves this by tailing the database Write-Ahead Log (WAL) to update the cache asynchronously in exact commit order.",
    explanation: `The Dual-Write Race Condition:
Consider two concurrent requests updating the same user record:
- Time $T_1$: Thread A writes to DB (\`balance = 100\`).
- Time $T_2$: Thread B writes to DB (\`balance = 200\`).
- Time $T_3$: Thread B updates Cache (\`balance = 200\`).
- Time $T_4$: Thread A (delayed by network jitter) updates Cache (\`balance = 100\`).
Outcome: Database has \`balance = 200\`, but Cache holds stale \`balance = 100\` permanently!

Why 'Cache Delete' Still Has Minor Races:
Thread 1 reads DB (miss), Thread 2 updates DB and deletes Cache, Thread 1 writes old read to Cache. (Mitigated by short TTLs).

The Production Solution: Change Data Capture (CDC):
- Application writes strictly to the Database primary.
- The Database commits changes to its sequential Write-Ahead Log (WAL).
- Debezium / Kafka Connect tails the WAL and publishes ordered change events to a Kafka topic.
- A dedicated Cache Invalidator consumer processes Kafka events in strict order and deletes/updates the cache.
- Eliminates application-layer dual-write race conditions entirely.`,
    code: `/*
CDC-Driven Cache Invalidation Topology:
[ App Service ] ──> (Single Write) ──> [ PostgreSQL Primary ]
                                              │ (Appends to WAL)
                                              ▼
                                     [ Debezium / CDC ]
                                              │ (Streams Row Events)
                                              ▼
                                   [ Kafka Topic: db.users ]
                                              │
                                              ▼
                                  [ Cache Invalidation Worker ]
                                              │ (Executes redis.del)
                                              ▼
                                     [ Redis Cluster ]
*/`,
    recallHint: "Dual-writes race and corrupt cache. Fix: Write only to DB; let CDC tail the WAL to invalidate cache.",
    interviewTip: "Phil Karlton famously said: 'There are only two hard things in Computer Science: cache invalidation and naming things.' Explain CDC-based invalidation to demonstrate the industry-standard solution.",
    tags: ["caching", "cache-invalidation", "dual-write", "cdc", "debezium", "kafka"]
  }),

  createCard({
    idNum: 46,
    category: "Caching Strategies & In-Memory Systems",
    concept: "Consistent Hashing with Virtual Nodes (VNodes)",
    priority: "must-know",
    difficulty: "must-know",
    question: "Why does standard modulo hashing ($hash(key) \\% N$) break down when scaling cache clusters, and how does Consistent Hashing with Virtual Nodes minimize key migration?",
    answer: "Standard modulo hashing redistributes nearly 100% of keys when adding or removing a cache node ($N \\to N+1$), causing catastrophic cluster-wide cache misses. Consistent Hashing maps both servers and keys to a $2^{32}-1$ integer ring, migrating only $K/N$ keys on node changes. Virtual Nodes (VNodes) distribute multiple virtual points per physical server across the ring to guarantee balanced load distribution.",
    explanation: `The Modulo Failure Mode:
- With 4 servers: $key \\pmod 4$.
- When Server 4 crashes or a 5th server is added: $key \\pmod 5$.
- Result: 90%+ of keys hash to a completely different server index. The entire cache fleet misses, and traffic floods the database.

Consistent Hashing Architecture:
1. The Hash Ring: A circular range of integers from $0$ to $2^{32}-1$.
2. Server Placement: Hash server identifiers (IPs) onto points on the ring.
3. Key Assignment: Hash the key; walk clockwise around the ring until reaching the first server point.
4. Adding/Removing a Node: When a node is added, it only absorbs a fraction of keys ($1/N$) from its adjacent clockwise neighbor. All other servers' keys remain untouched!

Why Virtual Nodes (VNodes) are Critical:
- With few physical nodes (e.g., 5 nodes), points on the ring cluster unevenly, causing one server to hold 60% of the traffic.
- Virtual Nodes: Map each physical server to 100–300 virtual tokens spread evenly across the ring (\`node1#1\`, \`node1#2\`, ...).
- This guarantees near-perfect statistical uniformity ($< 5\\%$ variance in load).`,
    code: `// Consistent Hash Ring with Virtual Nodes in TypeScript
import crypto from "crypto";

class ConsistentHashRing {
  private ring = new Map<number, string>();
  private sortedKeys: number[] = [];

  constructor(private replicas = 150) {}

  private hash(val: string): number {
    const hex = crypto.createHash("md5").update(val).digest("hex");
    return parseInt(hex.substring(0, 8), 16);
  }

  addNode(node: string) {
    for (let i = 0; i < this.replicas; i++) {
      const vNodeKey = this.hash(\`\${node}#vnode\${i}\`);
      this.ring.set(vNodeKey, node);
      this.sortedKeys.push(vNodeKey);
    }
    this.sortedKeys.sort((a, b) => a - b);
  }

  getNode(key: string): string {
    if (this.sortedKeys.length === 0) throw new Error("Empty ring");
    const keyHash = this.hash(key);

    // Binary search for first virtual node >= keyHash
    let low = 0, high = this.sortedKeys.length - 1;
    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.sortedKeys[mid] >= keyHash) {
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    // Wrap around to 0 if beyond ring maximum
    const targetIdx = low >= this.sortedKeys.length ? 0 : low;
    return this.ring.get(this.sortedKeys[targetIdx])!;
  }
}`,
    recallHint: "Modulo: adding 1 node breaks everything. Consistent Hashing: only K/N keys move. VNodes prevent hotspots.",
    interviewTip: "Consistent hashing is foundational for Memcached, DynamoDB, Cassandra, and Discord. Always mention Virtual Nodes to address non-uniform key distribution on the ring.",
    tags: ["consistent-hashing", "virtual-nodes", "caching", "distributed-systems", "algorithms"]
  }),

  createCard({
    idNum: 47,
    category: "Caching Strategies & In-Memory Systems",
    concept: "In-Memory Storage Mechanics: Redis vs Memcached",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Contrast the internal threading models, data structures, and persistence capabilities of Redis versus Memcached.",
    answer: "Memcached is a multi-threaded, purely in-memory LRU key-value store optimized for simple string blobs and high vertical core utilization; Redis uses a single-threaded event loop (with multi-threaded I/O multiplexing in Redis 6+), supports rich native data structures (Lists, Sets, Hashes, Streams), and provides disk persistence (RDB snapshots and AOF logs) and replication.",
    explanation: `Architectural Breakdown:
1. Threading Model:
   - Memcached: Multi-threaded with fine-grained slab locking. Can fully saturate a 64-core monster instance vertically.
   - Redis: Single-threaded command execution core (eliminates lock contention, race conditions, and context switching overhead). Redis 6+ introduced multi-threaded network I/O for socket read/write, keeping command execution single-threaded.
2. Data Types:
   - Memcached: Simple strings/blobs up to 1MB (configurable). To modify an item in an array, client must download the entire blob, deserialize, edit, serialize, and upload back.
   - Redis: Native server-side data structures (Strings, Hashes, Lists, Sets, Sorted Sets, Bitmaps, HyperLogLog, Streams). Can push to a list or increment a score in-place ($O(1)$) over the network.
3. Persistence & Durability:
   - Memcached: Purely volatile RAM. Restarting the process loses 100% of data.
   - Redis: Multiple persistence options:
     - **RDB (Redis Database Snapshot)**: Point-in-time binary dumps at scheduled intervals (e.g., every 5 min).
     - **AOF (Append-Only File)**: Logs every write command sequentially with configurable fsync (every write, every second, or OS default).`,
    code: `/*
Decision Framework:
- Choose Memcached:
  - Simple key-value caching where data is 100% disposable.
  - Large multiprocessor instances (scale vertically to 64 vCPUs).
  - Large cache values (>512KB).

- Choose Redis:
  - Need complex data structures (leaderboards, sets, queues).
  - Need disk persistence, replication, or pub/sub capabilities.
  - Rate limiting, session stores, geospatial lookups.
*/`,
    recallHint: "Memcached = multi-threaded simple key-value blob cache. Redis = single-threaded rich data structures + persistence.",
    interviewTip: "Clarify that Redis is single-threaded for command execution, but uses background threads for non-blocking key eviction (`UNLINK`), fsync I/O, and socket I/O multiplexing in Redis 6+.",
    tags: ["redis", "memcached", "in-memory", "caching", "threading", "persistence"]
  }),

  createCard({
    idNum: 48,
    category: "Caching Strategies & In-Memory Systems",
    concept: "Redis Persistence Engines: RDB vs AOF vs Dual Persistence",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do RDB Snapshots and Append-Only File (AOF) persistence engines work internally in Redis, and what is the trade-off of running both simultaneously?",
    answer: "RDB creates compact point-in-time binary snapshots using OS copy-on-write (fork), enabling fast restarts and backups but risking data loss between snapshot intervals; AOF logs every write command sequentially via append-only logs, offering high durability (fsync every second = max 1s data loss) at the cost of larger files and slower recovery. Running both combines fast RDB snapshot restores with AOF tail replay.",
    explanation: `RDB (Redis Database File) Mechanics:
- Master calls \`fork()\`, creating a child process sharing parent RAM pages via OS Copy-On-Write (COW).
- Child process writes the full memory dataset to a temporary binary \`.rdb\` file on disk.
- Parent continues serving client requests without blocking; modified pages are duplicated by the OS.
- Disadvantage: If server crashes 4 minutes after the last 5-minute snapshot, the last 4 minutes of writes are permanently lost.

AOF (Append-Only File) Mechanics:
- Every state-modifying command (\`SET\`, \`HSET\`, \`DEL\`) is appended to an internal buffer and flushed to disk using \`fsync\`.
- \`appendfsync\` Policies:
  - \`always\`: fsync on every write (slow, maximum durability).
  - \`everysec\` (Recommended): fsync once per second in a background thread. Maximum data loss in a crash is 1–2 seconds.
  - \`no\`: Lets the OS flush when dirty page buffers fill (unpredictable).
- AOF Rewrite: Background process cleans up redundant operations (\`INCR x 100 times\` is compressed into \`SET x 100\`).

Dual Persistence Strategy:
- When Redis restarts, it loads the AOF file (not RDB) because AOF is guaranteed to be more complete.
- Redis 4.0+ Hybrid RDB-AOF: The AOF file begins with a full binary RDB snapshot, followed by recent incremental AOF write logs, delivering the fastest restart times with zero data loss.`,
    code: `// redis.conf Dual Persistence Best Practice
/*
# Snapshot every 900s if 1 key changed, or 60s if 10000 keys changed
save 900 1
save 60 10000

# Enable AOF with 1-second fsync
appendonly yes
appendfilename "appendonly.aof"
appendfsync everysec

# Enable Modern Hybrid Persistence (RDB preamble in AOF)
aof-use-rdb-preamble yes
*/`,
    recallHint: "RDB = fast binary snapshots (risk interval loss). AOF = command log (high durability). Hybrid = RDB base + AOF tail.",
    interviewTip: "In financial or shopping cart systems using Redis, always recommend Hybrid Persistence with `appendfsync everysec` to limit crash loss to at most 1 second.",
    tags: ["redis", "rdb", "aof", "persistence", "durability", "copy-on-write"]
  })
];

module.exports = cards;
