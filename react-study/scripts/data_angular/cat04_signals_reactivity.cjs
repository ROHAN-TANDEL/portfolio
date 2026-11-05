const { createCard } = require('../angular_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 37,
    category: "Angular Signals Engine & Reactivity",
    concept: "Angular Signals Core Paradigm (signal, set, update)",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is an Angular Signal, and how do `set()` and `update()` mutate writable signals?",
    quickAnswer: "A Signal is a reactive wrapper around a value that notifies interested consumers when that value changes. A writable signal is created with `signal(initialVal)`. Read it by calling it as a function `count()`. Mutate it using `set(newVal)` for replacement or `update(fn)` for deriving from previous value.",
    detailedAnswer: "Introduced in Angular 16, Signals represent fine-grained reactive primitives that form the backbone of modern Angular reactivity. Unlike Observables (which represent asynchronous streams over time requiring subscriptions), a Signal always has a synchronous, current value. Because reading a signal tracks dependencies automatically in reactive contexts, Signals eliminate complex RxJS operators for standard synchronous UI state.",
    code: `import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-counter',
  standalone: true,
  template: \`
    <button (click)="increment()">Increment</button>
    <button (click)="reset()">Reset</button>
    <p>Count: {{ count() }}</p>
  \`
})
export class CounterComponent {
  // 1. Create writable signal:
  count = signal<number>(0);

  increment() {
    // 2. update(): derives next state from previous state
    this.count.update(c => c + 1);
  }

  reset() {
    // 3. set(): replaces value directly
    this.count.set(0);
  }
}`,
    recallHint: "signal(val) creates signal; count() reads value; set(val) overwrites; update(fn) computes next from prev.",
    interviewTip: "Emphasize that reading a signal is always synchronous (`mySignal()`). There is no subscription, no `.pipe()`, and no unsubscription cleanup needed.",
    tags: ["signals", "reactivity", "angular16", "state"],
    practice: [
      "Why is reading a signal invoked as a function call (`count()`) instead of a raw property access?",
      "Can a signal hold an object or array, and how do you update properties immutably?"
    ]
  }),

  createCard({
    idNum: 38,
    category: "Angular Signals Engine & Reactivity",
    concept: "Computed Signals & Glitch-Free Reactivity",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do `computed()` signals work, and what makes them 'glitch-free' and lazily evaluated?",
    quickAnswer: "`computed(() => ...)` defines a read-only derived signal that automatically tracks whichever signals are read inside its derivation function. It is lazily evaluated (recalculates only when read) and memoized (returns cached value if dependencies haven't changed). 'Glitch-free' means intermediate inconsistent states are never observable.",
    detailedAnswer: "In traditional reactive streams, combining multiple diamond dependencies can cause 'glitches' (temporary invalid calculations before all branches resolve). Angular Signals use a Push-Pull reactivity graph algorithm: when a source signal mutates, it 'pushes' a dirty flag to downstream computed signals. The computed signal does not run immediately; it 'pulls' and recomputes the new value *only* when something actually reads it. If its inputs haven't changed, it returns the cached result in $O(1)$ time.",
    code: `import { Component, signal, computed } from '@angular/core';

@Component({
  selector: 'app-cart-total',
  standalone: true,
  template: \`
    <p>Items: {{ totalItems() }}</p>
    <p>Grand Total: \${{ grandTotal() }}</p>
  \`
})
export class CartTotalComponent {
  price = signal(100);
  quantity = signal(2);
  discountRate = signal(0.1); // 10% discount

  // Dynamically tracks price and quantity!
  subtotal = computed(() => this.price() * this.quantity());

  // Dynamically tracks subtotal and discountRate! Glitch-free!
  grandTotal = computed(() => this.subtotal() * (1 - this.discountRate()));
  totalItems = computed(() => this.quantity());
}`,
    recallHint: "computed(() => ...) is lazy (runs on read), memoized (caches result), and glitch-free (zero temporary invalid states).",
    interviewTip: "Point out that `computed` signals are read-only: you cannot call `.set()` on a computed signal. Furthermore, computed signals must be pure and free of side effects.",
    tags: ["computed", "signals", "glitch-free", "derived-state"],
    practice: [
      "What happens if you try to mutate a signal or call `set()` inside a `computed()` function?",
      "How does dynamic dependency tracking work when a computed signal has conditional `if` branches?"
    ]
  }),

  createCard({
    idNum: 39,
    category: "Angular Signals Engine & Reactivity",
    concept: "Signal Effects (effect) & onCleanup",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is `effect()` in Angular Signals, when does it execute, and how do you handle side-effect teardown using `onCleanup`?",
    quickAnswer: "`effect()` runs side-effect operations whenever any signal read inside its body changes value. It executes asynchronously during microtask scheduling. `onCleanup(fn)` registers a teardown function that runs before the effect re-executes and when the enclosing context destroys.",
    detailedAnswer: "While `computed` is for pure derivations, `effect` is for imperative side effects: logging, syncing with `localStorage`, or drawing to an HTML5 canvas. Effects must be instantiated in an Injection Context (constructor or property initializer). If an effect sets up a timer, event listener, or network subscription, passing `onCleanup((fn) => ...)` cleans up the resource before the next execution, preventing memory leaks.",
    code: `import { Component, signal, effect } from '@angular/core';

@Component({
  selector: 'app-analytics-tracker',
  standalone: true,
  template: \`<button (click)="trackClick()">Click Count: {{ count() }}</button>\`
})
export class AnalyticsTrackerComponent {
  count = signal(0);

  constructor() {
    // Effect tracks 'count' signal automatically:
    effect((onCleanup) => {
      const currentCount = this.count();
      console.log('Sending analytics ping for count:', currentCount);

      const timerId = setTimeout(() => {
        // Simulating debounced analytics sync
      }, 500);

      // Cleanup function runs before effect runs again and on unmount:
      onCleanup(() => {
        clearTimeout(timerId);
      });
    });
  }

  trackClick() {
    this.count.update(c => c + 1);
  }
}`,
    recallHint: "effect(() => ...) runs side effects on signal change; onCleanup(() => ...) handles teardown before next run.",
    interviewTip: "Warn against mutating signals inside an `effect()`: setting a signal inside an effect is forbidden by default and requires `{ allowSignalWrites: true }`, because it easily causes infinite re-render loops.",
    tags: ["effect", "onCleanup", "side-effects", "signals"],
    practice: [
      "Why does Angular forbid signal mutations inside `effect()` by default without allowSignalWrites?",
      "Why must `effect()` be created within an injection context?"
    ]
  }),

  createCard({
    idNum: 40,
    category: "Angular Signals Engine & Reactivity",
    concept: "untracked() in Effects to Prevent Infinite Loops",
    priority: "must-know",
    difficulty: "advanced",
    question: "What problem does `untracked()` solve inside Angular Signal `effect()` and `computed()` blocks?",
    quickAnswer: "`untracked(() => signal())` reads a signal's current value *without* registering that signal as a reactive dependency. This prevents the effect or computed signal from re-running when that specific signal mutates.",
    detailedAnswer: "In an `effect()`, reading any signal registers it as a dependency. If an effect needs to log `currentUser()` whenever `pageViews()` changes—but should NOT re-run just because `currentUser()` updated its avatar—reading `untracked(() => this.currentUser())` decouples it. Crucially, if you write to a signal that you also read, wrapping the read in `untracked` prevents infinite execution cycles.",
    code: `import { Component, signal, effect, untracked } from '@angular/core';

@Component({ selector: 'app-logger', standalone: true, template: \`<p>Logger Active</p>\` })
export class LoggerComponent {
  metric = signal(0);
  environment = signal('production');

  constructor() {
    effect(() => {
      // 1. Reactive dependency: Effect re-runs whenever 'metric' changes:
      const val = this.metric();

      // 2. Non-reactive read: Reading 'environment' will NOT re-trigger this effect!
      const env = untracked(() => this.environment());

      console.log(\`[Metric Alert (\${env})]: \${val}\`);
    });
  }
}`,
    recallHint: "untracked(() => signal()) reads value without creating a reactive dependency; prevents unwanted re-runs.",
    interviewTip: "Explain that `untracked` is the signal equivalent of reading an RxJS observable's latest value with `withLatestFrom` rather than `combineLatest`.",
    tags: ["untracked", "effect", "dependency-tracking", "loop-prevention"],
    practice: [
      "How does `untracked()` prevent circular trigger loops in complex signal architectures?",
      "What is the difference between untracked() and reading a non-signal property?"
    ]
  }),

  createCard({
    idNum: 41,
    category: "Angular Signals Engine & Reactivity",
    concept: "Angular 19 linkedSignal for Synchronized & Resetting State",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is `linkedSignal()` introduced in Angular 19, and how does it solve the problem of editable state linked to upstream signals?",
    quickAnswer: "`linkedSignal` creates a writable signal that automatically resets or recalculates its value whenever an upstream source signal changes, but can still be independently updated locally without breaking the link.",
    detailedAnswer: "A common architectural problem: a parent passes a selected `productId` signal to a form. The form initializes a quantity signal to `1`. If the user selects a new product, quantity should reset back to `1`. In older Angular, this required complex effects or manual watcher code. `linkedSignal({ source: () => this.selectedProduct(), computation: (p) => p.defaultQty })` automatically resets when `selectedProduct` changes, yet remains directly writable via `quantity.set(...)`.",
    code: `import { Component, signal, linkedSignal } from '@angular/core';

@Component({
  selector: 'app-product-configurator',
  standalone: true,
  template: \`
    <button (click)="selectOption('Standard')">Standard</button>
    <button (click)="selectOption('Enterprise')">Enterprise</button>

    <p>Selected Tier: {{ selectedTier() }}</p>
    <p>Customized Discount: {{ discount() }}%</p>
    <button (click)="discount.set(25)">Override 25% Discount</button>
  \`
})
export class ProductConfiguratorComponent {
  selectedTier = signal('Standard');

  // Angular 19 linkedSignal:
  // 1. Resets automatically whenever selectedTier() changes!
  // 2. Can be manually overridden locally using discount.set()!
  discount = linkedSignal({
    source: this.selectedTier,
    computation: (tier) => tier === 'Enterprise' ? 20 : 5
  });

  selectOption(tier: string) {
    this.selectedTier.set(tier); // discount automatically resets to default for tier!
  }
}`,
    recallHint: "linkedSignal resets to computation when source signal changes, but remains locally writable with .set().",
    interviewTip: "Highlight that `linkedSignal` in Angular 19 solves one of the oldest frontend pain points: derived state that needs to be editable by the user but reset when upstream props change.",
    tags: ["linkedSignal", "angular19", "derived-writable", "resettable-state"],
    practice: [
      "Why is using `computed()` insufficient when the derived value needs to be editable by a form?",
      "How did developers handle resettable state before Angular 19's `linkedSignal`?"
    ]
  }),

  createCard({
    idNum: 42,
    category: "Angular Signals Engine & Reactivity",
    concept: "Signal Inputs (input & input.required)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are Signal Inputs (`input()`, `input.required()`) in Angular 17.1+, and how do they replace the `@Input()` decorator?",
    quickAnswer: "Signal inputs define component inputs as reactive signals: `title = input('default')` or `userId = input.required<string>()`. They provide read-only signals that can be consumed in `computed()` derivations without `ngOnChanges`.",
    detailedAnswer: "The `@Input()` decorator suffered from major limitations: inputs were not available in constructors, required `ngOnChanges` or getter/setter pairs to react to updates, and required non-null assertion hacks (`!`). Signal Inputs declare inputs as first-class read-only signals. They support transforms (`input(0, { transform: numberAttribute })`), required checks (`input.required<string>()`), and integrate directly into `computed()` graphs.",
    code: `import { Component, input, computed, numberAttribute } from '@angular/core';

@Component({
  selector: 'app-user-badge',
  standalone: true,
  template: \`
    <div class="badge">
      <span>{{ displayName() }}</span>
      <span class="count">#{{ score() }}</span>
    </div>
  \`
})
export class UserBadgeComponent {
  // Required input signal: Compile error if consumer omits [userId]!
  userId = input.required<string>();

  // Optional input with default value:
  role = input<string>('Guest');

  // Input with transform:
  score = input(0, { transform: numberAttribute });

  // Reactive computed derivation directly from input signals!
  // Automatically recalculates whenever userId or role updates:
  displayName = computed(() => \`\${this.userId()} (\${this.role()})\`);
}`,
    recallHint: "input() and input.required() declare input properties as reactive signals; eliminates ngOnChanges boilerplate.",
    interviewTip: "Emphasize that Signal Inputs are read-only (`InputSignal<T>`). A child component cannot call `.set()` on its own input signal—if two-way binding is required, use `model()`.",
    tags: ["signal-inputs", "input", "input.required", "angular17"],
    practice: [
      "Can a component mutate its own Signal Input using `.set()`?",
      "How do Signal Inputs eliminate the need for the `ngOnChanges` lifecycle hook?"
    ]
  }),

  createCard({
    idNum: 43,
    category: "Angular Signals Engine & Reactivity",
    concept: "Signal Outputs & output() Function",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the `output()` function in Angular 17.3+ and how does it modernize `@Output()` and `EventEmitter`?",
    quickAnswer: "The `output<T>()` function declares component outputs without decorators or the heavy `EventEmitter` class: `deleteItem = output<string>()`. It emits events via `deleteItem.emit('id')`.",
    detailedAnswer: "Historically, outputs required `@Output() deleteItem = new EventEmitter<string>()`. `EventEmitter` historically extended RxJS `Subject`, adding unnecessary bundle overhead. The modern `output()` function produces an `OutputEmitterRef<T>` that is cleaner, has a smaller runtime footprint, and integrates with `outputFromObservable()` to bridge RxJS streams directly into component outputs.",
    code: `import { Component, output } from '@angular/core';

@Component({
  selector: 'app-todo-item',
  standalone: true,
  template: \`
    <div>
      <span>{{ title }}</span>
      <button (click)="handleDelete()">Delete</button>
    </div>
  \`
})
export class TodoItemComponent {
  title = 'Learn Angular Signals';

  // Modern Output declaration (No @Output decorator, no EventEmitter!)
  deleted = output<string>();

  handleDelete() {
    this.deleted.emit(this.title);
  }
}

// Parent Template:
// <app-todo-item (deleted)="onDeleteSuccess($event)" />`,
    recallHint: "deleted = output<string>(); emits via deleted.emit(val); replaces @Output and EventEmitter.",
    interviewTip: "Mention `outputFromObservable(myStream$)`: it automatically emits values from an RxJS stream as a component output.",
    tags: ["output", "signal-outputs", "events", "angular17"],
    practice: [
      "Why did modern Angular introduce output() instead of continuing to use EventEmitter?",
      "How does `outputFromObservable()` convert an RxJS stream into a component output?"
    ]
  }),

  createCard({
    idNum: 44,
    category: "Angular Signals Engine & Reactivity",
    concept: "Two-Way Binding with model() Inputs",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the `model()` function in Angular 17.2+ provide clean two-way signal binding (banana-in-a-box `[(value)]`)?",
    quickAnswer: "`model(initialVal)` defines a two-way bindable signal input that is writable by both parent and child. It automatically creates both an input `value` and an output `valueChange`, enabling clean `[(value)]` banana-in-a-box syntax.",
    detailedAnswer: "Previously, two-way binding required declaring both `@Input() value` and `@Output() valueChange = new EventEmitter()`. The `model()` function unifies both into a single `ModelSignal<T>`. When the parent passes `[(checked)]=\"isAgreed\"`, the child can call `this.checked.set(true)`, and Angular automatically synchronizes the value back to the parent component's signal or property.",
    code: `import { Component, model } from '@angular/core';

// Child Component with Two-Way Model Signal
@Component({
  selector: 'app-custom-toggle',
  standalone: true,
  template: \`
    <button (click)="toggle()">
      Toggle: {{ checked() ? 'ON' : 'OFF' }}
    </button>
  \`
})
export class CustomToggleComponent {
  // Declares two-way bindable signal:
  checked = model<boolean>(false);

  toggle() {
    // Calling .set() or .update() updates child AND notifies parent!
    this.checked.update(c => !c);
  }
}

// Parent Component usage with Banana-in-a-Box:
// <app-custom-toggle [(checked)]="parentAgreed" />`,
    recallHint: "checked = model(false) creates two-way signal binding; enables [(checked)]='state' automatically.",
    interviewTip: "Point out that `model()` outputs follow the standard naming convention: `name` and `nameChange` under the hood, making it backward compatible with existing Angular templates.",
    tags: ["model", "two-way-binding", "model-signals", "angular17"],
    practice: [
      "How does `model.required()` enforce mandatory two-way bindings?",
      "What is the difference between `input()` and `model()` in Angular Signals?"
    ]
  }),

  createCard({
    idNum: 45,
    category: "Angular Signals Engine & Reactivity",
    concept: "Signal Queries: viewChild & contentChild",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do modern Signal Queries (`viewChild()`, `viewChildren()`, `contentChild()`) replace `@ViewChild` decorators?",
    quickAnswer: "Signal queries define DOM queries as reactive signals: `inputEl = viewChild<ElementRef>('inputRef')`. The returned signal emits `undefined` while unmounted and automatically updates when the queried element enters or exits the DOM.",
    detailedAnswer: "Older `@ViewChild` queries were static or required `ngAfterViewInit` to inspect, frequently causing `undefined` errors if an element was inside an `*ngIf`. Signal queries return a `Signal<T | undefined>` (or `viewChild.required<T>()`). Because it is a signal, you can read it inside `effect()` or `computed()` without worrying about timing lifecycle hooks.",
    code: `import { Component, viewChild, ElementRef, effect } from '@angular/core';

@Component({
  selector: 'app-auto-focus',
  standalone: true,
  template: \`
    @if (showInput()) {
      <input #myInput type="text" placeholder="Auto-focused..." />
    }
  \`
})
export class AutoFocusComponent {
  showInput = signal(false);

  // Modern Signal Query: Reactive signal of ElementRef or undefined
  myInput = viewChild<ElementRef<HTMLInputElement>>('myInput');

  constructor() {
    // Automatically reacts when the input appears in the DOM!
    effect(() => {
      const input = this.myInput();
      if (input) {
        input.nativeElement.focus();
      }
    });
  }
}`,
    recallHint: "viewChild('ref') returns a reactive signal that updates automatically when DOM elements appear or disappear.",
    interviewTip: "Highlight how signal queries eliminate lifecycle timing issues: reading `viewChild()` inside an `effect()` executes seamlessly the moment the element mounts.",
    tags: ["viewChild", "signal-queries", "contentChild", "angular17"],
    practice: [
      "How do signal queries handle elements that are conditionally rendered with `@if`?",
      "What is the return type of `viewChildren()`?"
    ]
  }),

  createCard({
    idNum: 46,
    category: "Angular Signals Engine & Reactivity",
    concept: "RxJS to Signals Interoperability (toSignal)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does `toSignal()` convert an RxJS Observable into an Angular Signal, and what are its options for initial values and injection context?",
    quickAnswer: "`toSignal(observable$, options)` converts an Observable stream into a Signal. Because signals must always have a synchronous value, you can provide `initialValue: val` or `requireSync: true`. It auto-subscribes and cleans up with the enclosing `DestroyRef`.",
    detailedAnswer: "In Angular, Observables are ideal for asynchronous events and HTTP pipelines, while Signals are ideal for template rendering and state. `toSignal(stream$)` from `@angular/core/rxjs-interop` bridges them: it manages the underlying RxJS subscription automatically, updating the signal on every emission. If called outside constructor context, pass `{ injector }` explicitly.",
    code: `import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-users-view',
  standalone: true,
  template: \`
    <ul>
      @for (user of users(); track user.id) {
        <li>{{ user.name }}</li>
      }
    </ul>
  \`
})
export class UsersViewComponent {
  private http = inject(HttpClient);

  // Converts cold HTTP Observable into a reactive Signal with initial fallback:
  users = toSignal(this.http.get<any[]>('/api/users'), {
    initialValue: [] // Guarantees users() returns [] before network resolves
  });
}`,
    recallHint: "toSignal(obs$, { initialValue: [] }) converts Observable to Signal; auto-manages subscription lifecycle.",
    interviewTip: "Mention `requireSync: true`: use it when converting an Observable that is guaranteed to emit synchronously (like a `BehaviorSubject`), avoiding `undefined` initial values.",
    tags: ["toSignal", "rxjs-interop", "signals", "angular16"],
    practice: [
      "What is the default value of a signal created via `toSignal()` before the Observable emits?",
      "How does `requireSync: true` work in `toSignal()`?"
    ]
  }),

  createCard({
    idNum: 47,
    category: "Angular Signals Engine & Reactivity",
    concept: "Signals to RxJS Interoperability (toObservable)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does `toObservable()` convert an Angular Signal into an RxJS Observable, and how does its microtask scheduling work?",
    quickAnswer: "`toObservable(mySignal)` creates an Observable that emits the signal's value whenever it changes. It batches changes using microtasks, emitting the settled value after all synchronous signal mutations in the tick complete.",
    detailedAnswer: "When you need to use powerful RxJS operators (like `debounceTime`, `switchMap`, or `filter`) on a Signal's state, `toObservable(signal)` provides the bridge. Unlike direct signal reads which are instant, `toObservable` is scheduled via microtasks (similar to `effect()`). If a signal is updated three times synchronously (`count.set(1); count.set(2); count.set(3);`), the resulting Observable emits only the final value `3`.",
    code: `import { Component, signal, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

@Component({ selector: 'app-query-bridge', standalone: true, template: \`<p>Bridged</p>\` })
export class QueryBridgeComponent {
  private http = inject(HttpClient);

  // Writable Signal driving UI input
  searchTerm = signal('');

  // Convert signal to Observable to leverage debounceTime and switchMap:
  searchResults$ = toObservable(this.searchTerm).pipe(
    debounceTime(300),
    distinctUntilChanged(),
    switchMap(query => this.http.get(\`/api/search?q=\${query}\`))
  );
}`,
    recallHint: "toObservable(signal) bridges Signal into RxJS stream; batches synchronous updates via microtasks.",
    interviewTip: "Explain that `toObservable` uses an `effect()` internally, which is why it requires an injection context during instantiation.",
    tags: ["toObservable", "rxjs-interop", "operators", "signals"],
    practice: [
      "Why does `toObservable` batch multiple synchronous signal updates into a single emission?",
      "Why does toObservable() require an injection context?"
    ]
  }),

  createCard({
    idNum: 48,
    category: "Angular Signals Engine & Reactivity",
    concept: "State Management with Signals in Services",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the recommended architecture for building centralized state services using Angular Signals without third-party libraries?",
    quickAnswer: "Keep writable signals private (`#state = signal(...)`), expose public read-only signals (`state = this.#state.asReadonly()`), expose computed selectors, and provide explicit action methods to mutate state.",
    detailedAnswer: "In Angular Signals architecture, services manage state cleanly without Redux boilerplate. The service encapsulates state by marking writable signals as private. Components read state through exposed read-only signals or derived `computed()` selectors. State mutations are restricted to explicit service methods (`addItem`, `removeUser`), enforcing unidirectional data flow and preventing components from arbitrarily calling `.set()` from outside.",
    code: `import { Injectable, signal, computed } from '@angular/core';

export interface CartItem {
  id: string;
  name: string;
  price: number;
}

@Injectable({ providedIn: 'root' })
export class CartStore {
  // 1. Private writable state signal
  #items = signal<CartItem[]>([]);

  // 2. Public read-only signal exposure (Components CANNOT call .set()!)
  readonly items = this.#items.asReadonly();

  // 3. Computed selectors
  readonly itemCount = computed(() => this.#items().length);
  readonly totalPrice = computed(() => 
    this.#items().reduce((sum, item) => sum + item.price, 0)
  );

  // 4. Action mutations
  addItem(item: CartItem) {
    this.#items.update(items => [...items, item]);
  }

  removeItem(id: string) {
    this.#items.update(items => items.filter(i => i.id !== id));
  }
}`,
    recallHint: "Private #state signal + public asReadonly() + computed selectors + action methods = clean Signal Store.",
    interviewTip: "Highlight `asReadonly()`: it prevents consuming components from illegally mutating state from the outside, preserving strict unidirectional data flow.",
    tags: ["signal-store", "state-management", "asReadonly", "services"],
    practice: [
      "Why should state signals in a service be exposed using `.asReadonly()`?",
      "How does this Signal service pattern compare to NgRx ComponentStore?"
    ]
  })
];
