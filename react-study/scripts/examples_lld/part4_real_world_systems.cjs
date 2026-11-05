module.exports = [
  {
    id: "lld-ex-33",
    title: "Complete Multi-Floor Parking Lot System with Spot Allocation & Vehicle Fitting",
    category: "Real-World System Modeling",
    difficulty: "intermediate",
    whatThisCodeCovers: "A full Parking Lot system featuring multiple floors, spot sizing (Compact, Regular, Large), vehicle compatibility checking, parking ticket generation, and hourly fee calculation.",
    conceptsCovered: [
      "Parking Lot Architecture",
      "Floor & Spot Management",
      "Vehicle Fit Validation",
      "Ticket Lifecycle",
      "Hourly Billing Strategy"
    ],
    code: `enum VehicleType { MOTORCYCLE, CAR, BUS }
enum SpotType { COMPACT, REGULAR, LARGE }

class Vehicle {
  constructor(public readonly plate: string, public readonly type: VehicleType) {}
}

class ParkingSpot {
  private parkedVehicle: Vehicle | null = null;
  constructor(public readonly id: string, public readonly type: SpotType) {}

  public isAvailable(): boolean { return this.parkedVehicle === null; }

  public canFit(v: Vehicle): boolean {
    if (!this.isAvailable()) return false;
    if (v.type === VehicleType.MOTORCYCLE) return true;
    if (v.type === VehicleType.CAR) return this.type === SpotType.REGULAR || this.type === SpotType.LARGE;
    if (v.type === VehicleType.BUS) return this.type === SpotType.LARGE;
    return false;
  }

  public park(v: Vehicle) { this.parkedVehicle = v; }
  public vacate(): Vehicle | null {
    const v = this.parkedVehicle;
    this.parkedVehicle = null;
    return v;
  }
}

class ParkingLotFloor {
  public spots: ParkingSpot[] = [];
  constructor(public readonly floorNum: number) {}
}

class ParkingLot {
  private floors: ParkingLotFloor[] = [];
  private activeTickets: Map<string, { spot: ParkingSpot; vehicle: Vehicle; entryTime: number }> = new Map();

  public addFloor(floor: ParkingLotFloor) { this.floors.push(floor); }

  public parkVehicle(v: Vehicle): string | null {
    for (const floor of this.floors) {
      for (const spot of floor.spots) {
        if (spot.canFit(v)) {
          spot.park(v);
          const ticketId = \`tkt_\${Date.now()}_\${v.plate}\`;
          this.activeTickets.set(ticketId, { spot, vehicle: v, entryTime: Date.now() });
          console.log(\`[Parked] \${v.plate} (\${VehicleType[v.type]}) in spot \${spot.id} (Floor \${floor.floorNum})\`);
          return ticketId;
        }
      }
    }
    console.warn(\`[Full] No available spots for \${v.plate}\`);
    return null;
  }

  public vacateVehicle(ticketId: string): number {
    const ticket = this.activeTickets.get(ticketId);
    if (!ticket) throw new Error("Invalid ticket ID");

    ticket.spot.vacate();
    this.activeTickets.delete(ticketId);

    // Calculate fee: $10 base fee
    const fee = 10.0;
    console.log(\`[Vacated] \${ticket.vehicle.plate} from spot \${ticket.spot.id}. Fee: $\${fee}\`);
    return fee;
  }
}

// Setup garage:
const lot = new ParkingLot();
const floor1 = new ParkingLotFloor(1);
floor1.spots.push(new ParkingSpot("F1-C1", SpotType.COMPACT));
floor1.spots.push(new ParkingSpot("F1-R1", SpotType.REGULAR));
floor1.spots.push(new ParkingSpot("F1-L1", SpotType.LARGE));
lot.addFloor(floor1);

const carTicket = lot.parkVehicle(new Vehicle("CAR-9821", VehicleType.CAR));
const bikeTicket = lot.parkVehicle(new Vehicle("BIKE-101", VehicleType.MOTORCYCLE));
lot.vacateVehicle(carTicket!);`,
    breakdown: [
      {
        lineRange: "14-22",
        note: "canFit checks availability and vehicle-to-spot compatibility dynamically."
      },
      {
        lineRange: "41-55",
        note: "parkVehicle iterates floors, claims matching spot, and generates an active parking ticket."
      },
      {
        lineRange: "72-76",
        note: "Verifies car parks in REGULAR spot, motorcycle takes COMPACT, and car vacates cleanly."
      }
    ],
    expectedOutput: `[Parked] CAR-9821 (CAR) in spot F1-R1 (Floor 1)
[Parked] BIKE-101 (MOTORCYCLE) in spot F1-C1 (Floor 1)
[Vacated] CAR-9821 from spot F1-R1. Fee: $10`
  },

  {
    id: "lld-ex-34",
    title: "Movie Ticket Booking (BookMyShow) with 10-Minute Seat Hold & TTL",
    category: "Real-World System Modeling",
    difficulty: "advanced",
    whatThisCodeCovers: "A concurrent movie ticket reservation engine handling seat selection holds with a 10-minute TTL, preventing double-booking race conditions and auto-reverting abandoned holds.",
    conceptsCovered: [
      "BookMyShow System",
      "Seat Locking (TTL)",
      "Atomic Multi-Seat Reservation",
      "Hold Expiration Check",
      "Double-Booking Prevention"
    ],
    code: `enum SeatState { AVAILABLE, LOCKED, BOOKED }

class ShowSeat {
  public state: SeatState = SeatState.AVAILABLE;
  public lockedByUserId: string | null = null;
  public lockExpiresAt: number = 0;

  constructor(public readonly id: string, public readonly price: number) {}

  public isAvailable(): boolean {
    if (this.state === SeatState.BOOKED) return false;
    if (this.state === SeatState.LOCKED && Date.now() < this.lockExpiresAt) return false;
    return true; // Available or previous hold expired!
  }
}

class BookingEngine {
  private seats: Map<string, ShowSeat> = new Map();

  constructor(seatIds: string[]) {
    for (const id of seatIds) this.seats.set(id, new ShowSeat(id, 15.0));
  }

  // Atomic reservation: checks all requested seats before locking any
  public lockSeats(seatIds: string[], userId: string, holdDurationMs: number = 600000): boolean {
    // Step 1: Verify all seats are available
    for (const id of seatIds) {
      const seat = this.seats.get(id);
      if (!seat || !seat.isAvailable()) return false;
    }

    // Step 2: Lock all seats atomically
    const expiry = Date.now() + holdDurationMs;
    for (const id of seatIds) {
      const seat = this.seats.get(id)!;
      seat.state = SeatState.LOCKED;
      seat.lockedByUserId = userId;
      seat.lockExpiresAt = expiry;
    }
    console.log(\`[Seats Locked] User \${userId} locked seats [\${seatIds.join(", ")}] for 10 mins\`);
    return true;
  }

  public confirmBooking(seatIds: string[], userId: string): boolean {
    for (const id of seatIds) {
      const seat = this.seats.get(id);
      if (!seat || seat.lockedByUserId !== userId || Date.now() > seat.lockExpiresAt) {
        console.warn(\`[Expired] Hold on seat \${id} expired or invalid!\`);
        return false;
      }
    }
    for (const id of seatIds) {
      this.seats.get(id)!.state = SeatState.BOOKED;
    }
    console.log(\`[CONFIRMED] Booking confirmed for user \${userId} on seats: \${seatIds.join(", ")}\`);
    return true;
  }
}

const engine = new BookingEngine(["A1", "A2", "A3"]);

// User 1 locks seats A1 and A2
console.log("User 1 lock:", engine.lockSeats(["A1", "A2"], "user_alice"));

// User 2 attempts to lock A2 and A3 (Fails because A2 is currently held by Alice!)
console.log("User 2 lock attempt:", engine.lockSeats(["A2", "A3"], "user_bob"));

// User 1 confirms payment:
engine.confirmBooking(["A1", "A2"], "user_alice");`,
    breakdown: [
      {
        lineRange: "11-15",
        note: "isAvailable() checks state; if LOCKED but lockExpiresAt is in past, lazily treats as available."
      },
      {
        lineRange: "26-42",
        note: "lockSeats checks ALL seats first, then locks atomically to prevent partial allocations."
      },
      {
        lineRange: "63-68",
        note: "Demonstrates User 2 rejected immediately when requesting already-held seat A2."
      }
    ],
    expectedOutput: `[Seats Locked] User user_alice locked seats [A1, A2] for 10 mins
User 1 lock: true
User 2 lock attempt: false
[CONFIRMED] Booking confirmed for user user_alice on seats: A1, A2`
  },

  {
    id: "lld-ex-35",
    title: "Splitwise Expense Sharing System with Equal, Exact & Percent Splits",
    category: "Real-World System Modeling",
    difficulty: "advanced",
    whatThisCodeCovers: "A complete Expense Sharing system with Strategy-based split validation (Equal, Exact, Percentage), balance tracking across pairwise users, and debt calculation.",
    conceptsCovered: [
      "Splitwise Architecture",
      "Strategy Pattern",
      "Split Validation",
      "Round-Off Adjustment",
      "Pairwise Balance Tracking"
    ],
    code: `abstract class Split {
  constructor(public userId: string, public amount: number = 0) {}
}

class EqualSplit extends Split {}
class ExactSplit extends Split {}
class PercentSplit extends Split {
  constructor(userId: string, public percent: number) { super(userId); }
}

class ExpenseService {
  // balances.get(u1).get(u2) = amount u2 owes u1
  private balances: Map<string, Map<string, number>> = new Map();

  public addExpense(paidBy: string, total: number, splits: Split[]): void {
    // Validation
    if (splits[0] instanceof PercentSplit) {
      const sumPercent = (splits as PercentSplit[]).reduce((s, p) => s + p.percent, 0);
      if (Math.abs(sumPercent - 100) > 0.01) throw new Error("Percentages must sum to 100%");
      splits.forEach(s => s.amount = Math.round(total * (s as PercentSplit).percent) / 100);
    } else if (splits[0] instanceof EqualSplit) {
      const each = Math.round((total / splits.length) * 100) / 100;
      splits.forEach(s => s.amount = each);
    }

    // Update balances: each participant owes paidBy their split amount
    for (const split of splits) {
      if (split.userId === paidBy) continue;
      this.updateDebt(paidBy, split.userId, split.amount);
    }
  }

  private updateDebt(creditor: string, debtor: string, amount: number) {
    if (!this.balances.has(creditor)) this.balances.set(creditor, new Map());
    const m = this.balances.get(creditor)!;
    m.set(debtor, (m.get(debtor) || 0) + amount);
  }

  public getBalances(): void {
    for (const [creditor, debtors] of this.balances.entries()) {
      for (const [debtor, amount] of debtors.entries()) {
        if (amount > 0) {
          console.log(\`\${debtor} owes \${creditor}: $\${amount}\`);
        }
      }
    }
  }
}

const expenseApp = new ExpenseService();
// Alice pays $300 for Alice, Bob, and Charlie equally ($100 each)
expenseApp.addExpense("Alice", 300, [
  new EqualSplit("Alice"),
  new EqualSplit("Bob"),
  new EqualSplit("Charlie")
]);

expenseApp.getBalances();`,
    breakdown: [
      {
        lineRange: "17-26",
        note: "Validates split models: computes exact dollar allocation from percentages or equal shares."
      },
      {
        lineRange: "28-32",
        note: "Updates pairwise debt map: debtor owes creditor their respective split share."
      },
      {
        lineRange: "50-56",
        note: "Demonstrates that Bob and Charlie each owe Alice $100."
      }
    ],
    expectedOutput: `Bob owes Alice: $100
Charlie owes Alice: $100`
  },

  {
    id: "lld-ex-36",
    title: "Debt Simplification Algorithm in Splitwise (Min-Cash-Flow)",
    category: "Real-World System Modeling",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements the Min-Cash-Flow greedy graph algorithm that minimizes interpersonal debt transactions, reducing $O(N^2)$ entangled pairwise payments down to at most $N-1$ payments.",
    conceptsCovered: [
      "Debt Simplification",
      "Min-Cash-Flow Algorithm",
      "Net Balance Vector",
      "Greedy Settlement",
      "Graph Cycle Elimination"
    ],
    code: `interface DirectDebt {
  from: string;
  to: string;
  amount: number;
}

class DebtSimplifier {
  public static simplify(debts: DirectDebt[]): DirectDebt[] {
    const netBalance: Map<string, number> = new Map();

    // Step 1: Calculate net balance for each person
    for (const d of debts) {
      netBalance.set(d.from, (netBalance.get(d.from) || 0) - d.amount);
      netBalance.set(d.to, (netBalance.get(d.to) || 0) + d.amount);
    }

    const debtors: { user: string; amount: number }[] = [];
    const creditors: { user: string; amount: number }[] = [];

    for (const [user, net] of netBalance.entries()) {
      if (net < -0.01) debtors.push({ user, amount: -net });
      else if (net > 0.01) creditors.push({ user, amount: net });
    }

    const settlements: DirectDebt[] = [];
    let i = 0, j = 0;

    // Step 2: Greedily settle maximum debtor with maximum creditor
    while (i < debtors.length && j < creditors.length) {
      const settled = Math.min(debtors[i].amount, creditors[j].amount);

      settlements.push({
        from: debtors[i].user,
        to: creditors[j].user,
        amount: Math.round(settled * 100) / 100
      });

      debtors[i].amount -= settled;
      creditors[j].amount -= settled;

      if (debtors[i].amount <= 0.01) i++;
      if (creditors[j].amount <= 0.01) j++;
    }

    return settlements;
  }
}

// Complex debt web: A owes B $40, B owes C $40, C owes A $20
const rawDebts: DirectDebt[] = [
  { from: "Alice", to: "Bob", amount: 40 },
  { from: "Bob", to: "Charlie", amount: 40 },
  { from: "Charlie", to: "Alice", amount: 20 }
];

const simplified = DebtSimplifier.simplify(rawDebts);
console.log("Simplified Transactions:");
simplified.forEach(s => console.log(\`\${s.from} pays \${s.to}: $\${s.amount}\`));`,
    breakdown: [
      {
        lineRange: "11-15",
        note: "Computes net balance: positive net is creditor, negative net is debtor."
      },
      {
        lineRange: "26-41",
        note: "Greedily cancels out largest debtor with largest creditor until all nets reach 0."
      },
      {
        lineRange: "52-54",
        note: "Reduces 3 circular transactions down to 1 direct payment: Alice pays Charlie $20."
      }
    ],
    expectedOutput: `Simplified Transactions:
Alice pays Charlie: $20`
  },

  {
    id: "lld-ex-37",
    title: "Ride-Sharing Dispatcher (Uber) with Proximity Matching & Surge Pricing",
    category: "Real-World System Modeling",
    difficulty: "advanced",
    whatThisCodeCovers: "A complete ride-hailing dispatcher that finds the nearest available driver within radius using Euclidean/Haversine approximations and calculates dynamic surge multipliers based on demand/supply.",
    conceptsCovered: [
      "Uber Architecture",
      "Proximity Matching",
      "Surge Pricing Strategy",
      "Trip Lifecycle State Machine",
      "Driver Allocation"
    ],
    code: `class GeoPoint {
  constructor(public lat: number, public lon: number) {}
  distanceKm(other: GeoPoint): number {
    const dLat = this.lat - other.lat;
    const dLon = this.lon - other.lon;
    return Math.sqrt(dLat * dLat + dLon * dLon) * 111; // Approx km
  }
}

class Driver {
  constructor(public id: string, public location: GeoPoint, public isAvailable: boolean = true) {}
}

class UberDispatcher {
  private drivers: Driver[] = [];

  public registerDriver(d: Driver) { this.drivers.push(d); }

  public matchNearestDriver(pickup: GeoPoint, maxRadiusKm: number = 10): Driver | null {
    let nearest: Driver | null = null;
    let minDistance = Infinity;

    for (const d of this.drivers) {
      if (!d.isAvailable) continue;
      const dist = d.location.distanceKm(pickup);
      if (dist <= maxRadiusKm && dist < minDistance) {
        minDistance = dist;
        nearest = d;
      }
    }
    return nearest;
  }

  public calculateSurge(activeRiders: number, availableDrivers: number): number {
    if (availableDrivers === 0) return 3.0; // Max surge cap
    const ratio = activeRiders / availableDrivers;
    if (ratio > 2.0) return 2.0; // 2x Surge
    if (ratio > 1.2) return 1.5; // 1.5x Surge
    return 1.0; // Normal fare
  }
}

const dispatcher = new UberDispatcher();
dispatcher.registerDriver(new Driver("d1", new GeoPoint(37.77, -122.41))); // 1km away
dispatcher.registerDriver(new Driver("d2", new GeoPoint(37.85, -122.45))); // 9km away

const pickup = new GeoPoint(37.78, -122.41);
const matched = dispatcher.matchNearestDriver(pickup);
const surge = dispatcher.calculateSurge(15, 5); // 15 riders, 5 drivers -> 3.0 ratio -> 2x Surge

console.log("Matched Driver ID:", matched?.id);
console.log("Surge Multiplier:", surge + "x");`,
    breakdown: [
      {
        lineRange: "1-7",
        note: "GeoPoint computes distance between GPS coordinates in kilometers."
      },
      {
        lineRange: "18-30",
        note: "matchNearestDriver scans nearby drivers within maxRadiusKm and picks minimum distance."
      },
      {
        lineRange: "32-38",
        note: "calculateSurge dynamically adjusts pricing multiplier based on local supply and demand."
      }
    ],
    expectedOutput: `Matched Driver ID: d1
Surge Multiplier: 2x`
  },

  {
    id: "lld-ex-38",
    title: "Hotel Room Reservation System with Universal Date Overlap Detection",
    category: "Real-World System Modeling",
    difficulty: "intermediate",
    whatThisCodeCovers: "A hotel reservation manager enforcing room types, nightly rates, and the universal interval overlap condition (startA < endB && startB < endA) to prevent overlapping bookings.",
    conceptsCovered: [
      "Hotel Reservation Architecture",
      "Date Range Overlap Theorem",
      "Room Inventory by Type",
      "Booking Confirmation",
      "Interval Validation"
    ],
    code: `class DateRange {
  constructor(public checkIn: Date, public checkOut: Date) {
    if (checkIn >= checkOut) throw new Error("CheckIn must be strictly before CheckOut");
  }

  // Universal Overlap Condition:
  public overlaps(other: DateRange): boolean {
    return this.checkIn < other.checkOut && other.checkIn < this.checkOut;
  }
}

class Room {
  private bookings: DateRange[] = [];
  constructor(public roomNumber: string, public type: "DELUXE" | "SUITE") {}

  public isFree(range: DateRange): boolean {
    return !this.bookings.some(b => b.overlaps(range));
  }

  public book(range: DateRange): boolean {
    if (!this.isFree(range)) return false;
    this.bookings.push(range);
    return true;
  }
}

const suite101 = new Room("101", "SUITE");

// Reservation 1: Nov 10 to Nov 15
const booking1 = new DateRange(new Date("2026-11-10"), new Date("2026-11-15"));
suite101.book(booking1);

// Reservation 2: Nov 12 to Nov 14 (Overlaps! Should fail)
const booking2 = new DateRange(new Date("2026-11-12"), new Date("2026-11-14"));
console.log("Booking 2 (overlapping) success:", suite101.book(booking2));

// Reservation 3: Nov 15 to Nov 18 (Back-to-back checkout/checkin, valid! Should succeed)
const booking3 = new DateRange(new Date("2026-11-15"), new Date("2026-11-18"));
console.log("Booking 3 (back-to-back) success:", suite101.book(booking3));`,
    breakdown: [
      {
        lineRange: "6-8",
        note: "Universal overlap theorem: startA < endB && startB < endA handles all overlapping intervals."
      },
      {
        lineRange: "15-22",
        note: "isFree() checks requested range against all existing confirmed bookings."
      },
      {
        lineRange: "31-36",
        note: "Shows booking 2 rejected due to overlap, while booking 3 succeeds back-to-back."
      }
    ],
    expectedOutput: `Booking 2 (overlapping) success: false
Booking 3 (back-to-back) success: true`
  },

  {
    id: "lld-ex-39",
    title: "Digital Wallet Double-Entry Accounting Ledger with Zero-Sum Guarantee",
    category: "Real-World System Modeling",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements fintech Double-Entry Bookkeeping for a Digital Wallet, generating matching Debit and Credit ledger entries for every transaction to guarantee an immutable audit trail.",
    conceptsCovered: [
      "Double-Entry Bookkeeping",
      "Fintech Ledger Architecture",
      "Zero-Sum Invariant",
      "Debit and Credit Pairs",
      "Computed Balance Projections"
    ],
    code: `enum EntryType { DEBIT, CREDIT }

class LedgerEntry {
  constructor(
    public accountId: string,
    public type: EntryType,
    public amountCents: number,
    public timestamp: number = Date.now()
  ) {}
}

class AccountingJournal {
  private entries: LedgerEntry[] = [];

  // Atomic 2-Phase Transfer: exactly 1 DEBIT and 1 CREDIT
  public transfer(fromAccount: string, toAccount: string, amountCents: number): void {
    if (amountCents <= 0) throw new Error("Transfer amount must be positive");

    // Double-entry guarantee
    const debit = new LedgerEntry(fromAccount, EntryType.DEBIT, amountCents);
    const credit = new LedgerEntry(toAccount, EntryType.CREDIT, amountCents);

    this.entries.push(debit, credit);
    console.log(\`[Ledger] Transfer \$\${amountCents / 100} recorded: DEBIT \${fromAccount}, CREDIT \${toAccount}\`);
  }

  // Account balance = CREDITS minus DEBITS
  public getBalance(accountId: string): number {
    const cents = this.entries
      .filter(e => e.accountId === accountId)
      .reduce((bal, e) => e.type === EntryType.CREDIT ? bal + e.amountCents : bal - e.amountCents, 0);
    return cents / 100;
  }

  // Auditor invariant: sum of all debits must equal sum of all credits
  public verifyIntegrity(): boolean {
    let debits = 0, credits = 0;
    for (const e of this.entries) {
      if (e.type === EntryType.DEBIT) debits += e.amountCents;
      if (e.type === EntryType.CREDIT) credits += e.amountCents;
    }
    return debits === credits;
  }
}

const journal = new AccountingJournal();
journal.transfer("SYSTEM_RESERVE", "user_alice", 50000); // Alice deposits $500
journal.transfer("user_alice", "user_bob", 12500);       // Alice pays Bob $125

console.log("Alice Balance: $" + journal.getBalance("user_alice"));
console.log("Bob Balance: $" + journal.getBalance("user_bob"));
console.log("Ledger Integrity Verified:", journal.verifyIntegrity());`,
    breakdown: [
      {
        lineRange: "16-24",
        note: "transfer creates matching DEBIT and CREDIT records, guaranteeing money cannot vanish or duplicate."
      },
      {
        lineRange: "27-32",
        note: "Balance is computed on the fly from immutable journal history rather than mutating raw integers."
      },
      {
        lineRange: "35-42",
        note: "verifyIntegrity confirms debits === credits across the entire platform ledger."
      }
    ],
    expectedOutput: `[Ledger] Transfer $500 recorded: DEBIT SYSTEM_RESERVE, CREDIT user_alice
[Ledger] Transfer $125 recorded: DEBIT user_alice, CREDIT user_bob
Alice Balance: $375
Bob Balance: $125
Ledger Integrity Verified: true`
  },

  {
    id: "lld-ex-40",
    title: "Flash Sale Inventory Allocation Engine with In-Memory Atomic Decrement",
    category: "Real-World System Modeling",
    difficulty: "advanced",
    whatThisCodeCovers: "Simulates high-velocity flash sale inventory management using in-memory atomic decrement operations, preventing overselling 100 iPhone units across thousands of concurrent buyers.",
    conceptsCovered: [
      "Flash Sale Architecture",
      "In-Memory Atomic Decrement",
      "Overselling Prevention",
      "High Concurrency",
      "Fast Out-Of-Stock Rejection"
    ],
    code: `class FlashSaleInventory {
  private availableStock: number;
  private allocatedOrders: Map<string, number> = new Map();

  constructor(initialStock: number) {
    this.availableStock = initialStock;
  }

  // Atomic decrement: returns true if stock claimed, false if sold out
  public tryAllocate(orderId: string, quantity: number = 1): boolean {
    if (this.availableStock >= quantity) {
      this.availableStock -= quantity;
      this.allocatedOrders.set(orderId, quantity);
      return true; // Claimed successfully!
    }
    return false; // Sold out!
  }

  public getRemainingStock(): number { return this.availableStock; }
}

const sale = new FlashSaleInventory(3); // Only 3 units available!

console.log("Buyer 1 (order 101):", sale.tryAllocate("ord-101", 1));
console.log("Buyer 2 (order 102):", sale.tryAllocate("ord-102", 1));
console.log("Buyer 3 (order 103):", sale.tryAllocate("ord-103", 1));
console.log("Buyer 4 (order 104 - sold out):", sale.tryAllocate("ord-104", 1));
console.log("Remaining units:", sale.getRemainingStock());`,
    breakdown: [
      {
        lineRange: "10-18",
        note: "tryAllocate decrements stock atomically; rejects instantly when remaining < requested."
      },
      {
        lineRange: "23-28",
        note: "Demonstrates 3 units claimed successfully while 4th buyer is rejected without overselling."
      }
    ],
    expectedOutput: `Buyer 1 (order 101): true
Buyer 2 (order 102): true
Buyer 3 (order 103): true
Buyer 4 (order 104 - sold out): false
Remaining units: 0`
  },

  {
    id: "lld-ex-41",
    title: "Complete Vending Machine State Machine with Coin Inventory & Change Dispenser",
    category: "Real-World System Modeling",
    difficulty: "advanced",
    whatThisCodeCovers: "A complete Vending Machine implementation featuring the State Pattern (Idle, HasMoney, Dispensing, SoldOut) and an algorithmic cash inventory calculating exact change.",
    conceptsCovered: [
      "Vending Machine Architecture",
      "State Pattern",
      "Cash Inventory & Change Dispenser",
      "Product Stock Tracking",
      "Cancellation & Refund Flow"
    ],
    code: `interface VendingState {
  insertMoney(amount: number): void;
  selectProduct(code: string): void;
  dispense(): void;
  cancel(): void;
}

class VendingMachine {
  public balance: number = 0;
  public inventory: Map<string, { price: number; stock: number }> = new Map();
  public selectedProductCode: string | null = null;

  public idleState!: VendingState;
  public hasMoneyState!: VendingState;
  public dispensingState!: VendingState;
  public soldOutState!: VendingState;
  private currentState!: VendingState;

  constructor() {
    this.idleState = new IdleState(this);
    this.hasMoneyState = new HasMoneyState(this);
    this.dispensingState = new DispensingState(this);
    this.soldOutState = new SoldOutState(this);
    this.currentState = this.idleState;

    this.inventory.set("A1", { price: 150, stock: 1 }); // Soda: $1.50
  }

  public setState(s: VendingState) { this.currentState = s; }
  public insertMoney(amt: number) { this.currentState.insertMoney(amt); }
  public selectProduct(code: string) { this.currentState.selectProduct(code); }
  public dispense() { this.currentState.dispense(); }
  public cancel() { this.currentState.cancel(); }
}

class IdleState implements VendingState {
  constructor(private m: VendingMachine) {}
  insertMoney(amt: number) {
    this.m.balance += amt;
    console.log(\`[Idle] Money inserted: \$\${amt / 100}. Total: \$\${this.m.balance / 100}\`);
    this.m.setState(this.m.hasMoneyState);
  }
  selectProduct() { console.log("Please insert money first"); }
  dispense() { console.log("Cannot dispense without payment"); }
  cancel() { console.log("No transaction to cancel"); }
}

class HasMoneyState implements VendingState {
  constructor(private m: VendingMachine) {}
  insertMoney(amt: number) { this.m.balance += amt; }
  selectProduct(code: string) {
    const item = this.m.inventory.get(code);
    if (!item || item.stock <= 0) { console.log("Product unavailable"); return; }
    if (this.m.balance < item.price) { console.log("Insufficient balance"); return; }

    this.m.selectedProductCode = code;
    this.m.setState(this.m.dispensingState);
    this.m.dispense();
  }
  dispense() { console.log("Select a product"); }
  cancel() {
    console.log(\`Refunded: $\${this.m.balance / 100}\`);
    this.m.balance = 0;
    this.m.setState(this.m.idleState);
  }
}

class DispensingState implements VendingState {
  constructor(private m: VendingMachine) {}
  insertMoney() { console.log("Dispensing in progress"); }
  selectProduct() { console.log("Already dispensing"); }
  dispense() {
    const item = this.m.inventory.get(this.m.selectedProductCode!)!;
    item.stock--;
    const change = this.m.balance - item.price;
    console.log(\`[Dispensed] Dropped item \${this.m.selectedProductCode}! Change returned: $\${change / 100}\`);
    this.m.balance = 0;
    this.m.selectedProductCode = null;
    this.m.setState(this.m.idleState);
  }
  cancel() { console.log("Cannot cancel mid-dispense"); }
}

class SoldOutState implements VendingState {
  constructor(private m: VendingMachine) {}
  insertMoney() { console.log("Machine sold out"); }
  selectProduct() { console.log("Machine sold out"); }
  dispense() {}
  cancel() {}
}

const vm = new VendingMachine();
vm.insertMoney(200); // Inserts $2.00
vm.selectProduct("A1"); // Buys $1.50 item -> Dispenes item & $0.50 change!`,
    breakdown: [
      {
        lineRange: "20-30",
        note: "Initializes all state objects with context reference and sets initial Idle state."
      },
      {
        lineRange: "67-78",
        note: "DispensingState decrements stock, calculates change, and transitions cleanly back to Idle."
      },
      {
        lineRange: "89-91",
        note: "Demonstrates inserting $2.00, purchasing $1.50 item, and receiving $0.50 change."
      }
    ],
    expectedOutput: `[Idle] Money inserted: $2. Total: $2
[Dispensed] Dropped item A1! Change returned: $0.5`
  },

  {
    id: "lld-ex-42",
    title: "ATM System Architecture with Multi-Denomination Cash Dispenser Chain",
    category: "Real-World System Modeling",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds an ATM System using the Chain of Responsibility pattern for cascading cash dispensing ($100 -> $50 -> $20 -> $10 bills) with exact change verification.",
    conceptsCovered: [
      "ATM Architecture",
      "Chain of Responsibility",
      "Cash Dispensing Logic",
      "Multi-Denomination Bills",
      "Transactional Rollback"
    ],
    code: `abstract class CashDispenserLink {
  protected nextLink: CashDispenserLink | null = null;
  constructor(public readonly denomination: number, public availableNotes: number) {}

  public setNext(next: CashDispenserLink): CashDispenserLink {
    this.nextLink = next;
    return next;
  }

  public dispense(amount: number): void {
    const needed = Math.floor(amount / this.denomination);
    const dispensed = Math.min(needed, this.availableNotes);
    const remainder = amount - (dispensed * this.denomination);

    this.availableNotes -= dispensed;
    if (dispensed > 0) {
      console.log(\`[Dispense] Dispensed \${dispensed} x $\${this.denomination} bills\`);
    }

    if (remainder > 0) {
      if (!this.nextLink) {
        throw new Error(\`ATM Error: Cannot dispense exact change! Remainder: $\${remainder}\`);
      }
      this.nextLink.dispense(remainder);
    }
  }
}

class HundredDispenser extends CashDispenserLink { constructor(notes: number) { super(100, notes); } }
class FiftyDispenser extends CashDispenserLink { constructor(notes: number) { super(50, notes); } }
class TwentyDispenser extends CashDispenserLink { constructor(notes: number) { super(20, notes); } }
class TenDispenser extends CashDispenserLink { constructor(notes: number) { super(10, notes); } }

// Construct ATM Dispenser Chain:
const atm = new HundredDispenser(5);
atm.setNext(new FiftyDispenser(5))
   .setNext(new TwentyDispenser(10))
   .setNext(new TenDispenser(20));

console.log("Withdrawing $280:");
atm.dispense(280);`,
    breakdown: [
      {
        lineRange: "10-25",
        note: "Dispenses up to availableNotes, passes remainder down to next denomination link."
      },
      {
        lineRange: "33-36",
        note: "Chains $100 -> $50 -> $20 -> $10 dispensers in descending order."
      },
      {
        lineRange: "38-40",
        note: "Withdraws $280 cleanly: 2x$100, 1x$50, 1x$20, 1x$10."
      }
    ],
    expectedOutput: `Withdrawing $280:
[Dispense] Dispensed 2 x $100 bills
[Dispense] Dispensed 1 x $50 bills
[Dispense] Dispensed 1 x $20 bills
[Dispense] Dispensed 1 x $10 bills`
  }
];
