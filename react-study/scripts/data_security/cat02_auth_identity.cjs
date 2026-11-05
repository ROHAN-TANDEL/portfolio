// scripts/data_security/cat02_auth_identity.cjs
const { card } = require('../sec_builder_helper.cjs');

const cat = "Authentication & Identity Systems";

module.exports = [
  card(
    13,
    cat,
    "OAuth 2.1 & Grant Deprecations",
    "must-know",
    "intermediate",
    "What architectural changes does OAuth 2.1 introduce and why were the Implicit and Resource Owner Password Credentials (ROPC) grants removed?",
    "OAuth 2.1 consolidates best practices into a single specification: it eliminates the Implicit Grant (due to token leakage in URL fragments) and the Resource Owner Password Credentials grant (which encouraged anti-pattern password harvesting), making Authorization Code with PKCE mandatory for all clients.",
    "Under OAuth 2.0, the Implicit Grant returned access tokens directly in URL hash fragments (#access_token=...), exposing tokens in browser history, Referer headers, and XSS script leaks. The ROPC grant required applications to handle user credentials directly, bypassing MFA and federated identity providers. OAuth 2.1 mandates that: 1) Authorization Code grant MUST be used for both public and confidential clients; 2) PKCE (Proof Key for Code Exchange) is mandatory for ALL clients; 3) Exact string matching on redirect URIs is required; 4) Refresh tokens for public clients must be cryptographically rotated or bound.",
    `// OAuth 2.1 Standard Authorization Request URL Construction
const authUrl = new URL("https://auth.enterprise.com/oauth/authorize");
authUrl.searchParams.set("response_type", "code"); // ONLY 'code' allowed in 2.1!
authUrl.searchParams.set("client_id", "spa-client-123");
authUrl.searchParams.set("redirect_uri", "https://app.enterprise.com/callback"); // Exact match!
authUrl.searchParams.set("scope", "openid profile email orders.read");
authUrl.searchParams.set("code_challenge", "E9Melhoa2OwvFrGMTJGUnM5LC...code_challenge...");
authUrl.searchParams.set("code_challenge_method", "S256"); // Mandatory S256 (plain is deprecated!)
authUrl.searchParams.set("state", crypto.randomUUID()); // CSRF defense`,
    "OAuth 2.1 is essentially OAuth 2.0 with all the unsafe legacy grants deleted and all RFC 7636 (PKCE) / RFC 6819 (Threat Model) security BCPs made mandatory.",
    ["oauth2.1", "pkce", "identity", "authentication-security"]
  ),
  card(
    14,
    cat,
    "PKCE (Proof Key for Code Exchange) Mechanics",
    "must-know",
    "intermediate",
    "How does PKCE prevent Authorization Code Interception Attacks in public Single Page Applications and mobile apps?",
    "PKCE introduces a dynamically generated cryptographic secret (code_verifier) and its SHA-256 hash (code_challenge) to bind the initial authorization request to the final token exchange request, preventing attackers from exchanging intercepted codes.",
    "In public clients (SPAs, iOS/Android apps), client secrets cannot be securely stored because compiled code or JavaScript can be unpacked. In standard OAuth, an attacker who intercepts the authorization code (via custom URI scheme hijacking or rogue operating system listeners) could send the code to /oauth/token to steal access tokens. With PKCE: 1) The client generates a cryptographically random string (code_verifier); 2) The client calculates code_challenge = BASE64URL(SHA256(code_verifier)); 3) The client sends code_challenge to /authorize; 4) The auth server saves the challenge; 5) When exchanging code at /token, the client must present the plaintext code_verifier; 6) The auth server hashes the verifier; if SHA256(verifier) matches the original challenge, tokens are issued. An intercepting attacker cannot guess the original verifier.",
    `// PKCE Verifier and Challenge Generation (Web Crypto API)
async function generatePkcePair() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const codeVerifier = Array.from(array, b => b.toString(16).padStart(2, '0')).join('');

  const encoder = new TextEncoder();
  const data = encoder.encode(codeVerifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  
  // Base64URL encoding without padding
  const codeChallenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\\+/g, '-')
    .replace(/\\//g, '_')
    .replace(/=+$/, '');

  return { codeVerifier, codeChallenge };
}`,
    "Always use code_challenge_method='S256'. The 'plain' method offers zero protection if the initial TLS session or URL query string is inspected.",
    ["pkce", "oauth2", "code-challenge", "spa-security"]
  ),
  card(
    15,
    cat,
    "OpenID Connect (OIDC) vs OAuth 2.0",
    "must-know",
    "intermediate",
    "What is the fundamental architectural difference between OAuth 2.0 and OpenID Connect (OIDC)?",
    "OAuth 2.0 is an Authorization and Delegation framework (governing what a client can do via Access Tokens), whereas OpenID Connect is an Identity Layer built on top of OAuth 2.0 (governing who the user is via ID Tokens).",
    "Conflating authentication with authorization is a major anti-pattern. An OAuth Access Token is opaque to the client and represents permissions granted to a resource server. Using an Access Token to prove user identity is insecure because it does not state when, how, or to whom the user authenticated. OIDC adds: 1) The 'openid' scope; 2) The ID Token (a signed JWT conforming to JSON Web Signature containing claims like sub, iss, aud, auth_time, nonce); 3) A standardized /userinfo endpoint; 4) Standardized discovery via /.well-known/openid-configuration. The client validates the ID Token's signature and claims to establish user identity.",
    `// Decoding the Identity distinction:
// 1. OIDC ID Token: Meant for CLIENT consumption (Who is this user?)
interface OidcIdToken {
  iss: "https://auth.company.com";
  sub: "usr_998124"; // Unique persistent Subject ID
  aud: "client_web_app_id"; // MUST match client ID
  exp: 1712345678;
  nonce: "xyz-crypto-nonce"; // Mitigates replay attacks
  email: "architect@company.com";
}

// 2. OAuth 2.0 Access Token: Meant for RESOURCE SERVER consumption (What can they access?)
interface OAuthAccessToken {
  iss: "https://auth.company.com";
  aud: "https://api.company.com/billing"; // Resource Server Audience
  scope: "invoices.read payments.create";
  sub: "usr_998124";
}`,
    "Remember the analogy: An ID Token is your driver's license (identifies you to the car rental clerk). An Access Token is the key fob (grants access to drive the car).",
    ["oidc", "oauth2", "id-token", "identity-federation"]
  ),
  card(
    16,
    cat,
    "SAML 2.0 Federation & XML Signature Wrapping (XSW)",
    "advanced",
    "advanced",
    "How does SAML 2.0 federated assertion work and how do XML Signature Wrapping (XSW) attacks exploit signature verification?",
    "SAML 2.0 exchanges XML-based assertions between an Identity Provider (IdP) and a Service Provider (SP). XML Signature Wrapping (XSW) exploits discrepancies between which XML element the signature verifies and which element the application logic parses for identity.",
    "In SAML, assertions contain a <Subject><NameID>alice@corp.com</NameID></Subject> and a <Signature> element referencing the signed assertion via ID reference. In an XSW attack, the adversary intercepts a valid SAML Response, duplicates or moves the original signed assertion into an obscure non-validated wrapper (or creates an unsigned cloned assertion with <NameID>admin@corp.com</NameID>), and adjusts XML namespaces or IDs. If the XML signature library verifies the valid assertion node while the application business logic extracts user attributes from the cloned adversary node, the attacker achieves complete identity spoofing without breaking the cryptographic signature.",
    `// Defense against XML Signature Wrapping in SAML:
// 1. Enforce strict XML Schema Validation (XSD) prior to signature inspection
// 2. Resolve signed DOM nodes using exact XPath anchored to root:
//    /*[local-name()='Response']/*[local-name()='Assertion']
// 3. Ensure the signed assertion is the EXACT same object element consumed by authorization logic!
// 4. Prefer modern OIDC / JWT-based federation whenever possible over complex XML-DSig.`,
    "XML digital signatures are notoriously vulnerable to parser differentials and schema tampering. Strict schema enforcement and one-pass parsing are mandatory.",
    ["saml2", "xsw", "xml-signature", "enterprise-sso"]
  ),
  card(
    17,
    cat,
    "FIDO2 / WebAuthn & Hardware Security Keys (Passkeys)",
    "must-know",
    "intermediate",
    "How do WebAuthn and Passkeys achieve complete cryptographic resistance against credential phishing attacks?",
    "WebAuthn uses public-key cryptography where the private key is held securely inside an authenticator (YubiKey, Apple Touch ID, Windows Hello) and is cryptographically scoped to the exact origin domain, making phishing impossible.",
    "Traditional credentials (passwords, SMS OTPs, TOTP codes) can be intercepted by reverse proxies (like Evilginx) where a user enters their credentials onto a fake domain (e.g. evil-bank.com). With WebAuthn: 1) The browser requests an authentication challenge from the server; 2) The browser passes the challenge and the genuine window.location.origin (e.g. 'https://bank.com') to the authenticator chip; 3) The authenticator signs the challenge concatenated with clientDataJSON (which embeds origin); 4) The private key is bound to the domain and will refuse to sign for 'evil-bank.com'. Even if a user visits a fraudulent lookalike site, the hardware authenticator will not release a signature for the attacker's domain.",
    `// WebAuthn Client Challenge Assertion
async function authenticatePasskey(challengeFromServer: string) {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: Uint8Array.from(atob(challengeFromServer), c => c.charCodeAt(0)),
      rpId: "enterprise.com", // Relying Party Identifier
      userVerification: "preferred", // Enforces Biometric / PIN
      timeout: 60000
    }
  });
  // credential.response.clientDataJSON embeds origin validated by server!
  return credential;
}`,
    "WebAuthn is the gold standard for authentication because it is mathematically phishing-resistant: credentials cannot be typed into or signed for a rogue domain.",
    ["webauthn", "fido2", "passkeys", "phishing-resistant"]
  ),
  card(
    18,
    cat,
    "MFA Fatigue & Push Notification Bombing",
    "must-know",
    "intermediate",
    "What is an MFA Fatigue attack and what architectural controls neutralize push notification bombing?",
    "MFA Fatigue (Push Bombing) occurs when an attacker with valid primary credentials spams the victim's phone with dozens of repeated mobile push notifications at odd hours until the exhausted or confused victim approves the prompt.",
    "High-profile enterprise breaches (such as the 2022 Uber and Cisco attacks) exploited MFA fatigue. Countermeasures include: 1) Number Matching (mandated by Microsoft Entra / Okta): the login screen displays a random two-digit number that the user must manually type into the authenticator app, defeating blind one-tap approvals; 2) Rate limiting push requests: lock accounts or enforce exponential backoff after 3 unapproved push attempts; 3) Context-rich notifications: display requesting IP, approximate geographic location, and application name; 4) Eliminating push in favor of FIDO2 Passkeys or hardware security keys.",
    `// Number Matching Architecture
interface MfaPushChallenge {
  challengeId: string;
  expectedNumber: number; // e.g. 84 (Shown on web login screen)
  expiresAt: number;
}

function verifyMfaResponse(challenge: MfaPushChallenge, enteredNumberByMobileUser: number): boolean {
  if (Date.now() > challenge.expiresAt) throw new Error("MFA Prompt Expired");
  if (challenge.expectedNumber !== enteredNumberByMobileUser) {
    throw new Error("MFA Number Mismatch - Unauthorized Attempt Logged");
  }
  return true; // Phishing & blind tap impossible!
}`,
    "Never deploy simple one-tap 'Approve / Deny' mobile push prompts in enterprise environments. Always require Number Matching.",
    ["mfa-fatigue", "push-bombing", "number-matching", "account-takeover"]
  ),
  card(
    19,
    cat,
    "JWT Architectural Attacks: Algorithm Confusion & Spoofing",
    "must-know",
    "intermediate",
    "How does the JWT Algorithm Confusion (RS256 to HS256) attack work and how is it prevented in token verification libraries?",
    "In an RS256 to HS256 algorithm confusion attack, an adversary takes a system using asymmetric RS256, changes the token header alg to symmetric 'HS256', and signs the forged payload using the server's public verification key as the HMAC shared secret.",
    "Under RS256, the auth server signs tokens with a private key, and API servers verify tokens with a public key (often published via JWKS). If the verification server naively trusts the token's header: jwt.verify(token, key) without specifying allowed algorithms, the attacker crafts a forged admin token, sets 'alg': 'HS256', and computes HMAC-SHA256 using the publicly available RSA public key (PEM string) as the symmetric secret. When the server verifies the HMAC using the public key variable, the signature matches! Prevention requires: 1) Strictly whitelisting expected algorithms: algorithms: ['RS256']; 2) Explicitly rejecting the 'none' algorithm; 3) Validating issuer and audience claims.",
    `// BAD (Vulnerable to Algorithm Confusion & None Alg):
// const decoded = jwt.verify(token, serverPublicKey);

// GOOD (Production Hardened JWT Verification):
import jwt from 'jsonwebtoken';

export function verifyAccessToken(token: string, publicKeyPem: string) {
  return jwt.verify(token, publicKeyPem, {
    algorithms: ['RS256'], // HARD WHITELIST: Rejects HS256 and 'none' completely!
    issuer: 'https://auth.enterprise.com',
    audience: 'https://api.enterprise.com',
    clockTolerance: 10 // 10s leeway for clock drift
  });
}`,
    "Never let the incoming JWT header decide how the signature is checked. The verification server must enforce the expected algorithm configuration.",
    ["jwt-security", "algorithm-confusion", "rs256", "hs256"]
  ),
  card(
    20,
    cat,
    "Distributed JWT Revocation & Blacklisting with Redis",
    "must-know",
    "intermediate",
    "Since JWTs are stateless and self-contained, how do production architectures implement immediate token revocation upon logout or compromise?",
    "Immediate revocation of stateless JWTs is achieved by maintaining a distributed high-throughput Redis blocklist containing unique token identifiers (jti claim) with TTLs matching the token's remaining expiration time.",
    "Because JWTs cannot be invalidated on the client alone (deleting local storage does not stop an attacker who intercepted the token), the authorization server issues tokens with short lifespans (10-15 minutes) and a cryptographically unique jti (JWT ID). When a user logs out or reports fraud: 1) The server stores the jti in a Redis cluster: SETEX revoked:{jti} {remaining_seconds} 1; 2) Microservices check Redis (or an in-memory Redis bloom filter/LRU replica) on each request; 3) Once the token expires naturally, Redis evicts the key automatically, preventing unbounded memory growth.",
    `import { Redis } from 'ioredis';
import jwt from 'jsonwebtoken';

const redis = new Redis();

export async function revokeToken(rawJwt: string) {
  const decoded = jwt.decode(rawJwt) as { jti?: string; exp?: number };
  if (!decoded?.jti || !decoded.exp) return;

  const remainingSeconds = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
  if (remainingSeconds > 0) {
    // Store in Redis with TTL matching token expiration
    await redis.setex(\`revoked:jti:\${decoded.jti}\`, remainingSeconds, 'revoked');
  }
}

export async function isTokenRevoked(jti: string): Promise<boolean> {
  const exists = await redis.exists(\`revoked:jti:\${jti}\`);
  return exists === 1;
}`,
    "Keep access token TTLs very short (e.g. 5-15 mins). Redis blocklists only need to store revoked tokens until their exp timestamp passes.",
    ["jwt-revocation", "jti", "redis-blocklist", "stateless-auth"]
  ),
  card(
    21,
    cat,
    "Demonstrating Proof-of-Possession (DPoP - RFC 9449)",
    "advanced",
    "advanced",
    "What is OAuth 2.0 DPoP (RFC 9449) and how does it prevent bearer token theft and replay attacks?",
    "DPoP (Demonstrating Proof-of-Possession) binds access and refresh tokens to an asymmetric key pair held by the client, ensuring that an intercepted bearer token is useless to an attacker without the corresponding private key.",
    "Standard OAuth tokens are 'bearer' tokens: anyone who holds the token string can use it, meaning token theft via XSS, network sniffing, or proxy compromise grants full access. With DPoP: 1) The client generates an ephemeral public/private key pair; 2) For every API call, the client creates a signed DPoP proof JWT containing HTTP method, URL, timestamp, and unique nonce; 3) The access token is cryptographically bound to the public key (jkt claim); 4) The Resource Server verifies that the DPoP signature matches the bound public key in the token and matches the exact HTTP URI requested. An attacker stealing the token cannot generate valid DPoP proofs without the client's private key.",
    `// Resource Server DPoP Verification Logic
import { importJWK, jwtVerify } from 'jose';

export async function verifyDpopProof(dpopHeader: string, expectedMethod: string, expectedUrl: string) {
  // 1. Unpack DPoP proof JWT header to get client ephemeral public key
  const [headerB64] = dpopHeader.split('.');
  const { jwk } = JSON.parse(Buffer.from(headerB64, 'base64url').toString());

  const publicKey = await importJWK(jwk, 'ES256');
  
  // 2. Verify DPoP signature and bind to exact HTTP request
  const { payload } = await jwtVerify(dpopHeader, publicKey, {
    typ: 'dpop+jwt',
    maxTokenAge: '60s' // Prevent replay
  });

  if (payload.htm !== expectedMethod || payload.htu !== expectedUrl) {
    throw new Error("DPoP Mismatch: HTTP method or URI does not match proof signature!");
  }
  return jwk;
}`,
    "DPoP is an application-layer alternative to Mutual TLS (mTLS) token binding, working seamlessly in Single Page Applications and mobile browsers.",
    ["dpop", "rfc-9449", "token-binding", "proof-of-possession"]
  ),
  card(
    22,
    cat,
    "Session Hijacking & Secure Cookie Attributes",
    "must-know",
    "intermediate",
    "How do the HttpOnly, Secure, SameSite, and Domain cookie flags prevent session hijacking and CSRF exploits?",
    "Modern session security relies on hardened cookie flags: HttpOnly prevents JavaScript access (neutralizing XSS token theft), Secure mandates HTTPS transmission, and SameSite=Strict/Lax restricts cross-site request forwarding (mitigating CSRF).",
    "If session identifiers are stored in localStorage, any XSS vulnerability allows an attacker to execute localStorage.getItem('token') and exfiltrate it. Storing session IDs in HTTP cookies with the following attributes neutralizes these attack vectors: 1) HttpOnly: prevents document.cookie access via scripts; 2) Secure: prevents transmission over unencrypted plaintext HTTP connections; 3) SameSite=Lax/Strict: prevents the browser from attaching cookies on cross-origin requests initiated by malicious third-party sites; 4) Prefix __Host-: guarantees the cookie has Secure flag, no Domain attribute (locked to host), and path set to /.",
    `// Production Hardened Session Cookie Configuration in Express
import session from 'express-session';

app.use(session({
  name: '__Host-session', // Hardened cookie prefix
  secret: process.env.SESSION_SECRET!,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,              // Blocks XSS read access
    secure: true,                // Mandates HTTPS
    sameSite: 'lax',             // Protects against CSRF
    path: '/',                   // Required for __Host- prefix
    maxAge: 1000 * 60 * 60 * 12  // 12-hour session expiration
  }
}));`,
    "Never store sensitive authentication tokens in localStorage or sessionStorage. Use hardened __Host- cookies with HttpOnly and SameSite.",
    ["session-hijacking", "cookies", "httponly", "samesite"]
  ),
  card(
    23,
    cat,
    "Modern Password Hashing: Argon2id vs bcrypt vs PBKDF2",
    "must-know",
    "intermediate",
    "Why is Argon2id the OWASP-recommended algorithm for password hashing over legacy algorithms like MD5, SHA-256, and bcrypt?",
    "Argon2id is a memory-hard and time-hard algorithm that provides resistance against both GPU-accelerated brute forcing and side-channel timing attacks, winning the Password Hashing Competition (PHC).",
    "Fast cryptographic hashes (MD5, SHA-1, SHA-256, SHA-512) were designed for speed, allowing modern GPUs/ASICs to compute billions of hashes per second. Password storage requires slow, computationally expensive hashing. While bcrypt and PBKDF2 are CPU-bound, modern attackers use custom ASICs and GPUs with massive parallel memory bandwidth. Argon2id combines Argon2d (data-dependent memory access for maximum GPU cracking resistance) and Argon2i (data-independent memory access for side-channel attack resistance), making offline password cracking economically infeasible.",
    `import argon2 from 'argon2';

// OWASP Recommended Minimum Parameters for Argon2id
export async function hashPassword(plainPassword: string): Promise<string> {
  return await argon2.hash(plainPassword, {
    type: argon2.argon2id,
    memoryCost: 65536, // 64 MB memory requirement
    timeCost: 3,       // 3 iterations
    parallelism: 4     // 4 threads
  });
}

export async function verifyPassword(hash: string, attempt: string): Promise<boolean> {
  return await argon2.verify(hash, attempt);
}`,
    "Never use raw SHA-256 or MD5 for passwords, even with a salt. Default to Argon2id with 64MB memory cost, or bcrypt with cost factor >= 12.",
    ["password-hashing", "argon2id", "bcrypt", "owasp-recommended"]
  ),
  card(
    24,
    cat,
    "Single Sign-On (SSO) & Back-Channel Logout",
    "advanced",
    "advanced",
    "How does OIDC Back-Channel Logout (RFC 8693) securely terminate federated sessions across distributed client applications?",
    "Back-Channel Logout uses direct server-to-server HTTP POST requests containing a signed Logout Token from the OpenID Provider (OP) to Relying Parties (RPs) to revoke sessions without relying on user browser redirects.",
    "Traditional Front-Channel logout relies on client browser IFrames or HTTP redirects to notify applications that the user logged out. If a user closes the browser tab, has third-party cookies disabled, or has an ad-blocker blocking iframes, federated sessions remain active across other applications. In Back-Channel Logout: 1) The user logs out at the Identity Provider; 2) The IdP generates a signed Logout Token (JWT without nonce and with 'events': { 'http://schemas.openid.net/event/backchannel-logout': {} }); 3) The IdP's backend directly contacts each client's registered back-channel logout URL; 4) Client backends invalidate local sessions and clear Redis state immediately.",
    `// Relying Party Back-Channel Logout Endpoint
import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify, importJWK } from 'jose';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const logoutToken = formData.get('logout_token') as string;

  // 1. Verify Logout Token using IdP JWKS
  const { payload } = await jwtVerify(logoutToken, IdpPublicKey, {
    issuer: 'https://auth.enterprise.com',
    audience: process.env.OAUTH_CLIENT_ID
  });

  const targetSub = payload.sub; // User subject identifier
  const targetSid = payload.sid; // Session identifier

  // 2. Invalidate all matching server-side sessions in Redis
  await sessionStore.destroyUserSessions(targetSub, targetSid);

  return new NextResponse('OK', { status: 200 });
}`,
    "Back-Channel Logout is essential for zero-trust federated environments to guarantee that termination of a master SSO session instantly revokes all downstream apps.",
    ["sso", "back-channel-logout", "oidc", "session-revocation"]
  )
];
