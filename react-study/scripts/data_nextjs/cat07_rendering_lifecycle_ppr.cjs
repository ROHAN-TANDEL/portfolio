const { card } = require("../next_builder_helper.cjs");

const cards = [
  card(
    73,
    "Static Rendering (SSG) vs Dynamic Rendering (SSR)",
    "Rendering Lifecycle & PPR",
    "Mastery",
    "Static Rendering renders routes to static HTML at build time, serving them globally via CDN edges for maximum speed. Dynamic Rendering renders routes on-demand on the server for each incoming request, necessary when routes consume cookies, headers, or live search params.",
    `// Static Route (Rendered at Build Time):
// app/terms/page.tsx
export default function TermsPage() {
  return <div><h1>Terms of Service</h1></div>;
}
// Build output: ○ /terms (Static)

// Dynamic Route (Rendered on Request):
// app/profile/page.tsx
import { cookies } from "next/headers";

export default async function ProfilePage() {
  // Reading cookies opts this page into Dynamic Rendering!
  const cookieStore = await cookies();
  const token = cookieStore.get("session_token");

  return <div>Your token is: {token?.value}</div>;
}
// Build output: λ /profile (Dynamic)`,
    ["Static Rendering", "Dynamic Rendering", "SSG", "SSR", "Build Output"],
    [
      { title: "Next.js Docs: Static and Dynamic Rendering", url: "https://nextjs.org/docs/app/building-your-application/rendering/server-components#static-rendering-default" }
    ],
    "How do you inspect whether a page is statically or dynamically rendered during a Next.js build?",
    "Run `next build` and inspect the terminal output table: routes marked with a circle `○` are Static (pre-rendered as HTML), while routes marked with lambda `λ` are Dynamic (rendered on each request).",
    "Can a dynamically rendered page still benefit from cached sub-components?",
    "Yes. Even if the route as a whole is dynamically rendered, individual `fetch()` requests within the page can still hit the Data Cache if configured with `force-cache` or ISR tags."
  ),

  card(
    74,
    "Incremental Static Regeneration (ISR) at Scale",
    "Rendering Lifecycle & PPR",
    "Mastery",
    "Incremental Static Regeneration allows creating or updating static pages after building the site, enabling static performance on millions of pages without triggering full rebuilds.",
    `// app/products/[id]/page.tsx
import { db } from "@/lib/db";

// Revalidate every 60 seconds (Time-Based ISR)
export const revalidate = 60;

export async function generateStaticParams() {
  // Pre-render the top 500 most popular products at build time!
  const topProducts = await db.product.findMany({
    take: 500,
    select: { id: true }
  });
  return topProducts.map(p => ({ id: p.id }));
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await db.product.findUnique({ where: { id } });

  return (
    <article>
      <h1>{product.name}</h1>
      <p>\${product.price}</p>
    </article>
  );
}`,
    ["ISR", "revalidate", "Scalability", "generateStaticParams", "Static Generation"],
    [
      { title: "Next.js Docs: Incremental Static Regeneration", url: "https://nextjs.org/docs/app/building-your-application/data-fetching/incremental-static-regeneration" }
    ],
    "What happens when a user requests a product outside the top 500 pre-rendered by `generateStaticParams()`?",
    "Next.js renders the page on-demand on the server for the first visitor, caches the generated HTML and RSC payload in the Full Route Cache, and serves subsequent visitors from cache instantly.",
    "What segment option controls how un-generated paths behave?",
    "`export const dynamicParams = true | false`. Setting `dynamicParams = true` renders un-generated paths on-demand; setting `dynamicParams = false` immediately returns a 404 for paths not returned by `generateStaticParams()`."
  ),

  card(
    75,
    "`generateStaticParams()` Compilation Mechanics",
    "Rendering Lifecycle & PPR",
    "Mastery",
    "The `generateStaticParams()` function works in combination with dynamic route segments (`[id]`) to statically generate routes at build time instead of on-demand at request time.",
    `// app/blog/[category]/[slug]/page.tsx
export async function generateStaticParams() {
  // Returns array of objects matching dynamic segment names
  return [
    { category: "tech", slug: "nextjs-15-deep-dive" },
    { category: "tech", slug: "react-server-components" },
    { category: "design", slug: "tailwind-v4-mastery" }
  ];
}

export default async function BlogPostPage({
  params
}: {
  params: Promise<{ category: string; slug: string }>
}) {
  const { category, slug } = await params;
  return <h1>Category: {category} - Post: {slug}</h1>;
}`,
    ["generateStaticParams", "Build-Time Generation", "SSG", "Dynamic Routes", "Next.js"],
    [
      { title: "Next.js Docs: generateStaticParams", url: "https://nextjs.org/docs/app/api-reference/functions/generate-static-params" }
    ],
    "How does `generateStaticParams()` handle nested dynamic segments?",
    "Parent `generateStaticParams()` values are automatically forwarded to child `generateStaticParams()` functions, allowing nested segments to resolve hierarchical paths (e.g. `[category]` -> `[slug]`).",
    "Can `generateStaticParams()` fetch data from a database or remote API during the build?",
    "Yes. It can execute arbitrary asynchronous queries using `fetch()` or ORMs like Prisma/Drizzle to retrieve all valid slugs from a production database."
  ),

  card(
    76,
    "Partial Prerendering (PPR): Mental Model & Paradigm",
    "Rendering Lifecycle & PPR",
    "Mastery",
    "Partial Prerendering (PPR) combines the benefits of static and dynamic rendering in the same route. At build time, Next.js generates a static HTML shell for the page, while leaving placeholders (holes) for dynamic components that stream in over the open HTTP connection.",
    `// Traditional Dilemma:
// - Static (SSG): Super fast TTFB via CDN, but cannot personalize or show real-time user data.
// - Dynamic (SSR): Fully personalized, but slow TTFB because server must wait on slow queries.

// Partial Prerendering (PPR) Solution:
// [ STATIC SHELL (Instant CDN Delivery in 15ms) ]
// ├── Header / Navigation bar (Static)
// ├── Product Title & Image Gallery (Static)
// ├── [ SUSPENSE HOLE: Cart Item Count (Streams user badge over same connection) ]
// └── [ SUSPENSE HOLE: Personalized Recommendation Carousel (Streams async data) ]`,
    ["PPR", "Partial Prerendering", "Static Shell", "Suspense Holes", "Hybrid Rendering"],
    [
      { title: "Next.js Docs: Partial Prerendering", url: "https://nextjs.org/docs/app/building-your-application/rendering/partial-prerendering" }
    ],
    "Why does Partial Prerendering deliver the 'best of both worlds' for e-commerce product pages?",
    "The product image, title, layout, and reviews are pre-rendered into static HTML cached globally on edge CDNs (0ms TTFB). Dynamic personalized components (user cart button, localized shipping estimates) stream directly into Suspense holes over the same HTTP stream.",
    "Does Partial Prerendering require writing different components for static versus dynamic sections?",
    "No! PPR uses standard React `<Suspense>` boundaries. Next.js automatically treats everything outside Suspense as static shell, and everything inside dynamic Suspense boundaries as streamable holes."
  ),

  card(
    77,
    "PPR Architecture: Static Shell with Dynamic Stream Holes",
    "Rendering Lifecycle & PPR",
    "Deep Dive",
    "Under PPR, the build compiler analyzes the component tree: components outside Suspense that do not access dynamic APIs are baked into static HTML. Components inside `<Suspense>` that access cookies or live data are replaced by their fallback skeleton in the static shell and streamed dynamically at runtime.",
    `// app/product/[id]/page.tsx (With PPR Enabled)
import { Suspense } from "react";
import { StaticProductDetails } from "@/components/StaticProductDetails";
import { DynamicLiveStock } from "@/components/DynamicLiveStock";
import { UserCartPreview } from "@/components/UserCartPreview";

export const experimental_ppr = true; // Enables PPR for this route

export default function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="product-page">
      {/* 1. Bakes into static HTML shell during next build */}
      <StaticProductDetails params={params} />

      {/* 2. Dynamic Hole 1: Streams real-time inventory count */}
      <Suspense fallback={<div className="h-6 bg-slate-200 animate-pulse" />}>
        <DynamicLiveStock params={params} />
      </Suspense>

      {/* 3. Dynamic Hole 2: Reads user session cookies & streams cart */}
      <Suspense fallback={<div className="h-10 bg-slate-200 animate-pulse" />}>
        <UserCartPreview />
      </Suspense>
    </div>
  );
}`,
    ["PPR Architecture", "experimental_ppr", "Suspense Holes", "Static Shell", "HTTP Streaming"],
    [
      { title: "Vercel Blog: Partial Prerendering", url: "https://vercel.com/blog/partial-prerendering-with-next-js-app-router" }
    ],
    "What happens when a search engine crawler (like Googlebot) crawls a page using Partial Prerendering?",
    "The crawler instantly receives the complete static HTML shell and waits for the HTTP stream to finish flushing the dynamic holes, indexing both the core content and streamed text without requiring client JavaScript execution.",
    "Can a layout participate in Partial Prerendering?",
    "Yes. The layout forms part of the static shell, while pages or slots within the layout can contain dynamic Suspense holes."
  ),

  card(
    78,
    "Enabling & Configuring PPR (`experimental.ppr`)",
    "Rendering Lifecycle & PPR",
    "Mastery",
    "In Next.js 15, Partial Prerendering is configured via the `experimental.ppr` flag in `next.config.js`. You can set it to `'incremental'` to adopt PPR route-by-route using `export const experimental_ppr = true;`.",
    `// next.config.js (Next.js 15)
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Enable incremental adoption of Partial Prerendering
    ppr: "incremental"
  }
};

module.exports = nextConfig;

// Enabling on a specific route:
// app/store/page.tsx
export const experimental_ppr = true; // Opts this specific route into PPR!

// Disabling on a specific route:
// app/dashboard/page.tsx
export const experimental_ppr = false;`,
    ["experimental.ppr", "next.config.js", "Incremental Adoption", "Next.js 15", "Configuration"],
    [
      { title: "Next.js Docs: Configuring PPR", url: "https://nextjs.org/docs/app/building-your-application/rendering/partial-prerendering#enabling-partial-prerendering" }
    ],
    "What values can `experimental.ppr` accept in `next.config.js`?",
    "`'incremental'` (allows opting in per-route via `export const experimental_ppr = true`) or boolean `true` (enables PPR globally across all routes with Suspense boundaries).",
    "What warning does Next.js give if a dynamic function is called outside a Suspense boundary when PPR is enabled?",
    "Next.js build warns that the dynamic function (e.g. `cookies()`) was accessed outside a `<Suspense>` boundary, which prevents the outer page from being included in the static shell."
  ),

  card(
    79,
    "Dynamic IO (`experimental.dynamicIO`) in Next.js 15",
    "Rendering Lifecycle & PPR",
    "Deep Dive",
    "Next.js 15 introduces `experimental.dynamicIO` to separate pure computational rendering from I/O operations (network calls, database queries). Any data fetch or async I/O must be explicitly wrapped in `use cache` or executed inside a dynamic Suspense hole.",
    `// next.config.js (Next.js 15 experimental feature)
module.exports = {
  experimental: {
    dynamicIO: true
  }
};

// With dynamicIO enabled:
// Code that executes I/O outside a cached function or Suspense boundary triggers build errors!

import { db } from "@/lib/db";

// Explicit caching directive (React 19 / Next.js 15):
async function getCachedCatalog() {
  "use cache"; // Explicitly declares this I/O as cacheable!
  return db.product.findMany();
}

export default async function Page() {
  const products = await getCachedCatalog();
  return <div>{products.length} products</div>;
}`,
    ["dynamicIO", "Next.js 15", "use cache", "Async IO", "Pure Rendering"],
    [
      { title: "Next.js 15: dynamicIO Directive", url: "https://nextjs.org/docs/app/api-reference/config/next-config-js/dynamicIO" }
    ],
    "What architectural flaw does `dynamicIO` solve?",
    "It eliminates accidental dynamic rendering leaks. Previously, calling an un-cached fetch anywhere inside a deeply nested component silently turned the entire route dynamic. `dynamicIO` forces I/O to be explicit via `'use cache'` or wrapped in Suspense.",
    "What is the new `'use cache'` directive introduced alongside `dynamicIO`?",
    "It is a function-level directive that marks an asynchronous function's return value as cacheable in the Data Cache, replacing legacy `fetch(..., { cache: 'force-cache' })` options for arbitrary functions."
  ),

  card(
    80,
    "Static Export Mode (`output: 'export'`) & Its Limitations",
    "Rendering Lifecycle & PPR",
    "Mastery",
    "Next.js can compile into a completely static HTML/CSS/JS export via `output: 'export'`. This allows hosting on non-Node.js static file servers (Nginx, S3, Cloudflare Pages), but strictly forbids server-side dynamic features.",
    `// next.config.js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // Produces an 'out' folder with pure static HTML files!
  images: {
    unoptimized: true // Built-in image optimization server is disabled in static export
  }
};

module.exports = nextConfig;

// FORBIDDEN FEATURES in static export mode:
// - Server Actions ("use server")
// - Dynamic headers() or cookies()
// - Incremental Static Regeneration (revalidate)
// - Dynamic Route Handlers (POST, PUT, DELETE)
// - Rewrites & Redirects in next.config.js requiring a server`,
    ["output: 'export'", "Static Export", "S3 Hosting", "Cloudflare Pages", "Limitations"],
    [
      { title: "Next.js Docs: Static Exports", url: "https://nextjs.org/docs/app/building-your-application/deploying/static-exports" }
    ],
    "Can you use Server Actions inside an application configured with `output: 'export'`?",
    "No. Server Actions require a running Node.js or Edge server runtime to receive and execute HTTP POST requests. Static exports contain only static assets and zero server runtime.",
    "How are dynamic routes like `app/blog/[slug]/page.tsx` handled during a static export?",
    "You MUST export a `generateStaticParams()` function that returns every valid slug. If Next.js encounters a dynamic route without `generateStaticParams()`, the build fails."
  ),

  card(
    81,
    "Streaming SSR with Selective Hydration",
    "Rendering Lifecycle & PPR",
    "Deep Dive",
    "Streaming SSR streams HTML chunks over an open HTTP connection, while React 18/19 Selective Hydration hydrates interactive components in the browser as soon as their JavaScript chunks download—even before the rest of the HTML stream has finished.",
    `// Selective Hydration Mechanism:
// 1. Server streams HTML chunk for <CommentSection> inside Suspense.
// 2. Browser receives HTML and starts downloading the <CommentSection> client bundle.
// 3. User clicks inside <CommentSection> BEFORE the rest of the page finishes loading!
// 4. React intercepts the click event, prioritizes hydrating <CommentSection> first,
//    and replays the user's click seamlessly!

import { Suspense } from "react";

export default function FeedPage() {
  return (
    <div>
      <h1>Main Community Feed</h1>
      <Suspense fallback={<p>Streaming comments...</p>}>
        <CommentSection />
      </Suspense>
      <Suspense fallback={<p>Streaming sidebar ads...</p>}>
        <HeavySidebarAds />
      </Suspense>
    </div>
  );
}`,
    ["Selective Hydration", "Streaming SSR", "React 18", "Event Replay", "Hydration Priority"],
    [
      { title: "React Architecture: New Suspense SSR Architecture", url: "https://github.com/reactwg/react-18-community-group/discussions/37" }
    ],
    "What is 'Selective Hydration' and how does it prevent page unresponsiveness during slow loads?",
    "In traditional React SSR, the browser cannot hydrate any component until all HTML and JavaScript for the entire page is downloaded. Selective Hydration hydrates independent Suspense chunks as they arrive, and prioritizes hydrating components the user actively interacts with.",
    "Does Streaming SSR work over HTTP/1.1 or does it require HTTP/2?",
    "It works over both! Over HTTP/1.1, it uses standard chunked transfer encoding (`Transfer-Encoding: chunked`). Over HTTP/2 and HTTP/3, it uses native binary streaming frames."
  ),

  card(
    82,
    "Dynamic Rendering Triggers: `cookies()`, `headers()`, `searchParams`",
    "Rendering Lifecycle & PPR",
    "Mastery",
    "Invoking Dynamic APIs in a Server Component opts the entire route segment out of static caching and forces Dynamic Rendering. The primary dynamic triggers are `cookies()`, `headers()`, `searchParams`, and uncached `fetch()` requests.",
    `// app/account/page.tsx
import { cookies, headers } from "next/headers";

export default async function AccountPage() {
  // DYNAMIC TRIGGER 1: cookies()
  const cookieStore = await cookies(); // Next.js 15: async!
  const theme = cookieStore.get("theme")?.value;

  // DYNAMIC TRIGGER 2: headers()
  const headerStore = await headers(); // Next.js 15: async!
  const userAgent = headerStore.get("user-agent");

  // Route is now automatically marked as Dynamic (λ) at build time!
  return <div>Theme: {theme} | Browser: {userAgent}</div>;
}`,
    ["Dynamic Triggers", "cookies()", "headers()", "searchParams", "Dynamic Rendering"],
    [
      { title: "Next.js Docs: Dynamic Functions", url: "https://nextjs.org/docs/app/building-your-application/rendering/server-components#dynamic-functions" }
    ],
    "Why does calling `cookies()` or `headers()` inside a deeply nested child component make the parent page dynamic?",
    "Because rendering that child component requires incoming request headers that exist only at runtime. Unless wrapped inside a Suspense boundary under PPR, the entire page must wait for the request to arrive before rendering.",
    "Why are `cookies()` and `headers()` async functions in Next.js 15?",
    "To support asynchronous request handling and future React architecture (like PPR and React 19's asynchronous context), making request metadata access non-blocking."
  ),

  card(
    83,
    "Dynamic Segment Config: `dynamic = 'force-dynamic' | 'force-static' | 'error'`",
    "Rendering Lifecycle & PPR",
    "Mastery",
    "Developers can explicitly override Next.js's automatic rendering decisions by exporting the `dynamic` route segment configuration variable from a `page.tsx` or `layout.tsx`.",
    `// app/api/status/route.ts
// Option 1: force-dynamic (Always render on request; bypasses all route caches)
export const dynamic = "force-dynamic";

// Option 2: force-static (Forces static HTML prerendering; ignores dynamic functions)
// export const dynamic = "force-static";

// Option 3: error (Build FAILS if any component attempts to use dynamic functions!)
// export const dynamic = "error";

// Option 4: auto (Default Next.js heuristic: static unless dynamic APIs are used)
// export const dynamic = "auto";

export async function GET() {
  return Response.json({ status: "healthy", timestamp: Date.now() });
}`,
    ["Route Segment Config", "force-dynamic", "force-static", "dynamic = 'error'", "Configuration"],
    [
      { title: "Next.js Docs: Route Segment Config", url: "https://nextjs.org/docs/app/api-reference/file-conventions/route-segment-config#dynamic" }
    ],
    "What happens when you export `export const dynamic = 'error'` on a marketing page?",
    "It acts as a CI/CD build assertion: if any developer accidentally introduces a dynamic function (`cookies()`, uncached fetch) into that marketing page, the build immediately fails, guaranteeing the marketing page never loses its static CDN caching.",
    "What happens if you use `cookies()` inside a page configured with `export const dynamic = 'force-static'`?",
    "`cookies()` returns an empty object (`new Map()`), and dynamic request data is ignored, forcing the page to build statically with default fallback values."
  ),

  card(
    84,
    "Rendering Lifecycle Troubleshooting & Build Warnings",
    "Rendering Lifecycle & PPR",
    "Mastery",
    "Understanding build-time warnings like 'Dynamic server usage' and 'Page couldn't be rendered statically' is crucial for maintaining performance. These warnings indicate that an unintended dynamic call de-optimized a static route.",
    `// Common Build Warning:
// "Error: Dynamic server usage: Route /pricing couldn't be rendered statically because it used \`cookies\`."

// Root Cause:
// A child component or analytics wrapper called cookies() or headers() inside /pricing,
// accidentally forcing a static marketing page into dynamic SSR!

// Troubleshooting Steps:
// 1. Run 'npm run build' and inspect the build table (○ vs λ).
// 2. Identify the culprit component using React DevTools or stack traces.
// 3. Move the dynamic call into a client leaf or wrap it inside a Suspense boundary.
// 4. Alternatively, use 'export const dynamic = "error"' during CI to catch regressions early!`,
    ["Troubleshooting", "Dynamic server usage", "Build Warnings", "CI/CD Gates", "Debugging"],
    [
      { title: "Next.js Docs: Dynamic Server Usage Error", url: "https://nextjs.org/docs/messages/dynamic-server-error" }
    ],
    "What does the build error 'Dynamic server usage' mean?",
    "It means Next.js attempted to prerender a route as static HTML during `next build`, but encountered code that requires a live request (such as reading `cookies()`, `headers()`, or an uncached fetch)."
  )
];

module.exports = { cards };
