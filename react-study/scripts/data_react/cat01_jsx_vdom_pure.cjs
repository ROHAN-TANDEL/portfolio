const { createCard } = require('../react_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 1,
    category: "JSX, Elements, Virtual DOM & Pure Components",
    concept: "Virtual DOM & Reconciliation",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the Virtual DOM and how does React use it for high-performance rendering?",
    quickAnswer: "The Virtual DOM is a lightweight in-memory JavaScript representation of the real DOM tree. React diffs the new virtual tree against the previous one (reconciliation) and batches only the computed delta changes to the browser DOM.",
    detailedAnswer: "Direct browser DOM manipulations are computationally expensive because they trigger layout reflows and repaints. React avoids this by creating plain JavaScript object representations of UI elements (`ReactElement`). When state changes occur, React renders a new virtual tree in memory, runs its heuristic diffing algorithm against the current fiber tree, and applies the minimal set of required DOM mutations in the commit phase.",
    code: `// JSX transforms into React.createElement() producing a Virtual DOM object
const vNode = React.createElement('h1', { className: 'title' }, 'Hello World');

// Under the hood, vNode is a lightweight plain JS object:
// {
//   $$typeof: Symbol(react.element),
//   type: 'h1',
//   props: { className: 'title', children: 'Hello World' },
//   key: null,
//   ref: null
// }`,
    recallHint: "Virtual DOM = in-memory JS tree; diffing = computes minimal delta; commit = batched real DOM mutations.",
    interviewTip: "Emphasize that the Virtual DOM isn't necessarily faster than direct imperative DOM in isolated microbenchmarks, but provides declarative predictability and batching that prevents layout thrashing across complex apps.",
    tags: ["vdom", "reconciliation", "basics", "core-architecture"],
    practice: [
      "Explain what React elements look like as raw JavaScript objects.",
      "Why does React use an in-memory tree instead of mutating DOM nodes directly?"
    ]
  }),

  createCard({
    idNum: 2,
    category: "JSX, Elements, Virtual DOM & Pure Components",
    concept: "JSX Compilation & Babel / SWC",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is JSX and how is it compiled by modern build tools like Babel or SWC?",
    quickAnswer: "JSX is a syntax extension for JavaScript that allows writing HTML-like tags inside JavaScript. Compilers (Babel, SWC, ESBuild) transform JSX tags into `React.createElement()` calls or the modern JSX runtime `_jsx()` calls.",
    detailedAnswer: "JSX is not valid ECMAScript that browsers can execute directly. Modern toolchains transform JSX using the React 17+ JSX Transform (`react/jsx-runtime`). This transform converts `<div className='box'>Hi</div>` into `_jsx('div', { className: 'box', children: 'Hi' })` without requiring `import React from 'react'` in every file. Tag names starting with lowercase are compiled as string literals (host DOM nodes), while uppercase identifiers are passed as component function references.",
    code: `// 1. JSX Source Code:
function Card({ title }) {
  return <div className="card"><h1>{title}</h1></div>;
}

// 2. Compiled output (React 17+ automatic runtime):
import { jsx as _jsx, jsxs as _jsxs } from 'react/jsx-runtime';

function Card({ title }) {
  return _jsxs('div', {
    className: 'card',
    children: _jsx('h1', { children: title })
  });
}`,
    recallHint: "Lowercase tag = HTML string; Capitalized tag = Component function reference; compiled to _jsx().",
    interviewTip: "Point out why component names must start with a capital letter: compilers treat lowercase tags like 'div' as string host elements, but capitalized tags like 'Card' as variable references.",
    tags: ["jsx", "babel", "swc", "compilation"],
    practice: [
      "Why did older React require importing React in files that only wrote JSX?",
      "How does the modern React 17+ JSX runtime improve bundle size and developer ergonomics?"
    ]
  }),

  createCard({
    idNum: 3,
    category: "JSX, Elements, Virtual DOM & Pure Components",
    concept: "React Elements vs React Components",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the critical distinction between a React Element and a React Component?",
    quickAnswer: "A React Component is a function or class that accepts props and returns elements. A React Element is the immutable plain JavaScript object describing what should appear on screen returned by invoking a component.",
    detailedAnswer: "A Component is a blueprint or factory function (`function UserCard(props) { ... }`). A React Element is the concrete descriptor object returned when you call `<UserCard name='Alice' />`. Elements are transient, immutable objects containing type, props, and children. React inspects elements to create and update long-lived internal Fiber nodes that track component state and DOM references across renders.",
    code: `// Component: The reusable factory function
function Avatar({ src }) {
  return <img src={src} alt="avatar" className="rounded-full" />;
}

// Element: The immutable descriptor object
const avatarElement = <Avatar src="/user.png" />;
console.log(avatarElement.type); // Reference to Avatar function
console.log(avatarElement.props); // { src: '/user.png' }`,
    recallHint: "Component = Factory function / blueprint; Element = Immutable descriptor instance object.",
    interviewTip: "Make sure to mention that React Elements are immutable. You cannot mutate element props after creation; React creates a fresh tree of elements on every render.",
    tags: ["elements", "components", "architecture"],
    practice: [
      "Can you mutate an element's props after it has been created?",
      "How does React turn elements into internal Fiber instances?"
    ]
  }),

  createCard({
    idNum: 4,
    category: "JSX, Elements, Virtual DOM & Pure Components",
    concept: "Component Purity & Idempotence",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What does it mean for a React component to be 'pure' and why is purity mandatory?",
    quickAnswer: "A pure component produces the identical JSX output given the same inputs (props, state, context) and causes zero observable side effects during rendering.",
    detailedAnswer: "In React, the render phase can be called multiple times, interrupted, or discarded (especially in React 18 Concurrent Mode). If a component mutates existing external variables, modifies DOM directly, or makes network requests during its render pass, rendering becomes unpredictable and buggy. Side effects must strictly live inside `useEffect`, event handlers, or Server Actions, keeping the component body purely functional and idempotent.",
    code: `// IMPURE ANTI-PATTERN: Mutating external variable during render!
let guestCount = 0;
function BadCup() {
  guestCount = guestCount + 1; // SIDE EFFECT IN RENDER BODY!
  return <h2>Tea cup for guest #{guestCount}</h2>;
}

// PURE PRODUCTION PATTERN: Deterministic calculation from props
function GoodCup({ guestIndex }) {
  return <h2>Tea cup for guest #{guestIndex}</h2>;
}`,
    recallHint: "Same inputs -> same JSX; zero mutations outside render body; side effects belong in effects.",
    interviewTip: "Highlight that React StrictMode in development deliberately invokes component functions twice to help detect impure side effects in the render body.",
    tags: ["purity", "idempotence", "strict-mode"],
    practice: [
      "Why does React 18 Strict Mode double-invoke render functions in development?",
      "List three examples of forbidden side effects inside a component body."
    ]
  }),

  createCard({
    idNum: 5,
    category: "JSX, Elements, Virtual DOM & Pure Components",
    concept: "Immutability & Structural Sharing",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why does React require state and props to be treated as immutable objects?",
    quickAnswer: "Immutability allows React to detect state changes through fast shallow reference equality checks (`prev !== next`) rather than recursive deep object comparisons.",
    detailedAnswer: "JavaScript objects are passed by reference. If you mutate an object in place (`user.name = 'Bob'`), `prevUser === nextUser` still evaluates to `true`. React's change detection assumes that if the object reference has not changed, the internal data has not changed, skipping component re-renders. By creating new object references using the spread operator or functional utilities, React instantly detects mutations in O(1) time and preserves structural sharing of untouched sub-trees.",
    code: `// ANTI-PATTERN: Direct state mutation (React misses change)
const [user, setUser] = useState({ name: 'Alice', role: 'Dev' });
user.name = 'Bob'; // MUTATION! Same reference!
setUser(user);     // Component fails to re-render!

// PRODUCTION PATTERN: Immutable update with new object reference
setUser(prev => ({
  ...prev,
  name: 'Bob'
}));`,
    recallHint: "Mutating object keeps same memory address -> React thinks nothing changed -> skips re-render.",
    interviewTip: "Explain shallow comparison (`Object.is`) vs deep comparison. Mention how immutability enables predictable time-travel debugging and structural sharing.",
    tags: ["immutability", "shallow-equality", "state-architecture"],
    practice: [
      "How does shallow reference equality checking benefit React's reconciliation engine?",
      "How do you update a nested object immutably without mutating parents?"
    ]
  }),

  createCard({
    idNum: 6,
    category: "JSX, Elements, Virtual DOM & Pure Components",
    concept: "React.Fragment & Keyed Fragments",
    priority: "must-know",
    difficulty: "beginner",
    question: "Why does React require fragments when returning multiple sibling elements, and when are keyed fragments required?",
    quickAnswer: "React components must return a single root element because JavaScript functions can only return a single value. Fragments (`<></>`) group siblings without adding redundant HTML wrapper nodes to the DOM. Keyed fragments (`<React.Fragment key={id}>`) are required when mapping over lists.",
    detailedAnswer: "Every JSX expression compiles to a function call (`_jsx()`). Returning multiple adjacent elements without a wrapper is syntactically invalid in JS. `<Fragment>` allows grouping children without rendering an extra `<div>` that could break CSS Flexbox/Grid layouts or table structures (`<tr><td>`). When rendering mapped collections, the short syntax `<>` cannot accept attributes, requiring the explicit `<React.Fragment key={item.id}>` syntax.",
    code: `import React from 'react';

// Short syntax: no extra DOM node
function Breadcrumb() {
  return (
    <>
      <a href="/">Home</a>
      <span>/</span>
      <span>Profile</span>
    </>
  );
}

// Keyed Fragment inside collection mapping
function GlossaryList({ items }) {
  return (
    <dl>
      {items.map(item => (
        <React.Fragment key={item.id}>
          <dt>{item.term}</dt>
          <dd>{item.definition}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}`,
    recallHint: "Fragments prevent extraneous DOM wrapper divs; explicit React.Fragment is needed when passing keys.",
    interviewTip: "Mention that `<></>` short syntax cannot take keys or any props. If you need `key={id}` inside a `.map()`, you must import and use `<React.Fragment key={id}>`.",
    tags: ["fragments", "jsx", "dom-hygiene"],
    practice: [
      "What CSS layout problems arise when using unnecessary <div> wrappers instead of fragments?",
      "Can you pass event handlers or className props to a React.Fragment?"
    ]
  }),

  createCard({
    idNum: 7,
    category: "JSX, Elements, Virtual DOM & Pure Components",
    concept: "Security in JSX & XSS Defense",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does React protect applications against Cross-Site Scripting (XSS) by default, and what are the bypass vulnerabilities?",
    quickAnswer: "React automatically escapes all strings rendered inside JSX expressions before injecting them into the DOM. Bypass risks occur only when using `dangerouslySetInnerHTML`, executing `javascript:` pseudo-protocols in `href`, or directly manipulating DOM via refs.",
    detailedAnswer: "When user-supplied text containing HTML tags (e.g. `<script>alert('pwned')</script>`) is placed inside `{userInput}`, React converts characters to safe string representations rather than raw HTML nodes. Additionally, React elements contain a secret symbol property `$$typeof: Symbol.for('react.element')` which prevents JSON injection attacks from external APIs pretending to be valid elements. The main XSS vectors remain `dangerouslySetInnerHTML={{ __html: dirtyHtml }}` and malicious user URLs in `<a href={userUrl}>`.",
    code: `// 1. SAFE: React escapes HTML tags automatically
const userComment = '<script>fetch("https://attacker.com")</script>';
return <p>{userComment}</p>; // Rendered safely as literal text

// 2. DANGEROUS: Explicit bypass requires sanitization (e.g. DOMPurify)
import DOMPurify from 'dompurify';
return <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(dirtyHtml) }} />;

// 3. VULNERABLE: javascript: URI injection in links!
// If url is "javascript:alert(document.cookie)", clicking executes code!
const safeUrl = userUrl.startsWith('http://') || userUrl.startsWith('https://') ? userUrl : '#';
return <a href={safeUrl}>Visit Profile</a>;`,
    recallHint: "JSX auto-escapes string content; $$typeof Symbol blocks JSON element injection; watch dangerouslySetInnerHTML and javascript: URIs.",
    interviewTip: "Highlight the role of `$$typeof: Symbol(react.element)`: JSON cannot serialize JavaScript Symbols, preventing attackers from injecting mock React elements via untrusted API JSON payloads.",
    tags: ["security", "xss", "dangerouslySetInnerHTML", "best-practices"],
    practice: [
      "Why is $$typeof implemented as a Symbol in React elements?",
      "How do you sanitize user-supplied URLs before passing them to an <a> tag href?"
    ]
  }),

  createCard({
    idNum: 8,
    category: "JSX, Elements, Virtual DOM & Pure Components",
    concept: "Children Prop & Composition vs Inheritance",
    priority: "must-know",
    difficulty: "beginner",
    question: "How does the `children` prop enable powerful component composition over object-oriented inheritance in React?",
    quickAnswer: "The `children` prop represents any arbitrary JSX passed between a component's opening and closing tags, allowing components to act as generic visual containers without knowing their contents in advance.",
    detailedAnswer: "React strongly advocates composition over inheritance. Rather than subclassing components to extend behavior, React components pass UI fragments, slots, or render functions as props. The default slot is `props.children`. Specialized variations (e.g. `Dialog` vs `WelcomeDialog`) are built by rendering a generic container and passing specialized children or named slot props (`header={...}`, `footer={...}`).",
    code: `// Generic Container Component
function Modal({ title, actions, children }) {
  return (
    <div className="modal-backdrop">
      <div className="modal-dialog">
        <header><h2>{title}</h2></header>
        <div className="modal-body">{children}</div>
        <footer>{actions}</footer>
      </div>
    </div>
  );
}

// Composed Usage
function ConfirmDeleteModal({ onDelete }) {
  return (
    <Modal 
      title="Delete Account?" 
      actions={<button onClick={onDelete}>Confirm</button>}
    >
      <p>This action is irreversible. All your data will be permanently wiped.</p>
    </Modal>
  );
}`,
    recallHint: "Composition = Container with slots (children + named props); eliminates rigid class inheritance hierarchies.",
    interviewTip: "Cite the React documentation rule: 'At Facebook, React is used in thousands of components, and we haven't found any use cases where we would recommend creating component inheritance hierarchies.'",
    tags: ["children", "composition", "slots", "architecture"],
    practice: [
      "How do you implement multiple named slots (like header, sidebar, footer) in a React component?",
      "What type does `children` have in TypeScript React definitions?"
    ]
  }),

  createCard({
    idNum: 9,
    category: "JSX, Elements, Virtual DOM & Pure Components",
    concept: "Conditional Rendering Patterns",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the standard patterns for conditional rendering in React, and what is the 'falsy 0' bug with `&&`?",
    quickAnswer: "Common patterns include ternary operators (`condition ? <A/> : <B/>`), logical AND (`condition && <A/>`), and early returns. The 'falsy 0' bug occurs when `count && <List/>` evaluates to `0` because JavaScript short-circuits to the number 0, rendering a visible '0' on screen.",
    detailedAnswer: "In JavaScript, `0 && <Component/>` evaluates to `0`, not `false`. Because React renders numbers, a stray `0` appears in the UI. To safely conditionally render with `&&`, cast the condition explicitly to a boolean (`Boolean(count) && ...` or `count > 0 && ...`). For binary branching, ternary expressions are preferred over multiple `&&` statements.",
    code: `// BUGGY ANTI-PATTERN: Renders "0" if items array is empty!
function Cart({ items }) {
  return (
    <div>
      {items.length && <p>You have {items.length} items</p>}
    </div>
  );
}

// SAFE PRODUCTION PATTERNS:
function SafeCart({ items }) {
  // Option A: Explicit boolean comparison
  const hasItems = items.length > 0;
  
  // Option B: Ternary expression
  return (
    <div>
      {hasItems ? (
        <p>You have {items.length} items</p>
      ) : (
        <p>Cart is empty</p>
      )}
    </div>
  );
}`,
    recallHint: "0 && <Tag/> renders '0' on screen! Use count > 0 && <Tag/> or ternary condition ? <A/> : null.",
    interviewTip: "Always bring up the falsy 0 bug when asked about conditional rendering; it demonstrates practical debugging experience with real-world React quirks.",
    tags: ["conditional-rendering", "javascript-gotchas", "jsx"],
    practice: [
      "Why does `false`, `null`, `undefined`, and `true` render nothing in JSX, but `0` renders text?",
      "When is an early return preferable over an inline ternary operator?"
    ]
  }),

  createCard({
    idNum: 10,
    category: "JSX, Elements, Virtual DOM & Pure Components",
    concept: "Rendering Lists & The Unique Key Contract",
    priority: "must-know",
    difficulty: "beginner",
    question: "Why does React require a unique `key` prop on collection items, and why is array index dangerous as a key?",
    quickAnswer: "Keys provide a persistent identity to elements across renders so React can track which items are added, removed, or moved. Using array indexes breaks when items are reordered, prepended, or filtered, causing UI state corruption in child components.",
    detailedAnswer: "During reconciliation, React diffs children. If no keys are provided, React matches children by index position. If the first item of a list is deleted, React thinks the first item updated its props, the second item updated its props, and the last item was removed. Any internal state (input text, active toggles, focus, animations) in child components remains attached to the index position, causing visual bugs and unnecessary DOM mutations.",
    code: `// ANTI-PATTERN: Using index as key when list order changes
<ul>
  {todos.map((todo, index) => (
    <TodoItem key={index} todo={todo} /> // BUG on delete or prepend!
  ))}
</ul>

// PRODUCTION PATTERN: Stable, unique business entity ID
<ul>
  {todos.map(todo => (
    <TodoItem key={todo.id} todo={todo} /> // Deterministic fiber matching
  ))}
</ul>`,
    recallHint: "Key = stable identity across renders; index key mixes up internal state when list reorders.",
    interviewTip: "Explain what happens when an item is prepended to a list keyed by index: every single list element undergoes a re-render because its index changed, completely negating memoization.",
    tags: ["keys", "lists", "reconciliation", "performance"],
    practice: [
      "Under what very narrow conditions is using array index as key acceptable?",
      "Can two sibling elements share the exact same key without triggering warnings?"
    ]
  }),

  createCard({
    idNum: 11,
    category: "JSX, Elements, Virtual DOM & Pure Components",
    concept: "Resetting State via the Key Prop",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How can you leverage the `key` prop to cleanly reset a component's internal state without effects or manual resets?",
    quickAnswer: "Changing a component's `key` forces React to completely unmount the old Fiber instance and mount a fresh new component with pristine initial state.",
    detailedAnswer: "Normally, if the same component remains in the same position in the tree across renders, React preserves its internal state. When navigating between entities (e.g. switching from User Profile #1 to User Profile #2), stale input fields or draft state often persist. By passing `key={userId}` to `<UserProfile />`, React treats it as a completely distinct entity, discarding the old Fiber and mounting a new one with zero state pollution.",
    code: `// Reset an entire complex form when selectedUser changes
function UserEditor({ selectedUserId }) {
  // Changing key unmounts previous Form and mounts a brand new one
  return <ProfileForm key={selectedUserId} userId={selectedUserId} />;
}

function ProfileForm({ userId }) {
  // Initial state is automatically clean for each unique user!
  const [bio, setBio] = useState('');
  const [draftComments, setDraftComments] = useState([]);
  
  return <textarea value={bio} onChange={e => setBio(e.target.value)} />;
}`,
    recallHint: "Key change = unmount old component tree + mount brand new tree with fresh initial state.",
    interviewTip: "This is a favorite senior React interview question: using `key` to reset state is vastly cleaner and less error-prone than writing an imperative `useEffect` that manually resets multiple state variables on prop change.",
    tags: ["keys", "state-reset", "unmounting", "clean-code"],
    practice: [
      "Compare resetting component state using `key={id}` versus resetting via `useEffect(() => reset(), [id])`.",
      "What are the performance implications of changing keys frequently?"
    ]
  }),

  createCard({
    idNum: 12,
    category: "JSX, Elements, Virtual DOM & Pure Components",
    concept: "React.memo & Shallow Comparison",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does `React.memo` optimize rendering, and what are its shallow equality comparison rules?",
    quickAnswer: "`React.memo` wraps a component to skip re-rendering if its new props are shallowly equal (`Object.is`) to its previous props, preventing unnecessary renders when parent components update.",
    detailedAnswer: "By default in React, when a parent component renders, all of its child components re-render recursively, regardless of whether their props changed. Wrapping a child in `React.memo` tells React to compare previous props and next props using shallow equality. If all primitive values match and all object/function references are identical, React reuses the existing render output.",
    code: `import React, { memo } from 'react';

// Skipped if 'name' and 'badge' references don't change
const UserBadge = memo(function UserBadge({ name, badge }) {
  console.log('UserBadge rendered');
  return <span className="badge">{name} ({badge})</span>;
});

// Custom comparison function for specialized deep checks:
const ComplexChart = memo(function ComplexChart({ config }) {
  return <svg>{/* expensive paths */}</svg>;
}, (prevProps, nextProps) => {
  // Return true if nextProps are equivalent to prevProps (skip render)
  return prevProps.config.chartId === nextProps.config.chartId;
});`,
    recallHint: "React.memo checks Object.is on props; skips re-rendering child if parent re-renders with same prop references.",
    interviewTip: "Emphasize that `React.memo` only checks props. If the memoized component uses `useState`, `useReducer`, or `useContext`, it will still re-render whenever its own state or consumed context changes.",
    tags: ["memo", "performance", "shallow-comparison", "re-renders"],
    practice: [
      "Why does passing an inline object literal `<UserBadge badge={{ type: 'VIP' }} />` defeat `React.memo`?",
      "Does `React.memo` prevent re-renders caused by internal state or context updates?"
    ]
  })
];
