module.exports = [
  {
    id: "pg-ex-33",
    title: "High-Throughput Concurrent Job Queue with FOR UPDATE SKIP LOCKED",
    category: "Concurrency & Locking",
    difficulty: "must-know",
    whatThisCodeCovers: "Constructs an ACID-compliant, scalable message broker job queue where 50 background workers poll and lock distinct batches of jobs without blocking each other.",
    conceptsCovered: [
      "FOR UPDATE SKIP LOCKED",
      "Message Queue Pattern",
      "Lock Contention Elimination",
      "Writable CTE Worker Claim",
      "Linear Scaling Concurrency"
    ],
    code: `-- Job queue consumer query (Worker node poll)
WITH claimed_jobs AS (
    SELECT id 
    FROM background_tasks
    WHERE status = 'QUEUED' 
      AND run_at <= NOW()
    ORDER BY priority DESC, id ASC
    LIMIT 5
    FOR UPDATE SKIP LOCKED -- Key: skips any tasks already claimed by other workers!
)
UPDATE background_tasks bt
SET status = 'PROCESSING',
    locked_at = NOW(),
    worker_node = 'worker-us-east-1a'
FROM claimed_jobs
WHERE bt.id = claimed_jobs.id
RETURNING bt.id, bt.task_type, bt.payload;`,
    breakdown: [
      "FOR UPDATE locks the selected rows.",
      "SKIP LOCKED causes PostgreSQL to transparently skip past rows currently locked by concurrent workers.",
      "Workers never wait or deadlock on the queue table; workers scale linearly with CPU capacity.",
      "Atomic CTE updates task status to 'PROCESSING' and returns payloads immediately."
    ],
    expectedOutput: `id    | task_type     | payload
10401 | SEND_INVOICE  | {"invoice_id": 994}
10402 | SYNC_CRM      | {"customer_id": 412}`
  },

  {
    id: "pg-ex-34",
    title: "Non-Blocking Resource Reservation with SELECT FOR UPDATE NOWAIT",
    category: "Concurrency & Locking",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements an instantaneous seat reservation checkout that immediately aborts with an informative error if another customer is currently holding the seat.",
    conceptsCovered: [
      "FOR UPDATE NOWAIT",
      "Non-Blocking Concurrency",
      "Error 55P03 (lock_not_available)",
      "High-Traffic Ticketing",
      "Fast Failure Recovery"
    ],
    code: `-- Attempt to lock seat for checkout
BEGIN;

-- If seat is already locked by another checkout session, fail immediately without hanging!
SELECT seat_number, status, price 
FROM concert_seats
WHERE seat_number = 'A-12' 
  AND status = 'AVAILABLE'
FOR UPDATE NOWAIT;

-- If query succeeds, proceed to update:
UPDATE concert_seats 
SET status = 'RESERVED', held_until = NOW() + INTERVAL '10 minutes'
WHERE seat_number = 'A-12';

COMMIT;

-- In client code (Node.js/Express):
-- Catch error code '55P03' (lock_not_available) and return HTTP 409 Conflict:
-- "Seat A-12 is currently being checked out by another customer."`,
    breakdown: [
      "NOWAIT skips waiting for the row lock, failing immediately if locked.",
      "Prevents API requests from hanging for seconds during flash ticket sales.",
      "Returns SQLSTATE '55P03' so application code can immediately offer alternatives to the user."
    ],
    expectedOutput: `seat_number | status    | price
A-12        | AVAILABLE | 120.00
-- If locked by another connection:
-- ERROR: could not obtain lock on row in relation "concert_seats" (SQLSTATE 55P03)`
  },

  {
    id: "pg-ex-35",
    title: "Distributed Mutex & Cron Leader Election with Advisory Locks",
    category: "Concurrency & Locking",
    difficulty: "advanced",
    whatThisCodeCovers: "Coordinates a distributed scheduled cron worker across 10 Kubernetes pods using non-blocking transaction advisory locks (pg_try_advisory_xact_lock).",
    conceptsCovered: [
      "pg_try_advisory_xact_lock",
      "Distributed Mutex",
      "Cron Leader Election",
      "Zero Table Locking",
      "Transaction-Scoped Cleanup"
    ],
    code: `-- Kubernetes pod leader election query
BEGIN;

-- Attempt to acquire lock on an arbitrary 64-bit integer hash
SELECT pg_try_advisory_xact_lock(hashtext('daily_billing_cron_job')) AS is_leader;

-- If is_leader is TRUE:
-- Run the multi-million dollar billing calculation batch!
-- Lock is automatically released at COMMIT or ROLLBACK.

-- If is_leader is FALSE:
-- Another pod is already executing the batch; exit immediately.

COMMIT;`,
    breakdown: [
      "pg_try_advisory_xact_lock is non-blocking; returns boolean TRUE if lock was acquired, FALSE otherwise.",
      "Uses the shared memory advisory lock table; locks zero database rows and creates zero WAL.",
      "Transaction scoping guarantees automatic lock release even if the Kubernetes pod crashes mid-execution."
    ],
    expectedOutput: `is_leader
t (or f if running concurrently on another node)`
  },

  {
    id: "pg-ex-36",
    title: "High-Concurrency Account Transfers using FOR NO KEY UPDATE",
    category: "Concurrency & Locking",
    difficulty: "advanced",
    whatThisCodeCovers: "Executes double-entry balance transfers using FOR NO KEY UPDATE to prevent foreign key validation lock contention on parent tables.",
    conceptsCovered: [
      "FOR NO KEY UPDATE",
      "Foreign Key Lock Contention",
      "Deadlock Prevention",
      "Deterministic Ordering",
      "ACID Ledger Transfer"
    ],
    code: `-- Transfer $100 from Account 10 to Account 20
BEGIN;

-- 1. Lock accounts in deterministic sorted order to prevent deadlocks!
SELECT account_id, balance 
FROM bank_accounts
WHERE account_id IN (10, 20)
ORDER BY account_id
FOR NO KEY UPDATE; -- Weaker lock: allows concurrent FK checks to read accounts!

-- 2. Deduct from source
UPDATE bank_accounts SET balance = balance - 100 WHERE account_id = 10;

-- 3. Credit to destination
UPDATE bank_accounts SET balance = balance + 100 WHERE account_id = 20;

-- 4. Record audit entry
INSERT INTO transfer_audit (from_acc, to_acc, amount) VALUES (10, 20, 100);

COMMIT;`,
    breakdown: [
      "ORDER BY account_id ensures all threads lock accounts in identical numerical order, preventing deadlocks.",
      "FOR NO KEY UPDATE does not block concurrent foreign key checks (FOR KEY SHARE) from child order tables.",
      "Significantly increases throughput compared to aggressive FOR UPDATE."
    ],
    expectedOutput: `account_id | balance
10         | 4900.00
20         | 2600.00`
  },

  {
    id: "pg-ex-37",
    title: "Detecting and Terminating Root Blocking Queries with pg_blocking_pids",
    category: "Concurrency & Locking",
    difficulty: "advanced",
    whatThisCodeCovers: "Diagnoses production lock contention, identifying the root query causing hundreds of incoming requests to freeze and terminating it cleanly.",
    conceptsCovered: [
      "pg_blocking_pids()",
      "pg_stat_activity",
      "Lock Tree Diagnostics",
      "Idle in Transaction",
      "pg_terminate_backend()"
    ],
    code: `-- Find all blocked queries and the exact root blocker holding the lock
SELECT 
    blocked.pid AS blocked_pid,
    blocked.usename AS blocked_user,
    now() - blocked.query_start AS wait_duration,
    blocked.query AS blocked_statement,
    blocking.pid AS root_blocking_pid,
    blocking.usename AS blocking_user,
    blocking.state AS blocking_state,
    blocking.query AS blocking_statement
FROM pg_stat_activity blocked
JOIN LATERAL unnest(pg_blocking_pids(blocked.pid)) AS blocker_pid ON true
JOIN pg_stat_activity blocking ON blocking.pid = blocker_pid
WHERE NOT blocked.wait_event IS NULL;

-- Gracefully kill the root blocking process if stuck idle in transaction
SELECT pg_terminate_backend(14205);`,
    breakdown: [
      "pg_blocking_pids(pid) traverses the PostgreSQL lock wait-graph.",
      "LATERAL unnest joins against pg_stat_activity to show both blocked and blocking queries.",
      "Pinpoints 'idle in transaction' processes that held locks and forgot to commit.",
      "pg_terminate_backend terminates the connection immediately."
    ],
    expectedOutput: `blocked_pid | blocked_user | wait_duration | root_blocking_pid | blocking_state       | blocking_statement
25401       | app_user     | 00:02:14      | 14205             | idle in transaction  | SELECT * FROM orders FOR UPDATE;`
  },

  {
    id: "pg-ex-38",
    title: "Zero-Downtime Safe DDL Migration with lock_timeout",
    category: "Concurrency & Locking",
    difficulty: "must-know",
    whatThisCodeCovers: "Deploys a zero-downtime database migration that sets an aggressive lock_timeout to avoid Head-of-Line blocking and connection pool exhaustion.",
    conceptsCovered: [
      "SET LOCAL lock_timeout",
      "Head-of-Line Blocking",
      "Safe DDL Deployment",
      "PostgreSQL 11+ Default Optimization",
      "Automated Migration Pipelines"
    ],
    code: `-- Zero-Downtime Production Migration Script
BEGIN;

-- 1. If we cannot acquire the AccessExclusiveLock within 2 seconds, fail immediately!
SET LOCAL lock_timeout = '2s';

-- 2. If the operation itself takes longer than 15 seconds, abort
SET LOCAL statement_timeout = '15s';

-- 3. Add column with default (PostgreSQL 11+ metadata-only update: ZERO table rewrite!)
ALTER TABLE customer_accounts 
ADD COLUMN loyalty_tier TEXT NOT NULL DEFAULT 'STANDARD';

COMMIT;

-- Deployment script logic:
-- If script throws 55P03 (lock_timeout), sleep 5 seconds and retry up to 5 times.`,
    breakdown: [
      "SET LOCAL lock_timeout prevents the DDL from waiting in the FIFO queue and blocking subsequent SELECTs.",
      "In PG 11+, ADD COLUMN with constant DEFAULT is instant because the default is stored in pg_attribute without rewriting heap pages.",
      "Prevents cascading connection pool exhaustion during peak web traffic."
    ],
    expectedOutput: `ALTER TABLE
COMMIT`
  },

  {
    id: "pg-ex-39",
    title: "Zero-Downtime Foreign Key Creation with NOT VALID & VALIDATE CONSTRAINT",
    category: "Concurrency & Locking",
    difficulty: "advanced",
    whatThisCodeCovers: "Adds a foreign key constraint to a 50-million row table in two phases without holding an exclusive table lock that blocks application writes.",
    conceptsCovered: [
      "ADD CONSTRAINT ... NOT VALID",
      "VALIDATE CONSTRAINT",
      "Zero-Downtime DDL",
      "ShareRowExclusiveLock Avoidance",
      "Large Table Migrations"
    ],
    code: `-- PHASE 1: Add constraint as NOT VALID (Instantaneous: no table scan, no lock!)
BEGIN;
SET LOCAL lock_timeout = '2s';

ALTER TABLE order_items 
ADD CONSTRAINT fk_order_items_product 
FOREIGN KEY (product_id) REFERENCES products(id) NOT VALID;

COMMIT;
-- At this point, new INSERTs and UPDATEs are validated, but existing rows have not been scanned.

-- PHASE 2: Validate existing rows in the background without blocking writes!
-- Takes only a weak ShareUpdateExclusiveLock (reads and writes run concurrently)
ALTER TABLE order_items 
VALIDATE CONSTRAINT fk_order_items_product;`,
    breakdown: [
      "Phase 1 registers the constraint in catalogs instantly without scanning the 50M rows.",
      "Phase 2 scans existing rows under a weak lock that allows concurrent SELECT, INSERT, UPDATE, and DELETE.",
      "Eliminates hours of production downtime on massive relations."
    ],
    expectedOutput: `ALTER TABLE (Phase 1: 5ms)
ALTER TABLE (Phase 2: validated online in background)`
  },

  {
    id: "pg-ex-40",
    title: "Handling Serialization Failures (40001) in Repeatable Read Transactions",
    category: "Concurrency & Locking",
    difficulty: "advanced",
    whatThisCodeCovers: "Demonstrates transaction isolation failure under REPEATABLE READ and provides a Node.js retry-loop pattern to catch and replay error 40001.",
    conceptsCovered: [
      "REPEATABLE READ",
      "Serialization Failure (40001)",
      "First-Committer-Wins",
      "Application Retry Loops",
      "Exponential Backoff"
    ],
    code: `-- Node.js / Express Service executing with Retry on 40001
const { db } = require('nexora');

async function executeWithRetry(fn, maxRetries = 5) {
  let attempt = 0;
  while (attempt < maxRetries) {
    try {
      return await db.transaction(async (tx) => {
        // Enforce Repeatable Read isolation
        await tx.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        return await fn(tx);
      });
    } catch (err) {
      // 40001: could not serialize access due to concurrent update
      if (err.code === '40001' && attempt < maxRetries - 1) {
        attempt++;
        const backoff = Math.floor(Math.random() * 50 * Math.pow(2, attempt));
        console.warn(\`Serialization conflict detected (40001). Retrying attempt \${attempt} in \${backoff}ms...\`);
        await new Promise(resolve => setTimeout(resolve, backoff));
      } else {
        throw err;
      }
    }
  }
}`,
    breakdown: [
      "Under Repeatable Read, concurrent modifications to the same row trigger error code 40001.",
      "The application must never crash on 40001; it must catch the error and replay the transaction.",
      "Exponential backoff with jitter prevents thundering herd lock conflicts on replay."
    ],
    expectedOutput: `Serialization conflict detected (40001). Retrying attempt 1 in 45ms...
Transaction committed successfully on retry.`
  },

  {
    id: "pg-ex-41",
    title: "Diagnosing and Resolving In-Flight Deadlocks from Logs",
    category: "Concurrency & Locking",
    difficulty: "intermediate",
    whatThisCodeCovers: "Simulates and catches a circular deadlock between two transactions, configuring log_lock_waits to capture the offending SQL statements in logs.",
    conceptsCovered: [
      "Deadlock Detection (40P01)",
      "deadlock_timeout",
      "log_lock_waits",
      "Deterministic Ordering Fix",
      "Lock Wait Analysis"
    ],
    code: `-- Configure postgresql.conf to capture lock waits and deadlocks
-- log_lock_waits = on
-- deadlock_timeout = 1000ms

-- SESSION A:
BEGIN;
UPDATE inventory SET stock = stock - 1 WHERE item_id = 1; -- locks 1

-- SESSION B:
BEGIN;
UPDATE inventory SET stock = stock - 1 WHERE item_id = 2; -- locks 2

-- SESSION A:
UPDATE inventory SET stock = stock - 1 WHERE item_id = 2; -- WAITING for Session B!

-- SESSION B:
UPDATE inventory SET stock = stock - 1 WHERE item_id = 1; 
-- DEADLOCK DETECTED!
-- ERROR: deadlock detected (SQLSTATE 40P01)
-- Detail: Process 101 waits for ShareLock on transaction 102; Process 102 waits for ShareLock on transaction 101.`,
    breakdown: [
      "PostgreSQL checks for deadlocks after deadlock_timeout (default 1 second).",
      "Detects the circular wait graph and terminates Session B with error 40P01.",
      "Fix: Always update items in deterministic order: UPDATE inventory ... WHERE item_id IN (1, 2) ORDER BY item_id."
    ],
    expectedOutput: `ERROR: deadlock detected
DETAIL: Process 101 waits for ExclusiveLock on tuple (0,2); Process 102 waits for ExclusiveLock on tuple (0,1).`
  },

  {
    id: "pg-ex-42",
    title: "Two-Phase Commit (2PC) Distributed Preparation & Orphan Cleanup",
    category: "Concurrency & Locking",
    difficulty: "advanced",
    whatThisCodeCovers: "Prepares a distributed two-phase transaction using PREPARE TRANSACTION and provides an automated cleanup script for orphaned prepared transactions.",
    conceptsCovered: [
      "Two-Phase Commit (2PC)",
      "PREPARE TRANSACTION",
      "COMMIT PREPARED",
      "pg_prepared_xacts",
      "Orphaned XID Horizon Bloat"
    ],
    code: `-- 1. Application Coordinator prepares distributed transaction
BEGIN;
UPDATE ledgers SET balance = balance - 500 WHERE account_id = 'ACC-1';
PREPARE TRANSACTION 'dist_tx_chase_to_wells_9901';

-- 2. Inspect active prepared transactions (persisted across reboots!)
SELECT 
    gid, 
    prepared, 
    owner, 
    database,
    age(transaction) AS xid_age
FROM pg_prepared_xacts;

-- 3. Commit Phase 2 (Once external participants acknowledge)
COMMIT PREPARED 'dist_tx_chase_to_wells_9901';

-- 4. EMERGENCY: Rollback abandoned orphan if coordinator crashed
-- ROLLBACK PREPARED 'dist_tx_chase_to_wells_9901';`,
    breakdown: [
      "PREPARE TRANSACTION persists transaction state and locks to pg_twophase on disk.",
      "Survives database restarts until explicitly committed or aborted.",
      "Orphaned prepared transactions hold open the database xmin, causing catastrophic bloat; must be monitored via pg_prepared_xacts."
    ],
    expectedOutput: `gid                             | prepared                | owner    | xid_age
dist_tx_chase_to_wells_9901     | 2026-11-04 11:25:00+00  | app_user | 120`
  }
];
