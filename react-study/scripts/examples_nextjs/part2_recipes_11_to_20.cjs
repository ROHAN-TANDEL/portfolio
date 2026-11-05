const recipes = [
  {
    id: "next-ex-11",
    title: "Parallel Routes Named Slots with Split Dashboard Views",
    category: "Parallel & Intercepting Routes",
    difficulty: "intermediate",
    whatThisCodeCovers: "A multi-view split dashboard using parallel route named slots (@analytics and @team) with independent loading skeletons and isolated error boundaries.",
    conceptsCovered: ["Parallel Routes", "Named Slots", "@slot", "Independent Loading", "Layout Props"],
    code: `// app/dashboard/layout.tsx:
export default function DashboardLayout({
  children,
  analytics, // Injected from app/dashboard/@analytics/page.tsx
  team       // Injected from app/dashboard/@team/page.tsx
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  team: React.ReactNode;
}) {
  return (
    <div className="p-8 space-y-6">
      <header className="border-b pb-4"><h1 className="text-3xl font-bold">Executive Dashboard</h1></header>
      
      {/* Main children slot */}
      <section>{children}</section>

      {/* Parallel Split Screen Slots */}
      <div className="grid grid-cols-2 gap-6">
        <div className="border rounded-xl p-4 bg-white shadow-sm">{analytics}</div>
        <div className="border rounded-xl p-4 bg-white shadow-sm">{team}</div>
      </div>
    </div>
  );
}

// app/dashboard/@analytics/page.tsx:
export default async function AnalyticsSlot() {
  const data = await fetchAnalytics(); // Async fetch
  return <div><h2 className="font-bold text-lg">Live Analytics</h2><p>Active Users: {data.users}</p></div>;
}

// app/dashboard/@team/page.tsx:
export default async function TeamSlot() {
  const members = await fetchTeam();
  return <div><h2 className="font-bold text-lg">Team Directory</h2><p>Total Members: {members.length}</p></div>;
}`,
    breakdown: [
      "Defines named slots @analytics and @team alongside children in layout props.",
      "Slots render simultaneously and stream independently over HTTP.",
      "A slow query in Analytics does not block Team directory from rendering.",
      "Slots can colocate their own loading.tsx and error.tsx boundaries."
    ],
    expectedOutput: "Renders main dashboard overview with side-by-side Analytics and Team cards."
  },

  {
    id: "next-ex-12",
    title: "Intercepting Route Photo Modal with Shareable URL",
    category: "Parallel & Intercepting Routes",
    difficulty: "advanced",
    whatThisCodeCovers: "A complete Instagram-style photo feed that intercepts clicks to display an overlay modal while keeping the feed visible, with a standalone fallback page for direct visits.",
    conceptsCovered: ["Intercepting Routes", "(.) Prefix", "Modal Pattern", "Shareable URL", "Parallel Routing"],
    code: `// 1. Root Layout: app/layout.tsx
export default function RootLayout({
  children,
  modal // Parallel slot for modal overlay
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        {children}
        {modal} {/* Renders modal when route is intercepted */}
      </body>
    </html>
  );
}

// 2. Default slot view: app/@modal/default.tsx
export default function DefaultModal() {
  return null; // Empty when modal is closed
}

// 3. Intercepted Route: app/@modal/(.)photos/[id]/page.tsx
// Intercepts /photos/123 on the same level!
import { ModalWrapper } from "@/components/ModalWrapper";
import { PhotoView } from "@/components/PhotoView";

export default async function PhotoModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ModalWrapper>
      <PhotoView photoId={id} isModal={true} />
    </ModalWrapper>
  );
}

// 4. Standalone Full Page: app/photos/[id]/page.tsx
// Rendered on hard refresh or direct URL share!
export default async function StandalonePhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="max-w-4xl mx-auto py-12">
      <PhotoView photoId={id} isModal={false} />
    </div>
  );
}`,
    breakdown: [
      "Uses (.)photos/[id] to intercept client-side clicks from the feed.",
      "Renders modal inside @modal parallel slot without leaving the feed page.",
      "Updates browser URL to /photos/123 so the modal view is linkable.",
      "Provides app/photos/[id]/page.tsx as a full-page view for hard refreshes and SEO."
    ],
    expectedOutput: "Clicking photo opens popup modal; refreshing page loads standalone full-screen photo."
  },

  {
    id: "next-ex-13",
    title: "Modal Backdrop Dismissal & `router.back()` History Sync",
    category: "Parallel & Intercepting Routes",
    difficulty: "intermediate",
    whatThisCodeCovers: "An accessible modal overlay component that listens for Escape key presses and backdrop clicks, calling router.back() to pop history and unmount the modal.",
    conceptsCovered: ["Modal Dismiss", "router.back()", "Escape Key Listener", "Backdrop Click", "Keyboard Accessibility"],
    code: `// components/ModalWrapper.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect, useCallback } from "react";

export function ModalWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Dismiss modal and pop browser history back to the feed
  const onDismiss = useCallback(() => {
    router.back();
  }, [router]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      {/* Invisible backdrop click catcher */}
      <div className="fixed inset-0" onClick={onDismiss} aria-hidden="true" />

      {/* Modal Dialog Card */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6 overflow-hidden">
        <button
          onClick={onDismiss}
          className="absolute top-4 right-4 text-slate-400 hover:text-black font-bold text-xl"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}`,
    breakdown: [
      "Invokes router.back() to dismiss the modal and update the URL history stack.",
      "Listens for global Escape key presses and cleans up event listeners on unmount.",
      "Implements accessible backdrop click to close overlay.",
      "Unmounts cleanly as the @modal slot returns to default.tsx (null)."
    ],
    expectedOutput: "Clicking outside the modal or pressing Escape closes the modal and restores feed URL."
  },

  {
    id: "next-ex-14",
    title: "Fallback Handling in Parallel Slots with `default.tsx`",
    category: "Parallel & Intercepting Routes",
    difficulty: "intermediate",
    whatThisCodeCovers: "Configuring default.tsx fallback files across parallel slots to prevent 404 crashes during hard refreshes and sub-route transitions.",
    conceptsCovered: ["default.tsx", "Hard Navigation", "404 Prevention", "Slot Fallbacks", "Parallel Routing"],
    code: `// Directory Structure:
// app/admin/
//   ├── layout.tsx
//   ├── page.tsx
//   ├── @sidebar/
//   │     ├── page.tsx
//   │     └── default.tsx  <-- CRITICAL!
//   └── @main/
//         ├── page.tsx
//         ├── users/page.tsx
//         └── default.tsx  <-- CRITICAL!

// app/admin/@sidebar/default.tsx:
// Rendered when URL is /admin/users (where @sidebar has no nested /users folder)
export default function DefaultSidebar() {
  return (
    <nav className="p-4 bg-slate-100 rounded">
      <h3 className="font-bold text-sm text-slate-500 uppercase">Admin Menu</h3>
      <ul className="mt-2 space-y-1">
        <li><a href="/admin">Dashboard Home</a></li>
        <li><a href="/admin/users">User Management</a></li>
      </ul>
    </nav>
  );
}

// app/admin/@main/default.tsx:
export default function DefaultMain() {
  return <div>Select an administrative view from the sidebar.</div>;
}`,
    breakdown: [
      "Prevents Next.js from throwing a 404 when navigating to sub-routes.",
      "Provides explicit fallback UI when the URL segment does not match a slot's folder tree.",
      "Maintains the sidebar UI during deep navigation into /admin/users.",
      "Essential safeguard for production parallel routes."
    ],
    expectedOutput: "Hard-refreshing /admin/users correctly renders the default sidebar and the users main slot."
  },

  {
    id: "next-ex-15",
    title: "Passing Server Components as Children to Client Wrappers",
    category: "Server & Client Composition",
    difficulty: "intermediate",
    whatThisCodeCovers: "The Slots / Children pattern: wrapping an async Server Component inside an interactive Client Component without converting the Server Component into client JavaScript.",
    conceptsCovered: ["Composition", "Children Prop", "Server-Client Boundary", "Bundle Optimization", "RSC"],
    code: `// 1. Interactive Client Wrapper: components/CollapsibleCard.tsx
"use client";

import { useState } from "react";

export function CollapsibleCard({
  title,
  children // Server Component rendered output passes as children!
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div className="border rounded-xl p-4 bg-white shadow-sm">
      <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsOpen(!isOpen)}>
        <h3 className="font-bold text-lg">{title}</h3>
        <span>{isOpen ? "▲" : "▼"}</span>
      </div>
      {isOpen && <div className="mt-4 pt-4 border-t">{children}</div>}
    </div>
  );
}

// 2. Server Component: app/page.tsx
import { CollapsibleCard } from "@/components/CollapsibleCard";
import { db } from "@/lib/db";

// Direct async Server Component
async function HeavyServerMetrics() {
  const stats = await db.metric.findMany(); // Direct DB query!
  return <ul>{stats.map(s => <li key={s.id}>{s.name}: {s.value}</li>)}</ul>;
}

export default function Page() {
  return (
    <CollapsibleCard title="Real-Time Server Statistics">
      {/* HeavyServerMetrics runs on server; only rendered HTML/Flight element passes to client! */}
      <HeavyServerMetrics />
    </CollapsibleCard>
  );
}`,
    breakdown: [
      "Interactive button and state toggle live entirely in the Client Component.",
      "HeavyServerMetrics executes on the server and never downloads database libraries to the browser.",
      "Shows how to embed server data inside interactive drawers, carousels, and accordions.",
      "Maintains zero client bundle size for the database fetching logic."
    ],
    expectedOutput: "Collapsible accordion toggles visibility of server-fetched database records."
  },

  {
    id: "next-ex-16",
    title: "The Server-to-Client React Context Bridge Pattern",
    category: "Server & Client Composition",
    difficulty: "intermediate",
    whatThisCodeCovers: "Bridging server-rendered authentication session data into client-side React Context without causing hydration mismatch errors.",
    conceptsCovered: ["Context Bridge", "createContext", "Hydration", "Session Context", "Client Providers"],
    code: `// 1. Client Context Definition: components/SessionContext.tsx
"use client";

import { createContext, useContext } from "react";

interface UserSession {
  id: string;
  name: string;
  role: string;
}

const SessionContext = createContext<UserSession | null>(null);

export function SessionProvider({
  session,
  children
}: {
  session: UserSession | null;
  children: React.ReactNode;
}) {
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

// 2. Root Layout (Server Component): app/layout.tsx
import { SessionProvider } from "@/components/SessionContext";
import { auth } from "@/lib/auth";

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Fetch session once on server!
  const session = await auth();

  return (
    <html>
      <body>
        {/* Pass server session into Client Provider */}
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}`,
    breakdown: [
      "Fetches session data on the server during the initial render.",
      "Passes the session down as a serializable prop into SessionProvider.",
      "Allows deeply nested client components to access user session via useSession() hook.",
      "Eliminates client-side loading spinners during authentication check."
    ],
    expectedOutput: "Client components consume useSession() immediately on mount with zero network delay."
  },

  {
    id: "next-ex-17",
    title: "Tainting Sensitive User Records with `experimental_taintObjectReference`",
    category: "Security & Identity",
    difficulty: "advanced",
    whatThisCodeCovers: "Using React's experimental Taint API to flag raw database objects containing secrets, throwing an immediate error if passed to a Client Component.",
    conceptsCovered: ["Taint API", "Security Defense", "Data Leak Prevention", "experimental_taintObjectReference", "Protection"],
    code: `// lib/user.ts
import { experimental_taintObjectReference, experimental_taintUniqueValue } from "react";
import { db } from "@/lib/db";

export async function getUserAccountSecure(userId: string) {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return null;

  // 1. Taint the object reference:
  // Throws an error if the entire 'user' object is passed to a Client Component!
  experimental_taintObjectReference(
    "Security Violation: Do not pass raw user entity to Client Components. Project public fields.",
    user
  );

  // 2. Taint sensitive primitive strings:
  experimental_taintUniqueValue(
    "Security Violation: Password hash must never leave the server.",
    user,
    user.passwordHash
  );

  return user;
}

// Safe Public DTO Projector:
export function toPublicUser(user: any) {
  return {
    id: user.id,
    name: user.name,
    avatarUrl: user.avatarUrl
  };
}`,
    breakdown: [
      "Protects against accidental PII and secret leaks across the server-client boundary.",
      "Throws build/runtime error if tainted object crosses into Client Component props.",
      "Forces developers to map raw database rows to safe, minimal public DTOs.",
      "Enforces defense-in-depth across enterprise development teams."
    ],
    expectedOutput: "Passing raw user object to Client Component triggers immediate Taint violation error."
  },

  {
    id: "next-ex-18",
    title: "Wrapping Un-SSR-able Libraries with `next/dynamic` (`ssr: false`)",
    category: "Server & Client Composition",
    difficulty: "intermediate",
    whatThisCodeCovers: "Dynamically importing a client-only library (Rich Text Editor / Canvas / Window API) with ssr: false to prevent 'window is not defined' errors during server rendering.",
    conceptsCovered: ["next/dynamic", "ssr: false", "window is not defined", "Client-Only Wrappers", "Lazy Loading"],
    code: `// components/RichTextEditorWrapper.tsx
"use client";

import dynamic from "next/dynamic";

// Dynamically import Quill / Monaco editor with SSR disabled!
const QuillEditor = dynamic(() => import("@/components/QuillEditorInternal"), {
  ssr: false, // Bypasses server-side prerendering completely!
  loading: () => (
    <div className="h-64 border rounded bg-slate-50 flex items-center justify-center text-slate-400">
      Loading Rich Text Editor...
    </div>
  )
});

export function RichTextEditor({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="my-4">
      <QuillEditor initialValue={value} onUpdate={onChange} />
    </div>
  );
}`,
    breakdown: [
      "Uses next/dynamic with ssr: false to isolate code that accesses window or document.",
      "Prevents server crash with 'window is not defined'.",
      "Renders clean placeholder skeleton in server HTML.",
      "Downloads and mounts the heavy editor JavaScript exclusively in the client browser."
    ],
    expectedOutput: "Renders placeholder during server render; hydrates real editor on the client."
  },

  {
    id: "next-ex-19",
    title: "Eliminating Request Waterfalls with `Promise.all` & Suspense",
    category: "Performance & Rendering",
    difficulty: "intermediate",
    whatThisCodeCovers: "Refactoring a sequential blocking waterfall in a Server Component into parallel fetching with Promise.all and concurrent Suspense streams.",
    conceptsCovered: ["Waterfalls", "Promise.all", "Suspense", "Parallel Fetching", "TTFB"],
    code: `// BEFORE (WATERFALL ANTI-PATTERN: 150ms + 200ms = 350ms TTFB):
// const user = await fetchUser();   // blocks 150ms
// const orders = await fetchOrders(); // blocks 200ms

// AFTER: Parallel Execution with Independent Suspense Streaming (Instant Initial Shell!)
import { Suspense } from "react";

export default function DashboardPage() {
  return (
    <div className="p-8 space-y-6">
      <h1 className="text-2xl font-bold">Store Performance</h1>

      {/* Profile and Orders stream in parallel without blocking each other! */}
      <Suspense fallback={<div className="h-20 bg-slate-200 animate-pulse rounded" />}>
        <UserAsyncSection />
      </Suspense>

      <Suspense fallback={<div className="h-64 bg-slate-200 animate-pulse rounded" />}>
        <OrdersAsyncSection />
      </Suspense>
    </div>
  );
}

async function UserAsyncSection() {
  const user = await fetchUser(); // 150ms
  return <div>Welcome, {user.name}</div>;
}

async function OrdersAsyncSection() {
  const orders = await fetchOrders(); // 200ms
  return <div>Orders: {orders.length}</div>;
}`,
    breakdown: [
      "Eliminates sequential request blocking on the server.",
      "Initial page layout and header flush to the client in < 20ms.",
      "UserAsyncSection and OrdersAsyncSection execute concurrently on the backend.",
      "Each section streams into its Suspense placeholder the moment its query completes."
    ],
    expectedOutput: "Page shell renders immediately; user section appears at 150ms, orders at 200ms."
  },

  {
    id: "next-ex-20",
    title: "Colocated Data Fetching with Automatic Request Deduplication",
    category: "Server & Client Composition",
    difficulty: "intermediate",
    whatThisCodeCovers: "Colocating data fetching inside independent Server Components while utilizing React.cache() to deduplicate database queries automatically across the tree.",
    conceptsCovered: ["Colocation", "React.cache", "Request Memoization", "Database Deduplication", "Clean Code"],
    code: `// lib/queries.ts
import { cache } from "react";
import { db } from "@/lib/db";

// Wrap database query in React.cache() for per-request memoization!
export const getActiveOrganization = cache(async (orgId: string) => {
  console.log(\`[SQL] Querying DB for Org: \${orgId}\`);
  return db.org.findUnique({ where: { id: orgId } });
});

// components/OrgBadge.tsx (Colocated fetch)
export async function OrgBadge({ orgId }: { orgId: string }) {
  const org = await getActiveOrganization(orgId); // First call: Executes SQL!
  return <span className="badge">{org?.name}</span>;
}

// components/OrgBillingStatus.tsx (Colocated fetch in another component)
export async function OrgBillingStatus({ orgId }: { orgId: string }) {
  const org = await getActiveOrganization(orgId); // Second call: Returns MEMOIZED result (Zero SQL)!
  return <span>Plan: {org?.plan}</span>;
}

// app/dashboard/page.tsx:
// Both components execute within the same page render pass:
export default function Page() {
  return (
    <div>
      <OrgBadge orgId="org-1" />
      <OrgBillingStatus orgId="org-1" />
    </div>
  );
}`,
    breakdown: [
      "Colocates data fetching directly where needed, eliminating prop drilling.",
      "React.cache() intercepts repeated calls with identical arguments in the same render pass.",
      "Executes the underlying SQL query only once.",
      "Maintains clean component independence and encapsulation."
    ],
    expectedOutput: "Both components render org details; console confirms SQL query executed only once."
  }
];

module.exports = { recipes };
