const { createCard } = require('../angular_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 97,
    category: "HTTP Client, Functional Interceptors & SSR Hydration",
    concept: "HttpClient Configuration & provideHttpClient",
    priority: "must-know",
    difficulty: "beginner",
    question: "How do you configure `HttpClient` in standalone Angular using `provideHttpClient` and its modular features?",
    quickAnswer: "`provideHttpClient(...)` is declared in `app.config.ts`. It accepts modular features: `withInterceptors([...])` (registers functional interceptors), `withFetch()` (uses the modern browser `fetch` API instead of `XMLHttpRequest`), and `withJsonp()`.",
    detailedAnswer: "In modern Angular, `HttpClientModule` is deprecated. `provideHttpClient` offers a tree-shakeable alternative. Adding `withFetch()` enables the browser's native `fetch` API, which is mandatory for Server-Side Rendering (SSR) streaming, edge workers (like Cloudflare Pages), and modern HTTP/2 / HTTP/3 optimizations.",
    code: `// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './interceptors/auth.interceptor';
import { loggingInterceptor } from './interceptors/logging.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withFetch(), // Uses native browser fetch API!
      withInterceptors([authInterceptor, loggingInterceptor])
    )
  ]
};`,
    recallHint: "provideHttpClient(withFetch(), withInterceptors([...])) replaces HttpClientModule.",
    interviewTip: "Highlight that `withFetch()` is recommended for all modern apps because it improves performance, supports streaming responses, and aligns SSR execution with Node.js/Edge fetch standards.",
    tags: ["httpclient", "providehttpclient", "fetch", "standalone"],
    practice: [
      "Why is `withFetch()` preferred over legacy `XMLHttpRequest` for Server-Side Rendering?",
      "Can interceptors still modify requests when `withFetch()` is enabled?"
    ]
  }),

  createCard({
    idNum: 98,
    category: "HTTP Client, Functional Interceptors & SSR Hydration",
    concept: "Functional HTTP Interceptors (HttpInterceptorFn)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is `HttpInterceptorFn`, and how does it compare to legacy class-based `HttpInterceptor`?",
    quickAnswer: "`HttpInterceptorFn` is a functional interceptor signature `(req: HttpRequest<unknown>, next: HttpHandlerFn) => Observable<HttpEvent<unknown>>`. It replaces class-based `HttpInterceptor` and `HTTP_INTERCEPTORS` tokens, allowing clean function composition and direct usage of `inject()`.",
    detailedAnswer: "Legacy interceptors required `@Injectable() class MyInterceptor implements HttpInterceptor` registered via multi-provider DI tokens. Functional interceptors in Angular 15+ are standalone functions executed in an injection context. They execute in the exact array order defined in `withInterceptors([first, second, third])`.",
    code: `import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { LoggerService } from './logger.service';

export const timingInterceptor: HttpInterceptorFn = (req, next) => {
  const logger = inject(LoggerService);
  const started = Date.now();

  return next(req).pipe(
    // Intercept response stream
  );
};`,
    recallHint: "HttpInterceptorFn: functional interceptor (req, next) => next(req); uses inject() directly.",
    interviewTip: "Explain that functional interceptors maintain injection context, so you can call `inject(AuthService)` right at the top of the function without constructor boilerplate.",
    tags: ["httpclient", "interceptors", "httpinterceptorfn", "functional"],
    practice: [
      "In what order do interceptors process outgoing requests vs incoming responses?",
      "Can a functional interceptor completely short-circuit a request and return a mocked response?"
    ]
  }),

  createCard({
    idNum: 99,
    category: "HTTP Client, Functional Interceptors & SSR Hydration",
    concept: "Immutable Request Cloning in Interceptors",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why are Angular `HttpRequest` objects immutable, and how do you attach authentication headers using `req.clone()`?",
    quickAnswer: "`HttpRequest` instances are strictly immutable to prevent race conditions during retries and multiple interceptor stages. To add headers or change URLs, call `req.clone({ setHeaders: { Authorization: ... } })` and forward the cloned instance to `next()`.",
    detailedAnswer: "Because an HTTP request may be retried (e.g. via `retry(3)`), mutating the request object directly would corrupt the original request state. `req.clone()` creates a shallow copy with specified overrides. The helper property `setHeaders` is preferred over `headers` because it preserves all existing headers and merges or replaces only the specified keys.",
    code: `import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  if (!token) {
    return next(req);
  }

  // HttpRequest is immutable: must clone to add headers!
  const authReq = req.clone({
    setHeaders: {
      Authorization: \`Bearer \${token}\`,
      'X-Client-Version': '2.4.0'
    }
  });

  return next(authReq);
};`,
    recallHint: "HttpRequest is immutable; use req.clone({ setHeaders: { ... } }) to add auth tokens safely.",
    interviewTip: "Emphasize `setHeaders` vs `headers`: `setHeaders` merges cleanly, whereas passing a new `headers: new HttpHeaders()` replaces all existing request headers, wiping out content types or cookies.",
    tags: ["httpclient", "clone", "headers", "immutability"],
    practice: [
      "What happens if you mutate `req.url` directly instead of calling `req.clone()`?",
      "How does `req.clone()` support changing the HTTP method (e.g. converting GET to POST)?"
    ]
  }),

  createCard({
    idNum: 100,
    category: "HTTP Client, Functional Interceptors & SSR Hydration",
    concept: "Token Refresh Interceptor & Concurrency Handling",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you handle 401 Unauthorized responses and orchestrate silent JWT token refresh without triggering multiple refresh requests?",
    quickAnswer: "Catch the 401 error in an interceptor using `catchError()`. Coordinate multiple concurrent failing requests using a shared refresh Observable, a mutex flag, or a `BehaviorSubject` holding the new token, queuing pending requests until the single refresh request resolves.",
    detailedAnswer: "If an app makes 5 parallel API calls when the access token expires, all 5 calls return 401 simultaneously. If unhandled, the app will fire 5 duplicate token refresh requests, invalidating refresh tokens on strict OAuth servers. An enterprise interceptor catches 401, checks if a refresh is already in progress; if yes, subsequent requests wait on the shared token subject. Once the refresh succeeds, all queued requests are re-sent with the new token.",
    code: `import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, switchMap, throwError } from 'rxjs';

export const tokenRefreshInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Catch 401 Unauthorized (and avoid intercepting refresh endpoint itself)
      if (error.status === 401 && !req.url.includes('/auth/refresh')) {
        return auth.refreshToken().pipe(
          switchMap(newToken => {
            // Retry original request with new token
            const retriedReq = req.clone({
              setHeaders: { Authorization: \`Bearer \${newToken}\` }
            });
            return next(retriedReq);
          }),
          catchError(refreshErr => {
            auth.logout();
            return throwError(() => refreshErr);
          })
        );
      }
      return throwError(() => error);
    })
  );
};`,
    recallHint: "Catch 401, call auth.refreshToken(), switchMap to retry original request with new token; queue concurrent requests.",
    interviewTip: "Mention that the refresh service should use `shareReplay(1)` so concurrent 401s latch onto the same in-flight HTTP request.",
    tags: ["interceptors", "jwt", "refresh-token", "concurrency"],
    practice: [
      "How does `shareReplay(1)` prevent duplicate refresh network calls?",
      "Why must the interceptor exclude `/auth/refresh` from 401 interception?"
    ]
  }),

  createCard({
    idNum: 101,
    category: "HTTP Client, Functional Interceptors & SSR Hydration",
    concept: "HttpContext & HttpContextToken for Request Metadata",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you pass custom metadata or flags from a service call to an HTTP interceptor using `HttpContext`?",
    quickAnswer: "Define an `HttpContextToken<T>`, assign it in the request via `new HttpContext().set(TOKEN, value)`, and read it inside the interceptor via `req.context.get(TOKEN)` to conditionally bypass behavior (e.g. skip auth or disable loading spinners).",
    detailedAnswer: "In older Angular versions, developers used custom headers (like `X-Skip-Auth: true`) and stripped them before sending to the server. `HttpContext` is the official type-safe mechanism for attaching request-scoped metadata that stays internal to the client and is never sent over the wire.",
    code: `import { HttpContext, HttpContextToken, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

// 1. Define typed context token:
export const IS_PUBLIC_API = new HttpContextToken<boolean>(() => false);

// 2. Interceptor reads the context token:
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const isPublic = req.context.get(IS_PUBLIC_API);
  if (isPublic) {
    return next(req); // Bypass auth header!
  }

  const cloned = req.clone({ setHeaders: { Authorization: 'Bearer token' } });
  return next(cloned);
};

// 3. Service attaches context:
// http.get('/api/public-catalogue', {
//   context: new HttpContext().set(IS_PUBLIC_API, true)
// });`,
    recallHint: "HttpContextToken<T> + req.context.get(TOKEN) passes type-safe internal flags to interceptors.",
    interviewTip: "Explain that `HttpContext` is strictly client-side and does NOT send extra HTTP headers to the server, making it cleaner and safer than fake HTTP headers.",
    tags: ["httpcontext", "httpclient", "interceptors", "metadata"],
    practice: [
      "How do you configure an `IS_SILENT` token to suppress global error notification banners?",
      "What is the default value behavior of `new HttpContextToken(() => defaultValue)`?"
    ]
  }),

  createCard({
    idNum: 102,
    category: "HTTP Client, Functional Interceptors & SSR Hydration",
    concept: "Server-Side Rendering (SSR) & provideServerRendering",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Angular Server-Side Rendering (SSR) work, and how is it initialized in Angular 17+?",
    quickAnswer: "Angular SSR renders the component tree to static HTML on a Node.js server before sending it to the client, improving First Contentful Paint (FCP) and SEO. In Angular 17+, SSR is built into the CLI (`ng add @angular/ssr`) and configured via `provideServerRendering()` in `app.config.server.ts`.",
    detailedAnswer: "In client-only SPAs, the browser downloads an empty `<app-root></app-root>`, fetches JavaScript, parses code, and only then renders content. With Angular SSR, the server executes the Angular app using `CommonEngine` in Node.js, compiles the templates into full HTML, and streams it to the user. Search engine crawlers receive complete HTML immediately, and users see meaningful content on slow devices without waiting for JS execution.",
    code: `// app.config.server.ts
import { mergeApplicationConfig, ApplicationConfig } from '@angular/core';
import { provideServerRendering } from '@angular/platform-server';
import { appConfig } from './app.config';

const serverConfig: ApplicationConfig = {
  providers: [
    provideServerRendering() // Activates server rendering pipeline
  ]
};

export const config = mergeApplicationConfig(appConfig, serverConfig);`,
    recallHint: "Angular SSR compiles HTML on the server before client download; enabled via provideServerRendering().",
    interviewTip: "Highlight that in Angular 17+, Angular Universal was merged directly into the core framework under `@angular/ssr`, eliminating separate universal packages.",
    tags: ["ssr", "server-rendering", "seo", "fcp"],
    practice: [
      "What happens if code references `window` or `document` during server-side execution?",
      "How does SSR affect time to first byte (TTFB) vs first contentful paint (FCP)?"
    ]
  }),

  createCard({
    idNum: 103,
    category: "HTTP Client, Functional Interceptors & SSR Hydration",
    concept: "Non-Destructive Hydration (provideClientHydration)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Non-Destructive Hydration in Angular, and why is it superior to legacy destructive hydration?",
    quickAnswer: "Non-Destructive Hydration (`provideClientHydration()`) attaches Angular event listeners and internal data structures directly to the server-rendered HTML in the DOM without wiping and destroying the DOM nodes, completely eliminating page flickering and layout shifts.",
    detailedAnswer: "Historically in Angular Universal, when client-side JavaScript loaded, Angular destroyed the server-rendered DOM nodes and rebuilt the entire DOM tree from scratch. This caused visible flickering and destroyed user scroll position or focused inputs. Introduced in Angular 16+, non-destructive hydration preserves the existing DOM, walking the DOM tree and attaching event listeners and reactivity in-place.",
    code: `// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideClientHydration } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // Enables non-destructive DOM hydration!
    provideClientHydration()
  ]
};`,
    recallHint: "provideClientHydration(): attaches listeners to server HTML without destroying DOM nodes; 0 flicker.",
    interviewTip: "Mention that non-destructive hydration directly improves Cumulative Layout Shift (CLS) and Core Web Vitals scores by preventing DOM teardown on page load.",
    tags: ["hydration", "ssr", "performance", "cls"],
    practice: [
      "What causes hydration mismatch errors in the console (`NG0500`)?",
      "How do you skip hydration on a specific component using `ngSkipHydration`?"
    ]
  }),

  createCard({
    idNum: 104,
    category: "HTTP Client, Functional Interceptors & SSR Hydration",
    concept: "Hydration Event Replay (withEventReplay)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What problem does `withEventReplay()` solve during Angular hydration, and how does it work?",
    quickAnswer: "`withEventReplay()` captures user interactions (clicks, inputs) that happen before client-side JavaScript has finished loading, and replays those events once hydration completes, ensuring zero lost clicks for users on slow mobile networks.",
    detailedAnswer: "When SSR delivers HTML, users see interactive-looking buttons before the full JavaScript bundle has finished downloading and hydrating. If a user clicks a button during this window, normal browsers discard the click because event handlers are not attached yet. `withEventReplay()` (introduced in Angular 18) injects a tiny inline script into the server HTML that listens for early events, queues them, and replays them immediately after hydration finishes.",
    code: `// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideClientHydration(
      // Queues and replays user clicks/inputs before hydration completes!
      withEventReplay()
    )
  ]
};`,
    recallHint: "withEventReplay() queues clicks/inputs during page load and replays them once hydration finishes.",
    interviewTip: "This is a cutting-edge Angular 18 feature powered by Google's Event Dispatcher technology (similar to Google Search and YouTube). Great for proving up-to-date knowledge.",
    tags: ["hydration", "eventreplay", "angular18", "ux"],
    practice: [
      "How does `withEventReplay()` improve Interaction to Next Paint (INP)?",
      "Which browser events are captured by default during event replay?"
    ]
  }),

  createCard({
    idNum: 105,
    category: "HTTP Client, Functional Interceptors & SSR Hydration",
    concept: "TransferState API & withHttpTransferCacheOptions",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the `TransferState` API prevent duplicate HTTP requests between the server and client during SSR?",
    quickAnswer: "`TransferState` serializes HTTP response data into a `<script id=\"ng-state\">` tag in the server-rendered HTML. When the client hydrates, `withHttpTransferCacheOptions()` intercepts subsequent GET requests, reading the data from the script tag instead of making a duplicate HTTP call over the network.",
    detailedAnswer: "Without TransferState, an app makes an HTTP request on the server to render the page, and then makes the exact same HTTP request again on the browser when hydrating, wasting server bandwidth and causing UI flickers. Angular's HTTP Transfer Cache automatically caches GET and HEAD requests during SSR and deserializes them on client startup seamlessly.",
    code: `import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-cached-data',
  standalone: true,
  template: \`<h1>{{ data()?.title }}</h1>\`
})
export class CachedDataComponent implements OnInit {
  private http = inject(HttpClient);
  data = signal<{ title: string } | null>(null);

  ngOnInit() {
    // Angular automatically transfers this GET response from server to client!
    // No duplicate network request in browser DevTools!
    this.http.get<{ title: string }>('https://api.example.com/data')
      .subscribe(res => this.data.set(res));
  }
}`,
    recallHint: "TransferState serializes server HTTP responses into HTML script tag so client doesn't re-fetch.",
    interviewTip: "Mention that HTTP transfer caching is enabled by default with `provideClientHydration()`. You can disable it per-request via `new HttpContext().set(SKIP_HTTP_TRANSFER_CACHE, true)`.",
    tags: ["transferstate", "ssr", "httpclient", "performance"],
    practice: [
      "How do you manually write and read custom objects in `TransferState` using `makeStateKey`?",
      "Why should POST/PUT requests never be cached in `TransferState`?"
    ]
  }),

  createCard({
    idNum: 106,
    category: "HTTP Client, Functional Interceptors & SSR Hydration",
    concept: "isPlatformBrowser & isPlatformServer Guarding",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you safely guard browser-specific APIs (`window`, `localStorage`, `document`) in SSR applications using `PLATFORM_ID`?",
    quickAnswer: "Inject `PLATFORM_ID` and evaluate `isPlatformBrowser(platformId)` before accessing `window`, `localStorage`, or `navigator`. In server environments, accessing `window` directly throws a fatal `ReferenceError: window is not defined`.",
    detailedAnswer: "Node.js has no `window`, `document`, or `localStorage`. Any code executing in an SSR app that attempts `window.localStorage.getItem(...)` during server rendering crashes the Node process. By injecting `PLATFORM_ID` and checking `isPlatformBrowser(this.platformId)`, you branch logic safely. Alternatively, use Angular's `DOCUMENT` token (`inject(DOCUMENT)`) for safe DOM manipulation.",
    code: `import { Component, inject, PLATFORM_ID, OnInit } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-storage-demo',
  standalone: true,
  template: \`<p>Theme: {{ theme }}</p>\`
})
export class StorageDemoComponent implements OnInit {
  private platformId = inject(PLATFORM_ID);
  theme = 'light';

  ngOnInit() {
    // Check if running on the client browser before touching window/localStorage:
    if (isPlatformBrowser(this.platformId)) {
      this.theme = localStorage.getItem('app-theme') || 'light';
    }
  }
}`,
    recallHint: "isPlatformBrowser(inject(PLATFORM_ID)): guards window/localStorage access to avoid server crash.",
    interviewTip: "Highlight that `afterNextRender` and `afterRender` lifecycle hooks in Angular 16+ only run on the browser, making them safer alternatives to `ngOnInit` for browser DOM code.",
    tags: ["platform-id", "isplatformbrowser", "ssr", "window-guard"],
    practice: [
      "Why do `afterRender` and `afterNextRender` never run on the server?",
      "How do you mock `PLATFORM_ID` in unit tests?"
    ]
  }),

  createCard({
    idNum: 107,
    category: "HTTP Client, Functional Interceptors & SSR Hydration",
    concept: "Static Site Generation (SSG) & Prerendering",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is Static Site Generation (Prerendering) in Angular, and how do you configure parameterized routes for SSG?",
    quickAnswer: "Prerendering generates static `.html` files at build-time for specified routes rather than rendering on-demand per request. Specify static routes in `angular.json` or create a `routes.txt` file (or provide a dynamic route parameter function).",
    detailedAnswer: "SSG delivers the fastest possible performance (0ms server compute time) because HTML files can be served directly from global CDN edge caches. For dynamic routes like `/blog/:slug`, Angular allows providing an asynchronous function that fetches all slugs and returns an array of paths (e.g. `['/blog/post-1', '/blog/post-2']`) so the compiler can prerender each page at build time.",
    code: `// angular.json or prerender config:
// "prerender": {
//   "routesFile": "routes.txt",
//   "discoverRoutes": true
// }

// routes.txt:
// /
// /about
// /contact
// /pricing

// For dynamic parameterized routes in Angular 17+:
// export async function getPrerenderParams(): Promise<Record<string, string>[]> {
//   const ids = await fetchAllProductIds();
//   return ids.map(id => ({ id }));
// }`,
    recallHint: "SSG prerenders HTML at build-time for 0ms CDN hosting; configured via discoverRoutes or routes.txt.",
    interviewTip: "Explain the difference between SSR (rendered on-demand per request, ideal for personalized dashboards) vs SSG (rendered at build-time, ideal for marketing pages and public blogs).",
    tags: ["ssg", "prerendering", "angular-ssr", "cdn"],
    practice: [
      "What happens when a user visits a dynamic route that was not prerendered during build time?",
      "How does `discoverRoutes: true` automatically identify static routes in your `app.routes.ts`?"
    ]
  }),

  createCard({
    idNum: 108,
    category: "HTTP Client, Functional Interceptors & SSR Hydration",
    concept: "Handling Cookies & Auth Headers in SSR",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you forward incoming client browser cookies and headers to internal API requests during Server-Side Rendering?",
    quickAnswer: "In the server execution context, inject the incoming HTTP request (`REQUEST` token from `@angular/ssr`), extract the `Cookie` or `Authorization` headers, and use an HTTP interceptor to attach them to server-side outbound API requests.",
    detailedAnswer: "When a browser requests an SSR page, the browser's cookies are sent to the Node.js server, NOT to the backend microservice. If the Angular SSR code makes an API call to `/api/user-profile`, that call runs on the Node server and has no cookies by default, resulting in a 401 error. By capturing the incoming request headers via `REQUEST` and cloning them onto outbound requests, the user session is preserved during server rendering.",
    code: `import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';

// Note: In @angular/ssr, REQUEST token injects the incoming Node request
export const ssrCookieForwardInterceptor: HttpInterceptorFn = (req, next) => {
  const platformId = inject(PLATFORM_ID);

  if (isPlatformServer(platformId)) {
    // In server environment, forward cookies to backend API
    // const incomingReq = inject(REQUEST, { optional: true });
    // const cookies = incomingReq?.headers?.cookie;
    // if (cookies) {
    //   req = req.clone({ setHeaders: { Cookie: cookies } });
    // }
  }

  return next(req);
};`,
    recallHint: "In SSR, inject incoming REQUEST to forward client cookies/headers to internal microservice calls.",
    interviewTip: "Highlight the security consideration: never forward sensitive external third-party cookies to unintended domains. Always check that the target API URL is your trusted internal backend.",
    tags: ["ssr", "cookies", "auth", "security"],
    practice: [
      "Why does omitting cookie forwarding cause SSR to render an unauthenticated 'logged out' view?",
      "How do you prevent cookie leakage when making third-party external API calls during SSR?"
    ]
  })
];
