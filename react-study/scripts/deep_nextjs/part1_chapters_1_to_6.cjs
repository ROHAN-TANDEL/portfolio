const chapters = [
  {
    id: "next-deep-01",
    title: "The RSC Wire Protocol & React Flight Data Serialization Stream",
    category: "RSC & Compiler Architecture",
    readTimeMinutes: 28,
    overview: "React Server Components do not transmit raw HTML during client-side navigation. Instead, Next.js serializes components into the React Flight Protocol—a chunked stream combining virtual DOM representations, client component bundle pointers, and server data payloads. This masterclass decodes the Flight stream byte-by-byte.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        THE REACT FLIGHT WIRE PROTOCOL STREAM                      |
+-----------------------------------------------------------------------------------+
  [ SERVER COMPONENT TREE ]
            |
            | (React Flight Bundler & Serializer)
            v
  +-------------------------------------------------------------------------------+
  | FLIGHT STREAM CHUNKS (GET /dashboard?_rsc=19a2b)                             |
  |                                                                               |
  | M1:{"id":"./Chart.tsx","chunks":["client-chunk-12"],"name":"default"}         |
  | S2:{"title":"Q3 Metrics","revenue":4500000}                                   |
  | J0:["$","div",null,{"children":[                                              |
  |      ["$","h1",null,{"children":"Analytics"}],                                |
  |      ["$","$L1",null,{"data":"$@2"}]  <-- Points to Client Chunk M1 + Data S2 |
  |    ]}]                                                                        |
  +-------------------------------------------------------------------------------+
            |
            | (HTTP/2 or Chunked HTTP/1.1 Stream)
            v
  [ CLIENT BROWSER REACT RUNTIME ]
  - Parses J0 virtual DOM structure
  - Instantiates Client Component M1 from browser bundle cache
  - Hydrates M1 with server data S2 without re-fetching or reloading the page!
`,
    deepDive: `### 1. Why Plain HTML is Insufficient for Client Navigations
When a user clicks a \`<Link href="/dashboard">\` in a Next.js App Router application:
- If the server returned pure HTML, the browser would have to either perform a full document reload (destroying all client-side state, form inputs, video playback, and scroll positions) or discard the HTML and use a client-side JSON API.
- **The React Flight Protocol solves this duality**: It represents the rendered virtual DOM as an executable stream that React reconciles against the active browser DOM in real time.

### 2. Anatomy of the React Flight Stream
When inspecting an RSC network request (\`?_rsc=...\`), the payload consists of line-delimited message rows:
- **\`M\` (Module Reference)**: Declares a Client Component.
  \`\`\`
  M1:{"id":"./components/InteractiveCounter.tsx","chunks":["app/counter:44"],"name":"default"}
  \`\`\`
  Tells the browser: "Component slot \`1\` requires the client JavaScript chunk \`app/counter:44\`".
- **\`S\` (Serialized Data)**: Declares a shared serializable data model or symbol (e.g. \`S2:{"user":"Alice"}\`).
- **\`J\` (JSON Virtual DOM Tree)**: Declares the component hierarchy.
  \`\`\`json
  J0:["$","section",null,{"className":"p-4","children":[
    ["$","h2",null,{"children":"User Summary"}],
    ["$","$L1",null,{"initial":10}]
  ]}]
  \`\`\`
  Notice \`$L1\`: It directly references the Client Module \`M1\` defined earlier in the stream!

### 3. Client-Side Reconciliation Engine
When the browser receives the Flight stream:
1. It parses JSON tags line-by-line as chunks arrive over the network (streaming reconciliation).
2. It verifies whether the required client component chunks (\`M1\`) are already downloaded or prefetched.
3. It updates existing Server Component DOM nodes in place while preserving all local React state (\`useState\`, focus states) in active Client Components.`,
    edgeCasesAndPitfalls: [
      "Passing un-serializable objects (custom class prototypes, closures, Symbols) as props from Server to Client Components, throwing Flight serialization errors.",
      "Attempting to parse `_rsc` responses manually with `JSON.parse()`: Flight is a custom line-delimited streaming protocol, not standard JSON.",
      "Large serialized props bloating the Flight stream: passing an entire database record with 50 unused columns wastes bandwidth; always project down to required fields."
    ],
    keyTakeaways: [
      "The React Flight protocol is the streaming wire format that unifies server-rendered DOM with client interactivity.",
      "Client components are referenced as lightweight module hashes (`M`), keeping client bundles small.",
      "Flight stream reconciliation preserves client state across soft navigations without full page refreshes."
    ]
  },

  {
    id: "next-deep-02",
    title: "The 4-Tier Caching Architecture & Precise Invalidation Pipelines",
    category: "Caching & Revalidation",
    readTimeMinutes: 30,
    overview: "Next.js integrates four separate caching layers: Request Memoization, Data Cache, Full Route Cache, and Client Router Cache. This masterclass dives into the mechanics of each tier, multi-instance cache desynchronization, and atomic tag invalidation via revalidateTag.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        NEXT.JS 4-TIER CACHING PIPELINE                            |
+-----------------------------------------------------------------------------------+
  [ BROWSER RUNTIME ]
    ├── 1. Client Router Cache (In-memory, session-scoped, prefetched RSC payloads)
    │     (Cache Miss / Hard Reload)
    v
  [ SERVER RUNTIME ]
    ├── 2. Full Route Cache (Server-side static HTML + Flight payloads at build/ISR)
    │     (Cache Miss / Dynamic SSR)
    v
  [ DATA LAYER ]
    ├── 3. Request Memoization (React per-render pass deduplication for identical fetches)
    │     (Miss / First Fetch)
    v
    ├── 4. Data Cache (Persistent cross-request cache on disk/Redis across all users)
    │     (Miss / Revalidation Expired)
    v
  [ UPSTREAM DATA SOURCE: POSTGRESQL / REST API / STRIPE ]
`,
    deepDive: `### 1. Tier-by-Tier Dissection
1. **Request Memoization (React Runtime)**:
   - *Where*: Server memory during a single render pass.
   - *What*: Deduplicates identical \`GET fetch(url, options)\` calls. If 5 components call \`fetch('/api/user')\`, only 1 network call executes.
   - *Lifetime*: Cleared immediately after the request completes.
2. **Data Cache (Next.js Server)**:
   - *Where*: Disk (\`.next/cache/fetch-cache\`) or shared external key-value store (Redis).
   - *What*: Stores raw HTTP responses across requests, users, and deployments.
   - *Lifetime*: Persistent until invalidated via \`revalidateTag()\` or expired via \`next: { revalidate: N }\`.
3. **Full Route Cache (Next.js Server)**:
   - *Where*: Server filesystem/memory.
   - *What*: Stores pre-rendered static HTML and Flight payloads for static routes (\`○\`).
   - *Lifetime*: Persistent across requests until invalidated via \`revalidatePath()\`.
4. **Router Cache (Browser Client)**:
   - *Where*: Client browser JavaScript memory.
   - *What*: Stores visited and prefetched route segments.
   - *Lifetime*: Duration of the browser tab session (Next.js 15 defaults dynamic routes to 0s stale time).

### 2. The Invalidation Lifecycle: revalidateTag() Mechanics
When \`revalidateTag('catalog')\` is called inside a Server Action:
1. The server purges all entries in the Data Cache tagged with \`'catalog'\`.
2. Any Full Route Cache entry that depended on those data entries is marked as stale.
3. In the Server Action response, Next.js generates and streams the fresh Flight diff back to the client.
4. The client Router Cache is updated in-place with the fresh server data in a single roundtrip!`,
    edgeCasesAndPitfalls: [
      "Cache Poisoning: caching personalized user data (PII) in the shared Data Cache, serving User A's profile to User B (always use `cache: 'no-store'` for private data).",
      "Multi-container cache drift: running 10 Docker pods without a shared Redis CacheHandler causes `revalidateTag` to update only 1 pod while 9 pods serve stale data.",
      "Accidentally opting an entire page out of Full Route Cache by reading `cookies()` in a non-Suspense component."
    ],
    keyTakeaways: [
      "Request Memoization deduplicates within a single render; Data Cache persists across all users.",
      "Use `revalidateTag` for surgical data invalidation across multiple routes simultaneously.",
      "Deploy a custom Redis `CacheHandler` when self-hosting Next.js across multiple container instances."
    ]
  },

  {
    id: "next-deep-03",
    title: "Server Actions Security, CSRF Tokens & Closure Scope Leaks",
    category: "Security & Data Mutations",
    readTimeMinutes: 27,
    overview: "Server Actions are publicly accessible HTTP POST RPC endpoints. This masterclass analyzes the underlying transport security, Origin-vs-Host CSRF mitigation, input validation with Zod safeParse, and the cryptographic encryption of captured closure variables.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        SERVER ACTIONS SECURITY & ENCRYPTION                       |
+-----------------------------------------------------------------------------------+
  [ Client Browser Form ]
            |
            | HTTP POST /dashboard
            | Header: Next-Action: 4bf92f3577b34da6a3ce929d0e... (Action ID Hash)
            | Header: Origin: https://myapp.com (Checked against Host!)
            | Payload: Encrypted Closure Token + Form Body
            v
  +-------------------------------------------------------------------------------+
  | NEXT.JS SERVER ACTION RUNTIME                                                 |
  |                                                                               |
  | 1. CSRF Verification: Does Origin match Host? (If mismatch -> 403 Forbidden)  |
  | 2. Decrypt Closure Variables using private server build secret                |
  | 3. Execute Authentication Guard: Verify active session (auth())               |
  | 4. Execute Authorization Guard: Check row-level ownership in database         |
  | 5. Validate input payload using Zod safeParse()                               |
  | 6. Perform Database Mutation -> Trigger revalidatePath()                      |
  +-------------------------------------------------------------------------------+
`,
    deepDive: `### 1. The Public Endpoint Reality of Server Actions
Every function annotated with \`"use server"\` is compiled into a public HTTP POST endpoint assigned an action ID hash.
- **The Threat**: Attackers can extract this action ID from client bundles and invoke the action directly via cURL or automated scripts without visiting your UI.
- **The Golden Rule**: Server Actions must be secured with the same rigor as public REST/GraphQL APIs. Never assume the caller is authenticated or passed valid input.

### 2. Built-in CSRF Mitigation
Next.js implements native Cross-Site Request Forgery (CSRF) defense for all Server Actions:
- For every incoming Server Action POST request, Next.js inspects the \`Origin\` and \`Referer\` headers against the \`Host\` header.
- If a malicious third-party site (\`evil.com\`) attempts to trigger a Server Action via a forged form post, the \`Origin\` header mismatch causes Next.js to reject the request immediately with HTTP 403 Forbidden.

### 3. Closure Variable Encryption & Scoping
When an inline Server Action captures variables from its parent Server Component:
\`\`\`typescript
export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  
  async function deleteAction() {
    "use server";
    await db.post.delete({ where: { id } }); // 'id' captured in closure!
  }
}
\`\`\`
- Next.js serializes the captured \`id\` variable and **encrypts it using a cryptographic key generated at build time**.
- The encrypted token is embedded in the form's hidden input or client reference.
- When submitted, the server decrypts the token to restore the bound variables, preventing client-side parameter tampering.`,
    edgeCasesAndPitfalls: [
      "Insecure Direct Object Reference (IDOR): deleting or modifying a record based on an ID passed from the client without verifying user ownership in the database.",
      "Hosting behind reverse proxies with mismatched Host headers: if Nginx fails to forward `Host` and `X-Forwarded-Host`, CSRF checks will fail with false positive 403 errors.",
      "Throwing uncaught raw exceptions in Server Actions, triggering client Error Boundaries instead of returning structured `{ success: false, error }` results."
    ],
    keyTakeaways: [
      "Server Actions are public POST endpoints; always verify authentication and record ownership.",
      "Next.js protects Server Actions against CSRF by enforcing Origin-Host header equality.",
      "Closure variables captured by inline Server Actions are encrypted at build time to prevent tampering."
    ]
  },

  {
    id: "next-deep-04",
    title: "Partial Prerendering (PPR): Static Shell with Dynamic Holes",
    category: "Rendering Lifecycle & PPR",
    readTimeMinutes: 29,
    overview: "Partial Prerendering (PPR) unites static CDN caching and dynamic server rendering within the exact same route. This masterclass examines the compiler architecture behind PPR, the static shell extraction pipeline, and dynamic Suspense hole streaming.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        PARTIAL PRERENDERING (PPR) ARCHITECTURE                    |
+-----------------------------------------------------------------------------------+
  [ BUILD COMPILER: next build ]
  - Scans component tree for <Suspense> boundaries
  - Compiles everything OUTSIDE Suspense into static HTML shell -> Uploads to CDN
  - Replaces dynamic Suspense children with fallback skeleton templates

  [ USER REQUEST LIFECYCLE ]
  Step 1 (T=15ms): CDN instantly serves static HTML shell!
  +-------------------------------------------------------------------------------+
  | STATIC SHELL (Navigation, Title, Hero, Layout)                                |
  |                                                                               |
  | [ HOLE 1: <Suspense fallback={<CartSkeleton />}> ] <== Streams real-time cart |
  | [ HOLE 2: <Suspense fallback={<RecsSkeleton />}> ] <== Streams recommendations|
  +-------------------------------------------------------------------------------+
  Step 2 (T=150ms): Server holds stream open, resolves async queries,
                    and flushes dynamic HTML replacements directly into holes!
`,
    deepDive: `### 1. The Historical Dichotomy: SSG vs SSR
For a decade, web architecture forced a binary compromise:
- **Static Generation (SSG)**: Fast Time-to-First-Byte (TTFB < 20ms) via globally distributed edge CDNs, but completely incapable of personalizing content or reading user cookies.
- **Server-Side Rendering (SSR)**: Capable of full personalization, but slow TTFB (200ms–800ms) because edge CDNs cannot cache the page and the server must wait on the slowest database query before sending any HTML.

### 2. The Partial Prerendering Revolution
Partial Prerendering eliminates this compromise without requiring new APIs:
- **Zero New Syntax**: PPR is driven entirely by standard React 18/19 \`<Suspense>\` boundaries.
- **Build Time Compilation**:
  - The Next.js build compiler evaluates the route.
  - Components that access dynamic APIs (\`cookies()\`, \`headers()\`, live database calls) must be wrapped in \`<Suspense>\`.
  - Next.js renders the fallback UI (e.g. \`<Skeleton />\`) into the pre-compiled static HTML document.
  - The static shell is deployed to edge CDNs worldwide.
- **Request Time Execution**:
  - The edge CDN serves the static shell immediately in ~15ms.
  - Concurrently, the server runtime initiates execution of the dynamic components inside the Suspense boundaries.
  - As each dynamic component resolves, its HTML and Flight payload stream over the same persistent HTTP connection, popping into the pre-rendered holes with zero layout shift.`,
    edgeCasesAndPitfalls: [
      "Accessing dynamic functions (`cookies()`, `headers()`) outside a `<Suspense>` boundary, which de-optimizes the entire page and causes build compiler warnings.",
      "Forgetting to specify fallback skeletons that match the exact pixel height of dynamic components, causing Cumulative Layout Shift (CLS) when dynamic holes stream in.",
      "Over-fragmenting Suspense boundaries: wrapping 20 individual text spans in separate Suspense tags causes micro-streaming overhead and visual jitter."
    ],
    keyTakeaways: [
      "PPR serves a static HTML shell from edge CDNs in 15ms while streaming dynamic components into Suspense holes.",
      "PPR requires zero new syntax; it is powered entirely by standard React `<Suspense>` boundaries.",
      "Adopt incrementally in Next.js 15 using `experimental: { ppr: 'incremental' }` in `next.config.js`."
    ]
  },

  {
    id: "next-deep-05",
    title: "Streaming SSR with React Suspense & Progressive Selective Hydration",
    category: "RSC & Compiler Architecture",
    readTimeMinutes: 28,
    overview: "Streaming SSR transforms monolithic HTML rendering into progressive chunk delivery. This masterclass analyzes the HTTP transfer encoding mechanics, inline script template swaps, and React's Selective Hydration engine prioritizing interactive components on user clicks.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        STREAMING SSR & SELECTIVE HYDRATION                        |
+-----------------------------------------------------------------------------------+
  SERVER STREAM                                       BROWSER DOM
  =============                                       ===========
  1. Flush <head>, layout, and shell               -> [ Shell Renders in 20ms ]
  2. Flush <div id="P1">Fallback Skeleton</div>    -> [ Skeleton Visible ]
  3. Async DB query for Feed resolves...
  4. Flush <div hidden id="S1">Real Content</div>  -> [ Content received in hidden div ]
  5. Flush <script>$RC("P1", "S1")</script>        -> [ Script replaces P1 with S1! ]
                                                            |
                                                            v
                                                   [ SELECTIVE HYDRATION ]
  (If user clicks Feed before Sidebar JS downloads, React prioritizes hydrating Feed!)
`,
    deepDive: `### 1. Chunked Transfer Encoding Mechanics
Traditional SSR buffers the entire HTML string in server memory and sends it in a single response. If a recommendation widget takes 2 seconds, the user stares at a blank white screen for 2 seconds.
- **Streaming SSR** uses HTTP \`Transfer-Encoding: chunked\`.
- The server flushes initial HTML chunks immediately: the \`<head>\`, stylesheets, root layout, and Suspense fallback skeletons.
- The browser parses CSS and renders the layout shell in under 50ms.

### 2. The DOM Replacement Mechanism: \`$RC()\`
How does the browser replace the loading skeleton with real content when the server finishes rendering later?
1. Next.js renders the fallback skeleton inside an element marked with an ID: \`<div id="P:1">...skeleton...</div>\`.
2. When the dynamic async component finishes rendering on the server, Next.js flushes a hidden container at the bottom of the stream: \`<div hidden id="S:1">...real rendered HTML...</div>\`.
3. Immediately following the container, Next.js flushes a tiny inline JavaScript call:
   \`\`\`html
   <script>$RC("B:1", "S:1")</script>
   \`\`\`
4. The browser executes \`$RC()\` (React Container Replacement), swapping the real content into position with zero layout shift, all before client-side hydration even begins!

### 3. Progressive Selective Hydration
In traditional React, hydration is all-or-nothing: the browser must download all JavaScript for the entire page before any button becomes clickable.
- With **Selective Hydration**, React treats each Suspense boundary as an independent hydration island.
- As soon as the client JavaScript chunk for a specific boundary downloads, React hydrates it independently.
- **User Interaction Priority**: If a user clicks a button inside \`<Comments>\` while \`<Sidebar>\` is still hydrating, React pauses sidebar hydration, immediately prioritizes hydrating \`<Comments>\`, and replays the user's click event seamlessly!`,
    edgeCasesAndPitfalls: [
      "Hydration Mismatch Errors: HTML rendered by server differing from client DOM (e.g. using `new Date().toLocaleTimeString()` or `window.innerWidth` during initial render).",
      "Streaming blocked by buffering reverse proxies: Nginx or corporate firewalls configured with `proxy_buffering on` holding stream chunks until the response completes (set `X-Accel-Buffering: no`).",
      "Blocking rendering outside Suspense: placing an un-cached `await fetch()` in the top-level layout blocks streaming for the entire application."
    ],
    keyTakeaways: [
      "Streaming SSR flushes initial layout shells in 20ms and streams dynamic components progressively.",
      "The `$RC` inline script swaps server-streamed content into Suspense placeholders before hydration.",
      "Selective Hydration prioritizes hydrating components the user actively clicks, eliminating UI freezes."
    ]
  },

  {
    id: "next-deep-06",
    title: "Advanced Parallel & Intercepting Routes State Machine",
    category: "Routing & Architecture",
    readTimeMinutes: 29,
    overview: "Parallel and Intercepting Routes create sophisticated multi-view layouts and modal state machines. This masterclass examines the state transitions between soft and hard navigations, slot matching algorithms, and deep nesting across Route Groups.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                     PARALLEL & INTERCEPTING ROUTES STATE MACHINE                  |
+-----------------------------------------------------------------------------------+
  STATE 1: USER BROWSING FEED (/feed)
  - Layout renders: children (Feed Grid) + @modal (default.tsx -> null)

  STATE 2: USER CLICKS PHOTO #42 (<Link href="/photos/42">) [SOFT NAVIGATION]
  - Intercepting route triggered: app/@modal/(.)photos/[id]/page.tsx
  - Layout renders: children (Feed Grid PERSISTS!) + @modal (Active Modal Overlay!)
  - URL updates to: /photos/42

  STATE 3A: USER PRESSES 'ESC' OR BACK (router.back())
  - Navigation pops history stack -> URL reverts to: /feed
  - @modal resets to default.tsx (null) -> Modal vanishes cleanly!

  STATE 3B: USER REFRESHES (F5) OR SHARES LINK [HARD NAVIGATION]
  - Interception bypasses! Next.js renders: app/photos/[id]/page.tsx
  - User sees standalone full-page view with complete SEO metadata!
`,
    deepDive: `### 1. The Slot Matching Algorithm
When navigating client-side, Next.js performs partial rendering:
- It matches incoming URL segments against parallel route slot folders (\`@slotName\`).
- If a slot contains a sub-path matching the URL, it renders that sub-segment.
- If a slot does NOT match the URL segment during a **soft navigation**, Next.js retains the slot's currently active view from the client Router Cache.
- If a slot does NOT match during a **hard navigation** (direct load or refresh), Next.js cannot guess what to render and looks for \`default.tsx\`. If \`default.tsx\` is missing, Next.js throws a 404!

### 2. Relative Interception Syntax Rules
- **\`(.)\`**: Intercepts segments on the **same level**.
  - \`app/feed/@modal/(.)photo/[id]\` intercepts \`app/feed/photo/[id]\`.
- **\`(..)\`**: Intercepts segments **one level above**.
  - \`app/feed/@modal/(..)photo/[id]\` intercepts \`app/photo/[id]\`.
- **\`(..)(..)\`**: Intercepts segments **two levels above**.
- **\`(...)\`**: Intercepts segments directly from the **app root directory**, regardless of depth.
- **Route Group Immunity**: Parenthesized Route Groups (e.g. \`(shop)\`, \`(marketing)\`) do NOT count as directory levels when calculating relative hops.

### 3. Building Enterprise Modals with URL Synchronization
Traditional modals rely on React state (\`isModalOpen: true\`), creating major UX deficiencies: the modal cannot be bookmarked, refreshing the page closes the modal, and pressing the browser Back button exits the entire website.
- Intercepting Routes give modals real URLs (\`/photos/123\`).
- The modal is bookmarkable, shareable, and responsive to the browser's native Back/Forward buttons while keeping background page state intact.`,
    edgeCasesAndPitfalls: [
      "Hard navigation 404 crash: forgetting to provide a `default.tsx` returning `null` in the `@modal` slot folder.",
      "Calling `router.back()` when a user lands on the modal directly: if `history.length === 1`, `router.back()` has nowhere to go (always provide a fallback `router.push('/feed')`).",
      "Incorrect relative level calculation: counting parenthesized Route Group folders as directory levels when writing `(..)`."
    ],
    keyTakeaways: [
      "Parallel routes render multiple autonomous sub-trees; Intercepting routes capture target URLs.",
      "Always provide `default.tsx` in every parallel slot to prevent hard-navigation 404s.",
      "Intercepting routes provide shareable URLs for modals without losing background page context."
    ]
  }
];

module.exports = { chapters };
