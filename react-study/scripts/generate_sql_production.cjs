const fs = require('fs');
const path = require('path');

const productionTopics = [
  {
    id: "sql-prod-01",
    topic: "The O(N) OFFSET Pagination Performance Collapse",
    category: "Query Optimization & Access Paths",
    severity: "P1 / High Latency & Worker Thread Exhaustion",
    theProblem: "As web applications paginate deeper into datasets (e.g. `OFFSET 100000 LIMIT 20`), database latency degrades from 2ms to over 15 seconds. The query engine must read, sort, and materialize 100,020 physical rows, only to throw away the first 100,000. Under high concurrency, worker threads become saturated, buffers are exhausted, and downstream API timeouts cascade.",
    howItWorksInternally: "The SQL execution model specifies that OFFSET occurs after WHERE filtering, GROUP BY, and ORDER BY sorting. The database engine cannot jump directly to row 100,000 in a B-Tree index unless it is an explicit node-count augmented tree (which standard relational engines do not maintain). It must perform an index scan or table scan through all 100,000 rows, tracking row counts in memory and discarding them before projecting the requested 20 rows.",
    productionCode: `-- ANTI-PATTERN: Scans 500,020 rows, discards 500,000 (Takes ~8,400ms on 10M rows)
SELECT order_id, customer_id, order_date, total_amount
FROM orders
ORDER BY order_date DESC, order_id DESC
OFFSET 500000 LIMIT 20;

-- PRODUCTION REMEDIATION: Keyset / Cursor Pagination (Executes in ~1.2ms)
-- Client sends last seen (order_date, order_id) from previous page as cursor
SELECT order_id, customer_id, order_date, total_amount
FROM orders
WHERE (order_date, order_id) < ('2026-02-15 10:30:00', 984512)
ORDER BY order_date DESC, order_id DESC
LIMIT 20;

-- Equivalent standard fallback if database engine lacks tuple comparison syntax:
SELECT order_id, customer_id, order_date, total_amount
FROM orders
WHERE order_date < '2026-02-15 10:30:00'
   OR (order_date = '2026-02-15 10:30:00' AND order_id < 984512)
ORDER BY order_date DESC, order_id DESC
LIMIT 20;`,
    monitoringMetrics: [
      "Query execution time on paginated endpoints > 200ms",
      "Buffer pool read / shared block read spikes during search requests",
      "Application API gateway timeout count on listing endpoints (504 Gateway Timeout)"
    ],
    productionChecklist: [
      "Ban `OFFSET > 1000` in API gateway validation schemas or rate-limit deep page jumps.",
      "Refactor infinite scroll and data feeds to keyset / cursor pagination on composite indexed columns (e.g., `(created_at, id)`).",
      "Ensure the composite B-Tree index exactly mirrors the keyset filtering and sorting columns: `CREATE INDEX idx_orders_feed ON orders(order_date DESC, order_id DESC)`."
    ]
  },
  {
    id: "sql-prod-02",
    topic: "Non-SARGable Query Anti-Patterns (Functions on Indexed Columns)",
    category: "Indexing Theory & SARGability",
    severity: "P1 / Full Table Scan CPU Spikes",
    theProblem: "Queries that wrap indexed columns inside scalar functions, string manipulations, or mathematical operations (e.g. `WHERE UPPER(email) = ...`, `WHERE DATE(created_at) = ...`) force the database to abandon B-Tree index seeks. The database must execute a CPU-intensive Full Table Scan, evaluating the function individually against every single row in the relation.",
    howItWorksInternally: "B-Tree indexes store raw column values sorted strictly by their native collation order. When a function or operator wraps a column (`f(col) = value`), the engine cannot mathematically infer what raw column values produce the target result without calling `f()` on every tuple. The query becomes Non-SARGable (Not Search Argument Able), forcing sequential heap block reads.",
    productionCode: `-- 1. DATE TRUNCATION / FUNCTION WRAPPING ANTI-PATTERN
-- Table scan on 20,000,000 rows (Duration: 6.2s)
SELECT user_id, email, created_at 
FROM users 
WHERE CAST(created_at AS DATE) = '2026-03-01';

-- SARGABLE PRODUCTION REMEDIATION: Half-open interval seek (Duration: 1.8ms)
SELECT user_id, email, created_at 
FROM users 
WHERE created_at >= '2026-03-01 00:00:00' 
  AND created_at < '2026-03-02 00:00:00';

-- 2. CASE-INSENSITIVE STRING LOOKUP ANTI-PATTERN
-- Table scan: UPPER() hides email B-Tree index
SELECT user_id FROM users WHERE UPPER(email) = 'ALICE@EXAMPLE.COM';

-- SARGABLE PRODUCTION REMEDIATION: Expression/Functional index
CREATE INDEX idx_users_upper_email ON users (UPPER(email));
-- OR store normalized lowercase emails at write time:
-- UPDATE users SET email = LOWER(email);`,
    monitoringMetrics: [
      "Ratio of sequential scans (seq_scan / table_scan) to index seeks across transactional tables",
      "Execution time of daily/hourly cron queries scanning wide timestamp ranges",
      "High CPU utilization correlated with repetitive scalar function executions in query plans"
    ],
    productionChecklist: [
      "Audit application query logs for `DATE()`, `YEAR()`, `SUBSTR()`, `UPPER()`, and `LOWER()` in WHERE clauses.",
      "Rewrite date comparisons to use half-open intervals `[start_timestamp, end_timestamp)`.",
      "Create functional / expression indexes if query rewriting is prohibited by legacy application code."
    ]
  },
  {
    id: "sql-prod-03",
    topic: "The NOT IN with NULL Trap (Three-Valued Logic Zero-Row Outage)",
    category: "Three-Valued Logic & Subqueries",
    severity: "P1 / Silent Business Logic Bug & Missing Data",
    theProblem: "A developer writes `WHERE id NOT IN (SELECT foreign_id FROM audit_log)` expecting to find all records that have not been logged. If even a single row in `audit_log` has `foreign_id IS NULL`, the entire query returns ZERO rows, completely silencing alerts, missing fraud detection, and corrupting automated business workflows.",
    howItWorksInternally: "Under SQL ANSI 3VL (Three-Valued Logic), `x NOT IN (1, 2, NULL)` is mathematically expanded to: `x <> 1 AND x <> 2 AND x <> NULL`. In relational algebra, `x <> NULL` evaluates to `UNKNOWN`. In a chain of boolean `AND` operations, `TRUE AND TRUE AND UNKNOWN` yields `UNKNOWN`. Because SQL `WHERE` clauses discard any row that does not evaluate strictly to `TRUE`, all rows are rejected.",
    productionCode: `-- BUGGY ANTI-PATTERN: Fails silently if any employee has department_id NULL!
-- Returns 0 rows even when 50 departments have no employees!
SELECT department_id, department_name
FROM departments
WHERE department_id NOT IN (
    SELECT department_id FROM employees
);

-- PRODUCTION REMEDIATION 1: Correlated NOT EXISTS (Recommended standard)
SELECT d.department_id, d.department_name
FROM departments d
WHERE NOT EXISTS (
    SELECT 1 
    FROM employees e 
    WHERE e.department_id = d.department_id
);

-- PRODUCTION REMEDIATION 2: Explicit IS NOT NULL filter inside subquery
SELECT department_id, department_name
FROM departments
WHERE department_id NOT IN (
    SELECT department_id 
    FROM employees 
    WHERE department_id IS NOT NULL
);`,
    monitoringMetrics: [
      "Sudden drops in daily automated report row counts to zero",
      "Null-pointer or empty dataset alerts in asynchronous worker pipelines",
      "Static code analysis rule violations targeting `NOT IN (SELECT ...)`"
    ],
    productionChecklist: [
      "Ban `NOT IN (subquery)` in database coding standards; enforce `NOT EXISTS` or `LEFT JOIN ... WHERE col IS NULL`.",
      "Enforce `NOT NULL` constraints on foreign keys and reference columns whenever domain rules permit.",
      "Add unit tests that explicitly seed `NULL` values into subquery relations to catch 3VL regression bugs."
    ]
  },
  {
    id: "sql-prod-04",
    topic: "Accidental Cartesian Products via Missing or Incomplete Join Conditions",
    category: "Standard Joins & Set Operations",
    severity: "P0 / Database Memory Exhaustion & Temp Disk Spooling",
    theProblem: "Omitting a join predicate or making an error in multi-table join conditions causes the database to compute a Cartesian Product ($N \\times M$). Joining a table of 100,000 customers to 1,000,000 orders without a condition generates 100,000,000,000 intermediate rows, consuming all memory, filling temp disk space, and halting the server.",
    howItWorksInternally: "When two relations are joined without an equi-join predicate, the query planner is forced to execute a Nested Loop Cross Join. The outer relation scans row by row, and for every outer row, it scans the entirety of the inner relation. Intermediate results exceed `work_mem` / buffer pool size, spilling gigabytes of temporary files to disk until the disk partition fills up and kills the database daemon.",
    productionCode: `-- DISASTER ANTI-PATTERN: Missing ON condition between orders and invoices
-- If orders = 500K and invoices = 500K -> 250,000,000,000 rows generated!
SELECT c.full_name, o.order_id, i.invoice_number
FROM customers c
INNER JOIN orders o ON c.customer_id = o.customer_id
INNER JOIN invoices i ON o.customer_id = i.customer_id; -- WRONG: missing o.order_id = i.order_id!

-- PRODUCTION REMEDIATION: Explicit and verified relational join predicates
SELECT c.full_name, o.order_id, i.invoice_number
FROM customers c
INNER JOIN orders o 
    ON c.customer_id = o.customer_id
INNER JOIN invoices i 
    ON o.order_id = i.order_id 
   AND o.customer_id = i.customer_id;`,
    monitoringMetrics: [
      "Sudden spike in temporary disk file creation (`temp_bytes`, `temp_files`)",
      "Host disk space remaining dropping precipitously (> 10GB / min)",
      "Single query duration running beyond 60 seconds with 100% single-core CPU peg"
    ],
    productionChecklist: [
      "Configure `statement_timeout` (e.g. 30 seconds for web queries, 5 minutes for reports) to automatically terminate runaway Cartesian queries.",
      "Mandate explicit ANSI `JOIN ... ON` syntax; strictly forbid legacy comma joins (`FROM tableA, tableB WHERE ...`).",
      "Review query plans with `EXPLAIN` to ensure no unexpected 'Nested Loop' without inner index or 'Cartesian Join' operators appear."
    ]
  },
  {
    id: "sql-prod-05",
    topic: "Cascading Foreign Key Deletion Outages on Massive Parent Tables",
    category: "DDL Constraints & Referential Integrity",
    severity: "P0 / Cascading Table Lock & Replication Lag",
    theProblem: "Deleting a single account or organization with `ON DELETE CASCADE` triggers an uncontrolled chain reaction deleting tens of millions of child records across 20 tables. The resulting massive transaction holds exclusive table/row locks for minutes, bloats the transaction log (WAL/redo), and stalls the entire production database.",
    howItWorksInternally: "Foreign key constraints with `ON DELETE CASCADE` execute recursive deletions inside the same physical database transaction. If foreign key columns on child tables lack B-Tree indexes, every cascading delete triggers a sequential scan of each child table to locate referencing rows! Furthermore, all locks are held until the top-level parent transaction commits, starving concurrent OLTP transactions.",
    productionCode: `-- 1. CRITICAL REQUIREMENT: Always index child foreign key columns!
-- Without this index, deleting 1 parent scans the ENTIRE order_items table!
CREATE INDEX idx_order_items_order_id ON order_items (order_id);
CREATE INDEX idx_orders_customer_id ON orders (customer_id);

-- 2. SAFE ARCHIVAL PATTERN: Delete child records bottom-up in small bounded batches
-- Step A: Delete lowest level children in batches of 5,000
DELETE FROM order_item_addons
WHERE order_item_id IN (
    SELECT item_id FROM order_items WHERE customer_id = 1001 LIMIT 5000
);

-- Step B: Delete order items
DELETE FROM order_items
WHERE customer_id = 1001
LIMIT 5000;

-- Step C: Finally delete parent once children are safely removed
DELETE FROM customers WHERE customer_id = 1001;`,
    monitoringMetrics: [
      "Transaction duration spikes on `DELETE` operations exceeding 5,000ms",
      "Replication lag (bytes / seconds behind master) spiking after parent entity deletion",
      "Row lock wait counts (`lock_waits`) accumulating behind delete transactions"
    ],
    productionChecklist: [
      "Verify that every single `FOREIGN KEY` column in the database has an explicit matching B-Tree index.",
      "Avoid raw `ON DELETE CASCADE` on high-volume transactional relations; prefer soft deletes (`deleted_at IS NOT NULL`) or asynchronous background batch deletion.",
      "Execute massive deletions in bounded batches of 1,000 to 10,000 rows with a sleep interval between chunks."
    ]
  },
  {
    id: "sql-prod-06",
    topic: "SQL Injection Vulnerabilities & Dynamic SQL Construction Hazards",
    category: "Security & Access Control",
    severity: "P0 / Data Breach & Remote Arbitrary Execution",
    theProblem: "Constructing SQL queries using dynamic string concatenation or template interpolation (`SELECT * FROM users WHERE email = '${email}'`) allows attackers to inject malicious SQL syntax tokens. Attackers can bypass authentication, exfiltrate confidential customer databases, destroy tables, or execute shell commands.",
    howItWorksInternally: "The SQL compiler processes queries in distinct phases: Lexical Analysis -> Syntax Parsing -> Semantic Analysis -> Planning -> Execution. When input strings are concatenated directly into the query string, the parser cannot distinguish between code tokens written by the developer and code tokens supplied by an attacker. Attackers supply quotes (`'`), boolean tautologies (`OR 1=1`), and query chain delimiters (`; DROP TABLE`).",
    productionCode: `-- VULNERABLE DYNAMIC STRING QUERY (CATASTROPHIC):
-- User input: admin' --
-- Executed: SELECT * FROM accounts WHERE username = 'admin' --' AND password = 'xxx';
-- Attacker logs in as admin without password!

-- SECURE PRODUCTION ARCHITECTURE: Parameterized Prepared Statements
-- 1. Database compiles and optimizes query AST once
PREPARE get_account_by_credentials (VARCHAR, VARCHAR) AS
SELECT account_id, username, email, is_superadmin
FROM accounts
WHERE username = $1 
  AND password_hash = $2
  AND is_active = TRUE;

-- 2. Parameter values are passed separately in the binary wire protocol packet
EXECUTE get_account_by_credentials('admin', '$2b$12$K89...');

-- 3. Dynamic identifiers (table/column names) CANNOT be parameterized:
-- Sanitize dynamic identifiers against an explicit whitelist!
-- DO NOT concatenate raw user input into ORDER BY or table names!`,
    monitoringMetrics: [
      "Web Application Firewall (WAF) SQL injection rule trigger rate",
      "Database syntax parse errors (42601 / syntax error) originating from application queries",
      "Unusual query latency spikes resulting from blind time-based injection attacks (`WAITFOR DELAY`, `pg_sleep`)"
    ],
    productionChecklist: [
      "Mandate parameterized queries across 100% of database client libraries (e.g. pg, mysql2, TypeORM, Prisma).",
      "Never use raw string interpolation (template literals) to inject values into SQL strings.",
      "If dynamic column sorting (`ORDER BY`) is needed, validate against a strict programmatic whitelist array of allowed column names."
    ]
  },
  {
    id: "sql-prod-07",
    topic: "Deadlock Outages Triggered by Inconsistent Row Update Ordering",
    category: "Transactions, ACID & Isolation Levels",
    severity: "P1 / Transaction Aborts & 500 Server Errors",
    theProblem: "Concurrent transactions attempting to update multiple rows in different orders inevitably produce deadlocks. Transaction A updates Row 1 then attempts to lock Row 2, while Transaction B updates Row 2 and attempts to lock Row 1. The database detects the circular dependency graph and terminates one of the transactions with a deadlock error.",
    howItWorksInternally: "Relational database engines maintain a Wait-For Graph (WFG) of lock requests. When Transaction 1 holds exclusive lock $L_1$ and requests $L_2$, while Transaction 2 holds $L_2$ and requests $L_1$, a directed cycle forms ($T_1 \\rightarrow T_2 \\rightarrow T_1$). Because neither transaction can advance without the other releasing its lock, the database's deadlock detector thread fires, selects a victim transaction, and executes `ABORT` with a deadlock error.",
    productionCode: `-- DEADLOCK-PRONE SCENARIO:
-- Transaction 1: Transfers money from Account 100 to Account 200
-- Thread 1 locks 100, then tries to lock 200
-- Transaction 2: Simultaneously transfers money from Account 200 to Account 100
-- Thread 2 locks 200, then tries to lock 100 -> DEADLOCK!

-- PRODUCTION REMEDIATION: Deterministic Global Lock Ordering
-- Always sort row IDs in ascending order before acquiring locks!

BEGIN TRANSACTION;

-- Sort IDs: min_id = 100, max_id = 200
-- Both transactions will ALWAYS lock Account 100 FIRST, then Account 200!
SELECT account_id, balance
FROM accounts
WHERE account_id IN (100, 200)
ORDER BY account_id ASC
FOR UPDATE;

-- Now safe to execute balance transfers without any deadlock possibility!
UPDATE accounts SET balance = balance - 50.00 WHERE account_id = 100;
UPDATE accounts SET balance = balance + 50.00 WHERE account_id = 200;

COMMIT;`,
    monitoringMetrics: [
      "Deadlock count per second (`deadlocks` in `pg_stat_database` / `SHOW GLOBAL STATUS LIKE 'Innodb_deadlocks'`)",
      "Application transaction retry rates on retryable SQL exception codes (e.g., 40P01)",
      "Average lock wait time (`lock_wait_timeout` events)"
    ],
    productionChecklist: [
      "Enforce deterministic sorting (e.g. `ORDER BY id ASC`) prior to batch updates or `SELECT FOR UPDATE` calls.",
      "Keep transaction execution duration as short as possible; never make external HTTP calls or heavy disk I/O inside open transactions.",
      "Implement exponential backoff retry loops in application code for transient deadlock victim aborts."
    ]
  },
  {
    id: "sql-prod-08",
    topic: "Lost Updates & Write Skew Under Weak Isolation Levels",
    category: "Transactions, ACID & Isolation Levels",
    severity: "P1 / Financial Ledger & Inventory Inconsistency",
    theProblem: "Under default `READ COMMITTED` isolation, two concurrent transactions read an account balance of $100. Both subtract $40 and write $60 back to the table. Instead of the balance decreasing by $80 to $20, the second update silently overwrites the first, causing a catastrophic financial Lost Update bug.",
    howItWorksInternally: "In `READ COMMITTED`, each statement inside a transaction sees a new snapshot of committed data. However, between reading a value in a `SELECT` statement and executing an `UPDATE`, another concurrent transaction can commit a change. The updating transaction reads the newly committed row version during the write phase, but overwrites the attribute based on its outdated application memory state.",
    productionCode: `-- 1. ANTI-PATTERN (Application reads balance, calculates, then writes):
-- SELECT balance FROM accounts WHERE id = 1; -> Reads 100
-- App calculates: new_balance = 100 - 40 = 60
-- Concurrent thread also writes 60 -> LOST UPDATE!

-- 2. PRODUCTION REMEDIATION A: Atomic In-Database Arithmetic
UPDATE accounts
SET balance = balance - 40.00
WHERE id = 1 
  AND balance >= 40.00; -- Atomic check-and-subtract

-- 3. PRODUCTION REMEDIATION B: Optimistic Concurrency Control (OCC)
UPDATE accounts
SET balance = 60.00,
    version = version + 1
WHERE id = 1 
  AND version = 3; -- If version was bumped by concurrent thread, returns 0 rows!

-- 4. PRODUCTION REMEDIATION C: Pessimistic Locking
BEGIN TRANSACTION;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
-- Exclusive lock acquired; concurrent transactions wait here
UPDATE accounts SET balance = balance - 40.00 WHERE id = 1;
COMMIT;`,
    monitoringMetrics: [
      "Financial ledger reconciliation imbalance alerts",
      "Optimistic locking collision frequency (rows affected == 0 count)",
      "Serialization failure count under `REPEATABLE READ` or `SERIALIZABLE` isolation"
    ],
    productionChecklist: [
      "Never compute state mutations in application memory without atomic database enforcement (`SET x = x + delta`) or version checks.",
      "Add a `version INT DEFAULT 1` column to high-contention entity tables to enable Optimistic Concurrency Control.",
      "Evaluate whether critical financial transactions require `SERIALIZABLE` isolation or explicit `FOR UPDATE` pessimistic locks."
    ]
  },
  {
    id: "sql-prod-09",
    topic: "N+1 Query Explosion in ORMs and Application Data Fetchers",
    category: "Query Optimization & Access Paths",
    severity: "P1 / Network Roundtrip Latency & Connection Saturation",
    theProblem: "An application fetches a list of 100 orders, and then inside a loop issues a separate query for each order's customer details. Instead of 1 query, the database is bombarded with 101 distinct network roundtrips. Latency explodes from 5ms to 1,500ms, saturating connection pools and starving other microservices.",
    howItWorksInternally: "Relational database client communication involves TCP socket handshakes, wire protocol serialization, parsing, optimization, and buffer lock acquisition. Running 1,000 queries that execute in 0.1ms each still incurs 1ms of network roundtrip time per query ($1,000 \\times 1\\text{ms} = 1\\text{ second}$ of pure idle network latency). ORMs with lazy-loading relationships by default trigger this behavior seamlessly and invisibly.",
    productionCode: `-- ANTI-PATTERN: Application loop executes 1 + N queries
-- Query 1:
SELECT order_id, customer_id, order_date FROM orders WHERE order_date >= '2026-03-01' LIMIT 100;
-- Followed by 100 individual queries in loop:
-- SELECT * FROM customers WHERE customer_id = 101;
-- SELECT * FROM customers WHERE customer_id = 102; ... (100 times!)

-- PRODUCTION REMEDIATION 1: Single Explicit Relational JOIN (1 query)
SELECT 
    o.order_id,
    o.order_date,
    c.customer_id,
    c.full_name,
    c.email
FROM orders o
INNER JOIN customers c 
    ON o.customer_id = c.customer_id
WHERE o.order_date >= '2026-03-01'
LIMIT 100;

-- PRODUCTION REMEDIATION 2: Bounded Batch IN query (2 queries total for 1,000 items)
-- Query 1: Fetch orders
-- Query 2: Fetch all related customers in one roundtrip
SELECT customer_id, full_name, email
FROM customers
WHERE customer_id IN (101, 102, 103, 104, ...);`,
    monitoringMetrics: [
      "Query throughput rate (QPS) spikes disproportionate to incoming HTTP requests",
      "Repetitive query pattern matching in APM (Datadog, New Relic) flagging identical prepared queries with single-key lookups",
      "High connection pool wait time with low database CPU usage (threads waiting on network roundtrips)"
    ],
    productionChecklist: [
      "Disable lazy-loading by default in application ORMs; require eager joins or prefetching.",
      "Use APM tools with N+1 query detection enabled in staging and pull request CI/CD pipelines.",
      "Batch related ID lookups using `WHERE id IN (...)` or single multi-table `JOIN` queries."
    ]
  },
  {
    id: "sql-prod-10",
    topic: "Massive Batch DELETE / UPDATE Table-Locking and Log Exhaustion",
    category: "Disaster Recovery & Engine Health",
    severity: "P0 / Transaction Log Saturation & Replication Stalls",
    theProblem: "Running a single `DELETE FROM events WHERE created_at < '2025-01-01'` on a 100-million row table exhausts database transaction log capacity (WAL / undo / redo logs), locks the table against concurrent writes, and causes replication replicas to fall hours behind.",
    howItWorksInternally: "Every updated or deleted row generates transaction log records for crash recovery and replication. A 50-million row delete creates gigabytes of transaction logs before committing. If the log volume exceeds allocated storage, the database crashes. Furthermore, row locks and intention-exclusive table locks remain active for the entire duration of the multi-minute statement.",
    productionCode: `-- DISASTER ANTI-PATTERN: Unbounded monolithic delete
-- DELETE FROM event_telemetry WHERE event_time < '2025-01-01'; -- Stalls database!

-- PRODUCTION REMEDIATION: Chunked Bounded Deletion Loop
-- Execute this block repeatedly in a scheduled script with brief pauses
DELETE FROM event_telemetry
WHERE event_id IN (
    SELECT event_id
    FROM event_telemetry
    WHERE event_time < '2025-01-01'
    ORDER BY event_id ASC
    LIMIT 5000
);

-- Script pseudocode:
-- WHILE (rows_affected > 0) {
--     rows_affected = execute_chunk_delete();
--     sleep(100ms); -- Allow replica replication catch-up and OLTP traffic breathing room
-- }`,
    monitoringMetrics: [
      "Transaction log disk space utilization (WAL / Redo log % full)",
      "Replication lag on read replicas following maintenance batch jobs",
      "Table lock contention wait events (`ExclusiveLock` / `RowExclusiveLock` duration)"
    ],
    productionChecklist: [
      "Never execute unbounded `DELETE` or `UPDATE` on tables exceeding 100,000 rows without chunking.",
      "Set batch chunk sizes between 1,000 and 10,000 rows, committing after each chunk.",
      "Introduce a 50ms-200ms sleep between chunks to let replication pipelines drain and prevent lock starving."
    ]
  },
  {
    id: "sql-prod-11",
    topic: "Over-Indexing Write Penalties and High Index Maintenance Bloat",
    category: "Indexing Theory & SARGability",
    severity: "P1 / High Write Latency & Disk Space Bloat",
    theProblem: "In an attempt to speed up every query, developers add 25 indexes to a high-throughput transactional table. Write performance (INSERT, UPDATE, DELETE) slows to a crawl, disk storage requirements triple, and memory is wasted caching redundant index blocks rather than active table data.",
    howItWorksInternally: "Every `INSERT` must write a pointer to all 25 B-Tree indexes, triggering tree re-balancing and splitting. Every `UPDATE` on indexed columns requires modifying the corresponding B-Trees. Furthermore, redundant indexes (e.g. Index A on `(customer_id)` and Index B on `(customer_id, order_date)`) duplicate storage because Index B already covers queries filtering strictly on `customer_id` via left-prefix rules.",
    productionCode: `-- 1. DETECT REDUNDANT / DUPLICATE INDEXES:
-- If idx_orders_customer_date exists:
CREATE INDEX idx_orders_cust_date ON orders (customer_id, order_date);

-- Then idx_orders_cust is 100% REDUNDANT and wastes disk/write I/O!
-- Drop it:
DROP INDEX idx_orders_cust;

-- 2. QUERY UNUSED INDEXES (Database-specific telemetry):
-- Look for indexes with zero scans after weeks of production runtime:
-- In standard PostgreSQL:
SELECT 
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS number_of_scans,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE '%_pkey' -- Do not drop primary keys!
ORDER BY pg_relation_size(indexrelid) DESC;`,
    monitoringMetrics: [
      "Ratio of total index size to total heap table size (> 2.0 indicates excessive indexing)",
      "Zero-scan index count in performance telemetry views",
      "Average INSERT and UPDATE transaction duration degradation on high-throughput tables"
    ],
    productionChecklist: [
      "Enforce left-prefix index consolidation: drop single-column indexes covered by existing composite indexes.",
      "Review index usage statistics quarterly; drop indexes with zero scans in 90 days.",
      "Benchmark insert throughput before and after adding new indexes to high-velocity event tables."
    ]
  },
  {
    id: "sql-prod-12",
    topic: "Implicit Data Type Conversion Silently Disabling B-Tree Index Seeks",
    category: "Indexing Theory & SARGability",
    severity: "P1 / Silent Full Table Scans",
    theProblem: "A column `account_number` is defined as `VARCHAR(20)`. An application sends a query filtering `WHERE account_number = 12345678` (as an integer literal). The query engine implicitly converts the entire string column to integers using `CAST(account_number AS BIGINT)`, triggering a full table scan and crippling query throughput.",
    howItWorksInternally: "SQL type precedence rules dictate that when comparing disparate data types, the type with lower precedence is cast to the type with higher precedence (e.g., String is cast to Numeric). Because the cast is applied to the column rather than the constant literal (`CAST(col AS NUMERIC) = 12345678`), the B-Tree index on `account_number` cannot be navigated, and every single row must be dynamically converted and evaluated.",
    productionCode: `-- 1. ANTI-PATTERN: Integer literal passed to VARCHAR column
-- Forces database to execute CAST(account_number AS BIGINT) on 10,000,000 rows!
SELECT user_id, balance
FROM user_accounts
WHERE account_number = 9876543210; -- Non-SARGable full table scan!

-- 2. PRODUCTION REMEDIATION: Type-safe matching literals
-- Instantaneous B-Tree index seek (O(log N))
SELECT user_id, balance
FROM user_accounts
WHERE account_number = '9876543210'; -- Exact VARCHAR matching!

-- 3. In Application Code (e.g. Node.js / Python / Java):
-- Always ensure parameterized data types match schema column types:
-- const query = "SELECT user_id FROM user_accounts WHERE account_number = $1";
-- await db.query(query, [String(accountNumber)]); // Explicit string cast!`,
    monitoringMetrics: [
      "Discrepancy between development EXPLAIN plans (using strings) and production query execution plans (using driver-inferred types)",
      "Sudden index scan drops on single-key lookups following ORM or language library upgrades",
      "Spikes in CPU utilization during point-lookup API endpoint requests"
    ],
    productionChecklist: [
      "Ensure application database drivers and ORMs serialize parameters matching database column types.",
      "Always quote alphanumeric string identifiers in manual SQL queries and test scripts.",
      "Verify query execution plans via `EXPLAIN` when querying columns with numeric-looking string values (e.g. phone numbers, zip codes, account numbers)."
    ]
  },
  {
    id: "sql-prod-13",
    topic: "Correlated Subqueries in Projection Lists Causing CPU Saturation",
    category: "Subqueries & Relational Existence",
    severity: "P1 / Repetitive Computation & CPU Throttling",
    theProblem: "Placing correlated subqueries inside the `SELECT` projection list (e.g. `SELECT id, (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) FROM customers c`) causes the subquery to re-execute once for every single row emitted by the outer query, multiplying CPU work by thousands.",
    howItWorksInternally: "Unless the query optimizer recognizes and transforms the correlated subquery into an outer join, it executes a nested loop scalar subquery for each candidate outer row. If the outer query processes 50,000 customers, the inner aggregate query executes 50,000 times sequentially, repeatedly locking buffer cache pages and burning CPU cycles.",
    productionCode: `-- ANTI-PATTERN: Correlated subqueries in projection list
-- Executes 50,000 separate subquery evaluations!
SELECT 
    c.customer_id,
    c.full_name,
    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.customer_id) AS total_orders,
    (SELECT MAX(o.total_amount) FROM orders o WHERE o.customer_id = c.customer_id) AS max_order_val
FROM customers c
WHERE c.status = 'ACTIVE';

-- PRODUCTION REMEDIATION: Single LEFT JOIN with GROUP BY (Runs in 1 unified pass)
SELECT 
    c.customer_id,
    c.full_name,
    COUNT(o.order_id) AS total_orders,
    COALESCE(MAX(o.total_amount), 0.00) AS max_order_val
FROM customers c
LEFT OUTER JOIN orders o 
    ON c.customer_id = o.customer_id
WHERE c.status = 'ACTIVE'
GROUP BY c.customer_id, c.full_name;`,
    monitoringMetrics: [
      "High CPU time relative to the number of rows returned by reporting queries",
      "Query execution plans featuring repetitive 'SubPlan' or 'Dependent Subquery' nodes",
      "Buffer pool read hits scaling with $O(N)$ where $N$ is the outer customer row count"
    ],
    productionChecklist: [
      "Refactor scalar projection subqueries into `LEFT JOIN ... GROUP BY` aggregations or window functions.",
      "Check execution plans for `SubPlan` operations and evaluate whether join transformation occurred.",
      "Leverage CTEs to pre-aggregate child metrics before joining to parent dimension tables."
    ]
  },
  {
    id: "sql-prod-14",
    topic: "Data Type Sizing & Integer Overflow Catastrophes",
    category: "Normalization, Keys & DDL Constraints",
    severity: "P0 / Total Application Write Halting",
    theProblem: "A high-velocity table uses a 32-bit signed integer (`INT`) for its auto-incrementing primary key. When the table crosses 2,147,483,647 rows, every subsequent `INSERT` fails with an integer out-of-range overflow error, completely halting user registration, checkout, or telemetry ingestion.",
    howItWorksInternally: "A 32-bit signed integer has an upper limit of $2^{31} - 1 = 2,147,483,647$. Relational engines enforce strict boundary checking. Once the sequence or identity counter reaches this limit, attempting to generate or store the next integer triggers a fatal SQL error. Migrating a 2-billion row table's primary key from `INT` to `BIGINT` in an emergency requires an exclusive table lock that can take hours or days to rewrite the table on disk.",
    productionCode: `-- 1. PROACTIVE MONITORING: Check sequences approaching 2.14B threshold!
-- Alerts if sequence capacity exceeds 75%
SELECT 
    table_name,
    column_name,
    data_type,
    current_value,
    max_value,
    ROUND(100.0 * current_value / max_value, 2) AS pct_capacity_used
FROM sequence_telemetry_view
WHERE max_value = 2147483647 -- Standard 32-bit INT limit
  AND current_value > 1500000000; -- Alert threshold at 1.5 Billion!

-- 2. ZERO-DOWNTIME MIGRATION FROM INT TO BIGINT (Phased approach):
-- Step A: Add new BIGINT column
ALTER TABLE transactions ADD COLUMN transaction_id_big BIGINT;

-- Step B: Dual-write via trigger or application logic to populate both columns
-- Step C: Backfill historical rows in chunks of 50,000 during off-peak hours
-- Step D: Swap column references and update primary key constraint in maintenance window`,
    monitoringMetrics: [
      "Sequence utilization % towards maximum data type limit (`INT` vs `BIGINT`)",
      "SQL error rate tracking out-of-range exception codes (e.g., 22003 / numeric_value_out_of_range)",
      "Daily sequence growth velocity (days remaining until 2.14B limit)"
    ],
    productionChecklist: [
      "Always declare primary keys and foreign keys as `BIGINT` (64-bit, up to 9 quintillion) for any transactional or event table.",
      "Configure automated alerting when any sequence crosses 70% of its data type boundary.",
      "Never wait until integer exhaustion to perform type migration; execute phased schema updates months ahead."
    ]
  }
];

