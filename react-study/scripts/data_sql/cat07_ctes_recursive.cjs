const { createCard } = require("../sql_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 73,
    category: "CTEs & Recursive Hierarchies",
    concept: "Standard Common Table Expressions (WITH cte AS ...) & Readability",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is a Common Table Expression (CTE) in ANSI SQL, and why is it preferred over deeply nested subqueries?",
    quickAnswer: "A **Common Table Expression (CTE)** is a named, temporary result set defined at the beginning of a query using the `WITH` clause (`WITH cte_name AS (SELECT ...)`). Unlike deeply nested derived tables (which force developers to read code inside-out from the bottom up), CTEs enable top-to-bottom procedural reading, modular testing, and allow the named result set to be referenced multiple times within the subsequent statement.",
    detailedAnswer: "CTE Architectural Advantages:\n1. Top-Down Readability: Pre-calculates datasets sequentially in logical order.\n2. Reusability: A single CTE can be referenced multiple times in the main query (e.g. self-joining a CTE or referencing it in `UNION`). In contrast, a subquery in `FROM` must be copy-pasted, duplicating code.\n3. Scope: Exists strictly for the lifetime of that single SQL statement; never stored in catalog tables or schemas.\n4. Clean Maintenance: Individual CTE blocks can be isolated and debugged independently during development.",
    code: `-- Refactoring nested subqueries into a readable CTE
WITH active_users AS (
    SELECT user_id, email, country, created_at
    FROM users
    WHERE is_active = true
),
high_value_orders AS (
    SELECT customer_id, SUM(total_amount) AS total_spent
    FROM orders
    WHERE order_date >= '2026-01-01'
    GROUP BY customer_id
    HAVING SUM(total_amount) >= 5000.00
)
SELECT 
    u.user_id,
    u.email,
    u.country,
    h.total_spent
FROM active_users u
INNER JOIN high_value_orders h ON u.user_id = h.customer_id
ORDER BY h.total_spent DESC;`,
    recallHint: "CTEs define named temporary result sets with WITH; read top-to-bottom; can be referenced multiple times in the query.",
    interviewTip: "Highlight that CTEs turn complex SQL spaghetti code into clean, modular, self-documenting data pipelines.",
    tags: ["cte", "common-table-expressions", "with-clause", "code-readability", "refactoring"]
  }),

  createCard({
    idNum: 74,
    category: "CTEs & Recursive Hierarchies",
    concept: "Chaining Multiple Sequential CTEs in Data Transformation Pipelines",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you chain multiple sequential CTEs together, and can a later CTE reference an earlier CTE?",
    quickAnswer: "In ANSI SQL, multiple CTEs are separated by commas under a single `WITH` keyword: `WITH cte1 AS (...), cte2 AS (...), cte3 AS (...)`. Later CTEs can freely reference any previously defined CTE in the sequence, allowing developers to construct modular multi-stage data transformation pipelines (Extract $\\to$ Cleanse $\\to$ Aggregate $\\to$ Final Projection).",
    detailedAnswer: "Chaining Rules:\n1. Single `WITH` Keyword: Never repeat the word `WITH` between commas (`WITH a AS (...), b AS (...)`).\n2. Forward References: CTE `b` CAN reference CTE `a`. But CTE `a` CANNOT reference CTE `b` (no forward lookups in non-recursive CTEs).\n3. Re-referencing: The final `SELECT` statement can join `cte1` with `cte3` directly.\n4. Performance Consideration: Depending on database engine, CTEs are either inlined or evaluated once.",
    code: `-- Multi-stage analytical pipeline chaining 3 CTEs
WITH raw_logs AS (
    -- Stage 1: Filter and sanitize incoming telemetry
    SELECT user_id, event_type, event_time, payload
    FROM telemetry_events
    WHERE event_time >= CURRENT_DATE - INTERVAL '30 days'
),
user_session_counts AS (
    -- Stage 2: Reference raw_logs to aggregate session frequency
    SELECT user_id, COUNT(*) AS total_logins
    FROM raw_logs
    WHERE event_type = 'LOGIN_SUCCESS'
    GROUP BY user_id
),
classified_cohorts AS (
    -- Stage 3: Reference user_session_counts to bucket users
    SELECT 
        user_id,
        total_logins,
        CASE 
            WHEN total_logins >= 20 THEN 'Power User'
            WHEN total_logins >= 5 THEN 'Regular User'
            ELSE 'Dormant User'
        END AS user_segment
    FROM user_session_counts
)
-- Stage 4: Final business summary
SELECT user_segment, COUNT(*) AS segment_size
FROM classified_cohorts
GROUP BY user_segment
ORDER BY segment_size DESC;`,
    breakdown: [
      "A single WITH keyword declares the pipeline.",
      "Each stage references the previous stage's clean virtual output.",
      "Dramatically cleaner than 4 layers of nested subqueries."
    ],
    recallHint: "Chain CTEs with commas under one WITH keyword; later CTEs can reference earlier CTEs to build linear pipelines.",
    interviewTip: "Mention that separating multi-step business logic into chained CTEs makes unit testing and query debugging 10x easier.",
    tags: ["chained-ctes", "data-pipelines", "modular-sql", "transformation-stages", "with-syntax"]
  }),

  createCard({
    idNum: 75,
    category: "CTEs & Recursive Hierarchies",
    concept: "ANSI WITH RECURSIVE Syntax & Working Table Lifecycle",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the internal execution engine lifecycle of an ANSI SQL WITH RECURSIVE query?",
    quickAnswer: "`WITH RECURSIVE` executes an iterative loop using an internal **Working Table** and an **Accumulator Table**: 1) The **Anchor Member** executes once to seed the working table; 2) The **Recursive Member** executes, joining against the current working table; 3) The rows generated by the recursive member replace the working table and are appended to the accumulator; 4) The loop repeats until the recursive step produces **zero rows**; 5) The final query reads from the accumulator.",
    detailedAnswer: "Step-by-Step Working Table Lifecycle:\n1. Initialization: Run non-recursive query (Anchor). Put result in `Working Table` and `Accumulator Table`.\n2. Iteration Loop:\n   - Run recursive query using `Working Table` as input.\n   - Store output in `Intermediate Table`.\n   - If `Intermediate Table` is empty $\\to$ TERMINATE LOOP.\n   - Replace `Working Table` with `Intermediate Table`.\n   - Append `Intermediate Table` rows into `Accumulator Table`.\n3. Final Output: Main query reads all accumulated rows.\n4. Union Rule: The anchor and recursive terms are connected by `UNION ALL` (or `UNION` for automatic deduplication).",
    code: `-- Generating a series of numbers 1 to 5 to demonstrate the lifecycle
WITH RECURSIVE number_series AS (
    -- 1. Anchor Member (Runs once; seeds Working Table with [1])
    SELECT 1 AS n

    UNION ALL

    -- 2. Recursive Member (Runs repeatedly: 1->2, 2->3, 3->4, 4->5)
    SELECT n + 1
    FROM number_series
    WHERE n < 5 -- Termination condition! When n reaches 5, produces 0 rows -> terminates!
)
SELECT n FROM number_series;`,
    recallHint: "Anchor seeds working table; recursive term runs repeatedly on previous step's output; terminates when 0 rows are generated.",
    interviewTip: "Explain the working table: each recursive step only evaluates rows produced by the immediate previous iteration, NOT the entire accumulated history.",
    tags: ["with-recursive", "working-table", "recursive-lifecycle", "accumulator", "relational-loop"]
  }),

  createCard({
    idNum: 76,
    category: "CTEs & Recursive Hierarchies",
    concept: "Recursive Anchor Member vs Recursive Member Rules & Restrictions",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are the strict structural rules governing the Anchor Member and Recursive Member in a recursive CTE?",
    quickAnswer: "An ANSI recursive CTE consists of: 1) One or more **Anchor Members** (standard non-recursive queries); 2) A `UNION ALL` or `UNION` operator; and 3) Exactly one **Recursive Member** that references the CTE name. The recursive member has strict syntactic restrictions: it CANNOT contain `GROUP BY`, `HAVING`, `DISTINCT`, window functions, or self-joins to the recursive reference more than once.",
    detailedAnswer: "Syntactic Restrictions on the Recursive Member:\n- NO Aggregates: `COUNT()`, `SUM()` are forbidden in the recursive step.\n- NO `GROUP BY` or `HAVING`.\n- NO Window Functions: `OVER ()` is forbidden in the recursive term.\n- Single Reference: The CTE name can only appear once in the `FROM` clause of the recursive step.\n- Matching Data Types: Column counts and types between Anchor and Recursive members must match identically.",
    code: `-- Legal Recursive CTE Structure
WITH RECURSIVE valid_cte (id, step_name) AS (
    -- Anchor Member
    SELECT 1, CAST('Root' AS VARCHAR(50))
    
    UNION ALL
    
    -- Recursive Member (Complies with all rules: no aggregates, single reference)
    SELECT id + 1, CAST('Step ' || (id + 1) AS VARCHAR(50))
    FROM valid_cte
    WHERE id < 3
)
SELECT * FROM valid_cte;`,
    breakdown: [
      "Anchor initializes columns and types.",
      "Recursive member increments id and terminates at id < 3.",
      "No forbidden clauses (GROUP BY, window functions) are present in the recursive step."
    ],
    recallHint: "Recursive member cannot contain GROUP BY, HAVING, DISTINCT, or window functions; single reference to CTE name only.",
    interviewTip: "If asked how to use window functions with recursive CTEs: apply window functions in the final outer query or in a subsequent chained CTE, not inside the recursive member.",
    tags: ["anchor-member", "recursive-member", "cte-restrictions", "union-all", "ansi-syntax"]
  }),

  createCard({
    idNum: 77,
    category: "CTEs & Recursive Hierarchies",
    concept: "Hierarchical Tree Traversal: Management Org-Charts & Categories",
    priority: "must-know",
    difficulty: "must-know",
    question: "How do you traverse a parent-child adjacency list (e.g. Org-Chart or Category Tree) using WITH RECURSIVE?",
    quickAnswer: "To traverse an Adjacency List hierarchy: 1) The **Anchor Member** selects root nodes where `parent_id IS NULL` (e.g. the CEO or top-level categories) and initializes depth to 1; 2) The **Recursive Member** joins the base table against the recursive CTE on `child.parent_id = parent.id`, incrementing depth by 1 (`depth + 1`); 3) The loop repeats until all leaf nodes have been processed.",
    detailedAnswer: "Adjacency List Traversal Details:\n1. Top-Down Traversal: Starts at root (`parent IS NULL`) and descends to leaves (finds all subordinates).\n2. Bottom-Up Traversal: Starts at a leaf (`id = target_id`) and ascends to root `WHERE parent.id = child.parent_id` (finds all managers or category ancestors).\n3. Preserving Tree Order: Concatenating node IDs into a sorting path ensures children appear grouped directly beneath their respective parents in the output.",
    code: `-- Traverse full employee management tree from CEO down to staff
WITH RECURSIVE org_tree AS (
    -- 1. Anchor: Find CEO (no manager)
    SELECT 
        employee_id, 
        full_name, 
        manager_id, 
        1 AS depth_level
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- 2. Recursive: Find direct reports of previous step
    SELECT 
        e.employee_id, 
        e.full_name, 
        e.manager_id, 
        o.depth_level + 1
    FROM employees e
    INNER JOIN org_tree o ON e.manager_id = o.employee_id
)
SELECT depth_level, employee_id, full_name, manager_id
FROM org_tree
ORDER BY depth_level ASC, employee_id ASC;`,
    recallHint: "Anchor = root (parent IS NULL); Recursive = join child ON child.parent_id = parent.id; increment depth + 1.",
    interviewTip: "Memorize this org-chart query: it is the standard reference implementation for recursive SQL in database interviews.",
    tags: ["hierarchical-tree", "adjacency-list", "org-chart", "category-tree", "with-recursive"]
  }),

  createCard({
    idNum: 78,
    category: "CTEs & Recursive Hierarchies",
    concept: "Graph Edge Traversal & Transitive Closures",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you calculate Transitive Closures and reachable paths in a directed graph using recursive SQL?",
    quickAnswer: "A **Transitive Closure** finds all nodes reachable from a starting node across any number of hops in a directed graph. In recursive SQL: the Anchor selects direct edges originating from the source node (`source = 'A'`); the Recursive Member joins the edges table on `edges.source = paths.destination`, continuing to discover reachable destinations until all paths terminate.",
    detailedAnswer: "Graph Traversal Mechanics:\n1. Direct Edges: `A -> B` and `B -> C`.\n2. Transitive Reachability: `A -> C` (indirect 2-hop path).\n3. Cost / Distance Calculation: Summing edge weights across hops: `p.total_cost + e.weight`.\n4. Network Routing & Bill of Materials: Used to calculate flight connections with layovers or manufacturing sub-assemblies.",
    code: `-- Find all reachable flight destinations from 'JFK' with total cost
WITH RECURSIVE flight_paths AS (
    -- Anchor: Direct non-stop flights from JFK
    SELECT 
        origin, 
        destination, 
        1 AS stops, 
        cost AS total_cost
    FROM flights
    WHERE origin = 'JFK'

    UNION ALL

    -- Recursive: Connecting flights
    SELECT 
        p.origin, 
        f.destination, 
        p.stops + 1, 
        p.total_cost + f.cost
    FROM flight_paths p
    INNER JOIN flights f ON p.destination = f.origin
    WHERE p.stops < 4 -- Limit max layovers to prevent infinite flight loops!
)
SELECT origin, destination, stops, total_cost 
FROM flight_paths
ORDER BY destination, total_cost ASC;`,
    breakdown: [
      "Anchor discovers non-stop destinations.",
      "Recursive member connects destinations to new outgoing flights.",
      "WHERE p.stops < 4 prevents runaway loops in cyclic flight networks."
    ],
    recallHint: "Transitive closure finds all reachable graph nodes; join edges.source = path.destination; calculate cumulative hops/cost.",
    interviewTip: "Always mention hop limits (`stops < 4`) or visited arrays to prevent infinite loops when traversing graphs that may contain cycles.",
    tags: ["graph-traversal", "transitive-closure", "flight-paths", "bill-of-materials", "recursive-cte"]
  }),

  createCard({
    idNum: 79,
    category: "CTEs & Recursive Hierarchies",
    concept: "Generating Number & Date Sequences with Recursive CTEs",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you generate calendar date ranges and sequential integer series in standard SQL without vendor functions?",
    quickAnswer: "While PostgreSQL provides `generate_series()`, it is proprietary and unavailable in MySQL, Oracle, or SQL Server. The ANSI SQL standard portable way to generate arbitrary integer numbers or calendar date ranges is using a **recursive CTE**: the Anchor seeds the start date/number, and the Recursive Member increments by 1 day or 1 integer until the termination condition is met.",
    detailedAnswer: "Calendar Generation Pattern:\n1. Problem: Generating monthly reports where days with zero sales must appear with '$0.00'.\n2. Solution: Generate a calendar dimension using a recursive CTE, then `LEFT JOIN` actual sales data.\n3. Date Arithmetic Standard: Adding intervals or days: `day_date + INTERVAL '1 day'` or `DATEADD(day, 1, day_date)`.",
    code: `-- Generate all 30 days of June 2026 portably across SQL engines
WITH RECURSIVE calendar_dates AS (
    -- 1. Anchor: First day of the month
    SELECT CAST('2026-06-01' AS DATE) AS cal_date

    UNION ALL

    -- 2. Recursive: Add 1 day until last day of month
    SELECT CAST(cal_date + INTERVAL '1 day' AS DATE)
    FROM calendar_dates
    WHERE cal_date < CAST('2026-06-30' AS DATE)
)
SELECT 
    c.cal_date,
    COALESCE(SUM(s.amount), 0.00) AS total_daily_revenue
FROM calendar_dates c
LEFT JOIN sales_records s ON CAST(s.sold_at AS DATE) = c.cal_date
GROUP BY c.cal_date
ORDER BY c.cal_date ASC;`,
    breakdown: [
      "Generates continuous 30-day date series without stored tables.",
      "LEFT JOIN against sales ensures zero-sales days appear with 0.00.",
      "Works portably across modern relational engines."
    ],
    recallHint: "Recursive CTEs generate dates portably (anchor = start date, recursive = date + 1 day); replaces proprietary generate_series.",
    interviewTip: "Highlight that this calendar generator is the standard ANSI solution for zero-filling missing dates in business charts.",
    tags: ["calendar-generator", "generate_series-alternative", "date-series", "zero-filling", "ansi-portability"]
  }),

  createCard({
    idNum: 80,
    category: "CTEs & Recursive Hierarchies",
    concept: "Recursive Breadcrumb Trails & Visual Indentation Strings",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you generate visual indentation and breadcrumb path strings in recursive hierarchy queries?",
    quickAnswer: "In recursive queries, you format breadcrumbs and visual tree indentation by string concatenation in the projection list: 1) For **Breadcrumbs**, concatenate the parent's breadcrumb string with a delimiter and child's name (`parent_path || ' > ' || child_name`); 2) For **Visual Indentation**, prefix spaces or indentation characters based on depth: `REPEAT('  ', depth) || node_name`.",
    detailedAnswer: "Formatting Mechanics:\n1. Breadcrumb Concatenation: Anchor seeds `CAST(name AS VARCHAR(1000))`. Recursive step appends `|| ' > ' || child_name`.\n2. Column Widening: You MUST explicitly cast the anchor column to a wide type (`VARCHAR(1000)`), otherwise the engine sizes the column to the length of the root node string, causing string truncation errors on deeper levels!\n3. Tree Sorting: Order by breadcrumb string to guarantee that subcategories appear directly under their parents.",
    code: `-- Category navigation tree with breadcrumb path and visual indentation
WITH RECURSIVE category_tree AS (
    -- Anchor: Root categories
    SELECT 
        category_id, 
        name, 
        parent_id, 
        1 AS depth,
        CAST(name AS VARCHAR(500)) AS breadcrumb_path
    FROM product_categories
    WHERE parent_id IS NULL

    UNION ALL

    -- Recursive: Subcategories
    SELECT 
        c.category_id, 
        c.name, 
        c.parent_id, 
        ct.depth + 1,
        CAST(ct.breadcrumb_path || ' > ' || c.name AS VARCHAR(500))
    FROM product_categories c
    INNER JOIN category_tree ct ON c.parent_id = ct.category_id
)
SELECT 
    depth,
    -- Visual indentation formatting
    REPEAT('  ', depth - 1) || name AS visual_hierarchy,
    breadcrumb_path
FROM category_tree
ORDER BY breadcrumb_path;`,
    breakdown: [
      "CAST(... AS VARCHAR(500)) prevents string truncation in recursive concatenation.",
      "REPEAT('  ', depth - 1) produces visual tree indentation.",
      "ORDER BY breadcrumb_path produces natural nested outline ordering."
    ],
    recallHint: "Cast anchor breadcrumb to wide VARCHAR(1000) to prevent truncation; concatenate || ' > ' || child; use REPEAT for indent.",
    interviewTip: "Warn about the string truncation trap: forgetting to `CAST` the anchor string causes the database to enforce the short length of the root name.",
    tags: ["breadcrumbs", "visual-indentation", "string-truncation-trap", "category-trees", "formatting"]
  }),

  createCard({
    idNum: 81,
    category: "CTEs & Recursive Hierarchies",
    concept: "Cycle Detection & Maximum Recursion Safeguards (MAXRECURSION)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What causes infinite loops in recursive CTEs, and how do you protect against cyclic graph loops?",
    quickAnswer: "If a hierarchical dataset contains a cycle (e.g. Employee A reports to B, B reports to C, and C reports back to A), a recursive CTE will execute indefinitely in an **infinite loop**, consuming CPU and memory until server timeout or crash. Protection requires either: 1) Tracking visited node IDs in a concatenated string or array to terminate on revisit; or 2) Engine safety guards like SQL Server's `OPTION (MAXRECURSION 100)` or hardcoded `depth < 50` checks.",
    detailedAnswer: "Cycle Prevention Patterns:\n1. Concatenated Path Check: Anchor initializes `path = '/' || id || '/'`. Recursive step checks `WHERE path NOT LIKE '%/' || child_id || '/%'`.\n2. Depth Throttle: Always add `WHERE depth < 20` to guarantee the loop terminates even on corrupt cyclic data.\n3. SQL Server `MAXRECURSION`: Defaults to 100 iterations; throws an error if exceeded unless overridden with `OPTION (MAXRECURSION n)`.",
    code: `-- Portable Cycle-Proof Hierarchy Traversal using Path String Matching
WITH RECURSIVE safe_tree AS (
    -- Anchor: Root nodes
    SELECT 
        id, 
        name, 
        parent_id, 
        1 AS depth,
        CAST('/' || id || '/' AS VARCHAR(1000)) AS visited_path
    FROM departments
    WHERE parent_id IS NULL

    UNION ALL

    -- Recursive: Stop if child is already in visited_path!
    SELECT 
        d.id, 
        d.name, 
        d.parent_id, 
        s.depth + 1,
        CAST(s.visited_path || d.id || '/' AS VARCHAR(1000))
    FROM departments d
    INNER JOIN safe_tree s ON d.parent_id = s.id
    WHERE s.visited_path NOT LIKE '%/' || d.id || '/%' -- CYCLE BREAKER!
      AND s.depth < 25                                  -- DEPTH GUARD!
)
SELECT * FROM safe_tree;`,
    recallHint: "Cycles cause infinite loops; check visited path string (NOT LIKE '%/id/%') or cap depth < 50 to prevent crashes.",
    interviewTip: "Always mention adding a depth limit guard (`depth < 50`) in production recursive CTEs as insurance against corrupt circular foreign keys.",
    tags: ["cycle-detection", "infinite-loops", "maxrecursion", "graph-cycles", "production-safeguards"]
  }),

  createCard({
    idNum: 82,
    category: "CTEs & Recursive Hierarchies",
    concept: "CTE Optimization: Materialization vs Inline Subquery Expansion",
    priority: "must-know",
    difficulty: "advanced",
    question: "Does a database materialize a CTE into temporary memory, or does it inline the CTE like a subquery?",
    quickAnswer: "Database engine behavior varies significantly: Historically (e.g. PostgreSQL pre-v12, Oracle), CTEs acted as **Optimization Fences** (materializing the CTE fully into memory, preventing outer `WHERE` clauses from pushing down). Modern optimizers (SQL Server, PostgreSQL 12+, MySQL 8+) generally **inline non-recursive CTEs** directly into the main query plan like subqueries, pushing down indexes and predicate filters transparently.",
    detailedAnswer: "Optimization Fence vs Inlining Trade-offs:\n- Inlining (Modern Default):\n  - Outer filters push inside the CTE: `WHERE customer_id = 42` pushes down to use indexes.\n  - Drawback: If the CTE is referenced 3 times, the optimizer might evaluate it 3 separate times!\n- Materialization (Optimization Fence):\n  - Evaluates the CTE once, caches the result, and reads from cache multiple times.\n  - Drawback: Outer `WHERE` predicates cannot be pushed down to prune indexes inside the CTE.",
    code: `-- Example of Predicate Pushdown with an Inlined CTE
WITH all_orders AS (
    -- Modern optimizers INLINE this CTE and do NOT scan the whole table!
    SELECT order_id, customer_id, order_date, total_amount
    FROM orders
)
SELECT * 
FROM all_orders 
WHERE customer_id = 105; -- Predicate pushes down into index on orders(customer_id)!`,
    breakdown: [
      "In modern engines, non-recursive CTEs are inlined like derived subqueries.",
      "The outer WHERE customer_id = 105 pushes down to use an index on orders.",
      "Eliminates the legacy optimization fence penalty."
    ],
    recallHint: "Modern engines inline CTEs like subqueries, pushing down predicates and indexes; legacy engines materialized CTEs as optimization fences.",
    interviewTip: "Explain predicate pushdown: modern optimizers push the outer query's `WHERE` filter into the CTE body before scanning data.",
    tags: ["cte-optimization", "inlining", "materialization", "predicate-pushdown", "optimization-fence"]
  }),

  createCard({
    idNum: 83,
    category: "CTEs & Recursive Hierarchies",
    concept: "Comparing Hierarchical Models: Adjacency List vs Nested Sets vs Closure Tables",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are the trade-offs between Adjacency Lists, Nested Sets, and Closure Tables for storing hierarchies in SQL?",
    quickAnswer: "**Adjacency List** (`parent_id`) is simple and fast to insert/update, but querying subtrees requires recursive CTEs. **Nested Sets** (`lft`, `rgt` intervals) make querying entire subtrees an instant non-recursive range scan (`WHERE lft BETWEEN parent.lft AND parent.rgt`), but inserting a single node requires updating every other row in the table. **Closure Tables** store all ancestor-descendant paths in a dedicated junction table, providing fast reads and manageable updates at the cost of additional storage.",
    detailedAnswer: "Hierarchy Architecture Comparison:\n1. Adjacency List:\n   - Schema: `id, name, parent_id`.\n   - Write Cost: $O(1)$ (Fastest inserts).\n   - Read Cost: Requires `WITH RECURSIVE`.\n2. Nested Sets:\n   - Schema: `id, lft, rgt`.\n   - Write Cost: $O(N)$ (Catastrophic: inserting a node renumbers entire tree).\n   - Read Cost: $O(1)$ (Pure range query).\n3. Closure Table (Bridge Table):\n   - Schema: Table `nodes (id)` and Table `node_closure (ancestor_id, descendant_id, depth)`.\n   - Read Cost: $O(1)$ single join.\n   - Write Cost: Manageable $O(D)$ inserts per new node.",
    code: `-- Closure Table Model (The Enterprise Standard for Complex Trees)
CREATE TABLE categories (
    category_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

-- Closure Bridge Table storing ALL ancestor-descendant relationships
CREATE TABLE category_closure (
    ancestor_id INT NOT NULL,
    descendant_id INT NOT NULL,
    depth INT NOT NULL,
    PRIMARY KEY (ancestor_id, descendant_id),
    FOREIGN KEY (ancestor_id) REFERENCES categories(category_id),
    FOREIGN KEY (descendant_id) REFERENCES categories(category_id)
);

-- Find ALL descendants of Category 5 in a single instant join (NO RECURSION NEEDED!)
SELECT c.category_id, c.name, cl.depth
FROM categories c
JOIN category_closure cl ON c.category_id = cl.descendant_id
WHERE cl.ancestor_id = 5;`,
    recallHint: "Adjacency List = parent_id (needs recursion); Nested Sets = lft/rgt (fast read, horrible write); Closure Table = ancestor/descendant table (best balance).",
    interviewTip: "Recommend Closure Tables for write-heavy enterprise systems with deep hierarchies: they avoid recursive query overhead without the write paralysis of Nested Sets.",
    tags: ["hierarchy-models", "adjacency-list", "nested-sets", "closure-table", "data-modeling"]
  }),

  createCard({
    idNum: 84,
    category: "CTEs & Recursive Hierarchies",
    concept: "Data Manipulation with CTEs (Writable Pipelines & Multi-Step Logic)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How can Common Table Expressions participate in Data Manipulation (DML) workflows?",
    quickAnswer: "In standard SQL, CTEs can encapsulate complex data preparation and feed directly into `INSERT`, `UPDATE`, or `DELETE` statements (e.g. `WITH ranked_data AS (...) INSERT INTO target SELECT ... FROM ranked_data`). In engines supporting Writable CTEs (like PostgreSQL), CTEs can themselves execute `INSERT`, `UPDATE`, or `DELETE` with `RETURNING`, passing modified rows directly into downstream statements in a single atomic transaction.",
    detailedAnswer: "DML with CTE Patterns:\n1. Standard DML with Select CTE: Prepare, cleanse, and calculate aggregates in a CTE, then insert the finalized result directly into a permanent reporting table.\n2. Deduplicating Deletions: Identifying duplicate rows via `ROW_NUMBER()` in a CTE and deleting rows where `row_num > 1` (widely used in SQL Server and Oracle).\n3. Atomicity: Multi-step transformations encapsulated within a CTE commit atomically.",
    code: `-- Deduplicating a table using a CTE and ROW_NUMBER()
-- (Standard pattern in SQL Server / Oracle)
WITH duplicates_cte AS (
    SELECT 
        lead_id, 
        email, 
        created_at,
        ROW_NUMBER() OVER (PARTITION BY email ORDER BY created_at ASC) AS occurrence_rank
    FROM customer_leads
)
-- Keeps the earliest record (occurrence_rank = 1) and deletes duplicates!
DELETE FROM duplicates_cte 
WHERE occurrence_rank > 1;

-- Feeding prepared CTE data into an INSERT:
WITH daily_kpis AS (
    SELECT CURRENT_DATE AS metric_date, COUNT(*) AS orders_count, SUM(total_amount) AS revenue
    FROM orders
    WHERE order_date = CURRENT_DATE
)
INSERT INTO kpi_summary_history (metric_date, orders_count, revenue)
SELECT metric_date, orders_count, revenue FROM daily_kpis;`,
    recallHint: "CTEs feed prepared data into INSERT/UPDATE/DELETE; used with ROW_NUMBER() to delete duplicate rows cleanly.",
    interviewTip: "Demonstrate the `WITH duplicates AS (SELECT ..., ROW_NUMBER()) DELETE FROM duplicates WHERE row_num > 1` pattern for deduplicating tables.",
    tags: ["dml-cte", "data-manipulation", "deduplication", "insert-into-select", "batch-processing"]
  })
];

module.exports = cards;
