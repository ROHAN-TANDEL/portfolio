const { createCard } = require('../angular_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 49,
    category: "Change Detection & Zoneless Architecture",
    concept: "Angular Change Detection Mechanics (Top-Down Traversal)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Angular's default Change Detection mechanism traverse and check the component tree?",
    quickAnswer: "In default mode (`Default`), Angular performs a unidirectional, depth-first top-down sweep starting from the root component down to every leaf component whenever an event or macro/microtask completes. Every bound template expression is evaluated against its previous value to determine if DOM updates are required.",
    detailedAnswer: "Angular constructs a view tree corresponding to the component hierarchy. In default change detection, Zone.js intercepts asynchronous events (clicks, timers, HTTP responses, promises) and triggers `ApplicationRef.tick()`. Angular then checks every active component in the entire tree from root to leaves. While highly predictable, in large enterprise applications with thousands of components, checking every binding on every microtask causes performance degradation, leading to the necessity of `OnPush` and Zoneless architectures.",
    code: `import { Component } from '@angular/core';

@Component({
  selector: 'app-default-card',
  standalone: true,
  template: \`
    <div>{{ calculateTotal() }}</div>
  \`
})
export class DefaultCardComponent {
  // CAUTION: In Default change detection, calculateTotal() runs
  // on EVERY single turn of change detection across the entire app!
  calculateTotal(): number {
    console.log('calculateTotal evaluated');
    return 100 * 1.2;
  }
}`,
    recallHint: "Default change detection checks the whole tree from root to leaf on every asynchronous event intercepted by Zone.js.",
    interviewTip: "Highlight that binding a function call directly in a template (e.g. `{{ calculateTotal() }}`) is an anti-pattern under default change detection because it runs on every cycle.",
    tags: ["change-detection", "zonejs", "performance", "architecture"],
    practice: [
      "Why does unidirectional data flow prevent infinite update loops during Angular's check cycle?",
      "What is the difference between template expression evaluation and DOM updating?"
    ]
  }),

  createCard({
    idNum: 50,
    category: "Change Detection & Zoneless Architecture",
    concept: "ChangeDetectionStrategy.OnPush Mechanics",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is `ChangeDetectionStrategy.OnPush`, and under what four conditions does an OnPush component re-check its template?",
    quickAnswer: "`ChangeDetectionStrategy.OnPush` informs Angular to skip checking a component and its sub-tree unless explicitly notified. An OnPush component will only be checked if: 1) An `@Input()` receives a new object reference, 2) An event handler inside the component or its children fires, 3) An `AsyncPipe` receives a new value, or 4) `ChangeDetectorRef.markForCheck()` is called manually (or a bound Signal emits).",
    detailedAnswer: "By default, every component is checked on every tick. `OnPush` turns off automatic checking, pruning entire branches of the view tree from the change detection cycle. This drastically reduces CPU overhead. However, it requires immutable state patterns: if an `@Input()` object is mutated in place without changing reference (`user.name = 'Bob'`), `OnPush` will NOT detect the change and the UI will fail to update.",
    code: `import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

interface User {
  id: string;
  name: string;
}

@Component({
  selector: 'app-user-row',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, // <-- Prunes check tree
  template: \`
    <div>{{ user.name }}</div>
    <button (click)="onAction()">Click</button> <!-- Event triggers check -->
  \`
})
export class UserRowComponent {
  @Input({ required: true }) user!: User;

  onAction() {
    // Firing an event listener in this component or children marks it dirty
    console.log('Action performed');
  }
}`,
    recallHint: "OnPush checks ONLY on: 1) Input ref change, 2) Child/Component event, 3) AsyncPipe / Signal emit, 4) markForCheck().",
    interviewTip: "State the 4 triggers verbatim in interviews. Mention that mutating properties directly on input objects without changing references fails silently under OnPush.",
    tags: ["onpush", "change-detection", "immutability", "performance"],
    practice: [
      "Why does mutating an array using `.push()` fail to trigger change detection in an OnPush child component?",
      "Does a service Observable subscription inside component TS automatically mark an OnPush component dirty without AsyncPipe?"
    ]
  }),

  createCard({
    idNum: 51,
    category: "Change Detection & Zoneless Architecture",
    concept: "ChangeDetectorRef API (markForCheck vs detectChanges)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the difference between `ChangeDetectorRef.markForCheck()` and `ChangeDetectorRef.detectChanges()`?",
    quickAnswer: "`markForCheck()` marks the current component and all its ancestors up to the root as dirty, scheduling them to be checked in the next regular change detection cycle. `detectChanges()` immediately triggers change detection synchronously for the current component and its children only, without scheduling an application-wide tick.",
    detailedAnswer: "In `ChangeDetectorRef`, `markForCheck()` does NOT run change detection right away; it sets the dirty flag so that when the next tick happens, this OnPush component won't be skipped. In contrast, `detectChanges()` runs immediately and synchronously down the component's subtree. `detectChanges()` can be dangerous if called during another ongoing change detection pass, causing `ExpressionChangedAfterItHasBeenCheckedError`. Other key methods: `detach()` (stops all checks for this view) and `reattach()` (reconnects to the check cycle).",
    code: `import { Component, ChangeDetectionStrategy, ChangeDetectorRef, OnInit, inject } from '@angular/core';
import { DataService } from './data.service';

@Component({
  selector: 'app-manual-check',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`<p>Status: {{ status }}</p>\`
})
export class ManualCheckComponent implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private dataService = inject(DataService);
  status = 'Idle';

  ngOnInit() {
    // External callback outside Angular's event zone
    this.dataService.onExternalNotification((newStatus) => {
      this.status = newStatus;
      // Mark component & ancestors dirty for the next tick
      this.cdr.markForCheck();

      // Or, if immediate synchronous UI flush is strictly required:
      // this.cdr.detectChanges();
    });
  }
}`,
    recallHint: "markForCheck(): flags path to root for NEXT cycle; detectChanges(): executes checks on this subtree IMMEDIATELY.",
    interviewTip: "Always prefer `markForCheck()` over `detectChanges()` in standard reactive code to avoid running redundant checks or triggering expression check violations.",
    tags: ["cdr", "markForCheck", "detectChanges", "change-detection"],
    practice: [
      "When would you use `cdr.detach()` and `cdr.reattach()` in a high-throughput real-time trading dashboard?",
      "What happens if you invoke `detectChanges()` inside `ngAfterViewInit()`?"
    ]
  }),

  createCard({
    idNum: 52,
    category: "Change Detection & Zoneless Architecture",
    concept: "Zone.js Architecture & Monkey-Patching",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Zone.js work internally, and why did Angular historically depend on it?",
    quickAnswer: "Zone.js monkey-patches browser asynchronous execution contexts (like `setTimeout`, `setInterval`, `Promise.then`, `addEventListener`, `XMLHttpRequest`) to track when asynchronous tasks start and complete. When the microtask queue empties (`onMicrotaskEmpty`), Zone.js notifies Angular to run `ApplicationRef.tick()`.",
    detailedAnswer: "JavaScript is single-threaded with an event loop. Standard JS has no native hook to know when 'all pending asynchronous tasks initiated by a click have finished'. Zone.js solves this by patching every asynchronous browser API with an execution context ('zone'). Angular provides `NgZone`, a specialized zone that wraps the browser. When code runs in `NgZone`, completing tasks emit `onMicrotaskEmpty`, prompting Angular to initiate change detection. While convenient, monkey-patching adds bundle size (~35-40kB), makes stack traces difficult to debug, and checks unnecessarily on irrelevant async events.",
    code: `import { Component, NgZone, inject } from '@angular/core';

@Component({
  selector: 'app-zone-demo',
  standalone: true,
  template: \`<button (click)="run()">Trigger</button>\`
})
export class ZoneDemoComponent {
  private ngZone = inject(NgZone);

  run() {
    // Under the hood, clicking this button triggers:
    // 1. Zone.js intercepts the click callback
    // 2. Zone.js detects an async task completed
    // 3. ngZone.onMicrotaskEmpty emits
    // 4. Angular executes ApplicationRef.tick()
  }
}`,
    recallHint: "Zone.js monkey-patches async APIs (timers, XHR, events) to notify Angular when the async queue empties.",
    interviewTip: "Explain that Zone.js is execution context tracking (similar to ThreadLocal in Java or AsyncLocalStorage in Node.js). Mention that Angular 18+ is transitioning towards Zoneless.",
    tags: ["zonejs", "ngzone", "architecture", "internals"],
    practice: [
      "Why does Zone.js cause stack traces in the browser console to be deeply nested with 'ZoneAwarePromise'?",
      "Can third-party libraries using async web APIs break Angular's Zone.js tracking?"
    ]
  }),

  createCard({
    idNum: 53,
    category: "Change Detection & Zoneless Architecture",
    concept: "NgZone.runOutsideAngular() for High-Frequency Events",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When and why should you use `NgZone.runOutsideAngular()`, and how do you bring state back into the zone?",
    quickAnswer: "Use `NgZone.runOutsideAngular()` for high-frequency events (such as `mousemove`, `scroll`, `canvas` rendering, or `requestAnimationFrame`) to prevent Zone.js from triggering full change detection on every single micro-event. When a meaningful state change occurs, use `ngZone.run()` to re-enter Angular's zone and update the UI.",
    detailedAnswer: "If an event listener like `window.addEventListener('mousemove', ...)` runs inside Angular's zone, Angular triggers change detection 60 to 120 times per second, degrading frame rates and freezing the UI. By running the registration callback inside `runOutsideAngular()`, Zone.js ignores those events completely. Once calculations reach a condition that requires UI updating, wrapping the assignment in `this.ngZone.run(() => { this.activeCoords = coords; })` re-triggers change detection safely.",
    code: `import { Component, ElementRef, OnInit, OnDestroy, inject, NgZone, viewChild } from '@angular/core';

@Component({
  selector: 'app-canvas-tracker',
  standalone: true,
  template: \`<div #box class="box">Current X: {{ currentX }}</div>\`
})
export class CanvasTrackerComponent implements OnInit, OnDestroy {
  private ngZone = inject(NgZone);
  private box = viewChild.required<ElementRef<HTMLDivElement>>('box');
  currentX = 0;
  private cleanup?: () => void;

  ngOnInit() {
    // 1. Run event listener outside Angular zone to avoid CD on every pixel!
    this.ngZone.runOutsideAngular(() => {
      const el = this.box().nativeElement;
      const handler = (e: MouseEvent) => {
        // High frequency animation logic
        el.style.transform = \`translateX(\${e.clientX}px)\`;

        if (e.clientX % 100 === 0) {
          // 2. Bring back into Angular zone only when UI template state needs updating
          this.ngZone.run(() => {
            this.currentX = e.clientX;
          });
        }
      };

      el.addEventListener('mousemove', handler);
      this.cleanup = () => el.removeEventListener('mousemove', handler);
    });
  }

  ngOnDestroy() {
    this.cleanup?.();
  }
}`,
    recallHint: "runOutsideAngular() skips CD on rapid events; ngZone.run() jumps back into Angular to sync the UI.",
    interviewTip: "This is a classic senior frontend question. Giving the mousemove/scroll/canvas example proves real-world performance optimization experience.",
    tags: ["ngzone", "runoutsideangular", "performance", "optimization"],
    practice: [
      "What is the performance difference between `(mousemove)=\"onMove($event)\"` in a template vs `addEventListener` in `runOutsideAngular()`?",
      "Can Angular Signals eliminate the need for `runOutsideAngular()`?"
    ]
  }),

  createCard({
    idNum: 54,
    category: "Change Detection & Zoneless Architecture",
    concept: "Experimental Zoneless Change Detection (`provideExperimentalZonelessChangeDetection`)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Zoneless Angular, how is it enabled in Angular 18+, and what triggers change detection without Zone.js?",
    quickAnswer: "Zoneless Angular removes `zone.js` entirely from the application bundle. It is enabled using `provideExperimentalZonelessChangeDetection()` in `app.config.ts`. Without Zone.js, change detection is driven by explicit reactivity: Signal updates, `markForCheck()`, `AsyncPipe` notifications, template event listeners, and `ComponentRef.setInput()`.",
    detailedAnswer: "In Angular 18+, Zoneless removes the ~35kB Zone.js overhead, delivers crystal-clear native browser stack traces, improves Core Web Vitals (INP/FCP), and works natively with web components and microfrontends. In Zoneless mode, Angular uses a lightweight scheduler: whenever an event listener fires, a Signal notifies consumers, or `markForCheck()` is called, Angular schedules a microtask to flush only dirty views rather than walking the entire global component tree.",
    code: `// app.config.ts
import { ApplicationConfig, provideExperimentalZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    // 1. Enable zoneless change detection
    provideExperimentalZonelessChangeDetection(),
    provideRouter(routes)
    // Note: 'zone.js' is removed from polyfills in angular.json!
  ]
};

// counter.component.ts
import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-zoneless-counter',
  standalone: true,
  template: \`
    <button (click)="count.update(c => c + 1)">Count: {{ count() }}</button>
  \`
})
export class ZonelessCounterComponent {
  // Signal updates notify the Zoneless scheduler automatically
  count = signal(0);
}`,
    recallHint: "provideExperimentalZonelessChangeDetection() drops Zone.js; updates are scheduled via Signals, events, and AsyncPipe.",
    interviewTip: "Highlight that in zoneless Angular, mutating raw class properties without Signals or `markForCheck()` will never update the view. Signals are the primary enabler of zoneless.",
    tags: ["zoneless", "signals", "angular18", "performance"],
    practice: [
      "What changes must be made to `angular.json` polyfills when switching an existing app to Zoneless?",
      "Why is Core Web Vitals Interaction to Next Paint (INP) significantly better in Zoneless Angular?"
    ]
  }),

  createCard({
    idNum: 55,
    category: "Change Detection & Zoneless Architecture",
    concept: "Fine-Grained Signal Notifications vs Tree Traversal",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Signal updates trigger view checks differently compared to traditional Zone.js tree traversal?",
    quickAnswer: "In Zone.js, an event triggers an application-wide top-down sweep checking all non-OnPush components. With Signals, reading a signal in a template registers that specific view consumer with the signal graph. When the signal changes, it directly marks that specific component view dirty for refresh, enabling fine-grained targeted updates.",
    detailedAnswer: "Traditional Angular change detection operates on entire component subtrees. Signals decouple change notification from top-down tree hierarchy: every template creates reactive reactive consumer nodes. When `mySignal.set(val)` executes, only the template blocks or components that specifically depend on `mySignal` are flagged for re-rendering. This eliminates wasteful checks across independent branches and enables near-instant UI synchronization.",
    code: `import { Component, signal, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-fine-grained',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <!-- Only this paragraph is invalidated when textSignal updates -->
    <p>{{ textSignal() }}</p>
    <!-- static content is never re-evaluated -->
    <div>Static Footer Notice</div>
  \`
})
export class FineGrainedComponent {
  textSignal = signal('Initial Message');

  updateMessage() {
    this.textSignal.set('Updated Message');
    // Angular's reactive graph marks this specific view node dirty.
  }
}`,
    recallHint: "Traditional: global top-down sweep. Signals: fine-grained dependency graph invalidating only consumer views.",
    interviewTip: "Explain that Signals bring Angular's reactivity model much closer to SolidJS or Svelte, paving the way for future sub-component template block updates without component-level re-checking.",
    tags: ["signals", "fine-grained", "change-detection", "reactivity"],
    practice: [
      "What is the difference between component-level dirty marking and template-level node invalidation?",
      "Why do Signals maintain glitch-free execution during concurrent updates?"
    ]
  }),

  createCard({
    idNum: 56,
    category: "Change Detection & Zoneless Architecture",
    concept: "ExpressionChangedAfterItHasBeenCheckedError",
    priority: "must-know",
    difficulty: "advanced",
    question: "What causes `NG0100: ExpressionChangedAfterItHasBeenCheckedError`, why is it exclusive to development mode, and how do you resolve it?",
    quickAnswer: "`NG0100` occurs when a template binding expression changes its value between the initial change detection verification pass and a second check pass in development mode. In dev mode, Angular runs a second pass immediately after the first to verify that no bindings mutated during rendering. It is resolved by: 1) Refactoring state mutations to proper lifecycle hooks (`ngOnInit`), 2) Using asynchronous scheduling (`queueMicrotask` or `setTimeout`), or 3) Using Signals.",
    detailedAnswer: "Angular enforces unidirectional data flow: parent to child. If child lifecycle hooks (`ngAfterViewInit`, `ngAfterContentInit`) mutate a property in a parent component or service that affects the parent's template during that same check cycle, the parent will display a value in the DOM that differs from the model in memory. In development mode, Angular runs a second pass (`checkNoChanges()`); if any value differs, `NG0100` is thrown. In production, this error is not thrown, but it causes UI state desynchronization.",
    code: `import { Component, AfterViewInit, signal, inject, ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-parent-error',
  standalone: true,
  template: \`
    <!-- Causes NG0100 if child mutates title in ngAfterViewInit -->
    <h1>{{ title }}</h1>
    <app-child (titleChange)="onTitleChange($event)" />
  \`
})
export class ParentComponent {
  title = 'Original';

  onTitleChange(newTitle: string) {
    // FIX 1: Use microtask queue if synchronous update is unavoidable
    queueMicrotask(() => {
      this.title = newTitle;
    });

    // FIX 2: Or better yet, derive state via Signals or pass inputs downward
  }
}`,
    recallHint: "NG0100 occurs when binding values change between 1st pass and dev-mode 2nd pass; fix with microtask or unidirectional design.",
    interviewTip: "Do not just suggest `setTimeout` as the fix in an interview. Senior candidates explain that `ExpressionChangedAfterItHasBeenCheckedError` indicates a flawed top-down architecture (child pushing state up during view rendering).",
    tags: ["ng0100", "lifecycle", "debugging", "architecture"],
    practice: [
      "Why is `ngAfterViewInit` the most common place where NG0100 is triggered?",
      "Why does Angular only run the second verification pass in development mode (`isDevMode()`)?"
    ]
  }),

  createCard({
    idNum: 57,
    category: "Change Detection & Zoneless Architecture",
    concept: "Immutability Patterns for OnPush Components",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why does mutable object/array modification break OnPush change detection, and how do you enforce immutability?",
    quickAnswer: "OnPush checks input changes using strict reference equality (`prevInput !== currInput`). If an object or array is modified in-place (e.g. `list.push(item)` or `user.name = 'New'`), the memory reference remains identical, so Angular assumes nothing changed and skips rendering. Immutability is enforced via spread operators, `toSorted`/`toReversed`, or libraries like Immer.",
    detailedAnswer: "Because checking every nested property of complex objects (deep comparison) would be computationally prohibitive (`O(N)` on every cycle), Angular relies on `===` reference equality. Creating a new reference (`[...list, item]` or `{ ...user, name: 'New' }`) allows Angular to detect the change in `O(1)` time.",
    code: `import { Component, ChangeDetectionStrategy, Input } from '@angular/core';

interface Todo {
  id: number;
  title: string;
}

@Component({
  selector: 'app-todo-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    @for (todo of todos; track todo.id) {
      <li>{{ todo.title }}</li>
    }
  \`
})
export class TodoListComponent {
  @Input({ required: true }) todos: Todo[] = [];
}

// In Parent Component:
export class ParentComponent {
  todos: Todo[] = [{ id: 1, title: 'Learn Angular' }];

  // WRONG: Reference does not change! OnPush child will NOT update!
  addTodoBroken(title: string) {
    this.todos.push({ id: 2, title });
  }

  // CORRECT: New array reference triggers OnPush check
  addTodoCorrect(title: string) {
    this.todos = [...this.todos, { id: 2, title }];
  }
}`,
    recallHint: "OnPush uses reference equality (===); in-place mutations don't change references, so spread or return new objects.",
    interviewTip: "Mention that modern TypeScript and ESLint can enforce `readonly Todo[]` on input interfaces to catch mutating methods (`.push()`, `.splice()`) at compile time.",
    tags: ["immutability", "onpush", "performance", "best-practices"],
    practice: [
      "How does TypeScript's `ReadonlyArray<T>` prevent developer errors in OnPush components?",
      "What is the cost tradeoff of allocating new object references vs deep object comparison?"
    ]
  }),

  createCard({
    idNum: 58,
    category: "Change Detection & Zoneless Architecture",
    concept: "AsyncPipe Change Detection Integration",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does `AsyncPipe` seamlessly bridge RxJS Observables with `OnPush` components without memory leaks?",
    quickAnswer: "`AsyncPipe` subscribes to an Observable, marks the host component dirty via `ChangeDetectorRef.markForCheck()` whenever a new value emits, yields the latest value to the template, and automatically unsubscribes when the component is destroyed. This prevents memory leaks and ensures OnPush components update.",
    detailedAnswer: "Manual subscriptions inside component TypeScript code require storing a `Subscription` reference and calling `.unsubscribe()` in `ngOnDestroy()` (or using `takeUntilDestroyed()`). Furthermore, a manual subscription does NOT notify OnPush components unless `cdr.markForCheck()` is called manually. `AsyncPipe` encapsulates all three tasks: subscription lifecycle management, unsubscription on teardown, and dirty marking on every emission.",
    code: `import { Component, ChangeDetectionStrategy, inject } from '@angular/core';
import { AsyncPipe } from '@angular/common';
import { Observable } from 'rxjs';
import { UserService, UserProfile } from './user.service';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [AsyncPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: \`
    <!-- AsyncPipe automatically marks this OnPush view dirty on emit -->
    @if (user$ | async; as user) {
      <h2>{{ user.name }}</h2>
      <p>{{ user.email }}</p>
    } @else {
      <p>Loading profile...</p>
    }
  \`
})
export class UserProfileComponent {
  private userService = inject(UserService);
  // Observable stream from service
  user$: Observable<UserProfile> = this.userService.getCurrentUser();
}`,
    recallHint: "AsyncPipe: subscribes, marks dirty (markForCheck), renders latest value, unsubscribes on destroy.",
    interviewTip: "Point out that `toSignal(user$)` is the modern alternative to `user$ | async` in Angular 16+, offering synchronous reads without pipe syntax.",
    tags: ["asyncpipe", "rxjs", "onpush", "memory-management"],
    practice: [
      "What happens if multiple `async` pipes are bound to the same cold Observable in a template?",
      "How does `shareReplay(1)` prevent duplicate HTTP requests when multiple async pipes are used?"
    ]
  }),

  createCard({
    idNum: 59,
    category: "Change Detection & Zoneless Architecture",
    concept: "ApplicationRef.tick() vs ChangeDetectorRef.detectChanges()",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the architectural distinction between `ApplicationRef.tick()` and `ChangeDetectorRef.detectChanges()`?",
    quickAnswer: "`ApplicationRef.tick()` runs a full, top-down change detection sweep across every root view in the entire application (including checking all dirty components). `ChangeDetectorRef.detectChanges()` executes change detection synchronously ONLY on the specific component and its sub-tree, ignoring the rest of the application.",
    detailedAnswer: "`ApplicationRef` is the platform-level orchestrator that connects the Angular component tree to the browser DOM. When Zone.js emits `onMicrotaskEmpty`, Angular calls `appRef.tick()`. `appRef.tick()` also runs the development-mode verification pass (`checkNoChanges()`). Conversely, `ChangeDetectorRef.detectChanges()` is a targeted local operation. It is useful in unit tests, isolated third-party library integrations, or when a child component must immediately reflect state before an animation frame.",
    code: `import { Component, ApplicationRef, ChangeDetectorRef, inject } from '@angular/core';

@Component({
  selector: 'app-tick-vs-detect',
  standalone: true,
  template: \`<button (click)="forceLocal()">Local Check</button>\`
})
export class TickVsDetectComponent {
  private appRef = inject(ApplicationRef);
  private cdr = inject(ChangeDetectorRef);

  forceLocal() {
    // 1. Checks ONLY this component and its children
    this.cdr.detectChanges();
  }

  forceGlobal() {
    // 2. Checks the ENTIRE Angular application (Root -> All leaves)
    this.appRef.tick();
  }
}`,
    recallHint: "ApplicationRef.tick() checks the entire application; ChangeDetectorRef.detectChanges() checks only this component and children.",
    interviewTip: "Never call `appRef.tick()` casually in business logic; doing so forces a full app-wide re-evaluation. Prefer local `cdr.markForCheck()` or Signals.",
    tags: ["applicationref", "cdr", "change-detection", "internals"],
    practice: [
      "Can calling `cdr.detectChanges()` inside a child component trigger `ExpressionChangedAfterItHasBeenCheckedError` in its parent?",
      "How does Angular test harness `TestBed.flushEffects()` interact with `appRef.tick()`?"
    ]
  }),

  createCard({
    idNum: 60,
    category: "Change Detection & Zoneless Architecture",
    concept: "Profiling Angular Change Detection & DevTools",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you profile change detection performance, identify unnecessary re-renders, and use Angular DevTools effectively?",
    quickAnswer: "Use Angular DevTools Profiler tab to record user interactions, inspect change detection duration, visualize component check bars, identify which components took the longest to check, and determine whether changes were triggered by Zone.js ticks, manual calls, or Signal invalidations.",
    detailedAnswer: "Angular DevTools provides a Flamegraph and Tree view showing exact millisecond durations for each component during every change detection cycle. Red/yellow bars highlight bottlenecks. Common causes of slow cycles: 1) Function invocations inside templates, 2) Missing `track` expressions in `@for`, 3) Large subtrees set to `Default` instead of `OnPush`, and 4) Event listeners firing outside `runOutsideAngular()`. Profiling should also measure Cumulative Layout Shift (CLS) and Interaction to Next Paint (INP).",
    code: `import { Component, ChangeDetectionStrategy, computed, signal } from '@angular/core';

@Component({
  selector: 'app-profiled-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush, // <-- Best practice: OnPush
  template: \`
    <div>Check Time Bottlenecks Eliminated</div>
    <!-- Avoid: {{ computeExpensiveMetric() }} -->
    <!-- Preferred: computed signal is cached and only evaluates on dependency change -->
    <p>Metric: {{ metric() }}</p>
  \`
})
export class ProfiledDashboardComponent {
  rawVal = signal(42);

  // Computed memoizes value: 0ms execution during irrelevant CD cycles
  metric = computed(() => {
    return this.rawVal() * 2.5;
  });
}`,
    recallHint: "Use Angular DevTools Profiler flamegraph to identify long check durations, missing OnPush, or function template bindings.",
    interviewTip: "Mention that Angular DevTools shows both Change Detection bar charts and the exact trigger reason (e.g. `Event: click`, `setTimeout`, or `Signal update`).",
    tags: ["profiling", "angular-devtools", "performance", "optimization"],
    practice: [
      "What is the difference between Change Detection time and DOM rendering time in DevTools?",
      "How do you identify which specific property or event triggered `ApplicationRef.tick()` in the DevTools timeline?"
    ]
  })
];
