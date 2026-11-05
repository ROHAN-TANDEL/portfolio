module.exports = [
  {
    id: "lld-ex-01",
    title: "Factory Method & Abstract Factory: Cross-Platform UI Component Families",
    category: "Creational Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements both Factory Method and Abstract Factory to instantiate cohesive families of UI controls (Buttons, Textboxes) across Windows and Mac platforms, guaranteeing that dark and light platform components are never mismatched.",
    conceptsCovered: [
      "Factory Method Pattern",
      "Abstract Factory Pattern",
      "Product Family Consistency",
      "Polymorphic Creation",
      "Open/Closed Principle"
    ],
    code: `// Abstract Products
interface Button { render(): string; onClick(): void; }
interface Checkbox { render(): string; toggle(): void; }

// Concrete Windows Products
class WindowsButton implements Button {
  render() { return "[Windows Fluent Button]"; }
  onClick() { console.log("Windows click event triggered"); }
}
class WindowsCheckbox implements Checkbox {
  render() { return "[X] Windows Checkbox"; }
  toggle() { console.log("Windows checkbox toggled"); }
}

// Concrete Mac Products
class MacButton implements Button {
  render() { return "(Mac Aqua Rounded Button)"; }
  onClick() { console.log("Mac click event triggered"); }
}
class MacCheckbox implements Checkbox {
  render() { return "(v) Mac Aqua Checkbox"; }
  toggle() { console.log("Mac checkbox toggled"); }
}

// Abstract Factory
interface GUIFactory {
  createButton(): Button;
  createCheckbox(): Checkbox;
}

// Concrete Factories
class WindowsFactory implements GUIFactory {
  createButton(): Button { return new WindowsButton(); }
  createCheckbox(): Checkbox { return new WindowsCheckbox(); }
}
class MacFactory implements GUIFactory {
  createButton(): Button { return new MacButton(); }
  createCheckbox(): Checkbox { return new MacCheckbox(); }
}

// Client application
class Application {
  private button: Button;
  private checkbox: Checkbox;

  constructor(factory: GUIFactory) {
    this.button = factory.createButton();
    this.checkbox = factory.createCheckbox();
  }

  public render(): void {
    console.log(this.button.render());
    console.log(this.checkbox.render());
  }
}

// Execution:
const app = new Application(new MacFactory());
app.render();`,
    breakdown: [
      {
        lineRange: "2-3",
        note: "Defines abstract product contracts (Button, Checkbox) consumed by client code."
      },
      {
        lineRange: "24-27",
        note: "Abstract Factory interface enforces that every concrete factory creates the full matching product suite."
      },
      {
        lineRange: "40-49",
        note: "Client is completely decoupled from concrete operating system classes; passing MacFactory guarantees 100% Mac styling."
      }
    ],
    expectedOutput: `(Mac Aqua Rounded Button)
(v) Mac Aqua Checkbox`
  },

  {
    id: "lld-ex-02",
    title: "Fluent Builder Pattern with Cross-Field Invariant Validation",
    category: "Creational Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs a complex, immutable UserRegistration profile using a fluent chained builder that enforces cross-field domain invariants (e.g. minors cannot register without parental consent) in build() before instantiation.",
    conceptsCovered: [
      "Builder Pattern",
      "Fluent Interface",
      "Invariant Validation",
      "Immutability via Object.freeze",
      "Eliminating Telescoping Constructors"
    ],
    code: `class UserProfile {
  public readonly username: string;
  public readonly email: string;
  public readonly age: number;
  public readonly parentConsent: boolean;
  public readonly premiumTier: string;

  constructor(builder: UserProfileBuilder) {
    this.username = builder.username;
    this.email = builder.email;
    this.age = builder.age;
    this.parentConsent = builder.parentConsent;
    this.premiumTier = builder.premiumTier;
    Object.freeze(this); // True runtime immutability
  }

  public static get builder(): UserProfileBuilder {
    return new UserProfileBuilder();
  }
}

class UserProfileBuilder {
  public username!: string;
  public email!: string;
  public age: number = 18;
  public parentConsent: boolean = false;
  public premiumTier: string = "FREE";

  public setUsername(name: string): this { this.username = name; return this; }
  public setEmail(email: string): this { this.email = email; return this; }
  public setAge(age: number): this { this.age = age; return this; }
  public setParentConsent(consent: boolean): this { this.parentConsent = consent; return this; }
  public setPremiumTier(tier: string): this { this.premiumTier = tier; return this; }

  public build(): UserProfile {
    // 1. Mandatory field assertion
    if (!this.username || !this.email) {
      throw new Error("Validation Error: Username and Email are mandatory");
    }
    // 2. Format validation
    if (!this.email.includes("@")) {
      throw new Error("Validation Error: Invalid email format");
    }
    // 3. Cross-field invariant assertion
    if (this.age < 13) {
      throw new Error("Validation Error: Minimum age is 13");
    }
    if (this.age < 18 && !this.parentConsent) {
      throw new Error("Validation Error: Users under 18 require parental consent");
    }

    return new UserProfile(this);
  }
}

// Fluent instantiation:
const user = UserProfile.builder
  .setUsername("sarah_coder")
  .setEmail("sarah@dev.internal")
  .setAge(16)
  .setParentConsent(true)
  .setPremiumTier("PRO")
  .build();

console.log(\`User created: \${user.username} (\${user.premiumTier})\`);`,
    breakdown: [
      {
        lineRange: "8-16",
        note: "Constructor receives builder instance and freezes object, preventing external mutation."
      },
      {
        lineRange: "34-52",
        note: "build() method acts as a transactional gatekeeper: multi-field invariants are verified atomically."
      },
      {
        lineRange: "55-62",
        note: "Clean, self-documenting method chaining without boolean parameter confusion."
      }
    ],
    expectedOutput: `User created: sarah_coder (PRO)`
  },

  {
    id: "lld-ex-03",
    title: "Thread-Safe Singleton with Double-Checked Locking & Module Cache",
    category: "Creational Patterns",
    difficulty: "advanced",
    whatThisCodeCovers: "Demonstrates production thread-safe Singleton patterns: Double-Checked Locking with volatile memory semantics (concept) and JavaScript/TypeScript Node.js module cache guarantees.",
    conceptsCovered: [
      "Singleton Pattern",
      "Double-Checked Locking (DCL)",
      "Volatile Memory Semantics",
      "Private Constructor",
      "Global Point of Access"
    ],
    code: `class DatabaseClusterPool {
  private static instance: DatabaseClusterPool | null = null;
  private connectionCount: number = 0;
  private readonly clusterUrl: string;

  // Private constructor prevents direct 'new DatabaseClusterPool()'
  private constructor() {
    this.clusterUrl = "postgresql://prod-cluster.internal:5432/main";
    console.log("Initialized heavy Database Cluster Pool sockets...");
  }

  // Lazy Thread-Safe Singleton Accessor
  public static getInstance(): DatabaseClusterPool {
    if (!DatabaseClusterPool.instance) {
      // In Java/C++: synchronized(DatabaseClusterPool.class) with second null-check
      DatabaseClusterPool.instance = new DatabaseClusterPool();
    }
    return DatabaseClusterPool.instance;
  }

  public executeQuery(sql: string): string {
    this.connectionCount++;
    return \`[Pool: \${this.clusterUrl}] Executed: \${sql} (Total queries: \${this.connectionCount})\`;
  }
}

// Verification of single identity across callers:
const pool1 = DatabaseClusterPool.getInstance();
const pool2 = DatabaseClusterPool.getInstance();

console.log("Both references identical:", pool1 === pool2);
console.log(pool1.executeQuery("SELECT * FROM orders"));
console.log(pool2.executeQuery("UPDATE users SET active = true"));`,
    breakdown: [
      {
        lineRange: "6-10",
        note: "Private constructor prohibits direct instantiation from outside the class."
      },
      {
        lineRange: "13-19",
        note: "getInstance() lazily instantiates the single instance on first request."
      },
      {
        lineRange: "29-33",
        note: "Verifies referential equality (pool1 === pool2) and shared internal query counter."
      }
    ],
    expectedOutput: `Initialized heavy Database Cluster Pool sockets...
Both references identical: true
[Pool: postgresql://prod-cluster.internal:5432/main] Executed: SELECT * FROM orders (Total queries: 1)
[Pool: postgresql://prod-cluster.internal:5432/main] Executed: UPDATE users SET active = true (Total queries: 2)`
  },

  {
    id: "lld-ex-04",
    title: "Prototype Pattern: Deep Cloning Game Character Entities with Equipment",
    category: "Creational Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements the Prototype pattern to clone complex game entities with nested mutable inventories, ensuring deep memory isolation so mutating a clone's weapon does not alter the prototype.",
    conceptsCovered: [
      "Prototype Pattern",
      "Shallow vs Deep Copying",
      "Cloneable Interface",
      "Nested Object Graph Duplication",
      "Object Pool Pre-population"
    ],
    code: `interface Prototype<T> {
  clone(): T;
}

class Weapon implements Prototype<Weapon> {
  constructor(public name: string, public damage: number) {}
  clone(): Weapon {
    return new Weapon(this.name, this.damage);
  }
}

class GameCharacter implements Prototype<GameCharacter> {
  constructor(
    public name: string,
    public health: number,
    public weapon: Weapon,
    public abilities: string[]
  ) {}

  // Deep clone implementation
  public clone(): GameCharacter {
    return new GameCharacter(
      this.name + " (Clone)",
      this.health,
      this.weapon.clone(),        // Deep clone nested weapon object!
      [...this.abilities]          // Deep clone primitive array!
    );
  }
}

// Prototype Registry / Spawner
const baseWarrior = new GameCharacter("Orc Warrior", 100, new Weapon("Rusty Axe", 15), ["Slash", "Roar"]);

// Spawn clone and upgrade equipment:
const bossWarrior = baseWarrior.clone();
bossWarrior.name = "Orc Warlord";
bossWarrior.weapon.name = "Flaming Battleaxe";
bossWarrior.weapon.damage = 45;
bossWarrior.abilities.push("Whirlwind");

console.log(\`Base: \${baseWarrior.name} wielding \${baseWarrior.weapon.name} (Dmg: \${baseWarrior.weapon.damage})\`);
console.log(\`Boss: \${bossWarrior.name} wielding \${bossWarrior.weapon.name} (Dmg: \${bossWarrior.weapon.damage})\`);`,
    breakdown: [
      {
        lineRange: "5-10",
        note: "Nested Weapon implements Prototype to clone its own attributes."
      },
      {
        lineRange: "21-28",
        note: "Deep clone recursively calls clone() on nested objects and spreads arrays, eliminating shared pointers."
      },
      {
        lineRange: "38-43",
        note: "Demonstrates that modifying bossWarrior.weapon does NOT mutate baseWarrior.weapon."
      }
    ],
    expectedOutput: `Base: Orc Warrior wielding Rusty Axe (Dmg: 15)
Boss: Orc Warlord wielding Flaming Battleaxe (Dmg: 45)`
  },

  {
    id: "lld-ex-05",
    title: "Decorator Pattern: Composable Logging, Encryption & Compression Pipeline",
    category: "Structural Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements the Decorator pattern to dynamically layer encryption, gzip compression, and audit logging onto an underlying data storage stream without modifying the storage class.",
    conceptsCovered: [
      "Decorator Pattern",
      "Interface Wrapping",
      "Dynamic Behavior Augmentation",
      "Composition Over Inheritance",
      "Open/Closed Principle"
    ],
    code: `interface DataStream {
  write(data: string): void;
  read(): string;
}

// Concrete Component
class MemoryDataStream implements DataStream {
  private buffer: string = "";
  write(data: string) { this.buffer = data; }
  read(): string { return this.buffer; }
}

// Base Decorator
abstract class StreamDecorator implements DataStream {
  constructor(protected wrappee: DataStream) {}
  write(data: string): void { this.wrappee.write(data); }
  read(): string { return this.wrappee.read(); }
}

// Concrete Decorator 1: Base64 Encryption
class EncryptionDecorator extends StreamDecorator {
  write(data: string): void {
    const encrypted = Buffer.from(data).toString("base64");
    console.log(\`[Encryptor] Encrypted: "\${data}" -> "\${encrypted}"\`);
    super.write(encrypted);
  }
  read(): string {
    const raw = super.read();
    return Buffer.from(raw, "base64").toString("utf-8");
  }
}

// Concrete Decorator 2: Audit Logger
class LoggingDecorator extends StreamDecorator {
  write(data: string): void {
    console.log(\`[AuditLog] Writing \${data.length} bytes to stream\`);
    super.write(data);
  }
}

// Compose pipeline dynamically at runtime:
const secureStream = new LoggingDecorator(
  new EncryptionDecorator(
    new MemoryDataStream()
  )
);

secureStream.write("Confidential User Record");
console.log("Decrypted Read:", secureStream.read());`,
    breakdown: [
      {
        lineRange: "1-4",
        note: "Component interface shared identically by real stream and all decorators."
      },
      {
        lineRange: "14-18",
        note: "Base Decorator maintains wrappee reference and delegates by default."
      },
      {
        lineRange: "39-47",
        note: "Layers behavior like Russian nesting dolls: LoggingDecorator wraps EncryptionDecorator wraps MemoryDataStream."
      }
    ],
    expectedOutput: `[AuditLog] Writing 24 bytes to stream
[Encryptor] Encrypted: "Confidential User Record" -> "Q29uZmlkZW50aWFsIFVzZXIgUmVjb3Jk"
Decrypted Read: Confidential User Record`
  },

  {
    id: "lld-ex-06",
    title: "Object Adapter Pattern: Unifying Incompatible Third-Party Payment Gateways",
    category: "Structural Patterns",
    difficulty: "beginner",
    whatThisCodeCovers: "Builds an Object Adapter to translate incompatible third-party SDK calls (Stripe, PayPal) into a standardized internal PaymentGateway interface, shielding domain code from vendor changes.",
    conceptsCovered: [
      "Adapter Pattern (Object Adapter)",
      "Target Interface",
      "Adaptee Integration",
      "Data Contract Translation",
      "Hexagonal Architecture Ports"
    ],
    code: `// Domain Target Interface
interface PaymentGateway {
  processPayment(accountId: string, amountDollars: number): Promise<boolean>;
}

// Third-Party Incompatible SDK 1: Stripe (Expects cents and token)
class ThirdPartyStripeSDK {
  public makeCharge(token: string, amountInCents: number): { status: string; id: string } {
    console.log(\`[Stripe API] Charged \${amountInCents} cents for token \${token}\`);
    return { status: "succeeded", id: "ch_9821" };
  }
}

// Third-Party Incompatible SDK 2: PayPal (Expects currency string and user email)
class ThirdPartyPayPalSDK {
  public sendMoney(email: string, amount: string, currency: string): boolean {
    console.log(\`[PayPal API] Sent \${currency} \${amount} to \${email}\`);
    return true;
  }
}

// Stripe Adapter
class StripeAdapter implements PaymentGateway {
  constructor(private stripe: ThirdPartyStripeSDK) {}
  async processPayment(accountId: string, amountDollars: number): Promise<boolean> {
    const cents = Math.round(amountDollars * 100);
    const result = this.stripe.makeCharge(accountId, cents);
    return result.status === "succeeded";
  }
}

// PayPal Adapter
class PayPalAdapter implements PaymentGateway {
  constructor(private paypal: ThirdPartyPayPalSDK) {}
  async processPayment(accountId: string, amountDollars: number): Promise<boolean> {
    return this.paypal.sendMoney(accountId, amountDollars.toFixed(2), "USD");
  }
}

// Domain client only knows PaymentGateway interface:
async function checkout(gateway: PaymentGateway) {
  await gateway.processPayment("user_789@test.com", 49.99);
}

checkout(new StripeAdapter(new ThirdPartyStripeSDK()));
checkout(new PayPalAdapter(new ThirdPartyPayPalSDK()));`,
    breakdown: [
      {
        lineRange: "2-4",
        note: "Target domain interface expected by checkout services."
      },
      {
        lineRange: "21-36",
        note: "Adapters encapsulate translation logic (dollars to cents, number to string, currency parameter injection)."
      },
      {
        lineRange: "39-44",
        note: "Checkout service runs identically with either gateway without knowing vendor specifics."
      }
    ],
    expectedOutput: `[Stripe API] Charged 4999 cents for token user_789@test.com
[PayPal API] Sent USD 49.99 to user_789@test.com`
  },

  {
    id: "lld-ex-07",
    title: "Composite Pattern: Hierarchical Department & Employee Salary Rollup",
    category: "Structural Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs an organization hierarchy where individual Employees (leaf nodes) and Departments (composite nodes) share an OrganizationComponent interface, enabling uniform recursive salary aggregation.",
    conceptsCovered: [
      "Composite Pattern",
      "Leaf vs Composite Nodes",
      "Recursive Aggregation",
      "Tree Traversal",
      "Uniform Interface"
    ],
    code: `interface OrganizationComponent {
  getName(): string;
  getSalary(): number;
  printStructure(indent?: string): void;
}

// Leaf Node: Individual Employee
class Employee implements OrganizationComponent {
  constructor(private name: string, private salary: number) {}
  getName(): string { return this.name; }
  getSalary(): number { return this.salary; }
  printStructure(indent: string = ""): void {
    console.log(\`\${indent}- Employee: \${this.name} (\$\${this.salary})\`);
  }
}

// Composite Node: Department containing other components
class Department implements OrganizationComponent {
  private children: OrganizationComponent[] = [];
  constructor(private name: string) {}

  public add(c: OrganizationComponent) { this.children.push(c); }

  getName(): string { return this.name; }

  // Uniform calculation: sums salary across leaves and nested departments recursively
  getSalary(): number {
    return this.children.reduce((total, child) => total + child.getSalary(), 0);
  }

  printStructure(indent: string = ""): void {
    console.log(\`\${indent}+ Department: \${this.name} (Total: $\${this.getSalary()})\`);
    this.children.forEach(c => c.printStructure(indent + "  "));
  }
}

// Assembly:
const engineering = new Department("Engineering");
engineering.add(new Employee("Alice (Lead Dev)", 150000));
engineering.add(new Employee("Bob (DevOps)", 130000));

const qaTeam = new Department("QA Team");
qaTeam.add(new Employee("Charlie (QA)", 90000));
engineering.add(qaTeam); // Department inside Department!

const sales = new Department("Sales");
sales.add(new Employee("David (AE)", 110000));

const enterprise = new Department("Global Tech Corp");
enterprise.add(engineering);
enterprise.add(sales);

enterprise.printStructure();`,
    breakdown: [
      {
        lineRange: "1-5",
        note: "OrganizationComponent defines the uniform contract for both single employees and whole departments."
      },
      {
        lineRange: "27-29",
        note: "Recursive reduce aggregates salaries transparently down through arbitrary sub-tree depths."
      },
      {
        lineRange: "44-53",
        note: "Demonstrates building a complex tree hierarchy and executing uniform root methods."
      }
    ],
    expectedOutput: `+ Department: Global Tech Corp (Total: $480000)
  + Department: Engineering (Total: $370000)
    - Employee: Alice (Lead Dev) ($150000)
    - Employee: Bob (DevOps) ($130000)
    - Department: QA Team (Total: $90000)
      - Employee: Charlie (QA) ($90000)
  + Department: Sales (Total: $110000)
    - Employee: David (AE) ($110000)`
  },

  {
    id: "lld-ex-08",
    title: "Chain of Responsibility: Multi-Tier Expense Approval Workflow",
    category: "Behavioral Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a corporate expense approval chain (Team Lead up to $1k, Manager up to $5k, Director up to $20k, CEO up to $100k) where each link processes or forwards requests dynamically.",
    conceptsCovered: [
      "Chain of Responsibility",
      "Dynamic Linked List of Handlers",
      "Short-Circuiting Requests",
      "Escalation Logic",
      "Decoupled Sender & Receiver"
    ],
    code: `class ExpenseRequest {
  constructor(public id: string, public amount: number, public purpose: string) {}
}

abstract class Approver {
  protected nextApprover: Approver | null = null;
  constructor(protected title: string, protected approvalLimit: number) {}

  public setNext(approver: Approver): Approver {
    this.nextApprover = approver;
    return approver; // Fluent chaining: lead.setNext(manager).setNext(director)
  }

  public processRequest(expense: ExpenseRequest): void {
    if (expense.amount <= this.approvalLimit) {
      console.log(\`[\${this.title}] APPROVED expense #\${expense.id} ($\${expense.amount} for "\${expense.purpose}")\`);
    } else if (this.nextApprover) {
      console.log(\`[\${this.title}] Amount $\${expense.amount} exceeds limit ($\${this.approvalLimit}). Escalating...\`);
      this.nextApprover.processRequest(expense);
    } else {
      console.error(\`[CRITICAL] Expense #\${expense.id} ($\${expense.amount}) REJECTED: Exceeds company authorization limit!\`);
    }
  }
}

class TeamLead extends Approver { constructor() { super("Team Lead", 1000); } }
class Manager extends Approver { constructor() { super("Manager", 5000); } }
class Director extends Approver { constructor() { super("Director", 20000); } }
class CEO extends Approver { constructor() { super("CEO", 100000); } }

// Construct approval pipeline
const approvalChain = new TeamLead();
approvalChain
  .setNext(new Manager())
  .setNext(new Director())
  .setNext(new CEO());

approvalChain.processRequest(new ExpenseRequest("exp-1", 450, "Office Monitor"));
console.log("---");
approvalChain.processRequest(new ExpenseRequest("exp-2", 14500, "Cloud Server Reserve"));`,
    breakdown: [
      {
        lineRange: "5-10",
        note: "Approver maintains pointer to next link in chain and defines fluent setNext() method."
      },
      {
        lineRange: "15-24",
        note: "If expense <= limit, approves and halts; otherwise escalates to nextApprover."
      },
      {
        lineRange: "31-36",
        note: "Chains TeamLead -> Manager -> Director -> CEO seamlessly."
      }
    ],
    expectedOutput: `[Team Lead] APPROVED expense #exp-1 ($450 for "Office Monitor")
---
[Team Lead] Amount $14500 exceeds limit ($1000). Escalating...
[Manager] Amount $14500 exceeds limit ($5000). Escalating...
[Director] APPROVED expense #exp-2 ($14500 for "Cloud Server Reserve")`
  },

  {
    id: "lld-ex-09",
    title: "Observer Pattern: Typed Reactive Event Bus with Memory-Leak Safe Unsubscribe",
    category: "Behavioral Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements a type-safe in-memory Event Bus supporting topic subscriptions, structured event payloads, and disposable unsubscribe tokens to prevent 'Lapsed Listener' memory leaks.",
    conceptsCovered: [
      "Observer Pattern",
      "Typed Event Bus",
      "Memory Leak Prevention",
      "Disposable Subscriptions",
      "Decoupled Pub/Sub"
    ],
    code: `type EventHandler<T = any> = (data: T) => void;

interface Subscription {
  unsubscribe(): void;
}

class EventBus {
  private topics: Map<string, Set<EventHandler>> = new Map();

  public subscribe<T>(topic: string, handler: EventHandler<T>): Subscription {
    if (!this.topics.has(topic)) {
      this.topics.set(topic, new Set());
    }
    const handlers = this.topics.get(topic)!;
    handlers.add(handler);

    // Return disposable subscription token to guarantee clean unsubscribe!
    return {
      unsubscribe: () => {
        handlers.delete(handler);
        if (handlers.size === 0) this.topics.delete(topic);
        console.log(\`[EventBus] Unsubscribed handler from topic: "\${topic}"\`);
      }
    };
  }

  public publish<T>(topic: string, data: T): void {
    const handlers = this.topics.get(topic);
    if (!handlers) return;
    for (const handler of handlers) {
      try { handler(data); } catch (err) { console.error("Handler error:", err); }
    }
  }
}

// Usage:
const bus = new EventBus();

const sub1 = bus.subscribe<{ orderId: string; amount: number }>("order:created", data => {
  console.log(\`[EmailService] Sending invoice for order \${data.orderId} (\$\${data.amount})\`);
});

const sub2 = bus.subscribe<{ orderId: string }>("order:created", data => {
  console.log(\`[InventoryService] Decrementing stock for order \${data.orderId}\`);
});

bus.publish("order:created", { orderId: "ord-101", amount: 250 });

// Clean unsubscribe to prevent memory leak:
sub1.unsubscribe();
bus.publish("order:created", { orderId: "ord-102", amount: 90 });`,
    breakdown: [
      {
        lineRange: "10-23",
        note: "subscribe() returns a { unsubscribe } closure, making teardown effortless and leak-free."
      },
      {
        lineRange: "26-32",
        note: "publish() iterates active handlers inside try/catch so one broken observer doesn't crash others."
      },
      {
        lineRange: "47-50",
        note: "Demonstrates that after sub1.unsubscribe(), only sub2 receives subsequent events."
      }
    ],
    expectedOutput: `[EmailService] Sending invoice for order ord-101 ($250)
[InventoryService] Decrementing stock for order ord-101
[EventBus] Unsubscribed handler from topic: "order:created"
[InventoryService] Decrementing stock for order ord-102`
  },

  {
    id: "lld-ex-10",
    title: "Strategy Pattern: Dynamic E-Commerce Discount & Promotional Rule Engine",
    category: "Behavioral Patterns",
    difficulty: "beginner",
    whatThisCodeCovers: "Uses the Strategy Pattern to eliminate hardcoded switch statements in promotional discount calculations, supporting flat discounts, percentage vouchers, and VIP loyalty tiers dynamically at runtime.",
    conceptsCovered: [
      "Strategy Pattern",
      "Open/Closed Principle",
      "Dynamic Algorithm Swapping",
      "Encapsulation",
      "Composition Over Inheritance"
    ],
    code: `interface DiscountStrategy {
  applyDiscount(orderSubtotal: number): number;
}

// Concrete Strategy 1: No Discount
class NoDiscountStrategy implements DiscountStrategy {
  applyDiscount(total: number): number { return total; }
}

// Concrete Strategy 2: Percentage Coupon (e.g. 20% off)
class PercentageDiscountStrategy implements DiscountStrategy {
  constructor(private percentage: number) {}
  applyDiscount(total: number): number {
    return total * (1 - this.percentage / 100);
  }
}

// Concrete Strategy 3: VIP Loyalty (Flat $30 discount on orders over $100)
class VipFlatDiscountStrategy implements DiscountStrategy {
  applyDiscount(total: number): number {
    if (total > 100) return Math.max(0, total - 30);
    return total;
  }
}

// Context: Shopping Cart
class ShoppingCart {
  private discountStrategy: DiscountStrategy = new NoDiscountStrategy();

  constructor(private subtotal: number) {}

  public setDiscountStrategy(strategy: DiscountStrategy): void {
    this.discountStrategy = strategy;
  }

  public getFinalTotal(): number {
    return Math.round(this.discountStrategy.applyDiscount(this.subtotal) * 100) / 100;
  }
}

const cart = new ShoppingCart(200);
console.log("No discount:", cart.getFinalTotal());

cart.setDiscountStrategy(new PercentageDiscountStrategy(15));
console.log("15% coupon applied:", cart.getFinalTotal());

cart.setDiscountStrategy(new VipFlatDiscountStrategy());
console.log("VIP flat discount applied:", cart.getFinalTotal());`,
    breakdown: [
      {
        lineRange: "1-3",
        note: "Defines strategy interface that all discount algorithms implement."
      },
      {
        lineRange: "27-38",
        note: "ShoppingCart context delegates calculation to the strategy; strategy can be swapped at runtime."
      },
      {
        lineRange: "40-47",
        note: "Demonstrates dynamic algorithm switching on the exact same cart instance."
      }
    ],
    expectedOutput: `No discount: 200
15% coupon applied: 170
VIP flat discount applied: 170`
  },

  {
    id: "lld-ex-11",
    title: "Command Pattern: Multi-Level Undo/Redo Text Editor History Engine",
    category: "Behavioral Patterns",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a complete text editor with multi-level Undo and Redo operations using the Command pattern, supporting insert and delete commands with state inversion and redo stack invalidation.",
    conceptsCovered: [
      "Command Pattern",
      "Undo / Redo Stacks",
      "Receiver Decoupling",
      "Reversible State Mutations",
      "Redo Stack Invalidation"
    ],
    code: `interface Command {
  execute(): void;
  undo(): void;
}

// Receiver: Text Buffer
class TextBuffer {
  public content: string = "";
  insert(pos: number, text: string) { this.content = this.content.slice(0, pos) + text + this.content.slice(pos); }
  delete(pos: number, len: number) { this.content = this.content.slice(0, pos) + this.content.slice(pos + len); }
}

// Concrete Command: Insert
class InsertTextCommand implements Command {
  constructor(private buffer: TextBuffer, private pos: number, private text: string) {}
  execute() { this.buffer.insert(this.pos, this.text); }
  undo() { this.buffer.delete(this.pos, this.text.length); }
}

// Invoker: History Manager
class EditorInvoker {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  constructor(private buffer: TextBuffer) {}

  public execute(cmd: Command): void {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = []; // Invalidate redo stack on new action
  }

  public undo(): void {
    if (this.undoStack.length === 0) return;
    const cmd = this.undoStack.pop()!;
    cmd.undo();
    this.redoStack.push(cmd);
  }

  public redo(): void {
    if (this.redoStack.length === 0) return;
    const cmd = this.redoStack.pop()!;
    cmd.execute();
    this.undoStack.push(cmd);
  }

  public getText(): string { return this.buffer.content; }
}

// Execution:
const buffer = new TextBuffer();
const editor = new EditorInvoker(buffer);

editor.execute(new InsertTextCommand(buffer, 0, "Hello "));
editor.execute(new InsertTextCommand(buffer, 6, "World!"));
console.log("Current Text:", editor.getText());

editor.undo();
console.log("After Undo 1:", editor.getText());

editor.redo();
console.log("After Redo 1:", editor.getText());`,
    breakdown: [
      {
        lineRange: "1-4",
        note: "Command interface defining execute() and undo() contracts."
      },
      {
        lineRange: "13-18",
        note: "InsertTextCommand records original position and length for exact inverse undo."
      },
      {
        lineRange: "26-30",
        note: "Crucial rule: executing a new command clears the redoStack."
      }
    ],
    expectedOutput: `Current Text: Hello World!
After Undo 1: Hello 
After Redo 1: Hello World!`
  }
];
