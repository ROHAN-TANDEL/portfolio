const { createCard } = require("../pg_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 13,
    category: "MVCC, Tuples & Storage Internals",
    concept: "Heap Tuple Structure & System Columns (xmin, xmax, ctid)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are the hidden system columns in PostgreSQL tuples (xmin, xmax, ctid) and how does PostgreSQL use them?",
    quickAnswer: "Every table row (tuple) in PostgreSQL contains hidden system attributes: `xmin` (the 32-bit transaction ID that inserted the tuple), `xmax` (the transaction ID that deleted or updated the tuple, or 0 if active), and `ctid` (the physical location tuple identifier composed of `(block_number, tuple_index)`). PostgreSQL uses `xmin` and `xmax` to determine row visibility for transactions without row-level locks.",
    detailedAnswer: "PostgreSQL tuple physical layout:\n1. `xmin`: The transaction identifier (XID) of the creating transaction. A tuple is only visible to transactions that started after `xmin` committed.\n2. `xmax`: The XID of the deleting/updating transaction. If `xmax` is 0 or committed after our snapshot, the row is visible. If updated, `xmax` points to the transaction that created the newer replacement tuple.\n3. `ctid`: Physical coordinate pointer `(page_number, offset_number)` within the 8KB table file. When a row is updated without HOT, its `ctid` changes to the new physical page slot.\n4. `cmin` / `cmax`: Command identifier within the same transaction to enforce intra-transaction visibility.",
    code: `-- Inspect hidden MVCC system columns directly
SELECT 
    ctid, 
    xmin, 
    xmax, 
    id, 
    name 
FROM users 
LIMIT 5;

-- Update a single row and witness ctid and xmin/xmax changes
UPDATE users SET name = 'Updated Name' WHERE id = 1 RETURNING ctid, xmin, xmax;`,
    recallHint: "xmin = creator XID, xmax = deleter/updater XID, ctid = physical (block, offset) coordinates.",
    interviewTip: "Emphasize that `ctid` can change at any time due to `VACUUM FULL` or row updates, so it must NEVER be stored as an application-level foreign key.",
    tags: ["mvcc", "xmin", "xmax", "ctid", "tuple-internals", "system-columns"]
  }),

  createCard({
    idNum: 14,
    category: "MVCC, Tuples & Storage Internals",
    concept: "MVCC Snapshot Visibility Rules (Snapshot Data Structure)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does PostgreSQL construct an MVCC snapshot, and how does it determine whether a tuple is visible to a running query?",
    quickAnswer: "An MVCC snapshot in PostgreSQL is represented as `xmin:xmax:xip_list`. `xmin` is the lowest XID still active; any transaction before `xmin` is committed and visible. `xmax` is the first unassigned XID; any transaction >= `xmax` is invisible. `xip_list` is the list of active/uncommitted transactions between `xmin` and `xmax`. A tuple is visible if its creating transaction is committed and not in `xip_list`.",
    detailedAnswer: "PostgreSQL Snapshot mechanics:\n1. Snapshot representation: `100:105:101,103`. Here, any XID < 100 is visible (if committed). Any XID >= 105 is invisible. For XIDs 100 to 104, transactions 101 and 103 are currently running (uncommitted), so their inserts are invisible.\n2. Non-blocking reads: Readers do not block writers, and writers do not block readers. A query sees a static snapshot of the database at the instant the statement started (under Read Committed) or when the transaction started (under Repeatable Read).\n3. Commit Log (`pg_xact`): If an XID is not in memory, Postgres checks `pg_xact` to see if the creating transaction committed or aborted.",
    code: `-- View current transaction snapshot
SELECT pg_current_snapshot();
-- Sample output: '1050:1055:1051,1053'

-- Check whether current transaction has an assigned XID
SELECT txid_current_if_assigned();`,
    recallHint: "Snapshot is xmin:xmax:xip_list. < xmin is committed/visible, >= xmax is future/invisible, xip_list contains in-flight uncommitted transactions.",
    interviewTip: "Clarify that read-only queries in Postgres do not even assign a permanent 32-bit transaction ID; they operate with virtual transaction IDs (`vxid`) to prevent XID exhaustion.",
    tags: ["mvcc", "snapshot", "visibility", "pg_xact", "concurrency"]
  }),

  createCard({
    idNum: 15,
    category: "MVCC, Tuples & Storage Internals",
    concept: "Append-Only Tuple Storage (UPDATE as DELETE + INSERT)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why does an UPDATE in PostgreSQL perform an INSERT and a DELETE internally rather than modifying the data in place?",
    quickAnswer: "PostgreSQL employs an append-only (out-of-place) storage engine. Because concurrent read transactions may still be reading the prior version of the row under MVCC snapshot rules, PostgreSQL leaves the existing tuple in the 8KB page (setting its `xmax` to the current transaction ID) and writes a brand new tuple with updated values (setting its `xmin` to the current transaction ID).",
    detailedAnswer: "Consequences of Out-of-Place Updates:\n1. Concurrency: Readers holding an open snapshot continue scanning the old row version with zero lock contention.\n2. Write Amplification: Modifying a single column causes a full physical row copy to be written.\n3. Index Amplification: By default, every index on the table must add an entry pointing to the new `ctid`, unless the update qualifies for HOT (Heap-Only Tuples).\n4. Dead Tuple Accumulation: The old row version remains on disk as a 'dead tuple' once all active transactions that could see it finish, requiring `VACUUM` to reclaim the space.",
    code: `-- Observe row pointer evolution during updates
CREATE TABLE demo_update (id INT PRIMARY KEY, val TEXT);
INSERT INTO demo_update VALUES (1, 'initial');
SELECT ctid, xmin, xmax, val FROM demo_update;
-- ctid: (0,1)

UPDATE demo_update SET val = 'modified' WHERE id = 1;
SELECT ctid, xmin, xmax, val FROM demo_update;
-- ctid moves to (0,2); old slot (0,1) is now a dead tuple!`,
    recallHint: "PostgreSQL updates are out-of-place (INSERT + DELETE) to maintain MVCC read stability, leaving dead tuples that need VACUUM.",
    interviewTip: "Compare this to MySQL InnoDB, which updates clustered index pages in-place and writes older row versions to an undo log. Postgres has no undo log for data; old versions reside directly in the heap.",
    tags: ["updates", "append-only", "dead-tuples", "storage-engine", "write-amplification"]
  }),

  createCard({
    idNum: 16,
    category: "MVCC, Tuples & Storage Internals",
    concept: "Heap-Only Tuples (HOT) Optimization & Fillfactor",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Heap-Only Tuples (HOT) in PostgreSQL, and how does tuning table fillfactor enable it?",
    quickAnswer: "Heap-Only Tuples (HOT) is an optimization that avoids updating table indexes when a row is updated. If the updated row fits inside the exact same 8KB data page as the old tuple and no indexed columns were altered, PostgreSQL links the old tuple pointer directly to the new tuple in the heap. Setting a `fillfactor` below 100 (e.g. 80-90) reserves free space on every page specifically for HOT updates.",
    detailedAnswer: "Requirements for HOT:\n1. No indexed columns are modified by the `UPDATE` statement.\n2. The data page containing the old tuple has enough free space to hold the new tuple version.\n\nHOW IT WORKS:\n- Without HOT: Every index entry must be updated with the new `ctid`.\n- With HOT: Index entries continue pointing to the original line pointer (lp1). When an index scan lands on lp1, it follows a heap-internal redirection pointer (`LP_REDIRECT`) to lp2 inside the same page.\n- `fillfactor`: By default, table pages fill to 100%. Lowering `fillfactor = 85` leaves 15% free space on initial inserts, drastically increasing HOT update hit ratios and eliminating index bloat.",
    code: `-- Create a write-heavy table with fillfactor reserved for HOT
CREATE TABLE session_heartbeats (
    session_id UUID PRIMARY KEY,
    last_ping TIMESTAMPTZ NOT NULL,
    payload TEXT
) WITH (fillfactor = 80);

-- Verify HOT update effectiveness via pg_stat_user_tables
SELECT 
    relname, 
    n_tup_upd, 
    n_tup_hot_upd,
    ROUND(100.0 * n_tup_hot_upd / NULLIF(n_tup_upd, 0), 2) AS hot_ratio_pct
FROM pg_stat_user_tables
WHERE relname = 'session_heartbeats';`,
    recallHint: "HOT updates keep the new tuple on the same 8KB page with no index modifications; enabled by setting table fillfactor < 100.",
    interviewTip: "Mention that high-frequency counter/status update tables suffer catastrophic index bloat unless HOT is actively tuned via `WITH (fillfactor = 70-85)`.",
    tags: ["hot-updates", "fillfactor", "index-bloat", "heap-only-tuples", "write-performance"]
  }),

  createCard({
    idNum: 17,
    category: "MVCC, Tuples & Storage Internals",
    concept: "Dead Tuples, Table Bloat & Bloat Detection",
    priority: "must-know",
    difficulty: "advanced",
    question: "What causes table and index bloat in PostgreSQL, and how do you monitor and measure dead tuples?",
    quickAnswer: "Bloat is the unused physical disk space trapped inside table heap pages and B-tree index pages caused by accumulated dead tuples from `UPDATE` and `DELETE` operations. If autovacuum cannot keep pace or long-running transactions hold open snapshots that prevent tuple cleanup, dead tuples cannot be unlinked, causing the table file size on disk to swell while query scan times degrade.",
    detailedAnswer: "Causes of Bloat:\n1. Long-running transactions or orphaned prepared transactions hold back the global `xmin` horizon, preventing `VACUUM` from freeing dead tuples newer than that transaction's start.\n2. Inactive or lagging replication slots holding back the catalog `xmin`.\n3. Aggressive batch updates without autovacuum tuning.\n\nBloat Impact: Sequential scans must read empty or dead 8KB pages from disk into `shared_buffers`, reducing cache efficiency.\n\nMonitoring: Query `pg_stat_user_tables` to check `n_dead_tup` vs `n_live_tup`.",
    code: `-- Check live vs dead tuples across all tables
SELECT 
    schemaname, 
    relname, 
    n_live_tup, 
    n_dead_tup,
    round(100.0 * n_dead_tup / nullif(n_dead_tup + n_live_tup, 0), 2) AS dead_tuple_pct,
    last_vacuum, 
    last_autovacuum
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC;

-- Identify long-running transactions blocking vacuum cleanup
SELECT 
    pid, 
    usename, 
    state, 
    now() - xact_start AS xact_duration, 
    query
FROM pg_stat_activity
WHERE (now() - xact_start) > interval '15 minutes'
  AND backend_type = 'client backend';`,
    recallHint: "Dead tuples from updates/deletes cause bloat; long-running transactions block autovacuum by freezing the xmin horizon.",
    interviewTip: "Explain that bloat doesn't just waste disk space; it poisons `shared_buffers` by filling RAM caches with pages containing dead records.",
    tags: ["bloat", "dead-tuples", "pg_stat_user_tables", "vacuum", "disk-usage"]
  }),

  createCard({
    idNum: 18,
    category: "MVCC, Tuples & Storage Internals",
    concept: "VACUUM vs VACUUM FULL vs pg_repack",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the operational difference between VACUUM, VACUUM FULL, and pg_repack in production?",
    quickAnswer: "Standard `VACUUM` runs concurrently without blocking readers or writers; it marks dead tuple slots as reusable in the Free Space Map (FSM) but almost never returns disk space to the OS filesystem. `VACUUM FULL` rewrites the entire table into a new disk file, releasing disk space to the OS, but takes an exclusive `ACCESS EXCLUSIVE` table lock that blocks all reads and writes. `pg_repack` is a third-party extension that rewrites tables online without taking an exclusive lock.",
    detailedAnswer: "Comparison:\n1. `VACUUM`:\n   - Non-blocking (acquires weak `ShareUpdateExclusiveLock`).\n   - Unlinks dead tuple line pointers; marks 8KB page space reusable for subsequent `INSERT`s.\n   - Does not shrink filesystem files (unless trailing pages at EOF are completely empty).\n2. `VACUUM FULL`:\n   - Rewrites heap from scratch.\n   - Takes `ACCESS EXCLUSIVE` lock (blocks all reads and writes for minutes or hours on large tables).\n   - Dangerous in high-availability production.\n3. `pg_repack`:\n   - Creates shadow table, copies rows, replays changes using triggers, and swaps catalogs with an instant lock. Best practice for reclaiming bloat online.",
    code: `-- Safe online maintenance: standard vacuum with buffer stats
VACUUM (VERBOSE, ANALYZE) orders;

-- CAUTION: Blocks all read/write traffic on 'orders'
-- VACUUM FULL orders;

-- Recommended production command line using pg_repack (online table rebuild)
-- $ pg_repack -d mydb -t orders -j 4`,
    recallHint: "VACUUM = non-blocking, reuses space internally; VACUUM FULL = blocks all reads/writes, returns disk space; pg_repack = online defrag without exclusive locks.",
    interviewTip: "Never recommend `VACUUM FULL` in production interview questions without calling out that it takes an `ACCESS EXCLUSIVE` lock that blocks production traffic.",
    tags: ["vacuum", "vacuum-full", "pg_repack", "table-rewrite", "locks"]
  }),

  createCard({
    idNum: 19,
    category: "MVCC, Tuples & Storage Internals",
    concept: "Autovacuum Daemon Architecture & Tuning Parameters",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the PostgreSQL autovacuum daemon trigger cleanup, and which parameters must be tuned to prevent it from falling behind?",
    quickAnswer: "Autovacuum worker processes wake up periodically and trigger vacuuming when dead tuples exceed `autovacuum_vacuum_threshold + (autovacuum_vacuum_scale_factor * total_tuples)`. By default, `scale_factor` is 0.2 (20%), which is far too late for a 100-million row table (needs 20M dead tuples to trigger). Production tuning requires lowering the scale factor, increasing `autovacuum_vacuum_cost_limit`, and adjusting per-table settings.",
    detailedAnswer: "Key Autovacuum Formulas & Parameters:\n1. Trigger formula: `Threshold = autovacuum_vacuum_threshold (50) + autovacuum_vacuum_scale_factor (0.2) * n_live_tup`.\n2. Scale factor flaw on large tables: On a 50M row table, autovacuum won't trigger until 10M rows are dead!\n3. Cost-based throttle: Autovacuum pauses when cumulative IO cost reaches `autovacuum_vacuum_cost_limit` (default 200) for `autovacuum_vacuum_cost_delay` (default 2ms). On modern NVMe SSDs, `cost_limit` should be raised to 1000-2000.\n4. Per-table overrides: Fine-tune hyperactive tables individually.",
    code: `-- Override autovacuum thresholds on a high-throughput table
ALTER TABLE active_orders SET (
    autovacuum_vacuum_scale_factor = 0.02,     -- trigger at 2% dead tuples instead of 20%
    autovacuum_vacuum_threshold = 1000,
    autovacuum_vacuum_cost_limit = 1000,       -- let worker do more work per round
    autovacuum_vacuum_cost_delay = 2
);

-- Inspect global autovacuum settings
SELECT name, setting, unit, short_desc 
FROM pg_settings 
WHERE name LIKE 'autovacuum%';`,
    recallHint: "Trigger = threshold + scale_factor * live_tuples; default 20% is too high for big tables; tune cost_limit higher for fast SSDs.",
    interviewTip: "Know the specific formula `threshold + scale_factor * live_tup` and explain that default autovacuum is throttled down to protect slow magnetic hard drives from 2005.",
    tags: ["autovacuum", "cost-limit", "scale-factor", "tuning", "performance"]
  }),

  createCard({
    idNum: 20,
    category: "MVCC, Tuples & Storage Internals",
    concept: "Transaction ID Wraparound & Tuple Freezing",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the 32-bit Transaction ID (XID) wraparound problem in PostgreSQL, and how does vacuum freezing prevent catastrophic database shutdown?",
    quickAnswer: "PostgreSQL uses 32-bit transaction IDs, allowing roughly 4.29 billion transactions. PostgreSQL treats XIDs circularly modulo 2^31: 2 billion transactions are considered in the past, and 2 billion are in the future. If a database runs for 2 billion transactions without 'freezing' older tuples, past transactions appear to be in the future, rendering all historical data invisible. PostgreSQL prevents this by running aggressive anti-wraparound autovacuum, eventually forcing a read-only shutdown if ignored.",
    detailedAnswer: "XID Wraparound Mechanics & Freezing:\n1. Circular Arithmetic: If current XID is 2,100,000,000, XID 100 would appear to be in the future without freezing.\n2. Tuple Freezing: Vacuum replaces the `xmin` of old committed rows with a special frozen transaction ID `FrozenTransactionId` (XID 2) or sets the `HEAP_XMIN_FROZEN` bit in `t_infomask`. Frozen tuples are permanently visible to all current and future transactions.\n3. Anti-wraparound autovacuum: Triggered automatically when age reaches `autovacuum_freeze_max_age` (default 200 million). This special vacuum cannot be cancelled and runs until old tuples are frozen.\n4. Fail-safe shutdown: If database age reaches 2^31 - 1,000,000, PostgreSQL halts writes and requires single-user mode `vacuum freeze`.",
    code: `-- Check database age against wraparound emergency threshold (2 billion)
SELECT 
    datname, 
    age(datfrozenxid) AS xid_age,
    2000000000 - age(datfrozenxid) AS xids_remaining_before_forced_shutdown
FROM pg_database
ORDER BY xid_age DESC;

-- Identify tables with the highest XID age
SELECT 
    relname, 
    age(relfrozenxid) AS table_xid_age,
    pg_size_pretty(pg_total_relation_size(oid)) as size
FROM pg_class
WHERE relkind = 'r'
ORDER BY table_xid_age DESC
LIMIT 10;`,
    recallHint: "PostgreSQL 32-bit XIDs wrap around after 2 billion transactions; vacuum freeze marks old tuples permanently committed to prevent data loss.",
    interviewTip: "Mention that anti-wraparound autovacuum can cause sudden massive disk I/O spikes if ignored; production monitors should alert when `datfrozenxid` age crosses 150 million.",
    tags: ["xid-wraparound", "vacuum-freeze", "datfrozenxid", "disaster-prevention", "storage-internals"]
  }),

  createCard({
    idNum: 21,
    category: "MVCC, Tuples & Storage Internals",
    concept: "Visibility Map (VM) and Free Space Map (FSM)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are the Visibility Map (VM) and Free Space Map (FSM) forks accompanying every PostgreSQL relation table?",
    quickAnswer: "Every table in PostgreSQL has three file forks on disk: the main data fork (`_base`), the Free Space Map (`_fsm`), and the Visibility Map (`_vm`). The Free Space Map tracks available insertion space across 8KB pages. The Visibility Map stores two bits per data page: one bit indicates if all tuples on the page are visible to all current and future transactions ('all-visible'), and the second bit indicates whether all tuples are frozen ('all-frozen').",
    detailedAnswer: "Roles of the Forks:\n1. Main Data Fork (`filenode`): Contains actual 8KB heap pages with tuple data.\n2. Free Space Map (`_fsm`): Binary tree structure tracking free byte availability per page. When an `INSERT` arrives, Postgres searches the FSM to find an existing page with enough room before appending a new 8KB block to the file.\n3. Visibility Map (`_vm`):\n   - Skips vacuuming: Autovacuum skips scanning pages marked 'all-frozen'.\n   - Enables Index-Only Scans: Allows the query engine to read values strictly from an index without visiting the heap table if the VM marks the target page 'all-visible'.",
    code: `-- Inspect relation forks and their disk sizes using pg_relation_size
SELECT 
    pg_size_pretty(pg_relation_size('orders', 'main')) AS main_fork_size,
    pg_size_pretty(pg_relation_size('orders', 'fsm'))  AS free_space_map_size,
    pg_size_pretty(pg_relation_size('orders', 'vm'))   AS visibility_map_size;

-- Check visibility map status via pg_visibility extension
CREATE EXTENSION IF NOT EXISTS pg_visibility;
SELECT blkno, all_visible, all_frozen 
FROM pg_visibility('orders') 
LIMIT 5;`,
    recallHint: "FSM tracks free page bytes for inserts; VM tracks all-visible and all-frozen pages, enabling Index-Only Scans and fast vacuum skips.",
    interviewTip: "Index-Only Scans are only possible because of the Visibility Map! If pages are not marked all-visible, Postgres must still fetch the heap tuple to verify MVCC visibility.",
    tags: ["visibility-map", "free-space-map", "file-forks", "index-only-scan", "storage-engine"]
  }),

  createCard({
    idNum: 22,
    category: "MVCC, Tuples & Storage Internals",
    concept: "Index-Only Scans & Heap Fetches Optimization",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why do PostgreSQL Index-Only Scans sometimes report high 'Heap Fetches', and how does VACUUM resolve this?",
    quickAnswer: "Unlike MySQL InnoDB (where secondary indexes contain MVCC transaction data or point to the clustered index), PostgreSQL indexes do not contain `xmin` or `xmax` MVCC visibility information. An Index-Only Scan can only skip reading the table heap if the target data page is flagged as 'all-visible' in the Visibility Map. If dirty updates or un-vacuumed pages exist, Postgres is forced to perform a 'Heap Fetch' for every candidate row to verify visibility.",
    detailedAnswer: "Mechanics of Index-Only Scans:\n1. B-Tree contains the indexed columns and `ctid` pointers, but ZERO MVCC visibility metadata.\n2. When executing an Index-Only Scan, Postgres checks the table's Visibility Map (VM) bit for that page:\n   - Bit = 1 (all-visible): Tuple is guaranteed visible to all active transactions. Postgres returns the value directly from the index without reading the heap disk block.\n   - Bit = 0 (dirty/not all-visible): Postgres MUST read the heap page ('Heap Fetch') to inspect `xmin`/`xmax`.\n3. Resolution: Running `VACUUM` updates the Visibility Map, setting bits to 1 and driving Heap Fetches down to 0.",
    code: `-- Verify Index-Only Scan behavior with EXPLAIN (ANALYZE, BUFFERS)
EXPLAIN (ANALYZE, BUFFERS)
SELECT customer_id, created_at 
FROM orders 
WHERE customer_id = 42;

-- Check output line:
-- "Heap Fetches: 0"  -> 100% pure index read (Visibility Map is clean)
-- "Heap Fetches: 245" -> Autovacuum has not marked pages all-visible yet!

-- Run VACUUM to eliminate heap fetches
VACUUM orders;`,
    recallHint: "PostgreSQL indexes store no MVCC metadata; Index-Only Scans rely on the Visibility Map to avoid heap fetches. VACUUM clears heap fetches.",
    interviewTip: "In interviews, when asked 'Can Postgres do covering indexes without touching the table?', answer 'Yes, but ONLY if the table is vacuumed and pages are marked all-visible in the Visibility Map.'",
    tags: ["index-only-scan", "heap-fetches", "visibility-map", "covering-index", "explain-analyze"]
  }),

  createCard({
    idNum: 23,
    category: "MVCC, Tuples & Storage Internals",
    concept: "TOAST (The Oversized-Attribute Storage Technique)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is TOAST in PostgreSQL, what are the four TOAST storage strategies, and when is data compressed out-of-line?",
    quickAnswer: "TOAST (The Oversized-Attribute Storage Technique) is PostgreSQL's mechanism for storing columns exceeding the standard page size threshold (~2KB, one-fourth of an 8KB page). Large values (long text, JSONB, bytea) are either compressed inline using LZ4 or pglz, or sliced into 2KB chunks and stored out-of-line in a dedicated auxiliary TOAST table (`pg_toast_<oid>`).",
    detailedAnswer: "TOAST Strategies (per-column configuration):\n1. `EXTENDED` (default for text/jsonb): Compresses data first; if still too large, moves data out-of-line into the TOAST table.\n2. `EXTERNAL`: Stores large data out-of-line without compression (ideal for pre-compressed data like JPEGs or encrypted strings to save CPU cycles).\n3. `MAIN`: Compresses data inline; only moves out-of-line as a last resort.\n4. `PLAIN`: Disallows compression and out-of-line storage; data must fit on the 8KB heap page (fixed-width integers, timestamps).\n\nPerformance advantage: Selecting non-TOAST columns does not read the TOAST table from disk, keeping table scans fast.",
    code: `-- Inspect TOAST storage strategy for columns
SELECT 
    attname, 
    storage_type, 
    CASE attstorage
        WHEN 'p' THEN 'plain'
        WHEN 'e' THEN 'external'
        WHEN 'm' THEN 'main'
        WHEN 'x' THEN 'extended'
    END AS toast_strategy
FROM pg_attribute
WHERE attrelid = 'users'::regclass AND attnum > 0;

-- Change column storage strategy to disable compression overhead on PDFs/ZIPs
ALTER TABLE user_files ALTER COLUMN file_bytes SET STORAGE EXTERNAL;

-- Use modern LZ4 compression algorithm instead of default pglz (Postgres 14+)
ALTER TABLE audit_logs ALTER COLUMN payload SET COMPRESSION lz4;`,
    recallHint: "TOAST compresses and slices attributes > 2KB into separate pg_toast tables. Strategies: PLAIN, MAIN, EXTERNAL, EXTENDED.",
    interviewTip: "Highlight that `SELECT *` forces PostgreSQL to assemble and decompress TOAST chunks from disk, whereas selecting only small scalar columns completely skips the TOAST table.",
    tags: ["toast", "compression", "storage-internals", "lz4", "out-of-line-storage"]
  }),

  createCard({
    idNum: 24,
    category: "MVCC, Tuples & Storage Internals",
    concept: "Page Layout Internals (8KB Page Header, Line Pointers, Free Space)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How is an 8KB PostgreSQL database page structured internally between header, line pointers, and heap tuples?",
    quickAnswer: "A standard 8KB PostgreSQL page grows from both ends towards the middle: the Page Header (24 bytes) sits at the top, followed by an array of 4-byte Line Pointers (`ItemIdData`) that grow downwards. The actual row tuples (`HeapTupleHeader` + data) are written from the bottom of the page growing upwards. The gap between the line pointers and the newest tuple is the Free Space.",
    detailedAnswer: "8KB Page Component Breakdown:\n1. PageHeaderData (24 bytes): Contains LSN (Log Sequence Number of last WAL record modifying this page), checksum, and pointer offsets `pd_lower` and `pd_upper`.\n2. Line Pointers (`lp`): 4-byte pointers array. A tuple's `ctid` (e.g. `(0, 3)`) means block 0, line pointer index 3. It points to the byte offset where the tuple begins.\n3. Free Space: Located between `pd_lower` (end of line pointers) and `pd_upper` (start of youngest tuple).\n4. Item Data (Tuples): Allocated from the bottom of the page up.\n5. Special Space: Allocated at the very end of index pages (e.g., B-Tree sibling page links); 0 bytes for heap tables.\n\nWhen a tuple is deleted, only its line pointer is marked unused; defragmentation happens when a page is vacuumed or compacted during an insert.",
    code: `-- Inspect internal 8KB page layout using pageinspect extension
CREATE EXTENSION IF NOT EXISTS pageinspect;

-- Inspect page header of block 0
SELECT * FROM page_header(get_raw_page('users', 0));
-- Shows: lsn, checksum, flags, lower, upper, special, pagesize

-- Inspect individual line pointers inside block 0
SELECT 
    lp, 
    lp_off, 
    lp_flags, 
    lp_len 
FROM heap_page_items(get_raw_page('users', 0)) 
LIMIT 5;`,
    recallHint: "8KB page grows towards the center: header + line pointers grow down from the top; raw tuples grow up from the bottom.",
    interviewTip: "Explain that line pointers provide a stable physical address (`ctid`). Even if a page is defragmented and tuples move internally, the line pointer index does not change, avoiding index updates.",
    tags: ["page-layout", "pageinspect", "line-pointers", "storage-internals", "8kb-page"]
  })
];

module.exports = cards;
