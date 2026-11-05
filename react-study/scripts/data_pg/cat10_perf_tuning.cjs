const { createCard } = require("../pg_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 109,
    category: "Query Optimization, EXPLAIN & Performance Tuning",
    concept: "Anatomy of EXPLAIN (ANALYZE, BUFFERS, SETTINGS, WAL)",
    priority: "must-know",
    difficulty: "must-know",
    question: "What does EXPLAIN (ANALYZE, BUFFERS, SETTINGS, WAL) reveal, and why is BUFFERS critical for performance analysis?",
    quickAnswer: "`EXPLAIN` displays the query planner's estimated cost and execution path. Adding `ANALYZE` actually runs the query and displays real execution times and exact row counts. `BUFFERS` is the most critical flag in PostgreSQL performance tuning: it reveals cache hits (`shared hit`), kernel reads (`shared read`), and dirty pages written (`shared dirtied`), proving whether a query was served entirely from RAM or throttled by physical disk I/O.",
    detailedAnswer: "Flag Breakdown:\n1. `ANALYZE`: Executes the query. Shows actual time in ms and row count vs estimated rows.\n2. `BUFFERS`: Measures I/O in 8KB page units:\n   - `shared hit`: 8KB pages read directly from RAM (`shared_buffers`).\n   - `shared read`: 8KB pages read from disk (or OS page cache).\n   - `shared dirtied`: Pages modified by the query.\n   - `temp read / written`: Pages spilled to disk due to insufficient `work_mem`.\n3. `WAL` (PostgreSQL 13+): Shows number of WAL records and bytes generated.\n4. `SETTINGS`: Lists any non-default configuration parameters affecting the plan.",
    code: `-- The gold standard production query diagnostic command
EXPLAIN (ANALYZE, BUFFERS, SETTINGS, WAL)
SELECT c.name, COUNT(o.id)
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.created_at >= '2026-01-01'
GROUP BY c.name
ORDER BY COUNT(o.id) DESC
LIMIT 10;

-- Look for:
-- "Buffers: shared hit=4210 read=12" -> Fast RAM query
-- "Buffers: shared read=85430"      -> Disk-bound bottleneck!`,
    recallHint: "EXPLAIN ANALYZE actually runs the query; BUFFERS reveals RAM hits vs disk reads; critical for proving I/O bottlenecks.",
    interviewTip: "Never tune a PostgreSQL query using execution time alone (which varies with cache warming). Always analyze `Buffers: shared hit vs shared read`.",
    tags: ["explain-analyze", "buffers", "query-tuning", "io-bottleneck", "wal-stats"]
  }),

  createCard({
    idNum: 110,
    category: "Query Optimization, EXPLAIN & Performance Tuning",
    concept: "Scan Types Comparison: Seq Scan vs Index Scan vs Index-Only Scan vs Bitmap Index Scan",
    priority: "must-know",
    difficulty: "must-know",
    question: "What are the four primary table scan methods in PostgreSQL, and how does the optimizer choose between them?",
    quickAnswer: "PostgreSQL chooses between: 1) `Seq Scan` (reads all 8KB pages sequentially; fastest when selecting > 10-20% of the table); 2) `Index Scan` (traverses B-Tree, fetches `ctid`, and reads corresponding heap tuple; optimal for fetching 1-100 rows); 3) `Index-Only Scan` (answers query directly from index leaf pages without reading heap, if Visibility Map is clean); and 4) `Bitmap Index Scan` (scans index to build an in-memory bitmask of matching disk pages, then visits heap pages in physical sequential order).",
    detailedAnswer: "Scan Mechanics Matrix:\n1. `Index Scan`: Random disk I/O. If fetching 50,000 rows, random seeking destroys performance.\n2. `Bitmap Index Scan` + `Bitmap Heap Scan`:\n   - Phase 1: Reads index and populates a bitmap of physical block numbers.\n   - Phase 2: Sorts physical block addresses and reads heap pages sequentially. Converts random I/O into sequential I/O.\n   - Combining Indexes: Can perform bitmap `AND` / `OR` on two separate indexes (`BitmapAnd`, `BitmapOr`) before touching the table.\n3. `Seq Scan`: Faster than index scans when fetching a large fraction of table rows because sequential disk throughput is 5-10x faster than random reads.",
    code: `-- EXPLAIN examples of different scans

-- 1. Index-Only Scan (0 heap fetches if vacuumed)
EXPLAIN (ANALYZE, BUFFERS) 
SELECT id FROM users WHERE email = 'test@example.com';

-- 2. Bitmap Index Scan (matches thousands of rows, converts random to sequential I/O)
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM orders WHERE status = 'SHIPPED';

-- 3. BitmapAnd combining two separate single-column indexes!
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM products WHERE category_id = 5 AND price < 20.00;`,
    recallHint: "Index Scan = point lookups (random I/O); Bitmap Scan = ranges (sorts page blocks, converts to sequential I/O); Seq Scan = broad scans.",
    interviewTip: "Explain why PostgreSQL does a Seq Scan even when an index exists: if a query matches 25% of rows, reading 25% of pages via random index seeks is much slower than a single sequential sweep.",
    tags: ["seq-scan", "index-scan", "bitmap-index-scan", "index-only-scan", "query-planner"]
  }),

  createCard({
    idNum: 111,
    category: "Query Optimization, EXPLAIN & Performance Tuning",
    concept: "Join Algorithms: Nested Loop vs Hash Join vs Merge Join",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Nested Loop, Hash Join, and Merge Join work in PostgreSQL, and what are their respective sweet spots?",
    quickAnswer: "PostgreSQL implements three join algorithms: 1) `Nested Loop` (loops over outer rows and probes an inner index; fastest for small datasets or indexed point lookups); 2) `Hash Join` (builds an in-memory hash table of the smaller relation, then streams the larger table to probe it; optimal for large unsorted equality joins); and 3) `Merge Join` (requires both relations to be sorted on the join key, then walks both streams in lockstep; optimal for very large pre-sorted datasets).",
    detailedAnswer: "Join Algorithm Characteristics:\n1. `Nested Loop`:\n   - Best when outer relation is tiny (1-100 rows) and inner relation has an index on join key.\n   - Worst case: $O(M \\times N)$ if inner relation has no index.\n2. `Hash Join`:\n   - Builds hash table in `work_mem` RAM. If hash table exceeds `work_mem`, it spills into multi-batch disk partitions ('Batches: 2' in EXPLAIN).\n   - Only works for equality joins (`ON a.id = b.id`).\n3. `Merge Join`:\n   - Both tables must be sorted on join keys.\n   - Walks pointers down both streams in $O(M + N)$ linear time. Ideal when B-Tree indexes already provide pre-sorted streams.",
    code: `-- Forcing join types in test session to analyze plan differences
SET enable_hashjoin = off;
SET enable_mergejoin = off;
-- Forces Nested Loop:
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = 100;

-- Reset planner settings
RESET enable_hashjoin;
RESET enable_mergejoin;`,
    recallHint: "Nested Loop = small outer + indexed inner; Hash Join = large unsorted equality joins (RAM bounded by work_mem); Merge Join = pre-sorted streams.",
    interviewTip: "Never disable join types globally in `postgresql.conf`! `enable_hashjoin = off` is strictly a diagnostic tool for query plan testing.",
    tags: ["nested-loop", "hash-join", "merge-join", "join-algorithms", "query-planner"]
  }),

  createCard({
    idNum: 112,
    category: "Query Optimization, EXPLAIN & Performance Tuning",
    concept: "work_mem Sizing & Eliminating Disk Spills (Sort & Hash Spills)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is work_mem in PostgreSQL, and how do you detect and eliminate external disk spills in queries?",
    quickAnswer: "`work_mem` defines the maximum amount of RAM allocated per sort or hash operation within a query before PostgreSQL spills intermediate data to temporary disk files. The default is only 4MB. If an `ORDER BY`, `DISTINCT`, `GROUP BY`, or `Hash Join` needs more memory, `EXPLAIN (ANALYZE)` reports `Sort Method: external merge Disk: 15420kB`, which causes severe disk I/O latency. Sizing `work_mem` appropriately keeps operations in RAM (`Sort Method: quicksort Memory`).",
    detailedAnswer: "work_mem Sizing Mathematics:\n1. Per-Operation Allocation: `work_mem` is NOT allocated per connection; it is allocated per sort/hash node! A complex query with 4 sorts and 2 hash joins can consume $6 \\times \\text{work\\_mem}$ RAM in a single backend.\n2. Formula: $\\text{Max Memory} = \\text{max\\_connections} \\times \\text{active\\_queries} \\times \\text{work\\_mem}$. Setting `work_mem` too high globally risks OS Out-Of-Memory (OOM) killer terminating Postgres.\n3. Best Practice: Keep global `work_mem` moderate (16MB-64MB), and bump it dynamically for heavy reporting queries within specific sessions using `SET LOCAL work_mem = '256MB'`.",
    code: `-- Identify disk spill in query plan:
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM large_transactions ORDER BY transaction_date DESC;

-- If output shows:
-- "Sort Method: external merge  Disk: 48512kB"  <-- BAD (Disk spill!)

-- Fix for heavy analytical batch:
BEGIN;
SET LOCAL work_mem = '128MB';

-- Now runs in RAM:
-- "Sort Method: quicksort  Memory: 51200kB"    <-- FAST (100% in RAM)
SELECT * FROM large_transactions ORDER BY transaction_date DESC;
COMMIT;`,
    recallHint: "work_mem is allocated per sort/hash node (default 4MB); external merge Disk in EXPLAIN indicates disk spill; bump work_mem dynamically via SET LOCAL.",
    interviewTip: "Explain why setting `work_mem = 1GB` globally is dangerous: 100 concurrent queries running complex joins could consume 400GB RAM, triggering the Linux OOM killer.",
    tags: ["work_mem", "disk-spill", "external-merge", "oom-killer", "memory-tuning"]
  }),

  createCard({
    idNum: 113,
    category: "Query Optimization, EXPLAIN & Performance Tuning",
    concept: "Planner Cost Constants: random_page_cost vs seq_page_cost on SSDs",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why is the default random_page_cost = 4.0 obsolete on modern NVMe SSDs, and what should it be set to?",
    quickAnswer: "The default `random_page_cost = 4.0` was established when databases ran on mechanical spinning hard drives, where physical head movement made random seeks 4x slower than sequential reads (`seq_page_cost = 1.0`). On modern NVMe SSDs, random reads have virtually zero mechanical seek penalty. Leaving `random_page_cost = 4.0` tricks the query planner into avoiding index scans in favor of slow sequential table scans. It should be lowered to `1.1` on modern SSD / cloud NVMe storage.",
    detailedAnswer: "Cost Optimizer Mechanics:\n1. Cost Model: The planner calculates query costs based on `seq_page_cost` (baseline 1.0), `random_page_cost`, `cpu_tuple_cost` (0.01), and `cpu_index_tuple_cost` (0.005).\n2. The SSD Reality: On AWS GP3 / io2 or NVMe SSDs, random seeks are nearly as fast as sequential reads.\n3. The Impact of Lowering: Lowering `random_page_cost` to 1.1 makes the planner correctly prefer Index Scans, Bitmap Index Scans, and Nested Loops, immediately fixing dozens of slow queries that were falsely picking `Seq Scan`.",
    code: `-- Check current cost constants
SHOW random_page_cost; -- default 4.0 (legacy spinning disk default)
SHOW seq_page_cost;    -- default 1.0

-- Modern production setting for NVMe SSD / Cloud EBS (GP3, io2)
-- Apply globally in postgresql.conf or alter system:
ALTER SYSTEM SET random_page_cost = 1.1;
SELECT pg_reload_conf();

-- Or test in session:
SET random_page_cost = 1.1;`,
    recallHint: "random_page_cost = 4.0 assumes spinning disks; on NVMe SSDs set it to 1.1 to encourage the planner to use index scans.",
    interviewTip: "This is one of the quickest 5-minute performance fixes for any PostgreSQL instance on SSD storage running too many Seq Scans.",
    tags: ["random_page_cost", "seq_page_cost", "ssd-tuning", "query-planner", "cost-model"]
  }),

  createCard({
    idNum: 114,
    category: "Query Optimization, EXPLAIN & Performance Tuning",
    concept: "Statistics Engine: ANALYZE, pg_statistic, MCVs & Histograms",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the PostgreSQL statistics engine estimate query row counts, and what are MCVs and Histograms?",
    quickAnswer: "PostgreSQL's cost-based optimizer estimates row counts by consulting `pg_statistic` (viewed via `pg_stats`), populated by `ANALYZE`. It samples table pages and calculates: 1) `null_frac` (percentage of nulls); 2) `n_distinct` (estimated unique values); 3) Most Common Values (`MCVs`) and their frequencies; and 4) Histogram Bounds (dividing non-MCV data into equal-frequency buckets). If statistics are stale or sampling target is too low, the planner produces wildly incorrect row estimates.",
    detailedAnswer: "Statistics Components in `pg_stats`:\n1. `most_common_vals` & `most_common_freqs`: Tracks top frequent values (e.g. `status = 'COMPLETED'` is 80% of rows).\n2. `histogram_bounds`: For range operators (`>`, `<`, `BETWEEN`), splits values into N equal buckets.\n3. `default_statistics_target` (default 100): Governs how many MCVs and histogram buckets are collected. On skewed, high-cardinality columns, raising the target per-column (`ALTER TABLE ... ALTER COLUMN ... SET STATISTICS 500`) improves estimation accuracy dramatically.",
    code: `-- Inspect statistics collected on a column
SELECT 
    attname, 
    null_frac, 
    n_distinct, 
    most_common_vals, 
    most_common_freqs, 
    correlation
FROM pg_stats
WHERE tablename = 'orders' AND attname = 'status';

-- Increase statistics target on a critical skewed column from 100 to 500
ALTER TABLE orders ALTER COLUMN status SET STATISTICS 500;

-- Refresh statistics immediately
ANALYZE orders;`,
    recallHint: "pg_stats stores MCVs and Histogram buckets from ANALYZE; increase statistics target (default 100) on skewed columns to fix bad row estimates.",
    interviewTip: "In EXPLAIN ANALYZE, look at `rows=10 (actual rows=150000)`: a huge discrepancy between estimated and actual rows indicates stale or inadequate statistics.",
    tags: ["pg_stats", "analyze", "mcv", "histograms", "statistics-target", "cost-estimator"]
  }),

  createCard({
    idNum: 115,
    category: "Query Optimization, EXPLAIN & Performance Tuning",
    concept: "Extended Multi-Column Statistics (CREATE STATISTICS)",
    priority: "must-know",
    difficulty: "advanced",
    question: "When and why do you need Extended Statistics (CREATE STATISTICS) on correlated columns in PostgreSQL?",
    quickAnswer: "By default, PostgreSQL calculates statistics for each column independently and assumes that columns are mathematically independent. When columns are correlated (e.g. `WHERE make = 'Audi' AND model = 'A4'`, or `WHERE country = 'US' AND state = 'CA'`), multiplying their individual probabilities drastically underestimates row counts, leading the planner to choose bad Nested Loops instead of Hash Joins. `CREATE STATISTICS` collects multivariate dependencies, n-distinct, and MCVs across multiple columns.",
    detailedAnswer: "Extended Statistics Types:\n1. `dependencies` (Functional dependencies): When column A determines column B (`zip_code -> city`).\n2. `ndistinct` (Multivariate distinct values): Accurately estimates distinct combinations for `GROUP BY a, b`.\n3. `mcv` (Multivariate Most Common Values): Collects combined frequency lists for `(colA, colB)` pairs.\n4. Syntax: `CREATE STATISTICS stat_name (dependencies, mcv) ON col1, col2 FROM table`.",
    code: `-- Create extended multivariate statistics on correlated columns
CREATE STATISTICS stat_car_make_model (dependencies, mcv) 
ON make, model FROM vehicles;

-- Refresh statistics
ANALYZE vehicles;

-- Verify extended statistics in system catalog
SELECT stxname, stxkeys, stxdndistinct, stxddependencies 
FROM pg_statistic_ext
WHERE stxname = 'stat_car_make_model';`,
    recallHint: "CREATE STATISTICS collects multivariate stats on correlated columns (e.g. city + zip); prevents planner underestimating multi-column WHERE clauses.",
    interviewTip: "Use `CREATE STATISTICS` when you notice the query planner picking a slow Nested Loop on queries with multiple `AND` filters because it mistakenly assumes the filters are completely independent.",
    tags: ["create-statistics", "extended-statistics", "correlated-columns", "functional-dependencies", "query-planner"]
  }),

  createCard({
    idNum: 116,
    category: "Query Optimization, EXPLAIN & Performance Tuning",
    concept: "PgBouncer Connection Pooling Modes (Session vs Transaction vs Statement)",
    priority: "must-know",
    difficulty: "must-know",
    question: "What are the three pooling modes of PgBouncer, and why is Transaction Pooling the standard for web applications?",
    quickAnswer: "PgBouncer supports: 1) `Session Pooling` (connection is held until client disconnects; full feature compatibility, lowest multiplexing); 2) `Transaction Pooling` (server connection is returned to the pool as soon as the transaction ends with `COMMIT`/`ROLLBACK`; allows 10,000 app clients to share 50 Postgres connections); and 3) `Statement Pooling` (connection released after every single SQL statement; breaks multi-statement transactions; rarely used).",
    detailedAnswer: "Transaction Pooling Deep-Dive:\n- Why it's standard: Web requests spend 95% of time outside transactions (rendering templates, waiting for HTTP APIs). Transaction pooling frees the physical Postgres process during idle time.\n- Features BROKEN by Transaction Pooling:\n  - Session variables: `SET timezone` or `SET search_path` leak or don't persist across transactions (must use `SET LOCAL`!).\n  - Session advisory locks: `pg_advisory_lock` (must use `pg_advisory_xact_lock`!).\n  - Prepared statements: Named prepared statements break unless `max_prepared_statements` is configured in PgBouncer 1.21+.",
    code: `-- pgbouncer.ini configuration snippet
[databases]
mydb = host=127.0.0.1 port=5432 dbname=mydb pool_mode=transaction

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = scram-sha-256
max_client_conn = 5000       -- 5000 incoming app connections
default_pool_size = 50       -- multiplexed onto only 50 PostgreSQL backends!
reserve_pool_size = 5`,
    recallHint: "Session = holds connection until disconnect; Transaction = releases connection on COMMIT (standard for web APIs); requires SET LOCAL.",
    interviewTip: "When asked 'Why does my application have connection pool exhaustion with 200 users?', explain that PostgreSQL forks a process per connection, and adding PgBouncer in transaction mode multiplexes thousands of clients onto 50 backends.",
    tags: ["pgbouncer", "transaction-pooling", "connection-pooling", "concurrency", "scalability"]
  }),

  createCard({
    idNum: 117,
    category: "Query Optimization, EXPLAIN & Performance Tuning",
    concept: "Query Monitoring with pg_stat_statements & Query Fingerprinting",
    priority: "must-know",
    difficulty: "must-know",
    question: "How does pg_stat_statements track query regressions, and what metrics identify the top performance bottlenecks?",
    quickAnswer: "`pg_stat_statements` is the foundational observability extension for PostgreSQL. It hashes and normalizes SQL queries into parameterized fingerprints (`queryid`), aggregating execution statistics across all sessions. Key metrics to monitor include: `total_exec_time` (cumulative CPU/IO load), `calls` (execution frequency), `mean_exec_time` (average latency), and `shared_blks_read` (identifying queries causing disk I/O thrashing).",
    detailedAnswer: "How to Configure and Query `pg_stat_statements`:\n1. Configuration: Requires `shared_preload_libraries = 'pg_stat_statements'` in `postgresql.conf` followed by server restart.\n2. Query Normalization: `SELECT * FROM users WHERE id = 1` and `... id = 2` are grouped into the single query fingerprint `SELECT * FROM users WHERE id = $1`.\n3. Identifying Bottlenecks:\n   - Top cumulative time: `total_exec_time DESC` (identifies overall system load).\n   - Top disk thrashers: `shared_blks_read DESC` (queries missing indexes).\n   - Temporary disk spills: `temp_blks_written > 0` (queries needing more `work_mem`).",
    code: `-- Enable extension
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 5 queries by cumulative execution time (Overall System Load)
SELECT 
    round(total_exec_time::numeric, 2) AS total_time_ms,
    calls,
    round(mean_exec_time::numeric, 2) AS avg_time_ms,
    round((100.0 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) AS pct_total_load,
    shared_blks_hit,
    shared_blks_read,
    query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 5;

-- Reset stats after a major release/indexing deployment
SELECT pg_stat_statements_reset();`,
    recallHint: "pg_stat_statements groups queries by queryid fingerprint; sort by total_exec_time for system load and shared_blks_read for disk I/O hogs.",
    interviewTip: "Always mention `pg_stat_statements` as the very first tool you install when troubleshooting an underperforming PostgreSQL cluster.",
    tags: ["pg_stat_statements", "observability", "queryid", "performance-monitoring", "query-fingerprinting"]
  }),

  createCard({
    idNum: 118,
    category: "Query Optimization, EXPLAIN & Performance Tuning",
    concept: "Trigram Fuzzy Matching with pg_trgm (Accelerating LIKE '%pattern%')",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the pg_trgm extension index wildcard LIKE '%substring%' and fuzzy similarity queries in PostgreSQL?",
    quickAnswer: "Standard B-Tree indexes cannot accelerate leading wildcard searches like `LIKE '%term%'`. The `pg_trgm` extension breaks strings into trigrams (3-consecutive-character sequences) and indexes them using GIN or GiST. A GIN trigram index decomposes both the indexed text and the search pattern into trigrams and performs an inverted index intersection, accelerating substring searches, regex matches (`~`), and typo-tolerant fuzzy matching (`%` operator).",
    detailedAnswer: "pg_trgm Mechanics:\n1. Trigram Generation: The word `'cat'` produces trigrams `\"  c\"`, `\" ca\"`, `\"cat\"`, `\"at \"`.\n2. Inverted Indexing: A GIN trigram index maps each 3-character token to matching row `ctid`s.\n3. Query Acceleration: Accelerates `LIKE '%pattern%'`, `ILIKE '%pattern%'`, and regex queries `~ 'regex'`.\n4. Fuzzy Similarity: Computes similarity scores from 0.0 to 1.0 using `similarity(text1, text2)` and KNN distance `<->` for auto-complete searches.",
    code: `-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN trigram index on user names and emails
CREATE INDEX idx_users_name_trgm ON users USING gin (name gin_trgm_ops);

-- Leading wildcard query: Uses GIN Index Scan instead of Seq Scan!
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM users 
WHERE name ILIKE '%smith%';

-- Typo-tolerant fuzzy search sorted by similarity distance
SELECT name, similarity(name, 'jonathan') AS score
FROM users
WHERE name % 'jonathan' -- % operator tests similarity above pg_trgm threshold (default 0.3)
ORDER BY name <-> 'jonathan' -- Fast KNN ordering
LIMIT 5;`,
    recallHint: "pg_trgm breaks text into 3-char tokens; GIN index with gin_trgm_ops accelerates leading wildcard LIKE '%term%' and fuzzy similarity.",
    interviewTip: "When asked 'Can a relational database do fast autocomplete or substring search without Elasticsearch?', explain `pg_trgm` with GIN.",
    tags: ["pg_trgm", "trigram-index", "wildcard-search", "fuzzy-matching", "gin_trgm_ops"]
  }),

  createCard({
    idNum: 119,
    category: "Query Optimization, EXPLAIN & Performance Tuning",
    concept: "AI Vector Embeddings with pgvector (HNSW vs IVFFlat Indexing)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does pgvector store AI embeddings, and what are the architectural differences between HNSW and IVFFlat indexes?",
    quickAnswer: "`pgvector` adds native vector data types (`vector(dim)`) and distance operators (`<->` L2 distance, `<#>` negative inner product, `<=>` cosine distance) to PostgreSQL for AI embeddings. `IVFFlat` (Inverted File Flat) clusters vectors into Voronoi lists; it builds fast but requires pre-training data and has lower recall. `HNSW` (Hierarchical Navigable Small World) builds a multi-layer graph; it has higher memory usage and takes longer to build, but delivers superior search recall and sub-millisecond query latency with zero pre-training.",
    detailedAnswer: "HNSW vs IVFFlat Comparison:\n1. `IVFFlat`:\n   - Algorithm: Divides vector space into `lists` clusters using k-means.\n   - Caveat: Must only be built AFTER the table has been loaded with data; building on an empty table produces poor clusters.\n2. `HNSW` (PostgreSQL / pgvector 0.5+):\n   - Algorithm: Multi-layer graph of vectors where top layers have long-distance skips and bottom layers have dense local connections.\n   - Pros: Excellent recall (>99%); can be built on an empty table and supports real-time concurrent inserts.\n   - Parameters: `m` (max connections per layer), `ef_construction` (build quality), `hnsw.ef_search` (runtime recall/speed trade-off).",
    code: `-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Table storing 1536-dimensional OpenAI embeddings
CREATE TABLE document_embeddings (
    id BIGSERIAL PRIMARY KEY,
    document_id INT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL
);

-- Create state-of-the-art HNSW index using Cosine Distance (<=>)
CREATE INDEX idx_docs_embedding_hnsw 
ON document_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Query the 5 most semantically similar text chunks
SELECT chunk_text, embedding <=> '[0.012, -0.045, ...]'::vector AS cosine_distance
FROM document_embeddings
ORDER BY embedding <=> '[0.012, -0.045, ...]'::vector
LIMIT 5;`,
    recallHint: "pgvector stores AI embeddings; HNSW uses multi-layer graphs (best recall, high RAM); IVFFlat uses Voronoi clusters (faster build, needs pre-training).",
    interviewTip: "Highlight that `HNSW` in `pgvector` allows PostgreSQL to replace standalone vector databases (Pinecone/Milvus), unifying vector search with relational ACID metadata.",
    tags: ["pgvector", "hnsw", "ivfflat", "ai-embeddings", "vector-search", "semantic-search"]
  }),

  createCard({
    idNum: 120,
    category: "Query Optimization, EXPLAIN & Performance Tuning",
    concept: "Physical Streaming Replication, Replication Slots & Lag Monitoring",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does PostgreSQL Physical Streaming Replication work, and why are Replication Slots essential to prevent replica failure?",
    quickAnswer: "PostgreSQL Physical Streaming Replication continuously ships raw binary Write-Ahead Log (WAL) records from a Primary instance to one or more Standby replicas over a TCP streaming connection (managed by `walsender` and `walreceiver` processes). Physical Replication Slots are essential because they instruct the Primary to retain unconsumed WAL segments on disk until the replica has acknowledged receiving them, preventing replicas from failing with 'WAL segment already removed' errors.",
    detailedAnswer: "Replication Architecture & Slot Dangers:\n1. Asynchronous vs Synchronous: In asynchronous replication (`synchronous_commit = on`), primary commits without waiting for replica confirmation. In synchronous replication (`synchronous_standby_names = 'sync_node'`), primary waits for WAL flush on replica before committing.\n2. WAL Retention: Without a replication slot, if a replica disconnects for an hour, the primary's checkpointer deletes recycled WAL segments, corrupting the replica's catch-up stream.\n3. The Replication Slot Trap: If a replica dies permanently and its slot is not dropped, the Primary retains ALL generated WAL files indefinitely, filling up 100% of the primary server's disk space and causing a full database crash.\n4. Solution: Monitor `pg_replication_slots` and set `max_slot_wal_keep_size`.",
    code: `-- Monitor connected replicas and replication byte lag on Primary
SELECT 
    client_addr, 
    application_name, 
    state, 
    sync_state,
    pg_wal_lsn_diff(pg_current_wal_lsn(), write_lsn) AS write_lag_bytes,
    pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS replay_lag_bytes
FROM pg_stat_replication;

-- Check active replication slots and retain limits
SELECT 
    slot_name, 
    active, 
    wal_status,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal_bytes
FROM pg_replication_slots;

-- Drop an orphaned slot before it fills the primary disk!
-- SELECT pg_drop_replication_slot('abandoned_replica_slot');`,
    recallHint: "Streaming replication ships WAL via walsender/walreceiver; replication slots ensure WAL retention; orphaned slots can fill primary disk.",
    interviewTip: "Never deploy replication slots without configuring `max_slot_wal_keep_size` to cap the maximum disk space a lagging slot can retain on the primary.",
    tags: ["streaming-replication", "replication-slots", "wal-lag", "high-availability", "disaster-recovery"]
  })
];

module.exports = cards;
