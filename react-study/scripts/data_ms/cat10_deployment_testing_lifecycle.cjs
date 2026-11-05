const { card } = require("../ms_builder_helper.cjs");

const cards = [
  card(
    109,
    "The Microservices Testing Pyramid: Unit, Contract & E2E",
    "Testing",
    "Mastery",
    "In microservices, relying heavily on end-to-end (E2E) staging environments is an anti-pattern (slow, flaky, high maintenance). The Microservices Testing Pyramid prioritizes Unit Tests (base), Consumer-Driven Contract Tests (middle), Component/Integration tests, and minimal synthetic E2E tests at the apex.",
    `// The Microservices Testing Pyramid Distribution:
// 1. Unit Tests (70%): Fast, isolated, test pure domain logic, entities, state machines.
// 2. Contract Tests (20%): Verify API boundaries using Pact/Schema validation without deploying dependencies.
// 3. Component Tests (8%): Test single microservice in isolation using Testcontainers for DB and WireMock for RPCs.
// 4. End-to-End Tests (2%): Minimal critical smoke tests in production/staging (e.g. Can a user checkout?).

// Comparison of Approaches:
// Flaky E2E Architecture (Anti-Pattern):
// Staging cluster runs 50 microservices. Test requires all 50 to be up and seeded with clean data.
// Result: 80% test failures are environment blips (flakiness), not code defects.

// Resilient Contract-Driven Pipeline:
// Order Service tests its contract against Payment Service mock locally in CI in 2 seconds.
// If contract passes and Pact broker approves (can-i-deploy), deploy to production with confidence!`,
    ["Testing Pyramid", "Unit Testing", "Contract Testing", "Flakiness", "E2E Testing"],
    [
      { title: "Martin Fowler: The Practical Test Pyramid", url: "https://martinfowler.com/articles/practical-test-pyramid.html" }
    ],
    "Why are monolithic-style End-to-End (E2E) integration test suites toxic in microservices?",
    "They create an unmaintainable testing bottleneck. Tests take hours to run, fail constantly due to transient network glitches across dozens of services, and re-couple independent teams into synchronized deployment schedules to coordinate shared staging environments.",
    "What replaces shared staging environments in high-velocity microservice organizations?",
    "Consumer-Driven Contract Testing in CI, ephemeral on-demand preview environments, and testing in production using canary releases, feature flags, and synthetic traffic."
  ),

  card(
    110,
    "Consumer-Driven Contract Testing with Pact",
    "Testing",
    "Mastery",
    "Consumer-Driven Contract Testing flips API governance: the API consumer (frontend or calling service) writes tests declaring exactly what fields it expects. These expectations are published to a Pact Broker, which verifies the API provider before deployment.",
    `// Consumer Contract Test with Pact (Node.js Jest):
import { PactV3, MatchersV3 } from "@pact-foundation/pact";
const { string, integer } = MatchersV3;

const provider = new PactV3({
  consumer: "OrderServiceClient",
  provider: "PaymentServiceProvider",
  dir: "./pacts"
});

describe("Payment Service Contract Verification", () => {
  it("successfully processes an authorization charge", async () => {
    // 1. Declare consumer expectations
    provider
      .given("user has sufficient funds")
      .uponReceiving("a charge request")
      .withRequest({
        method: "POST",
        path: "/v1/charges",
        headers: { "Content-Type": "application/json" },
        body: { amountCents: integer(5000), currency: string("USD") }
      })
      .willRespondWith({
        status: 201,
        headers: { "Content-Type": "application/json" },
        body: {
          chargeId: string("ch_123456"),
          status: string("AUTHORIZED")
        }
      });

    // 2. Execute against local Pact mock server
    await provider.executeTest(async (mockserver) => {
      const client = new PaymentClient(mockserver.url);
      const res = await client.charge(5000, "USD");
      expect(res.status).toBe("AUTHORIZED");
    });
  });
});
// 3. Pact JSON is pushed to Pact Broker. In Provider's CI:
// 'pact-broker can-i-deploy' verifies Provider supports all active Consumer versions!`,
    ["Contract Testing", "Pact", "Consumer-Driven", "Pact Broker", "can-i-deploy"],
    [
      { title: "Pact Contract Testing Documentation", url: "https://docs.pact.io/" }
    ],
    "What is the operational purpose of the `can-i-deploy` CLI tool in a Pact workflow?",
    "It queries the Pact Broker matrix to verify whether the specific version of a microservice you are about to deploy is fully compatible with the exact versions of all consumers and providers currently running in the target production environment.",
    "How does Consumer-Driven Contract Testing prevent breaking changes from reaching production?",
    "If a provider team attempts to rename or delete a field that a consumer contract still relies upon, the provider's CI test suite fails immediately before the code can be merged or deployed, catching breaking changes at build time."
  ),

  card(
    111,
    "Component & Integration Testing: Testcontainers & WireMock",
    "Testing",
    "Mastery",
    "Component testing verifies a single microservice with real backing infrastructure (PostgreSQL, Kafka, Redis) running in ephemeral Docker containers via Testcontainers, while isolating external third-party HTTP microservices using WireMock stubs.",
    `// Integration Test using Testcontainers and WireMock (Node.js):
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { WireMockServer } from "wiremock-captain"; // or wiremock docker
import { Pool } from "pg";

describe("OrderService Integration Test", () => {
  let pgContainer: any;
  let wiremock: any;
  let dbPool: Pool;

  beforeAll(async () => {
    // 1. Spin up real disposable PostgreSQL container for database tier
    pgContainer = await new PostgreSqlContainer("postgres:15-alpine").start();
    dbPool = new Pool({ connectionString: pgContainer.getConnectionUri() });
    await runMigrations(dbPool);

    // 2. Stub external Payment microservice with WireMock
    wiremock = new WireMockServer({ port: 9999 });
    wiremock.register({
      request: { method: "POST", url: "/v1/charges" },
      response: { status: 200, body: JSON.stringify({ id: "mock_tx_1" }) }
    });
  }, 30000);

  afterAll(async () => {
    await dbPool.end();
    await pgContainer.stop();
    wiremock.stop();
  });

  it("creates order and triggers payment stub", async () => {
    const orderService = new OrderService(dbPool, "http://localhost:9999");
    const order = await orderService.createOrder({ amount: 100, item: "Laptop" });

    expect(order.status).toBe("CONFIRMED");
    // Verify real PostgreSQL persistence
    const res = await dbPool.query("SELECT * FROM orders WHERE id = $1", [order.id]);
    expect(res.rows.length).toBe(1);
  });
});`,
    ["Testcontainers", "WireMock", "Integration Testing", "Docker Ephemeral", "Component Testing"],
    [
      { title: "Testcontainers Official Guide", url: "https://testcontainers.com/" }
    ],
    "Why are Testcontainers superior to in-memory database mocks (like SQLite or H2) for testing?",
    "In-memory mocks do not execute engine-specific SQL features (JSONB operators, `ON CONFLICT DO UPDATE`, stored procedures, locking behaviors). Testcontainers spins up the exact real production database engine (e.g. Postgres 15), catching syntax and constraint bugs in CI.",
    "What role does WireMock play in microservice component testing?",
    "WireMock acts as an HTTP mock server that simulates external microservice APIs, returning pre-programmed JSON responses and simulating network faults (500 errors, delays) to verify how the microservice handles downstream behavior."
  ),

  card(
    112,
    "Backward & Forward Compatibility: The Tolerant Reader",
    "Architecture",
    "Mastery",
    "In microservices, you cannot deploy all services simultaneously. The Tolerant Reader Pattern dictates that services must ignore unknown JSON fields (forward compatibility) and producers must never remove or mutate existing fields (backward compatibility).",
    `// The Tolerant Reader Principle:
// "Be conservative in what you send, be liberal in what you accept." (Postel's Law)

// Anti-Pattern: Strict Zod schema rejecting unexpected fields (Breaks Forward Compatibility)
// const OrderSchema = z.object({ id: z.string(), total: z.number() }).strict(); // BAD: Throws on extra fields!

// Correct Pattern: Tolerant Zod Schema (Ignores unknown incoming fields)
import { z } from "zod";

export const TolerantOrderSchema = z.object({
  id: z.string(),
  totalCents: z.number()
  // Any new fields added by future upstream releases (e.g., taxCents, discountCode)
  // are safely ignored without breaking this consumer!
}).passthrough();

// Compatibility Rules for Microservices APIs:
// 1. ADDING fields is safe (Additive changes are backward compatible).
// 2. REMOVING or RENAMING fields is a BREAKING change.
// 3. CHANGING field types (e.g. string to number) is a BREAKING change.
// 4. Changing validation rules (e.g. making an optional field required) is a BREAKING change.`,
    ["Tolerant Reader", "Postel's Law", "Backward Compatibility", "Forward Compatibility", "Schema Evolution"],
    [
      { title: "Martin Fowler: Tolerant Reader", url: "https://martinfowler.com/bliki/TolerantReader.html" }
    ],
    "What is the difference between Backward Compatibility and Forward Compatibility?",
    "Backward compatibility means a newer version of a service can process data generated by older versions. Forward compatibility means an older version of a service can gracefully process data generated by newer versions without crashing.",
    "How should a team handle a breaking field change when backward compatibility cannot be maintained?",
    "Deploy a new API endpoint version (e.g. `/v2/orders`), run both v1 and v2 concurrently, notify consumers, monitor traffic migration via metrics, and decommission `/v1` only after all clients have upgraded."
  ),

  card(
    113,
    "Zero-Downtime Deployment: Rolling vs Blue-Green vs Canary",
    "Deployment",
    "Mastery",
    "Deploying microservice updates must occur without dropping active user connections or interrupting system availability. Engineering teams choose between Rolling Updates (incremental), Blue-Green (instant cutover), and Canary Releases (gradual traffic validation).",
    `// Deployment Strategies Comparison:
// 1. Rolling Update:
//    - Replaces old pods with new pods incrementally (e.g. 25% at a time).
//    - Pros: Efficient resource utilization (no double capacity needed).
//    - Cons: Slow rollback; multiple versions coexist in the cluster simultaneously.

// 2. Blue-Green Deployment:
//    - Two identical production environments: Blue (active live) and Green (new release).
//    - Validate Green with synthetic tests, then switch router/load balancer instantly.
//    - Pros: Instant cutover and instantaneous rollback (flip router back to Blue).
//    - Cons: Doubles compute and infrastructure costs during deployment.

// 3. Canary Deployment:
//    - Routes 1-5% of live production traffic to the new version.
//    - Automated analysis checks Error Rate and Latency against baseline.
//    - If healthy, incrementally promotes to 25%, 50%, 100%. If unhealthy, aborts automatically.

// Argo Rollouts Canary Specification (Kubernetes CRD):
/*
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: order-service-rollout
spec:
  replicas: 10
  strategy:
    canary:
      steps:
        - setWeight: 5
        - pause: { duration: 10m } # Bake time: check Prometheus error metrics
        - setWeight: 20
        - pause: { duration: 10m }
        - setWeight: 50
        - pause: { duration: 5m }
*/`,
    ["Zero-Downtime", "Canary Deployment", "Blue-Green", "Rolling Update", "Argo Rollouts"],
    [
      { title: "Argo Rollouts Architecture", url: "https://argoproj.github.io/argo-rollouts/" }
    ],
    "Why must database schema migrations always be backward compatible during a Rolling or Blue-Green deployment?",
    "During deployment, both the old version (v1) and new version (v2) run simultaneously and query the same database. If v2 applies a destructive migration (like dropping a column or table), v1 pods will crash immediately, causing widespread user outages.",
    "What is 'Bake Time' in a canary deployment?",
    "The period during which the canary runs at a low traffic percentage (e.g. 5%) while automated analysis monitors error rates, CPU/memory, and latency percentiles to detect subtle regressions before full rollout."
  ),

  card(
    114,
    "GitOps & Declarative Delivery: ArgoCD & Flux",
    "Deployment",
    "Mastery",
    "GitOps establishes Git as the Single Source of Truth for declarative infrastructure and application state. Automated reconciliation controllers (ArgoCD, Flux) pull changes from Git and eliminate direct developer `kubectl` write access to production clusters.",
    `// GitOps Operating Model:
// 1. Developers push code -> CI builds container image -> Pushes image to Registry.
// 2. CI updates deployment manifest repo (e.g. image tag: "order-service:v2.1.0").
// 3. ArgoCD Controller in Kubernetes detects drift between Git and live cluster.
// 4. ArgoCD reconciles the cluster to match the Git state automatically.

// ArgoCD Application Declarative Manifest (app.yaml):
/*
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: order-service-production
  namespace: argocd
spec:
  project: default
  source:
    repoURL: "https://github.com/enterprise/gitops-manifests.git"
    targetRevision: main
    path: apps/order-service/overlays/production
  destination:
    server: "https://kubernetes.default.svc"
    namespace: production
  syncPolicy:
    automated:
      prune: true     # Deletes resources deleted from Git
      selfHeal: true  # Reverts unauthorized manual changes made via kubectl!
    syncOptions:
      - CreateNamespace=true
*/`,
    ["GitOps", "ArgoCD", "Flux", "Declarative Delivery", "Drift Detection"],
    [
      { title: "OpenGitOps Principles", url: "https://opengitops.net/" }
    ],
    "What is 'Self-Healing' in GitOps, and how does it prevent configuration drift?",
    "If an engineer bypasses CI/CD and manually edits a live pod, deployment, or configmap using `kubectl edit`, the GitOps controller detects the divergence from Git and automatically overwrites the cluster state back to the committed Git definition.",
    "Why is a 'Pull-based' GitOps model more secure than a 'Push-based' CI/CD script running `kubectl`?",
    "In push-based CI/CD, external CI servers (GitHub Actions, Jenkins) must hold permanent cluster-admin credentials to execute deployments. In pull-based GitOps, the controller runs inside the cluster and pulls manifests; no external systems hold cluster write credentials."
  ),

  card(
    115,
    "Feature Flag Management & Trunk-Based Development",
    "Deployment",
    "Mastery",
    "Feature flags (LaunchDarkly, Unleash, Flipt) decouple code deployment from feature release. Microservice teams practice Trunk-Based Development by merging incomplete features into `main` behind disabled flags, eliminating long-lived feature branches and merge hell.",
    `// Feature Flag Evaluation in Microservices (using OpenFeature standard / Unleash):
import { OpenFeature } from "@openfeature/server-sdk";

export class CheckoutService {
  async processPayment(userId: string, amount: number, tenantId: string) {
    const client = OpenFeature.getClient();

    // Contextual evaluation of feature flag
    const context = { targetingKey: userId, tenantId };
    const isNewPaymentEngineEnabled = await client.getBooleanValue(
      "enable-stripe-v2-pipeline",
      false,
      context
    );

    if (isNewPaymentEngineEnabled) {
      console.log("[FeatureFlag] Routing user to new Stripe v2 engine");
      return this.executeStripeV2(userId, amount);
    } else {
      return this.executeLegacyEngine(userId, amount);
    }
  }

  private async executeStripeV2(userId: string, amount: number) { /* ... */ }
  private async executeLegacyEngine(userId: string, amount: number) { /* ... */ }
}

// Kill-Switch Capability:
// If Stripe v2 triggers elevated 500 errors in production, the engineering lead flips the flag
// to FALSE in the UI dashboard. Traffic instantly reverts to the legacy engine in < 1 second
// WITHOUT triggering a code rollback or redeploying containers!`,
    ["Feature Flags", "Trunk-Based Development", "OpenFeature", "Kill-Switch", "Continuous Delivery"],
    [
      { title: "OpenFeature Specification", url: "https://openfeature.dev/docs/reference/intro" }
    ],
    "How do feature flags serve as emergency 'Kill Switches' during incidents?",
    "When a newly released feature degrades production or causes a database lock, flipping the flag to off in a centralized dashboard instantaneously disables the offending code path across all running pods via WebSockets, mitigating the incident in seconds without redeploying.",
    "What technical debt is created when feature flags are not aggressively retired?",
    "Dead code accumulation and combinatorial explosion of code paths. Once a feature is 100% rolled out and stable, teams must clean up the conditional branches and remove the flag from the codebase."
  ),

  card(
    116,
    "Database Migrations: Expand-and-Contract (Parallel Run)",
    "Data",
    "Mastery",
    "In zero-downtime microservices, relational database schema changes cannot execute destructive actions in a single step. The Expand-and-Contract (Parallel Run) pattern executes migrations in three phased, backward-compatible steps across multiple deployments.",
    `// Phased Expand-and-Contract Migration: Renaming 'phone' to 'mobile_number'
// Phase 1: Expand (Release 1)
// - Add new column 'mobile_number' (nullable) to PostgreSQL.
// - Application writes to BOTH 'phone' AND 'mobile_number' (Dual-Write).
// - Application reads from old 'phone' column.

// SQL Migration 1 (Expand):
/*
ALTER TABLE customers ADD COLUMN mobile_number VARCHAR(30);
*/

// Phase 2: Backfill & Switch Reads (Release 2)
// - Run background async worker backfilling historical rows:
/*
UPDATE customers SET mobile_number = phone WHERE mobile_number IS NULL;
*/
// - Deploy Release 2: Application reads from 'mobile_number'.
// - Application continues dual-writing to both columns.

// Phase 3: Contract (Release 3)
// - Verify Release 2 is 100% stable in production.
// - Deploy Release 3: Application writes exclusively to 'mobile_number'.
// - SQL Migration 2 (Contract): Drop deprecated column:
/*
ALTER TABLE customers DROP COLUMN phone;
*/`,
    ["Expand and Contract", "Parallel Run", "Zero-Downtime Migration", "Dual-Write", "Database Evolution"],
    [
      { title: "Martin Fowler: Evolutionary Database Design", url: "https://martinfowler.com/articles/evodb.html" }
    ],
    "Why can't you simply run `ALTER TABLE customers RENAME COLUMN phone TO mobile_number;` in production?",
    "The rename is an instantaneous breaking change. Active running microservice pods still execute SQL queries referencing `phone`. The moment the column is renamed, all active pods fail with `column 'phone' does not exist`, causing downtime until new code finishes rolling out.",
    "What is the danger of Dual-Writing in application code, and how can database triggers mitigate it?",
    "Application crashes during dual-writes can leave the new and old columns out of sync. Using a temporary PostgreSQL trigger (`CREATE TRIGGER sync_phone ... BEFORE INSERT OR UPDATE`) guarantees that writes to either column are atomically mirrored at the database engine level."
  ),

  card(
    117,
    "Disaster Recovery: Active-Active vs Active-Passive Failover",
    "Reliability",
    "Mastery",
    "Enterprise microservices design Disaster Recovery (DR) architectures across multiple geographic cloud regions to survive full datacenter outages. Active-Active serves live traffic simultaneously from all regions; Active-Passive maintains a standby region.",
    `// Disaster Recovery Strategy Spectrum:
// 1. Active-Passive (Warm Standby / Pilot Light):
//    - Primary region (us-east-1) handles 100% traffic.
//    - Secondary region (us-west-2) receives asynchronous DB replication.
//    - On failure: DNS (Route 53) shifts traffic to secondary; scale up pods.
//    - Tradeoff: Simpler data consistency; RPO > 0 (few seconds data loss), RTO ~ 5-15 minutes.

// 2. Active-Active (Multi-Region Primary):
//    - Both regions process live reads and writes simultaneously.
//    - Requires Globally Distributed Databases (CockroachDB, Google Cloud Spanner, DynamoDB Global Tables).
//    - Conflict Resolution: Last-Write-Wins (LWW) or Conflict-Free Replicated Data Types (CRDTs).
//    - Tradeoff: RTO ≈ 0, RPO ≈ 0; extreme operational complexity and write latency (speed of light).

// Mathematical DR Metrics:
export interface DRMetrics {
  rpoSeconds: number; // Recovery Point Objective: Maximum tolerable data loss duration
  rtoSeconds: number; // Recovery Time Objective: Maximum tolerable system downtime
}

export class DisasterRecoveryPolicy {
  static evaluateSLA(tier: "TIER_1_CRITICAL" | "TIER_3_INTERNAL"): DRMetrics {
    if (tier === "TIER_1_CRITICAL") {
      // Mission-critical payments: zero data loss, instant failover
      return { rpoSeconds: 0, rtoSeconds: 30 };
    }
    return { rpoSeconds: 3600, rtoSeconds: 14400 }; // 1 hr data loss, 4 hr restore
  }
}`,
    ["Disaster Recovery", "Active-Active", "Active-Passive", "RPO", "RTO"],
    [
      { title: "AWS Disaster Recovery Options in the Cloud", url: "https://docs.aws.amazon.com/whitepapers/latest/disaster-recovery-workloads-on-aws/disaster-recovery-options-in-the-cloud.html" }
    ],
    "What is the difference between RPO (Recovery Point Objective) and RTO (Recovery Time Objective)?",
    "RPO measures acceptable data loss expressed in time (e.g. 'Can we tolerate losing the last 30 seconds of transactions?'). RTO measures acceptable downtime (e.g. 'How long can the system remain offline before service is restored?').",
    "What is the primary technical impediment to running relational databases in Active-Active Multi-Region mode?",
    "The Speed of Light and CAP Theorem. Synchronous cross-region replication (e.g. Virginia to Frankfurt) incurs 80–120ms network roundtrip latency per transaction commit. Asynchronous replication avoids the latency penalty but risks split-brain conflicts and data loss during failover."
  ),

  card(
    118,
    "Externalized Dynamic Configuration Management",
    "Architecture",
    "Core",
    "Microservice configuration must be externalized from source code and container images (Twelve-Factor Factor III). Dynamic configuration systems (Consul KV, Spring Cloud Config, AWS AppConfig) push non-sensitive configuration changes in real time without restarting pods.",
    `// Dynamic Configuration Architecture:
// [Central Config Store (Consul / etcd / AWS AppConfig)]
//                   |
//                   v (Long Polling / Webhook Push / Watch)
//    [Microservice Pod (Local in-memory Cache with live reload)]

import EventEmitter from "node:events";

export class DynamicConfigStore extends EventEmitter {
  private config: Record<string, any> = {};

  constructor(private consulClient: any, private serviceKey: string) {
    super();
  }

  async initialize() {
    this.config = await this.consulClient.get(this.serviceKey);

    // Watch for dynamic updates from central store
    this.consulClient.watch(this.serviceKey, (updatedValues: any) => {
      console.log("[Config] Dynamic configuration changed remotely. Hot-reloading...");
      this.config = updatedValues;
      this.emit("change", this.config);
    });
  }

  get<T>(key: string, defaultValue: T): T {
    return this.config[key] !== undefined ? this.config[key] : defaultValue;
  }
}

// Microservice consuming dynamic config without container restart:
// const maxBatchSize = dynamicConfig.get("BATCH_PROCESSING_LIMIT", 50);`,
    ["Dynamic Configuration", "Consul KV", "Externalized Config", "Twelve-Factor App", "Hot Reload"],
    [
      { title: "The Twelve-Factor App: III. Config", url: "https://12factor.net/config" }
    ],
    "Why is baking environment configurations directly into Docker images an anti-pattern?",
    "It breaks the immutability of build artifacts. You should build a single container image once in CI and deploy that exact identical binary artifact across Development, Staging, and Production environments, injecting environment configuration via dynamic stores or environment variables.",
    "What safeguard must be implemented when consuming dynamic configuration to prevent cluster outages from typos?",
    "Strict schema validation (Zod/JSON Schema) at configuration ingestion time. If an operator accidentally updates a timeout from `5000` to `5000s` or `-1`, the service must reject the malformed update, retain its previous valid configuration, and trigger an alert."
  ),

  card(
    119,
    "The 5 Lethal Microservices Anti-Patterns",
    "Architecture",
    "Mastery",
    "Adopting microservices without architectural rigor results in common fatal anti-patterns: Entity Services, Nano-Services, Distributed Monoliths, Chatty Network Calls, and Shared Databases.",
    `// The 5 Lethal Microservice Anti-Patterns:

// 1. The Distributed Monolith:
//    Services are physically separated into different repositories and pods, but cannot be deployed
//    or changed without synchronously redeploying 10 other services. (Worst of both worlds: monolith latency, distributed complexity).

// 2. Entity Services (CRUD-over-HTTP):
//    Creating a microservice for every single database table (/user-service, /order-service, /product-service).
//    Result: Business logic is scattered across clients, leading to extreme network chattiness and zero domain encapsulation.

// 3. Nano-Services (Over-Fragmentation):
//    Decomposing services into micro-slices of 20 lines of code (e.g. /tax-calculator-service).
//    Result: Network latency and serialization overhead completely overwhelm execution time.

// 4. Shared Database Anti-Pattern:
//    Multiple microservices connecting directly to the same shared PostgreSQL schema.
//    Result: Breaks data encapsulation; schema changes break unrelated teams.

// 5. Chatty APIs (N+1 Network Calls):
//    A service making hundreds of synchronous HTTP roundtrips to retrieve items in a loop.`,
    ["Anti-Patterns", "Distributed Monolith", "Entity Service", "Nano-Services", "Shared Database"],
    [
      { title: "Martin Fowler: Microservice Prerequisites", url: "https://martinfowler.com/bliki/MicroservicePrerequisites.html" }
    ],
    "What defines a 'Distributed Monolith' and why is it worse than a traditional monolith?",
    "A distributed monolith possesses all the disadvantages of a distributed system (network latency, partial failure, complex tracing, distributed transactions) while retaining all the coupling of a monolith (cannot deploy services independently; changes cascade across multiple repos).",
    "How do you recognize an 'Entity Service' anti-pattern in a codebase?",
    "The service consists entirely of anemic CRUD endpoints (`GET /entity/:id`, `PUT /entity/:id`) without rich business operations or domain logic, while calling services execute all calculations and business rules externally."
  ),

  card(
    120,
    "Microservices Readiness Scorecard: When Monolith is Better",
    "Architecture",
    "Mastery",
    "Microservices are not a default architecture; they are an organizational scalability solution. For early-stage startups and small teams, a well-structured Modular Monolith delivers 10x higher development velocity, zero distributed transaction overhead, and minimal operational cost.",
    `// The Microservices Readiness Scorecard:
// Martin Fowler: "Don't even consider microservices unless you have a system that's too complex
// to manage as a monolith."

export interface OrganizationalMetrics {
  engineerCount: number;
  distinctDomainsCount: number;
  deploymentBottlenecks: boolean;
  hasDevOpsPlatformTeam: boolean;
  cloudBudgetMonthly: number;
}

export class MicroservicesReadinessEvaluator {
  static evaluate(metrics: OrganizationalMetrics): { recommend: "MODULAR_MONOLITH" | "MICROSERVICES"; rationale: string } {
    // 1. Team Size Rule (Conway's Law):
    // Microservices solve team communication bottlenecks. If you have < 25 engineers, microservices are a tax.
    if (metrics.engineerCount < 20) {
      return {
        recommend: "MODULAR_MONOLITH",
        rationale: "Small team. Microservices operational overhead (Kubernetes, CI/CD, tracing, mesh) will consume 50% of engineering bandwidth."
      };
    }

    // 2. Platform Infrastructure Maturity:
    if (!metrics.hasDevOpsPlatformTeam) {
      return {
        recommend: "MODULAR_MONOLITH",
        rationale: "No dedicated platform engineering team to manage observability, service discovery, and zero-trust security."
      };
    }

    return {
      recommend: "MICROSERVICES",
      rationale: "Organization exhibits independent cross-functional teams with verified deployment contention and domain scale."
    };
  }
}`,
    ["Modular Monolith", "Readiness Scorecard", "Conway's Law", "Architectural Decision", "Team Scalability"],
    [
      { title: "Martin Fowler: MonolithFirst", url: "https://martinfowler.com/bliki/MonolithFirst.html" }
    ],
    "What is a 'Modular Monolith' and why is it often the optimal initial architecture?",
    "A Modular Monolith enforces strict module boundaries, interfaces, and encapsulated data models within a single unified deployable codebase. It gives you clean domain architecture with zero network latency, atomic ACID transactions, and simple CI/CD until organizational scale justifies microservices.",
    "What is the single most critical organizational prerequisite before migrating to microservices?",
    "High engineering headcount organized into autonomous cross-functional teams experiencing severe release coordination bottlenecks in a monolithic repository, supported by a mature platform engineering team capable of operating distributed infrastructure."
  )
];

module.exports = { cards };
