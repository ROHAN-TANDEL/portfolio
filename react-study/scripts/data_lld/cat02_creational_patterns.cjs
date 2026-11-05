const { createCard } = require('../lld_builder_helper.cjs');

const category = "Creational Design Patterns & Object Lifecycles";

module.exports = [
  createCard({
    idNum: 13,
    category,
    concept: "Simple Factory vs Factory Method Pattern",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between Simple Factory and the GoF Factory Method Pattern?",
    answer: "Simple Factory uses a single concrete class with a static or instance method (often containing switch/if statements) to instantiate objects. Factory Method defines an interface/abstract method for creating an object, but lets subclasses decide which exact class to instantiate, adhering to the Open/Closed Principle.",
    explanation: "Simple Factory centralizes object creation in one place, but adding a new product requires modifying the factory code. Factory Method delegates instantiation to specialized creator subclasses (e.g. WindowsDialog vs MacDialog), allowing new product types to be introduced without modifying the creator base class or client code.",
    code: `// Product Interface
interface Button {
  render(): void;
  onClick(): void;
}

class WindowsButton implements Button {
  render() { console.log("Rendering Windows themed button"); }
  onClick() { console.log("Handling Windows click event"); }
}

class MacButton implements Button {
  render() { console.log("Rendering macOS Aqua themed button"); }
  onClick() { console.log("Handling macOS click event"); }
}

// GoF Factory Method: Abstract Creator
abstract class Dialog {
  // Factory Method
  abstract createButton(): Button;

  public renderWindow(): void {
    const okButton = this.createButton();
    okButton.render();
  }
}

// Concrete Creators override the Factory Method
class WindowsDialog extends Dialog {
  createButton(): Button { return new WindowsButton(); }
}

class MacDialog extends Dialog {
  createButton(): Button { return new MacButton(); }
}`,
    recallHint: "Simple Factory = one class with switch statement; Factory Method = inheritance where subclasses instantiate.",
    practice: [
      "Implement a DocumentReader framework using Factory Method for PDF and Word documents",
      "Explain how Java's Calendar.getInstance() is a Simple Factory vs Factory Method"
    ],
    interviewTip: "When designing extensible systems (e.g. game engine spawners, notification channels), use Factory Method so new types can be registered without modifying existing core code.",
    tags: ["Design Patterns", "Factory Method", "Creational", "GoF"]
  }),

  createCard({
    idNum: 14,
    category,
    concept: "Abstract Factory Pattern (Product Families)",
    priority: "must-know",
    difficulty: "advanced",
    question: "When should you use the Abstract Factory pattern over a standard Factory Method?",
    answer: "Use Abstract Factory when your system needs to create entire families of related or dependent objects without specifying their concrete classes (e.g. DarkThemeButton + DarkThemeScrollbar vs LightThemeButton + LightThemeScrollbar). It guarantees that client code never mixes incompatible products from different families.",
    explanation: "Factory Method creates a single product; Abstract Factory creates a suite of related products. It enforces family consistency across the UI, operating system, or database vendor boundaries. To switch themes or platforms, the client simply swaps the single Abstract Factory instance.",
    code: `// Family Interfaces
interface Button { render(): void; }
interface Checkbox { check(): void; }

// Abstract Factory contract
interface GUIFactory {
  createButton(): Button;
  createCheckbox(): Checkbox;
}

// Concrete Family 1: Dark Mode
class DarkButton implements Button { render() { console.log("Dark Button"); } }
class DarkCheckbox implements Checkbox { check() { console.log("Dark Checkbox"); } }
class DarkThemeFactory implements GUIFactory {
  createButton(): Button { return new DarkButton(); }
  createCheckbox(): Checkbox { return new DarkCheckbox(); }
}

// Concrete Family 2: Light Mode
class LightButton implements Button { render() { console.log("Light Button"); } }
class LightCheckbox implements Checkbox { check() { console.log("Light Checkbox"); } }
class LightThemeFactory implements GUIFactory {
  createButton(): Button { return new LightButton(); }
  createCheckbox(): Checkbox { return new LightCheckbox(); }
}

// Client application receives GUIFactory via injection; impossible to mix dark button with light checkbox!
class Application {
  constructor(private factory: GUIFactory) {}
  renderUI() {
    const btn = this.factory.createButton();
    const chk = this.factory.createCheckbox();
    btn.render(); chk.check();
  }
}`,
    recallHint: "Abstract Factory = factory of factories creating matching families of related objects.",
    practice: [
      "Design an Abstract Factory for cross-platform cloud infrastructure (AWS vs GCP vs Azure components)",
      "Explain the downside of adding a new product to an existing Abstract Factory interface"
    ],
    interviewTip: "In LLD questions involving cross-platform rendering, multi-cloud clients, or theming engines, immediately propose Abstract Factory to prevent cross-family component contamination.",
    tags: ["Design Patterns", "Abstract Factory", "Product Families", "Creational"]
  }),

  createCard({
    idNum: 15,
    category,
    concept: "Builder Pattern with Fluent Validation",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the Builder pattern eliminate the Telescoping Constructor anti-pattern while enforcing object invariants?",
    answer: "The Builder pattern separates the construction of a complex object from its representation. It uses a dedicated builder helper class with fluent chained methods (e.g. .withCpu().withRam()) and a terminal .build() method that executes all multi-field validation rules before returning a fully-formed, immutable instance.",
    explanation: "Constructors with 8+ parameters (many optional) lead to error-prone parameter ordering (Telescoping Constructor). Using setters allows partially constructed or invalid objects to escape into the wild. Builder ensures construction step-by-step and atomically validates cross-field constraints before instantiating the target object.",
    code: `class Computer {
  public readonly cpu: string;
  public readonly ramGb: number;
  public readonly storageGb: number;
  public readonly hasGpu: boolean;

  // Private constructor prevents direct instantiation
  private constructor(builder: ComputerBuilder) {
    this.cpu = builder.cpu;
    this.ramGb = builder.ramGb;
    this.storageGb = builder.storageGb;
    this.hasGpu = builder.hasGpu;
  }

  public static get Builder(): ComputerBuilder {
    return new ComputerBuilder();
  }

  // Nested Builder Class
  public static ComputerBuilder = class ComputerBuilder {
    public cpu: string = "Intel i5";
    public ramGb: number = 8;
    public storageGb: number = 256;
    public hasGpu: boolean = false;

    public setCpu(cpu: string): this { this.cpu = cpu; return this; }
    public setRam(ram: number): this { this.ramGb = ram; return this; }
    public setStorage(storage: number): this { this.storageGb = storage; return this; }
    public enableGpu(hasGpu: boolean): this { this.hasGpu = hasGpu; return this; }

    public build(): Computer {
      // Invariant assertions before object creation
      if (this.ramGb < 4) throw new Error("Minimum 4GB RAM required");
      if (this.hasGpu && this.ramGb < 16) {
        throw new Error("Computers with GPU must have at least 16GB RAM");
      }
      return new Computer(this);
    }
  };
}

// Fluent usage:
const gamingRig = Computer.Builder
  .setCpu("AMD Ryzen 9")
  .setRam(32)
  .setStorage(2000)
  .enableGpu(true)
  .build();`,
    recallHint: "Step-by-step fluent assembly; validate cross-field invariants in build() before returning immutable instance.",
    practice: [
      "Implement an HttpRequest builder with headers, timeout, body validation, and method verification",
      "Contrast the GoF Director pattern with modern Fluent Builder APIs"
    ],
    interviewTip: "In machine coding rounds, whenever an entity has more than 4 configuration parameters or interdependent validation rules, use the Builder pattern.",
    tags: ["Design Patterns", "Builder Pattern", "Fluent API", "Creational"]
  }),

  createCard({
    idNum: 16,
    category,
    concept: "Thread-Safe Singleton Pattern & Edge Cases",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you implement a truly Thread-Safe Singleton, and what is Double-Checked Locking (DCL)?",
    answer: "A Singleton ensures a class has only one instance and provides a global point of access. In multithreaded environments, naive lazy initialization causes race conditions where two threads create two instances. Double-Checked Locking checks for null before acquiring a lock, and checks again inside the lock, using volatile memory semantics to prevent CPU instruction reordering.",
    explanation: "Without volatile memory semantics, Java/C++ compilers and CPUs can reorder instructions (allocating memory, pointing the reference, then invoking constructor). Thread B could see a non-null reference before Thread A finishes object initialization, leading to crashes. In Java, Enum Singletons or the Bill Pugh Holder idiom (nested static class) offer clean, thread-safe alternatives without explicit synchronization.",
    code: `// 1. Double-Checked Locking (Java / C# conceptual model)
// public class ThreadSafeDclSingleton {
//     private static volatile ThreadSafeDclSingleton instance;
//     private ThreadSafeDclSingleton() {}
//     public static ThreadSafeDclSingleton getInstance() {
//         if (instance == null) {                         // 1st Check (No lock overhead)
//             synchronized (ThreadSafeDclSingleton.class) {
//                 if (instance == null) {                 // 2nd Check (Inside lock)
//                     instance = new ThreadSafeDclSingleton();
//                 }
//             }
//         }
//         return instance;
//     }
// }

// 2. TypeScript / JavaScript Module Singleton (Guaranteed single instance per module cache)
class DatabaseConnectionPool {
  private static instance: DatabaseConnectionPool | null = null;
  private readonly connectionString: string;

  private constructor() {
    this.connectionString = "postgresql://cluster-node:5432/prod";
  }

  public static getInstance(): DatabaseConnectionPool {
    if (!DatabaseConnectionPool.instance) {
      DatabaseConnectionPool.instance = new DatabaseConnectionPool();
    }
    return DatabaseConnectionPool.instance;
  }

  public query(sql: string): void {
    console.log(\`Executing \${sql} on pool\`);
  }
}`,
    recallHint: "Check null without lock -> synchronize -> check null with lock -> allocate with volatile.",
    practice: [
      "Explain how Java Reflection and Serialization can break standard Singleton classes",
      "Implement the Bill Pugh Singleton pattern using static inner class classloader guarantees"
    ],
    interviewTip: "Be prepared to discuss why Singletons are often considered an anti-pattern: they introduce global mutable state, hidden dependencies, and make unit testing difficult without dependency injection.",
    tags: ["Design Patterns", "Singleton", "Concurrency", "Thread Safety"]
  }),

  createCard({
    idNum: 17,
    category,
    concept: "Prototype Pattern (Shallow vs Deep Copying)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Prototype Pattern and when is cloning an existing object preferred over creating a new instance?",
    answer: "The Prototype pattern delegates the cloning process to the actual objects that are being cloned. It defines a clone() method in an interface. It is preferred when object creation is expensive (e.g. Loading models from disk, database queries, heavy matrix math) or when concrete classes are instantiated dynamically at runtime.",
    explanation: "A shallow copy duplicates the top-level object but shares references to nested mutable objects. A deep copy recursively clones the entire object graph so mutations in the clone do not affect the original. Prototype allows you to produce exact copies without coupling your code to their concrete classes.",
    code: `interface Prototype<T> {
  clone(): T;
}

class NetworkConfig implements Prototype<NetworkConfig> {
  constructor(
    public timeoutMs: number,
    public headers: Record<string, string>,
    public allowedIps: string[]
  ) {}

  // Deep clone implementation
  public clone(): NetworkConfig {
    return new NetworkConfig(
      this.timeoutMs,
      { ...this.headers },          // Clone headers object
      [...this.allowedIps]           // Clone IP array
    );
  }
}

// Usage: Rapid prototype configuration
const baseConfig = new NetworkConfig(5000, { "Content-Type": "application/json" }, ["10.0.0.1"]);
const customConfig = baseConfig.clone();
customConfig.allowedIps.push("192.168.1.1"); // Does NOT mutate baseConfig!`,
    recallHint: "clone() creates an exact duplicate; deep copy clones nested references to prevent side effects.",
    practice: [
      "Implement Prototype for a complex Game Monster with dynamic equipment and spell lists",
      "Contrast Object.assign / spread cloning with structuredClone() in modern JS runtimes"
    ],
    interviewTip: "In interviews, clearly distinguish between shallow copies (shared pointers) and deep copies (isolated memory). Explain serialization-based cloning vs manual copy constructors.",
    tags: ["Design Patterns", "Prototype Pattern", "Cloning", "Creational"]
  }),

  createCard({
    idNum: 18,
    category,
    concept: "Object Pool Pattern (Resource Pooling)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the Object Pool pattern manage expensive reusable resources, and how do you prevent resource leaks?",
    answer: "The Object Pool maintains a pool of pre-allocated, initialized resources (such as database connections or thread workers). Clients check out an object, perform work, and check it back in rather than destroying it. Resource leaks are prevented using RAII / try-with-resources patterns, checkout leases, and idle timeouts.",
    explanation: "Creating and destroying database sockets or threads involves costly kernel context switching, memory allocation, and network handshakes. An Object Pool amortizes this cost by keeping N initialized connections alive in a thread-safe queue. If the pool is exhausted, callers block until a connection is released or a timeout fires.",
    code: `class DatabaseConnection {
  constructor(public readonly id: number) {}
  public execute(query: string): string { return \`Result for \${query} on conn \${this.id}\`; }
  public reset(): void { /* Clean transaction state before returning */ }
}

class ConnectionPool {
  private available: DatabaseConnection[] = [];
  private inUse: Set<DatabaseConnection> = new Set();
  private maxPoolSize: number;

  constructor(maxSize: number = 5) {
    this.maxPoolSize = maxSize;
    for (let i = 1; i <= maxSize; i++) {
      this.available.push(new DatabaseConnection(i));
    }
  }

  public acquire(): DatabaseConnection {
    if (this.available.length === 0) {
      throw new Error("Pool exhausted! No connections available.");
    }
    const conn = this.available.pop()!;
    this.inUse.add(conn);
    return conn;
  }

  public release(conn: DatabaseConnection): void {
    if (this.inUse.has(conn)) {
      conn.reset(); // Clear dirty state
      this.inUse.delete(conn);
      this.available.push(conn);
    }
  }
}`,
    recallHint: "Pre-allocate N resources; acquire() checks out, release() resets state and checks back in.",
    practice: [
      "Implement a thread-safe BlockingQueue-backed Object Pool with maxWaitTimeout",
      "Add validation checks in release() to discard poisoned/broken connections"
    ],
    interviewTip: "Always mention resetting internal connection state (clearing transactions, uncommitted locks) upon return to the pool to prevent data bleeding between tenants.",
    tags: ["Design Patterns", "Object Pool", "Resource Management", "Performance"]
  }),

  createCard({
    idNum: 19,
    category,
    concept: "Monostate Pattern vs Singleton",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Monostate Pattern and how does it achieve transparent state sharing without restricting class instantiation?",
    answer: "The Monostate pattern achieves shared behavior by making all internal fields static while leaving constructors and methods non-static. Unlike Singleton (which enforces single instance identity), Monostate allows unlimited instances to be created, but all instances share the exact same underlying state.",
    explanation: "Singleton enforces structure (only one instance can exist; accessed via getInstance()). Monostate enforces behavior (multiple instances can be created using standard 'new' syntax, yet they all read and write to the same static storage). Clients treat Monostate classes as normal objects, enabling easier subclassing and polymorphic testing.",
    code: `class SystemRegistryMonostate {
  // Shared static state across all instances
  private static settings: Map<string, string> = new Map();

  // Public constructor allows normal 'new' instantiation
  constructor() {}

  public set(key: string, value: string): void {
    SystemRegistryMonostate.settings.set(key, value);
  }

  public get(key: string): string | undefined {
    return SystemRegistryMonostate.settings.get(key);
  }
}

// Usage: Multiple independent instances share the same state
const r1 = new SystemRegistryMonostate();
const r2 = new SystemRegistryMonostate();

r1.set("theme", "dracula");
console.log(r2.get("theme")); // Outputs: 'dracula'! (Transparently synchronized)`,
    recallHint: "Monostate = many instances with shared static state; Singleton = exactly one instance.",
    practice: [
      "Compare Monostate and Singleton from an inheritance and unit testing perspective",
      "Identify concurrency hazards when multiple threads mutate Monostate static maps"
    ],
    interviewTip: "Discussing Monostate as an alternative to Singleton shows deep design pattern knowledge, particularly regarding how it avoids global getInstance() method pollution.",
    tags: ["Design Patterns", "Monostate", "Singleton Alternative", "Creational"]
  }),

  createCard({
    idNum: 20,
    category,
    concept: "Dependency Injection Container Internals",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does a Dependency Injection (DI) Container resolve dependencies, and what are the transient, singleton, and scoped lifecycles?",
    answer: "A DI Container registers token-to-class mappings, analyzes constructor parameters via reflection or metadata, builds a Directed Acyclic Graph (DAG) of dependencies, and instantiates them in topological order. Lifecycles govern reuse: Singleton creates 1 instance per app; Transient creates a new instance on every request; Scoped creates 1 instance per request/scope context.",
    explanation: "Hardcoding 'new Service()' inside classes binds implementations together. A DI container decouples construction from execution. When a class requests IUserRepository, the container resolves its dependencies recursively (e.g. IDatabaseConnection), instantiates them based on their configured lifecycle scope, and injects them.",
    code: `type Constructor<T = any> = new (...args: any[]) => T;

class MiniDiContainer {
  private singletons: Map<string, any> = new Map();
  private registry: Map<string, { ctor: Constructor; isSingleton: boolean; deps: string[] }> = new Map();

  public register(token: string, ctor: Constructor, deps: string[] = [], isSingleton: boolean = false) {
    this.registry.set(token, { ctor, isSingleton, deps });
  }

  public resolve<T>(token: string): T {
    const entry = this.registry.get(token);
    if (!entry) throw new Error(\`Unregistered dependency token: \${token}\`);

    if (entry.isSingleton && this.singletons.has(token)) {
      return this.singletons.get(token);
    }

    // Recursively resolve dependency tree
    const resolvedDeps = entry.deps.map(depToken => this.resolve(depToken));
    const instance = new entry.ctor(...resolvedDeps);

    if (entry.isSingleton) {
      this.singletons.set(token, instance);
    }
    return instance;
  }
}`,
    recallHint: "DI container resolves dependency DAG via topological sort; Singleton = 1/app, Scoped = 1/request, Transient = 1/call.",
    practice: [
      "Detect circular dependencies (A -> B -> A) during DI container resolution using cycle detection",
      "Implement an AsyncLocalStorage backed Scoped lifecycle for HTTP request isolation"
    ],
    interviewTip: "Explain how Scoped lifecycle protects database transactions and tenant contexts from leaking across concurrent HTTP requests.",
    tags: ["DI Container", "IoC", "Dependency Injection", "Lifecycles"]
  }),

  createCard({
    idNum: 21,
    category,
    concept: "Lazy Initialization & Virtual Creation",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is Lazy Initialization and how does it optimize startup performance and memory utilization?",
    answer: "Lazy Initialization delays the creation of an expensive object until the exact moment it is first accessed. Instead of instantiating heavy resources during system boot, the access method checks if the instance exists, creates it if null, and caches it for future calls.",
    explanation: "If an application connects to 10 databases, image renderers, and reporting engines, eager initialization slows down startup and wastes memory on components that may never be executed in a given run. Lazy initialization ensures resources are only allocated when triggered by active workflows.",
    code: `class HeavyImageRenderer {
  constructor() {
    console.log("Loading 500MB graphics shaders into memory...");
  }
  public render() { console.log("Rendered 4K frame"); }
}

class GraphicCanvas {
  // Backing field starts uninitialized
  private _renderer: HeavyImageRenderer | null = null;

  // Lazy accessor
  private get renderer(): HeavyImageRenderer {
    if (!this._renderer) {
      this._renderer = new HeavyImageRenderer(); // Allocated only on demand!
    }
    return this._renderer;
  }

  public draw() {
    this.renderer.render();
  }
}

const canvas = new GraphicCanvas(); // Fast instantiation! Shaders not loaded yet.
canvas.draw(); // Shaders loaded here on first use.`,
    recallHint: "Don't create until requested; initialize on first call and cache for subsequent calls.",
    practice: [
      "Implement thread-safe Lazy<T> wrapper with supplier function in Java/C#",
      "Identify the tradeoff between fast startup vs first-request latency spike"
    ],
    interviewTip: "Mention that the tradeoff for lazy initialization is a latency spike ('cold start') on the first request. In high-frequency trading or real-time gaming, eager initialization is preferred to ensure predictable latency.",
    tags: ["Creational", "Lazy Initialization", "Performance", "Optimization"]
  }),

  createCard({
    idNum: 22,
    category,
    concept: "Dynamic Factory Registry Pattern",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the Factory Registry pattern eliminate switch statements while enabling dynamic plugin registration?",
    answer: "The Factory Registry pattern maintains a map of string/enum keys to factory functions or constructors. Classes register themselves with the central registry at startup. The client requests a product by key, and the registry invokes the matching creator function, achieving complete Open/Closed compliance without any switch statements.",
    explanation: "In standard factories, adding a new payment gateway or export format requires editing a switch block. With a Factory Registry, new plugins or modules call `PaymentRegistry.register('crypto', CryptoPaymentFactory)`. The core engine requires zero modifications to support new third-party plugins.",
    code: `interface Serializer {
  serialize(data: any): string;
}

type SerializerFactory = () => Serializer;

class SerializerRegistry {
  private static registry: Map<string, SerializerFactory> = new Map();

  // Self-registering mechanism
  public static register(type: string, factory: SerializerFactory): void {
    SerializerRegistry.registry.set(type.toLowerCase(), factory);
  }

  public static create(type: string): Serializer {
    const factory = SerializerRegistry.registry.get(type.toLowerCase());
    if (!factory) throw new Error(\`Unsupported serializer type: \${type}\`);
    return factory();
  }
}

// Independent modules register themselves without touching core code:
class JsonSerializer implements Serializer {
  serialize(data: any) { return JSON.stringify(data); }
}
SerializerRegistry.register("json", () => new JsonSerializer());

class XmlSerializer implements Serializer {
  serialize(data: any) { return \`<data>\${data}</data>\`; }
}
SerializerRegistry.register("xml", () => new XmlSerializer());

// Client dynamically instantiates serializer:
const serializer = SerializerRegistry.create("json");`,
    recallHint: "Map of key -> creator function. New plugins register themselves; zero switch statements.",
    practice: [
      "Implement a dynamic payment processor registry loaded via configuration file",
      "Handle registry thread-safety in concurrent multi-threaded startup environments"
    ],
    interviewTip: "This is one of the most respected design patterns in machine coding interviews for proving true adherence to the Open/Closed Principle.",
    tags: ["Design Patterns", "Factory Registry", "Extensibility", "Plugin Architecture"]
  }),

  createCard({
    idNum: 23,
    category,
    concept: "Telescoping Constructor Anti-Pattern & Builder Solution",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the Telescoping Constructor anti-pattern and why is it hazardous in production code?",
    answer: "The Telescoping Constructor anti-pattern occurs when a class provides a cascading chain of overloaded constructors, each adding an optional parameter. It makes code unreadable, introduces parameter-swapping bugs (especially with adjacent booleans or integers), and forces callers to pass dummy null or 0 values for unwanted parameters.",
    explanation: "When a developer writes `new Pizza(12, true, false, null, true, 0, false)`, nobody reading the code knows what those boolean flags represent without inspecting the signature. Swapping two boolean arguments fails silently at runtime without compiler warnings. The Builder pattern replaces this with self-documenting fluent methods.",
    code: `// Anti-pattern: Telescoping constructors (Bug-prone and unreadable)
// class Pizza {
//   constructor(size: number) {}
//   constructor(size: number, cheese: boolean) {}
//   constructor(size: number, cheese: boolean, pepperoni: boolean) {}
//   constructor(size: number, cheese: boolean, pepperoni: boolean, bacon: boolean) {}
// }
// const p = new Pizza(14, true, false, true); // What is true and false here?

// Clean Design: Fluent Builder replaces telescoping constructors
class Pizza {
  constructor(
    public readonly sizeInches: number,
    public readonly hasCheese: boolean,
    public readonly hasPepperoni: boolean,
    public readonly hasBacon: boolean
  ) {}
}

class PizzaOrderBuilder {
  private size: number = 12;
  private cheese: boolean = true;
  private pepperoni: boolean = false;
  private bacon: boolean = false;

  setSize(size: number) { this.size = size; return this; }
  withPepperoni() { this.pepperoni = true; return this; }
  withBacon() { this.bacon = true; return this; }
  withoutCheese() { this.cheese = false; return this; }

  build(): Pizza {
    return new Pizza(this.size, this.cheese, this.pepperoni, this.bacon);
  }
}

const myPizza = new PizzaOrderBuilder().setSize(16).withPepperoni().withBacon().build();`,
    recallHint: "Telescoping = constructor chaining with endless nulls/booleans; replace with self-documenting Builder.",
    practice: [
      "Refactor a 10-parameter DatabaseConfig constructor into a clean Builder",
      "Explain how named arguments in Python/Kotlin reduce the need for simple builders"
    ],
    interviewTip: "Whenever an interviewer presents a class with multiple constructors taking strings and booleans, immediately call out the Telescoping Constructor anti-pattern.",
    tags: ["Anti-Pattern", "Telescoping Constructor", "Builder Pattern", "Code Quality"]
  }),

  createCard({
    idNum: 24,
    category,
    concept: "Immutable Value Object Builders & State Snapshots",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you combine the Builder pattern with Immutability to create state modification snapshots (Wither pattern)?",
    answer: "For immutable entities, you cannot provide setters. Instead, you create a 'toBuilder()' method that populates a new Builder with the object's current state, or implement 'withX()' methods (the Wither pattern) that return a brand new instance with that single property updated while leaving the original untouched.",
    explanation: "Immutability guarantees thread-safety and prevents unexpected side effects across business workflows. However, modifying a single field on an immutable object with 15 attributes is cumbersome. A `toBuilder()` method copies all attributes to a mutable builder, applies changes, and calls `build()` to return a fresh immutable snapshot.",
    code: `class UserProfile {
  public readonly id: string;
  public readonly email: string;
  public readonly plan: "FREE" | "PRO" | "ENTERPRISE";
  public readonly isVerified: boolean;

  constructor(builder: UserProfileBuilder) {
    this.id = builder.id;
    this.email = builder.email;
    this.plan = builder.plan;
    this.isVerified = builder.isVerified;
    Object.freeze(this); // Guarantees true runtime immutability
  }

  // Exports state into a builder for safe modification
  public toBuilder(): UserProfileBuilder {
    return new UserProfileBuilder()
      .setId(this.id)
      .setEmail(this.email)
      .setPlan(this.plan)
      .setVerified(this.isVerified);
  }
}

class UserProfileBuilder {
  public id!: string;
  public email!: string;
  public plan: "FREE" | "PRO" | "ENTERPRISE" = "FREE";
  public isVerified: boolean = false;

  setId(id: string) { this.id = id; return this; }
  setEmail(email: string) { this.email = email; return this; }
  setPlan(plan: "FREE" | "PRO" | "ENTERPRISE") { this.plan = plan; return this; }
  setVerified(verified: boolean) { this.isVerified = verified; return this; }

  build(): UserProfile { return new UserProfile(this); }
}

// Upgrading user plan safely without mutating original instance:
const userV1 = new UserProfileBuilder().setId("u-1").setEmail("dev@test.com").build();
const userV2 = userV1.toBuilder().setPlan("PRO").setVerified(true).build();`,
    recallHint: "toBuilder() clones immutable state into a builder for safe non-destructive updates.",
    practice: [
      "Implement the Wither pattern (withBalance(), withAddress()) on an immutable Customer Entity",
      "Explain how Redux and functional architectures leverage immutable state snapshots"
    ],
    interviewTip: "Demonstrating the `toBuilder()` pattern on domain entities proves you know how to build immutable domain models without sacrificing ergonomic state evolution.",
    tags: ["Immutability", "Builder Pattern", "Wither Pattern", "DDD"]
  })
];
