const fs = require("fs");
const path = require("path");

const runbooks = [
  {
    id: "ms-prod-01",
    topic: "Cascading Outage via Thread Pool & Socket Exhaustion",
    category: "Reliability & Resilience",
    severity: "P0 - Critical Outage",
    theProblem: "A minor recommendation microservice experiences a slow database lock, increasing its response time from 35ms to 8,000ms. Calling upstream services (Product Catalog and Checkout API Gateway) execute synchronous calls without aggressive timeouts. Within 90 seconds, all worker threads and epoll socket pools across the cluster are 100% saturated waiting on I/O. The entire platform stops accepting new incoming HTTP connections, returning 504 Gateway Timeout on 100% of user traffic.",
    howItWorksInternally: "When an HTTP client initiates a synchronous network call without a bounded deadline, the operating system holds open a socket descriptor and worker thread. In thread-per-request runtimes (like Tomcat or Spring Boot), the thread pool (default 200 threads) exhausts rapidly. In event-driven runtimes (Node.js), the asynchronous event loop queue fills with thousands of pending callback closures, exhausting heap memory and spiking GC pauses. As connections back up, upstream reverse proxies (NGINX/Envoy) fill their client connection queues and reject new incoming TCP SYNs.",
    productionCode: `// Emergency Remediation: Circuit Breaker with Hard 400ms Deadline and Fallback Stub
import { ProductionCircuitBreaker } from "./circuitBreaker.js";

const recsBreaker = new ProductionCircuitBreaker(
  3,     // Trip after 3 consecutive failures
  15000, // Stay OPEN for 15s before probing
  2      // Half-open target
);

export async function getRecommendationsWithIsolation(productId: string) {
  return recsBreaker.fire(
    async () => {
      // 1. Strict AbortController deadline budget (400ms max)
      const res = await fetch(\`http://recommendation-service:8080/recs/\${productId}\`, {
        signal: AbortSignal.timeout(400)
      });
      if (!res.ok) throw new Error(\`Downstream HTTP \${res.status}\`);
      return res.json();
    },
    // 2. Fallback Stub: Gracefully degrade immediately without blocking threads!
    () => {
      console.warn(\`[Degradation] Serving static recommendation fallback for \${productId}\`);
      return [
        { id: "fallback-item-1", title: "Top Trending Item" },
        { id: "fallback-item-2", title: "Best Seller" }
      ];
    }
  );
}`,
    monitoringMetrics: [
      "sum(rate(http_requests_total{status_code=~'504|503'}[1m])) by (service)",
      "histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le, route))",
      "process_active_requests or jvm_threads_busy / jvm_threads_max"
    ],
    productionChecklist: [
      "Deploy emergency Envoy VirtualService setting timeout: 500ms on degraded service route.",
      "Trip circuit breaker to OPEN state via dynamic feature flag to stop outbound network calls.",
      "Restart stalled upstream pods after enabling fallback stubs to clear blocked socket queues.",
      "Verify recovery by observing p99 latency drop back below 250ms and error rates return to zero."
    ]
  },

  {
    id: "ms-prod-02",
    topic: "Kafka Consumer Group Poison Pill & Offset Commit Stall",
    category: "Event-Driven Messaging",
    severity: "P0 - Critical Outage",
    theProblem: "A producer publishes an unparseable malformed JSON message (Poison Pill) to a high-volume Kafka partition. The consumer crashes with a SyntaxError during JSON.parse(), unhandled by the consumer loop. The consumer restarts, re-fetches the exact same uncommitted offset, and crashes again in an infinite crash loop. The consumer lag for that partition balloons into millions of unconsumed messages, halting order fulfillment platform-wide.",
    howItWorksInternally: "When a Kafka consumer fails before issuing a manual or automatic offset commit, the message remains at the current partition offset. On restart, the consumer group coordinator assigns the partition back to the consumer, which seeks to the last committed offset and re-reads the poison pill. Because the crash happens before the offset commit, the message acts as an impassable roadblock, permanently blocking all subsequent valid messages queued behind it in the partition log.",
    productionCode: `// Production Fix: Poison Pill Interceptor with Dead Letter Queue Routing
export async function resilientConsumerLoop(consumer: any, dlqProducer: any) {
  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }: any) => {
      let payload: any;
      const rawText = message.value?.toString();

      // 1. Defend against malformed JSON (Poison Pill detection)
      try {
        payload = JSON.parse(rawText || "{}");
      } catch (parseError: any) {
        console.error(\`POISON PILL DETECTED at offset \${message.offset}! Routing to DLQ.\`);

        // Forward raw poisoned bytes to Dead Letter Queue for offline debugging
        await dlqProducer.send({
          topic: \`\${topic}.POISON_PILL_DLQ\`,
          messages: [{
            key: message.key,
            value: message.value,
            headers: {
              "x-poison-reason": parseError.message,
              "x-source-topic": topic,
              "x-source-partition": partition.toString(),
              "x-source-offset": message.offset
            }
          }]
        });

        // CRITICAL: Commit offset past the poison pill so consumer never blocks!
        await consumer.commitOffsets([
          { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
        ]);
        return;
      }

      // 2. Normal business processing
      await processOrderEvent(payload);

      // 3. Commit valid offset
      await consumer.commitOffsets([
        { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
      ]);
    }
  });
}`,
    monitoringMetrics: [
      "kafka_consumergroup_lag{topic='order.lifecycle'}",
      "sum(rate(kafka_consumer_records_consumed_total[1m])) by (partition)",
      "kafka_consumer_crash_loop_count"
    ],
    productionChecklist: [
      "Identify the stuck partition and consumer group lag using kafka-consumer-groups.sh.",
      "Check error logs for SyntaxError or schema deserialization exceptions.",
      "Deploy poison pill interceptor that commits past corrupted messages while routing to DLQ.",
      "Alternatively, use kafka-consumer-groups.sh --reset-offsets --shift-by 1 to manually skip poison offset."
    ]
  },

  {
    id: "ms-prod-03",
    topic: "Thundering Herd Retry Storm after Downstream Recovery",
    category: "Reliability & Resilience",
    severity: "P0 - Critical Outage",
    theProblem: "Payment Service recovers from a 15-minute database outage. Instantly, 50,000 clients that failed during the outage execute automated retries at the exact same second using fixed backoff intervals (e.g. retry every 2000ms). The massive surge in traffic (10x normal peak load) instantly crashes Payment Service again, generating a repeating cycle of crashes and preventing genuine service recovery.",
    howItWorksInternally: "When thousands of microservice clients fail concurrently, deterministic retry algorithms (fixed delay or exponential backoff without jitter) synchronize the retry timings. Clients generate rhythmic waves of requests that peak simultaneously. Even if the backend database could handle steady-state traffic, the massive instantaneous burst exhausts TCP listen backlogs (SYN queue overflow), triggers database connection timeouts, and trips upstream circuit breakers.",
    productionCode: `// Production Mitigation: AWS Full Jitter Retry Engine + Circuit Breaker Rate-Gate
export async function retryWithFullJitter<T>(
  operation: () => Promise<T>,
  maxAttempts = 5,
  baseDelayMs = 200,
  maxDelayMs = 8000
): Promise<T> {
  let attempt = 0;

  while (attempt < maxAttempts) {
    try {
      return await operation();
    } catch (err: any) {
      attempt++;
      if (attempt >= maxAttempts) throw err;

      // 1. Exponential ceiling
      const ceiling = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt));

      // 2. Full Jitter: randomize uniformly between 0 and ceiling
      // This completely decorrelates 50,000 clients across a smooth time spectrum!
      const sleepTime = Math.floor(Math.random() * ceiling);

      console.warn(\`[Retry] Attempt \${attempt} failed. Full Jitter sleep: \${sleepTime}ms\`);
      await new Promise(r => setTimeout(r, sleepTime));
    }
  }

  throw new Error("Retry exhausted");
}`,
    monitoringMetrics: [
      "sum(rate(http_requests_total{service='payment-service'}[1m]))",
      "node_netstat_Tcp_ListenOverflows",
      "sum(rate(http_requests_total{status_code='429'}[1m]))"
    ],
    productionChecklist: [
      "Deploy emergency edge rate-limiting policy in Envoy to drop 60% of retry traffic.",
      "Update client SDK configurations to enforce Full Jitter instead of fixed intervals.",
      "Scale up Payment Service container replicas before releasing the traffic gate.",
      "Gradually throttle traffic back up using Istio VirtualService weights."
    ]
  },

  {
    id: "ms-prod-04",
    topic: "Split-Brain Inconsistency during Saga Compensation Failure",
    category: "Transactions & Consistency",
    severity: "P0 - Critical Outage",
    theProblem: "During a multi-step Checkout Saga, Step 1 (Debit User Points) succeeds, Step 2 (Reserve Inventory) succeeds, but Step 3 (Payment Gateway) fails. The Saga Orchestrator triggers backward compensation. The compensation to release inventory succeeds, but the compensation to refund user points times out due to a network blip. The user is charged points for an order that was canceled, creating financial inconsistency and customer complaints.",
    howItWorksInternally: "Unlike ACID database rollbacks managed by a single transaction manager, distributed Sagas execute compensating transactions over the network. Network timeouts or downstream server 500s can cause a compensation to fail. If the orchestrator treats a failed compensation as 'done' or drops the workflow, the system enters an inconsistent split-brain state where part of the transaction committed and another part aborted.",
    productionCode: `// Production Fix: Durable Saga Orchestrator with Persistent Compensation Retries
export class DurableSagaRunner {
  constructor(private sagaStateStore: any) {}

  async executeCompensationWithGuaranteedDelivery(sagaId: string, compensation: { name: string; run: () => Promise<void> }) {
    let attempt = 0;
    const maxRetries = 10;

    while (attempt < maxRetries) {
      try {
        console.log(\`[SagaCompensation] Attempting \${compensation.name} for Saga \${sagaId}\`);
        await compensation.run();

        // Mark compensation resolved in persistent database
        await this.sagaStateStore.markStepCompensated(sagaId, compensation.name);
        return;
      } catch (err: any) {
        attempt++;
        const backoff = Math.min(30000, 1000 * Math.pow(2, attempt));
        console.error(\`Compensation \${compensation.name} failed (attempt \${attempt}). Retrying in \${backoff}ms\`);
        await new Promise(r => setTimeout(r, backoff));
      }
    }

    // If compensation fails after 10 attempts: Trigger CRITICAL PagerDuty Alarm for Human Intervention!
    await this.sagaStateStore.markStalledHumanTriage(sagaId, compensation.name);
    await triggerPagerDutyAlert({
      severity: "CRITICAL",
      summary: \`SAGA COMPENSATION PERMANENTLY FAILED: \${compensation.name} on Saga \${sagaId}\`,
      details: "Requires immediate database ledger adjustment by finance/on-call."
    });
  }
}`,
    monitoringMetrics: [
      "saga_compensation_failures_total",
      "saga_in_flight_duration_seconds",
      "saga_stalled_human_triage_count"
    ],
    productionChecklist: [
      "Query saga state table for status = 'COMPENSATION_FAILED' or 'STALLED'.",
      "Ensure all compensating activities are strictly idempotent so retries do not double-refund.",
      "Configure Temporal / Orchestrator to retry compensations indefinitely with backoff.",
      "Audit financial ledgers and manually reconcile stalled transactions using compensation scripts."
    ]
  },

  {
    id: "ms-prod-05",
    topic: "Kubernetes Liveness Probe Cascading Restart Death Spiral",
    category: "Reliability & Resilience",
    severity: "P0 - Critical Outage",
    theProblem: "Under sudden marketing campaign traffic, the shared PostgreSQL database CPU spikes to 99%. A developer configured the microservice Liveness probe to execute 'SELECT 1' against the database. Because the database is saturated, the health check query times out after 1 second. Kubernetes concludes that all 40 microservice pods are dead, terminating and restarting all 40 containers simultaneously. The container restarts trigger connection storms against the database, permanently killing the cluster.",
    howItWorksInternally: "Kubernetes Liveness probes test whether the application process is internally deadlocked or crashed. If a liveness probe fails consecutive times, kubelet issues a SIGTERM followed by SIGKILL to restart the container. When liveness probes test external shared resources (databases, caches, third-party APIs), any blip in the external resource causes Kubernetes to restart healthy containers, destroying active in-flight user requests and generating thunderous initialization connection surges.",
    productionCode: `// Production Fix: Decouple Liveness (Internal Event Loop) from Readiness (External Deps)
import express from "express";
const app = express();

let isShuttingDown = false;

// 1. LIVENESS PROBE: Strictly internal! NEVER PING DATABASES HERE!
// If this endpoint responds, the Node.js event loop is ticking.
app.get("/healthz/liveness", (req, res) => {
  if (isShuttingDown) {
    return res.status(503).send("Shutting down");
  }
  return res.status(200).send("OK");
});

// 2. READINESS PROBE: Validates if the pod can actively accept incoming traffic
// If DB is slow, return 503 to REMOVE POD FROM SERVICE TRAFFIC WITHOUT KILLING IT!
app.get("/healthz/readiness", async (req, res) => {
  if (isShuttingDown) return res.status(503).send("Draining");

  try {
    // Check DB with short timeout
    await db.query("SELECT 1", { timeoutMs: 500 });
    return res.status(200).send("READY");
  } catch {
    // Pod is temporarily unready: Kube-proxy stops sending traffic, but container keeps running!
    return res.status(503).send("DATABASE_UNREACHABLE");
  }
});

// 3. Graceful Shutdown Signal Handler
process.on("SIGTERM", () => {
  isShuttingDown = true;
  console.log("SIGTERM received. Draining connections before shutdown.");
});`,
    monitoringMetrics: [
      "kube_pod_container_status_restarts_total",
      "sum(rate(kube_pod_container_status_waiting[5m]))",
      "pg_stat_activity_count"
    ],
    productionChecklist: [
      "Inspect Kubernetes pod restart counts using kubectl get pods -n prod.",
      "Verify deployment manifests: immediately remove database queries from livenessProbe.httpGet.",
      "Tune livenessProbe initialDelaySeconds (e.g. 15s) and failureThreshold (e.g. 5).",
      "Ensure readinessProbe removes degraded pods from Service endpoints without triggering restarts."
    ]
  },

  {
    id: "ms-prod-06",
    topic: "PostgreSQL Connection Pool Starvation via Pod Autoscaling",
    category: "Data & Persistence",
    severity: "P0 - Critical Outage",
    theProblem: "During Black Friday, the Kubernetes Horizontal Pod Autoscaler (HPA) scales the Order Service from 8 pods to 40 pods. Each pod is configured with a PostgreSQL connection pool of max: 25 connections. 40 pods * 25 connections = 1,000 connections. PostgreSQL's max_connections is configured to 300. The database immediately throws 'FATAL: remaining connection slots are reserved for non-superuser connections'. All database writes across the entire company freeze.",
    howItWorksInternally: "PostgreSQL uses a process-per-connection architecture where each active connection consumes 5MB-10MB of RAM and competes for CPU scheduling. When hundreds of uncoordinated microservice replicas autoscale, they independently checkout TCP sockets. Once max_connections is exhausted, PostgreSQL rejects all new connection attempts, including health checks and administrative SSH access.",
    productionCode: `// Production Fix: Deploy PgBouncer in Transaction Pooling Mode + Conservative Pool Sizing
// 1. In Microservice: Restrict pool size and enforce aggressive checkout timeouts
import { Pool } from "pg";

export const dbPool = new Pool({
  host: process.env.PGBOUNCER_HOST || "pgbouncer.database.svc.cluster.local",
  port: 6432, // PgBouncer port
  max: 4,     // Keep small! 40 pods * 4 = 160 connections (safe below 300 ceiling)
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 1500, // Fail fast if connection cannot be checked out in 1.5s
  statement_timeout: 4000        // Kill rogue queries taking > 4s
});

// 2. PgBouncer Configuration (pgbouncer.ini):
/*
[databases]
orders = host=postgres-primary port=5432 dbname=orders

[pgbouncer]
listen_port = 6432
listen_addr = *
auth_type = md5
auth_file = /etc/pgbouncer/userlist.txt
pool_mode = transaction       # Reuses server connections immediately after each transaction commits!
max_client_conn = 5000       # Allows 5,000 frontend microservice connections
default_pool_size = 50       # Keeps only 50 active persistent sockets to real PostgreSQL!
*/`,
    monitoringMetrics: [
      "pg_stat_database_numbackends / pg_settings_max_connections",
      "pgbouncer_pools_cl_waiting",
      "pgbouncer_pools_sv_active"
    ],
    productionChecklist: [
      "Check active PostgreSQL connection counts via SELECT count(*) FROM pg_stat_activity.",
      "Deploy PgBouncer connection pooler in Transaction Pooling mode between pods and database.",
      "Reduce max connections per pod in deployment ConfigMaps from 25 to 4.",
      "Cap HPA maxReplicas so (maxReplicas * poolSize) never exceeds PgBouncer client limits."
    ]
  },

  {
    id: "ms-prod-07",
    topic: "Distributed Tracing Context Loss & Orphaned Spans",
    category: "Observability & Telemetry",
    severity: "P1 - High Severity",
    theProblem: "Engineers investigating high checkout latency discover that distributed traces truncate abruptly at Order Service. Payment and Inventory child spans appear as disconnected root traces with brand-new Trace IDs, rendering trace waterfall visualizations broken and making root-cause latency attribution across microservices impossible.",
    howItWorksInternally: "Context loss occurs when a microservice uses uninstrumented HTTP/gRPC clients or spawns uncoordinated background tasks (e.g. raw setTimeout or un-wrapped worker threads). If the outbound network client fails to extract the active OpenTelemetry context and inject the W3C traceparent header into the HTTP carrier, downstream services assume the incoming request is a brand-new transaction, generating a new Trace ID and breaking the trace DAG.",
    productionCode: `// Production Fix: Automatic Context Propagation over Outbound HTTP Calls
import { context, propagation, trace } from "@opentelemetry/api";

export async function tracedHttpClientFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {};

  // 1. Copy user headers
  if (options.headers) {
    Object.entries(options.headers).forEach(([k, v]) => {
      headers[k] = v.toString();
    });
  }

  // 2. Inject current active trace context (traceparent & tracestate) into outgoing headers
  propagation.inject(context.active(), headers);

  // 3. Create child span for outbound HTTP hop
  const tracer = trace.getTracer("http-client");
  return tracer.startActiveSpan(\`HTTP \${options.method || "GET"} \${url}\`, async (span) => {
    try {
      const response = await fetch(url, { ...options, headers });
      span.setAttribute("http.status_code", response.status);
      return response;
    } catch (err: any) {
      span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}`,
    monitoringMetrics: [
      "otelcol_receiver_accepted_spans",
      "sum(rate(traces_missing_parent_span_total[5m]))",
      "jaeger_traces_orphan_count"
    ],
    productionChecklist: [
      "Verify that all outbound HTTP and gRPC client libraries are wrapped with OpenTelemetry auto-instrumentation.",
      "Inspect incoming request headers in downstream logs: confirm 'traceparent' header is present.",
      "Ensure asynchronous background promises maintain context using context.with(parentCtx, ...).",
      "Validate complete trace DAGs in Jaeger / Grafana Tempo dashboards."
    ]
  },

  {
    id: "ms-prod-08",
    topic: "API Gateway Ingress Saturation & Tail Latency Amplification",
    category: "Ingress & Edge",
    severity: "P0 - Critical Outage",
    theProblem: "Under flash sale traffic, the API Gateway CPU reaches 100%, and edge p99 latency spikes to 14,000ms. An investigation reveals that the gateway executes synchronous scatter-gather aggregation across 12 downstream microservices for the homepage. Due to tail latency amplification, if each service has a 1% chance of a 2-second blip, over 11% of homepage gateway requests experience severe latency spikes.",
    howItWorksInternally: "Tail latency amplification follows the probability equation P(tail) = 1 - (1 - p)^n, where n is the number of concurrent downstream services. When an edge gateway waits synchronously on 12 services, the slowest response dictates overall response time. Slow requests keep gateway connection sockets open, consuming file descriptors and worker event loops until the gateway cannot process new connections.",
    productionCode: `// Production Fix: Bounded Concurrency Scatter-Gather with Aggressive Partial Degradation
export class ResilientGatewayAggregator {
  async getHomepageFeed(userId: string) {
    const timeoutMs = 350; // Hard edge budget

    // Scatter phase with strict deadlines
    const [heroBanner, products, recommendations, notifications] = await Promise.allSettled([
      fetchWithTimeout("http://banner-service/hero", timeoutMs),
      fetchWithTimeout("http://product-service/featured", timeoutMs),
      fetchWithTimeout(\`http://recs-service/user/\${userId}\`, timeoutMs),
      fetchWithTimeout(\`http://notification-service/user/\${userId}\`, timeoutMs)
    ]);

    // Mandatory core: fail if products fail
    if (products.status === "rejected") {
      throw new Error("Core product catalog unavailable");
    }

    // Graceful partial degradation for secondary widgets
    return {
      hero: heroBanner.status === "fulfilled" ? heroBanner.value : { title: "Welcome to Our Store", image: "/default.jpg" },
      products: products.value,
      recommendations: recommendations.status === "fulfilled" ? recommendations.value : [],
      notificationsCount: notifications.status === "fulfilled" ? notifications.value.count : 0,
      degraded: recommendations.status === "rejected" || notifications.status === "rejected"
    };
  }
}

function fetchWithTimeout(url: string, ms: number) {
  return fetch(url, { signal: AbortSignal.timeout(ms) }).then(r => r.json());
}`,
    monitoringMetrics: [
      "histogram_quantile(0.99, sum(rate(envoy_http_downstream_rq_time_bucket[1m])) by (le))",
      "envoy_http_downstream_rq_5xx",
      "gateway_scatter_gather_degraded_total"
    ],
    productionChecklist: [
      "Enforce maximum 350ms timeouts on all scattered downstream requests.",
      "Deploy Redis edge caching for static components (hero banner, categories).",
      "Configure HPA on API Gateway pods targeting 60% CPU utilization.",
      "Ensure non-essential widgets return fallback stubs rather than failing the entire page."
    ]
  },

  {
    id: "ms-prod-09",
    topic: "High-Cardinality Metric Explosion Crashing Prometheus TSDB",
    category: "Observability & Telemetry",
    severity: "P1 - High Severity",
    theProblem: "A newly deployed release adds user_id and email as labels to an HTTP request counter metric. Within 2 hours, 4 million unique time series are created. The Prometheus server exhausts its 32GB RAM, triggers Out-Of-Memory (OOM) kernel kills, and enters a crash loop during WAL replay. The engineering organization loses 100% of metrics and alerting capability during an active production deployment.",
    howItWorksInternally: "Prometheus stores time series indexed by unique combinations of metric names and label key-value pairs. Each distinct label value creates a separate time-series chunk in memory and disk index. Unbounded fields (UUIDs, emails, timestamps, credit card hashes) possess infinite cardinality, causing the inverted index memory footprint to balloon exponentially until the TSDB crashes.",
    productionCode: `// Production Fix: Strict Low-Cardinality Metric Labels + Relabel Config
// 1. Application Metric: Keep labels strictly bounded to low-cardinality enums!
import client from "prom-client";

export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total HTTP requests",
  labelNames: ["method", "route_template", "status_class"] // Low cardinality!
});

export function recordHttpMetrics(method: string, parameterizedRoute: string, statusCode: number) {
  // Use route template (/users/:id) instead of raw URL (/users/881923)!
  const statusClass = \`\${Math.floor(statusCode / 100)}xx\`; // 2xx, 4xx, 5xx
  httpRequestsTotal.inc({ method, route_template: parameterizedRoute, status_class: statusClass });
}

// 2. Prometheus Metric Relabel Config to drop rogue high-cardinality labels:
/*
scrape_configs:
  - job_name: 'microservices'
    metric_relabel_configs:
      - regex: '(user_id|email|customer_id|order_id)'
        action: labeldrop
*/`,
    monitoringMetrics: [
      "prometheus_tsdb_head_series",
      "process_resident_memory_bytes{job='prometheus'}",
      "sum(rate(prometheus_target_scrapes_sample_limit_rejected_total[1m]))"
    ],
    productionChecklist: [
      "Deploy emergency Prometheus config with metric_relabel_configs dropping rogue labels.",
      "Restart Prometheus with --storage.tsdb.retention.size=20GB to bound disk storage.",
      "Inspect code for unbounded Prometheus labels (user_id, IP address, UUIDs).",
      "Move high-cardinality debugging attributes exclusively to OpenTelemetry Traces and Logs."
    ]
  },

  {
    id: "ms-prod-10",
    topic: "Service Mesh mTLS Certificate Expiration & Mutual Auth Blackout",
    category: "Security & Identity",
    severity: "P0 - Critical Outage",
    theProblem: "At midnight, the root intermediate CA certificate for the Istio service mesh expires. Instantly, all Envoy sidecar proxies reject incoming TCP connections with 'SSL: certificate verify failed: certificate has expired'. 100% of inter-service east-west communications collapse across the entire Kubernetes cluster.",
    howItWorksInternally: "In a service mesh running STRICT mTLS, every sidecar proxy validates the cryptographic X.509 certificate presented by calling pods against the trusted root CA. If the intermediate CA or root CA reaches its expiration timestamp without automated rotation, all cryptographic handshakes fail at the TLS layer before any HTTP application bytes can be exchanged.",
    productionCode: `// Production Triage Script: Automated SPIFFE Certificate Expiry Check & Emergency Rotation
import { execSync } from "node:child_process";

export function checkMeshCertificateExpiry() {
  console.log("Checking Istio root certificate expiration...");
  try {
    // Extract root CA expiration date from Kubernetes secret
    const certOutput = execSync(
      "kubectl get secret -n istio-system cacerts -o jsonpath='{.data.ca-cert\\\\.pem}' | base64 -d | openssl x509 -noout -enddate",
      { encoding: "utf-8" }
    );
    console.log("Root CA Expiry:", certOutput.trim());

    // Emergency Fallback: Switch Istio PeerAuthentication to PERMISSIVE during renewal
    console.log("Executing emergency permissive mTLS fallback policy...");
    execSync(
      "kubectl apply -f - <<EOF\\n" +
      "apiVersion: security.istio.io/v1beta1\\n" +
      "kind: PeerAuthentication\\n" +
      "metadata:\\n" +
      "  name: emergency-permissive\\n" +
      "  namespace: istio-system\\n" +
      "spec:\\n" +
      "  mtls:\\n" +
      "    mode: PERMISSIVE\\n" +
      "EOF"
    );
    console.log("PERMISSIVE mode applied. Network connectivity restored while certificates regenerate.");
  } catch (err: any) {
    console.error("Certificate check failed:", err.message);
  }
}`,
    monitoringMetrics: [
      "citadel_secret_controller_active_root_cert_expiry_timestamp",
      "envoy_ssl_handshake_errors",
      "sum(rate(envoy_ssl_connection_error[1m]))"
    ],
    productionChecklist: [
      "Check mesh certificate expiration timestamps via istioctl pc secret <pod-name>.",
      "If expired, apply emergency PeerAuthentication mode: PERMISSIVE to restore traffic.",
      "Rotate root CA certificate using cert-manager or Vault PKI engine.",
      "Re-apply PeerAuthentication mode: STRICT and verify successful mTLS handshakes."
    ]
  },

  {
    id: "ms-prod-11",
    topic: "SSRF Attack on Cloud Metadata Service via Unsanitized Ingress",
    category: "Security & Identity",
    severity: "P0 - Critical Outage",
    theProblem: "A profile service features an 'Import Avatar from URL' endpoint. An attacker submits 'http://169.254.169.254/latest/meta-data/iam/security-credentials/k8s-pod-role'. The microservice fetches the URL and returns the JSON response containing raw AWS temporary access keys and session tokens. The attacker gains full IAM permissions to download private S3 buckets and alter cloud databases.",
    howItWorksInternally: "Server-Side Request Forgery occurs when a server fetches a remote resource without restricting destination IP ranges. In cloud environments (AWS, GCP, Azure), the link-local address 169.254.169.254 hosts the instance metadata service (IMDS). If IMDSv1 is enabled, a single unauthenticated GET request reveals the IAM role credentials attached to the underlying compute instance.",
    productionCode: `// Production Fix: IMDSv2 Enforcement + SSRF Hardened Fetch Client
import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

export async function ssrfHardenedFetch(rawUrl: string): Promise<Response> {
  const parsed = new URL(rawUrl);

  // 1. Protocol Restriction
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Protocol not permitted");
  }

  // 2. Resolve DNS hostname to raw IP addresses
  const resolvedIps = await dns.resolve4(parsed.hostname);

  for (const ip of resolvedIps) {
    const addr = ipaddr.parse(ip);
    const range = addr.range();

    // 3. Block private subnets, loopbacks, and cloud metadata link-local
    if (["private", "loopback", "linkLocal"].includes(range) || ip === "169.254.169.254") {
      throw new Error(\`SSRF Violation: Resolved IP \${ip} is strictly forbidden!\`);
    }
  }

  return fetch(rawUrl);
}

// AWS Infrastructure Hardening: Enforce IMDSv2 via AWS CLI:
// aws ec2 modify-instance-metadata-options --instance-id i-xxxx \\
//   --http-tokens required --http-endpoint enabled`,
    monitoringMetrics: [
      "waf_ssrf_blocked_requests_total",
      "cloudtrail_suspicious_iam_credential_usage",
      "container_egress_metadata_attempts_total"
    ],
    productionChecklist: [
      "Enforce AWS IMDSv2 (http-tokens required) across all EC2 and EKS nodes.",
      "Deploy Calico/Cilium NetworkPolicy blocking egress traffic to 169.254.169.254/32 from application namespaces.",
      "Deploy SSRF-hardened HTTP client rejecting link-local and private IP addresses.",
      "Immediately rotate compromised IAM credentials in AWS Secrets Manager."
    ]
  },

  {
    id: "ms-prod-12",
    topic: "Out-of-Order Event Processing & Stale State Overwrites",
    category: "Event-Driven Messaging",
    severity: "P1 - High Severity",
    theProblem: "Customer updates their billing address from 'Old Street' to 'New Avenue'. Two events are emitted: OrderCreated (Version 1) and AddressUpdated (Version 2). Due to network delays and multi-partition parallel consumer processing, the consumer receives AddressUpdated (v2) first, followed by OrderCreated (v1). The v1 event blindly overwrites the database with the old address, causing orders to be shipped to the wrong destination.",
    howItWorksInternally: "Kafka guarantees ordering strictly within a single partition. If a producer publishes events with different partition keys, or if a consumer processes records concurrently across worker threads, message arrival order can invert. If consumer handlers execute unconditional SQL updates without verifying entity version numbers, older historical states overwrite newer states (Lost Update anomaly).",
    productionCode: `// Production Fix: Optimistic Concurrency Control with Monotonic Version Guard
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function processCustomerUpdateEvent(event: {
  customerId: string;
  address: string;
  version: number; // Monotonically increasing version number
  eventTimestamp: string;
}) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Atomic conditional update: update ONLY IF incoming version is strictly greater!
    const res = await client.query(
      \`UPDATE customer_profiles
       SET address = $1,
           version = $2,
           updated_at = NOW()
       WHERE customer_id = $3
         AND version < $2\`, // Version guard prevents stale overwrites!
      [event.address, event.version, event.customerId]
    );

    if (res.rowCount === 0) {
      console.warn(
        \`[StaleEventIgnored] Event version \${event.version} is older or equal to current DB version for customer \${event.customerId}. Dropping.\`
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}`,
    monitoringMetrics: [
      "stale_events_dropped_total",
      "kafka_consumer_out_of_order_detected",
      "customer_profile_version_mismatch_total"
    ],
    productionChecklist: [
      "Ensure producer uses customerId as the partition key so all updates land in the same partition.",
      "Enforce monotonic version numbers on all entity domain events.",
      "Add WHERE version < incoming_version to all consumer SQL update statements.",
      "Verify that stale out-of-order events are logged and discarded safely."
    ]
  },

  {
    id: "ms-prod-13",
    topic: "Reactive Consumer Buffer Overflow & OOMKilled Containers",
    category: "Performance & Streaming",
    severity: "P0 - Critical Outage",
    theProblem: "A background data synchronization microservice consumes 20,000 inventory updates per second from Kafka and writes them to a slow relational database. The developer piped the Kafka stream into an unbounded asynchronous loop without backpressure. In-memory message queues balloon to 3GB RAM within 4 minutes. The Linux kernel kills the container with OOMKilled (Exit Code 137). The pod restarts, re-reads uncommitted offsets, and enters an endless OOM crash loop.",
    howItWorksInternally: "When an asynchronous event consumer pulls messages from network sockets faster than its worker pipeline can flush them to disk, in-flight closures accumulate in the V8 / JVM heap. As memory approaches the container's cgroup memory limit, the garbage collector runs continuously (100% CPU lockup), after which the kernel's Out-Of-Memory Killer sends SIGKILL (exit code 137) to protect host operating system memory.",
    productionCode: `// Production Fix: Stream Backpressure with Dynamic Ingestion Pausing
import { Kafka } from "kafkajs";

const kafka = new Kafka({ brokers: ["localhost:9092"] });
const consumer = kafka.consumer({ groupId: "inventory-sync-group" });

export async function runBackpressuredConsumer(dbWriter: any) {
  await consumer.connect();
  await consumer.subscribe({ topic: "inventory.stream" });

  let inFlight = 0;
  const HIGH_WATERMARK = 100; // Pause ingestion when 100 operations are in-flight
  const LOW_WATERMARK = 20;   // Resume ingestion when queue drains to 20

  await consumer.run({
    autoCommit: false,
    eachMessage: async ({ topic, partition, message }) => {
      inFlight++;

      // Apply backpressure if worker queue is saturated
      if (inFlight >= HIGH_WATERMARK) {
        console.warn(\`[Backpressure] In-flight queue reached \${inFlight}. Pausing consumer.\`);
        consumer.pause([{ topic, partitions: [partition] }]);
      }

      // Process write asynchronously
      dbWriter.write(message.value)
        .then(async () => {
          inFlight--;
          await consumer.commitOffsets([
            { topic, partition, offset: (BigInt(message.offset) + 1n).toString() }
          ]);

          // Resume consumer when buffer drains below low watermark
          if (inFlight <= LOW_WATERMARK) {
            consumer.resume([{ topic, partitions: [partition] }]);
          }
        })
        .catch((err: any) => console.error("Writer error", err));
    }
  });
}`,
    monitoringMetrics: [
      "container_memory_working_set_bytes / container_spec_memory_limit_bytes",
      "kube_pod_container_status_last_terminated_reason{reason='OOMKilled'}",
      "consumer_in_flight_operations_count"
    ],
    productionChecklist: [
      "Check pod termination reason via kubectl describe pod <pod-name> (look for OOMKilled 137).",
      "Implement consumer.pause() and consumer.resume() based on in-flight high/low watermarks.",
      "Increase container memory limits in deployment YAML if steady-state requirements dictate.",
      "Verify container memory stabilizes under high load without OOM terminations."
    ]
  },

  {
    id: "ms-prod-14",
    topic: "Destructive Database Schema Migration in Rolling Deployment",
    category: "Deployment & Delivery",
    severity: "P0 - Critical Outage",
    theProblem: "During a routine rolling deployment of Order Service v2, the CI/CD pipeline runs a database migration script: 'ALTER TABLE orders DROP COLUMN user_email; ALTER TABLE orders ADD COLUMN customer_id VARCHAR(50);'. The migration executes instantly against PostgreSQL. However, 80% of active pods in the cluster are still running Order Service v1, which actively issues SQL queries selecting 'user_email'. Active v1 pods fail with 'column user_email does not exist', causing 10,000 checkout failures during the 10-minute rolling deployment.",
    howItWorksInternally: "In a Kubernetes rolling update, new pods start up and old pods drain connections concurrently over a 5 to 15-minute window. Both software versions query the exact same database simultaneously. Running a destructive DDL migration (dropping a column, renaming a table, adding a non-null constraint without defaults) instantly breaks the backward compatibility required by the older running pods.",
    productionCode: `// Production Fix: Pre-Deployment Backward-Compatibility Linter & Safe Expand Migration
// 1. CI/CD Pre-Deployment Schema Verification Gate (Fails build if DDL is destructive):
export function validateMigrationSafety(sql: string) {
  const forbiddenPatterns = [
    /DROP\\s+COLUMN/i,
    /DROP\\s+TABLE/i,
    /RENAME\\s+COLUMN/i,
    /ADD\\s+COLUMN\\s+.*NOT\\s+NULL(?!.*DEFAULT)/i
  ];

  for (const pattern of forbiddenPatterns) {
    if (pattern.test(sql)) {
      throw new Error(
        \`FATAL: Destructive migration detected (\${pattern})! \\n\` +
        \`Migrations must follow Expand-and-Contract. Breaking DDL is forbidden in rolling deployments.\`
      );
    }
  }
}

// 2. Safe Phase 1 (Expand) Migration: Add new column as nullable with zero downtime
export const safeExpandSql = \`
  -- SAFE: Adds new column as nullable; v1 pods continue running unaffected!
  ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id VARCHAR(50);
\`;`,
    monitoringMetrics: [
      "sum(rate(postgresql_errors_total{error='undefined_column'}[1m]))",
      "http_requests_total{status_code='500'}",
      "deployment_rollout_duration_seconds"
    ],
    productionChecklist: [
      "Incorporate migration linter into CI/CD preventing DROP and RENAME statements in release builds.",
      "Enforce Expand-and-Contract: Release N adds column, Release N+1 switches reads, Release N+2 drops column.",
      "If broken migration occurs in production: immediately restore column via ALTER TABLE ADD COLUMN.",
      "Ensure all columns added in migrations are either nullable or include a DEFAULT value."
    ]
  }
];

console.log(`Loaded ${runbooks.length} production mastery runbooks.`);

if (runbooks.length !== 14) {
  console.error(`Expected exactly 14 runbooks, got ${runbooks.length}`);
  process.exit(1);
}

// Verify ids
runbooks.forEach((item, index) => {
  const expectedId = `ms-prod-${String(index + 1).padStart(2, "0")}`;
  if (item.id !== expectedId) {
    console.warn(`Fixing ID: ${item.id} -> ${expectedId}`);
    item.id = expectedId;
  }
});

const outFile = path.join(__dirname, "../data/microservices.production.json");
fs.writeFileSync(outFile, JSON.stringify(runbooks, null, 2), "utf8");
console.log(`Successfully wrote 14 production runbooks to ${outFile}`);
