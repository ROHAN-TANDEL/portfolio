const { createCard } = require("../hld_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 1,
    category: "Scalability & Architecture Fundamentals",
    concept: "Vertical vs Horizontal Scaling",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the architectural difference between Vertical Scaling (Scale Up) and Horizontal Scaling (Scale Out), and what are their respective ceilings?",
    answer: "Vertical scaling increases hardware capacity (CPU, RAM, NVMe) of a single node; it has hard hardware ceilings, single-point-of-failure (SPOF) risks, and downtime requirements. Horizontal scaling adds independent commodity instances behind a load balancer; it provides theoretically linear capacity growth, high availability, and fault tolerance at the cost of distributed complexity.",
    explanation: `Vertical scaling (Scaling Up) means upgrading an existing machine's specifications (e.g., migrating an AWS EC2 instance from m5.xlarge to r5b.24xlarge with 96 vCPUs and 768 GiB RAM).
Horizontal scaling (Scaling Out) means adding more machine instances to an active pool behind an L4/L7 load balancer or reverse proxy.

Key Architectural Trade-offs:
1. Hardware Ceiling: Vertical scaling hits physical motherboard and chip limits where price-to-performance decays exponentially. Horizontal scaling uses commodity nodes.
2. Resilience & Redundancy: If a vertically scaled server suffers kernel panic or power failure, the entire system is down (SPOF). Horizontal scaling permits N-1 node failures without full outage.
3. Architecture Requirements: Horizontal scaling requires stateless application layers, centralized session stores (Redis), and distributed persistence (sharded databases, object stores).
4. Maintenance & Upgrades: Vertical scaling requires scheduled downtime or expensive active-passive failovers. Horizontal scaling supports zero-downtime rolling and canary deployments.`,
    code: `// High-Level Topology: Horizontal vs Vertical
/*
Vertical Scale-Up:
[ Client ] ---> [ Single Monster Node (128 Cores / 1TB RAM) ] ---> SPOF / Hardware Cap!

Horizontal Scale-Out:
                     ┌───> [ App Instance 1 (Stateless) ] ───┐
[ Client ] ──> [ L7 LB ] ─┼───> [ App Instance 2 (Stateless) ] ───┼──> [ Sharded DB Cluster ]
                     └───> [ App Instance 3 (Stateless) ] ───┘         + [ Redis Cluster ]
*/

// Autoscaling Configuration (e.g., AWS Auto Scaling Group Target Tracking)
const asgPolicy = {
  metricType: "ASGAverageCPUUtilization",
  targetValue: 65.0, // Scale out when average CPU > 65% for 3 min
  scaleOutCooldown: 120, // seconds
  scaleInCooldown: 300,
  minCapacity: 4,
  maxCapacity: 64
};`,
    recallHint: "Vertical is bigger engine; Horizontal is more cars on the train.",
    interviewTip: "State upfront that application statelessness is the non-negotiable prerequisite for horizontal scaling. Mention graceful drain (connection draining) when terminating nodes.",
    tags: ["scalability", "horizontal-scaling", "vertical-scaling", "statelessness", "load-balancer"]
  }),

  createCard({
    idNum: 2,
    category: "Scalability & Architecture Fundamentals",
    concept: "Stateless vs Stateful Architectures",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why is statelessness essential for web-tier scalability, and how do systems manage state without turning web servers stateful?",
    answer: "A stateless service retains no client session or transactional state between HTTP requests in local process memory; any request can be handled by any server. State is externalized to high-throughput distributed layers (Redis clusters, PostgreSQL, Cassandra, S3), enabling instantaneous horizontal scaling, autoscaling, and zero-downtime rolling deploys.",
    explanation: `When a server stores user sessions, cart contents, or in-flight step state in local memory or local disk, incoming requests must always be routed to that specific server. This requires sticky sessions (session affinity) at the load balancer.

Downsides of Stateful Web Tier:
- Sticky sessions create severe traffic hot-spots if a few active sessions generate heavy load.
- If a stateful node crashes, all active users pinned to it lose their state or get logged out.
- Autoscaling cannot easily de-provision nodes because active sessions are trapped on them.

Stateless Architecture Strategy:
- JWTs or opaque tokens carried in headers/cookies.
- Session tokens validated against distributed in-memory datastores (e.g., Redis cluster with replication).
- Local memory is reserved purely for immutable read-only assets, process execution, and ephemeral connection buffers.`,
    code: `// Stateful Anti-Pattern (Local Memory Map)
// class SessionManager { private sessions = new Map(); } // Breaks across multiple instances!

// Stateless Production Pattern (Externalized State via Distributed Redis)
import Redis from "ioredis";
const redis = new Redis.Cluster([{ host: "redis-node-1", port: 6379 }]);

export async function authenticateAndGetSession(sessionId: string) {
  const sessionJson = await redis.get(\`session:\${sessionId}\`);
  if (!sessionJson) return null;
  // Refresh TTL to implement sliding expiration
  await redis.expire(\`session:\${sessionId}\`, 1800);
  return JSON.parse(sessionJson);
}`,
    recallHint: "Stateless = Any server can answer any request. State belongs in Redis/DB.",
    interviewTip: "Never use sticky sessions as a long-term architecture choice. If an interviewer asks how to scale an existing stateful server, explain the migration path: extract session store to Redis, make web tier stateless, then place behind an ALB.",
    tags: ["stateless", "stateful", "sessions", "redis", "architecture"]
  }),

  createCard({
    idNum: 3,
    category: "Scalability & Architecture Fundamentals",
    concept: "CAP Theorem (Consistency vs Availability vs Partition Tolerance)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Explain the CAP Theorem mathematically and practically. Why is 'picking Consistency and Availability without Partition Tolerance (CA)' a myth in distributed networks?",
    answer: "CAP states that in the event of an unavoidable network partition (P), a distributed system must choose between returning consistent, linearizable data (CP) or guaranteeing availability by returning potentially stale or un-synchronized data (AP). CA is physically impossible in distributed networks because network links can and will fail.",
    explanation: `Formulated by Eric Brewer and proven by Seth Gilbert and Nancy Lynch:
- Consistency (C): Linearizable consistency — every read receives the most recent write or an error.
- Availability (A): Every non-failing node returns a non-error response for every request (without guarantee of containing the latest write).
- Partition Tolerance (P): The system continues to operate despite an arbitrary number of messages being dropped or delayed by the network between nodes.

Why CA is a myth:
Network partitions are not an architectural choice; they are physical realities of cables, routers, switches, and cloud networks. Therefore, when a partition occurs, the system must choose:
1. CP (Consistency over Availability): Refuse writes or return errors if quorum cannot be reached (e.g., ZooKeeper, etcd, Spanner, MongoDB in majority write concern).
2. AP (Availability over Consistency): Accept reads/writes on both sides of the network split, allowing divergence and reconciling later via CRDTs or Last-Write-Wins (e.g., DynamoDB, Cassandra, Couchbase).`,
    code: `/*
        Network Partition Occurs between Node A & Node B:
                 [ Node A (Master) ] - - - X - - - [ Node B (Replica) ]
                                (Network Cut)

CP Choice:
- Node B rejects read/write requests with error HTTP 500/503.
- Guarantees NO stale data, but loses Availability on Node B partition.

AP Choice:
- Node B serves reads from local storage (stale data).
- Node B accepts local writes, causing state divergence.
- System resolves divergence post-partition via Vector Clocks or CRDTs.
*/`,
    recallHint: "P is a fact of physics; you only choose between C (consistency/error) and A (availability/stale).",
    interviewTip: "Always clarify that CAP applies specifically under network partitions. In normal non-partitioned operation, systems provide both consistency and low-latency availability (which brings us to PACELC).",
    tags: ["cap-theorem", "consistency", "availability", "partition-tolerance", "distributed-systems"]
  }),

  createCard({
    idNum: 4,
    category: "Scalability & Architecture Fundamentals",
    concept: "PACELC Theorem",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the PACELC Theorem, and how does it extend CAP to describe real-world database trade-offs in normal (non-partitioned) operations?",
    answer: "PACELC states: if there is a Partition (P), trade off Availability (A) versus Consistency (C); Else (E), when the system runs normally without partitions, trade off Latency (L) versus Consistency (C). This explains why systems like DynamoDB choose PC/EC or PA/EL, balancing latency against replication delays.",
    explanation: `Daniel Abadi formulated PACELC to address CAP's limitation: CAP only discusses behavior during rare network partitions, ignoring normal steady-state operations.

The Acronym Breakdown:
- If (P) Partition:
  - (A) Availability vs (C) Consistency
- (E) Else (normal operation):
  - (L) Latency vs (C) Consistency

Common System Classifications:
1. PC/EC (e.g., BigTable, Spanner, etcd):
   - Under partition: chooses Consistency.
   - In normal state: chooses Consistency over Latency (waits for multi-replica ack before responding).
2. PA/EL (e.g., DynamoDB default, Cassandra, Riak, CouchDB):
   - Under partition: chooses Availability.
   - In normal state: chooses Latency over Consistency (responds immediately using local node or sloppy quorum, replicates asynchronously in background).
3. PC/EL (e.g., MongoDB with primary write concern):
   - Under partition: prefers consistency (refuses write if primary disconnected).
   - In normal state: returns fast write acknowledgment from primary without waiting for all secondaries.`,
    code: `// DynamoDB / Cassandra Read/Write Quorum Equation:
// N = Replication Factor (e.g., 3)
// W = Write Quorum (number of replicas that must acknowledge write)
// R = Read Quorum (number of replicas that must respond to read)

// Strong Consistency Condition:
// W + R > N (Guarantees read and write quorums overlap by at least 1 node)

// Low Latency (PA/EL) Configuration:
// N=3, W=1, R=1 -> Latency is ultra low (L), but W + R <= N (Eventual Consistency)

// Strong Consistency (PC/EC) Configuration:
// N=3, W=2, R=2 -> W + R = 4 > 3 -> Strong Consistency, higher network latency (C)`,
    recallHint: "PACELC: Partition -> A vs C; Else -> Latency vs Consistency.",
    interviewTip: "Bringing up PACELC when discussing NoSQL database selection shows deep distributed systems maturity beyond standard CAP buzzwords.",
    tags: ["pacelc", "cap-theorem", "latency", "consistency", "quorum", "storage"]
  }),

  createCard({
    idNum: 5,
    category: "Scalability & Architecture Fundamentals",
    concept: "Latency vs Throughput & Tail Latency (p99/p99.9)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between latency and throughput, and why is tail latency (p99/p99.9) far more critical than average latency in microservices?",
    answer: "Latency is the duration required to process a single request (time); Throughput is the number of requests completed per unit of time (RPS/QPS). Tail latency (p99/p99.9) measures the slowest 1% or 0.1% of requests. In fan-out microservice architectures, a single user request invokes dozens of downstream calls; if any one has slow tail latency, the user's total response time is degraded.",
    explanation: `The Math of Microservice Tail Latency Amplification:
If a user request depends on $N = 100$ parallel downstream microservice calls, and each microservice has a 99th percentile (p99) latency of 100ms (meaning only 1% of requests are slower than 100ms):
The probability that ALL 100 services finish within 100ms is:
$$P(\\text{all fast}) = 0.99^{100} \\approx 0.366 \\ (36.6\\%)$$
Therefore, **63.4%** of user requests will experience the slow p99 tail latency!

Techniques to Mitigate Tail Latency:
1. Hedged Requests / Speculative Execution: Send request to primary replica; if no response within p95 time, fire duplicate request to backup replica and take first response.
2. Tied Requests: Send request to two servers with a cancellation token.
3. Goodput vs Throughput: Shed excess load using adaptive concurrency limits so servers do not thrash in CPU cache misses and GC pauses.`,
    code: `// Hedged Request Pattern in TypeScript
async function hedgedFetch(url: string, timeoutMs = 80): Promise<Response> {
  const controller = new AbortController();
  const primaryPromise = fetch(url, { signal: controller.signal });

  let secondaryPromise: Promise<Response> | null = null;
  const hedgeTimer = setTimeout(() => {
    // Primary took longer than p95 -> fire speculative backup request
    secondaryPromise = fetch(url, { signal: controller.signal });
  }, timeoutMs);

  try {
    const response = await Promise.race([
      primaryPromise,
      new Promise<Response>((_, reject) => {
        // Wait for secondary if primary is still pending
        setTimeout(async () => {
          if (secondaryPromise) {
            try { resolve(await secondaryPromise); } catch (e) { reject(e); }
          }
        }, timeoutMs);
      })
    ]);
    clearTimeout(hedgeTimer);
    return response;
  } finally {
    clearTimeout(hedgeTimer);
  }
}`,
    recallHint: "Averages hide misery; p99 reveals the truth. Fan-out amplifies 1% failures to 60%+ users.",
    interviewTip: "Never cite average latency in a system design interview. Always specify p50, p95, and p99, and explain how GC pauses or network queueing create tail spikes.",
    tags: ["latency", "throughput", "tail-latency", "p99", "hedged-requests", "metrics"]
  }),

  createCard({
    idNum: 6,
    category: "Scalability & Architecture Fundamentals",
    concept: "Little's Law & Concurrency Sizing",
    priority: "must-know",
    difficulty: "advanced",
    question: "State Little's Law and demonstrate how it is used to calculate concurrency, thread pool sizing, and memory bounds in distributed servers.",
    answer: "Little's Law states: $L = \\lambda \\times W$, where $L$ is average concurrent requests in the system, $\\lambda$ is arrival rate (throughput in req/sec), and $W$ is average processing time (latency in seconds). It allows engineers to accurately calculate required thread pools and connection counts for any target RPS.",
    explanation: `Mathematical Formulation:
$$L = \\lambda \\times W$$
- $L$ = Concurrency (number of active in-flight requests in the system)
- $\\lambda$ = Throughput / Arrival rate (requests per second)
- $W$ = Mean Service Time / Latency (seconds per request)

Practical Sizing Example:
A service receives $\\lambda = 10,000$ requests per second.
Each request makes database queries taking on average $W = 50\\text{ ms} = 0.05\\text{ s}$.
$$L = 10,000 \\times 0.05 = 500\\text{ concurrent in-flight requests}$$

If the service uses synchronous blocking threads (e.g., traditional Java Tomcat where 1 thread = 1 request):
- The cluster must maintain at least 500 active threads across instances.
- If each instance handles 100 threads, you need a minimum of 5 nodes.
- If latency spikes from 50ms to 500ms ($W = 0.5\\text{ s}$ due to a slow DB query):
$$L = 10,000 \\times 0.5 = 5,000\\text{ concurrent threads!}$$
The system will instantly suffer thread exhaustion, connection pool starvation, and catastrophic cascading failure unless rate-limited or non-blocking async I/O is used.`,
    code: `// Little's Law Capacity Calculator
function calculateRequiredCapacity(targetRPS: number, avgLatencySec: number) {
  const inFlightRequests = targetRPS * avgLatencySec;
  const memoryPerReqMb = 0.5; // average buffer allocation
  const estimatedMemoryMb = inFlightRequests * memoryPerReqMb;

  return {
    inFlightRequests,
    recommendedThreadPoolSize: Math.ceil(inFlightRequests * 1.3), // 30% headroom
    estimatedMemoryMb: Math.ceil(estimatedMemoryMb)
  };
}

// 25,000 RPS with 40ms (0.04s) average latency
console.log(calculateRequiredCapacity(25000, 0.04));
// Output: { inFlightRequests: 1000, recommendedThreadPoolSize: 1300, estimatedMemoryMb: 500 }`,
    recallHint: "L = Lambda x W. Concurrency = Throughput x Latency.",
    interviewTip: "Use Little's Law when calculating how many database connections, Kafka consumer threads, or backend microservice instances are needed to sustain peak traffic.",
    tags: ["littles-law", "capacity-planning", "throughput", "concurrency", "thread-pools"]
  }),

  createCard({
    idNum: 7,
    category: "Scalability & Architecture Fundamentals",
    concept: "Single Point of Failure (SPOF) & Redundancy",
    priority: "must-know",
    difficulty: "beginner",
    question: "What defines a Single Point of Failure (SPOF) in high-level architecture, and how do multi-AZ and multi-region deployments eliminate it?",
    answer: "A Single Point of Failure (SPOF) is any component whose breakdown halts the entire system. Eliminating SPOFs requires redundancy across all layers: dual Top-of-Rack switches, active-active or active-passive database replicas across multiple Availability Zones (AZs), redundant load balancers with health probes, and stateless app nodes.",
    explanation: `Layers of Redundancy to Eliminate SPOFs:
1. DNS Layer: Anycast routing and multi-provider DNS (e.g., Route53 + Cloudflare) with automated health checks.
2. Ingress & Load Balancing: Multi-AZ Application Load Balancers (ALB) or BGP ECMP (Equal-Cost Multi-Path) routing across physical hardware.
3. Compute/Application Tier: Minimum of 3 instances distributed across at least 2 or 3 distinct Availability Zones with auto-healing.
4. Database/Persistence Tier:
   - Primary-Standby with synchronous replication to standby in AZ2 and automated failover (e.g., AWS RDS Multi-AZ).
   - Distributed quorum-based databases (Spanner, Cassandra, CockroachDB) that survive full AZ loss without failover pause.
5. Caching Layer: Redis Sentinel or Redis Cluster with master and replica in separate AZs.`,
    code: `/*
High-Availability Multi-AZ Architecture (Zero SPOF):
                     [ Route 53 (Anycast DNS) ]
                               │
            ┌──────────────────┴──────────────────┐
     [ AZ-1 Ingress ]                      [ AZ-2 Ingress ]
            │                                     │
   [ App Pods (AZ-1) ]                   [ App Pods (AZ-2) ]
            │                                     │
   [ PG Master (AZ-1) ] ── Synchronous Rep ──> [ PG Standby (AZ-2) ]
*/`,
    recallHint: "One is none, two is one. Redundancy at DNS, LB, Compute, and Storage.",
    interviewTip: "In interviews, explicitly state: 'We will deploy across a minimum of 3 Availability Zones to ensure quorum protocols can survive a single AZ outage without split-brain.'",
    tags: ["spof", "high-availability", "multi-az", "redundancy", "failover"]
  }),

  createCard({
    idNum: 8,
    category: "Scalability & Architecture Fundamentals",
    concept: "Strong Consistency vs Eventual Consistency",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Compare Strong Consistency (Linearizability) with Eventual Consistency, highlighting consistency anomalies and real-world domain use cases.",
    answer: "Strong consistency guarantees that once a write is acknowledged, all subsequent reads across all nodes immediately return that updated value (or newer). Eventual consistency guarantees that if no new updates are made, all replicas will eventually converge to the same value, but stale reads and out-of-order observations can occur in the interim.",
    explanation: `Strong Consistency (Linearizability):
- All operations appear to take place atomically at a specific point in time on a single global timeline.
- Requires consensus protocols (Raft, Paxos) or 2-Phase Commit, adding network round trips and higher write latency.
- Essential for: financial ledgers, inventory deductions, seat allocations, password changes.

Eventual Consistency:
- Writes are accepted locally and propagated asynchronously to other replicas.
- Read requests can return stale data if directed to a replica that hasn't caught up.
- Offers ultra-low latency ($p99 < 5\\text{ms}$) and high availability ($99.999\\%$).
- Suitable for: social media feeds, video view counts, like counters, product reviews, DNS records.

Consistency Levels in Between:
- Read-Your-Own-Writes: A user always sees their own updates, even if other users see stale state.
- Monotonic Reads: If a client observes value $V_1$, they will never subsequently observe an older value $V_0$.
- Causal Consistency: Operations causally related must be observed by every node in the same order.`,
    code: `// DynamoDB Client Consistency Selection
import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
const client = new DynamoDBClient({});

// Eventual Consistency (Default: faster, 50% cheaper RCU cost, returns data within ~100ms)
const eventualRead = new GetItemCommand({
  TableName: "ProductViews",
  Key: { id: { S: "prod_123" } },
  ConsistentRead: false
});

// Strong Consistency (Synchronous read from primary/quorum, higher latency, 2x RCU)
const strongRead = new GetItemCommand({
  TableName: "BankLedger",
  Key: { accountId: { S: "acc_999" } },
  ConsistentRead: true
});`,
    recallHint: "Strong: No stale reads allowed, pays in latency. Eventual: Instant reads, but replicas catch up later.",
    interviewTip: "Match the consistency model to the business domain. Never default everything to Strong Consistency—explain that 90% of web features (likes, feeds) only need Eventual Consistency.",
    tags: ["consistency", "strong-consistency", "eventual-consistency", "linearizability", "dynamodb"]
  }),

  createCard({
    idNum: 9,
    category: "Scalability & Architecture Fundamentals",
    concept: "Read-Heavy vs Write-Heavy System Archetypes",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the read/write ratio (e.g., 100:1 vs 1:1) fundamentally dictate database selection, caching layers, and partitioning architectures?",
    answer: "Read-heavy systems (e.g., Twitter, Wikipedia, 100:1 ratio) optimize for fast retrieval through aggressive multi-tier caching (Redis, CDN), read-replicas, denormalized views, and B+ Tree indexes. Write-heavy systems (e.g., IoT telemetry, metrics, 1:10 ratio) optimize for append-only ingestion using LSM-Tree storage (RocksDB, Cassandra), Kafka message buffers, and batch writing.",
    explanation: `Read-Heavy Architecture Blueprint (99% Reads, 1% Writes):
- Storage: Relational DB (PostgreSQL) with multiple read replicas.
- Caching: Multi-level cache (L1 Memory + L2 Redis Cluster + L3 Cloudflare CDN).
- Indexes: Comprehensive B-Tree and Composite indexes to make query scans $O(\\log N)$.
- Data Denormalization: Pre-compute and store ready-to-display JSON summaries to avoid expensive multi-table SQL JOINs.

Write-Heavy Architecture Blueprint (High-Throughput Ingestion):
- Storage: Append-only LSM-Tree databases (Cassandra, ScyllaDB, InfluxDB, ClickHouse).
- Ingestion Buffer: Kafka or AWS Kinesis to absorb spiky write traffic and prevent database crashing.
- Write Path: Writes append to an in-memory MemTable and sequential Write-Ahead Log (WAL), deferring random disk writes to background compaction.
- Minimal Indexing: Heavy secondary indexes cripple write throughput; secondary indexing is minimized.`,
    code: `/*
Read-Heavy Pipeline:
[ Client ] ──> [ CDN ] (Hit 90%)
                 │ Miss
               [ Redis Cache ] (Hit 9%)
                 │ Miss
               [ Read Replica Pool ] (Hit 1%)

Write-Heavy Pipeline:
[ 100,000 IoT Devices ] ──> [ Kafka Topic (32 Partitions) ]
                                   │
                           [ Flink / Workers ] (Micro-batching)
                                   │
                           [ ClickHouse / Cassandra (LSM Append) ]
*/`,
    recallHint: "Read-heavy = cache, replica, denormalize. Write-heavy = buffer, append-only, LSM-tree.",
    interviewTip: "Always calculate the read-to-write ratio in the first 5 minutes of any system design interview. The ratio dictates whether your bottleneck is query latency or disk I/O write amplification.",
    tags: ["read-heavy", "write-heavy", "lsm-tree", "caching", "architecture-patterns"]
  }),

  createCard({
    idNum: 10,
    category: "Scalability & Architecture Fundamentals",
    concept: "Backpressure & Flow Control",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is backpressure in distributed pipelines, and how does it prevent fast producers from causing Out-Of-Memory (OOM) crashes in slow consumers?",
    answer: "Backpressure is a flow-control mechanism where a downstream consumer signals an upstream producer to slow down or pause message transmission when internal buffers exceed high-watermark thresholds. Without backpressure, unbounded queues absorb messages faster than they can be processed, exhausting RAM and triggering cascading crashes.",
    explanation: `Why Unbounded Queues are Fatal:
When a producer sends 50,000 req/sec and a downstream consumer can only process 10,000 req/sec:
- If queue is unbounded, messages accumulate in memory at 40,000 items/sec.
- Within minutes, Node.js or JVM processes trigger Out-Of-Memory (OOM) crashes.
- When the crashed node restarts, it is slammed with the same backlog and crashes again (crash loop).

Strategies for Implementing Backpressure:
1. TCP Flow Control (Sliding Window): Receiver advertises a small window size ($0$ window halts sender).
2. Reactive Streams / Reactive Pull: Consumer requests explicit demand from producer (\`subscription.request(n)\`).
3. Bounded Queues with Drop Policy: Reject with HTTP 429 (Too Many Requests), drop oldest, or drop newest.
4. Kafka Offset Lag Throttling: If consumer lag exceeds threshold, consumer pauses fetch on partitions (\`consumer.pause()\`).`,
    code: `// Node.js Stream Backpressure Implementation
import { createReadStream, createWriteStream } from "fs";

const readable = createReadStream("huge-log.csv");
const writable = createWriteStream("output.csv");

readable.on("data", (chunk) => {
  // write returns false when internal buffer exceeds highWaterMark
  const canContinue = writable.write(chunk);
  if (!canContinue) {
    // Backpressure applied: pause reading from source
    readable.pause();
  }
});

writable.on("drain", () => {
  // Consumer caught up: resume producer
  readable.resume();
});`,
    recallHint: "Backpressure: Consumer dictates the pace; bounded queues prevent OOM death.",
    interviewTip: "Never design an asynchronous ingestion pipeline with an unbounded queue. Always specify the queue capacity and what happens when it fills (e.g., DLQ, backpressure, or HTTP 429).",
    tags: ["backpressure", "flow-control", "streams", "kafka", "resilience"]
  }),

  createCard({
    idNum: 11,
    category: "Scalability & Architecture Fundamentals",
    concept: "Fault Tolerance & Graceful Degradation",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do large-scale systems achieve Fault Tolerance through Graceful Degradation, and what architectural mechanisms support it?",
    answer: "Fault tolerance is the ability to operate without interruption when components fail; Graceful degradation ensures that when non-critical subsystems fail, the core system continues operating with reduced functionality rather than experiencing a total outage. Mechanisms include feature flags, static fallbacks, shedding load, and asynchronous decoupling.",
    explanation: `Architectural Strategies for Graceful Degradation:
1. Critical vs Non-Critical Path Classification:
   - Netflix/Amazon Core Path: User login, video streaming, checkout button.
   - Non-Critical Path: Personalized recommendation engine, user reviews, like counters, viewing history.
2. Fallback Stubs & Cached Data:
   - If the recommendation service times out or throws 500, return a cached 'Top 10 Global Trending' list instead of a blank screen or error 500.
3. Feature Flags & Circuit Breakers:
   - Automatically disable heavy UI features (e.g., real-time typing indicators in chat) during traffic surges.
4. Load Shedding:
   - Under severe CPU saturation (>90%), reject anonymous non-paying traffic with HTTP 503 while allowing authenticated checkout traffic to proceed.`,
    code: `// Resilient Fallback Pattern with Circuit Breaker
export async function getProductRecommendations(userId: string): Promise<string[]> {
  try {
    // Attempt high-accuracy ML recommendation service
    const response = await fetchWithTimeout(\`https://ml-recs.internal/user/\${userId}\`, 150);
    return await response.json();
  } catch (err) {
    // Graceful Degradation: Fallback to pre-computed static popular items
    console.warn("ML Recs service unavailable. Falling back to cached popular products.");
    return ["prod_default_1", "prod_default_2", "prod_default_3"];
  }
}`,
    recallHint: "Degrade gracefully: Ship the core experience even if bells and whistles fail.",
    interviewTip: "Distinguish between hard dependencies and soft dependencies in your system design. Explain how a failure in a soft dependency never bubbles up to fail the primary transaction.",
    tags: ["fault-tolerance", "graceful-degradation", "resilience", "fallbacks", "circuit-breaker"]
  }),

  createCard({
    idNum: 12,
    category: "Scalability & Architecture Fundamentals",
    concept: "Amdahl's Law in System Scaling",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Amdahl's Law, and how does it limit the speedup achievable by adding more processors or servers to a distributed system?",
    answer: "Amdahl's Law calculates the theoretical maximum speedup of a system when only a portion of the task can be parallelized: $S(s) = \\frac{1}{(1 - p) + \\frac{p}{s}}$, where $p$ is the parallel fraction and $s$ is the speedup factor. It proves that the serial (non-parallelizable) portion of a system quickly becomes the absolute bottleneck regardless of how many nodes are added.",
    explanation: `Mathematical Formulation:
$$S(s) = \\frac{1}{(1 - p) + \\frac{p}{s}}$$
- $p$ = Proportion of execution that can be parallelized ($0 \\le p \\le 1$)
- $1 - p$ = Strictly sequential / serial proportion
- $s$ = Number of parallel processors / nodes

The Ceiling Analysis:
As $s \\to \\infty$, the speedup approaches:
$$S_{\\max} = \\frac{1}{1 - p}$$

Practical System Design Example:
Suppose in an image processing pipeline, 95% ($p = 0.95$) of the time is spent resizing pixel matrices (parallelizable across 100 EC2 instances), but 5% ($1 - p = 0.05$) is spent acquiring an exclusive lock on a PostgreSQL primary to update the user account record:
$$S_{\\max} = \\frac{1}{0.05} = 20\\times$$
Even if you allocate **1,000,000 servers**, the system can **never run faster than 20x** its single-node speed!
To scale further, engineers must re-architect the sequential 5% (e.g., using optimistic concurrency or asynchronous event streams).`,
    code: `// Amdahl's Law Speedup Function
function calculateSpeedup(parallelFraction: number, numProcessors: number): number {
  const serialFraction = 1 - parallelFraction;
  return 1 / (serialFraction + (parallelFraction / numProcessors));
}

console.log("90% parallel with 10 cores:", calculateSpeedup(0.90, 10).toFixed(2)); // ~5.26x
console.log("90% parallel with 100 cores:", calculateSpeedup(0.90, 100).toFixed(2)); // ~9.17x
console.log("90% parallel with Infinite cores:", (1 / (1 - 0.90)).toFixed(2)); // 10.00x Maximum!`,
    recallHint: "Amdahl's Law: The non-parallelizable lock or serial step limits maximum system speedup.",
    interviewTip: "Whenever an interviewer asks 'Why can't we just add 10x more workers to make this 10x faster?', cite Amdahl's law and point out the serial synchronization bottleneck.",
    tags: ["amdahls-law", "concurrency", "parallelism", "performance", "speedup"]
  })
];

module.exports = cards;
