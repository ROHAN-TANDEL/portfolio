const { createCard } = require("../sql_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 97,
    category: "Indexing & SARGability",
    concept: "B-Tree Index Anatomy: Root, Branch, Leaf Nodes & Traversal",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How is a B-Tree index structured physically, and how does it achieve O(log N) search performance?",
    quickAnswer: "A **B-Tree** (Balanced Tree) is a self-balancing, multi-way search tree organized into hierarchical disk pages: a **Root page** at the top, one or more levels of **Intermediate (Branch) pages** that act as routing roadmaps, and **Leaf pages** at the bottom containing sorted key values and physical row pointers. Searching traverses from root to leaf by comparing keys, requiring only $3-4$ disk page reads to find a single row among 100 million records ($O(\\log N)$ logarithmic time).",
    detailedAnswer: "B-Tree Physical Characteristics:\n1. Balanced Height: All leaf pages reside at the exact same depth from the root.\n2. High Fan-Out: Each 8KB index page can hold hundreds of keys, keeping tree depth shallow (typically 3-4 levels for gigabyte tables).\n3. Bidirectional Leaf Pointers: Leaf pages form a doubly-linked list. Once the engine locates the first matching key via binary search, range queries (`BETWEEN`, `<`, `>`) simply walk forward or backward along the leaf list without re-traversing the tree.\n4. Supported Operators: Equi-joins (`=`), ranges (`<`, `>`, `<=`, `>=`), `BETWEEN`, `IN`, and pattern prefix searches (`LIKE 'abc%'`).",
    code: `-- Standard B-Tree index creation on email
CREATE INDEX idx_users_email ON users (email);

-- B-Tree logarithmic search path:
-- 1. Reads Root page -> routes to Branch 2
-- 2. Reads Branch 2 page -> routes to Leaf 45
-- 3. Reads Leaf 45 -> finds exact pointer to table heap row!
SELECT * FROM users WHERE email = 'alex@example.com';`,
    recallHint: "B-Tree has Root -> Branch -> Leaf pages; doubly-linked leaf pages enable fast range scans; depth is 3-4 levels (O(log N)).",
    interviewTip: "Highlight that B-Tree leaf pages are doubly-linked: this enables efficient range scans (`BETWEEN 10 AND 50`) by walking sibling pages horizontally.",
    tags: ["b-tree", "index-anatomy", "logarithmic-search", "leaf-pages", "range-scans"]
  }),

  createCard({
    idNum: 98,
    category: "Indexing & SARGability",
    concept: "Clustered vs Non-Clustered (Secondary) Index Storage Architectures",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the difference between a Clustered Index and a Non-Clustered (Secondary) Index across relational database engines?",
    quickAnswer: "A **Clustered Index** dictates the physical on-disk storage order of the actual table rows; the leaf pages of a clustered index **ARE the table data itself** (there can be only ONE clustered index per table). A **Non-Clustered (Secondary) Index** is a separate auxiliary B-Tree structure storing the indexed column keys along with a pointer back to the actual row (either a physical row ID / tuple offset, or the clustered index key).",
    detailedAnswer: "Clustered vs Non-Clustered Details:\n- Clustered Index (MySQL InnoDB, SQL Server):\n  - Primary Key automatically forms the Clustered Index.\n  - Table data is physically stored in the B-Tree leaf pages.\n  - Seeking by PK fetches the entire row in a single tree traversal.\n  - Secondary indexes store the Primary Key value as their row pointer (causing a secondary clustered lookup / bookmark lookup).\n- Heap-Based Tables (PostgreSQL, Oracle by default):\n  - Tables are stored as unordered heaps.\n  - All indexes (including Primary Key) are secondary indexes pointing to physical block coordinates (`ctid` / `ROWID`).",
    code: `-- Demonstrating the conceptual difference:

-- 1. In clustered systems (MySQL InnoDB / SQL Server):
-- The table IS the index organized by customer_id!
CREATE TABLE customers (
    customer_id INT PRIMARY KEY, -- Clustered Index: data pages ordered by customer_id
    name VARCHAR(100),
    city VARCHAR(50)
);

-- 2. Secondary Non-Clustered Index:
CREATE INDEX idx_customers_city ON customers (city);
-- In InnoDB: Leaf contains (city, customer_id).
-- Query: SELECT name FROM customers WHERE city = 'Chicago';
-- Step 1: Traverses idx_customers_city to find city = 'Chicago' -> gets customer_id.
-- Step 2: Traverses Clustered Index on customer_id to fetch 'name' (Bookmark Lookup).`,
    recallHint: "Clustered index stores table data directly in leaf pages (only 1 per table); Non-clustered index stores keys + row pointers.",
    interviewTip: "Be ready to explain how PostgreSQL differs from MySQL InnoDB: Postgres uses unordered heap tables with pointers (`ctid`), while InnoDB organizes tables as clustered B-Trees on the primary key.",
    tags: ["clustered-index", "non-clustered-index", "secondary-index", "bookmark-lookup", "storage-architectures"]
  }),

  createCard({
    idNum: 99,
    category: "Indexing & SARGability",
    concept: "Composite Multi-Column Indexes & The Leftmost Prefix Rule",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is the Leftmost Prefix Rule in composite multi-column indexes, and what is the optimal column ordering strategy?",
    quickAnswer: "A composite B-Tree index on `(A, B, C)` sorts data first by `A`, then by `B` within ties of `A`, and finally by `C` within ties of `B`. According to the **Leftmost Prefix Rule**, the index can accelerate queries filtering on `(A)`, `(A, B)`, or `(A, B, C)`, but **CANNOT be used directly** for queries filtering strictly on `(B)` or `(C)` because the index is not sorted by those columns globally. The optimal column ordering rule is: **Equality columns first, Range columns second**.",
    detailedAnswer: "The Leftmost Prefix Hierarchy:\n- Index on `(country, state, city)`:\n  - `WHERE country = 'US'` $\\to$ Uses Index (Prefix match).\n  - `WHERE country = 'US' AND state = 'CA'` $\\to$ Uses Index.\n  - `WHERE country = 'US' AND state = 'CA' AND city = 'SF'` $\\to$ Uses Index.\n  - `WHERE state = 'CA'` $\\to$ CANNOT use index seek (Violates leftmost prefix!).\n- Equality Before Range Rule: If a query filters on `WHERE tenant_id = 5 AND created_at > '2026-01-01'`, the index MUST be `(tenant_id, created_at)`. If you put `created_at` first, the B-Tree stops scanning after the range boundary, preventing index seeks on `tenant_id`.",
    code: `-- Optimal Composite Index Definition
-- Rule: Equality column (tenant_id) FIRST, Range column (order_date) SECOND!
CREATE INDEX idx_orders_tenant_date ON orders (tenant_id, order_date);

-- 1. Uses the full composite index seek:
SELECT * FROM orders 
WHERE tenant_id = 42 
  AND order_date >= '2026-01-01';

-- 2. Uses index prefix (tenant_id only):
SELECT * FROM orders WHERE tenant_id = 42;

-- 3. DOES NOT USE INDEX SEEK (Missing leading column tenant_id):
SELECT * FROM orders WHERE order_date >= '2026-01-01';`,
    recallHint: "Composite index requires leftmost columns (A, then B, then C); put equality columns first, range columns last.",
    interviewTip: "Remember the golden rule of composite indexes: 'Equality columns first, Range columns last'. If you put a range column first, subsequent columns cannot participate in B-Tree seeks.",
    tags: ["composite-index", "leftmost-prefix", "column-ordering", "b-tree-rules", "query-optimization"]
  }),

  createCard({
    idNum: 100,
    category: "Indexing & SARGability",
    concept: "Query SARGability Defined (Search Argument Able)",
    priority: "must-know",
    difficulty: "must-know",
    question: "What does SARGable mean in SQL query tuning, and how does writing non-SARGable predicates degrade database performance?",
    quickAnswer: "**SARGable** stands for **Search Argument Able**. A query predicate is SARGable if the database query engine can utilize a B-Tree index to perform a direct, fast **Index Seek** rather than scanning the entire table or entire index. When a predicate is non-SARGable, the query engine cannot determine the range boundaries of the B-Tree and is forced to perform an expensive **Full Table Scan** ($O(N)$), causing severe CPU and disk I/O bottlenecks.",
    detailedAnswer: "SARGable vs Non-SARGable Predicates:\n- SARGable Operators: `=`, `<`, `>`, `<=`, `>=`, `BETWEEN`, `IN`, and trailing wildcards `LIKE 'prefix%'`.\n- Non-SARGable Operators: Functions applied to columns (`YEAR(date) = 2026`), arithmetic on columns (`salary * 12 > 100000`), leading wildcards (`LIKE '%term'`), and inequality comparisons (`!=`, `<>`).\n- The Mathematical Core: A predicate is SARGable if the indexed column is isolated cleanly on one side of the operator: `indexed_column = expression`.",
    code: `-- NON-SARGABLE (Column is modified by arithmetic -> Forces Full Table Scan!)
-- SELECT * FROM orders WHERE amount + 10 > 100;

-- SARGABLE EQUIVALENT (Isolates column cleanly on the left -> Uses Index Seek!)
SELECT * FROM orders WHERE amount > 90;

-- NON-SARGABLE (Leading wildcard -> Forces Full Table Scan!)
-- SELECT * FROM users WHERE email LIKE '%@gmail.com';

-- SARGABLE (Trailing wildcard -> Uses B-Tree Range Seek!)
SELECT * FROM users WHERE email LIKE 'alex%';`,
    recallHint: "SARGable = Search Argument Able; allows B-Tree index seek; keep indexed column isolated on one side with no functions/math.",
    interviewTip: "Explain that SARGability is about keeping the indexed column pure: never perform math or function transformations on the column side of the comparison.",
    tags: ["sargable", "sargability", "index-seek", "table-scan", "query-tuning"]
  }),

  createCard({
    idNum: 101,
    category: "Indexing & SARGability",
    concept: "SARGability Anti-Pattern: Function Calls on Indexed Columns",
    priority: "must-know",
    difficulty: "must-know",
    question: "Why does wrapping an indexed column in a function disable B-Tree index seeks, and how do you rewrite date queries for SARGability?",
    quickAnswer: "Wrapping an indexed column in a function (e.g. `WHERE YEAR(order_date) = 2026` or `WHERE DATE(created_at) = '2026-01-01'`) disables B-Tree index seeks because the B-Tree stores raw timestamps, not the output of the function. To evaluate the predicate, the engine must execute the function for **every single row in the table**, converting a 1ms index seek into a full table scan. The SARGable solution rewrites the predicate into an explicit range boundary: `WHERE order_date >= '2026-01-01' AND order_date < '2027-01-01'`.",
    detailedAnswer: "Common Function Anti-Patterns & SARGable Rewrites:\n1. Year Extraction:\n   - Bad: `WHERE YEAR(created_at) = 2026`\n   - SARGable: `WHERE created_at >= '2026-01-01' AND created_at < '2027-01-01'`\n2. Date Truncation / Date Casting:\n   - Bad: `WHERE CAST(created_at AS DATE) = '2026-05-01'`\n   - SARGable: `WHERE created_at >= '2026-05-01 00:00:00' AND created_at < '2026-05-02 00:00:00'`\n3. String Substrings:\n   - Bad: `WHERE SUBSTRING(phone, 1, 3) = '555'`\n   - SARGable: `WHERE phone LIKE '555%'`",
    code: `-- 1. NON-SARGABLE: Functions on column force full table scan across 10M rows!
-- SELECT * FROM orders WHERE EXTRACT(YEAR FROM order_date) = 2026;

-- 2. SARGABLE: Range boundaries permit B-Tree Index Range Seek!
SELECT * FROM orders 
WHERE order_date >= '2026-01-01 00:00:00' 
  AND order_date < '2027-01-01 00:00:00';

-- 3. String Truncation Rewrite:
-- Bad: SELECT * FROM users WHERE LEFT(username, 4) = 'john';
-- SARGable:
SELECT * FROM users WHERE username LIKE 'john%';`,
    recallHint: "Never wrap indexed columns in functions (YEAR, DATE, SUBSTRING); rewrite as range bounds (>= start AND < end) to preserve index seeks.",
    interviewTip: "Rewriting `WHERE DATE(timestamp) = '2026-01-01'` into `WHERE timestamp >= '2026-01-01' AND timestamp < '2026-01-02'` is the #1 most common SQL performance fix in production.",
    tags: ["non-sargable-functions", "date-range-rewrite", "index-seek", "predicate-tuning", "performance-anti-patterns"]
  }),

  createCard({
    idNum: 102,
    category: "Indexing & SARGability",
    concept: "SARGability Anti-Pattern: Implicit Type Coercion & Collation Mismatch",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do implicit data type coercion and collation mismatches silently destroy index usage?",
    quickAnswer: "When comparing two expressions of different data types (e.g. comparing a `VARCHAR` column to an integer literal, or comparing two columns with different string collations), SQL type precedence rules force the database engine to **implicitly convert the column with lower precedence**. This wraps the indexed column in an internal conversion function (e.g. `CAST(phone AS BIGINT) = ?`), silently destroying index seek capability and forcing a full table scan.",
    detailedAnswer: "Type Precedence & Collation Traps:\n1. String vs Integer: Integers have higher precedence than strings. If `user_code` is `VARCHAR` and you query `WHERE user_code = 12345`, the engine converts the column `CAST(user_code AS INT) = 12345`, disabling the index.\n2. Collation Conflicts: In MySQL and SQL Server, joining Table A (`latin1_swedish_ci`) with Table B (`utf8mb4_unicode_ci`) forces an on-the-fly collation translation function on the join key, disabling join indexes.\n3. Solution: Always match literal data types to the schema, and ensure consistent database collations across tables.",
    code: `-- Schema: phone_number is VARCHAR(20) with an index
CREATE TABLE users (
    id INT PRIMARY KEY,
    phone_number VARCHAR(20) NOT NULL
);
CREATE INDEX idx_users_phone ON users (phone_number);

-- SILENT PERFORMANCE TRAP: Passing integer literal forces full table scan!
-- Query Engine evaluates: WHERE CAST(phone_number AS BIGINT) = 5551234
-- SELECT * FROM users WHERE phone_number = 5551234;

-- CORRECT SARGABLE QUERY: Pass string literal matching column type!
-- Query Engine executes fast B-Tree Index Seek:
SELECT * FROM users WHERE phone_number = '5551234';`,
    recallHint: "Implicit type mismatch (e.g. VARCHAR col = integer literal) wraps column in internal CAST, disabling index seeks.",
    interviewTip: "Warn about ORMs passing numeric variables to string columns: verify that API query parameters match database column types exactly.",
    tags: ["implicit-conversion", "type-precedence", "collation-mismatch", "sargability", "silent-table-scans"]
  }),

  createCard({
    idNum: 103,
    category: "Indexing & SARGability",
    concept: "Index Selectivity & Cardinality: When the Optimizer Skips Indexes",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Index Selectivity, and why does the cost-based optimizer choose a Full Table Scan even when a valid index exists?",
    quickAnswer: "**Cardinality** is the number of distinct values in a column. **Selectivity** is the ratio of cardinality to total rows (ranging from 0.0 to 1.0). If a query matches a large percentage of rows (e.g. $> 15-20\\%$ of the table, such as filtering on `status = 'ACTIVE'`), the query optimizer intentionally **skips the index** and performs a Full Table Scan because sequential disk I/O is substantially faster than making millions of random index seek hops.",
    detailedAnswer: "The Cost Calculation:\n1. Index Seek + Bookmark Lookup: Reading 50,000 rows via an index requires 50,000 random I/O seek hops back to the table heap or clustered index.\n2. Sequential Scan: Reading the entire table sequentially reads contiguous 8KB pages into RAM in huge sequential bursts, which is 5x-10x faster per page than random disk seeks.\n3. The Tipping Point: If a predicate matches more than approximately 15% to 25% of rows, the optimizer's cost model calculates that a Sequential Scan is cheaper than random index lookups.\n4. Developer Myth: 'The index is broken because the database isn't using it.' Reality: The optimizer mathematically proved that a table scan is faster!",
    code: `-- Table with 1,000,000 rows where status is 'ACTIVE' for 850,000 rows
CREATE TABLE members (
    id INT PRIMARY KEY,
    status VARCHAR(20) NOT NULL, -- Low cardinality ('ACTIVE', 'INACTIVE')
    email VARCHAR(100) NOT NULL  -- High cardinality (Unique per row)
);
CREATE INDEX idx_members_status ON members (status);
CREATE INDEX idx_members_email ON members (email);

-- Query 1: High Selectivity (Matches 1 row out of 1,000,000)
-- OPTIMIZER CHOOSES: Index Seek via idx_members_email (Fastest!)
SELECT * FROM members WHERE email = 'alex@example.com';

-- Query 2: Low Selectivity (Matches 850,000 rows out of 1,000,000)
-- OPTIMIZER CHOOSES: Full Table Scan (Sequential Scan), completely skipping idx_members_status!
SELECT * FROM members WHERE status = 'ACTIVE';`,
    recallHint: "Selectivity = unique values / total rows; if a query matches > 15-20% of rows, optimizer chooses Full Table Scan over random index seeks.",
    interviewTip: "Explain why indexes are skipped: random disk I/O on 20% of rows is physically slower than reading the whole table sequentially in streaming disk blocks.",
    tags: ["selectivity", "cardinality", "tipping-point", "table-scan-vs-index", "cost-based-optimizer"]
  }),

  createCard({
    idNum: 104,
    category: "Indexing & SARGability",
    concept: "Covering Indexes & Index-Only Execution Paths",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a Covering Index, and how does it achieve Index-Only execution without touching the table heap?",
    quickAnswer: "A **Covering Index** is an index that contains **every single column requested by a query** (in both `SELECT`, `WHERE`, `JOIN`, and `ORDER BY` clauses). Because all required data resides directly inside the B-Tree leaf pages, the database engine resolves the query entirely from the index tree without performing a secondary lookup to the table heap (zero bookmark lookups / heap fetches), cutting disk I/O and query latency in half.",
    detailedAnswer: "Covering Index Architecture:\n1. Standard Secondary Index: Traverses B-Tree on search key $\\to$ gets row pointer $\\to$ reads physical table page (Bookmark Lookup) to fetch remaining columns.\n2. Covering Index: The B-Tree contains all columns. The table heap is never read.\n3. The `INCLUDE` Clause (SQL Server, PostgreSQL 11+): `CREATE INDEX idx ON orders (customer_id) INCLUDE (order_date, total_amount)`. The search key is `customer_id` (kept lean in branch nodes), while the payload columns are stored strictly in the leaf pages.",
    code: `-- Query selecting customer_id, order_date, and total_amount
-- 1. Standard composite covering index:
CREATE INDEX idx_orders_covering ON orders (customer_id, order_date, total_amount);

-- 2. Modern INCLUDE covering index (keeps B-Tree search keys compact):
CREATE INDEX idx_orders_include ON orders (customer_id) INCLUDE (order_date, total_amount);

-- EXPLAIN shows: "Index Only Scan" or "Index Scan (Covering)"
-- ZERO reads to the orders table heap!
SELECT customer_id, order_date, total_amount
FROM orders
WHERE customer_id = 42;`,
    recallHint: "Covering index holds all queried columns in its B-Tree; answers queries with zero table heap lookups (Index-Only Scan).",
    interviewTip: "Explain the `INCLUDE` clause: it stores non-key payload columns only in leaf nodes, keeping intermediate B-Tree routing pages small and fast.",
    tags: ["covering-index", "index-only-scan", "include-clause", "bookmark-lookup", "io-reduction"]
  }),

  createCard({
    idNum: 105,
    category: "Indexing & SARGability",
    concept: "Execution Plan Access Paths: Full Table Scan vs Index Seek vs Index Scan",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is the difference between a Full Table Scan, an Index Seek, and an Index Scan in execution plans?",
    quickAnswer: "An **Index Seek** is the fastest access path: it traverses the B-Tree from root to leaf to navigate directly to the exact matching key ($O(\\log N)$). An **Index Scan** traverses the entire index leaf list from start to finish ($O(N)$), scanning index pages. A **Full Table Scan** (or Sequential Scan) reads every physical 8KB data page of the entire table from beginning to end ($O(N)$ table heap read).",
    detailedAnswer: "Execution Access Hierarchy (Best to Worst):\n1. `Index Seek` / `Unique Index Scan`: Probes specific key in 3-4 I/O page reads. (e.g. `WHERE id = 42`).\n2. `Index Range Seek`: Finds starting key in B-Tree and scans forward until the upper bound. (e.g. `WHERE date BETWEEN '2026-01-01' AND '2026-01-05'`).\n3. `Index Scan` (Full Index Scan): Reads all leaf pages of the index. Faster than a table scan only if the index is significantly smaller in megabytes than the table.\n4. `Full Table Scan` (Seq Scan): Reads all table pages from disk. Optimal when fetching a large fraction of the table.",
    code: `-- Reading execution plans (EXPLAIN)

-- Access Path 1: Index Seek (Probes directly to matching key)
-- EXPLAIN SELECT * FROM users WHERE id = 100;
-- Plan: Index Seek / Index Scan using users_pkey (cost=0.29..8.30 rows=1)

-- Access Path 2: Index Range Seek (Traverses to start, walks leaf siblings)
-- EXPLAIN SELECT * FROM orders WHERE created_at >= '2026-01-01';
-- Plan: Index Range Scan

-- Access Path 3: Full Table Scan (Reads all heap pages sequentially)
-- EXPLAIN SELECT * FROM users WHERE unindexed_notes LIKE '%urgent%';
-- Plan: Seq Scan / Table Scan on users (cost=0.00..45000.00 rows=15000)`,
    recallHint: "Index Seek = traverses root to leaf to exact key (fastest); Index Scan = scans whole index; Table Scan = reads all table pages.",
    interviewTip: "Look for 'Index Scan' vs 'Index Seek' in execution plans: junior developers often confuse 'Index Scan' with an optimized lookup, when it actually scans the entire index.",
    tags: ["index-seek", "index-scan", "table-scan", "seq-scan", "execution-plans"]
  }),

  createCard({
    idNum: 106,
    category: "Indexing & SARGability",
    concept: "Database Query Engine Lifecycle: Parse -> Analyze -> Optimize -> Execute",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are the four architectural stages of the database query engine lifecycle when processing a SQL statement?",
    quickAnswer: "When a SQL query is submitted, the database engine executes 4 distinct pipeline stages: 1) **Parser** (checks SQL syntax and builds an Abstract Syntax Tree); 2) **Analyzer / Semantic Checker** (validates table and column names against system catalogs, checks user permissions); 3) **Query Optimizer** (evaluates alternative execution plans, estimates costs using statistics, and selects the optimal physical plan); and 4) **Executor** (runs the chosen plan, coordinating buffer pools and storage engines to return row streams).",
    detailedAnswer: "Query Pipeline Stages:\n1. Parser: Translates raw SQL text into an AST. Syntax errors (`SELEC * FROM`) fail here.\n2. Semantic Analyzer / Catalog Resolver: Verifies tables exist, resolves column types, expands `SELECT *`, applies views.\n3. Query Optimizer (The Brain): Generates candidate plans (join orders, scan types), computes CPU/IO costs using `pg_statistic` or distribution statistics, and outputs an executable physical query plan.\n4. Executor: Volcano Iterator Model (`open()`, `next()`, `close()`) streaming row batches from disk/RAM buffers.",
    code: `-- Demonstrating the compilation lifecycle:
-- Prepared Statements compile Stages 1, 2, and 3 ONCE,
-- allowing Stage 4 (Execution) to be repeated thousands of times with ZERO parsing overhead!

-- Prepare once:
PREPARE fetch_user_plan (INT) AS 
SELECT id, email, created_at FROM users WHERE id = $1;

-- Execute repeatedly (Skips Parse & Semantic Analysis):
EXECUTE fetch_user_plan (101);
EXECUTE fetch_user_plan (102);

-- Deallocate when finished:
DEALLOCATE fetch_user_plan;`,
    recallHint: "Query lifecycle: Parse (syntax) -> Analyze (catalogs/permissions) -> Optimize (cost-based plan) -> Execute (stream rows).",
    interviewTip: "Explain why Prepared Statements boost throughput: they cache the Parse, Analyze, and Optimization phases, executing Stage 4 instantly with parameter substitution.",
    tags: ["query-lifecycle", "parser", "analyzer", "query-optimizer", "prepared-statements"]
  }),

  createCard({
    idNum: 107,
    category: "Indexing & SARGability",
    concept: "The Write Penalty of Indexes: Index Maintenance on Mutations",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why does adding too many indexes degrade database performance, and what is the Write Penalty?",
    quickAnswer: "While indexes accelerate `SELECT` queries, they impose an immediate **Write Penalty** on all data modifications (`INSERT`, `UPDATE`, `DELETE`). A table with 8 indexes must update 8 separate B-Trees on every single `INSERT`. For `UPDATE` statements, modifying an indexed column forces the engine to delete the old key and insert a new key in the B-Tree, triggering B-Tree page splits, write amplification, and transaction log bloat.",
    detailedAnswer: "The Write Penalty Breakdown:\n1. Multiplied I/O: An `INSERT` into a table with 6 indexes requires 7 write operations (1 heap write + 6 index leaf writes).\n2. B-Tree Page Splits: When an index page fills, inserting a new key forces the database to allocate a new 8KB page, split existing keys 50/50, and update parent pointers, incurring synchronous disk I/O.\n3. Storage Footprint: It is common for 8 indexes on a table to consume 3x more disk space than the actual table data itself!\n4. Rule of Thumb: Index queries that matter, but aggressively prune unused indexes.",
    code: `-- Example of Write Amplification:
-- Table has 5 indexes:
-- 1 Heap write + 5 B-Tree writes = 6 operations per row!
INSERT INTO transaction_records (id, user_id, amount, status, created_at, reference_code)
VALUES (99001, 105, 450.00, 'PAID', CURRENT_TIMESTAMP, 'REF-9901');

-- Updating an un-indexed column: 1 heap update.
-- Updating 'status' (which is indexed): 1 heap update + 1 B-Tree delete + 1 B-Tree insert!
UPDATE transaction_records SET status = 'REFUNDED' WHERE id = 99001;`,
    recallHint: "Every index adds write overhead to INSERT/UPDATE/DELETE; triggers B-Tree page splits; total indexes can exceed table size in megabytes.",
    interviewTip: "State the architectural balance: 'Indexes are not free. Optimize read-heavy queries, but monitor index usage to prune unused indexes on write-heavy OLTP systems.'",
    tags: ["write-penalty", "index-maintenance", "page-splits", "write-amplification", "oltp-performance"]
  }),

  createCard({
    idNum: 108,
    category: "Indexing & SARGability",
    concept: "Index Defragmentation & Rebuilding Strategies",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why do B-Tree indexes suffer from fragmentation and bloat over time, and how do database maintenance jobs resolve it?",
    quickAnswer: "Random `INSERT`, `UPDATE`, and `DELETE` operations cause B-Tree leaf pages to split. When rows are deleted or updated, empty space remains inside split index pages. Over time, B-Tree leaf density drops from 95% down to 50%, resulting in **Index Bloat / Fragmentation**: the index consumes 2x more RAM buffers and disk space, and range scans must read twice as many pages. Periodic **Reindexing / Defragmentation** repacks B-Tree leaf pages back to 100% density.",
    detailedAnswer: "Fragmentation Mechanics & Rebuilds:\n1. Internal Fragmentation: Sparse, half-empty pages inside the B-Tree.\n2. External Fragmentation: Physical index pages on disk are out of contiguous sequential order.\n3. Rebuilding vs Reorganizing:\n   - `REBUILD` / `REINDEX`: Builds a brand-new packed B-Tree from scratch and swaps pointers.\n   - `REORGANIZE` / `COALESCE`: Merges leaf pages in-place without rebuilding the tree from scratch.\n4. Production Rule: Always use concurrent online options (e.g. `REINDEX CONCURRENTLY` or `ALTER INDEX ... REBUILD WITH (ONLINE = ON)`) to avoid locking out application writes.",
    code: `-- Rebuilding and defragmenting indexes across dialects

-- 1. PostgreSQL (Online concurrent rebuild with zero table write locks)
REINDEX INDEX CONCURRENTLY idx_orders_customer_id;

-- 2. SQL Server (Online index rebuild)
ALTER INDEX idx_orders_customer_id ON orders REBUILD WITH (ONLINE = ON);

-- 3. SQL Server (In-place defragmentation for low fragmentation < 30%)
ALTER INDEX idx_orders_customer_id ON orders REORGANIZE;

-- 4. Oracle
ALTER INDEX idx_orders_customer_id REBUILD ONLINE;`,
    recallHint: "B-Tree splits cause half-empty pages (bloat/fragmentation); REBUILD/REINDEX repacks leaf density back to 100%; always rebuild ONLINE.",
    interviewTip: "Emphasize that rebuilding indexes is not just about disk space: an unbloated index fits entirely in RAM buffer caches, drastically accelerating query performance.",
    tags: ["index-defragmentation", "index-rebuild", "b-tree-bloat", "online-reindex", "maintenance-strategy"]
  })
];

module.exports = cards;
