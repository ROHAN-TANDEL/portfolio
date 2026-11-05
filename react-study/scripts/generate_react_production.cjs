const fs = require('fs');
const path = require('path');

const productionTopics = [
  {
    id: "react-prod-01",
    topic: "Infinite Re-render Loops via Inline Reference Dependencies",
    category: "Re-render Storms & State Loops",
    severity: "P0 / Browser Tab Freezing & CPU Spiking to 100%",
    theProblem: "A component invokes `setState` inside a `useEffect` that depends on an un-memoized object, array, or function created in the component body. On every render, a new memory reference is allocated. The effect detects a changed dependency, triggers `setState`, which causes a re-render, allocating another reference. The loop repeats continuously until React throws 'Maximum update depth exceeded' or the browser tab crashes with an out-of-memory error.",
    howItWorksInternally: "React's `useEffect` checks dependency equality using `Object.is(prevDep, nextDep)`. An object literal (`{ id: userId }`) or inline arrow function (`() => {}`) is assigned a brand new memory pointer on every render pass. When React runs `areHookInputsEqual`, the reference check returns `false`. If the effect body calls `setState`, React enqueues an update on the Fiber's `updateQueue`. Because this update is scheduled before the browser yields, React executes 50 consecutive render passes in a tight loop before hitting the internal `RE_RENDER_LIMIT` safety guard.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Infinite loop in 3 lines of code!
function BadUserFeed({ userId }) {
  const [data, setData] = useState(null);

  // BUG: Options object allocated on EVERY render!
  const fetchOptions = { headers: { 'X-User': userId } };

  useEffect(() => {
    fetchUserData(userId, fetchOptions).then(res => setData(res));
    // setData triggers re-render -> new fetchOptions reference -> effect re-runs!
  }, [fetchOptions]); // Object.is({ ... }, { ... }) is ALWAYS FALSE!

  return <div>{data?.name}</div>;
}

// 2. PRODUCTION REMEDIATION: Move outside, use primitives, or useMemo
function GoodUserFeed({ userId }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    // Construct options INSIDE the effect: eliminates external reference dependency!
    const fetchOptions = { headers: { 'X-User': userId } };
    let isCancelled = false;

    fetchUserData(userId, fetchOptions).then(res => {
      if (!isCancelled) setData(res);
    });

    return () => { isCancelled = true; };
  }, [userId]); // Primitive string/number has stable Object.is equality!

  return <div>{data?.name}</div>;
}`,
    monitoringMetrics: [
      "Client-side exception rate tracking 'Maximum update depth exceeded'",
      "Browser CPU utilization pegged at 100% on specific component mount",
      "Spikes in repetitive HTTP network requests to identical endpoints within 500ms"
    ],
    productionChecklist: [
      "Never pass un-memoized object literals, arrays, or inline functions directly into `useEffect` dependency arrays.",
      "Move helper objects or functions inside the `useEffect` body so they are not treated as reactive dependencies.",
      "If an object must come from outside, stabilize it with `useMemo` or pass individual primitive properties (`options.id`)."
    ]
  },
  {
    id: "react-prod-02",
    topic: "Stale Closure Disasters in Async Callbacks & Intervals",
    category: "Closures & Event Handlers",
    severity: "P1 / Silent Data Corruption & Frozen Timers",
    theProblem: "Asynchronous handlers (`setInterval`, `setTimeout`, WebSocket handlers, or promise chains) capture state variables from the render pass in which they were created. As time passes, the component re-renders with new state, but the asynchronous closure permanently accesses the old snapshot. A timer counting up gets stuck at 1, or an order submit handler posts an outdated shopping cart, silently corrupting user data.",
    howItWorksInternally: "JavaScript functions maintain a reference to the lexical environment of their creation scope. When a component function runs, local variables (`const [count, setCount] = useState(0)`) are local constants for that single invocation. If an effect runs with an empty dependency array (`[]`), its setup closure is created once on mount when `count === 0`. The interval callback inside that closure permanently references the mount environment's `count` variable. Calling `setCount(count + 1)` calculates `0 + 1 = 1` on every tick, never advancing.",
    productionCode: `// 1. BUGGY STALE CLOSURE: Timer permanently stuck at 1!
function BrokenTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      // Stale closure: 'seconds' is permanently 0 from the mount pass!
      setSeconds(seconds + 1); 
    }, 1000);
    return () => clearInterval(id);
  }, []); // Missing 'seconds' dependency!

  return <h1>Seconds: {seconds}</h1>; // Stays at 1 forever!
}

// 2. PRODUCTION REMEDIATION A: Functional State Update (Recommended)
function SafeTimer() {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      // Functional updater reads latest pending state from Fiber queue:
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(id);
  }, []); // Safe: zero dependency on 'seconds'!

  return <h1>Seconds: {seconds}</h1>;
}

