const { card } = require("../next_builder_helper.cjs");

const cards = [
  card(
    61,
    "The 4-Tier Next.js Caching Architecture Overview",
    "Caching Architecture",
    "Mastery",
    "Next.js App Router employs a multi-layered caching pipeline to optimize performance: 1) Request Memoization (React per-render deduplication), 2) Data Cache (persistent cross-request fetch cache), 3) Full Route Cache (server-side static HTML/RSC cache), and 4) Router Cache (browser in-memory client navigation cache).",
    `// The 4-Tier Caching Flowchart:
// [ Client Browser ]
//         |
//         v
// [ 4. Router Cache ] (In-memory on client; stores visited/prefetched RSC payloads)
//         | (Cache Miss / Hard Refresh)
//         v
// [ 3. Full Route Cache ] (Server-side; static HTML + RSC payloads from build or revalidation)
//         | (Cache Miss / Dynamic Render)
//         v
// [ 1. Request Memoization ] (React deduplication: identical fetch() calls in one render pass)
//         |
//         v
// [ 2. Data Cache ] (Server-side persistent store; survives across user sessions and server restarts)
//         |
//         v
// [ Upstream Database / External REST API ]`,
    ["Caching", "4-Tier Architecture", "Request Memoization", "Data Cache", "Full Route Cache"],
    [
      { title: "Next.js Docs: Caching in Next.js", url: "https://nextjs.org/docs/app/building-your-application/caching" }
    ],
    "Which cache in the 4-tier pipeline runs on the client browser?",
    "The Client Router Cache. It stores pre-fetched and visited route segments in the browser's JavaScript memory for the duration of the user's session.",
    "Which cache survives application restarts and redeployments?",
    "The Data Cache. It is a persistent HTTP and data store (persisted on disk or shared external key-value stores like Redis) that survives across server restarts and user requests."
  ),

  card(
    62,
    "Tier 1: Request Memoization (React `fetch` Deduplication)",
    "Caching Architecture",
    "Deep Dive",
    "Request Memoization is a React runtime feature that deduplicates identical `fetch()` requests (matching URL and options) made during a single server render pass. It allows multiple components to call the same API without coordinating a shared state store.",
    `// Both components execute in the same render pass:
// components/Header.tsx
export async function Header() {
  // First fetch call: Executes real HTTP network request
  const res = await fetch("https://api.internal/user/profile");
  const user = await res.json();
  return <header>Welcome {user.name}</header>;
}

// components/Sidebar.tsx
export async function Sidebar() {
  // Second fetch call with identical URL & options:
  // ZERO network request made! React returns the memoized result from memory!
  const res = await fetch("https://api.internal/user/profile");
  const user = await res.json();
  return <aside>Role: {user.role}</aside>;
}

// Scope of Memoization:
// - Duration: Strictly for the lifetime of that single incoming server request.
// - Garbage Collection: Cleared as soon as the response is flushed to the client.`,
    ["Request Memoization", "fetch Deduplication", "React cache", "Colocation", "Single Request Lifetime"],
    [
      { title: "Next.js Docs: Request Memoization", url: "https://nextjs.org/docs/app/building-your-application/caching#request-memoization" }
    ],
    "What is the difference between Request Memoization and the Data Cache?",
    "Request Memoization lives only for the duration of a single request render and exists in memory to deduplicate calls within that render. The Data Cache persists across multiple requests, multiple users, and server restarts.",
    "Does Request Memoization apply to POST, PUT, or DELETE requests?",
    "No. Request Memoization applies strictly to `GET` requests made with `fetch()`."
  ),

  card(
    63,
    "Tier 2: The Data Cache (Persistent Fetch Cache)",
    "Caching Architecture",
    "Mastery",
    "The Data Cache persists data fetched via `fetch()` across incoming requests and deployments. It supports Incremental Static Regeneration (ISR) and cache invalidation via tags (`next: { tags: [...] }`) and revalidation intervals (`next: { revalidate: 3600 }`).",
    `// 1. Time-Based Revalidation (ISR):
// Caches data on server for 1 hour; serves cached copies to all users
const res = await fetch("https://api.github.com/repos/vercel/next.js", {
  next: { revalidate: 3600 } // Revalidate at most once every hour
});

// 2. Tag-Based Revalidation (On-Demand):
// Tagged fetch requests can be purged dynamically from Server Actions
const productRes = await fetch("https://api.store.com/products/42", {
  next: { tags: ["product-42", "catalog"] }
});

// In a Server Action after updating the price in database:
// revalidateTag("product-42"); // Instantly clears this item from Data Cache!`,
    ["Data Cache", "ISR", "revalidate", "Cache Tags", "Persistent Cache"],
    [
      { title: "Next.js Docs: Data Cache", url: "https://nextjs.org/docs/app/building-your-application/caching#data-cache" }
    ],
    "Where is the Next.js Data Cache stored when self-hosting in Docker or Node.js?",
    "By default, on the local server file system (`.next/cache/fetch-cache/`). In clustered environments with multiple container replicas, you must configure a custom `CacheHandler` (e.g. backed by Redis) so all pods share the same Data Cache.",
    "How does Time-Based Revalidation (`revalidate: 60`) work when an expired request arrives?",
    "Stale-While-Revalidate: Next.js immediately serves the stale cached data to the requesting user while triggering an asynchronous background fetch to refresh the Data Cache for subsequent users."
  ),

  card(
    64,
    "Tier 3: Full Route Cache (HTML & RSC Payload on Server)",
    "Caching Architecture",
    "Mastery",
    "The Full Route Cache stores the rendered HTML and React Server Component (Flight) payload of static routes on the server at build time or during revalidation. It serves incoming page requests with near-instantaneous response times.",
    `// Static Route (Automatically cached in Full Route Cache):
// app/about/page.tsx
export default function AboutPage() {
  return <h1>About Our Enterprise</h1>;
}
// Build Output:
// ○ /about (Static) -> Pre-rendered as static HTML and cached permanently!

// Dynamic Route (Bypasses Full Route Cache):
// app/dashboard/page.tsx
import { cookies } from "next/headers";

export default async function DashboardPage() {
  // Using dynamic function (cookies, headers, searchParams)
  // opts the route OUT of the Full Route Cache!
  const cookieStore = await cookies();
  return <div>Welcome User</div>;
}`,
    ["Full Route Cache", "Static Pages", "HTML Caching", "Build Time", "SSG"],
    [
      { title: "Next.js Docs: Full Route Cache", url: "https://nextjs.org/docs/app/building-your-application/caching#full-route-cache" }
    ],
    "What operations cause a route to opt out of the Full Route Cache?",
    "Using dynamic APIs (`cookies()`, `headers()`, `searchParams`), making uncached `fetch(..., { cache: 'no-store' })` calls, using `connection()`, or exporting `export const dynamic = 'force-dynamic'`.",
    "What is the difference between the Full Route Cache and the Data Cache?",
    "The Data Cache caches raw data values returned by `fetch()`. The Full Route Cache caches the entire pre-rendered HTML document and React Flight virtual DOM tree of the route."
  ),

  card(
    65,
    "Tier 4: Client Router Cache (In-Memory Browser Cache)",
    "Caching Architecture",
    "Mastery",
    "The Client Router Cache is an in-memory client-side cache storing visited and prefetched route segments as users navigate. It enables instant back/forward transitions without issuing server network requests.",
    `// Behavior of Router Cache:
// User is on / -> Browser prefetches /dashboard via <Link href="/dashboard">
// User clicks Link -> Instant navigation from Router Cache!
// User clicks Back -> Instant back navigation without re-fetching!

// Invalidating the Router Cache on the Client:
"use client";

import { useRouter } from "next/navigation";

export function RefreshButton() {
  const router = useRouter();

  const handleRefresh = () => {
    // router.refresh() purges the client router cache for the active route
    // and fetches fresh Server Component data from the server!
    router.refresh();
  };

  return <button onClick={handleRefresh}>Reload Fresh Data</button>;
}`,
    ["Router Cache", "Client Cache", "router.refresh()", "Prefetch Cache", "Instant Navigation"],
    [
      { title: "Next.js Docs: Router Cache", url: "https://nextjs.org/docs/app/building-your-application/caching#client-side-router-cache" }
    ],
    "Why does external database data updated by a third party not automatically show up when a user navigates back to a page?",
    "Because the Client Router Cache has cached the route segment in browser memory. To force fresh data, the app must call `router.refresh()` or invoke a Server Action that calls `revalidatePath()`.",
    "Does the Client Router Cache persist across browser tab refreshes (F5)?",
    "No. It lives strictly in the browser's JavaScript memory and is completely wiped whenever the page is refreshed or the tab is closed."
  ),

  card(
    66,
    "Next.js 15 Caching Paradigm Shift: Uncached Defaults",
    "Caching Architecture",
    "Mastery",
    "In Next.js 14, `fetch()` requests were aggressively cached by default (`force-cache`). In Next.js 15, `fetch()` requests, `GET` route handlers, and client navigations default to `no-store` (uncached), eliminating unexpected stale-data bugs.",
    `// Next.js 14 Behavior (Historical):
// fetch("https://api.com/items"); // Cached indefinitely by default!

// Next.js 15 Behavior (Modern Standard):
// fetch("https://api.com/items"); // Defaults to cache: 'no-store'! Fresh data on every call!

// In Next.js 15, caching is EXPLICIT:
// 1. Explicitly opt INTO Data Caching:
const cachedRes = await fetch("https://api.com/items", {
  cache: "force-cache" // Explicit opt-in!
});

// 2. Explicitly opt into ISR time-based revalidation:
const isrRes = await fetch("https://api.com/items", {
  next: { revalidate: 300 } // Cache for 5 minutes
});

// 3. Client Navigation Router Cache in Next.js 15:
// Page segments with dynamic rendering have a 0-second stale time by default!`,
    ["Next.js 15", "no-store", "force-cache", "Breaking Change", "Caching Defaults"],
    [
      { title: "Next.js 15 Release Notes: Caching Updates", url: "https://nextjs.org/blog/next-15#caching-updates" }
    ],
    "Why did the Next.js core team change the default caching behavior in Next.js 15 from `force-cache` to `no-store`?",
    "Aggressive default caching caused widespread developer confusion: newly edited database records wouldn't update on screen, mutations required manual revalidation everywhere, and developers spent hours debugging why their apps were serving stale data.",
    "How can you re-enable global fetch caching across an entire route in Next.js 15?",
    "By exporting route segment config: `export const fetchCache = 'default-cache'` or `export const dynamic = 'force-static'`."
  ),

  card(
    67,
    "On-Demand Revalidation: `revalidateTag()` Cache Tagging",
    "Caching Architecture",
    "Mastery",
    "Cache Tagging allows assigning arbitrary semantic labels to `fetch()` calls. Calling `revalidateTag(tag)` instantaneously purges all cached entries associated with that tag across the entire application without affecting unrelated caches.",
    `// 1. Tagging a fetch request:
// app/products/[id]/page.tsx
export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const res = await fetch(\`https://api.store.com/products/\${id}\`, {
    next: {
      tags: [\`product-\${id}\`, "products-all"] // Multiple tags allowed!
    }
  });
  const product = await res.json();
  return <h1>{product.name}</h1>;
}

// 2. On-Demand Revalidation Webhook or Server Action:
// app/api/webhook/revalidate/route.ts
import { revalidateTag } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== process.env.CMS_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tag } = await req.json();
  // Instantly purge data cache across all routes referencing this tag!
  revalidateTag(tag);

  return NextResponse.json({ revalidated: true, tag, now: Date.now() });
}`,
    ["revalidateTag", "Cache Tags", "Webhook Revalidation", "CMS Sync", "Granular Invalidation"],
    [
      { title: "Next.js Docs: revalidateTag", url: "https://nextjs.org/docs/app/api-reference/functions/revalidate-tag" }
    ],
    "What is the maximum length and format restrictions on cache tags in Next.js?",
    "Tags must be strings with a maximum length of 256 characters. They are case-sensitive and cannot contain control characters.",
    "Does `revalidateTag` invalidate the cache on the current server only, or across all cluster pods?",
    "If using a shared external `CacheHandler` (such as Redis), `revalidateTag` invalidates the tag centrally for all container instances. If using local disk cache, invalidation affects only the node handling the request."
  ),

  card(
    68,
    "Path-Based Invalidation: `revalidatePath()` Mechanics",
    "Caching Architecture",
    "Mastery",
    "The `revalidatePath()` function purges the Full Route Cache and Data Cache for a specific URL path. It supports invalidating a single page, a dynamic route pattern, or an entire layout subtree.",
    `import { revalidatePath } from "next/cache";

// 1. Revalidate a specific static URL path:
revalidatePath("/blog/post-1");

// 2. Revalidate all pages under a dynamic segment:
revalidatePath("/blog/[slug]", "page");

// 3. Revalidate an entire layout and all its child routes:
revalidatePath("/dashboard", "layout");

// 4. Revalidate the entire application (nuclear option):
revalidatePath("/", "layout");`,
    ["revalidatePath", "Path Invalidation", "Layout Invalidation", "Full Route Cache", "Cache Purge"],
    [
      { title: "Next.js Docs: revalidatePath", url: "https://nextjs.org/docs/app/api-reference/functions/revalidate-path" }
    ],
    "What is the difference between `revalidatePath(path, 'page')` and `revalidatePath(path, 'layout')`?",
    "`'page'` revalidates only the leaf `page.tsx` matching that exact path. `'layout'` revalidates the layout and cascades invalidation to every nested child route and sub-page under that layout directory.",
    "When should you use `revalidatePath` versus `revalidateTag`?",
    "Use `revalidatePath` when you know the exact URL path that changed (e.g. after editing `/settings/profile`). Use `revalidateTag` when data changes that is displayed across multiple unpredictable URLs across the site (e.g. a product price changed)."
  ),

  card(
    69,
    "Opting Out of Caching: `cache: 'no-store'`, `noStore()`, & Dynamic Mode",
    "Caching Architecture",
    "Mastery",
    "When real-time data is required (stock tickers, live chat, personalized dashboards), caching must be disabled. Next.js provides multiple mechanisms to opt out at the request level, component level, or route level.",
    `// 1. Request-Level Opt-out (fetch):
const liveData = await fetch("https://api.finance.com/stocks", {
  cache: "no-store" // Never caches in Data Cache!
});

// 2. Component-Level Opt-out using unstable_noStore / connection():
import { connection } from "next/server"; // Next.js 15 standard

export async function LiveCryptoPrice() {
  await connection(); // Signals to Next.js that this component requires an active request connection!
  const price = await getLivePrice();
  return <div>BTC: \${price}</div>;
}

// 3. Route-Level Segment Configuration:
// app/admin/page.tsx
export const dynamic = "force-dynamic"; // Equivalent to getServerSideProps in Pages Router!
export const revalidate = 0;`,
    ["no-store", "connection()", "force-dynamic", "Opt-out", "Real-Time Data"],
    [
      { title: "Next.js Docs: Opting Out of Caching", url: "https://nextjs.org/docs/app/building-your-application/caching#opting-out-of-caching" }
    ],
    "What is the difference between `export const dynamic = 'force-dynamic'` and `export const revalidate = 0`?",
    "They achieve the same end result (preventing static prerendering and forcing dynamic rendering per request), but `force-dynamic` is the modern, semantic segment config that explicitly disables the Full Route Cache.",
    "What is the purpose of `await connection()` introduced in Next.js 15?",
    "It provides a clean, explicit primitive that marks a Server Component as dynamic and stream-dependent, replacing older workarounds like reading dummy headers or calling `unstable_noStore()`."
  ),

  card(
    70,
    "Using `React.cache()` for ORM & Database Query Deduplication",
    "Caching Architecture",
    "Mastery",
    "While `fetch()` automatically benefits from Request Memoization, direct database queries (Prisma, Drizzle, raw SQL) do not. Wrapping database queries in React's `cache()` function provides per-request deduplication across the component tree.",
    `// lib/queries.ts
import { cache } from "react";
import { db } from "@/lib/db";

// Wrap direct database query in React.cache()
export const getUserById = cache(async (id: string) => {
  console.log(\`[DB QUERY] Executing PostgreSQL query for user \${id}\`);
  return db.user.findUnique({ where: { id } });
});

// app/layout.tsx:
// Calls getUserById("usr_123") -> Executes SQL query!
const user = await getUserById("usr_123");

// app/page.tsx (Rendered in the same request):
// Calls getUserById("usr_123") -> ZERO SQL query executed!
// Returns cached promise from React memory!
const sameUser = await getUserById("usr_123");`,
    ["React.cache", "Database Memoization", "ORM Deduplication", "Prisma", "Drizzle"],
    [
      { title: "React Docs: cache", url: "https://react.dev/reference/react/cache" }
    ],
    "Why shouldn't `React.cache()` be used for global cross-request caching?",
    "`React.cache()` is scoped strictly to the lifecycle of a single incoming server request. Once the request terminates, the cache is destroyed. It cannot be used to share cached database queries across different users or subsequent requests.",
    "How does `React.cache()` compare arguments to detect cache hits?",
    "It uses JavaScript's `Object.is()` shallow equality. Passing primitive arguments (`id: string`) produces reliable cache hits; passing newly created objects (`{ id: '1' }`) will cause cache misses unless the object reference is identical."
  ),

  card(
    71,
    "Stale-While-Revalidate (SWR) Time-Based Revalidation",
    "Caching Architecture",
    "Mastery",
    "Incremental Static Regeneration (ISR) uses the HTTP Stale-While-Revalidate pattern. When a user requests an expired page, Next.js instantly returns the stale cached version while asynchronously generating a fresh copy in the background.",
    `// Timeline of an ISR Stale-While-Revalidate Lifecycle:
// export const revalidate = 60; // 60 seconds TTL

// [T=0s] Build time: Page rendered statically -> Version A saved in cache.
// [T=30s] User 1 requests page -> Next.js serves Version A in 5ms.
// [T=65s] TTL expired! (Page is now STALE)
// [T=70s] User 2 requests page -> Next.js INSTANTLY serves Version A (Stale)!
//         AND initiates a background server task to regenerate the page.
// [T=72s] Background task finishes -> Version B saved in cache.
// [T=75s] User 3 requests page -> Next.js serves fresh Version B in 5ms!`,
    ["ISR", "Stale-While-Revalidate", "SWR", "Background Regeneration", "Performance"],
    [
      { title: "Next.js Docs: Time-based Revalidation", url: "https://nextjs.org/docs/app/building-your-application/data-fetching/fetching#time-based-revalidation" }
    ],
    "What happens if background regeneration fails (e.g. database blip) during an ISR revalidation?",
    "Next.js silently retains the existing stale cached page and continues serving it to subsequent users until the next request successfully regenerates the page, guaranteeing 100% uptime even during database outages.",
    "Does time-based revalidation run a background cron job to update pages every N seconds?",
    "No! Revalidation is lazy (on-demand): the background regeneration task triggers only when a real user request arrives after the TTL has expired."
  ),

  card(
    72,
    "Caching Anti-Patterns: Cache Poisoning & Stale Session Traps",
    "Caching Architecture",
    "Deep Dive",
    "The two most dangerous caching anti-patterns in Next.js are: 1) Caching personalized user data (PII, balances) in the shared Data Cache, serving User A's data to User B, and 2) Stale session data when cookies are updated without invalidating client caches.",
    `// CATASTROPHIC ANTI-PATTERN 1: Caching personalized user data globally
// export async function getUserProfile(userId: string) {
//   return fetch(\`https://api.internal/users/\${userId}\`, {
//     cache: "force-cache" // DISASTER: Next.js stores this in the SHARED Data Cache!
//   });
// }

// CORRECT PATTERN: Personalized data must NEVER be cached in shared server Data Cache!
export async function getUserProfileSecure(userId: string) {
  return fetch(\`https://api.internal/users/\${userId}\`, {
    cache: "no-store", // Private data must never be shared across users!
    headers: { Authorization: \`Bearer \${token}\` }
  });
}

// CATASTROPHIC ANTI-PATTERN 2: Client Router Cache Stale Session Trap
// User logs out -> Server clears cookie -> Client navigates to / ->
// Client Router Cache serves pre-fetched cached /dashboard showing logged-in UI!
// Fix: Always call router.refresh() or window.location.href = '/login' on logout!`,
    ["Cache Poisoning", "Data Leak", "Security Trap", "no-store", "Session Hygiene"],
    [
      { title: "Next.js Security: Caching Pitfalls", url: "https://nextjs.org/docs/app/building-your-application/caching" }
    ],
    "Why must authenticated user data always be fetched with `cache: 'no-store'` in Server Components?",
    "The Data Cache and Full Route Cache are shared across all users on the server. Caching personalized responses in a shared cache causes Cache Poisoning, where confidential user data (emails, credit cards, balances) is served to unrelated strangers.",
    "How does a production application ensure client caches are completely wiped upon user logout?",
    "Execute a hard navigation (`window.location.href = '/login'`) instead of `router.push()`, or explicitly call `router.refresh()` to purge the in-memory Client Router Cache."
  )
];

module.exports = { cards };
