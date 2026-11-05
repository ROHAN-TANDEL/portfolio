const { card } = require("../next_builder_helper.cjs");

const cards = [
  card(
    85,
    "Next.js Middleware Architecture & Execution Lifecycle",
    "Middleware, Edge & Security",
    "Mastery",
    "Next.js Middleware (`middleware.ts`) runs before any request is processed by the App Router or cached by the server. Executing in the lightweight Edge Runtime, it intercepts incoming requests to rewrite URLs, redirect users, inspect cookies, or inject custom headers.",
    `// middleware.ts (Root of project)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionToken = request.cookies.get("session_token")?.value;

  // Protect all /dashboard routes
  if (pathname.startsWith("/dashboard") && !sessionToken) {
    // Redirect unauthenticated users to /login
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Inject tracking header into downstream Server Components
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-start", Date.now().toString());

  return NextResponse.next({
    request: { headers: requestHeaders }
  });
}

// Route Matcher configuration
export const config = {
  matcher: ["/dashboard/:path*", "/api/protected/:path*"]
};`,
    ["Middleware", "Edge Runtime", "NextRequest", "NextResponse", "Request Interception"],
    [
      { title: "Next.js Docs: Middleware", url: "https://nextjs.org/docs/app/building-your-application/routing/middleware" }
    ],
    "Where must the `middleware.ts` file be located in a Next.js project?",
    "Directly in the root of the project (alongside `package.json`), or inside the `src/` directory if using a `src/` folder. Only ONE single `middleware.ts` file is permitted per Next.js project.",
    "Does Middleware execute for static files and image assets by default?",
    "Yes, unless explicitly excluded in the `matcher` configuration. Best practice is to exclude `_next/static`, `_next/image`, and favicon files from the matcher to prevent unnecessary compute."
  ),

  card(
    86,
    "The `config.matcher` Pattern & Static Asset Exclusion",
    "Middleware, Edge & Security",
    "Mastery",
    "The `matcher` configuration filters which request paths invoke the middleware. Running middleware on static image assets and fonts wastes Edge compute and degrades performance; strict regex exclusion protects performance.",
    `// Standard Production Matcher Regex:
// Matches all request paths EXCEPT:
// - _next/static (static files)
// - _next/image (image optimization files)
// - favicon.ico (favicon file)
// - public assets (.svg, .png, .jpg, .webp, .css, .js)

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)"
  ]
};

// Alternative: Explicit path array matcher
// export const config = {
//   matcher: ["/dashboard/:path*", "/checkout/:path*", "/admin/:path*"]
// };`,
    ["config.matcher", "Static Exclusion", "Regex Filter", "Edge Performance", "Optimization"],
    [
      { title: "Next.js Docs: Matching Paths", url: "https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher" }
    ],
    "Why is excluding `_next/static` and `_next/image` from middleware critical?",
    "Every page load triggers dozens of requests for static JavaScript chunks, CSS files, and images. Running Edge middleware on each asset request multiplies serverless invocations, adds 10-20ms latency per asset, and rapidly exhausts edge hosting compute budgets.",
    "Can the `matcher` accept dynamic JavaScript variables or environment variables?",
    "No! The `matcher` must be a statically analyzable constant (array of strings or string literals) so Next.js can compile route filtering rules at build time."
  ),

  card(
    87,
    "URL Rewriting (`NextResponse.rewrite()`) vs Redirecting",
    "Middleware, Edge & Security",
    "Mastery",
    "A Redirect (`NextResponse.redirect()`) changes the browser's address bar and returns an HTTP 307/308 status. A Rewrite (`NextResponse.rewrite()`) proxies the request to a different internal route without changing the public URL displayed in the browser's address bar.",
    `// middleware.ts
import { NextResponse, NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // 1. REDIRECT: Changes browser URL
  // http://mycompany.com/old-about -> Browser updates to http://mycompany.com/about (HTTP 308)
  if (url.pathname === "/old-about") {
    return NextResponse.redirect(new URL("/about", req.url), 308);
  }

  // 2. REWRITE: Retains browser URL, but proxies to different internal page!
  // User visits: https://acme.myapp.com/docs
  // Browser displays: https://acme.myapp.com/docs
  // Next.js serves internally from: app/tenants/acme/docs/page.tsx!
  const hostname = req.headers.get("host") || "";
  if (hostname.endsWith(".myapp.com")) {
    const subdomain = hostname.replace(".myapp.com", "");
    return NextResponse.rewrite(
      new URL(\`/tenants/\${subdomain}\${url.pathname}\`, req.url)
    );
  }
}`,
    ["NextResponse.rewrite()", "NextResponse.redirect()", "URL Masking", "Multi-Tenancy", "Reverse Proxy"],
    [
      { title: "Next.js Docs: NextResponse", url: "https://nextjs.org/docs/app/api-reference/functions/next-response" }
    ],
    "What is the primary use case for `NextResponse.rewrite()`?",
    "Multi-tenant architectures, A/B testing, and white-label applications. Rewrites allow serving custom internal route hierarchies (e.g. `/tenants/acme/dashboard`) while users see a clean custom domain or subdomain (`https://acme.com/dashboard`) in their browser.",
    "Can `NextResponse.rewrite()` proxy to an external third-party domain?",
    "Yes. You can rewrite to external URLs (e.g. `NextResponse.rewrite('https://legacy-site.com/docs')`), turning your Next.js middleware into an edge reverse proxy."
  ),

  card(
    88,
    "Edge Runtime vs Node.js Server Runtime: V8 Isolates vs libuv",
    "Middleware, Edge & Security",
    "Deep Dive",
    "Next.js Middleware executes strictly in the Edge Runtime (lightweight V8 Isolates), not full Node.js. It boots in < 1ms and has a tiny memory footprint, but lacks native Node.js APIs (`fs`, `child_process`, `net`) and dynamic code execution (`eval`).",
    `// Runtime Comparison:
// 1. Edge Runtime (Middleware & Edge Route Handlers):
// - Engine: V8 Isolates (Similar to Cloudflare Workers).
// - Boot Time: 0ms (Instant cold start).
// - Memory: 128MB max.
// - Execution Limit: 25-50ms CPU timeout.
// - Available APIs: Web Standard APIs (fetch, Request, Response, crypto, WebStreams, TextEncoder).
// - FORBIDDEN: fs, path, process.cwd(), Buffer (use Uint8Array), net, dgram.

// 2. Node.js Runtime (Server Components, Server Actions, Node Route Handlers):
// - Engine: Full Node.js runtime (libuv + V8).
// - Available APIs: 100% of Node.js ecosystem (Prisma, native C++ add-ons, filesystem, child processes).

// Configuring runtime in Route Handlers:
// export const runtime = 'edge'; // or 'nodejs' (default)`,
    ["Edge Runtime", "V8 Isolates", "libuv", "Cold Starts", "Runtime Limits"],
    [
      { title: "Next.js Docs: Edge and Node.js Runtimes", url: "https://nextjs.org/docs/app/building-your-application/rendering/edge-and-nodejs-runtimes" }
    ],
    "Can you run native Prisma or PostgreSQL ORM queries inside Next.js `middleware.ts`?",
    "No! Traditional ORMs require Node.js TCP socket APIs (`net`) not available in V8 Isolates. Executing heavy ORM calls in middleware also risks breaching the 50ms Edge CPU limit. Database verification should be performed inside Server Components or via HTTP-based database drivers (Neon Serverless, Prisma Accelerate).",
    "Can you switch `middleware.ts` to run on the full Node.js runtime?",
    "No. In Next.js, `middleware.ts` is strictly architected to execute on the Edge Runtime to guarantee sub-millisecond perimeter request processing."
  ),

  card(
    89,
    "Cookie Manipulation & Auth Session Gates in Middleware",
    "Middleware, Edge & Security",
    "Mastery",
    "Middleware reads, sets, and deletes HTTP cookies before routes render. In Next.js, mutating cookies requires updating both the outgoing response cookies AND forwarding the updated cookie header to downstream Server Components.",
    `// middleware.ts
import { NextResponse, NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();

  // 1. Reading incoming request cookies
  const authToken = req.cookies.get("auth_token")?.value;

  // 2. Setting a cookie on the outgoing HTTP response:
  res.cookies.set({
    name: "user_visited_at",
    value: Date.now().toString(),
    path: "/",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7 // 7 days
  });

  // 3. Deleting a cookie (Logout gate)
  if (req.nextUrl.pathname === "/logout") {
    res.cookies.delete("auth_token");
    return res;
  }

  return res;
}`,
    ["Cookies", "NextResponse.cookies", "Session Gate", "httpOnly", "Auth Guard"],
    [
      { title: "Next.js Docs: Using Cookies in Middleware", url: "https://nextjs.org/docs/app/building-your-application/routing/middleware#using-cookies" }
    ],
    "Why must auth cookies always have `httpOnly: true` and `secure: true` flags set?",
    "`httpOnly: true` prevents client-side JavaScript (`document.cookie`) from reading the session token, protecting against Cross-Site Scripting (XSS) credential theft. `secure: true` ensures the cookie is transmitted only over encrypted HTTPS connections.",
    "Can you verify cryptographic JWT signatures inside `middleware.ts`?",
    "Yes, using Web Crypto compatible libraries like `jose` (which run natively in the Edge Runtime), allowing stateless token verification at the network perimeter."
  ),

  card(
    90,
    "Multi-Tenant Subdomain Routing via Edge Middleware",
    "Middleware, Edge & Security",
    "Mastery",
    "Enterprise SaaS platforms serve multiple customer organizations from a single Next.js deployment. Edge Middleware extracts customer subdomains from the `Host` header and rewrites requests dynamically to tenant folders.",
    `// Multi-Tenant Directory Structure:
// app/
//   ├── (marketing)/page.tsx          -> For root domain: myplatform.com
//   └── tenants/[tenantId]/
//         ├── page.tsx                -> For subdomain: acme.myplatform.com
//         └── settings/page.tsx       -> For: acme.myplatform.com/settings

// middleware.ts
import { NextResponse, NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  const host = req.headers.get("host") || "";
  const rootDomain = "myplatform.com";
  const url = req.nextUrl;

  // Extract subdomain: e.g. "acme.myplatform.com" -> "acme"
  const subdomain = host.replace(\`.\${rootDomain}\`, "").replace(":3000", "");

  // Root domain: serve public marketing pages
  if (host === rootDomain || subdomain === "www" || subdomain === "localhost") {
    return NextResponse.next();
  }

  // Tenant Subdomain: Rewrite to internal tenant route!
  // Public URL: acme.myplatform.com/settings
  // Internal File: app/tenants/acme/settings/page.tsx
  return NextResponse.rewrite(
    new URL(\`/tenants/\${subdomain}\${url.pathname}\`, req.url)
  );
}`,
    ["Multi-Tenancy", "Subdomains", "SaaS Routing", "NextResponse.rewrite", "Architecture"],
    [
      { title: "Vercel Platforms: Multi-Tenant Architecture", url: "https://vercel.com/templates/next.js/platforms" }
    ],
    "Why is Edge Middleware optimal for multi-tenant subdomain routing?",
    "Edge Middleware rewrites the URL in < 5ms before any React component renders. The tenant ID is cleanly passed into `params.tenantId` for Server Components without requiring complex client-side routing logic or separate deployments per customer.",
    "How do you handle custom domains (e.g. `clientbrand.com`) in the same middleware?",
    "Look up the custom domain in an edge key-value store (e.g. Redis/Vercel Edge Config) to resolve the associated `tenantId`, then execute the same `NextResponse.rewrite()` to the tenant's folder."
  ),

  card(
    91,
    "Content Security Policy (CSP) & Cryptographic Nonces",
    "Security",
    "Deep Dive",
    "Content Security Policy (CSP) defends against Cross-Site Scripting (XSS) by whitelisting trusted script origins. Middleware generates a unique cryptographically random Base64 nonce per request, injects it into CSP headers, and passes it to Server Components.",
    `// middleware.ts
import { NextResponse, NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  // 1. Generate unique random 128-bit cryptographic nonce
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // 2. Define strict Content Security Policy with nonce
  const cspHeader = \`
    default-src 'self';
    script-src 'self' 'nonce-\${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-\${nonce}';
    img-src 'self' blob: data: https:;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    frame-ancestors 'none';
  \`.replace(/\\s{2,}/g, " ").trim();

  // 3. Inject nonce into request headers for Root Layout
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", cspHeader);

  const response = NextResponse.next({
    request: { headers: requestHeaders }
  });

  // Set CSP on outgoing HTTP response
  response.headers.set("Content-Security-Policy", cspHeader);
  return response;
}`,
    ["CSP", "XSS Defense", "Cryptographic Nonce", "Security Headers", "Content-Security-Policy"],
    [
      { title: "Next.js Security: Content Security Policy", url: "https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy" }
    ],
    "How does the Root Layout consume the nonce injected by middleware?",
    "The Root Layout reads `headers()` to retrieve the `x-nonce` header and attaches it to scripts and style tags: `<Script nonce={nonce} src='...' />` or `<html nonce={nonce}>`.",
    "Why is using `'strict-dynamic'` with a nonce superior to domain whitelisting in CSP?",
    "Domain whitelists (e.g. `script-src https://apis.google.com`) can be bypassed if an attacker finds an open JSONP or hosting endpoint on the whitelisted domain. Nonces cryptographically assert that only scripts explicitly rendered by the server can execute."
  ),

  card(
    92,
    "A/B Testing & Geolocation Feature Flags at the Edge",
    "Middleware, Edge & Security",
    "Mastery",
    "Edge Middleware enables zero-flicker A/B testing and localized experiences. By reading user country headers (`x-vercel-ip-country`) or assigning variant buckets to cookies, middleware rewrites to variant pages before HTML is rendered.",
    `// middleware.ts
import { NextResponse, NextRequest } from "next/server";

export function middleware(req: NextRequest) {
  // 1. Geolocation Routing: Redirect EU users to GDPR-compliant flow
  const country = req.geo?.country || req.headers.get("x-vercel-ip-country") || "US";

  // 2. Zero-Flicker A/B Testing:
  const url = req.nextUrl;
  if (url.pathname === "/pricing") {
    let bucket = req.cookies.get("ab_pricing_bucket")?.value;

    if (!bucket) {
      // Assign bucket randomly: 50% bucket-A, 50% bucket-B
      bucket = Math.random() < 0.5 ? "variant-a" : "variant-b";
    }

    const res = NextResponse.rewrite(new URL(\`/pricing/\${bucket}\`, req.url));
    res.cookies.set("ab_pricing_bucket", bucket, { maxAge: 60 * 60 * 24 * 30 }); // Persist 30 days
    return res;
  }

  return NextResponse.next();
}`,
    ["A/B Testing", "Geolocation", "Zero-Flicker", "Edge Rewriting", "Feature Flags"],
    [
      { title: "Next.js Docs: A/B Testing at the Edge", url: "https://vercel.com/templates/next.js/edge-functions-ab-testing" }
    ],
    "Why does A/B testing via Edge Middleware eliminate 'Layout Shift / Flash of Unstyled Content (FOUC)'?",
    "Client-side A/B tools (like Google Optimize) render the default page and then swap text via JavaScript, causing visible UI flickering. Edge Middleware selects the variant and rewrites the HTML before it ever reaches the user's browser, delivering zero-flicker performance.",
    "How does the user stay in the same A/B test bucket across multiple visits?",
    "Middleware sets a persistent cookie (`ab_pricing_bucket=variant-a`) on the first visit. Subsequent requests read this cookie to ensure the user consistently sees the same variant."
  ),

  card(
    93,
    "CORS Headers Configuration in Next.js Middleware",
    "Middleware, Edge & Security",
    "Mastery",
    "When exposing Route Handlers to external mobile apps or partner websites, Cross-Origin Resource Sharing (CORS) headers must be enforced. Middleware intercepts pre-flight `OPTIONS` requests and returns approved headers.",
    `// middleware.ts
import { NextResponse, NextRequest } from "next/server";

const allowedOrigins = [
  "https://partner.company.com",
  "https://mobile.company.com"
];

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin") || "";
  const isAllowed = allowedOrigins.includes(origin);

  // 1. Handle HTTP OPTIONS Preflight Request
  if (req.method === "OPTIONS") {
    const preflightHeaders = {
      "Access-Control-Allow-Origin": isAllowed ? origin : "none",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
      "Access-Control-Max-Age": "86400" // Cache preflight for 24 hours
    };
    return NextResponse.json({}, { headers: preflightHeaders });
  }

  // 2. Normal Request: Attach CORS headers to response
  const response = NextResponse.next();
  if (isAllowed) {
    response.headers.set("Access-Control-Allow-Origin", origin);
    response.headers.set("Access-Control-Allow-Credentials", "true");
  }

  return response;
}`,
    ["CORS", "Preflight Request", "OPTIONS", "Access-Control-Allow-Origin", "Security"],
    [
      { title: "Next.js Docs: CORS Headers in Route Handlers and Middleware", url: "https://nextjs.org/docs/app/building-your-application/routing/middleware#cors" }
    ],
    "Why shouldn't you set `Access-Control-Allow-Origin: *` when supporting authenticated sessions?",
    "Browsers strictly forbid `Access-Control-Allow-Origin: *` when `Access-Control-Allow-Credentials: true` is set. To support credentials (cookies, auth headers), you must explicitly reflect the verified origin.",
    "What is the purpose of `Access-Control-Max-Age`?",
    "It instructs the browser to cache pre-flight `OPTIONS` results for a specified duration (e.g. 86400 seconds = 24 hours), eliminating redundant `OPTIONS` roundtrips before every subsequent API request."
  ),

  card(
    94,
    "Rate Limiting at the Edge with Upstash Redis",
    "Middleware, Edge & Security",
    "Mastery",
    "To defend against DDoS and API scraping, Next.js Middleware implements edge rate limiting using HTTP-based Redis (Upstash) running a sliding window algorithm compatible with V8 Isolates.",
    `// middleware.ts
import { NextResponse, NextRequest } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Initialize Upstash Redis client (operates over HTTP REST, 100% Edge compatible!)
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!
});

// Configure sliding window rate limit: 20 requests per 10 seconds
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "10 s"),
  analytics: true
});

export async function middleware(req: NextRequest) {
  const ip = req.ip || req.headers.get("x-forwarded-for") || "127.0.0.1";
  const { success, limit, remaining, reset } = await ratelimit.limit(\`rate:\${ip}\`);

  if (!success) {
    return NextResponse.json(
      { error: "Too Many Requests", message: "Rate limit exceeded. Please back off." },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": limit.toString(),
          "X-RateLimit-Remaining": remaining.toString(),
          "X-RateLimit-Reset": reset.toString()
        }
      }
    );
  }

  return NextResponse.next();
}`,
    ["Rate Limiting", "Upstash Redis", "Sliding Window", "DDoS Mitigation", "Edge Compatible"],
    [
      { title: "Upstash Ratelimit for Next.js Edge", url: "https://upstash.com/docs/redis/sdks/ratelimit-ts/overview" }
    ],
    "Why must you use an HTTP REST-based Redis client (like `@upstash/redis`) in Edge Middleware instead of standard `ioredis`?",
    "Standard `ioredis` uses Node.js TCP socket primitives (`net.Socket`) which are unsupported in the Edge Runtime V8 Isolates. `@upstash/redis` executes commands over standard HTTP `fetch()`, which is natively supported everywhere.",
    "What is the performance overhead of executing an Edge rate limit check?",
    "When deployed in the same cloud region as the Redis instance, the HTTP fetch check takes ~5-15ms, executing before the Next.js page or route begins rendering."
  ),

  card(
    95,
    "Custom Header Propagation via `NextResponse.next()`",
    "Middleware, Edge & Security",
    "Mastery",
    "Middleware can forward custom headers to downstream Server Components. Next.js requires creating a new `Headers` instance, passing it to `NextResponse.next({ request: { headers } })`, and reading it via `headers()` in Server Components.",
    `// 1. middleware.ts: Forwarding custom header
import { NextResponse, NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  // Inject calculated geolocation or user telemetry header
  requestHeaders.set("x-user-region", request.geo?.region || "us-east-1");
  requestHeaders.set("x-correlation-id", crypto.randomUUID());

  return NextResponse.next({
    request: {
      headers: requestHeaders // Forwards updated headers downstream!
    }
  });
}

// 2. app/page.tsx: Reading the forwarded header in a Server Component
import { headers } from "next/headers";

export default async function Page() {
  const headerStore = await headers(); // Next.js 15: async!
  const correlationId = headerStore.get("x-correlation-id");
  const region = headerStore.get("x-user-region");

  return <div>Processed in {region} (Trace: {correlationId})</div>;
}`,
    ["NextResponse.next()", "Header Propagation", "x-correlation-id", "Telemetry", "Server Components"],
    [
      { title: "Next.js Docs: Setting Headers in Middleware", url: "https://nextjs.org/docs/app/building-your-application/routing/middleware#setting-headers" }
    ],
    "What happens if you set a header directly on `response.headers` instead of `request.headers` in middleware?",
    "`response.headers.set(...)` sends the header back to the client browser in the HTTP response. To make the header readable by internal Server Components via `headers()`, you must inject it into `request: { headers }`."
  ),

  card(
    96,
    "Middleware Anti-Patterns: Heavy Database Calls & Timeouts",
    "Middleware, Edge & Security",
    "Deep Dive",
    "The most severe anti-pattern in Next.js Middleware is treating it as a full backend gateway: executing complex database joins, querying slow third-party APIs, or performing heavy cryptography, which causes Edge CPU timeouts (50ms limit) and degrades all site traffic.",
    `// ANTI-PATTERN: Slow database query inside Middleware
// export async function middleware(req) {
//   const user = await db.user.findUnique({ where: { id: req.userId } }); // SLOW! BLOCKS EVERY SINGLE REQUEST!
// }

// CORRECT PATTERN: Thin Middleware, Rich Server Components
// 1. Middleware: Fast, stateless check (e.g. verify JWT signature in 2ms via Web Crypto)
// 2. Server Component: Rich data query (fetch user permissions directly from DB with React cache)

export class MiddlewarePolicy {
  static readonly FORBIDDEN_IN_MIDDLEWARE = [
    "DIRECT_TCP_DATABASE_CONNECTIONS",
    "HEAVY_JSON_FILE_SYSTEM_READS",
    "EXTERNAL_SLOW_REST_CALLS",
    "FULL_PAGE_HTML_GENERATION"
  ];
  static readonly RECOMMENDED_IN_MIDDLEWARE = [
    "URL_REWRITES_AND_REDIRECTS",
    "FAST_COOKIE_AND_HEADER_INSPECTION",
    "EDGE_RATE_LIMITING",
    "CSP_NONCE_GENERATION",
    "GEOLOCATION_BUCKETING"
  ];
}`,
    ["Anti-Patterns", "Edge Timeout", "Performance Degradation", "Thin Middleware", "Best Practices"],
    [
      { title: "Vercel Edge Function Limitations", url: "https://vercel.com/docs/functions/limitations" }
    ],
    "What is the Edge Runtime CPU execution limit, and what happens when it is exceeded?",
    "Typically 50 milliseconds of active CPU time. If middleware executes complex synchronous loops or slow network queries that exceed this limit, the Edge platform terminates the isolate with a 504 Gateway Timeout or 500 Internal Error.",
    "Why should session token validation in middleware stick to cryptographic signature verification rather than database checks?",
    "Verifying a signed JWT using public keys requires ~1ms of CPU with zero network hops. Querying a database on every request introduces 20-100ms latency to every page load across the entire application."
  )
];

module.exports = { cards };
