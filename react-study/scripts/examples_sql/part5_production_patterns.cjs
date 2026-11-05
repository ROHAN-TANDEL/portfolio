module.exports = [
  {
    id: "sql-ex-43",
    title: "Keyset Cursor Pagination on Composite Unique Keys",
    category: "Views, Security & Real-World SQL Patterns",
    difficulty: "advanced",
    whatThisCodeCovers: "Replaces slow, skipping-prone OFFSET pagination with deterministic, constant-time O(1) keyset (cursor) pagination using row comparison predicates.",
    conceptsCovered: [
      "Keyset / Cursor Pagination",
      "Composite Row Comparison (Tuple Comparison)",
      "OFFSET Anti-Pattern Elimination",
      "Deterministic Feed Ordering"
    ],
    code: `-- Fetch page 2 of 20 items where the last seen item had (created_at = '2026-03-01 14:00:00', order_id = 4590)
SELECT 
    order_id,
    customer_id,
    created_at,
    total_amount
FROM orders
WHERE (created_at, order_id) < ('2026-03-01 14:00:00', 4590)
ORDER BY created_at DESC, order_id DESC
LIMIT 20;

-- Equivalent standard expansion if database lacks tuple comparison:
-- WHERE created_at < '2026-03-01 14:00:00' 
--    OR (created_at = '2026-03-01 14:00:00' AND order_id < 4590)`,
    breakdown: [
      "OFFSET 10000 forces the database to read, sort, and discard 10,000 physical rows before returning results (O(N) cost).",
      "Keyset pagination seeks directly to the index position following the last seen cursor tuple in O(log N) time.",
      "Pairing created_at with the primary key order_id ensures deterministic ordering even when timestamps collide.",
      "Completely eliminates pagination drift when new items are inserted concurrently."
    ],
    expectedOutput: `order_id | customer_id | created_at          | total_amount
4589     | 109         | 2026-03-01 13:58:22 | 149.50
4588     | 214         | 2026-03-01 13:55:10 | 89.00`
  },
  {
    id: "sql-ex-44",
    title: "Batch Chunked Data Archival & Deletion Loop",
    category: "Views, Security & Real-World SQL Patterns",
    difficulty: "advanced",
    whatThisCodeCovers: "Purges millions of expired records safely in small bounded chunks of 5,000 rows to prevent table lock escalation, transaction log exhaustion, and replication lag.",
    conceptsCovered: [
      "Chunked Bounded Deletions",
      "Lock Escalation Prevention",
      "Transaction Log Preservation",
      "Subquery LIMIT Target"
    ],
    code: `-- Purge expired audit logs in bounded chunks of 5,000 rows (run repeatedly in a script until rows_affected == 0)
DELETE FROM audit_logs
WHERE log_id IN (
    SELECT log_id
    FROM audit_logs
    WHERE log_timestamp < CURRENT_DATE - INTERVAL '90' DAY
    ORDER BY log_id ASC
    LIMIT 5000
);`,
    breakdown: [
      "A raw 'DELETE FROM audit_logs WHERE log_timestamp < ...' on 50 million rows creates a massive lock, explodes the undo/redo log, and stalls queries.",
      "Bounding deletes to 5,000 rows per transaction releases row locks frequently, allowing concurrent business writes to proceed.",
      "Sorting by primary key log_id ASC prevents deadlocks between concurrent archival jobs.",
      "Applications execute this statement in a loop until row count affected is 0."
    ],
    expectedOutput: `Query executed successfully. 5000 rows deleted. (Duration: 42ms)`
  },
  {
    id: "sql-ex-45",
    title: "Optimistic Concurrency Control (OCC) with Version Stamp",
    category: "Transactions, ACID & Isolation Levels",
    difficulty: "intermediate",
    whatThisCodeCovers: "Prevents lost updates in concurrent environments by asserting that the row version stamp has not changed between reading and updating.",
    conceptsCovered: [
      "Optimistic Concurrency Control (OCC)",
      "Lost Update Prevention",
      "Version Counter / Timestamp",
      "Zero-Locking Scalability"
    ],
    code: `-- Thread A and Thread B read customer with version = 4
-- Thread A executes update:
UPDATE customer_accounts
SET 
    account_balance = account_balance - 50.00,
    version = version + 1,
    updated_at = CURRENT_TIMESTAMP
WHERE account_id = 'ACC-1001'
  AND version = 4; -- Assert version matches what was read

-- Application checks affected row count:
-- If affected_rows == 1: Success.
-- If affected_rows == 0: Concurrent update conflict! Roll back and retry with refreshed state.`,
    breakdown: [
      "Avoids heavy database pessimistic locks (like SELECT FOR UPDATE) across long client interaction times.",
      "The version predicate acts as an atomic compare-and-swap (CAS) check.",
      "If a concurrent user updated the account first, the version is already 5, so WHERE version = 4 matches 0 rows.",
      "The client detects zero affected rows and safely prompts the user or retries without corrupting balance."
    ],
    expectedOutput: `UPDATE 1 (Success: row balance decremented, version bumped from 4 to 5)`
  },
  {
    id: "sql-ex-46",
    title: "Parameterized Defense Against SQL Injection Attacks",
    category: "Views, Security & Real-World SQL Patterns",
    difficulty: "beginner",
    whatThisCodeCovers: "Contrasts catastrophic dynamic string concatenation with parameterized prepared statements across relational SQL drivers.",
    conceptsCovered: [
      "SQL Injection (SQLi) Vulnerability",
      "Parameterized Queries / Placeholders",
      "Prepared Statements",
      "Query Plan Caching"
    ],
    code: `-- 1. VULNERABLE ANTI-PATTERN: String concatenation (Never do this!)
-- Input payload: user_input = "' OR '1'='1"
-- Query executed: SELECT * FROM users WHERE email = '' OR '1'='1' AND is_active = TRUE;
-- Result: Leaks all accounts, bypassing authentication!

-- 2. SECURE PRODUCTION PATTERN: Parameterized Query
-- In PostgreSQL: $1, $2
-- In MySQL/SQLite: ?
-- In SQL Server/Oracle: @p1 or :p1
SELECT user_id, full_name, email, password_hash
FROM users
WHERE email = $1 
  AND is_active = TRUE;`,
    breakdown: [
      "Dynamic string concatenation treats user input as executable SQL code, enabling malicious query injection.",
      "Parameterized queries separate SQL structure from data: parameters are sent in a separate protocol packet after compilation.",
      "The database parser treats parameter values strictly as literal values, never as syntax tokens or operators.",
      "Additionally enables query execution plan reuse, speeding up high-frequency transactional lookups."
    ],
    expectedOutput: `user_id | full_name | email            | password_hash
42      | Alice     | alice@target.com | $2b$12$e8Y...`
  },
  {
    id: "sql-ex-47",
    title: "Updatable SQL View with WITH CHECK OPTION Security Guard",
    category: "Views, Security & Real-World SQL Patterns",
    difficulty: "advanced",
    whatThisCodeCovers: "Creates an updatable security view that restricts tenant updates to their own organization and uses WITH CHECK OPTION to prevent privilege leakage.",
    conceptsCovered: [
      "Updatable Views",
      "WITH CHECK OPTION",
      "Multi-Tenant Partitioning",
      "Constraint Leak Prevention"
    ],
    code: `-- 1. Create updatable view for EMEA sales team
CREATE VIEW emea_sales_view AS
SELECT 
    sale_id,
    sales_rep_id,
    region,
    deal_value,
    status
FROM sales_opportunities
WHERE region = 'EMEA'
WITH CHECK OPTION;

-- 2. Legitimate update:
UPDATE emea_sales_view 
SET deal_value = deal_value * 1.10
WHERE sale_id = 501;

-- 3. Unauthorized attempt to hijack record into another region (BLOCKED!):
-- UPDATE emea_sales_view SET region = 'NORTH_AMERICA' WHERE sale_id = 501;
-- ERROR: new row violates WITH CHECK OPTION for view "emea_sales_view"`,
    breakdown: [
      "Standard views with simple 1-to-1 projections without aggregates are natively updatable.",
      "Without 'WITH CHECK OPTION', a user could UPDATE a row to change its region to 'NORTH_AMERICA', causing the row to disappear from their view and bypass boundaries.",
      "WITH CHECK OPTION forces every INSERT and UPDATE through the view to satisfy the view's WHERE predicate.",
      "Provides robust database-enforced row isolation for specific database users or roles."
    ],
    expectedOutput: `View emea_sales_view created. Updates strictly enforced against region = 'EMEA'.`
  },
  {
    id: "sql-ex-48",
    title: "SARGable vs Non-SARGable Range Predicates on Timestamps",
    category: "Indexing Theory & SARGability",
    difficulty: "intermediate",
    whatThisCodeCovers: "Fixes a notorious query performance disaster by refactoring a function-wrapped date filter into an index-friendly SARGable range predicate.",
    conceptsCovered: [
      "SARGability (Search Argument Ability)",
      "Index Seek vs Table Scan",
      "Function Wrapping on Columns Anti-Pattern",
      "Half-Open Interval [Start, End)"
    ],
    code: `-- 1. NON-SARGABLE ANTI-PATTERN: Function on column kills index seek!
-- The database must execute DATE() on every single row in the table (Full Table Scan)
SELECT order_id, order_date, total_amount
FROM orders
WHERE CAST(order_date AS DATE) = '2026-03-01';

-- 2. SARGABLE HIGH-PERFORMANCE REFACTOR: Leaves column bare!
-- Executes an instantaneous B-Tree Range Seek on the index (order_date)
SELECT order_id, order_date, total_amount
FROM orders
WHERE order_date >= '2026-03-01 00:00:00'
  AND order_date < '2026-03-02 00:00:00';`,
    breakdown: [
      "Wrapping indexed columns in functions (CAST, YEAR, UPPER, ROUND) hides the values from the B-Tree index structure.",
      "A bare column compared against evaluated constant boundaries is SARGable, enabling O(log N) index seeks.",
      "The half-open interval [2026-03-01, 2026-03-02) accurately captures all millisecond/microsecond variations without BETWEEN edge bugs.",
      "Can improve query latency from 12 seconds to 2 milliseconds on large tables."
    ],
    expectedOutput: `order_id | order_date          | total_amount
8001     | 2026-03-01 04:12:00 | 120.00
8002     | 2026-03-01 23:59:58 | 450.00`
  },
  {
    id: "sql-ex-49",
    title: "Row-Level Locking Patterns: SELECT FOR UPDATE vs Share Locks",
    category: "Transactions, ACID & Isolation Levels",
    difficulty: "advanced",
    whatThisCodeCovers: "Acquires an exclusive row lock using SELECT ... FOR UPDATE within a transaction to safely deduct inventory without double allocation.",
    conceptsCovered: [
      "Pessimistic Locking",
      "SELECT ... FOR UPDATE",
      "Row-Level Lock Contention",
      "Race Condition Elimination"
    ],
    code: `-- Inventory deduction routine in high-concurrency flash sale
BEGIN TRANSACTION;

-- Step 1: Lock the specific inventory row exclusively
SELECT product_id, stock_quantity
FROM product_inventory
WHERE product_id = 99
FOR UPDATE;

-- Step 2: Check stock and decrement within the same protected transaction
UPDATE product_inventory
SET stock_quantity = stock_quantity - 1
WHERE product_id = 99
  AND stock_quantity >= 1;

-- Step 3: Record allocation
INSERT INTO stock_allocations (order_id, product_id, allocated_at)
VALUES (1001, 99, CURRENT_TIMESTAMP);

COMMIT;`,
    breakdown: [
      "SELECT FOR UPDATE places an exclusive row-level lock on the selected row until the transaction commits or aborts.",
      "Other concurrent transactions attempting to read with FOR UPDATE on the same row will wait until the lock is released.",
      "Prevents flash sale over-selling race conditions where two threads read stock = 1 simultaneously and both decrement.",
      "Always ensure transactions with FOR UPDATE are kept minimal and fast to prevent lock queues."
    ],
    expectedOutput: `COMMIT completed. Inventory deducted safely without race conditions.`
  },
  {
    id: "sql-ex-50",
    title: "Multi-Table Transaction with Rollback and Savepoints",
    category: "Transactions, ACID & Isolation Levels",
    difficulty: "advanced",
    whatThisCodeCovers: "Demonstrates transaction management with partial rollback to a SAVEPOINT, allowing non-critical operations to fail without aborting the main transaction.",
    conceptsCovered: [
      "ACID Transactions",
      "SAVEPOINT & ROLLBACK TO SAVEPOINT",
      "Partial Rollback Recovery",
      "Atomic Consistency"
    ],
    code: `-- Transfer funds between bank accounts with optional promotional reward logging
BEGIN TRANSACTION;

-- Step 1: Mandatory balance transfer
UPDATE bank_accounts SET balance = balance - 500.00 WHERE account_id = 'ACC-A';
UPDATE bank_accounts SET balance = balance + 500.00 WHERE account_id = 'ACC-B';

-- Step 2: Set savepoint before attempting non-critical promotional bonus
SAVEPOINT promo_savepoint;

-- Attempt bonus insert (may fail if promo rule constraint violated)
INSERT INTO promotional_credits (account_id, bonus_amount, reason)
VALUES ('ACC-B', 25.00, 'SPRING_PROMO_2026');

-- If bonus fails in application logic:
-- ROLLBACK TO SAVEPOINT promo_savepoint;
-- The $500 balance transfer remains intact and can proceed to commit!

COMMIT;`,
    breakdown: [
      "BEGIN TRANSACTION initiates an atomic block guaranteeing all-or-nothing execution.",
      "SAVEPOINT marks an intermediate milestone within the transaction.",
      "ROLLBACK TO SAVEPOINT undoes changes made after the savepoint without discarding the preceding updates.",
      "COMMIT persists all active changes durably to disk."
    ],
    expectedOutput: `Transaction committed successfully. Primary funds transfer guaranteed.`
  },
  {
    id: "sql-ex-51",
    title: "Least Privilege Security: Granting Granular Table and Column Permissions",
    category: "Views, Security & Real-World SQL Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "Enforces the principle of least privilege by granting specific read/write permissions to custom application roles and masking sensitive columns.",
    conceptsCovered: [
      "Role-Based Access Control (RBAC)",
      "GRANT & REVOKE Statements",
      "Column-Level Permissions",
      "Principle of Least Privilege"
    ],
    code: `-- 1. Create restricted reporting role
CREATE ROLE reporting_readonly_user;

-- 2. Grant table-level read access to dimensions
GRANT SELECT ON products, categories TO reporting_readonly_user;

-- 3. Grant column-level read access on customers, withholding SSN and password hashes!
GRANT SELECT (customer_id, full_name, email, city, country) 
ON customers TO reporting_readonly_user;

-- 4. Revoke public default privileges
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC;`,
    breakdown: [
      "Never connect production applications using the superuser ('postgres' or 'root') account.",
      "GRANT SELECT (col1, col2) restricts the role from projecting sensitive columns like ssn or password_hash.",
      "Attempting 'SELECT ssn FROM customers' using reporting_readonly_user raises an immediate SQL permission denied error.",
      "Revoking defaults from PUBLIC ensures defense-in-depth across the entire schema."
    ],
    expectedOutput: `Roles and granular permissions configured. Sensitive fields masked from reporting user.`
  },
  {
    id: "sql-ex-52",
    title: "Schema Evolution: Adding Non-Null Columns with Defaults Without Locking",
    category: "Normalization, Keys & DDL Constraints",
    difficulty: "advanced",
    whatThisCodeCovers: "Analyzes modern ANSI and relational patterns for non-blocking DDL migrations when adding NOT NULL columns with default values to massive tables.",
    conceptsCovered: [
      "Zero-Downtime DDL Migration",
      "Metadata-Only Default Addition",
      "NOT NULL Constraint Phasing",
      "Table Lock Avoidance"
    ],
    code: `-- Modern Zero-Downtime Migration Pattern:
-- In modern SQL engines, ALTER TABLE ADD COLUMN with DEFAULT and NOT NULL is a metadata-only change (O(1)).
-- In legacy databases, breaking it into phased steps prevents full-table rewrite:

-- Step 1: Add column as nullable (instantaneous metadata update)
ALTER TABLE user_accounts 
ADD COLUMN is_mfa_enabled BOOLEAN DEFAULT FALSE;

-- Step 2: Backfill existing rows in bounded batches (if legacy engine did not backfill in metadata)
-- UPDATE user_accounts SET is_mfa_enabled = FALSE WHERE is_mfa_enabled IS NULL;

-- Step 3: Add NOT NULL constraint once existing rows are compliant
ALTER TABLE user_accounts 
ALTER COLUMN is_mfa_enabled SET NOT NULL;`,
    breakdown: [
      "In older database engines, ADD COLUMN ... DEFAULT ... NOT NULL locked the entire table while rewriting every row on disk.",
      "Modern relational engines (PostgreSQL 11+, modern MySQL/SQL Server) optimize constant defaults as fast metadata updates.",
      "Breaking large migrations into nullable addition, batch backfilling, and constraint enforcement prevents production table deadlocks.",
      "Fundamental standard practice for zero-downtime continuous deployment pipelines."
    ],
    expectedOutput: `ALTER TABLE completed. Column added without table rewrite lock.`
  }
];
