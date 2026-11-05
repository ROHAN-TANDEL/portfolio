const { createCard } = require("../exp_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 85,
    category: "Input Validation & Sanitization",
    concept: "Request Validation Layer Architecture (Separation of Validation from Controllers)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why should input validation be completely separated from Express controllers into dedicated validation middleware?",
    quickAnswer: "Decoupling validation into dedicated middleware enforces the Single Responsibility Principle (SRP). Controllers focus purely on HTTP orchestration and business service calls, while validation middleware acts as an early gatekeeper, guaranteeing that only syntactically and semantically valid data ever reaches controller code.",
    detailedAnswer: "Benefits of Dedicated Validation Layer:\n1. Fail-Fast: Invalid requests are rejected with 400 Bad Request before database connections or expensive business logic are engaged.\n2. Clean Controllers: Eliminates hundreds of lines of repetitive `if (!req.body.title)` checks in controllers.\n3. Type Safety: In TypeScript, passing validated data through Zod infers exact types for downstream handlers.\n4. Reusability: Validation schemas can be shared between frontend and backend in monorepos.",
    code: `// Validation Middleware Factory
const validate = (schema) => (req, res, next) => {
  try {
    // Assert schema against request parts
    const parsed = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params
    });
    // Overwrite with stripped, sanitized, coerced data
    req.validated = parsed;
    next();
  } catch (err) {
    next(err); // Passed to central error handler
  }
};

// Clean Controller: 100% free of validation checks
const createUser = async (req, res) => {
  const newUser = await userService.create(req.validated.body);
  res.status(201).json(newUser);
};

// Route definition binds validation guard before controller
app.post('/api/users', validate(CreateUserSchema), createUser);`,
    recallHint: "Validation middleware acts as a fail-fast gatekeeper; controllers should never contain repetitive manual payload checks.",
    interviewTip: "Highlight that fail-fast validation saves database connections and CPU cycles by instantly aborting malformed requests before any expensive I/O occurs.",
    tags: ["validation-architecture", "clean-code", "fail-fast", "single-responsibility", "middleware"]
  }),

  createCard({
    idNum: 86,
    category: "Input Validation & Sanitization",
    concept: "Zod Schema Validation Middleware for Express",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you implement an idiomatic Zod schema validation middleware in Express?",
    quickAnswer: "Create a higher-order middleware function taking a Zod schema. Inside, call `schema.parseAsync()` on `req.body`, `req.query`, or `req.params`. If validation succeeds, replace `req.body` with the parsed (and stripped) data and call `next()`. If it fails, capture the `ZodError` and return HTTP 400 with formatted issue details.",
    detailedAnswer: "Zod is the modern standard for TypeScript/JavaScript schema validation:\n- Zero external dependencies.\n- Static type inference via `z.infer<typeof Schema>`.\n- Composable schemas with custom refinements.\n- Support for asynchronous validation (e.g. database lookups).",
    code: `const { z, ZodError } = require('zod');

const validateBody = (schema) => async (req, res, next) => {
  try {
    // parseAsync strips unlisted keys and coerces types
    req.body = await schema.parseAsync(req.body);
    next();
  } catch (err) {
    if (err instanceof ZodError) {
      return res.status(400).json({
        status: 'fail',
        error: 'Validation Error',
        details: err.issues.map(issue => ({
          field: issue.path.join('.'),
          message: issue.message
        }))
      });
    }
    next(err);
  }
};

const CreateOrderSchema = z.object({
  productId: z.string().uuid('Invalid Product UUID format'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
  shippingAddress: z.object({
    street: z.string().min(3),
    zipCode: z.string().regex(/^\\d{5}$/, 'ZIP must be 5 digits')
  })
});

app.post('/api/orders', validateBody(CreateOrderSchema), (req, res) => {
  res.status(201).json({ success: true, order: req.body });
});`,
    recallHint: "Wrap schema.parseAsync() in a middleware factory; return 400 with err.issues on ZodError or replace req.body on success.",
    interviewTip: "Explain why replacing `req.body = parsed` is important: Zod strips unexpected keys by default, ensuring downstream handlers receive only validated fields.",
    tags: ["zod", "validation", "schema-validation", "error-formatting", "typescript"]
  }),

  createCard({
    idNum: 87,
    category: "Input Validation & Sanitization",
    concept: "Validating req.params, req.query, and req.body in a Single Guard",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you validate URL parameters, query strings, and request body simultaneously in a single composite middleware guard?",
    quickAnswer: "Define a composite schema with optional `params`, `query`, and `body` sub-schemas. The middleware validates the composite `{ params: req.params, query: req.query, body: req.body }` object in one step, updating each request property with sanitized, typed data.",
    detailedAnswer: "Endpoints frequently require validation across all three input sources:\n- `req.params.id`: Must be a valid UUID.\n- `req.query.includeAudit`: Must coerce to boolean.\n- `req.body`: Must contain update fields.\n\nA composite validator validates all three together, guaranteeing that partial failures in query or params are caught before body processing.",
    code: `const { z } = require('zod');

const validateRequest = (schema) => async (req, res, next) => {
  try {
    const validated = await schema.parseAsync({
      body: req.body,
      query: req.query,
      params: req.params
    });

    // Reassign sanitized/coerced values
    if (validated.body) req.body = validated.body;
    if (validated.query) req.query = validated.query;
    if (validated.params) req.params = validated.params;

    next();
  } catch (err) {
    next(err);
  }
};

const UpdateArticleSchema = z.object({
  params: z.object({
    id: z.string().uuid()
  }),
  query: z.object({
    publishNow: z.enum(['true', 'false']).transform(val => val === 'true').optional()
  }),
  body: z.object({
    title: z.string().min(5),
    content: z.string().min(20)
  })
});

app.put('/api/articles/:id', validateRequest(UpdateArticleSchema), (req, res) => {
  res.json({ id: req.params.id, published: req.query.publishNow, data: req.body });
});`,
    recallHint: "Composite validator checks { params, query, body } in one schema and reassigns sanitized values back to req.",
    interviewTip: "Demonstrate how query string boolean strings (`'true'`/`'false'`) can be coerced to real booleans using Zod `.transform()`, preventing string-truthy bugs in controllers.",
    tags: ["composite-validation", "req.params", "req.query", "req.body", "zod"]
  }),

  createCard({
    idNum: 88,
    category: "Input Validation & Sanitization",
    concept: "Express-Validator Legacy vs Modern Zod/TypeBox Approaches",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the legacy `express-validator` library compare with modern schema-first validators like Zod or TypeBox?",
    quickAnswer: "`express-validator` binds validations directly to Express middleware chains using method-chaining syntax (`body('email').isEmail()`) and extracts errors via `validationResult(req)`. Modern schema-first validators (Zod, TypeBox, ArkType) decouple schemas from Express entirely, provide end-to-end TypeScript type inference, and allow code-sharing with frontends and mobile apps.",
    detailedAnswer: "Evolution of Validation in Express:\n1. `express-validator`:\n   - Built on `validator.js`.\n   - Pros: Familiar chaining syntax, deeply integrated into Express.\n   - Cons: Tightly coupled to Express `req`; poor TypeScript type inference (requires manual interface definitions).\n2. Modern Schema-First (Zod / TypeBox):\n   - Schema acts as the Single Source of Truth.\n   - TypeScript types are inferred automatically (`type User = z.infer<typeof UserSchema>`).\n   - Framework-agnostic: Works with Express, Fastify, Next.js, and React Hook Form.",
    code: `// EXPRESS-VALIDATOR (LEGACY PATTERN):
const { body, validationResult } = require('express-validator');

app.post('/api/legacy/login',
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    res.send('Valid');
  }
);

// MODERN ZOD PATTERN:
// Schema can be shared with React frontend!
const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});
// Automatically derives TypeScript type:
// type LoginDTO = z.infer<typeof LoginSchema>;`,
    recallHint: "express-validator is coupled to Express; Zod is schema-first, framework-agnostic, and infers TypeScript types automatically.",
    interviewTip: "When asked about validation choices in modern architectures, explain that schema-first libraries (Zod/TypeBox) prevent type drift between TypeScript interfaces and runtime validation rules.",
    tags: ["express-validator", "zod", "typebox", "type-inference", "schema-design"]
  }),

  createCard({
    idNum: 89,
    category: "Input Validation & Sanitization",
    concept: "Coercing and Transforming Query Parameters (Numbers, Booleans, Dates)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why are HTTP query parameters always strings in Express, and how do you safely coerce and validate them?",
    quickAnswer: "URL query strings are parsed as text strings by HTTP specifications (e.g. `?page=1&active=true` becomes `{ page: '1', active: 'true' }`). In JavaScript, `'false'` is truthy and `'1' + 1 === '11'`. Zod's `z.coerce` automatically parses strings into true JavaScript numbers, booleans, or Dates with NaN/bounds safety.",
    detailedAnswer: "Common Bugs with Query Strings:\n- `if (req.query.active) ...`: Even if `?active=false`, the string `'false'` evaluates to `true` in JavaScript conditionals!\n- `const limit = req.query.limit || 10`: If passed `?limit=0`, it evaluates to `10` because `0` is falsy.\n\nSafe Coercion with Zod:\n`z.coerce.number().min(1).max(100)`\n`z.coerce.boolean()`\n`z.coerce.date()`\nThese ensure robust conversions and reject malformed inputs like `?page=banana`.",
    code: `const { z } = require('zod');

const PaginationQuerySchema = z.object({
  // Coerces string '2' to number 2, applies defaults and boundary bounds
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  
  // Custom boolean transformation: 'true' -> true, 'false' -> false
  archived: z.enum(['true', 'false'])
    .transform(val => val === 'true')
    .optional(),

  // Coerces ISO date string to native Date object
  fromDate: z.coerce.date().optional()
});

app.get('/api/transactions', async (req, res, next) => {
  try {
    const query = PaginationQuerySchema.parse(req.query);
    // query.page is guaranteed to be a real number!
    // query.archived is a real boolean!
    console.log(typeof query.page, typeof query.archived); // 'number', 'boolean'

    const results = await transactionService.find(query);
    res.json(results);
  } catch (err) {
    next(err);
  }
});`,
    recallHint: "Query parameters are always strings; use z.coerce or explicit transform to prevent 'false' being truthy and string math bugs.",
    interviewTip: "Demonstrate knowledge of JavaScript truthiness: `'false' === true` is false, but `Boolean('false')` is `true`. Always use explicit schema transformation.",
    tags: ["z.coerce", "query-coercion", "type-transformation", "pagination", "truthiness"]
  }),

  createCard({
    idNum: 90,
    category: "Input Validation & Sanitization",
    concept: "Stripping Unknown & Malicious Fields (Strip vs Strict Modes)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between stripping unknown fields vs strict rejection, and how does it prevent Mass Assignment vulnerabilities?",
    quickAnswer: "Mass Assignment (or Over-Posting) occurs when an attacker includes unauthorized fields (e.g. `isAdmin: true` or `role: 'superadmin'`) in request bodies that get passed directly to database models. In Zod, the default behavior strips unrecognized keys, whereas `.strict()` rejects requests with unexpected keys, returning HTTP 400.",
    detailedAnswer: "Mass Assignment Exploit:\nAttacker submits: `{ \"email\": \"hacker@test.com\", \"password\": \"secret\", \"isVerified\": true, \"accountBalance\": 99999 }`.\nIf the controller does `User.create(req.body)`, the attacker successfully modifies privileged columns.\n\nModes:\n1. `strip` (Default): Silently discards extra properties. Clean and forgiving for evolving frontend clients.\n2. `strict`: Throws validation errors if any unlisted keys appear. Best for strict enterprise APIs and zero-trust internal microservices.",
    code: `const { z } = require('zod');

// 1. Strict Mode: Rejects any extraneous fields outright
const StrictUserUpdateSchema = z.object({
  fullName: z.string().min(2),
  bio: z.string().max(250).optional()
}).strict(); // Throws ZodError if payload contains 'isAdmin'

// 2. Strip Mode: Discards extra fields, keeping only declared fields
const StrippedUserUpdateSchema = z.object({
  fullName: z.string().min(2),
  bio: z.string().max(250).optional()
}).strip();

app.patch('/api/profile', async (req, res, next) => {
  try {
    // Stripped output: Even if req.body has { isAdmin: true },
    // sanitized contains ONLY { fullName, bio }
    const sanitized = StrippedUserUpdateSchema.parse(req.body);

    await userRepository.update(req.user.id, sanitized);
    res.json({ success: true, profile: sanitized });
  } catch (err) {
    next(err);
  }
});`,
    recallHint: "Mass Assignment allows attackers to overwrite roles or balances; strip or strict validation guarantees only allowed fields persist.",
    interviewTip: "Cite OWASP API Top 10 'Broken Object Property Level Authorization' (formerly Mass Assignment) as the key vulnerability solved by input stripping.",
    tags: ["mass-assignment", "over-posting", "strict-mode", "zod-strip", "owasp"]
  }),

  createCard({
    idNum: 91,
    category: "Input Validation & Sanitization",
    concept: "Complex Conditional and Cross-Field Validation (Password Confirm, Date Ranges)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you validate interdependent fields (e.g. password confirmation match or endDate after startDate) in Express?",
    quickAnswer: "Interdependent validation requires cross-field validation on the parent object. Using Zod's `.refine()` or `.superRefine()`, you access the entire validated object and assert relationships (e.g. `data.password === data.confirmPassword` or `data.endDate > data.startDate`), attaching custom error messages to specific field paths.",
    detailedAnswer: "Field-level validators check properties in isolation. When one property depends on another, object-level refinement is required.\n\n`refine` vs `superRefine`:\n- `.refine((data) => condition, { message, path })`: Simple boolean assertion.\n- `.superRefine((data, ctx) => { ... })`: Advanced multi-rule assertion allowing conditional checks (e.g., if paymentMethod is 'card', require cardNumber; if 'paypal', require paypalEmail).",
    code: `const { z } = require('zod');

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  confirmPassword: z.string()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"] // Attaches error specifically to the confirmPassword field
});

const BookingSchema = z.object({
  startDate: z.coerce.date(),
  endDate: z.coerce.date()
}).refine((data) => data.endDate > data.startDate, {
  message: "End date must be strictly after start date",
  path: ["endDate"]
});

app.post('/api/bookings', (req, res, next) => {
  try {
    const booking = BookingSchema.parse(req.body);
    res.status(201).json({ success: true, booking });
  } catch (err) {
    next(err);
  }
});`,
    recallHint: "Use .refine() on the parent schema object for cross-field checks; set path: ['field'] to point the error at the right property.",
    interviewTip: "Always set `path: ['targetField']` inside `.refine()` so client forms can highlight the exact invalid input box rather than displaying a generic top-level error.",
    tags: ["cross-field-validation", "refine", "superRefine", "zod", "conditional-validation"]
  }),

  createCard({
    idNum: 92,
    category: "Input Validation & Sanitization",
    concept: "HTML Sanitization & XSS Defense on Text Inputs (xss, sanitize-html)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you sanitize user-supplied HTML and rich text in Express to prevent Stored XSS attacks?",
    quickAnswer: "When accepting rich text (markdown, comments, forum posts), never store raw HTML. Use libraries like `sanitize-html` or `dompurify` (with `jsdom`) to strip dangerous tags (`<script>`, `<iframe>`, `onload` attributes) and enforce strict allowed tag and attribute whitelists before persisting to the database.",
    detailedAnswer: "Stored Cross-Site Scripting (XSS):\nAn attacker submits `<img src=\"x\" onerror=\"stealCookies()\">` in a blog comment. When other users view the comment, the script executes in their browser context.\n\nSanitization Strategy:\n- Pure text fields (names, emails): Do NOT accept HTML. Validate with regex or strip tags.\n- Rich text fields (articles, product descriptions): Pass through `sanitizeHtml()` with an explicit whitelist of safe tags (`<p>`, `<b>`, `<i>`, `<a>` with `rel=\"noopener\"`).",
    code: `const sanitizeHtml = require('sanitize-html');

const sanitizeOptions = {
  allowedTags: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'li'],
  allowedAttributes: {
    'a': ['href', 'target', 'rel']
  },
  transformTags: {
    'a': sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' })
  }
};

app.post('/api/comments', (req, res) => {
  const { author, commentText } = req.body;

  // Author should be plain text
  const cleanAuthor = sanitizeHtml(author, { allowedTags: [] });

  // Rich text sanitized against safe tag whitelist
  const cleanComment = sanitizeHtml(commentText, sanitizeOptions);

  // Safe to persist cleanComment in database
  res.json({ author: cleanAuthor, comment: cleanComment });
});`,
    recallHint: "Sanitize rich text with sanitize-html using strict tag whitelists; strip script, iframe, and inline event handlers to prevent Stored XSS.",
    interviewTip: "Explain why HTML escaping on output (e.g. React JSX `{data}`) is great, but defense-in-depth requires sanitization upon intake to protect non-React consumers (mobile apps, email notifications).",
    tags: ["xss", "sanitize-html", "stored-xss", "html-sanitizer", "security"]
  }),

  createCard({
    idNum: 93,
    category: "Input Validation & Sanitization",
    concept: "UUID / ObjectID Format Assertion and Parameter Guards",
    priority: "must-know",
    difficulty: "beginner",
    question: "Why should database record IDs in URL parameters be validated before querying the database, and how do you implement parameter guards?",
    quickAnswer: "Passing malformed IDs (e.g. invalid UUIDs or MongoDB ObjectIDs) directly to database drivers causes database driver syntax exceptions or unindexed table scans. Using parameter guards or `router.param()` validates ID formats immediately, returning HTTP 400 before touching the database.",
    detailedAnswer: "Benefits of Early ID Assertion:\n1. PostgreSQL throws `QueryFailedError: invalid input syntax for type uuid` if given a non-UUID string.\n2. MongoDB throws `BSONTypeError: Argument passed in must be a single String of 12 bytes or 24 hex characters`.\n3. Defends against NoSQL operator injection in route params.\n4. Saves database connection pool checkouts.",
    code: `const { z } = require('zod');

const UUIDSchema = z.string().uuid();
const MongoIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ObjectID');

// Reusable parameter guard middleware
function validateIdParam(paramName = 'id', schema = UUIDSchema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.params[paramName]);
    if (!result.success) {
      return res.status(400).json({
        error: 'Bad Request',
        message: \`Parameter '\${paramName}' must be a valid identifier\`
      });
    }
    next();
  };
}

// Route guarded with UUID validation
app.get('/api/invoices/:invoiceId', validateIdParam('invoiceId', UUIDSchema), async (req, res) => {
  // Guaranteed valid UUID: no database syntax errors!
  const invoice = await invoiceService.getById(req.params.invoiceId);
  res.json(invoice);
});`,
    recallHint: "Validate UUID and ObjectID formats in route params before database queries to prevent driver crashes and unindexed scans.",
    interviewTip: "Mention that catching invalid ID formats in route guards returns clean 400 Bad Requests rather than bubbling up as 500 Internal Server Errors.",
    tags: ["uuid-validation", "objectid", "route-guard", "sql-defense", "param-validation"]
  }),

  createCard({
    idNum: 94,
    category: "Input Validation & Sanitization",
    concept: "Nested Object and Array Payload Validation",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you validate complex nested objects and arrays of items with size boundaries in Express?",
    quickAnswer: "Use `z.array(ItemSchema)` with `.min()`, `.max()`, and `.nonempty()` bounds to prevent memory exhaustion from massive arrays. Combine with nested `z.object()` to validate tree structures such as shopping carts, invoices, or batch update payloads.",
    detailedAnswer: "Array Payload Security:\nAn attacker can submit an array with 1,000,000 objects in a single batch request, causing event loop starvation or memory exhaustion (Denial of Service).\n\nBest Practice:\nAlways enforce strict array size limits: `z.array(...).max(100)` to ensure batch endpoints remain within predictable resource constraints.",
    code: `const { z } = require('zod');

const OrderItemSchema = z.object({
  sku: z.string().regex(/^[A-Z]{3}-\\d{4}$/, 'SKU must match format ABC-1234'),
  quantity: z.number().int().min(1).max(50),
  priceCents: z.number().int().positive()
});

const BulkOrderSchema = z.object({
  customerId: z.string().uuid(),
  // Strict array bounds: minimum 1 item, maximum 50 items per order
  items: z.array(OrderItemSchema).min(1, 'Order must contain at least 1 item').max(50, 'Cannot exceed 50 items per order'),
  discountCode: z.string().trim().max(20).optional()
});

app.post('/api/orders/bulk', async (req, res, next) => {
  try {
    const order = BulkOrderSchema.parse(req.body);
    const result = await orderService.createBulk(order);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});`,
    recallHint: "Always bound array validations with .min() and .max() to prevent memory exhaustion from massive arrays.",
    interviewTip: "Explain that unbounded JSON arrays (`z.array(z.any())`) represent an easily exploitable Denial of Service vector on batch endpoints.",
    tags: ["array-validation", "nested-objects", "dos-prevention", "zod-array", "batch-api"]
  }),

  createCard({
    idNum: 95,
    category: "Input Validation & Sanitization",
    concept: "Custom Validation Rules and Async Validation (Uniqueness Checks)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you perform asynchronous validation (such as checking email uniqueness against a database) inside Express validation pipelines?",
    quickAnswer: "Using Zod's `.refine(async (val) => ...)` or `.superRefine()`, you can execute asynchronous database lookups during schema parsing. If the promise resolves to `false`, validation fails with a custom message. Route handlers invoke `await schema.parseAsync()` to resolve async validation rules.",
    detailedAnswer: "Asynchronous Validation Use Cases:\n- Checking if an email or username is already taken during registration.\n- Verifying that a coupon code exists and is active in the database.\n- Checking inventory availability.\n\nPerformance Note:\nRun cheap synchronous validations (regex, length, type checks) before async database refinements so malformed payloads are rejected instantly without querying the database.",
    code: `const { z } = require('zod');

const SignupSchema = z.object({
  username: z.string().min(3).max(20),
  email: z.string().email()
}).superRefine(async (data, ctx) => {
  // Database uniqueness check runs only after syntax validation passes
  const existingUser = await userRepository.findByEmail(data.email);

  if (existingUser) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Email address is already registered',
      path: ['email']
    });
  }
});

app.post('/api/auth/register', async (req, res, next) => {
  try {
    // parseAsync must be awaited for async refinement rules!
    const validatedData = await SignupSchema.parseAsync(req.body);
    const user = await userRepository.create(validatedData);
    res.status(201).json({ id: user.id, email: user.email });
  } catch (err) {
    next(err);
  }
});`,
    recallHint: "Use superRefine(async (data, ctx) => ...) with await schema.parseAsync() to perform async DB uniqueness checks.",
    interviewTip: "Highlight that unique database constraints (PostgreSQL `UNIQUE`) are still mandatory to prevent race conditions during concurrent signups.",
    tags: ["async-validation", "superRefine", "uniqueness-check", "database-validation", "zod"]
  }),

  createCard({
    idNum: 96,
    category: "Input Validation & Sanitization",
    concept: "Type-Safe Request Handlers with TypeScript and Zod Type Inference",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you achieve end-to-end type safety in Express route handlers using TypeScript and Zod?",
    quickAnswer: "Infer TypeScript types directly from Zod schemas using `z.infer<typeof Schema>`. Express `RequestHandler` generics can be typed with `<Params, ResBody, ReqBody, ReqQuery>`, ensuring compile-time type safety across `req.params`, `req.query`, and `req.body` that matches runtime validation exactly.",
    detailedAnswer: "Eliminating Type Drift:\nIn traditional TypeScript Express apps, developers write an `interface UserDTO` and a separate validator. Over time, the interface and runtime validator diverge, causing silent runtime bugs.\n\nSchema-Inferred Types:\n`type CreateUserInput = z.infer<typeof CreateUserSchema>;`\nThe schema is the single source of truth. If the schema changes, TypeScript compiler errors immediately flag any controllers or services that require updating.",
    code: `import { Request, Response, NextFunction, RequestHandler } from 'express';
import { z } from 'zod';

const UpdateProfileSchema = z.object({
  displayName: z.string().min(2),
  bio: z.string().max(160).optional()
});

// Infer TypeScript type directly from runtime schema
type UpdateProfileDTO = z.infer<typeof UpdateProfileSchema>;

interface Params {
  userId: string;
}

// Strongly typed Express RequestHandler
const updateProfileHandler: RequestHandler<Params, any, UpdateProfileDTO> = async (req, res) => {
  // req.params.userId is string
  // req.body is UpdateProfileDTO with full autocomplete!
  const { displayName, bio } = req.body;

  res.json({ success: true, updatedName: displayName });
};`,
    recallHint: "Derive TypeScript types via z.infer<typeof Schema>; pass types to RequestHandler<Params, ResBody, ReqBody, ReqQuery>.",
    interviewTip: "Explain how `z.infer` eliminates the need to maintain redundant TypeScript interfaces and guarantees compile-time types match runtime validation 100%.",
    tags: ["typescript", "type-safety", "z.infer", "RequestHandler", "single-source-of-truth"]
  })
];

module.exports = cards;
