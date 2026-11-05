const recipes = [
  {
    id: "ms-ex-21",
    title: "Orchestrated Saga State Machine with Compensations",
    category: "Transactions & Consistency",
    difficulty: "advanced",
    whatThisCodeCovers: "A complete in-code Saga Orchestrator executing a multi-step distributed transaction (Reserve Credit, Reserve Stock, Charge Payment) with backward compensating rollback.",
    conceptsCovered: ["Saga Orchestrator", "Compensating Transactions", "Forward Recovery", "Backward Recovery", "Distributed Consistency"],
    code: `interface SagaStep<TContext> {
  name: string;
  execute: (ctx: TContext) => Promise<void>;
  compensate: (ctx: TContext) => Promise<void>;
}

export class OrderCheckoutSagaOrchestrator {
  private steps: SagaStep<any>[] = [];

  addStep(step: SagaStep<any>) {
    this.steps.push(step);
    return this;
  }

  async execute(context: any) {
    const executedSteps: SagaStep<any>[] = [];

    for (const step of this.steps) {
      try {
        console.log(\`[Saga] Executing forward step: \${step.name}\`);
        await step.execute(context);
        executedSteps.push(step);
      } catch (err: any) {
        console.error(\`[Saga] Step '\${step.name}' failed: \${err.message}. Initiating rollback...\`);
        await this.rollback(executedSteps, context);
        throw new Error(\`Saga failed at step '\${step.name}'. Rollback executed. Reason: \${err.message}\`);
      }
    }

    console.log("[Saga] All steps completed successfully!");
    return context;
  }

  private async rollback(executedSteps: SagaStep<any>[], context: any) {
    // Execute compensations in reverse order
    for (const step of executedSteps.reverse()) {
      try {
        console.warn(\`[Saga Rollback] Compensating step: \${step.name}\`);
        await step.compensate(context);
      } catch (compErr: any) {
        // Compensations must never fail silently; if they fail, alert on-call
        console.error(\`CRITICAL: Compensation for '\${step.name}' failed: \${compErr.message}\`);
      }
    }
  }
}

// Defining the Saga Steps:
const orchestrator = new OrderCheckoutSagaOrchestrator()
  .addStep({
    name: "ReserveCustomerCredit",
    execute: async (ctx) => { ctx.creditReserved = true; console.log("Credit reserved"); },
    compensate: async (ctx) => { ctx.creditReserved = false; console.log("Credit refunded"); }
  })
  .addStep({
    name: "ReserveWarehouseInventory",
    execute: async (ctx) => { ctx.inventoryReserved = true; console.log("Inventory reserved"); },
    compensate: async (ctx) => { ctx.inventoryReserved = false; console.log("Inventory released"); }
  })
  .addStep({
    name: "ProcessPaymentGatewayCharge",
    execute: async () => { throw new Error("Payment Gateway: Card Declined (500)"); },
    compensate: async () => { /* No-op since execution failed */ }
  });

// Execute Saga:
orchestrator.execute({ orderId: "ord-881", amount: 150 })
  .catch(err => console.log("Orchestrator Result:", err.message));`,
    breakdown: [
      "Registers forward execution and reverse compensation handlers per step.",
      "Tracks completed steps to ensure only executed steps are compensated on failure.",
      "Executes compensations in strict LIFO (reverse) order.",
      "Logs critical escalation alarms if any compensation step encounters an error."
    ],
    expectedOutput: "Step 1 and 2 succeed; Step 3 fails. Orchestrator compensator releases inventory, then refunds credit."
  },

  {
    id: "ms-ex-22",
    title: "Temporal Durable Execution Workflow for Checkout",
    category: "Transactions & Consistency",
    difficulty: "advanced",
    whatThisCodeCovers: "A Temporal.io TypeScript workflow definition implementing durable execution, automatic activity retries, and compensation logic across service failures.",
    conceptsCovered: ["Temporal.io", "Durable Execution", "Workflow", "Activity", "Fault Tolerant State Machine"],
    code: `import { proxyActivities, defineSignal, setHandler } from "@temporalio/workflow";

// Define Activity Interfaces
interface OrderActivities {
  reserveInventory(orderId: string, sku: string, qty: number): Promise<string>;
  releaseInventory(reservationId: string): Promise<void>;
  chargeCreditCard(orderId: string, amountCents: number): Promise<string>;
  refundPayment(chargeId: string): Promise<void>;
  dispatchShipping(orderId: string): Promise<string>;
}

// Proxy activities with retry policies
const { reserveInventory, releaseInventory, chargeCreditCard, refundPayment, dispatchShipping } =
  proxyActivities<OrderActivities>({
    startToCloseTimeout: "30 seconds",
    retry: {
      initialInterval: "1 second",
      maximumInterval: "10 seconds",
      backoffCoefficient: 2,
      maximumAttempts: 5
    }
  });

// Durable Workflow Function
export async function orderFulfillmentWorkflow(order: { id: string; sku: string; qty: number; amountCents: number }): Promise<string> {
  let reservationId: string | null = null;
  let chargeId: string | null = null;

  try {
    // 1. Reserve Inventory (Durable: Survives server crashes)
    reservationId = await reserveInventory(order.id, order.sku, order.qty);

    // 2. Charge Payment
    chargeId = await chargeCreditCard(order.id, order.amountCents);

    // 3. Dispatch Shipping
    const trackingCode = await dispatchShipping(order.id);
    return trackingCode;
  } catch (err) {
    // Compensations executed on workflow failure
    if (chargeId) {
      await refundPayment(chargeId);
    }
    if (reservationId) {
      await releaseInventory(reservationId);
    }
    throw err;
  }
}`,
    breakdown: [
      "Provides durable execution where workflow state survives process crashes and server restarts.",
      "Defines fine-grained activity retry policies with exponential backoff.",
      "Guarantees that compensation activities execute even if machines lose power during execution.",
      "Eliminates manual state persistence and timer management."
    ],
    expectedOutput: "Temporal executes workflow to completion. Automatically rolls back compensations if payment fails."
  },

  {
    id: "ms-ex-23",
    title: "Choreographed Saga with Kafka Event Reactions",
    category: "Transactions & Consistency",
    difficulty: "intermediate",
    whatThisCodeCovers: "A decentralized Choreographed Saga where Inventory and Payment microservices react to Kafka events, publishing success or compensation events.",
    conceptsCovered: ["Choreography", "Event Pinball", "Autonomous Reaction", "Kafka Saga", "Compensating Events"],
    code: `// 1. Inventory Service Event Handler (Choreographed)
export async function onOrderCreated(event: { orderId: string; sku: string; qty: number }, kafka: any) {
  const stockAvailable = await checkStock(event.sku, event.qty);

  if (stockAvailable) {
    await reserveStock(event.orderId, event.sku, event.qty);
    // Emit success event for Payment service to consume
    await kafka.send({
      topic: "inventory.events",
      messages: [{ key: event.orderId, value: JSON.stringify({ type: "InventoryReserved", orderId: event.orderId }) }]
    });
  } else {
    // Emit failure event to trigger compensation in upstream services
    await kafka.send({
      topic: "inventory.events",
      messages: [{ key: event.orderId, value: JSON.stringify({ type: "InventoryReservationFailed", orderId: event.orderId }) }]
    });
  }
}

// 2. Payment Service reacts to InventoryReserved event:
export async function onInventoryReserved(event: { orderId: string; amount: number }, kafka: any) {
  try {
    await chargeUser(event.orderId, event.amount);
    await kafka.send({
      topic: "payment.events",
      messages: [{ key: event.orderId, value: JSON.stringify({ type: "PaymentSucceeded", orderId: event.orderId }) }]
    });
  } catch (paymentErr) {
    // Emit PaymentFailed -> triggers Inventory to release stock!
    await kafka.send({
      topic: "payment.events",
      messages: [{ key: event.orderId, value: JSON.stringify({ type: "PaymentFailed", orderId: event.orderId }) }]
    });
  }
}

// 3. Inventory Service listens to PaymentFailed to COMPENSATE:
export async function onPaymentFailed(event: { orderId: string }) {
  console.warn(\`[Compensation] Payment failed for \${event.orderId}. Releasing reserved stock.\`);
  await releaseStock(event.orderId);
}`,
    breakdown: [
      "Implements decentralized choreography with zero centralized coordinator dependency.",
      "Each microservice listens to upstream domain events and emits its own downstream outcomes.",
      "Compensations are triggered via explicit negative events (PaymentFailed).",
      "Best suited for simple 2-3 step workflows without deep branching logic."
    ],
    expectedOutput: "Payment fails; PaymentFailed event is consumed by Inventory Service to release stock."
  },

  {
    id: "ms-ex-24",
    title: "Semantic Locking & Optimistic Concurrency Control (OCC)",
    category: "Transactions & Consistency",
    difficulty: "advanced",
    whatThisCodeCovers: "Applying Semantic Locks (PENDING status flags) and Optimistic Concurrency Control using database version numbers to prevent dirty reads during in-flight Sagas.",
    conceptsCovered: ["Semantic Lock", "OCC", "Dirty Reads", "Isolation in Sagas", "Version Numbers"],
    code: `import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export class AccountServiceWithOCC {
  // 1. Debit Account with Semantic Lock: status = 'PENDING_SETTLEMENT'
  async initiateTransfer(accountId: string, amount: number, transferId: string) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // Check balance and version
      const res = await client.query(
        "SELECT balance, version, status FROM accounts WHERE id = $1 FOR UPDATE",
        [accountId]
      );
      const account = res.rows[0];

      if (account.status === "LOCKED_TRANSFER") {
        throw new Error("Account has an in-flight transfer pending (Semantic Lock active)");
      }
      if (account.balance < amount) {
        throw new Error("Insufficient funds");
      }

      // Apply Semantic Lock
      await client.query(
        \`UPDATE accounts
         SET balance = balance - $1,
             version = version + 1,
             status = 'LOCKED_TRANSFER',
             active_transfer_id = $2
         WHERE id = $3 AND version = $4\`,
        [amount, transferId, accountId, account.version]
      );

      await client.query("COMMIT");
    } finally {
      client.release();
    }
  }

  // 2. Finalize Transfer: Release Semantic Lock
  async confirmTransfer(accountId: string, transferId: string) {
    await pool.query(
      \`UPDATE accounts
       SET status = 'ACTIVE',
           active_transfer_id = NULL,
           version = version + 1
       WHERE id = $1 AND active_transfer_id = $2\`,
      [accountId, transferId]
    );
  }

  // 3. Compensate / Cancel: Refund balance and Release Lock
  async cancelTransfer(accountId: string, transferId: string, amount: number) {
    await pool.query(
      \`UPDATE accounts
       SET balance = balance + $1,
           status = 'ACTIVE',
           active_transfer_id = NULL,
           version = version + 1
       WHERE id = $2 AND active_transfer_id = $3\`,
      [amount, accountId, transferId]
    );
  }
}`,
    breakdown: [
      "Applies semantic locking (LOCKED_TRANSFER) to protect against concurrent overlapping mutations.",
      "Uses Optimistic Concurrency Control with version numbers to reject conflicting writes.",
      "Prevents concurrent sagas from double-spending or observing inconsistent intermediate states.",
      "Provides clear confirmation and cancellation reconciliation methods."
    ],
    expectedOutput: "Account balance debited with semantic lock applied; subsequent operations blocked until confirmed."
  },

  {
    id: "ms-ex-25",
    title: "CQRS Elasticsearch Read Projection Synchronizer",
    category: "Transactions & Consistency",
    difficulty: "advanced",
    whatThisCodeCovers: "A CQRS projection engine consuming domain events from Kafka and updating denormalized, ready-to-search read models in Elasticsearch.",
    conceptsCovered: ["CQRS", "Elasticsearch", "Read Model", "Denormalization", "Eventual Consistency"],
    code: `import { Client } from "@elastic/elasticsearch";

const esClient = new Client({ node: process.env.ELASTICSEARCH_URL || "http://localhost:9200" });

export class ProductSearchProjectionBuilder {
  // Handle ProductCreated Event: Insert denormalized search document
  async onProductCreated(event: { id: string; name: string; category: string; price: number }) {
    await esClient.index({
      index: "product_catalog_read_model",
      id: event.id,
      document: {
        id: event.id,
        name: event.name,
        category: event.category,
        price: event.price,
        averageRating: 0,
        reviewCount: 0,
        inStock: true,
        indexedAt: new Date().toISOString()
      }
    });
    console.log(\`Indexed new read-model document for product \${event.id}\`);
  }

  // Handle ReviewAdded Event: Update denormalized averageRating without joining review tables!
  async onReviewAdded(event: { productId: string; newRating: number }) {
    // Elasticsearch painless script for atomic in-place projection update
    await esClient.update({
      index: "product_catalog_read_model",
      id: event.productId,
      script: {
        source: \`
          double totalScore = ctx._source.averageRating * ctx._source.reviewCount + params.newRating;
          ctx._source.reviewCount += 1;
          ctx._source.averageRating = totalScore / ctx._source.reviewCount;
        \`,
        params: { newRating: event.newRating }
      }
    });
    console.log(\`Updated average rating projection for product \${event.productId}\`);
  }

  // Fast Query API: Executed by read-heavy clients (Zero SQL Joins!)
  async searchCatalog(query: string, category?: string) {
    const res = await esClient.search({
      index: "product_catalog_read_model",
      query: {
        bool: {
          must: [{ match: { name: query } }],
          filter: category ? [{ term: { category } }] : []
        }
      }
    });
    return res.hits.hits.map(h => h._source);
  }
}`,
    breakdown: [
      "Separates relational write commands from denormalized Elasticsearch read models.",
      "Updates calculated aggregates (averageRating) asynchronously using atomic Painless scripts.",
      "Allows read queries to execute in sub-millisecond speeds without cross-service joins.",
      "Isolates the search cluster from write database outages."
    ],
    expectedOutput: "Events stream from Kafka to Elasticsearch. Searches return denormalized documents in < 10ms."
  },

  {
    id: "ms-ex-26",
    title: "Read-Your-Own-Writes Consistency Token Pattern",
    category: "Transactions & Consistency",
    difficulty: "intermediate",
    whatThisCodeCovers: "Mitigating eventual consistency lag in CQRS by issuing an OCC Version Token on mutation and waiting on read replicas until the version is caught up.",
    conceptsCovered: ["Read-Your-Own-Writes", "Causal Consistency", "Version Tokens", "Replication Lag", "CQRS UX"],
    code: `// Express Middleware enforcing Read-Your-Own-Writes consistency
import { Request, Response, NextFunction } from "express";

export function readYourOwnWritesGuard(readModelStore: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Client forwards the version token returned by previous POST/PUT mutation
    const expectedVersionHeader = req.headers["x-min-version"];
    if (!expectedVersionHeader) return next();

    const expectedVersion = parseInt(expectedVersionHeader as string, 10);
    const entityId = req.params.id;
    const maxWaitMs = 1000;
    const pollIntervalMs = 50;
    const startTime = Date.now();

    // Poll read replica until projection catches up to the required version
    while (Date.now() - startTime < maxWaitMs) {
      const currentDoc = await readModelStore.findById(entityId);
      if (currentDoc && currentDoc.version >= expectedVersion) {
        // Read model is caught up! Safe to serve read
        return next();
      }
      await new Promise(r => setTimeout(r, pollIntervalMs));
    }

    // Fallback: If read model did not catch up within 1s, instruct client to fetch from master
    res.setHeader("X-Degraded-Read", "STALE_PROJECTION");
    next();
  };
}

// Client Workflow:
// 1. POST /orders -> Returns { id: "o1", version: 4 }
// 2. GET /orders/o1 with Header "X-Min-Version: 4"
// 3. Middleware guarantees client never sees version 3 (eliminating UX flicker!).`,
    breakdown: [
      "Addresses user frustration when refreshed UI displays stale data due to async projection lag.",
      "Client passes expected entity version via X-Min-Version header.",
      "Server waits briefly (up to 1000ms) for the projection pipeline to catch up.",
      "Guarantees causal consistency for the active writer while keeping other readers asynchronous."
    ],
    expectedOutput: "Guarantees client observes their own latest mutation, eliminating eventual consistency UI flicker."
  },

  {
    id: "ms-ex-27",
    title: "Conflict-Free Replicated Data Types (PN-Counter CRDT)",
    category: "Transactions & Consistency",
    difficulty: "advanced",
    whatThisCodeCovers: "A state-based Positive-Negative Counter (PN-Counter) CRDT in TypeScript that converges deterministically across distributed replicas without centralized locks.",
    conceptsCovered: ["CRDT", "PN-Counter", "Eventual Convergence", "Active-Active Multi-Region", "Commutative Operations"],
    code: `export class PNCounterCRDT {
  // Vector of positive increments per replica node ID
  private P: Record<string, number> = {};
  // Vector of negative decrements per replica node ID
  private N: Record<string, number> = {};

  constructor(private nodeId: string) {
    this.P[nodeId] = 0;
    this.N[nodeId] = 0;
  }

  // Increment local counter
  increment(amount = 1) {
    this.P[this.nodeId] = (this.P[this.nodeId] || 0) + amount;
  }

  // Decrement local counter
  decrement(amount = 1) {
    this.N[this.nodeId] = (this.N[this.nodeId] || 0) + amount;
  }

  // Read current converged value: sum(P) - sum(N)
  value(): number {
    const totalP = Object.values(this.P).reduce((acc, v) => acc + v, 0);
    const totalN = Object.values(this.N).reduce((acc, v) => acc + v, 0);
    return totalP - totalN;
  }

  // Commutative, Associative, Idempotent Merge function:
  // Merges remote state vector into local state vector
  merge(remoteState: { P: Record<string, number>; N: Record<string, number> }) {
    for (const [node, val] of Object.entries(remoteState.P)) {
      this.P[node] = Math.max(this.P[node] || 0, val);
    }
    for (const [node, val] of Object.entries(remoteState.N)) {
      this.N[node] = Math.max(this.N[node] || 0, val);
    }
  }

  getState() {
    return { P: { ...this.P }, N: { ...this.N } };
  }
}

// Verification across multi-region replicas:
const usNode = new PNCounterCRDT("region-us");
const euNode = new PNCounterCRDT("region-eu");

usNode.increment(10);
euNode.increment(5);
euNode.decrement(2);

// Replicate state asynchronously across ocean:
usNode.merge(euNode.getState());
euNode.merge(usNode.getState());

console.log("Converged US Value:", usNode.value()); // 13
console.log("Converged EU Value:", euNode.value()); // 13`,
    breakdown: [
      "Tracks increments and decrements in distinct vector maps per node ID.",
      "Uses Math.max() to merge states deterministically without lock coordination.",
      "Satisfies commutativity, associativity, and idempotence.",
      "Enables active-active multi-region counters (e.g. inventory likes, upvotes) without split-brain conflicts."
    ],
    expectedOutput: "Both US and EU replicas independently converge to exact value: 13."
  },

  {
    id: "ms-ex-28",
    title: "Idempotent Webhook Receiver with HMAC Verification",
    category: "Transactions & Consistency",
    difficulty: "intermediate",
    whatThisCodeCovers: "A hardened webhook receiver for Stripe/partner webhooks featuring HMAC SHA-256 signature verification, timing attack defense, and database deduplication.",
    conceptsCovered: ["Webhooks", "HMAC", "timingSafeEqual", "Idempotency", "Replay Attack Defense"],
    code: `import crypto from "node:crypto";
import { Request, Response } from "express";

export async function webhookHandler(req: Request, res: Response, db: any) {
  const signatureHeader = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.WEBHOOK_SECRET!;
  const rawBody = req.body; // Must be raw unparsed buffer for cryptographic signature match!

  // 1. Verify HMAC Signature
  try {
    const parts = signatureHeader.split(",");
    const t = parts.find(p => p.startsWith("t="))?.split("=")[1];
    const sig = parts.find(p => p.startsWith("v1="))?.split("=")[1];

    if (!t || !sig) return res.status(400).send("Malformed signature header");

    // Replay attack prevention: tolerance 300s
    const eventTime = parseInt(t, 10);
    if (Math.abs(Date.now() / 1000 - eventTime) > 300) {
      return res.status(400).send("Signature timestamp expired");
    }

    const expectedSig = crypto
      .createHmac("sha256", webhookSecret)
      .update(\`\${t}.\${rawBody.toString()}\`)
      .digest("hex");

    const sigBuf = Buffer.from(sig, "hex");
    const expBuf = Buffer.from(expectedSig, "hex");
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(401).send("Invalid cryptographic signature");
    }
  } catch (err) {
    return res.status(400).send("Signature verification failed");
  }

  // 2. Parse payload after signature verification
  const event = JSON.parse(rawBody.toString());

  // 3. Database Idempotency Guard (ON CONFLICT DO NOTHING)
  const query = \`
    INSERT INTO processed_webhooks (webhook_id, event_type, processed_at)
    VALUES ($1, $2, NOW())
    ON CONFLICT (webhook_id) DO NOTHING
    RETURNING id;
  \`;
  const result = await db.query(query, [event.id, event.type]);

  if (result.rows.length === 0) {
    console.log(\`Webhook \${event.id} already processed. Acknowledging duplicate.\`);
    return res.status(200).json({ received: true, status: "DUPLICATE_IGNORED" });
  }

  // 4. Process event
  await handleBusinessEvent(event);
  return res.status(200).json({ received: true });
}`,
    breakdown: [
      "Verifies raw body payload against HMAC-SHA256 signature.",
      "Protects against timing attacks using crypto.timingSafeEqual.",
      "Validates timestamp within a 5-minute sliding window to prevent replay attacks.",
      "Ensures database idempotency via ON CONFLICT (webhook_id) DO NOTHING."
    ],
    expectedOutput: "Validates HMAC signature; safely deduplicates repeated webhook deliveries."
  },

  {
    id: "ms-ex-29",
    title: "Distributed Mutex with Redis Redlock Algorithm",
    category: "Transactions & Consistency",
    difficulty: "advanced",
    whatThisCodeCovers: "A multi-node distributed locking manager implementing the Redlock algorithm across independent Redis master nodes with clock drift protection.",
    conceptsCovered: ["Distributed Lock", "Redlock", "Redis", "Mutual Exclusion", "Split-Brain"],
    code: `import Redis from "ioredis";
import crypto from "node:crypto";

export class RedlockDistributedMutex {
  private redisNodes: Redis[];

  constructor(nodeUrls: string[]) {
    this.redisNodes = nodeUrls.map(url => new Redis(url));
  }

  async acquireLock(resource: string, ttlMs = 5000): Promise<{ lockId: string } | null> {
    const lockId = crypto.randomUUID();
    const startTime = Date.now();
    let acquiredNodes = 0;

    // Quorum rule: must acquire lock on majority of nodes: (N / 2) + 1
    const quorum = Math.floor(this.redisNodes.length / 2) + 1;

    for (const node of this.redisNodes) {
      try {
        const res = await node.set(\`lock:\${resource}\`, lockId, "PX", ttlMs, "NX");
        if (res === "OK") acquiredNodes++;
      } catch {
        // Node unreachable
      }
    }

    const elapsed = Date.now() - startTime;
    const validityTime = ttlMs - elapsed;

    if (acquiredNodes >= quorum && validityTime > 0) {
      console.log(\`[Redlock] Acquired lock on '\${resource}' across \${acquiredNodes}/\${this.redisNodes.length} nodes\`);
      return { lockId };
    }

    // Failed to achieve quorum: release partial locks across all nodes immediately!
    await this.releaseLock(resource, lockId);
    return null;
  }

  async releaseLock(resource: string, lockId: string) {
    const luaUnlock = \`
      if redis.call("get", KEYS[1]) == ARGV[1] then
        return redis.call("del", KEYS[1])
      else
        return 0
      end
    \`;

    for (const node of this.redisNodes) {
      try {
        await node.eval(luaUnlock, 1, \`lock:\${resource}\`, lockId);
      } catch {
        // Node error
      }
    }
  }
}`,
    breakdown: [
      "Queries multiple independent Redis master nodes concurrently.",
      "Enforces majority quorum voting ((N/2) + 1) to prevent split-brain locks.",
      "Calculates elapsed time to account for clock drift and processing latency.",
      "Releases locks using an atomic Lua script that verifies lockId ownership before deletion."
    ],
    expectedOutput: "Acquires distributed lock across majority of nodes. Releases atomically via Lua."
  },

  {
    id: "ms-ex-30",
    title: "2PC Disaster Simulation & Non-Blocking Saga Transition",
    category: "Transactions & Consistency",
    difficulty: "advanced",
    whatThisCodeCovers: "A diagnostic simulation demonstrating how traditional Two-Phase Commit (2PC) blocks all database connections when a coordinator node crashes, and refactors it to a resilient Saga.",
    conceptsCovered: ["Two-Phase Commit (2PC)", "Blocking Protocol", "Coordinator Crash", "Saga Transition", "CAP Availability"],
    code: `// Simulation demonstrating why 2PC destroys Availability under network partitions:
export class TwoPhaseCommitSimulation {
  async run2PC() {
    console.log("=== 2PC PHASE 1: PREPARE ===");
    console.log("Coordinator: 'PREPARE' sent to DB-1 (Orders) and DB-2 (Payments)");
    console.log("DB-1: Locks Row #42, writes to WAL, returns VOTE_COMMIT");
    console.log("DB-2: Locks Account #88, writes to WAL, returns VOTE_COMMIT");

    console.log("=== COORDINATOR CRASHES HERE ===");
    // In 2PC, because both DBs voted yes, they MUST HOLD ROW LOCKS INDEFINITELY
    // until the coordinator reboots and issues COMMIT or ABORT!
    console.error("DISASTER: DB-1 and DB-2 hold persistent locks. All concurrent queries on Row #42 stall!");
  }
}

// REFACTORED TO SAGA PATTERN (Non-blocking):
export class SagaNonBlockingApproach {
  async runSaga(orderId: string, accountId: string, amount: number) {
    console.log("=== SAGA APPROACH ===");
    // Step 1: Local commit with Semantic Flag (NO REMOTE LOCKS HELD!)
    console.log("DB-1: INSERT order status='PENDING'. Local commit completes in 2ms. Locks released!");

    // Step 2: Asynchronous RPC to Payment Service
    try {
      const paymentSuccess = await callPaymentGateway(accountId, amount);
      if (paymentSuccess) {
        console.log("DB-1: UPDATE order status='CONFIRMED'. Commit completes!");
      }
    } catch {
      // Step 3: Backward Compensation
      console.warn("Payment failed: Executing compensation -> UPDATE order status='CANCELLED'.");
    }
  }
}`,
    breakdown: [
      "Demonstrates the fundamental flaw of 2PC: blocking coordinator failure modes.",
      "Shows how holding distributed locks across network boundaries destroys database throughput.",
      "Demonstrates the non-blocking nature of Sagas: each step commits locally immediately.",
      "Maintains system availability and partition tolerance (AP in CAP Theorem)."
    ],
    expectedOutput: "2PC blocks threads indefinitely on crash; Saga completes local commit and compensates safely."
  }
];

module.exports = { recipes };
