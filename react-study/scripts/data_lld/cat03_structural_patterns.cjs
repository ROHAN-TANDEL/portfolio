const { createCard } = require('../lld_builder_helper.cjs');

const category = "Structural Design Patterns & Composition";

module.exports = [
  createCard({
    idNum: 25,
    category,
    concept: "Adapter Pattern (Class vs Object Adapter)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Adapter Pattern and what is the difference between Class Adapter and Object Adapter?",
    answer: "The Adapter pattern allows incompatible interfaces to collaborate by converting the interface of a legacy or third-party class into an expected client interface. An Object Adapter uses object composition (wrapping the adaptee instance), whereas a Class Adapter uses multiple inheritance (inheriting from both the client interface and adaptee class).",
    explanation: "Object Adapter is preferred in clean modern design because it obeys 'composition over inheritance' and can adapt not just the concrete class, but any of its subclasses. Class Adapter is only possible in languages supporting multiple inheritance (like C++) and binds the adapter tightly to a specific concrete adaptee at compile time.",
    code: `// Target interface expected by client domain
interface PaymentGateway {
  charge(customerToken: string, amountCents: number): Promise<boolean>;
}

// Incompatible 3rd-party legacy service (Adaptee)
class LegacyStripeService {
  makePayment(userKey: string, dollars: number): boolean {
    console.log(\`Legacy Stripe charged \$\${dollars} for user \${userKey}\`);
    return true;
  }
}

// Object Adapter: Wraps adaptee via composition
class StripeAdapter implements PaymentGateway {
  constructor(private legacyStripe: LegacyStripeService) {}

  async charge(customerToken: string, amountCents: number): Promise<boolean> {
    // Translate cents to dollars and map token to userKey
    const dollars = amountCents / 100;
    return this.legacyStripe.makePayment(customerToken, dollars);
  }
}

// Client depends solely on domain interface
const adapter = new StripeAdapter(new LegacyStripeService());
adapter.charge("tok_12345", 5000); // Charges $50.00 cleanly!`,
    recallHint: "Wraps an incompatible class to match the interface the client expects (composition-based Object Adapter).",
    practice: [
      "Create an Adapter converting a third-party JSON weather API into an internal domain WeatherForecast model",
      "Explain how Java's Arrays.asList() acts as an Adapter"
    ],
    interviewTip: "In interviews, whenever you integrate third-party vendor SDKs (Stripe, Twilio, SendGrid), always wrap them in an Adapter so vendor changes don't infect your domain logic.",
    tags: ["Design Patterns", "Adapter Pattern", "Structural", "GoF"]
  }),

  createCard({
    idNum: 26,
    category,
    concept: "Bridge Pattern (Decoupling Abstraction from Implementation)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the Bridge pattern prevent a combinatorial $M \times N$ class explosion?",
    answer: "The Bridge pattern splits a large class or set of closely related classes into two separate hierarchies—Abstraction (high-level control) and Implementation (platform-specific platform code)—that can be developed and varied independently, replacing an exponential $M \times N$ class tree with an additive $M + N$ structure.",
    explanation: "If you have 3 Shapes (Circle, Square, Triangle) and 3 Renderers (Vector, Raster, OpenGL), inheritance requires $3 \times 3 = 9$ classes (VectorCircle, RasterCircle, etc.). Adding a 4th shape requires 3 new classes. With Bridge, Shape holds a reference to a Renderer interface. You have 3 Shapes + 3 Renderers = 6 classes. Adding a shape only requires 1 new class.",
    code: `// Implementor Hierarchy (Platform details)
interface Renderer {
  renderCircle(radius: number): void;
}

class VectorRenderer implements Renderer {
  renderCircle(radius: number) { console.log(\`Vector: drawing lines for circle radius \${radius}\`); }
}

class RasterRenderer implements Renderer {
  renderCircle(radius: number) { console.log(\`Raster: drawing pixels for circle radius \${radius}\`); }
}

// Abstraction Hierarchy (High-level control)
abstract class Shape {
  constructor(protected renderer: Renderer) {} // The Bridge!
  abstract draw(): void;
  abstract resize(percent: number): void;
}

class Circle extends Shape {
  constructor(private radius: number, renderer: Renderer) {
    super(renderer);
  }

  draw(): void { this.renderer.renderCircle(this.radius); }
  resize(percent: number): void { this.radius *= (1 + percent / 100); }
}

// Usage: Independently combine any shape with any renderer
const circle1 = new Circle(10, new VectorRenderer());
const circle2 = new Circle(10, new RasterRenderer());
circle1.draw(); circle2.draw();`,
    recallHint: "Decouples abstraction from implementation via a bridge reference; turns M*N classes into M+N.",
    practice: [
      "Design a RemoteControl abstraction connected to a Device (TV, Radio, SmartLamp) implementor bridge",
      "Contrast Bridge vs Adapter (Bridge is designed upfront; Adapter fixes existing incompatibilities)"
    ],
    interviewTip: "A classic interview question is: 'What is the difference between Bridge and Adapter?'. Key answer: Adapter unites two existing mismatched interfaces post-facto; Bridge is designed upfront to let abstraction and implementation vary independently.",
    tags: ["Design Patterns", "Bridge Pattern", "Class Explosion", "Structural"]
  }),

  createCard({
    idNum: 27,
    category,
    concept: "Composite Pattern (Hierarchical Tree Structures)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Composite Pattern and how does it allow clients to treat individual objects and compositions of objects uniformly?",
    answer: "The Composite pattern composes objects into tree structures to represent part-whole hierarchies. It defines a common component interface for both individual leaf items and composite containers holding child components. Clients call methods on the root component without caring whether it is a single leaf or an entire sub-tree.",
    explanation: "In a file system, a Directory contains Files and other Directories. Calculating the total size of a Directory requires summing child sizes recursively. Without Composite, client code needs `instanceof` checks to differentiate files from folders. With Composite, both File and Directory implement `FileSystemItem.getSize()`. The directory recursively delegates to its children.",
    code: `// Component Interface
interface FileSystemItem {
  getName(): string;
  getSize(): number;
  print(indent?: string): void;
}

// Leaf Node
class FileItem implements FileSystemItem {
  constructor(private name: string, private sizeBytes: number) {}
  getName(): string { return this.name; }
  getSize(): number { return this.sizeBytes; }
  print(indent: string = ""): void { console.log(\`\${indent}- File: \${this.name} (\${this.sizeBytes}B)\`); }
}

// Composite Node
class DirectoryItem implements FileSystemItem {
  private children: FileSystemItem[] = [];
  constructor(private name: string) {}

  public add(item: FileSystemItem): void { this.children.push(item); }

  getName(): string { return this.name; }

  // Uniform calculation: recursive aggregation across all children
  getSize(): number {
    return this.children.reduce((total, child) => total + child.getSize(), 0);
  }

  print(indent: string = ""): void {
    console.log(\`\${indent}+ Directory: \${this.name} (\${this.getSize()}B)\`);
    this.children.forEach(child => child.print(indent + "  "));
  }
}

// Client builds hierarchical tree:
const root = new DirectoryItem("root");
const docs = new DirectoryItem("docs");
docs.add(new FileItem("resume.pdf", 1024));
docs.add(new FileItem("cover_letter.docx", 512));
root.add(docs);
root.add(new FileItem("config.sys", 128));

console.log(\`Total Size: \${root.getSize()} Bytes\`); // 1664 Bytes uniformly!`,
    recallHint: "Tree structure where leaf and composite share the same interface; uniform recursive operations.",
    practice: [
      "Implement a UI Menu / Sub-Menu hierarchy with Composite pattern",
      "Model an Organization Chart where Managers contain Employees and other Managers"
    ],
    interviewTip: "When asked to design a File System, UI Component Tree, or Shopping Cart with bundled item kits, immediately identify the Composite pattern.",
    tags: ["Design Patterns", "Composite Pattern", "Tree Structures", "Structural"]
  }),

  createCard({
    idNum: 28,
    category,
    concept: "Decorator Pattern (Dynamic Behavior Augmentation)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the Decorator Pattern attach additional responsibilities to an object dynamically without subclassing?",
    answer: "The Decorator pattern wraps an original component inside a decorator class that implements the same component interface. The decorator executes its own behavior before or after delegating the call to the wrapped target, allowing behaviors (encryption, caching, logging, compression) to be stacked arbitrarily at runtime.",
    explanation: "Subclassing extends behavior statically at compile time. If you want Logging, Caching, and Encryption, subclassing leads to classes like CachingEncryptedLoggingRepository. Decorator allows you to wrap instances like Russian dolls: `new EncryptionDecorator(new CachingDecorator(new LoggingDecorator(baseRepo)))`. Each wrapper adds its behavior cleanly.",
    code: `// Component Interface
interface DataSource {
  writeData(data: string): void;
  readData(): string;
}

// Concrete Component
class FileDataSource implements DataSource {
  private content: string = "";
  writeData(data: string) { this.content = data; }
  readData(): string { return this.content; }
}

// Base Decorator
abstract class DataSourceDecorator implements DataSource {
  constructor(protected wrappee: DataSource) {}
  writeData(data: string): void { this.wrappee.writeData(data); }
  readData(): string { return this.wrappee.readData(); }
}

// Concrete Decorator 1: Encryption
class EncryptionDecorator extends DataSourceDecorator {
  writeData(data: string): void {
    const encrypted = Buffer.from(data).toString("base64");
    console.log(\`[Encrypt] Encrypted payload to: \${encrypted}\`);
    super.writeData(encrypted);
  }
  readData(): string {
    const raw = super.readData();
    return Buffer.from(raw, "base64").toString("utf-8");
  }
}

// Concrete Decorator 2: Compression
class CompressionDecorator extends DataSourceDecorator {
  writeData(data: string): void {
    console.log("[Compress] Compressing payload...");
    super.writeData(\`GZIP(\${data})\`);
  }
}

// Usage: Stack behaviors dynamically at runtime
const source = new CompressionDecorator(
  new EncryptionDecorator(
    new FileDataSource()
  )
);
source.writeData("Sensitive user credit card payload");`,
    recallHint: "Wraps target with the same interface; executes pre/post logic and delegates to wrappee.",
    practice: [
      "Implement Java I/O streams (BufferedInputStream wrapping FileInputStream) using Decorator",
      "Build a coffee shop ordering system where Milk, Sugar, and Whip dynamically decorate Coffee price"
    ],
    interviewTip: "Contrast Decorator with Inheritance: Decorator allows runtime layering of orthogonal behaviors, while Inheritance is rigid and causes class explosion.",
    tags: ["Design Patterns", "Decorator Pattern", "Dynamic Behavior", "Structural"]
  }),

  createCard({
    idNum: 29,
    category,
    concept: "Facade Pattern (Simplifying Complex Subsystems)",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the Facade Pattern and how does it reduce coupling between clients and complex subsystems?",
    answer: "The Facade pattern provides a simplified, higher-level interface to a complex set of classes, libraries, or frameworks. It does not hide subsystem classes, but shields ordinary clients from having to orchestrate dozens of low-level dependencies and configuration steps directly.",
    explanation: "Starting a computer involves CPU initialization, Memory boot, Disk controller spin-up, and BIOS checksum verification. The client only wants to press `powerButton()`. A ComputerFacade orchestrates these complex subsystem interactions behind one clean method, dramatically reducing client coupling.",
    code: `// Complex Subsystem Components
class VideoDecoder { decode(file: string) { console.log("Decoding raw video frames"); } }
class AudioMixer { mix() { console.log("Balancing audio channels"); } }
class SubtitleParser { parse(file: string) { console.log("Syncing subtitle track"); } }
class HardwareRenderer { render() { console.log("Outputting to HDMI buffer"); } }

// Facade: Unified high-level control
class VideoPlayerFacade {
  private decoder = new VideoDecoder();
  private audio = new AudioMixer();
  private subtitles = new SubtitleParser();
  private renderer = new HardwareRenderer();

  // Simple one-click interface for clients
  public playMovie(movieFile: string): void {
    console.log(\`=== Initializing Playback for \${movieFile} ===\`);
    this.decoder.decode(movieFile);
    this.audio.mix();
    this.subtitles.parse(movieFile);
    this.renderer.render();
    console.log("=== Movie Playing Smoothly ===");
  }
}

// Client code: One line of code instead of 15 lines of low-level subsystem orchestration
const player = new VideoPlayerFacade();
player.playMovie("interstellar.mkv");`,
    recallHint: "One clean entrypoint that orchestrates a complex internal subsystem for the client.",
    practice: [
      "Create an OrderCheckoutFacade coordinating Inventory, Payment, Shipping, and Email subsystems",
      "Contrast Facade with Adapter (Facade simplifies; Adapter converts incompatible interfaces)"
    ],
    interviewTip: "In microservices or layered architecture, API Gateways and Service Facades are architectural manifestations of the GoF Facade pattern.",
    tags: ["Design Patterns", "Facade Pattern", "Subsystems", "Structural"]
  }),

  createCard({
    idNum: 30,
    category,
    concept: "Flyweight Pattern (Memory Optimization)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the Flyweight pattern drastically reduce RAM consumption by separating Intrinsic from Extrinsic state?",
    answer: "The Flyweight pattern shares common, immutable state (Intrinsic State) among thousands of fine-grained objects rather than duplicating it in every instance. The context-dependent, unique state (Extrinsic State) is passed into flyweight methods from the outside or stored in a compact lookup table.",
    explanation: "In a forest rendering engine with 1,000,000 trees, if each Tree object stores its 3D mesh model, texture bitmaps (intrinsic state), and coordinates (extrinsic state), memory usage will exceed several gigabytes. With Flyweight, 1,000,000 lightweight Tree instances simply hold an (x, y) coordinate and a pointer to 1 of 3 shared TreeType flyweights, slashing memory from 5GB down to 30MB.",
    code: `// Flyweight: Shared, immutable intrinsic state (Mesh & Texture)
class TreeType {
  constructor(
    public readonly name: string,
    public readonly color: string,
    public readonly textureData: string // Heavy 10MB texture buffer
  ) {}

  public draw(x: number, y: number): void {
    console.log(\`Rendering \${this.name} tree at (\${x}, \${y}) with color \${this.color}\`);
  }
}

// Flyweight Factory: Caches and reuses shared TreeType instances
class TreeFactory {
  private static treeTypes: Map<string, TreeType> = new Map();

  public static getTreeType(name: string, color: string, textureData: string): TreeType {
    const key = \`\${name}_\${color}\`;
    if (!this.treeTypes.has(key)) {
      this.treeTypes.set(key, new TreeType(name, color, textureData));
    }
    return this.treeTypes.get(key)!;
  }
}

// Context: Lightweight object holding unique extrinsic state (x, y)
class Tree {
  constructor(
    public x: number,
    public y: number,
    public type: TreeType // Reference to shared flyweight!
  ) {}

  public draw() { this.type.draw(this.x, this.y); }
}`,
    recallHint: "Separate intrinsic (shared heavy data) from extrinsic (unique context); cache shared flyweights.",
    practice: [
      "Design a rich-text Word Processor (e.g. Google Docs) using Flyweight for individual character glyphs",
      "Explain how Java's String Interning and IntegerCache (-128 to 127) use the Flyweight pattern"
    ],
    interviewTip: "Whenever an interview question asks to simulate a million particles, game bullets, text characters, or map tiles with memory constraints, the answer is Flyweight.",
    tags: ["Design Patterns", "Flyweight Pattern", "Memory Optimization", "Structural"]
  }),

  createCard({
    idNum: 31,
    category,
    concept: "Virtual Proxy Pattern (Lazy Loading)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a Virtual Proxy and how does it enable on-demand lazy loading of resource-intensive objects?",
    answer: "A Virtual Proxy implements the same interface as a heavy real subject and acts as a placeholder. It defers the expensive instantiation and resource loading of the real subject until a method that actually requires the real object's presence is first invoked.",
    explanation: "In an image viewer displaying a gallery of 1,000 high-res photos, loading all 1,000 photos into RAM during startup freezes the app. A Virtual Proxy Image displays dimensions and placeholders immediately, only downloading and decoding the real 50MB bitmap when the user scrolls the photo into the viewport.",
    code: `interface HighResImage {
  display(): void;
  getFilename(): string;
}

class RealHighResImage implements HighResImage {
  constructor(private filename: string) {
    this.loadFromDisk(); // Expensive 2-second I/O operation
  }

  private loadFromDisk() {
    console.log(\`Loading 50MB image from disk: \${this.filename}\`);
  }

  public display(): void { console.log(\`Displaying \${this.filename} on canvas\`); }
  public getFilename(): string { return this.filename; }
}

// Virtual Proxy: Defers heavy instantiation
class VirtualProxyImage implements HighResImage {
  private realImage: RealHighResImage | null = null;
  constructor(private filename: string) {}

  public getFilename(): string { return this.filename; } // Fast, no heavy loading!

  public display(): void {
    if (!this.realImage) {
      this.realImage = new RealHighResImage(this.filename); // Lazy creation on demand
    }
    this.realImage.display();
  }
}

// Fast gallery initialization (0ms load time!)
const gallery: HighResImage[] = [
  new VirtualProxyImage("photo1.raw"),
  new VirtualProxyImage("photo2.raw")
];
// Image loaded only when displayed:
gallery[0].display();`,
    recallHint: "Acts as a placeholder sharing the same interface; instantiates heavy real subject on first method call.",
    practice: [
      "Implement a Virtual Proxy for a Hibernate / JPA lazy-loaded database relation",
      "Handle thread-safe instantiation inside a multi-threaded Virtual Proxy"
    ],
    interviewTip: "Proxies share the *same interface* as the target, whereas Adapters *change* the interface, and Decorators *enhance* behavior without deferring creation.",
    tags: ["Design Patterns", "Proxy Pattern", "Virtual Proxy", "Lazy Loading"]
  }),

  createCard({
    idNum: 32,
    category,
    concept: "Protection / Security Proxy Pattern",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does a Protection Proxy enforce Role-Based Access Control (RBAC) before delegating to real domain services?",
    answer: "A Protection Proxy controls access to the original object based on caller permissions or authentication credentials. It intercepts every method call, inspects the current security context, and throws an unauthorized exception or logs an audit event before passing the request to the real subject.",
    explanation: "Mixing authorization checks directly into core domain business methods pollutes the domain model and violates the Single Responsibility Principle. A Protection Proxy wraps the sensitive service, validating whether the active user possesses the required permission (e.g. ADMIN vs VIEWER) before delegating.",
    code: `interface DocumentVault {
  read(docId: string): string;
  delete(docId: string): void;
}

class RealDocumentVault implements DocumentVault {
  read(docId: string): string { return \`Confidential content of \${docId}\`; }
  delete(docId: string): void { console.log(\`Document \${docId} permanently deleted\`); }
}

interface UserContext {
  username: string;
  role: "ADMIN" | "USER" | "GUEST";
}

// Protection Proxy
class SecurityProtectionProxy implements DocumentVault {
  constructor(
    private realVault: RealDocumentVault,
    private currentUser: UserContext
  ) {}

  read(docId: string): string {
    // Both USER and ADMIN can read
    if (this.currentUser.role === "GUEST") {
      throw new Error("Access Denied: Guests cannot read confidential vaults");
    }
    return this.realVault.read(docId);
  }

  delete(docId: string): void {
    // Only ADMIN can delete
    if (this.currentUser.role !== "ADMIN") {
      throw new Error(\`Access Denied: User '\${this.currentUser.username}' lacks ADMIN role\`);
    }
    this.realVault.delete(docId);
  }
}`,
    recallHint: "Checks user permissions before delegating; protects real domain service from unauthorized calls.",
    practice: [
      "Design a Protection Proxy that audits all financial ledger modifications to an immutable log",
      "Implement dynamic method interception using ES6 Proxy or Java Reflection InvocationHandler"
    ],
    interviewTip: "Highlight that Protection Proxies enforce the Single Responsibility Principle by keeping security checks completely decoupled from business domain logic.",
    tags: ["Design Patterns", "Protection Proxy", "Security", "RBAC"]
  }),

  createCard({
    idNum: 33,
    category,
    concept: "Remote & Dynamic Proxy Pattern",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a Remote Proxy (RPC/gRPC client stub) and how do Dynamic Proxies enable declarative transactions and AOP?",
    answer: "A Remote Proxy provides a local representative for an object running in a different address space (or remote server). It encapsulates TCP networking, serialization, and socket communication behind a standard local method call. A Dynamic Proxy generates proxy instances dynamically at runtime (via reflection or byte-code enhancement) to inject cross-cutting concerns like `@Transactional` or `@Log`.",
    explanation: "When client code calls `userService.findUser(id)`, a Remote Proxy serializes the call into a protobuf or JSON-RPC payload, sends it across the network, deserializes the response, and returns it transparently as if it were local. Dynamic proxies (used in Spring and NestJS) intercept method invocations to manage database transactions without hardcoding `beginTransaction()` in business code.",
    code: `// Conceptual ES6 Dynamic Proxy intercepting all method calls
function createLoggingProxy<T extends object>(target: T): T {
  return new Proxy(target, {
    get(obj: any, prop: string | symbol) {
      const origMethod = obj[prop];
      if (typeof origMethod === "function") {
        return function (...args: any[]) {
          console.log(\`[AUDIT] Invoking method '\${String(prop)}' with args:\`, JSON.stringify(args));
          const start = Date.now();
          const result = origMethod.apply(obj, args);
          console.log(\`[AUDIT] Method '\${String(prop)}' completed in \${Date.now() - start}ms\`);
          return result;
        };
      }
      return origMethod;
    }
  });
}

class OrderService {
  placeOrder(orderId: string, amount: number) {
    console.log(\`Order \${orderId} placed for \$\${amount}\`);
    return { success: true };
  }
}

const proxiedService = createLoggingProxy(new OrderService());
proxiedService.placeOrder("ord-99", 250);`,
    recallHint: "Remote proxy hides network RPC calls; Dynamic proxy generates runtime wrappers for AOP and transactions.",
    practice: [
      "Trace how gRPC client stubs function as Remote Proxies",
      "Implement a dynamic transaction interceptor that commits or rolls back on exception"
    ],
    interviewTip: "Explaining how Spring's `@Transactional` or NestJS Interceptors work under the hood via Dynamic Proxies demonstrates senior-level framework mastery.",
    tags: ["Design Patterns", "Remote Proxy", "Dynamic Proxy", "AOP"]
  }),

  createCard({
    idNum: 34,
    category,
    concept: "Adapter vs Bridge vs Facade vs Decorator",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you distinguish between Adapter, Bridge, Facade, and Decorator when all four wrap underlying objects?",
    answer: "Their structural wrapper forms look similar, but their intents are fundamentally distinct: Adapter changes an existing interface to match client expectations; Decorator keeps the exact same interface while adding behavior; Facade simplifies a complex subsystem into a brand new higher-level interface; Bridge decouples an abstraction from its implementation upfront so both can vary independently.",
    explanation: "Use Adapter when two existing incompatible systems must talk. Use Decorator when you need to stack orthogonal responsibilities (encryption, logging) without subclass explosion. Use Facade when you want an easy single-door entrance to a multi-class library. Use Bridge when designing an extensible multi-platform architecture from scratch.",
    code: `/*
Summary Comparison Table:
+-----------+----------------------+--------------------------+------------------------------+
| Pattern   | Interface Treatment  | Intent                   | When Applied                 |
+-----------+----------------------+--------------------------+------------------------------+
| Adapter   | Converts to another  | Fix interface mismatch   | Post-facto (retrofitting)    |
| Decorator | Preserves identical  | Add dynamic behavior     | Runtime stackable features   |
| Facade    | Creates new simple   | Simplify complex system  | Library / Subsystem gateway  |
| Bridge    | Decouples both sides | Independent variation    | Upfront architectural design |
+-----------+----------------------+--------------------------+------------------------------+
*/`,
    recallHint: "Adapter converts; Decorator enhances; Facade simplifies; Bridge decouples upfront.",
    practice: [
      "Given a requirement to add caching to an existing service without modifying it, select the right pattern",
      "Given a requirement to unify 3 third-party SMS providers, select Adapter vs Facade"
    ],
    interviewTip: "This is a universal system design interview question. Start your response by stating that while all four use composition/wrapping, their architectural intent is completely different.",
    tags: ["Design Patterns", "Pattern Comparison", "Structural Patterns", "Architecture"]
  }),

  createCard({
    idNum: 35,
    category,
    concept: "Private Class Data Pattern",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Private Class Data pattern and how does it prevent accidental mutation of initialization state?",
    answer: "The Private Class Data pattern encapsulates object attributes into a separate data class. The main class holds a private reference to this data object and exposes only getter-based access or controlled mutations, ensuring that properties meant to be immutable after construction cannot be modified even by methods inside the main class.",
    explanation: "In large classes with complex business methods, developers can accidentally reassign initialization variables (like circle radius or database configuration). By moving initialization state into an immutable data container, the main class methods cannot alter those fields even accidentally, protecting class invariants.",
    code: `// Encapsulated Immutable Data Class
class CircleData {
  constructor(
    public readonly radius: number,
    public readonly color: string
  ) {
    Object.freeze(this);
  }
}

// Main class has zero direct access to raw mutable fields
class Circle {
  private data: CircleData;

  constructor(radius: number, color: string) {
    this.data = new CircleData(radius, color);
  }

  public getCircumference(): number {
    return 2 * Math.PI * this.data.radius;
  }

  // Compiler error if any internal method attempts: this.data.radius = 10;
}`,
    recallHint: "Move initialization attributes into a separate immutable data class to prevent accidental mutation.",
    practice: [
      "Protect an immutable ConnectionConfig using Private Class Data",
      "Contrast Private Class Data with TypeScript's 'readonly' modifier"
    ],
    interviewTip: "Mentioning Private Class Data demonstrates defensive programming discipline against subtle accidental reassignment bugs in large enterprise codebases.",
    tags: ["Design Patterns", "Private Class Data", "Immutability", "Structural"]
  }),

  createCard({
    idNum: 36,
    category,
    concept: "Composite View & UI Component Hierarchy",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the Composite View pattern structure modern user interface widget trees (DOM, Flutter, React)?",
    answer: "The Composite View pattern models graphical user interfaces as a tree of visual components. Primitive widgets (Buttons, Labels, Icons) act as leaf nodes, while container elements (Panels, GridRows, FlexLayouts) act as composite nodes. Operations like render(), layout(), and handleEvent() propagate recursively down the hierarchy.",
    explanation: "Every modern UI library (the HTML DOM, Flutter Widget tree, React fiber tree) is a Composite View implementation. When a root Window receives a `repaint()` or `dispatchClick()` event, the composite recursively traverses its children, recalculates child coordinate bounds, and renders the screen uniformly without caring whether a node is an atomic text span or a nested dashboard panel.",
    code: `interface UIWidget {
  render(): string;
  onClick(x: number, y: number): void;
}

// Leaf Component
class TextLabel implements UIWidget {
  constructor(private text: string) {}
  render(): string { return \`<span>\${this.text}</span>\`; }
  onClick(x: number, y: number) { console.log(\`Clicked label: \${this.text}\`); }
}

// Composite Component
class PanelContainer implements UIWidget {
  private children: UIWidget[] = [];

  public add(child: UIWidget) { this.children.push(child); }

  render(): string {
    const inner = this.children.map(c => c.render()).join("");
    return \`<div>\${inner}</div>\`;
  }

  onClick(x: number, y: number): void {
    // Propagate event recursively down visual tree
    this.children.forEach(c => c.onClick(x, y));
  }
}`,
    recallHint: "UI trees where containers and primitive widgets share the same render/event interface.",
    practice: [
      "Trace how event bubbling in the browser DOM relates to the Composite View pattern",
      "Design a recursive layout engine calculating bounding boxes for nested UI cards"
    ],
    interviewTip: "In Frontend and Mobile LLD interviews, mapping the Composite pattern directly to UI component trees and virtual DOMs demonstrates immediate domain fluency.",
    tags: ["UI Architecture", "Composite View", "Frontend LLD", "DOM"]
  })
];
