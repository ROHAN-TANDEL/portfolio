const { createCard } = require("../sql_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 1,
    category: "Relational Foundations & Execution Order",
    concept: "The Relational Model & Set-Theoretic Foundations (Relations, Tuples, Attributes)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the mathematical foundation of the Relational Model introduced by E.F. Codd, and how does it map to SQL tables, rows, and columns?",
    quickAnswer: "The Relational Model (Dr. E.F. Codd, 1970) is rooted in first-order predicate logic and mathematical set theory. A 'Relation' maps to a Table, an 'Attribute' maps to a Column with a typed Domain of permitted values, and a 'Tuple' maps to an unordered Row. Mathematically, a relation is an unordered set of unique tuples with no duplicate rows, accessed strictly through associative attributes rather than physical pointers or hardware storage addresses.",
    detailedAnswer: "Mathematical Mapping to SQL:\n1. Relation = Table: A relation is a subset of the Cartesian product of list of domains ($D_1 \\times D_2 \\times \\dots \\times D_n$).\n2. Tuple = Row: An unordered collection of attribute-value pairs representing an entity instance.\n3. Attribute = Column: A named role with a declared scalar domain (data type).\n4. Unordered Sets: In pure relational theory, rows have no inherent order and tables have no physical top/bottom; order only exists when explicitly specified with `ORDER BY`.\n5. SQL Divergence from Pure Theory: SQL allows duplicate rows (multisets / bags) unless a `PRIMARY KEY` or `UNIQUE` constraint is enforced.",
    code: `-- Demonstrating Relational Model entities
CREATE TABLE employees (
    employee_id INT PRIMARY KEY,         -- Unique Key enforcing mathematical set property
    first_name VARCHAR(50) NOT NULL,    -- Attribute with Domain VARCHAR(50)
    salary NUMERIC(10, 2) NOT NULL      -- Attribute with Domain NUMERIC(10, 2)
);

-- Tuples are mathematically unordered sets:
-- Query results are NOT guaranteed to be sorted without ORDER BY!
SELECT employee_id, first_name, salary 
FROM employees;`,
    recallHint: "Relation = Table, Tuple = Row, Attribute = Column, Domain = Data Type. Relations are mathematically unordered sets.",
    interviewTip: "Highlight that pure relational theory forbids duplicate rows (sets), whereas SQL defaults to multisets (bags), which is why PRIMARY KEY is essential to enforce set theory.",
    tags: ["relational-model", "codd-rules", "tuples", "attributes", "set-theory"]
  }),

  createCard({
    idNum: 2,
    category: "Relational Foundations & Execution Order",
    concept: "Logical SQL Query Execution Order (FROM to LIMIT)",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is the logical execution order of a standard SQL SELECT statement, and why does it differ from lexical writing order?",
    quickAnswer: "While SQL is written starting with `SELECT`, the database engine processes clauses in a strict logical sequence: 1. `FROM` (table binding) $\\to$ 2. `ON` (join condition) $\\to$ 3. `JOIN` (cartesian product reduction) $\\to$ 4. `WHERE` (row filtering) $\\to$ 5. `GROUP BY` (aggregation buckets) $\\to$ 6. `HAVING` (group filtering) $\\to$ 7. `SELECT` (expression projection) $\\to$ 8. `DISTINCT` (deduplication) $\\to$ 9. `ORDER BY` (sorting) $\\to$ 10. `LIMIT / OFFSET` (pagination).",
    detailedAnswer: "Why Execution Order Matters in Practice:\n1. Column Aliases: You CANNOT use a column alias declared in `SELECT` inside the `WHERE` clause because `WHERE` executes before `SELECT` has evaluated the alias!\n2. Aggregates in WHERE: You cannot write `WHERE COUNT(*) > 5` because `WHERE` filters individual rows before `GROUP BY` groups them.\n3. HAVING vs WHERE: `WHERE` filters rows BEFORE grouping; `HAVING` filters aggregated buckets AFTER grouping.\n4. ORDER BY: `ORDER BY` executes after `SELECT`, which is why column aliases declared in `SELECT` ARE valid in `ORDER BY`.",
    code: `-- 1. Fails: Alias 'annual_pay' does not exist yet when WHERE executes!
-- SELECT salary * 12 AS annual_pay FROM employees WHERE annual_pay > 100000;

-- 2. Correct: Repeat expression in WHERE or use a subquery/CTE
SELECT salary * 12 AS annual_pay 
FROM employees 
WHERE (salary * 12) > 100000
ORDER BY annual_pay DESC; -- Valid! ORDER BY executes AFTER SELECT

-- 3. Logical Lifecycle Example:
SELECT department_id, COUNT(*) AS emp_count       -- Step 5: Projection
FROM employees                                     -- Step 1: Source
WHERE status = 'ACTIVE'                            -- Step 2: Row filter
GROUP BY department_id                             -- Step 3: Buckets
HAVING COUNT(*) >= 5                               -- Step 4: Group filter
ORDER BY emp_count DESC                            -- Step 6: Sort
OFFSET 0 ROWS FETCH NEXT 10 ROWS ONLY;             -- Step 7: Window limit`,
    recallHint: "FROM -> ON -> JOIN -> WHERE -> GROUP BY -> HAVING -> SELECT -> DISTINCT -> ORDER BY -> LIMIT.",
    interviewTip: "This is one of the most common SQL interview questions: explain why `WHERE total > 100` fails when `total` is an alias created in the `SELECT` clause.",
    tags: ["execution-order", "query-lifecycle", "lexical-vs-logical", "aliases", "sql-parser"]
  }),

  createCard({
    idNum: 3,
    category: "Relational Foundations & Execution Order",
    concept: "SQL Command Taxonomy: DDL vs DML vs DQL vs DCL vs TCL",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the five functional sub-languages of SQL (DDL, DML, DQL, DCL, TCL) and their specific responsibilities?",
    quickAnswer: "SQL commands are partitioned into 5 functional categories: 1) `DDL` (Data Definition Language: `CREATE`, `ALTER`, `DROP`, `TRUNCATE` defining schema structures); 2) `DML` (Data Manipulation Language: `INSERT`, `UPDATE`, `DELETE` mutating records); 3) `DQL` (Data Query Language: `SELECT` retrieving records); 4) `DCL` (Data Control Language: `GRANT`, `REVOKE` managing security permissions); and 5) `TCL` (Transaction Control Language: `COMMIT`, `ROLLBACK`, `SAVEPOINT` managing ACID transactions).",
    detailedAnswer: "Category Matrix & Behaviors:\n- DDL: Modifies database system catalogs. In many systems (e.g. Oracle, MySQL), DDL causes implicit transaction commits, whereas in PostgreSQL, most DDL is transactional.\n- DML vs DQL: Some standards classify `SELECT` under DML, but modern taxonomy separates `DQL` because querying reads data without mutating row state.\n- TRUNCATE vs DELETE: `DELETE` is DML (scans rows, logs deletes per tuple, fires triggers). `TRUNCATE` is DDL (deallocates entire data storage pages instantly, bypassing row triggers).",
    code: `-- DDL: Create structure
CREATE TABLE accounts (id INT PRIMARY KEY, balance NUMERIC(12, 2));

-- DCL: Manage access rights
GRANT SELECT, UPDATE ON accounts TO billing_service;

-- TCL: Transaction boundary
BEGIN TRANSACTION;

-- DML: Modify data
INSERT INTO accounts (id, balance) VALUES (1, 1000.00);
UPDATE accounts SET balance = balance - 200.00 WHERE id = 1;

-- DQL: Retrieve data
SELECT id, balance FROM accounts WHERE id = 1;

-- TCL: Finalize commit
COMMIT;`,
    recallHint: "DDL = Define structure; DML = Manipulate rows; DQL = Query; DCL = Control permissions; TCL = Transaction boundaries.",
    interviewTip: "When asked whether TRUNCATE is DDL or DML, answer DDL: it resets high-water marks and deallocates data pages rather than logging row deletions.",
    tags: ["sql-taxonomy", "ddl", "dml", "dql", "dcl", "tcl"]
  }),

  createCard({
    idNum: 4,
    category: "Relational Foundations & Execution Order",
    concept: "Three-Valued Logic (3VL): TRUE, FALSE and UNKNOWN in Boolean Expressions",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Three-Valued Logic (3VL) operate in SQL, and why does col = NULL evaluate to UNKNOWN instead of FALSE?",
    quickAnswer: "In standard SQL, boolean expressions evaluate to one of three truth values: `TRUE`, `FALSE`, or `UNKNOWN`. `NULL` represents missing or unknown information. Because a missing value cannot be known to equal another missing value, any direct equality comparison with `NULL` (e.g., `x = NULL` or `NULL = NULL`) evaluates to `UNKNOWN`. In `WHERE` and `HAVING` filters, rows are ONLY returned if the predicate evaluates to `TRUE`; rows evaluating to `UNKNOWN` or `FALSE` are both discarded.",
    detailedAnswer: "Three-Valued Logic Truth Tables:\n- `AND` Logic:\n  - `TRUE AND UNKNOWN` = `UNKNOWN`\n  - `FALSE AND UNKNOWN` = `FALSE`\n- `OR` Logic:\n  - `TRUE OR UNKNOWN` = `TRUE`\n  - `FALSE OR UNKNOWN` = `UNKNOWN`\n- `NOT` Logic:\n  - `NOT UNKNOWN` = `UNKNOWN`\n\nThe WHERE Filter Rule: A row passes `WHERE predicate` if and only if `predicate IS TRUE`. Since `salary = NULL` evaluates to `UNKNOWN`, it fails the truth test. One must explicitly use `IS NULL` or `IS NOT NULL`.",
    code: `-- Demonstrating 3VL in SQL
SELECT 
    (1 = 1) AS true_cond,               -- TRUE
    (1 = 2) AS false_cond,              -- FALSE
    (1 = NULL) AS null_comparison,      -- NULL (UNKNOWN)
    (NULL = NULL) AS null_equal_null;   -- NULL (UNKNOWN)

-- The WHERE trap:
SELECT * FROM employees WHERE bonus = NULL;     -- Returns 0 rows! (UNKNOWN is not TRUE)
SELECT * FROM employees WHERE bonus IS NULL;    -- Correct: Returns all rows where bonus is missing!

-- The NOT trap:
SELECT * FROM employees WHERE NOT (status = 'ACTIVE'); 
-- CAUTION: If status is NULL, (status = 'ACTIVE') is UNKNOWN, and NOT UNKNOWN is UNKNOWN!
-- Rows with NULL status are NOT returned!`,
    recallHint: "SQL uses 3VL: TRUE, FALSE, UNKNOWN. x = NULL is UNKNOWN. WHERE filters accept only TRUE (discards FALSE and UNKNOWN).",
    interviewTip: "Highlight that `NOT (status = 'ACTIVE')` will NOT return rows where `status IS NULL`, because negating `UNKNOWN` still yields `UNKNOWN`.",
    tags: ["three-valued-logic", "3vl", "null-handling", "boolean-logic", "is-null"]
  }),

  createCard({
    idNum: 5,
    category: "Relational Foundations & Execution Order",
    concept: "Safe NULL Handling: COALESCE vs NULLIF vs ISNULL / NVL",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between COALESCE and NULLIF, and how do they provide cross-database ANSI standard NULL handling?",
    quickAnswer: "`COALESCE(val1, val2, ...)` is an ANSI SQL standard function that evaluates arguments in order and returns the first non-NULL expression (or NULL if all are NULL). `NULLIF(val1, val2)` returns `NULL` if `val1 = val2`, otherwise returns `val1`. Together, they replace vendor-specific functions (like Oracle's `NVL` or SQL Server's `ISNULL`), allowing robust fallback values and preventing division-by-zero crashes.",
    detailedAnswer: "Usage Patterns:\n1. `COALESCE`: Implements fallback default values. Short-circuits execution (stops evaluating subsequent arguments as soon as a non-NULL is encountered).\n2. `NULLIF`: Primarily used to convert sentinel values (e.g. empty strings `''` or zeroes `0`) into `NULL`.\n3. Preventing Division by Zero: `val / NULLIF(divisor, 0)`. If divisor is 0, `NULLIF` turns it into `NULL`, and any number divided by `NULL` safely yields `NULL` instead of a catastrophic runtime crash.",
    code: `-- 1. COALESCE fallback chain
SELECT 
    user_id, 
    COALESCE(display_name, full_name, username, 'Anonymous Guest') AS active_name
FROM users;

-- 2. NULLIF preventing division by zero error
SELECT 
    campaign_id,
    revenue,
    clicks,
    -- If clicks is 0, NULLIF returns NULL, preventing division by zero!
    ROUND(revenue / NULLIF(clicks, 0), 2) AS revenue_per_click
FROM ad_campaigns;

-- 3. Converting empty strings to NULL before storing
SELECT NULLIF(TRIM(input_text), '') AS sanitized_text FROM form_submissions;`,
    recallHint: "COALESCE returns first non-null argument; NULLIF returns NULL if arguments are equal (ideal for preventing division by zero).",
    interviewTip: "Always recommend `NULLIF(col, 0)` for division operations in production SQL to ensure batches never crash on unexpected zero values.",
    tags: ["coalesce", "nullif", "division-by-zero", "ansi-sql", "null-handling"]
  }),

  createCard({
    idNum: 6,
    category: "Relational Foundations & Execution Order",
    concept: "Explicit Data Type Conversion: CAST vs Vendor Type Coercion",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the ANSI standard CAST() function work, and what are the hazards of implicit type conversion in SQL?",
    quickAnswer: "`CAST(expression AS target_type)` is the ANSI SQL standard function for explicitly converting a value from one data type to another. Implicit type coercion occurs when the database automatically converts types during comparisons (e.g. comparing a `VARCHAR` column to an integer literal). Implicit coercion can disable B-Tree index lookups, forcing expensive full table scans across millions of rows.",
    detailedAnswer: "Type Casting Mechanics:\n1. Standard Syntax: `CAST('2026-01-01' AS DATE)`, `CAST(total AS NUMERIC(10, 2))`.\n2. Incompatible Casts: Attempting to cast non-numeric characters to integers causes runtime conversion errors (e.g. `CAST('abc' AS INT)` fails).\n3. SARGability Hazard: If column `phone_number` is `VARCHAR(20)` and a query executes `WHERE phone_number = 1234567890`, the engine implicitly converts `CAST(phone_number AS BIGINT) = 1234567890` for every row, disabling the index on `phone_number`.",
    code: `-- Standard ANSI CAST syntax
SELECT 
    order_id, 
    CAST(created_at AS DATE) AS order_date,
    CAST(amount AS VARCHAR(20)) AS amount_str
FROM orders;

-- SARGABLE HAZARD (Implicit Conversion):
-- phone_str is indexed VARCHAR. This integer comparison forces full table scan!
-- SELECT * FROM contacts WHERE phone_str = 5551234;

-- CORRECT SARGABLE QUERY (Exact Type Match):
SELECT * FROM contacts WHERE phone_str = '5551234';`,
    recallHint: "Use standard CAST(expr AS type); avoid implicit type mismatch in WHERE clauses which invalidates index seeks.",
    interviewTip: "Explain how implicit type conversions silently kill database performance by causing the optimizer to wrap indexed columns in conversion functions.",
    tags: ["cast", "type-coercion", "data-types", "sargability", "ansi-standard"]
  }),

  createCard({
    idNum: 7,
    category: "Relational Foundations & Execution Order",
    concept: "Conditional Logic: Simple vs Searched CASE WHEN Expressions",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between Simple CASE and Searched CASE expressions in ANSI SQL?",
    quickAnswer: "A **Simple CASE** compares a single test expression against multiple target values using equality (`CASE status WHEN 'P' THEN 'Pending' ...`). A **Searched CASE** evaluates independent, arbitrary boolean conditions for each branch (`CASE WHEN score >= 90 THEN 'A' WHEN score >= 80 THEN 'B' ...`). Searched CASE is vastly more powerful because it supports complex logic, range checks, and multi-column predicates.",
    detailedAnswer: "Key Execution Rules:\n1. Short-Circuit Evaluation: SQL evaluates `WHEN` conditions sequentially from top to bottom and returns the result of the first matching condition, skipping subsequent branches.\n2. Type Uniformity: All `THEN` expressions and the `ELSE` branch MUST return data types that are compatible or convertible to a common type.\n3. Default ELSE: If no `WHEN` condition matches and no `ELSE` clause is specified, `CASE` implicitly returns `NULL`.\n4. Expression Status: `CASE` is an expression (returns a scalar value), not a control-flow statement, meaning it can be placed inside `SELECT`, `WHERE`, `ORDER BY`, and `GROUP BY`.",
    code: `-- 1. Simple CASE (Equality checks only)
SELECT 
    order_id,
    CASE status_code
        WHEN 'P' THEN 'Pending'
        WHEN 'S' THEN 'Shipped'
        WHEN 'C' THEN 'Cancelled'
        ELSE 'Unknown'
    END AS status_description
FROM orders;

-- 2. Searched CASE (Arbitrary boolean conditions & ranges)
SELECT 
    student_id,
    score,
    CASE 
        WHEN score >= 90 THEN 'Grade A'
        WHEN score >= 80 AND attendance_pct > 0.85 THEN 'Grade B'
        WHEN score >= 70 THEN 'Grade C'
        ELSE 'Fail'
    END AS letter_grade
FROM exam_results;

-- 3. Dynamic ORDER BY using Searched CASE
SELECT * FROM products
ORDER BY 
    CASE WHEN category = 'Featured' THEN 1 ELSE 2 END,
    price DESC;`,
    recallHint: "Simple CASE matches exact values on one column; Searched CASE evaluates arbitrary boolean expressions; short-circuits on first true.",
    interviewTip: "Remember that omitting `ELSE` defaults to `NULL`; always provide explicit `ELSE` clauses in production SQL to prevent unintended NULLs.",
    tags: ["case-when", "searched-case", "simple-case", "conditional-expressions", "short-circuit"]
  }),

  createCard({
    idNum: 8,
    category: "Relational Foundations & Execution Order",
    concept: "Pattern Matching: LIKE, Wildcards (%, _) and ESCAPE Characters",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do wildcards operate in the SQL LIKE predicate, and how do you search for literal percentage or underscore characters?",
    quickAnswer: "In ANSI SQL, `LIKE` matches string patterns using two wildcards: `%` matches zero or more arbitrary characters, and `_` matches exactly one character. To search for literal `%` or `_` characters without treating them as wildcards, you define an escape character using the `ESCAPE` clause (e.g., `WHERE discount LIKE '%10!%%' ESCAPE '!'`).",
    detailedAnswer: "Pattern Matching Mechanics:\n- `LIKE 'A%'`: Starts with 'A'.\n- `LIKE '%A'`: Ends with 'A'.\n- `LIKE '%A%'`: Contains 'A'.\n- `LIKE '___'`: Exactly 3 characters long.\n- `LIKE '_B%'`: Second character is 'B'.\n- Index SARGability: Leading wildcards (`LIKE '%term'`) CANNOT use standard B-Tree indexes and force a full table scan. Trailing wildcards (`LIKE 'term%'`) CAN use B-Tree indexes as a range scan (`>= 'term' AND < 'tern'`).\n- Case Sensitivity: ANSI SQL `LIKE` is case-sensitive, though default collation in SQL Server and MySQL may be case-insensitive.",
    code: `-- Matching patterns
SELECT * FROM products WHERE sku LIKE 'PROD-%'; -- Starts with PROD- (Uses B-Tree index!)
SELECT * FROM products WHERE sku LIKE '%2026';  -- Ends with 2026 (Full table scan!)
SELECT * FROM codes WHERE code LIKE 'A_C';      -- Matches 'ABC', 'A1C', 'A-C'

-- Searching for literal '%' or '_' characters using ESCAPE clause
SELECT * FROM promotion_discounts 
WHERE promo_label LIKE '%15!%%' ESCAPE '!'; -- Matches strings containing literal '15%'

SELECT * FROM system_tables 
WHERE table_name LIKE 'tbl!_%' ESCAPE '!';  -- Matches tables starting with 'tbl_'`,
    recallHint: "% = zero or more chars, _ = exactly one char; ESCAPE defines literal escape prefix; leading % disables B-Tree indexes.",
    interviewTip: "Always call out that `LIKE '%text%'` triggers a full table scan on B-Tree indexed columns because the leading wildcard prevents tree traversal.",
    tags: ["like-operator", "pattern-matching", "wildcards", "escape-clause", "sargability"]
  }),

  createCard({
    idNum: 9,
    category: "Relational Foundations & Execution Order",
    concept: "Arithmetic Operations, Decimal Rounding & Division by Zero Safeguards",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What happens during integer division in SQL, and how do you ensure exact decimal calculations without division-by-zero crashes?",
    quickAnswer: "In standard SQL, dividing an integer by another integer results in integer truncation (e.g. `5 / 2` evaluates to `2`, completely discarding the remainder `.5`). To obtain an exact decimal, at least one operand must be explicitly cast to a decimal or numeric type (`5.0 / 2` or `CAST(5 AS NUMERIC) / 2`). Furthermore, any division where the denominator is 0 must be safeguarded using `NULLIF(denominator, 0)` to avoid fatal query termination.",
    detailedAnswer: "Arithmetic Pitfalls:\n1. Integer Truncation: `SELECT 1 / 4` returns `0` in SQL Server, PostgreSQL, and SQLite! Only MySQL implicitly promotes to float.\n2. Scale & Precision: When multiplying or dividing `NUMERIC(p, s)`, resulting precision and scale follow deterministic mathematical rules to prevent overflow.\n3. Rounding Functions:\n   - `ROUND(val, decimals)`: Rounds to nearest decimal place.\n   - `TRUNC(val, decimals)` / `TRUNCATE()`: Truncates without rounding.\n   - `CEIL()` / `CEILING()`: Smallest integer >= value.\n   - `FLOOR()`: Largest integer <= value.",
    code: `-- 1. Integer division truncation trap
SELECT 
    5 / 2 AS int_division,                         -- Returns 2 (truncated!)
    5.0 / 2 AS decimal_division,                   -- Returns 2.50000
    CAST(5 AS NUMERIC(10, 2)) / 2 AS exact_calc;   -- Returns 2.50000

-- 2. Production metric calculation with division by zero guard
SELECT 
    store_id,
    total_sales,
    foot_traffic,
    -- Safe conversion rate: Returns NULL instead of crashing if traffic is 0
    ROUND(100.0 * total_sales / NULLIF(foot_traffic, 0), 2) AS conversion_rate_pct
FROM store_analytics;`,
    recallHint: "Integer / Integer truncates decimals; multiply by 1.0 or CAST to NUMERIC; always wrap denominators in NULLIF(col, 0).",
    interviewTip: "Point out the classic bug: `SELECT count(*) / total` returning 0 because both were integers, resolved by `100.0 * count / total`.",
    tags: ["integer-division", "truncation", "nullif", "rounding", "precision"]
  }),

  createCard({
    idNum: 10,
    category: "Relational Foundations & Execution Order",
    concept: "Deduplication Theory: DISTINCT vs Scalar GROUP BY",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between SELECT DISTINCT and GROUP BY for row deduplication, and how does the optimizer handle them?",
    quickAnswer: "`SELECT DISTINCT` evaluates across all projected columns in the `SELECT` list and removes duplicate rows from the final result set. `GROUP BY` groups rows by specified grouping keys and is designed to compute aggregate functions (`COUNT`, `SUM`) per group. If no aggregates are included, `GROUP BY` produces the same unique rows as `DISTINCT`, and most modern cost-based query optimizers execute them using identical internal hash or sort deduplication algorithms.",
    detailedAnswer: "Key Architectural Differences:\n1. Semantic Intent: `DISTINCT` communicates deduplication of the final projected tuple. `GROUP BY` communicates data aggregation.\n2. Column Independence: `GROUP BY` can group by a subset of columns while calculating metrics on others. `DISTINCT` applies universally to all columns projected in the `SELECT` clause (you cannot apply `DISTINCT` to a single column in ANSI SQL `SELECT DISTINCT a, b` - it deduplicates the `(a, b)` pair).\n3. HAVING Support: `GROUP BY` allows `HAVING` filters; `DISTINCT` does not.",
    code: `-- 1. DISTINCT deduplicating the combined tuple (country, city)
SELECT DISTINCT country, city 
FROM customers 
ORDER BY country, city;

-- 2. GROUP BY producing identical output when no aggregates are used
SELECT country, city 
FROM customers 
GROUP BY country, city 
ORDER BY country, city;

-- 3. Common Mistake: DISTINCT does not apply to a single column!
-- This deduplicates (department_id, employee_name), NOT just department_id:
SELECT DISTINCT department_id, employee_name FROM employees;`,
    recallHint: "DISTINCT deduplicates the entire projected tuple; GROUP BY is intended for aggregates but uses similar hash/sort algorithms.",
    interviewTip: "Clarify that `SELECT DISTINCT col1, col2` deduplicates the composite pair `(col1, col2)`, not just `col1` alone.",
    tags: ["distinct", "group-by", "deduplication", "query-planner", "relational-projection"]
  }),

  createCard({
    idNum: 11,
    category: "Relational Foundations & Execution Order",
    concept: "Result Set Ordering: Deterministic ORDER BY & NULLS FIRST / LAST",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why is an ORDER BY clause without tie-breakers non-deterministic, and how are NULL values positioned across SQL dialects?",
    quickAnswer: "In relational theory, table rows are unordered. If you query `ORDER BY created_at` and multiple rows share the exact same timestamp, the database engine returns them in arbitrary order (non-deterministic sort). To ensure deterministic results (critical for pagination), an `ORDER BY` clause must append a unique column (e.g. `PRIMARY KEY`). Regarding `NULL` values, ANSI SQL provides `NULLS FIRST` and `NULLS LAST` to control whether missing values appear at the beginning or end of the sorted output.",
    detailedAnswer: "Ordering Deep Dive:\n1. Non-Deterministic Pagination Bug: Under `ORDER BY date LIMIT 10 OFFSET 10`, rows with identical dates can appear on Page 1 and repeat on Page 2 if the engine's physical scan order shifts between queries.\n2. Tie-Breaker Rule: Always end pagination `ORDER BY` with the primary key: `ORDER BY date DESC, id DESC`.\n3. NULL Sorting Variance:\n   - PostgreSQL / Oracle: `NULL`s are considered larger than any value (appear LAST in `ASC`, FIRST in `DESC`).\n   - MySQL / SQL Server: `NULL`s are considered smaller than any value (appear FIRST in `ASC`, LAST in `DESC`).\n   - ANSI Standard Fix: Explicitly specify `ORDER BY col ASC NULLS LAST` or `NULLS FIRST`.",
    code: `-- 1. Deterministic sort guaranteed by tie-breaker primary key
SELECT user_id, registration_date, full_name
FROM users
ORDER BY registration_date DESC, user_id DESC;

-- 2. ANSI standard explicit NULL positioning
SELECT employee_id, salary, commission_pct
FROM employees
ORDER BY commission_pct DESC NULLS LAST, employee_id ASC;`,
    recallHint: "Always add a unique tie-breaker (PK) to ORDER BY for deterministic pagination; use NULLS FIRST / LAST for cross-dialect consistency.",
    interviewTip: "Explain why pagination without a unique tie-breaker leads to duplicate or skipped rows across pages in production web applications.",
    tags: ["order-by", "determinism", "nulls-last", "pagination-bugs", "sorting"]
  }),

  createCard({
    idNum: 12,
    category: "Relational Foundations & Execution Order",
    concept: "Pagination Standards: ANSI FETCH FIRST / OFFSET vs Vendor LIMIT",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the ANSI SQL:2008 FETCH FIRST / OFFSET standard compare to vendor LIMIT / OFFSET clauses?",
    quickAnswer: "`LIMIT n OFFSET m` is a widely supported dialect feature (popularized by MySQL, PostgreSQL, and SQLite), but is not part of the core ANSI SQL standard. ANSI SQL:2008 introduced the official standard syntax: `OFFSET m ROWS FETCH NEXT n ROWS ONLY` (and `FETCH NEXT n ROWS WITH TIES`). Both achieve page slicing, but the ANSI standard is portable across Oracle (12c+), SQL Server (2012+), PostgreSQL, and modern relational engines.",
    detailedAnswer: "Pagination Specifications:\n1. ANSI Standard: `OFFSET 20 ROWS FETCH NEXT 10 ROWS ONLY`.\n2. `WITH TIES`: `FETCH FIRST 5 ROWS WITH TIES` returns the top 5 rows plus any additional rows that tie the 5th row's value according to the `ORDER BY` clause.\n3. The OFFSET Scaling Problem: Both `LIMIT/OFFSET` and `FETCH/OFFSET` suffer from the $O(N)$ scanning bottleneck on deep pagination (e.g. `OFFSET 1000000` must read and discard 1 million rows before returning 10). Keyset pagination (cursor seek) should be used for large datasets.",
    code: `-- 1. ANSI SQL:2008 Standard Pagination Syntax
SELECT product_id, product_name, price
FROM products
ORDER BY price DESC, product_id ASC
OFFSET 20 ROWS 
FETCH NEXT 10 ROWS ONLY;

-- 2. ANSI Standard WITH TIES (Includes ties for 5th position!)
SELECT student_id, test_score
FROM exam_results
ORDER BY test_score DESC
FETCH FIRST 5 ROWS WITH TIES;

-- 3. Common Dialect Equivalent (PostgreSQL, MySQL, SQLite)
SELECT product_id, product_name, price
FROM products
ORDER BY price DESC, product_id ASC
LIMIT 10 OFFSET 20;`,
    recallHint: "ANSI standard is OFFSET n ROWS FETCH NEXT m ROWS ONLY; WITH TIES includes duplicate rank ties; both suffer O(N) deep offset lag.",
    interviewTip: "Mention `WITH TIES` as a classic ANSI SQL capability: it ensures athletes tied for 3rd place both receive bronze medals in reporting queries.",
    tags: ["fetch-first", "offset", "limit", "ansi-standard", "pagination"]
  })
];

module.exports = cards;
