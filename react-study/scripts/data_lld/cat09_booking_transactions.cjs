const { createCard } = require('../lld_builder_helper.cjs');

const category = "Real-World Transactional & Booking Systems";

module.exports = [
  createCard({
    idNum: 97,
    category,
    concept: "Parking Lot System Architecture",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you architect an extensible Parking Lot system supporting multiple vehicle types, spot allocation strategies, and dynamic fee calculation?",
    answer: "Model `Vehicle` with types (Motorcycle, Car, Bus/Truck). Model `ParkingSpot` matching vehicle sizes (Compact, Regular, Large). Model `ParkingFloor` with a collection of spots. Use the Strategy Pattern for `SpotAllocationStrategy` (e.g. Nearest-to-Entrance vs Floor-First) and `FeeCalculationStrategy` (Hourly, Flat-rate, Vehicle-type multipliers). An issued `Ticket` records entry time and spot ID.",
    explanation: "Avoid hardcoding vehicle types in an if-else ladder. Each `ParkingSpot` has a `canFitVehicle(vehicle): boolean`. When a vehicle enters, the Allocation Strategy queries available spots, marks the spot occupied, and generates a Ticket with timestamp. Upon exit, the Fee Strategy computes the total charge based on elapsed time and vehicle type.",
    code: `enum VehicleType { MOTORCYCLE, CAR, BUS }
enum SpotType { COMPACT, REGULAR, LARGE }

class Vehicle {
  constructor(public readonly licensePlate: string, public readonly type: VehicleType) {}
}

class ParkingSpot {
  private occupiedVehicle: Vehicle | null = null;

  constructor(public readonly id: string, public readonly type: SpotType) {}

  public isAvailable(): boolean { return this.occupiedVehicle === null; }

  public canFit(vehicle: Vehicle): boolean {
    if (!this.isAvailable()) return false;
    if (vehicle.type === VehicleType.MOTORCYCLE) return true; // Motorcycle fits anywhere
    if (vehicle.type === VehicleType.CAR) return this.type === SpotType.REGULAR || this.type === SpotType.LARGE;
    if (vehicle.type === VehicleType.BUS) return this.type === SpotType.LARGE;
    return false;
  }

  public park(vehicle: Vehicle): void { this.occupiedVehicle = vehicle; }
  public unpark(): Vehicle | null {
    const v = this.occupiedVehicle;
    this.occupiedVehicle = null;
    return v;
  }
}

class ParkingTicket {
  public readonly entryTime: number = Date.now();
  constructor(public readonly ticketId: string, public readonly spotId: string, public readonly vehiclePlate: string) {}
}`,
    recallHint: "Vehicle -> ParkingSpot -> Floor -> Lot. Allocation strategy for spot search, Fee strategy for billing.",
    practice: [
      "Implement Nearest-to-Entrance allocation using a Min-Heap (PriorityQueue) of available spots",
      "Model multiple Entrance and Exit terminals operating concurrently with thread-safety"
    ],
    interviewTip: "Parking Lot is one of the top 3 most requested LLD questions. Emphasize multi-floor navigation, EV charging spots, and Strategy pattern for fee computation.",
    tags: ["LLD System", "Parking Lot", "Object-Oriented Design", "Strategy Pattern"]
  }),

  createCard({
    idNum: 98,
    category,
    concept: "Movie Ticket Booking (BookMyShow: Seat Locking & TTL)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you handle high-concurrency seat selection in Movie Ticket Booking without double-booking, using temporary seat holds with TTL?",
    answer: "A seat has 3 states: `AVAILABLE`, `LOCKED` (Temporary hold), and `BOOKED` (Sold). When a user selects seats, the system acquires an in-memory lock or updates state to `LOCKED` with an expiration timestamp (`lockedUntil = Date.now() + 10_minutes`). If payment succeeds within 10 minutes, transition to `BOOKED`. If payment fails or timeout expires, the seat automatically reverts to `AVAILABLE`.",
    explanation: "If two users click the same seat simultaneously, naive database checks cause race conditions. By wrapping seat selection in a synchronized critical section or using Redis `SET seat_id user_id NX EX 600`, exactly one user gains the 10-minute hold. A background worker (or lazy expiration check) frees uncompleted reservations.",
    code: `enum SeatStatus { AVAILABLE, LOCKED, BOOKED }

class SeatLockManager {
  private seatLocks: Map<string, { userId: string; expiresAt: number }> = new Map();
  private bookedSeats: Set<string> = new Set();
  private lockTimeoutMs: number = 600000; // 10 minutes

  // Atomic seat reservation attempt
  public tryLockSeats(seatIds: string[], userId: string): boolean {
    const now = Date.now();

    // 1. Verify ALL requested seats are available and not locked
    for (const seatId of seatIds) {
      if (this.bookedSeats.has(seatId)) return false; // Already purchased!

      const lock = this.seatLocks.get(seatId);
      if (lock && now < lock.expiresAt && lock.userId !== userId) {
        return false; // Currently locked by another user!
      }
    }

    // 2. Lock ALL seats atomically
    for (const seatId of seatIds) {
      this.seatLocks.set(seatId, { userId, expiresAt: now + this.lockTimeoutMs });
    }
    return true;
  }

  public confirmBooking(seatIds: string[], userId: string): void {
    for (const seatId of seatIds) {
      const lock = this.seatLocks.get(seatId);
      if (!lock || lock.userId !== userId || Date.now() > lock.expiresAt) {
        throw new Error(\`Seat hold expired for seat \${seatId}\`);
      }
    }
    // Commit to permanent booked state
    for (const seatId of seatIds) {
      this.bookedSeats.add(seatId);
      this.seatLocks.delete(seatId);
    }
  }
}`,
    recallHint: "3 states: Available -> Locked (10-min TTL) -> Booked. Lock all seats atomically or rollback.",
    practice: [
      "Implement distributed seat locking in Redis using Redlock or SETNX with TTL",
      "Model Cinema Hall hierarchy: City -> Cinema -> Screen -> Show -> ShowSeat"
    ],
    interviewTip: "In BookMyShow LLD, the interviewer is testing concurrency. Always address race conditions: how two users clicking seat A1 at the same millisecond are handled deterministically.",
    tags: ["LLD System", "BookMyShow", "Seat Locking", "Concurrency", "TTL"]
  }),

  createCard({
    idNum: 99,
    category,
    concept: "Splitwise Expense Sharing System",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you design a flexible Expense Sharing system (Splitwise) supporting Equal, Exact, and Percentage splits?",
    answer: "Use the Strategy Pattern for split calculations. Define an abstract `Split` (user, amount). Subclasses include `EqualSplit`, `ExactSplit`, and `PercentSplit`. An `ExpenseValidator` strategy checks that exact amounts sum to total cost, or percentages sum to exactly 100.0%. An `Expense` records who paid, the split list, and updates user balance ledgers.",
    explanation: "Splitting an expense involves two parts: who paid, and who owes what. If Alice pays $100 for Alice, Bob, and Charlie equally, Alice is owed $66.67, and Bob and Charlie each owe $33.33. Validation must account for round-off pennies. The balance sheet updates each user's directed debt balance.",
    code: `abstract class Split {
  constructor(public userId: string, public amount: number = 0) {}
}

class EqualSplit extends Split {}
class ExactSplit extends Split {}
class PercentSplit extends Split {
  constructor(userId: string, public percent: number) { super(userId); }
}

interface SplitValidator {
  validate(totalAmount: number, splits: Split[]): boolean;
}

class PercentSplitValidator implements SplitValidator {
  validate(totalAmount: number, splits: Split[]): boolean {
    const totalPercent = (splits as PercentSplit[]).reduce((sum, s) => sum + s.percent, 0);
    return Math.abs(totalPercent - 100.0) < 0.001; // Allow float epsilon
  }
}

class EqualSplitValidator implements SplitValidator {
  validate(totalAmount: number, splits: Split[]): boolean {
    const splitAmount = Math.round((totalAmount / splits.length) * 100) / 100;
    splits.forEach(s => s.amount = splitAmount);
    return true;
  }
}`,
    recallHint: "Strategy pattern for Split types (Equal, Exact, Percent); validate sums before updating balance sheet.",
    practice: [
      "Handle round-off pennies when $100 is split equally among 3 people ($33.34, $33.33, $33.33)",
      "Model Group expenses vs Individual direct peer-to-peer expenses"
    ],
    interviewTip: "Splitwise is a universal machine coding favorite. Always write the validation logic to verify that percentages sum to 100% and exact splits sum to total expenditure.",
    tags: ["LLD System", "Splitwise", "Expense Sharing", "Strategy Pattern"]
  }),

  createCard({
    idNum: 100,
    category,
    concept: "Debt Simplification Algorithm (Min-Cash-Flow)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the Debt Simplification algorithm in Splitwise minimize total cash transactions across a group of people?",
    answer: "Compute each person's net balance: `netBalance = totalPaid - totalOwed`. Separate people into Creditors (`net > 0`) and Debtors (`net < 0`). Repeatedly settle the maximum debtor with the maximum creditor using a Greedy Min-Cash-Flow algorithm: `settle = min(|maxDebtor|, maxCreditor)`. This reduces $O(N^2)$ direct debt relationships to at most $N - 1$ total transactions.",
    explanation: "If A owes B $10, and B owes C $10, two transactions occur. Debt simplification collapses this into A pays C $10 directly (one transaction). Across 10 roommates, hundreds of individual debts reduce to under 9 payments, massively simplifying real-world settlements.",
    code: `class DebtSimplifier {
  public static simplifyDebts(transactions: { from: string; to: string; amount: number }[]): { from: string; to: string; amount: number }[] {
    const balances: Map<string, number> = new Map();

    // 1. Calculate net balance for every person
    for (const tx of transactions) {
      balances.set(tx.from, (balances.get(tx.from) || 0) - tx.amount);
      balances.set(tx.to, (balances.get(tx.to) || 0) + tx.amount);
    }

    // Separate into debtors (< 0) and creditors (> 0)
    const debtors: { person: string; amount: number }[] = [];
    const creditors: { person: string; amount: number }[] = [];

    for (const [person, balance] of balances.entries()) {
      if (balance < -0.01) debtors.push({ person, amount: -balance });
      else if (balance > 0.01) creditors.push({ person, amount: balance });
    }

    const simplified: { from: string; to: string; amount: number }[] = [];

    // 2. Greedy settlement: Match largest debtor with largest creditor
    let i = 0, j = 0;
    while (i < debtors.length && j < creditors.length) {
      const settleAmount = Math.min(debtors[i].amount, creditors[j].amount);

      simplified.push({ from: debtors[i].person, to: creditors[j].person, amount: Math.round(settleAmount * 100) / 100 });

      debtors[i].amount -= settleAmount;
      creditors[j].amount -= settleAmount;

      if (debtors[i].amount <= 0.01) i++;
      if (creditors[j].amount <= 0.01) j++;
    }

    return simplified;
  }
}`,
    recallHint: "Net balance = paid - owed. Match max debtor with max creditor; reduces transactions to at most N-1.",
    practice: [
      "Prove why the greedy Min-Cash-Flow algorithm yields at most N - 1 total transactions",
      "Model how multi-currency debts complicate simplification (requires FX exchange rate locks)"
    ],
    interviewTip: "Explaining the Min-Cash-Flow graph algorithm in Splitwise guarantees top marks in system design interviews. Make sure to emphasize net-balance calculation first.",
    tags: ["LLD System", "Splitwise", "Debt Simplification", "Min Cash Flow", "Graph Algorithms"]
  }),

  createCard({
    idNum: 101,
    category,
    concept: "Ride-Sharing Dispatcher (Uber: Proximity & Surge)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you design a Ride-Sharing Dispatcher (Uber/Lyft) matching riders with nearby drivers while calculating dynamic surge pricing?",
    answer: "A `LocationManager` indexes drivers geographically using spatial indexing (Geohash, Quadtree, or spatial buckets). When a rider requests a trip, the `MatchingStrategy` finds nearby available drivers within a radius (e.g. 5km) and dispatches a trip offer to the closest driver. A `SurgePricingStrategy` calculates a multiplier based on the ratio of active ride requests (demand) to available drivers (supply) in that geographic cell.",
    explanation: "Trip lifecycle transitions through a state machine: `REQUESTED` -> `DRIVER_ASSIGNED` -> `DRIVER_ARRIVED` -> `IN_TRIP` -> `COMPLETED` -> `PAID`. Drivers have 15 seconds to accept or reject an offer before the dispatcher routes the offer to the next closest driver.",
    code: `enum TripStatus { REQUESTED, DRIVER_ASSIGNED, IN_PROGRESS, COMPLETED, CANCELLED }

class GeoLocation {
  constructor(public lat: number, public lon: number) {}
  public distanceTo(other: GeoLocation): number {
    // Haversine formula approximation
    const dLat = this.lat - other.lat;
    const dLon = this.lon - other.lon;
    return Math.sqrt(dLat * dLat + dLon * dLon) * 111; // km approx
  }
}

class Driver {
  constructor(
    public id: string,
    public name: string,
    public location: GeoLocation,
    public isAvailable: boolean = true
  ) {}
}

class RideDispatcher {
  private drivers: Driver[] = [];

  public findNearestDriver(pickup: GeoLocation, maxRadiusKm: number = 5): Driver | null {
    let nearest: Driver | null = null;
    let minDistance = Infinity;

    for (const d of this.drivers) {
      if (!d.isAvailable) continue;
      const dist = d.location.distanceTo(pickup);
      if (dist <= maxRadiusKm && dist < minDistance) {
        minDistance = dist;
        nearest = d;
      }
    }
    return nearest;
  }

  public calculateSurgeMultiplier(activeDemand: number, availableSupply: number): number {
    if (availableSupply === 0) return 3.0; // Max surge cap
    const ratio = activeDemand / availableSupply;
    if (ratio > 2.0) return 2.0;
    if (ratio > 1.2) return 1.5;
    return 1.0; // Base fare
  }
}`,
    recallHint: "Spatial proximity matching + Surge pricing multiplier (demand / supply) + Trip lifecycle state machine.",
    practice: [
      "Implement the Driver Offer Timeout (15-second countdown to accept before falling back to next driver)",
      "Model Ride Types: UberX, UberXL, UberPool with multi-passenger routing"
    ],
    interviewTip: "Uber LLD requires discussing spatial indexing (Geohash/H3/Quadtree) to avoid $O(N)$ full table scans across millions of global drivers.",
    tags: ["LLD System", "Uber", "Ride Sharing", "Spatial Indexing", "Surge Pricing"]
  }),

  createCard({
    idNum: 102,
    category,
    concept: "Hotel Room Reservation System (Date Range Overlaps)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you detect date range collisions when reserving hotel rooms, and what is the standard interval overlap condition?",
    answer: "Two date intervals $[S_1, E_1]$ and $[S_2, E_2]$ overlap if, and only if, `S1 < E2 && S2 < E1`. A `Room` maintains an inventory of confirmed `Reservations`. To verify availability for a requested $[CheckIn, CheckOut]$ interval, check that no existing reservation overlaps with the requested dates.",
    explanation: "Many engineers write complex 4-case nested conditionals to check date overlaps. The universal theorem states: two intervals overlap if the start of each interval is strictly before the end of the other interval. A Room is available if `!reservations.some(r => checkIn < r.checkOut && r.checkIn < checkOut)`.",
    code: `class DateRange {
  constructor(public readonly checkIn: Date, public readonly checkOut: Date) {
    if (checkIn >= checkOut) throw new Error("Check-out date must be strictly after check-in date");
  }

  // Universal Overlap Condition:
  public overlaps(other: DateRange): boolean {
    return this.checkIn < other.checkOut && other.checkIn < this.checkOut;
  }
}

class HotelRoom {
  private reservations: DateRange[] = [];

  constructor(public readonly roomNumber: string, public readonly type: "SINGLE" | "DOUBLE" | "SUITE") {}

  public isAvailable(requested: DateRange): boolean {
    return !this.reservations.some(existing => existing.overlaps(requested));
  }

  public book(range: DateRange): boolean {
    if (!this.isAvailable(range)) return false;
    this.reservations.push(range);
    return true;
  }
}`,
    recallHint: "Interval overlap formula: startA < endB && startB < endA. Check against all booked intervals.",
    practice: [
      "Use an Interval Tree / Segment Tree to query room availability across thousands of bookings in O(log N)",
      "Model room inventory by type rather than assigning specific room numbers until check-in"
    ],
    interviewTip: "Memorize the universal interval overlap formula: `startA < endB && startB < endA`. It is expected across all hotel, calendar, flight, and meeting room booking questions.",
    tags: ["LLD System", "Hotel Reservation", "Date Overlaps", "Interval Algorithms"]
  }),

  createCard({
    idNum: 103,
    category,
    concept: "Digital Wallet & Double-Entry Bookkeeping",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why does clean financial ledger design mandate Double-Entry Bookkeeping instead of simple integer balance updates?",
    answer: "Simple balance updates (`balance += amount`) create unverifiable data: money appears or vanishes with no audit trail. Double-Entry Bookkeeping mandates that every financial event produces at least two ledger entries: a DEBIT to one account and an equal CREDIT to another account. The sum of all debits must equal the sum of all credits at all times (Zero-Sum Invariant).",
    explanation: "If a user transfers $100 to another user, two ledger rows are written atomically: Debit Alice Account ($100), Credit Bob Account ($100). Balance is a computed projection of all ledger entries. If a bug occurs, auditors can reconstruct every transaction history and detect fraudulent money creation.",
    code: `enum EntryType { DEBIT, CREDIT }

class LedgerEntry {
  constructor(
    public readonly accountId: string,
    public readonly type: EntryType,
    public readonly amountCents: number,
    public readonly timestamp: number = Date.now()
  ) {}
}

class TransactionJournal {
  private entries: LedgerEntry[] = [];

  // Atomic 2-phase ledger recording
  public recordTransfer(fromAccountId: string, toAccountId: string, amountCents: number): void {
    if (amountCents <= 0) throw new Error("Amount must be positive");

    // Double-entry guarantee: Exactly 1 DEBIT and 1 CREDIT
    const debit = new LedgerEntry(fromAccountId, EntryType.DEBIT, amountCents);
    const credit = new LedgerEntry(toAccountId, EntryType.CREDIT, amountCents);

    this.entries.push(debit, credit);
  }

  // Account balance is the sum of CREDITS minus DEBITS
  public getBalance(accountId: string): number {
    return this.entries
      .filter(e => e.accountId === accountId)
      .reduce((bal, e) => e.type === EntryType.CREDIT ? bal + e.amountCents : bal - e.amountCents, 0);
  }
}`,
    recallHint: "Double-Entry: Every transaction has equal DEBIT and CREDIT. Sum of all entries is always zero.",
    practice: [
      "Implement a two-phase commit (Prepare -> Commit) for cross-service wallet transfers",
      "Model escrow accounts where funds are held during dispute windows"
    ],
    interviewTip: "Proposing Double-Entry Bookkeeping when asked to design a Digital Wallet (PayPal, Paytm, Venmo) immediately marks you as a seasoned fintech software engineer.",
    tags: ["LLD System", "Digital Wallet", "Fintech", "Double Entry", "Ledger"]
  }),

  createCard({
    idNum: 104,
    category,
    concept: "Order Management & Inventory Allocation",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you handle Inventory Allocation during flash sales using Optimistic vs Pessimistic locking?",
    answer: "Pessimistic Locking acquires an exclusive database/in-memory lock on the product row (`SELECT ... FOR UPDATE`), preventing any other thread from checking or buying until the transaction commits (guarantees consistency, but serializes throughput). Optimistic Locking uses a version counter (`UPDATE items SET qty = qty - 1, version = version + 1 WHERE id = 1 AND version = 5`). If version changed, the transaction aborts and retries.",
    explanation: "Under extreme flash sale loads (e.g. 100 iPhone units with 50,000 concurrent buyers), optimistic locking causes 99% of transactions to abort and retry, thrashing the database. In flash sales, an In-Memory atomic decrement (Redis `DECR` or AtomicInteger) is preferred: if `decr >= 0`, allow checkout; if `< 0`, sold out immediately.",
    code: `class InventoryItem {
  constructor(
    public readonly sku: string,
    private availableQuantity: number,
    public version: number = 1
  ) {}

  // Optimistic allocation check
  public allocateOptimistic(qty: number, expectedVersion: number): boolean {
    if (this.version !== expectedVersion) {
      console.warn("Optimistic lock conflict! Version mismatch. Retrying...");
      return false; // Retry required
    }
    if (this.availableQuantity < qty) {
      throw new Error("Insufficient stock");
    }

    this.availableQuantity -= qty;
    this.version++; // Advance version
    return true;
  }

  public getStock(): number { return this.availableQuantity; }
}`,
    recallHint: "Pessimistic locks row upfront (high contention); Optimistic checks version on write; In-memory atomic DECR for flash sales.",
    practice: [
      "Implement an in-memory reservation queue that guarantees fair FIFO allocation during flash sales",
      "Model inventory backorders and split-shipment fulfillment across multiple warehouses"
    ],
    interviewTip: "Flash sales are an interview favorite. Compare Pessimistic (locks), Optimistic (version numbers), and Atomic In-Memory Decrements (Redis DECR) to demonstrate full architectural depth.",
    tags: ["LLD System", "Inventory Management", "Optimistic Locking", "Flash Sales"]
  }),

  createCard({
    idNum: 105,
    category,
    concept: "Library Management System & Fine Calculation",
    priority: "must-know",
    difficulty: "beginner",
    question: "How do you model a Library Management System with Book Items, Borrowing records, and tiered late fine calculation?",
    answer: "Distinguish between a conceptual `Book` (metadata: title, author, ISBN) and physical `BookItem` copies (each having a unique barcode and rack location). A `LendingRecord` links Member, BookItem, issueDate, and dueDate. A `FineCalculationStrategy` calculates penalties based on days overdue and membership tier.",
    explanation: "If a library owns 5 physical copies of 'Clean Code', they share one ISBN and title, but have 5 distinct barcodes. Modeling Book vs BookItem avoids duplicating author and ISBN across every physical copy. When returning a book, `daysOverdue = max(0, returnDate - dueDate) * finePerDay`.",
    code: `class Book {
  constructor(public isbn: string, public title: string, public author: string) {}
}

class BookItem {
  public isIssued: boolean = false;
  constructor(public barcode: string, public book: Book, public rackNumber: string) {}
}

class LendingRecord {
  public returnDate: number | null = null;

  constructor(
    public recordId: string,
    public bookItem: BookItem,
    public memberId: string,
    public issueDate: number = Date.now(),
    public dueDate: number = Date.now() + 14 * 86400000 // 14 days
  ) {}

  public calculateFine(finePerDay: number = 2.0): number {
    const actualReturn = this.returnDate || Date.now();
    const overdueDays = Math.max(0, Math.floor((actualReturn - this.dueDate) / 86400000));
    return overdueDays * finePerDay;
  }
}`,
    recallHint: "Separate Book (metadata) from BookItem (physical copy with barcode). Compute overdue fine on return.",
    practice: [
      "Implement a reservation hold queue: if all copies are issued, members join a waiting list",
      "Model membership borrowing limits (max 5 active books per member)"
    ],
    interviewTip: "Separating conceptual `Book` from physical `BookItem` shows immediate mastery of basic domain modeling and prevents entity attribute duplication.",
    tags: ["LLD System", "Library Management", "Domain Modeling", "OOP"]
  }),

  createCard({
    idNum: 106,
    category,
    concept: "Auction Bidding Engine (Bid Ordering & Reserve Price)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you architect a Real-Time Auction Bidding Engine ensuring strict chronological bid ordering and reserve price enforcement?",
    answer: "An `AuctionItem` has a reserve price, min increment, and expiration timestamp. Incoming `Bid` objects must satisfy: 1. `amount >= currentHighest + minIncrement`, 2. `timestamp < auctionEndTime`. The engine uses a synchronized priority queue or mutex to process bids sequentially. When the auction closes, if highest bid $\\ge$ reserve price, a winning event is fired; otherwise the item goes unsold.",
    explanation: "In live auctions (eBay), bids arrive in milliseconds. If two users bid $100 and $105, processing $105 first makes $100 invalid. The engine must enforce chronological ordering and handle 'soft close' (if a bid arrives in the final 30 seconds, extend auction by 60 seconds to prevent auction sniping).",
    code: `class Auction {
  public currentHighestBid: number;
  public highestBidder: string | null = null;
  public endTime: number;
  private minIncrement: number;
  private reservePrice: number;

  constructor(reservePrice: number, minIncrement: number = 10, durationSeconds: number = 3600) {
    this.reservePrice = reservePrice;
    this.minIncrement = minIncrement;
    this.currentHighestBid = 0;
    this.endTime = Date.now() + durationSeconds * 1000;
  }

  // Atomic bid submission
  public placeBid(bidderId: string, amount: number): boolean {
    const now = Date.now();
    if (now > this.endTime) throw new Error("Auction has closed");

    const requiredMin = this.currentHighestBid === 0 ? this.reservePrice : this.currentHighestBid + this.minIncrement;
    if (amount < requiredMin) {
      throw new Error(\`Bid too low! Minimum required bid is \$\${requiredMin}\`);
    }

    this.currentHighestBid = amount;
    this.highestBidder = bidderId;

    // Anti-Sniping rule: If bid placed in last 30s, extend by 60s
    if (this.endTime - now < 30000) {
      this.endTime += 60000;
    }
    return true;
  }
}`,
    recallHint: "Validate amount >= highest + minIncrement; enforce reserve price; anti-sniping extends time in last 30s.",
    practice: [
      "Implement Proxy Bidding (system automatically bids on user's behalf up to their max limit)",
      "Design WebSocket broadcast of live bid updates to all connected viewers"
    ],
    interviewTip: "Mentioning the Anti-Sniping extension rule demonstrates you understand the real-world operational challenges of online auction systems.",
    tags: ["LLD System", "Auction Engine", "Bidding", "Real-Time"]
  }),

  createCard({
    idNum: 107,
    category,
    concept: "Restaurant Table Reservation System",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you design a Restaurant Table Reservation system optimizing table utilization based on party size and meal duration slots?",
    answer: "Model `Table` with capacity (2-top, 4-top, 8-top). Reservations are booked in discrete time slots (e.g. 2-hour dining windows). To optimize utilization, the allocation algorithm selects the *smallest available table* that fits the party (`table.capacity >= partySize`), leaving larger tables open for larger parties.",
    explanation: "If a party of 2 is assigned to an 8-person table, an incoming party of 7 must be turned away. The allocation engine sorts available tables by capacity ascending and matches the tightest fit. It checks that the requested 2-hour window does not overlap with existing bookings on that table.",
    code: `class RestaurantTable {
  constructor(public readonly id: string, public readonly capacity: number) {}
}

class RestaurantReservationManager {
  private tables: RestaurantTable[] = [];
  private bookings: { tableId: string; timeSlot: string }[] = [];

  public bookTable(partySize: number, timeSlot: string): RestaurantTable | null {
    // 1. Filter tables that can fit the party and sort by capacity ascending (Best Fit)
    const candidates = this.tables
      .filter(t => t.capacity >= partySize)
      .sort((a, b) => a.capacity - b.capacity);

    // 2. Find first table not booked for this time slot
    for (const table of candidates) {
      const isBooked = this.bookings.some(b => b.tableId === table.id && b.timeSlot === timeSlot);
      if (!isBooked) {
        this.bookings.push({ tableId: table.id, timeSlot });
        return table; // Optimal table allocated!
      }
    }
    return null; // Fully booked
  }
}`,
    recallHint: "Best-fit allocation: sort available tables by capacity ascending to preserve large tables for big groups.",
    practice: [
      "Implement Table Combining: allow two adjacent 2-person tables to be pushed together for a party of 4",
      "Model walk-in waitlists with dynamic SMS paging when a table is bussed"
    ],
    interviewTip: "Highlight the 'Best Fit' allocation strategy over 'First Fit' to demonstrate business acumen regarding restaurant revenue per available seat-hour (RevPASH).",
    tags: ["LLD System", "Restaurant Reservation", "Best Fit", "Capacity Planning"]
  }),

  createCard({
    idNum: 108,
    category,
    concept: "Subscription Billing Engine & Proration",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you architect a Subscription Billing Engine handling mid-cycle plan upgrades with mathematical proration?",
    answer: "A Subscription has a `BillingCycle` (monthly/annual), `currentPlan`, and `billingPeriodEnd`. When a customer upgrades mid-cycle (e.g. Day 10 of 30 from $30/mo to $60/mo), the engine calculates: 1. Credit for unused days of old plan: $30 \\times \\frac{20}{30} = \\$20$. 2. Charge for remaining days of new plan: $60 \\times \\frac{20}{30} = \\$40$. 3. Net immediate charge = $\\$40 - \\$20 = \\$20$.",
    explanation: "Failing to calculate exact proration causes revenue loss or customer churn from double-billing. The engine generates an immediate prorated adjustment invoice, charges the net difference via payment gateway, and resets the recurring billing schedule to the new tier.",
    code: `class SubscriptionPlan {
  constructor(public id: string, public name: string, public monthlyPrice: number) {}
}

class ProrationCalculator {
  public static calculateUpgradeCost(
    oldPlan: SubscriptionPlan,
    newPlan: SubscriptionPlan,
    daysRemainingInCycle: number,
    totalDaysInCycle: number = 30
  ): { refundCredit: number; newCharge: number; netAmountDue: number } {
    const fractionRemaining = daysRemainingInCycle / totalDaysInCycle;

    // Unused credit from old plan
    const refundCredit = Math.round(oldPlan.monthlyPrice * fractionRemaining * 100) / 100;
    // Charge for new plan for remaining days
    const newCharge = Math.round(newPlan.monthlyPrice * fractionRemaining * 100) / 100;

    const netAmountDue = Math.round((newCharge - refundCredit) * 100) / 100;
    return { refundCredit, newCharge, netAmountDue };
  }
}

// Upgrading on day 10 (20 days remaining) from $30 to $60:
const cost = ProrationCalculator.calculateUpgradeCost(
  new SubscriptionPlan("p1", "Basic", 30),
  new SubscriptionPlan("p2", "Pro", 60),
  20, 30
);
console.log(\`Net Prorated Charge: $\${cost.netAmountDue}\`); // Net Prorated Charge: $20!`,
    recallHint: "Proration: Credit = unused old plan days; Charge = remaining new plan days; Net = Charge - Credit.",
    practice: [
      "Model Dunning logic: automated retry sequence (Day 1, 3, 7) when recurring card payment fails",
      "Implement Grace Period before suspending account features"
    ],
    interviewTip: "In SaaS LLD interviews, discussing Proration and Dunning (failed payment recovery) demonstrates you have built enterprise-grade subscription systems.",
    tags: ["LLD System", "Subscription Billing", "Proration", "Fintech SaaS"]
  })
];
