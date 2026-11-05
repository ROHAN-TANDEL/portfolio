// Batch 6: Modern Node 20-22 LTS & Architecture Patterns (Examples 49 - 55)
module.exports = [
  {
    id: "ex-node-049",
    title: "Native fetch() with AbortSignal.timeout and Exponential Backoff Retry",
    category: "Modern Node 20-22 Features",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to use native global fetch() in Node 20/22 with AbortSignal.timeout and an exponential backoff jitter retry mechanism.",
    conceptsCovered: [
      "Native global fetch() and Undici",
      "AbortSignal.timeout(ms)",
      "Exponential backoff with jitter",
      "Network resilience patterns"
    ],
    code: `export async function fetchWithRetry(url, options = {}, maxRetries = 3, timeoutMs = 4000) {
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      // Native modern timeout without manual setTimeout / clearTimeout:
      const signal = AbortSignal.timeout(timeoutMs);

      const response = await fetch(url, { ...options, signal });

      // If server returned 5xx, throw to trigger retry:
      if (!response.ok && response.status >= 500) {
        throw new Error(\`Server error HTTP \${response.status}\`);
      }

      return await response.json();
    } catch (err) {
      attempt++;
      if (attempt >= maxRetries) throw err;

      // Exponential backoff: 2^attempt * 200ms + random jitter
      const delay = Math.pow(2, attempt) * 200 + Math.random() * 100;
      console.warn(\`Attempt \${attempt} failed (\${err.message}). Retrying in \${delay.toFixed(0)}ms...\`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}`,
    breakdown: [
      { lineRange: "8", note: "AbortSignal.timeout(timeoutMs) is a native Node 18+ Web API for automatic request timeouts." },
      { lineRange: "10", note: "Uses global native fetch() without third-party dependencies." },
      { lineRange: "21-25", note: "Calculates exponential backoff delay with random jitter to prevent server thundering herds." }
    ],
    expectedOutput: "Auto-retries transient network drops with jittered delays; returns parsed JSON cleanly."
  },

  {
    id: "ex-node-050",
    title: "Unit & Integration Testing Suite with Native node:test & Mocking",
    category: "Modern Node 20-22 Features",
    difficulty: "Foundational",
    whatThisCodeCovers: "How to build a complete test suite using the built-in node:test runner and node:assert/strict assertions without Jest or Mocha.",
    conceptsCovered: [
      "node:test describe, it, test, mock",
      "node:assert/strict",
      "Native function mocking (mock.fn)",
      "Zero-dependency test automation"
    ],
    code: `import { describe, it, beforeEach, mock } from 'node:test';
import assert from 'node:assert/strict';

// Business service to test:
class OrderService {
  constructor(paymentGateway) {
    this.paymentGateway = paymentGateway;
  }

  async checkout(orderId, amount) {
    if (amount <= 0) throw new Error('Invalid order amount');
    const chargeResult = await this.paymentGateway.charge(orderId, amount);
    return { success: true, chargeId: chargeResult.id };
  }
}

describe('OrderService Suite', () => {
  it('should process valid orders and call payment gateway mock', async () => {
    // Native function mock:
    const mockCharge = mock.fn(async (orderId, amount) => ({ id: 'ch_9981' }));
    const fakeGateway = { charge: mockCharge };

    const service = new OrderService(fakeGateway);
    const result = await service.checkout('ord_101', 150.00);

    assert.equal(result.success, true);
    assert.equal(result.chargeId, 'ch_9981');
    assert.equal(mockCharge.mock.callCount(), 1);
    assert.deepEqual(mockCharge.mock.calls[0].arguments, ['ord_101', 150.00]);
  });

  it('should reject orders with non-positive amounts', async () => {
    const service = new OrderService({});
    await assert.rejects(
      () => service.checkout('ord_102', -10),
      { message: 'Invalid order amount' }
    );
  });
});`,
    breakdown: [
      { lineRange: "1-2", note: "Imports native test runner and strict assertions from node: standard library." },
      { lineRange: "20-30", note: "Uses mock.fn() to assert call count and arguments without external libraries." },
      { lineRange: "32-38", note: "assert.rejects cleanly asserts that async operations throw expected errors." }
    ],
    expectedOutput: "✔ OrderService Suite > should process valid orders (3.2ms)\n✔ OrderService Suite > should reject orders with non-positive amounts (1.1ms)"
  },

  {
    id: "ex-node-051",
    title: "Zero-Dependency Embedded Database with Native node:sqlite",
    category: "Modern Node 20-22 Features",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to use the native node:sqlite module (Node 22.5+) to run an embedded in-memory database with prepared statements and transactions with zero npm packages.",
    conceptsCovered: [
      "node:sqlite DatabaseSync",
      "Embedded in-memory database",
      "Prepared statements (db.prepare)",
      "Zero-dependency persistence"
    ],
    code: `import { DatabaseSync } from 'node:sqlite';

export function demonstrateNativeSqlite() {
  // 1. Create embedded in-memory database (or specify a file path like 'app.db'):
  const db = new DatabaseSync(':memory:');

  // 2. Initialize table schema:
  db.exec(\`
    CREATE TABLE audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      action TEXT NOT NULL,
      actor TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  \`);

  // 3. Prepared statement for high-throughput inserts:
  const insertStmt = db.prepare('INSERT INTO audit_logs (action, actor, created_at) VALUES (?, ?, ?)');
  insertStmt.run('USER_LOGIN', 'user_101', new Date().toISOString());
  insertStmt.run('ORDER_PLACED', 'user_101', new Date().toISOString());

  // 4. Prepared statement for querying:
  const queryStmt = db.prepare('SELECT id, action, actor FROM audit_logs WHERE actor = ?');
  const records = queryStmt.all('user_101');

  console.log('Query results from native SQLite:', records);
  db.close();
  return records;
}`,
    breakdown: [
      { lineRange: "5-6", note: "Creates in-memory database using C SQLite engine embedded directly in the Node binary." },
      { lineRange: "8-16", note: "Executes DDL schema queries synchronously with zero IPC." },
      { lineRange: "18-24", note: "Prepared statements prevent SQL injection and maximize query performance." }
    ],
    expectedOutput: "Query results: [{ id: 1, action: 'USER_LOGIN', actor: 'user_101' }, { id: 2, action: 'ORDER_PLACED' ... }]."
  },

  {
    id: "ex-node-052",
    title: "WHATWG Web Streams to Node.js Streams Bridge",
    category: "Modern Node 20-22 Features",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to convert standard WHATWG ReadableStream (from fetch or browser APIs) into Node.js native streams using Readable.fromWeb() for pipeline compatibility.",
    conceptsCovered: [
      "Readable.fromWeb and Readable.toWeb",
      "WHATWG Web Streams standard",
      "Node.js stream interoperability",
      "Edge runtime compatibility"
    ],
    code: `import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createWriteStream } from 'node:fs';

export async function downloadLargeFileWebStream(url, destinationPath) {
  // 1. fetch() returns a standard WHATWG ReadableStream in response.body:
  const response = await fetch(url);
  if (!response.ok) throw new Error(\`Failed to fetch: \${response.statusText}\`);

  // 2. Convert standard Web Stream into Node.js native Readable stream:
  const nodeReadable = Readable.fromWeb(response.body);

  // 3. Pipe directly to disk using standard Node pipeline:
  const fileWriter = createWriteStream(destinationPath);
  await pipeline(nodeReadable, fileWriter);

  console.log('Successfully streamed Web Stream to disk.');
}`,
    breakdown: [
      { lineRange: "8-9", note: "Native fetch() provides a WHATWG ReadableStream on response.body." },
      { lineRange: "12", note: "Readable.fromWeb bridges the WHATWG reader lock to Node's EventEmitter stream model." },
      { lineRange: "15-16", note: "Pipes through standard stream.pipeline with full backpressure safety." }
    ],
    expectedOutput: "Streams external Web Stream to local disk in constant ~35MB RAM footprint."
  },

  {
    id: "ex-node-053",
    title: "Native Diagnostics Channel Telemetry Pub/Sub without Monkey-Patching",
    category: "Modern Node 20-22 Features",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to emit and subscribe to application and HTTP lifecycle events using node:diagnostics_channel for zero-overhead internal telemetry.",
    conceptsCovered: [
      "node:diagnostics_channel",
      "Zero-overhead conditional publication",
      "Decoupled instrumentation",
      "APM telemetry pipeline"
    ],
    code: `import diagnosticsChannel from 'node:diagnostics_channel';

// 1. Define named telemetry channel:
const paymentChannel = diagnosticsChannel.channel('enterprise.payment.processed');

// 2. Business service emits event only if subscribers exist (O(1) check):
export function processCustomerPayment(orderId, amount, customerId) {
  const result = { orderId, amount, customerId, status: 'CHARGED', timestamp: Date.now() };

  if (paymentChannel.hasSubscribers) {
    paymentChannel.publish(result);
  }

  return result;
}

// 3. Observability / APM module subscribes cleanly without modifying business code:
export function initPaymentTelemetryObserver() {
  diagnosticsChannel.subscribe('enterprise.payment.processed', (message) => {
    console.log(\`[Metrics] Payment of $\${message.amount} processed for Customer \${message.customerId}\`);
  });
}`,
    breakdown: [
      { lineRange: "4", note: "Creates or fetches global named diagnostic channel." },
      { lineRange: "10-12", note: "paymentChannel.hasSubscribers check is a single pointer check consuming 0% CPU if idle." },
      { lineRange: "18-22", note: "Subscribers receive events without monkey-patching or wrapping service methods." }
    ],
    expectedOutput: "[Metrics] Payment of $150 processed for Customer 9912 (Telemetry captured without wrapping functions)."
  },

  {
    id: "ex-node-054",
    title: "Unhandled Rejection & Uncaught Exception Crash Guard with Log Flush",
    category: "Modern Node 20-22 Features",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to properly capture unhandled promise rejections and fatal exceptions, flush asynchronous logs, close sockets, and exit cleanly.",
    conceptsCovered: [
      "process.on('uncaughtException')",
      "process.on('unhandledRejection')",
      "Fail-fast process stability",
      "Asynchronous log flush on crash"
    ],
    code: `export function setupProcessCrashGuard(logger, server) {
  function handleFatalCrash(err, origin) {
    console.error(\`FATAL PROCESS ERROR (\${origin}):\`, err);

    // 1. Attempt quick hard exit timeout:
    const exitTimer = setTimeout(() => {
      process.exit(1);
    }, 1500);
    exitTimer.unref();

    // 2. Stop accepting new traffic:
    if (server && server.close) {
      server.close();
    }

    // 3. Flush logs and exit:
    if (logger && typeof logger.flush === 'function') {
      logger.flush(() => process.exit(1));
    } else {
      process.exit(1);
    }
  }

  process.on('uncaughtException', (err, origin) => handleFatalCrash(err, origin));
  process.on('unhandledRejection', (reason) => handleFatalCrash(reason, 'unhandledRejection'));
}`,
    breakdown: [
      { lineRange: "2-10", note: "Captures fatal error, logs stack trace, and arms 1.5s unref'd safety timer." },
      { lineRange: "12-15", note: "Closes server to prevent incoming requests while exiting." },
      { lineRange: "17-21", note: "Flushes asynchronous log buffer before invoking process.exit(1)." }
    ],
    expectedOutput: "Logs crash details, flushes pending logs, and exits with code 1 for orchestrator restart."
  },

  {
    id: "ex-node-055",
    title: "Dynamic Plugin Architecture with import() and Safe Discovery",
    category: "Modern Node 20-22 Features",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to build a modular plugin loader using dynamic import() and fs.readdir to load plugins conditionally at runtime.",
    conceptsCovered: [
      "Dynamic import()",
      "Plugin architecture",
      "Directory discovery",
      "Runtime interface verification"
    ],
    code: `import fs from 'node:fs/promises';
import path from 'node:path';

export async function loadPluginsFromDirectory(pluginsDir) {
  const loadedPlugins = [];
  const entries = await fs.readdir(pluginsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.mjs'))) {
      const pluginPath = path.resolve(pluginsDir, entry.name);
      
      try {
        // Dynamic import returns Promise resolving to module exports:
        const module = await import(pluginPath);
        const plugin = module.default || module;

        if (typeof plugin.init === 'function') {
          await plugin.init();
          loadedPlugins.push({ name: entry.name, plugin });
          console.log(\`Successfully loaded plugin: \${entry.name}\`);
        }
      } catch (err) {
        console.error(\`Failed to load plugin \${entry.name}:\`, err.message);
      }
    }
  }

  return loadedPlugins;
}`,
    breakdown: [
      { lineRange: "6-7", note: "Discovers all JavaScript files in the plugins directory using Dirent." },
      { lineRange: "13-15", note: "Calls dynamic import() to load module into runtime memory." },
      { lineRange: "17-21", note: "Validates required init() contract and initializes plugin asynchronously." }
    ],
    expectedOutput: "Successfully loaded plugin: auth-plugin.js\nSuccessfully loaded plugin: metrics-plugin.js"
  }
];
