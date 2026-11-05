const fs = require('fs');
const path = require('path');

const qaList = [
  // ==========================================
  // SECTION: FREQUENTLY ASKED QUESTIONS (FAQ)
  // ==========================================
  {
    id: "ts-qa-001",
    section: "faq",
    difficulty: "Foundational",
    category: "Interfaces & Type Aliases",
    question: "What is the difference between `type` aliases and `interface` in TypeScript, and when should you choose one over the other?",
    quickAnswer: "Interfaces are extendable and support declaration merging, making them ideal for public APIs and object models. Type aliases can define unions, intersections, primitives, and tuples, but cannot be reopened.",
    detailedAnswer: "Both `type` and `interface` can describe the shape of an object or function signature. However:\n1. Declaration Merging: Multiple interface declarations with the same name merge automatically. Type aliases throw a duplicate identifier error.\n2. Union and Primitive Types: `type` can represent primitive types, unions (e.g., `string | number`), and tuples directly; `interface` cannot.\n3. Extensibility: Interfaces extend via `extends`; types use intersections (`&`).\nRule of thumb: Default to `interface` for public APIs, OOP architectures, and models that may need extension. Use `type` for unions, intersections, utility types, and tuples.",
    code: "// Declaration Merging (Interfaces only):\ninterface Window {\n  customAnalytics: boolean;\n}\ninterface Window {\n  userId?: string;\n}\n// Both properties exist on Window\n\n// Type Aliases (Cannot be reopened, but support unions):\ntype Status = 'pending' | 'active' | 'archived';\ntype ID = string | number;\ntype Coords = [x: number, y: number];",
    interviewTip: "Interviewers look for whether you mention 'Declaration Merging' and that interfaces are typically faster in earlier compiler versions for large object hierarchies due to caching.",
    tags: ["core", "screening", "faq", "interfaces", "types"]
  },
  {
    id: "ts-qa-002",
    section: "faq",
    difficulty: "Foundational",
    category: "Types & Primitives",
    question: "What is the difference between `any`, `unknown`, and `never`?",
    quickAnswer: "`any` disables all type checks; `unknown` is a type-safe counterpart that requires type narrowing before use; `never` represents values that can never occur or functions that never return.",
    detailedAnswer: "1. `any`: Top type and escape hatch. Assignable to anything and anything is assignable to it. Bypasses compile-time safety.\n2. `unknown`: Safe top type. Anything can be assigned to `unknown`, but you cannot perform operations on it or assign it to other typed variables without first narrowing the type (via `typeof`, `instanceof`, or custom type guards).\n3. `never`: Bottom type. Nothing can be assigned to `never` (except `never` itself). It represents unreachable states, functions that throw indefinitely or run infinite loops, and exhaustive switch checks.",
    code: "let a: any = 'hello';\na.foo(); // Compiles fine, crashes at runtime!\n\nlet u: unknown = 'hello';\n// u.toUpperCase(); // Error: Object is of type 'unknown'.\nif (typeof u === 'string') {\n  console.log(u.toUpperCase()); // Allowed after narrowing!\n}\n\nfunction fail(msg: string): never {\n  throw new Error(msg);\n}",
    interviewTip: "Never recommend `any` in production code. Always advocate for `unknown` when dealing with untrusted inputs (e.g., API payloads, JSON.parse, user input).",
    tags: ["core", "screening", "faq", "primitives", "type-safety"]
  },
  {
    id: "ts-qa-003",
    section: "faq",
    difficulty: "Intermediate",
    category: "Narrowing & Type Guards",
    question: "What is a Discriminated Union, and why is it considered a TypeScript best practice for state management?",
    quickAnswer: "A Discriminated Union combines types that share a common literal property (the discriminant), enabling TypeScript to safely narrow to the exact variant in conditional branches.",
    detailedAnswer: "A Discriminated Union (also called tagged union or algebraic data type) requires three things:\n1. Individual types that share a common literal member (the discriminator, often `type`, `kind`, or `status`).\n2. A union containing those types.\n3. A type narrowing check (like `switch` or `if`) on the discriminant.\nIt prevents invalid states (e.g. having `isLoading: true` and `data: [...]` simultaneously) and enables complete compile-time validation.",
    code: "type NetworkState =\n  | { status: 'idle' }\n  | { status: 'loading' }\n  | { status: 'success'; data: string[] }\n  | { status: 'error'; error: Error };\n\nfunction render(state: NetworkState) {\n  switch (state.status) {\n    case 'idle': return 'Click to load';\n    case 'loading': return 'Spinner...';\n    case 'success': return `Items: ${state.data.join(', ')}`; // TypeScript knows state.data exists\n    case 'error': return `Failed: ${state.error.message}`;   // TypeScript knows state.error exists\n  }\n}",
    interviewTip: "Pair your explanation with exhaustive checking using the `never` type in the default branch to catch unhandled variants at compile time.",
    tags: ["core", "screening", "faq", "unions", "pattern-matching"]
  },
  {
    id: "ts-qa-004",
    section: "faq",
    difficulty: "Foundational",
    category: "Types & Primitives",
    question: "What does the `as const` assertion do in TypeScript?",
    quickAnswer: "`as const` (const assertion) signals to the compiler to infer the narrowest possible literal types, make all object properties `readonly`, and treat arrays as fixed-length readonly tuples.",
    detailedAnswer: "Without `as const`, TypeScript widens literals: `'GET'` becomes `string`, and `[1, 2]` becomes `number[]`. With `as const`:\n1. Primitive literal types are preserved instead of widened to `string`, `number`, or `boolean`.\n2. Object literal properties become deeply `readonly`.\n3. Array literals become `readonly` tuples.",
    code: "// Widened by default:\nconst req1 = { method: 'GET', port: 3000 };\n// Type: { method: string; port: number }\n\n// Preserved with 'as const':\nconst req2 = { method: 'GET', port: 3000 } as const;\n// Type: { readonly method: 'GET'; readonly port: 3000 }\n\nconst routes = ['home', 'about', 'contact'] as const;\n// Type: readonly ['home', 'about', 'contact']",
    interviewTip: "Mention that `as const` is commonly used to create type-safe configuration dictionaries, Redux action creators, and route definitions without defining explicit enum types.",
    tags: ["core", "screening", "faq", "assertions", "immutability"]
  },
  {
    id: "ts-qa-005",
    section: "faq",
    difficulty: "Foundational",
    category: "Generics & Type Params",
    question: "What are Generics in TypeScript, and what problem do they solve?",
    quickAnswer: "Generics create reusable, type-safe components and functions by capturing types as parameters rather than hardcoding specific types or using `any`.",
    detailedAnswer: "Generics allow developers to write code that works across multiple types while retaining full static type safety. Without generics, you would either have to duplicate functions for each type or use `any`, which destroys return type inference. Generics support constraints using the `extends` keyword (e.g. `<T extends { id: string }>`.",
    code: "// Generic identity preserves exact type:\nfunction identity<T>(arg: T): T {\n  return arg;\n}\nconst num = identity(42);       // inferred as number\nconst str = identity('hello');  // inferred as string\n\n// Generic constraint:\nfunction getLength<T extends { length: number }>(item: T): number {\n  return item.length;\n}\ngetLength('text');    // OK\ngetLength([1, 2, 3]); // OK\n// getLength(10);     // Error: number doesn't have .length",
    interviewTip: "Point out that generics preserve relationships between arguments and return values, which `any` or loose unions cannot do.",
    tags: ["core", "screening", "faq", "generics", "reusability"]
  },
  {
    id: "ts-qa-006",
    section: "faq",
    difficulty: "Intermediate",
    category: "Narrowing & Type Guards",
    question: "What are User-Defined Type Guards, and how does the `is` operator work?",
    quickAnswer: "A user-defined type guard is a function whose return type is a type predicate `param is Type`. When the function returns `true`, TypeScript narrows the parameter's type in subsequent blocks.",
    detailedAnswer: "Built-in guards like `typeof` and `instanceof` cannot inspect custom interfaces at runtime because interface metadata is erased. User-defined type guards solve this by allowing you to write custom validation logic. The syntax `value is TargetType` informs the compiler that a truthy return value guarantees that `value` conforms to `TargetType`.",
    code: "interface Fish { swim: () => void }\ninterface Bird { fly: () => void }\n\n// User-defined type guard function:\nfunction isFish(pet: Fish | Bird): pet is Fish {\n  return (pet as Fish).swim !== undefined;\n}\n\nfunction move(pet: Fish | Bird) {\n  if (isFish(pet)) {\n    pet.swim(); // TS guarantees pet is Fish here\n  } else {\n    pet.fly();  // TS guarantees pet is Bird here\n  }\n}",
    interviewTip: "Highlight that the compiler trusts your type predicate completely. If your runtime check is incorrect, you create a silent type hole, so keep type guard checks robust.",
    tags: ["core", "screening", "faq", "type-guards", "narrowing"]
  },
  {
    id: "ts-qa-007",
    section: "faq",
    difficulty: "Intermediate",
    category: "Utility Types",
    question: "Explain the difference between `Pick<T, K>`, `Omit<T, K>`, `Exclude<T, U>`, and `Extract<T, U>`.",
    quickAnswer: "`Pick` and `Omit` operate on object properties/keys. `Exclude` and `Extract` operate on union members.",
    detailedAnswer: "1. `Pick<T, K>`: Constructs a type by picking specific keys `K` from object type `T`.\n2. `Omit<T, K>`: Constructs a type by picking all keys from `T` except those in `K`.\n3. `Exclude<T, U>`: Excludes from union `T` all union members that are assignable to `U`.\n4. `Extract<T, U>`: Extracts from union `T` only the union members that are assignable to `U`.\nA very common interview mistake is trying to use `Exclude` on an interface instead of `Omit`.",
    code: "interface User {\n  id: string;\n  name: string;\n  email: string;\n  isAdmin: boolean;\n}\n\n// Operating on Object Types:\ntype UserPreview = Pick<User, 'id' | 'name'>;\ntype UserInput = Omit<User, 'id'>;\n\n// Operating on Unions:\ntype Status = 'idle' | 'loading' | 'success' | 'error';\ntype ActiveStatus = Exclude<Status, 'idle'>;       // 'loading' | 'success' | 'error'\ntype FinalStatus = Extract<Status, 'success' | 'error'>; // 'success' | 'error'",
    interviewTip: "Remember the mnemonic: Pick and Omit target Objects; Exclude and Extract target Unions.",
    tags: ["core", "screening", "faq", "utility-types"]
  },
  {
    id: "ts-qa-008",
    section: "faq",
    difficulty: "Foundational",
    category: "Fundamentals & Internals",
    question: "What is Structural Typing (duck typing) in TypeScript, and how does it contrast with Nominal Typing?",
    quickAnswer: "TypeScript uses structural typing: type compatibility is determined solely by the shape and members of a type, not its explicit name or declaration hierarchy.",
    detailedAnswer: "In nominal type systems (like Java or C#), a class `Dog` is never assignable to a class `Cat`, even if both have identical members. In TypeScript's structural type system, if an object has all required properties of a target type with compatible types, TypeScript considers it assignable regardless of how it was created.\nThis aligns directly with JavaScript's dynamic, flexible duck-typing nature ('If it walks like a duck and quacks like a duck, it is a duck').",
    code: "interface Point2D {\n  x: number;\n  y: number;\n}\n\nclass Coordinate {\n  constructor(public x: number, public y: number) {}\n}\n\nconst p1: Point2D = new Coordinate(10, 20); // Valid!\nconst p2: Point2D = { x: 5, y: 15, z: 25 }; // Excess property checked if inline, but valid via variable",
    interviewTip: "Mention that nominal typing can be emulated in TypeScript using 'Branded Types' (adding a phantom brand tag like `_brand: 'UserId'`).",
    tags: ["core", "screening", "faq", "structural-typing", "theory"]
  },
  {
    id: "ts-qa-009",
    section: "faq",
    difficulty: "Intermediate",
    category: "Modern TypeScript",
    question: "What is the `satisfies` operator introduced in TS 4.9, and how is it superior to type assertions (`as`) or type annotations?",
    quickAnswer: "`satisfies` validates that an expression matches a type contract without widening the inferred type or losing specific literal and property knowledge.",
    detailedAnswer: "With type annotations (`const x: Theme = ...`), TypeScript widens properties to match the contract, losing literal types and auto-complete on specific sub-keys. With type assertions (`... as Theme`), you silence the compiler and risk masking real errors.\n`satisfies` provides the best of both worlds: it enforces type compliance while preserving the expression's narrowest inferred type.",
    code: "type Colors = 'primary' | 'secondary';\ntype Palette = Record<Colors, string | [number, number, number]>;\n\n// Using satisfies:\nconst theme = {\n  primary: '#ff0000',\n  secondary: [0, 255, 0],\n} satisfies Palette;\n\n// TS remembers primary is string, secondary is tuple!\ntheme.primary.toUpperCase(); // OK: string method available\ntheme.secondary.map((c) => c); // OK: array method available",
    interviewTip: "Explain that `satisfies` catches typo bugs at compile-time while preserving intellisense and exact type shapes.",
    tags: ["modern", "screening", "faq", "satisfies", "ts4.9"]
  },
  {
    id: "ts-qa-010",
    section: "faq",
    difficulty: "Foundational",
    category: "Types & Primitives",
    question: "Why should you generally avoid numeric enums in modern TypeScript code?",
    quickAnswer: "Numeric enums generate boilerplate IIFE code, allow unsafe numeric assignments, and cannot be completely tree-shaken, whereas const objects (`as const`) or string unions are zero-cost and safer.",
    detailedAnswer: "1. Type Safety Hole: In earlier TS versions, numeric enums permitted arbitrary numbers to be assigned to enum variables without errors.\n2. Runtime Overhead: Enums emit custom JavaScript lookup objects (reverse mappings) rather than disappearing at compile time.\n3. Modern Alternative: Union of string literals (`type Role = 'ADMIN' | 'USER'`) or frozen objects (`const Roles = { Admin: 'ADMIN' } as const`) provide cleaner emit, better ergonomics, and no runtime cost.",
    code: "// Problematic Numeric Enum:\nenum Status {\n  Active = 0,\n  Inactive = 1,\n}\n// Compiles to a bulky IIFE with reverse mappings.\n\n// Modern TypeScript Best Practice:\nconst STATUS = {\n  Active: 'ACTIVE',\n  Inactive: 'INACTIVE',\n} as const;\ntype StatusType = typeof STATUS[keyof typeof STATUS];",
    interviewTip: "Demonstrating awareness of why TypeScript community standards moved away from enums toward `as const` object maps shows senior-level architectural maturity.",
    tags: ["core", "screening", "faq", "enums", "best-practices"]
  },
  {
    id: "ts-qa-011",
    section: "faq",
    difficulty: "Foundational",
    category: "Compiler Config (tsconfig)",
    question: "What does `strict: true` actually do in `tsconfig.json`?",
    quickAnswer: "`strict: true` is an umbrella flag that enables all strict type-checking options, including `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, and `strictBindCallApply`.",
    detailedAnswer: "Enabling `strict: true` activates a suite of critical compiler flags:\n1. `noImplicitAny`: Raises errors on expressions and declarations with an implied `any` type.\n2. `strictNullChecks`: Treats `null` and `undefined` as distinct types rather than values assignable to everything.\n3. `strictFunctionTypes`: Enables bivariant parameter checks to contravariant enforcement for functions.\n4. `strictBindCallApply`: Verifies arguments to `bind`, `call`, and `apply` match the target signature.\n5. `strictPropertyInitialization`: Ensures class instance properties are initialized in the constructor.\n6. `useUnknownInCatchVariables`: Types catch clause variables as `unknown` instead of `any`.",
    code: "// With strict: false, this compiles with silent bugs:\nfunction getName(user: { name?: string }) {\n  return user.name.toUpperCase(); // Crashes if user.name is undefined!\n}\n\n// With strict: true:\n// Error: 'user.name' is possibly 'undefined'.\nfunction getNameSafe(user: { name?: string }) {\n  return user.name?.toUpperCase() ?? 'ANONYMOUS';\n}",
    interviewTip: "Always confirm that any modern professional TypeScript codebase must have `strict: true` turned on from day one.",
    tags: ["core", "screening", "faq", "tsconfig", "compiler"]
  },
  {
    id: "ts-qa-012",
    section: "faq",
    difficulty: "Intermediate",
    category: "Functions & Signatures",
    question: "What is the difference between `void` and `never` as function return types?",
    quickAnswer: "`void` means the function returns normally but produces no meaningful value (returns `undefined`), while `never` means the function never returns at all.",
    detailedAnswer: "- `void`: The function completes its execution flow and returns to the caller, returning `undefined` under the hood (e.g. `console.log`).\n- `never`: The function never completes normally. Either it throws an exception, halts the process, or enters an infinite execution loop. Code following a function call that returns `never` is flagged as unreachable by the compiler.",
    code: "// Returns undefined, completes execution:\nfunction logAction(msg: string): void {\n  console.log(msg);\n}\n\n// Never returns to caller:\nfunction throwFatal(err: string): never {\n  throw new Error(`Fatal error: ${err}`);\n}\n\nfunction loopForever(): never {\n  while (true) {}\n}",
    interviewTip: "Remember that a callback typed as returning `void` is allowed to return a value that will simply be ignored by the caller, which allows passing methods like `Array.push` as `void` callbacks.",
    tags: ["core", "screening", "faq", "functions", "return-types"]
  },
  {
    id: "ts-qa-013",
    section: "faq",
    difficulty: "Intermediate",
    category: "Complex Object Types",
    question: "What is Excess Property Checking, and why does assigning an object to a variable bypass it?",
    quickAnswer: "TypeScript enforces strict excess property checks only on object literals assigned directly to a target type to catch typos. Assigning via an intermediate variable bypasses this check due to structural typing.",
    detailedAnswer: "When you assign an object literal directly (e.g., `{ x: 1, typo: 2 }`), TypeScript treats it as a probable mistake if unexpected keys are provided. However, when an object is assigned to an intermediary variable first, TypeScript checks structural compatibility rather than literal creation, allowing excess properties.",
    code: "interface Options {\n  title: string;\n  width?: number;\n}\n\n// Direct literal assignment -> Excess Property Error:\n// const opt1: Options = { title: 'Box', widht: 100 }; \n// Error: Object literal may only specify known properties.\n\n// Assigned through variable -> Bypasses excess property check:\nconst rawData = { title: 'Box', widht: 100, extra: true };\nconst opt2: Options = rawData; // Compiles cleanly!",
    interviewTip: "Explain why this distinction exists: without it, passing larger objects with extra fields into helper functions would be prohibited, breaking JavaScript's composability.",
    tags: ["core", "screening", "faq", "objects", "type-checking"]
  },
  {
    id: "ts-qa-014",
    section: "faq",
    difficulty: "Foundational",
    category: "Declaration Files (.d.ts)",
    question: "What is a `.d.ts` declaration file, and how does it differ from a `.ts` file?",
    quickAnswer: "A `.d.ts` file contains only type declarations and ambient metadata with zero executable JavaScript runtime code; it acts as a header file describing existing JS modules.",
    detailedAnswer: "Declaration files (`.d.ts`):\n1. Contain only types: interfaces, type aliases, ambient module declarations, and function signatures preceded by `declare`.\n2. Do not emit JavaScript code when compiled.\n3. Enable TypeScript tooling (IntelliSense, type checks) when consuming third-party JavaScript libraries (e.g., via `@types/*` DefinitelyTyped packages).\n4. Are automatically generated from `.ts` files when `declaration: true` is enabled in `tsconfig.json`.",
    code: "// lodash.d.ts example:\ndeclare module 'my-legacy-lib' {\n  export function hashString(input: string): string;\n  export const version: string;\n}",
    interviewTip: "Emphasize that `.d.ts` files are compile-time artifacts that vanish entirely at runtime.",
    tags: ["core", "screening", "faq", "declarations", "ambient"]
  },
  {
    id: "ts-qa-015",
    section: "faq",
    difficulty: "Intermediate",
    category: "Type Manipulation",
    question: "What do the `keyof` and `typeof` type operators do when combined in TypeScript?",
    quickAnswer: "`typeof` extracts the static TypeScript type of a runtime JavaScript variable, while `keyof` produces a string/number union of all keys from an object type.",
    detailedAnswer: "Combined as `keyof typeof variable`, they allow you to derive a strict union type directly from a runtime JavaScript object without having to duplicate types manually.",
    code: "const HTTP_CODES = {\n  OK: 200,\n  BAD_REQUEST: 400,\n  NOT_FOUND: 404,\n  INTERNAL_ERROR: 500,\n} as const;\n\n// Extract the keys as a union: 'OK' | 'BAD_REQUEST' | 'NOT_FOUND' | 'INTERNAL_ERROR'\ntype HttpCodeKey = keyof typeof HTTP_CODES;\n\n// Extract the values as a union: 200 | 400 | 404 | 500\ntype HttpCodeValue = typeof HTTP_CODES[keyof typeof HTTP_CODES];",
    interviewTip: "This is one of the most frequently asked patterns in frontend interviews for generating type unions from configuration constants.",
    tags: ["core", "screening", "faq", "type-operators", "keyof-typeof"]
  },

  // ==========================================
  // SECTION: INTERVIEW QUESTIONS (TRICKY / SENIOR)
  // ==========================================
  {
    id: "ts-qa-016",
    section: "interview",
    difficulty: "Advanced",
    category: "Conditional Types & infer",
    question: "How does the `infer` keyword work in Conditional Types? Write a utility type to unwrap the return type of a Promise.",
    quickAnswer: "`infer` introduces a type variable within the `extends` clause of a conditional type to deduce and extract a type dynamically from a complex structure.",
    detailedAnswer: "When writing conditional types (`T extends U ? X : Y`), you often want to extract an inner type without knowing it in advance. The `infer` keyword declares a temporary type variable that TypeScript attempts to solve during type unification.\nExample: Extracting the resolved type of a Promise or the arguments of a function.",
    code: "// Custom UnwrapPromise implementation:\ntype MyAwaited<T> = T extends Promise<infer R> ? MyAwaited<R> : T;\n\ntype T1 = MyAwaited<Promise<string>>;          // string\ntype T2 = MyAwaited<Promise<Promise<number>>>; // number (recursive)\ntype T3 = MyAwaited<boolean>;                  // boolean\n\n// Extracting parameter types:\ntype FirstParam<T> = T extends (first: infer P, ...args: any[]) => any ? P : never;\ntype P = FirstParam<(name: string, age: number) => void>; // string",
    interviewTip: "Mention that recursive conditional types with `infer` power TypeScript's standard `Awaited<T>` utility type introduced in TS 4.5.",
    tags: ["interview", "advanced", "conditional-types", "infer", "type-gymnastics"]
  },
  {
    id: "ts-qa-017",
    section: "interview",
    difficulty: "Advanced",
    category: "Conditional Types & infer",
    question: "What is Distributive Conditional Typing, and how do you prevent distribution over naked type parameters?",
    quickAnswer: "When a conditional type operates on a naked (unwrapped) generic parameter, union types are automatically distributed across the condition. Wrapping the parameter in a tuple `[T]` prevents this distribution.",
    detailedAnswer: "If `T` is a naked type parameter, `T extends any` distributes over a union: `(A | B) extends U ? X : Y` evaluates to `(A extends U ? X : Y) | (B extends U ? X : Y)`.\nWhile this enables utilities like `Exclude`, it can cause unwanted behavior when you want to inspect the union as a single whole.",
    code: "// Distributive (default behavior):\ntype ToArrayDistributive<T> = T extends any ? T[] : never;\ntype Distributed = ToArrayDistributive<string | number>;\n// Result: string[] | number[]\n\n// Non-Distributive (wrapped in tuple [T]):\ntype ToArrayNonDistributive<T> = [T] extends [any] ? T[] : never;\ntype NotDistributed = ToArrayNonDistributive<string | number>;\n// Result: (string | number)[]",
    interviewTip: "This is a classic Staff-level TypeScript question. Knowing the tuple-bracket trick `[T] extends [U]` proves you understand TypeScript's type-checker mechanics.",
    tags: ["interview", "advanced", "conditional-types", "distributive", "mechanics"]
  },
  {
    id: "ts-qa-018",
    section: "interview",
    difficulty: "Advanced",
    category: "Functions & Signatures",
    question: "Explain Covariance vs Contravariance in TypeScript function types, and what `strictFunctionTypes` enforces.",
    quickAnswer: "TypeScript types are covariant in return types (more specific return is allowed) and contravariant in parameter types (broader parameter is required) when `strictFunctionTypes` is enabled.",
    detailedAnswer: "- Covariance: Preserves subtyping direction. If `Dog extends Animal`, then `() => Dog` is assignable to `() => Animal`.\n- Contravariance: Reverses subtyping direction. If `Dog extends Animal`, then `(a: Animal) => void` is assignable to `(d: Dog) => void` because the function only requires general `Animal` capabilities, so passing a `Dog` is safe.\nWithout `strictFunctionTypes: true`, TypeScript checks method parameters bivariantly for historical compatibility with arrays, which can introduce runtime type unsafety.",
    code: "class Animal { name = 'animal'; }\nclass Dog extends Animal { bark() { console.log('woof'); } }\n\n// Covariant Return Types:\nlet getAnimal: () => Animal;\nlet getDog: () => Dog = () => new Dog();\ngetAnimal = getDog; // Allowed: Dog is an Animal\n\n// Contravariant Parameter Types:\nlet handleDog: (d: Dog) => void;\nlet handleAnimal: (a: Animal) => void = (a) => console.log(a.name);\nhandleDog = handleAnimal; // Allowed: Can handle any Animal, so safe for Dog!",
    interviewTip: "Point out that method syntax in interfaces (`fn(x: T): void`) remains bivariant even with `strictFunctionTypes`, while property function syntax (`fn: (x: T) => void`) strictly enforces contravariance.",
    tags: ["interview", "advanced", "variance", "compiler", "type-theory"]
  },
  {
    id: "ts-qa-019",
    section: "interview",
    difficulty: "Advanced",
    category: "Utility Types",
    question: "How do you implement a recursive `DeepReadonly<T>` type from scratch?",
    quickAnswer: "Using mapped types combined with conditional type checks to recursively mark nested objects, arrays, and primitives as readonly.",
    detailedAnswer: "A standard `Readonly<T>` only freezes the top-level keys. A recursive `DeepReadonly` must check if each member is a function, primitive, array, or object, and recurse into nested types.",
    code: "type DeepReadonly<T> = T extends Function | boolean | number | string | symbol | null | undefined\n  ? T\n  : T extends Array<infer U>\n  ? ReadonlyArray<DeepReadonly<U>>\n  : T extends Map<infer K, infer V>\n  ? ReadonlyMap<DeepReadonly<K>, DeepReadonly<V>>\n  : T extends Set<infer M>\n  ? ReadonlySet<DeepReadonly<M>>\n  : { readonly [K in keyof T]: DeepReadonly<T[K]> };\n\n// Test:\ninterface Config {\n  server: { host: string; ports: number[] };\n}\ntype FrozenConfig = DeepReadonly<Config>;\n// server is readonly, server.ports is ReadonlyArray, server.host is readonly string",
    interviewTip: "Always make sure your recursive types explicitly terminate on primitive types and functions to prevent compiler depth limit warnings.",
    tags: ["interview", "advanced", "utility-types", "recursion", "type-gymnastics"]
  },
  {
    id: "ts-qa-020",
    section: "interview",
    difficulty: "Intermediate",
    category: "Narrowing & Type Guards",
    question: "How do you enforce compile-time Exhaustiveness Checking in a `switch` statement using the `never` type?",
    quickAnswer: "By assigning the unhandled variable to a typed `never` variable in the `default` branch; if any variant in a union is missed, TypeScript flags a compile-time error.",
    detailedAnswer: "When working with Discriminated Unions, developers can forget to add a `case` clause when a new variant is added to the union. By creating an exhaustive assertion in the `default` case, the compiler will fail if any possible type remains unhandled.",
    code: "type Action = \n  | { type: 'INCREMENT'; amount: number }\n  | { type: 'DECREMENT'; amount: number }\n  | { type: 'RESET' };\n\nfunction reducer(action: Action) {\n  switch (action.type) {\n    case 'INCREMENT': return action.amount;\n    case 'DECREMENT': return -action.amount;\n    case 'RESET': return 0;\n    default: {\n      // If an unhandled action is added to Action union, this line throws a compile error:\n      const _unreachable: never = action;\n      throw new Error(`Unhandled action: ${_unreachable}`);\n    }\n  }\n}",
    interviewTip: "This is a standard requirement in high-reliability financial or medical software built with TypeScript.",
    tags: ["interview", "screening", "narrowing", "exhaustiveness", "never"]
  },
  {
    id: "ts-qa-021",
    section: "interview",
    difficulty: "Advanced",
    category: "Type Manipulation",
    question: "What are Branded Types (Nominal Typing emulation) in TypeScript, and how do they prevent domain-level bugs?",
    quickAnswer: "Branded types attach a phantom unique property tag to a primitive type to distinguish semantically distinct values (like `UserId` vs `OrderId`) that share the same underlying primitive.",
    detailedAnswer: "Because TypeScript is structurally typed, a function expecting a `UserId: string` will accidentally accept an `OrderId: string` or any arbitrary string. Branded types solve this without runtime overhead by attaching a unique nominal brand tag.",
    code: "// Brand helper:\ndeclare const brand: unique symbol;\ntype Brand<T, B> = T & { readonly [brand]: B };\n\ntype UserId = Brand<string, 'UserId'>;\ntype OrderId = Brand<string, 'OrderId'>;\n\nfunction createUserId(id: string): UserId {\n  return id as UserId;\n}\n\nfunction getOrder(user: UserId, order: OrderId) { /* ... */ }\n\nconst uid = createUserId('user_123');\nconst oid = 'order_999' as OrderId;\n\ngetOrder(uid, oid); // Valid!\n// getOrder(oid, uid); // Compile Error: Type 'OrderId' is not assignable to 'UserId'",
    interviewTip: "Point out that `unique symbol` ensures brands from different packages or modules can never collide.",
    tags: ["interview", "advanced", "branded-types", "nominal-typing", "safety"]
  },
  {
    id: "ts-qa-022",
    section: "interview",
    difficulty: "Intermediate",
    category: "Functions & Signatures",
    question: "How do Function Overloads work in TypeScript, and why is the implementation signature hidden from callers?",
    quickAnswer: "You declare multiple public overload signatures followed by a single private implementation signature. Callers can only call signatures matching one of the overloads.",
    detailedAnswer: "TypeScript function overloads provide multiple distinct parameter/return relationships for the same function. The implementation signature must be compatible with all declared overloads, but callers cannot invoke the implementation signature directly if their argument list does not match one of the explicit overload signatures.",
    code: "// Overload signatures (public interface):\nfunction makeDate(timestamp: number): Date;\nfunction makeDate(m: number, d: number, y: number): Date;\n\n// Implementation signature (internal, not directly callable):\nfunction makeDate(mOrTimestamp: number, d?: number, y?: number): Date {\n  if (d !== undefined && y !== undefined) {\n    return new Date(y, mOrTimestamp - 1, d);\n  }\n  return new Date(mOrTimestamp);\n}\n\nmakeDate(1609459200000);   // OK (matches overload 1)\nmakeDate(1, 1, 2021);       // OK (matches overload 2)\n// makeDate(1, 1);           // Error: No overload expects 2 arguments!",
    interviewTip: "In modern TS, conditional types or generic signatures can often replace complex overloads with clearer code.",
    tags: ["interview", "functions", "overloading", "api-design"]
  },
  {
    id: "ts-qa-023",
    section: "interview",
    difficulty: "Advanced",
    category: "Modern TypeScript",
    question: "What are `const` type parameters introduced in TypeScript 5.0, and how do they improve generic inference?",
    quickAnswer: "`<const T>` automatically infers generic arguments with `as const` literal narrowing without requiring the caller to manually write `as const` at every call site.",
    detailedAnswer: "Prior to TypeScript 5.0, generic functions widened literals passed to them unless the caller manually appended `as const`. With `<const T>`, the function definition itself opts into const-like inference, capturing exact literal unions, readonly tuples, and precise object keys automatically.",
    code: "// TS 5.0 const type parameter:\nfunction createRoutes<const T extends readonly string[]>(routes: T): T {\n  return routes;\n}\n\n// Inferred automatically as readonly ['/home', '/dashboard']:\nconst myRoutes = createRoutes(['/home', '/dashboard']);\n// myRoutes has type: readonly ['/home', '/dashboard'], NOT string[]!",
    interviewTip: "Highlight that this drastically cleans up builder functions and fluent APIs in libraries like Zod, TRPC, or router libraries.",
    tags: ["interview", "modern", "ts5.0", "generics", "const-parameters"]
  },
  {
    id: "ts-qa-024",
    section: "interview",
    difficulty: "Intermediate",
    category: "Classes & OOP Patterns",
    question: "What is the difference between TypeScript's `private` keyword and ECMAScript's `#private` field syntax?",
    quickAnswer: "`private` is compile-time only (erased at runtime); `#private` provides true runtime encapsulation enforced natively by the JavaScript engine.",
    detailedAnswer: "1. `private x`: Checked only by the TypeScript compiler. In compiled JavaScript, it becomes a regular public property accessible via `obj['x']` or runtime reflection.\n2. `#x` (Private identifier): A native ECMAScript standard feature. Enforced at the JS runtime engine level; cannot be accessed or inspected outside the class body, even via bracket notation.",
    code: "class UserAccount {\n  private tsSecret = 'soft-private';\n  #hardSecret = 'hard-private';\n}\n\nconst user = new UserAccount();\n// In compiled JavaScript:\n// (user as any).tsSecret -> Accessible at runtime!\n// (user as any).#hardSecret -> Syntax Error: Private field '#hardSecret' must be declared in enclosing class",
    interviewTip: "Recommend using `#private` when building public libraries or handling sensitive security credentials.",
    tags: ["interview", "classes", "oop", "ecmascript", "encapsulation"]
  },
  {
    id: "ts-qa-025",
    section: "interview",
    difficulty: "Advanced",
    category: "Type Manipulation",
    question: "Why does `Object.keys()` return `string[]` instead of `(keyof T)[]` in TypeScript's standard library?",
    quickAnswer: "Because TypeScript types are open and structural; at runtime, an object may contain extra unspecified properties that are not part of `keyof T`.",
    detailedAnswer: "Due to structural subtyping, an object conforming to interface `{ a: string }` might actually be an instance containing `{ a: string, b: number, c: boolean }`. If `Object.keys` returned `(keyof T)[]`, TS would allow iterating over keys assuming they only belong to `keyof T`, leading to false type guarantees.",
    code: "interface Shape {\n  color: string;\n}\n\nconst detailedShape = { color: 'red', radius: 50 };\nconst shape: Shape = detailedShape; // Allowed due to structural typing\n\n// If Object.keys returned (keyof Shape)[], it would claim keys are only 'color',\n// but at runtime 'radius' is also returned!\n\n// Safe strongly typed helper when needed:\nfunction strictKeys<T extends object>(obj: T): (keyof T)[] {\n  return Object.keys(obj) as (keyof T)[];\n}",
    interviewTip: "Explaining that structural subtyping creates 'open types' rather than closed types will immediately impress senior interviewers.",
    tags: ["interview", "advanced", "structural-typing", "type-safety", "keys"]
  },
  {
    id: "ts-qa-026",
    section: "faq",
    difficulty: "Intermediate",
    category: "Template Literal Types",
    question: "How do Template Literal Types work in TypeScript, and what are their primary use cases?",
    quickAnswer: "Template Literal Types build on string literal types to produce new string union types via template literal syntax and string manipulation generics.",
    detailedAnswer: "Introduced in TypeScript 4.1, template literal types allow you to model string patterns, event listener combinations, and API endpoints at compile time. They can be combined with intrinsic string manipulation types: `Uppercase`, `Lowercase`, `Capitalize`, and `Uncapitalize`.",
    code: "type Entity = 'user' | 'order' | 'product';\ntype Action = 'create' | 'update' | 'delete';\n\n// Creates all 9 combinations automatically:\ntype EventName = `${Entity}_${Action}`;\n// 'user_create' | 'user_update' | 'user_delete' | ...\n\n// Dynamic getter types:\ntype Getter<T extends string> = `get${Capitalize<T>}`;\ntype UserGetter = Getter<'name'>; // 'getName'",
    interviewTip: "Highlight their value in strongly typing CSS values (e.g. `${number}px`), SQL queries, or reactive store event emitters.",
    tags: ["faq", "intermediate", "template-literals", "string-types"]
  },
  {
    id: "ts-qa-027",
    section: "interview",
    difficulty: "Advanced",
    category: "Advanced Type Gymnastics",
    question: "How can you transform a Union type into an Intersection type (`UnionToIntersection<U>`) in TypeScript?",
    quickAnswer: "By leveraging contravariance of function parameters within a conditional type and using `infer`.",
    detailedAnswer: "In TypeScript, when `infer` appears in a contravariant position (such as a function parameter), candidates from a union are intersected rather than unioned. This enables transforming `{ a: string } | { b: number }` into `{ a: string } & { b: number }`.",
    code: "type UnionToIntersection<U> = \n  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) \n    ? I \n    : never;\n\ntype Input = { name: string } | { age: number } | { active: boolean };\ntype Output = UnionToIntersection<Input>;\n// Result: { name: string } & { age: number } & { active: boolean }",
    interviewTip: "This is one of the ultimate TypeScript type gymnastics puzzles asked by Principal/Staff frontend interview panels.",
    tags: ["interview", "advanced", "type-gymnastics", "contravariance", "intersection"]
  },
  {
    id: "ts-qa-028",
    section: "faq",
    difficulty: "Foundational",
    category: "Fundamentals & Internals",
    question: "Why does TypeScript compile successfully even when there are compile-time type errors?",
    quickAnswer: "TypeScript's compiler architecture separates type checking from code generation, adhering to the principle that 'type errors should not stop you from testing or debugging runtime code'.",
    detailedAnswer: "By default, `tsc` emits JavaScript files even if type errors are reported. This allows developers to incrementally migrate JavaScript codebases or test changes without fixing every upstream typing error first. If you want emit to fail on errors, you must explicitly enable `noEmitOnError: true` in `tsconfig.json`.",
    code: "// tsconfig.json:\n{\n  \"compilerOptions\": {\n    \"noEmitOnError\": true // Stops emit on errors!\n  }\n}",
    interviewTip: "Remind the interviewer that single-file transpilers like esbuild, Babel, and SWC do not check types at all—they only strip type annotations.",
    tags: ["faq", "fundamentals", "compiler", "tsconfig", "emit"]
  },
  {
    id: "ts-qa-029",
    section: "interview",
    difficulty: "Intermediate",
    category: "Modules & Declarations",
    question: "What is Module Augmentation in TypeScript, and how is it used to extend third-party libraries?",
    quickAnswer: "Module augmentation allows you to declare and merge new type properties or methods into an existing third-party module without modifying its source code.",
    detailedAnswer: "When working with packages like Express, Vue, or React, you often attach custom properties to global or request contexts (such as `req.user`). Module augmentation uses ambient module declarations to extend existing interface declarations inside third-party packages.",
    code: "// express-augmentation.d.ts\nimport 'express';\n\ndeclare module 'express' {\n  export interface Request {\n    currentUser?: {\n      id: string;\n      role: 'admin' | 'user';\n    };\n  }\n}\n\n// Usage in app code:\nimport { Request, Response } from 'express';\nfunction handler(req: Request, res: Response) {\n  console.log(req.currentUser?.role); // Fully typed!\n}",
    interviewTip: "Mention that module augmentation requires an `import` statement in the `.d.ts` file so TypeScript treats it as a module rather than a global script.",
    tags: ["interview", "modules", "declarations", "express", "augmentation"]
  },
  {
    id: "ts-qa-030",
    section: "faq",
    difficulty: "Foundational",
    category: "Types & Primitives",
    question: "What is the non-null assertion operator (`!.`) and why is it dangerous in production?",
    quickAnswer: "The `!.` operator tells the compiler to assume an expression cannot be `null` or `undefined`, suppressing warnings without any runtime safety check.",
    detailedAnswer: "If you use `x!.property`, TypeScript removes `null` and `undefined` from `x`'s type. However, unlike optional chaining (`?.`), it generates no protective runtime code. If `x` actually is `null` at runtime, your application will crash with `TypeError: Cannot read properties of undefined`.",
    code: "const element = document.getElementById('root')!;\n// Compiles, but if element doesn't exist, crashes immediately:\nelement.addEventListener('click', () => {});\n\n// Safer alternative:\nconst safeElement = document.getElementById('root');\nif (safeElement) {\n  safeElement.addEventListener('click', () => {});\n}",
    interviewTip: "State clearly that non-null assertions should be avoided in favor of defensive checks, optional chaining, or null-coalescing (`??`).",
    tags: ["faq", "fundamentals", "safety", "operators"]
  },
  {
    id: "ts-qa-031",
    section: "interview",
    difficulty: "Advanced",
    category: "Type Manipulation",
    question: "How does Key Remapping in Mapped Types work using the `as` clause?",
    quickAnswer: "Key remapping allows you to filter out or transform object keys into new names (such as adding prefixes or filtering by type) when creating mapped types.",
    detailedAnswer: "In TypeScript 4.1+, you can use `[K in keyof T as NewKeyType]` to re-map property keys. If `NewKeyType` resolves to `never`, that property is completely filtered out from the resulting object type.",
    code: "interface Person {\n  name: string;\n  age: number;\n  location: string;\n}\n\n// Remapping keys with template literals:\ntype Getters<T> = {\n  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];\n};\ntype PersonGetters = Getters<Person>;\n// { getName: () => string; getAge: () => number; getLocation: () => string; }\n\n// Filtering keys: keep only string values\ntype OnlyStrings<T> = {\n  [K in keyof T as T[K] extends string ? K : never]: T[K];\n};\ntype PersonStrings = OnlyStrings<Person>; // { name: string; location: string; }",
    interviewTip: "Mentioning the use of `as never` to omit keys during mapping shows mastery of modern TypeScript type metaprogramming.",
    tags: ["interview", "advanced", "mapped-types", "key-remapping"]
  },
  {
    id: "ts-qa-032",
    section: "faq",
    difficulty: "Intermediate",
    category: "Compiler Config (tsconfig)",
    question: "What does the `noUncheckedIndexedAccess` compiler flag do, and why should you enable it?",
    quickAnswer: "`noUncheckedIndexedAccess` automatically appends `undefined` to the return type of any lookup on an index signature or array index access, forcing safe handling.",
    detailedAnswer: "By default, TypeScript assumes that accessing `arr[index]` or `record[key]` will always return a defined element (e.g. `string`), even though accessing an out-of-bounds index returns `undefined` at runtime. Enabling `noUncheckedIndexedAccess: true` makes lookups return `T | undefined`.",
    code: "// With noUncheckedIndexedAccess: false:\nconst list: string[] = ['apple'];\nconst item = list[10]; // Type: string (silent runtime crash if item.toLowerCase() is called!)\n\n// With noUncheckedIndexedAccess: true:\n// item type: string | undefined\n// item.toLowerCase(); // Error: 'item' is possibly 'undefined'.\nif (item) {\n  item.toLowerCase(); // Safe!\n}",
    interviewTip: "This is one of the highest-impact flags for stopping production `Cannot read properties of undefined` crashes.",
    tags: ["faq", "compiler", "tsconfig", "safety", "arrays"]
  },
  {
    id: "ts-qa-033",
    section: "interview",
    difficulty: "Advanced",
    category: "Advanced Type Gymnastics",
    question: "How do you implement a `TupleToUnion<T>` and a `Flatten<T>` type?",
    quickAnswer: "`TupleToUnion<T>` uses indexed access `T[number]`. `Flatten<T>` uses conditional types with `infer` to unwrap nested arrays.",
    detailedAnswer: "Accessing an array or tuple type with index type `number` (`T[number]`) distributes every item into a single union. To flatten arrays recursively, use conditional types with `infer`.",
    code: "// 1. TupleToUnion:\ntype TupleToUnion<T extends readonly any[]> = T[number];\ntype Colors = TupleToUnion<['red', 'green', 'blue']>; // 'red' | 'green' | 'blue'\n\n// 2. Recursive Flatten:\ntype Flatten<T> = T extends (infer Element)[] \n  ? Flatten<Element> \n  : T;\n\ntype FlatNumbers = Flatten<number[][][]>; // number\ntype FlatMixed = Flatten<(string | boolean[])[]>; // string | boolean",
    interviewTip: "Interviewers frequently use `T[number]` as a quick test of whether a candidate understands tuple indexing fundamentals.",
    tags: ["interview", "advanced", "tuples", "flatten", "generics"]
  },
  {
    id: "ts-qa-034",
    section: "faq",
    difficulty: "Foundational",
    category: "Modules & Declarations",
    question: "What is `import type` and why should you prefer type-only imports?",
    quickAnswer: "`import type` guarantees that imported symbols are erased during compilation, avoiding circular runtime dependencies and improving bundler tree-shaking.",
    detailedAnswer: "When importing an interface or type alias, a standard `import { User } from './user'` might cause bundlers to emit an empty runtime `require` or side-effect import. Using `import type { User } from './user'` makes it unambiguous to compilers and single-file transpilers (like Babel, SWC, esbuild) that this import has zero runtime footprint.",
    code: "// Explicit Type-only Import:\nimport type { User, AuthToken } from './types';\nimport { loginUser } from './auth'; // Real runtime code\n\n// Inline Type Import (TS 4.5+):\nimport { executeQuery, type QueryOptions } from './db';",
    interviewTip: "Always mention `verbatimModuleSyntax` or `isolatedModules` flags, which actively enforce using `import type`.",
    tags: ["faq", "modules", "bundlers", "performance", "imports"]
  },
  {
    id: "ts-qa-035",
    section: "interview",
    difficulty: "Advanced",
    category: "Generics & Type Params",
    question: "How do you type an Event Emitter so that event names and their payload types are strictly coupled?",
    quickAnswer: "Use a generic interface keyed by an event map, referencing `Events[K]` for listener arguments.",
    detailedAnswer: "Rather than allowing arbitrary string event names and `any` payloads, define an interface mapping event names to their payload shapes. Then create generic `on` and `emit` methods constrained by `keyof Events`.",
    code: "interface AppEvents {\n  'user:login': { userId: string; timestamp: number };\n  'cart:update': { itemCount: number; total: number };\n  'app:logout': void;\n}\n\nclass TypedEventEmitter<Events extends Record<string, any>> {\n  private listeners: { [K in keyof Events]?: Array<(payload: Events[K]) => void> } = {};\n\n  on<K extends keyof Events>(event: K, listener: (payload: Events[K]) => void) {\n    this.listeners[event] = this.listeners[event] || [];\n    this.listeners[event]!.push(listener);\n  }\n\n  emit<K extends keyof Events>(event: K, payload: Events[K]) {\n    this.listeners[event]?.forEach((cb) => cb(payload));\n  }\n}\n\nconst emitter = new TypedEventEmitter<AppEvents>();\nemitter.on('user:login', (data) => console.log(data.userId)); // Strongly typed!\n// emitter.emit('user:login', { userId: '123' }); // Error: Property 'timestamp' is missing",
    interviewTip: "This is one of the most practical real-world system design questions for senior TypeScript roles.",
    tags: ["interview", "advanced", "generics", "event-emitter", "system-design"]
  }
];

const targetPath = path.join(__dirname, '../data/typescript.qa.json');
fs.writeFileSync(targetPath, JSON.stringify(qaList, null, 2), 'utf8');
console.log(`Successfully generated ${qaList.length} TypeScript QA items at ${targetPath}`);
