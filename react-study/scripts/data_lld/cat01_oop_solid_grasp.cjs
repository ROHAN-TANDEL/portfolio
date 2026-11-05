const { createCard } = require('../lld_builder_helper.cjs');

const category = "OOP Foundations, SOLID & GRASP";

module.exports = [
  createCard({
    idNum: 1,
    category,
    concept: "Encapsulation & Information Hiding",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is Encapsulation and how does Information Hiding protect domain model integrity in Low-Level Design?",
    answer: "Encapsulation bundles data attributes and the methods operating on that data into a cohesive class, while information hiding restricts direct external access to internal representation using access modifiers (private/protected). It enforces domain invariants through controlled public methods rather than public property mutation.",
    explanation: "Encapsulation ensures that an object maintains strict control over its own state. Without encapsulation, external callers can mutate state arbitrarily (e.g. Setting an account balance to a negative number or corrupting order status transitions). By making state private and exposing validated domain methods (like deposit() or withdraw()), the class guarantees its invariants remain unbroken at all times.",
    code: `// Flawed: Exposed state violates encapsulation
class BankAccountAnemic {
  public balance: number = 0;
}

// Hardened: Encapsulated domain model enforces business invariants
class BankAccount {
  private _balance: number;

  constructor(initialBalance: number) {
    if (initialBalance < 0) throw new Error("Initial balance cannot be negative");
    this._balance = initialBalance;
  }

  public deposit(amount: number): void {
    if (amount <= 0) throw new Error("Deposit amount must be positive");
    this._balance += amount;
  }

  public withdraw(amount: number): void {
    if (amount <= 0) throw new Error("Withdrawal amount must be positive");
    if (amount > this._balance) throw new Error("Insufficient funds");
    this._balance -= amount;
  }

  public get balance(): number {
    return this._balance; // Read-only projection
  }
}`,
    recallHint: "Bundle state + behavior together; keep state private and enforce invariants via public methods.",
    practice: [
      "Refactor an anemic Order model with public status into an encapsulated state-validated class",
      "Explain why getters that return mutable array references break encapsulation"
    ],
    interviewTip: "In LLD interviews, never expose raw public setters or mutable internal collections (like ArrayList/Set) directly. Always return defensive copies or unmodifiable views.",
    tags: ["OOP", "Encapsulation", "Information Hiding", "Domain Invariants"]
  }),

  createCard({
    idNum: 2,
    category,
    concept: "Polymorphism: Static vs Dynamic Dispatch",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Polymorphism work in object-oriented systems, and what is the difference between Static (Compile-time) and Dynamic (Runtime) dispatch?",
    answer: "Polymorphism allows objects of different concrete types to be manipulated through a common interface. Static dispatch resolves method calls at compile time via method overloading or generics; dynamic dispatch resolves method calls at runtime via virtual method tables (vtables) based on the concrete instance type.",
    explanation: "Dynamic polymorphism is the engine behind Open/Closed Principle and the Strategy pattern. When client code invokes paymentMethod.pay(amount), the runtime inspects the actual instance (CreditCard, PayPal, UPI) and dispatches to the overridden method. This eliminates sprawling switch-case statements and enables hot-pluggable behaviors.",
    code: `// Common abstraction interface
interface PaymentProcessor {
  processPayment(amount: number): Promise<boolean>;
}

class CreditCardProcessor implements PaymentProcessor {
  async processPayment(amount: number): Promise<boolean> {
    console.log(\`Charging \${amount} via Credit Card Gateway\`);
    return true;
  }
}

class UpiProcessor implements PaymentProcessor {
  async processPayment(amount: number): Promise<boolean> {
    console.log(\`Executing instant UPI transfer for \${amount}\`);
    return true;
  }
}

// Polymorphic Client: Zero coupling to concrete payment providers
class CheckoutService {
  constructor(private readonly processor: PaymentProcessor) {}

  async checkout(cartTotal: number): Promise<void> {
    const success = await this.processor.processPayment(cartTotal);
    if (!success) throw new Error("Payment transaction failed");
  }
}`,
    recallHint: "Same interface, different implementations resolved dynamically at runtime via vtable.",
    practice: [
      "Replace an if-else payment type switcher with a polymorphic PaymentProcessor hierarchy",
      "Explain how C++ vptr/vtable mechanism executes dynamic dispatch under the hood"
    ],
    interviewTip: "Interviewers look for whether you replace giant if/else or switch blocks on type enums with polymorphic strategies and factory lookups.",
    tags: ["OOP", "Polymorphism", "Dynamic Dispatch", "Interfaces"]
  }),

  createCard({
    idNum: 3,
    category,
    concept: "Composition Over Inheritance",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why does clean Low-Level Design favor Object Composition over Class Inheritance ('Favor Has-A over Is-A')?",
    answer: "Inheritance creates tight compile-time coupling, exposes the base class internal state (the fragile base class problem), and leads to combinatorial class explosions when behaviors vary along multiple orthogonal dimensions. Composition models behavior by assembling independent components via interfaces at runtime.",
    explanation: "Inheritance is white-box reuse (subclasses know parent implementation details). If parent internals change, subclasses break unpredictably. With composition (black-box reuse), objects hold references to interface-bound collaborators. Behaviors can be swapped dynamically at runtime without recompilation or class hierarchy proliferation.",
    code: `// Anti-pattern: Combinatorial class explosion via inheritance
// class Vehicle {}
// class FlyingVehicle extends Vehicle {}
// class ElectricFlyingVehicle extends FlyingVehicle {}
// class GasFlyingVehicle extends FlyingVehicle {} ...

// Production Design: Composition with pluggable strategies
interface Engine {
  start(): void;
}
interface FlyBehavior {
  fly(): void;
}

class ElectricEngine implements Engine {
  start() { console.log("Humming electric motor started"); }
}
class JetWings implements FlyBehavior {
  fly() { console.log("Soaring with jet propulsion"); }
}

class Aircraft {
  constructor(
    private engine: Engine,
    private flyBehavior: FlyBehavior
  ) {}

  public operate(): void {
    this.engine.start();
    this.flyBehavior.fly();
  }

  // Runtime swappable behavior!
  public setEngine(newEngine: Engine): void {
    this.engine = newEngine;
  }
}`,
    recallHint: "Has-a allows runtime dynamic swapping; is-a locks you into static compile-time hierarchy.",
    practice: [
      "Convert a Monster hierarchy with Multiple Inheritance into component-based composition",
      "Identify the Fragile Base Class problem in an inherited UI Widget hierarchy"
    ],
    interviewTip: "When asked to model entities (e.g. Robot, Character, Vehicle), resist the temptation to build deep inheritance trees. Use component composition and strategy interfaces.",
    tags: ["OOP", "Composition", "Inheritance", "Design Fundamentals"]
  }),

  createCard({
    idNum: 4,
    category,
    concept: "Single Responsibility Principle (SRP)",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the Single Responsibility Principle (SRP) and what defines a 'reason to change'?",
    answer: "SRP states that a class should have one, and only one, reason to change. That 'reason to change' corresponds to a single actor or stakeholder group whose business requirements drive modifications to the class.",
    explanation: "If a class handles database persistence, business calculation, and PDF report formatting, it serves three different actors: the DBA, the financial analyst, and the reporting UI team. A change requested by one stakeholder risks breaking functionality relied upon by the others. SRP splits these concerns into separate classes.",
    code: `// Violation: God class with 3 reasons to change (Business rules, DB, Formatting)
class InvoiceGodClass {
  calculateTotal() { /* business math */ }
  saveToDatabase() { /* SQL queries */ }
  renderPdf() { /* PDF rendering logic */ }
}

// Compliant: Isolated single responsibilities
class InvoiceCalculator {
  calculateSubtotal(items: { price: number; qty: number }[]): number {
    return items.reduce((acc, item) => acc + item.price * item.qty, 0);
  }
}

class InvoiceRepository {
  async save(invoice: InvoiceCalculator): Promise<void> {
    // Isolated database persistence
  }
}

class InvoicePdfRenderer {
  render(invoice: InvoiceCalculator): Buffer {
    // Isolated visual rendering
    return Buffer.from("");
  }
}`,
    recallHint: "A class should have only one reason to change, bound to a single business stakeholder.",
    practice: [
      "Decompose a monolithic UserManagementService that handles hashing, email sending, and DB writes",
      "Trace how SRP directly lowers merge conflicts across multi-developer teams"
    ],
    interviewTip: "In machine coding interviews, avoid creating monolithic 'Manager' or 'Helper' classes that mix domain validation, storage, and I/O formatting.",
    tags: ["SOLID", "SRP", "Clean Architecture"]
  }),

  createCard({
    idNum: 5,
    category,
    concept: "Open/Closed Principle (OCP)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the Open/Closed Principle (OCP) enable adding new business features without editing existing code?",
    answer: "OCP states that software entities (classes, modules, functions) should be open for extension, but closed for modification. New features or algorithms should be introduced by writing new classes implementing an abstraction, rather than modifying and re-testing verified production code.",
    explanation: "When new requirements arise (such as supporting a new tax calculation rule or notification provider), modifying an existing switch statement introduces regressions and requires re-testing the entire file. With OCP, you define an abstraction interface (TaxStrategy or NotificationChannel) and inject new concrete implementations via Polymorphism and Dependency Injection.",
    code: `// Violation: Every new country requires editing this class and re-testing all others
class TaxCalculatorViolating {
  calculate(amount: number, country: string): number {
    if (country === "US") return amount * 0.08;
    if (country === "UK") return amount * 0.20;
    if (country === "IN") return amount * 0.18; // Modified existing code!
    throw new Error("Unsupported country");
  }
}

// Compliant: Open for extension via polymorphism, closed for modification
interface TaxStrategy {
  calculateTax(amount: number): number;
}

class UsTaxStrategy implements TaxStrategy {
  calculateTax(amount: number): number { return amount * 0.08; }
}
class UkTaxStrategy implements TaxStrategy {
  calculateTax(amount: number): number { return amount * 0.20; }
}
class IndiaGstStrategy implements TaxStrategy {
  calculateTax(amount: number): number { return amount * 0.18; } // Added new class only!
}

class TaxContext {
  constructor(private strategy: TaxStrategy) {}
  public compute(amount: number): number {
    return this.strategy.calculateTax(amount);
  }
}`,
    recallHint: "Open for extension (add new classes), closed for modification (don't touch working code).",
    practice: [
      "Refactor a multi-format file exporter (CSV, JSON, XML) to comply with OCP",
      "Design a notification engine where adding WhatsApp doesn't alter Email/SMS code"
    ],
    interviewTip: "Highlight OCP when designing rule engines, discount calculators, payment systems, or notification dispatchers.",
    tags: ["SOLID", "OCP", "Strategy Pattern", "Extensibility"]
  }),

  createCard({
    idNum: 6,
    category,
    concept: "Liskov Substitution Principle (LSP)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the Liskov Substitution Principle (LSP) and how does the classic Rectangle-Square problem violate it?",
    answer: "LSP states that if S is a subtype of T, then objects of type T may be replaced with objects of type S without altering any of the desirable properties of the program (correctness, invariants). Subtypes must uphold the pre-conditions, post-conditions, and behavioral contracts of their parent types.",
    explanation: "In mathematics, a Square is a Rectangle. However, in OOP, if Rectangle allows width and height to be set independently, Square cannot inherit from it without breaking the contract (setting width also modifies height). Code expecting a general Rectangle will fail assertions when passed a Square. Subtypes cannot strengthen preconditions or weaken postconditions.",
    code: `// Violation: Classic Rectangle-Square contract breakage
class Rectangle {
  protected _width: number = 0;
  protected _height: number = 0;

  setWidth(w: number) { this._width = w; }
  setHeight(h: number) { this._height = h; }
  getArea() { return this._width * this._height; }
}

class Square extends Rectangle {
  setWidth(w: number) { this._width = w; this._height = w; } // Breaks independent dimension contract!
  setHeight(h: number) { this._width = h; this._height = h; }
}

function verifyRectangleArea(rect: Rectangle) {
  rect.setWidth(5);
  rect.setHeight(4);
  // Expected area: 20. But if rect is Square, area is 16! Test fails!
  if (rect.getArea() !== 20) {
    throw new Error("LSP Contract Violation Detected!");
  }
}

// Compliant: Model immutable shapes with shared abstraction
interface Shape {
  getArea(): number;
}
class ImmutableRectangle implements Shape {
  constructor(private readonly width: number, private readonly height: number) {}
  getArea(): number { return this.width * this.height; }
}
class ImmutableSquare implements Shape {
  constructor(private readonly side: number) {}
  getArea(): number { return this.side * this.side; }
}`,
    recallHint: "Subtypes must be completely substitutable for their base types without breaking caller expectations.",
    practice: [
      "Explain why ReadOnlyCollection inheriting from Collection and throwing UnsupportedOperationException breaks LSP",
      "Audit an Animal hierarchy where Ostrich extends Bird but throws in fly()"
    ],
    interviewTip: "If a subclass overrides a parent method by throwing 'NotSupportedException' or leaving it empty, it is an immediate LSP violation. Separate into narrower interfaces.",
    tags: ["SOLID", "LSP", "Subtyping", "Behavioral Contracts"]
  }),

  createCard({
    idNum: 7,
    category,
    concept: "Interface Segregation Principle (ISP)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Interface Segregation Principle (ISP) and how does it prevent 'fat' interface pollution?",
    answer: "ISP states that clients should not be forced to depend on interfaces they do not use. Instead of creating large, monolithic ('fat') interfaces with dozens of methods, create small, focused, role-specific interfaces that match exact client needs.",
    explanation: "A fat interface like Machine with print(), scan(), fax(), and staple() forces a simple SimplePrinter to implement methods it cannot physically support, forcing dummy implementations or runtime exceptions. ISP splits this into Printable, Scannable, and Faxable. Clients only depend on the capability they require.",
    code: `// Violation: Fat interface forcing unneeded dependencies
interface MultiFunctionDevice {
  print(doc: string): void;
  scan(): string;
  fax(doc: string): void;
}

// Compliant: Segregated role-specific interfaces
interface Printer {
  print(doc: string): void;
}
interface Scanner {
  scan(): string;
}
interface Fax {
  fax(doc: string): void;
}

// Simple device implements only what it supports
class BasicLaserPrinter implements Printer {
  print(doc: string): void {
    console.log(\`Printing: \${doc}\`);
  }
}

// Enterprise MFP composes multiple role interfaces
class EnterpriseAIO implements Printer, Scanner, Fax {
  print(doc: string): void { console.log("Printing high res"); }
  scan(): string { return "Scanned image data"; }
  fax(doc: string): void { console.log("Transmitting fax"); }
}`,
    recallHint: "Many client-specific interfaces are much better than one general-purpose interface.",
    practice: [
      "Decompose a bloated Worker interface with work(), eat(), sleep() for RobotWorker",
      "Design ISP-compliant repository interfaces (ReadOnlyRepository vs WritableRepository)"
    ],
    interviewTip: "Keep interfaces lean. In languages like Go or TypeScript, single-method interfaces (e.g. Reader, Writer, Formatter) are the gold standard of modularity.",
    tags: ["SOLID", "ISP", "Interface Design", "Decoupling"]
  }),

  createCard({
    idNum: 8,
    category,
    concept: "Dependency Inversion Principle (DIP)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Dependency Inversion Principle (DIP) and how does it differ from Dependency Injection (DI)?",
    answer: "DIP states: High-level business modules should not depend on low-level infrastructure modules; both should depend on abstractions (interfaces). Abstractions should not depend on details; details should depend on abstractions. Dependency Injection (DI) is merely a design technique used to pass those abstractions into a class.",
    explanation: "Without DIP, an OrderService (high level) directly imports MySQLConnection (low level). Changing databases or mocking the database for unit testing becomes painful. With DIP, OrderService depends on an OrderRepository interface. The concrete PostgresOrderRepository implements that interface. The dependency direction is inverted toward high-level domain abstractions.",
    code: `// Violation: High-level business class directly instantiates low-level driver
// class OrderService {
//   private db = new MySqlDatabaseDriver(); // Tight infrastructure coupling!
// }

// Compliant: High-level module defines abstraction contract
interface OrderPersistence {
  saveOrder(orderId: string, amount: number): Promise<void>;
}

// Low-level module implements the contract (Inverted dependency)
class PostgresOrderRepository implements OrderPersistence {
  async saveOrder(orderId: string, amount: number): Promise<void> {
    console.log(\`INSERT INTO orders VALUES ('\${orderId}', \${amount})\`);
  }
}

// High-level domain logic depends solely on abstraction
class OrderService {
  constructor(private readonly persistence: OrderPersistence) {}

  async completeOrder(orderId: string, amount: number): Promise<void> {
    // Core business validation...
    await this.persistence.saveOrder(orderId, amount);
  }
}`,
    recallHint: "High-level policy should never depend on low-level plumbing; both depend on abstractions.",
    practice: [
      "Invert a Notification service coupled to SendGrid SDK into an interface-driven engine",
      "Diagram the dependency arrows before and after applying DIP"
    ],
    interviewTip: "DIP is the foundation of Clean Architecture and Hexagonal (Ports & Adapters) architecture. High-level domain entities sit at the center, shielded from databases and UI frameworks.",
    tags: ["SOLID", "DIP", "Dependency Injection", "Inversion of Control"]
  }),

  createCard({
    idNum: 9,
    category,
    concept: "GRASP: Information Expert & Creator Patterns",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the Information Expert and Creator patterns in GRASP (General Responsibility Assignment Software Patterns)?",
    answer: "Information Expert assigns a responsibility to the class that has the necessary information to fulfill it. Creator assigns the responsibility of creating instance B to class A if A aggregates B, contains B, records B, or closely uses B.",
    explanation: "In an e-commerce system, where does total cost calculation belong? To Order, because Order possesses the collection of LineItems and discounts (it is the Information Expert). Who creates LineItem? Order, because Order contains and aggregates LineItems (Creator pattern). This ensures responsibilities are naturally distributed rather than concentrated in god classes.",
    code: `class LineItem {
  constructor(public readonly sku: string, public readonly price: number, public readonly qty: number) {}
  
  // Information Expert for line item subtotal
  public getSubtotal(): number {
    return this.price * this.qty;
  }
}

class Order {
  private lineItems: LineItem[] = [];

  // Creator pattern: Order creates and owns LineItems
  public addLineItem(sku: string, price: number, qty: number): void {
    const item = new LineItem(sku, price, qty);
    this.lineItems.push(item);
  }

  // Information Expert: Order calculates grand total across all items
  public calculateGrandTotal(taxRate: number): number {
    const subtotal = this.lineItems.reduce((sum, item) => sum + item.getSubtotal(), 0);
    return subtotal * (1 + taxRate);
  }
}`,
    recallHint: "Assign responsibility to the class that owns the data (Expert); parent aggregates child (Creator).",
    practice: [
      "Apply Information Expert to assign seat pricing calculation in a Movie Ticket booking model",
      "Contrast GRASP Creator with the GoF Factory Method pattern"
    ],
    interviewTip: "GRASP patterns explain *why* responsibilities belong to certain classes. Mentioning Information Expert shows mature object-oriented design intuition.",
    tags: ["GRASP", "Information Expert", "Creator", "Responsibility Assignment"]
  }),

  createCard({
    idNum: 10,
    category,
    concept: "GRASP: Low Coupling & High Cohesion",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between Coupling and Cohesion, and why are High Cohesion and Low Coupling the dual goals of LLD?",
    answer: "Coupling measures the degree of interdependence between classes (how much class A knows about class B). Cohesion measures how strongly-related and focused the responsibilities within a single class are. Low-level design strives for High Cohesion (focused classes) and Low Coupling (minimal dependencies).",
    explanation: "Low Cohesion creates sprawling utility classes doing unrelated things (math, string formatting, DB access). High Coupling causes ripple effects: modifying class A forces rewrites in classes B, C, and D. Striving for High Cohesion yields readable, testable modules; maintaining Low Coupling via interfaces isolates classes from external changes.",
    code: `// Low Cohesion & High Coupling: Class does everything and connects directly to concrete services
class OrderGodManager {
  sendEmailNotification() { /* ... */ }
  formatXmlPayload() { /* ... */ }
  connectToOracleDb() { /* ... */ }
}

// High Cohesion: Each class does one cohesive domain task
class OrderValidator {
  validate(order: Order): boolean { return true; }
}

class OrderPaymentHandler {
  constructor(private gateway: PaymentGateway) {} // Low coupling via interface
  async charge(order: Order): Promise<void> {
    await this.gateway.authorize(order.total);
  }
}`,
    recallHint: "High Cohesion = focused inside; Low Coupling = loosely connected outside.",
    practice: [
      "Analyze a codebase for tight coupling smells (new keywords scattered across business methods)",
      "Calculate afferent and efferent coupling metrics for a core domain package"
    ],
    interviewTip: "Whenever an interviewer asks 'Why did you separate this into two classes?', the textbook answer is: 'To maintain high cohesion within each class and reduce coupling between them.'",
    tags: ["GRASP", "Coupling", "Cohesion", "Software Quality"]
  }),

  createCard({
    idNum: 11,
    category,
    concept: "Law of Demeter (Principle of Least Knowledge)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Law of Demeter (LoD) and why is train-wreck chaining (a.b.c.d()) considered a code smell?",
    answer: "The Law of Demeter states that a method of an object should only call methods on: itself, its parameters, objects it instantiates, or its direct component fields. Calling `order.getCustomer().getAddress().getZipCode()` (a train wreck) couples the caller to the entire internal graph structure of three distinct classes.",
    explanation: "When code navigates through intermediate objects, any refactoring to Customer or Address breaks the caller. The Law of Demeter promotes 'Tell, Don't Ask'. Instead of asking for nested objects and querying their fields, instruct the immediate collaborator to perform the action or provide the result.",
    code: `// Violation: Train wreck chaining exposes internal graph structure
function printCustomerZip(order: Order): void {
  // If Customer no longer has direct Address, this entire line breaks!
  const zip = order.getCustomer().getAddress().getZipCode();
  console.log(zip);
}

// Compliant: Tell, Don't Ask with delegation
class Customer {
  private address: Address;
  public getZipCode(): string {
    return this.address.getZipCode(); // Delegation
  }
}

class Order {
  private customer: Customer;
  public getShippingZip(): string {
    return this.customer.getZipCode(); // Law of Demeter compliant
  }
}

function printCustomerZipClean(order: Order): void {
  console.log(order.getShippingZip()); // Single direct dot call!
}`,
    recallHint: "Talk only to your immediate friends; don't talk to strangers via dot-chains.",
    practice: [
      "Refactor a train wreck call in an invoice generator to adhere to Law of Demeter",
      "Distinguish between Fluent APIs / Builder pattern chaining vs LoD violations"
    ],
    interviewTip: "Fluent method chaining (e.g. `builder.setName().setAge().build()`) does NOT violate LoD because every method returns the same object or a new builder representation, not an internal domain dependency.",
    tags: ["OOP", "Law of Demeter", "Tell Don't Ask", "Coupling"]
  }),

  createCard({
    idNum: 12,
    category,
    concept: "Value Objects vs Entities & Domain Immutability",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the difference between an Entity and a Value Object in Domain-Driven Design (DDD) and LLD?",
    answer: "An Entity is defined by its continuous identity (ID) that persists over time even as its attributes mutate (e.g. User, Order, Account). A Value Object is defined entirely by its attributes, has no conceptual identity, and is completely immutable (e.g. Money, Address, DateRange, Coordinate). Two Value Objects with identical attributes are considered equal.",
    explanation: "Using primitive types (like raw number for money or string for email) causes Primitive Obsession. Wrapping them in immutable Value Objects encapsulates validation logic (e.g. Currency mismatch protection, valid email format) and guarantees thread-safety. If you change a Value Object, you replace it with a new instance.",
    code: `// Value Object: Immutable, equality by value, self-validating
class Money {
  constructor(
    public readonly amount: number,
    public readonly currency: string
  ) {
    if (amount < 0) throw new Error("Amount cannot be negative");
    if (!currency || currency.length !== 3) throw new Error("Valid 3-letter currency required");
    Object.freeze(this);
  }

  public add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(\`Currency mismatch: \${this.currency} vs \${other.currency}\`);
    }
    return new Money(this.amount + other.amount, this.currency); // Returns fresh instance
  }

  public equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}

// Entity: Defined by unique identity (id)
class UserAccount {
  constructor(
    public readonly id: string, // Unique identity
    private _balance: Money     // Value Object attribute
  ) {}

  public deposit(money: Money): void {
    this._balance = this._balance.add(money);
  }
}`,
    recallHint: "Entity = identified by unique ID; Value Object = immutable, identified by its attributes.",
    practice: [
      "Implement a DateRange Value Object that validates startDate <= endDate and checks overlaps",
      "Explain how Value Object immutability eliminates concurrency race conditions"
    ],
    interviewTip: "Creating rich Value Objects like Money, EmailAddress, and GeoCoordinate during machine coding demonstrates advanced DDD maturity over candidates who use raw primitives.",
    tags: ["DDD", "Value Objects", "Entities", "Immutability"]
  })
];
