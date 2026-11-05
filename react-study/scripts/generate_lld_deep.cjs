const fs = require('fs');
const path = require('path');

const deepDives = [
  {
    id: "lld-deep-01",
    title: "The SOLID Principles in Practice: Refactoring Anti-Patterns into Pure Object Models",
    category: "Object-Oriented Design & Principles",
    readTimeMinutes: 24,
    overview: "The SOLID principles are the bedrock of maintainable, extensible low-level system design. This masterclass dissects how real-world codebases degrade into fragile monoliths through violation of SRP, OCP, LSP, ISP, and DIP, and demonstrates step-by-step refactorings that restore modularity, testability, and polymorphism.",
    diagram: `+-------------------------------------------------------------------------+
|                  SOLID PRINCIPLES ARCHITECTURAL REFACTORING             |
+-------------------------------------------------------------------------+
|                                                                         |
|  VIOLATING GOD CLASS (High Coupling, Fragile, Rigid):                   |
|  +-------------------------------------------------------------------+  |
|  | MonolithicOrderManager                                            |  |
|  | - calculateTaxes(country)      <-- Violates SRP & OCP             |  |
|  | - saveToPostgres()             <-- Violates SRP & DIP             |  |
|  | - sendSmsConfirmation()        <-- Violates SRP & ISP             |  |
|  | - generatePdfInvoice()         <-- Violates SRP                   |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  CLEAN REFACTORED DOMAIN (Pure SOLID Compliance):                       |
|  +------------------------+      +-----------------------------------+  |
|  | Order (Domain Entity)  | ---> | TaxCalculator (Strategy Pattern)  |  |
|  | - Business Invariants  |      | - UsTax / UkTax / IndiaGst (OCP)  |  |
|  +------------------------+      +-----------------------------------+  |
|              |                                                          |
|              v (DIP via Ports)                                          |
|  +------------------------+      +-----------------------------------+  |
|  | OrderRepositoryPort    | <--- | PostgresOrderAdapter (DIP/LSP)   |  |
|  +------------------------+      +-----------------------------------+  |
|              |                                                          |
|              v (ISP)                                                    |
|  +------------------------+      +-----------------------------------+  |
|  | MessageSenderPort      | <--- | TwilioSmsAdapter / SendGridEmail  |  |
|  +------------------------+      +-----------------------------------+  |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. SRP & OCP: Decomposing God Classes and Eliminating Switch Sprawl",
        explanation: "A class with multiple responsibilities has multiple axes of change. When business analysts adjust tax calculation rules, developers risk breaking invoice PDF rendering. Applying SRP isolates business calculation from persistence and presentation. Applying OCP introduces Strategy interfaces so new tax regimes or discount calculators are introduced simply by writing new classes without modifying a single line of existing production code.",
        codeExample: `// Clean OCP Strategy Pattern for Dynamic Tax Calculation
interface TaxCalculationStrategy {
  calculateTax(subtotal: number): number;
}

class UsStateTaxStrategy implements TaxCalculationStrategy {
  constructor(private stateRate: number) {}
  calculateTax(subtotal: number): number { return subtotal * this.stateRate; }
}

class EuropeanVatStrategy implements TaxCalculationStrategy {
  calculateTax(subtotal: number): number { return subtotal * 0.20; }
}

class TaxContext {
  constructor(private strategy: TaxCalculationStrategy) {}
  public compute(amount: number): number { return this.strategy.calculateTax(amount); }
}`
      },
      {
        subheading: "2. LSP & ISP: Behavioral Contracts & Role-Specific Interfaces",
        explanation: "LSP mandates that subtypes must be fully substitutable for their parent types without throwing UnexpectedOperationExceptions or violating caller assumptions (the Rectangle-Square trap). ISP complements LSP by breaking down fat monolithic interfaces into narrow, client-specific role interfaces. Clients only depend on methods they actually invoke, preventing empty no-op method stubs in implementing classes.",
        codeExample: `// ISP: Segregated Role Interfaces
interface DocumentReader { read(): Buffer; }
interface DocumentWriter { write(data: Buffer): void; }
interface DocumentPrinter { print(): void; }

// Simple read-only file viewer depends solely on DocumentReader
class DocumentViewer {
  constructor(private reader: DocumentReader) {}
  display() { const buffer = this.reader.read(); /* render */ }
}`
      },
      {
        subheading: "3. DIP: Inverting the Architectural Dependency Graph",
        explanation: "In traditional procedural designs, high-level business rules depend directly on low-level database drivers and third-party APIs. DIP inverts this arrow: high-level business logic defines an abstract interface (Port). The low-level database driver implements this interface (Adapter). The business logic remains pure, completely decoupled from MySQL, MongoDB, or AWS SDKs.",
        codeExample: `// Inversion of Control via Dependency Inversion
interface PaymentPort {
  charge(amountCents: number, currency: string): Promise<string>;
}

class CheckoutUseCase {
  constructor(private paymentGateway: PaymentPort) {} // Inward dependency

  async execute(orderTotal: number) {
    const txId = await this.paymentGateway.charge(orderTotal * 100, "USD");
    return { success: true, transactionId: txId };
  }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Over-engineering: Creating an interface for every single 2-line utility class when no polymorphism is required.",
      "LSP violation via subtype precondition strengthening: A subclass requiring non-null arguments when the base interface accepts null.",
      "Anemic Domain Model: Moving all behavior out of domain entities into procedural services, leaving entities as raw data bags with getters/setters."
    ],
    keyTakeaways: [
      "SRP binds a class's reasons to change to a single business actor.",
      "OCP allows infinite extensibility by adding new classes instead of editing verified code.",
      "LSP guarantees that subclasses uphold all behavioral contracts and invariants of their parent abstractions.",
      "ISP avoids fat interfaces by providing focused, client-centric role interfaces.",
      "DIP shields business policies from volatile database and third-party infrastructure details."
    ]
  },

  {
    id: "lld-deep-02",
    title: "Thread-Safe LRU & LFU Cache Design: O(1) Time & Space Invariants with Fine-Grained Locking",
    category: "In-Memory Storage & Caches",
    readTimeMinutes: 26,
    overview: "In-memory caching is foundational to low-latency software. This masterclass deep dives into the exact data structure mechanics of $O(1)$ Least Recently Used (LRU) and Least Frequently Used (LFU) eviction algorithms, the use of sentinel nodes to eliminate null checks, and multi-threaded synchronization techniques using Read-Write Locks and Lock Striping.",
    diagram: `+-------------------------------------------------------------------------+
|                  THREAD-SAFE LRU CACHE DATA STRUCTURE ARCHITECTURE      |
+-------------------------------------------------------------------------+
|                                                                         |
|  HASH MAP (O(1) Random Key Lookup):                                     |
|  ["user:1"] ----> [ Node A ]                                            |
|  ["user:2"] ----> [ Node B ]                                            |
|  ["user:3"] ----> [ Node C ]                                            |
|                                                                         |
|  DOUBLY LINKED LIST (O(1) Recency Tracking with Sentinel Sentinels):    |
|                                                                         |
|   +----------+        +----------+        +----------+        +-------+ |
|   |  HEAD    | <----> |  Node B  | <----> |  Node A  | <----> |  TAIL | |
|   |(Sentinel)|        | (MRU)    |        | (LRU)    |        |(Senti)| |
|   +----------+        +----------+        +----------+        +-------+ |
|        |                                                           |    |
|        +--- Newly accessed nodes move here (Head.next)             |    |
|                                                                    |    |
|             Eviction removes least-recently-used here (Tail.prev) -+    |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Sentinel Doubly-Linked List + HashMap Synergy",
        explanation: "To achieve $O(1)$ time complexity for both `get` and `put`, a HashMap provides immediate pointer access to nodes in $O(1)$. The Doubly-Linked List allows splicing a node out of the list and moving it to the Head in $O(1)$ pointer reassignments. Using dummy `head` and `tail` sentinel nodes guarantees that every real node always has valid `prev` and `next` pointers, completely eliminating edge-case `if (node.prev === null)` checks.",
        codeExample: `class Node {
  key: string; val: any;
  prev: Node | null = null; next: Node | null = null;
  constructor(k: string = "", v: any = null) { this.key = k; this.val = v; }
}

// Splicing node out and inserting at head in O(1):
function moveToHead(node: Node, head: Node) {
  // 1. Remove from current position
  node.prev!.next = node.next;
  node.next!.prev = node.prev;

  // 2. Insert immediately after dummy head
  node.prev = head;
  node.next = head.next;
  head.next!.prev = node;
  head.next = node;
}`
      },
      {
        subheading: "2. The O(1) LFU Frequency Bucket Architecture",
        explanation: "LFU evicts the item with the lowest access count. A min-heap requires $O(\\log N)$ to re-heapify when frequency increments. To achieve true $O(1)$, group items into Frequency Buckets. A HashMap maps `freq -> DoublyLinkedList`. A global `minFreq` integer tracks the lowest active frequency. When a node's frequency increments from $F$ to $F+1$, move it to bucket $F+1$ in $O(1)$. If bucket `minFreq` becomes empty, increment `minFreq`.",
        codeExample: `// LFU Frequency Node relocation in O(1):
function incrementFrequency(key: string, node: LFUNode, freqMap: Map<number, Set<string>>, minFreqRef: { val: number }) {
  const oldFreq = node.freq;
  const newFreq = oldFreq + 1;
  node.freq = newFreq;

  // Remove from old frequency bucket
  const oldBucket = freqMap.get(oldFreq)!;
  oldBucket.delete(key);
  if (oldBucket.size === 0 && minFreqRef.val === oldFreq) {
    minFreqRef.val = newFreq; // Advance minimum frequency pointer
  }

  // Prepend to new frequency bucket
  if (!freqMap.has(newFreq)) freqMap.set(newFreq, new Set());
  freqMap.get(newFreq)!.add(key);
}`
      },
      {
        subheading: "3. Multi-Threaded Cache Synchronization & Striping",
        explanation: "In an LRU cache, even a `get(key)` operation mutates internal state because the accessed node must move to the head of the list. Therefore, a standard ReadWriteLock cannot permit concurrent `get` calls if `get` acquires a write lock! To solve this: 1. Use Lock Striping to partition the cache into 16 independent sub-caches, or 2. Decouple read lookups from a lock-free ring buffer of read events, where a background worker batches recency updates asynchronously (the Caffeine cache architecture).",
        codeExample: `// Lock Striped Cache partitioning by hash
class StripedLRU<V> {
  private partitions: LRUCache<V>[];
  private numStripes: number = 16;

  constructor(totalCapacity: number) {
    const perStripeCap = Math.max(1, Math.floor(totalCapacity / this.numStripes));
    this.partitions = Array.from({ length: this.numStripes }, () => new LRUCache<V>(perStripeCap));
  }

  private getStripe(key: string): LRUCache<V> {
    let hash = 0;
    for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
    return this.partitions[hash % this.numStripes];
  }

  public get(key: string): V | null { return this.getStripe(key).get(key); }
  public put(key: string, val: V): void { this.getStripe(key).put(key, val); }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Cache Pollution in LRU: A sequential batch scan over 1,000,000 cold keys evicts the entire active working set of hot items. Solved using 2Q (Two-Queue) or W-TinyLFU.",
      "Deadlock during multi-stripe operations: Iterating over all stripes without consistent ascending lock acquisition order.",
      "Memory leak via circular references: Failing to null out `prev` and `next` pointers on evicted nodes prevents garbage collectors from reclaiming memory."
    ],
    keyTakeaways: [
      "LRU achieves O(1) via HashMap + Doubly-Linked List with dummy head and tail sentinels.",
      "LFU achieves O(1) via keyMap + freqMap (freq -> DLL) + minFreq counter.",
      "In LRU, reads are state mutations; high concurrency requires Lock Striping or asynchronous read buffers.",
      "Sentinel nodes eliminate null-checking conditionals and prevent off-by-one pointer corruptions."
    ]
  },

  {
    id: "lld-deep-03",
    title: "The Parking Lot System Architecture: Extensible Vehicle Types, Allocation & Pricing",
    category: "Real-World System Modeling",
    readTimeMinutes: 22,
    overview: "The Parking Lot system is a quintessential machine-coding benchmark. This masterclass designs a robust multi-floor parking lot handling multiple vehicle sizes, dynamic entry/exit terminals, pluggable spot allocation algorithms (Nearest-to-Entrance, Floor-First), and tiered hourly pricing strategies.",
    diagram: `+-------------------------------------------------------------------------+
|                  PARKING LOT OBJECT MODEL & COMPOSITION                 |
+-------------------------------------------------------------------------+
|                                                                         |
|  [PARKING LOT (Singleton / Facade)]                                     |
|  - floors: ParkingFloor[]                                               |
|  - entryTerminals: EntryTerminal[]                                      |
|  - exitTerminals: ExitTerminal[]                                        |
|  - allocationStrategy: SpotAllocationStrategy (Strategy)                |
|  - pricingStrategy: FeeCalculationStrategy (Strategy)                   |
|                                                                         |
|        | 1..*                                                           |
|        v                                                                |
|  [PARKING FLOOR]                                                        |
|  - floorNumber: number                                                  |
|  - spots: Map<SpotType, ParkingSpot[]>                                  |
|                                                                         |
|        | 1..*                                                           |
|        v                                                                |
|  [PARKING SPOT] <------------------------+                              |
|  - spotId: string                        |                              |
|  - type: SpotType (Compact, Regular, Large, EV)                         |
|  - isAvailable: boolean                  | parks (1:1)                  |
|                                          v                              |
|                                    [VEHICLE]                            |
|                                    - licensePlate: string               |
|                                    - type: VehicleType                  |
|                                      (Motorcycle, Car, Truck, EV)       |
|                                                                         |
|  [TICKET (Value Object)]                                                |
|  - ticketId: string | spotId: string | entryTime: number                |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Domain Modeling: Vehicles, Spots & Compatibility Rules",
        explanation: "A common mistake is baking vehicle dimensions into switch statements. Instead, model `SpotType` (COMPACT, REGULAR, LARGE, ELECTRIC) and `VehicleType` (MOTORCYCLE, CAR, VAN, TRUCK). A ParkingSpot encapsulates its own compatibility validation: a motorcycle can park in any spot, a car fits in Regular or Large, while a Truck requires Large. This keeps spot allocation logic clean and extensible.",
        codeExample: `class ParkingSpot {
  private currentVehicle: Vehicle | null = null;
  constructor(public readonly id: string, public readonly type: SpotType) {}

  public canFit(v: Vehicle): boolean {
    if (this.currentVehicle !== null) return false;
    switch (v.type) {
      case VehicleType.MOTORCYCLE: return true;
      case VehicleType.CAR: return this.type === SpotType.REGULAR || this.type === SpotType.LARGE;
      case VehicleType.TRUCK: return this.type === SpotType.LARGE;
      default: return false;
    }
  }
}`
      },
      {
        subheading: "2. Pluggable Spot Allocation Strategies",
        explanation: "How should an arriving car find a spot? In a 5-story garage, an allocation strategy might seek the spot nearest to the entrance gate, or pack lower floors first, or optimize for EV charger proximity. By encapsulating allocation into a `SpotAllocationStrategy` interface, algorithms can be swapped dynamically (e.g. Switching to Min-Walking-Distance during holiday peak hours).",
        codeExample: `interface SpotAllocationStrategy {
  findSpot(floors: ParkingFloor[], vehicle: Vehicle): ParkingSpot | null;
}

// Floor-First Allocation Strategy
class FloorFirstAllocationStrategy implements SpotAllocationStrategy {
  findSpot(floors: ParkingFloor[], vehicle: Vehicle): ParkingSpot | null {
    for (const floor of floors) {
      const spot = floor.getAvailableSpots().find(s => s.canFit(vehicle));
      if (spot) return spot;
    }
    return null; // Garage full
  }
}`
      },
      {
        subheading: "3. Tiered Fee Calculation Strategies",
        explanation: "Parking fees vary: flat rates, tiered hourly structures (first 2 hours free, $5/hr thereafter), or vehicle-type multipliers. An issued `ParkingTicket` records `entryTime` and `spotId`. Upon exit, the `FeeCalculationStrategy` receives the ticket and exit timestamp, applying business rules cleanly.",
        codeExample: `interface FeeCalculationStrategy {
  calculateFee(ticket: ParkingTicket, exitTime: number): number;
}

class TieredHourlyFeeStrategy implements FeeCalculationStrategy {
  calculateFee(ticket: ParkingTicket, exitTime: number): number {
    const durationHours = Math.ceil((exitTime - ticket.entryTime) / (1000 * 60 * 60));
    if (durationHours <= 1) return 0; // 1st hour free
    if (durationHours <= 3) return (durationHours - 1) * 5; // $5/hr
    return 10 + (durationHours - 3) * 8; // $8/hr thereafter
  }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Concurrency race condition at entry terminals: Two cars entering simultaneous gates simultaneously allocate the exact same spot. Solved with synchronized allocation blocks or atomic atomic reservation.",
      "Lost Ticket: Edge-case fee strategy needed when customer loses ticket (max daily fee).",
      "Overflow parking and oversized vehicles: Trucks occupying 2 consecutive spots require composite multi-spot reservation logic."
    ],
    keyTakeaways: [
      "Separate vehicle type from spot type; let ParkingSpot determine fit compatibility.",
      "Use Strategy Pattern for Spot Allocation (Nearest, Lowest Floor) and Fee Calculation.",
      "ParkingLot acts as a Facade coordinating floors, terminals, tickets, and gates.",
      "Synchronize spot allocation at the floor/lot level to prevent double-parking race conditions."
    ]
  },

  {
    id: "lld-deep-04",
    title: "Elevator Dispatcher System: Scheduling Algorithms (LOOK, SCAN, SSTF) & State Machines",
    category: "Real-World System Modeling",
    readTimeMinutes: 24,
    overview: "Elevator systems require complex real-time coordination, state machine transitions, and disk-scheduling algorithms applied to passenger transport. This masterclass designs a multi-car elevator bank, formalizing passenger request dispatching, the LOOK algorithm, and thread-safe movement simulation.",
    diagram: `+-------------------------------------------------------------------------+
|                  ELEVATOR DISPATCHER SYSTEM ARCHITECTURE                |
+-------------------------------------------------------------------------+
|                                                                         |
|  [HALL CALLS (External Passengers)]                                     |
|  Floor 5: Passenger presses [UP]                                        |
|  Floor 8: Passenger presses [DOWN]                                      |
|         |                                                               |
|         v                                                               |
|  [CENTRAL ELEVATOR DISPATCHER (Controller)]                             |
|  - Computes Estimated Time of Arrival (ETA) for each car                |
|  - Assigns call to Car with lowest cost penalty                         |
|         |                                                               |
|         +-------------------+-------------------+                       |
|         |                   |                   |                       |
|         v                   v                   v                       |
|  +---------------+   +---------------+   +---------------+              |
|  | ELEVATOR #1   |   | ELEVATOR #2   |   | ELEVATOR #3   |              |
|  | - Floor: 3    |   | - Floor: 10   |   | - Floor: 1    |              |
|  | - Dir: UP     |   | - Dir: DOWN   |   | - Dir: IDLE   |              |
|  | - State: MOVING   | - State: STOPPED  | - State: IDLE |              |
|  +---------------+   +---------------+   +---------------+              |
|         |                                                               |
|         v (LOOK Algorithm Execution)                                    |
|  1. Service all UP requests until top requested floor                   |
|  2. If no higher requests, reverse direction to DOWN                    |
|  3. Service all DOWN requests until lowest requested floor              |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The LOOK / SCAN Scheduling Engine",
        explanation: "A naive FCFS queue causes an elevator to bounce between Floor 1 and Floor 50 repeatedly. The LOOK algorithm maintains two sorted sets: `upStops` (sorted ascending) and `downStops` (sorted descending). The car travels upward, stopping at each requested floor. When `upStops` is empty, it checks `downStops`. If present, it flips direction to DOWN and descends, stopping at each floor. This minimizes motor travel and maximizes throughput.",
        codeExample: `enum Direction { UP, DOWN, IDLE }

class ElevatorScheduler {
  private upStops: Set<number> = new Set();
  private downStops: Set<number> = new Set();
  public currentFloor: number = 0;
  public direction: Direction = Direction.IDLE;

  public requestStop(targetFloor: number): void {
    if (targetFloor > this.currentFloor) this.upStops.add(targetFloor);
    else if (targetFloor < this.currentFloor) this.downStops.add(targetFloor);
    if (this.direction === Direction.IDLE) {
      this.direction = targetFloor >= this.currentFloor ? Direction.UP : Direction.DOWN;
    }
  }

  public getNextStop(): number | null {
    if (this.direction === Direction.UP) {
      const candidates = [...this.upStops].sort((a, b) => a - b);
      if (candidates.length > 0) return candidates[0];
      // Reverse direction if no more UP stops
      this.direction = this.downStops.size > 0 ? Direction.DOWN : Direction.IDLE;
    }
    if (this.direction === Direction.DOWN) {
      const candidates = [...this.downStops].sort((a, b) => b - a);
      if (candidates.length > 0) return candidates[0];
      this.direction = this.upStops.size > 0 ? Direction.UP : Direction.DOWN;
    }
    return null;
  }
}`
      },
      {
        subheading: "2. The Elevator Car Finite State Machine",
        explanation: "An elevator car transitions through well-defined operational states: `IDLE`, `MOVING`, `DOOR_OPENING`, `DOOR_OPEN`, `DOOR_CLOSING`, and `OUT_OF_SERVICE`. Passenger safety interlocks guarantee that the motor cannot engage in `MOVING` unless the door sensor confirms `DOOR_CLOSED`.",
        codeExample: `interface ElevatorState {
  pressInternalButton(floor: number): void;
  openDoor(): void;
  closeDoor(): void;
  tick(): void;
}

class DoorOpenState implements ElevatorState {
  constructor(private car: ElevatorCar) {}
  pressInternalButton(floor: number) { this.car.scheduleStop(floor); }
  openDoor() { console.log("Door already open; resetting hold timer."); }
  closeDoor() {
    if (!this.car.isObstacleDetected()) {
      this.car.transitionTo(this.car.doorClosedState);
    }
  }
  tick() { /* Auto-close countdown */ }
}`
      },
      {
        subheading: "3. Multi-Car Dispatch Optimization (Cost Function)",
        explanation: "When a hall button is pressed on Floor 6 (going UP), which elevator should answer? The central Dispatcher evaluates an Estimated Time of Arrival (ETA) cost function for every car: 1. Car moving toward caller in same direction = lowest cost. 2. Idle car nearby = moderate cost. 3. Car moving away or in opposite direction = highest cost penalty. The car with minimum score claims the hall call.",
        codeExample: `class ElevatorDispatcher {
  constructor(private cars: ElevatorCar[]) {}

  public dispatch(floor: number, direction: Direction): ElevatorCar {
    let bestCar = this.cars[0];
    let minCost = Infinity;

    for (const car of this.cars) {
      const cost = this.calculateCost(car, floor, direction);
      if (cost < minCost) {
        minCost = cost;
        bestCar = car;
      }
    }
    bestCar.assignHallCall(floor, direction);
    return bestCar;
  }

  private calculateCost(car: ElevatorCar, floor: number, dir: Direction): number {
    const dist = Math.abs(car.currentFloor - floor);
    if (car.direction === Direction.IDLE) return dist;
    if (car.direction === dir && ((dir === Direction.UP && car.currentFloor <= floor) || (dir === Direction.DOWN && car.currentFloor >= floor))) {
      return dist; // On the way in same direction!
    }
    return dist + 20; // Heavy penalty for opposite direction
  }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Starvation of distant floors: In high-rise buildings, peak morning traffic on lobby floors can starve penthouse callers without a maximum wait-time priority boost.",
      "Weight limit sensor overload: When passenger weight capacity (e.g. 1,000kg) is exceeded, car must hold doors open, sound alarm, and refuse to move.",
      "Fire Emergency Override: All cars must immediately abort schedules, ignore hall buttons, descend non-stop to the ground floor, open doors, and lock out."
    ],
    keyTakeaways: [
      "The LOOK algorithm prevents thrashing by servicing all requests in one direction before reversing.",
      "Differentiate Internal Car Calls (destination) from External Hall Calls (pickup).",
      "The Central Dispatcher uses an ETA cost penalty function to select the optimal car.",
      "Safety state machines ensure doors are fully closed and locked before motor engagement."
    ]
  },

  {
    id: "lld-deep-05",
    title: "Movie Ticket Booking (BookMyShow): High-Concurrency Seat Locking & Idempotency",
    category: "Real-World System Modeling",
    readTimeMinutes: 25,
    overview: "Movie ticket booking engines handle intense bursts of concurrent traffic during blockbuster openings. This masterclass architects a distributed seat reservation engine featuring atomic multi-seat holds, Time-To-Live (TTL) expiration, race condition mitigation, and double-booking prevention.",
    diagram: `+-------------------------------------------------------------------------+
|                  BOOKMYSHOW CONCURRENT SEAT RESERVATION FLOW            |
+-------------------------------------------------------------------------+
|                                                                         |
|  USER A (Clicks Seats A1, A2)            USER B (Clicks Seats A2, A3)   |
|         |                                      |                        |
|         +-------------------+------------------+                        |
|                             |                                           |
|                             v                                           |
|  [ATOMIC SEAT LOCK MANAGER (In-Memory Mutex / Redis Redlock)]           |
|  - Evaluates requested seat batch atomically                            |
|                                                                         |
|  EVALUATION FOR USER A:                 EVALUATION FOR USER B:          |
|  - Seats A1, A2: AVAILABLE              - Seat A2: ALREADY LOCKED (by A)|
|  - Action: Lock granted!                - Action: REJECT IMMEDIATELY    |
|  - lockedUntil: now + 10 mins           - Return: HTTP 409 Conflict     |
|                                                                         |
|        |                                                                |
|        +------------+ (User A proceeds to payment)                      |
|                     |                                                   |
|        +------------+------------+                                      |
|        | (Payment Success)       | (Payment Timeout / Abandoned)        |
|        v                         v                                      |
|  [CONFIRM BOOKING]         [SEAT HOLD EXPIRES]                          |
|  - State: BOOKED           - State: AVAILABLE (Auto-revert)             |
|  - Generate PDF Ticket     - Other users can now lock A1, A2            |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Three-State Seat Lifecycle & Atomic Reservation",
        explanation: "A seat cannot simply be 'available' or 'booked'. There must be an intermediate state: `LOCKED` (temporary reservation). When a user proceeds to checkout, seats are locked for 10 minutes. Crucially, the entire batch of requested seats (e.g. A1, A2, A3) must be acquired atomically. If 3 seats are requested, and 2 are free but 1 is locked, the transaction must fail completely without acquiring partial locks.",
        codeExample: `enum SeatStatus { AVAILABLE, LOCKED, BOOKED }

class ShowSeat {
  public status: SeatStatus = SeatStatus.AVAILABLE;
  public lockedByUserId: string | null = null;
  public lockExpiresAt: number = 0;

  public isAvailable(): boolean {
    if (this.status === SeatStatus.BOOKED) return false;
    if (this.status === SeatStatus.LOCKED && Date.now() < this.lockExpiresAt) return false;
    return true; // Available (or previous hold expired!)
  }
}`
      },
      {
        subheading: "2. Concurrency Safety: Preventing Double-Booking",
        explanation: "Under high concurrency, two users can check `isAvailable()` at the same microsecond and both proceed to lock. In a single-node LLD, synchronization must guard the lock transaction. In a distributed architecture, Redis `SET show:seat:A1 userId NX EX 600` ensures that exactly one caller sets the key, while all concurrent attempts fail cleanly in $O(1)$.",
        codeExample: `class BookingService {
  private seats: Map<string, ShowSeat> = new Map();
  private lock = new AsyncMutex();

  public async reserveSeats(seatIds: string[], userId: string): Promise<boolean> {
    return await this.lock.withLock(async () => {
      // 1. Verify ALL seats are available
      for (const id of seatIds) {
        const seat = this.seats.get(id);
        if (!seat || !seat.isAvailable()) return false; // Abort: at least 1 seat is taken
      }

      // 2. Lock ALL seats atomically
      const now = Date.now();
      for (const id of seatIds) {
        const seat = this.seats.get(id)!;
        seat.status = SeatStatus.LOCKED;
        seat.lockedByUserId = userId;
        seat.lockExpiresAt = now + 600000; // 10 minutes
      }
      return true;
    });
  }
}`
      },
      {
        subheading: "3. Payment Integration & Idempotent Confirmation",
        explanation: "Once the user completes payment via gateway webhook, the booking must be confirmed. The confirm method validates that: 1. The lock has not expired, 2. The lock belongs to this user, 3. The payment transaction ID is idempotent. If confirmed, state transitions to `BOOKED` and tickets are issued. If the user abandons payment, the TTL expires and subsequent callers automatically treat the seat as available.",
        codeExample: `public confirmBooking(seatIds: string[], userId: string, paymentRef: string): BookingConfirmation {
  for (const id of seatIds) {
    const seat = this.seats.get(id)!;
    if (seat.lockedByUserId !== userId || Date.now() > seat.lockExpiresAt) {
      throw new Error("Seat hold has expired. Refund initiated.");
    }
    seat.status = SeatStatus.BOOKED;
  }
  return new BookingConfirmation(paymentRef, seatIds);
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Payment succeeded after lock expiration: User takes 10 minutes and 2 seconds; seat was released and bought by someone else while bank processed charge. Requires automated refund orchestration.",
      "Deadlock on seat ordering: Thread 1 locks [A1, A2]; Thread 2 locks [A2, A1]. Always sort seat IDs lexicographically before acquiring locks.",
      "Ghost seats: Seats locked by users who close their browser tab. Solved naturally via TTL expiration."
    ],
    keyTakeaways: [
      "Seats require 3 states: Available -> Locked (with TTL) -> Booked.",
      "Batch reservations must be all-or-nothing: if one seat is unavailable, acquire zero locks.",
      "Sort seat IDs before acquiring multiple locks to eliminate deadlocks.",
      "Use passive TTL checks on read combined with active cleanup workers for seamless hold expiration."
    ]
  },

  {
    id: "lld-deep-06",
    title: "Splitwise Expense Sharing: Graph Min-Cash-Flow Transference Algorithm",
    category: "Real-World System Modeling",
    readTimeMinutes: 24,
    overview: "Expense sharing applications model complex interpersonal debt ledgers. This masterclass architects the Splitwise system, exploring split validation strategies (Equal, Exact, Percentage), group balance tracking, and the mathematical graph algorithm that minimizes cash flow to settle all debts with the fewest possible transactions.",
    diagram: `+-------------------------------------------------------------------------+
|                  SPLITWISE DEBT SIMPLIFICATION GRAPH ALGORITHM          |
+-------------------------------------------------------------------------+
|                                                                         |
|  BEFORE SIMPLIFICATION (Complex Web of Directed Debts):                 |
|                                                                         |
|     [Alice] ---------- owes $40 ----------> [Bob]                       |
|        |                                      |                         |
|        | owes $20                             | owes $40                |
|        v                                      v                         |
|     [Charlie] <-------- owes $30 ---------- [David]                     |
|                                                                         |
|  STEP 1: Calculate Net Balance for each individual:                     |
|  - Alice:   -$60  (Debtor)                                              |
|  - Bob:     +$0   (Settled!)                                            |
|  - Charlie: +$50  (Creditor)                                            |
|  - David:   +$10  (Creditor)                                            |
|                                                                         |
|  AFTER SIMPLIFICATION (Min-Cash-Flow: Reduces 4 payments to 2):         |
|                                                                         |
|     [Alice] ---------------- pays $50 ----------------> [Charlie]       |
|     [Alice] ---------------- pays $10 ----------------> [David]         |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Expense & Split Strategy Hierarchy",
        explanation: "An Expense contains: payer, total amount, metadata, and a list of `Split` objects. Using the Strategy Pattern, validation rules are decoupled: `ExactSplitValidator` asserts $\\sum \\text{amounts} == \\text{total}$; `PercentSplitValidator` asserts $\\sum \\text{percentages} == 100.0\\%$; `EqualSplitValidator` handles rounding pennies (e.g. $100 split 3 ways: $33.34 to user 1, $33.33 to users 2 and 3).",
        codeExample: `abstract class Split {
  constructor(public user: User, public amount: number = 0) {}
}

class EqualSplit extends Split {}
class ExactSplit extends Split {}
class PercentSplit extends Split {
  constructor(user: User, public percent: number) { super(user); }
}

interface ExpenseValidator {
  validate(total: number, splits: Split[]): boolean;
}`
      },
      {
        subheading: "2. Group Balance Sheet Maintenance",
        explanation: "Every user in a group maintains a directed balance sheet against every other peer: `balances: Map<User, number>`. If Alice pays $60 for Bob, Alice's balance with Bob increases by +$60, while Bob's balance with Alice decreases by -$60. This preserves full historical pairwise accountability.",
        codeExample: `class BalanceSheet {
  // balances.get(A).get(B) = amount B owes A
  private balances: Map<string, Map<string, number>> = new Map();

  public addDebt(lenderId: string, borrowerId: string, amount: number): void {
    this.updatePair(lenderId, borrowerId, amount);
    this.updatePair(borrowerId, lenderId, -amount);
  }

  private updatePair(u1: string, u2: string, amount: number) {
    if (!this.balances.has(u1)) this.balances.set(u1, new Map());
    const m = this.balances.get(u1)!;
    m.set(u2, (m.get(u2) || 0) + amount);
  }
}`
      },
      {
        subheading: "3. The Min-Cash-Flow Graph Simplification Algorithm",
        explanation: "Direct pairwise debts create circular dependencies (A owes B, B owes C, C owes A). The Min-Cash-Flow algorithm collapses this into minimal payments: 1. Calculate each user's net balance: `net = totalReceived - totalPaid`. 2. Separate into Debtors (`net < 0`) and Creditors (`net > 0`). 3. Greedily match the largest debtor with the largest creditor: `amount = min(|maxDebtor|, maxCreditor)`. Repeat until all balances are zero. This guarantees that $N$ people are completely settled in at most $N - 1$ transactions.",
        codeExample: `class MinCashFlowSimplifier {
  public static simplify(netBalances: Map<string, number>): { from: string; to: string; amount: number }[] {
    const debtors: { id: string; amount: number }[] = [];
    const creditors: { id: string; amount: number }[] = [];

    for (const [id, net] of netBalances.entries()) {
      if (net < -0.01) debtors.push({ id, amount: -net });
      else if (net > 0.01) creditors.push({ id, amount: net });
    }

    const settlements: { from: string; to: string; amount: number }[] = [];
    let i = 0, j = 0;

    while (i < debtors.length && j < creditors.length) {
      const settleAmount = Math.min(debtors[i].amount, creditors[j].amount);
      settlements.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(settleAmount * 100) / 100 });

      debtors[i].amount -= settleAmount;
      creditors[j].amount -= settleAmount;

      if (debtors[i].amount <= 0.01) i++;
      if (creditors[j].amount <= 0.01) j++;
    }
    return settlements;
  }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Precision and Penny Rounding: $100 / 3 = 33.3333...$ Integer cents arithmetic must distribute extra pennies to avoid accumulating drift.",
      "Multi-Currency Expenses: A group having expenses in USD, EUR, and INR cannot simplify debts without real-time exchange rate locking and FX fee models.",
      "User Deletion Invariant: A user cannot leave or delete their account if their net balance != 0."
    ],
    keyTakeaways: [
      "Use Strategy Pattern for split calculations (Equal, Exact, Percent).",
      "Net Balance = sum of all money paid minus sum of all money owed across all expenses.",
      "The Min-Cash-Flow greedy algorithm settles all group debts in at most N - 1 transactions.",
      "Always store financial currency amounts as integer cents to avoid floating-point rounding errors."
    ]
  },

  {
    id: "lld-deep-07",
    title: "Rate Limiter Engine: Token Bucket, Leaky Bucket & Sliding Window Under High Concurrency",
    category: "Traffic Control & Algorithms",
    readTimeMinutes: 26,
    overview: "Rate limiting protects distributed services from resource exhaustion, brute force attacks, and noisy neighbors. This masterclass rigorously contrasts the mathematical behavior of Token Bucket, Leaky Bucket, Fixed Window, and Sliding Window algorithms, analyzing memory consumption, burst handling, and lock contention.",
    diagram: `+-------------------------------------------------------------------------+
|                  RATE LIMITING ALGORITHMS ARCHITECTURAL MATRIX          |
+-------------------------------------------------------------------------+
|                                                                         |
|  1. TOKEN BUCKET (Refill Rate + Burst Capacity):                        |
|  [Capacity: 10 Tokens] <--- Refilled at 2 tokens/sec                    |
|  Request arrives -> Takes 1 token. Can burst up to 10 instantly!        |
|                                                                         |
|  2. LEAKY BUCKET (FIFO Queue with Constant Egress Rate):                |
|  Incoming Bursts ---> [FIFO Queue: Capacity 5]                          |
|                             |                                           |
|                             v Leaks at smooth 1 request/sec             |
|                       [Downstream Service]                              |
|                                                                         |
|  3. FIXED WINDOW COUNTER (Vulnerable to 2x Boundary Bursts):           |
|  [ Window 1: 10:00 - 10:01 ]      [ Window 2: 10:01 - 10:02 ]           |
|       10:00:59: 100 requests            10:01:01: 100 requests          |
|  ===> 200 requests in 2 seconds! (Double the configured limit!)         |
|                                                                         |
|  4. SLIDING WINDOW COUNTER (Weighted Rolling Interpolation):           |
|  Estimated = prevCount * (remaining window %) + currCount               |
|  Smooth rolling calculation with O(1) memory and zero boundary bursts!  |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Token Bucket: Lazy Elapsed-Time Refill",
        explanation: "A naive token bucket runs a background interval timer to add tokens. In a system with 500,000 active API keys, running 500,000 timers crashes the runtime. The mathematical solution is lazy evaluation: whenever a request arrives, calculate elapsed time since `lastRefillTime`, compute `tokensToAdd = elapsed * refillRate`, add tokens capped at capacity, and decrement 1 token. Zero timers needed.",
        codeExample: `class LazyTokenBucket {
  private tokens: number;
  private lastRefill: number = Date.now();
  constructor(private capacity: number, private refillRatePerSec: number) {
    this.tokens = capacity;
  }

  public allow(): boolean {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRatePerSec);
    this.lastRefill = now;

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return true;
    }
    return false;
  }
}`
      },
      {
        subheading: "2. Sliding Window Counter: Weighted Interpolation",
        explanation: "Sliding Window Log stores every timestamp, consuming megabytes of RAM. Sliding Window Counter achieves 99% accuracy using only 2 integer counters: `previousWindowCount` and `currentWindowCount`. If we are 40% into the current window, the estimated load is $60\\% \\times \\text{prevCount} + \\text{currCount}$. This eliminates the 2x boundary burst while maintaining $O(1)$ memory.",
        codeExample: `class SlidingWindowCounter {
  private windowMs: number = 60000;
  private prevCount = 0; private currCount = 0;
  private currentWindowStart = Math.floor(Date.now() / 60000) * 60000;

  public allow(limit: number): boolean {
    const now = Date.now();
    const windowStart = Math.floor(now / this.windowMs) * this.windowMs;

    if (windowStart !== this.currentWindowStart) {
      this.prevCount = (windowStart - this.currentWindowStart === this.windowMs) ? this.currCount : 0;
      this.currCount = 0;
      this.currentWindowStart = windowStart;
    }

    const elapsedRatio = (now - this.currentWindowStart) / this.windowMs;
    const estimated = Math.floor(this.prevCount * (1 - elapsedRatio)) + this.currCount;

    if (estimated < limit) {
      this.currCount++;
      return true;
    }
    return false;
  }
}`
      },
      {
        subheading: "3. Distributed Concurrency & Redis Lua Atomicity",
        explanation: "In distributed systems, multiple API gateway pods evaluate rate limits concurrently against Redis. If two pods execute `GET` then `SET`, race conditions allow double the traffic. The read-modify-write operation must be executed atomically inside Redis using a Lua script.",
        codeExample: `-- Atomic Token Bucket in Redis Lua:
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])

