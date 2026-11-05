module.exports = [
  {
    id: "exp-ex-32",
    title: "Production Helmet Security Suite with Dynamic CSP Nonce Generation",
    category: "Security & Hardening",
    difficulty: "advanced",
    whatThisCodeCovers: "Configures Helmet security headers with per-request dynamic CSP nonces, allowing trusted inline scripts while completely blocking XSS injection.",
    conceptsCovered: [
      "Helmet",
      "Content Security Policy (CSP)",
      "Dynamic Nonces",
      "XSS Defense",
      "Strict-Transport-Security (HSTS)"
    ],
    code: `const express = require('express');
const helmet = require('helmet');
const crypto = require('crypto');

const app = express();

// 1. Generate unique base64 nonce per request
app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString('base64');
  next();
});

// 2. Configure Helmet using the dynamic per-request nonce
app.use((req, res, next) => {
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", \`'nonce-\${res.locals.cspNonce}'\`],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://cdn.myapp.com"],
        objectSrc: ["'none'"]
      }
    },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' }
  })(req, res, next);
});

// View endpoint injecting the matching nonce into the script tag
app.get('/dashboard', (req, res) => {
  res.send(\`
    <!DOCTYPE html>
    <html>
      <head><title>Secure Portal</title></head>
      <body>
        <h1>Authenticated Dashboard</h1>
        <!-- Browser executes this script because nonce matches CSP header -->
        <script nonce="\${res.locals.cspNonce}">
          console.log('Authorized inline script executed safely.');
        </script>
      </body>
    </html>
  \`);
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "8-12",
        note: "Generates a fresh 16-byte random base64 nonce stored in res.locals for each HTTP request."
      },
      {
        lineRange: "15-32",
        note: "Configures Helmet CSP to allow only scripts tagged with the dynamic nonce, blocking injected XSS."
      },
      {
        lineRange: "41-45",
        note: "Renders the HTML script tag with the matching nonce attribute."
      }
    ],
    expectedOutput: "GET /dashboard -> Response header: Content-Security-Policy: script-src 'self' 'nonce-...' with matching <script nonce='...'>"
  },

  {
    id: "exp-ex-33",
    title: "Secure CORS Policy with Origin Whitelisting and Preflight Caching",
    category: "Security & Hardening",
    difficulty: "intermediate",
    whatThisCodeCovers: "Configures the cors middleware with a strict origin whitelist function, credentials authorization, and 24-hour preflight caching (maxAge).",
    conceptsCovered: [
      "cors",
      "Origin Whitelist",
      "credentials: true",
      "Preflight OPTIONS Caching",
      "Disallowing Wildcard Origins"
    ],
    code: `const express = require('express');
const cors = require('cors');
const app = express();

const ALLOWED_ORIGINS = new Set([
  'https://app.enterprise.com',
  'https://admin.enterprise.com'
]);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. mobile apps, curl) or whitelisted origins
    if (!origin || ALLOWED_ORIGINS.has(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Disallowed by CORS security policy'));
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  maxAge: 86400 // Cache preflight OPTIONS response in browser for 24 hours
};

app.use(cors(corsOptions));

app.get('/api/me', (req, res) => {
  res.json({ user: 'authenticated_user' });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "5-9",
        note: "Defines an exact Set of allowed frontend origins; prevents wildcard origin security holes."
      },
      {
        lineRange: "11-23",
        note: "Enables credentials: true while strictly verifying origin; caches preflight responses for 24h."
      }
    ],
    expectedOutput: "OPTIONS /api/me (Origin: https://app.enterprise.com) -> 204 Access-Control-Allow-Origin: https://app.enterprise.com, maxAge: 86400"
  },

  {
    id: "exp-ex-34",
    title: "Distributed Rate Limiter with Redis Sliding Window Counter",
    category: "Security & Rate Limiting",
    difficulty: "intermediate",
    whatThisCodeCovers: "Configures express-rate-limit backed by rate-limit-redis to enforce distributed request throttling (5 requests / 15 minutes) across clustered containers.",
    conceptsCovered: [
      "express-rate-limit",
      "rate-limit-redis",
      "429 Too Many Requests",
      "Distributed Rate Limiting",
      "Standard Headers (RateLimit-*)"
    ],
    code: `const express = require('express');
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { createClient } = require('redis');

const app = express();
app.use(express.json());

const redisClient = createClient({ url: process.env.REDIS_URL || 'redis://localhost:6379' });
redisClient.connect().catch(console.error);

// Strict limiter for authentication endpoints
const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 login attempts per window
  standardHeaders: true, // Draft RFC standard RateLimit-* headers
  legacyHeaders: false, // Disables X-RateLimit-* headers
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:auth:'
  }),
  message: {
    status: 429,
    error: 'Too many authentication attempts. Please try again in 15 minutes.'
  }
});

app.post('/api/auth/login', authRateLimiter, (req, res) => {
  res.json({ message: 'Login logic executed' });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "13-26",
        note: "Configures RedisStore to synchronize attempt counters across multiple Kubernetes pod instances."
      },
      {
        lineRange: "28-30",
        note: "Returns HTTP 429 with RateLimit-Limit, RateLimit-Remaining, and RateLimit-Reset headers."
      }
    ],
    expectedOutput: "Attempts 1-5 -> 200 OK\nAttempt 6 -> 429 { status: 429, error: 'Too many authentication attempts...' }"
  },

  {
    id: "exp-ex-35",
    title: "Double-Submit Cookie CSRF Defense for Single-Page Applications",
    category: "Security & Hardening",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements the Double-Submit Cookie CSRF defense: sets an XSRF-TOKEN cookie readable by frontend JS, asserting incoming POST requests include matching X-XSRF-TOKEN headers.",
    conceptsCovered: [
      "CSRF Mitigation",
      "Double-Submit Cookie",
      "X-XSRF-TOKEN Header",
      "Safe HTTP Methods",
      "SPA Security"
    ],
    code: `const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
app.use(express.json());
app.use(cookieParser('cookie-signing-secret'));

// Endpoint issuing anti-CSRF token
app.get('/api/csrf-init', (req, res) => {
  const csrfToken = crypto.randomBytes(32).toString('hex');

  // Set cookie readable by frontend JavaScript (httpOnly: false)
  res.cookie('XSRF-TOKEN', csrfToken, {
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: false // Allows Axios or Angular to read and echo in request headers
  });

  res.json({ initialized: true });
});

// CSRF Verification Middleware
function verifyCsrfToken(req, res, next) {
  // Safe read-only HTTP methods are exempt
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  const tokenFromHeader = req.get('x-xsrf-token') || req.get('x-csrf-token');
  const tokenFromCookie = req.cookies['XSRF-TOKEN'];

  if (!tokenFromHeader || !tokenFromCookie || tokenFromHeader !== tokenFromCookie) {
    return res.status(403).json({ error: 'Invalid or missing CSRF token' });
  }

  next();
}

app.post('/api/account/transfer', verifyCsrfToken, (req, res) => {
  res.json({ success: true, message: 'Transfer completed safely' });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "10-21",
        note: "Generates a 32-byte token and sets XSRF-TOKEN cookie with SameSite: 'lax'."
      },
      {
        lineRange: "24-38",
        note: "Compares X-XSRF-TOKEN header against the cookie; cross-origin sites cannot read this cookie."
      }
    ],
    expectedOutput: "POST /transfer (valid token) -> 200 { success: true }\nPOST /transfer (missing token) -> 403 { error: 'Invalid or missing CSRF token' }"
  },

  {
    id: "exp-ex-36",
    title: "NoSQL & SQL Injection Defense Pipeline (Mongo Sanitize + Parameterized Queries)",
    category: "Security & Hardening",
    difficulty: "intermediate",
    whatThisCodeCovers: "Defends against NoSQL operator injection using express-mongo-sanitize while employing parameterized queries ($1, $2) to guarantee complete SQL injection immunity.",
    conceptsCovered: [
      "NoSQL Injection Defense",
      "express-mongo-sanitize",
      "SQL Parameterized Queries",
      "Operator Stripping ($gt, $ne)",
      "OWASP Injection Prevention"
    ],
    code: `const express = require('express');
const mongoSanitize = require('express-mongo-sanitize');
const app = express();

app.use(express.json());

// Defense 1: Recursively strip prohibited '$' and '.' characters from body, query, and params
app.use(mongoSanitize({
  replaceWith: '_'
}));

// Mock Database Pool
const fakePool = {
  query: async (sql, params) => {
    // Parameterized driver executes SQL with separated parameter bindings
    return { rows: [{ id: 1, email: params[0] }] };
  }
};

app.post('/api/users/find', async (req, res, next) => {
  try {
    const { email } = req.body;

    // Defense 2: Parameterized SQL Query (NEVER concatenate strings!)
    const query = 'SELECT id, email, full_name FROM users WHERE email = $1';
    const { rows } = await fakePool.query(query, [email]);

    res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "7-11",
        note: "mongoSanitize strips query operators like { $ne: null } from incoming payloads."
      },
      {
        lineRange: "23-28",
        note: "Uses $1 parameter placeholders; database driver treats inputs strictly as data literals."
      }
    ],
    expectedOutput: "Payload { email: { $ne: null } } -> Sanitized to { email: { _ne: null } } avoiding NoSQL bypass."
  },

  {
    id: "exp-ex-37",
    title: "HTTP Parameter Pollution (HPP) Defense for Query Arrays",
    category: "Security & Hardening",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses the hpp middleware to defend against HTTP Parameter Pollution, ensuring duplicate query string keys (?role=user&role=admin) are sanitized into single strings.",
    conceptsCovered: [
      "hpp Middleware",
      "HTTP Parameter Pollution",
      "Duplicate Query Keys",
      "Whitelist Whitelisting",
      "Array Injection Defense"
    ],
    code: `const express = require('express');
const hpp = require('hpp');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Protect against parameter pollution on query strings and form bodies
app.use(hpp({
  // Allow array values ONLY for these whitelisted keys:
  whitelist: ['tags', 'categories']
}));

// Request: GET /api/search?role=user&role=admin&tags=tech&tags=news
app.get('/api/search', (req, res) => {
  // Without hpp: req.query.role would be ['user', 'admin']!
  // With hpp: req.query.role is sanitized to the last string: 'admin'
  // Whitelisted 'tags' remains an array: ['tech', 'news']
  res.json({
    roleType: typeof req.query.role, // 'string'
    role: req.query.role,
    tags: req.query.tags // ['tech', 'news']
  });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "9-13",
        note: "hpp sanitizes duplicate parameters, keeping only the last scalar value unless whitelisted."
      },
      {
        lineRange: "16-25",
        note: "Prevents TypeError crashes when downstream logic does req.query.role.toLowerCase()."
      }
    ],
    expectedOutput: "GET /api/search?role=user&role=admin -> { roleType: 'string', role: 'admin' }"
  },

  {
    id: "exp-ex-38",
    title: "Type-Safe Zod Request Validator Guard for { body, query, params }",
    category: "Input Validation",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a composable Zod validation middleware validating body, query, and URL params in a single step, stripping unknown fields and returning structured 400 errors.",
    conceptsCovered: [
      "Zod Schema Validation",
      "Fail-Fast 400 Bad Request",
      "Composite Schemas",
      "Field Stripping",
      "Type Coercion"
    ],
    code: `const express = require('express');
const { z, ZodError } = require('zod');

const app = express();
app.use(express.json());

// Reusable composite request validation middleware
const validate = (schema) => async (req, res, next) => {
  try {
    const parsed = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params
    });

    // Reassign sanitized and stripped values
    if (parsed.body) req.body = parsed.body;
    if (parsed.query) req.query = parsed.query;
    if (parsed.params) req.params = parsed.params;

    next();
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Validation Failed',
        details: err.issues.map(i => ({ field: i.path.join('.'), message: i.message }))
      });
    }
    next(err);
  }
};

const UpdateUserSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user UUID')
  }),
  body: z.object({
    email: z.string().email(),
    age: z.number().int().min(18)
  }).strip() // Discards unknown fields like isAdmin
});

app.put('/api/users/:id', validate(UpdateUserSchema), (req, res) => {
  res.json({ id: req.params.id, updatedUser: req.body });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "8-28",
        note: "Validates body, query, and params together; catches ZodError and formats clean 400 JSON."
      },
      {
        lineRange: "30-38",
        note: "Composite Zod schema validates UUID format and strips unlisted fields (anti-mass assignment)."
      }
    ],
    expectedOutput: "Invalid UUID -> 400 { details: [{ field: 'params.id', message: 'Invalid user UUID' }] }"
  },

  {
    id: "exp-ex-39",
    title: "Query String Coercion and Bounds Validation for Pagination",
    category: "Input Validation",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses Zod z.coerce to safely transform string query parameters (?page=2&limit=50&active=true) into validated numbers and booleans with strict boundaries.",
    conceptsCovered: [
      "z.coerce.number()",
      "Query String Coercion",
      "Boolean Transformations",
      "Pagination Boundaries",
      "Default Query Values"
    ],
    code: `const express = require('express');
const { z } = require('zod');
const app = express();

const PaginationQuerySchema = z.object({
  // Coerces string '2' -> number 2 with positive boundary and default
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),

  // Transforms 'true'/'false' strings to real boolean
  activeOnly: z.enum(['true', 'false'])
    .transform(val => val === 'true')
    .optional(),

  // Coerces ISO string into native Date object
  since: z.coerce.date().optional()
});

app.get('/api/inventory', async (req, res, next) => {
  try {
    const query = PaginationQuerySchema.parse(req.query);

    // Guaranteed real JavaScript types!
    console.log(typeof query.page, typeof query.activeOnly); // 'number', 'boolean'

    res.json({
      page: query.page,
      limit: query.limit,
      activeOnly: query.activeOnly,
      records: []
    });
  } catch (err) {
    res.status(400).json({ error: 'Invalid query parameters', details: err.message });
  }
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "5-17",
        note: "z.coerce parses incoming query strings into real numbers, booleans, and Dates with defaults."
      },
      {
        lineRange: "20-33",
        note: "Guarantees query.page is a true integer, avoiding string concatenation bugs like '1' + 1 === '11'."
      }
    ],
    expectedOutput: "GET /api/inventory?page=3&limit=50&activeOnly=true -> 200 { page: 3, limit: 50, activeOnly: true }"
  },

  {
    id: "exp-ex-40",
    title: "Rich Text HTML Sanitization with sanitize-html Tag Whitelisting",
    category: "Input Validation & Sanitization",
    difficulty: "intermediate",
    whatThisCodeCovers: "Sanitizes user-submitted rich text and blog comments using sanitize-html with a strict tag whitelist, stripping <script> and dangerous attributes to prevent Stored XSS.",
    conceptsCovered: [
      "sanitize-html",
      "Stored XSS Defense",
      "Tag Whitelisting",
      "Attribute Stripping",
      "rel: 'noopener noreferrer'"
    ],
    code: `const express = require('express');
const sanitizeHtml = require('sanitize-html');

const app = express();
app.use(express.json());

const sanitizeConfig = {
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'li', 'code'],
  allowedAttributes: {
    'a': ['href', 'target']
  },
  transformTags: {
    // Automatically add security attributes to links
    'a': sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer', target: '_blank' })
  }
};

app.post('/api/articles/:id/comments', (req, res) => {
  const { author, contentHtml } = req.body;

  // 1. Author must be strictly plain text (no HTML tags allowed)
  const cleanAuthor = sanitizeHtml(author, { allowedTags: [] });

  // 2. Content sanitized according to strict rich-text whitelist
  const cleanContent = sanitizeHtml(contentHtml, sanitizeConfig);

  // Safe to persist cleanContent into database
  res.json({
    author: cleanAuthor,
    content: cleanContent
  });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "7-16",
        note: "Defines allowed HTML tags and automatically forces rel='noopener noreferrer' on external links."
      },
      {
        lineRange: "18-32",
        note: "Strips script tags and inline onclick handlers from content while stripping all tags from author."
      }
    ],
    expectedOutput: "Payload <script>evil()</script><b>Hello</b> -> Sanitized to <b>Hello</b>."
  },

  {
    id: "exp-ex-41",
    title: "Asynchronous Database Uniqueness Validation with Zod superRefine",
    category: "Input Validation",
    difficulty: "advanced",
    whatThisCodeCovers: "Executes asynchronous database checks (e.g. verifying email address uniqueness) inside Zod schemas using superRefine and parseAsync.",
    conceptsCovered: [
      "Async Validation",
      "zod.superRefine",
      "Database Uniqueness Check",
      "schema.parseAsync",
      "Custom Validation Issues"
    ],
    code: `const express = require('express');
const { z } = require('zod');

const app = express();
app.use(express.json());

// Mock database
const existingUsers = new Set(['alice@example.com', 'bob@example.com']);

const RegisterSchema = z.object({
  username: z.string().min(3),
  email: z.string().email()
}).superRefine(async (data, ctx) => {
  // Asynchronous DB check: runs only after syntax validation passes!
  const isTaken = existingUsers.has(data.email);

  if (isTaken) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Email address is already in use',
      path: ['email'] // Pinpoints error directly to email input field
    });
  }
});

