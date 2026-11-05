const { card } = require("../next_builder_helper.cjs");

const cards = [
  card(
    1,
    "React Server Components (RSC) vs Client Components",
    "App Router & RSC",
    "Mastery",
    "React Server Components (RSC) run exclusively on the server, producing zero client-side JavaScript bundle footprint. Client Components render on the server into initial HTML and hydrate on the browser with interactive JavaScript. In Next.js App Router, all components inside the `app` directory are Server Components by default.",
    `// Server Component (Default in App Router):
// Runs strictly on the server; zero JS sent to client bundle!
import { db } from "@/lib/db";

export default async function ProductCatalog() {
  // Direct async database query without client API layer!
  const products = await db.product.findMany({ where: { inStock: true } });

  return (
    <section className="grid grid-cols-3 gap-4">
      {products.map(p => (
        <article key={p.id} className="p-4 border rounded">
          <h2>{p.name}</h2>
          <p>\${p.price}</p>
        </article>
      ))}
    </section>
  );
}

// Client Component (Opt-in via "use client"):
// Hydrates in browser; adds to client JS bundle
"use client";

import { useState } from "react";

export function Counter() {
  const [count, setCount] = useState(0);
  return (
    <button onClick={() => setCount(count + 1)}>
      Clicked {count} times
    </button>
  );
}`,
    ["RSC", "Client Components", "App Router", "Hydration", "Zero-Bundle-Size"],
    [
      { title: "Next.js Docs: Server and Client Components", url: "https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns" }
    ],
    "Why are components inside the Next.js `app` directory Server Components by default?",
    "Defaulting to Server Components eliminates unnecessary JavaScript shipped to browsers, enforces data fetching close to the backend database/microservices, keeps sensitive API keys and secrets off client devices, and dramatically improves Core Web Vitals (INP, LCP, TBT).",
    "What operations are strictly forbidden inside a React Server Component?",
    "Browser-only APIs (`window`, `localStorage`, `document`), React state hooks (`useState`, `useReducer`), component lifecycle hooks (`useEffect`, `useLayoutEffect`), and custom hooks relying on browser state or context."
  ),

  card(
    2,
    "The 'use client' Boundary Directive & Serialization",
    "App Router & RSC",
    "Mastery",
    "The `'use client'` directive does not mark a file as exclusively browser-rendered; rather, it defines the cut-off boundary where code enters the client bundle and hydrates. All props passed across the server-to-client boundary must be serializable.",
    `// The Boundary Rule:
// Server Component (Parent) === [ "use client" Boundary ] ===> Client Component (Child)

// components/InteractiveCard.tsx
"use client"; // Marks boundary entry point

import { useState } from "react";

interface CardProps {
  id: string;
  title: string;
  initialLikes: number;
  // FORBIDDEN: Functions, Symbols, Class instances cannot be passed as props across boundary!
  // onServerDelete: () => void; // Non-serializable!
}

export function InteractiveCard({ id, title, initialLikes }: CardProps) {
  const [likes, setLikes] = useState(initialLikes);

  return (
    <div className="card">
      <h3>{title}</h3>
      <button onClick={() => setLikes(l => l + 1)}>Like ({likes})</button>
    </div>
  );
}

// app/page.tsx (Server Component)
import { InteractiveCard } from "@/components/InteractiveCard";

export default async function Page() {
  const item = { id: "101", title: "Next.js 15 Guide", likes: 42 };

  // Props passed to InteractiveCard MUST be serializable (JSON-like / Date / TypedArrays)
  return <InteractiveCard id={item.id} title={item.title} initialLikes={item.likes} />;
}`,
    ["use client", "Serialization Boundary", "Client Boundary", "Hydration", "Props"],
    [
      { title: "Next.js Docs: The 'use client' Directive", url: "https://nextjs.org/docs/app/building-your-application/rendering/client-components" }
    ],
    "Does placing `'use client'` at the top of a file prevent it from rendering on the server during the initial page load?",
    "No. Client Components are prerendered into static HTML on the server during initial page load or build time. The `'use client'` directive simply instructs Next.js to package the component and its imports into the client JavaScript bundle for browser hydration.",
    "What happens if you pass an un-serializable prop (such as a custom JavaScript class instance or an arbitrary function) across the server-client boundary?",
    "Next.js throws a runtime serialization error: 'Functions cannot be passed directly to Client Components unless you explicitly use a Server Action'. React Flight protocol requires all props across boundaries to be serializable."
  ),

  card(
    3,
    "The 'use server' Directive & Server Actions Primitive",
    "App Router & RSC",
    "Mastery",
    "The `'use server'` directive marks asynchronous functions as callable Server Actions. It can be placed at the top of a standalone file or at the top of an async function body inside a Server Component, exposing a secure POST endpoint callable from forms or client events.",
    `// 1. Module-level Server Action file: app/actions/cart.ts
"use server"; // All exports in this file become callable RPC Server Actions

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function addToCartAction(formData: FormData) {
  const productId = formData.get("productId") as string;
  const quantity = parseInt(formData.get("quantity") as string, 10);

  // Executes securely on Node.js / Edge server!
  await db.cartItem.create({ data: { productId, quantity } });

  // Revalidates client cache on completion
  revalidatePath("/cart");
}

// 2. Client Component invoking the Server Action:
"use client";

import { addToCartAction } from "@/app/actions/cart";

export function AddToCartButton({ productId }: { productId: string }) {
  return (
    <form action={addToCartAction}>
      <input type="hidden" name="productId" value={productId} />
      <input type="number" name="quantity" defaultValue={1} min={1} />
      <button type="submit">Add to Cart</button>
    </form>
  );
}`,
    ["use server", "Server Actions", "Progressive Enhancement", "RPC", "revalidatePath"],
    [
      { title: "Next.js Docs: Server Actions and Mutations", url: "https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations" }
    ],
    "Does `'use server'` mark a component as a React Server Component?",
    "No! This is the most common misconception. `'use server'` designates server-callable endpoints (Server Actions). React Server Components are the default and require no directive. Adding `'use server'` at the top of a component file will throw an error or treat the component as an action.",
    "How does progressive enhancement work when a Server Action is passed to a `<form action={...}>`?",
    "If JavaScript has not finished downloading or is disabled in the browser, the browser submits a native HTTP POST request to the Server Action endpoint, allowing mutations to succeed without active client-side JavaScript."
  ),

  card(
    4,
    "App Router vs Pages Router Architecture & Mental Models",
    "App Router & RSC",
    "Mastery",
    "The App Router (`app/`) is built on React 18/19 Server Components, streaming Suspense, and nested layouts. The Pages Router (`pages/`) relies on page-level data fetching (`getServerSideProps`, `getStaticProps`) and renders client-side React component trees with client bundle overhead.",
    `// Mental Model Comparison:
// 1. Pages Router:
// - Route = pages/dashboard.tsx
// - Data Fetching = export async function getServerSideProps() { ... }
// - Render = Monolithic client component tree; all imported code lands in client bundle.
// - Layouts = Manual wrapper patterns (_app.tsx with getLayout).

// 2. App Router:
// - Route = app/dashboard/page.tsx
// - Data Fetching = Direct async/await inside Server Component (no special wrapper).
// - Render = Multi-tier Server Component streaming tree; only interactive leaves hydrate.
// - Layouts = First-class nested app/dashboard/layout.tsx with automatic state preservation.

// App Router Nested Layout Architecture:
// app/layout.tsx (Root HTML & Body shell)
//   └── app/dashboard/layout.tsx (Dashboard Sidebar & Nav - Preserves state during nav!)
//         └── app/dashboard/analytics/page.tsx (Active View - Swapped dynamically)`,
    ["App Router", "Pages Router", "getServerSideProps", "Nested Layouts", "Architecture"],
    [
      { title: "Next.js Docs: App Router Migration Guide", url: "https://nextjs.org/docs/app/building-your-application/upgrading/app-router-migration" }
    ],
    "Why does the App Router achieve significantly higher performance than the Pages Router on large web applications?",
    "In the Pages Router, every component imported on a page contributes to the client bundle. In the App Router, 80-90% of components are Server Components that execute once on the server and emit only lightweight HTML/RSC payloads, drastically shrinking client JavaScript download and parsing times.",
    "Can the App Router and Pages Router coexist in the same Next.js codebase?",
    "Yes. Next.js supports hybrid migration: you can maintain legacy routes in `pages/` while building new routes in `app/`. If a path collision occurs, the App Router takes precedence over the Pages Router."
  ),

  card(
    5,
    "Component Tree Serialization & The React Flight Protocol",
    "App Router & RSC",
    "Deep Dive",
    "The React Flight Protocol is the wire format used by Next.js to stream Server Component trees to the client. Instead of raw HTML alone, it streams a special JSON-like chunked format containing rendered DOM nodes, slot references, and client bundle chunk hashes.",
    `// The Flight Protocol Wire Stream Representation:
// When navigating client-side, Next.js requests the RSC payload:
// GET /dashboard?_rsc=19a2b

// Stream Chunks emitted by Server:
/*
M1:{"id":"./components/Chart.tsx","chunks":["app/chart:12"],"name":"default"}
S2:{"name":"Dashboard","id":"dash_1"}
J0:["$","div",null,{"className":"p-4","children":[
  ["$","h1",null,{"children":"Analytics"}],
  ["$","$L1",null,{"data":"$@2"}]
]}]
*/

// Interpretation:
// - M1: Declares a Client Component reference (Chart.tsx) and its JS bundle bundle hash.
// - S2: Serialized server data payload.
// - J0: Virtual DOM description pointing to HTML tags ($div, $h1) and slotting Client Component ($L1).

// Browser Reconciliation:
// The browser React runtime parses the Flight stream in real-time, inserting Server Component DOM
// and instantiating Client Components without re-fetching or reloading the page!`,
    ["React Flight", "RSC Payload", "Serialization", "Streaming Wire Protocol", "Virtual DOM"],
    [
      { title: "RFC: React Server Components Protocol", url: "https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md" }
    ],
    "Why does Next.js stream React Flight data rather than plain HTML during client-side navigations (`<Link>`)?",
    "Streaming the Flight protocol preserves existing client component state (e.g., search input values, scroll positions, open drawers) while swapping Server Component parts, eliminating jarring full-page refreshes and enabling seamless client transitions.",
    "Can React Flight data be inspected in standard browser DevTools?",
    "Yes. In DevTools Network tab, inspect requests containing the `?_rsc=` query parameter or `RSC: 1` header to examine the raw Flight protocol chunks streamed from the server."
  ),

  card(
    6,
    "Server-Only Code & the 'server-only' Package Poisoning Defense",
    "Security",
    "Mastery",
    "Sensitive server logic (database clients, encryption secrets, internal APIs) must never accidentally leak into client bundles. The `server-only` package turns accidental client imports of server modules into immediate build-time compilation errors.",
    `// Installing defense package:
// npm install server-only

// lib/database.ts:
import "server-only"; // Guarantees this file can NEVER be imported by a Client Component!
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();

export async function fetchUserPrivateData(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, stripeCustomerId: true }
  });
}

// IF a developer accidentally imports lib/database.ts inside a "use client" file:
// components/UserProfileWidget.tsx
// "use client";
// import { fetchUserPrivateData } from "@/lib/database"; // BUILD ERROR!

// Next.js Webpack/Turbopack Build Output:
// Failed to compile:
// You're importing a component that needs "server-only".
// That only works in a Server Component but one of its parents is marked with "use client".`,
    ["server-only", "Security", "Secret Leakage", "Build-Time Defense", "Client Bundle Poisoning"],
    [
      { title: "Next.js Docs: Keeping Server-only Code out of the Client", url: "https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#keeping-server-only-code-out-of-the-client-environment" }
    ],
    "Why are environment variables without `NEXT_PUBLIC_` not always enough to prevent secret leakage?",
    "While Next.js replaces private environment variables with `undefined` in client code, the underlying logic, database query structures, proprietary algorithms, and internal URLs would still be compiled into the public client bundle unless guarded by `server-only`.",
    "What companion package exists for client-only utilities?",
    "The `client-only` package. Importing `client-only` in a utility relying on browser APIs (`window`, `navigator`) guarantees a build error if a Server Component accidentally imports it."
  ),

  card(
    7,
    "Zero-Bundle-Size Libraries in Server Components",
    "Performance",
    "Mastery",
    "Because React Server Components execute exclusively on the server, massive dependencies (e.g. Markdown parsers, date formatting libraries like moment/date-fns, syntax highlighters) contribute 0 bytes to the client JavaScript bundle.",
    `// Server Component rendering Markdown and Syntax Highlighting:
// app/blog/[slug]/page.tsx
import { marked } from "marked";       // 35 KB library
import sanitizeHtml from "sanitize-html"; // 140 KB library
import hljs from "highlight.js";      // 800 KB library
import { db } from "@/lib/db";

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = await db.post.findUnique({ where: { slug } });

  // Parsing & sanitization happen strictly on the server!
  const rawHtml = marked.parse(post.content);
  const cleanHtml = sanitizeHtml(rawHtml);

  return (
    <article className="prose">
      <h1>{post.title}</h1>
      {/* Client browser downloads ZERO KB of marked, sanitize-html, or highlight.js! */}
      <div dangerouslySetInnerHTML={{ __html: cleanHtml }} />
    </article>
  );
}`,
    ["Zero-Bundle-Size", "Dependencies", "Performance", "marked", "Core Web Vitals"],
    [
      { title: "React RFC: Server Components", url: "https://github.com/reactjs/rfcs/blob/main/text/0188-server-components.md" }
    ],
    "How does the zero-bundle-size characteristic of Server Components fundamentally change package selection in Next.js?",
    "In traditional SPAs, developers avoid feature-rich libraries (like `moment.js` or full AST parsers) to prevent client bundle bloat. In Server Components, developers can choose libraries based purely on functionality, ergonomics, and reliability without bundle weight penalty.",
    "What happens if a Client Component imports a library used by a Server Component?",
    "If a Client Component imports that library, the library is bundled into the client JavaScript bundle. To maintain zero-bundle-size, ensure the library is imported exclusively inside Server Components."
  ),

  card(
    8,
    "Asynchronous Server Components & Direct Database Access",
    "App Router & RSC",
    "Mastery",
    "React Server Components can be declared as native async functions. Developers can directly `await` database queries (Prisma, Drizzle, pg), internal microservice RPCs, or file system reads without intermediary REST API routes or `useEffect` hooks.",
    `// app/dashboard/page.tsx (Async Server Component)
import { db } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  // 1. Session verification directly on server
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // 2. Parallel direct database queries using Promise.all
  const [metrics, recentOrders] = await Promise.all([
    db.metric.findMany({ where: { orgId: session.user.orgId } }),
    db.order.findMany({
      where: { orgId: session.user.orgId },
      take: 5,
      orderBy: { createdAt: "desc" }
    })
  ]);

  return (
    <main className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Welcome back, {session.user.name}</h1>
      <div className="grid grid-cols-4 gap-4">
        {metrics.map(m => (
          <div key={m.id} className="p-4 bg-slate-100 rounded">
            <span className="text-sm text-slate-500">{m.label}</span>
            <p className="text-xl font-bold">{m.value}</p>
          </div>
        ))}
      </div>
    </main>
  );
}`,
    ["Async Server Components", "Direct Database Access", "Promise.all", "Drizzle", "Prisma"],
    [
      { title: "Next.js Docs: Fetching Data on the Server", url: "https://nextjs.org/docs/app/building-your-application/data-fetching/fetching" }
    ],
    "Why does direct database querying in Server Components eliminate API endpoint bloat?",
    "In traditional React SPAs, every screen requires authoring dedicated `/api/v1/user-data` endpoints simply to shuttle data between the database and the frontend. Server Components execute on the server and query the database directly, eliminating boilerplate CRUD endpoints.",
    "How does executing multiple `await` statements sequentially inside a Server Component degrade performance, and how is it fixed?",
    "Sequential `await` calls create a server-side request waterfall (e.g. 100ms + 150ms + 200ms = 450ms). It is fixed by wrapping independent queries in `Promise.all([queryA(), queryB()])` to execute them in parallel."
  ),

  card(
    9,
    "Client Component Interactivity: When to use 'use client'",
    "App Router & RSC",
    "Core",
    "Only components that require browser events, client state, or browser APIs need `'use client'`. Best practice dictates pushing the client boundary down to the leaves of the component tree to maximize server-rendered performance.",
    `// ANTI-PATTERN: Marking entire Page as "use client" (Loses RSC benefits!)
// "use client";
// export default function Page() { return <BigPageWithEverything />; }

// CORRECT PATTERN: Push "use client" down to the interactive leaf
// app/products/[id]/page.tsx (Server Component)
import { db } from "@/lib/db";
import { LikeButton } from "@/components/LikeButton"; // Client leaf

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await db.product.findUnique({ where: { id } });

  return (
    <div className="p-6">
      {/* Server Component renders static text and layout */}
      <h1 className="text-2xl font-bold">{product.name}</h1>
      <p className="text-gray-700">{product.description}</p>
      
      {/* Interactive leaf component handles click events */}
      <LikeButton productId={product.id} initialLikes={product.likes} />
    </div>
  );
}

// components/LikeButton.tsx (Client Component Leaf)
"use client";

import { useState } from "react";

export function LikeButton({ productId, initialLikes }: { productId: string; initialLikes: number }) {
  const [likes, setLikes] = useState(initialLikes);

  return (
    <button onClick={() => setLikes(l => l + 1)} className="btn-primary">
      ♥ Like ({likes})
    </button>
  );
}`,
    ["use client", "Component Architecture", "Interactive Leaves", "Hydration", "Best Practices"],
    [
      { title: "Next.js Docs: Moving Client Components to the Leaves", url: "https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#moving-client-components-to-the-leaves" }
    ],
    "What are the concrete criteria that mandate adding `'use client'` to a component?",
    "Use `'use client'` if and only if the component: 1) uses event listeners (`onClick`, `onChange`), 2) uses React state or lifecycle hooks (`useState`, `useEffect`), 3) uses custom hooks that depend on state/context, or 4) uses browser-only APIs (`window`, `localStorage`, `geolocation`).",
    "What happens when you import a Server Component into a file marked with `'use client'`?",
    "It is automatically converted and compiled as a Client Component! To preserve Server Component execution, pass the Server Component as a `children` prop into the Client Component instead of importing it directly."
  ),

  card(
    10,
    "Nested Component Rendering Order & Streaming SSR",
    "App Router & RSC",
    "Deep Dive",
    "Next.js streams rendered components from the server using React Suspense. Outer layouts and static shells stream to the client instantly, while slow data-fetching components stream progressively into Suspense fallback placeholders.",
    `// app/dashboard/page.tsx
import { Suspense } from "react";
import { MetricOverview } from "@/components/MetricOverview";
import { SlowAnalyticsFeed } from "@/components/SlowAnalyticsFeed";
import { SkeletonLoader } from "@/components/SkeletonLoader";

export default function Dashboard() {
  return (
    <div className="dashboard-layout">
      {/* 1. Fast static shell streams to browser in 15ms */}
      <header>
        <h1>Operational Dashboard</h1>
      </header>

      {/* 2. Fast metrics component renders and streams */}
      <MetricOverview />

      {/* 3. Slow analytics component wrapped in Suspense */}
      <Suspense fallback={<SkeletonLoader count={3} />}>
        {/* Streams into DOM dynamically when async DB query resolves after 800ms! */}
        <SlowAnalyticsFeed />
      </Suspense>
    </div>
  );
}

// Slow Component:
async function SlowAnalyticsFeed() {
  // Simulating complex analytical aggregation
  const data = await fetchSlowAggregates();
  return <div className="analytics-view">{/* Render data */}</div>;
}`,
    ["Streaming SSR", "React Suspense", "Skeleton Loader", "Progressive Rendering", "TTFB"],
    [
      { title: "Next.js Docs: Loading UI and Streaming", url: "https://nextjs.org/docs/app/building-your-application/routing/loading-ui-and-streaming" }
    ],
    "How does Streaming SSR improve Time to First Byte (TTFB) and First Contentful Paint (FCP)?",
    "Without streaming, the server blocks until the slowest database query resolves before sending any HTML bytes. With Streaming SSR, the server immediately flushes the `<head>` and outer layout shell HTML in under 20ms, allowing browsers to render layout and download stylesheets while slow data streams.",
    "What HTTP transfer mechanism powers Streaming SSR in Next.js?",
    "HTTP `Transfer-Encoding: chunked`. The server holds the HTTP connection open and transmits discrete HTML `<template>` and `<script>` replacement tags as asynchronous Suspense boundaries resolve."
  ),

  card(
    11,
    "Third-Party Context Providers in the App Router",
    "App Router & RSC",
    "Mastery",
    "React Context (`createContext`) is not supported in React Server Components because it relies on React state and lifecycle. Third-party providers (Theme, Auth, Redux, React Query) must be wrapped in dedicated Client Components at the root layout.",
    `// ANTI-PATTERN: Exporting or using createContext in a Server Component!
// app/layout.tsx (Server Component)
// const ThemeContext = createContext(); // ERROR!

// CORRECT PATTERN: Create a dedicated Client Component Provider wrapper
// components/ThemeProvider.tsx
"use client";

import { createContext, useContext, useState } from "react";

const ThemeContext = createContext<{ theme: string; toggleTheme: () => void } | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState("dark");
  const toggleTheme = () => setTheme(t => (t === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={theme}>{children}</div>
    </ThemeContext.Provider>
  );
}

// app/layout.tsx (Server Component Root Layout)
import { ThemeProvider } from "@/components/ThemeProvider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Client Provider wraps children without converting children into Client Components! */}
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}`,
    ["Context Providers", "React Context", "ThemeProvider", "Root Layout", "useContext"],
    [
      { title: "Next.js Docs: Rendering Third-Party Context Providers", url: "https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#using-context-providers" }
    ],
    "Does wrapping `{children}` inside a Client Component Provider convert all nested children into Client Components?",
    "No! This is a core architectural rule: when a Server Component is passed as `children` into a Client Component, it is rendered on the server first and passed as a pre-rendered React element slot. The children remain Server Components.",
    "Why can't Server Components consume React Context via `useContext`?",
    "React Context is designed for dynamic state propagation and re-rendering across a client tree. Server Components render once on the server and have no state, lifecycle, or re-render subscriptions."
  ),

  card(
    12,
    "Passing Server Components as Children/Slots to Client Components",
    "App Router & RSC",
    "Mastery",
    "To combine client interactivity (collapsible sidebars, carousels, modal overlays) with server data fetching, author the interactive container as a Client Component and pass the Server Component into it via the `children` or explicit JSX slot props.",
    `// 1. Client Component Container: components/CollapsibleSection.tsx
"use client";

import { useState } from "react";

export function CollapsibleSection({
  title,
  children // Server Component rendered output passed as children!
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <section className="border rounded p-4">
      <button onClick={() => setIsOpen(!isOpen)} className="font-bold flex justify-between w-full">
        <span>{title}</span>
        <span>{isOpen ? "▲" : "▼"}</span>
      </button>
      {isOpen && <div className="mt-4">{children}</div>}
    </section>
  );
}

// 2. Server Component Page: app/dashboard/page.tsx
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { HeavyServerDataFeed } from "@/components/HeavyServerDataFeed"; // Server Component!

export default function DashboardPage() {
  return (
    <main>
      <h1>Executive Summary</h1>
      {/* HeavyServerDataFeed executes on server; its rendered slots pass into Client wrapper */}
      <CollapsibleSection title="Real-time Server Logs">
        <HeavyServerDataFeed />
      </CollapsibleSection>
    </main>
  );
}`,
    ["Slots Pattern", "Composition", "Children Prop", "Server-Client Interop", "Performance"],
    [
      { title: "Next.js Docs: Passing Server Components to Client Components as Props", url: "https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#passing-server-components-to-client-components-as-props" }
    ],
    "Why does passing a Server Component as `children` avoid client bundle bloat?",
    "The Server Component executes on the server and resolves to Flight/DOM nodes. The client bundle only receives the light JSX reference and never downloads the Server Component's code, imports, or dependencies.",
    "Can you pass multiple distinct Server Component slots into a Client Component?",
    "Yes. You can pass them as arbitrary named props (e.g. `<Modal header={<ServerHeader />} body={<ServerBody />} footer={<ServerFooter />} />`)."
  )
];

module.exports = { cards };
