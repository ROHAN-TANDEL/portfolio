const fs = require('fs');
const path = require('path');

const productionRunbooks = [
  {
    id: "angular-prod-01",
    topic: "ExpressionChangedAfterItHasBeenCheckedError (NG0100) Lifecycle Race",
    category: "Lifecycle & Change Detection",
    severity: "P0 / Production UI Desynchronization & Dev Mode Crash",
    theProblem: "A component updates a parent component's property or service state inside a child lifecycle hook (such as ngAfterViewInit or ngAfterContentInit) during the same change detection sweep. Angular throws 'NG0100: ExpressionChangedAfterItHasBeenCheckedError' in development mode. In production mode, the error is silenced, but the screen displays stale values that do not match component memory, causing corrupted transaction totals, disabled buttons appearing clickable, or broken modals.",
    howItWorksInternally: "Angular enforces unidirectional data flow (parent to child). In development mode, ApplicationRef.tick() runs a primary change detection pass evaluating all bindings, followed immediately by a second verification pass (checkNoChanges()). If any expression binding evaluates to a different value during this second pass, Angular knows a child component mutated state during its view checking phase, violating unidirectional data flow.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Child mutates parent title in ngAfterViewInit
@Component({
  selector: 'app-child-broken',
  standalone: true,
  template: \`<p>Child Content</p>\`
})
export class ChildBrokenComponent implements AfterViewInit {
  private parent = inject(ParentComponent);

  ngAfterViewInit() {
    // BUG: Mutates parent property AFTER parent template was already checked!
    // Triggers NG0100 error!
    this.parent.headerTitle = 'Updated by Child';
  }
}

// 2. PRODUCTION REMEDIATION: Unidirectional Architecture or Microtask
@Component({
  selector: 'app-child-fixed',
  standalone: true,
  template: \`<p>Child Content</p>\`
})
export class ChildFixedComponent implements OnInit {
  titleChange = output<string>();

  ngOnInit() {
    // FIX 1: Move state update to ngOnInit (before view rendering occurs!)
    // Or FIX 2: If must run after view check, schedule asynchronously via microtask:
    queueMicrotask(() => {
      this.titleChange.emit('Updated Cleanly');
    });
  }
}`,
    monitoringMetrics: [
      "Client telemetry logs tracking error code 'NG0100'",
      "Visual discrepancies between displayed numbers and submitted form payloads",
      "Spikes in Sentry error reports from components with ngAfterViewInit hooks"
    ],
    productionChecklist: [
      "Never mutate parent state or shared service properties inside `ngAfterViewInit` or `ngAfterViewChecked`.",
      "If values must derive from view measurements, use `queueMicrotask()` or Angular 16+ `afterNextRender()`.",
      "Refactor bidirectional state sharing into unidirectional Signal inputs and outputs."
    ]
  },
  {
    id: "angular-prod-02",
    topic: "Memory Leaks from Dangling RxJS Subscriptions",
    category: "Memory Management & Async Streams",
    severity: "P1 / Browser Memory Bloat & Zombie Event Handlers",
    theProblem: "Components subscribe to long-lived Observables (e.g. Router.events, WebSocket streams, NgRx Store selectors, or global interval timers) without unsubscribing when unmounted. As users navigate through the application, duplicate subscriptions accumulate in memory. Each destroyed component instance is retained by closure references, leaking megabytes of RAM and triggering duplicate API calls on every event.",
    howItWorksInternally: "When a component calls `observable.subscribe()`, the Observable source holds a reference to the Observer object (and its callbacks). If the source Observable has a longer lifespan than the component (such as a root service or global event), the component instance cannot be reclaimed by the V8 garbage collector because a live reference path exists from the global root. The component becomes a 'zombie', executing its callbacks in the background forever.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Dangling subscription leaks component memory!
@Component({ selector: 'app-leaky', standalone: true, template: \`...\` })
export class LeakyComponent implements OnInit {
  private router = inject(Router);

  ngOnInit() {
    // BUG: Global router stream retains this component permanently!
    this.router.events.subscribe(event => {
      console.log('Navigated:', event);
      // Retains this component in memory even after leaving page!
    });
  }
}

// 2. PRODUCTION REMEDIATION: takeUntilDestroyed or DestroyRef
@Component({ selector: 'app-clean', standalone: true, template: \`...\` })
export class CleanComponent implements OnInit {
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    // FIX: takeUntilDestroyed automatically unsubscribes on unmount!
    this.router.events.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(event => {
      console.log('Clean event:', event);
    });
  }
}`,
    monitoringMetrics: [
      "Chrome DevTools Memory tab Heap Snapshot showing increasing detached component instances",
      "Gradual memory growth over multi-hour single-page sessions (megabytes per route navigation)",
      "Multiplied network requests originating from destroyed background views"
    ],
    productionChecklist: [
      "Always use `takeUntilDestroyed()` on all manual `.subscribe()` calls in components and directives.",
      "Prefer converting Observables to Signals using `toSignal()` or using `AsyncPipe` in templates.",
      "Run ESLint rules enforcing `rxjs/no-ignored-subscription` across CI/CD."
    ]
  },
  {
    id: "angular-prod-03",
    topic: "Zone.js Change Detection Thrashing on High-Frequency Events",
    category: "Performance & Event Handling",
    severity: "P0 / 100% CPU Utilization, UI Freezing & Battery Drain",
    theProblem: "Registering standard event listeners for high-frequency events (`mousemove`, `scroll`, `touchmove`, or `requestAnimationFrame`) inside Angular triggers Zone.js change detection 60 to 120 times every second across the entire application. The browser thread freezes, interactions drop below 10 FPS, and mobile battery drains rapidly.",
    howItWorksInternally: "Zone.js monkey-patches `addEventListener` on `window` and `document`. Every time a mouse movement or scroll pixel fires, Zone.js marks the task complete and triggers `ngZone.onMicrotaskEmpty`, calling `ApplicationRef.tick()`. Angular executes top-down change detection checking thousands of bindings 60 times a second, even though the user was merely moving the mouse across a chart.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Template listener triggers app-wide CD on every pixel!
@Component({
  selector: 'app-canvas-disaster',
  standalone: true,
  template: \`<div (mousemove)="onMouseMove($event)">Draw</div>\`
})
export class CanvasDisasterComponent {
  onMouseMove(e: MouseEvent) {
    // Triggers ApplicationRef.tick() 60-120 times per second!
  }
}

// 2. PRODUCTION REMEDIATION: NgZone.runOutsideAngular & throttle
@Component({
  selector: 'app-canvas-optimized',
  standalone: true,
  template: \`<div #drawArea>Draw Area</div>\`
})
export class CanvasOptimizedComponent implements OnInit, OnDestroy {
  private ngZone = inject(NgZone);
  private area = viewChild.required<ElementRef>('drawArea');
  private cleanup?: () => void;

  ngOnInit() {
    // 1. Isolate listener completely from Zone.js!
    this.ngZone.runOutsideAngular(() => {
      const el = this.area().nativeElement;
      const handler = (e: MouseEvent) => {
        // High frequency animation logic directly on DOM / Canvas
        el.style.transform = \`translate(\${e.clientX}px, \${e.clientY}px)\`;
      };
      el.addEventListener('mousemove', handler, { passive: true });
      this.cleanup = () => el.removeEventListener('mousemove', handler);
    });
  }

  ngOnDestroy() {
    this.cleanup?.();
  }
}`,
    monitoringMetrics: [
      "Chrome DevTools Performance tab showing continuous solid yellow/red Change Detection blocks",
      "Lighthouse Interaction to Next Paint (INP) exceeding 500ms",
      "High CPU and thermal throttling reported on user devices during mouse movements"
    ],
    productionChecklist: [
      "Never bind `(scroll)` or `(mousemove)` directly in Angular HTML templates without throttling.",
      "Use `ngZone.runOutsideAngular()` for canvas animations, drag-and-drop, and scroll listeners.",
      "Consider migrating the application to Zoneless (`provideExperimentalZonelessChangeDetection`)."
    ]
  },
  {
    id: "angular-prod-04",
    topic: "Circular Dependency Deadlocks in Dependency Injection",
    category: "Dependency Injection & Architecture",
    severity: "P0 / Application Startup Crash & Blank Screen",
    theProblem: "Service A injects Service B, while Service B simultaneously injects Service A (directly or via an intermediary Service C). Angular fails to resolve the dependency graph, throwing 'Circular dependency detected' or crashing with 'Cannot access Service before initialization' in JavaScript modules.",
    howItWorksInternally: "When Angular instantiates a service, it builds a dependency resolution tree. If Service A requests Service B, Angular pauses instantiation of A to create B. When B requests A, Angular finds that A is still pending instantiation. Without resolution, JavaScript class hoisting constraints cause the variable to be read in the Temporal Dead Zone (TDZ), throwing a fatal runtime TypeError.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Circular DI Loop
// auth.service.ts
@Injectable({ providedIn: 'root' })
export class AuthService {
  private userApi = inject(UserApiService); // Injects UserApi
}

// user-api.service.ts
@Injectable({ providedIn: 'root' })
export class UserApiService {
  private auth = inject(AuthService); // Injects AuthService -> CIRCULAR DEADLOCK!
}

// 2. PRODUCTION REMEDIATION: Break cycle with Mediator Pattern or forwardRef
// solution: extract shared state or inject Injector lazily
@Injectable({ providedIn: 'root' })
export class UserApiServiceFixed {
  private injector = inject(Injector);

  getUser() {
    // Lazy lookup breaks constructor instantiation cycle:
    const auth = this.injector.get(AuthService);
    return auth.getToken();
  }
}`,
    monitoringMetrics: [
      "Fatal application bootstrap crashes on production CDN deployment",
      "Webpack / esbuild bundle warnings flagging circular module dependencies",
      "Build pipeline failures during Ahead-Of-Time (AOT) metadata generation"
    ],
    productionChecklist: [
      "Enforce ESLint `import/no-cycle` rule to block circular dependencies at commit time.",
      "Refactor circular services by extracting shared state into a third independent service or state store.",
      "Use lazy `Injector.get()` only as a tactical stopgap while planning proper architectural decoupling."
    ]
  },
  {
    id: "angular-prod-05",
    topic: "SSR Hydration Mismatch & DOM Flickering (NG0500)",
    category: "SSR & Hydration",
    severity: "P1 / Hydration Bailout, Layout Shifts & Broken Buttons",
    theProblem: "In Server-Side Rendered (SSR) applications, the server generates HTML containing dynamic content (such as timestamps, random IDs, or client-side cookie checks) that differs from what the client browser renders upon hydration. Angular throws 'NG0500: During hydration, Angular expected an element but found something else', drops hydration for that component, and causes severe layout shifts.",
    howItWorksInternally: "Angular's Non-Destructive Hydration matches server-rendered DOM nodes with client template instructions by traversing the DOM in order. If the server rendered `<p>Server Time: 12:00:00</p>` and the client renders `<p>Server Time: 12:00:03</p>`, or if the client renders an extra element conditioned on `localStorage`, the DOM traversal pointers fall out of sync. Angular logs an NG0500 error and may discard the existing DOM subtree.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Client-only state evaluated during SSR render
@Component({
  selector: 'app-time-banner',
  standalone: true,
  template: \`<p>Current Time: {{ now }}</p>\` // Differs between server & client!
})
export class TimeBannerComponent {
  now = new Date().toLocaleTimeString(); // Causes NG0500 hydration mismatch!
}

// 2. PRODUCTION REMEDIATION: afterNextRender or ngSkipHydration
@Component({
  selector: 'app-time-banner-safe',
  standalone: true,
  template: \`
    <p>Current Time: {{ now() }}</p>
  \`
})
export class TimeBannerSafeComponent {
  now = signal('Loading time...'); // Matches server output!

  constructor() {
    // afterNextRender runs ONLY on client browser after hydration succeeds:
    afterNextRender(() => {
      this.now.set(new Date().toLocaleTimeString());
    });
  }
}`,
    monitoringMetrics: [
      "Error logs tracking 'NG0500: Hydration mismatch'",
      "Spikes in Cumulative Layout Shift (CLS) on initial route visits",
      "SEO audit warnings indicating content discrepancies on cached pages"
    ],
    productionChecklist: [
      "Never read `localStorage`, `window.innerWidth`, or `new Date()` directly during initial SSR rendering.",
      "Use `afterNextRender` to defer client-specific DOM updates until after hydration completes.",
      "Use `ngSkipHydration` attribute on third-party canvas or legacy widgets that cannot support hydration."
    ]
  },
  {
    id: "angular-prod-06",
    topic: "Re-render Storms from Impure Pipes in Templates",
    category: "Template Performance",
    severity: "P1 / High CPU Usage & 10 FPS Scrolling Lag",
    theProblem: "Developers create a custom Angular pipe with `pure: false` to filter or format arrays in templates (`*ngFor=\"let item of items | filterPipe\"`). Because impure pipes execute on every single change detection cycle (including hover, focus, keystrokes, and timers), filtering an array of 500 items runs hundreds of times per second, causing severe interface stuttering.",
    howItWorksInternally: "Pure pipes (`pure: true`) memoize their output and only re-execute when their input parameters change by reference (`===`). Impure pipes (`pure: false`) disable this memoization entirely. On every turn of change detection across the entire app, Angular calls `pipe.transform()`. If the pipe performs array operations (`.filter()`, `.sort()`), it creates new array references on every check, which can also trigger child change detection loops.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Impure filtering pipe
@Pipe({ name: 'filterActive', standalone: true, pure: false }) // BUG: pure: false!
export class FilterActivePipe implements PipeTransform {
  transform(items: any[]): any[] {
    console.log('Impure pipe executed!'); // Runs on EVERY single tick!
    return items.filter(i => i.isActive);
  }
}

// 2. PRODUCTION REMEDIATION: Computed Signal
@Component({
  selector: 'app-active-list',
  standalone: true,
  template: \`
    <!-- Clean, memoized rendering via computed signal -->
    @for (item of activeItems(); track item.id) {
      <li>{{ item.name }}</li>
    }
  \`
})
export class ActiveListComponent {
  items = signal([{ id: 1, name: 'A', isActive: true }, { id: 2, name: 'B', isActive: false }]);

  // Computed memoizes output: recalculates ONLY when items() changes!
  activeItems = computed(() => {
    return this.items().filter(i => i.isActive);
  });
}`,
    monitoringMetrics: [
      "Chrome DevTools Profiler showing high CPU time spent in pipe transform functions",
      "Dropped frames during typing into text inputs on pages with data tables",
      "Lighthouse Performance scores penalized for Excessive DOM recalculations"
    ],
    productionChecklist: [
      "Never use impure pipes (`pure: false`) for filtering or sorting arrays.",
      "Derive filtered or sorted collections using Angular `computed()` signals.",
      "Enforce ESLint rules preventing `pure: false` on custom pipes."
    ]
  },
  {
    id: "angular-prod-07",
    topic: "Out-of-Sync Forms with Broken ControlValueAccessor",
    category: "Forms & Component Architecture",
    severity: "P1 / Silent Form Data Loss & Form Submission Failures",
    theProblem: "A custom form component (like a custom dropdown, toggle, or star rating) implements `ControlValueAccessor` incorrectly. It fails to call `registerOnTouched`, neglects `setDisabledState`, or ignores incoming `writeValue` updates when values are reset programmatically. The UI displays one value while the Angular `FormGroup` holds another, resulting in wrong data submitted to production databases.",
    howItWorksInternally: "Angular's reactive forms model is completely decoupled from the DOM. When you call `form.reset()`, Angular calls `writeValue(null)` on all registered CVAs. If the custom component stores its own internal state and fails to re-render in `writeValue()`, the component displays the old selection while the form model is empty. Furthermore, if `onTouched()` is never called, the form control never transitions to `touched: true`, suppressing required validation warnings.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Incomplete CVA implementation
@Component({ selector: 'app-broken-toggle', standalone: true, template: \`...\` })
export class BrokenToggleComponent implements ControlValueAccessor {
  state = false;
  writeValue(val: boolean) {
    // BUG: Ignores writeValue after initialization! form.reset() fails!
  }
  registerOnChange(fn: any) {}
  registerOnTouched(fn: any) {} // Empty! Control never marked touched!
}

// 2. PRODUCTION REMEDIATION: Fully compliant CVA
@Component({
  selector: 'app-compliant-toggle',
  standalone: true,
  providers: [{
    provide: NG_VALUE_ACCESSOR,
    useExisting: forwardRef(() => CompliantToggleComponent),
    multi: true
  }],
  template: \`
    <button [class.active]="checked" [disabled]="disabled" (click)="toggle()">Toggle</button>
  \`
})
export class CompliantToggleComponent implements ControlValueAccessor {
  checked = false;
  disabled = false;
  private onChange = (v: boolean) => {};
  private onTouched = () => {};

  writeValue(val: boolean): void {
    this.checked = Boolean(val); // Sync model to UI!
  }
  registerOnChange(fn: any): void { this.onChange = fn; }
  registerOnTouched(fn: any): void { this.onTouched = fn; }
  setDisabledState?(isDisabled: boolean): void { this.disabled = isDisabled; }

  toggle() {
    if (!this.disabled) {
      this.checked = !this.checked;
      this.onChange(this.checked); // Sync UI to model!
      this.onTouched(); // Mark touched!
    }
  }
}`,
    monitoringMetrics: [
      "User complaints of submitted forms containing blank or mismatched field values",
      "Form validation error messages failing to appear after user interaction",
      "Inconsistencies between form.getRawValue() and component visual state in tests"
    ],
    productionChecklist: [
      "Verify that `writeValue()` handles `null`, `undefined`, and initial reset values gracefully.",
      "Always call `this.onTouched()` on user blur or selection to maintain form state flags.",
      "Implement `setDisabledState()` so the widget responds to `control.disable()` calls."
    ]
  },
  {
    id: "angular-prod-08",
    topic: "Routing Guard Infinite Redirect Loops",
    category: "Router & Security",
    severity: "P0 / Browser Navigation Freeze & Max Call Stack Error",
    theProblem: "An authentication guard inspects user login status. If unauthenticated, it redirects to `/login`. However, `/login` itself is accidentally protected by the same guard, or the login page redirects back to the protected route without verifying credentials. The router navigates back and forth continuously until the browser crashes with 'Maximum call stack size exceeded'.",
    howItWorksInternally: "Angular Router executes guards sequentially on every navigation attempt. If Guard A returns `router.createUrlTree(['/login'])`, the router aborts the original transition and initiates a new navigation to `/login`. If the route definition for `/login` also has Guard A in its `canActivate` array, Guard A executes again and generates another redirect to `/login`. This recursion locks the browser main thread.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Guard guards its own redirect target!
export const brokenAuthGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const isLoggedIn = false;

  // BUG: If state.url is '/login', it redirects to '/login' infinitely!
  if (!isLoggedIn) {
    return router.createUrlTree(['/login']);
  }
  return true;
};

// 2. PRODUCTION REMEDIATION: Guard bypass check & dedicated public route
export const safeAuthGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const auth = inject(AuthService);

  // 1. Never guard the login route itself!
  if (state.url.startsWith('/login') || state.url.startsWith('/public')) {
    return true;
  }

  if (auth.isAuthenticated()) {
    return true;
  }

  // 2. Atomic redirect with returnUrl
  return router.createUrlTree(['/login'], {
    queryParams: { returnUrl: state.url }
  });
};`,
    monitoringMetrics: [
      "Router NavigationCancel / NavigationError spikes in analytics",
      "Browser console errors displaying 'Maximum call stack size exceeded' in router",
      "Users stuck on blank screens during login flow"
    ],
    productionChecklist: [
      "Ensure `/login`, `/register`, and public landing pages are never protected by auth guards.",
      "Verify that guards check `state.url` to avoid redirecting to the URL currently being navigated to.",
      "Write unit tests verifying unauthorized route redirection terminates cleanly."
    ]
  },
  {
    id: "angular-prod-09",
    topic: "Signal Effect Recursive Loops (Untracked Signal Reads)",
    category: "Signals & Reactivity",
    severity: "P0 / Browser Crash with NG0600 Error",
    theProblem: "An Angular `effect()` reads a Signal, performs logic, and mutates another Signal (or the same Signal) that causes the effect to re-trigger infinitely. Angular throws 'NG0600: Writing to signals is not allowed in a computed or effect by default' or, if allowed via `{ allowSignalWrites: true }`, freezes the browser in a CPU loop.",
    howItWorksInternally: "When an effect callback executes, Angular tracks every Signal read synchronously during that run as a dependency. If the effect mutates Signal A, and reading Signal A was tracked as part of the effect's dependencies, the mutation immediately flags the effect dirty again. The microtask scheduler queues the effect for immediate re-execution, creating an infinite recursion.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Recursive Signal Loop in Effect
@Component({ selector: 'app-loop', standalone: true, template: \`...\` })
export class LoopComponent {
  count = signal(0);
  multiplier = signal(2);

  constructor() {
    // DISASTER: Effect reads count and updates count -> INFINITE LOOP!
    effect(() => {
      console.log('Count:', this.count());
      this.count.set(this.count() * this.multiplier()); // Recursive write!
    }, { allowSignalWrites: true });
  }
}

// 2. PRODUCTION REMEDIATION: Use computed() or untracked()
@Component({ selector: 'app-clean-calc', standalone: true, template: \`...\` })
export class CleanCalcComponent {
  count = signal(1);
  multiplier = signal(2);

  // FIX 1: Use computed() for derived values instead of effects!
  total = computed(() => this.count() * this.multiplier());

  constructor() {
    // FIX 2: If effect is logging/auditing, use untracked() for non-triggering reads:
    effect(() => {
      const c = this.count(); // Tracked dependency
      const m = untracked(() => this.multiplier()); // NOT tracked!
      console.log(\`Audit Log: \${c} with multiplier \${m}\`);
    });
  }
}`,
    monitoringMetrics: [
      "Sentry exception logs tracking 'NG0600: Writing to signals is not allowed'",
      "Browser tab freezing immediately upon component initialization",
      "Application freeze accompanied by 100% single-core CPU utilization"
    ],
    productionChecklist: [
      "Never use `effect()` to derive state; use `computed()` signals instead.",
      "Avoid `{ allowSignalWrites: true }` in effects; it is almost always an architectural red flag.",
      "Wrap secondary signal reads in `untracked()` to prevent unintended dependency edge creation."
    ]
  },
  {
    id: "angular-prod-10",
    topic: "Missing Injection Context (NG0203) in Asynchronous Callbacks",
    category: "Dependency Injection",
    severity: "P0 / Application Runtime Failure",
    theProblem: "Calling `inject()`, `toSignal()`, or `takeUntilDestroyed()` inside an asynchronous callback (such as a `setTimeout`, `fetch.then()`, or RxJS operator) throws fatal error 'NG0203: inject() must be called from an injection context such as a constructor, a factory function, a field initializer'.",
    howItWorksInternally: "Angular's `inject()` function relies on an ambient global injection context tracked by a stack pointer in framework memory. When a component constructor or field initializer executes, Angular pushes the component's `Injector` onto this stack. As soon as the synchronous constructor returns, the injector is popped off. Asynchronous callbacks execute on subsequent event loop turns when the stack is empty, leaving Angular with no way to resolve dependencies.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Calling inject() inside async callback
@Component({ selector: 'app-async-broken', standalone: true, template: \`...\` })
export class AsyncBrokenComponent implements OnInit {
  ngOnInit() {
    setTimeout(() => {
      // CRASH: NG0203! Injection context was destroyed when constructor returned!
      const service = inject(DataService);
      service.fetch();
    }, 1000);
  }
}

// 2. PRODUCTION REMEDIATION: Inject at field declaration OR capture Injector
@Component({ selector: 'app-async-fixed', standalone: true, template: \`...\` })
export class AsyncFixedComponent implements OnInit {
  // FIX 1: Inject synchronously in field initializer:
  private service = inject(DataService);
  // FIX 2: Capture EnvironmentInjector for manual execution:
  private injector = inject(EnvironmentInjector);

  ngOnInit() {
    setTimeout(() => {
      // Safe option A: use pre-injected field
      this.service.fetch();

      // Safe option B: runInInjectionContext
      runInInjectionContext(this.injector, () => {
        const dynamicService = inject(DataService);
        dynamicService.fetch();
      });
    }, 1000);
  }
}`,
    monitoringMetrics: [
      "Unhandled JavaScript errors reporting 'NG0203: inject() must be called from an injection context'",
      "Failures during dynamic modal opening or asynchronous utility executions",
      "Regression errors introduced when converting constructor injection to inject()"
    ],
    productionChecklist: [
      "Declare all `inject()` assignments as class property initializers or inside `constructor()`.",
      "Never call `inject()` inside `ngOnInit()`, lifecycle hooks, or async promises.",
      "If deferred injection is strictly necessary, capture `EnvironmentInjector` and use `runInInjectionContext()`."
    ]
  },
  {
    id: "angular-prod-11",
    topic: "Monolithic Bundles via Eager Module & Standalone Imports",
    category: "Build Optimization & Bundling",
    severity: "P1 / Poor Core Web Vitals (LCP > 4s) on Mobile Networks",
    theProblem: "A developer imports a large third-party library (like Monaco Editor, Chart.js, or FullCalendar) or a legacy NgModule directly into the `imports: [...]` array of `AppComponent` or eager route components. The entire 2MB library is packed into the initial `main.js` bundle, forcing all users to download it on initial page load even if they never visit that feature.",
    howItWorksInternally: "When esbuild or Webpack encounters a static `import { HeavyChart } from './chart'` in an eagerly loaded component, the module graph marks that file and all its transitive dependencies as critical for initial bootstrap. The bundler cannot tree-shake or defer it, inflating the initial download payload and destroying Lighthouse scores.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Eagerly imported heavyweight component
@Component({
  selector: 'app-home-disaster',
  standalone: true,
  // BUG: Bundles 800kB chart library into initial main.js!
  imports: [MonolithicHeavyChartComponent],
  template: \`<app-monolithic-heavy-chart />\`
})
export class HomeDisasterComponent {}

// 2. PRODUCTION REMEDIATION: Deferrable Views (@defer) & Lazy Routes
@Component({
  selector: 'app-home-optimized',
  standalone: true,
  imports: [MonolithicHeavyChartComponent],
  template: \`
    <!-- Defer chunk creation: bundler extracts chart into lazy .js file! -->
    @defer (on viewport) {
      <app-monolithic-heavy-chart />
    } @placeholder {
      <div class="skeleton">Chart loads when scrolled into view...</div>
    }
  \`
})
export class HomeOptimizedComponent {}`,
    monitoringMetrics: [
      "Initial bundle size analyzer showing main.js exceeding 500kB",
      "Largest Contentful Paint (LCP) exceeding 3.5 seconds on 4G mobile connections",
      "High bundle size warnings generated during 'npm run build'"
    ],
    productionChecklist: [
      "Isolate third-party visual libraries behind `@defer (on viewport)` or lazy route boundaries.",
      "Inspect production chunk sizes using `source-map-explorer dist/*/main.js`.",
      "Set strict bundle budget thresholds in `angular.json` under `budgets`."
    ]
  },
  {
    id: "angular-prod-12",
    topic: "Mutating HttpRequest in Interceptors instead of Cloning",
    category: "Networking & Interceptors",
    severity: "P0 / Corrupted Request Payloads & Interceptor Failures",
    theProblem: "A custom HTTP interceptor attempts to mutate `req.headers` or `req.url` directly rather than calling `req.clone()`. The JavaScript engine throws a runtime error because `HttpRequest` properties are read-only, or the modification corrupts subsequent retry attempts across the network pipeline.",
    howItWorksInternally: "Angular's `HttpRequest` is deliberately frozen and immutable. This immutability ensures that when an HTTP request is retried (via `retry(3)` or a token refresh interceptor), the original pristine request configuration is preserved. Modifying headers directly (e.g. `req.headers.set('Authorization', token)`) returns a new HttpHeaders instance without applying it to the request unless `req.clone({ headers })` is invoked.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Mutating request without clone
export const brokenInterceptor: HttpInterceptorFn = (req, next) => {
  // BUG: req.headers.set() returns a NEW headers object!
  // The original req.headers remains completely unchanged!
  req.headers.set('Authorization', 'Bearer 123'); // Silent failure: header NOT sent!
  return next(req);
};

// 2. PRODUCTION REMEDIATION: Proper req.clone() with setHeaders
export const properInterceptor: HttpInterceptorFn = (req, next) => {
  // FIX: req.clone() creates a safe new instance with merged headers
  const authReq = req.clone({
    setHeaders: {
      Authorization: 'Bearer 123',
      'X-Client-Version': '2.1.0'
    }
  });
  return next(authReq);
};`,
    monitoringMetrics: [
      "Backend microservices reporting missing Authorization or API key headers",
      "Uncaught TypeErrors: 'Cannot assign to read only property of object HttpRequest'",
      "Intermittent failures on requests that trigger automatic retries"
    ],
    productionChecklist: [
      "Always use `req.clone({ setHeaders: { ... } })` to append or modify HTTP headers.",
      "Use `setHeaders` instead of `headers` to preserve existing content type and caching headers.",
      "Verify outgoing headers in browser DevTools Network tab during integration testing."
    ]
  },
  {
    id: "angular-prod-13",
    topic: "Detached DOM Node Leaks via Uncleaned Event Listeners",
    category: "DOM & Memory Management",
    severity: "P1 / Progressive Memory Exhaustion & Crash on Single-Page Sessions",
    theProblem: "A component attaches manual event listeners to native DOM nodes (`window`, `document`, or third-party canvas elements) inside `ngOnInit` using `Renderer2.listen` or native `addEventListener`, but fails to remove them in `ngOnDestroy`. The destroyed component instances and their entire DOM subtrees are held in memory permanently as detached DOM trees.",
    howItWorksInternally: "When an element is removed from the DOM tree, it can be garbage collected only if no active JavaScript references point to it. A global listener attached to `window.addEventListener('resize', this.onResize)` retains a reference to `this` (the component instance). The component in turn holds references to its template DOM nodes and data arrays. Because the window object never dies, the entire detached DOM tree remains in heap memory.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Uncleaned Renderer2 listener
@Component({ selector: 'app-leak-dom', standalone: true, template: \`...\` })
export class LeakDomComponent implements OnInit {
  private renderer = inject(Renderer2);

  ngOnInit() {
    // BUG: Listener returns a cleanup function, but it is discarded!
    this.renderer.listen('window', 'resize', () => {
      console.log('Resized');
    });
  }
}

// 2. PRODUCTION REMEDIATION: DestroyRef Cleanup Hook
@Component({ selector: 'app-clean-dom', standalone: true, template: \`...\` })
export class CleanDomComponent implements OnInit {
  private renderer = inject(Renderer2);
  private destroyRef = inject(DestroyRef);

  ngOnInit() {
    // FIX: Register the unlisten function directly with DestroyRef!
    const unlisten = this.renderer.listen('window', 'resize', () => {
      console.log('Clean resize');
    });

    this.destroyRef.onDestroy(() => {
      unlisten(); // Properly detached upon component destruction!
    });
  }
}`,
    monitoringMetrics: [
      "Chrome DevTools Memory Profiler showing detached HTMLDivElement counts growing on each navigation",
      "Heap memory steadily increasing after visiting and closing modals repeatedly",
      "Application crashes with 'Out of Memory' on long-lived customer support dashboards"
    ],
    productionChecklist: [
      "Always store the teardown function returned by `Renderer2.listen()` and invoke it in `onDestroy`.",
      "Prefer RxJS `fromEvent(window, 'event').pipe(takeUntilDestroyed())` over manual event listeners.",
      "Test component mount/unmount cycles in Chrome DevTools Memory Heap Snapshot."
    ]
  },
  {
    id: "angular-prod-14",
    topic: "Broken Track Expression in @for Destroying Input Focus",
    category: "Template Reconciliation & Forms",
    severity: "P1 / Broken Keyboard Focus, Jittery Lists & Lost Form Inputs",
    theProblem: "A developer uses built-in `@for` with `track $index` or an unstable track expression (like `track Math.random()`) on a dynamic collection of editable inputs or items that can be sorted, inserted, or filtered. When an item is added or reordered, input focus jumps to the wrong field, keystrokes are lost, and CSS transition animations glitch violently.",
    howItWorksInternally: "The Angular compiler uses the `track` expression to match incoming array items with existing DOM nodes during reconciliation. If you track by `$index`, Angular assumes that the first DOM element always corresponds to index 0. If you insert a new item at the top of the array, Angular rebinds index 0's existing DOM element to the new data rather than inserting a new DOM node, retaining the old element's internal state (such as focused `<input>`, text selection, or cursor position) in the wrong row.",
    productionCode: `// 1. DISASTER ANTI-PATTERN: Tracking by $index on dynamic editable list
@Component({
  selector: 'app-broken-list',
  standalone: true,
  template: \`
    <!-- BUG: When an item is prepended, focus remains on wrong input row! -->
    @for (item of items; track $index) {
      <div class="row">
        <input [value]="item.text" />
      </div>
    }
  \`
})
export class BrokenListComponent {
  items = [{ id: 'a1', text: 'First' }, { id: 'b2', text: 'Second' }];
}

// 2. PRODUCTION REMEDIATION: Track by Stable Unique Identity
@Component({
  selector: 'app-fixed-list',
  standalone: true,
  template: \`
    <!-- FIX: track item.id preserves exact DOM node identity and focus! -->
    @for (item of items; track item.id) {
      <div class="row">
        <input [value]="item.text" />
      </div>
    }
  \`
})
export class FixedListComponent {
  items = [{ id: 'a1', text: 'First' }, { id: 'b2', text: 'Second' }];
}`,
    monitoringMetrics: [
      "User complaints of text inputs losing focus or swapping contents while typing in tables",
      "Accessibility audit failures on keyboard navigation in editable data grids",
      "Visual flickering and stuttering during real-time WebSocket collection updates"
    ],
    productionChecklist: [
      "Always track by unique entity IDs (`track item.id` or `track item.uuid`) for dynamic collections.",
      "Only use `track $index` for completely static, immutable, read-only lists.",
      "Never use random functions or unstable object references in track expressions."
    ]
  }
];

const outputPath = path.resolve(__dirname, '../data/angular.production.json');
fs.writeFileSync(outputPath, JSON.stringify(productionRunbooks, null, 2), 'utf-8');
console.log(`Successfully wrote ${productionRunbooks.length} Production Mastery runbooks to ${outputPath}`);
