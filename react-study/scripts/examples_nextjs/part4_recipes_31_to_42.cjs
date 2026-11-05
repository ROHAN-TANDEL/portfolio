// scripts/examples_nextjs/part4_recipes_31_to_42.cjs
module.exports = [
  {
    id: "next-ex-31",
    title: "Cache Invalidation with revalidatePath and revalidateTag in Server Actions",
    category: "Caching & Revalidation",
    difficulty: "Advanced",
    whatThisCodeCovers: "Using revalidatePath for route segment purging and revalidateTag for surgical collection cache invalidation in Next.js 15 Server Actions.",
    conceptsCovered: ["revalidatePath", "revalidateTag", "Data Cache Invalidation", "Server Actions", "Fine-Grained Purging"],
    code: `// app/actions/products.ts
'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { db } from '@/lib/db';

export async function updateProductPrice(productId: string, newPrice: number) {
  // 1. Perform database mutation
  await db.product.update({
    where: { id: productId },
    data: { price: newPrice, updatedAt: new Date() },
  });

  // 2. Surgical Invalidation: Invalidate all fetch requests tagged with this product ID
  // Any fetch('...', { next: { tags: [\`product-\${productId}\`] } }) is purged immediately
  revalidateTag(\`product-\${productId}\`);

  // 3. Collection Invalidation: Purge product listing catalogs across all paginated pages
  revalidateTag('products-list');

  // 4. Path Invalidation: Purge client router cache and full route cache for product detail
  // Optional second param: 'page' (default) or 'layout' (purges all nested sub-routes)
  revalidatePath(\`/products/\${productId}\`, 'page');

  return { success: true };
}

// app/products/[id]/page.tsx (Consumer Component)
export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  // Tagged fetch: Cached permanently in Next.js Data Cache until revalidateTag(\`product-\${id}\`) fires
  const res = await fetch(\`https://api.store.internal/products/\${id}\`, {
    next: { tags: [\`product-\${id}\`] },
  });
  const product = await res.json();

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">{product.name}</h1>
      <p className="text-xl">\${product.price.toFixed(2)}</p>
    </div>
  );
}`,
    breakdown: [
      "revalidateTag('tag'): Surgical invalidation that purges Data Cache entries globally across all Edge/Node server instances using that tag.",
      "revalidatePath('/path', 'page' | 'layout'): Purges the Full Route Cache on the server and expires the client-side router cache for that segment.",
      "Combining both guarantees that cached database payloads (via tags) and prerendered HTML tree segments (via path) update synchronously on mutation."
    ],
    expectedOutput: "Updates database, invalidates all tagged cache entries in the Data Cache, and tells the client router to refetch the fresh HTML tree."
  },
  {
    id: "next-ex-32",
    title: "On-Demand ISR Revalidation Webhook Endpoint with Cryptographic Secret Guard",
    category: "Caching & Revalidation",
    difficulty: "Advanced",
    whatThisCodeCovers: "Secure on-demand Incremental Static Regeneration (ISR) route handler receiving webhooks from headless CMS or inventory systems.",
    conceptsCovered: ["Route Handlers", "revalidateTag", "Webhook Security", "Timing Attack Safe Equal", "ISR"],
    code: `// app/api/revalidate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag, revalidatePath } from 'next/cache';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('x-revalidation-secret') || '';
    const expectedSecret = process.env.REVALIDATION_SECRET || '';

    // Constant-time string comparison to prevent timing attacks
    const isSecretValid =
      authHeader.length === expectedSecret.length &&
      crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(expectedSecret));

    if (!isSecretValid) {
      return NextResponse.json(
        { error: 'Unauthorized: Invalid revalidation token' },
        { status: 401 }
      );
    }

    const payload = await request.json();
    const { tag, path, type = 'page' } = payload;

    if (!tag && !path) {
      return NextResponse.json(
        { error: 'Bad Request: Must provide either "tag" or "path"' },
        { status: 400 }
      );
    }

    const revalidated: Record<string, any> = {};

    if (tag) {
      revalidateTag(tag);
      revalidated.tag = tag;
    }

    if (path) {
      revalidatePath(path, type as 'page' | 'layout');
      revalidated.path = path;
    }

    return NextResponse.json({
      revalidated: true,
      timestamp: new Date().toISOString(),
      details: revalidated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Internal Server Error', message: err.message },
      { status: 500 }
    );
  }
}`,
    breakdown: [
      "crypto.timingSafeEqual: Prevents timing attacks on the shared secret header, stopping attackers from brute-forcing webhook tokens.",
      "Supports either tag-based (surgical) or path-based (page/layout) on-demand cache eviction from external CMS/ERP webhooks.",
      "Returns structured JSON confirmation with timestamp for webhook audit logging and tracing."
    ],
    expectedOutput: "POST 200 OK: { revalidated: true, timestamp: '...', details: { tag: 'blog-posts' } }"
  },
  {
    id: "next-ex-33",
    title: "Edge Middleware Authentication Guard & Protected Route Redirection",
    category: "Middleware & Edge",
    difficulty: "Advanced",
    whatThisCodeCovers: "Zero-latency Edge Middleware validating JWT session tokens, stripping auth headers, and redirecting unauthenticated users.",
    conceptsCovered: ["NextResponse.redirect", "Edge Runtime", "Session Validation", "jose", "Path Matchers"],
    code: `// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || 'super-secret-key-32-bytes-long');

const PUBLIC_PATHS = new Set(['/login', '/register', '/forgot-password', '/api/public']);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets, images, favicon and public paths
  if (PUBLIC_PATHS.has(pathname)) {
    return NextResponse.next();
  }

  const sessionToken = request.cookies.get('session_token')?.value;

  if (!sessionToken) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', encodeURI(request.nextUrl.pathname + request.nextUrl.search));
    return NextResponse.redirect(loginUrl);
  }

  try {
    // Verify JWT using lightweight jose library compatible with Edge runtime (no Node crypto)
    const { payload } = await jwtVerify(sessionToken, JWT_SECRET, {
      algorithms: ['HS256'],
    });

    // Mutate request headers to forward user context to downstream Server Components
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-user-id', String(payload.sub));
    requestHeaders.set('x-user-role', String(payload.role || 'user'));

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  } catch (err) {
    // Expired or forged token: clear cookie and redirect to login
    const loginUrl = new URL('/login', request.url);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('session_token');
    return response;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};`,
    breakdown: [
      "Edge-compatible jwtVerify from 'jose' parses JWTs without requiring Node.js runtime bindings.",
      "NextResponse.redirect automatically preserves original request callbackUrl for smooth post-login return.",
      "requestHeaders.set: Securely propagates x-user-id and role down to Server Components via internal request headers without re-parsing JWT."
    ],
    expectedOutput: "Redirects non-authenticated users to /login?callbackUrl=... and injects verified user identity headers for downstream RSCs."
  },
  {
    id: "next-ex-34",
    title: "Content Security Policy (CSP) & Cryptographic Nonce Injector in Middleware",
    category: "Middleware & Edge",
    difficulty: "Advanced",
    whatThisCodeCovers: "Generating a cryptographically secure random nonce per request in middleware, injecting it into CSP headers and Server Components.",
    conceptsCovered: ["Content Security Policy", "Cryptographic Nonce", "XSS Prevention", "NextResponse Headers"],
    code: `// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 1. Generate base64 16-byte cryptographically secure random nonce
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // 2. Build strict Content Security Policy
  const cspHeader = \`
    default-src 'self';
    script-src 'self' 'nonce-\${nonce}' 'strict-dynamic' https: 'unsafe-inline';
    style-src 'self' 'nonce-\${nonce}';
    img-src 'self' blob: data: https:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    upgrade-insecure-requests;
  \`.replace(/\\s{2,}/g, ' ').trim();

  // 3. Clone request headers and inject nonce for Server Components to read
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', cspHeader);

  // 4. Return response forwarding new request headers and setting CSP response header
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  response.headers.set('Content-Security-Policy', cspHeader);
  return response;
}

// app/layout.tsx (Server Component consuming the nonce)
import { headers } from 'next/headers';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers();
  const nonce = headersList.get('x-nonce') || '';

  return (
    <html lang="en">
      <head>
        {/* Inline script authorized strictly via unique per-request cryptographic nonce */}
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: \`window.__APP_ENV__ = { region: 'iad1' };\`,
          }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}`,
    breakdown: [
      "Generates an unpredictable 16-byte base64 nonce on every individual HTTP request inside Edge middleware.",
      "Sets Content-Security-Policy with 'nonce-{nonce}' to completely neutralize XSS script injection attacks.",
      "Reads x-nonce in app/layout.tsx via await headers() and binds it to inline script tags."
    ],
    expectedOutput: "Secure CSP header with strict-dynamic and unique nonce applied to every page render and inline script."
  },
  {
    id: "next-ex-35",
    title: "Multi-Tenant Subdomain Router & Dynamic Path Rewriting in Middleware",
    category: "Middleware & Edge",
    difficulty: "Advanced",
    whatThisCodeCovers: "Extracting tenant slug from hostname subdomain and transparently rewriting requests to tenant route folders without URL changes.",
    conceptsCovered: ["NextResponse.rewrite", "Multi-Tenancy", "Subdomain Routing", "Edge Middleware"],
    code: `// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const url = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // Define apex domain (e.g. platform.com or localhost:3000)
  const appRootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'localhost:3000';

  // Check if current hostname is a tenant subdomain (e.g., acme.platform.com)
  const isSubdomain = hostname.includes('.') && !hostname.startsWith('www.') && hostname !== appRootDomain;

  if (isSubdomain) {
    // Extract subdomain: 'acme.platform.com' -> 'acme'
    const tenantSlug = hostname.replace(\`.\${appRootDomain}\`, '');

    // Prevent direct browser navigation to /_tenants/*
    if (url.pathname.startsWith('/_tenants')) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Transparently rewrite internal route to /_tenants/[tenantSlug]/...
    // The browser URL remains 'https://acme.platform.com/dashboard'
    const rewriteUrl = new URL(\`/_tenants/\${tenantSlug}\${url.pathname}\`, request.url);
    rewriteUrl.search = url.search;

    const response = NextResponse.rewrite(rewriteUrl);
    response.headers.set('x-tenant-slug', tenantSlug);
    return response;
  }

  // Apex domain requests continue normally to root app/
  return NextResponse.next();
}

// app/_tenants/[tenant]/dashboard/page.tsx
export default async function TenantDashboard({
  params,
}: {
  params: Promise<{ tenant: string }>;
}) {
  const { tenant } = await params;
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold">Welcome to {tenant} Portal</h1>
    </div>
  );
}`,
    breakdown: [
      "Extracts subdomain from request.headers.get('host') and verifies it against the primary apex domain.",
      "NextResponse.rewrite: Rewrites incoming paths to internal hidden folders (/_tenants/[tenant]/) while keeping browser URL bar intact.",
      "Prevents direct navigation exploits to /_tenants to enforce strict tenant boundary separation."
    ],
    expectedOutput: "acme.platform.com/dashboard seamlessly renders app/_tenants/acme/dashboard/page.tsx without 301/302 redirects."
  },
  {
    id: "next-ex-36",
    title: "Edge Rate Limiting with Upstash Redis & Sliding Window Algorithm",
    category: "Middleware & Edge",
    difficulty: "Advanced",
    whatThisCodeCovers: "Protecting public Next.js API endpoints and mutations from brute force and DDoS using Upstash Ratelimit in Edge Middleware.",
    conceptsCovered: ["Rate Limiting", "Upstash Redis", "Sliding Window", "HTTP 429", "Edge Middleware"],
    code: `// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

// Initialize Redis HTTP client (compatible with Edge runtime)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Configure sliding window rate limiter: 10 requests per 10 seconds per IP
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '10 s'),
  analytics: true,
  prefix: '@ratelimit/edge',
});

export async function middleware(request: NextRequest) {
  // Only enforce rate limiting on API routes and mutation actions
  if (request.nextUrl.pathname.startsWith('/api/') || request.method === 'POST') {
    const ip = request.ip || request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';

    const { success, limit, remaining, reset } = await ratelimit.limit(ip);

    if (!success) {
      return new NextResponse(
        JSON.stringify({
          error: 'Too Many Requests',
          message: 'Rate limit exceeded. Please try again shortly.',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': limit.toString(),
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': reset.toString(),
            'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
          },
        }
      );
    }
  }

  return NextResponse.next();
}`,
    breakdown: [
      "Uses Upstash Redis REST API to avoid TCP socket overhead in Edge functions.",
      "Sliding window algorithm prevents burst traffic exploits at the boundary of fixed-window intervals.",
      "Injects standard HTTP 429 status code and X-RateLimit-* telemetry headers with accurate Retry-After countdowns."
    ],
    expectedOutput: "Returns HTTP 429 with Retry-After header when an IP exceeds 10 requests per 10s window."
  },
  {
    id: "next-ex-37",
    title: "Route Handler with WebStreams & Server-Sent Events (SSE) Streaming",
    category: "Route Handlers & Streaming",
    difficulty: "Advanced",
    whatThisCodeCovers: "Streaming real-time text and AI token generation via Server-Sent Events (SSE) with readable Web Streams in Next.js 15.",
    conceptsCovered: ["ReadableStream", "TextEncoder", "Server-Sent Events", "AI Streaming", "Route Handlers"],
    code: `// app/api/stream/route.ts
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic'; // Prevent static optimization

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  // Create a Web Streams ReadableStream
  const stream = new ReadableStream({
    async start(controller) {
      const messages = [
        'Connecting to AI model...',
        'Analyzing context documents...',
        'Synthesizing response...',
        'Next.js 15 App Router supports full Web Streams natively.',
        'Stream complete.',
      ];

      for (let i = 0; i < messages.length; i++) {
        // Format as standard SSE data packet
        const payload = \`data: \${JSON.stringify({ id: i + 1, text: messages[i] })}\\n\\n\`;
        controller.enqueue(encoder.encode(payload));

        // Simulate token generation latency
        await new Promise((resolve) => setTimeout(resolve, 600));
      }

      // Close the stream cleanly
      controller.close();
    },
    cancel(reason) {
      console.log('Client disconnected from SSE stream:', reason);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}`,
    breakdown: [
      "ReadableStream: Standard Web Streams API controller pushes binary chunks without buffering entire response in memory.",
      "text/event-stream Content-Type ensures browser EventSource or fetch reader interprets chunks as incoming event streams.",
      "cancel() hook immediately detects client aborts and terminates upstream processing to conserve CPU and bandwidth."
    ],
    expectedOutput: "Streams data: {\"id\":1,\"text\":\"...\"} chunks sequentially over a single open HTTP connection."
  },
  {
    id: "next-ex-38",
    title: "Custom Request & Response Header Propagation via NextResponse.next()",
    category: "Middleware & Edge",
    difficulty: "Intermediate",
    whatThisCodeCovers: "Injecting correlation IDs and custom security headers across request and response lifecycles in Next.js Middleware.",
    conceptsCovered: ["NextResponse.next", "Correlation ID", "Header Mutation", "Security Headers"],
    code: `// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // 1. Resolve or generate distributed correlation trace ID
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();

  // 2. Clone and enrich incoming request headers for Server Components & Route Handlers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-correlation-id', correlationId);
  requestHeaders.set('x-processed-by', 'edge-middleware-iad');

  // 3. Forward modified headers to downstream server handlers
  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  // 4. Inject enterprise security headers onto outgoing HTTP response back to client
  response.headers.set('x-correlation-id', correlationId);
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}`,
    breakdown: [
      "NextResponse.next({ request: { headers } }): Injects headers directly into the internal request context read by headers() in RSCs.",
      "response.headers.set(): Sets headers on the client-facing HTTP response headers.",
      "Guarantees unified correlation tracing across Edge Middleware, Server Components, and client browser telemetry."
    ],
    expectedOutput: "Downstream RSCs receive x-correlation-id, and client browser receives hardened HTTP security headers."
  },
  {
    id: "next-ex-39",
    title: "A/B Testing & Zero-Flicker Edge Variant Rewriting",
    category: "Middleware & Edge",
    difficulty: "Advanced",
    whatThisCodeCovers: "Zero-flicker split testing at the CDN edge by bucketing users into variants and rewriting page paths without layout shift.",
    conceptsCovered: ["A/B Testing", "Zero-Flicker", "NextResponse.rewrite", "Cookie Bucketing"],
    code: `// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

const EXPERIMENT_COOKIE = 'ab_experiment_hero_v1';
const VARIANTS = ['control', 'variant_b'] as const;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only run experiment on landing page
  if (pathname !== '/') {
    return NextResponse.next();
  }

  // 1. Check existing cookie or randomly assign 50/50 bucket
  let variant = request.cookies.get(EXPERIMENT_COOKIE)?.value;

  if (!variant || !VARIANTS.includes(variant as any)) {
    variant = Math.random() < 0.5 ? 'control' : 'variant_b';
  }

  // 2. Rewrite internal route to variant folder if not control
  // Variant B is transparently served from /variants/variant_b without changing browser URL
  const destination = variant === 'variant_b' ? '/variants/variant_b' : '/';
  const url = request.nextUrl.clone();
  url.pathname = destination;

  const response = NextResponse.rewrite(url);

  // 3. Persist variant in cookie for 30 days
  response.cookies.set(EXPERIMENT_COOKIE, variant, {
    maxAge: 60 * 60 * 24 * 30,
    path: '/',
    sameSite: 'lax',
  });

  return response;
}

// app/variants/variant_b/page.tsx (Variant B Implementation)
export default function VariantBPage() {
  return (
    <main className="p-12 bg-indigo-900 text-white min-h-screen">
      <h1 className="text-4xl font-extrabold">Next-Gen Cloud Storage (Variant B)</h1>
      <p className="mt-4 text-lg">Save 50% with our high-throughput tier.</p>
    </main>
  );
}`,
    breakdown: [
      "Zero-flicker: Edge rewrite happens before any HTML is generated, eliminating client-side hydration layout shifts.",
      "Cookie assignment: Ensures returning visitors consistently see the identical variant across sessions.",
      "Transparent rewrite keeps URL as '/' while rendering /variants/variant_b under the hood."
    ],
    expectedOutput: "50% of users see control landing page, 50% see Variant B with no URL redirect flash."
  },
  {
    id: "next-ex-40",
    title: "CORS Headers Configuration in Next.js Middleware & Route Handlers",
    category: "Middleware & Edge",
    difficulty: "Intermediate",
    whatThisCodeCovers: "Configuring robust Cross-Origin Resource Sharing (CORS) with preflight OPTIONS handling in Next.js 15.",
    conceptsCovered: ["CORS", "Preflight OPTIONS", "Route Handlers", "Middleware", "Origin Whitelist"],
    code: `// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

const ALLOWED_ORIGINS = new Set([
  'https://admin.acme.com',
  'https://checkout.acme.com',
  'http://localhost:3000',
]);

export function middleware(request: NextRequest) {
  const origin = request.headers.get('origin') || '';
  const isAllowedOrigin = ALLOWED_ORIGINS.has(origin);

  // 1. Handle Preflight HTTP OPTIONS request
  if (request.method === 'OPTIONS') {
    const preflightHeaders = {
      'Access-Control-Allow-Origin': isAllowedOrigin ? origin : 'null',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400', // 24 hour cache
    };
    return new NextResponse(null, { status: 204, headers: preflightHeaders });
  }

  // 2. Normal request: Proceed and attach CORS headers to response
  const response = NextResponse.next();

  if (isAllowedOrigin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};`,
    breakdown: [
      "Intercepts HTTP OPTIONS preflight calls at the Edge before reaching compute handlers.",
      "Validates incoming origin against a strict whitelist to prevent wildcard '*' security vulnerabilities with credentials.",
      "Access-Control-Max-Age of 86400 reduces browser preflight roundtrips for 24 hours."
    ],
    expectedOutput: "Handles preflight OPTIONS with 204 No Content and adds CORS headers to all /api/* responses."
  },
  {
    id: "next-ex-41",
    title: "Partial Prerendering (PPR) Product Page with Dynamic Stock Hole",
    category: "Rendering & PPR",
    difficulty: "Advanced",
    whatThisCodeCovers: "Enabling Next.js 15 experimental PPR to combine instant static shell caching with streaming dynamic server components.",
    conceptsCovered: ["Partial Prerendering", "PPR", "Suspense Boundary", "Static Shell", "Dynamic Hole"],
    code: `// next.config.ts
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    ppr: 'incremental', // Enable incremental PPR opt-in
  },
};

export default nextConfig;

// app/products/[slug]/page.tsx
import { Suspense } from 'react';
import { db } from '@/lib/db';

export const experimental_ppr = true; // Opt this specific route into PPR

// 1. Static Component: Inlined directly into the static shell at build time
async function ProductShell({ slug }: { slug: string }) {
  const product = await db.product.findUnique({
    where: { slug },
    select: { name: true, description: true, image: true },
  });

  if (!product) return <div>Product Not Found</div>;

  return (
    <div>
      <h1 className="text-3xl font-bold">{product.name}</h1>
      <p className="text-gray-600 mt-2">{product.description}</p>
    </div>
  );
}

// 2. Dynamic Component: Uncached realtime inventory check streamed inside dynamic hole
async function RealtimeInventory({ slug }: { slug: string }) {
  // Reading cookies or uncached DB creates a dynamic hole
  const stock = await db.inventory.getLiveStock(slug);

  return (
    <div className="mt-4 p-4 border rounded bg-neutral-50">
      <span className={stock > 0 ? 'text-green-600 font-semibold' : 'text-red-600'}>
        {stock > 0 ? \`In Stock (\${stock} units left)\` : 'Out of Stock'}
      </span>
    </div>
  );
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Instant Static Shell */}
      <ProductShell slug={slug} />

      {/* Dynamic Hole streamed over same HTTP connection */}
      <Suspense fallback={<div className="h-12 bg-neutral-200 animate-pulse rounded mt-4" />}>
        <RealtimeInventory slug={slug} />
      </Suspense>
    </div>
  );
}`,
    breakdown: [
      "experimental_ppr = true: Opts route into Partial Prerendering, generating a static HTML shell at build time.",
      "The static shell is delivered from CDN edge with zero TTFB delay.",
      "Suspense boundary marks the 'dynamic hole' where RealtimeInventory streams in parallel over the single HTTP response."
    ],
    expectedOutput: "CDN serves the static product shell in 15ms while dynamic stock status streams in without page reload."
  },
  {
    id: "next-ex-42",
    title: "Next.js 15 Async Request Context Wrapper with connection() API",
    category: "Rendering & PPR",
    difficulty: "Advanced",
    whatThisCodeCovers: "Using Next.js 15 connection() API to explicitly opt into dynamic rendering and prevent build-time prerender poisoning.",
    conceptsCovered: ["connection() API", "Next.js 15", "Dynamic Rendering", "Async Request Context", "Build Guard"],
    code: `// app/telemetry/live-traffic/page.tsx
import { connection } from 'next/server';
import { db } from '@/lib/db';

async function LiveTrafficFeed() {
  // 1. Explicitly wait for an incoming user connection
  // Halts build-time prerendering and guarantees this runs dynamically per-request
  await connection();

  // 2. Fetch live realtime server metrics
  const liveUsers = await db.metrics.getActiveConnections();
  const memoryUsage = process.memoryUsage().heapUsed / 1024 / 1024;

  return (
    <div className="p-6 bg-slate-900 text-white rounded-lg">
      <h2 className="text-xl font-bold">Live Traffic Telemetry</h2>
      <p className="mt-2 text-emerald-400">Active Connections: {liveUsers}</p>
      <p className="text-slate-400">Server Heap: {memoryUsage.toFixed(2)} MB</p>
      <p className="text-xs text-slate-500 mt-4">Sampled at: {new Date().toISOString()}</p>
    </div>
  );
}

export default function Page() {
  return (
    <main className="container mx-auto p-8">
      <h1 className="text-2xl font-bold mb-4">Operations Console</h1>
      <LiveTrafficFeed />
    </main>
  );
}`,
    breakdown: [
      "await connection(): New Next.js 15 API that signals a component requires a real client connection to execute.",
      "Prevents Next.js from throwing prerender errors during 'next build' when dynamic non-cached data is accessed.",
      "Acts as a clean, declarative alternative to 'export const dynamic = force-dynamic' at the component level."
    ],
    expectedOutput: "Safely skips build-time prerendering and executes strictly at request time on server."
  }
];
