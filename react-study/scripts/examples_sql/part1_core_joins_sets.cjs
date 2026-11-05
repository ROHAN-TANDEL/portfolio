module.exports = [
  {
    id: "sql-ex-01",
    title: "Multi-Table Inner Join with Aliasing & Foreign Key Traversal",
    category: "Standard Joins & Set Operations",
    difficulty: "beginner",
    whatThisCodeCovers: "Traverses a normalized 3-tier relational schema (customers -> orders -> order_items -> products) to aggregate customer purchases without data duplication.",
    conceptsCovered: [
      "Explicit INNER JOIN",
      "Table Aliasing",
      "Referential Integrity Traversal",
      "Compound Filtering"
    ],
    code: `-- Querying customer order lines across normalized relational boundaries
SELECT 
    c.customer_id,
    c.full_name,
    o.order_id,
    o.order_date,
    p.product_name,
    oi.quantity,
    oi.unit_price,
    (oi.quantity * oi.unit_price) AS line_total
FROM customers c
INNER JOIN orders o 
    ON c.customer_id = o.customer_id
INNER JOIN order_items oi 
    ON o.order_id = oi.order_id
INNER JOIN products p 
    ON oi.product_id = p.product_id
WHERE o.order_status = 'COMPLETED'
  AND o.order_date >= '2026-01-01'
ORDER BY o.order_date DESC, oi.item_id ASC;`,
    breakdown: [
      "Uses ANSI explicit INNER JOIN syntax with clear ON predicates instead of legacy comma-joins in WHERE.",
      "Traverses foreign keys from customers down to line items and dimension products in logical order.",
      "Performs inline arithmetic (quantity * unit_price) on projection without modifying base relations.",
      "Applies deterministic multi-column sorting (order_date DESC, item_id ASC)."
    ],
    expectedOutput: `customer_id | full_name   | order_id | order_date | product_name   | quantity | unit_price | line_total
101         | Alice Smith | 5001     | 2026-02-15 | PostgreSQL Pro | 2        | 49.99      | 99.98
102         | Bob Jones   | 5002     | 2026-02-14 | ANSI SQL Guide | 1        | 39.50      | 39.50`
  },
  {
    id: "sql-ex-02",
    title: "Left Outer Join with IS NULL Filter for Unmatched Records (Anti-Join Pattern)",
    category: "Standard Joins & Set Operations",
    difficulty: "beginner",
    whatThisCodeCovers: "Detects dormant or orphan records by preserving all left-table rows and filtering for NULLs generated on the unmatched right side.",
    conceptsCovered: [
      "LEFT OUTER JOIN",
      "IS NULL Filtering",
      "Orphan Record Detection",
      "Relational Difference"
    ],
    code: `-- Find all registered customers who have never placed a single order
SELECT 
    c.customer_id,
    c.email,
    c.registered_at
FROM customers c
LEFT OUTER JOIN orders o 
    ON c.customer_id = o.customer_id
WHERE o.order_id IS NULL;`,
    breakdown: [
      "LEFT OUTER JOIN preserves every row from customers, populating order columns with NULL if no match exists.",
      "The WHERE o.order_id IS NULL clause filters out any customer who had matching orders.",
      "Testing the right table's primary key (order_id) guarantees NULL means 'no record found', not an optional attribute with NULL.",
      "A classic relational difference pattern implemented via join mechanics."
    ],
    expectedOutput: `customer_id | email               | registered_at
204         | inactive@acme.com   | 2025-11-10 09:12:00
319         | newuser@domain.org  | 2026-01-04 14:30:22`
  },
  {
    id: "sql-ex-03",
    title: "High-Performance Anti-Join using NOT EXISTS vs NOT IN with Nullable Columns",
    category: "Subqueries & Relational Existence",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates safe relational exclusion using NOT EXISTS to avoid the three-valued logic (3VL) trap where NOT IN with a single NULL yields zero rows.",
    conceptsCovered: [
      "NOT EXISTS Subquery",
      "Three-Valued Logic Defense",
      "Anti-Join Optimization",
      "Correlated Execution"
    ],
    code: `-- Safe and high-performance search for departments without active staff
-- (NOT IN (SELECT ...) would return 0 rows if any employee had department_id IS NULL)
SELECT 
    d.department_id,
    d.department_name
FROM departments d
WHERE NOT EXISTS (
    SELECT 1 
    FROM employees e 
    WHERE e.department_id = d.department_id
);`,
    breakdown: [
      "NOT EXISTS evaluates whether the correlated inner query returns at least one row, terminating immediately upon first match (short-circuit).",
      "Immune to NULLs: Even if employees contains NULL department_id rows, NOT EXISTS evaluates accurately based on boolean existence.",
      "SELECT 1 inside the subquery emphasizes that no actual columns need to be projected from the inner table.",
      "The optimizer transforms this correlated subquery into an optimized hash anti-join or merge anti-join."
    ],
    expectedOutput: `department_id | department_name
14            | Research & Exploration
22            | Strategic Acquisitions`
  },
  {
    id: "sql-ex-04",
    title: "Semi-Join Pattern with EXISTS for Conditional Parent Selection",
    category: "Subqueries & Relational Existence",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses a semi-join via EXISTS to filter parent entities based on child attributes without duplicating parent rows or requiring costly DISTINCT operations.",
    conceptsCovered: [
      "Semi-Join Semantics",
      "EXISTS Operator",
      "Deduplication Prevention",
      "Cardinality Preservation"
    ],
    code: `-- Find all customers who have placed at least one high-value order (> $1000)
-- Retaining exact 1-to-1 customer cardinality without using DISTINCT
SELECT 
    c.customer_id,
    c.full_name,
    c.tier
FROM customers c
WHERE EXISTS (
    SELECT 1 
    FROM orders o
    WHERE o.customer_id = c.customer_id
      AND o.total_amount > 1000.00
);`,
    breakdown: [
      "If solved with INNER JOIN, customers with 5 high-value orders would appear 5 times, requiring a wasteful DISTINCT.",
      "EXISTS implements relational semi-join semantics: it preserves the exact row set of the left table without row expansion.",
      "Stops scanning child records as soon as one order with total_amount > 1000 is encountered for that customer.",
      "Preserves index seeks on (customer_id, total_amount)."
    ],
    expectedOutput: `customer_id | full_name     | tier
101         | Global Tech   | ENTERPRISE
108         | Apex Logistics| VIP`
  },
  {
    id: "sql-ex-05",
    title: "Full Outer Join with COALESCE for Symmetrical Discrepancy Auditing",
    category: "Standard Joins & Set Operations",
    difficulty: "intermediate",
    whatThisCodeCovers: "Performs full reconciliation between an internal ledger and an external bank statement, identifying matching records, missing bank deposits, and missing internal entries.",
    conceptsCovered: [
      "FULL OUTER JOIN",
      "COALESCE Value Resolution",
      "CASE Reconciliation Tagging",
      "Audit Discrepancy Analysis"
    ],
    code: `-- Symmetrical financial ledger reconciliation
SELECT 
    COALESCE(l.transaction_ref, b.transaction_ref) AS transaction_ref,
    l.amount AS ledger_amount,
    b.amount AS bank_amount,
    CASE 
        WHEN l.transaction_ref IS NOT NULL AND b.transaction_ref IS NOT NULL THEN 'MATCHED'
        WHEN l.transaction_ref IS NOT NULL AND b.transaction_ref IS NULL THEN 'MISSING_IN_BANK'
        ELSE 'MISSING_IN_LEDGER'
    END AS reconciliation_status
FROM internal_ledger l
FULL OUTER JOIN bank_statement b 
    ON l.transaction_ref = b.transaction_ref
WHERE l.transaction_ref IS NULL 
   OR b.transaction_ref IS NULL 
   OR l.amount <> b.amount;`,
    breakdown: [
      "FULL OUTER JOIN retains all rows from both tables, pairing matches and padding missing entries with NULL.",
      "COALESCE ensures that whichever side supplied the transaction_ref is projected cleanly.",
      "A CASE expression classifies each record into matched, missing-in-bank, or missing-in-ledger states.",
      "Filtering for mismatches or amount discrepancies extracts the exact audit discrepancy report."
    ],
    expectedOutput: `transaction_ref | ledger_amount | bank_amount | reconciliation_status
TXN-901         | 450.00        | NULL        | MISSING_IN_BANK
TXN-902         | NULL          | 1200.00     | MISSING_IN_LEDGER
TXN-903         | 100.00        | 95.00       | MATCHED`
  },
  {
    id: "sql-ex-06",
    title: "Self-Join for Hierarchical Parent-Child Lookups Without CTEs",
    category: "Standard Joins & Set Operations",
    difficulty: "intermediate",
    whatThisCodeCovers: "Joins an employee table to itself on manager_id = employee_id to retrieve employees alongside their immediate supervisor's details.",
    conceptsCovered: [
      "Self-Join",
      "Role-Based Table Aliases",
      "Hierarchical Adjacency",
      "Root Node Handling"
    ],
    code: `-- Retrieve employee name along with their direct manager's name
SELECT 
    e.employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    e.job_title,
    COALESCE(m.first_name || ' ' || m.last_name, '[Top Executive / Board]') AS manager_name
FROM employees e
LEFT OUTER JOIN employees m 
    ON e.manager_id = m.employee_id
ORDER BY e.manager_id NULLS FIRST, e.employee_id;`,
    breakdown: [
      "Aliasing the employees table as 'e' (worker) and 'm' (manager) allows querying hierarchical adjacency in standard SQL.",
      "LEFT OUTER JOIN is required because the CEO or top executives have manager_id IS NULL.",
      "COALESCE provides a descriptive fallback label for root nodes.",
      "Standard SQL string concatenation (||) formats full names."
    ],
    expectedOutput: `employee_id | employee_name  | job_title      | manager_name
1           | Sarah Connor   | Chief Exec     | [Top Executive / Board]
2           | John Reese     | VP Engineering | Sarah Connor
3           | Harold Finch   | Lead Architect | John Reese`
  },
  {
    id: "sql-ex-07",
    title: "Non-Equi Join for Historical Date-Range & Currency Exchange Rate Matching",
    category: "Standard Joins & Set Operations",
    difficulty: "intermediate",
    whatThisCodeCovers: "Joins sales transactions to an effective-dated currency rate dimension using inequality operators (BETWEEN) to accurately convert amounts to USD.",
    conceptsCovered: [
      "Non-Equi JOIN",
      "BETWEEN Range Predicate",
      "Effective Dating / Temporal Matching",
      "Currency Normalization"
    ],
    code: `-- Join international orders with historical daily currency conversion rates
SELECT 
    o.order_id,
    o.order_date,
    o.currency_code,
    o.local_amount,
    r.exchange_rate_to_usd,
    ROUND(o.local_amount * r.exchange_rate_to_usd, 2) AS amount_usd
FROM orders o
INNER JOIN currency_rates r 
    ON o.currency_code = r.currency_code
   AND o.order_date BETWEEN r.effective_from AND r.effective_to
WHERE o.currency_code <> 'USD';`,
    breakdown: [
      "Unlike equi-joins that compare with '=' non-equi joins use range boundaries like BETWEEN.",
      "Matches the exact currency rate record whose effective date span covers the transaction's order_date.",
      "Enforces temporal consistency without mutating historic order records when exchange rates change.",
      "Rounds resulting financial values to 2 decimal places per standard accounting guidelines."
    ],
    expectedOutput: `order_id | order_date | currency_code | local_amount | exchange_rate_to_usd | amount_usd
8801     | 2026-03-01 | EUR           | 100.00       | 1.0850               | 108.50
8802     | 2026-03-02 | JPY           | 15000.00     | 0.0067               | 100.50`
  },
  {
    id: "sql-ex-08",
    title: "Cross Join for Dimension Matrix Cartesian Expansion (Grid Generation)",
    category: "Standard Joins & Set Operations",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs a full reporting grid (all branches cross all calendar quarters) combined with a LEFT JOIN to ensure quarters with zero sales are reported as 0 rather than omitted.",
    conceptsCovered: [
      "CROSS JOIN",
      "Cartesian Product Utility",
      "Sparse Data Densification",
      "COALESCE Zero Padding"
    ],
    code: `-- Dense quarterly sales grid across all retail branches
WITH branch_quarters AS (
    SELECT 
        b.branch_id,
        b.branch_name,
        q.quarter_name,
        q.start_date,
        q.end_date
    FROM branches b
    CROSS JOIN fiscal_quarters q
)
SELECT 
    bq.branch_name,
    bq.quarter_name,
    COALESCE(SUM(s.sale_amount), 0.00) AS total_revenue
FROM branch_quarters bq
LEFT OUTER JOIN sales s 
    ON bq.branch_id = s.branch_id
   AND s.sale_date BETWEEN bq.start_date AND bq.end_date
GROUP BY bq.branch_name, bq.quarter_name
ORDER BY bq.branch_name, bq.quarter_name;`,
    breakdown: [
      "CROSS JOIN generates the Cartesian product of M branches and N quarters (M * N dimension cells).",
      "LEFT OUTER JOIN attaches actual sales figures to the Cartesian grid.",
      "COALESCE(SUM(...), 0.00) ensures branches with no sales in a given quarter yield a clear 0.00 instead of vanishing from reports.",
      "Standard pattern for financial and BI reporting dashboards requiring zero-filled timelines."
    ],
    expectedOutput: `branch_name | quarter_name | total_revenue
Downtown    | 2026-Q1      | 245000.00
Downtown    | 2026-Q2      | 0.00
Uptown      | 2026-Q1      | 185000.00`
  },
  {
    id: "sql-ex-09",
    title: "Set Operations: UNION ALL vs UNION Deduplication Performance Benchmark",
    category: "Standard Joins & Set Operations",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates when to use UNION ALL (fast concatenation without sort-unique overhead) versus UNION (strict mathematical set deduplication).",
    conceptsCovered: [
      "UNION vs UNION ALL",
      "Deduplication Sorting Overhead",
      "Schema Alignment in Set Ops",
      "Data Pipeline Merging"
    ],
    code: `-- 1. UNION ALL: Concatenate archive and active tables without expensive deduplication
SELECT order_id, customer_id, order_date, total_amount, 'ACTIVE' AS source
FROM current_orders
WHERE order_date >= '2026-01-01'

UNION ALL

SELECT order_id, customer_id, order_date, total_amount, 'ARCHIVE' AS source
FROM historical_orders
WHERE order_date >= '2025-01-01'
ORDER BY order_date DESC;

-- 2. UNION: Required when combining two distinct contact lists to eliminate duplicates
SELECT email FROM customer_contacts
UNION
SELECT email FROM newsletter_subscribers;`,
    breakdown: [
      "UNION ALL simply appends result sets, running in O(N + M) time with zero sorting or hash tables required.",
      "UNION enforces distinctness across all projected columns, requiring an O(N log N) sort or hash-unique operation.",
      "Defaulting to UNION ALL unless duplicates are strictly impossible to tolerate is a key SQL performance rule.",
      "Column counts and data types must match positionally in both branches."
    ],
    expectedOutput: `order_id | customer_id | order_date | total_amount | source
9001     | 104         | 2026-03-01 | 150.00       | ACTIVE
4002     | 104         | 2025-12-20 | 220.00       | ARCHIVE`
  },
  {
    id: "sql-ex-10",
    title: "Set Operations: INTERSECT for Strict Audience Overlap Verification",
    category: "Standard Joins & Set Operations",
    difficulty: "intermediate",
    whatThisCodeCovers: "Finds the exact intersection of customer IDs who have made purchases in both 2025 and 2026 using the ANSI INTERSECT operator.",
    conceptsCovered: [
      "INTERSECT Operator",
      "Relational Conjunction",
      "Cohort Retention Analysis",
      "Set-Theoretic Filtering"
    ],
    code: `-- Identify loyal customers who transacted in both fiscal year 2025 AND fiscal year 2026
SELECT customer_id 
FROM orders 
WHERE order_date >= '2025-01-01' AND order_date < '2026-01-01'

INTERSECT

SELECT customer_id 
FROM orders 
WHERE order_date >= '2026-01-01' AND order_date < '2027-01-01';`,
    breakdown: [
      "INTERSECT returns only values that appear in both the left query result and the right query result.",
      "Automatically eliminates duplicates from the intersection set.",
      "Provides a clean set-theoretic alternative to self-joins or correlated subqueries for cohort retention.",
      "Both queries must project the identical number of compatible data types."
    ],
    expectedOutput: `customer_id
101
105
209`
  },
  {
    id: "sql-ex-11",
    title: "Set Operations: EXCEPT / MINUS for Change Data Capture (CDC) Set Comparison",
    category: "Standard Joins & Set Operations",
    difficulty: "intermediate",
    whatThisCodeCovers: "Identifies rows that exist in the staging dataset but are completely absent from the production warehouse using the EXCEPT (MINUS) relational operator.",
    conceptsCovered: [
      "EXCEPT / MINUS Operator",
      "Relational Difference",
      "Change Data Capture Validation",
      "Data Synchronization Auditing"
    ],
    code: `-- Find newly added or altered product catalog SKUs in staging not yet in production
SELECT sku, product_name, category_id, base_price 
FROM staging_product_catalog

EXCEPT

SELECT sku, product_name, category_id, base_price 
FROM production_product_catalog;`,
    breakdown: [
      "EXCEPT (called MINUS in Oracle) returns all distinct rows from the first query that do not exist in the second query.",
      "Compares every projected column across both relations simultaneously.",
      "Ideal for quick sanity checks during batch ETL migrations to detect unsynced delta records.",
      "Unlike ANTI-JOIN, compares all columns as an entirety rather than relying on key equality."
    ],
    expectedOutput: `sku         | product_name           | category_id | base_price
SKU-9901-X  | Ultra Ergonomic Mouse  | 3           | 79.99
SKU-9942-Z  | Mechanical Keycaps V2  | 3           | 24.50`
  }
];