// Validation
const ids = new Set();
productionTopics.forEach((topic, idx) => {
  if (!topic.id) throw new Error(`Topic at index ${idx} missing id`);
  if (ids.has(topic.id)) throw new Error(`Duplicate topic id: ${topic.id}`);
  ids.add(topic.id);
  if (!topic.topic) throw new Error(`Topic ${topic.id} missing topic`);
  if (!topic.category) throw new Error(`Topic ${topic.id} missing category`);
  if (!topic.severity) throw new Error(`Topic ${topic.id} missing severity`);
  if (!topic.theProblem) throw new Error(`Topic ${topic.id} missing theProblem`);
  if (!topic.howItWorksInternally) throw new Error(`Topic ${topic.id} missing howItWorksInternally`);
  if (!topic.productionCode) throw new Error(`Topic ${topic.id} missing productionCode`);
  if (!Array.isArray(topic.monitoringMetrics) || topic.monitoringMetrics.length === 0) throw new Error(`Topic ${topic.id} missing monitoringMetrics`);
  if (!Array.isArray(topic.productionChecklist) || topic.productionChecklist.length === 0) throw new Error(`Topic ${topic.id} missing productionChecklist`);
});

const outputPath = path.join(__dirname, '../data/sql.production.json');
fs.writeFileSync(outputPath, JSON.stringify(productionTopics, null, 2), 'utf8');
console.log(`Successfully compiled 14 SQL production topics to ${outputPath}`);
