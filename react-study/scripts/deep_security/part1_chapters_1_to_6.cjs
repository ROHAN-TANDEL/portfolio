// scripts/deep_security/part1_chapters_1_to_6.cjs
module.exports = [
  {
    id: "sec-deep-01",
    title: "Cryptographic Primitives: AES-GCM, Argon2id, Curve25519 & Envelope Encryption",
    category: "Applied Cryptography",
    readTimeMinutes: 32,
    overview: "Modern enterprise security is built on a small, mathematically verified set of cryptographic primitives: AES-GCM for authenticated symmetric encryption, Argon2id for memory-hard password derivation, Curve25519 for high-speed constant-time asymmetric key exchange, and Envelope Encryption for multi-tenant KMS scaling. This masterclass examines their internal mathematics, bit-level memory layout, and failure modes.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        MODERN CRYPTOGRAPHIC PRIMITIVE TAXONOMY                     |
+-----------------------------------------------------------------------------------+
  [ APPLICATION DATA LAYER ]
            |
            +---> SYMMETRIC ENCRYPTION: AES-256-GCM (AEAD)
            |     - 12-byte CSPRNG IV + 16-byte GHASH Auth Tag
            |     - High throughput via Intel AES-NI hardware instructions
            |
            +---> ASYMMETRIC KEY EXCHANGE: Curve25519 (X25519 / Ed25519)
            |     - 32-byte public keys, Montgomery curve point multiplication
            |     - Constant-time execution; zero timing side-channel leakage
            |
            +---> CREDENTIAL DERIVATION: Argon2id (PHC Winner)
            |     - Memory-hard (64MB) + CPU iterations + Thread lanes
            |     - Defeats both GPU memory-bandwidth attacks and cache timing
            v
  +-------------------------------------------------------------------------------+
  | ENVELOPE ENCRYPTION ARCHITECTURE (AWS KMS / HASHICORP VAULT)                  |
  |                                                                               |
  | 1. Cloud KMS Master KEK (Hardware Security Module HSM)                        |
  |    - Master key never leaves FIPS 140-2 Level 3 hardware boundary             |
  | 2. Local Ephemeral DEK (AES-256 Plaintext)                                    |
  |    - Encrypts millions of database rows at CPU memory speed                    |
  | 3. Ciphertext Bundle = [ Encrypted DEK || 12-byte IV || Ciphertext || Tag ]   |
  +-------------------------------------------------------------------------------+
`,
    deepDive: `### 1. The Anatomy of AES-256-GCM (Galois/Counter Mode)
AES-GCM is an Authenticated Encryption with Associated Data (AEAD) cipher that provides confidentiality, integrity, and authenticity in a single pass.
- **Counter Mode (CTR)**: Converts the block cipher into a stream cipher. AES encrypts an incrementing counter initialized from the 96-bit IV: $Counter_i = IV || \text{pad32}(i)$. The keystream is XORed with the plaintext: $C_i = P_i \oplus \text{AES}_K(Counter_i)$.
- **Galois Field MAC (GHASH)**: Computes a polynomial evaluation over the binary Galois field $GF(2^{128})$:
  $$H = \text{AES}_K(0^{128})$$
  Every 16-byte block of ciphertext and Additional Authenticated Data (AAD) is multiplied by powers of $H$ modulo the irreducible polynomial $x^{128} + x^7 + x^2 + x + 1$.
- **The Nonce Reuse Flaw**: If the same 96-bit IV is ever used twice with the same key $K$, an adversary subtracts the two GHASH equations: $(Tag_1 \oplus Tag_2) = (C_1 - C_2) \cdot H$. This reveals the authentication key $H$, allowing the adversary to forge arbitrary valid ciphertext packets without knowing $K$.

### 2. Argon2id: The Memory-Hard Password Standard
Fast hashes like SHA-256 fail for password hashing because specialized ASICs and high-end GPUs compute billions of hashes per second.
- **Argon2d vs Argon2i vs Argon2id**:
  - **Argon2d**: Data-dependent memory access. Memory references depend on previous hash values, making it impossible to compute on GPUs without allocating massive DRAM. Vulnerable to side-channel cache timing attacks.
  - **Argon2i**: Data-independent memory access. Memory locations are accessed in a fixed, pseudo-random order. Immune to cache-timing attacks, but less resistant to GPU memory-bandwidth trade-offs.
  - **Argon2id (Hybrid)**: Uses Argon2i passes for the first half of the memory blocks (protecting against side-channel attacks during key derivation) and Argon2d passes for the remainder (providing maximum GPU cracking resistance).

### 3. Envelope Encryption at Cloud Scale
Directly invoking cloud KMS APIs for every database row or payload introduces unacceptable operational friction:
- **API Latency**: KMS network calls average 15-40ms.
- **Rate Limits**: AWS KMS enforces account quotas (typically 10,000-50,000 requests/second).
- **Cost**: Standard KMS pricing ($0.03 per 10,000 requests) balloons into tens of thousands of dollars per month on high-throughput microservice architectures.
- **Envelope Encryption Pattern**:
  1. The application requests a Data Key from KMS: \`GenerateDataKey(KeyId=master-kek, KeySpec=AES_256)\`.
  2. KMS returns the **Plaintext DEK** (32 bytes) and the **Ciphertext DEK** (encrypted by the master KEK).
  3. The microservice caches the Plaintext DEK in RAM and symmetrically encrypts millions of records using AES-GCM at gigabytes-per-second memory speed.
  4. The Ciphertext DEK is stored alongside the encrypted data records in the database.
  5. The Plaintext DEK is wiped from RAM (\`buf.fill(0)\`) upon task completion or cache expiration.`,
    edgeCasesAndPitfalls: [
      "Generating Initialization Vectors (IVs) using non-cryptographic random generators like Math.random(), leading to nonce collisions and GHASH key recovery.",
      "Encrypting more than 2^32 records under the same random 96-bit IV key: by the Birthday Paradox, collision probability exceeds 50% around 2^48 messages; NIST recommends rotating keys before 2^32 invocations.",
      "Failing to clear plaintext keys from memory in Node.js/Go: garbage collection does not zero out memory buffers; an attacker dumping container core dumps can extract residual keys."
    ],
    keyTakeaways: [
      "AES-GCM is an AEAD cipher; reusing an IV with the same key breaks both confidentiality and authenticity.",
      "Argon2id is the gold standard for password hashing, combining memory hardness with side-channel timing immunity.",
      "Envelope Encryption leverages KMS master keys to protect local data keys, scaling encryption throughput to millions of operations per second."
    ]
  },
  {
    id: "sec-deep-02",
    title: "The TLS 1.3 Handshake & Mutual TLS (mTLS) Zero-Trust Inter-Service Mesh",
    category: "Network & Transport Security",
    readTimeMinutes: 30,
    overview: "TLS 1.3 completely redesigns the transport security layer, eliminating obsolete cryptographic algorithms, enforcing Perfect Forward Secrecy (PFS), and cutting handshake latency to a single round-trip (1-RTT). In microservice architectures, Mutual TLS (mTLS) transforms the transport layer into a cryptographic zero-trust identity plane.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        TLS 1.3 1-RTT & MTLS SERVICE MESH HANDSHAKE                 |
+-----------------------------------------------------------------------------------+
  [ CLIENT (Order Service) ]                           [ SERVER (Payment Service) ]
            |                                                        |
            | ---------- 1. ClientHello ---------------------------> |
            |    - KeyShare: Client Ephemeral Curve25519 Public Key  |
            |    - Supported CipherSuites: TLS_AES_256_GCM_SHA384    |
            |                                                        |
            | <--------- 2. ServerHello ---------------------------- |
            |    - KeyShare: Server Ephemeral Curve25519 Public Key  |
            |    [BOTH DERIVE SHARED MASTER SECRET INSTANTLY!]       |
            | <--------- 3. EncryptedExtensions -------------------- |
            | <--------- 4. CertificateRequest (mTLS) -------------- |
            | <--------- 5. Server Certificate (Signed by Mesh CA) - |
            | <--------- 6. CertificateVerify (Server Signature) --- |
            | <--------- 7. Finished ------------------------------- |
            |                                                        |
            | ---------- 8. Client Certificate (mTLS SVID) --------> |
            | ---------- 9. CertificateVerify (Client Signature) --> |
            | ---------- 10. Finished -----------------------------> |
            |                                                        |
            | <======== ENCRYPTED MUTUAL ZERO-TRUST HTTP/2 DATA ===> |
`,
    deepDive: `### 1. TLS 1.3 Architectural Enhancements over TLS 1.2
TLS 1.3 (RFC 8446) represents a clean break from 25 years of legacy SSL/TLS design:
- **1-RTT Handshake**: In TLS 1.2, establishing a connection required 2 round trips (ClientHello -> ServerHello -> KeyExchange -> Finished). In TLS 1.3, the client speculatively generates ephemeral Diffie-Hellman keys for the most common curves (X25519, P-256) and transmits them in the initial \`ClientHello\` (\`KeyShare\` extension). The server selects the matching curve and returns its \`KeyShare\` in \`ServerHello\`. Symmetric encryption keys are derived immediately in 1-RTT.
- **Elimination of Vulnerable Primitives**: TLS 1.3 completely excised static RSA key exchange (which broke forward secrecy), CBC-mode block ciphers (vulnerable to Lucky Thirteen and padding oracle attacks), RC4, SHA-1, MD5, and arbitrary renegotiation.
- **Mandatory Perfect Forward Secrecy (PFS)**: All TLS 1.3 cipher suites mandate ephemeral Diffie-Hellman (DHE / ECDHE). Even if the server's long-term private identity certificate is compromised in the future, past recorded network sessions can never be decrypted.

### 2. Mutual TLS (mTLS) Mechanics
In standard TLS, only the client validates the server's identity. In mTLS, both parties cryptographically prove their identity using X.509 certificates.
- **The CertificateRequest Message**: During the handshake, the server sends a \`CertificateRequest\` message listing the Distinguished Names (DNs) of accepted Certificate Authorities.
- **Client Identity Verification**: The client must respond with its own X.509 certificate and a \`CertificateVerify\` signature computed over the handshake transcript using the client's private key.
- **Zero-Trust Enforcement**: The server extracts the client's Subject Alternative Name (SAN), maps it to a verified service identity (e.g. \`spiffe://cluster.local/ns/prod/sa/order-service\`), and evaluates authorization policies before reading any application data.

### 3. SPIFFE/SPIRE & Service Mesh Integration
In modern service meshes (Istio, Linkerd, Consul):
- Dedicated sidecar proxies (Envoy) intercept all inbound and outbound TCP traffic.
- SPIRE (SPIFFE Runtime Environment) performs kernel-level workload attestation and dynamically issues short-lived X.509 certificates (SVIDs) valid for 1 hour.
- Certificates are rotated continuously in memory without restarting containers or dropping active TCP sockets.`,
    edgeCasesAndPitfalls: [
      "0-RTT Replay Attacks: TLS 1.3 supports early data (0-RTT) for connection resumption. However, 0-RTT data is vulnerable to network replay attacks; non-idempotent HTTP mutations (POST/PUT/DELETE) must NEVER be permitted in 0-RTT.",
      "Certificate Expiration Outages: Service mesh mTLS relies on short-lived certificates; if automated rotation agents fail, services immediately reject inter-pod connections, causing total cluster paralysis.",
      "ALB / Ingress TLS Termination Blind Spots: Terminating TLS at an external Application Load Balancer and sending plaintext HTTP over the internal VPC network violates zero-trust principles, allowing compromised internal pods to sniff sensitive traffic."
    ],
    keyTakeaways: [
      "TLS 1.3 reduces handshake latency to 1-RTT and mandates Perfect Forward Secrecy across all cipher suites.",
      "mTLS enforces bidirectional cryptographic identity, eliminating the need for hardcoded API keys between microservices.",
      "Use SPIFFE/SPIRE to automate continuous certificate issuance and rotation across service mesh sidecars."
    ]
  },
  {
    id: "sec-deep-03",
    title: "Modern OAuth 2.1, OIDC & Token Binding (Proof of Possession & DPoP)",
    category: "Authentication & Identity",
    readTimeMinutes: 30,
    overview: "OAuth 2.0 has evolved into OAuth 2.1, deprecating insecure legacy flows and mandating PKCE. However, standard bearer tokens remain vulnerable to theft and replay. This masterclass analyzes the cryptographic evolution from bearer tokens to sender-constrained tokens via Demonstrating Proof-of-Possession (DPoP, RFC 9449).",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        DPOP (DEMONSTRATING PROOF-OF-POSSESSION)                   |
+-----------------------------------------------------------------------------------+
  [ SPA / CLIENT APPLICATION ]                         [ RESOURCE SERVER (API) ]
  (Holds Ephemeral Private Key)
            |
            | 1. Client creates signed DPoP Proof JWT:
            |    - Header: { typ: "dpop+jwt", alg: "ES256", jwk: <Client-Public-Key> }
            |    - Payload: { htm: "POST", htu: "https://api.com/transfer", iat: 1712000 }
            |
            | 2. HTTP Request with Dual Authentication:
            |    Authorization: DPoP <dpop-bound-access-token>
            |    DPoP: <signed-dpop-proof-jwt>
            | -----------------------------------------------------> |
            |                                                        |
            |                                                        | 3. RESOURCE SERVER VALIDATION:
            |                                                        |    - Verify DPoP Proof signature
            |                                                        |    - Hash public JWK -> jkt thumbprint
            |                                                        |    - Verify access token's 'cnf.jkt'
            |                                                        |      matches DPoP proof JWK!
            |                                                        |    - Verify htm matches HTTP Method
            |                                                        |    - Verify htu matches exact URI
            |                                                        |
            | <--------- HTTP 200 OK (Transfer Approved) ----------- |
`,
    deepDive: `### 1. The Vulnerability of Bearer Tokens
RFC 6750 defines bearer tokens: \"A security token with the property that any party in possession of the token (a 'bearer') can use the token in any way that any other party could\".
- If an access token is exfiltrated via XSS, network sniffing, reverse proxy logging, or server memory inspection, the attacker can replay that token from anywhere in the world until it expires.
- Traditional client authentication (using client secrets) only protects token issuance at the authorization server; once the access token is in the wild, the Resource Server cannot distinguish between the legitimate client and an attacker.

### 2. DPoP (RFC 9449) Protocol Mechanics
DPoP binds tokens cryptographically to an asymmetric key pair generated and held by the client application (even in a browser Single Page Application using the Web Crypto API).
1. **Key Generation**: Upon initialization, the client generates an asymmetric key pair (typically ECDSA P-256 / ES256). The private key is marked as non-extractable in browser memory.
2. **Token Issuance with Key Binding**: When requesting a token from \`/oauth/token\`, the client includes a DPoP proof header. The Authorization Server hashes the client's public key (SHA-256 JWK Thumbprint) and embeds it into the issued Access Token as a confirmation claim:
   \`\`\`json
   {
     \"sub\": \"usr_1024\",
     \"cnf\": {
       \"jkt\": \"0ZcOCORZTXsfAOaoKt1WBIjUXiaTXgzUKQwYQ3pleNo\"
     }
   }
   \`\`\`
3. **API Request Proof**: For every single outbound API request, the client creates an ephemeral, single-use signed DPoP proof JWT containing:
   - \`htm\`: The target HTTP method (\`\"POST\"\`).
   - \`htu\`: The target HTTP URI (\`\"https://api.enterprise.com/v1/payments\"\`).
   - \`jti\`: Unique random JWT identifier (preventing replays).
   - \`iat\`: Generation timestamp.
4. **Resource Server Verification**: The API server computes the thumbprint of the public key in the DPoP proof header, verifies that it matches \`cnf.jkt\` inside the access token, and verifies that \`htm\` and \`htu\` match the active request.
- **The Security Result**: Even if an attacker steals the access token string via XSS, they cannot make API calls because they lack the client's non-extractable private key to sign valid DPoP proofs!`,
    edgeCasesAndPitfalls: [
      "Clock Skew Failures: DPoP proof verification requires tight timestamp windows (typically 30-60 seconds); un-synchronized server clocks cause legitimate client requests to fail.",
      "DPoP Proof Replay: If an API server does not cache and check the \`jti\` claim of DPoP proofs in Redis, an attacker who intercepts both the access token and the DPoP header within the 30-second window can replay the request.",
      "Missing PKCE on Confidential Clients: Developers often assume PKCE is only for public SPAs; OAuth 2.1 mandates PKCE for confidential backend servers as well to prevent authorization code injection."
    ],
    keyTakeaways: [
      "Bearer tokens grant access to anyone holding the string; DPoP binds tokens to a client's private key.",
      "DPoP proofs bind every individual API request to its exact HTTP method and URI, preventing token reuse across endpoints.",
      "OAuth 2.1 deprecates the Implicit Grant and Resource Owner Password Credentials, making Authorization Code with PKCE mandatory."
    ]
  },
  {
    id: "sec-deep-04",
    title: "Zero Trust Architecture (ZTA) & Google BeyondCorp Principles",
    category: "Security Architecture",
    readTimeMinutes: 30,
    overview: "Zero Trust Architecture (ZTA) discards the outdated perimeter security model, operating on the principle that the internal network is just as hostile as the public internet. This masterclass breaks down the NIST SP 800-207 standard, Google BeyondCorp deployment patterns, and Policy Decision Point (PDP) orchestration.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        NIST SP 800-207 ZERO TRUST LOGICAL ARCHITECTURE             |
+-----------------------------------------------------------------------------------+
  [ UNTRUSTED USER & DEVICE ]
            |
            | Subject Requests Access to Resource
            v
  +-------------------------------------------------------------------------------+
  | CONTROL PLANE (POLICY ENGINE & DECISION POINT)                                |
  |                                                                               |
  |  +---------------------+   +---------------------+   +---------------------+  |
  |  | Policy Engine (PE)  |   | Device Posture (EDR)|   | Continuous Intel    |  |
  |  | RBAC / ABAC Rules   |   | Disk Encrypted? OS? |   | Threat Feeds / SIEM |  |
  |  +---------------------+   +---------------------+   +---------------------+  |
  |                            |                                                  |
  |                            v                                                  |
  |            [ POLICY DECISION POINT (PDP) VERDICT ]                            |
  |                 Allow / Deny / Step-Up MFA                                    |
  +-------------------------------------------------------------------------------+
            |
            | Dynamic Credential & Access Token Issued
            v
  +-------------------------------------------------------------------------------+
  | DATA PLANE (POLICY ENFORCEMENT POINT - PEP)                                   |
  |                                                                               |
  |  [ Web Application Proxy / Envoy Sidecar / Identity-Aware Proxy (IAP) ]      |
  |                                 |                                             |
  |                                 v (Authenticated mTLS Tunnel)                 |
  |  [ INTERNAL SENSITIVE ENTERPRISE RESOURCE: DATABASE / INTERNAL API / ERP ]    |
  +-------------------------------------------------------------------------------+
`,
    deepDive: `### 1. The Failure of Perimeter Security
The traditional enterprise security model relied on the \"castle-and-moat\" paradigm:
- A strong perimeter (firewalls, VPNs) divided the world into \"untrusted external\" and \"trusted internal\".
- Once an attacker bypassed the perimeter (via phishing, VPN credential theft, or an infected laptop), they enjoyed unrestricted lateral movement across flat internal subnets.
- Insider threats and compromised endpoints could dump database records without triggering alerts because internal network traffic was implicitly trusted.

### 2. Core Tenets of NIST SP 800-207
NIST SP 800-207 defines the foundational tenets of Zero Trust:
1. **All data sources and computing services are considered resources.**
2. **All communication is secured regardless of network location.** Internal network traffic receives zero implicit trust; traffic between two servers in the same rack must be authenticated and encrypted via mTLS.
3. **Access to individual enterprise resources is granted on a per-session basis.**
4. **Access is determined dynamically by policy**: Factoring in user identity, cryptographic credentials, device health posture (patch level, EDR status, disk encryption), and behavioral telemetry.
5. **The enterprise monitors and measures the integrity and security posture of all owned and associated assets.**
6. **All resource authentication and authorization are dynamic and strictly enforced before access is allowed.**
7. **The enterprise collects continuous telemetry regarding the current state of assets and network infrastructure to actively adapt security policies.**

### 3. Google BeyondCorp Implementation Architecture
Google implemented BeyondCorp to eliminate internal corporate VPNs entirely:
- **Identity-Aware Proxy (IAP)**: All internal applications (source code repositories, HR portals, bug trackers) are exposed through a hardened public reverse proxy.
- **Device Inventory Database**: Every corporate device possesses a hardware TPM (Trusted Platform Module) certificate. The IAP verifies that the user is authenticated AND the request originates from a managed, compliant corporate device.
- **Continuous Evaluation**: If an employee connects from a trusted device, access is granted. If the device's CrowdStrike EDR detects malware 10 minutes later, the Policy Decision Point revokes the session token immediately, cutting off access in mid-session.`,
    edgeCasesAndPitfalls: [
      "Device Health Posture Spoofing: relying on client-supplied headers (e.g. \`X-Device-Encrypted: true\`) rather than cryptographic hardware TPM/Secure Enclave attestation.",
      "Session Lifetime Traps: granting 8-hour OAuth tokens without continuous risk evaluation; if an account is compromised, the attacker has an 8-hour window before re-authentication.",
      "VPN-to-Zero-Trust Migration Gaps: keeping legacy internal management protocols (RDP, IPMI, SSH) accessible over flat subnets while only securing web HTTP interfaces."
    ],
    keyTakeaways: [
      "Zero Trust operates under the mandate: 'Never Trust, Always Verify'. Network location provides zero privileges.",
      "Access decisions must combine user identity, cryptographic credentials, and real-time device posture attestation.",
      "Decouple the Control Plane (Policy Decision Point) from the Data Plane (Policy Enforcement Point)."
    ]
  },
  {
    id: "sec-deep-05",
    title: "Advanced SSRF in Cloud Infrastructures & Metadata Defense",
    category: "Vulnerability Mechanics & Cloud Defense",
    readTimeMinutes: 28,
    overview: "Server-Side Request Forgery (SSRF) has escalated from a simple internal port scanning vulnerability into the primary vector for catastrophic cloud account takeovers (e.g. the Capital One breach). This masterclass details the mechanics of cloud metadata exfiltration, DNS rebinding exploits, and IMDSv2 cryptographic session defenses.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        SSRF EXPLOITATION VS IMDSV2 CRYPTOGRAPHIC DEFENSE           |
+-----------------------------------------------------------------------------------+
  [ ATTACKER ]
       |
       | 1. Submit Malicious URL: "http://169.254.169.254/latest/meta-data/..."
       v
  [ VULNERABLE CLOUD BACKEND SERVICE ]
       |
       | 2. Server naively executes GET request to Link-Local Metadata IP
       v
  +-------------------------------------------------------------------------------+
  | AWS INSTANCE METADATA SERVICE (IMDS)                                          |
  |                                                                               |
  | [ VULNERABLE IMDSv1 ]:                                                        |
  |   - Accepts simple HTTP GET request without custom headers                    |
  |   - RETURNS: AWS SecretAccessKey, AccessKeyId, Token of attached IAM Role!    |
  |   - RESULT: ATTACKER ACHIEVES FULL CLOUD PRIVILEGE ESCALATION!                |
  |                                                                               |
  | [ HARDENED IMDSv2 ]:                                                          |
  |   - STEP 1: Must execute HTTP PUT with header "X-aws-ec2-metadata-token-ttl"  |
  |   - STEP 2: Issues short-lived session token                                  |
  |   - STEP 3: Requires session token header on subsequent GETs                  |
  |   - RESULT: SSRF EXPLOIT BLOCKED! (Standard SSRF cannot forge PUT + headers!) |
  +-------------------------------------------------------------------------------+
`,
    deepDive: `### 1. How SSRF Leads to Cloud Account Takeover
Server-Side Request Forgery occurs when an application accepts a URL from a user (e.g. for image processing, webhooks, or PDF generation) and makes an outbound HTTP request on behalf of that user without validating the target IP.
- **The Link-Local Target (\`169.254.169.254\`)**: In AWS, Azure, and GCP, every virtual machine or container can query the link-local IP \`169.254.169.254\` over the local hypervisor virtual NIC to retrieve instance metadata.
- **The Capital One Breach Vector**:
  1. An attacker identified an SSRF vulnerability in a misconfigured WAF instance.
  2. The attacker forced the WAF to query: \`http://169.254.169.254/latest/meta-data/iam/security-credentials/WAF-Role\`.
  3. The metadata service returned temporary AWS IAM STS credentials (\`AccessKeyId\`, \`SecretAccessKey\`, \`Token\`).
  4. The WAF IAM role possessed overly broad permissions (\`s3:*\`).
  5. The attacker configured the stolen credentials in their local AWS CLI and downloaded over 100 million customer credit card applications from S3.

### 2. The DNS Rebinding Attack Vector
Naive application-level SSRF mitigations typically check the domain name or IP address before fetching:
\`\`\`typescript
const ip = await resolveDns(url.hostname);
if (isPrivateIp(ip)) throw new Error(\"Forbidden\");
await fetch(url); // VULNERABLE TO DNS REBINDING!
\`\`\`
- **The Exploit**: The attacker configures a custom nameserver with a Time-To-Live (TTL) of 0 seconds.
  1. On the first DNS lookup (\`resolveDns\`), the nameserver responds with a harmless public IP (\`203.0.113.195\`). The application's check passes.
  2. A fraction of a millisecond later, when \`fetch(url)\` executes, the DNS cache has expired. The browser/Node runtime resolves DNS a second time.
  3. The attacker's nameserver responds with \`169.254.169.254\` (or \`127.0.0.1\`).
  4. The HTTP client sends the request directly to the internal target, completely bypassing the validation check!

### 3. Comprehensive Multi-Layered SSRF Defense
1. **Mandate AWS IMDSv2**:
   - Enforce \`HttpTokens: required\` on all EC2 launch templates and ECS task definitions.
   - Set \`HttpPutResponseHopLimit: 1\` (prevents containers running inside an EC2 instance from querying IMDS because container bridge networking requires a second network hop, which the packet TTL drops).
2. **Socket-Level Connection Pinning**:
   - Never resolve DNS separately from the socket connection.
   - Use a custom HTTP Agent that intercepts the raw TCP connection event, inspects the physical IP resolved during socket connection, and aborts the TCP socket if the IP is in an RFC 1918 or link-local range.
3. **Egress Forward Proxy**:
   - Route all outbound requests through a hardened forward proxy (Squid / Envoy) that enforces IP blacklists at the network boundary.`,
    edgeCasesAndPitfalls: [
      "IPv6 Link-Local and Loopback Targets: developers often filter \`127.0.0.1\` and \`169.254.169.254\` but forget IPv6 equivalents (\`::1\`, \`[0:0:0:0:0:0:0:1]\`, \`[fe80::...]\`), allowing attackers to bypass blacklists.",
      "Decimal / Octal / Hex IP Representations: Attackers bypass regexes using alternative IP notations: \`2130706433\` (decimal for 127.0.0.1), \`0177.0.0.1\` (octal), or \`0x7f000001\` (hex).",
      "HTTP 301/302 Redirect Bypasses: An application validates that \`https://safe.com\` is public, but \`safe.com\` returns a 302 redirect pointing to \`http://169.254.169.254\`. If the HTTP client auto-follows redirects, SSRF succeeds."
    ],
    keyTakeaways: [
      "SSRF allows attackers to abuse backend servers as network proxies to access internal services and cloud metadata.",
      "IMDSv2 neutralizes SSRF against cloud metadata by requiring a session token generated via an HTTP PUT request.",
      "Defend against DNS rebinding by performing IP validation at the socket connection level, not in pre-fetch DNS lookups."
    ]
  },
  {
    id: "sec-deep-06",
    title: "XSS, DOM Clobbering & Cryptographic Content Security Policy (CSP)",
    category: "Web Application Defense",
    readTimeMinutes: 28,
    overview: "Cross-Site Scripting (XSS) remains one of the most pervasive web application vulnerabilities. This masterclass dives into browser parser differentials, DOM Clobbering mechanics, and the implementation of strict nonce-based Content Security Policy (CSP Level 3).",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        STRICT NONCE-BASED CONTENT SECURITY POLICY (CSP)           |
+-----------------------------------------------------------------------------------+
  [ HTTP REQUEST ]
         |
         | Client requests https://app.enterprise.com
         v
  +-------------------------------------------------------------------------------+
  | SERVER EDGE / MIDDLEWARE                                                      |
  |                                                                               |
  | 1. Generate 128-bit CSPRNG Nonce: "N0nc3_b4s3_64_xyz=="                      |
  | 2. Inject Response Header:                                                    |
  |    Content-Security-Policy:                                                   |
  |      default-src 'self';                                                      |
  |      script-src 'nonce-N0nc3_b4s3_64_xyz==' 'strict-dynamic' https:;          |
  |      object-src 'none'; base-uri 'none';                                      |
  | 3. Render HTML with Nonced Tags:                                              |
  |    <script nonce="N0nc3_b4s3_64_xyz==" src="/app.js"></script>                 |
  +-------------------------------------------------------------------------------+
         |
         v
  [ CLIENT BROWSER EXECUTION ]
    - <script nonce="N0nc3..."> -> MATCHES HEADER -> EXECUTED!
    - <script>alert(1)</script> (Injected via XSS) -> NO NONCE -> BLOCKED BY CSP!
    - <img src=x onerror=alert(1)> (Inline Handler) -> BLOCKED BY CSP!
`,
    deepDive: `### 1. Browser Parsing Mechanics & XSS Injection Vectors
Browsers parse HTML using stateful, fault-tolerant state machine algorithms specified by WHATWG.
- **Context-Aware Sinks**: Where user input is placed dictates what characters are dangerous:
  - **HTML Body Context**: \`<div>{{input}}</div>\`: \`<\` and \`>\` must be encoded (\`&lt;\`, \`&gt;\`) to prevent tag injection.
  - **Attribute Context**: \`<input value=\"{{input}}\">\`: Quotes (\`\"\`) must be encoded to prevent attribute breakout.
  - **JavaScript Context**: \`<script>let id = '{{input}}';</script>\`: Quotes, backslashes, and \`</script>\` must be sanitized; standard HTML entity encoding does not protect against JavaScript string breakout!
  - **URI Context**: \`<a href=\"{{input}}\">\`: An attacker supplying \`javascript:alert(1)\` achieves XSS without any special characters or HTML tags!

### 2. DOM Clobbering Mechanics
DOM Clobbering occurs when an attacker injects harmless-looking HTML elements with \`id\` or \`name\` attributes that override or shadow global JavaScript variables or DOM APIs.
- **The Exploit**: Browsers automatically expose named DOM elements as properties on the global \`window\` object.
  \`\`\`html
  <!-- Injected benign HTML -->
  <a id=\"config\" href=\"https://evil.com/evil.js\">Click</a>
  \`\`\`
- If the application code later executes:
  \`\`\`javascript
  // Application assumes 'window.config' is either an object or undefined
  const scriptUrl = window.config?.url || '/static/app.js';
  loadScript(scriptUrl);
  \`\`\`
- The browser resolves \`window.config\` to the injected HTMLAnchorElement. When converted to a string, the anchor element evaluates to its \`href\` attribute (\`\"https://evil.com/evil.js\"\`), tricking the application into loading attacker-controlled JavaScript!
- **Mitigation**: Sanitize HTML using DOMPurify with the \`SANITIZE_DOM: true\` option enabled (which removes clobbering IDs) and freeze global configuration objects (\`Object.freeze(config)\`).

### 3. Strict Nonce-Based CSP Level 3
Domain-whitelist CSPs (\`script-src 'self' https://trusted-cdn.com\`) have been proven ineffective by Google research: 95%+ of whitelist-based CSPs can be bypassed via open redirects, Angular/JSONP endpoints, or CDN script hosting on whitelisted domains.
- **The Strict-Dynamic Pattern**:
  \`\`\`http
  Content-Security-Policy: 
    script-src 'nonce-{RANDOM}' 'strict-dynamic' https: 'unsafe-inline';
    object-src 'none';
    base-uri 'none';
  \`\`\`
  - **\`'nonce-{RANDOM}'\`**: Browsers only execute scripts with an exact matching cryptographic nonce.
  - **\`'strict-dynamic'\`**: In modern browsers, scripts with a valid nonce are allowed to dynamically load additional scripts (e.g. webpack chunks) without needing to whitelist every CDN or sub-chunk domain.
  - **\`'unsafe-inline' https:\`**: Ignored by modern browsers when \`'strict-dynamic'\` is present; serves as a backward-compatibility fallback for legacy browsers.`,
    edgeCasesAndPitfalls: [
      "Static Nonces: Hardcoding a static nonce string in server code completely destroys CSP protection; nonces must be cryptographically unpredictable and generated per individual HTTP response.",
      "Base Tag Hijacking: Omitting \`base-uri 'none'\` or \`base-uri 'self'\` allows an attacker to inject \`<base href='https://evil.com/'>\`, altering relative script URLs to load from attacker servers.",
      "JSON Parsing XSS: Embedding JSON objects directly into script tags (\`<script>window.__DATA__ = \${JSON.stringify(data)}</script>\`): if \`data\` contains \`</script>\`, the browser's HTML parser closes the script block prematurely and executes subsequent injected HTML."
    ],
    keyTakeaways: [
      "Context-aware output encoding is mandatory because different HTML/JS/URI contexts require different escape rules.",
      "DOM Clobbering abuses named HTML elements to overwrite global JavaScript variables and hijack execution paths.",
      "Deploy strict nonce-based CSP with 'strict-dynamic' and per-request cryptographic nonces as the ultimate defense-in-depth against XSS."
    ]
  }
];