// 3. PRODUCTION REMEDIATION B: Latest Ref Pattern (For complex callbacks)
function useEventCallback(fn) {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; }); // Sync ref on each render
  return useCallback((...args) => ref.current(...args), []);
}`,
    monitoringMetrics: [
      "User telemetry showing frozen timer or stuck counter widgets",
      "Discrepancies in submitted form payloads containing default/initial state values",
      "ESLint violations flagging `react-hooks/exhaustive-deps` rule suppressions"
    ],
    productionChecklist: [
      "Strictly forbid disabling `eslint-plugin-react-hooks/exhaustive-deps` in CI/CD pipelines.",
      "Use functional state updaters (`setState(prev => ... )`) whenever the new state derives from previous state.",
      "Use the Latest Ref pattern (`useEventCallback` / `useEffectEvent`) for event listeners that need fresh state without re-triggering effects."
    ]
  },
  {
    id: "react-prod-03",
    topic: "SSR Hydration Mismatch Crashes & Layout Shift",
    category: "Server-Side Rendering (SSR) & Hydration",
    severity: "P1 / Hydration Bailout & Visual Flickering",
    theProblem: "In Server-Side Rendered (SSR) apps (Next.js, Remix, Astro), the server renders HTML based on server time, cookies, or headers, while the client hydration pass renders based on `window.innerWidth`, client `localStorage`, or local browser timezone. React detects mismatched HTML and throws a hydration warning, discards server DOM attributes, and forces a full client re-render, destroying SEO advantages and causing jarring Cumulative Layout Shift (CLS).",
    howItWorksInternally: "During `hydrateRoot`, React traverses the existing server-rendered DOM nodes and attempts to match each DOM element and text node with the virtual element tree produced by the client component's initial render. If React expects a `<button>Login</button>` based on client `localStorage` but finds `<button>Loading</button>` from server HTML, it logs a hydration failure. In React 18, React attempts to patch up the mismatch by client-rendering the mismatched subtree, causing visual flickering and delayed interactivity.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Checking 'window' directly during render!
function BadHeader() {
  // SERVER renders: "Theme: Light" (window is undefined)
  // CLIENT renders: "Theme: Dark" (localStorage has 'dark') -> HYDRATION ERROR!
  const theme = typeof window !== 'undefined' ? localStorage.getItem('theme') : 'Light';
  return <div className={\`header \${theme}\`}>Welcome</div>;
}

// 2. PRODUCTION REMEDIATION: Two-Pass Rendering with mounted flag
function SafeHeader() {
  const [theme, setTheme] = useState('Light'); // Match server default on initial render!
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // Only runs on the client AFTER initial hydration completes:
    setMounted(true);
    const saved = localStorage.getItem('theme');
    if (saved) setTheme(saved);
  }, []);

  if (!mounted) {
    // Render matching server placeholder on first pass!
    return <div className="header Light">Welcome</div>;
  }

  return <div className={\`header \${theme}\`}>Welcome</div>;
}

// 3. For dynamic timestamps: Use suppressHydrationWarning
function Timestamp({ date }) {
  return (
    <time dateTime={date.toISOString()} suppressHydrationWarning>
      {date.toLocaleDateString()}
    </time>
  );
}`,
    monitoringMetrics: [
      "Hydration error rate in client logs: 'Hydration failed because the initial UI does not match'",
      "Cumulative Layout Shift (CLS) spikes during initial page load",
      "Time to Interactive (TTI) degradation caused by client-side tree patch-up passes"
    ],
    productionChecklist: [
      "Never read `window`, `localStorage`, `navigator`, or `document` during the initial component render pass.",
      "Use two-pass rendering (`const [mounted, setMounted] = useState(false)`) for client-only UI widgets.",
      "Apply `suppressHydrationWarning` strictly to leaf elements displaying unavoidable client-rendered local dates or times."
    ]
  },
  {
    id: "react-prod-04",
    topic: "Cascading Re-render Storms Across Deep Component Subtrees",
    category: "Re-render Storms & State Loops",
    severity: "P1 / High Latency & Dropped Frames (Jank)",
    theProblem: "A top-level state change in an application root component (e.g. typing a character in a search bar or receiving a WebSocket notification) triggers synchronous recursive re-renders across 2,000 descendant components. The browser frame rate drops from 60 FPS to 12 FPS, making the entire application feel laggy and unresponsive.",
    howItWorksInternally: "By default in React, when a parent component renders, ALL of its children render recursively down the entire component tree, regardless of whether their props changed. If an un-memoized component tree has 2,000 nodes, React executes 2,000 function bodies, creates 2,000 virtual element objects, and performs 2,000 diffing comparisons on every single keystroke. Even if real DOM mutations are minimal, the sheer CPU time spent traversing V8 function executions exceeds the 16.6ms frame budget.",
    productionCode: `// 1. ANTI-PATTERN: Root state forces entire app tree to re-render on every keystroke!
function BadApp() {
  const [search, setSearch] = useState('');
  return (
    <div>
      <input value={search} onChange={e => setSearch(e.target.value)} />
      <HeavyDashboard /> {/* 2,000 components re-rendered on EVERY single character! */}
      <ComplexDataGrid />
    </div>
  );
}

// 2. PRODUCTION REMEDIATION A: Push State Down (Collocation)
function SearchWidget() {
  const [search, setSearch] = useState('');
  return <input value={search} onChange={e => setSearch(e.target.value)} />;
}

function OptimizedApp() {
  return (
    <div>
      <SearchWidget /> {/* Keystroke re-renders ONLY SearchWidget! */}
      <HeavyDashboard /> {/* Unaffected! 0ms render cost! */}
      <ComplexDataGrid />
    </div>
  );
}

// 3. PRODUCTION REMEDIATION B: Pass Heavy Component as 'children'
function LayoutWrapper({ children }) {
  const [color, setColor] = useState('blue');
  return (
    <div style={{ color }}>
      <button onClick={() => setColor(c => c === 'blue' ? 'red' : 'blue')}>Toggle Color</button>
      {children} {/* children element was created in parent; skips re-rendering! */}
    </div>
  );
}`,
    monitoringMetrics: [
      "Total component render counts per user interaction tracked via React Profiler",
      "Long tasks (>50ms) detected by PerformanceObserver during typing or clicks",
      "Interaction to Next Paint (INP) degradation exceeding the 200ms threshold"
    ],
    productionChecklist: [
      "Collocate state: push state down to the lowest possible leaf component that needs it.",
      "Use composition (`children` or slot props) to isolate stateful containers from heavy subtrees.",
      "Wrap pure, expensive leaf tables or charts in `React.memo` with primitive props."
    ]
  },
  {
    id: "react-prod-05",
    topic: "Context API Value Invalidation Starving High-Velocity UI",
    category: "State Management & Context",
    severity: "P1 / Application-Wide Render Thrashing",
    theProblem: "A single global React Context holds application user data along with high-velocity data (such as notifications, mouse coordinates, or active tab timers). Every time the high-velocity value changes, the context value object is recreated, forcing EVERY single component consuming that context across the entire application to re-render, starving UI responsiveness.",
    howItWorksInternally: "When a `<Context.Provider value={val}>` updates its `value` prop to a new object reference, React marks every Fiber subscribing to that context as dirty with `ForceUpdate`. Crucially, `React.memo` CANNOT stop this re-render: `React.memo` only bails out if *props* don't change; it is intentionally bypassed when consumed context changes. If 500 components call `useContext(GlobalContext)` to read `user.id`, updating `notifications` in the same context forces all 500 components to re-render.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Monolithic context holding both slow and fast state
const GlobalContext = createContext(null);

function BadProvider({ children }) {
  const [user, setUser] = useState({ name: 'Alice' });
  const [tick, setTick] = useState(0); // High-velocity ticker!

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // Recreates object every second! Forces every consumer to re-render every second!
  return (
    <GlobalContext.Provider value={{ user, tick }}>
      {children}
    </GlobalContext.Provider>
  );
}

// 2. PRODUCTION REMEDIATION: Context Splitting
const UserContext = createContext(null);
const TickerContext = createContext(null);

function GoodProvider({ children }) {
  const [user] = useState({ name: 'Alice' });
  const [tick, setTick] = useState(0);

  return (
    <UserContext.Provider value={user}>
      <TickerContext.Provider value={tick}>
        {children}
      </TickerContext.Provider>
    </UserContext.Provider>
  );
}

// UserProfile consumes ONLY UserContext -> NEVER re-renders on ticker changes!
function UserProfile() {
  const user = useContext(UserContext); // Stable! 0 unnecessary renders!
  return <h1>{user.name}</h1>;
}`,
    monitoringMetrics: [
      "Total re-render counts on static navigation components during timer/polling events",
      "Context update propagation time in React DevTools Profiler",
      "Flamegraph showing hundreds of components updating simultaneously under a Provider"
    ],
    productionChecklist: [
      "Split monolithic contexts into separate, single-responsibility Context Providers (e.g. `UserContext`, `ThemeContext`).",
      "Separate dynamic state from static dispatchers (`StateContext` and `DispatchContext`).",
      "For high-frequency or granular slice updates, migrate to an external store (Zustand) with selector subscriptions."
    ]
  },
  {
    id: "react-prod-06",
    topic: "Concurrent UI Tearing & State De-synchronization in External Stores",
    category: "Concurrent Engine & Scheduling",
    severity: "P1 / Visual Inconsistency & Ghost State",
    theProblem: "An application subscribes to an external store (Redux, Zustand, or a custom event bus) using traditional `useEffect` + `useState`. In React 18 Concurrent Mode, React time-slices a heavy render across multiple frames. If the external store updates while React is paused mid-render, different components on screen display conflicting values (e.g. Header shows Account Balance $100 while Checkout shows Account Balance $50).",
    howItWorksInternally: "In React 18, render work is non-blocking and can yield to the browser between fiber chunks. If an external store is mutated during that yield, the component tree becomes partially rendered with old store state and partially rendered with new store state. Because `useEffect` subscriptions only fire *after* the commit phase, React cannot detect that the store changed mid-render. This visual defect is known as 'UI Tearing'.",
    productionCode: `// 1. VULNERABLE ANTI-PATTERN: useEffect + useState subscription in Concurrent Mode
function useVulnerableStore(store) {
  const [state, setState] = useState(store.getState());

  useEffect(() => {
    // Subject to UI Tearing in React 18 Concurrent Rendering!
    return store.subscribe(() => {
      setState(store.getState());
    });
  }, [store]);

  return state;
}

// 2. PRODUCTION REMEDIATION: useSyncExternalStore
import { useSyncExternalStore } from 'react';

export function useSafeStore(store, selector = state => state) {
  // Guaranteed tearing-free across React 18 and 19 concurrent renders!
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getInitialServerState()) // SSR safe snapshot
  );
}`,
    monitoringMetrics: [
      "Inconsistent state telemetry reports from user sessions",
      "Visual defect bug reports describing contradictory data on the same view",
      "Audit of state libraries ensuring compatibility with `useSyncExternalStore`"
    ],
    productionChecklist: [
      "Ban raw `useEffect` + `useState` patterns for subscribing to external state stores.",
      "Enforce `useSyncExternalStore` for all custom stores and browser event subscriptions.",
      "Ensure store `getSnapshot` functions return immutable, cached references when data has not changed."
    ]
  },
  {
    id: "react-prod-07",
    topic: "Uncaught Async Promise Rejections Bypassing Error Boundaries",
    category: "Resilience & Error Handling",
    severity: "P1 / Silent App Failure & Unhandled Rejections",
    theProblem: "A network fetch inside an asynchronous event handler rejects, or an unhandled exception occurs inside a `setTimeout`. The developer assumes the parent `<ErrorBoundary>` will catch it and display a fallback. Instead, the error bypasses the Error Boundary completely, logs an unhandled promise rejection in the browser console, and leaves the user staring at a frozen, broken UI state.",
    howItWorksInternally: "React Error Boundaries strictly operate on the React Fiber call stack during the **Render Phase** and component lifecycle methods. Asynchronous callbacks (`fetch().then()`, `setTimeout`, event handlers) run on the browser event loop outside of React's render phase. Because there is no active Fiber work loop running when the promise rejects, React has no boundary context to unwind, and the exception bubbles directly to `window.onerror`.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Async error bypasses ErrorBoundary!
function UnsafeWidget() {
  const handleClick = async () => {
    // If this throws, ErrorBoundary DOES NOT CATCH IT!
    const data = await api.failingEndpoint();
    console.log(data);
  };

  return <button onClick={handleClick}>Run Action</button>;
}

// 2. PRODUCTION REMEDIATION A: Bridge to ErrorBoundary via State Setter
function SafeWidget() {
  const [_, setThrowError] = useState();

  const handleClick = async () => {
    try {
      await api.failingEndpoint();
    } catch (err) {
      // Throw inside a state updater function: bridges into React Render loop!
      setThrowError(() => { throw err; });
    }
  };

  return <button onClick={handleClick}>Run Action</button>;
}

// 3. PRODUCTION REMEDIATION B: React 19 Actions (Native ErrorBoundary catch!)
function React19ActionWidget() {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    // In React 19, startTransition natively catches async rejections!
    startTransition(async () => {
      await api.failingEndpoint(); // Uncaught rejection automatically caught by ErrorBoundary!
    });
  };

  return <button onClick={handleClick} disabled={isPending}>Run Action</button>;
}`,
    monitoringMetrics: [
      "Window unhandledrejection event rate in client monitoring (Sentry / Datadog)",
      "Unhandled network exception counts on interactive form submit buttons",
      "Stuck loading spinner metrics where promises failed silently without error UI"
    ],
    productionChecklist: [
      "Always wrap raw async event handlers in try/catch blocks with explicit user-facing error feedback.",
      "In React 19, execute async mutations inside `startTransition` so rejections trigger Error Boundaries natively.",
      "Install a global `window.addEventListener('unhandledrejection')` listener to capture and report orphaned async crashes."
    ]
  },
  {
    id: "react-prod-08",
    topic: "Double-Submit Form Race Conditions & State Corruption",
    category: "Forms & Mutation Lifecycle",
    severity: "P1 / Duplicate Financial Charges & Corrupted Data",
    theProblem: "A user double-clicks or rapidly taps a 'Submit Order' button. In a naive form, both clicks fire simultaneously, initiating two concurrent asynchronous HTTP requests. The user is charged twice for the same order, creating duplicate ledger entries and catastrophic billing support escalation.",
    howItWorksInternally: "In standard JavaScript event handling, clicking a button twice in 100ms dispatches two discrete `click` events to the event loop. If the first handler sets `isSubmitting = true`, that state update is asynchronous and has not yet disabled the button before the second click fires. Both asynchronous network promises execute in parallel, racing against each other to write duplicate records to the database.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Naive state-based disabling has a race window!
function VulnerableForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return; // RACE CONDITION: Second click arrives before state commits!
    setIsSubmitting(true);
    await api.chargeCreditCard();
    setIsSubmitting(false);
  };

  return <button onClick={handleSubmit} disabled={isSubmitting}>Pay Now</button>;
}

