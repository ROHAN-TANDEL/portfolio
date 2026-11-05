const { createCard } = require("../pg_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 37,
    category: "JSONB & Semi-Structured Data",
    concept: "JSON vs JSONB (Text Storage vs Decomposed Binary Format)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the internal difference between PostgreSQL's JSON and JSONB data types, and why is JSONB almost always preferred?",
    quickAnswer: "The `json` type stores an exact textual copy of the input string (preserving whitespace, key ordering, and duplicate keys), requiring re-parsing on every query. The `jsonb` (JSON Binary) type parses the input once and stores it in a decomposed binary format (sorted keys, deduplicated, without whitespace). While `jsonb` has a slight ingestion overhead, it enables lightning-fast querying, GIN index support, and binary tree-like key lookups without full document re-parsing.",
    detailedAnswer: "Key Architectural Differences:\n1. Storage Format: `json` is stored as raw text (`varlena`). `jsonb` is stored as an array of 4-byte header descriptors pointing to sorted key and value offsets.\n2. Ingestion vs Query Speed: `json` is faster at pure insertion (no validation or sorting overhead). `jsonb` is exponentially faster at querying and filtering.\n3. Key Ordering & Deduplication: `jsonb` automatically strips extra whitespace, sorts object keys alphabetically, and keeps only the last value if duplicate keys exist.\n4. Indexing: `json` CANNOT be indexed with GIN. `jsonb` natively supports GIN inverted indexes, path queries, and containment operators (`@>`).",
    code: `-- Compare json vs jsonb behavior on duplicate keys and formatting
SELECT 
    '{"b": 1, "a": 2, "a": 99}'::json AS raw_json,       -- Keeps formatting & duplicates
    '{"b": 1, "a": 2, "a": 99}'::jsonb AS binary_jsonb;  -- Sorted, deduplicated: {"a": 99, "b": 1}

-- Inspect disk storage footprint difference
SELECT 
    pg_column_size('{"id": 1, "name": "Antigravity"}'::json) AS json_bytes,
    pg_column_size('{"id": 1, "name": "Antigravity"}'::jsonb) AS jsonb_bytes;`,
    recallHint: "json = raw text string, slow queries, no GIN; jsonb = parsed binary, sorted keys, fast indexing, always prefer jsonb.",
    interviewTip: "Always recommend `jsonb` unless the requirement explicitly demands preserving the exact original whitespace, indentation, or duplicate object keys (e.g. audit logs).",
    tags: ["json", "jsonb", "binary-format", "semi-structured", "storage-internals"]
  }),

  createCard({
    idNum: 38,
    category: "JSONB & Semi-Structured Data",
    concept: "JSONB Extraction Operators (->, ->>, #>, #>>)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the core JSONB extraction operators (->, ->>, #>, #>>) in PostgreSQL and how do their return types differ?",
    quickAnswer: "`->` extracts an object field or array element as `jsonb` (preserving JSON quotes and types). `->>` extracts an object field or array element as plain `text`. `#>` extracts a nested path array as `jsonb` (e.g. `payload #> '{user, address, city}'`). `#>>` extracts a nested path array as plain `text`. The difference between returning `jsonb` vs `text` determines whether the result can be chained or used in string comparisons.",
    detailedAnswer: "Operator Reference Matrix:\n- `doc -> 'key'`: Returns `jsonb`. Can be chained: `doc -> 'user' -> 'address'`.\n- `doc ->> 'key'`: Returns `text`. Cannot be chained. Used in `WHERE` clauses for string matching or numeric casting (`(doc->>'age')::int > 21`).\n- `doc -> 0`: Array index accessor returning `jsonb`.\n- `doc ->> 0`: Array index accessor returning `text`.\n- `doc #> '{a, b, 0}'`: Navigates deep path and returns `jsonb`.\n- `doc #>> '{a, b, 0}'`: Navigates deep path and returns `text`.",
    code: `-- Sample JSONB document
WITH sample_data AS (
    SELECT '{"user": {"id": 101, "roles": ["admin", "editor"], "profile": {"city": "Zurich"}}}'::jsonb AS doc
)
SELECT 
    doc -> 'user' AS user_as_jsonb,               -- returns jsonb
    doc -> 'user' ->> 'id' AS user_id_text,        -- returns text "101"
    (doc -> 'user' ->> 'id')::int AS user_id_int,  -- cast to integer
    doc #> '{user, roles, 0}' AS first_role_jsonb, -- returns '"admin"'::jsonb
    doc #>> '{user, profile, city}' AS city_text  -- returns 'Zurich'::text
FROM sample_data;`,
    recallHint: "Single arrow (->, #>) returns jsonb; double arrow (->>, #>>) returns plain text.",
    interviewTip: "A frequent bug is filtering with `doc -> 'id' = 101` (type error comparing jsonb to integer); explain that one must use `(doc ->> 'id')::int = 101`.",
    tags: ["jsonb-operators", "text-extraction", "path-navigation", "data-types", "syntax"]
  }),

  createCard({
    idNum: 39,
    category: "JSONB & Semi-Structured Data",
    concept: "JSONB Containment & Key Existence Operators (@>, ?, ?|, ?&)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do PostgreSQL JSONB containment (@>) and key existence (?, ?|, ?&) operators work, and how do they leverage GIN indexes?",
    quickAnswer: "The containment operator `@>` tests whether the left JSONB document contains the right JSONB document (e.g. `doc @> '{\"status\": \"ACTIVE\"}'`). The existence operator `?` checks if a specific top-level key or string element exists in a JSONB object or array. `?|` checks if ANY listed string keys exist (OR logic), and `?&` checks if ALL listed keys exist (AND logic). All four operators are natively accelerated by GIN indexes.",
    detailedAnswer: "Operator Mechanics:\n1. Containment (`@>`):\n   - Object: `{\"a\": 1, \"b\": 2} @> '{\"b\": 2}'` is TRUE.\n   - Array: `{\"tags\": [\"db\", \"ai\", \"pg\"]} @> '{\"tags\": [\"ai\"]}'` is TRUE.\n2. Existence (`?`): Tests string key existence: `'{\"name\": \"Alice\"}'::jsonb ? 'name'` is TRUE.\n3. Any Existence (`?|`): `'{\"env\": \"prod\"}'::jsonb ?| array['staging', 'prod']` is TRUE.\n4. All Existence (`?&`): `'{\"x\": 1, \"y\": 2}'::jsonb ?& array['x', 'y']` is TRUE.\n5. Index Acceleration: GIN indexes index every sub-key and leaf value, allowing these four operators to execute index scans without touching the heap.",
    code: `-- Querying with containment operator @> (Index Accelerated)
SELECT * FROM customer_profiles 
WHERE metadata @> '{"tier": "enterprise", "country": "CH"}';

-- Checking if an array contains an element
SELECT * FROM events 
WHERE tags @> '["security_alert"]';

-- Checking if document has the 'billing_address' key
SELECT * FROM invoices 
WHERE data ? 'billing_address';

-- Checking if document contains either 'vat_id' OR 'tax_code'
SELECT * FROM invoices 
WHERE data ?| array['vat_id', 'tax_code'];`,
    recallHint: "@> = contains target structure, ? = key exists, ?| = any key exists (OR), ?& = all keys exist (AND). All use GIN indexes.",
    interviewTip: "Highlight that containment `@>` is structural and type-aware: `'[1, 2]'::jsonb @> '[1]'::jsonb` matches numbers, not just raw text substrings.",
    tags: ["jsonb-containment", "gin-indexing", "key-existence", "operators", "performance"]
  }),

  createCard({
    idNum: 40,
    category: "JSONB & Semi-Structured Data",
    concept: "GIN Operator Classes: jsonb_ops vs jsonb_path_ops",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the difference between the default jsonb_ops and jsonb_path_ops GIN operator classes in PostgreSQL?",
    quickAnswer: "`jsonb_ops` (default) creates an index entry for every individual key, value, and path element, supporting all operators (`@>`, `?`, `?|`, `?&`). `jsonb_path_ops` hashes each entire path down to leaf values (e.g. hash of `user.profile.country = CH`), creating an index that is up to 70% smaller and significantly faster, but ONLY supports the containment operator (`@>`).",
    detailedAnswer: "Deep Comparison:\n1. `jsonb_ops` (Default):\n   - Indexes keys and values independently.\n   - Size: Very large (can easily exceed table size).\n   - Capabilities: Supports `@>`, `?`, `?|`, `?&`.\n2. `jsonb_path_ops`:\n   - Hashes full paths together with values into 32-bit integer hashes.\n   - Size: Minimal footprint (1/3 the size of `jsonb_ops`).\n   - Capabilities: Exclusively supports containment queries (`@>`). Does NOT support key existence checks (`?`, `?|`, `?&`).\n3. Best Practice: If your queries strictly use `@>` containment searches, ALWAYS specify `USING gin (col jsonb_path_ops)` to save gigabytes of RAM and disk.",
    code: `-- Default GIN index (supports ?, ?|, ?&, and @>)
CREATE INDEX idx_audit_meta_default 
ON audit_logs USING gin (metadata);

-- Highly optimized path-ops GIN index (3x smaller, supports only @>)
CREATE INDEX idx_audit_meta_path_ops 
ON audit_logs USING gin (metadata jsonb_path_ops);

-- Compare index sizes across the two operator classes
SELECT 
    pg_size_pretty(pg_relation_size('idx_audit_meta_default')) AS default_gin_size,
    pg_size_pretty(pg_relation_size('idx_audit_meta_path_ops')) AS path_ops_gin_size;`,
    recallHint: "jsonb_ops = full support (?, ?|, @>), big index; jsonb_path_ops = 3x smaller/faster, but ONLY supports containment (@>).",
    interviewTip: "In architecture reviews, recommend `jsonb_path_ops` whenever the team only queries JSONB with `@>` to prevent runaway index storage bloat.",
    tags: ["jsonb_ops", "jsonb_path_ops", "gin", "operator-classes", "index-optimization"]
  }),

  createCard({
    idNum: 41,
    category: "JSONB & Semi-Structured Data",
    concept: "SQL/JSON Path Language (jsonb_path_query, jsonb_path_exists)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does PostgreSQL's SQL/JSON Path language work (jsonb_path_query, jsonb_path_exists) and what syntax does it use?",
    quickAnswer: "PostgreSQL 12+ implements the ANSI SQL/JSON Path standard (`JSONPath`), allowing complex navigation, array slicing, and predicate filtering directly inside JSONB documents using expressions starting with `$` (the root document). Functions include `jsonb_path_query()` (returns all matching elements as rows), `jsonb_path_exists()` (boolean test), and `jsonb_path_match()` (boolean predicate).",
    detailedAnswer: "JSONPath Syntax Elements:\n- `$` represents the root JSONB document.\n- `.key` represents member access.\n- `[*]`, `[0 to 2]` represents array access and slicing.\n- `?(@.condition)` represents filter expressions where `@` is the current node.\n- Comparison operators: `==`, `!=`, `<`, `<=`, `>`, `>=`, `like_regex`, `starts with`.\n- `jsonb_path_query(target, path)`: Unpacks matching elements into a relational row stream.\n- `jsonb_path_exists(target, path)`: Tests if any element matches the filter, ideal for `WHERE` clauses.",
    code: `-- Filter users who have an active order with total > 500
SELECT id, metadata
FROM customer_orders
WHERE jsonb_path_exists(
    metadata, 
    '$.orders[*] ? (@.status == "ACTIVE" && @.total > 500)'
);

-- Extract all email addresses from a list of contacts inside JSONB
SELECT jsonb_path_query(
    '{"contacts": [{"type": "work", "email": "w@co.com"}, {"type": "home", "email": "h@me.com"}]}'::jsonb,
    '$.contacts[*] ? (@.type == "work").email'
) AS work_email;`,
    recallHint: "SQL/JSON Path uses $ for root and ?(@.condition) for filters; jsonb_path_query extracts elements, jsonb_path_exists tests presence.",
    interviewTip: "Mention that SQL/JSON Path allows queries like array filtering `$.items[*] ? (@.price > 100)` in a single clean function without needing to `jsonb_array_elements()` join.",
    tags: ["sql-json-path", "jsonpath", "jsonb_path_query", "jsonb_path_exists", "ansi-standard"]
  }),

  createCard({
    idNum: 42,
    category: "JSONB & Semi-Structured Data",
    concept: "Mutating JSONB: jsonb_set, jsonb_insert, Concatenation (||) & Subtraction (-)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you update, insert, merge, and delete keys inside a JSONB document without replacing the whole object?",
    quickAnswer: "PostgreSQL provides specialized operators and functions for granular JSONB mutations: `||` concatenates/merges two objects or appends arrays; `-` deletes a key or array index; `#-` deletes an element at a deep path; `jsonb_set()` updates or inserts a value at an exact path; and `jsonb_insert()` inserts a new value into an array at a specific index without overwriting.",
    detailedAnswer: "JSONB Mutation Operations:\n1. Shallow Merge (`||`): `'{\"a\": 1}'::jsonb || '{\"b\": 2}'::jsonb` yields `{\"a\": 1, \"b\": 2}`. If keys collide, the right-hand value overwrites the left.\n2. Delete Key (`-`): `'{\"a\": 1, \"b\": 2}'::jsonb - 'a'` yields `{\"b\": 2}`.\n3. Delete Deep Path (`#-`): `doc #- '{user, profile, age}'` removes deep nested key.\n4. Modify Deep Value (`jsonb_set`): `jsonb_set(target, path, new_value, create_missing)` modifies an existing path or creates it if `create_missing = true`.\n5. Array Insert (`jsonb_insert`): Inserts before or after a specific array offset.",
    code: `-- 1. Shallow merge / update top-level keys
UPDATE settings 
SET config = config || '{"theme": "dark", "notifications": true}'::jsonb
WHERE user_id = 10;

-- 2. Granular nested update using jsonb_set
UPDATE user_profiles 
SET data = jsonb_set(
    data, 
    '{security, 2fa_enabled}', 
    'true'::jsonb, 
    true -- create path if missing
)
WHERE id = 42;

-- 3. Delete sensitive nested keys using #-
SELECT '{"user": {"ssn": "123-45", "name": "Eve"}}'::jsonb #- '{user, ssn}';
-- Result: {"user": {"name": "Eve"}}`,
    recallHint: "|| merges objects, - deletes key, #- deletes deep path, jsonb_set updates value at path.",
    interviewTip: "Keep in mind that under the hood, PostgreSQL still writes a brand new heap tuple when updating a JSONB field due to MVCC append-only storage.",
    tags: ["jsonb_set", "jsonb-merge", "jsonb_insert", "nested-updates", "mutation"]
  }),

  createCard({
    idNum: 43,
    category: "JSONB & Semi-Structured Data",
    concept: "Aggregating Relational Data into JSON: jsonb_agg & jsonb_object_agg",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do jsonb_agg and jsonb_object_agg aggregate relational tabular rows into nested JSONB documents?",
    quickAnswer: "`jsonb_agg()` aggregates input rows or expressions into a single JSONB array. `jsonb_object_agg()` takes a key and value pair from each row and aggregates them into a single JSONB key-value object. Combining them with `to_jsonb()` and `FILTER` clauses allows building complex, deeply nested JSON APIs directly inside the PostgreSQL database engine in a single database roundtrip.",
    detailedAnswer: "Aggregation Capabilities:\n1. `jsonb_agg(expression)`: Collects rows into `[elem1, elem2, ...]`. Handles `ORDER BY` inside the aggregate call to guarantee deterministic array ordering.\n2. `jsonb_object_agg(key, value)`: Builds `{ key1: val1, key2: val2 }`.\n3. Eliminating N+1 API Calls: Instead of querying orders and making N queries for order items, a single query aggregates items into a nested JSONB array inside the parent row.\n4. Handling NULLs: Aggregates return NULL if no rows match; wrap with `COALESCE(jsonb_agg(...), '[]'::jsonb)` to guarantee safe empty arrays.",
    code: `-- Fetch customer with all nested orders as a single JSONB array
SELECT 
    c.id, 
    c.name,
    COALESCE(
        jsonb_agg(
            jsonb_build_object(
                'order_id', o.id,
                'total', o.total_amount,
                'placed_at', o.created_at
            ) ORDER BY o.created_at DESC
        ) FILTER (WHERE o.id IS NOT NULL),
        '[]'::jsonb
    ) AS orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
GROUP BY c.id, c.name;`,
    recallHint: "jsonb_agg aggregates rows into a JSONB array; jsonb_object_agg creates key-value objects; eliminates N+1 query loops.",
    interviewTip: "Demonstrate building nested JSON API payloads directly in PostgreSQL to save Node.js/Express serialization CPU cycles and network round-trips.",
    tags: ["jsonb_agg", "jsonb_object_agg", "to_jsonb", "jsonb_build_object", "api-generation"]
  }),

  createCard({
    idNum: 44,
    category: "JSONB & Semi-Structured Data",
    concept: "Expanding JSONB into Rows: jsonb_each, jsonb_array_elements & jsonb_to_recordset",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you unpack and expand JSONB arrays and objects into relational rows and columns in PostgreSQL?",
    quickAnswer: "PostgreSQL provides set-returning functions (SRFs) to unpack JSONB: `jsonb_array_elements()` expands a JSONB array into a set of JSONB rows; `jsonb_each()` / `jsonb_each_text()` expands a JSONB object into `(key, value)` rows; and `jsonb_to_recordset()` flattens an array of JSON objects into typed relational columns using an explicit `AS (col type, ...)` schema definition.",
    detailedAnswer: "Unpacking Functions:\n1. `jsonb_array_elements(doc)`: Unnests array items into separate rows. Used frequently with `CROSS JOIN LATERAL`.\n2. `jsonb_each_text(doc)`: Returns key/text-value pairs, great for inspecting dynamic key schemas.\n3. `jsonb_to_recordset(array)`: Converts `[{\"name\": \"A\", \"val\": 1}, ...]` directly into a virtual table where you can apply standard `WHERE`, `JOIN`, and `GROUP BY` logic.\n4. `jsonb_populate_recordset`: Hydrates an existing PostgreSQL composite type or table schema directly from JSONB.",
    code: `-- 1. Unnest JSONB array of tags into rows using CROSS JOIN LATERAL
SELECT p.id, tag.value::text AS individual_tag
FROM posts p,
LATERAL jsonb_array_elements_text(p.metadata->'tags') AS tag;

-- 2. Transform an array of JSON objects into structured typed tabular columns
SELECT items.* 
FROM orders o,
LATERAL jsonb_to_recordset(o.items_json) AS items(
    sku TEXT, 
    qty INT, 
    unit_price NUMERIC(10,2)
)
WHERE items.qty > 5;`,
    recallHint: "jsonb_array_elements unpacks arrays to rows; jsonb_each unpacks keys/values; jsonb_to_recordset maps JSON objects to typed SQL columns.",
    interviewTip: "Emphasize combining `CROSS JOIN LATERAL` with `jsonb_to_recordset` to join relational parent tables with nested JSON array lines.",
    tags: ["jsonb_array_elements", "jsonb_to_recordset", "lateral-join", "json-unpacking", "relational-mapping"]
  }),

  createCard({
    idNum: 45,
    category: "JSONB & Semi-Structured Data",
    concept: "JSONB Normalization & Stripping (jsonb_strip_nulls & Pretty Printing)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does jsonb_strip_nulls optimize JSONB storage, and how does PostgreSQL handle JSON null vs SQL NULL?",
    quickAnswer: "`jsonb_strip_nulls()` recursively scans a JSONB document and strips out all object keys whose values are JSON `null` (it preserves `null` inside arrays). This dramatically reduces on-disk storage for sparse data. In PostgreSQL, a SQL `NULL` column means no value exists in the database tuple, whereas a JSON `null` (`'{\"val\": null}'::jsonb`) is a concrete 1-byte binary JSONB literal token.",
    detailedAnswer: "Null Distinction & Storage Compression:\n1. SQL NULL vs JSON null:\n   - `col IS NULL`: The database column has no data.\n   - `col = 'null'::jsonb`: The column contains a valid 1-byte JSONB token representing null.\n   - `col->>'key' IS NULL`: Key does not exist OR is explicit null.\n2. `jsonb_strip_nulls`:\n   - Input: `{\"a\": 1, \"b\": null, \"c\": {\"d\": null}}`.\n   - Output: `{\"a\": 1, \"c\": {}}`.\n   - Saves storage space and indexes on sparse documents where 90% of optional fields are null.",
    code: `-- Strip null values from a sparse document
SELECT jsonb_strip_nulls('{"first_name": "John", "middle_name": null, "address": {"street": "Main", "apt": null}}'::jsonb);
-- Result: {"address": {"street": "Main"}, "first_name": "John"}

-- Check difference between SQL NULL and JSON null
SELECT 
    NULL::jsonb IS NULL AS is_sql_null,            -- TRUE
    'null'::jsonb IS NULL AS is_json_null_sql,     -- FALSE
    ('{"key": null}'::jsonb -> 'key') = 'null'::jsonb AS is_json_null; -- TRUE`,
    recallHint: "jsonb_strip_nulls removes keys with null values to save storage; SQL NULL is column absence, JSON null is an explicit 1-byte token.",
    interviewTip: "Clarify the distinction between testing if a key is absent (`NOT (data ? 'key')`) vs testing if a key contains JSON null (`data->'key' = 'null'::jsonb`).",
    tags: ["jsonb_strip_nulls", "sql-null", "json-null", "sparse-data", "storage-optimization"]
  }),

  createCard({
    idNum: 46,
    category: "JSONB & Semi-Structured Data",
    concept: "Generated Stored Columns on JSONB Fields",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Generated Columns (STORED) interact with JSONB fields in PostgreSQL, and why use them over expression indexes?",
    quickAnswer: "PostgreSQL 12+ supports Generated Stored Columns (`GENERATED ALWAYS AS (expr) STORED`). By extracting frequently queried JSONB attributes into a typed generated column (e.g. `user_id INT GENERATED ALWAYS AS ((metadata->>'user_id')::int) STORED`), PostgreSQL calculates the value at write time, collects native column statistics, allows standard B-Tree indexing, and supports foreign key constraints that cannot directly reference JSONB fields.",
    detailedAnswer: "Benefits over Expression Indexes:\n1. Foreign Key Enforcement: An expression index cannot be targeted by a foreign key constraint. A generated column CAN enforce foreign keys to other relational tables.\n2. Planner Statistics: PostgreSQL calculates full histogram statistics, n-distinct values, and null counts for generated columns, giving the cost optimizer far better row estimates than generic JSONB GIN indexes.\n3. Transparent ORM Compatibility: ORMs that struggle with custom PostgreSQL JSON operators can query the generated column as a regular relational column.",
    code: `-- Table using a Generated Stored column extracted from JSONB
CREATE TABLE events (
    id BIGSERIAL PRIMARY KEY,
    payload JSONB NOT NULL,
    -- Generated column extracted automatically on write
    tenant_id INT GENERATED ALWAYS AS ((payload->>'tenant_id')::int) STORED,
    event_type TEXT GENERATED ALWAYS AS (payload->>'event_type') STORED
);

-- Foreign key constraint on the generated column
ALTER TABLE events 
ADD CONSTRAINT fk_events_tenant 
FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE;

-- Standard B-Tree index on the generated column
CREATE INDEX idx_events_tenant_event ON events (tenant_id, event_type);`,
    recallHint: "GENERATED ALWAYS AS (expr) STORED extracts JSONB fields into typed columns, enabling foreign keys, optimizer stats, and simple B-Trees.",
    interviewTip: "Highlight that generated columns bridge the gap between NoSQL document flexibility and relational schema constraints (like Foreign Keys).",
    tags: ["generated-columns", "stored-columns", "foreign-keys", "jsonb-indexing", "query-planner"]
  }),

  createCard({
    idNum: 47,
    category: "JSONB & Semi-Structured Data",
    concept: "JSON Schema Validation in PostgreSQL using CHECK Constraints",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How can PostgreSQL enforce strict structural validation and type constraints on JSONB columns without third-party extensions?",
    quickAnswer: "PostgreSQL enforces JSON validation natively using SQL `CHECK` constraints combined with JSONB functions (`jsonb_typeof()`, `jsonb_path_exists()`, and key checks `?`). This prevents bad API payloads from corrupting the semi-structured column, guaranteeing required keys exist, types match expected schemas, and value ranges are respected before the transaction commits.",
    detailedAnswer: "Validation Techniques:\n1. Required Keys: `CHECK (data ? 'email' AND data ? 'role')`.\n2. Data Types: `CHECK (jsonb_typeof(data->'age') = 'number')`.\n3. Value Ranges & Enums: `CHECK (data->>'role' IN ('admin', 'member', 'viewer'))`.\n4. Format Checking: `CHECK (data->>'email' ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$')`.\n5. Zero Runtime Penalty on Reads: Validation is strictly enforced at `INSERT`/`UPDATE` time; zero read overhead.",
    code: `-- Enforce strict JSONB schema integrity via CHECK constraints
CREATE TABLE user_profiles (
    id SERIAL PRIMARY KEY,
    profile JSONB NOT NULL,
    CONSTRAINT check_profile_schema CHECK (
        -- 1. Must be a JSON Object (not array or scalar)
        jsonb_typeof(profile) = 'object' AND
        -- 2. Must contain required keys
        profile ?& ARRAY['email', 'age', 'tier'] AND
        -- 3. Validate types
        jsonb_typeof(profile->'age') = 'number' AND
        (profile->>'age')::int >= 18 AND
        -- 4. Validate enum values
        profile->>'tier' IN ('free', 'pro', 'enterprise')
    )
);`,
    recallHint: "Use CHECK constraints with jsonb_typeof and ?& to enforce required keys, types, and value constraints on JSONB at write time.",
    interviewTip: "Point out that combining JSONB with CHECK constraints gives you the best of both worlds: schema agility for new fields and relational rigor for mandatory attributes.",
    tags: ["check-constraints", "json-schema", "data-integrity", "jsonb_typeof", "validation"]
  }),

  createCard({
    idNum: 48,
    category: "JSONB & Semi-Structured Data",
    concept: "JSONB Performance Anti-Patterns (Over-Indexing, Mega-Documents & TOAST Latency)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are the common performance anti-patterns when using JSONB in PostgreSQL at scale?",
    quickAnswer: "Major JSONB anti-patterns include: 1) Storing massive multi-megabyte JSON documents that trigger TOAST table compression and out-of-line storage, slowing every scan; 2) Creating blanket default GIN indexes (`jsonb_ops`) on high-write tables, causing severe write amplification and index bloat; 3) Storing relational entity relationships as embedded arrays instead of normalized foreign key tables, making concurrency and partial updates expensive.",
    detailedAnswer: "Key Anti-Patterns:\n1. The TOAST Trap: When a JSONB document exceeds ~2KB, PostgreSQL compresses it and pushes it out-of-line into a TOAST table. If your query needs to update a single key in that 100KB document, Postgres must decompress, rewrite, and recompress the entire 100KB payload into a new tuple.\n2. GIN Write Amplification: A JSONB document with 100 keys and arrays creates hundreds of index entries in a GIN index on every `INSERT` or `UPDATE`.\n3. Lack of Partial Updates: PostgreSQL cannot update a single key in-place; the whole JSONB document is rewritten.\n4. Solution: Extract high-frequency mutable counters and foreign keys into normal relational columns; keep JSONB strictly for sparse, semi-structured attributes.",
    code: `-- ANTI-PATTERN: Updating a single counter inside a 50KB JSONB document
-- Forces full TOAST decompression, copy, recompression, and write!
UPDATE customer_records 
SET metadata = jsonb_set(metadata, '{login_count}', ((metadata->>'login_count')::int + 1)::text::jsonb)
WHERE id = 100;

-- CORRECT PATTERN: Normalize frequently modified scalar counters into real columns
ALTER TABLE customer_records ADD COLUMN login_count INT NOT NULL DEFAULT 0;
UPDATE customer_records SET login_count = login_count + 1 WHERE id = 100;`,
    recallHint: "Anti-patterns: huge TOASTed documents rewritten on every update; unconstrained GIN indexes causing write bloat; embedding relational entities.",
    interviewTip: "In architecture interviews, emphasize: 'Use relational columns for relational/frequently updated data; use JSONB for truly heterogeneous, schema-less payloads.'",
    tags: ["anti-patterns", "toast-latency", "write-amplification", "normalization", "performance"]
  })
];

module.exports = cards;
