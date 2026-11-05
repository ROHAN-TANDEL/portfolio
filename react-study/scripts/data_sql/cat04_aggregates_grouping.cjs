const { createCard } = require("../sql_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 37,
    category: "Aggregation & Grouping",
    concept: "Standard Aggregate Functions (COUNT, SUM, AVG, MIN, MAX) & NULL Handling",
    priority: "must-know",
    difficulty: "must-know",
    question: "How do standard aggregate functions (SUM, AVG, MIN, MAX) handle NULL values, and what does an aggregate return on an empty table?",
    quickAnswer: "All standard aggregate functions (`SUM`, `AVG`, `MIN`, `MAX`, `COUNT(col)`) **completely ignore and discard NULL values** during evaluation. For example, `AVG([10, 20, NULL])` computes $(10 + 20) / 2 = 15$ (dividing by 2, not 3). Furthermore, if evaluated over an empty table (or a table where all values are NULL), `SUM`, `AVG`, `MIN`, and `MAX` return `NULL`, whereas `COUNT` uniquely returns `0`.",
    detailedAnswer: "Aggregate Semantics Matrix:\n- `COUNT(*)`: Counts physical rows (never ignores NULLs). Returns 0 on empty sets.\n- `COUNT(column)`: Counts rows where `column IS NOT NULL`. Returns 0 on empty sets.\n- `SUM(column)`: Sums non-null values. Returns `NULL` on empty sets or sets with only NULLs.\n- `AVG(column)`: Calculates `SUM(col) / COUNT(col)`. Returns `NULL` on empty sets.\n- `MIN(col)` / `MAX(col)`: Finds extreme non-null values. Returns `NULL` on empty sets.\n- Production Bug: Writing `SELECT SUM(amount) FROM orders` expecting 0 when no orders exist; wrap in `COALESCE(SUM(amount), 0)` to guarantee numeric zero.",
    code: `-- Empty table or all-null set demonstration
CREATE TABLE sales_test (id INT, revenue NUMERIC(10, 2));

SELECT 
    COUNT(*) AS row_count,                   -- Returns 0
    COUNT(revenue) AS non_null_count,        -- Returns 0
    SUM(revenue) AS total_revenue,           -- Returns NULL!
    COALESCE(SUM(revenue), 0.00) AS safe_sum, -- Returns 0.00 (Production Best Practice)
    AVG(revenue) AS avg_revenue              -- Returns NULL!
FROM sales_test;

-- AVG ignores NULLs:
-- Values: 10, NULL, 20 -> Sum=30, Count=2 -> AVG = 15.00
SELECT AVG(v) FROM (VALUES (10), (NULL), (20)) AS t(v);`,
    recallHint: "Aggregates ignore NULLs (AVG divides by non-null count); SUM/AVG on empty tables return NULL (not 0); wrap in COALESCE(SUM(), 0).",
    interviewTip: "Always wrap `SUM()` in `COALESCE(SUM(amount), 0)` in API endpoints so frontend clients receive `0` instead of `null` when no rows exist.",
    tags: ["aggregate-functions", "null-handling", "coalesce-sum", "avg-calculation", "sql-math"]
  }),

  createCard({
    idNum: 38,
    category: "Aggregation & Grouping",
    concept: "The Physical Truth: COUNT(*) vs COUNT(1) vs COUNT(column)",
    priority: "must-know",
    difficulty: "must-know",
    question: "Is COUNT(1) faster than COUNT(*), and how does COUNT(column) differ fundamentally?",
    quickAnswer: "`COUNT(*)` and `COUNT(1)` are **100% physically and logically identical** in modern SQL database engines; there is zero performance difference between them. Both instruct the query optimizer to count the number of rows in the table. In contrast, `COUNT(column)` is fundamentally different: it inspects every row and only counts rows where that specific column is NOT NULL, requiring extra CPU and memory checks.",
    detailedAnswer: "Debunking the Myth & Mechanics:\n1. The Myth: Decades ago, early database parsers literally evaluated the literal `1` in `COUNT(1)` and some developers claimed it avoided column expansion. In all modern relational engines (PostgreSQL, MySQL, SQL Server, Oracle), the AST parser rewrites `COUNT(1)` directly into `COUNT(*)`.\n2. Optimizer Acceleration: For `COUNT(*)`, the query planner can scan the smallest available non-clustered index on the table, as it only needs to count physical index line pointers without reading table heap data.\n3. `COUNT(column)`: Cannot simply count index rows unless an index specifically exists on that column and proves non-nullability.",
    code: `-- Demonstrating differences
CREATE TABLE user_contacts (
    id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    phone VARCHAR(20) -- Contains NULLs
);

INSERT INTO user_contacts VALUES 
(1, 'Alice', '555-0101'),
(2, 'Bob', NULL),
(3, 'Charlie', '555-0102');

SELECT 
    COUNT(*) AS count_star,       -- Returns 3 (all physical rows)
    COUNT(1) AS count_one,         -- Returns 3 (identical to count_star)
    COUNT(phone) AS count_phone   -- Returns 2 (Bob's NULL phone is ignored!)
FROM user_contacts;`,
    recallHint: "COUNT(*) and COUNT(1) are 100% identical; COUNT(col) counts only non-null values; COUNT(*) is standard idiomatic SQL.",
    interviewTip: "Firmly state that `COUNT(*)` is the ANSI SQL standard way to count rows, and modern query optimizers treat `COUNT(1)` identically.",
    tags: ["count-star", "count-one", "count-column", "sql-myths", "query-optimizer"]
  }),

  createCard({
    idNum: 39,
    category: "Aggregation & Grouping",
    concept: "GROUP BY Column Collapsing Rules & Deterministic Projection",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is the Single-Table Projection Rule for GROUP BY, and why does SELECT * with GROUP BY fail in ANSI SQL?",
    quickAnswer: "In standard ANSI SQL, whenever a query includes a `GROUP BY` clause, every column in the `SELECT` projection list MUST either: 1) appear in the `GROUP BY` clause, or 2) be enclosed inside an aggregate function (`SUM`, `MAX`, etc.). Selecting an un-aggregated, un-grouped column fails because multiple rows collapse into a single group row, making it mathematically impossible for the engine to know which specific row's value to display.",
    detailedAnswer: "ANSI Rules vs Functional Dependency Exception:\n1. The Error: Selecting non-grouped column `employee_name` when grouping by `department_id` throws: `column must appear in the GROUP BY clause or be used in an aggregate function`.\n2. ANSI SQL:1999 Exception (Functional Dependency): If the `GROUP BY` clause includes the **Primary Key** of a table (e.g. `GROUP BY c.customer_id`), modern SQL engines allow selecting any column of `customers` (e.g. `c.name`, `c.email`) without aggregating them, because the primary key uniquely determines all attributes of that row.\n3. MySQL Legacy Trap: MySQL historically allowed non-grouped columns (`ONLY_FULL_GROUP_BY` disabled), returning arbitrary nondeterministic row values.",
    code: `-- 1. ILLEGAL IN ANSI SQL:
-- SELECT department_id, employee_name, AVG(salary) 
-- FROM employees GROUP BY department_id;
-- Error: employee_name is neither grouped nor aggregated!

-- 2. CORRECT ANSI SQL: Group on both or aggregate
SELECT department_id, MAX(employee_name) AS sample_emp, AVG(salary) AS avg_sal
FROM employees
GROUP BY department_id;

-- 3. VALID IN MODERN SQL (Functional Dependency on Primary Key):
SELECT c.customer_id, c.company_name, c.email, COUNT(o.order_id) AS total_orders
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.customer_id
GROUP BY c.customer_id; -- Legal because c.customer_id is PRIMARY KEY!`,
    recallHint: "Columns in SELECT must be in GROUP BY or aggregated; exception: grouping by Primary Key allows projecting all table columns.",
    interviewTip: "Mention the functional dependency exception in modern SQL: grouping by `customers.id` (PK) permits selecting `customers.name` without error.",
    tags: ["group-by", "deterministic-projection", "only_full_group_by", "functional-dependency", "ansi-sql"]
  }),

  createCard({
    idNum: 40,
    category: "Aggregation & Grouping",
    concept: "HAVING vs WHERE: Pre-Aggregation vs Post-Aggregation Filtering",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is the structural and performance difference between the WHERE clause and the HAVING clause?",
    quickAnswer: "The `WHERE` clause filters individual rows **BEFORE** aggregation takes place, eliminating non-matching records before they enter grouping memory. The `HAVING` clause filters aggregated group buckets **AFTER** the groups have been formed and calculated. In production, any filter that does not involve an aggregate function should ALWAYS be placed in the `WHERE` clause to minimize the memory and CPU required for grouping.",
    detailedAnswer: "Execution Order & Efficiency:\n1. Execution Pipeline: `FROM` $\\to$ `WHERE` (filters raw rows) $\\to$ `GROUP BY` (collapses remaining rows into buckets) $\\to$ `HAVING` (evaluates aggregate predicates on buckets).\n2. Syntax Guard: You CANNOT use aggregate functions in `WHERE` (e.g. `WHERE COUNT(*) > 5` is illegal). You MUST use `HAVING COUNT(*) > 5`.\n3. Performance Pitfall: Putting row filters like `HAVING status = 'ACTIVE'` forces the database to group millions of inactive rows only to throw away the resulting buckets; putting `WHERE status = 'ACTIVE'` discards them upfront using indexes.",
    code: `-- Optimal Pipeline: WHERE filters rows upfront; HAVING filters summary metrics
SELECT 
    department_id,
    COUNT(*) AS active_employee_count,
    ROUND(AVG(salary), 2) AS avg_salary
FROM employees
WHERE status = 'ACTIVE'                -- Step 1: Pre-aggregation filter (Uses Index!)
GROUP BY department_id                 -- Step 2: Group only active rows into buckets
HAVING COUNT(*) >= 5                   -- Step 3: Post-aggregation group filter
   AND AVG(salary) > 75000;            -- Step 4: Metric constraint on aggregated bucket`,
    recallHint: "WHERE filters rows before grouping (uses indexes); HAVING filters group metrics after grouping; never put row filters in HAVING.",
    interviewTip: "Never say 'HAVING is WHERE for aggregates' without adding that non-aggregate filters in HAVING waste database memory by grouping unneeded rows.",
    tags: ["where-vs-having", "pre-aggregation", "post-aggregation", "query-lifecycle", "performance-optimization"]
  }),

  createCard({
    idNum: 41,
    category: "Aggregation & Grouping",
    concept: "Grouping by Expressions & Derived Bucketing",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you group by dynamic expressions (date truncations, CASE buckets, string prefixes) in standard SQL?",
    quickAnswer: "In ANSI SQL, the `GROUP BY` clause can evaluate arbitrary scalar expressions and function results (such as `CASE WHEN` score bands, string extractions, or temporal intervals) rather than raw column names. To project the expression in the `SELECT` list, you must either repeat the exact same expression in both `SELECT` and `GROUP BY`, or wrap the calculation inside a Common Table Expression (CTE) or subquery.",
    detailedAnswer: "Derived Bucketing Patterns:\n1. Temporal Grouping: Grouping by date intervals (e.g. `EXTRACT(YEAR FROM order_date)` or `DATE_TRUNC`).\n2. Range / Cohort Bucketing: Using `CASE WHEN` inside `GROUP BY` to group users by demographic brackets (e.g. age groups '18-25', '26-35').\n3. Alias Limitation: Standard ANSI SQL does NOT allow referencing aliases defined in `SELECT` inside the `GROUP BY` clause (though PostgreSQL and MySQL permit it as an extension). Using a CTE ensures cross-dialect compatibility.",
    code: `-- Cohort bucketing using CASE expression in GROUP BY
SELECT 
    CASE 
        WHEN balance < 1000 THEN 'Tier 1: Under $1K'
        WHEN balance BETWEEN 1000 AND 10000 THEN 'Tier 2: $1K-$10K'
        ELSE 'Tier 3: VIP ($10K+)'
    END AS customer_tier,
    COUNT(*) AS total_customers,
    SUM(balance) AS aggregate_balance
FROM bank_accounts
GROUP BY 
    CASE 
        WHEN balance < 1000 THEN 'Tier 1: Under $1K'
        WHEN balance BETWEEN 1000 AND 10000 THEN 'Tier 2: $1K-$10K'
        ELSE 'Tier 3: VIP ($10K+)'
    END
ORDER BY MIN(balance) ASC;`,
    recallHint: "GROUP BY can group on expressions and CASE buckets; repeat expression or wrap in CTE for cross-database ANSI portability.",
    interviewTip: "Explain why repeating a CASE expression in `GROUP BY` does not evaluate twice: modern query compilers parse and hash the expression to evaluate it once.",
    tags: ["derived-grouping", "case-buckets", "cohort-analysis", "expressions", "ansi-portability"]
  }),

  createCard({
    idNum: 42,
    category: "Aggregation & Grouping",
    concept: "Hierarchical Multi-Column Grouping",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does multi-column grouping work in SQL, and how does the engine form composite aggregation keys?",
    quickAnswer: "When multiple columns are specified in `GROUP BY col1, col2, col3`, the database forms composite grouping keys where every unique combination of values across all specified columns constitutes an independent aggregation bucket. For example, grouping by `department_id, job_title` calculates aggregates for each distinct role within each department.",
    detailedAnswer: "Multi-Column Mechanics:\n1. Cartesian Subset: The number of resulting groups is bounded by $|col1| \\times |col2|$.\n2. NULL Handling in Composite Groups: If two rows both have `(col1 = 'Sales', col2 = NULL)`, they are grouped together into the same single bucket (unlike `WHERE` comparisons where NULLs don't equal each other, `GROUP BY` treats NULLs as matching group keys).\n3. Ordering: Grouping does NOT guarantee sorted output; an explicit `ORDER BY` must be supplied.",
    code: `-- Multi-column grouping across Department and Job Role
SELECT 
    department_id,
    job_title,
    COUNT(*) AS headcount,
    MIN(salary) AS min_salary,
    MAX(salary) AS max_salary,
    ROUND(AVG(salary), 2) AS avg_salary
FROM employees
WHERE status = 'ACTIVE'
GROUP BY department_id, job_title
ORDER BY department_id ASC, headcount DESC;`,
    breakdown: [
      "Every distinct pair of (department_id, job_title) forms an independent bucket.",
      "NULLs in either column form valid groups.",
      "ORDER BY guarantees clean hierarchical presentation."
    ],
    recallHint: "GROUP BY col1, col2 groups by unique composite pairs; treats NULLs as identical matching group keys.",
    interviewTip: "Highlight that `GROUP BY` treats `NULL` values as equivalent keys for grouping, unlike `WHERE` which treats `NULL = NULL` as UNKNOWN.",
    tags: ["multi-column-grouping", "composite-keys", "null-grouping", "aggregates", "hierarchies"]
  }),

  createCard({
    idNum: 43,
    category: "Aggregation & Grouping",
    concept: "Distinct Aggregates: COUNT(DISTINCT col) & Performance Scaling",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does COUNT(DISTINCT column) work, and why does it become a major performance bottleneck on large tables?",
    quickAnswer: "`COUNT(DISTINCT column)` computes the number of unique non-null values for a column within each group. Unlike standard `COUNT(*)`, which can be computed in a single sequential streaming pass by simply incrementing a counter, `COUNT(DISTINCT)` requires the database to maintain an in-memory hash set or perform an internal sort to eliminate duplicate values for every group, causing high CPU usage and memory spills on high-cardinality data.",
    detailedAnswer: "Performance Implications:\n1. Memory Overhead: To determine if a value is unique, the engine must store all seen values in RAM hash tables.\n2. Multiple Distinct Aggregates: Writing `SELECT COUNT(DISTINCT user_id), COUNT(DISTINCT ip_address)` forces the engine to duplicate sorting or hashing streams, preventing pipelined group aggregations.\n3. Solutions for Big Data: On multi-million row tables, approximate algorithms (such as HyperLogLog) or two-phase pre-aggregations are preferred when exact counts are not legally mandated.",
    code: `-- Calculating distinct active customers and total orders per store
SELECT 
    store_id,
    COUNT(*) AS total_orders,                       -- Fast: simple incrementing counter
    COUNT(DISTINCT customer_id) AS unique_shoppers, -- Heavy: requires hash deduplication!
    ROUND(COUNT(*)::NUMERIC / COUNT(DISTINCT customer_id), 2) AS orders_per_customer
FROM orders
GROUP BY store_id;`,
    recallHint: "COUNT(DISTINCT) requires hashing or sorting all values to deduplicate; memory-intensive on high cardinality.",
    interviewTip: "Explain that multiple `COUNT(DISTINCT)` on different columns in the same query prevents the optimizer from sharing hash tables, often multiplying query cost.",
    tags: ["count-distinct", "cardinality", "hash-deduplication", "performance-bottlenecks", "aggregates"]
  }),

  createCard({
    idNum: 44,
    category: "Aggregation & Grouping",
    concept: "Conditional Aggregates: CASE WHEN inside Aggregate Functions",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you calculate conditional metric columns (e.g. Pivot Tables) in ANSI SQL using CASE WHEN inside aggregates?",
    quickAnswer: "In standard ANSI SQL, you conditionally aggregate subsets of data by wrapping a searched `CASE WHEN` expression inside an aggregate function: `SUM(CASE WHEN status = 'PAID' THEN amount ELSE 0 END)` or `COUNT(CASE WHEN is_vip = 1 THEN 1 END)`. Because `COUNT(col)` ignores NULLs, omitting the `ELSE` branch in a CASE expression causes non-matching rows to evaluate to NULL, effectively filtering the count.",
    detailedAnswer: "The Conditional Aggregate Patterns:\n1. Conditional Sum: `SUM(CASE WHEN condition THEN amount ELSE 0 END)`.\n2. Conditional Count: `COUNT(CASE WHEN condition THEN 1 END)`. (Omitting ELSE leaves NULL, which `COUNT` ignores!)\n3. Ratio / Percentage Calculation: `100.0 * COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) / COUNT(*)`.\n4. Cross-Tabulation / Pivoting: Rotating rows into typed columns in a single table scan without specialized vendor pivot keywords.",
    code: `-- Single-pass KPI summary transforming status rows into columns
SELECT 
    seller_id,
    COUNT(*) AS total_listings,
    -- Count only active listings (Omitting ELSE yields NULL, which COUNT ignores!)
    COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) AS active_listings,
    -- Sum revenue for sold listings
    COALESCE(SUM(CASE WHEN status = 'SOLD' THEN price ELSE 0 END), 0.00) AS total_sold_revenue,
    -- Calculate sell-through conversion rate
    ROUND(
        100.0 * COUNT(CASE WHEN status = 'SOLD' THEN 1 END) / NULLIF(COUNT(*), 0), 
        2
    ) AS sell_through_rate_pct
FROM product_listings
GROUP BY seller_id;`,
    recallHint: "Wrap CASE WHEN inside aggregates; COUNT(CASE WHEN cond THEN 1 END) works because COUNT ignores implicit NULLs.",
    interviewTip: "Demonstrate `COUNT(CASE WHEN cond THEN 1 END)`: omitting ELSE produces NULL, which COUNT safely skips, creating a clean conditional counter.",
    tags: ["conditional-aggregation", "case-when-aggregate", "pivot-tables", "kpi-reporting", "ansi-sql"]
  }),

  createCard({
    idNum: 45,
    category: "Aggregation & Grouping",
    concept: "Division by Zero Safeguards in Percentage & Ratio Calculations",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why do production analytics queries fail with division-by-zero errors, and what is the standard ANSI SQL solution?",
    quickAnswer: "In SQL, dividing any number by literal `0` causes an immediate runtime exception (`division by zero`), aborting the entire query or scheduled reporting batch. The standard ANSI SQL solution is wrapping the denominator in `NULLIF(denominator, 0)`. If the denominator is 0, `NULLIF` converts it to `NULL`; dividing any number by `NULL` returns `NULL` safely rather than crashing the database.",
    detailedAnswer: "Production Ratio Formula:\n- Dangerous: `ROUND(100.0 * success_count / total_count, 2)` $\\to$ Crashes if `total_count` is 0.\n- Hardened: `ROUND(100.0 * success_count / NULLIF(total_count, 0), 2)` $\\to$ Returns `NULL` if `total_count` is 0.\n- Zero-Default Fallback: `COALESCE(ROUND(100.0 * success_count / NULLIF(total_count, 0), 2), 0.00)` $\\to$ Returns `0.00` if `total_count` is 0.",
    code: `-- Hardened production financial KPI query
SELECT 
    campaign_name,
    impressions,
    conversions,
    ad_spend,
    revenue,
    -- 1. Safe Conversion Rate (Prevents crash if impressions = 0)
    COALESCE(
        ROUND(100.0 * conversions / NULLIF(impressions, 0), 2), 
        0.00
    ) AS conversion_rate_pct,
    -- 2. Safe Return on Ad Spend (ROAS) (Prevents crash if spend = 0)
    COALESCE(
        ROUND(revenue / NULLIF(ad_spend, 0), 2), 
        0.00
    ) AS roas_ratio
FROM digital_marketing_campaigns;`,
    recallHint: "Wrap all denominators in NULLIF(denominator, 0); turns 0 into NULL; division by NULL yields NULL; wrap in COALESCE for 0.00 fallback.",
    interviewTip: "Never submit a SQL calculation in a coding interview with raw division (`a / b`) without wrapping the denominator in `NULLIF(b, 0)`.",
    tags: ["division-by-zero", "nullif", "coalesce", "ratio-calculations", "production-hardening"]
  }),

  createCard({
    idNum: 46,
    category: "Aggregation & Grouping",
    concept: "Statistical & Variance Aggregates (STDDEV, VARIANCE)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are the standard statistical aggregate functions in SQL, and what is the difference between sample and population variance?",
    quickAnswer: "Standard SQL provides statistical aggregates to measure data dispersion: `VARIANCE` (or `VAR_SAMP` / `VAR_POP`) measures the average squared deviation from the mean, and `STDDEV` (or `STDDEV_SAMP` / `STDDEV_POP`) computes the square root of the variance. Sample functions (`_SAMP`) divide by $N - 1$ (Bessel's correction for estimating population metrics from a sample), while population functions (`_POP`) divide by $N$.",
    detailedAnswer: "Mathematical Specifications:\n1. Population Variance (`VAR_POP`): $\\sigma^2 = \\frac{\\sum (x_i - \\mu)^2}{N}$. Used when the dataset contains all entities in existence.\n2. Sample Variance (`VAR_SAMP`): $s^2 = \\frac{\\sum (x_i - \\bar{x})^2}{N - 1}$. Used when calculating metrics on a sample subset.\n3. Default Behavior: In most relational engines, bare `VARIANCE()` and `STDDEV()` default to the sample calculation (`_SAMP`).",
    code: `-- Statistical profiling of server API latencies
SELECT 
    endpoint_path,
    COUNT(*) AS request_count,
    ROUND(AVG(latency_ms), 2) AS mean_latency,
    ROUND(STDDEV(latency_ms), 2) AS sample_std_deviation,
    ROUND(MIN(latency_ms), 2) AS p0_min,
    ROUND(MAX(latency_ms), 2) AS p100_max
FROM api_access_logs
GROUP BY endpoint_path
HAVING COUNT(*) > 100;`,
    recallHint: "STDDEV and VARIANCE measure data spread; _SAMP divides by N-1 (default); _POP divides by N.",
    interviewTip: "Mention that standard deviation combined with the mean allows detecting latency outliers (e.g. queries taking $> \\text{mean} + 3 \\times \\text{stddev}$).",
    tags: ["statistical-aggregates", "stddev", "variance", "dispersion", "math-functions"]
  }),

  createCard({
    idNum: 47,
    category: "Aggregation & Grouping",
    concept: "Cross-Dialect String Aggregation Standards (LISTAGG, STRING_AGG, GROUP_CONCAT)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you concatenate strings across grouped rows, and how does syntax vary across ANSI SQL, PostgreSQL, MySQL, and Oracle?",
    quickAnswer: "Concatenating string values from multiple rows into a single delimiter-separated string is supported across all major databases, but syntax varies significantly: 1) **ANSI SQL:2016 / Oracle**: `LISTAGG(name, ', ') WITHIN GROUP (ORDER BY name)`; 2) **PostgreSQL / SQL Server 2017+**: `STRING_AGG(name, ', ' ORDER BY name)`; and 3) **MySQL / SQLite**: `GROUP_CONCAT(name ORDER BY name SEPARATOR ', ')`.",
    detailedAnswer: "Dialect Comparison Matrix:\n- ANSI SQL / Oracle: `LISTAGG(col, ',') WITHIN GROUP (ORDER BY sort_col)`.\n- PostgreSQL: `STRING_AGG(col, ',' ORDER BY sort_col)`.\n- SQL Server (2017+): `STRING_AGG(col, ',') WITHIN GROUP (ORDER BY sort_col)`.\n- MySQL: `GROUP_CONCAT(col ORDER BY sort_col SEPARATOR ',')`.\n- Handling NULLs: All string aggregators automatically ignore `NULL` entries, only concatenating non-null strings.",
    code: `-- 1. ANSI SQL / Oracle / SQL Server syntax
SELECT 
    department_id,
    STRING_AGG(employee_name, ', ') WITHIN GROUP (ORDER BY hire_date ASC) AS employee_roster
FROM employees
GROUP BY department_id;

-- 2. PostgreSQL syntax
SELECT 
    department_id,
    STRING_AGG(employee_name, ', ' ORDER BY hire_date ASC) AS employee_roster
FROM employees
GROUP BY department_id;

-- 3. MySQL syntax
SELECT 
    department_id,
    GROUP_CONCAT(employee_name ORDER BY hire_date ASC SEPARATOR ', ') AS employee_roster
FROM employees
GROUP BY department_id;`,
    recallHint: "ANSI/Oracle uses LISTAGG; Postgres/SQL Server uses STRING_AGG; MySQL uses GROUP_CONCAT; all ignore NULLs.",
    interviewTip: "Demonstrating knowledge of cross-dialect differences (`STRING_AGG` vs `LISTAGG` vs `GROUP_CONCAT`) proves strong real-world database versatility.",
    tags: ["string-aggregation", "string_agg", "listagg", "group_concat", "cross-dialect"]
  }),

  createCard({
    idNum: 48,
    category: "Aggregation & Grouping",
    concept: "Relational Pivot Concepts using ANSI Standard SQL Aggregates",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you pivot row data into columns using standard ANSI SQL without relying on proprietary PIVOT keywords?",
    quickAnswer: "While some databases offer proprietary keywords (Oracle/SQL Server `PIVOT`), the portable ANSI SQL standard way to pivot rows into columns is combining `GROUP BY` with conditional aggregation (`MAX(CASE WHEN ...)` or `SUM(CASE WHEN ...)`). You group by the desired row identifier (e.g. `product_name`) and create a separate aggregate column for each target pivot category.",
    detailedAnswer: "The Universal Pivot Pattern:\n1. Concept: Transform row values (`'Q1'`, `'Q2'`, `'Q3'`, `'Q4'`) into 4 dedicated columns.\n2. Implementation: `SUM(CASE WHEN quarter = 'Q1' THEN sales ELSE 0 END) AS q1_sales`.\n3. Dynamic Columns Limitation: In standard SQL, the number of output columns MUST be fixed at query compile time. Truly dynamic pivoting where new columns appear automatically requires dynamic SQL generation in application code.",
    code: `-- Standard ANSI SQL Pivot: Rotating Quarterly Sales Rows into Columns
SELECT 
    product_id,
    product_name,
    COALESCE(SUM(CASE WHEN quarter = 'Q1' THEN revenue END), 0.00) AS q1_revenue,
    COALESCE(SUM(CASE WHEN quarter = 'Q2' THEN revenue END), 0.00) AS q2_revenue,
    COALESCE(SUM(CASE WHEN quarter = 'Q3' THEN revenue END), 0.00) AS q3_revenue,
    COALESCE(SUM(CASE WHEN quarter = 'Q4' THEN revenue END), 0.00) AS q4_revenue,
    SUM(revenue) AS annual_total
FROM quarterly_product_sales
GROUP BY product_id, product_name
ORDER BY annual_total DESC;`,
    recallHint: "Universal pivot = GROUP BY row_id + SUM(CASE WHEN col = 'Val' THEN metric END) per target column.",
    interviewTip: "Explain why standard SQL cannot have dynamic pivot columns: SQL query execution plans require deterministic column schemas before scanning data.",
    tags: ["pivot", "cross-tabulation", "case-when-pivot", "ansi-portability", "reporting"]
  })
];

module.exports = cards;
