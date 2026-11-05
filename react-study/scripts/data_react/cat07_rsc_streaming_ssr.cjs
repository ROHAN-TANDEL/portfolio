const { createCard } = require('../react_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 73,
    category: "React Server Components, Streaming SSR & Selective Hydration",
    concept: "Server Components vs Client Components",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the fundamental difference between React Server Components (RSC) and Client Components?",
    quickAnswer: "Server Components execute strictly on the server, have direct access to backend resources (databases, filesystem), and send zero JavaScript to the client browser. Client Components are declared with `'use client'`, execute on both server (for SSR) and client, and include their JavaScript bundle for interactivity.",
    detailedAnswer: "In the RSC paradigm, all components are Server Components by default. They can query databases, read environment secrets, and use large server libraries (like Markdown parsers or syntax highlighters) without bloating the client bundle. Client Components (`'use client'`) are only needed when using browser APIs (`window`, `localStorage`), event listeners (`onClick`, `onChange`), or stateful React hooks (`useState`, `useEffect`, `useReducer`).",
    code: `// 1. Server Component (default): Direct database access, ZERO client JS!
// import 'server-only';
import db from '@/lib/db';

export default async function ProductPage({ params }) {
  // Directly query database without internal API routes!
  const product = await db.products.findUnique({ where: { id: params.id } });

  return (
    <div>
      <h1>{product.name}</h1>
      <p>{product.description}</p>
      {/* Leaves of interactivity use Client Components */}
      <AddToCartButton productId={product.id} />
    </div>
  );
}

// 2. Client Component (AddToCartButton.jsx):
'use client';
import { useState } from 'react';

export function AddToCartButton({ productId }) {
  const [added, setAdded] = useState(false);
  return <button onClick={() => setAdded(true)}>{added ? 'Added!' : 'Add to Cart'}</button>;
}`,
    recallHint: "Server Components = default, runs only on server, zero client bundle, direct DB access; Client Components = 'use client', handles interactivity.",
    interviewTip: "Dispel the common myth that Client Components run ONLY on the client: Client Components still pre-render on the server during initial SSR to generate initial HTML!",
    tags: ["rsc", "server-components", "client-components", "architecture"],
    practice: [
      "Can a Server Component import a Client Component? Can a Client Component import a Server Component directly?",
      "Why do Client Components still execute on the server during initial page load?"
    ]
  }),

  createCard({
    idNum: 74,
    category: "React Server Components, Streaming SSR & Selective Hydration",
    concept: "The Zero-Bundle-Size Principle",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do React Server Components achieve 'zero client bundle size' for server dependencies?",
    quickAnswer: "Dependencies imported by Server Components (such as heavy Markdown parsers, date formatters, and database drivers) remain exclusively on the server. Only the rendered HTML and data payload are streamed to the browser, completely excluding their npm packages from client bundles.",
    detailedAnswer: "In traditional SPAs, if a component rendered sanitized markdown using a 200KB library like `marked` or `sanitize-html`, that 200KB was packaged by Webpack/Vite and downloaded by every user. In a Server Component, `marked` runs on the server CPU to generate the virtual elements. The client receives the serialized virtual DOM nodes without downloading a single byte of the `marked` library, dramatically accelerating page load times on mobile devices.",
    code: `// Server Component:
// 100KB date-fns library + 250KB marked parser
import { formatDistanceToNow } from 'date-fns';
import { marked } from 'marked';

export default function Article({ content, publishedAt }) {
  // Executes on server in 2ms:
  const html = marked.parse(content);
  const timeAgo = formatDistanceToNow(new Date(publishedAt));

  // The client bundle size for these 350KB libraries is 0 KB!
  return (
    <div>
      <time>{timeAgo} ago</time>
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}`,
    recallHint: "Server Component npm dependencies stay on the server; client receives 0 KB of their package code.",
    interviewTip: "Emphasize the impact on First Load JS and Core Web Vitals: mobile users on slow cellular networks experience lightning-fast page interaction without waiting for megabytes of JS parsing.",
    tags: ["zero-bundle", "bundle-size", "rsc", "performance"],
    practice: [
      "How do Server Components improve First Contentful Paint (FCP) and Time to Interactive (TTI)?",
      "What happens if a Server Component accidentally imports a client-only module like `window`?"
    ]
  }),

  createCard({
    idNum: 75,
    category: "React Server Components, Streaming SSR & Selective Hydration",
    concept: "The 'use client' Directive Contract",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What does the `'use client'` directive actually do, and where does it need to be placed in an application?",
    quickAnswer: "`'use client'` marks the boundary between the server and client component module graph. It does NOT need to be at the top of every file—only at the entry points where interactivity (hooks, event listeners) begins.",
    detailedAnswer: "Adding `'use client'` at the top of a file signals to the bundler (Next.js, Vite) that this file and all of its imported children should be packaged into the client JavaScript bundle. All components imported by a `'use client'` file automatically become Client Components. Therefore, best practice is to push the `'use client'` boundary as far down the component tree as possible (to the leaf nodes), keeping parent layouts and data wrappers as Server Components.",
    code: `// Leaf Component: Only the button needs 'use client'!
'use client';
import { useState } from 'react';

export function UpvoteButton({ initialVotes }) {
  const [votes, setVotes] = useState(initialVotes);
  return <button onClick={() => setVotes(v => v + 1)}>👍 {votes}</button>;
}

// Parent Page (NO 'use client' directive needed! Remains a Server Component):
import db from '@/lib/db';
import { UpvoteButton } from './UpvoteButton';

export default async function Page() {
  const post = await db.posts.findFirst();
  return (
    <div>
      <h1>{post.title}</h1>
      <UpvoteButton initialVotes={post.votes} />
    </div>
  );
}`,
    recallHint: "'use client' defines the server-client boundary; push it to the leaves of the tree to minimize bundle size.",
    interviewTip: "Correct the common misconception that `'use client'` turns off SSR: Client Components still render on the server during initial HTML generation; the directive merely adds them to the hydration bundle.",
    tags: ["use-client", "boundaries", "bundler", "architecture"],
    practice: [
      "If Component A has `'use client'` and imports Component B (without any directive), is Component B a server or client component?",
      "Why is putting `'use client'` at the root layout considered a catastrophic architectural mistake?"
    ]
  }),

  createCard({
    idNum: 76,
    category: "React Server Components, Streaming SSR & Selective Hydration",
    concept: "Component Interleaving & Passing Server Components as Children",
    priority: "must-know",
    difficulty: "advanced",
    question: "How can a Client Component wrap or render a Server Component without converting it into a Client Component?",
    quickAnswer: "Pass the Server Component as `children` or as a prop (slot) to the Client Component from a parent Server Component, rather than importing the Server Component directly into the Client Component file.",
    detailedAnswer: "If a Client Component imports a Server Component directly (`import ServerComp from './ServerComp'`), the bundler pulls `ServerComp` across the boundary, converting it into a Client Component (and failing if it accesses server resources). However, a Client Component CAN accept pre-rendered React nodes as `props.children`. The parent Server Component renders the child Server Component on the server, and passes the resulting rendered element stream to the Client Component container.",
    code: `// 1. Client Component: Acts as an interactive layout/collapse container
'use client';
import { useState } from 'react';

export function CollapsibleSection({ title, children }) {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>{title}</button>
      {/* 'children' is a pre-rendered Server Component! */}
      {isOpen && <div className="content">{children}</div>}
    </div>
  );
}

// 2. Parent Server Component (interleaves both seamlessly):
import db from '@/lib/db';
import { CollapsibleSection } from './CollapsibleSection';

export default async function Dashboard() {
  const secretAnalytics = await db.analytics.getHeavyReport();

  return (
    <CollapsibleSection title="Internal Analytics">
      {/* Runs on server, zero client bundle, wrapped by interactive client container! */}
      <ServerAnalyticsTable data={secretAnalytics} />
    </CollapsibleSection>
  );
}`,
    recallHint: "Pass Server Components as children/props to Client Components to preserve zero-bundle server rendering.",
    interviewTip: "This is a premier senior React architecture pattern: using composition slots (`children`) to interleave interactive client containers with heavy server-rendered subtrees.",
    tags: ["interleaving", "composition", "slots", "rsc-patterns"],
    practice: [
      "Why does direct import of a server component inside a client component fail?",
      "How does the React Fiber tree represent server component children inside a client parent?"
    ]
  }),

  createCard({
    idNum: 77,
    category: "React Server Components, Streaming SSR & Selective Hydration",
    concept: "Server-Client Boundary Serialization Rules",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What types of props can and cannot be passed across the Server-to-Client component boundary, and why?",
    quickAnswer: "Props passed across the boundary must be serializable (primitives, plain objects, arrays, Date, Map, Set, Promises, or JSX elements). Functions, class instances, Symbols, and DOM nodes CANNOT be passed.",
    detailedAnswer: "Server Components and Client Components run in distinct environments (potentially across physical network boundaries in future distributed architectures). Props passed from a Server Component to a Client Component must be serialized into the RSC wire format stream. Passing a raw function (e.g. `onSearch={handleSearch}`) from a Server Component fails because functions cannot be serialized into JSON-compatible wire protocols without security and closure reference hazards. (Server Actions with `'use server'` are the only exception).",
    code: `// Server Component:
export default async function ServerPage() {
  const user = await db.users.findFirst();

  // VALID SERIALIZABLE PROPS:
  // - Strings, numbers, booleans
  // - Plain objects and arrays
  // - Dates, BigInts, Sets, Maps
  // - React elements / JSX (<Badge />)
  // - Server Actions ('use server')

  // FORBIDDEN PROPS (Throws serialization error!):
  // - Non-action functions: onClick={() => console.log('hi')}
  // - Class instances: new CustomUserClass()
  // - Symbols

  return <ClientCard profile={{ id: user.id, joinedAt: user.createdAt }} />;
}`,
    recallHint: "Props across server-to-client boundary MUST be serializable; no plain functions or class instances.",
    interviewTip: "Highlight that React's wire serializer natively handles `Date`, `BigInt`, `Map`, `Set`, and `Promise`—it is more powerful than standard `JSON.stringify`.",
    tags: ["serialization", "props", "boundaries", "rsc-wire-format"],
    practice: [
      "Why can Server Actions with 'use server' be passed across the boundary when normal functions cannot?",
      "How can you pass a Promise from a Server Component to a Client Component using React 19's `use()` hook?"
    ]
  }),

  createCard({
    idNum: 78,
    category: "React Server Components, Streaming SSR & Selective Hydration",
    concept: "RSC Wire Format & Payload Streaming",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the RSC Wire Format (RSC Payload) and how does React stream virtual DOM trees over HTTP without sending raw HTML?",
    quickAnswer: "The RSC Payload is a compact, line-by-line JSON-like stream of serialized React elements and data chunks. It describes the virtual DOM tree, references to client component chunks (`$L1`), and streaming slots (`$@2`) so the client can reconcile state without full page refreshes.",
    detailedAnswer: "When navigating between pages in an RSC framework, the browser does not request a full HTML document. Instead, it requests the RSC payload stream. Each line in the stream represents a chunk: client component module references (`M`), serialized element trees (`J`), or suspended promise data (`P`). The client-side React reconciler parses this stream on-the-fly and seamlessly merges the new server component tree into the existing client DOM, preserving client state and scroll position.",
    code: `// Conceptual snippet of an RSC wire stream:
// 1:M{"id":"./src/components/LikeButton.client.js","name":"LikeButton"}
// 2:J["$","div",null,{"children":[["$","h1",null,{"children":"Post Title"}],["$","$L1",null,{"postId":42}]]}]
// 3:P{"commentsPromise":["$@4"]}

// Breakdown:
// - Line 1 (M): Module reference to client component bundle
// - Line 2 (J): Serialized JSX tree containing native tags and client component reference ($L1)
// - Line 3 (P): Suspended promise stream that will resolve later down the wire`,
    recallHint: "RSC payload = compact serialized virtual DOM stream; allows updating server trees while preserving client state.",
    interviewTip: "Contrast this with traditional JSON REST APIs: REST APIs require custom client code to map JSON into UI components; RSC streams the actual virtual element structure directly, eliminating client-side data-wrangling code.",
    tags: ["rsc-payload", "wire-format", "streaming", "internals"],
    practice: [
      "Why doesn't RSC just send raw HTML over the wire during client-side navigation?",
      "How does the RSC wire format allow preserving client component state (e.g. input focus) during server page navigation?"
    ]
  }),

  createCard({
    idNum: 79,
    category: "React Server Components, Streaming SSR & Selective Hydration",
    concept: "Streaming SSR with renderToPipeableStream",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Streaming SSR with `renderToPipeableStream` and how does it solve the 'all-or-nothing' limitation of legacy `renderToString`?",
    quickAnswer: "`renderToString` blocked the server until the entire page and all data fetches finished before sending a single byte of HTML. `renderToPipeableStream` streams the initial HTML shell immediately, and streams delayed component chunks and fallback replacements as they resolve.",
    detailedAnswer: "In classic SSR (`renderToString`), if a comments widget took 3 seconds to fetch, the entire page TTFB (Time to First Byte) was delayed by 3 seconds, leaving users with a blank browser screen. In React 18+ Streaming SSR, the server immediately flushes the document `<head>`, navigation bar, and main layout to the browser, wrapping slow sections in `<Suspense fallback={<Skeleton/>}>`. When the comments finish, React streams an inline `<script>` tag and HTML chunk that swaps the skeleton with the real content directly in the browser DOM.",
    code: `// Node.js server streaming implementation:
import { renderToPipeableStream } from 'react-dom/server';

app.get('/', (req, res) => {
  const { pipe } = renderToPipeableStream(<App />, {
    bootstrapScripts: ['/main.js'],
    onShellReady() {
      // Send initial HTML shell (headers, navbar, skeletons) immediately!
      res.setHeader('content-type', 'text/html');
      pipe(res);
    },
    onShellError(error) {
      res.status(500).send('<h1>Server Error</h1>');
    }
  });
});`,
    recallHint: "renderToString blocked until everything finished; renderToPipeableStream streams HTML shell immediately + streams suspended chunks.",
    interviewTip: "Explain how streaming SSR dramatically improves TTFB (Time to First Byte) and FCP (First Contentful Paint), which are critical Google Search Core Web Vitals.",
    tags: ["streaming-ssr", "renderToPipeableStream", "web-vitals", "ttfb"],
    practice: [
      "What is the difference between `onShellReady` and `onAllReady` in renderToPipeableStream?",
      "How does streaming SSR deliver delayed HTML chunks to browsers without requiring JavaScript execution?"
    ]
  }),

  createCard({
    idNum: 80,
    category: "React Server Components, Streaming SSR & Selective Hydration",
    concept: "Selective Hydration & Interaction Prioritization",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Selective Hydration and how does React prioritize hydrating components that the user actively clicks on?",
    quickAnswer: "Selective Hydration hydrates parts of the page independently as their code loads, rather than blocking the whole page. If a user clicks an unhydrated component wrapped in `<Suspense>`, React prioritizes hydrating that specific subtree immediately to respond to the click.",
    detailedAnswer: "In traditional React, hydration was a monolithic, blocking process: the browser downloaded the entire JavaScript bundle and hydrated every component on the page synchronously. If the page was huge, the main thread was locked for hundreds of milliseconds. With React 18 Selective Hydration, `<Suspense>` boundaries split hydration into discrete chunks. If a user clicks a button in an unhydrated Comment section, React intercepts the click, synchronously hydrates the Comment component first, and replays the user's click event seamlessly.",
    code: `function ArticlePage() {
  return (
    <div>
      <Navbar /> {/* Hydrates first */}
      <ArticleContent />
      
      {/* Heavy comments hydrated independently: */}
      <Suspense fallback={<CommentsSkeleton />}>
        <CommentsList />
      </Suspense>

      {/* If user clicks inside RelatedArticles before Comments hydrates, 
          React pauses Comments and hydrates RelatedArticles FIRST! */}
      <Suspense fallback={<RelatedSkeleton />}>
        <RelatedArticles />
      </Suspense>
    </div>
  );
}`,
    recallHint: "Selective Hydration hydrates Suspense chunks independently; user clicks reprioritize hydration to handle interaction immediately.",
    interviewTip: "Mention that React captures the user's click event in the capture phase, holds it while hydrating the target component, and replays it so the user never experiences a 'dead click'.",
    tags: ["selective-hydration", "suspense", "event-replay", "concurrency"],
    practice: [
      "How does React replay user clicks that occurred before a component was hydrated?",
      "Why does monolithic hydration create poor Interaction to Next Paint (INP) scores?"
    ]
  }),

  createCard({
    idNum: 81,
    category: "React Server Components, Streaming SSR & Selective Hydration",
    concept: "Server Actions & RPC Architecture",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Server Actions work under the hood, and what security precautions are essential when using the `'use server'` directive?",
    quickAnswer: "Server Actions are asynchronous functions marked with `'use server'` that execute exclusively on the server. Bundlers generate a hidden POST endpoint (RPC), allowing client components to invoke server functions like normal JavaScript calls. Security requires treating action arguments as untrusted user input.",
    detailedAnswer: "When you mark a function or file with `'use server'`, the build tool generates a unique cryptographically hashed action ID and exposes an internal HTTP POST endpoint. When invoked from a client component, React makes a `POST` request sending serialized arguments. Because this endpoint is publicly accessible on the internet, developers MUST authenticate the user, authorize permissions, and validate input arguments (e.g. using Zod) inside the action body.",
    code: `// actions.js: Server Action module
'use server';
import { auth } from '@/lib/auth';
import db from '@/lib/db';
import { z } from 'zod';

const schema = z.object({ email: z.string().email() });

export async function updateEmailAction(formData) {
  // 1. Mandatory Authentication Check!
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  // 2. Mandatory Input Validation!
  const rawEmail = formData.get('email');
  const { email } = schema.parse({ email: rawEmail });

  // 3. Database mutation
  await db.users.update({
    where: { id: session.user.id },
    data: { email }
  });

  return { success: true };
}`,
    recallHint: "'use server' exposes an internal HTTP POST RPC endpoint; ALWAYS authenticate and validate input inside action!",
    interviewTip: "Emphasize security: never trust arguments passed to Server Actions! An attacker can craft arbitrary HTTP POST requests targeting your server action IDs bypassing client UI validations.",
    tags: ["server-actions", "use-server", "security", "rpc"],
    practice: [
      "Why is client-side form validation insufficient when using Server Actions?",
      "How does React handle CSRF (Cross-Site Request Forgery) protection with Server Actions?"
    ]
  }),

  createCard({
    idNum: 82,
    category: "React Server Components, Streaming SSR & Selective Hydration",
    concept: "Eliminating Request Waterfalls with RSC",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do React Server Components eliminate the client-side data-fetching waterfalls common in traditional SPAs?",
    quickAnswer: "In traditional SPAs, parent components fetch data in `useEffect`, render children, which then trigger their own `useEffect` fetches (creating multi-roundtrip network waterfalls). RSC executes all fetches directly in the server datacenter with sub-millisecond database latency in a single roundtrip.",
    detailedAnswer: "In an SPA, the browser downloads the JS bundle -> renders Page -> fetches User (100ms) -> renders Feed -> fetches Posts (100ms) -> renders Comments -> fetches Comments (100ms) = 300ms of high-latency mobile network roundtrips. In RSC, component functions are async and execute collocated on the server rack where database queries take 0.5ms. The entire tree resolves before streaming to the client, collapsing a 300ms mobile waterfall into a single fast stream.",
    code: `// Traditional SPA Waterfall (Client-side):
// Browser -> fetch(/api/user) -> (wait 150ms)
// Browser -> fetch(/api/posts) -> (wait 150ms)
// Browser -> fetch(/api/comments) -> (wait 150ms) = 450ms!

// RSC Co-located Server Execution:
export default async function FeedPage() {
  // Parallel server fetches with direct DB connection:
  const [user, posts] = await Promise.all([
    db.users.getCurrentUser(),
    db.posts.getFeed()
  ]);

  return <FeedView user={user} posts={posts} />;
}`,
    recallHint: "SPA useEffect fetches create mobile network waterfalls; RSC executes data fetching on server near DB in 1 roundtrip.",
    interviewTip: "Highlight the use of `Promise.all` inside Server Components to parallelize independent data queries, preventing accidental waterfalls even on the server.",
    tags: ["waterfalls", "data-fetching", "rsc", "performance"],
    practice: [
      "How can accidental waterfalls occur inside Server Components if you write consecutive awaits?",
      "When should you split async Server Components into separate `<Suspense>` boundaries?"
    ]
  }),

  createCard({
    idNum: 83,
    category: "React Server Components, Streaming SSR & Selective Hydration",
    concept: "Preventing Secret Leakage with server-only Guard",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the `server-only` package in React Server Components and how does it prevent leaking database secrets into client bundles?",
    quickAnswer: "`import 'server-only'` throws a build-time compilation error if a developer accidentally imports a server utility module into a Client Component (`'use client'`), preventing database keys and proprietary code from leaking to the browser.",
    detailedAnswer: "In full-stack React frameworks, client and server code share the same project repository. If a developer accidentally imports a file containing `process.env.DATABASE_PRIVATE_KEY` or direct SQL queries into a Client Component, bundlers might attempt to bundle it, exposing private credentials to the world. Placing `import 'server-only'` at the top of backend modules guarantees that any attempt to import that file on the client halts the build immediately.",
    code: `// lib/db.js (Server Database Utility)
import 'server-only'; // Guaranteed build failure if imported in client code!
import { Pool } from 'pg';

export const db = new Pool({
  connectionString: process.env.DATABASE_SECRET_URL
});

// If someone writes in a Client Component:
// 'use client';
// import { db } from '@/lib/db';
//
// Build Error:
// You're importing a component that needs "server-only". 
// That only works in a Server Component which is not currently the case!`,
    recallHint: "import 'server-only' throws build error if server code is imported in client bundle; prevents secret leakage.",
    interviewTip: "Always mention `server-only` as an essential defense-in-depth security best practice for enterprise full-stack React architectures.",
    tags: ["server-only", "security", "secrets", "rsc"],
    practice: [
      "What is the client equivalent package (`client-only`) used for?",
      "Why don't standard linter rules completely prevent secret leakage across full-stack imports?"
    ]
  }),

  createCard({
    idNum: 84,
    category: "React Server Components, Streaming SSR & Selective Hydration",
    concept: "Static vs Dynamic Server Components & Caching",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does React determine if a Server Component is Static (pre-rendered at build time) or Dynamic (rendered on every incoming request)?",
    quickAnswer: "A Server Component is Static by default. It becomes Dynamic automatically if it uses dynamic functions (reading request headers, cookies, or URL search parameters) or opts out of data caching.",
    detailedAnswer: "Static Server Components are evaluated once at build time, and their generated RSC payload and HTML are stored on global CDN edge caches for near-zero latency delivery. The instant a component reads `cookies()`, `headers()`, or `searchParams`, React switches that component and its ancestors to Dynamic Rendering, executing on every incoming user request. Understanding this boundary is key to maintaining blazing fast CDN cache hit rates.",
    code: `// 1. STATIC SERVER COMPONENT (Built once, cached forever on CDN Edge):
export async function StaticProduct({ id }) {
  const product = await getCachedProduct(id);
  return <div>{product.title}</div>;
}

// 2. DYNAMIC SERVER COMPONENT (Runs on EVERY request):
import { cookies } from 'next/headers'; // Dynamic function triggers request-time rendering!

export async function DynamicDashboard() {
  const cookieStore = await cookies();
  const token = cookieStore.get('auth_token');
  const user = await fetchUser(token);
  return <div>Hello, {user.name}</div>;
}`,
    recallHint: "Server Components are Static by default; reading cookies(), headers(), or searchParams forces Dynamic per-request rendering.",
    interviewTip: "Explain how to preserve static generation by reading dynamic data (like search params) only in specific leaf components or client components, keeping parent marketing layouts statically cached on CDNs.",
    tags: ["static-vs-dynamic", "caching", "cdn", "rsc-rendering"],
    practice: [
      "How does Incremental Static Regeneration (ISR) update static server components in the background?",
      "Why should you isolate dynamic functions like `cookies()` to leaf components?"
    ]
  })
];