// 2. PRODUCTION REMEDIATION A: Synchronous Ref Lock
function RobustForm() {
  const isLockedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Synchronous immediate check: Ref mutates in 0ms, closing race window!
    if (isLockedRef.current) return;
    isLockedRef.current = true;
    setIsSubmitting(true);

    try {
      await api.chargeCreditCard();
    } finally {
      isLockedRef.current = false;
      setIsSubmitting(false);
    }
  };

  return <button onClick={handleSubmit} disabled={isSubmitting}>Pay Now</button>;
}

// 3. PRODUCTION REMEDIATION B: React 19 Form Action (Natively serializes submissions!)
function ModernReact19Form() {
  const [state, formAction, isPending] = useActionState(async (prev, formData) => {
    // React 19 automatically queues and deduplicates consecutive submissions!
    return await api.chargeCreditCard();
  }, null);

  return (
    <form action={formAction}>
      <button type="submit" disabled={isPending}>
        {isPending ? 'Processing...' : 'Pay Now'}
      </button>
    </form>
  );
}`,
    monitoringMetrics: [
      "Duplicate POST request frequency to mutation endpoints within a 1-second window",
      "Database unique constraint violation rate on order generation keys",
      "Customer support ticket volume citing duplicate charges or double orders"
    ],
    productionChecklist: [
      "Use synchronous `useRef` locks to guard mutation handlers against rapid double-clicks.",
      "Send a unique idempotency key (`Idempotency-Key: uuid`) with every financial mutation request.",
      "Leverage React 19 Actions (`useActionState`), which natively serialize form submissions."
    ]
  },
  {
    id: "react-prod-09",
    topic: "Monolithic Bundle Bloat & Tree-Shaking Failure from Barrel Files",
    category: "Bundle Optimization & Build Tools",
    severity: "P1 / Slow First Contentful Paint (FCP) & High Bandwidth",
    theProblem: "An application imports a single utility or icon from a common barrel file (`import { Check } from '@/components/icons'`). The bundler is forced to evaluate and pull the entire 2MB library of 1,500 icons and components into the client bundle, delaying First Contentful Paint by several seconds on mobile connections.",
    howItWorksInternally: "Barrel files (`index.js` or `index.ts` re-exporting hundreds of modules) create a massive entangled module graph. If any re-exported file has side effects (e.g. executing code at module root, registering polyfills), or if the bundler cannot prove purity, the bundler must retain all re-exported files to preserve JavaScript execution semantics. This disables tree-shaking and causes client bundle size to explode.",
    productionCode: `// 1. BARREL FILE TRAP (icons/index.js re-exports 1,000 icons):
