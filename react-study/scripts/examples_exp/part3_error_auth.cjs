module.exports = [
  {
    id: "exp-ex-21",
    title: "Enterprise Centralized Error Middleware with Custom AppError Hierarchy",
    category: "Error Handling Architecture",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs a robust custom AppError hierarchy with HTTP status codes and operational flags, caught by a 4-argument Express error handler.",
    conceptsCovered: [
      "Custom Error Hierarchy",
      "AppError",
      "4-Argument Error Middleware",
      "Operational Errors",
      "Error Serialization"
    ],
    code: `const express = require('express');
const app = express();

// Base Application Error
class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(\`\${resource} not found\`, 404);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

// Route throwing clean semantic error
app.get('/api/users/:id', (req, res, next) => {
  if (req.params.id !== 'admin') {
    throw new NotFoundError('User');
  }
  res.json({ id: 'admin', role: 'root' });
});

// Central 4-argument error handler (MUST have exactly 4 args!)
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  res.status(statusCode).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error',
      statusCode,
      isOperational: err.isOperational || false
    }
  });
});

module.exports = { app, AppError, NotFoundError, UnauthorizedError };`,
    breakdown: [
      {
        lineRange: "5-12",
        note: "AppError subclasses Error, attaching statusCode and isOperational properties."
      },
      {
        lineRange: "14-24",
        note: "Semantic error subclasses (NotFoundError, UnauthorizedError) eliminate magic status numbers."
      },
      {
        lineRange: "34-45",
        note: "4-argument middleware formats uniform error responses across the entire application."
      }
    ],
    expectedOutput: "GET /api/users/99 -> 404 { success: false, error: { message: 'User not found', statusCode: 404, isOperational: true } }"
  },

  {
    id: "exp-ex-22",
    title: "Database Driver Error Translation (Postgres 23505 Unique Violation to 409 Conflict)",
    category: "Error Handling Architecture",
    difficulty: "intermediate",
    whatThisCodeCovers: "Translates low-level database error codes (PostgreSQL 23505 duplicate key, 23503 foreign key violation) into user-friendly HTTP 409 Conflict and 400 Bad Request responses.",
    conceptsCovered: [
      "Database Error Mapping",
      "PostgreSQL 23505",
      "HTTP 409 Conflict",
      "Constraint Parsing",
      "Data Hiding"
    ],
    code: `const express = require('express');
const app = express();
app.use(express.json());

function mapDatabaseError(err) {
  // PostgreSQL 23505: Unique constraint violation
  if (err.code === '23505') {
    const fieldMatch = err.detail?.match(/Key \\((.*?)\\)=/);
    const field = fieldMatch ? fieldMatch[1] : 'Field';
    const error = new Error(\`Duplicate entry: \${field} is already in use\`);
    error.statusCode = 409;
    return error;
  }

  // PostgreSQL 23503: Foreign key constraint violation
  if (err.code === '23503') {
    const error = new Error('Referenced related entity does not exist');
    error.statusCode = 400;
    return error;
  }

  return err;
}

// Error middleware translating database faults
app.use((err, req, res, next) => {
  const mapped = mapDatabaseError(err);
  const status = mapped.statusCode || 500;

  res.status(status).json({
    success: false,
    error: mapped.message
  });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "5-21",
        note: "Inspects SQL error code and extracts column name from detail string without exposing raw SQL."
      },
      {
        lineRange: "24-33",
        note: "Error handler responds with HTTP 409 Conflict rather than generic 500 Internal Server Error."
      }
    ],
    expectedOutput: "Postgres 23505 -> 409 { success: false, error: 'Duplicate entry: email is already in use' }"
  },

  {
    id: "exp-ex-23",
    title: "Safe Stack Trace Sanitization & Masked Telemetry Logging in Production",
    category: "Error Handling Architecture",
    difficulty: "intermediate",
    whatThisCodeCovers: "Configures error middleware to sanitize stack traces based on NODE_ENV, providing full debug traces in development while shielding internal code structure in production.",
    conceptsCovered: [
      "Information Disclosure",
      "NODE_ENV Switching",
      "Stack Trace Sanitization",
      "Correlation Tracking",
      "OWASP Compliance"
    ],
    code: `const express = require('express');
const crypto = require('crypto');
const app = express();

app.get('/crash', (req, res) => {
  throw new Error('Database connection failed unexpectedly');
});

// Production error sanitization middleware
app.use((err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  const correlationId = req.get('x-correlation-id') || crypto.randomUUID();

  // Internal log ALWAYS captures full stack trace for engineering review
  console.error(\`[Error \${correlationId}]:\`, err.stack || err);

  const status = err.statusCode || 500;

  if (isProd) {
    // Production response: Never expose stack trace or directory paths
    res.status(status).json({
      success: false,
      errorId: correlationId,
      message: status >= 500 ? 'An unexpected internal error occurred' : err.message
    });
  } else {
    // Development response: Rich debug metadata
    res.status(status).json({
      success: false,
      errorId: correlationId,
      message: err.message,
      stack: err.stack,
      error: err
    });
  }
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "10-18",
        note: "Generates an errorId to cross-reference server logs without revealing internals to clients."
      },
      {
        lineRange: "20-35",
        note: "Switches response payload: sanitized message in production, full stack trace in development."
      }
    ],
    expectedOutput: "Production: 500 { success: false, errorId: 'f8b1...', message: 'An unexpected internal error occurred' }"
  },

  {
    id: "exp-ex-24",
    title: "Express 4 vs 5 Asynchronous Error Wrapper & Native Promise Bridge",
    category: "Error Handling Architecture",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements the canonical asyncHandler wrapper for Express 4, demonstrating how Express 5 makes it obsolete with native Promise rejection interception.",
    conceptsCovered: [
      "asyncHandler Wrapper",
      "Express 4 Async Catching",
      "Express 5 Native Promises",
      "Promise.resolve().catch(next)",
      "Unhandled Rejections"
    ],
    code: `const express = require('express');
const app = express();

// EXPRESS 4 WORKAROUND: Higher-order wrapper catching async rejections
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Express 4: Requires asyncHandler wrapper to prevent unhandled rejection crashes
app.get('/api/users/:id', asyncHandler(async (req, res) => {
  const user = await Promise.reject(new Error('Simulated async DB failure'));
  res.json(user);
}));

// EXPRESS 5 NATIVE (NO WRAPPER NEEDED!):
// app.get('/api/users/:id', async (req, res) => {
//   const user = await Promise.reject(new Error('Simulated async DB failure'));
//   res.json(user);
// });

app.use((err, req, res, next) => {
  res.status(500).json({ caughtAsyncError: err.message });
});

module.exports = { app, asyncHandler };`,
    breakdown: [
      {
        lineRange: "5-7",
        note: "asyncHandler wraps async functions in Promise.resolve and forwards errors to next()."
      },
      {
        lineRange: "10-13",
        note: "In Express 4, unhandled promise rejections without this wrapper crash the process in Node 16+."
      }
    ],
    expectedOutput: "GET /api/users/1 -> 500 { caughtAsyncError: 'Simulated async DB failure' }"
  },

  {
    id: "exp-ex-25",
    title: "Stream Error Recovery Guarding Against ERR_HTTP_HEADERS_SENT",
    category: "Error Handling Architecture",
    difficulty: "advanced",
    whatThisCodeCovers: "Demonstrates safe error recovery in streaming endpoints, verifying res.headersSent before attempting to write HTTP status codes to avoid fatal process crashes.",
    conceptsCovered: [
      "res.headersSent",
      "ERR_HTTP_HEADERS_SENT",
      "Mid-Stream Failures",
      "Default Error Delegation",
      "Socket Destruction"
    ],
    code: `const express = require('express');
const fs = require('fs');
const app = express();

app.get('/stream-data', (req, res, next) => {
  res.setHeader('Content-Type', 'text/plain');

  // Send first chunk (headers commit to wire immediately!)
  res.write('Header line: stream started\\n');

  // Simulate failure halfway through transmission
  setTimeout(() => {
    next(new Error('Database socket terminated mid-stream!'));
  }, 50);
});

// Central Error Handler
app.use((err, req, res, next) => {
  // CRITICAL CHECK: Were HTTP headers already committed?
  if (res.headersSent) {
    console.warn('[Warning] Headers sent: Delegating to default Express handler to destroy socket cleanly.');
    return next(err); // Terminates TCP stream without crashing Node process!
  }

  // Safe to set headers and send clean JSON response
  res.status(500).json({ error: err.message });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "8-14",
        note: "res.write flushes initial bytes, meaning HTTP 200 OK headers have already been sent."
      },
      {
        lineRange: "19-24",
        note: "Checking res.headersSent prevents attempting res.status(500), which throws ERR_HTTP_HEADERS_SENT."
      }
    ],
    expectedOutput: "Stream disconnects cleanly; console logs '[Warning] Headers sent: Delegating...' with zero crashes."
  },

  {
    id: "exp-ex-26",
    title: "Stateless JWT Bearer Authentication Middleware with Token Claim Verification",
    category: "Authentication & Authorization",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a production JWT authentication middleware verifying Authorization: Bearer tokens with explicit algorithm bounds and attaching claims to req.user.",
    conceptsCovered: [
      "JWT Verification",
      "Authorization: Bearer",
      "Algorithm Whitelisting (HS256)",
      "req.user Context",
      "401 Unauthorized"
    ],
    code: `const express = require('express');
const jwt = require('jsonwebtoken');
const app = express();

const JWT_SECRET = 'production-jwt-super-secret-key';

function authenticateJwt(req, res, next) {
  const authHeader = req.get('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or malformed Authorization header' });
  }

  const token = authHeader.substring(7);

  try {
    // Explicitly enforce algorithms to prevent 'none' algorithm bypass
    const decoded = jwt.verify(token, JWT_SECRET, {
      algorithms: ['HS256']
    });

    req.user = decoded; // Attach claims to request
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
}

// Protected route
app.get('/api/protected/profile', authenticateJwt, (req, res) => {
  res.json({ message: 'Access granted', user: req.user });
});

module.exports = { app, authenticateJwt, JWT_SECRET };`,
    breakdown: [
      {
        lineRange: "8-14",
        note: "Extracts Bearer token string from standard HTTP Authorization header."
      },
      {
        lineRange: "17-21",
        note: "jwt.verify enforces algorithms: ['HS256'] to prevent algorithm confusion attacks."
      },
      {
        lineRange: "24-28",
        note: "Distinguishes between expired tokens (TOKEN_EXPIRED) and tampered tokens."
      }
    ],
    expectedOutput: "Missing header -> 401 { error: 'Missing or malformed...' }\nValid token -> 200 { message: 'Access granted', user: { id: 1, role: 'admin' } }"
  },

  {
    id: "exp-ex-27",
    title: "Dual-Token Refresh Rotation with HttpOnly Cookies and Replay Detection",
    category: "Authentication & Authorization",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements the complete Refresh Token Rotation (RTR) lifecycle: issuing short-lived access tokens, storing refresh tokens in HttpOnly cookies, and detecting token reuse.",
    conceptsCovered: [
      "Refresh Token Rotation",
      "HttpOnly Cookies",
      "Reuse Detection",
      "Token Family Revocation",
      "XSS-Proof Architecture"
    ],
    code: `const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const app = express();
app.use(express.json());
app.use(cookieParser());

const ACCESS_SECRET = 'access-sec';
const REFRESH_SECRET = 'refresh-sec';

// Mock database storing active refresh tokens and their familyId
const tokenStore = new Map();

app.post('/api/auth/refresh', async (req, res) => {
  const oldRefreshToken = req.cookies.refreshToken;
  if (!oldRefreshToken) return res.status(401).json({ error: 'No refresh token' });

  let decoded;
  try {
    decoded = jwt.verify(oldRefreshToken, REFRESH_SECRET);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const tokenRecord = tokenStore.get(oldRefreshToken);

  // REPLAY / REUSE DETECTION: Has this token already been consumed?
  if (tokenRecord && tokenRecord.isUsed) {
    console.error(\`[SECURITY BREACH] Token reuse detected for user \${decoded.userId}! Invalidate family!\`);
    // Invalidate ALL tokens in this family
    for (const [key, val] of tokenStore.entries()) {
      if (val.familyId === tokenRecord.familyId) tokenStore.delete(key);
    }
    res.clearCookie('refreshToken');
    return res.status(403).json({ error: 'Token reuse detected. Re-authentication required.' });
  }

  // Consume the old token
  tokenStore.set(oldRefreshToken, { ...tokenRecord, isUsed: true });

  // Issue fresh pair
  const newAccessToken = jwt.sign({ userId: decoded.userId }, ACCESS_SECRET, { expiresIn: '15m' });
  const newRefreshToken = jwt.sign({ userId: decoded.userId }, REFRESH_SECRET, { expiresIn: '7d' });
  tokenStore.set(newRefreshToken, { userId: decoded.userId, familyId: tokenRecord.familyId, isUsed: false });

  // Set new refresh token in secure HttpOnly cookie
  res.cookie('refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/api/auth'
  });

  res.json({ accessToken: newAccessToken });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "27-37",
        note: "If an already-consumed token is received, token reuse detection revokes all sessions in that family."
      },
      {
        lineRange: "39-47",
        note: "Rotates refresh token: marks old token consumed and issues new refresh token."
      },
      {
        lineRange: "50-55",
        note: "Stores refresh token in HttpOnly, SameSite=Strict cookie, inaccessible to XSS."
      }
    ],
    expectedOutput: "Valid refresh -> 200 { accessToken: '...' } + Set-Cookie: refreshToken=...\nReplayed token -> 403 { error: 'Token reuse detected...' }"
  },

  {
    id: "exp-ex-28",
    title: "Role-Based Access Control (RBAC) Middleware Factory",
    category: "Authentication & Authorization",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a flexible requireRole(...roles) authorization guard returning 403 Forbidden when an authenticated user lacks sufficient privileges.",
    conceptsCovered: [
      "RBAC",
      "requireRole Factory",
      "403 Forbidden vs 401 Unauthorized",
      "Permission Arrays",
      "Declarative Authorization"
    ],
    code: `const express = require('express');
const app = express();

// Mock authentication middleware
function fakeAuth(req, res, next) {
  req.user = { id: 101, username: 'editor_bob', roles: ['editor'] };
  next();
}

// RBAC Middleware Factory
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userRoles = req.user.roles || [];
    const hasAccess = allowedRoles.some(role => userRoles.includes(role));

    if (!hasAccess) {
      return res.status(403).json({
        error: 'Forbidden',
        message: \`Access requires one of: [\${allowedRoles.join(', ')}]\`
      });
    }

    next();
  };
}

app.use(fakeAuth);

// Editor or Admin can edit posts
app.put('/api/posts/:id', requireRole('editor', 'admin'), (req, res) => {
  res.json({ success: true, message: 'Post updated' });
});

// Admin only
app.delete('/api/posts/:id', requireRole('admin'), (req, res) => {
  res.json({ success: true, message: 'Post deleted' });
});

module.exports = { app, requireRole };`,
    breakdown: [
      {
        lineRange: "11-28",
        note: "Higher-order requireRole verifies req.user.roles against allowed list; returns 403 Forbidden on failure."
      },
      {
        lineRange: "33-41",
        note: "Declaratively mounts role requirements per route with zero redundant permission code in controllers."
      }
    ],
    expectedOutput: "PUT /api/posts/1 -> 200 { success: true }\nDELETE /api/posts/1 (by editor) -> 403 { error: 'Forbidden', message: 'Access requires one of: [admin]' }"
  },

  {
    id: "exp-ex-29",
    title: "Attribute-Based Access Control (ABAC) Resource Ownership Guard",
    category: "Authentication & Authorization",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements an ABAC ownership middleware verifying that the requesting user owns the specific document ID being modified, defeating Insecure Direct Object References (IDOR).",
    conceptsCovered: [
      "ABAC",
      "Resource Ownership",
      "IDOR Defense",
      "Preloading req.resource",
      "OWASP Broken Object Authorization"
    ],
    code: `const express = require('express');
const app = express();

const documentDb = new Map([
  ['doc_1', { id: 'doc_1', title: 'Doc 1', ownerId: 'user_alice' }],
  ['doc_2', { id: 'doc_2', title: 'Doc 2', ownerId: 'user_bob' }]
]);

function requireOwnership(req, res, next) {
  const docId = req.params.id;
  const doc = documentDb.get(docId);

  if (!doc) {
    return res.status(404).json({ error: 'Document not found' });
  }

  const isOwner = doc.ownerId === req.user?.id;
  const isAdmin = req.user?.roles?.includes('admin');

  if (!isOwner && !isAdmin) {
    return res.status(403).json({ error: 'You do not have permission to modify this document' });
  }

  // Pre-attach resource to req to prevent redundant database lookup in controller!
  req.resource = doc;
  next();
}

app.use((req, res, next) => {
  // Mock authenticated user as user_alice
  req.user = { id: 'user_alice', roles: ['user'] };
  next();
});

app.put('/api/documents/:id', requireOwnership, (req, res) => {
  // Safe: req.resource is guaranteed to be owned by req.user
  res.json({ message: 'Document updated', document: req.resource });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "10-27",
        note: "Verifies document.ownerId === req.user.id (or superadmin bypass) before reaching controller."
      },
      {
        lineRange: "25-26",
        note: "Attaches verified doc to req.resource, eliminating duplicate database lookups in controllers."
      }
    ],
    expectedOutput: "Alice updating doc_1 -> 200 { message: 'Document updated' }\nAlice updating doc_2 -> 403 { error: 'You do not have permission...' }"
  },

  {
    id: "exp-ex-30",
    title: "Distributed Stateful Session Store with express-session & Redis",
    category: "Authentication & Authorization",
    difficulty: "intermediate",
    whatThisCodeCovers: "Configures express-session backed by connect-redis and RedisClient, enabling clustered horizontal scaling and preventing MemoryStore leaks.",
    conceptsCovered: [
      "express-session",
      "connect-redis",
      "Redis Session Store",
      "Horizontal Scaling",
      "Session Security Attributes"
    ],
    code: `const express = require('express');
const session = require('express-session');
const { createClient } = require('redis');
const RedisStore = require('connect-redis').default;

const app = express();
app.use(express.json());

// Initialize Redis client
const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.connect().catch(console.error);

app.use(session({
  store: new RedisStore({ client: redisClient, prefix: 'sess:' }),
  secret: process.env.SESSION_SECRET || 'super-session-secret',
  resave: false, // Prevents race condition overwrites if unmodified
  saveUninitialized: false, // Complies with privacy laws; only save modified sessions
  name: 'app_sid', // Obscure default connect.sid cookie name
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true, // XSS defense
    sameSite: 'lax',
    maxAge: 1000 * 60 * 60 * 24 // 24 hours
  }
}));

app.post('/api/login', (req, res) => {
  req.session.userId = 'user_99';
  req.session.role = 'manager';
  res.json({ message: 'Session created and saved in Redis' });
});

app.get('/api/me', (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Unauthenticated' });
  res.json({ userId: req.session.userId, role: req.session.role });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "13-26",
        note: "Configures connect-redis store with secure cookie flags (httpOnly, secure, sameSite)."
      },
      {
        lineRange: "28-32",
        note: "Mutating req.session persists state directly into Redis with automatic TTL expiration."
      }
    ],
    expectedOutput: "POST /api/login -> 200 + Set-Cookie: app_sid=s%3A...\nGET /api/me -> 200 { userId: 'user_99', role: 'manager' }"
  },

  {
    id: "exp-ex-31",
    title: "Constant-Time API Key Authentication with crypto.timingSafeEqual",
    category: "Authentication & Authorization",
    difficulty: "advanced",
    whatThisCodeCovers: "Authenticates Machine-to-Machine API keys using SHA-256 hashing and crypto.timingSafeEqual, defeating timing side-channel attacks.",
    conceptsCovered: [
      "API Key Authentication",
      "crypto.timingSafeEqual",
      "Timing Attacks",
      "Constant-Time Comparison",
      "SHA-256 Hash Matching"
    ],
    code: `const express = require('express');
const crypto = require('crypto');
const app = express();

// Stored SHA-256 hash of valid API key (never store plaintext keys!)
const VALID_KEY_HASH = crypto.createHash('sha256').update('sk_live_enterprise_secret_99').digest();

function authenticateApiKey(req, res, next) {
  const apiKey = req.get('X-API-Key');

  if (!apiKey) {
    return res.status(401).json({ error: 'Missing X-API-Key header' });
  }

  // Hash incoming key
  const incomingHash = crypto.createHash('sha256').update(apiKey).digest();

  // Length check prevents timingSafeEqual exception
  if (incomingHash.length !== VALID_KEY_HASH.length) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Constant-time byte comparison defeats timing side-channel attacks
  const isValid = crypto.timingSafeEqual(incomingHash, VALID_KEY_HASH);

  if (!isValid) {
    return res.status(401).json({ error: 'Invalid API key' });
  }

  req.authType = 'm2m_api_key';
  next();
}

app.post('/api/v1/telemetry', authenticateApiKey, (req, res) => {
  res.json({ received: true, authenticatedBy: req.authType });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "6-6",
        note: "Pre-calculates SHA-256 hash of known valid API key; raw keys are never stored in plaintext."
      },
      {
        lineRange: "15-26",
        note: "crypto.timingSafeEqual compares byte buffers in constant time regardless of where differences occur."
      }
    ],
    expectedOutput: "Valid API key -> 200 { received: true, authenticatedBy: 'm2m_api_key' }\nWrong API key -> 401 { error: 'Invalid API key' }"
  }
];
