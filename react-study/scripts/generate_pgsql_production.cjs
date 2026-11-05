const fs = require("fs");
const path = require("path");

const productionTopics = [
  {
    id: "pg-prod-01",
    topic: "Transaction ID (XID) Wraparound Disaster Prevention & Emergency Freezing",
    category: "Disaster Recovery & Engine Health",
    severity: "P0 / Database Read-Only Forced Shutdown",
    theProblem: "PostgreSQL uses 32-bit transaction IDs. After 2 billion transactions without vacuum freezing, older committed rows appear to be in the future, rendering them invisible. If database age reaches 2 billion minus 10 million transactions, PostgreSQL forcefully halts all write traffic, shuts down client backends, and forces a single-user emergency maintenance mode.",
    howItWorksInternally: "PostgreSQL treats XIDs circularly modulo 2^31. Vacuum freezes rows by rewriting `xmin` to `FrozenTransactionId` (2) or setting the `HEAP_XMIN_FROZEN` bit in `t_infomask`. If long-running transactions, orphaned prepared transactions (`pg_prepared_xacts`), or inactive replication slots prevent the database `xmin` horizon from advancing, anti-wraparound autovacuum runs relentlessly, saturating disk I/O. If ignored until `autovacuum_freeze_max_age`, writes are rejected.",
    productionCode: `-- 1. Monitor database XID age across all databases
SELECT 
    datname, 
    age(datfrozenxid) AS xid_age,
    2147483648 - age(datfrozenxid) AS xids_until_catastrophic_halt,
    round(100.0 * age(datfrozenxid) / 2147483648, 2) AS pct_towards_halt
FROM pg_database
ORDER BY xid_age DESC;

-- 2. Identify top 5 oldest tables holding back the horizon
SELECT 
    c.relname, 
    age(c.relfrozenxid) AS table_xid_age,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind IN ('r', 't') AND n.nspname NOT IN ('pg_toast', 'information_schema')
ORDER BY table_xid_age DESC
LIMIT 5;

-- 3. Kill abandoned transactions holding back the xmin horizon
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE (now() - xact_start) > INTERVAL '4 hours' 
  AND backend_type = 'client backend';`,
    monitoringMetrics: [
      "pg_database.age(datfrozenxid) > 150,000,000 (Alert Threshold)",
      "pg_database.age(datfrozenxid) > 500,000,000 (P0 Critical Escalation)",
      "pg_prepared_xacts count > 0 for longer than 15 minutes",
      "pg_replication_slots.active = false with high retained WAL"
    ],
    productionChecklist: [
      "Alerting configured in Prometheus/Datadog when `age(datfrozenxid)` crosses 150 million.",
      "Automated reap of orphaned prepared transactions older than 1 hour.",
      "Tune `vacuum_freeze_min_age` and `autovacuum_freeze_max_age` to distribute freeze load evenly."
    ]
  },

  {
    id: "pg-prod-02",
    topic: "Connection Pool Saturation & PgBouncer Multi-Tenant Sizing",
    category: "Connection Pooling & Architecture",
    severity: "P0 / Total Application Latency Collapse",
    theProblem: "PostgreSQL forks an OS process per connection (~10MB-20MB RAM). When 50 microservices connect with default pool sizes of 20, 1,000 backend processes spawn. CPU context switching spikes to 95%, backend memory starves the OS page cache, and query latency degrades from 2ms to 15,000ms, collapsing all upstream services.",
    howItWorksInternally: "Physical connections consume virtual memory for execution trees, catalog caches, and OS file descriptors. In contrast, optimal PostgreSQL throughput occurs when active backend count matches `(2 * CPU_Cores) + Spindle_Count`. PgBouncer in `transaction` mode intercepts thousands of client TCP sockets and multiplexes them onto a small pool of 50-100 persistent PostgreSQL processes, returning backend processes to the pool the instant a transaction completes.",
    productionCode: `-- /etc/pgbouncer/pgbouncer.ini
[databases]
* = host=127.0.0.1 port=5432 pool_mode=transaction

[pgbouncer]
listen_addr = *
listen_port = 6432
auth_type = scram-sha-256
auth_file = /etc/pgbouncer/userlist.txt

-- Sizing Formula: 5,000 client apps -> 60 backend Postgres processes
max_client_conn = 5000
default_pool_size = 50
reserve_pool_size = 10
reserve_pool_timeout = 5
max_prepared_statements = 200 -- PgBouncer 1.21+ supports prepared statements!

-- Query client pools inside pgbouncer admin console:
-- psql -p 6432 -U pgbouncer pgbouncer
-- SHOW POOLS;
-- SHOW CLIENTS;`,
    monitoringMetrics: [
      "pgbouncer.cl_waiting > 0 (Clients queued waiting for pool connection)",
      "pg_stat_activity count(backend_type = 'client backend') vs max_connections",
      "Host CPU context switches per second (> 50,000 indicates process thrashing)"
    ],
    productionChecklist: [
      "Never allow web microservices to connect directly to PostgreSQL port 5432.",
      "Route all traffic through PgBouncer on port 6432 in transaction pooling mode.",
      "Ensure applications use `SET LOCAL` for session variables to prevent pooled connection poisoning."
    ]
  },

  {
    id: "pg-prod-03",
    topic: "Zero-Downtime Safe DDL Migrations on High-Traffic Tables",
    category: "DevOps & Migrations",
    severity: "P1 / Lock Queue Cascading Outage",
    theProblem: "Running `ALTER TABLE orders ADD COLUMN status_code INT;` on a high-throughput table requests an `AccessExclusiveLock`. If a slow reporting `SELECT` is running, the migration waits in the lock queue. Because PostgreSQL's lock queue is FIFO, all subsequent fast 1ms incoming API `SELECT`s are queued BEHIND the DDL, exhausting the application connection pool in seconds and taking down production.",
    howItWorksInternally: "PostgreSQL enforces FIFO lock queuing to prevent DDL starvation. While `AccessExclusiveLock` is waiting, it blocks all subsequent `AccessShareLock` requests. Setting `lock_timeout` limits how long DDL waits to acquire its lock before aborting. In PostgreSQL 11+, adding columns with constant defaults stores the value in catalog `pg_attribute` without rewriting the physical heap table.",
    productionCode: `-- Production Zero-Downtime Migration Pattern
BEGIN;

-- 1. If lock cannot be acquired within 2 seconds, fail immediately to protect web traffic!
SET LOCAL lock_timeout = '2s';

-- 2. Cap execution time to 15 seconds
SET LOCAL statement_timeout = '15s';

-- 3. Instant metadata-only column addition in PG 11+ (ZERO table rewrite!)
ALTER TABLE orders ADD COLUMN fulfillment_region TEXT NOT NULL DEFAULT 'US-EAST';

COMMIT;

-- 4. Adding Foreign Keys safely without blocking table writes:
ALTER TABLE orders 
ADD CONSTRAINT fk_orders_customer 
FOREIGN KEY (customer_id) REFERENCES customers(id) NOT VALID;

-- Validate constraint concurrently in background without blocking writes:
ALTER TABLE orders VALIDATE CONSTRAINT fk_orders_customer;`,
    monitoringMetrics: [
      "pg_locks.granted = false where locktype = 'relation'",
      "pg_stat_activity queries waiting on 'relation' lock > 2 seconds",
      "Application connection pool checkout queue wait times"
    ],
    productionChecklist: [
      "All automated CI/CD migration scripts must inject `SET LOCAL lock_timeout = '2s'`.",
      "Add Foreign Keys with `NOT VALID` followed by `VALIDATE CONSTRAINT`.",
      "Create indexes exclusively with `CREATE INDEX CONCURRENTLY`."
    ]
  },

  {
    id: "pg-prod-04",
    topic: "Online Table and Index Bloat Remediation with pg_repack",
    category: "Storage & Performance Maintenance",
    severity: "P1 / Disk Exhaustion & Buffer Cache Poisoning",
    theProblem: "High-frequency `UPDATE` and `DELETE` operations generate dead tuples. If autovacuum cannot keep pace, empty space becomes trapped in 8KB pages. Tables swell from 10GB to 150GB. Standard `VACUUM` marks space reusable internally but cannot return disk space to the OS. `VACUUM FULL` reclaims disk space but takes an exclusive lock that blocks all application reads and writes for hours.",
    howItWorksInternally: "`pg_repack` is an online defragmentation extension that rebuilds tables and indexes without taking exclusive table locks. It creates a shadow table, copies all live tuples, replays concurrent updates using a trigger-based log table, builds new indexes, and performs an instantaneous catalog swap in a split-second transaction.",
    productionCode: `-- 1. Identify top bloated tables using dead tuple percentage
SELECT 
    schemaname, 
    relname, 
    n_live_tup, 
    n_dead_tup,
    round(100.0 * n_dead_tup / nullif(n_dead_tup + n_live_tup, 0), 2) AS dead_tuple_pct,
    pg_size_pretty(pg_total_relation_size(relid)) AS total_size
FROM pg_stat_user_tables
WHERE n_dead_tup > 50000
ORDER BY n_dead_tup DESC;

-- 2. Execute online repack from terminal (ZERO write downtime!):
-- $ pg_repack -h 127.0.0.1 -p 5432 -U postgres -d production_db -t orders -j 4

-- 3. Rebuild bloated B-Tree indexes online natively (PostgreSQL 12+):
REINDEX INDEX CONCURRENTLY idx_orders_customer_id;`,
    monitoringMetrics: [
      "pg_stat_user_tables.n_dead_tup / (n_live_tup + n_dead_tup) > 0.25",
      "Disk filesystem utilization percentage on $PGDATA",
      "Buffer cache hit ratio degradation due to dead page reads"
    ],
    productionChecklist: [
      "Never run `VACUUM FULL` on production tables without scheduled maintenance downtime.",
      "Install `pg_repack` for online bloat recovery without write lockouts.",
      "Schedule `REINDEX TABLE CONCURRENTLY` quarterly to defragment split B-Tree pages."
    ]
  },

  {
    id: "pg-prod-05",
    topic: "Eliminating External Merge Disk Spills by Dynamic work_mem Calibration",
    category: "Memory Tuning & I/O",
    severity: "P2 / Query Latency Degradation & I/O Throttling",
    theProblem: "Complex reporting queries, large aggregations, and multi-table joins spill intermediate data to temporary disk files because the default `work_mem` is only 4MB. Disk spills cause queries that should take 50ms in RAM to take 12,000ms while saturating cloud storage IOPS budgets.",
    howItWorksInternally: "PostgreSQL allocates `work_mem` per sort and per hash table operation inside an execution plan node. When a sort exceeds `work_mem`, it switches from `quicksort` in RAM to `external merge` on disk (`$PGDATA/base/pgsql_tmp/`). Sizing `work_mem` too high globally risks triggering the Linux Out-Of-Memory (OOM) killer. The production solution is setting a moderate global baseline (16-32MB) and dynamically raising `work_mem` inside heavy analytical transactions.",
    productionCode: `-- Detect disk spills in active query plan
EXPLAIN (ANALYZE, BUFFERS)
SELECT customer_id, count(*), sum(amount)
FROM orders
GROUP BY customer_id
ORDER BY sum(amount) DESC;

-- If plan shows: "Sort Method: external merge  Disk: 32410kB"

-- Production Fix: Dynamically allocate RAM strictly for this analytical batch:
BEGIN;
SET LOCAL work_mem = '256MB'; -- Safe: allocates only for this session/transaction!

SELECT customer_id, count(*), sum(amount)
FROM orders
GROUP BY customer_id
ORDER BY sum(amount) DESC;
-- Now runs in RAM: "Sort Method: quicksort  Memory: 41200kB"
COMMIT;`,
    monitoringMetrics: [
      "pg_stat_database.temp_files count and temp_bytes written",
      "EXPLAIN ANALYZE 'Sort Method: external merge Disk'",
      "Linux host memory: MemAvailable vs OOM killer invocations"
    ],
    productionChecklist: [
      "Set global `work_mem` to 16MB-32MB in `postgresql.conf`.",
      "Use `SET LOCAL work_mem = '128MB'` in reporting workers and batch ETL pipelines.",
      "Monitor `temp_bytes` in `pg_stat_database` to detect queries thrashing disk."
    ]
  },

  {
    id: "pg-prod-06",
    topic: "Checkpointer Thrashing & Spread Checkpoint Tuning on NVMe Storage",
    category: "Storage Engine & Durability",
    severity: "P1 / Periodic I/O Stalls & High Write Latency",
    theProblem: "During high-volume ingestion, checkpointer processes wake up too frequently, dumping thousands of dirty 8KB buffers to disk at once. Storage write queues saturate, leading to periodic 5-10 second query write latency spikes ('checkpoint spikes').",
    howItWorksInternally: "Checkpoints occur when either `checkpoint_timeout` expires or WAL generation reaches `max_wal_size`. If `max_wal_size` is too low, checkpoints trigger every 30 seconds instead of every 15 minutes. PostgreSQL provides spread checkpoints: setting `checkpoint_completion_target = 0.9` instructs the checkpointer to throttle page flushing smoothly over 90% of the timeout duration, smoothing out disk I/O.",
    productionCode: `-- Modern Production Storage Engine Tuning (postgresql.conf)
-- 1. Extend checkpoint window to 15 minutes
ALTER SYSTEM SET checkpoint_timeout = '15min';

-- 2. Spread writes smoothly over 90% of the window (13.5 minutes)
ALTER SYSTEM SET checkpoint_completion_target = 0.9;

-- 3. Increase WAL capacity to prevent premature checkpoints on NVMe
ALTER SYSTEM SET max_wal_size = '32GB';
ALTER SYSTEM SET min_wal_size = '4GB';

-- 4. Reload configuration without database restart
SELECT pg_reload_conf();

-- Inspect checkpoint frequency and determine if checkpoints are triggered by time or WAL
SELECT * FROM pg_stat_checkpointer; -- (PG17+) or pg_stat_bgwriter`,
    monitoringMetrics: [
      "checkpoints_req (Checkpoints triggered by WAL volume; should be near 0)",
      "checkpoints_timed (Checkpoints triggered by time; should be > 95% of total)",
      "Disk write latency (fio / cloud EBS write burst balance)"
    ],
    productionChecklist: [
      "Set `checkpoint_completion_target = 0.9` on all production instances.",
      "Size `max_wal_size` sufficiently high (16GB-32GB) so checkpoints trigger on time, not WAL exhaustion.",
      "Ensure `checkpoints_req` is less than 5% of `checkpoints_timed`."
    ]
  },

  {
    id: "pg-prod-07",
    topic: "Observability & Regression Detection via pg_stat_statements",
    category: "Monitoring & Observability",
    severity: "P1 / Undetected Query Regressions & Resource Starvation",
    theProblem: "A minor application release introduces an un-indexed query or N+1 query loop. Without aggregate query telemetry, DBAs cannot identify which specific SQL pattern is degrading the database cluster until CPU reaches 100% and clients experience timeouts.",
    howItWorksInternally: "`pg_stat_statements` hooks into the query executor, hashing SQL statement parse trees into normalized parameter-agnostic signatures (`queryid`). It tracks cumulative metrics: execution counts, total time, mean time, standard deviation, buffer cache hits, and disk block reads across all client backends.",
    productionCode: `-- Enable extension in postgresql.conf:
-- shared_preload_libraries = 'pg_stat_statements'

CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 5 queries by cumulative cluster load (% of total CPU/IO time)
SELECT 
    round(total_exec_time::NUMERIC, 2) AS total_time_ms,
    calls,
    round(mean_exec_time::NUMERIC, 2) AS avg_time_ms,
    round((100.0 * total_exec_time / sum(total_exec_time) OVER ())::NUMERIC, 2) AS pct_total_load,
    shared_blks_hit,
    shared_blks_read,
    query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 5;

-- Reset telemetry after deploying new indexes or schema releases:
-- SELECT pg_stat_statements_reset();`,
    monitoringMetrics: [
      "Top queries sorted by total_exec_time (Identifies highest cluster load)",
      "Top queries sorted by shared_blks_read (Identifies missing indexes)",
      "Top queries with mean_exec_time > 100ms"
    ],
    productionChecklist: [
      "Always include `pg_stat_statements` in `shared_preload_libraries`.",
      "Set `pg_stat_statements.track = top` to exclude internal function calls.",
      "Reset statistics after major indexing or schema deployments to maintain clean trends."
    ]
  },

  {
    id: "pg-prod-08",
    topic: "High-Throughput Concurrent Job Queuing with SKIP LOCKED",
    category: "Concurrency & Queue Architecture",
    severity: "P1 / Worker Serialization & Lock Contention",
    theProblem: "Using PostgreSQL as a background message broker with standard `SELECT ... FOR UPDATE LIMIT 1` causes all background worker threads to block on the exact same row. Throughput collapses, deadlocks spike, and workers serialize.",
    howItWorksInternally: "`SKIP LOCKED` instructs the lock manager to bypass any row currently locked by another concurrent transaction, immediately claiming the next unlocked row. Combined with a Writable CTE, tasks are fetched, locked, marked 'PROCESSING', and returned in a single atomic database operation without worker serialization.",
    productionCode: `-- Production FIFO Queue Consumer Query
WITH next_batch AS (
    SELECT id 
    FROM job_queue
    WHERE status = 'QUEUED' 
      AND scheduled_at <= NOW()
    ORDER BY priority DESC, id ASC
    LIMIT 10
    FOR UPDATE SKIP LOCKED -- Skips already-claimed jobs!
)
UPDATE job_queue jq
SET status = 'PROCESSING',
    claimed_at = NOW(),
    worker_id = 'worker-node-42'
FROM next_batch
WHERE jq.id = next_batch.id
RETURNING jq.id, jq.task_type, jq.payload;`,
    monitoringMetrics: [
      "Job queue processing latency (claimed_at minus scheduled_at)",
      "Deadlock count on job_queue table (should be exactly 0 with SKIP LOCKED)",
      "Number of pending tasks with status = 'QUEUED'"
    ],
    productionChecklist: [
      "Always pair `FOR UPDATE` with `SKIP LOCKED` for queue consumer queries.",
      "Include composite partial index: `CREATE INDEX idx_queue ON job_queue (priority DESC, id ASC) WHERE status = 'QUEUED'`.",
      "Run worker claims inside explicit short transactions."
    ]
  },

  {
    id: "pg-prod-09",
    topic: "Multi-Tenant Row-Level Security (RLS) Leak Prevention & InitPlan Optimization",
    category: "Security & Multi-Tenancy",
    severity: "P0 / Data Breach & Query Plan Degradation",
    theProblem: "A multi-tenant application relies on RLS to isolate customer data. Two critical failures frequently occur: 1) The database connection logs in as the table owner, which bypasses RLS policies by default and exposes cross-tenant data; and 2) Poorly written RLS policies re-evaluate session functions per row ($O(N)$), degrading query performance by 100x.",
    howItWorksInternally: "Table owners bypass RLS unless `FORCE ROW LEVEL SECURITY` is explicitly declared. Furthermore, session context checks `current_setting('app.tenant_id')` must be wrapped in a scalar subquery `(SELECT ...)` so the query planner evaluates the tenant ID once as an `InitPlan` at startup, utilizing B-Tree index seeks on `tenant_id`.",
    productionCode: `-- Production RLS Hardening Template
CREATE TABLE enterprise_documents (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL,
    filename TEXT NOT NULL,
    content TEXT
);

-- 1. Enable RLS and FORCE it on the table owner
ALTER TABLE enterprise_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE enterprise_documents FORCE ROW LEVEL SECURITY;

-- 2. InitPlan-Optimized Policy: Evaluated ONCE per query, not per row!
CREATE POLICY strict_tenant_isolation ON enterprise_documents
FOR ALL
USING (
    tenant_id = (SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::INT)
)
WITH CHECK (
    tenant_id = (SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::INT)
);

-- 3. Composite index on tenant_id + search columns
CREATE INDEX idx_docs_tenant ON enterprise_documents (tenant_id, id);`,
    monitoringMetrics: [
      "pg_class.relrowsecurity and relforcerowsecurity status on all tenant tables",
      "EXPLAIN plan verification of 'InitPlan' on RLS queries",
      "Auditing 0 cross-tenant data access violations in security logs"
    ],
    productionChecklist: [
      "Always declare `FORCE ROW LEVEL SECURITY` on every multi-tenant table.",
      "Wrap `current_setting` in `(SELECT ...)` to guarantee InitPlan query performance.",
      "Connect application services using a restricted `NOBYPASSRLS` role."
    ]
  },

  {
    id: "pg-prod-10",
    topic: "Physical Streaming Replication Slots & Primary Disk-Full Protection",
    category: "High Availability & Replication",
    severity: "P0 / Primary Server Disk Crash",
    theProblem: "Physical replication slots instruct the primary PostgreSQL server to retain all Write-Ahead Log (WAL) segments until the standby replica acknowledges receiving them. If a standby replica crashes, disconnects, or is terminated without dropping its slot, the primary retains ALL generated WAL files indefinitely, filling up 100% of the primary server's disk and crashing the entire database cluster.",
    howItWorksInternally: "The Checkpointer purges recycled WAL segments prior to the oldest `restart_lsn` recorded across all active and inactive replication slots. If a slot is inactive, `restart_lsn` never advances. PostgreSQL 13+ introduced `max_slot_wal_keep_size`, which places a hard upper limit on retained WAL per slot, invalidating the slot if it falls too far behind to protect the primary server from disk exhaustion.",
    productionCode: `-- 1. Monitor replication slots and disk space retained on Primary
SELECT 
    slot_name, 
    active, 
    wal_status,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS retained_wal_bytes
FROM pg_replication_slots;

-- 2. CRITICAL SAFEGUARD: Cap maximum WAL retained by any slot to 32GB
-- Prevents a lagging replica from filling 100% of the primary server's disk!
ALTER SYSTEM SET max_slot_wal_keep_size = '32GB';
SELECT pg_reload_conf();

-- 3. Emergency procedure: Drop an abandoned replica slot
-- SELECT pg_drop_replication_slot('dead_standby_node_2');`,
    monitoringMetrics: [
      "pg_replication_slots.retained_wal_bytes > 16GB (Warning Alert)",
      "pg_replication_slots.active = false for > 30 minutes",
      "Filesystem disk space free percentage on primary $PGDATA/pg_wal"
    ],
    productionChecklist: [
      "Configure `max_slot_wal_keep_size = '32GB'` on all production primary nodes.",
      "Monitor `pg_replication_slots` and alert on inactive slots.",
      "Automate slot deletion in infrastructure teardown automation (Terraform / K8s)."
    ]
  },

  {
    id: "pg-prod-11",
    topic: "Autovacuum Stall Diagnostics & Unblocking Deadlock Horizons",
    category: "Engine Maintenance & Vacuum",
    severity: "P1 / Runaway Table Bloat",
    theProblem: "Autovacuum workers run continuously, yet `n_dead_tup` keeps rising. Query scan performance degrades as tables bloat. The DBA discovers that autovacuum is silently unable to remove dead tuples because a single forgotten client session or open snapshot is freezing the global `xmin` cleanup horizon.",
    howItWorksInternally: "Vacuum can ONLY remove a dead tuple if the tuple's `xmax` is older than the oldest running transaction in the entire database cluster (the oldest `xmin` horizon). If a single developer opened a transaction (`BEGIN; SELECT ...`) in psql 18 hours ago and went home, NO dead tuples created after that moment can be removed from any table in the entire database.",
    productionCode: `-- 1. Identify the oldest transaction holding back the vacuum xmin horizon
SELECT 
    pid, 
    usename, 
    client_addr, 
    state, 
    now() - xact_start AS xact_age,
    query
FROM pg_stat_activity
WHERE backend_type = 'client backend'
  AND xact_start IS NOT NULL
ORDER BY xact_start ASC
LIMIT 5;

-- 2. Automatically kill idle transactions older than 15 minutes (postgresql.conf)
ALTER SYSTEM SET idle_in_transaction_session_timeout = '15min';
SELECT pg_reload_conf();

-- 3. Check for prepared transactions holding the horizon
SELECT gid, prepared, age(transaction) FROM pg_prepared_xacts;`,
    monitoringMetrics: [
      "pg_stat_activity.idle_in_transaction_session_timeout terminations",
      "Oldest xact_start age > 1 hour",
      "pg_stat_user_tables.n_dead_tup growth rate"
    ],
    productionChecklist: [
      "Set `idle_in_transaction_session_timeout = '15min'` globally in `postgresql.conf`.",
      "Set `statement_timeout = '30s'` on web applications.",
      "Never open manual transactions in psql on production without immediate COMMIT."
    ]
  },

  {
    id: "pg-prod-12",
    topic: "Cost Constant Realignment for Cloud NVMe SSD Storage (GP3 / io2)",
    category: "Query Planner Calibration",
    severity: "P2 / Unnecessary Full Table Scans",
    theProblem: "Queries that filter by an indexed column inexplicably perform slow sequential table scans instead of index scans, even when an index exists. The database server runs on high-speed AWS GP3 / io2 NVMe SSD storage, but the query planner still uses default cost constants calibrated for spinning magnetic hard drives from the year 2000.",
    howItWorksInternally: "The planner's cost model assumes random reads (`random_page_cost = 4.0`) are 4x more expensive than sequential reads (`seq_page_cost = 1.0`). On modern NVMe SSDs, random seeks have virtually no mechanical latency penalty. Leaving `random_page_cost = 4.0` causes the optimizer to incorrectly judge index scans as too expensive, defaulting to sequential scans.",
    productionCode: `-- Production Cost Tuning for NVMe SSD / Cloud EBS (GP3, io2)
-- 1. Lower random read penalty from 4.0 to 1.1
ALTER SYSTEM SET random_page_cost = 1.1;

-- 2. Fine-tune CPU tuple costs
ALTER SYSTEM SET cpu_tuple_cost = 0.01;
ALTER SYSTEM SET cpu_index_tuple_cost = 0.005;

-- 3. Inform planner of available OS cache RAM (75% of instance RAM)
ALTER SYSTEM SET effective_cache_size = '24GB'; -- on a 32GB server

-- Apply immediately without server restart
SELECT pg_reload_conf();

-- Verify query plans switch immediately from Seq Scan to Index Scan
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM customer_orders WHERE order_code = 'ORD-98214';`,
    monitoringMetrics: [
      "Ratio of Index Scans vs Sequential Scans in pg_stat_user_tables",
      "Average execution latency of point lookups",
      "Buffer cache hit ratio on NVMe storage"
    ],
    productionChecklist: [
      "Set `random_page_cost = 1.1` on all SSD/NVMe hosted instances.",
      "Set `effective_cache_size` to 75% of total system RAM.",
      "Verify query plan improvements via `EXPLAIN (ANALYZE, BUFFERS)`."
    ]
  },

  {
    id: "pg-prod-13",
    topic: "Schema-per-Tenant Migration Automation at Enterprise Scale (1,000+ Schemas)",
    category: "Multi-Tenancy & DDL Pipelines",
    severity: "P1 / Catalog Lock Contention & Migration Timeout",
    theProblem: "In a Schema-per-Tenant architecture with 2,000 customer schemas, running a schema migration in a single monolithic transaction holds shared catalog locks for hours. If schema 1,980 fails with a syntax error, all 1,979 previous schemas roll back, causing deployment failures and locking system catalogs.",
    howItWorksInternally: "System catalogs (`pg_class`, `pg_attribute`, `pg_type`) acquire locks during DDL. Migrations across thousands of schemas must be executed in independent, batched transactions with aggressive `lock_timeout` values per schema, logging migration state in a dedicated schema versioning table.",
    productionCode: `-- Automated Production Multi-Tenant Migration Procedure
CREATE OR REPLACE PROCEDURE migrate_tenant_schemas_safe()
LANGUAGE plpgsql AS $$
DECLARE
    schema_rec RECORD;
BEGIN
    FOR schema_rec IN (
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%'
        ORDER BY schema_name
    ) LOOP
        -- Set 2s lock timeout per schema to avoid blocking tenant traffic
        EXECUTE format('SET LOCAL lock_timeout = %L', '2s');
        
        -- Apply migration dynamically
        EXECUTE format(
            'ALTER TABLE %I.invoices ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5, 4) DEFAULT 0.0000', 
            schema_rec.schema_name
        );
        
        RAISE NOTICE 'Migrated schema: %', schema_rec.schema_name;
    END LOOP;
END;
$$;`,
    monitoringMetrics: [
      "Migration execution duration per tenant schema",
      "Catalog lock wait events in pg_stat_activity",
      "Number of schemas successfully migrated vs failed"
    ],
    productionChecklist: [
      "Never execute multi-tenant DDL in a single giant transaction.",
      "Set `lock_timeout = '2s'` inside the per-schema migration loop.",
      "Record migration success/failure per schema in a centralized ledger table."
    ]
  },

  {
    id: "pg-prod-14",
    topic: "Vector Embedding Search at Scale: HNSW Memory Allocation & Sizing",
    category: "AI & Vector Search",
    severity: "P1 / Out-Of-Memory Crashes & High Search Latency",
    theProblem: "Deploying high-dimensional AI vector embeddings (1536-dim) with pgvector HNSW indexes causes server RAM exhaustion and slow index builds. Building an HNSW index on 2 million vectors with insufficient maintenance memory causes the build to fail or thrash swap space.",
    howItWorksInternally: "HNSW builds a multi-layer proximity graph where each vector connects to `m` bi-directional neighbors. Graph construction is CPU and memory intensive, bounded by `maintenance_work_mem`. During queries, the search frontier is bounded by `hnsw.ef_search`: higher values increase recall accuracy at the cost of query latency. Memory must be sized to keep the HNSW graph in RAM buffers.",
    productionCode: `-- 1. Optimize memory for HNSW index creation
SET maintenance_work_mem = '4GB'; -- Allocate ample RAM for graph building
SET max_parallel_maintenance_workers = 4;

-- 2. Build high-recall HNSW index on 1536-dim vector embeddings
CREATE INDEX idx_embeddings_hnsw 
ON document_vectors 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- 3. Tune query-time recall vs latency trade-off in session:
-- Default ef_search is 40. Bump to 100 for higher recall accuracy:
SET hnsw.ef_search = 100;

-- Execute sub-millisecond semantic similarity search
SELECT id, document_text, (1 - (embedding <=> '[...]'::VECTOR)) AS score
FROM document_vectors
ORDER BY embedding <=> '[...]'::VECTOR
LIMIT 5;`,
    monitoringMetrics: [
      "HNSW index size via pg_size_pretty(pg_relation_size('idx_embeddings_hnsw'))",
      "Average semantic search query latency (ms)",
      "Recall percentage compared to ground-truth exact KNN scans"
    ],
    productionChecklist: [
      "Allocate at least 2GB-4GB `maintenance_work_mem` prior to building HNSW indexes.",
      "Tune `hnsw.ef_search` per query to balance recall accuracy and speed.",
      "Ensure total HNSW index size fits inside `shared_buffers` + OS Page Cache."
    ]
  }
];

// Validate schema
const requiredFields = [
  "id",
  "topic",
  "category",
  "severity",
  "theProblem",
  "howItWorksInternally",
  "productionCode",
  "monitoringMetrics",
  "productionChecklist"
];

let errors = 0;
for (const item of productionTopics) {
  for (const field of requiredFields) {
    if (!item[field] || (Array.isArray(item[field]) && item[field].length === 0)) {
      console.error(`Production item ${item.id} missing field: ${field}`);
      errors++;
    }
  }
}

if (errors > 0) {
  console.error(`Validation failed with ${errors} errors.`);
  process.exit(1);
}

const outputPath = path.join(__dirname, "../data/pgsql.production.json");
fs.writeFileSync(outputPath, JSON.stringify(productionTopics, null, 2), "utf-8");

console.log(`Successfully generated PostgreSQL Production Mastery Hub:`);
console.log(`- ${productionTopics.length} Operational Guides -> ${outputPath}`);
