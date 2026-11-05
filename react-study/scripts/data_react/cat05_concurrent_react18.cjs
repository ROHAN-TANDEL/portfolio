const { createCard } = require('../react_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 49,
    category: "React 18 Concurrent Rendering",
    concept: "Concurrent Rendering & Time Slicing",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is React 18 Concurrent Rendering, and how does time-slicing prevent the browser UI from freezing during heavy renders?",
    quickAnswer: "Concurrent Rendering allows React to pause, resume, prioritize, and discard render work in memory without blocking the browser main thread. Time-slicing breaks large component tree renders into small chunks (5ms), yielding control back to the browser between chunks to process user input.",
    detailedAnswer: "In React 17 and earlier, rendering was strictly synchronous and blocking: once React started rendering a component tree, it could not be interrupted until the entire tree was complete. If a render took 100ms, the main thread was frozen, causing dropped frames, unresponsive typing, and jank. In React 18 Concurrent Mode, the Scheduler uses cooperative multitasking via `MessageChannel` to slice rendering into 5ms intervals. If a user clicks or types while React is rendering, React yields to handle the urgent input immediately, then resumes or restarts the background work.",
    code: `// Conceptual architecture of Concurrent Time Slicing:
// [Fiber Chunk 1 (5ms)] -> Yield to Browser (Paint/Events) ->
// [Fiber Chunk 2 (5ms)] -> Yield to Browser (Paint/Events) ->
// [Fiber Chunk 3 (5ms)] -> Commit minimal DOM mutations!

// Urgent input (typing) interrupts non-urgent background render (filtering 10,000 items)
import { useState, useTransition } from 'react';

function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  const handleInput = (e) => {
    // 1. Urgent update: Input updates immediately (zero typing lag)
    setQuery(e.target.value);

    // 2. Non-urgent transition: Can be paused or interrupted by more typing!
    startTransition(() => {
      setResults(filterTenThousandItems(e.target.value));
    });
  };

  return <input value={query} onChange={handleInput} />;
}`,
    recallHint: "Concurrent mode = interruptible rendering + time-slicing; yields main thread every 5ms to handle urgent user inputs.",
    interviewTip: "Emphasize that Concurrent Rendering works in memory on the Fiber tree. React will never commit a half-finished, partial DOM update to the real screen—only completed trees are committed.",
    tags: ["concurrent-mode", "react18", "time-slicing", "scheduler"],
    practice: [
      "How does the React Scheduler yield execution back to the browser main thread?",
      "Why does React discard an in-progress transition if a newer transition arrives?"
    ]
  }),

  createCard({
    idNum: 50,
    category: "React 18 Concurrent Rendering",
    concept: "useTransition & startTransition",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is `useTransition` in React 18, and how does it differentiate urgent updates from non-urgent transition updates?",
    quickAnswer: "`useTransition` marks specific state updates as non-urgent 'transitions'. Urgent updates (typing, clicking) render immediately, while transitions run in the background with lower lane priority. It returns `[isPending, startTransition]`.",
    detailedAnswer: "User interactions divide naturally into urgent updates (direct physical manipulation like typing in an input, dragging a slider, or pressing a button) and non-urgent secondary updates (filtering a list, rendering a chart, switching tabs). By wrapping secondary state updates inside `startTransition(() => { setFilter(...) })`, React keeps the input responsive at 60 FPS while rendering the heavy list in the background. `isPending` provides a boolean to display an inline loading indicator without unmounting current content.",
    code: `import { useState, useTransition } from 'react';

function TabContainer() {
  const [tab, setTab] = useState('home');
  const [isPending, startTransition] = useTransition();

  const selectTab = (newTab) => {
    startTransition(() => {
      setTab(newTab); // Low priority background render
    });
  };

  return (
    <div>
      <TabButton active={tab === 'home'} onClick={() => selectTab('home')}>Home</TabButton>
      <TabButton active={tab === 'analytics'} onClick={() => selectTab('analytics')}>
        Analytics {isPending && '(Loading...)'}
      </TabButton>
      <div style={{ opacity: isPending ? 0.7 : 1 }}>
        {tab === 'home' ? <HomeView /> : <HeavyAnalyticsView />}
      </div>
    </div>
  );
}`,
    recallHint: "useTransition returns [isPending, startTransition]; urgent input renders immediately; transition renders in background.",
    interviewTip: "Highlight the UX benefit: `isPending` allows you to keep the existing UI interactive and visible with a subtle spinner, rather than completely replacing the screen with a jarring fallback blank screen.",
    tags: ["useTransition", "startTransition", "react18", "concurrency"],
    practice: [
      "Can startTransition wrap asynchronous code like `async () => await fetch()` in React 18?",
      "What is the difference between `startTransition` standalone vs `useTransition` hook?"
    ]
  }),

  createCard({
    idNum: 51,
    category: "React 18 Concurrent Rendering",
    concept: "useDeferredValue for Slow Child Components",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does `useDeferredValue` work, and when should you choose it over `useTransition`?",
    quickAnswer: "`useDeferredValue` accepts a value and returns a deferred version that lags behind during urgent updates. Use `useDeferredValue` when you receive a value via props and do not have access to or control over the `setState` call that updates it.",
    detailedAnswer: "While `useTransition` wraps a state setter call, `useDeferredValue` wraps a raw value (such as a prop passed from an external parent). When the prop updates urgently, React first renders the component with the *stale deferred value* so the urgent update is instantaneous. Immediately afterward, React initiates a background transition render to catch up with the *new deferred value*. Comparing `value !== deferredValue` lets you visually dim outdated content.",
    code: `import { useDeferredValue, memo } from 'react';

// Child component receives text prop
function SearchResults({ text }) {
  // text updates immediately with every keystroke;
  // deferredText lags behind while typing is active!
  const deferredText = useDeferredValue(text);
  const isStale = text !== deferredText;

  return (
    <div style={{ opacity: isStale ? 0.5 : 1 }}>
      <HeavyList query={deferredText} />
    </div>
  );
}

// HeavyList MUST be memoized so it skips re-rendering on the first urgent pass!
const HeavyList = memo(function HeavyList({ query }) {
  // Computes thousands of items...
  return <ul>{/* ... */}</ul>;
});`,
    recallHint: "useDeferredValue lags behind urgent updates; use when receiving values via props without direct setter access.",
    interviewTip: "Crucial detail: The child component using `deferredValue` MUST be wrapped in `React.memo` or pass the value into `useMemo`, otherwise it re-renders immediately anyway with the old value, defeating the optimization.",
    tags: ["useDeferredValue", "react18", "performance", "props"],
    practice: [
      "Why must the component consuming useDeferredValue be wrapped in React.memo?",
      "How does useDeferredValue compare to traditional lodash debounce?"
    ]
  }),

  createCard({
    idNum: 52,
    category: "React 18 Concurrent Rendering",
    concept: "Automatic Batching Across Microtasks & Timeouts",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is Automatic Batching in React 18 and how does it differ from batching in React 17 and earlier?",
    quickAnswer: "Automatic Batching groups multiple state updates into a single re-render for better performance. React 17 only batched updates inside React synthetic event handlers; React 18 batches updates everywhere, including promises, `setTimeout`, and native DOM listeners.",
    detailedAnswer: "In React 17, calling two `setState` calls inside a `fetch().then()` or a `setTimeout` resulted in two separate component re-renders. In React 18, all state updates regardless of origin are automatically batched into a single render pass. If you ever have a rare scenario where you must force an immediate synchronous DOM flush, React provides `flushSync` as an escape hatch.",
    code: `// In React 17: Triggered 2 separate re-renders!
// In React 18: Automatically batched into 1 re-render!
function handleFetch() {
  fetch('/api/user').then(() => {
    setIsLoading(false); // Update 1
    setUser(data);        // Update 2
    // React 18 batches both: Only ONE render occurs!
  });
}

// Escape hatch: flushSync (forces immediate synchronous render)
import { flushSync } from 'react-dom';

function handleEmergencyUpdate() {
  flushSync(() => {
    setCount(c => c + 1); // Flushed to DOM immediately!
  });
  // DOM is already updated here!
}`,
    recallHint: "React 18 batches all state updates across promises, timeouts, and native events into a single re-render.",
    interviewTip: "Explain `flushSync`: it is generally discouraged because it de-optimizes rendering, but is necessary for third-party imperative libraries (e.g. measuring DOM immediately after state change).",
    tags: ["automatic-batching", "react18", "flushSync", "performance"],
    practice: [
      "What are the downsides of using flushSync?",
      "How does Automatic Batching affect the timing of useEffect triggers?"
    ]
  }),

  createCard({
    idNum: 53,
    category: "React 18 Concurrent Rendering",
    concept: "React 18 Root API: createRoot vs ReactDOM.render",
    priority: "must-know",
    difficulty: "beginner",
    question: "Why did React 18 replace `ReactDOM.render` with `createRoot`, and what happens if you keep using the legacy API?",
    quickAnswer: "`createRoot` enables all new React 18 features (Concurrent Rendering, Automatic Batching, Transitions, Suspense SSR). Using legacy `ReactDOM.render` runs React in 'legacy mode', disabling concurrent features and logging deprecation warnings.",
    detailedAnswer: "The new Root API (`ReactDOM.createRoot(container).render(<App />)`) creates a concurrent root Fiber node capable of managing priority lanes, cooperative scheduling, and selective hydration. In older React, multiple calls to `render()` re-passed the container. With `createRoot`, the root container is initialized once, and the root object holds the lifecycle reference.",
    code: `// 1. LEGACY REACT 17 API (Deprecated, runs in sync legacy mode):
import ReactDOM from 'react-dom';
ReactDOM.render(<App />, document.getElementById('root'));

// 2. MODERN REACT 18+ API (Enables concurrent rendering):
import { createRoot } from 'react-dom/client';

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);

// Unmounting in React 18:
// root.unmount();`,
    recallHint: "createRoot from 'react-dom/client' enables React 18 concurrent features; ReactDOM.render is deprecated legacy mode.",
    interviewTip: "Point out that `createRoot` is imported from `'react-dom/client'`, not `'react-dom'`, reflecting the package separation for client vs server runtimes.",
    tags: ["createRoot", "react18", "initialization", "breaking-changes"],
    practice: [
      "Why was the client entrypoint moved to 'react-dom/client'?",
      "What happens if you use `useTransition` inside an app initialized with `ReactDOM.render`?"
    ]
  }),

  createCard({
    idNum: 54,
    category: "React 18 Concurrent Rendering",
    concept: "useId for Collision-Free SSR-Safe Identifiers",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What problem does `useId` solve in React 18, and why should you avoid manual counters or `Math.random()` for HTML IDs?",
    quickAnswer: "`useId` generates unique, stable IDs across client and server renders. Using `Math.random()` causes hydration mismatch errors because server and client IDs differ; global counters break with out-of-order streaming SSR.",
    detailedAnswer: "In accessibility (a11y), elements like `<label htmlFor='id'>` and `<input id='id'>` or `aria-describedby` require matching IDs. If you generate IDs with `Math.random()`, the server HTML gets ID `:r1:` while the client hydration generates `:r2:`, causing a React hydration crash. `useId` derives IDs based on the component's hierarchical position in the Fiber tree, ensuring 100% deterministic matching across SSR and out-of-order streaming.",
    code: `import { useId } from 'react';

function AccessibleFormField({ label, helperText }) {
  const inputId = useId();
  const helperId = useId();

  return (
    <div>
      <label htmlFor={inputId}>{label}</label>
      <input 
        id={inputId} 
        aria-describedby={helperId} 
      />
      <p id={helperId} className="helper">{helperText}</p>
    </div>
  );
}
// Outputs deterministic IDs like :r1: and :r2: guaranteed to match on server and client!`,
    recallHint: "useId generates deterministic, tree-position-based IDs; avoids hydration mismatches in a11y labels.",
    interviewTip: "Warn that `useId` is NOT meant for generating keys in a mapped list (`key={useId()}`). Keys must be generated from your entity data IDs, not the useId hook.",
    tags: ["useId", "accessibility", "ssr", "hydration"],
    practice: [
      "Why is using `useId()` as a `key` prop inside a `.map()` an anti-pattern?",
      "How does useId support multiple IDs with prefixes in the same component?"
    ]
  }),

  createCard({
    idNum: 55,
    category: "React 18 Concurrent Rendering",
    concept: "React 18 Scheduler & Lanes Priority System",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does React 18's internal 'Lanes' model prioritize different types of state updates?",
    quickAnswer: "React 18 uses 31 bitmask 'Lanes' to represent priority levels for updates. Discrete user inputs (clicks, keypresses) get high-priority lanes (SyncLane), while transitions (`startTransition`) get low-priority lanes (TransitionLane), allowing React to interleave and preempt work.",
    detailedAnswer: "In React 16, priority was an integer-based expiration time system. React 18 replaced this with 32-bit bitmasks called Lanes. Lanes allow React to express multiple concurrent priorities, check overlapping updates with fast bitwise operations (`lane & mask`), and decouple priority from chronological order. If a low-priority TransitionLane is running and a SyncLane update (e.g. user typing) is dispatched, React halts the transition fiber work, flushes the SyncLane, and then resumes the transition.",
    code: `// Conceptual representation of React 18 Lanes bitmasks:
// const SyncLane:           Lane = 0b0000000000000000000000000000001; // Clicks, typing
// const InputContinuousLane: Lane = 0b0000000000000000000000000000010; // Drag, mousemove
// const DefaultLane:         Lane = 0b0000000000000000000000000100000; // Standard setState
// const TransitionLanes:     Lane = 0b0000000000011111111111111000000; // startTransition
// const IdleLane:            Lane = 0b0100000000000000000000000000000; // Offscreen work

// Bitwise check inside React Fiber engine:
// const hasHighPriorityWork = (workInProgressLanes & SyncLane) !== 0;`,
    recallHint: "Lanes = 31-bit bitmasks representing update priority; SyncLane (clicks) preempts TransitionLane (filtering).",
    interviewTip: "Explaining that Lanes use 32-bit bitmasks to enable lightning-fast bitwise priority checks is an impressive senior architectural insight.",
    tags: ["lanes", "scheduler", "fiber-internals", "concurrency"],
    practice: [
      "Why did React replace the older ExpirationTime model with the Lanes model?",
      "What happens to a low-priority lane if it is continuously starved by high-priority user typing?"
    ]
  }),

  createCard({
    idNum: 56,
    category: "React 18 Concurrent Rendering",
    concept: "Suspense for Data Fetching & Boundary Fallbacks",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does `<Suspense>` work under the hood when a child component suspends for data?",
    quickAnswer: "When a component suspends, it throws a Promise (or uses React 19's `use()` hook). The nearest `<Suspense>` ancestor catches the thrown promise, pauses rendering of that subtree, and renders its `fallback` UI until the promise resolves.",
    detailedAnswer: "Historically in JavaScript, throwing anything other than an `Error` terminates execution. React leverages throwing Promises as a protocol for asynchronous rendering. When a component reads from a pending resource, it throws the pending Promise. React catches it at the `<Suspense fallback={<Spinner/>}>` boundary, mounts the fallback, and attaches a `.then()` listener to the promise. When resolved, React re-renders the suspended component from where it left off with data available.",
    code: `import { Suspense } from 'react';

// Parent wraps async child in Suspense boundary
function ProfilePage({ userId }) {
  return (
    <div className="layout">
      <h1>User Profile</h1>
      <Suspense fallback={<p>Loading profile details...</p>}>
        <UserDetails userId={userId} />
      </Suspense>
      <Suspense fallback={<p>Loading user feed...</p>}>
        <UserPosts userId={userId} />
      </Suspense>
    </div>
  );
}`,
    recallHint: "Component throws a Promise -> nearest Suspense catches it and renders fallback -> resumes when resolved.",
    interviewTip: "Highlight that Suspense allows coordinating loading states declaratively at parent boundaries rather than scattering 10 `if (loading) return <Spinner/>` statements inside every child component.",
    tags: ["suspense", "promises", "fallbacks", "async-rendering"],
    practice: [
      "How does Suspense prevent waterfall loading when multiple siblings suspend?",
      "What happens if an asynchronous error occurs inside a Suspense boundary without an ErrorBoundary?"
    ]
  }),

  createCard({
    idNum: 57,
    category: "React 18 Concurrent Rendering",
    concept: "Transitions vs Debouncing & Throttling",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why are React 18 Transitions (`useTransition`) fundamentally superior to traditional JavaScript debouncing or throttling?",
    quickAnswer: "Debounce and throttle use arbitrary artificial time delays (e.g. 300ms) that force fast devices to wait unnecessarily and still freeze on slow devices. Transitions have zero artificial delay; they adapt dynamically to device CPU speed.",
    detailedAnswer: "Debounce waits for user typing to pause for 300ms before starting. On a powerful M3 Mac, that 300ms is pure wasted latency. On an old budget phone, once the 300ms timer expires, the heavy render still blocks the main thread and freezes the screen! React Transitions start rendering *immediately* in the background. If a new keystroke arrives, React simply abandons the stale render and starts fresh. If the device is fast, results show instantly; if slow, typing remains responsive.",
    code: `// 1. LEGACY DEBOUNCE (Fixed 300ms lag on ALL devices):
const debouncedSearch = debounce((query) => {
  setResults(heavyFilter(query)); // Freezes main thread when timer ends!
}, 300);

// 2. REACT 18 TRANSITION (Zero artificial lag, responsive on all devices):
const handleSearch = (e) => {
  setQuery(e.target.value); // Immediate input update
  
  startTransition(() => {
    // Starts IMMEDIATELY in background; interrupts if user types again!
    setResults(heavyFilter(e.target.value));
  });
};`,
    recallHint: "Debounce = arbitrary timer delay; Transition = zero delay, interruptible rendering that adapts to CPU speed.",
    interviewTip: "This is one of the best conceptual questions: it demonstrates you understand *why* React built Concurrent Mode instead of relying on utility libraries like Lodash.",
    tags: ["transitions", "debouncing", "throttling", "performance-comparison"],
    practice: [
      "When is traditional debouncing still necessary even with React Transitions (e.g. rate-limiting backend API calls)?",
      "Can you combine debounce with startTransition?"
    ]
  }),

  createCard({
    idNum: 58,
    category: "React 18 Concurrent Rendering",
    concept: "UI Tearing & useSyncExternalStore",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is 'UI Tearing' in Concurrent Rendering, and why was `useSyncExternalStore` created to solve it?",
    quickAnswer: "Tearing occurs when a component tree renders with inconsistent values because an external global store mutated while React yielded during a time-sliced concurrent render. `useSyncExternalStore` guarantees synchronous, tearing-free reads from external stores.",
    detailedAnswer: "In Concurrent Mode, React may render half the tree in Chunk 1, yield to the browser for 5ms, and render the remaining half in Chunk 2. If an external store (Redux, Zustand, MobX, browser `window.innerWidth`) updates during that 5ms gap, components rendered in Chunk 1 show value A while components rendered in Chunk 2 show value B—a visual defect called 'tearing'. `useSyncExternalStore` forces a synchronous de-opt when an external store mutates during render, guaranteeing consistency.",
    code: `import { useSyncExternalStore } from 'react';

// Example: Subscribing to browser online status safely without tearing
function subscribe(callback) {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
}

function getSnapshot() {
  return navigator.onLine;
}

function useNetworkStatus() {
  // Guaranteed tearing-free across React 18 concurrent renders:
  return useSyncExternalStore(subscribe, getSnapshot);
}`,
    recallHint: "Tearing = inconsistent UI from external store mutating mid-render; useSyncExternalStore prevents tearing.",
    interviewTip: "Clarify that `useSyncExternalStore` is primarily intended for state management library authors (Redux, Zustand) or browser subscriptions, not normal local component state.",
    tags: ["useSyncExternalStore", "tearing", "concurrency", "react18"],
    practice: [
      "Why does `useEffect` + `useState` fail to prevent tearing in React 18 Concurrent Mode?",
      "What is the third `getServerSnapshot` argument in useSyncExternalStore used for?"
    ]
  }),

  createCard({
    idNum: 59,
    category: "React 18 Concurrent Rendering",
    concept: "SuspenseList for Coordinated Reveal",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is `SuspenseList` and how does it prevent jarring loading layout shifts when multiple components load in arbitrary order?",
    quickAnswer: "`SuspenseList` coordinates the reveal order of nested `<Suspense>` boundaries (e.g. `revealOrder='forwards'`, `together`, or `backwards`), preventing content pop-in and cumulative layout shifts (CLS).",
    detailedAnswer: "When a page has multiple independent `<Suspense>` boundaries (Header, Left Rail, Main Article, Comments), they resolve in arbitrary order based on network latency. If Comments finish before Article, Comments pop into the DOM first, only to be pushed down when Article finishes, causing layout jumping. `<SuspenseList revealOrder='forwards'>` ensures components are revealed strictly top-to-bottom, regardless of which network request arrived first.",
    code: `import { Suspense, SuspenseList } from 'react';

function FeedPage() {
  return (
    // Coordinates reveal order top-to-bottom:
    <SuspenseList revealOrder="forwards" tail="collapsed">
      <Suspense fallback={<SkeletonHeader />}>
        <Header />
      </Suspense>
      <Suspense fallback={<SkeletonBody />}>
        <ArticleBody />
      </Suspense>
      <Suspense fallback={<SkeletonComments />}>
        <CommentsList />
      </Suspense>
    </SuspenseList>
  );
}`,
    recallHint: "SuspenseList coordinates reveal order of sibling Suspense boundaries (forwards, together) to prevent layout shifts.",
    interviewTip: "Mention how `tail='collapsed'` shows only the next pending skeleton rather than rendering 10 stacked spinners simultaneously.",
    tags: ["SuspenseList", "suspense", "layout-shifts", "cls"],
    practice: [
      "What are the options for `revealOrder` in SuspenseList?",
      "How does SuspenseList improve Cumulative Layout Shift (CLS) web vitals?"
    ]
  }),

  createCard({
    idNum: 60,
    category: "React 18 Concurrent Rendering",
    concept: "Offscreen / Activity Pre-Rendering",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the React Offscreen (Activity) component, and how does it preserve component state and DOM when hiding views?",
    quickAnswer: "`<Activity mode='hidden'>` (formerly Offscreen) preserves component Fiber state and DOM nodes while visually detaching them, prerendering hidden tabs at low priority without unmounting them.",
    detailedAnswer: "Traditionally, switching tabs unmounted the inactive tab (`{activeTab === 'chat' && <Chat/>}`), completely destroying its internal state, scroll position, and input drafts. The alternate approach—hiding with CSS `display: none`—keeps all components active, meaning inactive tabs continue running effects, timers, and animations, wasting CPU. `<Activity mode={isActive ? 'visible' : 'hidden'}>` pauses all effects, lowers update priority to `IdleLane`, and preserves the complete DOM and Fiber state ready for instant reactivation.",
    code: `import { Activity } from 'react'; // React experimental / future

function TabManager({ currentTab }) {
  return (
    <div>
      <Activity mode={currentTab === 'inbox' ? 'visible' : 'hidden'}>
        <InboxTab />
      </Activity>
      <Activity mode={currentTab === 'settings' ? 'visible' : 'hidden'}>
        <SettingsTab />
      </Activity>
    </div>
  );
}`,
    recallHint: "Activity/Offscreen pauses effects and keeps Fiber/DOM state intact in background at IdleLane priority.",
    interviewTip: "Explain the difference between unmounting (loses state), CSS `display:none` (wastes CPU running effects), and `<Activity>` (preserves state, pauses effects).",
    tags: ["activity", "offscreen", "prerendering", "react-future"],
    practice: [
      "What happens to useEffect cleanups when an Activity component switches to hidden mode?",
      "How does Offscreen rendering power virtualized carousels and tab transitions?"
    ]
  })
];
