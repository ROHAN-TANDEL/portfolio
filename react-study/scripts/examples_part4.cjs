// Batch 4: Security, Hardening & Cryptography (Examples 31 - 40)
module.exports = [
  {
    id: "ex-node-031",
    title: "Prototype Pollution-Proof Deep Object Merger with Object.create(null)",
    category: "Security & Hardening",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to safely deep-merge untrusted JSON payloads without risking Prototype Pollution vulnerabilities on Object.prototype.",
    conceptsCovered: [
      "Prototype pollution defense",
      "Object.create(null) dictionary maps",
      "Dangerous key filtering (__proto__, constructor, prototype)",
      "Object.freeze(Object.prototype)"
    ],
    code: `export function safeDeepMerge(target, source) {
  // If target is null or not an object, start with a prototype-less object:
  const output = target && typeof target === 'object' ? target : Object.create(null);

  for (const key of Object.keys(source)) {
    // 1. DANGEROUS KEY GUARD: Block Prototype Pollution vectors!
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }

    const sourceVal = source[key];

    if (sourceVal && typeof sourceVal === 'object' && !Array.isArray(sourceVal)) {
      output[key] = safeDeepMerge(output[key] || Object.create(null), sourceVal);
    } else {
      output[key] = sourceVal;
    }
  }

  return output;
}

// Verification test:
export function testPrototypePollutionProtection() {
  const maliciousPayload = JSON.parse('{"__proto__": {"isAdmin": true}}');
  const result = safeDeepMerge({}, maliciousPayload);

  console.log('Pollution attempt result:', ({}).isAdmin); // undefined (SAFE!)
  console.log('Merged output:', result);
}`,
    breakdown: [
      { lineRange: "3", note: "Object.create(null) has no prototype chain to pollute." },
      { lineRange: "6-9", note: "Explicitly filters out dangerous prototype keys." },
      { lineRange: "22-26", note: "Verifies ({}).isAdmin remains undefined after attack attempt." }
    ],
    expectedOutput: "Pollution attempt result: undefined; application safely rejects prototype injection."
  },

  {
    id: "ex-node-032",
    title: "Constant-Time HMAC Signature Verification with crypto.timingSafeEqual",
    category: "Security & Hardening",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to verify incoming webhook signatures (Stripe, GitHub) using constant-time comparison to completely eliminate sub-microsecond timing attack leaks.",
    conceptsCovered: [
      "crypto.timingSafeEqual",
      "crypto.createHmac",
      "Side-channel timing attack defense",
      "Constant-time string comparison"
    ],
    code: `import crypto from 'node:crypto';

export function verifyWebhookSignature(rawBody, incomingSignatureHeader, webhookSecret) {
  // 1. Calculate expected HMAC-SHA256 signature
  const expectedSignature = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBody)
    .digest('hex');

  const bufExpected = Buffer.from(expectedSignature, 'utf8');
  const bufIncoming = Buffer.from(incomingSignatureHeader || '', 'utf8');

  // 2. Length check must not short-circuit timing:
  if (bufExpected.length !== bufIncoming.length) {
    return false;
  }

  // 3. Constant-time byte-by-byte comparison:
  // Checks every single byte regardless of mismatch location!
  return crypto.timingSafeEqual(bufExpected, bufIncoming);
}`,
    breakdown: [
      { lineRange: "4-8", note: "Computes expected HMAC-SHA256 from raw unparsed HTTP body string." },
      { lineRange: "13-16", note: "Verifies buffer lengths match before constant-time comparison." },
      { lineRange: "19-20", note: "timingSafeEqual prevents attackers from measuring microsecond return latency." }
    ],
    expectedOutput: "Signature verified with constant-time execution, neutralizing side-channel attacks."
  },

  {
    id: "ex-node-033",
    title: "Memory-Hard Password Hashing & Verification via crypto.scrypt",
    category: "Security & Hardening",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to securely hash and verify user passwords natively in Node.js using crypto.scrypt with cryptographically random salts without third-party packages.",
    conceptsCovered: [
      "crypto.scrypt and crypto.randomBytes",
      "Memory-hard key derivation",
      "GPU brute-force defense",
      "crypto.timingSafeEqual hash verification"
    ],
    code: `import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(crypto.scrypt);

export async function hashPassword(password) {
  // 1. Generate 16 bytes of cryptographically secure random salt
  const salt = crypto.randomBytes(16).toString('hex');

  // 2. Derive 64-byte key using memory-hard scrypt algorithm
  const derivedKey = await scryptAsync(password, salt, 64);
  return \`\${salt}:\${derivedKey.toString('hex')}\`;
}

export async function verifyPassword(password, storedHashRecord) {
  const [salt, originalHex] = storedHashRecord.split(':');
  const originalBuf = Buffer.from(originalHex, 'hex');

  // Derive hash from entered password with original salt:
  const checkBuf = await scryptAsync(password, salt, 64);

  // Constant-time check:
  return crypto.timingSafeEqual(originalBuf, checkBuf);
}`,
    breakdown: [
      { lineRange: "8-12", note: "Generates unique random salt and runs scrypt memory-hard hashing." },
      { lineRange: "16-24", note: "Splits salt and hash, re-computes scrypt, and compares using timingSafeEqual." }
    ],
    expectedOutput: "Returns true for matching password in ~60ms; resists GPU dictionary attacks."
  },

  {
    id: "ex-node-034",
    title: "AES-256-GCM Authenticated Encryption & Decryption with Auth Tags",
    category: "Security & Hardening",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to encrypt and decrypt sensitive data (credit cards, PII) using AES-256-GCM authenticated cipher with initialization vectors (IV) and authentication tags.",
    conceptsCovered: [
      "crypto.createCipheriv ('aes-256-gcm')",
      "12-byte random IV generation",
      "16-byte Authentication Tag",
      "Tamper-proof payload verification"
    ],
    code: `import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptPayload(plainText, secretKey32Bytes) {
  // 1. Generate unique 12-byte Initialization Vector (IV) for GCM:
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, secretKey32Bytes, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag(); // 16-byte authentication tag

  // Package: iv (12B) + authTag (16B) + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptPayload(packedBase64, secretKey32Bytes) {
  const packed = Buffer.from(packedBase64, 'base64');

  const iv = packed.subarray(0, 12);
  const authTag = packed.subarray(12, 28);
  const ciphertext = packed.subarray(28);

  const decipher = crypto.createDecipheriv(ALGORITHM, secretKey32Bytes, iv);
  decipher.setAuthTag(authTag); // Set expected authentication tag

  // Throws error if ciphertext or tag was tampered with in transit!
  return decipher.update(ciphertext, undefined, 'utf8') + decipher.final('utf8');
}`,
    breakdown: [
      { lineRange: "7-13", note: "Uses AES-256-GCM with fresh 12-byte IV and extracts 16-byte Auth Tag." },
      { lineRange: "18-28", note: "Unpacks IV, Auth Tag, and ciphertext; decipher.setAuthTag asserts data integrity." }
    ],
    expectedOutput: "Encrypts and decrypts PII safely; tampering with 1 bit throws 'Unsupported state or unable to authenticate data'."
  },

  {
    id: "ex-node-035",
    title: "Asymmetric Digital Signatures with Ed25519 Keypairs",
    category: "Security & Hardening",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to generate modern Ed25519 keypairs, sign payloads with a private key, and verify signatures with a public key using node:crypto.",
    conceptsCovered: [
      "Ed25519 asymmetric cryptography",
      "crypto.generateKeyPairSync",
      "crypto.sign and crypto.verify",
      "Cryptographic integrity proof"
    ],
    code: `import crypto from 'node:crypto';

export function testEd25519DigitalSignature() {
  // 1. Generate Ed25519 keypair (High security, fast, compact 32-byte keys)
  const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519');

  const message = Buffer.from('Transfer $10,000 to Account #8891');

  // 2. Sign with Private Key
  const signature = crypto.sign(null, message, privateKey);
  console.log('Signature length:', signature.length, 'bytes'); // 64 bytes

  // 3. Verify with Public Key
  const isValid = crypto.verify(null, message, publicKey, signature);
  console.log('Original message verification:', isValid); // true

  // 4. Tampered message verification:
  const tampered = Buffer.from('Transfer $90,000 to Account #8891');
  const isTamperedValid = crypto.verify(null, tampered, publicKey, signature);
  console.log('Tampered message verification:', isTamperedValid); // false!
}`,
    breakdown: [
      { lineRange: "5-6", note: "Generates Ed25519 keypair natively in Node.js without OpenSSL CLI." },
      { lineRange: "10-12", note: "crypto.sign produces 64-byte cryptographic signature using private key." },
      { lineRange: "14-20", note: "crypto.verify validates signature with public key; detects single-character tampering." }
    ],
    expectedOutput: "Original message verification: true; Tampered message verification: false."
  },

  {
    id: "ex-node-036",
    title: "Distributed Redis Sliding-Window Rate Limiter Middleware",
    category: "Security & Hardening",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to protect sensitive endpoints from brute-force attacks across horizontal clusters using a Redis Sliding-Window sorted set algorithm.",
    conceptsCovered: [
      "Distributed rate limiting",
      "Redis sorted sets (ZADD, ZREMRANGEBYSCORE)",
      "Sliding window algorithm",
      "HTTP 429 Too Many Requests with Retry-After"
    ],
    code: `export function createRedisRateLimiter(redisClient, limit = 60, windowSeconds = 60) {
  return async (req, res, next) => {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);
    const key = \`rate_limit:\${clientIp}\`;

    try {
      const tx = redisClient.multi();
      tx.zremrangebyscore(key, 0, windowStart); // Remove calls older than window
      tx.zadd(key, now, \`\${now}-\${Math.random()}\`); // Record current timestamp
      tx.zcard(key);                             // Count total calls in current window
      tx.expire(key, windowSeconds);

      const [, , count] = await tx.exec();

      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - count));

      if (count > limit) {
        res.writeHead(429, {
          'Content-Type': 'application/json',
          'Retry-After': windowSeconds
        });
        return res.end(JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please retry later.'
        }));
      }

      next();
    } catch (err) {
      console.error('Rate limiter error:', err);
      next(); // Fail open if Redis is temporarily unreachable
    }
  };
}`,
    breakdown: [
      { lineRange: "8-14", note: "Uses Redis transaction (multi) to prune expired calls and add current timestamp in 1 round-trip." },
      { lineRange: "16-20", note: "Sets standard X-RateLimit headers and enforces HTTP 429 when threshold is reached." }
    ],
    expectedOutput: "Smoothly restricts traffic to 60 req/min per IP across all horizontal server instances."
  },

  {
    id: "ex-node-037",
    title: "SSRF Defense: Outbound URL Validation with Cloud Metadata IP Blocking",
    category: "Security & Hardening",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to defend against Server-Side Request Forgery (SSRF) by resolving hostnames and blocking internal RFC1918 private IPs and 169.254.169.254 cloud metadata endpoints.",
    conceptsCovered: [
      "SSRF (Server-Side Request Forgery) defense",
      "DNS resolution before connection",
      "Cloud metadata (169.254.169.254) blocking",
      "Private IP subnet rejection"
    ],
    code: `import dns from 'node:dns/promises';

const PRIVATE_SUBNETS = [
  /^127\\./,           // Loopback
  /^10\\./,            // RFC 1918 Class A
  /^172\\.(1[6-9]|2[0-9]|3[0-1])\\./, // RFC 1918 Class B
  /^192\\.168\\./,       // RFC 1918 Class C
  /^169\\.254\\./,       // Link-Local & AWS/GCP Cloud Metadata IP!
  /^0\\.0\\.0\\.0/
];

export async function assertSafeOutboundUrl(targetUrl) {
  const parsed = new URL(targetUrl);

  // 1. Only allow HTTP and HTTPS protocols:
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Blocked: Protocol must be http: or https:');
  }

  // 2. Resolve DNS to get actual IP addresses:
  const addresses = await dns.resolve4(parsed.hostname);

  for (const ip of addresses) {
    for (const pattern of PRIVATE_SUBNETS) {
      if (pattern.test(ip)) {
        throw new Error(\`SSRF Blocked: Host \${parsed.hostname} resolved to restricted IP \${ip}\`);
      }
    }
  }

  return targetUrl; // Safe to fetch!
}`,
    breakdown: [
      { lineRange: "3-10", note: "Defines regex patterns for loopback, private networks, and 169.254.169.254 cloud metadata." },
      { lineRange: "14-28", note: "Resolves destination hostname and strictly verifies no resolved IP touches private networks." }
    ],
    expectedOutput: "Rejects requests to internal AWS metadata (http://169.254.169.254) with SSRF Blocked error."
  },

  {
    id: "ex-node-038",
    title: "ReDoS-Resilient Token Extraction with Input Length Bounds",
    category: "Security & Hardening",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to prevent Regular Expression Denial of Service (ReDoS) by enforcing strict input length limits and using non-backtracking patterns.",
    conceptsCovered: [
      "ReDoS prevention",
      "Input length boundary enforcement",
      "Linear non-backtracking regex patterns",
      "Event loop freeze mitigation"
    ],
    code: `export function sanitizeAndMatchToken(userInput, maxInputLength = 100) {
  // 1. INPUT LENGTH BOUND GUARD:
  // Catastrophic backtracking requires long input strings to explode exponentially.
  if (typeof userInput !== 'string' || userInput.length > maxInputLength) {
    throw new Error('Input exceeds maximum permitted length');
  }

  // 2. ReDoS-SAFE REGEX:
  // Uses atomic, non-overlapping character classes without nested quantifiers:
  const safeTokenRegex = /^[a-zA-Z0-9_-]{1,64}$/;

  if (!safeTokenRegex.test(userInput)) {
    throw new Error('Invalid token characters');
  }

  return userInput;
}`,
    breakdown: [
      { lineRange: "4-6", note: "Rejects strings longer than 100 characters before running any regex engine." },
      { lineRange: "9-11", note: "Uses simple character range {1,64} without nested groups (no (a+)+ backtracking)." }
    ],
    expectedOutput: "Evaluates input in 0.001ms with zero risk of exponential catastrophic backtracking."
  },

  {
    id: "ex-node-039",
    title: "Secure Session Cookie Factory with HttpOnly, Secure & SameSite",
    category: "Security & Hardening",
    difficulty: "Foundational",
    whatThisCodeCovers: "How to generate hardened Set-Cookie headers that protect user sessions against Cross-Site Scripting (XSS) and Cross-Site Request Forgery (CSRF).",
    conceptsCovered: [
      "HttpOnly flag (anti-XSS)",
      "Secure flag (HTTPS enforcement)",
      "SameSite=Strict/Lax (anti-CSRF)",
      "Set-Cookie header formatting"
    ],
    code: `export function buildSecureCookieHeader(name, value, maxAgeSeconds = 86400, isProduction = true) {
  const parts = [
    \`\${name}=\${encodeURIComponent(value)}\`,
    'Path=/',
    \`Max-Age=\${maxAgeSeconds}\`,
    'HttpOnly',         // Block client JS (document.cookie) from accessing token (anti-XSS)
    'SameSite=Strict'   // Block cookie from cross-site requests (anti-CSRF)
  ];

  if (isProduction) {
    parts.push('Secure'); // Only transmit over encrypted HTTPS connections
  }

  return parts.join('; ');
}

// In request handler:
// res.setHeader('Set-Cookie', buildSecureCookieHeader('session_id', userToken));`,
    breakdown: [
      { lineRange: "3-8", note: "Assembles mandatory security flags: HttpOnly, SameSite=Strict, Path=/." },
      { lineRange: "10-12", note: "Appends 'Secure' in production environments to mandate HTTPS transmission." }
    ],
    expectedOutput: "Produces Set-Cookie: session_id=...; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict; Secure."
  },

  {
    id: "ex-node-040",
    title: "Hardened Security Headers Middleware (Native Helmet)",
    category: "Security & Hardening",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to implement essential HTTP security headers natively in Node.js (CSP, HSTS, X-Content-Type-Options, X-Frame-Options) without external dependencies.",
    conceptsCovered: [
      "Content-Security-Policy (CSP)",
      "Strict-Transport-Security (HSTS)",
      "X-Content-Type-Options: nosniff",
      "X-Powered-By removal"
    ],
    code: `export function securityHeadersMiddleware(req, res, next) {
  // 1. Remove leak of server technology stack
  res.removeHeader('X-Powered-By');

  // 2. Enforce HTTPS for 1 year including subdomains
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  // 3. Prevent MIME-type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // 4. Prevent clickjacking inside iframes
  res.setHeader('X-Frame-Options', 'DENY');

  // 5. Restrict referrer information
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 6. Content Security Policy
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; object-src 'none';");

  if (next) next();
}`,
    breakdown: [
      { lineRange: "3", note: "Deletes X-Powered-By header to obscure Express/Node runtime fingerprint." },
      { lineRange: "6-18", note: "Applies HSTS, nosniff, X-Frame-Options, and default-src 'self' CSP." }
    ],
    expectedOutput: "Earns A+ rating on Mozilla Observatory and security scanner benchmarks."
  }
];
