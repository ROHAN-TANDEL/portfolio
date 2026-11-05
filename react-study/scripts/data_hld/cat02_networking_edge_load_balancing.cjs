const { createCard } = require("../hld_builder_helper.cjs");

const cards = [
  createCard({
    idNum: 13,
    category: "Networking, Edge & Load Balancing",
    concept: "DNS Resolution, GeoDNS & Anycast Routing",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does DNS resolution operate from browser to authoritative server, and how do GeoDNS and BGP Anycast route user traffic to the nearest data center?",
    answer: "DNS translates domain names into IP addresses via a recursive resolution hierarchy (Browser Cache -> OS Resolver -> Recursive Resolver -> Root Server -> TLD Server -> Authoritative Nameserver). GeoDNS uses the client's IP to return location-specific IPs, whereas BGP Anycast advertises the same single IP from multiple global data centers, letting Internet routers naturally choose the lowest-latency path.",
    explanation: `Step-by-Step DNS Resolution Pipeline:
1. Browser checks its internal cache, followed by OS resolver cache (/etc/hosts).
2. Request sent to ISP Recursive Resolver (e.g., 8.8.8.8).
3. Resolver asks Root Nameservers ('.') -> returns TLD Nameserver ('.com').
4. Resolver asks TLD Nameserver -> returns Authoritative Nameserver (e.g., 'ns1.cloudflare.com').
5. Authoritative Nameserver returns IP address (with TTL).

GeoDNS vs BGP Anycast:
- GeoDNS (Application-Layer Routing):
  - Inspects DNS query source (EDNS Client Subnet - ECS).
  - Returns a regional IP address (e.g., EU server for Paris user, US-East server for NY user).
  - Drawback: ISP DNS caching can route users to suboptimal locations; DNS failover takes time due to TTL caching.
- BGP Anycast (Network-Layer Routing):
  - Hundreds of Edge POPs across the globe announce the *identical* IPv4/IPv6 IP address via BGP (Border Gateway Protocol).
  - Internet routers automatically route traffic to the topologically closest POP using autonomous system shortest path.
  - Failover is near-instantaneous (BGP route withdrawal) without waiting for DNS TTLs.`,
    code: `/*
BGP Anycast vs Unicast Topology:
Unicast (Unique IP per region):
  User in Tokyo ──(5000 miles)──> 198.51.100.1 (Single Data Center in Virginia)

BGP Anycast (Same IP: 1.1.1.1 advertised globally):
  User in Tokyo  ──(2ms)──> 1.1.1.1 [Tokyo Edge POP]
  User in London ──(1ms)──> 1.1.1.1 [London Edge POP]
  User in NYC    ──(3ms)──> 1.1.1.1 [NYC Edge POP]
*/

// Node.js DNS lookup inspection
import dns from "dns/promises";

async function inspectDns(domain: string) {
  const records = await dns.resolve4(domain, { ttl: true });
  console.log("Resolved IPs with TTLs:", records);
}`,
    recallHint: "Anycast: One IP everywhere, BGP picks shortest path. GeoDNS: Different IPs based on lookup location.",
    interviewTip: "When designing globally distributed apps (like Cloudflare, Google, or Netflix CDN), always recommend BGP Anycast for edge entry points to defeat DDoS attacks and optimize latency.",
    tags: ["dns", "anycast", "geodns", "bgp", "networking", "latency"]
  }),

  createCard({
    idNum: 14,
    category: "Networking, Edge & Load Balancing",
    concept: "Layer 4 (L4) vs Layer 7 (L7) Load Balancing",
    priority: "must-know",
    difficulty: "must-know",
    question: "What are the architectural differences, capabilities, and performance trade-offs between Layer 4 (Transport) and Layer 7 (Application) Load Balancers?",
    answer: "Layer 4 load balancers operate at the transport layer (TCP/UDP), forwarding packets using IP and port without decrypting or inspecting packet payload; they achieve multi-million RPS with near-zero latency. Layer 7 load balancers operate at the application layer (HTTP/HTTPS/gRPC), terminating TLS and inspecting headers, cookies, and paths to enable smart routing, but consume more CPU memory.",
    explanation: `Layer 4 Load Balancing (e.g., AWS NLB, Linux IPVS, HAProxy in TCP mode):
- Operates on IP address and TCP/UDP port tuple (Source IP, Source Port, Dest IP, Dest Port).
- Does NOT terminate TLS or parse HTTP payloads.
- Packet forwarding can be done at kernel level (e.g., eBPF, XDP) or Direct Server Return (DSR).
- Throughput: Tens of millions of packets per second with sub-millisecond overhead.
- Limitation: Cannot route based on HTTP headers, URLs, or cookies.

Layer 7 Load Balancing (e.g., AWS ALB, NGINX, Envoy, Traefik):
- Terminates TLS connection and decrypts HTTP/HTTPS traffic.
- Parses request URL, method, headers, auth tokens, and cookies.
- Capabilities: Content-based routing (/api/v1/users -> User Service, /api/v1/orders -> Order Service), rate limiting, gzip/brotli compression, cookie-based session stickiness.
- Limitation: Higher CPU consumption and latency overhead (~2-10ms) due to TLS decryption and HTTP parsing.`,
    code: `/*
Two-Tier Production Load Balancing Topology:
[ Internet Clients ]
        │
[ Layer 4 LB (AWS NLB / IPVS) ] ── BGP Anycast, Extreme Line-Rate Packet Routing
        ├──> [ Layer 7 LB 1 (Envoy / NGINX) ] ── TLS Termination & Path Routing
        └──> [ Layer 7 LB 2 (Envoy / NGINX) ]
                 ├── /api/auth    ──> [ Auth Microservices ]
                 ├── /api/orders  ──> [ Order Microservices ]
                 └── /static/     ──> [ S3 Storage / CDN ]
*/`,
    recallHint: "L4 routes packets blindly at line speed; L7 inspects HTTP content and routes intelligently.",
    interviewTip: "In modern hyper-scale architectures, propose a hybrid two-tier approach: an L4 load balancer (AWS NLB) at the edge distributing traffic across a fleet of L7 Envoy proxies.",
    tags: ["load-balancer", "layer4", "layer7", "networking", "envoy", "nginx"]
  }),

  createCard({
    idNum: 15,
    category: "Networking, Edge & Load Balancing",
    concept: "Load Balancing Algorithms & Power of Two Choices",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Compare Round Robin, Weighted Least Connections, Consistent Hashing, and the 'Power of Two Random Choices' (P2C) load balancing algorithms.",
    answer: "Round Robin distributes sequentially without considering server load; Weighted Least Connections sends traffic to nodes with fewest active connections; Consistent Hashing routes requests with identical keys to the same node for caching. The 'Power of Two Random Choices' (P2C) randomly picks two nodes and selects the one with lower load, avoiding herd-behavior stampedes with $O(1)$ efficiency.",
    explanation: `Detailed Algorithm Analysis:
1. Round Robin / Weighted Round Robin:
   - Alternates requests evenly: Node 1 -> Node 2 -> Node 3.
   - Flaw: Assumes all requests take equal processing time. If Node 2 receives three heavy reports, it saturates while others sit idle.
2. Least Connections / Weighted Least Response Time:
   - Tracks active TCP/HTTP connections on each backend and sends to lowest.
   - Flaw: In a distributed load balancer fleet, keeping a synchronized global view of active connections across all LB instances requires heavy synchronization.
3. Consistent Hashing:
   - Hashes a request property (e.g., userId or URL) to a ring node.
   - Ideal for maximizing local cache hits.
4. Power of Two Random Choices (P2C) (Michael Mitzenmacher):
   - Pick two random nodes from the pool.
   - Query their active load/queue depth and route to the less loaded one.
   - Remarkable mathematical proof: Exponentially reduces maximum queue backlog from $O(\\log N / \\log \\log N)$ to $O(\\log \\log N)$ without global state coordination.`,
    code: `// Power of Two Random Choices (P2C) Implementation
interface BackendNode {
  id: string;
  activeRequests: number;
}

class P2CLoadBalancer {
  constructor(private nodes: BackendNode[]) {}

  selectNode(): BackendNode {
    if (this.nodes.length === 0) throw new Error("No available nodes");
    if (this.nodes.length === 1) return this.nodes[0];

    // Pick two distinct random indices
    const idx1 = Math.floor(Math.random() * this.nodes.length);
    let idx2 = Math.floor(Math.random() * (this.nodes.length - 1));
    if (idx2 >= idx1) idx2++;

    const node1 = this.nodes[idx1];
    const node2 = this.nodes[idx2];

    // Route to the node with fewer active requests
    return node1.activeRequests <= node2.activeRequests ? node1 : node2;
  }
}`,
    recallHint: "P2C: Pick 2 at random, choose the lighter one. Solves the herd effect effortlessly.",
    interviewTip: "Mentioning the Power of Two Random Choices (used by Envoy and Finagle) instantly signals advanced knowledge of load balancing mathematics.",
    tags: ["load-balancing", "algorithms", "p2c", "round-robin", "least-connections"]
  }),

  createCard({
    idNum: 16,
    category: "Networking, Edge & Load Balancing",
    concept: "Content Delivery Networks (CDN: Push vs Pull, Cache Headers)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do Content Delivery Networks (CDNs) scale static and dynamic asset delivery, and what is the difference between CDN Push and CDN Pull?",
    answer: "A CDN is a globally distributed network of edge Point of Presence (POP) servers that cache content close to end users. CDN Pull fetches assets from the origin on first cache-miss; CDN Push requires the origin to proactively upload assets to the CDN ahead of time. Modern CDNs also accelerate dynamic API traffic via TLS termination and persistent connection reuse.",
    explanation: `CDN Models:
1. CDN Pull (Origin-Pull / Reverse Proxy):
   - Most common architecture.
   - User requests asset from CDN Edge -> CDN misses -> CDN pulls from Origin server -> CDN caches it at edge and returns to user.
   - Best for high-volume sites with fluctuating content.
2. CDN Push (Origin-Push):
   - Origin server directly uploads files to CDN storage (e.g., rsync or S3 push) whenever new versions are built or deployed.
   - Best for large software downloads, game patches, or massive video catalogs where cache misses would overwhelm origin.

Critical HTTP Cache Headers:
- \`Cache-Control: public, max-age=31536000, immutable\`: Perfect for hashed assets (\`bundle.a8f7c9.js\`).
- \`s-maxage\`: Overrides \`max-age\` specifically for shared/CDN caches, keeping browser cache low.
- \`ETag\` & \`If-None-Match\`: Conditional HTTP 304 Not Modified validation.
- \`Stale-While-Revalidate\`: Serve stale cached response instantly while fetching update in the background.`,
    code: `// Express.js Route with Modern CDN Headers
import express from "express";
const app = express();

// Immutable hashed static assets
app.use("/static", express.static("dist", {
  maxAge: "1y",
  immutable: true
}));

// Dynamic API with Stale-While-Revalidate
app.get("/api/products/top", (req, res) => {
  res.set({
    "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
    "ETag": '"v1.4.2-top"'
  });
  res.json({ products: [...] });
});`,
    recallHint: "Pull: Cache on demand at edge. Push: Upload ahead of time. SWR serves fast while updating.",
    interviewTip: "Highlight that CDNs do not just cache images and CSS; they also terminate TLS at the edge and keep persistent warm TCP connections to origins, speeding up dynamic API requests by 200ms+.",
    tags: ["cdn", "caching", "cache-control", "edge", "networking"]
  }),

  createCard({
    idNum: 17,
    category: "Networking, Edge & Load Balancing",
    concept: "Real-Time Transport: WebSockets vs SSE vs Long Polling vs gRPC",
    priority: "must-know",
    difficulty: "must-know",
    question: "Compare WebSockets, Server-Sent Events (SSE), Long Polling, and gRPC streaming across protocol overhead, bidirectionality, and browser support.",
    answer: "WebSockets provide full-duplex bidirectional communication over a single persistent TCP connection with minimal 2-byte framing; Server-Sent Events (SSE) offer unidirectional server-to-client streaming over standard HTTP; Long Polling emulates streaming by repeatedly hanging HTTP requests; gRPC uses HTTP/2 multiplexed streams with Protocol Buffers for high-efficiency inter-service RPCs.",
    explanation: `Protocol Comparison Matrix:
| Protocol | Direction | Transport | Framing Overhead | Auto Reconnect | Best For |
|---|---|---|---|---|---|
| **WebSockets** | Full-Duplex (2-way) | TCP (Upgrade from HTTP/1.1) | 2–10 bytes | Manual implementation | Chat apps, multiplayer gaming, financial order books |
| **SSE** | Unidirectional (Server -> Client) | HTTP/1.1 or HTTP/2 | Text-based ('data: ...\\n\\n') | Built-in via EventSource API | AI LLM token streaming (ChatGPT), live score feeds, notifications |
| **Long Polling** | Unidirectional emulation | Standard HTTP request | Full HTTP headers (1KB+) per message | Manual re-request loop | Legacy environments where WebSockets/SSE are blocked by firewalls |
| **gRPC Streams** | Bi/Unidirectional | HTTP/2 multiplexing | Binary Protobuf | Built-in channel management | High-throughput backend-to-backend microservice streaming |

Scale Considerations for WebSockets:
- 1,000,000 active WebSockets = 1,000,000 open TCP file descriptors on server.
- Requires edge connection brokers (e.g., Redis Pub/Sub, Kafka, or AWS API Gateway WebSocket) to route messages across different backend pods.`,
    code: `// Server-Sent Events (SSE) Endpoint in Node.js (Ideal for AI token streaming)
app.get("/stream-tokens", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  const tokens = ["High-Level", " System", " Design", " Mastery"];
  let index = 0;

  const interval = setInterval(() => {
    if (index < tokens.length) {
      res.write(\`data: \${JSON.stringify({ token: tokens[index++] })}\\n\\n\`);
    } else {
      res.write("event: end\\ndata: [DONE]\\n\\n");
      clearInterval(interval);
      res.end();
    }
  }, 200);
});`,
    recallHint: "WebSockets = 2-way chat; SSE = 1-way notifications & LLM tokens; gRPC = fast backend RPC.",
    interviewTip: "If asked to design an LLM streaming interface or stock price ticker, choose SSE over WebSockets: it runs on standard HTTP/2, traverses corporate firewalls, and includes automatic reconnection.",
    tags: ["websockets", "sse", "long-polling", "grpc", "real-time", "networking"]
  }),

  createCard({
    idNum: 18,
    category: "Networking, Edge & Load Balancing",
    concept: "HTTP/1.1 vs HTTP/2 Multiplexing vs HTTP/3 QUIC",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do HTTP/1.1, HTTP/2, and HTTP/3 handle Head-of-Line (HoL) blocking, and why did HTTP/3 transition from TCP to UDP-based QUIC?",
    answer: "HTTP/1.1 suffers from application Head-of-Line (HoL) blocking (one request per TCP connection at a time). HTTP/2 introduces binary framing and multiplexing multiple concurrent streams over a single TCP connection, but suffers from TCP-level HoL blocking (one lost packet halts all streams). HTTP/3 replaces TCP with UDP-based QUIC, making individual streams completely independent so packet loss in one stream never blocks other streams.",
    explanation: `Evolutionary Mechanics:
1. HTTP/1.1:
   - Synchronous request-response cycle on each TCP socket.
   - Browsers worked around this by opening 6 parallel TCP connections per domain (domain sharding).
2. HTTP/2 (RFC 7540):
   - Single TCP connection per origin.
   - Binary framing layer divides requests into frames with Stream IDs; frames are multiplexed simultaneously.
   - HPACK header compression.
   - The TCP HoL Flaw: TCP requires strictly in-order byte delivery. If packet 3 is dropped on flaky Wi-Fi, the OS kernel blocks all subsequent streams (packets 4, 5, 6) until packet 3 is retransmitted, stalling all requests.
3. HTTP/3 with QUIC (RFC 9000):
   - Built on UDP; reimplements reliability, congestion control, and TLS 1.3 in user-space.
   - Streams are truly independent: a dropped packet on Stream 5 stalls only Stream 5; Streams 1, 2, and 6 continue processing without delay.
   - 0-RTT Connection Establishment: Combines transport and cryptographic handshakes.
   - Connection Migration: When a mobile user switches from Wi-Fi to 5G cellular, the connection survives because QUIC uses Connection IDs rather than (IP, Port) tuples.`,
    code: `/*
Comparison of Head-of-Line (HoL) Blocking:

HTTP/1.1:
[ Request 1 ] ──> [ Blocking Wait ] ──> [ Request 2 ]

HTTP/2 over TCP:
Stream 1 [Frame A] ──┐
Stream 2 [Frame B] ──┼──> [ Single TCP Pipe ] ──> *Packet Drop!* ──> (ALL streams freeze!)
Stream 3 [Frame C] ──┘

HTTP/3 over QUIC/UDP:
Stream 1 [Packet 1] ──> Received ✓
Stream 2 [Packet 2] ──> *Packet Dropped* (Only Stream 2 waits for retransmit!)
Stream 3 [Packet 3] ──> Received ✓ (Zero HoL Blocking across streams!)
*/`,
    recallHint: "HTTP/1 = 1 per conn. HTTP/2 = multiplexed, but TCP blocks on loss. HTTP/3 = UDP/QUIC, independent streams.",
    interviewTip: "Highlight HTTP/3's Connection ID feature for mobile applications: users walking out of their home Wi-Fi into 4G/5G do not suffer socket disconnections or re-authentication.",
    tags: ["http2", "http3", "quic", "networking", "tcp", "udp", "head-of-line-blocking"]
  }),

  createCard({
    idNum: 19,
    category: "Networking, Edge & Load Balancing",
    concept: "TLS Handshake & Termination at the Edge",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Walk through the TLS 1.3 handshake mechanics, explain TLS termination at edge proxies, and describe how TLS resumption achieves 0-RTT/1-RTT latencies.",
    answer: "TLS 1.3 reduces connection negotiation to a 1-RTT handshake (and 0-RTT for resumed sessions) by combining Diffie-Hellman key exchange with the ClientHello. TLS termination decrypts HTTPS traffic at edge load balancers/CDNs, offloading expensive cryptographic math from application servers and routing unencrypted HTTP or lightweight mTLS across internal private networks.",
    explanation: `TLS 1.2 vs TLS 1.3 Handshake:
- TLS 1.2 required 2 full round trips (2-RTT) before application data could be sent:
  ClientHello -> ServerHello + Certificate -> Client Key Exchange -> Finished -> HTTP GET.
- TLS 1.3 streamlines to 1-RTT:
  1. Client sends \`ClientHello\` + list of supported ciphers + Diffie-Hellman Key Share preemptively.
  2. Server responds with \`ServerHello\` + its own Key Share + Encrypted Certificate + Finished.
  3. Client computes symmetric session key and sends encrypted HTTP request immediately.
- 0-RTT Resumption (Early Data):
  Clients that previously connected use a Pre-Shared Key (PSK) to send encrypted application data on the very first packet. Note: 0-RTT is vulnerable to replay attacks; only idempotent GET requests should be allowed.

Edge TLS Termination Benefits:
- Cryptographic offload: AES-GCM and elliptic-curve math are handled by dedicated hardware edge processors.
- Edge inspection: Enables WAF rule evaluation and L7 routing at the perimeter.
- Connection pooling: Edge maintains persistent warm TCP/TLS connections to upstream application backends.`,
    code: `/*
Edge TLS Termination Topology:
[ Mobile Client ]
       │  (Public Internet - TLS 1.3 Encrypted, 1-RTT)
[ Edge Load Balancer (Envoy / Cloudflare) ] ── Terminates TLS, Evaluates WAF
       │  (VPC Private Subnet - Internal mTLS or Plain HTTP)
[ Backend Application Microservices ]
*/`,
    recallHint: "TLS 1.3 = 1-RTT handshake. Terminate at the edge to offload crypto from app servers.",
    interviewTip: "Be sure to mention that internal microservices behind the edge load balancer should still use lightweight mTLS (Mutual TLS) to adhere to Zero Trust security architecture.",
    tags: ["tls", "tls1.3", "encryption", "edge-termination", "zero-trust", "networking"]
  }),

  createCard({
    idNum: 20,
    category: "Networking, Edge & Load Balancing",
    concept: "Reverse Proxy vs Forward Proxy",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the structural and security difference between a Forward Proxy and a Reverse Proxy in enterprise networks?",
    answer: "A Forward Proxy sits in front of clients, mediating outbound requests to the internet to provide anonymity, corporate content filtering, and egress caching; servers cannot see the client's identity. A Reverse Proxy sits in front of backend servers, intercepting inbound requests to provide load balancing, SSL termination, caching, and DDoS defense; clients cannot see backend server IPs.",
    explanation: `Forward Proxy (Client-Facing Gateway):
- Positioned inside a corporate LAN or client network.
- Purpose: Inspects outbound employee internet traffic, blocks malicious domains, enforces DLP (Data Loss Prevention), and caches frequent outbound downloads.
- Perspective: The destination server sees requests coming from the proxy's IP, unaware of individual internal employee laptops.

Reverse Proxy (Server-Facing Gateway):
- Positioned inside the application hosting infrastructure (e.g., NGINX, HAProxy, AWS ALB).
- Purpose:
  - Shield backend application servers from direct internet exposure.
  - Load balance incoming requests across multiple app instances.
  - Terminate TLS/SSL.
  - Compress responses (Gzip/Brotli).
  - Serve static assets and cache API responses.
- Perspective: The client believes the reverse proxy IS the server, completely unaware of the 50 microservices running behind it.`,
    code: `// Minimal NGINX Reverse Proxy Configuration
/*
http {
    upstream backend_nodes {
        server 10.0.1.10:3000;
        server 10.0.1.11:3000;
        server 10.0.1.12:3000;
    }

    server {
        listen 443 ssl;
        server_name api.enterprise.com;

        location / {
            proxy_pass http://backend_nodes;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        }
    }
}
*/`,
    recallHint: "Forward proxy protects/hides clients. Reverse proxy protects/hides servers.",
    interviewTip: "Emphasize that the reverse proxy is the fundamental building block for modern API Gateways, Ingress Controllers, and Service Meshes.",
    tags: ["reverse-proxy", "forward-proxy", "nginx", "load-balancer", "security"]
  }),

  createCard({
    idNum: 21,
    category: "Networking, Edge & Load Balancing",
    concept: "API Gateway Architecture (BFF, Routing, Rate Limiting, Offloading)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What responsibilities belong inside an API Gateway, and how does the Backend-for-Frontend (BFF) pattern prevent client-side chattiness?",
    answer: "An API Gateway acts as the single point of entry for clients, handling cross-cutting concerns: authentication, SSL termination, global rate limiting, request routing, telemetry, and payload transformation. The Backend-for-Frontend (BFF) pattern deploys dedicated gateways per client type (Mobile, Web, IoT), aggregating multiple backend microservice calls into a single tailored payload.",
    explanation: `Core Responsibilities of an API Gateway (Kong, Tyk, AWS API Gateway, Spring Cloud Gateway):
1. Request Routing & Reverse Proxying: Directs \`/orders\` to the Order service and \`/users\` to the User service.
2. Cross-Cutting Security: Validates OAuth2 JWTs and HMAC signatures before forwarding requests internally.
3. Centralized Rate Limiting: Enforces client tiers (Free vs Tier 1 Enterprise quotas).
4. Response Aggregation: Consolidates calls to 4 downstream services into a single unified JSON response.
5. Protocol Translation: Translates public REST/JSON or WebSockets into internal binary gRPC.

The Backend-for-Frontend (BFF) Pattern:
- Problem: Mobile apps on cellular networks suffer high latency from calling 8 separate microservices to render a single home screen. Desktop browsers on broadband have different bandwidth and screen real estate requirements.
- Solution: Maintain a Mobile-BFF and a Web-BFF:
  - Mobile-BFF queries downstream services concurrently and strips unused fields, returning a lightweight, compact JSON payload.
  - Web-BFF returns rich desktop datasets with extensive analytics metadata.`,
    code: `/*
Backend-For-Frontend (BFF) Architecture:

[ Mobile App ] ──> [ Mobile BFF Gateway ] ──┐
                                            ├──> [ User Service ]
[ Web Browser ] ─> [ Web BFF Gateway ]   ───┼──> [ Catalog Service ]
                                            └──> [ Recommendation Service ]
*/

// BFF Aggregator Handler in Node.js
export async function getMobileHomeScreen(userId: string) {
  // Concurrently fetch downstream microservices inside private high-speed network
  const [profile, orders, recommendations] = await Promise.all([
    fetchFromService(\`http://user-svc/users/\${userId}\`),
    fetchFromService(\`http://order-svc/orders/recent?userId=\${userId}&limit=3\`),
    fetchFromService(\`http://rec-svc/recommendations?userId=\${userId}&limit=5\`)
  ]);

  // Return minimal, optimized payload for mobile
  return {
    userName: profile.name,
    avatar: profile.avatarThumbUrl,
    activeOrders: orders.items.map(o => ({ id: o.id, status: o.status })),
    items: recommendations.items
  };
}`,
    recallHint: "Gateway = Single entry point for cross-cutting concerns. BFF = Tailored gateway per device type.",
    interviewTip: "In microservices design, never let mobile clients call 10 microservices directly. Always insert an API Gateway / BFF layer to aggregate data and reduce mobile cellular radio battery drain.",
    tags: ["api-gateway", "bff", "microservices", "routing", "rate-limiting"]
  }),

  createCard({
    idNum: 22,
    category: "Networking, Edge & Load Balancing",
    concept: "Edge Computing & Cloudflare Workers / Lambda@Edge",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Edge Workers execute code at CDN Point of Presence (POP) nodes, and what workloads are best suited for the edge versus central clouds?",
    answer: "Edge computing runs lightweight serverless code (V8 isolates or WebAssembly) directly on CDN edge servers within 10-30ms of end users. It is ideal for low-latency tasks like authentication verification, geo-based redirection, A/B testing header rewriting, bot protection, and personalized HTML rendering, while heavy database transactions remain in central cloud regions.",
    explanation: `V8 Isolates vs Docker Containers:
- Traditional serverless (AWS Lambda in Docker/microVMs): Cold starts take 200ms–2000ms, memory overhead is 128MB+ per instance.
- Edge Workers (Cloudflare Workers, Fastly Compute@Edge, Vercel Edge):
  - Uses Google Chrome V8 Isolates.
  - Cold starts are under 5ms; memory footprint is under 5MB per isolate.
  - Thousands of isolates run concurrently in a single OS process safely isolated via memory sandboxing.

What Belongs at the Edge:
1. Security & Bot Detection: Validating JWT signatures, inspecting IP reputation, blocking scrapers before reaching origin.
2. Geo-Routing & Personalization: Reading user country headers to redirect to localized domains (\`/uk\`, \`/fr\`).
3. Dynamic Header Manipulation & A/B Testing: Splitting traffic 50/50 and modifying request cookies.
4. Edge Caching & Key-Value Lookups: Reading cached responses from edge datastores (Cloudflare KV).

What Does NOT Belong at the Edge:
- Heavy database transactions: Writing to a central PostgreSQL database in Virginia from an edge worker in Singapore introduces 250ms of speed-of-light network latency, defeating the purpose of edge.`,
    code: `// Cloudflare Worker Example (Edge JWT Validation & Routing)
export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response("Unauthorized", { status: 401 });
    }

    const token = authHeader.substring(7);
    const isValid = await verifyJwtAtEdge(token, env.JWT_SECRET);
    if (!isValid) {
      return new Response("Invalid Token", { status: 403 });
    }

    // Rewrite request or forward to origin with enriched user metadata
    const modifiedRequest = new Request(request);
    modifiedRequest.headers.set("X-User-Verified", "true");
    return fetch(modifiedRequest);
  }
};`,
    recallHint: "Edge: V8 isolates at 200+ global locations; perfect for auth, headers, and lightweight routing.",
    interviewTip: "Mention the 'Speed of Light' constraint: moving computation to the edge does not help if the code still has to make synchronous SQL queries to a database 10,000 km away.",
    tags: ["edge-computing", "cloudflare-workers", "serverless", "cdn", "v8-isolates"]
  }),

  createCard({
    idNum: 23,
    category: "Networking, Edge & Load Balancing",
    concept: "Circuit Breaker Pattern (Closed, Open, Half-Open)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Describe the three states of the Circuit Breaker pattern and how it prevents catastrophic cascading failure in distributed microservices.",
    answer: "A Circuit Breaker wraps network calls in a state machine: Closed (normal operation, requests pass through); Open (failure rate exceeds threshold, calls fail fast immediately without making network requests); Half-Open (after a cooldown sleep window, a trial batch of probe requests tests if the downstream service has recovered). This stops failing services from exhausting caller thread pools.",
    explanation: `The Problem It Solves (Cascading Failure):
When Service A calls Service B, and Service B begins timing out (e.g., 5 seconds per request due to database lockups):
- Service A's threads/connection pools become blocked waiting for Service B.
- Incoming traffic to Service A causes thread exhaustion in Service A.
- Upstream callers to Service A now freeze, cascading the outage across the entire company fleet.

The Three States:
1. Closed: Normal operation. Every request is sent over the wire. Successes and failures are tracked in a sliding time window.
2. Open: If error percentage exceeds threshold (e.g., >50% failures over 10 seconds), the breaker trips to OPEN.
   - All subsequent calls fail instantly (returning an immediate error or fallback) without touching the network.
   - Prevents overwhelming the struggling downstream dependency.
3. Half-Open: After a reset timeout (e.g., 30 seconds), the breaker transitions to HALF-OPEN.
   - A limited number of trial (probe) requests are allowed through.
   - If probes succeed -> breaker returns to CLOSED.
   - If any probe fails -> breaker resets to OPEN for another cooldown period.`,
    code: `// Resilient Circuit Breaker State Machine
enum BreakerState { CLOSED, OPEN, HALF_OPEN }

class CircuitBreaker {
  private state = BreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private threshold = 5,
    private cooldownMs = 15000
  ) {}

  async execute<T>(action: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    if (this.state === BreakerState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.cooldownMs) {
        this.state = BreakerState.HALF_OPEN;
      } else {
        return fallback(); // Fail fast!
      }
    }

    try {
      const result = await action();
      if (this.state === BreakerState.HALF_OPEN) {
        this.state = BreakerState.CLOSED;
        this.failureCount = 0;
      }
      return result;
    } catch (err) {
      this.failureCount++;
      this.lastFailureTime = Date.now();
      if (this.failureCount >= this.threshold) {
        this.state = BreakerState.OPEN;
      }
      return fallback();
    }
  }
}`,
    recallHint: "Closed = normal; Open = fail fast (saving downstream); Half-Open = test the waters.",
    interviewTip: "Pair Circuit Breakers with Fallback responses (e.g., return cached data or static defaults) to provide seamless graceful degradation during outages.",
    tags: ["circuit-breaker", "resilience", "microservices", "fault-tolerance", "fail-fast"]
  }),

  createCard({
    idNum: 24,
    category: "Networking, Edge & Load Balancing",
    concept: "Retry Storms, Exponential Backoff & Full Jitter",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why do naive retries create 'Retry Storms' that take down recovering services, and how does Exponential Backoff with Full Jitter mathematically resolve this?",
    answer: "When a service blips, naive immediate retries multiply incoming request volume by 3x–5x simultaneously, delivering a crushing traffic spike that prevents the recovering service from ever coming back up. Exponential backoff progressively increases retry delays ($2^n$), and Full Jitter randomizes the sleep interval across $[0, \\text{delay}]$, decorrelating retries into a smooth traffic stream.",
    explanation: `The Retry Storm Mechanism:
Suppose a service capable of 10,000 RPS experiences a momentary 1-second database freeze:
- 10,000 requests fail.
- If clients immediately retry, the service receives 10,000 new requests + 10,000 retries = 20,000 RPS.
- The service crashes again under double load.
- If clients retry at fixed intervals (e.g., exactly every 1 second), all 10,000 clients retry in lockstep synchronization, causing cyclical wave spikes that continuously knock the service offline.

AWS Full Jitter Algorithm:
Instead of fixed exponential backoff:
$$\\text{temp} = \\min(\\text{cap}, \\text{base} \\times 2^{\\text{attempt}})$$
$$\\text{sleep} = \\text{random}(0, \\text{temp})$$
- By choosing a uniform random value between 0 and the exponential cap, retries are completely decorrelated across the timeline.
- Server queue depth remains flat, and throughput recovers smoothly.`,
    code: `// Exponential Backoff with AWS Full Jitter Implementation
async function fetchWithFullJitter<T>(
  fn: () => Promise<T>,
  maxRetries = 4,
  baseMs = 100,
  capMs = 5000
): Promise<T> {
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= maxRetries) throw err;
      attempt++;

      // Exponential backoff ceiling
      const exponentialDelay = Math.min(capMs, baseMs * Math.pow(2, attempt));
      // Full Jitter: pick random duration between 0 and exponentialDelay
      const jitteredSleep = Math.floor(Math.random() * exponentialDelay);

      console.warn(\`Attempt \${attempt} failed. Sleeping \${jitteredSleep}ms (Full Jitter)\`);
      await new Promise((r) => setTimeout(r, jitteredSleep));
    }
  }
}`,
    recallHint: "Naive retries = DDOS yourself. Jitter breaks the lockstep waves into smooth traffic.",
    interviewTip: "Always mention 'Full Jitter' when discussing retries in system design interviews. Citing AWS Architecture research on jitter demonstrates deep production experience.",
    tags: ["retries", "retry-storm", "exponential-backoff", "jitter", "resilience"]
  })
];

module.exports = cards;
