const { card } = require("../ms_builder_helper.cjs");

const cards = [
  card(
    61,
    "Service Discovery: Client-Side vs Server-Side Discovery",
    "Networking",
    "Mastery",
    "Service discovery enables dynamic resolution of ephemeral microservice instances as containers scale up, fail, or relocate. Client-Side discovery queries a service registry directly; Server-Side discovery routes through an intermediary load balancer that handles lookup transparently.",
    `// 1. Client-Side Discovery (e.g., Netflix Eureka, Ribbon):
// Client talks to Service Registry directly, caches instance list, and runs local load balancing algorithm.
// Pros: Eliminates intermediate network hop, supports custom smart balancing algorithms.
// Cons: Couples client codebase to registry SDKs across multiple languages (Node.js, Go, Java).

// Client-Side Discovery Implementation (Node.js):
export class ClientSideResolver {
  private instances: string[] = [];

  constructor(private registryClient: RegistryClient, private serviceName: string) {}

  async start() {
    this.instances = await this.registryClient.getHealthyInstances(this.serviceName);
    // Periodically poll or subscribe to registry watch events
    this.registryClient.watch(this.serviceName, (updated) => {
      this.instances = updated;
    });
  }

  // Local Round-Robin load balancer
  private index = 0;
  resolve(): string {
    if (this.instances.length === 0) throw new Error("No healthy instances available");
    const target = this.instances[this.index % this.instances.length];
    this.index++;
    return target;
  }
}

// 2. Server-Side Discovery (e.g., Kubernetes CoreDNS + Kube-Proxy / AWS ALB):
// Client sends request to stable virtual IP / DNS name (e.g. http://order-service:8080).
// In-cluster proxy (iptables/IPVS or Envoy) intercepts and routes to healthy pods.
// Pros: Language-agnostic, zero SDK coupling, simple mental model.
// Cons: Slight network hop or kernel translation overhead.`,
    ["Service Discovery", "Client-Side Discovery", "Server-Side Discovery", "Kubernetes DNS", "Load Balancing"],
    [
      { title: "Service Discovery in Microservices", url: "https://microservices.io/patterns/client-side-service-discovery.html" }
    ],
    "Why has the industry largely shifted from Client-Side Discovery (Netflix Eureka) to Server-Side Discovery (Kubernetes DNS / Service Mesh)?",
    "Client-side discovery requires embedding fat client libraries into every application runtime, creating dependency conflicts and maintenance burden across polyglot microservice fleets. Server-side discovery moves discovery into the platform/network layer, making applications completely language-agnostic.",
    "What problem does client-side caching of service addresses introduce during rapid auto-scaling?",
    "Stale address cache. If an instance terminates before the client's cache TTL expires, the client will attempt to send requests to a dead IP, resulting in TCP connection timeouts or resets."
  ),

  card(
    62,
    "Service Registry Internals: Heartbeats, Leases & Anti-Entropy",
    "Networking",
    "Deep Dive",
    "A Service Registry (Consul, etcd, Zookeeper) is a distributed key-value store maintaining real-time IP and port mappings of active microservices. It utilizes ephemeral leases, periodic TTL heartbeats, and anti-entropy algorithms to purge dead instances.",
    `// HashiCorp Consul Service Registration with HTTP Health Check & TTL Lease:
/*
{
  "service": {
    "name": "payment-service",
    "id": "payment-srv-pod-89a2",
    "tags": ["v2", "secure"],
    "address": "10.244.2.14",
    "port": 9090,
    "check": {
      "id": "payment-http-check",
      "name": "Payment Service HTTP Health",
      "http": "http://10.244.2.14:9090/health",
      "method": "GET",
      "interval": "5s",
      "timeout": "1s",
      "deregister_critical_service_after": "30s"
    }
  }
}
*/

// Node.js Service Agent heartbeat registration loop:
import axios from "axios";

export class ConsulAgentRegistration {
  private heartbeatTimer: NodeJS.Timeout | null = null;

  async register(serviceId: string, port: number) {
    const payload = {
      ID: serviceId,
      Name: "order-service",
      Port: port,
      Check: {
        TTL: "15s",
        Notes: "Microservice sends periodic pulse"
      }
    };

    await axios.put("http://127.0.0.1:8500/v1/agent/service/register", payload);

    // Maintain heartbeat pulse before 15s lease expires
    this.heartbeatTimer = setInterval(async () => {
      try {
        await axios.put(\`http://127.0.0.1:8500/v1/agent/check/pass/service:\${serviceId}\`);
      } catch (err) {
        console.error("Heartbeat pass failed", err);
      }
    }, 5000);
  }
}`,
    ["Service Registry", "Consul", "Heartbeats", "Lease TTL", "Anti-Entropy"],
    [
      { title: "Consul Service Discovery Architecture", url: "https://developer.hashicorp.com/consul/docs/architecture" }
    ],
    "What occurs if the `deregister_critical_service_after` threshold is absent in a registry configuration?",
    "Ghost instances accumulate. If an unhealthy instance crashes hard without cleanly deregistering, the registry marks it critical but retains its record indefinitely, bloating the registry and risking misrouted traffic.",
    "Why must distributed registries rely on consensus algorithms like Raft or Paxos?",
    "To guarantee strong consistency across registry nodes. If split-brain occurs in a network partition, Raft ensures that only the partition retaining a quorum can accept new registrations, preventing conflicting routing topologies.",
    "hard"
  ),

  card(
    63,
    "Service Mesh Architecture: Data Plane vs Control Plane",
    "Networking",
    "Mastery",
    "A Service Mesh decouples operational networking from application code by inserting a sidecar proxy (Data Plane) beside every microservice container, coordinated by a centralized configuration engine (Control Plane).",
    `// Service Mesh Conceptual Topology:
// [ Control Plane (Istiod / Linkerd-Control) ]
//         |             |              |  (Dynamic xDS Configuration push)
//         v             v              v
//   +-----------+ +-----------+  +-----------+
//   | Pod A     | | Pod B     |  | Pod C     |
//   | [App]     | | [App]     |  | [App]     |
//   |   | (IPC) | |   |       |  |   |       |
//   | [Proxy]   | | [Proxy]   |  | [Proxy]   |
//   +-----------+ +-----------+  +-----------+
//         ^             |              ^
//         |=============+==============| (mTLS Data Plane Traffic)

// Responsibilities Breakdown:
// 1. Data Plane (Envoy, Linkerd2-proxy):
//    - High performance C++ / Rust lightweight sidecars
//    - Intercepts all inbound and outbound pod network sockets via iptables
//    - Handles mTLS handshakes, load balancing, circuit breaking, retry budgets
//    - Emits metrics (RED: Rate, Errors, Duration) and distributed trace spans

// 2. Control Plane (Istio / Cilium / Linkerd):
//    - Converts declarative YAML manifests into low-level proxy instructions
//    - Distributes mTLS X.509 cryptographic certificates to proxies
//    - Manages service registry integration and dynamic routing tables`,
    ["Service Mesh", "Data Plane", "Control Plane", "Istio", "Envoy Sidecar"],
    [
      { title: "Istio Service Mesh Architecture", url: "https://istio.io/latest/docs/ops/deployment/architecture/" }
    ],
    "Why is the data plane written in low-level languages like C++ (Envoy) or Rust (Linkerd) rather than Go or Java?",
    "Every incoming and outgoing byte traverses the data plane. Garbage-collected runtimes like Java or Go introduce non-deterministic GC pause latencies and consume hundreds of megabytes of RAM per sidecar, multiplying resource costs across thousands of pods.",
    "What happens to existing inter-service traffic if the Service Mesh Control Plane crashes completely?",
    "Data plane proxies continue functioning uninterrupted using their cached routing configurations and active mTLS certificates. Traffic flows normally until certificate renewal expires or new pods are scheduled that need fresh configuration.",
    "hard"
  ),

  card(
    64,
    "Envoy Proxy: Internal Architecture & xDS Protocol",
    "Networking",
    "Deep Dive",
    "Envoy is an open-source, high-performance L7 proxy designed for service meshes. Its event-driven, non-blocking architecture is dynamically reconfigured in real time using the xDS (Discovery Service) gRPC streaming protocols without process restarts.",
    `// Envoy xDS Dynamic Configuration Protocol Suite:
// 1. LDS (Listener Discovery Service): Informs Envoy which ports/sockets to listen on.
// 2. RDS (Route Discovery Service): Defines HTTP URL route matchers and upstream cluster mappings.
// 3. CDS (Cluster Discovery Service): Defines upstream service pools (health checks, circuit breakers).
// 4. EDS (Endpoint Discovery Service): Supplies the real-time IP addresses of active healthy pods.
// 5. SDS (Secret Discovery Service): Delivers and rotates TLS certificates dynamically.

// Envoy Static Configuration Skeleton:
/*
static_resources:
  listeners:
    - name: ingress_listener
      address:
        socket_address: { address: 0.0.0.0, port_value: 10000 }
      filter_chains:
        - filters:
            - name: envoy.filters.network.http_connection_manager
              typed_config:
                "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                stat_prefix: ingress_http
                route_config:
                  name: local_route
                  virtual_hosts:
                    - name: order_backend
                      domains: ["*"]
                      routes:
                        - match: { prefix: "/orders" }
                          route: { cluster: order_service_cluster }
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
                    socket_address: { address: 127.0.0.1, port_value: 8080 }
*/`,
    ["Envoy", "xDS", "Dynamic Reconfiguration", "Listener", "Cluster Discovery"],
    [
      { title: "Envoy Architecture Overview", url: "https://www.envoyproxy.io/docs/envoy/latest/intro/arch_overview/arch_overview" }
    ],
    "Why is Envoy's xDS protocol superior to static configuration reloads (such as `nginx -s reload`)?",
    "Static reloads tear down socket listeners, fork worker processes, and cause transient connection drops during high-frequency Kubernetes pod churn. xDS streams updates over persistent gRPC connections, updating in-memory routing tables atomically with zero packet loss.",
    "What is the difference between CDS and EDS in Envoy's terminology?",
    "CDS (Cluster Discovery Service) defines the logical upstream service definition and policy (e.g. `order-service`, connection timeouts, TLS settings), while EDS (Endpoint Discovery Service) provides the dynamic list of actual pod IP endpoints belonging to that cluster."
  ),

  card(
    65,
    "Mutual TLS (mTLS) & Cryptographic Identity (SPIFFE/SPIRE)",
    "Security",
    "Mastery",
    "Mutual TLS guarantees that all data in transit between microservices is encrypted and bi-directionally authenticated. SPIFFE (Secure Production Identity Framework for Everyone) establishes a standardized URI identity format (`spiffe://domain/ns/prod/sa/order-service`).",
    `// SPIFFE ID Structure:
// spiffe://trust-domain/workload-identifier
// Example: spiffe://enterprise.mesh/ns/production/sa/payment-service-account

// Istio PeerAuthentication Policy enforcing Strict mTLS:
/*
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT # Rejects all plaintext non-mTLS connections immediately
---
# Istio AuthorizationPolicy: Enforcing least-privilege service-to-service access
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: payment-access-policy
  namespace: production
spec:
  selector:
    matchLabels:
      app: payment-service
  action: ALLOW
  rules:
    - from:
        - source:
            # Only the Order Service cryptographic identity is authorized to call Payment
            principals: ["cluster.local/ns/production/sa/order-service-sa"]
      to:
        - operation:
            methods: ["POST"]
            paths: ["/v1/charges"]
*/`,
    ["mTLS", "SPIFFE", "SPIRE", "Cryptographic Identity", "Zero-Trust"],
    [
      { title: "SPIFFE Standards Documentation", url: "https://spiffe.io/docs/latest/spiffe-about/overview/" }
    ],
    "What is the difference between `PERMISSIVE` and `STRICT` mTLS modes in a service mesh?",
    "`PERMISSIVE` accepts both plaintext HTTP and encrypted mTLS traffic, allowing incremental migration of legacy services without breaking connectivity. `STRICT` enforces cryptographically verified mTLS on 100% of socket connections, instantly rejecting any unauthenticated or plaintext packets.",
    "How does SPIFFE prevent IP-spoofing attacks inside a Kubernetes cluster?",
    "Workload identity is not verified by IP address (which can be reassigned or spoofed). Instead, the SPIFFE Workload API issues short-lived X.509 SVID certificates cryptographically signed by the mesh CA, containing the workload's SPIFFE ID in the certificate Subject Alternative Name (SAN)."
  ),

  card(
    66,
    "Traffic Shifting, Canary Releases & Shadow Routing",
    "Deployment",
    "Mastery",
    "Service mesh enables precise L7 traffic management, decoupling software deployment from release. It routes fractional percentages of production requests to canary versions or mirrors live read traffic ('traffic shadowing') without user impact.",
    `// Istio VirtualService Canary Traffic Split:
// 90% production v1, 10% canary v2
/*
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: order-service-traffic
spec:
  hosts:
    - order-service
  http:
    - route:
        - destination:
            host: order-service
            subset: v1
          weight: 90
        - destination:
            host: order-service
            subset: v2
          weight: 10
---
# Traffic Shadowing (Mirroring): Duplicates 100% of live traffic to dark staging v3
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: recommendation-mirror
spec:
  hosts:
    - recommendation-service
  http:
    - route:
        - destination:
            host: recommendation-service
            subset: v1
      mirror:
        host: recommendation-service
        subset: v2-experimental
      mirrorPercentage:
        value: 100.0
*/`,
    ["Traffic Shifting", "Canary Deployment", "Traffic Mirroring", "Shadow Routing", "Zero-Downtime"],
    [
      { title: "Istio Traffic Management Rules", url: "https://istio.io/latest/docs/concepts/traffic-management/" }
    ],
    "What critical rule must be enforced when configuring Traffic Mirroring (Shadowing) to an experimental microservice?",
    "The experimental microservice MUST NOT execute mutating side-effects (e.g. charging credit cards, sending emails, publishing production business events) or share mutable database tables. Responses from the shadowed instance are discarded by the proxy and never returned to clients.",
    "How does header-based canary routing differ from percentage-based traffic shifting?",
    "Header-based routing directs traffic based on explicit HTTP headers (e.g. `X-Beta-Tester: true` or internal employee cookie), enabling targeted synthetic smoke testing in production before opening percentage-based traffic to general users."
  ),

  card(
    67,
    "Ingress, Mesh & Egress Gateways: Distinct Responsibilities",
    "Networking",
    "Deep Dive",
    "A comprehensive enterprise microservices architecture employs three distinct gateway boundaries: Ingress Gateway (perimeter ingress), Service Mesh (internal lateral east-west), and Egress Gateway (strictly audited egress to third parties).",
    `// Gateway Topology Matrix:
// [Public Internet]
//        |
//   [Ingress Gateway]   <-- Edge TLS termination, OAuth2, WAF, Public DNS
//        |
//   ==================== [Kubernetes Cluster Mesh Boundary] ====================
//        |
//     [Pod A] <====(mTLS East-West)====> [Pod B]
//        |                                 |
//   ============================================================================
//        |
//   [Egress Gateway]    <-- Restricts outgoing VPC traffic, logs external APIs
//        |
//   [Stripe / AWS S3 / Twilio]

// Istio Egress Gateway Configuration (Restricting external Stripe calls):
/*
apiVersion: networking.istio.io/v1alpha3
kind: ServiceEntry
metadata:
  name: stripe-external
spec:
  hosts:
    - api.stripe.com
  ports:
    - number: 443
      name: https
      protocol: HTTPS
  resolution: DNS
  location: MESH_EXTERNAL
---
apiVersion: networking.istio.io/v1alpha3
kind: Gateway
metadata:
  name: istio-egressgateway
spec:
  selector:
    istio: egressgateway
  servers:
    - port:
        number: 443
        name: tls
        protocol: TLS
      hosts:
        - api.stripe.com
      tls:
        mode: PASSTHROUGH
*/`,
    ["Ingress Gateway", "Egress Gateway", "East-West Traffic", "Service Mesh", "Network Isolation"],
    [
      { title: "Istio Egress Gateways Guide", url: "https://istio.io/latest/docs/tasks/traffic-management/egress/egress-gateway/" }
    ],
    "What security risk does an Egress Gateway prevent in a microservices cluster?",
    "Data exfiltration and unauthorized lateral movement. If an attacker injects malicious code or exploits a remote code execution (RCE) flaw in a microservice pod, an Egress Gateway blocks connections to rogue command-and-control servers, ensuring pods only communicate with whitelisted external domains.",
    "What is the difference between North-South traffic and East-West traffic?",
    "North-South traffic flows vertically into or out of the datacenter/cluster (clients accessing the API Gateway or services calling external SaaS). East-West traffic flows laterally between internal microservices within the cluster private network."
  ),

  card(
    68,
    "Fault Injection & Chaos Testing via Service Mesh",
    "Reliability",
    "Mastery",
    "Rather than manually hacking application code with mock delays, a service mesh injects artificial network latency, HTTP errors, and connection resets directly into the data plane to validate system resilience before production outages occur.",
    `// Istio Fault Injection: Simulating Downstream Catastrophes
/*
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: payment-chaos-test
spec:
  hosts:
    - payment-service
  http:
    # 1. Injected Delay: Add 5 seconds fixed delay to 20% of requests
    - fault:
        delay:
          percentage:
            value: 20.0
          fixedDelay: 5s
        abort:
          percentage:
            value: 10.0
          httpStatus: 503
      match:
        - headers:
            x-chaos-testing:
              exact: "enabled"
      route:
        - destination:
            host: payment-service
            subset: v1
    # Standard traffic passes unaffected
    - route:
        - destination:
            host: payment-service
            subset: v1
*/

// Upstream Calling Service Verification:
// If payment takes 5s, order service must trigger its timeout (at 1.5s) and invoke graceful fallback!`,
    ["Fault Injection", "Chaos Engineering", "Resilience Testing", "VirtualService", "Latency Simulation"],
    [
      { title: "Istio Fault Injection Tasks", url: "https://istio.io/latest/docs/tasks/traffic-management/fault-injection/" }
    ],
    "Why is Service Mesh fault injection safer and more reliable than application-level mock libraries?",
    "It tests the exact compiled production artifacts, network stacks, TCP buffers, and sidecar timeouts in realistic staging environments without altering a single line of business code or risking mock logic leaking into production.",
    "What header scoping is recommended when running chaos experiments in multi-tenant or shared staging environments?",
    "Inject faults only when requests contain specific trace headers (e.g. `X-Chaos-Test: true` or synthetic test user IDs). This prevents chaos experiments from disrupting real user testing or QA automation suites."
  ),

  card(
    69,
    "Headless Services & Direct DNS Discovery in Kubernetes",
    "Networking",
    "Deep Dive",
    "A Kubernetes Headless Service (setting `clusterIP: None`) bypasses the kube-proxy virtual IP mechanism. CoreDNS returns an `A` record containing the direct IP addresses of all backing pods, enabling stateful microservices (Kafka, Cassandra, MongoDB) to peer directly.",
    `// Kubernetes Headless Service for a Distributed Cluster:
/*
apiVersion: v1
kind: Service
metadata:
  name: kafka-headless
  namespace: data-platform
spec:
  clusterIP: None # Defines a Headless Service
  selector:
    app: kafka
  ports:
    - port: 9092
      name: broker
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: kafka
  namespace: data-platform
spec:
  serviceName: kafka-headless
  replicas: 3
  template:
    metadata:
      labels:
        app: kafka
    spec:
      containers:
        - name: kafka
          image: confluentinc/cp-kafka:7.4.0
          ports:
            - containerPort: 9092
*/

// DNS Resolution Result inside cluster:
// dig kafka-headless.data-platform.svc.cluster.local
// Returns direct individual Pod IPs:
// 10.244.1.20
// 10.244.2.35
// 10.244.3.88
// Individual pod deterministic DNS:
// kafka-0.kafka-headless.data-platform.svc.cluster.local`,
    ["Headless Service", "Kubernetes DNS", "StatefulSet", "CoreDNS", "Direct Peering"],
    [
      { title: "Kubernetes Headless Services", url: "https://kubernetes.io/docs/concepts/services-networking/service/#headless-services" }
    ],
    "When should a microservice use a Headless Service instead of a standard ClusterIP Service?",
    "When the client needs to communicate directly with specific individual nodes or partitions—such as database clustering, message broker partitions (Kafka brokers), or when using client-side gRPC load balancing (subchannels) rather than L4 kube-proxy round-robin.",
    "Why does standard Kubernetes ClusterIP load balancing break long-lived gRPC connections?",
    "ClusterIP operates at L4 (TCP level). Once a client establishes a persistent HTTP/2 TCP connection to a single pod via kube-proxy, all subsequent gRPC RPCs travel down that single connection, concentrating 100% of the load on one pod regardless of cluster scaling."
  ),

  card(
    70,
    "Microservice Network Segmentation & Zero-Trust Policies",
    "Security",
    "Mastery",
    "By default, Kubernetes networking is flat—any container can establish TCP connections to any other pod across namespaces. Kubernetes NetworkPolicies and eBPF tools (Cilium) enforce micro-segmentation, blocking lateral movement by default.",
    `// Default-Deny-All Ingress & Egress NetworkPolicy (Namespace Lockdown):
/*
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: payments
spec:
  podSelector: {} # Applies to all pods in payments namespace
  policyTypes:
    - Ingress
    - Egress
---
# Explicit Whitelist: Allow Order Service to access Payment Service on Port 8443
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-order-to-payment
  namespace: payments
spec:
  podSelector:
    matchLabels:
      app: payment-service
  policyTypes:
    - Ingress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              kubernetes.io/metadata.name: orders
          podSelector:
            matchLabels:
              app: order-service
      ports:
        - protocol: TCP
          port: 8443
*/`,
    ["NetworkPolicy", "Zero-Trust", "Micro-Segmentation", "Cilium", "eBPF"],
    [
      { title: "Kubernetes Network Policies Guide", url: "https://kubernetes.io/docs/concepts/services-networking/network-policies/" }
    ],
    "What happens if an organization does not apply a Default-Deny NetworkPolicy in production Kubernetes clusters?",
    "Any compromised frontend pod or third-party dependency with remote code execution can scan and connect to internal payment databases, Redis caches, and internal admin microservices across the entire flat cluster network without obstruction.",
    "Why is eBPF (Cilium) replacing iptables for microservice network policy enforcement?",
    "Iptables evaluates rules sequentially (`O(n)` complexity). In large clusters with tens of thousands of pods and rules, iptables packet processing consumes substantial CPU and introduces latency. Cilium compiles BPF bytecode loaded into the Linux kernel with `O(1)` hash map lookups."
  ),

  card(
    71,
    "Envoy Outlier Detection & Circuit Breaking",
    "Reliability",
    "Mastery",
    "Outlier Detection is Envoy's passive health checking mechanism. It dynamically tracks upstream host failures; when a pod exceeds consecutive 5xx error thresholds, Envoy temporarily evicts it from the active load-balancing pool without waiting for active health check probes.",
    `// Envoy DestinationRule with Outlier Detection and Circuit Breaker Limits:
/*
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: inventory-circuit-breaker
spec:
  host: inventory-service
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100 # Maximum TCP connections
      http:
        http1MaxPendingRequests: 50 # Pending requests queue limit
        maxRequestsPerConnection: 10
    outlierDetection:
      consecutive5xxErrors: 3 # Eject after 3 consecutive 5xx failures
      interval: 10s # Scanned every 10 seconds
      baseEjectionTime: 30s # Ejected for 30s, doubles on subsequent ejection
      maxEjectionPercent: 50 # Never eject more than 50% of cluster to prevent total collapse
*/

// Verification behavior:
// If Pod-2 throws 3 consecutive 503s within 10s:
// Envoy sidecars immediately stop sending traffic to Pod-2 for 30 seconds.
// Traffic automatically fails over to healthy Pod-1 and Pod-3!`,
    ["Outlier Detection", "Passive Health Check", "Circuit Breaking", "DestinationRule", "Envoy"],
    [
      { title: "Istio Outlier Detection Reference", url: "https://istio.io/latest/docs/reference/config/networking/destination-rule/#OutlierDetection" }
    ],
    "Why is Outlier Detection (passive) superior to standard active periodic health checks alone?",
    "Active health checks ping endpoints every 10–30s on `/health`. A pod can return 200 OK on its health endpoint while simultaneously throwing 500 errors on complex customer checkout queries. Outlier detection measures real customer traffic and responds instantaneously.",
    "Why must `maxEjectionPercent` be capped at a reasonable threshold (e.g. 50%)?",
    "If an upstream database suffers an intermittent blip, all pods might fail simultaneously. If `maxEjectionPercent` were 100%, Envoy would eject every pod, permanently killing the cluster even after the database recovers."
  ),

  card(
    72,
    "Service Mesh Anti-Patterns & Operational Complexity Tax",
    "Architecture",
    "Deep Dive",
    "Adopting a heavy service mesh prematurely introduces substantial operational tax: increased compute footprint (every pod runs a sidecar), latency degradation (two extra network hops per RPC), complex debugging, and certificate management failures.",
    `// The Service Mesh Complexity Tax Checklist:
// 1. Latency Overhead: Each request undergoes 2 extra proxy hops (Client -> Client Sidecar -> Server Sidecar -> Server).
//    Adds ~1-3ms per inter-service hop. A chain of 5 microservices accumulates 10-15ms pure proxy latency.
// 2. Memory Bloat: If Envoy consumes 80MB RAM per pod, and you run 500 pods = 40GB RAM dedicated solely to sidecar proxies!
// 3. Ambient Mesh / Sidecarless Alternatives:
//    Modern evolution (Cilium Service Mesh, Istio Ambient) moves L4 mTLS and L7 processing into shared per-node ztunnels/waypoint proxies.

export class ServiceMeshAdoptionScorecard {
  static shouldAdopt(metrics: {
    serviceCount: number;
    teamSize: number;
    strictComplianceRequired: boolean; // e.g. FedRAMP/HIPAA zero-trust mTLS
    polyglotLanguagesCount: number;
  }): boolean {
    // If you have 5 services and 3 engineers, a service mesh is an anti-pattern!
    if (metrics.serviceCount < 20 && !metrics.strictComplianceRequired) {
      return false; // Stick to Kubernetes CoreDNS + Ingress Controller
    }
    return metrics.strictComplianceRequired || (metrics.serviceCount >= 25 && metrics.polyglotLanguagesCount > 2);
  }
}`,
    ["Service Mesh Tax", "Ambient Mesh", "Sidecar Overhead", "Anti-Patterns", "Operational Complexity"],
    [
      { title: "Istio Ambient Mesh Explained", url: "https://istio.io/latest/blog/2022/ambient-mesh-intro/" }
    ],
    "Under what organizational conditions is adopting a Service Mesh like Istio considered an anti-pattern?",
    "When the architecture consists of a small number of microservices (< 15–20), all written in a single language, managed by a small team without strict compliance requirements for mutual TLS encryption. The operational burden of managing Istio upgrades, sidecar injection failures, and debugging iptables will exceed the architectural benefits.",
    "How does Istio Ambient Mesh eliminate the memory footprint and sidecar injection headaches of traditional sidecars?",
    "By removing sidecars entirely. Ambient Mesh separates L4 mutual TLS into a shared, lightweight node-level daemon (`ztunnel`) and runs optional L7 Envoy proxies (`waypoint proxies`) only for workloads that explicitly require HTTP routing or L7 telemetry."
  )
];

module.exports = { cards };
