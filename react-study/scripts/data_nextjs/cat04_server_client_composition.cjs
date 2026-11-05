const { card } = require("../next_builder_helper.cjs");

const cards = [
  card(
    37,
    "The Server-Client Composition Tree & Boundaries",
    "Server & Client Composition",
    "Mastery",
    "A Next.js application tree is not strictly partitioned into server OR client. It is an interleaved tree where Server Components form the foundational skeleton and Client Components form interactive leaves. Server Components can render Client Components, and Client Components can accept Server Components as children.",
    `// Interleaved Component Tree Hierarchy:
// [Server Component: app/layout.tsx]
//   └── [Client Component: ThemeProvider]
//         └── [Server Component: app/dashboard/page.tsx]
//               ├── [Server Component: MetricSummary]
//               └── [Client Component: InteractiveChart]
//                     └── [Server Component: ChartTooltip (passed as child slot!)]

// Rule of Thumb:
// Keep data fetching and heavy computational dependencies on the Server.
// Push interactive state (useState, event listeners) down to the smallest possible leaf Client Components.`,
    ["Composition Tree", "Interleaved Architecture", "Client Boundaries", "RSC Hierarchy", "Mental Model"],
    [
      { title: "Next.js Docs: Server and Client Composition Patterns", url: "https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns" }
    ],
    "Can a Client Component import a Server Component directly via an `import` statement?",
    "No. If a file marked with `'use client'` imports a Server Component directly, Next.js treats the imported component as a Client Component, executing it on the client and forcing its dependencies into the client JavaScript bundle. To preserve Server Component behavior, pass it as a `children` prop.",
    "What is the performance consequence of marking a top-level layout as `'use client'`?",
    "It converts all components within that layout's direct sub-tree into Client Components by default (unless passed as children), causing a massive explosion in the client JavaScript bundle and destroying the zero-bundle-size advantages of RSC."
  ),

  card(
    38,
    "Passing Server Components as Props (Slots Pattern)",
    "Server & Client Composition",
    "Mastery",
    "The Slots pattern solves the conundrum of embedding server-fetched data inside an interactive client wrapper. By passing the Server Component into a prop (such as `children`, `sidebar`, or `header`), the Server Component runs on the server first, and its rendered React element is passed to the client wrapper.",
    `// 1. Client Wrapper Component: components/ClientTabs.tsx
"use client";

import { useState } from "react";

export function ClientTabs({
  tabOneContent, // Server Component rendered slot!
  tabTwoContent  // Server Component rendered slot!
}: {
  tabOneContent: React.ReactNode;
  tabTwoContent: React.ReactNode;
}) {
  const [activeTab, setActiveTab] = useState<"one" | "two">("one");

  return (
    <div>
      <div className="flex gap-4 border-b">
        <button onClick={() => setActiveTab("one")}>Tab 1</button>
        <button onClick={() => setActiveTab("two")}>Tab 2</button>
      </div>
      <div className="p-4">
        {activeTab === "one" ? tabOneContent : tabTwoContent}
      </div>
    </div>
  );
}

// 2. Server Component Parent: app/page.tsx
import { ClientTabs } from "@/components/ClientTabs";
import { ServerFeedA } from "@/components/ServerFeedA"; // Direct async DB queries!
import { ServerFeedB } from "@/components/ServerFeedB";

export default function Page() {
  return (
    <ClientTabs
      tabOneContent={<ServerFeedA />}
      tabTwoContent={<ServerFeedB />}
    />
  );
}`,
    ["Slots Pattern", "Children Prop", "Composition", "Client Wrapper", "Performance"],
    [
      { title: "Next.js Docs: Supported Patterns", url: "https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#supported-patterns" }
    ],
    "Do Server Components passed as slots into a Client Component re-execute when client state changes in the wrapper?",
    "No. The Server Component renders once on the server and generates a serialized React Flight virtual DOM element. Toggling client state in the wrapper merely shows or hides the already-rendered element without triggering new server fetches.",
    "Can you pass asynchronous Server Components directly as props?",
    "Yes. You instantiate them in JSX syntax (`<ServerFeedA />`), and React resolves the asynchronous promise on the server before passing the resulting element node."
  ),

  card(
    39,
    "The Client Bundle Poisoning Problem & Defense",
    "Server & Client Composition",
    "Mastery",
    "Client Bundle Poisoning occurs when server-only modules (database clients, API keys, file-system utilities) are imported into files downstream of a `'use client'` boundary. Next.js defends against this at build-time using the `server-only` sentinel package.",
    `// Dangerous Scenario (Client Poisoning):
// lib/payments.ts (Uses Stripe secret key)
// export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// If components/CheckoutForm.tsx ("use client") imports lib/payments.ts:
// The Stripe SDK and private key structure are compiled into the client bundle!

// The Poisoning Defense:
// lib/payments.ts:
import "server-only"; // Fails the build immediately if imported by client!
import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Next.js Build-Time Output:
// Error: You're importing a component that needs "server-only". That only works in a Server Component.`,
    ["Client Poisoning", "server-only", "Security Defense", "Stripe", "Build Error"],
    [
      { title: "Next.js Docs: server-only package", url: "https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#keeping-server-only-code-out-of-the-client-environment" }
    ],
    "How does the `server-only` package work under the hood in Next.js?",
    "It is an empty package with an `export-conditions` mapping in `package.json` that throws an error during module bundling if resolved under client environment conditions (like webpack `browser` or turbopack `client`).",
    "What should be done if a utility file contains both server functions and pure mathematical helper functions?",
    "Split the file into two separate modules: `math-utils.ts` (pure functions, safe for both server and client) and `server-utils.ts` (marked with `import 'server-only'` for server-specific logic)."
  ),

  card(
    40,
    "Context Providers in App Router: Root Placement & Boundary Rules",
    "Server & Client Composition",
    "Mastery",
    "React Context (`createContext`) cannot be created or consumed in Server Components. Global state providers (TanStack Query, Redux, Theme, NextAuth) must be defined in dedicated Client Component wrapper files and mounted in the Root Layout.",
    `// 1. Client Provider Definition: components/Providers.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function AppProviders({ children }: { children: React.ReactNode }) {
  // Ensure QueryClient is instantiated inside useState to avoid sharing cache across users!
  const [queryClient] = useState(() => new QueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

// 2. Root Layout: app/layout.tsx (Server Component)
import { AppProviders } from "@/components/Providers";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>
          {/* Children remain Server Components! */}
          {children}
        </AppProviders>
      </body>
    </html>
  );
}`,
    ["Context Providers", "TanStack Query", "Root Layout", "Global State", "Isolation"],
    [
      { title: "Next.js Docs: Using Context Providers", url: "https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#using-context-providers" }
    ],
    "Why must `new QueryClient()` be created inside `useState` or a ref in a Client Component Provider?",
    "If created in global module scope (`const client = new QueryClient()`), that single instance would be shared across multiple concurrent user requests on the server during SSR, leaking private user data and cache between unrelated users.",
    "Do Server Components wrapped by `<AppProviders>` have access to the React Query cache via `useQuery`?",
    "No. Server Components cannot use hooks. Server Components fetch data directly via native `async/await` and direct database/fetch calls on the server."
  ),

  card(
    41,
    "Avoiding Request Waterfalls in Server Component Trees",
    "Performance",
    "Mastery",
    "A request waterfall occurs when sequential `await` statements force each database query or API call to wait for the preceding one to finish. In Server Components, waterfalls are eliminated by parallel fetching via `Promise.all` or by splitting components into independent Suspense boundaries.",
    `// WATERFALL ANTI-PATTERN (Sequential blocking: 100ms + 150ms = 250ms TTFB):
// async function Page() {
//   const user = await fetchUser(); // blocks 100ms
//   const posts = await fetchPosts(); // blocks 150ms (Total: 250ms)
// }

// SOLUTION 1: Parallel Fetching with Promise.all (Total: 150ms TTFB)
export default async function FastPage() {
  const [user, posts] = await Promise.all([
    fetchUser(),
    fetchPosts()
  ]);

  return <Profile user={user} posts={posts} />;
}

// SOLUTION 2: Streaming with Suspense Boundaries (Instant Initial Shell!)
export function StreamingPage() {
  return (
    <div>
      {/* Both components execute in parallel and stream independently! */}
      <Suspense fallback={<UserSkeleton />}>
        <UserAsyncComponent />
      </Suspense>
      <Suspense fallback={<PostsSkeleton />}>
        <PostsAsyncComponent />
      </Suspense>
    </div>
  );
}`,
    ["Waterfalls", "Promise.all", "Suspense Boundaries", "Parallel Fetching", "TTFB Optimization"],
    [
      { title: "Next.js Docs: Parallel and Sequential Data Fetching", url: "https://nextjs.org/docs/app/building-your-application/data-fetching/patterns#parallel-and-sequential-data-fetching" }
    ],
    "What is the difference between parallel fetching with `Promise.all` and parallel fetching with Suspense boundaries?",
    "`Promise.all` executes in parallel but still blocks the server response until the slowest promise resolves. Suspense boundaries stream the layout immediately and progressively insert each resolved component into the browser DOM as soon as it completes, providing instant initial render.",
    "Can a child Server Component start fetching before its parent Server Component finishes awaiting?",
    "Only if the child is rendered as a standalone branch inside a Suspense boundary or if the parent initiates the promise without awaiting and passes the raw Promise down as a prop."
  ),

  card(
    42,
    "Data Fetching Colocation: Fetching Data Where It Is Used",
    "App Router & RSC",
    "Mastery",
    "In the Pages Router, data had to be fetched at the top-level page (`getServerSideProps`) and drilled down through multiple layers of props. In the App Router, data fetching should be colocated directly inside the specific Server Component that renders it.",
    `// Colocation Pattern in App Router:
// app/dashboard/page.tsx does NOT fetch everything!
// It simply composes components.

import { UserProfileBadge } from "@/components/UserProfileBadge";
import { RecentTransactionsList } from "@/components/RecentTransactionsList";

export default function DashboardPage() {
  return (
    <div className="dashboard-grid">
      {/* UserProfileBadge fetches its own user data directly */}
      <UserProfileBadge />

      {/* RecentTransactionsList fetches its own transactions directly */}
      <RecentTransactionsList />
    </div>
  );
}

// components/UserProfileBadge.tsx:
export async function UserProfileBadge() {
  // Direct fetch inside the component that needs it!
  const user = await db.user.getCurrentUser();
  return <div className="badge">{user.name}</div>;
}`,
    ["Colocation", "Prop Drilling", "Component Autonomy", "Clean Architecture", "RSC"],
    [
      { title: "Next.js Docs: Fetching Data where it's needed", url: "https://nextjs.org/docs/app/building-your-application/data-fetching/fetching#fetching-data-where-its-needed" }
    ],
    "Doesn't fetching data in multiple colocated components cause duplicate network requests if two components need the same user data?",
    "No! React and Next.js implement automatic Request Memoization. Identical `fetch()` requests with the same URL and options (or functions wrapped with `React.cache()`) share a single execution per request cycle, eliminating duplicate queries.",
    "How does data colocation simplify refactoring and dead code removal?",
    "When a UI component is moved or deleted, its data fetching logic is moved or deleted with it. You never have to manually prune top-level page queries or clean up unused drilled props."
  ),

  card(
    43,
    "Serialization Rules: What Props Can Cross the Boundary?",
    "Server & Client Composition",
    "Deep Dive",
    "When passing props from a Server Component to a Client Component, values must be serializable by the React Flight protocol. Supported types include JSON primitives, plain objects, arrays, Dates, Maps, Sets, TypedArrays, Promises, and Server Actions.",
    `// Serialization Compatibility Matrix:
// ALLOWED PROPS:
// - Primitives: string, number, boolean, null, undefined
// - Structures: Plain Objects, Arrays, ArrayBuffer
// - Collections: Set, Map (built-in serialization in modern React)
// - Special: Date objects, BigInt, URLSearchParams
// - Server Actions: async functions marked with "use server"
// - React Elements: JSX elements generated on the server (e.g. <div>Server Content</div>)

// STRICTLY FORBIDDEN PROPS:
// - Arbitrary Functions: (e.g. onClick={() => alert()}) -> Runtime Error!
// - Symbols: Symbol("id")
// - Custom Class Instances: (e.g. new UserEntity()) -> Prototypes are stripped!
// - DOM Nodes: document.body

// Example converting Class instance to Plain Object:
const rawUser = new UserModel({ id: "1", name: "Alice" });
// BAD: <ClientCard user={rawUser} /> (Prototype methods lost)
// GOOD: <ClientCard user={{ id: rawUser.id, name: rawUser.name }} />`,
    ["Serialization", "React Flight", "Allowed Props", "Forbidden Props", "Prototypes"],
    [
      { title: "Next.js Docs: Passing Props to Client Components", url: "https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns#supported-patterns" }
    ],
    "What happens to methods on a custom class instance when passed as a prop across the server-to-client boundary?",
    "Prototypes are stripped during React Flight serialization. The client receives a plain object containing only enumerable data properties; any instance methods (`user.getFullName()`) are discarded, throwing a runtime TypeError.",
    "Can a Server Component pass an unresolved JavaScript Promise as a prop to a Client Component?",
    "Yes! React 19 supports passing Promises across the boundary. The Client Component consumes the Promise using the new `use(promise)` hook inside a Suspense boundary."
  ),

  card(
    44,
    "Client-Only Wrappers for Third-Party Libraries",
    "Server & Client Composition",
    "Mastery",
    "Many npm packages (Chart.js, Leaflet, Rich Text Editors) assume immediate browser availability and crash during Server-Side Rendering with `window is not defined`. To use them in Next.js, wrap them in a Client Component or load them dynamically with `next/dynamic`.",
    `// 1. Solution A: Client Component Wrapper with useEffect
// components/ClientOnlyMap.tsx
"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Disable SSR for libraries relying strictly on window/canvas!
const LeafletMap = dynamic(() => import("@/components/LeafletMapInternal"), {
  ssr: false,
  loading: () => <div className="h-64 bg-slate-100 flex items-center justify-center">Loading map...</div>
});

export function ClientOnlyMap({ coordinates }: { coordinates: [number, number] }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;
  return <LeafletMap coordinates={coordinates} />;
}`,
    ["next/dynamic", "ssr: false", "window is not defined", "Client-Only Wrappers", "Leaflet"],
    [
      { title: "Next.js Docs: Lazy Loading and next/dynamic", url: "https://nextjs.org/docs/app/building-your-application/optimizing/lazy-loading" }
    ],
    "Why does Next.js throw `'window is not defined'` even inside a file marked with `'use client'`?",
    "Because `'use client'` components still render on the server to generate initial HTML during SSR! At server runtime, global browser objects (`window`, `document`, `navigator`) do not exist. Code referencing them must run inside `useEffect` or be loaded via `dynamic(() => ..., { ssr: false })`.",
    "What does `next/dynamic` with `{ ssr: false }` do under the hood?",
    "It skips server-side prerendering entirely for that component, emitting only the loading fallback in initial HTML and instantiating the real component exclusively in the browser after client bundle hydration."
  ),

  card(
    45,
    "Sharing State Between Client Components without Redux",
    "Server & Client Composition",
    "Mastery",
    "In the App Router, global client state stores (Redux, Zustand) are often unnecessary. Applications coordinate state cleanly using two primary mechanisms: URL Query Parameters (`useSearchParams` & `router.push`) and colocated React Context wrappers.",
    `// State via URL Parameters (Shareable, Bookmarkable, History-Friendly):
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function SearchFilter() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const { replace } = useRouter();

  const handleFilterChange = (category: string) => {
    const params = new URLSearchParams(searchParams);
    if (category) {
      params.set("category", category);
    } else {
      params.delete("category");
    }
    // Updates URL without full page reload; Server Components re-fetch matching data!
    replace(\`\${pathname}?\${params.toString()}\`);
  };

  return (
    <select onChange={(e) => handleFilterChange(e.target.value)} defaultValue={searchParams.get("category") || ""}>
      <option value="">All Categories</option>
      <option value="electronics">Electronics</option>
      <option value="apparel">Apparel</option>
    </select>
  );
}`,
    ["URL State", "useSearchParams", "Global State", "Zustand", "Clean Architecture"],
    [
      { title: "Next.js Docs: useSearchParams", url: "https://nextjs.org/docs/app/api-reference/functions/use-search-params" }
    ],
    "Why is encoding filter and pagination state in the URL superior to local React state (`useState`)?",
    "URL state is shareable via copy-paste, supports browser Back/Forward navigation, survives page refreshes, and allows Server Components to read the state on the server to prerender filtered results.",
    "How does updating the URL using `router.replace` trigger Server Component re-renders?",
    "Next.js intercepts router calls, requests the updated Server Component payload (`?_rsc=...`) for the new URL, and reconciles the DOM in place without losing client focus or scroll position."
  ),

  card(
    46,
    "React Server Component Lifecycle & Statelessness",
    "App Router & RSC",
    "Deep Dive",
    "React Server Components possess no lifecycle: they execute once on the server, resolve to a Flight tree, and are discarded from memory. They maintain zero internal state, receive no re-render events, and cannot subscribe to data changes.",
    `// The Pure Functional Model of RSC:
// Input: Request Context (headers, cookies, params, searchParams)
// Output: Serialized React Flight Element Stream

// Lifecycle Characteristics:
// 1. Initial Render: Executes async function body -> yields JSX.
// 2. No Mounting / Unmounting: componentDidMount, useEffect, componentWillUnmount DO NOT EXIST.
// 3. No Re-rendering: A Server Component never re-renders in place. To update it, Next.js executes
//    a full server sub-tree re-render triggered via router.refresh(), revalidatePath(), or Server Action.
// 4. Memory Footprint: Once the response streams to the client, the Server Component instance is garbage-collected.`,
    ["RSC Lifecycle", "Statelessness", "Garbage Collection", "Functional Architecture", "Execution Model"],
    [
      { title: "React Architecture: Server Components", url: "https://react.dev/reference/rsc/server-components" }
    ],
    "How does the stateless nature of Server Components protect against server memory leaks?",
    "Because Server Components do not maintain long-lived state, event listener subscriptions, or observer patterns in memory, their execution closures terminate immediately after streaming the Flight payload, allowing rapid V8 heap garbage collection.",
    "If a Server Component has no state, how does an application refresh its rendered content?",
    "By triggering a server revalidation: calling `router.refresh()` on the client, or invoking a Server Action that calls `revalidatePath()` or `revalidateTag()`. The server re-executes the component and streams the fresh Flight diff."
  ),

  card(
    47,
    "The Taint API: `experimental_taintObjectReference`",
    "Security",
    "Deep Dive",
    "The React Taint API prevents sensitive server data structures (user records with password hashes, raw API credential objects) from ever being passed to Client Components, throwing a build or runtime error if a tainted object crosses the boundary.",
    `// lib/user.ts
import { experimental_taintObjectReference, experimental_taintUniqueValue } from "react";
import { db } from "@/lib/db";

export async function getUserSecure(id: string) {
  const user = await db.user.findUnique({ where: { id } });

  // 1. Taint the entire user object reference:
  // If this object is passed as a prop to a Client Component, React throws an ERROR!
  experimental_taintObjectReference(
    "Do not pass raw user entity to Client Components. Extract public fields only.",
    user
  );

  // 2. Taint sensitive specific string values (tokens, hashes):
  // Even if extracted to a new object, passing this specific value throws an ERROR!
  experimental_taintUniqueValue(
    "Do not expose Stripe Customer Secret to client.",
    user,
    user.stripeSecretKey
  );

  return user;
}

// app/page.tsx (Server Component)
// const user = await getUserSecure("123");
// <ClientProfile user={user} /> // THROWS RUNTIME TAINT ERROR!`,
    ["Taint API", "Data Leakage Prevention", "Security", "experimental_taintObjectReference", "Protection"],
    [
      { title: "React Docs: experimental_taintObjectReference", url: "https://react.dev/reference/react/experimental_taintObjectReference" }
    ],
    "What specific security vulnerability does the Taint API eliminate in Next.js?",
    "Accidental data leakage. In large engineering teams, developers often fetch a full database record (`SELECT *`) and pass the entire object as a prop to a Client Component. The Taint API halts the application if an object containing sensitive properties crosses into the client bundle.",
    "What is the difference between `taintObjectReference` and `taintUniqueValue`?",
    "`taintObjectReference` blocks passing that specific object reference. `taintUniqueValue` tracks a specific sensitive primitive value (like a password hash or private key string) and throws an error if that exact value is passed, even if copied into a new object."
  ),

  card(
    48,
    "Server & Client Composition Anti-Patterns",
    "Server & Client Composition",
    "Mastery",
    "Common anti-patterns in App Router composition include: 1) Over-using `'use client'` at the page level, 2) Data-fetching waterfalls inside nested components without Suspense, and 3) Prop drilling across multiple boundary levels instead of using children slots.",
    `// ANTI-PATTERN 1: Root Page marked as "use client"
// "use client"; // Kills RSC benefits for the entire route!
// export default function Page() { ... }

// ANTI-PATTERN 2: Fetching data in Client Components via useEffect (Old Pages Router habit)
// "use client";
// export function ProductList() {
//   const [data, setData] = useState([]);
//   useEffect(() => { fetch("/api/products").then(...) }, []); // Waterfall & flash of unstyled content!
// }

// CORRECT REFACTOR:
// Keep ProductList as an async Server Component:
export async function ProductList() {
  const data = await db.product.findMany();
  return <ul>{data.map(p => <li key={p.id}>{p.name}</li>)}</ul>;
}`,
    ["Anti-Patterns", "useEffect Fetching", "Refactoring", "Clean Architecture", "Performance"],
    [
      { title: "Next.js Docs: Composition Patterns", url: "https://nextjs.org/docs/app/building-your-application/rendering/composition-patterns" }
    ],
    "Why is fetching data in Client Components using `useEffect` considered an anti-pattern in the App Router?",
    "It reintroduces client-side waterfalls, requires shipping extra JavaScript, causes a flash of loading spinners, prevents server prerendering of content, and damages SEO because crawlers receive empty initial markup.",
    "How do you refactor a page that needs user interaction without making the whole page a Client Component?",
    "Keep the page as a Server Component for data fetching and layout structure. Extract only the interactive elements (buttons, inputs, modals) into dedicated Client Components and embed them in the page."
  )
];

module.exports = { cards };
