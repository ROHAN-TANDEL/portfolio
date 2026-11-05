const { createCard } = require("../js_builder_helper.cjs");

const cards = [];

cards.push(createCard({
  idNum: 125,
  category: "Web APIs & Browser Concurrency",
  concept: "DOM Event Flow: Capturing, Target, and Bubbling",
  priority: "must-know",
  difficulty: "beginner",
  question: "What are the three phases of DOM Event Propagation, and how does addEventListener control them?",
  answer: "The three phases in order are: 1) **Capturing Phase** (the event travels down from `window` through ancestors to the target element), 2) **Target Phase** (the event reaches the clicked element), 3) **Bubbling Phase** (the event bubbles up from the target back through ancestors to `window`). By default, `addEventListener(type, handler)` listens in the Bubbling phase; passing `{ capture: true }` makes it listen in the Capturing phase.",
  explanation: "Most UI event handling happens during the Bubbling phase. However, security interceptors, modal focus traps, or analytics trackers often attach capture listeners (`{ capture: true }`) to intercept events before child handlers have a chance to call `event.stopPropagation()`.",
  code: `const parent = document.getElementById("parent");
const child = document.getElementById("child");

// Capture phase listener (runs FIRST on click)
parent.addEventListener("click", () => {
  console.log("1: Parent Captured (going down)");
}, { capture: true });

// Target listener
child.addEventListener("click", () => {
  console.log("2: Child Clicked (Target Phase)");
});

// Bubbling phase listener (runs LAST)
parent.addEventListener("click", () => {
  console.log("3: Parent Bubbled (going up)");
}, { capture: false });

// Clicking child logs:
// 1: Parent Captured (going down)
// 2: Child Clicked (Target Phase)
// 3: Parent Bubbled (going up)`,
  recallHint: "Event phases: Window -> Target (Capture). Target (Target Phase). Target -> Window (Bubble).",
  interviewTip: "Highlight that almost all standard DOM events bubble, but notable exceptions like `focus`, `blur`, `mouseenter`, and `mouseleave` do NOT bubble.",
  tags: ["dom", "event-propagation", "capturing", "bubbling"]
}));

cards.push(createCard({
  idNum: 126,
  category: "Web APIs & Browser Concurrency",
  concept: "The Event Delegation Pattern",
  priority: "must-know",
  difficulty: "beginner",
  question: "What is the Event Delegation pattern, and why is it superior for dynamic lists and tables?",
  answer: "Event Delegation is a pattern where a single event listener is attached to a common parent element rather than attaching individual listeners to hundreds of child elements. Because events bubble up the DOM, the parent can inspect `e.target` to identify which child was clicked.",
  explanation: "Benefits: 1) **Massive memory savings**: 1 listener for 10,000 table rows instead of 10,000 separate closures. 2) **Dynamic items support**: New items added to the list in the future automatically work without needing new event listeners attached.",
  code: `// Container with 10,000 list items:
const list = document.getElementById("todo-list");

// Single delegated listener on parent:
list.addEventListener("click", (e) => {
  // Use closest() to find matching button even if user clicks inner icon/span
  const deleteBtn = e.target.closest(".delete-btn");
  if (!deleteBtn) return; // Clicked somewhere else in list

  const itemId = deleteBtn.dataset.id;
  console.log("Deleting item ID:", itemId);
  deleteBtn.closest("li").remove();
});`,
  recallHint: "Event Delegation: 1 listener on parent. Uses event bubbling + e.target.closest() to identify child.",
  interviewTip: "Always recommend using `e.target.closest(selector)` rather than `e.target.matches(selector)`. If the button contains an SVG or span, `e.target` will be the SVG, but `closest('button')` will correctly find the button.",
  tags: ["event-delegation", "performance", "dom", "closest"]
}));