local data = redis.call('HMGET', key, 'tokens', 'last_refill')
local tokens = tonumber(data[1]) or capacity
local last_refill = tonumber(data[2]) or now

local elapsed = math.max(0, now - last_refill)
tokens = math.min(capacity, tokens + elapsed * refill_rate)

if tokens >= 1 then
    tokens = tokens - 1
    redis.call('HMSET', key, 'tokens', tokens, 'last_refill', now)
    redis.call('EXPIRE', key, 3600)
    return 1 -- Allowed
else
    return 0 -- Throttled
end`
      }
    ],
    edgeCasesAndPitfalls: [
      "Clock drift across distributed servers: Servers with unsynchronized clocks cause rate limits to reset prematurely. Use central Redis timestamps.",
      "Cold start burst starvation: If refill rate is low and a user makes 0 requests for 2 days, they can suddenly fire a huge burst that degrades downstream microservices.",
      "Key explosion in memory: Storing rate limit records for millions of transient IP scrapers exhausts RAM. Set aggressive TTLs (e.g. 1 hour) on all limiter keys."
    ],
    keyTakeaways: [
      "Token Bucket allows traffic bursts up to capacity; Leaky Bucket forces smooth constant egress.",
      "Fixed Window suffers from 2x boundary bursts around window edges.",
      "Sliding Window Counter uses weighted overlap for O(1) memory and zero boundary bursts.",
      "Always compute token refills lazily on call using elapsed timestamps; never use background timers."
    ]
  },

  {
    id: "lld-deep-08",
    title: "In-Memory Pub-Sub Engine: Topics, Partitions, Consumer Groups & Thread-Safe Queuing",
    category: "Infrastructure & Messaging",
    readTimeMinutes: 25,
    overview: "Publish-Subscribe messaging underpins decoupled event-driven architectures. This masterclass designs a full-featured in-memory Pub-Sub engine inspired by Apache Kafka, implementing topics, partitioned message logs, consumer groups with offset tracking, and fair rebalancing.",
    diagram: `+-------------------------------------------------------------------------+
