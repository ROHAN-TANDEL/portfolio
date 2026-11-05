const { card } = require("../ms_builder_helper.cjs");

const cards = [
  card(
    49,
    "API Gateway Pattern: Responsibilities & Boundaries",
    "Architecture",
    "Mastery",
    "An API Gateway acts as the single entry point for all external client traffic into a microservices ecosystem. It encapsulates system architecture, offloading cross-cutting concerns (authentication, rate limiting, TLS termination, telemetry, protocol translation) from internal business microservices.",
    `// API Gateway architectural responsibility matrix:
// 1. Ingress Routing & Reverse Proxy: Map public URIs to internal cluster services (e.g. /v1/orders -> order-service.prod:8080)
// 2. Security & Token Verification: Edge validation of OAuth2 Bearer JWTs, TLS 1.3 termination, WAF inspection.
// 3. Traffic Shaping: Rate limiting (Token Bucket/Leaky Bucket), IP throttling, load shedding during peak spikes.
// 4. Protocol Translation: Translate HTTP/1.1 JSON from web/mobile clients into internal high-throughput gRPC (HTTP/2 with Protobuf).
// 5. Cross-Cutting Observability: Inject W3C Trace Context (traceparent), log access events with latency percentiles.

// Express / Fastify Edge Gateway Middleware demonstration:
import Fastify from "fastify";
import proxy from "@fastify/http-proxy";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";

const gateway = Fastify({ logger: true });

// 1. Rate Limiting offloaded at perimeter
await gateway.register(rateLimit, {
  max: 1000,
  timeWindow: "1 minute",
  redis: new Redis(process.env.REDIS_URL),
  keyGenerator: (req) => req.headers["x-client-id"] || req.ip
});

// 2. JWT Verification at Edge
await gateway.register(jwt, { secret: process.env.JWT_PUBLIC_KEY });
gateway.addHook("preHandler", async (req, reply) => {
  if (req.routerPath.startsWith("/public")) return;
  try {
    await req.jwtVerify();
    // Inject sanitized internal user identity header for downstream microservices
    req.headers["x-user-id"] = req.user.sub;
    req.headers["x-user-roles"] = req.user.roles.join(",");
  } catch (err) {
    return reply.status(401).send({ error: "Unauthorized Gateway Ingress" });
  }
});

// 3. Upstream Routing proxy to order service
await gateway.register(proxy, {
  upstream: "http://order-service.internal:4000",
  prefix: "/v1/orders",
  rewritePrefix: "/orders",
  http2: false
});

await gateway.listen({ port: 8080, host: "0.0.0.0" });`,
    ["API Gateway", "Reverse Proxy", "Edge Security", "Protocol Translation", "Traffic Management"],
    [
      { title: "Gateway Offloading Pattern", url: "https://microservices.io/patterns/apigateway.html" },
      { title: "Envoy & Kong Edge Gateways", url: "https://www.envoyproxy.io/docs" }
    ],
    "Why should API Gateways avoid hosting domain business logic?",
    "Embedding business domain rules inside an API Gateway turns the gateway into a tightly-coupled 'Smart Gateway' anti-pattern, recreating a monolithic choke point where multiple cross-functional teams must synchronize releases. Gateways must remain dumb pipes with smart endpoints—handling strictly infrastructure and routing concerns.",
    "A team wants to validate checkout discounts directly inside Kong/Envoy Lua plugins to save an internal hop. What operational hazard does this create?",
    "It splits domain validation across the gateway plugin and checkout-service. Changes to discount schemes require updating and deploying gateway plugins (often managed by Platform/Infra teams), breaking service encapsulation, hindering local testing, and creating high blast-radius deployment risks for all gateway traffic."
  ),

  card(
    50,
    "Backend for Frontend (BFF) Pattern",
    "Architecture",
    "Mastery",
    "The Backend for Frontend (BFF) pattern assigns dedicated edge services tailored specifically to the user experience and network constraints of distinct client types (e.g., Mobile iOS/Android, Single Page Web Apps, Smart TVs, Third-Party Partner APIs).",
    `// BFF Architecture:
// [Desktop Browser] ----> [Web BFF (Node.js/Next.js)] -----> [Catalog Service]
//                                                       -----> [Checkout Service]
// [Mobile App (5G/LTE)] -> [Mobile BFF (Go/Node.js)]     -----> [User Profile Service]
//                                (Aggregates & Minifies)

// Mobile BFF Aggregator Implementation:
// Mobile devices demand single-roundtrip responses with compact payload footprints to conserve battery & bandwidth.
export async function getMobileHomeScreen(userId: string) {
  // Concurrent parallel calls to downstream microservices with strict timeouts
  const [profileResult, ordersResult, recommendationsResult] = await Promise.allSettled([
    userClient.getUser({ id: userId }),
    orderClient.getRecentOrders({ userId, limit: 3 }),
    recommendationClient.getPersonalized({ userId, limit: 5 })
  ]);

  return {
    user: profileResult.status === "fulfilled" 
      ? { name: profileResult.value.displayName, avatar: profileResult.value.thumbnailUrl } 
      : { name: "Valued Customer", avatar: null },
    // Truncate fields unnecessary for mobile cards
    recentOrders: ordersResult.status === "fulfilled"
      ? ordersResult.value.orders.map(o => ({ id: o.id, total: o.formattedTotal, status: o.status }))
      : [],
    recommendedItems: recommendationsResult.status === "fulfilled"
      ? recommendationsResult.value.items.map(i => ({ id: i.id, title: i.title, img: i.smallImage }))
      : []
  };
}`,
    ["BFF", "Client Tailoring", "Payload Pruning", "Mobile Optimization", "Over-fetching"],
    [
      { title: "Sam Newman: Pattern: Backends For Frontends", url: "https://samnewman.io/patterns/architectural/bff/" }
    ],
    "What core problem does the BFF pattern resolve that a single universal API Gateway fails to address?",
    "A universal API Gateway attempts to serve all client types with one generic API, leading to conflicting requirements: mobile apps suffer from over-fetching bandwidth bloat and chatty roundtrips, while web clients require extensive relational data. BFF allows frontend teams to own their respective gateway layers and iterate without impacting other platforms.",
    "Who should own and maintain a BFF codebase in an organization?",
    "The frontend client engineering team responsible for that specific UI experience (e.g., the iOS/Android team owns the Mobile BFF). This eliminates inter-team coordination friction because the frontend team controls both UI and backend contract consumption."
  ),

  card(
    51,
    "API Gateway Aggregation & Scatter-Gather",
    "Networking",
    "Deep Dive",
    "API Aggregation allows an edge gateway or BFF to decompose a single client request into multiple concurrent downstream microservice queries, scatter them across internal networks, and gather/compose the results into a unified client response.",
    `// Scatter-Gather Aggregation with Resilience & Partial Degradation
export class OrderSummaryAggregator {
  constructor(
    private readonly orderClient: OrderServiceClient,
    private readonly paymentClient: PaymentServiceClient,
    private readonly shippingClient: ShippingServiceClient
  ) {}

  async getOrderSummary(orderId: string, traceContext: TraceContext) {
    const timeoutMs = 400; // Hard budget for edge SLA

    // Scatter phase: trigger asynchronous RPCs simultaneously
    const orderPromise = this.orderClient.fetchOrder(orderId, { deadline: timeoutMs });
    const paymentPromise = this.paymentClient.fetchPayment(orderId, { deadline: timeoutMs });
    const trackingPromise = this.shippingClient.fetchTracking(orderId, { deadline: timeoutMs });

    // Gather phase: Promise.allSettled guarantees resilience against partial outage
    const [orderRes, paymentRes, trackingRes] = await Promise.allSettled([
      orderPromise,
      paymentPromise,
      trackingPromise
    ]);

    if (orderRes.status === "rejected") {
      // Order data is critical: fail fast if core domain fails
      throw new GatewayError(502, "Order service unavailable", orderRes.reason);
    }

    // Compose response with graceful degradation for non-critical enrichment
    return {
      order: orderRes.value,
      paymentStatus: paymentRes.status === "fulfilled" ? paymentRes.value.status : "PENDING_VERIFICATION",
      tracking: trackingRes.status === "fulfilled" ? trackingRes.value : { status: "CARRIER_DATA_UNAVAILABLE" },
      degraded: paymentRes.status === "rejected" || trackingRes.status === "rejected"
    };
  }
}`,
    ["Scatter-Gather", "API Aggregation", "Partial Failure", "Graceful Degradation", "Concurrency"],
    [
      { title: "Microservices Aggregation Pattern", url: "https://microservices.io/patterns/data/api-composition.html" }
    ],
    "How does the Scatter-Gather pattern handle a slow downstream microservice without violating overall edge SLAs?",
    "By enforcing strict bounded deadlines/timeouts per scattered request using `Promise.race` or gRPC Deadlines, and implementing partial degradation. If a non-essential service (like recommendation or shipping estimation) exceeds its 200ms budget, the gateway gathers fulfilled promises, substitutes fallback stubs, and returns the response with a degraded flag.",
    "What is the consequence of cascading synchronous scatter-gather queries across 10+ services?",
    "Tail latency amplification. If each service has a p99 latency of 150ms, a request querying 10 services in parallel will have an edge p99 latency significantly worse than 150ms (probability that at least one service encounters high tail latency is 1 - (0.99^10) ≈ 9.6%)."
  ),

  card(
    52,
    "GraphQL Federation as a Distributed API Gateway",
    "Architecture",
    "Deep Dive",
    "GraphQL Federation (e.g., Apollo Federation) unifies multiple autonomous subgraph microservices into a single, composable federated supergraph schema. Gateway routers resolve queries across subgraphs declaratively without manual code-based scatter-gather stitching.",
    `// Apollo Federation v2 Subgraph Declarations:

// 1. Product Subgraph (Product Service)
// schema.graphql
/*
extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key"])

type Product @key(fields: "id") {
  id: ID!
  name: String!
  priceInCents: Int!
}
*/

// 2. Review Subgraph (Review Service extends Product entity)
/*
extend schema @link(url: "https://specs.apollo.dev/federation/v2.0", import: ["@key", "@external"])

type Review {
  id: ID!
  rating: Int!
  comment: String!
}

extend type Product @key(fields: "id") {
  id: ID! @external
  reviews: [Review!]!
}
*/

// Resolving Federated Entities in Review Subgraph (Node.js Apollo Server):
const resolvers = {
  Product: {
    __resolveReference: async (productKey, { dataSources }) => {
      // Subgraph resolves its own extended slice of Product using key id
      const reviews = await dataSources.reviewsDb.findByProductId(productKey.id);
      return { reviews };
    }
  }
};
// Gateway (Apollo Router written in Rust) compiles query execution plans:
// 1. Fetch Product { id, name } from Product Subgraph
// 2. Fetch Review slice using { id } from Review Subgraph concurrently
// 3. Assemble unified response tree.`,
    ["GraphQL Federation", "Apollo Router", "Supergraph", "Subgraphs", "Declarative Composition"],
    [
      { title: "Apollo Federation v2 Documentation", url: "https://www.apollographql.com/docs/federation/" }
    ],
    "How does GraphQL Federation preserve bounded context ownership across microservices teams?",
    "Each domain team owns and deploys their own subgraph schema and service independently. Entities are extended across subgraphs using directives like `@key` and `@external`. Teams do not edit a central monolith repository; the federation gateway dynamically composes subgraphs into a supergraph via schema registries.",
    "What is the 'N+1 Subgraph Query Problem' in federated gateways and how is it mitigated?",
    "When a gateway resolves a parent list (e.g. 100 Products) and queries a downstream subgraph (e.g. Reviews) for each item individually, generating 100 downstream network calls. It is mitigated by batching entity representations in Apollo Federation using `_entities` batch queries and DataLoader patterns.",
    "medium"
  ),

  card(
    53,
    "Edge Rate Limiting & Distributed Throttling",
    "Networking",
    "Mastery",
    "Edge rate limiting protects microservices from malicious denial-of-service, abusive clients, and sudden traffic spikes. Distributed implementations use Redis memory stores running Token Bucket or Sliding Window Log algorithms across clustered gateway nodes.",
    `// Sliding Window Counter Rate Limiting in Redis Lua script (atomic execution):
// Keys: [rate_limit_key], ARGV: [now_timestamp_ms, window_size_ms, max_limit]
const slidingWindowLua = \`
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  local clearBefore = now - window

  -- Remove timestamps older than the active window
  redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)

  -- Count elements in current window
  local currentRequests = redis.call('ZCARD', key)

  if currentRequests < limit then
    -- Add unique request entry (using timestamp + microsecond seed)
    redis.call('ZADD', key, now, now .. '-' .. redis.call('INCR', key .. ':seq'))
    redis.call('PEXPIRE', key, window)
    return { 1, limit - currentRequests - 1 } -- Allowed, Remaining
  else
    return { 0, 0 } -- Denied, Remaining
  end
\`;

// Express Gateway Middleware using Redis cluster:
export async function rateLimitMiddleware(req, res, next) {
  const clientId = req.headers["x-api-key"] || req.ip;
  const key = \`ratelimit:\${clientId}\`;
  const now = Date.now();
  const windowMs = 60000; // 1 minute
  const maxRequests = 120; // 120 req/min

  const [allowed, remaining] = await redis.eval(
    slidingWindowLua, 1, key, now, windowMs, maxRequests
  );

  res.setHeader("X-RateLimit-Limit", maxRequests);
  res.setHeader("X-RateLimit-Remaining", remaining);

  if (allowed === 1) {
    return next();
  }

  res.setHeader("Retry-After", Math.ceil(windowMs / 1000));
  return res.status(429).json({
    error: "Too Many Requests",
    message: "Rate limit exceeded. Please backoff."
  });
}`,
    ["Rate Limiting", "Sliding Window", "Redis Lua", "DDoS Mitigation", "Token Bucket"],
    [
      { title: "Stripe Rate Limiting Architecture", url: "https://stripe.com/blog/rate-limiters" }
    ],
    "Why is a Sliding Window Counter preferred over a Fixed Window Counter for rate limiting?",
    "Fixed windows suffer from boundary bursting: a client can send 100% of their quota in the last second of Minute 1 and another 100% in the first second of Minute 2, resulting in 2x the allowed limit hitting microservices within a 2-second interval. Sliding window smoothly measures traffic across rolling timeframes.",
    "In high-scale multi-region setups, why is synchronous Redis rate-limiting problematic, and what is the alternative?",
    "Cross-region Redis calls introduce 50–100ms latency to every incoming edge request. The alternative is local in-memory token buckets at each gateway node with periodic asynchronous synchronization (e.g., token refills broadcast via local Redis clusters or Envoy Global Rate Limiting Service with local caching)."
  ),

  card(
    54,
    "Edge Caching & Cache-Control Invalidation",
    "Performance",
    "Mastery",
    "Edge caching stores microservice responses at the API Gateway or CDN reverse proxy tier (Cloudflare, Fastly, Varnish, Nginx). By inspecting HTTP cache headers, the gateway serves repeated read queries directly from RAM without dispatching requests downstream.",
    `// Gateway Cache-Control & Surrogate-Key Invalidation Flow:
import Fastify from "fastify";
import redis from "./redisClient.js";

const server = Fastify();

// Gateway edge caching hook
server.addHook("onSend", async (request, reply, payload) => {
  if (request.method !== "GET" || reply.statusCode !== 200) return;

  const cacheControl = reply.getHeader("cache-control") as string;
  if (cacheControl && cacheControl.includes("s-maxage")) {
    const maxAgeMatch = cacheControl.match(/s-maxage=(\\d+)/);
    const ttlSeconds = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : 60;
    
    // Check for Surrogate-Key (Cache Tags) emitted by downstream microservices
    const cacheTags = reply.getHeader("surrogate-key") as string; // e.g. "product:459 store:12"
    
    const cacheKey = \`edge_cache:\${request.url}\`;
    await redis.setex(cacheKey, ttlSeconds, payload);

    if (cacheTags) {
      for (const tag of cacheTags.split(" ")) {
        await redis.sadd(\`cache_tag:\${tag}\`, cacheKey);
      }
    }
  }
});

// Purge handler triggered via Event-Driven Webhook / Message Broker on ProductUpdated
export async function invalidateCacheByTag(tag: string) {
  const matchingKeys = await redis.smembers(\`cache_tag:\${tag}\`);
  if (matchingKeys.length > 0) {
    await redis.del(...matchingKeys);
    await redis.del(\`cache_tag:\${tag}\`);
    console.log(\`[EdgeCache] Purged \${matchingKeys.length} cache keys for tag: \${tag}\`);
  }
}`,
    ["Edge Caching", "Surrogate-Key", "Cache Invalidation", "Stale-While-Revalidate", "CDN"],
    [
      { title: "RFC 9111 HTTP Caching", url: "https://www.rfc-editor.org/rfc/rfc9111" }
    ],
    "What is the function of the `stale-while-revalidate` HTTP Cache-Control directive at the gateway level?",
    "It instructs the gateway to instantly return a stale cached response to the client while simultaneously triggering a non-blocking background fetch to the upstream microservice to refresh the cache. This completely shields end users from downstream latency spikes.",
    "What is the danger of caching authenticated user responses at an edge gateway, and how is it prevented?",
    "Private personal user data (PII, order history) might be cached under a shared URL and served to other users. Prevention requires emitting `Cache-Control: private` or `no-store` on user-scoped endpoints, and enforcing `Vary: Authorization, Cookie` headers at the gateway.",
    "hard"
  ),

  card(
    55,
    "TLS 1.3 Termination & mTLS Upstream Forwarding",
    "Security",
    "Deep Dive",
    "The API Gateway serves as the perimeter security boundary, terminating public TLS 1.3 connections from clients, inspecting payload traffic, and re-encrypting or forwarding connections internally over mutual TLS (mTLS) to interior service mesh proxies.",
    `// Nginx / OpenResty Gateway TLS Termination & Upstream mTLS configuration snippet:
/*
server {
    listen 443 ssl http2;
    server_name api.enterprise.com;

    # Public Edge TLS Termination
    ssl_certificate /etc/ssl/certs/public_api_chain.crt;
    ssl_certificate_key /etc/ssl/private/public_api.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;

    location /v1/payments {
        proxy_pass https://payment-service.mesh.internal:8443;
        
        # Upstream Internal mTLS (Gateway identifies itself to microservice)
        proxy_ssl_certificate /etc/internal-pki/gateway-client.crt;
        proxy_ssl_certificate_key /etc/internal-pki/gateway-client.key;
        proxy_ssl_trusted_certificate /etc/internal-pki/ca.crt;
        proxy_ssl_verify on;
        proxy_ssl_verify_depth 2;

        # Forwarding perimeter client metadata
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
        proxy_set_header X-Client-Cert-SHA256 $ssl_client_fingerprint;
    }
}
*/

// Node.js HTTPS Agent with internal mTLS client certificates:
import https from "node:https";
import fs from "node:fs";

export const internalMtlsAgent = new https.Agent({
  cert: fs.readFileSync("/etc/internal-pki/gateway-client.crt"),
  key: fs.readFileSync("/etc/internal-pki/gateway-client.key"),
  ca: fs.readFileSync("/etc/internal-pki/ca.crt"),
  rejectUnauthorized: true,
  keepAlive: true,
  maxSockets: 100
});`,
    ["TLS Termination", "mTLS", "PKI", "Zero-Trust", "Reverse Proxy"],
    [
      { title: "Nginx Reverse Proxy TLS Termination", url: "https://docs.nginx.com/nginx/admin-guide/security-controls/terminating-ssl-http/" }
    ],
    "Why do modern cloud architectures terminate TLS at the API Gateway rather than passing raw TCP directly to microservices?",
    "Terminating TLS at the perimeter centralizes certificate lifecycle management (ACME/Let's Encrypt renewal), offloads CPU-intensive cryptographic handshakes from application runtimes, and enables edge inspection for WAF rule enforcement, rate limiting, and request transformation.",
    "Why is continuing plain HTTP inside the internal VPC after gateway termination considered an architectural anti-pattern?",
    "It violates Zero-Trust security principles. If an attacker breaches the perimeter or compromises a single sidecar/container in the VPC, unencrypted plaintext network traffic can be sniffed or spoofed across the shared internal software-defined network."
  ),

  card(
    56,
    "Dynamic Ingress Routing & Path Rewriting",
    "Networking",
    "Core",
    "Dynamic ingress routing decouples public URL structures from internal microservice naming conventions. The gateway strips prefixes, dynamically discovers upstream pods via DNS/K8s services, and transforms paths without client modification.",
    `// Traefik Dynamic Ingress Route with Middleware Path Rewriting (Kubernetes CRD):
/*
apiVersion: traefik.io/v1alpha1
kind: Middleware
metadata:
  name: strip-order-prefix
  namespace: production
spec:
  stripPrefix:
    prefixes:
      - /v1/orders
      - /api/orders
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: orders-ingress
  namespace: production
spec:
  entryPoints:
    - websecure
  routes:
    - match: Host(\`api.platform.com\`) && PathPrefix(\`/v1/orders\`)
      kind: Rule
      services:
        - name: order-microservice
          port: 8080
      middlewares:
        - name: strip-order-prefix
        - name: jwt-auth-middleware
*/

// In-code Path Rewrite Proxy rule (Node.js / Express Gateway):
import { createProxyMiddleware } from "http-proxy-middleware";

export const orderProxy = createProxyMiddleware({
  target: "http://order-service.production.svc.cluster.local:8080",
  changeOrigin: true,
  pathRewrite: {
    "^/v1/orders": "/orders", // rewrite /v1/orders/123 to /orders/123
    "^/api/orders": "/orders"
  },
  onProxyReq: (proxyReq, req) => {
    // Inject immutable gateway tracing timestamp
    proxyReq.setHeader("x-gateway-ingress-time", Date.now().toString());
  }
});`,
    ["Ingress", "Path Rewriting", "Reverse Proxy", "Kubernetes", "Traefik"],
    [
      { title: "Kubernetes Ingress Controllers", url: "https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/" }
    ],
    "What problem does path prefix stripping at the gateway solve for microservices?",
    "It shields microservices from API versioning path changes and routing renames. A service can implement clean endpoints like `/orders` and `/items` internally, while the gateway handles routing public endpoints like `/v1/orders` or `/enterprise/v2/orders` without requiring microservice code changes.",
    "What risk arises when upstream path rewriting is misconfigured with unescaped regex patterns?",
    "Path Traversal and Route Confusion vulnerabilities. If regex matching does not anchor boundaries (e.g. missing `^`), an attacker could craft requests like `/v1/orders/../../admin/delete` and bypass authorization gates."
  ),

  card(
    57,
    "Protocol Translation: HTTP/JSON to Internal gRPC",
    "Networking",
    "Deep Dive",
    "To maximize edge developer convenience while sustaining extreme internal performance, the API Gateway trans助translates incoming external HTTP/REST JSON payloads into binary Protobuf over gRPC HTTP/2 for internal microservices.",
    `// gRPC-Gateway & Envoy gRPC-JSON Transcoder pattern:
// Protobuf definition annotated with Google API HTTP Transcoding:
/*
syntax = "proto3";
package inventory.v1;

import "google/api/annotations.proto";

service InventoryService {
  rpc GetStockItem (StockRequest) returns (StockResponse) {
    option (google.api.http) = {
      get: "/v1/inventory/{item_id}"
    };
  }
}

message StockRequest {
  string item_id = 1;
}

message StockResponse {
  string item_id = 1;
  int32 available_quantity = 2;
  double price = 3;
}
*/

// Envoy Gateway Filter configuration for gRPC-JSON Transcoder:
/*
- name: envoy.filters.http.grpc_json_transcoder
  typed_config:
    "@type": type.googleapis.com/envoy.extensions.filters.http.grpc_json_transcoder.v3.GrpcJsonTranscoder
    proto_descriptor: "/etc/envoy/proto.pb"
    services: ["inventory.v1.InventoryService"]
    print_options:
      add_whitespace: false
      always_print_primitive_fields: true
*/

// Fastify Custom Gateway Transcoder Handler:
import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

const packageDef = protoLoader.loadSync("./proto/inventory.proto");
const proto = grpc.loadPackageDefinition(packageDef) as any;
const client = new proto.inventory.v1.InventoryService(
  "inventory-service:50051",
  grpc.credentials.createInsecure()
);

export async function httpToGrpcHandler(req, reply) {
  const { item_id } = req.params;
  
  return new Promise((resolve, reject) => {
    client.GetStockItem({ item_id }, (err, response) => {
      if (err) {
        // Map gRPC status codes to standard HTTP status codes
        const httpStatus = err.code === grpc.status.NOT_FOUND ? 404 : 500;
        return reply.status(httpStatus).send({ error: err.message, code: err.code });
      }
      return reply.send(response);
    });
  });
}`,
    ["Protocol Translation", "gRPC Transcoding", "Protobuf", "Envoy Filter", "HTTP/2"],
    [
      { title: "Envoy gRPC-JSON Transcoder", url: "https://www.envoyproxy.io/docs/envoy/latest/configuration/http/http_filters/grpc_json_transcoder_filter" }
    ],
    "Why not expose gRPC directly to public web browser clients instead of transcoding at the gateway?",
    "Browser support for HTTP/2 trailing headers and raw binary frames is restricted; standard `fetch` cannot initiate true bi-directional gRPC without specialized wrappers like gRPC-Web (which requires Envoy translation anyway). Furthermore, third-party developers expect standard OpenAPI/JSON REST contracts.",
    "What mapping challenge occurs when translating gRPC error statuses to HTTP error responses?",
    "gRPC has 16 standardized status codes (e.g. `ALREADY_EXISTS`, `FAILED_PRECONDITION`, `DEADLINE_EXCEEDED`), whereas HTTP uses 3-digit status codes. The gateway must deterministically map `NOT_FOUND` to 404, `ALREADY_EXISTS` to 409 Conflict, `INVALID_ARGUMENT` to 400, and `DEADLINE_EXCEEDED` to 504 Gateway Timeout."
  ),

  card(
    58,
    "API Gateway High Availability & Blast Radius Containment",
    "Reliability",
    "Deep Dive",
    "Because the API Gateway sits on the critical path of every ingress request, a gateway crash causes total system outage. High Availability (HA) requires multi-AZ active-active deployments, stateless scaling, DNS load balancing, and failure domains.",
    `// HA Gateway Deployment Architecture:
// 1. DNS Layer: AWS Route53 Latency-based Routing with Health Checks
// 2. L4 Load Balancing: AWS NLB / Google Cloud Passthrough LB distributing to Multi-AZ
// 3. Gateway Nodes: Horizontal Pod Autoscaler (HPA) targeting 60% CPU utilization
// 4. Blast Radius Isolation: Segregating Gateways by Domain (e.g., Ingress-Checkout vs Ingress-Browsing)

// Kubernetes Gateway Deployment with Topology Spread Constraints (Multi-AZ HA):
/*
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway-core
  namespace: ingress-system
spec:
  replicas: 6
  selector:
    matchLabels:
      app: api-gateway
  template:
    metadata:
      labels:
        app: api-gateway
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: "topology.kubernetes.io/zone"
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: api-gateway
      containers:
        - name: gateway
          image: kong:3.4-alpine
          resources:
            requests:
              cpu: "1000m"
              memory: "1Gi"
            limits:
              cpu: "2000m"
              memory: "2Gi"
          readinessProbe:
            httpGet:
              path: /status
              port: 8100
            initialDelaySeconds: 5
            periodSeconds: 3
*/`,
    ["High Availability", "Blast Radius", "Topology Spread", "Horizontal Scaling", "Active-Active"],
    [
      { title: "AWS Multi-AZ Deployment Guidance", url: "https://aws.amazon.com/architecture/wellarchitected/" }
    ],
    "Why is deploying a single colossal gateway for an entire enterprise an anti-pattern?",
    "It creates a massive single blast radius. A rogue configuration error, memory leak, or DDoS attack on an uncritical subsystem (e.g., promotional blogs) will crash the entire gateway, bringing down critical checkout and payment pipelines. Domain-partitioned gateways isolate this risk.",
    "What state must be prohibited inside API Gateway pods to guarantee frictionless horizontal autoscaling?",
    "All in-memory state: user sessions, sticky socket pools, in-memory rate-limiting counters, and local cache stores. All state must either reside in external distributed caches (Redis) or remain purely stateless (cryptographically signed JWTs)."
  ),

  card(
    59,
    "Request De-duplication & Idempotency at Gateway Edge",
    "Reliability",
    "Mastery",
    "Clients on unstable networks frequently retry mutating POST requests. Edge idempotency middleware intercepts repeated requests bearing identical `Idempotency-Key` headers, returning the cached previous response without dispatching duplicate operations downstream.",
    `// Gateway Idempotency Layer using Redis Mutex & Response Caching:
import { Request, Response, NextFunction } from "express";
import redis from "./redisClient.js";

export function gatewayIdempotencyMiddleware(ttlSeconds = 86400) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only enforce idempotency on mutating operations with an Idempotency-Key header
    if (!["POST", "PATCH", "PUT"].includes(req.method)) return next();
    const idempotencyKey = req.headers["idempotency-key"] as string;
    if (!idempotencyKey) return next();

    const clientNamespace = req.headers["x-client-id"] || req.ip;
    const redisKey = \`idempotency:\${clientNamespace}:\${idempotencyKey}\`;

    // Attempt to acquire atomic lock (SET NX PX)
    const acquired = await redis.set(redisKey, JSON.stringify({ state: "IN_FLIGHT" }), "EX", ttlSeconds, "NX");

    if (!acquired) {
      // Key already exists: inspect cached state
      const existing = await redis.get(redisKey);
      if (!existing) return next();

      const record = JSON.parse(existing);
      if (record.state === "IN_FLIGHT") {
        // Request is currently processing downstream: return 409 Conflict
        return res.status(409).json({
          error: "Conflict",
          message: "A request with this Idempotency-Key is currently processing."
        });
      }

      // Replay completed response directly from edge cache
      res.setHeader("X-Cache-Lookup", "HIT-IDEMPOTENT");
      return res.status(record.statusCode).set(record.headers).send(record.body);
    }

    // Capture response payload using res.send interceptor
    const originalSend = res.send.bind(res);
    res.send = (body: any) => {
      // Store completed response in Redis
      const payloadToCache = {
        state: "COMPLETED",
        statusCode: res.statusCode,
        headers: { "content-type": res.getHeader("content-type") },
        body: typeof body === "string" ? body : JSON.stringify(body)
      };
      redis.set(redisKey, JSON.stringify(payloadToCache), "EX", ttlSeconds);
      return originalSend(body);
    };

    next();
  };
}`,
    ["Idempotency", "Atomic Lock", "Retry Storms", "Deduplication", "Safe Retries"],
    [
      { title: "IETF Draft: The Idempotency-Key HTTP Header Field", url: "https://datatracker.ietf.org/doc/draft-ietf-httpapi-idempotency-key-header/" }
    ],
    "What should the gateway do if a client retries with the same `Idempotency-Key` while the first request is still processing?",
    "Return HTTP `409 Conflict` (or `425 Too Early`), signaling to the client that the original mutation is currently in-flight. The client must pause and poll or wait for the initial response rather than bombarding downstream services.",
    "What occurs if the downstream microservice crashes while processing an `IN_FLIGHT` request?",
    "The Redis key will remain locked until the TTL expires unless an error handler cleans it up. Resilient gateways register error hooks: if downstream returns 5xx or times out, the gateway deletes the `IN_FLIGHT` lock so the client can legitimately retry.",
    "hard"
  ),

  card(
    60,
    "API Gateway Anti-Patterns: Monolithic Hubs & God Plugins",
    "Architecture",
    "Deep Dive",
    "The most destructive anti-pattern in microservices gateways is the 'Smart Gateway / God Proxy'—accumulating heavy business transforms, orchestration workflows, legacy adapter scripts, and database access directly inside gateway runtime plugins.",
    `// ANTI-PATTERN: Heavy Business Logic inside Gateway Plugin (DON'T DO THIS)
/*
kong.service.request.set_header("x-step", "calculating_tax")
-- Calling database directly from Kong Gateway Lua plugin:
local pg = require("pgmoon").new({ host = "db.internal", user = "kong" })
pg:connect()
local tax_rate = pg:query("SELECT rate FROM tax_rates WHERE country = 'US'")
-- Modifying JSON payload with business algorithms:
local body = cjson.decode(kong.request.get_raw_body())
body.tax = body.amount * tax_rate[1].rate
kong.service.request.set_raw_body(cjson.encode(body))
*/

// CORRECT PATTERN: Thin Gateway, Rich Domain Services
// Gateway handles only Transport, Security & Routing:
// Gateway forwards raw request to dedicated Billing Microservice.
// Billing Microservice encapsulates tax calculation, database access, and schema isolation.

export class GatewayArchitecturePolicy {
  static readonly ALLOWED_GATEWAY_CONCERNS = [
    "TLS_TERMINATION",
    "AUTHENTICATION_TOKEN_VERIFICATION",
    "PERIMETER_RATE_LIMITING",
    "W3C_TRACE_PROPAGATION",
    "HEADER_SANITIZATION",
    "REVERSE_PROXY_ROUTING"
  ];

  static readonly FORBIDDEN_GATEWAY_CONCERNS = [
    "DIRECT_DATABASE_ACCESS",
    "DOMAIN_VALIDATION_RULES",
    "MULTI_STEP_ORCHESTRATION_SAGAS",
    "BUSINESS_DISCOUNT_CALCULATION",
    "DOMAIN_DATA_PERSISTENCE"
  ];
}`,
    ["Anti-Patterns", "Smart Gateway", "God Proxy", "Separation of Concerns", "Decoupling"],
    [
      { title: "Martin Fowler: Smart Endpoints, Dumb Pipes", url: "https://martinfowler.com/articles/microservices.html#SmartEndpointsAndDumbPipes" }
    ],
    "Why does allowing direct database access inside an API Gateway destroy microservices autonomy?",
    "It bypasses the domain microservice's API boundary, breaking data encapsulation. When the domain team changes its internal table schema, the gateway silently breaks. It also couples the gateway release lifecycle to database schema migrations across unrelated domains.",
    "How does a 'God Gateway' team become an organizational bottleneck?",
    "Every product feature release requires changes to gateway plugins. Feature teams cannot ship independently and must queue requests with the central Gateway/Platform team, recreating the exact organizational deployment bottlenecks microservices were adopted to eliminate."
  )
];

module.exports = { cards };
