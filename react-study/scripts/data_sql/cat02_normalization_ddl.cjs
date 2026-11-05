const { createCard } = require("../sql_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 13,
    category: "Database Design & Normalization",
    concept: "Functional Dependencies and Candidate Keys",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a Functional Dependency in relational database theory, and how does it define Candidate Keys?",
    quickAnswer: "A Functional Dependency ($X \\to Y$) is a constraint between two sets of attributes: given any two tuples in a relation, if their values for attribute set $X$ are equal, their values for attribute set $Y$ must also be equal ($X$ uniquely determines $Y$). A **Candidate Key** is a minimal superkey: a minimal set of attributes that functionally determines all other attributes in the relation with zero extraneous attributes.",
    detailedAnswer: "Relational Theory Definitions:\n1. Functional Dependency ($X \\to Y$): $X$ is the determinant, and $Y$ is functionally dependent on $X$. Example: `SSN -> FullName, DateOfBirth`.\n2. Superkey: Any set of attributes that uniquely identifies every tuple in the relation.\n3. Candidate Key: A Superkey that is minimal (removing any single attribute destroys its uniqueness property).\n4. Primary Key: The single Candidate Key chosen by the database architect as the principal identifier for the relation.\n5. Alternate Keys: Candidate keys that were not chosen as the Primary Key (enforced with `UNIQUE NOT NULL`).",
    code: `-- Example: Candidate Keys and Functional Dependencies
-- In this relation, email -> user_id, name, created_at
-- And user_id -> email, name, created_at
-- Both (user_id) and (email) are Candidate Keys!

CREATE TABLE user_accounts (
    user_id INT PRIMARY KEY,              -- Chosen Primary Key
    email VARCHAR(255) NOT NULL UNIQUE,   -- Alternate Candidate Key
    full_name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);`,
    recallHint: "X -> Y means X uniquely determines Y; Candidate Key is a minimal superkey that determines the entire row.",
    interviewTip: "Be ready to explain the difference between a Superkey (any unique identifier, even with extra columns) vs a Candidate Key (strictly minimal).",
    tags: ["functional-dependency", "candidate-key", "superkey", "normalization", "relational-theory"]
  }),

  createCard({
    idNum: 14,
    category: "Database Design & Normalization",
    concept: "First Normal Form (1NF): Atomic Values & Elimination of Repeating Groups",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the core requirements of First Normal Form (1NF), and what constitutes a violation?",
    quickAnswer: "A table is in First Normal Form (1NF) if and only if: 1) Every attribute contains only atomic (indivisible) scalar values (no comma-separated strings or embedded arrays); 2) There are no repeating groups or numbered columns (e.g. `phone1`, `phone2`, `phone3`); and 3) Each row is unique, enforced by an identified primary key.",
    detailedAnswer: "1NF Violations and Fixes:\n- Violation 1 (Non-Atomic Values): Storing `tags = 'sql,db,tech'` in a single text column. It violates 1NF because searching for 'db' requires substring operations (`LIKE '%db%'`) that cannot use relational indexes.\n  - Fix: Normalize into a child table with one tag per row.\n- Violation 2 (Repeating Groups): Columns `skill_1`, `skill_2`, `skill_3`. Violates 1NF because adding a 4th skill requires altering the table DDL, and querying requires clumsy `WHERE skill_1 = 'SQL' OR skill_2 = 'SQL'...`.\n  - Fix: Extract into a child table `employee_skills (employee_id, skill_name)`.",
    code: `-- VIOLATION OF 1NF (Non-atomic comma strings and repeating columns)
-- CREATE TABLE bad_employees (
--     emp_id INT,
--     skills VARCHAR(255), -- 'SQL, Node, React' (Non-atomic!)
--     phone_1 VARCHAR(20), -- Repeating group!
--     phone_2 VARCHAR(20)
-- );

-- NORMALIZED TO 1NF:
CREATE TABLE employees (
    emp_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE employee_skills (
    emp_id INT NOT NULL,
    skill VARCHAR(50) NOT NULL,
    PRIMARY KEY (emp_id, skill),
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);`,
    recallHint: "1NF requires atomic scalar values, no repeating columns (phone1, phone2), and a primary key.",
    interviewTip: "Point out that storing comma-separated values in relational databases breaks 1NF and destroys query optimization and referential integrity.",
    tags: ["1nf", "first-normal-form", "atomicity", "repeating-groups", "database-design"]
  }),

  createCard({
    idNum: 15,
    category: "Database Design & Normalization",
    concept: "Second Normal Form (2NF): Elimination of Partial Functional Dependencies",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is Second Normal Form (2NF), and when does a partial functional dependency occur?",
    quickAnswer: "A relation is in Second Normal Form (2NF) if it is in 1NF and contains **NO partial functional dependencies**: every non-key attribute must depend on the **entire candidate key**, not just a subset of it. Partial dependencies can ONLY occur when a table has a **composite primary key** (a primary key made up of two or more columns).",
    detailedAnswer: "2NF Mechanics:\n- Prerequisite: If a table has a single-column primary key, it is AUTOMATICALLY in 2NF once it satisfies 1NF!\n- The Violation: Consider `order_items (order_id, product_id, quantity, product_name, unit_price)` with composite PK `(order_id, product_id)`.\n  - `quantity` depends on BOTH `order_id` AND `product_id` (full dependency).\n  - `product_name` and `unit_price` depend ONLY on `product_id` (partial dependency on part of the composite key!).\n- Anomalies Caused: Redundant storage of product names, update anomalies (updating price requires updating 1,000 order rows), and deletion anomalies.\n- 2NF Resolution: Split into two tables: `products (product_id, name, price)` and `order_items (order_id, product_id, quantity)`.",
    code: `-- 2NF DECOMPOSITION
-- 1. Products table (Attributes depend fully on product_id)
CREATE TABLE products (
    product_id INT PRIMARY KEY,
    product_name VARCHAR(100) NOT NULL,
    unit_price NUMERIC(10, 2) NOT NULL
);

-- 2. Order items table (quantity depends on BOTH order_id and product_id)
CREATE TABLE order_items (
    order_id INT NOT NULL,
    product_id INT NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    PRIMARY KEY (order_id, product_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id)
);`,
    recallHint: "2NF eliminates partial dependencies; only applies to composite keys; every non-key column must depend on the whole primary key.",
    interviewTip: "Remember the classic mnemonic: 'Every attribute must depend on the key [1NF], the whole key [2NF], and nothing but the key [3NF], so help me Codd.'",
    tags: ["2nf", "second-normal-form", "partial-dependency", "composite-keys", "normalization"]
  }),

  createCard({
    idNum: 16,
    category: "Database Design & Normalization",
    concept: "Third Normal Form (3NF): Elimination of Transitive Dependencies",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is Third Normal Form (3NF) and how do transitive functional dependencies introduce data anomalies?",
    quickAnswer: "A relation is in Third Normal Form (3NF) if it is in 2NF and contains **NO transitive dependencies**: non-key attributes must NOT depend on other non-key attributes. A transitive dependency occurs when attribute $A$ determines non-key attribute $B$, which in turn determines non-key attribute $C$ ($A \\to B \\to C$). In 3NF, every non-key attribute must depend directly on the primary key, and 'nothing but the key'.",
    detailedAnswer: "3NF Violation Anatomy:\n- Example: `orders (order_id, customer_id, customer_name, customer_city)`.\n  - `order_id -> customer_id` (Primary Key relationship).\n  - `customer_id -> customer_name, customer_city` (Non-key determining other non-keys!).\n  - Therefore, `order_id -> customer_name` is a transitive dependency through `customer_id`.\n- Resulting Anomalies:\n  - Insertion Anomaly: You cannot record a customer without creating a dummy order.\n  - Deletion Anomaly: Deleting the last order for a customer deletes the customer's record and address.\n  - Update Anomaly: If a customer moves, you must update their city across every historical order.\n- 3NF Fix: Decompose into `customers (customer_id, name, city)` and `orders (order_id, customer_id)`.",
    code: `-- 3NF DECOMPOSITION
-- 1. Customers Table (No transitive dependencies)
CREATE TABLE customers (
    customer_id INT PRIMARY KEY,
    customer_name VARCHAR(100) NOT NULL,
    city VARCHAR(100) NOT NULL
);

-- 2. Orders Table (order_id determines customer_id directly)
CREATE TABLE orders (
    order_id INT PRIMARY KEY,
    customer_id INT NOT NULL,
    order_date DATE NOT NULL,
    total_amount NUMERIC(10, 2) NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id)
);`,
    recallHint: "3NF eliminates transitive dependencies (A -> B -> C); non-key columns cannot depend on other non-key columns.",
    interviewTip: "Recite the rule: 'Every attribute must depend on the key (1NF), the whole key (2NF), and nothing but the key (3NF)'.",
    tags: ["3nf", "third-normal-form", "transitive-dependency", "normalization", "update-anomalies"]
  }),

  createCard({
    idNum: 17,
    category: "Database Design & Normalization",
    concept: "Boyce-Codd Normal Form (BCNF): Strict Determinant Candidate Keys",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Boyce-Codd Normal Form (BCNF) differ from 3NF, and when is 3NF insufficient?",
    quickAnswer: "Boyce-Codd Normal Form (BCNF, or 3.5NF) is a stricter version of 3NF. A relation is in BCNF if and only if **for every non-trivial functional dependency ($X \\to Y$), $X$ is a Superkey**. While 3NF permits $Y$ to be part of a candidate key (prime attribute) even if $X$ is not a superkey, BCNF strictly eliminates all functional dependencies where the determinant is not a candidate key.",
    detailedAnswer: "When 3NF Fails but BCNF is Needed:\n- Conditions for Divergence: Occurs when a table has multiple overlapping composite candidate keys.\n- Classic Example: `advising (student_id, subject, professor)`.\n  - Rule 1: A student has one professor per subject: `(student_id, subject) -> professor`.\n  - Rule 2: Each professor teaches only ONE subject: `professor -> subject`.\n  - Candidate Keys: `(student_id, subject)` and `(student_id, professor)`.\n  - Is it in 3NF? YES, because in `professor -> subject`, `subject` is a prime attribute (part of candidate key `(student_id, subject)`).\n  - Is it in BCNF? NO! In `professor -> subject`, `professor` is NOT a superkey (it cannot identify the student!).\n  - BCNF Fix: Split into `professor_subject (professor, subject)` and `student_professor (student_id, professor)`.",
    code: `-- BCNF Decomposition of Overlapping Candidate Keys
-- Table 1: Every determinant is a candidate key
CREATE TABLE professor_assignment (
    professor_id INT PRIMARY KEY,
    subject_code VARCHAR(20) NOT NULL
);

-- Table 2: Student advisor enrollment
CREATE TABLE student_advising (
    student_id INT NOT NULL,
    professor_id INT NOT NULL,
    PRIMARY KEY (student_id, professor_id),
    FOREIGN KEY (professor_id) REFERENCES professor_assignment(professor_id)
);`,
    recallHint: "BCNF requires every determinant (X in X -> Y) to be a superkey; fixes anomalies when tables have overlapping composite candidate keys.",
    interviewTip: "Remember that BCNF can sometimes sacrifice dependency preservation (checking dependencies across tables requires a join or trigger).",
    tags: ["bcnf", "boyce-codd", "prime-attributes", "overlapping-candidate-keys", "advanced-normalization"]
  }),

  createCard({
    idNum: 18,
    category: "Database Design & Normalization",
    concept: "Intentional Denormalization: OLTP vs OLAP Architectural Trade-offs",
    priority: "must-know",
    difficulty: "advanced",
    question: "When is intentional database denormalization justified, and what are the trade-offs between OLTP and OLAP architectures?",
    quickAnswer: "While 3NF normalization minimizes data redundancy and prevents update/delete anomalies in write-heavy **OLTP** (Online Transaction Processing) systems, high normalization requires expensive multi-table joins. In read-heavy **OLAP** (Online Analytical Processing) systems and reporting data warehouses, intentional denormalization (pre-calculating totals, Star Schemas, duplicating lookup names) reduces joins and dramatically speeds up complex analytical queries at the expense of write amplification and increased storage.",
    detailedAnswer: "Comparison Matrix:\n- Normalized OLTP (3NF):\n  - Primary Goal: Zero data anomalies, fast atomic single-row inserts/updates.\n  - Read Cost: Queries join 6-10 tables, causing high CPU join overhead.\n- Denormalized OLAP (Star / Snowflake Schema):\n  - Primary Goal: Maximum read performance across millions of historical rows.\n  - Architecture: Central Fact tables (sales metrics) surrounded by wide Dimension tables (pre-joined customer, date, store metadata).\n  - Write Cost: Batch ETL updates; risk of inconsistency if partial updates occur.\n- Production Rule: Never denormalize OLTP transactional source-of-truth tables prematurely; maintain 3NF for ACID writes and replicate to read-optimized read models or analytical stores.",
    code: `-- 1. OLTP Normalized: 3NF (Orders separate from customer metadata)
SELECT o.order_id, o.amount, c.company_name, c.tax_rate
FROM orders o
JOIN customers c ON c.customer_id = o.customer_id
WHERE o.order_id = 100;

-- 2. OLAP Denormalized Fact Record (Pre-joined attributes for instant aggregation)
CREATE TABLE fact_daily_sales (
    sale_id BIGINT PRIMARY KEY,
    date_key INT NOT NULL,
    customer_region VARCHAR(50) NOT NULL, -- Duplicated from customer dimension
    product_category VARCHAR(50) NOT NULL, -- Duplicated from product dimension
    revenue NUMERIC(12, 2) NOT NULL,
    tax_amount NUMERIC(12, 2) NOT NULL
);`,
    recallHint: "Normalize for OLTP to prevent write anomalies; denormalize for OLAP (Star Schema) to eliminate expensive analytical joins.",
    interviewTip: "Demonstrate nuance: don't call denormalization 'bad'—explain that it is an intentional engineering compromise between write purity and read throughput.",
    tags: ["denormalization", "oltp-vs-olap", "star-schema", "performance-tradeoffs", "data-warehousing"]
  }),

  createCard({
    idNum: 19,
    category: "Database Design & Normalization",
    concept: "Primary Key Architecture: Natural Keys vs Surrogate Keys vs UUIDs",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the trade-offs between Natural Keys, Surrogate Auto-Increment Keys, and UUIDs for Primary Key design?",
    quickAnswer: "**Natural Keys** use existing real-world business attributes (e.g. SSN, ISBN), saving storage but causing cascading update nightmares if business identifiers change. **Surrogate Auto-Increment Keys** (`INT`/`BIGINT`) are synthetic, compact (4/8 bytes), highly performant for B-Tree indexing, but centralized. **UUIDs** (16 bytes) enable decentralized client-side ID generation across distributed microservices, but random UUIDv4 causes severe B-Tree index fragmentation and storage bloat.",
    detailedAnswer: "Architecture Breakdown:\n1. Natural Keys: Prone to schema lock-in (e.g. using `email` as PK breaks when a customer changes their email address, forcing foreign key updates across 20 tables).\n2. Surrogate Integers (`BIGSERIAL`, `AUTO_INCREMENT`):\n   - Pros: Smallest storage, sequential append preserves B-Tree leaf locality, fastest joins.\n   - Cons: Predictable (vulnerable to URL enumeration attacks `GET /invoices/42`), requires database roundtrip to generate.\n3. UUIDs (`UUIDv4` vs `UUIDv7`):\n   - Pros: Globally unique, can be generated offline in client/mobile apps without DB roundtrips.\n   - Cons: 16 bytes (2x-4x larger than INT); random UUIDv4 causes B-Tree page splits. Time-ordered UUIDv7 resolves fragmentation.",
    code: `-- 1. Surrogate Auto-Increment Primary Key (Optimal for internal OLTP)
CREATE TABLE orders (
    order_id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    customer_id INT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL
);

-- 2. Public UUID identifier combined with internal integer surrogate
CREATE TABLE secure_invoices (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY, -- Internal compact join key
    public_uuid UUID NOT NULL UNIQUE,                   -- Public API token (prevents enumeration)
    amount NUMERIC(10, 2) NOT NULL
);`,
    recallHint: "Natural = business attribute (brittle); Surrogate Int = fast, compact B-Trees; UUID = distributed generation, larger storage.",
    interviewTip: "Recommend the dual-key pattern: use compact integer surrogate keys internally for high-performance joins, and expose a UUID publicly for APIs to prevent sequential ID guessing.",
    tags: ["primary-keys", "surrogate-keys", "natural-keys", "uuids", "b-tree-locality"]
  }),

  createCard({
    idNum: 20,
    category: "Database Design & Normalization",
    concept: "Foreign Key Constraints & Referential Actions (CASCADE vs SET NULL vs RESTRICT)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the referential actions available on Foreign Key constraints (CASCADE, SET NULL, RESTRICT, NO ACTION) and their implications?",
    quickAnswer: "Foreign keys enforce referential integrity between child and parent tables. When a parent row is deleted or updated, `ON DELETE / ON UPDATE` rules determine child behavior: `CASCADE` automatically deletes or updates referencing child rows; `SET NULL` sets the child foreign key column to NULL; `RESTRICT` immediately aborts the operation if children exist; and `NO ACTION` (default) defers constraint checking to the end of the statement or transaction.",
    detailedAnswer: "Referential Actions Matrix:\n- `CASCADE`: Essential for strict Parent-Child composition (e.g. deleting an `order` cascades to delete its `order_items`). Hazard: Can trigger massive accidental cascading deletions across millions of rows.\n- `SET NULL`: Used for weak associations (e.g. deleting a `department` sets `employee.department_id = NULL`). Requires child column to be nullable.\n- `RESTRICT`: Rejects the parent delete immediately with a foreign key violation.\n- `NO ACTION`: Standard SQL default. Similar to `RESTRICT`, but allows deferred constraint checks (`DEFERRABLE INITIALLY DEFERRED`), permitting temporary violations within a transaction as long as integrity is satisfied at `COMMIT`.",
    code: `-- Comprehensive Foreign Key Definitions
CREATE TABLE departments (
    dept_id INT PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

CREATE TABLE employees (
    emp_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    -- If department is deleted, employee remains but dept_id becomes NULL
    dept_id INT REFERENCES departments(dept_id) ON DELETE SET NULL
);

CREATE TABLE employee_paystubs (
    stub_id BIGINT PRIMARY KEY,
    emp_id INT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    -- If employee is deleted, all paystubs are wiped out automatically!
    FOREIGN KEY (emp_id) REFERENCES employees(emp_id) ON DELETE CASCADE
);`,
    recallHint: "CASCADE = delete children automatically; SET NULL = orphan children with NULL; RESTRICT/NO ACTION = abort parent deletion.",
    interviewTip: "Warn about the danger of un-indexed foreign key columns in child tables: deleting a parent row can force a full table scan on the child table to verify referential integrity!",
    tags: ["foreign-keys", "on-delete-cascade", "set-null", "referential-integrity", "constraints"]
  }),

  createCard({
    idNum: 21,
    category: "Database Design & Normalization",
    concept: "Unique Constraints vs Unique Indexes (Nullability & Partial Differences)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between a UNIQUE constraint and a UNIQUE index, and how do they handle multiple NULL values in standard SQL?",
    quickAnswer: "A **UNIQUE constraint** is a logical DDL declaration enforcing that all non-null values in a column are distinct. A **UNIQUE index** is the underlying physical B-Tree data structure implemented by the storage engine to enforce that uniqueness. According to ANSI SQL standards, multiple `NULL` values do NOT violate a unique constraint because `NULL = NULL` evaluates to `UNKNOWN` (not `TRUE`), meaning multiple rows can contain `NULL` in a unique column unless declared `NOT NULL`.",
    detailedAnswer: "Technical Distinction & Null Semantics:\n1. Logical vs Physical: Declaring `CONSTRAINT uq_email UNIQUE (email)` automatically creates a unique index under the hood in virtually all database engines.\n2. ANSI Standard Nulls: A unique column allows infinite `NULL` values because each `NULL` is considered distinct/unknown.\n3. SQL:2023 / PostgreSQL 15+ Feature: `UNIQUE NULLS NOT DISTINCT` allows developers to optionally treat `NULL`s as identical, prohibiting multiple `NULL` entries.\n4. Foreign Key Targeting: Foreign keys can reference columns with either a `PRIMARY KEY` or a `UNIQUE` constraint.",
    code: `-- 1. Standard Unique Constraint (Allows multiple NULLs)
CREATE TABLE client_profiles (
    id INT PRIMARY KEY,
    tax_id VARCHAR(50) UNIQUE -- Permitted to have multiple NULL rows!
);

INSERT INTO client_profiles VALUES (1, 'TAX-01');
INSERT INTO client_profiles VALUES (2, NULL);     -- Allowed
INSERT INTO client_profiles VALUES (3, NULL);     -- Allowed in ANSI SQL!

-- 2. PostgreSQL 15+ / Modern SQL Unique constraint forbidding multiple NULLs:
-- ALTER TABLE client_profiles ADD CONSTRAINT uq_tax_unique_nulls UNIQUE NULLS NOT DISTINCT (tax_id);`,
    recallHint: "Unique constraint is logical; unique index is physical; ANSI standard permits multiple NULLs in unique columns (unless NOT NULL is added).",
    interviewTip: "Be ready for the trick question: 'Can a column with a UNIQUE constraint contain multiple NULLs?' The ANSI SQL answer is YES.",
    tags: ["unique-constraint", "unique-index", "null-semantics", "data-integrity", "ansi-standard"]
  }),

  createCard({
    idNum: 22,
    category: "Database Design & Normalization",
    concept: "Table CHECK Constraints & Domain Validation Integrity",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do table CHECK constraints enforce business rules, and what are their deterministic function limitations?",
    quickAnswer: "A `CHECK` constraint specifies a boolean condition that every row in the table must satisfy for an `INSERT` or `UPDATE` to commit. If the condition evaluates to `FALSE`, the transaction is aborted with a constraint violation (if it evaluates to `TRUE` or `UNKNOWN`, the row is accepted). CHECK constraints must be deterministic: they cannot reference other tables, subqueries, or non-deterministic functions (like `CURRENT_TIMESTAMP` or `RANDOM()`).",
    detailedAnswer: "CHECK Constraint Rules:\n1. 3VL Semantics: If a CHECK condition evaluates to `UNKNOWN` (due to `NULL`), it PASSES! E.g. `CHECK (age >= 18)` passes if `age` is `NULL`. To prevent missing values, pair with `NOT NULL`.\n2. Multi-Column Constraints: Can compare multiple columns within the exact same row: `CHECK (end_date >= start_date)`.\n3. Function Limitations: Cannot call volatile functions (`NOW()`) because row validity must remain consistent across time.\n4. Performance: Evaluated in-memory during row mutation with zero join or subquery overhead.",
    code: `-- Multi-rule table with CHECK constraints
CREATE TABLE loan_applications (
    application_id INT PRIMARY KEY,
    applicant_age INT NOT NULL,
    requested_amount NUMERIC(12, 2) NOT NULL,
    interest_rate NUMERIC(5, 4) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    -- Age must be legal adult
    CONSTRAINT chk_legal_age CHECK (applicant_age >= 18),
    -- Loan must be positive
    CONSTRAINT chk_positive_loan CHECK (requested_amount > 0),
    -- Date chronological integrity
    CONSTRAINT chk_date_chronology CHECK (end_date >= start_date),
    -- Enum emulation
    CONSTRAINT chk_valid_status CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED'))
);`,
    recallHint: "CHECK constraints validate rows on write; only rejects if condition evaluates to FALSE (accepts TRUE and UNKNOWN/NULL).",
    interviewTip: "Highlight that `CHECK` accepts `NULL` because `UNKNOWN` is not `FALSE`—always add `NOT NULL` if the attribute cannot be missing.",
    tags: ["check-constraints", "data-integrity", "domain-validation", "3vl", "table-design"]
  }),

  createCard({
    idNum: 23,
    category: "Database Design & Normalization",
    concept: "Default Values (DEFAULT), Timestamps and Auto-Increment Sequences",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the DEFAULT clause operate on INSERT statements, and how has the ANSI SQL:2003 IDENTITY standard replaced legacy auto-increments?",
    quickAnswer: "The `DEFAULT` clause specifies a fallback value assigned to a column when an `INSERT` statement omits the column or explicitly specifies the keyword `DEFAULT`. In older databases, auto-incrementing surrogate keys relied on vendor-specific keywords (`AUTO_INCREMENT` in MySQL, `SERIAL` in Postgres). ANSI SQL:2003 standardized this with `GENERATED ALWAYS AS IDENTITY` (or `BY DEFAULT AS IDENTITY`), which uses standard database sequences.",
    detailedAnswer: "IDENTITY Types & Default Mechanics:\n1. `GENERATED ALWAYS AS IDENTITY`: The database engine strictly controls sequence numbering; explicit manual inserts of values will fail unless explicitly overridden.\n2. `GENERATED BY DEFAULT AS IDENTITY`: The sequence generates values when omitted, but accepts manual explicit values without errors.\n3. Dynamic Default Values: `DEFAULT CURRENT_TIMESTAMP` inserts the transaction commit timestamp automatically.\n4. Default vs NULL: If a client explicitly inserts `NULL` into a column with a `DEFAULT` clause, the column is populated with `NULL`, NOT the default value!",
    code: `-- ANSI SQL:2003 Standard Identity Definition
CREATE TABLE customer_orders (
    order_id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    customer_id INT NOT NULL,
    order_status VARCHAR(20) NOT NULL DEFAULT 'NEW',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 1. Using defaults by omitting columns
INSERT INTO customer_orders (customer_id) VALUES (42);

-- 2. Explicitly requesting the default keyword
INSERT INTO customer_orders (customer_id, order_status, created_at) 
VALUES (89, DEFAULT, DEFAULT);

-- 3. Explicit insert into GENERATED ALWAYS fails without override
-- INSERT INTO customer_orders (order_id, customer_id) VALUES (999, 100); -- ERROR!`,
    recallHint: "GENERATED ALWAYS AS IDENTITY is the ANSI standard; inserting explicit NULL does NOT trigger DEFAULT (only omission or DEFAULT keyword does).",
    interviewTip: "Explain that `SERIAL` in PostgreSQL is just a macro that creates an underlying sequence; modern SQL should use standard `GENERATED ALWAYS AS IDENTITY`.",
    tags: ["default-values", "identity", "auto-increment", "sequences", "ansi-sql-2003"]
  }),

  createCard({
    idNum: 24,
    category: "Database Design & Normalization",
    concept: "Entity-Relationship Cardinality: 1:1, 1:N and N:M Junction Tables",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How are 1:1, 1:N, and N:M relationships modeled physically in relational schemas, and why are Junction tables required for N:M?",
    quickAnswer: "In relational modeling: **1:1** is modeled by placing a Foreign Key with a `UNIQUE` constraint in either table; **1:N** is modeled by placing a Foreign Key on the 'Many' child table referencing the 'One' parent primary key; and **N:M (Many-to-Many)** CANNOT be represented with direct foreign keys without violating 1NF, requiring an intermediate **Junction (Bridge) Table** containing two foreign keys forming a composite primary key.",
    detailedAnswer: "Relationship Topology:\n1. One-to-One (1:1): E.g. `users` and `user_profiles`. The foreign key in `user_profiles` has a `UNIQUE` constraint, guaranteeing a user can have at most one profile.\n2. One-to-Many (1:N): E.g. `customers` and `orders`. `orders.customer_id` references `customers.id`.\n3. Many-to-Many (N:M): E.g. `students` and `classes`. A student has many classes; a class has many students.\n   - Junction Table `enrollments (student_id, class_id)`.\n   - Primary Key: Composite `PRIMARY KEY (student_id, class_id)` prevents duplicate enrollments.\n   - Payload attributes: Stores relationship metadata (e.g. `enrolled_date`, `grade`).",
    code: `-- Modeling N:M (Many-to-Many) Relationship with a Junction Table
CREATE TABLE authors (
    author_id INT PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE books (
    book_id INT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    isbn VARCHAR(13) UNIQUE NOT NULL
);

-- Junction Table linking Authors and Books
CREATE TABLE book_authors (
    author_id INT NOT NULL,
    book_id INT NOT NULL,
    royalty_percentage NUMERIC(5, 2) NOT NULL DEFAULT 100.00,
    PRIMARY KEY (author_id, book_id),
    FOREIGN KEY (author_id) REFERENCES authors(author_id) ON DELETE CASCADE,
    FOREIGN KEY (book_id) REFERENCES books(book_id) ON DELETE CASCADE
);`,
    recallHint: "1:1 = FK + UNIQUE; 1:N = FK on many table; N:M = Junction table with composite PK (FK1, FK2).",
    interviewTip: "Always mention that junction tables can carry payload attributes that describe the relationship itself (e.g. `royalty_percentage` or `enrollment_date`).",
    tags: ["cardinality", "junction-tables", "many-to-many", "one-to-many", "er-modeling"]
  })
];

module.exports = cards;
