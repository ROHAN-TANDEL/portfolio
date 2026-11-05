const { createCard } = require("../exp_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 49,
    category: "Error Handling Architecture",
    concept: "The 4-Argument Error Middleware Signature (err, req, res, next) and Arity Check",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why must Express error-handling middleware have exactly four parameters `(err, req, res, next)`, and what happens if you omit `next`?",
    quickAnswer: "Express inspects function arity using `fn.length` when registering middleware. Only functions with `fn.length === 4` are recognized as error handlers and invoked during the error pipeline. If you declare `(err, req, res)` without `next`, `fn.length` is 3, causing Express to mistake it for standard middleware, skipping it entirely during error propagation.",
    detailedAnswer: "In JavaScript, `Function.prototype.length` returns the number of formally declared arguments. Express's internal router checks:\n- If `fn.length === 4`, the middleware is treated as an error handler `(err, req, res, next)`.\n- If `fn.length < 4`, it is treated as normal request middleware `(req, res, next)`.\n\nEven if your error-handling function does not actively invoke `next()`, you MUST retain `next` in the parameter list. Omitting it causes Express to treat `err` as `req`, `req` as `res`, and `res` as `next`, breaking the entire request flow and failing to catch errors.",
    code: `const express = require('express');
const app = express();

// WRONG: fn.length is 3! Express will NOT recognize this as an error handler
// app.use((err, req, res) => { res.status(500).send('Broken'); });

// CORRECT: fn.length is exactly 4. Express detects it as error middleware
app.use((err, req, res, next) => {
  console.error('[Error Pipeline Triggered]:', err.message);

  if (res.headersSent) {
    return next(err); // Delegate to default Express error handler if stream opened
  }

  res.status(err.statusCode || 500).json({
    success: false,
    error: {
      message: err.message || 'Internal Server Error'
    }
  });
});`,
    recallHint: "fn.length === 4 defines an error handler in Express; omitting unused 'next' changes length to 3, completely breaking error interception.",
    interviewTip: "This is one of the most frequent Express interview questions. Point out that linters like ESLint might warn about unused `next`, so use a lint disable comment rather than removing the parameter.",
    tags: ["error-handling", "fn.length", "arity", "middleware", "express-internals"]
  }),

  createCard({
    idNum: 50,
    category: "Error Handling Architecture",
    concept: "Synchronous vs Asynchronous Error Propagation (Express 4 vs Express 5)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does error propagation differ between synchronous and asynchronous code in Express 4 vs Express 5?",
    quickAnswer: "In Express 4, synchronous errors thrown in handlers are caught automatically, but errors inside promises or async functions cause unhandled promise rejections unless explicitly forwarded via `next(err)` or wrapped with `express-async-errors`. Express 5 natively catches rejected promises returned from `async (req, res, next)` handlers and routes them to error middleware automatically.",
    detailedAnswer: "Express 4 Design:\nWhen an `async` function throws an error, it returns a rejected Promise. Express 4 does not inspect the returned Promise, so the rejection goes unhandled, potentially crashing the Node process if unhandled rejections terminate Node.\n\nExpress 5 Modernization:\nExpress 5 inspects return values from middleware and route handlers. If a handler returns a Promise, Express attaches `.catch(next)`, making `async/await` syntax completely native and safe without boilerplate try-catch blocks or wrapper packages.",
    code: `// EXPRESS 4 REQUIREMENT:
app.get('/api/users/:id', async (req, res, next) => {
  try {
    const user = await database.findUser(req.params.id);
    if (!user) throw new NotFoundError('User not found');
    res.json(user);
  } catch (err) {
    next(err); // Express 4 REQUIRED explicit next(err)
  }
});

// EXPRESS 5 (OR WITH express-async-errors in Express 4):
app.get('/api/users/:id', async (req, res) => {
  // Thrown errors or rejected promises are AUTOMATICALLY caught and piped to next(err)
  const user = await database.findUser(req.params.id);
  if (!user) throw new NotFoundError('User not found');
  res.json(user);
});`,
    recallHint: "Express 4 requires next(err) in async catch blocks; Express 5 natively catches rejected promises and pipes them to error middleware.",
    interviewTip: "Demonstrate understanding of the evolution: in Express 4, developers used helper wrappers like `fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)`. Express 5 makes this built-in.",
    tags: ["express-5", "async-errors", "promise-rejection", "next-err", "error-propagation"]
  }),

  createCard({
    idNum: 51,
    category: "Error Handling Architecture",
    concept: "Operational Errors vs Programmer Bugs and Process Crash Policies",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the distinction between Operational Errors and Programmer Bugs, and how should an Express server handle each?",
    quickAnswer: "Operational errors are expected runtime anomalies (invalid user input, 404 not found, database network timeout, expired token) that must be handled gracefully by returning structured 4xx/5xx responses. Programmer bugs are unexpected programming mistakes (undefined property access, syntax errors, memory corruption) that render process state unreliable, requiring logging, alerting, and clean process restart.",
    detailedAnswer: "Operational Errors:\n- Known failure modes occurring during standard operation.\n- Marked with `isOperational = true` on custom error classes.\n- Handled within request pipeline: return appropriate HTTP status and message to client.\n\nProgrammer Bugs:\n- E.g., `TypeError: Cannot read properties of undefined`.\n- The system has entered an indeterminate state; continuing to run could corrupt data, leak connections, or cause inconsistent transactions.\n- Best Practice: Log critical diagnostics to error tracking (Sentry, Datadog), close active connections gracefully, and exit with non-zero exit code (`process.exit(1)`), allowing orchestrators (Kubernetes, PM2) to spawn a fresh instance.",
    code: `class AppError extends Error {
  constructor(message, statusCode, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Global Express Error Middleware
app.use((err, req, res, next) => {
  if (err.isOperational) {
    // Graceful response for known operational anomalies
    return res.status(err.statusCode).json({
      status: 'fail',
      message: err.message
    });
  }

  // Programmer bug or unexpected infrastructure crash
  console.error('[CRITICAL BUG]', err);

  // Return generic 500 to client without leaking internals
  res.status(500).json({
    status: 'error',
    message: 'An unexpected internal error occurred'
  });

  // In production, signal orchestrator to restart if state is corrupted
  // gracefulShutdown(1);
});`,
    recallHint: "Operational errors = predictable, handle gracefully (4xx/5xx); Programmer bugs = unexpected, log deeply, alert, and restart worker safely.",
    interviewTip: "Cite Joyent's standard Node.js error-handling philosophy: never swallow unknown programmer errors, because an unknown bug means your process memory may be corrupted.",
    tags: ["operational-errors", "programmer-bugs", "resilience", "process-exit", "app-error"]
  }),

  createCard({
    idNum: 52,
    category: "Error Handling Architecture",
    concept: "Custom Error Hierarchy (AppError, NotFoundError, UnauthorizedError)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you design a clean, extensible custom error hierarchy for enterprise Express applications?",
    quickAnswer: "Create a base `AppError` extending JavaScript's `Error`, containing `statusCode`, `status`, `isOperational`, and error code fields. Then subclass specific semantic errors like `BadRequestError` (400), `UnauthorizedError` (401), `ForbiddenError` (403), and `NotFoundError` (404).",
    detailedAnswer: "A clean error hierarchy prevents magic status numbers across controllers. Service layers can throw domain-specific errors without any dependency on Express `res` or HTTP concepts. The global error middleware inspects the error instance type and serializes it cleanly.\n\nUsing `Error.captureStackTrace(this, this.constructor)` ensures the stack trace points directly to where the error was thrown, omitting constructor internal lines.",
    code: `class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = \`\${statusCode}\`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class BadRequestError extends AppError {
  constructor(message = 'Bad Request', details = null) {
    super(message, 400);
    this.details = details;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(\`\${resource} not found\`, 404);
  }
}

// Controller throws clean semantic error without touching res
app.get('/api/users/:id', async (req, res, next) => {
  const user = await userRepository.findById(req.params.id);
  if (!user) {
    throw new NotFoundError('User');
  }
  res.json({ success: true, data: user });
});`,
    recallHint: "Base AppError with statusCode and isOperational; subclass into NotFoundError, UnauthorizedError, and BadRequestError.",
    interviewTip: "Emphasize how custom error hierarchies decouple business services from Express HTTP constructs. Services throw domain errors, and Express error middleware translates them into HTTP statuses.",
    tags: ["custom-errors", "app-error", "oop", "error-hierarchy", "clean-architecture"]
  }),

  createCard({
    idNum: 53,
    category: "Error Handling Architecture",
    concept: "Express Error Pipeline Ordering and Default Fallback Error Handler",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Where must error middleware be registered in the Express pipeline, and what is Express's built-in fallback error handler?",
    quickAnswer: "Error-handling middleware MUST be mounted after all route handlers and standard middleware. If no custom error middleware intercepts the error, Express falls back to its built-in default error handler, which prints the stack trace in development (or generic 500 in production) and terminates the response.",
    detailedAnswer: "Middleware execution is sequential:\n1. Global pre-middlewares (CORS, body parsers, logging).\n2. Application route definitions.\n3. 404 Catch-All middleware for unmatched routes.\n4. Error-handling middleware `(err, req, res, next)` mounted DEAD LAST.\n\nIf you mount an error handler before a route, any error thrown inside that route skips the error handler because the request has already passed that point in the pipeline.\n\nExpress's built-in handler checks `res.headersSent`. If true, it terminates the stream; if false, it sets status 500 and renders HTML or JSON error output.",
    code: `const express = require('express');
const app = express();

// 1. Pre-middleware
app.use(express.json());

// 2. Application routes
app.get('/api/data', (req, res) => {
  throw new Error('Something went wrong!');
});

// 3. Catch-all for unmatched routes (creates 404 error)
app.use((req, res, next) => {
  next(new NotFoundError(\`Cannot \${req.method} \${req.originalUrl}\`));
});

// 4. Custom Error Middleware - MUST BE LAST!
app.use((err, req, res, next) => {
  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: {
      message: err.message,
      statusCode: status
    }
  });
});`,
    recallHint: "Error middleware must always be mounted last, right after the 404 handler; placing it before routes leaves errors unintercepted.",
    interviewTip: "Explain why the 404 handler comes before the error handler: a 404 is not a thrown exception; it is simply the natural end of the route pipeline when no handler matched, which constructs a NotFoundError and calls `next(err)`.",
    tags: ["middleware-order", "error-pipeline", "default-error-handler", "404-handler"]
  }),

  createCard({
    idNum: 54,
    category: "Error Handling Architecture",
    concept: "Safe Stack Trace Sanitization and Environment-Based Error Disclosure",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why is leaking raw stack traces to clients dangerous in production, and how do you implement environment-based error disclosure?",
    quickAnswer: "Raw stack traces expose internal directory structures, server filenames, database credentials, dependency versions, and software architecture to attackers, facilitating targeted exploits. In production, error middleware must sanitize responses, returning only user-safe generic messages while logging the full trace internally.",
    detailedAnswer: "Information Disclosure (OWASP Top 10):\nExposing `err.stack` reveals:\n- Cloud file paths (e.g. `/home/ubuntu/app/services/db.js`).\n- Database vendor, query structure, and table schemas.\n- Third-party packages and exact library versions with known CVEs.\n\nBest Practice:\nCheck `process.env.NODE_ENV`:\n- In `development`, return full `err.message`, `err.stack`, and detailed validation payloads for rapid debugging.\n- In `production`, return sanitized messages and an opaque error reference code (`errorId` / `correlationId`) that the user can report to support.",
    code: `app.use((err, req, res, next) => {
  const isProd = process.env.NODE_ENV === 'production';
  const correlationId = req.get('X-Correlation-ID') || crypto.randomUUID();

  // Always log full stack trace to secure server logging aggregator
  console.error(\`[Error \${correlationId}]:\`, err.stack || err);

  const statusCode = err.statusCode || 500;

  if (isProd) {
    // Production: sanitized, safe response
    res.status(statusCode).json({
      success: false,
      errorId: correlationId,
      message: err.isOperational ? err.message : 'Internal Server Error'
    });
  } else {
    // Development: rich debugging information
    res.status(statusCode).json({
      success: false,
      message: err.message,
      errorId: correlationId,
      stack: err.stack,
      error: err
    });
  }
});`,
    recallHint: "Never expose err.stack in production; return sanitized messages and a correlation ID, keeping full traces in server logs.",
    interviewTip: "Highlight that returning a correlation ID or error UUID bridges user support tickets with internal Datadog/ELK logs without leaking infrastructure secrets.",
    tags: ["security", "stack-trace", "information-disclosure", "owasp", "sanitization"]
  }),

  createCard({
    idNum: 55,
    category: "Error Handling Architecture",
    concept: "Handling unhandledRejection and uncaughtException in Express Apps",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do `process.on('unhandledRejection')` and `process.on('uncaughtException')` relate to Express, and what is the proper recovery strategy?",
    quickAnswer: "They are global process-level safety nets for errors that escape Express route handlers entirely (such as background timers, unresolved unpiped promises, or initialization bugs). Because the process state may be corrupted, the only safe strategy is to log the fatal error, close active connections gracefully, and terminate the worker.",
    detailedAnswer: "1. `uncaughtException`: Fired when a synchronous exception bubbles up without a `try/catch`. The event loop stack is unwound and memory integrity cannot be guaranteed. Node docs explicitly mandate exiting the process.\n2. `unhandledRejection`: Fired when a Promise is rejected without a `.catch()` handler. In modern Node.js versions (v16+), unhandled rejections terminate the process by default.\n\nNeither of these events should be used to 'resume normal operation'. They indicate fatal server faults.",
    code: `// Catch unhandled promise rejections outside Express request lifecycles
process.on('unhandledRejection', (reason, promise) => {
  console.error('[CRITICAL UNHANDLED REJECTION]:', reason);
  // Trigger graceful exit
  initiateGracefulShutdown(1);
});

// Catch synchronous exceptions that escaped event loop
process.on('uncaughtException', (error) => {
  console.error('[CRITICAL UNCAUGHT EXCEPTION]:', error);
  // Immediate or short-delay exit to prevent corrupted execution
  initiateGracefulShutdown(1);
});

function initiateGracefulShutdown(exitCode) {
  server.close(() => {
    console.log('HTTP server closed. Exiting process.');
    process.exit(exitCode);
  });

  // Force exit if connections do not close within 10 seconds
  setTimeout(() => {
    console.error('Forced shutdown due to timeout');
    process.exit(exitCode);
  }, 10000).unref();
}`,
    recallHint: "unhandledRejection and uncaughtException are process-level last resorts; log diagnostics, close server gracefully, and exit non-zero.",
    interviewTip: "Never attempt to swallow `uncaughtException` and keep serving traffic. Once an uncaught exception occurs, Node internal references and memory can be in an undefined state.",
    tags: ["uncaughtException", "unhandledRejection", "process-events", "crash-policy", "stability"]
  }),

  createCard({
    idNum: 56,
    category: "Error Handling Architecture",
    concept: "Graceful Shutdown Lifecycle on Fatal Errors and SIGTERM/SIGINT",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you implement zero-downtime graceful shutdown in an Express application when receiving SIGTERM or encountering fatal errors?",
    quickAnswer: "Upon receiving `SIGTERM` (from Kubernetes/Docker) or encountering a fatal error: 1. Stop accepting new HTTP connections via `server.close()`. 2. Drain active in-flight HTTP requests. 3. Close database connection pools and Redis clients. 4. Set a safety timeout (e.g. 15-30s) to force-kill hung connections if draining stalls.",
    detailedAnswer: "In containerized environments (Kubernetes pods):\n1. Orchestrator sends `SIGTERM` when rolling out a deployment or scaling down.\n2. If the application terminates immediately with `process.exit(0)`, active user transactions are aborted, resulting in HTTP 502/504 errors.\n3. Graceful shutdown flow:\n   - Express server ceases accepting incoming TCP connections.\n   - In-flight requests complete naturally.\n   - Database and cache connections are closed cleanly.\n   - Worker exits with code 0.\n   - A watchdog timer ensures the process does not hang indefinitely.",
    code: `const http = require('http');
const express = require('express');
const app = express();
const server = http.createServer(app);

let isShuttingDown = false;

// Middleware rejecting new requests during draining phase
app.use((req, res, next) => {
  if (isShuttingDown) {
    res.set('Connection', 'close');
    return res.status(503).json({ error: 'Server is shutting down' });
  }
  next();
});

async function shutdown(signal) {
  console.log(\`Received \${signal}. Starting graceful termination...\`);
  isShuttingDown = true;

  // 1. Stop accepting new network connections
  server.close(async () => {
    console.log('HTTP server closed to new connections.');

    try {
      // 2. Disconnect database pools and cache
      await dbPool.end();
      await redisClient.quit();
      console.log('All persistence pools closed.');
      process.exit(0);
    } catch (err) {
      console.error('Error during teardown:', err);
      process.exit(1);
    }
  });

  // 3. Safety watchdog: force termination if requests stall
  setTimeout(() => {
    console.error('Graceful shutdown timeout exceeded. Forcing exit.');
    process.exit(1);
  }, 20000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));`,
    recallHint: "Graceful shutdown: server.close() -> drain active requests -> close DB/cache pools -> exit with safety watchdog timeout.",
    interviewTip: "Explain why `setTimeout().unref()` is used: `unref()` prevents the watchdog timer from keeping the Node event loop alive if all active work finishes earlier.",
    tags: ["graceful-shutdown", "sigterm", "sigint", "kubernetes", "connection-draining"]
  }),

  createCard({
    idNum: 57,
    category: "Error Handling Architecture",
    concept: "Mapping Database Driver Errors (Postgres 23505, Mongo E11000) to HTTP Codes",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How should Express error-handling middleware translate raw database driver errors into clean HTTP responses?",
    quickAnswer: "Database drivers throw raw error codes (e.g. PostgreSQL `23505` unique violation, `23503` foreign key violation; MongoDB `11000` duplicate key). Error middleware should inspect `err.code`, translate them to appropriate HTTP statuses (409 Conflict, 400 Bad Request), and format user-friendly messages without exposing raw SQL or schema internals.",
    detailedAnswer: "Exposing raw database error objects leaks column names, constraint identifiers, and SQL table structures to clients.\n\nError Mapping Pattern:\n- PostgreSQL `23505` / MongoDB `11000` -> HTTP `409 Conflict` ('Resource already exists').\n- PostgreSQL `23503` -> HTTP `400 Bad Request` ('Referenced resource does not exist').\n- PostgreSQL `22P02` (Invalid text representation / UUID mismatch) -> HTTP `400 Bad Request` ('Invalid ID format').\n- Network / connection timeout -> HTTP `503 Service Unavailable`.",
    code: `function handleDatabaseErrors(err) {
  // PostgreSQL Unique Violation
  if (err.code === '23505') {
    const field = err.detail ? err.detail.match(/\\((.*?)\\)/)?.[1] : 'Field';
    return new AppError(\`\${field} already exists. Please use another value.\`, 409);
  }

  // PostgreSQL Foreign Key Violation
  if (err.code === '23503') {
    return new AppError('Referenced related entity does not exist.', 400);
  }

  // MongoDB Duplicate Key Error
  if (err.code === 11000) {
    const key = Object.keys(err.keyValue || {})[0];
    return new AppError(\`Duplicate value for '\${key}'.\`, 409);
  }

  return err; // Return unmodified if not recognized
}

// Global error handler
app.use((err, req, res, next) => {
  const error = handleDatabaseErrors(err);
  const status = error.statusCode || 500;
  res.status(status).json({
    success: false,
    message: error.message || 'Database transaction error'
  });
});`,
    recallHint: "Translate raw driver error codes (23505 -> 409 Conflict, 23503 -> 400 Bad Request) to protect database schemas and provide clear feedback.",
    interviewTip: "Demonstrate that mapping database errors belongs in error middleware or repository mappers, keeping controllers completely clean of SQL error code checks.",
    tags: ["database-errors", "postgres-23505", "http-409", "error-mapping", "mongo-11000"]
  }),

  createCard({
    idNum: 58,
    category: "Error Handling Architecture",
    concept: "Zod and Joi Validation Error Transformation in Error Middleware",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you catch and transform schema validation errors (from Zod or Joi) into standardized 400 Bad Request responses?",
    quickAnswer: "Validation libraries throw structured errors (such as `ZodError` or Joi `ValidationError`) containing arrays of failed path assertions. Error middleware detects `err instanceof ZodError`, formats the nested issues into a clean `{ field, message }` array, and returns HTTP 400 Bad Request.",
    detailedAnswer: "Raw validation error objects can be thousands of characters long with verbose AST metadata. Clients and frontend forms require a concise, consistent structure: an array of failed fields and human-readable error messages.\n\nBy handling validation errors centrally in the global error middleware, route handlers remain lean and need only call `schema.parse(req.body)` without repetitive per-route try-catch logic.",
    code: `const { ZodError } = require('zod');

// Error transformation middleware
app.use((err, req, res, next) => {
  // Check if error originated from Zod schema validation
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map(issue => ({
      field: issue.path.join('.'),
      rule: issue.code,
      message: issue.message
    }));

    return res.status(400).json({
      success: false,
      error: 'Validation Failed',
      issues: formattedErrors
    });
  }

  // Pass non-validation errors down the chain
  next(err);
});`,
    recallHint: "Detect ZodError or Joi ValidationError in central error middleware and format issues into { field, message } with HTTP 400.",
    interviewTip: "Emphasize that using `err instanceof ZodError` ensures full type safety in TypeScript Express apps and prevents duplicating validation response logic across 50+ controllers.",
    tags: ["zod", "joi", "validation-error", "http-400", "error-formatting"]
  }),

  createCard({
    idNum: 59,
    category: "Error Handling Architecture",
    concept: "Handling Header-Sent Edge Cases (res.headersSent) in Error Handlers",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why must error middleware check `res.headersSent` before sending an error response, and what must it do if headers are already sent?",
    quickAnswer: "If an error occurs after headers have already been transmitted to the client (for example, halfway through streaming a file or SSE connection), attempting `res.status(500).json(...)` throws `ERR_HTTP_HEADERS_SENT`. When `res.headersSent` is true, the error middleware must call `next(err)` to allow Express's default handler to close the socket and abort the stream safely.",
    detailedAnswer: "HTTP headers are sent immediately when:\n- `res.writeHead()` is called.\n- The first chunk of `res.write()` or `stream.pipe(res)` is flushed over the TCP socket.\n\nIf a database cursor or stream fails after 2MB of a 10MB transfer, the client has already received `HTTP/1.1 200 OK`. You cannot retroactively change the status code to 500. Attempting to do so crashes the process with `Error [ERR_HTTP_HEADERS_SENT]: Cannot set headers after they are sent to the client`.\n\nExpress documentation explicitly states: delegate to default error handler via `if (res.headersSent) return next(err);` which terminates the socket cleanly.",
    code: `app.use((err, req, res, next) => {
  // CRITICAL CHECK: Were HTTP headers already committed to the socket?
  if (res.headersSent) {
    console.warn('[Error After Headers Sent]: Socket closing cleanly via default handler');
    return next(err); // Delegates to Express default handler to destroy connection
  }

  // Safe to set headers and send clean JSON response
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});`,
    recallHint: "If res.headersSent is true, call return next(err) immediately; never call res.status() or res.json() once headers are flushed.",
    interviewTip: "This is a prime interview gotcha for full-stack and streaming architectures. Mentioning `if (res.headersSent) return next(err)` shows real-world production experience with Node streams.",
    tags: ["res.headersSent", "ERR_HTTP_HEADERS_SENT", "streams", "edge-cases", "express-internals"]
  }),

  createCard({
    idNum: 60,
    category: "Error Handling Architecture",
    concept: "Centralized Audit Logging and Telemetry for Unhandled Server Errors",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you integrate enterprise structured logging (Pino/Winston) and APM telemetry into the Express error middleware?",
    quickAnswer: "Enterprise error middleware captures rich telemetry: HTTP method, URL, status code, user ID, tenant ID, request ID/traceparent, request duration, IP address, and complete error stack. This is serialized into structured JSON logs for log aggregators (Elasticsearch, Datadog) and forwarded to APM/Sentry with appropriate error severity levels.",
    detailedAnswer: "In production distributed systems, unstructured string logs (`console.error('failed')`) cannot be queried, filtered, or alerted on efficiently.\n\nStructured error telemetry attaches contextual metadata:\n1. Trace context (`req.headers['traceparent']`, `x-request-id`).\n2. User/Tenant identification without logging sensitive PII (passwords, credit cards, auth tokens).\n3. Severity classification: 4xx warnings vs 5xx errors requiring PagerDuty alerts.\n4. APM integration: `Sentry.captureException(err)` or OpenTelemetry span recording.",
    code: `const pino = require('pino');
const logger = pino({ level: 'info' });

app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const is5xx = statusCode >= 500;

  const logPayload = {
    correlationId: req.correlationId || req.get('x-request-id'),
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userId: req.user?.id,
    statusCode,
    errorMessage: err.message,
    stack: is5xx ? err.stack : undefined
  };

  if (is5xx) {
    logger.error(logPayload, 'Unhandled Server Error');
    // Sentry.captureException(err, { extra: logPayload });
  } else {
    logger.warn(logPayload, 'Client Request Anomaly');
  }

  if (res.headersSent) return next(err);

  res.status(statusCode).json({
    success: false,
    message: is5xx ? 'An unexpected error occurred' : err.message,
    requestId: logPayload.correlationId
  });
});`,
    recallHint: "Log structured JSON with correlationId, userId, route, and stack; warn on 4xx anomalies and trigger alerts/APM captures on 5xx errors.",
    interviewTip: "Highlight the importance of PII masking in error logs: ensure authorization headers, cookies, and sensitive payload keys (passwords, SSNs) are sanitized before shipping logs to Datadog or ELK.",
    tags: ["structured-logging", "telemetry", "pino", "apm", "sentry", "observability"]
  })
];

module.exports = cards;
