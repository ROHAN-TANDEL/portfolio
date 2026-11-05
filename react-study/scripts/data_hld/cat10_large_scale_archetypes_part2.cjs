const { createCard } = require("../hld_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 109,
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    concept: "Designing Google Maps & Proximity Service",
    priority: "must-know",
    difficulty: "advanced",
    question: "Design a mapping and routing service like Google Maps, detailing tile rendering, road graph representation, and low-latency shortest-path calculations (A* / Contraction Hierarchies).",
    answer: "Google Maps splits into two architectures: (1) Map Tile Rendering: pre-renders vector map tiles at multiple zoom levels cached on global CDNs; and (2) Route Navigation: models global road networks as a directed weighted graph partitioned into spatial regions, using Contraction Hierarchies (pre-computed shortcut edges) and bidirectional A* search to calculate routes across continents in milliseconds.",
    explanation: `Core Subsystems:
1. Map Tile Rendering (Geographic Visualization):
   - World is projected onto Web Mercator (EPSG:3857).
   - Pyramidal Zoom Levels (Zoom 0 = whole earth in one 256x256 tile; Zoom 18 = individual street buildings).
   - Vector Tiles (Mapbox Vector Tile format) are pre-rendered, gzipped, and cached indefinitely at CDN edge nodes.
2. Road Graph Representation & Route Calculation:
   - Road network is a directed graph $G = (V, E)$, where vertices $V$ are intersections and edges $E$ are road segments.
   - Running vanilla Dijkstra's algorithm across 500 million global intersections would take minutes and consume gigabytes of RAM.
3. Contraction Hierarchies (CH) for Sub-10ms Routing:
   - Offline Pre-processing: Iteratively remove (contract) minor residential vertices and add 'shortcut edges' between major highways with pre-computed travel times.
   - Online Query: Runs a Bidirectional Dijkstra search on the simplified hierarchy. Searches only 'upward' toward major freeways from the source and destination, meeting in the middle in under 5 milliseconds!
4. Real-Time Traffic Ingestion:
   - Aggregates anonymous GPS speed telemetry from active mobile devices.
   - Adjusts edge weights dynamically in the graph; routes are recalculated if traffic jams form ahead.`,
    code: `/*
Hierarchical Contraction Routing:
[ Local Street ] ──> [ Arterial Road ] ──> [ Highway Shortcut (Pre-computed) ]
                                                     │
                                                     ▼
[ Local Destination ] <── [ Arterial Road ] <── [ Highway Exit ]
*/`,
    recallHint: "Map tiles: Web Mercator vector tiles on CDN. Routing: Road graph with Contraction Hierarchies + A* in 5ms.",
    interviewTip: "Never say 'We run Dijkstra on the global road graph.' Explain that Dijkstra on a 100M-node graph is too slow; Contraction Hierarchies (CH) pre-compute highway shortcuts to make queries instant.",
    tags: ["system-design", "google-maps", "graph-algorithms", "contraction-hierarchies", "spatial-tiles", "a-star"]
  }),

  createCard({
    idNum: 110,
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    concept: "Designing Google Drive / Dropbox",
    priority: "must-know",
    difficulty: "must-know",
    question: "Design a cloud file synchronization service like Dropbox or Google Drive supporting cross-device delta sync, block-level deduplication, and concurrent edit conflict resolution.",
    answer: "A scalable file sync service divides files into 4MB chunks and hashes each chunk using SHA-256 (Content-Addressable Storage). Block-level deduplication ensures identical chunks uploaded by different users are stored only once in S3. Delta sync transmits only modified chunks during file updates, and client metadata synchronization is coordinated via WebSockets and distributed relational databases.",
    explanation: `Key Architectural Principles:
1. Block-Level Chunking & Content-Addressable Storage:
   - When a user saves a 100MB file: Client desktop agent splits file into 4MB chunks (25 chunks).
   - Computes SHA-256 hash for each chunk. The hash IS the chunk's unique storage key.
   - Client queries Metadata Server: 'Do you already have chunk \`a8f9...\`?'
   - If chunk exists in S3 (e.g., someone else already uploaded this operating system ISO or movie), the client **skips uploading that chunk entirely**! Saves 80% of bandwidth and cloud storage costs.
2. Delta Synchronization:
   - User edits 2 words in a 50MB PowerPoint file.
   - Client detects that only Chunk #3 was modified.
   - Client uploads ONLY the single 4MB Chunk #3.
   - Metadata server updates the file's chunk manifest: \`[Chunk 1, Chunk 2, Chunk 3_v2, Chunk 4...]\`.
3. Metadata DB & Concurrency Conflict Resolution:
   - Stores file metadata: \`{ fileId, userId, parentFolderId, version, chunkList }\`.
   - If Device A and Device B edit the file offline simultaneously:
   - The first write to commit increments the version.
   - The second write detects a version mismatch and creates a 'Conflicted Copy' (\`Project_Report (Device B's Conflicted Copy 2026-05-01).docx\`).`,
    code: `/*
Dropbox Chunking & Delta Sync Flow:

[ Client Desktop File: 12MB ]
  ├── Chunk 1 (4MB, SHA: 8a7f...) ──> Already in S3? Yes ──> (Skip upload!)
  ├── Chunk 2 (4MB, SHA: 9b2c...) ──> Already in S3? Yes ──> (Skip upload!)
  └── Chunk 3 (4MB, SHA: 1c3d...) ──> Already in S3? No  ──> [ Upload to S3 ]

[ Metadata DB ] ──> Updates file manifest: [8a7f, 9b2c, 1c3d]
[ Notification Service ] ──(WebSocket Push)──> Notifies user's Laptop & Phone to download Chunk 3
*/`,
    recallHint: "Dropbox: 4MB chunks + SHA-256 content addressable dedupe. Delta sync uploads only changed chunks. Conflicted copies for race conditions.",
    interviewTip: "Highlight that file chunking and hashing MUST happen on the client machine before transmission to avoid wasting user upload bandwidth.",
    tags: ["system-design", "dropbox", "google-drive", "file-sync", "content-addressable-storage", "deduplication"]
  }),

  createCard({
    idNum: 111,
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    concept: "Designing a Collaborative Document Editor (Google Docs: OT vs CRDT)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Google Docs and Figma handle concurrent real-time document editing? Compare Operational Transformation (OT) with Conflict-Free Replicated Data Types (CRDT).",
    answer: "Collaborative editors allow multiple concurrent users to edit text simultaneously. Operational Transformation (OT) transforms character insertion/deletion indices via a central server acting as the single source of truth; CRDTs (Conflict-Free Replicated Data Types) assign unique immutable fractional identifiers to every character, converging deterministically in peer-to-peer or server-mediated networks without central transformation.",
    explanation: `The Concurrent Character Index Problem:
Document initial text: \`"CAT"\`.
- User A (at index 0) types \`"B"\` to make it \`"BCAT"\` (Operation: \`Insert('B', 0)\`).
- User B (at index 3) deletes \`"T"\` to make it \`"CA"\` (Operation: \`Delete(2)\`).
- If User B's delete operation is applied to User A's document without transformation:
  - User A's text is \`"BCAT"\`. Deleting index 2 removes \`'A'\`, producing \`"BCT"\` (corrupted state!).

1. Operational Transformation (OT - Google Docs):
   - Central server receives operations sequentially.
   - When User B's operation arrives after User A's, the server runs a transformation function:
     \`Transform(Op_B, Op_A) -> Shift Delete index from 2 to 3\`.
   - Delivers \`Delete(3)\` to User A. Result: \`"BCA"\` on both screens!
   - Pros: Compact memory (characters are standard strings). Cons: Extremely complex transformation matrix; requires a central coordinating server.
2. CRDT (Conflict-Free Replicated Data Types - Figma, Yjs, Automerge):
   - Every character is given an immutable globally unique fractional ID: e.g., between ID 1 and ID 2, insert ID 1.5.
   - Operations are mathematically commutative: applying them in any order produces the exact same text!
   - Pros: Works offline, peer-to-peer, zero central transformation logic. Cons: Higher memory overhead (each character carries UUID and Lamport metadata).`,
    code: `/*
OT vs CRDT Character Representation:

Operational Transformation (OT):
Raw String: "HELLO" (Operates on mutable array indices 0..4)

CRDT (Fractional Indexing):
[ { id: 1.0, char: 'H' }, { id: 2.0, char: 'E' }, { id: 3.0, char: 'L' } ]
If User A inserts 'X' between H and E:
[ { id: 1.0, char: 'H' }, { id: 1.5, char: 'X' }, { id: 2.0, char: 'E' } ]
Indices never change! No index shifting transformations needed!
*/`,
    recallHint: "OT: Transforms character indices via central server. CRDT: Unique fractional IDs, merges deterministically anywhere.",
    interviewTip: "Google Docs uses Operational Transformation (OT) because it was built in 2006. Modern collaborative tools (Figma, Apple Notes, Notion) use CRDTs (like Yjs or Logoot).",
    tags: ["system-design", "google-docs", "ot", "crdt", "operational-transformation", "real-time"]
  }),

  createCard({
    idNum: 112,
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    concept: "Designing a Distributed Time-Series Metrics System (Gorilla / Prometheus)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Design a distributed Time-Series Database (TSDB) ingesting 100 million metric data points per second. How does Facebook Gorilla's XOR floating-point compression achieve 10x space reduction?",
    answer: "A high-throughput TSDB ingests metric tuples (timestamp, metric_name, labels, float_value) into memory shards. Facebook Gorilla achieves 12x compression by compressing timestamps using Delta-of-Delta encoding (reducing 64-bit timestamps to ~1 bit) and floating-point values using XOR against the previous value, storing historical data in tiered downsampled blocks.",
    explanation: `Scale Calculations:
- Ingestion: 100,000,000 data points per second.
- Uncompressed: 16 bytes per point (8 bytes timestamp + 8 bytes float) $\\approx 1.6\\text{ GB/sec} = 138\\text{ TB/day}$.
- In-memory compression is non-negotiable!

Facebook Gorilla Compression Algorithms:
1. Timestamp Compression (Delta-of-Delta):
   - Metrics arrive at regular intervals (e.g., every 60 seconds).
   - Interval $D_1 = t_1 - t_0 = 60\\text{s}$.
   - Next interval $D_2 = t_2 - t_1 = 60\\text{s}$.
   - Delta-of-Delta: $D_2 - D_1 = 0$.
   - If Delta-of-Delta is 0, Gorilla writes a single bit \`0\`!
   - 96% of timestamps are compressed to **exactly 1 bit**.
2. Floating-Point Value Compression (XOR):
   - Most metrics (CPU %, memory, temperature) change very little between consecutive scrapes: e.g., $65.42$ followed by $65.43$.
   - In IEEE 754 floating-point, similar numbers share identical sign, exponent, and leading mantissa bits.
   - Gorilla computes: $V_1 \\oplus V_2$.
   - The result has many leading and trailing zeros. Gorilla writes only the changed meaningful bits.
   - Reduces 64-bit floats to an average of **1.37 bytes** per value!

Storage Tiering & Downsampling:
- Raw metrics: Retained in memory/SSD for 2 hours.
- 5-Minute Rollups: Kept for 30 days.
- 1-Hour Rollups: Moved to columnar Parquet on S3 for 1 year.`,
    code: `/*
Gorilla Time-Series Storage Tiering:

[ 100M Points/sec ] ──> [ TSDB Ingestion Nodes (Gorilla In-Memory Engine) ]
                                 │ (XOR & Delta-of-Delta Compression: 1.3 bytes/pt)
                                 ▼
                        [ Active 2-Hour RAM Buffer ]
                                 │ (Flush every 2 hours)
                                 ▼
                        [ Persistent SSD Chunks ]
                                 │ (Downsampling Worker)
                                 ▼
                        [ S3 Parquet: 1-Year Cold Analytics ]
*/`,
    recallHint: "Gorilla TSDB: Delta-of-Delta compresses time to 1 bit; XOR compresses floats to 1.3 bytes. 12x memory savings.",
    interviewTip: "Gorilla compression is used inside Prometheus, InfluxDB, and M3DB. Citing Delta-of-Delta and XOR compression shows profound systems-level mastery.",
    tags: ["system-design", "tsdb", "gorilla", "prometheus", "compression", "xor-compression", "metrics"]
  }),

  createCard({
    idNum: 113,
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    concept: "Designing a Search Autocomplete / Typeahead System",
    priority: "must-know",
    difficulty: "must-know",
    question: "Design a Google-style real-time Search Autocomplete system serving suggestions for 5 billion queries daily within 20 milliseconds.",
    answer: "A real-time search autocomplete system utilizes a distributed Prefix Tree (Trie) where each node stores pre-computed Top-K suggestions (e.g., top 5 most popular queries) to eliminate runtime tree traversals. Tries are partitioned by prefix (A–Z) across memory clusters, cached at Edge CDNs, and refreshed asynchronously using offline frequency aggregation pipelines.",
    explanation: `Latency & Scale Requirements:
- A user types a letter every 100–200ms. Autocomplete MUST respond in $< 20\\text{ms}$ or suggestions feel sluggish.
- 5 billion searches/day $\\approx 60,000\\text{ queries/sec}$.

Data Structure: Trie with Pre-Computed Top-K:
- A standard Trie requires traversing from the prefix down to all leaf nodes and sorting by frequency, taking $O(N \\log K)$ time (too slow).
- Optimized Trie Node Structure:
  - Each node stores: \`children: Map<char, TrieNode>\` AND \`topK: Array<{ text: string, score: number }>\` (limited to 5 items).
  - Query for prefix \`"sys"\`: Simply traverse to node \`s -> y -> s\`, read the \`topK\` array directly off the node in $O(1)$ time, and return!

Scale & Update Pipeline:
1. Online Query Path (Read-Only):
   - Read requests hit Browser Cache -> Edge CDN Cache -> In-Memory Trie Server.
   - Zero database lookups on the critical path.
2. Offline Aggregation Pipeline (Write Path):
   - User searches are logged to Kafka.
   - Apache Spark / Flink aggregates query frequencies weekly: 'How many times was "system design" searched in the last 7 days?'.
   - Builds a fresh immutable Trie snapshot.
   - Deploys snapshot to Trie query servers via blue-green replacement.`,
    code: `// Trie Node with Pre-Computed Top-K Suggestions
class AutocompleteNode {
  children = new Map<string, AutocompleteNode>();
  // Pre-computed top 5 queries stored directly on the node!
  topK: Array<{ query: string; frequency: number }> = [];

  insert(query: string, frequency: number) {
    let curr: AutocompleteNode = this;
    for (const char of query.toLowerCase()) {
      if (!curr.children.has(char)) {
        curr.children.set(char, new AutocompleteNode());
      }
      curr = curr.children.get(char)!;
      // Update topK list at this prefix node
      curr.updateTopK({ query, frequency });
    }
  }

  private updateTopK(item: { query: string; frequency: number }) {
    this.topK.push(item);
    this.topK.sort((a, b) => b.frequency - a.frequency);
    if (this.topK.length > 5) this.topK.pop(); // Retain only Top 5
  }
}`,
    recallHint: "Autocomplete: Trie with Top-5 pre-computed on every node. Read is O(length of word). Update offline weekly.",
    interviewTip: "Never update the Trie in real-time on every keystroke! Explain that search frequencies reflect long-term trends; building the Trie offline in batch jobs (Spark) and deploying snapshots to memory prevents locking.",
    tags: ["system-design", "autocomplete", "typeahead", "trie", "top-k", "caching"]
  }),

  createCard({
    idNum: 114,
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    concept: "Designing a Distributed Task Scheduler (Cron at Scale)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Design a distributed, highly available Task Scheduler executing 100 million scheduled and recurring jobs per day with precise second-level execution guarantees.",
    answer: "A distributed task scheduler combines: (1) A time-partitioned persistent store (PostgreSQL/Cassandra); (2) Distributed Hashed Time-Wheels or Redis Sorted Sets (ZSET) scored by execution timestamp; (3) Master/Leader coordinator claiming job blocks with fencing tokens; and (4) Worker pools consuming tasks via partitioned message queues with at-least-once execution and idempotent workers.",
    explanation: `The Problem of Naive Polling:
- 100,000,000 scheduled tasks in a SQL table.
- A worker runs: \`SELECT * FROM jobs WHERE execute_at <= NOW() AND status = 'PENDING' LIMIT 1000;\` every second.
- The query becomes a catastrophic database bottleneck under index contention and deadlocks as multiple workers scan the same rows.

The Distributed Hashed Wheel / Redis ZSET Blueprint:
1. Ingestion:
   - When a job is scheduled for timestamp $T$:
   - Stored durably in Database: \`jobs { id, schedule_time, payload, status }\`.
   - Added to Redis Sorted Set: \`ZADD scheduled_tasks <Timestamp_Epoch_Ms> <JobID>\`.
2. Job Polling Dispatcher:
   - A lightweight coordinator polls Redis every 500ms using an atomic Lua script:
     \`ZRANGEBYSCORE scheduled_tasks 0 <Current_Timestamp> LIMIT 0 500\`.
   - Pops due tasks and publishes them to a Kafka/RabbitMQ execution topic.
3. High-Precision Hashed Time Wheel:
   - For sub-second precision, tasks within the current minute are loaded into an in-memory **Timing Wheel** (a circular buffer of 60 slots representing seconds). A pointer advances once per second, triggering tasks in that slot in $O(1)$ time.
4. Worker Execution:
   - Workers consume from the queue, execute the task, and acknowledge.
   - If worker crashes, message visibility timeout returns the task to the queue for retry.`,
    code: `/*
Distributed Scheduler Architecture:

[ Client ] ──> [ Schedule API ] ──┬──> [ PostgreSQL (Durability) ]
                                  └──> [ Redis ZSET: Score = execute_time ]
                                                │
                                    (Dispatcher polls ZSET every 500ms)
                                                ▼
                                        [ Kafka Task Queue ]
                                                │
                                        [ Worker Fleet ]
                                        (Executes task idempotently)
*/`,
    recallHint: "Scheduler: Redis ZSET (score = execution time) pops due tasks. Kafka routes to workers. Timing wheel for sub-second tasks.",
    interviewTip: "Mention the 'Hierarchical Timing Wheel' (George Varghese algorithm used in the Linux kernel and Kafka) to demonstrate deep understanding of $O(1)$ timer scheduling.",
    tags: ["system-design", "task-scheduler", "cron", "redis-zset", "timing-wheel", "distributed-systems"]
  }),

  createCard({
    idNum: 115,
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    concept: "Designing a Distributed Payment System",
    priority: "must-know",
    difficulty: "must-know",
    question: "Design a fault-tolerant Payment Processing Platform like Stripe handling \$100M/day, ensuring double-entry bookkeeping, idempotency, and automated financial reconciliation.",
    answer: "A payment platform enforces three absolute financial invariants: (1) Idempotency Keys at the API Gateway to prevent duplicate charges on network timeouts; (2) Double-Entry Bookkeeping in an append-only relational ledger (total debits must equal total credits); and (3) Daily Reconciliation pipelines that ingest external bank settlement settlement files (BAI2/MT940) to verify internal transactions against reality.",
    explanation: `The Non-Negotiable Rules of Financial Engineering:
1. Double-Entry Bookkeeping (Luca Pacioli, 1494):
   - Money is NEVER created or destroyed; it only moves from one account to another.
   - Every transaction consists of at least two entries: a **Debit** and a **Credit**.
   - Invariant: $\\sum \\text{Debits} = \\sum \\text{Credits}$ across the ledger at all times.
   - Example (Charging customer \$100):
     - Debit: \`Customer_Credit_Card_Receivable: \$100\`
     - Credit: \`Merchant_Account_Payable: \$97\`
     - Credit: \`Platform_Fee_Revenue: \$3\`
     - Net: $\$100 = \$97 + \$3$. Invariant holds!
2. Strict Idempotency:
   - When a user clicks 'Pay', client attaches a unique \`Idempotency-Key\` UUID header.
   - The Payment Service stores the idempotency key and response in a dedicated PostgreSQL table using a unique constraint.
   - If client Wi-Fi drops and the payment retry arrives, the service detects the existing key and returns the original transaction response without re-charging the credit card!
3. Daily Reconciliation Engine:
   - Banks settle transactions via nightly batch files (ACH/SEPA/Visa files).
   - An asynchronous reconciliation batch pipeline (Apache Spark) compares internal ledger entries against bank settlement reports, automatically flagging discrepancies for human audit.`,
    code: `// Double-Entry Ledger Schema in PostgreSQL
/*
CREATE TABLE ledger_entries (
    id UUID PRIMARY KEY,
    transaction_id UUID NOT NULL,
    account_id UUID NOT NULL,
    amount NUMERIC(18, 4) NOT NULL, -- Never use FLOAT for currency!
    direction VARCHAR(6) CHECK (direction IN ('DEBIT', 'CREDIT')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Invariant Trigger: Sum of DEBITs must EQUAL sum of CREDITs for every transaction!
*/`,
    recallHint: "Payments: Double-entry ledger (Debits = Credits). Idempotency keys prevent double charge. Reconcile against bank files.",
    interviewTip: "Never use floating-point types (`FLOAT` or `DOUBLE`) for monetary calculations; rounding errors (`0.1 + 0.2 = 0.30000000000000004`) lead to financial corruption. Always specify fixed-point `NUMERIC(18,4)` or integer cents.",
    tags: ["system-design", "payment-system", "stripe", "double-entry", "idempotency", "reconciliation"]
  }),

  createCard({
    idNum: 116,
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    concept: "Designing an Ad Click Aggregator",
    priority: "must-know",
    difficulty: "advanced",
    question: "Design an advertising click event aggregator processing 500,000 ad clicks per second, computing 1-minute and 1-hour advertiser metrics with sub-second query latency and click-fraud filtering.",
    answer: "An ad click aggregator streams click events into Kafka, processes real-time aggregations using Apache Flink with tumbling/sliding event-time windows, filters duplicate/bot clicks using HyperLogLog and IP velocity rules, and writes aggregated metrics to ClickHouse or Apache Pinot for sub-second analytical dashboard queries.",
    explanation: `System Scale & Traffic:
- 500,000 clicks/sec.
- Advertisers demand real-time reporting to monitor ad spend and stop underperforming campaigns.
- Direct database writes would generate 500k row inserts/sec; the stream MUST be aggregated in memory!

The Stream Aggregation Pipeline:
1. Ingestion:
   - Lightweight Click Gateways log clicks directly to a Kafka topic (\`ad-clicks\`) partitioned by \`ad_id\`.
2. Real-Time Stream Processor (Apache Flink):
   - **Click Fraud Filter**: Tracks user click velocity (same IP clicking the same ad 50 times in 10 seconds is flagged and dropped).
   - **Tumbling Windows (1-Minute)**: Groups clicks by \`ad_id\` and \`campaign_id\` over a 1-minute window.
   - Emits aggregated summary: \`{ ad_id: 99, minute: "2026-05-01 12:00", total_clicks: 1450, total_spend: 725.00 }\`.
3. Serving Store (ClickHouse / Apache Pinot):
   - OLAP columnar database designed for high-speed analytical aggregation.
   - The database receives only 5,000 aggregated rows per minute instead of 30,000,000 individual click events (a 6,000x reduction!).
   - Dashboard queries (\`SELECT SUM(total_clicks) FROM ad_metrics WHERE campaign_id = 42\`) return in $< 10\\text{ms}$.`,
    code: `/*
Ad Click Aggregation Topology:

[ 500,000 Clicks/sec ] ──> [ Click Ingress Gateway ]
                                    │
                            [ Kafka (Partitioned by ad_id) ]
                                    │
                            [ Apache Flink Engine ]
                            ├── 1. Fraud / Bot Filter
                            └── 2. 1-Minute Tumbling Window Aggregation
                                    │ (6000x Data Reduction!)
                                    ▼
                            [ ClickHouse OLAP DB ]
                                    ▲
                            [ Advertiser Real-Time Dashboard ]
*/`,
    recallHint: "Ad aggregator: Stream clicks to Kafka -> Aggregate in 1-min Flink windows -> Store aggregates in ClickHouse.",
    interviewTip: "Highlight the immense data reduction achieved by stream aggregation: pre-aggregating 500,000 clicks/sec into 1-minute window buckets protects downstream databases and makes analytical dashboards lightning-fast.",
    tags: ["system-design", "ad-aggregator", "flink", "kafka", "clickhouse", "stream-processing"]
  }),

  createCard({
    idNum: 117,
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    concept: "Designing a Distributed File System (Google GFS / Hadoop HDFS)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Explain the architecture of the Google File System (GFS / HDFS), detailing Master-Chunkserver division, 64MB chunk sizes, and how the Master avoids becoming a data bottleneck.",
    answer: "GFS/HDFS decouples metadata management from data streaming: a single Master (NameNode) stores filesystem metadata (namespace hierarchy, chunk locations) purely in RAM for fast lookups; Chunkservers (DataNodes) store file data divided into large 64MB chunks replicated 3x across racks. Clients contact the Master only to obtain chunk locations, streaming file bytes directly to and from Chunkservers.",
    explanation: `Architectural Innovations of GFS (Ghemawat et al., 2003):
1. Single Master Architecture (NameNode):
   - Stores all metadata (filenames, directories, permissions, mapping of files to chunk IDs) in **server RAM** for microsecond lookup performance.
   - Persists state to disk via an Operation Log (WAL) and periodic Checkpoints.
2. Why Large 64MB Chunk Sizes?
   - Standard OS filesystem blocks are 4KB. GFS uses massive 64MB chunks!
   - Advantage 1: Greatly reduces metadata size. A 1 Terabyte file requires only 16,000 chunk metadata entries, fitting comfortably in Master RAM.
   - Advantage 2: Reduces TCP connection overhead and allows clients to read gigabytes in continuous sequential disk streams.
3. How the Master Avoids Becoming a Bottleneck:
   - **Data bytes NEVER pass through the Master!**
   - Client sends \`Read("foo.txt", offset=150MB)\` -> Master replies: 'Chunk #3 is on Chunkservers [Node 10, Node 14, Node 22]'.
   - Client connects directly to the nearest Chunkserver to stream the 64MB payload.
   - Master handles only a few lightweight metadata requests per client.`,
    code: `/*
GFS / HDFS Data Flow:

[ Client ] ──(1. Ask: Where is Chunk 2 of 'data.csv'?)──> [ Master / NameNode (RAM) ]
    │                                                              │
    │<──(2. Returns Chunkserver IPs: [Node A, Node B, Node C])─────┘
    │
    └───(3. Stream 64MB Data Directly)───────────────────> [ Chunkserver Node A ]
*/`,
    recallHint: "GFS: Master holds metadata in RAM; Chunkservers hold 64MB chunks. Clients stream data directly from Chunkservers.",
    interviewTip: "Mention the 'Small Files Problem' in HDFS: if users store 100 million 1KB files instead of large files, each file consumes a 150-byte entry in Master RAM, exhausting NameNode memory without storing much actual data.",
    tags: ["system-design", "gfs", "hdfs", "distributed-file-system", "chunkserver", "storage"]
  }),

  createCard({
    idNum: 118,
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    concept: "Designing a Real-Time Multiplayer Gaming Server",
    priority: "must-know",
    difficulty: "advanced",
    question: "Design a fast-paced multiplayer game server (e.g., Counter-Strike, Rocket League) with 64Hz tick rate, UDP transport, Client Prediction, and Lag Compensation.",
    answer: "Real-time game servers use UDP (not TCP) to eliminate retransmission Head-of-Line blocking; the server runs an authoritative simulation loop at a fixed tick rate (e.g., 64Hz / every 15.6ms). Clients use Client-Side Prediction to render movements locally with zero perceived latency, Server Reconciliation to correct divergent trajectories, and Lag Compensation (time-travel raycasting) for fair hit registration.",
    explanation: `Why TCP is Strictly Prohibited for Fast-Paced Action:
- TCP guarantees reliable, in-order packet delivery.
- If packet 42 (player position at $t=42$) drops, TCP halts all subsequent packets ($43, 44$) until packet 42 is retransmitted.
- In gaming, packet 42 is obsolete history! The game only cares about the player's current position at $t=44$.
- Therefore, games use **UDP** with custom lightweight sequence numbers.

Authoritative Physics & Latency Mitigation:
1. Authoritative Server:
   - Server runs the true physics simulation at 64 ticks/sec. Clients send user input keystrokes, NOT coordinates (prevents teleportation speed hacks).
2. Client-Side Prediction:
   - When a player presses 'Forward', the client moves the character forward on screen *immediately* without waiting 50ms for the server round trip.
3. Server Reconciliation:
   - Server receives keystrokes, calculates authoritative position, and sends world snapshots.
   - If server position matches predicted position: continue smoothly.
   - If server detected a collision with an obstacle: client snaps/interpolates back to server position (rubber-banding).
4. Lag Compensation (Rewind Time for Hit Registration):
   - A player with 100ms ping shoots at an enemy. By the time the bullet reaches the server, the enemy has walked away.
   - Server rewinds enemy hitbox positions backwards by 100ms to verify if the shot was accurate from the shooter's perspective!`,
    code: `/*
Client Prediction & Server Reconciliation Timeline:
Client: Press 'W' ──> Move Locally (t=1, x=10) ──> Send Input(W, t=1) ──┐
                                                                         ▼
                                                                [ Server (15ms tick) ]
                                                                Processes Input
                                                                Sends State(x=10, t=1)
Client: Receives State(x=10). Matches prediction! Smooth gameplay!        │
                                                                          ▼
                                                                [ Broadcast to Game ]
*/`,
    recallHint: "Gaming: UDP only (no HoL blocking). 64Hz authoritative server. Client prediction + server reconciliation + lag rewind.",
    interviewTip: "Distinguish between turn-based games (Chess, Poker - which run great on WebSockets/TCP) and action games (FPS, Racing - which mandate authoritative UDP game loops).",
    tags: ["system-design", "game-server", "udp", "client-prediction", "lag-compensation", "real-time"]
  }),

  createCard({
    idNum: 119,
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    concept: "Designing a Stock Exchange Matching Engine (LMAX Disruptor)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Design an ultra-low latency Financial Stock Matching Engine executing 5,000,000 orders/sec with deterministic sub-microsecond latency using the LMAX Disruptor pattern.",
    answer: "A high-frequency matching engine achieves sub-microsecond latency by eliminating thread contention, locks, and garbage collection: an in-memory Limit Order Book matches orders via strict Price-Time Priority (FIFO) using a single-threaded execution core fed by an LMAX Disruptor lock-free Ring Buffer with CPU cache-line padding and deterministic replay.",
    explanation: `Why Traditional Multithreading Fails at Microsecond Scale:
- Traditional web servers use thread pools and database row locks.
- In low-latency trading:
  - OS context switches cost $1\\text{ to } 5\\ \\mu\\text{s}$.
  - Java GC Stop-The-World pauses take $10\\text{ to } 100\\text{ms}$ (an eternity in trading).
  - CPU cache coherency invalidation (False Sharing) degrades throughput.

The LMAX Disruptor Architecture:
1. Lock-Free Ring Buffer:
   - A pre-allocated circular array of fixed size ($2^n$).
   - Producers write sequentially using a single atomic counter (CAS - Compare-And-Swap). Zero lock contention!
2. Single-Threaded Core:
   - A single CPU pinned thread executes the Order Book matching engine.
   - Because only ONE thread touches the Order Book, **zero locks, mutexes, or synchronization primitives are needed**!
   - Runs in L1/L2 CPU cache at 10,000,000 orders per second.
3. Cache-Line Padding (Eliminate False Sharing):
   - CPUs load memory in 64-byte Cache Lines.
   - If two variables share a cache line, cores constantly invalidate each other's cache.
   - Padded with 7 dummy \`long\` variables (56 bytes) to ensure ring buffer pointers sit on dedicated cache lines.
4. Deterministic WAL Replay:
   - Inbound orders are written to an ultra-fast kernel-bypass NVMe Write-Ahead Log. If the engine crashes, replay restores full memory state in seconds.`,
    code: `/*
LMAX Disruptor Architecture:

[ Market Gateway (10M Orders/sec) ]
              │
              ▼
   [ Pre-Allocated Ring Buffer (Zero Allocation, Padded Cache Lines) ]
              │
              ▼
   [ Single Pinned Core: Order Book Matching Engine ]
   ├── Price-Time Priority Queue
   ├── Matches Bids & Asks in 800 nanoseconds!
   └── Zero Locks, Zero Garbage Collection!
              │
              ▼
   [ Market Data Publisher ]
*/`,
    recallHint: "Matching engine: Single pinned CPU core, LMAX lock-free ring buffer, zero locks, zero GC, price-time priority.",
    interviewTip: "Highlight that single-threaded architectures often dramatically outperform multi-threaded architectures when memory and CPU cache locality are strictly preserved.",
    tags: ["system-design", "matching-engine", "fintech", "lmax-disruptor", "low-latency", "concurrency"]
  }),

  createCard({
    idNum: 120,
    category: "Real-World Large-Scale System Archetypes (Part 2) & Advanced Patterns",
    concept: "Designing a Large-Scale AI Inference & Serving Platform (vLLM / Triton)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Design a high-throughput AI Large Language Model (LLM) serving platform (serving 70B+ parameter models), explaining PagedAttention, KV-Cache management, and Continuous Batching.",
    answer: "An LLM serving platform (vLLM, Triton) maximizes GPU utilization by decoupling memory from generation: PagedAttention manages the Key-Value (KV) cache as virtual memory pages, eliminating 60%+ GPU memory fragmentation; Continuous (Iteration-Level) Batching evicts completed requests and injects new requests dynamically on every decoding iteration, achieving 10x higher throughput.",
    explanation: `The Unique Bottleneck of LLM Inference:
Unlike traditional microservices, LLM inference is severely memory-bandwidth bound:
- A 70-billion parameter model in FP16 requires 140GB of GPU VRAM just to hold the model weights across multiple GPUs via Tensor Parallelism (Ray / Megatron-LM).
- The **KV-Cache (Key-Value Cache)** stores attention states for past tokens to avoid recomputing them. For long contexts, the KV-Cache consumes 30GB+ of VRAM per user session!

Architectural Breakthroughs in Modern Serving (vLLM):
1. PagedAttention (Virtual Memory for KV-Cache):
   - Traditional serving allocated contiguous VRAM for maximum context length (e.g., 4096 tokens). If the user only asked a 100-token question, 95% of allocated VRAM was wasted (internal fragmentation).
   - PagedAttention (Kwon et al., UC Berkeley) divides the KV cache into fixed-size virtual blocks (pages) mapped dynamically via page tables. Enables sharing KV caches across parallel sampling (e.g., beam search).
2. Continuous Batching (Iteration-Level Scheduling):
   - Traditional batching waits for ALL prompts in a batch to finish generation before starting the next batch. A prompt generating 500 tokens blocks a prompt that finished in 10 tokens.
   - Continuous Batching operates at the token iteration level: as soon as request A emits \`[EOS]\`, its memory is freed and request B enters the running batch immediately.
3. Model Sharding / Tensor Parallelism:
   - Shards model matrix weights across 4 or 8 GPUs (e.g., 8x NVIDIA H100) using NCCL high-speed NVLink interconnects.`,
    code: `/*
PagedAttention Memory Allocation:

Physical GPU VRAM:
[ Page 0 (Tokens 0-15) ]  [ Page 1 (Tokens 16-31) ]  [ Page 2 (Tokens 32-47) ]
            ▲                         ▲                         ▲
            └─────────────────────────┼─────────────────────────┘
                                      │
Logical Request 1 Page Table: [ Block 0 -> Page 0, Block 1 -> Page 2 ]
Logical Request 2 Page Table: [ Block 0 -> Page 1 ]
(Zero memory fragmentation; dynamic virtual page allocation!)
*/`,
    recallHint: "LLM Serving: PagedAttention treats KV-cache like OS virtual memory. Continuous batching swaps completed tokens instantly.",
    interviewTip: "LLM system design is the newest and most sought-after topic in modern high-level design interviews. Emphasize PagedAttention and Continuous Batching to show up-to-the-minute AI systems knowledge.",
    tags: ["system-design", "ai-inference", "vllm", "paged-attention", "kv-cache", "llm-serving", "continuous-batching"]
  })
];

module.exports = cards;
