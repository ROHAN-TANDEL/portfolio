module.exports = [
  {
    id: "lld-ex-43",
    title: "Tic-Tac-Toe O(1) Win Checking on NxN Grid with Integer Accumulators",
    category: "Games & Simulation",
    difficulty: "intermediate",
    whatThisCodeCovers: "Evaluates win conditions on an arbitrary NxN Tic-Tac-Toe grid in strict O(1) time using row, column, and diagonal integer accumulators (+1 for Player 1, -1 for Player 2).",
    conceptsCovered: [
      "Tic-Tac-Toe Engine",
      "O(1) Evaluation",
      "Integer Accumulator Arrays",
      "Diagonal Checks",
      "Game State Management"
    ],
    code: `class FastTicTacToe {
  private n: number;
  private rows: number[];
  private cols: number[];
  private diag: number = 0;
  private antiDiag: number = 0;

  constructor(n: number = 3) {
    this.n = n;
    this.rows = new Array(n).fill(0);
    this.cols = new Array(n).fill(0);
  }

  // Returns 0: In progress, 1: Player 1 won, 2: Player 2 won
  public move(r: number, c: number, player: 1 | 2): number {
    const val = player === 1 ? 1 : -1;

    this.rows[r] += val;
    this.cols[c] += val;
    if (r === c) this.diag += val;
    if (r + c === this.n - 1) this.antiDiag += val;

    const target = player === 1 ? this.n : -this.n;

    // O(1) check
    if (
      this.rows[r] === target ||
      this.cols[c] === target ||
      this.diag === target ||
      this.antiDiag === target
    ) {
      return player; // Winner!
    }
    return 0; // Ongoing
  }
}

const game = new FastTicTacToe(3);
game.move(0, 0, 1); // P1 moves (0,0)
game.move(0, 1, 2); // P2 moves (0,1)
game.move(1, 1, 1); // P1 moves (1,1)
game.move(0, 2, 2); // P2 moves (0,2)
const winner = game.move(2, 2, 1); // P1 moves (2,2) -> Completes diagonal!

console.log("Winner (1=P1, 2=P2):", winner);`,
    breakdown: [
      {
        lineRange: "16-20",
        note: "Updates row, col, and diagonal accumulators (+1 for P1, -1 for P2)."
      },
      {
        lineRange: "24-32",
        note: "Checks whether moved row, col, or diagonal reaches target (+3 or -3) in strict O(1) time."
      },
      {
        lineRange: "36-41",
        note: "P1 places on main diagonal (0,0), (1,1), and (2,2), winning instantly."
      }
    ],
    expectedOutput: `Winner (1=P1, 2=P2): 1`
  },

  {
    id: "lld-ex-44",
    title: "Chess Game Object Model with Board Spots and Knight Movement Validation",
    category: "Games & Simulation",
    difficulty: "advanced",
    whatThisCodeCovers: "Designs an object-oriented Chess engine where Piece subclasses encapsulate their own geometric move validation rules, demonstrated through Knight L-shape jumping logic.",
    conceptsCovered: [
      "Chess Architecture",
      "Piece Abstraction",
      "Knight Movement Geometry",
      "Board Grid Representation",
      "Move Validation"
    ],
    code: `enum PieceColor { WHITE, BLACK }

interface Spot {
  x: number; // 0 to 7
  y: number; // 0 to 7
}

abstract class ChessPiece {
  constructor(public readonly color: PieceColor) {}
  abstract isValidMove(from: Spot, to: Spot, board: (ChessPiece | null)[][]): boolean;
}

class Knight extends ChessPiece {
  isValidMove(from: Spot, to: Spot, board: (ChessPiece | null)[][]): boolean {
    const dx = Math.abs(from.x - to.x);
    const dy = Math.abs(from.y - to.y);

    // Knight moves in an L-shape: (2, 1) or (1, 2)
    const isLShape = (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
    if (!isLShape) return false;

    // Destination cannot contain friendly piece
    const dest = board[to.x][to.y];
    if (dest !== null && dest.color === this.color) return false;

    return true; // Knight jumps over intermediate pieces!
  }
}

class Board {
  public grid: (ChessPiece | null)[][] = Array.from({ length: 8 }, () => new Array(8).fill(null));
}

const board = new Board();
const whiteKnight = new Knight(PieceColor.WHITE);
board.grid[1][0] = whiteKnight; // White Knight at b1 (1, 0)

// Test Move 1: (1, 0) -> (2, 2) [dx=1, dy=2] -> Valid L-shape!
console.log("Move to (2, 2) valid:", whiteKnight.isValidMove({ x: 1, y: 0 }, { x: 2, y: 2 }, board.grid));

// Test Move 2: (1, 0) -> (1, 3) [dx=0, dy=3] -> Invalid straight move!
console.log("Move to (1, 3) valid:", whiteKnight.isValidMove({ x: 1, y: 0 }, { x: 1, y: 3 }, board.grid));`,
    breakdown: [
      {
        lineRange: "13-27",
        note: "Knight evaluates L-shape trajectory (dx=1, dy=2 or dx=2, dy=1) and checks destination friendly fire."
      },
      {
        lineRange: "38-41",
        note: "Demonstrates valid L-jump returning true and invalid straight line returning false."
      }
    ],
    expectedOutput: `Move to (2, 2) valid: true
Move to (1, 3) valid: false`
  },

  {
    id: "lld-ex-45",
    title: "Snake and Ladder Game with Unified Jumpers and Fair Turn Queue",
    category: "Games & Simulation",
    difficulty: "intermediate",
    whatThisCodeCovers: "Models Snake and Ladder by unifying snakes and ladders into generic Jumper obstacles (start -> end), rotating player turns using a FIFO circular queue.",
    conceptsCovered: [
      "Snake and Ladder",
      "Unified Jumper Modeling",
      "Turn Queue Rotation",
      "Boundary Win Validation",
      "Game Loop Simulation"
    ],
    code: `class Jumper {
  constructor(public readonly start: number, public readonly end: number) {}
}

class SnakeLadderGame {
  private jumpers: Map<number, number> = new Map();
  private turnQueue: { name: string; pos: number }[] = [];
  public readonly winCell = 100;

  constructor(snakes: Jumper[], ladders: Jumper[], players: string[]) {
    for (const s of snakes) this.jumpers.set(s.start, s.end);
    for (const l of ladders) this.jumpers.set(l.start, l.end);
    this.turnQueue = players.map(name => ({ name, pos: 0 }));
  }

  public takeTurn(dice: number): string {
    const player = this.turnQueue.shift()!;
    let next = player.pos + dice;

    if (next <= this.winCell) {
      // Check for Snake or Ladder jumper
      if (this.jumpers.has(next)) {
        const target = this.jumpers.get(next)!;
        const type = target > next ? "Ladder" : "Snake";
        console.log(\`[\${player.name}] Hit a \${type}! \${next} -> \${target}\`);
        next = target;
      }
      player.pos = next;
    }

    if (player.pos === this.winCell) {
      return \`\${player.name} WINS THE GAME!\`;
    }

    this.turnQueue.push(player); // Re-enqueue for next round
    return \`\${player.name} is now at cell \${player.pos}\`;
  }
}

const game = new SnakeLadderGame(
  [new Jumper(14, 7)],   // Snake: 14 -> 7
  [new Jumper(4, 25)],   // Ladder: 4 -> 25
  ["Alice", "Bob"]
);

console.log(game.takeTurn(4));  // Alice rolls 4 -> hits ladder 4 -> 25!
console.log(game.takeTurn(5));  // Bob rolls 5 -> cell 5`,
    breakdown: [
      {
        lineRange: "1-3",
        note: "Jumper abstraction unifies snakes and ladders into start -> end coordinates."
      },
      {
        lineRange: "21-29",
        note: "Applies jumper dynamically if landing cell matches map key."
      },
      {
        lineRange: "44-46",
        note: "Alice lands on 4, climbing ladder to cell 25."
      }
    ],
    expectedOutput: `[Alice] Hit a Ladder! 4 -> 25
Alice is now at cell 25
Bob is now at cell 5`
  },

  {
    id: "lld-ex-46",
    title: "Connect Four with Vertical Gravity Drop and 4-Directional Streak Checking",
    category: "Games & Simulation",
    difficulty: "intermediate",
    whatThisCodeCovers: "Models the Connect Four board with gravity drop (finding lowest available row in column) and evaluates victory by inspecting 4 directional vectors from the placed chip in O(1) time.",
    conceptsCovered: [
      "Connect Four",
      "Gravity Simulation",
      "Directional Vectors",
      "Bidirectional Streak Count",
      "Grid Boundaries"
    ],
    code: `class ConnectFourEngine {
  public grid: number[][] = Array.from({ length: 6 }, () => new Array(7).fill(0));

  public drop(col: number, player: number): { row: number; won: boolean } {
    if (col < 0 || col >= 7 || this.grid[0][col] !== 0) throw new Error("Column full or invalid");

    // Gravity: find lowest open row
    let row = 5;
    while (row >= 0 && this.grid[row][col] !== 0) row--;

    this.grid[row][col] = player;
    const won = this.checkWin(row, col, player);
    return { row, won };
  }

  private checkWin(r: number, c: number, p: number): boolean {
    const vectors = [[0, 1], [1, 0], [1, 1], [1, -1]]; // H, V, D1, D2
    for (const [dr, dc] of vectors) {
      let count = 1;
      count += this.countStreak(r, c, dr, dc, p);
      count += this.countStreak(r, c, -dr, -dc, p);
      if (count >= 4) return true;
    }
    return false;
  }

  private countStreak(r: number, c: number, dr: number, dc: number, p: number): number {
    let streak = 0, currR = r + dr, currC = c + dc;
    while (currR >= 0 && currR < 6 && currC >= 0 && currC < 7 && this.grid[currR][currC] === p) {
      streak++;
      currR += dr;
      currC += dc;
    }
    return streak;
  }
}

const c4 = new ConnectFourEngine();
c4.drop(0, 1);
c4.drop(1, 1);
c4.drop(2, 1);
const res = c4.drop(3, 1); // 4th chip in a row horizontally!

console.log("Connect Four won on 4th drop:", res.won);`,
    breakdown: [
      {
        lineRange: "7-11",
        note: "Gravity drop scans from bottom row (5) upward until an empty cell is found."
      },
      {
        lineRange: "17-25",
        note: "Vector traversal checks horizontal, vertical, and both diagonals forward and backward."
      },
      {
        lineRange: "38-42",
        note: "Demonstrates horizontal 4-in-a-row victory."
      }
    ],
    expectedOutput: `Connect Four won on 4th drop: true`
  },

  {
    id: "lld-ex-47",
    title: "2048 Game Grid Row Compression & Merge using Matrix Transposition",
    category: "Games & Simulation",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements the core sliding and merging logic of 2048 by defining a single slideRowLeft function and using matrix transposition and reversal to handle all 4 directions with zero code duplication.",
    conceptsCovered: [
      "2048 Game Engine",
      "Row Compression & Merge",
      "Matrix Transposition",
      "DRY Principle",
      "Array Reversal"
    ],
    code: `class Engine2048 {
  // Core logic: slides non-zeros to left, merges adjacent equal pairs once
  public static slideLeft(row: number[]): number[] {
    const nonZero = row.filter(n => n !== 0);
    const merged: number[] = [];

    for (let i = 0; i < nonZero.length; i++) {
      if (i < nonZero.length - 1 && nonZero[i] === nonZero[i + 1]) {
        merged.push(nonZero[i] * 2);
        i++; // Skip merged sibling
      } else {
        merged.push(nonZero[i]);
      }
    }
    while (merged.length < row.length) merged.push(0);
    return merged;
  }

  public static slideRight(row: number[]): number[] {
    return this.slideLeft([...row].reverse()).reverse();
  }

  public static transpose(grid: number[][]): number[][] {
    return grid[0].map((_, col) => grid.map(row => row[col]));
  }
}

// Test row slide and merge:
const row = [2, 2, 4, 8];
console.log("Row [2, 2, 4, 8] slide Left:", Engine2048.slideLeft(row));
console.log("Row [2, 2, 4, 8] slide Right:", Engine2048.slideRight(row));`,
    breakdown: [
      {
        lineRange: "3-16",
        note: "slideLeft compacts non-zeros, merges adjacent equals once, and pads with zeros."
      },
      {
        lineRange: "18-20",
        note: "slideRight simply reverses row, applies slideLeft, and reverses back."
      },
      {
        lineRange: "27-29",
        note: "Shows [2, 2, 4, 8] merging into [4, 4, 8, 0] on Left, and [0, 4, 4, 8] on Right."
      }
    ],
    expectedOutput: `Row [2, 2, 4, 8] slide Left: [ 4, 4, 8, 0 ]
Row [2, 2, 4, 8] slide Right: [ 0, 4, 4, 8 ]`
  },

  {
    id: "lld-ex-48",
    title: "Card Deck with Fisher-Yates Shuffling & Dynamic Blackjack Ace Hand Scoring",
    category: "Games & Simulation",
    difficulty: "intermediate",
    whatThisCodeCovers: "Models an unbiased Fisher-Yates 52-card deck and a Blackjack hand evaluation engine that dynamically downgrades Ace values from 11 to 1 to prevent busting.",
    conceptsCovered: [
      "Deck of Cards",
      "Fisher-Yates Shuffling",
      "Blackjack Hand Scoring",
      "Dynamic Ace Adjustment",
      "Immutability"
    ],
    code: `enum Suit { HEARTS, DIAMONDS, CLUBS, SPADES }

class Card {
  constructor(public readonly suit: Suit, public readonly value: number, public readonly name: string) {}
}

class Deck {
  private cards: Card[] = [];

  constructor() {
    for (const suit of [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES]) {
      for (let v = 2; v <= 10; v++) this.cards.push(new Card(suit, v, String(v)));
      this.cards.push(new Card(suit, 10, "Jack"), new Card(suit, 10, "Queen"), new Card(suit, 10, "King"));
      this.cards.push(new Card(suit, 11, "Ace"));
    }
  }

  // Unbiased O(N) Fisher-Yates shuffle
  public shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }
}

class BlackjackHand {
  public cards: Card[] = [];

  public add(c: Card) { this.cards.push(c); }

  public getScore(): number {
    let total = this.cards.reduce((sum, c) => sum + c.value, 0);
    let aces = this.cards.filter(c => c.name === "Ace").length;

    // Dynamically adjust Ace from 11 to 1 if score > 21
    while (total > 21 && aces > 0) {
      total -= 10;
      aces--;
    }
    return total;
  }
}

const hand = new BlackjackHand();
hand.add(new Card(Suit.SPADES, 11, "Ace"));
hand.add(new Card(Suit.HEARTS, 11, "Ace")); // Two Aces = 22 -> 1 Ace converts to 1 -> Total = 12!
hand.add(new Card(Suit.CLUBS, 9, "9"));     // Total = 12 + 9 = 21 (Blackjack!)

console.log("Evaluated Hand Score (Expected 21):", hand.getScore());`,
    breakdown: [
      {
        lineRange: "18-23",
        note: "Fisher-Yates swaps cards[i] with random index [0..i] in O(N) time with zero statistical bias."
      },
      {
        lineRange: "31-41",
        note: "Aces count as 11 until hand exceeds 21, subtracting 10 per Ace to avoid busting."
      },
      {
        lineRange: "44-48",
        note: "Demonstrates Ace + Ace + 9 evaluating to 21 rather than busting at 31."
      }
    ],
    expectedOutput: `Evaluated Hand Score (Expected 21): 21`
  },

  {
    id: "lld-ex-49",
    title: "In-Memory Pub/Sub Message Broker with Partition Hashing and Consumer Groups",
    category: "Infrastructure & Messaging",
    difficulty: "advanced",
    whatThisCodeCovers: "Designs a Kafka-inspired in-memory Pub-Sub broker with partitioned topic message logs, partition key hashing, and consumer groups that track committed offsets independently.",
    conceptsCovered: [
      "Pub/Sub Broker",
      "Topic Partitions",
      "Consumer Groups",
      "Offset Tracking",
      "Partition Key Hashing"
    ],
    code: `class BrokerMessage {
  constructor(public offset: number, public payload: any) {}
}

class PartitionTopic {
  public partitions: BrokerMessage[][] = [];

  constructor(public readonly name: string, numPartitions: number = 2) {
    this.partitions = Array.from({ length: numPartitions }, () => []);
  }

  public publish(partitionKey: string, payload: any): { partition: number; offset: number } {
    let hash = 0;
    for (let i = 0; i < partitionKey.length; i++) hash = (hash * 31 + partitionKey.charCodeAt(i)) >>> 0;
    const pIdx = hash % this.partitions.length;

    const p = this.partitions[pIdx];
    const offset = p.length;
    p.push(new BrokerMessage(offset, payload));
    return { partition: pIdx, offset };
  }
}

class ConsumerGroup {
  private offsets: Map<number, number> = new Map(); // partition -> offset

  constructor(public readonly groupName: string) {}

  public poll(topic: PartitionTopic, partition: number): BrokerMessage | null {
    const currentOffset = this.offsets.get(partition) || 0;
    const p = topic.partitions[partition];

    if (currentOffset < p.length) {
      const msg = p[currentOffset];
      this.offsets.set(partition, currentOffset + 1); // Commit offset
      return msg;
    }
    return null;
  }
}

const topic = new PartitionTopic("orders", 2);
topic.publish("order_981", { item: "Laptop", amount: 1200 });
topic.publish("order_982", { item: "Mouse", amount: 25 });

const billingGroup = new ConsumerGroup("billing");
const msg = billingGroup.poll(topic, 0) || billingGroup.poll(topic, 1);
console.log("Billing processed message:", msg?.payload);`,
    breakdown: [
      {
        lineRange: "12-21",
        note: "Hashes partitionKey to route message deterministically to a specific partition queue."
      },
      {
        lineRange: "29-39",
        note: "poll() reads message at current offset and increments the committed offset pointer."
      },
      {
        lineRange: "43-47",
        note: "Demonstrates partitioned publish and consumer group polling."
      }
    ],
    expectedOutput: `Billing processed message: { item: 'Laptop', amount: 1200 }`
  },

  {
    id: "lld-ex-50",
    title: "In-Memory Logging Framework with Log Levels, Appenders & Formatters",
    category: "Infrastructure & Messaging",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs a Log4j-style logging framework with customizable LogLevels, pluggable Appenders (Console, InMemoryBuffer), and structured JSON vs Plaintext formatters.",
    conceptsCovered: [
      "Logging Framework",
      "Log Levels (DEBUG to ERROR)",
      "Appender Hierarchy",
      "Strategy Formatters",
      "Threshold Filtering"
    ],
    code: `enum LogLevel { DEBUG = 1, INFO = 2, WARN = 3, ERROR = 4 }

interface LogFormatter {
  format(level: LogLevel, msg: string, time: number): string;
}

class JsonFormatter implements LogFormatter {
  format(level: LogLevel, msg: string, time: number): string {
    return JSON.stringify({ timestamp: new Date(time).toISOString(), level: LogLevel[level], message: msg });
  }
}

interface LogAppender {
  append(formattedMessage: string): void;
}

class ConsoleAppender implements LogAppender {
  append(msg: string) { console.log(msg); }
}

class CustomLogger {
  private appenders: LogAppender[] = [];

  constructor(private minLevel: LogLevel, private formatter: LogFormatter) {}

  public addAppender(appender: LogAppender) { this.appenders.push(appender); }

  public log(level: LogLevel, message: string): void {
    if (level < this.minLevel) return; // Drop messages below active threshold
    const formatted = this.formatter.format(level, message, Date.now());
    for (const app of this.appenders) app.append(formatted);
  }

  public debug(msg: string) { this.log(LogLevel.DEBUG, msg); }
  public info(msg: string) { this.log(LogLevel.INFO, msg); }
  public error(msg: string) { this.log(LogLevel.ERROR, msg); }
}

const logger = new CustomLogger(LogLevel.INFO, new JsonFormatter());
logger.addAppender(new ConsoleAppender());

logger.debug("This debug trace is dropped!"); // Below INFO threshold
logger.info("Application gateway online");`,
    breakdown: [
      {
        lineRange: "7-11",
        note: "JsonFormatter outputs structured telemetry payloads."
      },
      {
        lineRange: "27-31",
        note: "Fast filter check (level < minLevel) drops unwanted debug logs in O(1) time without formatting string allocations."
      },
      {
        lineRange: "38-42",
        note: "Demonstrates debug trace ignored while info message formats and outputs cleanly."
      }
    ],
    expectedOutput: `{"timestamp":"2026-11-04T18:40:00.000Z","level":"INFO","message":"Application gateway online"}`
  },

  {
    id: "lld-ex-51",
    title: "Scheduled Task Engine with Min-Heap Priority Queue & Worker Pool",
    category: "Infrastructure & Messaging",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements an in-memory task scheduler that orders jobs by execution timestamp in a Min-Heap, non-blockingly executing due tasks while supporting recurring intervals.",
    conceptsCovered: [
      "Task Scheduler",
      "Min-Heap Priority Queue",
      "Non-Blocking Execution",
      "Recurring Tasks",
      "Worker Pool Dispatch"
    ],
    code: `class TaskJob {
  constructor(
    public name: string,
    public runAt: number,
    public action: () => void,
    public intervalMs: number = 0
  ) {}
}

class TaskSchedulerEngine {
  private heap: TaskJob[] = [];

  public schedule(name: string, delayMs: number, action: () => void, intervalMs: number = 0): void {
    const job = new TaskJob(name, Date.now() + delayMs, action, intervalMs);
    this.heap.push(job);
    this.heap.sort((a, b) => a.runAt - b.runAt); // Maintain min-heap order
  }

  public tick(): void {
    const now = Date.now();
    while (this.heap.length > 0 && this.heap[0].runAt <= now) {
      const job = this.heap.shift()!;
      console.log(\`[Scheduler] Dispatched task "\${job.name}"\`);
      job.action();

      // If recurring, reschedule for next epoch
      if (job.intervalMs > 0) {
        job.runAt = now + job.intervalMs;
        this.heap.push(job);
        this.heap.sort((a, b) => a.runAt - b.runAt);
      }
    }
  }
}

const scheduler = new TaskSchedulerEngine();
scheduler.schedule("SyncTelemetry", 50, () => console.log("Telemetry synced!"));
scheduler.schedule("Heartbeat", 100, () => console.log("Heartbeat alive!"), 100);

setTimeout(() => scheduler.tick(), 60);`,
    breakdown: [
      {
        lineRange: "13-17",
        note: "Maintains tasks ordered by earliest execution timestamp."
      },
      {
        lineRange: "19-32",
        note: "tick() pops and dispatches all tasks whose runAt <= now, re-enqueuing recurring tasks."
      },
      {
        lineRange: "35-39",
        note: "Schedules one-off and recurring tasks, testing dispatch."
      }
    ],
    expectedOutput: `[Scheduler] Dispatched task "SyncTelemetry"
Telemetry synced!`
  },

  {
    id: "lld-ex-52",
    title: "Clean Architecture Hexagonal Domain Model with Aggregate Root & Ports",
    category: "Architecture & Clean Code",
    difficulty: "advanced",
    whatThisCodeCovers: "Assembles a pure Clean Architecture domain model with an Order Aggregate Root, Value Objects, Domain Events, and Dependency Inversion Ports completely isolated from external frameworks.",
    conceptsCovered: [
      "Clean Architecture",
      "Hexagonal (Ports & Adapters)",
      "Aggregate Root",
      "Value Objects",
      "Dependency Inversion Principle"
    ],
    code: `// 1. PURE DOMAIN: Immutable Value Object
class Money {
  constructor(public readonly amountCents: number, public readonly currency: string = "USD") {
    if (amountCents < 0) throw new Error("Amount cannot be negative");
    Object.freeze(this);
  }
}

// 2. DOMAIN EVENT
class OrderPlacedEvent {
  constructor(public readonly orderId: string, public readonly totalCents: number) {}
}

// 3. AGGREGATE ROOT
class OrderAggregate {
  private items: { sku: string; price: Money }[] = [];
  public events: any[] = [];

  constructor(public readonly orderId: string) {}

  public addItem(sku: string, price: Money): void {
    this.items.push({ sku, price });
  }

  public place(): void {
    if (this.items.length === 0) throw new Error("Cannot place empty order");
    const total = this.items.reduce((sum, i) => sum + i.price.amountCents, 0);
    this.events.push(new OrderPlacedEvent(this.orderId, total));
    console.log(\`[Domain] Order \${this.orderId} placed. Total: $\${total / 100}\`);
  }
}

// 4. PORT (Interface)
interface OrderRepositoryPort {
  save(order: OrderAggregate): Promise<void>;
}

// 5. USE CASE
class PlaceOrderUseCase {
  constructor(private repo: OrderRepositoryPort) {} // DIP: Injected abstraction!

  async execute(order: OrderAggregate): Promise<void> {
    order.place();
    await this.repo.save(order);
  }
}

// 6. ADAPTER (Mock Infrastructure)
const inMemoryRepo: OrderRepositoryPort = {
  async save(order) { console.log(\`[Adapter] Saved order \${order.orderId} to database\`); }
};

const order = new OrderAggregate("ord_9901");
order.addItem("item_widget", new Money(4500)); // $45.00

const useCase = new PlaceOrderUseCase(inMemoryRepo);
useCase.execute(order);`,
    breakdown: [
      {
        lineRange: "2-7",
        note: "Money is an immutable Value Object preventing primitive obsession."
      },
      {
        lineRange: "15-30",
        note: "OrderAggregate enforces business invariants and raises domain events on state change."
      },
      {
        lineRange: "38-45",
        note: "PlaceOrderUseCase depends strictly on OrderRepositoryPort abstraction, achieving true DIP."
      }
    ],
    expectedOutput: `[Domain] Order ord_9901 placed. Total: $45
[Adapter] Saved order ord_9901 to database`
  }
];
