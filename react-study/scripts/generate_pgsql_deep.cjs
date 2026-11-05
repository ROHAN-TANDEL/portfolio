const fs = require("fs");
const path = require("path");

const deepChapters = [
  {
    id: "pg-deep-01",
    title: "PostgreSQL Process Model, Shared Memory Architecture & Buffer Management",
    category: "Engine Architecture & Memory",
    readTimeMinutes: 18,
    overview: "Unlike threaded databases, PostgreSQL employs a robust UNIX process-per-connection architecture orchestrated by the Postmaster daemon. This chapter dives into the physical memory structure of PostgreSQL: shared memory regions (shared_buffers, WAL buffers, commit log), backend-private process memory (work_mem, maintenance_work_mem), the Clock-Sweep page replacement algorithm, and double-buffering interactions with the Linux kernel page cache.",
    diagram: `+-------------------------------------------------------------------------+
|                  POSTGRESQL MEMORY & PROCESS TOPOLOGY                   |
+-------------------------------------------------------------------------+
|                                                                         |
|  CLIENTS                   POSTGRESQL SERVER                            |
|  +--------+  TCP 5432      +-----------------------------------------+  |
|  | Client |--------------->| Postmaster Listener (forks workers)     |  |
|  +--------+                +--------------------+--------------------+  |
|                                                 | fork()                |
|  +----------------------------------------------v--------------------+  |
|  | Dedicated Backend Processes (postgres: app_user db [local])       |  |
|  | - Backend 1 Private RAM: [work_mem] [temp_buffers]                |  |
|  | - Backend 2 Private RAM: [work_mem] [temp_buffers]                |  |
|  | - Backend N Private RAM: [work_mem] [temp_buffers]                |  |
|  +--------------------------------------+----------------------------+  |
|                                         | IPC (Shared Memory)           |
|  +--------------------------------------v----------------------------+  |
|  | SHARED MEMORY SEGMENT (POSIX / mmap)                              |  |
|  | +---------------------------------------------------------------+ |  |
|  | | shared_buffers (25% System RAM)                               | |  |
|  | | - Array of 8KB Page Buffers + Buffer Descriptors              | |  |
|  | | - Clock-Sweep Buffer Eviction Hand (usage_count 0 to 5)       | |  |
|  | +---------------------------------------------------------------+ |  |
|  | | wal_buffers (16MB)       | Commit Log (clog / pg_xact)         | |  |
|  | | Lock Manager Hash Table  | ProcArray & Dynamic Latch Tables    | |  |
|  | +---------------------------------------------------------------+ |  |
|  +--------------------------------------+----------------------------+  |
|                                         | write() / fsync()             |
|  +--------------------------------------v----------------------------+  |
|  | OPERATING SYSTEM KERNEL                                           |  |
|  | - OS Page Cache (Kernel RAM: Double Buffering)                    |  |
|  +--------------------------------------+----------------------------+  |
|                                         | Disk Controller I/O           |
|  +--------------------------------------v----------------------------+  |
|  | STORAGE HARDWARE (NVMe SSD / EBS Volumes)                         |  |
|  | - $PGDATA/base/ (Table & Index data files in 1GB segments)        |  |
|  | - $PGDATA/pg_wal/ (16MB Write-Ahead Log segments)                 |  |
|  +-------------------------------------------------------------------+  |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Process-Per-Connection Mechanics and the Postmaster Lifecycle",
        explanation: "When a client initiates a connection, the `postmaster` daemon intercepts the TCP socket, performs authentication, and invokes `fork()` to spawn an independent OS process (`postgres`). Because each backend process has its own address space, a memory fault or segmentation violation in a user query isolates the failure to that single connection rather than crashing the database instance. However, this model consumes roughly 10MB to 20MB of physical RAM per connection for process control blocks, execution plan trees, and connection state. If connection counts scale into the thousands without a pooler, CPU context switching completely saturates the server.",
        codeExample: `-- Monitor OS processes and memory consumption per connection
SELECT 
    pid, 
    usename, 
    client_addr, 
    state, 
    wait_event_type, 
    wait_event, 
    now() - query_start AS active_duration,
    query
FROM pg_stat_activity
WHERE backend_type = 'client backend';`
      },
      {
        subheading: "2. The Clock-Sweep Page Eviction Algorithm in shared_buffers",
        explanation: "PostgreSQL manages cached 8KB relation blocks in `shared_buffers` using the Clock-Sweep replacement algorithm. Each buffer descriptor has a `usage_count` ranging from 0 to 5. When a page is accessed, its `usage_count` is incremented. When free space is needed, a clock hand sweeps through buffer headers: if `usage_count > 0`, it decrements the count by 1 and moves to the next; if `usage_count == 0` and the buffer is unpinned and clean, that page is chosen for eviction. This gives frequently accessed tables (hot working sets) high resistance against eviction while sweeping away one-off sequential table scan blocks.",
        codeExample: `-- Inspecting the shared buffer cache with pg_buffercache
CREATE EXTENSION IF NOT EXISTS pg_buffercache;

SELECT 
    c.relname,
    pg_size_pretty(count(*) * 8192) as ram_cached_size,
    round(avg(b.usagecount), 2) as avg_popularity_score
FROM pg_buffercache b
JOIN pg_class c ON b.relfilenode = pg_relation_filenode(c.oid)
JOIN pg_database d ON (b.reldatabase = d.oid AND d.datname = current_database())
GROUP BY c.relname
ORDER BY count(*) DESC
LIMIT 10;`
      },
      {
        subheading: "3. Double Buffering: shared_buffers and the OS Kernel Page Cache",
        explanation: "PostgreSQL uses standard buffered I/O rather than Direct I/O (`O_DIRECT`). When PostgreSQL reads a block from disk, the Linux kernel loads it into the kernel OS Page Cache, and PostgreSQL copies it into `shared_buffers`. Consequently, data can exist simultaneously in both memory pools. This is why `shared_buffers` is recommended at 25% of total system RAM on dedicated database servers (rather than 80%): PostgreSQL leaves the remaining 75% for backend private memory (`work_mem`) and the Linux kernel page cache, which sorts and flushes dirty writes during checkpoints efficiently.",
        codeExample: `-- Configure shared_buffers in postgresql.conf or ALTER SYSTEM
-- Recommended: 25% of Total Physical RAM
ALTER SYSTEM SET shared_buffers = '8GB'; -- on a 32GB server
ALTER SYSTEM SET effective_cache_size = '24GB'; -- guides planner on available RAM
SELECT pg_reload_conf();`
      }
    ],
    edgeCasesAndPitfalls: [
      "Setting `shared_buffers` above 40-50% of system RAM often degrades performance on Linux due to double-buffering memory pressure and checkpoint write stalls.",
      "Spawning thousands of direct connections exhausts OS memory descriptors; PgBouncer in transaction mode is mandatory for high-scale applications.",
      "Work memory (`work_mem`) is allocated per sort/hash operation within a query node, meaning a single query with 4 joins and 2 sorts can allocate 6x `work_mem`."
    ],
    keyTakeaways: [
      "PostgreSQL uses an OS process-per-connection architecture, providing crash isolation at the cost of connection memory overhead.",
      "shared_buffers caches 8KB blocks using a Clock-Sweep algorithm with usage counts 0 to 5.",
      "PostgreSQL relies on the OS kernel page cache for asynchronous write sorting and secondary caching (double buffering)."
    ]
  },

  {
    id: "pg-deep-02",
    title: "MVCC Snapshot Isolation, Tuple Layout & The Heap-Only Tuples (HOT) Engine",
    category: "MVCC & Storage Engine",
    readTimeMinutes: 20,
    overview: "PostgreSQL implements Multi-Version Concurrency Control (MVCC) without using rollback/undo logs. Every row (tuple) written to disk carries transaction header metadata. This chapter dissects physical 8KB page internals, tuple header structure (xmin, xmax, infomasks, ctid), out-of-place update mechanics, and the Heap-Only Tuples (HOT) engine that prevents index bloat.",
    diagram: `+-------------------------------------------------------------------------+
|                  HEAP TUPLE LIFECYCLE & HOT OPTIMIZATION                |
+-------------------------------------------------------------------------+
|                                                                         |
|  STANDARD UPDATE (NON-HOT) -> Write Amplification                      |
|  +---------------------------------+  +-------------------------------+ |
|  | B-TREE INDEX                    |  | 8KB HEAP DATA PAGE 0          | |
|  | - Key: 'alex' -> ctid: (0, 1)   |  | Line Pointer 1 -> Tuple 1     | |
|  | - Key: 'alex' -> ctid: (0, 2)   |  | [xmin: 100 | xmax: 105] (DEAD)| |
|  +---------------------------------+  +-------------------------------+ |
|    (New index entry required!)        | Line Pointer 2 -> Tuple 2     | |
|                                       | [xmin: 105 | xmax: 0  ] (LIVE)| |
|                                       +-------------------------------+ |
|                                                                         |
|  HOT UPDATE (Heap-Only Tuple) -> ZERO Index Modifications               |
|  +---------------------------------+  +-------------------------------+ |
|  | B-TREE INDEX                    |  | 8KB HEAP DATA PAGE 0          | |
|  | - Key: 'alex' -> ctid: (0, 1)   |  | Line Pointer 1 (LP_REDIRECT)  | |
|  +---------------------------------+  |   | (Redirects to Line Ptr 2) | |
|    (Index remains 100% UNTOUCHED!)    |   v                           | |
|                                       | Line Pointer 2                | |
|                                       | [xmin: 105 | xmax: 0  ] (LIVE)| |
|                                       +-------------------------------+ |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Tuple Header Architecture & MVCC Visibility Verification",
        explanation: "Every row in a PostgreSQL table file is prefixed with a 23-byte `HeapTupleHeaderData` containing `t_xmin` (the transaction that inserted the row), `t_xmax` (the transaction that deleted or updated the row), and `t_ctid` (the physical block and offset of the tuple, or of its replacement version). When a query executes, it obtains an MVCC snapshot composed of `xmin:xmax:xip_list`. To determine whether a row is visible, PostgreSQL checks the creating `xmin` against the snapshot and `pg_xact` (the commit log). If `xmin` is committed and prior to the snapshot's minimum active horizon, and `xmax` is either 0 or uncommitted, the tuple is deemed visible.",
        codeExample: `-- Inspecting tuple system attributes directly
SELECT 
    ctid, 
    xmin, 
    xmax, 
    id, 
    email 
FROM users 
LIMIT 5;`
      },
      {
        subheading: "2. The Append-Only Update Mechanism & Dead Tuple Genesis",
        explanation: "PostgreSQL does not update rows in place. When an `UPDATE` executes, the engine sets `xmax` on the existing tuple to the current transaction ID (marking it logically dead once the transaction commits), and appends a completely new physical tuple with `xmin` set to the current transaction ID and `xmax` set to 0. The old tuple's `ctid` is updated to point forward to the new tuple's physical block and offset coordinates. These obsolete row versions remain on disk as 'dead tuples' until vacuumed.",
        codeExample: `-- Observing ctid progression across updates
CREATE TABLE demo_update (id INT PRIMARY KEY, val TEXT);
INSERT INTO demo_update VALUES (1, 'initial');
SELECT ctid, xmin, xmax FROM demo_update; -- (0, 1)

UPDATE demo_update SET val = 'revised' WHERE id = 1;
SELECT ctid, xmin, xmax FROM demo_update; -- (0, 2) - New physical tuple slot!`
      },
      {
        subheading: "3. Heap-Only Tuples (HOT) & Fillfactor Optimization",
        explanation: "In standard updates, every index on the table must add an entry pointing to the new `ctid`, leading to rapid index bloat. Heap-Only Tuples (HOT) bypasses this completely if: 1) no indexed columns were modified, and 2) the data page containing the old tuple has enough free space to hold the new tuple. The original line pointer is converted into an `LP_REDIRECT` pointer that directs queries to the new tuple slot inside the same page. The B-Tree index continues pointing to the original line pointer, requiring ZERO index updates. Setting a table's `fillfactor` to 80-90 reserves 10-20% free space per page for HOT updates.",
        codeExample: `-- Table optimized for high-frequency counter/status updates with HOT
CREATE TABLE session_states (
    session_id UUID PRIMARY KEY,
    last_ping TIMESTAMPTZ NOT NULL,
    active_status TEXT NOT NULL
) WITH (fillfactor = 85);

-- Check HOT update efficiency ratio
SELECT 
    relname, 
    n_tup_upd, 
    n_tup_hot_upd,
    round(100.0 * n_tup_hot_upd / nullif(n_tup_upd, 0), 2) as hot_ratio_pct
FROM pg_stat_user_tables
WHERE relname = 'session_states';`
      }
    ],
    edgeCasesAndPitfalls: [
      "Updating even a single indexed column instantly disqualifies an update from HOT optimization, forcing index writes across all table indexes.",
      "If a page has 100% fillfactor, inserts pack pages completely, making HOT updates impossible and inducing index bloat.",
      "The physical `ctid` can change at any time due to updates or VACUUM FULL, so it must never be used as a persistent identifier."
    ],
    keyTakeaways: [
      "PostgreSQL uses out-of-place append-only updates; old tuples remain on disk as dead tuples until vacuumed.",
      "HOT updates allow updates without index modifications when new tuples fit in the same 8KB page and no indexed columns change.",
      "Lowering fillfactor to 80-90 on update-heavy tables enables HOT and eliminates index bloat."
    ]
  },

  {
    id: "pg-deep-03",
    title: "Write-Ahead Logging (WAL), Checkpoints & Crash Recovery Internals",
    category: "Durability & Recovery",
    readTimeMinutes: 18,
    overview: "Durability in PostgreSQL is achieved through the Write-Ahead Logging (WAL) protocol: no data page is ever written to physical disk until the corresponding WAL change record has been flushed to persistent storage. This chapter explores WAL buffers, Log Sequence Numbers (LSN), the Checkpointer daemon, spread checkpoints, and crash recovery replay.",
    diagram: `+-------------------------------------------------------------------------+
|                  WRITE-AHEAD LOGGING & CHECKPOINT LIFECYCLE             |
+-------------------------------------------------------------------------+
|                                                                         |
|  1. Client executes UPDATE                                              |
|     |                                                                   |
|     +---> Writes WAL record to [wal_buffers] in shared memory           |
|     +---> Modifies 8KB data page in [shared_buffers] (Marks it DIRTY)   |
|                                                                         |
|  2. COMMIT executes                                                     |
|     |                                                                   |
|     +---> walwriter / backend calls fsync() on $PGDATA/pg_wal/00000001  |
|     +---> COMMIT acknowledged to client! (Data page remains in RAM!)    |
|                                                                         |
|  3. Checkpointer Daemon Wakes Up (checkpoint_timeout = 15min)           |
|     |                                                                   |
|     +---> Creates checkpoint redo record with current LSN               |
|     +---> Gathers all DIRTY pages from shared_buffers                   |
|     +---> Smoothly spreads writes over (checkpoint_completion_target)   |
|     +---> Calls fsync() on all data files                               |
|     +---> Recycles old WAL segments prior to redo LSN                   |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The WAL Protocol & The Log Sequence Number (LSN)",
        explanation: "Every modification in PostgreSQL (inserts, updates, deletes, index splits) is serialized into an append-only WAL stream in 16MB file segments. Every WAL record receives a monotonically increasing 64-bit integer called a Log Sequence Number (LSN), representing byte offsets in the log. Every 8KB page header in `shared_buffers` stores the `pd_lsn` of the last WAL record that modified it. When a transaction commits, PostgreSQL only needs to flush the WAL records up to the commit LSN to disk using `fsync()`. The actual dirty data pages remain in RAM, dramatically speeding up write latency.",
        codeExample: `-- Check current write LSN and WAL segment file
SELECT 
    pg_current_wal_lsn(),
    pg_walfile_name(pg_current_wal_lsn());

-- Measure WAL generation between two points in time
SELECT pg_wal_lsn_diff(
    pg_current_wal_lsn(), 
    '0/1A00000'::pg_lsn
) AS bytes_generated;`
      },
      {
        subheading: "2. The Checkpointer Daemon & Spread Checkpoint Tuning",
        explanation: "Because dirty pages stay in RAM, a server crash would require replaying all WAL records since the beginning of time. A Checkpoint creates a known consistent point on disk: the Checkpointer flushes all dirty pages currently in `shared_buffers` to disk and records a redo LSN. On crash, recovery starts strictly from the last checkpoint's redo LSN. To prevent massive I/O write spikes that freeze client queries, PostgreSQL uses 'spread checkpoints': `checkpoint_completion_target = 0.9` instructs the checkpointer to throttle and spread page writes over 90% of the `checkpoint_timeout` interval.",
        codeExample: `-- Production Checkpoint Configuration (postgresql.conf)
-- Smoothly spread checkpoint I/O over 15 minutes
ALTER SYSTEM SET checkpoint_timeout = '15min';
ALTER SYSTEM SET checkpoint_completion_target = 0.9;
ALTER SYSTEM SET max_wal_size = '16GB';
ALTER SYSTEM SET min_wal_size = '2GB';
SELECT pg_reload_conf();

-- Inspect checkpoint frequency and write timings
SELECT * FROM pg_stat_checkpointer; -- PG 17+ or pg_stat_bgwriter in earlier versions`
      },
      {
        subheading: "3. Synchronous Commit Trade-offs and Transaction Latency",
        explanation: "By default, `synchronous_commit = on`, meaning PostgreSQL blocks the client until the commit WAL record is physically persisted to disk via `fsync()`. In ultra-high-throughput systems where losing the last few milliseconds of data during a crash is acceptable (e.g. telemetry, web analytics, cache invalidations), setting `synchronous_commit = off` allows PostgreSQL to return immediately after writing to `wal_buffers`, batching WAL disk flushes via `walwriter`. This can increase write throughput by 500% with zero risk of database corruption (consistency is preserved, only the last ~200ms of committed transactions might be lost on crash).",
        codeExample: `-- Set synchronous_commit off for a high-volume logging session
BEGIN;
SET LOCAL synchronous_commit = off;
INSERT INTO telemetry_logs (device_id, payload) VALUES (101, '{"ping": true}');
COMMIT; -- Returns in 0.1ms without waiting for disk fsync!`
      }
    ],
    edgeCasesAndPitfalls: [
      "Leaving `checkpoint_completion_target` at the historical default of 0.5 causes intense I/O saturation during the first half of the checkpoint window.",
      "If `max_wal_size` is too small, checkpoints are triggered by WAL volume rather than time, leading to checkpoint thrashing.",
      "An unconsumed replication slot prevents WAL segment recycling, eventually filling 100% of the primary server's disk."
    ],
    keyTakeaways: [
      "WAL guarantees durability by flushing sequential log records to disk before modifying actual data pages.",
      "Checkpoints flush dirty pages from shared_buffers to establish a clean crash recovery baseline.",
      "Spread checkpoints (completion_target = 0.9) eliminate disk write spikes."
    ]
  },

  {
    id: "pg-deep-04",
    title: "Deep Indexing Internals: B-Tree, GIN Inverted Indexes, GiST & BRIN Block Ranges",
    category: "Index Architectures",
    readTimeMinutes: 20,
    overview: "PostgreSQL provides six distinct index algorithms, each optimized for specific mathematical access patterns. This chapter covers the internal data structures of high-concurrency Lehman-Yao B-Trees, inverted posting trees in GIN, multi-dimensional bounding boxes in GiST, and block-range summaries in BRIN.",
    diagram: `+-------------------------------------------------------------------------+
|                  POSTGRESQL INDEX ACCESS ENGINE TOPOLOGY                |
+-------------------------------------------------------------------------+
|                                                                         |
|  B-TREE (Lehman-Yao)          GIN (Inverted Index)                      |
|  [Root Page]                  [Inverted Lexeme Keys] -> Posting Tree    |
|      |                        - 'docker' -> [ctid 1, ctid 4, ctid 9]    |
|      v                        - 'linux'  -> [ctid 4, ctid 12, ctid 90]  |
|  [Internal Branch Pages]      - 'k8s'    -> [B-Tree Posting Tree...]    |
|      |                        (Fastupdate buffers writes in RAM)        |
|      v                                                                  |
|  [Leaf Pages: Sibling links]  BRIN (Block Range Index)                  |
|  [Key: 10 | ctid: (0, 1)] ->  - Block Range 0-127:   [min: 1, max: 980] |
|  [Key: 20 | ctid: (0, 4)] ->  - Block Range 128-255: [min: 981, max: 2K]|
|  (Supports <, <=, =, >=, >)   (99% smaller footprint for sorted data)   |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Lehman & Yao High-Concurrency B-Trees and Deduplication",
        explanation: "PostgreSQL's B-Tree implements the Lehman-Yao algorithm, where each internal and leaf node stores a 'high key' and a pointer to its right-hand sibling. If an index page splits concurrently while another transaction is traversing it, the searching transaction does not get stuck or require lock restarts; it simply follows the right sibling link. In PostgreSQL 13+, B-Tree deduplication automatically collapses repeated key values into a single index tuple followed by a compact posting list of `ctid`s, reducing index size by up to 70% for low-cardinality status or enum columns.",
        codeExample: `-- Inspecting B-Tree page structure with pageinspect
CREATE EXTENSION IF NOT EXISTS pageinspect;
SELECT * FROM bt_metap('idx_users_email');
SELECT * FROM bt_page_stats('idx_users_email', 1);`
      },
      {
        subheading: "2. GIN (Generalized Inverted Index) & Fastupdate Architecture",
        explanation: "GIN indexes map individual component elements (JSONB keys/values, array members, full-text lexemes) to lists of row IDs (`ctid`). If an element matches few rows, it uses an in-line array (Posting List); if it matches millions of rows, it promotes to an internal B-Tree (Posting Tree). Because updating GIN indexes causes severe write amplification (a single document insert touches dozens of index entries), GIN features `fastupdate`: incoming writes are buffered into a simple pending list in shared memory and merged asynchronously by autovacuum.",
        codeExample: `-- GIN index on tags array with fastupdate controls
CREATE INDEX idx_posts_tags ON posts USING gin (tags);

-- Manually flushing the GIN pending list
SELECT gin_clean_pending_list('idx_posts_tags');

-- For high-write JSONB where read latency must be predictable:
ALTER INDEX idx_posts_tags SET (fastupdate = off);`
      },
      {
        subheading: "3. BRIN (Block Range Index) for Multi-Terabyte Append-Only Data",
        explanation: "BRIN does not index individual rows. Instead, it summarizes physical disk page blocks (by default 128 blocks = 1MB of table heap) by recording only two values: the minimum and maximum values of the indexed column within that block range. When a query filters on `recorded_at`, BRIN scans its tiny index and visits only the block ranges whose `[min, max]` envelope encompasses the search value. For append-only time-series data with high physical correlation (`pg_stats.correlation > 0.95`), a 50GB table index shrinks from 10GB to 500KB.",
        codeExample: `-- Verifying correlation before creating BRIN
SELECT attname, correlation 
FROM pg_stats 
WHERE tablename = 'sensor_events' AND attname = 'logged_at';

-- Create BRIN index with 64 pages per range
CREATE INDEX idx_sensor_events_brin 
ON sensor_events USING brin (logged_at) 
WITH (pages_per_range = 64);`
      }
    ],
    edgeCasesAndPitfalls: [
      "Creating a BRIN index on a table where data is randomly inserted (correlation near 0) results in BRIN scanning every block range, degrading to a full sequential scan.",
      "The GIN `fastupdate` pending list can cause sudden query latency spikes when the buffer exceeds `gin_pending_list_limit` and flushes during an active user query.",
      "Unique constraints cannot be enforced with GIN, GiST (without btree_gist), or BRIN; B-Trees are mandatory for uniqueness."
    ],
    keyTakeaways: [
      "B-Tree is the default for general 1-dimensional queries and uniqueness enforcement.",
      "GIN is an inverted index optimal for JSONB, arrays, and full-text search.",
      "BRIN offers 99% smaller storage footprints for naturally sorted time-series datasets."
    ]
  },

  {
    id: "pg-deep-05",
    title: "Vacuuming, Dead Tuple Reclaim, Table Bloat & Anti-Wraparound Freezing",
    category: "Maintenance & Engine Health",
    readTimeMinutes: 20,
    overview: "Because PostgreSQL uses out-of-place MVCC updates, table and index bloat are natural consequences of database operations. This chapter investigates the inner workings of the autovacuum daemon, cost-based I/O throttling, dead tuple reclamation, the Free Space Map (FSM), the Visibility Map (VM), and the 32-bit transaction ID wraparound freeze catastrophe.",
    diagram: `+-------------------------------------------------------------------------+
|                  AUTOVACUUM & XID FREEZING LIFECYCLE                    |
+-------------------------------------------------------------------------+
|                                                                         |
|  AUTOVACUUM TRIGGER FORMULA:                                            |
|  Threshold = autovacuum_vacuum_threshold (50)                           |
|            + autovacuum_vacuum_scale_factor (0.2) * n_live_tup          |
|                                                                         |
|  COST THROTTLE:                                                         |
|  - Reads/Writes accumulate IO cost                                      |
|  - When cost reaches [autovacuum_vacuum_cost_limit] -> sleep (cost_delay)|
|                                                                         |
|  32-BIT TRANSACTION ID WRAPAROUND:                                      |
|  0 ------------------ 2 Billion (Past) -------- [Current XID] -------- 4 Billion
|  ^                         ^                                            |
|  |                         |                                            |
|  FrozenTransactionId (2)   Anti-Wraparound Autovacuum triggers         |
|  (Marked permanently past) (autovacuum_freeze_max_age = 200M)           |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Autovacuum Daemon Architecture and Tuning Formulas",
        explanation: "The autovacuum launcher daemon wakes up periodically and checks tables against the trigger threshold formula: `n_dead_tup > threshold + (scale_factor * n_live_tup)`. The default `scale_factor = 0.2` (20%) means a 50-million row table will not be vacuumed until 10 million rows are dead! In high-throughput production, `scale_factor` must be lowered to 0.01-0.05, and `autovacuum_vacuum_cost_limit` raised from 200 to 1000-2000 on modern NVMe SSDs so workers can complete maintenance without excessive throttling.",
        codeExample: `-- Tuning autovacuum on high-write table
ALTER TABLE orders SET (
    autovacuum_vacuum_scale_factor = 0.02, -- Trigger at 2% dead rows
    autovacuum_vacuum_threshold = 1000,
    autovacuum_vacuum_cost_limit = 1000,   -- Higher IO budget per cycle
    autovacuum_vacuum_cost_delay = 2       -- 2ms sleep
);`
      },
      {
        subheading: "2. The Visibility Map (VM) and Free Space Map (FSM) Forks",
        explanation: "Every table relation has two auxiliary file forks: `_fsm` and `_vm`. The Free Space Map tracks available free bytes across 8KB pages to accelerate new inserts. The Visibility Map stores two bits per 8KB page: 'all-visible' (all tuples are visible to all current transactions) and 'all-frozen' (all tuples on the page are frozen). When pages are marked 'all-visible', PostgreSQL skips reading the table heap entirely during Index-Only Scans, reading values directly from the index. When pages are marked 'all-frozen', autovacuum skips scanning them entirely.",
        codeExample: `-- Inspecting forks and Visibility Map
SELECT 
    pg_size_pretty(pg_relation_size('orders', 'main')) as data_size,
    pg_size_pretty(pg_relation_size('orders', 'fsm'))  as fsm_size,
    pg_size_pretty(pg_relation_size('orders', 'vm'))   as vm_size;`
      },
      {
        subheading: "3. Transaction ID (XID) Wraparound & Anti-Wraparound Freezing",
        explanation: "PostgreSQL uses 32-bit transaction IDs, allowing roughly 4.29 billion transactions. PostgreSQL treats XIDs circularly modulo 2^31: 2 billion transactions are in the past, and 2 billion are in the future. If a database runs for 2 billion transactions without freezing old rows, past rows appear to be in the future, rendering data invisible! Vacuum prevents this by replacing the `xmin` of old committed rows with `FrozenTransactionId` (XID 2) or setting the `HEAP_XMIN_FROZEN` bit. If database age approaches 2 billion, PostgreSQL halts writes and forces single-user mode.",
        codeExample: `-- Monitoring database age towards wraparound emergency (2 billion limit)
SELECT 
    datname, 
    age(datfrozenxid) as xid_age,
    2000000000 - age(datfrozenxid) as xids_remaining
FROM pg_database
ORDER BY xid_age DESC;`
      }
    ],
    edgeCasesAndPitfalls: [
      "Long-running transactions or abandoned replication slots prevent autovacuum from cleaning dead tuples, causing severe database-wide bloat.",
      "Running `VACUUM FULL` acquires an `ACCESS EXCLUSIVE` lock that blocks all client reads and writes for the duration of the rebuild.",
      "Default autovacuum cost settings are throttled for slow HDDs from 2005; failing to tune them on NVMe SSDs causes vacuum workers to fall hopelessly behind."
    ],
    keyTakeaways: [
      "Autovacuum removes dead tuples, updates FSM/VM maps, and freezes transaction IDs.",
      "Tune scale factor down (0.02) and cost limit up (1000+) on modern hardware.",
      "Monitor `age(datfrozenxid)` to prevent catastrophic 32-bit wraparound database shutdown."
    ]
  },

  {
    id: "pg-deep-06",
    title: "Advanced Query Planner Internals: Cost Model, Join Strategies & Statistics Engine",
    category: "Query Planner & Optimization",
    readTimeMinutes: 20,
    overview: "PostgreSQL's cost-based query optimizer plans SQL queries by evaluating millions of theoretical execution paths and estimating their execution costs. This chapter explores the cost constants, the statistical sampling engine (`pg_stats`), Most Common Values (MCVs), histogram buckets, join order permutations, and the differences between Nested Loop, Hash Join, and Merge Join.",
    diagram: `+-------------------------------------------------------------------------+
|                  QUERY PLANNER & OPTIMIZER ARCHITECTURE                 |
+-------------------------------------------------------------------------+
|                                                                         |
|  SQL QUERY -> Parser -> Rewriter (Views, RLS)                           |
|     |                                                                   |
|     v                                                                   |
|  QUERY OPTIMIZER (Cost-Based Engine)                                    |
|  +-------------------------------------------------------------------+  |
|  | Consults pg_statistic (via pg_stats):                             |  |
|  | - n_distinct, null_frac, correlation                              |  |
|  | - Most Common Values (MCVs) & Frequencies                         |  |
|  | - Histogram Bounds (Splits values into equal-frequency buckets)   |  |
|  +-------------------------------------------------------------------+  |
|  | Cost Formulas:                                                    |  |
|  | Total Cost = (Page Reads * page_cost) + (Tuple Checks * cpu_cost) |  |
|  | - random_page_cost (default 4.0 -> tune to 1.1 on SSD)            |  |
|  | - seq_page_cost (1.0)                                             |  |
|  +-------------------------------------------------------------------+  |
|     |                                                                   |
|     +---> Chooses Scan Method: Seq Scan / Index Scan / Bitmap Scan      |
|     +---> Chooses Join Method: Nested Loop / Hash Join / Merge Join     |
|     |                                                                   |
|     v                                                                   |
|  EXECUTOR (Dispatches chosen plan using Volcano Iterator Model)         |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Cost Model and Hardware Calibration on SSDs",
        explanation: "The query planner computes costs in arbitrary units where `seq_page_cost = 1.0` represents reading one 8KB page sequentially. In the spinning-disk era, random disk head seeks were 4x slower, giving `random_page_cost = 4.0`. On modern cloud NVMe SSDs (AWS GP3, io2), random seeks have virtually no latency penalty. Leaving `random_page_cost = 4.0` tricks the planner into assuming index scans are expensive, leading it to mistakenly choose slow sequential scans. Lowering `random_page_cost` to 1.1 immediately restores optimal index usage.",
        codeExample: `-- Tuning cost constants for NVMe SSD storage
ALTER SYSTEM SET random_page_cost = 1.1;
ALTER SYSTEM SET cpu_tuple_cost = 0.01;
ALTER SYSTEM SET cpu_index_tuple_cost = 0.005;
SELECT pg_reload_conf();`
      },
      {
        subheading: "2. The Statistics Engine: MCVs, Histograms & Correlation",
        explanation: "During `ANALYZE`, PostgreSQL samples 30,000 table pages and populates `pg_statistic`. It stores: 1) `null_frac`; 2) `n_distinct`; 3) Most Common Values (`most_common_vals`) with exact frequencies; 4) `histogram_bounds` for range queries; and 5) `correlation` (physical disk order vs logical order). If a column has high skew or high cardinality, increasing `default_statistics_target` from 100 to 500 gives the planner finer-grained histogram buckets, eliminating bad cardinality estimates.",
        codeExample: `-- Inspecting statistics for a column
SELECT 
    attname, 
    n_distinct, 
    most_common_vals, 
    most_common_freqs, 
    correlation
FROM pg_stats
WHERE tablename = 'orders' AND attname = 'customer_id';

-- Increase statistics target on a high-cardinality foreign key
ALTER TABLE orders ALTER COLUMN customer_id SET STATISTICS 500;
ANALYZE orders;`
      },
      {
        subheading: "3. Join Algorithm Selection: Nested Loop vs Hash Join vs Merge Join",
        explanation: "PostgreSQL evaluates three join algorithms: 1) `Nested Loop` (scans outer table, probes inner index for each row; optimal for tiny outer sets); 2) `Hash Join` (builds an in-memory hash table of the inner table inside `work_mem`, then streams outer table; optimal for large unsorted equality joins); and 3) `Merge Join` (walks two pre-sorted relation streams in lockstep; optimal for large pre-sorted index streams). If a Hash Join's hash table exceeds `work_mem`, it spills into multi-batch disk partitions.",
        codeExample: `-- Demonstrating EXPLAIN plan showing Hash Join and Batches
EXPLAIN (ANALYZE, BUFFERS)
SELECT c.name, o.amount
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.created_at >= '2026-01-01';

-- Look for:
-- "Hash Join (cost=...)"
-- "Hash Cond: (o.customer_id = c.id)"
-- "Batches: 1  Memory Usage: 1024kB" (100% in RAM)`
      }
    ],
    edgeCasesAndPitfalls: [
      "Correlated columns (e.g. city + zip_code) cause the planner to underestimate row counts because it assumes column independence; resolve using `CREATE STATISTICS`.",
      "Outdated statistics after a massive batch insert cause the planner to choose catastrophic Cartesian Nested Loops.",
      "Small `work_mem` causes Hash Joins to spill to disk into multiple batches, visible in EXPLAIN as 'Batches: 2+'."
    ],
    keyTakeaways: [
      "Tune random_page_cost to 1.1 on SSDs to prevent unnecessary sequential scans.",
      "The statistics engine uses MCVs and Histograms; raise statistics target on skewed columns.",
      "Nested Loop is best for small sets with indexes; Hash Join is best for large unsorted equality sets."
    ]
  },

  {
    id: "pg-deep-07",
    title: "Locking Mechanics, Lock Trees, Deadlock Detection & Zero-Downtime DDL",
    category: "Concurrency & Locking",
    readTimeMinutes: 20,
    overview: "PostgreSQL manages concurrency using an 8-level table lock hierarchy, four row-level locking modes, and distributed advisory mutexes. This chapter explores lock compatibility matrices, Head-of-Line blocking hazards during schema migrations, deadlock detection wait-for graphs, and zero-downtime DDL patterns using lock timeouts.",
    diagram: `+-------------------------------------------------------------------------+
|                  LOCK COMPATIBILITY & HEAD-OF-LINE BLOCKING             |
+-------------------------------------------------------------------------+
|                                                                         |
|  TABLE LOCK HIERARCHY (Selected Key Modes):                             |
|  1. AccessShareLock         <- Acquired by SELECT                       |
|  2. RowExclusiveLock        <- Acquired by INSERT, UPDATE, DELETE       |
|  3. ShareUpdateExclusiveLock<- Acquired by VACUUM, CREATE INDEX CONC.   |
|  4. AccessExclusiveLock     <- Acquired by ALTER TABLE, DROP TABLE      |
|                                                                         |
|  HEAD-OF-LINE BLOCKING TRAP:                                            |
|  T1: Slow SELECT (holds AccessShare)                                    |
|      |                                                                  |
|      v                                                                  |
|  T2: ALTER TABLE ADD COLUMN (Requests AccessExclusive -> BLOCKED!)       |
|      |                                                                  |
|      v                                                                  |
|  T3..T1000: Incoming API SELECTs (Request AccessShare)                  |
|             ALL BLOCKED BEHIND T2 IN FIFO QUEUE!                        |
|             (Full application outage without lock_timeout!)             |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The 8 Table Lock Modes & The Rule of AccessExclusiveLock",
        explanation: "PostgreSQL implements 8 table-level lock modes. Crucially, `RowExclusiveLock` (acquired by `INSERT`, `UPDATE`, and `DELETE`) does NOT conflict with `AccessShareLock` (acquired by `SELECT`), which is why readers never block writers and writers never block readers under MVCC. The ONLY lock mode that conflicts with `AccessShareLock` is `AccessExclusiveLock`, acquired by DDL operations (`ALTER TABLE`, `DROP TABLE`, `TRUNCATE`, `VACUUM FULL`).",
        codeExample: `-- Monitoring active table locks and waiting transactions
SELECT 
    l.pid, 
    c.relname, 
    l.mode, 
    l.granted,
    a.query
FROM pg_locks l
JOIN pg_class c ON c.oid = l.relation
JOIN pg_stat_activity a ON a.pid = l.pid
WHERE l.locktype = 'relation';`
      },
      {
        subheading: "2. The Head-of-Line Blocking Trap during Migrations",
        explanation: "PostgreSQL's lock manager uses a First-In, First-Out (FIFO) queue to prevent lock starvation. If an `ALTER TABLE` requests an `AccessExclusiveLock` while a slow reporting `SELECT` is running, the DDL waits in queue. However, every subsequent fast incoming `SELECT` is queued BEHIND the pending DDL to prevent the DDL from starving. Within seconds, the entire web application connection pool exhausts waiting behind the DDL.",
        codeExample: `-- SCENARIO: A slow query holding AccessShare blocks DDL, which blocks everything
-- Session 1: SELECT pg_sleep(120) FROM users;
-- Session 2: ALTER TABLE users ADD COLUMN bio TEXT; -- WAITING FOR LOCK
-- Session 3: SELECT * FROM users WHERE id = 1;      -- BLOCKED BEHIND SESSION 2!`
      },
      {
        subheading: "3. Zero-Downtime Safe Migration Pattern with lock_timeout",
        explanation: "To completely prevent Head-of-Line blocking, all production migrations MUST set a low `lock_timeout` (e.g. 2 seconds). If the migration cannot acquire its lock within 2 seconds, it aborts immediately rather than queueing up and blocking incoming web traffic. The migration runner can retry until it hits a quiet moment.",
        codeExample: `-- Production Safe Migration Template
BEGIN;
-- If lock cannot be acquired within 2 seconds, fail immediately:
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';

-- Safe schema addition (Postgres 11+ adds default without table rewrite!)
ALTER TABLE orders ADD COLUMN fulfillment_status TEXT DEFAULT 'PENDING';
COMMIT;`
      }
    ],
    edgeCasesAndPitfalls: [
      "Running migrations without `SET LOCAL lock_timeout` can take down production web traffic within seconds due to lock queue cascading.",
      "Deadlocks are only detected after `deadlock_timeout` (default 1s); frequent deadlocks indicate transactions are locking rows in non-deterministic order.",
      "Session-level advisory locks leak across recycled connections in PgBouncer; always prefer transaction-scoped `pg_advisory_xact_lock()`."
    ],
    keyTakeaways: [
      "Writes (RowExclusive) never block reads (AccessShare); only AccessExclusive locks conflict with SELECT.",
      "Lock queues are FIFO; a pending DDL blocks all subsequent reads.",
      "Always set `lock_timeout = '2s'` on production migrations."
    ]
  },

  {
    id: "pg-deep-08",
    title: "Declarative Partitioning Internals: Routing, Static/Run-time Pruning & Online Detach",
    category: "Partitioning & Big Data",
    readTimeMinutes: 20,
    overview: "Declarative table partitioning allows splitting multi-terabyte tables into manageable physical files while maintaining a single unified SQL interface. This chapter examines partition routing, compile-time vs run-time partition pruning, default partition hazards, and PostgreSQL 14+ DETACH PARTITION CONCURRENTLY.",
    diagram: `+-------------------------------------------------------------------------+
|                  DECLARATIVE PARTITIONING ARCHITECTURE                  |
+-------------------------------------------------------------------------+
|                                                                         |
|  UNIFIED SQL INTERFACE: INSERT INTO orders VALUES (...)                 |
|     |                                                                   |
|     v                                                                   |
|  ROOT PARTITIONED TABLE (Logical Anchor - Stores NO physical rows)      |
|     |                                                                   |
|     +---> Tuple Routing Engine checks Partition Key                     |
|           |                                                             |
|           +---> PARTITION 2026_01 (RANGE: '2026-01-01' TO '2026-02-01') |
|           +---> PARTITION 2026_02 (RANGE: '2026-02-01' TO '2026-03-01') |
|           +---> PARTITION DEFAULT (Catch-all)                           |
|                                                                         |
|  PARTITION PRUNING AT RUNTIME:                                          |
|  SELECT * FROM orders WHERE created_at = $1                             |
|  Executor evaluates parameter $1 -> PRUNES (skips) all non-matching     |
|  child partitions, scanning ONLY 1 target partition!                    |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Declarative Routing Engine & Local Index Hierarchy",
        explanation: "In declarative partitioning, the parent table is a virtual routing construct containing no physical disk data. When an `INSERT` executes, PostgreSQL's tuple routing engine evaluates the partition key and appends the tuple to the appropriate child relation. Indexes on partitioned tables are local: PostgreSQL propagates index definitions down to all existing and future child tables, each holding an independent B-Tree on disk. Crucially, unique constraints on partitioned tables MUST include the partition key.",
        codeExample: `-- Root table partitioned by RANGE
CREATE TABLE audit_events (
    event_id UUID NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    payload JSONB,
    PRIMARY KEY (event_id, recorded_at) -- Partition key MUST be in PK!
) PARTITION BY RANGE (recorded_at);

CREATE TABLE audit_events_2026_01 PARTITION OF audit_events
FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00');`
      },
      {
        subheading: "2. Static vs Run-Time Partition Pruning",
        explanation: "Partition pruning allows the executor to skip scanning child tables whose constraints contradict the query filter. Compile-time pruning happens during query planning when literal constants are supplied. Run-time pruning (PostgreSQL 11+) evaluates parameters (`WHERE recorded_at = $1`) or subqueries dynamically at execution time, pruning unneeded partitions on the fly.",
        codeExample: `-- Verifying partition pruning via EXPLAIN
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM audit_events 
WHERE recorded_at >= '2026-01-10' AND recorded_at < '2026-01-20';
-- Plan shows: Only audit_events_2026_01 is scanned; other months are omitted!`
      },
      {
        subheading: "3. Zero-Downtime Data Purging with DETACH PARTITION CONCURRENTLY",
        explanation: "Dropping old data using `DELETE WHERE recorded_at < '2025-01-01'` on a 100M-row table generates massive WAL volume, dead tuples, and table bloat. With partitioning, PostgreSQL 14+ allows `ALTER TABLE ... DETACH PARTITION ... CONCURRENTLY`. The partition is detached online without taking an exclusive lock on the parent table, and dropping the standalone child table is instantaneous with zero WAL bloat.",
        codeExample: `-- Instant data retention purge in PostgreSQL 14+
ALTER TABLE audit_events 
DETACH PARTITION audit_events_2026_01 CONCURRENTLY;

-- Now audit_events_2026_01 is a standalone table; drop it instantly:
DROP TABLE audit_events_2026_01;`
      }
    ],
    edgeCasesAndPitfalls: [
      "Creating a DEFAULT partition prevents attaching new range partitions later if any conflicting rows exist in the DEFAULT partition.",
      "Unique constraints cannot enforce global uniqueness across partitions unless the partition key is part of the unique index.",
      "Partition count explosion (> 1,000 child tables) drastically increases query planning time and catalog lock overhead."
    ],
    keyTakeaways: [
      "Declarative partitioning splits multi-terabyte relations into smaller child tables transparently.",
      "Run-time partition pruning skips scanning non-matching partitions for parameterized queries.",
      "DETACH PARTITION CONCURRENTLY enables zero-downtime rolling data retention drops."
    ]
  },

  {
    id: "pg-deep-09",
    title: "Row-Level Security (RLS) & Multi-Tenant Isolation Architectures",
    category: "Security & Multi-Tenancy",
    readTimeMinutes: 20,
    overview: "Row-Level Security (RLS) enforces mathematical data isolation directly inside the database engine. This chapter examines the mechanics of USING (read filters) and WITH CHECK (write guards), dynamic tenant isolation using session variables (`current_setting`), InitPlan optimization for RLS, and a comparison between Schema-per-Tenant and Shared-Table RLS architectures.",
    diagram: `+-------------------------------------------------------------------------+
|                  ROW-LEVEL SECURITY (RLS) ARCHITECTURE                  |
+-------------------------------------------------------------------------+
|                                                                         |
|  WEB APP REQUEST (Tenant 42)                                            |
|     |                                                                   |
|     +---> BEGIN;                                                        |
|     +---> SET LOCAL app.current_tenant_id = '42';                       |
|     +---> SELECT * FROM invoices;                                       |
|                                                                         |
|  POSTGRESQL QUERY REWRITER:                                             |
|  Injects RLS Security Barrier:                                          |
|  SELECT * FROM invoices                                                 |
|  WHERE (tenant_id = (SELECT current_setting('app.current_tenant_id')::int))
|                                                                         |
|  EVALUATION AS INITPLAN:                                                |
|  - current_setting is evaluated ONCE at query startup ($0 = 42)         |
|  - Fast Index Scan using idx_invoices_tenant (tenant_id = $0)           |
|                                                                         |
|  +---> COMMIT; (Automatically resets app.current_tenant_id!)             |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Mechanics of USING (Reads) vs WITH CHECK (Writes)",
        explanation: "`CREATE POLICY` provides two distinct constraint clauses: `USING` acts as an invisible `WHERE` filter for reading rows (`SELECT`, `UPDATE`, `DELETE`). `WITH CHECK` acts as a write validation guard for `INSERT` and `UPDATE` operations. If `WITH CHECK` is omitted, it defaults to the same expression as `USING`. Always verify `FORCE ROW LEVEL SECURITY` on tables to ensure the table owner cannot accidentally bypass policies.",
        codeExample: `-- Defining a complete RLS policy
ALTER TABLE tenant_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invoices FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON tenant_invoices
FOR ALL
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::int)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::int);`
      },
      {
        subheading: "2. The InitPlan Optimization for High-Performance RLS",
        explanation: "A common performance trap is writing `USING (tenant_id = current_setting('app.tenant')::int)`. In some plans, PostgreSQL re-evaluates the function for every row scanned ($O(N)$). Wrapping the session lookup in a scalar subquery `USING (tenant_id = (SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::int))` forces the optimizer to evaluate the tenant ID once as an `InitPlan` ($O(1)$) at query startup, allowing direct index seeks.",
        codeExample: `-- Hardened, highly optimized RLS Policy using InitPlan subquery
