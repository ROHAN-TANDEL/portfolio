const { createCard } = require('../lld_builder_helper.cjs');

const category = "Games, State Machines & Turn-Based Systems";

module.exports = [
  createCard({
    idNum: 85,
    category,
    concept: "Tic-Tac-Toe: $O(1)$ Win Checking on $N \\times N$ Board",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you evaluate win conditions on an $N \\times N$ Tic-Tac-Toe board in strict $O(1)$ time complexity per move?",
    answer: "Instead of scanning the entire board ($O(N)$ row/column checks), maintain count arrays: `rows[N]`, `cols[N]`, `diag`, and `antiDiag`. Player 1 increments counts by +1; Player 2 decrements by -1. A player wins if the absolute value in the moved row, col, diag, or antiDiag reaches $N$, evaluated in $O(1)$ time.",
    explanation: "On a $3 \\times 3$ board, scanning all rows, columns, and diagonals takes 8 checks. On a $1000 \\times 1000$ board, scanning takes 2,000 checks per move. By using integer accumulators (+1 for X, -1 for O), after placing a piece at (r, c), check if `|rows[r]| === N`, `|cols[c]| === N`, `|diag| === N`, or `|antiDiag| === N`. If true, the moving player won instantly.",
    code: `class TicTacToeFast {
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

  // Returns 0: No win, 1: Player 1 won, 2: Player 2 won
  public makeMove(row: number, col: number, player: 1 | 2): number {
    const value = player === 1 ? 1 : -1;

    this.rows[row] += value;
    this.cols[col] += value;

    if (row === col) this.diag += value;
    if (row + col === this.n - 1) this.antiDiag += value;

    const target = player === 1 ? this.n : -this.n;

    // Strict O(1) evaluation:
    if (
      this.rows[row] === target ||
      this.cols[col] === target ||
      this.diag === target ||
      this.antiDiag === target
    ) {
      return player; // Winning move!
    }
    return 0; // Game continues
  }
}`,
    recallHint: "Player 1 = +1, Player 2 = -1; track rows[N], cols[N], diag, antiDiag. Check if |count| === N in O(1).",
    practice: [
      "Add board move history with Undo capability using the Command pattern",
      "Extend Tic-Tac-Toe to Gomoku (5-in-a-row on 15x15 board)"
    ],
    interviewTip: "Tic-Tac-Toe is a classic warm-up LLD question. Proposing the $O(1)$ row/column accumulator optimization immediately impresses interviewers over a brute-force matrix scanner.",
    tags: ["LLD Games", "Tic-Tac-Toe", "O(1) Optimization", "Algorithms"]
  }),

  createCard({
    idNum: 86,
    category,
    concept: "Chess Game Object Model & Move Validation",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you architect an extensible object model for a Chess game incorporating Piece movement validation, Board state, and Game status?",
    answer: "Model `Piece` as an abstract class (or interface with Strategy) with `canMove(from, to, board): boolean`. Concrete subclasses (King, Queen, Rook, Bishop, Knight, Pawn) implement their unique move geometry. `Board` manages an $8 \\times 8$ grid of `Spot` objects. `Move` encapsulates player, start, and end coordinates. `Game` coordinates turns, check/checkmate detection, and state machine transitions.",
    explanation: "Avoid putting move validation logic inside the Board class (violates SRP). Each Piece is the Information Expert regarding its own geometric trajectory (e.g. Knight moves in L-shapes and can jump over pieces; Rook requires an unblocked straight line). The Board provides lookup methods: `getPiece(x, y)` and `isPathClear(from, to)`.",
    code: `enum Color { WHITE, BLACK }

class Position {
  constructor(public readonly x: number, public readonly y: number) {}
}

abstract class Piece {
  constructor(public readonly color: Color) {}
  abstract canMove(from: Position, to: Position, board: ChessBoard): boolean;
}

class Knight extends Piece {
  canMove(from: Position, to: Position, board: ChessBoard): boolean {
    const dx = Math.abs(from.x - to.x);
    const dy = Math.abs(from.y - to.y);
    // Knight moves in L-shape: (2, 1) or (1, 2)
    const isLShape = (dx === 1 && dy === 2) || (dx === 2 && dy === 1);
    if (!isLShape) return false;

    const destPiece = board.getPiece(to);
    return destPiece === null || destPiece.color !== this.color;
  }
}

class ChessBoard {
  private grid: (Piece | null)[][] = Array.from({ length: 8 }, () => new Array(8).fill(null));

  public getPiece(pos: Position): Piece | null { return this.grid[pos.x][pos.y]; }
  public setPiece(pos: Position, piece: Piece | null): void { this.grid[pos.x][pos.y] = piece; }
}`,
    recallHint: "Piece has canMove(from, to, board); Board has 8x8 spots; Game handles turn switching and check detection.",
    practice: [
      "Implement Castling, En Passant, and Pawn Promotion using Command or Strategy pattern",
      "Design Checkmate detection (is king in check AND no valid moves remove the check?)"
    ],
    interviewTip: "In Chess LLD, don't attempt to code all 6 pieces completely in 45 minutes. Define the abstractions clearly, implement Knight and Pawn to show complex move handling, and outline the Checkmate logic.",
    tags: ["LLD Games", "Chess", "Object-Oriented Design", "Machine Coding"]
  }),

  createCard({
    idNum: 87,
    category,
    concept: "Snake and Ladder Game Architecture",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you design a flexible Snake and Ladder game supporting customizable board sizes, jumper obstacles, and fair turn rotation?",
    answer: "Model Snakes and Ladders using a unified `Jumper` abstraction (startPosition -> endPosition). If `start > end`, it is a Snake; if `start < end`, it is a Ladder. A `Dice` class provides configurable face values and roll generation. A circular queue (or FIFO queue) rotates `Player` turns. A `Board` checks if the landing cell contains a jumper and transports the player.",
    explanation: "Hardcoding snakes and ladders into separate arrays creates duplicated code. By treating both as generic Jumper entities, the board lookup is a simple `Map<number, number>`. The game loop: dequeue active player, roll dice, calculate `nextPos = currentPos + roll`, apply jumper if present, check if `nextPos === winCell`, and re-enqueue player.",
    code: `class Jumper {
  constructor(public readonly start: number, public readonly end: number) {}
}

class SnakeAndLadderBoard {
  private jumpers: Map<number, number> = new Map();
  public readonly totalCells: number;

  constructor(size: number = 100, snakes: Jumper[], ladders: Jumper[]) {
    this.totalCells = size;
    for (const s of snakes) this.jumpers.set(s.start, s.end);
    for (const l of ladders) this.jumpers.set(l.start, l.end);
  }

  public getFinalPosition(targetCell: number): number {
    return this.jumpers.get(targetCell) ?? targetCell;
  }
}

class SnakeAndLadderGame {
  private playersQueue: { name: string; position: number }[] = [];
  private board: SnakeAndLadderBoard;

  constructor(board: SnakeAndLadderBoard, players: string[]) {
    this.board = board;
    this.playersQueue = players.map(name => ({ name, position: 0 }));
  }

  public playTurn(diceRoll: number): string {
    const player = this.playersQueue.shift()!;
    let nextPos = player.position + diceRoll;

    if (nextPos <= this.board.totalCells) {
      player.position = this.board.getFinalPosition(nextPos);
    }

    if (player.position === this.board.totalCells) {
      return \`\${player.name} wins the game!\`;
    }

    this.playersQueue.push(player); // Re-enqueue for next round
    return \`\${player.name} moved to cell \${player.position}\`;
  }
}`,
    recallHint: "Unify Snakes & Ladders as Jumpers (start -> end); use FIFO queue for rotating player turns.",
    practice: [
      "Add rule: rolling a 6 grants an extra turn, but rolling three 6s in a row voids the turn",
      "Model multiple dice and board size customization via Builder pattern"
    ],
    interviewTip: "Snake & Ladder is a top interview problem for demonstrating clean data modeling (unifying Snake/Ladder into Jumper) and turn rotation via Queue.",
    tags: ["LLD Games", "Snake and Ladder", "Queue", "Game Loop"]
  }),

  createCard({
    idNum: 88,
    category,
    concept: "Connect Four: Gravity Drop & Directional Vectors",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you model Connect Four with vertical gravity drop and multi-directional 4-in-a-row victory detection?",
    answer: "Model the grid as a 2D array ($6 \\times 7$). The `dropPiece(col, player)` method finds the lowest empty row in that column (gravity simulation). For victory checking, inspect 4 vector directions starting from the placed piece: Horizontal (0, 1), Vertical (1, 0), Diagonal Up (1, 1), and Diagonal Down (1, -1), counting contiguous matching pieces in both forward and reverse directions.",
    explanation: "Iterating through the entire board after every drop is inefficient. Only the newly dropped piece could have completed a 4-in-a-row streak. Checking 3 cells forward and 3 cells backward along the 4 directional axes from the placed coordinate evaluates victory in $O(1)$ constant time.",
    code: `class ConnectFour {
  private rows = 6;
  private cols = 7;
  private grid: number[][] = Array.from({ length: 6 }, () => new Array(7).fill(0));

  public dropPiece(col: number, player: number): { row: number; col: number; won: boolean } {
    if (col < 0 || col >= this.cols || this.grid[0][col] !== 0) {
      throw new Error("Invalid column or column full!");
    }

    // Gravity: Find lowest unoccupied row
    let row = this.rows - 1;
    while (row >= 0 && this.grid[row][col] !== 0) row--;

    this.grid[row][col] = player;
    const won = this.checkWin(row, col, player);
    return { row, col, won };
  }

  private checkWin(r: number, c: number, player: number): boolean {
    const directions = [
      [0, 1],  // Horizontal
      [1, 0],  // Vertical
      [1, 1],  // Diagonal /
      [1, -1]  // Diagonal \\
    ];

    for (const [dr, dc] of directions) {
      let count = 1;
      // Forward direction
      count += this.countStreak(r, c, dr, dc, player);
      // Backward direction
      count += this.countStreak(r, c, -dr, -dc, player);
      if (count >= 4) return true;
    }
    return false;
  }

  private countStreak(r: number, c: number, dr: number, dc: number, player: number): number {
    let streak = 0;
    let currR = r + dr, currC = c + dc;
    while (currR >= 0 && currR < this.rows && currC >= 0 && currC < this.cols && this.grid[currR][currC] === player) {
      streak++;
      currR += dr;
      currC += dc;
    }
    return streak;
  }
}`,
    recallHint: "Find lowest empty row in column (gravity); check 4 vector directions (H, V, D1, D2) from placed piece.",
    practice: [
      "Add board full / draw game detection in O(1) by tracking total placed pieces",
      "Implement a minimax AI opponent evaluating column choices"
    ],
    interviewTip: "Using directional vectors `[dr, dc]` to check bidirectional streaks is the standard clean-code pattern for Connect Four, Word Searches, and Grid Puzzles.",
    tags: ["LLD Games", "Connect Four", "Direction Vectors", "Grid Algorithms"]
  }),

  createCard({
    idNum: 89,
    category,
    concept: "2048 Game Grid: Compaction, Merging & Sliding Logic",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you implement the core row/column slide and merge mechanics for the 2048 game without duplicating code across 4 directions?",
    answer: "Implement a single core function: `slideAndMergeRow(row)`. To support all 4 directions (Left, Right, Up, Down), transform the grid: 1. Left is direct row slide, 2. Right is reverse row -> slide -> reverse, 3. Up is transpose grid -> slide -> transpose back, 4. Down is transpose -> reverse -> slide -> reverse -> transpose. This reuses 100% of the merging logic.",
    explanation: "Writing custom nested loops for each of Left, Right, Up, and Down is 150 lines of duplicate, bug-prone code. Matrix Transposition swaps rows with columns. Array Reversal swaps horizontal direction. Transforming the board, invoking `slideAndMergeLeft()`, and inverting the transformation reduces the entire game engine to 30 clean lines.",
    code: `class Game2048Engine {
  // Core: slides non-zero numbers to left, merges adjacent equals once
  public static slideRowLeft(row: number[]): number[] {
    // 1. Filter out zeros (compact)
    let nonZero = row.filter(val => val !== 0);
    const result: number[] = [];

    // 2. Merge adjacent identical pairs
    for (let i = 0; i < nonZero.length; i++) {
      if (i < nonZero.length - 1 && nonZero[i] === nonZero[i + 1]) {
        result.push(nonZero[i] * 2);
        i++; // Skip merged sibling
      } else {
        result.push(nonZero[i]);
      }
    }

    // 3. Pad with trailing zeros to original length
    while (result.length < row.length) result.push(0);
    return result;
  }

  // Transpose matrix (swaps rows and columns)
  public static transpose(grid: number[][]): number[][] {
    return grid[0].map((_, colIndex) => grid.map(row => row[colIndex]));
  }
}`,
    recallHint: "Implement slideRowLeft once; use matrix transposition and array reversal to support all 4 directions.",
    practice: [
      "Implement slideUp using transpose() -> slideRowLeft() -> transpose()",
      "Check Game Over condition (no empty cells AND no adjacent equal neighbors)"
    ],
    interviewTip: "Demonstrating matrix transposition and reversal to handle 4 directions proves you write DRY, elegant mathematical code rather than copy-pasting four similar nested loops.",
    tags: ["LLD Games", "2048", "Matrix Transformations", "DRY Principle"]
  }),

  createCard({
    idNum: 90,
    category,
    concept: "Card Deck, Fisher-Yates Shuffling & Blackjack Scoring",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you model a Card Deck with unbiased Fisher-Yates shuffling and dynamic Ace scoring in Blackjack (1 or 11)?",
    answer: "Model `Card` as an immutable Value Object with `Suit` (Clubs, Diamonds, Hearts, Spades) and `Rank` (2..10, Jack, Queen, King, Ace). `Deck` initializes 52 cards and shuffles them in $O(N)$ time using the unbiased Fisher-Yates algorithm. In Blackjack, a `Hand` calculates score by treating Aces as 11, and while total $> 21$ and an Ace is present, downgrading Ace values to 1.",
    explanation: "Using `sort(() => Math.random() - 0.5)` is heavily biased and violates statistical randomness. Fisher-Yates swaps each element with a random index from 0 to $i$, guaranteeing an exact uniform distribution ($1/52!$). In Blackjack hand evaluation, calculating Aces dynamically avoids busting on soft hands.",
    code: `enum Suit { HEARTS, DIAMONDS, CLUBS, SPADES }
enum Rank { TWO = 2, THREE = 3, TEN = 10, JACK = 10, QUEEN = 10, KING = 10, ACE = 11 }

class Card {
  constructor(public readonly suit: Suit, public readonly rank: Rank) {}
}

class Deck {
  private cards: Card[] = [];

  constructor() { this.reset(); }

  public reset(): void {
    this.cards = [];
    for (const suit of [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES]) {
      for (const rank of [Rank.TWO, Rank.THREE, Rank.TEN, Rank.JACK, Rank.QUEEN, Rank.KING, Rank.ACE]) {
        this.cards.push(new Card(suit, rank));
      }
    }
  }

  // Unbiased Fisher-Yates Shuffle in O(N)
  public shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  public deal(): Card | null { return this.cards.pop() ?? null; }
}

class BlackjackHand {
  private cards: Card[] = [];

  public addCard(c: Card) { this.cards.push(c); }

  public getScore(): number {
    let score = this.cards.reduce((sum, c) => sum + c.rank, 0);
    let aces = this.cards.filter(c => c.rank === Rank.ACE).length;

    // Downgrade Aces from 11 to 1 if busted!
    while (score > 21 && aces > 0) {
      score -= 10;
      aces--;
    }
    return score;
  }
}`,
    recallHint: "Fisher-Yates shuffle (swap with random 0..i in O(N)); Ace defaults to 11, subtracts 10 if score > 21.",
    practice: [
      "Implement multi-deck shoe management with cut-card penetration for Blackjack",
      "Model Poker hand ranking (Flush, Straight, Full House) using Comparator chain"
    ],
    interviewTip: "Never use `Math.random() - 0.5` in a coding interview when asked to shuffle a deck. Always implement the Fisher-Yates (Knuth) algorithm.",
    tags: ["LLD Games", "Blackjack", "Fisher Yates", "Card Deck"]
  }),

  createCard({
    idNum: 91,
    category,
    concept: "Vending Machine System (State Pattern)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you design a complete Vending Machine system using the State Pattern to handle inventory, coins, and change return?",
    answer: "Use the State pattern with states: `IdleState`, `HasMoneyState`, `DispensingState`, and `SoldOutState`. The `VendingMachine` context manages an `Inventory` of items, a `CashInventory` of coin denominations, and delegates user actions (`insertCoin`, `selectProduct`, `refund`, `dispense`) to the current state. State transitions occur based on validation.",
    explanation: "A Vending Machine must calculate exact change using available coin denominations. If a user inserts $5 for a $1.50 soda, but the machine lacks two $1 coins or quarters, it must refund the user's money and refuse to dispense. Encapsulating this in `DispensingState` keeps edge cases organized without monolithic if-statements.",
    code: `interface VendingState {
  insertCoin(amount: number): void;
  selectItem(code: string): void;
  dispense(): void;
  refund(): number;
}

class VendingMachineContext {
  private currentState!: VendingState;
  public balance: number = 0;
  public inventory: Map<string, { price: number; count: number }> = new Map();

  public setState(state: VendingState) { this.currentState = state; }
  public insertCoin(amount: number) { this.currentState.insertCoin(amount); }
  public selectItem(code: string) { this.currentState.selectItem(code); }
}`,
    recallHint: "State Pattern: Idle -> HasMoney -> Dispensing -> SoldOut. Check change availability before dispensing.",
    practice: [
      "Implement Greedy vs Dynamic Programming Change-Making algorithm for coin dispensing",
      "Handle power outage recovery by persisting current state and balance"
    ],
    interviewTip: "Vending Machine is arguably the most common LLD interview question. The key evaluation points are the State pattern and accurate change calculation.",
    tags: ["LLD System", "Vending Machine", "State Pattern", "Machine Coding"]
  }),

  createCard({
    idNum: 92,
    category,
    concept: "ATM System & Cash Dispenser Chain of Responsibility",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you design an ATM System combining the State Pattern for user workflows with the Chain of Responsibility for multi-denomination cash dispensing?",
    answer: "The user session workflow (CardInserted, PinEntered, AccountSelected, TransactionComplete) is managed by the State Pattern. The physical cash dispenser is implemented as a Chain of Responsibility ($100 Dispenser -> $50 Dispenser -> $20 Dispenser -> $10 Dispenser), where each link dispenses its quotient of currency and passes the remainder to the next denomination link.",
    explanation: "If a user withdraws $280, the $100 handler dispenses 2 notes ($200) and passes $80. The $50 handler dispenses 1 note ($50) and passes $30. The $20 handler dispenses 1 note ($20) and passes $10. The $10 handler dispenses 1 note ($10) and finishes. If remainder > 0 at the end of the chain, the entire transaction rolls back.",
    code: `abstract class CurrencyDispenser {
  protected nextDispenser: CurrencyDispenser | null = null;
  constructor(protected denomination: number) {}

  public setNext(next: CurrencyDispenser): CurrencyDispenser {
    this.nextDispenser = next;
    return next;
  }

  public dispense(amount: number): void {
    const notes = Math.floor(amount / this.denomination);
    const remainder = amount % this.denomination;

    if (notes > 0) {
      console.log(\`Dispensing \${notes} x $\${this.denomination} bills\`);
    }

    if (remainder > 0) {
      if (!this.nextDispenser) {
        throw new Error(\`Unable to dispense exact change! Remainder: \$\${remainder}\`);
      }
      this.nextDispenser.dispense(remainder);
    }
  }
}

class HundredDollarDispenser extends CurrencyDispenser { constructor() { super(100); } }
class FiftyDollarDispenser extends CurrencyDispenser { constructor() { super(50); } }
class TwentyDollarDispenser extends CurrencyDispenser { constructor() { super(20); } }
class TenDollarDispenser extends CurrencyDispenser { constructor() { super(10); } }

// Assemble Dispenser Chain:
const atmDispenser = new HundredDollarDispenser();
atmDispenser
  .setNext(new FiftyDollarDispenser())
  .setNext(new TwentyDollarDispenser())
  .setNext(new TenDollarDispenser());

atmDispenser.dispense(280); // Dispenses 2x$100, 1x$50, 1x$20, 1x$10!`,
    recallHint: "State pattern for ATM screens (Card -> PIN -> Menu); Chain of Responsibility for cascading cash dispensing.",
    practice: [
      "Add finite bill count limits: if ATM runs out of $100 bills, fail-over to more $50 bills",
      "Model 3-attempt PIN lockout security state"
    ],
    interviewTip: "Combining the State Pattern (for UI screen navigation) with Chain of Responsibility (for bill dispensing) shows architectural breadth and pattern synergy.",
    tags: ["LLD System", "ATM System", "Chain of Responsibility", "State Pattern"]
  }),

  createCard({
    idNum: 93,
    category,
    concept: "Elevator Scheduling Dispatcher (LOOK / SCAN Algorithms)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you design an Elevator System using the LOOK / SCAN elevator scheduling algorithm?",
    answer: "The LOOK algorithm services floor requests in the elevator's current direction (e.g. UP) until there are no further requests in that direction, then reverses direction (DOWN) and services requests along the reverse path. The Elevator maintains two sorted sets: `upRequests` (ascending) and `downRequests` (descending). A central Dispatcher assigns external hall calls to the optimal elevator.",
    explanation: "A naive FCFS (First-Come, First-Served) elevator bounces chaotically between floors 1, 50, and 2, causing massive wait times and burning motor energy. LOOK behaves like a disk head: it moves in one direction as far as needed, stopping at all requested floors along the way, before reversing, minimizing total transit time.",
    code: `enum Direction { UP, DOWN, IDLE }

class Elevator {
  public currentFloor: number = 0;
  public direction: Direction = Direction.IDLE;
  private upStops: Set<number> = new Set();
  private downStops: Set<number> = new Set();

  public addRequest(floor: number): void {
    if (floor > this.currentFloor) this.upStops.add(floor);
    else if (floor < this.currentFloor) this.downStops.add(floor);

    if (this.direction === Direction.IDLE) {
      this.direction = floor >= this.currentFloor ? Direction.UP : Direction.DOWN;
    }
  }

  public step(): void {
    if (this.direction === Direction.UP) {
      this.currentFloor++;
      if (this.upStops.has(this.currentFloor)) {
        console.log(\`[Elevator] Stopped at floor \${this.currentFloor} (UP)\`);
        this.upStops.delete(this.currentFloor);
      }
      if (this.upStops.size === 0) {
        this.direction = this.downStops.size > 0 ? Direction.DOWN : Direction.IDLE;
      }
    } else if (this.direction === Direction.DOWN) {
      this.currentFloor--;
      if (this.downStops.has(this.currentFloor)) {
        console.log(\`[Elevator] Stopped at floor \${this.currentFloor} (DOWN)\`);
        this.downStops.delete(this.currentFloor);
      }
      if (this.downStops.size === 0) {
        this.direction = this.upStops.size > 0 ? Direction.UP : Direction.IDLE;
      }
    }
  }
}`,
    recallHint: "LOOK algorithm: travel in current direction servicing all stops; reverse only when no stops remain.",
    practice: [
      "Implement multi-car Elevator Dispatcher selecting the elevator with lowest estimated time of arrival (ETA)",
      "Model emergency fire alarm override state parking all cars on Floor 1"
    ],
    interviewTip: "In Elevator LLD, always distinguish between Internal Car Calls (passenger presses floor 7 inside) and External Hall Calls (user presses UP on floor 3 outside).",
    tags: ["LLD System", "Elevator", "LOOK Algorithm", "Scheduling"]
  }),

  createCard({
    idNum: 94,
    category,
    concept: "Rule Engine with Composite Expression Evaluator",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you design a dynamic Rule Engine that evaluates complex nested boolean conditions against arbitrary domain payloads?",
    answer: "Use the Composite Pattern combined with the Interpreter or Specification Pattern. Atomic rules (e.g. `age > 18`, `country === 'US'`) act as Leaf nodes. Logical operators (`AND`, `OR`, `NOT`) act as Composite nodes holding child expressions. The entire rule tree is evaluated recursively against a context dictionary.",
    explanation: "Hardcoding business eligibility rules inside service code requires redeployments every time business analysts adjust criteria. A Composite Rule Engine allows rules to be serialized as JSON, stored in a database, loaded into memory, and evaluated dynamically at runtime.",
    code: `interface RuleExpression {
  evaluate(context: Record<string, any>): boolean;
}

// Leaf: Simple comparison rule
class ComparisonRule implements RuleExpression {
  constructor(
    private field: string,
    private operator: "EQ" | "GT" | "LT",
    private targetValue: any
  ) {}

  evaluate(context: Record<string, any>): boolean {
    const val = context[this.field];
    if (this.operator === "EQ") return val === this.targetValue;
    if (this.operator === "GT") return val > this.targetValue;
    if (this.operator === "LT") return val < this.targetValue;
    return false;
  }
}

// Composite: AND Rule
class AndCompositeRule implements RuleExpression {
  private rules: RuleExpression[];
  constructor(...rules: RuleExpression[]) { this.rules = rules; }

  evaluate(context: Record<string, any>): boolean {
    return this.rules.every(r => r.evaluate(context)); // Short-circuit evaluation!
  }
}

// Composite: OR Rule
class OrCompositeRule implements RuleExpression {
  private rules: RuleExpression[];
  constructor(...rules: RuleExpression[]) { this.rules = rules; }

  evaluate(context: Record<string, any>): boolean {
    return this.rules.some(r => r.evaluate(context));
  }
}

// Loan Approval Rule: (creditScore > 700 AND income > 50000) OR hasCoSigner == true
const loanRule = new OrCompositeRule(
  new AndCompositeRule(
    new ComparisonRule("creditScore", "GT", 700),
    new ComparisonRule("income", "GT", 50000)
  ),
  new ComparisonRule("hasCoSigner", "EQ", true)
);

console.log("Eligible:", loanRule.evaluate({ creditScore: 720, income: 60000 })); // true!`,
    recallHint: "Composite Pattern: Leaf comparison rules + Composite AND/OR nodes; evaluate(context) recursively.",
    practice: [
      "Deserialize a JSON rule definition into a live executable RuleExpression tree",
      "Add explainability: have the rule engine return the exact clause that caused failure"
    ],
    interviewTip: "Mentioning the Specification Pattern (Evans/Fowler DDD) when discussing composite rule engines shows deep software architecture knowledge.",
    tags: ["LLD System", "Rule Engine", "Composite Pattern", "Specification"]
  }),

  createCard({
    idNum: 95,
    category,
    concept: "Traffic Light Controller State Machine",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you model an Intelligent Traffic Light Controller supporting emergency vehicle preemption and pedestrian sensors?",
    answer: "Model the intersection as a State Machine. States represent active phases: `NorthSouthGreen`, `NorthSouthYellow`, `EastWestGreen`, `EastWestYellow`. Transitions occur based on timers, pedestrian push-buttons, and emergency sirens. When an Emergency Vehicle signal is detected, the system immediately transitions to an all-red safety buffer and grants a green corridor.",
    explanation: "A simple timer is insufficient for modern cities. The controller must support inputs: loop inductive vehicle detectors, pedestrian crossing buttons, and optical emergency vehicle sensors. State transitions must enforce a mandatory Yellow phase and All-Red clearance interval before opening conflicting directions to prevent collisions.",
    code: `enum SignalColor { RED, YELLOW, GREEN }

interface IntersectionState {
  handleTick(): void;
  pedestrianButton(): void;
  emergencyVehicleArrived(): void;
}

class TrafficControllerContext {
  public nsSignal: SignalColor = SignalColor.RED;
  public ewSignal: SignalColor = SignalColor.RED;
  private currentState!: IntersectionState;

  public transitionTo(state: IntersectionState) { this.currentState = state; }
  public onTick() { this.currentState.handleTick(); }
}`,
    recallHint: "State machine with phases (NS Green -> NS Yellow -> All Red -> EW Green). Enforce yellow clearance interval.",
    practice: [
      "Implement emergency vehicle green corridor preemption with safe yellow transition",
      "Design 4-way intersection turn signal arrows (protected green vs permissive green)"
    ],
    interviewTip: "Never skip the yellow or all-red transition during emergency preemption in an interview. Abruptly switching conflicting lights from Green to Green causes simulated fatal collisions.",
    tags: ["LLD System", "Traffic Light", "State Machine", "Concurrency"]
  }),

  createCard({
    idNum: 96,
    category,
    concept: "In-Memory File System with Fast Search",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you design an In-Memory File System supporting nested directories, file read/write, and fast path resolution?",
    answer: "Use the Composite Pattern. An abstract `Node` has a name and parent reference. `File` stores content strings/bytes. `Directory` maintains a `Map<string, Node>` of children. Path parsing (`/a/b/c`) splits the string by `/` and traverses children from root or current directory in $O(P)$ time where $P$ is path depth.",
    explanation: "This is a frequent machine coding question (LeetCode 588). Methods required: `ls(path)`, `mkdir(path)`, `addContentToFile(path, content)`, `readContentFromFile(path)`. Using a Trie-like directory hierarchy allows intuitive traversal and supports permissions and symbolic links.",
    code: `abstract class FSNode {
  constructor(public name: string, public parent: FSDirectory | null = null) {}
  abstract isDirectory(): boolean;
}

class FSFile extends FSNode {
  public content: string = "";
  isDirectory(): boolean { return false; }
}

class FSDirectory extends FSNode {
  public children: Map<string, FSNode> = new Map();
  isDirectory(): boolean { return true; }
}

class InMemoryFileSystem {
  private root: FSDirectory = new FSDirectory("");

  public mkdir(path: string): void {
    this.traverseOrCreate(path);
  }

  public writeFile(path: string, content: string): void {
    const parts = path.split("/").filter(Boolean);
    const fileName = parts.pop()!;
    const dir = this.traverseOrCreate("/" + parts.join("/"));

    let file = dir.children.get(fileName) as FSFile;
    if (!file) {
      file = new FSFile(fileName, dir);
      dir.children.set(fileName, file);
    }
    file.content += content;
  }

  public readFile(path: string): string {
    const node = this.resolve(path);
    if (!node || node.isDirectory()) throw new Error("File not found or is directory");
    return (node as FSFile).content;
  }

  private traverseOrCreate(path: string): FSDirectory {
    const parts = path.split("/").filter(Boolean);
    let curr = this.root;
    for (const part of parts) {
      if (!curr.children.has(part)) {
        const newDir = new FSDirectory(part, curr);
        curr.children.set(part, newDir);
      }
      curr = curr.children.get(part) as FSDirectory;
    }
    return curr;
  }

  private resolve(path: string): FSNode | null {
    const parts = path.split("/").filter(Boolean);
    let curr: FSNode = this.root;
    for (const part of parts) {
      if (!curr.isDirectory()) return null;
      curr = (curr as FSDirectory).children.get(part)!;
      if (!curr) return null;
    }
    return curr;
  }
}`,
    recallHint: "Composite Pattern: Node -> File and Directory (holds Map<string, Node>). Split path by '/' to traverse.",
    practice: [
      "Add support for relative paths (./ and ../) and symbolic links",
      "Implement grep(regex) scanning file contents recursively"
    ],
    interviewTip: "Splitting paths with `.split('/').filter(Boolean)` safely strips leading, trailing, and duplicate slashes.",
    tags: ["LLD System", "File System", "Composite Pattern", "Directory Tree"]
  })
];
