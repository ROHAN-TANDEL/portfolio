const { createCard } = require('../angular_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 109,
    category: "State Management, Performance & Security",
    concept: "NgRx SignalStore Architecture (withState, withMethods)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is NgRx SignalStore, and how does its plugin-based functional architecture work?",
    quickAnswer: "`signalStore` is a lightweight, fully reactive state management library built natively on Angular Signals. It uses functional composition plugins: `withState()` (state slice), `withComputed()` (derived signals), and `withMethods()` (actions/updaters), providing 100% type safety and zero boilerplate.",
    detailedAnswer: "Traditional NgRx Store required actions, reducers, selectors, and effects with heavy boilerplate. NgRx SignalStore replaces this with a functional, tree-shakeable design. Stores can be provided at the root level (`providedIn: 'root'`) or locally in a component's `providers: [CartStore]`. Methods can execute synchronous mutations via `patchState(store, ...)` or handle asynchronous operations using `rxMethod`.",
    code: `import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { computed, inject } from '@angular/core';

interface Todo {
  id: number;
  title: string;
  completed: boolean;
}

export const TodoStore = signalStore(
  { providedIn: 'root' },
  // 1. Declare State
  withState<{ todos: Todo[]; filter: 'all' | 'active' }>({
    todos: [],
    filter: 'all'
  }),
  // 2. Computed derived signals
  withComputed(({ todos, filter }) => ({
    filteredTodos: computed(() => {
      const f = filter();
      const list = todos();
      return f === 'all' ? list : list.filter(t => !t.completed);
    }),
    totalCount: computed(() => todos().length)
  })),
  // 3. State update methods
  withMethods((store) => ({
    addTodo(title: string) {
      patchState(store, (state) => ({
        todos: [...state.todos, { id: Date.now(), title, completed: false }]
      }));
    },
    setFilter(filter: 'all' | 'active') {
      patchState(store, { filter });
    }
  }))
);`,
    recallHint: "signalStore: withState() + withComputed() + withMethods() with patchState(store, ...).",
    interviewTip: "Highlight that SignalStore is modular and extensible: you can author custom plugins (e.g. `withEntities()`, `withStorageSync()`) using the same composition pattern.",
    tags: ["signalstore", "ngrx", "signals", "state-management"],
    practice: [
      "How does `patchState()` guarantee immutable state updates under the hood?",
      "How do you handle asynchronous HTTP calls inside `withMethods()` using `rxMethod`?"
    ]
  }),

  createCard({
    idNum: 110,
    category: "State Management, Performance & Security",
    concept: "NgRx ComponentStore Architecture",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When should you use `ComponentStore` instead of a global Store, and how is its lifecycle tied to the component?",
    quickAnswer: "`ComponentStore` is designed for localized component or feature state (e.g. complex modals, multi-step wizards, data tables). By providing it in a component's `providers: [MyStore]`, the store is instantiated with the component and automatically destroyed when the component unmounts, preventing memory leaks.",
    detailedAnswer: "Global stores frequently become cluttered with transient UI states (like modal visibility, active tabs, or search filters) that have no relevance to the rest of the application. `ComponentStore<T>` isolates state to a component subtree. It provides built-in `setState`, `updater`, `select`, and `effect` helpers, and cleans up all active effect subscriptions automatically in `ngOnDestroy`.",
    code: `import { Injectable } from '@angular/core';
import { ComponentStore } from '@ngrx/component-store';
import { Observable, switchMap, tap } from 'rxjs';

interface WizardState {
  step: number;
  data: Record<string, any>;
}

@Injectable()
export class WizardStore extends ComponentStore<WizardState> {
  constructor() {
    super({ step: 1, data: {} });
  }

  // Selectors
  readonly step$ = this.select(state => state.step);

  // Updaters
  readonly nextStep = this.updater((state) => ({
    ...state,
    step: state.step + 1
  }));
}

// In Component:
// @Component({
//   providers: [WizardStore] // Tied to this component's DOM lifecycle!
// })`,
    recallHint: "ComponentStore manages local UI state; automatically garbage-collected when component unmounts.",
    interviewTip: "Contrast ComponentStore with global NgRx: ComponentStore has zero global registration, no action types, and dies with its host component.",
    tags: ["componentstore", "ngrx", "state-management", "lifecycle"],
    practice: [
      "What happens if you provide `ComponentStore` in `providedIn: 'root'` instead of component `providers`?",
      "How does `ComponentStore.effect()` automatically manage subscription teardown?"
    ]
  }),

  createCard({
    idNum: 111,
    category: "State Management, Performance & Security",
    concept: "Pure vs Impure Pipes & Caching",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between Pure and Impure pipes in Angular, and why are impure pipes dangerous?",
    quickAnswer: "A Pure pipe (`pure: true`, default) only executes when its input arguments change by reference (`===`). An Impure pipe (`pure: false`) executes on every single change detection cycle (keystrokes, mouse moves, timers), which can easily degrade frame rates and cause CPU spikes.",
    detailedAnswer: "Pure pipes are memoized: Angular checks if `input === prevInput` and skips execution if unchanged. Impure pipes bypass this check. For example, filtering or sorting an array using an impure pipe will run on every tick across the entire app. For heavy filtering or sorting, use computed signals or component-level logic rather than impure pipes.",
    code: `import { Pipe, PipeTransform } from '@angular/core';

// 1. PURE PIPE (Default): Only transforms when input string reference changes
@Pipe({
  name: 'capitalize',
  standalone: true,
  pure: true // Default: Fast, memoized!
})
export class CapitalizePipe implements PipeTransform {
  transform(value: string): string {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
  }
}

// 2. IMPURE PIPE: Runs on every single change detection pass!
@Pipe({
  name: 'impureFilter',
  standalone: true,
  pure: false // CAUTION: Causes massive performance degradation on large lists
})
export class ImpureFilterPipe implements PipeTransform {
  transform(items: any[]): any[] {
    return items.filter(i => i.active);
  }
}`,
    recallHint: "Pure pipes (default) memoize and execute ONLY when input ref changes. Impure pipes run on every CD cycle.",
    interviewTip: "Never use an impure pipe for filtering/sorting arrays in production. Recommend computed signals or reactive streams instead.",
    tags: ["pipes", "pure-pipe", "impure-pipe", "performance"],
    practice: [
      "Why is `AsyncPipe` an impure pipe, and how does it avoid performance degradation?",
      "Can a pure pipe transform an object if an internal property was mutated in place?"
    ]
  }),

  createCard({
    idNum: 112,
    category: "State Management, Performance & Security",
    concept: "DOM Sanitization & XSS Protection",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Angular protect against Cross-Site Scripting (XSS) by default, and what is `DomSanitizer`?",
    quickAnswer: "Angular treats all values as untrusted by default. When values are interpolated or bound via `[innerHTML]`, `[href]`, or `[src]`, Angular automatically sanitizes the HTML, styles, or URLs, stripping out malicious `<script>` tags, inline `javascript:` protocols, or dangerous attributes.",
    detailedAnswer: "Angular's security model recognizes different `SecurityContext` values: HTML, Style, Script, URL, and Resource URL. When binding `[innerHTML]=\"untrustedHtml\"`, Angular passes the string through an internal HTML sanitizer that parses the HTML AST and strips hazardous elements (`<script>`, `<object>`, `onerror` attributes). If a value is unsafe, Angular strips it and warns in the browser console.",
    code: `import { Component } from '@angular/core';

@Component({
  selector: 'app-xss-demo',
  standalone: true,
  template: \`
    <!-- Angular automatically sanitizes this:
         The <script> tag is safely stripped out! -->
    <div [innerHTML]="userComment"></div>

    <!-- Malicious javascript: pseudo-protocol is sanitized to unsafe: -->
    <a [href]="maliciousLink">Dangerous Link</a>
  \`
})
export class XssDemoComponent {
  // Attempted XSS attack
  userComment = '<p>Normal text</p><script>alert("Hacked!")</script>';
  maliciousLink = 'javascript:stealCookies()';
}`,
    recallHint: "Angular sanitizes untrusted bindings automatically across HTML, URLs, and styles to block XSS.",
    interviewTip: "Highlight that Angular interpolations (`{{ val }}`) escape HTML completely (treating it as plain text), while property bindings (`[innerHTML]`) sanitize executable code while preserving safe markup.",
    tags: ["security", "xss", "sanitizer", "domsanitizer"],
    practice: [
      "What are the 5 `SecurityContext` categories in Angular?",
      "Why does `{{ userComment }}` render raw `<script>` tags as text while `[innerHTML]` strips them?"
    ]
  }),

  createCard({
    idNum: 113,
    category: "State Management, Performance & Security",
    concept: "Bypassing Security with DomSanitizer Risks",
    priority: "must-know",
    difficulty: "advanced",
    question: "When and why should you use `bypassSecurityTrust*` methods, and what severe security risks do they introduce?",
    quickAnswer: "`DomSanitizer.bypassSecurityTrustHtml/ResourceUrl` instructs Angular to skip its sanitization checks for trusted content (e.g. trusted SVGs, embedded YouTube iframes). The risk: If user-generated or unsanitized content is passed to these bypass methods, it creates an immediate zero-day XSS vulnerability.",
    detailedAnswer: "Sometimes legitimate requirements (such as embedding external trusted iframes or rendering rich markdown from a trusted CMS) require bypassing Angular's strict sanitizer. `DomSanitizer` exposes `bypassSecurityTrustHtml`, `bypassSecurityTrustStyle`, `bypassSecurityTrustScript`, `bypassSecurityTrustUrl`, and `bypassSecurityTrustResourceUrl`. Never pass raw user inputs to these methods without server-side validation or DOMPurify.",
    code: `import { Component, inject } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-video-embed',
  standalone: true,
  template: \`
    <!-- SafeResourceUrl required to bind iframe src dynamically -->
    <iframe [src]="safeVideoUrl" width="560" height="315"></iframe>
  \`
})
export class VideoEmbedComponent {
  private sanitizer = inject(DomSanitizer);

  // CAUTION: Only bypass security if the URL is strictly validated/trusted!
  safeVideoUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    'https://www.youtube.com/embed/dQw4w9WgXcQ'
  );
}`,
    recallHint: "bypassSecurityTrust* disables sanitization; never pass unsanitized user inputs to avoid XSS.",
    interviewTip: "In security interviews, emphasize that if third-party HTML must be rendered, run it through DOMPurify before calling `bypassSecurityTrustHtml`.",
    tags: ["security", "domsanitizer", "xss", "safe-url"],
    practice: [
      "What is the difference between `bypassSecurityTrustUrl` and `bypassSecurityTrustResourceUrl`?",
      "How do you sanitize user markdown safely using DOMPurify before bypassing Angular security?"
    ]
  }),

  createCard({
    idNum: 114,
    category: "State Management, Performance & Security",
    concept: "Virtual Scrolling with Angular CDK",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does `ScrollingModule` from Angular CDK achieve 60 FPS rendering on lists with 100,000+ items?",
    quickAnswer: "`cdk-virtual-scroll-viewport` only renders the DOM elements currently visible inside the viewport (plus a small buffer), recycling existing DOM nodes as the user scrolls. Memory and DOM node counts remain constant regardless of whether the collection has 50 or 500,000 items.",
    detailedAnswer: "Rendering 10,000 DOM rows causes severe memory bloat, layout thrashing, and freezes the browser. Virtual scrolling calculates the total scroll height synthetically. As the user scrolls, `*cdkVirtualFor` rebinds data to the visible pool of DOM elements. The `itemSize` property defines the fixed pixel height of each row (or `autosize` strategy for dynamic heights).",
    code: `import { Component } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';

@Component({
  selector: 'app-large-list',
  standalone: true,
  imports: [ScrollingModule],
  styles: [\`
    .viewport {
      height: 400px;
      width: 100%;
      border: 1px solid #ccc;
    }
    .item-row {
      height: 50px;
      display: flex;
      align-items: center;
      border-bottom: 1px solid #eee;
    }
  \`],
  template: \`
    <!-- itemSize is mandatory for fixed-size virtual scroll calculation -->
    <cdk-virtual-scroll-viewport itemSize="50" class="viewport">
      <div *cdkVirtualFor="let item of hugeList; trackBy: trackItem" class="item-row">
        Item #{{ item.id }}: {{ item.title }}
      </div>
    </cdk-virtual-scroll-viewport>
  \`
})
export class LargeListComponent {
  hugeList = Array.from({ length: 100000 }).map((_, i) => ({
    id: i,
    title: \`Log Entry \${i}\`
  }));

  trackItem(index: number, item: any) {
    return item.id;
  }
}`,
    recallHint: "cdk-virtual-scroll-viewport renders only visible DOM rows; memory stays constant for 100k items.",
    interviewTip: "Explain that regular `@for` or `*ngFor` creates real DOM nodes for every array element, whereas virtual scrolling creates a fixed pool of ~20 DOM nodes that are recycled continuously.",
    tags: ["virtual-scrolling", "cdk", "performance", "dom-recycling"],
    practice: [
      "What happens if `itemSize` does not match the actual CSS height of the item rows?",
      "How do you implement infinite scrolling pagination with `cdk-virtual-scroll-viewport`?"
    ]
  }),

  createCard({
    idNum: 115,
    category: "State Management, Performance & Security",
    concept: "Angular CLI Build Optimization (esbuild & Vite)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the performance benefits of the modern esbuild/Vite build pipeline introduced in Angular 17+?",
    quickAnswer: "Angular 17+ replaces Webpack with an `application` builder powered by esbuild and Vite. It provides up to 80% faster build times, sub-second HMR development reloads, optimized tree-shaking, and unified bundling for both browser and SSR.",
    detailedAnswer: "Historically, Angular CLI builds used Webpack with Terser, which was notoriously slow on large enterprise codebases. The new `@angular-devkit/build-angular:application` builder compiles TypeScript and bundles assets with native Go-based esbuild. Development serving uses Vite for instant Hot Module Replacement (HMR). The optimizer performs advanced dead-code elimination, stripping unused framework features.",
    code: `// angular.json configuration:
// "architect": {
//   "build": {
//     "builder": "@angular-devkit/build-angular:application",
//     "options": {
//       "outputPath": "dist/my-app",
//       "index": "src/index.html",
//       "browser": "src/main.ts",
//       "server": "src/main.server.ts", // Integrated SSR build!
//       "ssr": {
//         "entry": "server.ts"
//       },
//       "optimization": true
//     }
//   }
// }`,
    recallHint: "application builder uses esbuild + Vite: 80% faster builds, sub-second HMR, integrated SSR.",
    interviewTip: "Mention that the esbuild application builder builds both the client browser bundles and the Node SSR server bundles in a single, coordinated pass.",
    tags: ["esbuild", "vite", "build-optimizer", "cli"],
    practice: [
      "How does esbuild tree-shaking eliminate unused Angular built-in control flow code?",
      "Why is Hot Module Replacement (HMR) substantially faster with Vite compared to Webpack dev server?"
    ]
  }),

  createCard({
    idNum: 116,
    category: "State Management, Performance & Security",
    concept: "Web Workers in Angular CLI",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you offload CPU-intensive operations to Web Workers in Angular without blocking the UI thread?",
    quickAnswer: "Generate a worker using `ng generate web-worker <name>`. Instantiate it via `new Worker(new URL('./app.worker', import.meta.url), { type: 'module' })`. Use `postMessage()` and `onmessage` to communicate asynchronously off the main browser thread.",
    detailedAnswer: "JavaScript is single-threaded. Running intensive cryptography, large image processing, or heavy mathematical simulations directly on the main thread blocks UI rendering and causes input freezing (violating INP). Web Workers run on a background OS thread. Angular CLI automatically bundles worker files as separate chunks and handles module resolution.",
    code: `// 1. worker: app.worker.ts
addEventListener('message', ({ data }) => {
  // CPU-heavy calculation running on background thread
  const result = heavyCalculation(data);
  postMessage(result);
});

function heavyCalculation(n: number): number {
  let count = 0;
  for (let i = 0; i < n; i++) count += i;
  return count;
}

// 2. Component usage:
import { Component, OnInit, signal } from '@angular/core';

@Component({
  selector: 'app-worker-demo',
  standalone: true,
  template: \`<button (click)="runCalculation()">Calculate: {{ result() }}</button>\`
})
export class WorkerDemoComponent implements OnInit {
  result = signal(0);
  private worker!: Worker;

  ngOnInit() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker(new URL('./app.worker', import.meta.url), { type: 'module' });
      this.worker.onmessage = ({ data }) => {
        this.result.set(data);
      };
    }
  }

  runCalculation() {
    this.worker.postMessage(500000000);
  }
}`,
    recallHint: "Web Workers run CPU-heavy tasks on background thread via postMessage(), keeping UI at 60 FPS.",
    interviewTip: "Mention that Web Workers cannot directly touch DOM elements or Angular component instances; all data must be serialized via structured cloning across `postMessage`.",
    tags: ["web-workers", "concurrency", "performance", "multithreading"],
    practice: [
      "What types of data can and cannot be transferred across `postMessage()`?",
      "Why must Web Workers be cleaned up with `worker.terminate()` when the component destroys?"
    ]
  }),

  createCard({
    idNum: 117,
    category: "State Management, Performance & Security",
    concept: "Content Security Policy (CSP) & Nonces",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Angular support strict Content Security Policy (CSP) headers without requiring `unsafe-inline`?",
    quickAnswer: "Angular supports CSP nonces for inline styles and scripts. Provide the nonce attribute in HTML (`ngCspNonce=\"randomNonce\"`) or bind it dynamically in SSR so Angular attaches the cryptographic nonce to all dynamically generated `<style>` tags.",
    detailedAnswer: "A strict Content Security Policy prohibits `unsafe-inline` styles and scripts to stop code injection attacks. However, Angular historically injected component styles into dynamic `<style>` tags in `<head>`. In modern Angular, adding `ngCspNonce=\"{{ nonce }}\"` to the root `<app-root>` tag instructs Angular to copy that cryptographic nonce onto every `<style>` tag it creates, ensuring strict CSP compliance.",
    code: `<!-- In index.html or server-rendered HTML: -->
<!-- The server generates a unique cryptographic nonce per request -->
<app-root ngCspNonce="rAnd0m12345!"></app-root>

<!-- When Angular injects component styles, it automatically outputs: -->
<!-- <style ng-csp-nonce="rAnd0m12345!">.my-class[_ngcontent-c1] { ... }</style> -->

<!-- Allows strict HTTP header:
     Content-Security-Policy: default-src 'self'; style-src 'self' 'nonce-rAnd0m12345!' -->`,
    recallHint: "ngCspNonce=\"nonce\": injects server cryptographic nonce into Angular style tags for strict CSP.",
    interviewTip: "In enterprise banking or healthcare interviews, knowing how to achieve strict CSP without `unsafe-inline` proves elite security credentials.",
    tags: ["security", "csp", "nonce", "enterprise"],
    practice: [
      "Why is `unsafe-inline` considered a major security vulnerability in CSP headers?",
      "How does the SSR server generate a fresh cryptographic nonce per HTTP response?"
    ]
  }),

  createCard({
    idNum: 118,
    category: "State Management, Performance & Security",
    concept: "afterRender & afterNextRender Lifecycle Hooks",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are `afterRender` and `afterNextRender`, and why are they safer than `ngAfterViewInit` for DOM measurement?",
    quickAnswer: "`afterRender` and `afterNextRender` (introduced in Angular 16/17) execute callbacks directly synchronized with the browser's render pipeline. They only run on the browser (never on SSR servers), and they allow splitting DOM operations into `read` and `write` phases to avoid layout thrashing.",
    detailedAnswer: "Running DOM measurements (like `getBoundingClientRect()`) or third-party chart initializations inside `ngAfterViewInit` crashes during SSR (no DOM) and causes layout thrashing. `afterNextRender()` runs once after the very next change detection cycle completes DOM writing. `afterRender()` runs after every render. They accept phase callbacks: `{ read: () => el.clientWidth, write: () => el.style.width = ... }`.",
    code: `import { Component, ElementRef, afterNextRender, viewChild } from '@angular/core';

@Component({
  selector: 'app-chart-canvas',
  standalone: true,
  template: \`<canvas #chartCanvas></canvas>\`
})
export class ChartCanvasComponent {
  private canvas = viewChild.required<ElementRef<HTMLCanvasElement>>('chartCanvas');

  constructor() {
    // 1. Only executes on the browser! Safe for SSR!
    // 2. Runs AFTER Angular finishes updating the DOM
    afterNextRender({
      read: () => {
        // Safe DOM read: measure element dimensions
        const rect = this.canvas().nativeElement.getBoundingClientRect();
        return rect.width;
      },
      write: (width) => {
        // Safe DOM write: update canvas width without layout thrashing
        this.canvas().nativeElement.width = width;
      }
    });
  }
}`,
    recallHint: "afterNextRender: browser-only, runs after DOM updates; separates read and write to avoid layout thrashing.",
    interviewTip: "Always recommend `afterNextRender` over `ngAfterViewInit` for DOM measurements or initializing third-party libraries (Chart.js, Leaflet) in modern Angular apps.",
    tags: ["lifecycle", "afternextrender", "dom", "ssr-safe"],
    practice: [
      "What is layout thrashing (forced synchronous layout) and how does phase splitting prevent it?",
      "Why must `afterNextRender` be registered in the constructor or injection context?"
    ]
  }),

  createCard({
    idNum: 119,
    category: "State Management, Performance & Security",
    concept: "Memory Leak Prevention & Detached DOM Nodes",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the most common sources of memory leaks in Angular applications, and how do you prevent them?",
    quickAnswer: "Common sources: 1) Dangling RxJS subscriptions (fix: `takeUntilDestroyed()`), 2) Uncleaned global window/document event listeners (fix: `DestroyRef.onDestroy`), 3) Circular object references in closures, and 4) Retaining detached DOM node references in variables.",
    detailedAnswer: "In SPAs, components are created and destroyed frequently as users navigate. If a service or global window listener retains a reference to a destroyed component instance, the garbage collector cannot reclaim it, causing steady memory growth. Always use `takeUntilDestroyed()` for RxJS streams and clean up manual event listeners via `DestroyRef`.",
    code: `import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { fromEvent } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-leak-free',
  standalone: true,
  template: \`<p>Active View</p>\`
})
export class LeakFreeComponent implements OnInit {
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    // 1. Window listener cleaned up automatically when component is destroyed:
    fromEvent(window, 'resize').pipe(
      takeUntilDestroyed(this.destroyRef) // Auto-unsubscribes on destroy!
    ).subscribe(() => {
      console.log('Window resized');
    });

    // 2. Manual cleanup hook:
    const onKey = () => {};
    window.addEventListener('keydown', onKey);
    this.destroyRef.onDestroy(() => {
      window.removeEventListener('keydown', onKey);
    });
  }
}`,
    recallHint: "Prevent leaks: takeUntilDestroyed() for RxJS streams, and DestroyRef.onDestroy() for DOM listeners.",
    interviewTip: "Highlight that `takeUntilDestroyed()` automatically infers the current injection context when called in the constructor, but requires `takeUntilDestroyed(this.destroyRef)` if called inside `ngOnInit`.",
    tags: ["memory-leaks", "destroyref", "takeuntildestroyed", "performance"],
    practice: [
      "How do you inspect detached DOM nodes and memory leaks in Chrome DevTools Memory tab?",
      "Why does an unsubscribed `interval()` Observable cause a memory leak in a long-lived app?"
    ]
  }),

  createCard({
    idNum: 120,
    category: "State Management, Performance & Security",
    concept: "Microfrontends & Angular Elements (createCustomElement)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you package an Angular standalone component into a framework-agnostic Web Component using `@angular/elements`?",
    quickAnswer: "Use `createCustomElement(Component, { injector })` from `@angular/elements` and register it with the browser using `customElements.define('my-widget', element)`. It can then be used in React, Vue, or plain HTML pages.",
    detailedAnswer: "Angular Elements bridges Angular components to the W3C Web Component specification. It encapsulates Angular's change detection, inputs, outputs, and styles inside a native custom element tag. Inputs automatically map to HTML attributes/properties, and `@Output()` `EventEmitter` instances emit native DOM `CustomEvent` objects.",
    code: `import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { Component, Input, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-user-badge',
  standalone: true,
  template: \`
    <div class="badge">
      <span>{{ username }}</span>
      <button (click)="action.emit('clicked')">Ping</button>
    </div>
  \`
})
export class UserBadgeComponent {
  @Input() username = 'Guest';
  @Output() action = new EventEmitter<string>();
}

// In main.ts (bootstrap without DOM container):
(async () => {
  const app = await createApplication({ providers: [] });
  // Convert standalone component to native Custom Element
  const badgeElement = createCustomElement(UserBadgeComponent, {
    injector: app.injector
  });
  // Register with browser
  customElements.define('user-badge-element', badgeElement);
})();`,
    recallHint: "createCustomElement(Component, { injector }) + customElements.define('tag', el) creates W3C Web Components.",
    interviewTip: "Explain that Angular Elements enable enterprise microfrontend strategies: teams can build isolated widgets in Angular that are embedded seamlessly inside legacy jQuery or modern React host shells.",
    tags: ["angular-elements", "web-components", "microfrontends", "interoperability"],
    practice: [
      "How do Angular `@Output()` events map to native DOM `CustomEvent` listeners?",
      "What are bundle size considerations when packaging multiple Angular Elements into one page?"
    ]
  })
];
