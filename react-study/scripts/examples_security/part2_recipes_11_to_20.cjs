// scripts/examples_security/part2_recipes_11_to_20.cjs
module.exports = [
  {
    id: "sec-ex-11",
    title: "WebAuthn Passkey Registration & Assertion Verification",
    category: "Authentication & Identity",
    difficulty: "advanced",
    whatThisCodeCovers: "Verifying FIDO2/WebAuthn public key registration and authentication responses using @simplewebauthn/server.",
    conceptsCovered: ["WebAuthn", "Passkeys", "FIDO2", "Origin Validation", "Phishing Resistance"],
    code: `// lib/auth/webauthn.ts
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';

const RP_NAME = 'Acme Enterprise';
const RP_ID = 'enterprise.com'; // Relying Party Domain
const EXPECTED_ORIGIN = 'https://enterprise.com';

// 1. Generate Registration Options for new Passkey
export async function getPasskeyRegistrationOptions(user: { id: string; email: string }) {
  return await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userID: Buffer.from(user.id),
    userName: user.email,
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'required',
      userVerification: 'preferred'
    }
  });
}

// 2. Verify Registration Response from Authenticator
export async function verifyPasskeyRegistration(
  body: any,
  expectedChallenge: string
) {
  const verification = await verifyRegistrationResponse({
    response: body,
    expectedChallenge,
    expectedOrigin: EXPECTED_ORIGIN,
    expectedRPID: RP_ID
  });

  if (verification.verified && verification.registrationInfo) {
    const { credentialID, credentialPublicKey, counter } = verification.registrationInfo;
    return {
      verified: true,
      credentialId: Buffer.from(credentialID).toString('base64url'),
      publicKey: Buffer.from(credentialPublicKey).toString('base64url'),
      counter
    };
  }
  return { verified: false };
}`,
    breakdown: [
      "Generates cryptographic challenge and enforces expectedRPID and expectedOrigin.",
      "Verifies hardware signature over clientDataJSON, guaranteeing origin integrity.",
      "Extracts credentialPublicKey and signature counter to store in user database."
    ],
    expectedOutput: "Validates WebAuthn authenticator response and outputs verified passkey credentials."
  },
  {
    id: "sec-ex-12",
    title: "Number Matching MFA Push Challenge Verification Service",
    category: "Authentication & Identity",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implementing Number Matching to neutralize MFA fatigue and push notification bombing attacks.",
    conceptsCovered: ["Number Matching", "MFA Fatigue", "Push Bombing Defense", "Redis TTL Verification"],
    code: `// services/mfaNumberMatching.ts
import { Redis } from 'ioredis';
import crypto from 'crypto';

const redis = new Redis();

export async function createNumberMatchingChallenge(userId: string) {
  // Generate random 2-digit number (10 to 99)
  const challengeNumber = crypto.randomInt(10, 100);
  const challengeId = crypto.randomUUID();

  // Store in Redis with strict 60-second expiration
  await redis.setex(
    \`mfa:challenge:\${challengeId}\`,
    60,
    JSON.stringify({ userId, expectedNumber: challengeNumber, attempts: 0 })
  );

  return { challengeId, displayOnWebScreen: challengeNumber };
}

export async function verifyNumberMatchingAttempt(challengeId: string, enteredNumber: number) {
  const key = \`mfa:challenge:\${challengeId}\`;
  const raw = await redis.get(key);

  if (!raw) {
    throw new Error('MFA challenge expired or invalid');
  }

  const session = JSON.parse(raw);

  // Rate limit: Max 3 attempts per challenge
  if (session.attempts >= 3) {
    await redis.del(key);
    throw new Error('Too many failed attempts. Challenge revoked.');
  }

  if (session.expectedNumber !== enteredNumber) {
    session.attempts += 1;
    await redis.setex(key, 60, JSON.stringify(session));
    return { verified: false, remainingAttempts: 3 - session.attempts };
  }

  // Success: Purge challenge key
  await redis.del(key);
  return { verified: true, userId: session.userId };
}`,
    breakdown: [
      "Generates random 2-digit number shown on the login screen.",
      "Requires user to manually enter the exact matching number in mobile authenticator.",
      "Prevents blind approval taps and locks out after 3 failed attempts."
    ],
    expectedOutput: "Validates matching number; rejects wrong numbers or expired prompts."
  },
  {
    id: "sec-ex-13",
    title: "Insecure Direct Object Reference (IDOR / BOLA) Scoped Data Access Layer",
    category: "Authorization & Access Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "A data access layer that enforces row ownership and tenant scoping on all queries to eliminate IDOR / BOLA flaws.",
    conceptsCovered: ["IDOR Defense", "BOLA", "Tenant Scoping", "404 Not Found vs 403", "Postgres Query Scoping"],
    code: `// repository/invoiceRepository.ts
import { Pool } from 'pg';

const pool = new Pool();

export interface SessionContext {
  userId: string;
  tenantId: string;
  role: string;
}

export class InvoiceRepository {
  async getInvoiceById(invoiceId: string, ctx: SessionContext) {
    // CRITICAL: Bind query strictly to verified tenantId and ownership!
    const query = \`
      SELECT id, amount, status, created_at
      FROM invoices
      WHERE id = $1
        AND tenant_id = $2
    \`;

    const result = await pool.query(query, [invoiceId, ctx.tenantId]);

    // Return 404 rather than 403 to prevent object ID enumeration attacks
    if (result.rows.length === 0) {
      const error = new Error('Invoice not found');
      (error as any).status = 404;
      throw error;
    }

    return result.rows[0];
  }

  async updateInvoiceStatus(invoiceId: string, status: string, ctx: SessionContext) {
    const query = \`
      UPDATE invoices
      SET status = $1, updated_at = NOW()
      WHERE id = $2
        AND tenant_id = $3
      RETURNING id, status
    \`;

    const result = await pool.query(query, [status, invoiceId, ctx.tenantId]);

    if (result.rowCount === 0) {
      throw new Error('Invoice not found or permission denied');
    }
    return result.rows[0];
  }
}`,
    breakdown: [
      "Always appends 'AND tenant_id = $2' to prevent accessing another organization's records.",
      "Throws 404 Not Found instead of 403 Forbidden to stop attackers probing ID existence.",
      "Eliminates reliance on client-supplied parameters for ownership checks."
    ],
    expectedOutput: "Returns invoice record only if belonging to active tenant; throws 404 otherwise."
  },
  {
    id: "sec-ex-14",
    title: "Multi-Tenant Row-Level Security (RLS) Session Wrapper in PostgreSQL",
    category: "Authorization & Access Control",
    difficulty: "advanced",
    whatThisCodeCovers: "Wrapping PostgreSQL database transactions with SET LOCAL app.current_tenant_id to activate database-level Row-Level Security.",
    conceptsCovered: ["PostgreSQL RLS", "SET LOCAL", "Multi-Tenancy", "Connection Pooling", "Defense-in-Depth"],
    code: `// lib/db/rlsClient.ts
import { Pool, PoolClient } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function withTenantContext<T>(
  tenantId: string,
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Set local session variable scoped strictly to this transaction
    // SET LOCAL automatically resets upon COMMIT or ROLLBACK!
    await client.query(
      'SELECT set_config($1, $2, true)',
      ['app.current_tenant_id', tenantId]
    );

    // 2. Execute business operations; Postgres engine enforces RLS policy automatically!
    const result = await callback(client);

    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    // Release client back to pool clean
    client.release();
  }
}

// Database Migration Setup (run once in SQL):
/*
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents FORCE ROW LEVEL SECURITY;

CREATE POLICY tenant_isolation_policy ON documents
  FOR ALL
  USING (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.current_tenant_id', true), '')::uuid);
*/`,
    breakdown: [
      "set_config('app.current_tenant_id', tenantId, true) scopes setting strictly to current transaction.",
      "PostgreSQL RLS engine enforces policy inside the DB engine, preventing developer query omissions.",
      "FORCE ROW LEVEL SECURITY guarantees policies apply even to table owners and migration roles."
    ],
    expectedOutput: "Executes queries inside transaction; PostgreSQL filters rows strictly by active tenant."
  },
  {
    id: "sec-ex-15",
    title: "Open Policy Agent (OPA) Microservice Policy Enforcement Point (PEP)",
    category: "Authorization & Access Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "An Express.js middleware querying an Open Policy Agent (OPA) sidecar engine to evaluate centralized Rego authorization policies.",
    conceptsCovered: ["OPA", "PEP", "Policy-as-Code", "Sidecar Pattern", "Rego Evaluation"],
    code: `// middleware/opaPep.ts
import { Request, Response, NextFunction } from 'express';

const OPA_URL = process.env.OPA_URL || 'http://127.0.0.1:8181/v1/data/httpapi/authz';

export function opaPolicyEnforcementPoint() {
  return async (req: Request, res: Response, next: NextFunction) => {
    // 1. Build structured JSON input for OPA evaluation
    const opaInput = {
      input: {
        user: (req as any).user || { role: 'anonymous' },
        method: req.method,
        path: req.path.split('/').filter(Boolean),
        ip: req.ip,
        timestamp: Math.floor(Date.now() / 1000)
      }
    };

    try {
      // 2. Query OPA Sidecar via low-latency HTTP
      const response = await fetch(OPA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opaInput),
        signal: AbortSignal.timeout(50) // 50ms strict latency budget!
      });

      if (!response.ok) {
        return res.status(500).json({ error: 'Authorization policy engine unavailable' });
      }

      const { result } = await response.json();

      // 3. Enforce decision: Default Deny
      if (result && result.allow === true) {
        return next();
      }

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied by centralized security policy'
      });
    } catch (err: any) {
      console.error('[OPA Error]:', err.message);
      return res.status(500).json({ error: 'Authorization evaluation error' });
    }
  };
}`,
    breakdown: [
      "Extracts request context and converts it into standard OPA JSON input schema.",
      "Queries local OPA sidecar on 127.0.0.1 with a strict 50ms timeout budget.",
      "Enforces default-deny: blocks requests unless OPA explicitly evaluates allow = true."
    ],
    expectedOutput: "Allows authorized calls; returns HTTP 403 on policy rejection."
  },
  {
    id: "sec-ex-16",
    title: "Atomic Financial Balance Transfer with Pessimistic Locking (TOCTOU Defense)",
    category: "Authorization & Access Control",
    difficulty: "advanced",
    whatThisCodeCovers: "Eliminating Time-of-Check to Time-of-Use (TOCTOU) race conditions in account debiting using SQL SELECT FOR UPDATE and atomic constraints.",
    conceptsCovered: ["TOCTOU", "Race Conditions", "Pessimistic Locking", "SELECT FOR UPDATE", "Atomic Updates"],
    code: `// services/transferService.ts
import { Pool } from 'pg';

const pool = new Pool();

export async function executeAtomicTransfer(
  fromAccountId: string,
  toAccountId: string,
  amountCents: number
) {
  if (amountCents <= 0) throw new Error('Invalid transfer amount');

  const client = await pool.connect();

  try {
    await client.query('BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED');

    // 1. Pessimistic Row Lock: Sort account IDs to prevent deadlocks!
    const [firstId, secondId] = [fromAccountId, toAccountId].sort();

    await client.query(
      'SELECT id, balance_cents FROM accounts WHERE id IN ($1, $2) FOR UPDATE',
      [firstId, secondId]
    );

    // 2. Atomic Deduct with WHERE constraint: Prevents negative balances under concurrency
    const deductRes = await client.query(
      \`UPDATE accounts
       SET balance_cents = balance_cents - $1, updated_at = NOW()
       WHERE id = $2 AND balance_cents >= $1
       RETURNING balance_cents\`,
      [amountCents, fromAccountId]
    );

    if (deductRes.rowCount === 0) {
      throw new Error('Insufficient funds at execution time (TOCTOU blocked)');
    }

    // 3. Credit destination account
    await client.query(
      \`UPDATE accounts
       SET balance_cents = balance_cents + $1, updated_at = NOW()
       WHERE id = $2\`,
      [amountCents, toAccountId]
    );

    await client.query('COMMIT');
    return { success: true, newBalanceCents: deductRes.rows[0].balance_cents };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}`,
    breakdown: [
      "Sorts account IDs before locking to eliminate distributed deadlock cycles.",
      "SELECT FOR UPDATE locks database rows exclusively until transaction commits.",
      "Atomic 'WHERE balance_cents >= $1' ensures double-spending is physically impossible."
    ],
    expectedOutput: "Executes transfer safely; rejects concurrent race attacks with insufficient funds error."
  },
  {
    id: "sec-ex-17",
    title: "Parameterized SQL Prepared Statement Wrapper for pg Pool",
    category: "OWASP Top 10 & Web Defense",
    difficulty: "beginner",
    whatThisCodeCovers: "A type-safe database wrapper that enforces prepared statements with parameterized inputs, disallowing raw string queries.",
    conceptsCovered: ["SQL Injection", "Prepared Statements", "pg Pool", "Type Safety"],
    code: `// lib/db/safeQuery.ts
import { Pool, QueryResult, QueryResultRow } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20
});

// Type-safe query wrapper enforcing prepared statement parameters
export async function query<T extends QueryResultRow = any>(
  sqlTemplate: string,
  params: (string | number | boolean | Date | null | Buffer)[] = []
): Promise<QueryResult<T>> {
  // Defensive validation: Ensure developers didn't accidentally pass undefined
  for (let i = 0; i < params.length; i++) {
    if (params[i] === undefined) {
      throw new Error(\`Query parameter at index \${i} is undefined. Use null for SQL NULL.\`);
    }
  }

  // Next-level defense: Reject queries containing semicolon chains outside literals
  if (sqlTemplate.includes(';') && !sqlTemplate.trim().endsWith(';')) {
    throw new Error('Multiple statement execution is forbidden');
  }

  return await pool.query<T>(sqlTemplate, params);
}`,
    breakdown: [
      "Enforces parameterized query calls with typed parameter arrays ($1, $2).",
      "Rejects undefined parameters which often mask logic bugs in query construction.",
      "Blocks multi-statement SQL injection attempts by disallowing mid-string semicolons."
    ],
    expectedOutput: "Executes parameterized prepared statements safely with zero SQL injection risk."
  },
  {
    id: "sec-ex-18",
    title: "Context-Aware HTML Sanitizer with DOMPurify for Rich Text",
    category: "OWASP Top 10 & Web Defense",
    difficulty: "beginner",
    whatThisCodeCovers: "Sanitizing untrusted HTML user input with DOMPurify on Node.js and the browser, stripping XSS vectors and preventing DOM clobbering.",
    conceptsCovered: ["XSS Defense", "DOMPurify", "DOM Clobbering", "HTML Sanitization"],
    code: `// lib/security/sanitizeHtml.ts
import DOMPurify from 'isomorphic-dompurify';

export function sanitizeRichText(untrustedHtml: string): string {
  if (!untrustedHtml) return '';

  return DOMPurify.sanitize(untrustedHtml, {
    // 1. Explicit tag whitelist: Allow formatting, block script/iframe/object
    ALLOWED_TAGS: [
      'b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li',
      'h1', 'h2', 'h3', 'blockquote', 'code', 'pre'
    ],
    // 2. Explicit attribute whitelist
    ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
    // 3. Enforce safe link protocols (blocks javascript:alert(1))
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
    // 4. Force safe external link attributes
    ADD_ATTR: ['rel'],
    // 5. Defend against DOM Clobbering attacks!
    SANITIZE_DOM: true,
    WHOLE_DOCUMENT: false
  });
}`,
    breakdown: [
      "Strips script tags, event handlers (onload, onerror), and dangerous elements.",
      "Blocks javascript: and data: pseudo-protocols in href attributes.",
      "SANITIZE_DOM: true strips clobbering id and name attributes that could hijack global variables."
    ],
    expectedOutput: "Converts '<p>Safe <script>alert(1)</script></p>' to '<p>Safe </p>' cleanly."
  },
  {
    id: "sec-ex-19",
    title: "Dynamic Content Security Policy (CSP) & Nonce Middleware",
    category: "OWASP Top 10 & Web Defense",
    difficulty: "intermediate",
    whatThisCodeCovers: "Generating unique 16-byte cryptographically secure random nonces per HTTP request and building a strict CSP Level 3 header.",
    conceptsCovered: ["CSP Level 3", "Cryptographic Nonce", "strict-dynamic", "XSS Defense"],
    code: `// middleware/cspNonce.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export function cspNonceMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Generate unpredictable 16-byte random base64 nonce
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.nonce = nonce;

  // 2. Strict CSP Level 3 policy
  const cspDirectives = [
    "default-src 'self'",
    \`script-src 'self' 'nonce-\${nonce}' 'strict-dynamic' https: 'unsafe-inline'\`,
    \`style-src 'self' 'nonce-\${nonce}'\`,
    "img-src 'self' data: https:",
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ];

  res.setHeader('Content-Security-Policy', cspDirectives.join('; '));
  next();
}`,
    breakdown: [
      "Generates fresh 16-byte base64 nonce on every single incoming HTTP request.",
      "Sets 'strict-dynamic' to allow trusted scripts to load dynamic modules.",
      "Sets 'object-src none' and 'base-uri none' to plug common CSP bypass holes."
    ],
    expectedOutput: "Injects Content-Security-Policy header with unique per-request nonce."
  },
  {
    id: "sec-ex-20",
    title: "Double Submit Cookie Anti-CSRF Protection Middleware",
    category: "OWASP Top 10 & Web Defense",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implementing Double Submit Cookie anti-CSRF pattern with cryptographic HMAC token generation and constant-time verification.",
    conceptsCovered: ["CSRF", "Double Submit Cookie", "SameSite Cookie", "HMAC Validation", "Origin Check"],
    code: `// middleware/csrfProtection.ts
import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

const CSRF_SECRET = process.env.CSRF_SECRET || 'super-secret-key-32-bytes-minimum';
const COOKIE_NAME = '__Host-csrf-token';

export function issueCsrfToken(res: Response): string {
  const token = crypto.randomBytes(32).toString('hex');
  const hmac = crypto.createHmac('sha256', CSRF_SECRET).update(token).digest('hex');
  const signedValue = \`\${token}.\${hmac}\`;

  res.cookie(COOKIE_NAME, signedValue, {
    httpOnly: false, // Must be readable by client JS to send in header!
    secure: true,
    sameSite: 'lax',
    path: '/'
  });

  return signedValue;
}

export function verifyCsrf(req: Request, res: Response, next: NextFunction) {
  // Skip safe read-only HTTP methods
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const cookieToken = req.cookies[COOKIE_NAME];
  const headerToken = req.headers['x-csrf-token'] as string;

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return res.status(403).json({ error: 'CSRF token mismatch' });
  }

  // Verify HMAC signature of token
  const [token, hmac] = cookieToken.split('.');
  const expectedHmac = crypto.createHmac('sha256', CSRF_SECRET).update(token).digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac))) {
    return res.status(403).json({ error: 'Tampered CSRF token signature' });
  }

  next();
}`,
    breakdown: [
      "Issues signed token stored in cookie and mirrored by frontend in X-CSRF-Token header.",
      "Verifies cookie and header values match, defeating cross-site request forgeries.",
      "Validates HMAC signature on token to prevent client-side token spoofing."
    ],
    expectedOutput: "Blocks state mutations lacking matching CSRF header/cookie with HTTP 403."
  }
];
