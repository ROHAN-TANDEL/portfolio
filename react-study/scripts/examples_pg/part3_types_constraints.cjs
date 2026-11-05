module.exports = [
  {
    id: "pg-ex-23",
    title: "Preventing Double Bookings with Exclusion Constraints (EXCLUDE USING gist)",
    category: "Types & Constraints",
    difficulty: "advanced",
    whatThisCodeCovers: "Guarantees database-enforced non-overlapping room reservations using Exclusion Constraints powered by GiST and the btree_gist extension.",
    conceptsCovered: [
      "EXCLUDE USING gist",
      "btree_gist Extension",
      "Range Overlap Operator (&&)",
      "Race-Condition-Free Scheduling",
      "Data Integrity at Engine Level"
    ],
    code: `-- Enable btree_gist to mix scalar types with range types
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE conference_room_bookings (
    booking_id SERIAL PRIMARY KEY,
    room_number INT NOT NULL,
    booking_period TSTZRANGE NOT NULL,
    -- Physically prevents overlapping bookings for the same room
    CONSTRAINT no_overlapping_room_bookings EXCLUDE USING gist (
        room_number WITH =,
        booking_period WITH &&
    )
);

-- First booking succeeds
INSERT INTO conference_room_bookings (room_number, booking_period)
VALUES (101, tstzrange('2026-06-01 10:00:00+00', '2026-06-01 12:00:00+00'));

-- Conflicting overlap FAILS with ExclusionConstraintViolation:
-- INSERT INTO conference_room_bookings (room_number, booking_period)
-- VALUES (101, tstzrange('2026-06-01 11:00:00+00', '2026-06-01 13:00:00+00'));`,
    breakdown: [
      "EXCLUDE USING gist ensures no two rows return TRUE when comparing room_number WITH = AND booking_period WITH &&.",
      "btree_gist enables the standard equality (=) operator on room_number inside the GiST index.",
      "Guarantees ACID reservation integrity even if concurrent web requests submit bookings at the exact same microsecond."
    ],
    expectedOutput: `INSERT 0 1
-- Concurrent collision outputs:
-- ERROR: conflicting key value violates exclusion constraint "no_overlapping_room_bookings"`
  },

  {
    id: "pg-ex-24",
    title: "Continuous Interval Operations with Timestamp Range Types",
    category: "Types & Constraints",
    difficulty: "intermediate",
    whatThisCodeCovers: "Models temporal promotion windows using tstzrange, testing element containment (@>), interval intersection (*), and adjacency (-|-).",
    conceptsCovered: [
      "tstzrange",
      "Range Containment (@>)",
      "Range Intersection (*)",
      "Range Adjacency (-|-)",
      "Inclusive vs Exclusive Bounds"
    ],
    code: `-- Promotions with continuous date boundaries
CREATE TABLE promotional_discounts (
    promo_code TEXT PRIMARY KEY,
    valid_window TSTZRANGE NOT NULL,
    discount_pct NUMERIC(4, 2) NOT NULL
);

INSERT INTO promotional_discounts VALUES 
('SUMMER26', tstzrange('2026-06-01 00:00:00+00', '2026-09-01 00:00:00+00', '[)'), 20.00);

-- 1. Check if promo is valid right now (@> operator)
SELECT promo_code, discount_pct 
FROM promotional_discounts 
WHERE valid_window @> '2026-07-15 12:00:00+00'::TIMESTAMPTZ;

-- 2. Find overlap between promo and a scheduled customer event
SELECT 
    promo_code, 
    valid_window * tstzrange('2026-08-15 00:00:00+00', '2026-09-15 00:00:00+00') AS active_overlap
FROM promotional_discounts;`,
    breakdown: [
      "[) denotes inclusive start bound and exclusive end bound.",
      "@> tests whether a single timestamp falls inside the continuous interval.",
      "* calculates the mathematical intersection between two range intervals.",
      "Eliminates complex multi-condition start_date <= ? AND end_date >= ? SQL logic."
    ],
    expectedOutput: `promo_code | discount_pct
SUMMER26   | 20.00`
  },

  {
    id: "pg-ex-25",
    title: "Reusable Validated Custom DOMAIN Types",
    category: "Types & Constraints",
    difficulty: "intermediate",
    whatThisCodeCovers: "Defines reusable DOMAIN types with built-in regex check constraints and range bounds to standardize email and currency attributes across tables.",
    conceptsCovered: [
      "CREATE DOMAIN",
      "DRY Schema Architecture",
      "Built-in Validation",
      "ALTER DOMAIN",
      "Domain-Driven Value Objects"
    ],
    code: `-- 1. Define validated domain types
CREATE DOMAIN valid_email AS TEXT
CHECK (
    VALUE ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'
);

CREATE DOMAIN positive_usd AS NUMERIC(12, 2)
CHECK (VALUE > 0.00);

-- 2. Use domains in table definitions
CREATE TABLE vendors (
    vendor_id SERIAL PRIMARY KEY,
    billing_email valid_email NOT NULL,
    minimum_order positive_usd NOT NULL
);

-- Valid insert:
INSERT INTO vendors (billing_email, minimum_order) 
VALUES ('orders@acme.com', 500.00);

-- Invalid insert raises: value for domain valid_email violates check constraint
-- INSERT INTO vendors (billing_email, minimum_order) VALUES ('bad-email', 500.00);`,
    breakdown: [
      "DOMAIN encapsulates an underlying type (TEXT/NUMERIC) with built-in CHECK constraints.",
      "Reused across 50 tables, standardizing validation rules.",
      "If rules change, updating the DOMAIN updates validation globally across the entire database."
    ],
    expectedOutput: `CREATE DOMAIN
CREATE DOMAIN
CREATE TABLE
INSERT 0 1`
  },

  {
    id: "pg-ex-26",
    title: "Composite Types (CREATE TYPE AS) in PL/pgSQL Function Signatures",
    category: "Types & Constraints",
    difficulty: "intermediate",
    whatThisCodeCovers: "Declares a custom Composite Type to return structured multi-attribute output from stored procedures and PL/pgSQL functions.",
    conceptsCovered: [
      "CREATE TYPE ... AS",
      "Composite Types",
      "PL/pgSQL Functions",
      "Structured Return Values",
      "Table Column Types"
    ],
    code: `-- Define structured composite return type
CREATE TYPE inventory_reorder_summary AS (
    supplier_name TEXT,
    item_count INT,
    estimated_cost NUMERIC(12, 2)
);

-- Stored function returning the composite type
CREATE OR REPLACE FUNCTION generate_reorder_quote(target_warehouse_id INT)
RETURNS inventory_reorder_summary
LANGUAGE plpgsql AS $$
DECLARE
    result inventory_reorder_summary;
BEGIN
    SELECT 
        s.name, 
        COUNT(i.id), 
        SUM(i.unit_cost * i.reorder_qty)
    INTO result
    FROM inventory i
    JOIN suppliers s ON s.id = i.supplier_id
    WHERE i.warehouse_id = target_warehouse_id AND i.stock_qty < i.reorder_threshold
    GROUP BY s.name
    LIMIT 1;

    RETURN result;
END;
$$;

-- Query the composite result
SELECT (generate_reorder_quote(1)).supplier_name, (generate_reorder_quote(1)).estimated_cost;`,
    breakdown: [
      "CREATE TYPE AS defines named field structures.",
      "Functions return strongly typed record objects rather than generic untyped tuples.",
      "Fields are accessed using (composite_col).field notation."
    ],
    expectedOutput: `supplier_name       | estimated_cost
Industrial Supplies | 14500.00`
  },

  {
    id: "pg-ex-27",
    title: "Array Unnesting with Positional Tracking (WITH ORDINALITY)",
    category: "Types & Constraints",
    difficulty: "intermediate",
    whatThisCodeCovers: "Unpacks PostgreSQL arrays into relational rows while capturing the original 1-based element array positions using WITH ORDINALITY.",
    conceptsCovered: [
      "unnest()",
      "WITH ORDINALITY",
      "Array Unpacking",
      "Positional Tracking",
      "Relational Normalization"
    ],
    code: `-- Unpack prioritizing order of task tags
SELECT 
    t.task_id, 
    tag.element_value AS tag_name, 
    tag.position_index AS priority_rank
FROM project_tasks t,
LATERAL unnest(t.tags_ordered) WITH ORDINALITY AS tag(element_value, position_index)
WHERE t.task_id = 105
ORDER BY tag.position_index ASC;`,
    breakdown: [
      "unnest() expands array elements into separate rows.",
      "WITH ORDINALITY appends a 1-based integer position tracking column.",
      "Preserves original sequence/ranking of elements stored in the array."
    ],
    expectedOutput: `task_id | tag_name | priority_rank
105     | critical | 1
105     | security | 2
105     | backend  | 3`
  },

  {
    id: "pg-ex-28",
    title: "Case-Insensitive Unique Constraints via Expression Indexes",
    category: "Types & Constraints",
    difficulty: "intermediate",
    whatThisCodeCovers: "Enforces unique case-insensitive user accounts (preventing 'Alex@co.com' and 'alex@co.com') using an IMMUTABLE expression index.",
    conceptsCovered: [
      "Expression Index",
      "LOWER() Function",
      "Unique Constraints",
      "IMMUTABLE Functions",
      "Optimizer Index Matching"
    ],
    code: `-- Case-insensitive unique index
CREATE TABLE user_credentials (
    user_id SERIAL PRIMARY KEY,
    raw_email TEXT NOT NULL,
    password_hash TEXT NOT NULL
);

-- Unique expression index on LOWER(raw_email)
CREATE UNIQUE INDEX idx_unique_lower_email 
ON user_credentials (LOWER(raw_email));

-- First insert succeeds
INSERT INTO user_credentials (raw_email, password_hash) 
VALUES ('John.Doe@Example.com', 'hash_123');

-- Colliding case variant fails with unique constraint violation!
-- INSERT INTO user_credentials (raw_email, password_hash) 
-- VALUES ('john.doe@example.com', 'hash_456');

-- Queries using LOWER(raw_email) automatically perform Index Scans
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM user_credentials WHERE LOWER(raw_email) = LOWER('JOHN.DOE@example.com');`,
    breakdown: [
      "Indexes the computed result of LOWER(raw_email).",
      "Enforces case-insensitive uniqueness without mutating the user's preferred casing.",
      "The query planner recognizes the expression match and issues an Index Scan."
    ],
    expectedOutput: `Index Scan using idx_unique_lower_email on user_credentials
  Index Cond: (lower(raw_email) = 'john.doe@example.com'::text)`
  },

  {
    id: "pg-ex-29",
    title: "Partial Unique Indexes for Conditional Business Invariants",
    category: "Types & Constraints",
    difficulty: "intermediate",
    whatThisCodeCovers: "Enforces a strict business constraint that a user can have only ONE active subscription, while permitting unlimited expired or cancelled subscriptions.",
    conceptsCovered: [
      "Partial Unique Index",
      "Conditional Invariants",
      "WHERE Predicate in Index",
      "Index Size Optimization",
      "Business Rule Enforcement"
    ],
    code: `-- Enforce: Only ONE active subscription per user at any given time
CREATE TABLE user_memberships (
    id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    plan_name TEXT NOT NULL,
    status TEXT NOT NULL -- 'ACTIVE', 'CANCELLED', 'EXPIRED'
);

-- Partial unique index strictly on ACTIVE status
CREATE UNIQUE INDEX idx_one_active_sub 
ON user_memberships (user_id) 
WHERE status = 'ACTIVE';

-- 1. Initial active subscription
INSERT INTO user_memberships (user_id, plan_name, status) VALUES (101, 'Pro Plan', 'ACTIVE');

-- 2. User cancels subscription
UPDATE user_memberships SET status = 'CANCELLED' WHERE user_id = 101;

-- 3. User subscribes again (allowed! because prior row is now CANCELLED)
INSERT INTO user_memberships (user_id, plan_name, status) VALUES (101, 'Enterprise Plan', 'ACTIVE');

-- 4. Attempting to insert a SECOND active subscription fails!
-- INSERT INTO user_memberships (user_id, plan_name, status) VALUES (101, 'Extra Plan', 'ACTIVE');`,
    breakdown: [
      "The index only indexes rows matching WHERE status = 'ACTIVE'.",
      "Non-active rows are omitted from the index, saving disk space.",
      "Guarantees that no user ever has duplicate active subscriptions."
    ],
    expectedOutput: `INSERT 0 1
UPDATE 1
INSERT 0 1
-- Fourth insert fails:
-- ERROR: duplicate key value violates unique constraint "idx_one_active_sub"`
  },

  {
    id: "pg-ex-30",
    title: "Time-Ordered Sequential UUID Generation (UUIDv7) for B-Tree Locality",
    category: "Types & Constraints",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements time-ordered UUIDv7 generation in PostgreSQL to prevent random B-Tree page splits and RAM buffer thrashing caused by standard random UUIDv4.",
    conceptsCovered: [
      "UUIDv7",
      "B-Tree Page Splits",
      "Write Locality",
      "Sequential Primary Keys",
      "Storage Engine Performance"
    ],
    code: `-- Pure SQL implementation of time-ordered UUIDv7
CREATE OR REPLACE FUNCTION generate_uuid_v7() 
RETURNS UUID 
LANGUAGE plpgsql AS $$
DECLARE
    unix_ts_ms BIGINT;
    uuid_bytes BYTEA;
BEGIN
    -- Extract current unix epoch milliseconds (48 bits)
    unix_ts_ms := (EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT;
    
    -- Construct 16-byte UUID with time prefix and random entropy
    uuid_bytes := set_byte(
        set_byte(
            gen_random_bytes(16),
            0, (unix_ts_ms >> 40)::INT
        ),
        1, (unix_ts_ms >> 32)::INT
    );
    
    -- Format as standard UUID
    RETURN encode(uuid_bytes, 'hex')::UUID;
END;
$$;

-- Table using sequential UUIDv7 primary keys
CREATE TABLE event_stream (
    event_id UUID PRIMARY KEY DEFAULT generate_uuid_v7(),
    payload JSONB NOT NULL
);

-- Generated keys sort chronologically!
INSERT INTO event_stream (payload) VALUES ('{"event": "start"}');
SELECT event_id, payload FROM event_stream;`,
    breakdown: [
      "Standard UUIDv4 is completely random, causing inserts to scatter across random B-Tree leaf pages.",
      "UUIDv7 embeds a 48-bit millisecond timestamp in the leading bits, ensuring inserts append to the right edge of the B-Tree.",
      "Eliminates B-Tree page fragmentation and reduces disk I/O by 50%+ on high-throughput ingest tables."
    ],
    expectedOutput: `event_id                             | payload
018b3f8a-4a12-7000-8b1e-0123456789ab | {"event": "start"}`
  },

  {
    id: "pg-ex-31",
    title: "Session-Aware TIMESTAMPTZ Storage and Local Display Conversion",
    category: "Types & Constraints",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates that TIMESTAMPTZ stores all datetimes in UTC internally and converts to client session timezones dynamically on retrieval.",
    conceptsCovered: [
      "TIMESTAMPTZ vs TIMESTAMP",
      "UTC Microsecond Storage",
      "Session TimeZone Setting",
      "AT TIME ZONE Operator",
      "Global Application Architecture"
    ],
    code: `-- Setup global events table
CREATE TABLE global_meetings (
    meeting_id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL
);

-- Tokyo coordinator schedules meeting at 3:00 PM JST (+09:00)
INSERT INTO global_meetings (title, scheduled_at) 
VALUES ('Global All-Hands', '2026-06-15 15:00:00+09');

-- Client session in London (UTC+1 / BST)
SET timezone = 'Europe/London';
SELECT title, scheduled_at FROM global_meetings;
-- Output: 2026-06-15 07:00:00+01

-- Client session in New York (UTC-4 / EDT)
SET timezone = 'America/New_York';
SELECT title, scheduled_at FROM global_meetings;
-- Output: 2026-06-15 02:00:00-04

-- Explicit conversion to any target timezone regardless of session
SELECT scheduled_at AT TIME ZONE 'UTC' AS utc_time FROM global_meetings;`,
    breakdown: [
      "PostgreSQL stores all TIMESTAMPTZ values in exactly 8 bytes normalized to UTC.",
      "Displays automatically in the client session's local timezone.",
      "Guarantees that all users globally reference the exact same moment in absolute universal time."
    ],
    expectedOutput: `title            | scheduled_at
Global All-Hands | 2026-06-15 02:00:00-04`
  },

  {
    id: "pg-ex-32",
    title: "Exact Arbitrary-Precision Financial Calculations with NUMERIC",
    category: "Types & Constraints",
    difficulty: "intermediate",
    whatThisCodeCovers: "Contrasts binary floating-point rounding errors in DOUBLE PRECISION with exact accounting calculations using PostgreSQL NUMERIC(18, 4).",
    conceptsCovered: [
      "NUMERIC vs DOUBLE PRECISION",
      "Financial Ledger Math",
      "Binary Rounding Imprecision",
      "Exact Scale and Precision",
      "Data Integrity in FinTech"
    ],
    code: `-- 1. Demonstrate floating point rounding trap
SELECT 
    (0.1::DOUBLE PRECISION + 0.2::DOUBLE PRECISION) AS float_sum,
    (0.1::NUMERIC + 0.2::NUMERIC) AS numeric_sum,
    (0.1::DOUBLE PRECISION + 0.2::DOUBLE PRECISION) = 0.3::DOUBLE PRECISION AS float_equal, -- FALSE!
    (0.1::NUMERIC + 0.2::NUMERIC) = 0.3::NUMERIC AS numeric_equal; -- TRUE!

-- 2. Production double-entry financial ledger schema
CREATE TABLE general_ledger (
    entry_id BIGSERIAL PRIMARY KEY,
    account_number TEXT NOT NULL,
    debit_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    credit_amount NUMERIC(18, 4) NOT NULL DEFAULT 0.0000,
    CONSTRAINT check_positive_debit CHECK (debit_amount >= 0),
    CONSTRAINT check_positive_credit CHECK (credit_amount >= 0)
);`,
    breakdown: [
      "DOUBLE PRECISION uses IEEE 754 binary floating point, where 0.1 + 0.2 evaluates to 0.30000000000000004.",
      "NUMERIC stores digits in exact variable-length decimal chunks, guaranteeing penny-perfect precision.",
      "Mandatory for all financial transactions, ledgers, and billing engines."
    ],
    expectedOutput: `float_sum           | numeric_sum | float_equal | numeric_equal
0.30000000000000004 | 0.3         | f           | t`
  }
];