cards.push(createCard({
  idNum: 127,
  category: "Web APIs & Browser Concurrency",
  concept: "stopPropagation vs stopImmediatePropagation vs preventDefault",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What are the exact differences between event.stopPropagation(), event.stopImmediatePropagation(), and event.preventDefault()?",
  answer: "1) `event.preventDefault()`: Prevents the browser's default action (e.g. form submission, link navigation, checkbox toggling), but event propagation CONTINUES normally. 2) `event.stopPropagation()`: Stops the event from bubbling up to parent ancestors, but sibling listeners on the CURRENT element still execute. 3) `event.stopImmediatePropagation()`: Stops bubbling to parent ancestors AND prevents ANY other sibling listeners attached to the current element from executing.",
  explanation: "Calling `preventDefault()` does NOT stop bubbling. Calling `stopPropagation()` does NOT prevent default browser behaviors. `stopImmediatePropagation()` is essential when multiple plugins attach listeners to the same button and one wants to abort all subsequent handlers.",
  code: `const btn = document.getElementById("submit-btn");

btn.addEventListener("click", (e) => {
  e.preventDefault(); // Prevents default form submit POST reload
  e.stopImmediatePropagation(); // Stops sibling handler below from running!
  console.log("Handler 1 executed");
});

btn.addEventListener("click", () => {
  console.log("Handler 2 executed"); // WILL NOT RUN due to stopImmediatePropagation!
});

document.body.addEventListener("click", () => {
  console.log("Body bubbled"); // WILL NOT RUN due to propagation stop
});`,
  recallHint: "preventDefault = cancels browser action. stopPropagation = stops parents. stopImmediatePropagation = stops parents + siblings.",
  interviewTip: "Distinguishing `stopPropagation` from `stopImmediatePropagation` is an interview classic. Emphasize sibling listener prevention.",
  tags: ["stoppropagation", "stopimmediatepropagation", "preventdefault", "dom"]
}));

cards.push(createCard({
  idNum: 128,
  category: "Web APIs & Browser Concurrency",
  concept: "Passive Event Listeners ({ passive: true })",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What are Passive Event Listeners ({ passive: true }) and why are they critical for mobile scrolling performance?",
  answer: "By default, when a user scrolls (`touchstart`, `wheel`), the browser must pause scrolling and wait for the JavaScript event handler to finish executing to see if it calls `event.preventDefault()`. Specifying `{ passive: true }` promises the browser that the handler will NEVER call `preventDefault()`, allowing the browser's compositor thread to scroll immediately at 60–120fps on a background thread without waiting for the main JS thread.",
  explanation: "If you call `event.preventDefault()` inside a passive listener, the browser ignores it and outputs a console warning. Modern browsers treat `touchstart` and `touchmove` as passive by default on window/document.",
  code: `// High-performance scroll listener on mobile:
window.addEventListener("scroll", (e) => {
  trackScrollPosition(window.scrollY);
}, { passive: true }); // Enables instant compositor thread scrolling!

// Attempting preventDefault inside passive throws warning:
window.addEventListener("touchmove", (e) => {
  // e.preventDefault(); // Ignored with warning: Unable to preventDefault inside passive event listener
}, { passive: true });`,
  recallHint: "{ passive: true }: Promises no preventDefault(). Enables smooth 60fps compositor scrolling.",
  interviewTip: "Mention that Chrome's Lighthouse audit explicitly flags touch and wheel listeners that lack `{ passive: true }` because of their direct impact on Core Web Vitals (INP - Interaction to Next Paint).",
  tags: ["passive-listeners", "scrolling", "performance", "core-web-vitals"]
}));

cards.push(createCard({
  idNum: 129,
  category: "Web APIs & Browser Concurrency",
  concept: "Browser Rendering Pipeline: Layout (Reflow) vs Repaint",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What is the difference between Layout (Reflow) and Repaint in the browser rendering pipeline, and what causes Layout Thrashing?",
  answer: "1) **Layout (Reflow)**: The browser calculates the exact geometry, position, and dimensions of every visible element ($O(N)$ tree calculation). 2) **Repaint**: The browser paints pixels onto layers (colors, borders, shadows, backgrounds) without altering geometry. 3) **Layout Thrashing**: Rapidly alternating between writing to the DOM and reading layout properties (`offsetHeight`, `clientWidth`) in a loop, forcing the browser to perform synchronous reflows multiple times in a single frame.",
  explanation: "Reading a layout property (`offsetWidth`, `scrollTop`, `getBoundingClientRect()`) forces the browser to flush all pending DOM mutations immediately to compute the latest geometry. Alternating `write -> read -> write -> read` forces the CPU to recalculate layout repeatedly, dropping frame rates from 60fps to 5fps.",
  code: `// Layout Thrashing Anti-Pattern:
const boxes = document.querySelectorAll(".box");
for (const box of boxes) {
  // BAD: Read followed by write in a loop!
  const width = box.offsetWidth; // FORCES SYNCHRONOUS REFLOW!
  box.style.width = (width + 10) + "px"; // Invalidates layout!
}

// Optimized Batching Pattern:
// Step 1: Batch all reads first
const widths = Array.from(boxes, b => b.offsetWidth);

// Step 2: Batch all writes in requestAnimationFrame
requestAnimationFrame(() => {
  boxes.forEach((box, i) => {
    box.style.width = (widths[i] + 10) + "px";
  });
});`,
  recallHint: "Reflow = geometry/positions. Repaint = visual pixels. Layout Thrashing = alternating read/write in loop.",
  interviewTip: "Explain using `transform` and `opacity` for animations because they are handled by the GPU compositor layer, skipping both Reflow and Repaint entirely.",
  tags: ["reflow", "repaint", "layout-thrashing", "rendering-pipeline"]
}));

