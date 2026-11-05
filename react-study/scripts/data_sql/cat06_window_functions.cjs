const { createCard } = require("../sql_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 61,
    category: "Window Functions & Analytics",
    concept: "Anatomy of the OVER () Clause (Partitions, Ordering & Execution Phase)",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is a Window Function in SQL, how does it differ from a GROUP BY aggregation, and what is the syntax of the OVER clause?",
    quickAnswer: "Unlike `GROUP BY` (which collapses multiple rows into a single summary row), a **Window Function** computes calculations across a set of table rows related to the current row **while preserving the identity of every single individual row**. The syntax is `FUNCTION() OVER (PARTITION BY col1 ORDER BY col2 [frame_clause])`. Window functions execute **AFTER** `WHERE`, `GROUP BY`, and `HAVING` clauses, but **BEFORE** `ORDER BY` and `LIMIT`.",
    detailedAnswer: "OVER Clause Components:\n1. Preserving Granularity: If a table has 100 rows, a window function outputs 100 rows, appending the calculated metric alongside original row columns.\n2. `PARTITION BY`: Divides rows into independent logical groups (partitions) where calculations reset.\n3. `ORDER BY`: Defines the logical sequence of rows within each partition for ranking or running totals.\n4. Frame Specification: Defines the sliding window of rows relative to the current row (`ROWS BETWEEN ...`).\n5. Execution Phase Rule: Because window functions execute after `WHERE`, you CANNOT filter by a window function in the `WHERE` clause; you must wrap it in a CTE or derived table.",
    code: `-- Window function preserving individual rows while displaying department total
SELECT 
    employee_id,
    department_id,
    full_name,
    salary,
    -- Window aggregate: calculates department total without collapsing rows!
    SUM(salary) OVER (PARTITION BY department_id) AS department_payroll,
    -- Ratio of employee salary to department total
    ROUND(100.0 * salary / SUM(salary) OVER (PARTITION BY department_id), 2) AS pct_of_dept_payroll
FROM employees;`,
    recallHint: "Window functions preserve individual rows; OVER (PARTITION BY ... ORDER BY ...); executes after WHERE/HAVING, before final ORDER BY.",
    interviewTip: "When asked 'Can I put a window function in the WHERE clause?', answer 'No, because window functions evaluate after WHERE; use a CTE or subquery to filter window results.'",
    tags: ["window-functions", "over-clause", "partition-by", "analytics", "execution-order"]
  }),

  createCard({
    idNum: 62,
    category: "Window Functions & Analytics",
    concept: "Ranking Functions: ROW_NUMBER() vs RANK() vs DENSE_RANK()",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is the exact mathematical difference between ROW_NUMBER(), RANK(), and DENSE_RANK() when duplicate values tie?",
    quickAnswer: "`ROW_NUMBER()` assigns sequential unique integers ($1, 2, 3, 4$) arbitrarily breaking ties. `RANK()` assigns identical numbers to ties and **skips subsequent ranks** to reflect the count of preceding rows ($1, 2, 2, 4$). `DENSE_RANK()` assigns identical numbers to ties but **never skips numbers**, producing a consecutive sequence ($1, 2, 2, 3$).",
    detailedAnswer: "Tie-Breaking Comparison Matrix:\n- Values: `[100, 90, 90, 80]`\n  - `ROW_NUMBER()`: `1, 2, 3, 4` (deterministic only if tie-breaker column added).\n  - `RANK()`: `1, 2, 2, 4` (rank 3 is skipped because 2 people tied for 2nd place).\n  - `DENSE_RANK()`: `1, 2, 2, 3` (no ranks skipped; 80 is strictly 3rd dense rank).\n- Common Use Case: Finding the 'Top 3 highest salaries' in a company:\n  - Use `DENSE_RANK()` so that if two executives tie for 1st place, the next salary down is still considered 2nd place.",
    code: `-- Demonstrating tie behavior on student test scores
SELECT 
    student_name,
    score,
    ROW_NUMBER() OVER (ORDER BY score DESC) AS row_num,
    RANK() OVER (ORDER BY score DESC) AS rnk,
    DENSE_RANK() OVER (ORDER BY score DESC) AS dense_rnk
FROM exam_results;

-- Scores:  Alice(95), Bob(90), Charlie(90), David(85)
-- row_num:   1,         2,       3,           4
-- rnk:       1,         2,       2,           4  <-- Skips 3!
-- dense_rnk: 1,         2,       2,           3  <-- No skip!`,
    recallHint: "ROW_NUMBER = 1,2,3,4 (no ties); RANK = 1,2,2,4 (skips gaps); DENSE_RANK = 1,2,2,3 (no gaps).",
    interviewTip: "This is guaranteed to appear in technical SQL interviews: be ready to write out the sequence `1, 2, 2, 4` for `RANK` vs `1, 2, 2, 3` for `DENSE_RANK`.",
    tags: ["row_number", "rank", "dense_rank", "ranking-functions", "tie-handling"]
  }),

  createCard({
    idNum: 63,
    category: "Window Functions & Analytics",
    concept: "Quantile Distribution with NTILE(n)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the NTILE(n) window function distribute rows into buckets, and how are remainders handled?",
    quickAnswer: "`NTILE(n)` divides an ordered partition of rows into $n$ approximately equal-sized ranked buckets numbered from $1$ to $n$. It is standard for creating quartiles (`NTILE(4)`), deciles (`NTILE(10)`), or percentiles (`NTILE(100)`). If the total number of rows is not evenly divisible by $n$, the remainder rows are distributed **one by one to the earliest buckets** (e.g. 10 rows into 4 buckets produces bucket sizes of $3, 3, 2, 2$).",
    detailedAnswer: "Mathematical Distribution Rules:\n1. Bucket Size Calculation: Base size is $\\lfloor N / n \\rfloor$. Remainder is $N \\pmod n$.\n2. Remainder Allocation: The first $N \\pmod n$ buckets receive $(\\lfloor N / n \\rfloor + 1)$ rows; remaining buckets receive $\\lfloor N / n \\rfloor$ rows.\n3. Common Use Cases: Grouping customers into spending quartiles (Top 25% = Quartile 1), segmenting leads by engagement score, and workload partitioning.",
    code: `-- Divide sales reps into 4 Performance Quartiles based on quarterly revenue
SELECT 
    sales_rep_id,
    quarterly_revenue,
    NTILE(4) OVER (ORDER BY quarterly_revenue DESC) AS performance_quartile
FROM sales_performance;

-- Quartile 1: Top 25% (High Performers)
-- Quartile 4: Bottom 25%`,
    recallHint: "NTILE(n) splits sorted rows into n equal buckets (e.g. NTILE(4) for quartiles); extra remainder rows go to first buckets.",
    interviewTip: "Mention that `NTILE(100)` is useful for approximate percentile assignment, but unlike `PERCENT_RANK()`, NTILE guarantees balanced bucket sizes.",
    tags: ["ntile", "quartiles", "percentiles", "segmentation", "window-functions"]
  }),

  createCard({
    idNum: 64,
    category: "Window Functions & Analytics",
    concept: "Relative Offsets: LEAD() and LAG() for Time-Series Deltas",
    priority: "must-know",
    difficulty: "must-know",
    question: "How do LEAD() and LAG() access adjacent rows without self-joins, and how do you calculate period-over-period growth?",
    quickAnswer: "`LAG(col, offset, default)` accesses a column value from a row $N$ steps **before** the current row within the partition. `LEAD(col, offset, default)` accesses a column value from a row $N$ steps **after** the current row. By default, offset is 1 and default is `NULL`. Together, they eliminate expensive self-joins for calculating month-over-month growth, time intervals between events, and change detection.",
    detailedAnswer: "Function Signature & Use Cases:\n- `LAG(expression [, offset [, default_value]]) OVER (...)`\n  - If `offset` is omitted, defaults to 1 (immediate predecessor).\n  - If `default_value` is omitted, returns `NULL` for the first row of each partition.\n- Month-over-Month Delta Formula:\n  $$\\text{Growth} = \\frac{\\text{Current} - \\text{LAG}(\\text{Current})}{\\text{LAG}(\\text{Current})} \\times 100$$\n- Calculating Time Gaps: `created_at - LAG(created_at) OVER (ORDER BY created_at)` calculates elapsed time between user actions.",
    code: `-- Calculating Month-over-Month (MoM) revenue growth
SELECT 
    sales_month,
    revenue,
    -- Access previous month revenue (default to 0.00 if first month)
    LAG(revenue, 1, 0.00) OVER (ORDER BY sales_month ASC) AS prev_month_revenue,
    -- Calculate difference
    revenue - LAG(revenue, 1, revenue) OVER (ORDER BY sales_month ASC) AS mom_dollar_change,
    -- Calculate percentage change
    ROUND(
        100.0 * (revenue - LAG(revenue) OVER (ORDER BY sales_month ASC)) / 
        NULLIF(LAG(revenue) OVER (ORDER BY sales_month ASC), 0), 
        2
    ) AS mom_growth_pct
FROM monthly_sales;`,
    recallHint: "LAG looks backward N rows; LEAD looks forward N rows; eliminates self-joins for month-over-month deltas.",
    interviewTip: "Always show `LAG(col, 1, default)` with the 3rd argument (default value) to avoid dealing with NULL on the boundary row.",
    tags: ["lag", "lead", "month-over-month", "time-series", "relative-offsets"]
  }),

  createCard({
    idNum: 65,
    category: "Window Functions & Analytics",
    concept: "Positional Navigation: FIRST_VALUE(), LAST_VALUE() and NTH_VALUE()",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do FIRST_VALUE(), LAST_VALUE(), and NTH_VALUE() operate, and what is the common framing trap with LAST_VALUE()?",
    quickAnswer: "`FIRST_VALUE(col)` returns the first value in the window frame. `LAST_VALUE(col)` returns the last value in the window frame. `NTH_VALUE(col, n)` returns the Nth value. The **critical trap with LAST_VALUE()** is that the default window frame ends at the `CURRENT ROW`, meaning `LAST_VALUE()` simply returns the current row's own value! To make `LAST_VALUE()` look at the end of the entire partition, you MUST explicitly specify `ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING`.",
    detailedAnswer: "The LAST_VALUE Framing Trap Explained:\n- Default Frame: When `ORDER BY` is present, the implicit default frame is `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`.\n- Because the frame stops at `CURRENT ROW`, the 'last value' seen so far is always the current row!\n- The Fix: Specify the full frame:\n  ```sql\n  LAST_VALUE(col) OVER (\n      PARTITION BY dept \n      ORDER BY salary \n      ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING\n  )\n  ```",
    code: `-- Compare each employee's salary to the highest and lowest in their department
SELECT 
    employee_id,
    department_id,
    salary,
    -- Lowest salary in department (First value in sorted partition)
    FIRST_VALUE(salary) OVER (
        PARTITION BY department_id 
        ORDER BY salary ASC
    ) AS min_dept_salary,
    -- Highest salary in department (Requires explicit frame to look to the end!)
    LAST_VALUE(salary) OVER (
        PARTITION BY department_id 
        ORDER BY salary ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING -- CRITICAL!
    ) AS max_dept_salary
FROM employees;`,
    recallHint: "LAST_VALUE() requires ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING; otherwise default frame stops at CURRENT ROW.",
    interviewTip: "Explaining the `LAST_VALUE()` default frame trap is an instant signal of senior-level SQL mastery.",
    tags: ["first_value", "last_value", "nth_value", "window-frames", "framing-trap"]
  }),

  createCard({
    idNum: 66,
    category: "Window Functions & Analytics",
    concept: "Cumulative Running Totals & Default Frame Behavior",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you calculate cumulative running totals in SQL, and how does adding an ORDER BY clause fundamentally alter SUM() OVER ()?",
    quickAnswer: "Writing `SUM(col) OVER ()` (without `ORDER BY`) computes a **static total** across the entire dataset. However, adding an `ORDER BY` clause inside `OVER (ORDER BY date)` fundamentally changes the calculation into a **cumulative running total**. This happens because `ORDER BY` implicitly activates a default sliding window frame: `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`.",
    detailedAnswer: "Running Total Mechanics:\n1. Row 1: Sum of Row 1.\n2. Row 2: Sum of Row 1 + Row 2.\n3. Row N: Sum of all rows from the start of the partition up to current row.\n4. Resetting per Entity: Adding `PARTITION BY account_id ORDER BY tx_date` computes a running account balance that resets to 0 for each new account.",
    code: `-- Calculating running account balance over time
SELECT 
    account_id,
    transaction_date,
    amount,
    -- Cumulative running balance (resets per account_id)
    SUM(amount) OVER (
        PARTITION BY account_id 
        ORDER BY transaction_date ASC, transaction_id ASC
    ) AS running_balance
FROM bank_transactions
ORDER BY account_id, transaction_date;`,
    breakdown: [
      "PARTITION BY account_id isolates calculations per customer account.",
      "ORDER BY transaction_date converts static SUM into an incremental running total.",
      "Adding transaction_id ensures deterministic ordering for transactions on the same date."
    ],
    recallHint: "SUM() OVER (ORDER BY col) produces a cumulative running total due to the default frame (UNBOUNDED PRECEDING TO CURRENT ROW).",
    interviewTip: "Highlight that `OVER (ORDER BY ...)` turns any standard aggregate (`SUM`, `AVG`, `COUNT`) into an incremental running metric.",
    tags: ["running-total", "cumulative-sum", "window-frames", "bank-ledger", "time-series"]
  }),

  createCard({
    idNum: 67,
    category: "Window Functions & Analytics",
    concept: "Physical Framing (ROWS) vs Logical Value Framing (RANGE)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the structural difference between ROWS and RANGE window frame clauses, and why does RANGE cause tie-grouping bugs?",
    quickAnswer: "`ROWS` defines the window frame by counting **physical row offsets** (e.g. exactly 2 physical rows preceding). `RANGE` defines the window frame by evaluating **logical value offsets** of the `ORDER BY` column. When duplicate values (ties) exist in the `ORDER BY` column, `RANGE` treats all tied rows as a single combined unit, including all duplicate rows in the cumulative calculation simultaneously.",
    detailedAnswer: "The RANGE Duplicate Tie Trap:\n- Consider running sum on `[10, 20, 20, 30]` with `RANGE`:\n  - Row 1 (10): Running sum = 10.\n  - Row 2 (20): Because Row 2 and Row 3 tie at 20, `RANGE` includes BOTH rows! Running sum jumps immediately to $10 + 20 + 20 = 50$ on Row 2!\n  - Row 3 (20): Running sum = 50.\n- With `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`:\n  - Row 1 = 10\n  - Row 2 = 30\n  - Row 3 = 50\n- Best Practice: Explicitly declare `ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW` for deterministic running totals and better CPU performance.",
    code: `-- Demonstrating the difference between ROWS and RANGE on duplicate dates
SELECT 
    order_date, 
    amount,
    -- 1. RANGE (Default): If 3 orders happen on 2026-05-01, ALL 3 get the SAME sum!
    SUM(amount) OVER (
        ORDER BY order_date 
        RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS range_running_sum,
    -- 2. ROWS: Increments smoothly row-by-row, regardless of duplicate dates!
    SUM(amount) OVER (
        ORDER BY order_date 
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS rows_running_sum
FROM daily_orders;`,
    recallHint: "ROWS counts physical tuples; RANGE counts logical values (bundles duplicate ties together); prefer ROWS for deterministic sums.",
    interviewTip: "Always use `ROWS` instead of `RANGE` for running totals on unique or indexed columns to save the database from checking for duplicate ties.",
    tags: ["rows-vs-range", "window-frames", "tie-grouping", "running-totals", "sql-internals"]
  }),

  createCard({
    idNum: 68,
    category: "Window Functions & Analytics",
    concept: "Named Window Specifications: The WINDOW Clause",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the WINDOW clause in ANSI SQL, and how does it promote DRY (Don't Repeat Yourself) window definitions?",
    quickAnswer: "The `WINDOW` clause allows developers to define named window specifications at the end of a query (`WINDOW w AS (PARTITION BY dept ORDER BY salary DESC)`) and reuse them across multiple window functions in the `SELECT` list. This prevents copy-pasting complex, identical `OVER (...)` specifications 5 times in a single query, improving readability and maintenance.",
    detailedAnswer: "WINDOW Clause Rules:\n1. Placement: Placed between `HAVING` and `ORDER BY`.\n2. Reusability: Multiple functions (`ROW_NUMBER() OVER w`, `RANK() OVER w`, `AVG() OVER w`) share the exact same window.\n3. Window Inheritance: A named window can inherit from and modify another named window: `WINDOW w1 AS (PARTITION BY dept), w2 AS (w1 ORDER BY hire_date)`.\n4. Cross-Dialect Support: Supported in PostgreSQL, MySQL 8+, Oracle 21c+, and standard ANSI SQL:2003.",
    code: `-- Using named WINDOW specifications for clean, maintainable analytics
SELECT 
    employee_id,
    department_id,
    salary,
    ROW_NUMBER() OVER w_dept_salary AS dept_rank,
    DENSE_RANK() OVER w_dept_salary AS dept_dense_rank,
    ROUND(AVG(salary) OVER w_dept_salary, 2) AS dept_avg_salary,
    MAX(salary) OVER w_dept_salary - salary AS gap_from_dept_max
FROM employees
WINDOW w_dept_salary AS (
    PARTITION BY department_id 
    ORDER BY salary DESC
    ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
)
ORDER BY department_id, dept_rank;`,
    recallHint: "WINDOW clause defines named windows (WINDOW w AS (PARTITION BY ...)); reuses definitions across multiple OVER w calls.",
    interviewTip: "Highlight that named `WINDOW` clauses reduce query planner AST duplication and make complex financial queries significantly easier to read.",
    tags: ["window-clause", "dry-sql", "named-windows", "analytics-refactoring", "ansi-sql-2003"]
  }),

  createCard({
    idNum: 69,
    category: "Window Functions & Analytics",
    concept: "Statistical Distribution: PERCENT_RANK() and CUME_DIST()",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the difference between PERCENT_RANK() and CUME_DIST() in SQL statistical analysis?",
    quickAnswer: "`PERCENT_RANK()` calculates the relative ranking of a row on a scale from $0.0$ to $1.0$ using the formula $\\frac{\\text{Rank} - 1}{\\text{Total Rows} - 1}$ (the first row is always $0.0$). `CUME_DIST()` (Cumulative Distribution) computes the proportion of rows with values less than or equal to the current row's value: $\\frac{\\text{Rows} \\le \\text{Current}}{\\text{Total Rows}}$ (the last row is always $1.0$).",
    detailedAnswer: "Mathematical Formulas:\n1. `PERCENT_RANK()`: Measures position within the range. Top score is $0.0$ (or $1.0$ in ascending). If a student has `PERCENT_RANK() = 0.90`, they scored higher than 90% of peers.\n2. `CUME_DIST()`: Measures cumulative probability $P(X \\le x)$. A value of $0.75$ means 75% of rows have values $\\le$ the current row.\n3. Handling Ties: Ties receive identical values.",
    code: `-- Analyzing student test percentiles
SELECT 
    student_name,
    score,
    ROUND(PERCENT_RANK() OVER (ORDER BY score ASC)::NUMERIC, 2) AS pct_rank,
    ROUND(CUME_DIST() OVER (ORDER BY score ASC)::NUMERIC, 2) AS cume_dist
FROM exam_scores;

-- Sample output for 5 students [50, 60, 70, 80, 90]:
-- 50: pct_rank = 0.00, cume_dist = 0.20
-- 70: pct_rank = 0.50, cume_dist = 0.60
-- 90: pct_rank = 1.00, cume_dist = 1.00`,
    recallHint: "PERCENT_RANK = (Rank-1)/(N-1) (starts at 0.0); CUME_DIST = (Rows <= Current)/N (ends at 1.0).",
    interviewTip: "Be ready to explain which function to use for percentile metrics: `PERCENT_RANK()` for standard school exam percentiles, `CUME_DIST()` for cumulative distribution functions.",
    tags: ["percent_rank", "cume_dist", "statistics", "cumulative-distribution", "percentiles"]
  }),

  createCard({
    idNum: 70,
    category: "Window Functions & Analytics",
    concept: "Windowed Aggregates without GROUP BY (Multi-Level Calculations)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do windowed aggregates allow simultaneous display of row-level data and high-level summaries without subqueries?",
    quickAnswer: "In standard SQL, adding `OVER ()` to an aggregate function (`SUM(amount) OVER ()`, `AVG(amount) OVER (PARTITION BY region)`) allows you to project row-level attributes alongside partition totals and global grand totals in a single query pass with **zero `GROUP BY` clause** and **zero self-joins**.",
    detailedAnswer: "Multi-Level Analytical Capabilities:\n1. Global Grand Total: `SUM(revenue) OVER ()` displays the company-wide revenue on every single order row.\n2. Partition Subtotal: `SUM(revenue) OVER (PARTITION BY region)` displays the regional subtotal on the same row.\n3. Multi-Granularity Calculations: In a single row, you can display: `order_amount`, `region_total`, `global_total`, and `ROUND(100.0 * order_amount / SUM(order_amount) OVER (), 2)`.",
    code: `-- Single query displaying 3 distinct levels of aggregation simultaneously
SELECT 
    order_id,
    region,
    total_amount AS order_amount,
    -- Level 1: Regional Subtotal
    SUM(total_amount) OVER (PARTITION BY region) AS regional_total,
    -- Level 2: Company-Wide Grand Total
    SUM(total_amount) OVER () AS grand_total,
    -- Level 3: Percentage contribution to Regional Total
    ROUND(100.0 * total_amount / SUM(total_amount) OVER (PARTITION BY region), 2) AS pct_of_regional_sales,
    -- Level 4: Percentage contribution to Grand Total
    ROUND(100.0 * total_amount / SUM(total_amount) OVER (), 2) AS pct_of_company_sales
FROM customer_orders;`,
    recallHint: "SUM() OVER (PARTITION BY ...) calculates group totals; SUM() OVER () calculates grand totals; preserves row-level details.",
    interviewTip: "Highlight how windowed aggregates eliminate messy multi-subquery joins when building executive financial dashboards.",
    tags: ["window-aggregates", "multi-level-aggregations", "grand-totals", "financial-reporting", "no-group-by"]
  }),

  createCard({
    idNum: 71,
    category: "Window Functions & Analytics",
    concept: "The Top-N Per Category Pattern using ROW_NUMBER() in a CTE",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is the standard ANSI SQL pattern for fetching the Top-N records per category (e.g. Top 3 highest-paid employees per department)?",
    quickAnswer: "The standard ANSI SQL solution uses a Common Table Expression (CTE) or derived table that computes `ROW_NUMBER() OVER (PARTITION BY category ORDER BY metric DESC) AS rank_num`, followed by an outer query filtering `WHERE rank_num <= N`. This is mandatory because window functions cannot be placed directly inside a `WHERE` clause.",
    detailedAnswer: "Step-by-Step Implementation:\n1. Step 1 (Partition and Rank): Inside the CTE, partition by the parent entity (`department_id`) and sort descending by the target metric (`salary DESC`).\n2. Step 2 (Filter in Outer Query): In the outer query, filter `WHERE rank_num <= 3`.\n3. Tie-Breaking: Use `DENSE_RANK()` if ties should all be included (e.g. including both employees if tied for 3rd place).",
    code: `-- Fetch Top 3 most expensive products per category
WITH ranked_products AS (
    SELECT 
        category_id,
        product_id,
        product_name,
        unit_price,
        -- Rank within category partition
        ROW_NUMBER() OVER (
            PARTITION BY category_id 
            ORDER BY unit_price DESC, product_id ASC
        ) AS rank_in_cat
    FROM products
)
SELECT 
    category_id, 
    rank_in_cat, 
    product_id, 
    product_name, 
    unit_price
FROM ranked_products
WHERE rank_in_cat <= 3
ORDER BY category_id, rank_in_cat;`,
    breakdown: [
      "PARTITION BY category_id restarts numbering at 1 for each category.",
      "ORDER BY unit_price DESC places the most expensive items first.",
      "The outer WHERE rank_in_cat <= 3 slices the top 3 per group cleanly."
    ],
    recallHint: "Top-N per group = CTE with ROW_NUMBER() OVER (PARTITION BY cat ORDER BY metric DESC) + outer WHERE rank <= N.",
    interviewTip: "This is one of the most frequently asked SQL coding interview questions in the world. Memorize this CTE + ROW_NUMBER pattern.",
    tags: ["top-n-per-group", "row_number", "cte-pattern", "ranking", "interview-favorite"]
  }),

  createCard({
    idNum: 72,
    category: "Window Functions & Analytics",
    concept: "The Gaps and Islands Problem: Island Identification via Group Difference",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the classic 'Gaps and Islands' problem in SQL, and how does the difference between two sequences identify consecutive islands?",
    quickAnswer: "The **Gaps and Islands** problem involves identifying continuous sequences of consecutive data ('islands') separated by missing values or periods of inactivity ('gaps'). The classic mathematical solution computes the difference between the chronological sequence value and a contiguous `ROW_NUMBER()`. Because both sequences advance by 1 for consecutive rows, their difference remains **constant** for an island, forming a unique group identifier for grouping.",
    detailedAnswer: "Mathematical Proof of Island Grouping:\n- Given consecutive dates: `Day 1, Day 2, Day 3` (Gap on Day 4) `Day 5, Day 6`.\n- Compute `ROW_NUMBER()`: `1, 2, 3, 4, 5`.\n- Subtract `(Date - ROW_NUMBER)`:\n  - `Day 1 - 1 = Day 0`\n  - `Day 2 - 2 = Day 0`\n  - `Day 3 - 3 = Day 0` $\\to$ (Constant value 'Day 0' groups Island 1!)\n  - `Day 5 - 4 = Day 1`\n  - `Day 6 - 5 = Day 1` $\\to$ (Constant value 'Day 1' groups Island 2!)\n- Grouping by this constant difference reveals start date, end date, and duration for each consecutive streak.",
    code: `-- Find consecutive login streaks (Gaps and Islands)
WITH numbered_logins AS (
    SELECT DISTINCT 
        user_id, 
        login_date,
        -- Subtract row number days from login date to create a constant island group!
        login_date - CAST(ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date) AS INT) AS island_group
    FROM user_activity_log
)
SELECT 
    user_id,
    MIN(login_date) AS streak_start_date,
    MAX(login_date) AS streak_end_date,
    COUNT(*) AS consecutive_login_days
FROM numbered_logins
GROUP BY user_id, island_group
HAVING COUNT(*) >= 3 -- Streaks of 3+ consecutive days
ORDER BY user_id, streak_start_date;`,
    recallHint: "Gaps and Islands: (Value - ROW_NUMBER) produces a constant key for consecutive streaks; group by that key to find islands.",
    interviewTip: "Explaining the `(Date - ROW_NUMBER)` constant difference pattern demonstrates true relational algorithmic problem-solving mastery.",
    tags: ["gaps-and-islands", "consecutive-streaks", "row_number-difference", "advanced-sql", "algorithmic-sql"]
  })
];

module.exports = cards;
