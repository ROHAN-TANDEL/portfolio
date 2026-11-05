const { createCard } = require("../hld_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 25,
    category: "Databases, Storage Engines & Partitioning",
    concept: "Relational vs NoSQL vs NewSQL Trade-offs",
    priority: "must-know",
    difficulty: "must-know",
    question: "How do Relational (RDBMS), NoSQL, and NewSQL architectures differ in schema flexibility, ACID transactions, and horizontal scaling capabilities?",
    answer: "Relational databases (PostgreSQL, MySQL) enforce strict schemas and multi-table ACID transactions but scale vertically or via complex manual sharding; NoSQL databases (Cassandra, DynamoDB, MongoDB) sacrifice complex joins and ACID guarantees for horizontal scale, flexible schemas, and high write throughput; NewSQL (Spanner, CockroachDB) provides distributed horizontal scalability while preserving full ACID transactions using consensus protocols and TrueTime/HLC clocks.",
    explanation: `Architectural Taxonomy:
1. Relational Databases (RDBMS):
   - Engine: B+ Trees, buffer pools, WAL.
   - Guarantees: Full ACID (Atomicity, Consistency, Isolation, Durability) via two-phase locking (2PL) and MVCC.
   - Strengths: Rich SQL, secondary indexes, foreign keys, complex multi-table JOINs.
   - Bottleneck: Hard to scale writes horizontally across multiple nodes without losing foreign key integrity and cross-node JOIN performance.
2. NoSQL Systems:
   - Types: Key-Value (DynamoDB, Redis), Document (MongoDB), Wide-Column (Cassandra, ScyllaDB), Graph (Neo4j).
   - Guarantees: BASE (Basically Available, Soft state, Eventual consistency), single-partition transactions.
   - Strengths: Horizontal scaling to petabytes, tunable consistency, flexible schema evolution.
   - Weaknesses: Lack of native cross-partition JOINs; application must perform manual joins or denormalize data.
3. NewSQL Systems:
   - Systems: Google Cloud Spanner, CockroachDB, YugabyteDB.
   - Design: Distributed shared-nothing architecture running Raft/Paxos consensus per shard/range.
   - Strengths: Standard SQL, global ACID transactions, automatic horizontal rebalancing.
   - Trade-off: Higher write latency due to multi-node consensus rounds and distributed commit wait.`,
    code: `/*
Decision Matrix:
- Financial Ledger / Banking -> NewSQL (Spanner / Cockroach) or RDBMS with Replication (PostgreSQL)
- Time-Series Telemetry / High-Speed Ingestion -> NoSQL Wide-Column (Cassandra / ClickHouse)
- User Profiles & Catalogs with changing schemas -> Document NoSQL (MongoDB / DynamoDB)
- In-Memory Fast Lookup / Leaderboards -> In-Memory Key-Value (Redis)
*/`,
    recallHint: "RDBMS = strict ACID & JOINs; NoSQL = horizontal scale & flexible schema; NewSQL = best of both via consensus.",
    interviewTip: "Never default to 'MongoDB because it's scalable' or 'PostgreSQL for everything'. State: 'We evaluate write volume, query complexity (joins vs key lookups), and transaction boundaries before selecting storage.'",
    tags: ["databases", "rdbms", "nosql", "newsql", "storage", "acid"]
  }),

  createCard({
    idNum: 26,
    category: "Databases, Storage Engines & Partitioning",
    concept: "LSM-Tree vs B+ Tree Storage Engines",
    priority: "must-know",
    difficulty: "advanced",
    question: "Contrast the internal mechanics, write amplification, and read latency of Log-Structured Merge-Trees (LSM-Tree) versus B+ Tree storage engines.",
    answer: "B+ Trees organize data into balanced tree blocks on disk with in-place updates, offering fast predictable $O(\\log N)$ reads but high random write I/O; LSM-Trees (RocksDB, Cassandra) buffer writes in an in-memory MemTable and append-only WAL, flushing immutable sorted SSTables to disk and merging them via background compaction. LSM-Trees deliver massive write throughput at the cost of higher read amplification and background compaction I/O.",
    explanation: `B+ Tree Mechanics (e.g., InnoDB, Postgres Heap):
- Fixed-size pages (typically 4KB–16KB) linked sequentially at the leaf level.
- In-Place Updates: When a row is modified, its page is loaded into memory, modified, and written back to the same disk sector.
- Random I/O Bottleneck: Scattered writes generate random disk seeks, degrading mechanical disks and increasing SSD wear.
- Read Path: Fast and deterministic. Leaf node lookup requires exactly $\\log_B N$ page reads.

LSM-Tree Mechanics (e.g., RocksDB, Cassandra, LevelDB):
- Write Path (Sequential Only):
  1. Append write to disk WAL (Write-Ahead Log for crash recovery).
  2. Insert into in-memory sorted \`MemTable\` (typically a SkipList).
  3. Returns success immediately (microsecond write latency).
  4. When MemTable reaches 64MB, it is frozen and flushed to disk as an immutable \`SSTable\` (Sorted String Table).
- Read Path:
  1. Check MemTable.
  2. If not found, check immutable in-memory tables.
  3. Query Bloom Filters of on-disk SSTables to skip non-matching files.
  4. Binary search SSTable indexes across multiple compaction levels.
- Compaction: Background worker threads merge overlapping SSTables, removing deleted/overwritten keys to reclaim space.`,
    code: `/*
LSM-Tree Write & Read Architecture:

Write Path (Append-Only):
[ Write Request ] ──┬──> [ Sequential WAL on Disk ] (Durability)
                    └──> [ In-Memory MemTable (SkipList) ] (Speed)
                                │ (Flush when full ~64MB)
                                ▼
                         [ Level 0 SSTable ]
                         [ Level 1 SSTable ] ──> Background Compaction
                         [ Level 2 SSTable ]

Read Path:
[ Read Request ] ──> [ MemTable ] ──(miss)──> [ Bloom Filters ] ──> [ Search SSTables ]
*/`,
    recallHint: "B+ Tree: in-place random writes, fast reads. LSM-Tree: append-only sequential writes, reads check multiple levels.",
    interviewTip: "Whenever an interviewer specifies a write-intensive system (e.g., logging, metrics, clickstream, chat history), immediately select an LSM-tree based storage engine (like Cassandra or RocksDB).",
    tags: ["lsm-tree", "b-tree", "storage-engines", "rocksdb", "cassandra", "compaction"]
  }),

  createCard({
    idNum: 27,
    category: "Databases, Storage Engines & Partitioning",
    concept: "Database Sharding Strategies (Range, Hash, Directory)",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is database horizontal sharding, and how do Range-Based, Hash-Based, and Directory-Based sharding strategies handle data distribution and hotspots?",
    answer: "Sharding partitions a single dataset across multiple independent database nodes. Range-Based sharding divides data by key intervals (e.g., A–C, D–F), which is efficient for range scans but prone to write hotspots; Hash-Based sharding applies a cryptographic hash to distribute keys uniformly, preventing hotspots but making range queries expensive; Directory-Based sharding uses an external lookup service to map partition keys to physical shards, providing dynamic rebalancing flexibility.",
    explanation: `Sharding Architectures:
1. Range-Based Sharding:
   - Shard 1: User IDs 1–1,000,000; Shard 2: 1,000,001–2,000,000. Or by Date (e.g., Shard per Month).
   - Advantage: Range queries (\`WHERE created_at BETWEEN '2026-01-01' AND '2026-01-31'\`) hit only a single shard.
   - Downside: Write hotspotting! If new records have monotonically increasing IDs or timestamps, 100% of current writes hit the newest shard while older shards sit idle.
2. Hash-Based (Key-Hash) Sharding:
   - Formula: $\\text{Shard} = \\text{hash}(\\text{PartitionKey}) \\pmod N$ (or Consistent Hashing).
   - Advantage: Uniform key distribution prevents hotspots; all shards share equal read/write load.
   - Downside: Range queries cannot target a single shard; the query must be broadcast to *all* shards (Scatter-Gather), introducing high tail latency.
3. Directory-Based (Lookup Table) Sharding:
   - A central metadata service maintains a map: \`{ "tenant_A": "shard_3", "tenant_B": "shard_1" }\`.
   - Advantage: Highly flexible; large enterprise tenants can be dynamically migrated to dedicated shards without rehashing the entire database.
   - Downside: The lookup service itself becomes a potential SPOF and latency hop (must be cached aggressively).`,
    code: `// Hash-Based Shard Router Implementation
import crypto from "crypto";

class ShardRouter {
  constructor(private shardCount: number) {}

  getShardIndex(partitionKey: string): number {
    const hash = crypto.createHash("md5").update(partitionKey).digest("hex");
    // Parse first 8 hex characters as 32-bit integer
    const hashInt = parseInt(hash.substring(0, 8), 16);
    return hashInt % this.shardCount;
  }
}

const router = new ShardRouter(16); // 16 Database Shards
console.log("User 12345 routes to Shard:", router.getShardIndex("usr_12345"));
console.log("User 98765 routes to Shard:", router.getShardIndex("usr_98765"));`,
    recallHint: "Range = good for range scans, suffers hotspots. Hash = uniform distribution, bad for range scans. Directory = flexible lookup.",
    interviewTip: "Always choose a partition key with high cardinality and even distribution (e.g., UUID or userId) rather than low-cardinality keys like Country or Gender which create severe hotspot shards.",
    tags: ["sharding", "partitioning", "hash-sharding", "range-sharding", "databases"]
  }),

  createCard({
    idNum: 28,
    category: "Databases, Storage Engines & Partitioning",
    concept: "Replication Topologies: Master-Replica vs Multi-Master (Active-Active)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Compare Single-Master (Master-Replica) with Multi-Master (Active-Active) replication. How are write conflicts detected and resolved in multi-master setups?",
    answer: "Master-Replica routes all writes to a single primary node and replicates to read replicas asynchronously or synchronously, preventing write conflicts but creating a write bottleneck and failover downtime. Multi-Master allows concurrent writes to multiple nodes across data centers, eliminating single-node write bottlenecks but introducing write conflicts that must be resolved using Last-Write-Wins (LWW) or Conflict-Free Replicated Data Types (CRDTs).",
    explanation: `Master-Replica (Leader-Follower):
- Write Path: Strictly to 1 Primary. Primary writes to WAL and streams changes to Followers.
- Read Path: Reads can be load-balanced across multiple Followers.
- Replication Lag: Asynchronous followers can lag behind by milliseconds or seconds. If a user writes to Primary and immediately reads from Follower, they may read stale data (violating Read-Your-Own-Writes).
- Failover: If Primary crashes, an automated consensus agent (e.g., Orchestrator, Patroni) promotes a replica to Primary.

Multi-Master (Active-Active):
- Each data center has an active master accepting local writes with sub-10ms response times.
- Background asynchronous cross-region links propagate writes between masters.
- The Conflict Hazard: User in London updates cart quantity to 5 at the same millisecond a user in New York updates quantity to 3.
- Conflict Resolution Strategies:
  1. Last-Write-Wins (LWW): Highest wall-clock timestamp wins (flawed due to NTP clock drift).
  2. Conflict-Free Replicated Data Types (CRDTs): State-based or Operation-based mathematical structures that converge deterministically without centralized coordination.
  3. Partitioning by User/Tenant: Route all requests for User X to Region A so concurrent writes never collide across regions.`,
    code: `/*
Multi-Master Conflict Resolution: State-Based PN-Counter CRDT
- Positive-Negative Counter enables increment and decrement without central locks!
*/
interface PNCounter {
  P: Record<string, number>; // Increments per node
  N: Record<string, number>; // Decrements per node
}

function mergeCounters(nodeA: PNCounter, nodeB: PNCounter): PNCounter {
  const mergedP: Record<string, number> = {};
  const mergedN: Record<string, number> = {};

  const allNodes = new Set([...Object.keys(nodeA.P), ...Object.keys(nodeB.P)]);
  for (const node of allNodes) {
    mergedP[node] = Math.max(nodeA.P[node] || 0, nodeB.P[node] || 0);
    mergedN[node] = Math.max(nodeA.N[node] || 0, nodeB.N[node] || 0);
  }

  return { P: mergedP, N: mergedN };
}

function readValue(counter: PNCounter): number {
  const sumP = Object.values(counter.P).reduce((a, b) => a + b, 0);
  const sumN = Object.values(counter.N).reduce((a, b) => a + b, 0);
  return sumP - sumN;
}`,
    recallHint: "Master-replica: Simple, no write conflicts, but primary is bottleneck. Multi-master: Write anywhere, but conflicts need CRDTs/LWW.",
    interviewTip: "In active-active multi-region designs, recommend home-region pinning: partition user accounts so that a given user's writes always route to their primary home region.",
    tags: ["replication", "master-replica", "multi-master", "active-active", "crdt", "lww"]
  }),

  createCard({
    idNum: 29,
    category: "Databases, Storage Engines & Partitioning",
    concept: "Write-Ahead Logging (WAL) & Crash Recovery",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a Write-Ahead Log (WAL), and how does the ARIES recovery algorithm use it to guarantee ACID Durability during power loss or kernel panics?",
    answer: "A Write-Ahead Log (WAL) is an append-only sequential log on non-volatile storage where all transaction state changes and undo/redo records must be safely flushed to disk (fsync) *before* dirty database pages are written to disk. The ARIES recovery algorithm uses the WAL to execute Analysis, Redo (repeating history to restore state), and Undo (rolling back uncommitted transactions) after a crash.",
    explanation: `Why WAL is Essential for Performance & Durability:
- Modifying random pages in a relational B+ Tree on disk requires expensive random I/O.
- Instead, the database leaves modified pages 'dirty' in RAM buffer pools and appends a compact sequential log record to the WAL on disk.
- Sequential disk writes are 100x–1000x faster than random page writes.
- If the server suffers sudden power loss, dirty RAM pages are lost, but the WAL on disk contains the complete ledger of operations.

The ARIES Crash Recovery Protocol:
1. Analysis Phase: Scan WAL forward from the last checkpoint to identify dirty pages in buffer pool at the moment of crash and active uncommitted transactions.
2. Redo Phase: Replay all logged changes forward from the oldest un-flushed change to restore the exact buffer state right before the crash ('repeating history').
3. Undo Phase: Scan backwards through the WAL to undo (rollback) all transactions that were still active/uncommitted when the server crashed, logging compensating log records (CLRs).`,
    code: `/*
WAL Flush Sequencing:
Step 1: Client initiates "UPDATE balances SET amount = 50 WHERE id = 1"
Step 2: Database creates Log Sequence Number (LSN 1042) in WAL buffer:
        [LSN 1042 | Tx 88 | Page 12 | Prev: 100 | New: 50]
Step 3: Database executes fsync() on WAL file to persistent NVMe disk.
Step 4: Database updates in-memory Page 12 in Buffer Pool (marked dirty).
Step 5: Database returns "COMMIT SUCCESS" to client.
Step 6: (Background Writer flushes dirty Page 12 to disk minutes later).
*/`,
    recallHint: "WAL rule: Never write a dirty page to disk until its WAL log record is fsync'd.",
    interviewTip: "Explain that WAL is not only used for crash recovery; it is also the foundational data stream used for change data capture (Debezium) and streaming replication to read replicas.",
    tags: ["wal", "write-ahead-log", "durability", "crash-recovery", "storage", "aries"]
  }),

  createCard({
    idNum: 30,
    category: "Databases, Storage Engines & Partitioning",
    concept: "Distributed Secondary Indexing: Local vs Global Indexes",
    priority: "must-know",
    difficulty: "advanced",
    question: "Explain the architecture, query performance, and write trade-offs of Local Secondary Indexes (Scatter-Gather) versus Global Secondary Indexes in sharded databases.",
    answer: "A Local Secondary Index (LSI) indexes only the data stored within that specific shard, co-located with the partition key; writes are fast and local, but queries on secondary attributes must scatter-gather across all shards. A Global Secondary Index (GSI) indexes data across the entire cluster partitioned by the secondary attribute; lookups require querying only 1 shard, but writes require cross-shard distributed transactions or asynchronous updates.",
    explanation: `Local Secondary Index (Document-Partitioned Index):
- Example: Shard by \`userId\`. Local index on \`orderDate\`.
- Write Path: Extremely fast. When an order is created, the local shard writes the record and updates its local B-Tree index within the same node (single-node ACID transaction).
- Read Path by Secondary Key: If searching \`WHERE orderDate = '2026-05-01'\`, the router doesn't know which shard holds matching records. It must query ALL shards in parallel (Scatter-Gather) and merge the results.
- Risk: High tail latency if any single shard is slow.

Global Secondary Index (Term-Partitioned Index):
- Example: Base table sharded by \`userId\`. GSI table sharded by \`email\`.
- Read Path by Email: Direct $O(1)$ single-shard lookup! Router hashes \`email\` directly to the GSI shard.
- Write Path: Complex. Inserting a user on Shard 3 requires updating the base record on Shard 3, and updating the GSI table on Shard 7.
  - Synchronous GSI: Requires distributed 2-Phase Commit (2PC), crippling write throughput.
  - Asynchronous GSI (e.g., DynamoDB GSI): Updates the GSI asynchronously via internal change stream. Writes remain fast, but reads on the GSI are eventually consistent.`,
    code: `/*
Local vs Global Index Topology:

Local Index (LSI):
Shard 1: [Data: User 1..100]  + [Local Index on Status]
Shard 2: [Data: User 101..200] + [Local Index on Status]
Query "status = ACTIVE" ──> Must broadcast to Shard 1 AND Shard 2! (Scatter-Gather)

Global Index (GSI):
Base Shards (by UserId):
  Shard 1: User 1..100
  Shard 2: User 101..200
GSI Shards (by Email):
  GSI Shard A: emails A-M ──> Points to (UserId, Shard)
  GSI Shard B: emails N-Z
Query "email = john@example.com" ──> Direct lookup to GSI Shard A only!
*/`,
    recallHint: "Local index = fast local write, slow scatter-gather read. Global index = fast targeted read, complex cross-shard write.",
    interviewTip: "In DynamoDB, mention that GSIs are updated asynchronously in the background. If immediate read-your-own-writes consistency is required, queries must target the partition key on the base table.",
    tags: ["indexes", "secondary-index", "gsi", "lsi", "dynamodb", "sharding"]
  }),

  createCard({
    idNum: 31,
    category: "Databases, Storage Engines & Partitioning",
    concept: "Distributed Transactions: Two-Phase Commit (2PC) vs Three-Phase Commit (3PC)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Walk through the two phases of Two-Phase Commit (2PC). Why is 2PC considered a blocking protocol, and how does Three-Phase Commit (3PC) attempt to mitigate this?",
    answer: "Two-Phase Commit (2PC) ensures atomic commits across multiple distributed nodes via Phase 1 (Prepare: coordinator asks participants to vote and acquire locks) and Phase 2 (Commit/Abort: coordinator decides based on unanimous vote). 2PC is strictly blocking: if the coordinator crashes during Phase 2, participants remain blocked holding locks indefinitely. 3PC introduces a PreCommit phase and timeouts to prevent indefinite blocking.",
    explanation: `Two-Phase Commit (2PC) Protocol:
1. Phase 1: Prepare (Voting)
   - Coordinator sends \`PREPARE\` to all cohort participants.
   - Each cohort executes transaction locally up to write-ahead log, acquires exclusive row locks, and votes \`YES\` (ready to commit) or \`NO\` (failed).
2. Phase 2: Commit / Abort
   - If ALL cohorts voted \`YES\`: Coordinator logs \`COMMIT\` and broadcasts \`GLOBAL_COMMIT\` to all cohorts. Cohorts commit, release locks, and reply \`ACK\`.
   - If ANY cohort voted \`NO\` (or timed out): Coordinator broadcasts \`GLOBAL_ABORT\`. Cohorts rollback and release locks.

Why 2PC Fails at Scale:
- Blocking Hazard: If a cohort votes \`YES\` in Phase 1, it yields autonomy. If the Coordinator crashes before broadcasting Phase 2, cohorts must wait indefinitely holding locks, causing connection pool exhaustion and cascading lockups.
- Latency: Minimum 2 network round trips with synchronous disk fsyncs across multiple data centers.

Three-Phase Commit (3PC):
- Adds a non-blocking \`PreCommit\` phase between Prepare and Commit: CanCommit? -> PreCommit -> DoCommit.
- Cohorts can safely time out and commit if they reach PreCommit.
- Limitation: 3PC only works under fail-stop models without network partitions; during real network partitions, 3PC can still experience split-brain inconsistency.`,
    code: `/*
2PC Sequence Diagram:
Coordinator                  Cohort 1               Cohort 2
    │                            │                      │
    ├─── PREPARE Request ───────>│                      │
    ├─── PREPARE Request ──────────────────────────────>│
    │<── VOTE: YES (Locks Held) ─┤                      │
    │<── VOTE: YES (Locks Held) ────────────────────────┤
    │ (All YES -> Log Commit)    │                      │
    ├─── GLOBAL COMMIT ─────────>│                      │
    ├─── GLOBAL COMMIT ────────────────────────────────>│
    │<── ACK (Locks Released) ───┤                      │
    │<── ACK (Locks Released) ──────────────────────────┤
*/`,
    recallHint: "2PC: Prepare then Commit. If coordinator crashes during commit, everyone blocks holding locks.",
    interviewTip: "In modern distributed system design, advise AGAINST 2PC across independent microservices due to low availability. Advocate for Saga Pattern or Eventual Consistency instead.",
    tags: ["2pc", "3pc", "distributed-transactions", "consensus", "atomic-commit"]
  }),

  createCard({
    idNum: 32,
    category: "Databases, Storage Engines & Partitioning",
    concept: "Saga Pattern: Choreography vs Orchestration",
    priority: "must-know",
    difficulty: "must-know",
    question: "How does the Saga pattern manage distributed transactions across microservices without distributed locks, and what are the trade-offs between Choreography and Orchestration?",
    answer: "A Saga coordinates a distributed transaction as a sequence of local transactions across individual microservices, where each local transaction publishes an event triggering the next step. If a step fails, the Saga executes compensating transactions in reverse order to roll back state. Choreography uses decentralized event broadcasting; Orchestration uses a centralized orchestrator state machine.",
    explanation: `Why Sagas Replace 2PC in Microservices:
- Each microservice updates its own private database in a local ACID transaction and releases database locks immediately.
- Never holds distributed locks across services, preserving high availability and scale.

Choreography-Based Saga (Decentralized):
- Services listen to domain events via message broker (Kafka/RabbitMQ) and react autonomously.
- Example: Order Service emits \`OrderCreated\` -> Payment Service charges card and emits \`PaymentCompleted\` -> Inventory Service reserves stock.
- If Inventory fails, it emits \`InventoryFailed\` -> Payment Service listens and issues refund; Order Service marks order failed.
- Pros: Simple for small workflows (2–3 steps); loosely coupled.
- Cons: Difficult to track overall workflow state; cyclic dependency risks; hard to debug at scale.

Orchestration-Based Saga (Centralized State Machine):
- A dedicated Orchestrator service (e.g., Temporal, AWS Step Functions, or custom engine) tells each participant what to execute.
- Orchestrator sends command to Payment Service -> receives response -> sends command to Inventory Service.
- If step fails, Orchestrator explicitly invokes compensating APIs (\`refundPayment\`, \`cancelOrder\`).
- Pros: Single source of truth for workflow state; easy visualization, monitoring, and error handling.
- Cons: Orchestrator service can become a bottleneck if not scaled horizontally.`,
    code: `// Orchestration-Based Saga Pseudocode (Temporal / Node.js style)
export async function executeOrderSaga(orderData: OrderPayload) {
  let paymentDone = false;
  let inventoryReserved = false;

  try {
    // Step 1: Reserve Inventory
    await inventoryService.reserve(orderData.items);
    inventoryReserved = true;

    // Step 2: Process Payment
    await paymentService.charge(orderData.userId, orderData.total);
    paymentDone = true;

    // Step 3: Dispatch Shipping
    await shippingService.createShipment(orderData);

    return { status: "COMPLETED" };
  } catch (error) {
    // Failure! Execute Compensating Transactions in Reverse
    if (paymentDone) {
      await paymentService.refund(orderData.userId, orderData.total);
    }
    if (inventoryReserved) {
      await inventoryService.release(orderData.items);
    }
    await orderService.markFailed(orderData.id, error.message);
    throw new Error(\`Saga failed and compensated: \${error.message}\`);
  }
}`,
    recallHint: "Saga: Local transactions + compensating rollbacks. Choreography = event pinball; Orchestration = central conductor.",
    interviewTip: "Highlight that compensating transactions cannot guarantee absolute isolation (ACID 'I' is missing in Sagas). Other users might read intermediate uncompensated data (dirty reads) before the rollback finishes.",
    tags: ["saga-pattern", "choreography", "orchestration", "distributed-transactions", "microservices"]
  }),

  createCard({
    idNum: 33,
    category: "Databases, Storage Engines & Partitioning",
    concept: "Columnar Storage (Parquet, ClickHouse) vs Row-Oriented Storage (Postgres)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why are Columnar databases (ClickHouse, Snowflake, Parquet) orders of magnitude faster than Row-Oriented databases (PostgreSQL) for OLAP analytics?",
    answer: "Row-oriented databases store complete tuple rows contiguously on disk, making single-record inserts and lookups fast ($O(1)$) for OLTP, but forcing analytical queries to read every unused column from disk. Columnar databases store each column values contiguously in separate files with extreme compression (dictionary, run-length encoding), reading only the exact columns queried and leveraging CPU vectorization (SIMD).",
    explanation: `OLTP vs OLAP Architecture Comparison:
Query: \`SELECT AVG(purchase_amount) FROM transactions WHERE country = 'US';\`

In a Row-Oriented Database (PostgreSQL / MySQL):
- 100,000,000 transaction rows.
- Each row contains 50 columns (orderId, userId, shippingAddress, cardDetails, purchase_amount, etc.).
- Even though the query only needs 2 columns (\`country\` and \`purchase_amount\`), the database engine must read all 50 columns off disk into memory for all 100M rows!
- Disk I/O throughput becomes saturated; query takes minutes.

In a Columnar Database (ClickHouse / Parquet / Redshift):
- \`country\` values are stored together in one contiguous disk block: \`['US', 'US', 'DE', 'FR', 'US', ...]\`.
- \`purchase_amount\` values are stored in another contiguous disk block: \`[42.50, 19.99, 105.00, ...]\`.
- The remaining 48 columns are completely ignored and NEVER read from disk.
- Disk I/O is reduced by 95%+.
- Column values have identical data types, enabling massive compression (Dictionary Encoding, Run-Length Encoding, Snappy) and SIMD CPU vector instruction processing.`,
    code: `/*
Physical Storage Layout on Disk:

Row-Oriented Layout (Row-Major):
[ Row 1: ID, Name, Age, Country ] [ Row 2: ID, Name, Age, Country ] [ Row 3: ID, Name, Age, Country ]

Column-Oriented Layout (Column-Major):
[ Column ID:      1, 2, 3 ... ]
[ Column Name:    Alice, Bob, Charlie ... ]
[ Column Age:     30, 25, 40 ... ]  <-- Extreme compression & SIMD scan!
[ Column Country: US, US, UK ... ]   <-- Run-Length: "US:2, UK:1"
*/`,
    recallHint: "Row storage: best for grabbing full user profiles (OLTP). Column storage: best for aggregating 100M numbers (OLAP).",
    interviewTip: "In system design interviews with an analytics or telemetry component (e.g., ad click aggregator, metrics dashboard), immediately bifurcate storage: write transactions to PostgreSQL/Kafka and stream into ClickHouse/Snowflake for analytical aggregation.",
    tags: ["columnar-storage", "row-storage", "olap", "oltp", "clickhouse", "parquet"]
  }),

  createCard({
    idNum: 34,
    category: "Databases, Storage Engines & Partitioning",
    concept: "Database Normalization vs Denormalization Trade-offs",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When should large-scale systems normalize data models versus intentionally denormalizing them, and what are the operational trade-offs?",
    answer: "Normalization (1NF–3NF) eliminates data redundancy, guarantees single-source-of-truth updates, and prevents update anomalies, making it ideal for core transactional data; Denormalization duplicates data across tables/documents to eliminate expensive multi-table distributed SQL JOINs and optimize read latency ($O(1)$ single-fetch lookups), but requires complex multi-table write synchronization.",
    explanation: `Normalization (Relational Purity):
- Data split into distinct relational tables connected by Foreign Keys (Users, Orders, Items, Categories).
- Advantages: Zero data redundancy; updates to a user's address occur in exactly one row; no risk of partial/inconsistent data.
- Drawback at Scale: Reconstructing an Order screen requires 4-way SQL JOINs across tables. Once tables are sharded across separate physical database servers, cross-shard JOINs are prohibited or cripplingly slow.

Denormalization (Read Optimization at Scale):
- Embed the user name, item titles, and prices directly inside the \`Order\` record: \`{ orderId: 101, customerName: "Alice", items: [{ name: "Keyboard", price: 99 }] }\`.
- Advantages: A single key-value lookup retrieves the entire payload in 2ms. No joins required.
- Challenges:
  - If Alice changes her name, the system must either update 50,000 historical order records or accept historical point-in-time immutability (which is often preferred in e-commerce).
  - Increased storage footprint (disk is cheap, latency is expensive).`,
    code: `// Denormalized Event Projection for Fast Read Views
interface OrderDetailView {
  orderId: string;
  orderDate: string;
  customer: {
    id: string;
    fullName: string; // Denormalized from Users table
    email: string;
  };
  items: Array<{
    productId: string;
    title: string;   // Denormalized from Catalog table
    unitPrice: number;
    quantity: number;
  }>;
  totalAmount: number;
}
// Read queries fetch this entire document with a single GET /orders/101 in 1ms!`,
    recallHint: "Normalize for write consistency; denormalize for read speed and sharded scale.",
    interviewTip: "Point out that e-commerce orders *should* be denormalized because order history must represent a frozen snapshot of prices and addresses at the moment of checkout, unaffected by future catalog changes.",
    tags: ["normalization", "denormalization", "databases", "joins", "performance"]
  }),

  createCard({
    idNum: 35,
    category: "Databases, Storage Engines & Partitioning",
    concept: "Database Connection Pooling & Starvation Mechanics",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why is creating a new database connection per HTTP request disastrous at scale, and how does connection pool sizing prevent database CPU collapse?",
    answer: "Establishing a PostgreSQL/MySQL connection requires TCP 3-way handshakes, TLS negotiation, authentication, and backend process memory allocation (5–10MB per connection). Creating connections per request saturates database CPU with connection overhead. A connection pool (HikariCP, PgBouncer) maintains persistent warm connections, queueing excess requests to ensure the database operates at optimal CPU throughput without context-switching thrash.",
    explanation: `The Physics of Connection Sizing:
A common misconception is: 'More connections = higher concurrency'. In reality, giving a database 5,000 concurrent connections destroys performance:
- A database server with 16 CPU cores can only physically execute 16 query threads simultaneously.
- If 2,000 connections issue queries at once, the OS kernel spends 90% of its CPU time on context-switching and lock contention, causing query throughput to collapse.

PostgreSQL Connection Formula (PostgreSQL Wiki / HikariCP):
$$\\text{pool\\_size} = (\\text{core\\_count} \\times 2) + \\text{effective\\_spindle\\_count}$$
- For a 16-core server with fast NVMe SSD: optimal pool size is approximately $(16 \\times 2) + 1 = 33\\text{ connections}$!

PgBouncer Connection Pooling Modes:
1. Session Pooling: Connection allocated for client lifetime (standard).
2. Transaction Pooling: Connection allocated only for the duration of a single \`BEGIN...COMMIT\` transaction, returning to pool immediately afterward. Enables 20,000 app instances to share 100 backend PostgreSQL connections!`,
    code: `/*
PgBouncer Multi-Tier Pooling Architecture:

[ 1,000 Stateless Node.js Pods ] ── (10,000 App-Side Connections)
                     │
         [ PgBouncer (Transaction Mode) ] ── (Queues requests, multiplexes)
                     │
          (50 Persistent Server Connections)
                     ▼
         [ PostgreSQL 16-Core Primary ] (Runs at 98% pure query efficiency!)
*/`,
    recallHint: "Db connections are heavy. Small pools (cores x 2) maximize throughput; PgBouncer multiplexes thousands of apps.",
    interviewTip: "In system design sizing discussions, when an interviewer asks how 500 microservice pods will connect to Postgres, mention an external transaction pooler like PgBouncer or AWS RDS Proxy.",
    tags: ["connection-pooling", "pgbouncer", "postgresql", "performance", "thread-starvation"]
  }),

  createCard({
    idNum: 36,
    category: "Databases, Storage Engines & Partitioning",
    concept: "Database Federation vs Sharding vs Partitioning",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Differentiate between Database Partitioning (Horizontal/Vertical), Database Federation, and Sharding in architectural scalability.",
    answer: "Partitioning divides tables within a single database instance (e.g., table partitioning by month); Database Federation splits databases by business function (e.g., separate User DB, Billing DB, Inventory DB); Sharding distributes a single logical table across multiple independent physical database instances with identical schemas.",
    explanation: `Comparative Definitions:
1. Table Partitioning (Single Instance):
   - PostgreSQL declarative table partitioning: \`CREATE TABLE orders_2026_01 PARTITION OF orders FOR VALUES FROM ('2026-01-01') TO ('2026-02-01')\`.
   - Engine automatically routes queries to specific partitions using partition pruning.
   - All partitions still run on the same physical server and disk.
2. Database Federation (Functional Decomposition):
   - Decomposes a monolithic database by domain boundaries.
   - Example: \`db-auth.internal\` stores passwords, \`db-billing.internal\` stores credit cards, \`db-catalog.internal\` stores products.
   - Prevents any single database from handling 100% of the enterprise load.
   - Trade-off: Cross-domain SQL JOINs are eliminated; services must communicate via APIs.
3. Database Sharding (Horizontal Partitioning across Nodes):
   - A single massive table (\`Orders\`) is partitioned across 10 separate physical PostgreSQL database servers.
   - Shard 1 holds Order IDs ending in 0; Shard 2 holds Order IDs ending in 1, etc.
   - Provides near-infinite horizontal scaling for both storage and write IOPS.`,
    code: `/*
Visualizing Scaling Strategies:

1. Monolith:
   [ DB Instance ] ──> (Users + Orders + Billing + Products)

2. Federation (Split by Functional Domain):
   [ User DB ]        [ Billing DB ]        [ Catalog DB ]

3. Sharding (Split Single Large Domain Horizontally):
   [ Orders Shard 1 ]   [ Orders Shard 2 ]   [ Orders Shard 3 ]   [ Orders Shard 4 ]
   (IDs 0..25M)         (IDs 25M..50M)       (IDs 50M..75M)       (IDs 75M..100M)
*/`,
    recallHint: "Partitioning = single DB split into files. Federation = split by domain. Sharding = split single table across multiple servers.",
    interviewTip: "Always recommend Federation before Sharding. Splitting a database by domain boundaries (User DB, Order DB) is vastly simpler than implementing horizontal sharding and cross-shard queries.",
    tags: ["federation", "sharding", "partitioning", "database-architecture", "scalability"]
  })
];

module.exports = cards;
