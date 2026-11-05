module.exports = [
  {
    id: "pg-ex-12",
    title: "Granular JSONB Document Mutation with jsonb_set & Subtraction",
    category: "JSONB & Indexing",
    difficulty: "intermediate",
    whatThisCodeCovers: "Updates deeply nested values, merges top-level keys, and removes sensitive attributes from JSONB documents without replacing the whole payload.",
    conceptsCovered: [
      "jsonb_set",
      "Path Mutation",
      "Concatenation Operator (||)",
      "Subtraction Operator (-)",
      "Deep Path Deletion (#-)"
    ],
    code: `-- Perform deep surgical updates on user settings
UPDATE user_profiles 
SET preferences = 
    -- 1. Update deep nested key
    jsonb_set(
        preferences, 
        '{notifications, email, digest}', 
        'true'::jsonb, 
        true -- create missing path
    )
    -- 2. Shallow merge new theme
    || '{"theme": "dark"}'::jsonb
    -- 3. Strip deprecated tracking key
    #- '{security, legacy_token}'
WHERE user_id = 42
RETURNING preferences;`,
    breakdown: [
      "jsonb_set navigates {notifications, email, digest} and atomically updates or inserts the boolean value.",
      "|| merges theme: dark at the root object level.",
      "#- '{security, legacy_token}' deletes the nested key path.",
      "Combines three mutations into a single atomic UPDATE statement."
    ],
    expectedOutput: `preferences
{"theme": "dark", "notifications": {"email": {"digest": true}}}`
  },

  {
    id: "pg-ex-13",
    title: "Advanced SQL/JSON Path Predicates & Filtering",
    category: "JSONB & Indexing",
    difficulty: "advanced",
    whatThisCodeCovers: "Executes complex array filters and extracts matching sub-elements from JSONB documents using ANSI SQL/JSON path queries.",
    conceptsCovered: [
      "jsonb_path_query",
      "jsonb_path_exists",
      "JSONPath Filter Predicates (?@)",
      "Array Slicing in JSONB",
      "ANSI Standard SQL/JSON"
    ],
    code: `-- 1. Filter rows where any high-priority item costs over $500
SELECT id, order_payload
FROM purchase_orders
WHERE jsonb_path_exists(
    order_payload, 
    '$.line_items[*] ? (@.priority == "URGENT" && @.price > 500)'
);

-- 2. Extract matching items as individual rows
SELECT 
    id,
    jsonb_path_query(
        order_payload, 
        '$.line_items[*] ? (@.priority == "URGENT").sku'
    ) AS urgent_sku
FROM purchase_orders;`,
    breakdown: [
      "jsonb_path_exists tests if any array element in line_items matches the boolean filter.",
      "jsonb_path_query unpacks and returns only the matching SKUs directly as a rowset.",
      "Avoids verbose LATERAL jsonb_array_elements joins."
    ],
    expectedOutput: `id   | urgent_sku
1001 | "SKU-SERVER-01"
1001 | "SKU-SWITCH-02"`
  },

  {
    id: "pg-ex-14",
    title: "GIN Operator Class Benchmark: jsonb_ops vs jsonb_path_ops",
    category: "JSONB & Indexing",
    difficulty: "advanced",
    whatThisCodeCovers: "Constructs and compares default GIN indexing (jsonb_ops) against path-optimized GIN indexing (jsonb_path_ops), demonstrating up to 70% storage savings.",
    conceptsCovered: [
      "GIN Operator Classes",
      "jsonb_ops vs jsonb_path_ops",
      "Containment Operator (@>)",
      "Index Size Profiling",
      "Write Amplification Reduction"
    ],
    code: `-- Setup test table
CREATE TABLE telemetry_events (
    id BIGSERIAL PRIMARY KEY,
    metadata JSONB NOT NULL
);

-- 1. Standard GIN index (indexes all keys and values independently)
CREATE INDEX idx_telem_default ON telemetry_events USING gin (metadata);

-- 2. Path-Ops GIN index (hashes path + values together, 3x smaller)
CREATE INDEX idx_telem_path_ops ON telemetry_events USING gin (metadata jsonb_path_ops);

-- Compare index sizes
SELECT 
    pg_size_pretty(pg_relation_size('idx_telem_default')) AS default_size,
    pg_size_pretty(pg_relation_size('idx_telem_path_ops')) AS path_ops_size;`,
    breakdown: [
      "jsonb_ops supports all operators (@>, ?, ?|, ?&) but consumes massive RAM and disk space.",
      "jsonb_path_ops hashes entire paths, reducing index size by 60-70% and accelerating @> containment queries.",
      "Best practice when queries only filter using containment (@>)."
    ],
    expectedOutput: `default_size | path_ops_size
450 MB       | 135 MB`
  },

  {
    id: "pg-ex-15",
    title: "Building Deeply Nested JSON APIs Directly in PostgreSQL",
    category: "JSONB & Indexing",
    difficulty: "intermediate",
    whatThisCodeCovers: "Eliminates application-side N+1 queries by aggregating parent customers and child orders into a single nested JSON API response in one query.",
    conceptsCovered: [
      "jsonb_agg",
      "jsonb_build_object",
      "to_jsonb",
      "Zero-Roundtrip JSON Serialization",
      "COALESCE Empty Array"
    ],
    code: `-- Fetch customer with nested array of order objects
SELECT 
    c.id AS customer_id,
    c.name,
    jsonb_build_object(
        'profile', jsonb_build_object('email', c.email, 'tier', c.tier),
        'orders', COALESCE(
            jsonb_agg(
                jsonb_build_object(
                    'order_id', o.id,
                    'total', o.total_amount,
                    'created_at', o.created_at
                ) ORDER BY o.created_at DESC
            ) FILTER (WHERE o.id IS NOT NULL),
            '[]'::jsonb
        )
    ) AS api_payload
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name, c.email, c.tier;`,
    breakdown: [
      "jsonb_build_object creates structured JSON keys and values.",
      "jsonb_agg collects matching orders into an array ordered by date.",
      "FILTER (WHERE o.id IS NOT NULL) and COALESCE ensure customers with 0 orders return an empty array [] rather than [null].",
      "Serves ready-to-send JSON payloads directly to Node.js/Express."
    ],
    expectedOutput: `customer_id | name  | api_payload
10          | Alice | {"orders": [{"order_id": 99, "total": 250.00}], "profile": {"email": "alice@ex.com", "tier": "gold"}}`
  },

  {
    id: "pg-ex-16",
    title: "Unpacking JSONB Arrays to Relational Rows with jsonb_to_recordset",
    category: "JSONB & Indexing",
    difficulty: "advanced",
    whatThisCodeCovers: "Flattens an array of nested JSON invoice items into typed relational SQL rows with CROSS JOIN LATERAL for easy joins and filtering.",
    conceptsCovered: [
      "jsonb_to_recordset",
      "CROSS JOIN LATERAL",
      "Set-Returning Functions",
      "Typed Virtual Relational Columns",
      "JSON Deserialization"
    ],
    code: `-- Unpack invoice line items into relational columns
SELECT 
    inv.id AS invoice_id,
    inv.customer_id,
    items.sku,
    items.qty,
    items.unit_price,
    (items.qty * items.unit_price) AS line_total
FROM invoices inv,
LATERAL jsonb_to_recordset(inv.payload->'line_items') AS items(
    sku TEXT, 
    qty INT, 
    unit_price NUMERIC(10, 2)
)
WHERE items.qty > 10;`,
    breakdown: [
      "jsonb_to_recordset transforms the JSON array into a virtual relational table.",
      "Explicit column definitions items(sku TEXT, qty INT, unit_price NUMERIC) provide strict typing.",
      "Standard SQL WHERE, ORDER BY, and arithmetic expressions run seamlessly on the unpacked data."
    ],
    expectedOutput: `invoice_id | customer_id | sku        | qty | unit_price | line_total
INV-9001   | 42          | WIDGET-RED | 25  | 14.50      | 362.50`
  },

  {
    id: "pg-ex-17",
    title: "JSON Schema Validation using Native CHECK Constraints",
    category: "JSONB & Indexing",
    difficulty: "intermediate",
    whatThisCodeCovers: "Enforces structural typing, mandatory keys, and value bounds on JSONB columns without installing third-party extensions.",
    conceptsCovered: [
      "CHECK Constraints on JSONB",
      "jsonb_typeof()",
      "Key Existence Check (?&)",
      "Data Integrity",
      "Schema-on-Write"
    ],
    code: `-- Enforce strict JSONB schema on write
CREATE TABLE service_configs (
    service_id TEXT PRIMARY KEY,
    config JSONB NOT NULL,
    CONSTRAINT check_valid_config CHECK (
        -- 1. Must be a JSON object
        jsonb_typeof(config) = 'object' AND
        -- 2. Must contain required keys
        config ?& ARRAY['port', 'workers', 'env'] AND
        -- 3. Port must be a number between 1024 and 65535
        jsonb_typeof(config->'port') = 'number' AND
        (config->>'port')::INT BETWEEN 1024 AND 65535 AND
        -- 4. Environment must match enum values
        config->>'env' IN ('development', 'staging', 'production')
    )
);`,
    breakdown: [
      "Enforces data integrity before rows hit disk storage.",
      "Guarantees that bad API payloads fail immediately with constraint violation errors.",
      "Combines schema flexibility for optional keys with relational rigor for core attributes."
    ],
    expectedOutput: `CREATE TABLE
-- Valid insert:
INSERT INTO service_configs VALUES ('api', '{"port": 8080, "workers": 4, "env": "production"}');
-- Invalid insert fails immediately:
-- INSERT INTO service_configs VALUES ('bad', '{"port": 80}');`
  },

  {
    id: "pg-ex-18",
    title: "Generated Stored Columns on JSONB with Foreign Key Enforcement",
    category: "JSONB & Indexing",
    difficulty: "advanced",
    whatThisCodeCovers: "Extracts scalar fields from JSONB documents into GENERATED ALWAYS AS (expr) STORED columns, enabling Foreign Keys and native B-Tree indexing.",
    conceptsCovered: [
      "GENERATED ALWAYS AS ... STORED",
      "Foreign Keys on JSONB",
      "B-Tree Indexing on Generated Columns",
      "Planner Statistics",
      "PostgreSQL 12+"
    ],
    code: `-- Extract tenant_id from JSONB payload into a relational column
CREATE TABLE tenant_audit_events (
    id BIGSERIAL PRIMARY KEY,
    payload JSONB NOT NULL,
    -- Generated column extracted automatically at write time
    tenant_id INT GENERATED ALWAYS AS ((payload->>'tenant_id')::INT) STORED,
    created_at TIMESTAMPTZ GENERATED ALWAYS AS ((payload->>'timestamp')::TIMESTAMPTZ) STORED
);

-- Enforce Foreign Key referencing tenants table
ALTER TABLE tenant_audit_events 
ADD CONSTRAINT fk_audit_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Standard B-Tree index for tenant searches
CREATE INDEX idx_audit_tenant ON tenant_audit_events (tenant_id, created_at DESC);`,
    breakdown: [
      "GENERATED ALWAYS AS ... STORED extracts and materializes the value into physical heap tuples.",
      "Allows foreign key constraints (impossible directly on JSONB columns).",
      "PostgreSQL collects full statistical histograms on generated columns, optimizing query plans."
    ],
    expectedOutput: `CREATE TABLE
ALTER TABLE
CREATE INDEX`
  },

  {
    id: "pg-ex-19",
    title: "GIN Inverted Indexing on Native PostgreSQL Text Arrays",
    category: "JSONB & Indexing",
    difficulty: "intermediate",
    whatThisCodeCovers: "Indexes multi-tag text arrays using GIN, executing instant array containment (@>) and overlap (&&) searches across millions of records.",
    conceptsCovered: [
      "GIN Index on Arrays",
      "Array Containment (@>)",
      "Array Overlap (&&)",
      "Tag-Based Search",
      "Index Scan Optimization"
    ],
    code: `-- Array table with GIN index
CREATE TABLE knowledge_base_articles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    tags TEXT[] NOT NULL
);

-- GIN inverted index on tags
CREATE INDEX idx_articles_tags_gin ON knowledge_base_articles USING gin (tags);

-- 1. Overlap query: articles tagged with 'postgres' OR 'performance'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM knowledge_base_articles 
WHERE tags && ARRAY['postgres', 'performance'];

-- 2. Containment query: articles tagged with BOTH 'postgres' AND 'replication'
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM knowledge_base_articles 
WHERE tags @> ARRAY['postgres', 'replication'];`,
    breakdown: [
      "GIN index indexes every distinct array element.",
      "Overlap operator && matches if any tag intersects.",
      "Containment operator @> matches if all specified tags exist in the row's array.",
      "Both queries use Bitmap Index Scan via idx_articles_tags_gin."
    ],
    expectedOutput: `Bitmap Heap Scan on knowledge_base_articles
  ->  Bitmap Index Scan on idx_articles_tags_gin
        Index Cond: (tags && '{postgres,performance}'::text[])`
  },

  {
    id: "pg-ex-20",
    title: "Spatial & Geometric Bounding Box Indexing with GiST",
    category: "JSONB & Indexing",
    difficulty: "advanced",
    whatThisCodeCovers: "Uses GiST (Generalized Search Tree) with PostGIS geometric point coordinates to execute nearest-neighbor KNN ordering (<->) and bounding box queries.",
    conceptsCovered: [
      "GiST Indexing",
      "Spatial Bounding Boxes",
      "K-Nearest Neighbors (<->)",
      "PostGIS Geometries",
      "Distance Ordering"
    ],
    code: `-- Enable spatial extension
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE warehouse_locations (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    geo_point GEOMETRY(Point, 4326) NOT NULL
);

-- Create GiST spatial index
CREATE INDEX idx_warehouse_geom ON warehouse_locations USING gist (geo_point);

-- Instant K-Nearest Neighbor (KNN) search: 5 closest warehouses to user coordinates
SELECT 
    name,
    ST_Distance(geo_point, ST_SetSRID(ST_MakePoint(-73.985, 40.748), 4326)::geography) AS distance_meters
FROM warehouse_locations
ORDER BY geo_point <-> ST_SetSRID(ST_MakePoint(-73.985, 40.748), 4326)
LIMIT 5;`,
    breakdown: [
      "GiST indexes multi-dimensional bounding boxes.",
      "<-> operator computes nearest neighbor distance in index traversal order.",
      "Executes sub-millisecond distance sorting across millions of geographic points without calculating distances on every row."
    ],
    expectedOutput: `name                   | distance_meters
Manhattan Depot 01     | 450.25
Queens Distribution    | 3210.80`
  },

  {
    id: "pg-ex-21",
    title: "Time-Series BRIN (Block Range Index) for Multi-Gigabyte Tables",
    category: "JSONB & Indexing",
    difficulty: "advanced",
    whatThisCodeCovers: "Deploys a BRIN index on a 100-million row IoT telemetry table, achieving a 99% smaller index memory footprint compared to B-Tree.",
    conceptsCovered: [
      "BRIN (Block Range Index)",
      "pages_per_range Tuning",
      "Append-Only Data",
      "Physical Correlation",
      "Massive Storage Savings"
    ],
    code: `-- Time-series append-only sensor log
CREATE TABLE iot_telemetry (
    reading_id BIGSERIAL PRIMARY KEY,
    device_id INT NOT NULL,
    recorded_at TIMESTAMPTZ NOT NULL,
    temperature NUMERIC(5, 2)
);

-- Check column physical correlation (must be close to 1.0)
SELECT correlation FROM pg_stats WHERE tablename = 'iot_telemetry' AND attname = 'recorded_at';

-- Create BRIN index with 64 pages per range summary
CREATE INDEX idx_telemetry_time_brin 
ON iot_telemetry 
USING brin (recorded_at) WITH (pages_per_range = 64);

-- Inspect index size: 100M rows index is < 1 MB!
SELECT pg_size_pretty(pg_relation_size('idx_telemetry_time_brin')) AS brin_size;`,
    breakdown: [
      "BRIN stores [min, max] values per 64-page block range.",
      "Consumes 99% less RAM than a B-Tree, fitting entirely in CPU cache.",
      "Ideal for append-only timestamps and auto-increment sequential IDs."
    ],
    expectedOutput: `brin_size
512 kB`
  },

  {
    id: "pg-ex-22",
    title: "Radix Prefix & IP Subnet Indexing with SP-GiST on INET",
    category: "JSONB & Indexing",
    difficulty: "advanced",
    whatThisCodeCovers: "Indexes IP address subnets using Space-Partitioned GiST (SP-GiST) for high-performance network security traffic filtering.",
    conceptsCovered: [
      "SP-GiST (Space-Partitioned GiST)",
      "Radix Trees / Tries",
      "INET and CIDR Types",
      "Subnet Containment (<<=)",
      "Network Routing Performance"
    ],
    code: `-- Network firewall log table
CREATE TABLE firewall_traffic_logs (
    log_id BIGSERIAL PRIMARY KEY,
    client_ip INET NOT NULL,
    bytes_transferred BIGINT
);

-- SP-GiST index on INET column (builds a radix tree)
CREATE INDEX idx_traffic_ip_spgist 
ON firewall_traffic_logs 
USING spgist (client_ip);

-- Fast subnet query: All traffic originating from 192.168.0.0/16
EXPLAIN (ANALYZE, BUFFERS)
SELECT SUM(bytes_transferred) 
FROM firewall_traffic_logs 
WHERE client_ip <<= inet '192.168.0.0/16';`,
    breakdown: [
      "SP-GiST builds non-overlapping space-partitioned radix tries.",
      "Optimized for prefixes and hierarchical clustering (IP subnets, telephone codes).",
      "Subnet operator <<= traverses the trie directly, pruning non-matching IP ranges."
    ],
    expectedOutput: `Index Scan using idx_traffic_ip_spgist on firewall_traffic_logs
  Index Cond: (client_ip <<= '192.168.0.0/16'::inet)`
  }
];
