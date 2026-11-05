const { createCard } = require("../hld_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 97,
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    concept: "Designing a URL Shortener (TinyURL)",
    priority: "must-know",
    difficulty: "must-know",
    question: "Design a globally scalable URL Shortener (TinyURL) handling 500 million new URLs per month with 100:1 read-to-write ratio, Base62 encoding, and sub-10ms redirection.",
    answer: "A scalable URL shortener uses a Key Generation Service (KGS) to pre-generate unique 7-character Base62 keys, eliminating runtime hash collisions and coordination locks. Reads are cached aggressively in Redis ($>90\\%$ hit rate), returning HTTP 302/301 redirects, while persistent mappings are stored in a distributed NoSQL/RDBMS table sharded by the short key.",
    explanation: `System Scale Calculations:
- Writes: 500 million new URLs/month $\\approx 200\\text{ writes/sec}$.
- Reads (100:1 ratio): $20,000\\text{ reads/sec}$.
- Storage over 5 years: $500\\text{M} \\times 12 \\times 5 = 30\\text{ billion URLs}$. At 500 bytes per record $\\approx 15\\text{ TB}$ total storage.

Base62 Encoding vs Hashing:
- Characters: \`[0-9, a-z, A-Z]\` = 62 characters.
- A 7-character Base62 string yields $62^7 \\approx 3.52\\text{ trillion}$ unique combinations (vastly exceeding the 30 billion required).
- Naive Hash Approach: MD5/SHA256 of the long URL produces 32+ characters; taking the first 7 characters causes hash collisions that require database lookup loops.

The Key Generation Service (KGS) Architecture:
- A standalone service pre-generates billions of unique random 7-character Base62 strings in advance and stores them in a \`key_vault\` table.
- KGS instances load blocks of 1,000 keys into local memory.
- When a user shortens a URL, the web server grabs an already-generated key instantly ($<1\\text{ms}$) with zero collision checks and writes to the DB.

HTTP 301 vs 302 Redirection:
- **HTTP 301 Permanent Redirect**: Browser caches the redirection permanently. Subsequent clicks bypass the TinyURL server completely. Pros: Zero server load. Cons: Cannot collect click analytics!
- **HTTP 302 Temporary Redirect**: Browser checks TinyURL on every click. Pros: Accurate click tracking and analytics. Cons: Higher server load (handled by Redis caching).`,
    code: `/*
TinyURL Topology:
[ User Click ] ──> [ Anycast CDN / L7 LB ]
                         │
                 [ Redis Cluster ] ──(Hit 95% -> HTTP 302 in 2ms)
                         │ Miss
                 [ Sharded DB (PostgreSQL / DynamoDB) ]

Key Generation Service (KGS):
[ KGS Node 1 (Takes Keys 0-1M) ]   ──> [ Pre-Populated Key Vault ]
[ KGS Node 2 (Takes Keys 1M-2M) ]
*/

// Base62 Converter in Node.js
const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

function encodeBase62(num: bigint): string {
  let str = "";
  while (num > 0n) {
    str = BASE62[Number(num % 62n)] + str;
    num = num / 62n;
  }
  return str.padStart(7, "0");
}`,
    recallHint: "TinyURL: 7-char Base62 = 3.5 trillion URLs. KGS pre-generates keys to eliminate collisions. 302 for analytics.",
    interviewTip: "Always discuss the 301 vs 302 redirect trade-off. Mention that marketing and monetization rely on click analytics, making HTTP 302 the preferred production choice.",
    tags: ["system-design", "tinyurl", "url-shortener", "base62", "kgs", "caching"]
  }),

  createCard({
    idNum: 98,
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    concept: "Designing a Hyper-Scale Distributed Rate Limiter",
    priority: "must-know",
    difficulty: "advanced",
    question: "Design a distributed Rate Limiter handling 1,000,000 requests per second across 10 global regions, preventing race conditions without bottlenecking Redis.",
    answer: "A hyper-scale rate limiter combines a two-tier architecture: local in-memory token buckets on API Gateway proxies for microsecond evaluation with periodic asynchronous batch synchronization against a global Redis Cluster using atomic Lua scripts. Client identifiers (API key or IP) are hashed to Redis hash slots with local fallbacks if Redis times out.",
    explanation: `Architecture for 1,000,000 RPS:
Directly executing a remote Redis command for every single request at 1M RPS would require a massive, expensive 50-node Redis cluster and introduce 2–5ms of network latency per request.

The Two-Tier Token Leasing Blueprint:
1. Tier 1: Local In-Memory Rate Limiter on API Gateway:
   - Each API Gateway instance maintains an in-process Token Bucket in local memory.
   - Evaluates requests in 50 nanoseconds with zero network hops!
2. Tier 2: Centralized Redis Cluster (Batch Token Leasing):
   - Instead of checking Redis per request, the API Gateway instance leases a batch of tokens (e.g., 500 tokens for Client X) from Redis in a single atomic Lua command.
   - The Gateway serves incoming requests locally using its leased batch.
   - When the local lease drops to 20%, it asynchronously requests the next batch from Redis in the background.

Failure Mode & Resilient Fallback:
- If Redis becomes unreachable or network partitions: the rate limiter enters **Fail-Open Mode** (or falls back to a conservative local hard limit) so valid user traffic is never blocked by monitoring infrastructure outages.
- Standard Headers Returned:
  \`X-RateLimit-Limit: 1000\`, \`X-RateLimit-Remaining: 420\`, \`X-RateLimit-Reset: 1714560000\`.`,
    code: `/*
Two-Tier Distributed Rate Limiting:

[ Incoming Request 1M RPS ]
             │
   [ API Gateway Envoy/Node ]
   └── [ Local In-Memory Bucket (50ns check) ]
             │ (Lease 500 tokens in background every 2s)
             ▼
   [ Redis Cluster (Atomic Lua Scripts) ]
*/`,
    recallHint: "1M RPS: Don't hit Redis on every request! Lease token batches to local gateways and evaluate locally.",
    interviewTip: "Discuss 'Fail-Open vs Fail-Closed' trade-offs: for security APIs (login attempts), fail-closed; for public content APIs (reading tweets), fail-open to preserve availability.",
    tags: ["system-design", "rate-limiter", "redis", "token-bucket", "scalability", "lua"]
  }),

  createCard({
    idNum: 99,
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    concept: "Designing Instagram / Photo Sharing Service",
    priority: "must-know",
    difficulty: "must-know",
    question: "Design a photo-sharing platform like Instagram handling 50 million photo uploads per day, asynchronous thumbnail generation, and sub-100ms feed retrieval.",
    answer: "The architecture separates image binary storage from metadata persistence: photos are uploaded directly to Object Storage (S3) via presigned URLs, bypassing application servers. An asynchronous event pipeline (S3 Event -> SQS -> Workers) resizes images into multiple resolutions. Photo metadata is stored in a distributed NoSQL/PostgreSQL database, and user feeds are pre-computed in Redis.",
    explanation: `Core Scale Requirements:
- Uploads: 50 million photos/day $\\approx 600\\text{ uploads/sec}$.
- Reads: 500 million feed views/day $\\approx 6,000\\text{ views/sec}$.
- Storage: 50M photos $\\times 2\\text{ MB} = 100\\text{ TB/day} = 36.5\\text{ PB/year}$.

1. Direct Upload via Presigned S3 URLs (Avoid Server Bottlenecks):
   - Client sends \`POST /api/v1/photos/presign\`.
   - App Server verifies user auth and returns a pre-signed S3 PUT URL with an S3 upload policy.
   - Client uploads the 5MB photo directly to S3. App servers never touch the image bytes!
2. Asynchronous Image Processing Pipeline:
   - S3 triggers an \`ObjectCreated\` event to AWS SQS.
   - Image Processor workers (Golang/Rust with libvips) consume from SQS, download original, and generate 4 resolution variants (thumbnail, mobile, tablet, full).
   - Variants saved to S3; public CDN URLs updated in Metadata DB.
3. Storage Architecture:
   - **Image Binaries**: Amazon S3 with Lifecycle Policies (move to S3 Glacier after 90 days).
   - **Metadata & Social Graph**: Distributed database (Cassandra or Sharded PostgreSQL) storing: \`{ photoId, userId, cdnUrls, caption, createdAt }\`.
   - **CDN Tier**: Cloudflare / CloudFront caches 95%+ of photo read requests at the edge.`,
    code: `/*
Instagram Upload & Ingestion Architecture:

[ Mobile App ] ──(1. Get Presigned URL)──> [ API Gateway ] ──> [ Metadata DB ]
      │
      └──(2. Upload 5MB Direct)──────────> [ AWS S3 Bucket ]
                                                   │ (S3 Event)
                                                   ▼
                                           [ SQS Message Queue ]
                                                   │
                                                   ▼
                                           [ Image Workers ]
                                           (Generates 4 sizes, writes to S3)
                                                   │
                                                   ▼
                                           [ CloudFront CDN ]
*/`,
    recallHint: "Photos to S3 via presigned URLs. Workers generate thumbnails via SQS. Metadata in DB. CDN serves reads.",
    interviewTip: "Never stream multi-megabyte image uploads through your backend API servers; it exhausts server sockets and memory. Always use Presigned S3/GCS URLs for direct client-to-storage uploads.",
    tags: ["system-design", "instagram", "photo-sharing", "s3", "cdn", "presigned-urls"]
  }),

  createCard({
    idNum: 100,
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    concept: "Designing a Distributed Unique ID Generator (Twitter Snowflake)",
    priority: "must-know",
    difficulty: "must-know",
    question: "Design a distributed 64-bit globally unique ID generator (Twitter Snowflake) producing strictly k-sorted IDs at 100,000 IDs/sec per node without inter-node coordination.",
    answer: "Twitter Snowflake generates 64-bit unique, roughly time-ordered (k-sorted) integer IDs structured as: 1 sign bit + 41-bit millisecond timestamp + 10-bit Datacenter/Worker ID + 12-bit sequence counter. This enables 1,024 independent worker nodes to generate up to 4,096 unique IDs per millisecond per node ($4.096\\text{ million IDs/sec}$) without centralized database locks.",
    explanation: `Bit Allocation Layout (64-Bit Integer):
\`\`\`
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|0|                     41-bit Timestamp                        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|   Timestamp (cont.)   | 5-bit DC | 5-bit Worker | 12-bit Seq  |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
\`\`\`
1. Sign Bit (1 bit): Always 0 (ensures positive signed integer).
2. Timestamp (41 bits): Milliseconds elapsed since a custom epoch (e.g., Nov 4, 2026).
   - $2^{41} \\text{ ms} \\approx 69\\text{ years}$ lifespan before rollover.
3. Datacenter ID (5 bits): $2^5 = 32$ data centers.
4. Worker Node ID (5 bits): $2^5 = 32$ workers per data center ($32 \\times 32 = 1,024\\text{ nodes}$).
5. Sequence Number (12 bits): $2^{12} = 4,096$ IDs per millisecond per worker node. Resets to 0 each millisecond.

The Clock Backward Hazard:
If NTP sync steps the system clock backward: the node could generate duplicate IDs!
- Mitigation: If current clock $< \\text{lastTimestamp}$, the generator refuses to issue IDs and either sleeps until the clock catches up or throws an exception.`,
    code: `// Twitter Snowflake ID Generator Implementation in TypeScript
class Snowflake {
  private customEpoch = 1714560000000n; // Custom project epoch in ms
  private sequence = 0n;
  private lastTimestamp = -1n;

  constructor(private datacenterId: bigint, private workerId: bigint) {
    if (datacenterId > 31n || workerId > 31n) throw new Error("ID out of range");
  }

  nextId(): bigint {
    let timestamp = BigInt(Date.now());

    if (timestamp < this.lastTimestamp) {
      throw new Error("Clock moved backwards! Refusing to generate ID");
    }

    if (timestamp === this.lastTimestamp) {
      this.sequence = (this.sequence + 1n) & 4095n; // 12-bit mask
      if (this.sequence === 0n) {
        // Overflow in current ms -> spin wait until next ms
        while (timestamp <= this.lastTimestamp) {
          timestamp = BigInt(Date.now());
        }
      }
    } else {
      this.sequence = 0n;
    }

    this.lastTimestamp = timestamp;

    return (
      ((timestamp - this.customEpoch) << 22n) |
      (this.datacenterId << 17n) |
      (this.workerId << 12n) |
      this.sequence
    );
  }
}`,
    recallHint: "Snowflake: 41-bit time + 10-bit node + 12-bit sequence = 64-bit k-sorted ID. 4M IDs/sec without locks.",
    interviewTip: "Explain why Snowflake IDs are superior to UUID v4: Snowflake IDs are 64-bit integers (vs 128-bit strings) and are naturally time-ordered (k-sorted), preventing B+ Tree index fragmentation in relational databases.",
    tags: ["system-design", "snowflake", "uuid", "id-generator", "concurrency", "distributed-systems"]
  }),

  createCard({
    idNum: 101,
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    concept: "Designing a Distributed Web Crawler (Googlebot)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Design a distributed Web Crawler processing 1 billion web pages per month, ensuring politeness (robots.txt compliance), deduplication, and avoiding crawler traps.",
    answer: "A distributed web crawler manages a prioritized URL Frontier partitioned by host for politeness, a Bloom Filter for $O(1)$ visited-URL deduplication, distributed Fetcher worker pools parsing HTML, and an S3/HDFS document store. Politeness queues enforce domain delays, while content hashing (SimHash) detects near-duplicate mirrors and infinite crawler traps.",
    explanation: `Key Crawler Subsystems:
1. URL Frontier (The Crawling Queue):
   - Prioritizer: Ranks URLs by PageRank and update frequency (crawl news sites hourly, blogs monthly).
   - Politeness Enforcer: Crawling a website too aggressively is effectively a DDoS attack. The frontier maintains a dedicated FIFO sub-queue per hostname (\`HostQueue\`). A worker visits a domain, parses \`robots.txt\`, and sleeps (e.g., 1000ms delay) before requesting the next URL from that specific host queue.
2. Deduplication Layer:
   - **URL Filter**: In-memory Bloom Filter backed by Redis checks if a URL has already been queued or visited ($< 1\\text{KB}$ memory per 10,000 URLs).
   - **Content Deduplication**: Web pages mirror each other under different URLs. Compute **SimHash / 64-bit Fingerprint** of the HTML text to detect duplicate content.
3. Crawler Trap Detection:
   - Traps (e.g., calendar links \`/calendar/2026/05/01/next...\` or infinite symbolic loops).
   - Mitigated by max URL length thresholds ($< 256$ chars), maximum path depth caps ($< 10$ levels), and domain URL count limits.`,
    code: `/*
Distributed Web Crawler Architecture:

[ Seed URLs ] ──> [ URL Frontier ]
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
    [ Politeness Queue: cnn.com ]   [ Politeness Queue: bbc.com ]
             │ (1s rate limit)               │
             ▼                               ▼
    [ Fetcher Worker 1 ]            [ Fetcher Worker 2 ]
             ├── 1. Download HTML ──> [ S3 Storage (WARC files) ]
             ├── 2. Extract Links ──> [ Bloom Filter (Dedupe) ] ──> (Add to Frontier)
             └── 3. Check Content ──> [ SimHash Index ]
*/`,
    recallHint: "Crawler: URL Frontier + Politeness per host + Bloom filter dedupe + SimHash content check.",
    interviewTip: "Emphasize Politeness and robots.txt parsing: in production, web crawlers that hammer target domains will be banned by IP firewalls or face legal cease-and-desist notices.",
    tags: ["system-design", "web-crawler", "url-frontier", "politeness", "bloom-filter", "simhash"]
  }),

  createCard({
    idNum: 102,
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    concept: "Designing YouTube / Netflix Video Streaming",
    priority: "must-know",
    difficulty: "must-know",
    question: "Design a high-scale video streaming architecture like YouTube or Netflix supporting video ingestion, multi-bitrate transcoding (DASH/HLS), and global low-latency playback.",
    answer: "Video streaming architecture splits into two pipelines: an Ingestion & Transcoding pipeline that chunks source videos into multi-bitrate segments (HLS/DASH) across resolutions (360p to 4K), and a Content Delivery pipeline that serves chunked media files (.ts / .m4s) directly from global edge CDNs, using adaptive bitrate streaming on client players.",
    explanation: `System Scale:
- YouTube uploads: 500 hours of video every minute!
- Netflix streams: Millions of concurrent video streams consuming petabits of bandwidth.

1. Video Transcoding & Chunking Pipeline:
   - Raw video uploaded to S3 temp bucket.
   - Video Splitter cuts video into small contiguous chunks (typically 2 to 6 seconds each).
   - Distributed Transcoder Fleet (GPU instances) encodes each chunk into multiple formats (H.264, VP9, AV1) and resolutions (1080p, 720p, 480p, 360p).
   - Generates Master Manifest playlist file (\`master.m3u8\` for HLS or \`.mpd\` for MPEG-DASH).
2. Adaptive Bitrate Streaming (ABR):
   - Client video player downloads the manifest file.
   - Client continuously monitors local bandwidth and CPU.
   - If user is on fast fiber Wi-Fi: player requests 4K/1080p chunks.
   - If user enters an elevator and cellular signal drops: player seamlessly requests subsequent 2-second chunks in 480p without buffering or playback interruption!
3. Storage & CDN Tiering:
   - Popular videos (Top 10% generating 90% of views) are pre-warmed onto Edge CDN storage.
   - Long-tail cold videos (watched once a month) are fetched on-demand from S3 Standard-Infrequent Access.`,
    code: `/*
Video Transcoding & Streaming Pipeline:

[ Creator Upload (1GB mp4) ] ──> [ S3 Ingestion Bucket ]
                                          │
                                  [ Video Splitter ]
                                  (Chunks into 4-sec segments)
                                          │
                                  [ Transcoding Pool ]
           ┌──────────────────────────────┼──────────────────────────────┐
           ▼                              ▼                              ▼
     [ 1080p Chunks ]               [ 720p Chunks ]                [ 360p Chunks ]
           └──────────────────────────────┬──────────────────────────────┘
                                          ▼
                             [ Master Manifest (.m3u8) ]
                                          │
                                   [ Edge CDN Fleet ]
                                          │ (Adaptive Bitrate Fetch)
                                          ▼
                                   [ Mobile / Web Player ]
*/`,
    recallHint: "Upload to S3. Split into 4s chunks. Transcode to multi-bitrates (HLS/DASH). CDN streams chunks adaptively.",
    interviewTip: "Highlight Adaptive Bitrate (ABR): video is not served as one monolithic 1GB file; it is streamed as an ongoing series of tiny 2–6 second chunk files coordinated via an `.m3u8` manifest.",
    tags: ["system-design", "video-streaming", "youtube", "netflix", "transcoding", "hls", "dash"]
  }),

  createCard({
    idNum: 103,
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    concept: "Designing Facebook / Twitter Newsfeed",
    priority: "must-know",
    difficulty: "must-know",
    question: "Design a Newsfeed system (Facebook/Twitter) supporting 500 million Daily Active Users. Compare Fan-Out-on-Write (Push) vs Fan-Out-on-Read (Pull) and explain the Hybrid solution.",
    answer: "A newsfeed can be implemented via Fan-out-on-Write (pushes new posts into all followers' Redis timeline caches on publish; fast $O(1)$ reads, but disastrous for celebrity accounts with 100M followers) or Fan-out-on-Read (aggregates posts from all followees dynamically on request; cheap writes, but expensive multi-table read joins). The production solution is a Hybrid approach: push for normal users, pull for celebrities.",
    explanation: `Feed Generation Models:
1. Fan-Out-on-Write (Push Model):
   - When User A posts a tweet: a background worker queries User A's followers and appends the post ID into each follower's pre-computed timeline in Redis (\`LPUSH feed:user_follower post_id\`).
   - Read Path: Ultra-fast. \`LRANGE feed:my_id 0 20\` in Redis returns the home feed in 2ms.
   - The Celebrity Problem (The Justin Bieber Hazard):
     - An account with 100,000,000 followers tweets.
     - The background worker must execute 100,000,000 Redis writes simultaneously!
     - SQS queues back up for hours; high write amplification and server saturation.
2. Fan-Out-on-Read (Pull Model):
   - New tweets are written strictly to the author's personal post table.
   - Read Path: When a follower opens their app, query the database: 'Get recent posts from the 500 people I follow, order by timestamp desc, limit 20'.
   - Downside: Massive read latency ($p99 > 500\\text{ms}$) under heavy SQL joins across distributed databases.
3. The Hybrid Production Architecture (Twitter/Instagram):
   - Regular users ($< 25,000$ followers): Use Fan-Out-on-Write (Push to follower Redis caches).
   - Celebrities / VIPs ($> 25,000$ followers): Do NOT fan out on write! Store tweet only in the celebrity's timeline.
   - Read Path: When a user loads their feed, fetch their pre-computed Redis timeline, fetch recent tweets from the 5 celebrities they follow, merge the lists in memory, and sort by timestamp.`,
    code: `// Hybrid Feed Aggregation Handler in Node.js
export async function getHomeFeed(userId: string) {
  // 1. Fetch pre-computed timeline from Redis (Fan-Out-on-Write items)
  const regularFeedIds = await redis.zrevrange(\`feed:\${userId}\`, 0, 50);

  // 2. Fetch list of celebrity accounts followed by this user
  const followedCelebrities = await socialGraph.getFollowedCelebrities(userId);

  // 3. Fetch recent posts from celebrities (Fan-Out-on-Read)
  const celebrityPostPromises = followedCelebrities.map((celebId) =>
    redis.zrevrange(\`user_posts:\${celebId}\`, 0, 10)
  );
  const celebrityPostIds = (await Promise.all(celebrityPostPromises)).flat();

  // 4. Merge, deduplicate, and sort combined feed in memory
  const allPostIds = [...new Set([...regularFeedIds, ...celebrityPostIds])];
  const postMetadata = await postCache.mget(allPostIds);
  return postMetadata.sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
}`,
    recallHint: "Push = fast read, slow write for stars. Pull = fast write, slow read. Hybrid = push regular, pull celebrities.",
    interviewTip: "Always bring up the 'Celebrity / Hotspot Problem' in feed design. Showing how the Hybrid model merges regular push feeds with celebrity pull feeds demonstrates top-tier architectural mastery.",
    tags: ["system-design", "newsfeed", "twitter", "fanout", "redis", "caching", "hybrid-fanout"]
  }),

  createCard({
    idNum: 104,
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    concept: "Designing a Distributed Key-Value Store (DynamoDB / Cassandra)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Design a distributed, highly available, linearly scalable Key-Value Store like Amazon Dynamo or Apache Cassandra from the ground up.",
    answer: "A distributed key-value store combines: (1) Consistent Hashing with Virtual Nodes for partition distribution; (2) LSM-Tree storage engines (WAL + MemTable + SSTables) for high write IOPS; (3) Gossip protocol for decentralized failure detection; (4) Quorum read/write equations ($R+W>N$) for tunable consistency; and (5) Merkle tree anti-entropy for synchronization.",
    explanation: `Complete Component Synthesis:
1. Data Partitioning:
   - Keyspace mapped onto a $2^{32}-1$ integer ring using Consistent Hashing.
   - Physical nodes mapped to 150+ Virtual Nodes (VNodes) each to guarantee uniform data balance.
2. Node Coordination (Leaderless):
   - Client routes request to any node on the ring (acting as Coordinator).
   - Coordinator computes key hash and sends write to $N$ successor nodes on the ring.
3. Storage Engine per Node (LSM-Tree):
   - Incoming write appended to sequential disk WAL (Write-Ahead Log) for durability.
   - Inserted into sorted in-memory SkipList (\`MemTable\`).
   - Flushed to immutable sorted files (\`SSTables\`) with Bloom filters when MemTable reaches 64MB.
4. Fault Tolerance & Consistency:
   - Quorum tuning: Set $W=2, R=2$ with $N=3$ for linearizable reads.
   - Sloppy Quorum + Hinted Handoff to maintain write availability during partitions.
   - Read Repair and Merkle Tree Anti-Entropy for eventual consistency reconciliation.`,
    code: `/*
Distributed Key-Value Store Synthesis Diagram:

[ Client ] ──(Write Key "user:42")──> [ Coordinator Node 3 ]
                                              │ (Consistent Hash Ring)
                  ┌───────────────────────────┼───────────────────────────┐
                  ▼                           ▼                           ▼
          [ Replica Node 4 ]          [ Replica Node 5 ]          [ Replica Node 6 ]
          ├── 1. Append WAL           ├── 1. Append WAL           ├── 1. Append WAL
          └── 2. Insert MemTable      └── 2. Insert MemTable      └── 2. Insert MemTable
                  │ (Ack W=1)                 │ (Ack W=2)
                  └───────────────────────────┘
                                    │
                                 Success!
*/`,
    recallHint: "Distributed KV: Consistent hash ring + LSM-tree local engine + Gossip failure + Quorum reads/writes.",
    interviewTip: "This is the classic distributed systems capstone question. Structure your answer across 5 clear pillars: Partitioning, Replication, Storage Engine, Consistency, and Failure Recovery.",
    tags: ["system-design", "key-value-store", "dynamodb", "cassandra", "distributed-systems", "lsm-tree"]
  }),

  createCard({
    idNum: 105,
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    concept: "Designing a Real-Time Chat System (WhatsApp / Discord)",
    priority: "must-know",
    difficulty: "must-know",
    question: "Design a real-time messaging system like WhatsApp or Discord handling 50 million concurrent active WebSocket connections, instant 1-on-1 and group chat, and offline message delivery.",
    answer: "A real-time chat architecture maintains persistent bidirectional WebSocket connections on stateful Gateway connection brokers; an in-memory presence and session registry (Redis Cluster) maps active user IDs to their connected Gateway node; inter-gateway message routing uses Kafka/Redis Pub-Sub; offline messages are persisted to Cassandra/HBase and delivered upon client reconnection.",
    explanation: `System Scale & Sizing:
- 50,000,000 concurrent connected sockets.
- Each WebSocket connection consumes ~10KB kernel memory $\\approx 500\\text{ GB RAM}$ across a fleet of 50 Gateway servers (each handling 1,000,000 connections using epoll/kqueue).

Message Delivery Flow (1-on-1):
1. User A sends message to User B over their active WebSocket to \`Gateway-Node-12\`.
2. Gateway queries Session Registry in Redis: \`HGET user_sessions user_B\` -> returns \`Gateway-Node-48\`.
3. If User B is Online:
   - Message dispatched to Gateway-Node-48 (via internal gRPC or Redis Pub/Sub).
   - Gateway-Node-48 pushes message over User B's active WebSocket connection ($< 20\\text{ms}$ latency).
4. If User B is Offline:
   - Message saved to \`offline_messages\` table in Cassandra with status \`PENDING\`.
   - Notification Service fires mobile Push Notification (Apple APNs / Google FCM).
   - When User B reconnects, client pulls pending offline messages and acknowledges receipt.

End-to-End Encryption (E2EE - Signal Protocol):
- Server never sees plaintext message content.
- Key exchange via X3DH (Extended Triple Diffie-Hellman) and Double Ratchet Algorithm. The server stores only encrypted ciphertext blobs.`,
    code: `/*
Real-Time Chat Routing Architecture:

[ User A ] ──(WebSocket)──> [ Gateway Node 12 ]
                                    │
                         (1. Check Redis Presence)
                                    ▼
                         [ Redis Session Registry ]
                         (User B is on Gateway Node 48)
                                    │
                         (2. Route via Pub/Sub)
                                    ▼
[ User B ] <──(WebSocket)── [ Gateway Node 48 ]
*/`,
    recallHint: "Chat: WebSockets on edge gateways. Redis maps User -> Gateway Node. Cassandra stores offline messages. APNs for push.",
    interviewTip: "Clarify the distinction between online message routing (ephemeral, sub-20ms via WebSockets and Redis) and offline persistence (durable append-only Cassandra storage).",
    tags: ["system-design", "chat-system", "whatsapp", "discord", "websockets", "redis"]
  }),

  createCard({
    idNum: 106,
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    concept: "Designing an E-Commerce Flash Sale System",
    priority: "must-know",
    difficulty: "advanced",
    question: "Design an E-Commerce Flash Sale System (10,000 items selling out in 3 seconds under 500,000 concurrent users) preventing overselling and database connection collapse.",
    answer: "A flash sale architecture prevents database collapse by shedding and queueing traffic at the edge: (1) Static assets cached at CDN; (2) Virtual Waiting Room (Token Bucket queue) throttling ingress; (3) Inventory pre-warmed into Redis where stock is decremented atomically via Lua scripts; (4) Successful reservations published to Kafka for asynchronous payment and order creation, guaranteeing zero database overselling.",
    explanation: `The Flash Sale Failure Modes:
- 500,000 users click 'Buy Now' at 12:00:00.
- If all 500,000 hit PostgreSQL: \`UPDATE items SET stock = stock - 1 WHERE id = 1 AND stock > 0;\`
- 500,000 transactions fight for an exclusive row lock on row 1.
- Lock contention saturates CPU; database freezes; connection pools exhaust; site crashes.

The 4-Layer Flash Sale Fortress:
1. Layer 1: CDN & Pre-Warming:
   - Product details, images, and prices are 100% static on CDN edge. Zero requests hit origin for product data.
2. Layer 2: Virtual Waiting Room (Cloudflare Waiting Room / Redis Token Queue):
   - Only allows 10,000 users per second past the perimeter. Excess users see a friendly waiting room screen with queue position.
3. Layer 3: In-Memory Atomic Reservation in Redis:
   - Stock ($10,000$) is pre-loaded into Redis before the sale: \`SET item:101:stock 10000\`.
   - Decrement using atomic Lua script. Redis processes 100,000 ops/sec single-threaded with zero lock contention!
   - If stock $> 0$, decrement and return \`SUCCESS\` + temporary 15-minute reservation token.
   - If stock $\\le 0$, immediately return \`SOLD_OUT\` (drops 98% of users with zero DB load).
4. Layer 4: Asynchronous Order Creation via Kafka:
   - Successful reservations are pushed to a Kafka queue.
   - Order workers consume messages steadily at 500 req/sec, writing orders safely to PostgreSQL without database strain.`,
    code: `// Atomic Redis Flash Sale Reservation Script (Lua)
const flashSaleLua = \`
  local stock_key = KEYS[1]
  local user_id = ARGV[1]
  local order_token = ARGV[2]

  -- Check if user already purchased (Prevent duplicate hoarding)
  if redis.call('sismember', 'buyers:' .. stock_key, user_id) == 1 then
    return -1 -- Already purchased
  end

  local current_stock = tonumber(redis.call('get', stock_key) or "0")
  if current_stock > 0 then
    redis.call('decr', stock_key)
    redis.call('sadd', 'buyers:' .. stock_key, user_id)
    redis.call('setex', 'reserve:' .. order_token, 900, user_id) -- 15 min lock
    return 1 -- Success!
  else
    return 0 -- Sold out!
  end
\`;`,
    recallHint: "Flash sale: Never hit DB directly. Pre-warm stock in Redis, decrement atomically via Lua, process orders via Kafka.",
    interviewTip: "Emphasize inventory reservation with TTL: if a user reserves an item but fails to complete payment within 15 minutes, a background worker releases the reservation and increments the Redis stock counter back.",
    tags: ["system-design", "flash-sale", "ecommerce", "redis-lua", "kafka", "concurrency"]
  }),

  createCard({
    idNum: 107,
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    concept: "Designing a Distributed Notification System",
    priority: "must-know",
    difficulty: "must-know",
    question: "Design a notification platform dispatching 100 million push, SMS, and email messages daily with user opt-out preferences, rate limiting, and priority tiers.",
    answer: "A notification system uses an API Gateway to validate and ingest notification requests into Kafka priority topics (Urgent vs Marketing); Worker fleets consume events, query user notification preferences and rate-limit quotas from Redis, and dispatch payloads to third-party providers (APNs/FCM for push, Twilio for SMS, SendGrid/SES for email) with automated retry and DLQ routing.",
    explanation: `System Architecture Components:
1. Ingestion & Priority Queues:
   - Kafka Topic \`notifications-urgent\`: Password resets, 2FA OTP codes, security alerts. Sized with high worker concurrency.
   - Kafka Topic \`notifications-bulk\`: Marketing promotions, friend requests, newsletter blasts.
2. User Preference & Consent Filter:
   - Users configure channel preferences: 'Email: Yes, SMS: No, Push: Yes'.
   - Worker checks pre-cached user preferences in Redis. If the channel is disabled by the user, message is dropped immediately.
3. Anti-Spam & User Rate Limiting:
   - Prevent annoying users with notification floods.
   - Sliding window limiter in Redis enforces maximum limits (e.g., maximum 3 push notifications per hour per user).
4. Provider Abstraction & Failover:
   - Integrates with multiple vendors per channel:
     - SMS: Twilio (Primary) + MessageBird (Failover).
     - Push: Apple APNs (iOS) + Google FCM (Android).
     - Email: AWS SES + SendGrid.
   - Circuit breakers monitor vendor error rates; if Twilio fails, traffic automatically fails over to MessageBird.`,
    code: `/*
Notification System Topology:

[ Client / Microservices ] ──> [ API Gateway ]
                                      │
                         ┌────────────┴────────────┐
                         ▼                         ▼
             [ Kafka: Urgent OTP ]      [ Kafka: Bulk Promo ]
                         │                         │
                         ▼                         ▼
             [ Dedicated Workers ]      [ Throttled Workers ]
                         │
        (Check Redis: Preferences & Rate Limit)
                         │
     ┌───────────────────┼───────────────────┐
     ▼                   ▼                   ▼
 [ APNs / FCM ]      [ Twilio SMS ]      [ AWS SES Email ]
*/`,
    recallHint: "Separate urgent OTP from bulk marketing. Filter via user preferences in Redis. Multi-vendor failover.",
    interviewTip: "Always mention Deduplication: if an upstream service retries sending an OTP email due to a network glitch, the notification system must deduplicate by `idempotency_key` so the user doesn't receive 5 duplicate texts.",
    tags: ["system-design", "notification-system", "push-notifications", "kafka", "twillio", "fcm"]
  }),

  createCard({
    idNum: 108,
    category: "Real-World Large-Scale System Archetypes (Part 1)",
    concept: "Designing a Ride-Hailing Service (Uber / Lyft)",
    priority: "must-know",
    difficulty: "must-know",
    question: "Design a ride-hailing architecture (Uber/Lyft) tracking 1,000,000 active drivers sending GPS pings every 4 seconds, matching riders with nearest drivers within 5 seconds.",
    answer: "A ride-hailing architecture uses spatial indexing (Google S2 Geometry or Uber H3 hexagonal hierarchical spatial index) to partition earth into spatial cells; driver location pings update an in-memory geospatial cache (Redis GeoSets/Memory Grid); trip matching queries nearby drivers within expanding radius rings, locking driver assignments atomically via distributed transactions.",
    explanation: `Scale Calculations:
- 1,000,000 active drivers sending GPS (lat, lon) pings every 4 seconds $\\approx 250,000\\text{ writes/sec}$.
- Writing 250k location updates/sec to a relational disk database (PostgreSQL with PostGIS) will crash the database with random disk write I/O.
- Solution: Location tracking must reside 100% in memory!

Spatial Indexing: Uber H3 vs Geohash:
- Standard Geohash divides the world into rectangular bounding boxes.
  - Flaw: Edge/boundary distortion. Two drivers 50 meters apart on opposite sides of a bounding box boundary appear in completely different Geohashes.
- Uber H3 (Hexagonal Hierarchical Spatial Index):
  - Divides the world into regular hexagons.
  - Advantage: All neighboring hexagons have identical center-to-center distances in all 6 directions (unlike squares where diagonals are $\\sqrt{2}$ times further away).

The Rider-Driver Matchmaking Engine:
1. Rider requests ride at coordinate $(lat, lon)$.
2. Service converts coordinate to H3 Cell ID at Resolution 8 (~400 meter radius).
3. Queries memory grid for active available drivers in Cell ID and its 6 immediate neighboring cells (k-ring 1).
4. Filters top drivers by ETA (using routing distance matrix, not straight-line Euclidean distance).
5. Dispatches ride offer to closest driver with a 15-second acceptance timer.`,
    code: `/*
Uber Real-Time Location & Matchmaking Pipeline:

[ 1M Active Drivers (GPS ping / 4s) ] ──> [ L4 LB / WebSockets ]
                                                   │
                                          [ Location Ingestion Service ]
                                                   │ (Updates 250k/s in RAM)
                                                   ▼
                                          [ Redis H3 / Geo Cluster ]
                                                   ▲
[ Rider Requests Ride ]                            │ (Query nearby drivers in 2ms)
         │                                         │
[ Matchmaking Engine ] ────────────────────────────┘
         │
(Dispatches offer to Driver with 15s lock)
*/`,
    recallHint: "Driver pings: 250k/s into in-memory Redis/H3 hexagons. Match engine expands k-ring hexagons to find nearest driver.",
    interviewTip: "Highlight why hexagonal indexing (Uber H3) is superior to square Geohashes: all 6 neighbor centroids are equidistant, eliminating diagonal distance distortion in proximity algorithms.",
    tags: ["system-design", "uber", "ride-hailing", "geohash", "uber-h3", "spatial-indexing", "redis"]
  })
];

module.exports = cards;