|                  IN-MEMORY PARTITIONED PUB-SUB ARCHITECTURE             |
+-------------------------------------------------------------------------+
|                                                                         |
|  PRODUCERS:                                                             |
|  producer.publish("orders", orderPayload)                               |
|         |                                                               |
|         v (Partition Key Hashing: hash(orderId) % 2)                    |
|  [TOPIC: "orders"]                                                      |
|  +-------------------------------------------------------------------+  |
|  | PARTITION 0: [msg 0] -> [msg 1] -> [msg 2] -> [msg 3] (Head: 4)    |  |
|  +-------------------------------------------------------------------+  |
|  | PARTITION 1: [msg 0] -> [msg 1] -> [msg 2]            (Head: 3)    |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  CONSUMER GROUP "billing-workers" (Load Balanced across Partitions):    |
|  +---------------------------+       +-------------------------------+  |
|  | Consumer Worker A         |       | Consumer Worker B             |  |
|  | Assigned: Partition 0     |       | Assigned: Partition 1         |  |
|  | Current Offset: 2         |       | Current Offset: 3 (Caught up!)|  |
|  +---------------------------+       +-------------------------------+  |
|                                                                         |
|  CONSUMER GROUP "analytics-audit" (Independent Offsets):                |
|  +-------------------------------------------------------------------+  |
|  | Single Consumer Worker C (Assigned BOTH Partitions 0 and 1)       |  |
|  | Offsets: P0 -> 1, P1 -> 2                                         |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Topics & Partition Append-Only Log",
        explanation: "A simple Observer broadcast cannot scale horizontally. A partitioned topic divides incoming messages across $N$ independent, ordered queues. Each partition maintains an append-only array of `Message` objects. Messages within a single partition are guaranteed strictly ordered by a monotonic 64-bit integer `offset`. Different partitions can be processed in parallel across different CPU cores.",
        codeExample: `class Partition {
  public messages: Message[] = [];
  private lock = new AsyncMutex();

  public async append(payload: any): Promise<number> {
    return await this.lock.withLock(async () => {
      const offset = this.messages.length;
      this.messages.push(new Message(offset, payload, Date.now()));
      return offset;
    });
  }

  public readFrom(offset: number, maxBatch: number = 10): Message[] {
    return this.messages.slice(offset, offset + maxBatch);
  }
}`
      },
      {
        subheading: "2. Consumer Groups & Partition Assignment",
        explanation: "A Consumer Group enables horizontal scaling. If a topic has 4 partitions and a Consumer Group has 2 consumers, each consumer is assigned 2 partitions. If 4 consumers exist, each gets 1 partition. If 5 consumers exist, 1 sits idle as an active standby. Inside the consumer group, each consumer independently reads its assigned partitions and commits its progress offset.",
        codeExample: `class ConsumerGroupManager {
  private consumers: string[] = [];
  private partitionAssignments: Map<string, number[]> = new Map(); // consumerId -> partitionIndices

  public rebalance(totalPartitions: number): void {
    this.partitionAssignments.clear();
    if (this.consumers.length === 0) return;

    // Round-robin partition distribution
    for (let p = 0; p < totalPartitions; p++) {
      const assignedConsumer = this.consumers[p % this.consumers.length];
      if (!this.partitionAssignments.has(assignedConsumer)) {
        this.partitionAssignments.set(assignedConsumer, []);
      }
      this.partitionAssignments.get(assignedConsumer)!.push(p);
    }
  }
}`
      },
      {
        subheading: "3. Offset Commit & Delivery Semantics",
        explanation: "Delivery guarantees depend on when offsets are committed: 1. At-Most-Once: Consumer reads messages, commits offset immediately, then processes. If processing crashes, message is lost. 2. At-Least-Once: Consumer processes message, then commits offset. If crash occurs during processing, message is re-read upon restart (requires consumer idempotency). 3. Exactly-Once: Requires two-phase transactional coordination between offset commit and downstream state store.",
        codeExample: `class ConsumerWorker {
  constructor(private group: string, private partition: Partition) {}

  public async pollAndProcess(handler: (msg: Message) => Promise<void>, offsetStore: OffsetStore) {
    let offset = await offsetStore.getOffset(this.group, this.partition.id);
    const batch = this.partition.readFrom(offset, 10);

    for (const msg of batch) {
      await handler(msg); // 1. Process business logic
      offset = msg.offset + 1;
      await offsetStore.commitOffset(this.group, this.partition.id, offset); // 2. At-Least-Once commit!
    }
  }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Slow Consumer Lag: A slow consumer falls thousands of messages behind, holding uncollected memory in the in-memory partition log. Requires retention expiration or ring buffer caps.",
      "Rebalance Storm: Rapidly adding and removing consumer instances triggers endless partition rebalancing, halting message consumption.",
      "Partition Hot-Spotting: Using a poor partition key (e.g. `country === 'US'` for 90% of traffic) sends all messages to Partition 0 while Partitions 1-3 sit idle."
    ],
    keyTakeaways: [
      "Topics partition messages to enable concurrent, parallel processing.",
      "Consumer Groups share partitions; each partition is owned by exactly one consumer per group.",
      "Consumers track their own committed offsets, allowing independent replay and rewind.",
      "At-Least-Once delivery requires idempotent consumers to handle duplicate replays safely."
    ]
  },

  {
    id: "lld-deep-09",
    title: "Finite State Machine Architecture: Vending Machine, ATM & Order Processing",
    category: "Behavioral Patterns & State Orchestration",
    readTimeMinutes: 22,
    overview: "Stateful systems like ATMs, Vending Machines, and Order Lifecycles quickly degenerate into unmaintainable switch-case anti-patterns. This masterclass formalizes the GoF State Pattern, implementing self-validating state transitions, context data management, and rollback handling.",
    diagram: `+-------------------------------------------------------------------------+
|                  VENDING MACHINE FINITE STATE TRANSITION GRAPH          |
+-------------------------------------------------------------------------+
|                                                                         |
|            +------------------ insertCoin() -------------------+        |
|            |                                                   |        |
|            v                                                   |        |
|     +-------------+                        +-----------------------+    |
|  +->|    IDLE     |<--- cancel/refund() ---|       HAS_MONEY       |    |
|  |  +-------------+                        +-----------------------+    |
|  |                                                     |                |
|  |                                              selectItem()            |
|  |                                                     v                |
|  |  +-------------+                        +-----------------------+    |
|  +--|  SOLD_OUT   |<--- stock == 0 --------|      DISPENSING       |    |
|     +-------------+                        +-----------------------+    |
|            ^                                           |                |
|            +----------- dispense() + stock == 0 -------+                |
|                                                                         |
|  Invariants:                                                            |
|  - Cannot selectItem() in IDLE state                                    |
|  - Cannot refund() in DISPENSING state                                  |
|  - insertCoin() in SOLD_OUT state immediately rejects coin              |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The State Pattern Interface & Context Delegation",
        explanation: "Instead of putting state checks inside `if (state === 'IDLE')` ladders, define an interface where each state method represents a valid user or system action. The `VendingMachine` context holds a reference to the active `State` object. Calling `machine.insertCoin()` simply delegates to `this.currentState.insertCoin()`. Invalid actions throw informative exceptions or log rejections automatically.",
        codeExample: `interface State {
  insertMoney(amount: number): void;
  selectProduct(code: string): void;
  dispense(): void;
  cancel(): number;
}

class VendingContext {
  public idleState = new IdleState(this);
  public hasMoneyState = new HasMoneyState(this);
  public dispensingState = new DispensingState(this);
  public soldOutState = new SoldOutState(this);

  private currentState: State = this.idleState;
  public balance: number = 0;

  public transitionTo(state: State) { this.currentState = state; }
  public insertMoney(amount: number) { this.currentState.insertMoney(amount); }
  public selectProduct(code: string) { this.currentState.selectProduct(code); }
}`
      },
      {
        subheading: "2. Concrete State Transitions & Encapsulated Invariants",
        explanation: "Each state class implements valid behaviors and handles transitions. For example, `HasMoneyState.selectProduct()` checks if `machine.balance >= item.price`. If yes, it transitions the context to `DispensingState`. If no, it prompts for more coins. The business logic for 'Has Money' is completely isolated from 'Dispensing'.",
        codeExample: `class HasMoneyState implements State {
  constructor(private context: VendingContext) {}

  insertMoney(amount: number) {
    this.context.balance += amount;
    console.log(\`Updated balance: $\${this.context.balance}\`);
  }

  selectProduct(code: string) {
    const item = this.context.inventory.get(code);
    if (!item) throw new Error("Invalid product code");
    if (this.context.balance < item.price) {
      console.log(\`Insufficient funds. Need $\${item.price - this.context.balance} more.\`);
      return;
    }
    // Valid transition!
    this.context.transitionTo(this.context.dispensingState);
    this.context.dispense();
  }

  cancel(): number {
    const refund = this.context.balance;
    this.context.balance = 0;
    this.context.transitionTo(this.context.idleState);
    return refund;
  }

  dispense() { throw new Error("Select product first before dispensing."); }
}`
      },
      {
        subheading: "3. Handling Re-entrancy, Timeouts & Change Calculation",
        explanation: "What if a user inserts $5 for a $1.25 soda, but the machine lacks exact coin change? In `DispensingState`, the machine must verify coin availability *before* dropping the item. If exact change is impossible, it cancels the transaction, refunds the $5 bill, and returns to `IdleState` without dispensing, protecting both the customer and machine inventory.",
        codeExample: `class DispensingState implements State {
  constructor(private context: VendingContext) {}

  dispense() {
    const change = this.context.calculateChange();
    if (!this.context.hasExactCoins(change)) {
      console.warn("Cannot dispense exact change! Aborting transaction.");
      this.context.refundFullBalance();
      this.context.transitionTo(this.context.idleState);
      return;
    }

    this.context.dropProduct();
    this.context.dispenseCoins(change);
    this.context.transitionTo(this.context.inventoryCount > 0 ? this.context.idleState : this.context.soldOutState);
  }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Circular memory leaks between Context and State instances: States holding strong back-references to Context. Solved by passing Context as method parameter or using WeakRef.",
      "State explosion: When an entity has 20 interdependent boolean flags, creating $2^{20}$ state classes is impossible. Use Hierarchical State Machines (Statecharts) or orthogonal regions.",
      "Unhandled power cut: If the machine reboots mid-dispense, an idempotent journal or WAL must restore the exact state to refund or complete dispense."
    ],
    keyTakeaways: [
      "The State pattern replaces sprawling switch-case ladders with polymorphic state classes.",
      "The Context delegates user actions directly to the active State object.",
      "State transitions are controlled by states themselves or centrally by the context.",
      "Check change availability and inventory invariants before committing irreversible state transitions."
    ]
  },

  {
    id: "lld-deep-10",
    title: "Undo/Redo & Transactional Command Pattern: History Stacks & Reversible State",
    category: "Behavioral Patterns & State Orchestration",
    readTimeMinutes: 22,
    overview: "The Command pattern transforms actions into first-class objects, enabling deferred execution, job queuing, transaction logging, and multi-level Undo/Redo. This masterclass designs a production-grade document editor history engine, exploring memory-bounded history stacks and reversible inverse operations.",
    diagram: `+-------------------------------------------------------------------------+
|                  COMMAND PATTERN UNDO / REDO HISTORY ENGINE             |
+-------------------------------------------------------------------------+
|                                                                         |
|  USER TYPES "Hello World" -> execute(InsertTextCommand("Hello World"))  |
|                                                                         |
|  UNDO STACK (LIFO):                     REDO STACK (LIFO):              |
|  +-----------------------------+        +-----------------------------+ |
|  | InsertTextCommand("World")  | (TOP)  |  (Empty on fresh command)   | |
|  +-----------------------------+        +-----------------------------+ |
|  | InsertTextCommand("Hello ") |                                        |
|  +-----------------------------+                                        |
|                                                                         |
|  ACTION 1: USER PRESSES [UNDO]:                                         |
|  1. Pop InsertTextCommand("World") from Undo Stack                      |
|  2. Invoke command.undo() -> erases "World" from document               |
|  3. Push InsertTextCommand("World") onto Redo Stack                     |
|                                                                         |
|  UNDO STACK:                            REDO STACK:                     |
|  +-----------------------------+        +-----------------------------+ |
|  | InsertTextCommand("Hello ") | (TOP)  | InsertTextCommand("World")  | |
|  +-----------------------------+        +-----------------------------+ |
|                                                                         |
|  ACTION 2: USER TYPES "Antigravity" (New Action):                       |
|  - Executes InsertTextCommand("Antigravity")                            |
|  - Pushes onto Undo Stack                                               |
|  - CLEARS REDO STACK ENTIRELY! (Redo history invalidates on branch)     |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Command Interface & Receiver Decoupling",
        explanation: "The Command pattern decouples the Invoker (a UI Menu item or shortcut key) from the Receiver (the Document or Canvas). The Command object packages the receiver reference along with the exact arguments needed to execute the action. It defines two methods: `execute()` and `undo()`.",
        codeExample: `interface Command {
  execute(): void;
  undo(): void;
}

// Receiver
class TextDocument {
  public text: string = "";
  insert(pos: number, str: string) { this.text = this.text.slice(0, pos) + str + this.text.slice(pos); }
  delete(pos: number, len: number) { this.text = this.text.slice(0, pos) + this.text.slice(pos + len); }
}

// Concrete Command stores exact inverse operation
class InsertCommand implements Command {
  constructor(private doc: TextDocument, private pos: number, private insertedText: string) {}
  execute(): void { this.doc.insert(this.pos, this.insertedText); }
  undo(): void { this.doc.delete(this.pos, this.insertedText.length); }
}`
      },
      {
        subheading: "2. Dual Stack Undo/Redo Orchestrator",
        explanation: "Managing history requires two stacks: `undoStack` and `redoStack`. Executing a fresh command pushes it onto `undoStack` and empties `redoStack`. Pressing Undo pops from `undoStack`, invokes `command.undo()`, and pushes to `redoStack`. Pressing Redo pops from `redoStack`, invokes `command.execute()`, and pushes back to `undoStack`.",
        codeExample: `class CommandHistoryManager {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory: number;

  constructor(maxHistory: number = 50) { this.maxHistory = maxHistory; }

  public executeCommand(cmd: Command): void {
    cmd.execute();
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.maxHistory) this.undoStack.shift(); // Evict oldest
    this.redoStack = []; // Invalidate redo tree on new action
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
}`
      },
      {
        subheading: "3. Macro Commands & Transactional Rollbacks",
        explanation: "A Macro Command (Composite Pattern) packages multiple commands into a single batch. If step 4 of a 5-step macro fails, the macro iterates backward through the already-executed steps (steps 3, 2, 1), calling `undo()` to guarantee all-or-nothing transactional integrity.",
        codeExample: `class MacroCommand implements Command {
  private commands: Command[] = [];
  public add(cmd: Command) { this.commands.push(cmd); }

  execute(): void {
    const executed: Command[] = [];
    try {
      for (const cmd of this.commands) {
        cmd.execute();
        executed.push(cmd);
      }
    } catch (err) {
      console.error("Macro failed mid-execution! Rolling back executed steps...");
      for (let i = executed.length - 1; i >= 0; i--) {
        executed[i].undo();
      }
      throw err;
    }
  }

  undo(): void {
    // Undo in reverse order of execution!
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Unbounded memory growth: Storing 100,000 full document snapshots inside commands exhausts memory. Store delta diffs or enforce a strict maxHistory limit.",
      "Typing keystroke explosion: Creating an individual command for every single typed character floods history. Group adjacent keystrokes into a single WordCommand.",
      "Non-invertible operations: Irreversible actions (sending an external email or formatting a drive) cannot be undone. Command must flag `canUndo(): false` to warn user."
    ],
    keyTakeaways: [
      "Command pattern encapsulates a request into an object with execute() and undo().",
      "Two LIFO stacks (undoStack and redoStack) power multi-level history navigation.",
      "Executing any fresh command must invalidate and clear the Redo stack.",
      "Macro Commands combine the Composite and Command patterns for transactional all-or-nothing batch execution."
    ]
  },

  {
    id: "lld-deep-11",
    title: "In-Memory Key-Value Store with ACID Transactions: MVCC, Rollbacks & WAL",
    category: "In-Memory Storage & Caches",
    readTimeMinutes: 26,
    overview: "In-memory transactional storage engines power modern key-value databases, financial ledger ledgers, and state machine caches. This masterclass designs an in-memory Key-Value store supporting multi-level nested transactions, BEGIN/COMMIT/ROLLBACK semantics, and Multi-Version Concurrency Control (MVCC).",
    diagram: `+-------------------------------------------------------------------------+
|                  TRANSACTIONAL KEY-VALUE STORE ARCHITECTURE             |
+-------------------------------------------------------------------------+
|                                                                         |
|  GLOBAL STORAGE (Committed State):                                      |
|  {"user:1" -> "Alice", "balance:1" -> "100"}                            |
|                                                                         |
|  TRANSACTION SESSION (Nested Transaction Stacks):                       |
|                                                                         |
|  > BEGIN                                                                |
|    - Pushes fresh Transaction Frame to stack                            |
|                                                                         |
|  > SET balance:1 150                                                    |
|    - Records old value "100" in Undo Log Frame                          |
|    - Writes local overlay mutation: {"balance:1" -> "150"}              |
|                                                                         |
|  > BEGIN (Nested Level 2)                                               |
|  > SET user:1 "Alice Smith"                                             |
|    - Frame 2 records old value "Alice" in Undo Log                      |
|                                                                         |
|  > ROLLBACK (Level 2)                                                   |
|    - Pops Frame 2, applies undo log: user:1 reverts to "Alice"!         |
|    - balance:1 remains "150" in Frame 1                                 |
|                                                                         |
|  > COMMIT (Level 1)                                                     |
|    - Merges Frame 1 overlay into Global Storage atomically              |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Transaction Frames & Delta Overlays",
        explanation: "How do you implement `BEGIN`, `COMMIT`, and `ROLLBACK` in memory without copying the entire database on every `BEGIN`? Maintain a stack of Transaction Frames. Each frame holds a delta map of local modifications and an undo log of old values. When `get(key)` is called, search from the topmost transaction frame down to the global committed store.",
        codeExample: `class TransactionFrame {
  public mutations: Map<string, any> = new Map();
  public undoLog: Map<string, any | null> = new Map(); // Records original value before mutation
}

class TransactionalKVStore {
  private globalStore: Map<string, any> = new Map();
  private transactionStack: TransactionFrame[] = [];

  public begin(): void {
    this.transactionStack.push(new TransactionFrame());
  }

  public get(key: string): any | null {
    // Check from topmost transaction frame downward
    for (let i = this.transactionStack.length - 1; i >= 0; i--) {
      const frame = this.transactionStack[i];
      if (frame.mutations.has(key)) return frame.mutations.get(key);
    }
    return this.globalStore.get(key) ?? null;
  }
}`
      },
      {
        subheading: "2. Atomic Commit & Rollback Mechanics",
        explanation: "When `rollback()` is called, pop the top transaction frame. Because local mutations were stored only in the frame, dropping it rolls back all uncommitted writes instantly. When `commit()` is called: if nested, merge changes into the parent transaction frame; if it is the root transaction, flush all mutations into the permanent `globalStore`.",
        codeExample: `public set(key: string, value: any): void {
  if (this.transactionStack.length === 0) {
    this.globalStore.set(key, value); // Direct auto-commit write
    return;
  }

  const top = this.transactionStack[this.transactionStack.length - 1];
  if (!top.undoLog.has(key)) {
    // Record current visible value in undo log on first touch
    top.undoLog.set(key, this.get(key));
  }
  top.mutations.set(key, value);
}

public commit(): void {
  if (this.transactionStack.length === 0) throw new Error("No active transaction to commit");
  const top = this.transactionStack.pop()!;

  if (this.transactionStack.length > 0) {
    // Nested commit: Merge changes into parent transaction frame
    const parent = this.transactionStack[this.transactionStack.length - 1];
    for (const [k, v] of top.mutations.entries()) {
      if (!parent.undoLog.has(k)) parent.undoLog.set(k, top.undoLog.get(k));
      parent.mutations.set(k, v);
    }
  } else {
    // Root commit: Flush mutations into global store
    for (const [k, v] of top.mutations.entries()) {
      this.globalStore.set(k, v);
    }
  }
}

public rollback(): void {
  if (this.transactionStack.length === 0) throw new Error("No active transaction to rollback");
  this.transactionStack.pop(); // Discard frame completely!
}`
      },
      {
        subheading: "3. Multi-Version Concurrency Control (MVCC) Basics",
        explanation: "In multi-threaded environments, reading threads cannot block writing threads. MVCC assigns a monotonic timestamp / version ID to every write. A reader querying at timestamp $T$ reads the highest version $\\le T$. Deadlocks are avoided because readers never lock writers, and writers never block readers.",
        codeExample: `class MVCCRecord {
  // Ordered history of versions: [{ version: 1, val: "A" }, { version: 5, val: "B" }]
  public versions: { version: number; val: any }[] = [];

  public getAtVersion(readVersion: number): any | null {
    for (let i = this.versions.length - 1; i >= 0; i--) {
      if (this.versions[i].version <= readVersion) return this.versions[i].val;
    }
    return null;
  }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Dirty Reads across concurrent sessions: Session A sets a key inside an uncommitted transaction; Session B reads it. Solved via isolation levels (Read Committed requires frame isolation).",
      "Memory leak from uncommitted abandoned transactions: Forgetting to call commit() or rollback() leaves frames on the stack indefinitely. Require try-finally blocks or session timeouts.",
      "Write-Write conflict in MVCC: Two concurrent transactions attempt to update the same key at version 5. First committer wins; second committer aborts with serialization failure."
    ],
    keyTakeaways: [
      "Transaction stacks allow nested BEGIN/COMMIT/ROLLBACK without copying the entire database.",
      "Delta overlays store uncommitted writes locally; rollback is an O(1) stack pop.",
      "Nested commits merge into parent frames; root commits flush directly to global storage.",
      "MVCC versioning allows concurrent reads without locking writers, maximizing throughput."
    ]
  },

  {
    id: "lld-deep-12",
    title: "Clean Architecture & Domain-Driven Design (DDD): Aggregates, Value Objects & Hexagonal Ports",
    category: "Architecture & Domain Modeling",
    readTimeMinutes: 25,
    overview: "Enterprise software fails when business rules are tightly coupled to Express controllers, TypeORM entities, and AWS SDKs. This masterclass formalizes Clean Architecture and Domain-Driven Design (DDD), implementing pure domain entities, immutable value objects, aggregate consistency boundaries, and hexagonal ports & adapters.",
    diagram: `+-------------------------------------------------------------------------+
|                  CLEAN ARCHITECTURE CONCENTRIC DOMAIN LAYERS            |
+-------------------------------------------------------------------------+
|                                                                         |
|  [INFRASTRUCTURE & ADAPTERS (Outermost Layer)]                          |
|  - Express HTTP Controllers, TypeORM Postgres Adapters, AWS S3 Client   |
|         |                                                               |
|         | Implements (DIP)                                              |
|         v                                                               |
|  [APPLICATION USE CASES (Orchestration Layer)]                          |
|  - PlaceOrderUseCase, RegisterUserUseCase                               |
|  - Defines Output Ports (IOrderRepository, INotificationGateway)        |
|         |                                                               |
|         | Calls                                                         |
|         v                                                               |
|  [DOMAIN MODEL (Innermost Core - 100% Pure, Zero Frameworks)]          |
|  +-------------------------------------------------------------------+  |
|  | AGGREGATE ROOT: Order                                             |  |
|  | - OrderId (Value Object)                                          |  |
|  | - LineItems: LineItem[] (Internal Entity)                         |  |
|  | - Money (Immutable Value Object with Currency Invariants)         |  |
|  | - Domain Events: [OrderPlacedEvent]                               |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  RULE OF DEPENDENCY: Arrows point strictly INWARD toward the Domain!   |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Anatomy of an Immutable Value Object",
        explanation: "Value Objects have no identity. They are defined entirely by their attributes and are completely immutable. Primitive obsession (using raw numbers for money or strings for emails) causes logic duplication. Encapsulating values into self-validating Value Objects guarantees that an invalid state can never exist in memory.",
        codeExample: `// Pure Value Object (Zero external imports)
class Money {
  constructor(public readonly amountCents: number, public readonly currency: string) {
    if (amountCents < 0) throw new Error("Money amount cannot be negative");
    if (!currency || currency.length !== 3) throw new Error("Currency must be 3-letter ISO code");
    Object.freeze(this);
  }

  public add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error(\`Currency mismatch: \${this.currency} vs \${other.currency}\`);
    }
    return new Money(this.amountCents + other.amountCents, this.currency);
  }

  public equals(other: Money): boolean {
    return this.amountCents === other.amountCents && this.currency === other.currency;
  }
}`
      },
      {
        subheading: "2. Aggregates & Invariant Boundaries",
        explanation: "An Aggregate Root is the gatekeeper of a transactional consistency boundary. External code can never directly mutate an internal child entity. For example, you cannot call `order.lineItems[0].price = 10`. You must invoke `order.updateItemPrice(sku, newPrice)`, enabling the Aggregate Root to recalculate totals, enforce minimum purchase limits, and register Domain Events.",
        codeExample: `class OrderAggregate {
  private lineItems: Map<string, { price: Money; qty: number }> = new Map();
  public domainEvents: any[] = [];

  constructor(public readonly orderId: string, private customerId: string) {}

  public addLineItem(sku: string, price: Money, qty: number): void {
    if (qty <= 0) throw new Error("Quantity must be at least 1");
    this.lineItems.set(sku, { price, qty });
  }

  public calculateTotal(): Money {
    let total = new Money(0, "USD");
    for (const item of this.lineItems.values()) {
      const itemTotal = new Money(item.price.amountCents * item.qty, item.price.currency);
      total = total.add(itemTotal);
    }
    return total;
  }
}`
      },
      {
        subheading: "3. Hexagonal Ports & Adapters Architecture",
        explanation: "The Application layer defines Output Ports (interfaces). The Infrastructure layer provides concrete Adapters. When testing the `PlaceOrderUseCase`, inject an `InMemoryOrderRepository` mock. In production, inject `PostgresOrderRepository`. The Use Case code is identical in both environments.",
        codeExample: `// Port (Interface)
interface OrderRepositoryPort {
  save(order: OrderAggregate): Promise<void>;
  findById(id: string): Promise<OrderAggregate | null>;
}

// Use Case
class PlaceOrderUseCase {
  constructor(private orderRepo: OrderRepositoryPort) {}

  async execute(order: OrderAggregate): Promise<void> {
    const total = order.calculateTotal();
    if (total.amountCents < 500) throw new Error("Minimum order total is $5.00");
    await this.orderRepo.save(order);
  }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Leaking ORM annotations into Domain Entities: Decorating domain classes with `@Column()` or `@Entity()` couples your core domain to TypeORM or Hibernate.",
      "Bloated Aggregates: Putting all user orders, invoices, and profile data into a single giant User aggregate causes extreme database lock contention. Keep aggregates small and reference others by ID.",
      "Direct entity mutation via exposed array references: Returning `this.items` directly allows external callers to `push()` items, bypassing aggregate invariant checks. Return cloned arrays or unmodifiable collections."
    ],
    keyTakeaways: [
      "Clean Architecture enforces inward dependency direction: Domain has 0 framework imports.",
      "Value Objects are immutable, self-validating, and compared by attribute values.",
      "Aggregate Roots protect internal entities and enforce transactional consistency invariants.",
      "Ports define interface contracts; Adapters connect external databases, APIs, and UIs."
    ]
  }
];

const outputPath = path.join(__dirname, '../data/lld.deep.json');
fs.writeFileSync(outputPath, JSON.stringify(deepDives, null, 2), 'utf-8');
console.log(`Successfully wrote ${deepDives.length} Deep Dive chapters to ${outputPath}`);
