const { card } = require("../next_builder_helper.cjs");

const cards = [
  card(
    13,
    "File-System Routing Conventions: `page.tsx` & Segment Folders",
    "Routing Conventions",
    "Mastery",
    "In Next.js App Router, routing is defined by folders. A folder defines a URL segment (e.g. `app/dashboard/settings/`), but that route only becomes publicly accessible when it contains a special `page.tsx` file.",
    `// Folder to Route Mapping:
// app/page.tsx                     -> /
// app/dashboard/page.tsx           -> /dashboard
// app/dashboard/settings/page.tsx  -> /dashboard/settings

// Colocation Feature:
// Any other file inside the folder is private and NOT publicly accessible:
// app/dashboard/components/Button.tsx (NOT routeable)
// app/dashboard/lib/analytics.ts      (NOT routeable)

// app/dashboard/page.tsx:
export default async function DashboardPage() {
  return (
    <section>
      <h1>Dashboard Overview</h1>
      <p>This UI is uniquely rendered for /dashboard.</p>
    </section>
  );
}`,
    ["Routing", "page.tsx", "File-System", "Colocation", "URL Segments"],
    [
      { title: "Next.js Docs: Pages and Layouts", url: "https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts" }
    ],
    "What is the difference between a folder without a `page.tsx` and a folder with a `page.tsx`?",
    "A folder without a `page.tsx` is an internal route segment used solely for grouping or nesting layouts/components; navigating to it returns a 404 Not Found. A folder with `page.tsx` defines a publicly addressable leaf route.",
    "Can you place utility functions or UI components inside the same folder as `page.tsx`?",
    "Yes. The App Router supports safe file colocation: only special file names (`page`, `layout`, `loading`, `error`, `route`, `template`, `default`) participate in routing; all other files are private."
  ),

  card(
    14,
    "Root Layout (`app/layout.tsx`) vs Nested Layouts",
    "Routing Conventions",
    "Mastery",
    "The Root Layout (`app/layout.tsx`) is required for every Next.js app and must define `<html>` and `<body>` tags. Nested layouts wrap child routes within their segment, preserving state and scroll position across sibling page navigations without re-rendering the layout.",
    `// 1. Root Layout (app/layout.tsx) - REQUIRED
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <nav className="p-4 border-b">Global Header</nav>
        {children}
      </body>
    </html>
  );
}

// 2. Nested Dashboard Layout (app/dashboard/layout.tsx)
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      {/* Sidebar state is preserved when user navigates between /dashboard/analytics and /dashboard/orders! */}
      <aside className="w-64 border-r p-4">
        <ul>
          <li><a href="/dashboard/analytics">Analytics</a></li>
          <li><a href="/dashboard/orders">Orders</a></li>
        </ul>
      </aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}`,
    ["Root Layout", "Nested Layouts", "Layout Preservation", "State Preservation", "Navigation"],
    [
      { title: "Next.js Docs: Layouts", url: "https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts#layouts" }
    ],
    "Why don't nested layouts re-render when navigating between sibling routes within their subtree?",
    "Next.js preserves layout component instances during navigation (partial rendering). Only the dynamic `children` page segment changes, preventing wasteful layout re-mounting, re-fetching, and loss of client sidebar state or scroll positions.",
    "Can a nested layout define its own `<html>` or `<body>` tags?",
    "No. Only the top-level Root Layout (`app/layout.tsx`) can define `<html>` and `<body>`. Nested layouts wrap their children inside `<div>`, `<section>`, or semantic tags."
  ),

  card(
    15,
    "template.tsx vs layout.tsx: Remounting & Animation Cycles",
    "Routing Conventions",
    "Deep Dive",
    "While a `layout.tsx` preserves its component instance and state across navigations, a `template.tsx` creates a brand-new instance for every child navigation, resetting DOM state, re-synchronizing `useEffect` hooks, and triggering enter/exit CSS animations.",
    `// Comparison:
// layout.tsx: Persists across child route transitions (State stays intact).
// template.tsx: Re-mounts on every child transition (State resets, effects re-run).

// app/dashboard/template.tsx
"use client";

import { motion } from "framer-motion";

export default function DashboardTemplate({ children }: { children: React.ReactNode }) {
  return (
    // framer-motion page transition triggers on EVERY sub-route navigation!
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}`,
    ["template.tsx", "layout.tsx", "Page Transitions", "Framer Motion", "Re-mounting"],
    [
      { title: "Next.js Docs: Templates", url: "https://nextjs.org/docs/app/building-your-application/routing/pages-and-layouts#templates" }
    ],
    "When should a developer choose `template.tsx` instead of `layout.tsx`?",
    "Choose `template.tsx` when you specifically require: 1) enter/exit page transitions using animation libraries (Framer Motion), 2) resetting client state (e.g. feedback inputs or forms) on route changes, or 3) re-firing `useEffect` hooks (such as pageview analytics tracking) on navigation.",
    "Where does `template.tsx` render in the component hierarchy relative to `layout.tsx`?",
    "Next.js renders `template.tsx` between the layout and the page: `<Layout><Template><Page /></Template></Layout>`."
  ),

  card(
    16,
    "Instant Loading States with `loading.tsx` & Suspense Streams",
    "Routing Conventions",
    "Mastery",
    "Placing a `loading.tsx` file inside an App Router segment automatically wraps the segment's `page.tsx` in a React `<Suspense>` boundary. The server streams the loading skeleton immediately, displaying it while the page's async Server Component fetches data.",
    `// app/dashboard/loading.tsx (Instant Loading Skeleton)
export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse p-6">
      <div className="h-8 bg-slate-200 rounded w-1/4"></div>
      <div className="grid grid-cols-3 gap-4">
        <div className="h-32 bg-slate-200 rounded"></div>
        <div className="h-32 bg-slate-200 rounded"></div>
        <div className="h-32 bg-slate-200 rounded"></div>
      </div>
      <div className="h-64 bg-slate-200 rounded"></div>
    </div>
  );
}

// Behind the scenes, Next.js compiles:
// <Layout>
//   <Suspense fallback={<Loading />}>
//     <Page />
//   </Suspense>
// </Layout>`,
    ["loading.tsx", "Suspense", "Streaming", "Skeleton Screen", "Instant Feedback"],
    [
      { title: "Next.js Docs: Loading UI and Streaming", url: "https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming" }
    ],
    "Does `loading.tsx` replace the layout during loading transitions?",
    "No. The layout remains fully interactive and visible. Only the children slot inside the layout displays the `loading.tsx` skeleton until the page resolves.",
    "Why is `loading.tsx` superior to a traditional client-side spinner with `useEffect`?",
    "`loading.tsx` is prerendered on the server and delivered instantly on client navigation before any client JavaScript executes, eliminating layout shifts and providing instant visual feedback."
  ),

  card(
    17,
    "Granular Error Handling with `error.tsx` & reset()",
    "Routing Conventions",
    "Mastery",
    "An `error.tsx` file defines a React Error Boundary wrapping the route segment. If an async Server Component throws an unhandled exception, `error.tsx` catches the failure, isolates the blast radius to that segment, and provides a `reset()` retry function.",
    `// app/dashboard/error.tsx
"use client"; // Error boundaries MUST be Client Components!

import { useEffect } from "react";

export default function ErrorBoundary({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log exception to Datadog or Sentry
    console.error("Dashboard error caught by boundary:", error);
  }, [error]);

  return (
    <div className="p-6 border border-red-200 bg-red-50 rounded">
      <h2 className="text-red-800 font-bold">Something went wrong!</h2>
      <p className="text-sm text-red-600 mt-1">{error.message}</p>
      <button
        onClick={() => reset()} // Re-attempts to render the route segment
        className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      >
        Try Again
      </button>
    </div>
  );
}`,
    ["error.tsx", "Error Boundary", "reset()", "Blast Radius", "Fault Isolation"],
    [
      { title: "Next.js Docs: Error Handling", url: "https://nextjs.org/docs/app/building-your-application/routing/error-handling" }
    ],
    "Why must `error.tsx` always be declared as a Client Component (`'use client'`)?",
    "React Error Boundaries must implement client-side lifecycle methods (`componentDidCatch` or `getDerivedStateFromError`) to catch runtime render errors and provide interactive recovery mechanisms like the `reset()` callback.",
    "Can an `app/dashboard/error.tsx` catch an unhandled error thrown inside `app/dashboard/layout.tsx`?",
    "No! An `error.tsx` boundary only catches errors from its child `page.tsx` and nested subsegments. To catch errors thrown inside a layout, the `error.tsx` must reside in the parent folder segment."
  ),

  card(
    18,
    "Root Disaster Recovery with `global-error.tsx`",
    "Routing Conventions",
    "Deep Dive",
    "Errors thrown inside the Root Layout (`app/layout.tsx`) cannot be caught by `app/error.tsx`. To catch catastrophic failures in the root layout, Next.js provides `app/global-error.tsx`, which must define its own `<html>` and `<body>` tags.",
    `// app/global-error.tsx
"use client";

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-red-500">Critical Application Outage</h1>
          <p className="text-slate-300">A root layout component encountered an unrecoverable exception.</p>
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-white text-slate-900 font-bold rounded"
          >
            Reload Application
          </button>
        </div>
      </body>
    </html>
  );
}`,
    ["global-error.tsx", "Root Recovery", "Root Layout Error", "Disaster Recovery", "Catastrophic Failure"],
    [
      { title: "Next.js Docs: Handling Errors in Root Layouts", url: "https://nextjs.org/docs/app/building-your-application/routing/error-handling#handling-errors-in-root-layouts" }
    ],
    "Why must `global-error.tsx` declare its own `<html>` and `<body>` tags?",
    "Because `global-error.tsx` replaces the entire Root Layout (`app/layout.tsx`) when an unhandled root exception occurs. Without `<html>` and `<body>`, the browser would render an invalid HTML document structure.",
    "Does `global-error.tsx` execute in development mode?",
    "In local development, the Next.js Error Overlay takes precedence to aid debugging. `global-error.tsx` is specifically designed for production recovery."
  ),

  card(
    19,
    "404 Custom Handling with `not-found.tsx` & `notFound()`",
    "Routing Conventions",
    "Mastery",
    "Next.js automatically renders `not-found.tsx` for unmatched URL paths. Additionally, Server Components can programmatically trigger this UI by calling the `notFound()` primitive when a specific database record does not exist.",
    `// 1. Programmatic Trigger inside Server Component:
// app/products/[id]/page.tsx
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await db.product.findUnique({ where: { id } });

  // If item doesn't exist in database, trigger 404 UI immediately!
  if (!product) {
    notFound(); // Halts execution and displays nearest not-found.tsx
  }

  return <div><h1>{product.name}</h1></div>;
}

// 2. Custom 404 UI: app/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="text-center py-20 space-y-4">
      <h2 className="text-3xl font-bold">404 - Resource Not Found</h2>
      <p className="text-slate-600">The requested page or entity does not exist.</p>
      <Link href="/" className="text-blue-600 hover:underline">
        Return Home
      </Link>
    </div>
  );
}`,
    ["not-found.tsx", "notFound()", "HTTP 404", "Missing Entities", "Navigation"],
    [
      { title: "Next.js Docs: not-found.js", url: "https://nextjs.org/docs/app/api-reference/file-conventions/not-found" }
    ],
    "What HTTP status code is emitted when `notFound()` is invoked inside a Server Component during SSR?",
    "HTTP `404 Not Found`. Search engine crawlers correctly index the page as a 404 error rather than a 200 OK soft-404.",
    "Can `not-found.tsx` be nested within sub-folders (e.g. `app/dashboard/not-found.tsx`)?",
    "Yes. Invoking `notFound()` inside a sub-route triggers the closest nested `not-found.tsx` in the directory hierarchy."
  ),

  card(
    20,
    "Route Organization with Route Groups: `(group)`",
    "Routing Conventions",
    "Mastery",
    "Route Groups (wrapping folder names in parentheses, e.g. `app/(marketing)/about`) organize files and isolate layouts without altering the public URL path. They allow multiple distinct root layouts or partitioned team sub-architectures.",
    `// Route Group URL Behavior:
// app/(marketing)/about/page.tsx      -> URL: /about (Parentheses are omitted from URL!)
// app/(marketing)/contact/page.tsx    -> URL: /contact
// app/(shop)/cart/page.tsx            -> URL: /cart
// app/(shop)/checkout/page.tsx        -> URL: /checkout

// Architecture: Multiple Distinct Root Layouts
// app/(marketing)/layout.tsx -> Minimal public layout with marketing header/footer
// app/(dashboard)/layout.tsx -> Heavy authenticated layout with collapsible sidebar

// app/(marketing)/layout.tsx:
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="marketing-shell">
      <header className="p-4 bg-purple-600 text-white">Marketing Navigation</header>
      {children}
    </div>
  );
}`,
    ["Route Groups", "Parentheses Folders", "Layout Isolation", "Multiple Root Layouts", "Architecture"],
    [
      { title: "Next.js Docs: Route Groups", url: "https://nextjs.org/docs/app/building-your-application/routing/route-groups" }
    ],
    "How do Route Groups enable an application to have multiple distinct root layouts?",
    "By removing the top-level `app/layout.tsx` and creating two separate route groups with their own root layouts: `app/(marketing)/layout.tsx` and `app/(dashboard)/layout.tsx`, each defining their own `<html>` and `<body>` tags.",
    "What happens if two different route groups resolve to the same public URL (e.g. `app/(shop)/about/page.tsx` and `app/(marketing)/about/page.tsx`)?",
    "Next.js throws a build-time Route Conflict Error: 'Multiple page components resolve to the same URL path /about'."
  ),

  card(
    21,
    "Dynamic Segments `[id]` & Async Params in Next.js 15",
    "Routing Conventions",
    "Mastery",
    "Dynamic Segments allow routes to match variable URL paths. In Next.js 15, `params` is an asynchronous Promise that must be `await`ed before accessing properties, aligning with React 19's asynchronous request model.",
    `// app/posts/[postId]/page.tsx
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

// Next.js 15: params is a Promise!
interface PageProps {
  params: Promise<{ postId: string }>;
}

export default async function PostPage({ params }: PageProps) {
  // MUST await params in Next.js 15!
  const { postId } = await params;

  const post = await db.post.findUnique({ where: { id: postId } });
  if (!post) notFound();

  return (
    <article className="p-8">
      <h1 className="text-3xl font-bold">{post.title}</h1>
      <p>{post.body}</p>
    </article>
  );
}

// Generate static params at build time for high-speed SSG:
export async function generateStaticParams() {
  const posts = await db.post.findMany({ select: { id: true }, take: 20 });
  return posts.map(post => ({ postId: post.id }));
}`,
    ["Dynamic Segments", "Next.js 15", "Async Params", "generateStaticParams", "SSG"],
    [
      { title: "Next.js 15 Upgrade Guide: Async Request APIs", url: "https://nextjs.org/docs/app/building-your-application/upgrading/version-15#async-request-apis-breaking-change" }
    ],
    "Why did Next.js 15 change `params` and `searchParams` from synchronous objects to asynchronous Promises?",
    "To support Partial Prerendering (PPR) and compile-time optimization. By making dynamic parameters async, the server can render static layout shells immediately without waiting for dynamic request parameters to resolve.",
    "What compilation warning occurs if you access `params.postId` directly without `await` in Next.js 15?",
    "Next.js emits a runtime warning: 'Route /posts/[postId] used params.postId without awaiting params. Awaiting params will be strictly enforced in future versions.'"
  ),

  card(
    22,
    "Catch-All Segments `[...slug]` vs Optional Catch-All `[[...slug]]`",
    "Routing Conventions",
    "Mastery",
    "Catch-all segments extend dynamic routes to match arbitrarily deep nested paths. Standard catch-all `[...slug]` requires at least one parameter; optional catch-all `[[...slug]]` also matches the root route without parameters.",
    `// 1. Standard Catch-All: app/docs/[...slug]/page.tsx
// Matches:
// /docs/intro             -> params.slug = ['intro']
// /docs/auth/jwt          -> params.slug = ['auth', 'jwt']
// /docs/auth/mfa/sms      -> params.slug = ['auth', 'mfa', 'sms']
// Does NOT match: /docs   -> Returns 404!

// 2. Optional Catch-All: app/shop/[[...slug]]/page.tsx
// Matches:
// /shop                   -> params.slug = undefined (Matches root!)
// /shop/shoes             -> params.slug = ['shoes']
// /shop/shoes/nike/air    -> params.slug = ['shoes', 'nike', 'air']

export default async function ShopPage({
  params
}: {
  params: Promise<{ slug?: string[] }>
}) {
  const { slug } = await params;

  if (!slug || slug.length === 0) {
    return <h1>All Categories Catalog</h1>;
  }

  return (
    <div>
      <h1>Category: {slug.join(" > ")}</h1>
    </div>
  );
}`,
    ["Catch-All", "Optional Catch-All", "slug", "Nested Segments", "Docs Architecture"],
    [
      { title: "Next.js Docs: Catch-all Segments", url: "https://nextjs.org/docs/app/building-your-application/routing/dynamic-routes#catch-all-segments" }
    ],
    "When is an Optional Catch-All `[[...slug]]` preferable to a Standard Catch-All `[...slug]`?",
    "When a single page component serves both the index/landing view and all nested child category levels (such as documentation hubs or CMS category trees), eliminating the need for a separate duplicate `page.tsx` at the root folder.",
    "What data type does `params.slug` resolve to in catch-all routes?",
    "An array of strings (`string[]`), representing each slash-separated path segment in sequential order."
  ),

  card(
    23,
    "Query Strings & Async SearchParams Handling",
    "Routing Conventions",
    "Mastery",
    "Query strings (`?sort=asc&filter=shoes`) are accessed via `searchParams` in Page components. In Next.js 15, `searchParams` is an async Promise. Because search params cannot be known at build time, accessing them opts the page into Dynamic Rendering.",
    `// app/products/page.tsx (Next.js 15)
import { db } from "@/lib/db";

interface ProductsPageProps {
  searchParams: Promise<{
    sort?: "asc" | "desc";
    category?: string;
    page?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  // Await searchParams in Next.js 15
  const { sort = "desc", category, page = "1" } = await searchParams;

  const products = await db.product.findMany({
    where: category ? { category } : undefined,
    orderBy: { price: sort },
    take: 10,
    skip: (parseInt(page, 10) - 1) * 10
  });

  return (
    <div>
      <h2>Browsing {category || "All Products"}</h2>
      <ul>{products.map(p => <li key={p.id}>{p.name} - \${p.price}</li>)}</ul>
    </div>
  );
}`,
    ["searchParams", "Query Strings", "Dynamic Rendering", "Next.js 15", "Pagination"],
    [
      { title: "Next.js Docs: searchParams", url: "https://nextjs.org/docs/app/api-reference/file-conventions/page#searchparams-optional" }
    ],
    "Why are `searchParams` available only in `page.tsx` and NOT in `layout.tsx`?",
    "Layouts do NOT re-render during client-side search parameter navigations (e.g. changing from `?tab=1` to `?tab=2`). Passing `searchParams` to layouts would force the entire layout and all its children to re-render, destroying layout cache benefits. Use the `useSearchParams()` hook inside client children if needed.",
    "Why does accessing `searchParams` opt a page out of static HTML prerendering (SSG)?",
    "Query parameters are dynamic runtime values provided by the client's HTTP request header URL and cannot be predicted at build time, forcing the server to render dynamically on request."
  ),

  card(
    24,
    "Client-Side Navigation: `<Link>` Prefetching & useRouter",
    "Routing Conventions",
    "Mastery",
    "Next.js navigates client-side using `<Link>` and `useRouter`. `<Link>` automatically prefetches linked Server Component route payloads into the client Router Cache when links enter the browser viewport, making clicks feel instantaneous.",
    `// 1. Declarative Navigation with <Link>:
import Link from "next/link";

export function NavigationBar() {
  return (
    <nav className="flex gap-4">
      {/* Automatically prefetches the RSC payload when link scrolls into view! */}
      <Link href="/dashboard" prefetch={true} className="hover:underline">
        Dashboard
      </Link>
      
      {/* Disable prefetching for high-frequency or heavy routes */}
      <Link href="/heavy-analytics" prefetch={false}>
        Analytics
      </Link>
    </nav>
  );
}

// 2. Programmatic Navigation with useRouter:
"use client";

import { useRouter } from "next/navigation";

export function CheckoutButton() {
  const router = useRouter();

  const handleCheckout = async () => {
    await processOrder();
    // Programmatic soft navigation
    router.push("/order-confirmation");
  };

  return <button onClick={handleCheckout}>Complete Purchase</button>;
}`,
    ["<Link>", "useRouter", "Prefetching", "Soft Navigation", "Router Cache"],
    [
      { title: "Next.js Docs: Linking and Navigating", url: "https://nextjs.org/docs/app/building-your-application/routing/linking-and-navigating" }
    ],
    "What is the difference between a 'Soft Navigation' and a 'Hard Navigation'?",
    "A soft navigation (via `<Link>` or `router.push`) replaces only changed route segments in the DOM, preserves React client state, and fetches the lightweight RSC payload. A hard navigation (clicking a regular `<a href>` or window.location) re-downloads all HTML, resets the DOM, and re-executes all scripts.",
    "How does viewport prefetching behave in production versus local development?",
    "In local development (`next dev`), prefetching is disabled to reduce console noise and server load. In production builds (`next start`), `<Link>` automatically prefetches routes as soon as they enter the browser viewport."
  )
];

module.exports = { cards };
