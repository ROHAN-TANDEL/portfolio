const fs = require('fs');
const path = require('path');

const deepDives = [
  {
    id: "angular-deep-01",
    title: "Angular Change Detection Engine: Zone.js Monkey-Patching vs Zoneless Signal Graph",
    category: "Core Engine & Change Detection",
    readTimeMinutes: 24,
    overview: "Angular's change detection engine has evolved through two distinct eras: the asynchronous monkey-patching paradigm powered by Zone.js, and the modern fine-grained reactive push-pull graph powered by Angular Signals. This masterclass inspects how Zone.js intercepts browser execution contexts, how the component tree is marked dirty and traversed top-down, and how Angular 18+ achieves zoneless change detection with zero Zone.js overhead.",
    diagram: `+-------------------------------------------------------------------------+
|        ANGULAR CHANGE DETECTION: ZONE.JS VS ZONELESS SIGNAL GRAPH       |
+-------------------------------------------------------------------------+
|                                                                         |
|  [TRADITIONAL ZONE.JS FLOW]                                             |
|  User Click / Async Event                                               |
|         |                                                               |
|         v                                                               |
|  Zone.js Monkey-Patch (addEventListener, Promise, setTimeout)           |
|         |                                                               |
|         v                                                               |
|  ngZone.onMicrotaskEmpty emits                                          |
|         |                                                               |
|         v                                                               |
|  ApplicationRef.tick()                                                  |
|         |                                                               |
|         v (Global Top-Down Depth-First Search)                          |
|  [Root View] ---> [Parent View] ---> [OnPush View: Skipped if clean]    |
|                          |                                              |
|                          v                                              |
|                   [Child View (Checked)]                                |
|                                                                         |
|-------------------------------------------------------------------------|
|                                                                         |
|  [MODERN ZONELESS SIGNALS GRAPH (Angular 18+)]                          |
|  Signal Mutation: count.set(42)                                         |
|         |                                                               |
|         v (Fine-Grained Invalidation)                                   |
|  Consumer Node Flagged Dirty (Reactive Graph Edge)                      |
|         |                                                               |
|         v                                                               |
|  Microtask Scheduled via ChangeDetectionScheduler                      |
|         |                                                               |
|         v                                                               |
|  Direct View Refresh: Only Component View Nodes bound to signal update! |
|  (Zero top-down blind tree traversal! Zero Zone.js runtime overhead!)    |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Zone.js Monkey-Patching & The Microtask Drain",
        explanation: "Zone.js works by hijacking native asynchronous browser APIs in `window`. When Angular bootstraps, Zone.js substitutes `setTimeout`, `addEventListener`, `Promise`, and `XMLHttpRequest` with custom wrappers called Zones. Every asynchronous task enters a zone. When that async task completes and its microtask queue empties, `ngZone.onMicrotaskEmpty` emits an event that prompts Angular's `ApplicationRef` to invoke `.tick()`. While foolproof, this model has serious drawbacks: every single click or timer triggers a full change detection pass unless explicitly isolated using `ngZone.runOutsideAngular()`, and deep ZoneAwarePromise stacks degrade debugging experiences.",
        codeExample: `// Conceptual Zone.js monkey patching:
const originalAddEventListener = window.addEventListener;
window.addEventListener = function(type, listener, options) {
  const wrappedListener = function(...args) {
    // 1. Enter Angular Zone
    ngZone.enter();
    try {
      return listener.apply(this, args);
    } finally {
      // 2. Check if microtasks completed
      if (ngZone.isMicrotaskQueueEmpty()) {
        applicationRef.tick(); // Global change detection sweep!
      }
    }
  };
  return originalAddEventListener.call(this, type, wrappedListener, options);
};`
      },
      {
        subheading: "2. The OnPush Optimization & View Tree Pruning",
        explanation: "In default change detection, Angular checks every single component in the view tree from root to leaf. In large enterprise trees with 5,000+ components, this causes frame drops. `ChangeDetectionStrategy.OnPush` transforms the tree by instructing Angular to skip checking a component and its children unless one of four conditions is met: 1) An `@Input()` receives a new object reference (`prevVal !== currVal`), 2) A DOM event listener declared in the component template fires, 3) An `AsyncPipe` receives a new emission, or 4) `cdr.markForCheck()` is called manually. In OnPush mode, Angular prunes entire branches of the check tree, moving performance from $O(N)$ components to $O(K)$ dirty subtrees.",
        codeExample: `@Component({
  selector: 'app-perf-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, // Skips entire subtree unless dirty!
  template: \`<div>{{ data.name }}</div>\`
})
export class PerfItemComponent {
  @Input({ required: true }) data!: { id: string; name: string };
  // If parent mutates data.name in place, OnPush WILL NOT render!
  // Parent must pass a brand new reference: { ...data, name: 'New' }
}`
      },
      {
        subheading: "3. The Zoneless Signal Scheduler Revolution",
        explanation: "In Angular 18+, `provideExperimentalZonelessChangeDetection()` removes `zone.js` completely. Instead of polling or monkey-patching browser tasks, change detection is driven by explicit reactive notification. When a Signal is read in a template, Angular's template runtime registers that component view as a reactive consumer of the signal. When `signal.set()` executes, the signal notifies the `ChangeDetectionScheduler` via microtask. Only the dirty component views are queued and checked. This drops ~35kB of polyfills, eliminates zone-related stack corruption, and achieves sub-millisecond Interaction to Next Paint (INP).",
        codeExample: `// app.config.ts (Zero Zone.js!)
export const appConfig: ApplicationConfig = {
  providers: [
    provideExperimentalZonelessChangeDetection()
  ]
};

// Component automatically notifies Zoneless Scheduler on mutation:
@Component({
  selector: 'app-zoneless-demo',
  standalone: true,
  template: \`<button (click)="count.update(n => n + 1)">Count: {{ count() }}</button>\`
})
export class ZonelessDemoComponent {
  count = signal(0);
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "In Zoneless mode, mutating raw class properties without Signals or `cdr.markForCheck()` will never update the view.",
      "Directly mutating properties on input objects in OnPush components fails silently because reference equality (`===`) remains unchanged.",
      "Calling `cdr.detectChanges()` synchronously inside lifecycle hooks can trigger `ExpressionChangedAfterItHasBeenCheckedError`."
    ],
    keyTakeaways: [
      "Zone.js provides automatic async tracking at the cost of global top-down sweeps and bundle overhead.",
      "OnPush prunes clean branches of the component tree using strict input reference checks.",
      "Zoneless Angular uses fine-grained Signals to update dirty views directly without monkey-patching."
    ]
  },
  {
    id: "angular-deep-02",
    title: "The Hierarchical Dependency Injection Tree: EnvironmentInjector vs ElementInjector",
    category: "Dependency Injection & Architecture",
    readTimeMinutes: 22,
    overview: "Angular's Dependency Injection (DI) system is a hierarchical, multi-tiered directed graph. This masterclass dissects the dual-hierarchy architecture introduced in Ivy: the EnvironmentInjector tree (which manages system-wide services and routes) and the ElementInjector tree (which mirrors the component and directive DOM tree).",
    diagram: `+-------------------------------------------------------------------------+
|                  ANGULAR DUAL DI INJECTOR HIERARCHY                     |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ENVIRONMENT INJECTOR TREE]           [ELEMENT INJECTOR TREE]          |
|  (Module / Route / Platform Level)     (Component / Directive DOM Level)|
|                                                                         |
|  NullInjector                                                           |
|       ^                                                                 |
|       |                                                                 |
|  PlatformInjector                                                       |
|       ^                                                                 |
|       |                                                                 |
|  Root EnvironmentInjector <---------------+                             |
|  (providedIn: 'root')                     | Fallback resolution lookup  |
|       ^                                   | if token not found in DOM!  |
|       |                                   |                             |
|  Route EnvironmentInjector                |                             |
|  (routes providers: [...])                |                             |
|                                           |                             |
|                                  AppRoot ElementInjector                |
|                                           ^                             |
|                                           |                             |
|                                  Parent ElementInjector                 |
|                                  (viewProviders / providers)            |
|                                           ^                             |
|                                           |                             |
|                                  Child ElementInjector                  |
|                                  (@Directive / @Component)              |
|                                                                         |
|  Resolution Algorithm:                                                  |
|  1. Search current ElementInjector.                                     |
|  2. Walk UP the ElementInjector DOM tree to root.                       |
|  3. If not found, switch to EnvironmentInjector (Route -> Root -> Plat).|
|  4. If not found in NullInjector, throw NullInjectorError!              |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The ElementInjector Tree: DOM-Bound Scoping",
        explanation: "Every component and directive in Angular can define its own `providers` or `viewProviders` array. When Angular creates a component, it instantiates an `ElementInjector` that mirrors that DOM element's position. When a component or child directive requests a token via `inject(Service)` or constructor injection, Angular searches its own `ElementInjector` first. If missing, it traverses upward to the parent component's `ElementInjector`, continuing up the DOM tree until reaching the root component.",
        codeExample: `@Component({
  selector: 'app-parent-editor',
  standalone: true,
  providers: [DocumentSessionService], // Isolated per editor instance!
  template: \`<app-toolbar /><app-content-area />\`
})
export class ParentEditorComponent {
  // Child toolbar and content area share this EXACT instance of DocumentSessionService!
}`
      },
      {
        subheading: "2. The EnvironmentInjector Tree: Routes & Roots",
        explanation: "If the requested token is not found in the ElementInjector tree, resolution falls back to the `EnvironmentInjector` hierarchy. This starts at the route level: in standalone Angular, individual route configurations can declare `providers: [FeatureService]`. This creates a child `EnvironmentInjector` scoped specifically to that route branch. If still unfulfilled, resolution moves to the Root `EnvironmentInjector` (where `providedIn: 'root'` services live), up to the `PlatformInjector` (shared across multiple Angular apps on the same page), and terminates at `NullInjector`.",
        codeExample: `// app.routes.ts: Scoped route EnvironmentInjector
export const routes: Routes = [
  {
    path: 'checkout',
    providers: [
      // Only instantiated when user visits /checkout; destroyed on exit!
      PaymentGatewayService,
      CheckoutStore
    ],
    loadComponent: () => import('./checkout.component').then(m => m.CheckoutComponent)
  }
];`
      },
      {
        subheading: "3. Resolution Modifiers: @Self, @SkipSelf, @Optional, @Host",
        explanation: "Angular allows developers to control and restrict the search traversal using resolution modifiers. `inject(Token, { self: true })` restricts lookup solely to the current element; `skipSelf: true` skips the current element and searches only ancestors (vital for recursive tree structures or parent decorators); `host: true` stops traversal at the host component boundary (preventing leakage into parent views); and `optional: true` returns `null` instead of throwing `NullInjectorError`.",
        codeExample: `@Component({
  selector: 'app-nested-tree-node',
  standalone: true,
  template: \`<div>Node</div>\`
})
export class NestedTreeNodeComponent {
  // SkipSelf allows a node to inject its PARENT node without self-collision!
  private parentNode = inject(NestedTreeNodeComponent, { skipSelf: true, optional: true });
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Providing a service in both `providedIn: 'root'` and a component's `providers` creates two separate instances with disconnected state.",
      "Requesting a token without `{ optional: true }` when no provider exists throws fatal `NG0200: NullInjectorError`.",
      "Circular dependencies between two injected services cause stack overflows unless broken with `forwardRef` or architectural refactoring."
    ],
    keyTakeaways: [
      "Angular uses dual hierarchies: ElementInjector for DOM-scoped services, EnvironmentInjector for routes/singletons.",
      "Resolution searches ElementInjectors up to DOM root, then falls back to EnvironmentInjectors.",
      "Resolution modifiers (self, skipSelf, host, optional) provide surgical control over injection search boundaries."
    ]
  },
  {
    id: "angular-deep-03",
    title: "Angular Signals Reactivity Engine: The Push-Pull Glitch-Free Algorithm",
    category: "Reactivity Engine",
    readTimeMinutes: 24,
    overview: "Angular Signals represent a quantum leap in fine-grained reactivity. Powered by an advanced Push-Pull reactive graph algorithm, Angular delivers synchronous, glitch-free dependency tracking with automatic memoization. This masterclass dives into the internal data structures, the two-phase propagation cycle, and dynamic dependency tracking.",
    diagram: `+-------------------------------------------------------------------------+
|                  ANGULAR SIGNALS PUSH-PULL GRAPH ALGORITHM              |
+-------------------------------------------------------------------------+
|                                                                         |
|  [PHASE 1: PUSH NOTIFICATION (Eager Invalidation)]                      |
|                                                                         |
|  WritableSignal: price.set(100)                                         |
|         |                                                               |
|         | 1. Push "Dirty" notification down the consumer graph          |
|         v                                                               |
|  ComputedSignal: tax (Flagged STALE / DIRTY)                            |
|         |                                                               |
|         v                                                               |
|  ComputedSignal: total (Flagged STALE / DIRTY)                          |
|         |                                                               |
|         v                                                               |
|  Effect / Template Node: (Flagged DIRTY & Queued for Microtask)         |
|  (NOTE: Zero re-computation happens in Phase 1! Only bitmask flags!)    |
|                                                                         |
|-------------------------------------------------------------------------|
|                                                                         |
|  [PHASE 2: PULL EVALUATION (Lazy Computation & Memoization)]            |
|                                                                         |
|  Effect executes OR Template reads: total()                             |
|         |                                                               |
|         | 1. Pulls tax()                                                |
|         v                                                               |
|  Is tax STALE? YES -> Recompute tax = price * 0.2                       |
|  Is total STALE? YES -> Recompute total = price + tax                   |
|         |                                                               |
|         v                                                               |
|  Returns cached value: 120. Marks state CLEAN.                          |
|                                                                         |
|  GLITCH-FREE GUARANTEE: Diamond dependency problems are impossible!    |
|  Intermediate stale states are NEVER exposed to consumer effects!       |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Reactive Producer-Consumer Graph Topology",
        explanation: "Angular Signals model state as a directed acyclic graph (DAG) consisting of Producers (nodes that hold or compute values, like `signal()` and `computed()`) and Consumers (nodes that depend on producers, like `computed()`, `effect()`, or Template views). Every edge in this graph is bidirectional. When a consumer evaluates, it registers itself on the producer's consumer list. If dynamic branching occurs (e.g. `isVIP() ? vipDiscount() : normalDiscount()`), Angular dynamically unlinks stale producers and subscribes to active ones, preventing memory leaks and ghost calculations.",
        codeExample: `// Dynamic dependency tracking in action:
const showDetails = signal(false);
const secretKey = signal('XYZ-999');

// When showDetails is false, reading 'derived' does NOT subscribe to secretKey!
const derived = computed(() => {
  if (!showDetails()) {
    return 'Summary Only';
  }
  // secretKey is only tracked when this branch executes!
  return \`Secret: \${secretKey()}\`;
});`
      },
      {
        subheading: "2. The Two-Phase Push-Pull Algorithm",
        explanation: "Traditional reactive systems often suffer from 'glitches'—temporary inconsistent states where derived values update in the wrong order during a diamond dependency (e.g. A -> B, A -> C, and D depends on B and C). Angular avoids this with a two-phase Push-Pull algorithm. Phase 1 (Push) is purely eager notification: when a signal mutates, it pushes a 'dirty' bit down to all transitive consumers. No calculations run yet! Phase 2 (Pull) is lazy evaluation: when an effect or template reads a signal, the node pulls its upstream dependencies. If a dependency is clean, its cached value is returned immediately. If dirty, it recomputes, caches the result, and marks itself clean.",
        codeExample: `// Diamond dependency example (Glitch-Free):
const base = signal(10);
const double = computed(() => base() * 2);
const quadruple = computed(() => base() * 4);
const sum = computed(() => double() + quadruple());

// When base changes:
// 1. Push Phase: double, quadruple, and sum are marked STALE.
// 2. Pull Phase: sum() asks double() and quadruple() for values.
// sum computes EXACTLY once with coordinated inputs: 20 + 40 = 60.
// There is NEVER an intermediate state where double is updated but quadruple isn't!`
      },
      {
        subheading: "3. Signals vs Observables: Synchronous Values vs Streams",
        explanation: "A Signal always has a synchronous, current value. Reading a signal (`count()`) is instantaneous and never requires subscription or unsubscription. Conversely, RxJS Observables model asynchronous events distributed over time (HTTP responses, WebSocket messages, button debounce streams). Angular provides `@angular/core/rxjs-interop` with `toSignal()` and `toObservable()` to seamlessly convert between the two worlds, allowing complex async orchestration in RxJS while rendering clean synchronous state via Signals in templates.",
        codeExample: `import { toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { Component, inject } from '@angular/core';

@Component({
  selector: 'app-user-data',
  standalone: true,
  template: \`<h1>{{ user()?.name }}</h1>\`
})
export class UserDataComponent {
  private http = inject(HttpClient);

  // Convert cold async stream to clean synchronous Signal:
  user = toSignal(this.http.get<{ name: string }>('/api/me'), { initialValue: null });
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Mutating signals inside an `effect()` can trigger circular loops; Angular disables signal writes in effects by default unless `{ allowSignalWrites: true }` is enabled.",
      "Reading signals in asynchronous callbacks (like `setTimeout`) outside the effect's synchronous tracking window loses reactive dependency tracking.",
      "Computed signals must be pure functions with zero side effects; mutating external variables inside `computed()` breaks caching guarantees."
    ],
    keyTakeaways: [
      "Signals use a two-phase Push-Pull algorithm that guarantees glitch-free execution across diamond dependencies.",
      "Dependencies are tracked dynamically: only producers read during the latest execution remain subscribed.",
      "Signals provide synchronous value access, while Observables model asynchronous event streams over time."
    ]
  },
  {
    id: "angular-deep-04",
    title: "Template Compilation & The Control Flow Engine (@if, @for, AST Transformation)",
    category: "Compiler & Templates",
    readTimeMinutes: 20,
    overview: "Angular 17 overhauled template compilation by replacing legacy structural directives (*ngIf, *ngFor) with built-in control flow (@if, @for, @switch). This masterclass analyzes the Ivy template parser, Abstract Syntax Tree (AST) transformations, and how built-in control flow generates hyper-optimized incremental DOM instructions.",
    diagram: `+-------------------------------------------------------------------------+
|                  ANGULAR CONTROL FLOW COMPILATION PIPELINE              |
+-------------------------------------------------------------------------+
|                                                                         |
|  [TEMPLATE SOURCE CODE]                                                 |
|  @if (user()) { <span>{{ user().name }}</span> } @else { <guest /> }    |
|         |                                                               |
|         v                                                               |
|  [ANGULAR COMPILER (ngc / Ivy)]                                         |
|  Lexer & Parser generate Template AST (Abstract Syntax Tree)            |
|  Control flow blocks recognized as native AST nodes (IfBlock, ForLoopBlock)|
|         |                                                               |
|         v                                                               |
|  [INTERMEDIATE REPRESENTATION (IR)]                                     |
|  Transforms AST into specialized Incremental DOM bytecode:              |
|  - ɵɵconditional(1, condition ? 0 : 1)                                  |
|  - ɵɵtemplate(0, UserTemplate, ...)(1, GuestTemplate, ...)              |
|         |                                                               |
|         v                                                               |
|  [JAVASCRIPT OUTPUT (Zero Module Dependencies!)]                        |
|  Fast conditional branch execution; 0 CommonModule structural overhead!|
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Flaws of Structural Directives (*ngIf / *ngFor)",
        explanation: "Legacy structural directives were syntactic sugar for `<ng-template [ngIf]=\"...\">`. While flexible, this design suffered from major deficiencies: 1) It required importing `CommonModule`, bloating standalone bundle boundaries, 2) The micro-syntax parser was separate from the core template parser, leading to obscure syntax errors, 3) Type narrowing was brittle, requiring custom `$implicit` type guard hacks, and 4) Complex if-else structures required verbose `ng-template` references (`*ngIf=\"cond; else fallbackTpl\"`).",
        codeExample: `<!-- LEGACY: Verbose, requires ng-template references and CommonModule -->
<div *ngIf="user; else guestTpl">
  <h2>{{ user.name }}</h2>
</div>
<ng-template #guestTpl>
  <p>Guest User</p>
</ng-template>`
      },
      {
        subheading: "2. Native AST Parsing & Built-in Control Flow",
        explanation: "Modern `@if`, `@else if`, `@else`, `@for`, and `@switch` are built directly into the Angular template compiler grammar. The compiler parses them into native AST nodes (`IfBlock`, `ForLoopBlock`). Because they are first-class language constructs, TypeScript type narrowing works out of the box across branches: `@if (data !== null) { ... }` narrows `data` to non-null in all child bindings. Built-in control flow emits direct conditional bytecode (`ɵɵconditional`), executing up to 90% faster than structural directive instantiation.",
        codeExample: `<!-- MODERN: Clean, native type narrowing, zero module imports -->
@if (user(); as u) {
  <h2>{{ u.name }}</h2>
} @else if (isGuest()) {
  <p>Guest User</p>
} @else {
  <p>Loading Profile...</p>
}`
      },
      {
        subheading: "3. The @for Loop & Mandatory Track Optimization",
        explanation: "In `@for (item of items(); track item.id)`, the `track` expression is enforced by the compiler. Tracking enables Angular to preserve DOM node identity across array mutations. When an array is reordered or an item is prepended, Angular matches items by their tracked keys, moving existing DOM nodes rather than destroying and recreating them. Unlike legacy `trackBy` (which required writing an auxiliary class method), modern `track` accepts any inline expression (`track item.id`, `track $index`), which the compiler optimizes directly into internal diffing routines.",
        codeExample: `@Component({
  selector: 'app-users',
  standalone: true,
  template: \`
    <ul>
      @for (user of users(); track user.id; let idx = $index; let total = $count) {
        <li>[\${{ idx + 1 }}/\${{ total }}] {{ user.name }}</li>
      } @empty {
        <li>No users registered.</li>
      }
    </ul>
  \`
})
export class UsersComponent {
  users = signal([{ id: 'u1', name: 'Alice' }]);
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Using `track $index` on dynamic collections where items are inserted, deleted, or sorted causes DOM state and focus bugs.",
      "`@empty` only renders when the collection is empty (`length === 0`), but NOT when the variable is null or undefined.",
      "Built-in control flow requires Angular 17+; running on legacy Angular projects requires running the migration schematic `ng g @angular/core:control-flow`."
    ],
    keyTakeaways: [
      "Built-in control flow is parsed natively by the compiler, eliminating CommonModule dependencies.",
      "Type narrowing works natively across @if and @else if branches without custom type guards.",
      "Mandatory track expressions on @for loops prevent catastrophic DOM node destruction and recreating."
    ]
  },
  {
    id: "angular-deep-05",
    title: "Deferrable Views (@defer) Deep Dive: Triggers, Prefetching & Dynamic Chunking",
    category: "Compiler & Performance",
    readTimeMinutes: 22,
    overview: "Deferrable Views (`@defer`) revolutionize client-side performance by enabling declarative, template-level code splitting. This masterclass examines how the build tool generates standalone chunk boundaries, how browser triggers (IntersectionObserver, requestIdleCallback) schedule fetching, and how prefetch-render decoupling eliminates user latency.",
    diagram: `+-------------------------------------------------------------------------+
|                  DEFERRABLE VIEWS (@defer) ARCHITECTURE                 |
+-------------------------------------------------------------------------+
|                                                                         |
|  [TEMPLATE SOURCE]                                                      |
|  @defer (on interaction(button); prefetch on hover(button)) {           |
|    <app-heavy-chart [data]="chartData" />                               |
|  } @placeholder { <div class="chart-skeleton"></div> }                   |
|                                                                         |
|  1. BUILD TIME:                                                         |
|     Compiler detects HeavyChart is isolated inside @defer.              |
|     Bundler extracts HeavyChart & dependencies into heavy-chart.js chunk|
|                                                                         |
|  2. RUNTIME STAGE A: MOUNT                                              |
|     Renders @placeholder DOM node immediately (0ms blocking time).      |
|                                                                         |
|  3. RUNTIME STAGE B: PREFETCH (User hovers over button)                 |
|     Browser fires hover event -> triggers dynamic import('heavy-chart')|
|     Bundle downloads in background and caches in browser memory.        |
|                                                                         |
|  4. RUNTIME STAGE C: RENDER (User clicks button)                        |
|     Chunk is ALREADY cached!                                            |
|     Instantaneous 0ms swap: @placeholder destroyed, HeavyChart mounted! |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Declarative Code Splitting at the Template Level",
        explanation: "Before `@defer`, code splitting in Angular was restricted to route transitions via `loadComponent`. Heavy components embedded within a route (such as rich text editors, 3D visualization canvases, or comments sections) were bundled directly into the route chunk, bloating initial page load. `@defer` enables fine-grained component chunking: any standalone component referenced exclusively inside a `@defer` block is automatically partitioned into its own asynchronous JavaScript chunk by the build tool (esbuild).",
        codeExample: `// AnalyticsDashboardComponent
@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [HeavyHeatmapComponent],
  template: \`
    <h1>Dashboard</h1>
    <!-- HeavyHeatmap is split into a separate JS file automatically! -->
    @defer (on viewport) {
      <app-heavy-heatmap />
    } @placeholder {
      <div style="height: 300px; background: #eee;">Loading map...</div>
    }
  \`
})
export class AnalyticsDashboardComponent {}`
      },
      {
        subheading: "2. Trigger Mechanics & Browser Integration",
        explanation: "Angular `@defer` supports built-in declarative triggers: 1) `on idle`: uses `requestIdleCallback` to fetch and render when the main thread has spare cycles, 2) `on viewport`: uses `IntersectionObserver` on the placeholder element, downloading when it scrolls into view, 3) `on interaction`: waits for click, focus, or keydown on the trigger, 4) `on hover`: triggers on mouseenter, and 5) `on timer(duration)`: triggers after a specified delay. You can also specify programmatic boolean expressions using `when condition()`.",
        codeExample: `<!-- Combines multiple triggers: fires when scrolled into view OR on button click -->
<button #loadCommentsBtn>Show Comments</button>

@defer (on viewport; on interaction(loadCommentsBtn)) {
  <app-comments-stream />
} @placeholder {
  <p>Comments will appear when visible or requested.</p>
}`
      },
      {
        subheading: "3. Decoupling Prefetching from Rendering",
        explanation: "The ultimate weapon for UI responsiveness is decoupling the prefetch trigger from the render trigger. In standard deferral, user interaction triggers both the download and render, creating a network waiting state. By pairing `prefetch on hover` with `on interaction`, the chunk begins downloading the instant the user moves the mouse cursor toward a button. By the time the click completes 100ms later, the script is already downloaded, delivering an instantaneous 0ms perceived transition.",
        codeExample: `@defer (on interaction(actionBtn); prefetch on hover(actionBtn)) {
  <app-transaction-modal />
} @placeholder {
  <button #actionBtn class="btn">Initiate Transfer</button>
} @loading (after 100ms; minimum 400ms) {
  <div class="spinner">Preparing transaction modal...</div>
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "If a component inside `@defer` is also imported and used outside `@defer` in the same bundle, esbuild cannot split it, bundling it eagerly.",
      "Omitting height or dimensions on the `@placeholder` element causes `IntersectionObserver` to trigger immediately on page load, nullifying lazy loading.",
      "Setting a `when condition` back to `false` does NOT destroy the deferred component; deferral is one-way once rendered."
    ],
    keyTakeaways: [
      "@defer brings automatic code splitting from route boundaries into individual template sections.",
      "Built-in triggers leverage native browser APIs (IntersectionObserver, requestIdleCallback) for zero overhead.",
      "Decoupling prefetching (on hover) from rendering (on interaction) delivers 0ms perceived user latency."
    ]
  },
  {
    id: "angular-deep-06",
    title: "RxJS vs Signals Interoperability (toSignal, toObservable & Injection Context)",
    category: "Reactivity & Async",
    readTimeMinutes: 20,
    overview: "Angular's modern reactive architecture is a hybrid model: RxJS excels at asynchronous event streams, debouncing, and HTTP orchestration, while Signals excel at synchronous state, computed derivations, and template rendering. This masterclass explores `@angular/core/rxjs-interop`, how injection contexts manage subscription lifecycles, and how to write clean hybrid architectures.",
    diagram: `+-------------------------------------------------------------------------+
|                  RXJS & SIGNALS INTEROPERABILITY BRIDGE                 |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ASYNCHRONOUS REALM (RxJS)]            [SYNCHRONOUS REALM (Signals)]   |
|  - Streams over time                   - Current, synchronous value     |
|  - WebSockets, Debounced Inputs        - Template bindings, fine-grain  |
|  - HttpClient requests                 - Computed derived state         |
|                                                                         |
|                toSignal(obs$, { initialValue })                         |
|                ==================================>                      |
|                Subscribes in InjectionContext;                          |
|                Auto-unsubscribes on DestroyRef;                         |
|                Pushes latest emission to Signal!                        |
|                                                                         |
|                toObservable(mySignal)                                   |
|                <==================================                      |
|                Uses effect() internally;                                |
|                Emits whenever Signal changes;                           |
|                Pipes into RxJS operators (debounceTime, switchMap)!     |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. toSignal: Bridging Async Streams into Synchronous State",
        explanation: "`toSignal(observable$, options)` subscribes to an RxJS Observable and exposes its latest emission as a synchronous Signal. Because `toSignal()` must be called in an injection context (or provided with an explicit `Injector`), it hooks into `DestroyRef` to automatically unsubscribe when the enclosing component or service is destroyed. To avoid returning `undefined` before the first emission, pass `{ initialValue: defaultValue }` or `{ requireSync: true }` (for synchronous BehaviorSubjects).",
        codeExample: `import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-stats',
  standalone: true,
  template: \`<p>Active Users: {{ activeCount() }}</p>\`
})
export class StatsComponent {
  private http = inject(HttpClient);

  // Synchronous signal with fallback initial value:
  activeCount = toSignal(
    this.http.get<number>('/api/users/count'),
    { initialValue: 0 }
  );
}`
      },
      {
        subheading: "2. toObservable: Converting Signals to Reactive Streams",
        explanation: "`toObservable(signal)` does the reverse: it tracks an Angular Signal and emits its values onto an RxJS Observable stream. Under the hood, `toObservable()` creates an Angular `effect()` that listens for signal changes and pushes new values down the Observable pipeline. This allows combining signals with powerful RxJS operators like `debounceTime()`, `distinctUntilChanged()`, `switchMap()`, and `filter()`.",
        codeExample: `import { Component, signal, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

@Component({
  selector: 'app-live-search',
  standalone: true,
  template: \`
    <input (input)="onInput($event)" placeholder="Search..." />
    <ul>
      @for (item of searchResults(); track item.id) {
        <li>{{ item.name }}</li>
      }
    </ul>
  \`
})
export class LiveSearchComponent {
  private http = inject(HttpClient);
  searchTerm = signal('');

  // 1. Signal -> Observable: Debounce typing
  private searchResults$ = toObservable(this.searchTerm).pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(query => this.http.get<any[]>(\`/api/search?q=\${query}\`))
  );

  // 2. Observable -> Signal: Render cleanly in template
  searchResults = toSignal(this.searchResults$, { initialValue: [] });

  onInput(event: Event) {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }
}`
      },
      {
        subheading: "3. Injection Context Requirements & Injection Boundaries",
        explanation: "Both `toSignal()` and `toObservable()` must be executed during the construction phase (in property initializers or constructors) where Angular's ambient `InjectionContext` is active. If you must call them inside a method or lifecycle hook, you must capture the injector via `private injector = inject(Injector)` and pass it explicitly: `toSignal(obs$, { injector: this.injector })`. Violating this throws error `NG0203: inject() must be called from an injection context`.",
        codeExample: `export class DynamicBridgeService {
  private injector = inject(Injector);

  createSignalFromStream<T>(obs$: Observable<T>, fallback: T) {
    // Explicit injector allows calling toSignal outside constructor phase!
    return toSignal(obs$, { initialValue: fallback, injector: this.injector });
  }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Calling `toSignal` without `initialValue` emits `undefined` on first evaluation, which can cause runtime crashes in strict templates.",
      "Using `toObservable` creates an internal `effect()`; emissions are scheduled via microtask, so value propagation is not synchronously instant.",
      "If an Observable returned to `toSignal` emits an error, `toSignal` rethrows that error whenever the signal is read until a new value emits."
    ],
    keyTakeaways: [
      "Use RxJS for event orchestration, debouncing, and HTTP; use Signals for synchronous UI state.",
      "toSignal automatically cleans up subscriptions using DestroyRef when instantiated in injection context.",
      "toObservable uses an internal effect to push signal changes into RxJS operator pipelines."
    ]
  },
  {
    id: "angular-deep-07",
    title: "Angular Router Execution Lifecycle: Navigation, Functional Guards & Resolvers",
    category: "Routing & Architecture",
    readTimeMinutes: 22,
    overview: "The Angular Router is a sophisticated state machine managing URL parsing, route matching, functional guard execution, async resolvers, and outlet activation. This masterclass maps the exact internal phases of navigation, URL tree reconstruction, and atomic redirects.",
    diagram: `+-------------------------------------------------------------------------+
|                  ANGULAR ROUTER EXECUTION PIPELINE                      |
+-------------------------------------------------------------------------+
|                                                                         |
|  User Navigation: router.navigate(['/dashboard'])                       |
|         |                                                               |
|         v                                                               |
|  1. NavigationStart                                                     |
|         |                                                               |
|         v                                                               |
|  2. URL Parsing & Route Matching (CanMatchFn check)                     |
|     - If CanMatch returns false, falls through to next candidate!       |
|     - Matches URL segments against Route Tree                           |
|         |                                                               |
|         v                                                               |
|  3. RoutesRecognized                                                    |
|         |                                                               |
|         v                                                               |
|  4. Guards Phase:                                                       |
|     - CanDeactivateFn (Checks if departing component permits exit)      |
|     - CanActivateChildFn & CanActivateFn (Checks authorization)         |
|     - Returns true | false | UrlTree (Atomic redirect!)                 |
|         |                                                               |
|         v                                                               |
|  5. Resolvers Phase (ResolveFn):                                        |
|     - Fetches required route data before activating component           |
|         |                                                               |
|         v                                                               |
|  6. Activation & Outlet Swapping:                                       |
|     - Instantiates target standalone component via ElementInjector      |
|     - Binds path/query params to @Input() / input() signals             |
|     - Destroys departing component and updates document.title           |
|         |                                                               |
|         v                                                               |
|  7. NavigationEnd (or NavigationCancel / NavigationError)               |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Guard Execution Order & Atomic UrlTree Redirects",
        explanation: "During navigation, guards execute in a strict deterministic order: 1) `CanDeactivate` (running on departing components), 2) `CanMatch` (determining if route candidates match), 3) `CanActivateChild`, and 4) `CanActivate`. Historically, failing guards called `router.navigate(['/login'])` and returned `false`. This spawned duplicate navigation events. In modern Angular, guards return a `UrlTree` (`router.createUrlTree(['/login'])`). Returning a `UrlTree` atomically cancels the pending navigation and triggers the redirect in a single router turn.",
        codeExample: `export const enterpriseAuthGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (auth.isLoggedIn()) {
    return true;
  }

  // ATOMIC REDIRECT: Cancels pending transition and redirects seamlessly
  return router.createUrlTree(['/auth/login'], {
    queryParams: { redirectUrl: state.url }
  });
};`
      },
      {
        subheading: "2. CanMatchFn: Dynamic Route Branching",
        explanation: "Unlike `CanActivate` (which runs after route matching is locked and aborts navigation on failure), `CanMatchFn` executes during the matching phase. If `CanMatch` returns `false`, the router skips that route definition and evaluates subsequent entries in the routes array. This enables powerful patterns like A/B feature flag testing, role-based component branching, and mobile/desktop component splitting under the exact same URL path.",
        codeExample: `export const routes: Routes = [
  // Version A: Experimental redesigned dashboard for beta users
  {
    path: 'dashboard',
    canMatch: [() => inject(FeatureFlagService).isEnabled('v2_dashboard')],
    loadComponent: () => import('./v2-dashboard.component').then(m => m.V2DashboardComponent)
  },
  // Version B: Fallback standard dashboard for general users
  {
    path: 'dashboard',
    loadComponent: () => import('./standard-dashboard.component').then(m => m.StandardDashboardComponent)
  }
];`
      },
      {
        subheading: "3. withComponentInputBinding & Route Inputs",
        explanation: "Configured via `provideRouter(routes, withComponentInputBinding())`, the router automatically binds path parameters, query parameters, and resolved data directly into the routed component's inputs. This eliminates `ActivatedRoute` subscriptions. When paired with modern Signal inputs (`input.required<string>()`), route parameter updates become fully reactive: navigating from `/user/1` to `/user/2` updates the signal instantly without component destruction or manual `switchMap` handling.",
        codeExample: `@Component({
  selector: 'app-user-view',
  standalone: true,
  template: \`<h1>Viewing User: {{ id() }} (Tab: {{ tab() }})</h1>\`
})
export class UserViewComponent {
  // Bound from path parameter :id
  id = input.required<string>();

  // Bound from query parameter ?tab=...
  tab = input<string>('profile');
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Returning `false` from a guard without redirecting leaves the application on the previous route with no user feedback.",
      "Resolvers block navigation until their Observable completes; cold Observables that never emit `complete` freeze the router indefinitely.",
      "When navigating between routes that use the same component with different parameters, Angular reuses the component instance without re-running `ngOnInit`."
    ],
    keyTakeaways: [
      "Return UrlTree instead of false to execute atomic, race-condition-free redirects in guards.",
      "CanMatchFn allows multiple routes to share the same path for feature flags and A/B testing.",
      "withComponentInputBinding maps URL params directly to reactive component inputs."
    ]
  },
  {
    id: "angular-deep-08",
    title: "Reactive Forms & The ControlValueAccessor Bridge Mechanics",
    category: "Forms & Architecture",
    readTimeMinutes: 22,
    overview: "Angular's Reactive Forms architecture is powered by an AbstractControl state tree decoupled from the DOM. Bridging custom UI components into this tree requires implementing the ControlValueAccessor (CVA) contract. This masterclass inspects the two-way CVA synchronization loop, typed form trees, and cross-field validation mechanics.",
    diagram: `+-------------------------------------------------------------------------+
|                  CONTROLVALUEACCESSOR (CVA) BRIDGE LOOP                 |
+-------------------------------------------------------------------------+
|                                                                         |
|  [ANGULAR REACTIVE FORM MODEL]          [CUSTOM UI COMPONENT DOM]       |
|  FormControl (value: 75, dirty: false)  <app-slider> DOM Elements       |
|                                                                         |
|  1. MODEL TO VIEW UPDATE:                                               |
|     control.setValue(80)                                                |
|         |                                                               |
|         +---------------------------------> writeValue(80)              |
|                                             Updates internal slider UI  |
|                                                                         |
|  2. VIEW TO MODEL UPDATE:                                               |
|     User drags slider thumb to 90                                       |
|     Slider element dispatches event                                     |
|         |                                                               |
|         | this.onChange(90)                                             |
|         <---------------------------------+ (Calls registered fn)      |
|         v                                                               |
|     control.value becomes 90;                                           |
|     control.dirty becomes true;                                         |
|                                                                         |
|  3. TOUCH NOTIFICATION:                                                 |
|     User releases focus (blur)                                          |
|         | this.onTouched()                                              |
|         <---------------------------------+                             |
|     control.touched becomes true!                                       |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The ControlValueAccessor (CVA) Contract",
        explanation: "When attaching `formControl` or `formControlName` to an arbitrary element, Angular needs an adapter to communicate with it. The `ControlValueAccessor` interface defines 4 methods: 1) `writeValue(obj)`: Angular pushes values from the TypeScript model into your component, 2) `registerOnChange(fn)`: Angular gives you a function `fn` that you must invoke whenever the user changes the component's value, 3) `registerOnTouched(fn)`: invoked when the user blurs or interacts with the control, and 4) `setDisabledState(isDisabled)`: toggles UI disabled state.",
        codeExample: `@Component({
  selector: 'app-counter-input',
  standalone: true,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => CounterInputComponent),
    multi: true
  }],
  template: \`
    <button (click)="decrement()">-</button>
    <span>{{ val }}</span>
    <button (click)="increment()">+</button>
  \`
})
export class CounterInputComponent implements ControlValueAccessor {
  val = 0;
  private onChange = (v: number) => {};
  private onTouched = () => {};

  writeValue(v: number): void { this.val = v || 0; }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }

  increment() {
    this.val++;
    this.onChange(this.val); // Notify Angular form!
    this.onTouched();
  }
  decrement() {
    this.val--;
    this.onChange(this.val);
    this.onTouched();
  }
}`
      },
      {
        subheading: "2. Strictly Typed Form Hierarchies",
        explanation: "Angular 14+ typed forms eliminate `any` casting. A `FormGroup<{ email: FormControl<string> }>` enforces compile-time safety. Crucially, `form.value` produces `Partial<T>` because disabled controls are omitted from the object. To retrieve all controls including disabled ones with strict type completeness, call `form.getRawValue()`. If using `nonNullable: true` on controls, calling `control.reset()` reverts to its initial value instead of becoming `null`.",
        codeExample: `interface UserForm {
  name: FormControl<string>;
  age: FormControl<number>;
}

const form = new FormGroup<UserForm>({
  name: new FormControl('', { nonNullable: true }),
  age: new FormControl(18, { nonNullable: true })
});

// form.value.name -> string | undefined (if disabled)
// form.getRawValue().name -> strictly string!`
      },
      {
        subheading: "3. Cross-Field Validation & Status Propagation",
        explanation: "When validation rules span multiple fields (e.g. matching password and confirmation password, or start date preceding end date), placing the validator on an individual control causes validation synchronization bugs. Cross-field validators must be placed on the parent `FormGroup`. When any child control changes, the parent group recalculates its validity and propagates error objects to `formGroup.errors`.",
        codeExample: `export const dateRangeValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const start = control.get('startDate')?.value;
  const end = control.get('endDate')?.value;

  if (start && end && new Date(start) > new Date(end)) {
    return { invalidDateRange: true };
  }
  return null;
};`
      }
    ],
    edgeCasesAndPitfalls: [
      "Failing to call `onTouched()` in a custom CVA prevents `control.touched` from becoming true, breaking validation error display.",
      "Calling `form.reset()` on standard controls reverts their value to `null`, violating non-nullable TypeScript interfaces.",
      "Mutating form controls inside a `valueChanges` subscription without `{ emitEvent: false }` causes an infinite loop."
    ],
    keyTakeaways: [
      "ControlValueAccessor is the two-way bridge connecting Angular Reactive Forms to custom UI widgets.",
      "Use form.getRawValue() to extract strongly typed values including disabled controls.",
      "Attach cross-field validators to the parent FormGroup rather than individual controls."
    ]
  },
  {
    id: "angular-deep-09",
    title: "Server-Side Rendering (SSR) & Non-Destructive Hydration with Event Replay",
    category: "SSR & Hydration",
    readTimeMinutes: 24,
    overview: "Modern web applications demand near-instant initial render times and flawless SEO. Angular SSR compiles templates to static HTML on a Node.js server, while client-side Non-Destructive Hydration attaches interactivity without destroying DOM nodes. This masterclass inspects the CommonEngine lifecycle, TransferState caching, and the Angular 18 Event Replay dispatcher.",
    diagram: `+-------------------------------------------------------------------------+
|                  ANGULAR SSR & NON-DESTRUCTIVE HYDRATION                |
+-------------------------------------------------------------------------+
|                                                                         |
|  [SERVER EXECUTION (Node.js CommonEngine)]                              |
|  1. Incoming HTTP request hits Express / Node server.                   |
|  2. Angular bootstraps via provideServerRendering().                    |
|  3. Runs change detection; executes HTTP GET requests.                  |
|  4. TransferState serializes HTTP JSON into <script id="ng-state">.     |
|  5. Returns fully populated HTML to browser. (LCP / FCP instant!)       |
|                                                                         |
|-------------------------------------------------------------------------|
|                                                                         |
|  [BROWSER RECEPTION & HYDRATION]                                        |
|  1. User sees full content immediately (No blank screen!).              |
|  2. User clicks button BEFORE JS finishes downloading:                  |
|     - Event Replay script intercepts and queues the click!              |
|  3. Main JavaScript bundle finishes downloading:                        |
|     - provideClientHydration() walks the DOM nodes.                     |
|     - Re-uses existing DOM! Zero layout shift / zero flickering!        |
|     - TransferState intercepts HttpClient: 0 duplicate HTTP calls!      |
|  4. Event Replay flushes queued click into now-active component!        |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Evolution: Destructive vs Non-Destructive Hydration",
        explanation: "In legacy Angular Universal, when the browser received server-rendered HTML and client JS initialized, Angular wiped out the entire server-rendered DOM and recreated every node from scratch. This caused visible page flickering, destroyed focused inputs, and caused severe Cumulative Layout Shift (CLS). Angular's Non-Destructive Hydration walks the existing DOM tree, matching HTML elements to internal view structures and attaching event listeners directly in place.",
        codeExample: `// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    // Activates non-destructive hydration with Event Replay!
    provideClientHydration(withEventReplay())
  ]
};`
      },
      {
        subheading: "2. Event Replay: Eliminating the Uncanny Valley",
        explanation: "The 'Uncanny Valley' of SSR occurs between First Contentful Paint (when HTML appears on screen) and Time to Interactive (when JavaScript hydrates the page). If a user clicks an 'Add to Cart' button during this window, normal browsers discard the click because no event listeners are attached yet. Angular 18's `withEventReplay()` injects an ultra-light inline script into the server HTML. This script captures and queues user events, replaying them in exact chronological sequence once hydration finishes.",
        codeExample: `// Enabled seamlessly with:
