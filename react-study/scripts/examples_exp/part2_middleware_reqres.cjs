module.exports = [
  {
    id: "exp-ex-11",
    title: "High-Performance Request Timing & Structured Access Logger via res.on('finish')",
    category: "Middleware Pipelines",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a production HTTP access logger calculating exact response latency using process.hrtime.bigint() and res.on('finish') without blocking the event loop.",
    conceptsCovered: [
      "res.on('finish')",
      "process.hrtime.bigint()",
      "Response Latency",
      "Structured JSON Logging",
      "Non-Blocking I/O"
    ],
    code: `const express = require('express');
const app = express();

function accessLogger(req, res, next) {
  // Capture high-resolution nanosecond timestamp
  const startTime = process.hrtime.bigint();

  // Listen for socket completion
  res.on('finish', () => {
    const elapsedNs = process.hrtime.bigint() - startTime;
    const durationMs = Number(elapsedNs) / 1e6;

    const logEntry = {
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Number(durationMs.toFixed(2)),
      contentLength: res.get('content-length') || 0,
      ip: req.ip
    };

    console.log(JSON.stringify(logEntry));
  });

  next();
}

app.use(accessLogger);

app.get('/api/slow', async (req, res) => {
  await new Promise(r => setTimeout(r, 50));
  res.json({ delayed: true });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "5-6",
        note: "Captures start time using process.hrtime.bigint() with sub-millisecond precision."
      },
      {
        lineRange: "9-21",
        note: "res.on('finish') executes after HTTP headers and body bytes have completely flushed to the socket."
      }
    ],
    expectedOutput: "{\"timestamp\":\"...\",\"method\":\"GET\",\"path\":\"/api/slow\",\"status\":200,\"durationMs\":51.24,\"contentLength\":\"16\"}"
  },

  {
    id: "exp-ex-12",
    title: "AsyncLocalStorage Execution Context for Ambient Per-Request Storage",
    category: "Context & State",
    difficulty: "advanced",
    whatThisCodeCovers: "Uses Node's AsyncLocalStorage to store per-request trace metadata (user, correlationId, tenant) that is accessible anywhere across services without passing req.",
    conceptsCovered: [
      "AsyncLocalStorage",
      "Execution Context",
      "Ambient State",
      "Zero Parameter Drilling",
      "Async Hooks"
    ],
    code: `const express = require('express');
const { AsyncLocalStorage } = require('async_hooks');

const requestContext = new AsyncLocalStorage();
const app = express();

// Middleware initializing ambient execution context
app.use((req, res, next) => {
  const store = {
    traceId: req.get('x-trace-id') || crypto.randomUUID(),
    userId: req.get('x-user-id') || 'anonymous',
    startTime: Date.now()
  };

  // Run the remaining async call tree inside this isolated store
  requestContext.run(store, () => {
    next();
  });
});

// Deep service layer function (notice: NO req parameter!)
class PaymentService {
  async processPayment(amount) {
    const store = requestContext.getStore();
    console.log(\`[PaymentService] TraceId: \${store.traceId} processing $\${amount} for user \${store.userId}\`);
    return { success: true, txnId: 'txn_999', traceId: store.traceId };
  }
}

const paymentService = new PaymentService();

app.post('/api/pay', async (req, res) => {
  const result = await paymentService.processPayment(100);
  res.json(result);
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "4-5",
        note: "Creates an AsyncLocalStorage instance for managing per-request async execution context."
      },
      {
        lineRange: "7-18",
        note: "requestContext.run wraps the rest of the HTTP lifecycle, isolating store data per request."
      },
      {
        lineRange: "21-27",
        note: "Deep business services read store context directly without receiving Express req or res."
      }
    ],
    expectedOutput: "[PaymentService] TraceId: 3a1f... processing $100 for user anonymous"
  },

  {
    id: "exp-ex-13",
    title: "Configurable Higher-Order Middleware Factory with Dynamic Options",
    category: "Middleware Pipelines",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a reusable middleware factory function accepting configuration options (e.g. required headers, allowed roles, caching flags) and returning specialized Express middleware.",
    conceptsCovered: [
      "Middleware Factory",
      "Higher-Order Functions",
      "Closure Scope",
      "Dynamic Configuration",
      "Declarative Routing"
    ],
    code: `const express = require('express');
const app = express();

// Middleware Factory: Returns tailored middleware based on options
function enforceHeaders(options = {}) {
  const { required = [], prefix = 'X-' } = options;

  return (req, res, next) => {
    const missing = [];

    for (const header of required) {
      const fullHeaderName = header.startsWith(prefix) ? header : \`\${prefix}\${header}\`;
      if (!req.get(fullHeaderName)) {
        missing.push(fullHeaderName);
      }
    }

    if (missing.length > 0) {
      return res.status(400).json({
        error: 'Missing required headers',
        missingHeaders: missing
      });
    }

    next();
  };
}

// Route with custom required headers
app.post('/api/enterprise-sync', 
  enforceHeaders({ required: ['Tenant-ID', 'Sync-Token'] }), 
  (req, res) => {
    res.json({ message: 'Headers verified, sync initialized' });
  }
);

module.exports = app;`,
    breakdown: [
      {
        lineRange: "5-26",
        note: "Higher-order function encapsulates configuration options within closure scope."
      },
      {
        lineRange: "29-34",
        note: "Applied declaratively to route pipelines with custom required headers."
      }
    ],
    expectedOutput: "POST /api/enterprise-sync (missing headers) -> 400 { missingHeaders: ['X-Tenant-ID', 'X-Sync-Token'] }"
  },

  {
    id: "exp-ex-14",
    title: "Raw Body Buffer Retention for Webhook Cryptographic HMAC Verification",
    category: "Security & Webhooks",
    difficulty: "advanced",
    whatThisCodeCovers: "Configures express.json() with a verify callback to preserve the unparsed raw Buffer alongside parsed JSON, enabling Stripe/GitHub HMAC SHA-256 signature verification.",
    conceptsCovered: [
      "express.json({ verify })",
      "Raw Body Buffer",
      "Webhook Signatures",
      "HMAC-SHA256",
      "Stripe Webhook Defense"
    ],
    code: `const express = require('express');
const crypto = require('crypto');
const app = express();

// Retain raw Buffer on req.rawBody during JSON body parsing
app.use(express.json({
  verify: (req, res, buf) => {
    // Preserve the exact byte sequence received over the TCP stream
    req.rawBody = buf;
  }
}));

const WEBHOOK_SECRET = 'whsec_test_secret_key_123';

function verifyWebhookSignature(req, res, next) {
  const signature = req.get('stripe-signature') || req.get('x-hub-signature-256');

  if (!signature || !req.rawBody) {
    return res.status(400).json({ error: 'Missing signature or raw body' });
  }

  // Compute HMAC using raw bytes (JSON.stringify would reorder keys and fail!)
  const expectedHash = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.rawBody)
    .digest('hex');

  const timingSafeMatch = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedHash)
  );

  if (!timingSafeMatch) {
    return res.status(401).json({ error: 'Invalid webhook signature' });
  }

  next();
}

app.post('/api/webhooks/stripe', verifyWebhookSignature, (req, res) => {
  // req.body is parsed JSON, req.rawBody was verified cryptographically
  console.log('Verified Webhook Event:', req.body.type);
  res.json({ received: true });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "6-11",
        note: "The verify function intercepts the raw Buffer before JSON parsing mutates whitespace or key orders."
      },
      {
        lineRange: "15-37",
        note: "Computes HMAC-SHA256 over req.rawBody and compares using crypto.timingSafeEqual."
      }
    ],
    expectedOutput: "POST /api/webhooks/stripe (valid sig) -> 200 { received: true }\nPOST /api/webhooks/stripe (tampered) -> 401 { error: 'Invalid webhook signature' }"
  },

  {
    id: "exp-ex-15",
    title: "Safe Response Envelope Interceptor Patching res.json",
    category: "Request & Response",
    difficulty: "intermediate",
    whatThisCodeCovers: "Intercepts Express res.json to wrap all outgoing responses in a standardized API envelope ({ success: true, data, meta: { timestamp, correlationId } }) automatically.",
    conceptsCovered: [
      "Response Wrapping",
      "Monkey-Patching res.json",
      "JSend Envelope",
      "API Standardization",
      "Metadata Injection"
    ],
    code: `const express = require('express');
const app = express();

app.use((req, res, next) => {
  // Save reference to original res.json
  const originalJson = res.json.bind(res);

  // Override res.json to enforce uniform envelope
  res.json = (body) => {
    // Check if body is already wrapped or is an error
    if (body && (body.success !== undefined || body.error !== undefined)) {
      return originalJson(body);
    }

    const wrappedEnvelope = {
      success: res.statusCode < 400,
      data: body,
      meta: {
        timestamp: new Date().toISOString(),
        correlationId: req.correlationId || 'none'
      }
    };

    return originalJson(wrappedEnvelope);
  };

  next();
});

// Controllers remain clean and return raw domain data!
app.get('/api/users', (req, res) => {
  res.json([{ id: 1, name: 'Alice' }]);
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "5-6",
        note: "Binds original res.json to maintain proper prototype and context reference."
      },
      {
        lineRange: "8-25",
        note: "Wraps raw payloads in { success, data, meta } structure without modifying controller code."
      }
    ],
    expectedOutput: "GET /api/users -> 200 { success: true, data: [{ id: 1, name: 'Alice' }], meta: { timestamp: '...' } }"
  },

  {
    id: "exp-ex-16",
    title: "Content Negotiation Dispatcher Supporting JSON, CSV, and HTML Representations",
    category: "Request & Response",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses req.accepts() to inspect HTTP Accept headers and dispatch responses in JSON, CSV, or HTML format, returning 406 Not Acceptable if client requests unsupported types.",
    conceptsCovered: [
      "req.accepts()",
      "Content Negotiation",
      "HTTP 406 Not Acceptable",
      "MIME Quality Values",
      "Multi-Format Endpoints"
    ],
    code: `const express = require('express');
const app = express();

const reportData = [
  { id: 1, metric: 'ARR', value: 1200000 },
  { id: 2, metric: 'Churn', value: 0.02 }
];

app.get('/api/reports/financials', (req, res) => {
  // Inspect client Accept header preference
  const format = req.accepts(['json', 'html', 'csv']);

  if (!format) {
    return res.status(406).json({
      error: 'Not Acceptable',
      supportedFormats: ['application/json', 'text/html', 'text/csv']
    });
  }

  if (format === 'json') {
    return res.json(reportData);
  }

  if (format === 'html') {
    const rows = reportData.map(r => \`<tr><td>\${r.metric}</td><td>\${r.value}</td></tr>\`).join('');
    return res.send(\`<table border="1"><tr><th>Metric</th><th>Value</th></tr>\${rows}</table>\`);
  }

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv');
    const csv = 'id,metric,value\\n' + reportData.map(r => \`\${r.id},\${r.metric},\${r.value}\`).join('\\n');
    return res.send(csv);
  }
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "10-18",
        note: "req.accepts evaluates MIME priorities and returns false if no supported format is acceptable."
      },
      {
        lineRange: "20-33",
        note: "Renders JSON, HTML table, or CSV string depending on client Accept header."
      }
    ],
    expectedOutput: "Accept: application/json -> 200 JSON\nAccept: text/csv -> 200 CSV\nAccept: application/xml -> 406 Not Acceptable"
  },

  {
    id: "exp-ex-17",
    title: "Secure Static File Server with res.sendFile() Directory Traversal Bounds",
    category: "Request & Response",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses res.sendFile with strict root options and dotfile denials to prevent path traversal attacks (../../etc/passwd) when serving dynamic filenames.",
    conceptsCovered: [
      "res.sendFile()",
      "Path Traversal Defense",
      "root Option",
      "dotfiles: 'deny'",
      "Safe File Streaming"
    ],
    code: `const express = require('express');
const path = require('path');
const app = express();

const SAFE_DOWNLOADS_DIR = path.join(__dirname, 'public', 'downloads');

app.get('/downloads/:filename', (req, res, next) => {
  const { filename } = req.params;

  const options = {
    root: SAFE_DOWNLOADS_DIR,
    dotfiles: 'deny', // Block hidden files (.env, .git)
    headers: {
      'x-timestamp': Date.now(),
      'x-sent': true
    }
  };

  // Safe file send restricted strictly within SAFE_DOWNLOADS_DIR
  res.sendFile(filename, options, (err) => {
    if (err) {
      if (err.code === 'ENOENT') {
        return res.status(404).json({ error: 'Requested file not found' });
      }
      // Path traversal attempts trigger 403 Forbidden automatically
      if (err.status === 403) {
        return res.status(403).json({ error: 'Access denied' });
      }
      next(err);
    }
  });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "10-17",
        note: "The root option locks res.sendFile() inside SAFE_DOWNLOADS_DIR, neutralizing path traversal."
      },
      {
        lineRange: "20-30",
        note: "Error callback distinguishes between file not found (404) and forbidden access (403)."
      }
    ],
    expectedOutput: "GET /downloads/manual.pdf -> 200 PDF stream\nGET /downloads/../../etc/passwd -> 403 { error: 'Access denied' }"
  },

  {
    id: "exp-ex-18",
    title: "Streaming Large CSV Exports with Database Cursors and Backpressure Handling",
    category: "Streams & Performance",
    difficulty: "advanced",
    whatThisCodeCovers: "Streams 100,000 database rows directly to the Express response using Node streams and stream.pipeline, avoiding V8 heap memory exhaustion.",
    conceptsCovered: [
      "stream.pipeline",
      "Transform Streams",
      "Backpressure",
      "Memory-Safe Exports",
      "Heap Conservation"
    ],
    code: `const express = require('express');
const { Readable, Transform } = require('stream');
const { pipeline } = require('stream/promises');

const app = express();

// Generator simulating large database query cursor
async function* queryDatabaseCursor() {
  for (let i = 1; i <= 50000; i++) {
    yield { id: i, customer: \`Customer \${i}\`, balance: (Math.random() * 1000).toFixed(2) };
  }
}

app.get('/api/export/customers.csv', async (req, res, next) => {
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="customers.csv"');

  // 1. Readable stream from async generator
  const cursorStream = Readable.from(queryDatabaseCursor());

  // 2. Transform stream formatting rows into CSV chunks
  let headerWritten = false;
  const csvTransformer = new Transform({
    objectMode: true,
    transform(row, encoding, callback) {
      let output = '';
      if (!headerWritten) {
        output += 'id,customer,balance\\n';
        headerWritten = true;
      }
      output += \`\${row.id},"\${row.customer}",\${row.balance}\\n\`;
      callback(null, output);
    }
  });

  try {
    // 3. pipeline handles backpressure and cleans up on client disconnect
    await pipeline(cursorStream, csvTransformer, res);
  } catch (err) {
    if (err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      next(err);
    }
  }
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "8-13",
        note: "Async generator yields rows one at a time, pulling data lazily without buffering 50,000 objects in RAM."
      },
      {
        lineRange: "21-34",
        note: "Transform stream serializes objects into text/csv chunks incrementally."
      },
      {
        lineRange: "36-42",
        note: "pipeline handles TCP socket backpressure, pausing the generator when the network buffer fills."
      }
    ],
    expectedOutput: "GET /api/export/customers.csv -> Streams CSV with flat ~20MB memory usage regardless of row count."
  },

  {
    id: "exp-ex-19",
    title: "Reverse Proxy IP Resolution with Hardened trust proxy CIDR Bounds",
    category: "Request & Response",
    difficulty: "advanced",
    whatThisCodeCovers: "Configures app.set('trust proxy', ...) with explicit private IP CIDR ranges, preventing malicious clients from spoofing X-Forwarded-For headers.",
    conceptsCovered: [
      "trust proxy",
      "req.ip vs req.ips",
      "IP Spoofing Defense",
      "CIDR Subnet Bounds",
      "Reverse Proxy Chains"
    ],
    code: `const express = require('express');
const app = express();

// HARDENED: Trust only local loopback and internal AWS/Docker VPC subnets
// NEVER set trust proxy to true blindly!
app.set('trust proxy', ['loopback', '10.0.0.0/8', '172.16.0.0/12']);

app.get('/api/client-info', (req, res) => {
  res.json({
    // req.ip: leftmost untrusted IP in X-Forwarded-For chain
    resolvedClientIp: req.ip,

    // req.ips: array of all proxy hops
    proxyChain: req.ips,

    // Direct socket connection (IP of nearest reverse proxy)
    directSocketIp: req.socket.remoteAddress,

    isSecure: req.secure // True if X-Forwarded-Proto was https
  });
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "5-6",
        note: "Restricts proxy trust to known private subnets; prevents attackers from forging X-Forwarded-For."
      },
      {
        lineRange: "9-20",
        note: "req.ip extracts verified client IP, ignoring internal private proxy addresses."
      }
    ],
    expectedOutput: "GET /api/client-info -> { resolvedClientIp: '203.0.113.195', proxyChain: ['203.0.113.195', '10.0.1.25'] }"
  },

  {
    id: "exp-ex-20",
    title: "Client Disconnect Abort Pipeline with req.on('close') and AbortController",
    category: "Streams & Cancellation",
    difficulty: "advanced",
    whatThisCodeCovers: "Detects when an HTTP client aborts or closes a connection mid-request, using an AbortController to cancel active downstream database queries and external fetch calls.",
    conceptsCovered: [
      "req.on('close')",
      "AbortController",
      "Cancellation Tokens",
      "Resource Saving",
      "res.writableEnded"
    ],
    code: `const express = require('express');
const app = express();

app.get('/api/heavy-calculation', async (req, res, next) => {
  const abortController = new AbortController();

  // Listen for premature client connection drops
  req.on('close', () => {
    if (!res.writableEnded) {
      console.warn(\`[Client Aborted] Request \${req.id} canceled by client. Halting background work.\`);
      abortController.abort(); // Signal cancelable downstream operations!
    }
  });

  try {
    // Pass abort signal to fetch or database driver
    const downstreamResponse = await fetch('https://analytics.internal/aggregate', {
      signal: abortController.signal
    });

    const data = await downstreamResponse.json();
    res.json({ success: true, data });
  } catch (err) {
    if (err.name === 'AbortError') {
      console.log('Downstream call aborted cleanly without crashing server.');
      return; // Do not attempt to respond to closed client
    }
    next(err);
  }
});

module.exports = app;`,
    breakdown: [
      {
        lineRange: "5-13",
        note: "req.on('close') triggers abortController.abort() if the client disconnects before res.writableEnded."
      },
      {
        lineRange: "16-27",
        note: "Passes abort signal downstream; catches AbortError gracefully without sending response."
      }
    ],
    expectedOutput: "Client disconnect -> logs '[Client Aborted] ... Halting background work.' and frees network/CPU resources."
  }
];
