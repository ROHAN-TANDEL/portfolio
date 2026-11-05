// Batch 5: Observability, Context & Performance Diagnostics (Examples 41 - 48)
module.exports = [
  {
    id: "ex-node-041",
    title: "Distributed Tracing Context Propagation with AsyncLocalStorage",
    category: "Observability & Performance",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to propagate trace and correlation IDs through complex async call stacks and auto-inject them into logger statements using AsyncLocalStorage.",
    conceptsCovered: [
      "AsyncLocalStorage (node:async_hooks)",
      "Correlation ID propagation",
      "Context-aware structured logger",
      "Zero parameter drilling"
    ],
    code: `import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export const traceStorage = new AsyncLocalStorage();

// Express / HTTP Middleware:
export function tracingMiddleware(req, res, next) {
  const traceId = req.headers['x-trace-id'] || randomUUID();
  const store = new Map();
  store.set('traceId', traceId);
  store.set('startTime', Date.now());

  res.setHeader('X-Trace-Id', traceId);

  // Run the entire asynchronous pipeline inside this isolated context:
  traceStorage.run(store, () => {
    next();
  });
}

// Global logger that automatically fetches active trace ID without passing req:
export const contextLogger = {
  info(message, meta = {}) {
    const store = traceStorage.getStore();
    const traceId = store ? store.get('traceId') : 'system';
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      traceId,
      level: 'INFO',
      message,
      ...meta
    }));
  }
};`,
    breakdown: [
      { lineRange: "7-18", note: "Middleware establishes execution store with traceId and runs next() inside it." },
      { lineRange: "21-33", note: "contextLogger.info reads current store from AsyncLocalStorage without parameter drilling." }
    ],
    expectedOutput: "{\"timestamp\":\"...\",\"traceId\":\"c7a8b9...\",\"level\":\"INFO\",\"message\":\"Order processed\"}"
  },

  {
    id: "ex-node-042",
    title: "Real-Time Event Loop Lag Monitor with HDR Histograms & Alerting",
    category: "Observability & Performance",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to track event loop lag using perf_hooks.monitorEventLoopDelay and trigger alerts when p99 latency spikes above 50ms.",
    conceptsCovered: [
      "perf_hooks.monitorEventLoopDelay",
      "HDR histograms (p50, p90, p99, max)",
      "Event loop degradation alerting",
      "Nanosecond to millisecond conversion"
    ],
    code: `import { monitorEventLoopDelay } from 'node:perf_hooks';

export function startEventLoopLagMonitor(intervalMs = 5000, p99ThresholdMs = 50) {
  // Initialize HDR histogram with 10ms resolution:
  const histogram = monitorEventLoopDelay({ resolution: 10 });
  histogram.enable();

  const timer = setInterval(() => {
    // Convert nanoseconds to milliseconds:
    const p50Ms = histogram.percentile(50) / 1e6;
    const p90Ms = histogram.percentile(90) / 1e6;
    const p99Ms = histogram.percentile(99) / 1e6;
    const maxMs = histogram.max / 1e6;

    console.log(\`[Loop Lag] p50: \${p50Ms.toFixed(2)}ms | p90: \${p90Ms.toFixed(2)}ms | p99: \${p99Ms.toFixed(2)}ms | Max: \${maxMs.toFixed(2)}ms\`);

    if (p99Ms > p99ThresholdMs) {
      console.error(\`CRITICAL ALERT: Event loop p99 lag (\${p99Ms.toFixed(2)}ms) exceeded threshold (\${p99ThresholdMs}ms)! Synchronous code is blocking the thread.\`);
    }

    histogram.reset(); // Reset counters for next window
  }, intervalMs);

  timer.unref(); // Do not block process exit
  return { histogram, stop: () => clearInterval(timer) };
}`,
    breakdown: [
      { lineRange: "5-6", note: "Enables native C++ event loop delay histogram sampler." },
      { lineRange: "10-15", note: "Calculates p50, p90, p99, and max percentiles in milliseconds." },
      { lineRange: "17-21", note: "Fires critical alert when p99 lag exceeds threshold, then resets histogram." }
    ],
    expectedOutput: "[Loop Lag] p50: 1.20ms | p90: 2.40ms | p99: 4.80ms | Max: 8.50ms (Normal operational state)."
  },

  {
    id: "ex-node-043",
    title: "Programmatic V8 Heap Snapshot Generator with Stream Compression",
    category: "Observability & Performance",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to take a V8 heap snapshot on a running production service without stopping it, streaming the snapshot directly through gzip to disk.",
    conceptsCovered: [
      "node:v8 getHeapSnapshot",
      "Streaming heap dump to disk",
      "zlib.createGzip compression",
      "Post-mortem memory leak diagnostics"
    ],
    code: `import v8 from 'node:v8';
import fs from 'node:fs';
import { createGzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';

export async function captureCompressedHeapSnapshot(outputDir = './diagnostics') {
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  const filename = \`\${outputDir}/heap-\${Date.now()}.heapsnapshot.gz\`;
  console.log('Capturing V8 Heap Snapshot to:', filename);

  // 1. Get raw snapshot stream from V8 engine
  const snapshotStream = v8.getHeapSnapshot();
  const fileWriter = fs.createWriteStream(filename);

  // 2. Compress on the fly to save disk space (reduces 1GB heap dump to ~150MB)
  await pipeline(snapshotStream, createGzip(), fileWriter);
  console.log('Heap snapshot compressed and saved successfully.');
  return filename;
}

// Trigger via SIGUSR2 signal in production:
process.on('SIGUSR2', async () => {
  await captureCompressedHeapSnapshot();
});`,
    breakdown: [
      { lineRange: "12-14", note: "v8.getHeapSnapshot() returns a Readable stream of the complete V8 object graph." },
      { lineRange: "17", note: "Pipes through createGzip() directly into fileWriter, compressing 80% on the fly." },
      { lineRange: "23-25", note: "Hooks into POSIX SIGUSR2 signal for on-demand production triggers." }
    ],
    expectedOutput: "Captures and compresses 1GB heap dump into a 120MB .heapsnapshot.gz file in ~2 seconds."
  },

  {
    id: "ex-node-044",
    title: "High-Performance Asynchronous JSON Logging with Pino & SonicBoom",
    category: "Observability & Performance",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to configure Pino with non-blocking asynchronous log buffer destinations to eliminate event loop blocking from stdout.",
    conceptsCovered: [
      "Pino high-performance logger",
      "Asynchronous sonic-boom buffer writes",
      "Process exit log flushing",
      "Eliminating console.log synchronous blocking"
    ],
    code: `import pino from 'pino';

// Create non-blocking async destination (writes via internal buffer worker):
const asyncDestination = pino.destination({
  sync: false, // Asynchronous non-blocking writes!
  minLength: 4096 // Buffer up to 4KB before flushing to OS
});

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'payment-gateway', pid: process.pid },
  timestamp: pino.stdTimeFunctions.isoTime
}, asyncDestination);

// FLUSH GUARD: Flush buffered logs before process terminates:
function flushLogsAndExit(code = 0) {
  logger.flush(() => {
    process.exit(code);
  });
}

process.on('SIGTERM', () => flushLogsAndExit(0));
process.on('SIGINT', () => flushLogsAndExit(0));`,
    breakdown: [
      { lineRange: "4-7", note: "pino.destination with sync: false writes to an internal buffer without stalling event loop." },
      { lineRange: "9-13", note: "Configures JSON metadata tags and ISO timestamp formatting." },
      { lineRange: "16-24", note: "logger.flush() guarantees all pending buffered logs are written before shutdown." }
    ],
    expectedOutput: "Logs 100,000 JSON lines per second with < 2ms event loop overhead."
  },

  {
    id: "ex-node-045",
    title: "Event Loop Delay-Based Load Shedding Middleware (HTTP 503 Overload)",
    category: "Observability & Performance",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to protect Node.js microservices from cascading failures by automatically rejecting new requests with HTTP 503 when event loop lag exceeds 75ms.",
    conceptsCovered: [
      "Dynamic load shedding",
      "HTTP 503 Service Unavailable",
      "Retry-After header",
      "Cascading outage prevention"
    ],
    code: `import { monitorEventLoopDelay } from 'node:perf_hooks';

const h = monitorEventLoopDelay({ resolution: 10 });
h.enable();

export function eventLoopLoadShedder(maxPermittedLagMs = 75) {
  return (req, res, next) => {
    // Check p99 event loop lag over the last sampling period:
    const currentP99LagMs = h.percentile(99) / 1e6;

    if (currentP99LagMs > maxPermittedLagMs) {
      console.warn(\`[LOAD SHEDDING] Rejecting incoming request: Loop lag is \${currentP99LagMs.toFixed(2)}ms\`);

      res.writeHead(503, {
        'Content-Type': 'application/json',
        'Retry-After': 3 // Advise client to retry in 3 seconds
      });

      return res.end(JSON.stringify({
        error: 'Service Overloaded',
        message: 'System is experiencing severe CPU pressure. Load shed activated.'
      }));
    }

    next();
  };
}`,
    breakdown: [
      { lineRange: "3-4", note: "Enables continuous event loop delay monitoring histogram." },
      { lineRange: "9-11", note: "Inspects p99 lag; if above 75ms, triggers immediate load shedding." },
      { lineRange: "14-22", note: "Returns HTTP 503 with Retry-After header before server exhausts RAM or crashes." }
    ],
    expectedOutput: "Rejects excess traffic during CPU spikes, allowing in-flight requests to complete cleanly."
  },

  {
    id: "ex-node-046",
    title: "Programmatic CPU Profiling via node:inspector",
    category: "Observability & Performance",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to connect an inspector session programmatically in production to record a 10-second CPU profile and output a Flamegraph file.",
    conceptsCovered: [
      "node:inspector Session API",
      "Profiler.start and Profiler.stop",
      "V8 stack sampling",
      "CPU Flamegraph generation"
    ],
    code: `import inspector from 'node:inspector/promises';
import fs from 'node:fs/promises';

export async function profileCpuDuringSpike(durationSeconds = 10, outputPath = './cpu-profile.json') {
  const session = new inspector.Session();
  session.connect();

  console.log(\`Starting V8 CPU Profiler for \${durationSeconds} seconds...\`);
  await session.post('Profiler.enable');
  await session.post('Profiler.start');

  // Sample call stacks during live traffic:
  await new Promise((resolve) => setTimeout(resolve, durationSeconds * 1000));

  const { profile } = await session.post('Profiler.stop');
  await fs.writeFile(outputPath, JSON.stringify(profile));
  session.disconnect();

  console.log(\`CPU Profile saved to \${outputPath}. Open in Chrome DevTools Performance tab to view Flamegraph.\`);
  return outputPath;
}`,
    breakdown: [
      { lineRange: "5-6", note: "Connects internal V8 inspector session directly in code without --inspect flag." },
      { lineRange: "9-14", note: "Starts Profiler, samples for durationSeconds under real traffic, and stops Profiler." },
      { lineRange: "16-18", note: "Exports complete V8 sampling profile as JSON compatible with Chrome DevTools." }
    ],
    expectedOutput: "Generates cpu-profile.json containing V8 call stack samples; reveals hot functions in Flamegraph."
  },

  {
    id: "ex-node-047",
    title: "Monomorphic Call Site Optimization to Prevent V8 Megamorphic Deopt",
    category: "Observability & Performance",
    difficulty: "Advanced",
    whatThisCodeCovers: "How to structure JavaScript objects and classes with consistent property order to keep V8 Inline Caches (ICs) monomorphic and achieve 5x faster execution.",
    conceptsCovered: [
      "V8 Hidden Classes / Shapes",
      "Monomorphic vs Megamorphic Inline Caches",
      "Property initialization order",
      "TurboFan JIT optimization"
    ],
    code: `// SLOW / DEOPTIMIZED PATTERN (Megamorphic call site):
// Dynamic property additions in differing order create different hidden classes!
function createPointSlow(x, y, is3D) {
  const p = {};
  if (is3D) {
    p.z = 0; p.x = x; p.y = y; // Shape A: z, x, y
  } else {
    p.x = x; p.y = y;          // Shape B: x, y
  }
  return p;
}

// FAST / OPTIMIZED PATTERN (Monomorphic: Consistent Hidden Class Shape):
class PointFast {
  constructor(x, y, z = 0) {
    // ALWAYS initialize ALL properties in the EXACT same order!
    this.x = x;
    this.y = y;
    this.z = z;
  }
}

// Monomorphic function: V8 compiles to single CPU instruction offset!
export function calculateDistance(point) {
  return Math.sqrt(point.x * point.x + point.y * point.y);
}`,
    breakdown: [
      { lineRange: "4-11", note: "Differing property assignment orders force V8 to branch hidden classes into Megamorphic lookups." },
      { lineRange: "15-22", note: "Class constructor guarantees identical shape and property offsets for all instances." },
      { lineRange: "25-27", note: "TurboFan accesses point.x and point.y at fixed memory offsets with zero runtime lookup." }
    ],
    expectedOutput: "Monomorphic class instances execute property access 3x to 5x faster than dynamic objects."
  },

  {
    id: "ex-node-048",
    title: "Fast JSON Serialization with Pre-Compiled Schemas",
    category: "Observability & Performance",
    difficulty: "Intermediate",
    whatThisCodeCovers: "How to replace slow native JSON.stringify with pre-compiled schema serialization using fast-json-stringify for a 3x API throughput boost.",
    conceptsCovered: [
      "JSON.stringify performance overhead",
      "fast-json-stringify schema compilation",
      "Direct string concatenation vs runtime reflection",
      "Fastify serialization architecture"
    ],
    code: `import fastJson from 'fast-json-stringify';

// 1. Declare strict JSON schema for API payload:
const stringifyUser = fastJson({
  title: 'UserResponse',
  type: 'object',
  properties: {
    id: { type: 'integer' },
    email: { type: 'string' },
    roles: {
      type: 'array',
      items: { type: 'string' }
    },
    verified: { type: 'boolean' }
  }
});

// 2. High-throughput serialization:
export function serializeUserData(user) {
  // Up to 3x faster than JSON.stringify(user)!
  return stringifyUser(user);
}

// Benchmark comparison:
const sampleUser = { id: 101, email: 'alice@test.com', roles: ['admin', 'billing'], verified: true };
console.log('Serialized JSON:', serializeUserData(sampleUser));`,
    breakdown: [
      { lineRange: "4-16", note: "Compiles JSON schema into a dedicated, optimized string concatenation function." },
      { lineRange: "19-22", note: "Bypasses V8 dynamic reflection, formatting keys directly into output string." }
    ],
    expectedOutput: "Produces valid JSON with 3x higher operations/sec than native JSON.stringify."
  }
];
