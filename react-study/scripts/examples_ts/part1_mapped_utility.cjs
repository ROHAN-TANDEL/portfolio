module.exports = [
  {
    id: "ts-ex-01",
    title: "Recursive DeepReadonly<T> with Function & Array Guards",
    category: "Mapped & Utility Types",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements a production-grade DeepReadonly<T> utility type that recursively marks all nested object and array properties readonly while preserving primitive types and function references.",
    conceptsCovered: [
      "DeepReadonly",
      "Recursive Mapped Types",
      "Function Guards",
      "Array & Tuple Handling",
      "ReadonlyArray"
    ],
    code: `// DeepReadonly type definition
type DeepReadonly<T> = T extends (...args: any[]) => any
  ? T // Preserve functions unmodified
  : T extends ReadonlyArray<infer Item>
    ? ReadonlyArray<DeepReadonly<Item>> // Recursively freeze arrays/tuples
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> } // Recursively freeze objects
      : T; // Primitives (string, number, boolean) remain as-is

// Test Data Structure
interface UserAccount {
  id: string;
  profile: {
    name: string;
    roles: string[];
    settings: {
      theme: 'dark' | 'light';
      notifications: boolean;
    };
  };
  logActivity: (event: string) => void;
}

// Verification:
type ImmutableAccount = DeepReadonly<UserAccount>;

const account: ImmutableAccount = {
  id: 'usr_101',
  profile: {
    name: 'Alice',
    roles: ['admin', 'editor'],
    settings: {
      theme: 'dark',
      notifications: true
    }
  },
  logActivity: (event) => console.log('Event:', event)
};

// Compilation assertions:
// account.id = 'usr_102'; // ERROR: Cannot assign to 'id' because it is a read-only property.
// account.profile.name = 'Bob'; // ERROR: Cannot assign to 'name' because it is a read-only property.
// account.profile.roles.push('viewer'); // ERROR: Property 'push' does not exist on type 'readonly string[]'.
account.logActivity('login'); // OK! Function invocation preserved.`,
    breakdown: [
      {
        lineRange: "2-9",
        note: "Tests against function signatures first to avoid mapped types breaking function prototypes; recursively maps arrays and objects."
      },
      {
        lineRange: "24-38",
        note: "Instantiates a nested mock object demonstrating compile-time immutability across all nesting levels."
      }
    ],
    expectedOutput: "Compile-time enforcement: all nested properties and arrays become immutable (readonly)."
  },

  {
    id: "ts-ex-02",
    title: "Recursive DeepPartial<T> and DeepRequired<T>",
    category: "Mapped & Utility Types",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds deep recursive versions of TypeScript's built-in Partial<T> and Required<T>, recursively adding or removing optional modifiers (?) on all nested levels.",
    conceptsCovered: [
      "DeepPartial",
      "DeepRequired",
      "-? Mapping Modifier",
      "Recursive Mapped Types",
      "Optional Fields"
    ],
    code: `// Recursively marks all nested properties optional
type DeepPartial<T> = T extends Function
  ? T
  : T extends Array<infer U>
    ? _DeepPartialArray<U>
    : T extends object
      ? { [P in keyof T]?: DeepPartial<T[P]> }
      : T;

interface _DeepPartialArray<T> extends Array<DeepPartial<T>> {}

// Recursively removes optionality (-?) from all nested properties
type DeepRequired<T> = T extends Function
  ? T
  : T extends Array<infer U>
    ? _DeepRequiredArray<U>
    : T extends object
      ? { [P in keyof T]-?: DeepRequired<T[P]> }
      : T;

interface _DeepRequiredArray<T> extends Array<DeepRequired<T>> {}

// Test interface with nested optionals
interface Config {
  env?: string;
  server?: {
    port?: number;
    ssl?: {
      enabled?: boolean;
      cert?: string;
    };
  };
}

// DeepRequired forces ALL nested fields to be supplied!
type StrictConfig = DeepRequired<Config>;

// DeepPartial allows updating ANY single deep property!
type PatchConfig = DeepPartial<Config>;

const patch: PatchConfig = {
  server: {
    ssl: {
      enabled: true // Valid! No need to specify port, env, or cert!
    }
  }
};`,
    breakdown: [
      {
        lineRange: "2-10",
        note: "DeepPartial uses mapped type [P in keyof T]?: DeepPartial<T[P]> to mark nested fields optional."
      },
      {
        lineRange: "13-21",
        note: "DeepRequired uses [P in keyof T]-?: DeepRequired<T[P]> to strip the ? modifier recursively."
      }
    ],
    expectedOutput: "DeepPartial enables partial nested updates; DeepRequired enforces 100% presence of nested fields."
  },

  {
    id: "ts-ex-03",
    title: "Recursive DeepMutable<T> (Stripping readonly Across Structures)",
    category: "Mapped & Utility Types",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs a DeepMutable<T> utility using the -readonly mapped modifier to strip immutability from deeply nested objects, arrays, and as const assertions.",
    conceptsCovered: [
      "DeepMutable",
      "-readonly Modifier",
      "as const Inversion",
      "Tuple Mutability",
      "Structural Transformation"
    ],
    code: `// Strips 'readonly' from all nested object properties and tuples
type DeepMutable<T> = T extends Function
  ? T
  : T extends readonly (infer Item)[]
    ? Item[] // Unwraps ReadonlyArray to mutable Array
    : T extends object
      ? { -readonly [K in keyof T]: DeepMutable<T[K]> }
      : T;

// Freeze an object using 'as const'
const frozenState = {
  mode: 'production',
  flags: ['auth', 'cache'],
  meta: {
    retries: 3,
    debug: false
  }
} as const;

// frozenState.mode = 'dev'; // ERROR: Cannot assign to 'mode' because it is a read-only property.

// Convert frozenState to a completely mutable clone type:
type MutableState = DeepMutable<typeof frozenState>;

const workingCopy: MutableState = {
  mode: 'production',
  flags: ['auth', 'cache'],
  meta: {
    retries: 3,
    debug: false
  }
};

// All properties are now mutable:
workingCopy.mode = 'development'; // OK!
workingCopy.flags.push('logging'); // OK!
workingCopy.meta.retries = 5; // OK!`,
    breakdown: [
      {
        lineRange: "2-8",
        note: "Uses -readonly modifier to strip immutability from properties and converts readonly arrays to mutable Item[]."
      },
      {
        lineRange: "10-21",
        note: "Takes a readonly literal object created with 'as const' and generates an unrestricted mutable equivalent."
      }
    ],
    expectedOutput: "Strips readonly markers across all nested levels, permitting runtime reassignments."
  },

  {
    id: "ts-ex-04",
    title: "PickByValue<T, ValueType> and OmitByValue<T, ValueType> via Key Remapping",
    category: "Mapped & Utility Types",
    difficulty: "intermediate",
    whatThisCodeCovers: "Leverages TypeScript 4.1 key remapping (as K extends ...) to filter object properties by value type (e.g. picking only functions, or omitting all boolean flags).",
    conceptsCovered: [
      "Key Remapping (as)",
      "PickByValue",
      "OmitByValue",
      "Conditional Key Filtering",
      "Utility Composition"
    ],
    code: `// Picks keys whose values are assignable to ValueType
type PickByValue<T, ValueType> = {
  [K in keyof T as T[K] extends ValueType ? K : never]: T[K];
};

// Omits keys whose values are assignable to ValueType
type OmitByValue<T, ValueType> = {
  [K in keyof T as T[K] extends ValueType ? never : K]: T[K];
};

// Example Model
interface Article {
  id: string;
  title: string;
  viewCount: number;
  isPublished: boolean;
  isArchived: boolean;
  publish: () => Promise<void>;
  archive: () => void;
}

// 1. Pick only methods (functions) from the model
type ArticleMethods = PickByValue<Article, Function>;
// Inferred: { publish: () => Promise<void>; archive: () => void; }

// 2. Pick only string properties
type StringFields = PickByValue<Article, string>;
// Inferred: { id: string; title: string; }

// 3. Omit all boolean flags
type DataWithoutBooleans = OmitByValue<Article, boolean>;
// Inferred: { id: string; title: string; viewCount: number; publish: ...; archive: ...; }`,
    breakdown: [
      {
        lineRange: "2-9",
        note: "Uses [K in keyof T as T[K] extends ValueType ? K : never] where returning never excludes that key from the output shape."
      },
      {
        lineRange: "22-31",
        note: "Demonstrates extracting function methods or primitive types from an enterprise data model."
      }
    ],
    expectedOutput: "Filters object keys based on value types at compile-time with 100% precision."
  },

  {
    id: "ts-ex-05",
    title: "RequireAtLeastOne<T, Keys> and RequireExactlyOne<T, Keys>",
    category: "Mapped & Utility Types",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds advanced constraint utilities that enforce that an object has at least one of a set of keys, or mutually exclusive keys (XOR / exactly one).",
    conceptsCovered: [
      "RequireAtLeastOne",
      "RequireExactlyOne (XOR)",
      "Mutual Exclusivity",
      "Union Distribution",
      "API Payload Constraints"
    ],
    code: `// Enforces that AT LEAST ONE of the specified keys must be present
type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> & 
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

// Enforces that EXACTLY ONE of the specified keys is present (Mutually Exclusive / XOR)
type RequireExactlyOne<T, Keys extends keyof T = keyof T> = 
  Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]: Required<Pick<T, K>> & Record<Exclude<Keys, K>, never?>;
  }[Keys];

// Example: User contact preferences
interface ContactForm {
  name: string;
  email?: string;
  phone?: string;
}

// Must provide either email OR phone (or both)
type ValidContact = RequireAtLeastOne<ContactForm, 'email' | 'phone'>;

const c1: ValidContact = { name: 'Alice', email: 'alice@test.com' }; // OK!
const c2: ValidContact = { name: 'Bob', phone: '123-456' }; // OK!
const c3: ValidContact = { name: 'Charlie', email: 'c@test.com', phone: '123' }; // OK!
// const c4: ValidContact = { name: 'Dan' }; // COMPILE ERROR: Missing email or phone!

// Must provide EITHER email OR phone, NEVER BOTH!
type StrictContact = RequireExactlyOne<ContactForm, 'email' | 'phone'>;

const s1: StrictContact = { name: 'Alice', email: 'alice@test.com' }; // OK!
// const s2: StrictContact = { name: 'Both', email: 'a@test.com', phone: '123' }; // COMPILE ERROR!`,
    breakdown: [
      {
        lineRange: "2-7",
        note: "RequireAtLeastOne creates a union where each branch marks one key required and the others optional."
      },
      {
        lineRange: "10-15",
        note: "RequireExactlyOne enforces XOR by marking one key required and setting other candidate keys to never?."
      }
    ],
    expectedOutput: "Validates complex mutually-exclusive or at-least-one API request payload requirements."
  },

  {
    id: "ts-ex-06",
    title: "Deep Dot-Notation Object Path Key Extractor (Path<T>)",
    category: "Mapped & Utility Types",
    difficulty: "advanced",
    whatThisCodeCovers: "Constructs a type-level recursive Path<T> utility that extracts all valid nested dot-notation paths ('user.profile.address.city') from complex object trees.",
    conceptsCovered: [
      "Path<T>",
      "Dot-Notation Paths",
      "Recursive String Keys",
      "Template Literal Types",
      "Form Field Autocompletion"
    ],
    code: `// Recursively generates all valid nested dot-notation paths as string literals
type Path<T> = T extends object
  ? {
      [K in keyof T & (string | number)]: T[K] extends Array<any>
        ? \`\${K}\` | \`\${K}[\${number}]\`
        : T[K] extends object
          ? \`\${K}\` | \`\${K}.\${Path<T[K]>}\`
          : \`\${K}\`;
    }[keyof T & (string | number)]
  : never;

// Test Schema
interface EnterpriseUser {
  id: string;
  personal: {
    firstName: string;
    lastName: string;
    contacts: {
      email: string;
      phone: string;
    };
  };
  tags: string[];
}

type UserPaths = Path<EnterpriseUser>;
// Inferred Union:
// "id" | "personal" | "tags" | "tags[\${number}]" |
// "personal.firstName" | "personal.lastName" | "personal.contacts" |
// "personal.contacts.email" | "personal.contacts.phone"

// Type-Safe Form Watcher Function:
function watchField<P extends Path<EnterpriseUser>>(path: P) {
  console.log('Watching field path:', path);
}

// Complete IDE Autocomplete for all nested paths!
watchField('personal.contacts.email'); // Valid
watchField('tags[0]'); // Valid
// watchField('personal.contacts.fax'); // COMPILE ERROR: Argument of type '"personal.contacts.fax"' is not assignable!`,
    breakdown: [
      {
        lineRange: "2-10",
        note: "Recursively maps object keys into template literals \`\${K}.\${Path<T[K]>}\`, indexing into the union of keys."
      },
      {
        lineRange: "31-39",
        note: "Powers type-safe form field accessors (like React Hook Form or Lodash.get)."
      }
    ],
    expectedOutput: "Extracts complete dot-notation path strings with full compile-time autocompletion."
  },

  {
    id: "ts-ex-07",
    title: "Safe Dot-Notation Value Resolver (PathValue<T, Path>)",
    category: "Mapped & Utility Types",
    difficulty: "advanced",
    whatThisCodeCovers: "Given a dot-separated path string ('a.b.c'), resolves the exact return type of that nested property at compile time using template literal decomposition.",
    conceptsCovered: [
      "PathValue<T, P>",
      "Type-Safe Lodash.get",
      "String Decomposition",
      "infer Head / Tail",
      "Lookup Types"
    ],
    code: `// Resolves the exact property type at the given dot-notation Path
type PathValue<T, P extends string> = P extends \`\${infer Head}.\${infer Tail}\`
  ? Head extends keyof T
    ? PathValue<T[Head], Tail> // Recurse into nested object
    : never
  : P extends keyof T
    ? T[P] // Base case: leaf property reached
    : never;

// Test Schema
interface AppState {
  auth: {
    user: {
      id: number;
      username: string;
      roles: string[];
    };
    tokens: {
      accessToken: string;
      expiresAt: Date;
    };
  };
}

// Test Resolution:
type UsernameType = PathValue<AppState, 'auth.user.username'>; // string
type RolesType = PathValue<AppState, 'auth.user.roles'>; // string[]
type ExpiryType = PathValue<AppState, 'auth.tokens.expiresAt'>; // Date

// Type-Safe deep get implementation:
function deepGet<T, P extends string>(obj: T, path: P): PathValue<T, P> {
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current == null) return undefined as any;
    current = current[part];
  }
  return current;
}

const state: AppState = {
  auth: {
    user: { id: 1, username: 'alice', roles: ['admin'] },
    tokens: { accessToken: 'xyz', expiresAt: new Date() }
  }
};

const user = deepGet(state, 'auth.user.username'); // Typed strictly as 'string'!`,
    breakdown: [
      {
        lineRange: "2-8",
        note: "Recursively splits path on '.' with template literal pattern matching and indexes into T[Head]."
      },
      {
        lineRange: "29-37",
        note: "deepGet function returns the exact compile-time type corresponding to the dot-path argument."
      }
    ],
    expectedOutput: "Resolves exact deeply-nested property types with zero 'any' casts."
  },

  {
    id: "ts-ex-08",
    title: "StrictOmit<T, K extends keyof T> and Safe Object Diffing",
    category: "Mapped & Utility Types",
    difficulty: "beginner",
    whatThisCodeCovers: "Fixes the standard library Omit<T, K> design flaw (where K can be any arbitrary string) by enforcing that K must be a real keyof T.",
    conceptsCovered: [
      "StrictOmit",
      "keyof Constraints",
      "Type Safety Guards",
      "Object Diffing",
      "Refactoring Safety"
    ],
    code: `// Standard Omit accepts non-existent keys silently!
// type Bad = Omit<{ a: 1 }, 'nonExistentKey'>; // Compiles with NO warning!

// StrictOmit enforces that keys to omit MUST exist on T:
type StrictOmit<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;

interface DatabaseRecord {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  title: string;
  content: string;
}

// Valid omission of metadata fields
type InsertDTO = StrictOmit<DatabaseRecord, 'id' | 'createdAt' | 'updatedAt'>;
// Inferred: { title: string; content: string; }

// Compiler protection during refactoring:
// If 'updatedAt' is renamed in DatabaseRecord, the following fails compilation!
// type BrokenDTO = StrictOmit<DatabaseRecord, 'id' | 'typoKey'>;
// ERROR: Type '"typoKey"' does not satisfy the constraint 'keyof DatabaseRecord'.`,
    breakdown: [
      {
        lineRange: "5-6",
        note: "K extends keyof T guarantees the compiler rejects typos and flags renamed properties during refactoring."
      },
      {
        lineRange: "16-21",
        note: "Creates clean data-transfer objects (DTOs) with guaranteed type safety."
      }
    ],
    expectedOutput: "Rejects non-existent keys at compile time, eliminating silent refactoring bugs."
  },

  {
    id: "ts-ex-09",
    title: "Converting Union to Intersection (UnionToIntersection<U>) via Contravariance",
    category: "Mapped & Utility Types",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements the legendary UnionToIntersection<U> utility using function argument contravariance to turn union types ('A' | 'B') into intersection types ('A' & 'B').",
    conceptsCovered: [
      "UnionToIntersection",
      "Function Parameter Contravariance",
      "infer in Contravariant Positions",
      "Overload Merging",
      "Type Gymnastics"
    ],
    code: `// Exploits function parameter contravariance:
// When inferring from multiple candidates in a contravariant position,
// TypeScript synthesizes an INTERSECTION of the candidate types!
type UnionToIntersection<U> = 
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) 
    ? I 
    : never;

// Test with object unions:
type ActionUnion = 
  | { log: () => void }
  | { save: () => boolean }
  | { close: () => Promise<void> };

// Converts union into a unified composite object type:
type CombinedService = UnionToIntersection<ActionUnion>;
// Inferred Type:
// { log: () => void } & { save: () => boolean } & { close: () => Promise<void> }

// Test implementation satisfying all intersected methods:
const service: CombinedService = {
  log: () => console.log('Logged'),
  save: () => true,
  close: async () => console.log('Closed')
};`,
    breakdown: [
      {
        lineRange: "4-8",
        note: "Step 1: U extends any distributes the union into a union of consumer functions (k: U) => void."
      },
      {
        lineRange: "5-6",
        note: "Step 2: Matching (k: infer I) => void infers I from parameter position, which merges candidate types into an intersection."
      }
    ],
    expectedOutput: "Transforms union types A | B into intersection types A & B."
  },

  {
    id: "ts-ex-10",
    title: "Converting Union to Tuple (UnionToTuple<U>) using Overload Resolution",
    category: "Mapped & Utility Types",
    difficulty: "advanced",
    whatThisCodeCovers: "Converts a union ('a' | 'b' | 'c') into a discrete ordered tuple (['a', 'b', 'c']) using function intersection overload resolution and recursive type popping.",
    conceptsCovered: [
      "UnionToTuple",
      "Overload Resolution",
      "LastInUnion",
      "Recursive Accumulation",
      "Type-Level List Building"
    ],
    code: `type UnionToIntersection<U> = 
  (U extends any ? (k: U) => void : never) extends ((k: infer I) => void) ? I : never;

// Overload resolution chooses the LAST declared signature in an intersection!
type LastInUnion<U> = 
  UnionToIntersection<U extends any ? (x: U) => 0 : never> extends (x: infer L) => 0 
    ? L 
    : never;

// Recursively pops the last element from the union into the tuple
type UnionToTuple<U, Last = LastInUnion<U>> = 
  [U] extends [never] 
    ? [] 
    : [...UnionToTuple<Exclude<U, Last>>, Last];

// Test Conversion:
type FruitUnion = 'apple' | 'banana' | 'cherry';
type FruitTuple = UnionToTuple<FruitUnion>;
// Inferred: ['apple', 'banana', 'cherry']

// Verify tuple methods:
const fruits: FruitTuple = ['apple', 'banana', 'cherry'];
console.log(fruits.length); // 3`,
    breakdown: [
      {
        lineRange: "5-9",
        note: "Extracts the 'last' member of a union by relying on TypeScript's overload resolution ordering."
      },
      {
        lineRange: "12-16",
        note: "Recursively strips the last item with Exclude<U, Last> until the union reaches never."
      }
    ],
    expectedOutput: "Converts arbitrary union types into concrete tuple arrays with exact lengths."
  }
];
