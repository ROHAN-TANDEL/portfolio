module.exports = [
  {
    id: "sql-ex-12",
    title: "Multi-Metric Aggregation with COUNT, SUM, AVG, MIN, MAX",
    category: "Aggregations, Grouping & 3VL Logic",
    difficulty: "beginner",
    whatThisCodeCovers: "Executes standard aggregate functions across partitioned product categories to generate executive inventory summaries.",
    conceptsCovered: [
      "GROUP BY Clause",
      "Standard Aggregates (COUNT, SUM, AVG, MIN, MAX)",
      "ROUND Function",
      "Aliasing Aggregate Expressions"
    ],
    code: `-- Departmental inventory valuation metrics
SELECT 
    category_id,
    COUNT(*) AS total_items,
    SUM(units_in_stock) AS total_inventory_units,
    ROUND(AVG(unit_price), 2) AS average_price,
    MIN(unit_price) AS lowest_price,
    MAX(unit_price) AS highest_price,
    SUM(units_in_stock * unit_price) AS total_inventory_value
FROM products
WHERE is_active = TRUE
GROUP BY category_id
ORDER BY total_inventory_value DESC;`,
    breakdown: [
      "GROUP BY collapses multiple rows sharing identical category_id into single summary tuples.",
      "COUNT(*) tallies all qualifying rows including rows with NULL attributes.",
      "SUM, AVG, MIN, MAX ignore NULL values in calculation columns.",
      "Computes composite metrics like units_in_stock * unit_price inside SUM before aggregation."
    ],
    expectedOutput: `category_id | total_items | total_inventory_units | average_price | lowest_price | highest_price | total_inventory_value
1           | 45          | 1250                  | 89.50         | 12.00        | 450.00        | 111875.00
2           | 28          | 840                   | 42.10         | 5.50         | 180.00        | 35364.00`
  },
  {
    id: "sql-ex-13",
    title: "COUNT(*) vs COUNT(column) and Handling NULL Column Values",
    category: "Aggregations, Grouping & 3VL Logic",
    difficulty: "beginner",
    whatThisCodeCovers: "Clarifies the critical distinction between counting table rows versus counting populated non-NULL attribute instances.",
    conceptsCovered: [
      "COUNT(*) vs COUNT(expression)",
      "NULL Elimination in Aggregates",
      "Completion Percentage Calculation",
      "COALESCE in Aggregation"
    ],
    code: `-- Measure profile completion and optional field drop-off rates
SELECT 
    COUNT(*) AS total_users,
    COUNT(phone_number) AS users_with_phone,
    COUNT(avatar_url) AS users_with_avatar,
    ROUND(100.0 * COUNT(phone_number) / COUNT(*), 2) AS phone_completion_pct,
    COUNT(*) - COUNT(phone_number) AS users_missing_phone
FROM user_profiles;`,
    breakdown: [
      "COUNT(*) counts every row emitted by the query regardless of whether columns are NULL.",
      "COUNT(phone_number) specifically evaluates the phone_number column and discards rows where it is NULL.",
      "Multiplying by 100.0 casts integer math to numeric/float avoiding integer truncation in standard SQL division.",
      "The difference COUNT(*) - COUNT(col) directly computes missing values without WHERE col IS NULL subqueries."
    ],
    expectedOutput: `total_users | users_with_phone | users_with_avatar | phone_completion_pct | users_missing_phone
10000       | 7450             | 4320              | 74.50                | 2550`
  },
  {
    id: "sql-ex-14",
    title: "Conditional Aggregation with CASE for Dynamic Column Pivot",
    category: "Aggregations, Grouping & 3VL Logic",
    difficulty: "intermediate",
    whatThisCodeCovers: "Pivots categorical row data into discrete columnar summaries using SUM(CASE ...) or COUNT(CASE ...) in standard ANSI SQL.",
    conceptsCovered: [
      "Conditional Aggregation",
      "CASE WHEN Expression",
      "ANSI Column Pivoting",
      "Matrix Reshaping"
    ],
    code: `-- Pivot order statuses into distinct status columns per fiscal year
SELECT 
    EXTRACT(YEAR FROM order_date) AS fiscal_year,
    COUNT(*) AS total_orders,
    SUM(CASE WHEN order_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_orders,
    SUM(CASE WHEN order_status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_orders,
    SUM(CASE WHEN order_status = 'REFUNDED' THEN 1 ELSE 0 END) AS refunded_orders,
    ROUND(
        100.0 * SUM(CASE WHEN order_status = 'COMPLETED' THEN 1 ELSE 0 END) / COUNT(*), 
        2
    ) AS completion_rate_pct
FROM orders
GROUP BY EXTRACT(YEAR FROM order_date)
ORDER BY fiscal_year DESC;`,
    breakdown: [
      "CASE WHEN inside an aggregate function acts as an inline filter per row before aggregation.",
      "SUM(CASE WHEN condition THEN 1 ELSE 0 END) accurately tallies matching occurrences in a single table pass.",
      "Avoids multiple separate queries or expensive self-joins to achieve column pivoting.",
      "100% compliant across all standard ANSI SQL databases."
    ],
    expectedOutput: `fiscal_year | total_orders | completed_orders | cancelled_orders | refunded_orders | completion_rate_pct
2026        | 15200        | 13400            | 1200             | 600             | 88.16
2025        | 48000        | 41800            | 4200             | 2000            | 87.08`
  },
  {
    id: "sql-ex-15",
    title: "Filtering Grouped Sets: WHERE vs HAVING Execution Order",
    category: "Aggregations, Grouping & 3VL Logic",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates how pre-aggregation row filtering in WHERE dramatically reduces workload before post-aggregation group filtering in HAVING.",
    conceptsCovered: [
      "WHERE vs HAVING",
      "Logical Query Execution Phase",
      "Pre-Filter Optimization",
      "Aggregate Condition Assertion"
    ],
    code: `-- Find high-volume corporate clients with over 5 completed enterprise purchases
SELECT 
    c.customer_id,
    c.company_name,
    COUNT(o.order_id) AS qualified_orders,
    SUM(o.total_amount) AS total_spend
FROM customers c
INNER JOIN orders o 
    ON c.customer_id = o.customer_id
WHERE o.order_status = 'COMPLETED'     -- Step 1: Pre-aggregation filter (discards pending/cancelled early)
  AND o.order_date >= '2026-01-01'      -- Step 2: Eliminates historical years
GROUP BY c.customer_id, c.company_name
HAVING COUNT(o.order_id) >= 5          -- Step 3: Post-aggregation filter on grouped results
   AND SUM(o.total_amount) > 50000.00
ORDER BY total_spend DESC;`,
    breakdown: [
      "WHERE filters base table tuples prior to grouping, reducing the number of rows entered into the aggregation hash table.",
      "HAVING executes after GROUP BY, filtering aggregate groupings based on group summaries.",
      "Putting non-aggregate filters in HAVING is an anti-pattern because it forces the database to aggregate rows that could have been discarded early in WHERE.",
      "Both clauses work together in standard SQL to isolate qualifying analytical cohorts."
    ],
    expectedOutput: `customer_id | company_name        | qualified_orders | total_spend
441         | Apex Global Corp    | 12               | 145000.00
108         | Quantum Dynamics    | 7                | 82500.00`
  },
  {
    id: "sql-ex-16",
    title: "Advanced Multi-Dimensional Aggregation with GROUPING SETS",
    category: "Aggregations, Grouping & 3VL Logic",
    difficulty: "advanced",
    whatThisCodeCovers: "Computes multiple levels of aggregation (by region, by product, and overall grand total) in a single unified table pass using GROUPING SETS.",
    conceptsCovered: [
      "GROUP BY GROUPING SETS",
      "GROUPING() Function",
      "Unified Reporting Cube",
      "Single-Pass Optimization"
    ],
    code: `-- Multi-dimensional sales report: By region, by category, and grand total
SELECT 
    COALESCE(region, '[All Regions]') AS region_label,
    COALESCE(category, '[All Categories]') AS category_label,
    GROUPING(region) AS is_region_subtotal,
    GROUPING(category) AS is_category_subtotal,
    SUM(sale_amount) AS total_sales
FROM regional_sales
GROUP BY GROUPING SETS (
    (region, category),  -- Detail level
    (region),            -- Subtotal per region
    (category),          -- Subtotal per category
    ()                   -- Grand total across all rows
)
ORDER BY GROUPING(region), GROUPING(category), region, category;`,
    breakdown: [
      "GROUPING SETS computes specified aggregate combinations in one query, avoiding multiple UNION ALL statements.",
      "GROUPING(col) returns 1 if the column is aggregated out in a subtotal, and 0 if it is part of the grouping key.",
      "COALESCE tags subtotal rows with clean human-readable labels.",
      "Drastically reduces I/O by scanning the underlying table only once."
    ],
    expectedOutput: `region_label  | category_label  | is_region_subtotal | is_category_subtotal | total_sales
East          | Hardware        | 0                  | 0                    | 45000.00
East          | Software        | 0                  | 0                    | 30000.00
East          | [All Categories]| 0                  | 1                    | 75000.00
[All Regions] | [All Categories]| 1                  | 1                    | 220000.00`
  },
  {
    id: "sql-ex-17",
    title: "Hierarchical Subtotals with ROLLUP for Financial Summaries",
    category: "Aggregations, Grouping & 3VL Logic",
    difficulty: "advanced",
    whatThisCodeCovers: "Generates hierarchical financial subtotals progressing from Year down to Quarter, Month, and Grand Total using ANSI GROUP BY ROLLUP.",
    conceptsCovered: [
      "GROUP BY ROLLUP",
      "Hierarchical Aggregation",
      "Financial Subtotals",
      "Grand Total Projection"
    ],
    code: `-- Hierarchical time-series revenue breakdown with progressive rollups
SELECT 
    fiscal_year,
    fiscal_quarter,
    fiscal_month,
    SUM(revenue) AS total_revenue
FROM revenue_ledger
GROUP BY ROLLUP (fiscal_year, fiscal_quarter, fiscal_month)
ORDER BY 
    fiscal_year NULLS LAST, 
    fiscal_quarter NULLS LAST, 
    fiscal_month NULLS LAST;`,
    breakdown: [
      "ROLLUP (A, B, C) automatically produces groupings for (A, B, C), (A, B), (A), and ().",
      "Ideal for hierarchical dimensional data where smaller units roll up into parent containers.",
      "Rows where fiscal_month IS NULL represent quarterly subtotals; rows where both quarter and month are NULL represent yearly totals.",
      "A single row with all dimensions NULL represents the grand total across all records."
    ],
    expectedOutput: `fiscal_year | fiscal_quarter | fiscal_month | total_revenue
2026        | Q1             | 1            | 50000.00
2026        | Q1             | 2            | 65000.00
2026        | Q1             | NULL         | 115000.00
2026        | NULL           | NULL         | 115000.00
NULL        | NULL           | NULL         | 115000.00`
  },
  {
    id: "sql-ex-18",
    title: "Complete Combinatorial Aggregates with CUBE",
    category: "Aggregations, Grouping & 3VL Logic",
    difficulty: "advanced",
    whatThisCodeCovers: "Computes all 2^N possible dimensional combinations across store locations, sales channels, and customer segments using ANSI CUBE.",
    conceptsCovered: [
      "GROUP BY CUBE",
      "Full Combinatorial Cross-Tabulation",
      "Multi-Axis Business Intelligence",
      "Data Warehouse Rollups"
    ],
    code: `-- Cross-tabulation across sales channel and store tier
SELECT 
    COALESCE(channel, 'ALL CHANNELS') AS channel_dim,
    COALESCE(store_tier, 'ALL TIERS') AS tier_dim,
    COUNT(*) AS total_orders,
    SUM(order_value) AS aggregate_value
FROM store_orders
GROUP BY CUBE (channel, store_tier);`,
    breakdown: [
      "CUBE (channel, store_tier) computes all 4 possible permutations: (channel, tier), (channel), (tier), and ().",
      "Provides complete cross-sectional visibility without running 4 separate queries.",
      "Essential for OLAP analytical workloads feeding dynamic pivot-table dashboards.",
      "COALESCE cleanly identifies marginal summary totals."
    ],
    expectedOutput: `channel_dim  | tier_dim   | total_orders | aggregate_value
ONLINE       | FLAGSHIP   | 1400         | 210000.00
ONLINE       | STANDARD   | 3100         | 185000.00
ONLINE       | ALL TIERS  | 4500         | 395000.00
ALL CHANNELS | FLAGSHIP   | 2200         | 340000.00
ALL CHANNELS | ALL TIERS  | 6700         | 735000.00`
  },
  {
    id: "sql-ex-19",
    title: "Safe Ratio Calculations Defending Against Division-by-Zero (NULLIF)",
    category: "Aggregations, Grouping & 3VL Logic",
    difficulty: "intermediate",
    whatThisCodeCovers: "Defends mission-critical financial and analytical queries against fatal division-by-zero database errors using NULLIF and COALESCE.",
    conceptsCovered: [
      "Division-by-Zero Prevention",
      "NULLIF Function",
      "COALESCE Default Values",
      "Defensive Expression Evaluation"
    ],
    code: `-- Calculating conversion rates and click-through rates safely
SELECT 
    campaign_id,
    impressions,
    clicks,
    conversions,
    -- NULLIF returns NULL if clicks == 0, preventing division by zero crash
    ROUND(
        COALESCE(100.0 * clicks / NULLIF(impressions, 0), 0.0), 
        2
    ) AS ctr_pct,
    ROUND(
        COALESCE(100.0 * conversions / NULLIF(clicks, 0), 0.0), 
        2
    ) AS conversion_pct
FROM ad_campaign_stats;`,
    breakdown: [
      "Dividing any number by 0 in SQL raises a fatal runtime exception (e.g., 'division by zero') terminating the query.",
      "NULLIF(col, 0) transforms 0 into NULL. In SQL, any number divided by NULL yields NULL.",
      "COALESCE(..., 0.0) captures the resulting NULL and converts it safely into 0.0 for UI display.",
      "Standard bulletproof pattern for KPI calculations in reporting engines."
    ],
    expectedOutput: `campaign_id | impressions | clicks | conversions | ctr_pct | conversion_pct
CMP-101     | 50000       | 1200   | 180         | 2.40    | 15.00
CMP-102     | 0           | 0      | 0           | 0.00    | 0.00
CMP-103     | 1000        | 0      | 0           | 0.00    | 0.00`
  },
  {
    id: "sql-ex-20",
    title: "Three-Valued Logic Defense in Aggregates and Filtering",
    category: "Aggregations, Grouping & 3VL Logic",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates how SQL three-valued logic (TRUE, FALSE, UNKNOWN) handles NULLs and how to safely compute boolean flag distributions.",
    conceptsCovered: [
      "Three-Valued Logic (3VL)",
      "IS TRUE / IS NOT TRUE",
      "COALESCE in Boolean Filters",
      "Truth Table Evaluation"
    ],
    code: `-- Safe handling of tri-state flags: Verified, Unverified, and Unknown/Pending
SELECT 
    COALESCE(is_email_verified, FALSE) AS verified_state,
    COUNT(*) AS total_users,
    SUM(CASE WHEN is_email_verified IS TRUE THEN 1 ELSE 0 END) AS strictly_true_count,
    SUM(CASE WHEN is_email_verified IS NOT TRUE THEN 1 ELSE 0 END) AS not_true_count
FROM users
GROUP BY COALESCE(is_email_verified, FALSE);

-- Query showing why WHERE flag <> TRUE misses NULL rows:
-- Correct way to match all unverified users including NULL:
SELECT user_id, email, is_email_verified
FROM users
WHERE is_email_verified IS NOT TRUE;`,
    breakdown: [
      "In SQL, comparing NULL = TRUE or NULL <> TRUE evaluates to UNKNOWN, which WHERE clauses reject.",
      "IS NOT TRUE evaluates to TRUE for both FALSE and NULL rows.",
      "COALESCE(is_email_verified, FALSE) normalizes 3VL down to 2-valued boolean logic for reliable GROUP BY buckets.",
      "Essential for preventing silent record exclusion bugs in user authentication and security filters."
    ],
    expectedOutput: `verified_state | total_users | strictly_true_count | not_true_count
false          | 320         | 0                   | 320
true           | 880         | 880                 | 0`
  },
  {
    id: "sql-ex-21",
    title: "String Aggregation Pattern with GROUP_CONCAT / LISTAGG",
    category: "Aggregations, Grouping & 3VL Logic",
    difficulty: "intermediate",
    whatThisCodeCovers: "Aggregates child string values into a single delimited list per parent row across SQL dialects.",
    conceptsCovered: [
      "String Aggregation",
      "Delimited Concatenation",
      "Ordering Within Grouped Strings",
      "Denormalized View Construction"
    ],
    code: `-- Standard SQL aggregation of assigned tags per article
-- In ANSI SQL: LISTAGG(tag_name, ', ') WITHIN GROUP (ORDER BY tag_name)
-- In PostgreSQL: STRING_AGG(tag_name, ', ' ORDER BY tag_name)
-- In MySQL: GROUP_CONCAT(tag_name ORDER BY tag_name SEPARATOR ', ')
SELECT 
    a.article_id,
    a.title,
    -- ANSI SQL Standard syntax:
    LISTAGG(t.tag_name, ', ') WITHIN GROUP (ORDER BY t.tag_name ASC) AS tags_list
FROM articles a
LEFT OUTER JOIN article_tags at ON a.article_id = at.article_id
LEFT OUTER JOIN tags t ON at.tag_id = t.tag_id
GROUP BY a.article_id, a.title;`,
    breakdown: [
      "LISTAGG aggregates string values from child rows into a formatted comma-delimited string.",
      "WITHIN GROUP (ORDER BY ...) determines deterministic sorting of items inside the concatenated string.",
      "Eliminates the need for client applications to stitch together child collections in memory.",
      "Standard pattern for building denormalized search documents or CSV export feeds."
    ],
    expectedOutput: `article_id | title                   | tags_list
101        | Relational Algebra 101 | Database, Theory, Tutorials
102        | Advanced SQL Windowing | Analytics, Data Warehousing, SQL`
  },
  {
    id: "sql-ex-22",
    title: "Distinct Cardinality Counting Across Grouped Dimensions",
    category: "Aggregations, Grouping & 3VL Logic",
    difficulty: "intermediate",
    whatThisCodeCovers: "Calculates true unique customer reach and distinct transaction days per store without double counting multiple purchases per customer.",
    conceptsCovered: [
      "COUNT(DISTINCT column)",
      "High Cardinality Grouping",
      "Unique Reach Metrics",
      "Memory Footprint Considerations"
    ],
    code: `-- Unique customer engagement and shopping frequency per store
SELECT 
    store_id,
    COUNT(order_id) AS total_orders_placed,
    COUNT(DISTINCT customer_id) AS unique_customers_reached,
    COUNT(DISTINCT order_date) AS active_business_days,
    ROUND(
        1.0 * COUNT(order_id) / NULLIF(COUNT(DISTINCT customer_id), 0), 
        2
    ) AS average_orders_per_customer
FROM store_transactions
WHERE transaction_year = 2026
GROUP BY store_id
ORDER BY unique_customers_reached DESC;`,
    breakdown: [
      "COUNT(DISTINCT customer_id) builds a distinct set of customer IDs per group, ignoring duplicates.",
      "Provides accurate unique reach metrics where total orders would wildly inflate customer counts.",
      "COUNT(DISTINCT order_date) reveals true active trading days without storing a separate calendar dimension.",
      "Requires internal hashing or sorting per group; use indexing on (store_id, customer_id) for high performance."
    ],
    expectedOutput: `store_id | total_orders_placed | unique_customers_reached | active_business_days | average_orders_per_customer
STORE-01 | 4500                | 1200                     | 60                   | 3.75
STORE-02 | 3100                | 950                      | 58                   | 3.26`
  }
];
