/**
 * JavaScript Applied Examples - Part 4 (Iterators, Generators & Data Structures Recipes 31-40)
 */

module.exports = [
  {
    id: "js-ex-31",
    title: "Custom Range Generator Utility with Negative Steps",
    category: "Iterators & Generators",
    difficulty: "beginner",
    whatThisCodeCovers: "Builds a flexible, memory-efficient Python-style `range()` generator utility supporting positive, negative, and fractional step intervals in $O(1)$ memory.",
    conceptsCovered: ["Generators", "yield", "Lazy Evaluation", "Range Utility"],
    code: `function* range(start, end, step = 1) {
  if (end === undefined) {
    end = start;
    start = 0;
  }

  if (step === 0) throw new Error("Step cannot be zero");

  if (step > 0) {
    for (let i = start; i < end; i += step) {
      yield i;
    }
  } else {
    for (let i = start; i > end; i += step) {
      yield i;
    }
  }
}

// 1. Positive step
console.log("Range 0..5:", [...range(5)]); // [0, 1, 2, 3, 4]

// 2. Custom step
console.log("Range 10..20 by 2:", [...range(10, 20, 2)]); // [10, 12, 14, 16, 18]

// 3. Negative step
console.log("Countdown 5..0:", [...range(5, 0, -1)]); // [5, 4, 3, 2, 1]`,
    breakdown: [
      { lineRange: "1-6", note: "Handles single argument range(5) defaulting start to 0." },
      { lineRange: "8-18", note: "Yields numbers in sequence for both positive and negative steps." },
      { lineRange: "21-27", note: "Demonstrates lazy evaluation unpacked via the spread operator." }
    ],
    expectedOutput: `Range 0..5: [ 0, 1, 2, 3, 4 ]
Range 10..20 by 2: [ 10, 12, 14, 16, 18 ]
Countdown 5..0: [ 5, 4, 3, 2, 1 ]`
  },
  {
    id: "js-ex-32",
    title: "Paginated API Streamer with Async Generators and Backpressure",
    category: "Iterators & Generators",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs an asynchronous generator stream that fetches pages of REST API records on demand, yielding individual items to the consumer with automatic backpressure.",
    conceptsCovered: ["Async Generators", "for await...of", "Pagination", "Backpressure"],
    code: `async function* streamPaginatedApi(endpoint, pageSize = 2) {
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    console.log(\`[Fetcher] Fetching page \${page} from \${endpoint}...\`);
    // Simulated remote API response
    await new Promise(r => setTimeout(r, 20));
    const items = [
      \`Item \${(page - 1) * pageSize + 1}\`,
      \`Item \${(page - 1) * pageSize + 2}\`
    ];

    if (page >= 3) hasMore = false; // Stop after 3 pages for demo

    for (const item of items) {
      yield item; // Yield items one-by-one!
    }

    page++;
  }
}

// Consumer handles items asynchronously with built-in backpressure:
(async () => {
  for await (const record of streamPaginatedApi("/api/users")) {
    console.log("[Consumer] Received:", record);
  }
})();`,
    breakdown: [
      { lineRange: "1-6", note: "Initializes async generator tracking current page and hasMore flag." },
      { lineRange: "7-18", note: "Fetches page and yields each item individually to consumer." },
      { lineRange: "25-29", note: "Consumer uses for await...of; next page is fetched only when consumer demands it." }
    ],
    expectedOutput: `[Fetcher] Fetching page 1 from /api/users...
[Consumer] Received: Item 1
[Consumer] Received: Item 2
[Fetcher] Fetching page 2 from /api/users...
[Consumer] Received: Item 3
[Consumer] Received: Item 4
[Fetcher] Fetching page 3 from /api/users...
[Consumer] Received: Item 5
[Consumer] Received: Item 6`
  },
  {
    id: "js-ex-33",
    title: "Tree Traversal Generator: Depth-First Search (DFS) and Breadth-First Search (BFS)",
    category: "Iterators & Generators",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements tree traversal algorithms using generators, allowing consumers to iterate through tree structures in DFS or BFS order via standard `for...of` loops.",
    conceptsCovered: ["Tree Traversal", "DFS", "BFS", "Generators", "yield*"],
    code: `class TreeNode {
  constructor(val, children = []) {
    this.val = val;
    this.children = children;
  }

  // Depth-First Search generator (Pre-order traversal using yield*)
  *dfs() {
    yield this.val;
    for (const child of this.children) {
      yield* child.dfs(); // Recursive delegation!
    }
  }

  // Breadth-First Search generator (Level-order traversal using queue)
  *bfs() {
    const queue = [this];
    while (queue.length > 0) {
      const current = queue.shift();
      yield current.val;
      for (const child of current.children) {
        queue.push(child);
      }
    }
  }
}

// Build sample tree:
//        Root
//       /    \\
//      A      B
//     / \\      \\
//    C   D      E
const tree = new TreeNode("Root", [
  new TreeNode("A", [new TreeNode("C"), new TreeNode("D")]),
  new TreeNode("B", [new TreeNode("E")])
]);

console.log("DFS Order:", [...tree.dfs()]);
console.log("BFS Order:", [...tree.bfs()]);`,
    breakdown: [
      { lineRange: "7-13", note: "dfs: yields current node value and delegates to children using yield*." },
      { lineRange: "15-25", note: "bfs: uses an iterative queue to yield nodes level-by-level." },
      { lineRange: "38-40", note: "Unpacks tree traversal values into flat arrays using the spread operator." }
    ],
    expectedOutput: `DFS Order: [ 'Root', 'A', 'C', 'D', 'B', 'E' ]
BFS Order: [ 'Root', 'A', 'B', 'C', 'D', 'E' ]`
  },
  {
    id: "js-ex-34",
    title: "Iterable Doubly-Linked List with Bidirectional Iterators",
    category: "Iterators & Generators",
    difficulty: "advanced",
    whatThisCodeCovers: "Constructs a Doubly-Linked List implementing the Iterable Protocol (`[Symbol.iterator]`) for forward iteration and a custom `.reverse()` generator for backward iteration.",
    conceptsCovered: ["Doubly Linked List", "Symbol.iterator", "Custom Iterables", "Data Structures"],
    code: `class ListNode {
  constructor(val) {
    this.val = val;
    this.next = null;
    this.prev = null;
  }
}

class DoublyLinkedList {
  constructor() {
    this.head = null;
    this.tail = null;
    this.length = 0;
  }

  push(val) {
    const node = new ListNode(val);
    if (!this.head) {
      this.head = this.tail = node;
    } else {
      this.tail.next = node;
      node.prev = this.tail;
      this.tail = node;
    }
    this.length++;
    return this;
  }

  // Forward iterator protocol:
  *[Symbol.iterator]() {
    let curr = this.head;
    while (curr) {
      yield curr.val;
      curr = curr.next;
    }
  }

  // Reverse iterator generator:
  *reverse() {
    let curr = this.tail;
    while (curr) {
      yield curr.val;
      curr = curr.prev;
    }
  }
}

// Test DoublyLinkedList
const list = new DoublyLinkedList();
list.push("Node 1").push("Node 2").push("Node 3");

console.log("Forward:", [...list]);
console.log("Reverse:", [...list.reverse()]);`,
    breakdown: [
      { lineRange: "26-33", note: "Implements [Symbol.iterator]() yielding values from head to tail." },
      { lineRange: "35-42", note: "Implements .reverse() yielding values from tail to head." },
      { lineRange: "47-50", note: "Demonstrates spreading forward and backward iterators cleanly." }
    ],
    expectedOutput: `Forward: [ 'Node 1', 'Node 2', 'Node 3' ]
Reverse: [ 'Node 3', 'Node 2', 'Node 1' ]`
  },
  {
    id: "js-ex-35",
    title: "Priority Queue with Binary Min-Heap",
    category: "Iterators & Generators",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements an $O(\\log N)$ Priority Queue using a Binary Min-Heap supporting enqueue, dequeue, peek, and array-based heap traversal.",
    conceptsCovered: ["Min-Heap", "Priority Queue", "Binary Trees", "O(log N) Algorithms"],
    code: `class MinHeapPriorityQueue {
  constructor() {
    this.heap = []; // Stores { priority, value }
  }

  enqueue(value, priority) {
    const node = { priority, value };
    this.heap.push(node);
    this._bubbleUp(this.heap.length - 1);
  }

  dequeue() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop().value;

    const top = this.heap[0].value;
    this.heap[0] = this.heap.pop();
    this._sinkDown(0);
    return top;
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);
      if (this.heap[index].priority >= this.heap[parentIdx].priority) break;
      [this.heap[index], this.heap[parentIdx]] = [this.heap[parentIdx], this.heap[index]];
      index = parentIdx;
    }
  }

  _sinkDown(index) {
    const len = this.heap.length;
    while (true) {
      let smallest = index;
      const left = 2 * index + 1;
      const right = 2 * index + 2;

      if (left < len && this.heap[left].priority < this.heap[smallest].priority) smallest = left;
      if (right < len && this.heap[right].priority < this.heap[smallest].priority) smallest = right;
      if (smallest === index) break;

      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

// Test MinHeap
const pq = new MinHeapPriorityQueue();
pq.enqueue("Low priority task", 50);
pq.enqueue("Critical security patch", 1);
pq.enqueue("Medium feature", 20);

console.log("Next task:", pq.dequeue()); // Priority 1
console.log("Next task:", pq.dequeue()); // Priority 20`,
    breakdown: [
      { lineRange: "6-10", note: "enqueue appends element and bubbles up to restore min-heap invariant." },
      { lineRange: "12-20", note: "dequeue extracts root element, replaces with last item, and sinks down." },
      { lineRange: "47-55", note: "Verifies items are dequeued in ascending priority order." }
    ],
    expectedOutput: `Next task: Critical security patch
Next task: Medium feature`
  },
  {
    id: "js-ex-36",
    title: "Trie (Prefix Tree) for Auto-Complete and Prefix Matching",
    category: "Iterators & Generators",
    difficulty: "advanced",
    whatThisCodeCovers: "Constructs a Trie (Prefix Tree) data structure supporting $O(L)$ word insertion, search, and prefix matching for autocomplete search engines.",
    conceptsCovered: ["Trie", "Prefix Trees", "Autocomplete", "String Algorithms"],
    code: `class TrieNode {
  constructor() {
    this.children = new Map();
    this.isEndOfWord = false;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word) {
    let curr = this.root;
    for (const char of word) {
      if (!curr.children.has(char)) {
        curr.children.set(char, new TrieNode());
      }
      curr = curr.children.get(char);
    }
    curr.isEndOfWord = true;
  }

  suggest(prefix) {
    let curr = this.root;
    for (const char of prefix) {
      if (!curr.children.has(char)) return []; // Prefix not found
      curr = curr.children.get(char);
    }

    const results = [];
    // DFS to collect all words starting from prefix
    function collect(node, path) {
      if (node.isEndOfWord) results.push(path);
      for (const [char, childNode] of node.children) {
        collect(childNode, path + char);
      }
    }
    collect(curr, prefix);
    return results;
  }
}

// Test Trie
const trie = new Trie();
["apple", "app", "application", "apt", "banana", "bat"].forEach(w => trie.insert(w));

console.log("Suggestions for 'app':", trie.suggest("app"));
console.log("Suggestions for 'ba':", trie.suggest("ba"));`,
    breakdown: [
      { lineRange: "1-12", note: "TrieNode stores children in a Map and tracks isEndOfWord." },
      { lineRange: "14-23", note: "insert traverses or creates child nodes per character in O(L) time." },
      { lineRange: "25-41", note: "suggest traverses to prefix node, then runs DFS to collect all matching words." }
    ],
    expectedOutput: `Suggestions for 'app': [ 'app', 'apple', 'application' ]
Suggestions for 'ba': [ 'banana', 'bat' ]`
  },
  {
    id: "js-ex-37",
    title: "Circular Ring Buffer in Pre-Allocated Array",
    category: "Iterators & Generators",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements a fixed-capacity Ring Buffer (Circular Buffer) that overwrites oldest entries when full with zero memory reallocation.",
    conceptsCovered: ["Ring Buffer", "Circular Queue", "Pre-Allocation", "O(1) Enqueue"],
    code: `class RingBuffer {
  constructor(capacity) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  push(item) {
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;

    if (this.size < this.capacity) {
      this.size++;
    } else {
      // Overwriting oldest element: advance head pointer
      this.head = (this.head + 1) % this.capacity;
    }
  }

  *[Symbol.iterator]() {
    for (let i = 0; i < this.size; i++) {
      const idx = (this.head + i) % this.capacity;
      yield this.buffer[idx];
    }
  }
}

// Test RingBuffer (Fixed capacity of 3)
const rb = new RingBuffer(3);
rb.push("Log A");
rb.push("Log B");
rb.push("Log C");
rb.push("Log D"); // Overwrites oldest "Log A"!

console.log("Buffer items:", [...rb]);`,
    breakdown: [
      { lineRange: "1-8", note: "Pre-allocates an array of fixed size and manages head/tail modulo pointers." },
      { lineRange: "10-20", note: "push advances tail with modulo; advances head if capacity is saturated." },
      { lineRange: "22-27", note: "Implements [Symbol.iterator]() to yield elements from oldest to newest." }
    ],
    expectedOutput: `Buffer items: [ 'Log B', 'Log C', 'Log D' ]`
  },
  {
    id: "js-ex-38",
    title: "Custom Set with Mathematical Union, Intersection, and Difference",
    category: "Iterators & Generators",
    difficulty: "beginner",
    whatThisCodeCovers: "Extends JavaScript's native Set to implement mathematical set operations: Union, Intersection, Difference, and Symmetric Difference.",
    conceptsCovered: ["Set Theory", "Union", "Intersection", "Difference", "Symmetric Difference"],
    code: `class MathSet extends Set {
  union(otherSet) {
    return new MathSet([...this, ...otherSet]);
  }

  intersection(otherSet) {
    return new MathSet([...this].filter(x => otherSet.has(x)));
  }

  difference(otherSet) {
    return new MathSet([...this].filter(x => !otherSet.has(x)));
  }

  symmetricDifference(otherSet) {
    const diff1 = this.difference(otherSet);
    const diff2 = otherSet.difference(this);
    return diff1.union(diff2);
  }
}

const a = new MathSet([1, 2, 3, 4]);
const b = new MathSet([3, 4, 5, 6]);

console.log("Union:", [...a.union(b)]); // [1, 2, 3, 4, 5, 6]
console.log("Intersection:", [...a.intersection(b)]); // [3, 4]
console.log("Difference (a - b):", [...a.difference(b)]); // [1, 2]
console.log("Symmetric Diff:", [...a.symmetricDifference(b)]); // [1, 2, 5, 6]`,
    breakdown: [
      { lineRange: "2-4", note: "union merges elements using spread syntax." },
      { lineRange: "6-8", note: "intersection filters elements present in both sets." },
      { lineRange: "10-12", note: "difference filters elements present in first but not second set." }
    ],
    expectedOutput: `Union: [ 1, 2, 3, 4, 5, 6 ]
Intersection: [ 3, 4 ]
Difference (a - b): [ 1, 2 ]
Symmetric Diff: [ 1, 2, 5, 6 ]`
  },
  {
    id: "js-ex-39",
    title: "Graph Traversal with Cycle Detection",
    category: "Iterators & Generators",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a directed graph using Adjacency Lists and implements cycle detection using three-state Depth-First Search (White/Gray/Black node coloring).",
    conceptsCovered: ["Graph Algorithms", "Cycle Detection", "DFS Coloring", "Adjacency List"],
    code: `class DirectedGraph {
  constructor() {
    this.adjacencyList = new Map();
  }

  addNode(node) {
    if (!this.adjacencyList.has(node)) this.adjacencyList.set(node, []);
  }

  addEdge(from, to) {
    this.addNode(from);
    this.addNode(to);
    this.adjacencyList.get(from).push(to);
  }

  hasCycle() {
    // 0: Unvisited (White), 1: Visiting in current path (Gray), 2: Finished (Black)
    const visited = new Map();

    const hasCycleDFS = (node) => {
      visited.set(node, 1); // Mark as visiting (Gray)

      for (const neighbor of (this.adjacencyList.get(node) || [])) {
        const state = visited.get(neighbor) || 0;
        if (state === 1) return true; // Cycle detected: back-edge to an active ancestor!
        if (state === 0 && hasCycleDFS(neighbor)) return true;
      }

      visited.set(node, 2); // Mark as finished (Black)
      return false;
    };

    for (const node of this.adjacencyList.keys()) {
      if ((visited.get(node) || 0) === 0) {
        if (hasCycleDFS(node)) return true;
      }
    }
    return false;
  }
}

// Test Cycle Detection
const graph = new DirectedGraph();
graph.addEdge("A", "B");
graph.addEdge("B", "C");
graph.addEdge("C", "A"); // Creates cycle: A -> B -> C -> A

console.log("Graph has cycle:", graph.hasCycle()); // true`,
    breakdown: [
      { lineRange: "1-13", note: "DirectGraph builds adjacency lists with addNode and addEdge." },
      { lineRange: "16-37", note: "hasCycle uses 3-state coloring; encountering a Gray node (1) indicates a cycle." }
    ],
    expectedOutput: `Graph has cycle: true`
  },
  {
    id: "js-ex-40",
    title: "Infinite Sequential ID & UUID Generator",
    category: "Iterators & Generators",
    difficulty: "beginner",
    whatThisCodeCovers: "Generates monotonic incremental IDs and cryptographically secure UUID v4 tokens using generators and `crypto.randomUUID()`.",
    conceptsCovered: ["Generators", "UUID v4", "Crypto API", "ID Generation"],
    code: `// 1. Monotonic Unique ID generator (O(1) memory)
function* createIdGenerator(prefix = "id") {
  let counter = 1;
  while (true) {
    yield \`\${prefix}_\${counter++}\`;
  }
}

const userIdGen = createIdGenerator("usr");
console.log(userIdGen.next().value); // "usr_1"
console.log(userIdGen.next().value); // "usr_2"

// 2. UUID v4 Token generator using native crypto
function* createUuidGenerator() {
  while (true) {
    // Native Web Crypto API
    yield crypto.randomUUID();
  }
}

const uuidGen = createUuidGenerator();
console.log("Generated UUID:", typeof uuidGen.next().value); // string (UUID v4)`,
    breakdown: [
      { lineRange: "2-7", note: "createIdGenerator runs an infinite loop yielding formatted sequential IDs." },
      { lineRange: "14-19", note: "createUuidGenerator leverages native crypto.randomUUID() for secure tokens." }
    ],
    expectedOutput: `usr_1
usr_2
Generated UUID: string`
  }
];
