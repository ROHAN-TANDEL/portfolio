const { createCard } = require('../angular_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 13,
    category: "Dependency Injection & Hierarchical Injectors",
    concept: "Dependency Injection & The inject() Function",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is Dependency Injection in Angular, and how does the modern `inject()` function compare to constructor injection?",
    quickAnswer: "Dependency Injection (DI) is a design pattern where dependencies are supplied to a class rather than instantiated directly. The modern `inject(Service)` function allows injecting dependencies directly into property initializers and functions within an injection context, eliminating verbose constructor parameter boilerplate.",
    detailedAnswer: "Historically, all dependencies were injected via class constructors (`constructor(private http: HttpClient) {}`). This became tedious in class inheritance hierarchies because subclasses had to manually forward all parent dependencies via `super(http, auth, router)`. The `inject()` function (introduced in Angular 14) can be called in property declarations, constructor bodies, and functional route guards/interceptors. It provides better TypeScript type inference and makes functional compositions cleanly composable.",
    code: `import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

// 1. Modern inject() Pattern: Clean property initialization
@Component({
  selector: 'app-user-profile',
  standalone: true,
  template: \`<p>User Profile</p>\`
})
export class UserProfileComponent {
  private http = inject(HttpClient);
  private router = inject(Router);

  // No constructor needed!
}

// 2. Legacy Constructor Pattern (for comparison):
export class LegacyProfileComponent {
  constructor(
    private http: HttpClient,
    private router: Router
  ) {}
}`,
    recallHint: "inject(Service) initializes dependencies as class properties; eliminates constructor parameter boilerplate.",
    interviewTip: "Emphasize that `inject()` only works within an 'Injection Context' (during property initialization, in constructors, or inside `runInInjectionContext`). It cannot be called inside asynchronous callbacks.",
    tags: ["dependency-injection", "inject", "di-tokens", "angular14"],
    practice: [
      "Where can the `inject()` function be legally invoked in an Angular application?",
      "How does `inject()` solve the constructor inheritance `super()` problem?"
    ]
  }),

  createCard({
    idNum: 14,
    category: "Dependency Injection & Hierarchical Injectors",
    concept: "providedIn: 'root' & Tree-Shakable Services",
    priority: "must-know",
    difficulty: "beginner",
    question: "What does `@Injectable({ providedIn: 'root' })` mean, and how does it enable tree-shaking?",
    quickAnswer: "`providedIn: 'root'` registers a service with the root `EnvironmentInjector` as an application-wide singleton. It enables tree-shaking: if no component imports or injects the service, the compiler completely strips it from the final production bundle.",
    detailedAnswer: "In older Angular versions, services had to be explicitly declared in an `NgModule({ providers: [MyService] })`. Because the module explicitly referenced the service, the bundler was forced to include the service code in the bundle, even if no component ever used it. With `@Injectable({ providedIn: 'root' })`, the dependency arrow is reversed: the service points to the injector, not vice versa. If nothing references `MyService`, the compiler's dead-code elimination removes it.",
    code: `import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root' // Singleton across the entire application, tree-shakable!
})
export class AuthService {
  private currentUser = signal<{ id: string; name: string } | null>(null);

  getUser() {
    return this.currentUser.asReadonly();
  }

  login(user: { id: string; name: string }) {
    this.currentUser.set(user);
  }
}`,
    recallHint: "providedIn: 'root' = app singleton + tree-shakable (stripped if unused).",
    interviewTip: "Mention alternative `providedIn` values: `providedIn: 'platform'` for services shared across multiple Angular applications on the same page, or omitting it for component-scoped providers.",
    tags: ["injectable", "providedIn", "tree-shaking", "singleton"],
    practice: [
      "Why did declaring services in NgModule providers prevent tree-shaking?",
      "When is a service provided in 'root' instantiated (on app startup or on first injection)?"
    ]
  }),

  createCard({
    idNum: 15,
    category: "Dependency Injection & Hierarchical Injectors",
    concept: "Hierarchical Injector Tree: EnvironmentInjector vs ElementInjector",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the architectural distinction between the `EnvironmentInjector` hierarchy and the `ElementInjector` hierarchy in Angular?",
    quickAnswer: "Angular has two parallel injector hierarchies: 1) `EnvironmentInjector` (Platform -> Root -> Route providers): manages application singletons and route-scoped services; 2) `ElementInjector` (Component/Directive DOM tree): manages component-scoped services and DOM element providers.",
    detailedAnswer: "When Angular resolves a dependency, it searches the `ElementInjector` tree first: starting at the requesting component's node, walking up through parent components and directives to the root component. If not found in the ElementInjector tree, it falls back to the `EnvironmentInjector` tree: checking the active Route providers, then the Root injector (`providedIn: 'root'`), and finally the Platform injector. This dual-tree hierarchy allows localized service scoping alongside global singletons.",
    code: `// 1. EnvironmentInjector: Route-scoped service
export const routes: Route[] = [
  {
    path: 'admin',
    providers: [AdminAuditService], // Scoped to this route's EnvironmentInjector
    loadComponent: () => import('./admin.component')
  }
];

// 2. ElementInjector: Component-scoped instance (New instance per component!)
@Component({
  selector: 'app-ticket-editor',
  standalone: true,
  providers: [TicketDraftStore], // New instance created in this ElementInjector!
  template: \`<p>Draft Editor</p>\`
})
export class TicketEditorComponent {
  private store = inject(TicketDraftStore); // Private to this ticket editor!
}`,
    recallHint: "ElementInjector = DOM component tree (local instances); EnvironmentInjector = route/root hierarchy (singletons).",
    interviewTip: "Understand search order: Angular ALWAYS searches the ElementInjector tree up to the root component before checking EnvironmentInjectors.",
    tags: ["hierarchical-di", "EnvironmentInjector", "ElementInjector", "resolution-rules"],
    practice: [
      "In what exact sequence does Angular search for a requested injection token?",
      "Why does providing a service in a component's `providers: []` create a new instance for each component instance?"
    ]
  }),

  createCard({
    idNum: 16,
    category: "Dependency Injection & Hierarchical Injectors",
    concept: "Injection Tokens (InjectionToken<T>)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why does Angular use `InjectionToken<T>` for non-class dependencies, and how do you configure factory providers with it?",
    quickAnswer: "TypeScript interfaces and types are erased at compile time and do not exist at runtime in JavaScript. `InjectionToken<T>` provides a real runtime object reference that can be used as a DI lookup key for primitives, configurations, interfaces, and third-party APIs.",
    detailedAnswer: "When you inject a class (`inject(UserService)`), the class constructor function exists at runtime and serves as its own injection token. But if you want to inject an API URL string or an interface configuration (`AppConfig`), interfaces vanish during compilation. `new InjectionToken<T>('description')` creates a unique runtime symbol. It can also define a default factory using `factory: () => ...`, creating tree-shakable tokens without needing explicit provider arrays.",
    code: `import { InjectionToken, inject } from '@angular/core';

export interface AppConfig {
  apiUrl: string;
  maxRetries: number;
}

// 1. Create runtime Injection Token with default tree-shakable factory:
export const APP_CONFIG = new InjectionToken<AppConfig>('app.config', {
  providedIn: 'root',
  factory: () => ({
    apiUrl: 'https://api.acme.com/v1',
    maxRetries: 3
  })
});

// 2. Consuming the token in any component or service:
export class ApiService {
  private config = inject(APP_CONFIG);

  fetchData() {
    console.log('Target URL:', this.config.apiUrl);
  }
}`,
    recallHint: "InjectionToken<T> provides a runtime DI key for interfaces and primitives (which vanish at compile time).",
    interviewTip: "Highlight the `factory` option in `InjectionToken` options: it allows tokens to be self-providing and tree-shakable without cluttering `appConfig.providers`.",
    tags: ["InjectionToken", "runtime-tokens", "interfaces", "di-configuration"],
    practice: [
      "Why can't you write `@Inject(MyInterface)` using TypeScript interfaces directly?",
      "How do you override an InjectionToken value in a specific component or test module?"
    ]
  }),

  createCard({
    idNum: 17,
    category: "Dependency Injection & Hierarchical Injectors",
    concept: "Provider Types: useClass, useValue, useFactory, useExisting",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the four primary provider configuration recipes (`useClass`, `useValue`, `useFactory`, `useExisting`) in Angular DI?",
    quickAnswer: "1) `useClass`: Instantiates a specified class; 2) `useValue`: Injects a static value or object literal; 3) `useFactory`: Executes a factory function with injected dependencies; 4) `useExisting`: Aliases one existing token to another without creating a second instance.",
    detailedAnswer: "These recipes configure how Angular instantiates and resolves dependencies: `useClass` is used for swapping implementations (e.g. `useClass: MockAnalyticsService` in tests). `useValue` is used for static configs. `useFactory` handles dynamic runtime initialization (e.g. initializing an SDK based on user environment). `useExisting` aliases an existing provider (preventing duplicate instances when exposing an interface).",
    code: `import { Provider } from '@angular/core';

export const customProviders: Provider[] = [
  // 1. useClass: Swaps class implementation
  { provide: LoggerService, useClass: ProductionLoggerService },

  // 2. useValue: Injects static object literal
  { provide: API_BASE_URL, useValue: 'https://production.api.com' },

  // 3. useFactory: Dynamic initialization with dependencies
  {
    provide: FEATURE_FLAGS,
    useFactory: (http: HttpClient) => {
      return http.get('/api/flags');
    },
    deps: [HttpClient]
  },

  // 4. useExisting: Alias to an existing singleton (avoiding duplicate instance!)
  { provide: MinimalLogger, useExisting: LoggerService }
];`,
    recallHint: "useClass (instantiate class), useValue (static value), useFactory (dynamic function), useExisting (alias).",
    interviewTip: "Make sure to explain the difference between `useClass` and `useExisting`: `useClass` creates a *new* instance of the class; `useExisting` aliases an *already created* instance.",
    tags: ["providers", "useClass", "useValue", "useFactory", "useExisting"],
    practice: [
      "What is the difference between `useClass: ServiceA` and `useExisting: ServiceA`?",
      "How does `useFactory` receive dependencies in modern standalone Angular?"
    ]
  }),

  createCard({
    idNum: 18,
    category: "Dependency Injection & Hierarchical Injectors",
    concept: "Multi-Providers (multi: true)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What does `multi: true` do in Angular provider configurations, and how does it power plugin and middleware architectures?",
    quickAnswer: "`multi: true` tells Angular's DI system that multiple providers can contribute to the same injection token, returning an array of all provided values when injected (`inject(TOKEN)` returns `T[]`).",
    detailedAnswer: "Normally, defining `{ provide: MY_TOKEN, useValue: A }` followed by `{ provide: MY_TOKEN, useValue: B }` overrides the token so only `B` is returned. Adding `multi: true` to both providers aggregates values into an array: `[A, B]`. This is how core Angular extension points work: `HTTP_INTERCEPTORS` (multiple HTTP interceptors), `APP_INITIALIZER` (multiple startup tasks), and `NG_VALIDATORS` (custom form validators).",
    code: `import { InjectionToken, Provider } from '@angular/core';

export interface Plugin {
  name: string;
  execute(): void;
}

export const APP_PLUGINS = new InjectionToken<Plugin[]>('app.plugins');

// Multiple feature modules register their own plugins to the same token:
export const pluginProviders: Provider[] = [
  { provide: APP_PLUGINS, useClass: AnalyticsPlugin, multi: true },
  { provide: APP_PLUGINS, useClass: AuditLogPlugin, multi: true },
  { provide: APP_PLUGINS, useClass: SentryPlugin, multi: true }
];

// Consuming the multi-provider token:
export class PluginRunnerService {
  // Injects an array of all registered plugins: [AnalyticsPlugin, AuditLogPlugin, SentryPlugin]
  private plugins = inject(APP_PLUGINS);

  runAll() {
    this.plugins.forEach(p => p.execute());
  }
}`,
    recallHint: "multi: true aggregates multiple providers under one token into an array T[]; powers HTTP_INTERCEPTORS and plugins.",
    interviewTip: "Warn that if you forget `multi: true` on even a single provider in the chain, Angular throws an error: 'Cannot mix multi-providers and regular providers'.",
    tags: ["multi-providers", "plugins", "HTTP_INTERCEPTORS", "APP_INITIALIZER"],
    practice: [
      "What error occurs if one provider has `multi: true` and another provider for the same token omits it?",
      "How did legacy HTTP_INTERCEPTORS use multi-providers before functional interceptors?"
    ]
  }),

  createCard({
    idNum: 19,
    category: "Dependency Injection & Hierarchical Injectors",
    concept: "DI Resolution Modifiers: @Self, @SkipSelf, @Optional, @Host",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are Angular's four DI Resolution Modifiers (`@Self`, `@SkipSelf`, `@Optional`, `@Host`) and their `inject()` options equivalents?",
    quickAnswer: "1) `self`: Checks only the current element injector; 2) `skipSelf`: Skips current element and starts search at parent; 3) `optional`: Returns null instead of throwing if not found; 4) `host`: Searches up to the host component boundary.",
    detailedAnswer: "By default, Angular searches from the current component up through ancestors to the root injector, throwing `NullInjectorError` if unresolved. Resolution modifiers constrain this search. In modern Angular with `inject()`, these are passed as an options object: `inject(Service, { self: true, optional: true })`. `skipSelf` is essential when a component provides a service and also needs to inject the *parent's* instance of that same service (e.g. nested accordion items).",
    code: `import { Component, inject } from '@angular/core';
import { LoggerService } from './logger.service';

@Component({
  selector: 'app-nested-tree',
  standalone: true,
  template: \`<p>Tree Node</p>\`
})
export class NestedTreeNodeComponent {
  // 1. optional: Doesn't crash if LoggerService is not provided (returns null)
  private logger = inject(LoggerService, { optional: true });

  // 2. skipSelf: Injects the PARENT's instance of TreeNode, not its own!
  private parentNode = inject(NestedTreeNodeComponent, { 
    skipSelf: true, 
    optional: true 
  });

  // 3. self: Checks ONLY this component's providers: [] array
  private localService = inject(LocalService, { self: true });
}`,
    recallHint: "self (current only), skipSelf (parent only), optional (null if missing), host (within host boundary).",
    interviewTip: "Highlight that `inject(Token, { optional: true, skipSelf: true })` replaces the older `@Optional() @SkipSelf()` constructor decorators completely.",
    tags: ["resolution-modifiers", "skipSelf", "optional", "self", "host"],
    practice: [
      "Why is `skipSelf: true` necessary when implementing nested recursive tree or menu components?",
      "What is the difference between `@Self()` and `@Host()` in components with projected content?"
    ]
  }),

  createCard({
    idNum: 20,
    category: "Dependency Injection & Hierarchical Injectors",
    concept: "viewProviders vs providers in Components",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the critical visibility difference between `providers: []` and `viewProviders: []` in an Angular component?",
    quickAnswer: "`providers: []` makes the service available to the component, its view template, AND any projected content (`<ng-content>`). `viewProviders: []` makes the service visible ONLY to the component's own view template, hiding it from projected content.",
    detailedAnswer: "When designing reusable container components (like a Form or Accordion), you often want to prevent projected child components from accidentally injecting or mutating internal container services. Services listed in `viewProviders` are scoped strictly to the component's own HTML template. If a child element projected via `<ng-content>` attempts to inject that service, Angular skips the container and searches higher up the tree.",
    code: `// Container Component:
@Component({
  selector: 'app-secure-panel',
  standalone: true,
  template: \`
    <div class="panel-wrapper">
      <app-panel-header /> <!-- Own view child: CAN inject InternalPanelState -->
      <ng-content />       <!-- Projected child: CANNOT inject InternalPanelState! -->
    </div>
  \`,
  // Visible ONLY to own view, invisible to projected content:
  viewProviders: [InternalPanelState]
})
export class SecurePanelComponent {}

// Consumer Template:
// <app-secure-panel>
//   <!-- ProjectedComponent will throw NullInjectorError if it tries to inject InternalPanelState! -->
//   <app-projected-widget /> 
// </app-secure-panel>`,
    recallHint: "providers = visible to own template AND projected content; viewProviders = visible ONLY to own template.",
    interviewTip: "Explain this distinction when discussing component encapsulation in enterprise design systems: `viewProviders` prevents projected content from coupling to internal container state.",
    tags: ["viewProviders", "providers", "content-projection", "encapsulation"],
    practice: [
      "Can a component in `<ng-content>` inject a service declared in `viewProviders` of its host?",
      "Why are reactive form directives (`ControlContainer`) often declared in `viewProviders`?"
    ]
  }),

  createCard({
    idNum: 21,
    category: "Dependency Injection & Hierarchical Injectors",
    concept: "Circular Dependencies & forwardRef in DI",
    priority: "must-know",
    difficulty: "advanced",
    question: "What causes circular dependency errors in Angular DI, and how does `forwardRef()` resolve them?",
    quickAnswer: "Circular dependencies occur when Class A references Class B before Class B has been defined in JavaScript. `forwardRef(() => ClassB)` passes a closure callback that Angular evaluates lazily at runtime after both classes have been defined.",
    detailedAnswer: "In JavaScript, classes are not hoisted. If Class A imports and injects Class B, and Class B imports and injects Class A, one of the class references will evaluate to `undefined` during module execution, triggering `NullInjectorError` or runtime reference errors. `forwardRef(() => ClassName)` wraps the token in a lambda function that Angular invokes lazily when constructing the injector, breaking the circular loading deadlock.",
    code: `import { Component, Inject, forwardRef, inject } from '@angular/core';

// Parent Accordion and Child AccordionItem reference each other:
@Component({
  selector: 'app-accordion-item',
  standalone: true,
  template: \`<p>Item Content</p>\`
})
export class AccordionItemComponent {
  // forwardRef allows referencing AccordionComponent before it is compiled:
  constructor(
    @Inject(forwardRef(() => AccordionComponent)) private parent: AccordionComponent
  ) {}
}

@Component({
  selector: 'app-accordion',
  standalone: true,
  imports: [AccordionItemComponent],
  template: \`<ng-content />\`
})
export class AccordionComponent {
  // References AccordionItemComponent
}`,
    recallHint: "forwardRef(() => Class) defers token resolution until runtime; breaks circular class loading deadlocks.",
    interviewTip: "Emphasize that while `forwardRef` fixes the runtime error, true architectural circular dependencies should be refactored by introducing a shared interface, service, or InjectionToken.",
    tags: ["forwardRef", "circular-dependency", "lazy-token", "di-internals"],
    practice: [
      "Why does JavaScript evaluate one of the classes as undefined in circular imports?",
      "How can circular dependencies be resolved cleanly without using forwardRef?"
    ]
  }),

  createCard({
    idNum: 22,
    category: "Dependency Injection & Hierarchical Injectors",
    concept: "Injection Context & runInInjectionContext",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is an Injection Context in Angular, and how do you use `runInInjectionContext` to run code requiring `inject()` outside standard lifecycles?",
    quickAnswer: "An Injection Context is an execution environment where the active `EnvironmentInjector` is available. Calling `inject()` outside an injection context throws `NG0203`. `runInInjectionContext(injector, () => { ... })` manually establishes an injection context.",
    detailedAnswer: "Angular sets the active injection context during class instantiation (constructor and property initializers), in functional route guards/resolvers, and in `APP_INITIALIZER`. If you attempt to call `inject()` inside an asynchronous callback (e.g. `setTimeout`, `fetch.then()`, or an RxJS operator), the injection context has already been torn down. In Angular 16+, `runInInjectionContext` allows passing an `Injector` reference to run arbitrary functions that use `inject()`.",
    code: `import { Injector, runInInjectionContext, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';

export class DynamicPluginLoader {
  // Capture injector during constructor injection context:
  private injector = inject(Injector);

  async executeAsyncPlugin(pluginFn: () => void) {
    // Some time later inside async callback (where injection context is lost):
    await fetch('/api/ready');

    // Manually restore injection context!
    runInInjectionContext(this.injector, () => {
      // Valid! Can now call inject() dynamically inside pluginFn!
      pluginFn();
    });
  }
}

// Plugin function calling inject() outside a component:
function myPlugin() {
  const http = inject(HttpClient);
  console.log('Successfully injected HttpClient inside dynamic plugin!');
}`,
    recallHint: "inject() throws NG0203 outside injection context; runInInjectionContext(injector, fn) restores context.",
    interviewTip: "This is a frequent Angular 16+ interview question: knowing what `NG0203` means and how to use `runInInjectionContext` demonstrates mastery of modern functional Angular APIs.",
    tags: ["injection-context", "runInInjectionContext", "NG0203", "angular16"],
    practice: [
      "What causes the NG0203 error in Angular?",
      "Why can't `inject()` be called inside a standard `ngOnInit()` method?"
    ]
  }),

  createCard({
    idNum: 23,
    category: "Dependency Injection & Hierarchical Injectors",
    concept: "Component-Level Providers for State Isolation",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When should you provide a service inside a component's `@Component({ providers: [...] })` rather than `providedIn: 'root'`?",
    quickAnswer: "Provide a service in a component's `providers: []` when you need an isolated, independent state instance dedicated to that component subtree, which automatically gets destroyed when the component unmounts.",
    detailedAnswer: "Services provided in `root` are singletons shared across the entire application. If you have a complex widget (such as a Document Editor or Chat Window) that can be opened in multiple tabs or sidebars simultaneously, a singleton service would cause Tab A and Tab B to overwrite each other's draft state. Providing `DocumentEditorStore` in the component's `providers: []` creates a fresh, isolated store instance for every mounted editor instance and destroys it when closed.",
    code: `import { Component, Injectable, signal, inject } from '@angular/core';

// Isolated state store: NOT providedIn: 'root'!
@Injectable()
export class EditorLocalStore {
  draft = signal<string>('');
}

@Component({
  selector: 'app-document-editor',
  standalone: true,
  // Creates a NEW, isolated instance of EditorLocalStore for EACH editor on screen!
  providers: [EditorLocalStore],
  template: \`
    <div class="editor">
      <textarea [value]="store.draft()" (input)="store.draft.set($event.target.value)" />
    </div>
  \`
})
export class DocumentEditorComponent {
  // Injects the local isolated store instance:
  protected store = inject(EditorLocalStore);
}`,
    recallHint: "Component providers: [] creates isolated instance per component and auto-destroys on unmount.",
    interviewTip: "Highlight the automatic garbage collection: services created via component-level ElementInjectors call their `ngOnDestroy()` hook and are garbage collected automatically when the component unmounts.",
    tags: ["component-providers", "state-isolation", "element-injector", "lifecycle"],
    practice: [
      "Does a service provided in component providers: [] call ngOnDestroy when the component unmounts?",
      "What happens if two sibling components both inject a service provided in their parent's providers: []?"
    ]
  }),

  createCard({
    idNum: 24,
    category: "Dependency Injection & Hierarchical Injectors",
    concept: "DestroyRef & takeUntilDestroyed Integration",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is `DestroyRef` and how does `takeUntilDestroyed()` modernize subscription management in Angular 16+?",
    quickAnswer: "`DestroyRef` provides a lifecycle hook callback (`onDestroy`) registered directly via DI without needing the component to implement `OnDestroy`. `takeUntilDestroyed()` automatically unsubscribes RxJS observables when the enclosing component/service destroys.",
    detailedAnswer: "Historically, developers had to create a `private destroy$ = new Subject<void>()`, call `pipe(takeUntil(this.destroy$))`, and implement `ngOnDestroy() { this.destroy$.next(); }`. Angular 16 introduced `DestroyRef` and the `takeUntilDestroyed()` operator. When called in an injection context (constructor or property declaration), `takeUntilDestroyed()` resolves `DestroyRef` automatically and cleanly terminates the stream upon component destruction with zero boilerplate.",
    code: `import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';

@Component({
  selector: 'app-stream-monitor',
  standalone: true,
  template: \`<p>Stream Active</p>\`
})
export class StreamMonitorComponent {
  constructor() {
    // takeUntilDestroyed() automatically binds to this component's DestroyRef!
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(tick => {
        console.log('Tick:', tick); // Automatically terminates on unmount!
      });
  }
}`,
    recallHint: "takeUntilDestroyed() uses DestroyRef to auto-unsubscribe RxJS streams on component destruction.",
    interviewTip: "If called outside an injection context (e.g. inside `ngOnInit`), mention that you must pass `DestroyRef` explicitly: `takeUntilDestroyed(this.destroyRef)`.",
    tags: ["DestroyRef", "takeUntilDestroyed", "rxjs-interop", "angular16"],
    practice: [
      "Can DestroyRef be injected and used inside services providedIn: 'root'?",
      "How do you use `takeUntilDestroyed()` inside `ngOnInit` where the injection context is absent?"
    ]
  })
];
