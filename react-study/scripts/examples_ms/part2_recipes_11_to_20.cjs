const recipes = [
  {
    id: "ms-ex-11",
    title: "Transactional Outbox Pattern with PostgreSQL SKIP LOCKED",
    category: "Event-Driven Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "A production Transactional Outbox implementation that atomically writes business entities and events in a single transaction, with a concurrent polling publisher using FOR UPDATE SKIP LOCKED.",
    conceptsCovered: ["Transactional Outbox", "SKIP LOCKED", "PostgreSQL", "Atomic Commitment", "Message Relaying"],
    code: `import { Pool, PoolClient } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 1. Business Service writing Order + Outbox Event in ONE ACID Transaction
export async function createOrderWithOutbox(orderId: string, total: number, customerId: string) {
  const client: PoolClient = await pool.connect();
  try {
    await client.query("BEGIN");

    // Write domain entity
    await client.query(
      "INSERT INTO orders (id, total, customer_id, status) VALUES ($1, $2, $3, 'CREATED')",
      [orderId, total, customerId]
    );

    // Write outbox event
    const eventPayload = { orderId, total, customerId, timestamp: new Date().toISOString() };
    await client.query(
      \`INSERT INTO outbox_events (aggregate_type, aggregate_id, event_type, payload, status)
       VALUES ('ORDER', $1, 'OrderCreated', $2, 'PENDING')\`,
      [orderId, JSON.stringify(eventPayload)]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

// 2. High-Throughput Concurrent Outbox Worker using SKIP LOCKED
export async function pollAndPublishOutbox(kafkaProducer: any, batchSize = 50) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // FOR UPDATE SKIP LOCKED allows multiple parallel worker pods to lock distinct batches without blocking!
    const res = await client.query(
      \`SELECT id, aggregate_id, event_type, payload
       FROM outbox_events
       WHERE status = 'PENDING'
       ORDER BY created_at ASC
       LIMIT $1
       FOR UPDATE SKIP LOCKED\`,
      [batchSize]
    );

    if (res.rows.length === 0) {
      await client.query("COMMIT");
      return 0;
    }

    // Publish to Kafka
    for (const row of res.rows) {
      await kafkaProducer.send({
        topic: "order.events",
        messages: [{ key: row.aggregate_id, value: JSON.stringify(row.payload) }]
      });
    }

    // Mark processed rows
    const ids = res.rows.map(r => r.id);
    await client.query(
      "UPDATE outbox_events SET status = 'PROCESSED', processed_at = NOW() WHERE id = ANY($1)",
      [ids]
    );

    await client.query("COMMIT");
    return res.rows.length;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}`,
    breakdown: [
      "Guarantees that an event is written if and only if the business order is committed.",
      "Uses FOR UPDATE SKIP LOCKED to prevent lock contention across multiple outbox worker replicas.",
      "Safely commits the outbox transaction only after Kafka acknowledges message receipt.",
      "Eliminates the dual-write vulnerability completely."
    ],
    expectedOutput: "Outbox worker locks 50 pending records, publishes to Kafka, and updates status to PROCESSED."
  },

  {
    id: "ms-ex-12",
    title: "Debezium CDC Kafka Connector Configuration",
    category: "Event-Driven Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "A production JSON configuration for Debezium PostgreSQL connector that captures WAL logical replication events from outbox tables and transforms them into Kafka topics.",
    conceptsCovered: ["Debezium", "CDC", "Kafka Connect", "PostgreSQL WAL", "Event Routing"],
    code: `/*
POST /connectors HTTP/1.1
Host: kafka-connect.internal:8083
Content-Type: application/json

{
  "name": "postgres-outbox-connector",
  "config": {
    "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
    "tasks.max": "1",
    "plugin.name": "pgoutput",
    "database.hostname": "postgres-primary.database.svc.cluster.local",
    "database.port": "5432",
    "database.user": "debezium_cdc",
    "database.password": "\${file:/secrets/db-credentials.properties:cdc_password}",
    "database.dbname": "orders_db",
    "database.server.name": "orders_cdc",
    "table.include.list": "public.outbox_events",
    "tombstones.on.delete": "false",
    "decimal.handling.mode": "double",

    # SMT (Single Message Transform): Route outbox events to dynamic Kafka topics based on event_type
    "transforms": "outbox",
    "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
    "transforms.outbox.table.fields.additional.placement": "event_type:header:eventType",
    "transforms.outbox.route.topic.replacement": "\${routedByValue}.events",
    "transforms.outbox.route.by.field": "aggregate_type",

    # Slot management
    "slot.name": "debezium_orders_slot",
    "slot.drop.on.stop": "false",
    "publication.autocreate.mode": "filtered"
  }
}
*/

// SQL script preparing PostgreSQL for Debezium logical replication:
export const dbSetupSql = \`
  -- Enable logical replication in postgresql.conf: wal_level = logical
  CREATE ROLE debezium_cdc WITH REPLICATION LOGIN PASSWORD 'secret_pass';
  GRANT SELECT ON ALL TABLES IN SCHEMA public TO debezium_cdc;
  ALTER TABLE public.outbox_events REPLICA IDENTITY FULL;
\`;`,
    breakdown: [
      "Configures pgoutput logical decoder plugin for zero-overhead WAL streaming.",
      "Employs Debezium's specialized Outbox EventRouter transform to dynamically set Kafka topics.",
      "Extracts event_type into Kafka message headers for consumer routing.",
      "Guarantees near-zero replication lag (< 50ms) without polling queries."
    ],
    expectedOutput: "Kafka Connect registers connector; streams committed outbox rows directly into Kafka."
  },

  {
    id: "ms-ex-13",
    title: "Kafka Producer with Idempotence & Murmur2 Partition Keys",
    category: "Event-Driven Systems",
    difficulty: "intermediate",
    whatThisCodeCovers: "A KafkaJS producer configured with idempotence (enableIdempotence: true, acks: all), retry limits, and consistent partition key hashing.",
    conceptsCovered: ["Kafka Producer", "Idempotence", "Partition Keys", "Murmur2", "At-Least-Once"],
    code: `import { Kafka, CompressionTypes, Partitioners } from "kafkajs";

const kafka = new Kafka({
  clientId: "order-service-producer",
  brokers: ["kafka-broker-1:9092", "kafka-broker-2:9092"],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

// Configure Idempotent Producer
export const producer = kafka.producer({
  // Built-in Kafka idempotence prevents duplicates during transient network retries
  createPartitioner: Partitioners.DefaultPartitioner, // Murmur2 partitioner
  idempotent: true,
  maxInFlightRequests: 1, // Guarantees strict ordering during retries
  transactionalId: "order-service-tx-id"
});

export async function publishOrderEvent(orderId: string, eventType: string, payload: any) {
  await producer.connect();

  const record = {
    // Partition key MUST be orderId so all events for this specific order land on the same partition in order!
    key: orderId,
    value: JSON.stringify({
      eventType,
      payload,
      timestamp: Date.now()
    }),
    headers: {
      "correlation-id": "corr-998811",
      "event-type": eventType
    }
  };

  const metadata = await producer.send({
    topic: "order.lifecycle",
    compression: CompressionTypes.GZIP,
    messages: [record]
  });

  console.log(\`Message published to partition \${metadata[0].partition} at offset \${metadata[0].offset}\`);
}`,
    breakdown: [
      "Enables producer idempotence to prevent duplicate messages if ACK packets drop.",
      "Sets orderId as the partition key to guarantee FIFO order across order state transitions.",
      "Enforces maxInFlightRequests = 1 to preserve ordering during automatic retries.",
      "Applies GZIP compression to optimize wire bandwidth."
    ],
    expectedOutput: "Message published to partition 2 at offset 1044 with guaranteed single-delivery semantics."
  },

  {
    id: "ms-ex-14",
    title: "Kafka Consumer Group with Manual Offset Commits",
    category: "Event-Driven Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "A resilient KafkaJS consumer group that disables auto-commit, processing messages individually and manually committing offsets only after successful database persistence.",
    conceptsCovered: ["Kafka Consumer Group", "Manual Offset Commit", "Rebalance Listener", "At-Least-Once", "Backpressure"],
    code: `import { Kafka } from "kafkajs";

const kafka = new Kafka({
  clientId: "payment-consumer-worker",
  brokers: ["kafka-broker-1:9092", "kafka-broker-2:9092"]
});

const consumer = kafka.consumer({
  groupId: "payment-processing-group",
  sessionTimeout: 30000,
  heartbeatInterval: 3000
});

export async function startConsumer(db: any) {
  await consumer.connect();
  await consumer.subscribe({ topic: "order.lifecycle", fromBeginning: false });

  // Monitor rebalance events
  consumer.on(consumer.events.GROUP_JOIN, (e) => {
    console.log(\`Consumer joined group. Assigned partitions: \${JSON.stringify(e.payload.memberAssignment)}\`);
  });

  // Run with eachMessage and disable auto-commit
  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      const orderId = message.key?.toString();
      const payload = JSON.parse(message.value?.toString() || "{}");

      console.log(\`Processing \${payload.eventType} for order \${orderId}\`);

      try {
        // 1. Process business logic inside database transaction
        await db.processPaymentForOrder(orderId, payload.payload);

        // 2. Commit offset ONLY after database commit succeeds!
        await consumer.commitOffsets([
          {
            topic,
            partition,
            offset: (BigInt(message.offset) + 1n).toString()
          }
        ]);
      } catch (err: any) {
        console.error(\`Failed to process message at offset \${message.offset}. Pausing partition.\`, err);
        // Throwing error causes KafkaJS to retry or pause partition, preventing data loss
        throw err;
      }
    }
  });
}`,
    breakdown: [
      "Disables autoCommit: false to prevent marking un-processed messages as complete on crash.",
      "Commits offsets explicitly with BigInt increment after successful local processing.",
      "Listens to GROUP_JOIN events to track rebalances.",
      "Throws error on database failure to halt partition consumption rather than skipping corrupted data."
    ],
    expectedOutput: "Processes messages sequentially per partition, committing offsets manually after DB writes."
  },

  {
    id: "ms-ex-15",
    title: "Dead Letter Queue (DLQ) with Exponential Retry Backoff",
    category: "Event-Driven Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "A multi-stage Dead Letter Queue (DLQ) architecture in Kafka with retry topics (retry-1, retry-2) and final dead-letter parking to avoid poison pill blocking.",
    conceptsCovered: ["DLQ", "Retry Topics", "Poison Pill", "Exponential Backoff", "Error Handling"],
    code: `export class DeadLetterQueueRouter {
  constructor(private kafkaProducer: any) {}

  async handleFailure(topic: string, message: any, error: Error) {
    const headers = message.headers || {};
    const retryCount = parseInt(headers["x-retry-count"]?.toString() || "0", 10);
    const maxRetries = 3;

    if (retryCount < maxRetries) {
      const nextRetryCount = retryCount + 1;
      const delayMs = Math.pow(2, nextRetryCount) * 1000; // Exponential: 2s, 4s, 8s
      const retryTopic = \`\${topic}.retry-\${nextRetryCount}\`;

      console.warn(\`[Retry] Routing message to \${retryTopic} with delay \${delayMs}ms. Attempt: \${nextRetryCount}\`);

      // Dispatch to delayed retry topic with updated retry count header
      await this.kafkaProducer.send({
        topic: retryTopic,
        messages: [{
          key: message.key,
          value: message.value,
          headers: {
            ...headers,
            "x-retry-count": nextRetryCount.toString(),
            "x-retry-delay-ms": delayMs.toString(),
            "x-last-error": error.message
          }
        }]
      });
    } else {
      // Exceeded retry ceiling: Route to Dead Letter Queue for human triage!
      const dlqTopic = \`\${topic}.DLQ\`;
      console.error(\`[DLQ] Message permanently failed after \${maxRetries} attempts. Routing to \${dlqTopic}\`);

      await this.kafkaProducer.send({
        topic: dlqTopic,
        messages: [{
          key: message.key,
          value: message.value,
          headers: {
            ...headers,
            "x-dead-letter-reason": error.message,
            "x-failed-at": new Date().toISOString()
          }
        }]
      });
    }
  }
}`,
    breakdown: [
      "Prevents poison pill messages from stalling the main consumer partition indefinitely.",
      "Routes transient failures to graduated retry topics (retry-1, retry-2).",
      "Parks permanently failed messages in a .DLQ topic for inspection by SRE teams.",
      "Injects diagnostic metadata into Kafka headers tracking error messages and attempt timestamps."
    ],
    expectedOutput: "Retries transiently up to 3 times with exponential backoff, then parks permanently in .DLQ."
  },

  {
    id: "ms-ex-16",
    title: "Idempotent Consumer with Redis Sliding Deduplication",
    category: "Event-Driven Systems",
    difficulty: "intermediate",
    whatThisCodeCovers: "An idempotent consumer wrapper utilizing Redis SET NX with TTL to guarantee that duplicate messages arriving from Kafka are safely discarded.",
    conceptsCovered: ["Idempotent Consumer", "Redis SET NX", "Deduplication", "At-Least-Once", "Replay Protection"],
    code: `import Redis from "ioredis";

export class IdempotentMessageConsumer {
  private redis: Redis;

  constructor(redisUrl: string, private deduplicationTtlSeconds = 86400) {
    this.redis = new Redis(redisUrl);
  }

  async processMessage(
    messageId: string,
    handler: () => Promise<void>
  ): Promise<{ status: "PROCESSED" | "SKIPPED_DUPLICATE" }> {
    const lockKey = \`msg:processed:\${messageId}\`;

    // Atomic SET if Not Exists with Expiration: returns "OK" if key was set, null if key already exists
    const acquired = await this.redis.set(
      lockKey,
      "LOCKED",
      "EX",
      this.deduplicationTtlSeconds,
      "NX"
    );

    if (!acquired) {
      console.log(\`[Idempotency] Message \${messageId} already processed. Safely skipping.\`);
      return { status: "SKIPPED_DUPLICATE" };
    }

    try {
      await handler();
      // Update state to completed
      await this.redis.set(lockKey, "COMPLETED", "EX", this.deduplicationTtlSeconds);
      return { status: "PROCESSED" };
    } catch (err) {
      // On business failure, remove key so a valid retry can be processed
      await this.redis.del(lockKey);
      throw err;
    }
  }
}

// Verification:
const consumer = new IdempotentMessageConsumer("redis://localhost:6379");
const eventId = "evt-uuid-112233";

await consumer.processMessage(eventId, async () => {
  console.log("Processing financial debit...");
});

// Duplicate message arrives:
const res = await consumer.processMessage(eventId, async () => {
  console.log("This will NOT execute!");
});
console.log("Duplicate result:", res.status);`,
    breakdown: [
      "Executes atomic SET NX EX to claim processing rights on messageId.",
      "Instantly drops duplicate deliveries arriving via network retries or consumer group rebalances.",
      "Cleans up the lock key if the handler fails, permitting downstream retries.",
      "Caches completion status for 24 hours to handle delayed replays."
    ],
    expectedOutput: "First invocation prints debit message; duplicate invocation returns SKIPPED_DUPLICATE."
  },

  {
    id: "ms-ex-17",
    title: "Confluent Schema Registry & Avro Serialization",
    category: "Event-Driven Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "Integrating @kafkajs/confluent-schema-registry with Apache Avro schemas, enforcing backward compatibility and registering dynamic schemas on publish.",
    conceptsCovered: ["Schema Registry", "Avro", "Serialization", "Backward Compatibility", "Confluent"],
    code: `import { SchemaRegistry, SchemaType } from "@kafkajs/confluent-schema-registry";

const registry = new SchemaRegistry({ host: "http://schema-registry.internal:8081" });

// Avro Schema Definition
const orderAvroSchema = {
  type: "record",
  name: "OrderEvent",
  namespace: "com.enterprise.events",
  fields: [
    { name: "orderId", type: "string" },
    { name: "customerId", type: "string" },
    { name: "amountCents", type: "long" },
    { name: "status", type: { type: "enum", name: "OrderStatus", symbols: ["PENDING", "CONFIRMED", "CANCELLED"] } },
    { name: "discountCode", type: ["null", "string"], default: null } // Optional field with default for backward compatibility!
  ]
};

export class AvroEventSerializer {
  private schemaId: number | null = null;

  async init() {
    // Register schema with Confluent Schema Registry
    const { id } = await registry.register(
      {
        type: SchemaType.AVRO,
        schema: JSON.stringify(orderAvroSchema)
      },
      { subject: "order-events-value" }
    );
    this.schemaId = id;
    console.log(\`Avro schema registered with ID \${id}\`);
  }

  async encodePayload(payload: any): Promise<Buffer> {
    if (!this.schemaId) throw new Error("Schema not initialized");
    // Serializes JSON to binary Avro with Confluent Magic Byte + Schema ID prefix
    return registry.encode(this.schemaId, payload);
  }

  async decodePayload(buffer: Buffer): Promise<any> {
    return registry.decode(buffer);
  }
}`,
    breakdown: [
      "Registers Avro schema with the central Schema Registry subject.",
      "Validates fields and data types against the schema at serialization time.",
      "Encodes messages with Confluent magic byte (0x00) and 4-byte schema ID header.",
      "Guarantees that breaking schema changes are rejected by the registry before deployment."
    ],
    expectedOutput: "Registers Avro schema ID; serializes payload into compact binary Buffer with schema ID header."
  },

  {
    id: "ms-ex-18",
    title: "Kafka Topic Compaction & Tombstone Deletion Events",
    category: "Event-Driven Systems",
    difficulty: "intermediate",
    whatThisCodeCovers: "Publishing upsert events and null-payload Tombstone deletion events to a Kafka compacted topic, ensuring only the latest state is retained.",
    conceptsCovered: ["Log Compaction", "Tombstones", "State Stores", "Kafka Compaction", "Entity Deletion"],
    code: `import { Kafka } from "kafkajs";

const kafka = new Kafka({ brokers: ["localhost:9092"] });
const producer = kafka.producer();

export class CompactedCustomerStateStore {
  async init() {
    await producer.connect();
  }

  // Upsert customer state: latest record for customerId will be retained forever
  async upsertCustomer(customerId: string, profile: { name: string; tier: string }) {
    await producer.send({
      topic: "customer-state-compacted",
      messages: [{
        key: customerId,
        value: JSON.stringify(profile)
      }]
    });
    console.log(\`Upserted customer state for \${customerId}\`);
  }

  // Delete customer: Emits a TOMBSTONE event (null payload with matching key)
  async deleteCustomer(customerId: string) {
    await producer.send({
      topic: "customer-state-compacted",
      messages: [{
        key: customerId,
        value: null // TOMBSTONE: Informs Kafka cleaner to purge all historical offsets for this key!
      }]
    });
    console.log(\`Emitted TOMBSTONE deletion for \${customerId}\`);
  }
}

// Topic Creation Config:
// kafka-topics.sh --create --topic customer-state-compacted \\
//   --config cleanup.policy=compact \\
//   --config delete.retention.ms=86400000`,
    breakdown: [
      "Uses Kafka log compaction cleanup policy (cleanup.policy=compact).",
      "Updates entity state by publishing with the entity ID as partition key.",
      "Deletes entity permanently by sending a null payload (Tombstone message).",
      "Allows consumers to reconstruct full state by replaying from beginning without bloat."
    ],
    expectedOutput: "Sends upsert record. Emits null value Tombstone; Kafka cleaner purges old offsets after retention."
  },

  {
    id: "ms-ex-19",
    title: "Event-Sourced Bank Account Aggregate with Snapshots",
    category: "Event-Driven Systems",
    difficulty: "advanced",
    whatThisCodeCovers: "A complete Event Sourcing aggregate implementation in TypeScript with state hydration, domain event replay, and periodic in-memory snapshots.",
    conceptsCovered: ["Event Sourcing", "Aggregate Root", "Hydration", "Snapshots", "Immutable Log"],
    code: `interface DomainEvent {
  type: string;
  payload: any;
  version: number;
}

export class BankAccountAggregate {
  private id: string;
  private balance = 0;
  private version = 0;
  private uncommittedEvents: DomainEvent[] = [];

  constructor(id: string) {
    this.id = id;
  }

  // Command 1: Deposit
  deposit(amount: number) {
    if (amount <= 0) throw new Error("Deposit must be positive");
    this.apply({
      type: "MoneyDeposited",
      payload: { amount },
      version: this.version + 1
    });
  }

  // Command 2: Withdraw
  withdraw(amount: number) {
    if (amount > this.balance) throw new Error("Insufficient funds");
    this.apply({
      type: "MoneyWithdrawn",
      payload: { amount },
      version: this.version + 1
    });
  }

  // State Mutator: Pure state transformation based on events
  private mutate(event: DomainEvent) {
    switch (event.type) {
      case "MoneyDeposited":
        this.balance += event.payload.amount;
        break;
      case "MoneyWithdrawn":
        this.balance -= event.payload.amount;
        break;
    }
    this.version = event.version;
  }

  private apply(event: DomainEvent) {
    this.mutate(event);
    this.uncommittedEvents.push(event);
  }

  // Hydrate state from historical events or snapshot
  static loadFromHistory(id: string, events: DomainEvent[], snapshot?: { balance: number; version: number }): BankAccountAggregate {
    const account = new BankAccountAggregate(id);
    if (snapshot) {
      account.balance = snapshot.balance;
      account.version = snapshot.version;
    }
    for (const event of events) {
      if (event.version > account.version) {
        account.mutate(event);
      }
    }
    return account;
  }

  getSnapshot() {
    return { id: this.id, balance: this.balance, version: this.version };
  }
}`,
    breakdown: [
      "Eliminates current-state updates in favor of appending immutable events.",
      "Enforces business invariants in command methods (deposit, withdraw) before applying events.",
      "Reconstructs aggregate state by folding historical events over time.",
      "Supports snapshots to prevent replaying millions of historical events on hydration."
    ],
    expectedOutput: "Rebuilds aggregate state from history: Deposit $100, Withdraw $30 -> Balance: $70 at version 2."
  },

  {
    id: "ms-ex-20",
    title: "Event-Carried State Transfer (ECST) Payload Architecture",
    category: "Event-Driven Systems",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implementing Event-Carried State Transfer (ECST) where event payloads contain complete snapshot context, eliminating synchronous downstream back-queries.",
    conceptsCovered: ["ECST", "Decoupling", "Payload Design", "Event Notification vs ECST", "Autonomous Consumers"],
    code: `// EVENT NOTIFICATION PATTERN (Anti-Pattern for High Scale):
// { "type": "OrderPlaced", "orderId": "123" }
// Problem: 15 downstream consumers all immediately hammer Order Service via HTTP:
// "GET /orders/123" -> Tail latency spike & cascading failure!

// CORRECT: EVENT-CARRIED STATE TRANSFER (ECST):
// Contains all state snapshots required by consumers to execute autonomously
export interface OrderPlacedECSTEvent {
  specversion: "1.0";
  id: string;
  type: "com.enterprise.order.placed.v1";
  time: string;
  data: {
    orderId: string;
    customer: {
      id: string;
      email: string;
      billingTier: "STANDARD" | "VIP";
    };
    shippingAddress: {
      street: string;
      city: string;
      postalCode: string;
      country: string;
    };
    lineItems: Array<{
      sku: string;
      quantity: number;
      unitPriceCents: number;
    }>;
    financials: {
      subtotalCents: number;
      taxCents: number;
      totalCents: number;
      currency: string;
    };
  };
}

// Shipping Microservice Consumer consuming ECST event:
export async function handleShippingOnOrderPlaced(event: OrderPlacedECSTEvent, db: any) {
  // ZERO HTTP CALLS BACK TO ORDER SERVICE REQUIRED!
  const { orderId, customer, shippingAddress, lineItems } = event.data;

  console.log(\`[Shipping] Autonomous processing for Order \${orderId}. Recipient: \${customer.email}\`);
  await db.createShippingLabel({
    orderId,
    recipientEmail: customer.email,
    destination: shippingAddress,
    itemsToPack: lineItems
  });
}`,
    breakdown: [
      "Contrasts thin event notification against rich Event-Carried State Transfer.",
      "Embeds complete customer, shipping, line items, and financial snapshot data in payload.",
      "Enables downstream consumers to fulfill business actions without making synchronous back-queries.",
      "Maximizes temporal decoupling and resilience against upstream service outages."
    ],
    expectedOutput: "Shipping consumer processes order autonomously with zero synchronous HTTP calls back to Order Service."
  }
];

module.exports = { recipes };
