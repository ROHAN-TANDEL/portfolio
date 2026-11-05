module.exports = [
  {
    id: "ts-ex-11",
    title: "SnakeToCamel<S> and CamelToSnake<S> String Case Converters",
    category: "Template Literal Types",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs recursive string literal utilities that transform snake_case database identifiers to camelCase JavaScript properties and vice versa.",
    conceptsCovered: [
      "Template Literal Types",
      "SnakeToCamel",
      "CamelToSnake",
      "Capitalize & Uncapitalize",
      "Recursive String Parsing"
    ],
    code: `// Convert snake_case to camelCase
type SnakeToCamel<S extends string> = S extends \`\${infer Head}_\${infer Tail}\`
  ? \`\${Head}\${Capitalize<SnakeToCamel<Tail>>}\`
  : S;

// Convert camelCase to snake_case
type CamelToSnake<S extends string> = S extends \`\${infer Char}\${infer Rest}\`
  ? Char extends Lowercase<Char>
    ? \`\${Char}\${CamelToSnake<Rest>}\`
    : \`_\${Lowercase<Char>}\${CamelToSnake<Rest>}\`
  : S;

// Test Type Conversions:
type A = SnakeToCamel<'user_billing_profile_id'>; // "userBillingProfileId"
type B = CamelToSnake<'userBillingProfileId'>; // "_user_billing_profile_id" (or stripped leading underscore)

// Mapped object key transformer:
type CamelizeKeys<T> = {
  [K in keyof T as K extends string ? SnakeToCamel<K> : K]: T[K];
};

interface SqlRow {
  first_name: string;
  last_name: string;
  is_verified: boolean;
}

type DomainUser = CamelizeKeys<SqlRow>;
// Inferred: { firstName: string; lastName: string; isVerified: boolean; }`,
    breakdown: [
      {
        lineRange: "2-5",
        note: "SnakeToCamel matches on '_' delimiter and recursively capitalizes each following word segment."
      },
      {
        lineRange: "8-13",
        note: "CamelToSnake compares each char against its Lowercase version to detect uppercase boundaries."
      },
      {
        lineRange: "20-22",
        note: "CamelizeKeys applies case conversion across all keys of an SQL database row automatically."
      }
    ],
    expectedOutput: "Translates string literal types between camelCase and snake_case for ORMs and API gateways."
  },

  {
    id: "ts-ex-12",
    title: "KebabCase<S> String Converter with Word Boundary Detection",
    category: "Template Literal Types",
    difficulty: "intermediate",
    whatThisCodeCovers: "Transforms camelCase or PascalCase component names into HTML/CSS kebab-case identifiers ('UserProfileWidget' -> 'user-profile-widget').",
    conceptsCovered: [
      "KebabCase",
      "PascalCase Parsing",
      "CSS Class Generators",
      "Uncapitalize",
      "Recursive String Splitting"
    ],
    code: `// Helper to uncapitalize first letter then recursively replace capital letters with '-letter'
type KebabCase<S extends string> = S extends \`\${infer First}\${infer Rest}\`
  ? Rest extends Uncapitalize<Rest>
    ? \`\${Lowercase<First>}\${KebabCase<Rest>}\`
    : \`\${Lowercase<First>}-\${KebabCase<Uncapitalize<Rest>>}\`
  : S;

// Test Conversions:
type K1 = KebabCase<'UserProfileCard'>; // "user-profile-card"
type K2 = KebabCase<'datePickerDropdownMenu'>; // "date-picker-dropdown-menu"
type K3 = KebabCase<'SimpleButton'>; // "simple-button"

// Type-Safe Web Component Registration:
function registerCustomElement<Name extends string>(
  componentName: Name,
  tagName: KebabCase<Name>
) {
  console.log(\`Registered <\${tagName}> for \${componentName}\`);
}

// tagName is strictly enforced to match the kebab-case transform of the component name!
registerCustomElement('UserProfileCard', 'user-profile-card'); // OK!
// registerCustomElement('UserProfileCard', 'user_profile_card'); // COMPILE ERROR!`,
    breakdown: [
      {
        lineRange: "2-7",
        note: "Inspects adjacent character transitions to detect uppercase boundaries and injects hyphens."
      },
      {
        lineRange: "15-20",
        note: "Guarantees that custom element tag names match the exact kebab-case format of their classes."
      }
    ],
    expectedOutput: "Automatically validates HTML tag names and CSS classes against PascalCase class names."
  },

  {
    id: "ts-ex-13",
    title: "Trim<S>, TrimLeft<S>, and TrimRight<S> String Trimmers",
    category: "Template Literal Types",
    difficulty: "intermediate",
    whatThisCodeCovers: "Constructs compiler-level whitespace trimmers stripping leading and trailing spaces, tabs, and newlines from string literal types.",
    conceptsCovered: [
      "Trim",
      "TrimLeft / TrimRight",
      "Whitespace Union (' ' | '\\t' | '\\n')",
      "Tail-Recursion in Strings",
      "String Sanitization"
    ],
    code: `type WhiteSpace = ' ' | '\\t' | '\\n';

// Strips leading whitespace
type TrimLeft<S extends string> = S extends \`\${WhiteSpace}\${infer Rest}\`
  ? TrimLeft<Rest>
  : S;

// Strips trailing whitespace
type TrimRight<S extends string> = S extends \`\${infer Rest}\${WhiteSpace}\`
  ? TrimRight<Rest>
  : S;

// Strips both leading and trailing whitespace
type Trim<S extends string> = TrimRight<TrimLeft<S>>;

// Test Trimming:
type Clean1 = Trim<'   hello world   '>; // "hello world"
type Clean2 = Trim<'\\n\\t  system_status  \\n'>; // "system_status"

// Compile-Time Non-Empty Input Guard:
type DisallowEmptyString<T extends string> = Trim<T> extends ''
  ? never
  : T;

function setTag<T extends string>(tag: DisallowEmptyString<T>) {
  return tag;
}

setTag('production'); // OK!
// setTag('   '); // COMPILE ERROR: Argument of type 'string' is not assignable to 'never'!`,
    breakdown: [
      {
        lineRange: "1-15",
        note: "Defines WhiteSpace union and recursively consumes leading and trailing whitespace tokens."
      },
      {
        lineRange: "22-26",
        note: "Combines Trim with conditional types to reject whitespace-only strings at compile time."
      }
    ],
    expectedOutput: "Strips whitespace and prevents empty strings from passing compile-time type assertions."
  },

  {
    id: "ts-ex-14",
    title: "Split<S, Delimiter> and Join<Tuples, Delimiter>",
    category: "Template Literal Types",
    difficulty: "intermediate",
    whatThisCodeCovers: "Builds compile-time string Split and Join utilities that convert delimited strings into tuples of literals and tuples into joined strings.",
    conceptsCovered: [
      "Split<S, D>",
      "Join<T, D>",
      "Delimiter Parsing",
      "String to Tuple Conversion",
      "Tuple to String Conversion"
    ],
    code: `// Splits a string into a tuple of substrings by delimiter
type Split<S extends string, Delimiter extends string> = 
  S extends \`\${infer Head}\${Delimiter}\${infer Tail}\`
    ? [Head, ...Split<Tail, Delimiter>]
    : [S];

// Joins a tuple of string literals with a delimiter
type Join<T extends (string | number)[], Delimiter extends string> = 
  T extends []
    ? ''
    : T extends [infer Single extends string | number]
      ? \`\${Single}\`
      : T extends [infer Head extends string | number, ...infer Tail extends (string | number)[]]
        ? \`\${Head}\${Delimiter}\${Join<Tail, Delimiter>}\`
        : string;

// Test Split:
type IPParts = Split<'192.168.1.100', '.'>; // ["192", "168", "1", "100"]
type CSVFields = Split<'id,name,role,email', ','>; // ["id", "name", "role", "email"]

// Test Join:
type Path = Join<['api', 'v1', 'users', 'auth'], '/'>; // "api/v1/users/auth"
type SemVer = Join<[1, 24, 0], '.'>; // "1.24.0"`,
    breakdown: [
      {
        lineRange: "2-6",
        note: "Split recursively decomposes on \`\${Head}\${Delimiter}\${Tail}\` and appends to tuple."
      },
      {
        lineRange: "9-16",
        note: "Join recursively iterates tuple elements and concatenates them with delimiter strings."
      }
    ],
    expectedOutput: "Converts strings to tuples and tuples to strings at the type level."
  },

  {
    id: "ts-ex-15",
    title: "Type-Safe URL Route Parameter Extractor (ExtractRouteParams<Path>)",
    category: "Template Literal Types",
    difficulty: "advanced",
    whatThisCodeCovers: "Builds a production-grade URL route parameter extractor used in modern web routers (like Express/Fastify/Next.js) to infer typed params objects from URL strings.",
    conceptsCovered: [
      "ExtractRouteParams",
      "Route Pattern Matching",
      "Path Tokens (:param)",
      "Mapped Types",
      "Type-Safe Web Routing"
    ],
    code: `// Extracts parameter names from route paths like "/orgs/:orgId/repos/:repoId"
type ExtractRouteParams<Path extends string> = 
  Path extends \`\${string}/:\${infer Param}/\${infer Rest}\`
    ? { [K in Param | keyof ExtractRouteParams<\`/\${Rest}\`>]: string }
    : Path extends \`\${string}/:\${infer Param}\`
      ? { [K in Param]: string }
      : {};

// Strongly-Typed Route Handler:
class TypedRouter {
  get<Route extends string>(
    path: Route,
    handler: (params: ExtractRouteParams<Route>) => void
  ) {
    // Runtime registration logic...
  }
}

const router = new TypedRouter();

// Full Autocomplete and Strict Type Checking:
router.get('/teams/:teamId/projects/:projectId', (params) => {
  // TypeScript guarantees params has EXACTLY { teamId: string, projectId: string }!
  console.log(params.teamId.toUpperCase());
  console.log(params.projectId.toLowerCase());

  // params.userId; // COMPILE ERROR: Property 'userId' does not exist!
});`,
    breakdown: [
      {
        lineRange: "2-7",
        note: "Matches on '/:Param/' recursively, synthesizing an object type containing all extracted keys."
      },
      {
        lineRange: "10-17",
        note: "The get method infers the Route string generic and passes the parsed params object to the callback."
      }
    ],
    expectedOutput: "Derives { teamId: string; projectId: string } directly from route path strings."
  },

  {
    id: "ts-ex-16",
    title: "Type-Safe URL Query String Parser (ParseQueryString<Query>)",
    category: "Template Literal Types",
    difficulty: "advanced",
    whatThisCodeCovers: "Parses URL query strings at compile time (?filter=active&sort=desc&page=1) into a strongly typed key-value object type.",
    conceptsCovered: [
      "ParseQueryString",
      "Query Delimiter (&)",
      "Key-Value Delimiter (=)",
      "Intersection Merging",
      "Compile-Time URL Parsing"
    ],
    code: `type ParseParam<Param extends string> = 
  Param extends \`\${infer Key}=\${infer Value}\`
    ? { [K in Key]: Value }
    : { [K in Param]: true };

type MergeParams<A, B> = {
  [K in keyof A | keyof B]: K extends keyof A
    ? K extends keyof B
      ? [A[K], B[K]] // Array merge if duplicate keys appear
      : A[K]
    : K extends keyof B
      ? B[K]
      : never;
};

type ParseQueryString<Q extends string> = 
  Q extends \`?\${infer Rest}\`
    ? ParseQueryString<Rest>
    : Q extends \`\${infer Pair}&\${infer Rest}\`
      ? MergeParams<ParseParam<Pair>, ParseQueryString<Rest>>
      : Q extends ''
        ? {}
        : ParseParam<Q>;

// Test Query Parsing:
type Parsed1 = ParseQueryString<'?role=admin&active=true&theme=dark'>;
// Inferred: { role: 'admin'; active: 'true'; theme: 'dark'; }

type DuplicateKeys = ParseQueryString<'?tag=js&tag=ts'>;
// Inferred: { tag: ['js', 'ts'] }`,
    breakdown: [
      {
        lineRange: "1-4",
        note: "ParseParam splits a single key=value pair into an object { [Key]: Value }."
      },
      {
        lineRange: "14-22",
        note: "ParseQueryString recursively splits pairs on '&' and merges results."
      }
    ],
    expectedOutput: "Parses complex query strings into strictly typed object contracts at compile time."
  },

  {
    id: "ts-ex-17",
    title: "String LengthOfString<S> via Tuple Accumulator",
    category: "Template Literal Types",
    difficulty: "intermediate",
    whatThisCodeCovers: "Calculates the exact length of a string literal type at compile time by decomposing characters into a tuple accumulator.",
    conceptsCovered: [
      "LengthOfString",
      "Character Decomposition",
      "Tuple Accumulator Pattern",
      "Tuple['length']",
      "Type-Level Arithmetic"
    ],
    code: `// Recursively unpacks characters into a tuple until empty, then returns tuple['length']
type LengthOfString<S extends string, Acc extends any[] = []> = 
  S extends \`\${infer Char}\${infer Rest}\`
    ? LengthOfString<Rest, [...Acc, Char]>
    : Acc['length'];

// Test String Lengths:
type L1 = LengthOfString<'hello'>; // 5
type L2 = LengthOfString<'TypeScript'>; // 10
type L3 = LengthOfString<''>; // 0

// Enforcing Max-Length Constraints at Compile Time:
type MaxLength<S extends string, Max extends number> = 
  LengthOfString<S> extends Max
    ? S
    : \`Error: String must be exactly \${Max} characters\`;

type ZipCode = MaxLength<'94105', 5>; // "94105"
// type BadZip = MaxLength<'9410', 5>; // "Error: String must be exactly 5 characters"`,
    breakdown: [
      {
        lineRange: "2-5",
        note: "Decomposes string character-by-character into Acc tuple; returns Acc['length'] when empty."
      },
      {
        lineRange: "12-16",
        note: "Uses string length calculation to enforce length constraints on input parameters."
      }
    ],
    expectedOutput: "Computes exact string character counts at compile time."
  },

  {
    id: "ts-ex-18",
    title: "String Replace<S, From, To> and ReplaceAll<S, From, To>",
    category: "Template Literal Types",
    difficulty: "intermediate",
    whatThisCodeCovers: "Recreates JavaScript's String.prototype.replace and replaceAll methods at the type level using recursive template literal substitution.",
    conceptsCovered: [
      "Replace",
      "ReplaceAll",
      "Sub-string Substitution",
      "Tail Recursion",
      "Template Literals"
    ],
    code: `// Replace first occurrence of From with To
type Replace<S extends string, From extends string, To extends string> = 
  From extends ''
    ? S
    : S extends \`\${infer Head}\${From}\${infer Tail}\`
      ? \`\${Head}\${To}\${Tail}\`
      : S;

// Replace all occurrences of From with To
type ReplaceAll<S extends string, From extends string, To extends string> = 
  From extends ''
    ? S
    : S extends \`\${infer Head}\${From}\${infer Tail}\`
      ? \`\${Head}\${To}\${ReplaceAll<Tail, From, To>}\`
      : S;

// Test Replace:
type R1 = Replace<'hello world', 'world', 'TypeScript'>; // "hello TypeScript"

// Test ReplaceAll:
type R2 = ReplaceAll<'item_one_and_item_two', 'item', 'entry'>; // "entry_one_and_entry_two"
type R3 = ReplaceAll<'100.200.300.400', '.', '-'>; // "100-200-300-400"`,
    breakdown: [
      {
        lineRange: "2-7",
        note: "Replace finds the first match and reconstructs \`\${Head}\${To}\${Tail}\`."
      },
      {
        lineRange: "10-15",
        note: "ReplaceAll recursively invokes itself on Tail to replace all subsequent occurrences."
      }
    ],
    expectedOutput: "Substitutes sub-strings within literal string types at compile time."
  },

  {
    id: "ts-ex-19",
    title: "SQL Query String Validator (Table & Column Assertion)",
    category: "Template Literal Types",
    difficulty: "advanced",
    whatThisCodeCovers: "Constructs a type-safe SQL query helper that verifies at compile time that SELECT queries only target valid table names and columns from the database schema.",
    conceptsCovered: [
      "Type-Safe SQL",
      "Schema Verification",
      "Template Literal Assertions",
      "String Decomposition",
      "Compile-Time SQL Safety"
    ],
    code: `interface DatabaseSchema {
  users: { id: number; username: string; email: string };
  orders: { order_id: string; total_amount: number; user_id: number };
}

// Validates: SELECT <Column> FROM <Table>
type ValidSqlQuery<Q extends string> = 
  Q extends \`SELECT \${infer Col} FROM \${infer Table}\`
    ? Table extends keyof DatabaseSchema
      ? Col extends '*'
        ? Q
        : Col extends keyof DatabaseSchema[Table]
          ? Q
          : \`Error: Invalid column '\${Col}' for table '\${Table}'\`
      : \`Error: Table '\${Table}' does not exist in schema\`
    : \`Error: Query must be in format 'SELECT <col> FROM <table>'\`;

function executeQuery<Q extends string>(query: ValidSqlQuery<Q>) {
  console.log('Executing verified SQL:', query);
}

// Valid queries compile cleanly:
executeQuery('SELECT username FROM users'); // OK!
executeQuery('SELECT * FROM orders'); // OK!

// Typo in table name caught at compile time!
// executeQuery('SELECT username FROM customers');
// Error: Table 'customers' does not exist in schema

// Typo in column name caught at compile time!
// executeQuery('SELECT password_hash FROM users');
// Error: Invalid column 'password_hash' for table 'users'`,
    breakdown: [
      {
        lineRange: "7-17",
        note: "Decomposes SQL query into Col and Table, verifying against DatabaseSchema interface."
      },
      {
        lineRange: "19-21",
        note: "Function parameter type ValidSqlQuery<Q> returns error strings if invalid, blocking compile."
      }
    ],
    expectedOutput: "Prevents invalid SQL table and column names from compiling."
  },

  {
    id: "ts-ex-20",
    title: "CSS Style Unit Formatter (px, rem, em, % template verification)",
    category: "Template Literal Types",
    difficulty: "intermediate",
    whatThisCodeCovers: "Enforces that CSS property values conform strictly to valid CSS dimension units ('16px', '1.5rem', '100%') rather than raw numbers or invalid unit strings.",
    conceptsCovered: [
      "CSS Unit Formatter",
      "Union of Units",
      "Template Literals",
      "Compile-Time Formatting",
      "Design System Typings"
    ],
    code: `type CSSUnit = 'px' | 'rem' | 'em' | '%' | 'vh' | 'vw';

// Enforces valid unit suffix or '0' or 'auto'
type CSSDimension = 
  | '0'
  | 'auto'
  | 'inherit'
  | \`\${number}\${CSSUnit}\`;

interface BoxStyle {
  width: CSSDimension;
  height: CSSDimension;
  margin?: CSSDimension;
  padding?: CSSDimension;
}

const safeBox: BoxStyle = {
  width: '100%',
  height: '250px',
  margin: '1.5rem',
  padding: '0'
};

// Compiler prevents missing units or invalid measurements:
// const badBox: BoxStyle = {
//   width: '500', // COMPILE ERROR: Missing unit! (Must be '500px' or similar)
//   height: '200inches' // COMPILE ERROR: 'inches' is not a valid CSSUnit!
// };`,
    breakdown: [
      {
        lineRange: "1-9",
        note: "CSSDimension template literal \`\${number}\${CSSUnit}\` allows any numeric prefix ending in valid CSS units."
      },
      {
        lineRange: "11-16",
        note: "BoxStyle interface requires dimensions to conform, preventing missing unit bugs in design tokens."
      }
    ],
    expectedOutput: "Restricts CSS style strings to valid dimension units at compile time."
  }
];
