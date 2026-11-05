const { card } = require("../ms_builder_helper.cjs");

const cards = [
  card(
    85,
    "The Three Pillars of Distributed Observability",
    "Observability",
    "Mastery",
    "Observability enables engineers to infer the internal states of a complex microservices ecosystem based on its external outputs: structured logs (discrete events), metrics (aggregated numeric time-series), and distributed traces (request journey across boundaries).",
    `// The Three Pillars Relationship:
// 1. Metrics (What is broken?): "High-level aggregation (e.g., Error rate jumped to 4.2% on /checkout in region us-east-1)".
// 2. Traces (Where is it broken?): "Trace #9a8b reveals that OrderService waited 4,200ms on PaymentService RPC".
// 3. Logs (Why is it broken?): "Line 42 of PaymentService logs: OutOfMemoryError in Stripe SDK parsing".

// Unified Observability Context in TypeScript:
export interface TelemetrySpan {
  traceId: string;       // Global transaction identifier
  spanId: string;        // Current local operation identifier
  parentSpanId?: string; // Caller's span identifier
  serviceName: string;   // e.g., "order-service"
  name: string;          // e.g., "POST /v1/orders"
  timestamp: number;     // Microseconds
  durationUs: number;
  attributes: Record<string, string | number | boolean>;
}

// Emitting structured log linked directly to Trace & Metric:
export function logTelemetry(level: "INFO" | "ERROR", message: string, span: TelemetrySpan, extra = {}) {
  const logRecord = {
    timestamp: new Date().toISOString(),
    level,
    message,
    service: span.serviceName,
    trace_id: span.traceId,
    span_id: span.spanId,
    ...extra
  };
  process.stdout.write(JSON.stringify(logRecord) + "\\n");
}`,
    ["Observability", "Three Pillars", "Metrics", "Structured Logging", "Distributed Tracing"],
    [
      { title: "OpenTelemetry Core Specification", url: "https://opentelemetry.io/docs/specs/otel/overview/" }
    ],
    "Why are traditional isolated log files on server disks obsolete in a microservices architecture?",
    "Containers are ephemeral and dynamically scheduled across hundreds of nodes. A single user transaction traverses dozens of microservices; searching isolated local log files via SSH is impossible. Logs must be structured, centrally ingested (Elasticsearch, Loki), and correlated by a shared `trace_id`.",
    "Which pillar is best suited for real-time alerting, and why?",
    "Metrics. Metrics are aggregated numeric counters and gauges stored as compact time-series data. Querying metrics across millions of operations requires minimal CPU and memory, enabling sub-second threshold evaluation for alert triggers."
  ),

  card(
    86,
    "Distributed Tracing with OpenTelemetry: Spans & Traces",
    "Observability",
    "Mastery",
    "A Trace represents the end-to-end path of a transaction through a distributed system. A Span represents a single unit of contiguous work within that trace (e.g. an HTTP handler, an SQL query, or an outgoing RPC).",
    `// Instrumenting Microservices with OpenTelemetry SDK (Node.js):
import { trace, context, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("order-service", "1.0.0");

export async function processOrderWorkflow(orderId: string, items: any[]) {
  // Start active span in current asynchronous execution context
  return tracer.startActiveSpan("processOrderWorkflow", async (span) => {
    span.setAttribute("order.id", orderId);
    span.setAttribute("order.items_count", items.length);

    try {
      // Nested child span: Database query
      await tracer.startActiveSpan("db.saveOrder", async (dbSpan) => {
        dbSpan.setAttribute("db.system", "postgresql");
        await saveToPostgres(orderId, items);
        dbSpan.end(); // Span must be explicitly ended
      });

      // Nested child span: Outgoing Payment RPC
      await tracer.startActiveSpan("rpc.callPayment", async (rpcSpan) => {
        rpcSpan.setAttribute("rpc.service", "payment-service");
        await callPaymentService(orderId);
        rpcSpan.end();
      });

      span.setStatus({ code: SpanStatusCode.OK });
      return { success: true };
    } catch (err: any) {
      // Record exception directly onto the span
      span.recordException(err);
      span.setStatus({ code: SpanStatusCode.ERROR, message: err.message });
      throw err;
    } finally {
      span.end();
    }
  });
}`,
    ["OpenTelemetry", "Distributed Tracing", "Spans", "Traces", "Root Span"],
    [
      { title: "OpenTelemetry Tracing Guide", url: "https://opentelemetry.io/docs/concepts/signals/traces/" }
    ],
    "What is the relationship between a Trace, a Root Span, and Child Spans?",
    "A Trace is a Directed Acyclic Graph (DAG) of Spans sharing a unique `trace_id`. The Root Span is the entry point (e.g. gateway request) with no parent. Every downstream operation creates a Child Span referencing its caller's `parent_span_id`.",
    "What is the consequence of failing to call `span.end()` in application code?",
    "Memory leak and missing telemetry. The span buffer never closes or exports to the collector, causing in-memory span queues to grow indefinitely and omitting the span from trace visualization tools."
  ),

  card(
    87,
    "W3C TraceContext: `traceparent` & `tracestate` Standard",
    "Observability",
    "Mastery",
    "The W3C TraceContext standard defines vendor-neutral HTTP headers (`traceparent` and `tracestate`) that microservices pass downstream to propagate distributed tracing context across polyglot boundaries without vendor lock-in.",
    `// W3C 'traceparent' Header Format:
// version - trace_id (32 hex) - parent_id / span_id (16 hex) - trace_flags (2 hex)
// Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
//   - version:     "00" (Current W3C spec)
//   - trace_id:    "4bf92f3577b34da6a3ce929d0e0e4736" (Immutable across entire request)
//   - parent_id:   "00f067aa0ba902b7" (Span ID of caller)
//   - trace_flags: "01" (Bit 1 = Sampled/Recorded, 00 = Not sampled)

// W3C TraceContext Parser and Formatter in TypeScript:
export interface W3CTraceContext {
  version: string;
  traceId: string;
  parentId: string;
  sampled: boolean;
}

export function parseTraceParent(headerValue?: string): W3CTraceContext | null {
  if (!headerValue) return null;
  const match = headerValue.match(/^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/);
  if (!match) return null;

  return {
    version: match[1],
    traceId: match[2],
    parentId: match[3],
    sampled: (parseInt(match[4], 16) & 0x01) === 1
  };
}

export function formatTraceParent(ctx: W3CTraceContext, currentSpanId: string): string {
  const flags = ctx.sampled ? "01" : "00";
  return \`\${ctx.version}-\${ctx.traceId}-\${currentSpanId}-\${flags}\`;
}`,
    ["W3C TraceContext", "traceparent", "tracestate", "Context Propagation", "Standardization"],
    [
      { title: "W3C Trace Context Specification", url: "https://www.w3.org/TR/trace-context/" }
    ],
    "Why was the W3C TraceContext standard introduced to replace vendor-specific headers (like B3 `X-B3-TraceId` or AWS `X-Amzn-Trace-Id`)?",
    "In multi-cloud and polyglot microservice environments, different libraries and vendors used incompatible headers. If an Envoy proxy used B3 and an upstream service used AWS headers, context propagation was severed, splitting single traces into disconnected fragments.",
    "What is the purpose of the `tracestate` header alongside `traceparent`?",
    "`tracestate` conveys vendor-specific routing and filtering metadata (e.g. `rojo=123,congo=456`) across systems without violating the standardized, opaque format of `traceparent`."
  ),

  card(
    88,
    "Context Propagation Across HTTP, gRPC & Kafka",
    "Observability",
    "Deep Dive",
    "Context propagation is the mechanism by which trace context is serialized (injected) into transport carrier metadata by a sender and deserialized (extracted) by a receiver across diverse network protocols (HTTP headers, gRPC metadata, Kafka record headers).",
    `// Context Propagation across Heterogeneous Transports:
import { context, propagation } from "@opentelemetry/api";

// 1. HTTP Client Injection:
export async function sendHttpClientCall(url: string) {
  const headers: Record<string, string> = {};
  // Injects traceparent & baggage into headers dictionary
  propagation.inject(context.active(), headers);

  return fetch(url, { headers });
}

// 2. Kafka Producer Header Injection:
export async function publishToKafka(producer: any, topic: string, message: any) {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);

  const kafkaHeaders = Object.entries(carrier).reduce((acc, [k, v]) => {
    acc[k] = Buffer.from(v);
    return acc;
  }, {} as Record<string, Buffer>);

  await producer.send({
    topic,
    messages: [{ value: JSON.stringify(message), headers: kafkaHeaders }]
  });
}

// 3. Kafka Consumer Context Extraction:
export async function consumeFromKafka(record: any) {
  const stringHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(record.headers || {})) {
    stringHeaders[k] = (v as Buffer).toString("utf-8");
  }

  // Extract parent context from incoming message headers
  const parentContext = propagation.extract(context.active(), stringHeaders);

  // Execute processing within the extracted trace context!
  await context.with(parentContext, async () => {
    const tracer = trace.getTracer("order-consumer");
    const span = tracer.startSpan("processKafkaOrder");
    // Span is now properly linked to original producer's trace ID!
    span.end();
  });
}`,
    ["Context Propagation", "Injection", "Extraction", "Kafka Headers", "gRPC Metadata"],
    [
      { title: "OpenTelemetry Context Propagation Guide", url: "https://opentelemetry.io/docs/concepts/context-propagation/" }
    ],
    "What breaks in distributed observability if a microservice developer spawns an asynchronous background task without propagating context?",
    "Context detachment. If a background worker executes inside `setTimeout` or an uninstrumented worker pool without carrying the active OpenTelemetry context, child spans lose their parent `trace_id` and start orphaned traces, destroying end-to-end visibility.",
    "Why must Kafka headers be used for trace context propagation rather than embedding tracing fields inside the message JSON body?",
    "Embedding telemetry in the payload pollutes the business domain schema, forces unnecessary deserialization of the entire payload by intermediate stream processors, and breaks binary serialization formats like Protobuf or Avro."
  ),

  card(
    89,
    "Sampling Strategies: Head Sampling vs Tail-Based Sampling",
    "Observability",
    "Mastery",
    "Collecting 100% of traces at scale is cost-prohibitive and overwhelms networks. Head Sampling makes a sampling decision at the ingress gateway before data collection; Tail-Based Sampling buffers entire traces across nodes and samples based on whether an error or high latency occurred.",
    `// Sampling Comparison Matrix:
// 1. Head Sampling (Probabilistic / Rate-Limiting):
//    - Decision made at root span (e.g. sample 5% of requests randomly).
//    - Pros: Low memory overhead, simple, zero buffering at collectors.
//    - Cons: Misses rare intermittent 500 errors and p99 latency spikes occurring on non-sampled traces!

// 2. Tail-Based Sampling (OpenTelemetry Collector):
//    - All microservices emit 100% spans to an OTel Collector cluster.
//    - Collector buffers all spans belonging to a traceId until the trace completes.
//    - Decision made at the tail: "Did any span return HTTP 5xx or take > 1500ms? If YES, keep 100% of trace. If normal, sample only 1%."

// OpenTelemetry Collector Tail-Based Sampling Configuration (otel-collector.yaml):
/*
processors:
  tail_sampling:
    decision_wait: 10s # Wait 10s for slow spans to arrive
    num_traces: 50000
    expected_new_traces_per_sec: 2000
    policies:
      # Policy 1: Always retain errors
      - name: drop-errors
        type: status_code
        status_code: { status_codes: [ERROR] }
      # Policy 2: Retain slow requests (p99 latency analysis)
      - name: latency-policy
        type: latency
        latency: { threshold_ms: 1000 }
      # Policy 3: Sample remaining healthy traffic at 2%
      - name: probabilistic-healthy
        type: probabilistic
        probabilistic: { sampling_percentage: 2.0 }
*/`,
    ["Tail Sampling", "Head Sampling", "OTel Collector", "Trace Retention", "Cost Optimization"],
    [
      { title: "OpenTelemetry Collector Tail Sampling Processor", url: "https://github.com/open-telemetry/opentelemetry-collector-contrib/tree/main/processor/tailsamplingprocessor" }
    ],
    "Why is Head Sampling ineffective for diagnosing rare production bugs in high-throughput services?",
    "If a service handles 50,000 req/sec and an error occurs once every 10,000 requests (0.01% error rate), a 5% head sampling rule will capture the bug only 5% of the time. Engineers will spend weeks waiting for a trace of the failure to be randomly retained.",
    "What architectural challenge does Tail-Based Sampling introduce to the monitoring infrastructure?",
    "Stateful buffering. The OTel Collector cluster must route all spans sharing the same `trace_id` to the same collector pod using load-balancing exporters (consistent hashing), and hold spans in memory until the trace completes before making a retention decision."
  ),

  card(
    90,
    "Structured JSON Logging & Correlation IDs",
    "Observability",
    "Mastery",
    "Unstructured plaintext string logs (e.g., `console.log('User logged in')`) are impossible for automated log aggregation pipelines to parse reliably. Production microservices enforce structured JSON logging with correlation IDs, timestamps, and log levels.",
    `// Structured Logging Architecture using Pino (Node.js):
import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";

// AsyncLocalStorage maintains correlation context across async calls without parameter drilling
export const requestStorage = new AsyncLocalStorage<{ correlationId: string; userId?: string }>();

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label) => ({ level: label.toUpperCase() })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin() {
    // Automatically inject active correlationId into EVERY log statement
    const store = requestStorage.getStore();
    return {
      correlation_id: store?.correlationId || "SYSTEM",
      user_id: store?.userId
    };
  }
});

// Express Correlation Middleware:
export function correlationMiddleware(req, res, next) {
  const correlationId = req.headers["x-correlation-id"] || crypto.randomUUID();
  res.setHeader("X-Correlation-Id", correlationId);

  requestStorage.run({ correlationId, userId: req.headers["x-user-id"] }, () => {
    logger.info({ route: req.path, method: req.method }, "Incoming HTTP Request");
    next();
  });
}`,
    ["Structured Logging", "Pino", "Correlation ID", "AsyncLocalStorage", "JSON Logs"],
    [
      { title: "Pino High-Performance Logging", url: "https://getpino.io/#/" }
    ],
    "Why must microservices log exclusively to standard output (`stdout`) rather than writing to local log files?",
    "Per the Twelve-Factor App methodology (Factor XI), applications should not manage log storage. The container runtime (Docker, containerd) captures `stdout` and forwards streams to cluster log shippers (Fluentbit, Vector), decoupling applications from disk management and log rotation.",
    "What is the difference between a Correlation ID and a Trace ID?",
    "A Correlation ID is an application-level identifier (often generated by edge gateways or frontend clients) used primarily for log filtering. A Trace ID is a standardized cryptographic identifier adhering to W3C TraceContext specifications, mapping parent-child causal relationships across spans."
  ),

  card(
    91,
    "Prometheus Metric Instrumentation: The 4 Core Types",
    "Observability",
    "Mastery",
    "Prometheus collects metrics via a pull model, scraping `/metrics` endpoints. Application microservices instrument their code using four foundational metric types: Counter, Gauge, Histogram, and Summary.",
    `// Instrumenting Microservices with prom-client (Node.js):
import client from "prom-client";

// Collect default OS and Node.js process metrics (GC, event loop lag, memory)
client.collectDefaultMetrics();

// 1. Counter: Monotonically increasing value (Resets only on restart)
export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total count of HTTP requests handled",
  labelNames: ["method", "route", "status_code"]
});

// 2. Gauge: Value that fluctuates up and down (Current state)
export const activeWebSocketConnections = new client.Gauge({
  name: "active_websocket_connections",
  help: "Number of active concurrent WebSocket clients",
  labelNames: ["gateway_node"]
});

// 3. Histogram: Samples observations in configurable bucket ranges (Duration & Latency)
export const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request latency distributions",
  labelNames: ["route", "method"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0] // Latency buckets in seconds
});

// Middleware measuring HTTP RED metrics:
export function prometheusMetricsMiddleware(req, res, next) {
  const start = process.hrtime();
  
  res.on("finish", () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    const route = req.route?.path || req.path;

    httpRequestsTotal.inc({ method: req.method, route, status_code: res.statusCode });
    httpRequestDurationSeconds.observe({ route, method: req.method }, durationSeconds);
  });

  next();
}`,
    ["Prometheus", "Counter", "Gauge", "Histogram", "prom-client"],
    [
      { title: "Prometheus Metric Types", url: "https://prometheus.io/docs/concepts/metric_types/" }
    ],
    "Why must you calculate request rates using the PromQL `rate()` function on Counters rather than using a Gauge?",
    "A Gauge tracking requests per second loses data during scrapes and cannot handle container restarts. The PromQL `rate()` function operates on monotonically increasing Counters, automatically detecting process resets and calculating per-second averages over any rolling window.",
    "What is the operational difference between a Histogram and a Summary in Prometheus?",
    "A Histogram groups observations into server-side buckets, allowing aggregation across multiple instances (e.g. cluster-wide p99 latency via `histogram_quantile`). A Summary calculates percentiles on the client instance itself, making its percentiles impossible to aggregate across multiple pods."
  ),

  card(
    92,
    "The RED & USE Monitoring Methodologies",
    "Observability",
    "Mastery",
    "Engineering teams rely on two standardized frameworks to guide microservice monitoring: the RED Method (for user-facing request-driven services) and the USE Method (for infrastructure and underlying resources).",
    `// 1. The RED Method (Request-Driven Microservices):
// Developed by Tom Wilkie. Evaluates external consumer experience:
// - Rate: Number of requests per second (promql: sum(rate(http_requests_total[1m])))
// - Errors: Number of failed requests per second (promql: sum(rate(http_requests_total{status_code=~"5.."}[1m])))
// - Duration: Amount of time requests take (promql: histogram_quantile(0.99, sum(rate(http_request_duration_seconds_bucket[5m])) by (le)))

// 2. The USE Method (Resource & Infrastructure Capacity):
// Developed by Brendan Gregg. Evaluates internal machine resources (CPU, Memory, Disk, Sockets):
// - Utilization: Percentage of time the resource was busy (e.g. CPU at 82%)
// - Saturation: Degree to which extra work is queued (e.g. Thread pool queue depth, Linux load average)
// - Errors: Count of internal resource error events (e.g. Network interface packet drops, disk ECC errors)

export class HealthScorecard {
  static evaluateServiceHealth(red: { rate: number; errorRate: number; p99DurationMs: number }) {
    if (red.errorRate > 0.05) return "CRITICAL: Error rate exceeded 5%";
    if (red.p99DurationMs > 1000) return "WARNING: High tail latency > 1s";
    return "HEALTHY";
  }
}`,
    ["RED Method", "USE Method", "PromQL", "Monitoring Framework", "Latency SLA"],
    [
      { title: "The RED Method: Microservice Monitoring", url: "https://www.weave.works/blog/the-red-method-of-service-monitoring/" }
    ],
    "Why should dashboard designers prioritize the RED Method over CPU utilization for user-facing services?",
    "Users do not care if your CPU is at 95% if requests return in 20ms with 0% errors. Conversely, if an external database lock causes all requests to time out, CPU may sit idle at 5% while the user experience is entirely destroyed. RED directly measures customer impact.",
    "How does 'Saturation' in the USE method serve as an early warning before system failure?",
    "When a resource reaches 100% utilization, subsequent tasks queue up (saturation). Measuring queue lengths (e.g. OS run queues, HTTP connection backlogs) reveals impending latency spikes before outright crashes occur."
  ),

  card(
    93,
    "SLIs, SLOs, SLAs & Error Budget Burn Rates",
    "Reliability",
    "Mastery",
    "Google SRE principles dictate managing reliability via Service Level Indicators (SLI: quantifiable metric), Service Level Objectives (SLO: internal target), and Service Level Agreements (SLA: legal contractual promise). Error Budget Burn Rates trigger alerts before SLOs are breached.",
    `// Mathematical SRE Definitions:
// SLI = (Good Events / Total Events) * 100%
// SLO = Target SLI over a rolling window (e.g., 99.9% successful checkouts over 30 days)
// Error Budget = 100% - SLO = 0.1% allowed failures
// If you handle 10,000,000 requests/month, you can fail 10,000 requests without breaching SLO.

// Multi-Window Multi-Burn-Rate Alerting (Google SRE Standard):
// Alert if budget is consumed too rapidly:
// - 14.4x Burn Rate consumes 100% of budget in 2 days -> Page on-call immediately (1-hour window)!
// - 6x Burn Rate consumes 100% of budget in 5 days -> Page on-call (6-hour window).
// - 1x Burn Rate consumes budget normally -> Low priority ticket.

// PromQL SLI Calculation for 99.9% Availability:
/*
sum(rate(http_requests_total{status!~"5.."}[30d])) 
/ 
sum(rate(http_requests_total[30d])) >= 0.999
*/

// SRE Decision Rule:
export class SREPolicyEngine {
  static evaluateDeploymentSafety(burnRate: number, remainingBudgetPercent: number): boolean {
    if (remainingBudgetPercent <= 0) {
      console.warn("ERROR BUDGET EXHAUSTED: Freeze feature releases! Deploy only reliability fixes.");
      return false;
    }
    if (burnRate > 10) {
      console.warn("CRITICAL BURN: Automated canary rollback triggered.");
      return false;
    }
    return true;
  }
}`,
    ["SLI", "SLO", "SLA", "Error Budget", "Burn Rate Alerting"],
    [
      { title: "Google SRE Book: Service Level Objectives", url: "https://sre.google/sre-book/service-level-objectives/" }
    ],
    "What is the organizational purpose of an Error Budget?",
    "An Error Budget balances development velocity against reliability. It gives engineering teams a formal budget of acceptable failures. When the budget is positive, teams ship features rapidly; when the budget is burned, new releases pause to prioritize resilience and technical debt.",
    "Why are Multi-Window Multi-Burn-Rate alerts superior to simple static threshold alerts (e.g. error rate > 1%)?",
    "Static thresholds either trigger alert fatigue during brief transient blips (10 errors in 1 second during low traffic) or fail to wake engineers when slow, steady errors quietly exhaust the entire monthly budget over 3 days."
  ),

  card(
    94,
    "Continuous Distributed Profiling (eBPF / Parca / Pyroscope)",
    "Performance",
    "Deep Dive",
    "While metrics aggregate numbers and traces map spans, Continuous Profiling captures granular code-level resource utilization (CPU cycles, memory allocations, lock contentions) in production with minimal overhead using Linux kernel eBPF probes.",
    `// Continuous Profiling Topology:
// 1. eBPF Agent (Parca Agent / Pyroscope):
//    - Hooks into Linux perf_event subsystem at 19-100Hz frequency.
//    - Samples stack traces directly from kernel space without instrumenting code or restarting binaries.
//    - Generates Flame Graphs visualizing exact CPU consumption down to function and line numbers.

// Node.js Pyroscope Continuous Profiler Integration:
import Pyroscope from "@pyroscope/nodejs";

Pyroscope.init({
  serverAddress: "http://pyroscope-server.monitoring:4040",
  appName: "order-service.production",
  tags: {
    region: "us-east-1",
    version: "2.4.1"
  }
});

Pyroscope.start();

// What Continuous Profiling reveals in Production that APM Traces cannot:
// Trace says: "POST /orders took 450ms".
// Pyroscope Flamegraph reveals:
// - 320ms spent inside crypto.pbkdf2Sync (Blocking Event Loop!)
// - 80ms spent serializing deep JSON objects
// - 50ms spent waiting on I/O.
// Immediate Action: Switch to asynchronous crypto.pbkdf2!`,
    ["Continuous Profiling", "eBPF", "Flame Graph", "Pyroscope", "CPU Bottlenecks"],
    [
      { title: "Parca: Open Source Continuous Profiling", url: "https://www.parca.dev/docs/overview" }
    ],
    "Why is continuous production profiling preferable to local CPU profiling in staging?",
    "Staging environments rarely replicate real-world traffic distributions, production scale, or non-deterministic garbage collection patterns. Continuous profiling runs 24/7 in production with < 1% CPU overhead, capturing ephemeral performance anomalies as they occur.",
    "What does a 'Flame Graph' represent visually?",
    "The x-axis represents the population of CPU samples (wider boxes consume more CPU time), and the y-axis represents the call stack depth (with parent functions on bottom and called child functions stacked on top)."
  ),

  card(
    95,
    "Alert Fatigue & Actionable Symptom-Based Alerting",
    "Observability",
    "Mastery",
    "Alert fatigue occurs when on-call engineers are inundated with non-actionable, noisy pages for transient blips, causing real catastrophic outages to be ignored. Production monitoring must alert exclusively on symptoms (user impact) backed by executable runbooks.",
    `// Symptom-Based vs Cause-Based Alerting:
// CAUSE-BASED (Bad, High Noise):
// "Alert: Redis CPU is at 88%!" -> (So what? If response latency is 1ms and errors are 0%, do not wake engineers at 3 AM).
// SYMPTOM-BASED (Good, Actionable):
// "Alert: Order Checkout Error Rate > 2% for 5 minutes (Direct Revenue Impact)!"

// Actionable Prometheus Alert Rule with Runbook Link:
/*
groups:
  - name: order_pipeline_alerts
    rules:
      - alert: CheckoutErrorRateHigh
        expr: |
          sum(rate(http_requests_total{route="/v1/checkout", status_code=~"5.."}[5m]))
          /
          sum(rate(http_requests_total{route="/v1/checkout"}[5m])) > 0.02
        for: 3m
        labels:
          severity: page
          tier: critical
        annotations:
          summary: "Checkout error rate is {{ $value | humanizePercentage }}"
          description: "Over 2% of checkout requests are failing with 5xx errors."
          runbook_url: "https://wiki.platform.internal/runbooks/checkout-5xx-triage"
          dashboard_url: "https://grafana.internal/d/order-overview?orgId=1"
*/`,
    ["Alert Fatigue", "Symptom-Based Alerting", "Runbooks", "On-Call", "PagerDuty"],
    [
      { title: "Google SRE: Being On-Call", url: "https://sre.google/sre-book/being-on-call/" }
    ],
    "What criteria must every pageable (wake-up-at-night) alert satisfy?",
    "It must represent an imminent or actual user-facing symptom, require urgent human judgment that cannot be automated, and provide a clear, executable runbook link explaining immediate triage and mitigation steps.",
    "What should be done with an alert that fires repeatedly but requires no human intervention?",
    "It must be deleted or downgraded to an informational ticket. If an alert requires no human action, it is noise; if the action is always the same routine script, it should be automated."
  ),

  card(
    96,
    "High-Cardinality Explosions in Metric Storage",
    "Observability",
    "Deep Dive",
    "High cardinality occurs when a metric label has an unbounded number of unique values (e.g., `user_id`, `email`, or `uuid`). In Prometheus or M3DB, each unique label combination creates a brand-new time series, resulting in severe memory exhaustion and database crashes.",
    `// CATASTROPHIC ANTI-PATTERN: High-Cardinality Metric Label
// import { Counter } from "prom-client";
// const failedLogins = new Counter({
//   name: "failed_logins_total",
//   help: "Count of failed logins",
//   labelNames: ["user_id", "email"] // WRONG! 10,000,000 unique users = 10,000,000 active time series!
// });

// CORRECT PATTERN: Bounded Low-Cardinality Metric Labels
import client from "prom-client";

export const failedLoginsBounded = new client.Counter({
  name: "failed_logins_total",
  help: "Count of failed logins grouped by error type and region",
  labelNames: ["failure_reason", "region"] // Low cardinality (e.g. 5 reasons * 4 regions = 20 series)
});

// To investigate specific user IDs, use Distributed Traces or Structured Logs:
export function logFailedLogin(userId: string, email: string, reason: string, region: string) {
  // 1. Metric gets bounded update
  failedLoginsBounded.inc({ failure_reason: reason, region });

  // 2. High-cardinality metadata is stored safely in structured logs
  logger.warn({
    event: "AUTH_FAILURE",
    user_id: userId,
    email,
    reason,
    region
  }, "Authentication rejected");
}`,
    ["High Cardinality", "Prometheus", "Time Series", "Memory Exhaustion", "Metric Sizing"],
    [
      { title: "Prometheus Cardinality Management", url: "https://prometheus.io/docs/practices/naming/#labels" }
    ],
    "Why does Prometheus crash when unbounded IDs (like UUIDs or IP addresses) are added to metric labels?",
    "Prometheus stores an in-memory inverted index and chunk buffers for every distinct label combination (time series). Generating millions of new series per hour exhausts server RAM, causes hours-long WAL compaction pauses, and brings down the monitoring cluster.",
    "Where should high-cardinality fields (like `order_id` or `credit_card_hash`) be recorded instead of metrics?",
    "Inside Distributed Trace Span Attributes (OTel) or Structured JSON Log Records. Trace stores and log engines (ClickHouse, Elasticsearch) are architected specifically to index high-cardinality text and IDs efficiently."
  )
];

module.exports = { cards };
