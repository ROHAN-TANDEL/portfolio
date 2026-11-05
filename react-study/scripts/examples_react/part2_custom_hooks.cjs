module.exports = [
  {
    id: "react-ex-12",
    title: "useDebounce Value Hook for High-Performance Search Input Filtering",
    category: "Advanced Custom Hooks",
    difficulty: "beginner",
    whatThisCodeCovers: "Builds a production-grade useDebounce hook that delays updating a debounced value until typing pauses for a configured delay in milliseconds.",
    conceptsCovered: [
      "Custom Hook Creation",
      "Timer Cleanup on Dep Change",
      "API Call Rate Limiting",
      "Search Input Optimization"
    ],
    code: `import { useState, useEffect } from 'react';

// Custom Hook: Delays value update until 'delay' ms after last change
export function useDebounce(value, delay = 300) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    // Schedule timer to update debounced state
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // Cancel timer if value changes before delay expires (user keeps typing!)
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// Usage in Live Search Component:
export function SearchInput({ onSearch }) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 400);

  useEffect(() => {
    if (debouncedQuery.trim()) {
      onSearch(debouncedQuery); // Fires only 400ms after user stops typing!
    }
  }, [debouncedQuery, onSearch]);

  return (
    <input 
      value={query} 
      onChange={e => setQuery(e.target.value)} 
      placeholder="Search catalog..." 
    />
  );
}`,
    breakdown: [
      "useDebounce maintains internal debouncedValue state updated via setTimeout.",
      "Returning clearTimeout(timer) in the effect cleanup cancels pending timers whenever value changes.",
      "Reduces 10 keystrokes down to a single network search request.",
      "Provides responsive local typing while protecting backend APIs from request floods."
    ],
    expectedOutput: `debouncedQuery updates only after 400ms of inactivity, triggering a single search query.`
  },
  {
    id: "react-ex-13",
    title: "useThrottle Callback Hook for Scroll & Resize Event Throttling",
    category: "Advanced Custom Hooks",
    difficulty: "intermediate",
    whatThisCodeCovers: "Throttles high-frequency function executions to run at most once per time interval, preserving browser framerate during scroll and window resize events.",
    conceptsCovered: [
      "Event Throttling",
      "useRef Timestamp Tracking",
      "useCallback Identity Stability",
      "Scroll Event Performance"
    ],
    code: `import { useRef, useCallback } from 'react';

export function useThrottle(callback, limit = 100) {
  const lastRunRef = useRef(0);
  const timeoutRef = useRef(null);

  return useCallback((...args) => {
    const now = Date.now();

    if (now - lastRunRef.current >= limit) {
      lastRunRef.current = now;
      callback(...args);
    } else {
      // Schedule trailing call if invoked during cooldown
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        lastRunRef.current = Date.now();
        callback(...args);
      }, limit - (now - lastRunRef.current));
    }
  }, [callback, limit]);
}

// Usage in Scroll Tracker:
export function ScrollProgress() {
  const handleScroll = useThrottle(() => {
    const scrolled = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    console.log('Throttled scroll %:', scrolled.toFixed(1));
  }, 100);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return <div className="scroll-bar" />;
}`,
    breakdown: [
      "lastRunRef stores the timestamp of the last executed call across renders without triggering re-renders.",
      "If more than limit ms have elapsed, callback executes immediately.",
      "Guarantees that high-frequency 60 FPS scroll events execute at most 10 times per second.",
      "Includes a trailing edge timeout to guarantee the final scroll position is recorded."
    ],
    expectedOutput: `Scroll callback fires at most once every 100ms, preserving 60 FPS UI responsiveness.`
  },
  {
    id: "react-ex-14",
    title: "useLocalStorage with Multi-Tab Storage Event Synchronization",
    category: "Advanced Custom Hooks",
    difficulty: "intermediate",
    whatThisCodeCovers: "Persists state to browser localStorage with SSR safety, error handling for quota limits, and cross-tab synchronization using the native storage event.",
    conceptsCovered: [
      "localStorage Sync",
      "Window storage Event",
      "SSR Lazy Initialization",
      "QuotaExceededError Handling"
    ],
    code: `import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage(key, initialValue) {
  // 1. Safe SSR initialization
  const [storedValue, setStoredValue] = useState(() => {
    if (typeof window === 'undefined') return initialValue;
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.warn(\`Error reading localStorage key "\${key}":\`, error);
      return initialValue;
    }
  });

  // 2. Wrapped setter that writes to localStorage
  const setValue = useCallback((value) => {
    try {
      setStoredValue(prev => {
        const valueToStore = value instanceof Function ? value(prev) : value;
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(key, JSON.stringify(valueToStore));
        }
        return valueToStore;
      });
    } catch (error) {
      console.warn(\`Error setting localStorage key "\${key}":\`, error);
    }
  }, [key]);

  // 3. Listen for changes in OTHER browser tabs
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === key && e.newValue !== null) {
        setStoredValue(JSON.parse(e.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key]);

  return [storedValue, setValue];
}`,
    breakdown: [
      "Initializes state via lazy initializer with typeof window checks for Next.js / SSR compatibility.",
      "Supports functional state updates: setValue(prev => prev + 1).",
      "Listens to window.addEventListener('storage', ...) to synchronize state across multiple open tabs.",
      "Wraps all reads and writes in try/catch to gracefully handle disabled cookies or quota limits."
    ],
    expectedOutput: `Changes made in Tab A update localStorage and reflect instantaneously in Tab B without reload.`
  },
  {
    id: "react-ex-15",
    title: "useMediaQuery Hook for Responsive JavaScript Design Breakpoints",
    category: "Advanced Custom Hooks",
    difficulty: "intermediate",
    whatThisCodeCovers: "Tracks CSS media query matches in JavaScript using window.matchMedia and the change event, enabling dynamic conditional rendering based on viewport size.",
    conceptsCovered: [
      "window.matchMedia API",
      "Responsive JS Breakpoints",
      "MediaQueryList Listener",
      "SSR Fallback Handling"
    ],
    code: `import { useState, useEffect } from 'react';

export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQueryList = window.matchMedia(query);
    const listener = (event) => setMatches(event.matches);

    // Initial check and modern addEventListener on media query list
    setMatches(mediaQueryList.matches);
    mediaQueryList.addEventListener('change', listener);

    return () => mediaQueryList.removeEventListener('change', listener);
  }, [query]);

  return matches;
}

// Usage in responsive navigation layout:
export function ResponsiveNav() {
  const isMobile = useMediaQuery('(max-width: 768px)');
  const isDarkMode = useMediaQuery('(prefers-color-scheme: dark)');

  return (
    <nav className={isDarkMode ? 'dark-theme' : 'light-theme'}>
      {isMobile ? <MobileDrawer /> : <DesktopNavbar />}
    </nav>
  );
}`,
    breakdown: [
      "Uses modern window.matchMedia(query) and MediaQueryList 'change' event listener.",
      "Returns a reactive boolean updating automatically when the user resizes browser windows.",
      "Supports arbitrary media queries: screen widths, orientation, and prefers-color-scheme dark mode.",
      "Cleans up listeners on unmount or query change."
    ],
    expectedOutput: `isMobile switches between true and false as viewport passes the 768px threshold.`
  },
  {
    id: "react-ex-16",
    title: "useFetch with AbortController, Retry Counter & Cache Map",
    category: "Advanced Custom Hooks",
    difficulty: "advanced",
    whatThisCodeCovers: "A complete data-fetching hook supporting in-memory response caching, automatic request abortion on unmount, and a manual refetch retry mechanism.",
    conceptsCovered: [
      "AbortController Integration",
      "In-Memory Cache Map",
      "Retry / Refetch Trigger",
      "Async Lifecycle States"
    ],
    code: `import { useState, useEffect, useRef, useCallback } from 'react';

// Module-level in-memory cache
const cache = new Map();

export function useFetch(url, options = {}) {
  const [data, setData] = useState(() => cache.get(url) || null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(!cache.has(url));
  const [refetchIndex, setRefetchIndex] = useState(0);

  const refetch = useCallback(() => {
    cache.delete(url); // Invalidate cache for manual refresh
    setRefetchIndex(i => i + 1);
  }, [url]);

  useEffect(() => {
    if (!url) return;

    const controller = new AbortController();

    async function executeFetch() {
      // Check cache first
      if (cache.has(url)) {
        setData(cache.get(url));
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal
        });

        if (!response.ok) throw new Error(\`HTTP Error: \${response.status}\`);

        const result = await response.json();
        cache.set(url, result);
        setData(result);
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError(err.message);
        }
      } finally {
        setIsLoading(false);
      }
    }

    executeFetch();

    return () => controller.abort(); // Cancel request if URL changes or unmounts!
  }, [url, refetchIndex]);

  return { data, error, isLoading, refetch };
}`,
    breakdown: [
      "Module-level Map provides instant cache hits across multiple components requesting identical URLs.",
      "AbortController automatically aborts in-flight network requests when components unmount.",
      "Filters out AbortError so cancellation isn't treated as an application error.",
      "Exposes refetch() method that invalidates cache and triggers re-execution."
    ],
    expectedOutput: `Fetches data asynchronously, caches result, and cancels stale requests on unmount.`
  },
  {
    id: "react-ex-17",
    title: "usePrevious Hook Using Ref Stash for Value Delta Comparisons",
    category: "Advanced Custom Hooks",
    difficulty: "beginner",
    whatThisCodeCovers: "Implements the classic usePrevious hook that tracks the value of a prop or state variable from the immediately preceding render pass.",
    conceptsCovered: [
      "usePrevious Pattern",
      "Ref Stash Execution Order",
      "Render vs Effect Timing",
      "Delta Change Detection"
    ],
    code: `import { useRef, useEffect } from 'react';

// Returns the value from the PREVIOUS render
export function usePrevious(value) {
  const ref = useRef();

  // useEffect runs AFTER the render is committed to DOM
  useEffect(() => {
    ref.current = value; // Stash current value for NEXT render
  }, [value]);

  // Return value held before this render's effect executed!
  return ref.current;
}

// Usage in Price Tracker:
export function PriceTicker({ currentPrice }) {
  const prevPrice = usePrevious(currentPrice);

  const priceDelta = prevPrice !== undefined ? currentPrice - prevPrice : 0;
  const isUp = priceDelta > 0;

  return (
    <div>
      <h2>\${currentPrice}</h2>
      {prevPrice !== undefined && (
        <span style={{ color: isUp ? 'green' : 'red' }}>
          {isUp ? '▲' : '▼'} \${Math.abs(priceDelta).toFixed(2)} (Previous: \${prevPrice})
        </span>
      )}
    </div>
  );
}`,
    breakdown: [
      "ref.current stores the value from the preceding render.",
      "The component returns ref.current during render (which holds the old value).",
      "useEffect runs AFTER paint, updating ref.current to the new value ready for the subsequent render.",
      "Allows tracking deltas, previous routes, or previous focus elements without triggering extra re-renders."
    ],
    expectedOutput: `Displays current price alongside calculated delta from the previous render value.`
  },
  {
    id: "react-ex-18",
    title: "useInterval Hook with Dynamic Delay and Stable Callback Execution",
    category: "Advanced Custom Hooks",
    difficulty: "intermediate",
    whatThisCodeCovers: "Dan Abramov's canonical useInterval declarative hook that prevents stale closure bugs and supports dynamic delay updates or pausing.",
    conceptsCovered: [
      "Declarative setInterval",
      "Latest Ref Callback Pattern",
      "Dynamic Timer Pausing",
      "Stale Closure Elimination"
    ],
    code: `import { useRef, useEffect } from 'react';

export function useInterval(callback, delay) {
  const savedCallback = useRef(callback);

  // Remember latest callback without resetting the timer
  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval
  useEffect(() => {
    // If delay is null, timer is paused
    if (delay === null || delay === undefined) return;

    const tick = () => savedCallback.current();
    const id = setInterval(tick, delay);

    return () => clearInterval(id);
  }, [delay]);
}

// Usage: Counter with dynamic speed & pause toggle
export function DynamicTimer() {
  const [count, setCount] = useState(0);
  const [delay, setDelay] = useState(1000);
  const [isRunning, setIsRunning] = useState(true);

  // Reads fresh 'count' without resetting the 1000ms timer!
  useInterval(() => {
    setCount(c => c + 1);
  }, isRunning ? delay : null);

  return (
    <div>
      <h1>Ticks: {count}</h1>
      <button onClick={() => setIsRunning(!isRunning)}>{isRunning ? 'Pause' : 'Resume'}</button>
      <button onClick={() => setDelay(200)}>Speed Up (200ms)</button>
    </div>
  );
}`,
    breakdown: [
      "savedCallback ref mirrors the latest callback reference on every render.",
      "The timer effect depends only on [delay], meaning changes to state inside callback do NOT reset the timer interval.",
      "Passing delay = null cleanly pauses the timer by clearing the interval.",
      "Completely eliminates the classic React setInterval stale closure bug."
    ],
    expectedOutput: `Timer increments accurately and allows changing speed dynamically without losing interval alignment.`
  },
  {
    id: "react-ex-19",
    title: "useOnClickOutside Hook for Reusable Modal & Menu Dismissal",
    category: "Advanced Custom Hooks",
    difficulty: "beginner",
    whatThisCodeCovers: "Extracts outside click detection into a reusable hook that attaches mouse and touch listeners to dismiss flyout panels and popovers.",
    conceptsCovered: [
      "Custom Hook Abstraction",
      "Touch & Mouse Event Support",
      "Ref Node Containment",
      "Listener Hygiene"
    ],
    code: `import { useEffect } from 'react';

export function useOnClickOutside(ref, handler) {
  useEffect(() => {
    const listener = (event) => {
      // Do nothing if clicking ref's element or descendant elements
      if (!ref.current || ref.current.contains(event.target)) {
        return;
      }
      handler(event);
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);
}

// Clean usage in Popover:
export function Popover({ onClose, children }) {
  const popoverRef = useRef(null);
  useOnClickOutside(popoverRef, onClose);

  return <div ref={popoverRef} className="popover-box">{children}</div>;
}`,
    breakdown: [
      "Listens to both 'mousedown' and 'touchstart' to ensure compatibility with mobile devices.",
      "Checks ref.current.contains(event.target) to confirm the click was outside.",
      "Passes event to handler callback, allowing caller to inspect target or prevent default.",
      "Encapsulates 20 lines of repetitive DOM event boilerplate into a 1-line hook call."
    ],
    expectedOutput: `Invokes onClose callback whenever user clicks or taps outside the referenced popover.`
  },
  {
    id: "react-ex-20",
    title: "useEventListener Hook with Automatic Window and Document Cleanup",
    category: "Advanced Custom Hooks",
    difficulty: "intermediate",
    whatThisCodeCovers: "A type-safe useEventListener hook supporting window, document, or specific element targets with automatic listener teardown.",
    conceptsCovered: [
      "Universal Event Listener Hook",
      "Target Node Flexibility",
      "Latest Callback Mirroring",
      "Passive Listener Options"
    ],
    code: `import { useRef, useEffect } from 'react';

export function useEventListener(eventName, handler, element = null, options = {}) {
  const savedHandler = useRef(handler);

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    // Default to window if element is not provided
    const targetElement = element?.current || element || (typeof window !== 'undefined' ? window : null);
    if (!targetElement?.addEventListener) return;

    const eventListener = (event) => savedHandler.current(event);

    targetElement.addEventListener(eventName, eventListener, options);
    return () => targetElement.removeEventListener(eventName, eventListener, options);
  }, [eventName, element, options]);
}

// Usage: Global Keyboard Shortcut
export function QuickSearchModal({ isOpen, onClose }) {
  // Listen for Ctrl+K / Cmd+K anywhere on page
  useEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      onClose(); // Toggle modal
    }
  });

  return isOpen ? <div className="search-palette">Palette...</div> : null;
}`,
    breakdown: [
      "savedHandler ref ensures changing handler functions does not cause remove/re-add churn of event listeners.",
      "Accepts window, document, or React ref object as the target element.",
      "Supports passive event listener configuration options for smooth scrolling.",
      "Simplifies global keyboard shortcut management."
    ],
    expectedOutput: `Cmd+K or Ctrl+K triggers quick search toggle globally with zero memory leaks.`
  },
  {
    id: "react-ex-21",
    title: "useNetworkStatus Hook with Online and Offline Browser Listeners",
    category: "Advanced Custom Hooks",
    difficulty: "beginner",
    whatThisCodeCovers: "Tracks real-time device internet connectivity and warns users with an offline banner when network drops.",
    conceptsCovered: [
      "navigator.onLine API",
      "online / offline Window Events",
      "SSR Fallback State",
      "Network Reconnection Banners"
    ],
    code: `import { useState, useEffect } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() => 
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

// Usage in App:
export function OfflineNotification() {
  const isOnline = useNetworkStatus();

  if (isOnline) return null;

  return (
    <div className="offline-banner" role="alert">
      ⚠️ You are currently offline. Changes will sync when connection returns.
    </div>
  );
}`,
    breakdown: [
      "Initializes with navigator.onLine with safe SSR check.",
      "Subscribes to native window 'online' and 'offline' browser events.",
      "Returns a boolean flag that UI components can use for reconnection banners or disabling submit buttons.",
      "Cleans up listeners automatically on component unmount."
    ],
    expectedOutput: `Offline banner appears immediately when internet drops and vanishes when restored.`
  },
  {
    id: "react-ex-22",
    title: "useWhyDidYouUpdate Diagnostic Hook for Component Render Profiling",
    category: "Advanced Custom Hooks",
    difficulty: "advanced",
    whatThisCodeCovers: "A diagnostic hook that compares previous and current props, logging the exact keys and reference changes that caused a component to re-render in the console.",
    conceptsCovered: [
      "Development Profiling Hook",
      "Shallow Prop Diffing",
      "Console Table Logging",
      "Unnecessary Re-render Debugging"
    ],
    code: `import { useRef, useEffect } from 'react';

export function useWhyDidYouUpdate(name, props) {
  const previousProps = useRef();

  useEffect(() => {
    if (previousProps.current) {
      // Gather all keys from previous and current props
      const allKeys = Object.keys({ ...previousProps.current, ...props });
      const changesObj = {};

      allKeys.forEach((key) => {
        if (previousProps.current[key] !== props[key]) {
          changesObj[key] = {
            from: previousProps.current[key],
            to: props[key],
            isEqualShallow: Object.is(previousProps.current[key], props[key])
          };
        }
      });

      if (Object.keys(changesObj).length > 0) {
        console.group(\`[WhyDidYouUpdate] \${name}\`);
        console.table(changesObj);
        console.groupEnd();
      }
    }

    previousProps.current = props;
  });
}

// Usage inside an unexpectedly re-rendering component:
export function DataGrid(props) {
  useWhyDidYouUpdate('DataGrid', props);
  return <table>{/* grid rows */}</table>;
}`,
    breakdown: [
      "previousProps ref stores the props object from the previous render.",
      "Compares previousProps.current and current props key by key using reference inequality (!==).",
      "Logs formatted console.table showing exactly which prop changed from what reference to what reference.",
      "Instantly identifies unstable callbacks or inline object props breaking React.memo."
    ],
    expectedOutput: `Console table prints: [WhyDidYouUpdate] DataGrid: onFilter changed from Function to Function.`
  }
];
