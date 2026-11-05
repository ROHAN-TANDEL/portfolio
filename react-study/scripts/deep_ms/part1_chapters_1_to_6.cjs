const chapters = [
  {
    id: "ms-deep-01",
    title: "Decomposing the Monolith via DDD Bounded Contexts & Strangler Fig",
    category: "Architecture & Decomposition",
    readTimeMinutes: 28,
    overview: "Decomposing an enterprise monolith is an organizational and systemic surgery. This masterclass analyzes the strategic DDD patterns, bounded context boundary extraction, anti-corruption layers (ACL), data migration dual-run pipelines, and the operational mechanics of the Strangler Fig pattern.",
    diagram: `
+---------------------------------------------------------------------------------+
|                                 CLIENT INGRESS                                  |
+---------------------------------------------------------------------------------+
                                         |
                                         v
               +---------------------------------------------------+
               |             STRANGLER INGRESS PROXY               |
               | (Envoy / Kong / AWS ALB Path-Based Rule Router)   |
               +---------------------------------------------------+
                    /                                            \\
        (Legacy Traffic: /api/v1/*)                   (Migrated: /api/v1/orders)
                  /                                                \\
                 v                                                  v
+-------------------------------+                  +--------------------------------+
|       LEGACY MONOLITH         |                  |      NEW ORDER MICROSERVICE    |
| - Shared Database Schema      |                  | - Dedicated PostgreSQL Pod     |
| - Tightly coupled code        |                  | - Domain Logic + REST/gRPC     |
+-------------------------------+                  +--------------------------------+
                 |                                                  |
                 +<============ [ ANTI-CORRUPTION LAYER ] =========>+
                                (HTTP / Kafka Dual-Sync)
`,
    deepDive: `### 1. The Fallacy of the Big Bang Rewrite
The Big Bang rewrite is the most notorious anti-pattern in software engineering. When an engineering organization pauses all feature releases to rewrite a 10-year-old monolith from scratch:
1. **Moving Target Problem**: The legacy system cannot truly freeze; business emergencies force continuous changes to the legacy production codebase.
2. **Blast Radius Explosion**: Launching the new system overnight exposes 100% of customers to novel, untested bugs and unforeseen scale bottlenecks simultaneously.
3. **Delivery Fatigue**: Teams spend 18-36 months with zero delivered customer value, creating stakeholder friction and executive intervention.

### 2. Identifying Bounded Contexts with Domain-Driven Design (DDD)
The primary heuristic for microservice boundaries is **Bounded Contexts**, not database tables or technical tiers.
- **Ubiquitous Language**: A 'User' in Authentication context represents credentials and multi-factor auth tokens. In Billing, that exact same customer is an 'Account' with credit lines and payment methods. In Logistics, they are a 'Recipient' with delivery instructions.
- **Context Mapping**:
  - **Shared Kernel**: Two domains share a tiny, immutable data contract (use sparingly).
  - **Customer-Supplier**: Upstream domain dictates output; downstream consumes.
  - **Anti-Corruption Layer (ACL)**: An adapter translating legacy models into modern clean domain models, shielding the new microservice from monolithic schema contamination.

### 3. Step-by-Step Strangler Fig Protocol
1. **Ingress Proxy Deployment**: Deploy an Envoy or Kong reverse proxy in front of the production monolith. At day zero, 100% of traffic passes through to the monolith.
2. **Seam Identification**: Pick a high-value, decoupled business capability (e.g. Notifications, Loyalty Points, or Cart Checkout).
3. **Build the Autonomous Service**: Build the service with its own dedicated database. Never allow the new service to query the monolith's database directly.
4. **Change Data Capture (CDC) Sync**: Deploy Debezium over PostgreSQL logical replication to stream historical updates from the monolith into the new service's database in near real time.
5. **Dark Launch (Shadowing)**: Mirror production traffic to the new service without returning its responses to clients. Compare execution outputs and monitor tail latency.
6. **Live Cutover**: Route 100% of the public route to the new microservice.
7. **Strangle & Prune**: Delete the dead code and tables from the legacy monolith.`,
    edgeCasesAndPitfalls: [
      "Allowing the new microservice to connect directly to the legacy database, creating a distributed monolith.",
      "Dual-writing synchronously to both databases inside HTTP request handlers, resulting in partial commit inconsistencies.",
      "Failing to deploy an Anti-Corruption Layer, causing legacy data structures and naming oddities to infect the new service domain model."
    ],
    keyTakeaways: [
      "Always favor incremental Strangler Fig decomposition over catastrophic Big Bang rewrites.",
      "Model boundaries around DDD Bounded Contexts where Ubiquitous Language remains unambiguous.",
      "Enforce Database-per-Service from Day 1 using CDC and asynchronous event replication."
    ]
  },

  {
    id: "ms-deep-02",
    title: "Internal Transport Engineering: gRPC, HTTP/2 Multiplexing & Protobuf",
    category: "Inter-Service Networking",
    readTimeMinutes: 26,
    overview: "While public APIs benefit from human-readable JSON REST, inter-service east-west communications demand maximum CPU efficiency and low latency. This masterclass dives into HTTP/2 binary framing, multiplexed streams, Protobuf serialization, and gRPC connection management.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                           HTTP/1.1 vs HTTP/2 TRANSPORT                            |
+-----------------------------------------------------------------------------------+
  HTTP/1.1 (Head-of-Line Blocking at TCP):
  TCP Connection 1: [Req 1] =====> [Resp 1] =====> [Req 2] =====> [Resp 2]
  TCP Connection 2: [Req 3] =====> [Resp 3] (Requires multiple TCP handshakes)

  HTTP/2 (Binary Framing & Multiplexing over Single TCP Socket):
  Single TCP Conn:  [ Stream 1: Frame A ][ Stream 2: Frame A ][ Stream 1: Frame B ]
                    ---------------------------------------------------------------->
                    (Simultaneous, interleaved, bi-directional streams)
`,
    deepDive: `### 1. The High Cost of Internal JSON REST
In large-scale microservice clusters, JSON over HTTP/1.1 incurs severe overhead:
- **String Parsing CPU Tax**: Parsing UTF-8 JSON text strings into native language objects consumes up to 30-40% of microservice CPU cycles at high throughput.
- **Head-of-Line Blocking**: HTTP/1.1 can only send one request/response cycle per TCP connection at a time. High concurrency requires maintaining huge pools of TCP sockets.
- **Redundant Headers**: Repeated plaintext headers (\`Authorization: Bearer...\`, \`Content-Type\`, \`User-Agent\`) waste internal bandwidth.

### 2. Protocol Buffers (Protobuf) Serialization Engine
Protobuf encodes data into compact binary payloads using tag-value pairs and Variable-length Quantities (Varints):
\`\`\`protobuf
syntax = "proto3";
package inventory.v1;

message ItemStock {
  string item_id = 1;       // Field tag 1
  int32 available_units = 2; // Field tag 2
  int64 updated_timestamp = 3;
}
\`\`\`
- Field names (\`item_id\`, \`available_units\`) are **never transmitted over the wire**. Only field tags (1, 2, 3) are sent as binary bits.
- Integers are encoded using ZigZag encoding and varints (small numbers like \`5\` consume 1 byte instead of 4 or 8 bytes).
- Payloads are 60-80% smaller and serialize 5x-10x faster than equivalent JSON.

### 3. HTTP/2 Framing & gRPC Mechanics
gRPC operates strictly over HTTP/2:
- **Binary Framing Layer**: Breaks messages into discrete frames (DATA, HEADERS, SETTINGS, RST_STREAM).
- **Stream Multiplexing**: Thousands of independent RPCs interleave across a single long-lived TCP connection without blocking each other.
- **HPACK Header Compression**: Maintains a synchronized stateful compression table on both client and server, shrinking repetitive header overhead to near zero.
- **Native Streaming**: Supports Unary RPC, Client Streaming, Server Streaming, and Full Bi-Directional Streaming over the same socket.`,
    edgeCasesAndPitfalls: [
      "Using L4 load balancers with gRPC: because HTTP/2 uses a single persistent TCP connection, L4 balancers dump all traffic on one pod. You MUST use L7 balancing (Envoy) or client-side subchannels.",
      "Renumbering Protobuf field tags across versions, which instantly corrupts deserialization for existing consumers.",
      "TCP-level Head-of-Line blocking: if a packet drops on an HTTP/2 connection, all multiplexed streams stall until the TCP stack retransmits the missing packet (mitigated by HTTP/3 QUIC over UDP)."
    ],
    keyTakeaways: [
      "Protobuf serialization eliminates textual parsing CPU overhead and slashes bandwidth usage.",
      "HTTP/2 multiplexes hundreds of concurrent RPCs across a single TCP socket.",
      "gRPC requires L7 proxies (like Envoy) to distribute multiplexed requests evenly across backing pods."
    ]
  },

  {
    id: "ms-deep-03",
    title: "Event-Driven Architecture: Event Sourcing, CQRS & The Outbox Pattern",
    category: "Event-Driven Systems",
    readTimeMinutes: 30,
    overview: "Synchronous RPC creates fragile temporal coupling across microservices. This masterclass examines Event-Driven Architecture (EDA), the Dual-Write Dilemma, the Transactional Outbox Pattern with CDC, and the architectural mechanics of CQRS combined with Event Sourcing.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        TRANSACTIONAL OUTBOX PATTERN WITH CDC                      |
+-----------------------------------------------------------------------------------+
  [ Client Request ]
         |
         v
  +-----------------------------------------------------------------------+
  | ORDER MICROSERVICE                                                    |
  |                                                                       |
  |  BEGIN TRANSACTION;                                                   |
  |    INSERT INTO orders (id, total, status) VALUES ('o1', 100, 'PAID'); |
  |    INSERT INTO outbox_events (event_id, payload) VALUES ('e1', {...});|
  |  COMMIT;                                                              |
  +-----------------------------------------------------------------------+
         |
         | (PostgreSQL WAL - Logical Replication Stream)
         v
  +-------------------------------+
  | DEBEZIUM CDC / KAFKA CONNECT  | ===> [ APACHE KAFKA: 'orders.events' ]
  +-------------------------------+                       |
                                                          v
                                               +----------------------+
                                               | INVENTORY CONSUMER   |
                                               +----------------------+
`,
    deepDive: `### 1. The Dual-Write Problem
When a microservice needs to mutate database state AND emit an event to a message broker (e.g. Kafka or RabbitMQ), doing both in application code without distributed transactions creates fatal inconsistency:
\`\`\`typescript
// THE DUAL-WRITE DISASTER:
await db.orders.create(orderData); // Database committed!
await kafkaProducer.send("order-created", orderData); // NETWORK FAILS! Event lost forever!
\`\`\`
If you swap the order, Kafka sends the event, but the database transaction rolls back, publishing phantom ghost events.

### 2. Transactional Outbox with Change Data Capture (CDC)
The definitive solution is the **Transactional Outbox Pattern**:
1. Within the **same local ACID database transaction**, insert the business entity into \`orders\` AND write an event record into an \`outbox_events\` table.
2. A separate background publisher reads the outbox and dispatches to Kafka.
3. Modern enterprise architectures use **Log-Based CDC (Debezium)**:
   - Debezium connects to PostgreSQL's Write-Ahead Log (WAL) via logical replication slots.
   - Every committed row in \`outbox_events\` is automatically captured from disk and published to Kafka with zero polling overhead and zero database locks.

### 3. Command Query Responsibility Segregation (CQRS)
In microservices, complex queries that join data across multiple bounded contexts cannot be executed via SQL joins. CQRS splits the domain into two separate models:
- **Write / Command Side**: Optimized strictly for business invariant assertion, data integrity, and high-speed mutations.
- **Read / Query Side**: Subscribes to domain events emitted by the write side and projects denormalized, ready-to-render view documents into Elasticsearch or MongoDB.
- Clients execute mutations against the Command API and perform lightning-fast, zero-join read queries against the Query API.`,
    edgeCasesAndPitfalls: [
      "Polling outbox tables with \`SELECT * FROM outbox\` at high frequency, which causes table bloat and CPU lock contention (use Debezium CDC instead).",
      "Consumers assuming strictly ordered event delivery across different Kafka partitions.",
      "Failing to handle eventual consistency on the frontend: user updates an item, redirects to the read view, and sees stale data because the read projection has not caught up."
    ],
    keyTakeaways: [
      "Never dual-write to a database and a message broker inside application logic.",
      "Use the Transactional Outbox Pattern with Debezium CDC to guarantee at-least-once event publication.",
      "Decouple write throughput and read complexity by implementing CQRS read projections."
    ]
  },

  {
    id: "ms-deep-04",
    title: "Distributed Transactions & The Saga Pattern: Orchestration vs Choreography",
    category: "Transactions & Consistency",
    readTimeMinutes: 29,
    overview: "In a microservice ecosystem with Database-per-Service, classic two-phase commit (2PC) transactions fail at scale. This masterclass analyzes the Saga pattern, comparing Choreography and Orchestration, compensating transaction design, semantic locks, and durable execution engines.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                     ORCHESTRATED SAGA (STATE MACHINE RUNNER)                      |
+-----------------------------------------------------------------------------------+
                             [ SAGA ORCHESTRATOR ]
                            (Temporal / Cadence / AWS)
                             /         |          \\
                            /          |           \\
             1. ReserveCredit()   2. ReserveStock()  3. ProcessPayment() (FAILS!)
                          /            |             \\
                         v             v              v
                  [ Credit Srv ] [ Stock Srv ]  [ Payment Srv ]
                         |             |
           1b. Compensate:             2b. Compensate:
               ReleaseCredit()             ReleaseStock()
`,
    deepDive: `### 1. Why Two-Phase Commit (2PC) is Unviable
Two-Phase Commit (XA Transactions) provides distributed ACID guarantees across multiple databases. However:
- **Blocking Protocol**: During Phase 1 (Prepare), all participating databases hold row and table locks until Phase 2 (Commit) confirms.
- **Availability Killer**: If a single node or network link fails during the prepare phase, all other nodes remain locked indefinitely. 2PC violates the CAP theorem's availability guarantees and destroys horizontal scaling.

### 2. The Saga Pattern & Compensating Transactions
A Saga is a sequence of local transactions where each step updates a local database and publishes an event or triggers the next step.
- If all steps succeed, the distributed workflow completes.
- If any step fails (e.g. payment rejected), the saga executes a series of **Compensating Transactions** in reverse order to undo earlier changes.
- **Semantic Nuance**: A compensating transaction does NOT roll back history like an SQL rollback; it applies an explicit forward-compensating business operation (e.g. issuing a refund transaction or re-crediting inventory).

### 3. Choreography vs Orchestration
- **Choreographed Saga**:
  - Services listen to domain events and decide when to trigger their local transactions without a central controller.
  - *Best for*: Simple workflows with 2-3 services.
  - *Failure mode*: **Event Pinball Anti-Pattern**—cyclical dependencies and impossible observability when workflows expand.
- **Orchestrated Saga**:
  - A centralized coordinator (e.g. Temporal, AWS Step Functions, or custom state machine) explicitly directs services via commands and monitors status.
  - *Best for*: Complex, mission-critical workflows with dozens of steps, branching logic, and timeouts.
  - *Benefits*: Centralized failure tracking, guaranteed step execution, and unambiguous state inspection.`,
    edgeCasesAndPitfalls: [
      "Lack of Isolation (ACD without I): Sagas are not isolated. Intermediate state is visible to concurrent readers before compensation finishes (use Semantic Locks like PENDING_VERIFICATION).",
      "Compensating transactions that fail: compensations MUST be retryable and idempotent until they succeed, or trigger urgent human escalation.",
      "Out-of-order event delivery: compensating event arrives at a downstream service before the original action event has processed."
    ],
    keyTakeaways: [
      "Two-phase commit does not scale in microservices; embrace eventual consistency through Sagas.",
      "Always design compensating transactions to be strictly idempotent and forward-reconciling.",
      "Use Orchestrated Sagas (such as Temporal) for complex multi-step enterprise workflows."
    ]
  },

  {
    id: "ms-deep-05",
    title: "API Gateway Architecture, BFF Patterns & Distributed Rate Limiting",
    category: "Ingress & Edge Architecture",
    readTimeMinutes: 27,
    overview: "The API Gateway is the front door of your distributed architecture. This masterclass deconstructs edge routing responsibilities, Backend-for-Frontend (BFF) segregation, edge token validation, and distributed rate limiting using Redis sliding windows and Envoy token buckets.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        BFF & API GATEWAY TOPOLOGY                                 |
+-----------------------------------------------------------------------------------+
  [ Mobile iOS/Android ]               [ Web Single Page App ]
            |                                     |
            v                                     v
  +-----------------------+             +-----------------------+
  |      MOBILE BFF       |             |        WEB BFF        |
  | (Payload Minification)|             | (Rich Aggregation)    |
  +-----------------------+             +-----------------------+
            \\                                     /
             v                                   v
  +-------------------------------------------------------------+
  |                     CORE API GATEWAY                        |
  |  - Edge TLS 1.3 Termination    - Distributed Rate Limiter   |
  |  - OAuth2 / JWT Verification   - Trace Context Injection    |
  +-------------------------------------------------------------+
            /                           |                      \\
           v                            v                       v
  [ Order Service ]             [ Catalog Service ]     [ User Service ]
`,
    deepDive: `### 1. API Gateway Responsibilities & Boundaries
The API Gateway insulates internal microservice architectures from public internet clients. Its strict responsibilities are:
- **Perimeter Security**: TLS 1.3 termination, OAuth2 Bearer token cryptographic validation, and WAF inspection.
- **Traffic Shaping**: Edge rate limiting, IP throttling, and load shedding during capacity crunches.
- **Protocol Translation**: Translating public HTTP/1.1 JSON into internal HTTP/2 gRPC Protobuf.
- **Observability Ingress**: Injecting W3C TraceContext (\`traceparent\`) headers to initiate distributed traces.
- *Strict Boundary*: **Zero Domain Logic**. The gateway must remain a dumb pipe with smart endpoints. Direct database calls or business calculations in gateway plugins recreate a monolithic bottleneck.

### 2. The Backend for Frontend (BFF) Pattern
A single generic API Gateway cannot satisfy conflicting client requirements:
- Mobile devices (operating over unstable 4G/5G connections) demand aggregated, stripped-down payloads to conserve battery and bandwidth.
- Desktop Web applications demand rich, relational datasets for multi-column dashboards.
- The BFF pattern provisions dedicated lightweight edge gateways owned directly by the respective frontend teams (Mobile BFF owned by iOS/Android engineers; Web BFF owned by Web engineers).

### 3. Distributed Rate Limiting: Sliding Window Counter
Fixed window rate limiting allows boundary bursting (2x traffic spikes at window edges). The **Sliding Window Counter** with Redis Lua scripts provides atomic precision:
\`\`\`lua
-- Atomic Sliding Window in Redis
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local clearBefore = now - window

redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
local current = redis.call('ZCARD', key)

if current < limit then
  redis.call('ZADD', key, now, now .. '-' .. redis.call('INCR', key .. ':seq'))
  redis.call('PEXPIRE', key, window)
  return 1 -- Allowed
else
  return 0 -- Denied (429 Too Many Requests)
end
\`\`\``,
    edgeCasesAndPitfalls: [
      "Writing complex domain business logic inside gateway Lua plugins, creating an unmaintainable 'Smart Gateway' anti-pattern.",
      "Synchronous multi-region Redis rate limiting adding 100ms latency to every edge request (use local token buckets with asynchronous sync).",
      "Gateway scatter-gather calls without strict bounded deadlines leading to thread pool exhaustion when a single backend lags."
    ],
    keyTakeaways: [
      "Gateways must handle cross-cutting edge concerns, strictly delegating business logic to downstream domain services.",
      "Use BFFs to give frontend teams autonomy over client-specific aggregation and payload shaping.",
      "Implement sliding window rate limiting via Redis Lua to prevent boundary burst exploits."
    ]
  },

  {
    id: "ms-deep-06",
    title: "Service Mesh Internals: Envoy Proxy, xDS APIs & mTLS with SPIFFE",
    category: "Service Discovery & Mesh",
    readTimeMinutes: 29,
    overview: "Service meshes transparently handle discovery, traffic control, security, and telemetry at the network infrastructure layer. This masterclass deconstructs the Envoy sidecar architecture, the dynamic xDS streaming protocol, and cryptographic zero-trust mutual TLS (mTLS) with SPIFFE/SPIRE.",
    diagram: `
+-----------------------------------------------------------------------------------+
|                        SERVICE MESH DATA & CONTROL PLANE                          |
+-----------------------------------------------------------------------------------+
                  +-----------------------------------------------+
                  |          CONTROL PLANE (ISTIOD / CP)          |
                  | - Converts K8s CRDs to Envoy xDS              |
                  | - Issues Short-Lived X.509 SVID Certificates   |
                  +-----------------------------------------------+
                            /                           \\
                 (gRPC xDS / SDS)                   (gRPC xDS / SDS)
                          /                               \\
                         v                                 v
  +--------------------------------+             +--------------------------------+
  | POD A: ORDER SERVICE           |             | POD B: PAYMENT SERVICE         |
  |  [ Application Container ]     |             |  [ Application Container ]     |
  |             | (localhost)      |             |             ^ (localhost)      |
  |             v                  |             |             |                  |
  |  [ Envoy Sidecar Proxy ]       |             |  [ Envoy Sidecar Proxy ]       |
  +--------------------------------+             +--------------------------------+
                 |                                              ^
                 +===========[ STRICT mTLS TUNNEL ]============+
                             (Authenticated SPIFFE IDs)
`,
    deepDive: `### 1. Data Plane vs Control Plane
A service mesh partitions networking into two distinct layers:
- **Data Plane (Envoy)**: High-performance C++ sidecar proxies running alongside every application container. Intercepts all incoming and outgoing network traffic via iptables. Handles connection pooling, retries, circuit breaking, mTLS encryption, and metrics emission.
- **Control Plane (Istio / Linkerd)**: A centralized controller that translates human-authored configuration policies (YAML) into low-level instructions and streams them dynamically to the data plane proxies.

### 2. Envoy's Dynamic xDS Protocols
Unlike legacy proxies that require server restarts or reloads to update configurations, Envoy uses dynamic streaming gRPC APIs known collectively as **xDS**:
- **LDS (Listener Discovery Service)**: Pushes dynamic listening socket and port bindings.
- **RDS (Route Discovery Service)**: Pushes HTTP virtual host rules, prefix matching, and traffic weights.
- **CDS (Cluster Discovery Service)**: Pushes upstream service clusters and health check parameters.
- **EDS (Endpoint Discovery Service)**: Streams real-time pod IP addresses as Kubernetes pods scale up or down.
- **SDS (Secret Discovery Service)**: Rotates TLS certificates in memory without dropping existing TCP sockets.

### 3. Mutual TLS (mTLS) & Cryptographic SPIFFE Identity
Zero-trust architecture mandates that internal network traffic must be authenticated and encrypted:
- **SPIFFE ID**: Standardized uniform resource identifier representing workload identity (e.g. \`spiffe://cluster.local/ns/prod/sa/order-service-sa\`).
- **SVID (SPIFFE Verifiable Identity Document)**: Short-lived X.509 certificate carrying the SPIFFE ID in the Subject Alternative Name (SAN).
- **Handshake Flow**: When Pod A calls Pod B, their respective Envoy sidecars execute an mTLS handshake. Envoy A validates Envoy B's certificate against the mesh CA, and Envoy B enforces authorization policies checking whether \`order-service-sa\` is authorized to call \`POST /v1/charges\`.`,
    edgeCasesAndPitfalls: [
      "Prematurely adopting a heavy sidecar service mesh for small teams with < 15 microservices, incurring massive operational complexity.",
      "Sidecar memory bloat: running 500 pods where each Envoy proxy consumes 80MB RAM wastes 40GB of cluster memory on networking proxies alone.",
      "Iptables redirection failures during pod startup: container applications sending requests before the Envoy sidecar initialization finishes (use \`holdApplicationUntilProxyStarts\`)."
    ],
    keyTakeaways: [
      "The service mesh shifts operational resilience, telemetry, and security from application code to the network layer.",
      "Envoy uses the streaming xDS protocol to update routing tables and pod endpoints with zero downtime.",
      "SPIFFE/SPIRE provides cryptographic workload identity, enabling fine-grained mTLS authorization."
    ]
  }
];

module.exports = { chapters };
