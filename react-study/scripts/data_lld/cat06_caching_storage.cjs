const { createCard } = require('../lld_builder_helper.cjs');

const category = "In-Memory Storage, Caches & Eviction Engines";

module.exports = [
  createCard({
    idNum: 61,
    category,
    concept: "LRU (Least Recently Used) Cache ($O(1)$)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you implement an LRU (Least Recently Used) Cache with strict $O(1)$ time complexity for both `get` and `put`?",
    answer: "An LRU Cache combines a Hash Map with a Doubly-Linked List. The Hash Map stores `key -> Node` for $O(1)$ random lookups. The Doubly-Linked List maintains access recency: newly accessed or inserted nodes move to the Head; when capacity is reached, the node at the Tail (least recently used) is evicted in $O(1)$.",
    explanation: "A standard Array requires $O(N)$ shifts on eviction. A Singly-Linked list cannot delete a node in $O(1)$ without a pointer to the previous node. A Doubly-Linked list with dummy `head` and `tail` sentinel nodes enables $O(1)$ node removal and insertion without edge-case null checks.",
    code: `class DNode {
  constructor(
    public key: string = "",
    public val: any = null,
    public prev: DNode | null = null,
    public next: DNode | null = null
  ) {}
}

class LRUCache<V = any> {
  private capacity: number;
  private map: Map<string, DNode> = new Map();
  private head: DNode = new DNode(); // Dummy sentinels
  private tail: DNode = new DNode();

  constructor(capacity: number) {
    this.capacity = capacity;
    this.head.next = this.tail;
    this.tail.prev = this.head;
  }

  public get(key: string): V | null {
    if (!this.map.has(key)) return null;
    const node = this.map.get(key)!;
    this.moveToHead(node); // Mark as most recently used
    return node.val;
  }

  public put(key: string, val: V): void {
    if (this.map.has(key)) {
      const node = this.map.get(key)!;
      node.val = val;
      this.moveToHead(node);
      return;
    }

    if (this.map.size >= this.capacity) {
      // Evict least recently used (node before dummy tail)
      const lru = this.tail.prev!;
      this.removeNode(lru);
      this.map.delete(lru.key);
    }

    const newNode = new DNode(key, val);
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
    const prev = node.prev!;
    const next = node.next!;
    prev.next = next;
    next.prev = prev;
  }

  private moveToHead(node: DNode) {
    this.removeNode(node);
    this.addNode(node);
  }
}`,
    recallHint: "HashMap for O(1) lookup + Doubly-Linked List with dummy head/tail for O(1) recency reordering.",
    practice: [
      "Add thread-safety to the LRU Cache using ReentrantReadWriteLock",
      "Trace how Java's LinkedHashMap implements LRU eviction with removeEldestEntry()"
    ],
    interviewTip: "This is the single most tested coding question in LLD interviews. Always use dummy head and tail sentinel nodes—they eliminate 90% of null-pointer bugs and impress the interviewer.",
    tags: ["Data Structures", "LRU Cache", "Doubly Linked List", "O(1) Algorithms"]
  }),

  createCard({
    idNum: 62,
    category,
    concept: "LFU (Least Frequently Used) Cache ($O(1)$)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you achieve $O(1)$ time complexity for an LFU (Least Frequently Used) Cache using frequency buckets?",
    answer: "LFU tracks access frequency. Achieving true $O(1)$ requires: 1. A `keyMap` storing `key -> Node(value, freq)`. 2. A `freqMap` storing `freq -> DoublyLinkedList(Nodes)`. 3. A `minFreq` integer tracking the lowest active frequency. When capacity is exceeded, the least recently used node from the `freqMap[minFreq]` list is evicted in $O(1)$.",
    explanation: "A naive priority queue / min-heap yields $O(\\log N)$ because updating frequencies requires re-heapifying. By grouping nodes with identical frequencies into separate doubly-linked lists inside a frequency hash map, incrementing a node's frequency simply removes it from list `F` and prepends it to list `F+1` in $O(1)$ time.",
    code: `class LFUCache {
  private capacity: number;
  private minFreq: number = 0;
  private keyMap: Map<string, { val: any; freq: number }> = new Map();
  // Maps frequency count to an ordered Set (acting as O(1) Doubly Linked List)
  private freqMap: Map<number, Set<string>> = new Map();

  constructor(capacity: number) { this.capacity = capacity; }

  public get(key: string): any {
    if (!this.keyMap.has(key)) return null;
    const entry = this.keyMap.get(key)!;
    this.incrementFreq(key, entry);
    return entry.val;
  }

  public put(key: string, val: any): void {
    if (this.capacity <= 0) return;
    if (this.keyMap.has(key)) {
      const entry = this.keyMap.get(key)!;
      entry.val = val;
      this.incrementFreq(key, entry);
      return;
    }

    if (this.keyMap.size >= this.capacity) {
      // Evict least frequently used (first inserted in minFreq set)
      const minSet = this.freqMap.get(this.minFreq)!;
      const evictKey = minSet.values().next().value!;
      minSet.delete(evictKey);
      this.keyMap.delete(evictKey);
    }

    this.keyMap.set(key, { val, freq: 1 });
    if (!this.freqMap.has(1)) this.freqMap.set(1, new Set());
    this.freqMap.get(1)!.add(key);
    this.minFreq = 1; // Fresh node resets minFreq to 1
  }

  private incrementFreq(key: string, entry: { val: any; freq: number }) {
    const oldFreq = entry.freq;
    const newFreq = oldFreq + 1;
    entry.freq = newFreq;

    const oldSet = this.freqMap.get(oldFreq)!;
    oldSet.delete(key);
    if (oldSet.size === 0 && this.minFreq === oldFreq) {
      this.minFreq = newFreq; // Increment lowest frequency pointer
    }

    if (!this.freqMap.has(newFreq)) this.freqMap.set(newFreq, new Set());
    this.freqMap.get(newFreq)!.add(key);
  }
}`,
    recallHint: "keyMap (key -> node) + freqMap (freq -> doubly linked list) + minFreq counter for true O(1).",
    practice: [
      "Compare LFU vs LRU for sudden one-off scan workloads (LRU suffers cache pollution; LFU preserves frequent keys)",
      "Implement frequency decay (aging) to prevent historical hot keys from dominating forever"
    ],
    interviewTip: "Explain why Min-Heap is $O(\\log N)$ and how frequency buckets achieve $O(1)$. Mentioning frequency decay demonstrates real-world production experience.",
    tags: ["Data Structures", "LFU Cache", "Frequency Buckets", "O(1) Algorithms"]
  }),

  createCard({
    idNum: 63,
    category,
    concept: "Time-To-Live (TTL) Cache & Expiration Policies",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you implement an in-memory TTL Cache combining Passive (Lazy) and Active (Periodic) eviction?",
    answer: "A production TTL Cache uses a dual expiration strategy: 1. Passive / Lazy Eviction: When `get(key)` is called, check `Date.now() > expiry`; if expired, delete and return null. 2. Active / Periodic Eviction: A background timer periodically samples keys (or inspects a Min-Heap / PriorityQueue ordered by expiry) to purge expired keys that are never accessed again.",
    explanation: "Relying solely on lazy eviction causes memory leaks if thousands of keys expire and are never queried again (dangling memory). Relying solely on a periodic scan wastes CPU cycles. Combining lazy checks on access with a lightweight periodic cleanup worker achieves optimal performance and zero memory leaks.",
    code: `interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

class TTLCache<T = any> {
  private store: Map<string, CacheEntry<T>> = new Map();
  private cleanupTimer: any;

  constructor(cleanupIntervalMs: number = 30000) {
    // Active / Periodic eviction worker
    this.cleanupTimer = setInterval(() => this.purgeExpired(), cleanupIntervalMs);
  }

  public set(key: string, value: T, ttlMs: number): void {
    const expiresAt = Date.now() + ttlMs;
    this.store.set(key, { value, expiresAt });
  }

  public get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    // Passive / Lazy eviction check on read
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  private purgeExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
      }
    }
  }

  public destroy(): void {
    clearInterval(this.cleanupTimer);
  }
}`,
    recallHint: "Passive eviction on get() + Active background cleanup interval to prevent dead memory accumulation.",
    practice: [
      "Use a Min-Heap (PriorityQueue) to order TTL keys so periodic purging stops at the first unexpired key",
      "Model Redis's randomized sampling strategy (active-expire cycle) for in-memory TTL"
    ],
    interviewTip: "In interviews, mention that a Min-Heap allows finding all expired keys in $O(K \\log N)$ where $K$ is the number of expired keys, avoiding full $O(N)$ map iterations.",
    tags: ["Caching", "TTL", "Memory Management", "Eviction Policies"]
  }),

  createCard({
    idNum: 64,
    category,
    concept: "In-Memory Key-Value Store with Prefix Search",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you architect an In-Memory Key-Value Store supporting both $O(1)$ exact lookups and fast prefix range queries?",
    answer: "Combine a Hash Map with a Trie (Prefix Tree) or a balanced search tree (Red-Black Tree / TreeMap). The Hash Map provides $O(1)$ exact key lookups (`get`, `put`, `delete`). The Trie stores key strings hierarchically, enabling prefix searches (`keysWithPrefix('user:')`) in $O(L)$ where $L$ is prefix length.",
    explanation: "A plain Hash Map cannot answer prefix queries without an expensive $O(N)$ full table scan. By indexing keys into an in-memory Trie whenever `put()` is called, autocomplete, wildcard searching, and namespace operations complete in milliseconds, mirroring Redis keyspace commands.",
    code: `class TrieNode {
  public children: Map<string, TrieNode> = new Map();
  public isEndOfKey: boolean = false;
  public fullKey: string = "";
}

class KeyValueStoreWithPrefix {
  private dataMap: Map<string, any> = new Map();
  private root: TrieNode = new TrieNode();

  public put(key: string, value: any): void {
    this.dataMap.set(key, value);
    this.insertTrie(key);
  }

  public get(key: string): any {
    return this.dataMap.get(key) ?? null;
  }

  public searchPrefix(prefix: string): string[] {
    let curr = this.root;
    for (const char of prefix) {
      if (!curr.children.has(char)) return [];
      curr = curr.children.get(char)!;
    }
    // Collect all matching keys below this prefix node
    const results: string[] = [];
    this.collectKeys(curr, results);
    return results;
  }

  private insertTrie(key: string): void {
    let curr = this.root;
    for (const char of key) {
      if (!curr.children.has(char)) curr.children.set(char, new TrieNode());
      curr = curr.children.get(char)!;
    }
    curr.isEndOfKey = true;
    curr.fullKey = key;
  }

  private collectKeys(node: TrieNode, results: string[]): void {
    if (node.isEndOfKey) results.push(node.fullKey);
    for (const child of node.children.values()) {
      this.collectKeys(child, results);
    }
  }
}`,
    recallHint: "HashMap for O(1) exact lookups + Trie index for O(L) prefix and wildcard scans.",
    practice: [
      "Implement multi-attribute indexing for in-memory SQL-like WHERE conditions",
      "Add deletion synchronization: removing a key must delete from both Map and Trie"
    ],
    interviewTip: "In-Memory KV Store is a staple machine-coding problem. Offering prefix search via a Trie or Radix Tree immediately elevates your solution to senior level.",
    tags: ["Data Structures", "KeyValue Store", "Trie", "Prefix Search"]
  }),

  createCard({
    idNum: 65,
    category,
    concept: "Concurrent Hash Map: Lock-Striped Architecture",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Lock Striping in a ConcurrentHashMap eliminate the global lock bottleneck under heavy multi-threaded write contention?",
    answer: "Lock Striping partitions a hash table into $N$ distinct stripes or buckets (e.g. 16 or 32 segments), each guarded by an independent lock. Operations calculate `hash(key) % N` to determine the stripe. Multiple threads can perform concurrent writes simultaneously as long as their keys map to different stripes.",
    explanation: "A synchronized Hashtable uses a single global mutex, bottlenecking all threads. With 16-stripe lock striping, 16 threads can write concurrently with almost zero lock contention. Global operations (like `size()` or resizing) acquire all 16 locks in a consistent order to prevent deadlocks.",
    code: `// Conceptual Lock-Striped Concurrent Map
class StripedConcurrentMap<K, V> {
  private stripes: number;
  private buckets: Map<K, V>[];
  private locks: boolean[]; // Simulated per-stripe mutex locks

  constructor(stripes: number = 16) {
    this.stripes = stripes;
    this.buckets = Array.from({ length: stripes }, () => new Map<K, V>());
    this.locks = Array.from({ length: stripes }, () => false);
  }

  private getStripeIndex(key: K): number {
    const hash = String(key).split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
    return Math.abs(hash) % this.stripes;
  }

  public put(key: K, value: V): void {
    const stripe = this.getStripeIndex(key);
    // Lock ONLY stripe[stripe], leaving the other 15 stripes free for concurrent writes!
    this.buckets[stripe].set(key, value);
  }

  public get(key: K): V | undefined {
    const stripe = this.getStripeIndex(key);
    return this.buckets[stripe].get(key);
  }
}`,
    recallHint: "Partition map into N stripes with N locks; hash(key) % N locks only the target segment.",
    practice: [
      "Compare Java 7 Segmented Locking vs Java 8+ CAS + synchronized per-bucket nodes in ConcurrentHashMap",
      "Implement size() by acquiring all stripe locks in ascending order to prevent deadlocks"
    ],
    interviewTip: "Explaining Lock Striping vs Global Locking shows you understand how enterprise distributed systems and concurrent databases maximize multi-core throughput.",
    tags: ["Concurrency", "ConcurrentHashMap", "Lock Striping", "Scalability"]
  }),

  createCard({
    idNum: 66,
    category,
    concept: "Circular Ring Buffer (Disruptor Pattern)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the LMAX Disruptor Circular Ring Buffer achieve millions of operations per second without lock contention or garbage collection churn?",
    answer: "The Disruptor uses a pre-allocated, fixed-size Circular Ring Buffer array indexed by power-of-two sequence numbers (`seq & (capacity - 1)`). It relies on atomic CAS memory barriers instead of locks, pre-allocates all event objects upfront to eliminate GC allocations, and uses Cache-Line Padding to prevent False Sharing.",
    explanation: "Standard queues dynamically allocate nodes, thrashing CPU caches and generating GC pressure. A Ring Buffer reuses pre-allocated memory slots. Producers and consumers track monotonically increasing 64-bit sequence counters. Power-of-two bitwise masking replaces expensive modulo math. Cache-line padding ensures sequence variables don't invalidate neighboring core L1/L2 caches.",
    code: `class RingBuffer<T> {
  private buffer: (T | null)[];
  private capacity: number;
  private mask: number;
  private head: number = 0; // Producer sequence
  private tail: number = 0; // Consumer sequence

  constructor(powerOfTwoSize: number = 1024) {
    this.capacity = powerOfTwoSize;
    this.mask = powerOfTwoSize - 1; // Bitwise mask for fast index calculation
    this.buffer = new Array(powerOfTwoSize).fill(null);
  }

  public offer(item: T): boolean {
    if (this.head - this.tail >= this.capacity) {
      return false; // Buffer full (Backpressure)
    }
    const index = this.head & this.mask; // Equivalent to head % capacity, but 10x faster!
    this.buffer[index] = item;
    this.head++;
    return true;
  }

  public poll(): T | null {
    if (this.head === this.tail) {
      return null; // Buffer empty
    }
    const index = this.tail & this.mask;
    const item = this.buffer[index];
    this.buffer[index] = null;
    this.tail++;
    return item;
  }
}`,
    recallHint: "Fixed power-of-two array with bitwise mask (& mask); pre-allocated slots, no locks, no GC churn.",
    practice: [
      "Explain False Sharing in multi-core CPUs and how 64-byte Cache Line Padding prevents it",
      "Design a multi-producer single-consumer ring buffer using atomic sequence reservation"
    ],
    interviewTip: "The Disruptor pattern is the gold standard for high-frequency trading (HFT) and ultra-low latency messaging systems. Mentioning it immediately signals high-performance systems engineering expertise.",
    tags: ["High Performance", "Ring Buffer", "Disruptor Pattern", "Lock-Free"]
  }),

  createCard({
    idNum: 67,
    category,
    concept: "Write-Through vs Write-Back vs Write-Around Caching",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the trade-offs between Write-Through, Write-Back (Write-Behind), and Write-Around caching strategies?",
    answer: "Write-Through writes to the cache and the backing database synchronously, ensuring consistency but higher write latency. Write-Back writes to the cache immediately and acknowledges the client, asynchronously flushing to the database later (ultra-low latency, but risks data loss on crash). Write-Around writes directly to the database, bypassing the cache entirely to avoid cache pollution for write-rarely-read data.",
    explanation: "In Write-Through, data is guaranteed durable before returning. In Write-Back, an asynchronous queue flushes dirty pages in batches, reducing database write I/O by 90%, but requiring Write-Ahead Logging (WAL) to survive unexpected power outages. Write-Around is ideal for large bulk ingest or audit logging.",
    code: `/*
Caching Strategy Comparison Table:
+---------------+------------------------+----------------------+---------------------------+
| Strategy      | Write Latency          | Data Safety          | Cache Warmth              |
+---------------+------------------------+----------------------+---------------------------+
| Write-Through | High (waits for DB)    | 100% Consistent      | Fresh (always warm)       |
| Write-Back    | Ultra-Low (in-memory)  | Risk on Crash        | Fresh (requires dirty bit)|
| Write-Around  | Medium (direct to DB)  | 100% Consistent      | Cold (miss on first read) |
+---------------+------------------------+----------------------+---------------------------+
*/`,
    recallHint: "Write-through = sync DB write; Write-back = async DB flush later; Write-around = bypass cache completely.",
    practice: [
      "Implement a Write-Back cache with a dirty flag and background batch flusher",
      "Model how OS file system page caches use Write-Back caching"
    ],
    interviewTip: "When designing payment or financial ledgers, use Write-Through. When designing social media likes, analytics, or telemetry ingestion, propose Write-Back.",
    tags: ["Caching", "Write-Through", "Write-Back", "Storage Strategies"]
  }),

  createCard({
    idNum: 68,
    category,
    concept: "Multi-Level Cache Hierarchy (L1 Local + L2 Distributed)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you coordinate a Multi-Level Cache Hierarchy combining fast in-memory L1 (Caffeine) with shared L2 (Redis) while preventing stale data?",
    answer: "L1 is an in-memory cache local to each application pod (sub-microsecond reads). L2 is a centralized distributed cache like Redis (sub-millisecond reads). When an update occurs, the worker updates the database, updates L2, and broadcasts a Cache Invalidation event via Redis Pub/Sub so all other pod L1 caches evict their local copy.",
    explanation: "Query flow: Check L1 -> Hit? Return. Miss? Check L2 -> Hit? Populate L1, return. Miss? Query DB, populate L2 and L1, return. The hardest problem is L1 staleness: if Pod A updates a user, Pod B's local memory still holds the old data until its TTL expires or a Pub/Sub invalidation message is received.",
    code: `class MultiLevelCache {
  constructor(
    private l1LocalCache: Map<string, any>,
    private l2DistributedClient: any,
    private messageBus: any
  ) {
    // Listen for invalidations from other pods
    this.messageBus.subscribe("cache:invalidate", (key: string) => {
      this.l1LocalCache.delete(key);
    });
  }

  public async get(key: string): Promise<any> {
    // 1. Check ultra-fast L1 local memory
    if (this.l1LocalCache.has(key)) return this.l1LocalCache.get(key);

    // 2. Check L2 distributed cache (Redis)
    const l2Val = await this.l2DistributedClient.get(key);
    if (l2Val) {
      this.l1LocalCache.set(key, l2Val); // Populate L1
      return l2Val;
    }
    return null; // Cache miss -> fetch from DB
  }

  public async put(key: string, val: any): Promise<void> {
    await this.l2DistributedClient.set(key, val);
    this.l1LocalCache.set(key, val);
    // Broadcast invalidation to all other application nodes!
    await this.messageBus.publish("cache:invalidate", key);
  }
}`,
    recallHint: "L1 local memory -> L2 Redis -> Database. Use Pub/Sub to invalidate L1 caches across pods on write.",
    practice: [
      "Implement short L1 TTL (e.g. 5 seconds) as a safety net against dropped Pub/Sub invalidation messages",
      "Calculate cache hit ratios across L1 and L2 layers"
    ],
    interviewTip: "Highlight that Pub/Sub invalidations can be dropped during network partitions, so L1 caches must ALWAYS have a bounded TTL (e.g. 10-60 seconds) as a fallback.",
    tags: ["Caching", "Multi-Level Cache", "Distributed Caching", "Invalidation"]
  }),

  createCard({
    idNum: 69,
    category,
    concept: "Cache Stampede & Thundering Herd (Singleflight)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a Cache Stampede (Thundering Herd) and how does the Singleflight (Request Collapsing) pattern protect databases?",
    answer: "A Cache Stampede occurs when a hot cache key expires or is invalidated, and hundreds of concurrent incoming requests simultaneously detect a cache miss and rush to query the database, causing CPU spikes, connection pool exhaustion, and cascading database crashes. Singleflight (Mutex Locking) ensures only ONE thread executes the DB query while all other concurrent callers wait and share that single result.",
    explanation: "If 5,000 queries/sec request the product page of an iPhone launch, the moment the cache expires, all 5,000 threads execute `SELECT * FROM products WHERE id=...`. Singleflight acts as a duplicate request coalescer: subsequent callers join a shared Promise/Future instead of issuing redundant SQL queries.",
    code: `class SingleflightGroup {
  private inFlight: Map<string, Promise<any>> = new Map();

  // Guarantees that for a given key, only 1 function execution is active at a time
  public async do<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.inFlight.has(key)) {
      console.log(\`[Singleflight] Coalescing duplicate request for key: \${key}\`);
      return this.inFlight.get(key)!; // Wait on existing in-flight promise!
    }

    const promise = fn().finally(() => {
      this.inFlight.delete(key); // Cleanup once finished
    });

    this.inFlight.set(key, promise);
    return promise;
  }
}

// Usage in cache service:
const singleflight = new SingleflightGroup();

async function getProduct(id: string) {
  let data = cache.get(id);
  if (!data) {
    // 500 concurrent callers share 1 single database query!
    data = await singleflight.do(\`product:\${id}\`, async () => {
      return await db.query("SELECT * FROM products WHERE id = $1", [id]);
    });
    cache.set(id, data, 60000);
  }
  return data;
}`,
    recallHint: "Collapse duplicate concurrent requests into a single in-flight promise; share result across all callers.",
    practice: [
      "Compare Mutex Locking (Singleflight) vs Probabilistic Early Expiration (XFetch algorithm)",
      "Simulate 1,000 concurrent promises hitting singleflight and verify only 1 DB call executed"
    ],
    interviewTip: "In system design, 'How do you prevent a cache stampede?' has three answers: 1. Mutex / Singleflight, 2. Background proactive re-warming before TTL expires, and 3. Probabilistic early expiration (XFetch).",
    tags: ["Caching", "Cache Stampede", "Thundering Herd", "Singleflight"]
  }),

  createCard({
    idNum: 70,
    category,
    concept: "Consistent Hashing Ring & Virtual Nodes",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Consistent Hashing minimize key re-allocation during node scaling, and why are Virtual Nodes necessary?",
    answer: "Consistent Hashing maps both keys and storage nodes onto a circular $2^{32} - 1$ hash ring. A key is assigned to the first node whose position is $\\ge$ key's hash. Adding or removing a node rehashes only $K/N$ keys instead of all keys. Virtual Nodes (v-nodes) assign multiple virtual points per physical node, preventing hot spots and ensuring uniform data distribution.",
    explanation: "Traditional modulo hashing (`hash(key) % N`) reshuffles nearly 100% of keys when $N$ changes, wiping out cache hit ratios. Consistent Hashing bounds reshuffling to $1/N$ of total keys. Without virtual nodes, random hash distribution causes severe imbalances (one node holding 60% of data). Creating 100 virtual nodes per server balances load uniformly within 5% variance.",
    code: `class ConsistentHashRing {
  private ring: Map<number, string> = new Map();
  private sortedHashes: number[] = [];
  private vNodes: number;

  constructor(vNodesPerNode: number = 100) {
    this.vNodes = vNodesPerNode;
  }

  public addNode(node: string): void {
    for (let i = 0; i < this.vNodes; i++) {
      const vNodeKey = \`\${node}#\${i}\`;
      const hash = this.simpleHash(vNodeKey);
      this.ring.set(hash, node);
      this.sortedHashes.push(hash);
    }
    this.sortedHashes.sort((a, b) => a - b);
  }

  public getNode(key: string): string | null {
    if (this.sortedHashes.length === 0) return null;
    const hash = this.simpleHash(key);

    // Binary search for first node with position >= hash
    let low = 0, high = this.sortedHashes.length - 1;
    let targetIndex = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.sortedHashes[mid] >= hash) {
        targetIndex = mid;
        high = mid - 1;
      } else {
        low = mid + 1;
      }
    }
    return this.ring.get(this.sortedHashes[targetIndex])!;
  }

  private simpleHash(str: string): number {
    let hash = 5381;
    for (let i = 0; i < str.length; i++) hash = (hash * 33) ^ str.charCodeAt(i);
    return Math.abs(hash);
  }
}`,
    recallHint: "Hash ring 0 to 2^32-1; key goes to first node clockwise; Virtual nodes guarantee uniform load balance.",
    practice: [
      "Implement node removal on the ring and count the exact percentage of keys remapped",
      "Explain how Cassandra, DynamoDB, and Memcached leverage Consistent Hashing"
    ],
    interviewTip: "Always mention Virtual Nodes when asked about Consistent Hashing. Without virtual nodes, consistent hashing produces severe data skew and hot spots.",
    tags: ["Distributed Systems", "Consistent Hashing", "Virtual Nodes", "Load Balancing"]
  }),

  createCard({
    idNum: 71,
    category,
    concept: "Bloom Filters (Probabilistic Membership Testing)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a Bloom Filter, what are its mathematical guarantees, and why does it have False Positives but NEVER False Negatives?",
    answer: "A Bloom Filter is a space-efficient probabilistic data structure that tests whether an element is a member of a set. It returns either 'Possibly in set' (False Positive possible) or 'Definitely not in set' (Zero False Negatives). It consists of a bit array of size $m$ and $k$ independent hash functions.",
    explanation: "When adding an item, $k$ hash functions set $k$ bits to 1 in the bit array. To query an item, check if all $k$ bits are 1. If ANY bit is 0, the item was definitely NEVER inserted (no false negatives). If all bits are 1, all bits might have been set by other overlapping items (false positive). Used by databases (RocksDB, Cassandra) to avoid expensive disk lookups for non-existent keys.",
    code: `class BloomFilter {
  private size: number;
  private bits: Uint8Array;

  constructor(sizeBits: number = 10000) {
    this.size = sizeBits;
    this.bits = new Uint8Array(Math.ceil(sizeBits / 8));
  }

  private hashes(val: string): [number, number, number] {
    // 3 independent hash seeds
    const h1 = this.hashStr(val, 11) % this.size;
    const h2 = this.hashStr(val, 37) % this.size;
    const h3 = this.hashStr(val, 73) % this.size;
    return [h1, h2, h3];
  }

  public add(val: string): void {
    for (const bitPos of this.hashes(val)) {
      this.bits[Math.floor(bitPos / 8)] |= (1 << (bitPos % 8));
    }
  }

  public mightContain(val: string): boolean {
    for (const bitPos of this.hashes(val)) {
      const byte = this.bits[Math.floor(bitPos / 8)];
      if ((byte & (1 << (bitPos % 8))) === 0) {
        return false; // DEFINITELY NOT IN SET!
      }
    }
    return true; // POSSIBLY IN SET!
  }

  private hashStr(str: string, seed: number): number {
    let hash = seed;
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    return hash;
  }
}`,
    recallHint: "k hash functions set k bits. Any bit 0 -> definitely not present. All bits 1 -> probably present.",
    practice: [
      "Calculate the optimal number of hash functions k = (m/n) * ln(2) for a given false positive rate",
      "Explain Counting Bloom Filters (replacing bits with small integer counters to support deletion)"
    ],
    interviewTip: "Bloom Filters save millions of disk reads in storage engines. Mentioning Counting Bloom Filters or Cuckoo Filters when asked about deletion demonstrates cutting-edge systems literacy.",
    tags: ["Data Structures", "Bloom Filter", "Probabilistic", "Performance"]
  }),

  createCard({
    idNum: 72,
    category,
    concept: "Skiplist Data Structure for Ordered Concurrent Indexes",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why does Redis use a Skiplist instead of a Red-Black Tree for its Sorted Sets (ZSET)?",
    answer: "A Skiplist is a probabilistic hierarchical linked list that achieves $O(\\log N)$ search, insertion, and deletion. Redis chooses Skiplists over Red-Black Trees because: 1. Range queries are trivial: traverse forward on the bottom level linked list. 2. Lock-free concurrent implementations are far simpler than concurrent tree rebalancing. 3. Memory overhead is comparable or lower.",
    explanation: "Rebalancing a Red-Black tree during writes requires mutating parent, uncle, and child pointers, locking large sub-trees during concurrent access. A Skiplist inserts nodes by flipping coins (probabilistic height). Modifications only affect immediate local forward pointers, making it extraordinarily efficient for concurrent sorted indexes.",
    code: `/*
Skiplist Multi-Level Express Lanes:
Level 3: [Head] ------------------------------> [30] ---------------> [NIL]
Level 2: [Head] -------------> [15] ----------> [30] -------> [50] -> [NIL]
Level 1: [Head] -> [7] ------> [15] -> [22] -> [30] -> [40] -> [50] -> [NIL]
Base L0: [Head] -> [3]->[7]->[10]->[15]->[22]->[30]->[35]->[40]->[50]->[NIL]

Search for 40:
1. Start Level 3: 30 is < 40, jump to 30. Next is NIL. Drop to Level 2.
2. At 30: Next is 50 (> 40). Drop to Level 1.
3. At 30: Next is 40. Found in O(log N) steps!
4. Range scan [40 to 50]: Walk forward along Level 0 linked list!
*/`,
    recallHint: "Multi-level express-lane linked lists; O(log N) search and trivial range scans without tree rebalancing.",
    practice: [
      "Implement a Skiplist node promotion function based on a geometric distribution (p = 0.5)",
      "Contrast concurrent SkipListMap vs concurrent Red-Black tree locking requirements"
    ],
    interviewTip: "When an interviewer asks 'Why does Redis use Skiplist for Sorted Sets instead of AVL or Red-Black trees?', cite range query efficiency and the elimination of complex tree rotation rebalancing.",
    tags: ["Data Structures", "Skiplist", "Redis Internals", "Concurrency"]
  })
];
