const chapters = [
  {
    id: "next-deep-07",
    title: "Edge Runtime vs Node.js Server: V8 Isolates vs libuv Architecture",
    category: "Runtimes & Performance",
    readTimeMinutes: 28,
    overview: "Next.js offers two distinct server execution environments: the lightweight Edge Runtime (V8 Isolates) and the full Node.js Runtime. This masterclass compares their memory models, cold-start characteristics, TCP networking constraints, and architectural trade-offs.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        EDGE RUNTIME vs NODE.JS RUNTIME                            |
+-----------------------------------------------------------------------------------+
  EDGE RUNTIME (V8 Isolates)                          NODE.JS RUNTIME (libuv + V8)
  ==========================                          ============================
  - Boot Time: 0ms (Instant cold start)               - Boot Time: 150ms-500ms
  - Memory: Max 128MB per isolate                     - Memory: Multi-gigabyte heaps
  - Engine: Chrome V8 Isolates                        - Engine: Node.js + libuv thread pool
  - Networking: Web Standard fetch / WebSockets        - Networking: Native TCP sockets, net, dgram
  - Native Add-ons: FORBIDDEN (No C++ / Rust FFI)     - Native Add-ons: Full support (Sharp, Prisma)
  - Ideal For: Middleware, Geolocation, Auth Guards   - Ideal For: Heavy ORMs, SSR rendering, File IO
`,
    deepDive: `### 1. The V8 Isolate Architecture
Unlike traditional Node.js processes that allocate a complete virtual machine, event loop, and OS thread pool per instance:
- **V8 Isolates** are lightweight execution sandboxes within a single shared operating system process.
- Thousands of Isolates run side-by-side with zero memory bleeding.
- **Zero Cold Start**: An Isolate can be instantiated in less than 5 milliseconds, making it ideal for distributed edge deployments across hundreds of global PoPs (Points of Presence).

### 2. Networking and API Constraints
Because the Edge Runtime is not a complete Node.js environment, standard Node.js APIs are absent:
- **No File System**: \`fs.readFileSync\` throws a runtime error.
- **No Raw TCP Sockets**: Traditional database drivers (\`pg\`, \`mysql2\`, Prisma binary engine) that open raw TCP connections cannot execute in Edge Middleware.
- **Web Standard APIs**: The Edge Runtime implements the WinterCG standard: \`fetch\`, \`Request\`, \`Response\`, \`Headers\`, \`crypto.subtle\`, \`ReadableStream\`, and \`TextEncoder\`.
- **Database Access at the Edge**: Requires HTTP-based connection proxy drivers (Neon Serverless, PlanetScale HTTP, Upstash Redis, Prisma Accelerate).

### 3. Execution Budgets and CPU Limits
Edge functions enforce strict execution quotas:
- Typically **25ms to 50ms of active CPU time**.
- If middleware gets caught in an infinite loop, runs heavy synchronous regexes, or attempts to hash passwords with heavy PBKDF2/Bcrypt loops, the platform terminates the isolate with a 504 Gateway Timeout.`,
    edgeCasesAndPitfalls: [
      "Importing packages that rely on Node.js built-ins (`crypto`, `path`, `buffer`) into Edge Middleware without using Web Standard equivalents.",
      "Attempting to run CPU-heavy data transforms or image processing in Edge functions, triggering CPU execution timeouts.",
      "Assuming global variables persist between requests in Edge Isolates: Isolates can be recycled or spawned in different geographic regions at any time."
    ],
    keyTakeaways: [
      "The Edge Runtime uses lightweight V8 Isolates for instantaneous sub-millisecond cold starts.",
      "Edge code must use Web Standard APIs; Node.js `fs` and raw TCP sockets are unsupported.",
      "Keep Edge Middleware thin and stateless, reserving heavy database queries and rendering for the Node.js runtime."
    ]
  },

  {
    id: "next-deep-08",
    title: "Dynamic vs Static Route Evaluation Engine (`generateStaticParams` & dynamic IO)",
    category: "Rendering Lifecycle & PPR",
    readTimeMinutes: 29,
    overview: "How does Next.js determine whether a page is statically pre-rendered at build time or dynamically rendered on request? This masterclass deconstructs the build-time AST compiler, dynamic API heuristics, and Next.js 15's dynamicIO engine.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                     STATIC vs DYNAMIC EVALUATION DECISION TREE                    |
+-----------------------------------------------------------------------------------+
                         [ COMPILE ROUTE: next build ]
                                      |
                                      v
                      Does route use Dynamic Segment ([id])?
                                   /        \\
                            (YES) /          \\ (NO)
                                 v            v
                 Is generateStaticParams() defined?
                        /            \\
                 (YES) /              \\ (NO)
                      v                v
         Pre-render Static HTML      Is 'force-dynamic' or dynamic API used?
         for each returned param     (cookies(), headers(), searchParams)
                                             /        \\
                                      (YES) /          \\ (NO)
                                           v            v
                                    [ DYNAMIC λ ]   [ STATIC ○ ]
`,
    deepDive: `### 1. Build-Time AST Analysis
During \`next build\`, the compiler analyzes every Server Component in the route tree:
1. It scans for exports: \`export const dynamic\`, \`export const revalidate\`, \`export async function generateStaticParams\`.
2. It executes a test render pass of the component.
3. If the render pass completes without accessing dynamic request context, Next.js writes the generated HTML and Flight payload to disk as a static route (\`○\`).
4. If the render pass encounters a dynamic function (\`cookies()\`, \`headers()\`, or an uncached \`fetch\`), execution aborts, and Next.js marks the route as Dynamic (\`λ\`).

### 2. \`generateStaticParams\` Compilation Mechanics
For dynamic routes (\`app/posts/[id]/page.tsx\`):
- Next.js invokes \`generateStaticParams()\` at build time.
- For every object returned in the array, Next.js builds the static HTML and Flight payload in parallel worker threads.
- If an e-commerce catalog returns 5,000 product IDs, Next.js generates 5,000 static HTML files in the output directory.
- \`export const dynamicParams = true\`: Permits un-generated IDs to be rendered dynamically on first visit and cached via ISR.
- \`export const dynamicParams = false\`: Forces Next.js to return an instant 404 for any ID not returned at build time.

### 3. Next.js 15 \`dynamicIO\` Architecture
Next.js 15 introduces \`experimental: { dynamicIO: true }\`:
- In standard Next.js, an accidental uncached fetch silently turns an entire static page dynamic.
- With \`dynamicIO\`, the compiler strictly forbids uncached asynchronous I/O during static rendering.
- All I/O must either be explicitly cached using the new \`"use cache"\` directive or wrapped inside an asynchronous Suspense boundary for Partial Prerendering.`,
    edgeCasesAndPitfalls: [
      "Accessing `searchParams` on an otherwise static page, which silently de-optimizes the entire page into dynamic SSR.",
      "Database queries without `React.cache()` executing redundant identical queries during `generateStaticParams` builds.",
      "Forgetting `export const dynamicParams = false` on restricted routes, allowing visitors to trigger expensive on-demand SSR on invalid URLs."
    ],
    keyTakeaways: [
      "Next.js automatically evaluates routes as Static (○) or Dynamic (λ) based on dynamic API usage.",
      "Use `generateStaticParams()` to pre-render dynamic segments into static HTML at build time.",
      "Next.js 15's `dynamicIO` forces I/O to be explicitly cached via `'use cache'` or wrapped in Suspense."
    ]
  },

  {
    id: "next-deep-09",
    title: "`next/image` Internal Architecture: Sharp, Resizing & CDN Caching",
    category: "Assets & Performance",
    readTimeMinutes: 27,
    overview: "Serving un-optimized images is the #1 cause of poor Core Web Vitals. This masterclass dives into the internal image optimization server, Sharp C++ binding pipelines, AVIF/WebP transcoding, responsive srcset generation, and edge caching rules.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        NEXT/IMAGE OPTIMIZATION PIPELINE                           |
+-----------------------------------------------------------------------------------+
  [ Client Browser: Requests Image with Viewport Constraints ]
  GET /_next/image?url=https://s3.../photo.jpg&w=640&q=75
  Header: Accept: image/avif,image/webp,*/*
            |
            v
  +-------------------------------------------------------------------------------+
  | NEXT.JS IMAGE OPTIMIZATION SERVER                                             |
  |                                                                               |
  | 1. Security Check: Is remote domain in images.remotePatterns?                 |
  | 2. Cache Lookup: Does transformed image exist in .next/cache/images?         |
  |    - If Cache Hit -> Serve immediately with 1-year Cache-Control header!      |
  | 3. Cache Miss: Fetch upstream original high-res image from S3                 |
  | 4. Sharp C++ Pipeline:                                                        |
  |    - Resize to exact target width (w=640)                                     |
  |    - Transcode to AVIF (if client supports) or WebP (compression 75%)        |
  | 5. Write optimized image to disk cache and stream response                    |
  +-------------------------------------------------------------------------------+
`,
    deepDive: `### 1. The On-Demand Transformation Architecture
Unlike static build-time image plugins that generate hundreds of image variations during \`npm run build\` (bloating build times to hours), Next.js optimizes images **on-demand on first request**:
- Images are requested via the internal handler: \`/_next/image?url=...&w=...&q=...\`.
- Next.js inspects the browser's \`Accept\` HTTP header:
  - If the browser supports AVIF, Next.js transcodes to AVIF (20% smaller than WebP).
  - If the browser supports WebP, Next.js transcodes to WebP.
  - If legacy, it falls back to optimized JPEG.
- The optimized asset is cached on disk and served with an immutable 1-year Cache-Control header.

### 2. High-Performance Native Sharp Pipeline
Next.js utilizes **Sharp**, a high-performance C++ libvips wrapper:
- In production containers, ensure \`sharp\` is installed (\`npm install sharp\`).
- If Sharp is missing, Next.js falls back to Squoosh (WebAssembly), which is significantly slower and consumes substantial CPU.

### 3. The Mathematics of the \`sizes\` Attribute
The \`sizes\` prop informs the browser's preload scanner how wide the image will render on screen before CSS and layout download:
\`\`\`jsx
<Image
  src="/banner.jpg"
  fill
  sizes="(max-width: 768px) 100vw, 50vw"
/>
\`\`\`
- On a mobile device with 390px viewport and a 3x Retina display, the browser calculates: \`390px * 100% * 3 = 1170px\`.
- The browser selects the closest matching width from the \`srcset\` array (e.g. \`w=1200\`), avoiding downloading the full 4000px asset while ensuring crisp display on high-DPI screens.`,
    edgeCasesAndPitfalls: [
      "Missing `sharp` dependency in production Docker containers, causing Next.js to fall back to slow WebAssembly image resizing.",
      "Using `fill` without `sizes`: defaults to `100vw`, forcing desktop 4-column grids to download giant 4K images.",
      "Disk exhaustion in self-hosted environments: high-traffic image resizing without disk cache pruning filling up `.next/cache/images`."
    ],
    keyTakeaways: [
      "`next/image` transcodes on-demand to AVIF and WebP using the native C++ Sharp engine.",
      "Always configure `sizes` when using `fill` to prevent browsers from requesting oversized assets.",
      "Install `sharp` explicitly in production Docker containers for 5x faster image processing."
    ]
  },

  {
    id: "next-deep-10",
    title: "Multi-Tenant Subdomain Routing & Rewrite Architecture at Edge Middleware",
    category: "Middleware & Architecture",
    readTimeMinutes: 28,
    overview: "Building multi-tenant SaaS applications on Next.js allows serving thousands of independent customer brands from a single deployment. This masterclass analyzes Edge Middleware host inspection, internal path rewriting, and dynamic custom domain routing.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        MULTI-TENANT SUBDOMAIN REWRITE FLOW                        |
+-----------------------------------------------------------------------------------+
  [ Incoming HTTP Request: https://acme.enterprise.com/billing ]
                            |
                            v
  +-------------------------------------------------------------------------------+
  | EDGE MIDDLEWARE (middleware.ts)                                               |
  |                                                                               |
  | 1. Extract Host Header: "acme.enterprise.com"                                 |
  | 2. Parse Subdomain: "acme"                                                    |
  | 3. Execute Rewrite:                                                           |
  |    NextResponse.rewrite(/tenants/acme/billing)                                |
  +-------------------------------------------------------------------------------+
                            |
                            v (Internal Route Match)
  +-------------------------------------------------------------------------------+
  | APP ROUTER FILE SYSTEM                                                        |
  | app/tenants/[tenantId]/billing/page.tsx                                       |
  | - params.tenantId resolves to "acme"                                          |
  | - Browser URL remains: https://acme.enterprise.com/billing                    |
  +-------------------------------------------------------------------------------+
`,
    deepDive: `### 1. Single-Deployment Multi-Tenancy Architecture
Rather than provisioning separate Next.js containers or repositories for each customer tenant:
- A single Next.js cluster serves all traffic.
- The routing system is partitioned inside \`app/tenants/[tenantId]/\`.
- Edge Middleware acts as an internal reverse proxy, mapping incoming hostnames directly to the \`[tenantId]\` dynamic segment.

### 2. Custom Domain Resolution at the Edge
For enterprise customers with custom domains (e.g. \`https://portal.customerbrand.com\`):
1. The customer points their CNAME record to your platform domain.
2. The incoming request arrives at Edge Middleware with \`Host: portal.customerbrand.com\`.
3. Middleware queries a globally replicated edge key-value store (e.g. Vercel Edge Config, Cloudflare KV, or Redis) in < 2ms:
   \`\`\`typescript
   const tenantId = await edgeConfig.get(hostname); // returns "acme"
   \`\`\`
4. Middleware rewrites to \`/tenants/\${tenantId}\${pathname}\`.
5. The customer sees their own custom domain with zero rebranding while your backend codebase remains unified.

### 3. Tenant Isolation and Security
- Every Server Action and database query must enforce tenant boundary assertions (\`WHERE tenant_id = session.tenant_id\`).
- Never rely solely on the URL \`tenantId\` for authorization; always cross-verify the authenticated user's session against the requested tenant.`,
    edgeCasesAndPitfalls: [
      "Failing to handle local development environments: `localhost:3000` breaking subdomain parsing logic (always check for localhost/root domain).",
      "Slow database queries in middleware to resolve custom domains: always use low-latency Edge Key-Value stores (< 5ms) to avoid blocking every incoming request.",
      "Missing tenant authorization: trusting the rewritten `tenantId` parameter without checking whether the user belongs to that organization."
    ],
    keyTakeaways: [
      "Edge Middleware inspects the `Host` header and rewrites to internal `[tenantId]` folder routes.",
      "Custom domains can be mapped to tenant IDs using low-latency Edge Key-Value stores.",
      "Always enforce tenant data isolation in database queries, never trusting URL parameters alone."
    ]
  },

  {
    id: "next-deep-11",
    title: "Self-Hosting Next.js with Docker Standalone, Redis Cache Handler & Node Cluster",
    category: "Deployment & Self-Hosting",
    readTimeMinutes: 30,
    overview: "Deploying Next.js outside Vercel requires mastering production self-hosting architecture. This masterclass covers Docker multi-stage builds with standalone tracing, shared Redis Data Caching across Kubernetes replicas, and Nginx reverse proxy asset caching.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        ENTERPRISE NEXT.JS SELF-HOSTED TOPOLOGY                    |
+-----------------------------------------------------------------------------------+
                             [ PUBLIC CLIENT TRAFFIC ]
                                         |
                                         v
                         +-------------------------------+
                         |      NGINX INGRESS / CDN      |
                         | - /_next/static/ -> 1-Yr Cache|
                         | - /public/       -> 7-Day     |
                         | - Dynamic SSR    -> Proxy Pass|
                         +-------------------------------+
                                         |
                     +-------------------+-------------------+
                     |                                       |
                     v                                       v
        +-------------------------+             +-------------------------+
        | K8s POD 1: STANDALONE   |             | K8s POD 2: STANDALONE   |
        | - node server.js        |             | - node server.js        |
        | - Redis CacheHandler    |             | - Redis CacheHandler    |
        +-------------------------+             +-------------------------+
                     \\                                       /
                      +==================+==================+
                                         |
                                         v
                         +-------------------------------+
                         |    SHARED REDIS DATA CACHE    |
                         | - Shared fetch Data Cache     |
                         | - Cluster-wide revalidateTag  |
                         +-------------------------------+
`,
    deepDive: `### 1. The Output Standalone Build Mechanism
In standard Next.js, running \`next start\` requires the full project directory, \`package.json\`, and a multi-gigabyte \`node_modules\` folder.
- Setting \`output: 'standalone'\` in \`next.config.js\` activates AST dependency tracing.
- The build produces a minimal, self-contained bundle at \`.next/standalone/\` with its own embedded \`server.js\`.
- Only packages and files actually imported in the code are copied, reducing container size from 1.5GB to ~100MB.

### 2. Multi-Pod Cache Synchronization via Redis CacheHandler
In a multi-pod Kubernetes deployment, local file-system caching causes cache desynchronization:
- If Pod 1 receives an ISR revalidation or \`revalidateTag('catalog')\` call, it updates its local disk cache. Pods 2 through 10 continue serving stale data.
- **The Solution**: A custom \`CacheHandler\` configured in \`next.config.js\`.
- All pods connect to a shared Redis cluster. When Pod 1 purges a tag, Redis deletes the keys globally, ensuring all pods instantly serve fresh data.

### 3. Nginx Ingress Architecture for Static Assets
The standalone Next.js Node.js server should never waste CPU cycles serving static files:
- Static assets in \`.next/static\` have content hashes in their filenames and never change.
- Nginx intercepts \`/_next/static/\` and serves files directly from shared disk with:
  \`\`\`nginx
  location /_next/static/ {
      alias /app/.next/static/;
      add_header Cache-Control "public, max-age=31536000, immutable";
  }
  \`\`\`
- Node.js processes handle only dynamic Server Component rendering and Server Actions.`,
    edgeCasesAndPitfalls: [
      "Forgetting to copy `public/` and `.next/static/` into `.next/standalone` inside the Dockerfile, causing broken styles (404 on `_next/static/css/...`).",
      "Running Next.js containers as root user in Docker, creating severe container breakout vulnerabilities.",
      "Missing `HOSTNAME='0.0.0.0'` in container environments: standalone server defaults to `localhost`, rejecting external Kubernetes service traffic."
    ],
    keyTakeaways: [
      "Use `output: 'standalone'` to reduce Docker container image sizes by up to 90%.",
      "Configure a shared Redis `CacheHandler` to synchronize Data Cache and ISR across Kubernetes pods.",
      "Offload static asset delivery to Nginx or a CDN with 1-year immutable caching."
    ]
  },

  {
    id: "next-deep-12",
    title: "Next.js 15 & React 19 Paradigm Shifts: Async Request APIs, Caching Defaults & Actions",
    category: "Next.js 15 & React 19",
    readTimeMinutes: 29,
    overview: "Next.js 15 represents a major architectural evolution, aligning with React 19. This masterclass analyzes the transition to asynchronous request APIs (cookies, headers, params), uncached fetch defaults, React 19 Action hooks (useActionState), and Turbopack stabilization.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        NEXT.JS 14 vs NEXT.JS 15 PARADIGM SHIFT                    |
+-----------------------------------------------------------------------------------+
  FEATURE                     NEXT.JS 14 (LEGACY)               NEXT.JS 15 (MODERN)
  =======                     ===================               ===================
  fetch() Caching             cache: 'force-cache' by default   cache: 'no-store' by default (Uncached!)
  cookies() & headers()       Synchronous functions             Asynchronous Promises (await cookies())
  Page params & searchParams  Synchronous props                 Asynchronous Promises (await params)
  Form State Hook             useFormState (deprecated)         useActionState (React 19 native)
  Prerendering Paradigm       Full SSG or Full SSR              Partial Prerendering (PPR / dynamicIO)
  Dev Compiler Engine         Webpack default                   Turbopack stabilized for development
`,
    deepDive: `### 1. Asynchronous Request Context APIs
In Next.js 15, reading request metadata is strictly asynchronous:
\`\`\`typescript
// Next.js 15 Standard:
export default async function Page({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ query?: string }>;
}) {
  const { id } = await params;           // MUST AWAIT!
  const { query } = await searchParams; // MUST AWAIT!
  const cookieStore = await cookies();   // MUST AWAIT!
  const headerStore = await headers();   // MUST AWAIT!
}
\`\`\`
- **Why this was changed**: In React 19 and Partial Prerendering, the server begins rendering the static layout shell before incoming request parameters are even parsed. Making dynamic parameters asynchronous allows React to defer reading them until the dynamic streaming phase without blocking the static shell.

### 2. Uncached Defaults for Fetch & Route Handlers
The most celebrated change in Next.js 15 is the removal of aggressive default caching:
- In Next.js 14, calling \`fetch("https://api.com/items")\` cached the response permanently unless explicitly configured otherwise.
- In Next.js 15, \`fetch()\` defaults to \`cache: 'no-store'\`. Requests always fetch fresh data unless explicitly opted into caching with \`cache: 'force-cache'\` or \`next: { revalidate: N }\`.
- GET Route Handlers also default to uncached dynamic responses.

### 3. React 19 Action Hooks Integration
Next.js 15 adopts React 19's native action primitives:
- \`useActionState\` replaces \`useFormState\`, returning \`[state, formAction, isPending]\`.
- \`useOptimistic\` provides instant optimistic UI updates with automated rollback.
- \`useFormStatus\` provides child button pending indicators without prop drilling.
- \`use(promise)\` enables reading promises directly inside client components within Suspense boundaries.`,
    edgeCasesAndPitfalls: [
      "Accessing `params.id` synchronously without `await` in Next.js 15, throwing runtime deprecation warnings and failing in future releases.",
      "Relying on Next.js 14's default fetch caching behavior when upgrading: data fetches will execute on every request unless explicitly marked with `force-cache`.",
      "Using the deprecated `useFormState` hook instead of React 19's `useActionState`."
    ],
    keyTakeaways: [
      "Next.js 15 mandates awaiting `params`, `searchParams`, `cookies()`, and `headers()`.",
      "`fetch()` requests in Next.js 15 default to `no-store`, eliminating unexpected stale data bugs.",
      "React 19 brings first-class Action hooks (`useActionState`, `useOptimistic`) natively into Next.js 15."
    ]
  }
];

module.exports = { chapters };
