module.exports = [
  {
    id: "ts-ex-31",
    title: "Strongly-Typed Currying Function Type (Curry<F>)",
    category: "Functional Programming",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a Curry<F> utility type that recursively transforms multi-argument functions into single-argument chained curried functions with full argument and return type preservation.",
    conceptsCovered: [
      "Curry<F>",
      "Higher-Order Functions",
      "Variadic Tuple Splitting",
      "Partial Application",
      "Functional TypeScript"
    ],
    code: `// Recursively transforms a multi-argument function into a curried function
type Curry<F> = F extends (...args: infer Args) => infer Return
  ? Args extends [infer First, ...infer Rest]
    ? Rest extends []
      ? (arg: First) => Return
      : (arg: First) => Curry<(...args: Rest) => Return>
    : () => Return
  : never;

// Implementation of curry runtime helper
function curry<F extends (...args: any[]) => any>(fn: F): Curry<F> {
  return function curried(...args: any[]): any {
    if (args.length >= fn.length) {
      return fn(...args);
    }
    return (...nextArgs: any[]) => curried(...args, ...nextArgs);
  } as Curry<F>;
}

// Multi-argument function:
const add3 = (a: number, b: string, c: boolean) => \`\${a}-\${b}-\${c}\`;

const curriedAdd = curry(add3);

// Full type safety across every curried invocation step:
const step1 = curriedAdd(10); // (arg: string) => (arg: boolean) => string
const step2 = step1('test');  // (arg: boolean) => string
const finalResult = step2(true); // string

console.log(finalResult); // "10-test-true"`,
    breakdown: [
      {
        lineRange: "2-8",
        note: "Curry decomposes Args into [First, ...Rest], returning (arg: First) => Curry<Rest>."
      },
      {
        lineRange: "11-18",
        note: "Runtime curry wrapper checks args.length against fn.length, returning partially applied functions."
      }
    ],
    expectedOutput: "Curries multi-argument functions with full type inference at every execution step."
  },

  {
    id: "ts-ex-32",
    title: "Strongly-Typed Event Emitter (TypedEventEmitter<Events>)",
    category: "Enterprise Generics",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds an event emitter interface where event names and listener argument payloads are strictly checked against an event mapping schema.",
    conceptsCovered: [
      "TypedEventEmitter",
      "Event Mapping Schema",
      "keyof Events",
      "Strongly-Typed Callbacks",
      "Publish/Subscribe"
    ],
    code: `interface EventMap {
  'user:login': { userId: string; timestamp: Date };
  'order:placed': { orderId: string; amount: number; items: string[] };
  'app:shutdown': void;
}

class TypedEventEmitter<TEvents extends Record<string, any>> {
  private listeners: Map<keyof TEvents, Set<Function>> = new Map();

  on<K extends keyof TEvents>(
    event: K,
    listener: (payload: TEvents[K]) => void
  ): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    // Return unsubscribe function
    return () => this.listeners.get(event)?.delete(listener);
  }

  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    this.listeners.get(event)?.forEach(fn => fn(payload));
  }
}

const emitter = new TypedEventEmitter<EventMap>();

// Type-Safe subscription: payload has exact type { userId: string, timestamp: Date }
const unsubscribe = emitter.on('user:login', (data) => {
  console.log(\`User \${data.userId} logged in at \${data.timestamp.toISOString()}\`);
});

// Type-Safe emit: payload must match { orderId: string, amount: number, items: string[] }
emitter.emit('order:placed', {
  orderId: 'ord_100',
  amount: 250,
  items: ['laptop', 'mouse']
});

// Compiler prevents typos:
// emitter.emit('user:logout', {}); // COMPILE ERROR: 'user:logout' does not exist in EventMap!`,
    breakdown: [
      {
        lineRange: "7-27",
        note: "K extends keyof TEvents links the event name directly to its corresponding payload schema TEvents[K]."
      },
      {
        lineRange: "31-43",
        note: "Provides autocompletion for event names and strongly types listener payload arguments."
      }
    ],
    expectedOutput: "Ensures 100% type safety for pub/sub events with zero string typos or wrong payloads."
  },

  {
    id: "ts-ex-33",
    title: "Strongly-Typed Finite State Machine (FSM) Transitions",
    category: "Enterprise Generics",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a Finite State Machine transition map type enforcing valid state transitions (e.g. 'idle' can transition to 'loading', but not directly to 'success').",
    conceptsCovered: [
      "State Machines (FSM)",
      "Transition Validation",
      "Lookup Types",
      "Discriminated States",
      "Invalid State Prevention"
    ],
    code: `// Define state transitions contract: { [CurrentState]: AllowedNextStates }
type StateTransitions = {
  idle: 'loading';
  loading: 'success' | 'error';
  success: 'idle';
  error: 'idle' | 'loading';
};

type State = keyof StateTransitions;

class StateMachine<TTransitions extends Record<string, string>> {
  private currentState: keyof TTransitions;

  constructor(initialState: keyof TTransitions) {
    this.currentState = initialState;
  }

  getState(): keyof TTransitions {
    return this.currentState;
  }

  // Next state MUST be an allowed transition for the current state!
  transition<Next extends TTransitions[typeof this.currentState]>(nextState: Next): void {
    console.log(\`Transitioned from \${String(this.currentState)} -> \${String(nextState)}\`);
    this.currentState = nextState as any;
  }
}

const fsm = new StateMachine<StateTransitions>('idle');

fsm.transition('loading'); // OK! idle -> loading is valid
fsm.transition('success'); // OK! loading -> success is valid
fsm.transition('idle');    // OK! success -> idle is valid

// Compiler rejects illegal transitions!
// fsm.transition('success'); // COMPILE ERROR: idle cannot transition directly to success!`,
    breakdown: [
      {
        lineRange: "2-7",
        note: "StateTransitions maps each state to a union of allowable next states."
      },
      {
        lineRange: "21-25",
        note: "Generic transition method constrains nextState to TTransitions[CurrentState]."
      }
    ],
    expectedOutput: "Enforces legal state machine transitions at compile time, eliminating invalid runtime states."
  },

  {
    id: "ts-ex-34",
    title: "Type-Safe Pipe and Compose (pipe(f1, f2, f3))",
    category: "Functional Programming",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements strongly-typed pipe and compose functions chaining arbitrary transformation functions while guaranteeing output-to-input type matching.",
    conceptsCovered: [
      "pipe / compose",
      "Function Chaining",
      "Overload Signatures",
      "Sequential Type Propagation",
      "Point-Free Programming"
    ],
    code: `// Strongly typed pipe function with 4-stage overloads
function pipe<A>(val: A): A;
function pipe<A, B>(val: A, fn1: (arg: A) => B): B;
function pipe<A, B, C>(val: A, fn1: (arg: A) => B, fn2: (arg: B) => C): C;
function pipe<A, B, C, D>(val: A, fn1: (arg: A) => B, fn2: (arg: B) => C, fn3: (arg: C) => D): D;
function pipe(initialValue: any, ...fns: Function[]): any {
  return fns.reduce((acc, fn) => fn(acc), initialValue);
}

// Transformation functions
const double = (n: number) => n * 2;
const numToString = (n: number) => \`Result: \${n}\`;
const toUpper = (s: string) => s.toUpperCase();

// Chained execution:
const result = pipe(
  5,            // number
  double,       // 5 -> 10 (number)
  numToString,  // 10 -> "Result: 10" (string)
  toUpper       // "Result: 10" -> "RESULT: 10" (string)
);

console.log(result); // "RESULT: 10"

// Type mismatch in chain caught at compile time!
// pipe(5, toUpper); // COMPILE ERROR: Argument of type 'number' is not assignable to 'string'`,
    breakdown: [
      {
        lineRange: "2-7",
        note: "Uses TypeScript function overloads to enforce that fn(N)'s return matches fn(N+1)'s input."
      },
      {
        lineRange: "16-24",
        note: "Executes pipeline with automatic type inference through all transformation stages."
      }
    ],
    expectedOutput: "Chains functions with compile-time type verification across all pipeline steps."
  },

  {
    id: "ts-ex-35",
    title: "Strongly-Typed Builder Pattern with Fluent Method Chaining",
    category: "Enterprise Generics",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a type-safe query builder that tracks configured parameters at compile time and prevents calling .execute() until all mandatory fields are configured.",
    conceptsCovered: [
      "Builder Pattern",
      "Type-Level State Tracking",
      "Phantom Types",
      "Fluent Interface",
      "Compile-Time Build Safety"
    ],
    code: `interface RequestConfig {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
}

// Builder tracking which required properties have been configured
class RequestBuilder<Configured extends Partial<RequestConfig> = {}> {
  private config: Partial<RequestConfig> = {};

  setUrl(url: string): RequestBuilder<Configured & { url: string }> {
    this.config.url = url;
    return this as any;
  }

  setMethod(method: 'GET' | 'POST'): RequestBuilder<Configured & { method: 'GET' | 'POST' }> {
    this.config.method = method;
    return this as any;
  }

  setHeaders(headers: Record<string, string>): RequestBuilder<Configured & { headers: Record<string, string> }> {
    this.config.headers = headers;
    return this as any;
  }

  // send() is ONLY callable when both 'url' and 'method' have been configured!
  send(this: RequestBuilder<{ url: string; method: 'GET' | 'POST' }>): RequestConfig {
    return this.config as RequestConfig;
  }
}

// Usage:
const validRequest = new RequestBuilder()
  .setUrl('https://api.example.com/users')
  .setMethod('GET')
  .send(); // OK! Both url and method configured.

// Incomplete builder invocation:
// const invalid = new RequestBuilder()
//   .setUrl('https://api.example.com')
//   .send(); // COMPILE ERROR: The 'this' context is not assignable! Missing 'method'!`,
    breakdown: [
      {
        lineRange: "9-27",
        note: "Each setter method returns RequestBuilder<Configured & { field: Type }>, accumulating state."
      },
      {
        lineRange: "29-32",
        note: "The 'this' parameter type constraint on send() enforces that required fields must be present."
      }
    ],
    expectedOutput: "Blocks calling .send() or .build() until all mandatory properties are configured."
  },

  {
    id: "ts-ex-36",
    title: "Nominal Typing with Brand Types (UserId, OrderId, CurrencyAmount)",
    category: "Type System Theory",
    difficulty: "intermediate",
    whatThisCodeCovers: "Creates nominal branded types for IDs and money amounts, preventing accidental cross-assignment of primitive strings or numbers.",
    conceptsCovered: [
      "Brand Types",
      "Nominal Typing",
      "unique symbol",
      "Domain-Driven Design",
      "Primitive Obsession Defense"
    ],
    code: `declare const __brand: unique symbol;
type Brand<T, TBrand extends string> = T & { readonly [__brand]: TBrand };

// Domain Types
type UserId = Brand<string, 'UserId'>;
type OrderId = Brand<string, 'OrderId'>;
type USDDollars = Brand<number, 'USD'>;
type EuroCents = Brand<number, 'EUR_CENTS'>;

// Factory constructor helpers
const createUserId = (id: string): UserId => id as UserId;
const createOrderId = (id: string): OrderId => id as OrderId;
const usd = (amount: number): USDDollars => amount as USDDollars;

function chargeUser(userId: UserId, orderId: OrderId, amount: USDDollars) {
  console.log(\`Charging user \${userId} for order \${orderId}: $\${amount}\`);
}

const user = createUserId('usr_101');
const order = createOrderId('ord_999');
const price = usd(49.99);

// Valid invocation:
chargeUser(user, order, price);

// ACCIDENTAL SWAP CAUGHT AT COMPILE TIME!
// chargeUser(order, user, price);
// ERROR: Argument of type 'OrderId' is not assignable to parameter of type 'UserId'.

// CURRENCY MIX-UP CAUGHT AT COMPILE TIME!
const eur = 50 as EuroCents;
// chargeUser(user, order, eur);
// ERROR: Argument of type 'EuroCents' is not assignable to parameter of type 'USDDollars'.`,
    breakdown: [
      {
        lineRange: "1-8",
        note: "Brand<T, TBrand> uses an un-instantiable unique symbol to forge nominal identity onto primitives."
      },
      {
        lineRange: "24-34",
        note: "Compiler prevents swapping parameters of the same primitive type (e.g. order ID for user ID)."
      }
    ],
    expectedOutput: "Prevents accidental parameter mixing of structurally identical strings and numbers."
  },

  {
    id: "ts-ex-37",
    title: "Exhaustive Pattern Matching (exhaustiveCheck(val: never))",
    category: "Type Narrowing",
    difficulty: "beginner",
    whatThisCodeCovers: "Uses the never type and exhaustiveCheck function in default switch branches to guarantee all discriminated union variants are handled.",
    conceptsCovered: [
      "Exhaustive Checking",
      "never Type",
      "Discriminated Unions",
      "Compile-Time Switch Validation",
      "Refactoring Protection"
    ],
    code: `type PaymentMethod = 
  | { type: 'credit_card'; cardNumber: string }
  | { type: 'paypal'; email: string }
  | { type: 'crypto'; walletAddress: string };

// Exhaustiveness helper
function assertUnreachable(x: never): never {
  throw new Error(\`Unhandled union variant: \${JSON.stringify(x)}\`);
}

function processPayment(payment: PaymentMethod): string {
  switch (payment.type) {
    case 'credit_card':
      return \`Charging Card: \${payment.cardNumber}\`;
    case 'paypal':
      return \`Redirecting to PayPal: \${payment.email}\`;
    case 'crypto':
      return \`Sending crypto invoice to: \${payment.walletAddress}\`;
    default:
      // If a new payment type (e.g. 'apple_pay') is added to PaymentMethod,
      // TypeScript throws a compile-time error HERE because 'x' is not 'never'!
      return assertUnreachable(payment);
  }
}`,
    breakdown: [
      {
        lineRange: "7-9",
        note: "assertUnreachable expects type never; throws runtime exception if somehow executed."
      },
      {
        lineRange: "20-23",
        note: "If all union variants are handled, payment in default branch narrows to never; unhandled cases cause compile errors."
      }
    ],
    expectedOutput: "Compiler enforces 100% switch case completeness whenever union variants are added."
  },

  {
    id: "ts-ex-38",
    title: "Type-Safe Redux Action Creator & Reducer Map",
    category: "Functional Programming",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a type-safe action creator and reducer map pattern where reducer functions automatically narrow action payload types based on action.type.",
    conceptsCovered: [
      "Discriminated Union Reducers",
      "Action Creators",
      "Type Narrowing",
      "Reducer Map",
      "State Updates"
    ],
    code: `// Action definitions
type AppAction = 
  | { type: 'COUNTER_INCREMENT'; payload: { step: number } }
  | { type: 'COUNTER_RESET' }
  | { type: 'SET_USER'; payload: { name: string; email: string } };

interface AppState {
  count: number;
  user: { name: string; email: string } | null;
}

const initialState: AppState = { count: 0, user: null };

function appReducer(state: AppState = initialState, action: AppAction): AppState {
  switch (action.type) {
    case 'COUNTER_INCREMENT':
      // action.payload is narrowed to { step: number }
      return { ...state, count: state.count + action.payload.step };
    
    case 'COUNTER_RESET':
      // action has no payload
      return { ...state, count: 0 };
    
    case 'SET_USER':
      // action.payload is narrowed to { name: string; email: string }
      return { ...state, user: action.payload };
    
    default:
      return state;
  }
}

// Type-Safe Action Creator helper
function createAction<T extends AppAction['type']>(
  type: T,
  ...args: Extract<AppAction, { type: T }> extends { payload: infer P } ? [payload: P] : []
) {
  return { type, ...(args[0] !== undefined ? { payload: args[0] } : {}) };
}`,
    breakdown: [
      {
        lineRange: "2-5",
        note: "Discriminated union AppAction defines strict payloads per action type."
      },
      {
        lineRange: "14-27",
        note: "Switch statement automatically narrows action.payload inside each case block."
      }
    ],
    expectedOutput: "Narrows Redux action payloads in reducers with zero manual type assertions."
  },

  {
    id: "ts-ex-39",
    title: "satisfies Operator vs Type Annotation vs as const",
    category: "Type Inference & Modern TS",
    difficulty: "intermediate",
    whatThisCodeCovers: "Contrasts the TypeScript 4.9 satisfies operator with traditional type annotations and as const assertions to explain type preservation without widening.",
    conceptsCovered: [
      "satisfies Operator",
      "Type Annotation Widening",
      "as const Literal Retention",
      "Validation Without Widening",
      "TypeScript 4.9+"
    ],
    code: `type Colors = 'red' | 'green' | 'blue';
type ColorRGB = [r: number, g: number, b: number];

// APPROACH 1: Type Annotation (Widening problem!)
const paletteAnnotation: Record<Colors, string | ColorRGB> = {
  red: [255, 0, 0],
  green: '#00ff00',
  blue: [0, 0, 255]
};
// paletteAnnotation.green.toLowerCase(); // COMPILE ERROR! green is typed as 'string | ColorRGB'!

// APPROACH 2: satisfies Operator (Validation + Precision!)
const paletteSatisfies = {
  red: [255, 0, 0],
  green: '#00ff00',
  blue: [0, 0, 255]
} satisfies Record<Colors, string | ColorRGB>;

// Exact types preserved while still validating conformity!
paletteSatisfies.green.toLowerCase(); // OK! Compiler knows green is string!
paletteSatisfies.red.map(n => n * 2); // OK! Compiler knows red is ColorRGB tuple!

// Catches typos in keys while preserving property types:
// const typo = { purp: '#800080' } satisfies Record<Colors, string | ColorRGB>;
// ERROR: Object literal may only specify known properties, and 'purp' does not exist in 'Colors'.`,
    breakdown: [
      {
        lineRange: "5-10",
        note: "Type annotations widen properties to the union type string | ColorRGB, losing specific autocomplete."
      },
      {
        lineRange: "14-24",
        note: "satisfies verifies that the object conforms to the contract while preserving exact literal types."
      }
    ],
    expectedOutput: "satisfies validates structural conformity without widening specific property types."
  },

  {
    id: "ts-ex-40",
    title: "<const T> Type Parameters for Automatic Readonly Literals",
    category: "Type Inference & Modern TS",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses TypeScript 5.0 const type parameters to automatically infer exact readonly tuple and object literals without requiring call-site as const assertions.",
    conceptsCovered: [
      "const Type Parameters",
      "TypeScript 5.0",
      "Literal Inference",
      "Readonly Tuples",
      "Cleaner Call-Sites"
    ],
    code: `// BEFORE TS 5.0: Call-site had to append 'as const'
function oldFormat<T extends readonly string[]>(items: T): T {
  return items;
}
const a = oldFormat(['admin', 'editor']); // Inferred as string[]!
const b = oldFormat(['admin', 'editor'] as const); // Required 'as const' to get literal tuple

// TS 5.0: <const T> automatically infers literal readonly structures!
function newFormat<const T extends readonly string[]>(items: T): T {
  return items;
}

// Inferred directly as readonly ['admin', 'editor'] without 'as const'!
const clean = newFormat(['admin', 'editor']);

// Useful for configuration builders:
function buildRoutes<const TRoutes extends readonly { path: string; method: string }[]>(routes: TRoutes) {
  return routes;
}

const config = buildRoutes([
  { path: '/users', method: 'GET' },
  { path: '/orders', method: 'POST' }
]);
// config is inferred with exact string literals: path: '/users', method: 'GET'!`,
    breakdown: [
      {
        lineRange: "9-12",
        note: "Prefixing generic parameter with const (<const T>) instructs compiler to infer narrowest literals."
      },
      {
        lineRange: "21-27",
        note: "Configuration objects retain exact literal types without requiring developers to write 'as const'."
      }
    ],
    expectedOutput: "Infers exact string and tuple literals automatically in generic function arguments."
  },

  {
    id: "ts-ex-41",
    title: "NoInfer<T> to Restrict Generic Inference Sites",
    category: "Type Inference & Modern TS",
    difficulty: "advanced",
    whatThisCodeCovers: "Uses TypeScript 5.4 NoInfer<T> utility to block the compiler from using secondary function arguments as candidates for generic type inference.",
    conceptsCovered: [
      "NoInfer<T>",
      "TypeScript 5.4",
      "Inference Candidates",
      "Default Values",
      "State Machines"
    ],
    code: `// Scenario: selectColors accepts an array of allowed colors and an initial default color.
// We want T to be inferred EXCLUSIVELY from allowedColors, NOT from defaultColor!

// WITHOUT NoInfer:
function createSelectorBad<C extends string>(allowed: C[], defaultColor: C) {
  return { allowed, defaultColor };
}
// BUG: TypeScript infers C as 'red' | 'blue' | 'yellow' (yellow gets added to allowed union!)
const bad = createSelectorBad(['red', 'blue'], 'yellow'); // Compiles without error!

// WITH NoInfer<T> (TS 5.4+):
function createSelector<C extends string>(allowed: C[], defaultColor: NoInfer<C>) {
  return { allowed, defaultColor };
}

const good = createSelector(['red', 'blue'], 'red'); // OK!

// Now TypeScript flags 'yellow' as invalid because C was inferred solely from the first argument!
// const caught = createSelector(['red', 'blue'], 'yellow');
// COMPILE ERROR: Argument of type '"yellow"' is not assignable to parameter of type '"red" | "blue"'!`,
    breakdown: [
      {
        lineRange: "5-9",
        note: "Without NoInfer, TypeScript widens generic C to include values from all argument sites."
      },
      {
        lineRange: "12-15",
        note: "NoInfer<C> prevents defaultColor from contributing to type inference for C."
      }
    ],
    expectedOutput: "Restricts generic inference to target arguments, preventing unwanted union widening."
  }
];
