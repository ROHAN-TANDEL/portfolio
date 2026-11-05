const { createCard } = require("../ms_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 1,
    category: "Decomposition & Domain-Driven Design (DDD)",
    concept: "Monolith to Microservices & Strangler Fig Pattern",
    priority: "must-know",
    difficulty: "must-know",
    question: "What is the Strangler Fig pattern, and why is an incremental migration vastly superior to a 'Big Bang' rewrite when decomposing a monolithic codebase?",
    answer: "The Strangler Fig pattern incrementally replaces specific capabilities of a monolithic system with microservices by placing an intercepting proxy/API gateway in front of the application. New or refactored features route to the new microservice, while legacy calls continue hitting the monolith until the monolith shrinks to zero. Big Bang rewrites almost always fail due to scope creep, changing requirements, and prolonged delivery freezes.",
    explanation: `The Big Bang Fallacy:
- Martin Fowler and industry post-mortems show that 'Big Bang' rewrites take 2x–3x longer than planned.
- While engineers spend 18 months rebuilding the system from scratch, the legacy production monolith continues evolving to meet business needs, creating a moving target.
- Switching production traffic overnight presents extreme operational risk with high blast radiuses.

The Strangler Fig Architecture:
1. Ingress Proxy Placement: Place an API Gateway (Envoy/Kong) or reverse proxy in front of the existing monolith.
2. Capability Carve-Out: Select a high-value, decoupled business capability (e.g., Notification or Authentication).
3. Build Microservice: Build the new service with its own dedicated database.
4. Route Migration: Update proxy rules so \`/api/v1/notifications\` routes to the new microservice, while all other routes pass to the monolith.
5. Repeat & Retire: Incrementally migrate bounded contexts until the legacy monolith is completely decommissioned.`,
    code: `/*
Strangler Fig Proxy Routing (NGINX / Envoy):

location /api/v1/orders {
    # Newly migrated microservice
    proxy_pass http://order-microservice:8080;
}

location /api/v1/inventory {
    # Newly migrated microservice
    proxy_pass http://inventory-microservice:8081;
}

location / {
    # Legacy Monolith handling the rest
    proxy_pass http://legacy-monolith:3000;
}
*/`,
    recallHint: "Strangler Fig: Put a proxy in front, migrate one route at a time. Never do a Big Bang rewrite.",
    interviewTip: "In interviews, always advocate for the Strangler Fig pattern when asked how to modernize a legacy system. Emphasize continuous value delivery and risk minimization.",
    tags: ["strangler-fig", "decomposition", "monolith-to-microservices", "api-gateway", "architecture"]
  }),

  createCard({
    idNum: 2,
    category: "Decomposition & Domain-Driven Design (DDD)",
    concept: "Bounded Contexts & Context Mapping",
    priority: "must-know",
    difficulty: "must-know",
    question: "How does a Bounded Context in Domain-Driven Design (DDD) define microservice boundaries, and what is Context Mapping?",
    answer: "A Bounded Context defines the linguistic and conceptual boundary within which a specific domain model applies consistently. Outside that boundary, domain terms mean different things. Context Mapping documents the organizational and architectural relationships (e.g., Shared Kernel, Customer/Supplier, Anti-Corruption Layer) between different bounded contexts.",
    explanation: `The 'Customer' Semantic Discrepancy:
Attempting to create a single unified 'Customer' entity across an enterprise results in bloated God classes:
- In **Sales Context**: Customer has leads, credit rating, account executive, sales pipeline status.
- In **Billing Context**: Customer has payment methods, invoice address, VAT number, billing terms.
- In **Support Context**: Customer has open support tickets, SLA tier, escalation contact.

In DDD, instead of one shared entity, each Bounded Context maintains its own clean model:
- Sales Service owns \`SalesCustomer\`.
- Billing Service owns \`BillingCustomer\`.
- Support Service owns \`SupportCustomer\`.

Context Mapping Archetypes:
1. **Shared Kernel**: Two contexts share a subset of the domain model directly (tight coupling; use sparingly).
2. **Customer / Supplier**: Upstream (Supplier) provides data, Downstream (Customer) consumes; upstream prioritizes downstream requests.
3. **Conformist**: Downstream conforms directly to upstream's model without translation.
4. **Anti-Corruption Layer (ACL)**: Downstream translates upstream data into its own clean domain language.`,
    code: `/*
Context Mapping Relationships:

[ Sales Bounded Context ] ──(Customer/Supplier)──> [ Billing Bounded Context ]
                                                              │
                                                              ▼ (ACL)
                                                   [ Legacy Mainframe System ]
*/

// Anti-Corruption Layer (ACL) Adapter in TypeScript
export class LegacyCustomerAdapter {
  static toBillingCustomer(legacyData: any): BillingCustomer {
    return {
      id: legacyData.CUST_ID,
      companyName: legacyData.ORG_NAME.trim(),
      taxId: legacyData.TX_NO || "UNKNOWN",
      billingStatus: legacyData.STAT === "A" ? "ACTIVE" : "SUSPENDED"
    };
  }
}`,
    recallHint: "Bounded Context: Same word, different meaning. Bounded context = microservice boundary.",
    interviewTip: "When asked how to draw microservice boundaries, state: 'We align microservices with Bounded Contexts, ensuring high cohesion within the service and loose coupling between services.'",
    tags: ["ddd", "bounded-context", "context-mapping", "anti-corruption-layer", "microservices"]
  }),

  createCard({
    idNum: 3,
    category: "Decomposition & Domain-Driven Design (DDD)",
    concept: "Database-per-Service Principle & Shared Database Anti-Pattern",
    priority: "must-know",
    difficulty: "must-know",
    question: "Why is the Database-per-Service pattern a mandatory rule of microservices, and what architectural failures occur when services share a database?",
    answer: "The Database-per-Service pattern mandates that each microservice owns its private persistent datastore, accessible strictly via public APIs or events. A Shared Database introduces invisible tight coupling: schema changes break other services without warning, tables cannot be scaled or polyglot-selected independently, and shared database locks trigger cross-service cascades.",
    explanation: `The Perils of the Shared Database Anti-Pattern:
1. Hidden Coupling: If Service A and Service B both query table \`orders\`, renaming a column in Service A breaks Service B at runtime.
2. Polyglot Impossibility: Order processing needs relational ACID (PostgreSQL); analytics needs columnar (ClickHouse); recommendation needs Graph (Neo4j). A shared database forces everyone into a suboptimal single engine.
3. Security Blast Radius: A compromised microservice has access to sensitive tables belonging to all other services.
4. Distributed Lock Contention: Queries from Service B can hold table/row locks, starving Service A of database connection slots.

How to Query Across Services:
- **API Composition**: An API Gateway or aggregator calls both services and merges JSON in memory.
- **CQRS Projections**: Services listen to domain events via Kafka and project denormalized read-only views into their own private database.`,
    code: `/*
Database-per-Service (Autonomous & Polyglot):

[ Order Microservice ] ──> [ Private PostgreSQL Instance (Port 5432) ]
          │ (Publishes 'OrderCreated' Event)
          ▼
[ Kafka Event Bus ]
          │ (Consumes Event)
          ▼
[ Analytics Service ]  ──> [ Private ClickHouse Instance (Columnar) ]

Shared Database Anti-Pattern (DO NOT DO):
[ Order Service ]   ──┐
                      ├──> [ SHARED POSTGRES DB ] (Tight coupling, SPOF!)
[ Billing Service ] ──┘
*/`,
    recallHint: "Database-per-Service: Private DB per service. Access only via APIs or events. Never share tables.",
    interviewTip: "Emphasize that the hardest part of moving to microservices is not splitting the code, but splitting the database. Address cross-table joins with CQRS or API composition.",
    tags: ["database-per-service", "data-architecture", "polyglot-persistence", "anti-patterns", "coupling"]
  }),

  createCard({
    idNum: 4,
    category: "Decomposition & Domain-Driven Design (DDD)",
    concept: "Service Sizing: Granularity, Nano-Services & Single Team Rule",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do architects determine optimal microservice granularity, and what are the operational dangers of Nano-Services?",
    answer: "Optimal microservice granularity is governed by business bounded contexts and organizational ownership (the Two-Pizza Team rule: a service must be fully owned by a single team). Sizing services too small produces Nano-Services: extreme chattiness, network latency amplification, complex distributed tracing, and high operational overhead where single features require coordinated deployments across 10 repos.",
    explanation: `The Nano-Service Trap:
- A Nano-service is an overly fine-grained service (e.g., separate services for \`CalculateTax\`, \`FormatAddress\`, \`SendEmail\`).
- Symptoms of Nano-services:
  - Extreme network overhead: What was once an in-memory function call now incurs HTTP/gRPC serialization, TLS handshakes, and network hops.
  - Deployment lockstep: Deploying a feature requires synchronizing PRs and deployments across 8 different repositories.
  - Debugging nightmare: A simple user request bounces through 20 hops; distributed tracing becomes mandatory just to trace basic logic.

Guiding Principles for Correct Sizing:
1. **Bounded Context Alignment**: A service should encapsulate a complete business capability.
2. **Two-Pizza Team Rule (Amazon)**: A service should be small enough to be built, tested, deployed, and operated by a single team of 6–8 engineers.
3. **Common Closure Principle**: Classes/modules that change together for the same business reasons should be packaged together.
4. **Transaction Boundary**: Entities requiring strict ACID transaction atomicity should remain within the same service boundary.`,
    code: `/*
Service Granularity Comparison:

Monolith:
[ Single Process: User + Orders + Inventory + Payments + Shipping ]

Nano-Services (Anti-Pattern):
[ UserProfile ] -> [ UserAddress ] -> [ UserPhone ] -> [ UserAvatar ]
(Excessive chattiness, network latency, distributed lockups!)

Balanced Microservices (Optimal DDD Sizing):
[ Identity & Access Context ]
[ Order Management Context ]
[ Inventory Fulfillment Context ]
*/`,
    recallHint: "Size by Bounded Context and Two-Pizza Team. Nano-services = distributed monolith with network latency.",
    interviewTip: "State: 'Microservices should be as small as possible, but as large as necessary.' Emphasize business capability encapsulation over lines of code.",
    tags: ["service-granularity", "nano-services", "two-pizza-team", "bounded-context", "architecture"]
  }),

  createCard({
    idNum: 5,
    category: "Decomposition & Domain-Driven Design (DDD)",
    concept: "Conway's Law & The Inverse Conway Maneuver",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is Conway's Law, and how do engineering leaders use the Inverse Conway Maneuver to architect scalable microservices?",
    answer: "Conway's Law (Melvin Conway, 1967) states: 'Organizations that design systems are constrained to produce designs which are copies of the communication structures of these organizations.' If you have a separate Frontend team, DBA team, and Backend team, you will produce a 3-tier monolith. The Inverse Conway Maneuver reorganizes cross-functional teams around desired bounded contexts so microservice architectures emerge naturally.",
    explanation: `The Organizational Mirroring Effect:
- Traditional Siloed Teams:
  - UI Team -> Produces a bloated monolithic frontend.
  - Backend/Middleware Team -> Produces a monolithic application server.
  - DBA Team -> Produces a single centralized monolithic database.
  - Result: Continuous communication friction, cross-team handoffs, and deployment bottlenecks.

The Inverse Conway Maneuver:
- Reorganize engineering into autonomous, cross-functional Stream-Aligned Teams (Team Topologies):
  - Team Alpha: Owns Order Checkout end-to-end (Frontend + Backend + Database + CI/CD).
  - Team Beta: Owns Inventory Fulfillment end-to-end.
  - Team Gamma: Owns Identity & Auth end-to-end.
- Because teams communicate across clean API boundaries, the technical system naturally splits into clean, decoupled microservices.`,
    code: `/*
Traditional Siloed Organization (Creates 3-Tier Monolith):
[ Frontend Team ] ──> [ Backend Team ] ──> [ DBA Team ]
      │                      │                    │
[ Monolithic UI ] ──> [ Monolithic App ] ──> [ Monolithic DB ]

Inverse Conway Maneuver (Cross-Functional Product Pods):
[ Order Team (FE + BE + Data + DevOps) ] ──> [ Order Microservice ]
[ Payment Team (FE + BE + Data + DevOps) ] ──> [ Payment Microservice ]
[ Catalog Team (FE + BE + Data + DevOps) ] ──> [ Catalog Microservice ]
*/`,
    recallHint: "Conway's Law: Software copies org chart. Inverse Conway: Reorganize teams around microservices.",
    interviewTip: "Mentioning the Inverse Conway Maneuver shows architectural leadership: software architecture cannot succeed without aligning team structures and communication channels.",
    tags: ["conways-law", "inverse-conway", "team-topologies", "organization", "microservices"]
  }),

  createCard({
    idNum: 6,
    category: "Decomposition & Domain-Driven Design (DDD)",
    concept: "Anti-Corruption Layer (ACL) Pattern",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is an Anti-Corruption Layer (ACL), and how does it protect modern microservices when integrating with legacy monolithic or external third-party systems?",
    answer: "An Anti-Corruption Layer (ACL) is a translation layer (facade, adapter, and translator) placed between a modern microservice and a legacy system. It translates incoming and outgoing domain models, ensuring that legacy schema anomalies, naming conventions, and obsolete business logic do not bleed into and corrupt the clean domain model of the new microservice.",
    explanation: `The Problem of Legacy Contamination:
When building a modern Order Microservice that must interface with a 25-year-old COBOL/SOAP mainframe:
- Legacy system uses obscure field names: \`CUST_STAT_CD_01\`, \`ORD_TYP_FLAG\`, packed decimals.
- If the new microservice uses these field names internally, the legacy system's quirks corrupt the clean domain code, making maintenance painful.

How the ACL Operates:
1. **Facade**: Presents a clean, modern interface to the new microservice.
2. **Adapter**: Communicates with the legacy transport (SOAP/XML, fixed-width files, proprietary protocols).
3. **Translator**: Bidirectionally maps domain objects:
   - Legacy \`CUST_STAT_CD_01 == "A"\` -> Clean Domain \`CustomerStatus.ACTIVE\`.
   - Legacy \`AMT_PENNIES == 1000\` -> Clean Domain \`Money.of(10.00, Currency.USD)\`.
4. Decoupling Benefit: When the legacy system is finally decommissioned, only the ACL adapter is rewritten; zero business logic in the microservice changes.`,
    code: `// Anti-Corruption Layer (ACL) Implementation in TypeScript
interface LegacyOrderResponse {
  ORD_ID_NUM: string;
  CUST_REF: string;
  TOT_AMT_CENTS: number;
  STAT_FLG: "O" | "C" | "X";
}

export class OrderAclTranslator {
  static toDomain(legacy: LegacyOrderResponse): DomainOrder {
    const statusMap: Record<string, "OPEN" | "COMPLETED" | "CANCELLED"> = {
      O: "OPEN",
      C: "COMPLETED",
      X: "CANCELLED"
    };

    return {
      id: legacy.ORD_ID_NUM,
      customerId: legacy.CUST_REF,
      total: legacy.TOT_AMT_CENTS / 100, // Clean dollar float/numeric
      status: statusMap[legacy.STAT_FLG] || "OPEN",
      currency: "USD"
    };
  }
}`,
    recallHint: "ACL: Translation barrier between clean modern microservice and dirty legacy mainframe.",
    interviewTip: "Always recommend an Anti-Corruption Layer when integrating microservices with enterprise ERPs (SAP), payment mainframes, or third-party legacy APIs.",
    tags: ["anti-corruption-layer", "acl", "legacy-migration", "domain-driven-design", "adapter-pattern"]
  }),

  createCard({
    idNum: 7,
    category: "Decomposition & Domain-Driven Design (DDD)",
    concept: "Domain Events vs Integration Events",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the crucial architectural difference between a Domain Event and an Integration Event in microservice ecosystems?",
    answer: "A Domain Event represents something significant that occurred within a single bounded context, expressed in rich internal domain terminology and handled within the same process or service; an Integration Event is an explicitly published external contract designed for consumption by other microservices, adhering to strict schema evolution, backward compatibility, and privacy sanitization.",
    explanation: `Detailed Comparison:
1. Domain Events:
   - Scope: Internal to the bounded context / microservice.
   - Purpose: Decouple business side-effects within the aggregate or service (e.g., \`OrderPlacedEvent\` triggers audit log and email stub inside Order service).
   - Coupling: High domain knowledge permitted. Can expose internal entity structures.
   - Serialization: In-memory event bus (Node.js EventEmitter, Spring ApplicationEventPublisher).
2. Integration Events:
   - Scope: Crosses network and bounded context boundaries (published to Kafka/RabbitMQ).
   - Purpose: Notify other microservices of state changes (e.g., Billing and Shipping services).
   - Contract Hygiene: Strict schema governance (Apache Avro, Protobuf, JSON Schema via Schema Registry).
   - Privacy & Sanitization: Internal implementation details (e.g., password hashes, internal DB row IDs, intermediate calculations) are strictly removed.`,
    code: `// Domain Event vs Integration Event Example
// 1. Internal Domain Event (Rich, internal types)
class OrderSubmittedDomainEvent {
  constructor(
    public readonly order: OrderAggregate,
    public readonly internalWorkflowId: string
  ) {}
}

// 2. Public Integration Event (Sanitized contract for Kafka)
interface OrderCompletedIntegrationEventV1 {
  eventId: string;
  eventType: "order.completed.v1";
  timestamp: string;
  data: {
    orderId: string;
    userId: string;
    totalAmount: number;
    currency: string;
  };
}`,
    recallHint: "Domain Event = internal in-memory bus. Integration Event = public external Kafka contract.",
    interviewTip: "Never publish raw internal database entities directly to Kafka as events. Always translate internal domain events into versioned Integration Events.",
    tags: ["domain-events", "integration-events", "event-driven", "kafka", "ddd", "contracts"]
  }),

  createCard({
    idNum: 8,
    category: "Decomposition & Domain-Driven Design (DDD)",
    concept: "The Distributed Monolith Anti-Pattern",
    priority: "must-know",
    difficulty: "must-know",
    question: "What defines a Distributed Monolith, why is it the worst possible architectural state, and how do you diagnose it?",
    answer: "A Distributed Monolith occurs when a codebase is partitioned into separate deployable microservices that remain tightly coupled through synchronous HTTP chains, shared databases, or lockstep deployments. It combines all the deployment and maintenance pains of a monolith with the network latency, partial failures, and distributed complexity of microservices.",
    explanation: `Symptoms of a Distributed Monolith:
1. Lockstep Deployments: Deploying Service A requires simultaneously deploying Service B and Service C in a specific sequence.
2. Synchronous Deep Call Chains: Handling one client request requires 8 synchronous HTTP calls (Service A -> B -> C -> D -> E); if Service D is slow, the entire chain hangs.
3. Shared Database: Multiple microservices connect to and update the same physical database tables.
4. Cascading Outages: A failure in a non-critical service immediately knocks out the entire company platform.
5. Inability to Develop Locally: Developers must run 35 Docker containers locally just to test a single button click.

How to Remediate:
- Break synchronous call chains using asynchronous messaging (Kafka/RabbitMQ) and Event-Carried State Transfer.
- Split shared databases into database-per-service.
- Introduce Backward-Compatible API contracts so services deploy independently.`,
    code: `/*
The Distributed Monolith Trap:

[ Client ] ──> [ Service A ] ──(Sync HTTP)──> [ Service B ]
                                                    │ (Sync HTTP)
                                                    ▼
                                              [ Service C ]
                                                    │ (Sync HTTP)
                                                    ▼
                                              [ Service D ] (Crashes!)
Outcome:
- Latency = Sum of all 4 network hops.
- Availability = Availability(A) * Availability(B) * Availability(C) * Availability(D)
  (If each service has 99% uptime, total uptime is 0.99^4 = 96%!)
*/`,
    recallHint: "Distributed Monolith: Monolith coupling + network latency + distributed failure. Worst of both worlds.",
    interviewTip: "If an interviewer presents a microservice design with deep synchronous call trees, immediately diagnose it as a Distributed Monolith and propose asynchronous event-driven decoupling.",
    tags: ["distributed-monolith", "anti-patterns", "coupling", "microservices", "architecture"]
  }),

  createCard({
    idNum: 9,
    category: "Decomposition & Domain-Driven Design (DDD)",
    concept: "Event-Carried State Transfer (ECST) vs Event Notification",
    priority: "must-know",
    difficulty: "advanced",
    question: "Contrast Event Notification with Event-Carried State Transfer (ECST) in microservice architectures across chattiness and data duplication.",
    answer: "Event Notification publishes a tiny alert that something happened (e.g., 'Order #101 Created'), forcing consumers to make synchronous back-queries to fetch details (high chattiness); Event-Carried State Transfer (ECST) embeds all relevant state changes directly in the event payload (e.g., items, customer, address), allowing consumers to update local caches without ever querying the producer.",
    explanation: `Event Notification (Lean Events):
- Payload: \`{ "eventType": "ORDER_CREATED", "orderId": "ord_101" }\`.
- Flow: Consumer receives event -> Consumer must call \`GET http://order-service/orders/ord_101\` to get details.
- Problem (Query Storm): If 50 downstream consumers listen to \`ORDER_CREATED\`, every event triggers 50 synchronous HTTP queries back to the Order Service, creating massive query storms and tight runtime coupling.

Event-Carried State Transfer (Fat Events):
- Payload: \`{ "eventType": "ORDER_CREATED", "orderId": "ord_101", "userId": "usr_42", "items": [...], "total": 150.00, "address": {...} }\`.
- Flow: Consumer receives event -> extracts all needed fields -> updates its own local database/cache.
- Benefits: Completely eliminates synchronous back-queries; downstream services operate autonomously even if Order Service is completely down.
- Trade-off: Event payloads are larger; consumers store duplicated data; schema evolution must be managed carefully.`,
    code: `// Event-Carried State Transfer (ECST) Payload Structure
interface OrderCreatedEcstEvent {
  eventId: string;
  timestamp: number;
  aggregateId: string;
  payload: {
    orderId: string;
    customerId: string;
    customerEmail: string; // Included so Notification Service needs zero back-queries!
    items: Array<{
      sku: string;
      quantity: number;
      unitPrice: number;
    }>;
    shippingAddress: {
      street: string;
      city: string;
      zip: string;
    };
    totalAmount: number;
  };
}`,
    recallHint: "Notification: 'Order 101 happened' (calls back for info). ECST: 'Order 101 happened with ALL this data' (0 back-calls).",
    interviewTip: "Advocate for Event-Carried State Transfer when designing autonomous microservices that must continue functioning during upstream dependency outages.",
    tags: ["ecst", "event-notification", "event-driven", "kafka", "decoupling", "chattiness"]
  }),

  createCard({
    idNum: 10,
    category: "Decomposition & Domain-Driven Design (DDD)",
    concept: "API Composition vs CQRS for Multi-Service Queries",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you execute queries that require data joined from multiple decoupled microservices? Compare API Composition with CQRS Projections.",
    answer: "API Composition uses an aggregator gateway to call multiple microservices in parallel and join responses in memory (simple to build, but high latency and vulnerability to downstream outages); CQRS Projections consume asynchronous domain events from Kafka to pre-join and store denormalized view models in a dedicated read database (ultra-fast O(1) reads, but eventual consistency).",
    explanation: `The Cross-Service Query Dilemma:
When each service owns its private database, you cannot execute:
\`SELECT * FROM orders o JOIN users u ON o.user_id = u.id JOIN shipments s ON o.id = s.order_id\`.

1. API Composition (In-Memory Join):
   - Client sends \`GET /order-dashboard/101\`.
   - API Composer fires 3 parallel HTTP calls:
     - \`GET http://order-service/orders/101\`
     - \`GET http://user-service/users/42\`
     - \`GET http://shipping-service/shipments?orderId=101\`
   - Composer joins the 3 JSON responses and returns to client.
   - Drawbacks: High latency (bounded by slowest service); reduced availability ($P(\\text{success}) = A_1 \\times A_2 \\times A_3$).
2. CQRS Projections (Pre-Joined Read Views):
   - A dedicated Dashboard Read Service listens to Kafka events (\`OrderCreated\`, \`UserUpdated\`, \`ShipmentDispatched\`).
   - Projector worker merges data into a single denormalized document in MongoDB/Elasticsearch.
   - Client queries the read database directly in 2ms!
   - Drawback: Eventual consistency delay between write and read view update.`,
    code: `/*
Cross-Service Query Patterns:

1. API Composition:
[ Client ] ──> [ API Composer ] ──┬──> [ Order Service ]
                                  ├──> [ User Service ]
                                  └──> [ Shipping Service ]

2. CQRS Read Projection:
[ Services ] ──(Events)──> [ Kafka ] ──> [ Projection Worker ] ──> [ Read DB (Mongo/Redis) ]
                                                                           ▲
[ Client Query: GET /dashboard/101 ] ──────────────────────────────────────┘
*/`,
    recallHint: "API Composition: Join in memory at gateway (slow, synchronous). CQRS: Pre-join via Kafka into read DB (fast, eventual).",
    interviewTip: "In interviews, start with API Composition for simple low-traffic endpoints, and recommend CQRS for complex high-throughput search screens and dashboards.",
    tags: ["api-composition", "cqrs", "cross-service-queries", "read-model", "microservices"]
  }),

  createCard({
    idNum: 11,
    category: "Decomposition & Domain-Driven Design (DDD)",
    concept: "Shared Kernel vs Decoupled Duplication",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why is code duplication often preferable to a shared common library (Shared Kernel) across microservices?",
    answer: "A shared library ('common.jar' / 'shared-npm-pkg') creates hidden compile-time and deployment coupling: updating a shared model requires testing and redeploying all microservices simultaneously. Decoupled Duplication allows services to maintain independent representations of data models, prioritizing autonomous team velocity and independent deployment over DRY (Don't Repeat Yourself) purity.",
    explanation: `The 'common-lib' Trap in Microservices:
- Teams create a shared package: \`@enterprise/common-models\`.
- Contains: User, Order, Address, ErrorHandler, AuthHelper.
- What happens:
  1. Team A modifies \`Address\` to support UK postcodes.
  2. Bumps package to v2.1.0.
  3. Team B's build breaks because of a subtle field type mismatch.
  4. Services become coupled at the binary/compile level. The microservices architecture has degenerated into a distributed monolith!

When to Duplicate vs When to Share:
- **Share**: Pure domain-agnostic technical utilities (logging formatters, circuit breaker wrappers, trace propagation middleware).
- **Duplicate**: Domain entities and business models! Service A's definition of \`Address\` and Service B's definition of \`Address\` should be independent classes inside their respective repositories.
- Principle: 'Duplication is far cheaper than the wrong abstraction.' (Sandi Metz).`,
    code: `/*
Shared Kernel Pitfall:
[ Service A ] ──┐
[ Service B ] ──┼──> [ shared-domain-lib.jar ] (Compile-time dependency lockup!)
[ Service C ] ──┘

Decoupled Independent Models:
[ Service A (defines OrderAddress) ] -> Independent deployment ✓
[ Service B (defines ShippingAddress) ] -> Independent deployment ✓
*/`,
    recallHint: "DRY is for inside a microservice; across microservices, duplicate domain models to preserve autonomy.",
    interviewTip: "Warn against shared domain libraries in system design interviews. Explain that independent deployability is the core value proposition of microservices.",
    tags: ["shared-kernel", "dry-principle", "code-duplication", "coupling", "autonomous-services"]
  }),

  createCard({
    idNum: 12,
    category: "Decomposition & Domain-Driven Design (DDD)",
    concept: "Subdomain Taxonomy: Core vs Supporting vs Generic",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Domain-Driven Design categorize business domains into Core, Supporting, and Generic Subdomains, and how does this dictate build vs buy decisions?",
    answer: "Core Domains represent the company's competitive advantage and unique secret sauce (must be custom-built in-house with top engineering talent); Supporting Domains complement core capabilities without providing unique competitive advantage (built in-house simply or outsourced); Generic Domains are standard enterprise needs (Auth, Invoicing, CRM) that should be bought off-the-shelf or consumed as SaaS.",
    explanation: `DDD Subdomain Categorization:
1. **Core Domain**:
   - The primary reason the business succeeds over competitors.
   - Netflix: Recommendation algorithms, content encoding.
   - Uber: Dynamic pricing, driver-rider matching graph.
   - Strategy: Custom in-house microservices; clean DDD modeling; highest engineering investment.
2. **Supporting Domain**:
   - Capabilities specific to the business, but not differentiating.
   - E-commerce inventory bin location mapping in a warehouse.
   - Strategy: Build custom, but keep simple without over-engineering.
3. **Generic Domain**:
   - Standard business problems solved by thousands of companies.
   - User authentication, invoice PDF generation, credit card processing, email delivery.
   - Strategy: **BUY, DO NOT BUILD!** Use Auth0/Okta for auth, Stripe for payments, SendGrid for emails. Don't build custom microservices for generic problems!`,
    code: `/*
Build vs Buy Decision Matrix based on Subdomain:

Core Subdomain:
[ Driver Matching Engine ] ──> Custom Microservice in Rust/Go (In-House Core IP)

Supporting Subdomain:
[ Fleet Vehicle Maintenance ] ──> Simple CRUD Microservice in Node.js

Generic Subdomain:
[ User Auth ] ───────────────> Auth0 / AWS Cognito (SaaS)
[ Payment Gateway ] ─────────> Stripe API (SaaS)
[ Email Dispatch ] ──────────> Twilio SendGrid (SaaS)
*/`,
    recallHint: "Core = Build in-house (secret sauce). Supporting = Build simple. Generic = Buy SaaS.",
    interviewTip: "In system design, never waste 15 minutes designing a custom user authentication service or SMS gateway. State: 'For generic subdomains like Auth and SMS, we integrate Auth0 and Twilio, focusing our microservice architecture on the Core Domain.'",
    tags: ["ddd", "subdomains", "core-domain", "build-vs-buy", "architecture-strategy"]
  })
];

module.exports = cards;
