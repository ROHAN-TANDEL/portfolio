const { card } = require("../next_builder_helper.cjs");

const cards = [
  card(
    25,
    "Parallel Routes: Named Slots (`@slot`) & Layout Props",
    "Parallel & Intercepting Routes",
    "Mastery",
    "Parallel Routes allow rendering multiple distinct page views simultaneously or conditionally within the same layout. Slots are defined using `@slotName` folders and passed as explicit named props to the parent `layout.tsx` alongside `children`.",
    `// Directory Structure:
// app/dashboard/
//   ├── layout.tsx
//   ├── page.tsx
//   ├── @analytics/
//   │     └── page.tsx
//   └── @team/
//         └── page.tsx

// app/dashboard/layout.tsx:
// Named slots (@analytics, @team) are passed directly as props!
export default function DashboardLayout({
  children,
  analytics,
  team
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  team: React.ReactNode;
}) {
  return (
    <div className="p-6 space-y-6">
      {/* Main page content */}
      <main>{children}</main>

      {/* Parallel split-screen slots rendering side-by-side! */}
      <div className="grid grid-cols-2 gap-6">
        <section className="border p-4 rounded">{analytics}</section>
        <section className="border p-4 rounded">{team}</section>
      </div>
    </div>
  );
}`,
    ["Parallel Routes", "Named Slots", "@slot", "Dashboard Architecture", "Layout Props"],
    [
      { title: "Next.js Docs: Parallel Routes", url: "https://nextjs.org/docs/app/building-your-application/routing/parallel-routes" }
    ],
    "Do `@slot` folders affect the public URL path?",
    "No. Slots defined with `@` (e.g. `@analytics`, `@team`) do NOT affect the URL. `app/dashboard/@analytics/page.tsx` renders at `/dashboard` within its parent layout.",
    "What is the special implicit slot present in every Next.js layout?",
    "The `children` prop. `children` is an implicit parallel route slot corresponding to `app/dashboard/page.tsx`."
  ),

  card(
    26,
    "Independent Error & Loading States in Parallel Slots",
    "Parallel & Intercepting Routes",
    "Deep Dive",
    "Each parallel slot functions as an autonomous sub-tree. Developers can colocate dedicated `loading.tsx` and `error.tsx` files inside individual slot folders, allowing slow data or unhandled exceptions in one slot to render without affecting other slots.",
    `// Colocation within parallel slots:
// app/dashboard/
//   ├── @analytics/
//   │     ├── page.tsx (Slow analytical queries)
//   │     ├── loading.tsx (Skeleton loader specifically for analytics card)
//   │     └── error.tsx (Error boundary specifically for analytics card)
//   └── @team/
//         └── page.tsx (Loads fast in 50ms!)

// Behavior:
// When navigating to /dashboard:
// 1. @team renders and displays immediately in 50ms.
// 2. @analytics immediately streams its local loading.tsx skeleton.
// 3. If @analytics database query crashes, @analytics/error.tsx catches the crash.
// 4. The rest of the dashboard (@team, children, sidebar) remains 100% functional and interactive!`,
    ["Fault Isolation", "Independent Loading", "error.tsx", "loading.tsx", "Parallel Slots"],
    [
      { title: "Next.js Docs: Parallel Routes Loading and Error UI", url: "https://nextjs.org/docs/app/building-your-application/routing/parallel-routes#loading-and-error-ui" }
    ],
    "Why are Parallel Routes superior to traditional multiple `<Component />` tags in a layout for complex dashboards?",
    "Parallel Routes provide independent server-side streaming, autonomous Suspense loading skeletons, isolated error boundary blast radiuses, and individual sub-route navigation capabilities per slot.",
    "Can a user trigger `reset()` on a failed slot without reloading the other slots on the screen?",
    "Yes. The `reset()` function in `@analytics/error.tsx` re-renders only the `@analytics` sub-tree, leaving all other active slots untouched."
  ),

  card(
    27,
    "The Crucial Role of `default.tsx` in Parallel Routing",
    "Parallel & Intercepting Routes",
    "Mastery",
    "On hard navigation (browser refresh or direct URL load), Next.js cannot determine what un-navigated parallel slots should display if the current URL does not match their sub-paths. An unmatched slot without a `default.tsx` will trigger a 404 Not Found.",
    `// Directory Structure with Sub-Navigation in one slot:
// app/dashboard/
//   ├── layout.tsx
//   ├── @feed/
//   │     ├── page.tsx
//   │     ├── default.tsx  <-- CRITICAL: Fallback view on hard navigation!
//   │     └── archive/
//   │           └── page.tsx
//   └── @metrics/
//         ├── page.tsx
//         └── default.tsx  <-- CRITICAL!

// app/dashboard/@feed/default.tsx:
// Rendered when URL is /dashboard/metrics-view (where @feed has no matching sub-segment)
export default function DefaultFeed() {
  return <div>Default Feed Overview</div>;
}

// Rules:
// 1. Soft Navigation: Next.js retains the slot's previously active view.
// 2. Hard Navigation (F5 Refresh): Next.js looks for default.tsx. If missing -> 404!`,
    ["default.tsx", "Hard Navigation", "Soft Navigation", "Slot Fallback", "Parallel Routing Trap"],
    [
      { title: "Next.js Docs: default.js", url: "https://nextjs.org/docs/app/api-reference/file-conventions/default" }
    ],
    "Why does a parallel route work perfectly during client-side navigation but throw a 404 on page refresh (F5)?",
    "Because client-side navigation retains the previously active slot in the client Router Cache. On hard refresh, the cache is empty; if the slot lacks a `default.tsx` file for that URL state, Next.js cannot render the slot and returns 404.",
    "Can `default.tsx` return `null`?",
    "Yes. Returning `null` from `default.tsx` is standard practice when a slot (such as a modal or secondary panel) should be hidden or inactive by default on initial page load."
  ),

  card(
    28,
    "Conditional & Role-Based Slot Rendering",
    "Parallel & Intercepting Routes",
    "Mastery",
    "Parallel slots can be conditionally rendered based on user authentication status, enterprise RBAC roles, or feature flags directly within the parent `layout.tsx`.",
    `// app/dashboard/layout.tsx:
// Conditional rendering based on user role
import { auth } from "@/lib/auth";

export default async function DashboardLayout({
  children,
  adminPanel,
  userStats
}: {
  children: React.ReactNode;
  adminPanel: React.ReactNode;
  userStats: React.ReactNode;
}) {
  const session = await auth();
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="dashboard-container">
      <main>{children}</main>

      {/* Conditionally render slot based on verified server role */}
      {isAdmin ? (
        <section className="bg-amber-50 p-4 rounded">{adminPanel}</section>
      ) : (
        <section className="bg-blue-50 p-4 rounded">{userStats}</section>
      )}
    </div>
  );
}`,
    ["Conditional Routing", "RBAC", "Slot Selection", "Server-Side Auth", "Security"],
    [
      { title: "Next.js Docs: Conditional Routes", url: "https://nextjs.org/docs/app/building-your-application/routing/parallel-routes#conditional-routes" }
    ],
    "Why is conditional slot rendering in `layout.tsx` more secure than client-side conditional rendering?",
    "Because the role evaluation occurs on the server. If a user is not an admin, the `adminPanel` Server Component never renders, and its code, components, and data are never transmitted over the network."
  ),

  card(
    29,
    "Intercepting Routes Syntax: `(.)`, `(..)`, `(...)`",
    "Parallel & Intercepting Routes",
    "Mastery",
    "Intercepting Routes allow intercepting a target route from another part of the app to render an alternative view (such as an overlay modal) while keeping the user on the current page and updating the browser URL. They use convention prefixes matching relative folder levels.",
    `// Interception Convention Prefixes:
// (.)   - Matches segments on the SAME level
// (..)  - Matches segments ONE level above
// (..)(..) - Matches segments TWO levels above
// (...) - Matches segments from the root 'app' directory

// Example: Intercepting Photo Detail from Feed
// app/feed/
//   ├── page.tsx (Photo Feed)
//   ├── layout.tsx
//   ├── @modal/
//   │     └── (.)photo/[id]/page.tsx  <-- Intercepts /feed/photo/123 on same level!
//   └── photo/[id]/
//         └── page.tsx                <-- Standalone full page (Rendered on hard refresh!)`,
    ["Intercepting Routes", "Modal Routing", "(.)", "(..)", "URL Synchronization"],
    [
      { title: "Next.js Docs: Intercepting Routes", url: "https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes" }
    ],
    "What is the core benefit of Intercepting Routes for user experience?",
    "It provides the ideal modal pattern: clicking an item opens an overlay modal with an updated shareable URL without losing page scroll or context. Copying and pasting that URL in a new tab opens the standalone full-page view.",
    "What happens when a user reloads the browser while viewing an intercepted modal?",
    "Next.js renders the full-page route (`photo/[id]/page.tsx`) instead of the intercepted modal view, because a hard refresh bypasses client-side interception."
  ),

  card(
    30,
    "The Modal Pattern: Shareable URL + Intercepted Overlay",
    "Parallel & Intercepting Routes",
    "Mastery",
    "The definitive modal architecture combines Parallel Routes (providing a persistent `@modal` slot in layout) and Intercepting Routes (intercepting the target route when clicked from the parent list).",
    `// 1. Root or Parent Layout: app/layout.tsx
export default function RootLayout({
  children,
  modal // Parallel slot for modals
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <html>
      <body>
        {children}
        {modal} {/* Renders intercepted modal or default.tsx */}
      </body>
    </html>
  );
}

// 2. Default slot when modal is closed: app/@modal/default.tsx
export default function DefaultModal() {
  return null; // Empty when no modal is open!
}

// 3. Intercepted Modal: app/@modal/(.)photos/[id]/page.tsx
import { ModalWrapper } from "@/components/ModalWrapper";
import { PhotoView } from "@/components/PhotoView";

export default async function PhotoModal({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <ModalWrapper>
      <PhotoView photoId={id} />
    </ModalWrapper>
  );
}`,
    ["Modal Pattern", "Shareable URL", "Parallel Slots", "Intercepting Routes", "UX Architecture"],
    [
      { title: "Next.js Examples: Photo Feed Modal", url: "https://github.com/vercel/nextgram" }
    ],
    "How does the user close an intercepted modal and update the URL history?",
    "By calling `router.back()` from `next/navigation`. This navigates back in browser history, resetting the `@modal` slot to `default.tsx` (`null`) and restoring the previous URL.",
    "Why must `app/@modal/default.tsx` return `null`?",
    "Because when the user is on the main page without an active modal, the `@modal` slot must render nothing. Returning `null` hides the overlay completely."
  ),

  card(
    31,
    "Hard Reload vs Soft Navigation in Intercepted Routes",
    "Parallel & Intercepting Routes",
    "Deep Dive",
    "Understanding the duality of Intercepted Routes is essential: Soft navigation (clicking a `<Link>`) triggers client-side interception rendering the modal. Hard navigation (F5, direct bookmark visit, external link) renders the standard standalone page.",
    `// Two Rendering Paths for the EXACT Same URL (/photos/42):

// PATH A: Client Soft Navigation (User is on /feed and clicks <Link href="/photos/42">)
// - Browser stays on Feed.
// - URL bar updates to /photos/42.
// - @modal/(.)photos/[id]/page.tsx renders inside the layout's @modal slot!
// - User sees photo popup overlay above feed.

// PATH B: Direct Hard Navigation (User pastes /photos/42 in a new browser tab)
// - Next.js does NOT intercept.
// - app/photos/[id]/page.tsx renders as a standalone, full-screen standalone page!
// - Ideal for SEO crawlers and shared links.`,
    ["Soft Navigation", "Hard Reload", "Interception Dualism", "SEO", "User Experience"],
    [
      { title: "Next.js Docs: Intercepting Routes Soft vs Hard Navigation", url: "https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes" }
    ],
    "Why is this dual-rendering behavior beneficial for SEO and social sharing?",
    "Search engines (Googlebot) and social media scrapers do not execute client soft navigations; they fetch URLs directly via HTTP GET. Providing a dedicated standalone page guarantees valid metadata, OpenGraph tags, and fully indexable HTML content."
  ),

  card(
    32,
    "Dismissing Modals & Restoring URL History (`router.back()`)",
    "Parallel & Intercepting Routes",
    "Mastery",
    "Dismissing an intercepted modal requires popping the browser history stack via `router.back()`. A resilient modal wrapper handles backdrop clicks, Escape key presses, and fallback navigation when opened directly.",
    `// components/ModalWrapper.tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function ModalWrapper({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      {/* Backdrop click dismisses modal */}
      <div className="fixed inset-0" onClick={() => router.back()} />
      <div className="relative z-10 bg-white p-6 rounded-lg max-w-2xl w-full">
        <button
          onClick={() => router.back()}
          className="absolute top-3 right-3 text-gray-500 hover:text-black font-bold"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}`,
    ["Modal Dismiss", "router.back()", "Escape Key", "Backdrop Click", "Client Component"],
    [
      { title: "Next.js Docs: Dismissing a Modal", url: "https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes#modal-interception" }
    ],
    "What edge case occurs if a user lands directly on an intercepted modal URL and calls `router.back()`?",
    "If the user opened the URL in a fresh tab, the browser history stack has no previous internal entry (`history.length === 1`). Calling `router.back()` might exit the site or do nothing. A production modal checks `document.referrer` or falls back to `router.push('/feed')`."
  ),

  card(
    33,
    "Deep Nested Interception: Intercepting Across Route Groups",
    "Parallel & Intercepting Routes",
    "Deep Dive",
    "When using Route Groups, relative level calculation for `(..)` matches segment levels ignoring the parenthesized group folders. To intercept across multiple groups, use multiple `(..)` tokens or root interception `(...)`.",
    `// App Structure with Route Group:
// app/
//   ├── (shop)/
//   │     ├── items/
//   │     │     └── page.tsx
//   │     └── @modal/
//   │           └── (..)cart/page.tsx  <-- Intercepts /cart from one level above (shop)!
//   └── cart/
//         └── page.tsx

// Rule: Route groups (shop) do NOT count as segment levels in relative interception!
// (..) reaches up from (shop) to the app root directory.
// (...) explicitly intercepts directly from the app root directory regardless of nesting.`,
    ["Deep Interception", "Route Groups", "Relative Pathing", "Root Interception", "(...)"],
    [
      { title: "Next.js Docs: Intercepting Segments", url: "https://nextjs.org/docs/app/building-your-application/routing/intercepting-routes" }
    ],
    "Does a Route Group folder like `(shop)` count as a directory level when writing `(..)` interception routes?",
    "No! Route groups are virtual organization containers that do not participate in the URL structure. When calculating relative hops (`(..)`, `(..)(..)`), Next.js skips parenthesized folders."
  ),

  card(
    34,
    "Photo Feed & Modal Detail: The Instagram Pattern Walkthrough",
    "Parallel & Intercepting Routes",
    "Mastery",
    "The industry-standard 'Instagram Pattern' provides a grid of items on the main feed. Clicking an item intercepts the route to show a detail overlay modal while maintaining background feed state, and refreshing the browser displays the standalone post page.",
    `// Complete Instagram-style Architecture:
// 1. app/layout.tsx: Defines root layout with @modal slot.
// 2. app/@modal/default.tsx: Returns null.
// 3. app/page.tsx: Renders grid of photo thumbnails wrapped in <Link href="/photos/1">.
// 4. app/@modal/(.)photos/[id]/page.tsx: Intercepts click; renders modal overlay.
// 5. app/photos/[id]/page.tsx: Standalone photo page for direct visits and search engines.

// Resulting User Flow:
// User clicks Photo #1 -> Modal opens instantly; URL changes to /photos/1; scroll position preserved.
// User copies URL and sends to friend -> Friend opens URL and sees full standalone page.
// User presses Back button -> Modal closes; URL changes back to /; feed remains in place.`,
    ["Instagram Pattern", "Photo Feed", "Architecture Walkthrough", "UX Mastery", "Next.js Gallery"],
    [
      { title: "Vercel Nextgram Example", url: "https://github.com/vercel/nextgram" }
    ],
    "Why is the Instagram pattern considered a hallmark of modern web architecture?",
    "It merges the speed and fluid interactivity of single-page applications with the linkability, bookmarkability, and SEO transparency of traditional multi-page web architecture."
  ),

  card(
    35,
    "Intercepting API Routes vs Server Components",
    "Parallel & Intercepting Routes",
    "Deep Dive",
    "Intercepting Routes strictly intercept Page components, not Route Handlers (`route.ts`). If a folder contains both `route.ts` and `page.tsx`, `route.ts` handles API calls, while `page.tsx` handles UI navigations.",
    `// Disambiguation:
// app/api/orders/route.ts -> Handles GET/POST API fetch calls (Returns JSON)
// app/orders/page.tsx     -> Handles HTML browser rendering

// Intercepting Routes cannot intercept fetch() requests made from JavaScript.
// They strictly intercept Next.js client-side router transitions initiated via <Link> or router.push().`,
    ["Route Handlers", "route.ts", "API Interception", "Navigation Interception", "Disambiguation"],
    [
      { title: "Next.js Docs: Route Handlers", url: "https://nextjs.org/docs/app/building-your-application/routing/route-handlers" }
    ],
    "Can you use an Intercepting Route to intercept an external API call made with `window.fetch`?",
    "No. Intercepting Routes are exclusively part of the Next.js routing and UI layout engine. Network fetch requests are handled at the network transport layer or by API Route Handlers."
  ),

  card(
    36,
    "Parallel Routes Pitfalls: State Desynchronization & 404 Traps",
    "Parallel & Intercepting Routes",
    "Mastery",
    "The two most common pitfalls in Parallel Routes are: 1) forgetting `default.tsx`, causing hard-navigation 404 crashes, and 2) state desynchronization when one slot navigates to a sub-route while another slot remains pinned to old state.",
    `// Pitfall 1: Missing default.tsx in Slot Folders
// Symptom: Works in development when clicking around, but crashes with 404 in production on refresh.
// Fix: Always provide a default.tsx returning null or fallback UI in EVERY slot folder.

// Pitfall 2: Slot Desynchronization
// If Slot A navigates to /dashboard/settings/billing while Slot B expects /dashboard/overview,
// the layout props must account for disjoint sub-segments.
// Fix: Coordinate sub-routes using explicit URL query parameters (?tab=billing) or synchronize slots.`,
    ["Pitfalls", "404 Traps", "default.tsx", "Desynchronization", "Production Gotchas"],
    [
      { title: "Next.js Docs: Parallel Routes Troubleshooting", url: "https://nextjs.org/docs/app/building-your-application/routing/parallel-routes" }
    ],
    "What is the single most important rule to prevent 404 errors when using Parallel Routes?",
    "Always colocate a `default.tsx` file inside every parallel slot folder to guarantee Next.js has an explicit fallback component to render during hard page refreshes."
  )
];

module.exports = { cards };
