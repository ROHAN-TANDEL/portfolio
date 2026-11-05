const { createCard } = require('../lld_builder_helper.cjs');

const category = "Infrastructure, Messaging & Clean Architecture LLD";

module.exports = [
  createCard({
    idNum: 109,
    category,
    concept: "In-Memory Pub-Sub Broker (Consumer Groups & Offsets)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you design an In-Memory Pub/Sub Message Broker supporting Topics, Partitions, Consumer Groups, and Offset tracking?",
    answer: "A `Broker` manages multiple named `Topics`. Each Topic has $N$ ordered message queues (Partitions). A `ConsumerGroup` represents a set of worker instances sharing the load: each partition is assigned to exactly ONE consumer within the group. Consumers track their committed `offset` pointer, allowing independent consumption speeds and replayability.",
    explanation: "Standard simple Observer broadcasts every message to every subscriber. A Kafka-style Pub/Sub broker supports horizontal scale: 10 consumers in the same group divide 10 partitions so each message is processed exactly once by the group. Different consumer groups (e.g. Analytics vs Billing) consume the same topic independently at their own offsets.",
    code: `class Message {
  constructor(public readonly id: string, public readonly payload: any, public readonly offset: number) {}
}

class TopicPartition {
  public messages: Message[] = [];
  public currentOffset: number = 0;

  public publish(payload: any): Message {
    const msg = new Message(String(this.currentOffset), payload, this.currentOffset);
    this.messages.push(msg);
    this.currentOffset++;
    return msg;
  }
}

class ConsumerGroup {
  private offsets: Map<number, number> = new Map(); // partitionIndex -> committed offset

  constructor(public readonly groupId: string) {}

  public getOffset(partition: number): number { return this.offsets.get(partition) ?? 0; }
  public commitOffset(partition: number, offset: number): void {
    this.offsets.set(partition, offset);
  }
}`,
    recallHint: "Topic partitioned into N queues; Consumer group divides partitions; commit offset per partition.",
    practice: [
      "Implement consumer rebalancing when a new consumer joins or leaves a Consumer Group",
      "Model Dead Letter Queue (DLQ) for messages that fail processing after N retries"
    ],
    interviewTip: "In-Memory Pub-Sub is a popular LLD question. Clarify upfront whether the interviewer wants simple Fan-Out Pub/Sub (Observer) or Partitioned Queue (Kafka model).",
    tags: ["LLD System", "PubSub", "Message Broker", "Kafka Internals"]
  }),

  createCard({
    idNum: 110,
    category,
    concept: "In-Memory Logging Framework (Log4j Architecture)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you design a flexible, high-performance Logging Framework (like Log4j/Logback) with Log Levels, Appenders, and Formatters?",
    answer: "Use the Chain/Strategy pattern: 1. `LogLevel` enum (DEBUG < INFO < WARN < ERROR < FATAL). 2. `LogMessage` (timestamp, level, message, metadata). 3. `LogFormatter` strategy (JSONFormatter, PatternTextFormatter). 4. `LogAppender` hierarchy (ConsoleAppender, FileAppender, AsyncRingBufferAppender). A `Logger` filters messages below its threshold and dispatches to configured appenders.",
    explanation: "If the current logger level is INFO, calls to `logger.debug()` are dropped immediately in $O(1)$ time without string formatting overhead. Multiple appenders can be attached to one logger (e.g. simultaneously outputting formatted text to stdout and structured JSON to a rotating file).",
    code: `enum LogLevel { DEBUG = 1, INFO = 2, WARN = 3, ERROR = 4 }

interface LogAppender {
  append(level: LogLevel, message: string, timestamp: number): void;
}

class ConsoleAppender implements LogAppender {
  append(level: LogLevel, message: string, timestamp: number): void {
    console.log(\`[\${new Date(timestamp).toISOString()}] [\${LogLevel[level]}] \${message}\`);
  }
}

class CustomLogger {
  private appenders: LogAppender[] = [];

  constructor(private minLevel: LogLevel = LogLevel.INFO) {}

  public addAppender(appender: LogAppender): void { this.appenders.push(appender); }

  public log(level: LogLevel, message: string): void {
    if (level < this.minLevel) return; // Fast filter: discard below threshold!
    const now = Date.now();
    for (const appender of this.appenders) {
      appender.append(level, message, now);
    }
  }

  public info(msg: string) { this.log(LogLevel.INFO, msg); }
  public error(msg: string) { this.log(LogLevel.ERROR, msg); }
}`,
    recallHint: "Logger filters by LogLevel -> dispatches to N Appenders (Console, File) formatted via Formatter strategy.",
    practice: [
      "Add AsyncAppender backed by a Disruptor RingBuffer so logging never blocks HTTP worker threads",
      "Implement hierarchical logger inheritance (e.g. 'com.app.service' inherits from 'com.app')"
    ],
    interviewTip: "When designing a Logger in LLD, always mention asynchronous non-blocking logging using a ring buffer to protect application latency from disk I/O bottlenecks.",
    tags: ["LLD System", "Logger", "Log4j", "Strategy Pattern", "Appenders"]
  }),

  createCard({
    idNum: 111,
    category,
    concept: "Distributed Task / Job Scheduler",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you design an In-Memory Task Scheduler that executes one-off delayed tasks and recurring cron jobs without busy-waiting?",
    answer: "Maintain a Min-Heap (PriorityQueue) of `ScheduledTask` objects ordered by `nextExecutionTimestamp`. A dedicated scheduler background thread sleeps on a condition variable: `wait(task.nextRun - now)`. When the timer expires, the thread polls all due tasks, submits them to a ThreadPool for concurrent execution, updates nextRun for recurring jobs, and pushes them back onto the heap.",
    explanation: "Busy-polling a database or queue every 10ms burns 100% CPU. By sleeping until the exact execution time of the earliest task at the top of the Min-Heap (`pq.peek().executionTime`), the scheduler uses 0% CPU while waiting. If a new task with an earlier timestamp is inserted, it interrupts/signals the sleep thread to recalibrate.",
    code: `class ScheduledJob {
  constructor(
    public id: string,
    public action: () => void,
    public nextRunTime: number,
    public repeatIntervalMs?: number
  ) {}
}

class InMemoryTaskScheduler {
  // Sorted min-heap of jobs by next execution timestamp
  private jobQueue: ScheduledJob[] = [];

  public schedule(action: () => void, delayMs: number, repeatIntervalMs?: number): void {
    const nextRun = Date.now() + delayMs;
    const job = new ScheduledJob(Math.random().toString(), action, nextRun, repeatIntervalMs);
    this.jobQueue.push(job);
    this.jobQueue.sort((a, b) => a.nextRunTime - b.nextRunTime); // Maintain Min-Heap order
  }

  public runDueJobs(): void {
    const now = Date.now();
    while (this.jobQueue.length > 0 && this.jobQueue[0].nextRunTime <= now) {
      const job = this.jobQueue.shift()!;
      // Execute in background
      setTimeout(job.action, 0);

      if (job.repeatIntervalMs) {
        job.nextRunTime = now + job.repeatIntervalMs;
        this.jobQueue.push(job);
        this.jobQueue.sort((a, b) => a.nextRunTime - b.nextRunTime);
      }
    }
  }
}`,
    recallHint: "Min-Heap sorted by nextExecutionTimestamp; background thread sleeps until peek().nextRunTime.",
    practice: [
      "Implement Cron expression parsing (e.g. '0 0 * * *' daily midnight)",
      "Handle worker thread crashes so failing tasks are retried with exponential backoff"
    ],
    interviewTip: "Task Scheduler is a premier LLD problem. Emphasize that execution must be offloaded to a separate ThreadPool so long-running tasks don't block the scheduler thread from waking up other jobs.",
    tags: ["LLD System", "Task Scheduler", "Priority Queue", "Cron"]
  }),

  createCard({
    idNum: 112,
    category,
    concept: "Trie / Prefix Tree Autocomplete Engine",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you design an In-Memory Autocomplete Search engine returning the Top-K most popular search queries for a given prefix?",
    answer: "Use a Trie where each node stores a character, an end-of-word flag, and a pre-computed Top-K list of most frequent search terms. When querying a prefix (e.g. 'ap'), traverse to the prefix node in $O(L)$ time and immediately return its cached Top-K list in $O(1)$ without doing a deep DFS tree traversal.",
    explanation: "If you run a DFS search below the prefix node on every keystroke, searching a million words causes noticeable latency. By pre-aggregating the top 5 most frequently searched terms at every intermediate Trie node during insertion, prefix search latency drops from $O(V)$ down to $O(L)$ where $L$ is query length.",
    code: `class AutocompleteTrieNode {
  public children: Map<string, AutocompleteTrieNode> = new Map();
  // Stores pre-computed Top-K suggestions at this exact prefix node!
  public topSuggestions: string[] = [];
}

class AutocompleteEngine {
  private root = new AutocompleteTrieNode();
  private maxSuggestions: number;

  constructor(maxSuggestions: number = 3) { this.maxSuggestions = maxSuggestions; }

  public insert(word: string): void {
    let curr = this.root;
    for (const char of word) {
      if (!curr.children.has(char)) curr.children.set(char, new AutocompleteTrieNode());
      curr = curr.children.get(char)!;

      // Update cached Top-K suggestions at this prefix
      if (!curr.topSuggestions.includes(word)) {
        curr.topSuggestions.push(word);
        // In real system: sort by search frequency
        if (curr.topSuggestions.length > this.maxSuggestions) curr.topSuggestions.pop();
      }
    }
  }

  public getSuggestions(prefix: string): string[] {
    let curr = this.root;
    for (const char of prefix) {
      if (!curr.children.has(char)) return []; // Prefix not found
      curr = curr.children.get(char)!;
    }
    return curr.topSuggestions; // Instant O(1) return!
  }
}`,
    recallHint: "Trie node caches Top-K suggestions during insertion; returns results in O(L) on keystroke.",
    practice: [
      "Add search frequency tracking: increment weight on query and dynamically re-rank Top-K suggestions",
      "Model fuzzy matching (Levenshtein distance 1) within the Trie search"
    ],
    interviewTip: "Autocomplete Engine is a classic Google/Amazon LLD problem. Pre-aggregating Top-K at each Trie node proves you design for sub-millisecond real-time UI typing response.",
    tags: ["LLD System", "Trie", "Autocomplete", "Prefix Search", "Optimization"]
  }),

  createCard({
    idNum: 113,
    category,
    concept: "Notification Service (Multi-Channel Strategy)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you architect a Notification Service supporting multiple channels (Email, SMS, Push) with template rendering and priority queuing?",
    answer: "Use the Strategy Pattern for `NotificationChannel` (EmailChannel via SendGrid, SmsChannel via Twilio, PushChannel via Firebase). A `NotificationTemplateEngine` merges payload data into templates. Notifications are prioritized (CRITICAL OTP vs PROMOTIONAL Marketing) using separate priority queues. An `UserPreferencesManager` checks user opt-in settings before sending.",
    explanation: "Coupling business code directly to Twilio or SendGrid makes swapping providers a nightmare. With Strategy + Factory Registry, adding WhatsApp or Slack requires zero modifications to existing channels. High-priority OTP codes jump to the head of the dispatch queue, while bulk newsletters are throttled.",
    code: `interface NotificationChannel {
  send(recipient: string, message: string): Promise<boolean>;
}

class EmailChannel implements NotificationChannel {
  async send(to: string, msg: string): Promise<boolean> {
    console.log(\`[Email via SendGrid] To: \${to} | Content: \${msg}\`);
    return true;
  }
}

class SmsChannel implements NotificationChannel {
  async send(phone: string, msg: string): Promise<boolean> {
    console.log(\`[SMS via Twilio] To: \${phone} | Content: \${msg}\`);
    return true;
  }
}

class NotificationService {
  private channels: Map<string, NotificationChannel> = new Map();

  public registerChannel(type: string, channel: NotificationChannel) {
    this.channels.set(type.toUpperCase(), channel);
  }

  public async notify(type: string, recipient: string, template: string, data: Record<string, string>): Promise<void> {
    const channel = this.channels.get(type.toUpperCase());
    if (!channel) throw new Error(\`Unsupported notification channel: \${type}\`);

    // Merge template with data
    let body = template;
    for (const [k, v] of Object.entries(data)) body = body.replace(\`{{\${k}}}\`, v);

    await channel.send(recipient, body);
  }
}`,
    recallHint: "Strategy pattern for channels (SMS, Email, Push) + Template variable replacement + Priority queues.",
    practice: [
      "Implement multi-channel fallback: if SMS fails, automatically failover to WhatsApp or Push",
      "Add rate limiting per user (max 3 marketing emails per day)"
    ],
    interviewTip: "In Notification Service LLD, discuss user opt-in preferences (GDPR/CAN-SPAM), quiet hours (no marketing SMS between 10pm-8am), and delivery fallback channels.",
    tags: ["LLD System", "Notification Service", "Strategy Pattern", "Multi-Channel"]
  }),

  createCard({
    idNum: 114,
    category,
    concept: "Domain-Driven Design (DDD) Aggregates & Domain Events",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is an Aggregate Root in Domain-Driven Design (DDD), and how do Domain Events enforce cross-aggregate eventual consistency?",
    answer: "An Aggregate is a cluster of domain objects (Entities and Value Objects) treated as a single unit for data changes. The Aggregate Root is the sole gateway: external callers cannot directly mutate internal entities. When an aggregate's state changes, it publishes a `DomainEvent` (e.g. `OrderPlacedEvent`) that other aggregates consume to update their own state asynchronously.",
    explanation: "In an e-commerce system, `Order` is the Aggregate Root; `LineItem` is an internal entity. External code cannot do `lineItem.setPrice()`. It must call `order.addItem()`, allowing the Aggregate Root to enforce business invariants across the whole transaction boundary. Domain Events decouple the Order aggregate from the Inventory and Billing aggregates.",
    code: `interface DomainEvent {
  occurredOn: Date;
  eventType: string;
}

class OrderPlacedEvent implements DomainEvent {
  public occurredOn: Date = new Date();
  public eventType = "OrderPlaced";
  constructor(public readonly orderId: string, public readonly totalAmount: number) {}
}

// Aggregate Root
class OrderAggregate {
  private items: { sku: string; price: number }[] = [];
  public domainEvents: DomainEvent[] = [];

  constructor(public readonly orderId: string) {}

  public addItem(sku: string, price: number): void {
    if (price <= 0) throw new Error("Price must be positive");
    this.items.push({ sku, price });
  }

  public checkout(): void {
    if (this.items.length === 0) throw new Error("Cannot checkout empty order");
    const total = this.items.reduce((sum, i) => sum + i.price, 0);

    // Record domain event for asynchronous publication after DB commit
    this.domainEvents.push(new OrderPlacedEvent(this.orderId, total));
  }
}`,
    recallHint: "Aggregate Root protects internal entities and enforces invariants; records Domain Events for cross-service consistency.",
    practice: [
      "Implement Outbox Pattern: atomically save aggregate state and domain events in one DB transaction",
      "Model a BankAccount aggregate root with Debit/Credit invariants"
    ],
    interviewTip: "Using DDD terminology (Aggregate Root, Value Object, Invariant, Domain Event) shows exceptional senior architectural maturity in system design interviews.",
    tags: ["DDD", "Aggregate Root", "Domain Events", "Clean Architecture"]
  }),

  createCard({
    idNum: 115,
    category,
    concept: "Clean Architecture / Hexagonal (Ports & Adapters)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does Clean Architecture (Hexagonal / Onion) isolate core domain logic from frameworks, databases, and UI layers?",
    answer: "Clean Architecture organizes code in concentric circles where dependencies point strictly INWARD. The innermost Core contains Entities and Use Cases (business logic), completely free of external dependencies. Inward Ports (interfaces) define operations. Outward Adapters implement those ports (PostgreSQL adapter, Express HTTP adapter, S3 adapter).",
    explanation: "Frameworks (Express, NestJS), databases (Postgres, Mongo), and external SDKs sit on the outermost infrastructure layer. If you migrate from Express to Fastify, or from Postgres to DynamoDB, 0 lines of business domain logic change. Everything connects via pluggable Adapters.",
    code: `// 1. INWARD CORE: Pure domain model (Zero framework imports)
interface UserRepositoryPort {
  save(user: { id: string; email: string }): Promise<void>;
}

// 2. USE CASE: Business workflow
class RegisterUserUseCase {
  constructor(private userRepo: UserRepositoryPort) {} // Depends solely on abstraction port!

  async execute(id: string, email: string): Promise<void> {
    if (!email.includes("@")) throw new Error("Invalid email");
    await this.userRepo.save({ id, email });
  }
}

// 3. OUTWARD ADAPTER: Infrastructure implementation
class PostgresUserAdapter implements UserRepositoryPort {
  async save(user: { id: string; email: string }): Promise<void> {
    console.log(\`DB: INSERT INTO users VALUES ('\${user.id}', '\${user.email}')\`);
  }
}`,
    recallHint: "Dependencies point strictly inward; Core has zero DB/framework imports; communicate via Ports & Adapters.",
    practice: [
      "Refactor a controller with raw SQL queries into Clean Architecture layers",
      "Show how unit tests mock the RepositoryPort to test Use Cases without a real database"
    ],
    interviewTip: "Clean Architecture (Hexagonal Architecture) is the modern industry standard for microservices. Emphasize that your domain entities have ZERO framework imports (`import express` is forbidden in domain).",
    tags: ["Clean Architecture", "Hexagonal", "Ports and Adapters", "DDD"]
  }),

  createCard({
    idNum: 116,
    category,
    concept: "Repository Pattern & Unit of Work",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the Unit of Work pattern and how does it coordinate multiple Repository mutations within a single atomic transaction?",
    answer: "The Repository pattern mediates between the domain and data mapping layers, acting like an in-memory collection. The Unit of Work pattern maintains a list of objects affected by a business transaction and coordinates the writing out of changes, resolving concurrency conflicts and executing `commit()` or `rollback()` atomically.",
    explanation: "If a business workflow mutates 3 Orders and inserts 2 LedgerEntries, executing SQL queries immediately on each step leaves the database in an inconsistent state if step 4 crashes. Unit of Work tracks all new, dirty, and deleted entities in memory, opening a single database transaction and flushing all changes together.",
    code: `interface Entity { id: string; }

class UnitOfWork {
  private newEntities: Entity[] = [];
  private dirtyEntities: Entity[] = [];
  private deletedEntities: Entity[] = [];

  public registerNew(e: Entity) { this.newEntities.push(e); }
  public registerDirty(e: Entity) { this.dirtyEntities.push(e); }
  public registerDeleted(e: Entity) { this.deletedEntities.push(e); }

  public async commit(): Promise<void> {
    console.log("=== Beginning Database Transaction ===");
    try {
      // 1. Batch INSERT newEntities
      // 2. Batch UPDATE dirtyEntities
      // 3. Batch DELETE deletedEntities
      console.log(\`Persisting \${this.newEntities.length} new, \${this.dirtyEntities.length} dirty records\`);
      console.log("=== Transaction COMMITTED Successfully ===");
    } catch (err) {
      console.error("=== Error encountered! Transaction ROLLED BACK ===", err);
      throw err;
    } finally {
      this.clear();
    }
  }

  private clear() {
    this.newEntities = [];
    this.dirtyEntities = [];
    this.deletedEntities = [];
  }
}`,
    recallHint: "Repository acts like an in-memory collection; Unit of Work batches all dirty entities into 1 atomic transaction commit.",
    practice: [
      "Trace how Hibernate / Entity Framework implementations rely on Unit of Work (DbContext / EntityManager)",
      "Implement optimistic concurrency conflict resolution in UnitOfWork.commit()"
    ],
    interviewTip: "Pairing Repository with Unit of Work proves you understand how ORMs work under the hood and how to maintain atomic transaction boundaries across multiple repositories.",
    tags: ["Design Patterns", "Repository Pattern", "Unit of Work", "Transactions"]
  }),

  createCard({
    idNum: 117,
    category,
    concept: "Event Sourcing & CQRS Architecture",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Event Sourcing, how does it reconstruct entity state from an append-only event log, and what is CQRS?",
    answer: "Event Sourcing persists the state of a business entity as an append-only sequence of immutable state-changing events (e.g. AccountOpened, Deposited, Withdrawn) rather than overwriting current state. Current state is reconstructed by replaying events from genesis. CQRS (Command Query Responsibility Segregation) separates the write model (commands mutating events) from read models (optimized query projections).",
    explanation: "In traditional CRUD, updating balance from $100 to $150 erases the history of how it became $150. With Event Sourcing, the database stores immutable events. You can reconstruct account balance at any historical point in time. Read projections listen to events and build denormalized query tables for lightning-fast reads.",
    code: `interface Event { type: string; amount: number; }

class BankAccountEventSourced {
  public balance: number = 0;
  private changes: Event[] = [];

  // Mutating method records event
  public deposit(amount: number): void {
    const event: Event = { type: "DEPOSITED", amount };
    this.apply(event);
    this.changes.push(event); // Appended to event log
  }

  public withdraw(amount: number): void {
    if (this.balance < amount) throw new Error("Insufficient funds");
    const event: Event = { type: "WITHDRAWN", amount };
    this.apply(event);
    this.changes.push(event);
  }

  // State projection / replay logic
  public apply(event: Event): void {
    if (event.type === "DEPOSITED") this.balance += event.amount;
    if (event.type === "WITHDRAWN") this.balance -= event.amount;
  }

  // Rebuild state from historical event log from disk:
  public static replay(events: Event[]): BankAccountEventSourced {
    const acc = new BankAccountEventSourced();
    for (const e of events) acc.apply(e);
    return acc;
  }
}`,
    recallHint: "Store immutable sequence of state events (append-only); replay events to rebuild current state. CQRS splits read/write.",
    practice: [
      "Implement Snapshotting: save periodic state checkpoints every 100 events to optimize replay performance",
      "Model a denormalized CQRS read projection updating an Elasticsearch index on Domain Events"
    ],
    interviewTip: "Event Sourcing is the de facto architecture for financial ledgers, audit systems, git version control, and trading exchanges. Emphasize Snapshotting to prevent slow startup replays.",
    tags: ["Event Sourcing", "CQRS", "Architecture", "Ledger"]
  }),

  createCard({
    idNum: 118,
    category,
    concept: "Saga Pattern for Distributed Transactions",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the Saga Pattern manage distributed transactions across microservices using Compensating Actions, and what is Choreography vs Orchestration?",
    answer: "A Saga is a sequence of local transactions where each step updates data within a single service. If a step fails, the Saga executes Compensating Transactions backward to undo preceding changes. Choreography coordinates events implicitly via Pub/Sub; Orchestration uses a central Saga Orchestrator state machine to explicitly command each participant.",
    explanation: "Two-Phase Commit (2PC) blocks databases across networks, causing deadlocks. A Saga accepts eventual consistency. If `OrderCreated` -> `PaymentCharged` -> `InventoryAllocationFailed`, the orchestrator issues `RefundPayment` and `CancelOrder` compensating actions. Choreography is simpler for small workflows; Orchestration is preferred for complex enterprise sagas.",
    code: `// Saga Orchestrator Pattern
class BookingSagaOrchestrator {
  public async executeBooking(): Promise<boolean> {
    try {
      console.log("Step 1: Reserve Hotel Room");
      // await hotelService.reserve();

      console.log("Step 2: Charge Customer Card");
      // await paymentService.charge();

      console.log("Step 3: Book Flight Ticket (FAILS!)");
      throw new Error("Flight sold out!");

      return true;
    } catch (err) {
      console.warn("Saga Step Failed! Initiating Compensating Transactions...");
      await this.rollback();
      return false;
    }
  }

  private async rollback(): Promise<void> {
    // Compensating actions executed in reverse order!
    console.log("[Compensate] Refunding Customer Card...");
    console.log("[Compensate] Cancelling Hotel Reservation...");
  }
}`,
    recallHint: "Series of local transactions; failures trigger backward Compensating Actions. Orchestrator vs Choreography.",
    practice: [
      "Design an eCommerce Checkout Saga (Reserve Inventory -> Charge Payment -> Ship Order)",
      "Handle partial failures when a compensating action itself crashes (requires retry queues)"
    ],
    interviewTip: "In distributed LLD and system design, never recommend 2-Phase Commit (2PC). Always propose the Saga Pattern with Compensating Transactions.",
    tags: ["Distributed Systems", "Saga Pattern", "Compensating Transactions", "Orchestration"]
  }),

  createCard({
    idNum: 119,
    category,
    concept: "Feature Flag & Dynamic Config Engine",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you design an In-Memory Feature Flag engine supporting percentage rollouts, user targeting, and hash-based consistent bucketing?",
    answer: "A `FeatureFlagEngine` evaluates flag rules: 1. Target Whitelist (e.g. user ID in `['user_1', 'user_2']`), 2. Attribute Rules (e.g. `country === 'US'`), 3. Percentage Rollout using deterministic hashing: `hash(flagKey + userId) % 100 < rolloutPercentage`. Hashing guarantees that a user consistently sees the same feature version on every reload.",
    explanation: "Using `Math.random() < 0.20` is broken because a user will see the new feature on page load 1, and the old feature on reload 2. By hashing `flagKey + userId` using MurmurHash3 or MD5 and taking modulo 100, the user always falls into the exact same 0-99 bucket across all visits.",
    code: `class FeatureFlagEngine {
  private flags: Map<string, { enabled: boolean; percentage: number; whitelist: Set<string> }> = new Map();

  public setFlag(key: string, enabled: boolean, percentage: number = 100, whitelist: string[] = []): void {
    this.flags.set(key, { enabled, percentage, whitelist: new Set(whitelist) });
  }

  public isEnabled(flagKey: string, userId: string): boolean {
    const flag = this.flags.get(flagKey);
    if (!flag || !flag.enabled) return false;

    // 1. Direct Whitelist check
    if (flag.whitelist.has(userId)) return true;

    // 2. Deterministic Hash Bucketing (0 to 99)
    const bucket = this.hashToBucket(\`\${flagKey}_\${userId}\`);
    return bucket < flag.percentage;
  }

  private hashToBucket(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
    return hash % 100; // Consistent 0-99 bucket
  }
}`,
    recallHint: "Hash(flag + userId) % 100 < percentage. Guarantees sticky consistent user bucketing.",
    practice: [
      "Implement live feature flag polling with SSE (Server-Sent Events) or Redis Pub/Sub",
      "Model multivariate A/B testing splits (Control: 50%, VariantA: 25%, VariantB: 25%)"
    ],
    interviewTip: "Always explain deterministic hashing for percentage rollouts. Random number generation (`Math.random()`) in feature flags causes jarring user experience bugs.",
    tags: ["LLD System", "Feature Flags", "Consistent Hashing", "A/B Testing"]
  }),

  createCard({
    idNum: 120,
    category,
    concept: "Metrics Aggregator & Percentile Calculation",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you calculate real-time p50, p95, and p99 latency percentiles in memory without storing every single raw measurement?",
    answer: "Storing millions of raw latencies consumes gigabytes of RAM and requires expensive sorting ($O(N \\log N)$). Production metrics aggregators (Prometheus, HdrHistogram, T-Digest) use logarithmic histogram buckets (e.g. 0-1ms, 1-5ms, 5-10ms, 10-25ms, ..., 1000ms+). Each observation increments a bucket counter in $O(1)$. Percentiles are estimated in $O(B)$ by accumulating cumulative counts up to $99\\%$.",
    explanation: "If an API handles 100,000 requests/sec, keeping all float values in memory exhausts heap space. By quantizing latency into 50 fixed exponential buckets, memory usage is constant ($O(1)$ ~ 200 bytes per endpoint), and calculating p99 simply traverses the bucket array until 99% of total observed requests are accounted for.",
    code: `class LatencyHistogram {
  private buckets = [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000]; // ms thresholds
  private counts: number[] = new Array(12).fill(0);
  private totalCount: number = 0;

  public record(latencyMs: number): void {
    this.totalCount++;
    for (let i = 0; i < this.buckets.length; i++) {
      if (latencyMs <= this.buckets[i]) {
        this.counts[i]++;
        return;
      }
    }
    this.counts[this.buckets.length]++; // > 5000ms bucket
  }

  public getPercentile(p: number): number {
    if (this.totalCount === 0) return 0;
    const targetRank = Math.ceil((p / 100) * this.totalCount);
    let cumulative = 0;

    for (let i = 0; i < this.counts.length; i++) {
      cumulative += this.counts[i];
      if (cumulative >= targetRank) {
        return i < this.buckets.length ? this.buckets[i] : 5000;
      }
    }
    return 5000;
  }
}`,
    recallHint: "Logarithmic histogram buckets; increment counter in O(1); estimate p95/p99 by cumulative sum.",
    practice: [
      "Compare fixed histogram buckets vs HdrHistogram (High Dynamic Range) precision",
      "Model a rolling 1-minute window metrics collector using a circular buffer of histograms"
    ],
    interviewTip: "When asked to design a real-time monitoring agent or metrics library, explaining histogram quantization over raw array sorting proves deep systems understanding.",
    tags: ["LLD System", "Metrics", "Percentiles", "Histograms", "Observability"]
  })
];
