const recipes = [
  {
    id: "ms-ex-01",
    title: "Strangler Fig Ingress Router with Dynamic Path Rewriting",
    category: "Decomposition & DDD",
    difficulty: "intermediate",
    whatThisCodeCovers: "A production reverse proxy router using Fastify and http-proxy that routes specific modernized bounded context paths to newly built microservices while passing legacy traffic to the monolithic server.",
    conceptsCovered: ["Strangler Fig", "Reverse Proxy", "Prefix Stripping", "Path Rewriting", "Zero-Downtime Migration"],
    code: `import Fastify from "fastify";
import proxy from "@fastify/http-proxy";

const server = Fastify({ logger: true });

// 1. Modernized Order Microservice (Migrated Bounded Context)
await server.register(proxy, {
  upstream: "http://order-microservice.prod.svc.cluster.local:8080",
  prefix: "/api/v1/orders",
  rewritePrefix: "/orders",
  http2: false,
  replyOptions: {
    rewriteRequestHeaders: (req, headers) => ({
      ...headers,
      "x-strangler-route": "microservice-v1-orders",
      "x-forwarded-host": req.hostname
    })
  }
});

// 2. Modernized Customer Loyalty Microservice
await server.register(proxy, {
  upstream: "http://loyalty-microservice.prod.svc.cluster.local:8081",
  prefix: "/api/v1/loyalty",
  rewritePrefix: "/loyalty",
  http2: false
});

// 3. Fallback Route: All un-migrated paths go directly to the legacy monolith
await server.register(proxy, {
  upstream: "http://legacy-monolith.internal:3000",
  prefix: "/",
  replyOptions: {
    rewriteRequestHeaders: (req, headers) => ({
      ...headers,
      "x-strangler-route": "legacy-monolith-fallback"
    })
  }
});

await server.listen({ port: 80, host: "0.0.0.0" });
console.log("Strangler Fig Proxy running on port 80");`,
    breakdown: [
      "Registers explicit prefixes for migrated microservices ahead of the root fallback.",
      "Rewrites public URL paths (/api/v1/orders) to internal container paths (/orders).",
      "Injects diagnostic headers to track route migration and verification in distributed logs.",
      "Ensures the legacy monolith remains untouched while incremental migration proceeds."
    ],
    expectedOutput: "Incoming GET /api/v1/orders/123 proxies to order-microservice:8080/orders/123. Unmapped routes hit legacy-monolith."
  },

  {
    id: "ms-ex-02",
    title: "Anti-Corruption Layer (ACL) Domain Model Adapter",
    category: "Decomposition & DDD",
    difficulty: "intermediate",
    whatThisCodeCovers: "An Anti-Corruption Layer translating legacy database rows and messy terminology into clean, strictly validated domain entities using TypeScript and Zod.",
    conceptsCovered: ["Anti-Corruption Layer", "DDD", "Domain Translation", "Zod Validation", "Decoupling"],
    code: `import { z } from "zod";

// Modern Clean Domain Entity
export interface CustomerAccount {
  id: string;
  email: string;
  fullName: string;
  tier: "STANDARD" | "VIP" | "ENTERPRISE";
  isActive: boolean;
}

// Raw Legacy Model from 15-year-old Monolith Database
interface LegacyCustomerRow {
  CUST_ID: number;
  CUST_EMAIL_ADDR: string;
  CUST_FNAME: string;
  CUST_LNAME: string;
  ACCT_STATUS_FLAG: number; // 1 = Active, 0 = Inactive, 9 = Suspended
  MEMBERSHIP_LVL_CD: string; // "S", "V", "E"
}

export class CustomerAntiCorruptionLayer {
  static toDomain(legacyRow: LegacyCustomerRow): CustomerAccount {
    const tierMap: Record<string, CustomerAccount["tier"]> = {
      S: "STANDARD",
      V: "VIP",
      E: "ENTERPRISE"
    };

    return {
      id: \`cust_\${legacyRow.CUST_ID}\`,
      email: legacyRow.CUST_EMAIL_ADDR.trim().toLowerCase(),
      fullName: \`\${legacyRow.CUST_FNAME.trim()} \${legacyRow.CUST_LNAME.trim()}\`,
      tier: tierMap[legacyRow.MEMBERSHIP_LVL_CD] || "STANDARD",
      isActive: legacyRow.ACCT_STATUS_FLAG === 1
    };
  }

  static toLegacy(domain: CustomerAccount): Partial<LegacyCustomerRow> {
    const reverseTier: Record<CustomerAccount["tier"], string> = {
      STANDARD: "S",
      VIP: "V",
      ENTERPRISE: "E"
    };

    const [first, ...rest] = domain.fullName.split(" ");
    return {
      CUST_EMAIL_ADDR: domain.email,
      CUST_FNAME: first,
      CUST_LNAME: rest.join(" "),
      MEMBERSHIP_LVL_CD: reverseTier[domain.tier],
      ACCT_STATUS_FLAG: domain.isActive ? 1 : 0
    };
  }
}

// Usage in new microservice repository:
const legacyRecord: LegacyCustomerRow = {
  CUST_ID: 9812,
  CUST_EMAIL_ADDR: "  ALICE@DOMAIN.COM ",
  CUST_FNAME: "Alice",
  CUST_LNAME: "Smith",
  ACCT_STATUS_FLAG: 1,
  MEMBERSHIP_LVL_CD: "V"
};

const domainEntity = CustomerAntiCorruptionLayer.toDomain(legacyRecord);
console.log("Clean Domain Model:", domainEntity);`,
    breakdown: [
      "Decouples internal modern microservice types from legacy snake_case database columns.",
      "Transforms ambiguous numerical flags (1/0/9) into explicit TypeScript union types.",
      "Sanitizes strings and formats names cleanly.",
      "Provides bi-directional mapping so the new microservice can write back without corrupting legacy systems."
    ],
    expectedOutput: "Clean Domain Model: { id: 'cust_9812', email: 'alice@domain.com', fullName: 'Alice Smith', tier: 'VIP', isActive: true }"
  },

  {
    id: "ms-ex-03",
    title: "gRPC Server Implementation with Protobuf in TypeScript",
    category: "Inter-Service Networking",
    difficulty: "intermediate",
    whatThisCodeCovers: "A complete gRPC server implementing an Inventory Service using @grpc/grpc-js, featuring status codes, request validation, and binary response framing.",
    conceptsCovered: ["gRPC", "Protobuf", "HTTP/2", "Status Codes", "Service Definition"],
    code: `import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";
import path from "node:path";

// Mock database
const inventoryDb = new Map<string, number>([
  ["item-sku-001", 45],
  ["item-sku-002", 0],
  ["item-sku-003", 120]
]);

const PROTO_PATH = path.resolve(process.cwd(), "proto/inventory.proto");
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const protoDescriptor = grpc.loadPackageDefinition(packageDefinition) as any;
const inventoryProto = protoDescriptor.inventory.v1;

const server = new grpc.Server();

// Implementing RPC Handlers
server.addService(inventoryProto.InventoryService.service, {
  checkStock: (call: any, callback: any) => {
    const { item_id } = call.request;

    if (!item_id) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: "item_id parameter is required"
      });
    }

    if (!inventoryDb.has(item_id)) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: \`Item \${item_id} not found in inventory\`
      });
    }

    const available = inventoryDb.get(item_id)!;
    callback(null, {
      item_id,
      available_units: available,
      in_stock: available > 0
    });
  }
});

server.bindAsync(
  "0.0.0.0:50051",
  grpc.ServerCredentials.createInsecure(),
  (err, port) => {
    if (err) throw err;
    console.log(\`gRPC Inventory Server listening on port \${port}\`);
  }
);`,
    breakdown: [
      "Loads dynamic Protobuf definition at runtime using proto-loader.",
      "Implements strict gRPC status codes (INVALID_ARGUMENT, NOT_FOUND) mapped to gRPC conventions.",
      "Returns binary Protobuf structures over HTTP/2 framing.",
      "Provides high-throughput inter-service query capability without textual JSON parsing."
    ],
    expectedOutput: "gRPC Inventory Server listening on port 50051. Responds with binary StockResponse."
  },

  {
    id: "ms-ex-04",
    title: "gRPC Client with Bounded Deadlines & Interceptors",
    category: "Inter-Service Networking",
    difficulty: "advanced",
    whatThisCodeCovers: "A resilient gRPC client featuring client-side interceptors for trace context injection, logging, and strict deadline enforcement.",
    conceptsCovered: ["gRPC Client", "Deadlines", "Client Interceptors", "Distributed Tracing", "Timeout Budgets"],
    code: `import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

// Client Tracing Interceptor
function createTracingInterceptor(traceId: string) {
  return (options: any, nextCall: any) => {
    return new grpc.InterceptingCall(nextCall(options), {
      start: (metadata, listener, next) => {
        // Inject W3C traceparent into gRPC metadata
        metadata.set("traceparent", \`00-\${traceId}-00f067aa0ba902b7-01\`);
        next(metadata, listener);
      }
    });
  };
}

export class InventoryServiceClient {
  private client: any;

  constructor(serverAddress: string) {
    const packageDef = protoLoader.loadSync("./proto/inventory.proto");
    const proto = (grpc.loadPackageDefinition(packageDef) as any).inventory.v1;
    this.client = new proto.InventoryService(
      serverAddress,
      grpc.credentials.createInsecure()
    );
  }

  async checkStock(itemId: string, timeoutMs = 800, traceId = "4bf92f3577b34da6a3ce929d0e0e4736"): Promise<any> {
    const deadline = new Date(Date.now() + timeoutMs);
    const interceptor = createTracingInterceptor(traceId);

    return new Promise((resolve, reject) => {
      this.client.checkStock(
        { item_id: itemId },
        { deadline, interceptors: [interceptor] },
        (err: any, response: any) => {
          if (err) {
            if (err.code === grpc.status.DEADLINE_EXCEEDED) {
              return reject(new Error(\`[Timeout] gRPC deadline exceeded after \${timeoutMs}ms\`));
            }
            return reject(err);
          }
          resolve(response);
        }
      );
    });
  }
}

// Client execution
const invClient = new InventoryServiceClient("localhost:50051");
invClient.checkStock("item-sku-001", 500)
  .then(res => console.log("gRPC Response:", res))
  .catch(err => console.error("gRPC Error:", err.message));`,
    breakdown: [
      "Enforces a hard deadline timestamp using Date.now() + timeoutMs.",
      "Implements client interceptors to automatically inject W3C traceparent headers.",
      "Catches DEADLINE_EXCEEDED errors and translates them into domain timeout exceptions.",
      "Decouples callers from raw callback syntax using clean async/await promises."
    ],
    expectedOutput: "gRPC Response: { item_id: 'item-sku-001', available_units: 45, in_stock: true }"
  },

  {
    id: "ms-ex-05",
    title: "Client-Side Round-Robin Load Balancer with Health Checks",
    category: "Inter-Service Networking",
    difficulty: "intermediate",
    whatThisCodeCovers: "A client-side load balancer implementing weighted round-robin distribution, background health probing, and automatic eviction of degraded instance endpoints.",
    conceptsCovered: ["Client-Side Load Balancing", "Health Probing", "Endpoint Eviction", "Round-Robin", "Failover"],
    code: `export interface ServiceEndpoint {
  url: string;
  isHealthy: boolean;
  consecutiveFailures: number;
}

export class ClientSideLoadBalancer {
  private endpoints: ServiceEndpoint[];
  private currentIndex = 0;

  constructor(endpoints: string[], private healthCheckIntervalMs = 5000) {
    this.endpoints = endpoints.map(url => ({
      url,
      isHealthy: true,
      consecutiveFailures: 0
    }));

    this.startHealthChecks();
  }

  // Select next healthy endpoint via Round-Robin
  getNextEndpoint(): string {
    const healthy = this.endpoints.filter(e => e.isHealthy);
    if (healthy.length === 0) {
      throw new Error("No healthy service endpoints available");
    }

    const endpoint = healthy[this.currentIndex % healthy.length];
    this.currentIndex++;
    return endpoint.url;
  }

  // Record outcome to detect degraded nodes immediately
  recordOutcome(url: string, success: boolean) {
    const ep = this.endpoints.find(e => e.url === url);
    if (!ep) return;

    if (success) {
      ep.consecutiveFailures = 0;
      ep.isHealthy = true;
    } else {
      ep.consecutiveFailures++;
      if (ep.consecutiveFailures >= 3) {
        ep.isHealthy = false;
        console.warn(\`[LB] Ejected degraded endpoint: \${url} (3 consecutive failures)\`);
      }
    }
  }

  private startHealthChecks() {
    setInterval(async () => {
      for (const ep of this.endpoints) {
        try {
          const res = await fetch(\`\${ep.url}/healthz\`, { signal: AbortSignal.timeout(1000) });
          if (res.ok) {
            ep.isHealthy = true;
            ep.consecutiveFailures = 0;
          } else {
            ep.isHealthy = false;
          }
        } catch {
          ep.isHealthy = false;
        }
      }
    }, this.healthCheckIntervalMs);
  }
}

// Verification:
const lb = new ClientSideLoadBalancer([
  "http://srv-node-1.internal",
  "http://srv-node-2.internal",
  "http://srv-node-3.internal"
]);

console.log("Selected:", lb.getNextEndpoint());
console.log("Selected:", lb.getNextEndpoint());
lb.recordOutcome("http://srv-node-1.internal", false);
lb.recordOutcome("http://srv-node-1.internal", false);
lb.recordOutcome("http://srv-node-1.internal", false); // Ejected!
console.log("Selected after ejection:", lb.getNextEndpoint());`,
    breakdown: [
      "Tracks health status and consecutive failure counters per endpoint.",
      "Implements round-robin selection strictly filtered across currently healthy instances.",
      "Passively detects failure on active requests and proactively verifies recovery via periodic health probes.",
      "Prevents cascading failure by removing failing pods before active traffic stalls."
    ],
    expectedOutput: "Rotates through healthy nodes. Ejects node 1 after 3 failures, routing exclusively to nodes 2 and 3."
  },

  {
    id: "ms-ex-06",
    title: "API Composition & In-Memory Join Aggregation",
    category: "Decomposition & DDD",
    difficulty: "intermediate",
    whatThisCodeCovers: "An API Composer service aggregating user orders, shipping tracking details, and inventory line-items across three independent microservices concurrently.",
    conceptsCovered: ["API Composition", "Scatter-Gather", "Promise.allSettled", "Partial Failure", "Denormalization"],
    code: `export class OrderDetailComposer {
  constructor(
    private readonly orderClientUrl: string,
    private readonly shippingClientUrl: string,
    private readonly catalogClientUrl: string
  ) {}

  async getOrderDetails(orderId: string, traceparent: string) {
    const headers = { traceparent, "Content-Type": "application/json" };
    const timeout = 600; // 600ms budget

    // 1. Fetch primary order entity (Mandatory)
    const orderRes = await fetch(\`\${this.orderClientUrl}/orders/\${orderId}\`, {
      headers,
      signal: AbortSignal.timeout(timeout)
    });
    if (!orderRes.ok) throw new Error(\`Order \${orderId} not found\`);
    const order = await orderRes.json();

    // 2. Concurrently fetch Shipping Status and Catalog Item enrichment
    const [shippingResult, catalogResult] = await Promise.allSettled([
      fetch(\`\${this.shippingClientUrl}/shipments/\${order.trackingId}\`, {
        headers,
        signal: AbortSignal.timeout(timeout)
      }).then(r => r.json()),
      fetch(\`\${this.catalogClientUrl}/items/batch\`, {
        method: "POST",
        headers,
        body: JSON.stringify({ itemIds: order.itemIds }),
        signal: AbortSignal.timeout(timeout)
      }).then(r => r.json())
    ]);

    // 3. Compose response with graceful degradation for non-critical enrichment
    return {
      orderId: order.id,
      totalAmount: order.amount,
      status: order.status,
      shipping: shippingResult.status === "fulfilled"
        ? shippingResult.value
        : { status: "TRACKING_TEMPORARILY_UNAVAILABLE", eta: null },
      items: catalogResult.status === "fulfilled"
        ? catalogResult.value
        : order.itemIds.map((id: string) => ({ id, name: "Item details unavailable" })),
      degraded: shippingResult.status === "rejected" || catalogResult.status === "rejected"
    };
  }
}`,
    breakdown: [
      "Performs mandatory primary query first to extract foreign entity IDs.",
      "Executes parallel downstream queries using Promise.allSettled with strict abort signal timeouts.",
      "Handles partial downstream failure gracefully by substituting fallback stubs.",
      "Surfaces an explicit degraded telemetry flag for API consumers and monitoring dashboards."
    ],
    expectedOutput: "Composed Order payload containing order fields, live shipping data, and enriched catalog line items."
  },

  {
    id: "ms-ex-07",
    title: "GraphQL Federation Subgraph with Apollo Server v4",
    category: "Decomposition & DDD",
    difficulty: "advanced",
    whatThisCodeCovers: "A complete federated GraphQL subgraph for a Review microservice that extends the Product entity defined in a foreign subgraph.",
    conceptsCovered: ["GraphQL Federation", "Apollo Server", "Subgraphs", "Entity Resolution", "Key Directives"],
    code: `import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { buildSubgraphSchema } from "@apollo/subgraph";
import gql from "graphql-tag";

// Mock reviews database
const reviewsDb = [
  { id: "rev-1", productId: "prod-101", rating: 5, comment: "Exceptional quality!" },
  { id: "rev-2", productId: "prod-101", rating: 4, comment: "Fast shipping." },
  { id: "rev-3", productId: "prod-102", rating: 2, comment: "Arrived damaged." }
];

// Subgraph Schema extending foreign Product entity
const typeDefs = gql\`
  extend schema
    @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

  type Review {
    id: ID!
    rating: Int!
    comment: String!
  }

  # Federated Entity Extension
  type Product @key(fields: "id") {
    id: ID!
    reviews: [Review!]!
  }
\`;

const resolvers = {
  Product: {
    // __resolveReference handles entity federation lookup requested by Gateway Router
    __resolveReference: (reference: { id: string }) => {
      const productReviews = reviewsDb.filter(r => r.productId === reference.id);
      return { id: reference.id, reviews: productReviews };
    }
  }
};

const server = new ApolloServer({
  schema: buildSubgraphSchema({ typeDefs, resolvers })
});

const { url } = await startStandaloneServer(server, { listen: { port: 4002 } });
console.log(\`Review Federated Subgraph ready at \${url}\`);`,
    breakdown: [
      "Defines a federated schema declaring the @key directive on Product.",
      "Implements the __resolveReference hook required by the Apollo Federation Gateway router.",
      "Allows the Review team to own review data while seamlessly enriching Product queries without coupling.",
      "Operates as an autonomous subgraph deployable on its own CI/CD cycle."
    ],
    expectedOutput: "Review Subgraph running on port 4002, resolving Product.reviews across the federated supergraph."
  },

  {
    id: "ms-ex-08",
    title: "Contract Testing with Pact v3 (Consumer Specification)",
    category: "Deployment & Testing",
    difficulty: "intermediate",
    whatThisCodeCovers: "A Pact v3 consumer contract test verifying that an Order Client correctly asserts the contract expected from the Payment microservice.",
    conceptsCovered: ["Pact v3", "Consumer-Driven Contract", "Mock Server", "Matchers", "can-i-deploy"],
    code: `import { PactV3, MatchersV3 } from "@pact-foundation/pact";
import path from "node:path";
const { string, integer } = MatchersV3;

const provider = new PactV3({
  consumer: "OrderService",
  provider: "PaymentService",
  dir: path.resolve(process.cwd(), "pacts")
});

describe("OrderService -> PaymentService Pact Contract", () => {
  it("authorizes a valid payment transaction", async () => {
    provider
      .given("account has sufficient credit")
      .uponReceiving("a request to authorize a credit charge")
      .withRequest({
        method: "POST",
        path: "/v1/charges",
        headers: { "Content-Type": "application/json" },
        body: {
          accountId: string("acc_88192"),
          amountCents: integer(4500),
          currency: string("USD")
        }
      })
      .willRespondWith({
        status: 201,
        headers: { "Content-Type": "application/json" },
        body: {
          chargeId: string("ch_live_9921"),
          status: string("AUTHORIZED")
        }
      });

    await provider.executeTest(async (mockserver) => {
      // Execute consumer client against local Pact mockserver URL
      const client = new PaymentHttpClient(mockserver.url);
      const res = await client.authorize("acc_88192", 4500, "USD");

      expect(res.chargeId).toBe("ch_live_9921");
      expect(res.status).toBe("AUTHORIZED");
    });
  });
});

class PaymentHttpClient {
  constructor(private baseUrl: string) {}
  async authorize(accountId: string, amountCents: number, currency: string) {
    const res = await fetch(\`\${this.baseUrl}/v1/charges\`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId, amountCents, currency })
    });
    return res.json();
  }
}`,
    breakdown: [
      "Sets up PactV3 provider and consumer relationship.",
      "Defines exact request headers, bodies, and response matchers using flexible type matchers.",
      "Generates a verified pact JSON file written to /pacts for verification in provider CI.",
      "Verifies the HTTP client integration without running the live Payment microservice."
    ],
    expectedOutput: "Pact test passes; generates pacts/OrderService-PaymentService.json for provider validation."
  },

  {
    id: "ms-ex-09",
    title: "Shared Database Antipattern Refactoring via Microservice API",
    category: "Decomposition & DDD",
    difficulty: "advanced",
    whatThisCodeCovers: "Refactoring two microservices sharing a monolithic database schema into isolated databases using an asynchronous event-driven replication bridge.",
    conceptsCovered: ["Shared Database Antipattern", "Database-per-Service", "Event Bridge", "Decoupling", "PostgreSQL"],
    code: `// BEFORE: Order Service executed raw SQL join on Inventory Service's table:
// SELECT o.*, i.stock FROM orders o JOIN inventory i ON o.item_id = i.id; (COUPLED!)

// AFTER: Dedicated Databases + Async Replicated Local Projection
import { Pool } from "pg";

// 1. Order Service's Private Database Pool
const orderDb = new Pool({ connectionString: process.env.ORDER_DB_URL });

// 2. Order Service maintains a local read-only projection table for inventory snapshots
export class OrderServiceWithLocalProjection {
  async createOrder(orderId: string, itemId: string, quantity: number) {
    const client = await orderDb.connect();
    try {
      await client.query("BEGIN");

      // Verify stock using LOCAL read projection table (no remote join needed!)
      const stockRes = await client.query(
        "SELECT available_units FROM local_inventory_cache WHERE item_id = $1",
        [itemId]
      );

      if (stockRes.rows.length === 0 || stockRes.rows[0].available_units < quantity) {
        throw new Error("Insufficient stock in local projection");
      }

      await client.query(
        "INSERT INTO orders (id, item_id, quantity, status) VALUES ($1, $2, $3, 'CONFIRMED')",
        [orderId, itemId, quantity]
      );

      await client.query("COMMIT");
    } finally {
      client.release();
    }
  }

  // 3. Kafka Consumer continuously updates the local projection table asynchronously
  async handleInventoryStockUpdatedEvent(event: { itemId: string; newStock: number }) {
    await orderDb.query(
      \`INSERT INTO local_inventory_cache (item_id, available_units, updated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (item_id) DO UPDATE SET available_units = $2, updated_at = NOW()\`,
      [event.itemId, event.newStock]
    );
  }
}`,
    breakdown: [
      "Eliminates cross-service SQL joins and shared database connection coupling.",
      "Maintains a local denormalized projection table inside Order Service's private database.",
      "Subscribes to asynchronous inventory stock events to keep the local projection synchronized.",
      "Enables Order Service to survive an outage of Inventory Service without failing reads."
    ],
    expectedOutput: "Order Service operates against its private DB with zero reliance on foreign database tables."
  },

  {
    id: "ms-ex-10",
    title: "Domain Event Definition & Schema Versioning",
    category: "Event-Driven Systems",
    difficulty: "intermediate",
    whatThisCodeCovers: "A typed Domain Event envelope pattern implementing CloudEvents specification, semantic versioning, and strict schema validation with Zod.",
    conceptsCovered: ["CloudEvents", "Domain Events", "Schema Evolution", "Zod", "Envelope Pattern"],
    code: `import { z } from "zod";
import crypto from "node:crypto";

// CloudEvents v1.0 Compliant Envelope Schema
export const CloudEventEnvelopeSchema = z.object({
  specversion: z.literal("1.0"),
  id: z.string().uuid(),
  source: z.string(), // e.g. "/services/order-service"
  type: z.string(),   // e.g. "com.enterprise.order.created.v2"
  time: z.string().datetime(),
  datacontenttype: z.literal("application/json"),
  data: z.record(z.any())
});

// Domain Event Payload (Version 2)
export const OrderCreatedV2PayloadSchema = z.object({
  orderId: z.string(),
  customerId: z.string(),
  totalCents: z.number().int().positive(),
  currency: z.string().length(3),
  items: z.array(z.object({
    sku: z.string(),
    quantity: z.number().int().positive()
  }))
});

export class DomainEventFactory {
  static createOrderCreatedEvent(payload: z.infer<typeof OrderCreatedV2PayloadSchema>) {
    // Validate payload against schema before publishing
    const validatedData = OrderCreatedV2PayloadSchema.parse(payload);

    return {
      specversion: "1.0" as const,
      id: crypto.randomUUID(),
      source: "/services/order-service",
      type: "com.enterprise.order.created.v2",
      time: new Date().toISOString(),
      datacontenttype: "application/json" as const,
      data: validatedData
    };
  }
}

// Emitting event
const event = DomainEventFactory.createOrderCreatedEvent({
  orderId: "ord-9821",
  customerId: "cust-4412",
  totalCents: 1999,
  currency: "USD",
  items: [{ sku: "ITEM-A", quantity: 2 }]
});

console.log("Published CloudEvent:", JSON.stringify(event, null, 2));`,
    breakdown: [
      "Complies with the industry-standard CNCF CloudEvents 1.0 envelope format.",
      "Embeds schema version directly in the event type identifier (v2).",
      "Validates payloads at creation time with Zod to prevent publishing corrupted event data.",
      "Provides universal metadata (id, source, time) for distributed tracing and deduplication."
    ],
    expectedOutput: "Valid CloudEvent JSON ready for Kafka/RabbitMQ publishing with standard metadata."
  }
];

module.exports = { recipes };
