const { createCard } = require("../pg_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 73,
    category: "Locking, Concurrency & Transaction Isolation",
    concept: "PostgreSQL 8-Level Table Lock Hierarchy (AccessShare to AccessExclusive)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is PostgreSQL's 8-level table lock hierarchy, and which lock modes conflict with simple SELECT queries?",
    quickAnswer: "PostgreSQL manages table concurrency through 8 distinct table lock modes ranging from `AccessShareLock` (acquired by `SELECT`) to `AccessExclusiveLock` (acquired by `DROP TABLE`, `ALTER TABLE`, or `VACUUM FULL`). `AccessExclusiveLock` is the ONLY lock mode in PostgreSQL that conflicts with and blocks `AccessShareLock` (`SELECT`), meaning reads and writes run concurrently except during aggressive schema modifications.",
    detailedAnswer: "The 8 Table Lock Modes (weakest to strongest):\n1. `AccessShareLock`: Acquired by `SELECT`.\n2. `RowShareLock`: Acquired by `SELECT ... FOR UPDATE / FOR SHARE`.\n3. `RowExclusiveLock`: Acquired by `INSERT`, `UPDATE`, `DELETE`.\n4. `ShareUpdateExclusiveLock`: Acquired by `VACUUM` (non-full), `ANALYZE`, `CREATE INDEX CONCURRENTLY`.\n5. `ShareLock`: Acquired by `CREATE INDEX` (non-concurrent).\n6. `ShareRowExclusiveLock`: Acquired by `CREATE TRIGGER`.\n7. `ExclusiveLock`: Acquired by `REFRESH MATERIALIZED VIEW CONCURRENTLY`.\n8. `AccessExclusiveLock`: Acquired by `ALTER TABLE`, `DROP TABLE`, `TRUNCATE`, `VACUUM FULL`, `REINDEX` (non-concurrent). Conflicts with ALL other locks, including `SELECT`.",
    code: `-- Inspect current table locks and their granted status
SELECT 
    l.pid, 
    c.relname, 
    l.mode, 
    l.granted,
    a.query
FROM pg_locks l
JOIN pg_class c ON c.oid = l.relation
JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.locktype = 'relation' 
  AND c.relname = 'orders';`,
    recallHint: "8 lock levels; AccessShare (SELECT) only conflicts with AccessExclusive (ALTER/DROP/TRUNCATE). Writes (RowExclusive) never block SELECT.",
    interviewTip: "Emphasize that `INSERT/UPDATE/DELETE` take `RowExclusiveLock`, which does NOT conflict with `AccessShareLock` (`SELECT`). Readers never block writers and writers never block readers.",
    tags: ["table-locks", "lock-hierarchy", "access-exclusive", "concurrency", "pg_locks"]
  }),

  createCard({
    idNum: 74,
    category: "Locking, Concurrency & Transaction Isolation",
    concept: "Row-Level Locking Modes (FOR UPDATE vs FOR NO KEY UPDATE vs FOR SHARE)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the difference between FOR UPDATE, FOR NO KEY UPDATE, FOR SHARE, and FOR KEY SHARE in PostgreSQL?",
    quickAnswer: "`FOR UPDATE` locks the entire row against all concurrent writes and row locks (needed when changing primary/unique keys). `FOR NO KEY UPDATE` is a weaker lock acquired by standard `UPDATE`s that do NOT modify primary or unique keys; it allows concurrent transactions to acquire `FOR KEY SHARE` (e.g. foreign key checks). `FOR SHARE` locks against updates, while `FOR KEY SHARE` permits concurrent `FOR NO KEY UPDATE` operations.",
    detailedAnswer: "Row Locking Matrix:\n1. `FOR UPDATE`: Strongest exclusive row lock. Blocks all other `FOR UPDATE`, `FOR NO KEY UPDATE`, `FOR SHARE`, and `FOR KEY SHARE` locks.\n2. `FOR NO KEY UPDATE`: Acquired by `UPDATE` statements modifying non-key attributes (e.g. updating `email` or `status` where PK is untouched). Does NOT block foreign key validation (`FOR KEY SHARE`).\n3. `FOR SHARE`: Shared read lock. Blocks `FOR UPDATE` and `FOR NO KEY UPDATE`.\n4. `FOR KEY SHARE`: Weakest row lock. Taken by foreign key reference checks. Allows concurrent non-key `UPDATE`s on the referenced parent row without deadlock contention.",
    code: `-- 1. Best practice: Use FOR NO KEY UPDATE when not altering Primary Keys
BEGIN;
SELECT * FROM account_balances 
WHERE account_id = 100 
FOR NO KEY UPDATE;

UPDATE account_balances 
SET balance = balance - 50 
WHERE account_id = 100;
COMMIT;

-- 2. Concurrently referencing table via Foreign Key acquires FOR KEY SHARE automatically:
-- INSERT INTO orders (account_id, amount) VALUES (100, 50); -- Runs concurrently without blocking!`,
    recallHint: "FOR NO KEY UPDATE allows concurrent foreign key checks (FOR KEY SHARE); reserve FOR UPDATE strictly for PK/unique key mutations.",
    interviewTip: "Highlight `FOR NO KEY UPDATE` as a high-throughput best practice: using `FOR UPDATE` unnecessarily blocks child table inserts due to foreign key locking.",
    tags: ["for-update", "for-no-key-update", "for-share", "for-key-share", "row-locking"]
  }),

  createCard({
    idNum: 75,
    category: "Locking, Concurrency & Transaction Isolation",
    concept: "Concurrency Queue Patterns: SKIP LOCKED and NOWAIT",
    priority: "must-know",
    difficulty: "must-know",
    question: "How do SKIP LOCKED and NOWAIT enable high-throughput, race-condition-free job queues in PostgreSQL?",
    quickAnswer: "`SKIP LOCKED` skips past any rows currently locked by concurrent transactions and immediately locks the next unlocked matching row, completely eliminating lock contention and serial queue bottlenecks across multiple parallel workers. `NOWAIT` immediately aborts the query with an error (`55P03: lock_not_available`) instead of waiting for a held lock to be released.",
    detailedAnswer: "Job Queue Mechanics with SKIP LOCKED:\n1. Problem with standard `FOR UPDATE`: 10 background worker threads querying `WHERE status = 'QUEUED' LIMIT 1 FOR UPDATE` will all attempt to grab the exact same first row, forcing 9 workers to block and serialize.\n2. Solution with `SKIP LOCKED`: Each worker skips locked rows and instantly locks a distinct batch of rows. Concurrency scales linearly with CPU cores.\n3. Combining with `RETURNING`: Update and lock in a single atomic CTE.",
    code: `-- Production-grade FIFO job queue worker query
WITH next_jobs AS (
    SELECT id 
    FROM job_queue
    WHERE status = 'QUEUED' 
      AND scheduled_at <= NOW()
    ORDER BY priority DESC, id ASC
    LIMIT 10
    FOR UPDATE SKIP LOCKED
)
UPDATE job_queue jq
SET status = 'PROCESSING',
    locked_at = NOW(),
    worker_id = 'worker-node-01'
FROM next_jobs
WHERE jq.id = next_jobs.id
RETURNING jq.id, jq.payload;`,
    recallHint: "SKIP LOCKED skips locked rows to let parallel workers process distinct items without waiting; NOWAIT fails immediately if locked.",
    interviewTip: "This is a quintessential system design question: 'Can PostgreSQL replace Redis/RabbitMQ for job queues?' Answer: 'Yes, using `FOR UPDATE SKIP LOCKED` for rock-solid ACID job queues.'",
    tags: ["skip-locked", "nowait", "job-queue", "message-broker", "concurrency"]
  }),

  createCard({
    idNum: 76,
    category: "Locking, Concurrency & Transaction Isolation",
    concept: "PostgreSQL Advisory Locks (Session vs Transaction-Scoped)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are PostgreSQL Advisory Locks and what is the difference between session-level and transaction-level advisory locks?",
    quickAnswer: "Advisory Locks are application-defined distributed mutexes managed by the PostgreSQL lock manager using arbitrary 64-bit integers (or two 32-bit integers) without locking any table rows or disk pages. Session-level advisory locks (`pg_advisory_lock()`) persist until explicitly unlocked or until the connection disconnects. Transaction-level advisory locks (`pg_advisory_xact_lock()`) automatically release when the current transaction commits or rolls back.",
    detailedAnswer: "Advisory Lock Details:\n1. Zero Table Locking: Fast, lightweight locks in shared memory. No row modifications, no WAL generation, and no dead tuples.\n2. Types:\n   - `pg_advisory_lock(key)`: Session-level. Must call `pg_advisory_unlock(key)` or disconnect.\n   - `pg_advisory_xact_lock(key)`: Transaction-level. Safe against connection pooling leaks because `COMMIT`/`ROLLBACK` releases it automatically.\n   - `pg_try_advisory_xact_lock(key)`: Non-blocking; returns boolean `true` if acquired or `false` if another worker holds it.\n3. Common Use Cases: Distributed cron job leader election, payment idempotency gates, single-flight webhook processors.",
    code: `-- 1. Non-blocking distributed cron lock (Transaction Scoped)
BEGIN;
SELECT pg_try_advisory_xact_lock(hashtext('nightly_billing_job')) AS lock_acquired;

-- If lock_acquired is true, execute the heavy billing batch!
-- Lock is automatically released at COMMIT or ROLLBACK.
COMMIT;

-- 2. Hash an arbitrary business ID (e.g. customer_id) into a 64-bit lock
SELECT pg_advisory_xact_lock(hashtext('customer_payment:' || 4201));`,
    recallHint: "Advisory locks are app-defined 64-bit integer mutexes; xact locks release on COMMIT; try_ locks return boolean without blocking.",
    interviewTip: "Always recommend transaction-scoped (`_xact_lock`) over session-scoped locks when using connection poolers like PgBouncer, as unreleased session locks can poison recycled connections.",
    tags: ["advisory-locks", "distributed-mutex", "pg_advisory_xact_lock", "leader-election", "concurrency"]
  }),

  createCard({
    idNum: 77,
    category: "Locking, Concurrency & Transaction Isolation",
    concept: "Deadlock Detection Architecture & deadlock_timeout",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does PostgreSQL's deadlock detector operate, and what triggers a 40P01 deadlock_detected error?",
    quickAnswer: "PostgreSQL runs an internal deadlock detection cycle whenever a transaction has been blocked waiting for a lock for longer than `deadlock_timeout` (default 1 second). The engine builds a directed dependency 'Wait-For' graph of all waiting processes. If a circular dependency is detected (Process A waits for B, and Process B waits for A), PostgreSQL breaks the cycle by arbitrarily terminating one of the transactions with a `40P01: deadlock detected` error and rolling it back.",
    detailedAnswer: "Deadlock Detection Mechanics:\n1. Cost Optimization: Checking for deadlocks is CPU-intensive. Postgres does NOT check on every lock request; it only runs the graph search after a transaction has waited for `deadlock_timeout` (1000ms).\n2. Lock Reordering: Before failing, the engine attempts to rearrange lock queues if multiple lock modes are compatible.\n3. Prevention Best Practice:\n   - Always update multiple rows/tables in the EXACT same alphabetical or numeric order across all application services (`ORDER BY id`).\n   - Keep transactions short and focused; never make external HTTP API calls inside an open SQL transaction.",
    code: `-- Check current deadlock timeout setting
SHOW deadlock_timeout; -- default: 1s

-- Log statement triggering deadlock in PostgreSQL logs
-- postgresql.conf: log_lock_waits = on

-- Inspect blocked queries and who is holding their locks
SELECT 
    blocked_locks.pid     AS blocked_pid,
    blocked_activity.usename  AS blocked_user,
    blocking_locks.pid    AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query    AS blocked_statement,
    blocking_activity.query   AS current_statement_in_blocking_process
FROM  pg_catalog.pg_locks         blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks         blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;`,
    recallHint: "Deadlock detector runs after deadlock_timeout (1s); finds circular wait cycles in lock graph and rolls back one transaction.",
    interviewTip: "The #1 rule for preventing deadlocks: always access and lock rows in deterministic sorted order (e.g. `WHERE id IN (...) ORDER BY id FOR UPDATE`).",
    tags: ["deadlock", "deadlock_timeout", "wait-for-graph", "lock-contention", "error-handling"]
  }),

  createCard({
    idNum: 78,
    category: "Locking, Concurrency & Transaction Isolation",
    concept: "Read Committed Isolation Level: Per-Statement Snapshots & Read Skew",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Read Committed isolation work in PostgreSQL, and why can two identical SELECTs within the same transaction return different data?",
    quickAnswer: "PostgreSQL's default isolation level is `READ COMMITTED`. Under this level, each individual SQL statement within a transaction obtains a fresh MVCC snapshot of the database at the exact millisecond the statement begins. Consequently, if another transaction commits changes between two identical `SELECT` statements in the same transaction, the second query sees the newly committed data (Non-Repeatable Read / Read Skew).",
    detailedAnswer: "Read Committed Characteristics:\n1. Statement-Level Snapshot: Every statement sees only changes committed prior to that statement's start time.\n2. Concurrency: Highest throughput; never encounters serialization failure rollback errors (`40001`).\n3. Concurrent Updates: If statement B attempts to update a row that was just updated by uncommitted statement A, statement B blocks. Once A commits, B re-evaluates the `WHERE` condition on the newly updated row version (the 'eval plan qual' mechanism).\n4. Phantom Reads & Non-Repeatable Reads are both permitted.",
    code: `-- Demonstrate Read Committed behavior
BEGIN; -- Default isolation is READ COMMITTED
SELECT count(*) FROM orders; -- Sees 100 rows

-- Concurrently, another connection commits an INSERT of 5 rows

SELECT count(*) FROM orders; -- Sees 105 rows! (Statement-level snapshot refreshed)
COMMIT;`,
    recallHint: "Read Committed creates a new snapshot per statement; allows Non-Repeatable Reads; highest concurrency with zero serialization errors.",
    interviewTip: "Clarify that in PostgreSQL, `READ COMMITTED` prevents Dirty Reads (reading uncommitted data is physically impossible due to MVCC), but allows Non-Repeatable Reads and Phantoms.",
    tags: ["read-committed", "transaction-isolation", "snapshot", "read-skew", "eval-plan-qual"]
  }),

  createCard({
    idNum: 79,
    category: "Locking, Concurrency & Transaction Isolation",
    concept: "Repeatable Read Isolation Level & 40001 Serialization Failures",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Repeatable Read isolation work in PostgreSQL, and what causes a 'could not serialize access due to concurrent update' error?",
    quickAnswer: "Under `REPEATABLE READ`, a transaction creates a single MVCC snapshot when its first non-transaction-control statement executes, and freezes that snapshot for the entire duration of the transaction. If a `REPEATABLE READ` transaction attempts to `UPDATE` or `DELETE` a row that was updated and committed by a concurrent transaction after the snapshot was taken, PostgreSQL immediately aborts the statement with error `40001: could not serialize access due to concurrent update`.",
    detailedAnswer: "Repeatable Read Mechanics:\n1. Stable Snapshot: Multiple `SELECT`s within the transaction always return the exact same data, eliminating Non-Repeatable Reads and Phantom Reads (PostgreSQL's Repeatable Read prevents phantoms!).\n2. First-Committer-Wins: If transaction T1 reads row R, and concurrent transaction T2 updates and commits R, a subsequent attempt by T1 to `UPDATE R` fails immediately. T1 cannot re-evaluate against the old snapshot.\n3. Application Requirement: Applications using `REPEATABLE READ` MUST implement retry loops to catch and replay aborted transactions on error code `40001`.",
    code: `-- Using Repeatable Read isolation
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ;

-- First query takes the transaction snapshot
SELECT SUM(balance) FROM bank_accounts;

-- Any subsequent query sees this exact same snapshot, even if accounts are modified concurrently
SELECT SUM(balance) FROM bank_accounts; -- Identical sum guaranteed

-- If a concurrent transaction updated an account we try to modify:
-- ERROR: could not serialize access due to concurrent update (SQLSTATE 40001)
COMMIT;`,
    recallHint: "Repeatable Read freezes snapshot for entire transaction; first committer wins; concurrent updates fail with 40001 and require application retries.",
    interviewTip: "Highlight that contrary to SQL-92 standards (which allow Phantoms under Repeatable Read), PostgreSQL's MVCC implementation prevents Phantom Reads even at the Repeatable Read level.",
    tags: ["repeatable-read", "snapshot-isolation", "serialization-failure", "first-committer-wins", "retry-loops"]
  }),

  createCard({
    idNum: 80,
    category: "Locking, Concurrency & Transaction Isolation",
    concept: "Serializable Snapshot Isolation (SSI) & SIREAD Predicate Locks",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Serializable Snapshot Isolation (SSI) work in PostgreSQL, and how do SIREAD locks detect write skew?",
    quickAnswer: "Serializable Snapshot Isolation (SSI) guarantees full mathematical serializability (as if transactions ran one after another) without locking tables or blocking readers. PostgreSQL tracks read/write dependencies using non-blocking in-memory `SIREAD` predicate locks. If a cycle of dangerous dependency edges (rw-antidependencies) is formed that indicates Write Skew anomaly, the engine aborts one of the transactions with a `serialization_failure` (40001).",
    detailedAnswer: "SSI & SIREAD Internals:\n1. Non-Blocking Locks: `SIREAD` locks are not physical locks; they do not block queries! They are lightweight markers stored in shared memory tracking what data was read.\n2. Write Skew Detection: Detects anomalies that Repeatable Read cannot (e.g. the classic Doctor-on-Call problem where two doctors concurrently take off-call duty, leaving zero doctors on call).\n3. Dependency Graph: Postgres monitors rw-antidependency edges between transactions. When a cycle (T1 -> T2 -> T1) is formed, one transaction is chosen as the pivot and cancelled.\n4. Scalability: SSI is vastly faster than traditional two-phase locking (2PL) systems like MySQL or SQL Server.",
    code: `-- Enable Serializable Isolation
BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

-- Doctor-on-call scenario: Check if at least 2 doctors are on duty
SELECT count(*) FROM doctors WHERE on_call = true;

-- If count >= 2, this doctor goes off call
UPDATE doctors SET on_call = false WHERE id = 1;

-- If concurrent transaction did the same for doctor 2, COMMIT raises 40001!
COMMIT;

-- Inspect active SIREAD predicate locks
SELECT * FROM pg_locks WHERE mode = 'SIReadLock';`,
    recallHint: "SSI provides true serializability without blocking via SIREAD predicate locks; detects write skew cycles and aborts with 40001.",
    interviewTip: "Explain the Doctor-on-Call problem as the canonical example of Write Skew that passes `REPEATABLE READ` but is safely caught by `SERIALIZABLE`.",
    tags: ["serializable", "ssi", "siread-locks", "write-skew", "transaction-isolation"]
  }),

  createCard({
    idNum: 81,
    category: "Locking, Concurrency & Transaction Isolation",
    concept: "Monitoring Lock Trees & Blocked Transactions (pg_blocking_pids)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you detect which transaction is blocking other queries in production using pg_blocking_pids()?",
    quickAnswer: "PostgreSQL provides the built-in function `pg_blocking_pids(pid)`, which returns an array of process IDs that are holding locks blocking the specified `pid`. By combining `pg_blocking_pids()` with `pg_stat_activity`, you can build a complete lock blocking tree that pinpoints the root blocking query and cancel it using `pg_cancel_backend(pid)` or `pg_terminate_backend(pid)`.",
    detailedAnswer: "Lock Troubleshooting Architecture:\n1. `pg_blocking_pids(pid)`: Built-in function traversing the lock manager wait graph.\n2. Root Blocker Identification: Often, a single idle transaction in `state = 'idle in transaction'` holds a lock on a key table, queuing up hundreds of incoming queries behind it.\n3. Termination Options:\n   - `pg_cancel_backend(pid)`: Sends `SIGINT`; gently cancels the currently running SQL query without terminating the client connection.\n   - `pg_terminate_backend(pid)`: Sends `SIGTERM`; forcefully kills the backend process and closes the TCP connection immediately.",
    code: `-- Find all blocked queries and their direct blocking root causes
SELECT 
    blocked.pid AS blocked_pid,
    blocked.usename AS blocked_user,
    now() - blocked.query_start AS waiting_duration,
    blocked.query AS blocked_query,
    blocking.pid AS root_blocking_pid,
    blocking.usename AS blocking_user,
    blocking.state AS blocking_state,
    blocking.query AS blocking_query
FROM pg_stat_activity blocked
JOIN LATERAL unnest(pg_blocking_pids(blocked.pid)) AS blocker_pid ON true
JOIN pg_stat_activity blocking ON blocking.pid = blocker_pid
WHERE NOT blocked.wait_event IS NULL;

-- Gracefully kill the blocking backend process
SELECT pg_terminate_backend(12345);`,
    recallHint: "pg_blocking_pids(pid) returns array of PIDs blocking a query; root causes are often 'idle in transaction' processes; kill with pg_terminate_backend.",
    interviewTip: "Emphasize looking for `state = 'idle in transaction'`: developers often fetch data, open an application prompt, and leave the lock open indefinitely.",
    tags: ["pg_blocking_pids", "pg_stat_activity", "lock-monitoring", "pg_terminate_backend", "root-blocker"]
  }),

  createCard({
    idNum: 82,
    category: "Locking, Concurrency & Transaction Isolation",
    concept: "Lock Queues & Head-of-Line Blocking (How DDL blocks reads)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does PostgreSQL lock queuing cause a simple ALTER TABLE to block all incoming SELECT queries (Head-of-Line Blocking)?",
    quickAnswer: "PostgreSQL maintains a First-In, First-Out (FIFO) queue for lock requests. If a quick `ALTER TABLE` requests an `AccessExclusiveLock` while a slow 10-minute reporting `SELECT` is running, the DDL waits in queue. However, every subsequent incoming fast `SELECT` is queued BEHIND the pending DDL lock request to prevent lock starvation. As a result, the entire application becomes frozen behind the waiting DDL.",
    detailedAnswer: "The Head-of-Line Blocking Cascade:\n1. Transaction 1: Slow `SELECT` starts on table `users` (holds `AccessShareLock`).\n2. Transaction 2: Migration runs `ALTER TABLE users ADD COLUMN age INT;` (requests `AccessExclusiveLock`). Since T1 holds `AccessShare`, T2 waits in the lock queue.\n3. Transactions 3, 4, ... 1000: Incoming API requests run fast 1ms `SELECT * FROM users WHERE id = ?`. Because T2 is ahead of them in the lock queue, all subsequent `AccessShareLock` requests are blocked behind T2!\n4. Result: Connection pool is exhausted in seconds, leading to a full production outage.",
    code: `-- SCENARIO SIMULATION
-- Session 1: Slow reporting query running
SELECT pg_sleep(300) FROM users;

-- Session 2: Developer runs migration without timeout
-- BLOCKED behind Session 1
ALTER TABLE users ADD COLUMN status_code INT;

-- Session 3: Normal API user query
-- BLOCKED behind Session 2, even though Session 3 and Session 1 are both SELECTs!
SELECT * FROM users WHERE id = 1;`,
    recallHint: "Postgres lock queue is FIFO; pending AccessExclusiveLock blocks all subsequent SELECTs to avoid starvation; causes production outages without timeouts.",
    interviewTip: "This is a must-know senior DBA topic: explain why running migrations on high-traffic tables requires setting `lock_timeout`.",
    tags: ["head-of-line-blocking", "lock-queues", "alter-table", "production-outage", "ddl-migration"]
  }),

  createCard({
    idNum: 83,
    category: "Locking, Concurrency & Transaction Isolation",
    concept: "Zero-Downtime DDL: Setting lock_timeout & statement_timeout",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the proper script pattern for zero-downtime database migrations using lock_timeout in PostgreSQL?",
    quickAnswer: "To prevent Head-of-Line blocking outages during DDL, migrations must set a low `lock_timeout` (e.g. 2-5 seconds) before running `ALTER TABLE`. If the migration cannot acquire its exclusive lock within 2 seconds, it aborts immediately rather than queueing up and blocking incoming application traffic. The deployment pipeline can then retry the migration until a brief quiet window is caught.",
    detailedAnswer: "Production Migration Pattern:\n1. Set `lock_timeout`: Limits how long DDL waits in queue before aborting with `55P03`.\n2. Set `statement_timeout`: Limits maximum execution time once the lock is acquired.\n3. Add columns without defaults (or with constant defaults in PG 11+ which avoids table rewrites).\n4. Validate foreign keys in two steps: `ADD CONSTRAINT ... NOT VALID` (requires no table lock), followed by `VALIDATE CONSTRAINT` (takes weak lock).",
    code: `-- Zero-Downtime Safe Migration Template
BEGIN;

-- 1. If we cannot get the lock in 2 seconds, ABORT immediately to protect web traffic
SET LOCAL lock_timeout = '2s';

-- 2. If the DDL itself takes more than 10 seconds, abort
SET LOCAL statement_timeout = '10s';

-- 3. Execute safe schema alteration
ALTER TABLE orders ADD COLUMN fulfillment_notes TEXT;

COMMIT;

-- 4. Safe Foreign Key addition without full table locking
ALTER TABLE orders 
ADD CONSTRAINT fk_orders_customer 
FOREIGN KEY (customer_id) REFERENCES customers(id) NOT VALID;

-- Validate constraint concurrently in background without blocking writes
ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_customer;`,
    recallHint: "Set LOCAL lock_timeout = '2s' before DDL to abort immediately if blocked; use NOT VALID for zero-downtime foreign keys.",
    interviewTip: "Mention that PostgreSQL 11+ makes `ALTER TABLE ... ADD COLUMN ... DEFAULT 'val'` instantaneous with zero table rewrite because it stores the default value in system catalog `pg_attribute`.",
    tags: ["lock_timeout", "zero-downtime-migration", "safe-ddl", "not-valid", "statement_timeout"]
  }),

  createCard({
    idNum: 84,
    category: "Locking, Concurrency & Transaction Isolation",
    concept: "Two-Phase Commit (2PC): PREPARE TRANSACTION & Orphan Cleanup",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Two-Phase Commit (2PC) in PostgreSQL, and why can orphaned prepared transactions cause severe table bloat?",
    quickAnswer: "PostgreSQL supports atomic distributed transactions across multiple independent databases using Two-Phase Commit: Phase 1 prepares the transaction (`PREPARE TRANSACTION 'tx_id'`), persisting locks and WAL records to disk; Phase 2 commits or rolls back (`COMMIT PREPARED` or `ROLLBACK PREPARED`). If the external transaction coordinator crashes before Phase 2, the prepared transaction remains open indefinitely, freezing the database `xmin` horizon and causing catastrophic table bloat.",
    detailedAnswer: "2PC Internals & Danger:\n1. Persistence: A prepared transaction survives server restarts and connection disconnects; it is logged in `pg_twophase` on disk.\n2. Held Locks: Locks held by prepared transactions remain locked until explicitly resolved.\n3. The Bloat Disaster: The prepared transaction's `xmin` remains active. Autovacuum CANNOT clean up any dead tuples created after that `xmin`, causing rapid database-wide table and index bloat.\n4. Monitoring: System view `pg_prepared_xacts` must be monitored with automated alerts to identify and terminate orphaned transactions.",
    code: `-- Prepare a distributed transaction across services
BEGIN;
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
PREPARE TRANSACTION 'transfer_tx_98765';

-- Check active prepared transactions (survives disconnects)
SELECT 
    gid, 
    prepared, 
    owner, 
    database 
FROM pg_prepared_xacts;

-- Coordinator completes the commit in Phase 2
COMMIT PREPARED 'transfer_tx_98765';

-- Or abort if secondary participant failed
-- ROLLBACK PREPARED 'transfer_tx_98765';`,
    recallHint: "PREPARE TRANSACTION persists locks across reboots; orphaned prepared transactions freeze xmin and cause severe bloat; monitor pg_prepared_xacts.",
    interviewTip: "If `max_prepared_transactions` is set > 0, always warn about orphaned prepared transactions freezing the autovacuum horizon.",
    tags: ["two-phase-commit", "2pc", "prepare-transaction", "distributed-transactions", "bloat-prevention"]
  })
];

module.exports = cards;
