const { createCard } = require("../pg_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 49,
    category: "Advanced PostgreSQL SQL Capabilities",
    concept: "INSERT ... ON CONFLICT DO UPDATE (Upsert Target & EXCLUDED Pseudo-Table)",
    priority: "must-know",
    difficulty: "must-know",
    question: "How does PostgreSQL's INSERT ... ON CONFLICT DO UPDATE (Upsert) work, and what is the EXCLUDED pseudo-table?",
    quickAnswer: "PostgreSQL's `ON CONFLICT` clause provides atomic, race-condition-free upserts. It requires a conflict target that matches a `UNIQUE` index or constraint. If a collision occurs, `DO UPDATE` executes, allowing you to reference the proposed insert row using the special pseudo-table `EXCLUDED` to update columns or combine values atomically without application-side retry loops.",
    detailedAnswer: "Upsert Execution Mechanics:\n1. Conflict Target: Can be a column name, expression, or partial index predicate: `ON CONFLICT (email) WHERE is_active = true`.\n2. `EXCLUDED` Pseudo-Table: Represents the row that was rejected due to the unique violation. E.g., `SET login_count = users.login_count + 1, last_login = EXCLUDED.last_login`.\n3. Concurrency Safety: Handled at the index lock level with speculative insertion (`dirty read` check + buffer lock), avoiding race conditions common with manual `SELECT ... IF EXISTS` checks.\n4. `DO NOTHING`: Silently skips the insert if a conflict occurs, returning 0 rows affected.",
    code: `-- Atomic upsert maintaining login stats
INSERT INTO user_accounts (id, email, login_count, last_login)
VALUES (42, 'alex@example.com', 1, NOW())
ON CONFLICT (email) 
DO UPDATE SET
    login_count = user_accounts.login_count + 1,
    last_login = EXCLUDED.last_login,
    updated_at = NOW()
RETURNING id, login_count, last_login;

-- Partial index conflict target example
INSERT INTO active_tokens (user_id, token, expires_at)
VALUES (101, 'tok_123', NOW() + interval '1 hour')
ON CONFLICT (user_id) WHERE is_valid = true
DO UPDATE SET token = EXCLUDED.token;`,
    recallHint: "ON CONFLICT requires unique constraint; EXCLUDED holds the incoming row; guarantees atomic upsert without race conditions.",
    interviewTip: "Never use application-level `SELECT ... INSERT` in high concurrency systems; explain that speculative locks in `ON CONFLICT` guarantee ACID atomicity.",
    tags: ["upsert", "on-conflict", "excluded-table", "concurrency", "atomic-writes"]
  }),

  createCard({
    idNum: 50,
    category: "Advanced PostgreSQL SQL Capabilities",
    concept: "RETURNING Clause on INSERT, UPDATE & DELETE",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the RETURNING clause operate across INSERT, UPDATE, and DELETE statements in PostgreSQL?",
    quickAnswer: "PostgreSQL's `RETURNING` clause returns modified rows directly from `INSERT`, `UPDATE`, or `DELETE` statements without requiring a follow-up `SELECT` query. It supports returning generated auto-increment/UUID IDs, newly calculated expressions, system columns (`xmin`, `ctid`), or even prior row values inside writable CTEs, drastically cutting network latency in API microservices.",
    detailedAnswer: "RETURNING Capabilities:\n1. `INSERT ... RETURNING *`: Returns defaults, generated columns, and sequence IDs immediately.\n2. `UPDATE ... RETURNING`: Returns the newly modified row state.\n3. `DELETE ... RETURNING`: Returns the deleted records, perfect for archival pipelines or audit trails.\n4. Writable CTEs: You can pipe `RETURNING` rows from a `DELETE` directly into an `INSERT` in a single atomic SQL statement.",
    code: `-- 1. Insert and retrieve generated ID and timestamp instantly
INSERT INTO orders (customer_id, amount) 
VALUES (105, 299.99) 
RETURNING id, created_at, status;

-- 2. Atomic soft-delete and archive using Writable CTE + RETURNING
WITH archived_records AS (
    DELETE FROM active_sessions 
    WHERE expires_at < NOW()
    RETURNING session_id, user_id, created_at, NOW() AS archived_at
)
INSERT INTO session_history (session_id, user_id, created_at, archived_at)
SELECT session_id, user_id, created_at, archived_at 
FROM archived_records;`,
    recallHint: "RETURNING provides write output in the same roundtrip; writable CTEs chain RETURNING into downstream operations.",
    interviewTip: "Contrast PostgreSQL's `RETURNING` with MySQL (which requires `LAST_INSERT_ID()` and can only return a single auto-increment integer, not whole rows or deleted items).",
    tags: ["returning-clause", "writable-cte", "data-manipulation", "latency-reduction", "crud"]
  }),

  createCard({
    idNum: 51,
    category: "Advanced PostgreSQL SQL Capabilities",
    concept: "DISTINCT ON (...) Deduplication Pattern",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is DISTINCT ON (...) in PostgreSQL, and how is it more powerful than standard ANSI SQL DISTINCT or GROUP BY?",
    quickAnswer: "`DISTINCT ON (col1, col2, ...)` is a PostgreSQL-specific construct that keeps only the first row of each distinct group based on the specified columns. When combined with `ORDER BY`, it allows you to pick the 'most recent', 'cheapest', or 'highest ranked' complete row per entity without writing complex `ROW_NUMBER() OVER (...)` subqueries or self-joins.",
    detailedAnswer: "Rules for DISTINCT ON:\n1. Syntax Requirement: The leftmost columns in the `ORDER BY` clause MUST match the columns specified in `DISTINCT ON (...)`.\n2. Tie-Breaking: Subsequent columns in `ORDER BY` determine which exact row from the group is retained.\n3. Performance: The query planner sorts the dataset once (or uses an existing B-Tree index) and scans forward, instantly skipping to the next group after reading the first tuple.",
    code: `-- Get the most recent purchase for each customer
SELECT DISTINCT ON (customer_id) 
    customer_id, 
    id AS order_id, 
    amount, 
    created_at
FROM orders
ORDER BY customer_id, created_at DESC;

-- Get the latest price quote for each stock ticker
SELECT DISTINCT ON (ticker) 
    ticker, 
    price, 
    recorded_at
FROM stock_ticks
ORDER BY ticker, recorded_at DESC;`,
    recallHint: "DISTINCT ON (col) keeps the first row per group based on ORDER BY; requires matching leftmost ORDER BY columns.",
    interviewTip: "Interviewers love asking how to fetch 'the latest record per user': demonstrate `DISTINCT ON (user_id) ... ORDER BY user_id, created_at DESC` as the idiomatic PostgreSQL solution.",
    tags: ["distinct-on", "deduplication", "latest-per-group", "window-alternative", "sorting"]
  }),

  createCard({
    idNum: 52,
    category: "Advanced PostgreSQL SQL Capabilities",
    concept: "FILTER (WHERE ...) Clause on Aggregate Functions",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the FILTER (WHERE ...) clause on aggregate functions eliminate ugly CASE WHEN statements?",
    quickAnswer: "PostgreSQL supports the SQL standard `aggregate() FILTER (WHERE condition)` clause. Instead of wrapping every aggregate in convoluted `SUM(CASE WHEN condition THEN 1 ELSE 0 END)` or `COUNT(CASE WHEN ... THEN id END)`, the `FILTER` clause explicitly instructs the aggregate function to evaluate only the rows meeting the boolean predicate, resulting in cleaner, faster pivot tables.",
    detailedAnswer: "Benefits of FILTER (WHERE ...):\n1. Readability: Code is declarative and self-documenting.\n2. Null Handling: Avoids common bugs with `COUNT(CASE WHEN ... THEN NULL END)`.\n3. Compatible with all aggregates: Works on `COUNT`, `SUM`, `AVG`, `ARRAY_AGG`, `JSONB_AGG`, etc.\n4. Planner Efficiency: Single-pass aggregation over the dataset without multiple subqueries or joins.",
    code: `-- Clean dashboard KPI summary using FILTER (WHERE ...)
SELECT 
    DATE_TRUNC('month', created_at) AS month,
    COUNT(*) AS total_orders,
    COUNT(*) FILTER (WHERE status = 'COMPLETED') AS completed_orders,
    COUNT(*) FILTER (WHERE status = 'REFUNDED') AS refunded_orders,
    SUM(amount) FILTER (WHERE status = 'COMPLETED') AS net_revenue,
    AVG(delivery_minutes) FILTER (WHERE is_express = true) AS avg_express_delivery_time
FROM orders
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY month DESC;`,
    recallHint: "aggregate() FILTER (WHERE cond) replaces CASE WHEN inside aggregates; single-pass filtering for clean pivot summaries.",
    interviewTip: "Mention that `FILTER (WHERE ...)` works seamlessly with JSONB aggregates, e.g. `jsonb_agg(item) FILTER (WHERE item IS NOT NULL)` to clean up empty arrays.",
    tags: ["filter-clause", "aggregates", "pivot-tables", "kpi-reporting", "sql-syntax"]
  }),

  createCard({
    idNum: 53,
    category: "Advanced PostgreSQL SQL Capabilities",
    concept: "WITH RECURSIVE for Hierarchical & Graph Traversal (Cycle Detection)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does WITH RECURSIVE execute in PostgreSQL, and how do you implement cycle detection in cyclic graphs?",
    quickAnswer: "`WITH RECURSIVE` executes a Common Table Expression iteratively: an anchor term runs first to seed an internal working table, and a recursive term executes repeatedly on the previous iteration's results until no new rows are produced. To prevent infinite loops in cyclic data (like social networks or dependency graphs), PostgreSQL arrays are used to track visited IDs, terminating the recursion with `WHERE NOT (child_id = ANY(path))` or using PostgreSQL 14+ `CYCLE` clause.",
    detailedAnswer: "WITH RECURSIVE Execution Engine:\n1. Working Table: Postgres maintains two internal row sets: the Intermediate table (results of step N) and the Working table (accumulated output).\n2. Iteration: The recursive query joins against the Intermediate table until step N returns zero rows.\n3. Cycle Prevention (Pre-PG14): Track visited nodes: `path INT[] = ARRAY[id]`, checking `NOT (next_id = ANY(path))`.\n4. Built-in `CYCLE` Clause (PostgreSQL 14+): Native syntax `CYCLE id SET is_cycle USING path` terminates graph cycles automatically.",
    code: `-- Recursive category hierarchy traversal with depth and breadcrumb path
WITH RECURSIVE category_tree AS (
    -- 1. Anchor query: top-level root categories
    SELECT id, name, parent_id, 1 AS depth, ARRAY[id] AS path, name::text AS breadcrumb
    FROM categories
    WHERE parent_id IS NULL

    UNION ALL

    -- 2. Recursive query: children of previous step
    SELECT c.id, c.name, c.parent_id, ct.depth + 1, ct.path || c.id, ct.breadcrumb || ' > ' || c.name
    FROM categories c
    JOIN category_tree ct ON c.parent_id = ct.id
    WHERE NOT (c.id = ANY(ct.path)) -- Cycle protection!
)
SELECT depth, breadcrumb FROM category_tree ORDER BY path;`,
    recallHint: "WITH RECURSIVE has an anchor query and a recursive query; track visited IDs in an array or use PG14 CYCLE clause to avoid infinite loops.",
    interviewTip: "Explain the working table mechanics: each recursive step only evaluates rows produced by the immediate preceding step, not the entire accumulated history.",
    tags: ["with-recursive", "graph-traversal", "hierarchies", "cycle-detection", "cte"]
  }),

  createCard({
    idNum: 54,
    category: "Advanced PostgreSQL SQL Capabilities",
    concept: "CTE Inlining: MATERIALIZED vs NOT MATERIALIZED Optimization Hints",
    priority: "must-know",
    difficulty: "advanced",
    question: "How did PostgreSQL 12 change CTE optimization, and when should you explicitly specify MATERIALIZED or NOT MATERIALIZED?",
    quickAnswer: "Prior to PostgreSQL 12, all Common Table Expressions (CTEs) acted as rigid optimization fences: PostgreSQL computed the CTE fully into temporary memory (materialization) and never pushed `WHERE` conditions down into it. PostgreSQL 12+ inlines CTEs automatically if they are non-recursive and side-effect free. Developers can now control this behavior explicitly using `WITH cte AS MATERIALIZED (...)` or `WITH cte AS NOT MATERIALIZED (...)`.",
    detailedAnswer: "Materialization Control:\n1. Pre-PG12 Problem: Writing a CTE acted as an optimization wall, blocking the planner from pushing outer `WHERE` filters or index scans inside the CTE.\n2. `AS NOT MATERIALIZED`: Tells the planner to inline the CTE directly into the main query (like a subquery in the `FROM` clause), allowing index pushdown.\n3. `AS MATERIALIZED`: Forces PostgreSQL to evaluate the CTE once, cache the intermediate result, and prevent repeated evaluations if referenced multiple times across the query, or when you want to intentionally isolate expensive calculations.",
    code: `-- Force PostgreSQL to cache an expensive aggregation used multiple times
WITH monthly_rollup AS MATERIALIZED (
    SELECT 
        department_id, 
        SUM(salary) AS total_payroll, 
        COUNT(*) AS emp_count
    FROM employees
    GROUP BY department_id
)
SELECT * FROM monthly_rollup WHERE total_payroll > 100000
UNION ALL
SELECT * FROM monthly_rollup WHERE emp_count > 50;

-- Force inlining so outer WHERE customer_id = 42 pushes into the CTE
WITH recent_orders AS NOT MATERIALIZED (
    SELECT * FROM orders ORDER BY created_at DESC
)
SELECT * FROM recent_orders WHERE customer_id = 42;`,
    recallHint: "PG12+ inlines CTEs by default; AS MATERIALIZED caches results and acts as an optimization fence; AS NOT MATERIALIZED forces inlining.",
    interviewTip: "Highlight that `AS MATERIALIZED` is a powerful tuning tool when you want to stop the query planner from choosing a bad join order or to calculate a heavy function only once.",
    tags: ["cte", "materialized", "optimization-fence", "query-planner", "postgres-12"]
  }),

  createCard({
    idNum: 55,
    category: "Advanced PostgreSQL SQL Capabilities",
    concept: "LATERAL Subqueries and Set-Returning Joins",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a LATERAL join in PostgreSQL and how does it act like a foreach loop in SQL?",
    quickAnswer: "A `LATERAL` join allows a subquery in the `FROM` clause to reference columns from preceding tables in the join order (which is illegal in standard SQL). It evaluates the right-hand subquery once for every row returned by the left-hand table, effectively acting as an efficient database-side `foreach` loop. It is widely used to fetch top-N records per parent, unpack JSONB arrays, or compute complex multi-step row formulas.",
    detailedAnswer: "LATERAL Mechanics:\n1. Scope Visibility: Standard joins evaluate both tables independently before matching `ON` clauses. `LATERAL` passes each row of table A into the subquery of table B as a parameter.\n2. Top-N Per Entity: Solves the 'Top 3 orders for EVERY customer' problem with high efficiency when backed by an index.\n3. Unpacking Dynamic Data: Used with set-returning functions like `generate_series()`, `jsonb_array_elements()`, or `regexp_matches()`.",
    code: `-- Fetch the TOP 2 most expensive orders for EVERY active customer
SELECT 
    c.id AS customer_id, 
    c.name, 
    o.id AS order_id, 
    o.amount, 
    o.created_at
FROM customers c
CROSS JOIN LATERAL (
    SELECT id, amount, created_at
    FROM orders
    WHERE customer_id = c.id
    ORDER BY amount DESC
    LIMIT 2
) o
WHERE c.is_active = true;`,
    recallHint: "LATERAL allows subqueries to reference preceding table columns; acts like an index-backed foreach loop per row.",
    interviewTip: "Contrast `LATERAL` with window functions: for 'top 3 per customer' on huge tables, an indexed `LATERAL` subquery is vastly faster because it only reads 3 index tuples per customer instead of scanning and numbering all orders.",
    tags: ["lateral-join", "top-n-per-group", "subqueries", "index-optimization", "foreach-sql"]
  }),

  createCard({
    idNum: 56,
    category: "Advanced PostgreSQL SQL Capabilities",
    concept: "Window Function Frames (ROWS vs RANGE vs GROUPS)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the difference between ROWS, RANGE, and GROUPS window framing specifications in PostgreSQL?",
    quickAnswer: "Window framing specifications define the moving subset of rows evaluated by an aggregate within a partition. `ROWS` counts physical row offsets (e.g. `ROWS BETWEEN 2 PRECEDING AND CURRENT ROW`). `RANGE` evaluates offsets based on value differences of the `ORDER BY` column (e.g. `RANGE BETWEEN INTERVAL '7 days' PRECEDING AND CURRENT ROW`). `GROUPS` counts peer groupings of identical values in the `ORDER BY` column.",
    detailedAnswer: "Framing Details:\n1. Default Frame: If `ORDER BY` is specified without an explicit frame, the default is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`. This includes all duplicate ties of the current row, which can lead to unexpected sums and high memory overhead.\n2. `ROWS`: Best for sliding physical windows (e.g. 5-day moving average where each row is a day).\n3. `RANGE`: Operates on timestamps or numbers directly: `RANGE BETWEEN 50 PRECEDING AND 50 FOLLOWING` calculates based on values, even if physical rows are sparse or missing.\n4. `GROUPS`: Treats duplicate keys as a single unit.",
    code: `-- 1. Physical 3-row moving average using ROWS
SELECT 
    recorded_at, 
    temperature,
    AVG(temperature) OVER (
        ORDER BY recorded_at 
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS rolling_3_reading_avg
FROM sensor_logs;

-- 2. Time-based 7-day rolling revenue using RANGE
SELECT 
    sold_at, 
    revenue,
    SUM(revenue) OVER (
        ORDER BY sold_at 
        RANGE BETWEEN INTERVAL '7 days' PRECEDING AND CURRENT ROW
    ) AS rolling_7_day_revenue
FROM daily_sales;`,
    recallHint: "ROWS counts physical tuples; RANGE counts value/interval differences; GROUPS counts duplicate key peer groups.",
    interviewTip: "Always explicitly specify `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` when calculating running totals on unique values, as `RANGE` requires sorting and tie checks that cost extra CPU.",
    tags: ["window-functions", "window-frames", "rows-vs-range", "moving-averages", "analytics"]
  }),

  createCard({
    idNum: 57,
    category: "Advanced PostgreSQL SQL Capabilities",
    concept: "GROUPING SETS, ROLLUP and CUBE Aggregations",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do GROUPING SETS, ROLLUP, and CUBE produce multi-dimensional summary reports in PostgreSQL in a single query?",
    quickAnswer: "`GROUPING SETS` lets you specify multiple independent `GROUP BY` clauses in a single query pass. `ROLLUP` produces hierarchical subtotals and a grand total (e.g. Year -> Month -> Day -> Grand Total). `CUBE` generates every possible mathematical permutation of the grouping dimensions. Using them replaces multiple separate queries glued together with `UNION ALL`.",
    detailedAnswer: "Aggregation Primitives:\n1. `GROUPING SETS ((a), (b), ())`: Groups by `a`, groups by `b`, and produces a grand total `()`.\n2. `ROLLUP (country, state, city)`: Generates `(country, state, city)`, `(country, state)`, `(country)`, and `()`.\n3. `CUBE (dept, gender)`: Generates `(dept, gender)`, `(dept)`, `(gender)`, and `()`.\n4. `GROUPING(col)`: Function returning `1` if the column is currently aggregated away in a subtotal or `0` if it represents actual row data, allowing you to label 'All Departments' cleanly.",
    code: `-- Multi-level hierarchical sales report with ROLLUP and GROUPING labels
SELECT 
    CASE WHEN GROUPING(region) = 1 THEN 'All Regions' ELSE region END AS region,
    CASE WHEN GROUPING(channel) = 1 THEN 'All Channels' ELSE channel END AS channel,
    SUM(revenue) AS total_revenue
FROM sales_records
GROUP BY ROLLUP (region, channel)
ORDER BY region, channel;`,
    recallHint: "ROLLUP does hierarchical subtotals; CUBE does all permutations; GROUPING SETS does custom subsets; GROUPING() identifies subtotal rows.",
    interviewTip: "Mention how `ROLLUP` avoids multiple table scans by calculating hierarchical aggregations in a single sequential pass across disk.",
    tags: ["grouping-sets", "rollup", "cube", "reporting", "olap"]
  }),

  createCard({
    idNum: 58,
    category: "Advanced PostgreSQL SQL Capabilities",
    concept: "MERGE Statement in PostgreSQL 15+ vs ON CONFLICT",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the SQL standard MERGE statement in PostgreSQL 15+ compare to INSERT ... ON CONFLICT?",
    quickAnswer: "PostgreSQL 15 introduced the standard `MERGE INTO target USING source ON join_condition`. Unlike `ON CONFLICT` (which is strictly an `INSERT` statement tied to a single unique constraint), `MERGE` handles complex cross-table synchronizations involving multiple conditional `WHEN MATCHED THEN UPDATE / DELETE` and `WHEN NOT MATCHED THEN INSERT` branches in a single atomic SQL command.",
    detailedAnswer: "MERGE vs ON CONFLICT:\n1. `ON CONFLICT`:\n   - Best for single-table fast API upserts.\n   - Bound strictly to a unique index or primary key constraint.\n   - Speculative locking prevents concurrent race conditions.\n2. `MERGE` (PostgreSQL 15+):\n   - Joins an entire source dataset (table, query, or CSV import) against target.\n   - Can `DELETE` when matched based on custom conditions: `WHEN MATCHED AND target.balance = 0 THEN DELETE`.\n   - Concurrency Caveat: Under Read Committed isolation, concurrent conflicting updates on target rows can raise serialization errors; `ON CONFLICT` is safer for high-frequency concurrent point inserts.",
    code: `-- Synchronize customer balances using MERGE in PostgreSQL 15+
MERGE INTO customers c
USING incoming_payments p ON c.id = p.customer_id
WHEN MATCHED AND (c.balance - p.amount) <= 0 THEN
    UPDATE SET balance = 0, status = 'SETTLED', updated_at = NOW()
WHEN MATCHED THEN
    UPDATE SET balance = c.balance - p.amount, updated_at = NOW()
WHEN NOT MATCHED THEN
    INSERT (id, balance, status, created_at)
    VALUES (p.customer_id, p.amount, 'ACTIVE', NOW());`,
    recallHint: "MERGE synchronizes two tables with conditional UPDATE, DELETE, and INSERT; ON CONFLICT is specialized for single-row upserts.",
    interviewTip: "Make sure to point out that `MERGE` was only added in PostgreSQL 15, and for concurrent OLTP point upserts, `ON CONFLICT` remains the safer, more resilient choice.",
    tags: ["merge", "on-conflict", "etl", "postgres-15", "table-synchronization"]
  }),

  createCard({
    idNum: 59,
    category: "Advanced PostgreSQL SQL Capabilities",
    concept: "TABLESAMPLE Sampling Strategies (BERNOULLI vs SYSTEM)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is TABLESAMPLE in PostgreSQL and how do the BERNOULLI and SYSTEM sampling methods differ?",
    quickAnswer: "`TABLESAMPLE` extracts a random percentage sample of a table without scanning all rows (avoiding the massive $O(N \\log N)$ cost of `ORDER BY random() LIMIT 100`). `SYSTEM` samples at the 8KB physical disk block level (extremely fast, but clustered), while `BERNOULLI` samples every individual row independently with probability $P/100$ (slower, but yields an unskewed, uniformly distributed random sample).",
    detailedAnswer: "Sampling Methods:\n1. `SYSTEM (percentage)`:\n   - Reads a random percentage of 8KB disk pages and includes all rows inside selected pages.\n   - Speed: Blazing fast (reads only a fraction of disk blocks).\n   - Skew: Clustered. If rows were inserted sequentially by date or tenant, the sample reflects local clusters.\n2. `BERNOULLI (percentage)`:\n   - Scans every page but evaluates a pseudo-random coin toss for each individual row tuple.\n   - Speed: Must read table pages, but avoids sorting.\n   - Distribution: Uniform statistical representation across the entire relation.",
    code: `-- 1. Super-fast disk block sample (1% of pages for quick data profiling)
SELECT status, count(*) 
FROM orders TABLESAMPLE SYSTEM (1)
GROUP BY status;

-- 2. Uniform random row sample (0.5% of all rows for statistical audit)
SELECT id, email, created_at 
FROM users TABLESAMPLE BERNOULLI (0.5)
LIMIT 1000;

-- 3. Repeatable sample using REPEATABLE seed
SELECT * FROM audit_logs TABLESAMPLE BERNOULLI (2) REPEATABLE (42);`,
    recallHint: "SYSTEM samples random 8KB disk blocks (fast, clustered); BERNOULLI samples individual rows uniformly (slower, accurate); replaces ORDER BY random().",
    interviewTip: "Never use `ORDER BY random() LIMIT 10` on a 10-million row table; explain that `ORDER BY random()` generates random floats and sorts the entire table, whereas `TABLESAMPLE` samples directly during scan.",
    tags: ["tablesample", "bernoulli", "system-sampling", "random-sample", "data-profiling"]
  }),

  createCard({
    idNum: 60,
    category: "Advanced PostgreSQL SQL Capabilities",
    concept: "Full-Text Search: to_tsvector, to_tsquery, GIN & ts_rank",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does PostgreSQL's native Full-Text Search (tsvector, tsquery, GIN, ts_rank) work under the hood?",
    quickAnswer: "PostgreSQL Full-Text Search converts text into a sorted list of normalized lexemes (stems) with token positions using `to_tsvector()`. Search queries are converted into boolean search expressions using `to_tsquery()` (supporting `&`, `|`, `!`, and `<->` phrase proximity). A GIN index on the `tsvector` column provides sub-millisecond search across millions of documents without needing Elasticsearch.",
    detailedAnswer: "FTS Component Architecture:\n1. Dictionaries & Stemming: Removes stopwords ('the', 'and') and reduces words to their root stem ('running' -> 'run').\n2. `to_tsvector('english', text)`: Generates lexeme array with word positions: `'run':1, 'fast':2`.\n3. `to_tsquery('english', 'search & terms')`: Boolean query tree. Phrase search `<->` matches consecutive words: `'postgresql' <-> 'database'`.\n4. `ts_rank(vector, query)`: Scores documents by lexeme frequency and proximity.\n5. `ts_headline()`: Generates highlighted search snippet with `<b>` tags.",
    code: `-- Setup generated tsvector column with GIN index
ALTER TABLE articles 
ADD COLUMN search_vector tsvector 
GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') || 
    setweight(to_tsvector('english', coalesce(body, '')), 'B')
) STORED;

CREATE INDEX idx_articles_fts ON articles USING gin (search_vector);

-- Search query with ranking and snippet highlighting
SELECT 
    title, 
    ts_rank(search_vector, query) AS relevance,
    ts_headline('english', body, query, 'StartSel=<b>, StopSel=</b>') AS snippet
FROM articles, 
     to_tsquery('english', 'postgresql & (mvcc | index)') query
WHERE search_vector @@ query
ORDER BY relevance DESC
LIMIT 10;`,
    recallHint: "to_tsvector stems text into lexemes; to_tsquery builds search tree; @@ checks match; GIN index makes it sub-millisecond.",
    interviewTip: "Mention weighting with `setweight('A')` on titles vs `'B'` on body text to give higher rank relevance to title matches.",
    tags: ["full-text-search", "tsvector", "tsquery", "gin", "ts_rank", "phrase-search"]
  })
];

module.exports = cards;
