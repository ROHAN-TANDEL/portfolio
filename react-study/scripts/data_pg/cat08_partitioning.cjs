const { createCard } = require("../pg_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 85,
    category: "Declarative Table Partitioning",
    concept: "Declarative Partitioning Strategies: RANGE, LIST and HASH",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the three declarative partitioning strategies in PostgreSQL and how do they divide datasets?",
    quickAnswer: "PostgreSQL supports native declarative partitioning via: 1) `RANGE` (partitions tables by continuous non-overlapping ranges, ideal for timestamps or sequential IDs); 2) `LIST` (partitions tables by explicit discrete key values, ideal for regions, departments, or country codes); and 3) `HASH` (partitions tables by modulus and remainder of a hash function, ideal for distributing high-write loads evenly across N physical tables).",
    detailedAnswer: "Partitioning Strategies:\n1. `PARTITION BY RANGE (column)`:\n   - Syntax: `FOR VALUES FROM ('2026-01-01') TO ('2026-02-01')` (lower bound inclusive, upper exclusive).\n   - Best for: Log aggregation, time-series, audit trails, and data retention drops.\n2. `PARTITION BY LIST (column)`:\n   - Syntax: `FOR VALUES IN ('US', 'CA', 'MX')`.\n   - Best for: Geographical boundaries, multi-tenant isolation by region.\n3. `PARTITION BY HASH (column)`:\n   - Syntax: `FOR VALUES WITH (MODULUS 4, REMAINDER 0)`.\n   - Best for: Eliminating B-Tree write hotspots by spreading writes evenly across 4, 8, or 16 child tables.",
    code: `-- 1. RANGE Partitioning by Month
CREATE TABLE sensor_readings (
    device_id INT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    reading_val NUMERIC(8, 2)
) PARTITION BY RANGE (recorded_at);

-- Create individual child partitions
CREATE TABLE sensor_readings_2026_01 
PARTITION OF sensor_readings
FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00');

CREATE TABLE sensor_readings_2026_02 
PARTITION OF sensor_readings
FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');

-- 2. HASH Partitioning by Modulus
CREATE TABLE user_events (
    event_id UUID NOT NULL,
    user_id INT NOT NULL,
    payload JSONB
) PARTITION BY HASH (user_id);

CREATE TABLE user_events_p0 PARTITION OF user_events FOR VALUES WITH (MODULUS 4, REMAINDER 0);
CREATE TABLE user_events_p1 PARTITION OF user_events FOR VALUES WITH (MODULUS 4, REMAINDER 1);
CREATE TABLE user_events_p2 PARTITION OF user_events FOR VALUES WITH (MODULUS 4, REMAINDER 2);
CREATE TABLE user_events_p3 PARTITION OF user_events FOR VALUES WITH (MODULUS 4, REMAINDER 3);`,
    recallHint: "RANGE = time/sequences with [) bounds; LIST = explicit discrete values; HASH = modulus/remainder for even write spreading.",
    interviewTip: "Always mention that declarative partitioning routing is handled natively by the engine; clients insert into the root table and Postgres routes rows automatically.",
    tags: ["declarative-partitioning", "range-partitioning", "list-partitioning", "hash-partitioning", "big-data"]
  }),

  createCard({
    idNum: 86,
    category: "Declarative Table Partitioning",
    concept: "Static vs Run-Time Partition Pruning (enable_partition_pruning)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Partition Pruning in PostgreSQL, and how does run-time pruning differ from static compile-time pruning?",
    quickAnswer: "Partition Pruning is an optimization where the query engine skips scanning entire child partitions whose partition constraints contradict the query's `WHERE` clause. Static compile-time pruning happens during query planning when literal constants are provided. Run-Time partition pruning occurs during query execution when the filter value is dynamic (e.g. parameterized queries, subqueries, or joins), evaluating which partitions to scan on the fly.",
    detailedAnswer: "Pruning Engine Mechanics:\n1. Compile-Time Pruning: If query has `WHERE recorded_at >= '2026-01-01' AND recorded_at < '2026-01-15'`, the planner immediately excludes all other month partitions from the query plan.\n2. Run-Time Pruning (PostgreSQL 11+):\n   - Parameterized queries (`WHERE recorded_at = $1` in prepared statements).\n   - Subquery filters (`WHERE recorded_at = (SELECT max(date) FROM dates)`).\n   - The executor checks the parameter at runtime and skips child partitions dynamically.\n3. Setting: Governed by `enable_partition_pruning = on`.",
    code: `-- Verify partition pruning using EXPLAIN
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM sensor_readings 
WHERE recorded_at >= '2026-01-10' AND recorded_at <= '2026-01-20';

-- Output plan:
-- Append  (cost=... rows=... width=...)
--   ->  Seq Scan on sensor_readings_2026_01  <-- Scanned
-- Notice: sensor_readings_2026_02 is completely omitted (Pruned!)

-- Check parameter
SHOW enable_partition_pruning;`,
    recallHint: "Partition pruning skips unneeded partition tables; compile-time uses literals; run-time dynamically evaluates parameters and subqueries.",
    interviewTip: "Highlight that prepared statements in ORMs benefit from run-time partition pruning; earlier Postgres versions scanned every partition if parameters were used.",
    tags: ["partition-pruning", "run-time-pruning", "query-planner", "performance-optimization", "explain"]
  }),

  createCard({
    idNum: 87,
    category: "Declarative Table Partitioning",
    concept: "Default Partitions & The New Partition Routing Trap",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a DEFAULT partition in PostgreSQL, and what catastrophic trap does it cause when adding new future partitions?",
    quickAnswer: "A `DEFAULT` partition catches any rows that do not match the boundary conditions of any existing child partition. The trap is that once a row is inserted into the `DEFAULT` partition that would belong to a new partition you wish to create later, running `CREATE TABLE ... PARTITION OF ... FOR VALUES ...` FAILS with an error. To add the new partition, PostgreSQL must scan the entire `DEFAULT` partition under an exclusive table lock to ensure no overlapping data exists.",
    detailedAnswer: "The Default Partition Dilemma:\n1. Purpose: Avoids runtime errors when client applications insert unexpected partition keys.\n2. The Trap: Suppose `default_part` catches data for March 2026. If you later try to attach `partition_2026_03`, Postgres scans the entire default partition to prove zero March rows exist. If a single March row is present, the command fails!\n3. Production Best Practice: Pre-create future partitions ahead of time using cron or `pg_partman` rather than relying heavily on `DEFAULT` partitions.",
    code: `-- Creating a default catch-all partition
CREATE TABLE sensor_readings_default 
PARTITION OF sensor_readings DEFAULT;

-- Attaching a new partition when DEFAULT partition exists
-- PostgreSql scans sensor_readings_default under ACCESS EXCLUSIVE lock to verify no collisions!
CREATE TABLE sensor_readings_2026_03 
PARTITION OF sensor_readings
FOR VALUES FROM ('2026-03-01 00:00:00+00') TO ('2026-04-01 00:00:00+00');`,
    recallHint: "DEFAULT partitions catch out-of-range rows; creating new partitions scans the entire DEFAULT partition under exclusive lock.",
    interviewTip: "Warn against relying on `DEFAULT` partitions in multi-terabyte tables: always pre-generate future range partitions in advance.",
    tags: ["default-partition", "partition-traps", "access-exclusive-lock", "pg_partman", "maintenance"]
  }),

  createCard({
    idNum: 88,
    category: "Declarative Table Partitioning",
    concept: "Detaching Partitions Online (DETACH PARTITION CONCURRENTLY)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does DETACH PARTITION CONCURRENTLY in PostgreSQL 14+ achieve zero-downtime data archival and drops?",
    quickAnswer: "Prior to PostgreSQL 14, `ALTER TABLE ... DETACH PARTITION` acquired an `AccessExclusiveLock` on both the parent and child partitions, blocking all application queries. PostgreSQL 14 introduced `ALTER TABLE ... DETACH PARTITION ... CONCURRENTLY`, which detaches the partition in two light transaction phases without acquiring an exclusive lock on the parent table, allowing active queries to continue uninterrupted.",
    detailedAnswer: "Zero-Downtime Archival Lifecycle:\n1. Step 1 (`DETACH CONCURRENTLY`): Detaches child table with only weak `ShareUpdateExclusiveLock`. The partition becomes an independent standalone regular table.\n2. Step 2 (Safe Archival / Purge): Once detached, you can:\n   - `DROP TABLE child_part;` (instant drop, frees disk space instantly with zero locks on the active parent table!).\n   - Export child table to S3/Parquet for long-term data lake storage.\n3. Comparison to `DELETE`: Dropping a detached partition takes milliseconds and generates zero WAL dead tuples, whereas `DELETE WHERE date < '2025-01-01'` on a 100M-row table causes hours of WAL writes and bloat.",
    code: `-- Online detachment in PostgreSQL 14+
ALTER TABLE sensor_readings 
DETACH PARTITION sensor_readings_2026_01 CONCURRENTLY;

-- Now sensor_readings_2026_01 is just a regular standalone table!
-- Drop it instantly to free disk space without locking active queries:
DROP TABLE sensor_readings_2026_01;`,
    recallHint: "DETACH PARTITION CONCURRENTLY (PG14+) detaches tables online without blocking queries; instant drop frees disk with zero bloat.",
    interviewTip: "Highlight that dropping a detached partition is the fastest way to implement rolling data retention (e.g. 'Keep 90 days of logs') with zero autovacuum bloat.",
    tags: ["detach-partition-concurrently", "postgres-14", "zero-downtime", "data-retention", "fast-drop"]
  }),

  createCard({
    idNum: 89,
    category: "Declarative Table Partitioning",
    concept: "Index Behavior & Local Index Propagation across Partitions",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do indexes behave on partitioned tables in PostgreSQL, and are indexes global or local?",
    quickAnswer: "PostgreSQL only supports local indexes on partitioned tables (there are no global cross-partition indexes). When you create an index on the root partitioned table, PostgreSQL automatically propagates and instantiates that index on every existing child partition as well as any future child partition created later. Each child partition maintains its own independent physical B-Tree index file on disk.",
    detailedAnswer: "Index Propagation Rules:\n1. Automatic Creation: `CREATE INDEX idx ON parent(col)` automatically issues `CREATE INDEX` on all child tables.\n2. Unique Constraint Limitation: A `UNIQUE` or `PRIMARY KEY` constraint on a partitioned table MUST contain all columns of the partition key! PostgreSQL cannot enforce global uniqueness across partitions unless the partition key is part of the unique index.\n3. Concurrent Indexing on Partitions: You cannot run `CREATE INDEX CONCURRENTLY` on a root partitioned table directly; you must create the index concurrently on each individual child table, then attach them to the parent.",
    code: `-- Create root partitioned table with mandatory partition key in PK
CREATE TABLE orders (
    order_id BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    customer_id INT NOT NULL,
    PRIMARY KEY (order_id, created_at) -- created_at MUST be included!
) PARTITION BY RANGE (created_at);

-- Creating index on parent propagates to all child partitions automatically
CREATE INDEX idx_orders_customer ON orders (customer_id);

-- Verify that child partitions inherited the index
SELECT relname, relkind 
FROM pg_class 
WHERE relname LIKE 'idx_orders_customer%';`,
    recallHint: "Indexes on partitioned tables are local; propagated automatically to child tables; unique constraints MUST include the partition key.",
    interviewTip: "Be prepared to explain why `PRIMARY KEY (order_id)` fails on a partitioned table without `created_at`: Postgres has no global indexes to verify uniqueness across other partitions.",
    tags: ["partition-indexes", "local-indexes", "primary-key-limitation", "index-propagation", "data-integrity"]
  }),

  createCard({
    idNum: 90,
    category: "Declarative Table Partitioning",
    concept: "Foreign Keys & Partitioning in Modern PostgreSQL",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are the rules and capabilities for Foreign Keys on partitioned tables in PostgreSQL 12+?",
    quickAnswer: "PostgreSQL 12 introduced full support for foreign keys referencing partitioned tables, and partitioned tables referencing regular tables. When a partitioned table has a foreign key to a parent table, all child partitions inherit the constraint. However, if a regular table references a partitioned table, the foreign key must reference either the partitioned table's primary key or a unique index that includes the complete partition key.",
    detailedAnswer: "Foreign Key Capabilities:\n1. Partitioned Table -> Regular Table: Supported since PG 11. Child partitions inherit foreign keys automatically.\n2. Regular Table -> Partitioned Table: Supported since PG 12. Incoming foreign keys check across child partitions.\n3. Cascading Deletes: `ON DELETE CASCADE` cascades properly across partitions.\n4. Cross-Partition Updates: Updating a row's partition key moves the tuple to a new child partition, and foreign key integrity is preserved seamlessly.",
    code: `-- Regular parent table
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

-- Partitioned child table referencing customers
CREATE TABLE customer_invoices (
    id BIGINT NOT NULL,
    customer_id INT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    billed_at DATE NOT NULL,
    amount NUMERIC(10, 2),
    PRIMARY KEY (id, billed_at)
) PARTITION BY RANGE (billed_at);

-- Partitions inherit the foreign key constraint automatically
CREATE TABLE invoices_2026_q1 PARTITION OF customer_invoices
FOR VALUES FROM ('2026-01-01') TO ('2026-04-01');`,
    recallHint: "PG12+ supports full foreign keys to and from partitioned tables; child partitions inherit constraints automatically.",
    interviewTip: "Point out that pre-PG12 systems could not have foreign keys referencing partitioned tables; knowing this history shows deep PostgreSQL operational experience.",
    tags: ["foreign-keys", "cascading-deletes", "postgres-12", "referential-integrity", "constraints"]
  }),

  createCard({
    idNum: 91,
    category: "Declarative Table Partitioning",
    concept: "Multi-Level Sub-Partitioning (e.g. RANGE by Time + HASH by Tenant)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Multi-Level Sub-Partitioning work in PostgreSQL, and what is an optimal enterprise architecture?",
    quickAnswer: "Multi-Level Sub-Partitioning creates a hierarchy where a partitioned table's child partitions are themselves partitioned by a different strategy. An optimal enterprise architecture is Level 1: `RANGE` partitioning by Year/Month (for fast data retention drops and temporal pruning), and Level 2: `HASH` partitioning by Tenant ID or User ID (to distribute massive concurrent writes evenly across multiple I/O spindles).",
    detailedAnswer: "Sub-Partitioning Architecture:\n1. Top Level (Root): `PARTITION BY RANGE (created_at)`.\n2. Intermediate Level: Child tables for each month, declared as `PARTITION BY HASH (tenant_id)`.\n3. Leaf Level (Actual Heap Storage): Physical tables representing `Month_2026_01_h0`, `Month_2026_01_h1`, etc.\n4. Query Pruning: Queries filtering on both date and tenant prune both dimensions simultaneously, reading only a single leaf table out of hundreds.",
    code: `-- Top Level: Partition by RANGE (Month)
CREATE TABLE enterprise_audit_logs (
    id UUID NOT NULL,
    tenant_id INT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    message TEXT,
    PRIMARY KEY (id, created_at, tenant_id)
) PARTITION BY RANGE (created_at);

-- Level 2: Month partition sub-partitioned by HASH (tenant_id)
CREATE TABLE audit_logs_2026_01 PARTITION OF enterprise_audit_logs
FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00')
PARTITION BY HASH (tenant_id);

-- Leaf physical tables
CREATE TABLE audit_logs_2026_01_h0 PARTITION OF audit_logs_2026_01 FOR VALUES WITH (MODULUS 2, REMAINDER 0);
CREATE TABLE audit_logs_2026_01_h1 PARTITION OF audit_logs_2026_01 FOR VALUES WITH (MODULUS 2, REMAINDER 1);`,
    recallHint: "Sub-partitioning nests partition strategies; e.g. Level 1 RANGE by month (for retention) + Level 2 HASH by tenant (for write scaling).",
    interviewTip: "Warn about partition proliferation: do not create thousands of sub-partitions unnecessarily, as planning time increases with total partition counts.",
    tags: ["sub-partitioning", "multi-level", "range-hash", "enterprise-architecture", "tenant-scaling"]
  }),

  createCard({
    idNum: 92,
    category: "Declarative Table Partitioning",
    concept: "Tuple Routing Internals & Cross-Partition Row Relocation",
    priority: "must-know",
    difficulty: "advanced",
    question: "What happens internally when an UPDATE statement modifies the partition key of a row in PostgreSQL?",
    quickAnswer: "PostgreSQL 11+ automatically performs cross-partition row relocation. When an `UPDATE` modifies a row's partition key such that it no longer satisfies the current partition's constraint, PostgreSQL executes an atomic `DELETE` on the source partition and routes a new `INSERT` into the appropriate target partition within the same transaction, maintaining index consistency and firing delete/insert triggers accordingly.",
    detailedAnswer: "Tuple Routing Mechanics:\n1. Pre-PG11: Updating a partition key to a value outside the current partition raised an error (`row would fail partition constraint`).\n2. PG11+ Automatic Relocation: The engine transparently converts the update into an atomic tuple migration.\n3. Triggers: Row-level `BEFORE UPDATE` triggers fire on the source table; `AFTER DELETE` fires on source; `BEFORE INSERT` and `AFTER INSERT` fire on target.\n4. Foreign Key Impact: Handled cleanly in PG 12+ without breaking parent references.",
    code: `-- Partitioned table by status
CREATE TABLE project_tickets (
    ticket_id INT NOT NULL,
    status TEXT NOT NULL,
    title TEXT,
    PRIMARY KEY (ticket_id, status)
) PARTITION BY LIST (status);

CREATE TABLE tickets_open PARTITION OF project_tickets FOR VALUES IN ('OPEN', 'IN_PROGRESS');
CREATE TABLE tickets_closed PARTITION OF project_tickets FOR VALUES IN ('RESOLVED', 'CLOSED');

INSERT INTO project_tickets VALUES (1, 'OPEN', 'Fix bug');

-- Updating status automatically relocates row from tickets_open to tickets_closed!
UPDATE project_tickets SET status = 'RESOLVED' WHERE ticket_id = 1;

-- Verify physical relocation
SELECT tableoid::regclass, ticket_id, status FROM project_tickets WHERE ticket_id = 1;
-- Output tableoid: tickets_closed`,
    recallHint: "PG11+ automatically relocates rows across partitions during UPDATE by executing atomic DELETE from source and INSERT into target.",
    interviewTip: "Mention `tableoid::regclass`: querying this pseudo-column reveals the exact physical child partition table where the row lives.",
    tags: ["tuple-routing", "row-relocation", "tableoid", "update-partition-key", "postgres-11"]
  }),

  createCard({
    idNum: 93,
    category: "Declarative Table Partitioning",
    concept: "Automated Partition Management with pg_partman Extension",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is pg_partman, and why is it standard in high-volume production PostgreSQL deployments?",
    quickAnswer: "`pg_partman` is the leading PostgreSQL extension for automating the lifecycle of partitioned tables. It automatically creates upcoming time or serial partitions ahead of time, maintains retention policies by automatically detaching and dropping or archiving old partitions, and runs background maintenance without requiring custom bash scripts or manual cron jobs.",
    detailedAnswer: "`pg_partman` Architecture:\n1. Pre-Creation Window: Automatically ensures that the next 3 to 7 days (or months) of future partitions exist so `INSERT`s never hit a missing partition error.\n2. Retention Enforcement: Automatically runs `run_maintenance()` to drop or detach partitions older than `retention` (e.g. '90 days').\n3. Integration with BGW: Can run as a PostgreSQL native background worker (`shared_preload_libraries = 'pg_partman_bgw'`).\n4. Template Tables: Lets you define indexes and constraints on a template table that are cloned to all newly generated partitions.",
    code: `-- Enable pg_partman extension
CREATE SCHEMA IF NOT EXISTS partman;
CREATE EXTENSION IF NOT EXISTS pg_partman SCHEMA partman;

-- Automate daily partitioning with 90-day retention
SELECT partman.create_parent(
    p_parent_table => 'public.audit_events',
    p_control => 'created_at',
    p_type => 'native',
    p_interval => 'daily',
    p_premake => 7 -- Pre-create 7 days into the future
);

-- Configure retention policy: drop partitions older than 90 days
UPDATE partman.part_config 
SET retention = '90 days', 
    retention_keep_table = false 
WHERE parent_table = 'public.audit_events';

-- Maintenance function called by cron or background worker
SELECT partman.run_maintenance();`,
    recallHint: "pg_partman automates partition creation into the future and enforces retention policies (dropping/detaching old partitions).",
    interviewTip: "Always mention `pg_partman` when asked how to manage time-series partitioning in production: never write custom flaky cron scripts for table DDL.",
    tags: ["pg_partman", "automation", "retention-policy", "time-series", "maintenance"]
  }),

  createCard({
    idNum: 94,
    category: "Declarative Table Partitioning",
    concept: "Partition-Wise Joins & Partition-Wise Aggregates",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are partition-wise joins and aggregates (enable_partitionwise_join) and how do they accelerate large analytics queries?",
    quickAnswer: "Partition-wise join breaks a massive join between two similarly partitioned tables into smaller independent joins between matching child partitions. Similarly, partition-wise aggregation calculates `GROUP BY` subtotals independently per child partition. Both optimizations can run fully in parallel across multiple CPU workers and avoid massive in-memory hash tables, but are disabled by default due to query planning CPU overhead.",
    detailedAnswer: "How Partition-Wise Processing Works:\n1. Standard Join on Partitioned Tables: Scans all partitions of Table A, scans all partitions of Table B, and performs one huge hash join across millions of rows.\n2. Partition-Wise Join (`enable_partitionwise_join = on`): If both tables are partitioned identically on the join key (e.g. `customer_id`), Postgres joins `A_p1` with `B_p1`, `A_p2` with `B_p2` in parallel. Memory fits cleanly inside `work_mem`.\n3. Partition-Wise Aggregation (`enable_partitionwise_aggregate = on`): Aggregates rows inside each partition before combining results.",
    code: `-- Enable advanced partition planner optimizations in session
SET enable_partitionwise_join = on;
SET enable_partitionwise_aggregate = on;

-- Joining two tables partitioned identically on order_date
EXPLAIN (ANALYZE, BUFFERS)
SELECT o.order_id, count(i.item_id)
FROM orders o
JOIN order_items i ON o.order_id = i.order_id AND o.order_date = i.order_date
GROUP BY o.order_id, o.order_date;

-- Plan reveals: Independent Hash Joins running across matching child partitions!`,
    recallHint: "enable_partitionwise_join matches child partitions directly; avoids huge memory hash tables; enables parallel join execution.",
    interviewTip: "Explain why they are disabled by default: planning time increases exponentially if tables have hundreds of partitions, so enable them selectively.",
    tags: ["partitionwise-join", "partitionwise-aggregate", "query-planner", "parallel-query", "analytics"]
  }),

  createCard({
    idNum: 95,
    category: "Declarative Table Partitioning",
    concept: "Tiered Storage: Storing Partitions on Separate Tablespaces",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you implement tiered storage in PostgreSQL by assigning partitions to different Tablespaces?",
    quickAnswer: "PostgreSQL allows individual child partitions to be assigned to different `TABLESPACE` locations on the operating system. This enables multi-temperature storage tiering: recent hot partitions (e.g. current month) reside on ultra-fast NVMe SSD tablespaces for high read/write IOPS, while older cold partitions (e.g. past years) are moved to cheaper, large-capacity spinning disks or network-attached EBS volumes (`ALTER TABLE ... SET TABLESPACE`).",
    detailedAnswer: "Tiered Storage Architecture:\n1. Hot Tier: `TABLESPACE fast_nvme` mounted on high-speed NVMe.\n2. Cold Tier: `TABLESPACE cheap_storage` mounted on high-density storage.\n3. Transparent to Applications: The application queries the root partitioned table without knowing which physical disk volume stores which records.\n4. Migration Command: `ALTER TABLE orders_2024_01 SET TABLESPACE cheap_storage;` moves the table files online without blocking reads.",
    code: `-- Create tablespaces pointing to different disk mount points
CREATE TABLESPACE fast_nvme LOCATION '/mnt/nvme_pool/data';
CREATE TABLESPACE cold_storage LOCATION '/mnt/spinning_disks/data';

-- Create current active partition on fast NVMe
CREATE TABLE orders_2026_06 PARTITION OF orders
FOR VALUES FROM ('2026-06-01') TO ('2026-07-01')
TABLESPACE fast_nvme;

-- Move historical partition to cold storage online
ALTER TABLE orders_2024_01 SET TABLESPACE cold_storage;`,
    recallHint: "Partitions can have distinct tablespaces; hot data on fast NVMe SSDs, cold historical data on cheaper disks via SET TABLESPACE.",
    interviewTip: "Emphasize cost optimization: tiered storage reduces cloud hosting bills by 70% by moving multi-terabyte historical partitions to cheaper disk tiers.",
    tags: ["tablespaces", "tiered-storage", "hot-cold-storage", "disk-architecture", "cost-optimization"]
  }),

  createCard({
    idNum: 96,
    category: "Declarative Table Partitioning",
    concept: "Single-Node Partitioning vs Distributed Sharding (Citus)",
    priority: "must-know",
    difficulty: "advanced",
    question: "When does single-node declarative partitioning reach its limit, and how does Citus extend PostgreSQL to distributed sharding?",
    quickAnswer: "Single-node declarative partitioning organizes data across disk files on a single operating system, scaling up to ~10-20TB before hitting single-machine CPU, RAM, and disk I/O bus bottlenecks. Citus (now an open-source extension) transforms PostgreSQL into a distributed database, sharding tables by hash key across a cluster of dozens of worker nodes, scaling PostgreSQL to petabytes and millions of queries per second.",
    detailedAnswer: "Partitioning vs Distributed Sharding:\n1. Single-Node Partitioning: Solves table bloat, maintenance windows, and index size. Limited to one machine's RAM and CPU.\n2. Citus Distributed Tables:\n   - Coordinator Node: Parses incoming SQL queries, rewrites them into distributed sub-queries, and routes them to workers.\n   - Worker Nodes: Independent PostgreSQL instances holding distributed shards (`table_102001`, `table_102002`).\n   - Colocation: Joining two tables sharded on the same key (`tenant_id`) executes 100% locally on each worker without network data shuffling.",
    code: `-- Transforming a standard table into a Citus distributed table
-- 1. Enable Citus extension
CREATE EXTENSION IF NOT EXISTS citus;

-- 2. Distribute the multi-tenant table across the worker cluster by tenant_id
SELECT create_distributed_table('company_events', 'tenant_id');

-- Citus automatically handles routing, query parallelization, and shard balancing!
SELECT * FROM company_events WHERE tenant_id = 501;`,
    recallHint: "Partitioning is single-machine file management; Citus distributes shards across a cluster of worker servers for horizontal scale-out.",
    interviewTip: "Clarify the distinction between scaling UP (single-node partitioning + bigger server) vs scaling OUT (distributed Citus sharding across a cluster).",
    tags: ["citus", "sharding", "distributed-postgres", "horizontal-scaling", "scale-out"]
  })
];

module.exports = cards;
