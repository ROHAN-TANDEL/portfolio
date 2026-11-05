const { createCard } = require("../ms_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 13,
    category: "Inter-Service Communication: Synchronous REST, gRPC & GraphQL",
    concept: "Synchronous vs Asynchronous Communication Trade-offs",
    priority: "must-know",
    difficulty: "must-know",
    question: "Compare Synchronous (REST, gRPC) and Asynchronous (Kafka, RabbitMQ) inter-service communication in terms of temporal coupling, availability, and failure isolation.",
    answer: "Synchronous communication requires both client and server to be online simultaneously (temporal coupling), amplifying network latency and multiplying failure probabilities across call chains; Asynchronous messaging decouples the producer from consumer availability, buffering requests during consumer outages, but introduces eventual consistency and complex error handling.",
    explanation: `Detailed Architectural Trade-offs:
1. Temporal Coupling:
   - Synchronous: If Service A calls Service B over HTTP/gRPC, Service A is blocked waiting for Service B's immediate response. If Service B is offline or rebooting, Service A fails immediately.
   - Asynchronous: Service A publishes an event to Kafka/RabbitMQ and continues executing. Service B can consume the event seconds or hours later without Service A caring.
2. Availability Impact:
   - Synchronous: System availability is the product of all participating services: $A_{\\text{total}} = A_1 \\times A_2 \\times A_3$. A chain of 5 services each with 99.5% uptime yields only 97.5% total availability!
   - Asynchronous: Message brokers buffer events during consumer downtime. The producer's availability is decoupled from consumer health.
3. When to Use Each:
   - **Synchronous**: User authentication, instant validation, immediate read-query retrieval.
   - **Asynchronous**: Long-running background workflows, order processing, notifications, analytics.`,
    code: `/*
Availability Comparison:

Synchronous Chain:
[ User ] ──> [ Gateway ] ──> [ Order (99%) ] ──> [ Payment (99%) ] ──> [ Inventory (99%) ]
Total Availability = 0.99 * 0.99 * 0.99 = 97.0% (30 hours of downtime/year!)

Asynchronous Decoupling:
[ User ] ──> [ Order Service ] ──> Commits local DB & publishes to Kafka
                                            │
               ┌────────────────────────────┼────────────────────────────┐
               ▼                            ▼                            ▼
      [ Payment Worker ]           [ Inventory Worker ]         [ Email Worker ]
      (Can be down for maintenance without impacting Order creation!)
*/`,
    recallHint: "Sync = temporal coupling, cascading failure, immediate response. Async = decoupled availability, buffered, eventual consistency.",
    interviewTip: "In microservices interviews, default to asynchronous event-driven communication for business workflows that alter state, reserving synchronous calls strictly for read queries.",
    tags: ["synchronous", "asynchronous", "communication", "temporal-coupling", "availability", "grpc"]
  }),

  createCard({
    idNum: 14,
    category: "Inter-Service Communication: Synchronous REST, gRPC & GraphQL",
    concept: "gRPC & Protocol Buffers Architecture",
    priority: "must-know",
    difficulty: "must-know",
    question: "Why is gRPC orders of magnitude faster than REST over JSON for internal microservice communication, and what features does HTTP/2 provide?",
    answer: "gRPC uses Protocol Buffers (compact binary serialization with fixed numeric field tags) instead of human-readable text JSON, eliminating string parsing overhead; it runs on HTTP/2, enabling multiplexing multiple concurrent RPCs over a single TCP connection, HPACK header compression, binary framing, and bidirectional streaming.",
    explanation: `The Inefficiencies of REST over JSON:
1. Serialization Overhead: JSON is text. Parsing integers, floats, and strings requires heavy CPU cycles and string allocations.
2. Payload Bloat: A JSON object repeats field keys on every single packet: \`{ "transaction_timestamp_epoch_ms": 1714560000 }\`.
3. HTTP/1.1 Transport: Requires opening separate TCP connections or suffering Head-of-Line blocking.

Why gRPC Dominates Internal Microservices:
- **Protocol Buffers (Protobuf)**:
  - Strongly typed schema file (\`.proto\`).
  - Serializes fields as binary tags (\`tag_number + wire_type + value\`). A 50-character field key in JSON becomes 1 byte in Protobuf!
  - 5x to 10x smaller payload size; 7x to 10x faster serialization/deserialization.
- **HTTP/2 Transport**:
  - Multiplexing: Multiple concurrent RPC calls stream over one single persistent TCP socket.
  - Bidirectional Streaming: Client and server can stream continuous message streams simultaneously.
  - Native Deadlines & Cancellations: Canceling an RPC on client instantly stops execution on server.`,
    code: `// Protobuf Service Contract (order.proto)
syntax = "proto3";

package order.v1;

service OrderService {
  rpc CreateOrder (CreateOrderRequest) returns (CreateOrderResponse);
  rpc StreamOrderUpdates (OrderQuery) returns (stream OrderStatusUpdate);
}

message CreateOrderRequest {
  string user_id = 1;      // Field tag 1 (consumes only 1 byte on wire!)
  double total_amount = 2;  // Field tag 2
  repeated string item_ids = 3;
}

message CreateOrderResponse {
  string order_id = 1;
  string status = 2;
}`,
    recallHint: "gRPC: Binary Protobuf (no JSON text overhead) + HTTP/2 multiplexing over 1 TCP connection.",
    interviewTip: "In system design interviews, recommend: 'REST/GraphQL for external public-facing client APIs, and gRPC for internal backend-to-backend microservice RPCs.'",
    tags: ["grpc", "protobuf", "http2", "serialization", "microservices", "performance"]
  }),

  createCard({
    idNum: 15,
    category: "Inter-Service Communication: Synchronous REST, gRPC & GraphQL",
    concept: "GraphQL Federation & Subgraph Architecture",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does GraphQL Federation allow independent microservices to contribute to a single unified enterprise GraphQL schema without monolithic schema bottlenecks?",
    answer: "GraphQL Federation (Apollo Federation) decouples the API gateway from individual subgraph services. Each microservice defines and owns its slice of the GraphQL schema, extending types defined in other services using '@key' entity directives; a Federated Gateway dynamically composes subgraphs into a single unified schema and calculates optimal distributed query plans across services.",
    explanation: `The Problem of Monolithic GraphQL Gateways:
- In Schema Stitching, a central gateway team must maintain the mega-schema.
- Whenever Team A alters a field, the central gateway repository must be edited and redeployed, creating an organizational bottleneck.

Apollo Federation Architecture:
1. Subgraph Services:
   - **Users Microservice**: Defines \`type User @key(fields: "id") { id: ID! name: String email: String }\`.
   - **Orders Microservice**: Extends the User type:
     \`extend type User @key(fields: "id") { orders: [Order] }\`.
2. Federated Gateway:
   - Queries each subgraph's SDL (Schema Definition Language) on boot.
   - Composes a unified supergraph schema.
   - Query Planning: When a client requests \`query { user(id: 1) { name orders { total } } }\`:
     - Gateway fetches \`name\` from Users Subgraph.
     - Gateway fetches \`orders\` from Orders Subgraph in parallel.
     - Gateway stitches the JSON in memory and returns a single response to client.`,
    code: `/*
GraphQL Federation Architecture:

[ Mobile / Web Client ]
          │ (Single GraphQL Query)
          ▼
[ Federated Gateway (Apollo Router in Rust) ]
          │ (Query Planner executes sub-queries in parallel)
          ├──> [ Users Subgraph Service ] ──> Returns { name }
          └──> [ Orders Subgraph Service ] ──> Returns { orders }
*/`,
    recallHint: "Federation: Each microservice owns its subgraph schema; Gateway composes supergraph and plans queries.",
    interviewTip: "Highlight that Apollo Federation allows teams to own their GraphQL schema domains autonomously, eliminating central gateway deployment queues.",
    tags: ["graphql", "federation", "subgraphs", "api-gateway", "schema-stitching"]
  }),

  createCard({
    idNum: 16,
    category: "Inter-Service Communication: Synchronous REST, gRPC & GraphQL",
    concept: "RESTful API Design & Richardson Maturity Model",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Walk through the four levels of the Richardson Maturity Model for REST APIs, and explain why most production 'REST' APIs only achieve Level 2.",
    answer: "The Richardson Maturity Model categorizes API design: Level 0 (The Swamp of POX - single URI, single POST method like XML-RPC); Level 1 (Resources - individual URIs for entities); Level 2 (HTTP Verbs - GET, POST, PUT, DELETE with status codes); and Level 3 (HATEOAS - Hypermedia controls linking state transitions). Most APIs stop at Level 2 because HATEOAS client parsing overhead rarely justifies its benefits.",
    explanation: `Levels of Richardson Maturity:
- **Level 0 (Single URI & POST)**:
  - Example: \`POST /service\` with payload \`{ action: "getUser", id: 42 }\`. Uses HTTP purely as a transport tunnel.
- **Level 1 (Resources)**:
  - Introduces distinct URIs for individual entities: \`/users/42\`, \`/orders/99\`.
  - Still uses POST for all operations.
- **Level 2 (HTTP Verbs & Status Codes)**:
  - Standard industry REST: Uses semantic verbs:
    - \`GET /users/42\`: Idempotent retrieval (200 OK).
    - \`POST /users\`: Create entity (201 Created).
    - \`PUT /users/42\`: Full replace (200 OK).
    - \`DELETE /users/42\`: Remove (204 No Content).
    - Errors return proper 4xx/5xx codes (400, 404, 409 Conflict).
- **Level 3 (HATEOAS - Hypermedia As The Engine Of Application State)**:
  - Response includes hyperlinks to valid subsequent state transitions:
    \`{ "orderId": 101, "status": "PENDING", "_links": { "cancel": "/orders/101/cancel", "pay": "/orders/101/payment" } }\`.
  - Allows clients to discover actions dynamically without hardcoded URLs.`,
    code: `// Level 3 REST with HATEOAS Response in Express
app.get("/orders/:id", async (req, res) => {
  const order = await orderService.findById(req.params.id);

  res.json({
    id: order.id,
    total: order.total,
    status: order.status,
    _links: {
      self: { href: \`/orders/\${order.id}\` },
      cancel: order.status === "PENDING" ? { href: \`/orders/\${order.id}/cancel\`, method: "POST" } : null,
      payment: order.status === "PENDING" ? { href: \`/orders/\${order.id}/pay\`, method: "POST" } : null
    }
  });
});`,
    recallHint: "Level 0 = single POST. Level 1 = URIs. Level 2 = HTTP Verbs & Codes. Level 3 = HATEOAS links.",
    interviewTip: "Acknowledge that while Level 3 HATEOAS is pure REST theory, modern production teams almost universally standardize on Level 2 REST paired with OpenAPI/Swagger specifications.",
    tags: ["rest", "richardson-maturity-model", "hateoas", "api-design", "http-verbs"]
  }),

  createCard({
    idNum: 17,
    category: "Inter-Service Communication: Synchronous REST, gRPC & GraphQL",
    concept: "Network Timeouts, Deadlines & Cancellation Propagation",
    priority: "must-know",
    difficulty: "must-know",
    question: "Why must distributed RPCs enforce strict Deadlines, and how does gRPC cancellation propagation prevent orphaned computations on downstream servers?",
    answer: "A Timeout measures local elapsed duration, whereas a Deadline represents an absolute wall-clock timestamp before which an entire end-to-end operation must finish. Deadline propagation passes the remaining budget across all downstream RPC hops; if the client disconnects or the deadline expires, gRPC automatically propagates cancellation signals down the call tree to terminate wasted CPU and database work immediately.",
    explanation: `The Orphaned Computation Waste:
Consider a call chain: User -> Gateway -> Order Service -> Inventory Service -> Warehouse DB.
- Gateway sets a 2-second timeout.
- Order Service takes 2.1 seconds.
- Gateway times out and returns HTTP 504 to the user. The user closes their browser.
- BUT: Inventory Service and Warehouse DB don't know the user left! They continue spending CPU, memory, and database locks executing queries for the next 15 seconds.
- Under heavy load, orphaned queries saturate backend database pools for requests whose callers have already given up!

Deadline Propagation Mechanics:
1. Gateway receives request and sets an absolute deadline: \`Deadline = Now + 2000ms\`.
2. Passed in gRPC header: \`grpc-timeout: 1850m\` (subtracting elapsed network latency).
3. Inventory Service receives call: inspects remaining time (e.g., only 400ms left).
4. If client cancels or deadline expires:
   - Go: \`ctx.Done()\` triggers.
   - Node.js: \`call.on('cancelled')\` fires.
   - Database driver aborts running SQL query immediately (\`statement_timeout\`), freeing system resources.`,
    code: `// gRPC Deadline Propagation in Node.js
import * as grpc from "@grpc/grpc-js";

function callInventoryWithDeadline(client: any, orderId: string, timeoutMs = 1500) {
  // Set absolute deadline
  const deadline = new Date(Date.now() + timeoutMs);

  client.checkStock({ orderId }, { deadline }, (err: any, response: any) => {
    if (err) {
      if (err.code === grpc.status.DEADLINE_EXCEEDED) {
        console.error("Downstream RPC aborted: Deadline exceeded!");
      }
      return;
    }
    console.log("Stock available:", response.available);
  });
}`,
    recallHint: "Timeout = local duration. Deadline = absolute deadline passed down call tree to abort wasted work.",
    interviewTip: "Always mention deadline and cancellation propagation when discussing microservice resilience: it prevents wasted CPU cycles on abandoned requests during traffic spikes.",
    tags: ["grpc", "deadlines", "cancellation-propagation", "timeouts", "resilience", "microservices"]
  }),

  createCard({
    idNum: 18,
    category: "Inter-Service Communication: Synchronous REST, gRPC & GraphQL",
    concept: "Serialization Protocols: JSON vs Protobuf vs Avro vs FlatBuffers",
    priority: "must-know",
    difficulty: "advanced",
    question: "Compare JSON, Protocol Buffers, Apache Avro, and FlatBuffers across schema enforcement, CPU serialization cost, payload size, and zero-copy parsing.",
    answer: "JSON is human-readable text with high CPU parsing overhead and payload bloat; Protobuf uses compact binary encoding with numeric tags for high-speed gRPC; Apache Avro relies on dynamic schemas stored externally (Schema Registry) to serialize data without field tags, ideal for Kafka streaming; FlatBuffers enables zero-copy deserialization by accessing internal fields directly from binary buffers without memory unpacking.",
    explanation: `Protocol Comparison Matrix:
| Protocol | Format | Schema Requirement | CPU Overhead | Payload Size | Zero-Copy Read | Primary Use Case |
|---|---|---|---|---|---|---|
| **JSON** | Text | Optional (JSON Schema) | High (string parsing) | Large (repeats keys) | No | Public Web APIs, Mobile |
| **Protobuf** | Binary | Strict (.proto file) | Very Low | Small | No (unpacks to heap) | gRPC internal microservices |
| **Apache Avro** | Binary | Strict (.avsc JSON) | Very Low | Smallest (no field tags) | No | Kafka event streaming |
| **FlatBuffers** | Binary | Strict (.fbs file) | Near Zero (0-copy) | Small | Yes (reads in-place) | Gaming, Edge AI, Finance |

Why Avro Dominates Kafka:
- In Protobuf, each field includes a 1-byte numeric tag.
- In Avro, records do NOT contain field tags or names! The payload is pure raw byte values.
- The consumer reads the schema from Confluent Schema Registry (cached by schema ID), knowing exact byte offsets. Achieves maximum compression over millions of streamed messages.`,
    code: `/*
Serialization Byte Layout Comparison:

JSON Payload (48 bytes):
{"user_id": 1042, "user_name": "Alice", "active": true}

Protobuf Payload (14 bytes):
[08] [92 08] [12] [05] [41 6c 69 63 65] [18] [01]
(Tag 1: int 1042) (Tag 2: str "Alice") (Tag 3: bool 1)

Avro Payload with Schema Registry (8 bytes!):
[92 08] [0a] [41 6c 69 63 65] [01]
(Schema ID in header; data is pure packed binary values!)
*/`,
    recallHint: "JSON = text (slow). Protobuf = binary with tags (gRPC). Avro = schema-less binary (Kafka). FlatBuffers = zero-copy in-place read.",
    interviewTip: "In data-intensive streaming designs, choose Avro with Confluent Schema Registry over JSON to reduce Kafka disk storage and network bandwidth by 70%+.",
    tags: ["serialization", "protobuf", "avro", "flatbuffers", "json", "kafka"]
  }),

  createCard({
    idNum: 19,
    category: "Inter-Service Communication: Synchronous REST, gRPC & GraphQL",
    concept: "API Versioning Strategies: URI vs Header vs Content Negotiation",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Compare URI path versioning, Header versioning, and Content Negotiation (Accept header) across caching, client DX, and API Gateway routing.",
    answer: "URI path versioning (/v1/orders) is explicit, easily debugged, and cleanly cached by CDNs, but alters resource identifiers; Header versioning (X-API-Version: 2) preserves clean URLs but is invisible in browsers and complicates CDN caching; Content Negotiation (Accept: application/vnd.company.v2+json) adheres strictly to REST principles but has the highest client integration complexity.",
    explanation: `Detailed Versioning Analysis:
1. URI Path Versioning (e.g., \`https://api.com/v1/orders\` vs \`/v2/orders\`):
   - Pros: Transparent to developers; straightforward routing in NGINX/Envoy; 100% compatible with CDN caching out of the box.
   - Cons: Purists argue that versioning the URI violates REST (an Order resource ID should not change because its representation evolved).
2. Custom Request Header (e.g., \`X-API-Version: 2026-05-01\` - Stripe Model):
   - Pros: URIs remain clean and persistent (\`/orders\`); supports date-based API evolutions.
   - Cons: Requires configuring CDNs to include the custom header in the Cache Key (\`Vary: X-API-Version\`), otherwise users receive cached v1 responses for v2 requests.
3. Content Negotiation / Accept Header (e.g., \`Accept: application/vnd.orders.v2+json\`):
   - Pros: Academically pure REST; supports fine-grained content representation switching (e.g., XML vs JSON vs Protobuf).
   - Cons: Hard to test in cURL/browsers; complex client SDK management.`,
    code: `// Express.js Multi-Strategy API Version Router
app.get("/orders/:id", (req, res) => {
  // Check header first (Stripe model), fallback to v1 default
  const apiVersion = req.headers["x-api-version"] || "v1";

  if (apiVersion === "2026-05-01" || apiVersion === "v2") {
    return res.json(formatOrderV2(order));
  }
  return res.json(formatOrderV1(order));
});`,
    recallHint: "URI (/v1/users) = simple & CDN friendly. Header (X-Version) = clean URLs. Accept header = pure REST.",
    interviewTip: "Recommend URI versioning for public APIs due to universal client tooling support, and Stripe-style date headers (`X-API-Version: 2026-01-01`) for complex enterprise SaaS platforms.",
    tags: ["api-versioning", "rest", "headers", "content-negotiation", "cdn-caching"]
  }),

  createCard({
    idNum: 20,
    category: "Inter-Service Communication: Synchronous REST, gRPC & GraphQL",
    concept: "Consumer-Driven Contract Testing (Pact Framework)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Consumer-Driven Contract Testing, and how does Pact eliminate flaky End-to-End (E2E) integration environments in CI/CD pipelines?",
    answer: "Consumer-Driven Contract Testing shifts contract definition to the consumer: the client defines a 'Pact' file specifying the exact requests it sends and the minimum responses it expects. The provider service's CI pipeline runs automated tests against this contract without deploying the consumer. This catches breaking API changes before code merges, eliminating slow, brittle end-to-end integration test environments.",
    explanation: `The Failure of End-to-End (E2E) Staging Environments:
- In microservices with 50+ services, maintaining a dedicated 'Staging' environment where all 50 services are deployed and running is notoriously brittle.
- Tests fail due to environmental flakes (database down, service timeout, test data collisions), not actual code bugs.
- Deployments queue up waiting for overnight E2E regression runs.

How Consumer-Driven Contracts (Pact) Work:
1. Consumer Writes Unit Test:
   - Order Service tests its client adapter using a local Pact mock server.
   - Generates a JSON contract file (\`OrderService-PaymentService.json\`) containing expected payload schemas.
2. Publish to Pact Broker:
   - Consumer publishes the contract to a centralized Pact Broker repository.
3. Provider Verifies in Isolation:
   - Payment Service CI pipeline pulls the contract and replays the requests against its local controller.
   - If Payment Service changed a field name from \`amount\` to \`totalAmount\`, the test fails immediately in Payment Service's PR!
4. \`can-i-deploy\` Gate:
   - CI/CD checks the Pact Broker: 'Can Order Service v2.1 deploy to Production?'. Broker confirms Payment Service v1.8 satisfies the contract. Safe to deploy!`,
    code: `// Pact Consumer Contract Test in TypeScript (pact-js)
import { PactV3, MatchersV3 } from "@pact-foundation/pact";

const provider = new PactV3({
  consumer: "OrderService",
  provider: "PaymentService"
});

test("Payment Service satisfies Order Service contract", async () => {
  provider
    .uponReceiving("A request to charge a credit card")
    .withRequest({
      method: "POST",
      path: "/payments/charge",
      body: { amount: 100, currency: "USD" }
    })
    .willRespondWith({
      status: 200,
      body: {
        paymentId: MatchersV3.uuid(),
        status: MatchersV3.regex(/^(SUCCESS|PENDING)$/, "SUCCESS")
      }
    });

  await provider.executeTest(async (mockServer) => {
    const client = new PaymentClient(mockServer.url);
    const res = await client.charge(100, "USD");
    expect(res.status).toBe("SUCCESS");
  });
});`,
    recallHint: "Contract Testing: Consumer defines expected schema in Pact file; Provider tests against it in CI. Kills flaky staging.",
    interviewTip: "Highlight that Consumer-Driven Contract Testing enables true independent deployability: teams deploy to production with mathematical confidence that they won't break downstream consumers.",
    tags: ["contract-testing", "pact", "testing", "ci-cd", "microservices", "quality-assurance"]
  }),

  createCard({
    idNum: 21,
    category: "Inter-Service Communication: Synchronous REST, gRPC & GraphQL",
    concept: "Client Code Generation with OpenAPI & Protobuf Compilers",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why should microservice client SDKs never be hand-coded, and how do OpenAPI Generator and protoc automate client generation?",
    answer: "Hand-coding HTTP client SDKs across multiple languages inevitably leads to schema drift, missing error handlers, inconsistent header propagation, and duplicated serialization bugs. Compiling SDKs automatically from machine-readable specifications (OpenAPI/Swagger YAML via openapi-generator, or Protocol Buffers via protoc) guarantees 100% type safety, automated deserialization, and built-in tracing support.",
    explanation: `The Dangers of Manual SDKs:
- Backend team updates \`User\` model in Go service.
- Frontend team in TypeScript and Analytics team in Python must manually update their HTTP fetch helpers.
- Typos, missing fields, and date format discrepancies cause production runtime crashes that type-checkers fail to catch.

The Automated Code Generation Pipeline:
1. Single Source of Truth (Spec-First):
   - Contract defined in \`api-spec.yaml\` (OpenAPI 3.1) or \`service.proto\` (Protobuf).
2. Build Automation in CI:
   - \`protoc --go_out=. --ts_out=. service.proto\`
   - \`openapi-generator-cli generate -i spec.yaml -g typescript-axios -o ./sdk/ts\`
3. Output:
   - Produces strongly typed TypeScript interfaces, request builder classes, validation guards, and mock stubs.
4. Artifact Publishing:
   - Generated SDK is packaged and published to private npm/Maven/PyPI registries automatically upon merging contract changes.`,
    code: `/*
CI/CD Client SDK Generation Workflow:

[ OpenAPI / Protobuf Spec ] (Single Source of Truth)
            │
    [ CI Build Pipeline ]
    ├── openapi-generator -g typescript-fetch ──> Published to @corp/order-client (npm)
    ├── openapi-generator -g python           ──> Published to corp-order-client (PyPI)
    └── protoc --go_out=.                     ──> Committed to github.com/corp/order-proto
*/`,
    recallHint: "Never hand-write API clients. Generate typed SDKs from OpenAPI or Protobuf specs automatically in CI.",
    interviewTip: "Promote 'Spec-First Design': write the OpenAPI or Protobuf contract first, align stakeholders, generate code, and implement the business logic.",
    tags: ["code-generation", "openapi", "swagger", "protoc", "sdk", "type-safety"]
  }),

  createCard({
    idNum: 22,
    category: "Inter-Service Communication: Synchronous REST, gRPC & GraphQL",
    concept: "Semantic Versioning & Breaking vs Non-Breaking API Changes",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What rules govern Semantic Versioning (SemVer) in microservices, and how do architects make backward-compatible changes to prevent breaking client services?",
    answer: "Semantic Versioning (MAJOR.MINOR.PATCH) increments MAJOR for breaking changes, MINOR for backward-compatible additions, and PATCH for backward-compatible bug fixes. In microservices, architects strive to NEVER make breaking changes: add optional fields instead of renaming, accept multiple formats, and deploy parallel endpoints to allow consumers to migrate at their own pace.",
    explanation: `The Cost of Breaking Changes:
- Bumping MAJOR version (\`v1 -> v2\`) in a shared microservice forces all 15 calling services to coordinate updates, destroying team autonomy.

Rules for Backward-Compatible (Non-Breaking) Changes:
1. **Adding Fields**:
   - Adding a new optional field is non-breaking.
   - Consumers ignoring the field continue functioning.
2. **Never Rename Fields**:
   - Do NOT rename \`phone\` to \`phoneNumber\`.
   - Instead, add \`phoneNumber\` alongside \`phone\`, populate both, deprecate \`phone\`, and wait 6 months before deletion.
3. **Never Make Optional Fields Required**:
   - Existing clients calling the endpoint without that field will suddenly fail with 400 Bad Request.
4. **Protobuf Strict Compatibility Rules**:
   - Never change the numeric field tag of an existing field.
   - If deleting a field, mark its tag and name as \`reserved\` so future developers never reuse it!`,
    code: `// Protobuf Safe Field Deprecation & Reservation
syntax = "proto3";

message UserProfile {
  // Reserved tags and names prevent accidental reuse that corrupts binary wire data!
  reserved 2, 7;
  reserved "old_phone_number", "ssn";

  string id = 1;
  string full_name = 3;
  string mobile_phone = 4; // Newly added field
}`,
    recallHint: "Major = breaking. Minor = feature. Patch = fix. Never rename fields or reuse Protobuf tags; mark reserved.",
    interviewTip: "State the Golden Rule of Microservice APIs: 'Be conservative in what you send, be liberal in what you accept' (Postel's Law / Robustness Principle).",
    tags: ["semver", "api-versioning", "backward-compatibility", "protobuf", "breaking-changes"]
  }),

  createCard({
    idNum: 23,
    category: "Inter-Service Communication: Synchronous REST, gRPC & GraphQL",
    concept: "Mocking & Stubs with WireMock and Testcontainers",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do WireMock and Testcontainers enable reliable microservice integration testing without standing up full distributed staging environments?",
    answer: "WireMock runs an in-process HTTP/gRPC server stubbing external downstream dependencies with deterministic responses and network delay simulations; Testcontainers runs real, ephemeral Docker containers (PostgreSQL, Kafka, Redis) directly from unit tests, spinning up and tearing down isolated databases per test suite for 100% production fidelity.",
    explanation: `The Problem of Unit Tests vs End-to-End Tests:
- Mocking everything with in-memory language mocks (\`jest.mock()\`) passes tests, but misses real SQL syntax errors, database constraints, and network serialization bugs.
- Testing against shared staging environments causes flakiness and data collisions.

The Testcontainers + WireMock Solution:
1. **Testcontainers (Real Infrastructure)**:
   - When the test runs, Testcontainers launches a real PostgreSQL 16 Docker container on an ephemeral port.
   - Runs database migrations, inserts seed data, executes real SQL queries, and shuts down after testing.
   - Catches real foreign key violations, query index issues, and connection pool timeouts!
2. **WireMock (External Dependency Mocking)**:
   - Order Service needs to call Payment Service.
   - WireMock runs a lightweight local mock server listening for \`POST /payments\`.
   - Simulates edge cases: payment success, 402 payment declined, 500 server error, and 3-second network timeouts.`,
    code: `// Integration Testing with WireMock & Testcontainers Concept (TypeScript)
import { GenericContainer } from "testcontainers";

describe("OrderService Integration Test", () => {
  let postgresContainer: any;

  beforeAll(async () => {
    // Spin up real ephemeral Postgres container
    postgresContainer = await new GenericContainer("postgres:16-alpine")
      .withEnvironment({ POSTGRES_PASSWORD: "secret", POSTGRES_DB: "test" })
      .withExposedPorts(5432)
      .start();
  });

  afterAll(async () => {
    await postgresContainer.stop();
  });

  it("persists order safely to real database", async () => {
    const port = postgresContainer.getMappedPort(5432);
    const db = connectToTestDb(port);
    const order = await db.insertOrder({ id: "101", total: 50 });
    expect(order.id).toBe("101");
  });
});`,
    recallHint: "Testcontainers runs real DBs/Kafka in Docker for tests. WireMock stubs HTTP/gRPC downstream APIs.",
    interviewTip: "Mentioning Testcontainers and WireMock in testing discussions demonstrates modern, high-velocity CI/CD engineering standards.",
    tags: ["testcontainers", "wiremock", "integration-testing", "mocking", "testing-pyramid"]
  }),

  createCard({
    idNum: 24,
    category: "Inter-Service Communication: Synchronous REST, gRPC & GraphQL",
    concept: "Internal vs External API Boundaries (Edge vs Private Mesh)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why must organizations strictly separate External Public APIs from Internal Microservice APIs across security, protocols, and SLA commitments?",
    answer: "External APIs face public internet clients (browsers, mobile, partners), mandating public auth (OAuth/OIDC), strict rate limiting, WAF inspection, REST/JSON or GraphQL, and long-term backward-compatible SemVer commitments; Internal APIs operate inside private VPC subnets/service meshes, optimized for high throughput using gRPC/mTLS with binary protocols and faster evolutionary cycles.",
    explanation: `Key Distinctions:
1. Protocols & Serialization:
   - External: REST over HTTP/1.1 or HTTP/2, JSON, GraphQL. Optimized for human readability, browser compatibility, and public client ease of use.
   - Internal: gRPC over HTTP/2, binary Protobuf, Avro. Optimized for maximum throughput and minimum CPU serialization cost.
2. Authentication & Authorization:
   - External: API Keys, OAuth 2.0 Access Tokens, OpenID Connect JWTs, Captcha verification.
   - Internal: Mutual TLS (mTLS) with SPIFFE X.509 certificates, internal service-to-service service accounts.
3. SLA & Breaking Change Tolerance:
   - External: Breaking changes require 12-month deprecation notices and parallel v1/v2 maintenance.
   - Internal: Breaking changes can be coordinated and verified using Consumer-Driven Contract Testing (Pact) within days.
4. Security Perimeter:
   - Internal microservice ports must NEVER be directly exposed to the public internet without an API Gateway / WAF intermediary.`,
    code: `/*
Network Boundary Architecture:

[ Public Internet / Untrusted Zone ]
                 │ (HTTPS / JSON / OAuth2 Tokens)
                 ▼
[ Edge API Gateway (Kong / Cloudflare / Envoy) ]
- WAF Inspection, Global Rate Limiting, TLS Termination, Auth Validation
                 │
=================│================================== (VPC Private Perimeter)
                 │ (Internal VPC Mesh - gRPC / mTLS / Protobuf)
                 ▼
        [ Order Microservice ]
                 │
                 ├──(gRPC mTLS)──> [ Payment Microservice ]
                 └──(gRPC mTLS)──> [ Inventory Microservice ]
*/`,
    recallHint: "External = REST/JSON, OAuth2, public WAF, slow evolution. Internal = gRPC, mTLS, fast throughput.",
    interviewTip: "Never expose internal microservice gRPC endpoints directly to mobile clients. Always insert an API Gateway or BFF layer to translate external REST/GraphQL into internal gRPC.",
    tags: ["api-boundaries", "api-gateway", "grpc", "rest", "security", "zero-trust"]
  })
];

module.exports = cards;
