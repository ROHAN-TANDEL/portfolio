// scripts/deep_security/part2_chapters_7_to_12.cjs
module.exports = [
  {
    id: "sec-deep-07",
    title: "SQL Injection & AST Mechanics: Parameterized Queries vs Query Compilers",
    category: "Data Layer Security",
    readTimeMinutes: 28,
    overview: "SQL Injection (SQLi) is fundamentally a language parsing vulnerability where untrusted data breaks out of the data literal context into the execution syntax of the database query parser. This masterclass analyzes the Abstract Syntax Tree (AST) compilation pipeline, prepared statement binary wire protocols, and why ORMs still succumb to SQLi when used improperly.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        SQL PARSER COMPILATION: VULNERABLE VS PREPARED              |
+-----------------------------------------------------------------------------------+
  [ VULNERABLE STRING CONCATENATION ]
  Query: "SELECT * FROM users WHERE email = '" + input + "'"
  Input: "admin' OR 1=1 --"
            |
            v (Database Lexer & Parser)
  [ ABSTRACT SYNTAX TREE (AST) COMPILATION ]
    ├── SELECT_STATEMENT
    │     ├── COLUMNS: [*]
    │     ├── TABLE: [users]
    │     └── WHERE_CLAUSE:
    │           ├── BINARY_OP: OR  <-- ATTACKER INJECTED NEW SYNTAX NODE!
    │           │     ├── LEFT: (email = 'admin')
    │           │     └── RIGHT: (1 = 1) -> ALWAYS TRUE!
    │
  ===================================================================================
  [ PREPARED STATEMENT (PARAMETERIZED) ]
  Query Template: "SELECT * FROM users WHERE email = $1"
            |
            v (Step 1: PREPARE Phase - AST Compiled FIRST)
  [ IMMUTABLE AST COMPILED ]
    └── WHERE_CLAUSE:
          └── BINARY_OP: EQUALS
                ├── LEFT: [email]
                └── RIGHT: [PARAMETER_PLACEHOLDER_1]  <-- STRUCTURALLY LOCKED!
            |
            v (Step 2: EXECUTE Phase - Data sent in separate binary wire frame)
  Input: "admin' OR 1=1 --" -> Bound purely as literal string byte array!
`,
    deepDive: `### 1. The Language Compilation Vulnerability
Relational databases (PostgreSQL, MySQL, Oracle) are compilers. When raw SQL strings are submitted:
1. **Lexical Analysis (Lexer)**: Scans input text and tokenizes keywords (\`SELECT\`, \`WHERE\`, \`OR\`), operators, and string literals.
2. **Syntactic Analysis (Parser)**: Constructs an Abstract Syntax Tree (AST) representing the mathematical logic of the query.
3. **Query Optimization & Execution**: The database planner generates an execution plan and evaluates indices.
- **The SQLi Flaw**: When user input is concatenated into the SQL string before the lexer runs, the input alters the grammar of the AST. The parser cannot distinguish between a developer's intended query boundary and an adversary's injected \`OR 1=1\` syntax tree node.

### 2. Prepared Statements & The Binary Wire Protocol
Prepared statements eliminate SQLi by decoupling the compilation phase from the data binding phase:
- **Phase 1: Parse (Prepare)**: The application sends the query template with positional placeholders (\`$1\`, \`$2\`, or \`?\`) to the database over the network. The database parses and compiles the query into an immutable AST plan.
- **Phase 2: Bind & Execute**: The application transmits the parameter values in a separate, discrete binary wire protocol message (e.g. PostgreSQL Frontend/Backend Protocol \`Bind\` message \`B\`).
- Because the AST was already compiled and locked in Step 1, parameter values are placed directly into memory registers as literal strings or numbers. Even if the user passes \`'; DROP TABLE users; --\`, the database simply searches for a customer whose literal email matches that exact string.

### 3. How ORMs Still Suffer from SQL Injection
Many developers mistakenly believe that using an Object-Relational Mapper (ORM) like Prisma, TypeORM, or Sequelize automatically makes applications immune to SQL injection. Common ORM SQLi vectors include:
1. **Raw Query Fragments**:
   \`\`\`typescript
   // TypeORM Vulnerability:
   userRepository.createQueryBuilder(\"user\")
     .where(\`user.name = '\${userInput}'\`); // RAW CONCATENATION BYPASSES ORM!
   \`\`\`
2. **Dynamic Order By Injection**:
   Many ORMs parameterize \`WHERE\` clauses, but cannot parameterize \`ORDER BY\` or column names because standard SQL does not allow column identifiers as prepared statement parameters. If an endpoint accepts \`sortBy = req.query.sort\` directly:
   \`\`\`typescript
   // VULNERABLE:
   db.user.findMany({ orderBy: { [req.query.sortBy]: 'asc' } });
   // If req.query.sortBy is "(CASE WHEN (1=1) THEN id ELSE price END)"
   \`\`\`
3. **NoSQL / JSON Injection in ORMs**: In MongoDB (Mongoose) or PostgreSQL JSONB operators, passing raw untrusted objects (\`{ \"$gt\": \"\" }\`) allows query operator injection, bypassing authentication checks.`,
    edgeCasesAndPitfalls: [
      "Dynamic Table and Column Names: Prepared statements cannot parameterize table or column names; these must be validated against a strict hardcoded whitelist before insertion.",
      "Stored Procedure Second-Order SQLi: Executing a prepared statement that stores input safely, but then having a backend PL/pgSQL stored procedure execute dynamic \`EXECUTE query_string\` on that stored data.",
      "Database Error Leakage: Exposing raw database syntax errors (e.g. \"ERROR: syntax error at or near 'admin'\") in HTTP 500 JSON responses, allowing attackers to perform automated Blind Error-Based SQLi."
    ],
    keyTakeaways: [
      "SQL injection is an AST compilation disruption caused by mixing executable syntax with untrusted data strings.",
      "Prepared statements compile the immutable AST first, transmitting parameters in separate binary wire frames.",
      "ORMs do not prevent SQLi if developers use raw query builders, dynamic ORDER BY clauses, or un-sanitized column names."
    ]
  },
  {
    id: "sec-deep-08",
    title: "Replay Attacks, Cryptographic Webhook Signing & Idempotency Handshakes",
    category: "API & Distributed Systems Security",
    readTimeMinutes: 28,
    overview: "Webhooks and asynchronous API events cross trust boundaries without human intervention. This masterclass analyzes the mechanics of replay attacks, timestamped HMAC-SHA256 signature verifications, distributed idempotency state machines, and clock skew mitigation.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        SECURE WEBHOOK RECEIVER VERIFICATION PIPELINE              |
+-----------------------------------------------------------------------------------+
  [ EXTERNAL PROVIDER (Stripe / GitHub) ]              [ ENTERPRISE WEBHOOK RECEIVER ]
            |                                                        |
            | 1. Generate Timestamp: t = 1712000000                  |
            | 2. Payload: raw_bytes = '{"id":"evt_1","paid":true}'   |
            | 3. Compute: sig = HMAC_SHA256("1712000000." + raw_bytes, secret)
            | 4. Send HTTP POST:                                     |
            |    Header: X-Signature: t=1712000000,v1=a1b2c3d4...   |
            |    Body: raw_bytes                                     |
            | -----------------------------------------------------> |
            |                                                        | 5. STEP 1: Parse Header
            |                                                        |    Extract timestamp 't' & sig 'v1'
            |                                                        |
            |                                                        | 6. STEP 2: Replay Attack Defense
            |                                                        |    If abs(now - t) > 300s -> REJECT!
            |                                                        |
            |                                                        | 7. STEP 3: Cryptographic HMAC
            |                                                        |    Compute local HMAC over raw bytes
            |                                                        |    crypto.timingSafeEqual() check!
            |                                                        |
            |                                                        | 8. STEP 4: Idempotency Check
            |                                                        |    Redis SETNX lock on event ID
            |                                                        |    (Prevents duplicate processing!)
            |                                                        |
            | <--------- HTTP 200 OK (Event Processed) ------------- |
`,
    deepDive: `### 1. The Threat of Webhook Replay Attacks
Webhooks are public endpoints (\`POST /api/webhooks/stripe\`) exposed to the internet.
- **The Threat Scenario**: A customer purchases an item. The payment provider emits a signed webhook payload: \`{\"event\": \"payment_succeeded\", \"order_id\": \"ord_998\", \"credits\": 500}\`.
- An attacker intercepts this valid network transmission (via compromised proxy, logging system, or network sniffing).
- The attacker replays the exact same HTTP request 1,000 times to \`/api/webhooks/stripe\`.
- Because the HMAC signature is authentic for that payload, a naive receiver validates the signature and credits the user's account with 500,000 credits without charging their card!

### 2. The Timestamped HMAC Verification Standard
To defend against replay attacks, modern webhook architectures (popularized by Stripe and GitHub) bundle an authenticated timestamp into the signed payload:
1. **Header Format**: \`Stripe-Signature: t=1614555819,v1=5257a869e43e248583264b31c0... \`
2. **Signed Payload**: The signature is computed over the timestamp concatenated with the exact raw byte string of the request body:
   $$\text{Signature} = \text{HMAC-SHA256}(K, \text{timestamp} \mathbin{\Vert} \text{\".\"} \mathbin{\Vert} \text{raw\_body})$$
3. **Receiver Verification Protocol**:
   - Extract the timestamp $t$ from the header.
   - Reject the request if $| \text{current\_time} - t | > \text{tolerance}$ (typically 300 seconds). This ensures an intercepted request can only be replayed within a 5-minute window.
   - Recompute the HMAC using the shared secret and the raw received bytes.
   - Use constant-time byte comparison (\`crypto.timingSafeEqual\`) to verify the signature.

### 3. Distributed Idempotency State Machine
Even with a 5-minute replay window, an attacker could replay requests within 60 seconds, or network retries from the payment provider could deliver duplicate events. An Idempotency Key state machine is required:
\`\`\`typescript
async function processWebhookIdempotently(eventId: string, handler: () => Promise<void>) {
  const lockKey = \`webhook:lock:\${eventId}\`;
  const statusKey = \`webhook:status:\${eventId}\`;

  // 1. Atomic reservation lock using Redis SETNX with 60s TTL
  const acquired = await redis.set(lockKey, 'locked', 'EX', 60, 'NX');
  if (!acquired) {
    throw new Error('Concurrent execution in progress or already processed');
  }

  // 2. Check if already permanently processed
  const alreadyProcessed = await redis.get(statusKey);
  if (alreadyProcessed) {
    return; // Silently acknowledge duplicate without re-processing!
  }

  // 3. Execute business mutation inside transactional boundary
  await handler();

  // 4. Record permanent success with 7-day retention
  await redis.setex(statusKey, 60 * 60 * 24 * 7, 'COMPLETED');
}
\`\`\``,
    edgeCasesAndPitfalls: [
      "Body Parsing Corruption: Calling \`app.use(express.json())\` before webhook signature verification mutates whitespace, key ordering, and character encoding; always capture the raw \`Buffer\` before JSON parsing.",
      "Clock Drift Outages: If the webhook receiver server clock drifts 6 minutes behind the sender's clock, all legitimate webhook signatures are rejected as expired replays.",
      "Secret Leakage via Query Parameters: Passing webhook secrets in query strings (\`/webhook?secret=123\`) exposes the secret in server access logs and browser histories; always pass signatures in HTTP headers."
    ],
    keyTakeaways: [
      "Signatures must concatenate a timestamp with raw bytes to bind time to message integrity.",
      "Always compute HMACs over the raw binary payload buffer before parsing JSON.",
      "Implement distributed idempotency locks in Redis to guarantee exactly-once business processing."
    ]
  },
  {
    id: "sec-deep-09",
    title: "Container Isolation Internals: Linux Namespaces, Cgroups, Seccomp & Distroless Hardening",
    category: "Container & Operating System Security",
    readTimeMinutes: 30,
    overview: "Containers are not virtual machines; they are standard Linux processes wrapped in kernel-level visibility namespaces and resource control groups (cgroups). This masterclass deconstructs the Linux kernel boundaries that separate containers, the mechanics of container breakouts, and the implementation of Seccomp system call filters and Distroless images.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        LINUX KERNEL CONTAINER ISOLATION BOUNDARIES                |
+-----------------------------------------------------------------------------------+
  [ CONTAINER USER PROCESS (UID 10001) ]
            |
            | Executes System Call (e.g. read(), fork(), clone(), ptrace())
            v
  +-------------------------------------------------------------------------------+
  | LINUX KERNEL SUBSYSTEM BOUNDARIES                                             |
  |                                                                               |
  |  1. NAMESPACES (Visibility Filter):                                           |
  |     - PID (Process tree)   - NET (Virtual eth0, routing)  - MNT (Rootfs)      |
  |     - IPC (Shared memory)  - UTS (Hostname)              - USER (UID mapping)|
  |                                                                               |
  |  2. CONTROL GROUPS (CGROUPS v2 - Resource Throttling):                        |
  |     - memory.max = 512MB   - cpu.max = 100000 100000      - pids.max = 100    |
  |                                                                               |
  |  3. SECCOMP BPF (System Call Filter):                                         |
  |     - Intercepts raw syscall number at kernel entry                           |
  |     - If syscall in whitelist (e.g. read, write, futex) -> ALLOW              |
  |     - If dangerous syscall (e.g. reboot, ptrace, swapon) -> SIGSYS / EPERM!   |
  |                                                                               |
  |  4. LINUX CAPABILITIES (Privilege Partitioning):                              |
  |     - CAP_DROP: ALL (Zero superuser privileges!)                              |
  +-------------------------------------------------------------------------------+
            |
            v
  [ SHARED PHYSICAL HOST HARDWARE & KERNEL MEMORY ]
`,
    deepDive: `### 1. The Reality of Shared Kernel Architecture
Virtual Machines (KVM, ESXi) provide strong hardware-assisted virtualization via hypervisors (Intel VT-x, AMD-V). Each VM runs its own independent operating system kernel.
- **Containers share the host kernel**: A container running Ubuntu and a container running Alpine running on the same Kubernetes worker node share the exact same Linux kernel memory, device drivers, and system call interface.
- If a vulnerability exists in the Linux kernel (e.g. Dirty COW CVE-2016-5195, Dirty Pipe CVE-2022-0847), an unprivileged process inside a container can write directly to host kernel memory, break out of all namespaces, and achieve root on the underlying physical server.

### 2. Seccomp BPF System Call Filtering
The Linux kernel exposes over 400 system calls. Most web applications execute fewer than 40 unique syscalls during their entire lifecycle.
- **Seccomp (Secure Computing Mode)**: Uses Berkeley Packet Filter (BPF) bytecode programs loaded into the kernel to inspect system calls made by a process.
- When an application executes a system call (e.g. \`ptrace\` to attach to other processes, or \`sys_chroot\` to manipulate root mounts), the Seccomp BPF filter evaluates the syscall number and arguments:
  - \`SCMP_ACT_ALLOW\`: Permitted.
  - \`SCMP_ACT_ERRNO\`: Kernel returns \`EPERM\` (Operation not permitted) without executing the syscall.
  - \`SCMP_ACT_KILL\`: Kernel terminates the process immediately.
- Next.js and Node.js production containers should apply the default Docker/containerd Seccomp profile or a custom least-privilege JSON profile that blocks dangerous syscalls like \`reboot\`, \`kexec_load\`, \`bpf\`, and \`keyctl\`.

### 3. Distroless Image Architecture
Standard Docker images (e.g. \`node:20\`) inherit from Debian or Alpine, bundling over 300 megabytes of utilities:
- Package managers (\`apt\`, \`apk\`).
- Shells (\`/bin/bash\`, \`/bin/sh\`).
- Network diagnostics (\`curl\`, \`wget\`, \`nc\`, \`netstat\`).
- Compilers and interpreters (\`python\`, \`make\`, \`gcc\`).
- **Post-Exploitation Neutralization**: When an attacker discovers an arbitrary file read or command execution flaw in an application running inside a Google **Distroless** container:
  - Attempting to spawn \`/bin/sh\` fails (\`ENOENT\`).
  - Attempting to download external rootkits via \`curl\` fails.
  - Attempting to add users via \`useradd\` fails.
  - The container contains strictly the application binary and its immediate shared libraries (\`glibc\`, \`libssl\`).`,
    edgeCasesAndPitfalls: [
      "The Privileged Flag (\`--privileged\`): Running a container with \`--privileged\` disables all Seccomp filters, restores all Linux capabilities, and mounts all host devices (/dev) inside the container, completely destroying container isolation.",
      "Fork Bombs without PID Limits: If cgroups \`pids.max\` is not configured, an attacker or runaway recursive process can fork thousands of threads, starving the host kernel of process table entries and freezing all other containers on the node.",
      "Writable /tmp Scratch Directories: If a container requires temporary disk access, mount an \`emptyDir: { medium: Memory }\` with the \`noexec\` flag to prevent attackers from executing downloaded ELF binaries in /tmp."
    ],
    keyTakeaways: [
      "Containers share the host Linux kernel; namespaces restrict visibility, while cgroups enforce resource quotas.",
      "Seccomp BPF restricts available system calls at the kernel boundary, blocking post-exploitation tools.",
      "Distroless images eliminate shells, package managers, and standard utilities, drastically reducing the post-exploitation attack surface."
    ]
  },
  {
    id: "sec-deep-10",
    title: "Authorization at Scale: Google Zanzibar, Relational Tuples & Graph Access Control",
    category: "Authorization Architecture",
    readTimeMinutes: 30,
    overview: "Google Zanzibar is the global, distributed authorization system that powers Google Drive, Docs, YouTube, and Cloud IAM, processing millions of authorization checks per second with sub-10ms latency. This masterclass analyzes the Relation Tuple data model, distributed consistency via Zookies, and graph traversal algorithms.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        GOOGLE ZANZIBAR REBAC RELATION GRAPH TRAVERSAL             |
+-----------------------------------------------------------------------------------+
  [ RELATION TUPLES STORED IN DISTRIBUTED SPANNER DATABASE ]
    Tuple 1: doc:roadmap#owner@folder:engineering
    Tuple 2: folder:engineering#member@team:backend
    Tuple 3: team:backend#member@user:alice
    Tuple 4: doc:roadmap#viewer@user:bob
  
  [ INCOMING ACCESS CHECK: Can User Alice EDIT doc:roadmap? ]
            |
            v
  +-------------------------------------------------------------------------------+
  | ZANZIBAR GRAPH TRAVERSAL RESOLVER (Leopard Index & Caching)                   |
  |                                                                               |
  | 1. Query: Check(user:alice, relation:edit, object:doc:roadmap)                |
  | 2. Expand doc:roadmap#edit:                                                   |
  |    - Direct owner of doc:roadmap? -> folder:engineering                       |
  | 3. Expand folder:engineering#member:                                          |
  |    - Member of team:backend?                                                  |
  | 4. Expand team:backend#member:                                                |
  |    - Contains user:alice? -> MATCH FOUND!                                     |
  |                                                                               |
  | RESULT: TRUE (Alice is an authorized editor via transitive group membership!) |
  +-------------------------------------------------------------------------------+
`,
    deepDive: `### 1. The Limits of RBAC and ABAC in Collaborative SaaS
In modern multi-tenant enterprise applications (Google Docs, Figma, Notion, Slack):
- Permissions are dynamic and relationship-based: A user can view a document because they belong to a project, which belongs to a workspace, which is shared with a user group.
- Using standard SQL relational JOINs (\`JOIN users ... JOIN teams ... JOIN folders ...\`) on every HTTP request creates massive $O(N^K)$ computational bottlenecks and database deadlocks.
- Storing denormalized permission lists requires updating millions of rows whenever a user joins or leaves a large enterprise group.

### 2. The Zanzibar Relation Tuple Model
Zanzibar models all permissions as a collection of relational tuples:
$$\langle \text{object} \rangle \mathbin{\#} \langle \text{relation} \rangle \mathbin{@} \langle \text{user} \mid \text{userset} \rangle$$
- **Object**: \`doc:financial-q3\`
- **Relation**: \`editor\`, \`viewer\`, \`owner\`
- **User / Userset**: Either an individual identity (\`user:42\`) or another relation set (\`group:finance#member\`).
- **Namespace Configurations**: Define permission rules using set algebra:
  \`\`\`text
  name: \"doc\"
  relations: {
    owner: { this: {} }
    editor: { union: { this: {}, computed_userset: { relation: \"owner\" } } }
    viewer: { 
      union: { 
        this: {}, 
        computed_userset: { relation: \"editor\" },
        tuple_to_userset: { tupleset: { relation: \"parent\" }, computed_userset: { relation: \"viewer\" } }
      } 
    }
  }
  \`\`\`
  This defines that: Every owner is an editor; every editor is a viewer; and anyone who can view the parent folder can view the document.

### 3. Distributed Consistency & Zookies
A major challenge in distributed authorization is the \"New Enemy Problem\":
- Alice revokes Bob's access to a sensitive document at 12:00:00.
- Alice writes proprietary trade secrets to the document at 12:00:01.
- If the authorization query reads from a slightly stale database replica that hasn't synced the revocation, Bob can view the proprietary data!
- **Zookies (Zanzibar Cookies)**: When an access modification occurs, Zanzibar issues an opaque timestamp token (a Zookie, derived from Google Spanner TrueTime). When the client subsequent requests access, they present the Zookie. Zanzibar guarantees that the authorization evaluation reads from a snapshot at least as fresh as the Zookie timestamp, eliminating stale read authorization leaks without global locks.`,
    edgeCasesAndPitfalls: [
      "Infinite Cyclic Graph Traversal: If users define cyclic relationships (Folder A is parent of Folder B, and Folder B is parent of Folder A), naive graph traversal algorithms enter infinite recursion; Zanzibar implementations must maintain cycle-detection sets.",
      "Deep Graph Traversal Latency: Traversing 15 nested group hierarchies can cause high tail latencies; modern implementations (OpenFGA, Oso, Ory Keto) use transitive closure indexes (Leopard Index) to resolve reachability in $O(1)$ time.",
      "Lack of Negative Authorizations: Relation tuples model positive permissions (grants). Implementing explicit \"Deny\" rules in ReBAC requires complex set-difference operations (\`A - B\`) that can be computationally expensive."
    ],
    keyTakeaways: [
      "Google Zanzibar represents authorization as a graph of Relation Tuples: <object>#<relation>@<user>.",
      "Zanzibar set algebra models ownership, group membership, and inheritance cleanly without data denormalization.",
      "Zookies use distributed consistency timestamps to solve the 'New Enemy Problem' and prevent stale authorization reads."
    ]
  },
  {
    id: "sec-deep-11",
    title: "Software Supply Chain Security: SBOMs, SLSA L3 & Cosign Artifact Signing",
    category: "Supply Chain & DevSecOps",
    readTimeMinutes: 30,
    overview: "Software supply chains are the primary target for advanced nation-state attacks (SolarWinds, Codecov, XZ Utils). This masterclass deconstructs the anatomy of supply chain attacks, machine-readable Software Bills of Materials (SBOMs), SLSA Level 3 build provenance, and keyless container attestation with Sigstore/Cosign.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        SLSA LEVEL 3 SECURE BUILD & SIGNING PIPELINE               |
+-----------------------------------------------------------------------------------+
  [ DEVELOPER ]
       |
       | 1. Git Commit with signed GPG / SSH key
       v
  [ SOURCE CONTROL (GitHub Enterprise) ]
       |
       | 2. Triggers Isolated Ephemeral CI Runner (GitHub Actions / Cloud Build)
       v
  +-------------------------------------------------------------------------------+
  | HERMETIC SECURE BUILD ENVIRONMENT (SLSA L3)                                   |
  |                                                                               |
  | 1. Build container image from immutable commit SHA                            |
  | 2. Generate CycloneDX SBOM (syft)                                             |
  | 3. Authenticate with Sigstore Fulcio CA via OIDC Workflow Token               |
  | 4. Issue Ephemeral Short-Lived X.509 Certificate                              |
  | 5. Sign Container Image Digest + SBOM Attestation with Cosign                 |
  | 6. Record Cryptographic Signature to Rekor Public Transparency Ledger Log     |
  +-------------------------------------------------------------------------------+
       |
       v Push Signed Image + SBOM + Attestation
  [ OCI CONTAINER REGISTRY (GHCR / AWS ECR) ]
       |
       v Image Deployment Requested
  [ KUBERNETES ADMISSION CONTROLLER (Kyverno / Policy Controller) ]
       - Verifies Cosign signature matches approved OIDC Identity
       - Verifies Rekor transparency log proof
       - REJECTS ANY UNSIGNED CONTAINER IMAGE FROM RUNNING IN CLUSTER!
`,
    deepDive: `### 1. The Anatomy of Modern Supply Chain Attacks
Attackers no longer target hardened enterprise firewalls directly; they compromise upstream dependencies and build systems:
- **SolarWinds (2020)**: Nation-state actors compromised the build server itself (Orion software build system). The source code was clean, but an injected build script inserted the Sunburst backdoor into the compiled DLL binary during compilation.
- **Codecov (2021)**: Attackers modified a Bash uploader script hosted in an Amazon S3 bucket, exfiltrating CI/CD environment variables (including AWS and GitHub credentials) from thousands of customer repositories.
- **XZ Utils (2024 - CVE-2024-3094)**: A multi-year social engineering campaign compromised the open-source maintainer account, injecting an obfuscated RCE backdoor into upstream release tarballs while keeping the public Git repository looking clean.

### 2. The SLSA (Supply-chain Levels for Software Artifacts) Framework
SLSA establishes security guarantees across four levels:
- **SLSA Level 1**: Scripted build process; generates basic provenance metadata.
- **SLSA Level 2**: Hosted build platform (GitHub Actions, GitLab CI); version-controlled source code; authenticated provenance signed by the build service.
- **SLSA Level 3 (Enterprise Target)**:
  - **Isolated Build Environment**: The build executes inside an ephemeral container or VM that is destroyed after the build.
  - **Hermetic Builds**: Build processes cannot access the internet during compilation (all dependencies are pre-fetched and verified against cryptographic hashes).
  - **Non-Falsifiable Provenance**: The build platform signs an in-toto attestation proving that artifact $X$ was built strictly from commit $Y$ using workflow $Z$.

### 3. Keyless Signing with Sigstore (Cosign, Fulcio, Rekor)
Traditional PKI required storing long-lived private keys inside CI secrets. If an attacker stole the CI secrets, they could sign rogue malware. Sigstore solves this with **Keyless Signing**:
1. When a GitHub Actions workflow executes \`cosign sign\`, the runner generates an ephemeral key pair in RAM.
2. The runner requests an OpenID Connect (OIDC) token from GitHub (\`id-token: write\`). The token proves the build is running repo \`enterprise/api\` on branch \`main\`.
3. The runner sends the OIDC token and public key to **Fulcio** (Sigstore's Root CA).
4. Fulcio validates the OIDC token and issues an X.509 certificate embedding the repository identity, valid for only **10 minutes**.
5. Cosign signs the container image with the ephemeral private key and discards the private key from memory forever.
6. The signature and certificate are published to **Rekor**, an immutable, append-only Merkle tree transparency log.
7. Verification does not require a secret key: the verifier checks that the certificate was valid at the time the Rekor entry was published and that the identity matches \`enterprise/api\`.`,
    edgeCasesAndPitfalls: [
      "Dependency Typosquatting in Unpinned Package Files: Declaring dependencies without strict lockfile hashes (\`package-lock.json\`) allows attackers to introduce malicious packages via semantic version drift.",
      "Third-Party GitHub Actions Compromise: Referencing third-party actions by mutable tags (e.g. \`uses: actions/checkout@v4\`) rather than immutable 40-character commit SHAs allows an attacker who hijacks the action's repo to compromise CI runners.",
      "Build-Time Secret Injection: Hardcoding AWS or Docker credentials in environment variables exposed to untrusted build scripts; use OIDC cloud federation to assume ephemeral cloud roles without static secrets."
    ],
    keyTakeaways: [
      "Supply chain security requires defending source code, upstream dependencies, build systems, and container registries.",
      "SLSA Level 3 mandates ephemeral isolated build environments and non-falsifiable cryptographic provenance attestations.",
      "Sigstore Keyless Signing binds container signatures to short-lived OIDC identities recorded in the Rekor transparency log."
    ]
  },
  {
    id: "sec-deep-12",
    title: "Live Incident Response: Memory Forensics, Threat Containment & Blast Radius Isolation",
    category: "Incident Response & Forensics",
    readTimeMinutes: 32,
    overview: "When an active compromise occurs, every second counts. This masterclass serves as the definitive technical battle guide for security engineers and architects: handling live memory acquisition, executing surgical cloud network quarantines without destroying volatile state, parsing forensic artifacts, and maintaining chain of custody.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        LIVE INCIDENT RESPONSE & FORENSIC TRIAGE                    |
+-----------------------------------------------------------------------------------+
  [ ACTIVE ADVERSARY COMPROMISE DETECTED (SEV-0) ]
            |
            | 1. DO NOT REBOOT! DO NOT TERMINATE! (Preserves RAM!)
            v
  +-------------------------------------------------------------------------------+
  | STAGE 1: IMMEDIATE NETWORK QUARANTINE (CUT BLAST RADIUS)                      |
  |                                                                               |
  | AWS CLI: Modify Security Group to "sg-quarantine-deny-all"                    |
  | - Inbound: DENY ALL (0.0.0.0/0)                                               |
  | - Outbound: DENY ALL (0.0.0.0/0)                                              |
  | RESULT: Command & Control (C2) severed! Data exfiltration halted instantly!   |
  +-------------------------------------------------------------------------------+
            |
            | 2. Out-of-band forensic capture via AWS SSM / LiME
            v
  +-------------------------------------------------------------------------------+
  | STAGE 2: VOLATILE FORENSIC ACQUISITION (ORDER OF VOLATILITY)                 |
  |                                                                               |
  | 1. Capture RAM Memory Dump (/dev/shm/mem.raw) via LiME kernel module          |
  | 2. Capture Network Sockets (ss -tlpna) & Active Process Tree (ps auxww)       |
  | 3. Create Immediate AWS EBS Volume Snapshot (vol-0123...)                     |
  | 4. Compute SHA-256 Checksums on all captured artifacts (Chain of Custody)     |
  +-------------------------------------------------------------------------------+
            |
            | 3. Eradication & Lateral Remediation
            v
  +-------------------------------------------------------------------------------+
  | STAGE 3: CREDENTIAL REVOCATION & POST-MORTEM ROOT CAUSE                       |
  |                                                                               |
  | 1. Invalidate attached IAM Role active STS sessions (revokeOldTokens)         |
  | 2. Analyze Volatility 3 pslist/malfind on offline forensic workstation        |
  | 3. Identify Root Cause Vulnerability -> Patch & Re-deploy                     |
  +-------------------------------------------------------------------------------+
`,
    deepDive: `### 1. The Order of Volatility (RFC 3227)
During digital forensics investigations, evidence must be collected in order of how quickly it dissipates:
1. **CPU Registers, Cache Memory** (Nanoseconds)
2. **Routing Tables, ARP Cache, Process Table, Kernel Memory, RAM** (Microseconds / Seconds)
3. **Temporary File Systems (\`/tmp\`, swap files)** (Minutes)
4. **Physical Disk Media** (Days)
5. **Remote Logging, Archival Backups** (Months)
- **The Golden Rule of Live Triage**: Never execute commands that alter system state (e.g. running heavy scripts or installing packages on the compromised host). Always execute forensic binaries from a mounted read-only USB or pre-staged forensic container.

### 2. Surgical Cloud Network Quarantine Protocol
The instinct of inexperienced engineers during a breach is to terminate the EC2 instance or delete the Kubernetes pod.
- **Why Termination is a Critical Mistake**: Terminating destroys the RAM, the ephemeral disk layers, active network socket tables, and attacker shell history. You will never know what data was exfiltrated or how the attacker gained initial access.
- **The Cloud Quarantine Pattern**:
  1. Prepare an empty **Quarantine Security Group** in advance:
     \`\`\`json
     {
       \"GroupName\": \"sg-quarantine-deny-all\",
       \"Description\": \"Zero ingress, zero egress emergency isolation\",
       \"IpPermissions\": [],
       \"IpPermissionsEgress\": []
     }
     \`\`\`
  2. Swap the instance's Security Group to \`sg-quarantine-deny-all\` using the AWS CLI or automated Lambda script.
  3. All TCP connections to attacker Command & Control (C2) servers drop instantly. Data exfiltration stops in less than 2 seconds.
  4. The virtual machine remains powered on in memory, completely isolated from both the internet and other internal VPC subnets.

### 3. Live Memory Analysis with Volatility 3
Once the memory dump (\`mem.raw\`) is transferred to an isolated forensic workstation:
1. **Process Tree Reconstruction**:
   \`\`\`bash
   python3 vol.py -f mem.raw linux.pstree.PsTree
   \`\`\`
   Look for abnormal parent-child relationships (e.g. \`nginx\` or \`node\` spawning \`/bin/sh\` or \`python3\`).
2. **Hidden Injected Code Detection**:
   \`\`\`bash
   python3 vol.py -f mem.raw linux.malfind.Malfind
   \`\`\`
   Scans memory pages marked as \`PAGE_EXECUTE_READWRITE\` (W^X violation) containing executable shellcode not backed by an on-disk binary.
3. **Network Connection Reconstruction**:
   \`\`\`bash
   python3 vol.py -f mem.raw linux.sockstat.Sockstat
   \`\`\`
   Extracts all sockets open at the moment of acquisition, revealing the IP address and port of the attacker's C2 listener.`,
    edgeCasesAndPitfalls: [
      "Attacker Anti-Forensic Traps: Attackers often create aliases (\`alias ls='rm -rf /'\`) or hook libc functions to intercept forensic commands; always invoke statically linked forensic binaries using absolute paths.",
      "Legal Chain of Custody Invalidation: If forensic images are captured without computing and logging an immediate SHA-256 hash at acquisition time, the evidence will be thrown out in court during criminal prosecution.",
      "Compromised Communication Channels: Discussing an active security incident on corporate Slack or corporate email that the attacker may already control; always establish out-of-band communication (Signal, encrypted voice) during SEV-0 incidents."
    ],
    keyTakeaways: [
      "Never reboot or terminate a compromised machine; isolate it via a zero-ingress/zero-egress Quarantine Security Group.",
      "Adhere strictly to the Order of Volatility: capture volatile RAM before touching disk or turning off instances.",
      "Log cryptographic SHA-256 checksums at every acquisition step to maintain an unbreakable forensic Chain of Custody."
    ]
  }
];
