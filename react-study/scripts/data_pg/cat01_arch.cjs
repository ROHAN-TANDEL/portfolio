const { createCard } = require("../pg_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 1,
    category: "Engine Architecture & Memory",
    concept: "Process-Per-Connection Architecture vs Threaded Models",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does PostgreSQL's process-per-connection architecture differ from threaded databases like MySQL, and what are the implications?",
    quickAnswer: "PostgreSQL uses an operating system process-per-connection model managed by the Postmaster daemon, unlike MySQL or SQL Server which use multithreading. Each connected client is served by a dedicated backend OS process (`postgres`) with its own private virtual memory space, isolating crashes but requiring ~10MB-20MB RAM per connection and making external connection poolers like PgBouncer mandatory for high concurrency.",
    detailedAnswer: "When a client connects to PostgreSQL:\n1. The master listener daemon (`postmaster`) intercepts the TCP handshake and calls `fork()` to spawn a dedicated backend worker process (`postgres: user db [local]`).\n2. Fault Isolation: If a backend process crashes (e.g. fatal C-extension bug or segfault), other connections are isolated and do not crash the operating system memory space of other clients.\n3. Memory Cost: Unlike threads that share heap memory, each backend process has private memory (`work_mem`, `temp_buffers`). Spawning 1,000 connections consumes 10-20GB of RAM just for connection descriptors, causing OS context-switching thrashing.\n4. Architectural Rule: Keep `max_connections` low (100-200) and place PgBouncer in front to multiplex thousands of client requests onto a small pool of persistent backend processes.",
    code: `-- Inspect active backend processes in PostgreSQL
SELECT 
    pid, 
    usename, 
    client_addr, 
    state, 
    backend_type,
    query_start, 
    LEFT(query, 50) AS current_query
FROM pg_stat_activity
WHERE backend_type = 'client backend';

-- Check connection limit parameter
SHOW max_connections;`,
    recallHint: "PostgreSQL forks an OS process per connection; provides crash isolation but consumes 10-20MB per connection, making PgBouncer mandatory.",
    interviewTip: "Highlight that PostgreSQL chose the process model in the 1980s for UNIX reliability; explain that OS context switching between thousands of processes is why connection pooling is essential for Postgres.",
    tags: ["process-model", "postmaster", "concurrency", "pgbouncer", "memory-overhead"]
  }),

  createCard({
    idNum: 2,
    category: "Engine Architecture & Memory",
    concept: "Shared Memory Architecture (Shared Buffers, WAL Buffers, Commit Log)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is shared_buffers in PostgreSQL, and how does the engine interact with the operating system page cache?",
    quickAnswer: "`shared_buffers` is the dedicated RAM pool allocated by PostgreSQL at startup to cache table and index data pages. PostgreSQL uses a 'double buffering' architecture: queries first check `shared_buffers`; on a miss, the page is requested from the OS Page Cache (RAM), and only on a double miss is a physical disk read performed. Best practice is setting `shared_buffers` to 25% of total system RAM on dedicated database servers.",
    detailedAnswer: "PostgreSQL Shared Memory Components:\n1. `shared_buffers`: Array of 8KB page blocks. Setting it too high (> 40% RAM) degrades performance because PostgreSQL relies on the operating system kernel page cache for caching filesystem metadata and write buffering.\n2. `wal_buffers`: Memory buffer for unwritten Write-Ahead Log entries (defaults to auto-tuning, max 16MB).\n3. `clog` (Commit Log / pg_xact): Tracks transaction status (committed, aborted, in-progress) as 2-bit flags.\n\nDouble Buffering Cycle:\nDisk Page (8KB) -> OS Page Cache (Kernel RAM) -> shared_buffers (PostgreSQL RAM). This guarantees fast access, but means data can exist in both caches simultaneously.",
    code: `-- Inspect current buffer cache settings
SHOW shared_buffers;
SHOW wal_buffers;

-- Using pg_buffercache extension to inspect pages currently residing in RAM
CREATE EXTENSION IF NOT EXISTS pg_buffercache;

SELECT 
    c.relname,
    pg_size_pretty(count(*) * 8192) as buffered_size,
    round(100.0 * count(*) / (SELECT setting FROM pg_settings WHERE name='shared_buffers')::integer, 2) AS buffer_pct
FROM pg_buffercache b
JOIN pg_class c ON b.relfilenode = pg_relation_filenode(c.oid)
JOIN pg_database d ON (b.reldatabase = d.oid AND d.datname = current_database())
GROUP BY c.relname
ORDER BY count(*) DESC
LIMIT 10;`,
    recallHint: "shared_buffers caches 8KB data blocks in RAM (recommended 25% of RAM); works alongside the OS page cache (double buffering).",
    interviewTip: "Be ready to answer why `shared_buffers` is set to 25% rather than 80%: on Linux, writes go through the kernel page cache, and checkpoints rely on the OS to sort and flush dirty writes efficiently.",
    tags: ["shared_buffers", "wal_buffers", "double-buffering", "os-page-cache", "memory-tuning"]
  }),

  createCard({
    idNum: 3,
    category: "Engine Architecture & Memory",
    concept: "Postmaster and Background Daemon Processes",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the core background daemon processes that run alongside Postmaster in a PostgreSQL instance?",
    quickAnswer: "The Postmaster supervisor manages: 1. `Checkpointer` (flushes dirty pages to disk at checkpoints). 2. `Background Writer` (proactively flushes dirty pages in small batches). 3. `WAL Writer` (periodically writes WAL buffers to disk). 4. `Autovacuum Launcher & Workers` (reclaims dead tuple space and updates stats). 5. `Stats Collector` (aggregates table/index usage metrics). 6. `Archiver` (ships WAL segments to backup targets for PITR).",
    detailedAnswer: "PostgreSQL Daemon Topology:\n- `postmaster` (PID 1 of Postgres): Listens on TCP port 5432, forks backend client processes, and restarts background daemons if any fail.\n- `checkpointer`: Enforces database crash consistency by writing all dirty shared_buffers to disk and writing a checkpoint record in WAL.\n- `bgwriter` (Background Writer): Continuously finds clean buffers so backend user processes don't have to stall while writing dirty pages to disk.\n- `walwriter`: Flushes WAL data to disk periodically without waiting for explicit client `COMMIT` fsyncs.\n- `autovacuum`: Automatically launches workers to prevent transaction ID wraparound and prune dead rows.",
    code: `-- Inspect all active system background processes
SELECT 
    pid, 
    backend_type, 
    state 
FROM pg_stat_activity 
WHERE backend_type != 'client backend';

-- Check checkpoint and background writer statistics
SELECT * FROM pg_stat_bgwriter;`,
    recallHint: "Postmaster supervises Checkpointer (flushes dirty buffers), BgWriter (frees buffers), WAL Writer (writes logs), and Autovacuum (cleans bloat).",
    interviewTip: "Explain the difference between Checkpointer and BgWriter: Checkpointer writes all dirty pages at scheduled intervals for crash recovery; BgWriter constantly frees pages ahead of user queries.",
    tags: ["postmaster", "background-processes", "checkpointer", "bgwriter", "autovacuum"]
  }),

  createCard({
    idNum: 4,
    category: "Engine Architecture & Memory",
    concept: "Per-Backend Memory Allocation (work_mem, maintenance_work_mem)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does work_mem operate, and why can an improperly configured work_mem cause Out-Of-Memory (OOM) crashes?",
    quickAnswer: "`work_mem` is private memory allocated per sort/hash operation within a query, NOT per connection. A single complex query with 4 sorts and 2 hash joins can allocate `6 * work_mem`. If `work_mem` is set to 256MB and 50 concurrent clients run multi-sort queries, total memory allocation can exceed 70GB, triggering the Linux OOM Killer to terminate PostgreSQL.",
    detailedAnswer: "Memory Sizing Mechanics:\n1. `work_mem`:\n   - Used for `ORDER BY`, `DISTINCT`, `MERGE JOIN`, and Hash tables for `HASH JOIN` and `HASH AGGREGATE`.\n   - If a sort fits within `work_mem`, it executes in ultra-fast RAM (`quicksort`).\n   - If it exceeds `work_mem`, Postgres spills temporary run files to disk (`external sort`), causing 10x-100x latency degradation.\n2. `maintenance_work_mem`:\n   - Allocated for maintenance tasks: `CREATE INDEX`, `VACUUM`, `ALTER TABLE ADD FOREIGN KEY`.\n   - Can be set much higher (e.g. 1GB - 2GB) because only a few maintenance tasks run concurrently.",
    code: `-- Check current work_mem (default is typically 4MB)
SHOW work_mem;
SHOW maintenance_work_mem;

-- Increase work_mem temporarily for a single heavy reporting query:
BEGIN;
SET LOCAL work_mem = '128MB';

SELECT customer_id, SUM(amount), array_agg(item_id ORDER BY created_at)
FROM orders
GROUP BY customer_id
ORDER BY SUM(amount) DESC;

COMMIT; -- Automatically resets work_mem back to server default!`,
    recallHint: "work_mem is allocated per sort/hash node per query; setting it too high causes OOM kills. Use SET LOCAL work_mem for heavy queries.",
    interviewTip: "Emphasize that `work_mem` is per-operation, NOT per-query or per-connection. A single query with multiple sorts can allocate multiple blocks of `work_mem`.",
    tags: ["work_mem", "maintenance_work_mem", "oom-killer", "sorting", "hash-join"]
  }),

  createCard({
    idNum: 5,
    category: "Engine Architecture & Memory",
    concept: "Write-Ahead Logging (WAL) and Durability Guarantees",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the Write-Ahead Log (WAL) guarantee the Durability (ACID) property in PostgreSQL?",
    quickAnswer: "PostgreSQL enforces the Write-Ahead Logging rule: any modification to a table or index page must be written and flushed to the sequential WAL file on disk BEFORE the dirty data page itself is allowed to be written to the table file on disk. In the event of a power outage or server crash, the engine replays WAL records from the last valid checkpoint to reconstruct a consistent database state.",
    detailedAnswer: "Why WAL is Faster than Random Disk Writes:\nWriting modifications directly to table heap files requires random I/O across gigabytes of storage files. WAL converts random modifications into sequential append-only disk writes (stored in 16MB segments in `pg_wal`).\n\nCrash Recovery Sequence:\n1. Server boots after power loss.\n2. Engine reads `pg_control` to find the REDO point of the last checkpoint.\n3. The REDO phase reads WAL sequentially, re-applying all committed transactions to the heap pages (Forward Roll).\n4. Uncommitted in-flight transactions are marked as aborted in `clog`.",
    code: `-- Check current WAL position and LSN (Log Sequence Number)
SELECT pg_current_wal_lsn();

-- Force current WAL file to switch to a new segment (useful for backups)
SELECT pg_switch_wal();

-- Inspect WAL generation rate
SELECT 
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), '0/0000000')) AS total_wal_written;`,
    recallHint: "Changes must be flushed to sequential WAL before dirty table pages are written; crash recovery replays WAL from last checkpoint.",
    interviewTip: "Explain what an LSN (Log Sequence Number) is: an 8-byte integer representing the byte offset position in the WAL stream, fundamental to replication and crash recovery.",
    tags: ["wal", "durability", "acid", "crash-recovery", "lsn", "pg_wal"]
  }),

  createCard({
    idNum: 6,
    category: "Engine Architecture & Memory",
    concept: "Checkpointer Process, Dirty Pages & WAL Flush Frequency",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do checkpoints work in PostgreSQL, and how do checkpoint_completion_target and max_wal_size prevent I/O spikes?",
    quickAnswer: "A checkpoint flushes all dirty shared buffers to disk and writes a checkpoint marker into the WAL. Historically, checkpoints caused massive I/O stalls by dumping gigabytes to disk all at once. Modern PostgreSQL spreads the writes over time using `checkpoint_completion_target = 0.9`, distributing I/O smoothly across 90% of the duration between checkpoints.",
    detailedAnswer: "What Triggers a Checkpoint?\n1. Timeout: `checkpoint_timeout` elapsed (default 5 minutes; production recommendation is 15-30 minutes).\n2. Volume: WAL generated since last checkpoint exceeds `max_wal_size` (default 1GB; production recommendation 16GB-64GB).\n3. Manual: An administrator executes the `CHECKPOINT` command.\n\n`checkpoint_completion_target = 0.9`:\nIf `checkpoint_timeout = 30min`, Postgres spreads the dirty writes across 27 minutes (30 * 0.9), keeping disk write throughput smooth and predictable.",
    code: `-- Inspect checkpoint settings
SHOW checkpoint_timeout;
SHOW checkpoint_completion_target;
SHOW max_wal_size;

-- Check whether checkpoints are triggered by time or volume:
SELECT 
    checkpoints_timed, 
    checkpoints_req, 
    checkpoint_write_time, 
    checkpoint_sync_time,
    buffers_checkpoint
FROM pg_stat_bgwriter;
-- If checkpoints_req is high, max_wal_size is too small!`,
    recallHint: "checkpoint_completion_target = 0.9 spreads I/O writes smoothly across the checkpoint interval to prevent disk write freezes.",
    interviewTip: "If `checkpoints_req` is significantly higher than `checkpoints_timed` in `pg_stat_bgwriter`, your system is checkpointing because it ran out of WAL space. Increase `max_wal_size`.",
    tags: ["checkpointer", "checkpoint_completion_target", "max_wal_size", "io-tuning", "performance"]
  }),

  createCard({
    idNum: 7,
    category: "Engine Architecture & Memory",
    concept: "Background Writer (bgwriter) vs Checkpointer",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the specific architectural difference between the Background Writer (bgwriter) and the Checkpointer in PostgreSQL?",
    quickAnswer: "The Checkpointer exists for crash recovery and durability, flushing ALL dirty pages associated with transactions up to the checkpoint point. The Background Writer exists for user query latency: it runs continuously in small bursts, finding dirty pages and writing them to disk so that incoming client queries always find pre-cleaned, empty shared buffers without having to write dirty pages themselves.",
    detailedAnswer: "The Problem Without BgWriter:\nWhen a user backend executes `SELECT * FROM table`, it needs an empty buffer in `shared_buffers`. If all buffers are dirty (contain unwritten changes), the user process must stop and synchronously write the dirty page to disk before loading its desired page. This causes severe latency spikes on user queries.\n\nBgWriter Solution:\nRuns every `bgwriter_delay` (200ms). It scans shared buffers using a clock-sweep algorithm, writes a small number of dirty buffers (`bgwriter_lru_maxpages`), and cleans them so backends always have fresh buffers ready.",
    code: `-- Monitor if backend processes are forced to write dirty pages themselves:
SELECT 
    buffers_clean AS written_by_bgwriter,
    buffers_backend AS written_by_user_backends,
    buffers_backend_fsync AS backend_fsync_stalls
FROM pg_stat_bgwriter;
-- If buffers_backend is high, bgwriter is not keeping up with write traffic!`,
    recallHint: "Checkpointer writes for crash safety; BgWriter writes continuously to prevent user queries from having to write dirty buffers.",
    interviewTip: "Look at `buffers_backend` in `pg_stat_bgwriter`: if this number is growing rapidly, tuning `bgwriter_lru_multiplier` and `bgwriter_lru_maxpages` will smooth out user latency.",
    tags: ["bgwriter", "checkpointer", "shared_buffers", "clock-sweep", "latency-tuning"]
  }),

  createCard({
    idNum: 8,
    category: "Engine Architecture & Memory",
    concept: "Connection Memory Footprint & Why max_connections Must Be Constrained",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why is setting max_connections = 5000 in postgresql.conf a catastrophic antipattern in PostgreSQL?",
    quickAnswer: "Each connection spawns a dedicated OS backend process that allocates internal locks, resource arrays, and private memory (typically 10-20MB base, escalating up to hundreds of megabytes during complex sorts). 5,000 active connections can demand over 100GB of RAM, cause crippling CPU L1/L2 cache evictions, and saturate the CPU with OS scheduler context switching, bringing throughput to near-zero.",
    detailedAnswer: "Optimal Connection Sizing Formula:\n`connections = ((core_count * 2) + effective_spindle_count)`.\nA modern 16-core server performs optimally with 30-60 active connections executing concurrently.\n\nScaling Solution:\nSet `max_connections = 100 - 300` in Postgres, and put PgBouncer in front using **Transaction Pooling Mode**. PgBouncer can hold 10,000 incoming client web sockets open while multiplexing active transactions into just 30 persistent PostgreSQL backend processes.",
    code: `-- Check current connections by state
SELECT state, count(*) 
FROM pg_stat_activity 
GROUP BY state;

-- Idle connections still consume backend memory and hold open shared memory structures!
SELECT 
    count(*) FILTER (WHERE state = 'idle') AS idle_count,
    count(*) FILTER (WHERE state = 'active') AS active_count
FROM pg_stat_activity;`,
    recallHint: "Optimal DB connections = (CPU cores * 2) + disk count; set max_connections low (100-300) and use PgBouncer to multiplex 10k clients.",
    interviewTip: "Explain why thousands of idle connections degrade performance: even idle backends participate in snapshot generation and take up entries in shared memory lock tables.",
    tags: ["max_connections", "pgbouncer", "scalability", "context-switching", "resource-exhaustion"]
  }),

  createCard({
    idNum: 9,
    category: "Engine Architecture & Memory",
    concept: "System Catalogs (pg_class, pg_attribute, pg_database, pg_stat_activity)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are PostgreSQL System Catalogs, and which tables are most critical for database administration and telemetry?",
    quickAnswer: "System catalogs are PostgreSQL's internal relational tables that store database schema metadata, configurations, and runtime state. Key catalogs include: `pg_class` (tables, indexes, sequences, views), `pg_attribute` (columns and datatypes), `pg_database` (databases), `pg_namespace` (schemas), and `pg_stat_activity` (real-time active queries and locks).",
    detailedAnswer: "Crucial System Catalogs & Views:\n- `pg_class`: The heart of relational storage. Contains `relname`, `relkind` ('r' = table, 'i' = index, 'v' = view, 'p' = partition), `reltuples` (row estimates), `relpages` (8KB disk page count).\n- `pg_attribute`: Stores every column name (`attname`), data type (`atttypid`), and column index (`attnum`).\n- `pg_stat_activity`: Real-time session monitoring (PIDs, client IPs, queries, lock wait status).\n- `pg_stat_user_tables`: Dead tuple counts, sequential scan counts, and last vacuum timestamps.",
    code: `-- Inspect physical table sizes using pg_class
SELECT 
    c.relname AS table_name,
    pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
    pg_size_pretty(pg_relation_size(c.oid)) AS data_size,
    pg_size_pretty(pg_indexes_size(c.oid)) AS index_size,
    c.reltuples::bigint AS estimated_rows
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r'
ORDER BY pg_total_relation_size(c.oid) DESC;`,
    recallHint: "pg_class stores relation metadata (tables/indexes); pg_attribute stores columns; pg_stat_activity shows live queries.",
    interviewTip: "Demonstrate that you know `pg_total_relation_size()` includes table heap, indexes, and TOAST tables, while `pg_relation_size()` measures heap data only.",
    tags: ["system-catalogs", "pg_class", "pg_stat_activity", "pg_attribute", "dba-telemetry"]
  }),

  createCard({
    idNum: 10,
    category: "Engine Architecture & Memory",
    concept: "PostgreSQL Configuration Tuning Hierarchy (conf, ALTER SYSTEM, ALTER DATABASE, SET)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the precedence hierarchy of PostgreSQL configuration settings, and how does ALTER SYSTEM work?",
    quickAnswer: "Configuration precedence from lowest to highest: 1. `postgresql.conf`. 2. `ALTER SYSTEM` (writes to `postgresql.auto.conf`). 3. `ALTER DATABASE <db> SET`. 4. `ALTER ROLE <user> SET`. 5. Session-level `SET param = val`. 6. Transaction-level `SET LOCAL param = val`. `ALTER SYSTEM` allows modifying configuration parameters via SQL without direct file access on the host server.",
    detailedAnswer: "Configuration Precedence Rules:\n- `postgresql.conf`: Base file read at server startup.\n- `ALTER SYSTEM SET param = value;`: Appends to `postgresql.auto.conf`, which overrides `postgresql.conf`. Applies after calling `SELECT pg_reload_conf();` (or server restart if parameter requires it).\n- Database / Role level: Automatically sets defaults when that user logs into that database.\n- `SET LOCAL`: Scoped strictly to the current transaction; automatically resets on `COMMIT` or `ROLLBACK`.",
    code: `-- 1. Modifying system-wide configuration via SQL (requires superuser)
ALTER SYSTEM SET work_mem = '64MB';
SELECT pg_reload_conf(); -- Reloads configuration without restarting database!

-- 2. Setting parameter for a specific reporting user
ALTER ROLE reporting_user SET statement_timeout = '60000'; -- 60s max

-- 3. Setting parameter for a specific transaction
BEGIN;
SET LOCAL statement_timeout = '5000'; -- 5s timeout for this transaction only
SELECT * FROM heavy_table;
COMMIT;`,
    recallHint: "Precedence: SET LOCAL > SET session > ALTER ROLE > ALTER DATABASE > ALTER SYSTEM (auto.conf) > postgresql.conf.",
    interviewTip: "Warn about `ALTER SYSTEM`: it writes to `postgresql.auto.conf`. If you modify `postgresql.conf` later, your changes will be silently overridden by `postgresql.auto.conf`.",
    tags: ["configuration", "alter-system", "pg_reload_conf", "set-local", "precedence"]
  }),

  createCard({
    idNum: 11,
    category: "Engine Architecture & Memory",
    concept: "Transaction Commit Protocol & synchronous_commit Trade-Offs",
    priority: "must-know",
    difficulty: "advanced",
    question: "What does synchronous_commit control, and when is it safe to set synchronous_commit = off?",
    quickAnswer: "`synchronous_commit = on` (default) guarantees that a transaction's WAL records are physically flushed to disk via `fsync` before the server returns success to the client. Setting `synchronous_commit = off` allows asynchronous commits: transactions return instantly, and WAL buffers flush to disk in the background (~every 200ms), increasing write throughput by 3x-10x at the cost of losing up to ~200ms of data during a crash (database consistency is never corrupted).",
    detailedAnswer: "Durability vs Throughput:\n- `on`: Maximum durability. If power fails, committed transactions are guaranteed on disk. Disk `fsync` latency dictates transaction throughput.\n- `off`: High throughput. When the client receives commit confirmation, data is in WAL memory buffers. If the server loses power, the last ~100-200ms of transactions might be lost. CRITICAL: The database will NOT be corrupted; on restart, it recovers cleanly to a consistent state, merely losing the trailing un-flushed commits.\n- Use Cases for `off`: Bulk inserts, analytics tracking, IoT sensor data, user session clicks.",
    code: `-- Set asynchronous commit for the current session or transaction
SET LOCAL synchronous_commit = off;

-- High-throughput bulk insert (3x-5x faster write throughput)
INSERT INTO telemetry_events (device_id, payload, recorded_at)
VALUES ('sensor_99', '{"temp": 24.2}', now());

-- Verification in system settings
SHOW synchronous_commit;`,
    recallHint: "synchronous_commit = off trades the last ~200ms of data during a crash for a 3x-10x write speedup; never corrupts database integrity.",
    interviewTip: "Highlight that `synchronous_commit = off` does NOT cause database corruption. It only introduces a small window of data loss for the most recent transactions.",
    tags: ["synchronous_commit", "durability", "fsync", "wal-flush", "write-throughput"]
  }),

  createCard({
    idNum: 12,
    category: "Engine Architecture & Memory",
    concept: "PostgreSQL Disk File Layout (Base Directory, OIDs, Tablespaces & Relnodes)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does PostgreSQL map relational tables and indexes to physical files on the operating system filesystem?",
    quickAnswer: "PostgreSQL stores data in the data directory (`$PGDATA/base/<db_oid>/<relfilenode>`). Tables and indexes are split into physical 1GB segment files (`relfilenode`, `relfilenode.1`, `relfilenode.2`). Each file contains sequential 8KB pages. The mapping from table name to file on disk is tracked in `pg_class.relfilenode`.",
    detailedAnswer: "PostgreSQL Storage Hierarchy:\n1. `$PGDATA/base/`: Contains subdirectories named after database OIDs (`pg_database.oid`).\n2. `relfilenode`: The physical filename on disk. When an operation rewrites a table (`VACUUM FULL`, `TRUNCATE`, `CLUSTER`), the table OID remains identical, but the `relfilenode` changes to a new number.\n3. Segment Files: When a table exceeds 1GB (default segment size), Postgres splits it into `16384`, `16384.1`, `16384.2` to support operating systems with file size limits.\n4. Fork Files:\n   - Main fork: The raw table/index data.\n   - `_fsm` (Free Space Map): Tracks free space in 8KB pages.\n   - `_vm` (Visibility Map): Tracks pages with no dead tuples (used by Index-Only Scans and Vacuum).",
    code: `-- Find the physical file path of a table on the server disk
SELECT 
    d.datname AS database,
    c.relname AS table_name,
    c.oid AS table_oid,
    c.relfilenode AS current_filenode,
    pg_relation_filepath(c.oid) AS full_relative_disk_path
FROM pg_class c
JOIN pg_database d ON d.datname = current_database()
WHERE c.relname = 'orders';
-- Output: base/16384/24576`,
    recallHint: "Data files live at base/<db_oid>/<relfilenode>; split into 1GB segments; _fsm tracks free space, _vm tracks visibility.",
    interviewTip: "Explain why `relfilenode` is different from `oid`: DDL operations like `TRUNCATE` or `VACUUM FULL` create a new physical file on disk with a new `relfilenode` while preserving the table's stable `oid`.",
    tags: ["disk-layout", "pgdata", "relfilenode", "visibility-map", "free-space-map"]
  })
];

module.exports = cards;
