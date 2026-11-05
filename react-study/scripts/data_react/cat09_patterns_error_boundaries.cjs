const { createCard } = require('../react_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 97,
    category: "Component Patterns, Composition, Portals & Error Boundaries",
    concept: "Error Boundaries Architecture",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a React Error Boundary, what lifecycle methods define it, and why must it still be written as a class component?",
    quickAnswer: "An Error Boundary is a component that catches JavaScript errors anywhere in its child component tree, logs the error, and displays a fallback UI. It is defined using `static getDerivedStateFromError()` (to render fallback) and `componentDidCatch()` (to log errors). It must be a class because React provides no hook equivalent for catching render errors.",
    detailedAnswer: "In React 16+, an uncaught error in any component's render phase unmounts the *entire* React component tree, leaving the user with a completely blank white screen. Error boundaries contain crashes to specific widgets (e.g. crashing a sidebar widget does not crash the entire dashboard). React has not yet introduced a functional hook equivalent for `getDerivedStateFromError` or `componentDidCatch`, making class components (or the `react-error-boundary` package) mandatory.",
    code: `import React from 'react';

class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null };

  // 1. Update state so next render shows fallback UI
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  // 2. Log error details to telemetry service (Sentry, Datadog)
  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo.componentStack);
    // sendToErrorReporting(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || <h2>Something went wrong in this widget.</h2>;
    }
    return this.props.children;
  }
}`,
    recallHint: "getDerivedStateFromError updates state to show fallback; componentDidCatch logs to Sentry; class component required.",
    interviewTip: "Highlight the recommended library: in modern codebases, developers rarely write their own class boundary and instead import `react-error-boundary` for declarative fallback and reset support.",
    tags: ["error-boundaries", "class-components", "resilience", "telemetry"],
    practice: [
      "Why hasn't React introduced a `useErrorBoundary` hook for catching render errors?",
      "What is the difference in purpose between `getDerivedStateFromError` and `componentDidCatch`?"
    ]
  }),

  createCard({
    idNum: 98,
    category: "Component Patterns, Composition, Portals & Error Boundaries",
    concept: "What Error Boundaries CANNOT Catch",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What types of errors CANNOT be caught by React Error Boundaries, and how must you handle them instead?",
    quickAnswer: "Error Boundaries do NOT catch: 1) Errors inside event handlers (`onClick`); 2) Asynchronous code (`setTimeout`, `requestAnimationFrame`, unhandled Promise rejections); 3) Server-Side Rendering (SSR) crashes; 4) Errors thrown inside the Error Boundary itself.",
    detailedAnswer: "Error boundaries only catch errors thrown during the *render phase* and component lifecycle methods of their descendants. Event handlers do not run during the render phase; if an error throws in an `onClick`, React still knows what to display on screen and does not unmount the tree. To catch event errors, use standard `try/catch`. To bridge async errors into an Error Boundary, update state with an updater that throws (`setState(() => { throw err; })`) or use React 19's Actions/`useActionState`.",
    code: `function FaultyButton() {
  const [_, setThrowError] = useState();

  const handleAsyncClick = async () => {
    try {
      await api.riskyCall();
    } catch (err) {
      // 1. Standard try/catch for local event handling:
      console.error('Local event error:', err);
      
      // 2. Or bridge to nearest Error Boundary by throwing in a render updater:
      setThrowError(() => { throw err; });
    }
  };

  return <button onClick={handleAsyncClick}>Trigger Async Action</button>;
}`,
    recallHint: "Error boundaries DON'T catch: event handlers, async code/promises, SSR, or errors in boundary itself.",
    interviewTip: "Point out that React 19 Actions inside `startTransition` automatically bridge async promise rejections directly to Error Boundaries, solving the historic async error limitation.",
    tags: ["error-boundaries", "async-errors", "event-handlers", "limitations"],
    practice: [
      "Why don't event handler errors crash or unmount the entire React tree?",
      "How does React 19 handle async errors thrown inside Server Actions?"
    ]
  }),

  createCard({
    idNum: 99,
    category: "Component Patterns, Composition, Portals & Error Boundaries",
    concept: "Error Recovery & Boundary Resets",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you implement error recovery and reset mechanisms inside an Error Boundary to let users retry failed operations?",
    quickAnswer: "Provide a reset callback (e.g. `onReset` in `react-error-boundary`) that resets the boundary's error state, and reset component state by changing a `key` or re-running data fetches when the user clicks 'Try Again'.",
    detailedAnswer: "Displaying an error message with no way out forces users to hard-refresh the page and lose work. A resilient Error Boundary provides a `Try Again` button. When clicked, it resets `hasError: false`. To ensure the crashed child doesn't instantly re-throw the same error with stale data, the boundary can also accept a `resetKeys={[location.pathname]}` prop to automatically reset whenever the user navigates away.",
    code: `import { ErrorBoundary } from 'react-error-boundary';

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <div role="alert" className="error-card">
      <p>Failed to load feed: {error.message}</p>
      {/* Resets boundary and allows re-mounting child! */}
      <button onClick={resetErrorBoundary}>Try Again</button>
    </div>
  );
}

function FeedWidget() {
  const [retryKey, setRetryKey] = useState(0);

  return (
    <ErrorBoundary 
      FallbackComponent={ErrorFallback}
      onReset={() => setRetryKey(k => k + 1)}
      resetKeys={[retryKey]} // Auto-reset when key changes
    >
      <UserFeed key={retryKey} />
    </ErrorBoundary>
  );
}`,
    recallHint: "Error recovery needs resetErrorBoundary + key reset to give users a working 'Try Again' button without page refresh.",
    interviewTip: "Mention that placing multiple localized Error Boundaries around independent widgets (chat, sidebar, feed) allows non-faulty parts of the app to remain fully functional.",
    tags: ["error-recovery", "react-error-boundary", "resilience", "ux"],
    practice: [
      "What is the risk of resetting an error boundary without changing the underlying error cause?",
      "How do navigation-based reset keys (like route changes) improve user experience?"
    ]
  }),

  createCard({
    idNum: 100,
    category: "Component Patterns, Composition, Portals & Error Boundaries",
    concept: "React Portals & DOM Detachment",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is `ReactDOM.createPortal`, and why is it essential for modals, tooltips, and floating menus?",
    quickAnswer: "Portals render children into a different DOM node outside the parent component's DOM hierarchy, while maintaining their position and context in the React component tree.",
    detailedAnswer: "If a modal or tooltip is rendered inside a parent container with CSS `overflow: hidden`, `position: relative`, or low `z-index`, the modal gets visually clipped or stuck behind other elements. `createPortal(children, domNode)` transports the physical HTML elements to `document.body` (or a dedicated `#modal-root`), completely escaping parent CSS stacking contexts while remaining fully connected to the React tree for props, state, and context.",
    code: `import { createPortal } from 'react-dom';
import { useEffect, useState } from 'react';

function Modal({ isOpen, onClose, children }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!isOpen || !mounted) return null;

  // Renders into #modal-root in document.body, escaping parent CSS overflow!
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.getElementById('modal-root') || document.body
  );
}`,
    recallHint: "createPortal(jsx, document.body) renders DOM at target node; escapes parent CSS overflow and z-index clipping.",
    interviewTip: "Always mention that portals exist physically in another DOM container, but logically behave as ordinary React children in every way (context, props, state).",
    tags: ["portals", "createPortal", "modals", "css-clipping"],
    practice: [
      "Why must you ensure the target portal DOM element exists before calling createPortal (especially during SSR)?",
      "How do accessible modals created via portals manage keyboard focus trapping?"
    ]
  }),

  createCard({
    idNum: 101,
    category: "Component Patterns, Composition, Portals & Error Boundaries",
    concept: "Event Bubbling Across Portals",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does event bubbling behave with React Portals when an event is fired inside a portaled element?",
    quickAnswer: "Events fired inside a Portal bubble up through the **React virtual component tree**, NOT the physical browser DOM tree. A parent component in the React tree will catch clicks from its portaled child, even if the child's DOM node is physically appended to `document.body`.",
    detailedAnswer: "Because React uses synthetic event delegation on the root container, it traces the hierarchy of Fiber parent-child relationships rather than the native DOM `parentNode` chain. If `<Parent><ModalPortal><button /></ModalPortal></Parent>` is rendered, clicking the button triggers `<Parent onClick={...}>`, even though in the browser DOM, the button is a direct child of `<body>` and miles away from the parent's DOM node.",
    code: `function ParentComponent() {
  const handleParentClick = () => {
    // This handler WILL FIRE when the portaled button is clicked!
    console.log('Parent caught click from portaled child via React bubbling!');
  };

  return (
    <div onClick={handleParentClick} className="parent-box">
      <h1>Parent Layout</h1>
      <ModalPortal>
        {/* Rendered physically in document.body */}
        <button>Click Inside Portal</button>
      </ModalPortal>
    </div>
  );
}`,
    recallHint: "Portal events bubble up the REACT tree, NOT the DOM tree; parent component catches portal clicks.",
    interviewTip: "This is a favorite senior React interview trivia question: it tests whether a developer understands the difference between the physical DOM tree and React's internal Fiber tree.",
    tags: ["portals", "event-bubbling", "synthetic-events", "fiber"],
    practice: [
      "How do you stop a portaled modal click from triggering a parent click listener in the React tree?",
      "Does native DOM `addEventListener` on the parent catch clicks from a portaled child?"
    ]
  }),

  createCard({
    idNum: 102,
    category: "Component Patterns, Composition, Portals & Error Boundaries",
    concept: "Compound Components Pattern",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the Compound Components pattern, and how does it provide expressive, flexible component APIs like HTML's `<select>` and `<option>`?",
    quickAnswer: "Compound Components work together to share implicit state and logic through an internal React Context, allowing consumers to arrange sub-components declaratively without passing complex prop configurations.",
    detailedAnswer: "Consider HTML `<select><option value='1'>One</option></select>`. You don't pass an `options={[...]}` array prop to `<select>`; you compose child tags naturally. The Compound Component pattern uses a shared Context inside a parent wrapper (`<Tabs>`), and sub-components (`<Tabs.List>`, `<Tabs.Tab>`, `<Tabs.Panel>`) consume that context to coordinate active tab indexing, keyboard navigation, and aria attributes seamlessly.",
    code: `import React, { createContext, useContext, useState } from 'react';

const ToggleContext = createContext();

// Parent Compound Component
function Toggle({ children, onChange }) {
  const [on, setOn] = useState(false);
  const toggle = () => {
    setOn(prev => !prev);
    onChange?.(!on);
  };
  return <ToggleContext.Provider value={{ on, toggle }}>{children}</ToggleContext.Provider>;
}

// Sub-components attached as properties:
Toggle.On = function ToggleOn({ children }) {
  const { on } = useContext(ToggleContext);
  return on ? children : null;
};

Toggle.Off = function ToggleOff({ children }) {
  const { on } = useContext(ToggleContext);
  return on ? null : children;
};

Toggle.Button = function ToggleButton(props) {
  const { on, toggle } = useContext(ToggleContext);
  return <button onClick={toggle} aria-pressed={on} {...props} />;
};

// Expressive usage by consumer:
function App() {
  return (
    <Toggle>
      <Toggle.On>The switch is ON 💡</Toggle.On>
      <Toggle.Off>The switch is OFF 🌑</Toggle.Off>
      <Toggle.Button>Toggle</Toggle.Button>
    </Toggle>
  );
}`,
    recallHint: "Compound components share implicit context; consumers compose sub-components like <Select><Option/></Select>.",
    interviewTip: "Point to famous design system libraries like Radix UI, Headless UI, or Reach UI, which are built almost entirely on the Compound Component pattern.",
    tags: ["compound-components", "design-systems", "patterns", "api-design"],
    practice: [
      "Why is attaching sub-components as static properties (`Toggle.Button = ...`) popular in design systems?",
      "How do Compound Components simplify accessibility (a11y) coordination between tabs and panels?"
    ]
  }),

  createCard({
    idNum: 103,
    category: "Component Patterns, Composition, Portals & Error Boundaries",
    concept: "Render Props vs Custom Hooks Evolution",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What was the Render Props pattern, why did Custom Hooks largely replace it, and in what specific scenario do Render Props still excel?",
    quickAnswer: "Render Props passed a function as a prop (`children={data => <UI data={data}/>}`) to share stateful logic. Custom Hooks replaced them by eliminating nesting. Render Props still excel when the component must control JSX rendering iteration or virtualization (e.g. Virtualized Lists).",
    detailedAnswer: "Before Hooks (React 16.8), sharing mouse position or subscription logic required wrapper components with render prop callbacks (`<Mouse>{({ x, y }) => <Display x={x} y={y} />}</Mouse>`). Composing 4 render props created 'callback pyramid of doom'. Custom Hooks (`const { x, y } = useMouse()`) flattened this completely. However, for virtualization libraries (like `react-window`), the parent list component must control the layout of individual items dynamically, making render props (`itemRenderer={({ index, style }) => ...}`) the ideal pattern.",
    code: `// 1. LEGACY RENDER PROP PATTERN: (Creates callback nesting)
<MouseTracker>
  {({ x, y }) => (
    <WindowDimensions>
      {({ width }) => <div>Pos: {x},{y} on {width}px screen</div>}
    </WindowDimensions>
  )}
</MouseTracker>

// 2. MODERN CUSTOM HOOK EQUIVALENT: (Zero nesting!)
function ModernComponent() {
  const { x, y } = useMouse();
  const { width } = useWindowDimensions();
  return <div>Pos: {x},{y} on {width}px screen</div>;
}

// 3. WHERE RENDER PROPS STILL SHINE: Virtualized List layout control
<VirtualList itemCount={1000} itemHeight={35}>
  {({ index, style }) => <div style={style}>Row #{index}</div>}
</VirtualList>`,
    recallHint: "Custom hooks eliminated render prop nesting; render props are still used in virtualization and component slot control.",
    interviewTip: "Being able to articulate *why* hooks superseded render props while acknowledging where render props remain superior shows deep historical and practical understanding.",
    tags: ["render-props", "custom-hooks", "evolution", "patterns"],
    practice: [
      "Can a component pass a render function as `props.children`?",
      "Why is inline arrow function creation in render props a potential performance hazard?"
    ]
  }),

  createCard({
    idNum: 104,
    category: "Component Patterns, Composition, Portals & Error Boundaries",
    concept: "Higher-Order Components (HOC) & Ref Forwarding Pitfalls",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a Higher-Order Component (HOC), and why did it fall out of favor compared to modern Custom Hooks?",
    quickAnswer: "An HOC is a pure function that takes a component and returns an enhanced component (`withAuth(Profile)`). It fell out of favor due to: 1) Prop collisions; 2) Indirection / mystery props; 3) Ref forwarding breakage (`ref` points to the HOC wrapper, not the inner component); 4) Wrapper hell in React DevTools.",
    detailedAnswer: "HOCs like `connect()` in legacy Redux or `withRouter()` wrapped components to inject props. If two HOCs both injected a prop named `user`, one silently overwrote the other (prop collision). Furthermore, passing a `ref` to the wrapped component attached to the HOC wrapper instance instead of the target DOM node, requiring complex `React.forwardRef` plumbing. Custom Hooks completely eliminate all of these issues because they return values directly into the component scope.",
    code: `// LEGACY HOC PATTERN:
function withSubscription(WrappedComponent) {
  return class extends React.Component {
    state = { data: null };
    componentDidMount() { /* subscribe */ }
    render() {
      // Passes injected 'data' prop (Can collide with WrappedComponent props!)
      return <WrappedComponent data={this.state.data} {...this.props} />;
    }
  };
}

// MODERN HOOK PATTERN (No wrapper, no prop collisions, full TypeScript safety):
function UserProfile(props) {
  const data = useSubscription(); // Local, explicit, zero collisions!
  return <div>{data?.name}</div>;
}`,
    recallHint: "HOC = function taking component and returning enhanced component; replaced by hooks due to prop collisions and wrapper hell.",
    interviewTip: "If working on a legacy codebase with HOCs, mention `hoist-non-react-statics` to preserve static methods across HOC boundaries.",
    tags: ["hoc", "patterns", "legacy-react", "ref-forwarding"],
    practice: [
      "Why doesn't a ref pass directly through an HOC to the wrapped component without forwardRef?",
      "How do TypeScript types become significantly more complex when typing HOCs vs custom hooks?"
    ]
  }),

  createCard({
    idNum: 105,
    category: "Component Patterns, Composition, Portals & Error Boundaries",
    concept: "Polymorphic Components & The 'as' Prop Pattern",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a Polymorphic Component (the `as` prop pattern), and how does it preserve semantic HTML and accessibility in design systems?",
    quickAnswer: "A polymorphic component can render as different underlying HTML tags or React components depending on an `as` prop (e.g. `<Button as='a' href='/login'>Login</Button>`), sharing the same design system styles while rendering the semantically correct HTML tag.",
    detailedAnswer: "Design systems often style buttons, text, and cards identically. But rendering a navigation link as a `<button>` with an `onClick` that pushes to the router ruins accessibility, right-click 'Open in new tab', and SEO. Polymorphic components allow a single `<Button>` component to render as a `<button>`, an `<a>`, or a Next.js `<Link>`, while dynamically enforcing TypeScript type safety for the corresponding HTML attributes.",
    code: `// Polymorphic Component implementation in TypeScript / React:
function Button<T extends React.ElementType = 'button'>({
  as,
  children,
  className = '',
  ...props
}: {
  as?: T;
  children: React.ReactNode;
} & React.ComponentPropsWithoutRef<T>) {
  // Dynamically assign tag: defaults to 'button'
  const Component = as || 'button';
  return (
    <Component className={\`btn-base \${className}\`} {...props}>
      {children}
    </Component>
  );
}

// 1. Renders as native HTML <button>:
<Button type="submit">Submit Form</Button>

// 2. Renders as native HTML <a> with valid 'href' prop:
<Button as="a" href="/dashboard">Go to Dashboard</Button>`,
    recallHint: "Polymorphic component uses 'as' prop to switch underlying HTML tag (button vs a vs Link) while keeping styles.",
    interviewTip: "Highlight the accessibility benefit: never use `<button onClick={navigate}>` when an `<a>` tag is semantically required.",
    tags: ["polymorphic", "as-prop", "design-systems", "typescript", "a11y"],
    practice: [
      "Why is rendering a link as a `<button>` with an onClick handler bad for accessibility and SEO?",
      "How do TypeScript conditional types enforce that `href` is required when `as='a'`?"
    ]
  }),

  createCard({
    idNum: 106,
    category: "Component Patterns, Composition, Portals & Error Boundaries",
    concept: "Headless UI Component Architecture",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Headless UI Architecture, and why is it preferred over monolithic UI component libraries (like Bootstrap or older Material UI)?",
    quickAnswer: "Headless UI separates logic, state, and accessibility (keyboard navigation, ARIA attributes) from visual presentation (CSS/HTML). It provides unstyled, fully accessible hooks or components that developers style with their own CSS/Tailwind.",
    detailedAnswer: "Monolithic UI libraries package pre-baked CSS styles. Overriding their styles to match custom corporate branding requires fighting high-specificity CSS rules (`!important`) or messy style themes. Headless libraries (Radix Primitives, React Aria, Headless UI) provide 100% accessible logic (ARIA roles, arrow key navigation, focus trapping, screen reader announcements) with zero CSS. Developers have total styling freedom while guaranteeing accessibility compliance.",
    code: `// Example using headless Radix UI primitive:
import * as Dialog from '@radix-ui/react-dialog';

export function CustomModal({ isOpen, onOpenChange, children }) {
  return (
    // Radix handles aria-expanded, Esc-key closing, focus trapping, and portal automatically!
    <Dialog.Root open={isOpen} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* Style with 100% pure custom Tailwind or CSS classes! */}
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white p-6 rounded-lg shadow-xl">
          <Dialog.Title className="text-xl font-bold">Account Settings</Dialog.Title>
          <Dialog.Description className="text-gray-500">Update your details</Dialog.Description>
          {children}
          <Dialog.Close asChild>
            <button className="btn-close">Close</button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}`,
    recallHint: "Headless UI provides accessible logic + state with 0 CSS; total styling freedom via Tailwind/CSS.",
    interviewTip: "Mentioning headless architecture (Radix, React Aria, TanStack Table) shows modern enterprise frontend experience where custom design systems are the norm.",
    tags: ["headless-ui", "radix", "accessibility", "design-systems"],
    practice: [
      "What complex accessibility requirements (ARIA, focus management) does Headless UI handle automatically?",
      "Why is TanStack Table considered the premier headless data grid library?"
    ]
  }),

  createCard({
    idNum: 107,
    category: "Component Patterns, Composition, Portals & Error Boundaries",
    concept: "Recursive Components for Trees & Nested Data",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you implement a Recursive Component in React to render arbitrary-depth data structures (like folder file trees or threaded comments)?",
    quickAnswer: "A recursive component calls itself inside its own JSX definition when child nodes exist, with a base condition (e.g. empty or null children) to terminate recursion.",
    detailedAnswer: "Tree data structures (nested categories, file explorer directories, nested Reddit-style comment threads) have arbitrary and unpredictable depth. Instead of hardcoding 5 nested loops, a recursive component renders the current item, checks if `item.children` exists, and maps over children by recursively invoking `<TreeNode node={child} />`. Ensure stable unique keys at each level to maintain reconciliation performance.",
    code: `// Tree Data Structure:
const fileTree = [
  {
    name: 'src',
    children: [
      { name: 'components', children: [{ name: 'Button.jsx' }, { name: 'Card.jsx' }] },
      { name: 'App.jsx' }
    ]
  },
  { name: 'package.json' }
];

// Recursive Tree Component:
function FileTreeNode({ item }) {
  const [expanded, setExpanded] = useState(false);
  const hasChildren = Array.isArray(item.children) && item.children.length > 0;

  return (
    <div style={{ paddingLeft: '16px' }}>
      <div onClick={() => hasChildren && setExpanded(!expanded)}>
        {hasChildren ? (expanded ? '📂 ' : '📁 ') : '📄 '}
        <span>{item.name}</span>
      </div>

      {/* Base Condition: only recurse if has children AND expanded */}
      {hasChildren && expanded && (
        <div>
          {item.children.map(child => (
            // Self-referential recursive invocation!
            <FileTreeNode key={child.name} item={child} />
          ))}
        </div>
      )}
    </div>
  );
}`,
    recallHint: "Recursive component calls itself inside render; requires base termination condition to prevent infinite stack overflow.",
    interviewTip: "Warn about performance: deeply nested recursive trees can trigger deep render passes; recommend virtualization for trees with more than 1,000 visible nodes.",
    tags: ["recursive-components", "tree-structures", "algorithms", "nested-data"],
    practice: [
      "What causes a 'Maximum call stack size exceeded' error in a recursive React component?",
      "How do you flatten a tree structure for high-performance virtualization?"
    ]
  }),

  createCard({
    idNum: 108,
    category: "Component Patterns, Composition, Portals & Error Boundaries",
    concept: "Controlled vs Uncontrolled Hybrid Component Pattern",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you design a component that can function seamlessly as both Controlled (value supplied by parent) and Uncontrolled (internal state with defaultValue)?",
    quickAnswer: "Check if the controlled prop (e.g. `value`) is not `undefined`. If controlled, read `value` from props; if uncontrolled, read from an internal `useState` initialized with `defaultValue`.",
    detailedAnswer: "High-quality design system components (like Radix UI primitives) support both paradigms. If a parent passes `value={state}`, the component acts as controlled and delegates changes via `onChange`. If the parent omits `value`, the component manages its own state internally via `defaultValue`. A custom hook `useControllableState({ value, defaultValue, onChange })` cleanly encapsulates this logic without messy conditional branching in render.",
    code: `import { useState, useCallback } from 'react';

// Reusable hook for hybrid controlled/uncontrolled state:
function useControllableState({ value: controlledValue, defaultValue, onChange }) {
  const isControlled = controlledValue !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);

  const value = isControlled ? controlledValue : internalValue;

  const setValue = useCallback((nextValue) => {
    if (!isControlled) {
      setInternalValue(nextValue);
    }
    onChange?.(nextValue);
  }, [isControlled, onChange]);

  return [value, setValue];
}

// Clean Hybrid Accordion Component:
function Accordion({ value, defaultValue = false, onChange }) {
  const [isOpen, setIsOpen] = useControllableState({ value, defaultValue, onChange });
  return <button onClick={() => setIsOpen(!isOpen)}>{isOpen ? 'Collapse' : 'Expand'}</button>;
}`,
    recallHint: "useControllableState: if value !== undefined use prop; else use internal useState(defaultValue).",
    interviewTip: "This pattern is essential for creating production-grade open-source UI libraries that fit both simple and advanced use cases.",
    tags: ["hybrid-components", "controlled-uncontrolled", "design-systems", "api-design"],
    practice: [
      "What warning does React emit if a component switches from controlled to uncontrolled during its lifecycle?",
      "Why is `value !== undefined` checked rather than `Boolean(value)`?"
    ]
  })
];
