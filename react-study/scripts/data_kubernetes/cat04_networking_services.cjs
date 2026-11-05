// scripts/data_kubernetes/cat04_networking_services.cjs
const { card } = require('../k8s_builder_helper.cjs');

const cat = "Networking, Services & Service Mesh";

module.exports = [
  card(
    37,
    cat,
    "The Kubernetes Networking Model & IP-per-Pod Principles",
    "must-know",
    "intermediate",
    "What are the fundamental requirements of the Kubernetes networking model, and why is NAT-less pod-to-pod communication mandatory?",
    "The Kubernetes networking model enforces three core rules: 1) All pods can communicate with all other pods on any node without Network Address Translation (NAT); 2) All nodes can communicate with all pods without NAT; 3) The IP a pod sees as its own is the exact same IP all other pods see it as.",
    "Early container platforms mapped container ports dynamically to host ports (e.g. HostPort 31849 -> Container 80), causing port allocation conflicts and complex routing shims. Kubernetes mandates that every pod gets its own unique, routable IP address from the cluster PodCIDR. This treats containers as first-class citizens on the network, identical to virtual machines: applications can bind to standard well-known ports (80, 443, 5432) without port collisions, and IP addresses remain consistent across all network observers.",
    `// The Kubernetes Networking Invariant:
// Pod A (IP: 10.244.1.15) on Node 1 connects to Pod B (IP: 10.244.2.40) on Node 2
// - Source IP received by Pod B: 10.244.1.15 (NO SNAT!)
// - Destination IP sent by Pod A: 10.244.2.40 (NO DNAT!)
// Handled seamlessly by CNI plugins (Calico, Cilium, AWS VPC CNI) via routing or encapsulation.`,
    "Every pod in Kubernetes has a real IP. You never need to map host ports to avoid port conflicts between two applications running on the same node.",
    ["kubernetes-networking", "ip-per-pod", "cni-model", "no-nat", "podcidr"]
  ),
  card(
    38,
    cat,
    "Service Types: ClusterIP, NodePort, LoadBalancer & ExternalName",
    "must-know",
    "intermediate",
    "How do ClusterIP, NodePort, LoadBalancer, and ExternalName services compare in scope, packet flow, and external accessibility?",
    "ClusterIP exposes the service on an internal-only virtual IP within the cluster; NodePort exposes the service on each node's static IP at a high port (30000-32767); LoadBalancer provisions an external cloud load balancer (AWS NLB, GCP LB); ExternalName maps a service to an external DNS CNAME without proxying.",
    "The service types build progressively on each other: 1) **ClusterIP** is the default foundation: accessible only inside the cluster via virtual IP programmed by kube-proxy; 2) **NodePort** allocates a high-numbered port (e.g. 31234) on every physical node, routing incoming traffic to the ClusterIP; 3) **LoadBalancer** provisions a cloud load balancer whose target group points to the NodePorts; 4) **ExternalName** is purely a CoreDNS CNAME redirection (\`db.production.rds.amazonaws.com\`), performing zero packet proxying.",
    `# Service Type Progression
# 1. Internal Only
apiVersion: v1
kind: Service
metadata:
  name: internal-cache
spec:
  type: ClusterIP
  ports:
  - port: 6379

---
# 2. Public Cloud Load Balancer (AWS NLB)
apiVersion: v1
kind: Service
metadata:
  name: public-web-service
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "external"
    service.beta.kubernetes.io/aws-load-balancer-nlb-target-type: "ip"
spec:
  type: LoadBalancer
  ports:
  - port: 443
    targetPort: 8443
  selector:
    app: public-web`,
    "LoadBalancer is a superset of NodePort, which is a superset of ClusterIP. Creating a LoadBalancer service automatically creates an underlying NodePort and ClusterIP.",
    ["service-types", "clusterip", "nodeport", "loadbalancer", "externalname"]
  ),
  card(
    39,
    cat,
    "EndpointSlices: Overcoming the 1,000 Endpoint Scalability Wall",
    "must-know",
    "advanced",
    "Why did the original Endpoints resource cause control plane network saturation at scale, and how do EndpointSlices solve the 1,000 endpoint wall?",
    "The monolithic Endpoints resource stored all pod IPs for a service in a single API object. When a single pod in a 5,000-pod service changed state, the entire multi-megabyte object was re-serialized and broadcast to all nodes, consuming gigabytes of bandwidth. EndpointSlices break endpoints into discrete 100-pod chunks.",
    "In clusters with large deployments, pod churn (rolling updates, autoscaling) is continuous. In the legacy Endpoints model, every pod restart required kube-apiserver to serialize a massive JSON object and transmit it over Watch streams to kube-proxy on thousands of worker nodes, saturating control plane network interfaces. **EndpointSlices** partition endpoints into batches (default 100 endpoints per slice). When one pod restarts, only a single small 100-endpoint slice is mutated and transmitted, scaling clusters to tens of thousands of pods with minimal network overhead.",
    `# Inspecting EndpointSlices for a large service:
kubectl get endpointslices -l kubernetes.io/service-name=large-api-service

# Output displays multiple slices partitioned by 100:
# NAME                         ADDRESSTYPE   PORTS   ENDPOINTS   AGE
# large-api-service-abc12      IPv4          8080    100         5d
# large-api-service-xyz99      IPv4          8080    100         5d
# large-api-service-45k11      IPv4          8080    42          2d`,
    "EndpointSlices replaced Endpoints as the primary discovery mechanism in Kubernetes 1.21+, enabling massive horizontal scaling for large services.",
    ["endpointslices", "endpoints", "scalability", "kube-proxy", "control-plane-optimization"]
  ),
  card(
    40,
    cat,
    "Ingress Controllers vs Ingress Resource",
    "must-know",
    "intermediate",
    "What is the difference between the Ingress API resource and an Ingress Controller (NGINX, Traefik, HAProxy), and why does an Ingress resource do nothing on its own?",
    "An Ingress resource is merely a declarative configuration manifest defining Layer 7 routing rules (hostnames, paths, TLS certs). An Ingress Controller is the active reverse proxy daemon that monitors the API server and programs NGINX/Envoy to route actual HTTP traffic.",
    "Applying an Ingress manifest (\`kubectl apply -f ingress.yaml\`) without an active Ingress Controller running in the cluster does absolutely nothing; the resource sits dormant in etcd. The Ingress Controller (e.g. ingress-nginx or AWS Load Balancer Controller) is an operator pod that: 1) Watches Ingress, Service, and Secret objects; 2) Dynamically generates reverse proxy configuration files (\`nginx.conf\`) or configures cloud ALBs; 3) Reloads reverse proxy engines in memory without dropping active TCP connections.",
    `# Production Ingress Resource with TLS Termination
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: enterprise-ingress
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
spec:
  ingressClassName: nginx # Targets the active NGINX Ingress Controller!
  tls:
  - hosts:
    - api.enterprise.com
    secretName: api-tls-cert
  rules:
  - host: api.enterprise.com
    http:
      paths:
      - path: /v1
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 8080`,
    "Ingress is just the metadata specification. The Ingress Controller (NGINX, Envoy, Traefik) is the actual software engine executing Layer 7 routing.",
    ["ingress", "ingress-controller", "nginx-ingress", "layer7-routing", "tls-termination"]
  ),
  card(
    41,
    cat,
    "Kubernetes Gateway API: GatewayClass, Gateway & HTTPRoute",
    "must-know",
    "advanced",
    "Why was the Kubernetes Gateway API introduced to succeed the Ingress API, and how does its role-oriented model partition infrastructure, routing, and application concerns?",
    "The Gateway API provides an expressive, extensible, and role-oriented successor to the Ingress API. It decouples infrastructure provisioning from application routing via three distinct resources: GatewayClass (infrastructure provider), Gateway (cluster operator), and HTTPRoute/GRPCRoute (application developer).",
    "The legacy Ingress API had major flaws: it was monolithic (mixing infra IP allocation with developer path routing) and relied on vendor-specific, fragile annotations (\`nginx.ingress.kubernetes.io/*\`) for basic features like header manipulation, canary traffic splitting, and cross-namespace routing. The **Gateway API** introduces clean role separation: 1) **GatewayClass**: Cloud admin defines provider (e.g. Istio or AWS VPC Lattice); 2) **Gateway**: Cluster operator binds listening ports and TLS certs; 3) **HTTPRoute**: Application developers define routing rules and canary traffic splits independently in their own namespaces.",
    `# Gateway API: 90/10 Canary Traffic Splitting Specification
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: payment-canary-route
  namespace: payments
spec:
  parentRefs:
  - name: enterprise-gateway # References shared cluster Gateway
  hostnames:
  - "pay.enterprise.com"
  rules:
  - matches:
    - path:
        type: PathPrefix
        value: /checkout
    backendRefs:
    - name: payment-v1
      port: 8080
      weight: 90 # 90% production traffic
    - name: payment-v2
      port: 8080
      weight: 10 # 10% canary test traffic`,
    "Gateway API replaces annotation spaghetti with native, typed Kubernetes specifications for canary traffic splitting, header rewrites, and cross-namespace routing.",
    ["gateway-api", "httproute", "gatewayclass", "canary-split", "modern-networking"]
  ),
  card(
    42,
    cat,
    "Container Network Interface (CNI): Flannel vs Calico vs Cilium eBPF",
    "must-know",
    "intermediate",
    "What is the CNI (Container Network Interface) specification and how do Flannel, Calico, and Cilium compare in performance and security capabilities?",
    "CNI is the standardized plugin specification that connects container namespaces to the host network. Flannel provides basic VXLAN overlay connectivity; Calico adds high-performance BGP native routing and advanced NetworkPolicies; Cilium uses eBPF bytecode for kernel-level routing, Layer 7 security, and transparent encryption.",
    "Flannel is lightweight but lacks NetworkPolicy support (meaning all pods can talk to all pods unrestricted). Calico uses Linux iptables/IPVS with optional BGP peering (direct unencapsulated wire-speed routing). **Cilium** is the state-of-the-art CNI: it loads eBPF programs directly into Linux socket and traffic control (tc) hooks, completely bypassing iptables, accelerating throughput, providing Layer 7 (HTTP/gRPC/Kafka) NetworkPolicies, and integrating transparent IPsec/WireGuard pod encryption.",
    `// CNI Feature Comparison Matrix:
// Feature               | Flannel    | Calico          | Cilium
// -----------------------------------------------------------------
// Network Policies      | NO         | YES (Layer 3/4) | YES (Layer 3/4/7)
// Implementation        | VXLAN      | BGP / IPIP      | eBPF Socket / XDP
// Kube-Proxy Replace    | NO         | NO              | YES (Full eBPF)
// Observability         | None       | Felix Metrics   | Hubble Service Map
// Encrypted Tunnels     | WireGuard  | WireGuard       | WireGuard / IPsec`,
    "Never deploy Flannel in production if you require security isolation, as Flannel does not enforce Kubernetes NetworkPolicies. Use Calico or Cilium.",
    ["cni", "flannel", "calico", "cilium", "ebpf", "network-plugins"]
  ),
  card(
    43,
    cat,
    "Overlay Networks (VXLAN) vs Flat Routed Networks (AWS VPC CNI / BGP)",
    "advanced",
    "advanced",
    "What are the latency, MTU, and throughput tradeoffs between Overlay Encapsulation (VXLAN/Geneve) and Flat Routed Networks (AWS VPC CNI)?",
    "Overlay networks encapsulate pod Ethernet frames inside UDP packets (VXLAN port 4789), allowing pods to communicate across arbitrary underlying networks at the cost of 50-byte MTU overhead and CPU packet wrapping. Flat routed networks assign real VPC IP addresses to pods, delivering native wire-speed throughput without encapsulation.",
    "In an **Overlay Network** (Flannel/Calico VXLAN): Pod IPs (10.244.x.x) are virtual. Packet from Pod A is encapsulated inside an outer UDP packet by the host kernel, transported across physical switches, and decapsulated at the destination node. This incurs minor CPU overhead and requires lowering MTU (e.g. from 1500 to 1450). In a **Flat Routed Network** (e.g. AWS VPC CNI): pods receive secondary Elastic Network Interface (ENI) private IP addresses directly from the cloud VPC (10.0.x.x). Packets route directly over AWS VPC fabrics at physical 100Gbps line rate with zero encapsulation overhead.",
    `// Overlay vs Flat Routing Packet Flow:
// 1. Overlay (VXLAN):
// [ Outer IP: Node-1 -> Node-2 ][ UDP: 4789 ][ Inner IP: Pod-A -> Pod-B ][ Payload ]
// (Requires MTU reduction and CPU encapsulation/decapsulation cycles)

// 2. Flat Routed (AWS VPC CNI / Calico BGP):
// [ IP: Pod-A -> Pod-B ][ TCP: 8080 ][ Payload ]
// (Standard 1500 or 9001 Jumbo frames, zero packet overhead, native VPC peering)`,
    "AWS VPC CNI provides the highest network throughput for EKS, but consumes real VPC IP addresses; plan subnets carefully to avoid IP exhaustion.",
    ["overlay-network", "vxlan", "aws-vpc-cni", "flat-routing", "mtu-overhead"]
  ),
  card(
    44,
    cat,
    "CoreDNS Resolution, ndots:5 & The Conntrack Race Condition",
    "must-know",
    "advanced",
    "How does the Linux glibc 'ndots:5' DNS resolution configuration multiply DNS queries and cause intermittent 5-second timeout spikes in Kubernetes?",
    "By default, Kubernetes configures /etc/resolv.conf with 'ndots:5'. When an application queries an external domain with fewer than 5 dots (e.g. api.stripe.com has 2 dots), glibc appends each search domain sequentially, generating up to 8 DNS queries before querying the public domain, overwhelming CoreDNS and triggering Linux kernel conntrack race conditions.",
    "The default search path appends: \`api.stripe.com.default.svc.cluster.local\`, \`api.stripe.com.svc.cluster.local\`, \`api.stripe.com.cluster.local\`. In older Linux kernels, concurrent UDP DNS requests (A and AAAA queries) sharing the same socket trigger a Netfilter Conntrack race condition where one packet is dropped, resulting in a hard **5-second DNS timeout** penalty. Mitigations: 1) Append a trailing dot to external URLs in code (\`api.stripe.com.\`) to bypass search domains; 2) Set \`dnsConfig: options: [{ name: ndots, value: '2' }]\`; 3) Deploy **NodeLocal DNSCache** (DaemonSet running local DNS cache on each node over loopback).",
    `# Tuning Pod DNS to Eliminate ndots:5 Latency Multipliers
apiVersion: v1
kind: Pod
metadata:
  name: tuned-api-pod
spec:
  dnsConfig:
    options:
    - name: ndots
      value: "2" # Reduces search domain attempts for external APIs
    - name: single-request-reopen # Fixes conntrack UDP race condition
  containers:
  - name: app
    image: enterprise/api:latest`,
    "Deploy NodeLocal DNSCache in all production clusters to serve DNS locally over loopback (169.254.20.10) and eliminate conntrack race conditions.",
    ["coredns", "ndots-5", "conntrack-race", "nodelocal-dnscache", "dns-latency"]
  ),
  card(
    45,
    cat,
    "Service Mesh: Istio vs Linkerd (Envoy Sidecars vs Ambient / Rust)",
    "must-know",
    "intermediate",
    "What are the architectural differences between sidecar-based service meshes (Istio classic) and sidecarless meshes (Istio Ambient / Linkerd)?",
    "Sidecar service meshes inject an Envoy proxy into every individual application pod, adding memory overhead (50-100MB per pod) and CPU latency per hop. Sidecarless meshes (Istio Ambient, Cilium Service Mesh) decouple the mesh into node-level Layer 4 secure tunnels (zTunnel) and shared Layer 7 waypoint proxies.",
    "In a traditional sidecar mesh (Istio with Envoy): every pod runs a proxy container. Network packets traverse user space twice per node hop (App -> local Envoy -> network -> remote Envoy -> remote App). While this provides mTLS and L7 metrics, it inflates cluster RAM requirements by gigabytes. **Istio Ambient Mesh** splits this into: 1) **zTunnel (Zero-Trust Tunnel)**: A lightweight DaemonSet running on each node handling Layer 4 mTLS encryption with near-zero overhead; 2) **Waypoint Proxies**: Dedicated per-service Envoy proxies spun up only when advanced Layer 7 features (traffic splitting, fault injection) are explicitly needed.",
    `// Service Mesh Topology Comparison:
// 1. Classic Sidecar Mesh (Istio Envoy):
// [ Pod: App + Envoy (100MB) ] <--- mTLS ---> [ Pod: DB + Envoy (100MB) ]
// (Memory scales linearly with pod count!)

// 2. Ambient Sidecarless Mesh (Istio Ambient / Cilium):
// [ Pod: App ]                                 [ Pod: DB ]
//      |                                            |
//   (eBPF)                                       (eBPF)
//      v                                            v
// [ Node zTunnel DaemonSet (Layer 4 mTLS) ] <---> [ Node zTunnel DaemonSet ]`,
    "Ambient mesh reduces service mesh compute and memory costs by up to 70% while maintaining mutual TLS zero-trust encryption across all nodes.",
    ["service-mesh", "istio", "linkerd", "ambient-mesh", "envoy", "sidecarless"]
  ),
  card(
    46,
    cat,
    "ExternalDNS: Automated Route53 / Cloudflare DNS Synchronization",
    "must-know",
    "intermediate",
    "How does ExternalDNS automate public and private DNS record management across cloud providers directly from Kubernetes Ingress and Service manifests?",
    "ExternalDNS is an operator that continuously watches Kubernetes Services and Ingress resources, automatically creating, updating, and deleting DNS A/CNAME records in external DNS providers (AWS Route 53, Cloudflare, Google Cloud DNS) using TXT ownership verification records.",
    "Without ExternalDNS, deploying a new service requires an engineer to manually open AWS Route 53 and create DNS records pointing to the load balancer hostname. ExternalDNS automates this declaratively: when an Ingress specifies \`host: api.enterprise.com\`, ExternalDNS calls the Route 53 API to create an ALIAS/A record pointing to the Ingress controller's load balancer. To prevent conflicting clusters overwriting each other's records, ExternalDNS writes a companion TXT registry record (e.g. \`heritage=external-dns,owner=prod-cluster\`) to verify ownership.",
    `# Ingress with ExternalDNS Route 53 Automation
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-ingress
  annotations:
    # ExternalDNS reads these annotations automatically:
    external-dns.alpha.kubernetes.io/hostname: "api.enterprise.com"
    external-dns.alpha.kubernetes.io/ttl: "60"
spec:
  ingressClassName: nginx
  rules:
  - host: api.enterprise.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: api-service
            port:
              number: 80`,
    "Always configure '--txt-owner-id=<unique-cluster-id>' in ExternalDNS. Without an owner ID, multiple clusters sharing a DNS zone will overwrite each other's records.",
    ["external-dns", "route53", "dns-automation", "txt-registry", "cloud-dns"]
  ),
  card(
    47,
    cat,
    "MetalLB: Bare-Metal LoadBalancer Implementation",
    "must-know",
    "intermediate",
    "How does MetalLB provide standard 'type: LoadBalancer' functionality in bare-metal and on-premises Kubernetes environments that lack cloud load balancers?",
    "MetalLB monitors Services of type LoadBalancer on bare-metal clusters and assigns IP addresses from a pre-configured pool, advertising those IPs to the local network using either Layer 2 mode (ARP/NDP) or BGP routing mode.",
    "Cloud Kubernetes (EKS, GKE) automatically provisions cloud hardware load balancers when \`type: LoadBalancer\` is requested. On bare-metal (data centers, homelabs), services hang permanently in \`Pending\` state. MetalLB solves this: 1) **Layer 2 Mode**: Elects one node as the leader for the IP; that node responds to local ARP queries for the virtual IP; 2) **BGP Mode**: Worker nodes establish BGP peering sessions with the data center's top-of-rack physical routers, advertising pod routes directly to upstream core network routers with true multi-path load balancing (ECMP).",
    `# MetalLB IPAddressPool & L2Advertisement Configuration
apiVersion: metallb.io/v1beta1
kind: IPAddressPool
metadata:
  name: production-public-ips
  namespace: metallb-system
spec:
  addresses:
  - 192.168.1.200-192.168.1.250 # Pool of available network IPs

---
apiVersion: metallb.io/v1beta1
kind: L2Advertisement
metadata:
  name: l2-adv
  namespace: metallb-system
spec:
  ipAddressPools:
  - production-public-ips`,
    "For bare-metal production clusters, prefer MetalLB BGP mode over Layer 2 mode to distribute traffic across all nodes via Equal-Cost Multi-Path (ECMP).",
    ["metallb", "bare-metal", "loadbalancer", "bgp-mode", "arp-layer2"]
  ),
  card(
    48,
    cat,
    "Dual-Stack IPv4/IPv6 Networking in Enterprise Clusters",
    "advanced",
    "advanced",
    "What architectural requirements enable Dual-Stack IPv4/IPv6 networking in Kubernetes and how does it prevent public IPv4 address exhaustion?",
    "Dual-Stack networking assigns both an IPv4 and an IPv6 address to every Pod and Service, allowing workloads to communicate natively over both protocols without Network Address Translation (NAT64/DNS64).",
    "Enterprise clusters with hundreds of thousands of pods exhaust private IPv4 subnets (RFC 1918). With Dual-Stack enabled: 1) The control plane runs with \`--service-cluster-ip-range\` and \`--cluster-cidr\` accepting comma-separated IPv4 and IPv6 CIDRs; 2) Services specify \`ipFamilyPolicy: PreferDualStack\` or \`RequireDualStack\`; 3) Ingress controllers listen on both IPv4 and IPv6 public addresses; 4) CoreDNS resolves both A and AAAA records simultaneously.",
    `# Dual-Stack Service Specification
apiVersion: v1
kind: Service
metadata:
  name: dual-stack-service
spec:
  ipFamilyPolicy: RequireDualStack
  ipFamilies:
  - IPv4
  - IPv6
  selector:
    app: web-server
  ports:
  - port: 80
    targetPort: 8080`,
    "Dual-Stack requires explicit CNI support (Calico, Cilium, AWS VPC CNI). Ensure your CNI is configured for dual-stack before bootstrapping the cluster.",
    ["dual-stack", "ipv4-ipv6", "ip-exhaustion", "enterprise-networking", "ip-family-policy"]
  )
];
