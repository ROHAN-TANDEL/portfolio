module.exports = [
  {
    id: "angular-ex-23",
    title: "Reactive Shopping Cart State with signal, update & computed",
    category: "Angular Signals & State Management",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements a complete reactive shopping cart using signal, computed derived metrics (subtotal, VAT, shipping), and immutable update methods.",
    conceptsCovered: [
      "signal",
      "computed",
      "update",
      "Derived State",
      "Immutability"
    ],
    code: `import { Injectable, signal, computed } from '@angular/core';

export interface CartItem { id: string; name: string; price: number; quantity: number; }

@Injectable({ providedIn: 'root' })
export class CartService {
  // 1. Core writable state
  items = signal<CartItem[]>([]);

  // 2. Computed derived signals (auto-memoized)
  totalCount = computed(() =>
    this.items().reduce((acc, item) => acc + item.quantity, 0)
  );

  subtotal = computed(() =>
    this.items().reduce((acc, item) => acc + (item.price * item.quantity), 0)
  );

  tax = computed(() => +(this.subtotal() * 0.15).toFixed(2));
  shipping = computed(() => (this.subtotal() > 100 || this.subtotal() === 0 ? 0 : 15));
  grandTotal = computed(() => this.subtotal() + this.tax() + this.shipping());

  // 3. Mutator methods
  addItem(product: { id: string; name: string; price: number }) {
    this.items.update(current => {
      const existing = current.find(i => i.id === product.id);
      if (existing) {
        return current.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...current, { ...product, quantity: 1 }];
    });
  }

  removeItem(id: string) {
    this.items.update(current => current.filter(i => i.id !== id));
  }
}`,
    breakdown: [
      "items writable signal holds the immutable collection of cart items.",
      "computed signals (subtotal, tax, grandTotal) calculate automatically with push-pull glitch-free guarantees.",
      "this.items.update() derives next state from previous state cleanly.",
      "Zero manual subscriptions; components reading grandTotal() update fine-grained on mutation."
    ],
    expectedOutput: "Shopping cart updates items, counts, tax, and free shipping thresholds reactively."
  },
  {
    id: "angular-ex-24",
    title: "Form Synchronization with linkedSignal (Angular 19)",
    category: "Angular Signals & State Management",
    difficulty: "advanced",
    whatThisCodeCovers: "Uses Angular 19 linkedSignal to create writable local component state that resets automatically whenever an upstream input signal changes.",
    conceptsCovered: [
      "linkedSignal",
      "Angular 19 Features",
      "Reset on Input Change",
      "Writable Signals",
      "Form Default State"
    ],
    code: `import { Component, input, linkedSignal } from '@angular/core';

interface UserShippingAddress { street: string; city: string; zip: string; }

@Component({
  selector: 'app-address-editor',
  standalone: true,
  template: \`
    <div class="editor">
      <h3>Editing Address for User</h3>
      <input [value]="editableStreet()" (input)="editableStreet.set($any($event.target).value)" />
      <button (click)="resetToDefault()">Reset</button>
    </div>
  \`
})
export class AddressEditorComponent {
  // Upstream input signal from parent component:
  serverAddress = input.required<UserShippingAddress>();

  // linkedSignal: Writable signal whose value resets automatically
  // whenever serverAddress() emits a new object!
  editableStreet = linkedSignal({
    source: this.serverAddress,
    computation: (source) => source.street
  });

  resetToDefault() {
    this.editableStreet.set(this.serverAddress().street);
  }
}`,
    breakdown: [
      "linkedSignal solves the classic problem where local editable state must track upstream inputs.",
      "Whenever the serverAddress input changes, editableStreet automatically recalculates and resets.",
      "The user can edit the field locally via .set() without mutating the upstream input.",
      "Eliminates complex ngOnChanges lifecycle hooks and manual effect() synchronization."
    ],
    expectedOutput: "Local input changes allow editing, but switching user profiles resets field to new default."
  },
  {
    id: "angular-ex-25",
    title: "Two-Way Model Binding with model() & model.required()",
    category: "Angular Signals & State Management",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements two-way banana-in-a-box [()] component binding using Angular 17.2+ model() signals, replacing legacy @Input() and @Output() EventEmitter pairs.",
    conceptsCovered: [
      "model()",
      "model.required()",
      "Two-Way Data Binding",
      "Banana-in-a-box syntax",
      "Signal Inputs"
    ],
    code: `import { Component, model } from '@angular/core';

// 1. Child Component declaring a model signal:
@Component({
  selector: 'app-counter-stepper',
  standalone: true,
  template: \`
    <div class="stepper">
      <button (click)="decrement()">-</button>
      <span>Value: {{ count() }}</span>
      <button (click)="increment()">+</button>
    </div>
  \`
})
export class CounterStepperComponent {
  // model() creates both an input AND a corresponding output 'countChange'!
  count = model.required<number>();

  increment() {
    this.count.update(n => n + 1); // Automatically notifies parent!
  }

  decrement() {
    this.count.update(n => n - 1);
  }
}

// 2. Parent Component consuming with banana-in-a-box [()]:
@Component({
  selector: 'app-parent-page',
  standalone: true,
  imports: [CounterStepperComponent],
  template: \`
    <!-- Two-way binding effortlessly synchronized -->
    <app-counter-stepper [(count)]="parentQuantity" />
    <p>Parent Quantity: {{ parentQuantity() }}</p>
  \`
})
export class ParentPageComponent {
  parentQuantity = model(10);
}`,
    breakdown: [
      "model.required<number>() defines a writable signal that acts as an input and an output.",
      "Angular automatically generates the corresponding countChange output event under the hood.",
      "Calling this.count.update() pushes changes to the parent without manual EventEmitter.emit() calls.",
      "Parent binds via [(count)]=\"parentQuantity\", achieving seamless two-way signal synchronization."
    ],
    expectedOutput: "Clicking +/- updates stepper and synchronizes parentQuantity value instantaneously."
  },
  {
    id: "angular-ex-26",
    title: "Full CRUD Entity Store using NgRx SignalStore withEntities",
    category: "Angular Signals & State Management",
    difficulty: "advanced",
    whatThisCodeCovers: "Constructs a production-grade entity management store using @ngrx/signals and withEntities, supporting normalized CRUD operations and computed selectors.",
    conceptsCovered: [
      "signalStore",
      "withEntities",
      "addEntity",
      "removeEntity",
      "updateEntity"
    ],
    code: `import { signalStore, withMethods, patchState } from '@ngrx/signals';
import { withEntities, addEntity, removeEntity, updateEntity, setAllEntities } from '@ngrx/signals/entities';

export interface Customer { id: string; name: string; email: string; tier: 'FREE' | 'VIP'; }

export const CustomerStore = signalStore(
  { providedIn: 'root' },
  // Provides entities(), entityMap(), and ids() signals automatically:
  withEntities<Customer>(),
  withMethods((store) => ({
    loadCustomers(customers: Customer[]) {
      patchState(store, setAllEntities(customers));
    },
    addCustomer(customer: Customer) {
      patchState(store, addEntity(customer));
    },
    updateCustomer(id: string, changes: Partial<Customer>) {
      patchState(store, updateEntity({ id, changes }));
    },
    deleteCustomer(id: string) {
      patchState(store, removeEntity(id));
    }
  }))
);

// Usage in Component:
// export class CustomerListComponent {
//   readonly store = inject(CustomerStore);
//   // Read entities directly: this.store.entities()
// }`,
    breakdown: [
      "withEntities<Customer>() normalizes state into ids array and entityMap dictionary.",
      "Exposes out-of-the-box computed signals: entities(), entityMap(), ids().",
      "patchState with addEntity/updateEntity guarantees immutable O(1) dictionary updates.",
      "Zero boilerplate compared to classic NgRx actions, reducers, and selectors."
    ],
    expectedOutput: "Normalized customer state managed with clean methods and automatic entity signals."
  },
  {
    id: "angular-ex-27",
    title: "Persistent LocalStorage Signal Wrapper",
    category: "Angular Signals & State Management",
    difficulty: "intermediate",
    whatThisCodeCovers: "Creates a custom signal utility that persists state to browser localStorage and updates automatically via effect().",
    conceptsCovered: [
      "signal",
      "effect",
      "localStorage",
      "JSON Serialization",
      "Custom Utilities"
    ],
    code: `import { signal, effect, WritableSignal } from '@angular/core';

export function persistentSignal<T>(key: string, defaultValue: T): WritableSignal<T> {
  // 1. Read initial state from localStorage safely
  let initialValue = defaultValue;
  if (typeof window !== 'undefined' && window.localStorage) {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      try {
        initialValue = JSON.parse(stored);
      } catch (e) {
        console.error(\`Failed to parse localStorage for key: \${key}\`, e);
      }
    }
  }

  // 2. Create signal with resolved initial value
  const sig = signal<T>(initialValue);

  // 3. Sync to localStorage on every change using effect:
  effect(() => {
    const val = sig();
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(key, JSON.stringify(val));
    }
  });

  return sig;
}

// In Component:
// theme = persistentSignal<'light' | 'dark'>('app_theme', 'light');
// toggle() { this.theme.update(t => t === 'light' ? 'dark' : 'light'); }`,
    breakdown: [
      "Initializes signal with stored localStorage data if available, falling back to default.",
      "effect() registers a reactive listener that triggers whenever the signal value mutates.",
      "SSR safe: guards window.localStorage checks before attempting browser storage access.",
      "Returns standard WritableSignal<T> supporting .set() and .update() methods."
    ],
    expectedOutput: "Signal mutations persist to browser localStorage across page reloads automatically."
  },
  {
    id: "angular-ex-28",
    title: "Deep Immutability State Updater with Signals",
    category: "Angular Signals & State Management",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates safe nested object and array updates on Angular Signals without mutating existing memory references.",
    conceptsCovered: [
      "Deep Immutability",
      "update()",
      "Spread Operators",
      "Array Mapping",
      "Change Detection"
    ],
    code: `import { Component, signal } from '@angular/core';

interface UserProfile {
  id: string;
  preferences: {
    notifications: { email: boolean; push: boolean };
    tags: string[];
  };
}

@Component({
  selector: 'app-nested-profile',
  standalone: true,
  template: \`
    <button (click)="togglePushNotifications()">Toggle Push</button>
    <button (click)="addTag('Angular')">Add Tag</button>
  \`
})
export class NestedProfileComponent {
  profile = signal<UserProfile>({
    id: 'u123',
    preferences: {
      notifications: { email: true, push: false },
      tags: ['TypeScript']
    }
  });

  togglePushNotifications() {
    this.profile.update(state => ({
      ...state,
      preferences: {
        ...state.preferences,
        notifications: {
          ...state.preferences.notifications,
          push: !state.preferences.notifications.push
        }
      }
    }));
  }

  addTag(newTag: string) {
    this.profile.update(state => ({
      ...state,
      preferences: {
        ...state.preferences,
        tags: [...state.preferences.tags, newTag]
      }
    }));
  }
}`,
    breakdown: [
      "Deep nested state must be copied at every hierarchy level using object spread ({ ...obj }).",
      "Arrays are updated immutably using array spread ([...arr, item]) or .map() / .filter().",
      "Guarantees that OnPush change detection and computed signals detect the mutation.",
      "Prevents subtle bugs where shared references are unexpectedly mutated."
    ],
    expectedOutput: "Nested profile properties update cleanly with new object references."
  },
  {
    id: "angular-ex-29",
    title: "Undo/Redo State History Stack with Signals",
    category: "Angular Signals & State Management",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements an undo/redo state management stack using signals and computed flags (canUndo, canRedo) for rich interactive canvas or text editors.",
    conceptsCovered: [
      "Undo/Redo Pattern",
      "History Stack",
      "computed",
      "State Snapshots",
      "signal"
    ],
    code: `import { Injectable, signal, computed } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class HistoryStore<T> {
  private past = signal<T[]>([]);
  private present = signal<T | null>(null);
  private future = signal<T[]>([]);

  readonly current = computed(() => this.present());
  readonly canUndo = computed(() => this.past().length > 0);
  readonly canRedo = computed(() => this.future().length > 0);

  init(initialState: T) {
    this.present.set(initialState);
    this.past.set([]);
    this.future.set([]);
  }

  set(nextState: T) {
    const current = this.present();
    if (current !== null) {
      this.past.update(p => [...p, current]);
    }
    this.present.set(nextState);
    this.future.set([]); // Reset redo history on new action
  }

  undo() {
    const pastArr = this.past();
    if (pastArr.length === 0) return;

    const previous = pastArr[pastArr.length - 1];
    const newPast = pastArr.slice(0, -1);
    const current = this.present();

    if (current !== null) {
      this.future.update(f => [current, ...f]);
    }
    this.present.set(previous);
    this.past.set(newPast);
  }

  redo() {
    const futureArr = this.future();
    if (futureArr.length === 0) return;

    const next = futureArr[0];
    const newFuture = futureArr.slice(1);
    const current = this.present();

    if (current !== null) {
      this.past.update(p => [...p, current]);
    }
    this.present.set(next);
    this.future.set(newFuture);
  }
}`,
    breakdown: [
      "Maintains past, present, and future signal stacks.",
      "canUndo and canRedo computed signals bind directly to button [disabled] attributes.",
      "Pushing a new state wipes out future redo history as expected in standard editors.",
      "Undo moves present to future and pops past to present seamlessly."
    ],
    expectedOutput: "History stack supports undo and redo transitions with reactive UI button disabling."
  },
  {
    id: "angular-ex-30",
    title: "Multi-Criteria Filtering & Sorting Matrix with computed",
    category: "Angular Signals & State Management",
    difficulty: "intermediate",
    whatThisCodeCovers: "Filters and sorts large collections across multiple criteria (search query, category, price range, sort direction) using a single memoized computed signal.",
    conceptsCovered: [
      "computed",
      "Multi-field Filtering",
      "Sorting",
      "Memoization",
      "signal"
    ],
    code: `import { Component, signal, computed } from '@angular/core';

interface Product { id: string; name: string; category: string; price: number; }

@Component({
  selector: 'app-catalog-filter',
  standalone: true,
  template: \`
    <input (input)="search.set($any($event.target).value)" placeholder="Search..." />
    <select (change)="selectedCategory.set($any($event.target).value)">
      <option value="ALL">All Categories</option>
      <option value="ELECTRONICS">Electronics</option>
      <option value="BOOKS">Books</option>
    </select>
    <p>Showing {{ filteredProducts().length }} items</p>
  \`
})
export class CatalogFilterComponent {
  products = signal<Product[]>([
    { id: '1', name: 'MacBook Air', category: 'ELECTRONICS', price: 999 },
    { id: '2', name: 'TypeScript Handbook', category: 'BOOKS', price: 49 },
    { id: '3', name: 'USB-C Cable', category: 'ELECTRONICS', price: 19 }
  ]);

  search = signal('');
  selectedCategory = signal('ALL');
  sortBy = signal<'price_asc' | 'price_desc'>('price_asc');

  // Single memoized computed signal reacting to any filter change:
  filteredProducts = computed(() => {
    const q = this.search().toLowerCase().trim();
    const cat = this.selectedCategory();
    const sort = this.sortBy();

    return this.products()
      .filter(p => {
        const matchesQuery = !q || p.name.toLowerCase().includes(q);
        const matchesCat = cat === 'ALL' || p.category === cat;
        return matchesQuery && matchesCat;
      })
      .sort((a, b) => {
        return sort === 'price_asc' ? a.price - b.price : b.price - a.price;
      });
  });
}`,
    breakdown: [
      "filteredProducts tracks search, selectedCategory, and sortBy dependencies automatically.",
      "Recalculates ONLY when one of the tracked signals changes value.",
      "Returns a new filtered array ready for @for loop rendering with track p.id.",
      "Eliminates duplicate imperative filter methods and out-of-sync UI state."
    ],
    expectedOutput: "Products table filters and sorts reactively with optimal caching."
  },
  {
    id: "angular-ex-31",
    title: "Asynchronous Data Loading with rxResource (Angular 19)",
    category: "Angular Signals & State Management",
    difficulty: "advanced",
    whatThisCodeCovers: "Loads async HTTP data into reactive signals using Angular 19 rxResource, managing loading, value, and error states automatically.",
    conceptsCovered: [
      "rxResource",
      "Angular 19 Features",
      "Async Loading",
      "HTTP Integration",
      "resource()"
    ],
    code: `import { Component, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { rxResource } from '@angular/core/rxjs-interop';

interface UserData { id: string; name: string; role: string; }

@Component({
  selector: 'app-user-resource',
  standalone: true,
  template: \`
    <button (click)="userId.set('u2')">Load User 2</button>

    @if (userResource.isLoading()) {
      <p>Loading user data...</p>
    } @else if (userResource.error()) {
      <p class="error">Failed to load user: {{ userResource.error() }}</p>
    } @else if (userResource.value(); as user) {
      <h2>User: {{ user.name }} (Role: {{ user.role }})</h2>
    }
  \`
})
export class UserResourceComponent {
  private http = inject(HttpClient);
  userId = signal('u1');

  // Angular 19 rxResource bridges reactive params with async fetching:
  userResource = rxResource({
    request: () => ({ id: this.userId() }),
    loader: ({ request }) => this.http.get<UserData>(\`/api/users/\${request.id}\`)
  });
}`,
    breakdown: [
      "rxResource automatically re-fetches whenever request signals (this.userId) change.",
      "Exposes out-of-the-box signals: .value(), .isLoading(), .error(), and .status().",
      "Eliminates manual switchMap, loading booleans, and error-handling boilerplate.",
      "Integrates natively with built-in control flow (@if)."
    ],
    expectedOutput: "Changing userId re-fetches user, displaying loading spinner and rendering result."
  },
  {
    id: "angular-ex-32",
    title: "Dynamic Theme Switcher with Signal-Driven CSS Variables",
    category: "Angular Signals & State Management",
    difficulty: "beginner",
    whatThisCodeCovers: "Toggles application theme between dark and light modes, applying CSS variables to document.documentElement using an Angular effect.",
    conceptsCovered: [
      "effect()",
      "CSS Custom Properties",
      "Signal State",
      "DOM Synchronization",
      "Theming"
    ],
    code: `import { Injectable, signal, effect, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

export type Theme = 'light' | 'dark';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private platformId = inject(PLATFORM_ID);
  currentTheme = signal<Theme>('light');

  constructor() {
    // Automatically synchronizes CSS variables when currentTheme() changes:
    effect(() => {
      const theme = this.currentTheme();
      if (isPlatformBrowser(this.platformId)) {
        const root = document.documentElement;
        if (theme === 'dark') {
          root.style.setProperty('--bg-color', '#121212');
          root.style.setProperty('--text-color', '#ffffff');
          root.classList.add('dark-theme');
        } else {
          root.style.setProperty('--bg-color', '#ffffff');
          root.style.setProperty('--text-color', '#212529');
          root.classList.remove('dark-theme');
        }
      }
    });
  }

  toggleTheme() {
    this.currentTheme.update(t => t === 'light' ? 'dark' : 'light');
  }
}`,
    breakdown: [
      "currentTheme signal holds active 'light' or 'dark' string value.",
      "effect() runs automatically whenever currentTheme is mutated via .update().",
      "isPlatformBrowser guards against document reference errors during SSR.",
      "Modifies CSS custom properties (--bg-color) directly on document root element."
    ],
    expectedOutput: "Toggling theme updates root CSS variables and swaps dark/light styles across the app."
  }
];
