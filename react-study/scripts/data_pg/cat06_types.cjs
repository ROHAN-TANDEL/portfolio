const { createCard } = require("../pg_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 61,
    category: "PostgreSQL Type System & Constraints",
    concept: "PostgreSQL Native Array Types and Operators (&&, @>, <@, ANY)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do native arrays work in PostgreSQL, and what are the essential array comparison operators?",
    quickAnswer: "PostgreSQL allows any built-in or user-defined type to be stored as a 1-dimensional or multi-dimensional array (e.g. `TEXT[]`, `INT[]`). Arrays support direct containment and overlap operators: `@>` (contains), `<@` (is contained by), `&&` (overlaps/shares any elements), and the scalar constructor `ANY(array)`. When indexed with GIN, array queries execute fast inverted index lookups.",
    detailedAnswer: "Array Operators Matrix:\n1. Overlap (`&&`): `ARRAY[1, 2] && ARRAY[2, 3]` returns `true` (they share `2`).\n2. Contains (`@>`): `ARRAY['a', 'b', 'c'] @> ARRAY['a', 'b']` returns `true`.\n3. Contained By (`<@`): Reverse of contains.\n4. Scalar `ANY`: `WHERE 42 = ANY(user_ids)` tests if scalar 42 is in the array.\n5. Modifying: `array_append(arr, elem)`, `array_remove(arr, elem)`, `array_cat(arr1, arr2)` or `arr || elem`.\n6. Multi-dimensional: Dimensions must be rectangular (e.g. `INT[3][3]`).",
    code: `-- Array operations and GIN indexing
CREATE TABLE user_profiles (
    user_id SERIAL PRIMARY KEY,
    roles TEXT[] NOT NULL DEFAULT ARRAY['viewer'],
    permission_codes INT[] NOT NULL
);

-- GIN index for ultra-fast array containment and overlap queries
CREATE INDEX idx_user_roles_gin ON user_profiles USING gin (roles);

-- Overlap query: users with either 'admin' OR 'auditor' role
SELECT * FROM user_profiles WHERE roles && ARRAY['admin', 'auditor'];

-- Containment query: users with BOTH 'editor' AND 'publisher'
SELECT * FROM user_profiles WHERE roles @> ARRAY['editor', 'publisher'];

-- Scalar ANY match
SELECT * FROM user_profiles WHERE 'admin' = ANY(roles);`,
    recallHint: "&& checks overlap (share any element); @> checks containment; ANY() checks scalar presence; GIN indexes accelerate arrays.",
    interviewTip: "Highlight that `roles && ARRAY[...]` combined with a GIN index avoids creating a many-to-many join table for simple tagging use cases.",
    tags: ["arrays", "array-operators", "overlap-operator", "gin-indexing", "any-scalar"]
  }),

  createCard({
    idNum: 62,
    category: "PostgreSQL Type System & Constraints",
    concept: "Array Unnesting & Aggregation: unnest() vs array_agg()",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do unnest() and array_agg() transform data between relational rows and array values?",
    quickAnswer: "`unnest()` is a set-returning function that expands an array into individual relational rows (one row per element). `array_agg()` is an aggregate function that bundles column values from multiple rows into a single array. Together, they allow seamless bidirectional transformation between normalized row streams and compacted array structures.",
    detailedAnswer: "Transformations and Features:\n1. `unnest(array) WITH ORDINALITY`: Expands array into rows while generating an explicit 1-based index column for position tracking.\n2. Parallel Unnesting: `unnest(array1, array2)` unpacks multiple arrays side-by-side in lockstep.\n3. `array_agg(col ORDER BY col)`: Guarantees deterministic array ordering inside the aggregate call.\n4. Removing Duplicates: `array_agg(DISTINCT col)` collects unique elements into the array.",
    code: `-- 1. Unnest with ordinality to preserve element position
SELECT elem, ord
FROM unnest(ARRAY['first', 'second', 'third']) WITH ORDINALITY AS t(elem, ord);

-- 2. Aggregate tags per blog post into a distinct sorted array
SELECT 
    p.id, 
    p.title,
    COALESCE(array_agg(DISTINCT t.name ORDER BY t.name), ARRAY[]::TEXT[]) AS tag_list
FROM posts p
LEFT JOIN post_tags pt ON pt.post_id = p.id
LEFT JOIN tags t ON t.id = pt.tag_id
GROUP BY p.id, p.title;`,
    recallHint: "unnest() turns arrays into rows (WITH ORDINALITY adds index); array_agg() bundles rows into an array with ORDER BY/DISTINCT.",
    interviewTip: "Always mention `WITH ORDINALITY` when asked about unnesting if element order or positional index matters.",
    tags: ["unnest", "array_agg", "with-ordinality", "set-returning-functions", "aggregates"]
  }),

  createCard({
    idNum: 63,
    category: "PostgreSQL Type System & Constraints",
    concept: "PostgreSQL Range Types & Multi-Ranges (tstzrange, int4range)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are PostgreSQL Range Types and Multi-Ranges, and what problems do they solve compared to separate start/end columns?",
    quickAnswer: "PostgreSQL Range Types (`daterange`, `tstzrange`, `int4range`, `numrange`) store continuous intervals of values as single atomic database types, supporting inclusive `[`/`]` and exclusive `(`/`)` bounds. PostgreSQL 14+ introduced Multi-Ranges (`tstzmultirange`), allowing non-contiguous collections of ranges. They solve temporal interval queries, scheduling, and billing overlaps without complex 4-way `AND`/`OR` boundary comparisons.",
    detailedAnswer: "Range Type Advantages:\n1. Atomic Boundary Logic: A single value `[2026-01-01, 2026-01-10)` cleanly encapsulates both endpoints and bound inclusiveness.\n2. Built-in Operators: Overlap (`&&`), Contains Element (`@>`), Strictly Left Of (`<<`), Adjacent (`-|-`), Union (`+`), and Difference (`-`).\n3. GiST Indexing: Ranges can be indexed using GiST for fast overlap searches.\n4. Multi-Ranges (PostgreSQL 14+): Model disjoint intervals like 'business hours: Monday 9-12 and 1-5' as a single `tsmultirange` column.",
    code: `-- Scheduling table with timestamp range
CREATE TABLE room_reservations (
    booking_id SERIAL PRIMARY KEY,
    room_number INT NOT NULL,
    reservation_period TSTZRANGE NOT NULL
);

-- Find reservations overlapping with a target window
SELECT * FROM room_reservations
WHERE reservation_period && tstzrange(
    '2026-06-15 14:00:00+00', 
    '2026-06-15 16:00:00+00'
);

-- PostgreSQL 14+ Multi-Range for non-contiguous availability
SELECT '{[2026-01-01, 2026-01-05), [2026-01-10, 2026-01-15)}'::datemultirange @> '2026-01-03'::date;
-- Returns TRUE!`,
    recallHint: "Range types store intervals with [) bounds; multi-ranges store disjoint intervals; support && overlap and @> containment.",
    interviewTip: "Contrast range overlap `period && target` with standard SQL `WHERE start <= target_end AND end >= target_start`, which is error-prone regarding inclusive vs exclusive boundary edges.",
    tags: ["range-types", "tstzrange", "multirange", "postgres-14", "temporal-intervals"]
  }),

  createCard({
    idNum: 64,
    category: "PostgreSQL Type System & Constraints",
    concept: "Exclusion Constraints (EXCLUDE USING gist)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is an Exclusion Constraint (EXCLUDE USING gist) in PostgreSQL and why is it impossible with standard UNIQUE constraints?",
    quickAnswer: "Standard `UNIQUE` constraints only test equality (`=`). An Exclusion Constraint guarantees that if any two rows are compared on specified columns using arbitrary operators (such as overlap `&&` or geometric intersection), at least one operator comparison returns false. It enables the database to physically prevent overlapping room bookings, hotel reservations, or conflicting IP subnet allocations at the storage engine level.",
    detailedAnswer: "How Exclusion Constraints Work:\n1. Powered by GiST: Requires a GiST or SP-GiST index under the hood to index multi-dimensional data.\n2. Concurrency Safety: Handled at the index latch level. Even if two clients attempt to insert overlapping bookings at the exact same microsecond, one transaction is immediately aborted with a constraint violation.\n3. Syntax: `EXCLUDE USING gist (resource_id WITH =, time_period WITH &&)`.\n4. Extension Requirement: For mixing scalar types (`int`, `uuid`) with range types, the `btree_gist` extension must be enabled.",
    code: `-- Enable btree_gist to allow equality operator = on scalar columns inside GiST
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE hotel_bookings (
    id SERIAL PRIMARY KEY,
    room_id INT NOT NULL,
    stay_duration DATERANGE NOT NULL,
    -- Prevent overlapping stays for the same room
    CONSTRAINT no_double_booking EXCLUDE USING gist (
        room_id WITH =,
        stay_duration WITH &&
    )
);

-- First booking succeeds
INSERT INTO hotel_bookings (room_id, stay_duration) 
VALUES (101, daterange('2026-07-01', '2026-07-10'));

-- Conflicting overlap FAILS with ExclusionConstraintViolation!
-- INSERT INTO hotel_bookings (room_id, stay_duration) 
-- VALUES (101, daterange('2026-07-05', '2026-07-15'));`,
    recallHint: "EXCLUDE USING gist enforces no overlapping data (&&) across rows; requires btree_gist for scalar = equality.",
    interviewTip: "This is a classic PostgreSQL senior interview question: 'How do you prevent booking overlaps without race conditions?' Answer: `EXCLUDE USING gist`.",
    tags: ["exclusion-constraints", "btree_gist", "double-booking", "concurrency", "data-integrity"]
  }),

  createCard({
    idNum: 65,
    category: "PostgreSQL Type System & Constraints",
    concept: "Custom ENUM Types vs Foreign Key Lookup Tables",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the trade-offs between PostgreSQL ENUM types (CREATE TYPE AS ENUM) and Foreign Key lookup tables?",
    quickAnswer: "PostgreSQL `ENUM` types store values as compact 4-byte internal OIDs, providing strict type-safety, minimal storage, and fast comparisons without table joins. However, removing or renaming enum values requires complex catalog updates or table rewrites, and enum values cannot carry additional metadata. Foreign Key lookup tables allow dynamic additions, soft-deletes, and metadata attributes, but consume more join overhead and storage.",
    detailedAnswer: "ENUM Pros & Cons:\n- Pros: 4 bytes per tuple; human-readable in queries; prevents invalid values at the parser level; faster than string joins.\n- Cons: `ALTER TYPE ... ADD VALUE` cannot be executed inside a transaction block in older Postgres versions (PG 12+ allows it unless used in the same tx); you cannot easily remove a value (`DROP VALUE` does not exist; requires recreating the type).\n- Best Practice: Use ENUMs for static, rarely changing business states (e.g. `order_status: PENDING, PAID, SHIPPED, CANCELLED`). Use FK tables for dynamic or tenant-extensible catalogs.",
    code: `-- Create custom ENUM type
CREATE TYPE payment_status AS ENUM ('PENDING', 'PROCESSING', 'SUCCEEDED', 'FAILED');

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    amount NUMERIC(10, 2) NOT NULL,
    status payment_status NOT NULL DEFAULT 'PENDING'
);

-- Safely add a new value to the ENUM
ALTER TYPE payment_status ADD VALUE 'REFUNDED' AFTER 'SUCCEEDED';

-- Inspect enum labels directly from system catalogs
SELECT enumlabel, enumsortorder 
FROM pg_enum 
WHERE enumtypid = 'payment_status'::regtype 
ORDER BY enumsortorder;`,
    recallHint: "ENUM stores 4-byte OIDs, fast and type-safe; values are hard to delete; use lookup tables if values change dynamically or have metadata.",
    interviewTip: "Warn about the transaction restriction: `ALTER TYPE ... ADD VALUE` cannot be run if the type was already used in the same transaction.",
    tags: ["enum-types", "lookup-tables", "alter-type", "type-safety", "data-modeling"]
  }),

  createCard({
    idNum: 66,
    category: "PostgreSQL Type System & Constraints",
    concept: "DOMAIN Types with Built-In Constraints",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a DOMAIN in PostgreSQL, and how does it promote DRY (Don't Repeat Yourself) database schema design?",
    quickAnswer: "A `DOMAIN` is a user-defined data type based on an underlying primitive type, but augmented with built-in `CHECK` constraints, default values, and `NOT NULL` rules. Once defined, the domain can be reused across dozens of tables. If validation rules change (e.g. international phone number format), updating the domain constraint automatically validates across all referencing tables.",
    detailedAnswer: "Domain Characteristics:\n1. Reusability: Replaces copy-pasting the same regex or range `CHECK` constraint across 20 different tables.\n2. Enforcement: Enforced on all inserts, updates, and function parameters taking that domain.\n3. Modification: Supports `ALTER DOMAIN ... ADD CONSTRAINT` and `ALTER DOMAIN ... DROP CONSTRAINT`.\n4. Clean ERDs: Keeps table DDL declarations clean and standardized across an enterprise codebase.",
    code: `-- Define reusable validated DOMAIN types
CREATE DOMAIN email_address AS TEXT
CHECK (
    VALUE ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'
);

CREATE DOMAIN positive_price AS NUMERIC(12, 2)
CHECK (VALUE > 0.00);

-- Use domains across multiple tables cleanly
CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    email email_address NOT NULL
);

CREATE TABLE vendor_products (
    id SERIAL PRIMARY KEY,
    price positive_price NOT NULL
);

-- Inserting an invalid email raises a domain constraint violation!
-- INSERT INTO customers (email) VALUES ('invalid-email');`,
    recallHint: "DOMAIN is an underlying primitive type + built-in CHECK constraints; reuses validation across multiple tables.",
    interviewTip: "Highlight `DOMAIN` as PostgreSQL's native solution for enforcing domain-driven design (DDD) value objects at the database layer.",
    tags: ["domain-types", "dry-schema", "check-constraints", "value-objects", "data-integrity"]
  }),

  createCard({
    idNum: 67,
    category: "PostgreSQL Type System & Constraints",
    concept: "Composite Types (CREATE TYPE AS) & Structured Returns",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a Composite Type in PostgreSQL and how is it used in table columns and stored procedure return signatures?",
    quickAnswer: "A Composite Type represents the structure of a row or record, composed of named field attributes and data types (`CREATE TYPE address AS (...)`). It can be used as a column data type inside another table (nested row objects) or as the return type for PL/pgSQL stored procedures and functions returning structured multi-column records.",
    detailedAnswer: "Composite Type Properties:\n1. First-Class Type: Every table created in PostgreSQL automatically registers a matching composite type in the system catalog `pg_type` with the same name as the table.\n2. Nested Storage: A table column can contain a composite type: `col.street` accesses sub-fields.\n3. Function Returns: Allows functions to return clean typed records instead of untyped generic tuples.\n4. Literals: Written as `ROW('123 Main St', 'NY', 10001)`.",
    code: `-- Define a reusable composite type
CREATE TYPE physical_address AS (
    street TEXT,
    city TEXT,
    postal_code VARCHAR(10),
    country VARCHAR(2)
);

CREATE TABLE distribution_centers (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    location physical_address NOT NULL
);

-- Insert composite literal
INSERT INTO distribution_centers (name, location)
VALUES ('Warehouse North', ROW('100 Industrial Pkwy', 'Dallas', '75001', 'US'));

-- Query individual sub-fields (parentheses required!)
SELECT (location).city, (location).postal_code 
FROM distribution_centers;`,
    recallHint: "Composite types represent structured rows; every table automatically creates one; access nested fields with (col).field.",
    interviewTip: "Point out the syntax quirk: accessing fields of a composite column requires wrapping the column in parentheses: `(location).city`.",
    tags: ["composite-types", "row-types", "custom-types", "schema-design", "stored-functions"]
  }),

  createCard({
    idNum: 68,
    category: "PostgreSQL Type System & Constraints",
    concept: "Network Address Types (inet, cidr, macaddr) & Bitwise Subnet Queries",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do PostgreSQL network types (inet, cidr, macaddr) prevent IP storage errors and accelerate subnet lookups?",
    quickAnswer: "PostgreSQL features native network address types: `inet` (IPv4 and IPv6 hosts with optional subnets), `cidr` (strict network blocks), and `macaddr` (Ethernet hardware addresses). They validate IP syntax at ingestion and provide specialized bitwise operators (`<<` strictly contained by subnet, `<<=` contained or equals, `>>` contains subnet, and `&&` overlap) that can be indexed with SP-GiST or GiST for instant IP range lookups.",
    detailedAnswer: "inet vs cidr:\n- `inet`: Accepts non-zero host bits after the netmask (e.g. `192.168.1.100/24`).\n- `cidr`: Rejects any non-zero bits to the right of the netmask (e.g. `192.168.1.0/24` is valid; `192.168.1.100/24` raises an error).\n- IPv6 Support: Transparently handles 128-bit IPv6 addresses with identical operators.\n- SP-GiST Indexing: Indexes IP address prefixes as radix trees, allowing instant subnet routing lookups.",
    code: `-- Network access control table
CREATE TABLE firewall_rules (
    rule_id SERIAL PRIMARY KEY,
    allowed_network CIDR NOT NULL,
    action TEXT NOT NULL
);

INSERT INTO firewall_rules (allowed_network, action) 
VALUES ('10.0.0.0/8', 'ALLOW'), ('192.168.1.0/24', 'ALLOW');

-- Check if an incoming client IP is inside an allowed subnet using <<= operator
SELECT action 
FROM firewall_rules 
WHERE inet '192.168.1.42' <<= allowed_network;

-- IP arithmetic: calculate host count or broadcast address
SELECT 
    broadcast(inet '192.168.1.10/24') AS broadcast_addr,
    netmask(inet '192.168.1.10/24') AS netmask_addr;`,
    recallHint: "inet accepts host IPs with masks; cidr enforces zero host bits; <<= tests if IP is inside subnet; SP-GiST indexes them as radix trees.",
    interviewTip: "Never store IP addresses as strings (`VARCHAR(45)`)! Explain that `inet` uses 7 to 19 bytes, enforces validation, and supports native subnet operators.",
    tags: ["inet", "cidr", "macaddr", "network-types", "subnet-lookups"]
  }),

  createCard({
    idNum: 69,
    category: "PostgreSQL Type System & Constraints",
    concept: "Native UUID Generation (gen_random_uuid vs uuid-ossp)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the modern best practice for generating UUIDs in PostgreSQL, and how does gen_random_uuid() differ from uuid-ossp?",
    quickAnswer: "Since PostgreSQL 13, `gen_random_uuid()` is a native core engine function that generates cryptographically secure version 4 (random) UUIDs with zero extensions required. The legacy `uuid-ossp` extension relied on external C-library `libuuid` (`uuid_generate_v4()`). Storing UUIDs in the native 16-byte `UUID` data type is twice as compact and much faster to index than storing 36-character `TEXT` strings.",
    detailedAnswer: "UUID Best Practices:\n1. Native Type: PostgreSQL `UUID` stores 128 bits (16 bytes). Storing UUIDs as `VARCHAR(36)` wastes 20 extra bytes per row and slows down B-Tree comparisons.\n2. Native Generator: PostgreSQL 13+ includes `gen_random_uuid()` directly in the core engine.\n3. Sequential UUIDs (UUIDv7): UUIDv4 is completely random, which causes random B-Tree page splits and cache eviction on high-write tables. PostgreSQL 17 or extensions (like `pg_uuidv7`) introduce time-ordered UUIDv7, which preserves B-Tree write locality.",
    code: `-- Modern PostgreSQL (PG 13+) default UUID table definition
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inspect native UUID size (16 bytes) vs text representation (36+ bytes)
SELECT 
    pg_column_size(gen_random_uuid()) AS uuid_storage_bytes,
    pg_column_size(gen_random_uuid()::text) AS text_storage_bytes;`,
    recallHint: "Use native gen_random_uuid() (built-in since PG13); native UUID is 16 bytes vs 36 bytes for text; beware B-Tree page splits with random UUIDv4.",
    interviewTip: "Mention that UUIDv4 causes B-Tree index fragmentation on large tables because inserts land in random leaf pages; time-ordered UUIDv7 fixes this.",
    tags: ["uuid", "gen_random_uuid", "uuid-v4", "uuid-v7", "primary-keys"]
  }),

  createCard({
    idNum: 70,
    category: "PostgreSQL Type System & Constraints",
    concept: "Temporal Types: TIMESTAMP WITHOUT TIME ZONE vs TIMESTAMPTZ",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why should production enterprise databases almost always use TIMESTAMPTZ instead of TIMESTAMP WITHOUT TIME ZONE?",
    quickAnswer: "`TIMESTAMP WITHOUT TIME ZONE` stores the raw date and time without any timezone context, assuming whatever clock the server or client uses. `TIMESTAMPTZ` (timestamp with time zone) converts all incoming timestamps to UTC and stores them internally as UTC microseconds. When displayed, PostgreSQL automatically converts the stored UTC timestamp to the client session's local timezone (`TimeZone` setting), preventing catastrophic timezone conversion bugs.",
    detailedAnswer: "Internal Mechanics:\n1. Storage: Both types take exactly 8 bytes of storage! `TIMESTAMPTZ` does NOT store an extra timezone offset on disk; it always converts to UTC.\n2. Ingestion: `'2026-06-01 10:00:00+02'::timestamptz` is converted to `2026-06-01 08:00:00` UTC.\n3. Display: Querying `timestamptz` automatically converts the UTC value to whatever `SET timezone = '...'` is active in the connecting connection.\n4. Pitfall of `TIMESTAMP`: Storing a datetime without a timezone means you cannot determine what moment in absolute universal time the event actually occurred.",
    code: `-- Demonstrate session-aware display of TIMESTAMPTZ
CREATE TABLE server_events (
    id SERIAL PRIMARY KEY,
    logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Insert timestamp from Tokyo client (+09)
INSERT INTO server_events (logged_at) VALUES ('2026-06-01 18:00:00+09');

-- Client session in New York (-04)
SET timezone = 'America/New_York';
SELECT logged_at FROM server_events;
-- Output: 2026-06-01 05:00:00-04 (converted seamlessly)

-- Convert explicitly to any timezone
SELECT logged_at AT TIME ZONE 'UTC' AS utc_time FROM server_events;`,
    recallHint: "TIMESTAMPTZ stores in UTC (8 bytes) and converts to client timezone on display; TIMESTAMP WITHOUT TIME ZONE has no timezone context.",
    interviewTip: "Always recommend `TIMESTAMPTZ` for events/logs/created_at. The only valid use for `TIMESTAMP WITHOUT TIME ZONE` is abstract calendar dates (e.g. 'Stores open at 9:00 AM regardless of city').",
    tags: ["timestamptz", "timestamp", "utc", "timezones", "temporal-modeling"]
  }),

  createCard({
    idNum: 71,
    category: "PostgreSQL Type System & Constraints",
    concept: "Arbitrary-Precision NUMERIC/DECIMAL vs Floating-Point DOUBLE PRECISION",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When must you use NUMERIC/DECIMAL instead of REAL/DOUBLE PRECISION in PostgreSQL?",
    quickAnswer: "`NUMERIC` (or `DECIMAL`) provides exact, arbitrary-precision decimal arithmetic without rounding errors, making it mandatory for monetary transactions, currency balances, and financial reporting. `REAL` (float4) and `DOUBLE PRECISION` (float8) use hardware-level IEEE 754 floating-point math, which is faster for scientific computing but suffers from binary rounding imprecisions (e.g. $0.1 + 0.2 \\neq 0.3$).",
    detailedAnswer: "Deep Comparison:\n1. `NUMERIC(precision, scale)`:\n   - Exact decimal representation.\n   - Up to 131,072 digits before decimal point; up to 16,383 digits after.\n   - Software-calculated: Slower CPU calculations than native CPU registers.\n   - Variable storage: 2 bytes per 4 decimal digits + 8 bytes header.\n2. `DOUBLE PRECISION` (float8):\n   - Exact 8 bytes.\n   - Direct hardware CPU execution (extremely fast for machine learning, sensor readings, and statistics).\n   - Inexact: Rounding errors make it illegal for accounting and financial ledgers.",
    code: `-- Demonstrate floating point inaccuracy vs exact numeric
SELECT 
    (0.1::float8 + 0.2::float8) = 0.3::float8 AS float_equality,    -- FALSE! (0.30000000000000004)
    (0.1::numeric + 0.2::numeric) = 0.3::numeric AS numeric_equality; -- TRUE!

-- Financial table definition
CREATE TABLE customer_ledger (
    entry_id BIGSERIAL PRIMARY KEY,
    amount NUMERIC(15, 2) NOT NULL, -- Exact dollars and cents (up to trillions)
    tax_rate NUMERIC(5, 4) NOT NULL  -- Exact percentage (e.g. 0.0825)
);`,
    recallHint: "NUMERIC = exact decimal math, mandatory for money; DOUBLE PRECISION = IEEE 754 hardware float, fast for physics/sensors, inaccurate for cash.",
    interviewTip: "State emphatically: 'Never store financial amounts or account balances in FLOAT or DOUBLE PRECISION; always use NUMERIC/DECIMAL.'",
    tags: ["numeric", "decimal", "floating-point", "financial-data", "precision"]
  }),

  createCard({
    idNum: 72,
    category: "PostgreSQL Type System & Constraints",
    concept: "BYTEA Binary Storage & Hex Format Streaming",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does PostgreSQL store binary data in BYTEA, and how does the hex format escape binary payloads?",
    quickAnswer: "`BYTEA` is PostgreSQL's variable-length binary data type, capable of storing arbitrary byte sequences up to 1GB. Modern PostgreSQL uses the `hex` format by default (starting with `\\x` followed by hexadecimal pairs) rather than legacy octal escape syntax. Binary attributes exceeding ~2KB are automatically compressed and TOASTed out-of-line by the storage engine.",
    detailedAnswer: "BYTEA Handling & Best Practices:\n1. Encoding: Output format is governed by `bytea_output = 'hex'` (`\\x48656c6c6f` for 'Hello').\n2. Functions: `encode(bytes, 'base64')`, `decode('...', 'hex')`, `digest(bytes, 'sha256')` from `pgcrypto`.\n3. Large Files Pitfall: Do NOT store 50MB video files or large PDFs in `BYTEA` columns directly in PostgreSQL. Large binary BLOBs bloat database backups, poison `shared_buffers`, and slow down VACUUM. Store large files in object storage (S3/GCS) and store the URI string in PostgreSQL.",
    code: `-- Storing and hashing binary data
CREATE TABLE security_certificates (
    id SERIAL PRIMARY KEY,
    fingerprint TEXT,
    cert_payload BYTEA NOT NULL
);

-- Insert raw bytes using hex notation
INSERT INTO security_certificates (fingerprint, cert_payload)
VALUES ('sha256_abc', '\x48656c6c6f20576f726c64');

-- Base64 encode bytea on retrieval for JSON API payloads
SELECT 
    id, 
    encode(cert_payload, 'base64') AS base64_payload,
    octet_length(cert_payload) AS byte_size
FROM security_certificates;`,
    recallHint: "BYTEA stores raw binary up to 1GB with \\x hex format; auto-compressed via TOAST; large media should go to object storage (S3) instead.",
    interviewTip: "Distinguish between storing small crypto hashes/tokens in `BYTEA` vs anti-pattern of storing multi-megabyte media files in the database.",
    tags: ["bytea", "binary-data", "hex-format", "base64", "toast-storage"]
  })
];

module.exports = cards;
