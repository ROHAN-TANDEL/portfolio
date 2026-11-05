const { createCard } = require('../react_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 13,
    category: "Component Lifecycle, Props, Local State & Rendering Triggers",
    concept: "Props vs State Fundamental Contract",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the core distinction between Props and State in React's component model?",
    quickAnswer: "Props are read-only configuration parameters passed down from a parent component. State is mutable, private component memory managed and updated internally by the component itself.",
    detailedAnswer: "Props represent the external inputs to a component, functioning like function arguments. A child component must never modify its incoming props directly. State represents internal, dynamic data that can change over time in response to user actions, network responses, or timers. Whenever state is updated via its setter, React schedules a re-render of that component and its descendants.",
    code: `// Parent passes 'name' as a prop
function Parent() {
  return <Child greeting="Welcome" />;
}

// Child receives 'greeting' as prop, owns local 'count' state
function Child({ greeting }) {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>{greeting}! Click count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
    </div>
  );
}`,
    recallHint: "Props = external immutable inputs; State = internal mutable reactive memory.",
    interviewTip: "Reinforce that props are immutable. If a child needs to communicate changes back up to the parent, the parent must pass down an event callback function prop.",
    tags: ["props", "state", "basics", "component-model"],
    practice: [
      "Can a child component change its own props?",
      "How do you pass data from a child back to its parent in React?"
    ]
  }),

  createCard({
    idNum: 14,
    category: "Component Lifecycle, Props, Local State & Rendering Triggers",
    concept: "Unidirectional Data Flow & Lifting State Up",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is unidirectional data flow and how do you 'lift state up' when two sibling components need to share data?",
    quickAnswer: "Unidirectional data flow means data flows strictly downwards from parent to child via props. When siblings need to share data, state is lifted up to their closest common ancestor, which manages the state and passes it down along with setter callbacks.",
    detailedAnswer: "In React, components cannot send data sideways to siblings directly. By elevating the shared state to their closest common parent component, that parent becomes the single source of truth. The parent passes the current state value down to siblings as props, and passes down callback functions (e.g. `onTemperatureChange`) that siblings invoke to request state modifications.",
    code: `// Common parent holds single source of truth
function TemperatureCalculator() {
  const [celsius, setCelsius] = useState(0);

  const handleFahrenheitChange = (fahrenheit) => {
    setCelsius((fahrenheit - 32) * (5 / 9));
  };

  return (
    <div>
      <CelsiusInput value={celsius} onChange={setCelsius} />
      <FahrenheitInput 
        value={(celsius * 9) / 5 + 32} 
        onChange={handleFahrenheitChange} 
      />
    </div>
  );
}`,
    recallHint: "Data flows down via props, events flow up via callbacks; shared state lives in closest common parent.",
    interviewTip: "Highlight that unidirectional data flow makes debugging significantly easier because you always know exactly which parent component is responsible for mutating a piece of state.",
    tags: ["data-flow", "lifting-state-up", "architecture"],
    practice: [
      "What architectural problem arises if you lift state up too high in the tree?",
      "How do Context and state management libraries relate to lifting state up?"
    ]
  }),

  createCard({
    idNum: 15,
    category: "Component Lifecycle, Props, Local State & Rendering Triggers",
    concept: "Functional State Updates & State Batching",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why should you use functional state updates (`setCount(prev => prev + 1)`), and how does state batching work?",
    quickAnswer: "Functional updates pass an updater function that receives the pending, up-to-date state from the update queue. This avoids stale closure bugs when multiple state updates are queued consecutively or inside asynchronous callbacks.",
    detailedAnswer: "In React, calling `setCount(count + 1)` three times in the same handler will only increment by 1, because all three calls read the same snapshot of `count` from the current render closure. Passing an updater function (`prev => prev + 1`) enqueues operations that React runs sequentially against the latest pending state during batch processing. In React 18+, all updates inside event handlers, promises, timeouts, and native listeners are automatically batched.",
    code: `function Counter() {
  const [count, setCount] = useState(0);

  const handleTripleIncrement = () => {
    // ANTI-PATTERN: Evaluates 0 + 1 three times -> ends up at 1!
    // setCount(count + 1);
    // setCount(count + 1);
    // setCount(count + 1);

    // PRODUCTION PATTERN: Enqueues updaters -> ends up at 3!
    setCount(prev => prev + 1);
    setCount(prev => prev + 1);
    setCount(prev => prev + 1);
  };

  return <button onClick={handleTripleIncrement}>Count: {count}</button>;
}`,
    recallHint: "setCount(prev => prev + 1) reads latest pending state queue; eliminates stale closure snapshot bugs.",
    interviewTip: "Mention that React 18 introduced Automatic Batching across promises and setTimeout, whereas in React 17 only React synthetic event handlers were batched by default.",
    tags: ["state", "batching", "functional-updates", "react18"],
    practice: [
      "Why does `setCount(count + 1)` multiple times in an event handler only increment once?",
      "How does React 18 automatic batching differ from React 17 batching?"
    ]
  }),

  createCard({
    idNum: 16,
    category: "Component Lifecycle, Props, Local State & Rendering Triggers",
    concept: "State as a Snapshot & Closures",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What does it mean that 'state is a snapshot' within a component's render execution?",
    quickAnswer: "Each render of a functional component has its own immutable snapshot of state and props captured in closure. Calling a state setter does not mutate the variable in the currently running function execution; it requests a future render with new values.",
    detailedAnswer: "A component function is called for every render. When it executes, state variables (`const [count, setCount] = useState(0)`) are local constants scoped to that specific invocation. Even if you invoke `setCount(count + 5)` and immediately read `count` or wait inside a `setTimeout`, `count` remains the old snapshot value for that entire execution. The updated state only becomes accessible in the next render pass.",
    code: `function AlertButton() {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(count + 1); // Schedules a new render with count = 1
    
    // The current render's 'count' is STILL 0 in this closure!
    setTimeout(() => {
      alert(\`Snapshot count was: \${count}\`); // Alerts 0 even 3 seconds later!
    }, 3000);
  };

  return <button onClick={handleClick}>Increment & Alert</button>;
}`,
    recallHint: "State setter schedules next render; current function scope retains its original snapshot value.",
    interviewTip: "If you need immediate access to an up-to-date mutable value across asynchronous closures without waiting for a re-render, use a `useRef`.",
    tags: ["closures", "snapshot", "render-lifecycle", "hooks"],
    practice: [
      "Why doesn't console.log(state) show the updated value immediately after calling setState?",
      "How can you read the latest state inside an async callback without triggering re-renders?"
    ]
  }),

  createCard({
    idNum: 17,
    category: "Component Lifecycle, Props, Local State & Rendering Triggers",
    concept: "Derived State vs Redundant State Anti-Pattern",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is derived state, and why is duplicating props or calculations into `useState` considered a dangerous anti-pattern?",
    quickAnswer: "Derived state is any value that can be computed synchronously on-the-fly from existing props or state. Duplicating it into `useState` introduces synchronization bugs, requires fragile `useEffect` watchers, and causes redundant extra render cycles.",
    detailedAnswer: "A common beginner mistake is copying props into local state (`const [fullName, setFullName] = useState(props.firstName + ' ' + props.lastName)`). If the parent updates `firstName`, the child's `fullName` becomes out of sync unless manual effect synchronization is added. The clean, idiomatic React approach is to calculate derived values directly during render. If the calculation is computationally expensive, wrap it in `useMemo`.",
    code: `// ANTI-PATTERN: Redundant state requiring manual effect syncing
function BadSearch({ items }) {
  const [query, setQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState(items);

  useEffect(() => {
    // Fragile! Extra render cycle!
    setFilteredItems(items.filter(i => i.name.includes(query)));
  }, [items, query]);
}

// PRODUCTION PATTERN: Synchronous derived calculation
function GoodSearch({ items }) {
  const [query, setQuery] = useState('');

  // Computed cleanly during render in 0 extra cycles!
  const filteredItems = items.filter(i => 
    i.name.toLowerCase().includes(query.toLowerCase())
  );

  return <ItemList items={filteredItems} />;
}`,
    recallHint: "Don't put in state what you can compute in render; avoids stale sync bugs and extra render passes.",
    interviewTip: "Quote the React docs rule of thumb: 'If you can calculate something from existing props or state, don't put it in state.'",
    tags: ["derived-state", "anti-patterns", "clean-code"],
    practice: [
      "What are the negative consequences of synchronizing props to state via useEffect?",
      "When is copying props to state actually valid (e.g. initial form default values)?"
    ]
  }),

  createCard({
    idNum: 18,
    category: "Component Lifecycle, Props, Local State & Rendering Triggers",
    concept: "Lazy State Initialization",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is lazy state initialization in `useState` and when should it be used?",
    quickAnswer: "Lazy state initialization passes an initializer function (`useState(() => initialVal)`) instead of a direct value. React only executes this function once on the initial mount, avoiding expensive re-computations on every subsequent render.",
    detailedAnswer: "When you pass a function call directly to `useState` (e.g. `useState(readHugeFileFromStorage())`), JavaScript executes that function on *every single render* of the component, even though React discards its return value on all renders after the first. By passing a function reference (`useState(() => readHugeFileFromStorage())`), React defers execution until initial mount and skips it entirely during re-renders.",
    code: `// ANTI-PATTERN: JSON.parse runs on EVERY re-render!
function BadApp() {
  const [tokens, setTokens] = useState(
    JSON.parse(localStorage.getItem('auth_tokens') || '[]')
  );
}

// PRODUCTION PATTERN: Initializer function runs ONCE on mount
function GoodApp() {
  const [tokens, setTokens] = useState(() => {
    try {
      const saved = localStorage.getItem('auth_tokens');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
}`,
    recallHint: "useState(() => expensive()) executes ONLY on mount; useState(expensive()) executes on EVERY render.",
    interviewTip: "Always mention `localStorage.getItem` or complex array parsing as textbook candidates for lazy state initialization.",
    tags: ["useState", "lazy-initialization", "performance"],
    practice: [
      "Why does passing a direct function invocation to useState cause performance degradation?",
      "Can lazy initializers be asynchronous?"
    ]
  }),

  createCard({
    idNum: 19,
    category: "Component Lifecycle, Props, Local State & Rendering Triggers",
    concept: "Component Lifecycle in Function Components",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do class component lifecycles (`componentDidMount`, `componentDidUpdate`, `componentWillUnmount`) map to modern function components and hooks?",
    quickAnswer: "Function components replace separate lifecycle methods with unified synchronization effects via `useEffect`. Empty `[]` deps maps to mount/unmount; `[dep]` maps to update/cleanup; return function maps to unmount.",
    detailedAnswer: "In class components, logic was fragmented by lifecycle method (e.g., adding a listener in `componentDidMount` and removing it in `componentWillUnmount`). In function components, `useEffect` unifies setup and teardown into a single cohesive block. Returning a cleanup function guarantees cleanup runs before effect re-execution and during unmounting.",
    code: `// Modern Hook equivalent of full lifecycle:
useEffect(() => {
  // 1. componentDidMount (if [] deps)
  const subscription = dataSource.subscribe(handleData);

  // 2. componentWillUnmount (cleanup function)
  return () => {
    subscription.unsubscribe();
  };
}, []); // Empty deps = run on mount, cleanup on unmount

// 3. componentDidUpdate (runs when 'userId' changes)
useEffect(() => {
  fetchUserDetails(userId);
}, [userId]);`,
    recallHint: "useEffect setup = mount/update; return cleanup = unmount/before next effect run.",
    interviewTip: "Emphasize that `useEffect` is about synchronization with external systems, not just a 1-to-1 syntax translation of class lifecycles.",
    tags: ["lifecycle", "useEffect", "hooks", "migration"],
    practice: [
      "When exactly does the useEffect cleanup function execute during a component's lifecycle?",
      "Why is thinking in 'synchronization' better than thinking in 'lifecycle methods'?"
    ]
  }),

  createCard({
    idNum: 20,
    category: "Component Lifecycle, Props, Local State & Rendering Triggers",
    concept: "Controlled vs Uncontrolled Components",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the difference between a controlled component and an uncontrolled component in React forms?",
    quickAnswer: "A controlled component has its form data handled by React state (`value` + `onChange`). An uncontrolled component keeps form data in the DOM itself, accessed imperatively using a `useRef` or native `FormData`.",
    detailedAnswer: "In a controlled input, React is the single source of truth. The input's current text is dictated by `value={state}`, and every keystroke triggers an `onChange` that updates state. In an uncontrolled input, the DOM manages the state, initialized with `defaultValue`. Uncontrolled inputs avoid re-rendering the component on every keystroke and pair naturally with HTML5 validation and modern form submission libraries.",
    code: `// 1. Controlled: React dictates value, re-renders on every character
function ControlledInput() {
  const [text, setText] = useState('');
  return <input value={text} onChange={e => setText(e.target.value)} />;
}

// 2. Uncontrolled: DOM holds value, read once on submit via Ref
function UncontrolledInput() {
  const inputRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('Submitted:', inputRef.current.value);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input ref={inputRef} defaultValue="Default text" />
      <button type="submit">Submit</button>
    </form>
  );
}`,
    recallHint: "Controlled: value + onChange (React owns data); Uncontrolled: defaultValue + ref (DOM owns data).",
    interviewTip: "Point out that React 19 Form Actions embrace uncontrolled inputs and native `FormData`, moving away from heavy controlled state for simple form submissions.",
    tags: ["forms", "controlled", "uncontrolled", "inputs"],
    practice: [
      "What causes the warning: 'A component is changing an uncontrolled input to be controlled'?",
      "When are uncontrolled inputs vastly superior in performance to controlled inputs?"
    ]
  }),

  createCard({
    idNum: 21,
    category: "Component Lifecycle, Props, Local State & Rendering Triggers",
    concept: "Preserving State by Tree Position",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does React decide whether to preserve or discard a component's local state across re-renders?",
    quickAnswer: "React preserves state as long as the component is rendered at the exact same position in the component tree with the exact same component identity (`type`). If the position or type changes, React destroys the Fiber node and discards state.",
    detailedAnswer: "State does not live inside the component function; it lives in the Fiber node attached to the UI tree position. If a component swaps its structural position (e.g. moving from inside a `<div>` to a `<section>`), or swaps component type (e.g. `<UserForm>` to `<GuestForm>`), React unmounts the old Fiber and mounts a fresh one. Crucially, defining a component *inside* another component creates a new function reference every render, permanently destroying state on every update.",
    code: `// ANTI-PATTERN: Defining component INSIDE another component!
function Parent() {
  // Child has a brand new function reference on EVERY render!
  // React treats it as a different type, destroying its state every keystroke!
  function InnerChild() {
    const [text, setText] = useState('');
    return <input value={text} onChange={e => setText(e.target.value)} />;
  }

  return <InnerChild />;
}

// PRODUCTION PATTERN: Define components at top-level module scope
function OutsideChild() {
  const [text, setText] = useState('');
  return <input value={text} onChange={e => setText(e.target.value)} />;
}

function ParentGood() {
  return <OutsideChild />; // Stable type reference -> State preserved!
}`,
    recallHint: "Same component type in same tree position = preserve state; nested component declaration = destroy state.",
    interviewTip: "Nested component definitions are a classic bug where inputs lose focus on every single keystroke because the input's DOM node is destroyed and recreated on each render.",
    tags: ["fiber", "tree-position", "state-preservation", "anti-patterns"],
    practice: [
      "Why does defining a component inside another component cause inputs to lose focus after one letter?",
      "How does placing a component in different branches of a ternary operator affect its state?"
    ]
  }),

  createCard({
    idNum: 22,
    category: "Component Lifecycle, Props, Local State & Rendering Triggers",
    concept: "Synthetic Events & Event Delegation",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are Synthetic Events in React, and how does event delegation work in React 17 and 18?",
    quickAnswer: "SyntheticEvent is React's cross-browser wrapper around native browser events, providing a uniform API. Starting in React 17, React delegates all events to the root DOM container (`#root`) rather than attaching listeners to `document`.",
    detailedAnswer: "Browsers have historically had minor inconsistencies in event behavior. React wraps native browser events in a `SyntheticEvent` instance (which shares the standard W3C interface like `stopPropagation` and `preventDefault`). In React 16, events were attached to the top-level `document`. In React 17+, event listeners are attached to the root DOM container (`rootNode`), enabling microfrontends and multiple React roots to safely coexist without cross-root event collision.",
    code: `function ActionButton() {
  const handleClick = (e) => {
    // e is a SyntheticEvent (cross-browser normalized)
    console.log(e.type); // "click"
    
    // Access underlying native browser event if needed:
    console.log(e.nativeEvent); // MouseEvent
    
    e.stopPropagation(); // Stops propagation across React's synthetic tree
  };

  return <button onClick={handleClick}>Click Me</button>;
}`,
    recallHint: "SyntheticEvent wraps native events for cross-browser consistency; delegated to root container (#root).",
    interviewTip: "In older React versions, synthetic events were pooled for performance (`e.persist()`), but React 17 removed event pooling completely due to modern JS engine optimizations.",
    tags: ["events", "synthetic-events", "delegation", "react17"],
    practice: [
      "Why did React 17 move event delegation from document to the root DOM container?",
      "Why was event pooling removed in React 17?"
    ]
  }),

  createCard({
    idNum: 23,
    category: "Component Lifecycle, Props, Local State & Rendering Triggers",
    concept: "Event Propagation & preventDefault",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the difference between `e.preventDefault()` and `e.stopPropagation()` in React?",
    quickAnswer: "`e.preventDefault()` stops the browser's default native action (e.g. form submission reloading page, link navigation). `e.stopPropagation()` prevents the event from bubbling up the component tree to parent handlers.",
    detailedAnswer: "In standard HTML, returning `false` from an inline handler (`onclick='return false'`) prevented default behavior. In React, you must explicitly invoke `e.preventDefault()`. To stop a click inside a child modal from triggering a click listener on the backdrop parent, use `e.stopPropagation()` to halt synthetic event bubbling.",
    code: `function CardModal({ onClose }) {
  return (
    // Backdrop click closes modal
    <div className="backdrop" onClick={onClose}>
      {/* Clicking inside the modal dialog stops bubbling to backdrop */}
      <div 
        className="modal-card" 
        onClick={(e) => e.stopPropagation()}
      >
        <h3>Dialog Content</h3>
        {/* Form submit stops browser page reload */}
        <form onSubmit={(e) => {
          e.preventDefault();
          console.log('Processed without full reload');
        }}>
          <button type="submit">Submit</button>
        </form>
      </div>
    </div>
  );
}`,
    recallHint: "preventDefault = stops browser default action (e.g. form reload); stopPropagation = stops event bubbling.",
    interviewTip: "Always mention that returning `false` from a React event handler does NOT stop event bubbling or prevent default actions—you must call the explicit methods.",
    tags: ["events", "preventDefault", "stopPropagation"],
    practice: [
      "Does calling e.stopPropagation() stop native document event listeners from firing?",
      "How do capture phase event listeners work in React (e.g. onClickCapture)?"
    ]
  }),

  createCard({
    idNum: 24,
    category: "Component Lifecycle, Props, Local State & Rendering Triggers",
    concept: "Modern Form Handling & FormData API",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you handle multi-field forms efficiently in React without creating dozens of `useState` variables?",
    quickAnswer: "Use uncontrolled inputs combined with the native browser `FormData` API on form submission (`new FormData(e.currentTarget)`), extracting all named fields in a single operation.",
    detailedAnswer: "Maintaining individual `useState` hooks for a form with 15 fields creates significant boilerplate and triggers re-renders on every single keystroke across the entire form. By giving each input a `name` attribute, the form's `onSubmit` handler can construct a `FormData` object and convert it to a plain JavaScript object via `Object.fromEntries(new FormData(e.currentTarget))`. This matches modern React 19 Action paradigms.",
    code: `function SignupForm({ onRegister }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    // Automatically extracts all inputs with name attributes:
    const payload = Object.fromEntries(formData.entries());
    console.log('Payload:', payload);
    // { username: 'alice', email: 'alice@acme.com', tier: 'pro' }
    
    onRegister(payload);
  };

  return (
    <form onSubmit={handleSubmit}>
      <input name="username" defaultValue="" required />
      <input name="email" type="email" defaultValue="" required />
      <select name="tier" defaultValue="free">
        <option value="free">Free</option>
        <option value="pro">Pro</option>
      </select>
      <button type="submit">Sign Up</button>
    </form>
  );
}`,
    recallHint: "Object.fromEntries(new FormData(e.currentTarget)) grabs all form fields without 10 separate useState hooks.",
    interviewTip: "Explain how this pattern naturally bridges into React 19 Server Actions, where `<form action={serverAction}>` passes `formData` directly to server execution.",
    tags: ["forms", "formData", "uncontrolled", "performance"],
    practice: [
      "How do you handle multi-select dropdowns or checkbox arrays with FormData?",
      "Why is FormData vastly superior to controlled state for high-performance forms?"
    ]
  })
];
