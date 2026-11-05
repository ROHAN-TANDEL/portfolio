const { createCard } = require("../hld_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 73,
    category: "Microservices, Resilience & Observability",
    concept: "Monolith vs Microservices vs Service-Oriented Architecture (SOA)",
    priority: "must-know",
    difficulty: "must-know",
    question: "What are the architectural trade-offs between Monoliths and Microservices, and what organizational tipping points justify migrating away from a Modular Monolith?",
    answer: "A Monolith runs all business modules within a single process and codebase sharing a unified database, offering simple local debugging and zero network serialization overhead; Microservices partition domains into independently deployable, polyglot services communicating over networks with decentralized databases. Migration is justified when organizational scaling bottlenecks (merge conflicts, deployment queues, release coordination across 50+ engineers) outweigh network complexity.",
    explanation: `Comparative Analysis:
1. Monolith & Modular Monolith:
   - Structure: Single binary (e.g., Rails, Django, Go monolith).
   - Strengths: Fast local development, simple ACID database transactions, zero network latency between modules, single deployment pipeline.
   - Bottlenecks at Scale:
     - Deployment Couplings: One bug in user profile crashes the entire payment checkout system.
     - Build/Test Times: CI/CD test suites take 45+ minutes.
     - Team Scaling: 100+ engineers merging PRs into a single repo create continuous git conflicts and deployment lockups.
2. Microservices Architecture:
   - Structure: Bounded contexts (Domain-Driven Design) deployed as separate services.
   - Database-per-Service: Each microservice owns its private database. No direct cross-service SQL queries!
   - Strengths: Autonomous deployment cadences, localized failure domains, independent horizontal autoscaling (scale only the heavy video encoder, not the auth service).
   - Distributed Tax: Network latency, distributed transactions (Sagas), partial failures, eventual consistency, complex observability requirements.`,
    code: `/*
Monolith vs Microservices Topology:

Monolith:
[ Client ] ──> [ Single Monolithic Process (Auth + Orders + Payments) ]
                               │
                       [ Monolithic DB ]

Microservices:
                     ┌──> [ Auth Service ] ──> [ Auth DB ]
[ Client ] ──> [ API Gateway ] ─┼──> [ Order Service ] ──> [ Order DB ]
                     └──> [ Payment Service ] ──> [ Payment DB ]
*/`,
    recallHint: "Monolith: Simple deployment, fast in-memory calls. Microservices: Autonomous teams and independent scale, but high distributed complexity.",
    interviewTip: "Never say 'Microservices are always better.' Start with: 'We should begin with a well-factored Modular Monolith until team size or independent scaling requirements justify the distributed complexity of Microservices.'",
    tags: ["microservices", "monolith", "modular-monolith", "architecture", "domain-driven-design"]
  }),

  createCard({
    idNum: 74,
    category: "Microservices, Resilience & Observability",
    concept: "Domain-Driven Design (DDD): Bounded Contexts & Ubiquitous Language",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do Domain-Driven Design (DDD) concepts like Bounded Contexts, Ubiquitous Language, and Aggregates define clean microservice boundaries?",
    answer: "Domain-Driven Design aligns software architecture with real-world business domains. A Bounded Context sets an explicit linguistic boundary where a model applies: a 'User' in the Auth context (email, password hash) has an entirely different definition in the Shipping context (delivery address, phone number). Service boundaries map 1:1 with Bounded Contexts, preventing tightly coupled monolithic data models.",
    explanation: `Core DDD Concepts for Microservices:
1. Ubiquitous Language:
   - A rigorous, shared vocabulary co-created by domain experts (product managers, business teams) and software engineers.
   - The same words are used in code, API payloads, database columns, and business meetings without ambiguity.
2. Bounded Context:
   - An explicit boundary within which a domain model applies consistently.
   - The 'Product' entity:
     - In **Catalog Context**: title, description, high-res photos, category tags.
     - In **Inventory Context**: SKU, warehouse bin location, physical weight, dimensions.
     - In **Billing Context**: price, tax code, currency.
   - Forcing all three into a single mega-table creates monolithic spaghetti. DDD isolates each into its own microservice bounded context.
3. Aggregates & Entities:
   - An Aggregate is a cluster of associated domain objects treated as a single transactional unit (e.g., \`Order\` and \`OrderItem\`).
   - All external access must go through the **Aggregate Root** (\`Order\`), ensuring business invariant rules are never bypassed.`,
    code: `// Domain-Driven Design Aggregate Root in TypeScript
export class OrderAggregate {
  private id: string;
  private items: OrderItem[] = [];
  private status: "DRAFT" | "SUBMITTED" | "CANCELLED" = "DRAFT";

  // Business invariant enforced inside Aggregate Root
  addItem(productId: string, price: number, quantity: number) {
    if (this.status !== "DRAFT") {
      throw new Error("Cannot add items to an order that is already submitted");
    }
    if (quantity <= 0) throw new Error("Quantity must be positive");
    this.items.push(new OrderItem(productId, price, quantity));
  }

  submitOrder() {
    if (this.items.length === 0) throw new Error("Cannot submit an empty order");
    this.status = "SUBMITTED";
    // Emit Domain Event
    DomainEvents.publish(new OrderSubmittedEvent(this.id, this.items));
  }
}`,
    recallHint: "DDD: Bounded context sets the service boundary; Ubiquitous language unites code and business.",
    interviewTip: "When asked how to split a system into microservices, state: 'We apply Domain-Driven Design to identify Bounded Contexts and Aggregate roots, ensuring services align with business capabilities rather than technical layers.'",
    tags: ["ddd", "domain-driven-design", "bounded-context", "microservices", "aggregates"]
  }),

  createCard({
    idNum: 75,
    category: "Microservices, Resilience & Observability",
    concept: "Service Discovery: Client-Side vs Server-Side (Consul, Eureka, DNS)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Compare Client-Side Service Discovery (Netflix Eureka) with Server-Side Service Discovery (AWS ALB, Kubernetes DNS/Kube-Proxy) in cloud environments.",
    answer: "Service discovery maps logical service names to dynamic IP:Port endpoints of ephemeral pods. Client-side discovery queries a service registry (Consul/Eureka) directly and load-balances client-side (fewer network hops, but language-dependent SDKs); Server-side discovery routes requests to an intermediary load balancer/proxy (Kubernetes Kube-Proxy/AWS ALB) that queries the registry and forwards traffic (language-agnostic, but extra network hop).",
    explanation: `The Problem:
In containerized environments (Kubernetes, AWS ECS), service instances are ephemeral: IP addresses change constantly due to autoscaling, rolling restarts, and node crashes.

1. Client-Side Service Discovery (e.g., Netflix Eureka, HashiCorp Consul):
   - Client microservice queries Service Registry periodically to cache active IP endpoints locally.
   - Client executes load balancing algorithm (e.g., Ribbon / gRPC client load balancer) to pick an IP and calls it directly.
   - Pros: Direct communication (sub-millisecond, zero intermediate hops); no load balancer bottleneck.
   - Cons: Requires custom client SDK in every programming language (Node, Python, Go, Java).
2. Server-Side Service Discovery (e.g., Kubernetes CoreDNS + Kube-Proxy, AWS ALB):
   - Client simply calls \`http://order-service/orders\`.
   - CoreDNS resolves to a stable Virtual ClusterIP.
   - Kube-Proxy (using Linux \`iptables\` or \`IPVS\`) or an ALB intercepts the packet, load balances across backing pods, and forwards.
   - Pros: Completely transparent and language-agnostic; standard HTTP/DNS.
   - Cons: Additional proxy hop; potential routing proxy bottleneck if not using kernel-level IPVS.`,
    code: `/*
Service Discovery Topologies:

Client-Side Discovery:
[ Client Pod ] ──(1. Query Registry)──> [ Consul / Eureka Registry ]
      │ (2. Pick IP locally)
      └────────────────(3. Direct HTTP)─────────────────> [ Order Pod 10.0.2.14:8080 ]

Server-Side Discovery (Kubernetes):
[ Client Pod ] ──(Calls 'order-service')──> [ Kube-Proxy / ClusterIP ]
                                                    ├──> [ Pod 1 (10.0.2.14) ]
                                                    └──> [ Pod 2 (10.0.2.19) ]
*/`,
    recallHint: "Client-side: Client asks registry, calls pod directly. Server-side: Client calls stable virtual IP, proxy routes.",
    interviewTip: "Modern cloud-native platforms have standardized on Server-Side discovery backed by Kubernetes CoreDNS and Service Meshes (Envoy/Istio).",
    tags: ["service-discovery", "consul", "eureka", "kubernetes", "networking", "microservices"]
  }),

  createCard({
    idNum: 76,
    category: "Microservices, Resilience & Observability",
    concept: "Service Mesh Architecture: Data Plane (Envoy) vs Control Plane (Istio)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a Service Mesh, and how does the separation between the Data Plane (Sidecar Envoy proxies) and the Control Plane (Istio) decouple networking from business code?",
    answer: "A Service Mesh is a dedicated infrastructure layer that transparently manages inter-service communication. The Data Plane runs lightweight sidecar proxies (Envoy) alongside every application container, intercepting all inbound and outbound network traffic to provide mTLS, retries, and metrics; the Control Plane (Istio/Linkerd) centrally manages policies, certificates, and routes, pushing configurations to proxies via xDS APIs.",
    explanation: `Why Service Mesh Was Invented:
Before Service Mesh, every microservice had to import heavy application libraries (Resilience4j, Hystrix, OpenTelemetry) to handle retries, circuit breaking, mTLS, and distributed tracing. Upgrading a security cipher required rebuilding and redeploying 500 individual microservice repositories in 5 languages!

The Service Mesh Separation of Concerns:
1. Data Plane (Envoy Proxy Sidecars):
   - An Envoy container runs inside the same Kubernetes Pod as the business container.
   - Linux \`iptables\` automatically intercepts all TCP traffic in and out of the pod.
   - Functions: Mutual TLS (mTLS) encryption, traffic shifting (canary 90/10 split), circuit breaking, distributed trace header injection (\`traceparent\`), Prometheus metrics.
   - Application container communicates via plain \`localhost\` without knowing Envoy exists!
2. Control Plane (Istio \`istiod\`):
   - Central brain. Translates human YAML configs (VirtualServices, DestinationRules) into machine configurations.
   - Distributes configs to thousands of Envoy sidecars dynamically via gRPC (xDS protocol).
   - Functions as an internal Certificate Authority (CA) issuing and rotating short-lived mTLS certificates automatically.`,
    code: `/*
Service Mesh Pod Architecture:

[ Kubernetes Pod: Order Service ]
┌──────────────────────────────────────────────┐
│  [ Application Container (Node.js) ]         │
│         ▲                                    │
│         │ (Plain HTTP over localhost)        │
│         ▼                                    │
│  [ Sidecar Container (Envoy Proxy) ]        │
└──────────────────────┬───────────────────────┘
                       │ (Encrypted mTLS over Wire)
                       ▼
[ Kubernetes Pod: Payment Service ]
┌──────────────────────────────────────────────┐
│  [ Sidecar Container (Envoy Proxy) ]        │
│         ▲                                    │
│         │ (Plain HTTP over localhost)        │
│         ▼                                    │
│  [ Application Container (Java/Go) ]         │
└──────────────────────────────────────────────┘
*/`,
    recallHint: "Data plane (Envoy): Sidecar proxy in every pod. Control plane (Istio): Central brain pushing policies.",
    interviewTip: "Highlight the trade-off of a Service Mesh: it adds ~1.5–3ms of CPU/latency overhead per network hop and significant memory overhead (each sidecar consumes 50MB RAM). Use it only when zero-trust mTLS or complex traffic shaping is mandated.",
    tags: ["service-mesh", "istio", "envoy", "sidecar", "microservices", "networking"]
  }),

  createCard({
    idNum: 77,
    category: "Microservices, Resilience & Observability",
    concept: "Distributed Tracing: OpenTelemetry, W3C TraceContext & Span Propagation",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Distributed Tracing track a single user transaction across dozens of asynchronous microservices using W3C TraceContext headers (Trace ID vs Span ID)?",
    answer: "Distributed tracing tracks a request's path through microservices by generating a globally unique Trace ID at the ingress gateway and passing it along with parent-child Span IDs via HTTP headers (\`traceparent\`). Each service reports span start/end timestamps and metadata to a collector (OpenTelemetry/Jaeger), which reconstructs a directed acyclic graph (DAG) flame graph revealing the exact latency bottleneck.",
    explanation: `The Anatomy of a Distributed Trace:
- **Trace ID**: A globally unique 16-byte hex identifier that represents the *entire end-to-end user transaction* across all services.
- **Span ID**: An 8-byte hex identifier representing a *single atomic unit of work* within a single service (e.g., executing an HTTP call or SQL query).
- **Parent Span ID**: Points to the span that triggered the current operation, establishing a hierarchical tree structure.

W3C TraceContext Standard Header (\`traceparent\`):
\`\`\`
traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
              │  └──────────── Trace ID ───────────┘ └─ Span ID ─┘ └ Flags
              └─ Version
\`\`\`

Context Propagation:
When Service A calls Service B over HTTP or Kafka, Service A's HTTP client or Kafka producer *must* extract the current trace context and inject the \`traceparent\` header into the outgoing request.
If any intermediate service drops the header, the trace tree is broken, making downstream latencies invisible!`,
    code: `// OpenTelemetry Manual Context Propagation in Node.js
import { trace, context, propagation } from "@opentelemetry/api";

export async function callDownstreamService(url: string) {
  const tracer = trace.getTracer("order-service");

  return tracer.startActiveSpan("Call Payment Service", async (span) => {
    try {
      const headers: Record<string, string> = {};
      // Inject current trace context into outgoing headers
      propagation.inject(context.active(), headers);

      const response = await fetch(url, { headers });
      span.setAttribute("http.status_code", response.status);
      return await response.json();
    } catch (error) {
      span.recordException(error);
      span.setStatus({ code: 2, message: error.message }); // Error status
      throw error;
    } finally {
      span.end(); // Record execution duration
    }
  });
}`,
    recallHint: "Trace ID = the entire journey; Span ID = one step. Passed via 'traceparent' header.",
    interviewTip: "When diagnosing a p99 tail latency spike in microservices, state that Distributed Tracing (OpenTelemetry/Jaeger) is the primary tool to immediately pinpoint which downstream service or database query is stalling the request.",
    tags: ["distributed-tracing", "opentelemetry", "trace-id", "jaeger", "observability", "w3c"]
  }),

  createCard({
    idNum: 78,
    category: "Microservices, Resilience & Observability",
    concept: "Centralized Logging & Telemetry: Prometheus, Metrics Types & OpenSearch/Loki",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Contrast Pull-based vs Push-based metrics architectures (Prometheus vs StatsD), and explain the differences between Counter, Gauge, and Histogram metric types.",
    answer: "Prometheus uses a pull-based model (scraping metrics over HTTP \`/metrics\` endpoints at regular intervals) to protect against server overload; StatsD/CloudWatch use push-based models (services push metrics over UDP/HTTP). Metric types include: Counter (monotonically increasing integer), Gauge (value that fluctuates up and down), and Histogram (buckets samples into ranges to compute percentiles p95/p99).",
    explanation: `Pull vs Push Metrics Model:
- Pull Model (Prometheus):
  - Prometheus server scrapes \`http://pod-ip:9090/metrics\` every 15 seconds.
  - Advantages: Monitoring system dictates rate of scrape; if traffic surges 100x, monitoring system is NOT overwhelmed by millions of metric packets. Auto-detects dead targets when scrape fails.
  - Challenge: Short-lived batch jobs (AWS Lambda) may terminate before being scraped; requires a Pushgateway intermediary.
- Push Model (Datadog, StatsD):
  - Application sends UDP packets directly to an agent.
  - Advantages: Works well for ephemeral serverless functions.

Core Metric Types:
1. **Counter**: Monotonically increasing counter (e.g., \`http_requests_total\`, \`bytes_sent\`). Resets to 0 on pod restart. Rate of increase calculated via \`rate(http_requests_total[5m])\`.
2. **Gauge**: Instantaneous numerical value that fluctuates up and down (e.g., \`memory_usage_bytes\`, \`active_db_connections\`, \`queue_depth\`).
3. **Histogram**: Measures durations or sizes and groups them into configurable buckets (e.g., requests $< 10\\text{ms}$, $< 50\\text{ms}$, $< 200\\text{ms}$). Crucial for calculating statistical percentiles:
   \`histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m]))\`.`,
    code: `// Prometheus Metric Registration in Node.js (prom-client)
import client from "prom-client";

// Collect default system metrics (CPU, Memory, Event Loop Lag)
client.collectDefaultMetrics();

// 1. Counter: Total HTTP Requests
const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total incoming HTTP requests",
  labelNames: ["method", "route", "status"]
});

// 2. Gauge: Active Database Connections
const dbConnectionsActive = new client.Gauge({
  name: "db_connections_active",
  help: "Currently checked-out database pool connections"
});

// 3. Histogram: Request Latency in seconds
const httpRequestDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency in seconds",
  labelNames: ["route"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5] // Tail latency buckets
});`,
    recallHint: "Pull: Prometheus scrapes. Push: App sends. Counter only goes up; Gauge goes up/down; Histogram calculates p99.",
    interviewTip: "Explain why histograms are critical: you cannot average averages! To calculate true cluster-wide p99 latency across 50 nodes, you must aggregate histogram buckets using `histogram_quantile`.",
    tags: ["metrics", "prometheus", "observability", "histograms", "telemetry", "monitoring"]
  }),

  createCard({
    idNum: 79,
    category: "Microservices, Resilience & Observability",
    concept: "Health Checks: Liveness vs Readiness vs Startup Probes",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why does Kubernetes separate Liveness, Readiness, and Startup probes, and what catastrophic outage occurs if a database dependency check is placed in a Liveness probe?",
    answer: "Startup probes detect when slow-initializing applications finish booting; Liveness probes detect if a process is deadlocked or frozen (triggers container restart); Readiness probes detect if the pod is ready to accept user traffic (removes pod from load balancer endpoints if unready). Placing external dependency checks in a Liveness probe causes all pods to restart simultaneously during a database blip, creating a catastrophic cascading cluster crash.",
    explanation: `The Three Probes in Kubernetes:
1. Startup Probe:
   - Evaluated first. If an app takes 90 seconds to load a machine learning model into RAM, the startup probe gives it time without liveness probes killing it prematurely.
2. Liveness Probe (\`/healthz\`):
   - Question: Is the container process alive, healthy, and not deadlocked?
   - Action on Failure: **Kills and restarts the container!**
   - Rules: Check ONLY internal process health (event loop responsiveness, internal thread status). NEVER check external databases or downstream microservices!
3. Readiness Probe (\`/ready\`):
   - Question: Can this pod accept client traffic right now?
   - Action on Failure: **Stops routing traffic to this pod** (removes from Service Endpoint pool). Does NOT restart the pod!
   - Rules: Check warm-up status, local cache pre-loading, and local resource capacity.

The Liveness Probe Anti-Pattern Disaster:
- Developer writes: \`app.get('/healthz', async () => await db.ping())\`.
- Database undergoes a momentary 3-second failover or connection spike.
- Database ping times out on all 50 Kubernetes pods.
- Kubernetes executes Liveness policy on all 50 pods simultaneously: **terminates and reboots all 50 containers at the exact same second!**
- The entire service suffers a complete outage. When pods reboot, all 50 slam the struggling database with initial connection pools, knocking the DB offline again permanently!`,
    code: `/*
Production Kubernetes Health Check Spec:

livenessProbe:
  httpGet:
    path: /health/liveness      # Checks ONLY local process memory & event loop!
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /health/readiness     # Checks internal buffers & warm state
    port: 3000
  periodSeconds: 5
  failureThreshold: 2           # Removes from Service IP endpoints if busy!
*/`,
    recallHint: "Liveness kills/restarts (process dead). Readiness stops traffic (temporarily busy). Never put DB ping in Liveness!",
    interviewTip: "Mentioning the 'Liveness Probe Database Ping Anti-Pattern' demonstrates real-world battle-tested Kubernetes operational experience.",
    tags: ["kubernetes", "health-checks", "liveness-probe", "readiness-probe", "resilience"]
  }),

  createCard({
    idNum: 80,
    category: "Microservices, Resilience & Observability",
    concept: "Zero-Downtime Deployments: Rolling vs Blue-Green vs Canary",
    priority: "must-know",
    difficulty: "must-know",
    question: "Compare Rolling Updates, Blue-Green Deployments, and Canary Releases in terms of infrastructure cost, rollback speed, and blast radius.",
    answer: "Rolling updates incrementally replace old instances with new ones (zero extra cost, but slow rollbacks and concurrent mixed-version states); Blue-Green maintains two identical production environments and flips the router switch (instantaneous rollback, zero mixed versions, but 2x infrastructure cost); Canary releases route a small fraction (1%–5%) of live traffic to the new version to validate production metrics before full rollout (minimal blast radius).",
    explanation: `Deployment Strategies Breakdown:
1. Rolling Update (Default Kubernetes):
   - Process: Update 1 pod at a time: Pod 1 (v2) -> Pod 2 (v2) -> Pod 3 (v2).
   - Cost: Low (only temporary \`maxSurge\` overhead, e.g., 25% extra pods).
   - Drawbacks: Mixed versions running simultaneously in production (v1 and v2 both active). Database schema changes must be backward-compatible (Expand and Contract pattern).
   - Rollback: Slow. Requires another rolling replacement.
2. Blue-Green Deployment:
   - Process: Active environment is 'Blue'. Deploy complete new version to isolated 'Green' environment. Run smoke tests. Flip load balancer / router DNS to 'Green'.
   - Cost: High (requires 100% duplicate infrastructure capacity during deployment).
   - Advantages: Instantaneous cutover; instant one-click rollback by pointing router back to 'Blue'; zero mixed-version runtime.
3. Canary Release:
   - Process: Deploy v2 to a single canary pod. Route 2% of user traffic to it (often via Envoy / Istio header routing or random percentage).
   - Automated Analysis: Monitor error rates, p99 latency, and CPU metrics for 15 minutes.
   - If error rate exceeds 0.5%, automatically route 100% back to v1 (minimal blast radius).
   - If healthy, progressively promote: 2% -> 10% -> 50% -> 100%.`,
    code: `/*
Canary Deployment Routing (Istio VirtualService):

apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: order-service
spec:
  hosts:
  - order-service
  http:
  - route:
    - destination:
        host: order-service
        subset: v1 (Stable)
      weight: 95
    - destination:
        host: order-service
        subset: v2 (Canary)
      weight: 5
*/`,
    recallHint: "Rolling: one by one, cheap. Blue-Green: duplicate fleet, instant switch, 2x cost. Canary: test 5% of users, lowest blast radius.",
    interviewTip: "Always emphasize that zero-downtime deployments require backward-compatible database migrations (the Expand-Contract / Parallel-Run pattern).",
    tags: ["deployments", "canary", "blue-green", "rolling-update", "devops", "kubernetes"]
  }),

  createCard({
    idNum: 81,
    category: "Microservices, Resilience & Observability",
    concept: "Database Migration Patterns: Expand and Contract (Parallel Run)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the Expand and Contract (Parallel Run) pattern execute breaking database schema changes across microservices with zero downtime?",
    answer: "The Expand and Contract pattern splits breaking schema changes into three backward-compatible phases: (1) Expand (add new columns/tables without removing old ones; dual-write to both); (2) Transition (backfill historical data and switch reads to the new schema); and (3) Contract (stop writing to the old schema and safely drop deprecated columns/tables). This ensures older and newer application versions operate concurrently without failure.",
    explanation: `The Problem of Breaking Schema Changes:
Suppose you want to rename a column in a PostgreSQL table with 100,000,000 rows:
\`ALTER TABLE users RENAME COLUMN full_name TO legal_name;\`
- The moment this executes, running application pods (v1) instantly fail on every query: \`column "full_name" does not exist\`.
- In a rolling deployment, v1 and v2 run simultaneously for 15 minutes. One of them will crash!

The Expand and Contract Workflow:
1. Phase 1 (Expand):
   - Add new nullable column: \`ALTER TABLE users ADD COLUMN legal_name VARCHAR(255);\`.
   - Deploy App v2: Writes to BOTH \`full_name\` and \`legal_name\` (dual-write). Reads from \`full_name\`.
   - Old App v1 continues reading/writing \`full_name\` safely.
2. Phase 2 (Transition / Backfill):
   - Run background batch job: \`UPDATE users SET legal_name = full_name WHERE legal_name IS NULL;\`.
   - Deploy App v3: Reads from \`legal_name\`. Continues writing to both.
3. Phase 3 (Contract):
   - Deploy App v4: Writes ONLY to \`legal_name\`. \`full_name\` is completely abandoned.
   - Run DDL to drop deprecated column: \`ALTER TABLE users DROP COLUMN full_name;\`.`,
    code: `/*
Expand and Contract Timeline:
Step 1: DB has 'full_name' (App v1 reads/writes full_name)
Step 2 [Expand]: Add 'legal_name' to DB. Deploy App v2 (writes BOTH, reads full_name)
Step 3 [Backfill]: Batch migration script copies historical full_name -> legal_name
Step 4 [Transition]: Deploy App v3 (writes BOTH, reads legal_name)
Step 5 [Contract]: Deploy App v4 (writes ONLY legal_name). Drop 'full_name' from DB!
*/`,
    recallHint: "Expand: add new column, dual-write. Backfill: copy old to new. Contract: switch reads, drop old.",
    interviewTip: "Whenever an interviewer asks how to rename a field or alter a database schema in production without downtime, immediately present the Expand and Contract pattern.",
    tags: ["database-migrations", "zero-downtime", "expand-contract", "schema-evolution", "databases"]
  }),

  createCard({
    idNum: 82,
    category: "Microservices, Resilience & Observability",
    concept: "Bulkhead Isolation & Thread Pool Segregation",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the Bulkhead pattern prevent a failure in a slow non-critical dependency from consuming all system threads and taking down unrelated critical features?",
    answer: "Inspired by naval ship bulkheads that partition the hull into watertight compartments, the Bulkhead pattern segregates compute resources (thread pools, memory, connection pools) across different dependencies or client tiers. If a slow third-party payment provider freezes, only its designated 20-thread pool is saturated, leaving the rest of the application's threads completely available for normal operations.",
    explanation: `The Problem (Shared Resource Exhaustion):
A web server maintains a thread pool of 200 worker threads to serve all API endpoints:
- 95% of traffic is browsing products (fast, 10ms database query).
- 5% of traffic is exporting heavy PDF reports (slow, takes 15 seconds).
- A burst of 50 users click 'Generate PDF'.
- In a shared pool, all 200 threads become blocked waiting on PDF generation.
- Result: Normal users cannot view products or login! A non-critical feature knocked down the entire company.

Implementing Bulkheads:
1. Thread Pool Isolation:
   - Dedicated \`fast-web-pool\` (150 threads) for product catalog and checkout.
   - Dedicated \`reports-pool\` (20 threads) with a bounded queue of 50. Excess report requests fail immediately with HTTP 429 without affecting web traffic.
2. Semaphore Isolation:
   - Uses lightweight atomic counters to limit concurrent in-flight calls to a downstream service without thread context-switching overhead.
3. Container / Pod Bulkheads:
   - Deploy separate Kubernetes microservice pods for critical vs background workflows.`,
    code: `// Bulkhead Isolation with Bounded Concurrency Semaphore
class Bulkhead {
  private activeCount = 0;
  constructor(private maxConcurrent = 10) {}

  async execute<T>(task: () => Promise<T>): Promise<T> {
    if (this.activeCount >= this.maxConcurrent) {
      // Bulkhead full: reject immediately to protect the system!
      throw new Error("Bulkhead capacity reached. Service saturated.");
    }

    this.activeCount++;
    try {
      return await task();
    } finally {
      this.activeCount--;
    }
  }
}

// Dedicated isolated bulkheads
const recommendationsBulkhead = new Bulkhead(15);
const paymentsBulkhead = new Bulkhead(50);`,
    recallHint: "Bulkhead: Watertight compartments. A leak in one section never sinks the entire ship.",
    interviewTip: "Always combine Circuit Breakers with Bulkheads: Bulkheads limit resource consumption while a dependency is failing, and Circuit Breakers stop sending calls altogether once failure thresholds trip.",
    tags: ["bulkhead", "isolation", "resilience", "thread-pools", "concurrency", "fault-tolerance"]
  }),

  createCard({
    idNum: 83,
    category: "Microservices, Resilience & Observability",
    concept: "Chaos Engineering & Fault Injection (Chaos Monkey)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Chaos Engineering, and how does running automated fault injection experiments in production prove distributed system resilience?",
    answer: "Chaos Engineering is the discipline of experimenting on a distributed system in production to build confidence in its capability to withstand turbulent conditions. Popularized by Netflix's Chaos Monkey, it injects controlled failures (killing random container pods, severing network links, adding artificial latency, corrupting DNS) to uncover hidden cascading failure modes before real disasters strike.",
    explanation: `Principles of Chaos Engineering (principlesofchaos.org):
1. Formulate a Hypothesis about Steady State:
   - Define measurable metrics representing normal business operation (e.g., 'Completed Checkouts per minute remain $\\ge 500$ and p99 latency $< 200\\text{ms}$').
2. Introduce Realistic Real-World Turbulence:
   - Pod Termination (Chaos Monkey): Randomly terminate microservice instances.
   - Network Emulation (Chaos Mesh / Gremlin): Inject 500ms packet latency or 10% packet drop.
   - AZ Failure: Simulate the complete severance of an AWS Availability Zone.
   - Clock Desynchronization: Artificially skew NTP time on select nodes.
3. Verify Steady-State Hypothesis:
   - Did the automated circuit breakers trip?
   - Did load balancers immediately route around the killed pods?
   - Did the checkout rate remain steady?
4. Automate Continuous Experiments:
   - Run chaos experiments during business hours when engineering teams are fully staffed and available to respond.`,
    code: `/*
Chaos Engineering Lifecycle:

[ Steady State Metric: Checkouts/min = 600 ]
                     │
         [ Inject Fault: Kill AZ-1 Database Replica ]
                     │
   ┌─────────────────┴─────────────────┐
   ▼                                   ▼
[ Hypothesis Validated ]     [ Unexpected Failure! ]
- Auto-failover promoted AZ-2 - App threads hung indefinitely
- Zero user error spikes      - Cascading 500 errors
- System passed!              - File P1 Bug -> Fix Timeout Config!
*/`,
    recallHint: "Chaos Engineering: Break things on purpose in production to verify your failover actually works.",
    interviewTip: "Mention that Chaos Engineering must only be attempted after foundational observability (metrics, distributed tracing) and automated rollbacks are established.",
    tags: ["chaos-engineering", "chaos-monkey", "resilience", "fault-injection", "testing"]
  }),

  createCard({
    idNum: 84,
    category: "Microservices, Resilience & Observability",
    concept: "Distributed Rate Limiting Algorithms: Token Bucket vs Leaky Bucket vs Sliding Window Counter",
    priority: "must-know",
    difficulty: "must-know",
    question: "Compare Token Bucket, Leaky Bucket, Fixed Window, and Sliding Window Counter rate limiting algorithms across burst handling and memory overhead.",
    answer: "Token Bucket allows traffic bursts up to bucket capacity and refills at a steady rate; Leaky Bucket processes requests at a strictly constant rate (smoothing out bursts via a FIFO queue); Fixed Window counts requests per calendar minute, suffering from 2x boundary spikes; Sliding Window Counter approximates a rolling window by weighting the previous and current window counts, offering burst protection with minimal memory.",
    explanation: `Rate Limiting Algorithms:
1. Token Bucket (AWS, Stripe):
   - Tokens added at constant rate $r$ up to capacity $C$.
   - Each request consumes 1 token. If tokens $> 0$, allow. If empty, reject with HTTP 429.
   - Advantage: Permits bursty traffic (can process $C$ requests instantaneously) while capping long-term rate at $r$.
2. Leaky Bucket (Traffic Shaping / NGINX):
   - Requests enter a bounded FIFO queue; a worker leaks requests at a strictly fixed constant rate.
   - Advantage: Completely flattens traffic spikes; protects sensitive legacy backends.
   - Downside: Bursty requests are delayed in the queue even when backend capacity is idle.
3. Fixed Window Counter (Anti-Pattern):
   - Counter resets at fixed clock boundaries (e.g., 12:00:00).
   - Flaw (Boundary Spike): Limit is 100 req/min. User sends 100 requests at 12:00:59, and 100 requests at 12:01:01. In that 2-second window, 200 requests pass through (2x over limit!).
4. Sliding Window Counter (Production Standard):
   - Formula: $\\text{count} = \\text{current\\_window\\_count} + (\\text{prev\\_window\\_count} \\times (1 - \\text{progress\\_ratio}))$.
   - Solves the boundary spike with $O(1)$ memory (stores only 2 integers per user in Redis).`,
    code: `// Distributed Sliding Window Counter in Redis (Lua Script)
// Keys: [current_window_key, prev_window_key]
// Args: [limit, current_timestamp_sec, window_size_sec]
const slidingWindowLua = \`
  local current_key = KEYS[1]
  local prev_key = KEYS[2]
  local limit = tonumber(ARGV[1])
  local now = tonumber(ARGV[2])
  local window_size = tonumber(ARGV[3])

  local current_count = tonumber(redis.call('get', current_key) or "0")
  local prev_count = tonumber(redis.call('get', prev_key) or "0")

  local progress = (now % window_size) / window_size
  local estimated_count = math.floor(prev_count * (1 - progress) + current_count)

  if estimated_count < limit then
    redis.call('incr', current_key)
    redis.call('expire', current_key, window_size * 2)
    return 1 -- Allowed
  else
    return 0 -- Throttled (HTTP 429)
  end
\`;`,
    recallHint: "Token Bucket = allows bursts. Leaky Bucket = smooths to constant flow. Sliding Window Counter = solves boundary spike in 2 keys.",
    interviewTip: "Always implement distributed rate limiters using Redis Lua scripts. A Lua script executes atomically in Redis, eliminating race conditions between concurrent requests without distributed locks.",
    tags: ["rate-limiting", "token-bucket", "leaky-bucket", "sliding-window", "redis", "lua"]
  })
];

module.exports = cards;
