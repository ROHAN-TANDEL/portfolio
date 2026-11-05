module.exports = [
  {
    id: "sql-ex-23",
    title: "Top-N Rows Per Category Using ROW_NUMBER() in a Derived Table",
    category: "Window Functions & Analytical SQL",
    difficulty: "intermediate",
    whatThisCodeCovers: "Retrieves the top 2 highest-earning employees in each department deterministically using ROW_NUMBER() within a Common Table Expression.",
    conceptsCovered: [
      "ROW_NUMBER()",
      "PARTITION BY Clause",
      "Top-N per Category Pattern",
      "Tie-Breaking Determinism"
    ],
    code: `-- Find top 2 highest-earning employees per department
WITH ranked_employees AS (
    SELECT 
        department_id,
        employee_id,
        full_name,
        salary,
        ROW_NUMBER() OVER (
            PARTITION BY department_id 
            ORDER BY salary DESC, employee_id ASC
        ) AS rank_in_dept
    FROM employees
)
SELECT 
    department_id,
    employee_id,
    full_name,
    salary
FROM ranked_employees
WHERE rank_in_dept <= 2
ORDER BY department_id, rank_in_dept;`,
    breakdown: [
      "ROW_NUMBER() produces a sequential integer starting at 1 for each row within its partition.",
      "PARTITION BY department_id resets the ranking sequence independently for every department.",
      "Including employee_id ASC in the ORDER BY ensures 100% deterministic ranking when two salaries are identical.",
      "Filtering WHERE rank_in_dept <= 2 in the outer query yields the exact Top-2 per group."
    ],
    expectedOutput: `department_id | employee_id | full_name       | salary
1             | 104         | Diana Prince    | 165000.00
1             | 102         | Bruce Wayne     | 145000.00
2             | 205         | Clark Kent      | 110000.00
2             | 201         | Lois Lane       | 105000.00`
  },
  {
    id: "sql-ex-24",
    title: "Handling Salary Ties with RANK() vs DENSE_RANK()",
    category: "Window Functions & Analytical SQL",
    difficulty: "intermediate",
    whatThisCodeCovers: "Contrasts the behavioral differences of RANK() (which skips positions after ties) and DENSE_RANK() (which maintains continuous numbering) across tied score sets.",
    conceptsCovered: [
      "RANK() vs DENSE_RANK()",
      "Tie Gap Handling",
      "Deterministic Leaderboards",
      "Competitive Scoring"
    ],
    code: `-- Comparison of ranking algorithms on identical score values
SELECT 
    player_id,
    score,
    ROW_NUMBER() OVER (ORDER BY score DESC) AS row_num,
    RANK() OVER (ORDER BY score DESC) AS rank_with_gaps,
    DENSE_RANK() OVER (ORDER BY score DESC) AS dense_rank_continuous
FROM tournament_scores
ORDER BY score DESC;`,
    breakdown: [
      "ROW_NUMBER() assigns distinct sequential integers (1, 2, 3, 4) arbitrarily breaking ties.",
      "RANK() assigns identical ranks to ties but skips subsequent numbers (e.g. 100, 100, 90 produces 1, 1, 3).",
      "DENSE_RANK() assigns identical ranks to ties without skipping subsequent numbers (1, 1, 2).",
      "Use DENSE_RANK() when you need medal tiers (Gold, Silver, Bronze) regardless of how many people tied for Gold."
    ],
    expectedOutput: `player_id | score | row_num | rank_with_gaps | dense_rank_continuous
P-88      | 100   | 1       | 1              | 1
P-12      | 100   | 2       | 1              | 1
P-45      | 95    | 3       | 3              | 2
P-99      | 80    | 4       | 4              | 3`
  },
  {
    id: "sql-ex-25",
    title: "Month-Over-Month Growth & Velocity Calculation with LAG()",
    category: "Window Functions & Analytical SQL",
    difficulty: "intermediate",
    whatThisCodeCovers: "Calculates monthly recurring revenue (MRR) changes and percentage growth rates relative to the immediately preceding month using the LAG() window function.",
    conceptsCovered: [
      "LAG() Function",
      "Temporal Delta Calculation",
      "Month-Over-Month (MoM) Growth",
      "NULLIF / Division Protection"
    ],
    code: `-- Month-over-month MRR growth and percentage velocity
WITH monthly_mrr AS (
    SELECT 
        billing_month,
        SUM(mrr_amount) AS total_mrr
    FROM subscription_ledger
    GROUP BY billing_month
)
SELECT 
    billing_month,
    total_mrr,
    LAG(total_mrr, 1) OVER (ORDER BY billing_month) AS prev_month_mrr,
    total_mrr - LAG(total_mrr, 1) OVER (ORDER BY billing_month) AS mrr_change,
    ROUND(
        100.0 * (total_mrr - LAG(total_mrr, 1) OVER (ORDER BY billing_month)) / 
        NULLIF(LAG(total_mrr, 1) OVER (ORDER BY billing_month), 0),
        2
    ) AS mom_growth_pct
FROM monthly_mrr
ORDER BY billing_month;`,
    breakdown: [
      "LAG(total_mrr, 1) inspects the row located 1 step backward in the specified chronological order.",
      "For the very first chronological record, LAG() returns NULL.",
      "Computing (current - previous) / previous yields the exact month-over-month growth rate.",
      "Avoids costly and fragile self-joins on date offsets (e.g. month = prev_month + 1)."
    ],
    expectedOutput: `billing_month | total_mrr | prev_month_mrr | mrr_change | mom_growth_pct
2026-01-01    | 50000.00  | NULL           | NULL       | NULL
2026-02-01    | 57500.00  | 50000.00       | 7500.00    | 15.00
2026-03-01    | 62000.00  | 57500.00       | 4500.00    | 7.83`
  },
  {
    id: "sql-ex-26",
    title: "Future Value Forecasting & Look-Ahead with LEAD()",
    category: "Window Functions & Analytical SQL",
    difficulty: "intermediate",
    whatThisCodeCovers: "Computes user session durations by reading the timestamp of the next consecutive user event with LEAD() without self-joining the event log.",
    conceptsCovered: [
      "LEAD() Function",
      "Event Stream Analytics",
      "Look-Ahead Durations",
      "Temporal Partitioning"
    ],
    code: `-- Calculate duration spent on each screen by looking ahead to the next event timestamp
SELECT 
    user_id,
    event_time,
    event_name,
    LEAD(event_time, 1) OVER (
        PARTITION BY user_id 
        ORDER BY event_time ASC
    ) AS next_event_time,
    ROUND(
        EXTRACT(EPOCH FROM (
            LEAD(event_time, 1) OVER (
                PARTITION BY user_id 
                ORDER BY event_time ASC
            ) - event_time
        )), 
        0
    ) AS seconds_spent
FROM app_event_logs
ORDER BY user_id, event_time;`,
    breakdown: [
      "LEAD(event_time, 1) retrieves the timestamp of the subsequent event in the chronological order.",
      "PARTITION BY user_id ensures that the look-ahead does not bleed across boundaries between different users.",
      "Subtracting event_time from next_event_time yields exact session duration per interaction step.",
      "The last event in the user's session evaluates to NULL, signaling session termination."
    ],
    expectedOutput: `user_id | event_time          | event_name  | next_event_time     | seconds_spent
U-1001  | 2026-03-01 10:00:00 | LOGIN       | 2026-03-01 10:01:25 | 85
U-1001  | 2026-03-01 10:01:25 | VIEW_DASH   | 2026-03-01 10:05:00 | 215
U-1001  | 2026-03-01 10:05:00 | LOGOUT      | NULL                | NULL`
  },
  {
    id: "sql-ex-27",
    title: "Running Cumulative Financial Total with Framing (ROWS BETWEEN UNBOUNDED PRECEDING)",
    category: "Window Functions & Analytical SQL",
    difficulty: "intermediate",
    whatThisCodeCovers: "Calculates an accurate cumulative ledger running balance using explicit window framing with ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW.",
    conceptsCovered: [
      "Running Totals",
      "ROWS vs RANGE Framing",
      "UNBOUNDED PRECEDING Frame",
      "Performance Overhead of Default Framing"
    ],
    code: `-- Calculate running account balance across sequential deposits and withdrawals
SELECT 
    transaction_id,
    account_id,
    transacted_at,
    amount,
    SUM(amount) OVER (
        PARTITION BY account_id
        ORDER BY transacted_at ASC, transaction_id ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS running_balance
FROM bank_transactions
ORDER BY account_id, transacted_at;`,
    breakdown: [
      "Specifying ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW accumulates every row from the partition start up to the current row.",
      "Crucial performance rule: The default SQL frame is 'RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW', which performs peers-checking and can trigger spooling overhead.",
      "ROWS framing treats every physical row discretely, running in strict O(N) linear time.",
      "Always include unique tie-breakers (like transaction_id) in ORDER BY to ensure deterministic balances."
    ],
    expectedOutput: `transaction_id | account_id | transacted_at       | amount   | running_balance
TXN-101        | ACC-99     | 2026-01-01 09:00:00 | 1000.00  | 1000.00
TXN-102        | ACC-99     | 2026-01-02 14:30:00 | -250.00  | 750.00
TXN-103        | ACC-99     | 2026-01-05 11:15:00 | 500.00   | 1250.00`
  },
  {
    id: "sql-ex-28",
    title: "Moving 7-Day Rolling Average with Symmetric Window Framing",
    category: "Window Functions & Analytical SQL",
    difficulty: "intermediate",
    whatThisCodeCovers: "Smooths out volatile daily server latency metrics by calculating a moving 7-row centered or trailing average using window frames.",
    conceptsCovered: [
      "Moving Average",
      "Trailing Window Frame (ROWS 6 PRECEDING)",
      "Time-Series Smoothing",
      "Bounded Window Aggregation"
    ],
    code: `-- 7-day trailing moving average of daily API error counts
SELECT 
    metric_date,
    error_count,
    ROUND(
        AVG(error_count) OVER (
            ORDER BY metric_date ASC
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ),
        2
    ) AS trailing_7day_avg_errors,
    MIN(error_count) OVER (
        ORDER BY metric_date ASC
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS rolling_min,
    MAX(error_count) OVER (
        ORDER BY metric_date ASC
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ) AS rolling_max
FROM daily_system_metrics
ORDER BY metric_date;`,
    breakdown: [
      "ROWS BETWEEN 6 PRECEDING AND CURRENT ROW looks at exactly the current day plus the preceding 6 rows (7 items total).",
      "For the first 6 days in the dataset, SQL gracefully calculates the average over whatever subset of preceding rows exists (e.g. 1 to 6 rows).",
      "Simultaneously tracks rolling min and max within the same window frame without extra table scans.",
      "Standard pattern for algorithm baseline computation and anomaly detection."
    ],
    expectedOutput: `metric_date | error_count | trailing_7day_avg_errors | rolling_min | rolling_max
2026-03-01  | 14          | 14.00                    | 14          | 14
2026-03-02  | 20          | 17.00                    | 14          | 20
2026-03-07  | 12          | 16.43                    | 10          | 22`
  },
  {
    id: "sql-ex-29",
    title: "Customer Quartile & Percentile Segmentation with NTILE()",
    category: "Window Functions & Analytical SQL",
    difficulty: "intermediate",
    whatThisCodeCovers: "Divides customers into 4 equal quartiles (Buckets 1 to 4) based on lifetime spending value using NTILE(4).",
    conceptsCovered: [
      "NTILE(N) Function",
      "Quartile / Decile Binning",
      "Customer Segmentation",
      "Equi-Sized Cohorts"
    ],
    code: `-- Segment customers into 4 spending quartiles (Top 25% = Quartile 1)
WITH customer_spend AS (
    SELECT 
        customer_id,
        SUM(total_amount) AS lifetime_value
    FROM orders
    GROUP BY customer_id
)
SELECT 
    customer_id,
    lifetime_value,
    NTILE(4) OVER (ORDER BY lifetime_value DESC) AS spending_quartile,
    CASE NTILE(4) OVER (ORDER BY lifetime_value DESC)
        WHEN 1 THEN 'PLATINUM (TOP 25%)'
        WHEN 2 THEN 'GOLD (25%-50%)'
        WHEN 3 THEN 'SILVER (50%-75%)'
        WHEN 4 THEN 'BRONZE (BOTTOM 25%)'
    END AS tier_label
FROM customer_spend
ORDER BY spending_quartile, lifetime_value DESC;`,
    breakdown: [
      "NTILE(4) distributes ordered rows as equally as possible across 4 integer buckets from 1 to 4.",
      "If the row count is not evenly divisible, earlier buckets receive one extra row.",
      "Allows marketing and operations to target cohorts by relative performance without hardcoding arbitrary dollar thresholds.",
      "CASE expressions map bucket numbers to customer-facing tier labels."
    ],
    expectedOutput: `customer_id | lifetime_value | spending_quartile | tier_label
108         | 95000.00       | 1                 | PLATINUM (TOP 25%)
402         | 42000.00       | 2                 | GOLD (25%-50%)
781         | 15000.00       | 3                 | SILVER (50%-75%)
912         | 1200.00        | 4                 | BRONZE (BOTTOM 25%)`
  },
  {
    id: "sql-ex-30",
    title: "Boundary Value Retrieval: FIRST_VALUE() vs LAST_VALUE() with Proper Framing",
    category: "Window Functions & Analytical SQL",
    difficulty: "advanced",
    whatThisCodeCovers: "Highlights the common LAST_VALUE() framing trap and illustrates how to retrieve both initial and most recent sensor readings within a partition.",
    conceptsCovered: [
      "FIRST_VALUE() Function",
      "LAST_VALUE() Framing Pitfall",
      "UNBOUNDED FOLLOWING Framing",
      "Boundary State Comparison"
    ],
    code: `-- Compare each IoT sensor reading against the baseline reading and latest reading
SELECT 
    device_id,
    reading_time,
    temperature_celsius,
    -- First reading in session:
    FIRST_VALUE(temperature_celsius) OVER (
        PARTITION BY device_id 
        ORDER BY reading_time ASC
    ) AS initial_baseline_temp,
    -- Latest reading in session (MUST include UNBOUNDED FOLLOWING):
    LAST_VALUE(temperature_celsius) OVER (
        PARTITION BY device_id 
        ORDER BY reading_time ASC
        ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING
    ) AS latest_recorded_temp
FROM device_telemetry
ORDER BY device_id, reading_time;`,
    breakdown: [
      "FIRST_VALUE() retrieves the value from the first row in the window frame.",
      "CRITICAL TRAP: By default, the window frame ends at CURRENT ROW. Therefore, LAST_VALUE() simply returns the current row's value unless the frame is expanded!",
      "Specifying 'ROWS BETWEEN CURRENT ROW AND UNBOUNDED FOLLOWING' allows LAST_VALUE() to see the true final record of the partition.",
      "Calculates drift from initial baseline and drift towards the final reading in a single scan."
    ],
    expectedOutput: `device_id | reading_time        | temperature_celsius | initial_baseline_temp | latest_recorded_temp
IOT-01    | 2026-03-01 08:00:00 | 21.5                | 21.5                  | 26.8
IOT-01    | 2026-03-01 12:00:00 | 24.2                | 21.5                  | 26.8
IOT-01    | 2026-03-01 18:00:00 | 26.8                | 21.5                  | 26.8`
  },
  {
    id: "sql-ex-31",
    title: "Percentage Contribution of Row to Partition Total (SUM() OVER ())",
    category: "Window Functions & Analytical SQL",
    difficulty: "intermediate",
    whatThisCodeCovers: "Calculates the exact percentage of sales revenue a single product line contributes to its parent department without performing a self-join or extra subquery.",
    conceptsCovered: [
      "Partition-Level Aggregates",
      "Percentage Contribution Calculation",
      "OVER (PARTITION BY ...)",
      "Zero-Subquery Denormalization"
    ],
    code: `-- Product revenue percentage relative to total departmental sales
SELECT 
    department_id,
    product_id,
    product_name,
    revenue,
    SUM(revenue) OVER (PARTITION BY department_id) AS department_total_revenue,
    ROUND(
        100.0 * revenue / SUM(revenue) OVER (PARTITION BY department_id),
        2
    ) AS pct_of_department_revenue,
    SUM(revenue) OVER () AS company_wide_revenue,
    ROUND(100.0 * revenue / SUM(revenue) OVER (), 2) AS pct_of_company_revenue
FROM product_sales
ORDER BY department_id, revenue DESC;`,
    breakdown: [
      "SUM(revenue) OVER (PARTITION BY department_id) computes the department sum across all rows in that partition without collapsing them into a single row.",
      "SUM(revenue) OVER () with an empty specification computes the global total across the entire table.",
      "Dividing the individual row's revenue by the partition sum yields exact relative contribution percentages.",
      "Runs in a single query pass with zero temporary tables or JOIN operations."
    ],
    expectedOutput: `department_id | product_id | product_name   | revenue   | department_total_revenue | pct_of_department_revenue | pct_of_company_revenue
1             | P-10       | Enterprise Hub | 150000.00 | 200000.00                | 75.00                     | 30.00
1             | P-12       | Support Addon  | 50000.00  | 200000.00                | 25.00                     | 10.00`
  },
  {
    id: "sql-ex-32",
    title: "Named Reusable Window Specifications (WINDOW w AS (...))",
    category: "Window Functions & Analytical SQL",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses the ANSI WINDOW clause to define a named, reusable window specification referenced by multiple window functions in the same SELECT statement.",
    conceptsCovered: [
      "WINDOW Clause",
      "DRY Window Specifications",
      "Maintainable Analytical SQL",
      "Multiple Window Functions"
    ],
    code: `-- Clean analytical reporting using named reusable WINDOW clauses
SELECT 
    department_id,
    employee_id,
    salary,
    ROW_NUMBER() OVER dept_window AS dept_seq,
    DENSE_RANK() OVER dept_window AS dept_rank,
    AVG(salary) OVER dept_window AS dept_avg_salary,
    MIN(salary) OVER dept_window AS dept_min_salary,
    MAX(salary) OVER dept_window AS dept_max_salary
FROM employees
WINDOW dept_window AS (
    PARTITION BY department_id 
    ORDER BY salary DESC
)
ORDER BY department_id, salary DESC;`,
    breakdown: [
      "The WINDOW clause sits between HAVING and ORDER BY in logical SQL syntax.",
      "Defines a single named specification (dept_window) reused across 5 analytical functions.",
      "Prevents copy-paste errors when modifying partition keys or sorting criteria across complex reports.",
      "Standard ANSI SQL feature fully supported across modern relational database engines."
    ],
    expectedOutput: `department_id | employee_id | salary    | dept_seq | dept_rank | dept_avg_salary | dept_min_salary | dept_max_salary
1             | 101         | 120000.00 | 1        | 1         | 105000.00       | 90000.00        | 120000.00
1             | 102         | 105000.00 | 2        | 2         | 105000.00       | 90000.00        | 120000.00
1             | 103         | 90000.00  | 3        | 3         | 105000.00       | 90000.00        | 120000.00`
  }
];
