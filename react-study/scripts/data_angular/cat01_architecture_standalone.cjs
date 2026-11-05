const { createCard } = require('../angular_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 1,
    category: "Angular Architecture, Standalone Components & Directives",
    concept: "Modern Angular Architecture & Standalone Components",
    priority: "must-know",
    difficulty: "beginner",
    question: "What are Standalone Components in modern Angular, and how do they eliminate the complexity of NgModules?",
    quickAnswer: "Standalone components are self-contained Angular components that declare `standalone: true` and specify their dependencies directly in their `imports` array, completely removing the requirement for NgModules (`@NgModule`).",
    detailedAnswer: "In Angular 14+, standalone components became available and in Angular 17+ they became the default. Previously, every component had to be declared in an `NgModule`, leading to indirection, bloated shared modules, and confusing imports. Standalone components directly import what they need (other standalone components, directives, pipes, or modules like `CommonModule`). This simplifies the mental model, enables tree-shaking, and makes lazy loading straightforward via `loadComponent: () => import(...)`.",
    code: `import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UserAvatarComponent } from './user-avatar.component';

@Component({
  selector: 'app-user-card',
  standalone: true, // Default in modern Angular (17+)
  imports: [CommonModule, UserAvatarComponent], // Direct dependencies
  template: \`
    <div class="user-card">
      <app-user-avatar [src]="user.avatar" />
      <h3>{{ user.name }}</h3>
    </div>
  \`
})
export class UserCardComponent {
  user = { name: 'Alice', avatar: '/avatar.png' };
}`,
    recallHint: "standalone: true + direct imports array; eliminates NgModule indirection and enables cleaner lazy loading.",
    interviewTip: "Highlight that modern Angular bootstraps applications using `bootstrapApplication(AppComponent, appConfig)` rather than `platformBrowserDynamic().bootstrapModule(AppModule)`.",
    tags: ["standalone", "components", "architecture", "angular17"],
    practice: [
      "How do you bootstrap an Angular standalone application in main.ts?",
      "Can a standalone component import an existing legacy NgModule?"
    ]
  }),

  createCard({
    idNum: 2,
    category: "Angular Architecture, Standalone Components & Directives",
    concept: "Component Decorator Metadata & Properties",
    priority: "must-know",
    difficulty: "beginner",
    question: "What are the core properties of the `@Component` decorator in Angular and what roles do they serve?",
    quickAnswer: "`@Component` marks a class as an Angular component and provides configuration: `selector` (CSS element tag), `standalone` (boolean), `imports` (dependencies), `template` / `templateUrl` (view markup), `styles` / `styleUrls` (scoped styles), and `changeDetection` (strategy).",
    detailedAnswer: "The `@Component` decorator is a TypeScript class decorator that attaches Ivy compiler metadata to the class. `selector` specifies the custom HTML tag used to instantiate the component. `template` or `templateUrl` defines the HTML view. `styles` defines CSS scoped via Angular's view encapsulation. `imports` lists other standalone components/directives needed by this template, and `changeDetection` configures default or OnPush change detection.",
    code: `@Component({
  selector: 'app-metric-gauge',
  standalone: true,
  imports: [],
  templateUrl: './metric-gauge.component.html',
  styleUrls: ['./metric-gauge.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MetricGaugeComponent {
  // Component logic and state
}`,
    recallHint: "selector (tag), standalone (true), imports (deps), template (view), styles (CSS), changeDetection (strategy).",
    interviewTip: "Mention that starting in Angular 17, `styleUrl` (singular string) is supported as an alternative to `styleUrls` (array) when referencing a single stylesheet.",
    tags: ["component", "decorator", "metadata", "ivy"],
    practice: [
      "What is the difference between inline `template` and `templateUrl`?",
      "Can a component have multiple stylesheets in `styleUrls`?"
    ]
  }),

  createCard({
    idNum: 3,
    category: "Angular Architecture, Standalone Components & Directives",
    concept: "Input Transforms & Required Inputs",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do modern Angular Input Transforms (`transform: booleanAttribute / numberAttribute`) and required inputs simplify component APIs?",
    quickAnswer: "Input transforms (`@Input({ transform: booleanAttribute })`) automatically coerce incoming HTML attribute values (like empty strings in `<app-btn disabled />`) into booleans or numbers. Required inputs (`@Input({ required: true })`) enforce compile-time errors if a consumer omits the input.",
    detailedAnswer: "Historically in Angular, writing `<custom-button disabled></custom-button>` passed an empty string `\"\"` to the `@Input() disabled: boolean` property, which was truthy in JavaScript but required manual getter/setter boolean coercion boilerplate. Angular 16+ introduced input transforms: pre-built utilities like `booleanAttribute` and `numberAttribute` or custom functions that transform the incoming value before setting the property. The `required: true` flag ensures the template type-checker errors if the input is omitted.",
    code: `import { Component, Input, booleanAttribute, numberAttribute } from '@angular/core';

@Component({
  selector: 'app-badge',
  standalone: true,
  template: \`<span [class.active]="isActive">{{ count }}</span>\`
})
export class BadgeComponent {
  // Compiles with error if 'count' is omitted:
  @Input({ required: true, transform: numberAttribute }) count: number = 0;

  // Handles <app-badge active /> seamlessly:
  @Input({ transform: booleanAttribute }) isActive: boolean = false;

  // Custom transform function:
  @Input({ transform: (v: string) => v.trim().toUpperCase() }) label: string = '';
}`,
    recallHint: "transform: booleanAttribute coerces <tag active /> to true; required: true causes build-time error if omitted.",
    interviewTip: "Note that in Angular 17.1+, signal inputs (`count = input.required<number>()`) provide an even cleaner, fully reactive API with built-in transform support.",
    tags: ["inputs", "input-transforms", "booleanAttribute", "angular16"],
    practice: [
      "Why did `<custom-component disabled>` historically fail with boolean inputs without transforms?",
      "How do you write a custom transform function for an @Input()?"
    ]
  }),

  createCard({
    idNum: 4,
    category: "Angular Architecture, Standalone Components & Directives",
    concept: "HostBinding, HostListener & The host Property",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between `@HostBinding` / `@HostListener` decorators and the modern `host: {}` component metadata property?",
    quickAnswer: "`@HostBinding` binds properties/classes to the host DOM element, and `@HostListener` listens to host events. Modern Angular prefers the `host: {}` metadata object in `@Component` because it is declarative, avoids decorator clutter, and is fully inherited by child components.",
    detailedAnswer: "A component's host element is the outer custom HTML tag itself (e.g. `<app-user-card>`). Historically, developers used `@HostBinding('class.active') isActive = true` and `@HostListener('click', ['$event']) onClick()`. However, the Angular team now recommends configuring host attributes, class bindings, and event listeners directly inside the `@Component({ host: { ... } })` property. This approach provides better performance, is easier to read, and works seamlessly with standalone directives.",
    code: `// Modern Recommended Pattern: host: {} metadata
@Component({
  selector: 'app-expandable-card',
  standalone: true,
  template: \`<ng-content />\`,
  host: {
    'role': 'region',
    '[class.expanded]': 'isExpanded',
    '[attr.aria-expanded]': 'isExpanded',
    '(click)': 'toggleExpand()',
    '(keydown.enter)': 'toggleExpand()'
  }
})
export class ExpandableCardComponent {
  isExpanded = false;

  toggleExpand() {
    this.isExpanded = !this.isExpanded;
  }
}`,
    recallHint: "host: { '[class.active]': 'isActive', '(click)': 'onClick()' } binds directly to the outer custom element tag.",
    interviewTip: "Mention that the `host` property avoids decorator-related subclass inheritance issues that often plagued `@HostBinding` in legacy code.",
    tags: ["host", "host-binding", "host-listener", "best-practices"],
    practice: [
      "What is the host element of an Angular component?",
      "Can host bindings set CSS variables or custom data attributes?"
    ]
  }),

  createCard({
    idNum: 5,
    category: "Angular Architecture, Standalone Components & Directives",
    concept: "Directive Composition API (Host Directives)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the Directive Composition API (`hostDirectives`) introduced in Angular 15, and how does it replace multi-class inheritance?",
    quickAnswer: "The Directive Composition API allows components or directives to apply other directives directly to their own host element via `hostDirectives: [...]`, promoting composition over inheritance.",
    detailedAnswer: "In Angular, a component cannot inherit from multiple base classes to reuse behaviors (like tooltip behavior, keyboard focus, and ripple effects). With `hostDirectives`, a component can compose standalone directives onto itself without needing to declare them in its template. The component can also selectively forward and rename the host directive's inputs and outputs, exposing them as its own public API.",
    code: `import { Component, Directive, Input } from '@angular/core';

// Reusable Standalone Directives
@Directive({ selector: '[appRipple]', standalone: true })
export class RippleDirective { /* ... */ }

@Directive({ selector: '[appTooltip]', standalone: true })
export class TooltipDirective {
  @Input('appTooltip') text = '';
}

// Component composing both directives onto its own host element:
@Component({
  selector: 'app-action-button',
  standalone: true,
  template: \`<button><ng-content /></button>\`,
  hostDirectives: [
    RippleDirective,
    {
      directive: TooltipDirective,
      inputs: ['appTooltip: tooltipText'] // Expose directive input as 'tooltipText'
    }
  ]
})
export class ActionButtonComponent {}`,
    recallHint: "hostDirectives: [DirA, { directive: DirB, inputs: [...] }] composes behaviors onto host element.",
    interviewTip: "Emphasize that directives used in `hostDirectives` MUST be standalone (`standalone: true`).",
    tags: ["hostDirectives", "composition", "directives", "angular15"],
    practice: [
      "Can host directives forward outputs as well as inputs?",
      "What are the advantages of hostDirectives over traditional TypeScript class inheritance?"
    ]
  }),

  createCard({
    idNum: 6,
    category: "Angular Architecture, Standalone Components & Directives",
    concept: "Component Lifecycle Hooks & Execution Sequence",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the exact execution sequence of Angular Component Lifecycle Hooks from instantiation to destruction?",
    quickAnswer: "Order: `constructor` -> `ngOnChanges` -> `ngOnInit` -> `ngDoCheck` -> `ngAfterContentInit` -> `ngAfterContentChecked` -> `ngAfterViewInit` -> `ngAfterViewChecked` -> `ngOnDestroy`.",
    detailedAnswer: "1) `constructor`: Class instantiation and DI; inputs are NOT yet available. 2) `ngOnChanges`: Fires when `@Input()` properties change, receiving a `SimpleChanges` map. 3) `ngOnInit`: Fires once after the first `ngOnChanges`; optimal place for initial data fetching and setup. 4) `ngDoCheck`: Custom change detection check. 5) `ngAfterContentInit` / `Checked`: Projected `<ng-content>` is initialized. 6) `ngAfterViewInit` / `Checked`: The component's own template DOM and `@ViewChild` references are fully initialized. 7) `ngOnDestroy`: Cleanup before DOM destruction.",
    code: `import { Component, OnInit, OnChanges, AfterViewInit, OnDestroy, SimpleChanges, Input } from '@angular/core';

@Component({ selector: 'app-lifecycle-demo', standalone: true, template: \`<div>{{ id }}</div>\` })
export class LifecycleDemoComponent implements OnInit, OnChanges, AfterViewInit, OnDestroy {
  @Input() id = '';

  constructor() {
    // Inputs are NOT yet set here!
    console.log('1. constructor');
  }

  ngOnChanges(changes: SimpleChanges) {
    console.log('2. ngOnChanges', changes);
  }

  ngOnInit() {
    // Inputs are available! Ideal for subscriptions and setup:
    console.log('3. ngOnInit', this.id);
  }

  ngAfterViewInit() {
    // DOM template and @ViewChild elements are ready:
    console.log('4. ngAfterViewInit');
  }

  ngOnDestroy() {
    // Teardown timers and subscriptions:
    console.log('5. ngOnDestroy');
  }
}`,
    recallHint: "constructor -> OnChanges -> OnInit -> DoCheck -> AfterContentInit -> AfterViewInit -> OnDestroy.",
    interviewTip: "Never manipulate DOM elements in `ngOnInit`; `@ViewChild` queries are only guaranteed to be resolved in `ngAfterViewInit`.",
    tags: ["lifecycle", "hooks", "ngOnInit", "ngAfterViewInit", "ngOnDestroy"],
    practice: [
      "Why is constructor not recommended for API data fetching in Angular components?",
      "What is the difference between `AfterContentInit` and `AfterViewInit`?"
    ]
  }),

  createCard({
    idNum: 7,
    category: "Angular Architecture, Standalone Components & Directives",
    concept: "ViewChild, ViewChildren, ContentChild & ContentChildren",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between `@ViewChild` and `@ContentChild` in Angular, and when is `static: true` required?",
    quickAnswer: "`@ViewChild` queries elements or components declared inside the component's *own template*. `@ContentChild` queries elements projected into the component via `<ng-content>`. `static: true` resolves the query before `ngOnInit` (only if the element is not wrapped in conditional blocks like `@if`).",
    detailedAnswer: "View queries inspect the private view of the component. Content queries inspect elements supplied by the consumer between the component's opening and closing tags. If a query is marked `static: true`, Angular resolves it during change detection initialization, making it accessible in `ngOnInit`. If `static: false` (the default), it resolves after change detection in `ngAfterViewInit` (or `ngAfterContentInit`). In Angular 17.1+, modern signal queries (`viewChild('ref')`) supersede decorator queries.",
    code: `import { Component, ViewChild, ElementRef, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-focus-box',
  standalone: true,
  template: \`
    <input #inputElement type="text" placeholder="Type here..." />
    <button (click)="focusInput()">Focus</button>
  \`
})
export class FocusBoxComponent implements AfterViewInit {
  // Query element reference in own template:
  @ViewChild('inputElement') inputRef!: ElementRef<HTMLInputElement>;

  ngAfterViewInit() {
    // Safe to access DOM elements here!
    this.inputRef.nativeElement.focus();
  }

  focusInput() {
    this.inputRef.nativeElement.focus();
  }
}`,
    recallHint: "ViewChild = inside own template; ContentChild = projected via <ng-content>; available in AfterViewInit.",
    interviewTip: "Point out that starting with Angular 17.1, `viewChild()` and `contentChild()` signal queries provide a cleaner, reactive alternative that updates automatically.",
    tags: ["viewchild", "contentchild", "dom-query", "elementref"],
    practice: [
      "What happens if you try to access a non-static ViewChild inside ngOnInit?",
      "How do modern signal queries `viewChild()` differ from the `@ViewChild` decorator?"
    ]
  }),

  createCard({
    idNum: 8,
    category: "Angular Architecture, Standalone Components & Directives",
    concept: "View Encapsulation: Emulated, ShadowDom & None",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the three View Encapsulation modes in Angular, and how does `ViewEncapsulation.Emulated` work under the hood?",
    quickAnswer: "1) `Emulated` (default): Preprocesses CSS and adds unique generated attributes (`_ngcontent-c12`) to scope styles; 2) `ShadowDom`: Uses native browser Shadow DOM with a shadow root; 3) `None`: Injects styles globally into document `<head>` without scoping.",
    detailedAnswer: "In `ViewEncapsulation.Emulated`, Angular emulates Shadow DOM behavior without requiring native browser shadow roots. The compiler generates unique HTML attributes on the component's elements (e.g. `_nghost-ng-c12` on the host and `_ngcontent-ng-c12` on children) and rewrites the CSS selectors to match: `p[_ngcontent-ng-c12] { color: red; }`. `ShadowDom` creates a real native Web Component shadow root, providing true style boundary isolation but breaking global utility classes (like Tailwind) unless imported inside.",
    code: `import { Component, ViewEncapsulation } from '@angular/core';

@Component({
  selector: 'app-scoped-card',
  standalone: true,
  template: \`<p>Scoped text</p>\`,
  styles: [\`p { color: crimson; }\`],
  // ViewEncapsulation options: Emulated (default), ShadowDom, None
  encapsulation: ViewEncapsulation.Emulated
})
export class ScopedCardComponent {}

// Output HTML rendered in browser:
// <app-scoped-card _nghost-ng-c42>
//   <p _ngcontent-ng-c42>Scoped text</p>
// </app-scoped-card>
//
// Output CSS injected:
// p[_ngcontent-ng-c42] { color: crimson; }`,
    recallHint: "Emulated = adds _ngcontent attribute; ShadowDom = native web component root; None = global styles.",
    interviewTip: "Warn against using `ViewEncapsulation.None` to fix styling issues; it leaks styles globally and overrides styles in unrelated components.",
    tags: ["encapsulation", "styles", "shadowdom", "css"],
    practice: [
      "Why was the `::ng-deep` selector deprecated, and how should you style child components instead?",
      "Why don't global CSS libraries like Tailwind affect components using ViewEncapsulation.ShadowDom?"
    ]
  }),

  createCard({
    idNum: 9,
    category: "Angular Architecture, Standalone Components & Directives",
    concept: "Custom Attribute & Structural Directives",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between an Attribute Directive and a Structural Directive in Angular?",
    quickAnswer: "An Attribute Directive modifies the appearance or behavior of an existing DOM element (e.g. highlighting text or auto-focus). A Structural Directive adds, removes, or manipulates DOM elements using `TemplateRef` and `ViewContainerRef` (e.g. `*ngIf`, `*ngFor`).",
    detailedAnswer: "Attribute directives use `@Directive({ selector: '[appHighlight]' })` and inject `ElementRef` or use `host: {}` to alter attributes, styles, or event listeners. Structural directives are applied with an asterisk (`*appPermission='ADMIN'`), which Angular desugars into an `<ng-template [appPermission]='ADMIN'>`. The directive injects `TemplateRef` (the template markup) and `ViewContainerRef` (the DOM container) to conditionally instantiate or clear embedded views.",
    code: `// 1. Attribute Directive (Modifies appearance/behavior)
@Directive({
  selector: '[appAutofocus]',
  standalone: true
})
export class AutofocusDirective implements AfterViewInit {
  private el = inject(ElementRef);
  ngAfterViewInit() {
    this.el.nativeElement.focus();
  }
}

// 2. Custom Structural Directive (Manipulates DOM layout)
@Directive({
  selector: '[appRole]',
  standalone: true
})
export class RoleDirective {
  private templateRef = inject(TemplateRef);
  private vcr = inject(ViewContainerRef);

  @Input() set appRole(role: string) {
    if (currentUserRole === role) {
      this.vcr.createEmbeddedView(this.templateRef); // Insert DOM
    } else {
      this.vcr.clear(); // Remove from DOM
    }
  }
}`,
    recallHint: "Attribute directive modifies existing DOM node; Structural directive adds/removes DOM via TemplateRef + ViewContainerRef.",
    interviewTip: "Explain template desugaring: `*directive` is syntactic sugar for wrapping the element in an `<ng-template>`.",
    tags: ["directives", "structural-directives", "TemplateRef", "ViewContainerRef"],
    practice: [
      "What does the asterisk (*) syntax do when used on a structural directive?",
      "How do you pass multiple context variables to an embedded view in a structural directive?"
    ]
  }),

  createCard({
    idNum: 10,
    category: "Angular Architecture, Standalone Components & Directives",
    concept: "Pure vs Impure Pipes & AsyncPipe",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between a Pure Pipe and an Impure Pipe, and why is `AsyncPipe` so important?",
    quickAnswer: "A Pure Pipe (`pure: true`, default) only recalculates when its input arguments change by reference (`===`). An Impure Pipe (`pure: false`) recalculates on every single change detection cycle. `AsyncPipe` is an impure pipe that automatically subscribes to Observables/Promises, marks OnPush components for check, and unsubscribes on unmount.",
    detailedAnswer: "Because pure pipes memoize their return value, Angular skips pipe execution if the input reference hasn't changed, making them fast and predictable. Impure pipes fire continuously, which can kill performance if doing heavy array filtering or formatting. `AsyncPipe` (`value$ | async`) is uniquely designed: it manages the entire subscription lifecycle, automatically triggers `markForCheck()` when new values emit in `OnPush` components, and cleans up subscriptions on `ngOnDestroy`.",
    code: `import { Pipe, PipeTransform } from '@angular/core';

// 1. Pure Pipe: Only executes when input string reference changes
@Pipe({
  name: 'truncate',
  standalone: true,
  pure: true // Default
})
export class TruncatePipe implements PipeTransform {
  transform(value: string, limit = 20): string {
    if (!value) return '';
    return value.length > limit ? value.substring(0, limit) + '...' : value;
  }
}

// 2. AsyncPipe usage in template:
// Automatic subscription + automatic unmount teardown!
// <div *ngIf="user$ | async as user">
//   <h2>{{ user.name }}</h2>
// </div>`,
    recallHint: "Pure pipe memoizes on input change; Impure pipe executes on every tick; AsyncPipe auto-subscribes and cleans up.",
    interviewTip: "Never use an impure pipe to filter or sort large arrays in templates—it runs on every tick and destroys application performance.",
    tags: ["pipes", "asyncpipe", "pure-pipe", "memoization"],
    practice: [
      "Why does passing a mutated array to a pure pipe fail to trigger an update?",
      "How does AsyncPipe prevent memory leaks compared to manual .subscribe() calls?"
    ]
  }),

  createCard({
    idNum: 11,
    category: "Angular Architecture, Standalone Components & Directives",
    concept: "Content Projection & Multi-Slot ng-content",
    priority: "must-know",
    difficulty: "beginner",
    question: "How does Content Projection work in Angular, and how do you implement multi-slot projection using CSS selectors?",
    quickAnswer: "Content projection projects consumer HTML into a component's template using `<ng-content>`. Multi-slot projection uses the `select` attribute (`<ng-content select='[header]'>`, `<ng-content select='.footer'>`) to distribute children into specific slots.",
    detailedAnswer: "Content projection is Angular's equivalent of slots or `props.children`. Single-slot projection uses bare `<ng-content></ng-content>`. Multi-slot projection allows components (like Modal or Card) to define distinct target areas. The `select` attribute accepts standard CSS selectors: tag names (`select='app-header'`), class names (`select='.card-actions'`), or attributes (`select='[card-footer]'`). Elements not matching any specific selector fall into the default un-targeted `<ng-content>` slot.",
    code: `// Card Component (Multi-Slot Container)
@Component({
  selector: 'app-card',
  standalone: true,
  template: \`
    <div class="card">
      <header class="card-header">
        <ng-content select="[card-header]" />
      </header>
      <div class="card-body">
        <ng-content /> <!-- Default slot: catches everything else -->
      </div>
      <footer class="card-footer">
        <ng-content select="[card-footer]" />
      </footer>
    </div>
  \`
})
export class CardComponent {}

// Consumer Template:
// <app-card>
//   <h3 card-header>User Profile</h3>
//   <p>Main content projected into default body slot.</p>
//   <button card-footer>Close</button>
// </app-card>`,
    recallHint: "<ng-content select='[slot-name]'> projects content matching CSS selectors into named component slots.",
    interviewTip: "In Angular 18+, `<ng-content select='...'>` supports fallback content (`<ng-content select='...'>Default Content</ng-content>`) when nothing is projected!",
    tags: ["ng-content", "content-projection", "slots", "composition"],
    practice: [
      "What new feature did Angular 18 introduce for fallback content in `<ng-content>`?",
      "Does projected content inherit change detection from the parent or the container component?"
    ]
  }),

  createCard({
    idNum: 12,
    category: "Angular Architecture, Standalone Components & Directives",
    concept: "Angular Environment & Application Config Architecture",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the modern `ApplicationConfig` and `app.config.ts` replace `AppModule` in modern Angular applications?",
    quickAnswer: "`ApplicationConfig` defines process-wide providers and capabilities using provider functions (`provideRouter`, `provideHttpClient`, `provideAnimationsAsync`) passed into `bootstrapApplication(AppComponent, appConfig)`.",
    detailedAnswer: "In older Angular apps, global services and feature imports lived in `@NgModule({ imports: [BrowserModule, AppRoutingModule, HttpClientModule] })`. Modern Angular replaces this with `app.config.ts` exporting an `ApplicationConfig` object. Features are added via functional providers (`provideRouter(routes)`, `provideHttpClient(withInterceptors([...]))`). This reduces bundle size through aggressive tree-shaking because unused framework features are never pulled into the build.",
    code: `// app.config.ts
import { ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { routes } from './app.routes';
import { authInterceptor } from './auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor]))
  ]
};

// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

bootstrapApplication(AppComponent, appConfig).catch(err => console.error(err));`,
    recallHint: "app.config.ts exports ApplicationConfig with functional providers; bootstrapped via bootstrapApplication.",
    interviewTip: "Mention that functional providers (e.g. `provideRouter`, `provideHttpClient`) allow granular feature toggles via sub-functions like `withInterceptors()` or `withComponentInputBinding()`.",
    tags: ["application-config", "bootstrap", "functional-providers", "app-config"],
    practice: [
      "What are the benefits of functional providers over NgModule imports?",
      "How do you configure event coalescing in `provideZoneChangeDetection`?"
    ]
  })
];
