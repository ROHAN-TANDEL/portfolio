const fs = require("fs");
const path = require("path");

const deepChapters = [
  {
    id: "ts-deep-01",
    title: "The TypeScript Compiler Pipeline: Scanner, Parser, Binder, Type Checker & Emitter",
    category: "Compiler Architecture",
    readTimeMinutes: 17,
    overview: "The TypeScript compiler (`tsc`) is a multi-phase compilation pipeline written entirely in TypeScript. Unlike single-pass interpreters, TypeScript separates lexical scanning, AST parsing, symbol binding, type checking, and code emission into distinct phases. Understanding this pipeline explains why type checking is lazy and why type errors do not prevent JavaScript emission.",
    diagram: `+-------------------------------------------------------------------------+
|                  TYPESCRIPT COMPILER (tsc) PIPELINE                     |
+-------------------------------------------------------------------------+
|                                                                         |
|  Source Code (.ts)                                                      |
|       |                                                                 |
|       v                                                                 |
|  [ 1. Scanner ]                                                         |
|  - Converts source text into a stream of Lexical Tokens                 |
|       |                                                                 |
|       v                                                                 |
|  [ 2. Parser ]                                                          |
|  - Transforms tokens into an Abstract Syntax Tree (AST / SourceFile)     |
|       |                                                                 |
|       v                                                                 |
|  [ 3. Binder ]                                                          |
|  - Creates Symbols & Symbol Tables (links declarations across AST nodes)|
|  - Establishes lexical scopes and container structures                  |
|       |                                                                 |
|       v                                                                 |
|  [ 4. Type Checker ] (Heavyweight Core Phase)                           |
|  - Assigns Types to AST Nodes and verifies type assignments             |
|  - Resolves Generics, performs Inference, enforces Soundness rules      |
|  - Emits Diagnostic Error Messages (TS2322, TS2345, etc.)              |
|       |                                                                 |
|       v                                                                 |
|  [ 5. Emitter ]                                                         |
|  - Strips types, transforms modern syntax down to target (ES5/ESNext)   |
|  - Outputs JavaScript (.js), Source Maps (.map), and Declarations (.d.ts)|
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Scanner & Parser: Building the SourceFile AST",
        explanation: "The Scanner (`scanner.ts`) reads raw character strings and produces discrete tokens (`SyntaxKind.Identifier`, `SyntaxKind.StringLiteral`, `SyntaxKind.PlusToken`). The Parser (`parser.ts`) processes these tokens and constructs an Abstract Syntax Tree (AST) rooted at a `SourceFile` node. Every node in the AST possesses a `SyntaxKind`, start/end character positions, and references to parent and child nodes.",
        codeExample: `import ts from 'typescript';

const sourceCode = 'const count: number = 42;';
const sourceFile = ts.createSourceFile('demo.ts', sourceCode, ts.ScriptTarget.Latest, true);

// Inspect AST structure
function visit(node: ts.Node, depth = 0) {
  console.log(\`\${' '.repeat(depth * 2)}\${ts.SyntaxKind[node.kind]}\`);
  node.forEachChild(child => visit(child, depth + 1));
}
visit(sourceFile);
// Output:
// SourceFile
//   VariableStatement
//     VariableDeclarationList
//       VariableDeclaration
//         Identifier (count)
//         NumberKeyword
//         NumericLiteral (42)`
      },
      {
        subheading: "2. The Binder: Symbols and Scope Linking",
        explanation: "The Parser builds the syntax tree, but does not know that two AST nodes in different places refer to the same variable. The Binder (`binder.ts`) runs as a second pass over the AST. It generates `Symbol` objects for named entities (variables, functions, interfaces). Each `Symbol` tracks its declarations and scope parent. This allows declaration merging: multiple `interface User` nodes in the AST are bound to a single underlying `User` Symbol.",
        codeExample: `// Declaration Merging processed during the Binding phase:
interface User {
  id: string;
}
interface User {
  name: string;
}
// The Binder links BOTH AST declarations to one unified 'User' Symbol!
// Symbol: { name: 'User', flags: SymbolFlags.Interface, declarations: [AST_Node_1, AST_Node_2] }`
      },
      {
        subheading: "3. The Type Checker: Lazy Evaluation and Emission Independence",
        explanation: "The Type Checker (`checker.ts`) is the largest and most complex component of TypeScript (~50,000+ lines). It evaluates types lazily on demand. It checks variable assignments, instantiates generic types, and issues diagnostic errors. Crucially, the Emitter (`emitter.ts`) does not depend on the Type Checker: even if type checking fails with 50 errors, the Emitter will still output executable JavaScript by default (unless `noEmitOnError: true` is configured).",
        codeExample: `// Even with severe type mismatch, tsc STILL emits valid JS by default!
let value: number = "hello" as any; // Type error if without 'as any'

// In tsconfig.json:
// "noEmitOnError": true  <- Halts JS output if ANY type error occurs`
      }
    ],
    edgeCasesAndPitfalls: [
      "Assuming type errors prevent code from compiling to JS; by default, `tsc` emits JavaScript despite type errors unless `noEmitOnError: true` is set.",
      "Thinking types exist at runtime; the Emitter completely erases types, interfaces, and type annotations, leaving zero runtime overhead or type guards.",
      "Enabling transpile-only tools (Babel, esbuild, SWC) skips the Binder and Type Checker completely, meaning type errors are never reported during compilation."
    ],
    keyTakeaways: [
      "TypeScript's pipeline consists of Scanner -> Parser -> Binder -> Type Checker -> Emitter.",
      "The Binder connects separate AST nodes into unified Symbols, enabling declaration merging.",
      "Type checking is completely decoupled from emission; use `noEmitOnError: true` in CI pipelines."
    ]
  },

  {
    id: "ts-deep-02",
    title: "Subtyping, Structural Type Compatibility & Nominal Typing Emulation",
    category: "Type System Theory",
    readTimeMinutes: 16,
    overview: "TypeScript's type system is based on structural subtyping (often called duck typing), rather than nominal subtyping used in Java or C++. A type `A` is a subtype of type `B` if `A` has all the properties of `B`, regardless of its name or declaration. This chapter breaks down structural assignability, excess property checking traps, and nominal emulation using Branded Types.",
    diagram: `+-------------------------------------------------------------------------+
|                  STRUCTURAL COMPATIBILITY & EXCESS CHECKING             |
+-------------------------------------------------------------------------+
|                                                                         |
|  Target Interface: Point2D { x: number; y: number; }                    |
|                                                                         |
|  SCENARIO A: Indirect Assignment (Pure Structural Subtyping)            |
|  const p3d = { x: 10, y: 20, z: 30 };                                   |
|  const p2d: Point2D = p3d; // VALID! (p3d has x and y; z is ignored)   |
|                                                                         |
|  SCENARIO B: Fresh Object Literal Assignment (Excess Property Check)    |
|  const p2d: Point2D = { x: 10, y: 20, z: 30 };                          |
|  // ERROR: Object literal may only specify known properties!            |
|  // (TypeScript detects 'z' as an accidental typo on fresh literals!)   |
|                                                                         |
|  ---------------------------------------------------------------------  |
|                                                                         |
|  NOMINAL TYPING EMULATION (Branded Types):                              |
|  type UserId = string & { readonly __brand: unique symbol };            |
|  type OrderId = string & { readonly __brand: unique symbol };           |
|                                                                         |
|  const uId = 'u_123' as UserId;                                         |
|  const oId = 'ord_456' as OrderId;                                      |
|  uId = oId; // COMPILE ERROR! Distinct brands prevent ID mixing!       |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Principle of Structural Subtyping (Width & Depth)",
        explanation: "In structural typing, relationships are determined entirely by members. If type `T` has at least all properties required by type `U` with compatible types, `T` is a subtype of `U` (`T <: U`). Width subtyping allows `T` to have extra properties. Depth subtyping ensures nested member properties are also compatible subtypes.",
        codeExample: `interface Vector2D {
  x: number;
  y: number;
}

interface Vector3D {
  x: number;
  y: number;
  z: number;
}

let v2: Vector2D;
let v3: Vector3D = { x: 1, y: 2, z: 3 };

// Valid: Vector3D contains all required Vector2D properties (Width Subtyping)
v2 = v3;`
      },
      {
        subheading: "2. The Excess Property Check Exception",
        explanation: "If TypeScript strictly adhered to structural typing, passing `{ x: 1, y: 2, typoProp: 3 }` directly to a function expecting `Vector2D` would be permitted. However, in practice, extra properties in fresh object literals almost always represent bugs or misspelled properties. TypeScript introduces an intentional exception: Excess Property Checking applies exclusively to fresh object literals.",
        codeExample: `function renderPoint(p: Vector2D) { /* ... */ }

// ERROR: 'color' does not exist in type 'Vector2D' (Fresh literal check)
// renderPoint({ x: 1, y: 2, color: 'red' });

// WORKAROUND A: Assign to intermediate variable (removes literal freshness)
const coloredPoint = { x: 1, y: 2, color: 'red' };
renderPoint(coloredPoint); // Allowed!

// WORKAROUND B: Add index signature to interface
interface VectorWithExtras extends Vector2D {
  [key: string]: any;
}`
      },
      {
        subheading: "3. Branded Types: Emulating Nominal Types for Domain Safety",
        explanation: "In systems dealing with IDs (e.g. `userId: string`, `orderId: string`, `accountId: string`), structural typing allows a developer to accidentally pass an `orderId` into a function requiring a `userId`. By intersecting a primitive with an uninstantiable brand property (`& { readonly __brand: unique symbol }`), we force TypeScript to treat structurally identical strings as distinct nominal entities.",
        codeExample: `declare const BrandSymbol: unique symbol;
type Brand<T, TBrand extends string> = T & { readonly [BrandSymbol]: TBrand };

type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;

function getUser(id: UserId) { /* ... */ }
function getOrder(id: OrderId) { /* ... */ }

const userId = 'usr_101' as UserId;
const orderId = 'ord_999' as OrderId;

getUser(userId); // OK
// getUser(orderId); // COMPILE ERROR: Type 'OrderId' is not assignable to 'UserId'!`
      }
    ],
    edgeCasesAndPitfalls: [
      "Empty interfaces or types (`type Empty = {}`) match ANY non-nullish value (including numbers, strings, and booleans), not just empty objects.",
      "Excess property checking is bypassed when passing object literals through type assertions (`{ x: 1, extra: 2 } as Point`).",
      "Branded types exist purely in the compiler; at runtime, `typeof userId === 'string'`."
    ],
    keyTakeaways: [
      "TypeScript uses structural subtyping: matching shapes rather than declared class/interface names.",
      "Excess property checks apply only to fresh object literals to catch typos.",
      "Use Branded Types to enforce nominal safety for IDs, currencies, and validated strings."
    ]
  },

  {
    id: "ts-deep-03",
    title: "Type Variance: Covariance, Contravariance, Invariance & Bivariant Methods",
    category: "Type System Theory",
    readTimeMinutes: 18,
    overview: "Variance describes how the subtyping relationship of complex types (generic containers, function signatures) relates to the subtyping relationship of their underlying components. Understanding covariance, contravariance, invariance, and bivariance is critical for typing callbacks, event handlers, and data structures.",
    diagram: `+-------------------------------------------------------------------------+
|                  THE FOUR FACES OF TYPE VARIANCE                        |
+-------------------------------------------------------------------------+
|                                                                         |
|  Given: Dog <: Animal (Dog is a subtype of Animal)                      |
|                                                                         |
|  1. COVARIANCE (Output Positions: Returns, Readonly Containers):        |
|     Subtype relationship is PRESERVED in the same direction.            |
|     Producer<Dog> <: Producer<Animal>                                   |
|     () => Dog is assignable to () => Animal                             |
|                                                                         |
|  2. CONTRAVARIANCE (Input Positions: Function Parameters):              |
|     Subtype relationship is REVERSED.                                   |
|     Consumer<Animal> <: Consumer<Dog>                                   |
|     (a: Animal) => void is assignable to (d: Dog) => void               |
|                                                                         |
|  3. INVARIANCE (Read/Write Containers, Mutable Arrays):                 |
|     Neither direction is assignable. Types must match EXACTLY.          |
|     Box<Dog> is NOT assignable to Box<Animal> (under strict checks)     |
|                                                                         |
|  4. BIVARIANCE (Legacy Method Shorthand Exception):                     |
|     Assignable in BOTH directions (intentional design compromise).      |
|     method(arg: Dog): void vs method(arg: Animal): void                 |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Covariance: Preserving Hierarchy on Return Types",
        explanation: "A generic type constructor `F<T>` is covariant if `A <: B` implies `F<A> <: F<B>`. Function return positions and read-only properties are naturally covariant. If a function promises to return an `Animal`, returning a `Dog` satisfies the contract because every `Dog` is an `Animal`.",
        codeExample: `class Animal { name = 'animal'; }
class Dog extends Animal { bark() {} }

type Factory<T> = () => T;

let makeAnimal: Factory<Animal>;
let makeDog: Factory<Dog> = () => new Dog();

// Covariant assignment: VALID
makeAnimal = makeDog; // A function returning Dog can be used where Animal is expected`
      },
      {
        subheading: "2. Contravariance: Reversing Hierarchy on Function Parameters",
        explanation: "Function parameters under `strictFunctionTypes: true` are contravariant. If `Dog <: Animal`, then `(x: Animal) => void` is a subtype of `(x: Dog) => void`. Why? A function that can process ANY `Animal` can safely handle a `Dog`. But a function that expects a `Dog` (and calls `dog.bark()`) CANNOT be safely passed an arbitrary `Animal` (like a `Cat`).",
        codeExample: `type Handler<T> = (event: T) => void;

let handleDog: Handler<Dog>;
let handleAnimal: Handler<Animal> = (a: Animal) => console.log(a.name);

// Contravariant assignment: VALID
handleDog = handleAnimal; // An animal handler can safely handle dogs!

// INVALID under strictFunctionTypes:
let handleSpecificDog: Handler<Dog> = (d: Dog) => d.bark();
// handleAnimal = handleSpecificDog; // ERROR! What if an Animal is passed? Animal has no bark()!`
      },
      {
        subheading: "3. Method Bivariance vs Function Property Contravariance",
        explanation: "TypeScript made an intentional design compromise for JavaScript ergonomics: method declarations `method(x: T): void` are BIVARIANT (assignable in both directions), whereas function properties `property: (x: T) => void` are CONTRAVARIANT under `strictFunctionTypes`. Bivariant methods exist so array methods like `Array<Dog>` remain assignable to `Array<Animal>` despite mutability.",
        codeExample: `interface Consumer<T> {
  // Method syntax: BIVARIANT (Permissive, potentially unsound!)
  method(arg: T): void;

  // Property syntax: CONTRAVARIANT (Strictly type-safe!)
  prop: (arg: T) => void;
}

let cDog!: Consumer<Dog>;
let cAnimal!: Consumer<Animal>;

// Method syntax allows bivariant assignment:
cAnimal.method = cDog.method; // Allowed without error!

// Property syntax strictly enforces contravariance:
// cAnimal.prop = cDog.prop; // ERROR! Type 'Dog' is not assignable to 'Animal'`
      }
    ],
    edgeCasesAndPitfalls: [
      "Assuming methods and function properties behave identically; methods are bivariant while function properties enforce strict contravariance under `strictFunctionTypes`.",
      "Mutable arrays in TypeScript are covariant (`Dog[]` assignable to `Animal[]`), which is technically unsound and permits pushing a `Cat` into a `Dog[]`.",
      "In TypeScript 4.7+, you can explicitly declare variance using variance annotations: `type Getter<out T> = () => T;` and `type Setter<in T> = (val: T) => void;`."
    ],
    keyTakeaways: [
      "Return types are Covariant (same direction); function arguments are Contravariant (reversed direction).",
      "Always use property syntax `fn: (x: T) => void` rather than method syntax `fn(x: T): void` for strictly checked callbacks.",
      "Use explicit variance annotations `in` and `out` on generic type parameters in high-scale libraries to optimize type-checking performance."
    ]
  },

  {
    id: "ts-deep-04",
    title: "Distributive Conditional Types & Naked Type Parameters",
    category: "Type Manipulation",
    readTimeMinutes: 16,
    overview: "Conditional types (`T extends U ? X : Y`) allow type-level branching. However, when the checked type `T` is a 'naked' type parameter and is instantiated with a Union, the conditional type automatically distributes across each member of the union. Mastering distributive behavior is essential for building filtering, extracting, and union-manipulating utility types.",
    diagram: `+-------------------------------------------------------------------------+
|                  DISTRIBUTIVE CONDITIONAL EVALUATION                    |
+-------------------------------------------------------------------------+
|                                                                         |
|  Definition: type ToArray<T> = T extends any ? T[] : never;             |
|                                                                         |
|  Given Union: string | number                                           |
|                                                                         |
|  DISTRIBUTIVE EXPANSION (Naked Type Parameter T):                       |
|  ToArray<string | number>                                               |
|       |                                                                 |
|       v Distributes across each union branch independently!             |
|  (string extends any ? string[] : never)                                |
|  | (number extends any ? number[] : never)                              |
|       |                                                                 |
|       v                                                                 |
|  Result: string[] | number[]  (Array of strings OR array of numbers)    |
|                                                                         |
|  ---------------------------------------------------------------------  |
|                                                                         |
|  NON-DISTRIBUTIVE WRAPPING ([T] extends [any]):                         |
|  type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;              |
|                                                                         |
|  Result: (string | number)[]  (Mixed array of strings and numbers!)     |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Mechanics of Union Distribution",
        explanation: "Distribution occurs when: 1. The conditional type has the form `T extends U ? X : Y`. 2. `T` is a bare (naked) generic type parameter. 3. A union type `A | B | C` is passed for `T`. The compiler evaluates `(A extends U ? X : Y) | (B extends U ? X : Y) | (C extends U ? X : Y)`. Standard utility types like `Exclude<T, U>` and `Extract<T, U>` rely entirely on this distributive property.",
        codeExample: `// Implementation of built-in Exclude<T, U>
type MyExclude<T, U> = T extends U ? never : T;

type Colors = 'red' | 'green' | 'blue';
type NonRed = MyExclude<Colors, 'red'>;

// Step-by-step distribution:
// ('red' extends 'red' ? never : 'red')     -> never
// ('green' extends 'red' ? never : 'green') -> 'green'
// ('blue' extends 'red' ? never : 'blue')   -> 'blue'
// Result: never | 'green' | 'blue' === 'green' | 'blue'`
      },
      {
        subheading: "2. Disabling Distribution with Tuples ([T])",
        explanation: "When you want to evaluate a union type as a whole (for example, checking if a type is exactly `boolean` rather than evaluating `true` and `false` separately), distribution must be prevented. Wrapping both sides of the `extends` clause in a single-element tuple (`[T] extends [U]`) turns off distribution.",
        codeExample: `// Distributive check:
type IsNeverDist<T> = T extends never ? true : false;
type TestDist = IsNeverDist<never>; // Evaluates to 'never'! (Empty union distributes 0 times!)

// Non-distributive check:
type IsNeverFixed<T> = [T] extends [never] ? true : false;
type TestFixed = IsNeverFixed<never>; // Evaluates to 'true'! Correctly detects never!`
      },
      {
        subheading: "3. Distributive Filtering: NonNullable and Custom Filter Types",
        explanation: "Distribution filters out `never` members automatically because `never` acts as the identity element of a union (`T | never === T`). This allows defining powerful type-level filters that pluck matching object shapes or property types from a union.",
        codeExample: `type Action = 
  | { type: 'LOGIN'; payload: { username: string } }
  | { type: 'LOGOUT' }
  | { type: 'NAVIGATE'; url: string };

// Distributive filter extracting only actions that have a payload
type ActionWithPayload<A> = A extends { payload: any } ? A : never;

type PayloadActions = ActionWithPayload<Action>;
// Result: { type: 'LOGIN'; payload: { username: string } }`
      }
    ],
    edgeCasesAndPitfalls: [
      "Evaluating `never extends never ? true : false` when `never` is passed to a generic conditional type returns `never`, not `true`, because `never` is an empty union that distributes zero times.",
      "The `boolean` type in TypeScript is actually a union `true | false`, so distributive conditional types split `boolean` into two branches.",
      "Complex nested distributive types with 10+ union members generate exponential branch evaluation, causing slow compiler performance and `TS2589: Type instantiation is excessively deep`."
    ],
    keyTakeaways: [
      "Naked generic type parameters distribute across unions in conditional types.",
      "Wrap types in tuple brackets `[T] extends [U]` to disable distribution.",
      "Distributive conditional types discard `never` branches automatically, enabling clean type-level filtering."
    ]
  },

  {
    id: "ts-deep-05",
    title: "Pattern Matching with infer, Recursive Types & Tail-Call Optimization",
    category: "Type Manipulation",
    readTimeMinutes: 17,
    overview: "The `infer` keyword inside conditional types introduces pattern matching into TypeScript's type system. Combined with recursive conditional types, `infer` enables building AST parsers, tuple reverse/flatten algorithms, and JSON serializers directly inside the compiler's type evaluation engine.",
    diagram: `+-------------------------------------------------------------------------+
|                  PATTERN MATCHING WITH INFER IN TUPLES                  |
+-------------------------------------------------------------------------+
|                                                                         |
|  Pattern: type Pop<T> = T extends [...infer Rest, infer Last]           |
|                          ? Rest                                         |
|                          : [];                                          |
|                                                                         |
|  Input Tuple: [10, 20, 30]                                              |
|                                                                         |
|  Matching Process:                                                      |
|  - Rest matches initial segment: [10, 20]                               |
|  - Last matches final element: 30                                       |
|                                                                         |
|  Evaluates to: [10, 20]                                                 |
|                                                                         |
|  ---------------------------------------------------------------------  |
|                                                                         |
|  TAIL-RECURSIVE ACCUMULATOR PATTERN (Prevents TS2589 Recursion Depth):  |
|  type Reverse<T, Acc extends any[] = []> =                              |
|    T extends [infer Head, ...infer Tail]                                |
|      ? Reverse<Tail, [Head, ...Acc]>  // Tail call: Acc passes state!   |
|      : Acc;                                                             |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The infer Keyword and Structural Decomposition",
        explanation: "`infer R` declares a new type variable within the `extends` clause of a conditional type. Rather than testing whether a type matches a known type, TypeScript deduces what `R` must be to satisfy the condition. Common standard library types like `ReturnType<T>`, `Parameters<T>`, and `Awaited<T>` are built using `infer`.",
        codeExample: `// Unwrapping Promises with recursive infer (Simplified Awaited)
type DeepAwaited<T> = T extends Promise<infer Inner> 
  ? DeepAwaited<Inner> 
  : T;

type NestedPromise = Promise<Promise<Promise<number>>>;
type Resolved = DeepAwaited<NestedPromise>; // Evaluates to: number`
      },
      {
        subheading: "2. Tuple Decomposition with Variadic Tuples",
        explanation: "Since TypeScript 4.0, `infer` can match rest elements inside tuples: `[infer Head, ...infer Tail]`. This allows writing list processing functions (map, filter, fold, head, tail) purely in the type system.",
        codeExample: `type Head<T extends any[]> = T extends [infer First, ...any[]] ? First : never;
type Tail<T extends any[]> = T extends [any, ...infer Rest] ? Rest : [];

type Numbers = [1, 2, 3, 4];
type FirstNum = Head<Numbers>; // 1
type RestNums = Tail<Numbers>; // [2, 3, 4]`
      },
      {
        subheading: "3. Tail-Call Recursion in the Type Checker",
        explanation: "Prior to TypeScript 4.5, recursive conditional types hit a hard stack limit of ~50 iterations (`TS2589: Type instantiation is excessively deep`). TypeScript 4.5 introduced tail-call elimination for conditional types: if the recursive call is directly in the return position with an accumulator, the limit is expanded to ~1,000 recursions.",
        codeExample: `// Tail-recursive Tuple Reverse with accumulator:
type Reverse<T extends any[], Acc extends any[] = []> = 
  T extends [infer Head, ...infer Tail]
    ? Reverse<Tail, [Head, ...Acc]> // Tail position recursion!
    : Acc;

type Reversed = Reverse<[1, 2, 3, 4, 5]>; // [5, 4, 3, 2, 1]`
      }
    ],
    edgeCasesAndPitfalls: [
      "Inferring from unions: if `infer R` appears in multiple candidate positions (e.g. function arguments), `R` is inferred as an intersection; if in return positions, `R` is inferred as a union.",
      "Unbounded recursion without a base termination condition triggers `TS2589: Type instantiation is excessively deep and possibly infinite`.",
      "TypeScript 4.7 added `extends` constraints to `infer`: `infer R extends string` restricts matching candidates."
    ],
    keyTakeaways: [
      "`infer` enables structural pattern matching inside conditional type expressions.",
      "Deconstruct tuples using `[infer Head, ...infer Tail]` for type-level algorithms.",
      "Use accumulator arguments in tail-call positions to avoid recursion depth limits."
    ]
  },

  {
    id: "ts-deep-06",
    title: "Template Literal Types, String Parsing & Type-Level State Machines",
    category: "Type Manipulation",
    readTimeMinutes: 17,
    overview: "TypeScript 4.1 introduced Template Literal Types, enabling string interpolation and pattern matching directly inside types. When combined with recursive `infer`, template literals transform TypeScript into a full string parser capable of validating SQL queries, parsing URL route parameters, and enforcing regex-like schemas at compile time.",
    diagram: `+-------------------------------------------------------------------------+
|                  TEMPLATE LITERAL STRING ROUTE PARSER                   |
+-------------------------------------------------------------------------+
|                                                                         |
|  Input Path String: "/users/:userId/posts/:postId"                      |
|                                                                         |
|  Recursive Pattern Match:                                               |
|  type ExtractParams<Path> =                                             |
|    Path extends \`\${string}/:\${infer Param}/\${infer Rest}\`             |
|      ? Param | ExtractParams<\`/\${Rest}\`>                               |
|      : Path extends \`\${string}/:\${infer Param}\`                        |
|        ? Param                                                          |
|        : never;                                                         |
|                                                                         |
|  Step 1: Matches \`:\${Param}/\` -> Param = 'userId', Rest = 'posts/:postId'|
|  Step 2: Matches \`:\${Param}\`  -> Param = 'postId'                     |
|                                                                         |
|  Extracted Union: 'userId' | 'postId'                                   |
|  Final Param Object: { [K in 'userId' | 'postId']: string }             |
|  => { userId: string; postId: string; }                                 |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. String Interpolation and Cross-Product Unions",
        explanation: "Template literal types mirror JavaScript template strings: `` `status_${'active' | 'inactive'}` ``. When unions are interpolated into template literals, TypeScript computes the Cartesian product of all union members, generating all possible combinations automatically.",
        codeExample: `type Vertical = 'top' | 'bottom';
type Horizontal = 'left' | 'right';

// Generates all 4 Cartesian combinations:
type Position = \`\${Vertical}-\${Horizontal}\`;
// 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'`
      },
      {
        subheading: "2. String Pattern Matching with infer",
        explanation: "By combining template literals with `infer`, the compiler acts as a string tokenizer. The pattern `` `${infer Head}/${infer Tail}` `` matches the first segment before a slash and captures the remainder in `Tail`.",
        codeExample: `// Route Parameter Extractor for type-safe Web Frameworks:
type ExtractRouteParams<T extends string> = 
  T extends \`\${string}/:\${infer Param}/\${infer Rest}\`
    ? { [K in Param | keyof ExtractRouteParams<\`/\${Rest}\`>]: string }
    : T extends \`\${string}/:\${infer Param}\`
      ? { [K in Param]: string }
      : {};

// Test Route Parser:
type UserPostParams = ExtractRouteParams<'/orgs/:orgId/users/:userId/posts/:postId'>;
// Inferred Type:
// { orgId: string; userId: string; postId: string; }`
      },
      {
        subheading: "3. String Case Transformation Utility Types",
        explanation: "TypeScript provides four built-in compiler intrinsics for string case transformations: `Uppercase<S>`, `Lowercase<S>`, `Capitalize<S>`, and `Uncapitalize<S>`. You can compose these to create automatic camelCase-to-snake_case converters.",
        codeExample: `type SnakeToCamel<S extends string> = 
  S extends \`\${infer Head}_\${infer Tail}\`
    ? \`\${Head}\${Capitalize<SnakeToCamel<Tail>>}\`
    : S;

type CamelCaseKey = SnakeToCamel<'user_billing_account_status'>;
// 'userBillingAccountStatus'`
      }
    ],
    edgeCasesAndPitfalls: [
      "Combinatorial explosions: interpolating 3 unions with 10 members each generates 1,000 literal type branches (`10 * 10 * 10`), degrading compiler speed.",
      "String literal patterns are greedy: matching `` `${infer A}_${infer B}` `` on `'a_b_c'` binds `A = 'a'` and `B = 'b_c'`.",
      "Template literal types cannot parse infinite or non-deterministic context-free grammars; recursion depth limits still apply."
    ],
    keyTakeaways: [
      "Template literals compute Cartesian products when combining multiple unions.",
      "Use `infer` with string delimiters to build type-safe URL routers and schema parsers.",
      "Leverage built-in intrinsics (`Capitalize`, `Uppercase`) for case conversion utilities."
    ]
  },

  {
    id: "ts-deep-07",
    title: "Soundness vs Completeness: Why TypeScript is Deliberately Unsound",
    category: "Type System Theory",
    readTimeMinutes: 16,
    overview: "In formal type theory, a type system is Sound if it guarantees that well-typed programs never enter an illegal runtime state (no runtime type errors). TypeScript is deliberately and explicitly Unsound. This chapter analyzes the deliberate compromises made by the TypeScript team to support real-world idiomatic JavaScript without cumbersome theoretical restrictions.",
    diagram: `+-------------------------------------------------------------------------+
|                  THE DELIBERATE UNSOUNDNESS IN TYPESCRIPT               |
+-------------------------------------------------------------------------+
|                                                                         |
|  WHERE TYPESCRIPT CHOOSES ERGONOMICS OVER MATHEMATICAL SOUNDNESS:       |
|                                                                         |
|  1. MUTABLE ARRAY COVARIANCE:                                           |
|     const dogs: Dog[] = [new Dog()];                                    |
|     const animals: Animal[] = dogs; // Allowed!                         |
|     animals.push(new Cat()); // OOPS! Pushed Cat into Dog[]!            |
|     dogs[1].bark(); // CRASH AT RUNTIME! (Cat has no bark method)       |
|                                                                         |
|  2. METHOD SHORTHAND BIVARIANCE:                                        |
|     methods permit assigning wider parameter types without strictness.  |
|                                                                         |
|  3. INDEX OUT-OF-BOUNDS ACCESS:                                         |
|     const arr: number[] = [1, 2];                                       |
|     const x: number = arr[999]; // Typed as 'number', but is undefined!|
|     x.toFixed(2); // RUNTIME TypeError: Cannot read properties of undef |
|     (Requires noUncheckedIndexedAccess to fix!)                         |
|                                                                         |
|  4. TYPE ASSERTIONS (as T):                                             |
|     Forces the compiler to trust the developer unconditionally.         |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Design Goals: 100% JavaScript Compatibility",
        explanation: "TypeScript Design Goal #3 explicitly states: 'Strive for a balance between correctness and productivity.' If TypeScript enforced pure mathematical soundness (like Haskell or Rust), common JavaScript patterns (mutating arrays, heterogeneous event emitters, dynamic property lookups) would require complex monads or existential quantification, alienating web developers.",
        codeExample: `// The classic Array Covariance Flaw:
class Animal { species = 'animal'; }
class Dog extends Animal { bark() { console.log('Woof'); } }
class Cat extends Animal { meow() { console.log('Meow'); } }

const dogs: Dog[] = [new Dog()];
// Sound type systems FORBID this: Dog[] is not Animal[] because arrays are mutable!
const animals: Animal[] = dogs; 

// Mutating via wider reference:
animals.push(new Cat());

// Runtime crash despite ZERO compile-time errors:
dogs[1].bark(); // TypeError: dogs[1].bark is not a function!`
      },
      {
        subheading: "2. The noUncheckedIndexedAccess Flag",
        explanation: "By default, accessing an array element `arr[i]` returns `T`. But if `i` is beyond the array's length, the runtime value is `undefined`. Under default settings, TypeScript treats `arr[999]` as definitely existing! Enabling `noUncheckedIndexedAccess: true` in `tsconfig.json` changes the return type to `T | undefined`, forcing safe null checks.",
        codeExample: `const list: string[] = ['alpha', 'beta'];

// Default TS: type is 'string' (UNSOUND!)
// With noUncheckedIndexedAccess: true -> type is 'string | undefined' (SOUND!)
const item = list[5];

// item.toUpperCase(); // Error under noUncheckedIndexedAccess!
if (item !== undefined) {
  item.toUpperCase(); // Safe!
}`
      },
      {
        subheading: "3. Type Assertions (as) and The any Escape Hatch",
        explanation: "Type assertions (`x as User`) and `any` tell the compiler: 'Trust me, I know more than you.' They bypass all type checking. When code relies heavily on `any` or loose `as` assertions, compile-time safety is completely dismantled. Production codebases should replace `any` with `unknown` and use User-Defined Type Guards (`x is User`) to safely verify runtime shapes.",
        codeExample: `// Unsound escape hatch:
const payload = JSON.parse('{"broken": true}') as { name: string };
// payload.name.toUpperCase(); // RUNTIME CRASH!

// Sound alternative: Type Guard
function isUser(data: unknown): data is { name: string } {
  return typeof data === 'object' && data !== null && 'name' in data && typeof (data as any).name === 'string';
}

const raw = JSON.parse('{"name": "Alice"}');
if (isUser(raw)) {
  console.log(raw.name.toUpperCase()); // Sound & Verified!
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Believing that compiling with zero TypeScript errors guarantees zero runtime `TypeError` exceptions.",
      "Leaving `noUncheckedIndexedAccess` disabled allows array out-of-bounds access to produce silent `undefined` bugs.",
      "`any` disables type checking on all expressions it touches, propagating virally across down-stream code."
    ],
    keyTakeaways: [
      "TypeScript is deliberately unsound to accommodate idiomatic JavaScript patterns and developer productivity.",
      "Enable `noUncheckedIndexedAccess` to guard against array out-of-bounds undefined crashes.",
      "Use `unknown` + Type Guards (`is`) instead of `any` or unchecked type assertions (`as`)."
    ]
  },

  {
    id: "ts-deep-08",
    title: "Ambient Declarations, Declaration Files (.d.ts) & Module Augmentation",
    category: "Declaration & Packaging",
    readTimeMinutes: 16,
    overview: "Declaration files (`.d.ts`) provide type annotations for existing JavaScript code without containing executable runtime code. Mastering ambient contexts (`declare`), library type definitions, and Module Augmentation allows developers to type global browser APIs, patch third-party npm packages, and extend frameworks like Express or Fastify with custom request properties.",
    diagram: `+-------------------------------------------------------------------------+
|                  MODULE AUGMENTATION & DECLARATION MERGING              |
+-------------------------------------------------------------------------+
|                                                                         |
|  Third-Party Package: 'express' (node_modules/@types/express)           |
|  interface Request {                                                    |
|    headers: IncomingHttpHeaders;                                        |
|    params: ParamsDictionary;                                            |
|  }                                                                      |
|                                                                         |
|  LOCAL APPLICATION AUGMENTATION (src/types/express.d.ts):               |
|  declare module 'express' {                                             |
|    interface Request {                                                  |
|      user?: AuthenticatedUser;                                          |
|      tenantId?: string;                                                 |
|    }                                                                    |
|  }                                                                      |
|                                                                         |
|  COMPILER SYMBOL MERGING:                                               |
|  Compiler Binder merges both interfaces into a single unified Symbol!   |
|  req.user is now recognized with full autocomplete across the app!      |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The declare Keyword and Ambient Contexts",
        explanation: "`declare` informs the compiler that a variable, function, class, or module exists in the runtime environment (e.g. loaded via a CDN `<script>` tag or Node global), so TypeScript should not emit JavaScript for it or complain that it is undeclared.",
        codeExample: `// globals.d.ts
declare const __APP_VERSION__: string;
declare function trackAnalytics(eventName: string, data: Record<string, any>): void;

// In application code:
console.log(__APP_VERSION__);
trackAnalytics('page_view', { path: '/home' });`
      },
      {
        subheading: "2. Module Augmentation in Enterprise Frameworks",
        explanation: "When using Express, Fastify, or Redux, custom middlewares attach contextual data to the request (`req.user`, `req.tenantId`). Without module augmentation, accessing `req.user` causes `Property 'user' does not exist on type 'Request'`. Module augmentation patches the external module's interface declaration.",
        codeExample: `// src/types/express-extension.d.ts
import { Request } from 'express';

interface AuthenticatedUser {
  id: string;
  role: 'admin' | 'user';
}

declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
    correlationId: string;
  }
}

// In your Express controller:
app.get('/api/me', (req, res) => {
  // TypeScript provides full autocomplete and type safety for req.user!
  const userId = req.user?.id;
  const trace = req.correlationId;
  res.json({ userId, trace });
});`
      },
      {
        subheading: "3. Generating .d.ts Files with declaration and declarationMap",
        explanation: "When publishing a TypeScript library to npm, configuring `\"declaration\": true` emits `.d.ts` type definitions alongside compiled `.js` files. Adding `\"declarationMap\": true` generates `.d.ts.map` source maps, allowing consumers using 'Go to Definition' in VS Code to jump directly into your original `.ts` source files rather than compiled declaration types.",
        codeExample: `// tsconfig.json for Library Authoring:
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "declaration": true,     // Generates .d.ts files
    "declarationMap": true,  // Generates .d.ts.map for IDE navigation
    "emitDeclarationOnly": false,
    "outDir": "./dist"
  }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Placing `import` or `export` at the top of a `.d.ts` file without `declare global` changes it from an ambient script into a module, breaking global declarations.",
      "Augmenting a module without importing it first creates a completely new module definition, overriding the original package entirely.",
      "Publishing compiled `.js` files to npm without `.d.ts` declarations forces consumers to write manual ambient typings."
    ],
    keyTakeaways: [
      "`declare` describes runtime entities that exist without emitting JavaScript code.",
      "Use Module Augmentation (`declare module 'pkg'`) to type custom request extensions safely.",
      "Always publish libraries with `\"declaration\": true` and `\"declarationMap\": true`."
    ]
  },

  {
    id: "ts-deep-09",
    title: "Type Checking Cost, Combinatorial Unions & --extendedDiagnostics Profiling",
    category: "Compiler Performance",
    readTimeMinutes: 16,
    overview: "In large monorepos with hundreds of thousands of lines of code, `tsc` compilation can slow to a crawl, taking minutes per build. The primary culprit is rarely code volume; it is type complexity. This chapter explains why large unions cause combinatorial type explosions and how to diagnose compiler bottlenecks using `--extendedDiagnostics` and `--generateTrace`.",
    diagram: `+-------------------------------------------------------------------------+
|                  COMBINATORIAL EXPLOSION IN TYPE CHECKING               |
+-------------------------------------------------------------------------+
|                                                                         |
|  POOR DESIGN: Unbounded Union Cartesian Product                         |
|  type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'; (4)       |
|  type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl'; (5)                      |
|  type State = 'idle' | 'hover' | 'active' | 'disabled'; (4)             |
|  type Theme = 'light' | 'dark' | 'auto'; (3)                            |
|                                                                         |
|  type ButtonProps = \`btn-\${Variant}-\${Size}-\${State}-\${Theme}\`;    |
|  Combinatorial Total: 4 * 5 * 4 * 3 = 240 string literal types!         |
|  (The compiler must track, compare, and cache 240 distinct types!)      |
|                                                                         |
|  DIAGNOSTIC PROFILING COMMANDS:                                         |
|  $ tsc --extendedDiagnostics                                            |
|    - Files: 1,420                                                       |
|    - Lines of Library code: 312,000                                     |
|    - Identifiers: 154,200                                               |
|    - Symbols: 280,000                                                   |
|    - Types: 1,420,000 (Warning! High type count indicates explosion!)   |
|    - Check time: 14.82s                                                 |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Anatomy of Type Instantiation Explosions",
        explanation: "Every time a generic type is evaluated with different type arguments, the Type Checker creates a new `Type` instance in compiler memory. Deeply nested mapped types, recursive conditionals, and intersecting multiple large object types force the compiler to perform $O(N \\times M)$ compatibility comparisons. If type count exceeds 500,000, build times spike dramatically.",
        codeExample: `// ANTI-PATTERN: Heavy deep mapped type running on large library objects
type DeepOmit<T, K> = T extends object
  ? { [P in keyof T as P extends K ? never : P]: DeepOmit<T[P], K> }
  : T;

// If applied to Prisma or React Component props, this instantiates
// tens of thousands of intermediate types, destroying tsc performance!`
      },
      {
        subheading: "2. Diagnosing Bottlenecks with --extendedDiagnostics",
        explanation: "Running `tsc --extendedDiagnostics` prints detailed timing breakdown across compiler phases. It reports Check time, Parse time, Bind time, Symbol count, and Type count. If 'Check time' dominates 85%+ of total runtime, complex types are the bottleneck.",
        codeExample: `// Terminal command:
// npx tsc --noEmit --extendedDiagnostics

// Output:
// Files:                         450
// Lines of Library code:      185200
// Lines of Definitions:        42100
// Lines of TypeScript:         84000
// Total time:                  4.82s
//   Parse time:                0.62s
//   Bind time:                 0.21s
//   Check time:                3.85s  <-- 80% spent checking types!
//   Emit time:                 0.14s`
      },
      {
        subheading: "3. Deep Profiling with --generateTrace and Perfetto",
        explanation: "TypeScript supports Chromium tracing via `tsc --generateTrace ./trace-output`. This emits JSON trace events capturing the exact files, lines, and types that consumed the most CPU time. Loading this trace into `ui.perfetto.dev` or `chrome://tracing` visually reveals the exact type definitions causing slow builds.",
        codeExample: `// Step 1: Generate trace files
// npx tsc --generateTrace ./trace-output

// Step 2: Analyze with @typescript/analyze-trace
// npx @typescript/analyze-trace ./trace-output

// Output pinpointing slow types:
// Hot spots found:
// - Check file /src/components/Table.tsx (1,450ms)
//   - Type instantiation of 'ComplexTableType' took 1,120ms`
      }
    ],
    edgeCasesAndPitfalls: [
      "Overusing deep recursive utility types (`DeepPartial`, `DeepDiff`) on third-party library types (e.g. Mongoose models or Express Request).",
      "Large union types (> 50 members) used with distributive conditional types cause exponential type generation.",
      "Neglecting to exclude `node_modules` or `dist` in `tsconfig.json` forces the parser to process thousands of unused files."
    ],
    keyTakeaways: [
      "Run `tsc --extendedDiagnostics` to identify whether compilation is I/O-bound or Type Checker-bound.",
      "Use `--generateTrace` and Perfetto to locate exact lines of code causing type explosions.",
      "Prefer flat interfaces and shallow utility types over deeply recursive mapped types in high-scale codebases."
    ]
  },

  {
    id: "ts-deep-10",
    title: "Abstract Syntax Trees (AST) & Programmatic Transformation with the Compiler API",
    category: "Compiler Metaprogramming",
    readTimeMinutes: 17,
    overview: "TypeScript is not just a command-line tool; it is a programmable platform. The TypeScript Compiler API allows developers to programmatically parse source code, inspect semantic type information, and write custom AST transformers (codemods, linters, code generators) using `ts.transform` or higher-level tools like `ts-morph`.",
    diagram: `+-------------------------------------------------------------------------+
|                  TYPESCRIPT AST TRANSFORMER PIPELINE                    |
+-------------------------------------------------------------------------+
|                                                                         |
|  Source TypeScript AST Node                                             |
|       |                                                                 |
|       v                                                                 |
|  [ Custom Transformer Factory (ts.TransformerFactory) ]                 |
|  - Visits AST nodes recursively (ts.visitEachChild)                     |
|  - Matches target nodes: e.g. CallExpression: console.log(...)          |
|       |                                                                 |
|       +---> MATCH FOUND:                                                |
|       |     - Replace node with ts.factory.createIdentifier('undefined')|
|       |     (or inject production tracking metadata)                    |
|       |                                                                 |
|       +---> NO MATCH:                                                   |
|             - Return node unmodified                                    |
|       |                                                                 |
|       v                                                                 |
|  Transformed AST Node                                                   |
|       |                                                                 |
|       v                                                                 |
|  Printer / Emitter (ts.createPrinter().printFile())                     |
|  => Clean transformed JavaScript or TypeScript output                   |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The AST Node Hierarchy and SyntaxKind",
        explanation: "Every AST node implements `ts.Node` with a specific `SyntaxKind` enum identifier. Navigating an AST involves matching `ts.isCallExpression(node)`, `ts.isIdentifier(node)`, or `ts.isPropertyAccessExpression(node)`. The `ts.factory` namespace provides immutable builder methods to construct new AST nodes safely.",
        codeExample: `import ts from 'typescript';

// Custom AST transformer that strips console.log calls from code
const stripConsoleTransformer: ts.TransformerFactory<ts.SourceFile> = (context) => {
  return (sourceFile) => {
    const visitor = (node: ts.Node): ts.Node => {
      // Check if node is console.log(...)
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) &&
        node.expression.expression.text === 'console'
      ) {
        // Replace with empty statement / void 0
        return context.factory.createVoidZero();
      }
      return ts.visitEachChild(node, visitor, context);
    };
    return ts.visitNode(sourceFile, visitor) as ts.SourceFile;
  };
};`
      },
      {
        subheading: "2. Programmatic Type Checking with ts.createProgram",
        explanation: "Static analysis tools need semantic type information (e.g. 'Is this variable an instance of Promise?'). `ts.createProgram` boots the full Type Checker, allowing querying of exact types via `checker.getTypeAtLocation(node)`.",
        codeExample: `const program = ts.createProgram(['./src/index.ts'], { target: ts.ScriptTarget.ES2022 });
