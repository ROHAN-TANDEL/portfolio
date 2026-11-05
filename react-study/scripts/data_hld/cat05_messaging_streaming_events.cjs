const { createCard } = require("../hld_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 49,
    category: "Messaging, Streaming & Asynchronous Processing",
    concept: "Message Queues (RabbitMQ/SQS) vs Event Streaming (Kafka/Pulsar)",
    priority: "must-know",
    difficulty: "must-know",
    question: "What are the architectural differences between traditional Message Queues (RabbitMQ, SQS) and Distributed Event Streaming Platforms (Kafka, Pulsar)?",
    answer: "Traditional Message Queues manage discrete message lifecycles where messages are acknowledged and deleted immediately upon consumption (smart broker, dumb consumer); Event Streaming platforms append messages to an immutable distributed log that persists indefinitely, allowing multiple independent consumer groups to read and replay data at their own pace using offset cursors (dumb broker, smart consumer).",
    explanation: `Architectural Paradigm Shift:
1. Message Queues (RabbitMQ / ActiveMQ / AWS SQS):
   - Model: Queue of discrete tasks.
   - Broker State: Smart. The broker tracks which specific consumer has checked out each message, monitors ack timeouts, and physically deletes the message once acknowledged.
   - Scale: Perfect for complex routing (topic exchanges, fanouts, dead-letter queues) and discrete background job dispatch (e.g., video encoding, PDF generation).
   - Throughput: Tens of thousands of messages per second per broker.
   - Replayability: None. Once acknowledged, the message is permanently gone.
2. Event Streaming Platforms (Apache Kafka / Apache Pulsar):
   - Model: Append-only partitioned commit log on disk.
   - Broker State: Dumb. Kafka doesn't track per-message delivery state; it simply writes bytes sequentially to disk.
   - Consumer State: Smart. Each consumer tracks its own read position (Offset pointer).
   - Scale: Millions of messages per second with sequential disk I/O, zero-copy reads, and partition horizontal sharding.
   - Replayability: Indefinite retention (hours, days, or forever). New microservices can join today and replay historical events from offset 0 to reconstruct complete application state.`,
    code: `/*
Architecture Comparison:

Message Queue (RabbitMQ):
[ Producer ] ──> [ Exchange ] ──> [ Queue ] ──> [ Consumer A ] (Message Deleted on ACK!)

Distributed Event Log (Kafka):
[ Producer ] ──> [ Topic Partition 0 (Append-Only Log) ]
                   Offset: [ 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 ]
                                     ▲               ▲
                      [ Analytics Consumer ]   [ Billing Consumer ]
                           (Offset: 3)             (Offset: 7)
               (Messages persist for 7 days; any consumer can replay!)
*/`,
    recallHint: "Queue: Delete on ack, task-focused, cannot replay. Stream: Append-only log, multiple readers, offsets, replayable.",
    interviewTip: "When asked to choose between RabbitMQ and Kafka: choose RabbitMQ for complex task scheduling with priority queues and discrete job acks; choose Kafka for event-sourcing, stream processing, and multi-consumer analytics.",
    tags: ["messaging", "kafka", "rabbitmq", "event-streaming", "sqs", "queues"]
  }),

  createCard({
    idNum: 50,
    category: "Messaging, Streaming & Asynchronous Processing",
    concept: "Kafka Internals: Partitions, Consumer Groups, Offsets & Rebalancing",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Partitions and Consumer Groups enable horizontal scaling in Apache Kafka, and what happens during a Consumer Rebalance?",
    answer: "A Kafka topic is divided into Partitions, which are the fundamental unit of parallelism. A Consumer Group consists of multiple worker instances where each partition is assigned to exactly one consumer within the group. When consumers join or crash, or when heartbeats fail, the Group Coordinator triggers a Consumer Rebalance, redistributing partition assignments across active workers.",
    explanation: `Kafka Scale Mechanics:
- Partitioning: If a topic has 12 partitions, up to 12 consumers in the same group can read in parallel. Adding a 13th consumer leaves it idle because a partition cannot be split across multiple consumers in the same group.
- In-Order Guarantee: Kafka guarantees strict message ordering *only within a single partition*, NOT across the entire topic. Messages with the same partition key (\`hash(key) % num_partitions\`) are guaranteed to land on the same partition in order.
- Consumer Offsets (\`__consumer_offsets\`): Committed offsets track the last successfully processed message ID per partition.

The Consumer Rebalance Hazard:
- Group Coordinator (a Kafka broker) monitors consumer heartbeats.
- If a consumer exceeds \`max.poll.interval.ms\` (e.g., processing a huge batch takes longer than 5 minutes), the coordinator assumes the consumer died.
- A **Consumer Rebalance** is triggered:
  - Stop-the-world pause (in older Eager rebalance protocols) halts message consumption across all nodes.
  - Cooperative Sticky Assignor (Kafka 2.4+) migrates only reassigned partitions, allowing unaffected consumers to continue processing.`,
    code: `/*
Kafka Consumer Group Assignment (Topic with 4 Partitions):
Consumer Group 'order-processors' (2 Workers):
  Worker Pod 1 ──> Assigned: Partition 0, Partition 1
  Worker Pod 2 ──> Assigned: Partition 2, Partition 3

If Worker Pod 3 is added:
  Worker Pod 1 ──> Assigned: Partition 0
  Worker Pod 2 ──> Assigned: Partition 1, Partition 2
  Worker Pod 3 ──> Assigned: Partition 3 (Rebalance complete!)
*/

// KafkaJS Producer with Partition Key for Strict Ordering
import { Kafka } from "kafkajs";
const kafka = new Kafka({ brokers: ["kafka-broker:9092"] });
const producer = kafka.producer();

await producer.send({
  topic: "user-orders",
  messages: [
    {
      key: "user_42", // Guarantee all orders for user_42 route to SAME partition in order!
      value: JSON.stringify({ orderId: "ord_99", amount: 250 })
    }
  ]
});`,
    recallHint: "Partitions = unit of parallelism. 1 partition = 1 consumer in a group. Same key = same partition = ordered.",
    interviewTip: "Emphasize that total topic ordering does not scale; high-throughput distributed systems only order events per entity (e.g., per user or per orderId) via partition keys.",
    tags: ["kafka", "partitions", "consumer-groups", "rebalance", "event-streaming", "offsets"]
  }),

  createCard({
    idNum: 51,
    category: "Messaging, Streaming & Asynchronous Processing",
    concept: "Message Delivery Semantics (At-Most-Once, At-Least-Once, Exactly-Once)",
    priority: "must-know",
    difficulty: "must-know",
    question: "Differentiate At-Most-Once, At-Least-Once, and Exactly-Once processing semantics. How is true end-to-end Exactly-Once achieved in practice?",
    answer: "At-Most-Once commits offsets before processing, risking message loss on crash; At-Least-Once processes messages before committing offsets, guaranteeing zero data loss but introducing duplicate messages on failure; Exactly-Once (EOS) ensures each message affects system state exactly once via idempotent consumers or two-phase transactional commits across Kafka and downstream databases.",
    explanation: `Delivery Semantics Breakdown:
1. At-Most-Once (Loss-Tolerant, Zero Duplicates):
   - Flow: Read message -> Commit offset -> Process message.
   - Failure: If worker crashes while processing, the message is never retried because offset was already committed.
   - Use Case: Metrics, sensor pings where dropping a packet is acceptable.
2. At-Least-Once (Zero Loss, Possible Duplicates):
   - Flow: Read message -> Process message -> Commit offset.
   - Failure: If worker crashes after processing but before committing offset, the replacement worker re-reads the same message.
   - Use Case: Standard default in 95% of distributed systems. Requires Idempotent Consumers!
3. Exactly-Once Processing (EOS):
   - End-to-end guarantee that side-effects occur exactly once.
   - How Kafka EOS Works (Kafka-to-Kafka): Idempotent producer (Sequence numbers per PID) + Transactional Coordinator with Two-Phase Commit (\`sendOffsetsToTransaction\`).
   - Downstream System Reality: Kafka cannot atomically commit to an external PostgreSQL database in the same transaction without a 2PC coordinator or Idempotent Upserts.`,
    code: `// Idempotent Consumer Pattern for At-Least-Once Streaming
export async function handleOrderEvent(event: { eventId: string; payload: any }) {
  // Execute database transaction that checks deduplication table atomically
  await db.transaction(async (trx) => {
    // Attempt insert into processed_events table with unique constraint
    const inserted = await trx("processed_events")
      .insert({ event_id: event.eventId, processed_at: new Date() })
      .onConflict("event_id")
      .ignore();

    if (inserted.rowCount === 0) {
      console.log(\`Event \${event.eventId} already processed. Skipping duplicate.\`);
      return; // Deduplicated!
    }

    // Apply domain logic safely
    await trx("accounts").increment("balance", event.payload.amount);
  });
}`,
    recallHint: "At-most = commit first (may lose). At-least = process first (may duplicate). Exactly-once = at-least-once + idempotent consumer.",
    interviewTip: "In interviews, state clearly: 'In distributed systems, true end-to-end exactly-once is almost always implemented as At-Least-Once delivery paired with an Idempotent Consumer.'",
    tags: ["delivery-semantics", "exactly-once", "at-least-once", "idempotency", "kafka"]
  }),

  createCard({
    idNum: 52,
    category: "Messaging, Streaming & Asynchronous Processing",
    concept: "Dead Letter Queues (DLQ) & Poison Pill Handling",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a Poison Pill message in a queue, and how does a Dead Letter Queue (DLQ) with retry policies protect consumers from crash-loop deadlocks?",
    answer: "A Poison Pill is a malformed or corrupted message that causes consumer code to throw an unhandled exception every time it is processed; under at-least-once delivery, the consumer crashes and re-attempts the same poison message infinitely. A Dead Letter Queue (DLQ) routes messages to an isolated queue after $N$ failed retries, allowing the main consumer pipeline to continue unblocked.",
    explanation: `The Poison Pill Incident Sequence:
1. Producer publishes a JSON payload with a missing mandatory field or invalid syntax.
2. Consumer reads message -> JSON parse error or Null Pointer Exception -> process crashes.
3. Supervisor (Docker/Kubernetes) restarts the consumer pod.
4. Consumer reconnects to queue -> reads the exact same unacknowledged message -> crashes again.
5. Result: 100% of consumer worker pods crash-loop, halting processing of all legitimate messages!

DLQ & Exponential Retry Architecture:
- Step 1: Main Consumer encounters error -> logs error and increments retry counter in message header (\`x-retry-count: 1\`).
- Step 2: Message sent to Retry Topic with exponential backoff delay (e.g., 5s, 30s, 300s).
- Step 3: If retry count exceeds maximum (e.g., 5 attempts), message is diverted to \`orders-dlq\`.
- Step 4: Alert fires via PagerDuty; engineers inspect payload in DLQ, fix root cause bug, and replay messages via DLQ shovel script.`,
    code: `// Resilient SQS / Kafka DLQ Consumer Routing
export async function processQueueMessage(message: QueueMessage) {
  try {
    await executeBusinessLogic(message.body);
    await message.acknowledge();
  } catch (err) {
    console.error(\`Failed to process message \${message.id}: \${err.message}\`);
    const currentRetries = Number(message.headers["x-retry-count"] || 0);

    if (currentRetries >= 3) {
      // Divert to DLQ to protect the main stream
      await dlqProducer.send({
        topic: "orders-dlq",
        payload: message.body,
        error: err.message,
        failedAt: new Date().toISOString()
      });
      await message.acknowledge(); // Remove from main queue
    } else {
      // Re-queue with incremented retry count
      await retryProducer.sendWithDelay(message, currentRetries + 1);
      await message.acknowledge();
    }
  }
}`,
    recallHint: "Poison pill = crash loop on bad message. DLQ = divert after 3 failures so pipeline keeps moving.",
    interviewTip: "Always mention monitoring and alerting on DLQ queue depth: an escalating DLQ depth is the #1 early-warning indicator of schema incompatibilities or downstream API breakages.",
    tags: ["dlq", "dead-letter-queue", "poison-pill", "queues", "resilience", "kafka"]
  }),

  createCard({
    idNum: 53,
    category: "Messaging, Streaming & Asynchronous Processing",
    concept: "Idempotent Consumer & Deduplication Patterns",
    priority: "must-know",
    difficulty: "must-know",
    question: "How do Idempotent Consumers handle duplicate message deliveries in distributed systems, and what are the primary architectural deduplication patterns?",
    answer: "An idempotent consumer guarantees that processing the same message multiple times produces the identical final system state as processing it once. Primary patterns include: Database Unique Constraints on Idempotency Keys, Atomic Distributed Deduplication Locks (Redis \`SET key NX\`), and Natural Idempotency (replacing relative updates with absolute state assignments).",
    explanation: `Deduplication Architectural Patterns:
1. Natural Idempotency (Mathematical Invariance):
   - Non-Idempotent: \`UPDATE accounts SET balance = balance + 100 WHERE id = 1;\` (Running twice adds \$200).
   - Naturally Idempotent: \`UPDATE accounts SET balance = 500 WHERE id = 1;\` (Running 10 times results in balance = 500).
   - Soft Delete: \`UPDATE orders SET status = 'CANCELLED' WHERE id = 42;\` (Naturally idempotent).
2. Unique Constraint with RDBMS / Upsert:
   - Every event carries a globally unique \`idempotency_key\` (UUID generated at client or API Gateway).
   - Before executing business logic, insert the key into a \`processed_messages\` table inside the same ACID database transaction:
     \`INSERT INTO processed_messages (key, status) VALUES ('key_123', 'DONE');\`
   - If a duplicate message arrives, the unique constraint violation aborts the transaction cleanly.
3. Redis Fast Deduplication Filter:
   - For high-throughput non-transactional systems, use Redis:
     \`SET dedupe:event_123 1 EX 86400 NX\`
   - If return is \`OK\`, process message. If return is \`null\` (already exists), drop message immediately.`,
    code: `// Express / API Gateway Idempotency Key Middleware
import Redis from "ioredis";
const redis = new Redis();

export async function idempotencyMiddleware(req, res, next) {
  const idempotencyKey = req.headers["x-idempotency-key"];
  if (!idempotencyKey) return next();

  const cacheKey = \`idemp:\${idempotencyKey}\`;
  // SET NX with 24 hour expiration
  const acquired = await redis.set(cacheKey, "IN_PROGRESS", "NX", "EX", 86400);

  if (!acquired) {
    const cachedResponse = await redis.get(cacheKey);
    if (cachedResponse === "IN_PROGRESS") {
      return res.status(409).json({ error: "Concurrent request in progress" });
    }
    // Return identical cached historical response
    return res.status(200).json(JSON.parse(cachedResponse));
  }

  // Intercept response and cache it
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    redis.set(cacheKey, JSON.stringify(body), "XX", "EX", 86400);
    return originalJson(body);
  };

  next();
}`,
    recallHint: "Idempotency: f(f(x)) = f(x). Unique constraints or Redis SET NX ensure duplicates do no harm.",
    interviewTip: "Always require an Idempotency Key header (`X-Idempotency-Key`) in payment, reservation, and order placement system designs to handle client network timeouts safely.",
    tags: ["idempotency", "deduplication", "event-driven", "redis", "transactions"]
  }),

  createCard({
    idNum: 54,
    category: "Messaging, Streaming & Asynchronous Processing",
    concept: "Transactional Outbox Pattern & Change Data Capture (CDC)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the Dual-Write problem when saving to a database and publishing to Kafka in microservices, and how does the Transactional Outbox Pattern solve it?",
    answer: "The Dual-Write problem occurs when a service must both commit to a local database and publish a message to Kafka; if either operation crashes midway, data and event broker fall permanently out of sync. The Transactional Outbox pattern writes domain data and outgoing events atomically into an 'outbox' table in the *same* database transaction; an asynchronous CDC process (Debezium) tails the WAL to publish events reliably.",
    explanation: `The Dual-Write Failure Scenario:
\`\`\`typescript
await database.orders.create(order); // Step 1: DB commits
await kafkaProducer.send("order-created", order); // Step 2: Fails if network drops or pod crashes!
\`\`\`
- If Step 2 fails, the order exists in the database, but downstream billing and shipping never receive the event.
- If you invert the order (publish to Kafka first, then DB), the DB write could fail, resulting in phantom orders billed with no record in the database!

The Transactional Outbox Solution:
1. Application begins a local ACID database transaction.
2. Inserts new order into \`orders\` table.
3. Inserts event payload into \`outbox\` table:
   \`INSERT INTO outbox (id, aggregate_type, payload) VALUES (uuid, 'Order', '{"id": 101}');\`
4. Commits local transaction atomically. Both records succeed or both rollback.
5. Asynchronous Log Miner / CDC (Debezium):
   - Reads the database transaction log (Postgres WAL / MySQL binlog).
   - Extracts rows inserted into \`outbox\` table.
   - Publishes them to Kafka with At-Least-Once delivery.
   - Deletes or marks outbox rows as processed.`,
    code: `/*
Transactional Outbox Pattern Architecture:

[ Microservice ] ──(Atomic Local SQL Transaction)──┐
                                                    ▼
                       [ PostgreSQL DB ]
                       ├── Table: 'orders'
                       └── Table: 'outbox' (Contains serialized event JSON)
                               │
                               ▼ (Streams from WAL)
                       [ Debezium / CDC ]
                               │
                               ▼ (Publishes with zero dual-write race)
                       [ Kafka Cluster ] ──> [ Downstream Consumers ]
*/`,
    recallHint: "Outbox Pattern: Save event in DB table in same transaction. CDC reads WAL and publishes to Kafka.",
    interviewTip: "Never propose dual writes in a system design interview. Whenever a database update must trigger an event, immediately draw the Transactional Outbox pattern with Debezium CDC.",
    tags: ["outbox-pattern", "cdc", "debezium", "kafka", "dual-write", "microservices"]
  }),

  createCard({
    idNum: 55,
    category: "Messaging, Streaming & Asynchronous Processing",
    concept: "Event-Driven Architecture (EDA) & Event Sourcing",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Event Sourcing differ from traditional CRUD state storage, and what are the benefits and challenges of storing events as the source of truth?",
    answer: "Traditional CRUD updates database records in-place, overwriting past state and losing audit history; Event Sourcing stores every state mutation as an immutable append-only event in an Event Store. Current entity state is reconstructed by replaying historical events from genesis (or from the latest snapshot). It provides perfect auditability and temporal queries at the cost of query complexity.",
    explanation: `CRUD vs Event Sourcing:
- CRUD Model: Bank account balance is stored as \`balance = 750\`. When \$50 is withdrawn, \`UPDATE accounts SET balance = 700\`. Past balance is overwritten and gone forever.
- Event Sourcing Model:
  - Event 1: \`AccountOpened { initialBalance: 500 }\`
  - Event 2: \`MoneyDeposited { amount: 300 }\`
  - Event 3: \`MoneyWithdrawn { amount: 50 }\`
  - Current State: Derived by reducing: $500 + 300 - 50 = 700$.

Benefits of Event Sourcing:
1. Complete Audit Trail & Temporal Travel: Reconstruct the exact state of any account at 2:15 PM on March 14, 2025.
2. Append-Only Performance: Eliminates row locks and in-place disk updates; writes are fast sequential appends.
3. Event-Driven Integration: The event log acts as a natural feed for downstream analytics, ML, and search indexes.

Challenges:
- Snapshots: Replaying 100,000 events to compute balance is slow; periodic snapshots (every 1,000 events) are required.
- Schema Evolution: Event formats cannot be altered; changes require upcasting or event adapters.`,
    code: `// Event Sourcing Aggregation Example
interface Event {
  type: string;
  payload: any;
  timestamp: number;
}

class BankAccountAggregate {
  public balance = 0;
  public status = "CLOSED";

  // Replay event history to rehydrate state
  apply(event: Event) {
    switch (event.type) {
      case "ACCOUNT_OPENED":
        this.status = "OPEN";
        this.balance = event.payload.initialDeposit;
        break;
      case "FUNDS_DEPOSITED":
        this.balance += event.payload.amount;
        break;
      case "FUNDS_WITHDRAWN":
        this.balance -= event.payload.amount;
        break;
    }
  }
}`,
    recallHint: "CRUD overwrites state; Event Sourcing stores the sequence of immutable events and folds them.",
    interviewTip: "Pair Event Sourcing with CQRS (Command Query Responsibility Segregation). Writes append to the event log; read projections update Elasticsearch and Redis for fast querying.",
    tags: ["event-sourcing", "eda", "event-driven", "audit-trail", "cqrs"]
  }),

  createCard({
    idNum: 56,
    category: "Messaging, Streaming & Asynchronous Processing",
    concept: "Command Query Responsibility Segregation (CQRS)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why does separating the Write Model (Command) from the Read Model (Query) in CQRS enable independent scalability, and how is read consistency maintained?",
    answer: "CQRS segregates write operations (commands that mutate state with business validation) from read operations (queries that return optimized UI view models). This allows the write database (optimized for normalized integrity and high write throughput) and read databases (optimized for search and caching, like Elasticsearch or Redis) to scale independently via asynchronous event projections.",
    explanation: `Why Unify Read/Write Models Fails at Scale:
In complex applications (e.g., Amazon, Airbnb):
- Write Path: Requires strict validation, foreign keys, row locks, domain rules, and normalization.
- Read Path: Requires full-text search, multi-criteria filtering, geospatial radius calculations, and deeply nested denormalized JSON payloads.
Attempting to satisfy both requirements with a single PostgreSQL schema results in complex indexes that cripple write performance and complex SQL JOINs that cripple read performance.

CQRS Architectural Flow:
1. Command (Write Path): Client sends \`CreateOrderCommand\` -> API Gateway -> Command Handler -> Validates business rules -> Writes to Write DB (RDBMS / Event Store).
2. Event Publication: Write DB publishes \`OrderCreatedEvent\` to Kafka.
3. Projection Handlers (Read Model Builders):
   - Worker A updates Elasticsearch for full-text search.
   - Worker B updates Redis for instant dashboard lookups.
   - Worker C updates a denormalized PostgreSQL read replica.
4. Query (Read Path): Client sends \`GET /orders?status=PENDING\` -> Query Handler queries Elasticsearch/Redis directly, returning pre-joined data in 3ms.`,
    code: `/*
CQRS Architectural Blueprint:

[ User Browser ]
    ├── (Command: POST /orders) ──> [ Command Service ] ──> [ Write DB (Postgres) ]
    │                                                               │
    │                                                               ▼ (Emit Event)
    │                                                        [ Kafka Bus ]
    │                                                               │
    │                                                               ▼ (Projection Workers)
    └── (Query: GET /orders)    ──> [ Query Service ]   <── [ Read DB (Elastic/Redis) ]
*/`,
    recallHint: "CQRS: Separate write commands from read queries. Optimize write DB for ACID; read DB for UI views.",
    interviewTip: "Highlight the trade-off: CQRS introduces Eventual Consistency between the write database and the read models. The UI must handle the small replication lag gracefully (optimistic UI updates).",
    tags: ["cqrs", "event-sourcing", "read-model", "write-model", "elasticsearch", "microservices"]
  }),

  createCard({
    idNum: 57,
    category: "Messaging, Streaming & Asynchronous Processing",
    concept: "Kafka Zero-Copy Data Transfer (sendfile syscall & Page Cache)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Apache Kafka achieve millions of messages per second using Linux OS Page Cache and the sendfile(2) zero-copy system call?",
    answer: "Kafka bypasses JVM memory heap entirely, relying on the OS Page Cache for caching and using the \`sendfile(2)\` Linux system call to transfer log bytes directly from OS page cache to the network socket buffer via DMA (Direct Memory Access). This eliminates context switches between kernel and user space and avoids CPU memory copying.",
    explanation: `Traditional File Transfer (4 Context Switches, 4 Data Copies):
When a standard web server reads a file from disk and sends it over a network socket:
1. Disk -> OS Kernel Page Cache (DMA Copy).
2. OS Page Cache -> JVM Application Buffer in User Space (CPU Copy) [Context Switch 1 -> 2].
3. JVM Buffer -> OS Socket Buffer in Kernel Space (CPU Copy) [Context Switch 3 -> 4].
4. Socket Buffer -> Network Card / NIC Buffer (DMA Copy).
Result: Huge CPU memory bandwidth waste and severe JVM Garbage Collection overhead.

Kafka Zero-Copy Transfer with sendfile(2):
1. Disk -> OS Kernel Page Cache (DMA Copy).
2. \`sendfile()\` instructs the kernel: copy file descriptor directly to network socket buffer!
3. OS Page Cache -> Network Interface Card (DMA Copy directly via packet scatter-gather).
Result:
- **Zero data copied into JVM user space.**
- **Zero JVM Garbage Collection (GC) pauses.**
- **CPU does almost zero work**; data moves directly across hardware buses via DMA at line speed.`,
    code: `/*
Traditional Transfer vs Zero-Copy (sendfile):

Traditional (4 copies, 4 context switches):
[ Disk ] ──DMA──> [ Kernel Page Cache ] ──CPU──> [ JVM App Buffer ]
                                                        │
[ NIC ]  <──DMA── [ Socket Buffer ]     <──CPU──────────┘

Zero-Copy sendfile(2) (Zero CPU copy, Zero JVM memory):
[ Disk ] ──DMA──> [ Kernel Page Cache ] ──DMA (Scatter-Gather)──> [ NIC Hardware ]
*/`,
    recallHint: "sendfile(2) moves bytes from disk cache to NIC via DMA directly. Zero JVM heap, zero CPU copy.",
    interviewTip: "Cite Kafka's reliance on OS Page Cache and `sendfile` zero-copy when explaining why Kafka drastically outperforms traditional Java message brokers that cache messages in JVM heap memory.",
    tags: ["kafka", "zero-copy", "sendfile", "page-cache", "dma", "performance"]
  }),

  createCard({
    idNum: 58,
    category: "Messaging, Streaming & Asynchronous Processing",
    concept: "Stream Processing vs Batch Processing (Kafka Streams, Flink vs Spark)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Compare Stream Processing (Apache Flink, Kafka Streams) with Batch Processing (Apache Spark, MapReduce) in terms of latency, windowing, and watermarks.",
    answer: "Batch processing operates on finite, bounded datasets at scheduled intervals (hours/days), optimizing for total throughput over latency (high latency, minutes/hours); Stream processing operates continuously on unbounded real-time data streams with millisecond latencies, managing out-of-order data via event-time windows and watermarks.",
    explanation: `Core Conceptual Dimensions:
1. Data Model:
   - Batch: Bounded dataset (e.g., all 50M log entries from yesterday).
   - Stream: Unbounded infinite sequence of events arriving continuously.
2. Latency:
   - Batch: Minutes to hours.
   - Micro-Batch (Spark Streaming): 100ms–1s chunks.
   - Pure Event-at-a-Time Stream (Apache Flink): Sub-10 millisecond latency.
3. Time Semantics in Stream Processing:
   - Event Time: The exact moment the event occurred on the user's device.
   - Processing Time: The clock time of the server processing the event.
   - Ingestion Time: The time the event arrived at the Kafka broker.
4. Watermarks (Handling Delayed / Out-of-Order Events):
   - Mobile users go through tunnels; events arrive 10 minutes late.
   - A Watermark is a temporal signal ($t$) stating: 'We assume all events with event-time $\\le t$ have arrived.' When a watermark passes window end, the window evaluates and emits aggregated results.`,
    code: `/*
Windowing Models in Stream Processing:

1. Tumbling Window (Fixed, non-overlapping):
   [ 12:00 - 12:05 ] [ 12:05 - 12:10 ] [ 12:10 - 12:15 ]

2. Sliding Window (Overlapping, continuous):
   [ 12:00 - 12:05 ]
       [ 12:01 - 12:06 ]
           [ 12:02 - 12:07 ]

3. Session Window (Dynamic, gap-based per user):
   [ User A Activity: 5 min ] <--- 30 min idle gap ---> [ User A Activity: 2 min ]
*/`,
    recallHint: "Batch = bounded data, high latency. Stream = unbounded real-time events. Watermarks handle late data.",
    interviewTip: "In ad click aggregation or fraud detection designs, choose Apache Flink for sub-second event-time window processing, and Spark for large nightly billing reconciliation jobs.",
    tags: ["stream-processing", "batch-processing", "flink", "spark", "watermarks", "windowing"]
  }),

  createCard({
    idNum: 59,
    category: "Messaging, Streaming & Asynchronous Processing",
    concept: "Kafka Log Compaction Mechanics",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Kafka Log Compaction work, and how does it allow Kafka to function as a persistent key-value changelog store?",
    answer: "Kafka Log Compaction retains at least the most recent message for each record key within a partition, discarding older obsolete values for that key during background cleaner sweeps. This transforms Kafka into a durable changelog where the log represents the latest state of all keys rather than an ever-growing time-bounded stream.",
    explanation: `How Log Compaction Works:
- By default, Kafka deletes segments based on time (\`log.retention.hours = 168\`) or size.
- With Log Compaction (\`cleanup.policy = compact\`):
  - Every message has a key and a value.
  - The log is split into:
    - **Clean Head**: Previously compacted segments.
    - **Dirty Tail**: Newly written uncompacted segments.
  - A background cleaner thread builds an in-memory hash map of keys to their latest offsets in the dirty segment.
  - Compaction writes out a new segment, retaining only the record with the highest offset for each key.
- Tombstone Records (Deletions):
  - To delete a key entirely, producer sends a message with key $K$ and a \`null\` value (Tombstone).
  - Cleaner preserves the tombstone for \`delete.retention.ms\` so consumers observe the deletion before it is permanently pruned.`,
    code: `/*
Kafka Log Compaction Transformation:

Before Compaction (Raw Segment):
Offset:  0        1        2        3        4        5
Record: [k1: v1] [k2: v1] [k1: v2] [k3: v1] [k2: v2] [k1: v3]

After Compaction (Only latest value per key retained!):
Offset:  3        4        5
Record: [k3: v1] [k2: v2] [k1: v3]
*/`,
    recallHint: "Log compaction: Keep only the latest value for every key. Null value = tombstone deletion.",
    interviewTip: "Mention that Kafka log compaction is used to back KTables in Kafka Streams, restore cache state on server reboot, and maintain user profile state machines without external databases.",
    tags: ["kafka", "log-compaction", "tombstone", "storage", "streaming"]
  }),

  createCard({
    idNum: 60,
    category: "Messaging, Streaming & Asynchronous Processing",
    concept: "Priority Queues & Backoff Queue Topologies",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why do standard FIFO queues fail under priority traffic surges, and how are multi-tier Priority Queues and Delayed Retry queues implemented?",
    answer: "Strict FIFO queues process messages in arrival order; during traffic surges, millions of low-priority bulk emails block urgent high-priority password reset emails for hours. Priority queuing separates traffic into distinct physical queues with weighted worker allocations; delayed retry queues use bucketed TTL queues to handle retry backoffs without blocking active traffic.",
    explanation: `The Priority Inversion Problem:
- A marketing campaign publishes 5,000,000 promotional newsletter emails into the queue at 09:00 AM.
- At 09:01 AM, a VIP user clicks 'Forgot Password'.
- In a single FIFO queue, the password reset is item #5,000,001. The user waits 3 hours to receive their OTP!

Architectural Solutions:
1. Multi-Queue Dedicated Worker Allocation:
   - High-Priority Queue (\`otp-emails\`): 80% of worker pool capacity.
   - Low-Priority Queue (\`promo-emails\`): 20% of worker pool capacity.
   - Guarantee: High-priority queue depth remains near zero even if low-priority backlog has 10M messages.
2. Weighted Fair Queuing (WFQ):
   - A single worker pool checks queues with a weighted ratio: for every 4 high-priority messages processed, process 1 low-priority message.
   - Prevents starvation of low-priority tasks while guaranteeing high-priority SLAs.
3. Delayed Backoff Queues (RabbitMQ Dead-Letter Routing):
   - Queue \`retry-5s\` has \`message-ttl: 5000\` and dead-letters back to the main queue. Messages sleep for 5 seconds without burning CPU threads.`,
    code: `/*
Multi-Tier Priority Queue Worker Topology:

[ Traffic Ingress ] ──┬──> [ High-Priority SQS (OTP / Passwords) ] ──> [ 16 Dedicated Workers ]
                      └──> [ Low-Priority SQS (Marketing Promo) ]  ──> [ 4 Throttled Workers ]
*/

// Weighted Fair Queue Consumer Loop
async function processNextJob() {
  // 4-to-1 ratio: Check high-priority 4 times before checking low-priority
  for (let i = 0; i < 4; i++) {
    const highJob = await queueClient.pop("queue:high");
    if (highJob) return execute(highJob);
  }
  const lowJob = await queueClient.pop("queue:low");
  if (lowJob) return execute(lowJob);
}`,
    recallHint: "Separate queues by priority tier. Never let 5M marketing emails block 1 password reset.",
    interviewTip: "In notification or ride-matching system designs, always bifurcate into priority tiers: transactional/urgent vs bulk/promotional.",
    tags: ["priority-queues", "queues", "scheduling", "fair-queueing", "resilience"]
  })
];

module.exports = cards;
