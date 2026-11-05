const { createCard } = require("../sql_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 109,
    category: "Views, Security & Data Patterns",
    concept: "Standard Database Views (CREATE VIEW) as Abstraction & Security Layers",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a standard database VIEW in SQL, and how does it serve as both a schema abstraction and a row/column security barrier?",
    quickAnswer: "A standard **VIEW** is a stored, named query definition in the database catalog that acts as a virtual table. It **stores zero physical data**; when queried, the database engine merges the view's query definition into the user's outer query. Views provide two vital functions: 1) **Schema Abstraction** (encapsulating complex multi-table joins and business formulas behind a clean interface); and 2) **Security Isolation** (exposing only authorized columns and restricted rows while withholding underlying sensitive tables from end users).",
    detailedAnswer: "View Execution & Security Architecture:\n1. View Inlining / Expansion: The query rewriter substitutes the view definition directly into the query AST, allowing the optimizer to push predicates down to base table indexes.\n2. Column-Level Security: You can grant a reporting role `SELECT` on `vw_customer_public` (exposing `name`, `city`) while revoking all permissions on the underlying `customers` table (hiding `credit_card_number`, `password_hash`).\n3. Row-Level Security: Views filtering `WHERE tenant_id = ...` restrict row visibility seamlessly.",
    code: `-- 1. Create a secure view hiding sensitive columns
CREATE VIEW vw_customer_public AS
SELECT 
    customer_id,
    company_name,
    country,
    account_status
FROM sensitive_customer_master
WHERE account_status = 'ACTIVE';

-- 2. Grant permissions to reporting role strictly on the view
GRANT SELECT ON vw_customer_public TO reporting_analysts;
REVOKE ALL ON sensitive_customer_master FROM reporting_analysts;

-- 3. Querying the view (Optimizer inlines and pushes WHERE down):
SELECT company_name FROM vw_customer_public WHERE country = 'Canada';`,
    recallHint: "Views store queries, not data; inlined at runtime; provide schema abstraction and column/row security barriers.",
    interviewTip: "Highlight that views allow database administrators to refactor underlying physical tables without breaking client applications.",
    tags: ["views", "create-view", "security-barrier", "schema-abstraction", "virtual-tables"]
  }),

  createCard({
    idNum: 110,
    category: "Views, Security & Data Patterns",
    concept: "Updatable Views & The WITH CHECK OPTION (CASCADED vs LOCAL)",
    priority: "must-know",
    difficulty: "advanced",
    question: "When is a view updatable in ANSI SQL, and how does WITH CHECK OPTION prevent users from updating rows out of view visibility?",
    quickAnswer: "A view is **Updatable** in ANSI SQL if it is defined over a single table without aggregates, `GROUP BY`, `DISTINCT`, `UNION`, or window functions. The **WITH CHECK OPTION** is a crucial constraint clause: it guarantees that any `INSERT` or `UPDATE` executed through the view is rejected if the resulting row would violate the view's `WHERE` clause (preventing users from inserting or updating a row into a state where it disappears from the view).",
    detailedAnswer: "WITH CHECK OPTION Variants:\n1. The Problem without CHECK OPTION: If a view is `WHERE country = 'US'`, a user can execute `UPDATE view SET country = 'UK'`. The update succeeds, but the row immediately vanishes from the user's view!\n2. With `WITH CHECK OPTION`: The database asserts the view predicate on all mutations; setting `country = 'UK'` throws an immediate constraint violation.\n3. `CASCADED` (default): Checks all underlying nested view predicates.\n4. `LOCAL`: Checks only the current view's predicate.",
    code: `-- Updatable view enforcing that only Active California accounts can be modified
CREATE VIEW vw_active_california_clients AS
SELECT client_id, client_name, state, is_active
FROM clients
WHERE state = 'CA' AND is_active = true
WITH CHECK OPTION; -- Enforces that new/updated rows MUST satisfy state = 'CA' AND is_active = true!

-- Valid update:
UPDATE vw_active_california_clients 
SET client_name = 'Acme West' 
WHERE client_id = 10;

-- FAILS with Check Option Violation:
-- UPDATE vw_active_california_clients SET state = 'NY' WHERE client_id = 10;
-- ERROR: new row violates WITH CHECK OPTION for view "vw_active_california_clients"!`,
    recallHint: "Updatable views modify single tables; WITH CHECK OPTION prevents inserting/updating rows that violate the view's WHERE clause.",
    interviewTip: "Explain why `WITH CHECK OPTION` is essential for multi-tenant views: without it, a tenant could modify their `tenant_id` and corrupt other tenants' data.",
    tags: ["updatable-views", "with-check-option", "cascaded-check", "data-integrity", "security-views"]
  }),

  createCard({
    idNum: 111,
    category: "Views, Security & Data Patterns",
    concept: "Materialized Views: Physical Snapshotting vs Real-Time Queries",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a Materialized View, and how does it differ from a standard virtual view in storage, performance, and staleness?",
    quickAnswer: "While a standard view is a virtual query evaluated on the fly, a **Materialized View** executes the query and **persists the physical result set on disk** as an actual table, complete with dedicated B-Tree indexes. Queries against a materialized view read pre-computed results in milliseconds, eliminating complex joins and aggregations. However, the data is a point-in-time snapshot and becomes stale until explicitly refreshed (`REFRESH MATERIALIZED VIEW`).",
    detailedAnswer: "Materialized vs Virtual View Comparison:\n- Virtual View:\n  - Storage: 0 bytes (only query text in catalog).\n  - Data Freshness: 100% real-time.\n  - Read Performance: Subject to the full cost of underlying joins/aggregates on every read.\n- Materialized View:\n  - Storage: Consumes disk pages and RAM buffer space; can be indexed.\n  - Data Freshness: Stale; reflects the moment of the last refresh.\n  - Read Performance: Lightning fast; behaves like an indexed static table.\n  - Best for: Heavy analytical dashboards, daily financial rollups, and data warehousing.",
    code: `-- 1. Create a Materialized View pre-aggregating 50M rows into monthly summaries
CREATE MATERIALIZED VIEW mv_monthly_revenue_summary AS
SELECT 
    DATE_TRUNC('month', order_date)::DATE AS sales_month,
    product_category,
    COUNT(*) AS total_orders,
    SUM(total_amount) AS gross_revenue
FROM orders o
JOIN products p ON o.product_id = p.product_id
GROUP BY DATE_TRUNC('month', order_date), product_category;

-- 2. Build B-Tree index directly on the materialized view!
CREATE UNIQUE INDEX idx_mv_revenue ON mv_monthly_revenue_summary (sales_month, product_category);

-- 3. Refresh data periodically via cron or scheduled trigger
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_monthly_revenue_summary;`,
    recallHint: "Virtual view = query evaluated on the fly (real-time); Materialized view = pre-computed table stored on disk (fast reads, stale data).",
    interviewTip: "Highlight that materialized views can have their own independent B-Tree indexes, enabling sub-millisecond lookups on pre-aggregated data.",
    tags: ["materialized-views", "pre-aggregation", "caching", "olap-dashboards", "data-warehousing"]
  }),

  createCard({
    idNum: 112,
    category: "Views, Security & Data Patterns",
    concept: "Data Control Language (DCL): GRANT, REVOKE & Principle of Least Privilege",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Data Control Language (DCL) enforce the Principle of Least Privilege in relational databases?",
    quickAnswer: "Data Control Language (DCL) manages database authorization using `GRANT` (bestowing permissions) and `REVOKE` (withdrawing permissions). The **Principle of Least Privilege** mandates that application connections, users, and microservices are granted ONLY the minimum permissions strictly necessary to perform their business function (e.g. an API service only needs `SELECT, INSERT, UPDATE` on specific tables, NEVER `DROP`, `TRUNCATE`, or `SUPERUSER` privileges).",
    detailedAnswer: "DCL Hierarchy & Granularity:\n1. Object Granularity: Permissions can be granted at Database, Schema, Table, View, or individual Column level (`GRANT UPDATE (email, phone) ON users TO support_role`).\n2. Role-Based Access Control (RBAC): Best practice is creating Roles (`read_only_role`, `app_writer_role`), granting table permissions to the role, and assigning users to the role.\n3. The `WITH GRANT OPTION` Hazard: Allows a user to grant their permissions to other users; should NEVER be given to application services.",
    code: `-- Establishing Least-Privilege Role-Based Access Control (RBAC)
-- 1. Create dedicated application role
CREATE ROLE order_service_app WITH LOGIN PASSWORD 'vault_secret_99';

-- 2. Grant access strictly to specific tables
GRANT SELECT, INSERT, UPDATE ON orders, order_items TO order_service_app;

-- 3. Explicitly disallow destructive DDL
REVOKE ALL PRIVILEGES ON audit_log FROM order_service_app;
GRANT INSERT ON audit_log TO order_service_app; -- Append-only audit logging!

-- 4. Column-level permission: allow updating phone but NOT ssn
GRANT UPDATE (phone_number, delivery_address) ON customer_profiles TO order_service_app;`,
    recallHint: "GRANT gives permissions; REVOKE takes them away; enforce Least Privilege by granting minimal CRUD to roles, never superuser.",
    interviewTip: "Always mention granting permissions to Roles rather than individual users: RBAC scales cleanly as engineering teams grow.",
    tags: ["dcl", "grant", "revoke", "least-privilege", "rbac", "database-security"]
  }),

  createCard({
    idNum: 113,
    category: "Views, Security & Data Patterns",
    concept: "SQL Injection Mechanics & AST-Level Prepared Statement Defense",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is the root architectural cause of SQL Injection, and why do Prepared Statements provide 100% mathematical immunity?",
    quickAnswer: "The root cause of **SQL Injection** is mixing **untrusted user input with SQL code** via string concatenation (`query = \"SELECT * FROM users WHERE user = '\" + input + \"'\"`). If input contains `' OR '1'='1`, the user alters the Abstract Syntax Tree (AST) of the query. **Prepared Statements** provide 100% mathematical immunity because the SQL grammar is parsed, compiled, and finalized into an AST **BEFORE** user parameters are bound; the database engine treats parameters strictly as literal values, never as executable code.",
    detailedAnswer: "The Compilation Architecture of Prepared Statements:\n1. Pre-Compilation: The database parses `SELECT * FROM users WHERE username = ?` and builds the execution tree with an explicit parameter slot.\n2. Binary Wire Protocol: When user input `admin' OR 1=1--` is passed, the engine looks for an exact literal username string containing those characters, rather than re-parsing the query structure.\n3. Why Sanitization / RegEx Fails: Manual escaping (e.g. escaping quotes) fails against multi-byte character exploits, numeric injection (`WHERE id = input`), and second-order injection. Parameterization is the only safe standard.",
    code: `-- 1. VULNERABLE CODE (String Concatenation -> SQL Injection!):
-- const sql = "SELECT * FROM users WHERE email = '" + req.body.email + "' AND password = '" + req.body.password + "'";
-- Attacker input for email: ' OR 1=1 --
-- Compiled SQL: SELECT * FROM users WHERE email = '' OR 1=1 --' AND password = '...' (Bypasses auth!)

-- 2. SECURE CODE (Parameterized Prepared Statement -> 100% Immune!):
-- Node.js / pg parameterized query:
const sql = "SELECT id, email, password_hash FROM users WHERE email = $1";
const values = [req.body.email]; // Input is passed separately across the wire!
const result = await db.query(sql, values);`,
    recallHint: "SQL Injection happens when user input alters the query AST; Prepared Statements compile the AST first, treating input strictly as literals.",
    interviewTip: "Never say 'escape inputs' to fix SQL injection in interviews; always say 'use parameterized queries / prepared statements'.",
    tags: ["sql-injection", "prepared-statements", "parameterized-queries", "ast-security", "owasp-top-10"]
  }),

  createCard({
    idNum: 114,
    category: "Views, Security & Data Patterns",
    concept: "Keyset Pagination (Cursor-Based) vs Offset-Based Pagination at Scale",
    priority: "must-know",
    difficulty: "must-know",
    question: "Why does OFFSET pagination collapse at scale, and how does Keyset (Cursor-Based) pagination achieve O(1) performance?",
    quickAnswer: "Under `OFFSET n`, the database engine must physically read, process, and discard all $n$ rows from disk before returning the next page ($O(N)$ scanning cost); querying `OFFSET 1000000 LIMIT 10` forces the database to read 1,000,010 rows. **Keyset (Cursor-Based) Pagination** remembers the last seen value of the unique sorting column and seeks directly into the B-Tree index: `WHERE (created_at, id) < (last_created_at, last_id) ORDER BY created_at DESC, id DESC LIMIT 10` ($O(1)$ constant time).",
    detailedAnswer: "Keyset Pagination Advantages:\n1. Constant $O(1)$ Speed: Page 1,000,000 runs in 1 millisecond, identical to Page 1, because it performs a direct B-Tree index seek.\n2. No Row Drift / Duplication: If new rows are inserted while a user browses, `OFFSET` pagination causes rows to shift and repeat across pages. Keyset pagination maintains a stable cursor anchor.\n3. Requirements: Requires a deterministic ordering key (typically a timestamp + primary key tie-breaker) backed by a composite index: `CREATE INDEX (created_at DESC, id DESC)`.",
    code: `-- 1. SLOW AT SCALE: Offset-Based Pagination (O(N) - Scans and discards 100,000 rows!)
SELECT id, title, created_at
FROM articles
ORDER BY created_at DESC, id DESC
LIMIT 10 OFFSET 100000;

-- 2. FAST AT SCALE: Keyset (Cursor-Based) Pagination (O(1) - Instant B-Tree Index Seek!)
-- The client passes the cursor coordinates of the last item from the previous page:
-- Cursor: last_created_at = '2026-05-15 10:30:00', last_id = 4521
SELECT id, title, created_at
FROM articles
WHERE (created_at, id) < ('2026-05-15 10:30:00', 4521)
ORDER BY created_at DESC, id DESC
LIMIT 10;`,
    recallHint: "OFFSET n scans and discards n rows (O(N) lag); Keyset uses WHERE (date, id) < (last_date, last_id) for instant O(1) B-Tree seeks.",
    interviewTip: "This is a quintessential senior system design topic: explain why Infinite Scroll APIs in mobile apps MUST use cursor-based keyset pagination.",
    tags: ["keyset-pagination", "cursor-pagination", "offset-bottleneck", "b-tree-seek", "infinite-scroll"]
  }),

  createCard({
    idNum: 115,
    category: "Views, Security & Data Patterns",
    concept: "Safe Batched Mutations: Chunked Deletions & Updates on Large Tables",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why does running a single DELETE or UPDATE on 10 million rows crash production, and how do you batch mutations safely?",
    quickAnswer: "Executing `DELETE FROM logs WHERE created_at < '2025-01-01'` on 10 million rows in a single statement causes catastrophic failures: 1) Acquires exclusive row/table locks for minutes, blocking application queries; 2) Generates a massive transaction log (WAL/Undo log), risking disk exhaustion; and 3) Exhausts database transaction memory. The production solution is **Batch Chunking**: deleting rows in small iterative chunks of 5,000 to 10,000 rows in separate short transactions with brief pauses.",
    detailedAnswer: "Batch Mutation Architecture:\n1. Small Commits: Delete 5,000 rows, execute `COMMIT;`, release locks.\n2. Sleep Interval: Sleep 100ms between batches to allow active user queries and background autovacuum to run.\n3. Termination Condition: Loop until `rows_affected == 0`.\n4. Primary Key Slicing: Best practice is slicing by Primary Key range (`WHERE id BETWEEN ? AND ?`) to avoid scanning the whole table on every chunk.",
    code: `-- Safe Batched Chunked Deletion (PL/pgSQL or Application Loop)
DO $$
DECLARE
    deleted_count INT := 1;
BEGIN
    WHILE deleted_count > 0 LOOP
        -- Delete in manageable chunks of 5,000 rows
        WITH batch_to_delete AS (
            SELECT id 
            FROM audit_logs
            WHERE created_at < CURRENT_DATE - INTERVAL '1 year'
            LIMIT 5000
        )
        DELETE FROM audit_logs
        WHERE id IN (SELECT id FROM batch_to_delete);
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        
        -- Commit transaction to release locks and allow WAL recycling
        COMMIT;
        
        -- Brief throttle to avoid saturating storage IOPS
        PERFORM pg_sleep(0.05);
    END LOOP;
END $$;`,
    recallHint: "Never delete 10M rows in one query; batch in chunks of 5,000 with COMMIT and brief sleeps to release locks and prevent WAL spikes.",
    interviewTip: "Explain that batching mutations allows database transaction logs to be recycled and checkpointed smoothly without running out of disk space.",
    tags: ["batch-mutations", "chunked-delete", "lock-contention", "wal-bloat", "production-maintenance"]
  }),

  createCard({
    idNum: 116,
    category: "Views, Security & Data Patterns",
    concept: "Temporary Tables vs Table Variables vs Common Table Expressions",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the architectural differences between Temporary Tables, Table Variables, and CTEs across relational systems?",
    quickAnswer: "**CTEs** are in-memory statement-scoped expressions (disappear after the query). **Temporary Tables** (`CREATE TEMPORARY TABLE`) are session-scoped tables backed by physical disk and buffer pools; they support standard indexes, statistics, and transaction control, making them ideal for heavy multi-step batch procedures. **Table Variables** (in SQL Server) are memory-first variables with no statistics, which can cause severe query planner cardinality misestimates if they hold more than 100 rows.",
    detailedAnswer: "Comparison Matrix:\n- CTE (`WITH`):\n  - Scope: Single SQL statement.\n  - Indexes: Cannot create indexes.\n  - Best for: Query modularization and recursion.\n- Temporary Table (`#temp` / `TEMP TABLE`):\n  - Scope: Lifetime of the client connection/session.\n  - Storage: Backed by temp database storage.\n  - Indexes & Stats: Full support for B-Trees and `ANALYZE` statistics.\n  - Best for: Staging millions of rows across complex stored procedures.",
    code: `-- 1. Temporary Table (Session-scoped, supports indexes and multiple queries)
CREATE TEMPORARY TABLE temp_qualified_leads (
    lead_id INT PRIMARY KEY,
    score NUMERIC(5, 2)
);

INSERT INTO temp_qualified_leads
SELECT id, lead_score FROM incoming_leads WHERE lead_score >= 80;

-- Create index on the temporary table for downstream join performance
CREATE INDEX idx_temp_leads_score ON temp_qualified_leads (score);

-- Use temporary table across multiple subsequent queries in session
SELECT * FROM sales_reps sr JOIN temp_qualified_leads l ON sr.territory_id = l.lead_id;

-- Automatically dropped on connection disconnect!`,
    recallHint: "CTE = single statement; Temp table = session lifetime, supports indexes and stats; Table variable = memory-first, lacks statistics.",
    interviewTip: "State the rule: 'Use CTEs for readable one-off queries; use Temp Tables with indexes when staging large intermediate datasets across multiple stored procedure steps.'",
    tags: ["temp-tables", "table-variables", "ctes", "session-scope", "intermediate-storage"]
  }),

  createCard({
    idNum: 117,
    category: "Views, Security & Data Patterns",
    concept: "Cross-Database SQL Portability Traps: Date Math, String Concat & Quoting",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the common non-portable SQL dialect traps when migrating queries between PostgreSQL, MySQL, SQL Server, and Oracle?",
    quickAnswer: "Major cross-database portability traps include: 1) **String Concatenation** (ANSI/Postgres/Oracle uses `||`; SQL Server uses `+`; MySQL uses `CONCAT()`); 2) **Identifier Quoting** (ANSI/Postgres/Oracle uses `\"table\"`; MySQL uses `` `table` ``; SQL Server uses `[table]`); 3) **Date Arithmetic** (Postgres uses `+ INTERVAL '1 day'`; SQL Server uses `DATEADD()`; MySQL uses `DATE_ADD()`); and 4) **Regex Matching** (syntax and operator keywords vary completely).",
    detailedAnswer: "Dialect Divergence Matrix:\n| Feature | ANSI Standard | PostgreSQL | MySQL | SQL Server | Oracle |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n| String Concat | `||` | `||` | `CONCAT()` | `+` or `CONCAT()` | `||` |\n| Quote Identifiers | `\"name\"` | `\"name\"` | `` `name` `` | `[name]` | `\"name\"` |\n| Pagination | `FETCH NEXT` | `LIMIT / OFFSET` | `LIMIT / OFFSET` | `OFFSET / FETCH` | `FETCH NEXT` |\n| Identity Column | `GENERATED AS IDENTITY` | `IDENTITY` or `SERIAL` | `AUTO_INCREMENT` | `IDENTITY(1,1)` | `IDENTITY` |\n| Boolean Type | `BOOLEAN` | `BOOLEAN` (native) | `TINYINT(1)` | `BIT` | `NUMBER(1)` |",
    code: `-- ANSI Standard Portable Constructs:
-- 1. Use standard CAST instead of vendor functions
SELECT CAST(order_date AS DATE) FROM orders;

-- 2. Use Searched CASE instead of vendor IF/IIF/DECODE
SELECT CASE WHEN score >= 50 THEN 'Pass' ELSE 'Fail' END FROM exams;

-- 3. Use standard COALESCE instead of NVL or ISNULL
SELECT COALESCE(phone, 'No Phone') FROM contacts;

-- 4. Use standard ANSI FETCH FIRST instead of LIMIT
SELECT * FROM products ORDER BY price DESC OFFSET 0 ROWS FETCH NEXT 5 ROWS ONLY;`,
    recallHint: "Portability traps: concat (|| vs +), quoting (\"\" vs `` vs []), date math, and pagination; stick to ANSI standards (COALESCE, CASE, CAST).",
    interviewTip: "Demonstrating knowledge of cross-database quirks proves real-world polyglot database engineering experience.",
    tags: ["sql-portability", "cross-dialect", "ansi-standards", "mysql-vs-postgres", "sql-server"]
  }),

  createCard({
    idNum: 118,
    category: "Views, Security & Data Patterns",
    concept: "Database Triggers Architecture: BEFORE vs AFTER vs INSTEAD OF",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do BEFORE, AFTER, and INSTEAD OF triggers differ in the database transaction lifecycle?",
    quickAnswer: "`BEFORE` triggers fire before changes are written to the table heap, allowing data transformation, validation, or aborting the statement before constraints are checked. `AFTER` triggers fire after modifications and constraint assertions succeed, ideal for audit logging and cascading notifications. `INSTEAD OF` triggers intercept modifications on **non-updatable views**, executing custom relational inserts/updates on the underlying base tables.",
    detailedAnswer: "Trigger Lifecycle & Dangers:\n1. Row-Level (`FOR EACH ROW`): Executes once for every tuple modified. Accesses `NEW` and `OLD` pseudo-records.\n2. Statement-Level (`FOR EACH STATEMENT`): Executes once per SQL statement, regardless of whether 0 or 100,000 rows were modified.\n3. The Production Danger of Triggers: Triggers add hidden, invisible side-effects that make debugging difficult, can cause cascading infinite loops (Trigger A updates B, which updates A), and significantly increase write latency.",
    code: `-- 1. BEFORE Trigger: Data Cleansing & Validation (Mutates NEW in-flight!)
CREATE OR REPLACE FUNCTION sanitize_user_input()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.email := LOWER(TRIM(NEW.email));
    NEW.updated_at := CURRENT_TIMESTAMP;
    RETURN NEW; -- Modified record is committed to heap!
END;
$$;

-- 2. INSTEAD OF Trigger: Making complex multi-table Views Updatable!
CREATE TRIGGER trg_instead_of_view_insert
INSTEAD OF INSERT ON vw_orders_with_customer_details
FOR EACH ROW EXECUTE FUNCTION route_view_inserts_to_base_tables();`,
    recallHint: "BEFORE modifies/validates NEW in-flight; AFTER logs audits; INSTEAD OF intercepts view writes; triggers hide side-effects.",
    interviewTip: "Highlight that triggers execute inside the caller's transaction: if a trigger fails, the main user transaction rolls back entirely.",
    tags: ["triggers", "before-trigger", "after-trigger", "instead-of-trigger", "view-updates"]
  }),

  createCard({
    idNum: 119,
    category: "Views, Security & Data Patterns",
    concept: "Soft Delete Patterns vs Hard Delete: Query Filtering & Unique Constraints",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the engineering trade-offs of Soft Deletes (deleted_at IS NOT NULL), and how does it complicate unique constraints?",
    quickAnswer: "**Soft Delete** marks records as inactive (`deleted_at TIMESTAMP` or `is_deleted BOOLEAN`) instead of physically removing tuples (`DELETE`). While it provides instant undelete capabilities and audit history, it introduces severe complexity: 1) **Polluted Queries**: Every single query, join, and count across the entire application must remember `WHERE deleted_at IS NULL`; and 2) **Broken Unique Constraints**: Standard `UNIQUE (email)` blocks a user from re-registering an account if an old soft-deleted record exists.",
    detailedAnswer: "Soft Delete Pitfalls & Solutions:\n- The Unique Constraint Trap: If user deletes account 'alex@co.com' and tries to re-register, `INSERT` fails due to unique violation!\n  - Solution: Partial Unique Index: `CREATE UNIQUE INDEX (email) WHERE deleted_at IS NULL`.\n- Table Bloat: Soft-deleted rows remain in the table forever, poisoning RAM buffer caches and slowing down sequential scans.\n- Modern Alternative: Perform physical hard deletes on primary tables and write deleted row snapshots into an append-only archive/audit table.",
    code: `-- Soft Delete Pattern with Partial Unique Constraint
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    deleted_at TIMESTAMP NULL -- NULL = Active; Timestamp = Soft Deleted
);

-- Partial Unique Index: Uniqueness is enforced strictly on ACTIVE accounts!
CREATE UNIQUE INDEX idx_accounts_active_email 
ON accounts (email) 
WHERE deleted_at IS NULL;

-- 1. User registers:
INSERT INTO accounts (email) VALUES ('alex@co.com');

-- 2. User soft-deletes account:
UPDATE accounts SET deleted_at = CURRENT_TIMESTAMP WHERE email = 'alex@co.com';

-- 3. User re-registers with same email: SUCCEEDS! (Prior row has deleted_at NOT NULL)
INSERT INTO accounts (email) VALUES ('alex@co.com');`,
    recallHint: "Soft delete marks deleted_at; complicates unique constraints (requires partial index WHERE deleted_at IS NULL); pollutes all queries.",
    interviewTip: "Discuss the architectural debate: many senior engineers prefer hard deletes combined with an audit archive table to keep primary tables lean and queries simple.",
    tags: ["soft-delete", "hard-delete", "deleted_at", "partial-unique-index", "data-modeling"]
  }),

  createCard({
    idNum: 120,
    category: "Views, Security & Data Patterns",
    concept: "Database Constraints vs Application-Level Validation Trade-Offs",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why is application-level validation insufficient on its own, and why must business invariants be enforced at the database constraint layer?",
    quickAnswer: "Application-level validation (e.g. Zod/Joi in Node.js) provides user-friendly error messages and fast input feedback, but CANNOT guarantee data integrity under concurrency due to **race conditions** (Time-of-Check to Time-of-Use / TOCTOU bugs). Furthermore, multiple services, background jobs, ETL scripts, and direct DBA repairs bypass application code entirely. Enforcing invariants at the database constraint layer (`PRIMARY KEY`, `FOREIGN KEY`, `UNIQUE`, `CHECK`) provides mathematical ACID integrity at the single source of truth.",
    detailedAnswer: "The Defense-in-Depth Relational Model:\n1. Application Layer: Validates input format, sanitizes strings, checks authorization, and returns human-readable validation errors before opening DB connections.\n2. Database Constraint Layer: The final, unbreachable defense. Enforces entity integrity, referential cascades, domain boundaries, and multi-threaded race condition prevention at the storage engine level.\n3. Race Condition Proof: Checking `if (await db.findUser(email)) throw Error()` in Node.js fails if two concurrent HTTP requests arrive at the same millisecond; only a database `UNIQUE` constraint prevents duplicates.",
    code: `-- Defense-in-Depth Relational Architecture
CREATE TABLE bank_wallets (
    wallet_id UUID PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL,
    -- Engine-level invariant: Balance can NEVER drop below zero!
    CONSTRAINT chk_non_negative_balance CHECK (balance >= 0.00),
    -- Engine-level invariant: Supported currencies only
    CONSTRAINT chk_valid_currency CHECK (currency IN ('USD', 'EUR', 'GBP')),
    -- Engine-level invariant: One wallet per currency per user
    CONSTRAINT uq_user_currency UNIQUE (user_id, currency)
);`,
    breakdown: [
      "Application layer formats errors for frontend users.",
      "Database constraint layer prevents corruption from concurrent race conditions, ETL scripts, and microservice bypasses.",
      "The ultimate expression of Dr. E.F. Codd's Relational Model."
    ],
    recallHint: "Application validation gives friendly errors; database constraints prevent concurrent race conditions and protect the single source of truth.",
    interviewTip: "Conclude with the principle of Defense-in-Depth: 'Validate early in the application for user experience; enforce definitively in the database for absolute ACID truth.'",
    tags: ["defense-in-depth", "database-constraints", "application-validation", "race-conditions", "data-integrity"]
  })
];

module.exports = cards;