cards.push(createCard({
  idNum: 130,
  category: "Web APIs & Browser Concurrency",
  concept: "requestAnimationFrame() for 60fps Animations",
  priority: "must-know",
  difficulty: "intermediate",
  question: "Why is requestAnimationFrame() superior to setTimeout or setInterval for DOM animations?",
  answer: "`requestAnimationFrame(callback)` synchronizes execution with the browser's hardware display refresh rate (typically 60Hz or 120Hz), executing just before the next paint cycle. Unlike `setTimeout`, it automatically pauses when the browser tab is hidden in the background (saving battery and CPU), eliminates screen tearing, and automatically passes a high-resolution timestamp.",
  explanation: "`setTimeout(fn, 16.6)` is decoupled from the monitor's vertical blanking interval (V-Sync). If the timer fires halfway through a display refresh, half of the old frame and half of the new frame render simultaneously (screen tearing). `rAF` guarantees alignment with V-Sync.",
  code: `function animateElement(element, targetX, duration) {
  const startX = 0;
  let startTime = null;

  function step(currentTime) {
    if (!startTime) startTime = currentTime;
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing: ease-out
    const currentX = startX + (targetX - startX) * (1 - Math.pow(1 - progress, 3));
    element.style.transform = \`translateX(\${currentX}px)\`;

    if (progress < 1) {
      requestAnimationFrame(step); // Schedule next frame
    }
  }

  requestAnimationFrame(step);
}`,
  recallHint: "requestAnimationFrame: aligns with display refresh rate (V-Sync), pauses when tab is hidden, no tearing.",
  interviewTip: "Highlight that `rAF` callbacks receive a high-resolution timestamp (`DOMHighResTimeStamp` from `performance.now()`), allowing accurate time-based delta physics animations.",
  tags: ["requestanimationframe", "animations", "60fps", "vsync"]
}));

cards.push(createCard({
  idNum: 131,
  category: "Web APIs & Browser Concurrency",
  concept: "IntersectionObserver for Lazy Loading & Infinite Scroll",
  priority: "must-know",
  difficulty: "intermediate",
  question: "How does the IntersectionObserver API replace scroll event listeners for lazy loading and visibility tracking?",
  answer: "`IntersectionObserver` asynchronously observes changes in the intersection of a target element with an ancestor element or the viewport. Instead of listening to expensive scroll events on the main thread and calling `getBoundingClientRect()`, the browser tracks intersection calculations off the main thread and invokes the callback only when visibility thresholds (e.g. 0%, 50%, 100%) are crossed.",
  explanation: "Key options: `root` (viewport or scrolling container), `rootMargin` (pre-fetching buffer, e.g. `'200px'` to start loading images before they scroll into view), and `threshold` (array of percentage visibility triggers).",
  code: `// Lazy loading images with IntersectionObserver
const imageObserver = new IntersectionObserver((entries, observer) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      const img = entry.target;
      img.src = img.dataset.src; // Swap placeholder with real image
      img.classList.remove("lazy");
      observer.unobserve(img); // Stop observing once loaded!
    }
  });
}, {
  rootMargin: "200px 0px" // Pre-fetch 200px before appearing on screen!
});

document.querySelectorAll("img.lazy").forEach(img => imageObserver.observe(img));`,
  recallHint: "IntersectionObserver: off-main-thread visibility detection. Replaces scroll listeners for lazy loading.",
  interviewTip: "Always mention `observer.unobserve(entry.target)` once an image is loaded to free resources and stop tracking unnecessary elements.",
  tags: ["intersection-observer", "lazy-loading", "performance", "web-apis"]
}));

