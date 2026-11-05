const { createCard } = require('../react_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 85,
    category: "State Management, Context API & useSyncExternalStore",
    concept: "Context API Provider-Consumer Architecture",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the React Context API, and what problem does it solve in deeply nested component hierarchies?",
    quickAnswer: "Context provides a way to pass data through the component tree without manually passing props down through every intermediate level (prop drilling). A `<Context.Provider value={data}>` provides data, and any descendant consumes it via `useContext(Context)`.",
    detailedAnswer: "When deeply nested components (such as an Avatar or ThemeToggle 6 levels down) require access to global data like authenticated user info, theme, or language localization, threading props through intermediate layout components that have no use for that data creates tightly coupled, brittle code. Context acts as an ambient teleporter: descendants subscribe directly to the Provider's value.",
    code: `import { createContext, useContext, useState } from 'react';

// 1. Create Context with default value
const ThemeContext = createContext('light');

// 2. Provider component wraps subtree
export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('dark');
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// 3. Any deeply nested descendant consumes context directly:
export function ThemedButton() {
  const { theme, setTheme } = useContext(ThemeContext);
  return (
    <button 
      className={theme} 
      onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
    >
      Current Theme: {theme}
    </button>
  );
}`,
    recallHint: "createContext() + <Context.Provider value={...}> + useContext(Context); teleports data past prop-drilling.",
    interviewTip: "Emphasize that Context is primarily for low-velocity, broadcast data (current user, theme, locale). It is NOT designed as a high-frequency transactional data store.",
    tags: ["context-api", "useContext", "prop-drilling", "architecture"],
    practice: [
      "What is the default value passed to createContext used for?",
      "Can a component consume multiple different contexts simultaneously?"
    ]
  }),

  createCard({
    idNum: 86,
    category: "State Management, Context API & useSyncExternalStore",
    concept: "Context Re-render Cascade & Context Splitting",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why does putting both state and setter in the same Context Provider trigger widespread unnecessary re-renders, and how does 'Context Splitting' solve it?",
    quickAnswer: "When a Context Provider's value object changes reference, ALL components consuming that context re-render, even if they only read a property that didn't change (e.g. only reading the setter). Context Splitting separates state from dispatchers into two distinct providers.",
    detailedAnswer: "In `<Context.Provider value={{ count, setCount }}>`, whenever `count` increments, a brand new object `{ count, setCount }` is instantiated. React's change detection checks `Object.is(prevVal, nextVal)`. Because the object reference is new, EVERY component calling `useContext(Context)` is forced to re-render. A button that *only* calls `setCount` will re-render needlessly. By splitting into `CountStateContext` and `CountDispatchContext`, dispatch-only components subscribe to a permanently stable reference and never re-render.",
    code: `import { createContext, useContext, useReducer } from 'react';

// Split into TWO distinct contexts:
const UserStateContext = createContext(null);
const UserDispatchContext = createContext(null);

export function UserProvider({ children }) {
  const [state, dispatch] = useReducer(userReducer, initialUser);

  return (
    // State context changes whenever data updates
    <UserStateContext.Provider value={state}>
      {/* Dispatch context is 100% reference-stable and NEVER changes! */}
      <UserDispatchContext.Provider value={dispatch}>
        {children}
      </UserDispatchContext.Provider>
    </UserStateContext.Provider>
  );
}

// Components that only mutate state NEVER re-render when state changes!
export function LogoutButton() {
  const dispatch = useContext(UserDispatchContext); // Stable! 0 unnecessary renders!
  return <button onClick={() => dispatch({ type: 'LOGOUT' })}>Log Out</button>;
}`,
    recallHint: "Split context into StateContext and DispatchContext; consumers of dispatch never re-render on data changes.",
    interviewTip: "Context Splitting is one of the most effective performance optimizations in React architecture; always recommend it when discussing Context API performance.",
    tags: ["context-splitting", "performance", "re-renders", "optimization"],
    practice: [
      "Why doesn't `React.memo` stop a component from re-rendering if it consumes a changed Context?",
      "How does memoizing the provider value with `useMemo` prevent re-renders caused by parent renders?"
    ]
  }),

  createCard({
    idNum: 87,
    category: "State Management, Context API & useSyncExternalStore",
    concept: "Context API is Not a State Management Tool",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why do React core team members state that 'Context is not a state management system, but a dependency injection mechanism'?",
    quickAnswer: "Context does not manage state; it merely transports state that is already managed by `useState` or `useReducer`. It lacks selector subscriptions, fine-grained change tracking, and middleware capabilities found in true state management libraries.",
    detailedAnswer: "State management involves: 1) Storing initial value; 2) Reading state; 3) Updating state; 4) Fine-grained subscribing. Context only does step #2 and #4 (and does step #4 coarseminded-ly without selectors). If an object has 50 fields in Context, changing field A re-renders components that only care about field B. In contrast, libraries like Redux, Zustand, and Jotai maintain external stores with selector subscriptions (`useStore(state => state.user.name)`), re-rendering ONLY when the selected slice changes.",
    code: `// CONTEXT API: Coarse subscription (Re-renders on ANY field change)
function UserEmail() {
  const { user } = useContext(GlobalContext); // Re-renders even if only user.avatar changed!
  return <span>{user.email}</span>;
}

// EXTERNAL STORE (Zustand / Redux): Fine-grained selector subscription
function OptimizedUserEmail() {
  // Re-renders ONLY if user.email strictly changes!
  const email = useStore(state => state.user.email);
  return <span>{email}</span>;
}`,
    recallHint: "Context = Dependency Injection transport; State Management = selectors, fine-grained updates, and middleware.",
    interviewTip: "Quote Mark Erikson (Redux maintainer): 'Context is a transport mechanism, not a state manager.' This distinction shows mature architectural judgment.",
    tags: ["context-vs-redux", "state-management", "selectors", "architecture"],
    practice: [
      "Why can't React Context support fine-grained selector subscriptions natively without external store hooks?",
      "When is Context completely sufficient vs when is an external store required?"
    ]
  }),

  createCard({
    idNum: 88,
    category: "State Management, Context API & useSyncExternalStore",
    concept: "Custom Context Hook Wrapper Guard Pattern",
    priority: "must-know",
    difficulty: "beginner",
    question: "Why should you never export raw Context objects directly, and how does the Custom Hook Guard Pattern improve developer ergonomics?",
    quickAnswer: "Exporting a custom hook wrapper (`useAuth()`) instead of raw `AuthContext` provides cleaner syntax, encapsulates context internals, and throws an immediate, descriptive error if the hook is called outside its `<AuthProvider>` tree.",
    detailedAnswer: "If a developer calls `useContext(AuthContext)` in a component that accidentally lives outside `<AuthProvider>`, `useContext` silently returns the default value (often `undefined` or `null`). Later in code, `auth.user.name` crashes with `TypeError: Cannot read properties of undefined`. Wrapping the context consumption in a custom hook asserts that the context is defined, throwing an explicit developer-friendly error.",
    code: `import { createContext, useContext } from 'react';

// 1. Keep context private to the module (DO NOT EXPORT RAW CONTEXT!)
const AuthContext = createContext(null);

// 2. Export Provider
export function AuthProvider({ children, value }) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// 3. Export custom hook with guard assertion:
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an <AuthProvider>');
  }
  return context;
}`,
    recallHint: "Don't export raw Context; export useAuth() with 'if (!context) throw Error' guard check.",
    interviewTip: "Always write your Context implementations with this guard pattern in interviews. It demonstrates professional defensive coding and clean API design.",
    tags: ["context-guard", "custom-hooks", "defensive-coding", "clean-architecture"],
    practice: [
      "Why is `throw new Error(...)` during render safer than returning a fallback dummy object?",
      "How does this guard pattern improve TypeScript type narrowing (eliminating `| null`)?"
    ]
  }),

  createCard({
    idNum: 89,
    category: "State Management, Context API & useSyncExternalStore",
    concept: "Collocating State (Pushing State Down)",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is 'Collocating State' (or 'Pushing State Down'), and why is it the easiest way to optimize React application performance?",
    quickAnswer: "Collocating state means keeping state as close as possible to where it is used. If only a small sub-tree cares about an open/closed toggle or input value, move that state down into that specific component rather than hoisting it to the top of the tree.",
    detailedAnswer: "A common performance pitfall is lifting all state to the top-level parent component. Whenever a user types in an input or toggles a dropdown, the massive parent component re-renders, forcing hundreds of uninvolved child components to re-render. By pushing the state down into an isolated leaf component (`<SearchInput />` or `<Collapsible />`), re-renders are completely localized, achieving 60 FPS without any `useMemo`, `useCallback`, or Redux.",
    code: `// ANTI-PATTERN: State lifted too high! Every keystroke re-renders EntireDashboard!
function BadDashboard() {
  const [searchTerm, setSearchTerm] = useState('');
  return (
    <div>
      <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
      <HeavyChart /> {/* Unnecessarily re-renders on every letter typed! */}
      <ComplexGrid /> {/* Unnecessarily re-renders! */}
    </div>
  );
}

// PRODUCTION PATTERN: Collocate state into isolated search widget
function SearchWidget() {
  const [searchTerm, setSearchTerm] = useState('');
  return <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />;
}

function GoodDashboard() {
  return (
    <div>
      <SearchWidget /> {/* Typing only re-renders SearchWidget! */}
      <HeavyChart />   {/* Completely unaffected! */}
      <ComplexGrid />  {/* Completely unaffected! */}
    </div>
  );
}`,
    recallHint: "Keep state as local as possible; pushing state down into leaf components eliminates 90% of re-render lag.",
    interviewTip: "Before reaching for complex memoization or external state libraries, always examine if state can simply be pushed down to isolate re-render scope.",
    tags: ["collocation", "pushing-state-down", "performance", "architecture"],
    practice: [
      "What is the inverse technique: 'Passing components as children to isolate state'?",
      "How do you share state when one leaf component legitimately needs to trigger a change in another?"
    ]
  }),

  createCard({
    idNum: 90,
    category: "State Management, Context API & useSyncExternalStore",
    concept: "Building an External Store with useSyncExternalStore",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you implement a lightweight, tearing-free global state store using `useSyncExternalStore`?",
    quickAnswer: "Create an external JavaScript object with a state snapshot, a set of subscriber callbacks, and a dispatch/setState method. Subscribe to it inside React using `useSyncExternalStore(store.subscribe, store.getSnapshot)`.",
    detailedAnswer: "An external store exists outside the React component tree. When state changes, the store invokes registered listener callbacks. `useSyncExternalStore` accepts: 1) `subscribe(notify)`: registers listeners; 2) `getSnapshot()`: returns the current immutable state; 3) `getServerSnapshot()` (optional): returns initial state during SSR. React guarantees synchronous, consistent reads across concurrent renders with zero UI tearing.",
    code: `import { useSyncExternalStore } from 'react';

// 1. External Vanilla JavaScript Store:
function createStore(initialState) {
  let state = initialState;
  const listeners = new Set();

  return {
    getState: () => state,
    setState: (updater) => {
      state = typeof updater === 'function' ? updater(state) : updater;
      listeners.forEach(fn => fn()); // Notify all React subscribers
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener); // Cleanup
    }
  };
}

const countStore = createStore({ count: 0 });

// 2. React Hook to consume store:
export function useCount() {
  const state = useSyncExternalStore(
    countStore.subscribe,
    countStore.getState,
    () => ({ count: 0 }) // SSR snapshot
  );
  return [state.count, countStore.setState];
}`,
    recallHint: "createStore(state, listeners) + useSyncExternalStore(subscribe, getSnapshot); powers modern state libraries.",
    interviewTip: "Mention that this exact pattern is how Zustand, Redux Toolkit, and Jotai integrate with React 18 and 19 under the hood.",
    tags: ["useSyncExternalStore", "external-store", "zustand-internals", "architecture"],
    practice: [
      "Why must getSnapshot return an immutable cached reference if state hasn't changed?",
      "What fatal error occurs if getSnapshot returns a new object reference on every invocation?"
    ]
  }),

  createCard({
    idNum: 91,
    category: "State Management, Context API & useSyncExternalStore",
    concept: "Selector Subscriptions & Shallow Equality Checks",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do selectors prevent re-renders in external state stores, and why is shallow equality comparison required for selected objects?",
    quickAnswer: "Selectors extract a specific slice of state (`state => state.user.name`). If that slice hasn't changed, the component skips re-rendering. If the selector returns a newly computed object, a custom shallow equality comparator (`shallow`) is needed to avoid infinite re-render loops.",
    detailedAnswer: "In modern stores (e.g. Zustand/Redux), passing `state => state.isOnline` returns a primitive boolean. If another part of state (like `notifications`) updates, `prevSelected === nextSelected` evaluates to `true`, and React skips re-rendering the subscriber. However, if a selector returns `{ name: state.firstName, age: state.age }`, a fresh object reference is created on every store notification. Using shallow comparison compares properties individually (`prev.name === next.name && prev.age === next.age`), preserving memoization.",
    code: `// In Zustand / Redux Toolkit with selectors:
// 1. Primitive slice: Automatic reference equality (Optimal!)
const isOnline = useUserStore(state => state.isOnline);

// 2. Computed object slice: Requires shallow equality comparison!
import { shallow } from 'zustand/shallow';

const { firstName, lastName } = useUserStore(
  state => ({ firstName: state.firstName, lastName: state.lastName }),
  shallow // Compares properties shallowly; skips render if values match!
);`,
    recallHint: "Selectors extract minimal state slices; use shallow comparison if selector returns a new object literal.",
    interviewTip: "Highlight the hazard of returning inline array maps or filtered lists in selectors without `useMemo` or shallow equality, which forces re-renders on every single global store dispatch.",
    tags: ["selectors", "shallow-equality", "zustand", "redux", "performance"],
    practice: [
      "What happens if a selector returns `state.items.filter(...)` without a shallow equality checker?",
      "How does the Reselect library provide memoized selectors for Redux?"
    ]
  }),

  createCard({
    idNum: 92,
    category: "State Management, Context API & useSyncExternalStore",
    concept: "State Management Paradigms: Flux vs Atomic vs Proxy",
    priority: "must-know",
    difficulty: "advanced",
    question: "Compare the three dominant React state management paradigms: Flux (Redux), Atomic (Jotai/Recoil), and Proxy (Valtio/MobX).",
    quickAnswer: "Flux (Redux Toolkit): Single centralized immutable state tree, updated via dispatched actions and pure reducers. Atomic (Jotai): Bottom-up graph of independent mutable/derived state units (atoms). Proxy (Valtio): Direct mutable object manipulation tracked automatically via ES6 Proxies.",
    detailedAnswer: "1) **Flux/Redux**: Highly structured, centralized, predictable, excellent for enterprise apps with complex cross-cutting audit logs and time-travel debugging. 2) **Atomic (Jotai/Recoil)**: Fine-grained, decoupled state defined alongside components; ideal for canvas apps or complex graph dependencies where different components need independent sub-states. 3) **Proxy (Valtio/MobX)**: Developer writes `state.count++`; ES6 Proxies intercept mutations and trigger minimal re-renders without reducers.",
    code: `// 1. Flux (Redux Toolkit): Action -> Reducer -> Store
dispatch(increment(5));

// 2. Atomic (Jotai): Independent atoms composed together
const countAtom = atom(0);
const doubleAtom = atom(get => get(countAtom) * 2);
const [count, setCount] = useAtom(countAtom);

// 3. Proxy (Valtio): Direct mutation tracked by Proxy
const state = proxy({ count: 0 });
state.count++; // Automatic fine-grained render!`,
    recallHint: "Flux = Centralized reducers (Redux); Atomic = Distributed graph nodes (Jotai); Proxy = Transparent mutable getters/setters (Valtio).",
    interviewTip: "Demonstrate architectural maturity by explaining that no library is universally 'best'—Flux fits rigid enterprise data flows; Atomic fits dynamic modular trees; Proxies fit rapid prototyping and 3D/canvas apps.",
    tags: ["redux", "jotai", "valtio", "paradigms", "state-management"],
    practice: [
      "Why did the React community shift from monolithic Redux to lightweight stores like Zustand?",
      "How do Atomic stores prevent unnecessary re-renders in deep component graphs?"
    ]
  }),

  createCard({
    idNum: 93,
    category: "State Management, Context API & useSyncExternalStore",
    concept: "Server Cache vs Client State (TanStack Query / SWR)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why has the modern React industry largely replaced Redux for data fetching with Server State libraries (TanStack Query / SWR)?",
    quickAnswer: "Server state is remote, asynchronous, shared, and out-of-date by default, requiring caching, deduplication, polling, and refetching on window focus. Client state is local, synchronous, and owned entirely by the UI (e.g. modals, active tabs).",
    detailedAnswer: "In the past, developers wrote hundreds of lines of Redux boilerplate (actions, thunks, reducers, loading/error flags) just to store API responses. But API data isn't client state; it's a temporary cache of remote database state. Dedicated server-cache libraries (TanStack Query, SWR, RTK Query) automate caching, background revalidation, request deduplication, pagination, and optimistic updates out of the box, shrinking client Redux stores by over 80%.",
    code: `// Traditional Redux for API: 50 lines of thunk, actions, loading flags, reducers...
// Modern Server Cache with TanStack Query (3 lines):
import { useQuery } from '@tanstack/react-query';

function UserList() {
  const { data: users, isLoading, error } = useQuery({
    queryKey: ['users'],
    queryFn: () => fetch('/api/users').then(r => r.json()),
    staleTime: 60 * 1000 // Cache fresh for 60 seconds
  });

  if (isLoading) return <Spinner />;
  return <ul>{users.map(u => <li key={u.id}>{u.name}</li>)}</ul>;
}`,
    recallHint: "Server state = cached remote async data (use React Query); Client state = local UI ephemeral state (use useState/Zustand).",
    interviewTip: "Emphasize this distinction immediately when asked about state management in interviews: separating server cache from true UI state is standard modern architecture.",
    tags: ["tanstack-query", "swr", "server-state", "redux-replacement"],
    practice: [
      "What is the difference between `staleTime` and `gcTime` (cacheTime) in TanStack Query?",
      "How does automatic background revalidation on window focus improve data freshness?"
    ]
  }),

  createCard({
    idNum: 94,
    category: "State Management, Context API & useSyncExternalStore",
    concept: "State Normalization in Relational Frontend Stores",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is state normalization and how does structuring state like a relational database (`byId` + `allIds`) eliminate data duplication bugs?",
    quickAnswer: "State normalization flattens deeply nested API objects into relational lookup tables keyed by ID (`byId: { 1: {...} }`, `allIds: [1]`). This guarantees a single source of truth and prevents stale duplication when entities appear in multiple views.",
    detailedAnswer: "If a user appears in an article author card, a sidebar comments list, and a followers modal, storing the user object nested inside all three places means updating their name requires mutating three distinct trees. If one is missed, the UI displays conflicting data. Normalizing state stores each user entity exactly once in a `users.byId` dictionary. Components reference users strictly by their ID (`userId`), guaranteeing that updating the entity once in the dictionary instantly updates every subscriber.",
    code: `// NORMALIZED STATE STRUCTURE (Relational design in Redux / Zustand):
const state = {
  posts: {
    byId: {
      'p-1': { id: 'p-1', title: 'React 19 Deep Dive', authorId: 'u-10' },
      'p-2': { id: 'p-2', title: 'PostgreSQL Indexes', authorId: 'u-10' }
    },
    allIds: ['p-1', 'p-2']
  },
  authors: {
    byId: {
      'u-10': { id: 'u-10', name: 'Alice Smith', avatar: '/alice.png' }
    },
    allIds: ['u-10']
  }
};

// Updating Alice's name in authors.byId['u-10'] updates both posts instantly!`,
    recallHint: "Normalize state into byId lookup tables and allIds arrays; single source of truth for relational entities.",
    interviewTip: "Mention utility libraries like Normalizr or Redux Toolkit's `createEntityAdapter`, which automates CRUD operations on normalized `byId` / `allIds` structures.",
    tags: ["normalization", "data-structures", "relational-state", "redux"],
    practice: [
      "How does `createEntityAdapter` in Redux Toolkit simplify normalized state updates?",
      "What are the O(1) lookup performance advantages of `byId[id]` over `array.find(x => x.id === id)`?"
    ]
  }),

  createCard({
    idNum: 95,
    category: "State Management, Context API & useSyncExternalStore",
    concept: "State Hydration Across Server and Client",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do external state management stores safely hydrate initial state from server SSR to the client without causing hydration mismatches?",
    quickAnswer: "The server serializes the store's state into a `<script id='__STATE__'>` tag in the HTML response. On the client, the store initializes with that serialized snapshot before React mounts, and `useSyncExternalStore` provides matching snapshots.",
    detailedAnswer: "If a client store initializes with empty state (`{ user: null }`) while the server rendered HTML with an authenticated user (`<h1>Welcome, Alice</h1>`), React detects a hydration mismatch and crashes or re-renders the whole tree. To avoid this, the server embeds the store snapshot into the HTML. On the client, the store is pre-populated with this exact snapshot before `hydrateRoot` executes, ensuring the client Virtual DOM matches the server HTML byte-for-byte.",
    code: `// Server-rendered HTML injection:
// <script id="__INITIAL_STATE__" type="application/json">
//   {"user":{"id":42,"name":"Alice"}}
// </script>

// Client initialization before hydrateRoot:
function getPreloadedState() {
  if (typeof window === 'undefined') return undefined;
  const el = document.getElementById('__INITIAL_STATE__');
  return el ? JSON.parse(el.textContent) : undefined;
}

// Store initialized with exact server snapshot:
export const store = createStore(getPreloadedState());

// hydrateRoot now runs with 100% matching state!
hydrateRoot(document.getElementById('root'), <Provider store={store}><App /></Provider>);`,
    recallHint: "Embed server state in <script> tag; client store pre-seeds snapshot before hydrateRoot to prevent mismatches.",
    interviewTip: "Mention security: when serializing state into HTML `<script>` tags, sanitize characters (e.g. replace `<` with `\\u003c`) to prevent XSS injection via user-supplied state.",
    tags: ["hydration", "ssr", "preloaded-state", "security"],
    practice: [
      "How does TanStack Query's `<HydrationBoundary state={dehydratedState}>` implement this pattern?",
      "What XSS risk exists when serializing store state directly into an inline HTML script tag?"
    ]
  }),

  createCard({
    idNum: 96,
    category: "State Management, Context API & useSyncExternalStore",
    concept: "LocalStorage Synchronization & Cross-Tab State",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you synchronize React state with browser `localStorage` while handling SSR and listening for changes across browser tabs?",
    quickAnswer: "Use lazy initialization to read `localStorage` once on mount (with `window !== 'undefined'` checks), save updates via an effect, and listen to the window `storage` event to synchronize state across multiple open tabs.",
    detailedAnswer: "Reading `localStorage` during initial SSR crashes because `window` does not exist on the server. When writing a sync hook, wrap reads in try/catch (since private browsing mode can block storage). Listening to the browser's native `window.addEventListener('storage', ...)` event allows changes made in Tab A (e.g. logging out or toggling dark mode) to instantly reflect in Tab B without refreshing.",
    code: `import { useState, useEffect } from 'react';

function useLocalStorage(key, initialValue) {
  // 1. Safe SSR initialization with lazy callback
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // 2. Persist updates
  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch (e) {
      console.warn('Quota exceeded', e);
    }
  }, [key, storedValue]);

  // 3. Cross-tab synchronization via native 'storage' event:
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue) {
        setStoredValue(JSON.parse(e.newValue));
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setStoredValue];
}`,
    recallHint: "Lazy init for SSR safety; useEffect for persistence; window 'storage' event for multi-tab sync.",
    interviewTip: "Highlight the `window.addEventListener('storage', ...)` trick: many developers forget that `storage` events only fire in *other* tabs, making it the perfect mechanism for multi-tab sync.",
    tags: ["localStorage", "cross-tab-sync", "custom-hooks", "persistence"],
    practice: [
      "Why doesn't the window `storage` event fire in the same tab that triggered the localStorage update?",
      "How do you handle localStorage quota exceeded exceptions?"
    ]
  })
];