const checker = program.getTypeChecker();
const sourceFile = program.getSourceFile('./src/index.ts')!;

ts.forEachChild(sourceFile, (node) => {
  if (ts.isVariableStatement(node)) {
    node.declarationList.declarations.forEach(decl => {
      const type = checker.getTypeAtLocation(decl);
      const typeString = checker.typeToString(type);
      console.log(\`Variable '\${decl.name.getText()}' has type: \${typeString}\`);
    });
  }
});`
      },
      {
        subheading: "3. Simplifying Codemods with ts-morph",
        explanation: "The raw TypeScript Compiler API is verbose and requires steep boilerplate. The open-source `ts-morph` library wraps the Compiler API in an object-oriented wrapper, enabling developers to add imports, rename classes, and modify properties with simple chainable methods.",
        codeExample: `import { Project } from 'ts-morph';

const project = new Project();
const sourceFile = project.addSourceFileAtPath('src/models/User.ts');

// Find a class and add a new typed property programmatically
const userClass = sourceFile.getClassOrThrow('User');
userClass.addProperty({
  name: 'isActive',
  type: 'boolean',
  initializer: 'true'
});

sourceFile.saveSync(); // Formats and writes back to disk!`
      }
    ],
    edgeCasesAndPitfalls: [
      "Constructing AST nodes manually without `ts.factory` produces invalid syntax trees that fail during emission.",
      "AST transformations do not update existing Symbol tables; if semantic checking is required after transformation, a new `ts.Program` must be created.",
      "Mutating AST nodes directly in memory breaks compiler invariants; always return a newly created factory node from the visitor."
    ],
    keyTakeaways: [
      "Use `ts.TransformerFactory` and `ts.visitEachChild` to write custom AST codemods.",
      "Access semantic type intelligence using `program.getTypeChecker().getTypeAtLocation(node)`.",
      "Use `ts-morph` for high-level automated refactoring and code generation scripts."
    ]
  },

  {
    id: "ts-deep-11",
    title: "Project References, Composite Builds & Incremental Compilation (tsbuildinfo)",
    category: "Monorepo & Build Architecture",
    readTimeMinutes: 16,
    overview: "In modern full-stack monorepos (Turborepo, Nx, Lerna), compiling 50 interdependent packages in a single monolithic `tsc` execution causes massive build times and memory exhaustion. Project References and composite builds allow splitting a codebase into independent, incrementally compilable packages with enforced dependency boundaries.",
    diagram: `+-------------------------------------------------------------------------+
|                  PROJECT REFERENCES & INCREMENTAL BUILDS                |
+-------------------------------------------------------------------------+
|                                                                         |
|  Root tsconfig.json (Solution Configuration):                           |
|  { "files": [], "references": [{ "path": "./core" }, { "path": "./api" }] }
|                                                                         |
|  [ Package: @app/core ]                                                 |
|  - composite: true, outDir: ./dist                                      |
|  - Emits: core.js, core.d.ts, AND tsconfig.tsbuildinfo                  |
|       ^                                                                 |
|       | [ Project Reference Dependency ]                                |
|       |                                                                 |
|  [ Package: @app/api ]                                                  |
|  - references: [{ "path": "../core" }]                                  |
|  - Type-checks against pre-compiled core.d.ts (NOT raw .ts sources!)   |
|                                                                         |
|  INCREMENTAL BUILD OPTIMIZATION:                                        |
|  $ tsc --build --verbose                                                |
|  - If @app/core source code has NOT changed:                            |
|    => Skipped! Reuses tsconfig.tsbuildinfo (0ms build time!)            |
|  - If @app/core changed:                                                |
|    => Recompiles @app/core, then incrementally rechecks @app/api.        |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The composite Flag and Its Mandatory Invariants",
        explanation: "Enabling `\"composite\": true` in `tsconfig.json` turns a project into a reusable build unit. Composite projects enforce strict architectural rules: 1. `declaration: true` must be enabled. 2. `rootDir` must be explicitly configured. 3. All source files must be covered by `include` or `files`. 4. It outputs a `.tsbuildinfo` cache file storing file hashes and dependency graphs.",
        codeExample: `// packages/core/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "composite": true,          // Mandatory for project references
    "declaration": true,        // Emits .d.ts files for referencing projects
    "declarationMap": true,     // Emits sourcemaps for definitions
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}`
      },
      {
        subheading: "2. The Build Mode: tsc --build (-b)",
        explanation: "Standard `tsc` only compiles the current project. The Build Mode (`tsc --build` or `tsc -b`) understands the directed acyclic graph (DAG) of project references. It automatically determines build order, compiles upstream dependencies first, and skips projects whose `.tsbuildinfo` hashes match disk state.",
        codeExample: `// Root tsconfig.json (Solution file)
{
  "files": [],
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/database" },
    { "path": "./packages/api" }
  ]
}

// Build command:
// npx tsc --build --verbose
// Output:
// Project 'packages/core' is up to date because newest input is older than output 'packages/core/tsconfig.tsbuildinfo'
// Building project 'packages/api'...`
      },
      {
        subheading: "3. CI/CD Acceleration with .tsbuildinfo Caching",
        explanation: "The `.tsbuildinfo` file records file hashes, compiler option hashes, and internal dependency graphs. By caching `dist/` and `*.tsbuildinfo` across CI runs (using GitHub Actions Cache or Turborepo remote caching), continuous integration pipelines achieve sub-second type-checking on PRs modifying only 1 package.",
        codeExample: `# GitHub Actions CI Cache snippet
- name: Restore TypeScript Build Cache
  uses: actions/cache@v4
  with:
    path: |
      **/dist
      **/*.tsbuildinfo
    key: \${{ runner.os }}-tsbuild-\${{ hashFiles('**/tsconfig*.json', 'pnpm-lock.yaml') }}
    restore-keys: |
      \${{ runner.os }}-tsbuild-`
      }
    ],
    edgeCasesAndPitfalls: [
      "Circular project references (Package A -> Package B -> Package A) are rejected by `tsc --build` with an error.",
      "Consuming unbuilt composite projects causes `Cannot find module` errors; upstream projects must emit `.d.ts` before downstream projects can check types.",
      "Deleting `.tsbuildinfo` files without cleaning `dist/` can cause stale type definition mismatches."
    ],
    keyTakeaways: [
      "Use `composite: true` and Project References to divide monolithic codebases into incremental build graphs.",
      "Run `tsc --build` to automatically resolve dependency compilation order.",
      "Persist `*.tsbuildinfo` files in CI/CD pipelines for instant incremental type checking."
    ]
  },

  {
    id: "ts-deep-12",
    title: "Type System Evolution: Key Innovations Across TypeScript 4.x, 5.x & 6.x",
    category: "Language Evolution",
    readTimeMinutes: 17,
    overview: "TypeScript evolves rapidly, transitioning from basic structural typing into a world-class type manipulation engine. This chapter examines the landmark features that shaped modern TypeScript: Variadic Tuples and Template Literals (TS 4.x), TC39 Stage 3 Decorators, const type parameters, and speed overhauls (TS 5.x), and previewed type system frontiers.",
    diagram: `+-------------------------------------------------------------------------+
|                  TYPESCRIPT LANGUAGE EVOLUTION TIMELINE                 |
+-------------------------------------------------------------------------+
|                                                                         |
|  TYPESCRIPT 4.x ERA:                                                    |
|  - TS 4.0: Variadic Tuple Types ([T, ...U]) & Labeled Tuple Elements    |
|  - TS 4.1: Template Literal Types (\`\${K}\`) & Key Remapping in Mapped Types|
|  - TS 4.2: Leading Rest Elements in Tuples                              |
|  - TS 4.5: Tail-Call Recursive Conditional Types                        |
|  - TS 4.7: Explicit Variance Annotations (type Foo<in T, out U>)        |
|  - TS 4.9: The 'satisfies' Operator                                     |
|                                                                         |
|  TYPESCRIPT 5.x ERA:                                                    |
|  - TS 5.0: Complete Architecture Rewrite from Namespaces to ESM Modules |
|  - TS 5.0: TC39 Stage 3 Decorators (Standardized, No Experimental Flag) |
|  - TS 5.0: 'const' Type Parameters (type-level automatic as const)      |
|  - TS 5.1: Unrelated Getters and Setters                                |
|  - TS 5.2: Using Declarations & Explicit Resource Management (Symbol.dispose)|
|  - TS 5.4: NoInfer<T> Utility Type                                      |
|  - TS 5.5: Inferred Type Predicates (Array.filter(Boolean) auto-narrows!)|
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The satisfies Operator (TS 4.9)",
        explanation: "Before TypeScript 4.9, assigning a variable with a type annotation (`const palette: Record<string, string | number> = { red: '#f00' }`) validated the shape, but widened property types to `string | number`, losing specific literal knowledge. The `satisfies` operator validates that an expression matches a type WITHOUT widening the expression's inferred type.",
        codeExample: `type RGB = [red: number, green: number, blue: number];
type Color = string | RGB;

// Using 'satisfies': Validates conformity, but preserves exact shape!
const theme = {
  primary: '#3498db',
  secondary: [230, 126, 34]
} satisfies Record<string, Color>;

// Full precision retained!
theme.primary.toLowerCase(); // OK! Compiler knows theme.primary is string!
theme.secondary.map(n => n * 2); // OK! Compiler knows theme.secondary is RGB tuple!`
      },
      {
        subheading: "2. const Type Parameters (TS 5.0)",
        explanation: "Prior to TypeScript 5.0, capturing literal types in generic functions required users to append `as const` at the call-site (`fn(['a', 'b'] as const)`). With `const` type parameters (`<const T>`), TypeScript automatically infers the most specific literal and `readonly` tuple types by default.",
        codeExample: `// Before TS 5.0:
// function setNames<T extends readonly string[]>(names: T): T
// setNames(['alice', 'bob']); // Inferred as string[]

// TS 5.0 const type parameter:
function setNames<const T extends readonly string[]>(names: T): T {
  return names;
}

const res = setNames(['alice', 'bob']);
// Inferred directly as readonly ['alice', 'bob'] without writing 'as const'!`
      },
      {
        subheading: "3. Inferred Type Predicates (TS 5.5)",
        explanation: "In TypeScript 5.4 and earlier, filtering an array with `arr.filter(x => x !== null)` left the resulting array typed as `(T | null)[]`, requiring awkward manual type predicates (`(x): x is T => ...`). In TypeScript 5.5, the compiler automatically infers type predicates from standard function bodies.",
        codeExample: `const mixed = ['apple', null, 'banana', undefined, 'cherry'];

// In TS 5.4: filtered was typed as (string | null | undefined)[]
// In TS 5.5: Compiler automatically infers type predicate (x is string)!
const filtered = mixed.filter(x => x !== null && x !== undefined);

// filtered is cleanly inferred as string[]!
filtered.forEach(fruit => console.log(fruit.toUpperCase()));`
      }
    ],
    edgeCasesAndPitfalls: [
      "Mixing legacy `experimentalDecorators: true` with TC39 Stage 3 standard decorators produces syntax and runtime incompatibilities.",
      "Assuming `satisfies` creates runtime assertions; like all TypeScript types, `satisfies` is completely erased during compilation.",
      "`NoInfer<T>` (TS 5.4) stops inference on specific candidate parameters, which is essential for builder patterns but can confuse developers unfamiliar with the utility."
    ],
    keyTakeaways: [
      "Use `satisfies` to validate types without widening literal types or losing property autocompletion.",
      "Use `<const T>` generic parameters to capture exact readonly tuples and literal objects automatically.",
      "TypeScript 5.5+ automatically infers type predicates in `.filter()`, eliminating manual `x is T` boilerplate."
    ]
  }
];

// Validate schema
const requiredFields = [
  "id",
  "title",
  "category",
  "readTimeMinutes",
  "overview",
  "diagram",
  "deepDive",
  "edgeCasesAndPitfalls",
  "keyTakeaways"
];

for (const chap of deepChapters) {
  for (const field of requiredFields) {
    if (chap[field] === undefined || chap[field] === null || chap[field] === "") {
      console.error(`Chapter ${chap.id} missing field: ${field}`);
    }
  }
}

const outputPath = path.join(__dirname, "../data/typescript.deep.json");
fs.writeFileSync(outputPath, JSON.stringify(deepChapters, null, 2), "utf-8");

console.log(`Successfully generated TypeScript Deeper Concepts Hub:`);
console.log(`- ${deepChapters.length} Chapters -> ${outputPath}`);
