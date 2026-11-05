module.exports = [
  {
    id: "exp-ex-01",
    title: "Production Express Application Factory with Graceful Shutdown",
    category: "Application Lifecycle",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a production application factory exporting an Express app and an HTTP server instance equipped with SIGTERM/SIGINT teardown handlers, connection draining, and watchdog timeouts.",
    conceptsCovered: [
      "Application Factory Pattern",
      "Graceful Shutdown",
      "SIGTERM & SIGINT",
      "Connection Draining",
      "Watchdog Timer"
    ],
    code: `const express = require('express');
const http = require('http');

function createApp() {
  const app = express();
  app.use(express.json());

  app.get('/health', (req, res) => res.json({ status: 'ok', uptime: process.uptime() }));
  app.get('/api/data', (req, res) => res.json({ message: 'Production API active' }));

  return app;
}

function startServer(port = 3000) {
  const app = createApp();
  const server = http.createServer(app);

  let isShuttingDown = false;

  // Intercept requests during shutdown
  app.use((req, res, next) => {
    if (isShuttingDown) {
      res.set('Connection', 'close');
      return res.status(503).json({ error: 'Server is shutting down' });
    }
    next();
  });

  const shutdown = async (signal) => {
    console.log(\`Received \${signal}. Draining in-flight connections...\`);
    isShuttingDown = true;

    server.close(() => {
      console.log('HTTP server closed. Exiting process cleanly.');
      process.exit(0);
    });

    // Safety watchdog: force-kill if draining hangs
    setTimeout(() => {
      console.error('Graceful shutdown timeout exceeded. Force exiting.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  server.listen(port, () => console.log(\`Server listening on port \${port}\`));
  return server;
}

if (require.main === module) {
  startServer(process.env.PORT || 3000);
}

module.exports = { createApp, startServer };`,
    breakdown: [
      {
        lineRange: "4-12",
        note: "createApp encapsulates app instantiation, enabling isolated unit testing without opening network sockets."
      },
      {
        lineRange: "18-24",
        note: "Rejects new incoming requests with 503 during teardown and instructs clients to close connections."
      },
      {
        lineRange: "26-38",
        note: "server.close drains active requests while a 10-second watchdog timer guarantees process exit."
      }
    ],
    expectedOutput: "Server listening on port 3000\nReceived SIGTERM. Draining in-flight connections...\nHTTP server closed. Exiting process cleanly."
  },

  {
    id: "exp-ex-02",
    title: "Distributed Request Correlation ID & Trace Propagation Middleware",
    category: "Observability & Tracing",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements middleware that extracts incoming X-Correlation-ID or X-Request-ID headers (or generates a crypto UUID), assigns it to req/res, and injects it into logs.",
    conceptsCovered: [
      "Correlation ID",
      "crypto.randomUUID",
      "Traceparent Header",
      "Structured Logging",
      "Response Headers"
    ],
    code: `const express = require('express');
const crypto = require('crypto');
const app = express();

function correlationMiddleware(req, res, next) {
  // Extract from client or upstream gateway, or generate fresh UUID
  const correlationId = req.get('x-correlation-id') || 
                        req.get('x-request-id') || 
                        crypto.randomUUID();

  // Attach to request context
  req.correlationId = correlationId;

  // Echo back in response header for client debugging
  res.setHeader('X-Correlation-ID', correlationId);

  // Scoped logger helper
  req.log = (level, message, meta = {}) => {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      correlationId,
      level,
      method: req.method,
      url: req.originalUrl,
      message,
      ...meta
    }));
  };

  next();
}

app.use(correlationMiddleware);

app.get('/api/orders/:id', (req, res) => {
  req.log('info', 'Fetching order record', { orderId: req.params.id });
  res.json({ orderId: req.params.id, status: 'Shipped' });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "5-11",
        note: "Extracts existing upstream correlation IDs or generates a cryptographically secure UUID v4."
      },
      {
        lineRange: "14-17",
        note: "Sets X-Correlation-ID on the response so frontend clients can correlate customer support tickets."
      },
      {
        lineRange: "19-31",
        note: "Injects correlationId into structured JSON log outputs for Datadog or ELK log aggregation."
      }
    ],
    expectedOutput: "{\"timestamp\":\"2026-11-04T00:00:00.000Z\",\"correlationId\":\"3f7b8c...\",\"level\":\"info\",\"message\":\"Fetching order record\",\"orderId\":\"99\"}"
  },

  {
    id: "exp-ex-03",
    title: "Zero-Downtime Socket Draining & Keep-Alive Synchronization with AWS ALB",
    category: "DevOps & Infrastructure",
    difficulty: "advanced",
    whatThisCodeCovers: "Aligns Node.js HTTP server keep-alive timeouts with reverse proxies (AWS ALB, Nginx) to eliminate sporadic 502 Bad Gateway errors caused by socket race conditions.",
    conceptsCovered: [
      "keepAliveTimeout",
      "headersTimeout",
      "AWS ALB 502 Race Condition",
      "server.closeIdleConnections",
      "TCP Sockets"
    ],
    code: `const express = require('express');
const http = require('http');

const app = express();
app.get('/ping', (req, res) => res.send('pong'));

const server = http.createServer(app);

// AWS ALB default idle timeout is 60 seconds.
// Node's keepAliveTimeout MUST exceed the ALB idle timeout.
// headersTimeout MUST exceed keepAliveTimeout.
server.keepAliveTimeout = 65000;  // 65 seconds
server.headersTimeout = 66000;    // 66 seconds
server.requestTimeout = 30000;    // 30 seconds max per request

function gracefulTeardown() {
  console.log('SIGTERM received: closing server...');

  server.close(() => {
    console.log('Active requests finished. Process exiting.');
    process.exit(0);
  });

  // Terminate idle keep-alive sockets immediately (Node 19+)
  if (typeof server.closeIdleConnections === 'function') {
    server.closeIdleConnections();
  }
}

process.on('SIGTERM', gracefulTeardown);

module.exports = { server, app };`,
    breakdown: [
      {
        lineRange: "11-14",
        note: "Sets keepAliveTimeout to 65s (exceeding ALB 60s) to prevent Node closing sockets right as ALB routes a request."
      },
      {
        lineRange: "16-24",
        note: "server.close stops accepting new connections and drains active in-flight requests."
      },
      {
        lineRange: "26-28",
        note: "server.closeIdleConnections instantly destroys persistent keep-alive sockets that have no active request."
      }
    ],
    expectedOutput: "SIGTERM received: closing server...\nActive requests finished. Process exiting."
  },

  {
    id: "exp-ex-04",
    title: "Liveness and Readiness Probes (/livez, /readyz) with DB Health Check",
    category: "DevOps & Infrastructure",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements Kubernetes-compliant /healthz/live and /healthz/ready endpoints with separate concerns to prevent cascading pod restart storms during database latency.",
    conceptsCovered: [
      "Kubernetes Probes",
      "Liveness (/livez)",
      "Readiness (/readyz)",
      "Cascading Restarts",
      "Database Health Verification"
    ],
    code: `const express = require('express');
const app = express();

let isReady = false;
let isShuttingDown = false;

// Mock database pool
const fakeDb = {
  ping: async () => {
    // Simulates quick SELECT 1 query
    return true;
  }
};

// 1. LIVENESS PROBE: Is process running and event loop responsive?
// NEVER check database in livez! If DB is slow, Kubernetes will restart all pods at once!
app.get('/healthz/live', (req, res) => {
  res.status(200).json({ status: 'alive', uptime: process.uptime() });
});

// 2. READINESS PROBE: Can this pod accept external user traffic?
app.get('/healthz/ready', async (req, res) => {
  if (isShuttingDown || !isReady) {
    return res.status(503).json({ status: 'unready', reason: 'warming up or shutting down' });
  }

  try {
    await fakeDb.ping();
    res.status(200).json({ status: 'ready', database: 'connected' });
  } catch (err) {
    // 503 removes pod from Ingress without restarting container
    res.status(503).json({ status: 'unready', error: err.message });
  }
});

// Simulate app warmup
setTimeout(() => { isReady = true; }, 100);

module.exports = app;`,
    breakdown: [
      {
        lineRange: "14-17",
        note: "Liveness probe only checks process responsiveness; failing liveness restarts the container."
      },
      {
        lineRange: "20-33",
        note: "Readiness probe checks DB dependencies; failing readiness removes pod from load balancer pool safely."
      }
    ],
    expectedOutput: "GET /healthz/live -> 200 { status: 'alive' }\nGET /healthz/ready -> 200 { status: 'ready', database: 'connected' }"
  },

  {
    id: "exp-ex-05",
    title: "Modular Sub-Application Mounting with Independent Settings & Middleware",
    category: "Architecture & Modularity",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates mounting independent Express sub-applications via app.use('/admin', adminApp), showcasing isolated settings, route hierarchies, and parent-child events.",
    conceptsCovered: [
      "Sub-Applications",
      "app.use() Mounting",
      "app.mountpath",
      "mount Event",
      "Isolated Settings"
    ],
    code: `const express = require('express');
const mainApp = express();
const adminApp = express();

// Configure independent sub-app settings
adminApp.set('title', 'Administration Portal');
adminApp.disable('x-powered-by');

// Sub-app specific middleware
adminApp.use((req, res, next) => {
  console.log(\`[Admin Sub-App] Authenticating admin path: \${req.baseUrl}\`);
  next();
});

adminApp.get('/dashboard', (req, res) => {
  res.json({
    appTitle: adminApp.get('title'),
    mountPath: adminApp.mountpath, // '/admin'
    url: req.originalUrl
  });
});

// Listen to mount lifecycle event
adminApp.on('mount', (parent) => {
  console.log(\`Admin app successfully mounted onto parent at: \${adminApp.mountpath}\`);
});

// Mount onto main application
mainApp.use('/admin', adminApp);

mainApp.get('/', (req, res) => res.send('Main App Home'));

module.exports = mainApp;`,
    breakdown: [
      {
        lineRange: "5-8",
        note: "adminApp has its own configuration settings completely isolated from mainApp."
      },
      {
        lineRange: "22-25",
        note: "The 'mount' event fires when the sub-application is registered onto the parent app."
      },
      {
        lineRange: "27-28",
        note: "Requests to /admin/dashboard are delegated seamlessly to adminApp handlers."
      }
    ],
    expectedOutput: "Admin app successfully mounted onto parent at: /admin\nGET /admin/dashboard -> { appTitle: 'Administration Portal', mountPath: '/admin' }"
  },

  {
    id: "exp-ex-06",
    title: "RESTful Resource Route Controller with app.route() & Method Chaining",
    category: "Routing & Route Engine",
    difficulty: "beginner",
    whatThisCodeCovers: "Uses Express's app.route() chaining to group GET, POST, PUT, and DELETE handlers on a single URI path, eliminating redundant route declarations and typo bugs.",
    conceptsCovered: [
      "app.route()",
      "Method Chaining",
      "RESTful Routing",
      "DRY Principles",
      "Route Grouping"
    ],
    code: `const express = require('express');
const app = express();
app.use(express.json());

const usersDb = new Map();

// Group multiple HTTP methods under a single path identifier
app.route('/api/users/:id')
  .all((req, res, next) => {
    // Common pre-handler: runs before GET, PUT, or DELETE
    const { id } = req.params;
    req.targetId = id;
    next();
  })
  .get((req, res) => {
    const user = usersDb.get(req.targetId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  })
  .put((req, res) => {
    const updated = { id: req.targetId, ...req.body };
    usersDb.set(req.targetId, updated);
    res.json(updated);
  })
  .delete((req, res) => {
    usersDb.delete(req.targetId);
    res.status(204).end();
  });

module.exports = app;`,
    breakdown: [
      {
        lineRange: "8-15",
        note: "app.route('/path').all() defines shared middleware executed across all chained HTTP verbs."
      },
      {
        lineRange: "16-29",
        note: "Chained .get(), .put(), and .delete() establish clean, readable REST operations for that resource."
      }
    ],
    expectedOutput: "PUT /api/users/42 -> 200 { id: '42', name: 'Alice' }\nGET /api/users/42 -> 200 { id: '42', name: 'Alice' }\nDELETE /api/users/42 -> 204 No Content"
  },

  {
    id: "exp-ex-07",
    title: "Nested Sub-Routers with mergeParams: true for Hierarchical Resources",
    category: "Routing & Route Engine",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates configuring child Express routers with mergeParams: true to inherit parameters from parent route prefixes in deeply nested REST hierarchies.",
    conceptsCovered: [
      "express.Router",
      "mergeParams: true",
      "Hierarchical Resources",
      "Parent Route Parameters",
      "Nested Sub-Routers"
    ],
    code: `const express = require('express');
const app = express();

// Parent Router: /organizations/:orgId
const orgRouter = express.Router();

// Child Router: /projects/:projectId
// CRUCIAL: mergeParams: true allows access to req.params.orgId inside projectRouter!
const projectRouter = express.Router({ mergeParams: true });

projectRouter.get('/', (req, res) => {
  // Accesses BOTH parent parameter (orgId) and child routes
  const { orgId } = req.params;
  res.json({ orgId, message: \`Listing projects for organization \${orgId}\` });
});

projectRouter.get('/:projectId', (req, res) => {
  const { orgId, projectId } = req.params;
  res.json({ orgId, projectId, status: 'Active' });
});

// Mount child router under parent path
orgRouter.use('/:orgId/projects', projectRouter);

// Mount parent router on app
app.use('/api/organizations', orgRouter);

module.exports = app;`,
    breakdown: [
      {
        lineRange: "8-9",
        note: "Without mergeParams: true, projectRouter would only see projectId; orgId would be undefined."
      },
      {
        lineRange: "11-20",
        note: "Handlers read both parent :orgId and child :projectId parameters transparently."
      },
      {
        lineRange: "22-25",
        note: "Mounts /organizations/:orgId/projects cleanly preserving clean architectural separation."
      }
    ],
    expectedOutput: "GET /api/organizations/acme/projects/p-100 -> 200 { orgId: 'acme', projectId: 'p-100', status: 'Active' }"
  },

  {
    id: "exp-ex-08",
    title: "Custom Parameter Preloading & Validation with router.param()",
    category: "Routing & Route Engine",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses router.param() to intercept route parameter occurrences once per request cycle, validate ID formats, fetch database models, and attach them to req.",
    conceptsCovered: [
      "router.param()",
      "Parameter Preloading",
      "UUID Validation",
      "Database Hydration",
      "DRY Handlers"
    ],
    code: `const express = require('express');
const router = express.Router();

// Mock database lookup
const findUserById = async (id) => {
  if (id === 'user_123') return { id: 'user_123', name: 'John Doe', role: 'admin' };
  return null;
};

// Parameter middleware for :userId
router.param('userId', async (req, res, next, userId) => {
  // 1. Validate parameter format
  if (!/^user_[a-zA-Z0-9]+$/.test(userId)) {
    return res.status(400).json({ error: 'Invalid user ID format' });
  }

  try {
    // 2. Pre-fetch model once
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // 3. Attach hydrated entity to req
    req.loadedUser = user;
    next();
  } catch (err) {
    next(err);
  }
});

// Handlers are 100% free of boilerplate ID checks or DB lookups!
router.get('/users/:userId', (req, res) => {
  res.json({ user: req.loadedUser });
});

router.delete('/users/:userId', (req, res) => {
  res.json({ message: \`Deleted user \${req.loadedUser.name}\` });
});

module.exports = router;`,
    breakdown: [
      {
        lineRange: "10-28",
        note: "router.param executes once per request containing :userId, validating format and preloading user."
      },
      {
        lineRange: "31-37",
        note: "Subsequent route handlers read req.loadedUser directly without repeating 404 checks or queries."
      }
    ],
    expectedOutput: "GET /users/bad-id -> 400 { error: 'Invalid user ID format' }\nGET /users/user_123 -> 200 { user: { id: 'user_123', name: 'John Doe' } }"
  },

  {
    id: "exp-ex-09",
    title: "Conditional Route Dispatching with next('route') and Role-Based Bypasses",
    category: "Routing & Route Engine",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses next('route') to skip remaining handlers within the current Route layer stack and pass control to subsequent matching route definitions.",
    conceptsCovered: [
      "next('route')",
      "Route Short-Circuiting",
      "Conditional Branching",
      "Specialized Handlers",
      "Route Stacks"
    ],
    code: `const express = require('express');
const app = express();

// First route definition for /reports/:id
app.get('/reports/:id', (req, res, next) => {
  const isVipUser = req.headers['x-vip-token'] === 'vip-secret';

  if (isVipUser) {
    console.log('VIP user detected: skipping standard report handler!');
    // next('route') jumps out of this route definition completely!
    return next('route');
  }

  // Standard user processing
  res.json({ reportId: req.params.id, tier: 'Standard', cached: true });
});

// Second route definition for the same /reports/:id path
app.get('/reports/:id', (req, res) => {
  // Only reached if next('route') was called above!
  res.json({
    reportId: req.params.id,
    tier: 'VIP',
    realTimeCalculated: true,
    unmetered: true
  });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "5-14",
        note: "When isVipUser is true, return next('route') bails out of the first route handler stack."
      },
      {
        lineRange: "18-26",
        note: "Express advances down the layer stack to the next route matching /reports/:id, executing VIP logic."
      }
    ],
    expectedOutput: "GET /reports/100 -> { tier: 'Standard', cached: true }\nGET /reports/100 (with VIP header) -> { tier: 'VIP', realTimeCalculated: true }"
  },

  {
    id: "exp-ex-10",
    title: "Express 5 Compliant Catch-All 404 Route with path-to-regexp v8",
    category: "Routing & Route Engine",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates configuring a catch-all 404 handler complying with Express 5 path-to-regexp v8 syntax, avoiding deprecated wildcard crashes.",
    conceptsCovered: [
      "Express 5 Routing",
      "path-to-regexp v8",
      "Catch-All 404",
      "Named Wildcard /{ *splat }",
      "HTTP 404 Envelope"
    ],
    code: `const express = require('express');
const app = express();

app.get('/api/users', (req, res) => res.json([{ id: 1, name: 'Alice' }]));
app.get('/api/health', (req, res) => res.send('OK'));

// EXPRESS 4 LEGACY (WILL CRASH IN EXPRESS 5!):
// app.all('*', (req, res) => res.status(404).send('Not Found'));

// EXPRESS 5 MODERN COMPLIANT SYNTAX:
// path-to-regexp v8 requires named wildcard parameters or middleware without path
app.all('/{*splat}', (req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: \`Cannot \${req.method} \${req.originalUrl}\`,
      matchedSplat: req.params.splat
    }
  });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "7-8",
        note: "Legacy app.all('*') crashes in Express 5 with TypeError: Unexpected *."
      },
      {
        lineRange: "12-21",
        note: "app.all('/{*splat}') is fully path-to-regexp v8 compliant, capturing unmatched paths into req.params.splat."
      }
    ],
    expectedOutput: "GET /api/unknown -> 404 { error: { code: 'ROUTE_NOT_FOUND', message: 'Cannot GET /api/unknown' } }"
  }
];
