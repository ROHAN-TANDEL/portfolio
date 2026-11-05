module.exports = [
  {
    id: "pg-ex-01",
    title: "Atomic Upsert with ON CONFLICT DO UPDATE & EXCLUDED Table",
    category: "Advanced SQL & Queries",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates an atomic, race-condition-free upsert pattern maintaining view counts and updating timestamps using the EXCLUDED pseudo-table and RETURNING clause.",
    conceptsCovered: [
      "INSERT ... ON CONFLICT",
      "EXCLUDED Pseudo-Table",
      "Atomic Counter Increment",
      "RETURNING Clause",
      "Unique Constraint Target"
    ],
    code: `-- 1. Schema with unique constraint target
CREATE TABLE page_analytics (
    page_url TEXT PRIMARY KEY,
    view_count BIGINT NOT NULL DEFAULT 1,
    last_viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Atomic upsert: If url exists, increment count and update timestamp
INSERT INTO page_analytics (page_url, view_count, last_viewed_at)
VALUES ('/blog/postgresql-internals', 1, NOW())
ON CONFLICT (page_url) 
DO UPDATE SET
    view_count = page_analytics.view_count + EXCLUDED.view_count,
    last_viewed_at = EXCLUDED.last_viewed_at
RETURNING page_url, view_count, last_viewed_at;`,
    breakdown: [
      "ON CONFLICT (page_url) targets the primary key unique index.",
      "EXCLUDED.view_count references the proposed insert row value (1), adding it atomically to the existing row's view_count.",
      "Eliminates application-level SELECT-then-INSERT race conditions under high concurrency.",
      "RETURNING yields the newly updated row state in the same network roundtrip."
    ],
    expectedOutput: `page_url                    | view_count | last_viewed_at
/blog/postgresql-internals  | 2          | 2026-11-04 11:20:00+00`
  },

  {
    id: "pg-ex-02",
    title: "Writable Common Table Expression (CTE) Data Archival Pipeline",
    category: "Advanced SQL & Queries",
    difficulty: "advanced",
    whatThisCodeCovers: "Combines a DELETE statement with an INSERT statement in a single atomic SQL transaction using a Writable CTE to archive expired session records.",
    conceptsCovered: [
      "Writable CTEs",
      "DELETE ... RETURNING",
      "Atomic Archival",
      "Audit Pipeline",
      "Single-Statement Data Migration"
    ],
    code: `-- Move expired sessions to an archive table atomically in one query
WITH deleted_sessions AS (
    DELETE FROM user_sessions
    WHERE expires_at < NOW()
    RETURNING session_id, user_id, ip_address, created_at, NOW() AS archived_at
)
INSERT INTO session_archive (session_id, user_id, ip_address, created_at, archived_at)
SELECT session_id, user_id, ip_address, created_at, archived_at
FROM deleted_sessions
RETURNING session_id, user_id, archived_at;`,
    breakdown: [
      "The CTE executes the DELETE operation and captures deleted rows via RETURNING.",
      "The outer INSERT pipes the deleted rows directly into the session_archive table.",
      "Guarantees that rows deleted from active storage are 100% saved in the archive; if anything fails, the entire transaction rolls back.",
      "Eliminates multi-step application roundtrips."
    ],
    expectedOutput: `session_id | user_id | archived_at
sess_1001  | 42      | 2026-11-04 11:20:00+00
sess_1002  | 89      | 2026-11-04 11:20:00+00`
  },

  {
    id: "pg-ex-03",
    title: "Top-N Per Category Query using Indexed LATERAL Join",
    category: "Advanced SQL & Queries",
    difficulty: "advanced",
    whatThisCodeCovers: "Uses a CROSS JOIN LATERAL subquery backed by a composite B-Tree index to fetch the top 2 highest-value orders for every active customer with maximum efficiency.",
    conceptsCovered: [
      "CROSS JOIN LATERAL",
      "Top-N Per Group",
      "Composite Index Seek",
      "Subquery Parameter Passing",
      "Foreach SQL Evaluation"
    ],
    code: `-- Composite index to make the lateral subquery an instant index seek
CREATE INDEX idx_orders_cust_amt ON orders (customer_id, amount DESC);

-- Fetch top 2 orders per active customer
SELECT 
    c.id AS customer_id, 
    c.company_name, 
    top_orders.id AS order_id, 
    top_orders.amount, 
    top_orders.created_at
FROM customers c
CROSS JOIN LATERAL (
    SELECT o.id, o.amount, o.created_at
    FROM orders o
    WHERE o.customer_id = c.id
    ORDER BY o.amount DESC
    LIMIT 2
) AS top_orders
WHERE c.is_active = true;`,
    breakdown: [
      "LATERAL allows the subquery to reference c.id from the outer customers table.",
      "Because the subquery has ORDER BY amount DESC LIMIT 2 matching idx_orders_cust_amt, Postgres only visits 2 index leaf entries per customer.",
      "Vastly out-performs window functions (ROW_NUMBER) on large datasets because it never sorts or scans the full orders table."
    ],
    expectedOutput: `customer_id | company_name | order_id | amount  | created_at
10          | Acme Corp    | 9801     | 4500.00 | 2026-10-15 08:30:00+00
10          | Acme Corp    | 9750     | 3200.00 | 2026-09-12 14:15:00+00
11          | Globex       | 9912     | 8900.00 | 2026-11-01 10:00:00+00`
  },

  {
    id: "pg-ex-04",
    title: "Latest Status per Entity using DISTINCT ON (...) Deduplication",
    category: "Advanced SQL & Queries",
    difficulty: "intermediate",
    whatThisCodeCovers: "Employs PostgreSQL-specific DISTINCT ON (...) to fetch the single most recent tracking status update for every shipping shipment in a single pass.",
    conceptsCovered: [
      "DISTINCT ON (...)",
      "ORDER BY Synchronization",
      "Latest State Extraction",
      "Deduplication",
      "Single-Pass Grouping"
    ],
    code: `-- Fetch the latest tracking milestone for each parcel
SELECT DISTINCT ON (parcel_id) 
    parcel_id, 
    status, 
    location, 
    updated_at
FROM shipment_tracking_events
ORDER BY parcel_id, updated_at DESC;`,
    breakdown: [
      "DISTINCT ON (parcel_id) tells PostgreSQL to output only the first row encountered for each distinct parcel_id.",
      "The ORDER BY clause begins with parcel_id, updated_at DESC, ensuring the newest event is always first.",
      "Avoids verbose subqueries with MAX(updated_at) or ROW_NUMBER() window partitions."
    ],
    expectedOutput: `parcel_id | status     | location | updated_at
P-101     | DELIVERED  | Seattle  | 2026-11-04 09:30:00+00
P-102     | IN_TRANSIT | Chicago  | 2026-11-04 08:15:00+00`
  },

  {
    id: "pg-ex-05",
    title: "Dynamic KPI Pivot Dashboard with FILTER (WHERE ...)",
    category: "Advanced SQL & Queries",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs an executive dashboard pivot summary using aggregate FILTER clauses to calculate status breakdowns in a single sequential table pass.",
    conceptsCovered: [
      "FILTER (WHERE ...)",
      "Selective Aggregates",
      "Single-Pass Pivot",
      "KPI Dashboards",
      "Eliminating CASE WHEN"
    ],
    code: `-- Executive KPI summary by month
SELECT 
    DATE_TRUNC('month', order_date)::DATE AS sales_month,
    COUNT(*) AS total_orders,
    COUNT(*) FILTER (WHERE status = 'PAID') AS successful_orders,
    COUNT(*) FILTER (WHERE status = 'REFUNDED') AS refunded_orders,
    SUM(amount) FILTER (WHERE status = 'PAID') AS gross_revenue,
    ROUND(100.0 * COUNT(*) FILTER (WHERE status = 'PAID') / NULLIF(COUNT(*), 0), 2) AS conversion_rate_pct
FROM sales_orders
GROUP BY DATE_TRUNC('month', order_date)
ORDER BY sales_month DESC;`,
    breakdown: [
      "FILTER (WHERE status = 'PAID') evaluates only matching rows directly inside the aggregate calculation.",
      "Replaces awkward SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END) syntax.",
      "Calculates gross revenue, counts, and conversion rate in a single scan of sales_orders."
    ],
    expectedOutput: `sales_month | total_orders | successful_orders | refunded_orders | gross_revenue | conversion_rate_pct
2026-11-01  | 1500         | 1420              | 35              | 142500.00     | 94.67
2026-10-01  | 1400         | 1310              | 40              | 131000.00     | 93.57`
  },

  {
    id: "pg-ex-06",
    title: "Hierarchical Org-Chart Traversal with Depth & Breadcrumb Paths",
    category: "Advanced SQL & Queries",
    difficulty: "advanced",
    whatThisCodeCovers: "Traverses a multi-tier management reporting hierarchy using WITH RECURSIVE, calculating organization depth, reporting chains, and formatted breadcrumb trees.",
    conceptsCovered: [
      "WITH RECURSIVE",
      "Anchor vs Recursive Term",
      "Hierarchical Trees",
      "Breadcrumb String Concatenation",
      "Depth Tracking"
    ],
    code: `-- Recursive CTE to build employee management hierarchy
WITH RECURSIVE org_hierarchy AS (
    -- 1. Anchor: Top-level CEO (manager_id IS NULL)
    SELECT 
        employee_id, 
        name, 
        manager_id, 
        1 AS level, 
        name::TEXT AS management_chain,
        ARRAY[employee_id] AS hierarchy_path
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- 2. Recursive Member: Direct reports of previous level
    SELECT 
        e.employee_id, 
        e.name, 
        e.manager_id, 
        o.level + 1, 
        o.management_chain || ' -> ' || e.name,
        o.hierarchy_path || e.employee_id
    FROM employees e
    JOIN org_hierarchy o ON e.manager_id = o.employee_id
)
SELECT level, name, management_chain
FROM org_hierarchy
ORDER BY hierarchy_path;`,
    breakdown: [
      "Anchor query initializes the working table with root executives where manager_id IS NULL.",
      "Recursive query joins employees against org_hierarchy using manager_id = employee_id.",
      "ARRAY[employee_id] provides hierarchical sorting so direct reports appear directly beneath their manager.",
      "Terminates automatically when no employees report to the lowest level."
    ],
    expectedOutput: `level | name       | management_chain
1     | Sarah CEO  | Sarah CEO
2     | Bob VP Eng | Sarah CEO -> Bob VP Eng
3     | Carol Dev  | Sarah CEO -> Bob VP Eng -> Carol Dev`
  },

  {
    id: "pg-ex-07",
    title: "Cycle-Protected Directed Graph Path Traversal",
    category: "Advanced SQL & Queries",
    difficulty: "advanced",
    whatThisCodeCovers: "Navigates complex directed cyclic graphs (e.g. social networks, supply chain dependencies) using array visited-checks and PostgreSQL 14+ CYCLE clause.",
    conceptsCovered: [
      "Directed Graphs",
      "Cycle Detection",
      "Infinite Loop Prevention",
      "ARRAY Visited Tracking",
      "CYCLE Clause (PG 14+)"
    ],
    code: `-- Find all transitive dependencies while stopping cycles
WITH RECURSIVE component_deps AS (
    -- Anchor: root component
    SELECT 
        assembly_id, 
        part_id, 
        1 AS depth, 
        ARRAY[assembly_id] AS visited_ids,
        false AS is_cycle
    FROM bill_of_materials
    WHERE assembly_id = 'ENGINE-01'

    UNION ALL

    -- Recursive: sub-components
    SELECT 
        b.assembly_id, 
        b.part_id, 
        cd.depth + 1, 
        cd.visited_ids || b.assembly_id,
        b.part_id = ANY(cd.visited_ids)
    FROM bill_of_materials b
    JOIN component_deps cd ON b.assembly_id = cd.part_id
    WHERE NOT (b.assembly_id = ANY(cd.visited_ids)) -- Stop infinite cycles!
)
SELECT depth, assembly_id, part_id, is_cycle FROM component_deps;`,
    breakdown: [
      "Maintains visited_ids array across recursive iterations.",
      "The WHERE condition NOT (b.assembly_id = ANY(cd.visited_ids)) halts recursive traversal before entering an infinite loop.",
      "Safeguards against corrupted data structures or circular dependencies in manufacturing BOMs."
    ],
    expectedOutput: `depth | assembly_id | part_id    | is_cycle
1     | ENGINE-01   | PISTON-01  | f
2     | PISTON-01   | RING-02    | f`
  },

  {
    id: "pg-ex-08",
    title: "Time-Series Moving Average with ROWS vs RANGE Framing",
    category: "Advanced SQL & Queries",
    difficulty: "advanced",
    whatThisCodeCovers: "Calculates physical 3-row moving averages and time-interval 7-day rolling revenue using window function frames (ROWS vs RANGE).",
    conceptsCovered: [
      "Window Frames",
      "ROWS BETWEEN",
      "RANGE BETWEEN INTERVAL",
      "Moving Averages",
      "Time-Series Analytics"
    ],
    code: `-- Compare physical row window vs time-based interval window
SELECT 
    sold_at, 
    daily_revenue,
    -- 1. Physical 3-day moving average (strictly 3 preceding rows)
    AVG(daily_revenue) OVER (
        ORDER BY sold_at 
        ROWS BETWEEN 2 PRECEDING AND CURRENT ROW
    ) AS physical_3_day_avg,
    -- 2. Time-based 7-day rolling sum (handles gaps/missing days gracefully)
    SUM(daily_revenue) OVER (
        ORDER BY sold_at 
        RANGE BETWEEN INTERVAL '7 days' PRECEDING AND CURRENT ROW
    ) AS rolling_7_day_revenue
FROM revenue_history
ORDER BY sold_at DESC;`,
    breakdown: [
      "ROWS counts physical tuple offsets; if days are skipped, it still takes 3 rows.",
      "RANGE BETWEEN INTERVAL evaluates timestamp values directly; if weekends are skipped, it sums only the actual past 7 calendar days.",
      "Provides robust statistical calculations for financial analytics."
    ],
    expectedOutput: `sold_at    | daily_revenue | physical_3_day_avg | rolling_7_day_revenue
2026-11-04 | 12000.00      | 11500.00           | 78000.00
2026-11-03 | 11000.00      | 11000.00           | 66000.00`
  },

  {
    id: "pg-ex-09",
    title: "Multi-Dimensional Summary Aggregation with ROLLUP and GROUPING()",
    category: "Advanced SQL & Queries",
    difficulty: "intermediate",
    whatThisCodeCovers: "Generates hierarchical subtotals and grand totals in a single database query using ROLLUP and labels summary rows with GROUPING().",
    conceptsCovered: [
      "ROLLUP",
      "GROUPING() Function",
      "Subtotals & Grand Totals",
      "OLAP Aggregations",
      "Single-Pass Reporting"
    ],
    code: `-- Multi-level regional sales summary
SELECT 
    CASE WHEN GROUPING(continent) = 1 THEN 'Global Total' ELSE continent END AS continent,
    CASE WHEN GROUPING(country) = 1 THEN 'Continent Total' ELSE country END AS country,
    SUM(sales_amount) AS total_sales
FROM geographic_sales
GROUP BY ROLLUP (continent, country)
ORDER BY continent, country;`,
    breakdown: [
      "ROLLUP (continent, country) computes subtotals for (continent, country), (continent), and grand total ().",
      "GROUPING(col) returns 1 when the column is aggregated into a subtotal, allowing clean conditional labels.",
      "Eliminates 3 separate queries combined with UNION ALL."
    ],
    expectedOutput: `continent    | country         | total_sales
Europe       | Germany         | 50000.00
Europe       | Continent Total | 50000.00
Global Total | Continent Total | 50000.00`
  },

  {
    id: "pg-ex-10",
    title: "Table Synchronization with PostgreSQL 15+ MERGE Statement",
    category: "Advanced SQL & Queries",
    difficulty: "advanced",
    whatThisCodeCovers: "Synchronizes a primary customer table with an external incoming staging batch using MERGE to handle matched updates, conditional deletions, and new insertions.",
    conceptsCovered: [
      "MERGE INTO ... USING",
      "WHEN MATCHED THEN UPDATE",
      "WHEN MATCHED THEN DELETE",
      "WHEN NOT MATCHED THEN INSERT",
      "PostgreSQL 15+"
    ],
    code: `-- Synchronize accounts table from external incoming feed
MERGE INTO customer_accounts target
USING staging_account_updates source
ON target.account_id = source.account_id
-- 1. If closed in source, delete from target
WHEN MATCHED AND source.status = 'CLOSED' THEN
    DELETE
-- 2. If balance changed, update
WHEN MATCHED THEN
    UPDATE SET 
        balance = source.balance, 
        updated_at = NOW()
-- 3. If new account, insert
WHEN NOT MATCHED THEN
    INSERT (account_id, balance, status, created_at)
    VALUES (source.account_id, source.balance, source.status, NOW());`,
    breakdown: [
      "MERGE joins target with source on account_id.",
      "Handles updates, deletes, and inserts conditionally in one atomic statement.",
      "Standard ANSI SQL syntax added in PostgreSQL 15 for batch ETL pipelines."
    ],
    expectedOutput: `MERGE 150 (Total rows inserted, updated, or deleted)`
  },

  {
    id: "pg-ex-11",
    title: "Zero-Downtime Data Profiling with TABLESAMPLE BERNOULLI",
    category: "Advanced SQL & Queries",
    difficulty: "intermediate",
    whatThisCodeCovers: "Samples 1% of a 50-million row table uniformly using TABLESAMPLE BERNOULLI for instant statistical data profiling without sorting or memory exhaustion.",
    conceptsCovered: [
      "TABLESAMPLE BERNOULLI",
      "Statistical Profiling",
      "Avoiding ORDER BY random()",
      "Fast Sample Execution",
      "REPEATABLE Seed"
    ],
    code: `-- Uniform random 1% sample of users for statistical profiling
SELECT 
    verification_status, 
    COUNT(*) AS sample_count,
    ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 2) AS sample_pct
FROM user_identities TABLESAMPLE BERNOULLI (1.0) REPEATABLE (123)
GROUP BY verification_status;`,
    breakdown: [
      "TABLESAMPLE BERNOULLI (1.0) samples roughly 1% of rows randomly across all table pages.",
      "REPEATABLE (123) guarantees identical sample rows for consistent test verification.",
      "Executes in 100ms on a 50GB table instead of spending 5 minutes sorting by random()."
    ],
    expectedOutput: `verification_status | sample_count | sample_pct
VERIFIED            | 42000        | 84.00
PENDING             | 8000         | 16.00`
  }
];
