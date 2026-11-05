// scripts/data_security/cat01_threat_modeling.cjs
const { card } = require('../sec_builder_helper.cjs');

const cat = "Threat Modeling & Zero Trust Fundamentals";

module.exports = [
  card(
    1,
    cat,
    "STRIDE Threat Model",
    "must-know",
    "intermediate",
    "What is the STRIDE threat modeling framework and how are its six categories applied to system architectures?",
    "STRIDE is a mnemonic threat categorization model developed by Microsoft: Spoofing (authenticity), Tampering (integrity), Repudiation (non-repudiability), Information Disclosure (confidentiality), Denial of Service (availability), and Elevation of Privilege (authorization).",
    "STRIDE helps engineering teams systematically decompose an architecture into Data Flow Diagrams (DFDs) consisting of Processes, Data Stores, Data Flows, and Trust Boundaries. Each interaction that crosses a trust boundary is audited against all six STRIDE vectors: Spoofing addresses pretending to be someone else (mitigated by strong authentication and mTLS); Tampering involves modifying data in transit or rest (mitigated by cryptographic signatures and HMACs); Repudiation is denying performed actions (mitigated by immutable append-only audit logs); Information Disclosure is unauthorized data access (mitigated by encryption and DLP); Denial of Service is resource exhaustion (mitigated by rate limiting and backpressure); Elevation of Privilege is gaining unauthorized permissions (mitigated by least-privilege RBAC/ABAC).",
    `// Threat Model Mapping Example
interface StrideAudit {
  element: "REST /api/v1/transfer" | "Postgres DB" | "Kafka Pipeline";
  threat: "Spoofing" | "Tampering" | "Repudiation" | "InfoDisclosure" | "DoS" | "ElevationOfPrivilege";
  mitigation: string;
}

const transferEndpointThreats: StrideAudit[] = [
  { element: "REST /api/v1/transfer", threat: "Spoofing", mitigation: "OAuth 2.1 mTLS / DPoP Token Binding" },
  { element: "REST /api/v1/transfer", threat: "Tampering", mitigation: "HMAC-SHA256 Payload Signature Verification" },
  { element: "REST /api/v1/transfer", threat: "Repudiation", mitigation: "Signed Cryptographic Audit Event to Append-Only Ledger" },
  { element: "REST /api/v1/transfer", threat: "InfoDisclosure", mitigation: "TLS 1.3 Strict Ciphers & Envelope Encryption" },
  { element: "REST /api/v1/transfer", threat: "DoS", mitigation: "Token Bucket Rate Limiting & Sliding Window on IP/User" },
  { element: "REST /api/v1/transfer", threat: "ElevationOfPrivilege", mitigation: "Fine-grained Zanzibar ReBAC Check" }
];`,
    "Remember the security property pairing: Spoofing->Authenticity, Tampering->Integrity, Repudiation->Non-repudiation, Info Disclosure->Confidentiality, DoS->Availability, Elevation->Authorization.",
    ["threat-modeling", "stride", "security-architecture", "dfd"]
  ),
  card(
    2,
    cat,
    "DREAD Risk Assessment Framework",
    "advanced",
    "advanced",
    "How does the DREAD methodology quantify and prioritize security vulnerability severity?",
    "DREAD scores security risks on a 1-10 scale across five metrics: Damage potential, Reproducibility, Exploitability, Affected users, and Discoverability. The overall risk score is calculated as (D + R + E + A + D) / 5.",
    "While CVSS is common for external vulnerability reporting, DREAD is used internally during design and threat modeling phases to prioritize remediation backlog items. Damage Potential evaluates the worst-case fallout (complete database wipeout = 10, minor UI distortion = 1). Reproducibility gauges how reliably an exploit succeeds (100% deterministic = 10, timing-dependent race condition = 3). Exploitability measures technical friction (single curl command requiring no auth = 10, chained multi-stage kernel zero-day = 2). Affected Users measures scale (all enterprise accounts = 10, isolated single user = 1). Discoverability measures ease of detection (visible in HTTP request headers = 10, buried in obscure compiled binary logic = 2; often scored as 10 assuming Kerckhoffs's principle).",
    `interface DreadScore {
  damage: number;          // 1-10
  reproducibility: number; // 1-10
  exploitability: number;  // 1-10
  affectedUsers: number;   // 1-10
  discoverability: number; // 1-10
}

function calculateDreadRisk(score: DreadScore): { total: number; severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' } {
  const total = (score.damage + score.reproducibility + score.exploitability + score.affectedUsers + score.discoverability) / 5;
  let severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'LOW';
  if (total >= 8) severity = 'CRITICAL';
  else if (total >= 6) severity = 'HIGH';
  else if (total >= 4) severity = 'MEDIUM';
  return { total, severity };
}`,
    "Many modern teams assume Discoverability is always 10 because automated scanners and reverse engineering will inevitably expose discoverable flaws.",
    ["risk-assessment", "dread", "cvss", "threat-scoring"]
  ),
  card(
    3,
    cat,
    "Zero Trust Architecture (NIST SP 800-207)",
    "must-know",
    "intermediate",
    "What are the core tenets of Zero Trust Architecture (ZTA) and how does it replace the traditional perimeter security model?",
    "Zero Trust operates under the core mantra: 'Never Trust, Always Verify'. It assumes the internal network is already compromised, eliminating implicit trust based on network location or IP subnet.",
    "Traditional security relied on the 'castle-and-moat' perimeter model: once inside the VPN or corporate intranet, users and services enjoyed broad network access. NIST SP 800-207 defines seven fundamental tenets for Zero Trust: 1) All data sources and computing services are considered resources; 2) All communication is secured regardless of network location; 3) Access to individual resources is granted on a per-session basis; 4) Access is determined dynamically by policy incorporating user identity, device posture, and behavioral telemetry; 5) The enterprise monitors and measures the integrity and security posture of all owned and associated assets; 6) All resource authentication and authorization are dynamic and strictly enforced before access is allowed; 7) Continuous collection of telemetry is used to actively adapt security policy.",
    `// Conceptual Zero Trust Policy Engine (PDP) Evaluation
interface AccessSubject {
  userId: string;
  devicePosture: { isCompliant: boolean; hasEdePatch: boolean; diskEncrypted: boolean };
  locationRisk: number; // 0 to 100
}

interface ResourceTarget {
  resourceId: string;
  sensitivityLevel: "PUBLIC" | "CONFIDENTIAL" | "RESTRICTED";
}

function evaluateZeroTrustAccess(subject: AccessSubject, resource: ResourceTarget): boolean {
  // Tenet 1 & 4: Evaluate dynamic device posture AND user identity
  if (!subject.devicePosture.isCompliant || !subject.devicePosture.diskEncrypted) {
    return false; // Untrusted device denied regardless of valid credentials!
  }
  if (subject.locationRisk > 70 && resource.sensitivityLevel === "RESTRICTED") {
    return false; // Dynamic risk escalation requires step-up MFA
  }
  return true;
}`,
    "In Zero Trust, network location gives zero privilege. Authenticate the identity, verify the device health, and continuously authorize every discrete call.",
    ["zero-trust", "nist-800-207", "beyondcorp", "architecture"]
  ),
  card(
    4,
    cat,
    "Defense in Depth",
    "must-know",
    "intermediate",
    "What is Defense in Depth (DiD) and how is it implemented across application, compute, network, and data tiers?",
    "Defense in Depth is an information security strategy where multiple redundant defensive layers are placed throughout an IT system to ensure that if one layer fails, subsequent layers prevent total compromise.",
    "A single point of failure in security is catastrophic. Defense in Depth organizes controls across distinct layers: 1) Perimeter / Edge: Cloudflare/AWS WAF, DDoS shielding, Geo-IP filtering; 2) Network: Private VPC subnets, Network Security Groups, egress filtering, micro-segmentation; 3) Host / Compute: Linux hardening, SELinux/AppArmor, rootless containers, distroless base images; 4) Application: Input validation (Zod), parameterized queries, strict CSP headers, CSRF tokens; 5) Identity & Access: Multi-Factor Authentication (FIDO2), least-privilege IAM, short-lived STS tokens; 6) Data: Encryption at rest (AES-GCM), column-level envelope encryption, dynamic data masking; 7) Telemetry: SIEM, immutable audit logging, anomaly detection.",
    `// Defense in Depth Layering in a Web Request Flow:
// Layer 1: Edge WAF blocks SQLi signatures before reaching cluster
// Layer 2: Ingress controller enforces TLS 1.3 & client cert validation
// Layer 3: API Gateway enforces rate limits & JWT signature check
// Layer 4: Application Middleware asserts strict Zod schema validation
// Layer 5: Business logic checks Zanzibar ReBAC tenant isolation
// Layer 6: Data layer executes parameterized prepared SQL queries
// Layer 7: DB engine stores encrypted tablespace on KMS-managed volume`,
    "Never rely on frontend validation alone, nor solely on the WAF. Every layer must assume the outer layers were completely bypassed or compromised.",
    ["defense-in-depth", "layered-security", "waf", "security-controls"]
  ),
  card(
    5,
    cat,
    "Principle of Least Privilege (PoLP)",
    "must-know",
    "intermediate",
    "What is the Principle of Least Privilege and how is it enforced across IAM, microservices, and database connections?",
    "The Principle of Least Privilege dictates that any entity (user, process, container, service) must be granted only the absolute minimum set of permissions necessary to perform its intended business function.",
    "Enforcing PoLP prevents an initial compromise from escalating into a catastrophic platform-wide breach. In IAM: instead of AdministratorAccess or s3:*, grant s3:GetObject on specific bucket ARN arn:aws:s3:::customer-invoices/*. In Database: application connections should never connect as postgres or root superuser; microservices should have dedicated database users with restricted DML rights (GRANT SELECT, INSERT on orders TO order_svc; never DROP TABLE or ALTER). In Containers: containers must run as unprivileged users (USER 10001), drop all Linux kernel capabilities (cap_drop: ['ALL']), and mount filesystems as read-only. In Service-to-Service: each microservice authenticates via mTLS identity or SPIFFE/SPIRE ID, authorized only to communicate with specific upstream endpoints.",
    `// Example: Overprivileged vs Least-Privilege IAM Policy
// BAD (Overprivileged):
// { "Effect": "Allow", "Action": "s3:*", "Resource": "*" }

// GOOD (Strict Least-Privilege):
const leastPrivilegeS3Policy = {
  Version: "2012-10-17",
  Statement: [
    {
      Effect: "Allow",
      Action: ["s3:GetObject", "s3:PutObject"],
      Resource: "arn:aws:s3:::enterprise-vault-production/tenant-42/*",
      Condition: {
        StringEquals: { "s3:x-amz-server-side-encryption": "aws:kms" }
      }
    }
  ]
};`,
    "Whenever defining permissions, ask: 'If this service or token is compromised right now, what is the maximum damage the attacker can inflict?'",
    ["least-privilege", "polp", "iam", "access-control"]
  ),
  card(
    6,
    cat,
    "Attack Surface Reduction (ASR)",
    "must-know",
    "intermediate",
    "What strategies and architectural patterns are used to systematically reduce an organization's attack surface?",
    "Attack Surface Reduction (ASR) involves minimizing the number of exposed entry points, open ports, public IP addresses, unnecessary protocols, unused dependencies, and running code paths accessible to untrusted actors.",
    "Every line of exposed code, open port, or public service is a potential vulnerability vector. Core ASR strategies include: 1) Eliminating public IP addresses: placing all application workloads, databases, and caches in private VPC subnets with NAT gateways, exposing only a single hardened Cloud WAF/Load Balancer; 2) Minimal container base images: using scratch or Distroless images that lack package managers, shells (bash/sh), and utilities (curl/netcat) so attackers cannot execute arbitrary binaries on RCE; 3) Disabling unnecessary HTTP methods: rejecting TRACE, OPTIONS, HEAD where unneeded; 4) Code tree pruning: removing debug endpoints (/debug/pprof, /swagger-ui in production) and test harnesses; 5) Network microsegmentation: default-deny egress and ingress firewall rules.",
    `// Example: Express.js Attack Surface Reduction
import express from 'express';
import helmet from 'helmet';

const app = express();

// 1. Remove X-Powered-By header to prevent fingerprinting
app.disable('x-powered-by');

// 2. Harden HTTP response headers
app.use(helmet());

// 3. Strict payload size limits to mitigate DoS buffer exhaustion
app.use(express.json({ limit: '100kb' }));

// 4. Default Deny on unsupported HTTP verbs
app.use((req, res, next) => {
  const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE'];
  if (!allowedMethods.includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }
  next();
});`,
    "The most secure code is the code that is never deployed or exposed. If a service doesn't strictly need a public endpoint, don't give it one.",
    ["attack-surface", "hardening", "asr", "minimal-exposure"]
  ),
  card(
    7,
    cat,
    "Kerckhoffs's Principle & Security through Obscurity",
    "must-know",
    "intermediate",
    "What is Kerckhoffs's Principle and why is 'security through obscurity' universally considered an anti-pattern in production systems?",
    "Kerckhoffs's Principle states that a cryptographic system or security architecture should be secure even if everything about the system, except the secret key, is public knowledge.",
    "Security through obscurity relies on hiding implementation details, obfuscating code, changing default port numbers (e.g. running SSH on 2222), or inventing secret custom encryption algorithms. Attackers using reverse engineering, memory dumps, or network sniffers can trivially bypass obscurity. In contrast, open and standardized algorithms (such as AES-256, RSA-4096, ChaCha20, Argon2id) are publicly scrutinized by global cryptographers for decades. Their mathematical resilience rests entirely on key entropy, not the secrecy of the algorithm. Relying on obscurity creates a dangerous false sense of security that crumbles upon the first leak.",
    `// ANTI-PATTERN: Custom "Secret" XOR Obfuscation (Security through Obscurity)
// function customEncrypt(data: string) { return data.split('').map(c => String.fromCharCode(c.charCodeAt(0) ^ 0x42)).join(''); }

// PRODUCTION COMPLIANT: Open Standard AES-256-GCM using Node crypto
import crypto from 'crypto';

export function encryptAesGcm(plaintext: Buffer, key256: Buffer): { ciphertext: Buffer; iv: Buffer; tag: Buffer } {
  const iv = crypto.randomBytes(12); // NIST 96-bit recommended IV
  const cipher = crypto.createCipheriv('aes-256-gcm', key256, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ciphertext, iv, tag };
}`,
    "Obscurity can be a defense-in-depth complement (like stripping stack traces), but it must NEVER be the primary security control.",
    ["kerckhoffs", "applied-cryptography", "obscurity", "standards"]
  ),
  card(
    8,
    cat,
    "CIA Triad & The Parkerian Hexad",
    "must-know",
    "beginner",
    "How does the Parkerian Hexad expand upon the classical CIA Triad to provide a more comprehensive security model?",
    "The CIA Triad covers Confidentiality, Integrity, and Availability. The Parkerian Hexad expands this into six discrete attributes: Confidentiality, Integrity, Availability, Authenticity, Utility, and Possession/Control.",
    "The classic CIA triad often conflates distinct security states. For example, if an encrypted backup disk is stolen by an adversary who lacks the decryption key: Confidentiality remains intact (data is unreadable), and Availability may be intact (duplicate backups exist), but Possession/Control was lost (an adversary physically holds the ciphertext, allowing offline brute-force attempts). The Parkerian Hexad separates these: 1) Confidentiality (preventing unauthorized viewing); 2) Possession (physical/logical holding of data); 3) Integrity (data is accurate and uncorrupted); 4) Authenticity (verification of genuine origin); 5) Availability (accessible when needed); 6) Utility (data is in a usable, decodable format).",
    `// Security Incident Classification via Parkerian Hexad:
// Scenario A: Ransomware encrypts DB with adversary's private key
// - Integrity: Intact (data wasn't tampered with, just locked)
// - Confidentiality: Intact (adversary didn't necessarily read data)
// - Availability: VIOLATED (users cannot query system)
// - Utility: VIOLATED (data is unusable without decryption key)

// Scenario B: Employee leaks encrypted password hashes
// - Confidentiality: Marginally intact (hashes not yet cracked)
// - Possession: VIOLATED (adversary has the physical bytes)
// - Authenticity: Intact (hashes are genuine)`,
    "Distinguishing between Utility, Possession, and Confidentiality is crucial during forensic breach assessments and regulatory reporting (e.g. GDPR).",
    ["cia-triad", "parkerian-hexad", "security-fundamentals"]
  ),
  card(
    9,
    cat,
    "Trust Boundaries & Data Flow Diagrams (DFD)",
    "must-know",
    "intermediate",
    "What is a Trust Boundary in security architecture and how do you identify one in a Data Flow Diagram?",
    "A Trust Boundary is a conceptual perimeter where data or execution transitions between different levels of privilege, authorization, or trust—such as between the public internet and a web server, or between a tenant and a shared database.",
    "In security modeling, threats live primarily at Trust Boundaries. A Data Flow Diagram categorizes interactions into Processes (code executing), Data Stores (databases/queues), Data Flows (network/IPC links), and Trust Boundaries (lines where privilege changes). When a data flow crosses a trust boundary, it must undergo three operations: 1) Strict input sanitization and schema assertion (treat all crossed data as hostile); 2) Explicit cryptographic authentication (verify who sent it); and 3) Authorization checks (verify permission to execute requested operation). Examples of boundaries: Browser to Edge WAF, Edge WAF to Microservice, Container to Host OS Kernel, Tenant A context to Tenant B context.",
    `// Trust Boundary Enforcement at API Layer
import { z } from 'zod';

const OrderInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().positive().max(100),
  // NEVER trust client-supplied userId or tenantId across trust boundary!
});

export async function processOrderRequest(untrustedBody: unknown, verifiedSession: { userId: string; tenantId: string }) {
  // 1. Cross-boundary validation
  const validData = OrderInputSchema.parse(untrustedBody);

  // 2. Bind operation to cryptographically verified session, NOT user payload
  return await db.orders.create({
    data: {
      ...validData,
      userId: verifiedSession.userId,
      tenantId: verifiedSession.tenantId, // Prevent IDOR!
    }
  });
}`,
    "Whenever drawing an architecture diagram, draw red dotted lines wherever data moves from less trusted to more trusted zones. That is where exploits occur.",
    ["trust-boundaries", "dfd", "threat-modeling", "idor-defense"]
  ),
  card(
    10,
    cat,
    "Assume Breach Mentality",
    "must-know",
    "intermediate",
    "What is the 'Assume Breach' security mindset and how does it alter design decisions for cloud and microservice systems?",
    "The 'Assume Breach' mindset presumes that an attacker has already obtained valid credentials, bypassed the firewall, and compromised an internal node or service within the network.",
    "Instead of designing systems assuming the perimeter will never fall, engineers design resilient systems that minimize the blast radius of any individual compromised component. Design implications include: 1) Zero internal plaintext traffic: mandatory mTLS and TLS 1.3 even between containers in the same Kubernetes pod or private VPC; 2) Micro-segmentation: pods cannot communicate with other pods by default (Kubernetes NetworkPolicies default-deny); 3) Token binding and short lifetimes: access tokens expire in 10-15 minutes and require DPoP / mTLS proof-of-possession so stolen tokens cannot be replayed from other IPs; 4) Ephemeral infrastructure: instances are rotated every few days to eliminate adversary persistence.",
    `// Assume Breach: Default Deny Kubernetes NetworkPolicy
/*
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {} # Selects all pods in namespace
  policyTypes:
  - Ingress
  - Egress
# Neither ingress nor egress is listed below, meaning ALL traffic is blocked by default!
*/`,
    "Ask yourself: 'If an adversary has a root shell inside this web server right now, can they dump our entire database?' If yes, you haven't implemented Assume Breach.",
    ["assume-breach", "blast-radius", "microsegmentation", "zero-trust"]
  ),
  card(
    11,
    cat,
    "Threat Actor Profiling & TTPs (MITRE ATT&CK)",
    "advanced",
    "advanced",
    "How does the MITRE ATT&CK framework categorize threat actor Tactics, Techniques, and Procedures (TTPs)?",
    "The MITRE ATT&CK (Adversarial Tactics, Techniques, and Common Knowledge) framework provides a globally accessible knowledge base of real-world adversary behaviors mapped into a matrix of Tactics (goals) and Techniques (methods).",
    "Rather than focusing on ephemeral indicators of compromise (like IP addresses or file hashes, which change in seconds), ATT&CK focuses on TTPs (Tactics, Techniques, and Procedures) that attackers must execute across an intrusion lifecycle: 1) Initial Access (e.g. T1190 Exploit Public-Facing App); 2) Execution (e.g. T1059 Command and Scripting Interpreter); 3) Persistence (e.g. T1098 Account Manipulation); 4) Privilege Escalation (e.g. T1068 Exploitation for Privilege Escalation); 5) Defense Evasion (e.g. T1070 Indicator Removal); 6) Credential Access (e.g. T1552 Unsecured Credentials); 7) Discovery (e.g. T1087 Account Discovery); 8) Lateral Movement (e.g. T1550 Use Alternate Authentication Material); 9) Collection; 10) Command and Control; 11) Exfiltration; 12) Impact.",
    `// Security Telemetry Tagging with MITRE ATT&CK IDs
function logSecurityAlert(event: {
  userId: string;
  action: string;
  ip: string;
  mitreTactic: string;
  mitreTechniqueId: string;
}) {
  const alert = {
    timestamp: new Date().toISOString(),
    ...event,
    framework: "MITRE ATT&CK v14",
    severity: "HIGH"
  };
  // Ships to SIEM (Elastic / Splunk / Datadog)
  console.log(JSON.stringify(alert));
}

// Example usage on suspicious credential stuffing detection:
logSecurityAlert({
  userId: "admin",
  action: "100 failed logins in 60s from Tor exit node",
  ip: "198.51.100.2",
  mitreTactic: "Credential Access",
  mitreTechniqueId: "T1110.004 - Credential Stuffing"
});`,
    "Referencing MITRE technique IDs (e.g. T1190, T1078) creates a standardized vocabulary connecting red teams, blue teams, and software architects.",
    ["mitre-attack", "ttps", "threat-actors", "siem-telemetry"]
  ),
  card(
    12,
    cat,
    "Security Champions & Shift-Left Engineering",
    "must-know",
    "beginner",
    "What does 'Shift-Left' mean in software security and how does the Security Champions program scale defensive culture?",
    "Shift-Left means integrating security practices, static analysis, threat modeling, and automated testing into the earliest stages of the software development lifecycle (SDLC), rather than treating security as an audit gate right before release.",
    "Fixing a vulnerability during architecture or coding costs 10x to 100x less than fixing it in production post-breach. Shift-left embeds automated SAST (Semgrep/SonarQube), SCA (Snyk/Dependabot), container scanning (Trivy), and secret detection (Gitleaks) directly into IDEs and git pre-commit hooks. Because central security teams cannot inspect every PR in high-velocity agile organizations, the Security Champions program embeds designated software engineers within product squads who receive specialized training to act as security liaisons, run threat models, and enforce safe defaults.",
    `// Shift-Left Pre-Commit Configuration (.pre-commit-config.yaml)
/*
repos:
  - repo: https://github.com/gitleaks/gitleaks
    rev: v8.18.0
    hooks:
      - id: gitleaks # Blocks commit if AWS/JWT/Stripe secret keys are detected in diff!
  - repo: https://github.com/semgrep/semgrep
    rev: v1.60.0
    hooks:
      - id: semgrep # Blocks SQLi, unsafe innerHTML, and hardcoded secrets
        args: ['--config=p/security-audit', '--error']
*/`,
    "Shift-left doesn't eliminate centralized security teams; it empowers developers to catch 80% of routine flaws before a single line of code is merged.",
    ["shift-left", "devsecops", "security-champions", "sdlc"]
  )
];
