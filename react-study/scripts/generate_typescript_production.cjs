const fs = require("fs");
const path = require("path");

const productionTopics = [
  {
    id: "ts-prod-01",
    topic: "Diagnosing Slow tsc Builds with --extendedDiagnostics & Tracing (--generateTrace)",
    category: "Compiler Performance",
    severity: "Critical / Developer Productivity & CI/CD Bottleneck",
    theProblem: "In large monorepos with hundreds of thousands of lines of TypeScript, `tsc` compilation can slow from 5 seconds to 3-5 minutes per build. Developers suffer from sluggish IDE autocompletion, high memory consumption, and slow CI feedback loops. Teams often mistakenly assume slow builds are caused by code volume, when the true culprit is almost always deep recursive utility types, unbounded Cartesian union products, or unindexed node_modules scanning.",
    howItWorksInternally: "TypeScript separates compilation into: Parsing -> Binding -> Checking -> Emitting. The Type Checker consumes 80-90% of compile time when complex types are present. Running `tsc --extendedDiagnostics` reveals exact millisecond breakdowns for each phase, along with total Symbol count and Type count. When Type count exceeds 500,000, type checking slows exponentially. By passing `--generateTrace ./trace-dir`, the compiler outputs Chromium tracing JSON event logs. Using `@typescript/analyze-trace` or Perfetto (`ui.perfetto.dev`), teams can visualize the flame graph to pinpoint the exact file, line, and generic type instantiation causing CPU stalls.",
    productionCode: `// 1. Terminal Diagnostics Profiling Command:
// $ npx tsc --noEmit --extendedDiagnostics

// Sample Diagnostic Output:
// Files:                         1420
// Lines of Library code:       312000
// Lines of Definitions:         48000
// Lines of TypeScript:         120000
// Total time:                  18.45s
//   Parse time:                 1.20s
//   Bind time:                  0.45s
//   Check time:                16.50s  <-- 89% of time spent in Type Checker!
//   Emit time:                  0.00s  (noEmit)
// Memory used:                1245000K

// 2. Deep Tracing Profiling Script:
// package.json:
// "scripts": {
//   "typecheck:trace": "tsc --noEmit --generateTrace ./tsc-trace && npx @typescript/analyze-trace ./tsc-trace"
// }

// 3. Optimization Pattern: Flattening combinatorial unions that slow tsc:
// SLOW: Generates 5 * 5 * 4 = 100 type branches!
type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'link';
type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
type State = 'idle' | 'hover' | 'active' | 'disabled';
type SlowButtonClass = \`btn-\${Variant}-\${Size}-\${State}\`;

// FAST: Use explicit interfaces or bounded unions to prevent combinatorial blowup:
interface ButtonProps {
  variant: Variant;
  size: Size;
  state: State;
}`,
    monitoringMetrics: [
      "`tsc` total check time > 15s in CI [Severity: High]",
      "Total Type count via `--extendedDiagnostics` > 500,000 [Severity: Critical]",
      "Memory consumption during compilation > 2GB (`--max-old-space-size`) [Severity: High]",
      "IDE autocompletion latency in VS Code > 500ms [Severity: Medium]"
    ],
    productionChecklist: [
      "Run `tsc --extendedDiagnostics` in CI pipelines to monitor Type count and Check time trends.",
      "Use `--generateTrace` and `@typescript/analyze-trace` to identify hot-spot types taking > 500ms to resolve.",
      "Audit and replace deeply nested mapped types (`DeepPartial`, `DeepDiff`) on third-party library types.",
      "Ensure `tsconfig.json` has explicit `\"exclude\": [\"node_modules\", \"dist\", \"build\"]`.",
      "Separate type checking from bundlers: run `tsc --noEmit` in a dedicated CI job while bundling with esbuild/Vite."
    ]
  },

  {
    id: "ts-prod-02",
    topic: "Monorepo Architecture: Project References (references), Path Aliases & Composite Builds",
    category: "Monorepo Architecture",
    severity: "Critical / Slow Builds & Circular Dependencies",
    theProblem: "In large monorepos (Turborepo, Nx, pnpm workspaces), running a single root `tsconfig.json` over 50 interdependent packages causes severe memory consumption, broken package boundaries, and slow rebuilds. Conversely, using naive path aliases (`@core/* -> ../core/src/*`) couples packages directly to raw source files, causing packages to be re-typechecked multiple times across the monorepo graph.",
    howItWorksInternally: "Project References (`composite: true` and `references: [{ path: '../pkg' }]`) turn independent packages into discrete build units. When Package B references Package A, Package B typechecks against Package A's emitted `.d.ts` declaration files rather than re-parsing Package A's raw TypeScript source code. The Build Mode (`tsc --build` / `tsc -b`) constructs a Directed Acyclic Graph (DAG) of package dependencies, compiles upstream packages first, enforces strict package isolation, and forbids circular dependencies.",
    productionCode: `// 1. Root Solution Configuration (tsconfig.json):
{
  "files": [],
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/database" },
    { "path": "./packages/api" }
  ]
}

// 2. Upstream Shared Library (packages/core/tsconfig.json):
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "composite": true,          // MANDATORY: Enables project reference support
    "declaration": true,        // Emits .d.ts files for downstream packages
    "declarationMap": true,     // Emits .d.ts.map for "Go to Definition" in IDE
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}

// 3. Downstream Service (packages/api/tsconfig.json):
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "composite": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "references": [
    { "path": "../core" },
    { "path": "../database" }
  ],
  "include": ["src/**/*"]
}

// Build all packages in topological order:
// $ npx tsc --build --verbose`,
    monitoringMetrics: [
      "Monorepo compilation time with `tsc -b` vs monolithic `tsc` [Severity: High]",
      "Circular dependency detection via `tsc --build` DAG resolution [Severity: Critical]",
      "Cache hit ratio in monorepo task runners (Turborepo / Nx) [Severity: Medium]",
      "Package boundary violation lint errors [Severity: High]"
    ],
    productionChecklist: [
      "Enable `composite: true` and `declaration: true` on all internal shared packages.",
      "Always set `declarationMap: true` so 'Go to Definition' jumps to source `.ts` files rather than `.d.ts`.",
      "Use `tsc --build` (`tsc -b`) to compile monorepos; it automatically detects build order and skips fresh packages.",
      "Never use raw cross-package relative path aliases (`../../core/src`) without project references.",
      "Define root solution `tsconfig.json` with `\"files\": []` containing only `references`."
    ]
  },

  {
    id: "ts-prod-03",
    topic: "CI/CD Acceleration with Incremental Compilation & .tsbuildinfo Caching",
    category: "DevOps & CI/CD",
    severity: "High / Extended Pipeline Durations & Resource Waste",
    theProblem: "In continuous integration (CI) pipelines, running `tsc --noEmit` on every pull request from a cold start forces the compiler to re-parse and re-typecheck every single file in the repository. For codebases with 2,000+ files, this wastes 2-4 minutes of CI execution time per commit, increasing compute costs and delaying pull request merges.",
    howItWorksInternally: "When `\"incremental\": true` or `\"composite\": true` is enabled, TypeScript produces a `.tsbuildinfo` file in the build output directory. This file stores cryptographic hashes of all input source files, resolved compiler options, and the internal dependency graph of symbols. On subsequent builds, `tsc` reads `.tsbuildinfo`, compares source file hashes against disk state, and typechecks ONLY the files that changed and their direct dependents, reducing build time by up to 90%.",
    productionCode: `// 1. tsconfig.json Incremental Build Configuration:
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "incremental": true,                     // Enables incremental compilation
    "tsBuildInfoFile": "./.tsbuildinfo",     // Explicit cache file location
    "skipLibCheck": true,                    // Skips re-checking node_modules .d.ts files
    "noEmit": true
  },
  "include": ["src/**/*"]
}

// 2. GitHub Actions CI Workflow with Cache Persistence:
// .github/workflows/typecheck.yml
/*
name: Typecheck
on: [push, pull_request]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Restore TypeScript Cache
        uses: actions/cache@v4
        with:
          path: .tsbuildinfo
          key: \${{ runner.os }}-tsbuild-\${{ hashFiles('pnpm-lock.yaml') }}-\${{ github.sha }}
          restore-keys: |
            \${{ runner.os }}-tsbuild-\${{ hashFiles('pnpm-lock.yaml') }}-
            \${{ runner.os }}-tsbuild-

      - name: Run Incremental Type Check
        run: pnpm tsc --noEmit
*/`,
    monitoringMetrics: [
      "CI typecheck duration delta (Cold build vs Cached `.tsbuildinfo` build) [Severity: High]",
      "Cache hit rate for `.tsbuildinfo` in CI pipeline [Severity: Medium]",
      "Time spent in `skipLibCheck` (savings typically 30-50% of parse time) [Severity: Medium]"
    ],
    productionChecklist: [
      "Enable `incremental: true` and specify `tsBuildInfoFile: \"./.tsbuildinfo\"`.",
      "Persist `.tsbuildinfo` in CI cache (GitHub Actions, GitLab CI, CircleCI).",
      "Always set `\"skipLibCheck\": true` to prevent re-checking stable `node_modules` declarations.",
      "Add `*.tsbuildinfo` to `.gitignore` so local developer caches are not committed to git.",
      "Clean `.tsbuildinfo` if switching across major branches or major TypeScript version upgrades."
    ]
  },

  {
    id: "ts-prod-04",
    topic: "Eliminating Unintentional any and unknown in High-Scale Codebases",
    category: "Type Safety & Quality",
    severity: "Critical / Silent Runtime Type Failures",
    theProblem: "Using `any` completely disables the TypeScript type checker for that variable and any expressions it touches. In large engineering teams, developers under deadline pressure use `as any` as an escape hatch. Over time, `any` spreads virally throughout the codebase: functions receive `any`, return `any`, and propagate untyped data into database and UI layers, causing runtime `TypeError: Cannot read properties of undefined` in production.",
    howItWorksInternally: "When an expression has type `any`, the compiler's `checkExpression` bypasses all assignability checks, allowing property accesses, method invocations, and reassignments without validation. The proper type-safe alternative is `unknown`: `unknown` represents any value, but forces developers to narrow the type using type guards, `typeof`, `instanceof`, or Zod validation before accessing properties. Automated ESLint rules prevent new `any` instances from entering the repository.",
    productionCode: `// 1. ESLint Configuration banning unsafe 'any':
// .eslintrc.json
{
  "rules": {
    "@typescript-eslint/no-explicit-any": ["error", { "fixToUnknown": true }],
    "@typescript-eslint/no-unsafe-assignment": "error",
    "@typescript-eslint/no-unsafe-member-access": "error",
    "@typescript-eslint/no-unsafe-call": "error",
    "@typescript-eslint/no-unsafe-return": "error"
  }
}

// 2. Production Pattern: Replacing 'any' with 'unknown' + Type Guards:

// DANGEROUS:
function parseApiResponseBad(raw: any) {
  // Silent runtime crash if raw.data or raw.data.user is undefined!
  return raw.data.user.id.toUpperCase();
}

// SECURE & TYPE-SAFE:
interface ApiResponse {
  data: {
    user: {
      id: string;
      email: string;
    };
  };
}

function isApiResponse(val: unknown): val is ApiResponse {
  return (
    typeof val === 'object' &&
    val !== null &&
    'data' in val &&
    typeof (val as any).data === 'object' &&
    (val as any).data !== null &&
    'user' in (val as any).data
  );
}

function parseApiResponseSafe(raw: unknown): string {
  if (!isApiResponse(raw)) {
    throw new Error('Malformed API response payload');
  }
  // 100% Type-Safe: compiler guarantees id is string!
  return raw.data.user.id.toUpperCase();
}`,
    monitoringMetrics: [
      "`any` token count across codebase via ESLint / ts-morph [Severity: High]",
      "Runtime `TypeError: Cannot read properties of undefined` in production telemetry [Severity: Critical]",
      "Code coverage of User-Defined Type Guards [Severity: Medium]"
    ],
    productionChecklist: [
      "Enable `@typescript-eslint/no-explicit-any` with `error` severity in CI linter.",
      "Use `unknown` for all untrusted external boundaries (network responses, message queues, JSON.parse).",
      "Write User-Defined Type Guards (`val is Type`) or Zod parsers to narrow `unknown` safely.",
      "Enable `noImplicitAny: true` in `tsconfig.json`.",
      "Track codebase 'type-safety score' (percentage of typed AST identifiers vs untyped) over time."
    ]
  },

  {
    id: "ts-prod-05",
    topic: "Safe Migration Strategy: Upgrading Legacy JavaScript Codebases to Strict TypeScript",
    category: "Architecture & Modernization",
    severity: "High / Migration Stall & Merge Conflicts",
    theProblem: "Migrating an enterprise JavaScript codebase with hundreds of thousands of lines to TypeScript all at once is impossible. Turning on `strict: true` immediately generates 10,000+ compiler errors, blocking all feature development. Teams attempt to migrate by renaming all `.js` files to `.ts` and using `// @ts-ignore` everywhere, producing an unmaintainable codebase with zero real type safety.",
    howItWorksInternally: "A successful TypeScript migration relies on the Strangler Fig pattern and TypeScript's dual-compilation capabilities: 1. Set `\"allowJs\": true` and `\"checkJs\": false` in `tsconfig.json` so JS and TS files co-exist seamlessly. 2. Enable JSDoc type checking with `// @ts-check` in individual JS files to catch bugs before renaming. 3. Configure strict flags in stages: start with `noImplicitAny`, then `strictNullChecks`, then full `strict: true`. 4. Use automated tooling (ts-migrate, codemods) to migrate leaf-node utility modules first before moving to core services.",
    productionCode: `// 1. Phased Migration tsconfig.json (Permissive Phase):
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "allowJs": true,           // Allows .js files to live alongside .ts files
    "checkJs": false,          // Disables checking .js files by default
    "strict": false,           // Gradual strictness activation
    "noImplicitAny": true,     // Phase 1: Ban implicit any
    "strictNullChecks": false, // Phase 2: Postponed until Phase 1 complete
    "outDir": "./dist"
  },
  "include": ["src/**/*"]
}

// 2. Incremental checking in JS files using JSDoc without renaming to .ts:
// src/legacy/authHelper.js
// @ts-check

/**
 * @typedef {Object} SessionUser
 * @property {string} id
 * @property {string} email
 * @property {boolean} [isAdmin]
 */

/**
 * @param {SessionUser} user
 * @param {string} requiredRole
 * @returns {boolean}
 */
function verifyRole(user, requiredRole) {
  // TypeScript checks this .js file with full IDE error highlighting!
  return user.email.endsWith('@company.com');
}

module.exports = { verifyRole };`,
    monitoringMetrics: [
      "Percentage ratio of `.ts` / `.tsx` files vs `.js` / `.jsx` files over time [Severity: Medium]",
      "Count of `// @ts-ignore` and `// @ts-expect-error` directives in codebase [Severity: High]",
      "Active TypeScript compile error count per migration milestone [Severity: Medium]"
    ],
    productionChecklist: [
      "Start with `allowJs: true` to compile mixed JS and TS files simultaneously.",
      "Use `// @ts-check` with JSDoc annotations to type legacy JavaScript before renaming.",
      "Enforce `@typescript-eslint/ban-ts-comment` with `description: true` so any `@ts-expect-error` requires an explanatory ticket.",
      "Migrate dependencies from bottom to top: utilities -> domain models -> services -> controllers.",
      "Never turn on `strict: true` before `strictNullChecks` and `noImplicitAny` are already error-free."
    ]
  },

  {
    id: "ts-prod-06",
    topic: "Library Packaging: Dual ESM/CJS Package Exports & Conditional .d.ts Declarations",
    category: "Library Publishing & Packaging",
    severity: "Critical / Consumer Module Resolution Failures",
    theProblem: "Publishing a TypeScript library to npm that supports both modern ESM (`import`) and legacy CommonJS (`require`) frequently breaks consumer applications with `ERR_REQUIRE_ESM`, missing type declarations, or duplicate runtime instance states (the Dual Package Hazard). Consumers in TypeScript report `Cannot find module` or find that types resolve to `any`.",
    howItWorksInternally: "Node.js uses the `package.json` `\"exports\"` field to govern subpath imports. When TypeScript 4.7+ uses `moduleResolution: \"NodeNext\"`, the compiler strictly matches the `exports` field: if a consumer imports via ESM, TypeScript looks for `exports.import.types`; if via CJS, it looks for `exports.require.types`. A dual-package build requires: 1. Compiling two bundles (`dist/esm` and `dist/cjs`). 2. Generating matching `.d.ts` and `.d.mts` declaration maps. 3. Specifying exact conditional export targets.",
    productionCode: `// 1. Production Dual ESM/CJS package.json:
{
  "name": "@enterprise/shared-utils",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/cjs/index.js",
  "types": "./dist/cjs/index.d.ts",
  "module": "./dist/esm/index.js",
  "exports": {
    ".": {
      "import": {
        "types": "./dist/esm/index.d.ts",
        "default": "./dist/esm/index.js"
      },
      "require": {
        "types": "./dist/cjs/index.d.ts",
        "default": "./dist/cjs/index.js"
      }
    }
  },
  "files": ["dist"],
  "scripts": {
    "build:cjs": "tsc -p tsconfig.cjs.json",
    "build:esm": "tsc -p tsconfig.esm.json",
    "build": "rm -rf dist && pnpm build:cjs && pnpm build:esm",
    "check:exports": "attw --pack ."
  }
}

// 2. ESM tsconfig.esm.json:
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist/esm",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}

// 3. CJS tsconfig.cjs.json:
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node10",
    "declaration": true,
    "declarationMap": true,
    "outDir": "./dist/cjs",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}`,
    monitoringMetrics: [
      "Export verification errors via `@arethetypeswrong/cli` (attw) [Severity: Critical]",
      "Consumer issue reports regarding `ERR_REQUIRE_ESM` [Severity: High]",
      "Bundle size inflation from dual packaging [Severity: Medium]"
    ],
    productionChecklist: [
      "Always test published packages using `@arethetypeswrong/cli` (`attw --pack .`).",
      "Specify `types` first in each export condition branch before `default`.",
      "Ensure all relative imports in ESM TypeScript source files include `.js` extensions (`import { x } from './utils.js'`).",
      "Avoid stateful singletons in dual packages to prevent the Dual Package Hazard.",
      "Emit `declarationMap: true` to support seamless IDE 'Go to Definition' for library consumers."
    ]
  },

  {
    id: "ts-prod-07",
    topic: "Strict Compiler Flags Matrix: strictNullChecks, noImplicitAny, exactOptionalPropertyTypes",
    category: "Type Safety & Configuration",
    severity: "High / Production Null Pointer Exceptions",
    theProblem: "Developers often believe that setting `\"strict\": true` enables every possible type safety feature. However, several critical modern flags (such as `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`) are NOT included in `strict: true` for backward-compatibility reasons. Leaving these flags disabled permits `undefined` bugs and unexpected object mutation anomalies.",
    howItWorksInternally: "The `strict: true` umbrella flag bundles: `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `noImplicitThis`, and `useUnknownInCatchVariables`. Crucial non-strict flags include: 1. `noUncheckedIndexedAccess`: forces `arr[i]` and `Record<string, T>[key]` to return `T | undefined` rather than `T`. 2. `exactOptionalPropertyTypes`: distinguishes between a missing property `{ a?: number }` and an explicit `{ a: undefined }`. Enabling these flags eliminates runtime null-pointer crashes.",
    productionCode: `// Production Hardened tsconfig.json (Zero-Compromise Safety):
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",

    // 1. Standard Strict Umbrella
    "strict": true,

    // 2. Critical Non-Strict Additions (MANDATORY FOR PRODUCTION):
    "noUncheckedIndexedAccess": true,       // arr[i] returns T | undefined!
    "exactOptionalPropertyTypes": true,     // Distinguishes { x?: number } from { x: undefined }
    "noImplicitReturns": true,              // Guarantees all code paths return a value
    "noFallthroughCasesInSwitch": true,     // Prevents accidental switch fallthrough
    "noUnusedLocals": true,                 // Flags unused variables
    "noUnusedParameters": true,             // Flags unused function arguments
    "useUnknownInCatchVariables": true,     // catch (err) is unknown, NOT any!

    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true
  }
}

// Code demonstrating noUncheckedIndexedAccess protection:
const cache: Record<string, string> = { key: 'value' };

// Under default TS: item is typed as 'string' (UNSOUND: what if key doesn't exist?)
// With noUncheckedIndexedAccess: item is typed as 'string | undefined' (SOUND!)
const item = cache['nonExistent'];

// item.toUpperCase(); // COMPILE ERROR: Object is possibly 'undefined'!
if (item !== undefined) {
  console.log(item.toUpperCase()); // Safe!
}`,
    monitoringMetrics: [
      "Compiler error count delta when toggling `noUncheckedIndexedAccess` [Severity: Medium]",
      "Sentry / Datadog uncaught `TypeError: Cannot read properties of undefined` count [Severity: Critical]",
      "Total unused variable warnings [Severity: Low]"
    ],
    productionChecklist: [
      "Always enable `noUncheckedIndexedAccess: true` to prevent array and dictionary out-of-bounds crashes.",
      "Enable `exactOptionalPropertyTypes: true` to prevent setting optional fields to `undefined`.",
      "Verify `useUnknownInCatchVariables: true` so caught errors require `instanceof Error` assertions.",
      "Enable `forceConsistentCasingInFileNames: true` to prevent Linux vs macOS cross-platform casing bugs.",
      "Audit `tsconfig.json` during quarterly reviews against the latest TypeScript compiler recommendations."
    ]
  },

  {
    id: "ts-prod-08",
    topic: "Type Complexity Budgeting: Avoiding Recursion Limit (TS2589) & Type Instantiation Blowup",
    category: "Compiler Performance",
    severity: "Critical / Compiler Crashes & Build Failures",
    theProblem: "Advanced type-level programming (deep schema parsing, recursive type mapping, type-level string arithmetic) can easily exceed TypeScript's internal recursion stack limit. The compiler crashes with `TS2589: Type instantiation is excessively deep and possibly infinite`, halting all CI pipelines and rendering developer IDEs completely unresponsive.",
    howItWorksInternally: "TypeScript maintains an internal recursion depth counter when evaluating conditional types. Prior to TS 4.5, non-tail-recursive types hit a hard stack limit of ~50 iterations. TypeScript 4.5 introduced tail-call elimination for conditional types, expanding the limit to ~1,000 iterations ONLY when the recursive call is in the tail position with an accumulator. If a generic type branches non-tail-recursively across a union of 10 items, it instantiates thousands of intermediate types, overflowing the recursion budget.",
    productionCode: `// 1. RECURSION BLOWUP ANTI-PATTERN (Hits TS2589 easily!):
// Non-tail-recursive tuple reverser:
type SlowReverse<T extends any[]> = T extends [infer Head, ...infer Tail]
  ? [...SlowReverse<Tail>, Head] // NOT tail-recursive! Spreads after recursion!
  : [];

// 2. PRODUCTION TAIL-CALL OPTIMIZED PATTERN (Handles 1,000+ items safely!):
type FastReverse<T extends any[], Acc extends any[] = []> = 
  T extends [infer Head, ...infer Tail]
    ? FastReverse<Tail, [Head, ...Acc]> // TAIL POSITION: Compiler reuses call frame!
    : Acc;

// 3. DEPTH LIMITER SAFETY GUARD:
// Enforce recursion depth limits to prevent infinite compiler loops:
type BuildTuple<L extends number, T extends any[] = []> = 
  T['length'] extends L 
    ? T 
    : BuildTuple<L, [...T, any]>;

type Decrement<N extends number> = 
  BuildTuple<N> extends [any, ...infer Rest] ? Rest['length'] : 0;

// Safe bounded recursion pattern:
type SafeDeepResolve<T, Depth extends number = 5> = [Depth] extends [0]
  ? T // Fallback to shallow T when recursion budget exhausted!
  : T extends object
    ? { [K in keyof T]: SafeDeepResolve<T[K], Decrement<Depth>> }
    : T;`,
    monitoringMetrics: [
      "Incidents of `TS2589: Type instantiation is excessively deep` [Severity: Critical]",
      "V8 Heap memory usage of `tsc` process during CI execution [Severity: High]",
      "Max recursion depth in custom utility types [Severity: Medium]"
    ],
    productionChecklist: [
      "Always design recursive conditional types in tail-call position using accumulator arguments (`Acc extends any[] = []`).",
      "Inject a `Depth extends number` parameter to bound recursive tree walks to a safe limit (e.g. 5-10 levels).",
      "Avoid applying deeply recursive types to complex third-party library classes (Prisma, Mongoose, React).",
      "Use `[T] extends [never]` rather than naked `T extends never` to prevent unexpected union distribution.",
      "Unit-test complex utility types using tools like `tsd` or `expect-type` to verify they compile within bounds."
    ]
  },

  {
    id: "ts-prod-09",
    topic: "Decorator Metaprogramming: TC39 Stage 3 Standard Decorators vs Legacy Experimental Decorators",
    category: "Language Features & Metaprogramming",
    severity: "High / Breaking Decorator Ecosystem Split",
    theProblem: "The TypeScript decorator ecosystem is split between legacy experimental decorators (`experimentalDecorators: true`, used in NestJS, TypeORM, and Angular) and the modern TC39 Stage 3 official ECMAScript standard decorators (introduced in TypeScript 5.0). Mixing the two configurations causes runtime crashes, syntax errors, and missing metadata errors.",
    howItWorksInternally: "Legacy experimental decorators pass raw prototypes and property descriptors (`(target, propertyKey, descriptor)`) and rely on `reflect-metadata` for runtime type reflection (`emitDecoratorMetadata: true`). The modern TC39 Stage 3 standard decorators pass the target function and a structured `context` object (`ClassMethodDecoratorContext`, `ClassFieldDecoratorContext`) and do NOT support `emitDecoratorMetadata`. In enterprise codebases, teams must choose one strategy: maintain legacy settings for NestJS/TypeORM, or migrate to standard decorators for framework-agnostic libraries.",
    productionCode: `// 1. MODERN TC39 STAGE 3 STANDARD DECORATOR (TypeScript 5.0+, experimentalDecorators: false):
function Autolog<This, Args extends any[], Return>(
  target: (this: This, ...args: Args) => Return,
  context: ClassMethodDecoratorContext<This, (this: This, ...args: Args) => Return>
) {
  const methodName = String(context.name);

  return function (this: This, ...args: Args): Return {
    console.log(\`[Executing] \${methodName}\`);
    return target.call(this, ...args);
  };
}

class PaymentService {
  @Autolog
  charge(amount: number): boolean {
    return true;
  }
}

// 2. LEGACY EXPERIMENTAL DECORATOR (NestJS / TypeORM require tsconfig: "experimentalDecorators": true):
/*
function LegacyLog(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;
  descriptor.value = function (...args: any[]) {
    console.log(\`[Legacy Calling] \${propertyKey}\`);
    return originalMethod.apply(this, args);
  };
  return descriptor;
}
*/`,
    monitoringMetrics: [
      "Compiler errors related to decorator signature mismatches (TS1206, TS1240) [Severity: High]",
      "Missing metadata runtime exceptions (`reflect-metadata` undefined) [Severity: Critical]",
      "Performance impact of decorator method wrapping on high-frequency hot paths [Severity: Medium]"
    ],
    productionChecklist: [
      "Do NOT enable `experimentalDecorators` unless using frameworks that strictly require it (NestJS, TypeORM).",
      "For modern greenfield projects, use standard TC39 Stage 3 decorators with `ClassMethodDecoratorContext`.",
      "Never mix legacy and modern decorator syntax in the same TypeScript compilation unit.",
      "If using legacy decorators, ensure `import 'reflect-metadata';` is imported once at the very entry point of the app.",
      "Verify decorator methods preserve the `this` context when delegating with `target.call(this, ...args)`."
    ]
  },

  {
    id: "ts-prod-10",
    topic: "Runtime Validation vs Static Types: Bridging Zod / ArkType / TypeBox without Type Drift",
    category: "Architecture & Validation",
    severity: "Critical / Production Data Corruption & Schema Drift",
    theProblem: "TypeScript types exist only at compile time and are completely erased during JavaScript emission. If an application receives untrusted HTTP request payloads, database rows, or environment variables, static types cannot validate them. When teams maintain separate TypeScript `interface User` declarations alongside manual validator functions, the two inevitably drift apart, causing silent data corruption and runtime crashes.",
    howItWorksInternally: "Schema-first libraries (Zod, ArkType, TypeBox) establish a Single Source of Truth (SSOT). The developer writes the runtime schema once; the static TypeScript type is derived automatically using type inference (`z.infer<typeof Schema>`). If the schema changes, the derived type updates instantly across the entire codebase. TypeBox uses JSON Schema primitives for near-native validation speed (20x faster than Zod), while Zod offers rich fluent transformation chaining (`.transform()`, `.refine()`).",
    productionCode: `import { z } from 'zod';

// 1. Single Source of Truth: Define Runtime Schema ONCE
export const CreateOrderSchema = z.object({
  customerId: z.string().uuid('Invalid customer UUID'),
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().int().positive(),
    priceCents: z.number().int().positive()
  })).min(1, 'Order must contain at least 1 item'),
  discountCode: z.string().trim().max(20).optional()
}).strict(); // Rejects unexpected fields (mass-assignment protection)

// 2. Automatically Derive Static TypeScript Type! (ZERO REDUNDANCY!)
export type CreateOrderInput = z.infer<typeof CreateOrderSchema>;

// In Controller:
async function handleCreateOrder(rawBody: unknown) {
  // Runtime validation parses and asserts shape, stripping unknown fields:
  const validatedOrder: CreateOrderInput = await CreateOrderSchema.parseAsync(rawBody);

  // validatedOrder is 100% guaranteed to match CreateOrderInput at runtime and compile-time!
  return orderService.save(validatedOrder);
}`,
    monitoringMetrics: [
      "Schema validation failure rates (HTTP 400 anomalies) [Severity: Medium]",
      "Runtime validation CPU overhead per request [Severity: Medium]",
      "Schema drift incidents between frontend DTOs and backend validators [Severity: High]"
    ],
    productionChecklist: [
      "Derive TypeScript types directly from runtime schemas using `z.infer<typeof Schema>`.",
      "Never maintain duplicate manual `interface` definitions alongside validation schemas.",
      "Share validation schemas between frontend and backend in monorepos to guarantee end-to-end type safety.",
      "For high-throughput endpoints (> 10,000 RPS), evaluate TypeBox for near-zero validation CPU overhead.",
      "Use `.strict()` on schemas to automatically reject and prevent mass-assignment security vulnerabilities."
    ]
  },

  {
    id: "ts-prod-11",
    topic: "AST-Based Codemods & Custom Linters using the Compiler API & ts-morph",
    category: "Tooling & Automation",
    severity: "High / Massive Refactoring Merge Conflicts",
    theProblem: "When executing large-scale architectural refactorings (e.g. migrating 500 files from legacy Moment.js to date-fns, renaming an enterprise API parameter across 50 microservices, or enforcing architectural boundary rules), manual regex find-and-replace corrupts code, breaks syntax, and takes weeks of tedious developer effort.",
    howItWorksInternally: "TypeScript provides a full programmatic Compiler API (`ts.createProgram`, `ts.transform`). An AST (Abstract Syntax Tree) represents code as a syntax graph rather than plain text. Tools like `ts-morph` wrap this API, allowing developers to query all class declarations, rename methods, inject parameters, and modify imports programmatically while automatically updating references and formatting the output code cleanly without breaking syntax.",
    productionCode: `// Automated Codemod Script using ts-morph
// Replaces deprecated 'fetchUserLegacy(id)' with 'userService.getById({ userId: id })'
import { Project, SyntaxKind } from 'ts-morph';

async function runRefactoringCodemod() {
  const project = new Project({
    tsConfigFilePath: './tsconfig.json'
  });

  const sourceFiles = project.getSourceFiles('src/**/*.ts');
  let refactoredCount = 0;

  for (const file of sourceFiles) {
    const callExpressions = file.getDescendantsOfKind(SyntaxKind.CallExpression);

    for (const call of callExpressions) {
      const expr = call.getExpression();
      if (expr.getText() === 'fetchUserLegacy') {
        const [idArg] = call.getArguments();
        if (idArg) {
          // Replace AST node with modern service call
          call.replaceWithText(\`userService.getById({ userId: \${idArg.getText()} })\`);
          refactoredCount++;
        }
      }
    }
  }

  // Save all modified files back to disk cleanly!
  await project.save();
  console.log(\`Successfully refactored \${refactoredCount} call sites across \${sourceFiles.length} files.\`);
}

// runRefactoringCodemod();`,
    monitoringMetrics: [
      "Number of deprecated function invocations remaining in codebase [Severity: Medium]",
      "Codemod execution duration across entire monorepo [Severity: Low]",
      "Syntax verification failures post-codemod via `tsc --noEmit` [Severity: Critical]"
    ],
    productionChecklist: [
      "Use `ts-morph` rather than regular expressions for multi-file structural refactoring.",
      "Always run `tsc --noEmit` and test suites immediately following codemod execution to verify type purity.",
      "Commit codemods in dedicated PRs without mixing in manual business logic changes.",
      "Write unit tests for custom codemod scripts against mock AST input fixtures.",
      "Enforce architectural constraints using custom ESLint rules with `@typescript-eslint/utils`."
    ]
  },

  {
    id: "ts-prod-12",
    topic: "Type-Safe Monorepo Package Publishing & Tree-Shaking Verification",
    category: "Library Publishing & Packaging",
    severity: "High / Bloated Consumer Bundles & Dead Code Leakage",
    theProblem: "When publishing internal shared packages or open-source libraries from a monorepo, developers often bundle entire utility collections into a single entry point. If TypeScript and bundler settings (`sideEffects: false`, ESM module emission) are misconfigured, consumers who import a single 2-line helper end up bundling 500KB of unused third-party dependencies into their frontend applications.",
    howItWorksInternally: "Tree-shaking relies on ES Module static structure (`import` and `export`). CommonJS `require()` is dynamic, making static dead-code elimination impossible. When compiling libraries with TypeScript: 1. Set `\"module\": \"ES2022\"` or `\"NodeNext\"` to preserve ESM imports. 2. Mark `\"sideEffects\": false` in `package.json` to inform Rollup/Webpack/Vite that unused files can be safely removed. 3. Avoid barrel file antipatterns (`export * from './heavyModule'`) that force bundlers to parse and link unnecessary modules.",
    productionCode: `// 1. package.json with Tree-Shaking Annotations:
{
  "name": "@enterprise/ui-kit",
  "version": "2.4.0",
  "type": "module",
  "sideEffects": false, // CRITICAL: Informs bundlers that modules have no side effects!
  "exports": {
    ".": "./dist/index.js",
    "./button": "./dist/components/Button.js",
    "./modal": "./dist/components/Modal.js"
  }
}

// 2. tsconfig.json optimizing for tree-shaking:
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "isolatedModules": true, // Guarantees compatibility with SWC / esbuild
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}

// 3. Automated Tree-Shaking Verification Test:
// bundle-test.js
// Uses esbuild to verify that importing 'Button' does NOT bundle 'Modal':
/*
import * as esbuild from 'esbuild';

const result = await esbuild.build({
  entryPoints: ['test-entry.js'], // contains: import { Button } from '@enterprise/ui-kit';
  bundle: true,
  write: false,
  format: 'esm'
});

const outputText = result.outputFiles[0].text;
if (outputText.includes('Modal')) {
  throw new Error('FAILED: Tree-shaking leaked Modal into Button bundle!');
}
console.log('Tree-shaking test passed cleanly.');
*/`,
    monitoringMetrics: [
      "Consumer application bundle size impact per library upgrade [Severity: High]",
      "Side-effect leakage alerts during library bundling [Severity: High]",
      "Duplicate dependency versions in lockfiles via `pnpm why` [Severity: Medium]"
    ],
    productionChecklist: [
      "Always declare `\"sideEffects\": false` (or specify an array of side-effect files like CSS) in `package.json`.",
      "Emit ES Modules (`\"module\": \"NodeNext\"`) to enable consumer bundler dead-code elimination.",
      "Avoid root barrel files (`index.ts`) that re-export heavy dependencies; support subpath exports.",
      "Run automated tree-shaking verification tests using `esbuild` or `size-limit` in CI.",
      "Enable `isolatedModules: true` in `tsconfig.json` to ensure code can be compiled by esbuild/SWC."
    ]
  },

  {
    id: "ts-prod-13",
    topic: "Enums vs Const Objects (as const) vs Union Literals: Memory & Bundle Size Impact",
    category: "Architecture & Optimization",
    severity: "Medium / Bundle Size Bloat & Runtime Inconsistencies",
    theProblem: "TypeScript numeric and string `enum`s are one of the few features that emit actual runtime JavaScript code rather than being purely erased. Numeric enums generate reverse-mapping objects in JavaScript, causing unexpected runtime behavior, bundle size inflation, and tree-shaking failures. Teams struggle to choose between `enum`, `const enum`, `as const` object dictionaries, and union literals.",
    howItWorksInternally: "A standard TypeScript `enum Color { Red, Green }` compiles to an immediately invoked function expression (IIFE) that populates an object with bidirectional mappings: `Color[Color[\"Red\"] = 0] = \"Red\"`. This IIFE prevents bundlers from tree-shaking unused enums. `const enum` inlines values at compile time, but completely breaks when compiling with tools that evaluate files in isolation (Babel, esbuild, SWC). The modern enterprise standard is using `const Object` with `as const` and deriving union types via `keyof typeof`.",
    productionCode: `// 1. LEGACY ENUM (Emits bloated IIFE in JS, breaks tree-shaking):
enum StatusEnum {
  Pending = 'PENDING',
  Active = 'ACTIVE',
  Archived = 'ARCHIVED'
}
// Emits: var StatusEnum; (function(StatusEnum) { ... })(StatusEnum || (StatusEnum = {}));

// 2. MODERN ENTERPRISE STANDARD: const Object + as const
export const Status = {
  Pending: 'PENDING',
  Active: 'ACTIVE',
  Archived: 'ARCHIVED'
} as const;

// Derive the Union Type automatically (Zero runtime cost!):
export type Status = typeof Status[keyof typeof Status];
// Inferred: 'PENDING' | 'ACTIVE' | 'ARCHIVED'

// Function using the derived union type:
function updateStatus(status: Status) {
  console.log('Updated status to:', status);
}

// Idiomatic, fully-typed usage:
updateStatus(Status.Active); // Clean autocomplete
updateStatus('ACTIVE');      // Also accepts literal directly without enum casting!

// 3. PURE UNION LITERALS (Ideal when no runtime object iteration is needed):
export type UserRole = 'admin' | 'manager' | 'editor' | 'viewer';
// Emits 0 bytes of JavaScript! 100% erased!`,
    monitoringMetrics: [
      "Bundle size delta from enum IIFE emission [Severity: Low]",
      "IsolatedModules compile errors when using `const enum` [Severity: High]",
      "Type casting bugs from numeric enum reverse lookups [Severity: Medium]"
    ],
    productionChecklist: [
      "Prefer `const Object as const` + derived union types over numeric or string `enum`s.",
      "Avoid `const enum` if using Babel, SWC, Vite, or esbuild (`isolatedModules: true` flags this).",
      "Use pure union literals (`type Role = 'admin' | 'user'`) when runtime iteration is not required.",
      "Never use numeric enums for database values or external API contracts.",
      "Audit existing legacy enums using automated codemods to convert them to `as const` objects."
    ]
  },

  {
    id: "ts-prod-14",
    topic: "Managing Breaking Type Changes Across TypeScript Versions (4.x to 5.x and beyond)",
    category: "Architecture & Modernization",
    severity: "High / Blocked Compiler Upgrades & CI Failures",
    theProblem: "Upgrading TypeScript across major versions (e.g. 4.x to 5.0, 5.5) often triggers hundreds of new compiler errors due to tightened subtyping checks, changes in DOM types, improved type predicate inference, or deprecated compiler flags. Organizations get trapped on outdated TypeScript versions for years, missing out on major performance upgrades (like TS 5.0's 20% speedup).",
    howItWorksInternally: "TypeScript does not follow strict semantic versioning for type-checking rules: any bug fix that corrects an unsound type assignment is technically a breaking change for code that relied on the bug. In TS 5.0: the compiler was rewritten from namespaces to ESM, lowering memory usage; `target: ES3` was dropped; and decorators were updated to TC39 Stage 3. In TS 5.5: auto-inferred type predicates narrowed types in `.filter()` that previously required explicit typing. Upgrading safely requires canary CI runs and pinning exact TypeScript versions.",
    productionCode: `// 1. PINNING EXACT TYPESCRIPT VERSION (package.json):
// Avoid loose ranges like "^5.4.0"; use exact versions to prevent unexpected CI breaks!
{
  "devDependencies": {
    "typescript": "5.5.4" // Exact pinned version
  }
}

// 2. TYPESCRIPT 5.5 INFERRED TYPE PREDICATE BENEFIT:
const items = ['apple', null, 'orange', undefined, 'banana'];

// In TS 5.4: filtered was typed as (string | null | undefined)[]
// In TS 5.5: Automatically inferred as string[]!
const filtered = items.filter(x => x !== null && x !== undefined);

// 3. MANAGING TSCONFIG DEPRECATIONS IN TS 5.0+:
{
  "compilerOptions": {
    // Deprecated in TS 5.0 (DO NOT USE):
    // "target": "ES3",
    // "out": "./bundle.js",
    // "keyofStringsOnly": true,

    // Modern TS 5.x replacements:
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "ignoreDeprecations": "5.0" // Temporary escape hatch while upgrading
  }
}`,
    monitoringMetrics: [
      "Canary CI build failure rate when testing against `typescript@next` [Severity: Medium]",
      "Deprecated compiler options warnings count [Severity: Medium]",
      "Compile time delta post-compiler upgrade [Severity: Medium]"
    ],
    productionChecklist: [
      "Pin exact TypeScript versions in `package.json` (no `^` or `~` caret ranges).",
      "Run a scheduled weekly CI canary job testing the codebase against `typescript@next` to detect breaking changes weeks in advance.",
      "Review official TypeScript release notes (DevBlogs) for breaking changes and deprecations before upgrading.",
      "Upgrade `@types/node` and `@types/react` in lockstep when upgrading the TypeScript compiler.",
      "Use `\"ignoreDeprecations\": \"5.0\"` as a short-term stepping stone when migrating legacy tsconfigs."
    ]
  }
];

// Validate schema
const requiredFields = [
  "id",
  "topic",
  "category",
  "severity",
  "theProblem",
  "howItWorksInternally",
  "productionCode",
  "monitoringMetrics",
  "productionChecklist"
];

for (const t of productionTopics) {
  for (const field of requiredFields) {
    if (t[field] === undefined || t[field] === null || t[field] === "") {
      console.error(`Production topic ${t.id} missing field: ${field}`);
    }
  }
}

const outputPath = path.join(__dirname, "../data/typescript.production.json");
fs.writeFileSync(outputPath, JSON.stringify(productionTopics, null, 2), "utf-8");

console.log(`Successfully generated TypeScript Production Mastery Hub:`);
console.log(`- ${productionTopics.length} Topics -> ${outputPath}`);