CREATE POLICY fast_tenant_policy ON orders
FOR ALL
USING (
    tenant_id = (SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::int)
);

-- EXPLAIN shows:
-- InitPlan 1 (returns $0) -> Result
-- Index Scan using idx_orders_tenant on orders (tenant_id = $0)`
      },
      {
        subheading: "3. Multi-Tenant Architectural Trade-offs",
        explanation: "Enterprise systems typically choose between: 1) Schema-per-Tenant (isolated schemas switched via `SET LOCAL search_path`; strong isolation, but migrations must loop over all schemas); and 2) Shared-Table with RLS (all tenants share one table partitioned with RLS; single migration updates everyone instantly, highest tenant density, lowest hardware footprint).",
        codeExample: `-- Schema-per-Tenant switching in transaction
BEGIN;
SET LOCAL search_path = tenant_acme, public;
SELECT * FROM orders; -- queries tenant_acme.orders
COMMIT;`
      }
    ],
    edgeCasesAndPitfalls: [
      "Table owners bypass RLS by default; always execute `ALTER TABLE ... FORCE ROW LEVEL SECURITY`.",
      "Direct casts on unset session variables throw fatal runtime errors; always use `NULLIF(current_setting('key', true), '')::type`.",
      "Running `pg_dump` with an application role lacking `BYPASSRLS` will result in an empty backup file."
    ],
    keyTakeaways: [
      "USING filters existing rows; WITH CHECK validates new/updated rows.",
      "Wrap session variables in `(SELECT current_setting(...))` to enable InitPlan optimization.",
      "Use `SET LOCAL` for transaction-scoped session variables to prevent connection pool poisoning."
    ]
  },

  {
    id: "pg-deep-10",
    title: "JSONB Binary Storage, SQL/JSON Path Engine & GIN Index Optimization",
    category: "JSONB & Semi-Structured",
    readTimeMinutes: 18,
    overview: "PostgreSQL bridges relational modeling and NoSQL agility through its native `jsonb` data type. This chapter covers the internal decomposed binary storage format, containment and existence operators, the ANSI SQL/JSON path language, and GIN operator classes (`jsonb_ops` vs `jsonb_path_ops`).",
    diagram: `+-------------------------------------------------------------------------+