provideClientHydration(withEventReplay());
// When user clicks a button before hydration finishes:
// 1. Captured by window.__jsaction dispatcher
// 2. Queued in memory
// 3. Hydration completes -> event replayed -> component handler triggers!`
      },
      {
        subheading: "3. TransferState & Eliminating Duplicate Network Requests",
        explanation: "During SSR, the server fetches data via HTTP to render the page. When the client hydrates, running the same component code would trigger the exact same HTTP request again, doubling server load and causing content flashes. Angular automatically integrates `TransferState` with `provideHttpClient()`. The server serializes GET responses into a `<script id=\"ng-state\">` tag. Upon hydration, client HTTP calls check this cache first and resolve immediately from memory.",
        codeExample: `@Component({
  selector: 'app-article',
  standalone: true,
  template: \`<h1>{{ article()?.title }}</h1>\`
})
export class ArticleComponent implements OnInit {
  private http = inject(HttpClient);
  article = signal<any>(null);

  ngOnInit() {
    // Handled automatically by TransferState!
    // Server fetches from API -> Client reads from transferred state!
    this.http.get('/api/article/1').subscribe(data => this.article.set(data));
  }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Accessing `window`, `localStorage`, or `document` directly on the server crashes Node.js with `ReferenceError`; guard with `isPlatformBrowser(platformId)`.",
      "Hydration mismatch error `NG0500` occurs when client HTML differs from server HTML (e.g. rendering `new Date().toLocaleTimeString()` or browser-only flags).",
      "Non-GET HTTP requests (POST/PUT) are not cached by TransferState to prevent storing transactional payloads."
    ],
    keyTakeaways: [
      "Non-destructive hydration preserves server-rendered DOM nodes, eliminating UI flickering and CLS.",
      "Event Replay captures clicks during page load and replays them after hydration completes.",
      "TransferState eliminates duplicate network requests between server and client."
    ]
  },
  {
    id: "angular-deep-10",
    title: "Dynamic Views & Content Projection: TemplateRef, ViewContainerRef & EmbeddedViews",
    category: "View Architecture",
    readTimeMinutes: 20,
    overview: "Angular's view engine distinguishes between Host Views (attached to components) and Embedded Views (instantiated from templates). This masterclass analyzes the mechanics of TemplateRef, ViewContainerRef, ViewChild queries, and multi-slot content projection.",
    diagram: `+-------------------------------------------------------------------------+
|                  ANGULAR DYNAMIC VIEW CREATION ENGINE                   |
+-------------------------------------------------------------------------+
|                                                                         |
|  <ng-template #itemTpl let-data="item">                                 |
|    <div class="custom-card">{{ data.title }}</div>                      |
|  </ng-template>                                                         |
|         |                                                               |
|         v (Referenced in TypeScript)                                    |
|  TemplateRef: Blueprint defining HTML structure and context variables   |
|         |                                                               |
|         | viewContainer.createEmbeddedView(itemTpl, { item: {...} })     |
|         v                                                               |
|  EmbeddedViewRef: Live instance in memory with change detection node    |
|         |                                                               |
|         v                                                               |
|  ViewContainerRef: Anchor DOM insertion point managing child views      |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. TemplateRef vs ViewContainerRef",
        explanation: "`TemplateRef<C>` represents a stamped-out blueprint of DOM elements declared inside an `<ng-template>`. It does not exist in the live DOM by itself. `ViewContainerRef` represents a container where one or more views can be attached. It acts as an anchor point in the DOM. Calling `vcr.createEmbeddedView(templateRef, context)` instantiates the template blueprint, binds its contextual variables, and inserts its real DOM nodes into the page.",
        codeExample: `@Component({
  selector: 'app-dynamic-renderer',
  standalone: true,
  template: \`
    <ng-template #myTpl let-msg="message">
      <div class="alert">{{ msg }}</div>
    </ng-template>
    <div #container></div>
  \`
})
export class DynamicRendererComponent implements AfterViewInit {
  private tpl = viewChild.required<TemplateRef<any>>('myTpl');
  private vcr = viewChild.required('container', { read: ViewContainerRef });

  ngAfterViewInit() {
    // Dynamically stamps out template into container:
    this.vcr().createEmbeddedView(this.tpl(), { message: 'Dynamic Alert Active!' });
  }
}`
      },
      {
        subheading: "2. Content Projection with ng-content & Selectors",
        explanation: "Content projection allows passing arbitrary child DOM or components from parent to child. Multi-slot projection uses `select` attributes matching CSS selectors (`select=\"[card-header]\"`). Projected content is instantiated in the parent's context and lifecycle, even if the child component hides or omits the `<ng-content>` slot. Angular 18 introduced fallback content inside `<ng-content>`, which renders if no matching projection is provided.",
        codeExample: `@Component({
  selector: 'app-panel',
  standalone: true,
  template: \`
    <div class="panel">
      <header>
        <ng-content select="[panel-header]">
          <h3>Default Title</h3> <!-- Fallback content in Angular 18+ -->
        </ng-content>
      </header>
      <main><ng-content /></main>
    </div>
  \`
})
export class PanelComponent {}`
      },
      {
        subheading: "3. Dynamic Component Instantiation",
        explanation: "In modern Angular, dynamically creating a component does not require `ComponentFactoryResolver` (which was deprecated in Ivy). You simply call `viewContainerRef.createComponent(MyComponent)`. You can pass environment injectors, customize bindings via `componentRef.setInput('prop', value)`, and listen to outputs via `componentRef.instance.event.subscribe()`.",
        codeExample: `export class ModalService {
  openModal<T>(componentType: Type<T>, vcr: ViewContainerRef) {
    const compRef = vcr.createComponent(componentType);
    compRef.setInput('isModal', true);
    return compRef;
  }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Projected content lifecycle hooks (`ngOnInit`) run regardless of whether the child component renders the `<ng-content>` tag.",
      "Failing to destroy dynamically created components (`compRef.destroy()`) causes detached DOM nodes and memory leaks.",
      "Accessing `TemplateRef` before `AfterViewInit` throws undefined errors because the view query hasn't resolved."
    ],
    keyTakeaways: [
      "TemplateRef is the in-memory blueprint; ViewContainerRef is the live DOM insertion point.",
      "Multi-slot content projection uses CSS selectors and supports default fallback content in Angular 18.",
      "Dynamic components are instantiated cleanly using vcr.createComponent(Type) without factory resolvers."
    ]
  },
  {
    id: "angular-deep-11",
    title: "Functional HTTP Client & Multi-Stage Interceptors Pipeline",
    category: "Networking & HTTP",
    readTimeMinutes: 20,
    overview: "Angular's modern HTTP client uses functional composition, immutable request cloning, and execution pipelines. This masterclass examines the onion-architecture execution of HttpInterceptorFn chains, mutex-based token refresh concurrency, and metadata propagation via HttpContext.",
    diagram: `+-------------------------------------------------------------------------+
|                  HTTP INTERCEPTOR PIPELINE (ONION ARCHITECTURE)         |
+-------------------------------------------------------------------------+
|                                                                         |
|  Outgoing Request:                                                      |
|  HttpClient.get('/api/data')                                            |
|         |                                                               |
|         v                                                               |
|  [Interceptor 1: Auth] ---> [Interceptor 2: Logging] ---> [HttpBackend] |
|  (req.clone with Token)     (starts timer)                (Fetch / XHR) |
|                                                                |        |
|                                                                v        |
|                                                           Network Call  |
|                                                                |        |
|  Incoming Response:                                            v        |
|  Component <-- [Interceptor 1: Auth] <-- [Interceptor 2: Log] <-- Response
|                (handles 401 retry)       (logs duration)                |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Onion Model & Execution Order",
        explanation: "HTTP Interceptors in Angular wrap each other in an onion-like layered middleware architecture. When an HTTP request is dispatched, it travels sequentially through Interceptor 1 -> Interceptor 2 -> Backend. When the HTTP response arrives, it flows in reverse order: Backend -> Interceptor 2 -> Interceptor 1 -> Component. Functional interceptors (`HttpInterceptorFn`) are registered as an array in `provideHttpClient(withInterceptors([first, second]))`.",
        codeExample: `export const loggingInterceptor: HttpInterceptorFn = (req, next) => {
  const start = performance.now();
  console.log(\`Outgoing: \${req.method} \${req.url}\`);

  return next(req).pipe(
    tap(event => {
      if (event.type === HttpEventType.Response) {
        console.log(\`Incoming: \${req.url} took \${(performance.now() - start).toFixed(0)}ms\`);
      }
    })
  );
};`
      },
      {
        subheading: "2. Immutable Requests & setHeaders",
        explanation: "Because an HTTP request may be retried or processed through multiple asynchronous pipelines, `HttpRequest` objects are strictly immutable. Mutating `req.headers` or `req.url` directly is prevented. To modify a request, call `req.clone({ setHeaders: { ... } })`. Using `setHeaders` merges specified headers safely without obliterating existing headers like `Content-Type`.",
        codeExample: `export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = inject(AuthService).token();
  if (!token) return next(req);

  // IMMUTABLE CLONE: Safely attaches bearer token
  const authReq = req.clone({
    setHeaders: { Authorization: \`Bearer \${token}\` }
  });
  return next(authReq);
};`
      },
      {
        subheading: "3. HttpContext: Type-Safe Internal Metadata",
        explanation: "Often an interceptor must know whether to apply specific behavior (e.g. skipping an auth header for public login endpoints, or suppressing global error alerts). In legacy Angular, developers attached dummy HTTP headers and stripped them. Modern Angular provides `HttpContext` and `HttpContextToken<T>`. Context tokens are strictly client-side and never leak over the network.",
        codeExample: `export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

export const smartAuthInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_AUTH)) {
    return next(req); // Bypass auth for this specific call!
  }
  // Attach auth token...
  return next(req);
};`
      }
    ],
    edgeCasesAndPitfalls: [
      "Using `headers: new HttpHeaders()` in `req.clone()` completely replaces all headers instead of merging; use `setHeaders` instead.",
      "Failing to catch errors in an interceptor causes uncaught Observable errors that break application event streams.",
      "Retrying failing requests without an exit condition can trigger infinite network request loops."
    ],
    keyTakeaways: [
      "Interceptors execute in an onion architecture: forward order on request, reverse order on response.",
      "HttpRequest is strictly immutable; use req.clone({ setHeaders }) for safe modification.",
      "HttpContext provides type-safe client-side metadata passing without polluting network headers."
    ]
  },
  {
    id: "angular-deep-12",
    title: "The Angular Ivy Compilation Pipeline: Template AST to Incremental DOM Instructions",
    category: "Compiler & Internals",
    readTimeMinutes: 24,
    overview: "Ivy is Angular's next-generation compilation and execution pipeline. Unlike traditional virtual DOM engines that generate intermediate trees, Ivy compiles HTML templates directly into specialized, tree-shakeable Incremental DOM instructions. This masterclass inspects Ahead-Of-Time (AOT) compilation, the ɵɵ instruction set, and memory efficiency.",
    diagram: `+-------------------------------------------------------------------------+
|                  IVY INCREMENTAL DOM COMPILATION PIPELINE               |
+-------------------------------------------------------------------------+
|                                                                         |
|  [COMPONENT TEMPLATE]                                                   |
|  <h1>{{ title }}</h1>                                                   |
|  <button (click)="onClick()">Click</button>                             |
|         |                                                               |
|         v (Angular AOT Compiler - ngc)                                  |
|  [INCREMENTAL DOM INSTRUCTION FUNCTION (ɵɵtemplate)]                    |
|                                                                         |
|  function Component_Template(rf, ctx) {                                 |
|    // 1. CREATION PHASE (rf & 1) - Runs ONCE on mount                   |
|    if (rf & 1) {                                                        |
|      ɵɵelementStart(0, "h1");                                           |
|      ɵɵtext(1);                                                         |
|      ɵɵelementEnd();                                                    |
|      ɵɵelementStart(2, "button");                                       |
|      ɵɵlistener("click", function() { return ctx.onClick(); });         |
|      ɵɵtext(3, "Click");                                                |
|      ɵɵelementEnd();                                                    |
|    }                                                                    |
|    // 2. UPDATE PHASE (rf & 2) - Runs on Change Detection               |
|    if (rf & 2) {                                                        |
|      ɵɵadvance(1);                                                      |
|      ɵɵtextInterpolate(ctx.title); // Updates text ONLY if changed!     |
|    }                                                                    |
|  }                                                                      |
|                                                                         |
|  ADVANTAGE: Zero Virtual DOM allocation! O(1) memory during updates!    |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Incremental DOM vs Virtual DOM",
        explanation: "Virtual DOM engines (like React) allocate an in-memory tree of JavaScript objects (`VNode`s) on every single render pass, diff the new tree against the old tree, and patch the DOM. In contrast, Ivy uses Incremental DOM: templates compile directly into imperative instructions that mutate the real DOM in-place without allocating intermediate virtual tree objects. If a template binding doesn't change, zero heap memory is allocated during that check cycle.",
        codeExample: `// Conceptual Ivy instruction comparison:
// React (Virtual DOM):
// return React.createElement('h1', null, title); // Allocates object every render!

// Angular Ivy (Incremental DOM):
// ɵɵtextInterpolate(ctx.title); // Mutates text node directly if changed; 0 allocations!`
      },
      {
        subheading: "2. The Render Flags Bitmask (rf & 1 vs rf & 2)",
        explanation: "Every Ivy template function takes two arguments: `rf` (Render Flags bitmask) and `ctx` (Component instance). `rf & 1` represents the Creation Phase: creating DOM elements, setting up static attributes, and registering event listeners. This block runs exactly once when the component mounts. `rf & 2` represents the Update Phase: evaluating dynamic expressions and updating changed bindings. This split allows Angular to execute change detection at maximum CPU cache locality without repeating setup logic.",
        codeExample: `// Ivy output structure:
function MyComponent_Template(rf, ctx) {
  if (rf & 1) {
    // Creation Mode (1): Create DOM nodes once
    ɵɵelementStart(0, "div", 0);
    ɵɵtext(1);
    ɵɵelementEnd();
  }
  if (rf & 2) {
    // Update Mode (2): Only check and update dynamic expressions
    ɵɵadvance(1);
    ɵɵtextInterpolate1("Welcome, ", ctx.username, "!");
  }
}`
      },
      {
        subheading: "3. Extreme Tree-Shakability",
        explanation: "Because templates compile into discrete instruction calls (`ɵɵelementStart`, `ɵɵtextInterpolate`, `ɵɵpipe`), any instruction that an application does not use is never referenced. If an application never uses Angular pipes, the pipe instruction code is omitted from the bundle. If it never uses content projection, the projection instructions are omitted. The bundler (esbuild) eliminates dead framework code automatically.",
        codeExample: `// Only the exact instructions required by your template are imported:
import { ɵɵelementStart, ɵɵtext, ɵɵelementEnd } from '@angular/core';`
      }
    ],
    edgeCasesAndPitfalls: [
      "Accessing internal `ɵ` (theta) APIs directly in application code is strictly unsupported and breaks between minor Angular releases.",
      "JIT (Just-In-Time) compilation requires shipping the heavy Angular compiler to the browser; production apps should always use AOT compilation.",
      "Dynamic HTML templates generated at runtime cannot be compiled by Ivy in production without custom runtime compilation setup."
    ],
    keyTakeaways: [
      "Ivy compiles templates into Incremental DOM instructions rather than virtual DOM trees, achieving O(1) memory overhead.",
      "The render flags bitmask separates DOM creation (rf & 1) from change detection updates (rf & 2).",
      "Template instructions are individually tree-shakeable, minimizing production bundle size."
    ]
  }
];

const outputPath = path.resolve(__dirname, '../data/angular.deep.json');
fs.writeFileSync(outputPath, JSON.stringify(deepDives, null, 2), 'utf-8');
console.log(`Successfully wrote ${deepDives.length} Deep Dive chapters to ${outputPath}`);
