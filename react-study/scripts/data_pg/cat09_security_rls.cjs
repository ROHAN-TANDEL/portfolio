const { createCard } = require("../pg_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 97,
    category: "Row-Level Security (RLS) & Multi-Tenancy",
    concept: "Row-Level Security (RLS) Activation & Bypass Mechanics",
    priority: "must-know",
    difficulty: "must-know",
    question: "How do you enable Row-Level Security (RLS) in PostgreSQL, and why does the table owner bypass policies by default?",
    quickAnswer: "RLS is activated via `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY`. By default in PostgreSQL, table owners, superusers, and roles with the `BYPASSRLS` attribute completely bypass all RLS policies. To force RLS policies to apply even to the table owner, you must execute `ALTER TABLE <name> FORCE ROW LEVEL SECURITY`, preventing accidental data exposure by application connection pools logging in as the table owner.",
    detailedAnswer: "RLS Activation Rules:\n1. Default State: When RLS is enabled without any policies defined, a default-deny policy applies: non-exempt roles see 0 rows and cannot insert anything.\n2. Owner Exemption Trap: The table owner automatically bypasses RLS unless `FORCE ROW LEVEL SECURITY` is set.\n3. Superuser Exemption: Superusers (`postgres`) ALWAYS bypass RLS regardless of `FORCE` settings.\n4. Principle of Least Privilege: Application connections should connect as an unprivileged role (e.g. `app_user`) without superuser or bypass rights.",
    code: `-- Enable RLS and force it even on table owners
CREATE TABLE tenant_documents (
    id SERIAL PRIMARY KEY,
    tenant_id INT NOT NULL,
    filename TEXT NOT NULL,
    content TEXT
);

-- 1. Enable RLS
ALTER TABLE tenant_documents ENABLE ROW LEVEL SECURITY;

-- 2. CRITICAL: Force RLS on the table owner to avoid accidental bypasses
ALTER TABLE tenant_documents FORCE ROW LEVEL SECURITY;

-- Check RLS status in system catalogs
SELECT relname, relrowsecurity, relforcerowsecurity 
FROM pg_class 
WHERE relname = 'tenant_documents';`,
    recallHint: "ENABLE ROW LEVEL SECURITY activates RLS; FORCE ROW LEVEL SECURITY enforces it on table owners; superusers always bypass.",
    interviewTip: "Always mention `FORCE ROW LEVEL SECURITY`: forgetting this is the #1 security flaw in PostgreSQL multi-tenant applications connecting as the table owner.",
    tags: ["row-level-security", "rls", "force-rls", "bypass-rls", "security"]
  }),

  createCard({
    idNum: 98,
    category: "Row-Level Security (RLS) & Multi-Tenancy",
    concept: "Defining RLS Policies: USING (Read Filter) vs WITH CHECK (Write Guard)",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is the difference between USING and WITH CHECK clauses in CREATE POLICY?",
    quickAnswer: "`USING` defines which existing rows are visible for `SELECT`, `UPDATE`, and `DELETE` operations (it acts like an invisible `WHERE` clause). `WITH CHECK` validates newly inserted or updated rows (acting like a `CHECK` constraint) to ensure users cannot insert or modify rows into a state that violates the policy. If omitted, `WITH CHECK` defaults to the same expression as `USING`.",
    detailedAnswer: "Policy Clauses Matrix:\n1. `USING (condition)`:\n   - Applied when reading existing rows.\n   - If a row evaluates to false, it is silently excluded from `SELECT`, `UPDATE`, or `DELETE` scans.\n2. `WITH CHECK (condition)`:\n   - Applied when writing new rows (`INSERT` or the new version of an `UPDATE`).\n   - If the incoming row evaluates to false, the statement fails with an explicit `new row violates row-level security policy` error.\n3. Distinct Conditions: E.g., employees can read all tickets (`USING: true`), but can only create tickets assigned to themselves (`WITH CHECK: author_id = current_user_id()`).",
    code: `-- Policy allowing users to view all records in their tenant,
-- but strictly preventing inserting or updating rows into another tenant!
CREATE POLICY tenant_isolation_policy ON tenant_documents
FOR ALL
TO app_user
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::int)
WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::int);`,
    recallHint: "USING filters rows you can see (reads); WITH CHECK validates rows you can create or change (writes).",
    interviewTip: "Explain why `WITH CHECK` is vital: without it, a malicious user could `UPDATE` their row's `tenant_id` to another customer's ID, successfully stealing or corrupting foreign tenant data.",
    tags: ["create-policy", "using-clause", "with-check", "multi-tenancy", "rls-policy"]
  }),

  createCard({
    idNum: 99,
    category: "Row-Level Security (RLS) & Multi-Tenancy",
    concept: "Dynamic Multi-Tenancy with current_setting('app.current_tenant_id')",
    priority: "must-know",
    difficulty: "must-know",
    question: "How do you implement scalable multi-tenancy using current_setting() and SET LOCAL in PostgreSQL?",
    quickAnswer: "Instead of creating thousands of separate database roles, web applications connect using a single shared database pool and inject the active tenant identity into PostgreSQL transaction memory using `SET LOCAL app.current_tenant_id = 'tenant_123'`. RLS policies evaluate `current_setting('app.current_tenant_id')` to filter rows dynamically. Because `SET LOCAL` is transaction-scoped, it automatically resets at `COMMIT`/`ROLLBACK`, completely preventing connection pool cross-tenant contamination.",
    detailedAnswer: "The Nexora / Enterprise Pattern:\n1. Connection Checkout: Application gets a connection from PgBouncer/pool.\n2. Transaction Scope: Issues `BEGIN; SET LOCAL app.current_tenant_id = '105';`.\n3. Query Execution: All queries on RLS tables automatically filter by `tenant_id = 105`.\n4. Transaction Release: Issues `COMMIT;` (or `ROLLBACK;`). `SET LOCAL` variables are destroyed by PostgreSQL engine.\n5. The Second Argument `missing_ok`: Always call `current_setting('app.current_tenant_id', true)`. Passing `true` prevents fatal runtime crashes if the setting has not been initialized yet.",
    code: `-- RLS Policy using session variable
CREATE POLICY tenant_isolation_policy ON customers
FOR ALL
USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::int);

-- Application Transaction Execution
BEGIN;
-- Injected per request by middleware:
SET LOCAL app.current_tenant_id = '42';

-- Transparently sees ONLY tenant 42's data!
SELECT * FROM customers;

-- Attempting to access another tenant returns 0 rows
SELECT * FROM customers WHERE tenant_id = 99; -- Returns empty set!

COMMIT; -- Automatically resets app.current_tenant_id!`,
    recallHint: "SET LOCAL app.current_tenant_id sets transaction-scoped tenant ID; RLS reads it via current_setting('...', true); safe across pooled connections.",
    interviewTip: "Emphasize `SET LOCAL` vs `SET`: standard `SET` persists on the connection, poisoning future pooled requests in PgBouncer; `SET LOCAL` is strictly transaction-scoped.",
    tags: ["current_setting", "set-local", "multi-tenancy", "session-variables", "nexora-pattern"]
  }),

  createCard({
    idNum: 100,
    category: "Row-Level Security (RLS) & Multi-Tenancy",
    concept: "Session Variable Hardening & Type-Safe Casting",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are the security pitfalls of current_setting() in RLS and how do you protect against empty strings and injection?",
    quickAnswer: "`current_setting()` returns raw `text` and throws a fatal error if the variable is unset unless `missing_ok = true` is passed. If unset, it returns `NULL`, but if set to an empty string `''`, casting directly to `::int` causes a runtime query failure. The hardened pattern wraps it in `NULLIF(current_setting('app.current_tenant_id', true), '')::uuid` to ensure safe, type-safe fallback to `NULL`, which evaluates to false in boolean RLS predicates.",
    detailedAnswer: "Hardening Rules:\n1. Always pass `true` as the second argument: `current_setting('namespace.var', true)`. Otherwise, uninitialized sessions crash with `unrecognized configuration parameter`.\n2. Empty String Guard: `NULLIF(val, '')` converts empty strings to `NULL` before typecasting, preventing cast exceptions.\n3. Custom Namespace: Custom variables must contain a dot prefix (e.g. `app.tenant_id` or `nexora.context`); PostgreSQL rejects single-token unreserved variables.\n4. Index Matching: Ensure the cast type (`::int` or `::uuid`) matches the indexed column type exactly, otherwise PostgreSQL cannot use the tenant index.",
    code: `-- Hardened production RLS expression
CREATE OR REPLACE FUNCTION get_active_tenant_id() 
RETURNS INT STABLE LANGUAGE sql AS $$
    SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::int;
$$;

-- Secure policy using helper function
CREATE POLICY strict_tenant_policy ON tenant_orders
FOR ALL
USING (tenant_id = get_active_tenant_id())
WITH CHECK (tenant_id = get_active_tenant_id());`,
    recallHint: "Use current_setting('app.key', true) with NULLIF(..., '') to handle uninitialized or empty variables safely without crashing.",
    interviewTip: "Wrapping `current_setting` in a `STABLE` function allows PostgreSQL to evaluate the tenant ID once per query rather than once per row, giving a 10x performance boost.",
    tags: ["current_setting", "hardening", "type-safety", "nullif", "performance"]
  }),

  createCard({
    idNum: 101,
    category: "Row-Level Security (RLS) & Multi-Tenancy",
    concept: "SECURITY DEFINER vs SECURITY INVOKER & Search Path Exploits",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the difference between SECURITY DEFINER and SECURITY INVOKER in PostgreSQL functions, and how do you prevent search_path injection?",
    quickAnswer: "`SECURITY INVOKER` (default) executes a function with the permissions of the calling user. `SECURITY DEFINER` executes the function with the elevated privileges of the user who created it (similar to UNIX `setuid`). If a `SECURITY DEFINER` function does not explicitly set a secure `search_path`, an attacker can create a malicious table/function in a temporary schema and hijack execution. Secure functions MUST set `SET search_path = pg_catalog, pg_temp`.",
    detailedAnswer: "Security Definer Hijacking Anatomy:\n1. The Attack: If `search_path` is not locked, an attacker creates an object named `lower()` or `now()` in `public` or `pg_temp`. When the elevated function runs, it executes the attacker's fake function.\n2. Remediation Checklist:\n   - Set explicit search_path: `ALTER FUNCTION ... SET search_path = pg_catalog, pg_temp;`.\n   - Revoke public execution: `REVOKE EXECUTE ON FUNCTION ... FROM PUBLIC;`.\n   - Grant execute only to specific roles.",
    code: `-- SECURE SECURITY DEFINER Function Template
CREATE OR REPLACE FUNCTION register_new_tenant(
    p_name TEXT, 
    p_admin_email TEXT
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges of creator
SET search_path = pg_catalog, public, pg_temp -- CRITICAL: Prevents search_path hijacking
AS $$
DECLARE
    new_id INT;
BEGIN
    INSERT INTO system_tenants (name, admin_email) 
    VALUES (p_name, p_admin_email) 
    RETURNING id INTO new_id;
    
    RETURN new_id;
END;
$$;

-- Restrict execution
REVOKE ALL ON FUNCTION register_new_tenant FROM PUBLIC;
GRANT EXECUTE ON FUNCTION register_new_tenant TO app_role;`,
    recallHint: "SECURITY DEFINER runs with creator's elevated rights; MUST specify SET search_path = pg_catalog, pg_temp to prevent code injection.",
    interviewTip: "Any senior PostgreSQL security review looks immediately for `SECURITY DEFINER` functions missing an explicit `SET search_path`.",
    tags: ["security-definer", "security-invoker", "search_path", "privilege-escalation", "hardening"]
  }),

  createCard({
    idNum: 102,
    category: "Row-Level Security (RLS) & Multi-Tenancy",
    concept: "BYPASSRLS vs NOBYPASSRLS Role Attributes",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the BYPASSRLS role attribute in PostgreSQL and how should database roles be partitioned for security?",
    quickAnswer: "`BYPASSRLS` is an explicit role attribute that grants a user permission to ignore all Row-Level Security policies across all tables in the database. Superusers have `BYPASSRLS` by default. Production best practice is creating dedicated `NOBYPASSRLS` application roles for web services and reserving `BYPASSRLS` strictly for background ETL, backup tools (`pg_dump`), and disaster recovery operations.",
    detailedAnswer: "Role Architecture for Multi-Tenant Systems:\n1. Superuser (`postgres`): Full control, auto-bypasses RLS. Never used by web applications.\n2. Tenant Service Role (`app_user`): `LOGIN NOBYPASSRLS NOSUPERUSER`. Mandatory for web APIs.\n3. Backup Role (`backup_user`): `LOGIN BYPASSRLS`. Allows `pg_dump` to back up all tenant rows without getting blocked by RLS policies.\n4. Reporting Role (`analytics_reader`): Scoped with dedicated policies or bypass privileges on sanitized replica databases.",
    code: `-- Create restricted application role with strict RLS enforcement
CREATE ROLE app_user WITH 
    LOGIN 
    PASSWORD 'secure_vault_pw' 
    NOSUPERUSER 
    INHERIT 
    NOCREATEDB 
    NOCREATEROLE 
    NOBYPASSRLS; -- Mandatory: Cannot bypass RLS!

-- Create dedicated backup role that can read all rows for pg_dump
CREATE ROLE backup_agent WITH 
    LOGIN 
    PASSWORD 'backup_vault_pw' 
    NOSUPERUSER 
    BYPASSRLS;

-- Inspect role attributes across system
SELECT rolname, rolsuper, rolbypassrls 
FROM pg_roles 
WHERE rolname IN ('app_user', 'backup_agent');`,
    recallHint: "NOBYPASSRLS enforces RLS on application roles; BYPASSRLS allows backup/ETL tools to dump all rows.",
    interviewTip: "Mention that if you run `pg_dump` using an `app_user` role that lacks `BYPASSRLS`, the backup file will silently be missing all tenant rows protected by RLS!",
    tags: ["bypassrls", "pg_roles", "least-privilege", "pg_dump", "role-management"]
  }),

  createCard({
    idNum: 103,
    category: "Row-Level Security (RLS) & Multi-Tenancy",
    concept: "Multi-Tenant Architectures: DB-per-Tenant vs Schema-per-Tenant vs Shared Table RLS",
    priority: "must-know",
    difficulty: "must-know",
    question: "What are the trade-offs between Database-per-Tenant, Schema-per-Tenant, and Shared-Table with RLS?",
    quickAnswer: "PostgreSQL offers three multi-tenant models: 1) Database-per-Tenant (maximum physical isolation, but impossible to scale past hundreds of tenants due to connection pool and RAM overhead); 2) Schema-per-Tenant (good data isolation via `search_path`, scales to a few thousand schemas before catalog bloat slows migrations); and 3) Shared-Table with RLS (highest tenant density, millions of tenants on single tables, fastest migrations, but requires flawless RLS policies).",
    detailedAnswer: "Architecture Comparison:\n1. Database-per-Tenant:\n   - Pros: Separate encryption keys, easy per-tenant restore.\n   - Cons: Multiplied connection pools, idle RAM waste, complex global reporting.\n2. Schema-per-Tenant (The Nexora Recover Client Pattern):\n   - Pros: Simple tenant drop (`DROP SCHEMA cascade`), clean table names, physical isolation.\n   - Cons: Migrations must loop over every schema; `pg_class` catalog bloat if schemas exceed 5,000.\n3. Shared Table with RLS (The Unified Pattern):\n   - Pros: Single DDL migration updates everyone instantly; scales to millions of tenants; lowest hardware footprint.\n   - Cons: Risk of data leak if RLS policy has a bug; requires `tenant_id` on every table and index.",
    code: `-- Summary comparison in SQL comments
-- 1. Schema-per-Tenant: switch via search_path
SET search_path TO tenant_client_101, public;
SELECT * FROM orders; -- Queries tenant_client_101.orders

-- 2. Shared Table with RLS: switch via session variable
SET LOCAL app.current_tenant_id = '101';
SELECT * FROM orders; -- Transparently filters public.orders WHERE tenant_id = 101`,
    recallHint: "DB-per-tenant = high isolation, high RAM cost; Schema-per-tenant = good isolation, migration overhead; Shared RLS = max density, lowest cost.",
    interviewTip: "Demonstrate architectural maturity by explaining that enterprise SaaS often combines patterns: Shared RLS for small/free tiers, and dedicated Schema/DB for enterprise VIP clients.",
    tags: ["multi-tenancy", "schema-per-tenant", "shared-table-rls", "database-per-tenant", "system-design"]
  }),

  createCard({
    idNum: 104,
    category: "Row-Level Security (RLS) & Multi-Tenancy",
    concept: "Schema-per-Tenant Isolation: Dynamic SET search_path & Tenant Switching",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Schema-per-Tenant isolation work using SET search_path, and how do you protect against connection pool leaks?",
    quickAnswer: "In Schema-per-Tenant architectures, each tenant has an isolated PostgreSQL schema containing identical table definitions. The application switches tenant context per request by executing `SET LOCAL search_path = tenant_schema, public`. Queries simply refer to `SELECT * FROM orders` without tenant prefixes. `SET LOCAL` is mandatory so that the search_path automatically reverts to default when the transaction ends, preventing pooled connection pollution.",
    detailedAnswer: "search_path Mechanics:\n1. Schema Resolution: When an unqualified table name is queried, PostgreSQL traverses the schemas in `search_path` from left to right until the table is found.\n2. Security Isolation: Tenant A cannot see Tenant B's tables unless explicitly granted permissions on Tenant B's schema.\n3. Transaction Boundaries: ALWAYS use `SET LOCAL search_path` inside a transaction block (`BEGIN ... COMMIT`). If plain `SET search_path` is used, a connection returned to a pooler like PgBouncer retains the previous tenant's schema!",
    code: `-- Switching tenant schema safely within a transaction
BEGIN;

-- Scopes search_path strictly to this single transaction
SET LOCAL search_path = tenant_acme_corp, public;

-- Transparently executes against tenant_acme_corp.invoices
SELECT invoice_id, amount, status FROM invoices;

COMMIT; -- Automatically resets search_path to default!

-- Inspect current active search path
SHOW search_path;`,
    recallHint: "SET LOCAL search_path switches active schema per transaction; queries use unqualified table names; automatically resets on COMMIT.",
    interviewTip: "Mention that the Nexora architecture uses `TenantWrapper` to enforce `SET LOCAL search_path` on every multi-tenant client pool checkout.",
    tags: ["schema-per-tenant", "search_path", "set-local", "connection-pooling", "nexora-architecture"]
  }),

  createCard({
    idNum: 105,
    category: "Row-Level Security (RLS) & Multi-Tenancy",
    concept: "Tenant Schema Migration Pipelines & Dynamic DDL Iteration",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you run database migrations across thousands of tenant schemas without locking the entire database?",
    quickAnswer: "Migrating thousands of tenant schemas requires an automated migration pipeline that queries system catalogs for all tenant schemas and executes dynamic DDL statements in controlled, batched transactions. To prevent database-wide locks, migrations should run concurrently across a worker pool, set aggressive `lock_timeout` values per schema, and record migration state in a dedicated schema tracking table.",
    detailedAnswer: "Migration Pipeline Architecture:\n1. Discover Schemas: Query `information_schema.schemata` filtering on tenant schema prefixes (e.g. `TENANT_%`).\n2. Dynamic Execution: Use PL/pgSQL `EXECUTE format('ALTER TABLE %I.orders ADD COLUMN ...', schema_record.schema_name)`.\n3. Independent Transactions: Never run 1,000 schemas in a single massive transaction! If schema 999 fails, all previous 998 roll back and locks are held for hours. Migrate each schema in its own isolated transaction with automated error logging.",
    code: `-- Stored procedure to apply a migration across all tenant schemas
CREATE OR REPLACE PROCEDURE migrate_all_tenant_schemas()
LANGUAGE plpgsql AS $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name LIKE 'tenant_%'
    ) LOOP
        -- Set lock timeout to avoid blocking any individual tenant
        EXECUTE format('SET LOCAL lock_timeout = %L', '2s');
        
        -- Apply migration dynamically
        EXECUTE format(
            'ALTER TABLE %I.customer_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW()', 
            r.schema_name
        );
        
        RAISE NOTICE 'Successfully migrated schema: %', r.schema_name;
    END LOOP;
END;
$$;`,
    recallHint: "Iterate tenant schemas via information_schema.schemata; use dynamic EXECUTE format(); migrate in independent transactions with lock_timeouts.",
    interviewTip: "Highlight that beyond 2,000 schemas, PostgreSQL catalog lookups slow down; at that point, consider migrating to Shared-Table RLS or Citus.",
    tags: ["schema-migration", "dynamic-ddl", "information_schema", "tenant-pipeline", "maintenance"]
  }),

  createCard({
    idNum: 106,
    category: "Row-Level Security (RLS) & Multi-Tenancy",
    concept: "RLS Performance Optimization: Subqueries, Inlining & InitPlans",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why do poorly written RLS policies cause 100x query slowdowns, and how do you optimize them with STABLE functions?",
    quickAnswer: "If an RLS policy contains a non-inlined subquery or evaluates volatile context functions, PostgreSQL may re-execute that subquery for every single row scanned in the table ($O(N)$ execution). To optimize RLS, wrap context lookups into a `STABLE` function or use a scalar subquery `(SELECT current_setting(...))` which allows the optimizer to evaluate the tenant check once as an `InitPlan` ($O(1)$) and apply direct index scans on `tenant_id`.",
    detailedAnswer: "RLS Optimization Mechanics:\n1. The $O(N)$ Trap: An unoptimized policy causes PostgreSQL to evaluate subqueries or permission lookups millions of times.\n2. The InitPlan Solution: Writing `tenant_id = (SELECT NULLIF(current_setting('app.tenant_id', true), '')::int)` forces PostgreSQL to evaluate the right-hand side as an `InitPlan` (evaluated exactly once at query startup).\n3. Index Support: Ensure every table with RLS has a leading index on `tenant_id` (or composite `(tenant_id, created_at)`).\n4. Leakproof Functions: Functions used in RLS must be marked `LEAKPROOF` if you want the optimizer to push user-defined filters down before the security barrier.",
    code: `-- SLOW POLICY: Evaluated repeatedly per row
-- CREATE POLICY bad_policy ON orders USING (tenant_id = current_setting('app.tenant')::int);

-- FAST OPTIMIZED POLICY: Wrapped in scalar subquery -> evaluated ONCE as an InitPlan!
CREATE POLICY fast_tenant_policy ON orders
FOR ALL
USING (
    tenant_id = (SELECT NULLIF(current_setting('app.current_tenant_id', true), '')::int)
);

-- EXPLAIN ANALYZE will show:
-- InitPlan 1 (returns $0)
--   -> Result (evaluates current_setting once)
-- Index Scan using idx_orders_tenant on orders (condition: tenant_id = $0)`,
    recallHint: "Wrap session variables in (SELECT current_setting(...)) to force InitPlan evaluation once per query instead of once per row.",
    interviewTip: "This is a prized senior PostgreSQL tuning secret: changing `tenant_id = current_setting(...)` to `tenant_id = (SELECT current_setting(...))` can speed up queries from 10 seconds to 2 milliseconds.",
    tags: ["rls-optimization", "initplan", "stable-functions", "performance-tuning", "explain-analyze"]
  }),

  createCard({
    idNum: 107,
    category: "Row-Level Security (RLS) & Multi-Tenancy",
    concept: "Column-Level Encryption with pgcrypto (pgp_sym_encrypt)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you implement column-level data encryption at rest in PostgreSQL using the pgcrypto extension?",
    quickAnswer: "PostgreSQL's built-in `pgcrypto` extension provides cryptographic functions for encrypting sensitive columns (SSNs, credit card numbers, health records) using AES-256 via `pgp_sym_encrypt(plaintext, key)` and decrypting via `pgp_sym_decrypt(ciphertext, key)`. Data is stored as binary `BYTEA`, ensuring that even a full disk or backup leak cannot read protected data without the encryption key.",
    detailedAnswer: "pgcrypto Encryption Workflow:\n1. Algorithm: PGP symmetric encryption uses AES-256 with random session keys and IVs (salts), meaning encrypting the exact same string twice yields different ciphertexts (protecting against frequency analysis).\n2. Storage: Encrypted column must be `BYTEA`.\n3. Key Management: Pass the decryption key dynamically via session parameter (`SET LOCAL app.secret_key = '...'`) or decrypt in the application layer.\n4. Search Limitation: You cannot perform B-Tree range scans on symmetrically encrypted data. For equality searches, store an HMAC blind index (`hmac(plaintext, secret, 'sha256')`).",
    code: `-- Enable pgcrypto extension
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE customer_vault (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    -- Store encrypted binary payload
    ssn_encrypted BYTEA NOT NULL,
    -- Blind index for exact equality searches
    ssn_bindex TEXT NOT NULL
);

-- Insert encrypted record with HMAC blind index
INSERT INTO customer_vault (name, ssn_encrypted, ssn_bindex)
VALUES (
    'Alice Smith',
    pgp_sym_encrypt('123-45-6789', 'AES_SECRET_KEY_2026'),
    encode(hmac('123-45-6789', 'HMAC_SALT_KEY', 'sha256'), 'hex')
);

-- Decrypt on retrieval
SELECT 
    name, 
    pgp_sym_decrypt(ssn_encrypted, 'AES_SECRET_KEY_2026') AS decrypted_ssn
FROM customer_vault
WHERE ssn_bindex = encode(hmac('123-45-6789', 'HMAC_SALT_KEY', 'sha256'), 'hex');`,
    recallHint: "pgcrypto provides pgp_sym_encrypt/decrypt for AES-256 column encryption; use HMAC blind index for equality searches.",
    interviewTip: "Always mention blind indexing (HMAC) when discussing encrypted columns: without a blind index, finding an encrypted record forces a full table scan and CPU decryption of every row.",
    tags: ["pgcrypto", "encryption", "aes-256", "blind-index", "security"]
  }),

  createCard({
    idNum: 108,
    category: "Row-Level Security (RLS) & Multi-Tenancy",
    concept: "CDC & Auditing: Trigger-Based Audit Logs vs Logical Replication",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are the trade-offs between trigger-based audit logging and PostgreSQL Logical Replication (WAL-based CDC)?",
    quickAnswer: "Trigger-based auditing (e.g. using `AFTER INSERT OR UPDATE OR DELETE` triggers) captures user context, session variables (`request.user`), and old/new rows synchronously within the same ACID transaction, but incurs write overhead and generates dead tuples. Logical Replication CDC (e.g. Debezium / `pgoutput`) reads database changes asynchronously directly from WAL logs with zero transaction write overhead, but cannot natively inspect application-level session variables.",
    detailedAnswer: "Auditing Comparison:\n1. Trigger-Based Auditing:\n   - Pros: Synchronous guarantee; captures `current_setting('app.user_id')`; transaction rolls back if audit fails.\n   - Cons: Doubles write I/O and WAL generation; potential table lock contention; table bloat on audit tables.\n   - Recursion Protection: Must check `pg_trigger_depth() = 1` to avoid infinite trigger cascade loops.\n2. Logical Replication CDC (WAL-based):\n   - Pros: Zero impact on OLTP write throughput; decouples audit storage to Kafka/Elasticsearch.\n   - Cons: Asynchronous (eventual consistency); requires `REPLICA IDENTITY FULL` to capture prior row values.",
    code: `-- Synchronous Trigger-Based Audit Trigger
CREATE OR REPLACE FUNCTION audit_row_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Prevent trigger recursion
    IF pg_trigger_depth() > 1 THEN
        RETURN NEW;
    END IF;

    INSERT INTO audit_log (
        table_name, 
        operation, 
        user_id, 
        changed_at, 
        old_data, 
        new_data
    ) VALUES (
        TG_TABLE_NAME,
        TG_OP,
        NULLIF(current_setting('app.user_id', true), ''),
        NOW(),
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END
    );

    RETURN NEW;
END;
$$;`,
    recallHint: "Triggers provide synchronous ACID audit logs with session context but add write overhead; Logical Replication (CDC) reads WAL with zero write overhead.",
    interviewTip: "Know when to choose which: regulatory compliance requiring guaranteed synchronous audits uses triggers; high-throughput analytics pipelines use WAL-based CDC (Debezium).",
    tags: ["audit-logging", "change-data-capture", "cdc", "logical-replication", "triggers"]
  })
];

module.exports = cards;
