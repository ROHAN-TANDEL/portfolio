const { card } = require("../ms_builder_helper.cjs");

const cards = [
  card(
    97,
    "Zero-Trust Architecture: Never Trust, Always Verify",
    "Security",
    "Mastery",
    "Zero-Trust eliminates the flawed 'perimeter security' model (where internal networks are blindly trusted). Every request—whether originating from outside the corporate firewall or laterally between internal microservices—must be authenticated, authorized, and encrypted.",
    `// Zero-Trust Core Tenants (NIST SP 800-207):
// 1. Assume Breach: Assume hostile actors exist within the internal VPC network.
// 2. Explicit Verification: Always authenticate workload identity (mTLS) AND user identity (JWT/OAuth).
// 3. Least Privilege Access: Restrict lateral service-to-service connectivity to only explicitly approved routes.
// 4. Encrypt Everywhere: Plaintext HTTP inside the cluster is strictly forbidden.

// Verification Checklist implemented at every Microservice Pod:
export async function zeroTrustGuard(req: Request, res: Response, next: NextFunction) {
  // 1. Workload Verification: Verify caller is an authorized internal pod via mTLS SAN
  const clientCert = req.socket.getPeerCertificate();
  const spiffeId = clientCert?.subjectaltname; // e.g. "spiffe://prod/sa/order-service"
  if (!isAuthorizedService(spiffeId)) {
    return res.status(403).json({ error: "Forbidden: Workload identity unauthorized" });
  }

  // 2. User Identity Verification: Cryptographically inspect forwarded identity token
  const userToken = req.headers["x-user-identity-jwt"] as string;
  const verifiedClaims = await verifyInternalClaimsToken(userToken);
  if (!verifiedClaims) {
    return res.status(401).json({ error: "Unauthorized: Invalid user identity assertion" });
  }

  // 3. Least Privilege Route Authorization
  if (!canAccessRoute(spiffeId, verifiedClaims.roles, req.method, req.path)) {
    return res.status(403).json({ error: "Forbidden: Insufficient privileges" });
  }

  next();
}`,
    ["Zero-Trust", "mTLS", "Workload Identity", "Least Privilege", "NIST"],
    [
      { title: "NIST Special Publication 800-207: Zero Trust Architecture", url: "https://csrc.nist.gov/publications/detail/sp/800-207/final" }
    ],
    "Why is the traditional 'Castle-and-Moat' perimeter security model fatal in microservices?",
    "If an attacker penetrates the perimeter (via a compromised third-party library, an SSRF vulnerability, or an insider threat), the flat internal network allows them to move laterally without restriction, sniffing plaintext database credentials and compromising every service.",
    "What are the three pillars of identity verification in a Zero-Trust microservice request?",
    "Workload Identity (who is the calling service?), User Identity (on whose behalf is the call made?), and Contextual Authorization (is this user and service allowed to perform this exact action at this time?)."
  ),

  card(
    98,
    "Edge Authentication vs Downstream Authorization",
    "Security",
    "Mastery",
    "In microservices, Authentication (verifying who you are) is offloaded to the API Gateway perimeter, while Authorization (verifying what you are allowed to do with specific domain records) must be evaluated locally within individual domain microservices.",
    `// Perimeter Authentication vs Local Domain Authorization:
// 1. API Gateway (Authentication):
//    - Validates public bearer tokens against identity providers (Auth0 / Okta / Keycloak).
//    - Terminates invalid tokens before they consume internal cluster compute.
//    - Injects standardized, sanitized user claims into internal request headers.

// 2. Domain Microservice (Domain Authorization):
//    - Gateway cannot know: "Does user #459 own Project #1293?"
//    - Only Project Microservice has the relational database tables to check row-level ownership.

export class DocumentService {
  constructor(private repo: DocumentRepository) {}

  // Local Domain Authorization Guard:
  async updateDocument(docId: string, payload: any, currentUserId: string, userRoles: string[]) {
    // Check if user is SuperAdmin
    if (userRoles.includes("ROLE_SUPERADMIN")) {
      return this.repo.update(docId, payload);
    }

    // Row-level ownership check (MUST happen inside domain service!)
    const doc = await this.repo.findById(docId);
    if (!doc) throw new NotFoundError("Document not found");

    if (doc.ownerId !== currentUserId) {
      // User is authenticated, but NOT authorized to edit this specific record!
      throw new ForbiddenError("You do not have permission to modify this document");
    }

    return this.repo.update(docId, payload);
  }
}`,
    ["Authentication", "Authorization", "RBAC", "Row-Level Security", "API Gateway"],
    [
      { title: "OWASP Microservices Security Cheat Sheet", url: "https://cheatsheetseries.owasp.org/cheatsheets/Microservices_Security_Cheat_Sheet.html" }
    ],
    "Why shouldn't the API Gateway perform fine-grained domain authorization (such as checking document ownership)?",
    "It tightly couples the gateway to domain databases. The gateway would need direct read access to document tables, tenant hierarchies, and business rules, destroying microservice encapsulation and creating a massive bottleneck for every domain schema change.",
    "What HTTP status code distinguishes an authentication failure from an authorization failure?",
    "HTTP `401 Unauthorized` indicates that authentication is missing or invalid (the system does not know who you are). HTTP `403 Forbidden` indicates that authentication succeeded, but the verified identity lacks permission to access the resource."
  ),

  card(
    99,
    "OAuth 2.0 & OpenID Connect (OIDC) Flow in Microservices",
    "Security",
    "Mastery",
    "OAuth 2.0 is the industry-standard authorization framework, and OpenID Connect (OIDC) is the identity layer built on top of it. In microservices, clients exchange authorization codes via PKCE for ID Tokens and Access Tokens issued by a centralized Identity Provider (IdP).",
    `// OAuth 2.0 / OIDC Token Roles:
// - ID Token: JWT containing user identity profile assertions (sub, email, name). Intended for client UI.
// - Access Token: Bearer token (JWT or opaque) presented to API Gateway to grant access to protected APIs.
// - Refresh Token: Long-lived opaque string used to acquire fresh Access Tokens without re-prompting login.

// Authorization Code Flow with PKCE (Proof Key for Code Exchange) Sequence:
// 1. Mobile/Web Client generates random code_verifier and derives code_challenge = SHA256(verifier).
// 2. Client redirects user to IdP: /authorize?response_type=code&code_challenge=...
// 3. User authenticates; IdP redirects back to Client with authorization_code.
// 4. Client posts authorization_code + original code_verifier directly to IdP /token endpoint.
// 5. IdP verifies hash match; issues Access Token + ID Token.
// 6. Client attaches Access Token in HTTP header: "Authorization: Bearer <token>" to API Gateway.

export class TokenInspector {
  static extractBearerToken(authHeader?: string): string {
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Missing or malformed Authorization header");
    }
    return authHeader.substring(7).trim();
  }
}`,
    ["OAuth 2.0", "OIDC", "PKCE", "JWT", "Access Token"],
    [
      { title: "RFC 7636: PKCE for OAuth 2.0", url: "https://datatracker.ietf.org/doc/html/rfc7636" }
    ],
    "Why is the Authorization Code Flow with PKCE mandatory for Single Page Apps (React/Angular) and Mobile Apps?",
    "Public clients cannot safely store a client secret. Without PKCE, malicious apps or browser extensions could intercept the authorization code from redirect URIs and exchange it for access tokens. PKCE cryptographically binds the token request to the original caller.",
    "What is the difference between an Access Token and an ID Token?",
    "An ID Token is for the client application to know who the user is (contains display name, avatar, email). An Access Token is an authorization credential for calling API Gateway and microservice endpoints, telling the API which scopes and permissions the client holds."
  ),

  card(
    100,
    "Stateless JWT Verification & Cryptographic JWKS Caching",
    "Security",
    "Mastery",
    "Microservices verify JSON Web Tokens (JWT) statelessly without querying the Identity Provider database on every request. Services download the IdP's JSON Web Key Set (JWKS), verify the cryptographic signature locally, and cache public keys with automated rotation.",
    `// Fast Stateless JWT Verification using jose & JWKS Cache:
import * as jose from "jose";

export class StatelessJwtVerifier {
  private jwks: ReturnType<typeof jose.createRemoteJWKSet>;

  constructor(private idpIssuerUrl: string) {
    // createRemoteJWKSet automatically caches keys in memory and handles key rotation!
    this.jwks = jose.createRemoteJWKSet(
      new URL(\`\${idpIssuerUrl}/.well-known/jwks.json\`),
      {
        cacheMaxAge: 10 * 60 * 1000, // Cache public keys for 10 minutes
        cooldownDuration: 30 * 1000  // Limit key refetches to at most once per 30s
      }
    );
  }

  async verifyAccessToken(token: string) {
    try {
      const { payload, protectedHeader } = await jose.jwtVerify(token, this.jwks, {
        issuer: this.idpIssuerUrl,
        audience: "https://api.enterprise.com",
        algorithms: ["RS256", "ES256"] // Strictly enforce asymmetric cryptographic algorithms!
      });

      return payload;
    } catch (err: any) {
      throw new Error(\`Token verification failed: \${err.message}\`);
    }
  }
}`,
    ["JWT", "JWKS", "Public Key Cryptography", "Stateless Verification", "jose"],
    [
      { title: "RFC 7517: JSON Web Key (JWK)", url: "https://datatracker.ietf.org/doc/html/rfc7517" }
    ],
    "Why must JWT verification strictly enforce asymmetric algorithms (`RS256` / `ES256`) and forbid `none` or `HS256`?",
    "The 'Algorithm Confusion Attack'. If a verifier blindly accepts whatever algorithm is declared in the JWT header, an attacker can tamper with a token using the IdP's public key as an HMAC symmetric secret (`HS256`), forging valid admin tokens without knowing private keys.",
    "How does a microservice instantly revoke a compromised stateless JWT before its expiration time?",
    "Because JWTs are stateless, instant revocation requires either keeping token TTLs extremely short (e.g. 5–15 minutes) or publishing a real-time 'Revocation Blacklist' (or Bloom filter) of compromised `jti` (JWT ID) claims across Redis caches."
  ),

  card(
    101,
    "Identity Propagation: Forwarding Claims Downstream",
    "Security",
    "Deep Dive",
    "When a request passes through the API Gateway and traverses multiple downstream microservices, the user's identity and tenant context must be propagated securely without passing raw sensitive credentials or allowing downstream spoofing.",
    `// Identity Propagation Approaches:
// 1. Header Injection (Trusted Subnet): Gateway strips external 'x-user-*' headers, validates public JWT,
//    and injects verified headers: 'X-User-Id: 123', 'X-Tenant-Id: acme'.
//    Hazard: If internal network is flat, any compromised container can forge 'X-User-Id: admin'.

// 2. Cryptographic Internal Tokens (Zero-Trust Token Minting):
//    Gateway exchanges external user JWT for a short-lived internal JWT signed by Gateway private key.
//    Downstream services verify the internal signature and extract claims.

// Fastify Gateway Minting Short-Lived Downstream Internal Token:
import * as jose from "jose";

const internalPrivateKey = await jose.importPKCS8(process.env.INTERNAL_SIGNING_KEY!, "EdDSA");

export async function mintDownstreamContextToken(userClaims: any, targetService: string) {
  return new jose.SignJWT({
    sub: userClaims.sub,
    tenant_id: userClaims.tenant_id,
    roles: userClaims.roles,
    scope: userClaims.scope
  })
    .setProtectedHeader({ alg: "EdDSA" })
    .setIssuedAt()
    .setIssuer("api-gateway")
    .setAudience(targetService) // Explicit audience binding restricts misuse
    .setExpirationTime("2m")    // Ephemeral 2-minute lifetime
    .sign(internalPrivateKey);
}`,
    ["Identity Propagation", "Token Minting", "Audience Restriction", "Context Propagation", "Zero-Trust"],
    [
      { title: "OWASP: Propagating Identity in Microservices", url: "https://owasp.org/www-project-integration-security/" }
    ],
    "Why must the API Gateway strip all incoming headers matching `X-User-*` or `X-Forwarded-*` from public client requests?",
    "Header Injection Vulnerability. If the gateway blindly passes through client headers, a malicious external user could send `X-User-Id: 0` or `X-User-Role: Admin`, tricking unauthenticated downstream microservices into executing privileged actions.",
    "What is the benefit of audience restriction (`aud`) in downstream internal tokens?",
    "If Service A calls Service B with an internal token scoped to `aud: service-b`, Service B cannot maliciously replay that token to impersonate the user when communicating with Service C (Payment), preventing lateral impersonation attacks."
  ),

  card(
    102,
    "Service Authorization with Open Policy Agent (OPA & Rego)",
    "Security",
    "Mastery",
    "Open Policy Agent (OPA) decouples authorization policy from microservice code. Policies are written declaratively in Rego and evaluated locally by an OPA sidecar or in-memory WebAssembly engine with sub-millisecond latency.",
    `// OPA Policy written in Rego (policy.rego):
// Enforces fine-grained Attribute-Based Access Control (ABAC)
/*
package microservices.authz

default allow = false

# Rule 1: Admins can do anything
allow {
    input.user.roles[_] == "ADMIN"
}

# Rule 2: Order service can call Payment service if tenant matches and action is charge
allow {
    input.caller.service == "order-service"
    input.target.service == "payment-service"
    input.http_method == "POST"
    input.path == ["v1", "charges"]
    input.user.tenant_id == input.target.tenant_id
}

# Rule 3: Regular users can read their own profile
allow {
    input.http_method == "GET"
    input.path = ["v1", "users", user_id]
    user_id == input.user.id
}
*/

// Node.js Microservice checking OPA policy sidecar:
import axios from "axios";

export async function authorizeRequest(req: Request) {
  const opaPayload = {
    input: {
      caller: { service: req.headers["x-workload-id"] },
      target: { service: "payment-service", tenant_id: req.headers["x-tenant-id"] },
      user: (req as any).user,
      http_method: req.method,
      path: req.path.split("/").filter(Boolean)
    }
  };

  const { data } = await axios.post("http://127.0.0.1:8181/v1/data/microservices/authz/allow", opaPayload);

  if (data.result !== true) {
    throw new Error("HTTP 403: Forbidden by OPA Policy Engine");
  }
}`,
    ["OPA", "Rego", "Authorization", "ABAC", "Policy as Code"],
    [
      { title: "Open Policy Agent Documentation", url: "https://www.openpolicyagent.org/docs/latest/" }
    ],
    "What is the advantage of using OPA as a local sidecar rather than a centralized remote authorization service?",
    "Performance and resilience. Checking permissions is on the critical path of every single HTTP request. An OPA sidecar evaluates in-memory via localhost in < 1 millisecond, avoiding remote network hops and eliminating a centralized single point of failure.",
    "What is the core difference between RBAC (Role-Based) and ABAC (Attribute-Based Access Control)?",
    "RBAC checks static roles (e.g. `role == 'EDITOR'`). ABAC evaluates contextual attributes in real time—combining user role, IP subnet, time of day, resource ownership, and tenant bounds (e.g. 'Can edit this document only during business hours from company IP')."
  ),

  card(
    103,
    "Dynamic Secrets Management with HashiCorp Vault",
    "Security",
    "Mastery",
    "Hardcoding database passwords and API keys in environment variables or configuration files creates high-risk credential leaks. Dynamic Secrets engines in HashiCorp Vault generate unique, short-lived, automatically rotating credentials on-demand per pod.",
    `// HashiCorp Vault Dynamic PostgreSQL Secret Workflow:
// 1. Microservice pod starts with a short-lived Kubernetes Service Account token.
// 2. Pod authenticates to Vault via Vault Kubernetes Auth method.
// 3. Pod requests database credentials: /v1/database/creds/order-service-role.
// 4. Vault connects to PostgreSQL, creates a temporary DB user (v-kub-order-xyz) with 1-hour lease.
// 5. When lease expires, Vault automatically drops the user from the database!

// Kubernetes Vault Agent Sidecar Injector annotation (Deployment YAML):
/*
apiVersion: apps/v1
kind: Deployment
metadata:
  name: order-service
spec:
  template:
    metadata:
      annotations:
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "order-service-role"
        vault.hashicorp.com/agent-inject-secret-database-config: "database/creds/order-role"
        vault.hashicorp.com/agent-inject-template-database-config: |
          {{- with secret "database/creds/order-role" -}}
          DATABASE_URL="postgres://{{ .Data.username }}:{{ .Data.password }}@postgres:5432/orders"
          {{- end -}}
    spec:
      containers:
        - name: app
          image: order-service:latest
*/`,
    ["Vault", "Dynamic Secrets", "Secret Rotation", "Kubernetes Auth", "Credential Hygiene"],
    [
      { title: "HashiCorp Vault Dynamic Secrets Guide", url: "https://developer.hashicorp.com/vault/docs/secrets/databases" }
    ],
    "Why are Dynamic Secrets vastly superior to static environment variable secrets (`.env` or K8s Secrets)?",
    "Static secrets remain valid indefinitely and are shared across all pods; if one pod is compromised or an engineer logs an env var, the attacker has permanent access. Dynamic secrets are unique per pod, expire in minutes, and can be revoked instantly without restarting other pods.",
    "What happens when a microservice fails to renew its dynamic secret lease with Vault?",
    "Vault triggers its lease expiration reaper, connecting to the downstream database and issuing `REVOKE` and `DROP USER`, instantly invalidating the database credentials."
  ),

  card(
    104,
    "HMAC Request Signing for Inter-Service Webhooks",
    "Security",
    "Deep Dive",
    "When microservices publish asynchronous HTTP webhooks to external partners or untrusted endpoints, they must guarantee payload integrity and authenticity using Hash-based Message Authentication Codes (HMAC SHA-256) with replay protection timestamps.",
    `// Robust HMAC-SHA256 Webhook Signing Implementation (Stripe standard):
import crypto from "node:crypto";

export class WebhookSigner {
  static sign(payload: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = crypto
      .createHmac("sha256", secret)
      .update(\`t=\${timestamp}.\${payload}\`)
      .digest("hex");

    return \`t=\${timestamp},v1=\${signature}\`;
  }

  static verify(payload: string, header: string, secret: string, toleranceSeconds = 300): boolean {
    const parts = header.split(",");
    const tPart = parts.find(p => p.startsWith("t="));
    const v1Part = parts.find(p => p.startsWith("v1="));

    if (!tPart || !v1Part) return false;

    const timestamp = parseInt(tPart.split("=")[1], 10);
    const signature = v1Part.split("=")[1];

    // 1. Replay Attack Defense: Verify timestamp is within 5 minutes
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - timestamp) > toleranceSeconds) {
      throw new Error("Webhook rejected: Timestamp expired (Replay Attack)");
    }

    // 2. Compute expected HMAC
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(\`t=\${timestamp}.\${payload}\`)
      .digest("hex");

    // 3. Constant-time comparison prevents timing attacks!
    const sigBuffer = Buffer.from(signature, "hex");
    const expBuffer = Buffer.from(expectedSignature, "hex");

    if (sigBuffer.length !== expBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, expBuffer);
  }
}`,
    ["HMAC", "Request Signing", "Timing Attack", "Replay Protection", "Webhooks"],
    [
      { title: "Stripe Webhook Signatures", url: "https://stripe.com/docs/webhooks/signatures" }
    ],
    "Why must signature comparison ALWAYS use `crypto.timingSafeEqual` rather than the `===` operator?",
    "The standard `===` operator returns false on the very first mismatched byte. An attacker can measure nanosecond differences in network response times to deduce the correct signature character by character (Timing Attack). `timingSafeEqual` executes in constant time.",
    "What vulnerability does including a timestamp (`t=...`) inside the signed HMAC payload prevent?",
    "Replay Attacks. Without a timestamp, an attacker who intercepts a valid webhook request can re-transmit the exact same raw payload and valid signature hours later to re-execute operations (like crediting an account twice)."
  ),

  card(
    105,
    "Web Application Firewall (WAF) Integration & API Defense",
    "Security",
    "Mastery",
    "A Web Application Firewall (AWS WAF, Cloudflare, ModSecurity) filters malicious HTTP traffic before it reaches API Gateways. It inspects bodies and query parameters for SQL Injection, Cross-Site Scripting (XSS), credential stuffing, and bot traffic.",
    `// WAF Ingress Architecture:
// [Public Clients] -> [Edge CDN / WAF] -> [API Gateway] -> [Internal Microservices]

// AWS WAF Rule Group Configuration (Terraform snippet):
/*
resource "aws_wafv2_web_acl" "api_gateway_waf" {
  name  = "api-perimeter-defense"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  # Rule 1: Block Common Web Exploits (OWASP Top 10)
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "CommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  # Rule 2: SQL Injection Defense on Query Parameters
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 2
    override_action { none {} }
    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }
  }
}
*/`,
    ["WAF", "Perimeter Defense", "SQL Injection", "OWASP Top 10", "AWS WAF"],
    [
      { title: "AWS WAF Architecture Guide", url: "https://docs.aws.amazon.com/waf/latest/developerguide/what-is-aws-waf.html" }
    ],
    "Why does having a WAF at the edge NOT exempt microservices from implementing local input validation?",
    "Defense-in-Depth. Advanced obfuscation or novel zero-day attack payloads can bypass WAF heuristic regexes. Microservices must still enforce strict schema validation (Zod, Protobuf) and parameterized database queries.",
    "What is the difference between a WAF in 'Count/Detect' mode versus 'Block' mode?",
    "In 'Count/Detect' mode, the WAF monitors and logs matching malicious requests without dropping them, allowing teams to test for false positives. In 'Block' mode, offending requests are terminated with HTTP 403 Forbidden immediately at the edge."
  ),

  card(
    106,
    "Server-Side Request Forgery (SSRF) Defense in Microservices",
    "Security",
    "Mastery",
    "Server-Side Request Forgery (SSRF) occurs when a microservice fetches a remote URL provided by a user (e.g. Webhook delivery, Avatar import, PDF rendering). Attackers exploit this to force the service to connect to internal AWS metadata (`169.254.169.254`) or internal VPC databases.",
    `// SSRF Vulnerability Example (Dangerous):
// app.post("/import-avatar", async (req, res) => {
//   const img = await fetch(req.body.imageUrl); // Attacker passes: http://169.254.169.254/latest/meta-data/iam/
// });

// Hardened SSRF-Safe HTTP Client (IP Resolution & Private Range Validation):
import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

export async function safeFetch(targetUrl: string): Promise<Response> {
  const parsed = new URL(targetUrl);

  // 1. Only allow HTTP and HTTPS protocols
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Invalid protocol: Only HTTP/S allowed");
  }

  // 2. Resolve DNS hostname to raw IP addresses
  const addresses = await dns.resolve4(parsed.hostname);
  if (addresses.length === 0) throw new Error("Could not resolve hostname");

  for (const ip of addresses) {
    const addr = ipaddr.parse(ip);
    const range = addr.range();

    // 3. Reject all private, loopback, link-local, and cloud metadata ranges!
    if (["loopback", "private", "linkLocal", "carrierGradeNat"].includes(range)) {
      throw new Error(\`SSRF Blocked: Destination IP \${ip} is within forbidden range \${range}\`);
    }

    // Explicit block for Cloud Metadata IP (169.254.169.254)
    if (ip === "169.254.169.254") {
      throw new Error("SSRF Blocked: Attempted access to Cloud Metadata service");
    }
  }

  // 4. Safe to execute network call
  return fetch(targetUrl);
}`,
    ["SSRF", "Cloud Metadata", "IP Pinning", "DNS Rebinding", "Vulnerability Defense"],
    [
      { title: "OWASP Server-Side Request Forgery Prevention", url: "https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html" }
    ],
    "Why must SSRF defense validate resolved IP addresses rather than just checking the hostname string?",
    "DNS Rebinding and Hostname Spoofing. An attacker can register a domain (e.g. `evil.com`) that passes string checks but resolves its DNS `A` record to `127.0.0.1` or `169.254.169.254`, bypassing regex-based hostname filters.",
    "What AWS metadata feature mitigates SSRF credential theft on EC2 / ECS?",
    "IMDSv2 (Instance Metadata Service Version 2). Unlike IMDSv1 which accepted simple GET requests, IMDSv2 requires a session-oriented `PUT` request with a secret token header (`X-aws-ec2-metadata-token`), which blind SSRF attacks cannot easily construct."
  ),

  card(
    107,
    "PII Data Vaulting, Pseudonymization & Encryption at Rest",
    "Security",
    "Deep Dive",
    "Under GDPR, HIPAA, and CCPA, Personally Identifiable Information (PII: Social Security Numbers, emails, phone numbers) must not be scattered across dozens of microservice databases. An isolated PII Data Vault stores sensitive raw data, returning pseudonymized tokens to other services.",
    `// PII Data Vault Architecture:
// [Client] -> Order Service (Stores only: { orderId: "ord-1", customerToken: "tok_9918ab" })
//                  |
//                  v (Strictly Audited & Encrypted)
//             [PII Vault Service] (Stores: { customerToken: "tok_9918ab", realEmail: "user@domain.com" })

// Envelope Encryption Implementation using AWS KMS (Node.js):
import { KMSClient, GenerateDataKeyCommand } from "@aws-sdk/client-kms";
import crypto from "node:crypto";

const kms = new KMSClient({ region: "us-east-1" });

export class EnvelopeEncryption {
  constructor(private kmsKeyId: string) {}

  async encryptPii(plaintext: string) {
    // 1. Ask KMS to generate a unique Data Encryption Key (DEK)
    const cmd = new GenerateDataKeyCommand({ KeyId: this.kmsKeyId, KeySpec: "AES_256" });
    const { Plaintext: rawDek, CiphertextBlob: encryptedDek } = await kms.send(cmd);

    // 2. Encrypt PII locally with AES-256-GCM using plaintext DEK
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", rawDek!, iv);
    const encryptedData = Buffer.concat([cipher.update(plaintext, "utf-8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 3. Zero-out plaintext DEK from RAM immediately!
    rawDek!.fill(0);

    // 4. Return Encrypted Payload bundled with Encrypted DEK
    return {
      ciphertext: encryptedData.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      encryptedDek: Buffer.from(encryptedDek!).toString("base64")
    };
  }
}`,
    ["PII Vaulting", "Envelope Encryption", "AWS KMS", "GDPR", "Pseudonymization"],
    [
      { title: "AWS KMS Envelope Encryption Concepts", url: "https://docs.aws.amazon.com/kms/latest/developerguide/concepts.html#enveloping" }
    ],
    "What is Envelope Encryption and why is it preferred over encrypting everything directly with KMS API calls?",
    "In Envelope Encryption, KMS encrypts only a small Data Encryption Key (DEK). The actual large payload is encrypted locally using the DEK with AES-GCM. This avoids KMS API rate limits, minimizes network latency, and prevents sending raw customer PII over the network to KMS.",
    "How does a PII Vault simplify GDPR 'Right to be Forgotten' (Account Deletion) compliance?",
    "Instead of running deletion queries across 40 different microservice databases, you delete the customer record from the centralized PII Vault (or destroy its encryption key). All pseudonymized tokens in other services instantly become irreversibly anonymized cryptoshredded data."
  ),

  card(
    108,
    "Secret Sprawl & GitOps Credential Hygiene",
    "Security",
    "Mastery",
    "Secret sprawl occurs when API keys, passwords, and tokens leak into Git commit histories, Docker image layers, and CI/CD logs. GitOps pipelines use pre-commit scanning (Gitleaks, Trufflehog) and secret encryption tools (SOPS, Sealed Secrets) to enforce hygiene.",
    `// GitOps Secret Encryption Workflow with Mozilla SOPS & AWS KMS:
// 1. Developer edits plaintext secret.yaml locally.
// 2. SOPS encrypts only the 'data' values while keeping YAML keys readable for git diffs:
//    sops --encrypt --kms arn:aws:kms:... secret.dec.yaml > secret.enc.yaml
// 3. Encrypted secret is safely committed to public/private Git repository!
// 4. ArgoCD / Flux controller inside Kubernetes decrypts the file on the fly using in-cluster IAM role.

// Pre-Commit Secret Scanner Configuration (.pre-commit-config.yaml):
/*
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks
        name: Detect Hardcoded Secrets
        entry: gitleaks protect --verbose --redact --staged
        language: golang
*/

// CI/CD GitHub Actions Secret Gate:
/*
name: Security Audit
on: [push, pull_request]
jobs:
  trufflehog:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: trufflesecurity/trufflehog@main
        with:
          extra_args: --only-verified
*/`,
    ["Secret Sprawl", "GitOps", "SOPS", "Gitleaks", "Trufflehog"],
    [
      { title: "Mozilla SOPS: Secrets Management", url: "https://github.com/getsops/sops" }
    ],
    "Why does deleting a leaked secret in a subsequent Git commit fail to remediate a security leak?",
    "Git is an immutable version-controlled ledger. The secret remains permanently readable in commit history and reflogs. Automated bot crawlers scrape public GitHub repos within seconds of commit. Remediating requires immediately revoking the secret at the provider and rewriting git history.",
    "How do Bitnami Sealed Secrets secure credentials in GitOps?",
    "Sealed Secrets uses asymmetric cryptography. Developers encrypt secrets using a public key provided by the cluster controller. The encrypted `SealedSecret` CRD can be safely stored in public Git; only the in-cluster controller possesses the private key to unseal it into a real Kubernetes Secret."
  )
];

module.exports = { cards };
