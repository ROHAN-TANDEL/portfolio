module.exports = [
  {
    id: "angular-ex-43",
    title: "HTTP Bearer Token Interceptor with 401 Refresh Mutex",
    category: "Production, SSR & Performance",
    difficulty: "advanced",
    whatThisCodeCovers: "Intercepts HTTP requests, clones them with Bearer Authorization tokens, and handles 401 Unauthorized errors with a synchronized refresh mutex.",
    conceptsCovered: [
      "HttpInterceptorFn",
      "req.clone",
      "catchError",
      "Token Refresh Mutex",
      "Concurrency"
    ],
    code: `import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, switchMap, filter, take } from 'rxjs/operators';

// Mock Token Service
class AuthService {
  getToken(): string | null { return 'expired_jwt'; }
  refreshToken(): Observable<{ token: string }> {
    return new Observable(sub => { sub.next({ token: 'new_fresh_jwt' }); sub.complete(); });
  }
}

let isRefreshing = false;
const refreshTokenSubject = new BehaviorSubject<string | null>(null);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = new AuthService();
  const token = auth.getToken();

  let clonedReq = req;
  if (token) {
    clonedReq = req.clone({ setHeaders: { Authorization: \`Bearer \${token}\` } });
  }

  return next(clonedReq).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        if (!isRefreshing) {
          isRefreshing = true;
          refreshTokenSubject.next(null);

          return auth.refreshToken().pipe(
            switchMap(({ token: newToken }) => {
              isRefreshing = false;
              refreshTokenSubject.next(newToken);
              return next(req.clone({ setHeaders: { Authorization: \`Bearer \${newToken}\` } }));
            }),
            catchError(err => {
              isRefreshing = false;
              return throwError(() => err);
            })
          );
        } else {
          // If already refreshing, queue this request until new token is published:
          return refreshTokenSubject.pipe(
            filter(newToken => newToken !== null),
            take(1),
            switchMap(newToken => next(req.clone({ setHeaders: { Authorization: \`Bearer \${newToken}\` } })))
          );
        }
      }
      return throwError(() => error);
    })
  );
};`,
    breakdown: [
      "Clones outgoing requests to inject the Authorization Bearer header safely.",
      "Catches 401 Unauthorized responses to initiate silent background token refresh.",
      "Uses isRefreshing flag and BehaviorSubject to queue concurrent failing requests.",
      "Retries all queued requests with the newly minted access token once refresh finishes."
    ],
    expectedOutput: "Expired token caught; requests paused while single refresh executes, then seamlessly retried."
  },
  {
    id: "angular-ex-44",
    title: "Global HTTP Error Notification Interceptor",
    category: "Production, SSR & Performance",
    difficulty: "intermediate",
    whatThisCodeCovers: "Intercepts all outgoing HTTP failures globally, displaying toast alerts for 500, 403, and network errors while preserving original error streams.",
    conceptsCovered: [
      "HttpInterceptorFn",
      "HttpErrorResponse",
      "Global Error Handling",
      "Toast Notifications",
      "throwError"
    ],
    code: `import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

// Mock Notification Service
class ToastService {
  showError(msg: string) { console.error('TOAST ALERT:', msg); }
}

export const errorNotificationInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = new ToastService();

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      let errorMessage = 'An unexpected error occurred.';

      if (error.status === 0) {
        errorMessage = 'Network connection lost. Please check your internet connection.';
      } else if (error.status === 403) {
        errorMessage = 'Access denied: You do not have permissions for this resource.';
      } else if (error.status >= 500) {
        errorMessage = \`Internal server error (\${error.status}). Our team has been notified.\`;
      }

      toast.showError(errorMessage);
      return throwError(() => error); // Re-throw so caller can still handle if needed
    })
  );
};`,
    breakdown: [
      "Catches unhandled HTTP failures centrally across the entire application.",
      "status === 0 identifies client offline or CORS blockage conditions.",
      "Formats friendly user messages rather than exposing raw server stack traces.",
      "Re-throws the error via throwError(() => error) to preserve caller error pipelines."
    ],
    expectedOutput: "Server errors trigger user-friendly toast alerts automatically without component-level try-catch."
  },
  {
    id: "angular-ex-45",
    title: "Non-Destructive SSR Hydration with Event Replay Configuration",
    category: "Production, SSR & Performance",
    difficulty: "advanced",
    whatThisCodeCovers: "Configures Angular 18+ non-destructive client hydration with event replay and HTTP transfer cache options in app.config.ts.",
    conceptsCovered: [
      "provideClientHydration",
      "withEventReplay",
      "withHttpTransferCacheOptions",
      "SSR Setup",
      "Core Web Vitals"
    ],
    code: `import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  provideClientHydration,
  withEventReplay,
  withHttpTransferCacheOptions
} from '@angular/platform-browser';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    provideHttpClient(withFetch()), // Mandatory for modern SSR & edge streaming
    // Enable production hydration:
    provideClientHydration(
      withEventReplay(), // Replays clicks happening before JS download finishes
      withHttpTransferCacheOptions({
        includePostRequests: false // Strictly cache GET requests
      })
    )
  ]
};`,
    breakdown: [
      "provideClientHydration() turns on non-destructive DOM node preservation.",
      "withEventReplay() captures early user clicks during page load and replays them upon hydration.",
      "withFetch() switches HttpClient from XMLHttpRequest to the native modern browser fetch API.",
      "withHttpTransferCacheOptions configures server-to-client HTTP response serialization."
    ],
    expectedOutput: "Instant FCP with zero DOM flicker and zero lost user clicks during client download."
  },
  {
    id: "angular-ex-46",
    title: "Platform-Safe Storage Service Guarding Window & LocalStorage",
    category: "Production, SSR & Performance",
    difficulty: "intermediate",
    whatThisCodeCovers: "Encapsulates localStorage into an injectable service that safely detects browser vs server environments using PLATFORM_ID and isPlatformBrowser.",
    conceptsCovered: [
      "PLATFORM_ID",
      "isPlatformBrowser",
      "SSR Safety",
      "Storage Abstraction",
      "Dependency Injection"
    ],
    code: `import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Injectable({ providedIn: 'root' })
export class SafeStorageService {
  private platformId = inject(PLATFORM_ID);
  private isBrowser = isPlatformBrowser(this.platformId);

  getItem(key: string): string | null {
    if (!this.isBrowser) {
      return null; // Safe fallback on Node.js server
    }
    try {
      return localStorage.getItem(key);
    } catch (e) {
      console.warn('LocalStorage access blocked', e);
      return null;
    }
  }

  setItem(key: string, value: string): void {
    if (this.isBrowser) {
      try {
        localStorage.setItem(key, value);
      } catch (e) {
        console.warn('LocalStorage write failed (quota exceeded or blocked)', e);
      }
    }
  }

  removeItem(key: string): void {
    if (this.isBrowser) {
      localStorage.removeItem(key);
    }
  }
}`,
    breakdown: [
      "isPlatformBrowser(this.platformId) verifies whether execution is currently inside Node or browser.",
      "Prevents 'ReferenceError: localStorage is not defined' crashes during SSR compilation.",
      "Wraps browser calls in try-catch to handle Safari Private Browsing quota restrictions.",
      "Provides uniform storage API across client and server."
    ],
    expectedOutput: "Storage operations execute safely in browser and return clean nulls during SSR."
  },
  {
    id: "angular-ex-47",
    title: "Virtual Scrolling 100,000 Item List with CDK Virtual Scroll",
    category: "Production, SSR & Performance",
    difficulty: "intermediate",
    whatThisCodeCovers: "Renders a 100,000 item transaction feed at 60 FPS using ScrollingModule and cdk-virtual-scroll-viewport with fixed itemSize.",
    conceptsCovered: [
      "ScrollingModule",
      "cdk-virtual-scroll-viewport",
      "*cdkVirtualFor",
      "itemSize",
      "DOM Recycling"
    ],
    code: `import { Component, ChangeDetectionStrategy } from '@angular/core';
import { ScrollingModule } from '@angular/cdk/scrolling';

interface Transaction { id: number; description: string; amount: number; }

@Component({
  selector: 'app-virtual-feed',
  standalone: true,
  imports: [ScrollingModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [\`
    .viewport { height: 500px; width: 100%; border: 1px solid #ccc; }
    .item-row { height: 50px; display: flex; align-items: center; padding: 0 16px; border-bottom: 1px solid #eee; }
  \`],
  template: \`
    <!-- itemSize is mandatory: represents exact row height in px -->
    <cdk-virtual-scroll-viewport itemSize="50" class="viewport">
      <div *cdkVirtualFor="let item of transactions; trackBy: trackById" class="item-row">
        <span>#{{ item.id }}</span>
        <span style="flex: 1; margin-left: 12px;">{{ item.description }}</span>
        <span>\${{ item.amount }}</span>
      </div>
    </cdk-virtual-scroll-viewport>
  \`
})
export class VirtualFeedComponent {
  transactions: Transaction[] = Array.from({ length: 100000 }).map((_, i) => ({
    id: i + 1,
    description: \`Transaction Record \${i + 1}\`,
    amount: +(Math.random() * 500).toFixed(2)
  }));

  trackById(index: number, item: Transaction) {
    return item.id;
  }
}`,
    breakdown: [
      "itemSize=\"50\" tells the CDK the exact vertical pixel height of each item row.",
      "cdk-virtual-scroll-viewport only instantiates ~15 DOM nodes matching the visible area.",
      "Recycles DOM nodes as the user scrolls, maintaining constant memory footprint.",
      "trackBy function ensures smooth scrolling without element destruction."
    ],
    expectedOutput: "100,000 items scroll fluidly at 60 FPS with minimal DOM node count."
  },
  {
    id: "angular-ex-48",
    title: "Offloading Heavy Computation to Web Worker in Angular CLI",
    category: "Production, SSR & Performance",
    difficulty: "advanced",
    whatThisCodeCovers: "Spawns a dedicated Web Worker to process heavy calculations off the main UI thread, preserving responsive 60 FPS animation.",
    conceptsCovered: [
      "Web Worker",
      "import.meta.url",
      "postMessage",
      "Worker Teardown",
      "INP Optimization"
    ],
    code: `import { Component, OnInit, OnDestroy, signal } from '@angular/core';

@Component({
  selector: 'app-worker-calc',
  standalone: true,
  template: \`
    <button (click)="startCalculation()" [disabled]="isCalculating()">
      {{ isCalculating() ? 'Computing on Background Thread...' : 'Run Heavy Calculation' }}
    </button>
    <p>Result: {{ calculationResult() }}</p>
  \`
})
export class WorkerCalcComponent implements OnInit, OnDestroy {
  private worker?: Worker;
  isCalculating = signal(false);
  calculationResult = signal<number | null>(null);

  ngOnInit() {
    if (typeof Worker !== 'undefined') {
      // Angular CLI compiles worker files into isolated chunks:
      this.worker = new Worker(new URL('./heavy.worker', import.meta.url), { type: 'module' });

      this.worker.onmessage = ({ data }) => {
        this.calculationResult.set(data);
        this.isCalculating.set(false);
      };
    }
  }

  startCalculation() {
    this.isCalculating.set(true);
    // Sends input payload to background OS thread
    this.worker?.postMessage({ iterations: 100000000 });
  }

  ngOnDestroy() {
    this.worker?.terminate(); // Clean up thread!
  }
}

// In heavy.worker.ts:
// addEventListener('message', ({ data }) => {
//   let sum = 0;
//   for (let i = 0; i < data.iterations; i++) sum += i;
//   postMessage(sum);
// });`,
    breakdown: [
      "new Worker(new URL('./path', import.meta.url), { type: 'module' }) leverages modern standard worker loading.",
      "Heavy computations execute on background OS threads, keeping browser main thread completely unblocked.",
      "postMessage sends serializable payloads across thread boundaries.",
      "worker.terminate() in ngOnDestroy frees OS system resources when component destroys."
    ],
    expectedOutput: "100-million iteration loop calculates in background without dropping browser UI frames."
  },
  {
    id: "angular-ex-49",
    title: "Pure Memoized Currency & Date Formatting Pipe",
    category: "Production, SSR & Performance",
    difficulty: "intermediate",
    whatThisCodeCovers: "Creates an enterprise pure memoized pipe that formats numbers into localized currency strings, executing only when input parameters change.",
    conceptsCovered: [
      "Pipe",
      "PipeTransform",
      "pure: true",
      "Memoization",
      "Intl.NumberFormat"
    ],
    code: `import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'appCurrency',
  standalone: true,
  pure: true // Default: Memoized by Angular! Executes only on parameter reference change!
})
export class AppCurrencyPipe implements PipeTransform {
  private formatters = new Map<string, Intl.NumberFormat>();

  transform(value: number | null | undefined, currency = 'USD', locale = 'en-US'): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '';
    }

    const key = \`\${locale}_\${currency}\`;
    let formatter = this.formatters.get(key);

    if (!formatter) {
      formatter = new Intl.NumberFormat(locale, {
        style: 'currency',
        currency,
        minimumFractionDigits: 2
      });
      this.formatters.set(key, formatter);
    }

    return formatter.format(value);
  }
}

// Usage:
// <p>{{ transaction.amount | appCurrency:'EUR':'de-DE' }}</p>`,
    breakdown: [
      "pure: true guarantees that Angular skips executing transform() if inputs have not changed.",
      "Caches Intl.NumberFormat instances in an internal Map to avoid recreating expensive formatting objects.",
      "Handles null, undefined, and NaN inputs gracefully without crashing template rendering.",
      "Zero bundle bloat: lightweight standalone utility pipe."
    ],
    expectedOutput: "Numbers format to localized currency strings ($1,299.00) with zero duplicate re-evaluations."
  },
  {
    id: "angular-ex-50",
    title: "Dynamic SVG & Safe URL Sanitization with DomSanitizer",
    category: "Production, SSR & Performance",
    difficulty: "intermediate",
    whatThisCodeCovers: "Sanitizes trusted external SVG strings and dynamic iframe URLs safely using DomSanitizer and SecurityContext.",
    conceptsCovered: [
      "DomSanitizer",
      "SecurityContext",
      "bypassSecurityTrustHtml",
      "SafeHtml",
      "XSS Protection"
    ],
    code: `import { Component, inject, input } from '@angular/core';
import { DomSanitizer, SafeHtml, SafeResourceUrl } from '@angular/platform-browser';

@Component({
  selector: 'app-safe-svg-icon',
  standalone: true,
  template: \`
    <!-- Bound safely to innerHTML using SafeHtml token -->
    <span [innerHTML]="sanitizedSvg()"></span>
  \`
})
export class SafeSvgIconComponent {
  private sanitizer = inject(DomSanitizer);
  rawSvg = input.required<string>();

  sanitizedSvg = () => {
    const raw = this.rawSvg();
    // CAUTION: Only bypass if source is trusted internal SVG asset!
    return this.sanitizer.bypassSecurityTrustHtml(raw);
  };
}

// Service example for trusted video URLs:
export function createSafeVideoUrl(sanitizer: DomSanitizer, videoId: string): SafeResourceUrl {
  const safeUrl = \`https://www.youtube-nocookie.com/embed/\${encodeURIComponent(videoId)}\`;
  return sanitizer.bypassSecurityTrustResourceUrl(safeUrl);
}`,
    breakdown: [
      "DomSanitizer.bypassSecurityTrustHtml bypasses Angular's built-in HTML stripping for trusted SVGs.",
      "bypassSecurityTrustResourceUrl permits binding external iframe URLs dynamically.",
      "Always validate and encode URL parameters to avoid injecting untrusted user content.",
      "Returns SafeHtml / SafeResourceUrl opaque types recognized by Ivy property bindings."
    ],
    expectedOutput: "Trusted SVGs and iframes render cleanly without security stripping warnings."
  },
  {
    id: "angular-ex-51",
    title: "Content Security Policy (CSP) Nonce Integration",
    category: "Production, SSR & Performance",
    difficulty: "advanced",
    whatThisCodeCovers: "Configures Angular to attach cryptographic CSP nonces to all dynamically generated component <style> tags, satisfying strict security policies.",
    conceptsCovered: [
      "Content Security Policy",
      "ngCspNonce",
      "CSP Nonce",
      "XSS Mitigation",
      "Security"
    ],
    code: `// In index.html (or generated dynamically by SSR Node.js server):
// The Express server generates a random cryptographic nonce per request:
// const nonce = crypto.randomBytes(16).toString('base64');
// res.setHeader('Content-Security-Policy', \`default-src 'self'; style-src 'self' 'nonce-\${nonce}';\`);

// Pass nonce to Angular root element via ngCspNonce attribute:
/*
  <!DOCTYPE html>
  <html>
    <head><title>Secure Enterprise App</title></head>
    <body>
      <app-root ngCspNonce="randomNonceGeneratedByServer123=="></app-root>
    </body>
  </html>
*/

// When Angular Ivy renders components with ViewEncapsulation.Emulated,
// it automatically attaches the nonce attribute to every dynamic <style> tag:
// <style ng-csp-nonce="randomNonceGeneratedByServer123==">
//   .container[_ngcontent-c1] { display: flex; }
// </style>`,
    breakdown: [
      "Strict Content Security Policy forbids unsafe-inline styles to prevent CSS injection attacks.",
      "Adding ngCspNonce to <app-root> informs Angular of the active request nonce.",
      "Ivy automatically propagates this nonce to every component style block injected into <head>.",
      "Eliminates the need for 'unsafe-inline' in enterprise security audits."
    ],
    expectedOutput: "Dynamic component styles pass strict CSP headers with cryptographic nonces intact."
  },
  {
    id: "angular-ex-52",
    title: "Microfrontend Web Component Packaging with createCustomElement",
    category: "Production, SSR & Performance",
    difficulty: "advanced",
    whatThisCodeCovers: "Packages a standalone Angular component into a framework-agnostic W3C Custom Element using @angular/elements for use in React, Vue, or legacy HTML.",
    conceptsCovered: [
      "createCustomElement",
      "@angular/elements",
      "customElements.define",
      "Microfrontends",
      "Web Components"
    ],
    code: `import { createApplication } from '@angular/platform-browser';
import { createCustomElement } from '@angular/elements';
import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-shared-user-card',
  standalone: true,
  styles: [\`
    :host { display: block; font-family: sans-serif; border: 1px solid #ccc; padding: 12px; border-radius: 6px; }
    button { background: #007bff; color: white; border: none; padding: 6px 12px; border-radius: 4px; }
  \`],
  template: \`
    <h3>{{ username() }}</h3>
    <button (click)="ping.emit(username())">Send Ping</button>
  \`
})
export class SharedUserCardComponent {
  username = input<string>('Guest');
  ping = output<string>();
}

// Bootstrap application as a Custom Element (Web Component) without index app-root:
export async function bootstrapWebComponent() {
  const app = await createApplication({ providers: [] });

  // Convert standalone Angular component to standard W3C Custom Element:
  const UserCardElement = createCustomElement(SharedUserCardComponent, {
    injector: app.injector
  });

  // Register in browser window registry:
  if (!customElements.get('shared-user-card')) {
    customElements.define('shared-user-card', UserCardElement);
  }
}

// In React / Vue / Plain HTML:
// <shared-user-card username="John Doe"></shared-user-card>
// document.querySelector('shared-user-card').addEventListener('ping', (e) => alert(e.detail));`,
    breakdown: [
      "createApplication({ providers: [] }) initializes Angular environment without mounting to the DOM.",
      "createCustomElement bridges Angular inputs, outputs, and change detection to W3C standards.",
      "customElements.define registers the custom HTML tag globally in the browser.",
      "Can be embedded inside React, Vue, or plain static HTML pages as an isolated microfrontend."
    ],
    expectedOutput: "Angular component functions as native <shared-user-card> web component in any frontend stack."
  }
];
