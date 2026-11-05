// scripts/examples_security/part3_recipes_21_to_30.cjs
module.exports = [
  {
    id: "sec-ex-21",
    title: "Server-Side Request Forgery (SSRF) Guard & DNS Resolution Validator",
    category: "OWASP Top 10 & Web Defense",
    difficulty: "advanced",
    whatThisCodeCovers: "A bulletproof SSRF defense utility resolving DNS prior to socket connection and rejecting loopback, link-local, and RFC 1918 private IP addresses.",
    conceptsCovered: ["SSRF Defense", "DNS Resolution", "ipaddr.js", "Private IP Filtering", "Link-Local Block"],
    code: `// lib/security/ssrfGuard.ts
import dns from 'dns/promises';
import ipaddr from 'ipaddr.js';

export async function assertSafeUrl(rawUrl: string): Promise<URL> {
  const parsed = new URL(rawUrl);

  // 1. Only allow HTTP and HTTPS protocols (blocks file://, gopher://, ftp://)
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error(\`Forbidden protocol: \${parsed.protocol}\`);
  }

  // 2. Resolve DNS to physical IP addresses
  const addresses = await dns.resolve4(parsed.hostname);

  if (addresses.length === 0) {
    throw new Error('Hostname did not resolve to any IPv4 address');
  }

  for (const ipStr of addresses) {
    const addr = ipaddr.parse(ipStr);
    const range = addr.range();

    // 3. Block loopback, link-local, private networks, and multicast
    if (['loopback', 'private', 'linkLocal', 'multicast', 'carrierGradeNat'].includes(range)) {
      throw new Error(\`SSRF Blocked: Destination IP \${ipStr} is in forbidden range: \${range}\`);
    }

    // 4. Specifically assert AWS Link-Local metadata IP is blocked!
    if (ipStr === '169.254.169.254') {
      throw new Error('SSRF Blocked: Attempt to contact Cloud Metadata Service!');
    }
  }

  return parsed;
}`,
    breakdown: [
      "Restricts protocols to http and https, blocking file:// and gopher://.",
      "Resolves DNS and uses ipaddr.js to check IP classification ranges.",
      "Explicitly drops 169.254.169.254 and RFC 1918 (10.x, 172.16.x, 192.168.x) networks."
    ],
    expectedOutput: "Validates public domains like https://example.com; throws error on internal IP targets."
  },
  {
    id: "sec-ex-22",
    title: "AWS IMDSv2 Token Fetcher & Metadata Query Client",
    category: "Container & Cloud Security",
    difficulty: "intermediate",
    whatThisCodeCovers: "A secure AWS EC2/ECS metadata client enforcing IMDSv2 session token exchange via HTTP PUT headers.",
    conceptsCovered: ["IMDSv2", "Cloud Metadata", "AWS Security", "Session Tokens", "SSRF Mitigation"],
    code: `// lib/aws/imdsv2Client.ts
const IMDS_HOST = 'http://169.254.169.254';

export class ImdsV2Client {
  private token: string | null = null;
  private tokenExpiresAt: number = 0;

  // 1. Fetch short-lived IMDSv2 session token using HTTP PUT
  private async getSessionToken(): Promise<string> {
    const now = Date.now();
    if (this.token && this.tokenExpiresAt > now) {
      return this.token;
    }

    const response = await fetch(\`\${IMDS_HOST}/latest/api/token\`, {
      method: 'PUT',
      headers: {
        'X-aws-ec2-metadata-token-ttl-seconds': '21600' // 6-hour TTL
      },
      signal: AbortSignal.timeout(1000)
    });

    if (!response.ok) {
      throw new Error('Failed to acquire IMDSv2 session token');
    }

    this.token = await response.text();
    this.tokenExpiresAt = now + (21500 * 1000);
    return this.token;
  }

  // 2. Query metadata endpoint with mandatory session token header
  async getMetadata(path: string): Promise<string> {
    const token = await this.getSessionToken();

    const response = await fetch(\`\${IMDS_HOST}/latest/meta-data/\${path}\`, {
      headers: {
        'X-aws-ec2-metadata-token': token
      },
      signal: AbortSignal.timeout(1000)
    });

    if (!response.ok) {
      throw new Error(\`Failed to fetch metadata for \${path}: \${response.statusText}\`);
    }

    return await response.text();
  }
}`,
    breakdown: [
      "Acquires IMDSv2 token via HTTP PUT with X-aws-ec2-metadata-token-ttl-seconds.",
      "Caches session token in memory with automatic rotation.",
      "Passes token header on all subsequent GET queries, adhering to cloud security benchmarks."
    ],
    expectedOutput: "Fetches instance metadata securely; immune to basic GET-based SSRF attacks."
  },
  {
    id: "sec-ex-23",
    title: "Safe XML Parser Disabling External Entities (XXE Defense)",
    category: "OWASP Top 10 & Web Defense",
    difficulty: "intermediate",
    whatThisCodeCovers: "Hardening XML parsers by disabling DTD loading, external entity resolution, and network connections to neutralize XXE vulnerabilities.",
    conceptsCovered: ["XXE Defense", "XML Parsing", "fast-xml-parser", "DTD Disabling"],
    code: `// lib/security/safeXmlParser.ts
import { XMLParser } from 'fast-xml-parser';

export function parseSafeXml<T = any>(xmlString: string): T {
  // fast-xml-parser is pure JS and does not resolve external entities by default
  const parser = new XMLParser({
    ignoreAttributes: false,
    parseAttributeValue: false,
    trimValues: true,
    // CRITICAL: Block external entity declarations & DTD execution
    processEntities: false,
    stopNodes: ['*.script']
  });

  // Pre-parsing guard: Reject any XML payload containing <!DOCTYPE or <!ENTITY
  const upper = xmlString.toUpperCase();
  if (upper.includes('<!DOCTYPE') || upper.includes('<!ENTITY') || upper.includes('SYSTEM')) {
    throw new Error('XXE Detected: XML Document Type Definitions (DTDs) are forbidden!');
  }

  return parser.parse(xmlString);
}`,
    breakdown: [
      "Rejects any XML containing <!DOCTYPE or <!ENTITY before parser invocation.",
      "Configures processEntities: false to prevent XML entity expansion bombs (Billion Laughs).",
      "Safely parses structured data without exposing filesystem or local network."
    ],
    expectedOutput: "Parses standard XML safely; throws error if external DTD or entity tags are present."
  },
  {
    id: "sec-ex-24",
    title: "Prototype Pollution Free Object Deep Clone Utility",
    category: "OWASP Top 10 & Web Defense",
    difficulty: "intermediate",
    whatThisCodeCovers: "A recursive deep-clone and merge utility that drops __proto__, constructor, and prototype keys to neutralize Prototype Pollution.",
    conceptsCovered: ["Prototype Pollution", "Object.create(null)", "Deep Merge", "Vulnerability Defense"],
    code: `// lib/security/safeClone.ts
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function safeDeepMerge<T = any>(target: any, source: any): T {
  if (!source || typeof source !== 'object') {
    return source;
  }

  if (!target || typeof target !== 'object') {
    target = Array.isArray(source) ? [] : Object.create(null);
  }

  for (const key of Object.keys(source)) {
    // 1. Drop poisoned keys that modify Object.prototype!
    if (FORBIDDEN_KEYS.has(key)) {
      continue;
    }

    const value = source[key];

    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        target[key] = value.map(item => safeDeepMerge(undefined, item));
      } else {
        target[key] = safeDeepMerge(target[key], value);
      }
    } else {
      target[key] = value;
    }
  }

  return target;
}`,
    breakdown: [
      "Maintains explicit blacklist of '__proto__', 'constructor', and 'prototype'.",
      "Uses Object.create(null) to create prototype-less target dictionaries.",
      "Safely handles nested objects and arrays without modifying Object.prototype."
    ],
    expectedOutput: "Clones complex objects cleanly; drops any malicious __proto__ attributes."
  },
  {
    id: "sec-ex-25",
    title: "Path Traversal Proof File System Reader with Canonicalization",
    category: "OWASP Top 10 & Web Defense",
    difficulty: "intermediate",
    whatThisCodeCovers: "Preventing directory traversal attacks (../../) by canonicalizing file paths with path.resolve and enforcing strict root directory boundaries.",
    conceptsCovered: ["Path Traversal", "path.resolve", "Canonicalization", "Local File Inclusion", "path.sep"],
    code: `// lib/storage/safeFileReader.ts
import path from 'path';
import fs from 'fs/promises';

const STORAGE_ROOT = path.resolve('/var/app/data/uploads');

export async function readSafeFile(userRequestedRelativePath: string): Promise<Buffer> {
  // 1. Resolve absolute canonical path
  const canonicalPath = path.resolve(STORAGE_ROOT, userRequestedRelativePath);

  // 2. Strict Root Boundary Check: Must start with STORAGE_ROOT + path separator!
  if (!canonicalPath.startsWith(STORAGE_ROOT + path.sep)) {
    const error = new Error('Access Denied: Path traversal outside root directory');
    (error as any).status = 403;
    throw error;
  }

  // 3. Verify it is a regular file, not a symlink pointing elsewhere
  const stats = await fs.lstat(canonicalPath);
  if (!stats.isFile()) {
    throw new Error('Target is not a regular file');
  }

  return await fs.readFile(canonicalPath);
}`,
    breakdown: [
      "path.resolve resolves all relative '.' and '..' segments into a normalized absolute path.",
      "asserts startsWith(STORAGE_ROOT + path.sep) to stop attackers escaping the upload sandbox.",
      "fs.lstat verifies the file is not a symbolic link pointing to /etc/shadow."
    ],
    expectedOutput: "Reads authorized files within storage directory; throws 403 on '../../etc/passwd'."
  },
  {
    id: "sec-ex-26",
    title: "Strict URL Validator Disallowing Open Redirects",
    category: "OWASP Top 10 & Web Defense",
    difficulty: "beginner",
    whatThisCodeCovers: "A safe URL validator verifying relative redirects and whitelisted domains, neutralizing protocol-relative and open redirect exploits.",
    conceptsCovered: ["Open Redirect", "URL Parsing", "Protocol-Relative URLs", "Origin Whitelisting"],
    code: `// lib/security/safeRedirect.ts
const WHITELISTED_DOMAINS = new Set([
  'app.enterprise.com',
  'billing.enterprise.com',
  'enterprise.com'
]);

export function getSafeRedirectUrl(target: string | undefined | null, fallback: string = '/dashboard'): string {
  if (!target || typeof target !== 'string') return fallback;

  const trimmed = target.trim();

  // 1. Safe Relative Redirect: Must start with single '/', NOT double '//'
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\\\')) {
    return trimmed;
  }

  try {
    // 2. Absolute URL check
    const parsed = new URL(trimmed);

    // Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return fallback;
    }

    // Strict domain whitelist
    if (WHITELISTED_DOMAINS.has(parsed.hostname)) {
      return trimmed;
    }
  } catch {
    // Malformed URL, use fallback
  }

  return fallback;
}`,
    breakdown: [
      "Validates startsWith('/') and rejects '//' to stop protocol-relative redirects to //evil.com.",
      "Rejects backslashes ('\\\\') which some browsers normalize to forward slashes.",
      "Matches absolute URLs against a strict domain whitelist."
    ],
    expectedOutput: "Returns valid relative path or whitelisted URL; defaults to /dashboard on phishing attempts."
  },
  {
    id: "sec-ex-27",
    title: "Mass Assignment Defense with Strict Zod DTO Schema Parsing",
    category: "OWASP Top 10 & Web Defense",
    difficulty: "beginner",
    whatThisCodeCovers: "Using Zod's .strict() method to reject unexpected input properties, preventing mass assignment and over-posting attacks.",
    conceptsCovered: ["Mass Assignment", "Over-Posting", "Zod DTO", "strict()", "Input Sanitization"],
    code: `// schemas/userProfileDto.ts
import { z } from 'zod';

// Strict DTO: Rejects ANY unexpected properties like 'isAdmin', 'role', or 'credits'
export const UpdateProfileSchema = z.object({
  displayName: z.string().min(2).max(50).trim(),
  phoneNumber: z.string().regex(/^\\+[1-9]\\d{1,14}$/).optional(),
  bio: z.string().max(280).optional(),
  themePreference: z.enum(['light', 'dark', 'system']).default('system')
}).strict(); // MANDATORY: .strict() throws error if unwhitelisted keys are present!

export type UpdateProfileDto = z.infer<typeof UpdateProfileSchema>;

export async function updateUserProfile(untrustedInput: unknown, userId: string) {
  // Throws ZodError if client sends { displayName: "Alice", role: "ADMIN" }
  const cleanData = UpdateProfileSchema.parse(untrustedInput);

  return await db.user.update({
    where: { id: userId },
    data: cleanData
  });
}`,
    breakdown: [
      ".strict() enforces that only declared fields are allowed in the request body.",
      "Throws immediate validation error if an attacker attempts to inject 'role' or 'isAdmin'.",
      "Guarantees that database update calls receive only sanitized, expected fields."
    ],
    expectedOutput: "Accepts valid profile updates; rejects extra fields with HTTP 400 Bad Request."
  },
  {
    id: "sec-ex-28",
    title: "Stripe-Compatible HMAC Webhook Signature Verifier with Replay Tolerance",
    category: "API & Microservice Security",
    difficulty: "intermediate",
    whatThisCodeCovers: "Verifying incoming webhook signatures using timestamped HMAC-SHA256 and constant-time comparison adhering to Stripe/GitHub standards.",
    conceptsCovered: ["Webhook Security", "HMAC-SHA256", "Replay Defense", "crypto.timingSafeEqual", "Tolerance Window"],
    code: `// lib/webhooks/verifySignature.ts
import crypto from 'crypto';

export function verifyStripeWebhook(
  rawBodyBuffer: Buffer,
  signatureHeader: string,
  webhookSecret: string,
  toleranceSeconds: number = 300 // 5 minutes
): boolean {
  if (!signatureHeader || !webhookSecret) return false;

  // 1. Parse header components: t=1614555819,v1=5257a...
  const parts = Object.fromEntries(
    signatureHeader.split(',').map(kv => {
      const [k, v] = kv.split('=');
      return [k.trim(), v?.trim()];
    })
  );

  const timestamp = parseInt(parts.t, 10);
  const signatureHex = parts.v1;

  if (isNaN(timestamp) || !signatureHex) return false;

  // 2. Reject replays older than tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    throw new Error('Webhook timestamp outside acceptable tolerance window');
  }

  // 3. Compute expected HMAC: HMAC_SHA256(secret, "\${timestamp}.\${rawBody}")
  const payloadToSign = Buffer.concat([
    Buffer.from(\`\${timestamp}.\`, 'utf8'),
    rawBodyBuffer
  ]);

  const expectedHmac = crypto.createHmac('sha256', webhookSecret)
    .update(payloadToSign)
    .digest();

  const suppliedHmac = Buffer.from(signatureHex, 'hex');

  if (expectedHmac.length !== suppliedHmac.length) return false;

  // 4. Constant-Time verification
  return crypto.timingSafeEqual(expectedHmac, suppliedHmac);
}`,
    breakdown: [
      "Extracts timestamp 't' and signature 'v1' from header string.",
      "Rejects timestamps older than 300 seconds to eliminate replay attacks.",
      "Computes HMAC over raw byte buffer concatenated with timestamp using timingSafeEqual."
    ],
    expectedOutput: "Returns true for valid webhook signature; throws error on expired or tampered payloads."
  },
  {
    id: "sec-ex-29",
    title: "Distributed Sliding-Window Rate Limiter using Redis Lua Script",
    category: "API & Microservice Security",
    difficulty: "advanced",
    whatThisCodeCovers: "A high-performance atomic sliding-window rate limiter in Redis using Lua scripting, preventing boundary burst attacks.",
    conceptsCovered: ["Rate Limiting", "Sliding Window", "Redis Lua", "Atomicity", "DoS Mitigation"],
    code: `// lib/security/slidingWindowRateLimiter.ts
import { Redis } from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Atomic Redis Lua Script for Sliding Window Log
const SLIDING_WINDOW_LUA = \`
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local windowMs = tonumber(ARGV[2])
  local maxRequests = tonumber(ARGV[3])

  -- 1. Remove timestamps older than current window
  redis.call('ZREMRANGEBYSCORE', key, '-inf', now - windowMs)

  -- 2. Count requests in current sliding window
  local currentCount = redis.call('ZCARD', key)

  if currentCount < maxRequests then
    -- Add current request timestamp
    redis.call('ZADD', key, now, now)
    -- Set TTL to ensure key auto-evicts after window expires
    redis.call('PEXPIRE', key, windowMs)
    return {1, maxRequests - currentCount - 1} -- Allowed, remaining
  else
    return {0, 0} -- Denied
  end
\`;

export async function checkRateLimit(
  identifier: string,
  windowMs: number = 60000,
  maxRequests: number = 100
): Promise<{ allowed: boolean; remaining: number }> {
  const key = \`ratelimit:\${identifier}\`;
  const now = Date.now();

  const [allowed, remaining] = (await redis.eval(
    SLIDING_WINDOW_LUA,
    1,
    key,
    now,
    windowMs,
    maxRequests
  )) as [number, number];

  return {
    allowed: allowed === 1,
    remaining
  };
}`,
    breakdown: [
      "Executes atomically in Redis via Lua script, eliminating race conditions under concurrency.",
      "Uses Redis Sorted Sets (ZADD/ZREMRANGEBYSCORE) to maintain an exact rolling millisecond window.",
      "Returns allowed flag and remaining quota to embed in rate-limit response headers."
    ],
    expectedOutput: "Returns { allowed: true, remaining: 99 }; switches to allowed: false when quota is reached."
  },
  {
    id: "sec-ex-30",
    title: "Strict CORS Header Middleware with Origin Whitelisting",
    category: "API & Microservice Security",
    difficulty: "intermediate",
    whatThisCodeCovers: "Hardening CORS middleware by matching incoming origins against an explicit whitelist, blocking wildcard credentials and null origins.",
    conceptsCovered: ["CORS", "Origin Whitelist", "Access-Control-Allow-Credentials", "Preflight Handling"],
    code: `// middleware/strictCors.ts
import { Request, Response, NextFunction } from 'express';

const ALLOWED_ORIGINS = new Set([
  'https://app.enterprise.com',
  'https://checkout.enterprise.com'
]);

export function strictCorsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  // 1. If origin matches whitelist, set headers
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin'); // Critical for caching proxies!
  }

  // 2. Handle HTTP OPTIONS preflight request
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24h
    return res.status(204).end();
  }

  next();
}`,
    breakdown: [
      "Matches origin against strict Set, preventing reflection vulnerabilities.",
      "Never allows 'Access-Control-Allow-Origin: *' when credentials are true.",
      "Sets 'Vary: Origin' to prevent shared CDNs caching one user's CORS response for another."
    ],
    expectedOutput: "Responds to OPTIONS preflight with 204; sets strict CORS headers on approved origins."
  }
];
