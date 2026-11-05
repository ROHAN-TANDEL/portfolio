// scripts/examples_security/part4_recipes_31_to_40.cjs
module.exports = [
  {
    id: "sec-ex-31",
    title: "GraphQL Query Depth Limiter & Introspection Disabler",
    category: "API & Microservice Security",
    difficulty: "intermediate",
    whatThisCodeCovers: "Hardening Apollo Server by disabling schema introspection in production and rejecting deeply nested queries using graphql-depth-limit.",
    conceptsCovered: ["GraphQL Security", "Depth Limiting", "Introspection Disabling", "DoS Prevention"],
    code: `// lib/graphql/server.ts
import { ApolloServer } from '@apollo/server';
import depthLimit from 'graphql-depth-limit';
import { typeDefs, resolvers } from './schema';

const isProduction = process.env.NODE_ENV === 'production';

export const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  // 1. Disable Introspection in production to prevent schema scraping
  introspection: !isProduction,
  // 2. Reject queries nested deeper than 5 levels (stops recursive denial of service)
  validationRules: [
    depthLimit(5, {}, (depths) => {
      if (depths > 5) {
        console.warn(\`[Security Alert] Blocked GraphQL query with depth \${depths}\`);
      }
    })
  ]
});`,
    breakdown: [
      "introspection: false stops automated scanners discovering undocumented fields and mutations.",
      "depthLimit(5) parses query AST and rejects queries exceeding 5 levels of nesting.",
      "Protects backend resolvers and databases from recursive entity expansion attacks."
    ],
    expectedOutput: "Rejects deeply nested queries like user { friends { friends { ... } } } with validation error."
  },
  {
    id: "sec-ex-32",
    title: "gRPC Mutual TLS (mTLS) Server & Interceptor Setup",
    category: "API & Microservice Security",
    difficulty: "advanced",
    whatThisCodeCovers: "Configuring a Node.js gRPC server with strict Mutual TLS (mTLS) certificate verification and unary authentication interceptors.",
    conceptsCovered: ["gRPC Security", "mTLS", "Client Certificates", "Unary Interceptor", "HTTP/2"],
    code: `// server/grpcServer.ts
import * as grpc from '@grpc/grpc-js';
import fs from 'fs';

// 1. Load CA, server cert, and private key
const rootCert = fs.readFileSync('/etc/ssl/internal-ca.pem');
const serverCert = fs.readFileSync('/etc/ssl/server.pem');
const serverKey = fs.readFileSync('/etc/ssl/server-key.pem');

// 2. Mutual TLS Credentials: checkClientCertificate = true enforces client mTLS!
const credentials = grpc.ServerCredentials.createSsl(
  rootCert,
  [{ cert_chain: serverCert, private_key: serverKey }],
  true // Enforce client certificate validation!
);

const server = new grpc.Server();

// 3. Unary Interceptor for Metadata Authorization
function authInterceptor(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
  next: Function
) {
  const metadata = call.metadata.get('authorization');
  const token = metadata[0]?.toString()?.replace('Bearer ', '');

  if (!token || token !== process.env.INTERNAL_SERVICE_SECRET) {
    return callback({
      code: grpc.status.UNAUTHENTICATED,
      details: 'Invalid or missing inter-service authorization token'
    });
  }

  next(call, callback);
}

server.bindAsync('0.0.0.0:50051', credentials, (err, port) => {
  if (err) throw err;
  console.log(\`[gRPC] mTLS Server listening on port \${port}\`);
});`,
    breakdown: [
      "createSsl with true enforces bidirectional client certificate authentication.",
      "Validates client certificate against trusted internal CA before accepting RPC frames.",
      "Unary interceptor asserts internal service bearer token as an added defense-in-depth layer."
    ],
    expectedOutput: "Listens on port 50051; rejects non-mTLS or unauthenticated gRPC clients."
  },
  {
    id: "sec-ex-33",
    title: "API Deprecation Sunset Header Injector (RFC 8594)",
    category: "API & Microservice Security",
    difficulty: "beginner",
    whatThisCodeCovers: "Injecting standardized RFC 8594 Sunset and Deprecation headers to communicate API retirement and return HTTP 410 Gone post-sunset.",
    conceptsCovered: ["RFC 8594", "Sunset Header", "Deprecation Header", "Zombie API Defense", "HTTP 410"],
    code: `// middleware/sunsetApi.ts
import { Request, Response, NextFunction } from 'express';

interface DeprecationConfig {
  sunsetDate: Date;
  successorUrl: string;
}

export function createSunsetMiddleware(config: DeprecationConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = new Date();

    // 1. If past sunset date, permanently shut down endpoint with HTTP 410 GONE!
    if (now >= config.sunsetDate) {
      res.setHeader('Sunset', config.sunsetDate.toUTCString());
      return res.status(410).json({
        error: 'Gone',
        message: 'This API version has been permanently decommissioned.',
        documentation: config.successorUrl
      });
    }

    // 2. Active deprecation phase: Inform callers via standard RFC 8594 headers
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', config.sunsetDate.toUTCString());
    res.setHeader('Link', \`<\${config.successorUrl}>; rel=\"successor-version\"\`);

    next();
  };
}`,
    breakdown: [
      "Sets 'Deprecation: true' and 'Sunset: <date>' on deprecated API routes.",
      "Automatically transitions from warning headers to HTTP 410 Gone after sunset date passes.",
      "Eliminates zombie API endpoints that remain online unmaintained."
    ],
    expectedOutput: "Returns Deprecation/Sunset headers before retirement; returns HTTP 410 Gone post-sunset."
  },
  {
    id: "sec-ex-34",
    title: "Distributed Idempotency Key Processor in Redis",
    category: "API & Microservice Security",
    difficulty: "advanced",
    whatThisCodeCovers: "A robust idempotency wrapper executing transactions exactly once, caching results, and returning cached responses on retries.",
    conceptsCovered: ["Idempotency", "Redis SETNX", "Distributed Locking", "Financial Transactions"],
    code: `// lib/security/idempotency.ts
import { Redis } from 'ioredis';

const redis = new Redis();

export async function withIdempotency<T>(
  idempotencyKey: string,
  ttlSeconds: number = 86400, // 24 hours
  operation: () => Promise<T>
): Promise<T> {
  const cacheKey = \`idempotency:\${idempotencyKey}\`;

  // 1. Attempt atomic lock reservation
  const acquired = await redis.set(cacheKey, JSON.stringify({ status: 'PROCESSING' }), 'EX', 60, 'NX');

  if (!acquired) {
    const existingRaw = await redis.get(cacheKey);
    const existing = existingRaw ? JSON.parse(existingRaw) : null;

    if (existing?.status === 'COMPLETED') {
      return existing.data as T; // Return cached response from previous successful run!
    }
    throw new Error('Concurrent request with identical idempotency key in progress');
  }

  try {
    // 2. Execute business mutation
    const result = await operation();

    // 3. Cache completed result for 24h
    await redis.setex(cacheKey, ttlSeconds, JSON.stringify({
      status: 'COMPLETED',
      data: result
    }));

    return result;
  } catch (err) {
    // Failure: Delete lock so client can retry with same key
    await redis.del(cacheKey);
    throw err;
  }
}`,
    breakdown: [
      "Acquires atomic Redis lock with 60s timeout to handle crash recovery.",
      "Returns saved JSON response directly if request is a duplicate of a completed transaction.",
      "Deletes lock upon operation failure to allow clients to retry safely."
    ],
    expectedOutput: "Executes payment once; returns identical cached result on network retry."
  },
  {
    id: "sec-ex-35",
    title: "Cross-Site WebSocket Hijacking (CSWSH) Origin Guard",
    category: "API & Microservice Security",
    difficulty: "intermediate",
    whatThisCodeCovers: "Securing WebSocket upgrade handshakes against Cross-Site WebSocket Hijacking by validating Origin headers and ephemeral auth tickets.",
    conceptsCovered: ["CSWSH Defense", "WebSocket Upgrade", "Origin Verification", "One-Time Ticket"],
    code: `// server/websocketSecurity.ts
import http from 'http';
import { WebSocketServer } from 'ws';

const ALLOWED_ORIGIN = 'https://app.enterprise.com';
const wss = new WebSocketServer({ noServer: true });

export function attachSecureWebSocketHandler(server: http.Server) {
  server.on('upgrade', (req, socket, head) => {
    const origin = req.headers.origin;

    // 1. Mandatory CSWSH Defense: Validate Origin Header strictly!
    if (!origin || origin !== ALLOWED_ORIGIN) {
      console.warn(\`[Security Alert] Blocked unauthorized WebSocket upgrade from origin: \${origin}\`);
      socket.write('HTTP/1.1 403 Forbidden\\r\\n\\r\\n');
      socket.destroy();
      return;
    }

    // 2. Validate one-time connection ticket from query string
    const url = new URL(req.url || '', 'https://localhost');
    const ticket = url.searchParams.get('ticket');

    if (!ticket || !validateOneTimeTicket(ticket)) {
      socket.write('HTTP/1.1 401 Unauthorized\\r\\n\\r\\n');
      socket.destroy();
      return;
    }

    // 3. Complete upgrade
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });
}

function validateOneTimeTicket(ticket: string): boolean {
  // Verifies and atomically burns single-use ticket in Redis
  return ticket.length === 64;
}`,
    breakdown: [
      "Inspects Origin header before completing HTTP upgrade to WebSocket protocol.",
      "Blocks cross-origin handshakes that attempt to hijack ambient browser session cookies.",
      "Requires short-lived, single-use connection ticket passed via query string."
    ],
    expectedOutput: "Approves valid app.enterprise.com connections; terminates unauthorized cross-origin sockets."
  },
  {
    id: "sec-ex-36",
    title: "HSTS & Preload Security Header Configuration",
    category: "Network & Infrastructure Hardening",
    difficulty: "beginner",
    whatThisCodeCovers: "Configuring production Strict-Transport-Security (HSTS) headers with 2-year max-age, subdomains, and preload directives.",
    conceptsCovered: ["HSTS", "SSL Stripping", "Preload List", "Transport Security"],
    code: `// middleware/hsts.ts
import { Request, Response, NextFunction } from 'express';

export function hstsMiddleware(req: Request, res: Response, next: NextFunction) {
  // Only set HSTS header on HTTPS connections
  if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
    res.setHeader(
      'Strict-Transport-Security',
      [
        'max-age=63072000',      // 2 years in seconds
        'includeSubDomains',     // Enforce across *.enterprise.com
        'preload'                // Qualifies for Chrome/Safari browser preload list
      ].join('; ')
    );
  }
  next();
}`,
    breakdown: [
      "Sets 2-year (63,072,000s) cache lifetime for browser automatic HTTPS upgrade.",
      "includeSubDomains enforces HTTPS encryption across all enterprise subdomains.",
      "preload directive meets all submission requirements for hstspreload.org."
    ],
    expectedOutput: "Injects Strict-Transport-Security: max-age=63072000; includeSubDomains; preload."
  },
  {
    id: "sec-ex-37",
    title: "Clickjacking Defense with X-Frame-Options & frame-ancestors CSP",
    category: "Network & Infrastructure Hardening",
    difficulty: "beginner",
    whatThisCodeCovers: "Blocking UI redressing and clickjacking by setting modern frame-ancestors CSP and legacy X-Frame-Options headers.",
    conceptsCovered: ["Clickjacking", "X-Frame-Options", "frame-ancestors", "IFrame Defense"],
    code: `// middleware/antiClickjacking.ts
import { Request, Response, NextFunction } from 'express';

export function antiClickjackingMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Modern standard: CSP frame-ancestors 'none' (blocks all iframe embedding)
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'none'"
  );

  // 2. Legacy fallback for older browsers: X-Frame-Options DENY
  res.setHeader('X-Frame-Options', 'DENY');

  next();
}`,
    breakdown: [
      "Sets 'frame-ancestors none' to forbid embedding in any external or internal iframe.",
      "Sets 'X-Frame-Options: DENY' for legacy browser backwards compatibility.",
      "Neutralizes invisible overlay button-hijacking attacks completely."
    ],
    expectedOutput: "Browser refuses to render page within <iframe> elements."
  },
  {
    id: "sec-ex-38",
    title: "Hardened Multi-Stage Distroless Dockerfile with Non-Root User",
    category: "Container & Cloud Security",
    difficulty: "intermediate",
    whatThisCodeCovers: "A hardened production Dockerfile utilizing Google Distroless base image, non-root user UID 65532, and zero extraneous shell utilities.",
    conceptsCovered: ["Distroless", "Multi-Stage Build", "Non-Root User", "Container Hardening", "CVE Reduction"],
    code: `# Dockerfile.hardened
# Stage 1: Build & Dependencies
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build

# Stage 2: Minimal Distroless Runner (No shell, no package manager, non-root UID 65532)
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app

# Copy built application and production dependencies
COPY --from=builder --chown=nonroot:nonroot /app/dist ./dist
COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules
COPY --from=builder --chown=nonroot:nonroot /app/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=3000

# Non-root user 65532 is active by default in :nonroot tag
USER nonroot
EXPOSE 3000

CMD ["dist/server.js"]`,
    breakdown: [
      "Multi-stage build eliminates devDependencies and source files from production image.",
      "Distroless image lacks /bin/sh and /bin/bash, disabling remote shell spawning.",
      "Runs as unprivileged nonroot user UID 65532."
    ],
    expectedOutput: "Produces an ultra-lightweight (~110MB) hardened container image with zero shell binaries."
  },
  {
    id: "sec-ex-39",
    title: "Kubernetes Restricted PodSecurity Admission Manifest",
    category: "Container & Cloud Security",
    difficulty: "intermediate",
    whatThisCodeCovers: "A production Kubernetes pod manifest adhering to the Restricted Pod Security Standard (runAsNonRoot, readOnlyRootFilesystem, drop ALL capabilities).",
    conceptsCovered: ["Pod Security Standards", "runAsNonRoot", "readOnlyRootFilesystem", "drop ALL", "SecurityContext"],
    code: `# pod-hardened.yaml
apiVersion: v1
kind: Pod
metadata:
  name: hardened-api-workload
  namespace: production
spec:
  # 1. Disable automatic injection of Kubernetes API token
  automountServiceAccountToken: false
  
  # 2. Pod-level security context
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    runAsGroup: 10001
    fsGroup: 10001
    seccompProfile:
      type: RuntimeDefault

  containers:
  - name: api
    image: enterprise/api:v1.0.0
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL # Drop all 40+ Linux kernel capabilities!
    volumeMounts:
    - mountPath: /tmp
      name: memory-scratch
  
  volumes:
  # In-memory scratch space for temporary files with noexec
  - name: memory-scratch
    emptyDir:
      medium: Memory
      sizeLimit: 64Mi`,
    breakdown: [
      "runAsNonRoot: true prevents running as UID 0 (root).",
      "readOnlyRootFilesystem: true prevents modifying binaries or downloading malware to disk.",
      "capabilities.drop: ['ALL'] strips all superuser kernel powers.",
      "emptyDir with medium: Memory provides volatile RAM scratch space."
    ],
    expectedOutput: "Kubernetes schedules pod under strict Restricted PodSecurity profile."
  },
  {
    id: "sec-ex-40",
    title: "Kubernetes Default-Deny NetworkPolicy with Specific Egress",
    category: "Container & Cloud Security",
    difficulty: "intermediate",
    whatThisCodeCovers: "A zero-trust Kubernetes NetworkPolicy enforcing default-deny on all ingress and egress, explicitly allowing only database and DNS traffic.",
    conceptsCovered: ["NetworkPolicy", "Default-Deny", "Egress Filtering", "Zero Trust", "Calico / Cilium"],
    code: `# network-policy-default-deny.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: order-service-zero-trust
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: order-service
  policyTypes:
  - Ingress
  - Egress

  # 1. Ingress: Allow ONLY from API Gateway pod on port 3000
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: api-gateway
    ports:
    - protocol: TCP
      port: 3000

  # 2. Egress: Allow ONLY to Postgres DB pod (port 5432) and CoreDNS (port 53)
  egress:
  # Internal DB connection
  - to:
    - podSelector:
        matchLabels:
          app: postgres-db
    ports:
    - protocol: TCP
      port: 5432
  # Internal Kubernetes DNS resolution
  - to:
    - namespaceSelector: {}
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53`,
    breakdown: [
      "Applies default-deny: any traffic not explicitly listed is dropped by the CNI.",
      "Restricts inbound traffic strictly to the designated api-gateway pod.",
      "Restricts outbound egress strictly to internal Postgres and CoreDNS, blocking reverse shells."
    ],
    expectedOutput: "Blocks unauthorized inter-pod communications and prevents arbitrary outbound internet access."
  }
];