// import { Check } from '@/components/icons'; 
// Result: Pulls in 1,000 SVG components (800KB of dead code!)

// 2. PRODUCTION REMEDIATION A: Direct Path Imports
import Check from '@/components/icons/Check'; // Pulls in ONLY Check icon (1.2KB)!

// 3. PRODUCTION REMEDIATION B: Package.json sideEffects Flag
// In component library package.json:
// {
//   "name": "@acme/ui-library",
//   "sideEffects": false // Informs Webpack/Rollup that unused imports CAN be safely deleted!
// }

// 4. PRODUCTION REMEDIATION C: Next.js optimizePackageImports Config
// next.config.js:
module.exports = {
  experimental: {
    // Automatically transforms barrel imports to direct file paths at compile time:
    optimizePackageImports: ['lucide-react', '@headlessui/react', 'lodash-es']
  }
};`,
    monitoringMetrics: [
      "Production JavaScript bundle size tracking in CI/CD pull request checks",
      "First Contentful Paint (FCP) and Largest Contentful Paint (LCP) web vitals",
      "Tree map visualization via `rollup-plugin-visualizer` flagging unused packages"
    ],
    productionChecklist: [
      "Avoid root barrel files (`index.ts` re-exporting the entire project) in large codebases.",
      "Add `\"sideEffects\": false` to internal UI packages in `package.json` to enable dead-code elimination.",
      "Configure bundler import optimization (`optimizePackageImports`) for icon and utility libraries."
    ]
  },
  {
    id: "react-prod-10",
    topic: "Ref Staling & Missing Teardown in React 18 Strict Mode Remounts",
    category: "Component Lifecycle & DOM Control",
    severity: "P1 / Ghost Subscriptions & Memory Leaks",
    theProblem: "In React 18 Strict Mode (development), React mounts, unmounts, and immediately remounts components to verify cleanup resiliency. Effects that attach native event listeners or initialize third-party imperative widgets (charts, maps, video players) without proper teardown end up with duplicate listeners, double rendering, and memory leaks that crash staging environments.",
    howItWorksInternally: "To prepare applications for future Concurrent features (like `<Activity mode='hidden'>` where components are preserved in background), React 18 simulates immediate remounting: `setup() -> cleanup() -> setup()`. If your effect initializes an imperative library (`new Chart(canvasRef.current)`) but does not destroy the chart instance in the cleanup return function, the second `setup()` call instantiates a second overlapping chart on the same canvas, leaking memory and breaking UI rendering.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Third-party widget initialized without teardown!
function BadChart({ data }) {
  const chartRef = useRef(null);

  useEffect(() => {
    // In React 18 Strict Mode, runs twice! Creates TWO charts on the same DOM canvas!
    const chart = new ImperativeChart(chartRef.current, data);
    // LEAK: Missing chart.destroy() cleanup!
  }, [data]);

  return <canvas ref={chartRef} />;
}

// 2. PRODUCTION REMEDIATION: Idempotent Setup and Teardown
function GoodChart({ data }) {
  const chartRef = useRef(null);

  useEffect(() => {
    if (!chartRef.current) return;

    // 1. Setup
    const chart = new ImperativeChart(chartRef.current, data);

    // 2. Symmetrical Cleanup: Destroys instance cleanly on simulated remount!
    return () => {
      chart.destroy();
    };
  }, [data]);

  return <canvas ref={chartRef} />;
}`,
    monitoringMetrics: [
      "Duplicate DOM element creation warnings in browser console during development",
      "Memory heap snapshot growth across simulated unmount/remount cycles",
      "Zombie listener counts on `window` and `document` event targets"
    ],
    productionChecklist: [
      "Ensure every single `useEffect` that initializes external instances has an exact matching `.destroy()` or `.dispose()` cleanup.",
      "Never use hacky `hasMountedRef` flags to bypass React 18 Strict Mode double-invocations in development.",
      "Test component lifecycles by unmounting and remounting manually in Cypress or Playwright tests."
    ]
  },
  {
    id: "react-prod-11",
    topic: "Controlled vs Uncontrolled Input Lag & Cursor Jumping",
    category: "Forms & Mutation Lifecycle",
    severity: "P1 / Unusable Typing Experience on Form Inputs",
    theProblem: "In a controlled input (`<input value={text} onChange={...} />`), an asynchronous delay or formatted state transformation causes the cursor to violently jump to the end of the text box on every keystroke, or causes dropped characters during fast typing.",
    howItWorksInternally: "When you type in a native HTML input, the browser immediately moves the cursor to the typed position. In a controlled input, React overrides this: React receives `onChange`, updates state, re-renders, and writes `value` back to the DOM node. If the state update is asynchronous or delayed by a transition, the DOM value is overwritten *after* the browser had already advanced the cursor, resetting the browser's cursor selection range (`selectionStart`, `selectionEnd`) to the very end of the string.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Formatting state inside controlled input causes cursor jumping!
function BadPhoneInput() {
  const [phone, setPhone] = useState('');

  const handleChange = (e) => {
    // Formats raw '1234' into '(123) 4...'
    // When editing in the middle, cursor JUMPS to the very end on every letter!
    setPhone(formatPhoneNumber(e.target.value));
  };

  return <input value={phone} onChange={handleChange} />;
}

// 2. PRODUCTION REMEDIATION A: Restore Cursor Position via DOM Ref
function SafePhoneInput() {
  const [phone, setPhone] = useState('');
  const inputRef = useRef(null);

  const handleChange = (e) => {
    const input = inputRef.current;
    const originalPos = input.selectionStart; // Save cursor position!
    const formatted = formatPhoneNumber(e.target.value);
    
    setPhone(formatted);

    // Restore cursor position on next microtask:
    requestAnimationFrame(() => {
      if (input) {
        input.setSelectionRange(originalPos, originalPos);
      }
    });
  };

  return <input ref={inputRef} value={phone} onChange={handleChange} />;
}

// 3. PRODUCTION REMEDIATION B: Uncontrolled Input with Submit Extraction
function UncontrolledForm({ onSubmit }) {
  // Pure native typing: Zero cursor jumping, zero keystroke lag!
  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const data = new FormData(e.currentTarget);
      onSubmit(data.get('phone'));
    }}>
      <input name="phone" defaultValue="" />
      <button type="submit">Save</button>
    </form>
  );
}`,
    monitoringMetrics: [
      "User complaints of cursor jumping or input lag in customer feedback telemetry",
      "Form input abandonment rates on complex formatted checkout fields",
      "Interaction to Next Paint (INP) degradation during continuous text input typing"
    ],
    productionChecklist: [
      "Never put controlled inputs inside `useTransition` or deferred updates; input value must be synchronous.",
      "Save and restore `selectionStart` / `selectionEnd` when applying inline input masking (phone numbers, credit cards).",
      "Prefer uncontrolled inputs with native `FormData` for standard forms where live character-by-character formatting is not required."
    ]
  },
  {
    id: "react-prod-12",
    topic: "Layout Thrashing and Visual Flicker with useEffect vs useLayoutEffect",
    category: "DOM Measurements & Layout",
    severity: "P1 / Visual Layout Shift (CLS) & Screen Flickering",
    theProblem: "A component measures a DOM node (e.g. tooltip, dropdown, or modal dimensions) and repositions it using `useEffect`. The browser paints the tooltip at default coordinates `(0, 0)`, and then 16ms later recalculates and jumps the tooltip to the target button. Users see an ugly visual flash/flicker, and automated testing fails Cumulative Layout Shift (CLS) audits.",
    howItWorksInternally: "`useEffect` executes asynchronously *after* the browser layout reflow and paint steps have already committed pixels to the physical display screen. When your effect runs `setCoords({ top, left })`, it forces React to commit a second render pass, which triggers a second browser layout reflow and repaint in the next frame. The user's eye catches the intermediate frame, perceived as flickering.",
    productionCode: `// 1. FLICKERING ANTI-PATTERN: Measuring in useEffect causes visual jump!
function BadTooltip({ anchorRect }) {
  const [top, setTop] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    // RUNS AFTER PAINT: User sees tooltip flash at top: 0 before jumping!
    const height = ref.current.getBoundingClientRect().height;
    setTop(anchorRect.top - height);
  }, [anchorRect]);

  return <div ref={ref} style={{ position: 'fixed', top }} className="tooltip">Hint</div>;
}

// 2. PRODUCTION REMEDIATION: useLayoutEffect (Flicker-Free Synchronous Position)
import { useLayoutEffect } from 'react';

function SafeTooltip({ anchorRect }) {
  const [top, setTop] = useState(0);
  const ref = useRef(null);

  // useLayoutEffect runs SYNCHRONOUSLY before browser paints to screen:
  useLayoutEffect(() => {
    const height = ref.current.getBoundingClientRect().height;
    setTop(anchorRect.top - height);
    // React flushes this state update BEFORE screen pixels are painted! Zero flicker!
  }, [anchorRect]);

  return <div ref={ref} style={{ position: 'fixed', top }} className="tooltip">Hint</div>;
}`,
    monitoringMetrics: [
      "Cumulative Layout Shift (CLS) score degradation on pages containing tooltips or popovers",
      "Visual regression testing (Percy / Chromatic) catching layout jump artifacts",
      "Client telemetry tracking double-paint layout reflows in performance traces"
    ],
    productionChecklist: [
      "Use `useLayoutEffect` strictly for synchronous DOM measurements and position adjustments before paint.",
      "Keep calculations inside `useLayoutEffect` minimal and fast, as it blocks the browser main thread.",
      "Default to standard `useEffect` for all non-DOM visual operations (data fetching, logging, timers)."
    ]
  },
  {
    id: "react-prod-13",
    topic: "Runtime CSS-in-JS Engine Overhead Saturating Browser CPU",
    category: "CSS & Styling Performance",
    severity: "P1 / High Main-Thread Execution Time",
    theProblem: "A large enterprise dashboard built with runtime CSS-in-JS libraries (Emotion, Styled-Components) renders a table with 2,000 cells. The page takes 1,800ms to mount. Profiling reveals that over 65% of CPU time is spent inside CSS-in-JS hashing, string parsing, and style tag injection rather than actual React business logic.",
    howItWorksInternally: "Runtime CSS-in-JS libraries must parse CSS strings inside JavaScript during the React render phase. On every render of `<Cell active={isActive}>`, the library runs string interpolation, computes a MurmurHash of the CSS string, checks an internal JavaScript cache map, and imperatively calls `document.head.appendChild(styleTag)`. Injecting hundreds of `<style>` tags forces the browser's CSSOM to invalidate and recalculate styles across the entire page.",
    productionCode: `// 1. RUNTIME CSS-IN-JS ANTI-PATTERN (Heavy CPU cost on every render pass):
// const StyledCell = styled.div\`
//   background: \${props => props.active ? 'blue' : 'transparent'};
//   padding: 8px;
//   color: \${props => props.color};
// \`; // In a table of 2,000 rows, this executes 2,000 CSS string parses in JS!

// 2. PRODUCTION REMEDIATION A: Zero-Runtime Tailwind CSS (0ms JS Runtime!)
function FastCell({ active, color, children }) {
  return (
    // Pre-compiled static atomic CSS classes: Zero JavaScript execution!
    <div className={\`p-2 text-sm \${active ? 'bg-blue-600 text-white' : 'bg-transparent text-gray-900'}\`}>
      {children}
    </div>
  );
}

// 3. PRODUCTION REMEDIATION B: CSS Modules with Dynamic CSS Variables
// styles.module.css:
// .cell { padding: 8px; background: var(--bg-color); }
import styles from './styles.module.css';

function VariableCell({ active, children }) {
  return (
    <div 
      className={styles.cell} 
      style={{ '--bg-color': active ? '#2563eb' : 'transparent' }}
    >
      {children}
    </div>
  );
}`,
    monitoringMetrics: [
      "JavaScript execution duration spent in styling library functions (`css`, `styled`) in Chrome DevTools",
      "Total number of injected `<style>` tags in `document.head` (>100 indicates runtime thrashing)",
      "Time to Interactive (TTI) degradation on data-dense views"
    ],
    productionChecklist: [
      "Migrate high-frequency, data-dense components from runtime CSS-in-JS to zero-runtime CSS (Tailwind, CSS Modules).",
      "Use CSS custom properties (variables) for dynamic runtime colors instead of generating new CSS-in-JS rules.",
      "Ensure style extraction occurs at build time to enable browser caching of static `.css` files."
    ]
  },
  {
    id: "react-prod-14",
    topic: "Broken Error Boundary Granularity Causing Complete App Whiteouts",
    category: "Resilience & Error Handling",
    severity: "P0 / Total Application Availability Collapse",
    theProblem: "An application has only a single root Error Boundary (or none at all). A minor formatting bug inside a non-critical sidebar widget (e.g. attempting to read `.avatar` on an undefined user) causes the entire application to crash. The user is greeted with a completely blank white screen or full-page error, losing their unsaved form work and active shopping cart.",
    howItWorksInternally: "In React 16+, an uncaught exception in any component's render phase causes React to unmount the entire component tree from the DOM root. React purposefully unmounts rather than leaving corrupt UI on screen because a corrupt UI can lead to accidental financial clicks or data corruption. If no intermediate boundary exists to catch the error, the root fiber unmounts, destroying the entire application DOM.",
    productionCode: `// 1. DISASTER ARCHITECTURE: Monolithic Root-only Boundary
// function BadApp() {
//   return (
//     <RootErrorBoundary>
//       <Navbar />
//       <MainArticle />
//       <FlakyCommentWidget /> {/* Crash here unmounts the ENTIRE APP! */}
//     </RootErrorBoundary>
//   );
// }

// 2. PRODUCTION ARCHITECTURE: Multi-Tiered Nested Error Boundaries
import { ErrorBoundary } from 'react-error-boundary';

function WidgetFallback({ error, resetErrorBoundary }) {
  return (
    <div className="widget-error-card">
      <p>Failed to load widget comments.</p>
      <button onClick={resetErrorBoundary}>Retry Widget</button>
    </div>
  );
}

export function ResilientApp() {
  return (
    // Tier 1: Catches catastrophic navigation/routing failures
    <ErrorBoundary fallback={<div>Critical app failure. Please refresh.</div>}>
      <Navbar />
      <div className="main-layout">
        <MainArticle />

        {/* Tier 2: Isolated Widget Boundary */}
        {/* If FlakyCommentWidget throws, ONLY this widget unmounts! */}
        {/* Navbar and MainArticle remain 100% interactive and intact! */}
        <ErrorBoundary FallbackComponent={WidgetFallback}>
          <FlakyCommentWidget />
        </ErrorBoundary>
      </div>
    </ErrorBoundary>
  );
}`,
    monitoringMetrics: [
      "Root-level Error Boundary trigger counts in Sentry (P0 severity alert)",
      "User session abandonment immediately following component render exceptions",
      "Widget-level fallback render rates indicating specific localized instability"
    ],
    productionChecklist: [
      "Wrap every independent UI section (widgets, modals, data tables, sidebars) in its own localized Error Boundary.",
      "Provide working retry/reset handlers on error fallbacks to let users recover without reloading the page.",
      "Ensure all error boundaries forward `componentStack` telemetry to APM platforms for rapid debugging."
    ]
  }
];

