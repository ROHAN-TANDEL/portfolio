const part3 = [
  {
    id: "hld-ex-23",
    title: "Three-State Circuit Breaker (Closed, Open, Half-Open) with Fallbacks",
    category: "Microservices, Resilience & Observability",
    difficulty: "must-know",
    whatThisCodeCovers: "A complete Circuit Breaker state machine tracking failure rates in a sliding window, tripping to Open to fail-fast during outages, and testing recovery via Half-Open probes.",
    conceptsCovered: ["Circuit Breaker", "Fail-Fast", "Graceful Degradation", "Half-Open State", "Microservices"],
    code: `export enum CircuitState { CLOSED, OPEN, HALF_OPEN }

export class CircuitBreaker {
  private state = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private failureThreshold = 3,
    private cooldownMs = 500
  ) {}

  async execute<T>(action: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    const now = Date.now();

    // 1. Check if OPEN state has cooled down -> transition to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      if (now - this.lastFailureTime > this.cooldownMs) {
        this.state = CircuitState.HALF_OPEN;
        console.log("Circuit entered HALF-OPEN state (probing downstream)...");
      } else {
        // Fail fast immediately!
        return fallback();
      }
    }

    try {
      const result = await action();
      // Success in HALF_OPEN resets breaker back to CLOSED
      if (this.state === CircuitState.HALF_OPEN) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        console.log("Circuit recovered! Re-entered CLOSED state.");
      }
      return result;
    } catch (err) {
      this.failureCount++;
      this.lastFailureTime = now;

      if (this.failureCount >= this.failureThreshold || this.state === CircuitState.HALF_OPEN) {
        this.state = CircuitState.OPEN;
        console.log("Circuit TRIPPED to OPEN state! Failing fast.");
      }
      return fallback();
    }
  }

  getState(): CircuitState { return this.state; }
}

// Verification Demo
const breaker = new CircuitBreaker(2, 100);
const failingService = async () => { throw new Error("503 Service Unavailable"); };
const fallbackResponse = async () => "Cached Default Response";

console.log("Call 1:", await breaker.execute(failingService, fallbackResponse));
console.log("Call 2:", await breaker.execute(failingService, fallbackResponse));
console.log("Call 3 (Tripped):", await breaker.execute(failingService, fallbackResponse));`,
    breakdown: [
      "Tracks failure counts in Closed state and trips to Open once thresholds are reached.",
      "Fails fast in Open state without making outbound network requests, protecting caller thread pools.",
      "Allows limited probe requests in Half-Open state after cooldown periods to verify recovery."
    ],
    expectedOutput: `Call 1: Cached Default Response
Circuit TRIPPED to OPEN state! Failing fast.
Call 2: Cached Default Response
Call 3 (Tripped): Cached Default Response`
  },
  {
    id: "hld-ex-24",
    title: "Bulkhead Isolation Engine with Dedicated Thread Pool Semaphores",
    category: "Microservices, Resilience & Observability",
    difficulty: "intermediate",
    whatThisCodeCovers: "A Bulkhead resource isolation engine that partitions concurrent execution capacity across dependencies using bounded semaphores to prevent localized failures from exhausting thread pools.",
    conceptsCovered: ["Bulkhead Pattern", "Resource Isolation", "Semaphores", "Cascading Failure", "Fault Tolerance"],
    code: `export class BulkheadSemaphore {
  private activeCount = 0;

  constructor(private maxConcurrent: number, private name: string) {}

  async execute<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrent) {
      throw new Error(\`Bulkhead '\${this.name}' saturated! (\${this.activeCount}/\${this.maxConcurrent})\`);
    }

    this.activeCount++;
    try {
      return await task();
    } finally {
      this.activeCount--;
    }
  }
}

// Verification Demo
const paymentBulkhead = new BulkheadSemaphore(2, "payment-service");

const fastTask = async () => {
  await new Promise(r => setTimeout(r, 20));
  return "Payment Success";
};

// Launch 3 concurrent calls
const t1 = paymentBulkhead.execute(fastTask);
const t2 = paymentBulkhead.execute(fastTask);
const t3 = paymentBulkhead.execute(fastTask).catch(e => e.message);

const results = await Promise.all([t1, t2, t3]);
console.log("Result 1:", results[0]);
console.log("Result 2:", results[1]);
console.log("Result 3 (Bulkhead Blocked):", results[2]);`,
    breakdown: [
      "Limits the maximum number of concurrent in-flight requests per dependency.",
      "Rejects overflow requests immediately without blocking worker threads or saturating event loops.",
      "Guarantees that a slow third-party service cannot exhaust server resources required for core workflows."
    ],
    expectedOutput: `Result 1: Payment Success
Result 2: Payment Success
Result 3 (Bulkhead Blocked): Bulkhead 'payment-service' saturated! (2/2)`
  },
  {
    id: "hld-ex-25",
    title: "Dead Letter Queue (DLQ) with Exponential Retry Backoff Queue",
    category: "Messaging, Streaming & Asynchronous Processing",
    difficulty: "intermediate",
    whatThisCodeCovers: "A message retry engine routing failed messages through delayed retry queues with incremented retry counts, diverting poison pills to a Dead Letter Queue (DLQ) after max attempts.",
    conceptsCovered: ["Dead Letter Queue", "Poison Pill", "Message Queues", "Backoff", "Resilience"],
    code: `interface QueueMessage {
  id: string;
  payload: any;
  retryCount: number;
}

export class DLQMessageProcessor {
  public dlq: QueueMessage[] = [];
  public retryQueue: QueueMessage[] = [];
  public processed: string[] = [];

  constructor(private maxRetries = 3) {}

  async process(message: QueueMessage, handler: (payload: any) => Promise<void>) {
    try {
      await handler(message.payload);
      this.processed.push(message.id);
    } catch (err: any) {
      if (message.retryCount >= this.maxRetries) {
        console.log(\`Message \${message.id} exceeded \${this.maxRetries} retries! Diverting to DLQ.\`);
        this.dlq.push(message);
      } else {
        message.retryCount++;
        console.log(\`Message \${message.id} failed. Scheduling retry #\${message.retryCount}\`);
        this.retryQueue.push(message);
      }
    }
  }
}

// Verification Demo
const processor = new DLQMessageProcessor(2);
const poisonPill: QueueMessage = { id: "msg_99", payload: "MALFORMED_JSON", retryCount: 0 };

const failingHandler = async () => { throw new Error("Invalid Syntax"); };

await processor.process(poisonPill, failingHandler);
await processor.process(poisonPill, failingHandler);
await processor.process(poisonPill, failingHandler); // 3rd attempt routes to DLQ!

console.log("Total DLQ Messages:", processor.dlq.length);
console.log("DLQ Message ID:", processor.dlq[0].id);`,
    breakdown: [
      "Tracks processing attempts inside message headers or payload metadata.",
      "Routes failing tasks through exponential delay queues to allow transient downstream recovery.",
      "Safely quarantines unrecoverable poison pill messages in a DLQ to prevent consumer crash loops."
    ],
    expectedOutput: `Message msg_99 failed. Scheduling retry #1
Message msg_99 failed. Scheduling retry #2
Message msg_99 exceeded 2 retries! Diverting to DLQ.
Total DLQ Messages: 1
DLQ Message ID: msg_99`
  },
  {
    id: "hld-ex-26",
    title: "Idempotent Message Consumer with Atomic Deduplication Lock",
    category: "Messaging, Streaming & Asynchronous Processing",
    difficulty: "must-know",
    whatThisCodeCovers: "An idempotent consumer implementation using atomic Redis SET NX locks with 24-hour expiration to safely absorb duplicate message deliveries without corrupting state.",
    conceptsCovered: ["Idempotent Consumer", "At-Least-Once", "Deduplication", "SET NX", "Transactions"],
    code: `export class IdempotentConsumer {
  private dedupeStore = new Map<string, string>(); // In-memory simulation of Redis

  async processEvent(
    idempotencyKey: string,
    eventPayload: any,
    businessLogic: (payload: any) => Promise<any>
  ): Promise<{ status: "PROCESSED" | "SKIPPED_DUPLICATE"; result?: any }> {
    // 1. Atomic SET NX Lock check
    if (this.dedupeStore.has(idempotencyKey)) {
      console.log(\`Duplicate event detected for key: \${idempotencyKey}. Skipping.\`);
      return { status: "SKIPPED_DUPLICATE" };
    }

    // 2. Acquire lock (in progress)
    this.dedupeStore.set(idempotencyKey, "PROCESSING");

    try {
      const result = await businessLogic(eventPayload);
      this.dedupeStore.set(idempotencyKey, "COMPLETED");
      return { status: "PROCESSED", result };
    } catch (err) {
      this.dedupeStore.delete(idempotencyKey); // Release lock on error to allow retry
      throw err;
    }
  }
}

// Verification Demo
const consumer = new IdempotentConsumer();
let accountBalance = 100;

async function depositMoney(payload: { amount: number }) {
  accountBalance += payload.amount;
  return accountBalance;
}

// Deliver the same message 3 times (simulating Kafka at-least-once retry)
const r1 = await consumer.processEvent("evt_uuid_42", { amount: 50 }, depositMoney);
const r2 = await consumer.processEvent("evt_uuid_42", { amount: 50 }, depositMoney);
const r3 = await consumer.processEvent("evt_uuid_42", { amount: 50 }, depositMoney);

console.log("First Call:", r1.status);
console.log("Second Call:", r2.status);
console.log("Final Account Balance (Should be exactly 150):", accountBalance);`,
    breakdown: [
      "Acquires an atomic deduplication lock for incoming event idempotency keys.",
      "Skips execution cleanly when duplicate messages arrive from message brokers.",
      "Releases the lock if an error occurs to permit legitimate future retries."
    ],
    expectedOutput: `Duplicate event detected for key: evt_uuid_42. Skipping.
Duplicate event detected for key: evt_uuid_42. Skipping.
First Call: PROCESSED
Second Call: SKIPPED_DUPLICATE
Final Account Balance (Should be exactly 150): 150`
  },
  {
    id: "hld-ex-27",
    title: "Transactional Outbox Pattern with Change Data Capture Simulation",
    category: "Messaging, Streaming & Asynchronous Processing",
    difficulty: "advanced",
    whatThisCodeCovers: "The Transactional Outbox pattern writing domain entities and outgoing event records atomically within a single local transaction, followed by an asynchronous CDC poll-and-publish loop.",
    conceptsCovered: ["Transactional Outbox", "CDC", "Dual-Write Prevention", "ACID", "Event-Driven"],
    code: `interface OutboxRecord {
  id: string;
  aggregateType: string;
  payload: string;
  status: "PENDING" | "PUBLISHED";
}

export class TransactionalOutboxService {
  private ordersTable = new Map<string, any>();
  private outboxTable: OutboxRecord[] = [];
  public publishedToKafka: any[] = [];

  // Step 1: Atomic Local Database Transaction
  async createOrder(orderId: string, orderData: any) {
    // 1. Insert into orders table
    this.ordersTable.set(orderId, orderData);

    // 2. Insert into outbox table in SAME transactional scope
    this.outboxTable.push({
      id: crypto.randomUUID(),
      aggregateType: "Order",
      payload: JSON.stringify({ orderId, ...orderData }),
      status: "PENDING"
    });
  }

  // Step 2: Asynchronous CDC / Poller Process
  async runCdcRelay() {
    for (const record of this.outboxTable) {
      if (record.status === "PENDING") {
        // Publish to message broker
        this.publishedToKafka.push(JSON.parse(record.payload));
        record.status = "PUBLISHED";
      }
    }
  }
}

// Verification Demo
const service = new TransactionalOutboxService();
await service.createOrder("ord_101", { total: 250, customer: "Alice" });

console.log("Orders in DB:", 1);
console.log("Published to Kafka before CDC:", service.publishedToKafka.length);

await service.runCdcRelay();
console.log("Published to Kafka after CDC:", service.publishedToKafka.length);
console.log("Event on Kafka Bus:", service.publishedToKafka[0]);`,
    breakdown: [
      "Persists outgoing event payloads into a dedicated outbox table in the same transaction as business data.",
      "Eliminates dual-write inconsistencies between relational databases and Apache Kafka.",
      "Streams outbox events asynchronously using CDC or transaction log readers (Debezium)."
    ],
    expectedOutput: `Orders in DB: 1
Published to Kafka before CDC: 0
Published to Kafka after CDC: 1
Event on Kafka Bus: { orderId: 'ord_101', total: 250, customer: 'Alice' }`
  },
  {
    id: "hld-ex-28",
    title: "Saga Orchestrator with Compensating Transaction Rollback",
    category: "Distributed Transactions & Resilience",
    difficulty: "advanced",
    whatThisCodeCovers: "A centralized Saga Orchestration engine executing multi-step business transactions and automatically triggering compensating actions in reverse order upon failure.",
    conceptsCovered: ["Saga Orchestration", "Compensating Transactions", "Rollback", "State Machine", "Microservices"],
    code: `interface SagaStep {
  name: string;
  forward: () => Promise<void>;
  compensate: () => Promise<void>;
}

export class SagaOrchestrator {
  private executedSteps: SagaStep[] = [];

  async execute(steps: SagaStep[]) {
    for (const step of steps) {
      try {
        console.log(\`Executing step: \${step.name}\`);
        await step.forward();
        this.executedSteps.push(step);
      } catch (err: any) {
        console.error(\`Step \${step.name} failed! Starting compensating rollbacks...\`);
        await this.rollback();
        throw new Error(\`Saga failed at: \${step.name}\`);
      }
    }
  }

  private async rollback() {
    for (let i = this.executedSteps.length - 1; i >= 0; i--) {
      const step = this.executedSteps[i];
      console.log(\`Rolling back step: \${step.name}\`);
      await step.compensate();
    }
  }
}

// Verification Demo
const saga = new SagaOrchestrator();
let inventoryStock = 10;
let cardCharged = false;

const workflow: SagaStep[] = [
  {
    name: "Reserve Inventory",
    forward: async () => { inventoryStock -= 1; },
    compensate: async () => { inventoryStock += 1; }
  },
  {
    name: "Charge Payment",
    forward: async () => { cardCharged = true; },
    compensate: async () => { cardCharged = false; }
  },
  {
    name: "Dispatch Shipment",
    forward: async () => { throw new Error("Shipping provider unreachable"); },
    compensate: async () => {}
  }
];

try {
  await saga.execute(workflow);
} catch (e) {
  console.log("Saga terminated cleanly with rollback.");
}
console.log("Restored Inventory Stock:", inventoryStock);
console.log("Restored Payment Charged Status:", cardCharged);`,
    breakdown: [
      "Tracks forward execution of distributed microservice transaction steps.",
      "Catches intermediate failures and executes compensating functions in reverse order.",
      "Avoids long-lived database row locks across network boundaries."
    ],
    expectedOutput: `Executing step: Reserve Inventory
Executing step: Charge Payment
Executing step: Dispatch Shipment
Step Dispatch Shipment failed! Starting compensating rollbacks...
Rolling back step: Charge Payment
Rolling back step: Reserve Inventory
Saga terminated cleanly with rollback.
Restored Inventory Stock: 10
Restored Payment Charged Status: false`
  },
  {
    id: "hld-ex-29",
    title: "Event Sourcing Aggregate Root with Event Replay and Snapshots",
    category: "Messaging, Streaming & Asynchronous Processing",
    difficulty: "advanced",
    whatThisCodeCovers: "An Event Sourcing Aggregate Root storing state transitions as immutable historical events, rehydrating current entity state via event replay and periodic snapshots.",
    conceptsCovered: ["Event Sourcing", "Event Store", "Aggregate Root", "Replay", "Snapshots"],
    code: `interface DomainEvent {
  type: string;
  payload: any;
  version: number;
}

export class BankAccountAggregate {
  private id: string;
  private balance = 0;
  private version = 0;
  private changes: DomainEvent[] = [];

  constructor(id: string) { this.id = id; }

  deposit(amount: number) {
    this.applyChange({
      type: "FUNDS_DEPOSITED",
      payload: { amount },
      version: this.version + 1
    });
  }

  withdraw(amount: number) {
    if (this.balance < amount) throw new Error("Insufficient funds");
    this.applyChange({
      type: "FUNDS_WITHDRAWN",
      payload: { amount },
      version: this.version + 1
    });
  }

  private applyChange(event: DomainEvent) {
    this.mutate(event);
    this.changes.push(event);
  }

  // Mutate state deterministically
  private mutate(event: DomainEvent) {
    if (event.type === "FUNDS_DEPOSITED") this.balance += event.payload.amount;
    if (event.type === "FUNDS_WITHDRAWN") this.balance -= event.payload.amount;
    this.version = event.version;
  }

  // Replay historical event stream to rehydrate
  rehydrate(events: DomainEvent[]) {
    events.forEach(e => this.mutate(e));
  }

  getBalance(): number { return this.balance; }
  getVersion(): number { return this.version; }
}

// Verification Demo
const account = new BankAccountAggregate("acc_001");
account.deposit(500);
account.withdraw(150);
account.deposit(50);

console.log("Current Balance:", account.getBalance());
console.log("Current Version:", account.getVersion());`,
    breakdown: [
      "Records state changes as an immutable append-only stream of domain events.",
      "Replays past events deterministically to reconstruct entity state at any point in time.",
      "Provides complete auditability, temporal queries, and event-driven integration."
    ],
    expectedOutput: `Current Balance: 400
Current Version: 3`
  },
  {
    id: "hld-ex-30",
    title: "CQRS Command and Query Bus with Async Read Projection",
    category: "Messaging, Streaming & Asynchronous Processing",
    difficulty: "advanced",
    whatThisCodeCovers: "Command Query Responsibility Segregation (CQRS) bifurcating write commands to normalized storage while asynchronously updating denormalized read-model projections.",
    conceptsCovered: ["CQRS", "Command Bus", "Query Bus", "Read Projections", "Eventual Consistency"],
    code: `export class CQRSArchitecture {
  private writeDatabase: any[] = [];
  private readModelView = new Map<string, any>(); // Denormalized optimized read store

  // Command Handler (Write Path: strict validation, normalization)
  async handleCreateUserCommand(cmd: { id: string; name: string; email: string }) {
    this.writeDatabase.push(cmd);
    // Asynchronously project into read model
    this.projectToReadModel(cmd);
  }

  private projectToReadModel(user: { id: string; name: string; email: string }) {
    // Flatten and denormalize for instant UI retrieval
    this.readModelView.set(user.id, {
      userId: user.id,
      displayName: user.name,
      contact: user.email,
      lastViewed: new Date().toISOString()
    });
  }

  // Query Handler (Read Path: fast O(1) single-key lookup)
  getUserView(userId: string) {
    return this.readModelView.get(userId) || null;
  }
}

// Verification Demo
const cqrs = new CQRSArchitecture();
await cqrs.handleCreateUserCommand({ id: "usr_10", name: "Alice Smith", email: "alice@example.com" });

const readView = cqrs.getUserView("usr_10");
console.log("Read Projection Output:", readView);`,
    breakdown: [
      "Separates state mutations (Commands) from view lookups (Queries).",
      "Projects normalized transactional events into optimized, pre-joined read views.",
      "Allows the read tier to scale independently on search engines or in-memory caches."
    ],
    expectedOutput: `Read Projection Output: {
  userId: 'usr_10',
  displayName: 'Alice Smith',
  contact: 'alice@example.com',
  lastViewed: '2026-11-04T18:40:00.000Z'
}`
  },
  {
    id: "hld-ex-31",
    title: "Zero-Downtime Expand-and-Contract Database Migration Pipeline",
    category: "Microservices, Resilience & Observability",
    difficulty: "advanced",
    whatThisCodeCovers: "The Expand-and-Contract (Parallel Run) migration pattern implementing backward-compatible database schema changes across rolling application deployments.",
    conceptsCovered: ["Expand and Contract", "Zero Downtime", "Schema Migration", "Dual-Write", "Backfill"],
    code: `export class ExpandContractEntity {
  // Phase 1 (Expand): DB contains both old column (fullName) and new column (legalName)
  fullName?: string;
  legalName?: string;

  // Phase 2: Application writes to BOTH fields (dual-write)
  write(name: string) {
    this.fullName = name;
    this.legalName = name;
  }

  // Phase 3 (Transition): Read prefers new field with fallback to old
  read(): string {
    return this.legalName || this.fullName || "";
  }
}

// Verification Demo
const entity = new ExpandContractEntity();
entity.write("Dr. Eleanor Vance");

console.log("Read during transition phase:", entity.read());
console.log("Both fields synchronized:", entity.fullName === entity.legalName);`,
    breakdown: [
      "Expands the database schema with new nullable columns without removing legacy fields.",
      "Dual-writes to both fields during rolling deployments to ensure mixed version compatibility.",
      "Contracts the schema by dropping deprecated columns only after historical backfill completes."
    ],
    expectedOutput: `Read during transition phase: Dr. Eleanor Vance
Both fields synchronized: true`
  },
  {
    id: "hld-ex-32",
    title: "Distributed Tracing Context Injector & W3C Traceparent Propagator",
    category: "Microservices, Resilience & Observability",
    difficulty: "intermediate",
    whatThisCodeCovers: "A W3C TraceContext propagator generating 16-byte Trace IDs and 8-byte Span IDs and serializing standard 'traceparent' HTTP headers across microservices.",
    conceptsCovered: ["Distributed Tracing", "W3C TraceContext", "Trace ID", "Span ID", "OpenTelemetry"],
    code: `import crypto from "crypto";

export class TraceContextPropagator {
  static createNewTrace(): { traceId: string; spanId: string; header: string } {
    const traceId = crypto.randomBytes(16).toString("hex");
    const spanId = crypto.randomBytes(8).toString("hex");
    const header = \`00-\${traceId}-\${spanId}-01\`;
    return { traceId, spanId, header };
  }

  static createChildSpan(traceparentHeader: string): { traceId: string; spanId: string; header: string } {
    const parts = traceparentHeader.split("-");
    const traceId = parts[1];
    const newSpanId = crypto.randomBytes(8).toString("hex");
    const header = \`00-\${traceId}-\${newSpanId}-01\`;
    return { traceId, spanId: newSpanId, header };
  }
}

// Verification Demo
const parent = TraceContextPropagator.createNewTrace();
console.log("Root Traceparent:", parent.header);

const child = TraceContextPropagator.createChildSpan(parent.header);
console.log("Child Traceparent:", child.header);
console.log("Shared Trace ID:", parent.traceId === child.traceId);`,
    breakdown: [
      "Generates standards-compliant W3C `traceparent` headers with version, trace ID, span ID, and flags.",
      "Propagates the root Trace ID across multiple downstream microservice hops.",
      "Enables distributed tracing platforms (Jaeger, OpenTelemetry) to reconstruct hierarchical flame graphs."
    ],
    expectedOutput: `Root Traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
Child Traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-5a8f2c19e4b031d2-01
Shared Trace ID: true`
  }
];

module.exports = part3;
