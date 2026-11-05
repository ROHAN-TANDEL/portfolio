// scripts/data_security/cat06_api_microservices.cjs
const { card } = require('../sec_builder_helper.cjs');

const cat = "API & Microservice Security";

module.exports = [
  card(
    61,
    cat,
    "API Gateway Security Architecture",
    "must-know",
    "intermediate",
    "What core security responsibilities does an API Gateway centralize to protect internal microservice topologies?",
    "An API Gateway acts as the single entry point (Reverse Proxy & Policy Enforcement Point) that offloads cross-cutting security concerns: TLS termination, centralized JWT validation, IP allowlisting, global rate limiting, WAF inspection, and request sanitization before traffic reaches backend microservices.",
    "Without a gateway, each microservice must independently implement rate limiting, CORS, JWT parsing, and TLS termination, creating vast surface area for configuration drift. The API Gateway: 1) Terminates public client connections with hardened TLS 1.3; 2) Validates client JWTs, stripping untrusted incoming headers and injecting verified identity headers (e.g. X-User-Id, X-Tenant-Id, X-User-Role); 3) Enforces per-client rate limits and DDoS mitigation; 4) Routes requests over private VPC networks to internal services via mTLS.",
    `// Conceptual API Gateway Header Normalization & Downstream Proxy
// 1. Client sends: Authorization: Bearer <jwt> + spoofed 'X-User-Id: 1'
// 2. Gateway verifies JWT cryptographically using JWKS
// 3. Gateway STRIPS any client-supplied 'X-User-*' headers to prevent spoofing
// 4. Gateway injects verified claims:
//    req.headers['X-User-Id'] = verifiedJwt.sub;
//    req.headers['X-Tenant-Id'] = verifiedJwt.tenant_id;
// 5. Downstream internal microservices trust X-User-Id strictly because
//    they only accept traffic from the private Gateway IP over mTLS!`,
    "Never allow client-supplied internal headers (like X-User-Id) through an API Gateway. The gateway must strip them and inject only cryptographically verified claims.",
    ["api-gateway", "centralized-security", "jwt-offload", "microservices"]
  ),
  card(
    62,
    cat,
    "HMAC Webhook Signatures & Replay Prevention",
    "must-know",
    "intermediate",
    "How does the Stripe/GitHub HMAC webhook signing pattern verify sender authenticity and prevent replay attacks?",
    "The standard webhook signing pattern computes an HMAC-SHA256 signature over the raw request payload concatenated with a timestamp header (t=...,v1=...), requiring the receiver to verify the HMAC and reject timestamps older than 5 minutes.",
    "Webhooks are exposed public HTTP endpoints. An attacker could forge webhook payloads (e.g. fake payment_succeeded) or intercept a valid webhook and replay it 100 times to credit an account repeatedly. Defense requires: 1) Sender passes a timestamp and signature header: Stripe-Signature: t=1614555819,v1=5257a869e43e24...; 2) Receiver extracts timestamp and asserts abs(now - t) < 300 seconds (preventing replay); 3) Receiver computes HMAC-SHA256(\"${t}.${rawBody}\", webhookSecret); 4) Receiver uses crypto.timingSafeEqual to verify matching signatures.",
    `import crypto from 'crypto';

export function verifyWebhook(rawBody: string, signatureHeader: string, secret: string, toleranceSeconds: number = 300) {
  // 1. Parse header components: t=1614555819,v1=5257a...
  const parts = Object.fromEntries(signatureHeader.split(',').map(kv => kv.split('=')));
  const timestamp = parseInt(parts.t, 10);
  const signature = parts.v1;

  // 2. Replay Attack Defense: Reject old timestamps
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > toleranceSeconds) {
    throw new Error("Webhook timestamp expired or in future. Replay attack detected.");
  }

  // 3. Compute expected signature over timestamp + rawBody
  const signedPayload = \`\${timestamp}.\${rawBody}\`;
  const expectedSig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');

  // 4. Constant-Time signature comparison
  if (!crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expectedSig, 'hex'))) {
    throw new Error("Invalid webhook HMAC signature!");
  }
  return true;
}`,
    "Always verify webhooks using the RAW unparsed byte body. Parsing JSON and re-stringifying alters whitespace and key order, breaking cryptographic hash verification.",
    ["webhooks", "hmac-sha256", "replay-prevention", "stripe-pattern"]
  ),
  card(
    63,
    cat,
    "Rate Limiting: Token Bucket vs Leaky Bucket vs Sliding Window",
    "must-know",
    "intermediate",
    "How do Token Bucket, Leaky Bucket, and Sliding Window algorithms compare in mitigating API brute force and DoS attacks?",
    "Token Bucket allows bursts up to bucket capacity while refilling at a constant rate; Leaky Bucket processes requests at a strictly constant rate smoothing traffic; Sliding Window Log / Counter provides smooth boundary limits preventing double-limit bursts at window resets.",
    "Fixed Window counters (e.g. 100 req/min starting at :00) suffer from the boundary burst flaw: a user sends 100 requests at 00:59 and 100 requests at 01:00, delivering 200 requests in 2 seconds without violating the limit. Modern API gateways use Sliding Window algorithms (via Redis Sorted Sets / Lua scripts) or Token Bucket to enforce smooth limits across any rolling window, returning standard HTTP 429 Too Many Requests and Retry-After headers.",
    `// Sliding Window Rate Limiter using Redis Lua Script
const slidingWindowLua = \`
  local key = KEYS[1]
  local now = tonumber(ARGV[1])
  local window = tonumber(ARGV[2])
  local limit = tonumber(ARGV[3])
  
  -- Clear requests older than current sliding window
  redis.call('ZREMRANGEBYSCORE', key, 0, now - window)
  
  -- Count requests in current window
  local current = redis.call('ZCARD', key)
  
  if current < limit then
    redis.call('ZADD', key, now, now)
    redis.call('EXPIRE', key, math.ceil(window / 1000))
    return 1 -- Allowed
  else
    return 0 -- Denied (429)
  end
\`;`,
    "Always return rate limit telemetry headers: X-RateLimit-Limit, X-RateLimit-Remaining, and Retry-After on 429 responses.",
    ["rate-limiting", "token-bucket", "sliding-window", "dos-defense", "redis-lua"]
  ),
  card(
    64,
    cat,
    "Distributed Denial of Service (DDoS): Layer 4 vs Layer 7",
    "must-know",
    "intermediate",
    "What is the difference between Layer 4 (SYN Flood, UDP Reflection) and Layer 7 (HTTP Flood, Rapid Reset) DDoS attacks and how are they mitigated?",
    "Layer 4 (Transport) attacks target network bandwidth and connection state tables using volumetric floods (SYN, UDP, ICMP amplification), mitigated by Anycast routing and SYN Cookies. Layer 7 (Application) attacks target CPU and database resources with valid HTTP requests, mitigated by WAFs, CAPTCHAs, and behavioral rate limits.",
    "In L4 attacks, attackers consume multi-gigabit pipes before traffic reaches servers; Cloudflare / AWS Shield Anycast distributes volumetric traffic across hundreds of global scrubbing centers. In L7 attacks, small volumetric traffic wrecks backend services (e.g., an attacker sends 2,000 req/sec to a heavy /api/search?q=* route that executes 5-table JOINs, maxing database CPU). L7 defenses require: Web Application Firewalls (AWS WAF / Cloudflare), Managed Rulesets, JavaScript cryptographic challenges (Cloudflare Turnstile), and Bot Management.",
    `// Layer 7 DDoS Mitigation Architecture:
// 1. Cloud Anycast CDN absorbs volumetric L4 traffic at edge
// 2. Edge WAF inspects HTTP headers, JA4/JA3 TLS fingerprints
// 3. High-cost computational endpoints (search, export) require:
//    - Authentication & strict rate limits (max 5 req/min)
//    - Proof-of-Work (Turnstile / CAPTCHA) challenge on anomaly
//    - Caching at CDN edge (stale-while-revalidate)`,
    "A 100 Mbps Layer 7 attack on an un-cached SQL endpoint can take down a platform faster than a 100 Gbps Layer 4 UDP flood.",
    ["ddos", "layer4-vs-layer7", "waf", "anycast", "rapid-reset"]
  ),
  card(
    65,
    cat,
    "CORS Misconfigurations & Null Origin Exploits",
    "must-know",
    "intermediate",
    "Why is reflecting the request Origin with Access-Control-Allow-Credentials: true a critical security vulnerability, and how do attackers exploit 'Origin: null'?",
    "Reflecting any incoming Origin header back into Access-Control-Allow-Origin combined with Access-Control-Allow-Credentials: true allows any malicious site on the internet to execute cross-origin authenticated requests and exfiltrate victim user data.",
    "Developers attempting to 'fix CORS errors' often write: res.header('Access-Control-Allow-Origin', req.headers.origin); res.header('Access-Control-Allow-Credentials', 'true');. When a victim visits evil.com, evil.com makes a fetch('https://api.bank.com/user/profile', { credentials: 'include' }). The bank server reflects evil.com as allowed, and the browser allows evil.com's JavaScript to read the victim's full bank profile! Furthermore, attackers use sandboxed IFrames (<iframe sandbox=\"allow-scripts\">) to generate an 'Origin: null' header; if the server whitelists 'null', cross-origin theft succeeds.",
    `// VULNERABLE (Blind Reflection with Credentials):
// res.setHeader('Access-Control-Allow-Origin', req.headers.origin); // EXPLOITABLE!
// res.setHeader('Access-Control-Allow-Credentials', 'true');

// PRODUCTION SECURE (Strict Origin Whitelist):
const ALLOWED_ORIGINS = new Set([
  'https://app.enterprise.com',
  'https://admin.enterprise.com'
]);

export function secureCors(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;

  if (origin && ALLOWED_ORIGINS.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin'); // Prevent cache poisoning!
  }

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.status(204).end();
  }
  next();
}`,
    "Never reflect request.headers.origin blindly with credentials. Always match against a strict hardcoded whitelist, and never whitelist 'null'.",
    ["cors", "cors-misconfiguration", "null-origin", "preflight"]
  ),
  card(
    66,
    cat,
    "Content-Type Sniffing & X-Content-Type-Options: nosniff",
    "must-know",
    "beginner",
    "What is MIME-Type Sniffing and why is the 'X-Content-Type-Options: nosniff' header essential when serving user-uploaded files?",
    "MIME-Type Sniffing occurs when a browser overrides an explicit Content-Type header (e.g. text/plain or image/jpeg) and inspects the raw file bytes to deduce what it believes is the actual format, potentially executing embedded HTML/JavaScript as a webpage.",
    "If an application allows users to upload avatar images and serves an uploaded file containing <script>alert(1)</script> with Content-Type: image/jpeg (or text/plain), older or unconstrained browsers 'sniff' the HTML tags inside the image bytes and render the file as HTML, executing stored XSS. Adding 'X-Content-Type-Options: nosniff' forces the browser to strictly adhere to the declared Content-Type header, refusing to treat images or plain text as executable scripts.",
    `// Express Hardening Header
import helmet from 'helmet';

// Adds X-Content-Type-Options: nosniff to all responses
app.use(helmet.noSniff());

// When serving user-uploaded assets:
app.get('/files/:id', async (req, res) => {
  const file = await getFile(req.params.id);
  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('X-Content-Type-Options', 'nosniff'); // MANDATORY!
  res.setHeader('Content-Disposition', 'attachment; filename="download.dat"'); // Force download
  res.send(file.buffer);
});`,
    "Always set 'X-Content-Type-Options: nosniff' on all HTTP responses, and serve user-uploaded untrusted files from an isolated secondary domain (e.g. usercontent-company.com).",
    ["nosniff", "mime-sniffing", "content-type", "file-upload-security"]
  ),
  card(
    67,
    cat,
    "GraphQL Security: Query Depth Limiting & Complexity Analysis",
    "must-know",
    "intermediate",
    "Why are GraphQL APIs inherently vulnerable to DoS attacks via recursive nested queries, and how do depth limiting and complexity analysis defend them?",
    "GraphQL allows clients to request arbitrary nested relational shapes (e.g. author -> books -> author -> books). An attacker can craft a deeply recursive or cyclic query that forces the server to execute millions of database queries, causing Denial of Service.",
    "In REST, endpoints return fixed shapes. In GraphQL, a single 2KB payload like query { author { books { author { books { author { books ... } } } } } } causes exponential resolver execution. GraphQL defenses require: 1) Query Depth Limiting (graphql-depth-limit): reject queries exceeding N levels (e.g. max depth 6); 2) Query Cost / Complexity Analysis: assign computational point values to fields and reject queries exceeding a threshold (e.g. max complexity 1000); 3) Disable Introspection in production (preventing schema discovery); 4) Enforce Persisted Queries (clients send query hashes, not raw GraphQL strings).",
    `import depthLimit from 'graphql-depth-limit';
import { createComplexityLimitRule } from 'graphql-validation-complexity';
import { ApolloServer } from '@apollo/server';

const server = new ApolloServer({
  schema,
  introspection: process.env.NODE_ENV !== 'production', // Disable introspection in prod
  validationRules: [
    depthLimit(6), // Reject queries nested deeper than 6 levels
    createComplexityLimitRule(1000, {
      onCost: (cost) => console.log('Query complexity score:', cost)
    })
  ]
});`,
    "Never deploy an open GraphQL endpoint to production without depth limiting and complexity analysis. Persisted queries provide the strongest defense.",
    ["graphql-security", "query-depth", "query-complexity", "introspection-disabled"]
  ),
  card(
    68,
    cat,
    "gRPC Security: Protocol Buffers Validation & Interceptors",
    "must-know",
    "intermediate",
    "How is security enforced in gRPC microservices using Protocol Buffers validation, metadata interceptors, and mTLS?",
    "gRPC security relies on HTTP/2 transport encryption via mTLS, metadata interceptors (for propagating JWT auth context across RPC calls), and protoc-gen-validate (PGV) / buf build rules to enforce strict field-level schema validation on binary Protobuf payloads.",
    "Because gRPC communicates over binary HTTP/2 frames, standard web firewalls cannot inspect raw payloads without HTTP/2 gRPC parsers. Security best practices: 1) Transport: mandate mTLS for all gRPC connections; 2) Authentication: pass Bearer tokens inside gRPC Metadata (metadata.MD) and inspect via Unary/Streaming Server Interceptors; 3) Input Validation: Protobuf by default allows any data within primitive types; using buf.validate or protoc-gen-validate enforces constraints (e.g. string email = 1 [(buf.validate.field).string.email = true]) directly at the compiler level.",
    `// gRPC Server Interceptor for JWT Authentication
import * as grpc from '@grpc/grpc-js';

export function authInterceptor(
  call: grpc.ServerUnaryCall<any, any>,
  callback: grpc.sendUnaryData<any>,
  next: Function
) {
  const metadata = call.metadata.get('authorization');
  const token = metadata[0]?.toString()?.replace('Bearer ', '');

  if (!token || !verifyInternalServiceToken(token)) {
    return callback({
      code: grpc.status.UNAUTHENTICATED,
      details: "Invalid or missing gRPC authorization token"
    });
  }

  next(call, callback);
}`,
    "gRPC operates over HTTP/2. Use server interceptors as the equivalent of Express middleware to assert metadata authentication on every RPC method call.",
    ["grpc-security", "protobuf", "grpc-interceptors", "microservices-security"]
  ),
  card(
    69,
    cat,
    "Shadow APIs & Zombie Endpoints",
    "must-know",
    "intermediate",
    "What are Shadow APIs and Zombie Endpoints, and how do they create severe security blind spots in evolving microservice architectures?",
    "Shadow APIs are undocumented, unmonitored endpoints deployed without central security oversight; Zombie Endpoints are legacy, deprecated API versions (e.g. /v1/auth) that remain online and unmaintained after /v2 is released, lacking modern security patches.",
    "Zombie endpoints are ranked #9 on the OWASP API Security Top 10. When an organization updates an API to /v2 to patch a vulnerability (e.g. adding MFA or rate limiting), engineers frequently leave the old /v1 container running to maintain backwards compatibility for legacy mobile apps. Attackers discover /v1 through old documentation or GitHub history and execute exploits against the unpatched logic. Mitigations: 1) Automated OpenAPI/Swagger documentation generated from code; 2) API Gateways actively auditing and sunsetting inactive endpoints; 3) Returning 410 Gone on deprecated versions.",
    `// Enforcing API Deprecation & Sunset via HTTP Headers (RFC 8594)
export function sunsetMiddleware(req: Request, res: Response, next: NextFunction) {
  // Inform clients that v1 is deprecated and will terminate on specified date
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', 'Wed, 31 Dec 2026 23:59:59 GMT');
  res.setHeader('Link', '<https://api.enterprise.com/v2>; rel="successor-version"');

  // Once sunset date passes, return 410 GONE permanently!
  const sunsetDate = new Date('2026-12-31T23:59:59Z');
  if (new Date() > sunsetDate) {
    return res.status(410).json({
      error: "Gone",
      message: "API v1 has been permanently decommissioned. Migrate to /v2."
    });
  }
  next();
}`,
    "Always set hard sunset dates for legacy API endpoints. Leaving /v1 running indefinitely provides an open door to attackers.",
    ["shadow-apis", "zombie-endpoints", "owasp-api-9", "api-deprecation"]
  ),
  card(
    70,
    cat,
    "Service-to-Service Authentication: SPIFFE/SPIRE & SVIDs",
    "advanced",
    "advanced",
    "How does SPIFFE/SPIRE solve the secret zero problem and automate cryptographic identity attestation for distributed microservices?",
    "SPIFFE (Secure Production Identity Framework for Everyone) defines a standard for issuing cryptographically verifiable identities (SPIFFE IDs) to workloads via short-lived X.509 or JWT SVIDs (SPIFFE Verifiable Identity Documents) automated by the SPIRE runtime engine.",
    "Traditional microservice auth relies on shared API tokens or long-lived static secrets embedded in environment variables—creating the 'Secret Zero' problem (how to securely deliver the first secret). SPIRE solves this through Workload Attestation: 1) The SPIRE Agent queries the underlying OS kernel (cgroups, Docker container ID, Kubernetes service account); 2) The Agent verifies the workload matches expected attributes without relying on any shared secret; 3) The Agent issues a short-lived (e.g. 1-hour) X.509 SVID; 4) Services establish mutual TLS automatically using short-lived SVIDs, rotating certificates continuously.",
    `// SPIFFE ID Format:
// spiffe://<trust-domain>/<workload-path>
// Example: spiffe://enterprise.org/ns/prod/sa/payment-worker

// Access Control Policy based on SPIFFE Identity in Envoy:
/*
action: ALLOW
rules:
  - when:
      - key: source.principal
        values: ["spiffe://enterprise.org/ns/prod/sa/order-service"]
# Payment service accepts incoming connections ONLY if caller's
# X.509 SVID matches the authenticated order-service SPIFFE identity!
*/`,
    "SPIFFE/SPIRE completely eliminates hardcoded service passwords and API keys, replacing them with kernel-attested, continuously rotated mTLS certificates.",
    ["spiffe", "spire", "svid", "secret-zero", "workload-identity"]
  ),
  card(
    71,
    cat,
    "Idempotency Keys & Distributed Transaction Deduplication",
    "must-know",
    "intermediate",
    "How do Idempotency Keys prevent duplicate charges and race conditions during network retries in payment and mutation APIs?",
    "An Idempotency Key is a unique client-supplied token (e.g. in the Idempotency-Key header) that allows the server to recognize duplicate requests and return the cached original response without re-executing the underlying state mutation.",
    "If a network connection drops after an API server charges a credit card but before the HTTP 200 response reaches the client, the client or payment SDK automatically retries the request. Without idempotency, the customer is billed twice. Defense pattern: 1) Server receives POST with Idempotency-Key: req_123; 2) Server attempts atomic SETNX idempotency:req_123 in Redis; 3) If key already exists with status 'completed', server returns saved response immediately; 4) If key is in-flight, server returns 409 Conflict; 5) If key is new, server executes transaction and stores result with a 24-hour TTL.",
    `import { Redis } from 'ioredis';
const redis = new Redis();

export async function processPaymentWithIdempotency(key: string, amount: number, chargeFn: Function) {
  const cacheKey = \`idempotency:\${key}\`;

  // 1. Acquire atomic reservation lock
  const acquired = await redis.set(cacheKey, JSON.stringify({ status: 'PROCESSING' }), 'EX', 120, 'NX');

  if (!acquired) {
    const existing = JSON.parse(await redis.get(cacheKey) || '{}');
    if (existing.status === 'COMPLETED') {
      return existing.result; // Return cached result without re-billing!
    }
    throw new Error("Concurrent duplicate request in-flight");
  }

  // 2. Execute mutation
  const chargeResult = await chargeFn(amount);

  // 3. Store completed result with 24-hour retention
  await redis.setex(cacheKey, 86400, JSON.stringify({ status: 'COMPLETED', result: chargeResult }));

  return chargeResult;
}`,
    "Always require an Idempotency-Key on non-idempotent HTTP methods (POST, PATCH) for financial, billing, or state-changing distributed operations.",
    ["idempotency", "deduplication", "payment-security", "distributed-systems"]
  ),
  card(
    72,
    cat,
    "WebSocket Security: Origin Validation & Frame Floods",
    "must-know",
    "intermediate",
    "What unique security risks affect WebSockets (Cross-Site WebSocket Hijacking / CSWSH) and how are handshakes hardened?",
    "Cross-Site WebSocket Hijacking (CSWSH) occurs when an attacker's website initiates a WebSocket connection to a target server, automatically including the victim's ambient browser cookies because WebSockets are not restricted by the Same-Origin Policy during handshake.",
    "Unlike standard AJAX fetch calls, the browser's Same-Origin Policy does NOT prevent cross-origin WebSocket handshakes (new WebSocket('wss://bank.com/stream')). If the server authenticates the WebSocket solely via session cookies, evil.com can open a bi-directional socket, listen to real-time account data, and emit trading commands! Mitigations: 1) Mandatory Origin Header Check: reject handshake if req.headers.origin !== 'https://app.bank.com'; 2) Ephemeral Ticket Authentication: require a short-lived, one-time ticket passed as a query param or auth protocol header, rather than ambient cookies; 3) Enforce frame size limits to prevent memory exhaustion.",
    `import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ noServer: true });

export function handleUpgrade(req: any, socket: any, head: any) {
  const origin = req.headers.origin;
  const ALLOWED_ORIGIN = 'https://app.enterprise.com';

  // 1. Cross-Site WebSocket Hijacking (CSWSH) Defense: Validate Origin Header
  if (origin !== ALLOWED_ORIGIN) {
    socket.write('HTTP/1.1 403 Forbidden\\r\\n\\r\\n');
    socket.destroy();
    return;
  }

  // 2. Validate one-time ticket from URL query string
  const url = new URL(req.url, 'https://localhost');
  const ticket = url.searchParams.get('ticket');
  if (!ticket || !validateOneTimeTicket(ticket)) {
    socket.write('HTTP/1.1 401 Unauthorized\\r\\n\\r\\n');
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    wss.emit('connection', ws, req);
  });
}`,
    "Never rely on ambient browser cookies to authenticate WebSockets without strict Origin header validation. Use short-lived one-time connection tickets.",
    ["websockets", "cswsh", "origin-validation", "realtime-security"]
  )
];
