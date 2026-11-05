const { createCard } = require('../lld_builder_helper.cjs');

const category = "Behavioral Design Patterns & State Orchestration";

module.exports = [
  createCard({
    idNum: 37,
    category,
    concept: "Strategy Pattern (Interchangeable Algorithms)",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the Strategy Pattern and how does it replace conditional logic with runtime interchangeable algorithms?",
    answer: "The Strategy pattern defines a family of algorithms, encapsulates each one inside a separate class, and makes them interchangeable. Strategy lets the algorithm vary independently from clients that use it, eliminating sprawling if-else or switch statements.",
    explanation: "In an e-commerce checkout, shipping costs can be calculated via Standard Ground, Next-Day Air, or FedEx Express. Rather than writing a 50-line switch statement inside Order, each algorithm implements a `ShippingStrategy` interface. The Order context delegates calculation to the currently selected strategy.",
    code: `// Strategy Interface
interface ShippingStrategy {
  calculate(weightKg: number, distanceKm: number): number;
}

class GroundShippingStrategy implements ShippingStrategy {
  calculate(weight: number, distance: number): number { return weight * 1.5 + distance * 0.1; }
}

class AirExpressShippingStrategy implements ShippingStrategy {
  calculate(weight: number, distance: number): number { return weight * 4.0 + distance * 0.5 + 25.0; }
}

// Context Class
class OrderCheckout {
  private shippingStrategy: ShippingStrategy;

  constructor(strategy: ShippingStrategy) {
    this.shippingStrategy = strategy;
  }

  // Runtime swappable algorithm
  public setShippingStrategy(strategy: ShippingStrategy): void {
    this.shippingStrategy = strategy;
  }

  public getShippingCost(weight: number, distance: number): number {
    return this.shippingStrategy.calculate(weight, distance);
  }
}`,
    recallHint: "Define a family of algorithms, encapsulate each in a class, swap them dynamically at runtime.",
    practice: [
      "Implement a SortingContext that swaps between QuickSort, MergeSort, and TimSort based on array size",
      "Model a RoutePlanner that switches between Driving, Walking, and Transit routing strategies"
    ],
    interviewTip: "Strategy is the most frequently asked behavioral pattern in LLD. Always use it whenever an algorithm or business calculation rule changes based on context or user selection.",
    tags: ["Design Patterns", "Strategy Pattern", "Behavioral", "GoF"]
  }),

  createCard({
    idNum: 38,
    category,
    concept: "Observer Pattern (Push vs Pull Models)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Observer Pattern and what is the difference between the Push Model and the Pull Model?",
    answer: "The Observer pattern defines a one-to-many dependency between objects so that when one object (Subject) changes state, all its dependents (Observers) are notified automatically. In the Push model, the Subject sends detailed event data with the notification; in the Pull model, the Subject merely signals that an event occurred, and the Observer queries the Subject for specific data.",
    explanation: "Push provides all context upfront, but may send unnecessary data that some observers don't need. Pull minimizes network/memory overhead by sending only a notification ping or event ID, leaving it to the observer to pull only the specific properties it requires. The Observer pattern forms the foundation of Event Buses, RxJS, and reactive UI architectures.",
    code: `interface Observer<T> {
  update(data: T): void;
}

interface Subject<T> {
  subscribe(observer: Observer<T>): void;
  unsubscribe(observer: Observer<T>): void;
  notify(data: T): void;
}

class StockTicker implements Subject<{ symbol: string; price: number }> {
  private observers: Set<Observer<{ symbol: string; price: number }>> = new Set();

  subscribe(observer: Observer<{ symbol: string; price: number }>): void {
    this.observers.add(observer);
  }

  unsubscribe(observer: Observer<{ symbol: string; price: number }>): void {
    this.observers.delete(observer);
  }

  notify(data: { symbol: string; price: number }): void {
    for (const observer of this.observers) {
      observer.update(data); // Push model: passes updated payload
    }
  }

  setPrice(symbol: string, newPrice: number): void {
    console.log(\`[Ticker] \${symbol} updated to \$\${newPrice}\`);
    this.notify({ symbol, price: newPrice });
  }
}`,
    recallHint: "Subject notifies N observers automatically. Push sends full payload; Pull sends ping for observer to query.",
    practice: [
      "Implement a thread-safe EventBus with topic channels and async worker dispatch",
      "Explain the 'Lapsed Listener' memory leak and how WeakReferences solve it"
    ],
    interviewTip: "Always mention memory management when discussing Observers. Failing to unsubscribe observers is the #1 cause of memory leaks in long-running desktop and mobile applications.",
    tags: ["Design Patterns", "Observer Pattern", "Event Driven", "PubSub"]
  }),

  createCard({
    idNum: 39,
    category,
    concept: "Command Pattern (Undo/Redo & Macro Recording)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the Command Pattern decouple the invoker from the receiver, and how does it support multi-level Undo/Redo?",
    answer: "The Command pattern encapsulates a request as an object, complete with the target receiver, method name, and arguments. It standardizes an execute() and unexecute() (or undo()) interface. By pushing executed commands onto an 'undo' history stack, the system can reverse operations in LIFO order to achieve unlimited undo/redo.",
    explanation: "Without the Command pattern, a UI Button is tightly coupled to a specific database write or text insert method. With Command, the Button merely invokes `command.execute()`. The command knows how to perform the action on the receiver, records state snapshots or inverse operations in `unexecute()`, and enables queueing, logging, and macro batch execution.",
    code: `// Command Interface
interface Command {
  execute(): void;
  undo(): void;
}

// Receiver: The actual document containing state
class TextDocument {
  private content: string = "";
  write(text: string) { this.content += text; }
  erase(length: number) { this.content = this.content.slice(0, -length); }
  getText(): string { return this.content; }
}

// Concrete Command
class InsertTextCommand implements Command {
  constructor(private doc: TextDocument, private textToInsert: string) {}

  execute(): void { this.doc.write(this.textToInsert); }
  undo(): void { this.doc.erase(this.textToInsert.length); }
}

// Invoker: Manages history stacks for Undo / Redo
class EditorHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  public execute(cmd: Command): void {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = []; // Clear redo stack on fresh action
  }

  public undo(): void {
    const cmd = this.undoStack.pop();
    if (cmd) {
      cmd.undo();
      this.redoStack.push(cmd);
    }
  }

  public redo(): void {
    const cmd = this.redoStack.pop();
    if (cmd) {
      cmd.execute();
      this.undoStack.push(cmd);
    }
  }
}`,
    recallHint: "Encapsulate request into an object with execute() and undo(); manage LIFO stacks for history.",
    practice: [
      "Implement a smart home remote control with programmable slots and a master Undo button",
      "Design a Transactional Command Queue where failure rolls back all previously executed steps"
    ],
    interviewTip: "In machine coding interviews, the Command pattern is the standard architecture for text editors, canvas graphics software, transactional sagas, and job queues.",
    tags: ["Design Patterns", "Command Pattern", "Undo Redo", "Behavioral"]
  }),

  createCard({
    idNum: 40,
    category,
    concept: "State Pattern & Finite State Automata",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the State Pattern and how does it eliminate sprawling conditional state transitions in finite state machines?",
    answer: "The State pattern allows an object to alter its behavior when its internal state changes. The object will appear to change its class. It encapsulates state-specific behaviors into individual State classes implementing a common interface. State transitions are triggered by transitioning the context pointer to another State object.",
    explanation: "A Vending Machine or TCP Connection has states like Idle, HasMoney, Dispensing, SoldOut. A naive design uses a 100-line switch statement in every method (insertMoney, pressButton, dispense). If you add a Maintenance state, you must edit every single switch statement. With the State pattern, each state is an independent class. Adding a state only requires creating a new class.",
    code: `// State Interface
interface VendingMachineState {
  insertCoin(): void;
  ejectCoin(): void;
  pressButton(): void;
  dispense(): void;
}

// Context
class VendingMachine {
  public idleState: VendingMachineState;
  public hasMoneyState: VendingMachineState;
  public dispensingState: VendingMachineState;
  public soldOutState: VendingMachineState;

  private currentState: VendingMachineState;
  public count: number = 2;

  constructor() {
    this.idleState = new IdleState(this);
    this.hasMoneyState = new HasMoneyState(this);
    this.dispensingState = new DispensingState(this);
    this.soldOutState = new SoldOutState(this);
    this.currentState = this.idleState;
  }

  public setState(state: VendingMachineState): void { this.currentState = state; }
  public insertCoin(): void { this.currentState.insertCoin(); }
  public pressButton(): void { this.currentState.pressButton(); }
}

// Concrete State
class IdleState implements VendingMachineState {
  constructor(private machine: VendingMachine) {}
  insertCoin(): void {
    console.log("Coin accepted.");
    this.machine.setState(this.machine.hasMoneyState);
  }
  ejectCoin(): void { console.log("No coin to eject."); }
  pressButton(): void { console.log("Please insert coin first."); }
  dispense(): void { console.log("Payment required."); }
}

class HasMoneyState implements VendingMachineState {
  constructor(private machine: VendingMachine) {}
  insertCoin(): void { console.log("Coin already inserted."); }
  ejectCoin(): void {
    console.log("Coin returned.");
    this.machine.setState(this.machine.idleState);
  }
  pressButton(): void {
    console.log("Button pressed, dispensing item...");
    this.machine.setState(this.machine.dispensingState);
  }
  dispense(): void { console.log("No product dispensed yet."); }
}

class DispensingState implements VendingMachineState {
  constructor(private machine: VendingMachine) {}
  insertCoin() { console.log("Please wait, dispensing in progress."); }
  ejectCoin() { console.log("Cannot eject, already dispensing."); }
  pressButton() { console.log("Already dispensing item."); }
  dispense() {
    this.machine.count--;
    console.log("Item dropped!");
    if (this.machine.count > 0) this.machine.setState(this.machine.idleState);
    else this.machine.setState(this.machine.soldOutState);
  }
}

class SoldOutState implements VendingMachineState {
  constructor(private machine: VendingMachine) {}
  insertCoin() { console.log("Sold out. Coin rejected."); }
  ejectCoin() { console.log("No coin to eject."); }
  pressButton() { console.log("Machine is empty."); }
  dispense() { console.log("No items available."); }
}`,
    recallHint: "Context holds reference to current State object; state classes encapsulate behaviors and state transitions.",
    practice: [
      "Implement a TCP Connection state machine (LISTEN, SYN_SENT, ESTABLISHED, CLOSED)",
      "Design an Order lifecycle (PENDING -> PAID -> SHIPPED -> DELIVERED -> CANCELLED)"
    ],
    interviewTip: "Vending Machine, ATM, Elevator, and Order Workflow are the top 4 LLD interview questions. Always implement them using the State pattern.",
    tags: ["Design Patterns", "State Pattern", "FSM", "State Machines"]
  }),

  createCard({
    idNum: 41,
    category,
    concept: "Chain of Responsibility (Middleware Pipelines)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Chain of Responsibility pattern and how does it power HTTP middleware and approval workflows?",
    answer: "The Chain of Responsibility pattern passes a request along a dynamic chain of handlers. Upon receiving a request, each handler decides either to process it and pass it to the next handler, or short-circuit the chain and halt further execution. It decouples the sender from the handlers.",
    explanation: "In Express/Koa middleware or loan approval systems, a request must pass through Authentication, RateLimiting, and InputValidation before reaching the controller. If RateLimiting detects an abuse, it terminates the chain immediately. Handlers can be reordered or added dynamically without modifying existing handlers.",
    code: `interface RequestContext {
  userId?: string;
  role?: string;
  body: any;
}

abstract class MiddlewareHandler {
  private nextHandler: MiddlewareHandler | null = null;

  public setNext(handler: MiddlewareHandler): MiddlewareHandler {
    this.nextHandler = handler;
    return handler; // Allows fluent chaining: a.setNext(b).setNext(c)
  }

  public handle(req: RequestContext): boolean {
    if (this.nextHandler) {
      return this.nextHandler.handle(req);
    }
    return true; // Reached end of chain successfully
  }
}

class AuthMiddleware extends MiddlewareHandler {
  public handle(req: RequestContext): boolean {
    if (!req.userId) {
      console.log("[Auth] Rejected: No user authenticated");
      return false; // Short-circuit!
    }
    console.log("[Auth] Passed");
    return super.handle(req);
  }
}

class RoleMiddleware extends MiddlewareHandler {
  constructor(private requiredRole: string) { super(); }
  public handle(req: RequestContext): boolean {
    if (req.role !== this.requiredRole) {
      console.log(\`[Role] Rejected: Requires \${this.requiredRole}\`);
      return false; // Short-circuit!
    }
    console.log("[Role] Passed");
    return super.handle(req);
  }
}

// Chain assembly:
const auth = new AuthMiddleware();
const role = new RoleMiddleware("ADMIN");
auth.setNext(role);

auth.handle({ userId: "u-123", role: "USER", body: {} }); // Rejected at RoleMiddleware!`,
    recallHint: "Pass request along a linked list of handlers; each handler processes or short-circuits.",
    practice: [
      "Implement an Expense Approval chain: Team Lead ($1k) -> Director ($10k) -> CEO ($100k)",
      "Contrast Chain of Responsibility with Decorator (Chain can short-circuit; Decorator always executes all layers)"
    ],
    interviewTip: "Highlight that Chain of Responsibility allows dynamic ordering and short-circuiting, making it the ideal pattern for filter chains, validation pipelines, and approval hierarchies.",
    tags: ["Design Patterns", "Chain of Responsibility", "Middleware", "Interceptors"]
  }),

  createCard({
    idNum: 42,
    category,
    concept: "Iterator Pattern (Fail-Fast vs Fail-Safe)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Iterator Pattern and what is the difference between Fail-Fast and Fail-Safe iterators?",
    answer: "The Iterator pattern provides a standard way to sequentially access elements of an aggregate object without exposing its underlying representation (Array, Tree, Graph). A Fail-Fast iterator immediately throws a ConcurrentModificationException if the collection is structurally modified during iteration; a Fail-Safe iterator operates on a clone/snapshot, avoiding exceptions.",
    explanation: "If Thread A iterates through an ArrayList while Thread B deletes an element, a Fail-Fast iterator tracks a `modCount` variable; if `modCount` changes during iteration, it fails fast to prevent nondeterministic bugs. A Fail-Safe iterator (like `CopyOnWriteArrayList` in Java) iterates over a memory snapshot, permitting concurrent modifications without crashing.",
    code: `interface CustomIterator<T> {
  hasNext(): boolean;
  next(): T;
}

interface IterableCollection<T> {
  createIterator(): CustomIterator<T>;
}

// Concrete aggregate (Binary Search Tree or List)
class NumberList implements IterableCollection<number> {
  private items: number[] = [];
  public modCount: number = 0; // Tracks structural mutations

  public add(val: number) { this.items.push(val); this.modCount++; }
  public get(index: number) { return this.items[index]; }
  public size() { return this.items.length; }

  public createIterator(): CustomIterator<number> {
    return new FailFastIterator(this);
  }
}

// Fail-Fast Iterator implementation
class FailFastIterator implements CustomIterator<number> {
  private currentIndex: number = 0;
  private expectedModCount: number;

  constructor(private list: NumberList) {
    this.expectedModCount = list.modCount;
  }

  public hasNext(): boolean {
    return this.currentIndex < this.list.size();
  }

  public next(): number {
    if (this.list.modCount !== this.expectedModCount) {
      throw new Error("ConcurrentModificationException: Collection altered during iteration!");
    }
    return this.list.get(this.currentIndex++);
  }
}`,
    recallHint: "Sequential traversal without exposing internal structure; Fail-fast checks modCount, Fail-safe copies on write.",
    practice: [
      "Implement an in-order TreeIterator traversing a Binary Search Tree without recursion",
      "Contrast memory overhead of CopyOnWriteArrayList vs synchronized iterators"
    ],
    interviewTip: "In multithreaded LLD interviews, always explain why modifying a collection while iterating over it requires explicit iterator removal methods or concurrent collections.",
    tags: ["Design Patterns", "Iterator Pattern", "Fail-Fast", "Concurrency"]
  }),

  createCard({
    idNum: 43,
    category,
    concept: "Mediator Pattern (Decoupling Many-to-Many Communication)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the Mediator pattern convert a chaotic $N \times N$ mesh of object communications into a clean star topology?",
    answer: "The Mediator pattern restricts direct communications between components (Colleagues) and forces them to collaborate only via a central Mediator object. Instead of each object knowing about dozens of other objects ($N \times N$ coupling), each colleague only knows its single Mediator ($N$ connections).",
    explanation: "In an Air Traffic Control (ATC) system, 50 airplanes communicating directly with each other to coordinate landings would create complete chaos. Instead, all airplanes communicate solely with the ATC Tower (the Mediator). The tower decides who can land or take off and dispatches commands, keeping airplanes decoupled.",
    code: `// Mediator Interface
interface ChatMediator {
  sendMessage(message: string, sender: User): void;
  addUser(user: User): void;
}

// Colleague
abstract class User {
  constructor(protected mediator: ChatMediator, public name: string) {}
  abstract send(message: string): void;
  abstract receive(message: string): void;
}

// Concrete Mediator
class ChatRoomMediator implements ChatMediator {
  private users: User[] = [];

  addUser(user: User): void { this.users.push(user); }

  sendMessage(message: string, sender: User): void {
    // Broadcast to all users EXCEPT the sender
    for (const u of this.users) {
      if (u !== sender) {
        u.receive(\`[\${sender.name}]: \${message}\`);
      }
    }
  }
}

// Concrete Colleague
class ChatUser extends User {
  send(message: string): void {
    console.log(\`\${this.name} sends: \${message}\`);
    this.mediator.sendMessage(message, this);
  }
  receive(message: string): void {
    console.log(\`\${this.name} received: \${message}\`);
  }
}`,
    recallHint: "Central hub for communication; replaces N*N spiderweb coupling with 1:N star topology.",
    practice: [
      "Design a UI Dialog Box Mediator coordinating Buttons, Checkboxes, and Textfields",
      "Contrast Mediator with Observer (Observer is one-way pub-sub; Mediator coordinates two-way business logic)"
    ],
    interviewTip: "Mediator centralizes complex interaction logic that would otherwise be scattered across peer objects, making changes to communication policies straightforward to implement.",
    tags: ["Design Patterns", "Mediator Pattern", "Decoupling", "Behavioral"]
  }),

  createCard({
    idNum: 44,
    category,
    concept: "Memento Pattern (Snapshot State Capture)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the Memento Pattern and how does it capture an object's internal state without violating encapsulation?",
    answer: "The Memento pattern captures and externalizes an object's internal state so the object can be restored to this state later, without violating encapsulation. The Originator creates a Memento containing a snapshot of its private state; the Caretaker stores the Memento safely as an opaque token without reading or modifying its private contents.",
    explanation: "If an external History manager directly inspected and copied an Originator's private fields, it would violate encapsulation. Memento solves this: the Originator instantiates a private Memento object and hands it to the Caretaker. The Caretaker treats it as an opaque black box and hands it back to `originator.restore(memento)` when rollback is needed.",
    code: `// Memento: Opaque snapshot of state
class EditorMemento {
  constructor(
    private readonly content: string,
    private readonly cursorPosition: number
  ) {
    Object.freeze(this);
  }

  // State is accessible only to the Originator
  public getContent(): string { return this.content; }
  public getCursor(): number { return this.cursorPosition; }
}

// Originator: Creates and restores from Mementos
class TextEditor {
  private content: string = "";
  private cursorPosition: number = 0;

  public type(words: string): void {
    this.content += words;
    this.cursorPosition += words.length;
  }

  public save(): EditorMemento {
    return new EditorMemento(this.content, this.cursorPosition);
  }

  public restore(memento: EditorMemento): void {
    this.content = memento.getContent();
    this.cursorPosition = memento.getCursor();
    console.log(\`Restored editor state: "\${this.content}" at cursor \${this.cursorPosition}\`);
  }
}

// Caretaker: Stores history checkpoints without inspecting internals
class HistoryManager {
  private history: EditorMemento[] = [];

  public pushCheckpoint(m: EditorMemento) { this.history.push(m); }
  public popCheckpoint(): EditorMemento | undefined { return this.history.pop(); }
}`,
    recallHint: "Originator creates/restores snapshot; Caretaker stores it as an opaque black box.",
    practice: [
      "Implement checkpoint save/load for a Video Game level state using Memento",
      "Optimize memory in Memento by saving incremental state diffs instead of full snapshots"
    ],
    interviewTip: "Memento is essential for disaster recovery, checkpointing, and rollbacks in transactional workflows where object state must be preserved without exposing private fields.",
    tags: ["Design Patterns", "Memento Pattern", "Snapshots", "Encapsulation"]
  }),

  createCard({
    idNum: 45,
    category,
    concept: "Template Method Pattern & Hollywood Principle",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the Template Method Pattern and how does it enforce the 'Hollywood Principle' ('Don't call us, we'll call you')?",
    answer: "The Template Method pattern defines the skeleton of an algorithm in an abstract base method, deferring some steps to subclasses. It lets subclasses redefine certain steps of an algorithm without changing the overall algorithm structure. The base class controls the execution flow, calling subclass hooks only when needed.",
    explanation: "In a Data Mining pipeline, the overall workflow is always: `readData()` -> `parseData()` -> `analyze()` -> `generateReport()`. The workflow order is invariant. A base class declares `process()` as a final template method. Subclasses like `CsvDataMiner` and `PdfDataMiner` only override the `readData()` and `parseData()` steps.",
    code: `abstract class DataMiner {
  // Template Method: Skeleton algorithm is invariant
  public process(path: string): void {
    this.openFile(path);
    const rawData = this.extractData();
    const parsed = this.parseData(rawData);
    this.analyzeData(parsed);
    this.sendReport();
    this.closeFile();
  }

  private openFile(path: string) { console.log(\`Opening file \${path}\`); }
  private closeFile() { console.log("Closing file descriptor"); }
  private analyzeData(data: any) { console.log("Running statistical analysis"); }
  private sendReport() { console.log("Sending Slack alert"); }

  // Abstract steps that subclasses MUST customize
  protected abstract extractData(): string;
  protected abstract parseData(raw: string): any;
}

class CsvDataMiner extends DataMiner {
  protected extractData(): string { return "id,amount\\n1,100\\n2,250"; }
  protected parseData(raw: string): any {
    console.log("Parsing comma-separated lines");
    return raw.split("\\n");
  }
}

new CsvDataMiner().process("sales.csv");`,
    recallHint: "Base class defines algorithmic skeleton; subclasses override specific hook methods.",
    practice: [
      "Build a BuildPipeline (checkout -> test -> compile -> deploy) using Template Method",
      "Contrast Template Method (inheritance) with Strategy (composition)"
    ],
    interviewTip: "Remember: Template Method uses Inheritance (compile-time variation); Strategy uses Composition (runtime variation). Prefer Strategy when algorithms need to be swapped dynamically.",
    tags: ["Design Patterns", "Template Method", "Hollywood Principle", "Behavioral"]
  }),

  createCard({
    idNum: 46,
    category,
    concept: "Visitor Pattern (Double Dispatch)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What problem does the Visitor Pattern solve, and how does Double Dispatch overcome single-dispatch limitations?",
    answer: "The Visitor pattern lets you define a new operation on an existing object structure without changing the classes of the elements on which it operates. Double Dispatch routes the call based on both the type of the Visitor and the concrete type of the Element at runtime using `element.accept(visitor)`.",
    explanation: "If you have an Abstract Syntax Tree (AST) with 20 node types (AssignmentNode, IfNode, LoopNode), adding a TypeChecker, CodeGenerator, or JSONExporter by modifying all 20 classes violates OCP. With Visitor, you create a TypeCheckingVisitor. Each node calls `visitor.visitAssignment(this)`. New operations are added by simply creating a new Visitor class.",
    code: `// Element Interface
interface DocumentElement {
  accept(visitor: DocumentVisitor): void;
}

// Visitor Interface with overloads per concrete element
interface DocumentVisitor {
  visitParagraph(p: Paragraph): void;
  visitTable(t: Table): void;
}

class Paragraph implements DocumentElement {
  constructor(public text: string) {}
  accept(visitor: DocumentVisitor): void {
    visitor.visitParagraph(this); // First dispatch on Paragraph, second on Visitor
  }
}

class Table implements DocumentElement {
  constructor(public rows: string[][]) {}
  accept(visitor: DocumentVisitor): void {
    visitor.visitTable(this);
  }
}

// Concrete Visitor 1: HTML Exporter
class HtmlExportVisitor implements DocumentVisitor {
  visitParagraph(p: Paragraph) { console.log(\`<p>\${p.text}</p>\`); }
  visitTable(t: Table) { console.log(\`<table>...\${t.rows.length} rows</table>\`); }
}

// Concrete Visitor 2: Plain Text Counter
class WordCountVisitor implements DocumentVisitor {
  public totalWords = 0;
  visitParagraph(p: Paragraph) { this.totalWords += p.text.split(" ").length; }
  visitTable(t: Table) { this.totalWords += t.rows.flat().length; }
}`,
    recallHint: "element.accept(visitor) dispatches on element type; allows new operations without touching element classes.",
    practice: [
      "Implement an XML / JSON AST serializer using Visitor Pattern",
      "Explain why adding a new Element type makes the Visitor pattern painful (requires updating all visitors)"
    ],
    interviewTip: "The Visitor pattern is ideal when the element class hierarchy is stable, but new operations are added frequently (e.g. Compilers, ASTs, Tax calculation on mixed item carts).",
    tags: ["Design Patterns", "Visitor Pattern", "Double Dispatch", "AST"]
  }),

  createCard({
    idNum: 47,
    category,
    concept: "Null Object Pattern (Eliminating Defensive Checks)",
    priority: "must-know",
    difficulty: "beginner",
    question: "How does the Null Object Pattern eliminate defensive null checks (`if (x !== null)`) throughout client code?",
    answer: "The Null Object pattern provides a surrogate object that implements the target interface with neutral, do-nothing behavior instead of returning null. Client code can safely invoke methods on the returned reference without checking for null, preventing NullPointerException crashes.",
    explanation: "Scattering `if (logger != null) logger.log(...)` across thousands of methods is repetitive and prone to omissions. By instantiating a `NullLogger` whose `log()` method does nothing, code executes cleanly: `logger.log(...)` without any conditional null checks.",
    code: `interface Logger {
  log(message: string): void;
}

class ConsoleLogger implements Logger {
  log(message: string): void { console.log(\`[LOG] \${message}\`); }
}

// Null Object: Safe neutral do-nothing implementation
class NullLogger implements Logger {
  log(message: string): void {
    // Intentionally no-op: prevents NullPointerExceptions safely
  }
}

class PaymentService {
  private logger: Logger;

  // Defaults to NullLogger instead of null!
  constructor(logger?: Logger) {
    this.logger = logger || new NullLogger();
  }

  public process(): void {
    // Zero defensive if (this.logger !== null) checks required!
    this.logger.log("Payment processing started...");
  }
}`,
    recallHint: "Return a safe no-op object implementing the interface instead of null; eliminates null checks.",
    practice: [
      "Implement a NullCustomer representing an unauthenticated guest user",
      "Contrast Null Object pattern with modern Optional / Maybe monadic types"
    ],
    interviewTip: "Mentioning the Null Object pattern shows clean-code maturity. It eliminates boilerplate guards and adheres to the Principle of Least Surprise.",
    tags: ["Design Patterns", "Null Object", "Clean Code", "Defensive Programming"]
  }),

  createCard({
    idNum: 48,
    category,
    concept: "Interpreter Pattern (Rule Evaluation & DSLs)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the Interpreter Pattern and how does it evaluate domain-specific grammar rules (e.g. Boolean logic expressions)?",
    answer: "The Interpreter pattern defines a grammatical representation for a simple domain-specific language (DSL) along with an interpreter that evaluates sentences in that language. Each rule in the grammar is modeled as a class implementing an interpret(context) method.",
    explanation: "For an insurance rule engine evaluating boolean expressions like `(age > 25 AND accidents == 0) OR hasVipStatus`, the Interpreter pattern parses the expression into a composite Abstract Syntax Tree of Terminal expressions (variables/constants) and Non-Terminal expressions (AND, OR, NOT). Evaluating the root node recursively interprets the full tree.",
    code: `interface Expression {
  interpret(context: Record<string, any>): boolean;
}

// Terminal Expression
class VariableExpression implements Expression {
  constructor(private varName: string) {}
  interpret(context: Record<string, any>): boolean {
    return Boolean(context[this.varName]);
  }
}

// Non-Terminal Expression: AND
class AndExpression implements Expression {
  constructor(private expr1: Expression, private expr2: Expression) {}
  interpret(context: Record<string, any>): boolean {
    return this.expr1.interpret(context) && this.expr2.interpret(context);
  }
}

// Non-Terminal Expression: OR
class OrExpression implements Expression {
  constructor(private expr1: Expression, private expr2: Expression) {}
  interpret(context: Record<string, any>): boolean {
    return this.expr1.interpret(context) || this.expr2.interpret(context);
  }
}

// Rule: hasLicense AND (isOver21 OR hasGuardian)
const rule = new AndExpression(
  new VariableExpression("hasLicense"),
  new OrExpression(
    new VariableExpression("isOver21"),
    new VariableExpression("hasGuardian")
  )
);

const user = { hasLicense: true, isOver21: false, hasGuardian: true };
console.log("Approved to drive:", rule.interpret(user)); // true!`,
    recallHint: "Grammar rules represented as class tree with interpret(context); terminal and non-terminal nodes.",
    practice: [
      "Implement a mathematical expression evaluator (Add, Subtract, Multiply) using Interpreter",
      "Explain why full programming languages use Lexer/Parser tools (ANTLR) rather than the raw GoF Interpreter pattern"
    ],
    interviewTip: "In LLD rounds involving Rule Engines, Discount Criteria, or Filter Query Builders, using the Interpreter pattern demonstrates how to execute complex conditional rules dynamically.",
    tags: ["Design Patterns", "Interpreter Pattern", "Rule Engine", "DSL"]
  })
];
