const { createCard } = require('../lld_builder_helper.cjs');

const category = "Concurrency, Thread-Safety & Synchronization";

module.exports = [
  createCard({
    idNum: 49,
    category,
    concept: "Mutex & ReentrantLock Internals",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a ReentrantLock (Mutex) and why is reentrancy critical for preventing self-deadlocks?",
    answer: "A Mutex (Mutual Exclusion lock) ensures only one thread executes a critical section at a time. A ReentrantLock allows the thread that currently holds the lock to re-acquire it without blocking itself (self-deadlock). It maintains an internal hold counter that increments on each acquire and decrements on each release.",
    explanation: "If a thread acquires a non-reentrant lock in `methodA()` and then calls `methodB()` which also tries to acquire the same lock, the thread deadlocks waiting for itself to release the lock. With a ReentrantLock, the thread's ID is compared against the owner; if they match, the hold count increments to 2, allowing nested calls to proceed safely.",
    code: `// Conceptual TypeScript Mutex implementation
class AsyncMutex {
  private locked: boolean = false;
  private queue: (() => void)[] = [];

  public async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise(resolve => this.queue.push(resolve));
  }

  public release(): void {
    if (this.queue.length > 0) {
      const nextResolve = this.queue.shift()!;
      nextResolve(); // Grant lock to next waiting caller
    } else {
      this.locked = false;
    }
  }

  // Safe execution wrapper (try-finally pattern)
  public async withLock<T>(action: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await action();
    } finally {
      this.release();
    }
  }
}`,
    recallHint: "Mutual exclusion; reentrant tracks thread ownership and hold count so a thread never deadlocks on itself.",
    practice: [
      "Implement a thread-safe BankAccount transfer with ReentrantLock",
      "Explain the performance difference between biased locking, thin locking, and heavy OS mutexes"
    ],
    interviewTip: "Always use `try-finally` (or try-with-resources in Java/C#) to release locks. If an exception occurs inside the critical section without a finally block, the lock is held forever, deadlocking the system.",
    tags: ["Concurrency", "Mutex", "ReentrantLock", "Thread Safety"]
  }),

  createCard({
    idNum: 50,
    category,
    concept: "Read-Write Lock (ReentrantReadWriteLock)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does a Read-Write Lock optimize read-heavy workloads, and what is Reader Starvation vs Writer Starvation?",
    answer: "A Read-Write Lock permits concurrent reads by multiple threads simultaneously (shared lock), but requires exclusive access for writes (exclusive lock). In a read-heavy system, if new readers are continuously granted access, a waiting writer can starve indefinitely (Writer Starvation). Fair locks or writer-preference locks prioritize waiting writers.",
    explanation: "For a cache where 95% of requests are reads and 5% are writes, a standard Mutex serializes every single read, degrading throughput. A ReadWriteLock allows 500 threads to read in parallel. When a writer arrives, it waits for active readers to finish, executes exclusively, and then releases. Fair queuing prevents either side from starving.",
    code: `// Conceptual Read-Write Lock implementation
class ReadWriteLock {
  private activeReaders: number = 0;
  private isWriting: boolean = false;
  private writeRequests: number = 0;

  public async acquireRead(): Promise<void> {
    // Writer preference: Wait if a write is active OR writers are queued
    while (this.isWriting || this.writeRequests > 0) {
      await new Promise(r => setTimeout(r, 10));
    }
    this.activeReaders++;
  }

  public releaseRead(): void {
    this.activeReaders--;
  }

  public async acquireWrite(): Promise<void> {
    this.writeRequests++;
    // Wait until ALL active readers and writing threads finish
    while (this.activeReaders > 0 || this.isWriting) {
      await new Promise(r => setTimeout(r, 10));
    }
    this.writeRequests--;
    this.isWriting = true;
  }

  public releaseWrite(): void {
    this.isWriting = false;
  }
}`,
    recallHint: "Multiple readers concurrent; single writer exclusive. Watch out for writer starvation.",
    practice: [
      "Implement a thread-safe In-Memory Key-Value Cache using ReadWriteLock",
      "Compare ReentrantReadWriteLock vs StampedLock optimistic reads in Java"
    ],
    interviewTip: "In LLD rounds, choose ReadWriteLock over standard Mutex whenever the problem statement mentions a read-heavy ratio (e.g. In-memory inventory, user sessions, dictionary lookup).",
    tags: ["Concurrency", "ReadWriteLock", "Synchronization", "Starvation"]
  }),

  createCard({
    idNum: 51,
    category,
    concept: "Counting Semaphores & Resource Throttling",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a Counting Semaphore and how does it regulate concurrency to a fixed pool of resources?",
    answer: "A Counting Semaphore maintains a set of permits. Threads call acquire() to request a permit (blocking if none are available) and release() to return a permit. It is used to bound concurrency, such as limiting concurrent outbound HTTP requests or database connections to N.",
    explanation: "A binary semaphore (permits = 1) behaves like a non-reentrant mutex. A counting semaphore with permits = 10 allows up to 10 concurrent threads. When the 11th thread calls `acquire()`, it is suspended on the semaphore's wait queue until one of the 10 active threads calls `release()`, providing natural backpressure.",
    code: `class Semaphore {
  private permits: number;
  private waitQueue: (() => void)[] = [];

  constructor(initialPermits: number) {
    this.permits = initialPermits;
  }

  public async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }
    return new Promise(resolve => this.waitQueue.push(resolve));
  }

  public release(): void {
    this.permits++;
    if (this.waitQueue.length > 0 && this.permits > 0) {
      this.permits--;
      const resolve = this.waitQueue.shift()!;
      resolve();
    }
  }
}

// Throttling concurrent downloads to max 3:
const limiter = new Semaphore(3);

async function downloadFile(url: string) {
  await limiter.acquire();
  try {
    console.log(\`Downloading \${url}...\`);
    await new Promise(r => setTimeout(r, 500));
  } finally {
    limiter.release();
  }
}`,
    recallHint: "Maintains N permits; acquire() takes permit or blocks, release() returns permit.",
    practice: [
      "Design a RateLimiter that caps concurrent worker tasks using Semaphore",
      "Contrast Semaphore with Mutex (Semaphore has no concept of ownership; any thread can release)"
    ],
    interviewTip: "A crucial distinction: Mutex has ownership (only the locking thread can unlock). A Semaphore has no ownership (Thread A can acquire, and Thread B can release, making it suitable for signal-passing).",
    tags: ["Concurrency", "Semaphore", "Resource Throttling", "Thread Pools"]
  }),

  createCard({
    idNum: 52,
    category,
    concept: "Condition Variables & Blocking Producer-Consumer Queue",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Condition Variables (`wait()`, `signal()`/`notify()`) implement an efficient Blocking Queue without busy-waiting?",
    answer: "Condition Variables allow threads to suspend execution and release the associated mutex until another thread notifies them that a specific predicate condition is true. In a bounded Blocking Queue, producers wait on the 'notFull' condition when capacity is reached; consumers wait on the 'notEmpty' condition when the queue is empty.",
    explanation: "Busy-waiting (`while(queue.isEmpty()) {}`) consumes 100% CPU. With Condition Variables, `notEmpty.await()` atomically releases the mutex and transitions the consumer thread to sleep. When a producer enqueues an item, it calls `notEmpty.signal()`, waking up the sleeping consumer without burning CPU cycles.",
    code: `// Java / POSIX conceptual model for Bounded Blocking Queue
/*
public class BoundedBlockingQueue<T> {
    private final Queue<T> queue = new LinkedList<>();
    private final int capacity;
    private final Lock lock = new ReentrantLock();
    private final Condition notFull = lock.newCondition();
    private final Condition notEmpty = lock.newCondition();

    public BoundedBlockingQueue(int capacity) { this.capacity = capacity; }

    public void put(T item) throws InterruptedException {
        lock.lock();
        try {
            while (queue.size() == capacity) { // Spurious wakeup protection: ALWAYS while, never if!
                notFull.await();               // Releases lock and sleeps
            }
            queue.add(item);
            notEmpty.signal();                // Signal waiting consumer
        } finally {
            lock.unlock();
        }
    }

    public T take() throws InterruptedException {
        lock.lock();
        try {
            while (queue.isEmpty()) {
                notEmpty.await();
            }
            T item = queue.poll();
            notFull.signal();                 // Signal waiting producer
            return item;
        } finally {
            lock.unlock();
        }
    }
}
*/`,
    recallHint: "notFull and notEmpty condition variables; always check predicate in a while loop to guard against spurious wakeups.",
    practice: [
      "Explain why you must ALWAYS check condition predicates inside a 'while' loop, never an 'if' statement",
      "Contrast signal() vs signalAll() / notify() vs notifyAll()"
    ],
    interviewTip: "The #1 trap in threading interviews: using `if (queue.isEmpty()) wait()`. Always explain that spurious wakeups and race conditions require checking the condition in a `while` loop.",
    tags: ["Concurrency", "Condition Variable", "Producer Consumer", "Blocking Queue"]
  }),

  createCard({
    idNum: 53,
    category,
    concept: "Lock-Free Concurrency & Atomic CAS (Compare-And-Swap)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Lock-Free algorithms achieve thread-safety using atomic hardware CAS (Compare-And-Swap) instructions without mutexes?",
    answer: "Lock-free algorithms use hardware atomic CPU instructions (like CMPXCHG on x86) to update memory. The Compare-And-Swap operation takes: memory address, expected old value, and new value. It updates the address to the new value ONLY if current == expected. If another thread modified the value, CAS fails, and the thread retries in a loop (optimistic concurrency).",
    explanation: "Locks cause thread suspension, context switching, and priority inversion. Lock-free data structures (like AtomicInteger, ConcurrentLinkedQueue) never suspend threads. Instead, threads attempt updates optimistically. Under low-to-moderate contention, CAS operations succeed in nanoseconds without kernel mode transitions.",
    code: `// Conceptual model of AtomicInteger backed by CAS loop
class AtomicIntegerSimulated {
  private value: number;

  constructor(initialValue: number = 0) {
    this.value = initialValue;
  }

  // Simulated hardware atomic primitive
  private compareAndSwap(expected: number, update: number): boolean {
    if (this.value === expected) {
      this.value = update;
      return true;
    }
    return false;
  }

  // Lock-free increment
  public incrementAndGet(): number {
    while (true) {
      const current = this.value;
      const next = current + 1;
      if (this.compareAndSwap(current, next)) {
        return next; // Succeeded atomically!
      }
      // CAS failed because another thread updated 'value' in the interim; retry loop!
    }
  }

  public get(): number { return this.value; }
}`,
    recallHint: "Optimistic retry loop: read old value -> compute new value -> CAS(old, new); if fail, retry.",
    practice: [
      "Implement a lock-free Stack (Treiber Stack) using AtomicReference",
      "Explain the ABA Problem in CAS algorithms and how Versioned References / Stamped References solve it"
    ],
    interviewTip: "Be ready to explain the ABA problem: if Thread A reads value A, Thread B changes it to B and back to A, Thread A's CAS succeeds even though the state changed. Solved using tagged pointers or version counters.",
    tags: ["Concurrency", "Lock-Free", "CAS", "Atomics"]
  }),

  createCard({
    idNum: 54,
    category,
    concept: "Volatile Memory Model & Instruction Reordering",
    priority: "must-know",
    difficulty: "advanced",
    question: "What guarantees does the 'volatile' keyword provide in Java/C++, and what is the 'Happens-Before' relationship?",
    answer: "The 'volatile' keyword provides: 1. Visibility: writes to a volatile variable are immediately flushed to main memory and visible to all other threads (invalidating CPU cache lines). 2. Ordering: prevents compilers and CPU hardware from reordering memory operations across the volatile read/write barrier. It enforces a strict Happens-Before relationship.",
    explanation: "CPUs cache variables in L1/L2 caches and reorder instructions for performance. Without volatile, Thread A might write `ready = true`, but Thread B keeps reading `ready = false` from its CPU cache indefinitely. Furthermore, the compiler might reorder `data = 42; ready = true` so `ready` becomes true before `data` is written. Volatile inserts memory fences to prohibit this reordering.",
    code: `// Conceptual volatile flag pattern
class WorkerThreadTask {
  // Without volatile, loop might run infinitely due to CPU cache caching 'running = true'
  private isRunning: boolean = true;

  public run(): void {
    while (this.isRunning) {
      // Do work...
    }
    console.log("Worker stopped cleanly.");
  }

  public stop(): void {
    this.isRunning = false; // Immediately visible across threads with memory barrier
  }
}`,
    recallHint: "Visibility (no stale CPU cache) + Ordering (prevents compiler/CPU instruction reordering).",
    practice: [
      "Explain why 'volatile count++' is NOT thread-safe (compound read-modify-write operation)",
      "Diagram the CPU memory barrier (store-load fence) inserted during volatile writes"
    ],
    interviewTip: "Never confuse visibility with atomicity. Volatile guarantees that a single read or write is immediately visible, but it does NOT make compound operations like `i++` atomic.",
    tags: ["Concurrency", "Volatile", "Memory Model", "Happens Before"]
  }),

  createCard({
    idNum: 55,
    category,
    concept: "Deadlock Detection, Resource Ordering & Coffman Conditions",
    priority: "must-know",
    difficulty: "advanced",
    question: "What are the 4 Coffman Conditions required for a Deadlock to occur, and how does Strict Resource Ordering prevent them?",
    answer: "Deadlocks require 4 simultaneous conditions: 1. Mutual Exclusion (unsharable resources), 2. Hold and Wait (holding one lock while waiting for another), 3. No Preemption (locks cannot be forcibly seized), 4. Circular Wait (A waits for B, B waits for A). Breaking ANY ONE condition prevents deadlock. Strict Resource Ordering breaks Circular Wait.",
    explanation: "In a bank transfer from Account A to Account B, if Thread 1 locks A then B, while Thread 2 locks B then A, a deadlock occurs. By enforcing a global lock ordering (e.g. Always lock the account with the smaller account ID first), circular wait is mathematically impossible, completely eliminating deadlocks.",
    code: `class BankAccount {
  constructor(public readonly id: number, private balance: number) {}
}

class DeadlockFreeTransferService {
  public transfer(from: BankAccount, to: BankAccount, amount: number): void {
    // Determine strict global acquisition order by ID:
    const firstLock = from.id < to.id ? from : to;
    const secondLock = from.id < to.id ? to : from;

    // Acquire locks in identical global order across ALL threads!
    console.log(\`Acquiring lock on Account \${firstLock.id}\`);
    console.log(\`Acquiring lock on Account \${secondLock.id}\`);
    try {
      // Perform atomic balance transfer...
      console.log(\`Transferred \$\${amount} from \${from.id} to \${to.id} safely\`);
    } finally {
      console.log(\`Releasing lock on Account \${secondLock.id}\`);
      console.log(\`Releasing lock on Account \${firstLock.id}\`);
    }
  }
}`,
    recallHint: "4 Coffman conditions: Mutual Exclusion, Hold & Wait, No Preemption, Circular Wait. Order locks by ID to break circular wait.",
    practice: [
      "Solve the Dining Philosophers Problem using Resource Ordering or Chandy-Misra",
      "Implement a lock acquisition timeout with tryLock() to break Hold and Wait"
    ],
    interviewTip: "Whenever an LLD question requires transferring resources or acquiring multiple locks simultaneously (e.g. Booking two seats, moving funds between accounts), explicitly state: 'We sort resources by ID before locking to eliminate circular wait.'",
    tags: ["Concurrency", "Deadlock", "Coffman Conditions", "Resource Ordering"]
  }),

  createCard({
    idNum: 56,
    category,
    concept: "Spinlocks vs Sleeping / Futex Locks",
    priority: "must-know",
    difficulty: "intermediate",
    question: "When should a system use a Spinlock instead of a standard Sleeping (Futex) Mutex?",
    answer: "A Spinlock polls repeatedly in a tight CPU loop (`while(!try_lock())`) waiting for the lock to become available, avoiding the expensive overhead of putting the thread to sleep and performing a kernel context switch. Use Spinlocks only when the critical section is extremely short (< a few CPU cycles) and the system has multiple CPU cores.",
    explanation: "Putting a thread to sleep and waking it up via the OS kernel (Futex) costs ~2,000 to 5,000 CPU cycles. If a critical section only updates a linked list pointer (taking 10 cycles), spinning for 10 cycles is 100x faster than sleeping. However, if the lock holder is descheduled or the critical section performs I/O, spinning wastes 100% of a CPU core.",
    code: `// Conceptual Spinlock in shared memory
class SpinLock {
  private locked: boolean = false;

  public lock(): void {
    // Spins burning CPU until lock is released
    while (this.testAndSet()) {
      // Busy-wait: pause CPU instruction or yield
    }
  }

  public unlock(): void {
    this.locked = false;
  }

  private testAndSet(): boolean {
    if (!this.locked) {
      this.locked = true;
      return false; // Acquired
    }
    return true; // Still busy
  }
}`,
    recallHint: "Spinlock burns CPU spinning for ultra-fast locks; Mutex/Futex sleeps via OS for longer operations.",
    practice: [
      "Explain why Spinlocks should NEVER be used on single-core CPU systems",
      "Describe Adaptive Mutexes (spin for N iterations, then fall back to sleeping)"
    ],
    interviewTip: "Modern OS mutexes (like Linux Futex and JVM synchronized locks) are 'adaptive': they spin for a few nanoseconds, and if the lock isn't freed, they fall back to sleeping.",
    tags: ["Concurrency", "Spinlock", "Futex", "Low-Level Performance"]
  }),

  createCard({
    idNum: 57,
    category,
    concept: "Thread Pool Architecture & Task Rejection Policies",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does a Thread Pool manage worker lifecycle, core vs max pool sizes, and what happens when the work queue is saturated?",
    answer: "A Thread Pool maintains a pool of pre-spawned worker threads that consume tasks from a BlockingQueue. Parameters include: corePoolSize (minimum alive threads), maxPoolSize (ceiling during load spikes), and keepAliveTime. When the task queue is completely saturated, the pool invokes a Task Rejection Policy.",
    explanation: "In Java's ThreadPoolExecutor: 1. If active threads < corePoolSize, spawn new thread. 2. If core threads busy, enqueue task into work queue. 3. If queue full, spawn threads up to maxPoolSize. 4. If max threads busy AND queue full, trigger rejection policy: Abort (throw exception), CallerRuns (caller executes task, throttling ingress), Discard (silently drop), or DiscardOldest.",
    code: `// Conceptual Thread Pool Worker Architecture
interface Task {
  execute(): Promise<void>;
}

class ThreadPool {
  private workers: Worker[] = [];
  private taskQueue: Task[] = [];
  private maxQueueSize: number;

  constructor(poolSize: number, maxQueueSize: number = 100) {
    this.maxQueueSize = maxQueueSize;
    for (let i = 0; i < poolSize; i++) {
      this.startWorker(i);
    }
  }

  public submit(task: Task): void {
    if (this.taskQueue.length >= this.maxQueueSize) {
      // CallerRunsPolicy: caller thread executes task directly, creating backpressure!
      console.warn("Queue full! Executing via CallerRuns policy.");
      task.execute();
      return;
    }
    this.taskQueue.push(task);
  }

  private async startWorker(id: number): Promise<void> {
    while (true) {
      if (this.taskQueue.length > 0) {
        const task = this.taskQueue.shift()!;
        try { await task.execute(); } catch (err) { console.error("Task failed", err); }
      } else {
        await new Promise(r => setTimeout(r, 50)); // Sleep until work arrives
      }
    }
  }
}`,
    recallHint: "Core threads -> queue -> max threads -> rejection policy (Abort, CallerRuns, Discard).",
    practice: [
      "Explain why unbounded task queues (like Executors.newFixedThreadPool) can cause OutOfMemoryErrors",
      "Calculate optimal thread pool sizing for CPU-bound (N_cpu + 1) vs I/O-bound tasks"
    ],
    interviewTip: "In system design, never use unbounded queues for thread pools. A surge in incoming traffic will fill the queue indefinitely until the JVM runs out of heap space.",
    tags: ["Concurrency", "Thread Pool", "Rejection Policy", "Resource Management"]
  }),

  createCard({
    idNum: 58,
    category,
    concept: "Thread Starvation & Livelock Scenarios",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between Deadlock, Livelock, and Thread Starvation?",
    answer: "In a Deadlock, processes are blocked waiting for events only other blocked processes can cause (frozen). In a Livelock, processes continuously change their active state in response to each other without making any forward progress (active spinning). In Starvation, a runnable thread is perpetually denied CPU time or resource access because greedy higher-priority threads take precedence.",
    explanation: "Two polite people trying to pass each other in a narrow hallway: both step left, then both step right, then left again—neither moves forward (Livelock). In Starvation, low-priority background workers never get a CPU timeslice because a stream of high-priority requests monopolizes the scheduler. Solved using fair queuing and priority aging.",
    code: `/*
Deadlock vs Livelock vs Starvation Summary:
+-------------+---------------------+-------------------------+-------------------------------+
| Scenario    | Thread State        | CPU Utilization         | Cause                         |
+-------------+---------------------+-------------------------+-------------------------------+
| Deadlock    | Blocked / Sleeping  | 0% CPU (Hanging)        | Circular dependency on locks  |
| Livelock    | Active / Running    | 100% CPU (Busy looping) | Over-compensating reaction    |
| Starvation  | Ready / Runnable    | Variable                | Unfair priority scheduling    |
+-------------+---------------------+-------------------------+-------------------------------+
*/`,
    recallHint: "Deadlock = frozen waiting; Livelock = actively reacting with no progress; Starvation = ignored by scheduler.",
    practice: [
      "Simulate a Livelock where two transaction workers constantly abort and retry simultaneously",
      "Implement Aging to gradually boost the priority of waiting threads to prevent starvation"
    ],
    interviewTip: "When designing rate limiters or job queues, always discuss Starvation. Unfair FIFO queues or strict priority queues can starve small background jobs unless an aging algorithm is implemented.",
    tags: ["Concurrency", "Livelock", "Starvation", "Deadlock"]
  }),

  createCard({
    idNum: 59,
    category,
    concept: "Fork-Join Framework & Work-Stealing Queues",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the Work-Stealing algorithm in the Fork-Join framework maximize multi-core CPU utilization?",
    answer: "In a Fork-Join framework, each worker thread has its own double-ended queue (deque) of tasks. When a thread generates subtasks (fork), it pushes them to the head of its own deque. When a worker finishes its own tasks, instead of sitting idle, it 'steals' tasks from the tail of another busy worker's deque.",
    explanation: "Standard centralized queues suffer heavy lock contention when 64 CPU cores attempt to pull tasks simultaneously. With work-stealing, worker threads work independently on their private deques with zero lock contention. Contention only occurs during work-stealing from the opposite end of the deque, maximizing cache locality and core utilization.",
    code: `// Conceptual Fork-Join Work-Stealing Deque
class DequeWorker {
  public deque: string[] = [];

  // Local thread pushes and pops from HEAD (LIFO order for cache warmth)
  public push(task: string) { this.deque.unshift(task); }
  public pop(): string | undefined { return this.deque.shift(); }

  // Idle foreign threads steal from TAIL (FIFO order, minimizing contention with owner)
  public steal(): string | undefined {
    return this.deque.pop();
  }
}`,
    recallHint: "Each thread has a deque; pushes/pops from head, idle threads steal from tail.",
    practice: [
      "Implement parallel array merge sort using recursive Fork-Join tasks",
      "Contrast Fork-Join (divide-and-conquer) with ThreadPoolExecutor (independent jobs)"
    ],
    interviewTip: "Java's `parallelStream()` and Go's runtime scheduler are powered by work-stealing. It is the premier concurrency pattern for CPU-bound divide-and-conquer workloads.",
    tags: ["Concurrency", "Fork-Join", "Work-Stealing", "Parallel Computing"]
  }),

  createCard({
    idNum: 60,
    category,
    concept: "ThreadLocal Storage & Context Leakage in Thread Pools",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why does using ThreadLocal inside thread-pooled environments (Tomcat, Netty) cause dangerous security data leaks, and how do you prevent them?",
    answer: "ThreadLocal binds a variable to the currently executing thread. In thread-pooled environments, threads are never destroyed; they are recycled to serve subsequent requests. If a thread sets a UserContext or TenantID in ThreadLocal and fails to call `remove()` in a `finally` block, the next user request assigned to that recycled thread inherits the previous user's credentials and tenant data.",
    explanation: "ThreadLocalMap stores entries using WeakReference keys (the ThreadLocal object), but strong values (the user data). If uncleaned, values remain reachable via the long-lived Thread object, leading to severe memory leaks and cross-tenant security vulnerabilities. In Node.js, `AsyncLocalStorage` provides equivalent asynchronous context propagation.",
    code: `// Java / Server conceptual hazard
/*
public class SecurityFilter {
    private static final ThreadLocal<UserContext> context = new ThreadLocal<>();

    public void doFilter(Request req, Response res) {
        try {
            UserContext user = authenticate(req);
            context.set(user); // Bound to recycled thread!
            processRequest(req, res);
        } finally {
            // CRITICAL: Must remove before thread returns to pool!
            context.remove(); // Eliminates data leak to next request
        }
    }
}
*/

// Node.js AsyncLocalStorage counterpart (clean async context propagation)
const { AsyncLocalStorage } = require("async_hooks");
const asyncLocalStorage = new AsyncLocalStorage();

function handleRequest(userId: string, callback: () => void) {
  // Scoped exclusively to the async execution tree; auto-cleaned on completion!
  asyncLocalStorage.run({ userId }, () => {
    callback();
  });
}`,
    recallHint: "ThreadLocal persists across recycled pool threads; ALWAYS call .remove() in a finally block to prevent data leakage.",
    practice: [
      "Trace how Spring's SecurityContextHolder uses ThreadLocal and cleans up via Filter",
      "Diagram the WeakReference key vs StrongReference value memory leak in ThreadLocalMap"
    ],
    interviewTip: "Always mention `ThreadLocal.remove()` in `finally`. Bringing up cross-tenant data pollution during thread reuse demonstrates real-world production debugging battle scars.",
    tags: ["Concurrency", "ThreadLocal", "AsyncLocalStorage", "Security"]
  })
];
