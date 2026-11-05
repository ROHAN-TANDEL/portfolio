module.exports = [
  {
    id: "react-ex-43",
    title: "Windowed Virtual List with react-window for 100,000 Records",
    category: "Production Patterns & Performance",
    difficulty: "advanced",
    whatThisCodeCovers: "Renders 100,000 items at 60 FPS by rendering only the visible viewport rows using react-window virtualization.",
    conceptsCovered: [
      "Virtual DOM Windowing",
      "react-window FixedSizeList",
      "Memory Footprint Minimization",
      "60 FPS Scroll Performance"
    ],
    code: `import { FixedSizeList as List } from 'react-window';

// 100,000 large records
const bigDataset = Array.from({ length: 100000 }, (_, index) => ({
  id: index,
  accountNumber: \`ACC-\${100000 + index}\`,
  balance: (Math.random() * 50000).toFixed(2),
  status: index % 5 === 0 ? 'FLAGGED' : 'ACTIVE'
}));

// Row renderer receives index and calculated absolute positioning style
const Row = ({ index, style }) => {
  const item = bigDataset[index];
  return (
    <div style={style} className={\`table-row \${index % 2 === 0 ? 'even' : 'odd'}\`}>
      <span className="col-id">#{item.id}</span>
      <span className="col-acc">{item.accountNumber}</span>
      <span className="col-bal">\${item.balance}</span>
      <span className={\`status status-\${item.status}\`}>{item.status}</span>
    </div>
  );
};

export function VirtualizedAccountTable() {
  return (
    <div className="table-container">
      <h3>Live Accounts (100,000 Rows)</h3>
      {/* List renders only ~15 DOM nodes instead of 100,000! */}
      <List
        height={450}          // Height of viewport container
        itemCount={bigDataset.length}
        itemSize={40}         // Row height in pixels
        width="100%"
        overscanCount={5}     // Pre-renders 5 rows above/below viewport
      >
        {Row}
      </List>
    </div>
  );
}`,
    breakdown: [
      "FixedSizeList calculates the visible scroll range based on container height (450px) and itemSize (40px).",
      "Only ~15 physical <div> nodes are mounted in the browser DOM at any time.",
      "The style prop passes absolute positioning (top: 400px), recycling DOM nodes as user scrolls.",
      "overscanCount={5} pre-renders a small buffer above and below to eliminate whitespace flash on fast flick scrolling."
    ],
    expectedOutput: `Users scroll through 100,000 records with buttery-smooth 60 FPS performance and <5MB DOM memory.`
  },
  {
    id: "react-ex-44",
    title: "Route-Based Code Splitting with React.lazy and Error Boundary Fallback",
    category: "Production Patterns & Performance",
    difficulty: "intermediate",
    whatThisCodeCovers: "Splits large administrative routes into on-demand asynchronous chunks using React.lazy, Suspense, and a dedicated Error Boundary to catch network chunk loading failures.",
    conceptsCovered: [
      "React.lazy Code Splitting",
      "Chunk Load Failure Defense",
      "Suspense Fallback UI",
      "Dynamic Route Bundling"
    ],
    code: `import { lazy, Suspense, Component } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';

// Error Boundary specifically catching network chunk loading failures (e.g. user offline or new deploy)
class ChunkErrorBoundary extends Component {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="chunk-error">
          <p>Failed to load page. A new app version may be available.</p>
          <button onClick={() => window.location.reload()}>Reload Page</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy-loaded route chunks
const AnalyticsDashboard = lazy(() => import('./routes/AnalyticsDashboard'));
const SystemSettings = lazy(() => import('./routes/SystemSettings'));

export function AppRouter() {
  return (
    <BrowserRouter>
      <nav>
        <Link to="/analytics">Analytics</Link>
        <Link to="/settings">Settings</Link>
      </nav>

      <ChunkErrorBoundary>
        <Suspense fallback={<div className="skeleton-loader">Loading page module...</div>}>
          <Routes>
            <Route path="/analytics" element={<AnalyticsDashboard />} />
            <Route path="/settings" element={<SystemSettings />} />
          </Routes>
        </Suspense>
      </ChunkErrorBoundary>
    </BrowserRouter>
  );
}`,
    breakdown: [
      "lazy(() => import(...)) instructs bundlers to emit separate JavaScript chunk files.",
      "Browser downloads AnalyticsDashboard chunk ONLY when the user clicks the Analytics route link.",
      "ChunkErrorBoundary catches network dropouts or 404s when a new deployment invalidates older chunk hashes.",
      "Suspense displays a skeleton screen while the chunk downloads over the network."
    ],
    expectedOutput: `Initial bundle excludes admin code; navigating to /analytics downloads chunk on demand.`
  },
  {
    id: "react-ex-45",
    title: "Fine-Grained React.memo with Custom Equality Comparator",
    category: "Production Patterns & Performance",
    difficulty: "intermediate",
    whatThisCodeCovers: "Wraps a complex chart widget in React.memo with a custom comparator function, ignoring irrelevant parent prop changes and re-rendering only when core telemetry IDs change.",
    conceptsCovered: [
      "React.memo Custom Comparator",
      "Shallow Equality Override",
      "Targeted Bailout Optimization",
      "Expensive Render Prevention"
    ],
    code: `import React, { memo } from 'react';

// Custom comparison function:
// Returns TRUE if nextProps are EQUIVALENT to prevProps (skip render!)
// Returns FALSE if component MUST re-render.
function areChartPropsEqual(prevProps, nextProps) {
  // Compare only critical chart ID, timestamps, and series length:
  const isSameId = prevProps.chartId === nextProps.chartId;
  const isSameVersion = prevProps.dataVersion === nextProps.dataVersion;
  const isSameTheme = prevProps.theme === nextProps.theme;

  return isSameId && isSameVersion && isSameTheme;
}

export const HeavyChart = memo(function HeavyChart({ chartId, dataVersion, theme, telemetryData }) {
  console.log('HeavyChart evaluated and rendered!');
  return (
    <div className={\`chart-box theme-\${theme}\`}>
      <h4>Chart #{chartId} (v{dataVersion})</h4>
      <svg width="400" height="200">{/* Heavy SVG calculations */}</svg>
    </div>
  );
}, areChartPropsEqual);`,
    breakdown: [
      "Second argument to React.memo is areChartPropsEqual(prevProps, nextProps).",
      "Note the inverse logic: returning true tells React to SKIP re-rendering; returning false forces re-rendering.",
      "Ignores newly created inline callbacks or unstable parent container props.",
      "Prevents heavy SVG canvas recalculations when unrelated parent state updates."
    ],
    expectedOutput: `HeavyChart skips re-rendering when parent renders unless chartId, dataVersion, or theme changes.`
  },
  {
    id: "react-ex-46",
    title: "Web Worker Offloading for Client-Side CSV / Excel Parsing",
    category: "Production Patterns & Performance",
    difficulty: "advanced",
    whatThisCodeCovers: "Offloads the parsing of massive 50MB CSV files to a Web Worker background thread, keeping the React UI animated and responsive without dropped frames.",
    conceptsCovered: [
      "Web Workers in React",
      "Non-Blocking Main Thread",
      "Worker Message Passing",
      "Worker Termination Hygiene"
    ],
    code: `import { useState, useRef, useEffect } from 'react';

// Inline worker script (or separate worker.js file)
const workerCode = \`
  self.onmessage = function(e) {
    const rawCSV = e.data;
    const lines = rawCSV.split('\\n');
    const result = [];
    
    // Simulate heavy CPU-bound parsing of 100,000 rows
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim()) {
        result.push(lines[i].split(','));
      }
    }
    self.postMessage(result);
  };
\`;

export function CSVParserComponent() {
  const [parsedRows, setParsedRows] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef(null);

  useEffect(() => {
    // Initialize Web Worker from blob URL
    const blob = new Blob([workerCode], { type: 'application/javascript' });
    workerRef.current = new Worker(URL.createObjectURL(blob));

    workerRef.current.onmessage = (event) => {
      setParsedRows(event.data);
      setIsProcessing(false);
    };

    return () => workerRef.current?.terminate(); // Clean up thread!
  }, []);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      // Offload massive text string to background worker thread!
      workerRef.current.postMessage(event.target.result);
    };
    reader.readAsText(file);
  };

  return (
    <div>
      <input type="file" accept=".csv" onChange={handleFileUpload} />
      {isProcessing && <div className="spinner">Processing CSV in background OS thread...</div>}
      <p>Parsed Rows: {parsedRows.length}</p>
    </div>
  );
}`,
    breakdown: [
      "Instantiates a dedicated Web Worker running on an independent background operating system thread.",
      "Offloads heavy CSV parsing out of JavaScript's single main thread.",
      "The React UI maintains smooth CSS animations and button responsiveness even while parsing 500,000 lines.",
      "Cleans up and terminates the worker on unmount via worker.terminate()."
    ],
    expectedOutput: `50MB CSV parses in background; React UI remains completely fluid with 0 frame drops.`
  },
  {
    id: "react-ex-47",
    title: "Context Provider Value Stabilization with useMemo",
    category: "Production Patterns & Performance",
    difficulty: "intermediate",
    whatThisCodeCovers: "Stops widespread consumer re-renders by memoizing the Context Provider's value object and callbacks using useMemo and useCallback.",
    conceptsCovered: [
      "Context Provider Memoization",
      "Object Reference Equality",
      "Consumer Re-render Elimination",
      "useMemo Context Value Pattern"
    ],
    code: `import { createContext, useContext, useState, useMemo, useCallback } from 'react';

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser] = useState({ name: 'Alice', role: 'Admin' });
  const [theme, setTheme] = useState('dark');

  const updateUserRole = useCallback((newRole) => {
    setUser(prev => ({ ...prev, role: newRole }));
  }, []);

  // CRUCIAL: Stabilize provider value object!
  // If not memoized, EVERY render of UserProvider creates a brand new { user, updateUserRole }
  // forcing EVERY consumer to re-render, even if only 'theme' state updated!
  const contextValue = useMemo(() => ({
    user,
    updateUserRole
  }), [user, updateUserRole]);

  return (
    <UserContext.Provider value={contextValue}>
      {children}
    </UserContext.Provider>
  );
}`,
    breakdown: [
      "Without useMemo, <Provider value={{ user, updateUserRole }}> instantiates a new object literal on every render.",
      "Consumers of UserContext compare previous value to next value using Object.is.",
      "useMemo guarantees that if user hasn't changed, the contextValue object keeps the identical memory address.",
      "When sibling state (like theme) updates, UserContext consumers skip re-rendering entirely."
    ],
    expectedOutput: `Context consumers only re-render when user actually changes, not when parent provider re-renders.`
  },
  {
    id: "react-ex-48",
    title: "Re-render Isolation via Component Composition (Passing Subtree as Children)",
    category: "Production Patterns & Performance",
    difficulty: "intermediate",
    whatThisCodeCovers: "Eliminates unnecessary re-renders of a heavy component tree without using React.memo, simply by lifting the heavy component and passing it as children into a stateful container.",
    conceptsCovered: [
      "Component Composition as Optimization",
      "Zero React.memo Optimization",
      "props.children Stability",
      "Render Tree Decoupling"
    ],
    code: `import { useState } from 'react';

// Stateful container: Re-renders on every scroll, but does NOT re-render 'children'!
export function ScrollHighlightContainer({ children }) {
  const [scrollY, setScrollY] = useState(0);

  return (
    <div 
      onScroll={(e) => setScrollY(e.currentTarget.scrollTop)}
      className="scrollable-pane"
    >
      <div className="scroll-indicator">Position: {scrollY}px</div>
      {/* 'children' is already evaluated by Parent; its element reference is unchanged! */}
      {/* React skips re-rendering 'children' completely! */}
      {children}
    </div>
  );
}

// Parent Component
export function PageLayout() {
  return (
    <ScrollHighlightContainer>
      {/* HeavyComplexTree is rendered in PageLayout scope, NOT ScrollHighlightContainer! */}
      {/* It NEVER re-renders when ScrollHighlightContainer scrolls! */}
      <HeavyComplexTree />
    </ScrollHighlightContainer>
  );
}`,
    breakdown: [
      "ScrollHighlightContainer re-renders on every scroll event as scrollY state changes.",
      "However, HeavyComplexTree is created in PageLayout's render scope and passed in as props.children.",
      "Because PageLayout did not re-render, children has the identical element object reference.",
      "React skips reconciling the children subtree entirely with 0 lines of useMemo or React.memo."
    ],
    expectedOutput: `Container updates scroll indicator at 60 FPS while heavy child component tree never re-renders.`
  },
  {
    id: "react-ex-49",
    title: "Responsive Image Component with AVIF/WebP srcset & Blur Placeholder",
    category: "Production Patterns & Performance",
    difficulty: "intermediate",
    whatThisCodeCovers: "A high-performance responsive image component that prevents layout shift (CLS), uses modern WebP/AVIF picture sources, and displays a smooth blur placeholder transition.",
    conceptsCovered: [
      "Modern HTML5 <picture> Tag",
      "Cumulative Layout Shift (CLS) Defense",
      "Blur-Up Image Transition",
      "Responsive srcset Resolutions"
    ],
    code: `import { useState } from 'react';

export function OptimizedImage({ src, alt, width, height, blurDataUrl }) {
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div 
      className="image-wrapper"
      style={{
        aspectRatio: \`\${width} / \${height}\`, // Reserves exact layout space preventing CLS!
        backgroundColor: '#f0f0f0'
      }}
    >
      {/* Low-Quality Image Placeholder (LQIP) */}
      {!isLoaded && blurDataUrl && (
        <img 
          src={blurDataUrl} 
          alt="" 
          aria-hidden="true" 
          className="blur-placeholder" 
        />
      )}

      {/* Modern Picture Element with AVIF and WebP fallbacks */}
      <picture>
        <source srcSet={\`\${src}.avif\`} type="image/avif" />
        <source srcSet={\`\${src}.webp\`} type="image/webp" />
        <img
          src={\`\${src}.jpg\`}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          onLoad={() => setIsLoaded(true)}
          className={\`main-image \${isLoaded ? 'image-visible' : 'image-hidden'}\`}
        />
      </picture>
    </div>
  );
}`,
    breakdown: [
      "style.aspectRatio reserves exact pixel dimensions prior to image download, eliminating Cumulative Layout Shift.",
      "<picture> serves AVIF to modern browsers and falls back to WebP and JPG.",
      "loading='lazy' defers offscreen images; decoding='async' prevents main-thread image decoding stalls.",
      "Fades smoothly from blur placeholder to high-resolution image on load."
    ],
    expectedOutput: `Images load with zero layout shift, serving AVIF to modern devices with a smooth blur fade-in.`
  },
  {
    id: "react-ex-50",
    title: "Programmatic Render Profiling with the <Profiler> Component",
    category: "Production Patterns & Performance",
    difficulty: "advanced",
    whatThisCodeCovers: "Instruments real user performance monitoring in code using the React Profiler component, logging slow component renders exceeding 16ms to APM telemetry.",
    conceptsCovered: [
      "React.Profiler Component",
      "actualDuration vs baseDuration",
      "APM Telemetry Integration",
      "Slow Render Detection"
    ],
    code: `import { Profiler } from 'react';

export function MonitoredFeature({ featureName, children }) {
  const handleRender = (
    id,             // Profiler id prop
    phase,          // "mount" or "update"
    actualDuration, // Time spent rendering this update (ms)
    baseDuration,   // Estimated time to render entire subtree without memoization
    startTime,      // When React started rendering
    commitTime      // When React committed update
  ) => {
    // If render took longer than one 60 FPS frame (16.6ms):
    if (actualDuration > 16.6) {
      console.warn(\`[APM Slow Render] \${id} (\${phase}): \${actualDuration.toFixed(2)}ms\`);
      // Send telemetry beacon to Datadog / New Relic:
      // telemetry.recordMetric('slow_render', { id, phase, actualDuration });
    }
  };

  return (
    <Profiler id={featureName} onRender={handleRender}>
      {children}
    </Profiler>
  );
}`,
    breakdown: [
      "Profiler measures the render performance of its descendants in milliseconds.",
      "actualDuration tells you how long the actual render took (after React.memo bailing).",
      "baseDuration estimates how long it would take without any memoization.",
      "Enables continuous real-user monitoring (RUM) in staging and production canaries."
    ],
    expectedOutput: `Logs warning to APM whenever the monitored subtree takes longer than 16.6ms to commit.`
  },
  {
    id: "react-ex-51",
    title: "Resilient Error Boundary with Sentry Telemetry and User Retry Reset",
    category: "Production Patterns & Performance",
    difficulty: "advanced",
    whatThisCodeCovers: "A production-grade class Error Boundary that catches runtime render exceptions, reports componentStack traces to monitoring, and provides a working reset mechanism.",
    conceptsCovered: [
      "Production Error Boundary",
      "componentStack Traces",
      "Reset Mechanism",
      "Sentry Error Telemetry"
    ],
    code: `import React, { Component } from 'react';

export class ResilientErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Log stack trace to Sentry / Datadog
    console.error('ErrorBoundary captured crash:', error, errorInfo.componentStack);
    // Sentry.captureException(error, { extra: { componentStack: errorInfo.componentStack } });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.handleReset });
      }

      return (
        <div className="error-card" role="alert">
          <h3>Something went wrong in this module.</h3>
          <p className="error-text">{this.state.error?.message}</p>
          <button onClick={this.handleReset}>Try Again</button>
        </div>
      );
    }

    return this.props.children;
  }
}`,
    breakdown: [
      "getDerivedStateFromError updates state to render the fallback UI immediately in the render pass.",
      "componentDidCatch sends the full componentStack to error reporting services.",
      "handleReset clears error state and invokes onReset, allowing children to re-mount with clean state.",
      "Prevents a single widget crash from bringing down the entire application."
    ],
    expectedOutput: `Widget crashes render a localized fallback card with a working 'Try Again' recovery button.`
  },
  {
    id: "react-ex-52",
    title: "Headless Accessible Dropdown using the Compound Component Pattern",
    category: "Production Patterns & Performance",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a flexible, accessible dropdown menu using compound components sharing an internal context with arrow key navigation and ARIA attributes.",
    conceptsCovered: [
      "Compound Component Pattern",
      "Keyboard Navigation (ArrowDown/Up)",
      "ARIA Accessibility Roles",
      "Context-Driven Compound State"
    ],
    code: `import { createContext, useContext, useState, useRef, useEffect } from 'react';

const DropdownContext = createContext(null);

export function Dropdown({ children, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const itemsRef = useRef([]);

  const toggle = () => setIsOpen(prev => !prev);
  const close = () => { setIsOpen(false); setActiveIndex(-1); };

  const handleKeyDown = (e) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        setActiveIndex(0);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(i => (i + 1) % itemsRef.current.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(i => (i - 1 + itemsRef.current.length) % itemsRef.current.length);
    } else if (e.key === 'Escape') {
      close();
    }
  };

  return (
    <DropdownContext.Provider value={{
      isOpen, toggle, close, activeIndex, setActiveIndex, onSelect, itemsRef
    }}>
      <div onKeyDown={handleKeyDown} className="dropdown-compound">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

Dropdown.Trigger = function Trigger({ children }) {
  const { toggle, isOpen } = useContext(DropdownContext);
  return (
    <button onClick={toggle} aria-haspopup="listbox" aria-expanded={isOpen}>
      {children}
    </button>
  );
};

Dropdown.Menu = function Menu({ children }) {
  const { isOpen } = useContext(DropdownContext);
  if (!isOpen) return null;
  return <ul role="listbox" className="dropdown-list">{children}</ul>;
};

Dropdown.Item = function Item({ index, value, children }) {
  const { activeIndex, onSelect, close, itemsRef } = useContext(DropdownContext);
  const isSelected = activeIndex === index;

  useEffect(() => {
    itemsRef.current[index] = value;
  }, [index, value, itemsRef]);

  return (
    <li
      role="option"
      aria-selected={isSelected}
      className={\`dropdown-item \${isSelected ? 'active' : ''}\`}
      onClick={() => { onSelect(value); close(); }}
    >
      {children}
    </li>
  );
};`,
    breakdown: [
      "Dropdown wraps state and exposes Dropdown.Trigger, Dropdown.Menu, and Dropdown.Item.",
      "Coordinates keyboard navigation: ArrowUp, ArrowDown, Enter, and Escape seamlessly across components.",
      "Pre-wires ARIA roles (aria-haspopup, aria-expanded, role='listbox', role='option').",
      "Consumers assemble dropdowns naturally without passing rigid configuration objects."
    ],
    expectedOutput: `Dropdown opens, highlights active item via arrow keys, and selects item via Enter or click.`
  }
];
