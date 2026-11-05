module.exports = [
  {
    id: "angular-ex-01",
    title: "Accessible Auto-Focus Directive with afterNextRender",
    category: "Component Lifecycle & DOM Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "Creates an accessible auto-focus attribute directive that focuses target input elements safely on the browser after DOM rendering, avoiding SSR crashes.",
    conceptsCovered: [
      "Directive",
      "ElementRef",
      "afterNextRender",
      "SSR Safety",
      "Accessibility (a11y)"
    ],
    code: `import { Directive, ElementRef, inject, afterNextRender } from '@angular/core';

@Directive({
  selector: '[appAutoFocus]',
  standalone: true
})
export class AutoFocusDirective {
  private el = inject(ElementRef<HTMLInputElement | HTMLButtonElement>);

  constructor() {
    // afterNextRender runs ONLY on the browser, safely after DOM painting!
    afterNextRender(() => {
      this.el.nativeElement.focus();
    });
  }
}

// Usage in Component:
// <input appAutoFocus placeholder="Auto-focused field" />`,
    breakdown: [
      "afterNextRender executes only in the browser context, preventing 'document is not defined' errors during SSR.",
      "ElementRef injects the host DOM element reference with strict type constraints.",
      "Synchronizes element focus after the browser layout and paint phase has completed.",
      "Eliminates boilerplate ngAfterViewInit lifecycle checks and setTimeout workarounds."
    ],
    expectedOutput: "Host input automatically receives focus immediately upon component mount without SSR errors."
  },
  {
    id: "angular-ex-02",
    title: "Click-Outside Directive for Flyouts & Dropdowns",
    category: "Component Lifecycle & DOM Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "Detects user clicks outside a specified container element using ElementRef.contains and dispatches an output event to dismiss dropdowns or modals.",
    conceptsCovered: [
      "HostListener",
      "ElementRef",
      "OutputEmitterRef",
      "DOM Traversal",
      "Event Propagation"
    ],
    code: `import { Directive, ElementRef, output, HostListener, inject } from '@angular/core';

@Directive({
  selector: '[appClickOutside]',
  standalone: true
})
export class ClickOutsideDirective {
  private el = inject(ElementRef);
  // Angular 17+ functional output signal:
  clickOutside = output<MouseEvent>();

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    // Check if clicked target is outside host element hierarchy:
    if (!this.el.nativeElement.contains(target)) {
      this.clickOutside.emit(event);
    }
  }
}

// Usage:
// <div class="dropdown-menu" (appClickOutside)="isMenuOpen = false">Menu Items</div>`,
    breakdown: [
      "@HostListener('document:click') registers a global click listener on the browser document.",
      "this.el.nativeElement.contains(target) verifies whether the clicked DOM node resides within the host element.",
      "output<MouseEvent>() replaces legacy @Output() EventEmitter with Angular 17+ functional output syntax.",
      "Emits an event only when click originated outside the component boundary, perfect for closing flyouts."
    ],
    expectedOutput: "Dropdown menu closes cleanly when user clicks anywhere else on the document."
  },
  {
    id: "angular-ex-03",
    title: "Host Directives Composition API with Input/Output Aliasing",
    category: "Component Lifecycle & DOM Control",
    difficulty: "advanced",
    whatThisCodeCovers: "Composes multiple reusable behaviors (Tooltip, ClickOutside) onto a component using hostDirectives, aliasing inputs and outputs without template clutter.",
    conceptsCovered: [
      "hostDirectives",
      "Composition over Inheritance",
      "Directive Aliasing",
      "Standalone Architecture"
    ],
    code: `import { Directive, Component, input } from '@angular/core';

@Directive({ selector: '[appHighlight]', standalone: true })
export class HighlightDirective {
  color = input<string>('yellow');
}

@Directive({ selector: '[appRipple]', standalone: true })
export class RippleDirective {
  rippleColor = input<string>('rgba(0,0,0,0.1)');
}

// Host Component composing both directives without adding them to template:
@Component({
  selector: 'app-fancy-button',
  standalone: true,
  hostDirectives: [
    {
      directive: HighlightDirective,
      inputs: ['color: highlightColor'] // Exposes 'color' as 'highlightColor'
    },
    {
      directive: RippleDirective,
      inputs: ['rippleColor']
    }
  ],
  template: \`<button><ng-content /></button>\`
})
export class FancyButtonComponent {}

// Usage in parent template:
// <app-fancy-button highlightColor="lightblue" rippleColor="red">Submit</app-fancy-button>`,
    breakdown: [
      "hostDirectives attaches behavior directives directly to the host component element at compile time.",
      "Avoids deep class inheritance hierarchies by favoring clean functional composition.",
      "The inputs array exposes and renames directive inputs on the host component's public API.",
      "Consumers interact with a single unified component tag while behaviors remain strictly modular."
    ],
    expectedOutput: "FancyButton incorporates highlight and ripple directives seamlessly with exposed inputs."
  },
  {
    id: "angular-ex-04",
    title: "Dynamic Component Portal via ViewContainerRef",
    category: "Component Lifecycle & DOM Control",
    difficulty: "advanced",
    whatThisCodeCovers: "Dynamically instantiates standalone components into an arbitrary container using ViewContainerRef.createComponent, passing inputs via setInput and subscribing to outputs.",
    conceptsCovered: [
      "ViewContainerRef",
      "ComponentRef",
      "Dynamic Instantiation",
      "setInput API",
      "Teardown Cleanup"
    ],
    code: `import { Component, ViewContainerRef, viewChild, ComponentRef, OnDestroy } from '@angular/core';

@Component({
  selector: 'app-alert-banner',
  standalone: true,
  template: \`<div class="alert alert-info">{{ message }}</div>\`
})
export class AlertBannerComponent {
  message = 'Default Banner';
}

@Component({
  selector: 'app-portal-host',
  standalone: true,
  template: \`
    <button (click)="createAlert()">Spawn Dynamic Alert</button>
    <button (click)="clearAll()">Clear Alerts</button>
    <div #alertOutlet></div>
  \`
})
export class PortalHostComponent implements OnDestroy {
  private outlet = viewChild.required('alertOutlet', { read: ViewContainerRef });
  private spawnedRefs: ComponentRef<AlertBannerComponent>[] = [];

  createAlert() {
    // Instantiate component dynamically without ComponentFactoryResolver!
    const compRef = this.outlet().createComponent(AlertBannerComponent);
    compRef.setInput('message', \`Alert created at \${new Date().toLocaleTimeString()}\`);
    this.spawnedRefs.push(compRef);
  }

  clearAll() {
    this.outlet().clear();
    this.spawnedRefs = [];
  }

  ngOnDestroy() {
    this.clearAll();
  }
}`,
    breakdown: [
      "outlet().createComponent(AlertBannerComponent) instantiates the standalone component directly into the DOM.",
      "compRef.setInput('message', value) binds properties reactively without manual change detection triggering.",
      "Maintains array of ComponentRef instances to manage lifecycle and clean up on parent destruction.",
      "this.outlet().clear() cleanly destroys all dynamically attached embedded views."
    ],
    expectedOutput: "Clicking spawn inserts a new AlertBannerComponent into the DOM; clear removes all instances."
  },
  {
    id: "angular-ex-05",
    title: "Multi-Slot Content Projection Card with Fallback Content",
    category: "Component Lifecycle & DOM Control",
    difficulty: "beginner",
    whatThisCodeCovers: "Implements an enterprise card component with multi-slot content projection using CSS selectors and Angular 18 default fallback content.",
    conceptsCovered: [
      "ng-content",
      "Multi-slot Projection",
      "CSS Selectors",
      "Fallback Content",
      "Angular 18 Features"
    ],
    code: `import { Component } from '@angular/core';

@Component({
  selector: 'app-content-card',
  standalone: true,
  styles: [\`
    .card { border: 1px solid #ddd; border-radius: 8px; overflow: hidden; }
    .header { background: #f8f9fa; padding: 12px 16px; border-bottom: 1px solid #eee; }
    .body { padding: 16px; }
    .footer { padding: 8px 16px; background: #fafafa; border-top: 1px solid #eee; }
  \`],
  template: \`
    <div class="card">
      <header class="header">
        <ng-content select="[card-header]">
          <!-- Fallback content if parent projects nothing -->
          <h4 style="margin: 0;">Standard Card Header</h4>
        </ng-content>
      </header>
      <main class="body">
        <ng-content /> <!-- Default catch-all projection slot -->
      </main>
      <footer class="footer">
        <ng-content select="[card-footer]" />
      </footer>
    </div>
  \`
})
export class ContentCardComponent {}

// Parent Usage:
// <app-content-card>
//   <div card-header>Custom Invoicing Title</div>
//   <p>Invoice details for order #9921.</p>
//   <button card-footer>Print</button>
// </app-content-card>`,
    breakdown: [
      "ng-content with select=\"[card-header]\" matches elements decorated with the card-header attribute.",
      "Angular 18 allows nesting default fallback elements directly inside <ng-content>...</ng-content>.",
      "The unselected <ng-content /> acts as the primary catch-all slot for component body content.",
      "Zero JavaScript overhead: slots are resolved purely during compile time by the Ivy template engine."
    ],
    expectedOutput: "Card renders header, body, and footer into designated slots with automatic fallback if header omitted."
  },
  {
    id: "angular-ex-06",
    title: "Custom Debounced Input Directive with RxJS Subject",
    category: "Component Lifecycle & DOM Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "Debounces input keystrokes at the directive level, emitting a clean throttled output event to prevent spamming search endpoints.",
    conceptsCovered: [
      "Directive",
      "RxJS Subject",
      "debounceTime",
      "distinctUntilChanged",
      "takeUntilDestroyed"
    ],
    code: `import { Directive, output, input, HostListener, OnInit, inject, DestroyRef } from '@angular/core';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Directive({
  selector: '[appDebounceInput]',
  standalone: true
})
export class DebounceInputDirective implements OnInit {
  private destroyRef = inject(DestroyRef);
  private input$ = new Subject<string>();

  debounceMs = input<number>(300);
  debouncedValue = output<string>();

  @HostListener('input', ['$event.target.value'])
  onInput(value: string) {
    this.input$.next(value);
  }

  ngOnInit() {
    this.input$.pipe(
      debounceTime(this.debounceMs()),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(val => this.debouncedValue.emit(val));
  }
}

// Usage:
// <input [debounceMs]="400" (debouncedValue)="onSearch($event)" />`,
    breakdown: [
      "Subject<string> captures raw browser input events dispatched by the host input element.",
      "debounceTime waits for a pause in typing before emitting the latest value.",
      "distinctUntilChanged prevents emitting identical consecutive values.",
      "takeUntilDestroyed(this.destroyRef) ensures the subscription is cleaned up when input unmounts."
    ],
    expectedOutput: "Typing triggers search callback only after user pauses for specified millisecond window."
  },
  {
    id: "angular-ex-07",
    title: "One-Click Copy-to-Clipboard Directive with Visual Feedback",
    category: "Component Lifecycle & DOM Control",
    difficulty: "beginner",
    whatThisCodeCovers: "Copies specified text strings to the system clipboard using navigator.clipboard, toggling a temporary 'copied' CSS class on the host element.",
    conceptsCovered: [
      "Clipboard API",
      "HostListener",
      "Renderer2",
      "ElementRef",
      "Async Browser API"
    ],
    code: `import { Directive, ElementRef, HostListener, input, inject, Renderer2 } from '@angular/core';

@Directive({
  selector: '[appCopyToClipboard]',
  standalone: true
})
export class CopyToClipboardDirective {
  private el = inject(ElementRef);
  private renderer = inject(Renderer2);

  textToCopy = input.required<string>({ alias: 'appCopyToClipboard' });

  @HostListener('click')
  async onClick() {
    if (!navigator.clipboard) return;

    try {
      await navigator.clipboard.writeText(this.textToCopy());
      // Add success feedback class
      this.renderer.addClass(this.el.nativeElement, 'copy-success');
      setTimeout(() => {
        this.renderer.removeClass(this.el.nativeElement, 'copy-success');
      }, 1500);
    } catch (err) {
      console.error('Failed to copy to clipboard', err);
    }
  }
}

// Usage:
// <button [appCopyToClipboard]="apiKey">Copy API Key</button>`,
    breakdown: [
      "navigator.clipboard.writeText copies the text string asynchronously to the system clipboard.",
      "Renderer2 safely mutates DOM element class lists in an SSR-compatible way.",
      "input.required ensures compile-time errors if textToCopy is omitted.",
      "Automatically removes visual feedback class after 1.5 seconds."
    ],
    expectedOutput: "Clicking copies target text to clipboard and flashes 'copy-success' class on button."
  },
  {
    id: "angular-ex-08",
    title: "Dynamic Tooltip Directive with CDK Overlay & ConnectedPosition",
    category: "Component Lifecycle & DOM Control",
    difficulty: "advanced",
    whatThisCodeCovers: "Displays a floating tooltip positioned relative to the target element using Angular CDK Overlay, handling mouseenter and mouseleave triggers.",
    conceptsCovered: [
      "CDK Overlay",
      "ComponentPortal",
      "FlexibleConnectedPositionStrategy",
      "HostListener",
      "OverlayRef"
    ],
    code: `import { Directive, ElementRef, HostListener, input, inject, Component, OnDestroy } from '@angular/core';
import { Overlay, OverlayRef } from '@angular/cdk/overlay';
import { ComponentPortal } from '@angular/cdk/portal';

@Component({
  selector: 'app-tooltip-box',
  standalone: true,
  styles: [\`
    :host { background: #333; color: #fff; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
  \`],
  template: \`<span>{{ text }}</span>\`
})
export class TooltipBoxComponent {
  text = '';
}

@Directive({
  selector: '[appTooltip]',
  standalone: true
})
export class TooltipDirective implements OnDestroy {
  private el = inject(ElementRef);
  private overlay = inject(Overlay);
  private overlayRef?: OverlayRef;

  tooltipText = input.required<string>({ alias: 'appTooltip' });

  @HostListener('mouseenter')
  show() {
    if (this.overlayRef) return;

    const positionStrategy = this.overlay.position()
      .flexibleConnectedTo(this.el)
      .withPositions([
        { originX: 'center', originY: 'top', overlayX: 'center', overlayY: 'bottom', offsetY: -6 }
      ]);

    this.overlayRef = this.overlay.create({ positionStrategy });
    const portal = new ComponentPortal(TooltipBoxComponent);
    const ref = this.overlayRef.attach(portal);
    ref.instance.text = this.tooltipText();
  }

  @HostListener('mouseleave')
  hide() {
    this.overlayRef?.dispose();
    this.overlayRef = undefined;
  }

  ngOnDestroy() {
    this.hide();
  }
}`,
    breakdown: [
      "CDK Overlay creates a floating DOM container outside parent clipping layers.",
      "FlexibleConnectedPositionStrategy pins the tooltip above the host element with automatic boundary checking.",
      "ComponentPortal mounts TooltipBoxComponent dynamically inside the overlay pane.",
      "Properly disposes of the overlay in mouseleave and ngOnDestroy to prevent memory leaks."
    ],
    expectedOutput: "Hovering over element displays floating tooltip centered above target element."
  },
  {
    id: "angular-ex-09",
    title: "Infinite Scroll Trigger Directive with IntersectionObserver",
    category: "Component Lifecycle & DOM Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "Emits a scrollEnd event when a sentinel element enters the viewport using IntersectionObserver, triggering pagination for infinite feeds.",
    conceptsCovered: [
      "IntersectionObserver",
      "ElementRef",
      "output",
      "afterNextRender",
      "Performance"
    ],
    code: `import { Directive, ElementRef, output, inject, afterNextRender, OnDestroy } from '@angular/core';

@Directive({
  selector: '[appInfiniteScrollTrigger]',
  standalone: true
})
export class InfiniteScrollTriggerDirective implements OnDestroy {
  private el = inject(ElementRef);
  private observer?: IntersectionObserver;

  scrolled = output<void>();

  constructor() {
    afterNextRender(() => {
      this.observer = new IntersectionObserver(([entry]) => {
        if (entry.isIntersecting) {
          this.scrolled.emit();
        }
      }, { threshold: 0.1 });

      this.observer.observe(this.el.nativeElement);
    });
  }

  ngOnDestroy() {
    this.observer?.disconnect();
  }
}

// Usage in template at bottom of list:
// <div appInfiniteScrollTrigger (scrolled)="loadNextPage()">Loading more items...</div>`,
    breakdown: [
      "Uses browser native IntersectionObserver rather than high-frequency window scroll event listeners.",
      "afterNextRender ensures the observer attaches only in browser environments.",
      "threshold: 0.1 fires when the sentinel element is 10% visible in the viewport.",
      "Disconnects observer in ngOnDestroy to prevent memory leaks when navigating away."
    ],
    expectedOutput: "Scrolling to the bottom of the page fires scrolled event, triggering next page fetch."
  },
  {
    id: "angular-ex-10",
    title: "HTML5 Drag-and-Drop File Upload Directive",
    category: "Component Lifecycle & DOM Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements a drag-and-drop file dropzone directive, intercepting dragover and drop events, extracting files, and toggling visual drag states.",
    conceptsCovered: [
      "HTML5 Drag and Drop API",
      "HostListener",
      "HostBinding",
      "FileList",
      "Custom Output"
    ],
    code: `import { Directive, HostBinding, HostListener, output } from '@angular/core';

@Directive({
  selector: '[appFileDrop]',
  standalone: true
})
export class FileDropDirective {
  @HostBinding('class.drag-over') isDragOver = false;

  filesDropped = output<File[]>();

  @HostListener('dragover', ['$event'])
  onDragOver(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver = true;
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver = false;
  }

  @HostListener('drop', ['$event'])
  onDrop(e: DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragOver = false;

    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
      const files = Array.from(e.dataTransfer.files);
      this.filesDropped.emit(files);
    }
  }
}

// Usage:
// <div appFileDrop (filesDropped)="uploadFiles($event)" class="dropzone">Drop files here</div>`,
    breakdown: [
      "e.preventDefault() on dragover is mandatory to permit drop events in HTML5.",
      "@HostBinding('class.drag-over') dynamically toggles styling when files hover over target.",
      "Converts FileList into standard JavaScript Array for type-safe processing.",
      "Emits an array of File objects to the parent component."
    ],
    expectedOutput: "Dropping files on host element highlights container and emits selected File array."
  },
  {
    id: "angular-ex-11",
    title: "Signal-Based View Queries with viewChild and viewChildren",
    category: "Component Lifecycle & DOM Control",
    difficulty: "intermediate",
    whatThisCodeCovers: "Leverages modern Angular 17.1+ signal-based viewChild and viewChildren queries to access DOM elements and child components with automatic reactivity.",
    conceptsCovered: [
      "viewChild.required",
      "viewChildren",
      "Signal View Queries",
      "ElementRef",
      "effect()"
    ],
    code: `import { Component, ElementRef, viewChild, viewChildren, effect, AfterViewInit } from '@angular/core';

@Component({
  selector: 'app-view-query-demo',
  standalone: true,
  template: \`
    <input #mainInput placeholder="Focus me" />
    <ul>
      @for (item of items; track item) {
        <li #listItem>{{ item }}</li>
      }
    </ul>
    <button (click)="focusInput()">Focus</button>
  \`
})
export class ViewQueryDemoComponent {
  items = ['Item Alpha', 'Item Beta', 'Item Gamma'];

  // Signal-based queries: automatically reactive!
  mainInput = viewChild.required<ElementRef<HTMLInputElement>>('mainInput');
  listItems = viewChildren<ElementRef<HTMLLIElement>>('listItem');

  constructor() {
    // Automatically reacts whenever query matches resolve or change!
    effect(() => {
      console.log('List item count in DOM:', this.listItems().length);
    });
  }

  focusInput() {
    this.mainInput().nativeElement.focus();
  }
}`,
    breakdown: [
      "viewChild.required returns a Signal<ElementRef<T>> guaranteed to exist after view initialization.",
      "viewChildren returns a Signal<readonly ElementRef<T>[]> that updates automatically when list changes.",
      "Queries work natively with effect(), eliminating boilerplate ngAfterViewInit subscriptions.",
      "Reading the signal (mainInput().nativeElement) provides instantaneous type-safe DOM access."
    ],
    expectedOutput: "DOM elements accessed cleanly via reactive signals with zero legacy decorator boilerplate."
  }
];