|                  JSONB BINARY STORAGE & GIN OPERATOR CLASSES            |
+-------------------------------------------------------------------------+
|                                                                         |
|  INPUT: '{"user": "alex", "tier": "gold", "tags": ["db", "ai"]}'        |
|     |                                                                   |
|     v                                                                   |
|  JSONB STORAGE: Parsed into sorted, deduplicated binary chunks          |
|  - Fast key lookup without document re-parsing                          |
|                                                                         |
|  GIN OPERATOR CLASSES:                                                  |
|  1. jsonb_ops (Default)                                                 |
|     - Indexes keys, values, and paths independently                     |
|     - Supports: @>, ?, ?|, ?&                                           |
|     - Size: Large                                                       |
|                                                                         |
|  2. jsonb_path_ops (Optimized)                                          |
|     - Hashes entire paths down to leaf values                           |
|     - Supports ONLY: @> (Containment)                                   |
|     - Size: 3x smaller, faster builds, higher query throughput          |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Decomposed Binary Storage vs Raw JSON Text",
        explanation: "While `json` stores verbatim text strings requiring re-parsing on every query, `jsonb` parses data once and stores it in a decomposed binary tree format with sorted keys and pre-calculated offset headers. Duplicate keys are automatically pruned (last value wins), whitespace is stripped, and individual nested keys can be extracted without decoding the rest of the document.",
        codeExample: `-- Inspecting jsonb operators
SELECT 
    data -> 'user' AS user_jsonb,            -- returns jsonb
    data -> 'user' ->> 'name' AS name_text,   -- returns text
    data #>> '{user, profile, city}' AS city  -- deep path text extraction
FROM user_records;`
      },
      {
        subheading: "2. GIN Operator Classes: jsonb_ops vs jsonb_path_ops",
        explanation: "`jsonb_ops` (default) indexes every key, value, and path element, supporting all operators (`@>`, `?`, `?|`, `?&`). `jsonb_path_ops` hashes entire path trees (e.g. `hash(user.profile.country = CH)`), producing an index that is up to 70% smaller and significantly faster, but restricted strictly to containment (`@>`) queries.",
        codeExample: `-- Create 3x smaller path-ops GIN index for containment queries
CREATE INDEX idx_audit_meta_path_ops 
ON audit_logs USING gin (metadata jsonb_path_ops);

-- Accelerated by jsonb_path_ops index:
SELECT * FROM audit_logs 
WHERE metadata @> '{"status": "FAILED", "code": 500}';`
      },
      {
        subheading: "3. SQL/JSON Path Language (JSONPath)",
        explanation: "PostgreSQL implements the ANSI SQL/JSON Path standard. Using expressions starting with `$` (the root document), queries can perform deep array slicing, projection, and filter predicates (`?(@.price > 100)`) in a single query pass without joining unnested arrays.",
        codeExample: `-- SQL/JSON Path query filtering active enterprise customers
SELECT id, metadata
FROM customer_profiles
WHERE jsonb_path_exists(
    metadata, 
    '$.subscriptions[*] ? (@.tier == "enterprise" && @.active == true)'
);`
      }
    ],
    edgeCasesAndPitfalls: [
      "JSONB documents exceeding ~2KB trigger TOAST table compression; updating a single key in a 100KB JSONB document rewrites the entire TOASTed payload.",
      "Filtering with `data -> 'age' = 25` raises a type error; always use `(data ->> 'age')::int = 25`.",
      "Blanket GIN indexing on high-write tables causes severe write amplification and rapid index bloat."
    ],
    keyTakeaways: [
      "jsonb decomposes JSON into sorted binary structures for sub-millisecond querying.",
      "Use `jsonb_path_ops` when queries only use `@>` to save up to 70% index RAM and disk space.",
      "Extract frequently updated scalar fields into real columns to avoid TOAST rewrite amplification."
    ]
  },

  {
    id: "pg-deep-11",
    title: "PostgreSQL Observability, Buffer Analysis & pg_stat_statements Mastery",
    category: "Observability & Performance Tuning",
    readTimeMinutes: 20,
    overview: "Production database reliability requires deep observability into query execution, cache hit ratios, and I/O bottlenecks. This chapter covers the inner mechanics of `EXPLAIN (ANALYZE, BUFFERS)`, query fingerprinting with `pg_stat_statements`, detecting temporary disk spills, and index usage telemetry.",
    diagram: `+-------------------------------------------------------------------------+
|                  QUERY PERFORMANCE & BUFFER OBSERVABILITY               |
+-------------------------------------------------------------------------+
|                                                                         |
|  EXPLAIN (ANALYZE, BUFFERS) OUTPUT DECODER:                             |
|  +-------------------------------------------------------------------+  |
|  | Buffers: shared hit=1420 read=15 dirtied=2 written=0               |  |
|  | - shared hit: Pages read directly from RAM (shared_buffers)        |  |
|  | - shared read: Pages read from OS / physical disk                  |  |
|  | - shared dirtied: Pages modified by this query                     |  |
|  +-------------------------------------------------------------------+  |
|  | Sort Method: external merge  Disk: 24512kB                         |  |
|  | - Indication: work_mem was too small -> spilled to disk!           |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  pg_stat_statements FINGERPRINTING:                                     |
|  Normalizes queries into queryid fingerprints for aggregate tracking    |
|  - Tracks total_exec_time, mean_exec_time, calls, and shared_blks_read  |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The True Meaning of Buffers in EXPLAIN Plans",
        explanation: "Execution times fluctuate based on server concurrency and cache warming. Analyzing `BUFFERS` provides deterministic physical metrics: `shared hit` counts 8KB pages served from RAM; `shared read` counts pages fetched from the filesystem/disk. If a query takes 2ms when hot but 500ms when cold, `shared read` reveals the disk I/O bottleneck.",
        codeExample: `-- Diagnostic query with full buffer and WAL statistics
EXPLAIN (ANALYZE, BUFFERS, SETTINGS, WAL)
SELECT c.name, sum(o.amount)
FROM customers c
JOIN orders o ON o.customer_id = c.id
WHERE o.created_at >= '2026-01-01'
GROUP BY c.name;`
      },
      {
        subheading: "2. Query Normalization and pg_stat_statements Analytics",
        explanation: "`pg_stat_statements` hashes queries into normalized parameter-agnostic fingerprints (`queryid`). It calculates cumulative execution time across the entire database lifespan. Sorting by `total_exec_time` reveals the queries consuming the most CPU/RAM overall, while sorting by `shared_blks_read` reveals the queries causing disk I/O saturation.",
        codeExample: `-- Top queries causing disk I/O saturation (missing indexes)
SELECT 
    round(total_exec_time::numeric, 2) as total_time_ms,
    calls,
    round(mean_exec_time::numeric, 2) as avg_time_ms,
    shared_blks_read,
    shared_blks_hit,
    round(100.0 * shared_blks_hit / nullif(shared_blks_hit + shared_blks_read, 0), 2) as cache_hit_pct,
    query
FROM pg_stat_statements
ORDER BY shared_blks_read DESC
LIMIT 5;`
      },
      {
        subheading: "3. Index Usage and Unused Index Pruning",
        explanation: "Every unused index on a table incurs write amplification, WAL generation, and memory overhead during autovacuum. Monitoring `pg_stat_user_indexes` allows DBAs to safely identify indexes that receive zero reads (`idx_scan = 0`) despite heavy table writes (`n_tup_ins`, `n_tup_upd`).",
        codeExample: `-- Identify completely unused indexes (candidates for DROP)
SELECT 
    schemaname, 
    relname as table_name, 
    indexrelname as index_name, 
    idx_scan as times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) as wasted_size
