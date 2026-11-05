// scripts/data_security/cat03_authorization_access.cjs
const { card } = require('../sec_builder_helper.cjs');

const cat = "Authorization & Access Control";

module.exports = [
  card(
    25,
    cat,
    "RBAC Architecture & The Role Explosion Trap",
    "must-know",
    "intermediate",
    "What is Role-Based Access Control (RBAC) and why do growing enterprise systems suffer from the 'Role Explosion' problem?",
    "RBAC groups permissions into discrete roles (e.g., Admin, Editor, Viewer) and assigns roles to users. 'Role Explosion' occurs when fine-grained, contextual permissions require multiplying roles exponentially (e.g., RegionalEditor_US, RegionalEditor_EU_Billing).",
    "In simple applications, RBAC is straightforward: User -> Role -> Permissions. However, when access logic must account for resource ownership ('can edit only their own posts'), geographic boundaries ('can view records in EMEA during business hours'), or organizational hierarchies, standard RBAC fails. System administrators are forced to create hundreds of bespoke roles, resulting in unmanageable role governance, privilege creep, and security misconfigurations. This limitation led to the adoption of Attribute-Based (ABAC) and Relationship-Based (ReBAC) access control models.",
    `// Simple RBAC Matrix
interface RoleMapping {
  role: 'admin' | 'finance_manager' | 'auditor';
  permissions: string[];
}

const roles: Record<string, string[]> = {
  admin: ['org:delete', 'user:write', 'invoice:read', 'invoice:approve'],
  finance_manager: ['invoice:read', 'invoice:approve'],
  auditor: ['invoice:read', 'audit:export'],
};

export function hasPermission(userRole: string, requiredPerm: string): boolean {
  return roles[userRole]?.includes(requiredPerm) ?? false;
}`,
    "Use RBAC for coarse-grained administrative roles (e.g. PlatformAdmin vs TenantMember). Avoid nesting business context into role titles.",
    ["rbac", "role-explosion", "authorization", "access-control"]
  ),
  card(
    26,
    cat,
    "ABAC (Attribute-Based Access Control) & Policy Engines",
    "must-know",
    "intermediate",
    "How does Attribute-Based Access Control (ABAC) evaluate dynamic contextual attributes to make access decisions?",
    "ABAC evaluates Boolean policies based on attributes of four entities: Subject (user role, department, clearance), Resource (classification, owner, tenantId), Action (read, write, delete), and Environment (time of day, client IP, device health).",
    "Instead of static role lists, ABAC uses dynamic expression evaluation: Allow access IF (Subject.department == Resource.department AND Environment.ipAddress IN CorporateVPN AND Resource.sensitivityLevel <= Subject.clearance). This solves role explosion because a single policy ruleset handles thousands of permutations dynamically. Standards like XACML and modern policy-as-code engines like Open Policy Agent (OPA / Rego) and AWS Cedar represent industry implementations of ABAC.",
    `// ABAC Policy Evaluation Example
interface AbacContext {
  subject: { id: string; department: string; clearanceLevel: number };
  resource: { id: string; ownerDept: string; classification: number; isLocked: boolean };
  action: 'READ' | 'WRITE' | 'DELETE';
  environment: { isCorporateNetwork: boolean; requestHourUtc: number };
}

export function evaluateAbac(ctx: AbacContext): boolean {
  const { subject, resource, action, environment } = ctx;

  // Rule 1: Never allow write to locked resources
  if (resource.isLocked && action !== 'READ') return false;

  // Rule 2: Department match and clearance check
  const hasDeptAccess = subject.department === resource.ownerDept;
  const hasClearance = subject.clearanceLevel >= resource.classification;

  // Rule 3: Environmental constraint: Delete actions only allowed from Corporate Network
  if (action === 'DELETE' && !environment.isCorporateNetwork) return false;

  return hasDeptAccess && hasClearance;
}`,
    "ABAC is ideal when access depends on contextual variables that change dynamically, such as location, time, or document confidentiality level.",
    ["abac", "policy-engine", "contextual-access", "zero-trust-auth"]
  ),
  card(
    27,
    cat,
    "ReBAC (Relationship-Based Access Control) & Google Zanzibar",
    "advanced",
    "advanced",
    "How does Relationship-Based Access Control (ReBAC) model permissions as a distributed graph based on Google Zanzibar?",
    "ReBAC expresses permissions as relations between objects in an authorization graph using Relation Tuples: <object>#<relation>@<subject>. Access checks traverse the graph to determine reachability.",
    "First detailed in Google's Zanzibar paper, ReBAC powers authorization across Google Docs, Drive, and GitHub. In modern collaborative apps, access is determined by relationships: 'User Alice is an editor of Folder X, and Document Y is inside Folder X, so Alice can edit Document Y'. Instead of copying permissions across millions of files, Zanzibar stores relation tuples like doc:readme#parent@folder:eng and folder:eng#editor@user:alice. An authorization query evaluates whether a path exists between user:alice and doc:readme#edit via graph expansion with caching and distributed consistency (Zookie timestamps).",
    `// ReBAC Relation Tuple Representation (Zanzibar / OpenFGA / Oso)
interface RelationTuple {
  object: string;   // e.g., "doc:project-roadmap"
  relation: string; // e.g., "viewer", "editor", "parent"
  user: string;     // e.g., "user:bob" or "team:marketing#member"
}

// Conceptual Zanzibar Graph Check: Can Bob view doc:project-roadmap?
async function checkRebacAccess(user: string, permission: string, object: string): Promise<boolean> {
  // 1. Direct tuple check: Is user explicitly granted relation?
  // 2. Traversal: Does user belong to a group/team with this relation?
  // 3. Inheritance: Does this object have a parent containing the relation?
  // OpenFGA / Ory Keto / Auth0 Fine-Grained Authorization implement this engine.
  return true; 
}`,
    "When building multi-tenant SaaS with teams, folders, workspaces, and shared documents, ReBAC is vastly superior to RBAC and ABAC.",
    ["rebac", "zanzibar", "openfga", "graph-authorization"]
  ),
  card(
    28,
    cat,
    "Insecure Direct Object References (IDOR / BOLA) Defense",
    "must-know",
    "intermediate",
    "What is an IDOR / BOLA vulnerability and what architectural pattern guarantees immunity against unauthorized object access?",
    "Insecure Direct Object Reference (IDOR) / Broken Object Level Authorization (BOLA) occurs when an application accepts a user-supplied object ID (e.g. /api/invoices/1042) without verifying that the requesting user owns or has access to that specific object.",
    "BOLA is consistently ranked #1 on the OWASP API Security Top 10. Attackers simply iterate integer IDs or UUIDs to view other tenants' medical records, bank statements, or orders. Defense requires three architectural practices: 1) Never rely on path/query IDs alone; always scope database queries to the authenticated tenant/user session: WHERE id = :id AND tenant_id = :sessionTenantId; 2) Enforce Database Row-Level Security (PostgreSQL RLS) as a safety net; 3) Use cryptographically unguessable UUIDv4 or NanoIDs instead of sequential auto-incrementing integers (mitigating enumeration, though not replacing auth checks).",
    `// VULNERABLE TO IDOR:
// const invoice = await db.query("SELECT * FROM invoices WHERE id = $1", [req.params.id]);

// IMMUNE TO IDOR (Scoped to Verified Session Context):
export async function getInvoiceSafely(invoiceId: string, verifiedUser: { id: string; orgId: string }) {
  const result = await db.query(
    \`SELECT * FROM invoices 
     WHERE id = $1 
       AND organization_id = $2\`,
    [invoiceId, verifiedUser.orgId]
  );

  if (result.rows.length === 0) {
    // Return 404 rather than 403 to prevent object existence enumeration!
    throw new NotFoundError("Invoice not found");
  }
  return result.rows[0];
}`,
    "Returning 404 instead of 403 on IDOR violations prevents attackers from probing whether an ID exists in another tenant's workspace.",
    ["idor", "bola", "owasp-api-1", "access-control-flaw"]
  ),
  card(
    29,
    cat,
    "Horizontal vs Vertical Privilege Escalation",
    "must-know",
    "intermediate",
    "What is the difference between Horizontal and Vertical Privilege Escalation and how are both mitigated?",
    "Horizontal Privilege Escalation occurs when an attacker accesses resources belonging to a user at the same privilege level (e.g., User A viewing User B's profile). Vertical Privilege Escalation occurs when an attacker gains access to functions reserved for higher privilege levels (e.g., a standard user accessing the /admin panel).",
    "Horizontal escalation is mitigated by strictly binding data queries to the active tenant/user context (IDOR defense) and enforcing relationship checks. Vertical escalation is mitigated by enforcing Policy Enforcement Points (PEPs) on every administrative route and mutation: checking verified server-side claims (never client headers or hidden form fields), restricting administrative endpoints to dedicated networks/VPNs, and enforcing role hierarchy checks inside the service layer, not just in UI routing guards.",
    `// Defense against Vertical Escalation (Route & Service Guard):
export function requireRole(allowedRoles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role; // Sourced strictly from verified cryptographic JWT / session
    if (!userRole || !allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: "Forbidden: Insufficient privileges" });
    }
    next();
  };
}

// Usage on vertical boundary:
// router.post('/admin/reset-tenant', requireRole(['SUPER_ADMIN']), resetTenantHandler);`,
    "Client-side route guards (like hiding an Admin button in React) provide zero security against vertical escalation. The backend API must verify role permissions on every request.",
    ["privilege-escalation", "horizontal-escalation", "vertical-escalation", "rbac"]
  ),
  card(
    30,
    cat,
    "Policy Decision Points (PDP) vs Policy Enforcement Points (PEP)",
    "must-know",
    "intermediate",
    "What are Policy Decision Points (PDP) and Policy Enforcement Points (PEP) in modern decoupled authorization architectures?",
    "A Policy Enforcement Point (PEP) intercepts incoming requests and enforces access decisions, while a Policy Decision Point (PDP) evaluates policies and attributes to return an Allow or Deny verdict.",
    "Decoupling policy evaluation from application business code prevents authorization logic from being scattered across hundreds of microservices. In this architecture: 1) The client makes a request to a service; 2) The service's middleware acts as the PEP; 3) The PEP extracts Subject, Resource, and Action attributes and queries the PDP (e.g., an Open Policy Agent sidecar running locally on localhost:8181); 4) The PDP evaluates compiled policy rules and returns { allow: true }; 5) The PEP permits or blocks the request. This allows security teams to update authorization policies globally without redeploying microservice binaries.",
    `// PEP Middleware calling local OPA PDP Sidecar
export async function pepMiddleware(req: Request, res: Response, next: NextFunction) {
  const query = {
    input: {
      user: req.user?.id,
      role: req.user?.role,
      action: req.method,
      path: req.path,
    }
  };

  // Query PDP (Open Policy Agent sidecar via low-latency HTTP/IPC)
  const opaResponse = await fetch('http://127.0.0.1:8181/v1/data/httpapi/authz', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(query)
  });

  const { result } = await opaResponse.json();

  if (!result?.allow) {
    return res.status(403).json({ error: "Access Denied by Centralized Policy" });
  }
  next();
}`,
    "Decoupling PEP and PDP means authorization rules are version-controlled in Git as Policy-as-Code, tested independently, and updated zero-downtime.",
    ["pdp", "pep", "xacml", "opa", "policy-as-code"]
  ),
  card(
    31,
    cat,
    "Open Policy Agent (OPA) & Rego Policy Mechanics",
    "advanced",
    "advanced",
    "How does Open Policy Agent (OPA) evaluate declarative Rego policies to enforce fine-grained microservice authorization?",
    "OPA is an open-source, general-purpose policy engine. It uses Rego, a high-level declarative query language based on Datalog, to evaluate JSON inputs against policy rules and output structured decisions.",
    "OPA executes in-memory with sub-millisecond evaluation latency, making it ideal as a Kubernetes admission controller or microservice sidecar. Rego policies operate on sets, objects, and arrays. By default, policies are default-deny (default allow = false). Rules evaluate to true if all expressions inside the rule body are satisfied. OPA compiles Rego into WebAssembly (WASM) for embedded execution in Edge workers, Envoy proxies, or Node.js runtimes.",
    `# policy.rego - OPA Microservice Authorization Policy
package httpapi.authz

# Default to Deny
default allow = false

# Allow administrators full access
allow {
    input.user.role == "admin"
}

# Allow billing team to read billing paths during business hours
allow {
    input.user.department == "finance"
    startswith(input.path, "/v1/invoices")
    input.action == "GET"
    input.request_hour >= 8
    input.request_hour <= 18
}`,
    "Rego evaluates queries using relational set theory. Because it is side-effect-free and deterministic, policies can be unit-tested thoroughly via 'opa test'.",
    ["opa", "rego", "policy-as-code", "microservice-authz"]
  ),
  card(
    32,
    cat,
    "Multi-Tenant Authorization Isolation via Row-Level Security (RLS)",
    "must-know",
    "intermediate",
    "How does PostgreSQL Row-Level Security (RLS) provide defense-in-depth against cross-tenant data leaks?",
    "PostgreSQL Row-Level Security (RLS) enforces authorization filters directly inside the database engine, automatically appending security predicates (e.g. tenant_id = current_setting('app.current_tenant')) to every SELECT, UPDATE, and DELETE query.",
    "Application-layer authorization checks (like adding WHERE tenant_id = ...) are prone to developer omission; forgetting the WHERE clause in a single query leaks all tenant records. With RLS enabled: 1) When a database connection is borrowed, the application sets a session variable: SET LOCAL app.current_tenant_id = 'tenant-123'; 2) The database engine applies the security policy transparently to all queries; 3) Even if a developer writes 'SELECT * FROM documents', PostgreSQL only returns rows matching tenant-123.",
    `-- PostgreSQL RLS Setup for Multi-Tenant Isolation
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY; -- Enforce even on table owners!

CREATE POLICY tenant_isolation_policy ON documents
  AS RESTRICTIVE
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);

-- Application Execution:
-- BEGIN;
-- SET LOCAL app.current_tenant_id = 'a1b2c3d4-...';
-- SELECT * FROM documents; -- Returns ONLY matching tenant records!
-- COMMIT;`,
    "Always enable FORCE ROW LEVEL SECURITY on PostgreSQL tables so that migrations and service users with table ownership cannot accidentally bypass policies.",
    ["rls", "row-level-security", "postgresql", "multi-tenancy"]
  ),
  card(
    33,
    cat,
    "Broken Function Level Authorization (BFLA)",
    "must-know",
    "intermediate",
    "What is Broken Function Level Authorization (BFLA) and why does it frequently affect administrative API routes?",
    "BFLA occurs when an application exposes sensitive administrative functions (e.g. DELETE /api/v1/users/export or PUT /api/v1/users/roles) without validating that the authenticated user possesses administrative privileges.",
    "BFLA is #5 on the OWASP API Security Top 10. Developers often secure the visual UI (hiding the 'Admin' link in the dashboard navigation for regular users), but assume that because the API endpoint is obscure or undocumented, unauthorized users will not find it. Attackers inspect JavaScript bundles, brute-force common endpoints (e.g. /api/admin/users, /v1/export-all), or change HTTP verbs (e.g. converting a GET /users/1 to DELETE /users/1). Remediation requires automated schema-level authorization guards and negative test suites asserting 403 on all privileged endpoints for non-admin tokens.",
    `// BFLA Vulnerable Endpoint (Missing Role Assertion):
// app.delete('/api/v1/tenants/:id', authenticateToken, async (req, res) => { await db.deleteTenant(req.params.id); });

// Hardened Endpoint (Explicit Function-Level Authorization Check):
import { requirePermission } from '@/lib/auth';

app.delete(
  '/api/v1/tenants/:id',
  authenticateToken,
  requirePermission('system:tenant:delete'), // Strict capability guard!
  async (req, res) => {
    await db.deleteTenant(req.params.id);
    res.json({ success: true });
  }
);`,
    "Never rely on 'security through obscurity' for API routes. If an endpoint performs a privileged action, verify explicit permissions on the server.",
    ["bfla", "owasp-api-5", "authorization", "rbac-flaw"]
  ),
  card(
    34,
    cat,
    "TOCTOU (Time-of-Check to Time-of-Use) Race Conditions",
    "advanced",
    "advanced",
    "How do TOCTOU race conditions subvert authorization and balance checks in financial and rate-limiting systems?",
    "A TOCTOU race condition occurs when the system checks an authorization condition or resource balance at Time T1, but the state changes before the action is executed at Time T2, allowing concurrent operations to bypass limits.",
    "In financial transfers or coupon redemptions, an attacker sends 10 concurrent requests simultaneously. If the application does: 1) Check balance (Balance = $100); 2) Deduct balance and send $100; all 10 concurrent threads read Balance = $100 simultaneously before any thread commits the deduction, resulting in the user sending $1,000 from a $100 account (Double-Spending). Mitigations: 1) Pessimistic database locking: SELECT ... FOR UPDATE; 2) Atomic conditional SQL updates: UPDATE accounts SET balance = balance - 100 WHERE id = $1 AND balance >= 100; 3) Distributed locks with Redis Redlock.",
    `// Atomic SQL Update eliminating TOCTOU double-spend
export async function withdrawFundsSafely(accountId: string, amount: number): Promise<boolean> {
  // ATOMIC: Check and mutation happen in a single, indivisible database row lock
  const result = await db.query(
    \`UPDATE accounts 
     SET balance = balance - $1, 
         updated_at = NOW() 
     WHERE id = $2 
       AND balance >= $1
     RETURNING balance\`,
    [amount, accountId]
  );

  // If 0 rows updated, balance was insufficient at the exact moment of execution
  return (result.rowCount ?? 0) > 0;
}`,
    "Whenever you see 'if (isValid) { doAction() }' across two separate database queries, assume an adversary can exploit a TOCTOU race condition under concurrency.",
    ["toctou", "race-conditions", "double-spend", "atomic-updates"]
  ),
  card(
    35,
    cat,
    "Dynamic Step-Up Authentication & Contextual Authorization",
    "must-know",
    "intermediate",
    "What is Step-Up Authentication and when should applications require dynamic re-authentication during an active session?",
    "Step-Up Authentication is an authorization pattern where an already authenticated user is prompted to provide an additional authentication factor (such as biometric verification or FIDO2 key) before executing high-risk operations.",
    "Maintaining maximum friction across every page load degrades user experience, but relying on a single login prompt for hours creates extreme vulnerability if a laptop is left unlocked or a session cookie is stolen. Step-Up authentication triggers dynamically on high-risk actions: changing master password, modifying bank wire payout details, generating API root keys, or transferring ownership. The server verifies an auth_time claim or checks a short-lived step-up token issued within the last 5 minutes.",
    `// Step-Up Verification Middleware
export function requireRecentAuth(maxAgeSeconds: number = 300) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authTime = req.session?.lastMfaTimestamp; // Unix seconds
    const now = Math.floor(Date.now() / 1000);

    if (!authTime || (now - authTime) > maxAgeSeconds) {
      return res.status(403).json({
        error: "STEP_UP_REQUIRED",
        message: "High-risk operation requires step-up authentication within past 5 minutes."
      });
    }
    next();
  };
}`,
    "Step-Up authentication neutralizes session hijackers who steal cookie tokens, as they cannot execute high-risk mutations without the physical second factor.",
    ["step-up-auth", "contextual-security", "adaptive-auth", "risk-engine"]
  ),
  card(
    36,
    cat,
    "OAuth Scopes vs User Permissions Mapping",
    "must-know",
    "intermediate",
    "Why are OAuth scopes not the same as internal user permissions, and how should applications intersect both?",
    "OAuth scopes define what a third-party application is allowed to do on behalf of a user (consent delegation), whereas user permissions define what the user themselves is actually allowed to do within the enterprise system.",
    "A common architectural error is equating OAuth scopes directly with user privileges: if a token has scope 'orders:delete', the API allows deleting orders. However, if the user granting the token is an unprivileged intern who lacks order deletion rights, the client application still cannot delete orders! True permission is the intersection: Effective Permissions = User Permissions ∩ Token Scopes. An application must first verify that the user has the permission, and second verify that the token grants the corresponding scope.",
    `// Effective Authorization Intersection Calculation
export function authorizeRequest(userPermissions: Set<string>, tokenScopes: Set<string>, requiredCapability: string): boolean {
  // 1. Does the human user possess the permission in the tenant?
  const userHasRight = userPermissions.has(requiredCapability);

  // 2. Did the user delegate that scope to this specific OAuth client?
  const tokenHasScope = tokenScopes.has(requiredCapability);

  // Both must be true for the API request to proceed
  return userHasRight && tokenHasScope;
}`,
    "OAuth scopes can only attenuate (reduce) user permissions; they can NEVER elevate or grant permissions beyond what the underlying user possesses.",
    ["oauth-scopes", "permissions", "delegation", "least-privilege"]
  )
];
