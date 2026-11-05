const { createCard } = require('../react_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 37,
    category: "Advanced Hooks",
    concept: "useReducer vs useState",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When should you prefer `useReducer` over `useState` in a React component?",
    quickAnswer: "Prefer `useReducer` when a component has complex state logic involving multiple sub-values, when the next state depends on previous state in intricate ways, or when multiple related actions modify the same state structure.",
    detailedAnswer: "While `useState` is ideal for independent primitives or simple objects, managing 5 interconnected state variables with multiple setters often leads to state tearing, impossible states, or spaghetti code. `useReducer` centralizes state transitions into a pure reducer function `(state, action) => nextState`. It cleanly decouples *what happened* (the action dispatched) from *how the state updates* (the reducer logic). Furthermore, `dispatch` has a guaranteed stable reference that never changes across renders.",
    code: `import { useReducer } from 'react';

// Centralized state transition table
function formReducer(state, action) {
  switch (action.type) {
    case 'FIELD_CHANGE':
      return { ...state, values: { ...state.values, [action.field]: action.value } };
    case 'SUBMIT_START':
      return { ...state, isSubmitting: true, error: null };
    case 'SUBMIT_SUCCESS':
      return { ...state, isSubmitting: false, isSuccess: true };
    case 'SUBMIT_ERROR':
      return { ...state, isSubmitting: false, error: action.error };
    default:
      return state;
  }
}

function ContactForm() {
  const [state, dispatch] = useReducer(formReducer, {
    values: {},
    isSubmitting: false,
    error: null,
    isSuccess: false
  });

  return (
    <button 
      disabled={state.isSubmitting}
      onClick={() => dispatch({ type: 'SUBMIT_START' })}
    >
      {state.isSubmitting ? 'Sending...' : 'Send'}
    </button>
  );
}`,
    recallHint: "useReducer for complex, interdependent state; separates 'what happened' (dispatch) from 'how state changes' (reducer).",
    interviewTip: "Highlight that `dispatch` is guaranteed to be reference-stable across renders, meaning it can be passed down deep component trees without triggering child re-renders.",
    tags: ["useReducer", "useState", "state-management", "reducers"],
    practice: [
      "How does useReducer make testing business logic easier compared to useState?",
      "Can you pass an initializer function to useReducer for lazy initialization?"
    ]
  }),

  createCard({
    idNum: 38,
    category: "Advanced Hooks",
    concept: "Reducer Purity & Immutability Rules",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why must reducer functions passed to `useReducer` be strictly pure and side-effect free?",
    quickAnswer: "Reducers must be pure because React executes them during the render phase. An impure reducer (mutating state in place, making API calls, or reading random values) causes unpredictable state transitions and breaks concurrent rendering.",
    detailedAnswer: "In React, reducers calculate the new state snapshot. If you mutate existing state directly (`state.items.push(action.item)`), React's shallow comparison may miss the update, or concurrent rendering may re-run the reducer and duplicate mutations. Reducers must return new object/array copies, never perform asynchronous network requests, and never interact with browser globals like `localStorage` or `Math.random()`. Side effects belong in event handlers or effects.",
    code: `// IMPURE ANTI-PATTERN: Mutating state directly in reducer!
function badReducer(state, action) {
  switch (action.type) {
    case 'ADD_TODO':
      state.todos.push(action.todo); // MUTATION! Same reference!
      return state;
  }
}

// PURE PRODUCTION PATTERN: Returns new state with structural sharing
function goodReducer(state, action) {
  switch (action.type) {
    case 'ADD_TODO':
      return {
        ...state,
        todos: [...state.todos, action.todo] // Immutable copy!
      };
    default:
      return state;
  }
}`,
    recallHint: "Reducers must be pure: (state, action) => newState; zero mutations; zero network/async side effects.",
    interviewTip: "Mention that in StrictMode development, React invokes reducers twice to uncover any accidental state mutations in the reducer body.",
    tags: ["reducers", "immutability", "purity", "useReducer"],
    practice: [
      "Why is making an asynchronous fetch request inside a reducer function forbidden?",
      "How does library tools like Immer simplify immutable updates in reducers?"
    ]
  }),

  createCard({
    idNum: 39,
    category: "Advanced Hooks",
    concept: "useCallback Mechanics & Meaningful Optimization",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does `useCallback` work, and when does wrapping a function in `useCallback` actually provide a performance benefit?",
    quickAnswer: "`useCallback` caches a function definition between renders based on dependency array equality. It only improves performance when: 1) Passed as a prop to a child component optimized with `React.memo`; or 2) Passed into another hook's dependency array (like `useEffect`).",
    detailedAnswer: "On every render, JavaScript creates a fresh function reference. For regular DOM elements like `<button onClick={() => ...}>`, recreating the function takes nanoseconds and wrapping it in `useCallback` actually adds memory and CPU overhead. However, if a child component `<ExpensiveTable onRowClick={handleRowClick} />` is wrapped in `React.memo`, passing a fresh function reference breaks memoization. `useCallback` preserves reference equality, allowing `React.memo` to skip re-rendering.",
    code: `import { useState, useCallback, memo } from 'react';

// Memoized child component
const FilterButton = memo(function FilterButton({ onSelect, tag }) {
  console.log('FilterButton re-rendered:', tag);
  return <button onClick={() => onSelect(tag)}>{tag}</button>;
});

function Dashboard() {
  const [selectedTag, setSelectedTag] = useState('all');

  // useCallback keeps the exact same memory address for onSelect:
  const handleSelect = useCallback((tag) => {
    setSelectedTag(tag);
  }, []); // Empty deps = stable identity across entire component lifetime

  return <FilterButton tag="react" onSelect={handleSelect} />;
}`,
    recallHint: "useCallback caches function reference; useless on basic DOM nodes; only useful with React.memo or hook deps.",
    interviewTip: "Emphasize that `useCallback(fn, deps)` is strictly equivalent to `useMemo(() => fn, deps)`. It does not make function execution faster; it only stabilizes its reference identity.",
    tags: ["useCallback", "memoization", "performance", "reference-equality"],
    practice: [
      "Why is wrapping every single event handler in useCallback an anti-pattern?",
      "How does useCallback interact with JavaScript closures and the dependency array?"
    ]
  }),

  createCard({
    idNum: 40,
    category: "Advanced Hooks",
    concept: "useMemo for Expensive Calculations & Reference Stability",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the two distinct purposes of `useMemo`, and how do you determine if a calculation is truly 'expensive'?",
    quickAnswer: "Purposes: 1) Caching the result of an expensive calculation across renders; 2) Preserving reference stability for complex objects/arrays passed as dependencies to child components or hooks. Calculations are expensive if filtering/sorting thousands of items or performing heavy algorithmic math (>1ms).",
    detailedAnswer: "`useMemo` runs during render and recalculates its cached value only when dependencies change. Trivial array operations like `items.map(x => x.name)` over 20 items take microseconds—wrapping them in `useMemo` adds more overhead than it saves. However, for a 5,000-item fuzzy search, multi-column sorting, or passing an options object to `useEffect`, `useMemo` avoids heavy CPU churn and prevents downstream dependency thrashing.",
    code: `import { useState, useMemo } from 'react';

function ProductCatalog({ products, filterText }) {
  const [sortAsc, setSortAsc] = useState(true);

  // 1. Caches computationally heavy filtering & sorting
  const visibleProducts = useMemo(() => {
    console.time('filter');
    const filtered = products.filter(p => 
      p.name.toLowerCase().includes(filterText.toLowerCase())
    );
    filtered.sort((a, b) => sortAsc ? a.price - b.price : b.price - a.price);
    console.timeEnd('filter');
    return filtered;
  }, [products, filterText, sortAsc]);

  // 2. Reference stability for child hook/memo
  const queryConfig = useMemo(() => ({
    tags: ['electronics', 'deals'],
    limit: 50
  }), []); // Won't trigger downstream effects on re-render

  return <Table items={visibleProducts} config={queryConfig} />;
}`,
    recallHint: "useMemo caches return value; use for heavy CPU work (1ms+) or stabilizing object references for deps.",
    interviewTip: "Mention that you can verify calculation cost using `console.time('filter')` or Chrome DevTools Performance Profiler before deciding to add `useMemo`.",
    tags: ["useMemo", "performance", "expensive-calculations", "hooks"],
    practice: [
      "How do you benchmark whether an operation is slow enough to justify useMemo?",
      "Does useMemo guarantee that its cached value will NEVER be garbage collected?"
    ]
  }),

  createCard({
    idNum: 41,
    category: "Advanced Hooks",
    concept: "The Overhead of Premature Optimization",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why can wrapping every function and value in `useCallback` and `useMemo` actually degrade React application performance?",
    quickAnswer: "Every memoization hook incurs a cost: allocating closure arrays, comparing dependency arrays on every render, and keeping variables alive in memory. Premature memoization adds code clutter, increases memory consumption, and slows down simple renders.",
    detailedAnswer: "In JavaScript, creating a simple arrow function or a small object is one of the fastest operations an engine can perform (often optimized in V8 registers). When you wrap a simple handler in `useCallback`, React must allocate a Hook node, allocate the dependency array, and run an `Object.is` check on every dependency for every single render. If the child is not memoized with `React.memo`, the child re-renders anyway, making the `useCallback` pure waste.",
    code: `// PREMATURE MEMOIZATION ANTI-PATTERN (Pure waste!):
function SimpleButton() {
  const [count, setCount] = useState(0);

  // Unnecessary overhead: Basic DOM button re-renders regardless!
  const handleClick = useCallback(() => {
    setCount(c => c + 1);
  }, []);

  // Unnecessary overhead: Math is nanoseconds!
  const doubled = useMemo(() => count * 2, [count]);

  return <button onClick={handleClick}>Count: {count} (Doubled: {doubled})</button>;
}`,
    recallHint: "Memoization has cost (array allocation + Object.is comparison); don't optimize without React.memo or profiling.",
    interviewTip: "Quote the famous Knuth adage: 'Premature optimization is the root of all evil.' In React 19, the React Compiler handles automatic memoization at the AST level, making manual useMemo/useCallback largely obsolete.",
    tags: ["memoization", "premature-optimization", "react-compiler", "performance"],
    practice: [
      "How does the React 19 Compiler eliminate the need for manual useMemo and useCallback?",
      "When is re-rendering a component actually completely harmless in terms of browser frame rate?"
    ]
  }),

  createCard({
    idNum: 42,
    category: "Advanced Hooks",
    concept: "useImperativeHandle & Controlled Ref Exposure",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is `useImperativeHandle` and why should it be used instead of exposing raw DOM nodes to parent components?",
    quickAnswer: "`useImperativeHandle` customizes the ref instance value exposed to parent components, allowing a child component to expose a controlled, restrictive API (e.g. `focus()`, `reset()`) instead of exposing the entire mutable DOM node.",
    detailedAnswer: "Exposing raw DOM nodes via `forwardRef` breaks encapsulation—parents can alter arbitrary styles, inspect internal IDs, or tamper with children. `useImperativeHandle(ref, createHandle, [deps])` intercepts the parent's ref and assigns an object containing only the specific methods you deliberately expose. This keeps child internals private and enforces clean component boundaries.",
    code: `import { forwardRef, useImperativeHandle, useRef } from 'react';

// Child component exposes only focus() and scrollIntoView()
const CustomInput = forwardRef(function CustomInput(props, ref) {
  const inputRef = useRef(null);

  useImperativeHandle(ref, () => ({
    focus: () => {
      inputRef.current?.focus();
    },
    clear: () => {
      if (inputRef.current) inputRef.current.value = '';
    }
  }), []);

  return <input ref={inputRef} className="styled-input" />;
});

// Parent component uses the restricted imperative API
function Form() {
  const inputHandleRef = useRef(null);

  return (
    <div>
      <CustomInput ref={inputHandleRef} />
      <button onClick={() => inputHandleRef.current?.focus()}>Focus</button>
      <button onClick={() => inputHandleRef.current?.clear()}>Clear</button>
    </div>
  );
}`,
    recallHint: "useImperativeHandle customizes the ref object exposed to parent; provides narrow, encapsulated imperative API.",
    interviewTip: "Emphasize that imperative handles are an escape hatch. Declarative props should always be the default choice; reserve imperative handles for focus, scrolling, video playback, and animations.",
    tags: ["useImperativeHandle", "refs", "encapsulation", "forwardRef"],
    practice: [
      "Why is exposing raw DOM nodes considered an encapsulation leak?",
      "How does useImperativeHandle integrate with media players (audio/video elements)?"
    ]
  }),

  createCard({
    idNum: 43,
    category: "Advanced Hooks",
    concept: "Custom Hook Extraction & Encapsulation",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the core conventions and benefits of extracting reusable logic into Custom Hooks?",
    quickAnswer: "Custom Hooks are JavaScript functions whose names start with `use` and that may call other Hooks. They encapsulate and share stateful logic (not state itself) between components without duplicating code or creating wrapper hell.",
    detailedAnswer: "Before Hooks, sharing stateful logic required complex patterns like Higher-Order Components (HOCs) or Render Props, which produced deeply nested 'wrapper hell' in React DevTools. Custom Hooks allow you to extract state, effects, and reducers into clean, testable functions. Each component invoking a custom hook gets its own completely isolated state and fiber hook node; the logic is shared, but the state instances are totally separate.",
    code: `import { useState, useEffect } from 'react';

// Reusable Custom Hook
function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

// Clean usage in UI components
function StatusBar() {
  const isOnline = useOnlineStatus();
  return <div>{isOnline ? '🟢 Connected' : '🔴 Disconnected'}</div>;
}`,
    recallHint: "Custom hook name starts with 'use'; shares stateful logic, NOT state itself; each caller has isolated state.",
    interviewTip: "Ensure candidates understand that custom hooks do not share state across components—each component calling `useOnlineStatus()` instantiates its own private `useState` and `useEffect`.",
    tags: ["custom-hooks", "reuse", "encapsulation", "architecture"],
    practice: [
      "Do two components calling the same custom hook share the exact same state?",
      "Why must custom hook function names always begin with the lowercase prefix 'use'?"
    ]
  }),

  createCard({
    idNum: 44,
    category: "Advanced Hooks",
    concept: "Custom Hook API Design: Tuples vs Objects",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When designing a Custom Hook's return value, when should you return a tuple (array) versus an object?",
    quickAnswer: "Return a tuple (`[value, setter]`) when the hook returns 1–2 primary values that callers frequently want to rename. Return an object (`{ data, error, isLoading, refetch }`) when returning 3+ properties or when callers may only need a subset.",
    detailedAnswer: "Returning an array allows arbitrary renaming upon destructuring (`const [count, setCount] = useCounter()` vs `const [age, setAge] = useCounter()`) without verbose syntax. However, if an array has 5 items, users must keep strict positional order and cannot skip items without dummy commas (`[ , , , refetch]`). Objects allow named destructuring, selective picking, and easy future non-breaking API extensions.",
    code: `// 1. Tuple Pattern: Ideal for 1-2 elements with flexible naming
function useToggle(initial = false) {
  const [value, setValue] = useState(initial);
  const toggle = useCallback(() => setValue(v => !v), []);
  return [value, toggle]; // [isOpen, toggleOpen] = useToggle()
}

// 2. Object Pattern: Ideal for multi-property APIs
function useFetch(url) {
  const [state, setState] = useState({ data: null, error: null, loading: true });
  // ...
  return {
    data: state.data,
    error: state.error,
    isLoading: state.loading,
    refetch: () => {} // Caller picks only what they need!
  };
}`,
    recallHint: "1-2 items = Tuple (easy renaming); 3+ items = Object (named destructuring & backward compatibility).",
    interviewTip: "Cite `useState` as the gold standard for the tuple pattern and `useQuery` / `useForm` as the gold standard for the object pattern.",
    tags: ["api-design", "custom-hooks", "destructuring", "best-practices"],
    practice: [
      "How do TypeScript tuple return types require `as const` assertions in custom hooks?",
      "What are the backward compatibility advantages of object returns over array returns?"
    ]
  }),

  createCard({
    idNum: 45,
    category: "Advanced Hooks",
    concept: "useDebugValue for React DevTools",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is `useDebugValue` and how does it enhance custom hook debugging in React DevTools?",
    quickAnswer: "`useDebugValue` formats and displays custom labels next to your custom hooks in React DevTools, providing clear inspection of internal hook state.",
    detailedAnswer: "When inspecting a component in React DevTools, internal custom hooks only display their raw hook values (`State: true`). In complex shared libraries or design systems, `useDebugValue` attaches a formatted diagnostic string directly to the custom hook tree in DevTools. To avoid slowing down production apps, `useDebugValue` accepts an optional formatting function that only runs if the DevTools inspector is open.",
    code: `import { useState, useEffect, useDebugValue } from 'react';

function useFriendStatus(friendId) {
  const [isOnline, setIsOnline] = useState(null);

  // Displays "Online" or "Offline" beside useFriendStatus in React DevTools
  // Second argument is optional deferred formatting function:
  useDebugValue(isOnline, status => status ? '🟢 Active Online' : '⚪ Offline');

  useEffect(() => {
    // Subscription logic...
  }, [friendId]);

  return isOnline;
}`,
    recallHint: "useDebugValue displays custom labels for custom hooks in React DevTools; use deferred formatter function.",
    interviewTip: "Clarify that `useDebugValue` is intended primarily for shared open-source or internal utility hook libraries, not every single local custom hook.",
    tags: ["useDebugValue", "devtools", "debugging", "custom-hooks"],
    practice: [
      "Why does useDebugValue accept a second formatting function argument?",
      "Does useDebugValue add performance overhead in production builds?"
    ]
  }),

  createCard({
    idNum: 46,
    category: "Advanced Hooks",
    concept: "forwardRef Evolution & React 19 Ref as Prop",
    priority: "must-know",
    difficulty: "advanced",
    question: "How did ref forwarding work with `forwardRef` in React 16–18, and how does React 19 modernize refs as standard props?",
    quickAnswer: "In React 16–18, function components could not accept a `ref` prop directly and had to be wrapped in `forwardRef((props, ref) => ...)`. In React 19, `forwardRef` is deprecated; `ref` is passed as a standard prop directly into function component arguments.",
    detailedAnswer: "In older React versions, `ref` was a reserved keyword like `key` that was intercepted by the JSX compiler and never passed into `props`. Wrapping a component in `forwardRef` was a cumbersome ceremony that complicated TypeScript generics and HOCs. React 19 unifies `ref` as a first-class prop on standard function components, eliminating `forwardRef` completely while maintaining backward compatibility.",
    code: `// 1. React 16 - 18 Legacy Pattern (forwardRef ceremony)
import { forwardRef } from 'react';
const OldInput = forwardRef(function OldInput(props, ref) {
  return <input ref={ref} {...props} />;
});

// 2. React 19 Modern Pattern (Ref is just a prop!)
function ModernInput({ ref, placeholder, ...props }) {
  // Directly access 'ref' from props! No wrapper function needed!
  return <input ref={ref} placeholder={placeholder} {...props} />;
}

// Usage in React 19:
function Parent() {
  const myRef = useRef(null);
  return <ModernInput ref={myRef} placeholder="Enter name" />;
}`,
    recallHint: "React 16-18 needed forwardRef wrapper; React 19 passes 'ref' directly as a normal prop in function arguments.",
    interviewTip: "Showcasing awareness of React 19's deprecation of `forwardRef` in favor of `ref` as a prop proves up-to-date knowledge with the latest React release.",
    tags: ["forwardRef", "react19", "refs", "breaking-changes"],
    practice: [
      "Why did older React treat `ref` and `key` as special reserved props outside of props?",
      "How do TypeScript definitions simplify in React 19 without `forwardRef`?"
    ]
  }),

  createCard({
    idNum: 47,
    category: "Advanced Hooks",
    concept: "Event Handler Memoization & Dependency Stabilization",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you pass an event callback to a child component without triggering re-renders or creating stale closure bugs?",
    quickAnswer: "Use `useCallback` with exact minimal dependencies, or use the 'Latest Ref Pattern' (or experimental `useEffectEvent`) to allow the callback to read current state without needing state in its dependency array.",
    detailedAnswer: "A common conundrum: you want `handleSubmit` to have a stable reference so `React.memo(Child)` doesn't re-render, but `handleSubmit` needs to read `text` and `category` from state. Adding `[text, category]` to `useCallback` changes the function reference on every keystroke, defeating `React.memo`. The solution is storing the handler in a ref that updates every render, while exposing a permanent wrapper callback.",
    code: `import { useRef, useCallback, useEffect } from 'react';

// Custom hook to create reference-stable callbacks that never go stale
function useEventCallback(fn) {
  const ref = useRef(fn);

  // Update ref synchronously on each render
  useEffect(() => {
    ref.current = fn;
  });

  // Return permanent reference that delegates to current ref
  return useCallback((...args) => {
    return ref.current?.(...args);
  }, []);
}

// Usage: Stable identity across all renders, but always reads fresh state!
function ChatBox({ onSend }) {
  const [text, setText] = useState('');

  const handleSend = useEventCallback(() => {
    onSend(text); // Never stale, but handleSend NEVER changes reference!
  });

  return <MemoizedEditor onSend={handleSend} />;
}`,
    recallHint: "Stable callback wrapper + ref mirroring latest function = permanent reference that never goes stale.",
    interviewTip: "Explain that this pattern forms the foundation of the proposed official `useEffectEvent` hook currently in React RFC.",
    tags: ["useCallback", "useRef", "event-callbacks", "performance"],
    practice: [
      "Why does React propose `useEffectEvent` as an official hook for this exact pattern?",
      "What are the limitations of calling an event callback during the render phase?"
    ]
  }),

  createCard({
    idNum: 48,
    category: "Advanced Hooks",
    concept: "State Machines with useReducer",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does modeling component UI states as a Finite State Machine (FSM) with `useReducer` eliminate impossible states?",
    quickAnswer: "An FSM with `useReducer` restricts state to a discrete set of allowed states (e.g. `idle`, `loading`, `success`, `error`) and allows state transitions only via explicitly defined actions, preventing impossible states like `isLoading && isSuccess`.",
    detailedAnswer: "Boolean flags (`isLoading: true, isError: true, isSuccess: true`) easily get desynchronized, leading to broken UI states where a spinner and an error message render simultaneously. In a state machine, the state is represented by a single `status` discriminator. Transitions are deterministic: a `FETCH` action can only transition from `idle` or `error` to `loading`; from `loading`, it can only transition to `success` or `error`.",
    code: `const initialState = { status: 'idle', data: null, error: null };

function fetchReducer(state, action) {
  switch (state.status) {
    case 'idle':
    case 'error':
      if (action.type === 'START') {
        return { status: 'loading', data: null, error: null };
      }
      return state;
    case 'loading':
      if (action.type === 'RESOLVE') {
        return { status: 'success', data: action.data, error: null };
      }
      if (action.type === 'REJECT') {
        return { status: 'error', data: null, error: action.error };
      }
      return state;
    case 'success':
      if (action.type === 'RESET') {
        return initialState;
      }
      return state;
    default:
      return state;
  }
}`,
    recallHint: "FSM in useReducer uses a 'status' discriminator; prevents impossible states like loading AND error simultaneously.",
    interviewTip: "Mention tools like XState for industrial state machines, but highlight that basic FSMs can be built directly with native `useReducer` without any third-party dependencies.",
    tags: ["fsm", "state-machines", "useReducer", "architecture"],
    practice: [
      "Identify 3 impossible states that commonly occur when using independent boolean useState flags.",
      "How does TypeScript discriminated unions pair with FSM reducers for compile-time safety?"
    ]
  })
];
