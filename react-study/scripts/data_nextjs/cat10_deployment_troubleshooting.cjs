const { card } = require("../next_builder_helper.cjs");

const cards = [
  card(
    109,
    "Standalone Output Mode (`output: 'standalone'`) Architecture",
    "Deployment & Self-Hosting",
    "Mastery",
    "The `output: 'standalone'` configuration automatically traces all imports and copies only the minimal required production dependencies into `.next/standalone`, shrinking Docker container images from 1.5 GB down to less than 120 MB.",
    `// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "standalone" // Generates self-contained server bundle in .next/standalone!
};

module.exports = nextConfig;

// What output: 'standalone' does:
// 1. Analyzes dependency AST graph to find used node_modules.
// 2. Bundles a minimal Node.js server (server.js) that runs without 'next start'!
// 3. Eliminates devDependencies, unused modules, and global Next.js CLI bloat.
// 4. Result: Container image size is reduced by 85-90%.`,
    ["output: 'standalone'", "Docker Optimization", "Minimal Bundle", "Self-Hosting", "DevOps"],
    [
      { title: "Next.js Docs: Standalone Output", url: "https://nextjs.org/docs/app/building-your-application/deploying/node-js#automatically-copying-traced-files" }
    ],
    "What static assets must be manually copied into the Docker container when using `output: 'standalone'`?",
    "Next.js does NOT copy the `public/` directory or `.next/static/` into `.next/standalone` (because in production, static assets should ideally be served via a CDN or Nginx). In a container build, you must explicitly copy both folders into `.next/standalone`.",
    "How do you start the production server with standalone output?",
    "Run `node server.js` directly inside the `.next/standalone` folder. No `next` CLI or full `node_modules` directory is required."
  ),

  card(
    110,
    "Production Docker Multi-Stage Build for Next.js",
    "Deployment & Self-Hosting",
    "Mastery",
    "A multi-stage Docker build splits dependency installation, application compilation, and production runtime into isolated phases, producing a lightweight, hardened, non-root Alpine container.",
    `# Production Next.js 15 Dockerfile
FROM node:20-alpine AS base

# Phase 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Phase 2: Build application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Phase 3: Production runner (Hardened non-root user)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy standalone output and static assets
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]`,
    ["Dockerfile", "Multi-Stage Build", "Alpine Linux", "Non-Root User", "Container Hardening"],
    [
      { title: "Next.js Docker Example", url: "https://github.com/vercel/next.js/tree/canary/examples/with-docker" }
    ],
    "Why must the container switch to a non-root user (`USER nextjs`)?",
    "Container security best practices. Running as root allows an attacker who achieves Remote Code Execution (RCE) via a vulnerable dependency to gain root access to the underlying container namespace."
  ),

  card(
    111,
    "Turbopack vs Webpack: Architecture & Build Benchmarks",
    "Deployment & Self-Hosting",
    "Deep Dive",
    "Turbopack is the successor to Webpack, written in Rust. Using incremental computation via the Turbo engine, Turbopack caches function calls and AST transforms in memory, delivering 5x-10x faster local server startups and instant HMR updates.",
    `// Running Turbopack in Next.js:
// package.json:
// "scripts": {
//   "dev": "next dev --turbopack",
//   "build": "next build --turbopack"
// }

// Architecture Breakdown:
// 1. Webpack: Re-evaluates large portions of dependency graphs on code changes.
// 2. Turbopack: Incremental Turbo Engine (Rust).
//    - Caches results of individual functions in an in-memory graph.
//    - When file X changes, Turbopack re-computes ONLY the exact nodes downstream of X.
//    - Native multithreaded parallelism without Node.js single-threaded bottlenecks.`,
    ["Turbopack", "Webpack", "Rust", "HMR", "Build Performance"],
    [
      { title: "Turbopack Architecture", url: "https://turbo.build/pack/docs/features/why-turbopack" }
    ],
    "Is Turbopack fully production-ready in Next.js 15?",
    "In Next.js 15, Turbopack is stabilized for development (`next dev --turbopack`), passing 100% of integration test suites. Production build support (`next build --turbopack`) is in release candidate validation.",
    "Can custom Webpack plugins be used with Turbopack?",
    "No. Turbopack is written in Rust and does not support arbitrary JavaScript Webpack plugins. Turbopack provides native Rust equivalents or Next.js config hooks."
  ),

  card(
    112,
    "The `instrumentation.ts` Hook & OpenTelemetry Initialization",
    "Observability & Telemetry",
    "Mastery",
    "The `instrumentation.ts` file exports a `register()` function that executes once when the Next.js server boots. It is the designated hook for initializing OpenTelemetry tracing, Prometheus metric collectors, and database pool warm-ups.",
    `// instrumentation.ts (Root of project or src/instrumentation.ts)
export async function register() {
  // Check runtime environment
  if (process.env.NEXT_RUNTIME === "nodejs") {
    console.log("[Instrumentation] Initializing OpenTelemetry SDK on Node.js runtime...");
    const { NodeSDK } = await import("@opentelemetry/sdk-node");
    const { OTLPTraceExporter } = await import("@opentelemetry/exporter-trace-otlp-grpc");

    const sdk = new NodeSDK({
      traceExporter: new OTLPTraceExporter({ url: "grpc://tempo:4317" }),
      serviceName: "nextjs-enterprise-frontend"
    });

    sdk.start();
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    console.log("[Instrumentation] Booting Edge Runtime worker...");
  }
}

// In next.config.js:
// experimental: { instrumentationHook: true } (Auto-enabled in Next.js 15!)`,
    ["instrumentation.ts", "OpenTelemetry", "Server Boot", "register()", "Observability"],
    [
      { title: "Next.js Docs: Instrumentation", url: "https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation" }
    ],
    "Why shouldn't you initialize OpenTelemetry in a custom `server.js` or global layout?",
    "`instrumentation.ts` is platform-agnostic and runtime-aware. It runs before any requests arrive and correctly distinguishes between the `nodejs` and `edge` runtimes via `process.env.NEXT_RUNTIME`."
  ),

  card(
    113,
    "Self-Hosting Next.js with Custom Redis `CacheHandler`",
    "Deployment & Self-Hosting",
    "Mastery",
    "In multi-container Kubernetes clusters, each pod maintains its own isolated disk cache by default, causing cache desynchronization. A custom `CacheHandler` backed by Redis shares the Data Cache and ISR revalidations across all pods.",
    `// cache-handler.js (Redis CacheHandler for Next.js)
const Redis = require("ioredis");
const redis = new Redis(process.env.REDIS_URL);

module.exports = class RedisCacheHandler {
  async get(key) {
    const data = await redis.get(key);
    if (!data) return null;
    return JSON.parse(data);
  }

  async set(key, data, ctx) {
    // ctx contains revalidate TTL
    if (ctx.revalidate) {
      await redis.set(key, JSON.stringify(data), "EX", ctx.revalidate);
    } else {
      await redis.set(key, JSON.stringify(data));
    }
  }

  async revalidateTag(tag) {
    // Purge tagged keys across entire cluster!
    const keys = await redis.smembers(\`tag:\${tag}\`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
};

// next.config.js
module.exports = {
  cacheHandler: require.resolve("./cache-handler.js")
};`,
    ["CacheHandler", "Redis", "Multi-Instance", "Kubernetes", "Shared Data Cache"],
    [
      { title: "Next.js Docs: Custom Cache Handler", url: "https://nextjs.org/docs/app/building-your-application/deploying#configuring-caching" }
    ],
    "What happens when you scale Next.js to 10 pods without a custom `CacheHandler`?",
    "Each pod writes cached pages and tags to its local container filesystem. When a user triggers `revalidateTag()`, only the single pod receiving the request invalidates its cache. The other 9 pods continue serving stale data, creating severe UI inconsistency."
  ),

  card(
    114,
    "Memory Leak Triage & Heap Profiling in Next.js",
    "Deployment & Self-Hosting",
    "Deep Dive",
    "Memory leaks in long-running Node.js SSR servers are commonly caused by global closures, un-pruned EventEmitters, or creating unbounded client query clients (like `new QueryClient()` in global scope). Triage requires generating V8 heap snapshots.",
    `// Diagnosing Memory Leaks in Next.js Node.js Containers:
// 1. Launch Node with heap profiling flag:
// NODE_OPTIONS="--max-old-space-size=2048 --inspect=0.0.0.0:9229" node server.js

// 2. Programmatic Heap Snapshot Trigger on Memory Alert:
import v8 from "node:v8";
import fs from "node:fs";

export function takeHeapSnapshotOnMemorySpike() {
  const memoryUsage = process.memoryUsage();
  // If heap exceeds 1.5 GB, take emergency heap snapshot
  if (memoryUsage.heapUsed > 1.5 * 1024 * 1024 * 1024) {
    const snapshotStream = v8.getHeapSnapshot();
    const fileName = \`/tmp/heap-\${Date.now()}.heapsnapshot\`;
    const fileStream = fs.createWriteStream(fileName);
    snapshotStream.pipe(fileStream);
    console.error(\`CRITICAL MEMORY SPIKE: Heap snapshot saved to \${fileName}\`);
  }
}

// 3. Inspect the .heapsnapshot in Chrome DevTools Memory tab.
// Look for retaining paths with millions of string objects or closures!`,
    ["Memory Leaks", "Heap Snapshot", "Chrome DevTools", "SSR Debugging", "V8 Engine"],
    [
      { title: "Node.js Memory Leak Diagnostics", url: "https://nodejs.org/en/docs/guides/diagnostics/memory/" }
    ],
    "Why does instantiating global state objects outside React component bodies cause memory leaks in SSR?",
    "Module-level variables persist for the entire lifetime of the Node.js server process. If incoming request objects, user sessions, or event listeners are appended to global arrays or maps, they are never garbage-collected, steadily consuming RAM until the container crashes."
  ),

  card(
    115,
    "Node.js Cluster Mode & Multi-Core Scaling for Next.js",
    "Deployment & Self-Hosting",
    "Mastery",
    "Node.js is single-threaded. Running `node server.js` on an 8-core cloud instance leaves 7 cores idle. Using Node.js native clustering or PM2 forks worker processes across all available CPU cores.",
    `// cluster-server.js
import cluster from "node:cluster";
import os from "node:os";

const numCPUs = os.cpus().length;

if (cluster.isPrimary) {
  console.log(\`Primary cluster process \${process.pid} running. Forking \${numCPUs} workers...\`);

  // Fork a worker process for each CPU core
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on("exit", (worker, code, signal) => {
    console.warn(\`Worker \${worker.process.pid} died. Forking replacement worker...\`);
    cluster.fork();
  });
} else {
  // Workers share the TCP connection port 3000!
  // Imports the standalone Next.js server:
  import("./.next/standalone/server.js");
  console.log(\`Worker \${process.pid} started and accepting requests.\`);
}`,
    ["Clustering", "Multi-Core Scaling", "PM2", "Worker Processes", "CPU Utilization"],
    [
      { title: "Node.js Cluster Module", url: "https://nodejs.org/api/cluster.html" }
    ],
    "Why is running multiple container replicas in Kubernetes generally preferred over Node.js cluster mode in production?",
    "Container orchestration provides finer-grained resource limits (CPU/memory requests & limits), automated health-check restarts, independent scaling, and fault isolation across nodes."
  ),

  card(
    116,
    "Static Asset Serving: Nginx & CDN Ingress Rules",
    "Deployment & Self-Hosting",
    "Mastery",
    "Next.js builds output static chunks with content hashes (`_next/static/chunks/...`). Because filenames are immutable, reverse proxies (Nginx, Cloudflare) must cache them with a 1-year `immutable` Cache-Control header.",
    `# Nginx Production Configuration for Next.js
server {
    listen 80;
    server_name myapp.com;

    # 1. Immutable Static Chunks: Cache in browser & CDN for 1 year!
    location /_next/static/ {
        alias /app/.next/static/;
        expires 365d;
        access_log off;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }

    # 2. Public Static Assets (favicons, images)
    location /public/ {
        alias /app/public/;
        expires 7d;
        add_header Cache-Control "public, max-age=604800";
    }

    # 3. Dynamic Node.js SSR / Standalone Server Pass-Through
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_cache_bypass $http_upgrade;
    }
}`,
    ["Nginx", "Reverse Proxy", "Cache-Control", "Immutable Assets", "CDN Rules"],
    [
      { title: "Next.js Docs: CDN and Caching", url: "https://nextjs.org/docs/app/building-your-application/deploying/production-checklist#caching" }
    ],
    "Why can `_next/static/` files be cached with `Cache-Control: immutable` safely?",
    "Because every build generates unique cryptographic hashes in static filenames (e.g. `main-a8f9c1.js`). When a new deployment occurs, filenames change completely; existing cached files never become stale or corrupted."
  ),

  card(
    117,
    "Next.js Graceful Shutdown & In-Flight Request Draining",
    "Deployment & Self-Hosting",
    "Mastery",
    "When Kubernetes terminates a pod during deployments, sending `SIGTERM` must not drop active user connections. Next.js standalone servers intercept `SIGTERM` and drain active requests before exiting.",
    `// server.js (Or custom server entry)
import { createServer } from "node:http";
import next from "next";

const app = next({ dev: false });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));
  server.listen(3000);

  // Graceful Shutdown Handler:
  const shutdown = (signal: string) => {
    console.log(\`Received \${signal}. Draining in-flight requests...\`);
    server.close(() => {
      console.log("All HTTP connections drained. Process terminating cleanly.");
      process.exit(0);
    });

    // Hard kill after 15 seconds if requests hang
    setTimeout(() => {
      console.error("Forceful termination after 15s timeout.");
      process.exit(1);
    }, 15000);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
});`,
    ["Graceful Shutdown", "SIGTERM", "Connection Draining", "Kubernetes Lifecycle", "Zero-Downtime"],
    [
      { title: "Node.js Server Close Documentation", url: "https://nodejs.org/api/http.html#serverclosecallback" }
    ],
    "What occurs if a container exits immediately on `SIGTERM` without graceful draining?",
    "Active in-flight user requests (file uploads, payment transactions, database commits) are severed with HTTP connection reset errors (`ECONNRESET`), causing visible user errors during routine rolling deployments."
  ),

  card(
    118,
    "Environment Variables Management: Build-Time vs Runtime",
    "Deployment & Self-Hosting",
    "Mastery",
    "Environment variables prefixed with `NEXT_PUBLIC_` are statically inlined into client JavaScript bundles at build time. Non-prefixed variables exist strictly at server runtime. Using dynamic environment variables in Docker requires careful handling.",
    `// Environment Variable Matrix:
// 1. NEXT_PUBLIC_API_URL="https://api.com"
//    - Inlined into client bundle at BUILD TIME during 'next build'!
//    - Visible to anyone inspecting browser network/scripts!

// 2. DATABASE_URL="postgresql://user:pass@db:5432"
//    - Read at RUNTIME by Node.js server.
//    - Never sent to client browser.

// The Docker Trap:
// If you build your Docker image in CI without passing NEXT_PUBLIC_ vars,
// the client code bakes in 'undefined'!
// Solution: Pass build args in Dockerfile:
// ARG NEXT_PUBLIC_API_URL
// ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL`,
    ["Environment Variables", "NEXT_PUBLIC_", "Build Time vs Runtime", "Docker Inlining", "Security"],
    [
      { title: "Next.js Docs: Environment Variables", url: "https://nextjs.org/docs/app/building-your-application/configuring/environment-variables" }
    ],
    "Can you read non-prefixed server environment variables (like `DATABASE_PASSWORD`) inside a Client Component?",
    "No. Next.js replaces non-prefixed environment variables with `undefined` in client bundles to prevent catastrophic secret leaks.",
    "What is the danger of baking `NEXT_PUBLIC_` variables into a Docker container during CI?",
    "It breaks the Twelve-Factor principle of building once and deploying everywhere. You would have to rebuild the container for Staging versus Production if `NEXT_PUBLIC_` variables differ."
  ),

  card(
    119,
    "Next.js 15 Breaking Changes & Migration Roadmap",
    "Deployment & Self-Hosting",
    "Mastery",
    "Next.js 15 introduces critical breaking changes: 1) Asynchronous Request APIs (`cookies()`, `headers()`, `params`, `searchParams`), 2) Uncached `fetch` requests by default (`no-store`), 3) React 19 support with `useActionState`, and 4) Turbopack dev stability.",
    `// Next.js 15 Migration Checklist:
// 1. Await params & searchParams in pages:
// export default async function Page({ params }: { params: Promise<{ id: string }> }) {
//   const { id } = await params; // MUST AWAIT!
// }

// 2. Await cookies() and headers():
// const cookieStore = await cookies(); // MUST AWAIT!
// const headerStore = await headers(); // MUST AWAIT!

// 3. Update deprecated form state hook:
// Replace useFormState with useActionState from "react":
// const [state, action, isPending] = useActionState(serverAction, initialState);

// 4. Review fetch caching:
// Explicitly declare cache: 'force-cache' if you relied on Next.js 14 default caching!`,
    ["Next.js 15", "Breaking Changes", "React 19", "Migration Guide", "Async APIs"],
    [
      { title: "Next.js 15 Release Announcement", url: "https://nextjs.org/blog/next-15" }
    ],
    "Why did Next.js 15 make `cookies()` and `headers()` async?",
    "To prepare for future React architectures (Partial Prerendering, React 19 Server Context), allowing the server to decouple static layout rendering from request metadata streaming.",
    "What automated tool helps migrate codebases to Next.js 15?",
    "`npx @next/codemod@canary upgrade next-15`. Next.js provides automated codemods that rewrite synchronous `params` and `cookies()` calls to `await` across your repository."
  ),

  card(
    120,
    "Next.js Readiness & Architecture Decision Matrix",
    "Deployment & Self-Hosting",
    "Mastery",
    "Next.js 15 is the premier full-stack React framework for SEO-critical, content-rich, and e-commerce platforms. For purely authenticated, internal desktop-only admin tools with zero SEO requirements, a client-side SPA (Vite + React) may offer lower infrastructure complexity.",
    `// The Architecture Decision Matrix:
// CHOOSE NEXT.JS 15 (APP ROUTER) WHEN:
// - SEO & Public Discoverability are critical (E-commerce, Marketing, Blogs, Docs).
// - Low latency First Contentful Paint (FCP) and high Core Web Vitals directly impact revenue.
// - Multi-tier hybrid rendering (Static shell + Streaming personalized dynamic components) is needed.
// - You want to eliminate boilerplate REST APIs by leveraging Server Components & Server Actions.

// CHOOSE CLIENT-ONLY SPA (VITE + REACT) WHEN:
// - Strictly internal behind-the-login enterprise desktop tools (Zero SEO needs).
// - Complex offline-first applications with heavy local IndexedDB requirements.
// - No budget or operational capacity to run Node.js/Edge servers or manage SSR caching.`,
    ["Architecture Decision", "Next.js vs Vite", "Decision Matrix", "Enterprise Selection", "Trade-Offs"],
    [
      { title: "Vercel: When to use Next.js", url: "https://nextjs.org/docs" }
    ],
    "What is the single biggest architectural advantage Next.js 15 App Router holds over traditional SPAs?",
    "React Server Components and Streaming SSR: eliminating client JavaScript bloat, colocating direct backend queries without API boilerplate, and delivering optimal Core Web Vitals via automatic code splitting and hybrid prerendering."
  )
];

module.exports = { cards };
