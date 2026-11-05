const { createCard } = require("../pg_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 25,
    category: "PostgreSQL Index Architectures",
    concept: "B-Tree Index Internals (Root, Internal Pages, Leaf Pages & Deduplication)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How is a PostgreSQL B-Tree index structured internally, and how does PostgreSQL 13+ B-Tree deduplication reduce index size?",
    quickAnswer: "PostgreSQL uses an implementation of the Lehman-Yao high-concurrency B-Tree algorithm. It consists of a Meta page, Internal (routing) pages, and Leaf pages containing index tuples and `ctid` heap pointers. Leaf pages have bidirectional sibling pointers (`high key`), allowing concurrent traversals without locking parent nodes. PostgreSQL 13+ introduced automatic B-Tree deduplication, storing repeated keys once with an array of `ctid` posting lists, reducing index size by 30-70% on low-cardinality columns.",
    detailedAnswer: "B-Tree Internals:\n1. Lehman & Yao Algorithm: Pages have right-sibling pointers. If a page splits concurrently, a query reaching the split point follows the right sibling link instead of backing up.\n2. Leaf Pages: Contain sorted key values and physical heap tuple IDs (`ctid`).\n3. Deduplication (PG 13+): When duplicate keys exist (e.g., `status = 'PENDING'`), Postgres stores the key once followed by a compact posting list of `ctid`s rather than repeating the key column bytes for every row.\n4. Supported Operators: `<`, `<=`, `=`, `>=`, `>`, `BETWEEN`, `IN`, `IS NULL`, and `LIKE 'prefix%'` (pattern prefix matching).",
    code: `-- Inspect B-Tree index details with pageinspect
CREATE EXTENSION IF NOT EXISTS pageinspect;

-- Inspect B-Tree metadata page
SELECT * FROM bt_metap('idx_users_email');

-- Inspect B-Tree stats showing fill rate and deduplication
SELECT * FROM bt_page_stats('idx_users_email', 1);

-- Force index deduplication parameter (enabled by default in PG 13+)
CREATE INDEX idx_orders_status ON orders(status) WITH (deduplicate_items = on);`,
    recallHint: "Lehman-Yao B-Tree with leaf right-links; PG13+ deduplicates duplicate keys with ctid posting lists.",
    interviewTip: "Highlight that Postgres B-Tree deduplication gives you compressed index sizes for low-cardinality columns without losing B-Tree search performance.",
    tags: ["b-tree", "deduplication", "lehman-yao", "pageinspect", "indexes"]
  }),

  createCard({
    idNum: 26,
    category: "PostgreSQL Index Architectures",
    concept: "GIN (Generalized Inverted Index) - Posting Lists & Fastupdate",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a GIN (Generalized Inverted Index), how does it handle composite values (JSONB, arrays, tsvector), and what is fastupdate?",
    quickAnswer: "GIN is an inverted index where every component element (key or word) maps to a posting list or posting tree of row IDs (`ctid`) where that element appears. It is designed for multi-value data types (JSONB, arrays, full-text search `tsvector`). Because inserting into GIN is write-intensive, PostgreSQL provides `fastupdate = on`, buffering new entries into an unindexed pending list in RAM that is asynchronously merged into the main index by autovacuum or background worker.",
    detailedAnswer: "GIN Internals:\n1. Inverted Structure: A single row containing `tags = ARRAY['docker', 'k8s', 'linux']` creates three separate entries in the GIN index. Searching for any single tag or combination (`@>`) is an instant lookup.\n2. Posting List vs Posting Tree: If an element appears in few rows, its `ctid`s fit in an inline array (Posting List). If an element appears in millions of rows, it promotes to a B-Tree structure (Posting Tree).\n3. `fastupdate`: Absorbs write amplification into a small pending list. Reads scan both the main GIN tree and the pending list. If the pending list grows too large, query latency spikes until merged (`gin_clean_pending_list()`).",
    code: `-- Create GIN index on tags array
CREATE INDEX idx_articles_tags ON articles USING gin (tags);

-- Query using array containment operator (uses GIN)
EXPLAIN ANALYZE
SELECT * FROM articles WHERE tags @> ARRAY['postgresql', 'database'];

-- Manually flush GIN pending list if fastupdate buffered too many writes
SELECT gin_clean_pending_list('idx_articles_tags');

-- For write-heavy JSONB/Array tables where consistent read latency is needed:
ALTER INDEX idx_articles_tags SET (fastupdate = off);`,
    recallHint: "GIN is an inverted index mapping elements to ctid lists; ideal for JSONB, arrays, and text; fastupdate buffers writes into a pending list.",
    interviewTip: "When asked why GIN queries occasionally experience latency spikes, explain the `fastupdate` pending list flush during user queries when the buffer fills past `gin_pending_list_limit`.",
    tags: ["gin", "inverted-index", "fastupdate", "arrays", "jsonb", "full-text-search"]
  }),

  createCard({
    idNum: 27,
    category: "PostgreSQL Index Architectures",
    concept: "GiST (Generalized Search Tree) - Geometric & Range Indexing",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a GiST (Generalized Search Tree) index, how does it differ from B-Tree, and what problem does it solve?",
    quickAnswer: "GiST is a balanced tree framework that allows developers to define custom indexing logic for arbitrary multi-dimensional and complex data types (PostGIS geometric geometries, geographic lat/long, IP network ranges `inet`, timestamps `tstzrange`, and trigrams). Unlike B-Tree which requires strict 1-dimensional sort order (`<`, `=`), GiST uses 'lossy bounding boxes' and hierarchical clustering to support overlap (`&&`), containment (`@>`), and distance (`<->`) operators.",
    detailedAnswer: "GiST Architecture:\n1. Bounding Boxes: Parent nodes contain an encompassing bounding box (or envelope) that encloses all child bounding boxes.\n2. Lossy vs Exact: GiST may return false positives at the index level, which are automatically re-checked against the table heap ('Recheck Cond').\n3. Exclusion Constraints: GiST powers `EXCLUDE USING gist`, enabling database-level enforcement of overlapping reservations or non-overlapping time ranges (impossible with standard B-Tree unique constraints).\n4. KNN (K-Nearest Neighbors): Supports `<->` operator for instant nearest-neighbor geographic distance ordering.",
    code: `-- Create GiST index on a timestamp range
CREATE TABLE room_bookings (
    room_id INT,
    during TSTZRANGE,
    EXCLUDE USING gist (room_id WITH =, during WITH &&) -- Prevents double booking!
);

-- Query using range overlap operator && (uses GiST)
SELECT * FROM room_bookings 
WHERE during && tstzrange('2026-06-01 10:00:00', '2026-06-01 12:00:00');

-- K-Nearest Neighbor query using PostGIS geometry with GiST
SELECT name, location <-> ST_MakePoint(-73.985, 40.748)::geography AS distance_meters
FROM stores
ORDER BY location <-> ST_MakePoint(-73.985, 40.748)::geography
LIMIT 5;`,
    recallHint: "GiST handles multi-dimensional data, overlaps (&&), KNN distance (<->), and powers exclusion constraints.",
    interviewTip: "Highlight that GiST is lossy and hierarchical, whereas B-Tree is exact and 1D; GiST makes overlap constraints (`EXCLUDE USING gist`) possible.",
    tags: ["gist", "geometric", "ranges", "postgis", "exclusion-constraints", "knn"]
  }),

  createCard({
    idNum: 28,
    category: "PostgreSQL Index Architectures",
    concept: "BRIN (Block Range Indexes) for Massive Time-Series Data",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a BRIN (Block Range Index), how does it achieve 99% smaller index footprints, and what are its prerequisites?",
    quickAnswer: "BRIN (Block Range Index) groups contiguous physical table disk pages (by default 128 blocks = 1MB of table heap) and stores only two values per range: the minimum and maximum values of the indexed column within that block range. For a 100GB naturally sorted table (such as append-only time-series logs, sequential IDs, or created_at timestamps), a BRIN index takes only a few megabytes compared to a 20GB B-Tree index.",
    detailedAnswer: "BRIN Architecture & Characteristics:\n1. Storage Footprint: A B-Tree stores every row value and `ctid`. BRIN stores only `[min, max]` per range of 128 pages (1024 tuples). A 100M row table index shrinks from 2.5GB to ~500KB.\n2. Prerequisite (Physical Correlation): BRIN ONLY works efficiently when physical on-disk tuple ordering correlates strongly with the column values (e.g. `pg_stats.correlation` near +1.0 or -1.0). If data is randomly shuffled across pages, BRIN must scan every block range.\n3. Automatic Summarization: As new blocks are appended, BRIN summarizes ranges in the background or during queries.",
    code: `-- Check correlation of a column before creating BRIN
SELECT attname, correlation 
FROM pg_stats 
WHERE tablename = 'iot_sensor_telemetry' AND attname = 'recorded_at';
-- Correlation should be close to 1.0 (e.g., 0.98)

-- Create BRIN index with custom range size (64 pages)
CREATE INDEX idx_sensor_time_brin 
ON iot_sensor_telemetry 
USING brin (recorded_at) WITH (pages_per_range = 64);

-- Inspect index size difference
SELECT pg_size_pretty(pg_relation_size('idx_sensor_time_brin'));`,
    recallHint: "BRIN stores min/max per 128 disk pages; takes 99% less RAM than B-Tree; requires high physical correlation (append-only/timestamps).",
    interviewTip: "Always mention checking `pg_stats.correlation`: if correlation is near 0, BRIN degrades into a full table scan, rendering it useless.",
    tags: ["brin", "block-range-index", "time-series", "big-data", "storage-efficiency"]
  }),

  createCard({
    idNum: 29,
    category: "PostgreSQL Index Architectures",
    concept: "SP-GiST (Space-Partitioned GiST) for Non-Uniform Data",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is SP-GiST (Space-Partitioned Generalized Search Tree) and when should it be preferred over B-Tree or GiST?",
    quickAnswer: "SP-GiST supports non-balanced, space-partitioning tree algorithms (such as Quadtrees, k-d trees, and Radix trees/Tries). While standard GiST uses balanced trees with overlapping bounding boxes, SP-GiST recursively partitions data space into non-overlapping subsets. It is optimal for non-uniformly distributed data, telephone area codes, IP address subnets (`inet`/`cidr`), and prefix string lookups where traditional trees suffer from high branch imbalance.",
    detailedAnswer: "SP-GiST Use Cases & Types:\n1. Radix Trees / Tries: Super fast for strings with long shared prefixes (URLs, file paths, DNS records).\n2. Quadtrees & k-d Trees: 2D spatial points where clustering is uneven (e.g. dense urban city coordinates vs sparse rural areas).\n3. Non-overlapping partitions: Unlike GiST where bounding boxes can overlap, SP-GiST partitions are strictly disjoint at each branch level, pruning entire subtrees on search.\n4. Supported Types: `point`, `box`, `polygon`, `inet`, `cidr`, `text`.",
    code: `-- Create SP-GiST index on IP address ranges
CREATE TABLE server_access_logs (
    id BIGSERIAL PRIMARY KEY,
    client_ip INET NOT NULL,
    url TEXT
);

-- SP-GiST index on INET column
CREATE INDEX idx_logs_client_ip_spgist 
ON server_access_logs 
USING spgist (client_ip);

-- Fast subnet containment search using SP-GiST
EXPLAIN ANALYZE
SELECT * FROM server_access_logs 
WHERE client_ip << inet '192.168.1.0/24';`,
    recallHint: "SP-GiST uses non-balanced space-partitioning (Tries, Quadtrees) with non-overlapping partitions; optimal for IP subnets and prefix lookups.",
    interviewTip: "Highlight that SP-GiST excels when data distribution is skewed or has long shared prefixes, outperforming B-Trees on `inet` and text tries.",
    tags: ["sp-gist", "space-partitioned", "tries", "radix-tree", "inet-indexing"]
  }),

  createCard({
    idNum: 30,
    category: "PostgreSQL Index Architectures",
    concept: "Hash Indexes in Modern PostgreSQL (WAL-Logged O(1) Equality)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Are PostgreSQL Hash Indexes production-ready, and when are they preferable to B-Tree indexes?",
    quickAnswer: "Yes, since PostgreSQL 10, Hash indexes are fully WAL-logged, crash-safe, and streamable across physical streaming replicas. A Hash index maps hashed key values directly into hash buckets for pure $O(1)$ equality (`=`) lookups. Hash indexes are smaller and faster than B-Trees when indexing very long string keys (e.g. 500-character URLs or UUIDs) where only strict equality lookups are performed.",
    detailedAnswer: "Hash Index Characteristics:\n1. History: Prior to PostgreSQL 10, Hash indexes were not logged in WAL and rebuilds were required after crashes. In PG 10+, they are 100% production-ready.\n2. Capabilities: Only supports the equality (`=`) operator. Cannot perform range scans (`<`, `>`), sorting (`ORDER BY`), uniqueness constraints, or `IS NULL` queries.\n3. Advantage over B-Tree: For long string keys (e.g. SHA-256 tokens or session IDs), B-Tree stores the long key across all intermediate branch nodes, leading to deep tree levels and large index sizes. Hash index stores only 4-byte 32-bit hash codes in bucket pages, making the index significantly smaller.",
    code: `-- Create Hash index for long token verification
CREATE TABLE api_sessions (
    session_id BIGSERIAL PRIMARY KEY,
    auth_token TEXT NOT NULL,
    user_id INT
);

-- Hash index specifically for fast equality authentication lookups
CREATE INDEX idx_sessions_auth_token_hash 
ON api_sessions 
USING hash (auth_token);

-- Uses Hash Index:
EXPLAIN ANALYZE
SELECT user_id FROM api_sessions WHERE auth_token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';`,
    recallHint: "Hash indexes are WAL-logged since PG 10; strictly O(1) equality (=) lookups; smaller than B-Tree for very long strings/tokens.",
    interviewTip: "Clarify that Hash indexes cannot enforce UNIQUE constraints or support range operators, but excel at token/UUID equality caching.",
    tags: ["hash-index", "wal-logged", "equality-lookup", "token-indexing", "o1-lookup"]
  }),

  createCard({
    idNum: 31,
    category: "PostgreSQL Index Architectures",
    concept: "Covering Indexes with INCLUDE Clause (Index-Only Scans)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the purpose of the INCLUDE clause in PostgreSQL B-Tree indexes, and how does it optimize Index-Only Scans?",
    quickAnswer: "The `INCLUDE` clause allows non-key payload columns to be stored exclusively in the leaf pages of a B-Tree index without including them in the intermediate search tree. This turns queries into pure Index-Only Scans (avoiding heap fetches) while keeping the B-Tree intermediate nodes lean and fast, and prevents the included payload columns from counting against unique constraint key limits.",
    detailedAnswer: "INCLUDE vs Multi-Column Indexes:\n1. Composite Index `(a, b)`: Both `a` and `b` are stored in root, branch, and leaf pages. Column `b` participates in index sorting and unique constraints.\n2. Covering Index `(a) INCLUDE (b)`: Column `a` is the sole search key. Column `b` is stored ONLY in the leaf pages as payload data.\n3. Unique Enforcement: `CREATE UNIQUE INDEX (email) INCLUDE (user_id, status)` enforces uniqueness strictly on `email`, yet queries selecting `SELECT user_id, status WHERE email = ?` are answered entirely from the index without reading the table heap.",
    code: `-- Unique index on email with included payload for zero-heap-fetch lookups
CREATE UNIQUE INDEX idx_users_email_covering 
ON users (email) 
INCLUDE (id, is_active, display_name);

-- This query is resolved entirely as an Index-Only Scan
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, is_active, display_name 
FROM users 
WHERE email = 'alex@example.com';`,
    recallHint: "INCLUDE stores payload columns only in B-Tree leaf pages to satisfy Index-Only Scans without bloating intermediate branch nodes.",
    interviewTip: "Explain how `INCLUDE` allows unique constraints on a single column while still covering multi-column queries.",
    tags: ["covering-index", "include-clause", "index-only-scan", "b-tree", "performance"]
  }),

  createCard({
    idNum: 32,
    category: "PostgreSQL Index Architectures",
    concept: "Partial Indexes with WHERE Clause",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do PostgreSQL Partial Indexes work, and how do they reduce index size and write amplification?",
    quickAnswer: "A Partial Index contains entries only for rows that satisfy a specified `WHERE` predicate filter. Instead of indexing millions of inactive or settled rows, you index only active rows (e.g. `WHERE status = 'PENDING'`). This reduces index storage by 90%+, drastically accelerates write throughput on non-matching rows (no index updates needed), and keeps the working index entirely in RAM buffers.",
    detailedAnswer: "Partial Index Advantages:\n1. Zero Write Amplification for Excluded Rows: When updating or inserting a row where `status = 'COMPLETED'`, the partial index is completely untouched.\n2. Cache Efficiency: Index fits into a few 8KB pages inside `shared_buffers`.\n3. Partial Unique Constraints: Enforce conditional uniqueness, such as allowing only one active subscription per user while permitting multiple expired subscriptions (`WHERE status = 'ACTIVE'`).\n4. Optimizer Matching: The query's `WHERE` clause must match or imply the index's `WHERE` predicate for the optimizer to choose it.",
    code: `-- Conditional uniqueness: only one ACTIVE subscription per user
CREATE UNIQUE INDEX idx_one_active_sub_per_user 
ON subscriptions (user_id) 
WHERE status = 'ACTIVE';

-- High-speed message queue partial index
CREATE INDEX idx_queue_pending 
ON job_queue (priority, created_at) 
WHERE status = 'QUEUED';

-- Uses Partial Index:
EXPLAIN ANALYZE
SELECT * FROM job_queue 
WHERE status = 'QUEUED' 
ORDER BY priority DESC, created_at ASC 
LIMIT 10;`,
    recallHint: "Partial indexes use a WHERE clause to index only relevant rows; shrinks index size, avoids writes on excluded rows, and enforces conditional uniqueness.",
    interviewTip: "Emphasize conditional uniqueness (e.g. one active session per user) as a classic PostgreSQL-specific interview pattern.",
    tags: ["partial-index", "where-clause", "conditional-unique", "queue-optimization", "write-throughput"]
  }),

  createCard({
    idNum: 33,
    category: "PostgreSQL Index Architectures",
    concept: "Expression and Functional Indexes",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do Expression (Functional) Indexes work in PostgreSQL and what are the IMMUTABLE function requirements?",
    quickAnswer: "An Expression Index indexes the result of an arbitrary scalar function or computation (e.g., `LOWER(email)` or `(metadata->>'user_id')`) rather than raw column values. Any function used in an expression index MUST be marked `IMMUTABLE`, guaranteeing that the function returns the exact same output for identical inputs across all sessions and time, ensuring index consistency.",
    detailedAnswer: "Expression Index Mechanics:\n1. Search Mechanics: The optimizer substitutes the expression during query planning. If an index is on `LOWER(email)`, queries with `WHERE LOWER(email) = 'user@test.com'` perform an instant B-Tree index scan instead of a sequential table scan.\n2. Immutability Rule: Functions marked `STABLE` or `VOLATILE` (e.g., `now()`, `random()`, or functions querying other tables) are strictly rejected because index entries are computed once at row write time and cannot dynamically change.\n3. Statistics: PostgreSQL automatically calculates dedicated statistics (`pg_statistic`) for expression indexes, allowing accurate cardinality estimates.",
    code: `-- Case-insensitive unique email index
CREATE UNIQUE INDEX idx_users_lower_email 
ON users (LOWER(email));

-- Date truncation expression index for analytics
CREATE INDEX idx_orders_created_month 
ON orders (DATE_TRUNC('month', created_at));

-- Custom IMMUTABLE function index example
CREATE OR REPLACE FUNCTION sanitize_phone(raw_phone TEXT) 
RETURNS TEXT IMMUTABLE LANGUAGE sql AS $$
    SELECT regexp_replace(raw_phone, '[^0-9]', '', 'g');
$$;

CREATE INDEX idx_users_clean_phone ON users (sanitize_phone(phone));`,
    recallHint: "Expression indexes index function results; functions must be marked IMMUTABLE; matches queries using the identical expression.",
    interviewTip: "Be ready to explain why `now()` or `CURRENT_TIMESTAMP` cannot be used in expression indexes: they are `STABLE`, not `IMMUTABLE`.",
    tags: ["expression-index", "functional-index", "immutable", "case-insensitive", "date-trunc"]
  }),

  createCard({
    idNum: 34,
    category: "PostgreSQL Index Architectures",
    concept: "CREATE INDEX CONCURRENTLY State Machine & Invalid Index Recovery",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does CREATE INDEX CONCURRENTLY work under the hood, why can it leave 'INVALID' indexes, and how do you recover from failures?",
    quickAnswer: "`CREATE INDEX CONCURRENTLY` (CIC) builds an index online without taking an `ACCESS EXCLUSIVE` lock that blocks table writes. It executes in three distinct phases across two transactions: Phase 1 registers the index in catalogs; Phase 2 scans the heap to build the index; Phase 3 waits for all concurrent modifying transactions to finish and validates the index. If any transaction deadlocks or crashes during CIC, the index is left in catalog state with `indisvalid = false`, consuming disk space without serving queries.",
    detailedAnswer: "CIC Internals & Failure Recovery:\n1. Lock Level: Acquires only `ShareUpdateExclusiveLock`, which permits concurrent `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.\n2. Multi-Pass Heap Scan: Takes two full table passes to catch up with concurrent writes.\n3. The 'INVALID' State: If a unique constraint violation occurs or the connection is terminated mid-build, the index remains marked `INVALID` (`indisvalid = 'f'`). It is NOT used by queries, but writes still update it, wasting CPU and disk I/O.\n4. Recovery: Must manually drop or reindex it using `REINDEX INDEX CONCURRENTLY <idx_name>` or `DROP INDEX CONCURRENTLY <idx_name>`.",
    code: `-- Online production index creation
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders (user_id);

-- Detect broken / invalid indexes in your database
SELECT 
    c.relname AS invalid_index_name,
    t.relname AS table_name,
    i.indisvalid,
    i.indisready
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_class t ON t.oid = i.indrelid
WHERE NOT i.indisvalid;

-- Clean up invalid index without locking table
REINDEX INDEX CONCURRENTLY idx_orders_user_id;`,
    recallHint: "CIC builds indexes online across 2 passes without exclusive write locks; aborted builds leave INVALID indexes that must be reindexed or dropped.",
    interviewTip: "Never run raw `CREATE INDEX` on a multi-gigabyte production table! Always explain `CONCURRENTLY` and how to monitor `pg_index.indisvalid`.",
    tags: ["create-index-concurrently", "invalid-index", "reindex", "production-deployment", "locks"]
  }),

  createCard({
    idNum: 35,
    category: "PostgreSQL Index Architectures",
    concept: "Multi-Column Composite Index Ordering & Skip Scans",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does column order matter in a multi-column PostgreSQL B-Tree index, and how does PostgreSQL emulate Index Skip Scans?",
    quickAnswer: "In a composite B-Tree index `(A, B)`, data is sorted first by `A`, then by `B` within identical values of `A`. A query filtering on `WHERE A = 1 AND B = 2` or `WHERE A = 1` uses the index efficiently. A query filtering ONLY on `WHERE B = 2` cannot perform a normal B-Tree index seek because the index is not sorted by `B` globally. Unlike Oracle or MySQL 8.0, PostgreSQL lacks native B-Tree Skip Scans, but they can be emulated using `WITH RECURSIVE`.",
    detailedAnswer: "Composite Index Rules:\n1. Leftmost Prefix Rule: Queries must filter on the leading column(s) to utilize traditional B-Tree binary search traversal.\n2. Equality Before Range: Place columns tested with equality (`=`) first, and columns tested with range operators (`>`, `<`, `BETWEEN`) last.\n3. Emulating Skip Scan: If column `A` has low cardinality (e.g. 5 tenant IDs), a query filtering only on `B` can emulate a skip scan using `WITH RECURSIVE` to probe the index once for each distinct value of `A`.",
    code: `-- Optimal column order: equality first (tenant_id), then range (created_at)
CREATE INDEX idx_events_tenant_created ON events (tenant_id, created_at);

-- Emulating Index Skip Scan using WITH RECURSIVE for distinct prefixes
WITH RECURSIVE skip_scan AS (
    (
        SELECT tenant_id, created_at, id 
        FROM events 
        ORDER BY tenant_id, created_at DESC 
        LIMIT 1
    )
    UNION ALL
    SELECT e.tenant_id, e.created_at, e.id
    FROM skip_scan s,
    LATERAL (
        SELECT tenant_id, created_at, id 
        FROM events 
        WHERE tenant_id > s.tenant_id 
        ORDER BY tenant_id, created_at DESC 
        LIMIT 1
    ) e
)
SELECT * FROM skip_scan;`,
    recallHint: "Composite index requires leftmost prefix; equality columns go first, range columns last; emulate skip scan with WITH RECURSIVE.",
    interviewTip: "Know the rule: 'Equality columns first, range columns second'. If you put `created_at` before `tenant_id`, queries filtering on `tenant_id` cannot use the range index efficiently.",
    tags: ["composite-index", "column-order", "skip-scan", "with-recursive", "query-planner"]
  }),

  createCard({
    idNum: 36,
    category: "PostgreSQL Index Architectures",
    concept: "Index Bloat Detection & Online Defragmentation (REINDEX CONCURRENTLY)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why do B-Tree indexes bloat over time even when tables are vacuumed, and how does REINDEX CONCURRENTLY rebuild them online?",
    quickAnswer: "While `VACUUM` marks dead tuples reusable in heap pages, random inserts and updates cause B-Tree leaf pages to split 50/50. If data distribution is uneven or deletions occur without subsequent insertions in that specific key range, B-Tree index pages remain half-empty indefinitely. PostgreSQL 12+ introduced `REINDEX CONCURRENTLY`, which constructs a fresh, packed index in the background, swaps the catalog pointers, and drops the bloated index with zero write downtime.",
    detailedAnswer: "Index Bloat & REINDEX CONCURRENTLY:\n1. Why B-Trees Bloat: Page splits leave 50% free space per split block. If deletes happen at the low end of a sequence, the empty B-Tree pages cannot always be merged or freed.\n2. Standard REINDEX: Takes an exclusive write lock on the table.\n3. `REINDEX CONCURRENTLY` (PostgreSQL 12+):\n   - Builds replacement index alongside the old one.\n   - Maintains writes in both indexes.\n   - Atomically swaps catalog references.\n   - Drops old bloated index with no table write lock.\n4. Bloat Monitoring: Use the `pgstatindex` function from `pageinspect` to check `leaf_fragmentation` and `avg_leaf_density`.",
    code: `-- Inspect B-Tree index bloat and density using pageinspect
CREATE EXTENSION IF NOT EXISTS pageinspect;
SELECT 
    avg_leaf_density,       -- Below 60-70% indicates heavy bloat
    leaf_fragmentation,
    root_pages,
    leaf_pages
FROM pgstatindex('idx_orders_customer_id');

-- Rebuild bloated index online without locking readers or writers
REINDEX INDEX CONCURRENTLY idx_orders_customer_id;

-- Rebuild all indexes across an entire table concurrently
REINDEX TABLE CONCURRENTLY orders;`,
    recallHint: "B-Tree splits cause half-empty pages (bloat); VACUUM cannot merge sparse B-Tree pages; use REINDEX CONCURRENTLY to repack online.",
    interviewTip: "Always mention `REINDEX CONCURRENTLY` (introduced in PG 12) as the gold standard for fixing index bloat without scheduled downtime.",
    tags: ["index-bloat", "reindex-concurrently", "pageinspect", "pgstatindex", "maintenance"]
  })
];

module.exports = cards;
