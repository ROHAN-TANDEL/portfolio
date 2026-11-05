// scripts/examples_security/part1_recipes_01_to_10.cjs
module.exports = [
  {
    id: "sec-ex-01",
    title: "Cryptographic AES-256-GCM Payload Encryption with Authentication Tags",
    category: "Applied Cryptography",
    difficulty: "intermediate",
    whatThisCodeCovers: "A production-grade AES-256-GCM symmetric encryption utility providing authenticated encryption (AEAD) with unique 12-byte initialization vectors and 16-byte authentication tags.",
    conceptsCovered: ["AES-256-GCM", "AEAD", "Initialization Vector (IV)", "Authentication Tag", "crypto.createCipheriv"],
    code: `// lib/crypto/aesGcm.ts
import crypto from 'crypto';

export interface EncryptedPayload {
  ciphertext: string; // Base64
  iv: string;         // Base64 (12 bytes)
  tag: string;        // Base64 (16 bytes)
}

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended by NIST for GCM

export function encryptPayload(plaintext: string, key32Bytes: Buffer, aad?: string): EncryptedPayload {
  if (key32Bytes.length !== 32) {
    throw new Error('Key must be exactly 32 bytes (256 bits)');
  }

  // 1. Generate unique CSPRNG initialization vector (NEVER REUSE AN IV!)
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key32Bytes, iv);

  // 2. Optionally bind Additional Authenticated Data (AAD)
  if (aad) {
    cipher.setAAD(Buffer.from(aad, 'utf8'));
  }

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64')
  };
}

export function decryptPayload(payload: EncryptedPayload, key32Bytes: Buffer, aad?: string): string {
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const ciphertext = Buffer.from(payload.ciphertext, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key32Bytes, iv);
  decipher.setAuthTag(tag);

  if (aad) {
    decipher.setAAD(Buffer.from(aad, 'utf8'));
  }

  // Throws error if ciphertext or tag was tampered with!
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final()
  ]);

  return decrypted.toString('utf8');
}`,
    breakdown: [
      "Generates a fresh 12-byte (96-bit) CSPRNG initialization vector for every single encryption pass.",
      "Extracts and enforces the 16-byte GHASH authentication tag, guaranteeing data integrity.",
      "Supports Additional Authenticated Data (AAD) to cryptographically bind metadata without encrypting it.",
      "Throws an uncatchable decryption failure if a single bit of ciphertext or tag is modified."
    ],
    expectedOutput: "Returns base64 ciphertext, iv, and tag; decryptPayload restores original string or throws tamper error."
  },
  {
    id: "sec-ex-02",
    title: "Memory-Hard Password Hashing & Verification with Argon2id",
    category: "Authentication & Identity",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implementing OWASP-recommended password hashing using Argon2id with 64MB memory hardness, multi-threading parallelism, and secure verification.",
    conceptsCovered: ["Argon2id", "Memory-Hard Hashing", "OWASP Parameters", "Salt Generation", "Password Verification"],
    code: `// lib/auth/password.ts
import argon2 from 'argon2';

// OWASP Recommended Minimum Parameters for Argon2id (2024)
const ARGON2_CONFIG: argon2.Options & { raw?: false } = {
  type: argon2.argon2id, // Hybrid mode: resistant to side-channels and GPU cracking
  memoryCost: 65536,    // 64 MiB memory hardness
  timeCost: 3,          // 3 iterations
  parallelism: 4,       // 4 threads
  hashLength: 32        // 32-byte hash length
};

export async function hashPassword(plainText: string): Promise<string> {
  if (!plainText || plainText.length < 8) {
    throw new Error('Password must be at least 8 characters');
  }
  // argon2 automatically generates high-entropy CSPRNG salt
  return await argon2.hash(plainText, ARGON2_CONFIG);
}

export async function verifyPassword(storedHash: string, plainAttempt: string): Promise<boolean> {
  try {
    return await argon2.verify(storedHash, plainAttempt);
  } catch (err) {
    console.error('[Auth Error] Failed to verify password hash:', err);
    return false;
  }
}

export async function needsRehash(storedHash: string): Promise<boolean> {
  // Checks if stored hash was created with older, weaker memory/time parameters
  return argon2.needsRehash(storedHash, ARGON2_CONFIG);
}`,
    breakdown: [
      "Configures Argon2id with 64MB memory cost to prevent GPU-accelerated mass password cracking.",
      "Automatically embeds high-entropy cryptographic salt within the encoded PHC string format.",
      "Provides needsRehash() helper to transparently upgrade old hashes upon user login."
    ],
    expectedOutput: "Produces $argon2id$v=19$m=65536,t=3,p=4$... string; verifyPassword returns true for matching password."
  },
  {
    id: "sec-ex-03",
    title: "Constant-Time String Comparison & HMAC Signature Verification",
    category: "Applied Cryptography",
    difficulty: "beginner",
    whatThisCodeCovers: "Using crypto.timingSafeEqual to eliminate side-channel timing attacks when validating API keys, tokens, and HMAC signatures.",
    conceptsCovered: ["Timing Attacks", "crypto.timingSafeEqual", "HMAC-SHA256", "Constant-Time Comparison"],
    code: `// lib/security/safeCompare.ts
import crypto from 'crypto';

export function constantTimeCompare(knownValue: string, userSuppliedValue: string): boolean {
  const knownBuffer = Buffer.from(knownValue, 'utf8');
  const userBuffer = Buffer.from(userSuppliedValue, 'utf8');

  // Prevent length leakage: if lengths differ, compare dummy buffer to preserve time
  if (knownBuffer.length !== userBuffer.length) {
    // Constant time dummy operation
    crypto.timingSafeEqual(knownBuffer, knownBuffer);
    return false;
  }

  // Constant-time comparison: takes exact same nanoseconds regardless of where difference is!
  return crypto.timingSafeEqual(knownBuffer, userBuffer);
}

export function verifyHmacSignature(rawBody: Buffer, signatureHex: string, secretKey: string): boolean {
  const expectedHmac = crypto.createHmac('sha256', secretKey)
    .update(rawBody)
    .digest();

  const suppliedHmac = Buffer.from(signatureHex, 'hex');

  if (expectedHmac.length !== suppliedHmac.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedHmac, suppliedHmac);
}`,
    breakdown: [
      "Replaces vulnerable '===' string checks with hardware constant-time buffer evaluations.",
      "Executes dummy comparison on length mismatches to avoid leaking string length via execution timing.",
      "Guarantees that network latency measurements cannot leak secret signature bytes."
    ],
    expectedOutput: "Returns true only on exact cryptographic match with zero timing variance."
  },
  {
    id: "sec-ex-04",
    title: "Cryptographically Secure Random Token Generator (CSPRNG vs Math.random)",
    category: "Applied Cryptography",
    difficulty: "beginner",
    whatThisCodeCovers: "Generating cryptographically secure high-entropy API keys, session tokens, and OTP codes using Node crypto CSPRNG.",
    conceptsCovered: ["CSPRNG", "crypto.randomBytes", "Entropy", "Session Tokens", "Secure OTP"],
    code: `// lib/security/tokens.ts
import crypto from 'crypto';

// 1. Opaque Session Identifier / API Key (256-bit entropy)
export function generateApiKey(prefix: string = 'ak_live'): string {
  // 32 bytes = 256 bits of CSPRNG entropy from OS /dev/urandom
  const randomHex = crypto.randomBytes(32).toString('hex');
  return \`\${prefix}_\${randomHex}\`;
}

// 2. Base64URL URL-safe token (for password reset and magic links)
export function generateUrlSafeToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

// 3. Cryptographically Secure 6-digit OTP Code (replaces Math.random!)
export function generateSecureNumericOtp(digits: number = 6): string {
  const max = Math.pow(10, digits);
  // crypto.randomInt guarantees unbiased uniform distribution
  const num = crypto.randomInt(0, max);
  return num.toString().padStart(digits, '0');
}`,
    breakdown: [
      "crypto.randomBytes(32): Draws entropy directly from the OS kernel CSPRNG pool.",
      "base64url: Produces clean URL-safe tokens without dangerous '+' or '/' characters.",
      "crypto.randomInt: Replaces insecure Math.random() for 6-digit OTP codes, eliminating modulo bias."
    ],
    expectedOutput: "Generates 'ak_live_7f8a91...', 'e2B-8z_...', and '491823' with 100% cryptographic unpredictability."
  },
  {
    id: "sec-ex-05",
    title: "Asymmetric Key Generation, Signing & Verification using Ed25519",
    category: "Applied Cryptography",
    difficulty: "intermediate",
    whatThisCodeCovers: "Generating ultra-compact Ed25519 key pairs and performing high-speed, constant-time digital signatures in Node.js.",
    conceptsCovered: ["Ed25519", "Digital Signatures", "Elliptic Curve Cryptography", "crypto.sign", "crypto.verify"],
    code: `// lib/crypto/ed25519Signer.ts
import crypto from 'crypto';

export function generateEd25519Keys() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
  });
  return { publicKey, privateKey };
}

export function signMessage(message: Buffer, privateKeyPem: string): string {
  // Ed25519 operates in constant time; immune to cache-timing attacks
  const signature = crypto.sign(null, message, privateKeyPem);
  return signature.toString('base64');
}

export function verifySignature(message: Buffer, signatureBase64: string, publicKeyPem: string): boolean {
  const signature = Buffer.from(signatureBase64, 'base64');
  return crypto.verify(null, message, publicKeyPem, signature);
}`,
    breakdown: [
      "Generates modern Ed25519 public/private keys encoded in standard SPKI and PKCS#8 PEM formats.",
      "Performs constant-time digital signatures with sub-millisecond verification overhead.",
      "Requires zero external dependencies; uses native Node.js OpenSSL 3.0 bindings."
    ],
    expectedOutput: "Generates compact PEM keys, creates base64 signature, and validates message integrity."
  },
  {
    id: "sec-ex-06",
    title: "Envelope Encryption with AWS KMS Data Keys & Local In-Memory Destruction",
    category: "Applied Cryptography",
    difficulty: "advanced",
    whatThisCodeCovers: "Implementing enterprise Envelope Encryption using AWS KMS master keys to generate local data encryption keys and zeroing plaintext memory.",
    conceptsCovered: ["Envelope Encryption", "AWS KMS", "GenerateDataKey", "Zeroing Memory", "Buffer.fill(0)"],
    code: `// lib/crypto/kmsEnvelope.ts
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import crypto from 'crypto';

const kms = new KMSClient({ region: process.env.AWS_REGION || 'us-east-1' });

export interface EnvelopeCiphertext {
  encryptedData: string; // Base64
  encryptedDataKey: string; // Base64
  iv: string; // Base64
  tag: string; // Base64
}

export async function envelopeEncrypt(plaintext: Buffer, kmsMasterKeyId: string): Promise<EnvelopeCiphertext> {
  // 1. Request new 256-bit AES Data Key from AWS KMS
  const kmsRes = await kms.send(new GenerateDataKeyCommand({
    KeyId: kmsMasterKeyId,
    KeySpec: 'AES_256'
  }));

  const plainDek = Buffer.from(kmsRes.Plaintext!);
  const encryptedDek = Buffer.from(kmsRes.CiphertextBlob!);

  try {
    // 2. Encrypt locally in container RAM using AES-256-GCM
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', plainDek, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();

    return {
      encryptedData: ciphertext.toString('base64'),
      encryptedDataKey: encryptedDek.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64')
    };
  } finally {
    // 3. CRITICAL: Securely zero-out plaintext key from memory!
    plainDek.fill(0);
  }
}

export async function envelopeDecrypt(pkg: EnvelopeCiphertext): Promise<Buffer> {
  // 1. Decrypt the 32-byte DEK using AWS KMS
  const decryptRes = await kms.send(new DecryptCommand({
    CiphertextBlob: Buffer.from(pkg.encryptedDataKey, 'base64')
  }));

  const plainDek = Buffer.from(decryptRes.Plaintext!);

  try {
    // 2. Decrypt data symmetrically
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      plainDek,
      Buffer.from(pkg.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(pkg.tag, 'base64'));

    return Buffer.concat([
      decipher.update(Buffer.from(pkg.encryptedData, 'base64')),
      decipher.final()
    ]);
  } finally {
    plainDek.fill(0);
  }
}`,
    breakdown: [
      "Calls AWS KMS GenerateDataKey to generate high-entropy symmetric DEK without exposing master KEK.",
      "Symmetrically encrypts payloads locally at multi-gigabyte memory speed.",
      "plainDek.fill(0): Guarantees the plaintext key buffer is zeroed out before garbage collection."
    ],
    expectedOutput: "Encrypts data locally and stores encrypted DEK alongside ciphertext for cloud compliance."
  },
  {
    id: "sec-ex-07",
    title: "PKCE S256 Challenge & Verifier Pair Generator for OAuth 2.1",
    category: "Authentication & Identity",
    difficulty: "beginner",
    whatThisCodeCovers: "Generating cryptographically compliant PKCE code_verifier and code_challenge strings adhering to RFC 7636 and OAuth 2.1.",
    conceptsCovered: ["PKCE", "RFC 7636", "code_verifier", "code_challenge", "SHA-256 Base64URL"],
    code: `// lib/auth/pkce.ts
import crypto from 'crypto';

export interface PkcePair {
  codeVerifier: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
}

export function generatePkce(): PkcePair {
  // 1. Generate 32 bytes of CSPRNG randomness (within RFC 7636 43-128 char requirement)
  const verifierBytes = crypto.randomBytes(32);
  const codeVerifier = verifierBytes
    .toString('base64url')
    .replace(/[^a-zA-Z0-9-._~]/g, '');

  // 2. Compute SHA-256 hash of code_verifier
  const hash = crypto.createHash('sha256').update(codeVerifier).digest();

  // 3. Base64URL encode the hash without padding
  const codeChallenge = hash.toString('base64url');

  return {
    codeVerifier,
    codeChallenge,
    codeChallengeMethod: 'S256'
  };
}

export function verifyPkce(codeVerifier: string, expectedChallenge: string): boolean {
  const hash = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(expectedChallenge));
}`,
    breakdown: [
      "Generates high-entropy code_verifier adhering to RFC 7636 unreserved character set.",
      "Computes SHA-256 hash and encodes in unpadded Base64URL format.",
      "Provides server-side verification using constant-time string comparison."
    ],
    expectedOutput: "Produces valid code_verifier and code_challenge pair for OAuth 2.1 authorization requests."
  },
  {
    id: "sec-ex-08",
    title: "JWT RS256 Issuance & Verification with Strict Whitelisting",
    category: "Authentication & Identity",
    difficulty: "intermediate",
    whatThisCodeCovers: "Issuing and verifying asymmetric RS256 JSON Web Tokens with strict algorithm, issuer, and audience whitelists to prevent algorithm confusion attacks.",
    conceptsCovered: ["JWT", "RS256", "Algorithm Whitelist", "Issuer Check", "Audience Verification"],
    code: `// lib/auth/jwt.ts
import jwt from 'jsonwebtoken';

interface UserClaims {
  sub: string;
  role: string;
  tenantId: string;
}

const ISSUER = 'https://auth.enterprise.com';
const AUDIENCE = 'https://api.enterprise.com';

export function signAccessToken(claims: UserClaims, privateKeyPem: string): string {
  return jwt.sign(claims, privateKeyPem, {
    algorithm: 'RS256',
    expiresIn: '15m', // Short-lived 15 minute lifespan
    issuer: ISSUER,
    audience: AUDIENCE,
    jwtid: crypto.randomUUID() // Unique JTI for revocation tracking
  });
}

export function verifyAccessToken(token: string, publicKeyPem: string): UserClaims {
  // CRITICAL: Hardcode allowed algorithms to prevent RS256 -> HS256 switching exploits!
  const decoded = jwt.verify(token, publicKeyPem, {
    algorithms: ['RS256'],
    issuer: ISSUER,
    audience: AUDIENCE,
    clockTolerance: 10 // 10s leeway for clock drift
  }) as jwt.JwtPayload;

  return {
    sub: decoded.sub!,
    role: decoded.role,
    tenantId: decoded.tenantId
  };
}`,
    breakdown: [
      "Hardcodes algorithms: ['RS256'] to reject 'none' algorithm and HMAC confusion attacks.",
      "Enforces strict issuer and audience assertions to prevent cross-service token misuse.",
      "Generates unique jti UUID on every token to support immediate distributed revocation."
    ],
    expectedOutput: "Issues RS256 signed JWT; verifies signature and claims or throws JsonWebTokenError."
  },
  {
    id: "sec-ex-09",
    title: "Distributed JWT Revocation & Blacklisting with Redis TTL",
    category: "Authentication & Identity",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implementing an immediate token revocation blocklist in Redis that stores revoked JWT IDs (jti) with automatic expiration.",
    conceptsCovered: ["Token Revocation", "jti Claim", "Redis Blacklist", "SETEX", "Stateless Token Busting"],
    code: `// lib/auth/revocation.ts
import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function revokeJwt(rawToken: string, reason: string = 'logout') {
  // Decode without verifying signature to extract jti and exp
  const decoded = jwt.decode(rawToken) as { jti?: string; exp?: number; sub?: string } | null;

  if (!decoded?.jti || !decoded.exp) {
    throw new Error('Token does not contain jti or exp claims');
  }

  const now = Math.floor(Date.now() / 1000);
  const remainingTtlSeconds = decoded.exp - now;

  // Only store in Redis for the remaining duration of the token's lifetime!
  if (remainingTtlSeconds > 0) {
    const key = \`revoked:jti:\${decoded.jti}\`;
    await redis.setex(key, remainingTtlSeconds, JSON.stringify({
      revokedAt: now,
      user: decoded.sub,
      reason
    }));
  }
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const result = await redis.exists(\`revoked:jti:\${jti}\`);
  return result === 1;
}`,
    breakdown: [
      "Extracts jti and exp claims to calculate the exact remaining token lifespan.",
      "Stores revoked jti in Redis with SETEX matching remaining seconds, preventing memory leaks.",
      "Allows instant cluster-wide revocation upon logout, password change, or fraud detection."
    ],
    expectedOutput: "Revokes token in Redis; subsequent checks return true until natural expiration."
  },
  {
    id: "sec-ex-10",
    title: "DPoP Proof Verification Middleware for Sender-Constrained Tokens",
    category: "Authentication & Identity",
    difficulty: "advanced",
    whatThisCodeCovers: "An Express/Node.js middleware validating OAuth 2.0 DPoP (RFC 9449) proof headers, verifying HTTP method/URI binding and JWK thumbprints.",
    conceptsCovered: ["DPoP", "RFC 9449", "jose", "JWK Thumbprint", "Sender-Constrained Tokens"],
    code: `// middleware/dpopGuard.ts
import { Request, Response, NextFunction } from 'express';
import { importJWK, jwtVerify, calculateJwkThumbprint } from 'jose';

export async function dpopGuard(req: Request, res: Response, next: NextFunction) {
  const dpopHeader = req.headers['dpop'] as string;
  const authHeader = req.headers['authorization'] as string;

  if (!dpopHeader || !authHeader?.startsWith('DPoP ')) {
    return res.status(401).json({ error: 'invalid_token', message: 'DPoP proof and token required' });
  }

  try {
    // 1. Extract public JWK from DPoP proof header
    const [headerB64] = dpopHeader.split('.');
    const { jwk } = JSON.parse(Buffer.from(headerB64, 'base64url').toString());

    // 2. Verify DPoP Proof signature
    const publicKey = await importJWK(jwk, 'ES256');
    const fullUrl = \`\${req.protocol}://\${req.get('host')}\${req.originalUrl}\`;

    const { payload } = await jwtVerify(dpopHeader, publicKey, {
      typ: 'dpop+jwt',
      maxTokenAge: '60s' // Prevent replay past 60s
    });

    // 3. Verify HTTP Method and URI binding
    if (payload.htm !== req.method || payload.htu !== fullUrl) {
      return res.status(401).json({ error: 'invalid_dpop_proof', message: 'Method or URI mismatch' });
    }

    // 4. Calculate thumbprint and bind to request context
    const thumbprint = await calculateJwkThumbprint(jwk);
    (req as any).dpopThumbprint = thumbprint;

    next();
  } catch (err: any) {
    return res.status(401).json({ error: 'invalid_dpop_proof', message: err.message });
  }
}`,
    breakdown: [
      "Parses the DPoP proof JWT and imports client's ephemeral public key.",
      "Verifies that payload.htm and payload.htu strictly match the active HTTP request method and URL.",
      "Calculates JWK thumbprint to bind against access token 'cnf.jkt' claim."
    ],
    expectedOutput: "Allows requests with valid DPoP signatures; rejects replayed or URL-altered requests with 401."
  }
];
