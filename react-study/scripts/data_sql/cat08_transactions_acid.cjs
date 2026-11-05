const { createCard } = require("../sql_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 85,
    category: "Transactions & ACID Concurrency",
    concept: "ACID Properties Defined: Atomicity, Consistency, Isolation, Durability",
    priority: "must-know",
    difficulty: "must-know",
    question: "What are the four ACID properties in relational database management systems, and what guarantees does each provide?",
    quickAnswer: "ACID defines the foundational guarantees of relational transactions: **Atomicity** ('All or Nothing'—if any statement fails, the entire transaction rolls back); **Consistency** (A transaction transitions the database from one valid state to another, strictly enforcing all schema constraints); **Isolation** (Concurrent transactions execute without interfering with one another); and **Durability** (Once committed, changes survive server crashes, power loss, and reboots).",
    detailedAnswer: "Deep Breakdown of the 4 Guarantees:\n1. Atomicity: Managed by transaction logs (WAL/Undo logs). If a connection drops halfway through a balance transfer, uncommitted writes are completely rolled back.\n2. Consistency: Application invariants and database rules (Foreign Keys, Unique constraints, CHECK constraints) cannot be breached; if a constraint is violated, the transaction is rejected.\n3. Isolation: Governed by isolation levels, locks, and MVCC to prevent concurrent read/write anomalies.\n4. Durability: Guaranteed by flushing write-ahead logs to non-volatile storage (`fsync`) before acknowledging the `COMMIT` to the client.",
    code: `-- Demonstrating ACID in a financial transfer
BEGIN TRANSACTION;

-- Step 1: Deduct from Account A
UPDATE bank_accounts SET balance = balance - 250.00 WHERE account_id = 'ACC-A';

-- Step 2: Credit to Account B
UPDATE bank_accounts SET balance = balance + 250.00 WHERE account_id = 'ACC-B';

-- If a CHECK (balance >= 0) constraint fails on Account A,
-- the entire transaction fails and rolls back: Atomicity + Consistency guaranteed!
COMMIT;`,
    recallHint: "Atomicity = all or nothing; Consistency = constraints enforced; Isolation = concurrency safety; Durability = survived crashes.",
    interviewTip: "Never confuse database Consistency (C in ACID: constraints enforced) with distributed Consistency (C in CAP Theorem: linearizable reads across nodes).",
    tags: ["acid", "atomicity", "consistency", "isolation", "durability"]
  }),

  createCard({
    idNum: 86,
    category: "Transactions & ACID Concurrency",
    concept: "Transaction Control: COMMIT, ROLLBACK and SAVEPOINT",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do SAVEPOINTs enable partial rollbacks within a transaction without aborting the entire transaction?",
    quickAnswer: "`SAVEPOINT name` establishes a named marker inside an active transaction. If an error occurs or a conditional branch fails later in the transaction, the application can execute `ROLLBACK TO SAVEPOINT name`. This rolls back all modifications made after the savepoint while **keeping the outer transaction open and active**, allowing the application to recover and commit the successful prior statements.",
    detailedAnswer: "Transaction Control Primitives:\n- `BEGIN / START TRANSACTION`: Initiates an atomic transaction block.\n- `COMMIT`: Persists all modifications permanently to disk; releases all held locks.\n- `ROLLBACK`: Discards all modifications since `BEGIN`; releases all held locks.\n- `SAVEPOINT savepoint_name`: Creates an intermediate recovery checkpoint.\n- `ROLLBACK TO savepoint_name`: Undoes statements back to the savepoint without ending the transaction.\n- `RELEASE SAVEPOINT savepoint_name`: Destroys the savepoint marker without rolling back.",
    code: `-- Batch processing with partial recovery via SAVEPOINT
BEGIN TRANSACTION;

-- 1. Insert primary order (Must succeed)
INSERT INTO customer_orders (order_id, customer_id, total) 
VALUES (1001, 42, 500.00);

-- Establish recovery checkpoint
SAVEPOINT before_optional_upsell;

-- 2. Attempt to add optional promotional gift
INSERT INTO order_items (order_id, item_id, price) 
VALUES (1001, 9999, 0.00);

-- If item 9999 is out of stock (raises error in app logic),
-- Roll back ONLY the gift item, preserving the primary order!
ROLLBACK TO SAVEPOINT before_optional_upsell;

-- Commit primary order successfully!
COMMIT;`,
    recallHint: "SAVEPOINT creates an internal checkpoint; ROLLBACK TO SAVEPOINT undoes changes after it without aborting the outer transaction.",
    interviewTip: "Highlight that ORMs (like Hibernate, Prisma, TypeORM) use nested transactions by translating inner transactions to `SAVEPOINT`s under the hood.",
    tags: ["savepoint", "rollback", "commit", "partial-rollback", "transaction-control"]
  }),

  createCard({
    idNum: 87,
    category: "Transactions & ACID Concurrency",
    concept: "The 4 SQL-92 Transaction Isolation Levels Overview",
    priority: "must-know",
    difficulty: "must-know",
    question: "What are the four ANSI SQL-92 transaction isolation levels, and what concurrency anomalies does each prevent?",
    quickAnswer: "The SQL-92 standard defines 4 isolation levels in increasing order of isolation: 1) **Read Uncommitted** (permits Dirty Reads, Non-Repeatable Reads, Phantoms); 2) **Read Committed** (prevents Dirty Reads; permits Non-Repeatable Reads and Phantoms); 3) **Repeatable Read** (prevents Dirty Reads and Non-Repeatable Reads; permits Phantoms); and 4) **Serializable** (prevents all anomalies, ensuring strict serial equivalence).",
    detailedAnswer: "ANSI SQL-92 Isolation Matrix:\n| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read |\n| :--- | :--- | :--- | :--- |\n| Read Uncommitted | Permitted | Permitted | Permitted |\n| Read Committed | **Prevented** | Permitted | Permitted |\n| Repeatable Read | **Prevented** | **Prevented** | Permitted |\n| Serializable | **Prevented** | **Prevented** | **Prevented** |\n\nProduction Defaults: Most relational databases (PostgreSQL, SQL Server, Oracle) default to `Read Committed`. MySQL InnoDB defaults to `Repeatable Read`.",
    code: `-- Setting transaction isolation levels in standard SQL
SET TRANSACTION ISOLATION LEVEL READ COMMITTED;

SET TRANSACTION ISOLATION LEVEL REPEATABLE READ;

SET TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Read-only transaction hint (Allows optimizer performance shortcuts)
SET TRANSACTION READ ONLY;`,
    recallHint: "4 levels: Read Uncommitted < Read Committed < Repeatable Read < Serializable. Default is usually Read Committed (MySQL is Repeatable Read).",
    interviewTip: "Memorize the 4-by-3 ANSI matrix: every senior database and backend system design interview tests this table.",
    tags: ["isolation-levels", "sql-92", "concurrency-matrix", "read-committed", "serializable"]
  }),

  createCard({
    idNum: 88,
    category: "Transactions & ACID Concurrency",
    concept: "Dirty Reads (G1) & Read Uncommitted Mechanics",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a Dirty Read, why is it dangerous in production, and how does Read Committed prevent it?",
    quickAnswer: "A **Dirty Read** occurs when Transaction A modifies a row but has not yet committed, and concurrent Transaction B **reads that uncommitted data**. If Transaction A subsequently executes a `ROLLBACK`, Transaction B has made business decisions or generated reports based on data that **never officially existed in the database**. All modern relational production systems prevent Dirty Reads by enforcing at least `READ COMMITTED` isolation.",
    detailedAnswer: "Dirty Read Scenario Timeline:\n1. T1 begins: `UPDATE accounts SET balance = 5000 WHERE id = 1;` (Uncommitted!).\n2. T2 begins (under Read Uncommitted): `SELECT balance FROM accounts WHERE id = 1;` $\\to$ Sees `$5000`.\n3. T1 fails or rolls back: `ROLLBACK;` $\\to$ Balance reverts to `$100`.\n4. Problem: T2 saw $5000 and may have dispatched orders or transferred funds based on phantom money.\n5. Prevention: Under `READ COMMITTED`, T2 reads the prior committed row version (via MVCC or read locks), completely blocking dirty reads.",
    code: `-- SCENARIO: Dirty Read Simulation
-- Connection 1:
BEGIN;
UPDATE inventory SET stock_count = 0 WHERE product_id = 100;
-- T1 has NOT committed yet!

-- Connection 2 (If READ UNCOMMITTED were allowed):
SELECT stock_count FROM inventory WHERE product_id = 100; 
-- Sees 0 (Dirty Read!) and falsely tells web customer 'Out of Stock'

-- Connection 1:
ROLLBACK; -- Stock was never 0! Connection 2 made decisions on a hallucinated state.`,
    recallHint: "Dirty read = reading uncommitted data that is later rolled back; prevented by Read Committed.",
    interviewTip: "Mention that PostgreSQL does not even implement `READ UNCOMMITTED`: if you declare it, PostgreSQL silently treats it as `READ COMMITTED` because MVCC makes dirty reads impossible.",
    tags: ["dirty-read", "read-uncommitted", "concurrency-anomaly", "rollback-hazard", "isolation"]
  }),

  createCard({
    idNum: 89,
    category: "Transactions & ACID Concurrency",
    concept: "Non-Repeatable Reads / Fuzzy Reads (G2a) & Read Committed",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a Non-Repeatable Read (Fuzzy Read) and how does it happen under Read Committed isolation?",
    quickAnswer: "A **Non-Repeatable Read** occurs when Transaction A reads a row, concurrent Transaction B **modifies and commits** that same row, and Transaction A reads the exact same row a second time, observing different column values. It happens under `READ COMMITTED` isolation because each query within Transaction A obtains a fresh snapshot of the database, meaning committed changes from other sessions become immediately visible between statements.",
    detailedAnswer: "Non-Repeatable Read Scenario Timeline:\n1. T1: `SELECT salary FROM employees WHERE id = 42;` $\\to$ Sees `$50,000`.\n2. T2: `UPDATE employees SET salary = 75000 WHERE id = 42; COMMIT;`\n3. T1: `SELECT salary FROM employees WHERE id = 42;` $\\to$ Sees `$75,000`!\n- Anomaly: Within the exact same transaction, reading the same row produced two different values ($50K vs $75K).\n- Resolution: Upgrading isolation to `REPEATABLE READ` guarantees that all queries within T1 see the exact same snapshot of data frozen at the start of the transaction.",
    code: `-- Non-Repeatable Read Demonstration under READ COMMITTED
-- Transaction 1 (Read Committed):
BEGIN;
SELECT status FROM orders WHERE order_id = 999; -- Returns 'PENDING'

-- Concurrently, Transaction 2 runs:
-- UPDATE orders SET status = 'CANCELLED' WHERE order_id = 999; COMMIT;

-- Transaction 1 queries the SAME row again:
SELECT status FROM orders WHERE order_id = 999; -- Returns 'CANCELLED'!
-- Value changed inside the same transaction!
COMMIT;`,
    recallHint: "Non-Repeatable Read = same row returns different values on second read in same transaction; prevented by Repeatable Read.",
    interviewTip: "Distinguish Non-Repeatable Read (modifying existing rows) from Phantom Read (inserting new rows).",
    tags: ["non-repeatable-read", "fuzzy-read", "read-committed", "repeatable-read", "snapshot-isolation"]
  }),

  createCard({
    idNum: 90,
    category: "Transactions & ACID Concurrency",
    concept: "Phantom Reads (A3) & Predicate Range Locking",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a Phantom Read, how does it differ from a Non-Repeatable Read, and how do database engines prevent it?",
    quickAnswer: "A **Phantom Read** occurs when Transaction A queries a range of rows matching a search predicate (e.g. `WHERE salary > 100000`), concurrent Transaction B **inserts or deletes** rows that satisfy that predicate and commits, and Transaction A re-runs the range query, finding **new phantom rows** that did not exist in the first query. While Non-Repeatable Read involves modifying an existing row, a Phantom involves the appearance of entirely new rows.",
    detailedAnswer: "Phantom Read Mechanics & Prevention:\n- Non-Repeatable Read vs Phantom: Non-Repeatable Read is row-level mutation. Phantom Read is predicate-set insertion/deletion.\n- Classical Two-Phase Locking (2PL) Prevention: Traditional engines prevent phantoms using **Predicate Locks** or **Next-Key Index Locking** (locking the gap between index keys to physically prevent concurrent inserts into that range).\n- MVCC Prevention: Modern MVCC snapshot engines (PostgreSQL, MySQL InnoDB) prevent phantoms at `REPEATABLE READ` by reading strictly from the frozen transaction snapshot.",
    code: `-- Phantom Read Scenario
-- Transaction 1:
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ; -- (In SQL-92, allows phantoms)
SELECT COUNT(*) FROM active_subscriptions WHERE plan = 'PRO'; -- Returns 100

-- Concurrently, Transaction 2 runs:
-- INSERT INTO active_subscriptions (user_id, plan) VALUES (999, 'PRO'); COMMIT;

-- In strict SQL-92 Repeatable Read, running this again could return 101 (Phantom row!):
SELECT COUNT(*) FROM active_subscriptions WHERE plan = 'PRO';
COMMIT;`,
    recallHint: "Phantom read = range query returns new inserted rows on second read; prevented by Serializable (or Next-Key locks / MVCC).",
    interviewTip: "Highlight that PostgreSQL prevents Phantom Reads even at `REPEATABLE READ` due to its MVCC snapshot architecture, exceeding the minimum ANSI SQL-92 specification.",
    tags: ["phantom-read", "predicate-locks", "next-key-locks", "isolation-anomalies", "range-queries"]
  }),

  createCard({
    idNum: 91,
    category: "Transactions & ACID Concurrency",
    concept: "Write Skew Anomaly & The Limits of Snapshot Isolation",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the Write Skew anomaly, why does Repeatable Read / Snapshot Isolation fail to prevent it, and what is the canonical Doctor-on-Call problem?",
    quickAnswer: "**Write Skew** is a subtle concurrency anomaly where two concurrent transactions read overlapping datasets, satisfy a business invariant locally, but update **disjoint rows** in a way that collectively violates the global business invariant. It passes `REPEATABLE READ` (Snapshot Isolation) without any serialization conflicts because neither transaction modified the exact row updated by the other. It can ONLY be prevented by true `SERIALIZABLE` isolation or explicit locking.",
    detailedAnswer: "The Canonical Doctor-on-Call Problem:\n- Invariant: A hospital must always have at least ONE doctor on call.\n- Initial State: Doctor Alice and Doctor Bob are both on call (`count = 2`).\n- T1 (Alice requests off-call):\n  - Reads `count(*) WHERE on_call = true` $\\to$ Sees 2. Condition satisfied ($\\ge 2$).\n  - Updates Alice: `UPDATE doctors SET on_call = false WHERE id = 'Alice';`\n- T2 (Bob concurrently requests off-call):\n  - Reads `count(*) WHERE on_call = true` $\\to$ Sees 2. Condition satisfied ($\\ge 2$).\n  - Updates Bob: `UPDATE doctors SET on_call = false WHERE id = 'Bob';`\n- Both Commit under Repeatable Read: Because Alice updated Row 1 and Bob updated Row 2, there is no row-level write conflict! Both commit successfully.\n- Disaster: ZERO doctors are left on call! The invariant is breached.",
    code: `-- Preventing Write Skew under SERIALIZABLE isolation
-- (Or by using explicit FOR UPDATE locks)
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Check invariant
SELECT COUNT(*) FROM doctors WHERE on_call = true;

-- If count >= 2, this doctor goes off call:
UPDATE doctors SET on_call = false WHERE id = 'Alice';

-- If concurrent transaction did the same for Bob:
-- PostgreSQL/Serializable raises: ERROR: could not serialize access (40001)!
COMMIT;`,
    recallHint: "Write Skew = concurrent transactions update disjoint rows, collectively violating an invariant; passes Repeatable Read; caught by Serializable.",
    interviewTip: "Memorize the Doctor-on-Call scenario: it is the universally accepted canonical example of Write Skew in senior database interviews.",
    tags: ["write-skew", "snapshot-isolation-limits", "doctor-on-call", "serializable", "concurrency-anomalies"]
  }),

  createCard({
    idNum: 92,
    category: "Transactions & ACID Concurrency",
    concept: "Lost Updates & Optimistic Concurrency Control (Version Tokens)",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is the Lost Update problem, and how does Optimistic Concurrency Control (OCC) prevent it using version tokens?",
    quickAnswer: "A **Lost Update** occurs when two users read the same record simultaneously, modify it in their browser/client, and save changes back. User B's commit completely overwrites User A's changes without knowing User A modified the record. **Optimistic Concurrency Control (OCC)** prevents this without database locks by adding a `version INT` column: updates conditionally match on `WHERE id = ? AND version = current_version`, incrementing `version = version + 1`.",
    detailedAnswer: "OCC Implementation Architecture:\n1. Read Phase: Application fetches row state including version: `SELECT id, balance, version FROM accounts WHERE id = 1` (reads `version = 5`).\n2. User Think Time: No database locks are held while the user types in their browser.\n3. Write Phase: Application issues update checking the version:\n   ```sql\n   UPDATE accounts SET balance = 500, version = version + 1 WHERE id = 1 AND version = 5;\n   ```\n4. Collision Detection: Inspect rows affected. If `rows_affected == 0`, a concurrent user already committed `version 6`. The application aborts or reloads the record, informing the user of the conflict.",
    code: `-- Optimistic Concurrency Control (OCC) Pattern
CREATE TABLE product_inventory (
    item_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    stock INT NOT NULL,
    version INT NOT NULL DEFAULT 1 -- OCC version token!
);

-- Application updates stock conditionally checking version:
UPDATE product_inventory 
SET stock = stock - 1,
    version = version + 1 -- Increment version token
WHERE item_id = 42 
  AND version = 3;        -- Match version fetched during read phase!

-- In Node.js / Python application:
-- if (result.rowCount === 0) {
--   throw new Error("Conflict: Record was modified by another user. Reloading...");
-- }`,
    recallHint: "Lost Update = User B overwrites User A; OCC adds version column; UPDATE ... WHERE id = ? AND version = ? checks rowCount.",
    interviewTip: "Explain why OCC is superior to long-held database locks for web applications: users cannot hold locks while reading web forms.",
    tags: ["lost-updates", "optimistic-concurrency-control", "occ", "version-tokens", "application-patterns"]
  }),

  createCard({
    idNum: 93,
    category: "Transactions & ACID Concurrency",
    concept: "Pessimistic Locking vs Optimistic Locking Strategies",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When should you choose Pessimistic Locking over Optimistic Locking in relational database systems?",
    quickAnswer: "**Pessimistic Locking** (`SELECT ... FOR UPDATE`) assumes conflicts WILL happen and physically locks rows at the database engine level until transaction commit; use it when collision probability is high, contention is fierce (flash sales, high-frequency banking ledgers), and rolling back/retrying is expensive. **Optimistic Locking** (version tokens) assumes conflicts are rare, holds zero locks, and checks versions at commit time; use it for low-contention CRUD web APIs with human think time.",
    detailedAnswer: "Detailed Comparison Matrix:\n- Pessimistic Locking:\n  - Mechanism: Database row locks (`FOR UPDATE`).\n  - Pros: 100% guarantee; prevents race conditions upfront; no application retry loops needed.\n  - Cons: Causes connection blocking, lock contention queues, reduced concurrency, risk of deadlocks.\n  - Best for: Stock reservation during a 10-second checkout transaction.\n- Optimistic Locking:\n  - Mechanism: Application version checks (`WHERE version = 5`).\n  - Pros: High scalability; zero locks held in database; no deadlocks.\n  - Cons: Requires retry loops on collision; high contention causes repeated failure.",
    code: `-- 1. PESSIMISTIC LOCKING: Locks row immediately during transaction
BEGIN;
SELECT balance FROM customer_wallets 
WHERE wallet_id = 1001 
FOR UPDATE; -- Holds exclusive lock on row!

UPDATE customer_wallets SET balance = balance - 50.00 WHERE wallet_id = 1001;
COMMIT; -- Lock released

-- 2. OPTIMISTIC LOCKING: No lock during read; checks version at update
-- Read: SELECT balance, version FROM customer_wallets WHERE wallet_id = 1001; (version = 12)
UPDATE customer_wallets 
SET balance = balance - 50.00, version = version + 1 
WHERE wallet_id = 1001 AND version = 12;`,
    recallHint: "Pessimistic = lock upfront with FOR UPDATE (high contention); Optimistic = version column check (low contention, web forms).",
    interviewTip: "State the rule: 'Never use pessimistic locks across user think time (e.g. while an HTTP request is waiting on human input); only hold pessimistic locks inside millisecond database transactions.'",
    tags: ["pessimistic-locking", "optimistic-locking", "for-update", "concurrency-strategy", "system-design"]
  }),

  createCard({
    idNum: 94,
    category: "Transactions & ACID Concurrency",
    concept: "Two-Phase Locking (2PL) Protocol & Serializability Guarantees",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the Two-Phase Locking (2PL) protocol, and how do the Growing Phase and Shrinking Phase guarantee serializability?",
    quickAnswer: "**Two-Phase Locking (2PL)** is a concurrency control protocol that mathematically guarantees serializability. A transaction must execute in two distinct phases: 1) **Growing Phase**: The transaction may acquire locks, but CANNOT release any locks; and 2) **Shrinking Phase**: The transaction may release locks, but CANNOT acquire any new locks. Once a transaction releases its very first lock, it can never acquire another lock.",
    detailedAnswer: "2PL Variants & Proof:\n1. Mathematical Guarantee: 2PL ensures that the serialization graph of all transactions contains no cycles, proving conflict serializability.\n2. Strict 2PL (S2PL): All exclusive (write) locks are held until the very end of the transaction (`COMMIT` or `ROLLBACK`). Prevents cascading aborts.\n3. Rigorous 2PL (SS2PL): Both shared (read) and exclusive (write) locks are held until transaction commit. This is the implementation used by traditional lock-based relational systems.\n4. Vulnerability: 2PL is susceptible to deadlocks; systems implementing 2PL require background deadlock detection.",
    code: `-- Conceptual 2PL Lifecycle in SQL:
BEGIN TRANSACTION;

-- GROWING PHASE: Locks are acquired
SELECT * FROM inventory WHERE item_id = 10 FOR SHARE;    -- Lock 1 acquired
SELECT * FROM ledger WHERE entry_id = 100 FOR UPDATE;    -- Lock 2 acquired
UPDATE ledger SET amount = amount + 50 WHERE entry_id = 100;

-- SHRINKING PHASE (Strict 2PL releases all locks atomically at COMMIT):
COMMIT; -- All locks released simultaneously!`,
    breakdown: [
      "Growing phase: only acquires locks.",
      "Shrinking phase: only releases locks.",
      "Guarantees conflict serializability mathematically."
    ],
    recallHint: "2PL has Growing Phase (acquire locks only) and Shrinking Phase (release locks only); Strict 2PL holds locks until COMMIT.",
    interviewTip: "Clarify that 2PL guarantees serializability, but does NOT prevent deadlocks; lock-based 2PL engines require deadlock detectors.",
    tags: ["two-phase-locking", "2pl", "strict-2pl", "conflict-serializability", "concurrency-theory"]
  }),

  createCard({
    idNum: 95,
    category: "Transactions & ACID Concurrency",
    concept: "Deadlocks in SQL: Circular Wait Dependencies & Resolution",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is a Deadlock in SQL, what are the Coffman conditions, and what is the #1 architectural rule to prevent them?",
    quickAnswer: "A **Deadlock** is a mutual-blocking impasse where Transaction A holds Lock 1 and waits for Lock 2, while Transaction B holds Lock 2 and waits for Lock 1. Neither can proceed. Database engines detect the cycle in their 'Wait-For' graph and forcefully terminate one transaction (the 'deadlock victim') with a rollback error. The **#1 architectural rule to prevent deadlocks** is: **Always access and update multiple resources in the EXACT same deterministic alphabetical or numerical order across all application code**.",
    detailedAnswer: "The 4 Coffman Conditions for Deadlocks:\n1. Mutual Exclusion: Resources cannot be shared.\n2. Hold and Wait: A process holding resources requests new ones.\n3. No Preemption: Resources cannot be forcibly taken away.\n4. Circular Wait: A closed loop of processes where each waits for a resource held by the next.\n- Breaking the Cycle: If Transaction 1 and Transaction 2 both update Account 10 and Account 20, ensuring both transactions sort `WHERE id IN (10, 20) ORDER BY id` guarantees both transactions request Lock 10 first. The second transaction waits peacefully instead of deadlocking.",
    code: `-- THE DEADLOCK HAZARD (Non-deterministic order):
-- Worker 1: Locks Item A, then attempts to lock Item B
-- Worker 2: Locks Item B, then attempts to lock Item A
-- DEADLOCK COLLISION!

-- THE PRODUCTION FIX (Deterministic Sorted Resource Locking):
BEGIN;

-- Lock multiple rows in deterministic order using ORDER BY:
SELECT item_id, stock 
FROM inventory 
WHERE item_id IN (45, 12) 
ORDER BY item_id ASC -- Guarantees Lock 12 is acquired BEFORE Lock 45!
FOR UPDATE;

UPDATE inventory SET stock = stock - 1 WHERE item_id = 12;
UPDATE inventory SET stock = stock - 1 WHERE item_id = 45;

COMMIT;`,
    recallHint: "Deadlock = circular wait for locks; engine kills one victim; prevent deadlocks by always locking resources in sorted deterministic order.",
    interviewTip: "Recite the rule: 'Deadlocks are prevented by enforcing a global resource acquisition hierarchy (always lock rows in sorted order).' ",
    tags: ["deadlock", "circular-wait", "coffman-conditions", "deterministic-ordering", "deadlock-victim"]
  }),

  createCard({
    idNum: 96,
    category: "Transactions & ACID Concurrency",
    concept: "Production Transaction Sizing: Scope, Latency & Connection Holding",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why should transactions be kept as short as possible, and what are the catastrophic consequences of holding open transactions across network I/O?",
    quickAnswer: "Every active database transaction holds row/table locks and keeps a database worker connection checked out. If an application performs external network I/O (e.g. calling Stripe API, sending an email, or hashing passwords with bcrypt) **inside an open database transaction**, any 3-second network delay holds database locks for 3,000ms instead of 2ms. This causes connection pool exhaustion, cascades lock queues, and freezes the entire database cluster.",
    detailedAnswer: "Rules for Production Transaction Hygiene:\n1. The Golden Rule: **Never make external HTTP calls, RPC calls, or file uploads inside an open SQL transaction!**\n2. Sequence:\n   - Phase 1: Call Stripe API (Outside transaction).\n   - Phase 2: Open SQL transaction $\\to$ Execute fast 2ms database updates $\\to$ `COMMIT` immediately.\n   - Phase 3: Send confirmation email (Outside transaction).\n3. Autocommit Pitfall: Leaving connections in `autocommit = false` mode without closing them leaves connections 'idle in transaction', blocking autovacuum and table locks indefinitely.",
    code: `-- ANTI-PATTERN: External HTTP call inside transaction!
-- BEGIN;
-- UPDATE billing SET status = 'PROCESSING' WHERE id = 10;
-- ... Node.js awaits fetch('https://api.stripe.com/v1/charges') ... (Hangs for 5s!)
-- UPDATE billing SET status = 'SUCCESS' WHERE id = 10;
-- COMMIT;

-- CORRECT PRODUCTION PATTERN:
-- 1. Call external API outside of database transaction:
-- const charge = await stripe.charges.create({ ... });

-- 2. Open tight, millisecond-fast SQL transaction:
BEGIN;
UPDATE billing 
SET status = 'SUCCESS', external_tx_id = 'ch_12345', updated_at = CURRENT_TIMESTAMP 
WHERE id = 10;
INSERT INTO audit_log (action, record_id) VALUES ('CHARGE_SUCCESS', 10);
COMMIT; -- Finishes in 1 millisecond! Locks released immediately.`,
    recallHint: "Keep transactions short (milliseconds); never make external HTTP API calls inside a transaction; avoid connection pool starvation.",
    interviewTip: "Emphasize: 'Keep transaction scope strictly limited to atomic database updates. External API calls must live outside transaction boundaries.'",
    tags: ["transaction-sizing", "production-hygiene", "lock-holding", "external-api-trap", "connection-pool-starvation"]
  })
];

module.exports = cards;
