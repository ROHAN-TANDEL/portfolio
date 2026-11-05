const recipes = [
  {
    id: "next-ex-01",
    title: "Root Layout with Global Font, Metadata & Theme Provider",
    category: "App Router & RSC",
    difficulty: "beginner",
    whatThisCodeCovers: "A production Root Layout (app/layout.tsx) configuring zero-layout-shift Google Fonts via next/font, static OpenGraph metadata, and a client-side ThemeProvider context bridge.",
    conceptsCovered: ["Root Layout", "next/font/google", "Metadata", "Client Context Provider", "Zero-CLS"],
    code: `// app/layout.tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ThemeProvider } from "@/components/ThemeProvider";
import "@/app/globals.css";

// 1. Configure Inter font with display swap and CSS variable
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter"
});

// 2. Static Root Metadata
export const metadata: Metadata = {
  title: {
    template: "%s | Acme Enterprise",
    default: "Acme Enterprise Platform"
  },
  description: "Next-generation cloud management platform.",
  metadataBase: new URL("https://acme.com"),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://acme.com",
    siteName: "Acme Enterprise"
  }
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-slate-50 text-slate-900 font-sans antialiased">
        {/* Client Provider wraps children without converting children into Client Components! */}
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <header className="border-b p-4 flex justify-between items-center bg-white">
            <span className="font-bold text-lg">Acme Corp</span>
          </header>
          <main>{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}`,
    breakdown: [
      "Sets up Next.js root layout with mandatory <html> and <body> tags.",
      "Self-hosts Inter font automatically via next/font to eliminate font swap layout shifts.",
      "Configures title template ('%s | Acme Enterprise') inherited by all child pages.",
      "Mounts ThemeProvider client boundary cleanly at the root."
    ],
    expectedOutput: "Renders universal application shell with pre-loaded font and theme context."
  },

  {
    id: "next-ex-02",
    title: "Nested Dashboard Layout with Preserved Sidebar State",
    category: "Routing Conventions",
    difficulty: "intermediate",
    whatThisCodeCovers: "A nested dashboard layout with a collapsible interactive client sidebar that preserves open/closed state across navigations between sibling child pages.",
    conceptsCovered: ["Nested Layout", "State Preservation", "Client Sidebar", "Partial Rendering", "Sub-routes"],
    code: `// 1. Interactive Client Sidebar: components/DashboardSidebar.tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashboardSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const links = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/analytics", label: "Analytics" },
    { href: "/dashboard/billing", label: "Billing" }
  ];

  return (
    <aside className={\`border-r bg-white p-4 transition-all \${collapsed ? "w-16" : "w-64"}\`}>
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="mb-4 text-xs font-bold text-slate-500 hover:text-black"
      >
        {collapsed ? "▶" : "◀ COLLAPSE"}
      </button>
      <nav className="flex flex-col gap-2">
        {links.map(l => (
          <Link
            key={l.href}
            href={l.href}
            className={\`p-2 rounded font-medium \${pathname === l.href ? "bg-slate-900 text-white" : "hover:bg-slate-100"}\`}
          >
            {collapsed ? l.label[0] : l.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}

// 2. Nested Layout: app/dashboard/layout.tsx
import { DashboardSidebar } from "@/components/DashboardSidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-65px)]">
      {/* Sidebar instance is preserved when user navigates between /analytics and /billing! */}
      <DashboardSidebar />
      <div className="flex-1 p-8 bg-slate-50">{children}</div>
    </div>
  );
}`,
    breakdown: [
      "Demonstrates App Router partial rendering: only children swap during navigation.",
      "Sidebar collapse state remains completely intact when navigating between dashboard tabs.",
      "Uses usePathname hook to highlight the active link in the sidebar.",
      "Wraps dashboard routes without altering the public URL paths."
    ],
    expectedOutput: "Collapsible sidebar persists state while switching between /dashboard/analytics and /billing."
  },

  {
    id: "next-ex-03",
    title: "Animated Page Transitions using `template.tsx`",
    category: "Routing Conventions",
    difficulty: "intermediate",
    whatThisCodeCovers: "Using template.tsx with Framer Motion to trigger enter and exit animations on every sub-route navigation where layout.tsx would normally persist.",
    conceptsCovered: ["template.tsx", "layout.tsx vs template.tsx", "Framer Motion", "Page Transitions", "Re-mounting"],
    code: `// app/portfolio/template.tsx
"use client";

import { motion } from "framer-motion";

export default function PortfolioTemplate({ children }: { children: React.ReactNode }) {
  return (
    // Unlike layout.tsx, template.tsx generates a brand-new component instance
    // on EVERY route change, triggering this animation on every click!
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ ease: "easeInOut", duration: 0.35 }}
      className="w-full"
    >
      {children}
    </motion.div>
  );
}

// app/portfolio/projects/page.tsx:
export default function ProjectsPage() {
  return <div><h1 className="text-2xl font-bold">Featured Projects</h1></div>;
}

// app/portfolio/about/page.tsx:
export default function AboutPage() {
  return <div><h1 className="text-2xl font-bold">About the Creator</h1></div>;
}`,
    breakdown: [
      "Contrasts template.tsx against layout.tsx: templates re-mount on every navigation.",
      "Applies smooth fade-in and slide-up transition via Framer Motion.",
      "Ideal for re-triggering entrance animations and pageview tracking effects.",
      "Does not interfere with parent layout navigation."
    ],
    expectedOutput: "Navigating between /portfolio/projects and /portfolio/about smoothly fades and slides content."
  },

  {
    id: "next-ex-04",
    title: "Granular Route Segment Error Boundary with `reset()`",
    category: "Routing Conventions",
    difficulty: "intermediate",
    whatThisCodeCovers: "A dedicated error.tsx error boundary catching server rendering failures in a specific route segment, logging errors to Sentry, and providing a reset() retry handler.",
    conceptsCovered: ["error.tsx", "reset()", "Error Boundary", "Sentry", "Blast Radius Isolation"],
    code: `// app/dashboard/billing/error.tsx
"use client"; // Error boundaries MUST be Client Components!

import { useEffect } from "react";

export default function BillingErrorBoundary({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log exception to observability platform with unique error digest
    console.error(\`[BillingError] Digest: \${error.digest}\`, error);
  }, [error]);

  return (
    <div className="p-8 border border-red-200 bg-red-50 rounded-lg max-w-lg mx-auto mt-10 text-center">
      <div className="text-red-500 text-4xl mb-2">⚠</div>
      <h2 className="text-xl font-bold text-red-900">Failed to Load Billing Records</h2>
      <p className="text-sm text-red-700 mt-2">
        {error.message || "An unexpected error occurred while communicating with Stripe."}
      </p>
      {error.digest && (
        <p className="text-xs text-slate-400 mt-1">Error Reference: {error.digest}</p>
      )}
      <div className="mt-6 flex justify-center gap-4">
        <button
          onClick={() => reset()} // Re-attempts to execute Server Component render pass
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded shadow"
        >
          Retry Connection
        </button>
        <a href="/dashboard" className="px-4 py-2 border border-slate-300 rounded hover:bg-white">
          Back to Overview
        </a>
      </div>
    </div>
  );
}`,
    breakdown: [
      "Catches unhandled errors thrown inside billing/page.tsx.",
      "Restricts the failure strictly to the billing view; header and sidebar remain fully interactive.",
      "Exposes reset() function which prompts Next.js to re-render the Server Component tree.",
      "Safely captures and displays error digest reference for production triage."
    ],
    expectedOutput: "Catches billing fetch crash; displays isolated error UI with interactive Retry button."
  },

  {
    id: "next-ex-05",
    title: "Instant Skeleton Loading UI with `loading.tsx`",
    category: "Routing Conventions",
    difficulty: "beginner",
    whatThisCodeCovers: "An instant loading skeleton component colocated in loading.tsx that automatically streams to the browser while the route's async Server Component resolves.",
    conceptsCovered: ["loading.tsx", "Suspense Boundary", "Skeleton UI", "Streaming SSR", "Instant Feedback"],
    code: `// app/analytics/loading.tsx
export default function AnalyticsLoadingSkeleton() {
  return (
    <div className="p-8 space-y-6 animate-pulse">
      {/* Page Header Skeleton */}
      <div className="h-8 bg-slate-200 rounded w-1/3"></div>
      
      {/* 4 Metric Card Skeletons */}
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-slate-200 rounded-lg"></div>
        ))}
      </div>

      {/* Large Chart Skeleton */}
      <div className="h-96 bg-slate-200 rounded-lg"></div>
    </div>
  );
}

// app/analytics/page.tsx:
// While fetchSlowMetrics() awaits on server, loading.tsx displays instantly!
export default async function AnalyticsPage() {
  const metrics = await fetchSlowMetrics(); // takes 750ms
  return <AnalyticsDashboard metrics={metrics} />;
}`,
    breakdown: [
      "Next.js automatically wraps analytics/page.tsx in a Suspense boundary with this fallback.",
      "The skeleton streams to the client in < 25ms.",
      "Prevents layout shift by pre-allocating the exact dimensions of cards and charts.",
      "Replaced seamlessly by the real page when the async data finishes resolving."
    ],
    expectedOutput: "Displays pulse animation skeleton instantly on navigation until data finishes loading."
  },

  {
    id: "next-ex-06",
    title: "Dynamic Segment `[id]` with Async Params in Next.js 15",
    category: "Routing Conventions",
    difficulty: "intermediate",
    whatThisCodeCovers: "A dynamic route page component implementing Next.js 15's asynchronous params Promise pattern, with static pre-generation via generateStaticParams.",
    conceptsCovered: ["Dynamic Routes", "Next.js 15", "Async Params", "generateStaticParams", "notFound()"],
    code: `// app/posts/[postId]/page.tsx
import { db } from "@/lib/db";
import { notFound } from "next/navigation";

// Next.js 15: params is a Promise!
interface PageProps {
  params: Promise<{ postId: string }>;
}

export async function generateStaticParams() {
  // Pre-render the first 20 posts at build time (SSG)
  const posts = await db.post.findMany({ select: { id: true }, take: 20 });
  return posts.map(post => ({ postId: post.id }));
}

export default async function PostDetailPage({ params }: PageProps) {
  // MUST await params in Next.js 15!
  const { postId } = await params;

  const post = await db.post.findUnique({ where: { id: postId } });

  // If record does not exist in DB, trigger not-found.tsx UI
  if (!post) {
    notFound();
  }

  return (
    <article className="max-w-2xl mx-auto py-8">
      <h1 className="text-3xl font-extrabold">{post.title}</h1>
      <p className="mt-4 text-slate-700 leading-relaxed">{post.content}</p>
    </article>
  );
}`,
    breakdown: [
      "Adheres to Next.js 15 specification by awaiting params promise.",
      "Implements generateStaticParams() for high-speed SSG build compilation.",
      "Invokes notFound() to safely trigger 404 handler when database query returns null.",
      "Combines static speed with dynamic database lookup fallback."
    ],
    expectedOutput: "Renders post detail for /posts/123; triggers 404 if post does not exist."
  },

  {
    id: "next-ex-07",
    title: "Catch-All Documentation Route `[...slug]`",
    category: "Routing Conventions",
    difficulty: "intermediate",
    whatThisCodeCovers: "A multi-level documentation route using catch-all segments [...slug] to dynamically resolve arbitrarily deep nested markdown articles.",
    conceptsCovered: ["Catch-All", "[...slug]", "Nested Docs", "Breadcrumbs", "Dynamic Segments"],
    code: `// app/docs/[...slug]/page.tsx
import { notFound } from "next/navigation";

interface DocsPageProps {
  params: Promise<{ slug: string[] }>;
}

export default async function DocsPage({ params }: DocsPageProps) {
  const { slug } = await params;

  // e.g. /docs/auth/jwt/refresh -> slug = ['auth', 'jwt', 'refresh']
  const docPath = slug.join("/");
  const docContent = await fetchDocFromCms(docPath);

  if (!docContent) {
    notFound();
  }

  return (
    <div className="p-8">
      {/* Dynamic Breadcrumbs */}
      <nav className="text-sm text-slate-400 mb-4">
        Docs &gt; {slug.map((s, idx) => (
          <span key={idx} className="capitalize">{s} {idx < slug.length - 1 && "&gt; "}</span>
        ))}
      </nav>
      <h1 className="text-3xl font-bold capitalize">{slug[slug.length - 1]}</h1>
      <div className="prose mt-6">{docContent.body}</div>
    </div>
  );
}

async function fetchDocFromCms(path: string) {
  // Simulating CMS lookup
  return { body: \`Documentation article content for: \${path}\` };
}`,
    breakdown: [
      "Matches /docs/a, /docs/a/b, /docs/a/b/c dynamically.",
      "Receives slug as an array of string path segments.",
      "Generates dynamic breadcrumbs directly from the URL hierarchy.",
      "Fetches article content dynamically based on the full nested path."
    ],
    expectedOutput: "Resolves nested documentation paths into hierarchical article views with breadcrumbs."
  },

  {
    id: "next-ex-08",
    title: "Optional Catch-All E-Commerce Route `[[...slug]]`",
    category: "Routing Conventions",
    difficulty: "intermediate",
    whatThisCodeCovers: "An optional catch-all route [[...slug]] handling both the root store landing page (/store) and all sub-category levels (/store/shoes/running) in a single page.",
    conceptsCovered: ["Optional Catch-All", "[[...slug]]", "Catalog Index", "Route Unification", "E-Commerce"],
    code: `// app/store/[[...slug]]/page.tsx
interface StorePageProps {
  params: Promise<{ slug?: string[] }>;
}

export default async function StorePage({ params }: StorePageProps) {
  const { slug } = await params;

  // 1. Root case: /store (slug is undefined)
  if (!slug || slug.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">Store Home: All Categories</h1>
        <p>Select a department below to begin shopping.</p>
      </div>
    );
  }

  // 2. Department case: /store/electronics (slug = ['electronics'])
  // 3. Subcategory case: /store/electronics/phones (slug = ['electronics', 'phones'])
  const department = slug[0];
  const subCategory = slug[1];

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold capitalize">Department: {department}</h1>
      {subCategory && <h2 className="text-lg text-slate-600 capitalize">Subcategory: {subCategory}</h2>}
    </div>
  );
}`,
    breakdown: [
      "Uses double brackets [[...slug]] to make the parameter optional.",
      "Matches both /store and all nested /store/a/b/c routes without duplicate page files.",
      "Gracefully handles the undefined root case.",
      "Simplifies CMS and catalog architecture."
    ],
    expectedOutput: "/store renders main catalog; /store/men/shoes renders filtered department view."
  },

  {
    id: "next-ex-09",
    title: "Route Groups Layout Partitioning: `(marketing)` vs `(app)`",
    category: "Routing Conventions",
    difficulty: "intermediate",
    whatThisCodeCovers: "Organizing an enterprise Next.js codebase into two distinct route groups with separate root layouts: a public marketing shell and a secure app dashboard.",
    conceptsCovered: ["Route Groups", "Parentheses Folders", "Layout Partitioning", "Multiple Root Layouts", "Architecture"],
    code: `// Project Directory:
// app/
//   ├── (marketing)/
//   │     ├── layout.tsx  <-- Marketing Layout: Light theme, public navbar, footer
//   │     ├── page.tsx    <-- URL: /
//   │     └── about/page.tsx <-- URL: /about
//   └── (app)/
//         ├── layout.tsx  <-- App Layout: Dark theme, auth guard, collapsed sidebar
//         └── dashboard/page.tsx <-- URL: /dashboard

// app/(marketing)/layout.tsx:
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <nav className="p-4 border-b flex justify-between">
        <span className="font-bold">Public Brand</span>
        <a href="/dashboard" className="text-blue-600">Login</a>
      </nav>
      <main className="flex-1">{children}</main>
      <footer className="p-4 border-t text-center text-sm">© 2026 Acme Corp</footer>
    </div>
  );
}

// app/(app)/layout.tsx:
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex bg-slate-900 text-white">
      <aside className="w-64 border-r border-slate-800 p-4">App Navigation</aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}`,
    breakdown: [
      "Eliminates layout contamination between marketing pages and private application views.",
      "Route groups omit parentheses from the URL: /about and /dashboard remain clean.",
      "Allows independent providers, styling, and navigation bars per domain area.",
      "Maintains clean code separation across team boundaries."
    ],
    expectedOutput: "/ renders public marketing shell; /dashboard renders private dark-themed app layout."
  },

  {
    id: "next-ex-10",
    title: "Async SearchParams Filtering & Pagination in Next.js 15",
    category: "Routing Conventions",
    difficulty: "intermediate",
    whatThisCodeCovers: "A search and pagination catalog page consuming asynchronous searchParams in Next.js 15, executing database queries with page limits and offsets.",
    conceptsCovered: ["searchParams", "Pagination", "Next.js 15", "Query Strings", "Dynamic Rendering"],
    code: `// app/catalog/page.tsx
import { db } from "@/lib/db";
import Link from "next/link";

interface CatalogPageProps {
  searchParams: Promise<{
    q?: string;
    page?: string;
  }>;
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  // MUST await searchParams in Next.js 15!
  const { q = "", page = "1" } = await searchParams;

  const currentPage = Math.max(1, parseInt(page, 10));
  const pageSize = 8;
  const skip = (currentPage - 1) * pageSize;

  // Execute database query with search filter and pagination
  const [items, totalCount] = await Promise.all([
    db.item.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined,
      take: pageSize,
      skip,
      orderBy: { createdAt: "desc" }
    }),
    db.item.count({
      where: q ? { name: { contains: q, mode: "insensitive" } } : undefined
    })
  ]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Catalog Search {q && \`for "\${q}"\`}</h1>
      <div className="grid grid-cols-4 gap-4">
        {items.map(item => (
          <div key={item.id} className="p-4 border rounded">{item.name}</div>
        ))}
      </div>

      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-8">
        <Link
          href={\`/catalog?q=\${q}&page=\${currentPage - 1}\`}
          className={\`btn \${currentPage <= 1 ? "pointer-events-none opacity-50" : ""}\`}
        >
          Previous
        </Link>
        <span>Page {currentPage} of {totalPages}</span>
        <Link
          href={\`/catalog?q=\${q}&page=\${currentPage + 1}\`}
          className={\`btn \${currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}\`}
        >
          Next
        </Link>
      </div>
    </div>
  );
}`,
    breakdown: [
      "Awaits searchParams promise per Next.js 15 breaking change specification.",
      "Safely parses page and query string parameters with default fallbacks.",
      "Performs parallel database queries for paginated items and total counts.",
      "Builds shareable, bookmarkable pagination URLs without client state."
    ],
    expectedOutput: "/catalog?q=laptop&page=2 queries database with skip=8 and renders page 2 of search results."
  }
];

module.exports = { recipes };
