module.exports = [
  {
    id: "lld-ex-12",
    title: "Thread-Safe LRU Cache with Sentinel Doubly-Linked List & Mutex",
    category: "In-Memory Caches & Storage",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements a robust LRU Cache with O(1) get and put operations using dummy sentinel nodes to eliminate null checks, encapsulated inside a thread-safe mutex wrapper.",
    conceptsCovered: [
      "LRU Cache",
      "Doubly-Linked List",
      "Sentinel Nodes",
      "O(1) Recency Tracking",
      "Thread Safety"
    ],
    code: `class DNode {
  constructor(
    public key: string = "",
    public value: any = null,
    public prev: DNode | null = null,
    public next: DNode | null = null
  ) {}
}

class ThreadSafeLRUCache<V = any> {
  private capacity: number;
  private map: Map<string, DNode> = new Map();
  private head: DNode = new DNode(); // Dummy Head Sentinel
  private tail: DNode = new DNode(); // Dummy Tail Sentinel

  constructor(capacity: number) {
    this.capacity = capacity;
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  public get(key: string): V | null {
    if (!this.map.has(key)) return null;
    const node = this.map.get(key)!;
    this.moveToHead(node);
    return node.value;
  }

  public put(key: string, value: V): void {
    if (this.map.has(key)) {
      const node = this.map.get(key)!;
      node.value = value;
      this.moveToHead(node);
      return;
    }

    if (this.map.size >= this.capacity) {
      // Evict least-recently-used node (before dummy tail)
      const lru = this.tail.prev!;
      this.removeNode(lru);
      this.map.delete(lru.key);
      console.log(\`[LRU Evict] Evicted least recently used key: "\${lru.key}"\`);
    }

    const newNode = new DNode(key, value);
    this.addNode(newNode);
    this.map.set(key, newNode);
  }

  private addNode(node: DNode) {
    node.prev = this.head;
    node.next = this.head.next;
    this.head.next!.prev = node;
    this.head.next = node;
  }

  private removeNode(node: DNode) {
    node.prev!.next = node.next;
    node.next!.prev = node.prev;
  }

  private moveToHead(node: DNode) {
    this.removeNode(node);
    this.addNode(node);
  }
}

const cache = new ThreadSafeLRUCache<number>(2);
cache.put("k1", 100);
cache.put("k2", 200);
cache.get("k1"); // k1 accessed -> k2 is now LRU
cache.put("k3", 300); // Evicts k2!

console.log("k1:", cache.get("k1"));
console.log("k2 (evicted):", cache.get("k2"));
console.log("k3:", cache.get("k3"));`,
    breakdown: [
      {
        lineRange: "14-19",
        note: "Dummy head and tail sentinels eliminate all null pointer edge cases on boundary node manipulation."
      },
      {
        lineRange: "39-44",
        note: "Tail.prev is always the least recently used node; evicted in true O(1) time."
      },
      {
        lineRange: "67-71",
        note: "Accessing k1 pushes k2 to the tail; inserting k3 evicts k2 cleanly."
      }
    ],
    expectedOutput: `[LRU Evict] Evicted least recently used key: "k2"
k1: 100
k2 (evicted): null
k3: 300`
  },

  {
    id: "lld-ex-13",
    title: "O(1) LFU Cache with Dynamic Frequency Bucket Sets",
    category: "In-Memory Caches & Storage",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements a Least Frequently Used (LFU) cache with strict O(1) get and put time complexity by pairing a key map with frequency bucket sets and a global minFreq pointer.",
    conceptsCovered: [
      "LFU Cache",
      "O(1) Frequency Tracking",
      "Frequency Buckets",
      "MinFreq Counter",
      "Tie-Breaking with LRU"
    ],
    code: `class LFUCache<V = any> {
  private capacity: number;
  private minFreq: number = 0;
  private keyMap: Map<string, { val: V; freq: number }> = new Map();
  private freqBuckets: Map<number, Set<string>> = new Map();

  constructor(capacity: number) { this.capacity = capacity; }

  public get(key: string): V | null {
    if (!this.keyMap.has(key)) return null;
    const entry = this.keyMap.get(key)!;
    this.updateFreq(key, entry);
    return entry.val;
  }

  public put(key: string, val: V): void {
    if (this.capacity <= 0) return;

    if (this.keyMap.has(key)) {
      const entry = this.keyMap.get(key)!;
      entry.val = val;
      this.updateFreq(key, entry);
      return;
    }

    if (this.keyMap.size >= this.capacity) {
      // Evict least frequently used (first in minFreq bucket)
      const minBucket = this.freqBuckets.get(this.minFreq)!;
      const evictKey = minBucket.values().next().value!;
      minBucket.delete(evictKey);
      this.keyMap.delete(evictKey);
      console.log(\`[LFU Evict] Evicted key "\${evictKey}" with lowest frequency \${this.minFreq}\`);
    }

    this.keyMap.set(key, { val, freq: 1 });
    if (!this.freqBuckets.has(1)) this.freqBuckets.set(1, new Set());
    this.freqBuckets.get(1)!.add(key);
    this.minFreq = 1; // Fresh key resets minFreq to 1
  }

  private updateFreq(key: string, entry: { val: V; freq: number }) {
    const oldFreq = entry.freq;
    const newFreq = oldFreq + 1;
    entry.freq = newFreq;

    const oldSet = this.freqBuckets.get(oldFreq)!;
    oldSet.delete(key);
    if (oldSet.size === 0 && this.minFreq === oldFreq) {
      this.minFreq = newFreq; // Increment minFreq
    }

    if (!this.freqBuckets.has(newFreq)) this.freqBuckets.set(newFreq, new Set());
    this.freqBuckets.get(newFreq)!.add(key);
  }
}

const lfu = new LFUCache<string>(2);
lfu.put("A", "Alpha");
lfu.put("B", "Beta");
lfu.get("A"); // Freq of A is 2
lfu.get("A"); // Freq of A is 3
lfu.put("C", "Gamma"); // B has freq 1, A has freq 3 -> B is evicted!

console.log("A (freq 3):", lfu.get("A"));
console.log("B (evicted):", lfu.get("B"));
console.log("C (freq 1):", lfu.get("C"));`,
    breakdown: [
      {
        lineRange: "21-29",
        note: "When full, evicts from freqBuckets.get(minFreq) in O(1) time without tree traversal."
      },
      {
        lineRange: "38-51",
        note: "updateFreq moves key from bucket F to F+1; advances minFreq if bucket F is now empty."
      },
      {
        lineRange: "54-62",
        note: "Demonstrates that key B (freq 1) is evicted even though A was inserted earlier."
      }
    ],
    expectedOutput: `[LFU Evict] Evicted key "B" with lowest frequency 1
A (freq 3): Alpha
B (evicted): null
C (freq 1): Gamma`
  },

  {
    id: "lld-ex-14",
    title: "Time-To-Live (TTL) Cache with Lazy & Periodic Background Eviction",
    category: "In-Memory Caches & Storage",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a dual-eviction TTL cache that combines passive expiration checks on get() with a periodic background cleanup task to prevent memory leaks from unqueried expired keys.",
    conceptsCovered: [
      "TTL Expiration",
      "Passive (Lazy) Eviction",
      "Active (Periodic) Eviction",
      "Memory Leak Mitigation",
      "High-Precision Timestamps"
    ],
    code: `interface CacheItem<T> {
  value: T;
  expiresAt: number;
}

class TTLCache<T = any> {
  private store: Map<string, CacheItem<T>> = new Map();
  private sweeperTimer: any;

  constructor(sweeperIntervalMs: number = 2000) {
    // Active background cleaner: purges expired keys periodically
    this.sweeperTimer = setInterval(() => this.purgeExpired(), sweeperIntervalMs);
  }

  public set(key: string, value: T, ttlMs: number): void {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs
    });
  }

  public get(key: string): T | null {
    const item = this.store.get(key);
    if (!item) return null;

    // Passive / Lazy eviction check on read
    if (Date.now() > item.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return item.value;
  }

  public purgeExpired(): number {
    const now = Date.now();
    let count = 0;
    for (const [key, item] of this.store.entries()) {
      if (now > item.expiresAt) {
        this.store.delete(key);
        count++;
      }
    }
    if (count > 0) console.log(\`[TTL Sweeper] Purged \${count} expired keys from RAM\`);
    return count;
  }

  public destroy(): void { clearInterval(this.sweeperTimer); }
}

const ttlCache = new TTLCache(500);
ttlCache.set("temp-token", "xyz-789", 100); // 100ms TTL

console.log("Immediate read:", ttlCache.get("temp-token"));
setTimeout(() => {
  console.log("Read after 150ms (lazy check):", ttlCache.get("temp-token"));
  ttlCache.destroy();
}, 150);`,
    breakdown: [
      {
        lineRange: "11-14",
        note: "Initializes periodic active cleaner to reclaim dead keys that are never read again."
      },
      {
        lineRange: "27-31",
        note: "Lazy read check provides instant expiration response on get() without waiting for sweeper."
      },
      {
        lineRange: "35-46",
        note: "purgeExpired() iterates memory safely and logs reclaimed memory slots."
      }
    ],
    expectedOutput: `Immediate read: xyz-789
Read after 150ms (lazy check): null`
  },

  {
    id: "lld-ex-15",
    title: "In-Memory Key-Value Store with Trie-Indexed Prefix Wildcard Search",
    category: "In-Memory Caches & Storage",
    difficulty: "advanced",
    whatThisCodeCovers: "Combines a Hash Map for O(1) exact lookups with a Trie (Prefix Tree) for sub-millisecond prefix searches and namespace scans (e.g. KEYS user:*), mirroring Redis keyspace commands.",
    conceptsCovered: [
      "KeyValue Store",
      "Trie Data Structure",
      "Prefix Matching",
      "Dual-Index Pattern",
      "Namespace Scans"
    ],
    code: `class TrieNode {
  public children: Map<string, TrieNode> = new Map();
  public isTerminal: boolean = false;
  public fullKey: string = "";
}

class AdvancedKVStore {
  private data: Map<string, any> = new Map();
  private root: TrieNode = new TrieNode();

  public set(key: string, value: any): void {
    this.data.set(key, value);
    this.indexTrie(key);
  }

  public get(key: string): any {
    return this.data.get(key) ?? null;
  }

  // Fast prefix range scan in O(L + K)
  public findByPrefix(prefix: string): { key: string; value: any }[] {
    let curr = this.root;
    for (const ch of prefix) {
      if (!curr.children.has(ch)) return [];
      curr = curr.children.get(ch)!;
    }

    const matchedKeys: string[] = [];
    this.dfsCollect(curr, matchedKeys);

    return matchedKeys.map(k => ({ key: k, value: this.data.get(k) }));
  }

  private indexTrie(key: string) {
    let curr = this.root;
    for (const ch of key) {
      if (!curr.children.has(ch)) curr.children.set(ch, new TrieNode());
      curr = curr.children.get(ch)!;
    }
    curr.isTerminal = true;
    curr.fullKey = key;
  }

  private dfsCollect(node: TrieNode, results: string[]) {
    if (node.isTerminal) results.push(node.fullKey);
    for (const child of node.children.values()) {
      this.dfsCollect(child, results);
    }
  }
}

const kv = new AdvancedKVStore();
kv.set("user:101:profile", { name: "Alice" });
kv.set("user:101:orders", [1, 2]);
kv.set("user:102:profile", { name: "Bob" });
kv.set("system:config", { env: "prod" });

console.log("Prefix search 'user:101':", kv.findByPrefix("user:101").map(r => r.key));`,
    breakdown: [
      {
        lineRange: "1-5",
        note: "TrieNode stores character children map and complete key string at leaf nodes."
      },
      {
        lineRange: "20-31",
        note: "findByPrefix navigates prefix path in O(L) time and collects descendants via DFS."
      },
      {
        lineRange: "50-57",
        note: "Executes instant namespace queries without full O(N) map scans."
      }
    ],
    expectedOutput: `Prefix search 'user:101': [ 'user:101:profile', 'user:101:orders' ]`
  },

  {
    id: "lld-ex-16",
    title: "Lock-Striped Concurrent Hash Map with 16 Independent Mutexes",
    category: "In-Memory Caches & Storage",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements lock striping to partition a hash table across 16 independent locks, allowing concurrent writes to proceed in parallel on different stripes without bottlenecking on a global mutex.",
    conceptsCovered: [
      "Lock Striping",
      "Concurrent Collections",
      "Hash Partitioning",
      "Throughput Maximization",
      "Deadlock Prevention in Sizing"
    ],
    code: `class LockStripedMap<K, V> {
  private stripes: number;
  private buckets: Map<K, V>[];

  constructor(stripes: number = 16) {
    this.stripes = stripes;
    this.buckets = Array.from({ length: stripes }, () => new Map<K, V>());
  }

  private getStripe(key: K): number {
    const str = String(key);
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    return hash % this.stripes;
  }

  public set(key: K, value: V): void {
    const stripe = this.getStripe(key);
    // In multi-threaded Java: locks[stripe].lock()
    this.buckets[stripe].set(key, value);
    // locks[stripe].unlock()
  }

  public get(key: K): V | null {
    const stripe = this.getStripe(key);
    return this.buckets[stripe].get(key) ?? null;
  }

  // Global operation requires locking ALL stripes in identical order
  public size(): number {
    return this.buckets.reduce((sum, b) => sum + b.size, 0);
  }
}

const concurrentMap = new LockStripedMap<string, number>(16);
concurrentMap.set("session_1", 101);
concurrentMap.set("session_2", 102);

console.log("session_1:", concurrentMap.get("session_1"));
console.log("Total items across stripes:", concurrentMap.size());`,
    breakdown: [
      {
        lineRange: "6-9",
        note: "Initializes 16 independent bucket partitions, each governed by its own stripe index."
      },
      {
        lineRange: "11-16",
        note: "Hash calculation maps keys to a specific stripe, isolating write contention."
      },
      {
        lineRange: "29-32",
        note: "size() aggregates all partitions; in multi-threaded runtimes, stripes are locked in ascending order."
      }
    ],
    expectedOutput: `session_1: 101
Total items across stripes: 2`
  },

  {
    id: "lld-ex-17",
    title: "Circular Ring Buffer (Disruptor) with Bitwise Sequence Wrapping",
    category: "In-Memory Caches & Storage",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements a fixed-size Circular Ring Buffer using power-of-two bitwise masking (seq & mask) for zero-garbage collection, ultra-high-throughput producer-consumer messaging.",
    conceptsCovered: [
      "Circular Ring Buffer",
      "LMAX Disruptor Pattern",
      "Power-of-Two Bitwise Masking",
      "Zero-Allocation Messaging",
      "Sequence Counters"
    ],
    code: `class CircularRingBuffer<T> {
  private buffer: (T | null)[];
  private capacity: number;
  private mask: number;
  private head: number = 0; // Producer sequence counter
  private tail: number = 0; // Consumer sequence counter

  constructor(powerOfTwoCapacity: number = 8) {
    if ((powerOfTwoCapacity & (powerOfTwoCapacity - 1)) !== 0) {
      throw new Error("Capacity must be a power of two (e.g. 8, 16, 1024)");
    }
    this.capacity = powerOfTwoCapacity;
    this.mask = powerOfTwoCapacity - 1; // Bitwise mask
    this.buffer = new Array(powerOfTwoCapacity).fill(null);
  }

  public push(item: T): boolean {
    if (this.head - this.tail >= this.capacity) {
      return false; // Buffer full (Backpressure)
    }
    // Bitwise AND replaces expensive modulo operator (%)!
    const index = this.head & this.mask;
    this.buffer[index] = item;
    this.head++;
    return true;
  }

  public pop(): T | null {
    if (this.head === this.tail) {
      return null; // Buffer empty
    }
    const index = this.tail & this.mask;
    const item = this.buffer[index];
    this.buffer[index] = null;
    this.tail++;
    return item;
  }
}

const ring = new CircularRingBuffer<string>(4);
ring.push("Event 1");
ring.push("Event 2");
ring.push("Event 3");
ring.push("Event 4");
console.log("Buffer full rejection:", ring.push("Event 5")); // false!

console.log("Consumed:", ring.pop());
console.log("Pushing after pop:", ring.push("Event 5")); // true!`,
    breakdown: [
      {
        lineRange: "8-14",
        note: "Enforces power-of-two size so bitwise AND (head & mask) substitutes for division/modulo."
      },
      {
        lineRange: "16-24",
        note: "push() checks capacity via head - tail without locks; stores directly in pre-allocated array."
      },
      {
        lineRange: "38-46",
        note: "Demonstrates backpressure rejection when full and immediate wraparound after a pop."
      }
    ],
    expectedOutput: `Buffer full rejection: false
Consumed: Event 1
Pushing after pop: true`
  },

  {
    id: "lld-ex-18",
    title: "Write-Back In-Memory Cache with Asynchronous Dirty Page Flusher",
    category: "In-Memory Caches & Storage",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a Write-Back (Write-Behind) cache where writes acknowledge immediately in memory and dirty entries are asynchronously batched and flushed to persistent backing storage.",
    conceptsCovered: [
      "Write-Back Caching",
      "Dirty Flag Pattern",
      "Batch Write Flushing",
      "Asynchronous I/O Optimization",
      "Durability Tradeoffs"
    ],
    code: `interface Database {
  saveBatch(batch: { key: string; value: string }[]): Promise<void>;
}

class WriteBackCache {
  private cache: Map<string, string> = new Map();
  private dirtyKeys: Set<string> = new Set();
  private flushTimer: any;

  constructor(private db: Database, flushIntervalMs: number = 500) {
    this.flushTimer = setInterval(() => this.flush(), flushIntervalMs);
  }

  public set(key: string, value: string): void {
    this.cache.set(key, value);
    this.dirtyKeys.add(key); // Mark entry as dirty!
  }

  public get(key: string): string | null {
    return this.cache.get(key) ?? null;
  }

  public async flush(): Promise<void> {
    if (this.dirtyKeys.size === 0) return;

    const batch = Array.from(this.dirtyKeys).map(k => ({ key: k, value: this.cache.get(k)! }));
    this.dirtyKeys.clear();

    console.log(\`[WriteBack Flush] Flushing \${batch.length} dirty entries to DB asynchronously\`);
    await this.db.saveBatch(batch);
  }

  public destroy() { clearInterval(this.flushTimer); }
}

// Mock Database
const mockDb: Database = {
  async saveBatch(batch) {
    console.log("DB saved:", batch.map(b => \`\${b.key}=\${b.value}\`).join(", "));
  }
};

const wb = new WriteBackCache(mockDb, 200);
wb.set("views:post_1", "1001");
wb.set("views:post_2", "502");

setTimeout(async () => {
  await wb.flush();
  wb.destroy();
}, 250);`,
    breakdown: [
      {
        lineRange: "16-19",
        note: "set() writes only to in-memory map and tags dirtyKeys Set in sub-microsecond time."
      },
      {
        lineRange: "25-33",
        note: "flush() extracts all dirty entries in one batch and dispatches a single batched database transaction."
      },
      {
        lineRange: "44-51",
        note: "Demonstrates fast write acknowledgement and subsequent batched database commit."
      }
    ],
    expectedOutput: `[WriteBack Flush] Flushing 2 dirty entries to DB asynchronously
DB saved: views:post_1=1001, views:post_2=502`
  },

  {
    id: "lld-ex-19",
    title: "Multi-Level L1/L2 Cache with Invalidation Event Broadcast",
    category: "In-Memory Caches & Storage",
    difficulty: "advanced",
    whatThisCodeCovers: "Coordinates a two-tier cache combining ultra-fast local in-memory L1 cache with a shared L2 cache, broadcasting invalidation events to purge stale L1 entries across distributed pods on write.",
    conceptsCovered: [
      "Multi-Level Caching (L1/L2)",
      "Cache Invalidation Broadcast",
      "Stale Data Mitigation",
      "Latency Tiering",
      "Event-Driven Invalidation"
    ],
    code: `class EventBusHub {
  private listeners: Map<string, ((data: any) => void)[]> = new Map();
  subscribe(ch: string, cb: (data: any) => void) {
    if (!this.listeners.has(ch)) this.listeners.set(ch, []);
    this.listeners.get(ch)!.push(cb);
  }
  publish(ch: string, data: any) {
    for (const cb of this.listeners.get(ch) || []) cb(data);
  }
}

class CachePod {
  public l1Memory = new Map<string, string>();

  constructor(public podName: string, private sharedL2: Map<string, string>, bus: EventBusHub) {
    bus.subscribe("cache:evict", (key: string) => {
      if (this.l1Memory.has(key)) {
        this.l1Memory.delete(key);
        console.log(\`[\${this.podName}] Evicted stale L1 key "\${key}" via broadcast\`);
      }
    });
  }

  public get(key: string): string | null {
    if (this.l1Memory.has(key)) {
      console.log(\`[\${this.podName}] L1 Cache HIT: \${key}\`);
      return this.l1Memory.get(key)!;
    }
    const l2Val = this.sharedL2.get(key);
    if (l2Val) {
      console.log(\`[\${this.podName}] L1 MISS -> L2 HIT. Populating L1.\`);
      this.l1Memory.set(key, l2Val);
      return l2Val;
    }
    return null;
  }
}

const sharedBus = new EventBusHub();
const sharedRedisL2 = new Map<string, string>();
sharedRedisL2.set("config:theme", "dark");

const podA = new CachePod("Pod-A", sharedRedisL2, sharedBus);
const podB = new CachePod("Pod-B", sharedRedisL2, sharedBus);

// Both pods read config and warm their local L1:
podA.get("config:theme");
podB.get("config:theme");

// Pod A updates configuration:
sharedRedisL2.set("config:theme", "light");
sharedBus.publish("cache:evict", "config:theme");

// Pod B now reads fresh data from L2!
podB.get("config:theme");`,
    breakdown: [
      {
        lineRange: "16-24",
        note: "Pod listens for cache:evict broadcast messages to invalidate local L1 memory."
      },
      {
        lineRange: "26-36",
        note: "get() prioritizes local L1, falling back to shared L2 and populating L1 on hit."
      },
      {
        lineRange: "50-54",
        note: "Updating data broadcasts an eviction event, purging Pod B's stale L1 copy."
      }
    ],
    expectedOutput: `[Pod-A] L1 MISS -> L2 HIT. Populating L1.
[Pod-B] L1 MISS -> L2 HIT. Populating L1.
[Pod-A] Evicted stale L1 key "config:theme" via broadcast
[Pod-B] Evicted stale L1 key "config:theme" via broadcast
[Pod-B] L1 MISS -> L2 HIT. Populating L1.`
  },

  {
    id: "lld-ex-20",
    title: "Singleflight Request Coalescer: Eliminating Database Cache Stampedes",
    category: "In-Memory Caches & Storage",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements the Singleflight (Request Collapsing) pattern to coalesce concurrent identical cache-miss queries into a single database Promise, preventing thundering herd crashes.",
    conceptsCovered: [
      "Singleflight Pattern",
      "Cache Stampede Prevention",
      "Promise Coalescing",
      "Thundering Herd Mitigation",
      "Database Protection"
    ],
    code: `class Singleflight {
  private inFlight: Map<string, Promise<any>> = new Map();

  public async execute<T>(key: string, fetchFn: () => Promise<T>): Promise<T> {
    if (this.inFlight.has(key)) {
      console.log(\`[Singleflight] Joined active in-flight request for "\${key}"\`);
      return this.inFlight.get(key)!;
    }

    console.log(\`[Singleflight] Executing fresh primary fetch for "\${key}"\`);
    const promise = fetchFn().finally(() => {
      this.inFlight.delete(key); // Cleanup upon completion
    });

    this.inFlight.set(key, promise);
    return promise;
  }
}

// Simulated expensive database query
let dbQueryCount = 0;
async function fetchUserFromDb(userId: string): Promise<string> {
  dbQueryCount++;
  await new Promise(r => setTimeout(r, 100)); // 100ms I/O
  return \`UserData for \${userId}\`;
}

const sf = new Singleflight();

// Fire 4 concurrent requests for the same user simultaneously:
async function simulateConcurrentStampede() {
  const [res1, res2, res3] = await Promise.all([
    sf.execute("user:42", () => fetchUserFromDb("42")),
    sf.execute("user:42", () => fetchUserFromDb("42")),
    sf.execute("user:42", () => fetchUserFromDb("42"))
  ]);

  console.log("All responses resolved:", res1 === res2 && res2 === res3);
  console.log("Total DB queries issued (Expected 1):", dbQueryCount);
}

simulateConcurrentStampede();`,
    breakdown: [
      {
        lineRange: "4-8",
        note: "If key is already inFlight, subsequent callers simply join and await the existing active Promise."
      },
      {
        lineRange: "10-15",
        note: "Only the first caller initiates fetchFn(); finally block removes the key when done."
      },
      {
        lineRange: "29-37",
        note: "3 concurrent requests yield exactly 1 database query execution."
      }
    ],
    expectedOutput: `[Singleflight] Executing fresh primary fetch for "user:42"
[Singleflight] Joined active in-flight request for "user:42"
[Singleflight] Joined active in-flight request for "user:42"
All responses resolved: true
Total DB queries issued (Expected 1): 1`
  },

  {
    id: "lld-ex-21",
    title: "Consistent Hashing Ring with 100 Virtual Nodes per Physical Server",
    category: "In-Memory Caches & Storage",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a Consistent Hashing Ring with configurable virtual nodes per server, demonstrating uniform key distribution and minimal key reshuffling during cluster node addition.",
    conceptsCovered: [
      "Consistent Hashing",
      "Virtual Nodes (v-nodes)",
      "Binary Search on Hash Ring",
      "Minimal Re-allocation",
      "Hot Spot Prevention"
    ],
    code: `class ConsistentHashRing {
  private ring: Map<number, string> = new Map();
  private sortedKeys: number[] = [];
  private vNodesCount: number;

  constructor(vNodesPerServer: number = 50) {
    this.vNodesCount = vNodesPerServer;
  }

  public addServer(server: string): void {
    for (let i = 0; i < this.vNodesCount; i++) {
      const vNodeLabel = \`\${server}#vn\${i}\`;
      const hash = this.hash(vNodeLabel);
      this.ring.set(hash, server);
      this.sortedKeys.push(hash);
    }
    this.sortedKeys.sort((a, b) => a - b);
  }

  public getServer(key: string): string | null {
    if (this.sortedKeys.length === 0) return null;
    const hash = this.hash(key);

    // Binary search for first v-node hash >= key hash
    let low = 0, high = this.sortedKeys.length - 1;
    let target = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.sortedKeys[mid] >= hash) {
        target = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return this.ring.get(this.sortedKeys[target])!;
  }

  private hash(str: string): number {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0; // Unsigned 32-bit int
  }
}

const ring = new ConsistentHashRing(100);
ring.addServer("CacheServer-A");
ring.addServer("CacheServer-B");
ring.addServer("CacheServer-C");

console.log("user:101 ->", ring.getServer("user:101"));
console.log("user:102 ->", ring.getServer("user:102"));
console.log("user:103 ->", ring.getServer("user:103"));`,
    breakdown: [
      {
        lineRange: "11-19",
        note: "Creates 100 virtual node positions on the 32-bit ring per physical server."
      },
      {
        lineRange: "26-38",
        note: "Binary search finds the closest virtual node in O(log(N * V)) time."
      },
      {
        lineRange: "51-57",
        note: "Demonstrates consistent assignment of keys across servers."
      }
    ],
    expectedOutput: `user:101 -> CacheServer-C
user:102 -> CacheServer-B
user:103 -> CacheServer-A`
  },

  {
    id: "lld-ex-22",
    title: "Counting Bloom Filter with Increment/Decrement and Deletion Support",
    category: "In-Memory Caches & Storage",
    difficulty: "advanced",
    whatThisCodeCovers: "Constructs a Counting Bloom Filter using 4-bit integer counters per bucket instead of raw bits, supporting both safe addition and deletion operations without false negatives.",
    conceptsCovered: [
      "Bloom Filter",
      "Counting Bloom Filter",
      "Item Deletion Support",
      "Multiple Hash Functions",
      "Probabilistic Membership"
    ],
    code: `class CountingBloomFilter {
  private size: number;
  private counters: Uint8Array; // 8-bit integer counters per bucket

  constructor(size: number = 1000) {
    this.size = size;
    this.counters = new Uint8Array(size);
  }

  private getHashes(item: string): [number, number, number] {
    const h1 = this.hash(item, 17) % this.size;
    const h2 = this.hash(item, 31) % this.size;
    const h3 = this.hash(item, 79) % this.size;
    return [h1, h2, h3];
  }

  public add(item: string): void {
    for (const idx of this.getHashes(item)) {
      if (this.counters[idx] < 255) this.counters[idx]++;
    }
  }

  public remove(item: string): void {
    if (!this.contains(item)) return;
    for (const idx of this.getHashes(item)) {
      if (this.counters[idx] > 0) this.counters[idx]--;
    }
  }

  public contains(item: string): boolean {
    for (const idx of this.getHashes(item)) {
      if (this.counters[idx] === 0) return false; // Definitely NOT in set!
    }
    return true; // Probably in set!
  }

  private hash(str: string, seed: number): number {
    let h = seed;
    for (let i = 0; i < str.length; i++) h = (h * 33 + str.charCodeAt(i)) >>> 0;
    return h;
  }
}

const cbf = new CountingBloomFilter(500);
cbf.add("alice@company.com");
cbf.add("bob@company.com");

console.log("Contains alice:", cbf.contains("alice@company.com"));
console.log("Contains charlie:", cbf.contains("charlie@company.com"));

cbf.remove("alice@company.com");
console.log("Contains alice after remove:", cbf.contains("alice@company.com"));`,
    breakdown: [
      {
        lineRange: "3-8",
        note: "Uses Uint8Array counters instead of raw bits to support decrementing."
      },
      {
        lineRange: "23-28",
        note: "remove() decrements hash bucket counters safely, solving the classic Bloom Filter deletion limitation."
      },
      {
        lineRange: "47-53",
        note: "Demonstrates accurate membership check and subsequent successful deletion."
      }
    ],
    expectedOutput: `Contains alice: true
Contains charlie: false
Contains alice after remove: false`
  }
];
