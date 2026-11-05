// scripts/generate_next_production.cjs
const fs = require('fs');
const path = require('path');

const runbooks = [
  {
    id: "next-prod-01",
    topic: "Multi-Container Data Cache Desynchronization & Stale State Drift in Kubernetes",
    category: "Caching & State Consistency",
    severity: "P0 - Critical Outage",
    theProblem: "After rolling out an e-commerce price update, users report inconsistent product pricing. Refreshing the same page alternates between $49.99 and $99.99 depending on which Kubernetes pod handles the request. Customers complete purchases at outdated discounted prices, causing revenue loss and customer support chaos.",
    howItWorksInternally: "By default, Next.js App Router stores its Data Cache (from tagged fetch requests and ISR) on the local filesystem (.next/cache/fetch-cache). When deployed across horizontally scaled Kubernetes pods or container tasks behind an AWS ALB round-robin load balancer, each pod maintains an isolated, independent cache file store. Calling revalidateTag() or revalidatePath() inside a Server Action only clears the local disk cache of the specific pod servicing that HTTP request. The remaining 9 pods continue serving stale cached responses until their TTL expires.",
    productionCode: `// cache-handler.mjs - Production Shared Redis Cache Handler
import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL || 'redis://redis-cluster:6379',
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 1000),
  },
});

redis.on('error', (err) => console.error('[CacheHandler] Redis Error:', err));
await redis.connect();

export default class ProductionCacheHandler {
  constructor(options) {
    this.options = options;
  }

  async get(key) {
    try {
      const data = await redis.get(\`next:cache:\${key}\`);
      if (!data) return null;
      return JSON.parse(data);
    } catch (err) {
      console.warn('[CacheHandler] Failed to read from Redis, bypassing cache:', err);
      return null;
    }
  }

  async set(key, data, ctx) {
    try {
      const ttl = typeof ctx?.revalidate === 'number' && ctx.revalidate > 0 ? ctx.revalidate : 86400;
      await redis.setEx(\`next:cache:\${key}\`, ttl, JSON.stringify(data));

      // Index tags to keys for fast cluster-wide invalidation
      if (ctx?.tags?.length) {
        for (const tag of ctx.tags) {
          await redis.sAdd(\`next:tags:\${tag}\`, key);
          await redis.expire(\`next:tags:\${tag}\`, 86400 * 7);
        }
      }
    } catch (err) {
      console.error('[CacheHandler] Failed to write cache entry:', err);
    }
  }

  async revalidateTag(tag) {
    try {
      const tagKey = \`next:tags:\${tag}\`;
      const keys = await redis.sMembers(tagKey);
      if (keys.length > 0) {
        const cacheKeys = keys.map((k) => \`next:cache:\${k}\`);
        await redis.del(cacheKeys);
        await redis.del(tagKey);
      }
      console.log(\`[CacheHandler] Purged \${keys.length} keys for tag '\${tag}' across cluster.\`);
    } catch (err) {
      console.error(\`[CacheHandler] Failed to revalidate tag \${tag}:\`, err);
    }
  }
}

// next.config.mjs
/** @type {import('next').NextConfig} */
const nextConfig = {
  cacheHandler: process.env.NODE_ENV === 'production'
    ? require.resolve('./cache-handler.mjs')
    : undefined,
};

export default nextConfig;`,
    monitoringMetrics: [
      "sum(rate(redis_commands_total{cmd=~'get|set|del'}[1m])) by (cmd)",
      "histogram_quantile(0.99, rate(nextjs_cache_handler_latency_seconds_bucket[5m]))",
      "count(distinct(http_response_content_etag)) by (url_path) > 1"
    ],
    productionChecklist: [
      "Configure next.config.mjs to hook a centralized Redis cluster via custom cacheHandler.",
      "Ensure all tag mappings (sAdd) maintain a safety TTL to avoid unbounded Redis memory growth.",
      "Verify that revalidateTag() purges Redis keys synchronously across all Kubernetes pods.",
      "Add health check fallback in cache-handler.mjs so that Redis failures gracefully degrade to direct database queries rather than crashing 500."
    ]
  },
  {
    id: "next-prod-02",
    topic: "Accidental Database Credentials & Private Secret Leakage into Client RSC Bundles",
    category: "Security & Compliance",
    severity: "P0 - Critical Outage",
    theProblem: "A security researcher reports that the entire AWS_SECRET_ACCESS_KEY and MASTER_DATABASE_URL were exposed in cleartext inside the browser window.__next_f hydration chunks on the public marketing page. Automated scanners immediately scrape the keys and attempt unauthorized IAM assume-role operations.",
    howItWorksInternally: "React Server Components serialize props passed into Client Components into the RSC Flight stream JSON payload. If a developer accidentally imports a server utility or passes a wide user/organization object containing encrypted keys, password hashes, or internal database client handles across the Server/Client boundary (e.g., <UserProfile user={userWithCredentials} />), Next.js serializes all enumerable properties into the client HTML and RSC flight payload. Because 'use server' components execute in Node, developers mistakenly assume all child component arguments remain hidden on the server.",
    productionCode: `// 1. Enforce strict isolation at module boundary using 'server-only'
// lib/db.ts
import 'server-only'; // THROWS BUILD ERROR if imported in any 'use client' file
import { PrismaClient } from '@prisma/client';

export const db = new PrismaClient();

// 2. Leverage React 19 / Next.js 15 Experimental Taint API to block secret serialization
// lib/auth/security.ts
import 'server-only';
import { experimental_taintObjectReference, experimental_taintUniqueValue } from 'react';

export function secureUserSession(user: any) {
  // If this object or its database connection token is EVER passed to a Client Component,
  // React immediately throws an unhandled server serialization exception at build/request time!
  experimental_taintObjectReference(
    'Forbidden: Entire User Security Principal object must never be passed to Client Components',
    user
  );

  experimental_taintUniqueValue(
    'Forbidden: User password hash or secret key cannot be sent to the browser',
    user,
    user.passwordHash
  );

  return user;
}

// 3. Proper prop projection DTO pattern
// app/users/[id]/page.tsx
import { db } from '@/lib/db';
import { secureUserSession } from '@/lib/auth/security';
import { ClientAvatar } from './ClientAvatar';

export default async function UserPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rawUser = await db.user.findUniqueOrThrow({ where: { id } });
  secureUserSession(rawUser);

  // SANITIZE: Explicitly pick ONLY public display attributes for the Client Component
  const safeProfile = {
    displayName: rawUser.displayName,
    avatarUrl: rawUser.avatarUrl,
  };

  return <ClientAvatar profile={safeProfile} />;
}`,
    monitoringMetrics: [
      "sum(rate(waf_blocked_requests{rule='credential_scraping'}[1m]))",
      "count(nextjs_taint_serialization_violations_total)",
      "git_secrets_pre_commit_scan_failures"
    ],
    productionChecklist: [
      "Immediately rotate leaked AWS IAM keys and database master passwords in AWS Secrets Manager.",
      "Add 'import server-only' to all database, crypto, and backend API helper modules.",
      "Implement experimental_taintObjectReference() and experimental_taintUniqueValue() on all auth records.",
      "Verify RSC Flight stream output in production builds via curl -H 'Accept: text/x-component' to audit payload."
    ]
  },
  {
    id: "next-prod-03",
    topic: "Server Action CSRF & Unauthenticated Remote Execution Vulnerability",
    category: "Security & Compliance",
    severity: "P0 - Critical Outage",
    theProblem: "An attacker creates a malicious third-party website that triggers Next.js Server Actions via forged POST requests. Users visiting the attacker's site have their email addresses changed, API keys regenerated, and subscription plans cancelled without their knowledge or authorization.",
    howItWorksInternally: "Every function marked with 'use server' exports an opaque cryptographic action ID that is exposed as an accessible public HTTP POST endpoint (e.g. POST / with header 'Next-Action: 7b819c4...'). If the developer writes a Server Action without verifying user session tokens, permissions, or tenant ID inside the action body, anyone can invoke the action directly via curl or CSRF payloads. While Next.js 14/15 includes origin-checking protections for form submissions, automated API clients or cross-origin fetch requests without credentials can still abuse unauthenticated actions.",
    productionCode: `// lib/safeAction.ts - Production Higher-Order Server Action Guard
'use server';

import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { z } from 'zod';

export type ActionContext = {
  userId: string;
  role: string;
  tenantId: string;
};

export function createProtectedAction<TInput, TOutput>(
  schema: z.ZodSchema<TInput>,
  handler: (input: TInput, ctx: ActionContext) => Promise<TOutput>
) {
  return async (rawInput: unknown): Promise<{ success: boolean; data?: TOutput; error?: string }> => {
    // 1. Verify Origin and Host header alignment against CSRF attacks
    const headerList = await headers();
    const origin = headerList.get('origin');
    const host = headerList.get('host');

    if (origin && !origin.includes(host || '')) {
      return { success: false, error: 'CSRF Violation: Origin header does not match host.' };
    }

    // 2. Validate active authentication session and tenant context
    const session = await auth();
    if (!session || !session.user) {
      return { success: false, error: 'Unauthorized: Valid session required.' };
    }

    // 3. Validate input payload strictly with Zod
    const parsed = schema.safeParse(rawInput);
    if (!parsed.success) {
      return { success: false, error: 'Bad Request: ' + parsed.error.issues[0].message };
    }

    // 4. Execute business logic with verified context
    try {
      const result = await handler(parsed.data, {
        userId: session.user.id,
        role: session.user.role,
        tenantId: session.user.tenantId,
      });
      return { success: true, data: result };
    } catch (err: any) {
      console.error('[Action Execution Error]:', err);
      return { success: false, error: 'Internal Server Error' };
    }
  };
}

// app/actions/account.ts (Usage)
const changeEmailSchema = z.object({ newEmail: z.string().email() });

export const changeEmailAction = createProtectedAction(changeEmailSchema, async ({ newEmail }, ctx) => {
  // Safe: ctx.userId is cryptographically guaranteed from session, impossible to spoof!
  await db.user.update({
    where: { id: ctx.userId, tenantId: ctx.tenantId },
    data: { email: newEmail },
  });
  return { updated: true };
});`,
    monitoringMetrics: [
      "sum(rate(http_requests_total{status='403',route=~'.*Next-Action.*'}[1m]))",
      "count(server_action_unauthorized_attempts_total)",
      "waf_csrf_token_mismatch_rate"
    ],
    productionChecklist: [
      "Wrap all Server Actions in a centralized authentication and authorization middleware wrapper.",
      "Always validate input payloads with Zod; never cast incoming parameters as 'any'.",
      "Ensure origin and host headers match on all state-mutating Server Action POST requests.",
      "Never pass client-supplied IDs (e.g. userId from client form) directly into database mutation WHERE clauses."
    ]
  },
  {
    id: "next-prod-04",
    topic: "Edge Middleware Execution Timeout & Event Loop Lockup on High Traffic",
    category: "Edge & Middleware",
    severity: "P0 - Critical Outage",
    theProblem: "During a flash-sale event, the entire website begins throwing HTTP 500 and 504 Gateway Timeout errors. Vercel / Cloudflare edge logs indicate Edge Middleware timed out exceeding the 50ms subrequest execution budget on 80% of incoming requests.",
    howItWorksInternally: "Next.js Edge Middleware runs in lightweight V8 isolates on edge nodes (Cloudflare Workers, Vercel Edge). Unlike Node.js servers, edge workers have strict CPU execution limits (typically 50ms CPU time and 128MB memory). When developers make multiple blocking network calls (e.g. contacting legacy SQL databases via TCP, querying remote un-cached session stores, or running heavy JSON parsing/regexes) on every single asset and page request, the edge isolate's execution queue starves, causing catastrophic timeout termination.",
    productionCode: `// middleware.ts - Production Edge Middleware with Strict Sub-millisecond Execution
import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || '32-char-min-secret-key-prod');

// 1. In-memory LRU cache inside Edge Isolate to avoid repeated JWT verification overhead
const sessionVerificationCache = new Map<string, { payload: any; exp: number }>();

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    // Instant redirect without blocking async compute
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('from', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 2. Check local isolate memory cache first (0.01ms latency)
  const cached = sessionVerificationCache.get(token);
  const now = Math.floor(Date.now() / 1000);

  if (cached && cached.exp > now) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', cached.payload.sub);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  try {
    // 3. Fast cryptographic signature verification using Edge-optimized 'jose'
    const { payload } = await jwtVerify(token, JWT_SECRET, { algorithms: ['HS256'] });

    // Store in isolate cache with TTL
    sessionVerificationCache.set(token, {
      payload,
      exp: payload.exp || now + 300,
    });

    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', String(payload.sub));

    return NextResponse.next({ request: { headers: requestHeaders } });
  } catch (err) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }
}

// 4. CRITICAL: Restrict matcher to strictly match only protected dynamic pages
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/account/:path*',
    '/api/protected/:path*',
  ],
};`,
    monitoringMetrics: [
      "histogram_quantile(0.99, rate(edge_middleware_execution_duration_ms_bucket[1m]))",
      "sum(rate(edge_middleware_cpu_limit_exceeded_total[1m]))",
      "edge_worker_memory_utilization_ratio"
    ],
    productionChecklist: [
      "Restrict middleware.ts config.matcher to strictly required path prefixes, completely bypassing static assets and public marketing pages.",
      "Never open direct TCP database connections (Prisma, pg) inside Edge Middleware; use edge HTTP endpoints or JWTs.",
      "Implement local LRU memory caching within the isolate to cache token verification passes.",
      "Set aggressive subrequest timeout budgets (AbortSignal.timeout(1500)) for any external fetch in middleware."
    ]
  },
  {
    id: "next-prod-05",
    topic: "Hydration Mismatch Death Spiral & Client-Side DOM Replacement Crash",
    category: "Client Hydration & Rendering",
    severity: "P1 - High Severity",
    theProblem: "Users on mobile web report UI flicker where buttons fail to respond to taps, forms reset unexpectedly while typing, and the browser console explodes with 'Hydration failed because the initial UI does not match what was rendered on the server' and 'There was an error while hydrating. Because the error was caught by the nearest error boundary, React rendered the entire root from scratch'.",
    howItWorksInternally: "React SSR renders HTML into strings on the server. When the browser receives the HTML, React executes hydration to attach event listeners to existing DOM nodes. If there is any divergence between server HTML and initial client DOM (e.g. using typeof window !== 'undefined', referencing localStorage, using Date.now() or new Date().toLocaleTimeString(), or invalid HTML nesting like <div> inside <p>), React detects a tree mismatch. In React 18/19, severe mismatches cause React to abandon hydration, scrap the server DOM, and re-render the entire component tree on the client, discarding user focus, in-flight inputs, and causing huge layout shifts.",
    productionCode: `// components/SafeTimestamp.tsx - Bulletproof Hydration Solution
'use client';

import { useSyncExternalStore } from 'react';

// Hydration-safe client-only store subscription
function subscribe(callback: () => void) {
  return () => {}; // No-op subscription
}

export function useIsHydrated() {
  return useSyncExternalStore(
    subscribe,
    () => true,  // Client snapshot: true after hydration
    () => false // Server snapshot: always false during SSR
  );
}

interface SafeDateDisplayProps {
  timestamp: string | number | Date;
}

export function SafeDateDisplay({ timestamp }: SafeDateDisplayProps) {
  const isHydrated = useIsHydrated();
  const dateObj = new Date(timestamp);

  // Server: renders deterministic UTC ISO string
  // Client: once hydrated, smoothly updates to user's localized time zone
  if (!isHydrated) {
    return (
      <time dateTime={dateObj.toISOString()} suppressHydrationWarning>
        {dateObj.toISOString().slice(0, 10)}
      </time>
    );
  }

  return (
    <time dateTime={dateObj.toISOString()} suppressHydrationWarning>
      {dateObj.toLocaleString()}
    </time>
  );
}

// Validation Guide: Check for invalid HTML nesting in ESLint
// .eslintrc.json
/*
{
  "rules": {
    "react/no-unescaped-entities": "error",
    "@next/next/no-html-link-for-pages": "error"
  }
}
*/`,
    monitoringMetrics: [
      "sum(rate(client_telemetry_errors_total{error_type='hydration_mismatch'}[5m]))",
      "histogram_quantile(0.95, rate(web_vitals_cls_bucket[5m]))",
      "count(react_hydration_error_boundary_trips)"
    ],
    productionChecklist: [
      "Never read window, document, or localStorage directly in component rendering phase.",
      "Use useSyncExternalStore to detect client hydration without causing dual-render cascades.",
      "Audit HTML nesting for strict compliance (never nest <div> or <p> inside <p>, never nest <a> inside <a>).",
      "Apply suppressHydrationWarning strictly on individual leaf nodes (e.g. timestamps) where differences are intentional."
    ]
  },
  {
    id: "next-prod-06",
    topic: "Client Router Cache Stale View Trap After External Background Database Mutations",
    category: "Caching & Navigation",
    severity: "P1 - High Severity",
    theProblem: "A support agent marks a customer ticket as 'Resolved' in an administrative portal. When navigating back to the ticket inbox via the left sidebar (<Link href='/inbox'>), the ticket still shows as 'Open'. Only a hard browser refresh (Cmd+Shift+R) updates the status. Customers complain that changes are not saving.",
    howItWorksInternally: "Next.js App Router includes an aggressive in-memory Client-Side Router Cache that stores visited RSC payloads in browser memory for 30 seconds (dynamic routes) or 5 minutes (static routes). When the user clicks a <Link>, Next.js instantly renders the cached RSC payload from memory without issuing a network request. If a database mutation occurred externally (via webhook, background worker, or direct REST API call rather than a Next.js Server Action), the client router cache has no knowledge of the change and serves the stale in-memory snapshot indefinitely.",
    productionCode: `// 1. Solution A: Force Server Action revalidation when mutating
// app/actions/ticket.ts
'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';

export async function resolveTicketAction(ticketId: string) {
  await db.ticket.update({
    where: { id: ticketId },
    data: { status: 'RESOLVED' },
  });

  // Purge server route cache AND signal client router cache to bust
  revalidatePath('/inbox');
  return { ok: true };
}

// 2. Solution B: Client-side Navigation with explicit cache refresh
// components/SidebarNavigation.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

export function InboxLink() {
  const router = useRouter();

  const handleFreshNavigation = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    // router.refresh() invalidates the Client Router Cache and fetches the fresh RSC tree
    router.refresh();
    router.push('/inbox');
  };

  return (
    <a
      href="/inbox"
      onClick={handleFreshNavigation}
      className="flex items-center px-4 py-2 text-sm font-medium hover:bg-neutral-100"
    >
      Inbox
    </a>
  );
}

// 3. Solution C: Opt page out of Client Router Caching via headers
// app/inbox/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0; // Ensures server never serves cached response`,
    monitoringMetrics: [
      "sum(rate(client_stale_data_reports_total[1h]))",
      "count(nextjs_router_cache_hits_total) by (route)",
      "ratio(client_hard_refreshes / client_soft_navigations)"
    ],
    productionChecklist: [
      "Ensure all internal state mutations invoke revalidatePath() or revalidateTag() in a Server Action.",
      "Call router.refresh() before or after programmatic router.push() when external systems mutate state.",
      "Configure 'export const dynamic = force-dynamic' and 'export const revalidate = 0' on sensitive realtime dashboards.",
      "In Next.js 15, verify staleTimes configuration in next.config.ts (dynamic: 0, static: 180)."
    ]
  },
  {
    id: "next-prod-07",
    topic: "Memory Leaks in Node.js Standalone SSR Containers Under Sustained Load",
    category: "Deployment & Runtime",
    severity: "P0 - Critical Outage",
    theProblem: "Next.js Node.js server pods in production steadily climb in memory usage over 24 hours, going from 300MB to 2.8GB until Kubernetes triggers an OOMKilled (Exit Code 137). Restarting pods creates brief availability dips and connection drops during peak business hours.",
    howItWorksInternally: "In SSR/Node environments, modules execute in a persistent Node process. Common causes of memory leaks in Next.js include: 1) Module-level global caches (e.g. const cache = new Map() declared outside component scope) that accumulate request objects; 2) Unclosed database connection pools or Redis event listeners created inside Server Components or Route Handlers; 3) Closures capturing huge request headers or request bodies in long-lived background promises; and 4) Memory buildup from React server-side streaming contexts when client disconnects are not handled.",
    productionCode: `// 1. BAD: Module-level cache grows infinitely across all user requests
// const memoryCache = new Map(); // MEMORY LEAK! Never store request data here.

// 2. GOOD: Use React.cache() for request-scoped deduplication (Garbage Collected after request ends!)
import { cache } from 'react';
import { db } from '@/lib/db';

export const getCachedTenant = cache(async (tenantId: string) => {
  // Exists strictly during the lifecycle of the single HTTP request
  return db.tenant.findUnique({ where: { id: tenantId } });
});

// 3. Ensure Single Connection Pool Instance via Global Singleton pattern
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// 4. Memory Profiling Diagnostic Hook in Node server
// server.js (Standalone runner monitoring)
if (process.env.NODE_ENV === 'production') {
  setInterval(() => {
    const memory = process.memoryUsage();
    const heapUsedMB = Math.round(memory.heapUsed / 1024 / 1024);
    const rssMB = Math.round(memory.rss / 1024 / 1024);

    if (heapUsedMB > 1500) {
      console.warn(\`[CRITICAL MEMORY ALERT] Node Heap: \${heapUsedMB}MB | RSS: \${rssMB}MB\`);
    }
  }, 30000).unref();
}`,
    monitoringMetrics: [
      "container_memory_working_set_bytes{container='nextjs-app'}",
      "sum(increase(kube_pod_container_status_restarts_total{reason='OOMKilled'}[1h]))",
      "nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes"
    ],
    productionChecklist: [
      "Audit codebase to eliminate module-level Map/Set/Array variables accumulating request state.",
      "Verify Prisma / TypeORM / Mongoose clients use global singleton pattern to avoid creating pools per render.",
      "Replace custom global caches with React.cache() for request-scoped caching.",
      "Configure Kubernetes livenessProbe and set memory limits with at least 50% headroom above baseline RSS."
    ]
  },
  {
    id: "next-prod-08",
    topic: "Infinite Data Fetching Loops in React Server Components during Route Transitions",
    category: "App Router & RSC",
    severity: "P0 - Critical Outage",
    theProblem: "A newly deployed product category page triggers millions of database queries per minute. The PostgreSQL RDS database spikes to 100% CPU, locks connection pools, and takes down the entire application. Logs show a Server Component repeatedly calling fetch() in an uncontrolled recursion.",
    howItWorksInternally: "Unlike Client Components where useEffect dependencies cause infinite loops, RSC infinite loops occur when a Server Component triggers a server action, cookies().set(), or revalidatePath() conditionally during render. Because setting a cookie or calling revalidatePath() marks the route segment as dirty, Next.js triggers an immediate re-render of the route tree, which in turn calls the component again, firing the revalidation again in an unstoppable synchronous loop.",
    productionCode: `// INCORRECT (Causes Infinite Server Loop):
/*
export default async function BrokenPage() {
  const data = await fetch('https://api.store.internal/data');
  if (shouldUpdate) {
    revalidatePath('/broken'); // CRASH! Revalidating during render triggers infinite loop!
  }
  return <div>{data.title}</div>;
}
*/

// CORRECT ARCHITECTURAL IMPLEMENTATION:
// app/products/page.tsx
import { db } from '@/lib/db';
import { updateCatalogStatus } from '@/app/actions/catalog';
import { TriggerUpdateButton } from './TriggerUpdateButton';

export default async function SafeProductPage() {
  // 1. Pure Data Fetching: Render phase is strictly read-only and idempotent
  const products = await db.product.findMany({
    where: { active: true },
    take: 20,
  });

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Catalog Management</h1>
      <ul className="mt-4 space-y-2">
        {products.map((p) => (
          <li key={p.id} className="border p-4 rounded flex justify-between">
            <span>{p.name}</span>
            {/* 2. Mutations strictly delegated to user interactions / Server Actions */}
            <TriggerUpdateButton productId={p.id} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// app/products/TriggerUpdateButton.tsx
'use client';

import { useTransition } from 'react';
import { updateCatalogStatus } from '@/app/actions/catalog';

export function TriggerUpdateButton({ productId }: { productId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      // Mutation happens strictly in response to an explicit user event
      await updateCatalogStatus(productId);
    });
  };

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="px-3 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
    >
      {isPending ? 'Syncing...' : 'Sync Catalog'}
    </button>
  );
}`,
    monitoringMetrics: [
      "sum(rate(pg_stat_activity_count{state='active'}[1m]))",
      "rate(http_requests_total{route='/products'}[1m]) > 500",
      "nextjs_server_component_render_depth_gauge > 50"
    ],
    productionChecklist: [
      "Never call revalidatePath, revalidateTag, or cookies().set() inside the body of a Server Component.",
      "Mutations and cache invalidations must strictly execute inside Server Actions or Route Handlers (POST/PUT/DELETE).",
      "Ensure all Server Component render functions are strictly pure and idempotent.",
      "Configure database statement timeouts (e.g. statement_timeout = 3000) to kill rogue recursive queries."
    ]
  },
  {
    id: "next-prod-09",
    topic: "next/image Optimization CPU Saturation & Disk Space Exhaustion Outage",
    category: "Assets & Performance",
    severity: "P1 - High Severity",
    theProblem: "During marketing campaigns with high user traffic, Next.js container pods lock up with 100% CPU utilization and node crashes due to 'ENOSPC: no space left on device'. Inspection reveals the .next/cache/images directory ballooned to over 80GB in 3 hours.",
    howItWorksInternally: "When using next/image without external CDN offloading, every image request to /_next/image?url=...&w=...&q=... spawns the Sharp C-binding image processor inside the Node.js server. If attackers or crawlers query arbitrary width parameters (w=640, w=641, w=642) or request unconstrained remote source URLs, Next.js resizes, re-encodes, and caches every unique permutation onto the container disk. Under 5,000 req/sec, Sharp saturates libuv worker threads and exhausts ephemeral container disk space.",
    productionCode: `// next.config.ts - Production Hardened Image Optimization
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // 1. Restrict allowed widths to a strict fixed whitelist (stops combinatorial attacks)
    deviceSizes: [640, 750, 1080, 1920],
    imageSizes: [32, 64, 128, 256],

    // 2. Only serve modern compressed WebP and AVIF formats
    formats: ['image/avif', 'image/webp'],

    // 3. Cache TTL: Keep optimized images cached for 30 days
    minimumCacheTTL: 60 * 60 * 24 * 30,

    // 4. Strict remote pattern whitelist (never use wildcard domains!)
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.enterprise.com',
        port: '',
        pathname: '/products/**',
      },
      {
        protocol: 'https',
        hostname: 's3.us-east-1.amazonaws.com',
        pathname: '/my-company-bucket/**',
      },
    ],

    // 5. Disable animated SVG / GIF resizing if not needed to reduce CPU load
    dangerouslyAllowSVG: false,
  },
};

export default nextConfig;`,
    monitoringMetrics: [
      "sum(rate(node_cpu_seconds_total{mode='system'}[1m])) by (container)",
      "node_filesystem_free_bytes{mountpoint='/app'} / node_filesystem_size_bytes",
      "sum(rate(http_requests_total{path=~'/_next/image.*'}[1m]))"
    ],
    productionChecklist: [
      "Strictly configure remotePatterns in next.config.ts; never allow wildcard '*' hosts.",
      "Offload image optimization to Cloudflare Images, Fastly, or Cloudinary via custom loader if traffic exceeds 10M views/month.",
      "Mount ephemeral volume storage for .next/cache/images or use tmpfs in Docker containers.",
      "Set aggressive minimumCacheTTL (30 days) to prevent Sharp from re-processing the same image."
    ]
  },
  {
    id: "next-prod-10",
    topic: "Next.js 15 Async Request Context Migration Crash (cookies, headers, params)",
    category: "Next.js 15 Migration",
    severity: "P0 - Critical Outage",
    theProblem: "Immediately after upgrading to Next.js 15, production builds succeed but all dynamic pages crash at runtime with 'Error: Route /dashboard/[id] used `params.id`. `params` should be awaited in Next.js 15' and 'Error: `cookies()` should be awaited before using its properties'. All authenticated user pages return HTTP 500.",
    howItWorksInternally: "In Next.js 14 and earlier, request-bound APIs such as cookies(), headers(), draftMode(), and page/layout params were synchronous objects. In Next.js 15, to prepare for Partial Prerendering (PPR) and streaming execution models, all request contexts are asynchronous Promises. Accessing params.id synchronously causes a runtime exception in production when Next.js attempts to resolve the underlying request context Promise.",
    productionCode: `// MIGRATION COMPARISON:

// ❌ OLD (Next.js 14 - Synchronous - Crashes in Next.js 15):
/*
interface PageProps {
  params: { id: string };
  searchParams: { q?: string };
}

export default function OldPage({ params, searchParams }: PageProps) {
  const cookieStore = cookies();
  const token = cookieStore.get('token');
  return <div>Product: {params.id}</div>;
}
*/

// ✅ NEW (Next.js 15 Production Architecture - Fully Async):
// app/dashboard/[id]/page.tsx
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { db } from '@/lib/db';

interface Next15PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function SafeNext15Page({ params, searchParams }: Next15PageProps) {
  // 1. Await params and searchParams Promises in parallel
  const [{ id }, query] = await Promise.all([params, searchParams]);

  // 2. Await dynamic request headers and cookies
  const [cookieStore, headerList] = await Promise.all([cookies(), headers()]);
  const token = cookieStore.get('auth_session')?.value;
  const userAgent = headerList.get('user-agent') || 'unknown';

  if (!id) notFound();

  const record = await db.dashboard.findUnique({ where: { id } });

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold">Dashboard: {record?.title}</h1>
      <p className="text-sm text-gray-500">Query Filter: {String(query.q || 'none')}</p>
      <p className="text-xs text-gray-400">Client: {userAgent}</p>
    </div>
  );
}`,
    monitoringMetrics: [
      "sum(rate(http_requests_total{status='500'}[1m])) after_deployment_window",
      "count(nextjs_sync_dynamic_api_warnings_total)",
      "error_logs_matching 'params should be awaited'"
    ],
    productionChecklist: [
      "Run Next.js official codemod: npx @next/codemod@canary next-async-request-api .",
      "Audit all page.tsx and layout.tsx files to ensure params and searchParams are typed as Promise<T> and awaited.",
      "Audit all instances of cookies() and headers() and prepend with await.",
      "Run full end-to-end synthetic tests across all dynamic routes prior to promoting build to 100% canary."
    ]
  },
  {
    id: "next-prod-11",
    topic: "ISR On-Demand Revalidation Storm & Downstream Database Thundering Herd",
    category: "Caching & Resiliency",
    severity: "P0 - Critical Outage",
    theProblem: "A bulk product sync script invokes the revalidation webhook endpoint for 20,000 product pages simultaneously. 20,000 concurrent render jobs launch across the server fleet, overwhelming the backend GraphQL API and database with 40,000 simultaneous queries, causing total downstream service failure.",
    howItWorksInternally: "When revalidatePath() or revalidateTag() is called, Next.js purges the cached entries immediately. On the very next incoming request (or during background revalidation), Next.js invokes the page render function. When thousands of requests hit simultaneously without a concurrency governor, all worker threads trigger cold database fetches at once (Thundering Herd / Cache Stampede), instantly consuming all available DB connection pool slots.",
    productionCode: `// app/api/bulk-revalidate/route.ts - Rate-Limited Concurrency-Governed Revalidation
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import pLimit from 'p-limit';

// Limit concurrent background invalidation operations to 10 at a time
const concurrencyLimit = pLimit(10);

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret');
  if (secret !== process.env.ADMIN_REVALIDATION_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tags }: { tags: string[] } = await req.json();

  if (!Array.isArray(tags) || tags.length === 0) {
    return NextResponse.json({ error: 'Tags array required' }, { status: 400 });
  }

  console.log(\`[Bulk Revalidate] Queuing \${tags.length} tags with concurrency=10...\`);

  // Process invalidations in controlled batches to protect downstream DB
  const tasks = tags.map((tag) =>
    concurrencyLimit(async () => {
      try {
        revalidateTag(tag);
        // Small 5ms pause between queue dispatches to prevent thread-pool starvation
        await new Promise((r) => setTimeout(r, 5));
      } catch (err) {
        console.error(\`Failed to revalidate tag \${tag}:\`, err);
      }
    })
  );

  await Promise.all(tasks);

  return NextResponse.json({
    success: true,
    revalidatedTagsCount: tags.length,
    timestamp: new Date().toISOString(),
  });
}`,
    monitoringMetrics: [
      "sum(rate(revalidate_tag_invocations_total[1m]))",
      "pg_stat_database_numbackends / pg_settings_max_connections",
      "histogram_quantile(0.99, rate(backend_api_response_time_seconds[1m]))"
    ],
    productionChecklist: [
      "Throttle on-demand revalidation webhooks with p-limit or worker queues (BullMQ/Redis).",
      "Use tag hierarchy (e.g. 'catalog' invalidates entire section rather than 50,000 individual SKU tags).",
      "Verify database connection pool uses pg-bouncer or AWS RDS Proxy to absorb connection surges.",
      "Set upstream CDN stale-while-revalidate headers to allow CDN to serve slightly stale pages while revalidation computes."
    ]
  },
  {
    id: "next-prod-12",
    topic: "Turbopack vs Webpack Native Addon Module Resolution Failures in Monorepos",
    category: "Build & Tooling",
    severity: "P1 - High Severity",
    theProblem: "Engineers using Next.js 15 with --turbo experience seamless local development, but CI/CD release builds fail during 'next build' with 'Module not found: Can't resolve native-addon.node' or produce broken bundles missing crypto/canvas bindings in production.",
    howItWorksInternally: "Turbopack is a Rust-based bundler with native ESM resolution. It resolves modules differently than Webpack. Webpack relies on custom plugins and loaders (e.g. node-loader, file-loader) to handle native C++ binaries (.node bindings, canvas, sharp, bcrypt). When a project uses Turbopack in dev ('next dev --turbo') and Webpack in build ('next build'), inconsistencies emerge: Webpack may bundle modules that Turbopack cannot parse, or native Node modules may fail to externalize properly.",
    productionCode: `// next.config.ts - Production Universal Monorepo Module Resolution
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // 1. Explicitly declare server-only packages with native C++ bindings
  // Tells Next.js bundler (both Webpack & Turbopack) to NOT attempt bundling these into JS!
  serverExternalPackages: [
    'sharp',
    'canvas',
    'bcrypt',
    '@prisma/client',
    'pg-native',
    'isolated-vm',
  ],

  // 2. Transpile specific monorepo workspace packages
  transpilePackages: ['@enterprise/ui', '@enterprise/shared-utils'],

  // 3. Webpack fallback configuration for CI production build compatibility
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.externals = [...(config.externals || []), 'canvas', 'utf-8-validate'];
    }
    return config;
  },

  // 4. Turbopack options
  experimental: {
    turbo: {
      resolveAlias: {
        underscore: 'lodash',
      },
    },
  },
};

export default nextConfig;`,
    monitoringMetrics: [
      "count(ci_cd_build_failures{step='next_build'})",
      "rate(webpack_bundle_compilation_errors_total[1h])",
      "monorepo_dependency_graph_drift_count"
    ],
    productionChecklist: [
      "Add all native C++ bindings and binary packages to serverExternalPackages in next.config.ts.",
      "List internal monorepo packages in transpilePackages so Next.js handles TS/JSX compilation.",
      "Verify CI/CD pipeline runs test builds with the exact flags used in production before merging PRs.",
      "Standardize lockfile across all monorepo packages with pnpm-lock.yaml or package-lock.json."
    ]
  },
  {
    id: "next-prod-13",
    topic: "Docker Standalone Build 404s for Static Assets and Chunk Hashes",
    category: "Docker & Kubernetes Deployment",
    severity: "P0 - Critical Outage",
    theProblem: "After deploying a new Next.js Docker image to production, users receive blank white screens. The HTML loads, but all JavaScript and CSS files return HTTP 404 Not Found (/ _next/static/chunks/main-app.js 404).",
    howItWorksInternally: "When output: 'standalone' is enabled, Next.js generates a minimal Node server inside .next/standalone/server.js. However, by architectural design, Next.js DOES NOT copy the public/ folder or the .next/static/ folder into the standalone output folder! Next.js assumes static assets will be served directly by a CDN or reverse proxy (Nginx). If the Dockerfile only copies .next/standalone without explicitly copying public/ and .next/static/ into their corresponding relative directories, the standalone server cannot locate or serve client JS bundles.",
    productionCode: `# Dockerfile - Production Fixed Standalone Configuration
FROM node:20-alpine AS base

# Install dependencies
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Build Next.js application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
RUN npm run build

# Production Runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# CRITICAL STEP: Copy standalone server PLUS static assets in correct locations
COPY --from=builder /app/public ./public

# 1. Copy standalone server directory
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# 2. MUST explicitly copy .next/static into .next/static! (Standalone does not include this)
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]`,
    monitoringMetrics: [
      "sum(rate(http_requests_total{status='404',path=~'/_next/static/.*'}[1m]))",
      "count(client_script_load_error_reports)",
      "container_startup_verification_probe_status"
    ],
    productionChecklist: [
      "Verify Dockerfile includes 'COPY --from=builder /app/.next/static ./.next/static'.",
      "Verify Dockerfile includes 'COPY --from=builder /app/public ./public'.",
      "Run container locally with 'docker run -p 3000:3000 <image>' and inspect /_next/static/chunks network calls.",
      "Configure Nginx or CDN to cache /_next/static/ with 'Cache-Control: public, max-age=31536000, immutable'."
    ]
  },
  {
    id: "next-prod-14",
    topic: "Route Handler Cold Start Latency Spikes & Database Connection Pool Exhaustion on Edge/Serverless",
    category: "Serverless & Database Scaling",
    severity: "P0 - Critical Outage",
    theProblem: "Under traffic spikes on Vercel / AWS Lambda, Next.js Serverless Route Handlers take 4,000ms to respond to simple API requests. Simultaneously, the PostgreSQL database hits its max_connections limit (500 connections) and starts rejecting connections with 'FATAL: remaining connection slots are reserved for non-replication superuser connections'.",
    howItWorksInternally: "Serverless functions scale horizontally by spinning up isolated container instances on demand. If a Route Handler opens a new database connection pool (e.g. new Pool() or new PrismaClient()) without connection pooling infrastructure, 200 concurrent Lambda instances create 200 separate pools. If each pool allocates 10 connections, they attempt 2,000 open connections to PostgreSQL, instantly exhausting database limits. Furthermore, SSL handshakes and pool initialization add 1,500ms cold-start latency to every newly spawned serverless instance.",
    productionCode: `// 1. Database Connection Management via Prisma with Accelerated Connection Pooling
// lib/prisma.ts
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

// For serverless deployments, target AWS RDS Proxy or PgBouncer URL
const connectionString = process.env.DATABASE_URL_PGBOUNCER || process.env.DATABASE_URL!;

// Configure low connection pool size per serverless container (max 1-2 connections!)
const pool = new Pool({
  connectionString,
  max: 1, // Crucial for serverless: 1 connection per lambda isolate prevents DB exhaustion
  connectionTimeoutMillis: 2000,
  idleTimeoutMillis: 10000,
});

const adapter = new PrismaPg(pool);

export const db = new PrismaClient({ adapter });

// 2. Route Handler with Serverless Cold-Start Optimization
// app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// Keep Route Handler on Node.js serverless runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const orders = await db.order.findMany({
      take: 25,
      select: { id: true, amount: true, status: true, createdAt: true },
    });

    return NextResponse.json(orders, {
      headers: {
        // Micro-cache at CDN edge for 5 seconds to absorb thundering herds
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
      },
    });
  } catch (err: any) {
    console.error('[Database Error]:', err);
    return NextResponse.json({ error: 'Database service unavailable' }, { status: 503 });
  }
}`,
    monitoringMetrics: [
      "aws_lambda_duration_p99_milliseconds",
      "pg_stat_database_numbackends / pg_settings_max_connections",
      "aws_rds_proxy_database_connections_currently_borrowed"
    ],
    productionChecklist: [
      "Always route serverless Next.js database connections through PgBouncer or AWS RDS Proxy.",
      "Set serverless pool size to max: 1 per instance to prevent multiplied connection allocations.",
      "Add s-maxage CDN caching headers to read-heavy Route Handlers to absorb short traffic spikes.",
      "Enable Provisioned Concurrency or configure warming scripts if sub-100ms latency is strictly required."
    ]
  }
];

const outputPath = path.join(__dirname, '../data/nextjs.production.json');
fs.writeFileSync(outputPath, JSON.stringify(runbooks, null, 2), 'utf-8');
console.log(`Successfully generated ${outputPath} with ${runbooks.length} runbooks.`);
