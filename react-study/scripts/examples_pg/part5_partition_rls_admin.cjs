module.exports = [
  {
    id: "pg-ex-43",
    title: "Declarative RANGE Table Partitioning with Automated Child Creation",
    category: "Partitioning & Administration",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs a monthly partitioned table for clickstream events with local indexes and demonstrates automatic row routing.",
    conceptsCovered: [
      "PARTITION BY RANGE",
      "Child Table Definitions",
      "Local Index Propagation",
      "Automatic Tuple Routing",
      "Partition Pruning"
    ],
    code: `-- Root partitioned table (holds no physical rows)
CREATE TABLE user_clickstream (
    event_id UUID NOT NULL,
    user_id INT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    url TEXT,
    PRIMARY KEY (event_id, recorded_at) -- Partition key MUST be in primary key!
) PARTITION BY RANGE (recorded_at);

-- Create month child partitions
CREATE TABLE clickstream_2026_01 PARTITION OF user_clickstream
FOR VALUES FROM ('2026-01-01 00:00:00+00') TO ('2026-02-01 00:00:00+00');

CREATE TABLE clickstream_2026_02 PARTITION OF user_clickstream
FOR VALUES FROM ('2026-02-01 00:00:00+00') TO ('2026-03-01 00:00:00+00');

-- Index on parent propagates to all child tables automatically
CREATE INDEX idx_clickstream_user ON user_clickstream (user_id);

-- Insert into root table automatically routes to clickstream_2026_01
INSERT INTO user_clickstream VALUES 
('018b3f8a-4a12-7000-8b1e-0123456789ab', 105, '2026-01-15 14:00:00+00', '/checkout');`,
    breakdown: [
      "PARTITION BY RANGE partitions table by continuous timestamp bounds.",
      "Inserting into user_clickstream automatically routes the row into clickstream_2026_01.",
      "idx_clickstream_user is created automatically across all child partitions."
    ],
    expectedOutput: `CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX
INSERT 0 1`
  },

  {
    id: "pg-ex-44",
    title: "Zero-Downtime Data Purging with DETACH PARTITION CONCURRENTLY",
    category: "Partitioning & Administration",
    difficulty: "advanced",
    whatThisCodeCovers: "Purges 100 million expired rows in milliseconds without write lockouts using PostgreSQL 14+ DETACH PARTITION CONCURRENTLY.",
    conceptsCovered: [
      "DETACH PARTITION CONCURRENTLY",
      "Zero-Downtime Retention",
      "DROP TABLE on Detached Partition",
      "Avoiding Massive DELETE Bloat",
      "PostgreSQL 14+"
    ],
    code: `-- 1. Detach old month online without taking exclusive lock on active table!
ALTER TABLE user_clickstream 
DETACH PARTITION clickstream_2026_01 CONCURRENTLY;

-- 2. clickstream_2026_01 is now an isolated standalone table.
-- Active queries on user_clickstream continue uninterrupted!

-- 3. Drop table instantly (Frees 50GB of disk space in 10ms with ZERO dead tuples!)
DROP TABLE clickstream_2026_01;`,
    breakdown: [
      "Standard DELETE generates gigabytes of WAL logs and dead tuples.",
      "DETACH PARTITION CONCURRENTLY takes weak locks in two short phases.",
      "DROP TABLE reclaims disk space instantly without autovacuum bloat."
    ],
    expectedOutput: `ALTER TABLE (detached online in 150ms)
DROP TABLE (instantaneous disk space reclamation)`
  },

  {
    id: "pg-ex-45",
    title: "Hardened Multi-Tenant Row-Level Security (RLS) with SET LOCAL",
    category: "Security & Multi-Tenancy",
    difficulty: "must-know",
    whatThisCodeCovers: "Implements production multi-tenant RLS where a web application sets the tenant ID via SET LOCAL app.current_tenant_id per transaction.",
    conceptsCovered: [
      "ENABLE ROW LEVEL SECURITY",
      "FORCE ROW LEVEL SECURITY",
      "current_setting()",
      "SET LOCAL Transaction Scope",
      "Pool Poisoning Prevention"
    ],
    code: `-- Setup RLS table
CREATE TABLE tenant_invoices (
    invoice_id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL,
    client_name TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL
);

ALTER TABLE tenant_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenant_invoices FORCE ROW LEVEL SECURITY; -- Enforce even on table owners!

-- Strict policy filtering on session parameter
CREATE POLICY tenant_isolation_policy ON tenant_invoices
FOR ALL
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::INT)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::INT);

-- Web application request execution:
BEGIN;
SET LOCAL app.current_tenant_id = '42'; -- Scoped strictly to this transaction!

-- Sees only tenant 42's invoices
SELECT * FROM tenant_invoices;

-- Inserting row with mismatched tenant_id fails with RLS policy violation
-- INSERT INTO tenant_invoices (tenant_id, client_name, amount) VALUES (99, 'Bad Corp', 100);

COMMIT; -- Automatically resets app.current_tenant_id!`,
    breakdown: [
      "FORCE ROW LEVEL SECURITY ensures even connections running as table owner are restricted.",
      "SET LOCAL app.current_tenant_id confines tenant context strictly to the single transaction, preventing connection pool leaks.",
      "WITH CHECK prevents cross-tenant data tampering."
    ],
    expectedOutput: `invoice_id | tenant_id | client_name | amount
101        | 42        | Acme Corp   | 1450.00`
  },

  {
    id: "pg-ex-46",
    title: "InitPlan Performance Optimization for Row-Level Security Policies",
    category: "Security & Multi-Tenancy",
    difficulty: "advanced",
    whatThisCodeCovers: "Optimizes slow RLS policies by wrapping session context calls in a scalar subquery, forcing evaluation as an O(1) InitPlan.",
    conceptsCovered: [
      "RLS InitPlan Optimization",
      "O(1) vs O(N) RLS Evaluation",
      "Scalar Subquery in USING",
      "Index Scan Promotion",
      "EXPLAIN ANALYZE Verification"
    ],
    code: `-- Index on tenant_id
CREATE INDEX idx_invoices_tenant ON tenant_invoices (tenant_id);

-- FAST OPTIMIZED POLICY:
-- Wrapping current_setting in (SELECT ...) forces Postgres to evaluate it ONCE as an InitPlan!
CREATE POLICY fast_tenant_rls ON tenant_invoices
FOR ALL
USING (
    tenant_id = (SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::INT)
);

-- Verify execution plan:
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM tenant_invoices;

-- Plan reveals:
-- InitPlan 1 (returns $0)
--   -> Result (evaluates current_setting ONCE at startup)
-- Index Scan using idx_invoices_tenant on tenant_invoices (condition: tenant_id = $0)`,
    breakdown: [
      "Without the subquery, current_setting() can be evaluated per row ($O(N)$).",
      "The (SELECT ...) wrapper generates an InitPlan evaluated once at query startup ($O(1)$).",
      "Promotes sequential scans into blazing fast Index Scans."
    ],
    expectedOutput: `InitPlan 1 (returns $0)
  ->  Result
Index Scan using idx_invoices_tenant on tenant_invoices (cost=... rows=... width=...)
  Index Cond: (tenant_id = $0)`
  },

  {
    id: "pg-ex-47",
    title: "Dynamic Schema-per-Tenant Switching with SET LOCAL search_path",
    category: "Security & Multi-Tenancy",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements the Nexora Schema-per-Tenant pattern, safely switching the active search_path per transaction without connection pool contamination.",
    conceptsCovered: [
      "Schema-per-Tenant",
      "SET LOCAL search_path",
      "TenantWrapper Architecture",
      "Transaction Boundaries",
      "Pool Sanitation"
    ],
    code: `-- Nexora Multi-Tenant Client Transaction Execution
BEGIN;

-- 1. Switch active tenant schema strictly for this single transaction
SET LOCAL search_path = tenant_recover_client_101, public;

-- 2. Execute business queries with unqualified table names
SELECT debtor_id, total_outstanding, status 
FROM debtors 
WHERE status = 'ACTIVE';

-- 3. Commit releases connection back to PgBouncer cleanly
COMMIT;

-- Verify default path outside transaction remains untouched
SHOW search_path; -- public, pg_catalog`,
    breakdown: [
      "SET LOCAL search_path dynamically maps unqualified table names (e.g. debtors) to the tenant schema.",
      "Automatic rollback/commit reset prevents cross-tenant data contamination in recycled connection pools.",
      "The foundational architecture of Nexora Recover Client pools."
    ],
    expectedOutput: `debtor_id | total_outstanding | status
D-8821    | 4500.00           | ACTIVE`
  },

  {
    id: "pg-ex-48",
    title: "Column-Level AES-256 Encryption & Blind Indexing with pgcrypto",
    category: "Security & Multi-Tenancy",
    difficulty: "advanced",
    whatThisCodeCovers: "Encrypts sensitive customer SSNs using AES-256 with pgcrypto and implements an HMAC blind index for fast exact equality lookups.",
    conceptsCovered: [
      "pgcrypto Extension",
      "pgp_sym_encrypt / decrypt",
      "HMAC Blind Index",
      "BYTEA Storage",
      "PCI-DSS / HIPAA Compliance"
    ],
    code: `-- Enable cryptographic extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE secure_patients (
    patient_id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    ssn_encrypted BYTEA NOT NULL, -- AES-256 encrypted binary payload
    ssn_blind_index TEXT NOT NULL -- SHA-256 HMAC hash for exact searching
);

-- Fast B-Tree index on the blind index string
CREATE INDEX idx_patients_ssn_bindex ON secure_patients (ssn_blind_index);

-- 1. Insert patient record with encryption and blind index
INSERT INTO secure_patients (name, ssn_encrypted, ssn_blind_index)
VALUES (
    'John Doe',
    pgp_sym_encrypt('987-65-4321', 'VAULT_MASTER_KEY_2026'),
    encode(hmac('987-65-4321', 'HMAC_PEPPER_KEY', 'sha256'), 'hex')
);

-- 2. Search by SSN using blind index and decrypt result
SELECT 
    name, 
    pgp_sym_decrypt(ssn_encrypted, 'VAULT_MASTER_KEY_2026') AS decrypted_ssn
FROM secure_patients
WHERE ssn_blind_index = encode(hmac('987-65-4321', 'HMAC_PEPPER_KEY', 'sha256'), 'hex');`,
    breakdown: [
      "pgp_sym_encrypt encrypts data using AES-256 with random salts, preventing frequency analysis.",
      "Blind indexing with HMAC allows fast B-Tree equality lookups without decrypting all rows.",
      "Guarantees that stolen database backups reveal zero plaintext SSNs."
    ],
    expectedOutput: `name     | decrypted_ssn
John Doe | 987-65-4321`
  },

  {
    id: "pg-ex-49",
    title: "Synchronous Audit Logging Trigger with pg_trigger_depth() Protection",
    category: "Security & Multi-Tenancy",
    difficulty: "intermediate",
    whatThisCodeCovers: "Captures full row mutation audit logs inside an ACID trigger, utilizing pg_trigger_depth() to prevent infinite trigger recursion loops.",
    conceptsCovered: [
      "AFTER INSERT OR UPDATE OR DELETE",
      "pg_trigger_depth()",
      "JSONB Old/New Serialization",
      "Session Context Capture",
      "ACID Audit Trail"
    ],
    code: `-- Audit log schema
CREATE TABLE audit_log_entries (
    log_id BIGSERIAL PRIMARY KEY,
    table_name TEXT NOT NULL,
    action TEXT NOT NULL,
    user_id TEXT,
    old_row JSONB,
    new_row JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger function
CREATE OR REPLACE FUNCTION track_audit_history() 
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Prevent infinite trigger recursion loops if audit table triggers another trigger
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    INSERT INTO audit_log_entries (
        table_name, 
        action, 
        user_id, 
        old_row, 
        new_row
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        NULLIF(current_setting('app.current_user_id', true), ''),
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );

    RETURN NEW;
END;
$$;

-- Attach trigger
CREATE TRIGGER audit_accounts_trigger
AFTER INSERT OR UPDATE OR DELETE ON user_accounts
FOR EACH ROW EXECUTE FUNCTION track_audit_history();`,
    breakdown: [
      "Captures synchronous audit records in the same transaction as the modifying operation.",
      "pg_trigger_depth() > 1 terminates cascading recursion safely.",
      "to_jsonb(OLD) and to_jsonb(NEW) serialize row states automatically."
    ],
    expectedOutput: `CREATE FUNCTION
CREATE TRIGGER`
  },

  {
    id: "pg-ex-50",
    title: "Diagnosing Top System Load Queries with pg_stat_statements",
    category: "Partitioning & Administration",
    difficulty: "must-know",
    whatThisCodeCovers: "Configures and queries pg_stat_statements to identify the top 5 queries causing the highest cumulative CPU and disk I/O load.",
    conceptsCovered: [
      "pg_stat_statements",
      "Query Fingerprinting",
      "Cumulative Execution Time",
      "shared_blks_read vs hit",
      "Performance Regressions"
    ],
    code: `-- Enable pg_stat_statements
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 5 queries consuming the most total execution time
SELECT 
    round(total_exec_time::NUMERIC, 2) AS total_time_ms,
    calls,
    round(mean_exec_time::NUMERIC, 2) AS avg_time_ms,
    round((100.0 * total_exec_time / sum(total_exec_time) OVER ())::NUMERIC, 2) AS pct_cluster_load,
    shared_blks_hit,
    shared_blks_read,
    query
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 5;`,
    breakdown: [
      "Normalizes queries into parameter-agnostic signatures.",
      "total_exec_time DESC highlights where database CPU and I/O capacity is being spent.",
      "High shared_blks_read indicates missing indexes causing sequential disk reads."
    ],
    expectedOutput: `total_time_ms | calls  | avg_time_ms | pct_cluster_load | query
1452100.40    | 250000 | 5.81        | 42.15            | SELECT * FROM orders WHERE customer_id = $1`
  },

  {
    id: "pg-ex-51",
    title: "Accelerating Wildcard Substring Searches (LIKE '%term%') with pg_trgm",
    category: "JSONB & Indexing",
    difficulty: "advanced",
    whatThisCodeCovers: "Deploys a GIN trigram index using pg_trgm to accelerate leading wildcard substring searches (LIKE '%pattern%') and regex queries.",
    conceptsCovered: [
      "pg_trgm Extension",
      "Trigram Decomposition",
      "gin_trgm_ops",
      "Wildcard Substring Search",
      "Fuzzy Autocomplete"
    ],
    code: `-- Enable trigram extension
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE customer_directory (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    company TEXT NOT NULL
);

-- Create GIN trigram index on full_name
CREATE INDEX idx_customers_name_trgm 
ON customer_directory 
USING gin (full_name gin_trgm_ops);

-- Leading wildcard query: Uses GIN Index Scan instead of full table scan!
EXPLAIN (ANALYZE, BUFFERS)
SELECT id, full_name, company
FROM customer_directory
WHERE full_name ILIKE '%smith%';

-- Fuzzy typo-tolerant search using similarity operator %
SELECT full_name, similarity(full_name, 'jonathan') AS score
FROM customer_directory
WHERE full_name % 'jonathan'
ORDER BY full_name <-> 'jonathan'
LIMIT 5;`,
    breakdown: [
      "Standard B-Tree cannot accelerate leading wildcard searches LIKE '%term%'.",
      "gin_trgm_ops breaks text into 3-character trigrams and indexes them in an inverted tree.",
      "Executes sub-millisecond substring lookups across millions of names."
    ],
    expectedOutput: `Bitmap Heap Scan on customer_directory
  ->  Bitmap Index Scan on idx_customers_name_trgm
        Index Cond: (full_name ~~* '%smith%'::text)`
  },

  {
    id: "pg-ex-52",
    title: "AI Semantic Vector Similarity Search using pgvector & HNSW",
    category: "Partitioning & Administration",
    difficulty: "advanced",
    whatThisCodeCovers: "Stores 1536-dimensional AI text embeddings with pgvector and performs nearest-neighbor semantic search using a cosine-distance HNSW index.",
    conceptsCovered: [
      "pgvector Extension",
      "vector(1536) Type",
      "HNSW Multi-Layer Graph",
      "Cosine Distance (<=>)",
      "Semantic Hybrid Search"
    ],
    code: `-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_knowledge_chunks (
    chunk_id BIGSERIAL PRIMARY KEY,
    document_title TEXT NOT NULL,
    chunk_text TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL -- OpenAI ada-002 / text-embedding-3 dimension
);

-- State-of-the-art HNSW index for sub-millisecond approximate nearest neighbor search
CREATE INDEX idx_docs_hnsw_cosine 
ON document_knowledge_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Query the 3 most semantically relevant text chunks to a user question vector
SELECT 
    document_title, 
    chunk_text, 
    (1 - (embedding <=> '[0.0125, -0.0452, 0.0891, ...]'::VECTOR)) AS similarity_score
FROM document_knowledge_chunks
ORDER BY embedding <=> '[0.0125, -0.0452, 0.0891, ...]'::VECTOR
LIMIT 3;`,
    breakdown: [
      "vector(1536) stores AI embeddings natively in PostgreSQL.",
      "HNSW constructs a hierarchical navigable small-world graph, providing >99% recall with sub-millisecond latency.",
      "<=> operator calculates cosine distance, unified within the same ACID database as relational metadata."
    ],
    expectedOutput: `document_title          | chunk_text                                          | similarity_score
PostgreSQL Architecture | PostgreSQL processes connections using Postmaster... | 0.942`
  }
];
