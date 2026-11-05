module.exports = [
  {
    id: "ts-ex-42",
    title: "User-Defined Type Guards (isUser(data: unknown): data is User)",
    category: "Type Narrowing & Guards",
    difficulty: "beginner",
    whatThisCodeCovers: "Builds a custom User-Defined Type Guard function with the 'value is Type' predicate to safely validate untrusted API data without any type assertions.",
    conceptsCovered: [
      "User-Defined Type Guards",
      "data is Type Predicate",
      "Type Narrowing",
      "Safe Runtime Validation",
      "unknown vs any"
    ],
    code: `interface User {
  id: string;
  name: string;
  email: string;
  isAdmin?: boolean;
}

// Type Guard asserting unknown data matches User interface
function isUser(data: unknown): data is User {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  const candidate = data as Record<string, unknown>;

  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.email === 'string' &&
    (candidate.isAdmin === undefined || typeof candidate.isAdmin === 'boolean')
  );
}

// Usage in API handler processing untrusted JSON
function handleIncomingPayload(rawPayload: unknown) {
  if (isUser(rawPayload)) {
    // Within this block, rawPayload is narrowed 100% safely to User!
    console.log(\`Verified User: \${rawPayload.name} <\${rawPayload.email}>\`);
  } else {
    console.error('Payload does not conform to User schema');
  }
}`,
    breakdown: [
      {
        lineRange: "8-20",
        note: "The return type 'data is User' instructs the compiler to narrow data in truthy branches."
      },
      {
        lineRange: "24-28",
        note: "Inside the if (isUser(rawPayload)) block, rawPayload provides full autocomplete as User."
      }
    ],
    expectedOutput: "Narrows untrusted unknown data safely into strong types using boolean runtime checks."
  },

  {
    id: "ts-ex-43",
    title: "Assertion Functions (asserts condition and asserts value is Type)",
    category: "Type Narrowing & Guards",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses TypeScript assertion functions (asserts condition and asserts value is Type) to throw errors when invariants fail, narrowing types for the remainder of the function scope.",
    conceptsCovered: [
      "Assertion Functions",
      "asserts condition",
      "asserts val is T",
      "Scope-Wide Narrowing",
      "Invariant Enforcement"
    ],
    code: `// 1. General assertion checking a truthy condition
function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(\`Assertion failed: \${message}\`);
  }
}

// 2. Type-narrowing assertion
function assertIsString(val: unknown): asserts val is string {
  if (typeof val !== 'string') {
    throw new TypeError(\`Expected string, received \${typeof val}\`);
  }
}

function processUserData(input: unknown) {
  // Before assertion: input is 'unknown'
  assert(input !== null && input !== undefined, 'Input must not be nullish');
  
  // Narrows input:
  assertIsString(input);

  // For the entire remainder of this scope, input is guaranteed to be 'string'!
  console.log('Normalized string:', input.trim().toUpperCase());
}`,
    breakdown: [
      {
        lineRange: "2-6",
        note: "asserts condition narrows truthiness for the remainder of the containing lexical block."
      },
      {
        lineRange: "9-13",
        note: "asserts val is string narrows the variable's type without requiring wrapping in an if-block."
      }
    ],
    expectedOutput: "Eliminates nested if-statements by asserting type validity across the rest of the function scope."
  },

  {
    id: "ts-ex-44",
    title: "Express Request Module Augmentation (req.user, req.tenantId)",
    category: "Module Augmentation",
    difficulty: "intermediate",
    whatThisCodeCovers: "Uses module augmentation to extend Express.Request with custom application properties (user, tenantId, correlationId), providing full type safety in route controllers.",
    conceptsCovered: [
      "declare module 'express'",
      "Module Augmentation",
      "Declaration Merging",
      "Ambient Typings",
      "Express Request Extensions"
    ],
    code: `// File: src/types/express.d.ts
import { Request } from 'express';

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
}

// Augment the express-serve-static-core Request interface
declare module 'express-serve-static-core' {
  interface Request {
    user?: AuthenticatedUser;
    tenantId: string;
    correlationId: string;
  }
}

// File: src/controllers/userController.ts
import express from 'express';
const app = express();

app.get('/api/profile', (req, res) => {
  // Full autocomplete and type-safety for augmented properties!
  const tenant = req.tenantId; // string
  const user = req.user; // AuthenticatedUser | undefined

  if (!user) {
    return res.status(401).send('Unauthorized');
  }

  res.json({ tenant, userEmail: user.email });
});`,
    breakdown: [
      {
        lineRange: "10-16",
        note: "declare module 'express-serve-static-core' merges custom fields into the Express Request interface."
      },
      {
        lineRange: "23-28",
        note: "Route handlers access req.user and req.tenantId without type errors or 'as any' casts."
      }
    ],
    expectedOutput: "Provides compile-time autocomplete for custom middleware properties on Express req."
  },

  {
    id: "ts-ex-45",
    title: "Schema Validation to TypeScript Inference (DIY Zod-like Validator)",
    category: "Type Inference & Modern TS",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a lightweight schema validator from scratch that infers exact TypeScript types directly from runtime schema definitions (like Zod z.infer).",
    conceptsCovered: [
      "Schema Validation",
      "Type Inference from Schema",
      "InferType<T>",
      "Single Source of Truth",
      "Zod-like Architecture"
    ],
    code: `// Schema Builders
type SchemaType<T> = {
  _type: T;
  validate: (val: unknown) => val is T;
};

const z = {
  string: (): SchemaType<string> => ({
    _type: '' as string,
    validate: (val: unknown): val is string => typeof val === 'string'
  }),
  number: (): SchemaType<number> => ({
    _type: 0 as number,
    validate: (val: unknown): val is number => typeof val === 'number'
  }),
  object: <T extends Record<string, SchemaType<any>>>(shape: T): SchemaType<{ [K in keyof T]: T[K]['_type'] }> => ({
    _type: {} as any,
    validate: (val: unknown): val is { [K in keyof T]: T[K]['_type'] } => {
      if (typeof val !== 'object' || val === null) return false;
      const obj = val as Record<string, unknown>;
      return Object.entries(shape).every(([key, schema]) => schema.validate(obj[key]));
    }
  })
};

// Type Inference Helper: Extracts compile-time type from runtime schema
type InferType<T extends SchemaType<any>> = T['_type'];

// 1. Define runtime schema
const UserSchema = z.object({
  id: z.string(),
  age: z.number()
});

// 2. Automatically derive TypeScript type!
type InferredUser = InferType<typeof UserSchema>;
// Inferred: { id: string; age: number; }

const valid: InferredUser = { id: 'u_1', age: 30 }; // 100% Type-Safe!`,
    breakdown: [
      {
        lineRange: "2-5",
        note: "SchemaType carries both runtime validator function and phantom compile-time _type marker."
      },
      {
        lineRange: "24-25",
        note: "InferType<T> extracts the phantom type, eliminating redundant manual interface writing."
      }
    ],
    expectedOutput: "Derives TypeScript types directly from runtime validation schemas with zero type drift."
  },

  {
    id: "ts-ex-46",
    title: "Strongly-Typed Dependency Injection Container Token Registry",
    category: "Enterprise Generics",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a type-safe Dependency Injection (DI) Container where service tokens are bound to specific service interfaces, eliminating type casts during service resolution.",
    conceptsCovered: [
      "Dependency Injection",
      "Token Registry",
      "Type-Safe Service Locator",
      "Symbol Tokens",
      "Awilix / Inversify Typings"
    ],
    code: `// Service Token carrying phantom service type
interface ServiceToken<T> {
  readonly description: string;
  readonly _serviceType: T;
}

function createToken<T>(description: string): ServiceToken<T> {
  return { description } as any;
}

// Service Interfaces
interface DatabaseService {
  query(sql: string): Promise<any[]>;
}
interface MailerService {
  sendMail(to: string, body: string): Promise<void>;
}

// Declare Tokens
const DB_TOKEN = createToken<DatabaseService>('DatabaseService');
const MAILER_TOKEN = createToken<MailerService>('MailerService');

class Container {
  private services = new Map<ServiceToken<any>, any>();

  register<T>(token: ServiceToken<T>, instance: T): void {
    this.services.set(token, instance);
  }

  resolve<T>(token: ServiceToken<T>): T {
    const service = this.services.get(token);
    if (!service) throw new Error(\`Service \${token.description} not registered\`);
    return service;
  }
}

const container = new Container();

container.register(DB_TOKEN, {
  query: async (sql) => ['row_1', 'row_2']
});

// container.resolve(DB_TOKEN) returns strictly typed DatabaseService!
const db = container.resolve(DB_TOKEN);
db.query('SELECT * FROM users'); // Autocomplete works! Zero type casting!`,
    breakdown: [
      {
        lineRange: "2-5",
        note: "ServiceToken<T> binds the target interface to the token via phantom type _serviceType."
      },
      {
        lineRange: "28-35",
        note: "resolve(token) returns T automatically based on the token passed to it."
      }
    ],
    expectedOutput: "Resolves services from DI containers with 100% type safety and zero manual type casts."
  },

  {
    id: "ts-ex-47",
    title: "TC39 Stage 3 Method Decorator with Type Validation",
    category: "Modern TypeScript",
    difficulty: "advanced",
    whatThisCodeCovers: "Implements modern TC39 Stage 3 standard method decorators in TypeScript 5.0 (without legacy experimentalDecorators) to log method execution time.",
    conceptsCovered: [
      "TC39 Stage 3 Decorators",
      "TypeScript 5.0 Decorators",
      "ClassMethodDecoratorContext",
      "Non-Experimental Decorators",
      "Method Wrapping"
    ],
    code: `// Modern TS 5.0 TC39 Stage 3 Method Decorator
function LogExecutionTime<This, Args extends any[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
) {
  const methodName = String(context.name);

  // Return replacement method
  return function (this: This, ...args: Args): Return {
    const start = performance.now();
    console.log(\`[Calling] \${methodName}...\`);
    
    const result = target.call(this, ...args);
    
    const elapsed = performance.now() - start;
    console.log(\`[Completed] \${methodName} took \${elapsed.toFixed(2)}ms\`);
    return result;
  };
}

class InvoiceService {
  @LogExecutionTime
  generateInvoice(invoiceId: string, amount: number): string {
    return \`Invoice \${invoiceId} generated for $\${amount}\`;
  }
}

const service = new InvoiceService();
service.generateInvoice('inv_001', 500);`,
    breakdown: [
      {
        lineRange: "2-5",
        note: "Uses ClassMethodDecoratorContext from standard TS 5.0 library to type the decorated method."
      },
      {
        lineRange: "9-17",
        note: "Intercepts method invocation, calculates execution time, and preserves exact return type."
      }
    ],
    expectedOutput: "Wraps class methods using modern ECMAScript standard decorators without experimental flags."
  },

  {
    id: "ts-ex-48",
    title: "Explicit Resource Management (using & Symbol.dispose)",
    category: "Modern TypeScript",
    difficulty: "intermediate",
    whatThisCodeCovers: "Demonstrates TypeScript 5.2 Explicit Resource Management using the 'using' keyword and Symbol.dispose / Symbol.asyncDispose to automate resource cleanup.",
    conceptsCovered: [
      "using Keyword",
      "Symbol.dispose",
      "TypeScript 5.2",
      "Deterministic Teardown",
      "RAII in JavaScript"
    ],
    code: `// Disposable Database Client implementing Symbol.dispose
class ScopedDbClient implements Disposable {
  constructor(private id: string) {
    console.log(\`[Open] Database connection \${id} acquired\`);
  }

  query(sql: string) {
    return \`Results for \${sql}\`;
  }

  // Invoked automatically when the 'using' block exits!
  [Symbol.dispose]() {
    console.log(\`[Close] Database connection \${this.id} released back to pool cleanly\`);
  }
}

function processTransaction() {
  // 'using' binds resource lifetime strictly to this function block!
  using client = new ScopedDbClient('conn_42');

  console.log(client.query('SELECT * FROM accounts'));

  // When function returns or throws, client[Symbol.dispose]() is GUARANTEED to execute!
}

processTransaction();
// Output:
// [Open] Database connection conn_42 acquired
// Results for SELECT * FROM accounts
// [Close] Database connection conn_42 released back to pool cleanly`,
    breakdown: [
      {
        lineRange: "2-15",
        note: "Implements Disposable interface with [Symbol.dispose]() method for deterministic cleanup."
      },
      {
        lineRange: "17-23",
        note: "using keyword ensures connection release occurs when block scope terminates, avoiding finally blocks."
      }
    ],
    expectedOutput: "Automates resource cleanup (file handles, database clients) on block scope exit."
  },

  {
    id: "ts-ex-49",
    title: "Discriminated Union Message Bus with Narrowing",
    category: "Type Narrowing & Guards",
    difficulty: "intermediate",
    whatThisCodeCovers: "Implements a type-safe message dispatcher where message handlers receive accurately narrowed payload shapes based on a common discriminant key.",
    conceptsCovered: [
      "Discriminated Unions",
      "Common Discriminant",
      "Type Narrowing in Handlers",
      "Message Bus",
      "Tagged Unions"
    ],
    code: `type Message = 
  | { kind: 'TEXT'; content: string; author: string }
  | { kind: 'IMAGE'; url: string; width: number; height: number }
  | { kind: 'AUDIO'; durationSec: number; bitrate: number };

type MessageHandler<K extends Message['kind']> = 
  (msg: Extract<Message, { kind: K }>) => void;

class MessageBus {
  private handlers: { [K in Message['kind']]?: MessageHandler<K> } = {};

  register<K extends Message['kind']>(kind: K, handler: MessageHandler<K>) {
    this.handlers[kind] = handler as any;
  }

  dispatch(msg: Message) {
    const handler = this.handlers[msg.kind];
    if (handler) {
      handler(msg as any);
    }
  }
}

const bus = new MessageBus();

// Handler receives EXACT narrowed type for 'IMAGE'!
bus.register('IMAGE', (img) => {
  console.log(\`Rendering image \${img.url} (\${img.width}x\${img.height})\`);
});

// Handler receives EXACT narrowed type for 'TEXT'!
bus.register('TEXT', (txt) => {
  console.log(\`Message from \${txt.author}: \${txt.content}\`);
});`,
    breakdown: [
      {
        lineRange: "1-4",
        note: "Message defines tagged union with common discriminant 'kind'."
      },
      {
        lineRange: "6-7",
        note: "MessageHandler uses Extract<Message, { kind: K }> to pick the single matching union member."
      }
    ],
    expectedOutput: "Narrows message payloads in event handlers with zero type casting."
  },

  {
    id: "ts-ex-50",
    title: "Dynamic Deep Object Key Renamer via Mapped Type 'as'",
    category: "Mapped & Utility Types",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a PrefixKeys<T, Prefix> utility that prepends a prefix string to all object keys at compile time using mapped type key remapping.",
    conceptsCovered: [
      "PrefixKeys<T, P>",
      "Key Remapping via as",
      "Template Literal Remapping",
      "Deep Object Transformation",
      "Dynamic Key Renaming"
    ],
    code: `// Prepends a prefix to all object property keys
type PrefixKeys<T, Prefix extends string> = {
  [K in keyof T as \`\${Prefix}\${Capitalize<string & K>}\`]: T[K];
};

interface UserEvents {
  click: (x: number, y: number) => void;
  hover: () => void;
  focus: () => void;
}

// Generates { onClick: ..., onHover: ..., onFocus: ... }
type ComponentProps = PrefixKeys<UserEvents, 'on'>;

const props: ComponentProps = {
  onClick: (x, y) => console.log('Clicked at', x, y),
  onHover: () => console.log('Hovered'),
  onFocus: () => console.log('Focused')
};

// Also works for database column prefixing:
interface OrderColumns {
  id: string;
  amount: number;
}
type JoinedColumns = PrefixKeys<OrderColumns, 'order_'>;
// Inferred: { order_Id: string; order_Amount: number; }`,
    breakdown: [
      {
        lineRange: "2-4",
        note: "[K in keyof T as \`\${Prefix}\${Capitalize<string & K>}\`] transforms each key into 'prefixKeyName'."
      },
      {
        lineRange: "12-13",
        note: "Generates event handler props (onClick, onHover) directly from raw event names."
      }
    ],
    expectedOutput: "Transforms object property keys dynamically with prefixes or suffixes."
  },

  {
    id: "ts-ex-51",
    title: "Strongly-Typed RPC / WebSocket Message Protocol Dispatcher",
    category: "Enterprise Generics",
    difficulty: "advanced",
    whatThisCodeCovers: "Defines an RPC contract mapping method names to request and response types, building a typed callRPC client that enforces strict parameter and return typings.",
    conceptsCovered: [
      "RPC Protocol Typing",
      "Request/Response Contract",
      "Promise Return Inference",
      "Type-Safe Client Calls",
      "WebSocket Messaging"
    ],
    code: `interface RpcContract {
  'user.get': {
    request: { userId: string };
    response: { id: string; name: string };
  };
  'order.create': {
    request: { items: string[]; total: number };
    response: { orderId: string; status: 'pending' | 'confirmed' };
  };
}

class TypedRpcClient {
  async call<Method extends keyof RpcContract>(
    method: Method,
    params: RpcContract[Method]['request']
  ): Promise<RpcContract[Method]['response']> {
    console.log(\`Dispatching RPC [\${method}]:\`, params);
    // Simulating network fetch / WebSocket RPC call:
    return {} as any;
  }
}

const client = new TypedRpcClient();

async function demo() {
  // Parameters must match { userId: string }; return type is { id, name }
  const user = await client.call('user.get', { userId: 'usr_42' });
  console.log(user.name); // Fully typed!

  // Parameters must match { items, total }; return type is { orderId, status }
  const order = await client.call('order.create', { items: ['book'], total: 20 });
  console.log(order.orderId, order.status);

  // Compiler catches errors:
  // client.call('user.get', { wrongParam: 123 }); // COMPILE ERROR!
  // client.call('unknown.method', {}); // COMPILE ERROR!
}`,
    breakdown: [
      {
        lineRange: "1-10",
        note: "RpcContract defines request and response interfaces per RPC method name."
      },
      {
        lineRange: "13-17",
        note: "call() method infers exact request params and returns Promise of matching response type."
      }
    ],
    expectedOutput: "Provides full end-to-end type safety for RPC and WebSocket communication protocols."
  },

  {
    id: "ts-ex-52",
    title: "Strongly-Typed Environment Variable Loader with Type Narrowing",
    category: "Enterprise Generics",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds a safe environment variable parser that validates process.env at startup and exports a frozen, non-nullish typed configuration object.",
    conceptsCovered: [
      "Environment Variables",
      "process.env Validation",
      "NonNullable Config",
      "Fail-Fast Startup",
      "Type Narrowing"
    ],
    code: `interface EnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  DATABASE_URL: string;
  ENABLE_METRICS: boolean;
}

function loadEnv(): EnvConfig {
  const getEnv = (key: string): string => {
    const val = process.env[key];
    if (!val) {
      throw new Error(\`FATAL: Missing mandatory environment variable: \${key}\`);
    }
    return val;
  };

  const nodeEnv = process.env.NODE_ENV || 'development';
  if (!['development', 'production', 'test'].includes(nodeEnv)) {
    throw new Error(\`Invalid NODE_ENV: \${nodeEnv}\`);
  }

  return Object.freeze({
    PORT: Number(process.env.PORT) || 3000,
    NODE_ENV: nodeEnv as EnvConfig['NODE_ENV'],
    DATABASE_URL: getEnv('DATABASE_URL'),
    ENABLE_METRICS: process.env.ENABLE_METRICS === 'true'
  });
}

// Export singleton typed config
// const config = loadEnv();
// config.PORT is strictly 'number'; config.NODE_ENV is strictly 'development' | 'production' | 'test'!`,
    breakdown: [
      {
        lineRange: "1-6",
        note: "EnvConfig declares all expected environment variables with exact primitive and union types."
      },
      {
        lineRange: "8-29",
        note: "loadEnv validates variables at process startup and returns a frozen typed configuration object."
      }
    ],
    expectedOutput: "Eliminates string | undefined process.env checks across the entire codebase."
  }
];
