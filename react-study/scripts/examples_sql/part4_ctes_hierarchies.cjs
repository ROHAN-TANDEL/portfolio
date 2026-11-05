module.exports = [
  {
    id: "sql-ex-33",
    title: "Linear Multi-Step Data Processing Pipeline with Chained CTEs",
    category: "Common Table Expressions & Recursion",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs a clean, readable data transformation pipeline using comma-separated Common Table Expressions (CTEs) instead of deeply nested subqueries.",
    conceptsCovered: [
      "Chained CTEs",
      "Modular Query Composition",
      "Readable ETL Pipelines",
      "Intermediate Materialization Semantics"
    ],
    code: `-- Multi-stage financial aggregation pipeline
WITH raw_payments AS (
    -- Step 1: Filter and sanitize verified transactions
    SELECT 
        customer_id,
        amount,
        payment_date
    FROM customer_ledger
    WHERE payment_status = 'SETTLED'
      AND payment_date >= '2026-01-01'
),
customer_totals AS (
    -- Step 2: Aggregate by customer
    SELECT 
        customer_id,
        COUNT(*) AS transaction_count,
        SUM(amount) AS total_settled_amount
    FROM raw_payments
    GROUP BY customer_id
),
customer_tiers AS (
    -- Step 3: Segment customers into business tiers
    SELECT 
        ct.*,
        c.full_name,
        c.email,
        CASE 
            WHEN ct.total_settled_amount >= 50000 THEN 'TIER_1_VIP'
            WHEN ct.total_settled_amount >= 10000 THEN 'TIER_2_PRO'
            ELSE 'TIER_3_STANDARD'
        END AS loyalty_segment
    FROM customer_totals ct
    INNER JOIN customers c ON ct.customer_id = c.customer_id
)
-- Step 4: Final executive summary
SELECT 
    loyalty_segment,
    COUNT(*) AS total_customers,
    SUM(total_settled_amount) AS segment_revenue,
    ROUND(AVG(total_settled_amount), 2) AS avg_spend_per_customer
FROM customer_tiers
GROUP BY loyalty_segment
ORDER BY segment_revenue DESC;`,
    breakdown: [
      "Comma-separated CTEs execute top-to-bottom as a literate, self-documenting data pipeline.",
      "Replaces confusing 4-level nested FROM (SELECT (SELECT ...)) subqueries with clear named stages.",
      "Enables developers to inspect intermediate stages during debugging by simply changing the final SELECT.",
      "The query optimizer can inline or optimize across CTE boundaries in modern engines."
    ],
    expectedOutput: `loyalty_segment  | total_customers | segment_revenue | avg_spend_per_customer
TIER_1_VIP       | 18              | 1450000.00      | 80555.56
TIER_2_PRO       | 85              | 1870000.00      | 22000.00
TIER_3_STANDARD  | 420             | 1260000.00      | 3000.00`
  },
  {
    id: "sql-ex-34",
    title: "Organization Hierarchy Management Tree Traversal with WITH RECURSIVE",
    category: "Common Table Expressions & Recursion",
    difficulty: "advanced",
    whatThisCodeCovers: "Traverses an organizational management hierarchy of arbitrary depth starting from the CEO down to individual contributors using ANSI WITH RECURSIVE.",
    conceptsCovered: [
      "WITH RECURSIVE",
      "Anchor Member & Recursive Member",
      "UNION ALL Recursive Stepping",
      "Depth Level Tracking",
      "Hierarchy Breadcrumb Indentation"
    ],
    code: `-- Traverse corporate reporting hierarchy from CEO down to junior staff
WITH RECURSIVE org_tree AS (
    -- 1. Anchor Member: Find the top-level executives (manager_id IS NULL)
    SELECT 
        employee_id,
        full_name,
        manager_id,
        job_title,
        1 AS hierarchy_level,
        CAST(full_name AS VARCHAR(1000)) AS reporting_chain
    FROM employees
    WHERE manager_id IS NULL

    UNION ALL

    -- 2. Recursive Member: Join subordinates to their managers in org_tree
    SELECT 
        e.employee_id,
        e.full_name,
        e.manager_id,
        e.job_title,
        ot.hierarchy_level + 1,
        CAST(ot.reporting_chain || ' -> ' || e.full_name AS VARCHAR(1000))
    FROM employees e
    INNER JOIN org_tree ot 
        ON e.manager_id = ot.employee_id
)
SELECT 
    REPEAT('  ', hierarchy_level - 1) || full_name AS indented_org_chart,
    job_title,
    hierarchy_level,
    reporting_chain
FROM org_tree
ORDER BY reporting_chain;`,
    breakdown: [
      "The Anchor Member seeds the recursion with the root node(s) where manager_id IS NULL.",
      "The Recursive Member joins employees to the working result set (ot) matching e.manager_id = ot.employee_id.",
      "Recursion terminates automatically when the join yields zero rows (leaf nodes reached).",
      "Tracks hierarchy_level and full reporting_chain string path at every iteration."
    ],
    expectedOutput: `indented_org_chart    | job_title      | hierarchy_level | reporting_chain
Sarah Connor          | CEO            | 1               | Sarah Connor
  John Reese          | VP Engineering | 2               | Sarah Connor -> John Reese
    Harold Finch      | Staff Architect| 3               | Sarah Connor -> John Reese -> Harold Finch`
  },
  {
    id: "sql-ex-35",
    title: "Generating Continuous Date Sequences / Calendars Without Physical Tables",
    category: "Common Table Expressions & Recursion",
    difficulty: "intermediate",
    whatThisCodeCovers: "Dynamically constructs a 31-day contiguous calendar sequence using ANSI recursive CTEs and left-joins it to sales data to uncover zero-sale days.",
    conceptsCovered: [
      "Synthetic Calendar Generation",
      "WITH RECURSIVE Counter Loop",
      "Time-Series Gap Filling",
      "ANSI-Compliant Sequence Generation"
    ],
    code: `-- Generate a full 31-day calendar for March 2026 and detect zero-sales trading days
WITH RECURSIVE date_series AS (
    -- Anchor: Start date
    SELECT CAST('2026-03-01' AS DATE) AS calendar_date
    
    UNION ALL
    
    -- Recursive Step: Increment date by 1 day until end of month
    SELECT CAST(calendar_date + INTERVAL '1' DAY AS DATE)
    FROM date_series
    WHERE calendar_date < CAST('2026-03-31' AS DATE)
)
SELECT 
    ds.calendar_date,
    COALESCE(COUNT(s.sale_id), 0) AS total_transactions,
    COALESCE(SUM(s.amount), 0.00) AS total_daily_revenue
FROM date_series ds
LEFT OUTER JOIN sales s 
    ON ds.calendar_date = CAST(s.sale_timestamp AS DATE)
GROUP BY ds.calendar_date
ORDER BY ds.calendar_date ASC;`,
    breakdown: [
      "Generates continuous daily time intervals without requiring physical numbers or calendar tables.",
      "LEFT OUTER JOIN attaches actual sales transactions to the synthetic calendar.",
      "Guarantees that days with zero sales appear in reports with 0 count and $0.00 revenue instead of missing entirely.",
      "Works in any ANSI SQL database supporting standard recursive queries."
    ],
    expectedOutput: `calendar_date | total_transactions | total_daily_revenue
2026-03-01    | 45                 | 8950.00
2026-03-02    | 0                  | 0.00
2026-03-03    | 32                 | 6120.00`
  },
  {
    id: "sql-ex-36",
    title: "Bill of Materials (BOM) Subassembly Cost Rollup with Recursion",
    category: "Common Table Expressions & Recursion",
    difficulty: "advanced",
    whatThisCodeCovers: "Explodes a multi-level manufacturing bill of materials (components within subassemblies within finished goods) to calculate total unit production costs.",
    conceptsCovered: [
      "Bill of Materials (BOM)",
      "Multi-Level Assembly Explosion",
      "Cumulative Quantity Multiplication",
      "Manufacturing Cost Rollup"
    ],
    code: `-- Compute total parts and rolled-up cost for a manufactured laptop (assembly_id = 1)
WITH RECURSIVE bom_explosion AS (
    -- 1. Anchor: Top-level subcomponents
    SELECT 
        parent_assembly_id,
        component_id,
        quantity,
        quantity AS total_quantity_needed
    FROM assembly_components
    WHERE parent_assembly_id = 1

    UNION ALL

    -- 2. Recursive step: Subcomponents of subcomponents
    SELECT 
        ac.parent_assembly_id,
        ac.component_id,
        ac.quantity,
        b.total_quantity_needed * ac.quantity
    FROM assembly_components ac
    INNER JOIN bom_explosion b 
        ON ac.parent_assembly_id = b.component_id
)
SELECT 
    p.part_name,
    p.part_type,
    b.total_quantity_needed,
    p.unit_cost,
    (b.total_quantity_needed * p.unit_cost) AS total_cost_contribution
FROM bom_explosion b
INNER JOIN parts p 
    ON b.component_id = p.part_id
ORDER BY total_cost_contribution DESC;`,
    breakdown: [
      "Solves the classic manufacturing parts explosion problem across unbounded hierarchy depth.",
      "Multiplies quantities down the tree: if 1 laptop needs 2 motherboards, and each motherboard needs 4 screws, total screws needed = 8.",
      "Joins to the catalog parts table to compute final line item costs.",
      "Provides exact unit economics for engineering and supply chain teams."
    ],
    expectedOutput: `part_name            | part_type  | total_quantity_needed | unit_cost | total_cost_contribution
OLED Display Panel   | COMPONENT  | 1                     | 220.00    | 220.00
Lithium Battery Pack | COMPONENT  | 1                     | 65.00     | 65.00
M2 Brass Standoffs   | FASTENER   | 16                    | 0.25      | 4.00`
  },
  {
    id: "sql-ex-37",
    title: "Cycle Detection and Loop Termination in Graph Traversal",
    category: "Common Table Expressions & Recursion",
    difficulty: "advanced",
    whatThisCodeCovers: "Prevents infinite loops and stack overflow crashes during recursive graph traversal by tracking visited nodes in an array or string path.",
    conceptsCovered: [
      "Infinite Recursion Defense",
      "Cycle Detection",
      "Visited Node Path Tracking",
      "Graph Loop Short-Circuiting"
    ],
    code: `-- Traverse directed graph nodes while safely terminating if a cycle is detected
WITH RECURSIVE graph_path AS (
    -- Anchor: Starting node
    SELECT 
        source_node,
        target_node,
        CAST('/' || source_node || '/' || target_node || '/' AS VARCHAR(1000)) AS path_string,
        FALSE AS is_cycle
    FROM graph_edges
    WHERE source_node = 'A'

    UNION ALL

    -- Recursive Step: Advance along edges, halting if target already exists in path
    SELECT 
        e.source_node,
        e.target_node,
        CAST(gp.path_string || e.target_node || '/' AS VARCHAR(1000)),
        CASE 
            WHEN gp.path_string LIKE '%/' || e.target_node || '/%' THEN TRUE 
            ELSE FALSE 
        END
    FROM graph_edges e
    INNER JOIN graph_path gp 
        ON e.source_node = gp.target_node
    WHERE NOT gp.is_cycle -- Halt branch if cycle was detected in previous step
      AND gp.path_string NOT LIKE '%/' || e.target_node || '/%' -- Prevent expanding cycle node
)
SELECT 
    source_node,
    target_node,
    path_string,
    is_cycle
FROM graph_path;`,
    breakdown: [
      "Graphs with cycles (e.g. A -> B -> C -> A) cause naive recursive CTEs to loop infinitely until system memory or max-recursion limits trigger.",
      "Maintains a path_string breadcrumb recording every traversed node delimiter: '/A/B/'.",
      "Tests `path_string NOT LIKE '%/' || target || '/%'` to terminate recursion before re-visiting an already encountered vertex.",
      "Safely isolates circular dependencies without bringing down database workers."
    ],
    expectedOutput: `source_node | target_node | path_string    | is_cycle
A           | B           | /A/B/          | false
B           | C           | /A/B/C/        | false
C           | D           | /A/B/C/D/      | false`
  },
  {
    id: "sql-ex-38",
    title: "Shortest Path / Breadth-First Search (BFS) in Relational Flight Graphs",
    category: "Common Table Expressions & Recursion",
    difficulty: "advanced",
    whatThisCodeCovers: "Finds the minimum number of layovers and cheapest route between two flight hubs using recursive breadth-first traversal.",
    conceptsCovered: [
      "Breadth-First Search (BFS)",
      "Shortest Path in SQL",
      "Cumulative Cost Minimization",
      "Hop Count Bounding"
    ],
    code: `-- Find flight routes between SFO and JFK with at most 2 layovers
WITH RECURSIVE flight_search AS (
    -- Anchor: Direct departures from SFO
    SELECT 
        origin,
        destination,
        cost,
        1 AS num_hops,
        CAST(origin || ' -> ' || destination AS VARCHAR(500)) AS itinerary
    FROM flight_legs
    WHERE origin = 'SFO'

    UNION ALL

    -- Recursive Member: Connect connecting flights
    SELECT 
        fs.origin,
        fl.destination,
        fs.cost + fl.cost,
        fs.num_hops + 1,
        CAST(fs.itinerary || ' -> ' || fl.destination AS VARCHAR(500))
    FROM flight_search fs
    INNER JOIN flight_legs fl 
        ON fs.destination = fl.origin
    WHERE fs.num_hops < 3 -- Maximum 2 layovers (3 hops)
      AND fs.destination <> 'JFK' -- Stop traversing if destination reached
)
SELECT 
    itinerary,
    num_hops,
    cost
FROM flight_search
WHERE destination = 'JFK'
ORDER BY cost ASC, num_hops ASC;`,
    breakdown: [
      "Explores flight legs layer by layer from the origin city.",
      "Accumulates monetary cost (`fs.cost + fl.cost`) and hops count at each connecting flight.",
      "Enforces a hard boundary condition (`num_hops < 3`) to bound the computational search space.",
      "Sorts by cost and num_hops to identify optimal itineraries."
    ],
    expectedOutput: `itinerary               | num_hops | cost
SFO -> JFK              | 1        | 350.00
SFO -> ORD -> JFK       | 2        | 295.00
SFO -> DEN -> ORD -> JFK| 3        | 240.00`
  },
  {
    id: "sql-ex-39",
    title: "Category Breadcrumb Path Construction (/Electronics/Audio/Headphones)",
    category: "Common Table Expressions & Recursion",
    difficulty: "intermediate",
    whatThisCodeCovers: "Reconstructs full URL SEO breadcrumb paths for deeply nested e-commerce product categories from child up to root.",
    conceptsCovered: [
      "Hierarchical Breadcrumb Construction",
      "Bottom-Up Tree Traversal",
      "String Concatenation in Recursion",
      "Catalog Navigation"
    ],
    code: `-- Generate breadcrumb navigation paths for all leaf product categories
WITH RECURSIVE category_path AS (
    -- Anchor: Start at the category itself
    SELECT 
        category_id,
        parent_id,
        category_name,
        CAST('/' || slug AS VARCHAR(1000)) AS full_path
    FROM product_categories

    UNION ALL

    -- Recursive Member: Walk up to parent
    SELECT 
        cp.category_id,
        p.parent_id,
        p.category_name,
        CAST('/' || p.slug || cp.full_path AS VARCHAR(1000))
    FROM category_path cp
    INNER JOIN product_categories p 
        ON cp.parent_id = p.category_id
)
SELECT 
    category_id,
    full_path
FROM category_path
WHERE parent_id IS NULL -- Only select rows where the root ancestor was reached
ORDER BY category_id;`,
    breakdown: [
      "Performs bottom-up tree traversal starting from all categories simultaneously.",
      "Walks up parent links, prepending each ancestor's slug to the front of full_path.",
      "Filtering WHERE parent_id IS NULL in the outer query extracts the completely resolved paths.",
      "Prepares hierarchical URL routing for frontend e-commerce storefronts."
    ],
    expectedOutput: `category_id | full_path
1           | /electronics
5           | /electronics/audio
14          | /electronics/audio/noise-cancelling-headphones`
  },
  {
    id: "sql-ex-40",
    title: "Cumulative Discount / Interest Calculation via Recursive Iteration",
    category: "Common Table Expressions & Recursion",
    difficulty: "advanced",
    whatThisCodeCovers: "Simulates an amortization schedule or compound interest accrual month-by-month using iterative mathematical recursion in SQL.",
    conceptsCovered: [
      "Iterative Amortization Schedule",
      "Compound Interest Simulation",
      "Mathematical State Progression",
      "Financial Modeling in SQL"
    ],
    code: `-- Calculate 12-month loan amortization schedule for a $10,000 loan at 1% monthly interest
WITH RECURSIVE amortization AS (
    -- Anchor: Month 0 (Starting loan balance)
    SELECT 
        0 AS month_num,
        CAST(10000.00 AS NUMERIC(12,2)) AS remaining_balance,
        CAST(0.00 AS NUMERIC(12,2)) AS interest_paid,
        CAST(0.00 AS NUMERIC(12,2)) AS principal_paid
    
    UNION ALL
    
    -- Recursive Step: Advance month by month with $888.49 fixed payment
    SELECT 
        a.month_num + 1,
        CAST(
            a.remaining_balance + (a.remaining_balance * 0.01) - 888.49 
            AS NUMERIC(12,2)
        ),
        CAST(a.remaining_balance * 0.01 AS NUMERIC(12,2)),
        CAST(888.49 - (a.remaining_balance * 0.01) AS NUMERIC(12,2))
    FROM amortization a
    WHERE a.month_num < 12
)
SELECT 
    month_num,
    remaining_balance,
    interest_paid,
    principal_paid
FROM amortization
WHERE month_num > 0
ORDER BY month_num;`,
    breakdown: [
      "Emulates imperative looping directly within declarative SQL.",
      "Each iterative step receives the previous month's remaining balance, applies interest, deducts payment, and passes state to the next row.",
      "Terminates deterministically when month_num reaches 12.",
      "Computes complete amortization schedules without pulling data out to Python or Excel."
    ],
    expectedOutput: `month_num | remaining_balance | interest_paid | principal_paid
1         | 9211.51           | 100.00        | 788.49
2         | 8415.14           | 92.12         | 796.37
12        | 0.00              | 8.80          | 879.69`
  },
  {
    id: "sql-ex-41",
    title: "Querying Closure Tables for High-Speed Arbitrary Depth Subtree Lookups",
    category: "Common Table Expressions & Recursion",
    difficulty: "advanced",
    whatThisCodeCovers: "Demonstrates querying a relational Closure Table (ancestor, descendant, depth) to fetch an entire subtree instantaneously in O(1) joins without recursive overhead.",
    conceptsCovered: [
      "Closure Table Pattern",
      "Arbitrary Subtree Fetching",
      "Precomputed Hierarchy",
      "High-Performance Relational Read Design"
    ],
    code: `-- Retrieve all descendants under 'Engineering' (dept_id = 10) at any depth
SELECT 
    d.department_id,
    d.department_name,
    c.depth
FROM department_closure c
INNER JOIN departments d 
    ON c.descendant_id = d.department_id
WHERE c.ancestor_id = 10
ORDER BY c.depth ASC, d.department_name ASC;`,
    breakdown: [
      "The closure table pre-stores every ancestor-descendant pair along with the path length (depth).",
      "Eliminates the CPU cost of recursive CTEs during high-frequency read operations.",
      "Fetching an entire subtree of 10,000 nodes requires a simple indexed equi-join on ancestor_id.",
      "A classic relational design trade-off: slight write amplification on insert in exchange for lightning-fast reads."
    ],
    expectedOutput: `department_id | department_name       | depth
10            | Engineering           | 0
12            | Frontend Core         | 1
13            | Backend Platform      | 1
24            | Database Engineering  | 2`
  },
  {
    id: "sql-ex-42",
    title: "Recursive Number Series Generation for Missing Sequence Gap Detection",
    category: "Common Table Expressions & Recursion",
    difficulty: "intermediate",
    whatThisCodeCovers: "Finds missing invoice numbers in a sequential sequence to detect deleted records or fraud using a recursive numbers tally CTE.",
    conceptsCovered: [
      "Gap Detection in Sequences",
      "Recursive Number Generator",
      "Anti-Join on Sequence Tally",
      "Audit & Compliance Queries"
    ],
    code: `-- Find missing invoice numbers in the range 1001 to 1010
WITH RECURSIVE expected_numbers AS (
    SELECT 1001 AS invoice_num
    UNION ALL
    SELECT invoice_num + 1 
    FROM expected_numbers 
    WHERE invoice_num < 1010
)
SELECT 
    en.invoice_num AS missing_invoice_number
FROM expected_numbers en
LEFT OUTER JOIN invoices inv 
    ON en.invoice_num = inv.invoice_number
WHERE inv.invoice_number IS NULL;`,
    breakdown: [
      "expected_numbers generates the unbroken sequence from MIN to MAX integer bounds.",
      "LEFT OUTER JOIN ... WHERE inv.invoice_number IS NULL isolates missing values.",
      "Essential compliance check for legally required consecutive document number sequences (invoices, checks, receipts).",
      "Identifies missing rows in seconds without external procedural scripts."
    ],
    expectedOutput: `missing_invoice_number
1004
1007`
  }
];
