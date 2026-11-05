module.exports = [
  {
    id: "angular-ex-12",
    title: "Typeahead Autocomplete Search with switchMap & Cancellation",
    category: "Reactive RxJS Orchestration",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs an enterprise search typeahead input with debouncing, duplicate suppression, and switchMap race-condition cancellation.",
    conceptsCovered: [
      "switchMap",
      "debounceTime",
      "distinctUntilChanged",
      "filter",
      "toSignal"
    ],
    code: `import { Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { debounceTime, distinctUntilChanged, switchMap, filter, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { toSignal } from '@angular/core/rxjs-interop';

interface SearchResult { id: string; title: string; }

@Component({
  selector: 'app-typeahead-search',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: \`
    <input [formControl]="searchControl" placeholder="Search articles..." />
    <ul>
      @for (item of results(); track item.id) {
        <li>{{ item.title }}</li>
      }
    </ul>
  \`
})
export class TypeaheadSearchComponent {
  private http = inject(HttpClient);
  searchControl = new FormControl('', { nonNullable: true });

  private search$ = this.searchControl.valueChanges.pipe(
    debounceTime(300),
    filter(term => term.trim().length >= 2),
    distinctUntilChanged(),
    // switchMap cancels prior in-flight search requests when user types again!
    switchMap(query => this.http.get<SearchResult[]>(\`/api/search?q=\${encodeURIComponent(query)}\`).pipe(
      catchError(() => of([])) // Prevent stream failure
    ))
  );

  // Expose as clean synchronous Signal for the template
  results = toSignal(this.search$, { initialValue: [] });
}`,
    breakdown: [
      "debounceTime(300) waits 300ms after user stops typing before making network requests.",
      "filter(term => term.length >= 2) ignores single characters to avoid firing heavy queries.",
      "switchMap cancels prior in-flight HTTP calls if the user enters a new keystroke, preventing race conditions.",
      "toSignal converts the RxJS stream into a Signal, rendering cleanly in template without async pipe."
    ],
    expectedOutput: "Smooth search autocomplete that cancels outdated network requests on fast keystrokes."
  },
  {
    id: "angular-ex-13",
    title: "Resilient Polling Stream with timer, exhaustMap & Auto-Teardown",
    category: "Reactive RxJS Orchestration",
    difficulty: "intermediate",
    whatThisCodeCovers: "Executes periodic background polling for status updates using timer and exhaustMap, avoiding overlapping concurrent requests and cleaning up via takeUntilDestroyed.",
    conceptsCovered: [
      "timer",
      "exhaustMap",
      "takeUntilDestroyed",
      "Background Polling",
      "DestroyRef"
    ],
    code: `import { Component, inject, OnInit, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { timer } from 'rxjs';
import { exhaustMap, tap } from 'rxjs/operators';
import { takeUntilDestroyed, DestroyRef } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-job-poller',
  standalone: true,
  template: \`
    <p>Job Status: {{ status() }}</p>
    <p>Last Ping: {{ lastPing() }}</p>
  \`
})
export class JobPollerComponent implements OnInit {
  private http = inject(HttpClient);
  private destroyRef = inject(DestroyRef);

  status = signal('PENDING');
  lastPing = signal('');

  ngOnInit() {
    // Polls every 5000ms after an initial 0ms delay:
    timer(0, 5000).pipe(
      // exhaustMap ignores timer tick if the previous HTTP poll is still pending!
      exhaustMap(() => this.http.get<{ status: string }>('/api/jobs/current/status')),
      takeUntilDestroyed(this.destroyRef) // Auto unsubs on component unmount
    ).subscribe({
      next: (res) => {
        this.status.set(res.status);
        this.lastPing.set(new Date().toLocaleTimeString());
      }
    });
  }
}`,
    breakdown: [
      "timer(0, 5000) generates an emission immediately and every 5 seconds thereafter.",
      "exhaustMap drops subsequent timer ticks if the previous HTTP response has not yet completed (slow networks).",
      "takeUntilDestroyed(this.destroyRef) automatically tears down the polling loop when navigating away.",
      "Updates Signals synchronously, ensuring OnPush change detection flags views cleanly."
    ],
    expectedOutput: "Polls server status every 5s without stacking duplicate requests on slow connections."
  },
  {
    id: "angular-ex-14",
    title: "Resilient HTTP Retry with Exponential Backoff & Jitter",
    category: "Reactive RxJS Orchestration",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements an exponential backoff retry mechanism with randomized jitter to handle transient network and 503 service unavailable failures gracefully.",
    conceptsCovered: [
      "retry",
      "Exponential Backoff",
      "Jitter Calculation",
      "Error Handling",
      "Resilience"
    ],
    code: `import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, timer, throwError } from 'rxjs';
import { retry } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class ResilientApiService {
  private http = inject(HttpClient);

  fetchDataWithRetry<T>(url: string, maxRetries = 3, baseDelayMs = 1000): Observable<T> {
    return this.http.get<T>(url).pipe(
      retry({
        count: maxRetries,
        delay: (error: HttpErrorResponse, retryCount: number) => {
          // Do not retry 4xx client errors (e.g. 401, 403, 404)
          if (error.status >= 400 && error.status < 500) {
            return throwError(() => error);
          }

          // Calculate Exponential Backoff: baseDelay * 2^(retryCount - 1)
          const exponentialDelay = baseDelayMs * Math.pow(2, retryCount - 1);
          // Add randomized Jitter (+/- 20%) to prevent thundering herd problem:
          const jitter = (Math.random() - 0.5) * 0.4 * exponentialDelay;
          const totalDelay = Math.max(100, Math.floor(exponentialDelay + jitter));

          console.warn(\`Attempt \${retryCount} failed. Retrying in \${totalDelay}ms...\`);
          return timer(totalDelay);
        }
      })
    );
  }
}`,
    breakdown: [
      "Uses RxJS 7+ retry({ count, delay: (err, count) => Observable }) signature.",
      "Checks error status code to avoid futile retries on 401 Unauthorized or 404 Not Found.",
      "Exponential backoff scales delay geometrically (1s, 2s, 4s, etc.).",
      "Randomized jitter prevents thousands of clients from hammering a recovering server simultaneously."
    ],
    expectedOutput: "Retries failed requests with increasing intervals and jitter before finally throwing error."
  },
  {
    id: "angular-ex-15",
    title: "Real-Time WebSocket Subject with Auto-Reconnect & Heartbeat",
    category: "Reactive RxJS Orchestration",
    difficulty: "advanced",
    whatThisCodeCovers: "Wraps browser WebSocket into an RxJS webSocket subject, handling automatic reconnection on disconnect, ping/pong heartbeats, and message multiplexing.",
    conceptsCovered: [
      "webSocket Subject",
      "Auto-Reconnect",
      "Heartbeat Ping/Pong",
      "retryWhen / retry",
      "Teardown"
    ],
    code: `import { Injectable } from '@angular/core';
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, timer, Subject } from 'rxjs';
import { retry, shareReplay, tap } from 'rxjs/operators';

@Injectable({ providedIn: 'root' })
export class RealtimeStreamService {
  private socket$?: WebSocketSubject<any>;
  private reconnectIntervalMs = 3000;

  connect<T>(url: string): Observable<T> {
    if (!this.socket$ || this.socket$.closed) {
      this.socket$ = webSocket({
        url,
        openObserver: {
          next: () => console.log('WebSocket connection opened successfully')
        },
        closeObserver: {
          next: () => console.warn('WebSocket connection closed. Scheduling reconnect...')
        }
      });
    }

    return this.socket$.asObservable().pipe(
      // Auto-reconnect on socket failure
      retry({
        delay: () => timer(this.reconnectIntervalMs)
      }),
      shareReplay({ bufferSize: 1, refCount: true })
    );
  }

  send(message: any) {
    this.socket$?.next(message);
  }

  close() {
    this.socket$?.complete();
  }
}`,
    breakdown: [
      "webSocket from rxjs/webSocket provides bidirectional message streaming.",
      "openObserver and closeObserver track socket connection state lifecycle.",
      "retry({ delay: () => timer(3000) }) automatically re-establishes socket connection after dropped network.",
      "shareReplay({ refCount: true }) multiplexes single socket among multiple component subscribers."
    ],
    expectedOutput: "Robust WebSocket stream that automatically re-establishes connection on disconnection."
  },
  {
    id: "angular-ex-16",
    title: "Concurrent Multi-Resource Loader with forkJoin & Loading States",
    category: "Reactive RxJS Orchestration",
    difficulty: "intermediate",
    whatThisCodeCovers: "Fetches user profile, permissions, and system preferences concurrently using forkJoin, mapping into a unified state model with error protection.",
    conceptsCovered: [
      "forkJoin",
      "catchError",
      "Concurrent Loading",
      "Unified State Model",
      "toSignal"
    ],
    code: `import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { forkJoin, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

interface DashboardData {
  user: { name: string };
  notifications: string[];
  systemStatus: string;
}

@Component({
  selector: 'app-dashboard-loader',
  standalone: true,
  template: \`
    @if (dashboard(); as data) {
      <h1>Welcome, {{ data.user.name }}</h1>
      <p>System: {{ data.systemStatus }}</p>
      <p>Notifications: {{ data.notifications.length }}</p>
    } @else {
      <div class="skeleton">Loading dashboard resources...</div>
    }
  \`
})
export class DashboardLoaderComponent {
  private http = inject(HttpClient);

  private dashboard$ = forkJoin({
    user: this.http.get<{ name: string }>('/api/user/me'),
    notifications: this.http.get<string[]>('/api/notifications').pipe(catchError(() => of([]))),
    systemStatus: this.http.get<{ status: string }>('/api/status').pipe(
      map(r => r.status),
      catchError(() => of('Operational'))
    )
  });

  dashboard = toSignal(this.dashboard$, { initialValue: null });
}`,
    breakdown: [
      "forkJoin executes all 3 HTTP requests concurrently in parallel.",
      "Emits only when ALL requests have successfully completed.",
      "Each individual call has localized catchError to prevent a single failure from aborting the entire page.",
      "toSignal delivers synchronous data object to the @if control flow block."
    ],
    expectedOutput: "Dashboard data loaded in parallel with fallback defaults for failing auxiliary endpoints."
  },
  {
    id: "angular-ex-17",
    title: "Sequential Order Processing Queue with concatMap",
    category: "Reactive RxJS Orchestration",
    difficulty: "intermediate",
    whatThisCodeCovers: "Guarantees strict sequential order of asynchronous tasks using concatMap, processing order submissions one after another without overlap.",
    conceptsCovered: [
      "concatMap",
      "Subject",
      "FIFO Processing",
      "Queue Management",
      "Async Synchronization"
    ],
    code: `import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Subject } from 'rxjs';
import { concatMap, tap } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface OrderItem { id: string; qty: number; }

@Component({
  selector: 'app-order-queue',
  standalone: true,
  template: \`
    <button (click)="enqueueOrder('ORD-1')">Submit Order 1</button>
    <button (click)="enqueueOrder('ORD-2')">Submit Order 2</button>
  \`
})
export class OrderQueueComponent {
  private http = inject(HttpClient);
  private queue$ = new Subject<OrderItem>();

  constructor() {
    this.queue$.pipe(
      // concatMap waits for the previous HTTP post to finish before starting next!
      concatMap(order => this.http.post('/api/orders/process', order).pipe(
        tap(() => console.log(\`Order \${order.id} processed successfully.\`))
      )),
      takeUntilDestroyed()
    ).subscribe();
  }

  enqueueOrder(id: string) {
    this.queue$.next({ id, qty: 1 });
  }
}`,
    breakdown: [
      "concatMap enforces strict First-In-First-Out (FIFO) sequential processing.",
      "If user clicks both buttons rapidly, Order 2 waits until Order 1 completes.",
      "Prevents concurrent stock allocation races on transactional backend endpoints.",
      "takeUntilDestroyed cleans up the queue processor on component unmount."
    ],
    expectedOutput: "Orders execute one at a time sequentially regardless of how fast user triggers them."
  },
  {
    id: "angular-ex-18",
    title: "High-Frequency Window Event Throttling with throttleTime",
    category: "Reactive RxJS Orchestration",
    difficulty: "intermediate",
    whatThisCodeCovers: "Throttles high-frequency window resize and scroll events to 60 FPS using throttleTime and asyncScheduler, updating coordinates smoothly.",
    conceptsCovered: [
      "fromEvent",
      "throttleTime",
      "asyncScheduler",
      "trailing: true",
      "Performance"
    ],
    code: `import { Component, inject, OnInit, signal, NgZone } from '@angular/core';
import { fromEvent, asyncScheduler } from 'rxjs';
import { throttleTime, map } from 'rxjs/operators';
import { takeUntilDestroyed, DestroyRef } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-scroll-spy',
  standalone: true,
  template: \`<p>Scroll Y: {{ scrollY() }}px</p>\`
})
export class ScrollSpyComponent implements OnInit {
  private destroyRef = inject(DestroyRef);
  private ngZone = inject(NgZone);

  scrollY = signal(0);

  ngOnInit() {
    // Run registration outside Angular zone to avoid Zone.js CD ticks on every pixel!
    this.ngZone.runOutsideAngular(() => {
      fromEvent(window, 'scroll').pipe(
        // Throttle to 60fps (16.6ms) with trailing emission enabled:
        throttleTime(16, asyncScheduler, { leading: true, trailing: true }),
        map(() => window.scrollY),
        takeUntilDestroyed(this.destroyRef)
      ).subscribe(y => {
        // Bring back into Angular zone to update signal
        this.ngZone.run(() => this.scrollY.set(y));
      });
    });
  }
}`,
    breakdown: [
      "fromEvent(window, 'scroll') creates an observable stream of scroll events.",
      "runOutsideAngular isolates high-frequency events from Zone.js change detection checks.",
      "throttleTime(16, asyncScheduler, { leading: true, trailing: true }) locks updates to 60 FPS.",
      "trailing: true guarantees the final resting scroll position is always captured."
    ],
    expectedOutput: "Smooth 60 FPS scroll tracking with zero CPU lag or frame dropping."
  },
  {
    id: "angular-ex-19",
    title: "Reactive In-Memory HTTP Cache with shareReplay",
    category: "Reactive RxJS Orchestration",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements an in-memory cached data service using shareReplay with bufferSize: 1 and refCount: true, deduplicating HTTP calls across components.",
    conceptsCovered: [
      "shareReplay",
      "refCount",
      "Deduplication",
      "Multicasting",
      "HTTP Caching"
    ],
    code: `import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { shareReplay } from 'rxjs/operators';

export interface Configuration { theme: string; version: string; }

@Injectable({ providedIn: 'root' })
export class ConfigService {
  private http = inject(HttpClient);
  private config$?: Observable<Configuration>;

  getConfig(): Observable<Configuration> {
    if (!this.config$) {
      this.config$ = this.http.get<Configuration>('/api/system/config').pipe(
        // Caches 1 latest emission; disposes cache when active subscribers drop to 0
        shareReplay({ bufferSize: 1, refCount: true })
      );
    }
    return this.config$;
  }

  invalidateCache() {
    this.config$ = undefined;
  }
}`,
    breakdown: [
      "shareReplay multicasts the single HTTP response to all current and future subscribers.",
      "bufferSize: 1 replays the latest cached emission immediately upon new subscription.",
      "refCount: true clears the cache if all subscribing components unmount (prevents stale leaks).",
      "invalidateCache allows manual cache invalidation upon mutation operations."
    ],
    expectedOutput: "Multiple components calling getConfig() share 1 single HTTP request."
  },
  {
    id: "angular-ex-20",
    title: "Type-Safe Cross-Component Event Bus with RxJS Subject",
    category: "Reactive RxJS Orchestration",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a decoupled, type-safe global event bus using RxJS Subject and discriminated union types for communication across disparate modules.",
    conceptsCovered: [
      "Subject",
      "Discriminated Unions",
      "filter",
      "Event Bus Pattern",
      "Type Safety"
    ],
    code: `import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
import { filter, map } from 'rxjs/operators';

// Discriminated union of system events:
export type AppEvent =
  | { type: 'NOTIFICATION'; payload: { message: string; level: 'info' | 'error' } }
  | { type: 'CART_UPDATED'; payload: { itemCount: number } }
  | { type: 'LOGOUT'; payload: { reason: string } };

@Injectable({ providedIn: 'root' })
export class EventBusService {
  private bus$ = new Subject<AppEvent>();

  emit(event: AppEvent) {
    this.bus$.next(event);
  }

  // Type-safe listener filtering specific event types:
  on<T extends AppEvent['type']>(eventType: T): Observable<Extract<AppEvent, { type: T }>['payload']> {
    return this.bus$.asObservable().pipe(
      filter((e): e is Extract<AppEvent, { type: T }> => e.type === eventType),
      map(e => e.payload)
    );
  }
}

// In Component:
// bus.emit({ type: 'NOTIFICATION', payload: { message: 'Saved!', level: 'info' } });
// bus.on('NOTIFICATION').subscribe(payload => showToast(payload.message));`,
    breakdown: [
      "Subject<AppEvent> acts as the central broadcast pipe.",
      "TypeScript discriminated unions ensure payload types match the event type string.",
      "Custom TypeScript type guard (e is Extract<...>) guarantees type-safe payload extraction.",
      "Provides decoupled pub-sub messaging without direct component-to-component references."
    ],
    expectedOutput: "Type-safe event publishing and subscribing across independent Angular components."
  },
  {
    id: "angular-ex-21",
    title: "Smooth Animated Number Counter using animationFrames & scan",
    category: "Reactive RxJS Orchestration",
    difficulty: "advanced",
    whatThisCodeCovers: "Animates an integer counter smoothly from 0 to target value using animationFrames, lerp interpolation, and scan.",
    conceptsCovered: [
      "animationFrames",
      "scan",
      "takeWhile",
      "Lerp Math",
      "toSignal"
    ],
    code: `import { Component, input } from '@angular/core';
import { animationFrames } from 'rxjs';
import { map, takeWhile, endWith } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-animated-counter',
  standalone: true,
  template: \`<span class="metric-val">{{ count() }}</span>\`
})
export class AnimatedCounterComponent {
  target = input<number>(1000);
  durationMs = input<number>(1500);

  private counter$ = animationFrames().pipe(
    map(({ elapsed }) => Math.min(elapsed / this.durationMs(), 1)),
    // Ease-out cubic formula
    map(progress => 1 - Math.pow(1 - progress, 3)),
    map(easedProgress => Math.floor(easedProgress * this.target())),
    takeWhile(val => val < this.target(), true),
    endWith(this.target())
  );

  count = toSignal(this.counter$, { initialValue: 0 });
}`,
    breakdown: [
      "animationFrames() provides smooth 60/120 FPS timestamp emissions synced with browser paint.",
      "Calculates eased interpolation using cubic ease-out mathematical formula.",
      "takeWhile(val => val < target, true) terminates the stream when target value is reached.",
      "endWith ensures the final displayed value is precisely the specified target number."
    ],
    expectedOutput: "Counter animates smoothly from 0 to 1000 using native browser refresh rate."
  },
  {
    id: "angular-ex-22",
    title: "Multi-Tab Synchronization via BroadcastChannel & RxJS",
    category: "Reactive RxJS Orchestration",
    difficulty: "advanced",
    whatThisCodeCovers: "Synchronizes user authentication and cart state across multiple browser tabs using BroadcastChannel wrapped in an RxJS Subject.",
    conceptsCovered: [
      "BroadcastChannel API",
      "Multi-Tab Sync",
      "RxJS Subject",
      "DestroyRef",
      "Session Security"
    ],
    code: `import { Injectable, inject, DestroyRef } from '@angular/core';
import { Subject, Observable } from 'rxjs';

export interface TabMessage { action: 'LOGOUT' | 'CART_SYNC'; data?: any; }

@Injectable({ providedIn: 'root' })
export class MultiTabSyncService {
  private channel?: BroadcastChannel;
  private message$ = new Subject<TabMessage>();

  constructor() {
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel('app_sync_channel');
      this.channel.onmessage = (event: MessageEvent<TabMessage>) => {
        this.message$.next(event.data);
      };
    }
  }

  post(message: TabMessage) {
    this.channel?.postMessage(message);
  }

  getMessages(): Observable<TabMessage> {
    return this.message$.asObservable();
  }
}

// In AuthService:
// When user logs out in Tab A:
// multiTab.post({ action: 'LOGOUT' });
// Tab B receives message and redirects to /login immediately!`,
    breakdown: [
      "BroadcastChannel API enables zero-server inter-tab browser communication.",
      "Emits events onto an internal RxJS Subject for clean component/service consumption.",
      "Logging out in one tab immediately forces logouts across all open tabs in same origin.",
      "Gracefully handles environments where BroadcastChannel is unavailable."
    ],
    expectedOutput: "Actions in one browser tab (like logging out) instantly sync across all open tabs."
  }
];
