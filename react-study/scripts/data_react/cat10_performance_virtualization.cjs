const { createCard } = require('../react_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 109,
    category: "Performance Optimization, Virtualization & Profiling",
    concept: "React DevTools Profiler & Flamegraphs",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you use the React DevTools Profiler to diagnose performance bottlenecks and identify 'Why Did This Component Render'?",
    quickAnswer: "Record a user interaction in React DevTools Profiler, inspect the Flamegraph or Ranked chart to find components with long render durations (yellow/orange bars), and enable 'Record why each component rendered while profiling' in settings.",
    detailedAnswer: "The React DevTools Profiler records render passes. In the Flamegraph view, each bar represents a component; wider bars indicate longer render times, and color represents commit duration. Grey components did not re-render. Selecting a component displays 'Why did this render?' with reasons like 'Props changed: [onSelect]', 'Hooks changed: [Hook 3]', or 'Parent component rendered'. This immediately pinpoints unstable callback references or un-memoized objects.",
    code: `// Profile programmatically in code using <Profiler>:
import { Profiler } from 'react';

function onRenderCallback(
  id, // the "id" prop of the Profiler tree that has just committed
  phase, // either "mount" or "update"
  actualDuration, // time spent rendering the committed update
  baseDuration, // estimated time to render the entire subtree without memoization
  startTime, // when React began rendering this update
  commitTime // when React committed this update
) {
  if (actualDuration > 16) { // Took longer than one 60 FPS frame (16.6ms)!
    console.warn(\`Slow render detected in [\${id}] during \${phase}: \${actualDuration}ms\`);
  }
}

function MonitoredApp() {
  return (
    <Profiler id="ProductCatalog" onRender={onRenderCallback}>
      <ProductCatalog />
    </Profiler>
  );
}`,
    recallHint: "React Profiler Flamegraph shows render times; check 'Why did this render' to spot changing props/hooks.",
    interviewTip: "Mention that the `<Profiler>` component is safe to leave in staging/canary environments to collect telemetry on real user device render latencies.",
    tags: ["profiler", "flamegraph", "devtools", "performance"],
    practice: [
      "What is the difference between actualDuration and baseDuration in the React Profiler?",
      "Why should you always test performance profiling on a production build rather than development?"
    ]
  }),

  createCard({
    idNum: 110,
    category: "Performance Optimization, Virtualization & Profiling",
    concept: "Virtualization & Windowing (react-window)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is DOM Virtualization (Windowing), and why is it mandatory when rendering lists with thousands of items?",
    quickAnswer: "Virtualization renders ONLY the small slice of items currently visible in the browser viewport (plus a tiny overscan buffer), dynamically reusing and swapping DOM nodes as the user scrolls, keeping DOM node count constant (~30 nodes instead of 100,000).",
    detailedAnswer: "Creating 50,000 real DOM nodes requires gigabytes of memory, freezes browser scrolling, and causes layout recalculations to take seconds. Virtualization calculates the user's scroll offset and container height, computes the visible item index range (e.g. rows 45 to 65), and positions only those 20 rows absolutely inside a tall scrollable spacer `<div>`. Libraries like `react-window` or `@tanstack/react-virtual` maintain buttery-smooth 60 FPS scrolling regardless of dataset size.",
    code: `import { FixedSizeList as List } from 'react-window';

const items = Array.from({ length: 50000 }, (_, i) => ({
  id: i,
  text: \`Transaction Record #\${i + 1}\`
}));

function VirtualizedTransactionList() {
  return (
    // Only renders ~15 DOM nodes at any given time, despite 50,000 records!
    <List
      height={500}         // Viewport height
      itemCount={items.length}
      itemSize={45}        // Row height in px
      width="100%"
    >
      {({ index, style }) => (
        <div style={style} className="transaction-row">
          {items[index].text}
        </div>
      )}
    </List>
  );
}`,
    recallHint: "Virtualization renders only items in visible viewport (~20 nodes) instead of 50,000; keeps memory low and scrolling at 60 FPS.",
    interviewTip: "Cite TanStack Virtual for modern dynamic row height virtualization and headless virtual scrolling in React 18/19.",
    tags: ["virtualization", "windowing", "react-window", "tanstack-virtual"],
    practice: [
      "How does virtualization handle variable/dynamic row heights?",
      "What is the purpose of the 'overscan' property in virtualized lists?"
    ]
  }),

  createCard({
    idNum: 111,
    category: "Performance Optimization, Virtualization & Profiling",
    concept: "Code Splitting with React.lazy & Suspense",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does `React.lazy` with dynamic imports (`import()`) enable route-based code splitting, and how does it shrink initial bundle sizes?",
    quickAnswer: "`React.lazy` defers loading a component's JavaScript code until it is rendered for the first time. Combined with `<Suspense>`, it splits monolithic bundles into small on-demand chunks, significantly speeding up initial page load.",
    detailedAnswer: "Without code splitting, an application with 50 pages packages all 50 pages into a single huge `bundle.js`. A user visiting just the landing page downloads the code for the admin dashboard, settings, and billing. `React.lazy(() => import('./AdminDashboard'))` instructs Webpack/Vite to output a separate chunk file (`admin.chunk.js`). The browser downloads that chunk *only* when the user actually navigates to the admin route.",
    code: `import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

// Dynamically imported route chunks:
const Home = lazy(() => import('./routes/Home'));
const Analytics = lazy(() => import('./routes/Analytics'));
const Settings = lazy(() => import('./routes/Settings'));

function AppRoutes() {
  return (
    <BrowserRouter>
      {/* Suspense fallback renders while the chunk downloads over the network */}
      <Suspense fallback={<div className="page-spinner">Loading page...</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}`,
    recallHint: "const Comp = lazy(() => import('./Comp')); wrap in <Suspense>; downloads JS chunk only when rendered.",
    interviewTip: "Advise prefetching lazy chunks on user hover (e.g. prefetching `<Analytics>` when user hovers over the 'Analytics' link in navigation) to eliminate loading spinners entirely.",
    tags: ["code-splitting", "React.lazy", "suspense", "bundle-size"],
    practice: [
      "Why must components imported via React.lazy be default exports?",
      "How can you prefetch a lazy-loaded component before the user clicks navigation?"
    ]
  }),

  createCard({
    idNum: 112,
    category: "Performance Optimization, Virtualization & Profiling",
    concept: "Offloading Heavy Computation to Web Workers",
    priority: "must-know",
    difficulty: "advanced",
    question: "When should CPU-intensive tasks be moved off the React main thread to Web Workers, and how do you integrate them with React hooks?",
    quickAnswer: "Tasks like client-side image processing, large CSV parsing, cryptographic hashing, or heavy physics calculations should run in Web Workers because JavaScript is single-threaded. Running them on the main thread freezes the React UI; Workers run concurrently on background OS threads.",
    detailedAnswer: "Even with React 18 Concurrent Mode, time-slicing only chunks React rendering—it cannot slice raw synchronous JavaScript execution (like parsing a 50MB CSV file or image manipulation). A Web Worker runs on an independent background thread with its own event loop, communicating with React via `postMessage`. A custom hook can trigger worker tasks and update React state when results are posted back.",
    code: `import { useState, useEffect, useRef } from 'react';

function useWorker(workerScript) {
  const workerRef = useRef(null);
  const [result, setResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    workerRef.current = new Worker(workerScript);
    workerRef.current.onmessage = (e) => {
      setResult(e.data);
      setIsProcessing(false);
    };
    return () => workerRef.current.terminate(); // Cleanup worker thread
  }, [workerScript]);

  const postTask = (payload) => {
    setIsProcessing(true);
    workerRef.current.postMessage(payload);
  };

  return { result, isProcessing, postTask };
}`,
    recallHint: "Web Workers run heavy calculations on background OS thread; keeps React main UI thread at 60 FPS.",
    interviewTip: "Mention libraries like Comlink, which turn postMessage-based Web Workers into intuitive promise-based RPC calls in modern React applications.",
    tags: ["web-workers", "concurrency", "multithreading", "performance"],
    practice: [
      "Can a Web Worker directly mutate or access the browser DOM?",
      "What is the serialization overhead of passing large data across `postMessage`?"
    ]
  }),

  createCard({
    idNum: 113,
    category: "Performance Optimization, Virtualization & Profiling",
    concept: "Inline Objects & Anonymous Functions in JSX",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When does creating inline functions (`onClick={() => ...}`) and inline objects (`style={{ color: 'red' }}`) in JSX actually degrade performance?",
    quickAnswer: "Inline objects and functions degrade performance ONLY when passed as props to child components that are memoized with `React.memo` (or used in hook dependency arrays). On native DOM elements (`<button onClick={() => ...}>`), the overhead is completely negligible.",
    detailedAnswer: "Every render creates a brand new function reference and object literal in memory. When passed to `<MemoizedChild config={{ theme: 'dark' }} onClick={() => doSomething()} />`, `Object.is` fails on every single render, completely destroying `React.memo`'s ability to skip rendering. However, developers often obsess over removing inline functions on standard HTML elements like `<button onClick={() => setCount(c + 1)}>`, which creates unnecessary boilerplate with zero performance gain.",
    code: `// 1. NEGLIGIBLE OVERHEAD: Standard native DOM node (Totally fine!)
function SimpleButton() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(c => c + 1)}>Click</button>;
}

// 2. PERFORMANCE DEFEAT: Passing inline object/fn to MEMOIZED child!
const MemoizedCard = React.memo(Card);

function Parent() {
  return (
    // Breaks React.memo! Inline object has a new memory address on every render!
    <MemoizedCard 
      theme={{ color: 'blue' }} // BUG: Memoization skipped!
      onRefresh={() => refresh()} // BUG: Memoization skipped!
    />
  );
}

// FIXED: Stabilize references with useMemo / useCallback
const theme = useMemo(() => ({ color: 'blue' }), []);
const onRefresh = useCallback(() => refresh(), []);`,
    recallHint: "Inline functions on HTML tags are harmless; inline functions on React.memo components destroy memoization.",
    interviewTip: "Clarify this distinction to show pragmatic maturity: avoid cargo-culting `useCallback` on every click handler while diligently preserving references for memoized components.",
    tags: ["inline-functions", "memoization", "shallow-equality", "anti-patterns"],
    practice: [
      "Why is allocating an arrow function in JavaScript execution measured in nanoseconds?",
      "How does the React 19 Compiler automatically solve this problem at compile time?"
    ]
  }),

  createCard({
    idNum: 114,
    category: "Performance Optimization, Virtualization & Profiling",
    concept: "Optimizing List Rendering Performance",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the four golden rules for optimizing large collection rendering in React?",
    quickAnswer: "1) Use stable, unique entity IDs for `key` (never array index); 2) Memoize list item components with `React.memo`; 3) Pass primitive ID props instead of complex objects to simplify shallow equality; 4) Virtualize lists exceeding 100+ complex items.",
    detailedAnswer: "When a list updates (e.g. 1 item in a 500-item list changes status), default React behavior re-renders all 500 items. To optimize: wrap `<ListItem>` in `React.memo`. Instead of passing the entire bloated `item` object, pass `itemId`, allowing the item to read only its slice of state. This ensures only the single changed item re-renders, while the other 499 items bail out of rendering in 0ms.",
    code: `// High-Performance List Item Pattern:
import { memo } from 'react';

const TodoItem = memo(function TodoItem({ id, text, isCompleted, onToggle }) {
  console.log('Rendered item:', id);
  return (
    <li>
      <input 
        type="checkbox" 
        checked={isCompleted} 
        onChange={() => onToggle(id)} 
      />
      <span>{text}</span>
    </li>
  );
});

// Parent list passes stable onToggle callback:
function TodoList({ todos }) {
  const handleToggle = useCallback((id) => {
    // Dispatch toggle
  }, []);

  return (
    <ul>
      {todos.map(t => (
        <TodoItem 
          key={t.id} 
          id={t.id} 
          text={t.text} 
          isCompleted={t.isCompleted} 
          onToggle={handleToggle} 
        />
      ))}
    </ul>
  );
}`,
    recallHint: "Stable keys + React.memo on items + stable callback = only modified row re-renders.",
    interviewTip: "Demonstrate that passing primitives (`id, isCompleted`) instead of an entire object makes `React.memo`'s default shallow comparison 100% reliable without writing custom comparators.",
    tags: ["lists", "performance", "React.memo", "re-renders"],
    practice: [
      "Why does passing a new array reference `todos.filter(...)` to a parent component cause all items to re-render without memoization?",
      "How does virtualization take list optimization to the next level?"
    ]
  }),

  createCard({
    idNum: 115,
    category: "Performance Optimization, Virtualization & Profiling",
    concept: "Image Optimization & Cumulative Layout Shift (CLS)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you optimize images in React applications to eliminate Cumulative Layout Shift (CLS) and accelerate LCP?",
    quickAnswer: "Always provide explicit `width` and `height` (or aspect-ratio CSS) to reserve layout space, use native `loading='lazy'`, provide responsive `srcset` resolutions, and use modern WebP/AVIF formats with low-quality image placeholders (LQIP).",
    detailedAnswer: "When an image loads without dimensions, the browser renders it at 0px, and then abruptly pushes down all content below it once image headers download, causing a severe CLS score penalty. By specifying `width` and `height` attributes on `<img>`, modern browsers compute the aspect ratio before downloading, reserving the exact layout box. Framework components (like `next/image`) automate this alongside automatic WebP/AVIF format transcoding.",
    code: `function ProductCard({ product }) {
  return (
    <div className="card">
      {/* 1. Explicit width & height reserve layout box preventing CLS! */}
      {/* 2. loading="lazy" defers offscreen images */}
      {/* 3. decoding="async" prevents decoding from blocking the main thread */}
      <img
        src={product.imageUrl}
        alt={product.name}
        width={400}
        height={300}
        loading="lazy"
        decoding="async"
        srcSet={\`
          \${product.imageUrl}?w=400 400w,
          \${product.imageUrl}?w=800 800w
        \`}
        sizes="(max-width: 600px) 100vw, 400px"
        className="product-image"
      />
      <h3>{product.name}</h3>
    </div>
  );
}`,
    recallHint: "Set width/height to reserve layout and prevent CLS; loading='lazy' + decoding='async' + srcset.",
    interviewTip: "Mention that for the Largest Contentful Paint (LCP) hero image (above the fold), you should NEVER set `loading='lazy'`; instead, set `fetchpriority='high'` to load it as fast as possible.",
    tags: ["images", "cls", "lcp", "web-vitals", "performance"],
    practice: [
      "Why should you never put `loading='lazy'` on the hero banner image at the top of a webpage?",
      "How does blur-up placeholder technology work during image streaming?"
    ]
  }),

  createCard({
    idNum: 116,
    category: "Performance Optimization, Virtualization & Profiling",
    concept: "CSS-in-JS Runtime Overhead vs Zero-Runtime CSS",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why has the React industry shifted away from runtime CSS-in-JS libraries (Styled-Components, Emotion) towards zero-runtime solutions (Tailwind, Vanilla Extract, CSS Modules)?",
    quickAnswer: "Runtime CSS-in-JS libraries parse and inject dynamic `<style>` tags during component rendering in JavaScript, consuming CPU cycles and triggering browser layout recalculations. Zero-runtime solutions compile styles to static CSS at build time, with zero JavaScript overhead.",
    detailedAnswer: "In runtime CSS-in-JS, every render of `<Button primary={isPrimary}>` runs string interpolation, hashes the CSS rule, checks if the rule exists in a cache, and imperatively inserts it into a `<style>` tag via DOM APIs. In heavy apps with thousands of elements, this adds 20–30% overhead to render times. Zero-runtime solutions (Tailwind CSS, CSS Modules, Vanilla Extract, StyleX) extract all CSS ahead of time during the build, allowing the browser to parse CSS natively and run React at full speed.",
    code: `// RUNTIME CSS-IN-JS (Adds JS CPU overhead on every render):
// const Button = styled.button\`
//   background: \${props => props.primary ? 'blue' : 'gray'};
//   padding: 10px;
// \`;

// ZERO-RUNTIME TAILWIND (Static CSS classes, 0ms JS runtime cost!):
function Button({ primary, children }) {
  return (
    <button className={\`p-2.5 rounded font-bold \${primary ? 'bg-blue-600' : 'bg-gray-400'}\`}>
      {children}
    </button>
  );
}`,
    recallHint: "Runtime CSS-in-JS parses styles in JS during render (slow); Zero-runtime (Tailwind/CSS Modules) compiles to static CSS at build.",
    interviewTip: "Mention React Server Components (RSC): runtime CSS-in-JS libraries that inject styles via React Context cannot run inside Server Components, making zero-runtime CSS mandatory for modern RSC architectures.",
    tags: ["css-in-js", "tailwind", "zero-runtime", "performance"],
    practice: [
      "Why can't runtime CSS-in-JS libraries like Emotion work inside React Server Components?",
      "How does StyleX provide type-safe styling with zero-runtime compilation?"
    ]
  }),

  createCard({
    idNum: 117,
    category: "Performance Optimization, Virtualization & Profiling",
    concept: "Interaction to Next Paint (INP) Optimization",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Interaction to Next Paint (INP), and what React architectural patterns optimize INP scores below 200ms?",
    quickAnswer: "INP is Google's Core Web Vital metric measuring page responsiveness across all user clicks, taps, and keypresses. INP is optimized in React by: 1) Using `useTransition` for heavy work; 2) Breaking long JavaScript tasks; 3) Avoiding synchronous layout reads.",
    detailedAnswer: "INP measures the time from when a user interacts with the page until the browser paints the next visual frame confirming the action. If clicking a filter button triggers a synchronous 250ms component re-render, the browser cannot paint feedback, resulting in a failing INP score (>200ms). Wrapping the heavy filtering in `startTransition` lets React render immediate button feedback (e.g. pressed state or spinner) in the very first frame (<16ms), deferring the heavy tree render to non-blocking background chunks.",
    code: `// OPTIMIZING INP WITH TRANSITIONS:
function FilterPanel() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [filteredData, setFilteredData] = useState(hugeDataset);
  const [isPending, startTransition] = useTransition();

  const handleFilter = (filter) => {
    // 1. Immediate urgent feedback: updates button styling in <16ms!
    setActiveFilter(filter);

    // 2. Heavy work deferred in transition: doesn't block the next paint!
    startTransition(() => {
      setFilteredData(runExpensiveFilter(filter));
    });
  };

  return (
    <div>
      <button 
        className={activeFilter === 'sales' ? 'active' : ''} 
        onClick={() => handleFilter('sales')}
      >
        Sales {isPending && '⏳'}
      </button>
      <DataGrid data={filteredData} />
    </div>
  );
}`,
    recallHint: "INP measures interaction lag; use startTransition to provide visual feedback in <16ms and defer heavy work.",
    interviewTip: "Highlight that INP replaced FID (First Input Delay) in March 2024 as an official Google search ranking factor, making responsiveness across the entire session critical.",
    tags: ["inp", "core-web-vitals", "web-performance", "transitions"],
    practice: [
      "Why did Google replace FID (First Input Delay) with INP (Interaction to Next Paint)?",
      "How do Chrome DevTools Performance insights highlight long tasks blocking INP?"
    ]
  }),

  createCard({
    idNum: 118,
    category: "Performance Optimization, Virtualization & Profiling",
    concept: "Memory Leaks & Detached DOM Nodes",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do memory leaks and detached DOM nodes occur in React applications, and how do you detect and fix them?",
    quickAnswer: "Memory leaks occur when unmounted components leave active timers, un-cancelled event listeners, or global store subscriptions that hold references to closures or DOM nodes. Detect using Chrome DevTools Memory Heap Snapshots filtering for 'Detached HTMLDivElement'.",
    detailedAnswer: "When a component unmounts, its DOM nodes should be garbage collected. If a global event listener (`window.addEventListener`) or a persistent singleton holds a reference to a callback defined inside that unmounted component, the entire closure scope—and all referenced DOM nodes—cannot be freed by the garbage collector (Detached DOM Tree leak). Always return cleanup functions from `useEffect`, abort in-flight promises, and clear `setInterval` timers.",
    code: `// MEMORY LEAK ANTI-PATTERN:
useEffect(() => {
  const handleScroll = () => {
    // Closure holds reference to component and domRef!
    domRef.current.style.opacity = window.scrollY > 100 ? 1 : 0;
  };
  window.addEventListener('scroll', handleScroll);
  // LEAK: Missing removeEventListener! 
  // Component unmounts, but window permanently retains reference to closure and DOM!
}, []);

// PRODUCTION PATTERN: Clean teardown
useEffect(() => {
  const handleScroll = () => { /* ... */ };
  window.addEventListener('scroll', handleScroll);
  
  // Cleanup releases references, allowing immediate garbage collection!
  return () => window.removeEventListener('scroll', handleScroll);
}, []);`,
    recallHint: "Missing effect cleanups keep closures alive; Chrome DevTools Heap Snapshot reveals Detached DOM elements.",
    interviewTip: "Describe taking two Heap Snapshots in Chrome DevTools: one before opening a modal, and one after closing it. Filter by 'Objects allocated between snapshots' to catch un-freed instances.",
    tags: ["memory-leaks", "heap-snapshots", "detached-dom", "cleanup"],
    practice: [
      "How do detached DOM nodes consume exponentially more memory than regular JS objects?",
      "Why does React 18 Strict Mode in development help catch these leaks early?"
    ]
  }),

  createCard({
    idNum: 119,
    category: "Performance Optimization, Virtualization & Profiling",
    concept: "Bundle Analysis & Tree-Shaking Hygiene",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you use bundle analyzers to identify bloated dependencies, and how do you ensure proper tree-shaking?",
    quickAnswer: "Use tools like `@next/bundle-analyzer` or `rollup-plugin-visualizer` to visualize package byte distributions. Ensure packages use ES modules (`import { x }` instead of `require`), avoid barrels that re-export everything, and check `sideEffects: false` in `package.json`.",
    detailedAnswer: "A common mistake is importing a single icon from a library (`import { Check } from 'lucide-react'`) or a single function from lodash (`import { debounce } from 'lodash'`). If the package is CommonJS or lacks a `sideEffects: false` flag in `package.json`, bundlers cannot safely tree-shake unused exports, forcing the entire 500KB library into your production bundle. Auditing with visual treemaps highlights accidental duplicate dependencies (e.g. two versions of React or date libraries).",
    code: `// 1. NON-TREESHAKABLE ANTI-PATTERN: Monolithic CommonJS import
import { debounce } from 'lodash'; // Pulls in entire 70KB Lodash bundle!

// 2. TREE-SHAKABLE PATTERNS:
// Option A: Direct file import
import debounce from 'lodash/debounce';

// Option B: Modern ES module equivalent (e.g. lodash-es)
import { debounce } from 'lodash-es'; // Cleanly tree-shaken by Rollup/Vite!

// 3. Package.json declaration enabling aggressive tree-shaking:
// {
//   "name": "my-ui-library",
//   "sideEffects": false
// }`,
    recallHint: "Bundle analyzers visualize dependency bloat; use ESM imports and 'sideEffects: false' for tree-shaking.",
    interviewTip: "Highlight the danger of 'Barrel Files' (`index.js` re-exporting 100 components): in large projects, barrel files frequently prevent tree-shaking and slow down build times by 400%.",
    tags: ["bundle-analyzer", "tree-shaking", "esm", "optimization"],
    practice: [
      "What is the function of the `sideEffects` property in package.json during tree-shaking?",
      "Why do barrel files (`index.ts` re-exporting everything) degrade Vite dev server HMR speed?"
    ]
  }),

  createCard({
    idNum: 120,
    category: "Performance Optimization, Virtualization & Profiling",
    concept: "Production Readiness & Performance Checklist",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What essential steps and optimizations must be verified before deploying a React application to production?",
    quickAnswer: "1) Verify production build flags (`NODE_ENV=production` stripped of React Dev warning checks); 2) Enable gzip/Brotli compression; 3) Set long-term HTTP caching headers for hashed assets; 4) Implement Error Boundaries; 5) Audit Core Web Vitals (LCP, INP, CLS); 6) Run Lighthouse and bundle analyzers.",
    detailedAnswer: "Running React in development mode includes costly prop validations, warning systems, and extra Fiber allocations that make apps run 3–5x slower than production. A production deployment requires minified bundles with content-hashed filenames (`index-Cp91OHSO.js`) served with immutable HTTP cache headers (`Cache-Control: public, max-age=31536000, immutable`). Server-side compression (Brotli) reduces text bundle sizes by up to 70%.",
    code: `// Production Deployment Checklist:
// [✓] Build executed with NODE_ENV=production (Vite build / Next build)
// [✓] Content-hashed asset filenames for aggressive CDN caching:
//     /assets/main-[hash].js -> Cache-Control: max-age=31536000, immutable
// [✓] Brotli compression enabled on reverse proxy (Nginx / Cloudflare)
// [✓] Root and widget-level <ErrorBoundary> fallback boundaries in place
// [✓] Dynamic routes code-split via React.lazy() / dynamic imports
// [✓] Lighthouse performance score >= 90 (LCP < 2.5s, INP < 200ms, CLS < 0.1)
// [✓] Sentry / Datadog error telemetry tracking initialized in production`,
    recallHint: "NODE_ENV=production + Brotli compression + hashed asset caching + ErrorBoundaries + INP/LCP audit.",
    interviewTip: "Conclude interview discussions by stressing that real-world performance is an ongoing measurement culture: setting up Real User Monitoring (RUM) in production ensures regressions are caught before users report them.",
    tags: ["production-readiness", "checklist", "web-vitals", "deployment"],
    practice: [
      "Why is React development mode 3 to 5 times slower than production mode?",
      "What HTTP headers are required for immutable CDN caching of JavaScript chunks?"
    ]
  })
];
