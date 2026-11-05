const { createCard } = require("../ms_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 25,
    category: "Asynchronous Messaging, Event-Driven Choreography & Orchestration",
    concept: "Event-Driven Architecture (EDA) Foundations",
    priority: "must-know",
    difficulty: "must-know",
    question: "What are the core architectural principles of Event-Driven Architecture (EDA) in microservices, and how does it achieve extreme temporal decoupling?",
    answer: "In Event-Driven Architecture (EDA), microservices communicate by producing and consuming immutable events representing state mutations; the producer emits events without knowing or caring which downstream services are listening (temporal and spatial decoupling). This eliminates synchronous waiting, improves availability during downstream service downtime, and allows new services to attach to event streams with zero producer changes.",
    explanation: `Core EDA Principles:
1. Producer Anonymity (Zero Knowledge of Consumers):
   - Order Service publishes \`OrderPlacedEvent\` to Kafka.
   - It does NOT know that Payment Service, Fraud Detection Service, Analytics Service, and Shipping Service are listening.
   - Adding a new Marketing Loyalty Points service requires zero code changes or redeployments to Order Service!
2. Temporal Decoupling:
   - The producer and consumer do not need to be executing concurrently.
   - If Shipping Service is undergoing database maintenance for 2 hours, messages queue safely in Kafka partitions. When Shipping Service reboots, it catches up with zero dropped orders.
3. Event Immutability:
   - Events represent historical facts that already happened in the past (named in past tense: \`UserRegistered\`, \`PaymentProcessed\`).
   - Facts cannot be modified or un-happened; corrections are published as new compensating events (\`PaymentRefunded\`).`,
    code: `/*
Event-Driven Decoupling Topology:

[ Order Service ] ──(Publishes 'OrderCreated' Event)──> [ Kafka Topic: orders.v1 ]
                                                              │
         ┌────────────────────────────┼───────────────────────┴────────────────────┐
         ▼                            ▼                                            ▼
[ Payment Service ]          [ Inventory Service ]                        [ Marketing Service ]
(Charges card)               (Reserves warehouse stock)                   (Newly added, 0 code change
                                                                           to Order Service!)
*/`,
    recallHint: "EDA: Past-tense facts. Producer doesn't know who is listening. New services attach with zero producer edits.",
    interviewTip: "Highlight that Event-Driven Architecture transforms the enterprise into a reactive nervous system, but caution that it requires robust distributed tracing and schema governance.",
    tags: ["eda", "event-driven", "messaging", "temporal-decoupling", "kafka", "microservices"]
  }),

  createCard({
    idNum: 26,
    category: "Asynchronous Messaging, Event-Driven Choreography & Orchestration",
    concept: "Choreography vs Orchestration in Event-Driven Workflows",
    priority: "must-know",
    difficulty: "must-know",
    question: "Compare Event Choreography with Workflow Orchestration across visibility, coupling, complexity, and failure handling in distributed business processes.",
    answer: "Choreography uses decentralized event pinball where services listen and react autonomously to domain events (loosely coupled, simple for small 2-3 step flows, but difficult to visualize and trace); Orchestration uses a centralized coordinator service (Temporal, AWS Step Functions) to command workers and manage workflow state machines (single source of truth, easy error handling and timeouts, but potential coordinator bottleneck).",
    explanation: `Comparative Analysis:
1. Choreography (Event Pinball / Decentralized):
   - Order Service emits \`OrderCreated\` -> Payment Service listens and charges card -> Payment emits \`PaymentCompleted\` -> Inventory listens and reserves item.
   - Pros: Maximum decoupling; services only depend on event contracts; no central orchestrator service.
   - Cons: Lack of overall workflow visibility. What is the current status of Order #999? You must query 4 different databases. Cyclical dependencies can cause infinite event loops. Hard to handle multi-step compensations.
2. Orchestration (Conductor / Centralized State Machine):
   - A dedicated Orchestrator service (e.g., Temporal.io, Zeebe, or custom code) explicitly calls each service.
   - Orchestrator commands Payment Service: \`charge(orderId)\` -> waits for response -> commands Inventory: \`reserve(items)\`.
   - Pros: Complete visibility of workflow state; centralized error handling, retries, and timeouts; clear execution graph.
   - Cons: Tighter coupling between orchestrator and participants; requires scaling the orchestrator engine.`,
    code: `/*
Choreography (Pinball) vs Orchestration (Conductor):

Choreography:
[ Order Svc ] ──(OrderCreated)──> [ Payment Svc ] ──(PaymentSuccess)──> [ Inventory Svc ]

Orchestration:
                [ Order Saga Orchestrator ]
                 ├── 1. Command: ChargeCard ──> [ Payment Svc ]
                 └── 2. Command: Reserve    ──> [ Inventory Svc ]
*/`,
    recallHint: "Choreography = decentralized event pinball (hard to trace). Orchestration = central conductor state machine (clear visibility).",
    interviewTip: "In interviews, recommend Choreography for simple broadcast notifications (2–3 steps) and Orchestration (Temporal/Step Functions) for complex transactional multi-step business workflows (e.g., order checkout, loan approval).",
    tags: ["choreography", "orchestration", "saga", "event-driven", "temporal", "workflows"]
  }),

  createCard({
    idNum: 27,
    category: "Asynchronous Messaging, Event-Driven Choreography & Orchestration",
    concept: "Transactional Outbox Pattern & Debezium Change Data Capture (CDC)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Walk through the end-to-end execution flow of the Transactional Outbox pattern with Debezium CDC, explaining why it is the definitive solution to the Dual-Write problem.",
    answer: "The Transactional Outbox pattern inserts domain entities into business tables and outgoing event payloads into an 'outbox' table within the SAME atomic local database transaction. Debezium tails the database transaction log (PostgreSQL WAL / MySQL binlog) via Change Data Capture (CDC), streaming outbox rows to Kafka with guaranteed at-least-once delivery, completely eliminating dual-write inconsistencies.",
    explanation: `The Dual-Write Race Disaster:
\`\`\`typescript
await db.orders.insert(order); // Step 1
await kafka.publish("orders", order); // Step 2 (What if process crashes or network drops here?)
\`\`\`
- If Step 2 fails, the order exists in the database, but downstream billing and shipping never know. Data is permanently desynchronized!

The Transactional Outbox + CDC Solution:
1. Application begins a local ACID database transaction.
2. Inserts order into \`orders\` table.
3. Inserts event payload into \`outbox\` table:
   \`INSERT INTO outbox (id, aggregate_type, payload) VALUES (uuid, 'Order', '{"id": 101}');\`
4. Commits local transaction. (Both write, or both rollback atomically).
5. Database engine flushes transaction to Write-Ahead Log (WAL) on disk.
6. Debezium Connector:
   - Uses PostgreSQL logical replication to tail the WAL.
   - Reads newly committed rows in the \`outbox\` table.
   - Serializes payload and writes to Apache Kafka topic \`orders.v1\`.
7. Once Kafka acknowledges write, Debezium updates its replication slot LSN offset.`,
    code: `/*
Transactional Outbox with Debezium Architecture:

[ Microservice ] ──(Single Local SQL Transaction)──┐
                                                    ▼
                       [ PostgreSQL Database ]
                       ├── Table: 'orders'
                       └── Table: 'outbox' (Contains serialized event JSON)
                               │
                               ▼ (Streams from PostgreSQL WAL)
                       [ Debezium CDC Connector ]
                               │
                               ▼ (Publishes with At-Least-Once Guarantees)
                       [ Kafka Cluster ] ──> [ Downstream Microservices ]
*/`,
    recallHint: "Outbox Pattern: Save event in DB table in same transaction. Debezium CDC reads WAL to publish to Kafka.",
    interviewTip: "Never propose dual writes in a system design interview. Whenever a database write must emit an event, immediately present the Transactional Outbox pattern with Debezium CDC.",
    tags: ["transactional-outbox", "cdc", "debezium", "dual-write", "kafka", "atomicity"]
  }),

  createCard({
    idNum: 28,
    category: "Asynchronous Messaging, Event-Driven Choreography & Orchestration",
    concept: "Polling Publisher vs Transaction Log Miner (CDC)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Compare the Polling Publisher pattern with Transaction Log Mining (CDC) for relaying outbox events from a database to a message broker.",
    answer: "A Polling Publisher uses a background worker thread that queries the database periodically ('SELECT * FROM outbox WHERE status = PENDING LIMIT 100') and publishes to Kafka (simple to build, but causes database query polling overhead and high latency); Transaction Log Mining (CDC/Debezium) tails the database WAL at the byte level (sub-millisecond latency, zero SQL query overhead, but requires database admin privileges and CDC infrastructure).",
    explanation: `Polling Publisher (SQL Polling):
- Worker runs: \`SELECT * FROM outbox WHERE published = false FOR UPDATE SKIP LOCKED LIMIT 100\`.
- Worker publishes to Kafka, then runs: \`UPDATE outbox SET published = true WHERE id IN (...)\`.
- Strengths: Works on any SQL database without special plugins; easy to write in 50 lines of code.
- Bottlenecks at Scale:
  - Polling overhead: Continuous polling queries consume database CPU even when no new data arrives.
  - Latency: Events are delayed by the polling interval (e.g., 500ms–2000ms).
  - Table Bloat: Massive index updates on \`outbox\` table require frequent PostgreSQL \`VACUUM\`.

Transaction Log Mining (CDC - Debezium / Kafka Connect):
- Reads internal database write-ahead log (Postgres WAL, MySQL binlog, Oracle Redo log).
- Strengths:
  - Sub-millisecond latency (events captured the instant WAL records are written).
  - Zero SQL query overhead on the database query engine.
  - Captures exact commit ordering.
- Challenges: Requires DBA configuration of replication slots (\`wal_level = logical\`); infrastructure complexity (managing Kafka Connect clusters).`,
    code: `// Polling Publisher with PostgreSQL SKIP LOCKED (Anti-Contention Pattern)
export async function pollAndPublishOutbox(db: any, kafkaProducer: any) {
  // Use SKIP LOCKED so multiple worker pods can poll concurrently without deadlocks!
  const query = \`
    WITH batch AS (
      SELECT id, payload FROM outbox_table
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT 100
      FOR UPDATE SKIP LOCKED
    )
    UPDATE outbox_table
    SET status = 'PROCESSED', processed_at = NOW()
    WHERE id IN (SELECT id FROM batch)
    RETURNING id, payload;
  \`;

  const { rows } = await db.query(query);
  for (const row of rows) {
    await kafkaProducer.send("orders.v1", JSON.parse(row.payload));
  }
}`,
    recallHint: "Polling: SQL query with SKIP LOCKED (simple, poll latency). Log Mining: Debezium reads WAL (zero SQL load, instant).",
    interviewTip: "If designing for high throughput (10,000+ events/sec), choose Transaction Log Mining (CDC). If designing an MVP with standard traffic, propose Polling Publisher with `FOR UPDATE SKIP LOCKED`.",
    tags: ["outbox-pattern", "polling-publisher", "cdc", "debezium", "skip-locked", "wal"]
  }),

  createCard({
    idNum: 29,
    category: "Asynchronous Messaging, Event-Driven Choreography & Orchestration",
    concept: "Idempotent Event Consumer & Deduplication Keys",
    priority: "must-know",
    difficulty: "must-know",
    question: "Why does at-least-once message delivery mandate Idempotent Consumers, and how do database unique constraints implement atomic deduplication?",
    answer: "At-least-once message delivery guarantees zero data loss by retrying messages upon network timeouts or worker crashes, inevitably causing duplicate message deliveries. An Idempotent Consumer ensures that processing duplicate messages produces the identical state as processing them once, implemented via unique constraints on message/event IDs in a deduplication table within the same transaction.",
    explanation: `The Duplicate Delivery Inevitability:
1. Consumer pulls message \`Order #101\` from Kafka.
2. Consumer charges credit card and inserts order into database.
3. Consumer attempts to commit offset to Kafka.
4. Network hiccup or container restart occurs before offset commit succeeds.
5. Replacement consumer pod connects, re-reads uncommitted message \`Order #101\`, and charges the credit card a second time!

Production Idempotency via Deduplication Table:
- Every event carries a globally unique \`eventId\` (UUID generated by producer).
- Consumer inserts the \`eventId\` into a \`processed_events\` table inside the SAME database transaction as the business operation:
\`\`\`sql
BEGIN;
INSERT INTO processed_events (event_id, processed_at) VALUES ('evt_uuid_42', NOW());
UPDATE accounts SET balance = balance + 100 WHERE id = 1;
COMMIT;
\`\`\`
- If duplicate event arrives: the \`INSERT INTO processed_events\` violates the primary key unique constraint and throws an error, rolling back the transaction cleanly. Consumer simply acknowledges message and skips processing.`,
    code: `// Idempotent Consumer Transaction Wrapper in TypeScript
export async function processEventIdempotently(
  eventId: string,
  eventPayload: any,
  businessFn: (trx: any, payload: any) => Promise<void>
) {
  try {
    await db.transaction(async (trx) => {
      // 1. Insert into deduplication table with unique primary key
      const inserted = await trx("processed_events")
        .insert({ event_id: eventId, processed_at: new Date() })
        .onConflict("event_id")
        .ignore();

      if (inserted.rowCount === 0) {
        console.log(\`Event \${eventId} already processed! Skipping duplicate.\`);
        return; // Deduplicated safely!
      }

      // 2. Execute business domain logic
      await businessFn(trx, eventPayload);
    });
  } catch (err) {
    console.error(\`Failed to process event \${eventId}: \${err.message}\`);
    throw err; // Trigger retry
  }
}`,
    recallHint: "At-least-once = duplicates will happen. Dedupe table with unique event_id constraint stops double processing.",
    interviewTip: "In payment or inventory systems, always specify: 'We pair at-least-once Kafka delivery with a database unique constraint on the event ID to guarantee end-to-end exactly-once business semantics.'",
    tags: ["idempotency", "deduplication", "at-least-once", "kafka", "transactions", "event-driven"]
  }),

  createCard({
    idNum: 30,
    category: "Asynchronous Messaging, Event-Driven Choreography & Orchestration",
    concept: "Dead Letter Queues (DLQ) & Poison Pill Quarantine",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a Poison Pill in an event stream, and how do Dead Letter Queues (DLQ) with retry topics prevent consumer crash loops?",
    answer: "A Poison Pill is a corrupted or malformed message that causes consumer code to throw an unhandled exception every time it is parsed; under at-least-once delivery, the consumer crashes, restarts, re-reads the same poison message, and crashes again in an infinite loop. A Dead Letter Queue (DLQ) routes failed messages to an isolated quarantine topic after N retry attempts, allowing the main consumer stream to proceed.",
    explanation: `The Poison Pill Catastrophe:
- Producer accidentally publishes a message with malformed JSON or null in a non-nullable field.
- Consumer reads message -> \`JSON.parse\` throws unhandled exception -> Node.js process crashes.
- Kubernetes restarts the pod -> pod connects to Kafka -> reads the same uncommitted message -> crashes again.
- All consumer pods enter \`CrashLoopBackOff\`, halting message processing for thousands of legitimate users!

Multi-Topic Retry & DLQ Architecture:
1. Main Topic (\`orders\`): Consumer attempts processing.
2. If error occurs: Consumer publishes message to Retry Topic 1 (\`orders.retry-1\`) with a 5-second delay header.
3. If Retry 1 fails: Message published to Retry Topic 2 (\`orders.retry-2\`) with a 30-second delay.
4. If Retry 2 fails: Message routed to Dead Letter Queue (\`orders.dlq\`).
5. Offset committed on main topic: Main consumer pipeline continues processing healthy messages without blocking.
6. Alerting & Triage: PagerDuty alerts on DLQ depth; developers inspect malformed payload, fix bugs, and replay messages via DLQ shovel script.`,
    code: `/*
Multi-Topic Retry & Dead Letter Queue (DLQ) Pipeline:

[ Kafka: orders.v1 ] ──(Failure 1)──> [ Kafka: orders.retry-1 (5s Delay) ]
                                              │
                                              ▼ (Failure 2)
                                      [ Kafka: orders.retry-2 (30s Delay) ]
                                              │
                                              ▼ (Failure 3: Quarantined!)
                                      [ Kafka: orders.DLQ ]
                                              │
                                      (Alerts PagerDuty & awaits human triage)
*/`,
    recallHint: "Poison pill crashes consumer indefinitely. Route to DLQ after 3 retries to keep the line moving.",
    interviewTip: "Always recommend a Multi-Topic Retry architecture (Main -> Retry-1 -> Retry-2 -> DLQ) for Kafka and SQS message processing systems.",
    tags: ["dlq", "dead-letter-queue", "poison-pill", "kafka", "resilience", "messaging"]
  }),

  createCard({
    idNum: 31,
    category: "Asynchronous Messaging, Event-Driven Choreography & Orchestration",
    concept: "Schema Registry & Schema Evolution (Avro, Backward/Forward Compatibility)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the Confluent Schema Registry enforce contract compatibility between Kafka producers and consumers, and what is the difference between Backward, Forward, and Full compatibility?",
    answer: "A Schema Registry centrally stores versioned schemas (Apache Avro, Protobuf) and validates event schemas before producers can publish to Kafka. Backward compatibility ensures newer consumers can read data written by older producers; Forward compatibility ensures older consumers can read data written by newer producers; Full compatibility guarantees bidirectional compatibility, allowing services to upgrade independently in any order.",
    explanation: `Why Schema Registries are Mandatory for Kafka:
- Without schema governance, a developer might change \`user_id\` from an integer to a UUID string.
- When published to Kafka, downstream consumers explode with deserialization runtime errors.

Schema Compatibility Modes:
1. **Backward Compatibility (Default)**:
   - Newer consumer can read data produced by older producer.
   - Evolution Rules: You can delete fields or add *optional* fields with default values.
   - Upgrade Order: Upgrade consumers first, then upgrade producers.
2. **Forward Compatibility**:
   - Older consumer can read data produced by newer producer.
   - Evolution Rules: You can add new fields or delete *optional* fields.
   - Upgrade Order: Upgrade producers first, then upgrade consumers.
3. **Full Compatibility (Bidirectional)**:
   - Combines Backward and Forward compatibility.
   - Services can be deployed and upgraded in ANY order without coordination.
   - Evolution Rules: Only add optional fields with defaults; only delete optional fields with defaults.`,
    code: `// Apache Avro Schema with Default Value for Full Compatibility
{
  "type": "record",
  "name": "OrderEvent",
  "namespace": "com.enterprise.events",
  "fields": [
    { "name": "orderId", "type": "string" },
    { "name": "amount", "type": "double" },
    // Adding optional field with default value guarantees Full Compatibility!
    { "name": "currency", "type": "string", "default": "USD" },
    { "name": "discountCode", "type": ["null", "string"], "default": null }
  ]
}`,
    recallHint: "Backward = new consumer reads old data. Forward = old consumer reads new data. Full = upgrade in any order.",
    interviewTip: "In event-driven system designs, always enforce 'Full Compatibility' in the Schema Registry to ensure that independent microservices can deploy at any time without coordinated lockstep rollouts.",
    tags: ["schema-registry", "avro", "schema-evolution", "kafka", "compatibility", "contracts"]
  }),

  createCard({
    idNum: 32,
    category: "Asynchronous Messaging, Event-Driven Choreography & Orchestration",
    concept: "Message Ordering & Partition Keys in Kafka",
    priority: "must-know",
    difficulty: "must-know",
    question: "How does Apache Kafka guarantee message ordering, why is global total ordering impossible at scale, and how do partition keys preserve entity-level ordering?",
    answer: "Kafka guarantees strict message ordering ONLY within a single partition, NOT across the entire topic. Total global ordering across a topic requires bottlenecking the topic to a single partition, eliminating horizontal scaling. In production, systems achieve high throughput and strict entity ordering by assigning a partition key (e.g., userId or orderId) so all events for that specific entity route to the same partition in order.",
    explanation: `The Myth of Global Total Ordering at Scale:
- If a topic has 32 partitions, 32 consumer instances can process messages concurrently in parallel.
- If you require strict total ordering across all messages worldwide, you must configure the topic with **exactly 1 partition**.
- Result: Only 1 consumer thread can process messages worldwide. Throughput is capped at a few thousand messages/sec, defeating the entire purpose of Kafka!

Entity-Level Ordering with Partition Keys:
- Real-world business rules do NOT require User A's order to be ordered relative to User B's order.
- Business rules require only that **User A's events are strictly ordered relative to User A's other events** (e.g., \`OrderPlaced\` -> \`PaymentCharged\` -> \`OrderShipped\`).
- By setting \`partition_key = userId\`:
  - Kafka hashes: \`hash(userId) % num_partitions\`.
  - All events for User A are guaranteed to append sequentially to the exact same partition.
  - A single consumer thread reads that partition in strict FIFO order, ensuring causal correctness while the rest of the cluster processes other partitions in parallel.`,
    code: `// Publishing with Entity Partition Key in KafkaJS
await kafkaProducer.send({
  topic: "user-lifecycle-events",
  messages: [
    {
      key: "user_uuid_1042", // Partition Key ensures all events for user 1042 land on SAME partition!
      value: JSON.stringify({
        eventType: "USER_ADDRESS_UPDATED",
        street: "123 Market St",
        timestamp: Date.now()
      })
    }
  ]
});`,
    recallHint: "Kafka only orders inside a partition. Use entity ID as partition key for causal ordering with horizontal scale.",
    interviewTip: "Whenever an interviewer asks 'How do we guarantee ordering in Kafka?', immediately clarify: 'We enforce entity-level causal ordering via partition keys (e.g., orderId), while distributing partitions across workers for horizontal scale.'",
    tags: ["kafka", "message-ordering", "partition-keys", "event-driven", "concurrency", "scalability"]
  }),

  createCard({
    idNum: 33,
    category: "Asynchronous Messaging, Event-Driven Choreography & Orchestration",
    concept: "Command Query Responsibility Segregation (CQRS) in Microservices",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why does pairing Event-Driven Architecture with CQRS enable independent read and write scaling in microservices?",
    answer: "CQRS segregates the Write Model (Commands that enforce business invariants in an ACID relational database or Event Store) from the Read Model (Queries targeting denormalized views in Elasticsearch/Redis). Asynchronous events published by the write model update read projections in background streams, allowing read-heavy APIs to scale independently without impacting write throughput.",
    explanation: `Why Single Models Fail at Microservice Scale:
In complex domains (e.g., e-commerce, banking):
- **Write Path (Command)**: Focuses on domain rules, entity validation, foreign key constraints, and transactional consistency. Normalized schemas are ideal.
- **Read Path (Query)**: Focuses on rendering complex UI views, full-text searches, and multi-filter faceted catalog browsing. Requires pre-joined denormalized documents.
- Forcing a single PostgreSQL database schema to serve both leads to bloated indexes that slow down writes and expensive multi-table joins that slow down reads.

CQRS Data Flow:
1. Client sends \`CreateOrderCommand\` -> Command Service -> Validates business invariants -> Commits to PostgreSQL Write DB.
2. PostgreSQL emits \`OrderCreatedEvent\` to Kafka (via Transactional Outbox / Debezium).
3. Projection Consumers:
   - Worker A updates Elasticsearch for full-text order search.
   - Worker B updates Redis for instant user dashboard retrieval.
4. Client sends \`GET /orders?query=laptop\` -> Query Service reads Elasticsearch directly in 3ms.`,
    code: `/*
CQRS Architectural Flow:

[ User Client ]
     ├── (POST /orders - Command) ──> [ Command Service ] ──> [ Write DB (Postgres) ]
     │                                                              │
     │                                                              ▼ (Transactional Outbox)
     │                                                        [ Kafka Event Bus ]
     │                                                              │
     │                                                              ▼ (Async Projection)
     └── (GET /orders - Query)   ──> [ Query Service ]   <── [ Read DB (Elasticsearch) ]
*/`,
    recallHint: "CQRS: Write DB enforces domain rules; Read DB stores denormalized UI views. Synced via Kafka.",
    interviewTip: "Highlight the trade-off of CQRS: Eventual Consistency. The UI must handle the small replication lag gracefully (e.g., optimistic UI rendering).",
    tags: ["cqrs", "event-sourcing", "read-model", "write-model", "elasticsearch", "microservices"]
  }),

  createCard({
    idNum: 34,
    category: "Asynchronous Messaging, Event-Driven Choreography & Orchestration",
    concept: "Event Sourcing: Reconstructing State from Deltas",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Event Sourcing replace CRUD state persistence, and how do Snapshots prevent performance degradation during entity rehydration?",
    answer: "Instead of overwriting rows in a database table (CRUD), Event Sourcing records all state mutations as an append-only sequence of immutable events in an Event Store. The current state is rehydrated by replaying all historical events from genesis. Snapshots take periodic point-in-time state dumps (e.g., every 500 events) so rehydration only needs to replay recent events since the latest snapshot.",
    explanation: `CRUD vs Event Sourcing:
- Traditional CRUD: Bank account balance is stored as \`balance = 750\`. Withdrawing \$50 executes \`UPDATE accounts SET balance = 700\`. Past balance history is permanently destroyed.
- Event Sourcing:
  - Event 1: \`AccountOpened { balance: 500 }\`
  - Event 2: \`FundsDeposited { amount: 300 }\`
  - Event 3: \`FundsWithdrawn { amount: 100 }\`
  - Current State: Evaluated by reducing: $500 + 300 - 100 = 700$.

The Snapshot Optimization:
- If an account has been active for 10 years and accumulated 250,000 events, loading the account into memory requires executing 250,000 event transitions (taking several seconds!).
- **Snapshotting**: Every 500 events, a background process saves a serialized state snapshot to disk: \`{ snapshotVersion: 250000, balance: 700.00 }\`.
- When the account is loaded, the engine loads the snapshot at version 250,000 and replays only the few events that occurred after version 250,000. Rehydration completes in 2ms!`,
    code: `// Event Sourcing Aggregate Rehydration with Snapshotting
export class BankAccount {
  public balance = 0;
  public version = 0;

  // Rehydrate state starting from snapshot, then replay recent deltas
  static rehydrate(snapshot: { version: number; balance: number }, recentEvents: any[]): BankAccount {
    const account = new BankAccount();
    account.version = snapshot.version;
    account.balance = snapshot.balance;

    for (const event of recentEvents) {
      if (event.type === "DEPOSIT") account.balance += event.amount;
      if (event.type === "WITHDRAWAL") account.balance -= event.amount;
      account.version = event.version;
    }

    return account;
  }
}`,
    recallHint: "Event Sourcing: Don't store final state; store the stream of events. Snapshots prevent slow replay.",
    interviewTip: "Event Sourcing is the industry standard for financial ledgers, audit compliance, git version control, and shopping cart checkouts.",
    tags: ["event-sourcing", "snapshots", "rehydration", "event-store", "audit-trail", "eda"]
  }),

  createCard({
    idNum: 35,
    category: "Asynchronous Messaging, Event-Driven Choreography & Orchestration",
    concept: "Message Deduplication at Hyper-Scale: Redis vs DB Constraints",
    priority: "must-know",
    difficulty: "advanced",
    question: "Compare in-memory Redis deduplication filters with relational database unique constraints across latency, throughput, and consistency guarantees.",
    answer: "Database unique constraints provide absolute ACID consistency: the deduplication check and state mutation commit atomically in the same transaction, guaranteeing zero duplicates even across database failovers, but incur disk I/O and row locks; Redis deduplication (SET NX with TTL) executes in sub-millisecond RAM, supporting 100,000+ ops/sec, but risks duplicate processing if Redis evicts keys early or crashes before persistence.",
    explanation: `Trade-off Comparison:
1. Relational Database Unique Constraint:
   - Mechanism: \`INSERT INTO processed_events (event_id) VALUES ('uuid_123');\` inside the business SQL transaction.
   - Guarantee: **100% Mathematically Bulletproof**. If the database transaction commits, the event was processed exactly once. If the transaction rolls back, the deduplication record rolls back with it.
   - Bottleneck: Disk I/O. Limited to database transaction throughput (~5,000 writes/sec per primary).
2. Distributed Redis Filter (SET key NX EX 86400):
   - Mechanism: Before processing, consumer calls Redis \`SET dedupe:event_123 1 NX EX 86400\`. If key exists, drop message immediately.
   - Performance: Blazing fast. Evaluates in $< 1\\text{ms}$, scaling to 150,000+ checks/sec.
   - The Flaw: Redis is decoupled from the downstream database! If Redis sets the key, but the worker crashes before writing to PostgreSQL, the event will NEVER be processed on retry because Redis thinks it already ran!

The Production Hybrid Strategy:
- Use Redis as a fast edge filter to reject 99% of duplicate retries without touching the database.
- Use Database Unique Constraints as the ultimate source-of-truth safety net for financial transactions.`,
    code: `// Fast Redis Pre-Filter + DB Unique Constraint Hybrid Pattern
export async function handleIncomingEvent(event: { id: string; payload: any }) {
  // 1. Fast Edge Filter: Check Redis (Save DB load)
  const isNew = await redis.set(\`dedupe:\${event.id}\`, "1", "NX", "EX", 3600);
  if (!isNew) {
    console.log("Fast-path: Duplicate rejected by Redis filter.");
    return;
  }

  // 2. Strict ACID Safety Net: Database transaction
  await db.transaction(async (trx) => {
    // Unique constraint on event_id guarantees zero duplicate processing
    await trx("processed_events").insert({ event_id: event.id });
    await applyBusinessMutation(trx, event.payload);
  });
}`,
    recallHint: "DB constraints = 100% ACID safety (slower). Redis SET NX = 100k/s RAM speed (risk edge loss). Combine both!",
    interviewTip: "Proposing the Hybrid pattern (Redis fast-check + Database unique constraint safety net) demonstrates senior-level knowledge of balancing throughput against financial accuracy.",
    tags: ["deduplication", "idempotency", "redis", "database-constraints", "acid", "performance"]
  }),

  createCard({
    idNum: 36,
    category: "Asynchronous Messaging, Event-Driven Choreography & Orchestration",
    concept: "Guaranteed Publishing: Polling Publisher with SKIP LOCKED",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does PostgreSQL's 'FOR UPDATE SKIP LOCKED' enable multiple concurrent outbox polling workers to publish events without lock contention or duplicate messages?",
    answer: "Standard SQL 'FOR UPDATE' causes concurrent worker threads to block waiting for the same locked rows, leading to thread contention and serialization bottlenecks; 'FOR UPDATE SKIP LOCKED' instructs PostgreSQL to lock the first batch of rows and immediately skip over any rows currently locked by other workers, allowing dozens of polling instances to consume the outbox table concurrently in parallel.",
    explanation: `The Problem of Multi-Worker Outbox Polling:
- An outbox table contains 50,000 pending event rows.
- To scale throughput, you deploy 10 background polling workers.
- If Worker 1 runs: \`SELECT * FROM outbox WHERE status = 'PENDING' LIMIT 100 FOR UPDATE\`:
- When Worker 2 runs the same query: Worker 2 blocks and freezes until Worker 1 finishes its entire transaction and releases the lock.
- Concurrency drops to 1! Adding more workers provides zero performance benefit and increases lock contention.

The 'SKIP LOCKED' Breakthrough:
- Query: \`SELECT * FROM outbox WHERE status = 'PENDING' ORDER BY id ASC LIMIT 100 FOR UPDATE SKIP LOCKED\`.
- Worker 1 locks rows 1–100.
- Worker 2 executes: sees rows 1–100 are locked, **skips them without blocking**, and locks rows 101–200 immediately!
- Worker 3 locks rows 201–300.
- All 10 workers execute simultaneously at full disk I/O throughput with zero blocking and zero duplicate processing.`,
    code: `// High-Concurrency Outbox Poller with SKIP LOCKED in PostgreSQL
export async function fetchOutboxBatch(db: any, batchSize = 100) {
  // Atomic CTE: Lock available rows, update their status, return to caller
  const query = \`
    WITH claim_rows AS (
      SELECT id, payload
      FROM outbox_events
      WHERE status = 'PENDING'
      ORDER BY id ASC
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    UPDATE outbox_events
    SET status = 'IN_FLIGHT', claimed_at = NOW()
    WHERE id IN (SELECT id FROM claim_rows)
    RETURNING id, payload;
  \`;

  const { rows } = await db.query(query, [batchSize]);
  return rows;
}`,
    recallHint: "SKIP LOCKED: Lets multiple workers read the outbox concurrently by skipping rows locked by peers.",
    interviewTip: "Always mention `SKIP LOCKED` when implementing database-backed queue or outbox polling patterns in PostgreSQL or MySQL 8+.",
    tags: ["outbox-pattern", "skip-locked", "postgresql", "concurrency", "row-locks", "polling"]
  })
];

module.exports = cards;