// Validation
const ids = new Set();
productionTopics.forEach((topic, idx) => {
  if (!topic.id) throw new Error(`Topic at index ${idx} missing id`);
  if (ids.has(topic.id)) throw new Error(`Duplicate topic id: ${topic.id}`);
  ids.add(topic.id);
  if (!topic.topic) throw new Error(`Topic ${topic.id} missing topic`);
  if (!topic.category) throw new Error(`Topic ${topic.id} missing category`);
  if (!topic.severity) throw new Error(`Topic ${topic.id} missing severity`);
  if (!topic.theProblem) throw new Error(`Topic ${topic.id} missing theProblem`);
  if (!topic.howItWorksInternally) throw new Error(`Topic ${topic.id} missing howItWorksInternally`);
  if (!topic.productionCode) throw new Error(`Topic ${topic.id} missing productionCode`);
  if (!Array.isArray(topic.monitoringMetrics) || topic.monitoringMetrics.length === 0) throw new Error(`Topic ${topic.id} missing monitoringMetrics`);
  if (!Array.isArray(topic.productionChecklist) || topic.productionChecklist.length === 0) throw new Error(`Topic ${topic.id} missing productionChecklist`);
});

const outputPath = path.join(__dirname, '../data/react.production.json');
fs.writeFileSync(outputPath, JSON.stringify(productionTopics, null, 2), 'utf8');
console.log(`Successfully compiled 14 React production topics to ${outputPath}`);
