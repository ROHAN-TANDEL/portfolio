const { createCard } = require('../angular_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 61,
    category: "Template Engine, Control Flow & Deferrable Views",
    concept: "Built-in Control Flow: @if, @else if, @else",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is Angular's built-in control flow (`@if`, `@else if`, `@else`), and why does it supersede `*ngIf`?",
    quickAnswer: "Introduced in Angular 17, built-in control flow uses native template syntax (`@if`, `@else if`, `@else`) built directly into the Angular compiler. It replaces `*ngIf` from `CommonModule`, requiring zero module imports, offering cleaner branch scoping, better type narrowing, and up to 90% faster template checking.",
    detailedAnswer: "Historically, conditional rendering required `*ngIf`, which relied on structural directives, `CommonModule`, micro-syntax parsing, and clumsy `ng-template` references (`*ngIf=\"cond; else otherTpl\"`). Built-in control flow (`@if`) is integrated into the Angular template compiler grammar. It provides first-class TypeScript type narrowing across `@else if` and `@else` branches, requires no `imports: [CommonModule]`, and simplifies template readability drastically.",
    code: `import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-auth-banner',
  standalone: true,
  template: \`
    <!-- Clean, native conditional rendering without CommonModule -->
    @if (role() === 'admin') {
      <div class="admin-panel">Welcome Superadmin</div>
    } @else if (role() === 'editor') {
      <div class="editor-panel">Welcome Editor</div>
    } @else {
      <div class="guest-panel">Please Sign In</div>
    }
  \`
})
export class AuthBannerComponent {
  role = signal<'admin' | 'editor' | 'guest'>('admin');
}`,
    recallHint: "@if / @else if / @else: native compiler syntax, no CommonModule, clean branches, superior type narrowing.",
    interviewTip: "Mention that Angular CLI provides an automated migration schematic (`ng g @angular/core:control-flow`) to convert legacy `*ngIf`, `*ngFor`, and `*ngSwitch` directives to modern control flow.",
    tags: ["control-flow", "at-if", "templates", "angular17"],
    practice: [
      "How does TypeScript type narrowing work inside `@if (user !== null)` compared to `*ngIf=\"user\"`?",
      "Can `@if` store aliased values like `@if (user$ | async; as user)`?"
    ]
  }),

  createCard({
    idNum: 62,
    category: "Template Engine, Control Flow & Deferrable Views",
    concept: "Built-in @for & Mandatory track Expression",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the built-in `@for` loop work, and why is the `track` expression mandatory?",
    quickAnswer: "The `@for` block iterates over arrays and iterables in templates with the syntax `@for (item of items; track item.id)`. The `track` expression is mandatory at compile-time to guarantee that Angular can uniquely identify DOM elements when items are added, removed, or reordered, preventing catastrophic DOM thrashing and performance degradation.",
    detailedAnswer: "With legacy `*ngFor`, the `trackBy` function was optional, and junior developers frequently omitted it. Without tracking, any array mutation caused Angular to destroy and recreate every DOM element in the list. With modern `@for`, `track` is enforced by the compiler. It accepts a unique expression (e.g. `item.id`, or `$index` for static immutable collections). The Angular compiler optimizes this track expression directly into internal view instructions, eliminating method call overhead.",
    code: `import { Component, signal } from '@angular/core';

interface Product {
  id: string;
  name: string;
  price: number;
}

@Component({
  selector: 'app-product-list',
  standalone: true,
  template: \`
    <ul>
      <!-- track is MANDATORY: prevents recreation of unchanged DOM nodes -->
      @for (product of products(); track product.id) {
        <li>{{ product.name }} - \${{ product.price }}</li>
      }
    </ul>
  \`
})
export class ProductListComponent {
  products = signal<Product[]>([
    { id: 'p1', name: 'MacBook Pro', price: 2499 },
    { id: 'p2', name: '4K Monitor', price: 699 }
  ]);
}`,
    recallHint: "@for (item of items; track item.id) - track is mandatory to preserve DOM node identity and focus.",
    interviewTip: "Emphasize that `track item.id` is an expression evaluated inline, unlike `*ngFor` which required defining a separate method on the component class `trackById(index, item)`.",
    tags: ["control-flow", "at-for", "track", "performance"],
    practice: [
      "When is it acceptable to use `track $index` instead of an entity ID?",
      "What happens to DOM focus and CSS input transitions if the track expression is unstable or omitted?"
    ]
  }),

  createCard({
    idNum: 63,
    category: "Template Engine, Control Flow & Deferrable Views",
    concept: "@for Context Variables & @empty Block",
    priority: "must-know",
    difficulty: "beginner",
    question: "What contextual variables are available in `@for`, and how does the `@empty` block simplify empty states?",
    quickAnswer: "`@for` provides contextual variables: `$index` (current item index), `$first` (boolean), `$last` (boolean), `$even` (boolean), `$odd` (boolean), and `$count` (total length). The companion `@empty` block renders automatically if the collection is empty or null, eliminating boilerplate outer `@if (items.length)` checks.",
    detailedAnswer: "In legacy templates, displaying an empty message required a sibling `*ngIf=\"items.length === 0\"` container. Built-in `@for` integrates this with `@empty { ... }`. Contextual variables can also be aliased for clarity: `@for (item of items; track item.id; let idx = $index, isLast = $last)`. If the array has zero items, the `@for` block immediately yields to the `@empty` block without creating loop DOM nodes.",
    code: `import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-orders',
  standalone: true,
  template: \`
    <div class="orders">
      @for (order of orders(); track order.id; let idx = $index; let count = $count) {
        <div [class.highlight]="idx === 0">
          Order #{{ idx + 1 }} of {{ count }}: {{ order.code }}
        </div>
      } @empty {
        <div class="no-records">
          <p>No orders found. Place your first order today!</p>
        </div>
      }
    </div>
  \`
})
export class OrdersComponent {
  orders = signal<{ id: string; code: string }[]>([]);
}`,
    recallHint: "Context variables: $index, $first, $last, $even, $odd, $count. Use @empty for zero-item fallback.",
    interviewTip: "Highlight that `@empty` runs when the iterable is empty, but NOT when the variable is null or undefined (in which case wrap in `@if` or ensure non-null iterable).",
    tags: ["at-for", "at-empty", "context-variables", "templates"],
    practice: [
      "How does `@empty` behave if the bound signal holds `null` vs `[]`?",
      "How do you style alternating table rows using `$even` or `$odd` in `@for`?"
    ]
  }),

  createCard({
    idNum: 64,
    category: "Template Engine, Control Flow & Deferrable Views",
    concept: "Built-in @switch, @case, and @default",
    priority: "must-know",
    difficulty: "beginner",
    question: "How does modern `@switch` control flow work, and how does it compare to the legacy `[ngSwitch]` directive?",
    quickAnswer: "`@switch (condition)` evaluates an expression and matches against `@case (value)` branches, falling back to `@default` if no match occurs. It requires no imports, eliminates container `ng-container` wrappers, and enforces strict branch exclusivity without fall-through.",
    detailedAnswer: "The legacy `[ngSwitch]` directive required three separate directives (`ngSwitch`, `*ngSwitchCase`, `*ngSwitchDefault`) imported from `CommonModule`. Modern `@switch` is a core compiler structure. Case expressions can be literals or dynamic expressions, and there is no fall-through (`break` is implicit).",
    code: `import { Component, signal } from '@angular/core';

type Tab = 'overview' | 'settings' | 'billing';

@Component({
  selector: 'app-dashboard-tabs',
  standalone: true,
  template: \`
    <nav>
      <button (click)="activeTab.set('overview')">Overview</button>
      <button (click)="activeTab.set('settings')">Settings</button>
      <button (click)="activeTab.set('billing')">Billing</button>
    </nav>

    <main>
      @switch (activeTab()) {
        @case ('overview') {
          <section>Overview Dashboard Content</section>
        }
        @case ('settings') {
          <section>User Profile & Security Settings</section>
        }
        @case ('billing') {
          <section>Invoices & Payment Methods</section>
        }
        @default {
          <section>Select a valid tab from navigation</section>
        }
      }
    </main>
  \`
})
export class DashboardTabsComponent {
  activeTab = signal<Tab>('overview');
}`,
    recallHint: "@switch (expr) { @case (val) {} @default {} } - implicit break, no imports, clean compiler structure.",
    interviewTip: "Emphasize that `@case` expressions are checked with strict equality (`===`) and do not have fall-through behavior like C-style switch statements.",
    tags: ["control-flow", "at-switch", "templates", "angular17"],
    practice: [
      "Can `@case` evaluate an expression or function call rather than a string literal?",
      "How do you handle multiple matches in `@switch`?"
    ]
  }),

  createCard({
    idNum: 65,
    category: "Template Engine, Control Flow & Deferrable Views",
    concept: "Deferrable Views (@defer) Core Architecture",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are Deferrable Views (`@defer`), and how does Angular achieve automatic code splitting at the template level?",
    quickAnswer: "`@defer` is a compiler feature introduced in Angular 17 that enables declarative, template-level lazy loading. Any standalone component, directive, or pipe used exclusively inside a `@defer` block is automatically split into a separate JavaScript bundle chunk by the build tool and loaded on-demand when the defer trigger activates.",
    detailedAnswer: "Traditionally, lazy loading in Angular was only possible at route boundaries via `loadComponent` or `loadChildren`. `@defer` brings lazy loading directly into templates. If a heavyweight chart component or rich text editor is wrapped in `@defer`, Angular's build pipeline (esbuild/Vite) creates an asynchronous dynamic import chunk. The initial bundle size stays small, directly improving Initial Page Load and Largest Contentful Paint (LCP). Crucially, the deferred component must be standalone and not referenced outside `@defer` in that template.",
    code: `import { Component } from '@angular/core';
// HeavyChartComponent is standalone and only used inside @defer
import { HeavyChartComponent } from './heavy-chart.component';

@Component({
  selector: 'app-analytics-view',
  standalone: true,
  imports: [HeavyChartComponent],
  template: \`
    <h1>Performance Dashboard</h1>

    <!-- Angular compiler automatically extracts HeavyChart into a lazy chunk -->
    @defer (on viewport) {
      <app-heavy-chart [data]="chartData" />
    } @placeholder {
      <div class="chart-skeleton">Chart will appear when scrolled into view</div>
    } @loading (minimum 300ms) {
      <div class="spinner">Loading visualization bundle...</div>
    } @error {
      <div class="error">Failed to load chart bundle.</div>
    }
  \`
})
export class AnalyticsViewComponent {
  chartData = [10, 25, 40, 85];
}`,
    recallHint: "@defer enables template-level code splitting into separate JS chunks, loaded only when triggers fire.",
    interviewTip: "Ensure you mention that the deferred component MUST be standalone and cannot be imported/referenced in eager template sections, otherwise esbuild will bundle it into the main chunk.",
    tags: ["defer", "code-splitting", "lazy-loading", "performance"],
    practice: [
      "What happens if a component inside `@defer` is also referenced in the same template outside `@defer`?",
      "How does `@defer` improve Core Web Vitals (FCP, LCP, INP)?"
    ]
  }),

  createCard({
    idNum: 66,
    category: "Template Engine, Control Flow & Deferrable Views",
    concept: "@defer Viewport Trigger (on viewport)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does `@defer (on viewport)` work internally, and why does it require a placeholder element?",
    quickAnswer: "`@defer (on viewport)` uses the browser's `IntersectionObserver` API to monitor when a specified DOM element enters the visible viewport. It requires an element (usually the `@placeholder` content or an explicit template reference `#trigger`) so the browser has a physical target to observe.",
    detailedAnswer: "When Angular compiles `@defer (on viewport)`, it attaches an `IntersectionObserver` to the `@placeholder` element. As soon as the user scrolls and the placeholder crosses the viewport threshold, the observer callback triggers a dynamic `import()` for the lazy chunk. Once the JavaScript bundle loads, Angular swaps the placeholder DOM node with the actual component. You can also specify an external element reference: `@defer (on viewport(myButton))`.",
    code: `import { Component } from '@angular/core';
import { CustomerCommentsComponent } from './customer-comments.component';

@Component({
  selector: 'app-blog-article',
  standalone: true,
  imports: [CustomerCommentsComponent],
  template: \`
    <article>
      <h2>Deep Architectural Review</h2>
      <p>Long article content goes here...</p>
    </article>

    <!-- Comments bundle only downloads when user scrolls down to this placeholder -->
    @defer (on viewport) {
      <app-customer-comments />
    } @placeholder {
      <!-- Essential: placeholder provides physical bounding box for IntersectionObserver -->
      <div style="min-height: 200px; background: #f0f0f0;">
        Scroll down to load comments...
      </div>
    }
  \`
})
export class BlogArticleComponent {}`,
    recallHint: "on viewport uses IntersectionObserver on @placeholder to fetch the lazy chunk when scrolled into view.",
    interviewTip: "Always give the `@placeholder` a minimum height (`min-height`) in CSS so that IntersectionObserver triggers reliably and prevents content jumping.",
    tags: ["defer", "viewport", "intersectionobserver", "lazy-loading"],
    practice: [
      "What happens if the `@placeholder` has zero height (`0px`)?",
      "How do you target a different external DOM element as the viewport trigger using `on viewport(targetRef)`?"
    ]
  }),

  createCard({
    idNum: 67,
    category: "Template Engine, Control Flow & Deferrable Views",
    concept: "@defer Interaction, Hover, and Idle Triggers",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the differences between `@defer (on idle)`, `@defer (on interaction)`, and `@defer (on hover)`?",
    quickAnswer: "`on idle` downloads and renders when the browser thread is idle (`requestIdleCallback`). `on interaction` triggers when the user clicks, focuses, or types into the trigger element. `on hover` triggers when the mouse enters the trigger element (`mouseenter` or `focusin`).",
    detailedAnswer: "Angular provides standard declarative triggers for deferral: 1) `on idle`: default trigger if none specified; loads lazily when CPU is not busy. 2) `on interaction`: user intent indicator; waits until a click or keydown occurs on the placeholder or referenced element. 3) `on hover`: anticipation trigger; preloads or renders when the user hovers over a preview button before clicking.",
    code: `import { Component } from '@angular/core';
import { UserFlyoutMenuComponent } from './user-flyout-menu.component';
import { RichEditorComponent } from './rich-editor.component';

@Component({
  selector: 'app-interactive-triggers',
  standalone: true,
  imports: [UserFlyoutMenuComponent, RichEditorComponent],
  template: \`
    <!-- 1. on hover: fetches and renders when user hovers over the button -->
    <button #profileBtn>User Profile</button>
    @defer (on hover(profileBtn)) {
      <app-user-flyout-menu />
    }

    <!-- 2. on interaction: downloads when user clicks into the placeholder box -->
    @defer (on interaction) {
      <app-rich-editor />
    } @placeholder {
      <div class="fake-input">Click here to write a comment...</div>
    }
  \`
})
export class InteractiveTriggersComponent {}`,
    recallHint: "on idle: requestIdleCallback; on interaction: click/keydown; on hover: mouseenter/focusin.",
    interviewTip: "Note that `on hover` is an excellent prefetch trigger: download the bundle when hovered, then render when clicked.",
    tags: ["defer", "triggers", "interaction", "hover"],
    practice: [
      "Can multiple triggers be combined using comma separation, e.g. `@defer (on viewport; on timer(5s))`?",
      "How does `on interaction` handle keyboard accessibility for screen reader users?"
    ]
  }),

  createCard({
    idNum: 68,
    category: "Template Engine, Control Flow & Deferrable Views",
    concept: "@defer Timer & Programmatic Condition Triggers",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do `on timer` and `when condition` triggers work in `@defer`, and can they be combined?",
    quickAnswer: "`on timer(duration)` loads the deferred chunk after a specified time delay (e.g. `500ms`, `5s`). `when condition` is an imperative boolean expression (such as a Signal `when isDataReady()`). When the condition becomes truthy, the chunk is fetched and rendered. They can be combined using semicolons or OR logic.",
    detailedAnswer: "`on` triggers represent browser events (viewport, interaction, hover, idle, timer), whereas `when` triggers represent application state expressions. Once a `when` condition evaluates to true, the defer block loads and stays loaded (it never unloads if the condition returns to false). If both `on` and `when` are declared, the block will trigger if ANY condition is met.",
    code: `import { Component, signal } from '@angular/core';
import { PromoModalComponent } from './promo-modal.component';

@Component({
  selector: 'app-timed-promo',
  standalone: true,
  imports: [PromoModalComponent],
  template: \`
    <!-- Triggers either after 10 seconds OR when user clicks a button -->
    @defer (on timer(10s); when showModal()) {
      <app-promo-modal />
    } @placeholder {
      <div>Promo ready...</div>
    }

    <button (click)="showModal.set(true)">Show Promo Now</button>
  \`
})
export class TimedPromoComponent {
  showModal = signal(false);
}`,
    recallHint: "on timer(duration): time delay; when condition: reactive boolean; defer never unloads once rendered.",
    interviewTip: "Make sure to emphasize that `@defer` is one-way: once loaded and swapped in, setting the `when` condition back to `false` does NOT unload the component. Use `@if` inside `@defer` if conditional destruction is needed.",
    tags: ["defer", "timer", "when-condition", "lazy-loading"],
    practice: [
      "Why does setting `when isVisible()` to false not destroy the deferred component?",
      "What is the difference between `@if (show) { @defer ... }` vs `@defer (when show) { ... }`?"
    ]
  }),

  createCard({
    idNum: 69,
    category: "Template Engine, Control Flow & Deferrable Views",
    concept: "@defer Sub-Blocks: @placeholder, @loading, @error",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the roles of `@placeholder`, `@loading`, and `@error` in a `@defer` block, and how do timers prevent UI flickering?",
    quickAnswer: "`@placeholder` displays initial content before deferral triggers. `@loading` displays while the lazy JavaScript bundle is being fetched. `@error` displays if chunk download fails (e.g. network error). `@loading` supports `minimum` and `after` timer parameters to eliminate jarring UI flicker.",
    detailedAnswer: "Fast networks can cause loading spinners to flash for 50ms, causing poor user experience. Angular solves this with parameters: `@loading (after 100ms; minimum 500ms)`. `after 100ms` means: 'Do not show the loading spinner unless fetching takes longer than 100ms'. `minimum 500ms` means: 'If the spinner appears, keep it visible for at least 500ms so the UI does not flicker'. `@placeholder` also supports `(minimum 200ms)`.",
    code: `import { Component } from '@angular/core';
import { LargeDataGridComponent } from './data-grid.component';

@Component({
  selector: 'app-grid-view',
  standalone: true,
  imports: [LargeDataGridComponent],
  template: \`
    @defer (on interaction) {
      <app-large-data-grid />
    } @placeholder (minimum 300ms) {
      <button class="launch-btn">Click to load Grid</button>
    } @loading (after 150ms; minimum 400ms) {
      <!-- Only shows if fetch > 150ms; stays at least 400ms -->
      <div class="progress-bar">Loading data table bundle...</div>
    } @error {
      <div class="alert-box">
        Network error loading table. Please check connection.
      </div>
    }
  \`
})
export class GridViewComponent {}`,
    recallHint: "@loading (after Xms; minimum Yms) prevents UI flicker. @placeholder holds space; @error catches chunk failure.",
    interviewTip: "Explain `after` and `minimum` timers on `@loading` in interviews—it demonstrates deep mastery of modern UX and Core Web Vitals optimization.",
    tags: ["defer", "loading-state", "ux", "flicker-prevention"],
    practice: [
      "What happens if `@placeholder` is omitted from an `@defer (on viewport)` block?",
      "How do you simulate a failed `@defer` chunk loading in testing?"
    ]
  }),

  createCard({
    idNum: 70,
    category: "Template Engine, Control Flow & Deferrable Views",
    concept: "@defer Prefetching Strategies",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does prefetching work in `@defer`, and how does decoupling prefetching from rendering optimize user experience?",
    quickAnswer: "Prefetching downloads the JavaScript bundle chunk in advance without rendering it into the DOM until the render trigger fires. Syntax: `@defer (on interaction; prefetch on idle)` or `@defer (on interaction; prefetch on hover)`. This yields instantaneous 0ms rendering when the user interacts.",
    detailedAnswer: "In standard deferral, when the user clicks an element, they must wait for network latency while the chunk downloads before seeing the UI. By separating the prefetch trigger from the render trigger, the browser preloads the script in the background (e.g. during browser idle time or when the user hovers over the button). When the user actually clicks (`on interaction`), the JavaScript is already in browser cache, resulting in instant rendering with zero delay.",
    code: `import { Component } from '@angular/core';
import { CheckoutModalComponent } from './checkout-modal.component';

@Component({
  selector: 'app-storefront',
  standalone: true,
  imports: [CheckoutModalComponent],
  template: \`
    <button #payBtn class="checkout-btn">Proceed to Checkout</button>

    <!-- Prefetches when hovered; renders only when clicked! -->
    @defer (on interaction(payBtn); prefetch on hover(payBtn)) {
      <app-checkout-modal />
    } @placeholder {
      <p>Secure checkout powered by Stripe</p>
    }
  \`
})
export class StorefrontComponent {}`,
    recallHint: "prefetch on hover/idle downloads the chunk early; on interaction renders it instantly with zero lag.",
    interviewTip: "The pattern `@defer (on interaction(btn); prefetch on hover(btn))` is the gold standard for modals and dialogs in high-performance enterprise applications.",
    tags: ["defer", "prefetch", "performance", "optimization"],
    practice: [
      "What is the difference between `prefetch on idle` vs `prefetch on viewport` for offscreen widgets?",
      "Does prefetching waste user mobile data if they never trigger rendering?"
    ]
  }),

  createCard({
    idNum: 71,
    category: "Template Engine, Control Flow & Deferrable Views",
    concept: "Content Projection & Multi-Slot `<ng-content>`",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is Content Projection in Angular, how does multi-slot projection work with `select`, and what is fallback content?",
    quickAnswer: "Content projection allows a parent component to inject arbitrary HTML or components into a child component's template via `<ng-content>`. Multi-slot projection uses the `select` attribute with CSS selectors (`select=\"[card-header]\"`, `select=\".actions\"`). Angular 18 introduced fallback content inside `<ng-content>Fallback</ng-content>`.",
    detailedAnswer: "Content projection is Angular's equivalent to React's `children` or Vue's `slots`. The child template defines insertion points using `<ng-content>`. When using multi-slot projection, Angular matches elements using CSS element, class, or attribute selectors. Any projected content without a match falls into a default `<ng-content>` slot (without `select`). Angular 18 added default/fallback content that renders if no content is projected into that slot.",
    code: `import { Component } from '@angular/core';

// Child Component:
@Component({
  selector: 'app-card',
  standalone: true,
  template: \`
    <div class="card-container">
      <header class="header">
        <ng-content select="[card-header]">
          <!-- Fallback content (Angular 18+) -->
          <h3>Default Header Title</h3>
        </ng-content>
      </header>

      <div class="body">
        <!-- Default slot captures all unselected content -->
        <ng-content />
      </div>

      <footer class="footer">
        <ng-content select="[card-footer]" />
      </footer>
    </div>
  \`
})
export class CardComponent {}

// Parent Usage:
@Component({
  selector: 'app-parent',
  standalone: true,
  imports: [CardComponent],
  template: \`
    <app-card>
      <h2 card-header>Custom Audit Log</h2>
      <p>Body paragraph projected into default slot.</p>
      <button card-footer>Close</button>
    </app-card>
  \`
})
export class ParentComponent {}`,
    recallHint: "<ng-content select=\"[slot-name]\">: multi-slot projection. Angular 18 allows default fallback inside tags.",
    interviewTip: "Note that projected content lifecycle hooks (`ngAfterContentInit`) execute in the host component context, not the child component.",
    tags: ["content-projection", "ng-content", "slots", "components"],
    practice: [
      "Can a component project content into another projected component recursively?",
      "Why does projected content get instantiated even if the child component hides the `<ng-content>` with `@if`?"
    ]
  }),

  createCard({
    idNum: 72,
    category: "Template Engine, Control Flow & Deferrable Views",
    concept: "View Encapsulation Modes (Emulated, None, ShadowDom)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the three `ViewEncapsulation` modes in Angular, and how does `Emulated` achieve CSS scoping without native Shadow DOM?",
    quickAnswer: "The three modes are: 1) `ViewEncapsulation.Emulated` (default): Angular rewrites CSS selectors by appending unique host/content attributes (`_ngcontent-ng-c123`) to isolate styles. 2) `ViewEncapsulation.None`: Styles are injected globally. 3) `ViewEncapsulation.ShadowDom`: Uses the browser's native Shadow DOM boundary.",
    detailedAnswer: "In `Emulated` mode, Angular gives each component a unique generated attribute. At compile time, the component's CSS selectors are transformed (e.g. `p` becomes `p[_ngcontent-c1]`). This prevents child component styles from leaking into parents and vice-versa, without the performance overhead or styling barriers of native Shadow DOM. `ViewEncapsulation.None` makes styles global (common for theme wrappers). `ShadowDom` creates true browser-level encapsulation with isolated DOM trees.",
    code: `import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-scoped-badge',
  standalone: true,
  encapsulation: ViewEncapsulation.Emulated, // <-- Default
  styles: [\`
    .badge {
      background: #007bff;
      color: white;
      padding: 4px 8px;
    }
    /* Targets host element */
    :host {
      display: inline-block;
    }
    /* Targets host when conditional class active */
    :host(.active) {
      border: 2px solid green;
    }
  \`],
  template: \`<span class="badge">Active Status</span>\`
})
export class ScopedBadgeComponent {}`,
    recallHint: "Emulated (default): adds unique attribute tags to CSS. None: global CSS. ShadowDom: native browser shadow root.",
    interviewTip: "Explain `:host` and `:host-context()` pseudo-class selectors used with Emulated encapsulation to style the component root element from within its own CSS.",
    tags: ["encapsulation", "css", "shadowdom", "styling"],
    practice: [
      "How do you style a projected child element from the parent component using `:host ::ng-deep` or modern alternatives?",
      "Why is `::ng-deep` deprecated and what are modern alternatives for theming third-party components?"
    ]
  })
];