FROM pg_stat_user_indexes
JOIN pg_index USING (indexrelid)
WHERE idx_scan = 0 
  AND NOT indisunique -- Do NOT drop unique constraints!
ORDER BY pg_relation_size(indexrelid) DESC;`
      }
    ],
    edgeCasesAndPitfalls: [
      "`pg_stat_statements` requires `shared_preload_libraries = 'pg_stat_statements'` and a server restart to function.",
      "Reset statistics with `pg_stat_statements_reset()` after major schema or index deployments to avoid historical metric skew.",
      "Never drop an unused index without verifying whether it supports a rarely run quarterly reporting query or disaster recovery job."
    ],
    keyTakeaways: [
      "Always inspect `Buffers: shared hit vs read` rather than execution time alone.",
      "pg_stat_statements aggregates query performance by normalized fingerprint queryid.",
      "Prune unused indexes using pg_stat_user_indexes to recover write throughput."
    ]
  },

  {
    id: "pg-deep-12",
    title: "High Availability, Streaming Replication, Replication Slots & Connection Pooling",
    category: "Replication & High Availability",
    readTimeMinutes: 20,
    overview: "Operating mission-critical PostgreSQL at scale demands robust high-availability clustering and connection pooling. This chapter explores physical streaming replication (`walsender`/`walreceiver`), replication slot mechanics, synchronous commit modes, failover architectures (Patroni / Raft), and PgBouncer transaction pooling topologies.",
    diagram: `+-------------------------------------------------------------------------+
