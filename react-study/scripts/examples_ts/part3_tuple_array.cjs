module.exports = [
  {
    id: "ts-ex-21",
    title: "Tail-Call Optimized ReverseTuple<T>",
    category: "Tuples & Arrays",
    difficulty: "intermediate",
    whatThisCodeCovers: "Reverses a tuple array type at compile time using tail-recursive accumulator pattern to prevent compiler recursion depth limits (TS2589).",
    conceptsCovered: [
      "ReverseTuple",
      "Variadic Tuples",
      "Tail-Call Optimization",
      "Tuple Accumulator",
      "TS2589 Prevention"
    ],
    code: `// Tail-recursive reverse using accumulator
type ReverseTuple<T extends any[], Acc extends any[] = []> = 
  T extends [infer Head, ...infer Tail]
    ? ReverseTuple<Tail, [Head, ...Acc]>
    : Acc;

// Test Reverse:
type Original = [string, number, boolean, Date];
type Reversed = ReverseTuple<Original>;
// Inferred: [Date, boolean, number, string]

const data: Reversed = [new Date(), true, 42, 'hello']; // 100% Type-Safe!`,
    breakdown: [
      {
        lineRange: "2-5",
        note: "Head is prepended to Acc in tail position: [Head, ...Acc], guaranteeing O(N) recursion."
      },
      {
        lineRange: "8-9",
        note: "Reverses tuples of arbitrary types preserving exact element positions."
      }
    ],
    expectedOutput: "Reverses tuple types preserving exact element types and tuple length."
  },

  {
    id: "ts-ex-22",
    title: "Recursive FlattenTuple<T> (Multi-Dimensional Array Unwrapping)",
    category: "Tuples & Arrays",
    difficulty: "advanced",
    whatThisCodeCovers: "Flattens arbitrarily nested multi-dimensional tuples [1, [2, [3, 4]], 5] into a flat single-dimensional tuple [1, 2, 3, 4, 5].",
    conceptsCovered: [
      "FlattenTuple",
      "Multi-Dimensional Arrays",
      "Recursive Unwrapping",
      "Variadic Spread",
      "Tuple Normalization"
    ],
    code: `type FlattenTuple<T extends any[]> = 
  T extends [infer Head, ...infer Tail]
    ? Head extends any[]
      ? [...FlattenTuple<Head>, ...FlattenTuple<Tail>]
      : [Head, ...FlattenTuple<Tail>]
    : [];

// Test Flattening:
type Nested = [1, [2, 3], [[4, [5, 6]]], 7];
type Flat = FlattenTuple<Nested>;
// Inferred: [1, 2, 3, 4, 5, 6, 7]

const result: Flat = [1, 2, 3, 4, 5, 6, 7];`,
    breakdown: [
      {
        lineRange: "1-6",
        note: "Inspects Head: if it is an array, recursively flattens Head and Tail and spreads both."
      },
      {
        lineRange: "9-11",
        note: "Flattens arbitrary nested tuple structures into a single linear tuple."
      }
    ],
    expectedOutput: "Flattens nested multi-dimensional array types into flat tuple arrays."
  },

  {
    id: "ts-ex-23",
    title: "Tuple Zip<T, U> Combining Pairs into Tuple of Pairs",
    category: "Tuples & Arrays",
    difficulty: "intermediate",
    whatThisCodeCovers: "Combines two tuples of equal or unequal length into pairs [[T0, U0], [T1, U1]] matching Python's zip() function at the type level.",
    conceptsCovered: [
      "Tuple Zip",
      "Pair Tuple Construction",
      "Parallel Decomposition",
      "Shortest Length Termination",
      "Type-Level Algorithms"
    ],
    code: `type Zip<T extends any[], U extends any[]> = 
  T extends [infer THead, ...infer TTail]
    ? U extends [infer UHead, ...infer UTail]
      ? [[THead, UHead], ...Zip<TTail, UTail>]
      : []
    : [];

// Test Zip:
type Names = ['Alice', 'Bob', 'Charlie'];
type Ages = [28, 34, 42];

type Pairs = Zip<Names, Ages>;
// Inferred: [["Alice", 28], ["Bob", 34], ["Charlie", 42]]

const pairedUsers: Pairs = [
  ['Alice', 28],
  ['Bob', 34],
  ['Charlie', 42]
];`,
    breakdown: [
      {
        lineRange: "1-6",
        note: "Decomposes both T and U in parallel, assembling [THead, UHead] until either tuple is exhausted."
      },
      {
        lineRange: "9-12",
        note: "Demonstrates zip behavior pairing string names and number ages."
      }
    ],
    expectedOutput: "Combines two tuple arrays into ordered coordinate pairs at compile time."
  },

  {
    id: "ts-ex-24",
    title: "Tuple Slice<T, Start, End> with Index Arithmetic",
    category: "Tuples & Arrays",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements array slicing at compile time, extracting a subset of a tuple between Start index and End index using tuple length counters.",
    conceptsCovered: [
      "Tuple Slice",
      "Index Arithmetic",
      "Counter Tuples",
      "Type-Level Subsets",
      "Variadic Tuples"
    ],
    code: `// Helper to drop the first N elements from a tuple
type Drop<T extends any[], N extends number, Counter extends any[] = []> = 
  Counter['length'] extends N
    ? T
    : T extends [any, ...infer Rest]
      ? Drop<Rest, N, [...Counter, any]>
      : [];

// Helper to take the first N elements from a tuple
type Take<T extends any[], N extends number, Counter extends any[] = []> = 
  Counter['length'] extends N
    ? []
    : T extends [infer Head, ...infer Tail]
      ? [Head, ...Take<Tail, N, [...Counter, any]>]
      : [];

// Slice combines Drop and Take:
type Slice<T extends any[], Start extends number, End extends number> = 
  Take<Drop<T, Start>, End>; // Simplified positive index slice

type Items = ['a', 'b', 'c', 'd', 'e', 'f'];
type Sub = Slice<Items, 2, 2>; // Drops 2 ('a', 'b'), takes 2 -> ['c', 'd']`,
    breakdown: [
      {
        lineRange: "2-7",
        note: "Drop uses Counter['length'] to discard elements until Start index is reached."
      },
      {
        lineRange: "10-15",
        note: "Take accumulates elements until N items are collected."
      }
    ],
    expectedOutput: "Extracts contiguous sub-slices of tuple types at compile time."
  },

  {
    id: "ts-ex-25",
    title: "NonEmptyArray<T> Primitive Guard",
    category: "Tuples & Arrays",
    difficulty: "beginner",
    whatThisCodeCovers: "Constructs a NonEmptyArray<T> type [T, ...T[]] enforcing that an array parameter must contain at least one element, preventing empty array runtime bugs.",
    conceptsCovered: [
      "NonEmptyArray<T>",
      "Tuple Spread",
      "Empty Array Defense",
      "Math.max Guards",
      "API Constraints"
    ],
    code: `// Requires at least one element of type T
type NonEmptyArray<T> = [T, ...T[]];

// Math utility that is unsafe with empty arrays:
function calculateAverage(numbers: NonEmptyArray<number>): number {
  const sum = numbers.reduce((acc, curr) => acc + curr, 0);
  return sum / numbers.length; // NEVER divides by 0 because length is >= 1!
}

// Valid invocations:
calculateAverage([10]); // OK!
calculateAverage([10, 20, 30]); // OK!

// Compiler prevents empty array bug:
// calculateAverage([]); // COMPILE ERROR: Source has 0 element(s) but target requires 1!`,
    breakdown: [
      {
        lineRange: "2-2",
        note: "Defines [T, ...T[]] which forces the first element to exist and allows arbitrary remaining elements."
      },
      {
        lineRange: "5-8",
        note: "calculateAverage is mathematically protected against division by zero (0 / 0 === NaN)."
      }
    ],
    expectedOutput: "Rejects empty arrays [] at compile time, guaranteeing at least 1 element."
  },

  {
    id: "ts-ex-26",
    title: "TupleToUnion<T> and LastOfTuple<T>",
    category: "Tuples & Arrays",
    difficulty: "beginner",
    whatThisCodeCovers: "Demonstrates indexed access to convert tuples into unions (T[number]) and extracting the last element of a tuple.",
    conceptsCovered: [
      "TupleToUnion",
      "T[number]",
      "LastOfTuple",
      "Variadic Tuples",
      "Indexed Access"
    ],
    code: `type TupleToUnion<T extends readonly any[]> = T[number];

type LastOfTuple<T extends any[]> = T extends [...any[], infer Last] ? Last : never;

const roles = ['admin', 'manager', 'editor', 'viewer'] as const;

// Convert tuple to union of string literals:
type Role = TupleToUnion<typeof roles>;
// Inferred: 'admin' | 'manager' | 'editor' | 'viewer'

// Extract last element:
type Coordinates = [x: number, y: number, z: number];
type ZCoord = LastOfTuple<Coordinates>; // number`,
    breakdown: [
      {
        lineRange: "1-1",
        note: "T[number] indexes across all array indices, collapsing the tuple into a union of its elements."
      },
      {
        lineRange: "3-3",
        note: "T extends [...any[], infer Last] pattern-matches and extracts the final item."
      }
    ],
    expectedOutput: "Converts tuple values to unions and extracts terminal tuple elements."
  },

  {
    id: "ts-ex-27",
    title: "Type-Safe Array.includes Replacement (Includes<T, U>)",
    category: "Tuples & Arrays",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a compile-time Includes<Tuple, Target> type that checks if a type exists within a tuple, accounting for exact equality checks (not just assignability).",
    conceptsCovered: [
      "Includes<T, U>",
      "Exact Equal<X, Y>",
      "Recursive Tuple Inspection",
      "Array.includes Typing",
      "Soundness Guard"
    ],
    code: `// Exact type equality helper:
type IsEqual<X, Y> = 
  (<T>() => T extends X ? 1 : 2) extends (<T>() => T extends Y ? 1 : 2) ? true : false;

// Recursively checks if Target is present in Tuple
type Includes<Tuple extends readonly any[], Target> = 
  Tuple extends readonly [infer First, ...infer Rest]
    ? IsEqual<First, Target> extends true
      ? true
      : Includes<Rest, Target>
    : false;

// Test Includes:
type T1 = Includes<['apple', 'banana', 'cherry'], 'banana'>; // true
type T2 = Includes<['apple', 'banana', 'cherry'], 'orange'>; // false

// Distinguishes between 'boolean' and 'true':
type T3 = Includes<[boolean, string], true>; // false! (true is not exact equal to boolean)`,
    breakdown: [
      {
        lineRange: "2-3",
        note: "IsEqual relies on generic function conditional assignability to test for exact type equality."
      },
      {
        lineRange: "6-11",
        note: "Includes iterates tuple elements, returning true on exact match or recursing onto Rest."
      }
    ],
    expectedOutput: "Determines if a type is contained in a tuple with exact equality checking."
  },

  {
    id: "ts-ex-28",
    title: "Fixed-Length Array Generator (LengthArray<T, N>)",
    category: "Tuples & Arrays",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a type generator that constructs a tuple of a specific fixed length N containing elements of type T (e.g. LengthArray<string, 4> -> [string, string, string, string]).",
    conceptsCovered: [
      "LengthArray<T, N>",
      "Fixed-Length Tuples",
      "Accumulator Recursion",
      "Coordinate Arrays",
      "Type-Level Constructors"
    ],
    code: `// Recursively appends T until Acc['length'] reaches N
type LengthArray<T, N extends number, Acc extends T[] = []> = 
  Acc['length'] extends N
    ? Acc
    : LengthArray<T, N, [...Acc, T]>;

// Fixed coordinates:
type Point3D = LengthArray<number, 3>; // [number, number, number]
type HexBytes = LengthArray<number, 16>; // 16-element byte array

const point: Point3D = [10, 20, 30]; // Valid!
// const badPoint: Point3D = [10, 20]; // ERROR: Source has 2 elements but target requires 3!`,
    breakdown: [
      {
        lineRange: "2-5",
        note: "Recursively appends T to Acc until Acc['length'] matches target number N."
      },
      {
        lineRange: "8-9",
        note: "Generates strict dimensional tuples (3D points, 16-byte hashes) without manual repetition."
      }
    ],
    expectedOutput: "Generates tuples with exact compiler-enforced element counts."
  },

  {
    id: "ts-ex-29",
    title: "Permutations of Union (Permutation<T>)",
    category: "Tuples & Arrays",
    difficulty: "advanced",
    whatThisCodeCovers: "Computes all possible permutations of a union ('a' | 'b' | 'c') into a union of tuples (['a', 'b', 'c'] | ['a', 'c', 'b'] | ...).",
    conceptsCovered: [
      "Permutation",
      "Union Distribution",
      "Combinatorics",
      "[T] extends [never]",
      "CLI Command Ordering"
    ],
    code: `type Permutation<T, K = T> = 
  [T] extends [never]
    ? []
    : K extends K
      ? [K, ...Permutation<Exclude<T, K>>]
      : never;

// Test Permutations:
type Flags = 'a' | 'b' | 'c';
type FlagPermutations = Permutation<Flags>;
// Inferred Union of all 6 permutations:
// ['a', 'b', 'c'] | ['a', 'c', 'b'] |
// ['b', 'a', 'c'] | ['b', 'c', 'a'] |
// ['c', 'a', 'b'] | ['c', 'b', 'a']

const validSequence: FlagPermutations = ['b', 'c', 'a']; // Valid!`,
    breakdown: [
      {
        lineRange: "1-6",
        note: "K extends K distributes over the union, picking K as head and recursively permuting Exclude<T, K>."
      },
      {
        lineRange: "9-15",
        note: "Generates all factorial N! permutations of union elements."
      }
    ],
    expectedOutput: "Produces all combinatorial permutations of a union as ordered tuple sequences."
  },

  {
    id: "ts-ex-30",
    title: "Tuple Push<T, X>, Pop<T>, Shift<T>, and Unshift<T, X>",
    category: "Tuples & Arrays",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements array mutation equivalents (Push, Pop, Shift, Unshift) at compile time using variadic tuple destructuring.",
    conceptsCovered: [
      "Tuple Push / Pop",
      "Tuple Shift / Unshift",
      "Variadic Tuples",
      "Tuple Manipulation",
      "Immutable Updates"
    ],
    code: `// Push element X to end of tuple
type Push<T extends any[], X> = [...T, X];

// Unshift element X to beginning of tuple
type Unshift<T extends any[], X> = [X, ...T];

// Pop element from end of tuple
type Pop<T extends any[]> = T extends [...infer Rest, any] ? Rest : [];

// Shift element from beginning of tuple
type Shift<T extends any[]> = T extends [any, ...infer Rest] ? Rest : [];

type Initial = [1, 2, 3];

type AfterPush = Push<Initial, 4>; // [1, 2, 3, 4]
type AfterUnshift = Unshift<Initial, 0>; // [0, 1, 2, 3]
type AfterPop = Pop<Initial>; // [1, 2]
type AfterShift = Shift<Initial>; // [2, 3]`,
    breakdown: [
      {
        lineRange: "2-11",
        note: "Uses tuple spread [...T, X] and pattern matching [...infer Rest, any] to emulate array operations."
      },
      {
        lineRange: "15-18",
        note: "Provides functional immutable tuple transformations."
      }
    ],
    expectedOutput: "Executes push, pop, shift, and unshift mutations at the type level."
  }
];
