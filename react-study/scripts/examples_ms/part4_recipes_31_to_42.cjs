const recipes = [
  {
    id: "ms-ex-31",
    title: "Fastify Edge API Gateway with JWT & Dynamic Proxying",
    category: "Ingress & Edge",
    difficulty: "intermediate",
    whatThisCodeCovers: "A high-performance edge API Gateway built with Fastify, verifying Bearer JWTs at ingress, stripping perimeter tokens, and forwarding requests to upstream microservices.",
    conceptsCovered: ["API Gateway", "Fastify", "JWT Verification", "Reverse Proxy", "Header Sanitization"],
    code: `import Fastify from "fastify";
import proxy from "@fastify/http-proxy";
import jwt from "@fastify/jwt";

const gateway = Fastify({ logger: true });

// 1. Register JWT verification plugin
await gateway.register(jwt, {
  secret: process.env.JWT_PUBLIC_KEY || "super-secret-public-key"
});

// 2. Global Pre-Handler Security Hook
gateway.addHook("preHandler", async (req, reply) => {
  // Allow public authentication and health routes
  if (req.url.startsWith("/public") || req.url === "/healthz") return;

  try {
    await req.jwtVerify();
    // Sanitization: Strip client-supplied user headers to prevent spoofing
    delete req.headers["x-user-id"];
    delete req.headers["x-user-role"];

    // Inject cryptographically verified identity claims for internal services
    req.headers["x-authenticated-user-id"] = (req.user as any).sub;
    req.headers["x-authenticated-user-role"] = (req.user as any).role;
  } catch (err) {
    return reply.status(401).send({ error: "Unauthorized Gateway Ingress" });
  }
});

// 3. Upstream Routing: Orders Microservice
await gateway.register(proxy, {
  upstream: "http://order-service.internal:8080",
  prefix: "/v1/orders",
  rewritePrefix: "/orders",
  http2: false
});

// 4. Upstream Routing: Catalog Microservice
await gateway.register(proxy, {
  upstream: "http://catalog-service.internal:8081",
  prefix: "/v1/catalog",
  rewritePrefix: "/catalog"
});

await gateway.listen({ port: 8080, host: "0.0.0.0" });`,
    breakdown: [
      "Verifies public JWTs at the network perimeter before traffic enters internal VPC.",
      "Strips untrusted user headers to defend against header injection spoofing.",
      "Injects verified internal identity headers for downstream microservices.",
      "Routes traffic dynamically to dedicated microservices with path prefix rewriting."
    ],
    expectedOutput: "Gateway listens on port 8080, verifies JWTs, and proxies requests to upstream services."
  },

  {
    id: "ms-ex-32",
    title: "Mobile vs Web Backend for Frontend (BFF) Aggregator",
    category: "Ingress & Edge",
    difficulty: "intermediate",
    whatThisCodeCovers: "A dedicated Mobile BFF aggregator that batches downstream calls, strips heavyweight payload metadata, and minifies responses for low-bandwidth mobile devices.",
    conceptsCovered: ["BFF", "Payload Pruning", "Mobile Optimization", "Scatter-Gather", "Over-Fetching"],
    code: `export class MobileBffAggregator {
  constructor(
    private readonly userClient: any,
    private readonly orderClient: any,
    private readonly catalogClient: any
  ) {}

  async getMobileHomeScreen(userId: string) {
    // Concurrent downstream calls with strict timeout
    const [userRes, ordersRes, recsRes] = await Promise.allSettled([
      this.userClient.getUser(userId),
      this.orderClient.getRecentOrders(userId, { limit: 2 }),
      this.catalogClient.getRecommendations(userId, { limit: 4 })
    ]);

    // PRUNING & MINIFICATION FOR MOBILE:
    // Strip unnecessary fields (e.g. detailed billing addresses, raw HTML descriptions)
    return {
      user: userRes.status === "fulfilled"
        ? { id: userRes.value.id, name: userRes.value.displayName, avatar: userRes.value.thumbUrl }
        : { id: userId, name: "Valued Customer", avatar: null },
      recentOrders: ordersRes.status === "fulfilled"
        ? ordersRes.value.map((o: any) => ({
            id: o.id,
            totalFormatted: \`$\${(o.totalCents / 100).toFixed(2)}\`,
            status: o.status
          }))
        : [],
      featuredItems: recsRes.status === "fulfilled"
        ? recsRes.value.map((i: any) => ({
            id: i.id,
            title: i.shortTitle,
            img: i.mobileThumbnailUrl,
            price: i.price
          }))
        : []
    };
  }
}`,
    breakdown: [
      "Executes parallel downstream queries with Promise.allSettled.",
      "Minifies response payload size by 75% compared to raw microservice outputs.",
      "Formats display fields on the backend to reduce mobile CPU rendering load.",
      "Provides graceful degradation if non-essential widgets fail."
    ],
    expectedOutput: "Returns compact, minified JSON tailored specifically for mobile UI render."
  },

  {
    id: "ms-ex-33",
    title: "Redis Atomic Sliding Window Rate Limiter",
    category: "Ingress & Edge",
    difficulty: "advanced",
    whatThisCodeCovers: "A sliding window rate limiter implemented in an atomic Redis Lua script, preventing boundary burst attacks across gateway nodes.",
    conceptsCovered: ["Rate Limiting", "Sliding Window", "Redis Lua", "Boundary Bursting", "HTTP 429"],
    code: `import Redis from "ioredis";
import { Request, Response, NextFunction } from "express";

const redis = new Redis(process.env.REDIS_URL || "redis://localhost:6379");

const slidingWindowLua = \`
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  local clearBefore = now - window

  -- Remove all timestamps older than window
  redis.call('ZREMRANGEBYSCORE', key, 0, clearBefore)
  local count = redis.call('ZCARD', key)

  if count < limit then
    redis.call('ZADD', key, now, now .. '-' .. redis.call('INCR', key .. ':seq'))
    redis.call('PEXPIRE', key, window)
    return { 1, limit - count - 1 }
  else
    return { 0, 0 }
  end
\`;

export function slidingWindowRateLimiter(maxRequests = 100, windowMs = 60000) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const identifier = req.headers["x-client-id"] || req.ip;
    const key = \`ratelimit:\${identifier}\`;
    const now = Date.now();

    const [allowed, remaining] = (await redis.eval(
      slidingWindowLua,
      1,
      key,
      now,
      windowMs,
      maxRequests
    )) as [number, number];

    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", remaining);

    if (allowed === 1) {
      return next();
    }

    res.setHeader("Retry-After", Math.ceil(windowMs / 1000));
    return res.status(429).json({
      error: "Too Many Requests",
      message: "Rate limit exceeded. Please back off."
    });
  };
}`,
    breakdown: [
      "Executes atomic evaluation inside a single Redis Lua script.",
      "Cleans up expired timestamps on every call using ZREMRANGEBYSCORE.",
      "Guarantees that traffic bursts across window boundaries are strictly bounded.",
      "Emits standard X-RateLimit headers and Retry-After on rejection."
    ],
    expectedOutput: "Allows up to 100 requests per minute smoothly; returns HTTP 429 when quota is reached."
  },

  {
    id: "ms-ex-34",
    title: "Edge Caching with Surrogate-Keys Invalidation",
    category: "Ingress & Edge",
    difficulty: "advanced",
    whatThisCodeCovers: "A gateway edge caching middleware that indexes responses by Surrogate-Key cache tags, enabling instant multi-key invalidation when domain updates occur.",
    conceptsCovered: ["Edge Caching", "Surrogate-Keys", "Cache Invalidation", "Stale-While-Revalidate", "Tag Purging"],
    code: `import Redis from "ioredis";

export class EdgeCacheManager {
  private redis: Redis;

  constructor(redisUrl: string) {
    this.redis = new Redis(redisUrl);
  }

  // Store response with Surrogate Tags (e.g. "product:123 category:electronics")
  async cacheResponse(url: string, body: string, ttlSeconds: number, surrogateKeys: string[]) {
    const cacheKey = \`edge_cache:\${url}\`;
    await this.redis.setex(cacheKey, ttlSeconds, body);

    // Map each tag to this cache key in Redis sets
    for (const tag of surrogateKeys) {
      await this.redis.sadd(\`surrogate_tag:\${tag}\`, cacheKey);
      await this.redis.expire(\`surrogate_tag:\${tag}\`, ttlSeconds);
    }
  }

  // Purge all cached URLs tagged with a specific domain entity
  async invalidateByTag(tag: string): Promise<number> {
    const tagKey = \`surrogate_tag:\${tag}\`;
    const matchingUrls = await this.redis.smembers(tagKey);

    if (matchingUrls.length > 0) {
      // Invalidate all matched cache entries in a single atomic delete
      await this.redis.del(...matchingUrls);
      await this.redis.del(tagKey);
      console.log(\`[EdgeCache] Purged \${matchingUrls.length} cached pages tagged with '\${tag}'\`);
    }

    return matchingUrls.length;
  }
}

// Verification:
const cache = new EdgeCacheManager("redis://localhost:6379");
await cache.cacheResponse("/products/123", JSON.stringify({ name: "Camera" }), 3600, ["product:123", "brand:sony"]);
await cache.cacheResponse("/catalog?brand=sony", JSON.stringify([{ id: 123 }]), 3600, ["brand:sony"]);

// Product is updated -> Purge all Sony pages instantly!
const purged = await cache.invalidateByTag("brand:sony");
console.log("Total entries invalidated:", purged); // 2`,
    breakdown: [
      "Tags cached responses with multiple domain identifiers (Surrogate-Keys).",
      "Maintains tag-to-URL mappings inside Redis sets.",
      "Invalidates dozens of cached endpoints simultaneously when a single entity changes.",
      "Avoids clearing entire cache stores unnecessarily during catalog updates."
    ],
    expectedOutput: "Invalidates all cached endpoints linked to 'brand:sony' tag instantly."
  },

  {
    id: "ms-ex-35",
    title: "Envoy Proxy Ingress & Cluster Configuration",
    category: "Service Discovery & Mesh",
    difficulty: "intermediate",
    whatThisCodeCovers: "A production Envoy proxy YAML configuration defining an HTTP listener, route matches, timeout budgets, and an upstream cluster with health checking.",
    conceptsCovered: ["Envoy Proxy", "Listeners", "Route Matching", "Clusters", "Health Checking"],
    code: `/*
static_resources:
  listeners:
    - name: ingress_listener
      address:
        socket_address:
          address: 0.0.0.0
          port_value: 10000
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                stat_prefix: ingress_http
                route_config:
                  name: local_route
                  virtual_hosts:
                    - name: backend_services
                      domains: ["*"]
                      routes:
                        - match:
                            prefix: "/orders"
                          route:
                            cluster: order_service_cluster
                            timeout: 1.5s
                            retry_policy:
                              retry_on: "5xx,connect-failure"
                              num_retries: 2
                http_filters:
                  - name: envoy.filters.http.router
                    typed_config:
                      "@type": type.googleapis.com/envoy.extensions.filters.http.router.v3.Router
  clusters:
    - name: order_service_cluster
      connect_timeout: 0.25s
      type: STRICT_DNS
      lb_policy: ROUND_ROBIN
      load_assignment:
        cluster_name: order_service_cluster
        endpoints:
          - lb_endpoints:
              - endpoint:
                  address:
                    socket_address:
                      address: order-service.prod.svc.cluster.local
                      port_value: 8080
      health_checks:
        - timeout: 1s
          interval: 5s
          unhealthy_threshold: 3
          healthy_threshold: 2
          http_health_check:
            path: "/healthz"
*/`,
    breakdown: [
      "Configures L7 HTTP listener on port 10000.",
      "Enforces a strict 1.5s timeout budget on /orders route with automatic 5xx retries.",
      "Defines an upstream cluster utilizing Round-Robin load balancing over strict DNS.",
      "Configures active HTTP health checking to evict degraded backend nodes."
    ],
    expectedOutput: "Envoy listens on port 10000, routes /orders with 1.5s timeout, and balances over healthy pods."
  },

  {
    id: "ms-ex-36",
    title: "Istio Strict mTLS & AuthorizationPolicy Configuration",
    category: "Security & Identity",
    difficulty: "intermediate",
    whatThisCodeCovers: "Kubernetes Istio manifests enforcing Strict mutual TLS (mTLS) across a namespace and restricting endpoint access to specific cryptographic SPIFFE identities.",
    conceptsCovered: ["Istio", "mTLS", "PeerAuthentication", "AuthorizationPolicy", "SPIFFE"],
    code: `/*
# 1. Enforce STRICT mTLS across the entire payments namespace
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: payments
spec:
  mtls:
    mode: STRICT # Rejects all plaintext HTTP connections immediately!
---
# 2. Enforce Least-Privilege Authorization: Only Order Service can call Payment /v1/charges
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: payment-access-control
  namespace: payments
spec:
  selector:
    matchLabels:
      app: payment-service
  action: ALLOW
  rules:
    - from:
        - source:
            principals:
              # Cryptographic identity extracted from X.509 client certificate SAN
              - "cluster.local/ns/production/sa/order-service-account"
      to:
        - operation:
            methods: ["POST"]
            paths: ["/v1/charges"]
*/`,
    breakdown: [
      "Sets PeerAuthentication mode to STRICT to enforce 100% encrypted mTLS.",
      "Rejects any pod connecting without a valid in-cluster mesh certificate.",
      "Enforces fine-grained path and HTTP method authorization using SPIFFE principal names.",
      "Prevents lateral movement if another pod in the cluster is compromised."
    ],
    expectedOutput: "All traffic into payments is encrypted with mTLS; only order-service-account can POST /v1/charges."
  },

  {
    id: "ms-ex-37",
    title: "Istio Canary Traffic Shifting with VirtualService",
    category: "Deployment & Delivery",
    difficulty: "intermediate",
    whatThisCodeCovers: "Configuring an Istio VirtualService and DestinationRule to route 90% of production traffic to stable v1 and 10% to canary v2.",
    conceptsCovered: ["Canary Deployment", "VirtualService", "DestinationRule", "Traffic Shifting", "Subsets"],
    code: `/*
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: catalog-service-subsets
  namespace: production
spec:
  host: catalog-service
  subsets:
    - name: v1
      labels:
        version: "1.0.0"
    - name: v2
      labels:
        version: "2.0.0"
---
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: catalog-service-canary
  namespace: production
spec:
  hosts:
    - catalog-service
  http:
    - route:
        - destination:
            host: catalog-service
            subset: v1
          weight: 90
        - destination:
            host: catalog-service
            subset: v2
          weight: 10
*/`,
    breakdown: [
      "Defines deployment subsets in DestinationRule mapping to version labels.",
      "Configures weighted routing inside VirtualService (90% v1, 10% v2).",
      "Executes traffic shifting at L7 sidecar proxies with zero downtime.",
      "Enables validation of the new release against real customer traffic before full rollout."
    ],
    expectedOutput: "Istio routes 9 out of 10 requests to v1 and 1 out of 10 to canary v2."
  },

  {
    id: "ms-ex-38",
    title: "Istio Fault Injection for Chaos Testing",
    category: "Reliability Engineering",
    difficulty: "intermediate",
    whatThisCodeCovers: "Injecting artificial 5-second fixed latency and HTTP 503 aborts via Istio VirtualService to test calling service resilience.",
    conceptsCovered: ["Fault Injection", "Chaos Engineering", "Latency Injection", "HTTP Abort", "VirtualService"],
    code: `/*
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: payment-fault-injection
  namespace: production
spec:
  hosts:
    - payment-service
  http:
    - match:
        - headers:
            x-chaos-drill:
              exact: "true"
      fault:
        delay:
          percentage:
            value: 50.0
          fixedDelay: 4s # Inject 4s delay into 50% of requests
        abort:
          percentage:
            value: 20.0
          httpStatus: 503 # Abort 20% of requests with 503 Service Unavailable
      route:
        - destination:
            host: payment-service
    # Normal production traffic passes untouched without fault injection
    - route:
        - destination:
            host: payment-service
*/`,
    breakdown: [
      "Scropes chaos experiment strictly to requests bearing x-chaos-drill: true header.",
      "Injects 4-second latency to 50% of matching requests to test timeout behavior.",
      "Aborts 20% of matching requests with HTTP 503 to verify circuit breaker tripping.",
      "Protects regular production traffic while allowing synthetic verification drills."
    ],
    expectedOutput: "Requests with x-chaos-drill header experience injected delays and 503 errors."
  },

  {
    id: "ms-ex-39",
    title: "Circuit Breaker State Machine with Half-Open Probe",
    category: "Reliability Engineering",
    difficulty: "advanced",
    whatThisCodeCovers: "A standalone, production-ready Circuit Breaker class implementing CLOSED, OPEN, and HALF-OPEN states with statistical error thresholds and automated recovery probes.",
    conceptsCovered: ["Circuit Breaker", "Fail Fast", "Half-Open", "State Machine", "Graceful Degradation"],
    code: `type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class ProductionCircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private successCount = 0;
  private nextAttempt = Date.now();

  constructor(
    private readonly failureThreshold = 5,
    private readonly resetTimeoutMs = 10000,
    private readonly halfOpenSuccessTarget = 2
  ) {}

  async fire<T>(action: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.state === "OPEN") {
      if (Date.now() > this.nextAttempt) {
        this.state = "HALF_OPEN";
        console.log("[CircuitBreaker] Transitioned to HALF_OPEN. Permitting canary probe.");
      } else {
        // Fast-fail: Bypass remote network call completely!
        return fallback();
      }
    }

    try {
      const result = await action();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      return fallback();
    }
  }

  private onSuccess() {
    this.failureCount = 0;
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= this.halfOpenSuccessTarget) {
        this.state = "CLOSED";
        this.successCount = 0;
        console.log("[CircuitBreaker] Service healthy. Reset to CLOSED.");
      }
    }
  }

  private onFailure() {
    this.failureCount++;
    if (this.failureCount >= this.failureThreshold || this.state === "HALF_OPEN") {
      this.state = "OPEN";
      this.nextAttempt = Date.now() + this.resetTimeoutMs;
      this.successCount = 0;
      console.warn(\`[CircuitBreaker] Tripped to OPEN! Failing fast for \${this.resetTimeoutMs}ms\`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}`,
    breakdown: [
      "Implements finite state machine with CLOSED, OPEN, and HALF_OPEN states.",
      "Trips to OPEN after 5 consecutive failures, fast-failing subsequent requests via fallback.",
      "Probes downstream service in HALF_OPEN state after resetTimeoutMs expires.",
      "Protects failing services from being overwhelmed during recovery."
    ],
    expectedOutput: "Trips to OPEN on 5 failures; fails fast for 10s, probes in HALF_OPEN, and resets to CLOSED."
  },

  {
    id: "ms-ex-40",
    title: "Semaphore Bulkhead Concurrency Limiter",
    category: "Reliability Engineering",
    difficulty: "intermediate",
    whatThisCodeCovers: "A Semaphore Bulkhead isolating shared Node.js resources by limiting concurrent in-flight requests per microservice dependency.",
    conceptsCovered: ["Bulkhead", "Semaphore", "Resource Isolation", "Thread Starvation", "Capacity Management"],
    code: `export class SemaphoreBulkhead {
  private activeCount = 0;

  constructor(
    private readonly name: string,
    private readonly maxConcurrency: number
  ) {}

  async execute<T>(fn: () => Promise<T>, fallback: () => T): Promise<T> {
    if (this.activeCount >= this.maxConcurrency) {
      console.warn(\`[Bulkhead:\${this.name}] Concurrency limit (\${this.maxConcurrency}) reached. Shedding request.\`);
      return fallback();
    }

    this.activeCount++;
    try {
      return await fn();
    } finally {
      this.activeCount--;
    }
  }

  getActiveCount(): number {
    return this.activeCount;
  }
}

// Applying isolated bulkheads to different dependencies:
const recommendationBulkhead = new SemaphoreBulkhead("Recommendations", 5);
const paymentBulkhead = new SemaphoreBulkhead("Payments", 50);

// If recommendations lock up, max 5 slots are blocked.
// 50 slots remain guaranteed for processing critical payments!`,
    breakdown: [
      "Restricts concurrent in-flight executions to maxConcurrency per dependency.",
      "Rejects excess requests immediately without queuing, invoking fallback logic.",
      "Decrements active counter in finally block to guarantee zero resource leaks.",
      "Prevents a single degraded dependency from exhausting the application's connection pool."
    ],
    expectedOutput: "Rejects requests exceeding concurrency ceiling of 5, preserving capacity for payments."
  },

  {
    id: "ms-ex-41",
    title: "Distributed Deadline Propagation Middleware",
    category: "Reliability Engineering",
    difficulty: "advanced",
    whatThisCodeCovers: "Express middleware that extracts remaining timeout budgets from request headers, binds an AbortSignal, and propagates adjusted deadlines downstream.",
    conceptsCovered: ["Deadline Propagation", "Timeout Budget", "AbortSignal", "Fail Fast", "Distributed Latency"],
    code: `import { Request, Response, NextFunction } from "express";

export function distributedDeadlineMiddleware(req: Request, res: Response, next: NextFunction) {
  const incomingDeadlineHeader = req.headers["x-request-deadline"]; // Unix timestamp ms
  const defaultTimeoutMs = 2000;

  const deadlineTimestamp = incomingDeadlineHeader
    ? parseInt(incomingDeadlineHeader as string, 10)
    : Date.now() + defaultTimeoutMs;

  const remainingBudgetMs = deadlineTimestamp - Date.now();

  // 1. Fail-Fast if upstream has already timed out
  if (remainingBudgetMs <= 0) {
    return res.status(504).json({
      error: "Gateway Timeout",
      message: "Upstream deadline has already expired before processing could start"
    });
  }

  // 2. Create AbortController bound to remaining time budget
  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, remainingBudgetMs);

  (req as any).deadline = {
    timestamp: deadlineTimestamp,
    remainingMs: () => Math.max(0, deadlineTimestamp - Date.now()),
    signal: controller.signal
  };

  res.on("finish", () => clearTimeout(timer));
  next();
}

// Downstream HTTP call forwarding adjusted deadline:
export async function callDownstreamService(url: string, req: any) {
  return fetch(url, {
    signal: req.deadline.signal,
    headers: {
      "x-request-deadline": req.deadline.timestamp.toString()
    }
  });
}`,
    breakdown: [
      "Checks remaining time budget from x-request-deadline header.",
      "Immediately aborts execution with HTTP 504 if upstream has already timed out.",
      "Binds an AbortSignal to the remaining budget, auto-cancelling long queries on timeout.",
      "Propagates the immutable deadline timestamp downstream to prevent wasted computation."
    ],
    expectedOutput: "Aborts with 504 if deadline has expired; propagates remaining budget to downstream calls."
  },

  {
    id: "ms-ex-42",
    title: "Exponential Backoff with Full Jitter Engine",
    category: "Reliability Engineering",
    difficulty: "intermediate",
    whatThisCodeCovers: "A production retry function implementing the AWS Full Jitter exponential backoff algorithm to decorrelate retry spikes.",
    conceptsCovered: ["Exponential Backoff", "Full Jitter", "Retry Storm", "Idempotency", "Thundering Herd"],
    code: `export async function executeWithFullJitter<T>(
  operation: () => Promise<T>,
  maxAttempts = 4,
  baseDelayMs = 100,
  maxDelayMs = 3000
): Promise<T> {
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      if (attempt >= maxAttempts) {
        throw new Error(\`Operation failed after \${maxAttempts} attempts. Final error: \${err.message}\`);
      }

      // Calculate exponential ceiling: min(maxDelay, base * 2 ^ attempt)
      const exponentialCeiling = Math.min(
        maxDelayMs,
        baseDelayMs * Math.pow(2, attempt)
      );

      // AWS Full Jitter: randomize uniformly between 0 and exponentialCeiling
      const sleepMs = Math.floor(Math.random() * exponentialCeiling);

      console.warn(\`[Retry] Attempt \${attempt} failed. Sleeping for \${sleepMs}ms (ceiling: \${exponentialCeiling}ms)\`);
      await new Promise(resolve => setTimeout(resolve, sleepMs));
    }
  }

  throw new Error("Retry loop exhausted");
}`,
    breakdown: [
      "Calculates exponential ceiling: baseDelay * 2^attempt, capped at maxDelayMs.",
      "Draws a uniform random sleep duration between 0 and the ceiling (Full Jitter).",
      "Decorrelates thousands of concurrent failing clients to eliminate synchronized retry waves.",
      "Throws clean aggregated exception if all retry attempts are exhausted."
    ],
    expectedOutput: "Retries with randomized delay intervals, successfully recovering or surfacing clean error."
  }
];

module.exports = { recipes };
