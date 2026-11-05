const { createCard } = require('../react_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 61,
    category: "React 19 Innovations",
    concept: "React 19 Architectural Vision & Core Features",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the major architectural innovations introduced in React 19, and how do they simplify frontend development?",
    quickAnswer: "React 19 introduces native Actions for async state management (`useActionState`, `useFormStatus`, `useOptimistic`), the `use()` hook for promises and conditional context, native document metadata hoisting, the React Compiler for automated memoization, and ref as a standard prop.",
    detailedAnswer: "Historically, developers had to assemble complex scaffolding for handling form submissions, loading states, optimistic UI updates, and error rollbacks using multiple `useState` and `useEffect` hooks. React 19 promotes async functions into first-class 'Actions'. Actions automatically manage pending states, error handling, optimistic updates, and form resets. Additionally, document `<title>` and `<meta>` tags are natively hoisted to `<head>`, eliminating external libraries like `react-helmet`.",
    code: `// React 19 native form action with automatic pending state
import { useActionState } from 'react';

async function updateNameAction(previousState, formData) {
  const name = formData.get('name');
  try {
    await api.updateName(name);
    return { success: true, name };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function ProfileEditor() {
  const [state, formAction, isPending] = useActionState(updateNameAction, null);

  return (
    <form action={formAction}>
      <input name="name" defaultValue={state?.name || ''} />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save'}
      </button>
      {state?.error && <p className="error">{state.error}</p>}
    </form>
  );
}`,
    recallHint: "React 19 = Native Actions + useActionState + useOptimistic + use() hook + React Compiler auto-memoization.",
    interviewTip: "Summarize React 19 as 'removing the boilerplate': no more manual `setIsSubmitting(true/false)`, no more `forwardRef`, and no more manual `useMemo`/`useCallback` thanks to the React Compiler.",
    tags: ["react19", "actions", "overview", "modern-react"],
    practice: [
      "How does React 19 reduce reliance on third-party libraries for forms and SEO metadata?",
      "What is the difference between an ordinary async function and an Action in React 19?"
    ]
  }),

  createCard({
    idNum: 62,
    category: "React 19 Innovations",
    concept: "React 19 Actions & Async Transitions",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is an 'Action' in React 19, and how does it extend `startTransition` to support asynchronous functions?",
    quickAnswer: "In React 19, any transition that uses an asynchronous function is an Action. Actions automatically handle pending state, error boundaries, optimistic updates, and sequential queuing while keeping the UI interactive.",
    detailedAnswer: "In React 18, `startTransition` only accepted synchronous functions. In React 19, `startTransition(async () => { await mutate(); })` natively awaits promises. During the async execution, React marks the transition as pending, automatically rolls back optimistic updates if the promise rejects, and catches unhandled rejections in the nearest Error Boundary.",
    code: `import { useState, useTransition } from 'react';

function LikeButton({ postId }) {
  const [likes, setLikes] = useState(0);
  const [isPending, startTransition] = useTransition();

  const handleLike = () => {
    // React 19 startTransition natively handles async functions:
    startTransition(async () => {
      const updatedCount = await api.likePost(postId);
      setLikes(updatedCount);
    });
  };

  return (
    <button onClick={handleLike} disabled={isPending}>
      ❤️ {likes} {isPending && '...'}
    </button>
  );
}`,
    recallHint: "React 19 Actions = async functions inside startTransition; auto-manages pending, errors, and rollbacks.",
    interviewTip: "Contrast React 18 (sync-only transitions) with React 19 (async actions inside transitions), emphasizing how it eliminates manual try/finally `isSubmitting` tracking.",
    tags: ["actions", "async-transitions", "startTransition", "react19"],
    practice: [
      "What happens to the pending state in React 19 if multiple async actions are triggered consecutively?",
      "How do Actions integrate with native HTML form submissions?"
    ]
  }),

  createCard({
    idNum: 63,
    category: "React 19 Innovations",
    concept: "useActionState (Formerly useFormState)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does `useActionState` work in React 19, and what are its arguments and return values?",
    quickAnswer: "`useActionState(actionFn, initialState, permalink?)` accepts an action function and initial state, returning `[state, formAction, isPending]`. It executes the action and updates `state` with the action's return value while tracking `isPending`.",
    detailedAnswer: "Renamed from the experimental `useFormState`, `useActionState` manages state produced by an Action. The action function signature is `async (previousState, formData) => nextState`. The returned `formAction` can be passed directly to `<form action={formAction}>` or invoked manually. React guarantees that multiple dispatches are queued in order, preventing race conditions from rapid submissions.",
    code: `import { useActionState } from 'react';

async function addToCartAction(prevState, formData) {
  const itemId = formData.get('itemId');
  try {
    const cart = await api.addItem(itemId);
    return { success: true, count: cart.itemCount, error: null };
  } catch (err) {
    return { ...prevState, error: err.message };
  }
}

function ProductCard({ item }) {
  const [state, formAction, isPending] = useActionState(addToCartAction, {
    count: 0,
    error: null
  });

  return (
    <form action={formAction}>
      <input type="hidden" name="itemId" value={item.id} />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Adding...' : 'Add to Cart'}
      </button>
      {state.error && <p className="error">{state.error}</p>}
    </form>
  );
}`,
    recallHint: "useActionState(action, initial) returns [state, formAction, isPending]; manages form action lifecycle.",
    interviewTip: "Mention that `useActionState` replaces custom reducer boilerplate for forms and pairs with progressive enhancement even before client JS loads.",
    tags: ["useActionState", "react19", "forms", "actions"],
    practice: [
      "What is the first argument passed to the action function in useActionState?",
      "Why is the third `permalink` argument used in SSR environments?"
    ]
  }),

  createCard({
    idNum: 64,
    category: "React 19 Innovations",
    concept: "useFormStatus Hook",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is `useFormStatus` and how does it eliminate prop drilling of form loading states to child buttons?",
    quickAnswer: "`useFormStatus` is called inside a child component of a `<form>` to access status info (`pending`, `data`, `method`, `action`) of the parent form without needing props passed from the parent.",
    detailedAnswer: "Historically, to disable a submit button inside a deeply nested form, the parent form had to pass `isSubmitting` down through props. `useFormStatus` acts like an automatic context consumer: any component placed inside `<form>` can call `const { pending } = useFormStatus()` to read if that specific enclosing form is currently submitting.",
    code: `import { useFormStatus } from 'react-dom';

// Reusable submit button component (zero props needed!)
function SubmitButton({ children }) {
  // Reads status of the parent <form> automatically!
  const { pending, data, method } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={pending ? 'loading' : ''}>
      {pending ? 'Saving...' : children}
    </button>
  );
}

// Parent form
function EditBioForm({ updateBioAction }) {
  return (
    <form action={updateBioAction}>
      <textarea name="bio" />
      {/* SubmitButton knows when this form is submitting without any prop drilling! */}
      <SubmitButton>Update Bio</SubmitButton>
    </form>
  );
}`,
    recallHint: "useFormStatus called in child of <form>; returns { pending, data }; eliminates button prop drilling.",
    interviewTip: "CRITICAL PITFALL: `useFormStatus` MUST be called from a child component *inside* the `<form>`, NOT in the same component that renders the `<form>` tag itself, because it relies on React Context internally.",
    tags: ["useFormStatus", "react19", "forms", "prop-drilling"],
    practice: [
      "Why does calling useFormStatus in the same component that renders <form> return pending: false?",
      "What properties does the object returned by useFormStatus contain?"
    ]
  }),

  createCard({
    idNum: 65,
    category: "React 19 Innovations",
    concept: "useOptimistic Hook for Instant UI Feedback",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does `useOptimistic` work in React 19, and how does it guarantee clean state rollback if an action fails?",
    quickAnswer: "`useOptimistic(passthroughState, updateFn)` displays optimistic data immediately while an async action is in flight. Once the action resolves (or rejects), React automatically reverts the optimistic state back to the actual authoritative state.",
    detailedAnswer: "In chat or social apps, waiting 500ms for a network response before displaying a sent message feels sluggish. `useOptimistic` allows you to immediately render the pending message in the list with a 'Sending...' status. React maintains the real state and the optimistic state separately. When the Action finishes, React drops the optimistic state and renders the authoritative state; if the Action throws an error, the optimistic state is automatically discarded with zero manual rollback code.",
    code: `import { useOptimistic } from 'react';

function MessageFeed({ messages, sendMessageAction }) {
  // optimisticMessages updates instantly during action execution
  const [optimisticMessages, setOptimisticMessages] = useOptimistic(
    messages,
    (currentMessages, newText) => [
      ...currentMessages,
      { id: 'temp-' + Date.now(), text: newText, sending: true }
    ]
  );

  const formAction = async (formData) => {
    const text = formData.get('message');
    // 1. Show message instantly in UI:
    setOptimisticMessages(text);
    // 2. Perform actual network action:
    await sendMessageAction(text);
    // React automatically reconciles authoritative messages!
  };

  return (
    <div>
      {optimisticMessages.map(m => (
        <p key={m.id} style={{ opacity: m.sending ? 0.5 : 1 }}>
          {m.text} {m.sending && '(sending...)'}
        </p>
      ))}
      <form action={formAction}>
        <input name="message" required />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}`,
    recallHint: "useOptimistic shows instant speculative UI; automatically reverts if action fails without manual rollback logic.",
    interviewTip: "Contrast `useOptimistic` with manual optimistic UI where developers had to write complex `try/catch` blocks saving previous state and restoring it on catch.",
    tags: ["useOptimistic", "optimistic-ui", "react19", "ux"],
    practice: [
      "What happens to the optimistic state if the network request fails and throws an error?",
      "Can multiple optimistic updates be applied simultaneously?"
    ]
  }),

  createCard({
    idNum: 66,
    category: "React 19 Innovations",
    concept: "The use() Hook for Promises & Context",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the `use()` hook in React 19, and how does it fundamentally break traditional Hook rules by allowing calls inside conditions and loops?",
    quickAnswer: "`use(resource)` unrolls Promises or Context directly inside render. Unlike standard hooks (`useState`, `useEffect`), `use()` CAN be called inside `if` statements and loops, enabling conditional reading of Context and resources.",
    detailedAnswer: "The `use()` API accepts either a Promise or a React Context. When passed a Promise, it integrates with `<Suspense>`: if pending, it suspends; if rejected, it throws to the ErrorBoundary; if resolved, it returns the value synchronously. When passed a Context (`use(ThemeContext)`), it acts like `useContext`, but can be called conditionally (e.g. `if (showTheme) { const theme = use(ThemeContext); }`), breaking the strict rule that hooks cannot be inside `if` blocks.",
    code: `import { use, Suspense } from 'react';

// 1. Reading Context conditionally:
function Banner({ showBanner, ThemeContext }) {
  if (!showBanner) return null;
  
  // VALID IN REACT 19! Hook called inside conditional block!
  const theme = use(ThemeContext);
  return <div className={theme}>Banner content</div>;
}

// 2. Unrolling Promises with Suspense:
function Comments({ commentsPromise }) {
  // Suspends component until promise resolves:
  const comments = use(commentsPromise);
  
  return (
    <ul>
      {comments.map(c => <li key={c.id}>{c.text}</li>)}
    </ul>
  );
}`,
    recallHint: "use(promiseOrContext) unwraps promises via Suspense and can be called conditionally inside 'if' blocks.",
    interviewTip: "Clarify that `use()` cannot be called in arbitrary JS functions (like event handlers)—it still must be called during a component or hook render pass, but can be inside conditional branches.",
    tags: ["use-hook", "react19", "promises", "context", "suspense"],
    practice: [
      "Why does React 19 allow `use()` inside conditions while forbidding `useState` in conditions?",
      "Why must promises passed to `use()` be cached or created outside the render function?"
    ]
  }),

  createCard({
    idNum: 67,
    category: "React 19 Innovations",
    concept: "Native Document Metadata Hoisting",
    priority: "must-know",
    difficulty: "beginner",
    question: "How does React 19 handle document metadata (`<title>`, `<meta>`, `<link>`), and why does it make libraries like `react-helmet` obsolete?",
    quickAnswer: "React 19 natively hoists `<title>`, `<meta>`, and `<link rel='canonical'>` tags rendered anywhere in the component tree into the document's `<head>`, eliminating third-party metadata management libraries.",
    detailedAnswer: "In older React versions, rendering a `<title>` tag inside a deep child component rendered a literal `<title>` tag inside the DOM body (`<body><title>`), which was invalid HTML and ignored by search engine scrapers. React 19 intercepts document metadata elements during render and automatically hoists them to `<head>`, handling deduplication and precedence rules natively across client and server renders.",
    code: `// Anywhere in your component tree:
function BlogPost({ post }) {
  return (
    <article>
      {/* React 19 automatically hoists these tags to document <head>! */}
      <title>{post.title} | Tech Blog</title>
      <meta name="description" content={post.summary} />
      <meta property="og:title" content={post.title} />
      <link rel="canonical" href={\`https://blog.com/posts/\${post.slug}\`} />

      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  );
}`,
    recallHint: "React 19 natively hoists <title>, <meta>, <link> to <head>; obsoletes react-helmet.",
    interviewTip: "Highlight that this works seamlessly in both Client-Side Rendering (CSR) and Server-Side Rendering (SSR) with streaming.",
    tags: ["metadata", "react19", "seo", "head-hoisting"],
    practice: [
      "How does React 19 resolve conflicting `<title>` tags rendered by multiple components?",
      "Can `<meta charset>` be rendered inside child components in React 19?"
    ]
  }),

  createCard({
    idNum: 68,
    category: "React 19 Innovations",
    concept: "Asset & Resource Preloading APIs",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are React 19's native resource preloading functions (`preload`, `preinit`, `prefetchDNS`) and how do they optimize Core Web Vitals?",
    quickAnswer: "React 19 provides functions (`preload`, `preinit`, `preconnect`) in `react-dom` to start loading external fonts, stylesheets, scripts, and DNS origins before components render, preventing layout shifts and speeding up Largest Contentful Paint (LCP).",
    detailedAnswer: "Normally, browsers discover fonts and stylesheets late in the waterfall after CSS is parsed. In React 19, `react-dom` exports declarative resource hints. Calling `preload(href, { as: 'font' })` or `preinit(href, { as: 'style' })` instructs the browser to immediately begin fetching critical assets with optimal cache deduplication, even before the component mounts or streams HTML.",
    code: `import { preload, preinit, prefetchDNS } from 'react-dom';

function AppLayout() {
  // Pre-resolve external DNS domain
  prefetchDNS('https://fonts.googleapis.com');

  // Preload critical web font with high priority
  preload('https://fonts.gstatic.com/s/inter.woff2', {
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous'
  });

  // Preinit loads and executes critical stylesheet immediately
  preinit('/styles/theme.css', { as: 'style' });

  return <div className="app">{/* ... */}</div>;
}`,
    recallHint: "preload(), preinit(), prefetchDNS() in react-dom fetch fonts and styles early to optimize LCP and CLS.",
    interviewTip: "Explain how these APIs integrate with SSR: React injects corresponding `<link rel='preload'>` tags directly into the initial server HTML stream before component HTML chunks arrive.",
    tags: ["preloading", "web-vitals", "react19", "assets"],
    practice: [
      "What is the difference between `preload()` and `preinit()` in react-dom?",
      "How does asset preloading improve Largest Contentful Paint (LCP)?"
    ]
  }),

  createCard({
    idNum: 69,
    category: "React 19 Innovations",
    concept: "The React Compiler (React Forget)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the React Compiler (React Forget) and how does it automate memoization without manual `useMemo` or `useCallback`?",
    quickAnswer: "The React Compiler is an optimizing build-time compiler that analyzes component ASTs and automatically memoizes values, objects, and JSX elements at fine-grained sub-expression levels, preserving memoization without manual `useMemo` or `useCallback`.",
    detailedAnswer: "Manual memoization (`useMemo`, `useCallback`, `React.memo`) is tedious, error-prone, and easily broken by unstable inline objects. The React Compiler understands JavaScript semantics and the Rules of React. It statically computes dependencies at compile time and wraps fine-grained expressions in caching primitives under the hood. Developers write idiomatic, clean JavaScript, and the compiler ensures minimal re-renders automatically.",
    code: `// DEVELOPER WRITES CLEAN IDIOMATIC JAVASCRIPT:
function FriendList({ friends, filterText }) {
  // No useMemo! No useCallback!
  const visibleFriends = friends.filter(f => f.name.includes(filterText));
  
  const handleSelect = (id) => {
    console.log('Selected:', id);
  };

  return <List items={visibleFriends} onSelect={handleSelect} />;
}

// REACT COMPILER COMPILES TO FINE-GRAINED CACHED BYTECODE:
// It automatically memoizes visibleFriends and handleSelect using an internal
// cache array ($[0], $[1]), re-evaluating only when friends or filterText changes!`,
    recallHint: "React Compiler automatically memoizes components and values at build time; eliminates manual useMemo/useCallback.",
    interviewTip: "Emphasize that the React Compiler relies on components adhering strictly to the Rules of React (purity, no mutating props/state). Code that mutates objects in render will fail compiler optimization.",
    tags: ["react-compiler", "react-forget", "auto-memoization", "react19"],
    practice: [
      "What coding practices break the React Compiler's static analysis?",
      "Does the React Compiler replace React Fiber or Virtual DOM?"
    ]
  }),

  createCard({
    idNum: 70,
    category: "React 19 Innovations",
    concept: "Ref Callback Cleanup Functions",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What new feature did React 19 introduce for Ref Callbacks, and how does it prevent DOM memory leaks?",
    quickAnswer: "React 19 allows ref callbacks to return a cleanup function (`ref={node => () => cleanup(node)}`), eliminating the old pattern of checking `if (node === null)` on unmount.",
    detailedAnswer: "In React 18, when an element unmounted, React invoked the ref callback with `null` (`node => { if (!node) cleanup(); }`). This was asymmetric and easy to forget. In React 19, ref callbacks mirror `useEffect`: returning a function from a ref callback registers it as a cleanup handler that React invokes automatically when the element detaches from the DOM.",
    code: `// 1. LEGACY REACT 18 REF CALLBACK (Messy null-check):
<div ref={node => {
  if (node) {
    observer.observe(node);
  } else {
    observer.disconnect(); // Must remember null check!
  }
}} />

// 2. MODERN REACT 19 REF CALLBACK (Clean return cleanup!):
<div ref={node => {
  const resizeObserver = new ResizeObserver(entries => {
    handleResize(entries);
  });
  resizeObserver.observe(node);

  // React 19 automatically invokes this cleanup function on unmount!
  return () => {
    resizeObserver.disconnect();
  };
}} />`,
    recallHint: "Ref callbacks can now return a cleanup function on unmount; mirrors useEffect cleanup semantics.",
    interviewTip: "Highlight that returning a cleanup function makes ref callbacks symmetric and eliminates the risk of dangling listeners when integrating third-party DOM widgets.",
    tags: ["refs", "ref-callback", "cleanup", "react19"],
    practice: [
      "Why did older React invoke ref callbacks with `null` during unmount?",
      "Can a ref callback return a Promise?"
    ]
  }),

  createCard({
    idNum: 71,
    category: "React 19 Innovations",
    concept: "Enhanced Hydration Error Diffs in React 19",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How did React 19 improve hydration error messages, and how does it help developers locate server/client mismatches?",
    quickAnswer: "React 19 replaced cryptic single-line hydration errors with clear, unified visual diffs showing the exact HTML mismatch between the server-rendered markup and the client-rendered tree.",
    detailedAnswer: "In React 18, hydration errors often logged vague messages like `Warning: Text content did not match. Server: 'A' Client: 'B'` or generic DOM tree errors without showing the component origin. React 19 outputs a detailed terminal/console diff highlighting the mismatched tags, attributes, or text nodes with red and green diff indicators, pointing directly to the offending component and file line.",
    code: `// Common hydration mismatch bug:
function Header() {
  // SERVER renders: "Loading..."
  // CLIENT with window available renders: "Alice" -> Hydration Crash!
  const userName = typeof window !== 'undefined' ? localStorage.getItem('user') : 'Loading...';
  return <h1>Welcome, {userName}</h1>;
}

// React 19 Console Output:
// Hydration failed because the server-rendered HTML didn't match the client.
//   <Header>
//     <h1>
// -     Welcome, Loading...  (Server)
// +     Welcome, Alice       (Client)
//     </h1>
//   </Header>`,
    recallHint: "React 19 provides unified visual git-style diffs for hydration errors, pin-pointing the exact mismatched markup.",
    interviewTip: "Explain how to properly resolve server/client mismatches by using two-pass rendering with a `mounted` state in `useEffect` or using `suppressHydrationWarning` for timestamps.",
    tags: ["hydration", "react19", "debugging", "ssr"],
    practice: [
      "When is using `suppressHydrationWarning` valid on an HTML tag?",
      "Why does accessing localStorage or Date.now() directly in render cause hydration mismatches?"
    ]
  }),

  createCard({
    idNum: 72,
    category: "React 19 Innovations",
    concept: "Progressive Enhancement with Form Actions",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do React 19 Form Actions support Progressive Enhancement, allowing forms to work before or without client-side JavaScript?",
    quickAnswer: "When an Action is passed to `<form action={serverAction}>`, React can serialize the form submission as a standard HTTP POST request if JavaScript is disabled or still downloading, ensuring complete functionality on slow networks.",
    detailedAnswer: "Traditional SPA form submissions relied on `e.preventDefault()` inside an `onSubmit` handler. If a user submitted a form before bundle scripts finished loading (or on an unstable 3G connection), the button was dead or reloaded the page without submitting data. With React 19 Server Actions, forms render with native HTML action endpoints. If JavaScript is active, React intercepts the submit with an async Action; if JavaScript is pending, the browser submits a native standard HTTP POST.",
    code: `// Progressive enhancement in Next.js / React Server Components:
// This form is 100% functional even if client JS is completely disabled!
import { updateBio } from './actions'; // Server Action

export default function ProfilePage({ user }) {
  return (
    <form action={updateBio}>
      <input type="hidden" name="userId" value={user.id} />
      <textarea name="bio" defaultValue={user.bio} />
      {/* Submits via native HTTP POST if JS disabled, or via Action transition if JS active! */}
      <button type="submit">Save Changes</button>
    </form>
  );
}`,
    recallHint: "Form Actions fall back to native HTTP POST before JS loads; progressive enhancement guarantees zero dead clicks.",
    interviewTip: "Connect this to Core Web Vitals (INP - Interaction to Next Paint): users on slow mobile devices can interact with forms immediately upon HTML delivery without waiting for 2MB of JS bundles.",
    tags: ["progressive-enhancement", "form-actions", "rsc", "react19"],
    practice: [
      "How does the server action handle redirects after a successful non-JS form submission?",
      "What are the security implications of progressive enhancement with CSRF tokens?"
    ]
  })
];
