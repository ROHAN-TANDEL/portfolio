const { createCard } = require("../ms_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 37,
    category: "Distributed Transactions, Consistency & The Saga Pattern",
    concept: "The Death of 2-Phase Commit (2PC) in Microservices",
    priority: "must-know",
    difficulty: "must-know",
    question: "Why is distributed Two-Phase Commit (2PC / XA Transactions) considered an anti-pattern in cloud microservices, and why does CAP Theorem rule it out?",
    answer: "Two-Phase Commit (2PC) is a synchronous blocking protocol requiring all participants to acquire and hold exclusive database row locks across network boundaries during Phase 1 (Prepare). If any participant or the coordinator crashes or experiences network latency, locks are held indefinitely, causing cascading connection pool exhaustion and low availability. In cloud environments where network partitions are inevitable, 2PC's CP nature cripples system availability.",
    explanation: `The Mechanical Failure of 2PC at Scale:
1. Blocking Coordinator Crash:
   - If Cohort A votes YES and acquires database row locks, and the Coordinator crashes before broadcasting Phase 2 Commit, Cohort A cannot commit and cannot abort.
   - Cohort A must hold row locks indefinitely. Any subsequent user trying to modify that row freezes.
2. Latency Multiplier:
   - Transaction duration is the sum of the slowest participant's network RTT + fsync disk write time.
   - If 4 microservices participate across multiple availability zones, transaction latency jumps from 5ms to 250ms+.
   - Long-lived locks destroy database query throughput (Amdahl's Law serial bottleneck).
3. Monolithic Autonomy Violation:
   - XA protocols tie independent microservice database engines (Postgres, Oracle, MySQL) into a single distributed transaction manager, violating service autonomy.`,
    code: `/*
2PC Blocking Lock Hazard:
Coordinator                  Service A (Orders)          Service B (Payments)
    │                                │                           │
    ├── PREPARE ────────────────────>│ (Locks Row 42)            │
    ├── PREPARE ─────────────────────┼──────────────────────────>│ (Locks Account 99)
    │<── VOTE: YES ──────────────────┤                           │
    │<── VOTE: YES ──────────────────┼───────────────────────────┤
    │                                │                           │
  *COORDINATOR CRASHES!*             │                           │
    X                                │                           │
                                     [ Row 42 LOCKED FOREVER! ]  [ Account 99 LOCKED FOREVER! ]
                                     (Blocks all future users)   (Blocks all future users)
*/`,
    recallHint: "2PC holds locks across networks. If coordinator crashes, locks freeze forever. Sagas replace 2PC.",
    interviewTip: "Never propose 2PC in a microservice interview. State clearly: 'Because 2PC is a blocking protocol that sacrifices availability under partitions, modern microservices standardize on the Saga Pattern.'",
    tags: ["2pc", "distributed-transactions", "sagas", "cap-theorem", "anti-patterns", "atomicity"]
  }),

  createCard({
    idNum: 38,
    category: "Distributed Transactions, Consistency & The Saga Pattern",
    concept: "Saga Pattern Fundamentals & The Compensation Model",
    priority: "must-know",
    difficulty: "must-know",
    question: "How does the Saga pattern guarantee eventual consistency across microservices, and what are Compensating Transactions?",
    answer: "A Saga decomposes a distributed transaction into a sequence of local ACID transactions across independent microservices. Each local transaction updates its private database and commits immediately, releasing database locks. If an intermediate step fails, the Saga executes Compensating Transactions in reverse order to semantically undo preceding operations (e.g., executing a refund to undo a credit card charge).",
    explanation: `The Anatomy of a Saga (Hector Garcia-Molina & Kenneth Salem, 1987):
- A distributed transaction consisting of $n$ local steps: $T_1, T_2, \\dots, T_n$.
- Each local step $T_i$ has a corresponding compensating transaction $C_i$.
- **Normal Execution**: $T_1 \\to T_2 \\to T_3 \\to \\dots \\to T_n$ (All succeed).
- **Failure Execution**: If step $T_k$ fails (e.g., credit card declined at step 3):
  - Step $T_k$ aborts locally.
  - The Saga executes compensations in strict reverse order: $C_{k-1} \\to C_{k-2} \\to \\dots \\to C_1$.
  - Example: $T_1$ (Reserve Hotel) -> $T_2$ (Book Flight) -> $T_3$ (Rent Car - Fails!) -> $C_2$ (Cancel Flight) -> $C_1$ (Cancel Hotel).

Critical Compensation Rules:
1. **Compensations are Semantic, NOT Physical Rollbacks**: You cannot 'rollback' a sent email or a charged credit card; you send an apology email or issue a refund transaction.
2. **Compensations MUST Be Idempotent**: Network retries will deliver compensation requests multiple times.
3. **Compensations CANNOT Fail**: If a compensation API returns 500, the saga orchestrator must retry indefinitely or page an on-call engineer via a Dead Letter Queue.`,
    code: `// Saga Workflow Step Definition
interface SagaStep<TContext> {
  name: string;
  // Forward local transaction (commits DB immediately)
  forward: (ctx: TContext) => Promise<void>;
  // Compensating transaction (must be idempotent!)
  compensate: (ctx: TContext) => Promise<void>;
}`,
    recallHint: "Saga: Sequence of local transactions. If one fails, run compensating rollbacks in reverse.",
    interviewTip: "Highlight that compensating transactions cannot restore physical state (like a database rollback); they execute semantic business corrections (refunds, cancellations, unreservations).",
    tags: ["saga-pattern", "compensating-transactions", "distributed-transactions", "microservices", "eventual-consistency"]
  }),

  createCard({
    idNum: 39,
    category: "Distributed Transactions, Consistency & The Saga Pattern",
    concept: "Orchestration-Based Sagas with Temporal.io & State Machines",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Workflow Orchestration (Temporal.io, Cadence, AWS Step Functions) manage long-running distributed Sagas with durable execution?",
    answer: "Orchestration uses a centralized orchestrator service that executes workflow state machines, commanding participant microservices via asynchronous task queues. Temporal.io achieves durable execution by recording all activity inputs, outputs, and timers in an append-only event history; if the orchestrator process crashes midway through a 3-week workflow, it rehydrates and resumes at the exact line of code where it left off.",
    explanation: `How Temporal / Durable Execution Works:
1. Developer writes standard sequential code:
   \`\`\`typescript
   await inventoryService.reserveItems(order);
   await paymentService.charge(user, amount);
   await shippingService.dispatch(order);
   \`\`\`
2. When \`await activity()\` is called:
   - Temporal server places a task on the target microservice's task queue.
   - The microservice worker polls the task, executes it, and sends the result back to Temporal.
   - Temporal appends \`ActivityTaskCompleted\` to its append-only event history.
3. Process Crash & Recovery:
   - If the orchestrator server crashes, is killed by Kubernetes, or loses power:
   - A replacement worker re-reads the event history.
   - Replays execution from history: past activities return their recorded results instantly without re-executing.
   - Execution resumes smoothly from the exact line of code that was interrupted!
4. Built-in Timers:
   - Supports non-blocking sleep: \`await sleep("30 days")\`. Zero worker threads are consumed while waiting!`,
    code: `// Temporal.io Saga Workflow in TypeScript
import { proxyActivities, sleep } from "@temporalio/workflow";

const { reserveStock, releaseStock, chargeCard, refundCard } = proxyActivities<OrderActivities>({
  startToCloseTimeout: "30s",
  retry: { maximumAttempts: 5 }
});

export async function orderFulfillmentWorkflow(order: OrderData): Promise<void> {
  const compensations: Array<() => Promise<void>> = [];

  try {
    // Step 1: Reserve Stock
    await reserveStock(order.items);
    compensations.push(() => releaseStock(order.items));

    // Step 2: Charge Payment
    await chargeCard(order.userId, order.total);
    compensations.push(() => refundCard(order.userId, order.total));

    // Step 3: Wait for user confirmation or auto-ship
    await sleep("10 minutes");
    await dispatchShipping(order);

  } catch (err) {
    // Execute compensations in reverse order upon any failure!
    for (const compensate of compensations.reverse()) {
      await compensate();
    }
    throw new Error(\`Order Saga Compensated: \${err.message}\`);
  }
}`,
    recallHint: "Temporal: Write linear async/await code. Durable event history allows workflows to survive server crashes.",
    interviewTip: "Mentioning Temporal.io or AWS Step Functions for distributed Saga orchestration demonstrates modern, state-of-the-art cloud architecture expertise.",
    tags: ["temporal", "orchestration", "saga", "durable-execution", "state-machines", "resilience"]
  }),

  createCard({
    idNum: 40,
    category: "Distributed Transactions, Consistency & The Saga Pattern",
    concept: "Choreography-Based Sagas & Event Pinball Hazards",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When are Choreography-based Sagas appropriate, and what is the 'Event Pinball' hazard in complex multi-service workflows?",
    answer: "Choreography is appropriate for simple 2–3 step workflows where services react autonomously to domain events without a central coordinator; 'Event Pinball' occurs when workflows span 5+ services, scattering business logic across dozens of event listeners where no single engineer or codebase understands the end-to-end flow, making debugging, cyclic loops, and multi-step compensations unmaintainable.",
    explanation: `The Event Pinball Failure:
- A customer places an order.
- Order Service emits \`OrderPlaced\`.
- Payment Service hears \`OrderPlaced\`, charges card, emits \`PaymentSucceeded\`.
- Fraud Service hears \`PaymentSucceeded\`, flags suspicious activity, emits \`FraudDetected\`.
- Payment Service hears \`FraudDetected\`, refunds card, emits \`RefundIssued\`.
- Inventory Service hears \`PaymentSucceeded\` (race condition!), reserves items, emits \`InventoryReserved\`.
- What happens now?
  - Does Inventory hear \`FraudDetected\` or \`RefundIssued\`?
  - Who cancels the order in Order Service?
  - Why is the customer's account in a half-refunded, half-reserved state?
- Because business logic is scattered across 4 different repositories, events bounce around like a pinball. Tracing the state machine requires aggregating logs from 10 microservices.`,
    code: `/*
Event Pinball Nightmare (Choreography Sprawl):

[ Order Service ] ──(OrderCreated)──> [ Payment Service ]
       ▲                                      │ (PaymentSuccess)
       │ (CancelOrder)                        ▼
[ Fraud Service ] <──(FraudAlert)─── [ Inventory Service ]
       │                                      │
       ▼ (Refund)                             ▼
[ Billing Service ] ─────────────────> [ Notification Service ]
*Who owns the workflow state? Nobody!*
*/`,
    recallHint: "Choreography is fine for 2-3 steps. Above that, it turns into unmaintainable 'Event Pinball'. Use Orchestration.",
    interviewTip: "In interviews, establish clear decision boundaries: 'We use Choreography for simple broadcast notifications, and Orchestration whenever business logic requires multi-step compensations or strict timeouts.'",
    tags: ["choreography", "event-pinball", "sagas", "microservices", "anti-patterns", "event-driven"]
  }),

  createCard({
    idNum: 41,
    category: "Distributed Transactions, Consistency & The Saga Pattern",
    concept: "Lack of Isolation in Sagas: The 'ACID without I' Problem",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why do Sagas guarantee Atomicity, Consistency, and Durability (ACD) but lack Isolation (I), and what anomalies arise from this?",
    answer: "Because Sagas commit local database transactions immediately at each step to avoid holding distributed locks, intermediate state mutations are globally visible to other concurrent users before the saga finishes or compensates. This lack of Isolation causes three primary concurrency anomalies: Dirty Reads, Lost Updates, and Non-Repeatable Reads.",
    explanation: `Saga Concurrency Anomalies:
1. **Dirty Reads (Reading Uncommitted/Compensated State)**:
   - Saga 1 (Order): Reserves the last iPhone in stock at step 1.
   - User B: Queries catalog and sees 'Out of Stock' (reading intermediate state).
   - Saga 1 (Step 2): Credit card fails! Saga 1 compensates and releases the iPhone.
   - Impact: User B was falsely told the item was sold out.
2. **Lost Updates (Overwriting Concurrent Modifications)**:
   - Saga 1 reads account balance \$100, deducts \$50 (balance = \$50).
   - Saga 2 reads balance \$50, deposits \$100 (balance = \$150).
   - Saga 1 fails at step 2! Compensating transaction blindly restores balance to \$100, wiping out Saga 2's \$100 deposit permanently!
3. **Non-Repeatable Reads**:
   - A service reads a record at step 1; another concurrent saga modifies the record before step 3, so re-reading yields different data.`,
    code: `/*
The Lost Update Anomaly in Sagas:

Time   Saga 1 (Transfer $50)             Saga 2 (Deposit $100)
t1     Reads Balance ($100)
t2     Sets Balance ($50) [Commits!]
t3                                       Reads Balance ($50)
t4                                       Sets Balance ($150) [Commits!]
t5     *Saga 1 Fails at Step 2!*
t6     Compensates: Sets Balance ($100)
       --> ERROR: Saga 2's $100 deposit was completely destroyed!
*/`,
    recallHint: "Sagas are ACD, NOT ACID. Lack of Isolation means dirty reads and lost updates can occur.",
    interviewTip: "Bringing up the lack of Isolation in Sagas demonstrates advanced mastery of distributed systems theory. Be prepared to immediately present Countermeasures (Semantic Locks).",
    tags: ["sagas", "isolation", "acid", "dirty-reads", "lost-updates", "concurrency-anomalies"]
  }),

  createCard({
    idNum: 42,
    category: "Distributed Transactions, Consistency & The Saga Pattern",
    concept: "Saga Countermeasures: Semantic Locks & Commutative Updates",
    priority: "must-know",
    difficulty: "advanced",
    question: "What architectural Countermeasures eliminate concurrency anomalies caused by the lack of Isolation in distributed Sagas?",
    answer: "Architectural countermeasures include: (1) Semantic Locking (flagging records with 'PENDING_APPROVAL' to block other operations); (2) Commutative Updates (designing operations to commute in any order, like accounts balance delta increments); (3) Pessimistic View (reordering steps to minimize exposure); and (4) Reread Values (verifying data hasn't changed before modifying).",
    explanation: `Saga Countermeasure Strategies:
1. **Semantic Locking (Application-Level Locks)**:
   - Instead of updating stock from 1 to 0 directly:
     \`UPDATE inventory SET reserved_stock = reserved_stock + 1 WHERE id = 101;\`
   - The row is flagged: \`status = 'RESERVED_PENDING_PAYMENT'\`.
   - Other sagas see the pending flag and either wait, skip the record, or warn the user.
   - When the saga succeeds: status becomes \`CONFIRMED\`. If it fails: status reverts to \`AVAILABLE\`.
2. **Commutative Updates (Math Invariance)**:
   - Design operations so that order of execution does not matter: $A + B = B + A$.
   - Instead of overwriting absolute values (\`balance = 500\`), apply relative deltas:
     \`UPDATE accounts SET balance = balance - 50 WHERE id = 1;\`
   - Even if Saga 1 compensates (\`balance = balance + 50\`), Saga 2's deposit (\`balance = balance + 100\`) is preserved perfectly!
3. **Pivot Transactions**:
   - Classify saga steps: Compensable Transactions -> Pivot Transaction -> Retryable Transactions.
   - The Pivot is the point of no return: once the Pivot commits, the saga is guaranteed to complete without rollback.`,
    code: `// Semantic Lock Pattern on Domain Aggregate
export class OrderAggregate {
  private status: "DRAFT" | "PENDING_PAYMENT" | "PAID" | "CANCELLED" = "DRAFT";

  reserve() {
    // Semantic lock: blocks other modifications while saga is in flight
    this.status = "PENDING_PAYMENT";
  }

  confirmPayment() {
    if (this.status !== "PENDING_PAYMENT") {
      throw new Error("Invalid state transition");
    }
    this.status = "PAID"; // Lock released
  }

  compensate() {
    this.status = "CANCELLED"; // Semantic lock released via rollback
  }
}`,
    recallHint: "Semantic Locks flag records 'PENDING' to stop dirty reads. Relative balance updates (+/-) prevent lost updates.",
    interviewTip: "Always recommend Semantic Locking for inventory and reservations, and Commutative Updates (relative delta SQL) for financial account balances in Sagas.",
    tags: ["semantic-locks", "sagas", "countermeasures", "commutative-updates", "concurrency", "isolation"]
  }),

  createCard({
    idNum: 43,
    category: "Distributed Transactions, Consistency & The Saga Pattern",
    concept: "Pivot Transactions vs Compensable Transactions vs Retryable Transactions",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does categorizing Saga steps into Compensable, Pivot, and Retryable transactions guarantee that a distributed workflow will always complete?",
    answer: "Saga steps are partitioned into three phases: (1) Compensable Transactions (steps that can be rolled back if preceding steps fail); (2) The Pivot Transaction (the definitive point of no return; if it commits, the saga CANNOT be rolled back); and (3) Retryable Transactions (subsequent steps that are guaranteed to succeed eventually via idempotent retries).",
    explanation: `The Three Transaction Tiers of a Saga:
1. **Compensable Transactions (Phase 1)**:
   - Steps executed before the pivot.
   - Must have a corresponding compensating transaction ($C_i$).
   - Example: Reserve hotel room, authorize card hold.
2. **The Pivot Transaction (The Turning Point)**:
   - The single operation that determines whether the saga completes or aborts.
   - If the Pivot fails: all compensable transactions are rolled back.
   - If the Pivot succeeds: the saga commits to completion! There is NO going back.
   - Example: Capturing credit card funds or executing the final legal contract signing.
3. **Retryable Transactions (Phase 2)**:
   - Steps executed *after* the pivot.
   - **Do NOT need compensating transactions!**
   - Because the pivot succeeded, these steps are legally and logically guaranteed to happen.
   - If an error occurs (e.g., shipping API returns 500 or email server is down), the orchestrator retries with exponential backoff until it succeeds.
   - Must be strictly idempotent!`,
    code: `/*
Saga Transaction Phases:

[ Step 1: Reserve Stock ]   ──> COMPENSABLE (Can be rolled back via unreserve)
         │
[ Step 2: Authorize Card ]  ──> COMPENSABLE (Can be released)
         │
[ Step 3: CAPTURE PAYMENT ] ──> PIVOT TRANSACTION! (Point of No Return!)
         │                       - If Fails -> Rollback Steps 1 & 2
         │                       - If Succeeds -> MUST FINISH! No rollback allowed!
         ▼
[ Step 4: Dispatch Order ]  ──> RETRYABLE (Retries until success! No compensation needed)
[ Step 5: Send Email ]      ──> RETRYABLE (Retries until success!)
*/`,
    recallHint: "Compensable = can rollback. Pivot = point of no return. Retryable = retries forever until success.",
    interviewTip: "Structuring a Saga into Compensable -> Pivot -> Retryable transactions proves you understand advanced distributed transaction theory and operational reliability.",
    tags: ["pivot-transaction", "compensable-transaction", "retryable-transaction", "sagas", "workflows"]
  }),

  createCard({
    idNum: 44,
    category: "Distributed Transactions, Consistency & The Saga Pattern",
    concept: "Out-of-Order Event Handling in Asynchronous Sagas",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why do asynchronous Sagas receive events out of order, and how do State Reordering Buffers and Version Clocks prevent race-condition data corruption?",
    answer: "Due to network jitter, partition rebalancing, and concurrent worker threads, a compensating or completion event (e.g., 'OrderCancelled') can arrive at a microservice *before* the initial creation event ('OrderCreated'). Microservices handle out-of-order events using State Machines with Version Clocks (ignoring older versions) or Event Buffering (holding premature events until prerequisites arrive).",
    explanation: `The Premature Cancellation Race Condition:
Consider a choreography saga where cancellation races creation:
1. User creates order -> \`OrderCreatedEvent\` published.
2. User immediately clicks Cancel -> \`OrderCancelledEvent\` published.
3. Due to network routing, Payment Service receives \`OrderCancelledEvent\` FIRST!
4. Payment Service checks database: \`Order #101\` does not exist.
   - Naive Code: Throws 404 error or ignores event.
5. 50ms later: \`OrderCreatedEvent\` arrives at Payment Service.
6. Payment Service charges the credit card!
7. Disaster: The user cancelled the order, but was charged anyway because the cancellation event arrived too early!

Architectural Solutions:
1. **Explicit Cancellation State Pre-Creation**:
   - If \`OrderCancelledEvent\` arrives for an unknown entity, insert a placeholder record:
     \`INSERT INTO orders (id, status) VALUES ('101', 'CANCELLED');\`
   - When \`OrderCreatedEvent\` arrives later, it checks status: sees \`CANCELLED\`, and aborts execution!
2. **Monotonic Version / Sequence Numbers**:
   - Reject or buffer any event with \`version < current_version\`.`,
    code: `// Resilient Out-of-Order State Handler in TypeScript
export class ResilientOrderHandler {
  private orders = new Map<string, { status: string; version: number }>();

  async handleOrderCancelled(orderId: string, version: number) {
    const existing = this.orders.get(orderId);

    if (!existing) {
      // PREMATURE CANCELLATION: Pre-record cancellation state!
      console.warn(\`Order \${orderId} cancelled before creation! Recording tombstone.\`);
      this.orders.set(orderId, { status: "CANCELLED", version });
      return;
    }

    if (version >= existing.version) {
      existing.status = "CANCELLED";
      existing.version = version;
    }
  }

  async handleOrderCreated(orderId: string, version: number) {
    const existing = this.orders.get(orderId);

    if (existing && existing.status === "CANCELLED") {
      console.log(\`Order \${orderId} was already cancelled! Skipping creation.\`);
      return; // Neutralize out-of-order race!
    }

    this.orders.set(orderId, { status: "CREATED", version });
  }
}`,
    recallHint: "Events can arrive out of order. If Cancel arrives before Create, record a 'CANCELLED' tombstone.",
    interviewTip: "Always address out-of-order event delivery in asynchronous distributed systems. Proposing placeholder/tombstone pre-creation shows deep production battle experience.",
    tags: ["out-of-order-events", "race-conditions", "sagas", "event-driven", "state-machines", "resilience"]
  }),

  createCard({
    idNum: 45,
    category: "Distributed Transactions, Consistency & The Saga Pattern",
    concept: "Optimistic Concurrency Control (OCC) with Version Numbers",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Optimistic Concurrency Control (OCC) eliminate database row locks in microservices, and how does the 'version' column detect conflicting concurrent writes?",
    answer: "Pessimistic locking holds exclusive database row locks ('SELECT FOR UPDATE') during user thinking or network calls, destroying concurrency; Optimistic Concurrency Control (OCC) assumes conflicts are rare, allowing transactions to read data without locking. On write, the SQL query updates the row ONLY if the version column matches the version read: 'UPDATE table SET val = x, version = version + 1 WHERE id = y AND version = current_version'. If zero rows update, a conflict occurred.",
    explanation: `The Flaw of Pessimistic Locking in Microservices:
- If a user opens an order in a web UI: holding a database row lock until the user clicks 'Submit' (15 seconds later) freezes that database row and starves connection pools.
- Holding locks across HTTP network calls is strictly prohibited.

Optimistic Concurrency Control (OCC) Workflow:
1. Client reads record:
   \`SELECT id, total, version FROM orders WHERE id = 101;\` -> returns \`{ id: 101, total: 50, version: 3 }\`.
2. Client performs computation or network calls.
3. Client executes atomic conditional update:
   \`\`\`sql
   UPDATE orders
   SET total = 75, version = version + 1
   WHERE id = 101 AND version = 3;
   \`\`\`
4. Database evaluates row count:
   - If \`rowCount == 1\`: Success! Data updated, version incremented to 4.
   - If \`rowCount == 0\`: Conflict detected! Another user or thread already modified version 3 (version is now 4).
   - Action: Throw concurrency exception; client aborts or re-reads latest data and retries.`,
    code: `// TypeORM / Knex Optimistic Locking Implementation
export async function updateOrderWithOcc(orderId: string, newTotal: number, currentVersion: number) {
  const updatedRows = await db("orders")
    .where({ id: orderId, version: currentVersion })
    .update({
      total: newTotal,
      version: currentVersion + 1,
      updated_at: new Date()
    });

  if (updatedRows === 0) {
    throw new Error(
      \`Optimistic Lock Conflict on Order \${orderId}! Record was modified by a concurrent transaction.\`
    );
  }
  return true;
}`,
    recallHint: "OCC: No locks during read. Update WHERE version = current_version. If 0 rows updated, retry.",
    interviewTip: "Always recommend Optimistic Concurrency Control with a `version` column for high-read, low-conflict enterprise web applications.",
    tags: ["occ", "optimistic-concurrency", "versioning", "row-locks", "database-transactions"]
  }),

  createCard({
    idNum: 46,
    category: "Distributed Transactions, Consistency & The Saga Pattern",
    concept: "Eventual Consistency UX Patterns (Optimistic UI & Pending States)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do frontend and mobile applications provide seamless user experiences when communicating with eventually consistent, asynchronous microservices?",
    answer: "Because asynchronous microservices take hundreds of milliseconds to process transactions across queues, synchronous blocking spinners create poor UX. Production systems use Eventual Consistency UX patterns: (1) Optimistic UI Updates (rendering the mutation on screen immediately assuming success); (2) Explicit Pending States ('Order Placed - Processing Payment'); and (3) WebSocket/SSE live status notifications.",
    explanation: `The UX Problem of Eventual Consistency:
- A user clicks 'Post Tweet' or 'Buy Item'.
- If the frontend blocks waiting for Kafka consumers, Debezium CDC, and projection workers to finish, the user stares at a spinner for 3 seconds.
- If the user refreshes immediately, the read replica might show stale data, leading the user to believe their action failed and submit duplicate orders.

Production UX Strategies:
1. **Optimistic UI Updates (Twitter/Instagram Model)**:
   - Client generates a local UUID and renders the tweet in the timeline *instantly* with a subtle syncing icon.
   - Background HTTP call fires. If success, syncing icon clears.
   - If failure, UI rolls back and shows a 'Failed to post. Tap to retry' banner.
2. **Explicit Pending States (Uber/Amazon Model)**:
   - Amazon doesn't tell you: 'Your credit card was charged and inventory deducted' on checkout.
   - Amazon tells you: **'Your Order has been Received! We are processing your payment.'**
   - The user accepts that background asynchronous processing is taking place.
3. **Reactive WebSocket / SSE Push**:
   - Client renders pending screen and listens to WebSocket channel \`user:101:order_updates\`.
   - When the Saga completes, the server pushes \`ORDER_CONFIRMED\` event, dynamically transitioning the UI to green checkmarks.`,
    code: `/*
Eventual Consistency UX State Machine:

[ User clicks "Submit Order" ]
              │
              ├── 1. Frontend renders Optimistic UI: "Order #101 Submitted (Processing...)"
              │
              ├── 2. POST /orders returns HTTP 202 Accepted { orderId: 101, status: "PENDING" }
              │
              └── 3. WebSocket listens for Saga completion:
                     - ws.on("ORDER_CONFIRMED") ──> Transition screen to "Confirmed ✓"
                     - ws.on("ORDER_FAILED")    ──> Show "Payment Declined: Update Card"
*/`,
    recallHint: "Don't block the user! Show Optimistic UI immediately or 'Order Processing' pending state.",
    interviewTip: "Highlight that Eventual Consistency is not just a backend database concept; it is an end-to-end product design paradigm that requires coordinating API status codes (HTTP 202 Accepted) with UI state machines.",
    tags: ["eventual-consistency", "ux-patterns", "optimistic-ui", "websockets", "http-202", "microservices"]
  }),

  createCard({
    idNum: 47,
    category: "Distributed Transactions, Consistency & The Saga Pattern",
    concept: "Idempotent Webhooks & External Payment Gateway Callbacks",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do microservices safely process incoming payment webhooks from third-party providers (Stripe, PayPal) that may deliver duplicate or out-of-order callbacks?",
    answer: "Third-party payment gateways use at-least-once delivery, repeatedly firing webhooks until receiving an HTTP 200 OK. Microservices must: (1) Verify HMAC cryptographic signatures to prevent spoofing; (2) Store processed webhook event IDs in an idempotent deduplication table; and (3) Evaluate state machine transitions so that late-arriving 'payment_intent.created' webhooks never overwrite 'payment_intent.succeeded'.",
    explanation: `The Webhook Attack & Failure Surface:
1. Forged Requests: An attacker sends a forged POST request to \`/api/webhooks/stripe\` claiming \`amount_paid: 100000\`.
   - Mitigation: Verify Stripe HMAC-SHA256 signature header (\`stripe-signature\`) using the endpoint's webhook secret.
2. Duplicate Webhook Deliveries:
   - Stripe calls your webhook -> your server takes 6 seconds -> Stripe times out at 5s and retries.
   - Without deduplication, your server fulfills the digital order twice.
3. Out-of-Order Delivery:
   - Stripe sends Event 1: \`payment_intent.created\`.
   - Stripe sends Event 2: \`payment_intent.succeeded\`.
   - Due to network routing, Event 2 arrives first! Your server marks order \`PAID\`.
   - Event 1 arrives 2 seconds later. If your code naively updates status, the order reverts to \`PENDING\`!`,
    code: `// Secure & Idempotent Stripe Webhook Handler in Express
app.post("/webhooks/stripe", express.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event: Stripe.Event;

  // 1. Cryptographic HMAC Signature Verification
  try {
    event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err: any) {
    return res.status(400).send(\`Webhook Signature Error: \${err.message}\`);
  }

  // 2. Atomic Deduplication Lock via Database Constraint
  await db.transaction(async (trx) => {
    const inserted = await trx("processed_webhooks")
      .insert({ event_id: event.id, processed_at: new Date() })
      .onConflict("event_id")
      .ignore();

    if (inserted.rowCount === 0) {
      console.log(\`Webhook \${event.id} already processed. Acknowledging with 200 OK.\`);
      return res.status(200).json({ received: true });
    }

    // 3. Monotonic State Machine Transition
    if (event.type === "payment_intent.succeeded") {
      await orderService.markPaid(trx, event.data.object.metadata.orderId);
    }

    res.status(200).json({ received: true });
  });
});`,
    recallHint: "Webhooks: Verify HMAC signature. Dedupe by event ID in DB. Protect state machine from out-of-order updates.",
    interviewTip: "Always return HTTP 200 OK immediately once a webhook is recorded; performing slow operations synchronously inside the webhook handler will cause payment gateways to timeout and spam retries.",
    tags: ["webhooks", "idempotency", "stripe", "hmac", "payment-gateways", "security"]
  }),

  createCard({
    idNum: 48,
    category: "Distributed Transactions, Consistency & The Saga Pattern",
    concept: "Distributed Transaction Monitoring & Saga Visualizers",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why are distributed Sagas difficult to debug without centralized monitoring, and how do workflow visualization engines track distributed saga lifecycles?",
    answer: "Because Sagas execute across decoupled microservices over minutes or days, locating where a workflow failed using traditional log grep is nearly impossible. Modern platforms use Workflow Visualizers (Temporal Web UI, AWS Step Functions Console, Camunda) to provide visual execution graphs, step-by-step input/output payloads, call stacks, retry histories, and automated human-in-the-loop intervention.",
    explanation: `The Operational Observability Gap:
- In a monolithic application, if an order fails, a single stack trace identifies the exact line of code.
- In a choreographed microservice saga:
  - Did Payment Service receive the event?
  - Did Inventory fail because of out-of-stock or network timeout?
  - Did the compensating refund event get dropped by Kafka?
  - Searching logs across 5 Kibana dashboards using correlation IDs takes hours.

Capabilities of Orchestration Visualizers:
1. **Visual State DAG**: An interactive flowchart displaying which steps succeeded (green), which failed (red), and which compensations executed (orange).
2. **Payload Inspection**: View the exact JSON parameters passed into and returned by each microservice activity.
3. **Execution History Timeline**: Microsecond timeline of task dispatch, worker poll, execution duration, and retries.
4. **Manual Intervention**: If a payment gateway is down and compensations exceed retry limits, the visualizer allows on-call SREs to fix parameters and click 'Retry Activity' without code redeployment.`,
    code: `/*
Temporal Workflow State Machine Visualization:

[ OrderWorkflow (Execution ID: ord_9821) ]
  ├── [ Task: reserveInventory ] ──> SUCCESS (took 45ms)
  ├── [ Task: chargeCard ]       ──> FAILED: Card Expired! (attempt 3/3)
  ├── [ COMPENSATING ROLLBACK ]
  │     └── [ Task: releaseInventory ] ──> SUCCESS (took 32ms)
  └── [ Workflow Status: COMPENSATED ]
*/`,
    recallHint: "Visualizers turn distributed saga mystery into an interactive execution graph with replay controls.",
    interviewTip: "Highlight that selecting Orchestration (Temporal/Step Functions) over Choreography provides built-in visual operational tooling that drastically reduces Mean Time to Resolution (MTTR) during production incidents.",
    tags: ["saga-monitoring", "temporal", "step-functions", "observability", "state-machines", "mttr"]
  })
];

module.exports = cards;
