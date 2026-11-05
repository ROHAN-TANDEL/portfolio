const { createCard } = require('../angular_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 25,
    category: "Reactive Programming with RxJS in Angular",
    concept: "Observables vs Promises in Angular",
    priority: "must-know",
    difficulty: "beginner",
    question: "What are the core differences between RxJS Observables and native JavaScript Promises?",
    quickAnswer: "Promises are eager, emit a single value, and cannot be cancelled once started. Observables are lazy (execute only upon subscription), can emit zero to infinite values over time, and can be cancelled at any time by unsubscribing.",
    detailedAnswer: "Angular uses RxJS Observables throughout its core architecture (HTTP client, router events, reactive form value changes). When a Promise is created (`new Promise(...)`), its executor runs immediately. An Observable (`new Observable(...)`) does nothing until a subscriber calls `.subscribe()`. Furthermore, an in-flight HTTP request driven by an Observable can be aborted immediately when a user navigates away simply by unsubscribing (triggering `AbortController` under the hood).",
    code: `// 1. Promise: Eager, single emission, un-cancellable
const myPromise = new Promise(resolve => {
  console.log('Executes immediately!');
  setTimeout(() => resolve('Data'), 1000);
});

// 2. Observable: Lazy, multiple emissions, cancellable
import { Observable } from 'rxjs';

const myObservable$ = new Observable(subscriber => {
  console.log('Executes ONLY when subscribed!');
  let count = 0;
  const id = setInterval(() => subscriber.next(count++), 1000);

  // Teardown logic runs on unsubscribe!
  return () => {
    console.log('Cancelled & cleaned up!');
    clearInterval(id);
  };
});`,
    recallHint: "Promises = eager, single value, un-cancellable; Observables = lazy, stream of values, cancellable.",
    interviewTip: "Highlight that Observables provide over 100 functional operators (map, filter, switchMap, debounceTime) for declarative stream transformation, whereas Promises only have `.then()`, `.catch()`, and `.finally()`.",
    tags: ["rxjs", "observables", "promises", "reactive-programming"],
    practice: [
      "Why is lazyness an advantage for HTTP requests in Angular?",
      "How does unsubscribing from an Angular HttpClient request abort the network request?"
    ]
  }),

  createCard({
    idNum: 26,
    category: "Reactive Programming with RxJS in Angular",
    concept: "Subjects: Subject, BehaviorSubject, ReplaySubject & AsyncSubject",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Compare the four types of RxJS Subjects: `Subject`, `BehaviorSubject`, `ReplaySubject`, and `AsyncSubject`.",
    quickAnswer: "1) `Subject`: Multicast without initial value or memory; 2) `BehaviorSubject`: Requires initial value, replays latest value to new subscribers, exposes `.getValue()`; 3) `ReplaySubject(N)`: Buffers and replays last N emissions; 4) `AsyncSubject`: Emits only the last value upon completion.",
    detailedAnswer: "A Subject is both an Observable and an Observer (can emit values via `.next()` and be subscribed to). `BehaviorSubject` is the classic tool for state stores because subscribers immediately receive the current state upon subscribing (`const user$ = new BehaviorSubject(null)`). `ReplaySubject(1)` is similar but does not require an initial value, buffering the latest emission until a subscriber arrives. `Subject` is ideal for transient event dispatchers (e.g. click events).",
    code: `import { Subject, BehaviorSubject, ReplaySubject, AsyncSubject } from 'rxjs';

// 1. BehaviorSubject: Requires initial value; replays 1 latest value
const auth$ = new BehaviorSubject({ isAuthenticated: false });
auth$.subscribe(val => console.log('Subscriber A:', val)); // Prints: { isAuthenticated: false }
auth$.next({ isAuthenticated: true });
auth$.subscribe(val => console.log('Subscriber B:', val)); // Prints: { isAuthenticated: true }

// 2. ReplaySubject(2): Replays last 2 emissions to new subscribers
const history$ = new ReplaySubject(2);
history$.next('Action 1');
history$.next('Action 2');
history$.next('Action 3');
history$.subscribe(val => console.log('Late subscriber:', val)); // Prints: 'Action 2', 'Action 3'

// 3. Subject: No memory! Late subscribers miss earlier emissions
const events$ = new Subject();
events$.next('Missed');
events$.subscribe(val => console.log(val)); // Won't receive 'Missed'!`,
    recallHint: "BehaviorSubject = has initial value + replays 1; ReplaySubject(N) = replays N items; Subject = 0 memory.",
    interviewTip: "Mention that in modern Angular 17+, `signal()` is often preferred over `BehaviorSubject` for local component synchronous state due to cleaner syntax and zero RxJS subscription boilerplate.",
    tags: ["subjects", "BehaviorSubject", "ReplaySubject", "rxjs"],
    practice: [
      "Why is `BehaviorSubject.getValue()` discouraged in reactive architectures?",
      "When is a `ReplaySubject(1)` preferable over a `BehaviorSubject`?"
    ]
  }),

  createCard({
    idNum: 27,
    category: "Reactive Programming with RxJS in Angular",
    concept: "Higher-Order Mapping Operators: switchMap vs mergeMap vs concatMap vs exhaustMap",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the critical behavioral difference between `switchMap`, `mergeMap`, `concatMap`, and `exhaustMap`?",
    quickAnswer: "1) `switchMap`: Cancels in-flight inner request if a new emission arrives (search/filtering); 2) `mergeMap`: Runs all inner requests concurrently in parallel (batch uploads); 3) `concatMap`: Queues inner requests in strict sequential FIFO order (ordered saves); 4) `exhaustMap`: Ignores new emissions while an inner request is running (login/submit buttons).",
    detailedAnswer: "Higher-order operators flatten an Observable of Observables. Choosing the wrong operator causes severe production bugs: using `mergeMap` for live search causes race conditions (stale query response overwrites new query); using `switchMap` for payment submission cancels previous transactions! `exhaustMap` is the gold standard for non-reentrant submit buttons; `concatMap` ensures database operations execute in exact chronological sequence.",
    code: `import { fromEvent } from 'rxjs';
import { switchMap, mergeMap, concatMap, exhaustMap } from 'rxjs/operators';

// 1. switchMap: Live Search (Cancels previous pending HTTP request!)
searchInput$.pipe(
  switchMap(query => http.get(\`/api/search?q=\${query}\`))
);

// 2. exhaustMap: Submit Button (Ignores extra clicks while request in-flight!)
submitClick$.pipe(
  exhaustMap(payload => http.post('/api/checkout', payload))
);

// 3. concatMap: Ordered Messages (Runs sequentially in exact order!)
messageStream$.pipe(
  concatMap(msg => http.post('/api/messages', msg))
);

// 4. mergeMap: File Uploads (Runs all uploads concurrently in parallel!)
fileDropStream$.pipe(
  mergeMap(file => uploadFile(file))
);`,
    recallHint: "switchMap (cancel previous), mergeMap (run concurrent), concatMap (queue sequential), exhaustMap (ignore while active).",
    interviewTip: "This is a top-3 most frequently asked senior Angular interview question. Memorize the 4 use cases: search (switchMap), click defense (exhaustMap), ordered sequence (concatMap), and parallel tasks (mergeMap).",
    tags: ["flattening-operators", "switchMap", "exhaustMap", "concatMap", "mergeMap"],
    practice: [
      "What disaster occurs if you use switchMap for a financial payment submission handler?",
      "Why does mergeMap cause out-of-order race conditions in search autocomplete?"
    ]
  }),

  createCard({
    idNum: 28,
    category: "Reactive Programming with RxJS in Angular",
    concept: "Search Autocomplete Pipeline with RxJS",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you construct a high-performance search autocomplete stream in Angular using `debounceTime`, `distinctUntilChanged`, and `switchMap`?",
    quickAnswer: "Pipe input events through `debounceTime(300)` (waits for typing pause), `distinctUntilChanged()` (ignores duplicate inputs like arrow keys), and `switchMap()` (cancels previous in-flight requests and executes fresh search).",
    detailedAnswer: "Without this pipeline, typing 'Angular' makes 7 separate HTTP requests, saturating the backend and triggering out-of-order race conditions. `debounceTime(300)` discards intermediate keystrokes. `distinctUntilChanged()` prevents re-querying if the user presses navigation keys (Shift, Alt, Arrows) that don't change the string. `switchMap()` guarantees that if request A is pending when request B is dispatched, request A is immediately aborted.",
    code: `import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AsyncPipe, NgFor, NgIf } from '@angular/common';
import { debounceTime, distinctUntilChanged, switchMap, filter, catchError, of } from 'rxjs';

@Component({
  selector: 'app-typeahead-search',
  standalone: true,
  imports: [ReactiveFormsModule, AsyncPipe, NgFor, NgIf],
  template: \`
    <input [formControl]="searchControl" placeholder="Search products..." />
    <ul *ngIf="results$ | async as results">
      <li *ngFor="let item of results">{{ item.title }}</li>
    </ul>
  \`
})
export class TypeaheadSearchComponent {
  private http = inject(HttpClient);
  searchControl = new FormControl('');

  // Declarative reactive search pipeline:
  results$ = this.searchControl.valueChanges.pipe(
    filter((text): text is string => (text?.trim().length || 0) >= 2), // Min 2 chars
    debounceTime(300),                                                // Wait 300ms pause
    distinctUntilChanged(),                                          // Only if text changed
    switchMap(query =>                                               // Cancel stale requests
      this.http.get<any[]>(\`/api/products?q=\${encodeURIComponent(query)}\`).pipe(
        catchError(() => of([]))                                     // Resilient: never break outer stream!
      )
    )
  );
}`,
    recallHint: "filter (min length) -> debounceTime (pause) -> distinctUntilChanged (no dupes) -> switchMap (cancel stale).",
    interviewTip: "Point out the nested `catchError(() => of([]))` inside `switchMap`: if you put `catchError` outside `switchMap`, an HTTP error will terminate the outer `valueChanges` stream permanently!",
    tags: ["typeahead", "autocomplete", "debounceTime", "switchMap", "distinctUntilChanged"],
    practice: [
      "Why must catchError be placed INSIDE the switchMap pipe rather than on the outer stream?",
      "What is the difference between `filter` and `distinctUntilChanged` in this pipeline?"
    ]
  }),

  createCard({
    idNum: 29,
    category: "Reactive Programming with RxJS in Angular",
    concept: "Memory Leaks & Subscription Management",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why do un-cancelled RxJS subscriptions cause severe memory leaks in Angular, and what are the three best ways to prevent them?",
    quickAnswer: "Subscriptions keep components alive in memory through closure references even after the DOM element is destroyed. Fixes: 1) `takeUntilDestroyed()` in Angular 16+; 2) `AsyncPipe` in templates (handles unmount automatically); 3) Manual `Subscription.unsubscribe()` in `ngOnDestroy`.",
    detailedAnswer: "When you call `myService.stream$.subscribe()`, the long-lived service holds a reference to the callback function, which retains the component's `this` context. When the user navigates away, the component DOM is destroyed, but the component instance cannot be garbage-collected by V8. The callback continues running in the background on every new emission. `AsyncPipe` and `takeUntilDestroyed()` automate unsubscription, preventing detached component memory leaks.",
    code: `import { Component, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval } from 'rxjs';

@Component({
  selector: 'app-safe-subscriber',
  standalone: true,
  template: \`<p>Active</p>\`
})
export class SafeSubscriberComponent {
  constructor() {
    // 1. BEST PRACTICE: takeUntilDestroyed() in constructor context
    interval(1000)
      .pipe(takeUntilDestroyed())
      .subscribe(val => console.log('Tick:', val)); // Automatically cancelled on unmount!
  }

  // 2. TEMPLATE PATTERN: AsyncPipe (Zero manual subscriptions!)
  // <p>{{ counter$ | async }}</p>
}`,
    recallHint: "Uncancelled subscriptions keep component in memory; use takeUntilDestroyed() or AsyncPipe to auto-unsubscribe.",
    interviewTip: "Clarify that `HttpClient` requests (e.g. `http.get()`) technically complete after 1 emission and don't strictly leak, BUT long-lived streams (router events, intervals, subjects, NgRx stores) will leak indefinitely unless unsubscribed.",
    tags: ["memory-leaks", "takeUntilDestroyed", "AsyncPipe", "subscriptions"],
    practice: [
      "Do Angular HttpClient requests cause memory leaks if not unsubscribed?",
      "Why does takeUntilDestroyed() require an injection context when called without arguments?"
    ]
  }),

  createCard({
    idNum: 30,
    category: "Reactive Programming with RxJS in Angular",
    concept: "HTTP Request Caching with shareReplay",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does `shareReplay({ bufferSize: 1, refCount: true })` prevent duplicate HTTP requests across multiple subscribers?",
    quickAnswer: "`shareReplay` transforms a cold, unicast observable into a hot, multicasted stream that caches and replays the latest emission. `refCount: true` ensures that when all subscribers unsubscribe, the internal subscription is disposed and the cache is ready for garbage collection.",
    detailedAnswer: "In Angular, `HttpClient.get()` is cold: every time someone subscribes (or every time an `async` pipe binds in the template), a new physical HTTP network request is made. If a component has three `data$ | async` bindings, three identical network requests fire. Wrapping the stream in `shareReplay({ bufferSize: 1, refCount: true })` ensures the HTTP call runs only once, sharing the cached response with all subscribers.",
    code: `import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { shareReplay, Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private http = inject(HttpClient);

  // Cached multicasted stream:
  readonly categories$: Observable<any[]> = this.http.get<any[]>('/api/categories').pipe(
    // 1. bufferSize: 1 -> Replays 1 latest response to late subscribers
    // 2. refCount: true -> Cleans up subscription when active subscriber count hits 0
    shareReplay({ bufferSize: 1, refCount: true })
  );
}`,
    recallHint: "shareReplay({ bufferSize: 1, refCount: true }) turns cold HTTP into hot multicasted cache; refCount prevents memory leaks.",
    interviewTip: "CRITICAL: Always specify `refCount: true` with `shareReplay`. Without `refCount: true`, the internal subscription remains permanently open, which can retain stale errors or leak memory.",
    tags: ["shareReplay", "multicasting", "caching", "http-deduplication"],
    practice: [
      "Why is `refCount: true` critical when using shareReplay with HTTP requests?",
      "What happens if an error occurs inside a stream cached with `shareReplay`?"
    ]
  }),

  createCard({
    idNum: 31,
    category: "Reactive Programming with RxJS in Angular",
    concept: "Error Handling: catchError, EMPTY & throwError",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you handle errors properly in RxJS streams using `catchError`, and when should you return `EMPTY` versus a fallback value?",
    quickAnswer: "`catchError` intercepts an error notification in an Observable. Returning a fallback value (`of(defaultData)`) recovers the stream with data. Returning `EMPTY` gracefully terminates the stream without emitting values. Returning `throwError(() => err)` re-throws the error for upstream handlers.",
    detailedAnswer: "In RxJS, once an Observable emits an `error` notification, the stream is permanently terminated (dead) and can never emit again. `catchError(err => ...)` catches the error and must return a replacement Observable. If you want to supply a fallback cache, return `of(cachedData)`. If you want to complete cleanly without rendering anything, return `EMPTY`. Never return raw values (e.g. `return null`) from `catchError`—it must return an Observable.",
    code: `import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, of, EMPTY, throwError } from 'rxjs';

@Component({ selector: 'app-error-demo', standalone: true, template: \`<p>Error Handled</p>\` })
export class ErrorDemoComponent {
  private http = inject(HttpClient);

  // 1. Fallback recovery: Returns empty array on network failure
  users$ = this.http.get<any[]>('/api/users').pipe(
    catchError(err => {
      console.error('Failed to load users:', err);
      return of([]); // Stream stays ALIVE with empty array fallback!
    })
  );

  // 2. Silent termination with EMPTY
  nonCriticalData$ = this.http.get('/api/analytics').pipe(
    catchError(() => EMPTY) // Completes silently without breaking parent
  );

  // 3. Re-throwing error after logging
  criticalAction$ = this.http.post('/api/charge', {}).pipe(
    catchError(err => {
      telemetry.logError(err);
      return throwError(() => new Error('Transaction failed. Please retry.'));
    })
  );
}`,
    recallHint: "catchError must return an Observable: of(fallback) for recovery, EMPTY for silent complete, throwError() to rethrow.",
    interviewTip: "Warn against letting errors escape unhandled: an uncaught error in an RxJS stream permanently kills the stream, meaning subsequent user clicks will produce zero response.",
    tags: ["catchError", "EMPTY", "throwError", "error-handling"],
    practice: [
      "Why does an uncaught error permanently break an RxJS Observable stream?",
      "How does `retryWhen` or `retry` integrate with `catchError`?"
    ]
  }),

  createCard({
    idNum: 32,
    category: "Reactive Programming with RxJS in Angular",
    concept: "Exponential Backoff Retry Strategy",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you implement an exponential backoff retry strategy in Angular using RxJS `retry()`?",
    quickAnswer: "Use `retry({ count, delay })` with an exponential mathematical formula (`2 ** retryIndex * 1000`) inside the `delay` function to retry transient network failures with progressively increasing pauses.",
    detailedAnswer: "Blasting a struggling server with immediate retries exacerbates network outages. Exponential backoff pauses between retries (e.g. 1s -> 2s -> 4s). In modern RxJS 7.4+, the `retry()` operator accepts a configuration object with `delay: (error, retryCount) => timer(...)`. This cleanly retries failed HTTP requests without complex `retryWhen` boilerplate.",
    code: `import { HttpClient } from '@angular/common/http';
import { retry, timer, throwError } from 'rxjs';

export function fetchWithExponentialBackoff(http: HttpClient, url: string) {
  return http.get(url).pipe(
    retry({
      count: 3, // Retry up to 3 times
      delay: (error, retryCount) => {
        // If client-side error (4xx), do NOT retry!
        if (error.status >= 400 && error.status < 500) {
          return throwError(() => error);
        }

        // Exponential backoff: 1s, 2s, 4s...
        const delayMs = Math.pow(2, retryCount - 1) * 1000;
        console.warn(\`Attempt \${retryCount} failed. Retrying in \${delayMs}ms...\`);
        return timer(delayMs);
      }
    })
  );
}`,
    recallHint: "retry({ count: 3, delay: (err, count) => timer(2**(count-1) * 1000) }) implements exponential backoff.",
    interviewTip: "Always filter out HTTP 4xx client errors (like 401 Unauthorized or 404 Not Found)—retrying a 404 will never succeed and wastes battery/bandwidth.",
    tags: ["retry", "exponential-backoff", "resilience", "http"],
    practice: [
      "Why should HTTP 4xx client errors be excluded from retry strategies?",
      "How does adding 'jitter' (random milliseconds) prevent the thundering herd problem in retries?"
    ]
  }),

  createCard({
    idNum: 33,
    category: "Reactive Programming with RxJS in Angular",
    concept: "Declarative Polling with timer and switchMap",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you implement an auto-refreshing polling mechanism in Angular using `timer` and `switchMap` without memory leaks?",
    quickAnswer: "Use `timer(0, intervalMs).pipe(switchMap(() => http.get(...)), takeUntilDestroyed())`. `timer(0, interval)` triggers immediately on subscription and emits every interval, while `switchMap` cancels slower requests if a new poll tick arrives.",
    detailedAnswer: "Using `setInterval` inside a component requires manual lifecycle tracking and can cause request stacking if the network is slower than the interval. `timer(0, 5000)` emits index 0 immediately, and then emits every 5,000ms. Piping into `switchMap` guarantees that if an API call takes 6 seconds, the previous in-flight request is safely aborted before the next poll runs. Pairing with `takeUntilDestroyed()` guarantees clean unsubscription.",
    code: `import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { AsyncPipe, NgIf } from '@angular/common';
import { timer, switchMap, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-live-status',
  standalone: true,
  imports: [AsyncPipe, NgIf],
  template: \`
    <div *ngIf="status$ | async as status">
      <h3>System Status: {{ status.state }}</h3>
      <p>Last checked: {{ status.timestamp }}</p>
    </div>
  \`
})
export class LiveStatusComponent {
  private http = inject(HttpClient);

  // Polls immediately on mount (0ms) and repeats every 10 seconds:
  status$ = timer(0, 10000).pipe(
    switchMap(() => this.http.get<{ state: string; timestamp: string }>('/api/status').pipe(
      catchError(() => of({ state: 'OFFLINE', timestamp: 'N/A' }))
    )),
    takeUntilDestroyed()
  );
}`,
    recallHint: "timer(0, intervalMs).pipe(switchMap(() => http.get()), takeUntilDestroyed()) = robust polling stream.",
    interviewTip: "Highlight the advantage of `timer(0, interval)` over `interval(interval)`: `interval(5000)` waits 5 seconds before the very first emission, leaving a blank UI on load, whereas `timer(0, 5000)` fires immediately.",
    tags: ["polling", "timer", "switchMap", "takeUntilDestroyed"],
    practice: [
      "Why is `timer(0, 5000)` superior to `interval(5000)` for polling?",
      "How do you pause polling when the browser tab is hidden in the background?"
    ]
  }),

  createCard({
    idNum: 34,
    category: "Reactive Programming with RxJS in Angular",
    concept: "Combining Streams: combineLatest vs forkJoin vs zip",
    priority: "must-know",
    difficulty: "advanced",
    question: "When should you use `combineLatest`, `forkJoin`, and `zip` when orchestrating multiple Angular streams?",
    quickAnswer: "1) `forkJoin`: Waits for ALL streams to complete and emits their last values as an array (equivalent to `Promise.all`); 2) `combineLatest`: Emits whenever ANY source stream emits after all have emitted at least once; 3) `zip`: Pairs emissions 1-to-1 in lockstep order.",
    detailedAnswer: "Use `forkJoin([httpA$, httpB$])` when loading initial page data from multiple HTTP endpoints that complete once. Use `combineLatest([filter$, sort$, page$])` for dynamic UI dashboards: whenever the user updates the search filter OR changes the page, `combineLatest` fires with the freshest tuple `[currentFilter, currentSort, currentPage]`. Use `zip` when synchronizing multi-device event sequences.",
    code: `import { combineLatest, forkJoin } from 'rxjs';

// 1. forkJoin: Parallel HTTP calls (All must complete!)
forkJoin({
  user: http.get('/api/user/me'),
  permissions: http.get('/api/permissions')
}).subscribe(({ user, permissions }) => {
  console.log('Both completed:', user, permissions);
});

// 2. combineLatest: Reactive UI State combination
combineLatest({
  query: searchControl.valueChanges,
  category: categoryControl.valueChanges
}).subscribe(({ query, category }) => {
  // Fires whenever EITHER query OR category updates!
  console.log('Active filters:', query, category);
});`,
    recallHint: "forkJoin = Promise.all (waits for all to complete); combineLatest = reactive UI combination (fires on any change).",
    interviewTip: "CRITICAL PITFALL: `combineLatest` will NEVER emit if any single input stream never emits! Ensure all input streams emit at least one value (or start with `startWith()`).",
    tags: ["combineLatest", "forkJoin", "zip", "combination-operators"],
    practice: [
      "Why won't combineLatest emit if one of the source streams hasn't emitted yet?",
      "What happens if one of the HTTP requests in forkJoin throws an error?"
    ]
  }),

  createCard({
    idNum: 35,
    category: "Reactive Programming with RxJS in Angular",
    concept: "Cold vs Hot Observables in Angular Architectures",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between a Cold Observable and a Hot Observable, and how do you convert a cold stream into a hot one?",
    quickAnswer: "A Cold Observable produces data *inside* the producer for each subscriber independently (unicast, e.g. `HttpClient`). A Hot Observable produces data *outside* regardless of subscribers and shares emissions (multicast, e.g. mouse clicks, Subjects). Convert cold to hot using `shareReplay()` or `share()`.",
    detailedAnswer: "Think of a Cold Observable like a movie on Netflix: each subscriber presses play and watches from the beginning independently. Think of a Hot Observable like a live broadcast TV stream: the broadcast runs regardless of whether your TV is on, and all viewers see the identical live moment. In Angular, calling `http.get()` creates a cold observable. Piping it into `shareReplay(1)` makes it hot: the HTTP call runs once and the response is shared with all viewers.",
    code: `// 1. COLD OBSERVABLE: Independent executions per subscriber
const cold$ = new Observable(subscriber => {
  const randomVal = Math.random(); // Generated per subscriber!
  subscriber.next(randomVal);
});
cold$.subscribe(v => console.log('Sub A:', v)); // Sub A: 0.123
cold$.subscribe(v => console.log('Sub B:', v)); // Sub B: 0.892 (Different number!)

// 2. HOT OBSERVABLE (via Subject): Shared execution
const hot$ = new Subject();
hot$.subscribe(v => console.log('Sub A:', v)); // Receives shared value
hot$.subscribe(v => console.log('Sub B:', v)); // Receives shared value
hot$.next(Math.random()); // Both subscribers receive the IDENTICAL number!`,
    recallHint: "Cold = unicast (Netflix movie on demand); Hot = multicast (Live broadcast shared).",
    interviewTip: "Be ready to explain that converting cold HTTP observables to hot via `shareReplay` is the standard technique for caching API responses in Angular services.",
    tags: ["cold-vs-hot", "unicast", "multicast", "shareReplay"],
    practice: [
      "Is an Angular Router `events` stream hot or cold?",
      "Why does subscribing twice to a cold Observable execute two separate HTTP requests?"
    ]
  }),

  createCard({
    idNum: 36,
    category: "Reactive Programming with RxJS in Angular",
    concept: "Declarative UI Streams with AsyncPipe",
    priority: "must-know",
    difficulty: "beginner",
    question: "Why does modern Angular strongly recommend using the `AsyncPipe` in templates instead of manual `.subscribe()` calls in component classes?",
    quickAnswer: "`AsyncPipe` automates subscription and unsubscription lifecycles, triggers change detection automatically for `OnPush` components, and eliminates component boilerplate variables and memory leak risks.",
    detailedAnswer: "In imperative Angular, developers store data in local class properties (`this.users = users`) by calling `.subscribe()`. This requires manual unsubscription in `ngOnDestroy` and requires calling `cdr.markForCheck()` manually in `OnPush` components. `AsyncPipe` (`user$ | async`) subscribes when the element enters the DOM, marks the view dirty whenever a new value emits, and automatically unsubscribes when the element unmounts, making components purely declarative.",
    code: `// IMPERATIVE ANTI-PATTERN: Manual subscribe + manual cleanup + boilerplate
export class BadComponent implements OnInit, OnDestroy {
  users: User[] = [];
  private sub?: Subscription;

  ngOnInit() {
    this.sub = this.userService.getUsers().subscribe(u => this.users = u);
  }
  ngOnDestroy() {
    this.sub?.unsubscribe();
  }
}

// DECLARATIVE PRODUCTION PATTERN: 1 line + AsyncPipe
@Component({
  selector: 'app-good-users',
  standalone: true,
  imports: [AsyncPipe, NgFor, NgIf],
  template: \`
    <div *ngIf="users$ | async as users">
      <div *ngFor="let user of users">{{ user.name }}</div>
    </div>
  \`
})
export class GoodComponent {
  private userService = inject(UserService);
  users$ = this.userService.getUsers(); // Pure observable stream!
}`,
    recallHint: "AsyncPipe auto-subscribes, auto-unsubscribes on unmount, and triggers OnPush change detection.",
    interviewTip: "Highlight the clean alias syntax: `*ngIf=\"users$ | async as users\"` unrolls the observable once and makes the typed `users` object available across the entire sub-tree.",
    tags: ["AsyncPipe", "declarative-ui", "OnPush", "best-practices"],
    practice: [
      "Why does AsyncPipe work seamlessly with OnPush components while manual subscription requires markForCheck?",
      "How do you unroll multiple async pipes in a template cleanly using a single container?"
    ]
  })
];