|                  HIGH AVAILABILITY & CONNECTION POOLING                 |
+-------------------------------------------------------------------------+
|                                                                         |
|  WEB APP SERVERS (Thousands of clients)                                 |
|     |                                                                   |
|     v                                                                   |
|  PGBOUNCER (Transaction Pooling Mode)                                   |
|  - Multiplexes 5,000 application sockets onto 50 physical Postgres pools|
|     |                                                                   |
|     v                                                                   |
|  PRIMARY NODE (Read/Write)                                              |
|  - walsender process streams WAL to replicas                            |
|  - Replication Slot retains WAL segments until replica confirms         |
|     |                                                                   |
|     +== TCP WAL STREAM ===========================================+     |
|     |                                                             |     |
|     v                                                             v     |
|  STANDBY REPLICA 1 (Hot Standby - RO)        STANDBY REPLICA 2 (RO)     |
|  - walreceiver writes WAL to disk            - Replays changes into RAM |
|  - startup process replays WAL               - Ready for Patroni failover|
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Physical Streaming Replication Mechanics",
        explanation: "In physical streaming replication, the primary's `walsender` process connects to the standby's `walreceiver` process over a TCP connection. As transactions commit on the primary, raw binary WAL records are streamed immediately to the replica. The standby's `startup` process continuously applies these records to its local database files in read-only recovery mode (`hot_standby = on`), making the standby available for read-only queries.",
        codeExample: `-- Monitor connected standby replicas and byte lag on the Primary
SELECT 
    client_addr, 
    application_name, 
    state, 
    sync_state,
    pg_wal_lsn_diff(pg_current_wal_lsn(), write_lsn) as write_lag_bytes,
    pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) as replay_lag_bytes
FROM pg_stat_replication;`
      },
      {
        subheading: "2. The Necessity and Danger of Replication Slots",
        explanation: "Without a replication slot, if a standby disconnects for network maintenance, the primary's checkpointer may delete recycled WAL files, causing the standby to fail permanently with 'WAL segment already removed'. A physical replication slot guarantees the primary will retain all WAL segments until the standby confirms reception. However, if a replica is permanently destroyed and its slot is not dropped, the primary retains ALL WAL files until the primary's disk fills completely, causing a total database crash.",
        codeExample: `-- Create and monitor physical replication slots
SELECT pg_create_physical_replication_slot('standby_node_1');

SELECT 
    slot_name, 
    active, 
    wal_status,
    pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) as retained_bytes
FROM pg_replication_slots;

-- Safeguard against disk exhaustion in postgresql.conf
-- ALTER SYSTEM SET max_slot_wal_keep_size = '32GB';`
      },
      {
        subheading: "3. PgBouncer Transaction Pooling Architecture",
        explanation: "Because PostgreSQL uses a process-per-connection model, scaling beyond 200-500 direct client connections causes OS memory starvation. PgBouncer sits between applications and PostgreSQL. In `pool_mode = transaction`, a backend PostgreSQL connection is borrowed ONLY for the brief duration of an active SQL transaction and returned immediately to the pool at `COMMIT`/`ROLLBACK`. This allows 5,000 microservice web connections to be multiplexed seamlessly onto 50 PostgreSQL backend processes.",
        codeExample: `-- Recommended pgbouncer.ini settings
[databases]
mydb = host=127.0.0.1 port=5432 dbname=mydb pool_mode=transaction

[pgbouncer]
listen_port = 6432
max_client_conn = 5000
default_pool_size = 50
reserve_pool_size = 10
server_idle_timeout = 600`
      }
    ],
    edgeCasesAndPitfalls: [
      "Orphaned replication slots retain WAL indefinitely; always set `max_slot_wal_keep_size` to prevent primary disk full crashes.",
      "Transaction pooling breaks session-level state (`SET search_path`, session advisory locks); use `SET LOCAL` and transaction-scoped advisory locks instead.",
      "Read queries on standbys can be cancelled by incoming replication replay conflicts (`max_standby_streaming_delay`)."
    ],
    keyTakeaways: [
      "Physical streaming replication streams WAL binary records from walsender to walreceiver.",
      "Replication slots protect replicas from WAL deletion but require max_slot_wal_keep_size safeguards.",
      "PgBouncer transaction pooling multiplexes thousands of application clients onto a small, optimal pool of PostgreSQL processes."
    ]
  }
];

// Validate all chapters
const requiredFields = ["id", "title", "category", "readTimeMinutes", "overview", "diagram", "deepDive", "edgeCasesAndPitfalls", "keyTakeaways"];
for (const ch of deepChapters) {
  for (const field of requiredFields) {
    if (!ch[field]) {
      console.error(`Chapter ${ch.id} missing field: ${field}`);
      process.exit(1);
    }
  }
  for (const dd of ch.deepDive) {
    if (!dd.subheading || !dd.explanation || !dd.codeExample) {
      console.error(`Chapter ${ch.id} deepDive missing sub-fields`);
      process.exit(1);
    }
  }
}

const outputPath = path.join(__dirname, "../data/pgsql.deep.json");
fs.writeFileSync(outputPath, JSON.stringify(deepChapters, null, 2), "utf-8");

console.log(`Successfully generated PostgreSQL Deeper Concepts:`);
console.log(`- ${deepChapters.length} Masterclass chapters written to ${outputPath}`);
