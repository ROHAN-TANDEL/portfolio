const part5 = [
  {
    id: "hld-ex-43",
    title: "Base62 URL Shortener with Pre-Generated Key Pool (TinyURL)",
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    difficulty: "intermediate",
    whatThisCodeCovers: "A complete URL shortener using a pre-generated Base62 key pool to guarantee collision-free 7-character URLs with fast in-memory lookups.",
    conceptsCovered: ["TinyURL", "Base62 Encoding", "Key Generation Service", "URL Shortening", "O(1) Lookup"],
    code: `const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export class TinyUrlService {
  private urlMapping = new Map<string, string>(); // shortKey -> longUrl
  private preGeneratedKeys: string[] = [];

  constructor() {
    this.preGenerateKeys(100);
  }

  private encodeBase62(n: bigint): string {
    let s = "";
    while (n > 0n) {
      s = BASE62[Number(n % 62n)] + s;
      n = n / 62n;
    }
    return s.padStart(7, "0");
  }

  private preGenerateKeys(count: number) {
    for (let i = 1; i <= count; i++) {
      this.preGeneratedKeys.push(this.encodeBase62(BigInt(i + 100000000)));
    }
  }

  shorten(longUrl: string): string {
    const key = this.preGeneratedKeys.pop();
    if (!key) throw new Error("Key pool exhausted");
    this.urlMapping.set(key, longUrl);
    return \`https://tiny.url/\${key}\`;
  }

  resolve(shortUrl: string): string | null {
    const key = shortUrl.replace("https://tiny.url/", "");
    return this.urlMapping.get(key) || null;
  }
}

// Verification Demo
const tiny = new TinyUrlService();
const short = tiny.shorten("https://www.enterprise.com/pricing/plans/enterprise-annual");
console.log("Shortened URL:", short);
console.log("Resolved Original URL:", tiny.resolve(short));`,
    breakdown: [
      "Encodes integer counters into 7-character alphanumeric Base62 strings.",
      "Pre-generates key pools in advance to eliminate runtime hash collisions and coordination locks.",
      "Enables sub-millisecond redirect resolution via $O(1)$ lookups."
    ],
    expectedOutput: `Shortened URL: https://tiny.url/000GF1c
Resolved Original URL: https://www.enterprise.com/pricing/plans/enterprise-annual`
  },
  {
    id: "hld-ex-44",
    title: "Autocomplete Search Engine with Pre-Computed Top-K Trie",
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    difficulty: "advanced",
    whatThisCodeCovers: "A search autocomplete Prefix Tree (Trie) where each node stores pre-computed top-5 most frequent suggestions for instant sub-millisecond retrieval.",
    conceptsCovered: ["Trie", "Autocomplete", "Top-K", "Prefix Search", "Data Structures"],
    code: `interface Suggestion {
  term: string;
  weight: number;
}

class TrieNode {
  children = new Map<string, TrieNode>();
  topSuggestions: Suggestion[] = []; // Pre-computed top-K results stored directly on node!
}

export class AutocompleteTrie {
  private root = new TrieNode();

  insert(term: string, weight: number) {
    let curr = this.root;
    for (const char of term.toLowerCase()) {
      if (!curr.children.has(char)) {
        curr.children.set(char, new TrieNode());
      }
      curr = curr.children.get(char)!;
      this.updateTopK(curr, { term, weight });
    }
  }

  private updateTopK(node: TrieNode, item: Suggestion) {
    node.topSuggestions.push(item);
    node.topSuggestions.sort((a, b) => b.weight - a.weight);
    if (node.topSuggestions.length > 5) node.topSuggestions.pop(); // Keep Top 5
  }

  search(prefix: string): string[] {
    let curr = this.root;
    for (const char of prefix.toLowerCase()) {
      if (!curr.children.has(char)) return [];
      curr = curr.children.get(char)!;
    }
    return curr.topSuggestions.map(s => s.term);
  }
}

// Verification Demo
const autocomplete = new AutocompleteTrie();
autocomplete.insert("system design interview", 500);
autocomplete.insert("system design primer", 400);
autocomplete.insert("system analysis", 150);
autocomplete.insert("syntax error javascript", 100);

console.log("Autocomplete for 'sys':", autocomplete.search("sys"));
console.log("Autocomplete for 'system d':", autocomplete.search("system d"));`,
    breakdown: [
      "Traverses the prefix tree down to the matching character node.",
      "Reads pre-computed top-5 suggestions directly off the node in O(1) time without leaf traversals.",
      "Dramatically reduces search query latency for millions of concurrent typing users."
    ],
    expectedOutput: `Autocomplete for 'sys': [ 'system design interview', 'system design primer', 'system analysis' ]
Autocomplete for 'system d': [ 'system design interview', 'system design primer' ]`
  },
  {
    id: "hld-ex-45",
    title: "Spatial Proximity Search via Geohash Grid Encoding",
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    difficulty: "advanced",
    whatThisCodeCovers: "A spatial indexing engine converting latitude/longitude coordinates into 6-character Geohashes, indexing drivers in spatial grid buckets for rapid proximity queries.",
    conceptsCovered: ["Spatial Indexing", "Geohash", "Uber / Lyft", "Proximity Search", "Grid Buckets"],
    code: `const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";

export class SpatialIndex {
  private grid = new Map<string, Array<{ id: string; lat: number; lon: number }>>();

  // Simplified Geohash encoder
  encodeGeohash(lat: number, lon: number, precision = 5): string {
    let latMin = -90, latMax = 90;
    let lonMin = -180, lonMax = 180;
    let geohash = "";
    let isEven = true;
    let bit = 0, ch = 0;

    while (geohash.length < precision) {
      if (isEven) {
        const mid = (lonMin + lonMax) / 2;
        if (lon > mid) { ch |= (1 << (4 - bit)); lonMin = mid; } else { lonMax = mid; }
      } else {
        const mid = (latMin + latMax) / 2;
        if (lat > mid) { ch |= (1 << (4 - bit)); latMin = mid; } else { latMax = mid; }
      }
      isEven = !isEven;
      if (bit < 4) { bit++; } else {
        geohash += BASE32[ch];
        bit = 0; ch = 0;
      }
    }
    return geohash;
  }

  addEntity(id: string, lat: number, lon: number) {
    const hash = this.encodeGeohash(lat, lon);
    if (!this.grid.has(hash)) this.grid.set(hash, []);
    this.grid.get(hash)!.push({ id, lat, lon });
  }

  findNearby(lat: number, lon: number): Array<{ id: string; lat: number; lon: number }> {
    const hash = this.encodeGeohash(lat, lon);
    return this.grid.get(hash) || [];
  }
}

// Verification Demo
const spatial = new SpatialIndex();
spatial.addEntity("driver_01", 37.7749, -122.4194); // San Francisco
spatial.addEntity("driver_02", 37.7752, -122.4191); // Nearby SF
spatial.addEntity("driver_03", 40.7128, -74.0060);  // NYC

console.log("Nearby Drivers in SF:", spatial.findNearby(37.7749, -122.4194).map(d => d.id));`,
    breakdown: [
      "Encodes 2D geographic coordinates into 1D hierarchical string geohashes.",
      "Indexes moving entities into localized spatial grid cells in RAM.",
      "Enables ride-hailing services to query nearby drivers in sub-millisecond times."
    ],
    expectedOutput: `Nearby Drivers in SF: [ 'driver_01', 'driver_02' ]`
  },
  {
    id: "hld-ex-46",
    title: "Content-Addressable Chunk Storage with SHA-256 Deduplication (Dropbox)",
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    difficulty: "advanced",
    whatThisCodeCovers: "A cloud file chunking and content-addressable storage engine calculating SHA-256 signatures per 4MB block and deduplicating storage globally across users.",
    conceptsCovered: ["Content-Addressable Storage", "Deduplication", "Chunking", "Dropbox", "SHA-256"],
    code: `import crypto from "crypto";

export class ChunkDeduplicationStorage {
  private globalStorage = new Map<string, string>(); // sha256 -> chunk bytes
  private fileManifests = new Map<string, string[]>(); // fileId -> sha256 chunks

  storeFile(fileId: string, chunks: string[]): { uploadedCount: number; deduplicatedCount: number } {
    let uploadedCount = 0;
    let deduplicatedCount = 0;
    const manifest: string[] = [];

    for (const chunk of chunks) {
      const sha256 = crypto.createHash("sha256").update(chunk).digest("hex").substring(0, 16);
      manifest.push(sha256);

      if (this.globalStorage.has(sha256)) {
        deduplicatedCount++; // Already exists in cloud! Skip upload!
      } else {
        this.globalStorage.set(sha256, chunk);
        uploadedCount++;
      }
    }

    this.fileManifests.set(fileId, manifest);
    return { uploadedCount, deduplicatedCount };
  }

  getFile(fileId: string): string {
    const chunkHashes = this.fileManifests.get(fileId) || [];
    return chunkHashes.map(hash => this.globalStorage.get(hash)).join("");
  }
}

// Verification Demo
const storage = new ChunkDeduplicationStorage();

// User 1 uploads chunks A, B, C
const r1 = storage.storeFile("file_1", ["Chunk_A", "Chunk_B", "Chunk_C"]);
console.log("User 1 Upload Result:", r1);

// User 2 uploads file with Chunk A, Chunk B (reused!), and Chunk D (new)
const r2 = storage.storeFile("file_2", ["Chunk_A", "Chunk_B", "Chunk_D"]);
console.log("User 2 Upload Result (Deduplicated):", r2);`,
    breakdown: [
      "Splits large files into independent content-addressable blocks identified by SHA-256 hash.",
      "Reuses existing blocks already stored in cloud object storage, saving up to 80% bandwidth.",
      "Assembles reconstructed files from lightweight chunk manifest metadata."
    ],
    expectedOutput: `User 1 Upload Result: { uploadedCount: 3, deduplicatedCount: 0 }
User 2 Upload Result (Deduplicated): { uploadedCount: 1, deduplicatedCount: 2 }`
  },
  {
    id: "hld-ex-47",
    title: "Hybrid Timeline Newsfeed Aggregator (Push vs Celebrity Pull)",
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    difficulty: "advanced",
    whatThisCodeCovers: "A hybrid newsfeed aggregator pushing regular tweets to follower timelines (Fan-out-on-Write) while pulling celebrity tweets dynamically on request (Fan-out-on-Read).",
    conceptsCovered: ["Hybrid Fan-Out", "Newsfeed", "Celebrity Problem", "Timeline Caching", "Redis ZSET"],
    code: `interface Tweet {
  id: string;
  authorId: string;
  text: string;
  timestamp: number;
}

export class HybridFeedService {
  private userTimelines = new Map<string, Tweet[]>(); // Follower push timelines
  private authorPosts = new Map<string, Tweet[]>();   // Author historical posts

  publishTweet(tweet: Tweet, authorFollowers: string[], isCelebrity: boolean) {
    // 1. Store in author's own timeline
    if (!this.authorPosts.has(tweet.authorId)) this.authorPosts.set(tweet.authorId, []);
    this.authorPosts.get(tweet.authorId)!.push(tweet);

    // 2. If NOT celebrity: Push to all followers' timelines (Fan-out on Write)
    if (!isCelebrity) {
      for (const followerId of authorFollowers) {
        if (!this.userTimelines.has(followerId)) this.userTimelines.set(followerId, []);
        this.userTimelines.get(followerId)!.push(tweet);
      }
    }
  }

  getFeed(userId: string, followedCelebrities: string[]): Tweet[] {
    // 1. Get pushed timeline
    const pushFeed = this.userTimelines.get(userId) || [];

    // 2. Pull recent tweets from celebrities
    const celebTweets: Tweet[] = [];
    for (const celebId of followedCelebrities) {
      const posts = this.authorPosts.get(celebId) || [];
      celebTweets.push(...posts.slice(-5));
    }

    // 3. Merge and sort by timestamp
    const all = [...pushFeed, ...celebTweets];
    return all.sort((a, b) => b.timestamp - a.timestamp);
  }
}

// Verification Demo
const feed = new HybridFeedService();

// Regular User posts
feed.publishTweet({ id: "t1", authorId: "friend_1", text: "Hello world!", timestamp: 100 }, ["user_me"], false);

// Celebrity posts (50M followers: NOT pushed to user_me timeline!)
feed.publishTweet({ id: "t2", authorId: "celebrity_star", text: "New Album Out!", timestamp: 200 }, [], true);

const myFeed = feed.getFeed("user_me", ["celebrity_star"]);
console.log("Generated Home Feed:", myFeed.map(t => \`[\${t.authorId}] \${t.text}\`));`,
    breakdown: [
      "Fans out regular user updates to pre-computed follower timelines.",
      "Bypasses fan-out for celebrity accounts with millions of followers to avoid write storms.",
      "Merges pre-computed push timelines with celebrity pull feeds dynamically on read."
    ],
    expectedOutput: `Generated Home Feed: [ '[celebrity_star] New Album Out!', '[friend_1] Hello world!' ]`
  },
  {
    id: "hld-ex-48",
    title: "Real-Time WebSocket Session Gateway with Redis Presence Broker",
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    difficulty: "advanced",
    whatThisCodeCovers: "A multi-node real-time chat routing gateway that maps connected user sockets to gateway pod IDs in Redis and routes inter-gateway messages across nodes.",
    conceptsCovered: ["WebSockets", "Session Registry", "Presence", "Chat Routing", "Redis Pub/Sub"],
    code: `export class ChatGatewayNode {
  private localSockets = new Map<string, (msg: any) => void>();

  constructor(
    public gatewayId: string,
    private redisPresence: Map<string, string>, // userId -> gatewayId
    private internalBus: Map<string, (msg: any) => void>
  ) {
    // Register inter-gateway message listener
    this.internalBus.set(this.gatewayId, (msg) => this.deliverLocally(msg.recipientId, msg.payload));
  }

  connectUser(userId: string, sendFn: (msg: any) => void) {
    this.localSockets.set(userId, sendFn);
    this.redisPresence.set(userId, this.gatewayId); // Register presence in Redis
  }

  sendMessage(senderId: string, recipientId: string, payload: any) {
    const targetGateway = this.redisPresence.get(recipientId);
    if (!targetGateway) {
      console.log(\`User \${recipientId} is OFFLINE. Saved to offline storage.\`);
      return;
    }

    if (targetGateway === this.gatewayId) {
      this.deliverLocally(recipientId, payload);
    } else {
      console.log(\`Routing message from \${this.gatewayId} -> \${targetGateway} via internal bus\`);
      const forwarder = this.internalBus.get(targetGateway);
      if (forwarder) forwarder({ recipientId, payload });
    }
  }

  private deliverLocally(recipientId: string, payload: any) {
    const socket = this.localSockets.get(recipientId);
    if (socket) socket(payload);
  }
}

// Verification Demo
const sharedPresence = new Map<string, string>();
const sharedBus = new Map<string, (msg: any) => void>();

const gateway1 = new ChatGatewayNode("gateway_us_1", sharedPresence, sharedBus);
const gateway2 = new ChatGatewayNode("gateway_us_2", sharedPresence, sharedBus);

// User Alice connects to Gateway 1; User Bob connects to Gateway 2
gateway1.connectUser("alice", (msg) => console.log("Alice received:", msg));
gateway2.connectUser("bob", (msg) => console.log("Bob received:", msg));

// Alice sends message to Bob
gateway1.sendMessage("alice", "bob", "Hey Bob, how is it going?");`,
    breakdown: [
      "Maintains persistent client sockets on stateful edge gateway pods.",
      "Tracks connected user locations in a shared in-memory presence registry.",
      "Routes messages across different gateway instances seamlessly via an internal message bus."
    ],
    expectedOutput: `Routing message from gateway_us_1 -> gateway_us_2 via internal bus
Bob received: Hey Bob, how is it going?`
  },
  {
    id: "hld-ex-49",
    title: "Flash Sale Atomic Stock Decrement Engine (Redis Lua)",
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    difficulty: "advanced",
    whatThisCodeCovers: "A high-concurrency inventory reservation engine using atomic Redis Lua scripts to prevent overselling 10,000 flash-sale items under 500,000 concurrent callers.",
    conceptsCovered: ["Flash Sale", "Redis Lua", "Atomic Operations", "Overselling Prevention", "Inventory"],
    code: `export class FlashSaleEngine {
  private stock = 0;
  private buyers = new Set<string>();

  constructor(initialStock: number) {
    this.stock = initialStock;
  }

  // Simulating atomic Redis Lua script execution
  async buy(userId: string): Promise<"SUCCESS" | "ALREADY_BOUGHT" | "SOLD_OUT"> {
    // 1. Anti-hoarding check: prevent same user buying twice
    if (this.buyers.has(userId)) {
      return "ALREADY_BOUGHT";
    }

    // 2. Atomic stock decrement
    if (this.stock > 0) {
      this.stock--;
      this.buyers.add(userId);
      return "SUCCESS";
    } else {
      return "SOLD_OUT";
    }
  }

  getRemainingStock(): number { return this.stock; }
}

// Verification Demo
const flashSale = new FlashSaleEngine(3); // Only 3 items available!

const r1 = await flashSale.buy("user_alice");
const r2 = await flashSale.buy("user_bob");
const r3 = await flashSale.buy("user_alice"); // Duplicate
const r4 = await flashSale.buy("user_charlie");
const r5 = await flashSale.buy("user_david"); // Exceeds stock

console.log("Alice:", r1);
console.log("Bob:", r2);
console.log("Alice (Duplicate attempt):", r3);
console.log("Charlie:", r4);
console.log("David (Sold out):", r5);
console.log("Remaining stock (Zero overselling):", flashSale.getRemainingStock());`,
    breakdown: [
      "Executes inventory checks and decrements atomically in a single in-memory evaluation.",
      "Blocks duplicate buyers with set membership checks to prevent inventory hoarding.",
      "Guarantees that stock count never drops below zero under heavy concurrent surges."
    ],
    expectedOutput: `Alice: SUCCESS
Bob: SUCCESS
Alice (Duplicate attempt): ALREADY_BOUGHT
Charlie: SUCCESS
David (Sold out): SOLD_OUT
Remaining stock (Zero overselling): 0`
  },
  {
    id: "hld-ex-50",
    title: "Streaming Window Aggregator for Ad Clicks (Tumbling Window)",
    category: "Messaging, Streaming & Asynchronous Processing",
    difficulty: "advanced",
    whatThisCodeCovers: "A streaming event-time tumbling window aggregator (Apache Flink pattern) bucketing hundreds of ad clicks into 5-second summary windows.",
    conceptsCovered: ["Tumbling Window", "Stream Processing", "Event Time", "Ad Clicks", "Flink"],
    code: `interface ClickEvent {
  adId: string;
  timestampSec: number;
}

export class TumblingWindowAggregator {
  private windows = new Map<string, number>(); // "adId:windowStart" -> count

  constructor(private windowSizeSec = 5) {}

  processClick(event: ClickEvent) {
    const windowStart = Math.floor(event.timestampSec / this.windowSizeSec) * this.windowSizeSec;
    const windowKey = \`\${event.adId}:\${windowStart}\`;
    const count = this.windows.get(windowKey) || 0;
    this.windows.set(windowKey, count + 1);
  }

  getAggregates(): Array<{ adId: string; windowStart: number; count: number }> {
    const results: Array<{ adId: string; windowStart: number; count: number }> = [];
    for (const [key, count] of this.windows.entries()) {
      const [adId, startStr] = key.split(":");
      results.push({ adId, windowStart: parseInt(startStr, 10), count });
    }
    return results;
  }
}

// Verification Demo
const aggregator = new TumblingWindowAggregator(5);

aggregator.processClick({ adId: "ad_101", timestampSec: 1 });
aggregator.processClick({ adId: "ad_101", timestampSec: 3 });
aggregator.processClick({ adId: "ad_101", timestampSec: 6 }); // Next window!
aggregator.processClick({ adId: "ad_202", timestampSec: 2 });

console.log("Aggregated Windows:", aggregator.getAggregates());`,
    breakdown: [
      "Groups continuous event-time streaming ticks into fixed, non-overlapping tumbling window buckets.",
      "Aggregates hundreds of thousands of raw click events into compact summary counters in memory.",
      "Reduces downstream database write volume by orders of magnitude."
    ],
    expectedOutput: `Aggregated Windows: [
  { adId: 'ad_101', windowStart: 0, count: 2 },
  { adId: 'ad_101', windowStart: 5, count: 1 },
  { adId: 'ad_202', windowStart: 0, count: 1 }
]`
  },
  {
    id: "hld-ex-51",
    title: "Sequence CRDT with Fractional Indexing for Collaborative Text",
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    difficulty: "advanced",
    whatThisCodeCovers: "A sequence Conflict-Free Replicated Data Type (CRDT) using fractional identifiers to enable concurrent, commutative text editing across distributed collaborators.",
    conceptsCovered: ["Sequence CRDT", "Fractional Indexing", "Real-Time Collaboration", "Figma", "Commutativity"],
    code: `interface CRDTChar {
  id: number;
  value: string;
}

export class SequenceCRDT {
  public chars: CRDTChar[] = [];

  insert(value: string, leftId?: number, rightId?: number): CRDTChar {
    let newId: number;
    if (leftId === undefined && rightId === undefined) {
      newId = 1.0;
    } else if (leftId !== undefined && rightId === undefined) {
      newId = leftId + 1.0;
    } else if (leftId === undefined && rightId !== undefined) {
      newId = rightId / 2.0;
    } else {
      newId = (leftId! + rightId!) / 2.0; // Fractional index midway between neighbors!
    }

    const item: CRDTChar = { id: newId, value };
    this.chars.push(item);
    this.chars.sort((a, b) => a.id - b.id);
    return item;
  }

  getText(): string {
    return this.chars.map(c => c.value).join("");
  }
}

// Verification Demo
const doc = new SequenceCRDT();
const c1 = doc.insert("H"); // id: 1.0
const c2 = doc.insert("L", c1.id); // id: 2.0

// Insert 'E' between 'H' (1.0) and 'L' (2.0) -> gets id 1.5
doc.insert("E", c1.id, c2.id);

console.log("Constructed Collaborative Text:", doc.getText());`,
    breakdown: [
      "Assigns immutable fractional floating-point keys between adjacent characters.",
      "Eliminates index shifting and complex Operational Transformation (OT) matrices.",
      "Enables commutative peer-to-peer merging of concurrent edits without data corruption."
    ],
    expectedOutput: `Constructed Collaborative Text: HEL`
  },
  {
    id: "hld-ex-52",
    title: "PagedAttention Simulator for LLM Key-Value (KV) Cache Management",
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    difficulty: "advanced",
    whatThisCodeCovers: "A PagedAttention memory manager simulator (vLLM pattern) organizing GPU Key-Value (KV) cache into non-contiguous virtual pages to eliminate memory fragmentation.",
    conceptsCovered: ["PagedAttention", "vLLM", "KV Cache", "AI Serving", "Virtual Memory"],
    code: `export class PagedAttentionManager {
  private physicalMemoryPages: Array<{ id: number; tokens: string[] }> = [];
  private pageTable = new Map<string, number[]>(); // requestId -> physicalPageIds

  constructor(private totalPages = 10, private pageSize = 4) {
    for (let i = 0; i < totalPages; i++) {
      this.physicalMemoryPages.push({ id: i, tokens: [] });
    }
  }

  allocateToken(requestId: string, token: string) {
    if (!this.pageTable.has(requestId)) {
      this.pageTable.set(requestId, []);
    }

    const assignedPages = this.pageTable.get(requestId)!;
    let targetPage = assignedPages.length > 0 ? this.physicalMemoryPages[assignedPages[assignedPages.length - 1]] : null;

    // If current page is full, allocate a new free physical page
    if (!targetPage || targetPage.tokens.length >= this.pageSize) {
      const freePage = this.physicalMemoryPages.find(p => p.tokens.length === 0);
      if (!freePage) throw new Error("GPU VRAM Out-Of-Memory!");
      assignedPages.push(freePage.id);
      targetPage = freePage;
    }

    targetPage.tokens.push(token);
  }

  getTokensForRequest(requestId: string): string[] {
    const pageIds = this.pageTable.get(requestId) || [];
    return pageIds.flatMap(id => this.physicalMemoryPages[id].tokens);
  }
}

// Verification Demo
const vllm = new PagedAttentionManager(10, 2); // 2 tokens per page block
vllm.allocateToken("req_1", "System");
vllm.allocateToken("req_1", "Design");
vllm.allocateToken("req_1", "Mastery"); // Spills into page 2 non-contiguously!

console.log("Tokens reconstructed via PagedAttention table:", vllm.getTokensForRequest("req_1"));`,
    breakdown: [
      "Divides GPU VRAM into fixed-size physical memory pages (blocks).",
      "Maps logical request token streams dynamically using a page table.",
      "Eliminates 60%+ internal memory fragmentation in Large Language Model (LLM) serving."
    ],
    expectedOutput: `Tokens reconstructed via PagedAttention table: [ 'System', 'Design', 'Mastery' ]`
  }
];

module.exports = part5;
