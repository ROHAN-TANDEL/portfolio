module.exports = [
  {
    id: "react-ex-33",
    title: "Non-Blocking Search Filter with useTransition and Pending Indicator",
    category: "React 18 & 19 Modern Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses React 18 useTransition to keep a search input responsive at 60 FPS while filtering a massive 10,000-item array in the background, displaying an inline loading spinner.",
    conceptsCovered: [
      "useTransition Hook",
      "startTransition Non-Urgent Updates",
      "Urgent vs Transition Work",
      "Responsive Input Typing"
    ],
    code: `import { useState, useTransition } from 'react';

// Generates 10,000 mock items
const allItems = Array.from({ length: 10000 }, (_, i) => \`Enterprise Server Node #\${i + 1}\`);

export function NonBlockingSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredItems, setFilteredItems] = useState(allItems);
  const [isPending, startTransition] = useTransition();

  const handleSearchChange = (e) => {
    const nextQuery = e.target.value;
    
    // 1. URGENT: Updates the input field immediately on screen
    setSearchTerm(nextQuery);

    // 2. NON-URGENT: Heavy array filtering runs in background transition!
    startTransition(() => {
      const results = allItems.filter(item => 
        item.toLowerCase().includes(nextQuery.toLowerCase())
      );
      setFilteredItems(results);
    });
  };

  return (
    <div className="search-box">
      <input 
        value={searchTerm} 
        onChange={handleSearchChange} 
        placeholder="Type to filter 10,000 items..." 
      />
      {isPending && <span className="spinner">Filtering background results...</span>}

      <div style={{ opacity: isPending ? 0.6 : 1 }}>
        <p>Found: {filteredItems.length} records</p>
        <ul>
          {filteredItems.slice(0, 50).map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}`,
    breakdown: [
      "setSearchTerm updates immediately, ensuring zero typing lag or stutter on the input element.",
      "startTransition tells React that filtering 10,000 items is interruptible background work.",
      "If the user types a new character before the filter finishes, React discards stale work and restarts with the new query.",
      "isPending provides clean visual feedback without replacing the list with a blank screen."
    ],
    expectedOutput: `Typing is completely instantaneous and smooth; background list updates with subtle pending indicator.`
  },
  {
    id: "react-ex-34",
    title: "Fast Typing in Heavy Data Grids with useDeferredValue",
    category: "React 18 & 19 Modern Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "Defers slow re-renders of a child data grid using useDeferredValue when receiving values via props without direct setter access.",
    conceptsCovered: [
      "useDeferredValue",
      "React.memo Child Bailing",
      "Stale Data Indicators",
      "Props-Based Concurrency"
    ],
    code: `import { useState, useDeferredValue, memo } from 'react';

// Memoized heavy table component
const HeavyDataGrid = memo(function HeavyDataGrid({ filterQuery }) {
  // Heavy computation simulation...
  const startTime = performance.now();
  while (performance.now() - startTime < 30) {
    // Artificial 30ms render lag per frame
  }

  return (
    <div className="grid">
      <p>Rendered with filter: "{filterQuery}"</p>
    </div>
  );
});

export function Dashboard() {
  const [query, setQuery] = useState('');
  
  // deferredQuery lags behind during fast typing
  const deferredQuery = useDeferredValue(query);
  const isStale = query !== deferredQuery;

  return (
    <div>
      <input 
        value={query} 
        onChange={e => setQuery(e.target.value)} 
        placeholder="Filter heavy grid..." 
      />
      {/* Dim table when showing stale deferred data */}
      <div style={{ opacity: isStale ? 0.5 : 1 }}>
        <HeavyDataGrid filterQuery={deferredQuery} />
      </div>
    </div>
  );
}`,
    breakdown: [
      "query updates synchronously on every keystroke, keeping the input completely responsive.",
      "deferredQuery retains the previous value on the urgent pass and catches up in a background transition pass.",
      "HeavyDataGrid is wrapped in React.memo, allowing it to skip rendering on the urgent pass.",
      "Comparing query !== deferredQuery exposes isStale for visual feedback."
    ],
    expectedOutput: `User types at high speed without keystroke latency; heavy table catches up smoothly in background.`
  },
  {
    id: "react-ex-35",
    title: "React 19 Form Submission Action with useActionState and Server Validation",
    category: "React 18 & 19 Modern Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "A modern React 19 form using useActionState with an asynchronous action function, handling form validation errors and pending submit states.",
    conceptsCovered: [
      "useActionState (React 19)",
      "Async Form Actions",
      "Server Validation Response",
      "Native HTML form Integration"
    ],
    code: `import { useActionState } from 'react';

// Server Action / Async Action Handler
async function createPostAction(previousState, formData) {
  const title = formData.get('title');
  const body = formData.get('body');

  // Validation
  if (!title || title.length < 5) {
    return { success: false, error: 'Title must be at least 5 characters long.' };
  }

  try {
    // Simulate network delay
    await new Promise(r => setTimeout(r, 1000));
    return { success: true, message: \`Post "\${title}" published successfully!\` };
  } catch (err) {
    return { success: false, error: 'Server error while publishing post.' };
  }
}

export function CreatePostForm() {
  const [state, formAction, isPending] = useActionState(createPostAction, null);

  return (
    <form action={formAction} className="action-form">
      <h3>Create Article</h3>
      <input name="title" placeholder="Post title" required />
      <textarea name="body" placeholder="Write article content..." required />

      <button type="submit" disabled={isPending}>
        {isPending ? 'Publishing...' : 'Publish Post'}
      </button>

      {state?.error && <div className="alert-error">{state.error}</div>}
      {state?.success && <div className="alert-success">{state.message}</div>}
    </form>
  );
}`,
    breakdown: [
      "useActionState binds the async createPostAction function to the form.",
      "formAction is passed directly to <form action={formAction}>.",
      "isPending automatically tracks when the async action is awaiting network promises.",
      "state holds validation errors or success messages returned by the action function."
    ],
    expectedOutput: `Form submits via React 19 Action; button disables automatically during in-flight network request.`
  },
  {
    id: "react-ex-36",
    title: "Real-Time Chat Message Feed with useOptimistic Instant Echo",
    category: "React 18 & 19 Modern Patterns",
    difficulty: "advanced",
    whatThisCodeCovers: "Demonstrates speculative UI rendering with React 19's useOptimistic hook, displaying sent chat messages instantly and rolling back on network failure.",
    conceptsCovered: [
      "useOptimistic Hook",
      "Speculative State Layer",
      "Automatic Error Rollback",
      "Chat Feed UX Optimization"
    ],
    code: `import { useOptimistic, useRef } from 'react';

export function ChatFeed({ messages, onSendMessage }) {
  const formRef = useRef(null);

  // Maintain optimistic messages list derived from authoritative 'messages'
  const [optimisticMessages, setOptimisticMessages] = useOptimistic(
    messages,
    (currentMessages, newText) => [
      ...currentMessages,
      { id: 'temp-' + Date.now(), text: newText, sending: true }
    ]
  );

  const handleSubmit = async (formData) => {
    const text = formData.get('message');
    if (!text) return;

    formRef.current?.reset(); // Clear input immediately

    // 1. Instantly display message with sending: true
    setOptimisticMessages(text);

    // 2. Perform network mutation
    await onSendMessage(text);
    // React automatically discards optimistic layer and displays real server message!
  };

  return (
    <div className="chat-window">
      <div className="messages-list">
        {optimisticMessages.map(msg => (
          <div key={msg.id} className={\`msg \${msg.sending ? 'msg-sending' : ''}\`}>
            <span>{msg.text}</span>
            {msg.sending && <small className="sending-indicator"> ⏳</small>}
          </div>
        ))}
      </div>

      <form ref={formRef} action={handleSubmit} className="chat-input-bar">
        <input name="message" placeholder="Type a message..." required />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}`,
    breakdown: [
      "useOptimistic creates a speculative message branch attached to the current messages prop.",
      "setOptimisticMessages(text) renders the new message in the DOM in <1ms before network request starts.",
      "Once onSendMessage resolves or rejects, React drops the optimistic branch.",
      "If the action fails and throws, the optimistic message automatically vanishes without writing manual rollback logic."
    ],
    expectedOutput: `Chat message appears immediately on Send click with a subtle hourglass icon until server confirms.`
  },
  {
    id: "react-ex-37",
    title: "Loading State Extraction inside Child Buttons with useFormStatus",
    category: "React 18 & 19 Modern Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses React DOM's useFormStatus hook to create a reusable submit button that reads parent form pending state without any prop drilling.",
    conceptsCovered: [
      "useFormStatus Hook",
      "Zero Prop Drilling",
      "Parent Form Context",
      "Reusable UI Submit Buttons"
    ],
    code: `import { useFormStatus } from 'react-dom';

// Reusable Button: Needs ZERO props passed from parent!
export function SubmitButton({ children = 'Save' }) {
  // Reads pending state of whichever <form> it is placed inside!
  const { pending, data, method } = useFormStatus();

  return (
    <button 
      type="submit" 
      disabled={pending}
      className={\`submit-btn \${pending ? 'submitting' : ''}\`}
    >
      {pending ? (
        <>
          <span className="spinner" /> Saving...
        </>
      ) : (
        children
      )}
    </button>
  );
}

// Parent Form: Does NOT need to track or pass isSubmitting props!
export function SettingsForm({ saveSettingsAction }) {
  return (
    <form action={saveSettingsAction}>
      <label>Username</label>
      <input name="username" defaultValue="alice" />

      {/* SubmitButton knows when form is submitting automatically! */}
      <SubmitButton>Save Profile</SubmitButton>
    </form>
  );
}`,
    breakdown: [
      "useFormStatus is imported from 'react-dom'.",
      "Must be placed in a component rendered inside a <form> tag.",
      "Extracts pending boolean directly from React's internal form context.",
      "Eliminates the need for parent forms to pass isSubmitting or loading props down to buttons."
    ],
    expectedOutput: `SubmitButton automatically disables and shows spinner whenever parent form action is running.`
  },
  {
    id: "react-ex-38",
    title: "Unrolling Dynamic Data Promises in Render with the use() Hook",
    category: "React 18 & 19 Modern Patterns",
    difficulty: "advanced",
    whatThisCodeCovers: "Unwraps asynchronous data promises directly inside component render functions using the React 19 use() hook combined with Suspense.",
    conceptsCovered: [
      "React 19 use() Hook",
      "Promise Unrolling",
      "Suspense Data Boundaries",
      "Async Component Patterns"
    ],
    code: `import { use, Suspense } from 'react';

// Child component unrolling promise with use()
function UserGreeting({ userPromise }) {
  // Unwraps promise directly in render! (Suspends until resolved)
  const user = use(userPromise);

  return (
    <header>
      <h2>Welcome back, {user.name}!</h2>
      <p>Role: {user.role}</p>
    </header>
  );
}

// Parent component initiating fetch and passing promise:
export function DashboardPage() {
  // Start promise outside render or pass from Server Component
  const userPromise = fetch('/api/user/me').then(r => r.json());

  return (
    <div className="dashboard-shell">
      <Suspense fallback={<div>Loading user profile...</div>}>
        <UserGreeting userPromise={userPromise} />
      </Suspense>
      <main>Dashboard content...</main>
    </div>
  );
}`,
    breakdown: [
      "The use(promise) hook unrolls promises without requiring useEffect or useState.",
      "If the promise is pending, the component suspends and the nearest Suspense fallback renders.",
      "If the promise rejects, the nearest ErrorBoundary catches the error.",
      "Unlike standard hooks, use() can be called inside loops and conditional if blocks."
    ],
    expectedOutput: `Component suspends while promise is in flight and renders data synchronously once resolved.`
  },
  {
    id: "react-ex-39",
    title: "Dynamic Document Head Meta and Canonical Tag Injection in React 19",
    category: "React 18 & 19 Modern Patterns",
    difficulty: "beginner",
    whatThisCodeCovers: "Natively hoists document title, meta description, and canonical link tags to document head in React 19 without third-party libraries.",
    conceptsCovered: [
      "Native Metadata Hoisting",
      "head Injection in React 19",
      "SEO Optimization",
      "Eliminating react-helmet"
    ],
    code: `export function ArticleDetail({ article }) {
  return (
    <article className="article-container">
      {/* React 19 automatically hoists these tags to document <head>! */}
      <title>{article.title} - Modern Tech</title>
      <meta name="description" content={article.excerpt} />
      <meta property="og:title" content={article.title} />
      <meta property="og:image" content={article.heroImage} />
      <link rel="canonical" href={\`https://example.com/blog/\${article.slug}\`} />

      {/* Main component markup */}
      <h1>{article.title}</h1>
      <p className="meta">By {article.author} • {article.readingTime} min read</p>
      <div className="content">{article.body}</div>
    </article>
  );
}`,
    breakdown: [
      "React 19 intercepts <title>, <meta>, and <link> elements during rendering.",
      "Automatically hoists them out of the body and inserts them into document <head>.",
      "Handles deduplication and overrides previous meta tags natively.",
      "Completely replaces external legacy libraries like react-helmet."
    ],
    expectedOutput: `Browser tab displays article title and document <head> contains correct OpenGraph meta tags.`
  },
  {
    id: "react-ex-40",
    title: "Asset Preloading with preload and preinit in react-dom",
    category: "React 18 & 19 Modern Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses React 19's native asset preloading functions (preload, preinit, prefetchDNS) to optimize web font, stylesheet, and external script loading.",
    conceptsCovered: [
      "react-dom preload()",
      "react-dom preinit()",
      "Web Font Preloading",
      "Largest Contentful Paint (LCP)"
    ],
    code: `import { preload, preinit, prefetchDNS } from 'react-dom';

export function AppShell() {
  // Pre-resolve external CDN DNS
  prefetchDNS('https://cdn.example.com');

  // Preload critical web font with high priority to prevent layout shifts
  preload('https://cdn.example.com/fonts/inter.woff2', {
    as: 'font',
    type: 'font/woff2',
    crossOrigin: 'anonymous'
  });

  // Preinit stylesheet: injects link and executes immediately
  preinit('/styles/design-tokens.css', { as: 'style' });

  return (
    <div className="app-shell">
      <header>Application Header</header>
      <main>Content rendered with preloaded font...</main>
    </div>
  );
}`,
    breakdown: [
      "preload tells the browser to download a high-priority asset (like fonts or hero images) early.",
      "preinit loads and applies styles or scripts immediately in document <head>.",
      "prefetchDNS initiates early DNS handshakes for third-party asset domains.",
      "Dramatically reduces FOIT (Flash of Invisible Text) and improves Core Web Vitals LCP score."
    ],
    expectedOutput: `Browser immediately requests critical fonts and styles before component HTML finishes rendering.`
  },
  {
    id: "react-ex-41",
    title: "Ref-as-a-Prop Direct Forwarding in React 19 (Zero forwardRef)",
    category: "React 18 & 19 Modern Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates the React 19 simplification where ref is passed directly as a standard prop into function component arguments without forwardRef.",
    conceptsCovered: [
      "Ref as Prop (React 19)",
      "Deprecation of forwardRef",
      "Direct Ref Passing",
      "Clean Component Interfaces"
    ],
    code: `import { useRef } from 'react';

// In React 19: NO forwardRef wrapper required!
// 'ref' is simply accepted as a standard function prop!
function TextInput({ ref, label, placeholder, ...rest }) {
  return (
    <div className="input-group">
      <label>{label}</label>
      <input ref={ref} placeholder={placeholder} {...rest} />
    </div>
  );
}

// Parent component passing ref naturally:
export function LoginForm() {
  const emailInputRef = useRef(null);

  const focusEmail = () => {
    emailInputRef.current?.focus();
  };

  return (
    <div>
      <TextInput 
        ref={emailInputRef} 
        label="Email Address" 
        placeholder="you@acme.com" 
      />
      <button onClick={focusEmail}>Focus Input</button>
    </div>
  );
}`,
    breakdown: [
      "In React 19, ref is no longer an excluded reserved keyword intercepted by compiler gymnastics.",
      "Function components receive ref directly in their props argument.",
      "Eliminates forwardRef wrapper ceremony and simplifies TypeScript prop types.",
      "Directly backward-compatible with older ref handling."
    ],
    expectedOutput: `Parent component focuses child input directly through ref prop without forwardRef wrapper.`
  },
  {
    id: "react-ex-42",
    title: "Synchronous Native DOM Flush with flushSync",
    category: "React 18 & 19 Modern Patterns",
    difficulty: "advanced",
    whatThisCodeCovers: "Forces React to flush pending state updates synchronously to the DOM using flushSync to measure elements or scroll immediately after an update.",
    conceptsCovered: [
      "flushSync Escape Hatch",
      "Synchronous DOM Updates",
      "Immediate Scroll Alignment",
      "Automatic Batching De-opt"
    ],
    code: `import { useState, useRef } from 'react';
import { flushSync } from 'react-dom';

export function ChatScroller() {
  const [messages, setMessages] = useState(['Hello!']);
  const listRef = useRef(null);

  const handleAddMessage = () => {
    const newMessage = \`Message #\${messages.length + 1}\`;

    // Normal setState would batch and update asynchronously AFTER this function exits.
    // flushSync FORCES React to mutate the real DOM synchronously right now!
    flushSync(() => {
      setMessages(prev => [...prev, newMessage]);
    });

    // DOM is 100% updated on the very next line:
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  };

  return (
    <div>
      <div ref={listRef} className="chat-scroll-pane">
        {messages.map((m, i) => (
          <p key={i}>{m}</p>
        ))}
      </div>
      <button onClick={handleAddMessage}>Send & Scroll</button>
    </div>
  );
}`,
    breakdown: [
      "Normal setState schedules an update; reading DOM immediately afterward sees outdated DOM height.",
      "flushSync forces React to reconcile and commit the DOM mutation synchronously.",
      "Immediately following flushSync, listRef.current.scrollHeight includes the newly added message.",
      "Enables instant scrolling to bottom without requiring a delayed useEffect tick."
    ],
    expectedOutput: `Chat pane adds message and scrolls instantly to the bottom in the exact same event tick.`
  }
];
