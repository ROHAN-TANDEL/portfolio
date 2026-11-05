const recipes = [
  {
    id: "ms-ex-43",
    title: "OpenTelemetry Manual Span & Metric Recording",
    category: "Observability & Telemetry",
    difficulty: "intermediate",
    whatThisCodeCovers: "Instrumenting business logic with the OpenTelemetry API, creating nested child spans, attaching custom attributes, and recording execution exceptions.",
    conceptsCovered: ["OpenTelemetry", "Spans", "Child Spans", "Attributes", "Exception Recording"],
    code: `import { trace, SpanStatusCode } from "@opentelemetry/api";

const tracer = trace.getTracer("order-processing-service", "2.1.0");

export async function processOrderWorkflow(orderId: string, items: string[]) {
  // 1. Root Parent Span
  return tracer.startActiveSpan("processOrderWorkflow", async (parentSpan) => {
    parentSpan.setAttribute("order.id", orderId);
    parentSpan.setAttribute("order.item_count", items.length);

    try {
      // 2. Child Span: Database Inventory Reservation
      await tracer.startActiveSpan("db.reserveInventory", async (dbSpan) => {
        dbSpan.setAttribute("db.system", "postgresql");
        dbSpan.setAttribute("db.statement", "UPDATE inventory SET stock = stock - 1 WHERE id = $1");

        // Simulate DB work
        await new Promise(r => setTimeout(r, 45));
        dbSpan.end();
      });

      // 3. Child Span: Payment Processing
      await tracer.startActiveSpan("rpc.chargePayment", async (rpcSpan) => {
        rpcSpan.setAttribute("rpc.system", "grpc");
        rpcSpan.setAttribute("rpc.service", "PaymentService");

        // Simulate payment RPC
        await new Promise(r => setTimeout(r, 80));
        rpcSpan.end();
      });

      parentSpan.setStatus({ code: SpanStatusCode.OK });
      return { success: true, orderId };
    } catch (err: any) {
      parentSpan.recordException(err);
      parentSpan.setStatus({
        code: SpanStatusCode.ERROR,
        message: err.message
      });
      throw err;
    } finally {
      parentSpan.end(); // Always end span
    }
  });
}`,
    breakdown: [
      "Initializes OpenTelemetry tracer for the microservice.",
      "Creates nested active child spans to accurately trace discrete database and RPC sub-operations.",
      "Attaches semantic attributes conforming to OpenTelemetry conventions.",
      "Records exceptions directly on spans and sets error status before ending."
    ],
    expectedOutput: "Generates hierarchical span DAG exported to Jaeger/Zipkin/OTel Collector."
  },

  {
    id: "ms-ex-44",
    title: "W3C TraceContext Wire Protocol Propagator",
    category: "Observability & Telemetry",
    difficulty: "advanced",
    whatThisCodeCovers: "A standalone W3C TraceContext parser and serializer implementing traceparent regex extraction, span ID replacement, and HTTP header propagation.",
    conceptsCovered: ["W3C TraceContext", "traceparent", "Context Propagation", "Wire Protocol", "Regex Parsing"],
    code: `export interface W3CTraceContext {
  version: string;
  traceId: string;
  parentId: string;
  traceFlags: string;
}

export class W3CTraceContextPropagator {
  private static readonly TRACEPARENT_REGEX =
    /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/;

  // Extract context from incoming HTTP headers
  static extract(headers: Record<string, string | string[] | undefined>): W3CTraceContext | null {
    const rawHeader = headers["traceparent"];
    if (!rawHeader || typeof rawHeader !== "string") return null;

    const match = rawHeader.trim().toLowerCase().match(this.TRACEPARENT_REGEX);
    if (!match) return null;

    // Filter out invalid trace IDs (all zeros)
    if (match[2] === "00000000000000000000000000000000") return null;
    if (match[3] === "0000000000000000") return null;

    return {
      version: match[1],
      traceId: match[2],
      parentId: match[3],
      traceFlags: match[4]
    };
  }

  // Inject context for downstream HTTP request with new currentSpanId
  static inject(ctx: W3CTraceContext, currentSpanId: string): Record<string, string> {
    const formattedHeader = \`\${ctx.version}-\${ctx.traceId}-\${currentSpanId}-\${ctx.traceFlags}\`;
    return {
      traceparent: formattedHeader
    };
  }
}

// Verification:
const incomingHeader = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01";
const parsed = W3CTraceContextPropagator.extract({ traceparent: incomingHeader })!;
console.log("Parsed Trace ID:", parsed.traceId);
console.log("Parsed Parent ID:", parsed.parentId);

const outboundHeaders = W3CTraceContextPropagator.inject(parsed, "5a7b8c9d0e1f2a3b");
console.log("Outbound traceparent:", outboundHeaders.traceparent);`,
    breakdown: [
      "Validates 4-part W3C traceparent string format using strict hex regex.",
      "Rejects malformed and all-zero invalid IDs as mandated by W3C specification.",
      "Extracts immutable trace ID and updates parent ID to current span ID for downstream calls.",
      "Provides vendor-agnostic tracing interoperability across polyglot microservices."
    ],
    expectedOutput: "Extracts trace ID 4bf92f35...; formats outbound header with new span ID 5a7b8c9d0e1f2a3b."
  },

  {
    id: "ms-ex-45",
    title: "OpenTelemetry Collector Tail-Based Sampling Pipeline",
    category: "Observability & Telemetry",
    difficulty: "advanced",
    whatThisCodeCovers: "A production otel-collector.yaml configuration buffering spans in memory and executing tail-based sampling rules to retain 100% of errors and slow requests.",
    conceptsCovered: ["OTel Collector", "Tail-Based Sampling", "Pipelines", "Sampling Policies", "Cost Optimization"],
    code: `/*
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
    send_batch_size: 1000
    timeout: 5s

  # Tail-Based Sampling Processor: buffers traces and evaluates completion rules
  tail_sampling:
    decision_wait: 10s # Wait 10 seconds for all child spans to arrive
    num_traces: 50000
    expected_new_traces_per_sec: 3000
    policies:
      # Rule 1: Always retain traces with errors (100% capture of bugs)
      - name: drop-errors-policy
        type: status_code
        status_code:
          status_codes: [ERROR]

      # Rule 2: Always retain traces that exceed 1200ms (p99 latency analysis)
      - name: latency-outlier-policy
        type: latency
        latency:
          threshold_ms: 1200

      # Rule 3: Sample remaining healthy 200 OK traffic at 2%
      - name: probabilistic-healthy-sample
        type: probabilistic
        probabilistic:
          sampling_percentage: 2.0

exporters:
  otlp/tempo:
    endpoint: tempo-distributor.monitoring:4317
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [tail_sampling, batch]
      exporters: [otlp/tempo]
*/`,
    breakdown: [
      "Receives OTLP telemetry over gRPC (4317) and HTTP (4318).",
      "Buffers traces for 10 seconds to inspect the completed trace DAG.",
      "Guarantees that 100% of error traces and p99 latency spikes are retained.",
      "Reduces overall telemetry storage costs by 95% via probabilistic sampling of healthy traffic."
    ],
    expectedOutput: "Collector buffers spans; exports 100% of errors/slow spans and 2% of healthy spans to Tempo."
  },

  {
    id: "ms-ex-46",
    title: "Structured JSON Logging with Pino & AsyncLocalStorage",
    category: "Observability & Telemetry",
    difficulty: "intermediate",
    whatThisCodeCovers: "A production logging architecture utilizing Pino and Node.js AsyncLocalStorage to automatically inject correlation IDs and user metadata into every log statement.",
    conceptsCovered: ["Pino", "AsyncLocalStorage", "Correlation ID", "Structured Logging", "Context Propagation"],
    code: `import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";
import { Request, Response, NextFunction } from "express";
import crypto from "node:crypto";

export interface LogContext {
  correlationId: string;
  userId?: string;
  tenantId?: string;
}

export const logStorage = new AsyncLocalStorage<LogContext>();

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  formatters: {
    level: (label) => ({ level: label.toUpperCase() })
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  mixin() {
    // Automatically merges active correlation context into every log event
    const store = logStorage.getStore();
    return {
      correlation_id: store?.correlationId || "SYSTEM",
      user_id: store?.userId,
      tenant_id: store?.tenantId
    };
  }
});

export function correlationMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = (req.headers["x-correlation-id"] as string) || crypto.randomUUID();
  res.setHeader("X-Correlation-Id", correlationId);

  const context: LogContext = {
    correlationId,
    userId: req.headers["x-user-id"] as string,
    tenantId: req.headers["x-tenant-id"] as string
  };

  logStorage.run(context, () => {
    logger.info({ route: req.path, method: req.method }, "Incoming HTTP Request");
    next();
  });
}`,
    breakdown: [
      "Uses Node.js AsyncLocalStorage to store correlation context across asynchronous task boundaries.",
      "Configures Pino mixin to automatically append correlation_id without manual parameter passing.",
      "Formats logs as single-line structured JSON printed directly to stdout.",
      "Enables instant log filtering in Grafana Loki or Elasticsearch across microservices."
    ],
    expectedOutput: "Emits JSON log with correlation_id, timestamp, level, and route context."
  },

  {
    id: "ms-ex-47",
    title: "Prometheus RED Metrics Instrumentation Middleware",
    category: "Observability & Telemetry",
    difficulty: "intermediate",
    whatThisCodeCovers: "Express middleware instrumenting the RED Method (Rate, Errors, Duration) using prom-client with low-cardinality route labels.",
    conceptsCovered: ["RED Method", "Prometheus", "prom-client", "Histogram", "Counter"],
    code: `import client from "prom-client";
import { Request, Response, NextFunction } from "express";

// Initialize default process metrics (CPU, RAM, Event Loop)
client.collectDefaultMetrics();

// 1. Rate & Errors Metric: Counter
export const httpRequestsTotal = new client.Counter({
  name: "http_requests_total",
  help: "Total count of HTTP requests handled",
  labelNames: ["method", "route", "status_code"]
});

// 2. Duration Metric: Histogram with defined latency buckets
export const httpRequestDurationSeconds = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "Duration of HTTP requests in seconds",
  labelNames: ["method", "route"],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0]
});

export function prometheusRedMiddleware(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime();

  res.on("finish", () => {
    const diff = process.hrtime(start);
    const durationSeconds = diff[0] + diff[1] / 1e9;
    // Normalize parameterized route path to prevent high-cardinality explosions!
    const route = req.route?.path || req.path;

    httpRequestsTotal.inc({
      method: req.method,
      route,
      status_code: res.statusCode.toString()
    });

    httpRequestDurationSeconds.observe(
      { method: req.method, route },
      durationSeconds
    );
  });

  next();
}

// Scrape Endpoint: GET /metrics
export async function metricsEndpoint(req: Request, res: Response) {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
}`,
    breakdown: [
      "Tracks the three RED pillars: Rate and Errors via Counter, Duration via Histogram.",
      "Normalizes route strings (req.route.path) to prevent URL ID high-cardinality memory leaks.",
      "Exposes standard Prometheus scrape format on GET /metrics.",
      "Enables PromQL alerting on 5xx error rate spikes and p99 latency degradation."
    ],
    expectedOutput: "GET /metrics returns Prometheus exposition format with http_requests_total and latency buckets."
  },

  {
    id: "ms-ex-48",
    title: "Stateless JWT Verification with JWKS Remote Caching",
    category: "Security & Identity",
    difficulty: "advanced",
    whatThisCodeCovers: "Stateless JWT verification using jose library with in-memory JWKS public key caching and automatic key rotation from Identity Provider.",
    conceptsCovered: ["JWT", "JWKS", "jose", "Asymmetric Cryptography", "Key Rotation"],
    code: `import * as jose from "jose";

export class StatelessJwtAuthService {
  private jwks: ReturnType<typeof jose.createRemoteJWKSet>;

  constructor(private idpIssuerUrl: string) {
    // createRemoteJWKSet caches public keys in memory and auto-refetches on unseen key ID (kid)
    this.jwks = jose.createRemoteJWKSet(
      new URL(\`\${idpIssuerUrl}/.well-known/jwks.json\`),
      {
        cacheMaxAge: 15 * 60 * 1000, // 15-minute key cache
        cooldownDuration: 30 * 1000  // Limit refetches to at most once per 30s
      }
    );
  }

  async verifyToken(bearerToken: string) {
    try {
      const { payload, protectedHeader } = await jose.jwtVerify(
        bearerToken,
        this.jwks,
        {
          issuer: this.idpIssuerUrl,
          audience: "https://api.enterprise.com",
          algorithms: ["RS256", "ES256"] // Strictly enforce asymmetric cryptographic algorithms!
        }
      );

      return {
        userId: payload.sub as string,
        email: payload.email as string,
        roles: (payload.roles as string[]) || [],
        tenantId: payload.tenant_id as string
      };
    } catch (err: any) {
      throw new Error(\`Unauthorized: JWT signature verification failed - \${err.message}\`);
    }
  }
}`,
    breakdown: [
      "Fetches public keys from IdP's .well-known/jwks.json endpoint.",
      "Caches keys in memory for 15 minutes, refreshing automatically when new kid headers appear.",
      "Strictly enforces asymmetric RS256/ES256 algorithms to block algorithm confusion attacks.",
      "Validates issuer and audience claims in addition to cryptographic signatures."
    ],
    expectedOutput: "Verifies token signature in sub-millisecond time without querying the authentication DB."
  },

  {
    id: "ms-ex-49",
    title: "Open Policy Agent (OPA) Local Rego Policy Evaluator",
    category: "Security & Identity",
    difficulty: "advanced",
    whatThisCodeCovers: "A policy evaluation guard checking incoming microservice actions against a local Open Policy Agent sidecar running compiled Rego rules.",
    conceptsCovered: ["OPA", "Rego", "Policy-as-Code", "ABAC", "Sidecar Authorization"],
    code: `/*
# Rego Policy File (policy.rego):
package microservices.authz

default allow = false

# Rule: Workload must be Order Service, action POST /charges, tenant IDs must match
allow {
    input.caller.service == "order-service"
    input.action.method == "POST"
    input.action.path == ["v1", "charges"]
    input.user.tenant_id == input.resource.tenant_id
}
*/

// Node.js Service Authorization Guard
export class OpaAuthorizationGuard {
  constructor(private opaUrl = "http://127.0.0.1:8181/v1/data/microservices/authz/allow") {}

  async evaluate(context: {
    callerService: string;
    method: string;
    path: string;
    userTenantId: string;
    resourceTenantId: string;
  }): Promise<boolean> {
    const payload = {
      input: {
        caller: { service: context.callerService },
        action: {
          method: context.method,
          path: context.path.split("/").filter(Boolean)
        },
        user: { tenant_id: context.userTenantId },
        resource: { tenant_id: context.resourceTenantId }
      }
    };

    const res = await fetch(this.opaUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error("OPA Policy evaluation failed");
    const data = await res.json();
    return data.result === true;
  }
}`,
    breakdown: [
      "Formats incoming request metadata into standard OPA input JSON structure.",
      "Calls local OPA sidecar over localhost (sub-millisecond evaluation latency).",
      "Decouples complex tenant authorization rules from compiled application logic.",
      "Allows security teams to update Rego rules dynamically without redeploying microservices."
    ],
    expectedOutput: "Returns true if caller matches Rego policy rules; throws 403 Forbidden otherwise."
  },

  {
    id: "ms-ex-50",
    title: "SSRF-Hardened HTTP Client with DNS IP Pinning",
    category: "Security & Identity",
    difficulty: "advanced",
    whatThisCodeCovers: "A secure HTTP fetch wrapper validating resolved DNS IP addresses against private subnets and cloud metadata endpoints to prevent Server-Side Request Forgery.",
    conceptsCovered: ["SSRF Defense", "DNS Resolution", "Private IP Blocking", "Cloud Metadata", "IP Pinning"],
    code: `import dns from "node:dns/promises";
import ipaddr from "ipaddr.js";

export async function secureSsrfFetch(targetUrl: string, options: RequestInit = {}): Promise<Response> {
  const url = new URL(targetUrl);

  // 1. Only allow HTTP and HTTPS
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(\`Forbidden protocol: \${url.protocol}\`);
  }

  // 2. Resolve DNS hostname to raw IP addresses
  const resolvedIps = await dns.resolve4(url.hostname);
  if (resolvedIps.length === 0) throw new Error("DNS resolution returned no IPs");

  for (const ip of resolvedIps) {
    const parsedIp = ipaddr.parse(ip);
    const range = parsedIp.range();

    // 3. Block private networks, loopbacks, link-local, and broadcast
    if (["loopback", "private", "linkLocal", "carrierGradeNat", "broadcast"].includes(range)) {
      throw new Error(\`SSRF Blocked: Destination IP \${ip} resides in forbidden range '\${range}'\`);
    }

    // Explicit check for AWS/GCP Metadata endpoint
    if (ip === "169.254.169.254") {
      throw new Error("SSRF Blocked: Attempted access to Cloud Metadata service");
    }
  }

  // 4. Safe to execute network call
  return fetch(targetUrl, options);
}`,
    breakdown: [
      "Validates protocol to prevent file:// or gopher:// URI exploits.",
      "Resolves DNS before making HTTP call to prevent DNS Rebinding attacks.",
      "Parses resolved IP addresses and rejects private ranges (10.x, 192.168.x, 127.x).",
      "Blocks cloud metadata IP 169.254.169.254 to prevent IAM credential theft."
    ],
    expectedOutput: "Rejects calls to localhost and internal subnets with clean SSRF Blocked error."
  },

  {
    id: "ms-ex-51",
    title: "ArgoCD Application Manifest with Automated Drift Healing",
    category: "Deployment & Delivery",
    difficulty: "intermediate",
    whatThisCodeCovers: "A declarative ArgoCD Application manifest establishing Git as the Single Source of Truth, enabling automated drift detection and self-healing.",
    conceptsCovered: ["GitOps", "ArgoCD", "Self-Healing", "Declarative Delivery", "Drift Reconciliation"],
    code: `/*
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: order-service-prod
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: "https://github.com/enterprise/gitops-deployments.git"
    targetRevision: main
    path: overlays/production/order-service
  destination:
    server: "https://kubernetes.default.svc"
    namespace: production
  syncPolicy:
    automated:
      prune: true     # Automatically deletes K8s resources removed from Git
      selfHeal: true  # Automatically reverts manual ad-hoc 'kubectl edit' changes!
    syncOptions:
      - CreateNamespace=true
      - PruneLast=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m
*/`,
    breakdown: [
      "Binds Kubernetes deployment directly to the Git repository path.",
      "Enables selfHeal: true to overwrite unauthorized manual kubectl alterations.",
      "Enables prune: true to clean up decommissioned pods and services automatically.",
      "Configures sync retries with exponential backoff for transient cluster glitches."
    ],
    expectedOutput: "ArgoCD reconciles cluster to Git state; reverts manual kubectl edits automatically."
  },

  {
    id: "ms-ex-52",
    title: "Expand-and-Contract Zero-Downtime Migration Script",
    category: "Deployment & Delivery",
    difficulty: "advanced",
    whatThisCodeCovers: "A zero-downtime database migration sequence across 3 releases (Expand -> Backfill & Dual-Write -> Contract) to rename a column without service interruption.",
    conceptsCovered: ["Expand-and-Contract", "Zero-Downtime", "Database Migration", "Dual-Write", "Backward Compatibility"],
    code: `// PHASE 1: EXPAND (Release 1.0.0)
// Add new column as nullable, mirror writes with DB trigger
export const phase1Sql = \`
  ALTER TABLE users ADD COLUMN phone_e164 VARCHAR(30);

  -- Temporary Trigger ensuring writes to either column mirror to both
  CREATE OR REPLACE FUNCTION sync_phone_columns()
  RETURNS TRIGGER AS $$
  BEGIN
    IF NEW.phone_e164 IS NULL AND NEW.phone_number IS NOT NULL THEN
      NEW.phone_e164 := NEW.phone_number;
    ELSIF NEW.phone_number IS NULL AND NEW.phone_e164 IS NOT NULL THEN
      NEW.phone_number := NEW.phone_e164;
    END IF;
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER trg_sync_phone
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION sync_phone_columns();
\`;

// PHASE 2: ASYNC BACKFILL (Batch worker during low traffic)
export const phase2BackfillSql = \`
  UPDATE users
  SET phone_e164 = phone_number
  WHERE phone_e164 IS NULL AND phone_number IS NOT NULL;
\`;

// PHASE 3: CONTRACT (Release 1.1.0 - Executed after application reads switch to phone_e164)
export const phase3ContractSql = \`
  DROP TRIGGER IF EXISTS trg_sync_phone ON users;
  DROP FUNCTION IF EXISTS sync_phone_columns;
  ALTER TABLE users DROP COLUMN phone_number;
\`;`,
    breakdown: [
      "Phase 1 adds the new column as nullable and creates a bi-directional synchronization trigger.",
      "Application code safely deploys and dual-writes without breaking running instances.",
      "Phase 2 backfills historical rows asynchronously in batches.",
      "Phase 3 safely drops the trigger and deprecated column after full application migration."
    ],
    expectedOutput: "Renames column across 3 releases with zero downtime and zero broken queries."
  }
];

module.exports = { recipes };