app.post('/api/register', async (req, res, next) => {
  try {
    // parseAsync must be awaited for async refinement rules!
    const validated = await RegisterSchema.parseAsync(req.body);
    existingUsers.add(validated.email);

    res.status(201).json({ success: true, email: validated.email });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: 'Validation Failed', issues: err.issues });
    }
    next(err);
  }
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "10-24",
        note: "superRefine performs async uniqueness query and attaches issue directly to path: ['email']."
      },
      {
        lineRange: "26-39",
        note: "Awaiting RegisterSchema.parseAsync resolves all async database assertions before controller logic."
      }
    ],
    expectedOutput: "POST /register with alice@example.com -> 400 { issues: [{ path: ['email'], message: 'Email address is already in use' }] }"
  },

  {
    id: "exp-ex-42",
    title: "Multi-Part File Upload Guard with Multer and Magic Number MIME Sniffing",
    category: "Security & File Uploads",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a hardened file upload endpoint with Multer in memoryStorage, validating binary file Magic Numbers (signatures) to prevent spoofed executable uploads.",
    conceptsCovered: [
      "multer.memoryStorage()",
      "Magic Number MIME Sniffing",
      "File Extension Spoofing",
      "file-type Validation",
      "Payload Limits"
    ],
    code: `const express = require('express');
const multer = require('multer');
const { fileTypeFromBuffer } = require('file-type');

const app = express();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 2 * 1024 * 1024 // 2 MB maximum
  }
});

const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

app.post('/api/upload/avatar', upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided in avatar field' });
    }

    // Inspect binary Magic Numbers from the buffer (NEVER trust client-provided file.mimetype!)
    const detectedType = await fileTypeFromBuffer(req.file.buffer);

    if (!detectedType || !ALLOWED_MIME_TYPES.has(detectedType.mime)) {
      return res.status(400).json({
        error: 'Invalid file type. Only authentic JPEG, PNG, and WebP images are allowed.'
      });
    }

    // Safe: file content is verified as authentic image
    const fileId = \`img_\${Date.now()}.\${detectedType.ext}\`;
    res.json({
      success: true,
      fileId,
      mime: detectedType.mime,
      sizeBytes: req.file.size
    });
  } catch (err) {
    next(err);
  }
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "7-12",
        note: "Multer memoryStorage buffers the file into req.file.buffer, bounded by 2MB limit."
      },
      {
        lineRange: "20-27",
        note: "fileTypeFromBuffer inspects actual binary bytes; renaming exploit.sh to photo.png is instantly caught."
      }
    ],
    expectedOutput: "Valid PNG buffer -> 200 { success: true, mime: 'image/png' }\nSpoofed shell script -> 400 { error: 'Invalid file type...' }"
  }
];
