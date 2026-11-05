const { createCard } = require("../hld_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 85,
    category: "Security, Identity & Distributed Access",
    concept: "OAuth 2.0 & OpenID Connect (OIDC) Architecture",
    priority: "must-know",
    difficulty: "must-know",
    question: "Walk through the OAuth 2.0 Authorization Code Grant with PKCE, explain the difference between OAuth 2.0 and OIDC, and define Access Tokens vs ID Tokens.",
    answer: "OAuth 2.0 is an authorization framework issuing Access Tokens for resource delegation; OpenID Connect (OIDC) is an identity layer on top of OAuth 2.0 that provides an ID Token (JWT) containing authenticated user profile claims. The Authorization Code flow with PKCE prevents authorization code interception attacks on public clients (mobile/SPA) using dynamic cryptographic code verifiers and challenges.",
    explanation: `OAuth 2.0 vs OIDC:
- **OAuth 2.0**: Answers 'What is this client authorized to access?' (Delegated Authorization). Issues an \`access_token\`.
- **OpenID Connect (OIDC)**: Answers 'Who is the user, and how were they authenticated?' (Identity & Authentication). Issues an \`id_token\` (standardized JWT).

Authorization Code Flow with PKCE (Proof Key for Code Exchange):
1. Client generates a cryptographic random string: \`code_verifier\`.
2. Computes \`code_challenge = BASE64URL(SHA256(code_verifier))\`.
3. Client redirects browser to Authorization Server (\`/authorize\`) with \`code_challenge\` and \`code_challenge_method=S256\`.
4. User logs in and grants consent.
5. Authorization Server redirects back to client with a temporary one-time \`authorization_code\`.
6. Client makes a direct POST request to \`/token\`, passing the \`authorization_code\` AND the original secret \`code_verifier\`.
7. Authorization Server hashes the verifier; if it matches the stored challenge, it issues the Access Token, ID Token, and Refresh Token.
- Security Defense: If a malicious app intercepts the \`authorization_code\` from the browser redirect, it cannot redeem it because it lacks the secret \`code_verifier\`!`,
    code: `/*
OAuth 2.0 PKCE Flow:
[ Client App ]                     [ Auth Server (IdP) ]          [ Resource API ]
      │                                       │                          │
      ├── 1. /authorize (code_challenge) ────>│                          │
      │   (User logs in & consents)           │                          │
      │<─ 2. Redirect with Auth Code ─────────┤                          │
      │                                       │                          │
      ├── 3. /token (Auth Code + Verifier) ──>│                          │
      │<─ 4. Returns Access + ID Token ───────┤                          │
      │                                                                  │
      ├── 5. GET /api/v1/profile (Bearer Access Token) ─────────────────>│
      │<── 6. Returns Protected Resource Data ───────────────────────────┤
*/`,
    recallHint: "OAuth = Authorization (Access Token). OIDC = Authentication (ID Token). PKCE protects mobile/SPAs from code theft.",
    interviewTip: "Always recommend OAuth 2.0 with PKCE for single-page apps (React/Angular) and mobile clients. Mention that the legacy Implicit Grant flow is officially deprecated due to token exposure in URLs.",
    tags: ["oauth2", "oidc", "security", "pkce", "jwt", "authentication"]
  }),

  createCard({
    idNum: 86,
    category: "Security, Identity & Distributed Access",
    concept: "Distributed Session Management: Stateless JWT vs Centralized Redis Sessions",
    priority: "must-know",
    difficulty: "must-know",
    question: "Contrast Stateless JWTs with Centralized In-Memory (Redis) Sessions across revocation speed, payload overhead, and horizontal scale.",
    answer: "Stateless JWTs embed signed user claims directly inside the token, allowing microservices to validate authenticity locally in nanoseconds without database lookups ($O(1)$ CPU), but cannot be revoked immediately before TTL expiration; Centralized Redis Sessions store an opaque token on clients and look up session state in Redis on every request, supporting instant revocation and sliding TTLs at the cost of network hops.",
    explanation: `Trade-off Matrix:
1. Stateless JWT (JSON Web Token):
   - Mechanism: Client sends \`Authorization: Bearer <header.payload.signature>\`. Microservice verifies cryptographic signature (RS256 / EdDSA) using the public key.
   - Scalability: Extreme. 1,000 microservices can validate tokens concurrently with zero database network calls.
   - The Revocation Flaw: If a user changes their password, is banned, or has their laptop stolen, the JWT remains completely valid until its \`exp\` claim expires!
   - Mitigation: Use short-lived JWTs (5–15 minutes) paired with a persistent, revocable Refresh Token.
2. Centralized Sessions (Redis Cluster):
   - Mechanism: Client receives a cryptographically random 32-byte opaque session ID (\`sess_9a8f...\`).
   - On every incoming HTTP request, the API Gateway queries \`redis.get("session:sess_9a8f...")\`.
   - Scalability: Requires a resilient, multi-region Redis cluster handling 100,000+ QPS.
   - Immediate Revocation: Banning a user or terminating a session is an instantaneous single \`redis.del()\` command.`,
    code: `// Hybrid Architecture: Short-Lived JWT + Revocable Refresh Token
import jwt from "jsonwebtoken";

// 1. Issue short-lived access token (10 min) + long-lived refresh token (7 days)
function issueTokens(user: { id: string; role: string }) {
  const accessToken = jwt.sign(
    { sub: user.id, role: user.role },
    process.env.JWT_PRIVATE_KEY!,
    { algorithm: "RS256", expiresIn: "10m" }
  );

  const refreshToken = crypto.randomUUID();
  // Store refresh token in Redis mapped to user ID
  redis.setex(\`refresh:\${refreshToken}\`, 7 * 86400, user.id);

  return { accessToken, refreshToken };
}

// 2. Immediate Revocation of Refresh Token
async function logout(refreshToken: string) {
  await redis.del(\`refresh:\${refreshToken}\`); // Instantly prevents renewing access!
}`,
    recallHint: "JWT = fast, stateless, hard to revoke. Redis session = instant revocation, costs a network hop. Best: short JWT + refresh token.",
    interviewTip: "In high-security enterprise designs (banking, healthcare), propose the hybrid model: 10-minute stateless access tokens validated locally, refreshed via revocable tokens stored in Redis.",
    tags: ["jwt", "sessions", "redis", "authentication", "security", "tokens"]
  }),

  createCard({
    idNum: 87,
    category: "Security, Identity & Distributed Access",
    concept: "Zero-Trust Architecture & Mutual TLS (mTLS) in Microservices",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Zero-Trust Architecture, and how does Mutual TLS (mTLS) authenticate both client and server identities across internal VPC networks?",
    answer: "Zero-Trust assumes the internal network is already compromised ('never trust, always verify'). Standard TLS only authenticates the server to the client; Mutual TLS (mTLS) requires both the client and server to exchange and cryptographically verify X.509 digital certificates signed by a trusted internal Certificate Authority (CA), guaranteeing mutual authentication and encryption on every internal RPC hop.",
    explanation: `The Death of Perimeter-Based Security:
- Legacy Castle-and-Moat: The internal corporate network or VPC is assumed safe. Everything behind the firewall runs unencrypted HTTP without inter-service auth.
- The Risk: If an attacker compromises a single bastion host or third-party container, they can sniff unencrypted traffic on the internal subnet (ARP spoofing, packet capturing) and impersonate any service.

Zero-Trust Mechanics via mTLS:
1. Every microservice pod is provisioned with a private key and an X.509 certificate carrying its SPIFFE identity (e.g., \`spiffe://cluster.local/ns/prod/sa/order-service\`).
2. Handshake Sequence:
   - Client verifies Server Certificate against the Root CA.
   - Server requests Client Certificate (\`CertificateRequest\`).
   - Client sends its Certificate; Server verifies signature against Root CA.
3. Both sides negotiate a symmetric session key.
4. Cryptographic Proof: The receiving service extracts the client's SPIFFE identity from the certificate to enforce granular RBAC (e.g., 'Only the Order Service certificate is permitted to invoke Payment Service').`,
    code: `/*
Mutual TLS (mTLS) Handshake:

[ Client Microservice ]                              [ Server Microservice ]
         │                                                      │
         ├─── 1. ClientHello ──────────────────────────────────>│
         │<── 2. ServerHello + Server Certificate + CertRequest ┤
         │                                                      │
         ├─── 3. Client Certificate + Finished ────────────────>│ (Server validates client identity!)
         │<── 4. Handshake Finished ────────────────────────────┤
         │                                                      │
         └─── [ Encrypted Application Data / mTLS Session ] ───┘
*/`,
    recallHint: "Standard TLS: Client checks server. mTLS: Both sides verify each other's certificates. Zero Trust.",
    interviewTip: "Mention that Service Meshes like Istio or Linkerd automatically inject and rotate short-lived mTLS certificates (e.g., 24-hour validity) without requiring application developers to write crypto code.",
    tags: ["zero-trust", "mtls", "security", "certificates", "spiffe", "encryption"]
  }),

  createCard({
    idNum: 88,
    category: "Security, Identity & Distributed Access",
    concept: "Secret Management & Dynamic Key Rotation (HashiCorp Vault, AWS KMS)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why is hardcoding or baking secrets into environment variables dangerous, and how do HashiCorp Vault and AWS KMS manage dynamic secret generation and automated key rotation?",
    answer: "Static secrets in environment variables leak through crash dumps, logs, and container image inspection; compromising a static secret provides indefinite access until manual rotation. Secret management systems (HashiCorp Vault, AWS KMS) provide centralized secret storage with fine-grained IAM policies, audit trails, automated key rotation, and ephemeral dynamic database credentials that expire automatically.",
    explanation: `The Problem with Environment Variable Secrets:
- Hardcoded in Git: Permanent security breach requiring emergency git history rewriting.
- Docker Image Layers: \`ENV DB_PASSWORD=secret\` remains embedded in image metadata viewable via \`docker inspect\`.
- Process Dumps: \`process.env\` is exposed in APM crash traces and logging agents.

HashiCorp Vault Dynamic Secrets Architecture:
- Instead of sharing a static PostgreSQL root password:
  1. Microservice authenticates to Vault using its Kubernetes Service Account token.
  2. Requests database credentials for the \`read-orders\` role.
  3. Vault connects to PostgreSQL, creates a brand-new user with a unique random password:
     \`CREATE USER "v-token-order-svc-18a7" WITH PASSWORD 'XyZ89#...' VALID UNTIL '2026-05-01 14:00';\`
  4. Vault returns the temporary username and password with a 1-hour lease.
  5. If the pod is compromised, the leaked credentials expire within 60 minutes and cannot be reused.
  6. When the lease expires, Vault automatically executes \`DROP USER\`.`,
    code: `// Fetching Ephemeral Secrets from HashiCorp Vault
import vault from "node-vault";

const client = vault({
  endpoint: "https://vault.internal:8200",
  token: process.env.VAULT_TOKEN
});

async function getDatabaseCredentials() {
  // Vault dynamically generates a new temporary DB user on the fly!
  const creds = await client.read("database/creds/order-service-role");
  return {
    username: creds.data.username,
    password: creds.data.password,
    leaseDuration: creds.lease_duration // e.g., 3600 seconds
  };
}`,
    recallHint: "Never bake secrets into images or envs. Vault creates dynamic, ephemeral credentials that self-destruct.",
    interviewTip: "Cite Envelope Encryption (KMS Data Encryption Keys - DEK) when discussing compliance (PCI-DSS, HIPAA): data is encrypted using local DEKs, which are encrypted under a central KMS master key.",
    tags: ["secret-management", "vault", "kms", "encryption", "security", "credentials"]
  }),

  createCard({
    idNum: 89,
    category: "Security, Identity & Distributed Access",
    concept: "DDoS Mitigation Architecture: L3/L4 vs L7 Attacks & BGP Anycast",
    priority: "must-know",
    difficulty: "advanced",
    question: "Differentiate Layer 3/4 DDoS attacks (SYN floods, UDP reflection) from Layer 7 DDoS attacks (HTTP GET floods), and describe how BGP Anycast and WAF fleets absorb them.",
    answer: "Layer 3/4 DDoS attacks attempt to overwhelm network hardware and bandwidth pipes via raw volume (SYN floods, DNS amplification); Layer 7 attacks target application CPU and database resources via valid HTTP requests (search queries, login floods). L3/L4 attacks are absorbed and diluted across global scrubbing centers using BGP Anycast; L7 attacks are filtered via Web Application Firewalls (WAF) using IP reputation, behavioral rate limits, and JavaScript challenges.",
    explanation: `DDoS Taxonomy & Defense:
1. Layer 3/4 Volumetric & Protocol Attacks:
   - SYN Flood: Attacker sends millions of TCP SYN packets with spoofed IPs, exhausting server TCP half-open connection queues (SYN backlog). Mitigation: **SYN Cookies** (stateless TCP handshake validation).
   - UDP Amplification (DNS/NTP): Attacker sends tiny requests to public NTP servers with spoofed victim source IP; servers reply with 50x larger responses, flooding the victim's transit pipeline.
   - Defense: **BGP Anycast Scraping (Cloudflare, AWS Shield)**. The victim's single IP is advertised across 300 global data centers. A 2 Tbps attack is geographically diluted into harmless 6 Gbps streams per local edge center, where scrubbing hardware drops malformed UDP packets at line rate.
2. Layer 7 Application-Layer Attacks:
   - HTTP Flood: Thousands of botnet clients execute full TLS handshakes and request computationally heavy endpoints (\`GET /api/search?q=expensive_join\`).
   - The transport layer sees clean TCP packets. The bottleneck is database CPU.
   - Defense: WAF rules, Cloudflare Turnstile / Managed Challenges (evaluating browser JavaScript canvas fingerprints), rate-limiting by Client IP/ASN, and aggressive CDN caching.`,
    code: `/*
DDoS Absorption via BGP Anycast Scrubbing Centers:

[ Botnet: 5,000,000 Infected IoT Devices (2 Tbps Attack) ]
                           │
       ┌───────────────────┼───────────────────┐
       ▼                   ▼                   ▼
 [ Tokyo POP ]       [ London POP ]      [ NYC POP ]
 (Absorbs 600 Gbps)  (Absorbs 800 Gbps)  (Absorbs 600 Gbps)
       │                   │                   │
 [ Scrubbing ASIC: Drops Malformed UDP/SYN Packets at Line-Rate ]
                           │
             (Clean 50 Mbps User Traffic Only)
                           ▼
          [ Origin Application Datacenter ]
*/`,
    recallHint: "L3/4 = saturate bandwidth (dilute via Anycast). L7 = exhaust DB/CPU (filter via WAF & JS challenges).",
    interviewTip: "In large-scale system designs, never place application origins directly on public IPs. Always front them with an Anycast CDN/DDoS scrubbing layer (Cloudflare, AWS CloudFront/Shield) to eliminate direct origin IP exposure.",
    tags: ["ddos", "security", "waf", "anycast", "syn-flood", "cloudflare"]
  }),

  createCard({
    idNum: 90,
    category: "Security, Identity & Distributed Access",
    concept: "Data Protection: Encryption at Rest, in Transit, and Envelope Encryption",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Envelope Encryption protect petabytes of data efficiently, and what is the difference between a Key Encryption Key (KEK) and a Data Encryption Key (DEK)?",
    answer: "Encrypting large files directly with a central KMS master key creates network bottlenecks and KMS rate-limit throttling. Envelope Encryption uses a unique Data Encryption Key (DEK) to encrypt the plaintext data locally using fast AES-GCM; the central KMS Key Encryption Key (KEK) is used only to encrypt the small 256-bit DEK, which is stored alongside the ciphertext.",
    explanation: `The Bottleneck of Direct KMS Encryption:
- AWS KMS has request quotas (e.g., 10,000 req/sec) and cannot accept plaintext payloads larger than 4KB.
- Transmitting gigabyte video files or database tables over the network to KMS to be encrypted is impossible.

The Envelope Encryption Workflow:
1. Application calls KMS: \`GenerateDataKey(KeyId="master-kek")\`.
2. KMS returns two keys:
   - **Plaintext DEK**: A 256-bit symmetric key in memory.
   - **Ciphertext DEK**: The same DEK, encrypted under the central master KEK.
3. Application uses the Plaintext DEK to encrypt the 50GB file locally in RAM using AES-256-GCM (extreme throughput via CPU AES-NI instructions).
4. Application **wipes the Plaintext DEK from RAM immediately**.
5. Application stores the Ciphertext DEK in the file header alongside the encrypted data.
6. Decryption Path: Send only the tiny Ciphertext DEK to KMS to be decrypted -> get Plaintext DEK -> decrypt file locally.`,
    code: `/*
Envelope Encryption Diagram:

KMS (Root of Trust):
[ Master Key / KEK ] ── Encrypts ──> [ Encrypted Data Encryption Key (DEK) ]
                                                        │
Application Local Memory:                               │ (Stored together on disk)
[ Plaintext DEK ] ── Encrypts Data ──> [ Encrypted Ciphertext Payload ]
(Wiped from RAM!)
*/

// Node.js Envelope Encryption using AWS SDK
import { KMSClient, GenerateDataKeyCommand } from "@aws-sdk/client-kms";
import crypto from "crypto";

async function encryptPayload(plaintext: Buffer, kmsKeyId: string) {
  const kms = new KMSClient({});
  // 1. Generate Data Key
  const { Plaintext, CiphertextBlob } = await kms.send(new GenerateDataKeyCommand({
    KeyId: kmsKeyId,
    KeySpec: "AES_256"
  }));

  // 2. Encrypt locally with Plaintext DEK
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", Buffer.from(Plaintext!), iv);
  const encryptedData = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    ciphertext: encryptedData,
    encryptedDek: CiphertextBlob, // Store alongside data!
    iv,
    authTag
  };
}`,
    recallHint: "Envelope Encryption: KMS encrypts the key (KEK -> DEK); local CPU encrypts the data with the DEK.",
    interviewTip: "Envelope encryption is the universal industry standard for S3 server-side encryption (SSE-KMS), Kubernetes Secrets encryption, and disk volume encryption (LUKS/EBS).",
    tags: ["envelope-encryption", "kms", "encryption-at-rest", "security", "cryptography"]
  }),

  createCard({
    idNum: 91,
    category: "Security, Identity & Distributed Access",
    concept: "CORS (Cross-Origin Resource Sharing) & Content Security Policy (CSP)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Explain how browser Same-Origin Policy (SOP), CORS preflight OPTIONS requests, and Content Security Policy (CSP) prevent cross-site data theft and XSS.",
    answer: "Same-Origin Policy prevents JavaScript on one origin from reading responses from another origin; CORS enables servers to explicitly whitelist cross-origin domains via HTTP response headers (\`Access-Control-Allow-Origin\`), with preflight OPTIONS requests verifying non-simple requests. Content Security Policy (CSP) is an HTTP header restricting which domains the browser can execute scripts, images, and styles from, neutralizing Cross-Site Scripting (XSS).",
    explanation: `Same-Origin Policy (SOP) Mechanics:
An origin is defined as: \`Protocol + Hostname + Port\`.
- \`https://app.com:443\` vs \`https://api.com:443\` = Different origins!
- Browser allows JavaScript to SEND a cross-origin request, but **blocks JavaScript from reading the response** unless valid CORS headers are present.

CORS Preflight (OPTIONS Request):
For 'non-simple' requests (custom headers like \`Authorization\`, \`Content-Type: application/json\`, or methods like PUT/DELETE):
1. Browser automatically dispatches an HTTP \`OPTIONS\` request:
   \`Origin: https://app.com\`, \`Access-Control-Request-Method: POST\`, \`Access-Control-Request-Headers: authorization\`.
2. Server responds:
   \`Access-Control-Allow-Origin: https://app.com\`, \`Access-Control-Allow-Methods: POST, GET, OPTIONS\`.
3. If preflight succeeds, browser fires the actual POST request.

Content Security Policy (CSP) Defense Against XSS:
- Header: \`Content-Security-Policy: default-src 'self'; script-src 'self' https://trusted-cdn.com;\`
- If an attacker injects a malicious script \`<script src="http://evil.com/stealer.js">\`, the browser refuses to execute it because \`evil.com\` is not whitelisted!`,
    code: `// Express.js Hardened CORS & CSP Configuration
import express from "express";
import helmet from "helmet";
import cors from "cors";

const app = express();

// 1. Content Security Policy via Helmet
app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'", "https://apis.google.com"],
    objectSrc: ["'none'"],
    upgradeInsecureRequests: []
  }
}));

// 2. Strict CORS Whitelisting
const allowedOrigins = ["https://checkout.enterprise.com"];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS policy violation"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE"]
}));`,
    recallHint: "SOP blocks cross-origin reads. CORS is server saying 'I allow this origin'. CSP restricts where scripts can load from.",
    interviewTip: "Never set `Access-Control-Allow-Origin: *` when handling authenticated user sessions with credentials; browsers will block the response automatically.",
    tags: ["cors", "csp", "sop", "web-security", "xss", "headers"]
  }),

  createCard({
    idNum: 92,
    category: "Security, Identity & Distributed Access",
    concept: "API Security: HMAC Request Signing & Replay Attack Prevention",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does HMAC-SHA256 request signing verify request integrity and authenticity without transmitting secrets, and how do Nonces and Timestamps prevent Replay Attacks?",
    answer: "HMAC request signing (used by AWS Signature Version 4 and Stripe webhooks) hashes the HTTP method, URL, timestamp, and request body using a shared secret key; the server reconstructs and verifies the hash, guaranteeing that headers or payloads were not tampered with in transit. Nonces (unique one-time tokens) and strict timestamp drift windows (e.g., 5 minutes) prevent attackers from replaying captured requests.",
    explanation: `The Flaw of Plain API Keys:
If an API request simply sends \`X-Api-Key: secret_123\`:
- An attacker with a man-in-the-middle proxy or compromised gateway sees the secret key and can impersonate the client forever.
- An attacker can intercept a valid transfer request and modify the destination account number or amount.

HMAC Request Signing Workflow (AWS SigV4 / Stripe):
1. Client and Server share a secret key (\`api_secret\`). The secret is NEVER transmitted over the wire!
2. Client prepares the Canonical Request:
   \`CanonicalString = Method + "\\n" + Path + "\\n" + Timestamp + "\\n" + Nonce + "\\n" + SHA256(Body)\`.
3. Client computes cryptographic signature:
   \`Signature = HMAC-SHA256(api_secret, CanonicalString)\`.
4. Client sends: \`X-Signature\`, \`X-Timestamp\`, \`X-Nonce\` in headers.
5. Server Verification:
   - Check 1: \`|Now - X-Timestamp| < 300 seconds\`. If older than 5 minutes, reject (prevents delayed replays).
   - Check 2: Check Redis if \`X-Nonce\` has been seen in the last 5 minutes. If seen, reject (prevents duplicate replays). If unseen, store nonce with 5m TTL.
   - Check 3: Recompute HMAC signature using server's copy of \`api_secret\`. If it matches \`X-Signature\`, request is authentic and unaltered!`,
    code: `// HMAC-SHA256 Request Verification in Node.js
import crypto from "crypto";

export function verifyHmacSignature(
  reqBody: string,
  timestamp: string,
  receivedSignature: string,
  secretKey: string
): boolean {
  // 1. Verify Timestamp Window (5 minute threshold)
  const reqTime = parseInt(timestamp, 10);
  if (Math.abs(Date.now() - reqTime) > 300000) {
    return false; // Request too old (Replay attack defense)
  }

  // 2. Recompute expected signature
  const payloadToSign = \`\${timestamp}.\${reqBody}\`;
  const expectedSignature = crypto
    .createHmac("sha256", secretKey)
    .update(payloadToSign)
    .digest("hex");

  // 3. Timing-Safe Comparison to prevent timing attacks
  return crypto.timingSafeEqual(
    Buffer.from(expectedSignature, "hex"),
    Buffer.from(receivedSignature, "hex")
  );
}`,
    recallHint: "HMAC signs the request with a shared secret. Timestamp + Nonce prevent replay attacks. Timing-safe comparison stops timing leaks.",
    interviewTip: "Always specify `crypto.timingSafeEqual()` when verifying HMAC signatures in code. Using standard `===` strings exposes the server to cryptographic side-channel timing attacks.",
    tags: ["hmac", "request-signing", "security", "replay-attack", "nonces", "aws-sigv4"]
  }),

  createCard({
    idNum: 93,
    category: "Security, Identity & Distributed Access",
    concept: "Role-Based Access Control (RBAC) vs Attribute-Based Access Control (ABAC)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When does Role-Based Access Control (RBAC) suffer from 'Role Explosion', and how does Attribute-Based Access Control (ABAC) solve granular enterprise authorization?",
    answer: "RBAC grants permissions based on static predefined roles (Admin, Editor, Viewer); as business rules require contextual conditions (e.g., 'can edit if user is the document author and access is during business hours within the US'), RBAC suffers from 'Role Explosion' with hundreds of combinatorial roles. ABAC evaluates dynamic policies based on subject, resource, action, and environment attributes.",
    explanation: `RBAC vs ABAC Mechanics:
1. Role-Based Access Control (RBAC):
   - User -> Assigned to Roles -> Roles have Permissions.
   - Example: \`Role: FinanceManager -> Permissions: [view_payroll, approve_expense]\`.
   - Strengths: Simple to understand, fast database lookups (\`user_roles\` table).
   - The Role Explosion Trap:
     - You need: Regional managers who can approve expenses under \$10,000 in EMEA.
     - RBAC requires creating: \`EMEA_Manager_Under_10k\`, \`EMEA_Manager_Over_10k\`, \`APAC_Manager_Under_10k\`...
     - Role count explodes into an unmaintainable administrative nightmare.
2. Attribute-Based Access Control (ABAC - XACML / OPA):
   - Evaluates boolean policy logic against 4 attribute categories:
     1. **Subject**: User department, security clearance, employee ID.
     2. **Resource**: Document owner, classification level, creation date.
     3. **Action**: Read, Write, Delete, Approve.
     4. **Environment**: Current time, client IP geolocation, device security posture.
   - Policy: \`ALLOW Action:Edit IF Subject.Department == Resource.Department AND Resource.Status == 'DRAFT' AND Environment.Location == 'US'\`.`,
    code: `// Open Policy Agent (OPA) Rego Policy (ABAC)
/*
package authz

default allow = false

# Allow editing if user is the document owner OR user is an Admin in the same department
allow {
    input.action == "EDIT"
    input.subject.id == input.resource.owner_id
    input.environment.is_corporate_network == true
}

allow {
    input.action == "EDIT"
    input.subject.roles[_] == "ADMIN"
    input.subject.department == input.resource.department
}
*/`,
    recallHint: "RBAC = static roles (admin, user). ABAC = dynamic rules based on who, what, when, and where.",
    interviewTip: "Recommend Open Policy Agent (OPA) with Rego as the decoupled policy engine for microservices authorization in enterprise high-level designs.",
    tags: ["rbac", "abac", "authorization", "opa", "security", "access-control"]
  }),

  createCard({
    idNum: 94,
    category: "Security, Identity & Distributed Access",
    concept: "Server-Side Request Forgery (SSRF) Prevention in Gateways",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Server-Side Request Forgery (SSRF), how was it exploited in the Capital One cloud breach, and what architectural controls prevent internal network pivoting?",
    answer: "SSRF occurs when a backend server fetches a remote URL provided by a user without proper validation, allowing attackers to force the server to send HTTP requests to internal, non-routable private networks (e.g., AWS IMDS metadata service at 169.254.169.254). Prevention requires strict DNS resolution validation, blocking private IP ranges (RFC 1918), enforcing egress firewalls, and enabling AWS IMDSv2 (session-oriented tokens).",
    explanation: `The Anatomy of an SSRF Exploit:
- A web application provides a feature: 'Import avatar from URL' (\`POST /avatar { url: "http://..." }\`).
- Vulnerable server executes: \`fetch(req.body.url)\`.
- Attacker provides: \`http://169.254.169.254/latest/meta-data/iam/security-credentials/admin-role\`.
- The cloud server queries the link-local AWS Instance Metadata Service (IMDS).
- IMDS returns temporary AWS STS secret access keys!
- Attacker extracts the credentials and exfiltrates the entire corporate database (Capital One breach mechanism).

Architectural Defenses:
1. AWS IMDSv2 (Session-Oriented Tokens):
   - IMDSv1 allowed plain GET requests.
   - IMDSv2 mandates an HTTP \`PUT\` with a custom header to obtain a session token before metadata can be read. Standard SSRF vulnerabilities cannot execute arbitrary PUT headers, neutralizing the attack.
2. Egress Network Filtering:
   - Dedicated proxy for outbound user-supplied fetches that drops packets targeting RFC 1918 private ranges (\`10.0.0.0/8\`, \`172.16.0.0/12\`, \`192.168.0.0/16\`, \`169.254.169.254\`, \`127.0.0.1\`).
3. DNS Rebinding Defense:
   - Resolve DNS IP first; verify the IP is public; fetch using that explicit IP with an SNI header.`,
    code: `// Secure URL Fetcher with SSRF Defense
import ipaddr from "ipaddr.js";
import dns from "dns/promises";

async function safeFetchUserUrl(userUrl: string) {
  const parsed = new URL(userUrl);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("Invalid protocol");
  }

  // Resolve IP before making request
  const addresses = await dns.resolve4(parsed.hostname);
  for (const addr of addresses) {
    const ip = ipaddr.parse(addr);
    // Block loopback, private ranges, link-local (169.254), carrier-grade NAT
    if (ip.range() !== "unicast") {
      throw new Error(\`Forbidden destination: \${addr} is inside private network!\`);
    }
  }

  return fetch(userUrl);
}`,
    recallHint: "SSRF: Tricks your server into curling internal endpoints (like 169.254 AWS metadata). Block private IPs and use IMDSv2.",
    interviewTip: "In any system design where servers must download external webhooks or user URLs (e.g., webhook dispatchers, PDF generators, image crawlers), proactively mention SSRF protections and private subnet egress blocking.",
    tags: ["ssrf", "security", "cloud-security", "aws-metadata", "imdsv2", "egress-filtering"]
  }),

  createCard({
    idNum: 95,
    category: "Security, Identity & Distributed Access",
    concept: "PII Vaulting, Tokenization & Zero-Knowledge Architecture",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why should sensitive PII and credit card data never touch main application databases, and how does a dedicated Tokenization Vault isolate compliance scope?",
    answer: "Storing Personally Identifiable Information (PII) and credit card data across general microservices brings the entire system into strict regulatory compliance scope (PCI-DSS, HIPAA, GDPR), dramatically multiplying audit costs and breach blast radiuses. A Tokenization Vault exchanges sensitive raw data at the network perimeter for an irreversible, non-sensitive surrogate token (UUID), isolating compliance strictly to the secure vault.",
    explanation: `How Tokenization Vaults Work (PCI-DSS Compliance):
- Customer enters credit card number (\`4111 2222 3333 4444\`) on web checkout.
- Browser never sends card to the e-commerce server! Card is sent via an isolated iframe directly to a dedicated PCI-Compliant Vault (e.g., Stripe, VGS).
- The Vault stores the credit card in an isolated, encrypted, hardware-security-module (HSM) database.
- The Vault generates a cryptographically random, format-preserving Token: \`tok_visa_8f9a2b\`.
- The main e-commerce microservices, database, Kafka topics, and logs receive and store ONLY the token \`tok_visa_8f9a2b\`.
- To charge the customer, the Payment Service sends \`tok_visa_8f9a2b\` to the payment gateway. The e-commerce backend never handles, stores, or sees the real credit card number.

Benefits:
1. Scope Reduction: 99% of microservices and databases are legally exempt from PCI-DSS Level 1 audits.
2. Data Breach Neutralization: If an attacker dumps the main PostgreSQL database, they obtain only useless surrogate token strings without cryptographic value.`,
    code: `/*
Tokenization Vault Architecture:

[ User Browser ]
       │ (Directly posts raw credit card to Vault via secure iframe)
       ▼
[ PCI Tokenization Vault ] ──(Generates token, encrypts raw card in HSM)
       │
       ▼ (Returns token: 'tok_visa_4242')
[ Main E-Commerce Backend ] ──> Stores 'tok_visa_4242' in PostgreSQL
       │ (Sends token to charge payment)
       ▼
[ Stripe / Payment Gateway API ]
*/`,
    recallHint: "Tokenization: Swap sensitive card/PII for a random token at the edge. Keeps your main DB out of PCI audit scope.",
    interviewTip: "In payment or healthcare system design interviews, stating that you will tokenize credit cards/SSNs at the perimeter to reduce PCI-DSS/HIPAA audit scope will earn immediate top marks from security interviewers.",
    tags: ["tokenization", "pii-vault", "pci-dss", "security", "zero-knowledge", "compliance"]
  }),

  createCard({
    idNum: 96,
    category: "Security, Identity & Distributed Access",
    concept: "Web Application Firewall (WAF) & Layer 7 Inspection Pipelines",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does a Web Application Firewall (WAF) inspect Layer 7 HTTP traffic to detect and block OWASP Top 10 exploits (SQLi, XSS, Path Traversal)?",
    answer: "A WAF sits between reverse proxies and application backends, inspecting incoming HTTP request methods, URIs, headers, cookies, and JSON/form bodies against signature rule engines (e.g., ModSecurity, AWS WAF, OWASP Core Rule Set) and machine-learning behavioral baselines. It terminates malicious payloads (returning HTTP 403 Forbidden) before requests ever reach application code.",
    explanation: `WAF Inspection Pipeline Stages:
1. Request Normalization & Decoding:
   - Attackers use encoding tricks to evade detection: URL-encoding (\`%27%20OR%201=1\`), double URL-encoding (\`%2527\`), Unicode escaping, or Base64.
   - WAF decodes and normalizes the payload into canonical text before rule evaluation.
2. Signature Matching (OWASP Core Rule Set):
   - **SQL Injection (SQLi)**: Detects SQL meta-characters, UNION statements, comment sequences (\`--\`, \`/*\`), and boolean tautologies (\`' OR 1=1 --\`).
   - **Cross-Site Scripting (XSS)**: Identifies script tags (\`<script>\`), JavaScript event handlers (\`onload=\`, \`onerror=\`), and DOM manipulation strings.
   - **Path Traversal / Local File Inclusion (LFI)**: Identifies directory traversal sequences (\`../../etc/passwd\`).
3. Rate-Based Rules & IP Reputation:
   - Tracks request frequencies per IP/client fingerprint. If an IP fires 200 POST requests to \`/api/login\` within 60 seconds, WAF automatically blocks the IP for 1 hour.
4. Bot Detection:
   - Inspects TLS client hello fingerprints (JA3/JA4 fingerprints) to detect automated bot libraries (cURL, Python Requests) masquerading as Chrome browsers.`,
    code: `/*
AWS WAF Rule Statement (Blocking SQL Injection):
{
  "Name": "Block-SQLi-In-Body-And-URI",
  "Priority": 1,
  "Action": { "Block": {} },
  "Statement": {
    "OrStatement": {
      "Statements": [
        {
          "SqliMatchStatement": {
            "FieldToMatch": { "UriPath": {} },
            "TextTransformations": [{ "Priority": 0, "Type": "URL_DECODE" }]
          }
        },
        {
          "SqliMatchStatement": {
            "FieldToMatch": { "AllQueryArguments": {} },
            "TextTransformations": [{ "Priority": 0, "Type": "URL_DECODE" }]
          }
        }
      ]
    }
  },
  "VisibilityConfig": { "SampledRequestsEnabled": true, "CloudWatchMetricsEnabled": true }
}
*/`,
    recallHint: "WAF: Normalizes encoding and inspects L7 payloads against SQLi, XSS, and bot signatures before hitting app code.",
    interviewTip: "Position the WAF as the first inspection layer on the public ingress (ALB / Cloudflare), decoupling application servers from handling raw malicious traffic.",
    tags: ["waf", "owasp", "sqli", "xss", "security", "application-firewall"]
  })
];

module.exports = cards;