cards.push(createCard({
  idNum: 132,
  category: "Web APIs & Browser Concurrency",
  concept: "ResizeObserver and MutationObserver",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "What are the roles of ResizeObserver and MutationObserver?",
  answer: "`ResizeObserver` detects dimension changes (content box, border box) of individual DOM elements, enabling component-level responsive styling without window resize listeners. `MutationObserver` monitors changes to the DOM tree structure (child element additions/removals, attribute mutations, text content changes), replacing legacy slow DOM mutation events.",
  explanation: "Both observers deliver batches of changes asynchronously in microtasks. `ResizeObserver` is fundamental for building responsive component widgets (e.g. charts re-rendering when their parent container shrinks, regardless of window size).",
  code: `// 1. ResizeObserver: Element-level responsiveness
const chartContainer = document.getElementById("chart");
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect;
    console.log(\`Container resized to: \${width}x\${height}\`);
    redrawChart(width, height);
  }
});
resizeObserver.observe(chartContainer);

// 2. MutationObserver: Track DOM tree changes
const mutationObserver = new MutationObserver((mutations) => {
  mutations.forEach(m => console.log("DOM mutated:", m.type));
});
mutationObserver.observe(document.body, { childList: true, subtree: true });`,
  recallHint: "ResizeObserver = container dimension changes. MutationObserver = DOM tree/attribute mutations.",
  interviewTip: "Explain why ResizeObserver enables 'Container Queries' in UI architecture—sizing based on component parent width rather than window viewport width.",
  tags: ["resize-observer", "mutation-observer", "responsive", "dom-monitoring"]
}));

cards.push(createCard({
  idNum: 133,
  category: "Web APIs & Browser Concurrency",
  concept: "Web Workers & Dedicated Threads",
  priority: "must-know",
  difficulty: "intermediate",
  question: "What are Web Workers, how do they communicate with the main thread, and what are their limitations?",
  answer: "Web Workers allow running JavaScript scripts in background OS threads, completely isolated from the main UI thread. They communicate with the main thread using an asynchronous messaging pipeline (`postMessage()` and `onmessage`). Limitations: Workers have **NO access to the DOM**, `window`, `document`, or parent page variables. They can, however, use `fetch`, `WebSocket`, `IndexedDB`, and timers.",
  explanation: "Because Web Workers run on separate OS threads, heavy CPU computation (image processing, crypto, large JSON parsing, physics calculations) does not block the UI thread, ensuring animations and input handling stay responsive at 60fps.",
  code: `// --- main.js ---
const worker = new Worker("worker.js");

// Send heavy data to worker thread
worker.postMessage({ array: [1000, 2000, 3000] });

// Receive calculated result
worker.onmessage = (e) => {
  console.log("Calculated by worker:", e.data.total);
};

// --- worker.js (runs in background OS thread) ---
self.onmessage = (e) => {
  const { array } = e.data;
  // Heavy CPU work without blocking main UI!
  const total = array.reduce((acc, n) => acc + n, 0);
  self.postMessage({ total });
};`,
  recallHint: "Web Workers: real multi-threading in background OS thread. No DOM access. postMessage/onmessage pipeline.",
  interviewTip: "Clarify that data passed via `postMessage` is copied via the Structured Clone Algorithm by default, not shared by pointer (unless using Transferable objects).",
  tags: ["web-workers", "multi-threading", "concurrency", "postmessage"]
}));

cards.push(createCard({
  idNum: 134,
  category: "Web APIs & Browser Concurrency",
  concept: "Zero-Copy Data Transfer with Transferable Objects",
  priority: "advanced",
  difficulty: "advanced",
  question: "How do Transferable Objects enable zero-copy data transfer between the main thread and Web Workers?",
  answer: "Normally, `postMessage(data)` clones data using the Structured Clone Algorithm, duplicating memory. **Transferable Objects** (e.g. `ArrayBuffer`, `ImageBitmap`, `OffscreenCanvas`) transfer ownership of the underlying binary memory buffer directly to the recipient thread with zero memory copying ($O(1)$ transfer time). Once transferred, the buffer becomes permanently detached and neutered (length = 0) on the sender thread.",
  explanation: "If you have a 500MB ArrayBuffer (e.g. video processing), structured cloning allocates another 500MB on the worker and takes 100ms+ copying bytes. Transferring passes the raw C++ memory pointer instantly: `worker.postMessage(buffer, [buffer])`.",
  code: `// Allocate 64MB buffer
const buffer = new ArrayBuffer(64 * 1024 * 1024);
console.log("Before transfer, byteLength:", buffer.byteLength); // 67108864

// Send with transfer list (2nd argument)
worker.postMessage({ data: buffer }, [buffer]);

// Buffer is now neutered on main thread:
console.log("After transfer, byteLength:", buffer.byteLength); // 0!
// Any attempt to read/write throws an error because memory was handed over!`,
  recallHint: "Transferable Objects: zero-copy pointer transfer. Sender buffer becomes neutered (byteLength = 0).",
  interviewTip: "Always mention passing the buffer in the second parameter transfer array: `postMessage(payload, [payload.buffer])`.",
  tags: ["transferable-objects", "arraybuffer", "web-workers", "zero-copy", "performance"]
}));

