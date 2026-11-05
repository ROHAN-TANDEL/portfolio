const { createCard } = require("../sql_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 25,
    category: "Joins & Set Operations",
    concept: "INNER JOIN Mechanics and Cartesian Product Reduction",
    priority: "must-know",
    difficulty: "must-know",
    question: "How does an INNER JOIN work logically and mathematically, and what happens when duplicate keys exist on both sides?",
    quickAnswer: "An `INNER JOIN` evaluates the Cartesian product of two tables and retains only those row pairs where the `ON` join predicate evaluates to `TRUE`. If a key appears $M$ times in Table A and $N$ times in Table B, an `INNER JOIN` on that key produces $M \\times N$ rows in the result set (row multiplication). Any rows in Table A or Table B that have no matching key on the opposing side are completely discarded.",
    detailedAnswer: "Mathematical Foundation:\n1. Cross Product: Mathematically starts as $A \\times B$.\n2. Theta Join: Applies the filter condition $\\sigma_{A.key = B.key}(A \\times B)$.\n3. Row Multiplication Risk: If joining `customers` to `orders` and a customer has 5 orders, 5 rows are returned with customer metadata duplicated across all 5 rows.\n4. Equi-Join vs Non-Equi Join: When the condition uses equality (`=`), it is an Equi-Join, which database optimizers accelerate using Hash Joins or Merge Joins.",
    code: `-- Standard ANSI SQL-92 Explicit INNER JOIN
SELECT 
    c.customer_id, 
    c.company_name, 
    o.order_id, 
    o.total_amount
FROM customers c
INNER JOIN orders o ON c.customer_id = o.customer_id
WHERE o.order_date >= '2026-01-01';

-- Row multiplication demonstration:
-- If Customer 42 has 3 orders, this query returns 3 rows with Customer 42's name.`,
    recallHint: "INNER JOIN returns only matching row pairs; unmatched rows are dropped; M keys x N keys produces M*N rows.",
    interviewTip: "Never use legacy SQL-89 implicit comma joins (`FROM tableA, tableB WHERE a.id = b.id`); always use explicit ANSI SQL-92 `INNER JOIN ... ON ...`.",
    tags: ["inner-join", "equi-join", "cartesian-product", "row-multiplication", "relational-algebra"]
  }),

  createCard({
    idNum: 26,
    category: "Joins & Set Operations",
    concept: "LEFT OUTER JOIN vs RIGHT OUTER JOIN (Preserving Unmatched Tuples)",
    priority: "must-know",
    difficulty: "must-know",
    question: "How does a LEFT OUTER JOIN preserve unmatched tuples, and why is RIGHT OUTER JOIN rarely used in modern SQL?",
    quickAnswer: "A `LEFT OUTER JOIN` returns ALL rows from the left-hand table, regardless of whether a matching row exists in the right-hand table. For rows with matching keys, columns from the right-hand table are populated with data; for unmatched rows, all right-hand columns are padded with `NULL`. `RIGHT OUTER JOIN` does the exact reverse (preserving the right-hand table), but modern style guides universally prefer `LEFT JOIN` because reading code from left-to-right is easier to follow.",
    detailedAnswer: "LEFT JOIN Lifecycle:\n1. Preserve Left Side: Every tuple from table A appears at least once in the result set.\n2. One-to-Many Expansion: If table A matches 3 rows in table B, table A's row repeats 3 times. If it matches 0 rows in table B, table A's row appears once with `NULL`s for all columns of table B.\n3. Common Use Cases: Finding entities with no activity (e.g. 'Customers who have never placed an order'), or generating comprehensive reports where missing child records must be shown as 0 or empty.",
    code: `-- Fetch ALL customers and their orders (including customers with 0 orders)
SELECT 
    c.customer_id, 
    c.company_name, 
    COALESCE(o.order_id, 0) AS order_id, 
    COALESCE(o.total_amount, 0.00) AS total_amount
FROM customers c
LEFT OUTER JOIN orders o ON c.customer_id = o.customer_id;

-- Equivalent RIGHT JOIN (less intuitive to read):
-- SELECT ... FROM orders o RIGHT OUTER JOIN customers c ON c.customer_id = o.customer_id;`,
    recallHint: "LEFT JOIN preserves all left rows, padding right columns with NULL when no match exists; avoid RIGHT JOIN for readability.",
    interviewTip: "Explain that `RIGHT JOIN` can always be rewritten as a `LEFT JOIN` simply by swapping table order in the `FROM` clause.",
    tags: ["left-join", "right-join", "outer-join", "null-padding", "unmatched-tuples"]
  }),

  createCard({
    idNum: 27,
    category: "Joins & Set Operations",
    concept: "FULL OUTER JOIN & Symmetric Difference Modeling",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a FULL OUTER JOIN and how is it used to reconcile two datasets or detect discrepancies?",
    quickAnswer: "A `FULL OUTER JOIN` combines the results of both a `LEFT JOIN` and a `RIGHT JOIN`. It preserves ALL rows from both the left and right tables: rows that match on the join predicate are merged together into a single row, while unmatched rows from either side are retained with `NULL` padding for the missing opposing columns. It is widely used for financial ledger reconciliation, comparing legacy vs modern systems, and finding symmetric differences.",
    detailedAnswer: "FULL OUTER JOIN Anatomy:\n- Result Set Components:\n  1. Rows present in BOTH Table A and Table B.\n  2. Rows present in Table A but NOT in Table B (`B.id IS NULL`).\n  3. Rows present in Table B but NOT in Table A (`A.id IS NULL`).\n- Finding Symmetric Differences: Adding `WHERE A.id IS NULL OR B.id IS NULL` isolates records that exist in only one of the two tables.",
    code: `-- Reconciling Bank Transactions with Internal Ledger Entries
SELECT 
    COALESCE(b.tx_id, l.tx_id) AS transaction_id,
    b.amount AS bank_reported_amount,
    l.amount AS ledger_reported_amount,
    CASE 
        WHEN b.tx_id IS NOT NULL AND l.tx_id IS NOT NULL AND b.amount = l.amount THEN 'MATCHED'
        WHEN b.tx_id IS NOT NULL AND l.tx_id IS NOT NULL AND b.amount != l.amount THEN 'AMOUNT_MISMATCH'
        WHEN b.tx_id IS NULL THEN 'MISSING_IN_BANK'
        WHEN l.tx_id IS NULL THEN 'MISSING_IN_LEDGER'
    END AS reconciliation_status
FROM bank_statement b
FULL OUTER JOIN internal_ledger l ON b.tx_id = l.tx_id;`,
    recallHint: "FULL OUTER JOIN preserves all rows from both tables; unmatched rows on either side are padded with NULL; ideal for data reconciliation.",
    interviewTip: "Highlight that MySQL does NOT natively support `FULL OUTER JOIN`; in MySQL, it must be emulated using `LEFT JOIN ... UNION ALL ... RIGHT JOIN ... WHERE ...`.",
    tags: ["full-outer-join", "reconciliation", "symmetric-difference", "ledger-matching", "data-integrity"]
  }),

  createCard({
    idNum: 28,
    category: "Joins & Set Operations",
    concept: "CROSS JOIN (Cartesian Products & Combinatorial Grids)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a CROSS JOIN, and what are its legitimate real-world engineering use cases beyond accidental mistakes?",
    quickAnswer: "A `CROSS JOIN` produces the complete mathematical Cartesian product of two tables, matching every row in Table A with every row in Table B. If Table A has $M$ rows and Table B has $N$ rows, the result contains exactly $M \\times N$ rows with no join condition (`ON` clause). Legitimate production use cases include generating date/calendar grids for zero-gap reporting, e-commerce product matrix generation (Colors $\\times$ Sizes), and test data synthesis.",
    detailedAnswer: "Safe and Legitimate Use Cases:\n1. Generating Product SKU Matrix: Crossing 5 `colors` with 4 `sizes` generates all 20 valid SKU combinations.\n2. Zero-Filling Time-Series Dashboards: Crossing a list of all active `stores` with all 30 days of the month creates an empty matrix that is then `LEFT JOIN`ed with actual sales, ensuring days with 0 sales display '$0.00' rather than disappearing.\n3. The Outage Trap: Accidental cross joins on two 100,000-row tables produce 10,000,000,000 rows, crashing query memory buffers.",
    code: `-- Generate all permutations of T-Shirt Variants (Colors x Sizes)
WITH colors AS (
    SELECT 'Red' AS color UNION ALL SELECT 'Blue' UNION ALL SELECT 'Black'
),
sizes AS (
    SELECT 'S' AS size UNION ALL SELECT 'M' UNION ALL SELECT 'L' UNION ALL SELECT 'XL'
)
SELECT 
    c.color, 
    s.size,
    c.color || '-' || s.size AS sku_code
FROM colors c
CROSS JOIN sizes s
ORDER BY c.color, s.size;`,
    recallHint: "CROSS JOIN produces Cartesian product (M x N rows) with no ON clause; used for SKU matrices and calendar reporting grids.",
    interviewTip: "Explain how crossing a table of entities with a calendar dimension allows `LEFT JOIN`ing metrics to guarantee zero-gap reporting for dashboard charts.",
    tags: ["cross-join", "cartesian-product", "combinatorics", "reporting-grid", "sku-matrix"]
  }),

  createCard({
    idNum: 29,
    category: "Joins & Set Operations",
    concept: "SELF JOIN for Hierarchies and Intra-Table Row Comparisons",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a SELF JOIN, how do table aliases enable it, and what problems does it solve?",
    quickAnswer: "A `SELF JOIN` is a regular join in which a table is joined with itself. It requires distinct table aliases (e.g. `employees emp` and `employees mgr`) so the SQL parser can treat them as two independent virtual tables. SELF JOINs are standard for: 1) traversing single-level parent-child hierarchies (e.g. employee to manager); and 2) comparing rows within the same table (e.g. finding duplicate values, or pairing co-workers in the same department).",
    detailedAnswer: "SELF JOIN Patterns:\n1. Management Hierarchy: `FROM employees e LEFT JOIN employees m ON e.manager_id = m.employee_id`. A `LEFT JOIN` is essential so the CEO (who has `manager_id = NULL`) is not filtered out.\n2. Intra-Table Comparisons: Finding customers who live in the same city: `FROM customers a JOIN customers b ON a.city = b.city AND a.id < b.id`. The condition `a.id < b.id` prevents a customer pairing with themselves (`a.id != a.id`) and eliminates reverse duplicates `(A, B)` vs `(B, A)`.",
    code: `-- 1. Management reporting hierarchy (Employee and Manager Name)
SELECT 
    e.employee_id,
    e.full_name AS employee_name,
    COALESCE(m.full_name, 'Top Level Executive') AS manager_name
FROM employees e
LEFT JOIN employees m ON e.manager_id = m.employee_id;

-- 2. Finding all unique pairs of employees in the same department
SELECT 
    e1.full_name AS employee_1,
    e2.full_name AS employee_2,
    e1.department_id
FROM employees e1
JOIN employees e2 ON e1.department_id = e2.department_id 
                AND e1.employee_id < e2.employee_id; -- Avoid self-match and duplicates!`,
    recallHint: "SELF JOIN joins a table to itself using distinct aliases; use < on primary keys to avoid pairing rows with themselves and prevent duplicate inverted pairs.",
    interviewTip: "Highlight the `a.id < b.id` pattern: it simultaneously solves both the self-pairing bug (`a.id = b.id`) and the mirror-duplicate bug `(A, B)` and `(B, A)`.",
    tags: ["self-join", "table-aliases", "hierarchies", "intra-table", "pair-matching"]
  }),

  createCard({
    idNum: 30,
    category: "Joins & Set Operations",
    concept: "The ON Clause vs WHERE Clause in Outer Joins (The Nullification Hazard)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the critical difference between filtering a right-hand column in the ON clause vs the WHERE clause of a LEFT JOIN?",
    quickAnswer: "Filtering in the `ON` clause affects the **join matching criteria**: if the condition fails, the left row is STILL preserved, and right-hand columns become `NULL`. Filtering a right-hand column in the `WHERE` clause occurs **AFTER the join has taken place**: because non-matching rows have right-hand columns as `NULL`, checking `WHERE right.status = 'ACTIVE'` evaluates to `UNKNOWN` and discards all non-matching left rows, silently converting your `LEFT JOIN` into an `INNER JOIN`!",
    detailedAnswer: "The Silent Conversion Trap:\n- Query A (ON clause filter):\n  ```sql\n  SELECT * FROM customers c LEFT JOIN orders o ON c.id = o.customer_id AND o.status = 'PAID';\n  ```\n  Result: Returns ALL customers. If a customer has no 'PAID' orders, the customer is still returned with NULL order details.\n- Query B (WHERE clause filter):\n  ```sql\n  SELECT * FROM customers c LEFT JOIN orders o ON c.id = o.customer_id WHERE o.status = 'PAID';\n  ```\n  Result: Discards all customers without paid orders! Because `NULL = 'PAID'` evaluates to `UNKNOWN`, the WHERE clause drops them, transforming the query into an `INNER JOIN`.",
    code: `-- 1. CORRECT: Preserves customers with 0 completed orders
SELECT 
    c.customer_id, 
    c.name, 
    o.order_id, 
    o.status
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id 
                  AND o.status = 'COMPLETED'; -- Condition inside ON clause!

-- 2. DANGEROUS BUG: Silently eliminates customers with 0 completed orders!
SELECT 
    c.customer_id, 
    c.name, 
    o.order_id, 
    o.status
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
WHERE o.status = 'COMPLETED'; -- Turns LEFT JOIN into INNER JOIN!`,
    recallHint: "Filters in ON affect join matching (preserves left row); filters in WHERE filter final rows (converts LEFT JOIN into INNER JOIN).",
    interviewTip: "This is one of the top senior SQL interview traps: interviewers show a query with `LEFT JOIN ... WHERE right.col = 'X'` and ask why it behaves like an INNER JOIN.",
    tags: ["on-vs-where", "left-join-trap", "inner-join-conversion", "nullification", "sql-anti-patterns"]
  }),

  createCard({
    idNum: 31,
    category: "Joins & Set Operations",
    concept: "Multi-Table Joins & Associative Join Tree Evaluation",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the query optimizer plan multi-table joins, and how does join associativity affect execution?",
    quickAnswer: "In standard SQL, joins are logically evaluated from left to right as a binary tree (joining two relations at a time). However, because relational inner joins are both associative $(A \\bowtie B) \\bowtie C = A \\bowtie (B \\bowtie C)$ and commutative $A \\bowtie B = B \\bowtie A$, the cost-based optimizer is free to reorder inner joins in whatever sequence minimizes intermediate row sizes. In contrast, outer joins are NOT generally associative, constraining the optimizer's join reordering freedom.",
    detailedAnswer: "Join Tree Mechanics:\n1. Search Space: For $N$ tables, there are $\\frac{(2N-2)!}{(N-1)!}$ possible join tree topologies. Beyond 8-12 tables, optimizers switch from exhaustive dynamic programming to genetic algorithms (`GEQO`).\n2. The Driving Table: The optimizer identifies the most selective filter and begins with the smallest relation ('driving table') to minimize intermediate row pipelines.\n3. Outer Join Restrictions: `(A LEFT JOIN B) LEFT JOIN C` cannot be rearranged arbitrarily without changing query results, forcing the engine to follow the declared dependency order.",
    code: `-- Multi-table join across 4 relational entities
SELECT 
    c.company_name,
    o.order_id,
    o.order_date,
    p.product_name,
    i.quantity,
    (i.quantity * i.unit_price) AS line_total
FROM customers c
INNER JOIN orders o ON c.customer_id = o.customer_id
INNER JOIN order_items i ON o.order_id = i.order_id
INNER JOIN products p ON i.product_id = p.product_id
WHERE c.country = 'Germany' 
  AND o.order_date >= '2026-01-01';`,
    breakdown: [
      "The optimizer reorders inner joins based on table statistics to minimize intermediate rows.",
      "Outer joins restrict reordering because they are not associative.",
      "Clear, consistent aliasing (c, o, i, p) prevents ambiguity across multi-table projections."
    ],
    recallHint: "Inner joins are associative and commutative (optimizer can reorder); outer joins are non-associative (constrains reordering).",
    interviewTip: "Explain why large queries with 15+ joins can have long planning times: evaluating join order permutations grows factorially.",
    tags: ["multi-table-joins", "join-trees", "associativity", "driving-table", "query-optimizer"]
  }),

  createCard({
    idNum: 32,
    category: "Joins & Set Operations",
    concept: "Non-Equi Joins (Joining on Ranges, Inequalities and BETWEEN)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a Non-Equi Join in SQL, and what problems does it solve without using equality (=) operators?",
    quickAnswer: "A **Non-Equi Join** is any join where the `ON` condition uses comparison operators other than equality (`<`, `>`, `<=`, `>=`, `BETWEEN`, or `!=`). They are standard for mapping continuous numerical metrics into discrete grade/tier bands (e.g. matching a customer's total spending against a loyalty tier min/max range), calculating period-over-period overlap, and joining historical time-validity tables.",
    detailedAnswer: "Use Cases & Optimizer Impact:\n1. Band/Tier Mapping: Joining a salary table with a tax bracket table `ON salary BETWEEN min_salary AND max_salary`.\n2. Performance Consideration: Modern database engines optimize Equi-Joins using fast $O(N)$ Hash Joins. Non-Equi Joins cannot use standard Hash Joins and typically require Nested Loop joins or B-Tree index range scans, which can be computationally intensive on large datasets without appropriate indexes.",
    code: `-- Mapping student scores into Letter Grades using a Non-Equi Join
CREATE TABLE grade_scales (
    letter_grade VARCHAR(2) PRIMARY KEY,
    min_score INT NOT NULL,
    max_score INT NOT NULL
);

INSERT INTO grade_scales VALUES 
('A', 90, 100),
('B', 80, 89),
('C', 70, 79),
('D', 60, 69),
('F', 0, 59);

-- Non-Equi Join matching student scores into the proper grade range
SELECT 
    s.student_id,
    s.student_name,
    s.exam_score,
    g.letter_grade
FROM student_scores s
JOIN grade_scales g ON s.exam_score BETWEEN g.min_score AND g.max_score;`,
    recallHint: "Non-Equi joins use <, >, BETWEEN instead of =; ideal for tier mapping; cannot use Hash Joins, defaults to Nested Loop.",
    interviewTip: "Mention that Non-Equi joins cannot use Hash Joins (which require equality hashes); they rely on Nested Loops backed by B-Tree range indexes.",
    tags: ["non-equi-join", "between-join", "band-mapping", "nested-loop", "relational-algebra"]
  }),

  createCard({
    idNum: 33,
    category: "Joins & Set Operations",
    concept: "Anti-Joins: Finding Missing Records with LEFT JOIN and IS NULL",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is an Anti-Join, and how do you implement it using LEFT JOIN ... WHERE IS NULL vs NOT EXISTS?",
    quickAnswer: "An **Anti-Join** returns rows from the first table that have **no matching rows** in the second table. In standard SQL, an Anti-Join is implemented either by performing a `LEFT OUTER JOIN` and filtering on `WHERE right.primary_key IS NULL`, or by using `WHERE NOT EXISTS (...)`. Both represent set difference ($A \\setminus B$), but `NOT EXISTS` is generally preferred for clarity and immune to NULL value pitfalls.",
    detailedAnswer: "Anti-Join Comparison:\n1. Pattern 1: `LEFT JOIN ... WHERE right.pk IS NULL`:\n   - Performs full outer join, pads unmatched rows with NULL, then discards matched rows in WHERE filter.\n2. Pattern 2: `WHERE NOT EXISTS (SELECT 1 FROM B WHERE B.fk = A.pk)`:\n   - Expresses business intent clearly.\n   - Short-circuits: Stops scanning table B as soon as a single match is found.\n3. The NOT IN Trap: Never use `WHERE id NOT IN (SELECT id FROM B)` if B can contain a single `NULL`, as 3VL causes the entire query to return 0 rows!",
    code: `-- Pattern 1: Anti-Join via LEFT JOIN ... IS NULL
SELECT c.customer_id, c.company_name
FROM customers c
LEFT JOIN orders o ON c.customer_id = o.customer_id
WHERE o.customer_id IS NULL; -- Only keeps customers with NO orders!

-- Pattern 2: Anti-Join via NOT EXISTS (Recommended & clean)
SELECT c.customer_id, c.company_name
FROM customers c
WHERE NOT EXISTS (
    SELECT 1 
    FROM orders o 
    WHERE o.customer_id = c.customer_id
);`,
    recallHint: "Anti-Join returns rows with no matching counterpart; use LEFT JOIN ... WHERE IS NULL or NOT EXISTS; avoid NOT IN due to NULL traps.",
    interviewTip: "Always recommend `NOT EXISTS` over `LEFT JOIN ... WHERE IS NULL` for anti-joins: `NOT EXISTS` short-circuits on the first match and communicates intent clearly.",
    tags: ["anti-join", "not-exists", "is-null", "set-difference", "unmatched-records"]
  }),

  createCard({
    idNum: 34,
    category: "Joins & Set Operations",
    concept: "Semi-Joins: Existence Verification without Row Multiplication",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a Semi-Join in relational theory, and how does it prevent row duplication compared to an INNER JOIN?",
    quickAnswer: "A **Semi-Join** returns rows from the left-hand table that have at least one match in the right-hand table, but **never duplicates rows from the left table** and does not project columns from the right table. While an `INNER JOIN` against a table with multiple matches causes the left row to multiply ($1 \\times N$), a Semi-Join (implemented with `WHERE EXISTS (...)` or `WHERE id IN (...)`) preserves the unique cardinality of the left table.",
    detailedAnswer: "Semi-Join Characteristics:\n1. Operator: Denoted mathematically as $A \\ltimes B$.\n2. Behavior: As soon as the executor finds the first matching row in table B for a row in table A, it emits row A and stops probing table B for that row (early exit).\n3. Eliminating DISTINCT: Developers often write `SELECT DISTINCT c.* FROM customers c JOIN orders o ...` to avoid row multiplication; replacing it with a Semi-Join `WHERE EXISTS` eliminates the expensive sorting/hashing overhead of `DISTINCT`.",
    code: `-- 1. BAD: INNER JOIN causes row duplication, requiring expensive DISTINCT!
SELECT DISTINCT c.customer_id, c.company_name
FROM customers c
INNER JOIN orders o ON c.customer_id = o.customer_id;

-- 2. OPTIMAL: Semi-Join via EXISTS (Zero row multiplication, early exit!)
SELECT c.customer_id, c.company_name
FROM customers c
WHERE EXISTS (
    SELECT 1 
    FROM orders o 
    WHERE o.customer_id = c.customer_id
);`,
    recallHint: "Semi-Join returns left rows that have a match without multiplying rows; use EXISTS instead of INNER JOIN + DISTINCT.",
    interviewTip: "Whenever you see `SELECT DISTINCT` used after an `INNER JOIN`, point out that rewriting it to a Semi-Join with `EXISTS` improves performance by skipping duplicate generation.",
    tags: ["semi-join", "exists", "row-multiplication", "distinct-elimination", "relational-algebra"]
  }),

  createCard({
    idNum: 35,
    category: "Joins & Set Operations",
    concept: "Set Operations: UNION vs UNION ALL (The Deduplication Penalty)",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is the operational difference between UNION and UNION ALL, and why is UNION ALL substantially faster?",
    quickAnswer: "`UNION ALL` concatenates two or more result sets together directly, preserving all rows including duplicates with zero overhead. `UNION` (without ALL) concatenates the sets and then performs an expensive deduplication sort or hash across all projected columns to remove duplicate rows. In production, `UNION ALL` should ALWAYS be preferred unless duplicate removal is strictly required by the business logic.",
    detailedAnswer: "Performance & Type Rules:\n1. Sorting Penalty: `UNION` requires sorting the combined dataset or building an in-memory hash table, causing high CPU consumption and disk spills on large datasets.\n2. Column Alignment: Both queries in a set operation must project the exact same number of columns, with compatible data types in positional order.\n3. Column Names: The final result set inherits column names from the FIRST query in the union.\n4. `ORDER BY` Placement: An `ORDER BY` clause can only appear once at the very end of the statement to sort the combined result set.",
    code: `-- 1. FAST: UNION ALL (Direct concatenation, no deduplication sort)
SELECT employee_id, full_name, 'ACTIVE' AS source FROM active_employees
UNION ALL
SELECT contractor_id, contractor_name, 'CONTRACTOR' FROM active_contractors;

-- 2. EXPENSIVE: UNION (Forces sort/hash deduplication across all columns)
SELECT email FROM customer_leads
UNION
SELECT email FROM newsletter_subscribers;

-- Global sorting applied to the combined result
SELECT id, name FROM archived_users
UNION ALL
SELECT id, name FROM current_users
ORDER BY name ASC; -- Applies to the final merged stream`,
    recallHint: "UNION ALL concatenates directly (fast); UNION sorts and deduplicates (slow); always default to UNION ALL.",
    interviewTip: "State the rule: 'Always use UNION ALL unless business requirements explicitly dictate deduplication, because UNION imposes a hidden $O(N \\log N)$ sort overhead.'",
    tags: ["union", "union-all", "set-operations", "deduplication-penalty", "query-performance"]
  }),

  createCard({
    idNum: 36,
    category: "Joins & Set Operations",
    concept: "Set Operations: INTERSECT and EXCEPT / MINUS",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do INTERSECT and EXCEPT (MINUS) operate in ANSI SQL, and how do their ALL variants behave?",
    quickAnswer: "`INTERSECT` returns only the distinct rows that appear in **both** query result sets (set intersection $A \\cap B$). `EXCEPT` (called `MINUS` in Oracle) returns all distinct rows from the first query that **do not appear** in the second query (set difference $A \\setminus B$). Both perform implicit deduplication unless their `ALL` variant (`INTERSECT ALL`, `EXCEPT ALL`) is supported by the engine.",
    detailedAnswer: "Behavior & Rules:\n1. `INTERSECT`: If a row appears 3 times in A and 2 times in B, `INTERSECT` returns it once. `INTERSECT ALL` returns it $\\min(M, N) = 2$ times.\n2. `EXCEPT`: If a row appears in A, any occurrence of that row in B removes it from the output entirely. `EXCEPT ALL` subtracts frequencies: if it appears 3 times in A and 1 time in B, it is returned $3 - 1 = 2$ times.\n3. Alternative Formulations: `INTERSECT` can be rewritten as `INNER JOIN` or `EXISTS`; `EXCEPT` can be rewritten as `NOT EXISTS`.",
    code: `-- 1. INTERSECT: Find customers who have made purchases in BOTH 2025 and 2026
SELECT customer_id FROM orders_2025
INTERSECT
SELECT customer_id FROM orders_2026;

-- 2. EXCEPT: Find customers who made purchases in 2025 but NOT in 2026 (Churned)
SELECT customer_id FROM orders_2025
EXCEPT
SELECT customer_id FROM orders_2026;

-- Equivalent rewrite of EXCEPT using NOT EXISTS:
SELECT DISTINCT a.customer_id 
FROM orders_2025 a
WHERE NOT EXISTS (SELECT 1 FROM orders_2026 b WHERE b.customer_id = a.customer_id);`,
    recallHint: "INTERSECT = rows in both sets; EXCEPT (MINUS) = rows in first set but not second; both deduplicate by default.",
    interviewTip: "Note dialect vocabulary: ANSI SQL and PostgreSQL/SQL Server use `EXCEPT`, whereas Oracle uses `MINUS` for the exact same set difference operation.",
    tags: ["intersect", "except", "minus", "set-theory", "set-difference"]
  })
];

module.exports = cards;
