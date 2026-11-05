const { createCard } = require('../react_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 25,
    category: "Core Hooks Engine & Hook Rules",
    concept: "The Rules of Hooks & Linked List Dispatcher",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the two official Rules of Hooks, and why does React strictly enforce them under the hood?",
    quickAnswer: "Rules: 1) Only call Hooks at the top level (never in loops, conditions, or nested functions); 2) Only call Hooks from React function components or custom Hooks. Internally, React tracks hooks as an ordered singly linked list on the Fiber node; conditional calls corrupt the hook execution index.",
    detailedAnswer: "React does not identify hooks by a unique key or name; it relies entirely on the order in which hooks are called. Each Fiber node maintains a `memoizedState` pointer to the first Hook object, with each Hook pointing to `next`. If a hook call is wrapped in an `if` statement, subsequent hooks will read the wrong state slot from the linked list on renders where the condition toggles, catastrophically corrupting component state.",
    code: `// FORBIDDEN ANTI-PATTERN: Hook inside condition!
function BadProfile({ isAdmin }) {
  if (isAdmin) {
    // VIOLATION: Hook order changes between admin and regular users!
    useEffect(() => { loadAdminMetrics(); }, []);
  }
  const [theme, setTheme] = useState('dark'); // Index shifted! Crash!
}

// PRODUCTION PATTERN: Hook at top level; condition INSIDE hook
function GoodProfile({ isAdmin }) {
  useEffect(() => {
    if (isAdmin) {
      loadAdminMetrics();
    }
  }, [isAdmin]);

  const [theme, setTheme] = useState('dark'); // Stable linked list position
}`,
    recallHint: "Only call hooks at top level; React matches hooks by linear execution order on a linked list.",
    interviewTip: "Explain how React's ESLint plugin (`eslint-plugin-react-hooks`) enforces this at build time, and how the internal `workInProgressHook` moves pointer to `next` on each call.",
    tags: ["hooks", "rules-of-hooks", "fiber-internals", "linked-list"],
    practice: [
      "What happens internally inside React Fiber if you place a hook inside an if statement?",
      "Can custom hooks call other custom hooks conditionally?"
    ]
  }),

  createCard({
    idNum: 26,
    category: "Core Hooks Engine & Hook Rules",
    concept: "useState Under the Hood",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does `useState` work internally inside React Fiber's dispatcher architecture?",
    quickAnswer: "React maintains a current dispatcher (`ReactCurrentDispatcher.current`). On initial mount, `mountState` creates a Hook node with an update queue and initial value. On re-renders, `updateState` processes pending actions in the circular update queue and returns the computed state.",
    detailedAnswer: "When a component mounts, `mountState` initializes a Hook object: `{ memoizedState, baseState, baseQueue, queue, next }`. The `queue` stores pending updates. When you call the setter (`dispatchSetState`), React creates an update object and appends it to a circular linked list on `queue.pending`, then schedules a Fiber work pass with a specific Lane priority. During the re-render, React walks the update queue, merges functional updates, and caches the result on `memoizedState`.",
    code: `// Conceptual representation of Fiber Hook structure:
// fiber.memoizedState -> Hook1 -> Hook2 -> Hook3 -> null
//
// Hook Object Structure:
// {
//   memoizedState: 0,           // Current state value
//   baseState: 0,               // State before uncommitted updates
//   queue: {
//     pending: UpdateNode,      // Circular linked list of queued actions
//     dispatch: Function        // The stable 'setCount' reference
//   },
//   next: NextHookObject        // Pointer to next hook in component
// }`,
    recallHint: "Fiber memoizedState points to linked list of hooks; setter appends updates to circular queue.",
    interviewTip: "Mention that the setter function returned by `useState` is guaranteed to have a stable reference identity across all re-renders because it references the Fiber's queue dispatcher.",
    tags: ["useState", "fiber-internals", "update-queue", "lanes"],
    practice: [
      "Why is the setter function returned by useState guaranteed to be reference-stable across renders?",
      "How does React compute the final state when multiple functional updates are enqueued?"
    ]
  }),

  createCard({
    idNum: 27,
    category: "Core Hooks Engine & Hook Rules",
    concept: "useEffect Exhaustive Dependencies Rule",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why does the `eslint-plugin-react-hooks` enforce the exhaustive-deps rule, and why should you never lie about dependencies?",
    quickAnswer: "Omitting reactive values (props, state, or derived variables) from the dependency array causes stale closures, where the effect forever accesses outdated variable values from an old render snapshot.",
    detailedAnswer: "In JavaScript, functions close over variables in their enclosing scope. If an effect uses `count` or `userId` but omits it from `[]`, the effect function permanently retains the snapshot from the initial render. The exhaustive-deps lint rule ensures that whenever any reactive value changes, the effect is torn down and re-executed with the freshest values. If an effect runs too often, the fix is to extract functions, use functional updaters, or refine state, not to suppress the linter.",
    code: `// ANTI-PATTERN: Lying to linter! (Suppresses warning, creates stale closure)
useEffect(() => {
  const timer = setInterval(() => {
    // 'count' is permanently 0 from mount snapshot!
    console.log('Current count:', count);
  }, 1000);
  return () => clearInterval(timer);
}, []); // eslint-disable-line react-hooks/exhaustive-deps

// PRODUCTION PATTERN A: Functional state update eliminates 'count' dependency
useEffect(() => {
  const timer = setInterval(() => {
    setCount(prev => prev + 1); // No 'count' variable needed in deps!
  }, 1000);
  return () => clearInterval(timer);
}, []); // Empty array is now 100% truthful!`,
    recallHint: "Every reactive value used in effect MUST be in deps; never disable linter; use functional updates to remove deps.",
    interviewTip: "Never say 'I just disable the lint rule' in an interview. Explain how to legitimately remove dependencies by moving code inside the effect or using functional updates.",
    tags: ["useEffect", "exhaustive-deps", "stale-closures", "linting"],
    practice: [
      "How can you remove an object or function from useEffect dependencies without disabling lint rules?",
      "Why is ref.current safely omitted from useEffect dependencies?"
    ]
  }),

  createCard({
    idNum: 28,
    category: "Core Hooks Engine & Hook Rules",
    concept: "useEffect Cleanup Function Execution Order",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When exactly does the cleanup function returned by `useEffect` execute in a component's lifecycle?",
    quickAnswer: "The cleanup function runs: 1) Before the effect re-runs on subsequent renders with changed dependencies; and 2) When the component unmounts from the DOM.",
    detailedAnswer: "A common misconception is that cleanup only runs on unmount. If an effect depends on `[userId]`, when `userId` changes from 1 to 2, React first runs the cleanup function for user 1 (e.g. unsubscribing from user 1's socket channel), and then executes the effect setup for user 2. This guarantees that stale subscriptions or pending async operations are cleanly terminated before new ones begin.",
    code: `useEffect(() => {
  console.log(\`[SETUP] Subscribing to chat room: \${roomId}\`);
  const connection = createChatConnection(roomId);
  connection.connect();

  return () => {
    console.log(\`[CLEANUP] Disconnecting from chat room: \${roomId}\`);
    connection.disconnect();
  };
}, [roomId]);

// Execution log when roomId changes from 'general' to 'dev':
// 1. [SETUP] Subscribing to chat room: general
// (User clicks to switch room to 'dev')
// 2. [CLEANUP] Disconnecting from chat room: general
// 3. [SETUP] Subscribing to chat room: dev`,
    recallHint: "Cleanup runs BEFORE effect re-runs with new props AND on final unmount.",
    interviewTip: "Trace the execution order step-by-step: setup(old) -> re-render -> cleanup(old) -> setup(new) -> unmount -> cleanup(new).",
    tags: ["useEffect", "cleanup", "lifecycle", "subscriptions"],
    practice: [
      "What happens if an effect cleanup function returns a Promise?",
      "Why does React 18 Strict Mode run setup -> cleanup -> setup immediately on initial mount in development?"
    ]
  }),

  createCard({
    idNum: 29,
    category: "Core Hooks Engine & Hook Rules",
    concept: "useEffect vs useLayoutEffect",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the critical timing difference between `useEffect` and `useLayoutEffect`, and when MUST you use `useLayoutEffect`?",
    quickAnswer: "`useEffect` runs asynchronously after the browser paints screen pixels. `useLayoutEffect` runs synchronously after DOM mutations but before the browser paints. Use `useLayoutEffect` only for measuring DOM layout or synchronously mutating styles to prevent visual flicker.",
    detailedAnswer: "If you measure an element's DOM dimensions (e.g., `element.getBoundingClientRect()`) and adjust position in `useEffect`, the browser paints the initial position, and then immediately repaints the adjusted position, causing an ugly visual flicker (layout shift). `useLayoutEffect` executes in the same tick as the commit phase, blocking the browser paint until your layout adjustments finish, ensuring smooth visual presentation.",
    code: `import { useState, useLayoutEffect, useRef } from 'react';

function Tooltip({ targetRect }) {
  const ref = useRef(null);
  const [tooltipHeight, setTooltipHeight] = useState(0);

  // useLayoutEffect runs BEFORE browser paints to screen:
  useLayoutEffect(() => {
    const { height } = ref.current.getBoundingClientRect();
    setTooltipHeight(height); // Synchronous update: zero visible flicker!
  }, []);

  return (
    <div 
      ref={ref} 
      style={{ top: targetRect.top - tooltipHeight }}
      className="tooltip"
    >
      Tooltip text
    </div>
  );
}`,
    recallHint: "useEffect = async after paint; useLayoutEffect = sync before paint (for DOM measurements/flicker prevention).",
    interviewTip: "Always advise using `useEffect` by default (99% of cases) because `useLayoutEffect` blocks the browser main thread and delays screen paint.",
    tags: ["useLayoutEffect", "useEffect", "paint-timing", "dom-measurement"],
    practice: [
      "Why does useLayoutEffect cause an SSR warning in Next.js or React Server environments?",
      "What is the browser event loop sequence relative to the commit phase and paint?"
    ]
  }),

  createCard({
    idNum: 30,
    category: "Core Hooks Engine & Hook Rules",
    concept: "useRef for DOM Access vs Mutable Instance Variables",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the two primary use cases of `useRef`, and how does it differ fundamentally from `useState`?",
    quickAnswer: "`useRef` returns a persistent mutable object `{ current: value }`. Use cases: 1) Direct reference to a real DOM node; 2) Storing mutable values across renders without triggering a re-render when mutated. Unlike `useState`, mutating `ref.current` does not schedule a re-render.",
    detailedAnswer: "`useRef` acts like an instance variable on a class component. Because React does not track mutations to `ref.current`, changing it is purely synchronous and creates zero reconciliation overhead. This makes it ideal for timer IDs, previous prop tracking, animation frame handles, and tracking whether a component has completed its initial mount. When attached to a JSX element (`<input ref={myRef} />`), React populates `.current` with the underlying browser DOM element on commit.",
    code: `function Stopwatch() {
  const [seconds, setSeconds] = useState(0);
  // Mutable container for timer ID (doesn't trigger re-renders)
  const timerIdRef = useRef(null);
  // Reference to DOM element for focus
  const inputRef = useRef(null);

  const start = () => {
    if (timerIdRef.current) return;
    timerIdRef.current = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
  };

  const stop = () => {
    clearInterval(timerIdRef.current);
    timerIdRef.current = null; // Mutation doesn't re-render
    inputRef.current?.focus(); // Direct DOM manipulation
  };

  return (
    <div>
      <h1>Time: {seconds}</h1>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
      <input ref={inputRef} placeholder="Note timestamp..." />
    </div>
  );
}`,
    recallHint: "useRef = persistent mutable box { current }; mutating it NEVER triggers re-render; used for DOM + instance variables.",
    interviewTip: "Never read or write `ref.current` during the render phase! Writing to refs in render body makes components impure and breaks concurrent rendering.",
    tags: ["useRef", "dom", "instance-variables", "mutable-state"],
    practice: [
      "Why should you never write to ref.current during the component render phase?",
      "How do you implement a `usePrevious` custom hook using useRef?"
    ]
  }),

  createCard({
    idNum: 31,
    category: "Core Hooks Engine & Hook Rules",
    concept: "Stale Closures in Hooks & Solutions",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a stale closure in React hooks, why does it occur, and what are the three best ways to resolve it?",
    quickAnswer: "A stale closure occurs when a callback or effect captures state/prop variables from an older render snapshot and continues executing with those outdated values. Fixes: 1) Functional state updates; 2) Adding all dependencies to deps array; 3) Storing the callback or value in a mutable `useRef`.",
    detailedAnswer: "JavaScript functions maintain references to the lexical scope in which they were created. When an effect or callback is initialized with an empty dependency array (`[]`), its closure is permanently frozen to the initial render scope. If that callback accesses `count`, it will always see `0`, even after `count` is updated. To fix this: use `setCount(c => c + 1)`, include `count` in the dependency array, or mirror the latest value into `latestRef.current = count`.",
    code: `// STALE CLOSURE PROBLEM:
function StaleCounter() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      // Stale! 'count' is always 0 inside this closure!
      setCount(count + 1); 
    }, 1000);
    return () => clearInterval(id);
  }, []); // 'count' missing from deps

  return <h1>{count}</h1>; // Stays permanently at 1!
}

// SOLUTION 1: Functional update (Eliminates dependency)
setCount(prev => prev + 1);

// SOLUTION 2: Latest Ref Pattern (For event callbacks)
const countRef = useRef(count);
countRef.current = count; // Always mirrors latest render value`,
    recallHint: "Stale closure = callback frozen on old render snapshot; fix with functional updater or latestRef pattern.",
    interviewTip: "The 'Latest Ref Pattern' (`useEffectEvent` in React experimental) is the industry standard for reading fresh state inside subscriptions without re-triggering the subscription effect.",
    tags: ["stale-closures", "closures", "debugging", "hooks"],
    practice: [
      "How does the experimental `useEffectEvent` hook solve the stale closure vs effect re-trigger dilemma?",
      "Can useCallback produce stale closure bugs if its dependency array is incomplete?"
    ]
  }),

  createCard({
    idNum: 32,
    category: "Core Hooks Engine & Hook Rules",
    concept: "Data Fetching in useEffect & AbortController Race Defense",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you fetch data inside `useEffect` while properly defending against network race conditions and memory leaks?",
    quickAnswer: "Use browser `AbortController` in the effect setup and call `controller.abort()` in the cleanup function, or use an `isCancelled` boolean flag to discard out-of-order network responses.",
    detailedAnswer: "Network requests are asynchronous and non-deterministic. If a user quickly switches from User ID 1 to User ID 2, the request for User 1 might finish *after* the request for User 2 due to network latency, overwriting fresh data with stale data (race condition). Using `AbortController` cleanly cancels the in-flight HTTP fetch when dependencies change or the component unmounts.",
    code: `function UserProfile({ userId }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    async function loadUser() {
      try {
        const res = await fetch(\`/api/users/\${userId}\`, {
          signal: controller.signal
        });
        const data = await res.json();
        setUser(data);
      } catch (err) {
        if (err.name !== 'AbortError') {
          console.error('Fetch error:', err);
        }
      } finally {
        setLoading(false);
      }
    }

    loadUser();

    // Cleanup aborts in-flight fetch if userId changes or component unmounts!
    return () => controller.abort();
  }, [userId]);

  if (loading) return <p>Loading...</p>;
  return <div>{user?.name}</div>;
}`,
    recallHint: "AbortController in setup + controller.abort() in cleanup terminates out-of-order stale network requests.",
    interviewTip: "Acknowledge that for production apps, dedicated data-fetching solutions like React Query, SWR, or React 19 Server Components / Actions are preferred over raw useEffect fetching.",
    tags: ["data-fetching", "race-conditions", "AbortController", "useEffect"],
    practice: [
      "Why is ignoring 'AbortError' in catch blocks necessary when using AbortController?",
      "What is the difference between an AbortController approach and an `let ignored = false` flag?"
    ]
  }),

  createCard({
    idNum: 33,
    category: "Core Hooks Engine & Hook Rules",
    concept: "Synchronizing with Window Events & Subscriptions",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the proper pattern for subscribing to browser window events (resize, scroll, online status) in React?",
    quickAnswer: "Attach the event listener inside `useEffect` and always remove the exact same callback reference in the cleanup function.",
    detailedAnswer: "Attaching listeners to `window` or `document` without cleanup creates memory leaks and duplicate handler invocations on every render. Because the cleanup runs before the effect re-attaches and upon unmount, using a stable handler or extracting it inside the effect ensures listeners are cleanly managed.",
    code: `import { useState, useEffect } from 'react';

function useWindowWidth() {
  const [width, setWidth] = useState(() => 
    typeof window !== 'undefined' ? window.innerWidth : 1024
  );

  useEffect(() => {
    const handleResize = () => setWidth(window.innerWidth);
    
    // Attach listener
    window.addEventListener('resize', handleResize);
    
    // Cleanup removes listener!
    return () => window.removeEventListener('resize', handleResize);
  }, []); // Run once on mount

  return width;
}`,
    recallHint: "addEventListener in effect body -> removeEventListener in cleanup; pass identical function reference.",
    interviewTip: "For global browser subscriptions in React 18+, point out that `useSyncExternalStore` is now the officially recommended API over `useEffect` + `useState` to prevent tearing.",
    tags: ["subscriptions", "window-events", "cleanup", "custom-hooks"],
    practice: [
      "Why will `removeEventListener('resize', () => ...)` fail to clean up a listener?",
      "How does `useSyncExternalStore` provide a better subscription model than useEffect?"
    ]
  }),

  createCard({
    idNum: 34,
    category: "Core Hooks Engine & Hook Rules",
    concept: "useInsertionEffect for CSS-in-JS Libraries",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is `useInsertionEffect` and why was it specifically introduced in React 18 for CSS-in-JS libraries?",
    quickAnswer: "`useInsertionEffect` executes synchronously before any DOM mutations or layout calculations occur. It is designed exclusively for CSS-in-JS libraries to inject `<style>` tags into the DOM before `useLayoutEffect` reads layout.",
    detailedAnswer: "In React 18 Concurrent Rendering, inserting `<style>` tags during render or `useLayoutEffect` forces the browser to recalculate layouts multiple times during a single frame. `useInsertionEffect` runs before all layout effects, guaranteeing that styles are already present in the DOM when layout measurements are computed, avoiding layout thrashing. It has no access to refs and is not meant for general application code.",
    code: `import { useInsertionEffect } from 'react';

// For CSS-in-JS library authors (e.g. styled-components / emotion):
function useCSS(cssString) {
  useInsertionEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.textContent = cssString;
    document.head.appendChild(styleTag);

    return () => {
      document.head.removeChild(styleTag);
    };
  }, [cssString]);
}`,
    recallHint: "useInsertionEffect = runs BEFORE DOM mutations/layout effects; strictly for CSS-in-JS style injection.",
    interviewTip: "Clarify that normal application developers should never need `useInsertionEffect`; it was designed specifically for library authors like Emotion and Styled-Components.",
    tags: ["useInsertionEffect", "react18", "css-in-js", "internals"],
    practice: [
      "In what order do useInsertionEffect, useLayoutEffect, and useEffect fire relative to each other?",
      "Why is accessing refs forbidden inside useInsertionEffect?"
    ]
  }),

  createCard({
    idNum: 35,
    category: "Core Hooks Engine & Hook Rules",
    concept: "React 18 StrictMode Double-Invoking Effects",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why does React 18 StrictMode run effects twice in development (`mount -> cleanup -> mount`), and how should you write code to handle it?",
    quickAnswer: "StrictMode double-invokes effects in development to simulate immediate unmounting and remounting. This proactively detects missing cleanup functions, dangling subscriptions, and broken state assumptions to prepare apps for future Fast Refresh and Offscreen rendering.",
    detailedAnswer: "Many developers write effects that fail to clean up (e.g., adding a listener or incrementing an external counter without undoing it). When React mounts the component in development, it executes: `setup() -> cleanup() -> setup()`. If your effect is written correctly (with idempotent setup and cleanup), the component remains in the exact expected state. Do not use hacky `hasMountedRef` booleans to prevent the second run; ensure your cleanup properly mirrors setup.",
    code: `// INCORRECT WORKAROUND: Don't use refs to defeat StrictMode!
// const hasRun = useRef(false);
// if (hasRun.current) return;
// hasRun.current = true;

// PROPER PRODUCTION PATTERN: Idempotent setup + cleanup
useEffect(() => {
  const dialog = dialogRef.current;
  dialog?.showModal(); // Setup opens modal

  // Cleanup properly closes modal on simulated unmount:
  return () => {
    dialog?.close();
  };
}, []);`,
    recallHint: "StrictMode runs mount -> unmount -> mount to enforce cleanups; write idempotent setup/cleanup pairs.",
    interviewTip: "If asked 'why is my API called twice in development', explain React 18 StrictMode's intent to verify remounting resiliency for Concurrent features.",
    tags: ["strict-mode", "react18", "effects", "idempotence"],
    practice: [
      "Does React 18 StrictMode double-invoke effects in production builds?",
      "Why is disabling StrictMode a poor solution to double API calls?"
    ]
  }),

  createCard({
    idNum: 36,
    category: "Core Hooks Engine & Hook Rules",
    concept: "When NOT to Use useEffect",
    priority: "must-know",
    difficulty: "intermediate",
    question: "According to modern React guidelines, what are the three most common scenarios where `useEffect` is anti-pattern and should be avoided?",
    quickAnswer: "1) Transforming data for rendering (calculate during render instead); 2) Handling user events (put logic in event handlers); 3) Resetting state on prop change (use `key={id}` instead).",
    detailedAnswer: "`useEffect` is an escape hatch for synchronizing with external systems (network, DOM, subscriptions). Using it to update state based on other state (`setFiltered(items.filter(...))`) causes an unnecessary second render pass. Handling button clicks in effects via trigger flags (`setIsSubmitted(true) -> useEffect`) splits causality and creates spaghetti code. Always perform transformations synchronously during render or directly inside event callbacks.",
    code: `// ANTI-PATTERN: Using effect to update state after prop change
function BadProduct({ product }) {
  const [comments, setComments] = useState([]);
  
  useEffect(() => {
    setComments([]); // EXTRA RENDER PASS!
  }, [product.id]);
}

// PRODUCTION PATTERN: Use key to naturally reset component tree
function GoodApp({ product }) {
  // Changing key automatically mounts a fresh component with pristine initial state!
  return <ProductComments key={product.id} productId={product.id} />;
}`,
    recallHint: "Don't use useEffect for: 1) derived data; 2) user event handling; 3) resetting state on prop change.",
    interviewTip: "Reference the official React docs article 'You Might Not Need an Effect'. Demonstrating restraint with `useEffect` is the hallmark of a senior React developer.",
    tags: ["useEffect", "anti-patterns", "clean-code", "best-practices"],
    practice: [
      "Why is code inside an event handler easier to trace and debug than code inside an effect?",
      "How do you notify a parent component of a change without using useEffect?"
    ]
  })
];