cards.push(createCard({
  idNum: 135,
  category: "Web APIs & Browser Concurrency",
  concept: "SharedArrayBuffer & Atomics (Shared Memory)",
  priority: "advanced",
  difficulty: "advanced",
  question: "How do SharedArrayBuffer and Atomics enable true shared-memory concurrency across threads in JavaScript?",
  answer: "`SharedArrayBuffer` creates a raw binary memory segment that can be shared simultaneously across multiple Web Workers and the main thread without copying. Because concurrent read/write causes race conditions, the **Atomics** API provides thread-safe synchronization primitives (atomic read, write, add, compare-and-swap, `Atomics.wait()`, and `Atomics.notify()`).",
  explanation: "Due to Spectre and Meltdown speculative execution CPU vulnerabilities, `SharedArrayBuffer` requires Cross-Origin Isolation headers on the server: `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.",
  code: `// 1. Allocate shared memory (1024 bytes)
const sharedBuffer = new SharedArrayBuffer(1024);
const sharedArray = new Int32Array(sharedBuffer);

// Pass sharedBuffer reference to Worker
worker.postMessage({ sharedBuffer });

// 2. Thread-safe atomic operations
// Atomics.add prevents race conditions when both threads increment index 0
Atomics.add(sharedArray, 0, 5);
console.log("Thread-safe value:", Atomics.load(sharedArray, 0));

// Compare and swap: if current value is 5, set to 10
const prev = Atomics.compareExchange(sharedArray, 0, 5, 10);
console.log("Exchanged from:", prev, "to 10");`,
  recallHint: "SharedArrayBuffer = true shared memory. Atomics = lock-free thread synchronization. Requires COOP/COEP headers.",
  interviewTip: "Mention the required security headers (COOP/COEP) needed to enable `SharedArrayBuffer` in modern browsers due to Spectre mitigations.",
  tags: ["sharedarraybuffer", "atomics", "concurrency", "shared-memory", "spectre"]
}));

cards.push(createCard({
  idNum: 136,
  category: "Web APIs & Browser Concurrency",
  concept: "Custom Events & EventTarget Inheritance",
  priority: "intermediate",
  difficulty: "intermediate",
  question: "How do you dispatch custom events using CustomEvent and dispatchEvent, and how can classes inherit from EventTarget?",
  answer: "Custom events are instantiated via `new CustomEvent(type, { detail, bubbles: true, cancelable: true })` and emitted via `element.dispatchEvent(event)`. In modern JavaScript, any custom class can extend the native `EventTarget` class to provide a native `.addEventListener()`, `.removeEventListener()`, and `.dispatchEvent()` pub-sub interface without external libraries.",
  explanation: "The `detail` property encapsulates arbitrary payloads. Setting `bubbles: true` allows the custom event to bubble up the DOM tree, enabling event delegation for component-specific signals.",
  code: `// Custom class extending native EventTarget
class StateManager extends EventTarget {
  constructor(initialState) {
    super();
    this.state = initialState;
  }

  update(newState) {
    this.state = { ...this.state, ...newState };
    // Dispatch native CustomEvent with payload in 'detail'
    this.dispatchEvent(new CustomEvent("statechange", {
      detail: { state: this.state }
    }));
  }
}

const store = new StateManager({ theme: "dark" });

// Standard addEventListener interface!
store.addEventListener("statechange", (e) => {
  console.log("State updated:", e.detail.state);
});

store.update({ theme: "light" }); // Logs: State updated: { theme: "light" }`,
  recallHint: "CustomEvent(name, { detail, bubbles }). Classes can extend EventTarget for native pub-sub.",
  interviewTip: "Highlight `class MyStore extends EventTarget`. Many developers write custom pub-sub emitters from scratch without realizing that the web platform natively provides `EventTarget` for inheritance.",
  tags: ["custom-events", "eventtarget", "pub-sub", "architecture"]
}));

module.exports = cards;
