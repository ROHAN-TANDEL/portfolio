const { createCard } = require("../sql_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 49,
    category: "Subqueries & Exists Mechanics",
    concept: "Scalar Subqueries: Single-Value Assertion & Subquery Errors",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a Scalar Subquery, where can it appear in SQL, and what happens if it returns more than one row?",
    quickAnswer: "A **Scalar Subquery** is a subquery that evaluates to exactly **one row and one column** (a single atomic value). It can appear almost anywhere a scalar literal or column expression is valid: in `SELECT` lists, `WHERE` clauses, `HAVING` filters, and `SET` assignments. If a scalar subquery returns 0 rows, it evaluates to `NULL`. However, if it returns **more than one row**, the database engine immediately aborts query execution with a fatal runtime error: `subquery must return only one row`.",
    detailedAnswer: "Scalar Subquery Mechanics:\n1. Runtime Guard: The engine cannot guess which value to use if multiple tuples are emitted. Therefore, scalar subqueries in `WHERE col = (SELECT ...)` MUST be guarded with `LIMIT 1` or an aggregate function (`MAX`, `MIN`).\n2. Placement:\n   - In `SELECT`: `SELECT id, (SELECT AVG(salary) FROM employees) AS avg_sal FROM employees;`\n   - In `WHERE`: `WHERE salary > (SELECT AVG(salary) FROM employees);`\n3. Null Result: If `(SELECT bonus FROM bonuses WHERE emp_id = 999)` matches 0 rows, the result is `NULL` (no runtime error).",
    code: `-- 1. Scalar subquery in WHERE clause comparing against department average
SELECT employee_id, full_name, salary
FROM employees
WHERE salary > (
    SELECT AVG(salary) 
    FROM employees 
    WHERE department_id = 10
);

-- 2. Fatal runtime error if subquery returns > 1 row:
-- SELECT employee_id FROM employees WHERE salary = (SELECT salary FROM employees);
-- ERROR: subquery returns more than 1 row!

-- 3. Guarding scalar subqueries using aggregates:
SELECT order_id, total_amount
FROM orders
WHERE total_amount = (SELECT MAX(total_amount) FROM orders);`,
    recallHint: "Scalar subquery returns exactly 1 row, 1 column; returns NULL if 0 rows; crashes with runtime error if > 1 row.",
    interviewTip: "Always emphasize that if a scalar subquery can possibly return multiple rows in production, you must use `MAX()`, `MIN()`, or `LIMIT 1` to guarantee scalar cardinality.",
    tags: ["scalar-subquery", "subquery-errors", "cardinality", "query-syntax", "runtime-exceptions"]
  }),

  createCard({
    idNum: 50,
    category: "Subqueries & Exists Mechanics",
    concept: "Multi-Row Subqueries: IN vs The Fatal NOT IN NULL Trap",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is the fatal NULL trap with NOT IN subqueries, and why does a single NULL cause NOT IN to return zero rows?",
    quickAnswer: "When using `IN (val1, val2, ...)`, SQL checks if any comparison evaluates to `TRUE`. But when using `NOT IN (val1, val2, ...)`, SQL expands logically to `(col != val1 AND col != val2 AND ...)`. If the subquery result contains even a **single NULL**, `col != NULL` evaluates to `UNKNOWN`. Because `TRUE AND UNKNOWN` is `UNKNOWN`, the entire condition evaluates to `UNKNOWN`, causing the `WHERE` clause to discard **100% of all rows** in the table! Always use `NOT EXISTS` instead of `NOT IN`.",
    detailedAnswer: "The Mathematical Trap Breakdown:\n- Expression: `x NOT IN (10, 20, NULL)`.\n- Logical Expansion: `x != 10 AND x != 20 AND x != NULL`.\n- For any $x$ (e.g. $x = 5$):\n  - `5 != 10` is `TRUE`.\n  - `5 != 20` is `TRUE`.\n  - `5 != NULL` is `UNKNOWN`.\n  - `TRUE AND TRUE AND UNKNOWN` evaluates to `UNKNOWN`!\n- Result: Zero rows ever pass the filter! The entire query silently returns an empty set, hiding active production records.\n- Solution: Use `NOT EXISTS` or filter with `WHERE col IS NOT NULL` inside the subquery.",
    code: `-- THE BUG: Suppose bad_subquery contains: [101, 102, NULL]
-- This query returns ZERO rows, even for employees who definitely are not in the list!
SELECT * FROM employees 
WHERE department_id NOT IN (
    SELECT department_id FROM departments WHERE budget < 50000 -- contains a NULL!
);

-- THE FIX 1: Explicit NOT NULL filter
SELECT * FROM employees 
WHERE department_id NOT IN (
    SELECT department_id FROM departments WHERE budget < 50000 AND department_id IS NOT NULL
);

-- THE FIX 2: NOT EXISTS (Immune to NULL trap! Highly Recommended)
SELECT e.* 
FROM employees e
WHERE NOT EXISTS (
    SELECT 1 
    FROM departments d 
    WHERE d.department_id = e.department_id 
      AND d.budget < 50000
);`,
    recallHint: "NOT IN expands to AND !=; a single NULL turns the whole condition to UNKNOWN (returns 0 rows); use NOT EXISTS to be safe.",
    interviewTip: "This is a quintessential SQL senior interview question: 'Why did my NOT IN query return 0 rows?' Answer: Three-Valued Logic and NULL propagation.",
    tags: ["not-in-trap", "three-valued-logic", "null-trap", "not-exists", "silent-bugs"]
  }),

  createCard({
    idNum: 51,
    category: "Subqueries & Exists Mechanics",
    concept: "Correlated Subqueries: Row-by-Row Scoping & Execution Lifecycle",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a Correlated Subquery, how does its execution scope differ from an independent subquery, and what is its performance cost?",
    quickAnswer: "An independent subquery evaluates once and passes its static result to the outer query. A **Correlated Subquery** references columns from the outer query table, creating an execution dependency where the subquery conceptually must be re-evaluated **once for every single candidate row** processed by the outer query ($O(N)$ execution cost). Without optimizer decorrelation or indexes, correlated subqueries cause severe latency on large tables.",
    detailedAnswer: "Correlated Subquery Scope:\n1. Dependency: The subquery references `outer_table.col`.\n2. Execution Model: For each tuple in outer table, substitute outer column value $\\to$ run inner query $\\to$ test predicate.\n3. Common Use Case: Comparing a row against its peer group (e.g. 'Employees who earn more than the average salary of THEIR specific department').\n4. Optimizer Decorrelation: Modern optimizers attempt to rewrite correlated subqueries into `LEFT JOIN` or `SEMI JOIN` internally; if it fails to decorrelate, performance drops exponentially.",
    code: `-- Find employees earning more than the average salary of THEIR OWN department
SELECT 
    e.employee_id, 
    e.department_id, 
    e.full_name, 
    e.salary
FROM employees e
WHERE e.salary > (
    -- Correlated: References e.department_id from the outer query row!
    SELECT AVG(d.salary) 
    FROM employees d 
    WHERE d.department_id = e.department_id
);`,
    recallHint: "Correlated subquery references outer query columns; re-evaluates per row (O(N) cost); optimize with joins or window functions.",
    interviewTip: "Explain how to rewrite correlated subqueries using window functions: e.g. `AVG(salary) OVER (PARTITION BY department_id)` calculates the benchmark in a single pass.",
    tags: ["correlated-subquery", "subquery-lifecycle", "decorrelation", "peer-group-comparison", "performance-cost"]
  }),

  createCard({
    idNum: 52,
    category: "Subqueries & Exists Mechanics",
    concept: "EXISTS vs NOT EXISTS: Short-Circuit Execution Optimization",
    priority: "must-know",
    difficulty: "must-know",
    question: "How does the EXISTS predicate work under the hood, and why is SELECT 1 idiomatic inside EXISTS?",
    quickAnswer: "`EXISTS (subquery)` tests whether the subquery produces at least one row, returning `TRUE` or `FALSE`. It features **short-circuit optimization**: as soon as the database executor encounters the first matching row, it halts scanning immediately and returns `TRUE` without reading the rest of the table. Writing `SELECT 1` (or `SELECT *`) inside `EXISTS` is idiomatic because the query engine completely ignores the projection list, evaluating strictly row existence.",
    detailedAnswer: "EXISTS Mechanics:\n1. Two-Valued Logic: Unlike `IN`, `EXISTS` NEVER returns `UNKNOWN`; it strictly returns `TRUE` (if $\\ge 1$ row matches) or `FALSE` (if 0 rows match), making it 100% immune to NULL traps.\n2. Projection List Ignored: `EXISTS (SELECT * ...)` and `EXISTS (SELECT 1 ...)` compile to identical execution plans. The database does not fetch or transfer column data from disk.\n3. Index Acceleration: If the inner subquery can seek an index on the join key, `EXISTS` verifies row presence in microseconds.",
    code: `-- Find all customers who have placed at least one high-value order
SELECT 
    c.customer_id, 
    c.company_name
FROM customers c
WHERE EXISTS (
    SELECT 1 -- Idiomatic: Database ignores projection list!
    FROM orders o
    WHERE o.customer_id = c.customer_id
      AND o.total_amount > 10000.00
);`,
    recallHint: "EXISTS short-circuits on the first matching row; returns strictly TRUE/FALSE (immune to NULLs); SELECT 1 is standard convention.",
    interviewTip: "Clarify that `SELECT 1` vs `SELECT *` inside `EXISTS` has zero performance difference: the SQL standard mandates that the projection list is not evaluated.",
    tags: ["exists", "not-exists", "short-circuit", "select-one", "query-optimization"]
  }),

  createCard({
    idNum: 53,
    category: "Subqueries & Exists Mechanics",
    concept: "Query Optimizer Decorrelation & Subquery Unnesting",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is subquery decorrelation (unnesting) and how does a cost-based optimizer transform subqueries into joins?",
    quickAnswer: "Subquery Decorrelation (or Unnesting) is an internal query optimization where the database rewriter converts a correlated subquery into an equivalent `INNER JOIN`, `LEFT JOIN`, or `SEMI-JOIN`. Instead of evaluating the inner query $N$ times in a loop, the optimizer flattens the query into a single set-based join tree that can utilize Hash Joins, Merge Joins, and parallel execution.",
    detailedAnswer: "How the Optimizer Unnests Subqueries:\n1. Correlated `EXISTS`: Converted into an internal `Semi-Join`.\n2. Correlated `NOT EXISTS`: Converted into an internal `Anti-Join`.\n3. Aggregate Subquery: Aggregates the inner table once using an internal hash table (`GROUP BY key`) and joins the aggregated result against the outer table.\n4. When Decorrelation Fails: Complex subqueries containing `LIMIT`, `UNION`, or non-deterministic functions cannot always be decorrelated by the planner, falling back to slow $O(N)$ nested loops.",
    code: `-- A correlated query written by a developer:
SELECT c.name
FROM customers c
WHERE EXISTS (
    SELECT 1 FROM orders o WHERE o.customer_id = c.id
);

-- What the query optimizer internally rewrites it to (Semi-Join):
-- Hash Semi Join (c.id = o.customer_id)
--   -> Seq Scan on customers c
--   -> Hash
--        -> HashAggregate (GROUP BY o.customer_id)
--             -> Seq Scan on orders o`,
    recallHint: "Optimizer decorrelates subqueries into Hash/Merge Semi-Joins to avoid O(N) loops; complex subqueries may fail to unnest.",
    interviewTip: "In EXPLAIN plans, look for `Hash Semi Join` or `Merge Anti Join`: this proves the optimizer successfully decorrelated your subquery.",
    tags: ["decorrelation", "subquery-unnesting", "query-optimizer", "semi-join", "execution-plans"]
  }),

  createCard({
    idNum: 54,
    category: "Subqueries & Exists Mechanics",
    concept: "Derived Tables / Subqueries in the FROM Clause & Mandatory Aliasing",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a Derived Table (Inline View), and why does ANSI SQL strictly mandate table aliases for subqueries in the FROM clause?",
    quickAnswer: "A **Derived Table** (also called an Inline View) is a subquery placed directly in the `FROM` clause of a query, creating a temporary virtual relation for the duration of the statement. Standard ANSI SQL strictly requires every derived table to have an explicit table alias (`AS alias_name`) so that outer clauses (`SELECT`, `WHERE`, `JOIN`) can unambiguously qualify and reference its projected column names.",
    detailedAnswer: "Derived Table Characteristics:\n1. Execution Scope: Exists solely for the duration of the query; never written to disk or catalog schemas.\n2. Mandatory Alias Rule: Writing `FROM (SELECT ...) WHERE ...` without an alias fails with `subquery in FROM must have an alias` in PostgreSQL, MySQL, and SQL Server (only Oracle permits omitting it).\n3. Pre-Aggregation Pattern: Used to calculate aggregate summaries before joining to other tables, avoiding row multiplication bugs.",
    code: `-- Derived table pre-aggregating order totals before joining to customers
SELECT 
    c.customer_id,
    c.company_name,
    order_summary.order_count,
    order_summary.total_spend
FROM customers c
INNER JOIN (
    -- Derived Table (MUST have an alias: 'order_summary')
    SELECT 
        customer_id,
        COUNT(*) AS order_count,
        SUM(total_amount) AS total_spend
    FROM orders
    GROUP BY customer_id
) AS order_summary ON c.customer_id = order_summary.customer_id
WHERE order_summary.total_spend > 50000.00;`,
    recallHint: "Derived tables are subqueries in FROM; act as inline views; ANSI SQL strictly requires an explicit table alias (AS name).",
    interviewTip: "Always alias derived tables: forgetting `AS alias_name` after a subquery in the `FROM` clause is a common syntax error.",
    tags: ["derived-tables", "inline-views", "mandatory-alias", "pre-aggregation", "from-clause"]
  }),

  createCard({
    idNum: 55,
    category: "Subqueries & Exists Mechanics",
    concept: "Quantified Comparison Predicates: ANY and SOME",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do the ANY and SOME quantified comparison predicates operate, and how do they differ from IN?",
    quickAnswer: "In ANSI SQL, `ANY` and `SOME` are completely synonymous keywords that compare a scalar value against a set of values returned by a subquery. When paired with the equality operator (`= ANY`), it is **100% equivalent to IN**. However, `ANY` is vastly more flexible because it can be combined with inequality operators: `> ANY` (greater than the minimum value) or `< ANY` (less than the maximum value).",
    detailedAnswer: "Mathematical Operations with ANY:\n- `x = ANY (subquery)`: TRUE if $x$ equals ANY element in the set (equivalent to `x IN (subquery)`).\n- `x > ANY (10, 20, 30)`: TRUE if $x > 10$ ($x$ is greater than the smallest element).\n- `x < ANY (10, 20, 30)`: TRUE if $x < 30$ ($x$ is less than the largest element).\n- Empty Set Behavior: If the subquery returns 0 rows, `x = ANY (empty)` evaluates to `FALSE`.",
    code: `-- 1. Find employees who earn more than ANY junior developer
-- (Meaning: earns more than the LOWEST junior developer salary)
SELECT employee_id, full_name, salary
FROM employees
WHERE salary > ANY (
    SELECT salary 
    FROM employees 
    WHERE job_title = 'Junior Developer'
);

-- 2. = ANY is identical to IN:
SELECT * FROM products WHERE category_id = ANY (SELECT id FROM active_categories);
-- Exactly equivalent to:
SELECT * FROM products WHERE category_id IN (SELECT id FROM active_categories);`,
    recallHint: "= ANY is identical to IN; > ANY means greater than minimum; < ANY means less than maximum; SOME is an alias for ANY.",
    interviewTip: "Explain that `> ANY` translates logically to 'greater than the minimum value in the set', which simplifies comparative SQL.",
    tags: ["any-predicate", "some-predicate", "quantified-comparisons", "in-equivalent", "relational-logic"]
  }),

  createCard({
    idNum: 56,
    category: "Subqueries & Exists Mechanics",
    concept: "Quantified Comparison Predicates: ALL & The Empty Set Paradox",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the ALL comparison predicate operate in SQL, and why does col > ALL (empty set) evaluate to TRUE?",
    quickAnswer: "The `ALL` predicate compares a scalar value against every value returned by a subquery: `> ALL` means greater than the maximum value in the set, and `< ALL` means less than the minimum value. Crucially, in formal mathematical logic, if the subquery returns an **empty set (0 rows)**, `x > ALL (empty)` evaluates to **TRUE** (Vacuous Truth), because there exists no element in the set that contradicts the assertion!",
    detailedAnswer: "ALL Rules & The Vacuous Truth Paradox:\n1. Comparative Meaning:\n   - `x > ALL (10, 20, 30)` $\\iff x > 30$ (must exceed the maximum).\n   - `x < ALL (10, 20, 30)` $\\iff x < 10$ (must be lower than the minimum).\n   - `x != ALL (subquery)` is equivalent to `x NOT IN (subquery)` (and carries the exact same NULL trap!).\n2. The Empty Set Trap: If a subquery returns 0 rows, `WHERE score > ALL (SELECT score FROM table WHERE 1=0)` evaluates to `TRUE` for every single row in the outer table! This frequently surprises developers expecting false.",
    code: `-- Find employees whose salary exceeds ALL employees in Department 20
-- (Meaning: salary is greater than the MAXIMUM salary in Department 20)
SELECT employee_id, full_name, salary
FROM employees
WHERE salary > ALL (
    SELECT salary 
    FROM employees 
    WHERE department_id = 20
);

-- VACUOUS TRUTH DEMONSTRATION:
-- If Department 99 has 0 employees, this query returns ALL employees in the company!
SELECT employee_id, full_name, salary
FROM employees
WHERE salary > ALL (
    SELECT salary 
    FROM employees 
    WHERE department_id = 99 -- 0 rows returned!
);`,
    recallHint: "> ALL means greater than maximum; < ALL means less than minimum; x > ALL (empty set) evaluates to TRUE (Vacuous Truth).",
    interviewTip: "Mention the 'Vacuous Truth' rule of mathematical logic: when the subquery is empty, `ALL` returns `TRUE` because no counter-example exists.",
    tags: ["all-predicate", "vacuous-truth", "empty-set-paradox", "quantified-comparisons", "mathematical-logic"]
  }),

  createCard({
    idNum: 57,
    category: "Subqueries & Exists Mechanics",
    concept: "Correlated Subqueries in the SELECT Projection List",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When should you use a correlated subquery in the SELECT list, and what are the performance alternatives?",
    quickAnswer: "A correlated subquery in the `SELECT` list calculates a single scalar metric per output row (e.g. `SELECT c.name, (SELECT COUNT(*) FROM orders o WHERE o.cust_id = c.id) AS order_count FROM customers c`). While easy to write, it executes row-by-row ($O(N)$ execution). On datasets exceeding a few thousand rows, it should be refactored into a `LEFT JOIN` with `GROUP BY` or an analytical window function to allow set-based execution.",
    detailedAnswer: "Performance Comparison:\n1. Correlated SELECT (Row-by-Row):\n   - If `customers` has 100,000 rows, the subquery executes 100,000 times.\n   - Only performs well if the outer query returns a very small filtered set (e.g. `WHERE customer_id = 42`).\n2. Left Join + Group By (Set-Based):\n   - Scans tables once, hashes join keys, and calculates all metrics in a single pipeline.\n   - Vastly superior for multi-row reports.",
    code: `-- 1. SLOW on large sets: Correlated subquery in SELECT (O(N) execution)
SELECT 
    c.customer_id,
    c.company_name,
    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.customer_id) AS total_orders,
    (SELECT MAX(o.order_date) FROM orders o WHERE o.customer_id = c.customer_id) AS last_order_date
FROM customers c;

-- 2. FAST: Refactored into a single set-based LEFT JOIN with GROUP BY
SELECT 
    c.customer_id,
    c.company_name,
    COUNT(o.order_id) AS total_orders,
    MAX(o.order_date) AS last_order_date
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
GROUP BY c.customer_id, c.company_name;`,
    recallHint: "Subqueries in SELECT run once per row; acceptable for single-row lookups; refactor to LEFT JOIN + GROUP BY for lists.",
    interviewTip: "Demonstrate query optimization maturity by taking a query with multiple correlated subqueries in `SELECT` and refactoring it into a clean `LEFT JOIN`.",
    tags: ["select-subquery", "correlated-projection", "left-join-refactoring", "n-plus-one", "query-tuning"]
  }),

  createCard({
    idNum: 58,
    category: "Subqueries & Exists Mechanics",
    concept: "Subqueries in the HAVING Clause",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do subqueries operate inside the HAVING clause, and what problems do they solve?",
    quickAnswer: "A subquery inside a `HAVING` clause allows you to filter aggregated groups by comparing group metrics against dynamic, system-wide calculated thresholds. For example, you can filter for departments whose average salary is greater than the company-wide average salary (`HAVING AVG(salary) > (SELECT AVG(salary) FROM employees)`), all within a single SQL statement.",
    detailedAnswer: "HAVING Subquery Execution:\n1. Group Formation: The outer query groups rows by department and calculates departmental metrics.\n2. Threshold Evaluation: The scalar subquery inside `HAVING` computes the global threshold.\n3. Group Elimination: Any group whose aggregate metric fails the comparison is discarded.\n4. Correlated HAVING: Subqueries in `HAVING` can even be correlated to outer grouping columns, though performance must be monitored.",
    code: `-- Find departments whose average salary exceeds the overall company average
SELECT 
    department_id,
    COUNT(*) AS headcount,
    ROUND(AVG(salary), 2) AS dept_avg_salary
FROM employees
GROUP BY department_id
HAVING AVG(salary) > (
    -- Scalar subquery computing company-wide threshold
    SELECT AVG(salary) FROM employees
)
ORDER BY dept_avg_salary DESC;`,
    breakdown: [
      "The outer query groups by department_id.",
      "HAVING AVG(salary) > (SELECT AVG(salary)...) evaluates groups against the global average.",
      "Departments with below-average compensation are filtered out after aggregation."
    ],
    recallHint: "HAVING subqueries compare group aggregates against dynamic thresholds (e.g. dept avg > global avg).",
    interviewTip: "Highlight that the scalar subquery inside `HAVING` evaluates once (not per group) if it is independent, keeping execution fast.",
    tags: ["having-subquery", "group-filtering", "dynamic-thresholds", "scalar-subquery", "aggregates"]
  }),

  createCard({
    idNum: 59,
    category: "Subqueries & Exists Mechanics",
    concept: "Row Constructors & Composite Tuple Subqueries: (a, b) IN (...)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are Row Constructors in ANSI SQL, and how do composite tuple comparisons (a, b) IN (...) simplify multi-column matching?",
    quickAnswer: "ANSI SQL supports **Row Value Constructors** (tuple literals wrapped in parentheses `(col1, col2)`). This enables multi-column equality comparisons against subqueries in a single predicate: `WHERE (tenant_id, order_id) IN (SELECT tenant_id, order_id FROM ...)`. This completely eliminates messy multi-condition joins or concatenated strings (`tenant_id || '-' || order_id`), allowing composite keys to be compared cleanly and atomically.",
    detailedAnswer: "Capabilities & Optimization:\n1. Clean Syntax: Avoids concatenation anti-patterns (`WHERE colA || colB IN (...)`) which destroy B-Tree index utilization.\n2. Subquery Matching: Inner query projects matching column pairs in identical positional order.\n3. Tuple Comparisons: Supports inequality tuple comparison: `WHERE (last_name, first_name) > ('Smith', 'John')`, which is the mathematical foundation of Keyset Pagination.\n4. Engine Support: Supported natively in PostgreSQL, MySQL, and Oracle.",
    code: `-- 1. Matching composite foreign keys atomically
SELECT * FROM order_items
WHERE (order_id, item_sequence) IN (
    SELECT order_id, MAX(item_sequence)
    FROM order_items
    GROUP BY order_id
);

-- 2. Tuple Keyset Pagination (Sorting and seeking on multiple columns simultaneously!)
SELECT user_id, last_name, first_name
FROM users
WHERE (last_name, first_name, user_id) > ('Doe', 'Jane', 1042)
ORDER BY last_name ASC, first_name ASC, user_id ASC
FETCH FIRST 10 ROWS ONLY;`,
    recallHint: "Row constructors (a, b) compare composite tuples; eliminates string concatenation; powers keyset pagination.",
    interviewTip: "Point out that `(colA, colB) > ('valA', 'valB')` enables multi-column index seeks for cursor pagination without awkward OR conditions.",
    tags: ["row-constructors", "tuple-subquery", "composite-keys", "keyset-pagination", "ansi-sql"]
  }),

  createCard({
    idNum: 60,
    category: "Subqueries & Exists Mechanics",
    concept: "Eliminating Correlated Subqueries with Window Functions",
    priority: "must-know",
    difficulty: "advanced",
    question: "How can correlated subqueries be rewritten using standard Window Functions, and why is this significantly faster?",
    quickAnswer: "Correlated subqueries that compare individual rows against their group summaries (e.g. 'Compare each employee's salary to their department's average') force $O(N)$ row-by-row subquery executions. Window Functions (`AVG(salary) OVER (PARTITION BY department_id)`) compute the exact same partition metrics in a **single sequential pass** over pre-sorted data ($O(N \\log N)$), eliminating thousands of independent subquery calls.",
    detailedAnswer: "Refactoring Architecture:\n- Correlated Subquery:\n  ```sql\n  SELECT e.name, e.salary - (SELECT AVG(s.salary) FROM emp s WHERE s.dept = e.dept) FROM emp e;\n  ```\n  Cost: For 50,000 employees, the subquery scans or seeks 50,000 times!\n- Window Function Refactor:\n  ```sql\n  SELECT name, salary - AVG(salary) OVER (PARTITION BY dept) FROM emp;\n  ```\n  Cost: Sorts the table by `dept` once, and streams calculations in a single pass. Decreases query latency from 15 seconds to 20 milliseconds.",
    code: `-- 1. SLOW: Correlated subquery executing per employee
SELECT 
    e.employee_id, 
    e.full_name, 
    e.salary,
    (e.salary - (SELECT AVG(salary) FROM employees WHERE department_id = e.department_id)) AS diff_from_dept_avg
FROM employees e;

-- 2. BLAZING FAST: Rewritten using standard Window Function in a single pass!
SELECT 
    employee_id, 
    full_name, 
    salary,
    ROUND(salary - AVG(salary) OVER (PARTITION BY department_id), 2) AS diff_from_dept_avg
FROM employees;`,
    recallHint: "Replace correlated summary subqueries with Window Functions OVER (PARTITION BY); turns O(N) loops into a single streaming pass.",
    interviewTip: "This is a classic performance refactoring showcase: demonstrating how window functions replace correlated subqueries proves senior SQL capability.",
    tags: ["correlated-refactor", "window-functions", "over-partition-by", "query-optimization", "performance-tuning"]
  })
];

module.exports = cards;
