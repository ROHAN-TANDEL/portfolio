const { createCard } = require("../exp_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 61,
    category: "Authentication, Authorization & Session Management",
    concept: "Stateless JWT Authentication Pipeline & Bearer Token Parsing",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you implement an idiomatic, secure JWT authentication middleware in Express?",
    quickAnswer: "An authentication middleware extracts the JWT from the `Authorization: Bearer <token>` header, verifies the cryptographic signature and expiration claims using `jsonwebtoken` (or `jose`), and attaches the decoded user payload to `req.user`. If the token is missing, expired, or invalid, it returns `401 Unauthorized` without calling `next()`.",
    detailedAnswer: "JWT Authentication Pipeline:\n1. Inspect `req.get('authorization')`.\n2. Verify the string format begins with `'Bearer '`.\n3. Verify signature using `jwt.verify(token, secret, { algorithms: ['HS256' | 'RS256'] })`.\n   - Crucial security check: explicitly specify allowed algorithms to prevent Algorithm Confusion attacks (e.g. `'none'` algorithm exploit).\n4. Attach decoded claims to `req.user` (`{ id, email, roles }`).\n5. Invoke `next()` to proceed to downstream handlers.",
    code: `const jwt = require('jsonwebtoken');

function authenticateJwt(req, res, next) {
  const authHeader = req.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Explicitly enforce algorithms to prevent 'none' algorithm bypass
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256']
    });

    // Attach authenticated identity to request context
    req.user = decoded;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

// Protected route
app.get('/api/profile', authenticateJwt, (req, res) => {
  res.json({ message: 'Secret profile data', user: req.user });
});`,
    recallHint: "Extract 'Bearer <token>', verify signature with explicit algorithms, attach decoded user to req.user, or return 401.",
    interviewTip: "Always mention enforcing `{ algorithms: ['HS256'] }` or `RS256`. Omitting allowed algorithms allows attackers to craft unsigned tokens with header `{\"alg\": \"none\"}`.",
    tags: ["jwt", "authentication", "bearer-token", "security", "middleware"]
  }),

  createCard({
    idNum: 62,
    category: "Authentication, Authorization & Session Management",
    concept: "Refresh Token Rotation & HttpOnly Cookie Architecture",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Refresh Token Rotation work with HttpOnly cookies in an Express architecture?",
    quickAnswer: "Short-lived Access Tokens (e.g. 15 minutes) are kept in memory by clients, while long-lived Refresh Tokens (e.g. 7 days) are stored in secure, `HttpOnly`, `SameSite` cookies. On the `/refresh` endpoint, the server verifies the refresh token, revokes the old refresh token in the database, generates a fresh token pair, and sets the new refresh token cookie, detecting and neutralizing replay attacks.",
    detailedAnswer: "Why Refresh Token Rotation?\nIf an attacker steals a refresh token, reuse detection stops the attack: each refresh token can only be used once. If the server receives an already-used refresh token, it assumes token theft and invalidates the entire token family for that user.\n\nCookie Protection:\nStoring the refresh token in an `HttpOnly` cookie protects it from browser XSS attacks (`document.cookie` cannot read it). `SameSite=Lax/Strict` defends against CSRF.",
    code: `app.post('/api/auth/refresh', async (req, res) => {
  const oldRefreshToken = req.cookies.refreshToken;
  if (!oldRefreshToken) return res.status(401).json({ error: 'No refresh token' });

  // 1. Verify token signature
  const decoded = jwt.verify(oldRefreshToken, process.env.REFRESH_SECRET);

  // 2. Lookup token in DB (check if already revoked or reused)
  const tokenRecord = await tokenDb.findToken(oldRefreshToken);
  if (!tokenRecord || tokenRecord.isRevoked) {
    // REUSE DETECTED: Attacker or victim reused token! Invalidate family!
    await tokenDb.revokeAllUserTokens(decoded.userId);
    res.clearCookie('refreshToken');
    return res.status(403).json({ error: 'Token reuse detected. Re-login required.' });
  }

  // 3. Invalidate used token
  await tokenDb.revoke(oldRefreshToken);

  // 4. Generate fresh pair
  const newAccessToken = jwt.sign({ id: decoded.userId }, process.env.ACCESS_SECRET, { expiresIn: '15m' });
  const newRefreshToken = jwt.sign({ id: decoded.userId }, process.env.REFRESH_SECRET, { expiresIn: '7d' });
  await tokenDb.save(newRefreshToken, decoded.userId);

  // 5. Send new refresh token in HttpOnly cookie
  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth'
  });

  res.json({ accessToken: newAccessToken });
});`,
    recallHint: "Store refresh tokens in HttpOnly cookies; rotate and revoke on every use to detect token reuse and stop replay attacks.",
    interviewTip: "Highlight that token family revocation on reuse detection is the gold standard for OAuth 2.0 / SPA security recommendations (RFC 6749 / BCP).",
    tags: ["refresh-token", "token-rotation", "httpOnly", "oauth2", "reuse-detection"]
  }),

  createCard({
    idNum: 63,
    category: "Authentication, Authorization & Session Management",
    concept: "Role-Based Access Control (RBAC) Middleware & Permissions Matrix",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you design a flexible Role-Based Access Control (RBAC) middleware factory in Express?",
    quickAnswer: "An RBAC middleware factory takes an array of permitted roles or permission strings (e.g. `authorize('admin', 'manager')`) and returns a standard Express middleware. The middleware inspects `req.user.roles` or `req.user.permissions`; if the user lacks the required permission, it halts the chain with `403 Forbidden`.",
    detailedAnswer: "Difference between 401 and 403:\n- `401 Unauthorized`: Unauthenticated (the user is not logged in or token is invalid).\n- `403 Forbidden`: Authenticated, but lacking sufficient privileges/roles for this specific endpoint.\n\nRBAC Factory Pattern:\nHigher-order functions allow configuring permitted roles declaratively per route.",
    code: `// RBAC Middleware Factory
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = req.user.roles || [];
    const hasPermission = allowedRoles.some(role => userRoles.includes(role));

    if (!hasPermission) {
      return res.status(403).json({
        error: 'Forbidden',
        message: \`Requires one of: [\${allowedRoles.join(', ')}]\`
      });
    }

    next(); // Authorized
  };
}

// Route usage
app.delete('/api/users/:id', authenticateJwt, requireRole('admin', 'superadmin'), async (req, res) => {
  await userRepository.delete(req.params.id);
  res.json({ success: true, message: 'User deleted' });
});`,
    recallHint: "401 = Not logged in; 403 = Logged in but insufficient permissions. Use higher-order middleware factory for RBAC.",
    interviewTip: "Clarify the distinction between coarse-grained roles (`admin`, `editor`) and fine-grained permissions (`users:read`, `users:delete`). Permission-based checks scale better across enterprise apps.",
    tags: ["rbac", "authorization", "requireRole", "http-403", "security"]
  }),

  createCard({
    idNum: 64,
    category: "Authentication, Authorization & Session Management",
    concept: "Attribute-Based Access Control (ABAC) and Resource Ownership Guards",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Attribute-Based Access Control (ABAC), and how do you implement resource ownership verification in Express?",
    quickAnswer: "While RBAC checks who the user is (role), ABAC verifies context and relationships: whether the user owns the specific document, tenant, or record being accessed. An ownership guard retrieves the resource and asserts `resource.ownerId === req.user.id` or verifies organization tenant matching, returning `403 Forbidden` if mismatched.",
    detailedAnswer: "In multi-tenant SaaS and user portals, a user might have the `'member'` role, but should only be allowed to update their own invoices or profiles (Insecure Direct Object Reference / IDOR vulnerability defense).\n\nABAC middleware evaluates:\n1. Subject attributes (user ID, tenant, role).\n2. Resource attributes (creator ID, document tenant ID).\n3. Action (read, write, delete).\n4. Environment (IP address, time of day).",
    code: `function requireResourceOwnership(resourceService) {
  return async (req, res, next) => {
    try {
      const resourceId = req.params.id;
      const resource = await resourceService.findById(resourceId);

      if (!resource) {
        return res.status(404).json({ error: 'Resource not found' });
      }

      // Allow superadmins or the exact creator
      const isOwner = resource.ownerId === req.user.id;
      const isAdmin = req.user.roles?.includes('admin');

      if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'You do not have permission to modify this resource' });
      }

      // Attach resource to req to prevent redundant DB query in controller
      req.resource = resource;
      next();
    } catch (err) {
      next(err);
    }
  };
}

app.put('/api/posts/:id', authenticateJwt, requireResourceOwnership(postService), (req, res) => {
  // Safe: req.resource is guaranteed to be owned by req.user
  res.json({ updated: true });
});`,
    recallHint: "ABAC checks resource attributes like ownerId === req.user.id; prevents IDOR vulnerabilities in multi-tenant APIs.",
    interviewTip: "Point out that attaching the fetched resource to `req.resource` avoids querying the database twice (once in the auth guard and once in the controller).",
    tags: ["abac", "idor", "ownership-guard", "authorization", "security"]
  }),

  createCard({
    idNum: 65,
    category: "Authentication, Authorization & Session Management",
    concept: "Stateful Session Management (express-session) and Redis Session Store",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why should you never use the default MemoryStore with `express-session` in production, and how do you configure a Redis session store?",
    quickAnswer: "`express-session` defaults to `MemoryStore`, which leaks memory over time, cannot scale horizontally across multiple Node process workers or containers, and drops all active user sessions on every server restart. In production, configure an external distributed store like `connect-redis` with Redis.",
    detailedAnswer: "MemoryStore Pitfalls:\n- Memory leak: Expired sessions are not automatically pruned from process memory.\n- No horizontal clustering: In a cluster with 4 Node workers behind a load balancer, a user authenticated on Worker 1 will be prompted to log in again if Worker 2 serves the next request.\n\nRedis Session Store:\nSessions are persisted in Redis with automatic TTL matching cookie expiration. All Express instances share the centralized Redis session state.",
    code: `const express = require('express');
const session = require('express-session');
const { createClient } = require('redis');
const RedisStore = require('connect-redis').default;

const app = express();
const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.connect().catch(console.error);

app.use(session({
  store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
  secret: process.env.SESSION_SECRET,
  resave: false, // Prevents session being saved back to store if unmodified
  saveUninitialized: false, // Complies with GDPR/privacy: only save when session modified
  name: 'app_session_id', // Obscure default 'connect.sid' cookie name
  cookie: {
    secure: process.env.NODE_ENV === 'production', // HTTPS only
    httpOnly: true, // XSS defense
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

app.post('/api/login', (req, res) => {
  req.session.userId = 'user_123';
  req.session.role = 'admin';
  res.json({ success: true });
});`,
    recallHint: "Never use MemoryStore in production: leaks memory, loses sessions on restart, breaks multi-instance clustering. Use RedisStore.",
    interviewTip: "Highlight `resave: false` (avoids race conditions overwriting concurrent changes) and `saveUninitialized: false` (does not allocate Redis sessions for unauthenticated visitors).",
    tags: ["express-session", "redis", "session-store", "clustering", "scalability"]
  }),

  createCard({
    idNum: 66,
    category: "Authentication, Authorization & Session Management",
    concept: "Cookie Signing and Session Tampering Defense",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does cookie signing with `cookie-parser` prevent client-side cookie tampering, and how does the signature format work?",
    quickAnswer: "When signing a cookie, Express calculates an HMAC-SHA256 hash of the cookie value using a server-side secret and appends it to the cookie formatted as `s:value.signature`. When the client returns the cookie, `cookie-parser` recomputes the HMAC; if the signature does not match (indicating the user modified the cookie), it rejects the value as `false`.",
    detailedAnswer: "Signing Mechanics:\n- Plain cookie: `role=admin` (User can easily edit in Chrome DevTools to elevate privileges).\n- Signed cookie: `role=s%3Aadmin.n21S...`.\n- The server verifies HMAC(`admin`, SECRET) matches the provided hash.\n- If a user changes `'user'` to `'admin'`, the cryptographic HMAC fails because the user does not know the server's private secret.\n\nSigned cookies are accessible in `req.signedCookies`. Tampered cookies appear as `false`.",
    code: `const cookieParser = require('cookie-parser');
const app = express();

app.use(cookieParser('ultra-secret-signing-key'));

app.get('/set-membership', (req, res) => {
  // Signs the cookie value with HMAC-SHA256
  res.cookie('tier', 'premium', { signed: true, httpOnly: true });
  res.send('Cookie signed');
});

app.get('/check-membership', (req, res) => {
  // req.signedCookies holds verified cookies; tampered ones become false or undefined
  const tier = req.signedCookies.tier;

  if (tier === false) {
    return res.status(400).send('Tampered cookie detected!');
  }
  if (!tier) {
    return res.status(401).send('No valid membership cookie found');
  }

  res.send(\`Welcome \${tier} member!\`);
});`,
    recallHint: "Signed cookies use HMAC-SHA256 (s:value.hash); if tampered with, req.signedCookies returns false.",
    interviewTip: "Emphasize that signing is integrity verification, NOT encryption. The client can still read the plaintext string unless it is explicitly encrypted with AES.",
    tags: ["cookie-signing", "hmac", "cookie-parser", "tamper-proof", "integrity"]
  }),

  createCard({
    idNum: 67,
    category: "Authentication, Authorization & Session Management",
    concept: "Session Hijacking Defense (Session Fixation, IP Binding, User-Agent Checks)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you protect Express sessions from Session Fixation and Session Hijacking attacks?",
    quickAnswer: "To prevent Session Fixation, always regenerate the session ID via `req.session.regenerate()` immediately upon successful login. To mitigate Session Hijacking, bind the session to client fingerprints (hashing `User-Agent` and subnet IP) and invalidate the session if the fingerprint changes during an active session.",
    detailedAnswer: "1. Session Fixation:\nAn attacker creates a session ID on the site, tricks a victim into logging in using that ID (via link or cookie injection), and then accesses the victim's account. Regenerating the session ID on login destroys the pre-auth session and creates a fresh ID.\n\n2. Session Hijacking:\nAn attacker intercepts the session cookie over network sniff or XSS. Mitigations:\n- Regenerate session ID on privilege changes.\n- Verify client fingerprint: compare current `req.get('user-agent')` with the initial login agent.\n- Enforce short idle timeouts and absolute session expirations.",
    code: `app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await authService.verifyCredentials(username, password);

  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  // PREVENT SESSION FIXATION: Regenerate session ID on privilege transition
  req.session.regenerate((err) => {
    if (err) return next(err);

    // Bind session to user and client fingerprint
    req.session.userId = user.id;
    req.session.fingerprint = crypto
      .createHash('sha256')
      .update(req.get('user-agent') || '')
      .digest('hex');

    req.session.save((saveErr) => {
      if (saveErr) return next(saveErr);
      res.json({ success: true, user: { id: user.id, username: user.username } });
    });
  });
});

// Middleware verifying session fingerprint
app.use((req, res, next) => {
  if (req.session && req.session.userId) {
    const currentFingerprint = crypto
      .createHash('sha256')
      .update(req.get('user-agent') || '')
      .digest('hex');

    if (req.session.fingerprint !== currentFingerprint) {
      // Possible hijacked session or changed client!
      req.session.destroy(() => {
        res.status(401).json({ error: 'Session anomaly detected. Please re-authenticate.' });
      });
      return;
    }
  }
  next();
});`,
    recallHint: "Always call req.session.regenerate() upon login to defeat Session Fixation; verify user-agent fingerprints to hinder hijacking.",
    interviewTip: "Be careful when binding to exact client IP addresses because mobile clients switch between WiFi and 5G cellular towers frequently, leading to false-positive session drops.",
    tags: ["session-fixation", "session-hijacking", "session.regenerate", "security", "fingerprint"]
  }),

  createCard({
    idNum: 68,
    category: "Authentication, Authorization & Session Management",
    concept: "Multi-Tenant Identification Middleware & Tenant Context Isolation",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you build a multi-tenant resolution middleware in Express that enforces strict tenant isolation?",
    quickAnswer: "A tenant resolution middleware extracts tenant identification from subdomains (`tenant.app.com`), path prefixes (`/api/v1/tenants/:tenantId`), or HTTP headers (`X-Tenant-ID`), validates tenant existence and active status in the database, and scopes database connections or schema search paths to prevent cross-tenant data leaks.",
    detailedAnswer: "Tenant Isolation Strategies:\n1. Subdomain resolution: Extract `req.subdomains[0]`.\n2. Header resolution: Read `req.get('X-Tenant-ID')` for B2B APIs.\n3. Security assertions:\n   - Verify tenant exists and is not suspended.\n   - Ensure authenticated user (`req.user`) has explicit membership in the requested tenant.\n   - Use `AsyncLocalStorage` or attach `req.tenant` to automatically set the PostgreSQL schema `search_path` or MongoDB collection prefix for the duration of the request.",
    code: `const express = require('express');
const app = express();

async function resolveTenant(req, res, next) {
  // Option A: Subdomain (e.g. acme.enterprise.com)
  const host = req.get('host') || '';
  const subdomain = host.split('.')[0];

  // Option B: Fallback to custom header for API clients
  const tenantSlug = req.get('X-Tenant-Slug') || subdomain;

  if (!tenantSlug || tenantSlug === 'www' || tenantSlug === 'api') {
    return res.status(400).json({ error: 'Tenant identifier required' });
  }

  const tenant = await tenantRepository.findBySlug(tenantSlug);
  if (!tenant || !tenant.isActive) {
    return res.status(404).json({ error: 'Tenant not found or deactivated' });
  }

  // Cross-tenant membership assertion for logged-in users
  if (req.user && !req.user.tenantIds?.includes(tenant.id)) {
    return res.status(403).json({ error: 'Access to this tenant organization denied' });
  }

  req.tenant = tenant; // Attached for repository and schema search path resolution
  next();
}

app.get('/api/analytics', authenticateJwt, resolveTenant, async (req, res) => {
  // Scoped strictly to verified tenant
  const data = await analyticsService.getDashboard(req.tenant.id);
  res.json({ tenant: req.tenant.slug, data });
});`,
    recallHint: "Extract tenant from subdomain or header, verify active status and user membership, attach req.tenant for scoped queries.",
    interviewTip: "Cross-tenant data leakage is the #1 vulnerability in multi-tenant SaaS. Enforce tenant checks at both the middleware layer and repository query level.",
    tags: ["multi-tenant", "tenant-isolation", "saas", "subdomain-routing", "security"]
  }),

  createCard({
    idNum: 69,
    category: "Authentication, Authorization & Session Management",
    concept: "API Key Authentication for Machine-to-Machine Endpoints with Timing-Safe Comparison",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you implement secure API key authentication in Express and protect against timing attacks?",
    quickAnswer: "Extract the API key from `X-API-Key` or `Authorization: Bearer <key>`. Hash the key with SHA-256 before database lookup (so raw keys are never stored in plaintext), and compare cryptographic secrets using Node's `crypto.timingSafeEqual()` to prevent timing side-channel attacks.",
    detailedAnswer: "Timing Side-Channel Attacks:\nStandard string comparison (`key === storedKey`) exits at the first non-matching character. An attacker measuring sub-millisecond response times can deduce the correct API key character by character.\n\nDefense:\n1. Hash the incoming API key: `hash = crypto.createHash('sha256').update(key).digest()`.\n2. Use `crypto.timingSafeEqual(bufferA, bufferB)` which executes in constant time regardless of where bytes differ.\n3. Store only SHA-256 hashes of API keys in databases.",
    code: `const crypto = require('crypto');

function authenticateApiKey(req, res, next) {
  const apiKey = req.get('X-API-Key');

  if (!apiKey) {
    return res.status(401).json({ error: 'API key required in X-API-Key header' });
  }

  // Hash incoming key to match hashed DB storage
  const incomingHash = crypto.createHash('sha256').update(apiKey).digest();
  const knownHash = Buffer.from(process.env.MASTER_WEBHOOK_KEY_HASH, 'hex');

  // Length mismatch check prevents timingSafeEqual crash
  if (incomingHash.length !== knownHash.length) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Constant-time comparison defeats timing attacks
  const isValid = crypto.timingSafeEqual(incomingHash, knownHash);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.authType = 'api_key';
  next();
}

app.post('/api/webhooks/incoming', authenticateApiKey, (req, res) => {
  res.json({ received: true });
});`,
    recallHint: "Hash API keys before storage/comparison; use crypto.timingSafeEqual() to defeat timing side-channel attacks.",
    interviewTip: "Never store plaintext API keys in your database. Store SHA-256 hashes just like passwords, and show users the full secret key only once upon generation.",
    tags: ["api-key", "timingSafeEqual", "m2m", "timing-attack", "security"]
  }),

  createCard({
    idNum: 70,
    category: "Authentication, Authorization & Session Management",
    concept: "Passport.js Strategies Architecture (Local, JWT, OAuth2) vs Custom Middleware",
    priority: "good-to-know",
    difficulty: "intermediate",
    question: "How does Passport.js plug into Express, and what are the trade-offs between Passport.js and lightweight custom middleware?",
    quickAnswer: "Passport.js provides a unified pluggable authentication abstraction using 'Strategies' (Local, JWT, Google OAuth2, GitHub). It integrates via `passport.initialize()` and `passport.session()`. While Passport standardizes OAuth flows, modern microservices often favor lightweight custom middleware for JWTs to avoid callback overhead and complex serialization lifecycles.",
    detailedAnswer: "Passport Architecture:\n- `passport.use(new LocalStrategy(...))` registers credential validation logic.\n- `passport.serializeUser()` / `deserializeUser()` binds user identity into session.\n- `passport.authenticate('strategy', { session: false })` guards routes.\n\nComparison:\n- Passport Pros: 500+ pre-built OAuth strategies; handles complex OAuth redirection and token exchange.\n- Custom Middleware Pros: Zero external abstractions, 10x simpler typing in TypeScript, pure async/await without callback wrapping, optimal for modern stateless JWT architectures.",
    code: `const passport = require('passport');
const JwtStrategy = require('passport-jwt').Strategy;
const ExtractJwt = require('passport-jwt').ExtractJwt;

const opts = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
  secretOrKey: process.env.JWT_SECRET
};

passport.use(new JwtStrategy(opts, async (jwtPayload, done) => {
  try {
    const user = await userRepository.findById(jwtPayload.id);
    if (user) return done(null, user);
    return done(null, false);
  } catch (err) {
    return done(err, false);
  }
}));

app.use(passport.initialize());

// Protected route via Passport
app.get('/api/me', passport.authenticate('jwt', { session: false }), (req, res) => {
  res.json({ user: req.user });
});`,
    recallHint: "Passport standardizes 500+ auth strategies; custom middleware is cleaner and lighter for modern stateless JWT APIs.",
    interviewTip: "Highlight that for pure REST APIs using stateless JWTs, Passport often adds unnecessary complexity (such as legacy callback style), but is invaluable for multi-provider OAuth (Google, GitHub, Apple).",
    tags: ["passport.js", "strategies", "jwt-strategy", "oauth", "middleware"]
  }),

  createCard({
    idNum: 71,
    category: "Authentication, Authorization & Session Management",
    concept: "Password Hashing Pipeline (Argon2 / bcrypt) and Salt Rounds in Express Handlers",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How should password hashing be implemented in Express authentication services, and why are SHA-256 or MD5 unacceptable?",
    quickAnswer: "Passwords must be hashed using adaptive, salted, slow hashing algorithms such as Argon2id or bcrypt (with cost factor >= 12). Fast hashes like SHA-256 and MD5 are vulnerable to offline brute-force and GPU rainbow table attacks (capable of computing billions of hashes per second).",
    detailedAnswer: "Key Hashing Principles:\n1. Adaptive Cost / Work Factor: Slows down attacker's hardware without noticeably degrading user login experience (ideal target is 100-300ms calculation time).\n2. Unique Salt: Prevents pre-computed rainbow table lookups.\n3. Asynchronous execution: Never use synchronous hashing (`bcrypt.hashSync()`) inside Express route handlers, as doing so blocks the single Node.js event loop thread, causing severe latency spikes for all concurrent users.",
    code: `const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12; // Computation takes ~150-250ms per hash

app.post('/api/auth/register', async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // ALWAYS use async hashing: non-blocking threadpool delegation!
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const newUser = await userRepository.create({ email, passwordHash });
    res.status(201).json({ id: newUser.id, email: newUser.email });
  } catch (err) {
    next(err);
  }
});

app.post('/api/auth/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await userRepository.findByEmail(email);

    // Asynchronous bcrypt compare
    const isMatch = user ? await bcrypt.compare(password, user.passwordHash) : false;

    if (!isMatch) {
      // Generic error message prevents username enumeration
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateAccessToken(user);
    res.json({ token });
  } catch (err) {
    next(err);
  }
});`,
    recallHint: "Never use sync hashing (hashSync blocks the event loop); use bcrypt (cost 12) or Argon2id to resist GPU brute forcing.",
    interviewTip: "Highlight that `bcrypt.hashSync()` runs synchronously on the main thread and will freeze your Express server under concurrent user signups. Always use `await bcrypt.hash()` which runs on Node's libuv worker threads.",
    tags: ["bcrypt", "argon2", "password-hashing", "event-loop", "salt-rounds"]
  }),

  createCard({
    idNum: 72,
    category: "Authentication, Authorization & Session Management",
    concept: "OAuth 2.0 PKCE Authorization Code Callback Flow Handling",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you handle the OAuth 2.0 Authorization Code flow with PKCE in Express?",
    quickAnswer: "In the OAuth 2.0 PKCE flow, the client generates a secret `code_verifier` and hashed `code_challenge`. The Express callback handler receives `?code=...&state=...`, asserts that `state` matches the stored CSRF state cookie, exchanges the authorization code + `code_verifier` with the Identity Provider for tokens via a backchannel HTTP POST, and issues an application session.",
    detailedAnswer: "PKCE (Proof Key for Code Exchange) Benefits:\nPrevents authorization code interception attacks on public clients and SPAs.\n\nCallback Flow Steps in Express:\n1. Verify `state`: Ensure `req.query.state === req.cookies.oauth_state` to prevent Cross-Site Request Forgery (CSRF).\n2. Read `req.query.code`.\n3. Make direct backchannel POST request to OAuth provider token endpoint (`https://oauth2.googleapis.com/token`) sending `code`, `client_id`, `client_secret`, and `code_verifier`.\n4. Receive `id_token` and `access_token`.\n5. Establish local authenticated user session.",
    code: `app.get('/api/auth/callback/google', async (req, res, next) => {
  try {
    const { code, state } = req.query;
    const storedState = req.cookies.oauth_state;

    // 1. Verify CSRF State
    if (!state || state !== storedState) {
      return res.status(403).json({ error: 'Invalid state parameter (CSRF detected)' });
    }

    res.clearCookie('oauth_state');
    const codeVerifier = req.cookies.code_verifier;
    res.clearCookie('code_verifier');

    // 2. Exchange authorization code with Google for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier
      })
    });

    const tokens = await tokenResponse.json();
    const userProfile = jwt.decode(tokens.id_token);

    // 3. Find or create user in database and log in
    const user = await userService.findOrCreateFromOAuth(userProfile);
    const sessionJwt = generateUserToken(user);

    res.redirect(\`https://myapp.com/dashboard?token=\${sessionJwt}\`);
  } catch (err) {
    next(err);
  }
});`,
    recallHint: "Validate state parameter against stored cookie to defeat CSRF, exchange code + code_verifier backchannel, issue user session.",
    interviewTip: "Clarify why the state parameter is critical in OAuth callbacks: without verifying state, an attacker can trick an authenticated victim into executing a callback that binds the victim's account to the attacker's third-party identity.",
    tags: ["oauth2", "pkce", "callback", "csrf-defense", "state-verification"]
  })
];

module.exports = cards;
