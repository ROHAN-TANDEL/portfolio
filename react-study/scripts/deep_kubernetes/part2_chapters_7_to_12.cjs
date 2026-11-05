// scripts/deep_kubernetes/part2_chapters_7_to_12.cjs
module.exports = [
  {
    id: "k8s-deep-07",
    title: "Cluster Autoscaling Dynamics: HPA v2, VPA In-Place Resizing & Karpenter Node Provisioning",
    category: "Autoscaling & Capacity Planning",
    readTimeMinutes: 33,
    overview: "Autoscaling in Kubernetes operates across two coordinated dimensions: Horizontal Pod Autoscaler (HPA) and Vertical Pod Autoscaler (VPA) scale workloads, while the node provisioner (Cluster Autoscaler or Karpenter) dynamically adjusts physical compute capacity. This deep dive dissects the mathematical scaling equations of HPA v2, the mechanics of in-place container resizing, and how Karpenter bypasses cloud Auto-Scaling Groups to provision bare compute instances in under 45 seconds.",
    diagram: `
+----------------------------------------------------------------------------------------------------+
|                                COORDINATED TWO-TIER AUTOSCALING ARCHITECTURE                       |
+----------------------------------------------------------------------------------------------------+
  [ Incoming HTTP / Queue Traffic Surge ]
                    │
                    ▼
  +─────────────────────────────────────────────────────────────────────────────────────────────────+
  | TIER 1: WORKLOAD AUTOSCALING (HPA v2 & VPA)                                                     |
  |  - HPA evaluates Prometheus / Custom Metrics every 15s.                                         |
  |  - Calculates desiredReplicas = ceil[ currentReplicas * (currentMetric / targetMetric) ]        |
  |  - Scales Deployment from 10 to 60 Pods.                                                        |
  |  - 30 Pods placed on existing nodes; 30 Pods enter PENDING state due to CPU exhaustion.         |
  +────────────────────────────────────────────────────────────────┬────────────────────────────────+
                                                                   │ (Pending Pods trigger)
                                                                   ▼
  +─────────────────────────────────────────────────────────────────────────────────────────────────+
  | TIER 2: NODE CAPACITY PROVISIONING COMPARISON                                                   |
  |                                                                                                 |
  | [ Traditional Cluster Autoscaler (CAS) ]            [ Modern Karpenter Provisioner ]            |
  | - Polls node groups; detects unscheduled pods.      - Directly watches etcd scheduling events.  |
  | - Triggers Cloud Auto-Scaling Group (ASG).          - Evaluates exact CPU/RAM/GPU requirements. |
  | - Cloud provider spins up pre-baked VM template.    - Calls Cloud EC2/GCE APIs directly (No ASG)|
  | - Bootstrap latency: 3 to 7 minutes.                - Launches optimal spot/on-demand in 40s.   |
  | - Node Consolidation: Slow, coarse-grained.         - Automated fast Bin-Packing Consolidation. |
  +─────────────────────────────────────────────────────────────────────────────────────────────────+
`,
    deepDive: `### 1. HPA v2 Mathematical Core
The Horizontal Pod Autoscaler controller periodically (default \`--horizontal-pod-autoscaler-sync-period=15s\`) queries metrics from \`metrics.k8s.io\`, \`custom.metrics.k8s.io\`, or \`external.metrics.k8s.io\`.
The target replica count is calculated as:
$$\\text{desiredReplicas} = \\left\\lceil \\sum_{i=1}^{N} \\text{currentMetricValue}_i \\times \\frac{1}{\\text{targetMetricValue}} \\right\\rceil = \\left\\lceil \\text{currentReplicas} \\times \\left( \\frac{\\text{currentMetricValue}}{\\text{targetMetricValue}} \\right) \\right\\rceil$$
- **Tolerance Band**: To prevent scaling flap, if $\\left| \\frac{\\text{currentMetricValue}}{\\text{targetMetricValue}} - 1.0 \\right| \\le 0.10$ (10% default tolerance), HPA takes no action.
- **Scaling Policies and Stabilization Windows**: HPA v2 allows fine-grained rate-limiting rules. For example, scaling down can enforce a 300-second stabilization window to prevent premature downscaling during temporary traffic lulls:
\`\`\`yaml
behavior:
  scaleDown:
    stabilizationWindowSeconds: 300
    policies:
    - type: Percent
      value: 10
      periodSeconds: 60
\`\`\`

### 2. VPA and In-Place Pod Resizing
Vertical Pod Autoscaler adjusts CPU and memory requests dynamically based on historical 99th-percentile utilization:
- **Historical Eviction Limitation**: Historically, VPA required destroying and recreating pods to mutate \`resources.requests\`, causing disruptive restarts.
- **In-Place Resource Resizing (K8s 1.27+)**: With the \`InPlacePodVerticalScaling\` feature gate, \`spec.containers[*].resources\` can be mutated dynamically without restarting the container process or dropping TCP connections. Kubelet interacts directly with cgroups v2 (\`cpu.max\`, \`memory.max\`) to expand container bandwidth in-memory.

### 3. Karpenter vs Cluster Autoscaler
- **Cluster Autoscaler (CAS)**: Tied to cloud Auto-Scaling Groups (ASGs / Managed Node Groups). Scaler is restricted to homogeneous VM types defined by the node group. Adding new instance types requires manual terraform changes.
- **Karpenter**: A high-performance, group-less node autoscaler. It watches pending pods, computes the exact multi-dimensional packing equation (CPU, memory, GPU, architecture, topology spread constraints), and requests the cheapest available instance types directly from cloud APIs:
  - Supports automated instance drift detection.
  - Automatically consolidates under-utilized nodes by cordoning, draining, and migrating workloads to fewer, cheaper spot instances.`,
    edgeCasesAndPitfalls: `1. **HPA and VPA Metric Contention Deadlock**: If HPA and VPA both target CPU utilization on the same deployment, they enter an antagonistic feedback loop: high CPU triggers HPA to scale out replicas, which dilutes per-pod CPU; VPA observes reduced CPU and downscales container requests, causing CPU utilization percentage to spike again. Never combine HPA and VPA on the same resource metric.
2. **Karpenter Spot Instance Interruption Storms**: Cloud providers issue a 2-minute warning before reclaiming Spot instances. If Karpenter node templates lack fallback to On-Demand or lack multi-zone diversification, mass spot termination can take down entire application tiers simultaneously.
3. **Missing Resource Requests Breaking HPA**: HPA evaluating \`type: Resource\` (e.g. CPU percentage) computes utilization against \`resources.requests.cpu\`. If a container omits CPU requests, HPA cannot calculate percentage and fails with \`ScalingActive: False (FailedGetResourceMetric)\`.`,
    keyTakeaways: [
      "HPA calculates replicas using ceil[currentReplicas * (currentMetric / targetMetric)] with a 10% tolerance band.",
      "Never run HPA and VPA simultaneously on the same metric (CPU/RAM) to prevent runaway feedback oscillation.",
      "Karpenter bypasses cloud Auto-Scaling Groups, launching optimized compute instances in <45s via direct cloud APIs.",
      "Always configure scaleDown stabilization windows (300s+) to absorb transient traffic drops without aggressive flapping."
    ]
  },
  {
    id: "k8s-deep-08",
    title: "Service Mesh Deep Dive: Istio Envoy Data Plane, mTLS Handshakes & Traffic Shifting",
    category: "Networking & Services",
    readTimeMinutes: 34,
    overview: "Service meshes shift operational networking capabilities—mutual TLS, circuit breaking, fine-grained traffic splitting, and distributed telemetry—from application code down into the infrastructure layer. This masterclass inspects Istio's control plane (istiod) and Envoy data plane proxy, tracing iptables redirection, automated mTLS cryptographic handshakes, and progressive traffic routing algorithms.",
    diagram: `
+----------------------------------------------------------------------------------------------------+
|                                 ISTIO SERVICE MESH DATA PLANE ARCHITECTURE                          |
+----------------------------------------------------------------------------------------------------+
  [ POD A (Client) ]                                    [ POD B (Server) ]
  ┌──────────────────────────────────────────────┐      ┌──────────────────────────────────────────┐
  │ [ App Container ]                            │      │ [ App Container ]                        │
  │   - Sends plain HTTP to http://svc-b:8080    │      │   - Receives plain HTTP on localhost:8080│
  │          │                                   │      │          ▲                               │
  │   (iptables REDIRECT to 15001)               │      │   (iptables PREROUTING to 15006)         │
  │          ▼                                   │      │          │                               │
  │ [ Envoy Sidecar Proxy (127.0.0.1) ]          │      │ [ Envoy Sidecar Proxy (127.0.0.1) ]      │
  │   - Upstream Cluster Discovery (xDS)         │      │   - Downstream mTLS Termination          │
  │   - SPIFFE x509 Cert Validation              │      │   - Enforces AuthorizationPolicy         │
  │   - Outbound mTLS Connection (Port 15008) ───┼──────┼──>│   - Extracts telemetry & traces      │
  └──────────────────────────────────────────────┘      └──────────────────────────────────────────┘
                         │ (Encrypted Wire Traffic: mTLS over TCP) │
                         ▼                                         ▲
  +─────────────────────────────────────────────────────────────────────────────────────────────────+
  | ISTIOD CONTROL PLANE                                                                            |
  |  - Pilot    : Translates K8s Services / VirtualServices into Envoy xDS configurations (gRPC)    |
  |  - Citadel  : Acts as intermediate CA, issuing short-lived SPIFFE x509 certs via SDS API       |
  +─────────────────────────────────────────────────────────────────────────────────────────────────+
`,
    deepDive: `### 1. iptables Packet Interception Mechanics
When Istio injects a sidecar, an \`initContainer\` (\`istio-init\`) runs with \`NET_ADMIN\` capabilities:
- It configures iptables rules inside the Pod's network namespace.
- **Outbound Traffic**: Any outbound TCP packet originating from the application container (except those from UID 1337, Envoy's user) is redirected via \`PREROUTING\` to Envoy's local listening port \`15001\` (Envoy Outbound).
- **Inbound Traffic**: Any packet arriving on the Pod's eth0 is redirected to port \`15006\` (Envoy Inbound Virtual Listener).
The application container remains entirely unaware that all inbound and outbound traffic is intercepted and wrapped by Envoy.

### 2. Zero-Trust Identity: SPIFFE & Dynamic mTLS
Istio establishes cryptographic zero-trust identity via SPIFFE (Secure Production Identity Framework for Everyone):
- Identity format: \`spiffe://<trust-domain>/ns/<namespace>/sa/<serviceaccount>\`.
- **Secret Discovery Service (SDS)**: Envoy connects to local \`istio-agent\` over a UNIX socket. \`istio-agent\` generates an asymmetric keypair in memory, sends a Certificate Signing Request (CSR) to \`istiod\` (Citadel), and receives an x509 certificate valid for 24 hours. The private key never touches disk.
- **Peer Authentication Handshake**:
  1. Client Envoy initiates TLS v1.3 handshake with Server Envoy.
  2. Both Envoys exchange client and server certificates.
  3. Server Envoy validates that the client cert's SAN matches the SPIFFE ID authorized by \`AuthorizationPolicy\`.

### 3. Envoy xDS Dynamic Configuration Protocol
Envoy proxies avoid configuration restarts via streaming gRPC APIs (xDS) from istiod:
- **LDS (Listener Discovery Service)**: Pushes active port listeners.
- **RDS (Route Discovery Service)**: Pushes routing rules, HTTP path matching, and header rewrite rules.
- **CDS (Cluster Discovery Service)**: Pushes backend target pools (clusters).
- **EDS (Endpoint Discovery Service)**: Pushes real-time Pod IP addresses and health statuses.

### 4. Advanced Traffic Routing (VirtualService & DestinationRule)
Istio separates routing rules (\`VirtualService\`) from backend policies (\`DestinationRule\`):
- **Weighted Canaries**: Splits traffic across versions (\`v1: 90%\`, \`v2: 10%\`).
- **Circuit Breaking**: Configures \`consecutive5xxErrors\`, \`interval\`, and \`baseEjectionTime\` to automatically eject unhealthy pod instances from the load-balancing pool before cascading failures occur.`,
    edgeCasesAndPitfalls: `1. **Envoy Memory Bloat at Large Cluster Scale**: By default, istiod pushes xDS endpoints for every Service and Pod across the entire cluster to every single Envoy proxy. In a cluster with 5,000 services, each Envoy consumes 1GB+ RAM just storing routing tables. Apply \`Sidecar\` CRDs to restrict xDS discovery strictly to local namespace dependencies.
2. **mTLS Handshake Failures During Migration (PERMISSIVE vs STRICT)**: When migrating existing services into the mesh, setting \`STRICT\` mode prematurely breaks traffic from legacy unmeshed pods. Use \`PERMISSIVE\` mode during migration so Envoy accepts both plaintext and mTLS.
3. **Application Protocol Detection Delays**: If a Service port is not named explicitly (e.g. \`http-api\` or \`grpc-svc\`), Envoy sniffs the first byte stream to sniff protocol. If the client waits for the server to speak first (e.g. SMTP or custom TCP), protocol sniffing deadlocks the connection.`,
    keyTakeaways: [
      "Istio uses iptables REDIRECT inside pod namespaces to route all application traffic through Envoy transparently.",
      "Zero-trust mTLS uses SPIFFE IDs embedded in short-lived x509 certs rotated dynamically via Envoy Secret Discovery Service.",
      "Always define Istio Sidecar resources in large clusters to restrict xDS config pushes and prevent Envoy memory bloat.",
      "Name Service ports with protocol prefixes (http-, grpc-) to bypass Envoy protocol sniffing latency and deadlocks."
    ]
  },
  {
    id: "k8s-deep-09",
    title: "GitOps Continuous Delivery: ArgoCD ApplicationSets, Rollouts Canary Analysis & Self-Healing",
    category: "Packaging, GitOps & Progressive Delivery",
    readTimeMinutes: 30,
    overview: "GitOps establishes Git as the single source of truth for declared infrastructure and application state, replacing vulnerable push-based CI/CD credentials with secure, in-cluster pull controllers. This deep dive dissects the reconciliation mechanics of ArgoCD, automated multi-cluster ApplicationSet generators, progressive delivery with Argo Rollouts, and automated metric-driven canary verification.",
    diagram: `
+----------------------------------------------------------------------------------------------------+
|                                    ENTERPRISE GITOPS & PROGRESSIVE DELIVERY                         |
+----------------------------------------------------------------------------------------------------+
  [ Developer Push to Git ]
            │
            ▼
  +─────────────────────────────────────────────────────────────────────────────────────────────────+
  | GITOPS SOURCE OF TRUTH (Git Repository)                                                         |
  |  - Branch: main (Declarative Kustomize / Helm manifests)                                         |
  +────────────────────────────────────────┬────────────────────────────────────────────────────────+
                                           │ (Webhook / 3-minute poll)
                                           ▼
  +─────────────────────────────────────────────────────────────────────────────────────────────────+
  | ARGOCD CONTROLLER ENGINE                                                                        |
  |  1. Repo Server renders target state (Helm / Kustomize) in sandbox.                             |
  |  2. Application Controller computes 3-way strategic merge diff against live kube-apiserver.    |
  |  3. Self-Healing: If drift detected (unauthorized kubectl edit) ──> Overwrites live state.      |
  |  4. ApplicationSets: Generates 50 Application CRDs dynamically across regional clusters.        |
  +────────────────────────────────────────┬────────────────────────────────────────────────────────+
                                           │ Syncs new image tag: v2.4.0
                                           ▼
  +─────────────────────────────────────────────────────────────────────────────────────────────────+
  | ARGO ROLLOUTS PROGRESSIVE CANARY ENGINE                                                         |
  |  - Replaces Deployment with Rollout CRD.                                                         |
  |  - Steps: [ Weight: 10%, Pause: 15m ] ──> [ Weight: 50%, Pause: 30m ] ──> [ Weight: 100% ]       |
  |  - Background AnalysisRun queries Prometheus:                                                    |
  |    "sum(rate(http_5xx[1m])) / sum(rate(http_total[1m])) <= 0.01"                               |
  |  - Metric breached? ──> Instant automated rollback to stable replica set in 5 seconds.         |
  +─────────────────────────────────────────────────────────────────────────────────────────────────+
`,
    deepDive: `### 1. The GitOps Reconciliation Loop
ArgoCD's Application Controller continuously executes a state synchronization loop:
$$\\text{Diff} = \\text{ThreeWayDiff}(\\text{LiveClusterState}, \\text{TargetGitState}, \\text{LastAppliedConfig})$$
- If $\\text{Diff} \\ne \\emptyset$, the application enters the \`OutOfSync\` phase.
- If \`syncPolicy.automated.selfHeal: true\`, the controller applies a Strategic Merge Patch to revert live deviations back to Git state.
- If \`syncPolicy.automated.prune: true\`, resources deleted from Git are permanently pruned from the Kubernetes cluster, preventing ghost infrastructure.

### 2. Multi-Cluster Fleet Management with ApplicationSets
Managing hundreds of microservices across multiple clusters is automated via ApplicationSet Generators:
- **Matrix Generator**: Combines two independent generators. For example, pairing a **Git Generator** (scanning \`apps/*\` directories) with a **Cluster Generator** (selecting all clusters labeled \`environment: production\`).
- The controller computes the Cartesian product:
  $$N_{\\text{Apps}} = \\text{Count}(\\text{GitDirectories}) \\times \\text{Count}(\\text{TargetClusters})$$
  It generates and reconciles all $N$ ArgoCD \`Application\` resources automatically.

### 3. Progressive Delivery with Argo Rollouts
Standard Kubernetes Deployments support only coarse RollingUpdates (cannot route 5% traffic to new versions). Argo Rollouts introduces the \`Rollout\` CRD:
- **Traffic Routing Integration**: Connects to Ingresses (NGINX, ALB) or Service Meshes (Istio, Linkerd) to dynamically program routing weights without pod duplication.
- **Canary Step Execution**:
  1. Scales canary ReplicaSet to the desired fractional ratio.
  2. Updates traffic router (e.g. Istio VirtualService weight to 10%).
  3. Executes scheduled \`AnalysisRun\` jobs to validate live performance.

### 4. Automated Canary Metric Analysis
The \`AnalysisTemplate\` CRD codifies automated canary verification via PromQL:
\`\`\`yaml
apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: success-rate
spec:
  metrics:
  - name: success-rate
    interval: 1m
    successCondition: result[0] >= 0.999
    failureLimit: 2
    provider:
      prometheus:
        address: http://prometheus:9090
        query: |
          sum(rate(http_requests_total{status!~"5.*",app="web"}[1m]))
          /
          sum(rate(http_requests_total{app="web"}[1m]))
\`\`\`
If consecutive failures exceed \`failureLimit\`, the Rollout immediately halts, marks the release \`Degraded\`, shifts 100% traffic back to the stable ReplicaSet, and triggers an alert.`,
    edgeCasesAndPitfalls: `1. **Git Commit Storms Overwhelming Repo Server**: In large monorepos with hundreds of microservices, frequent Git commits trigger hundreds of concurrent manifest rendering jobs on the ArgoCD Repo Server. Without caching and horizontal scaling of \`argocd-repo-server\`, CPU starvation causes widespread sync timeouts.
2. **Infinite Sync Loops Caused by Mutating Webhooks**: If a mutating admission webhook (or cloud controller) injects default fields (e.g. resource limits or annotations) that are absent in Git, ArgoCD detects a persistent diff and triggers continuous sync loops. Use \`ignoreDifferences\` in the Application spec to ignore dynamically injected fields.
3. **Flaky AnalysisRun Queries Aborting Valid Releases**: Setting an overly narrow query window (e.g. \`[15s]\`) in low-traffic environments can cause division-by-zero errors or temporary spikes that trigger false-positive rollbacks. Always use smooth moving windows (\`[2m]\` to \`[5m]\`).`,
    keyTakeaways: [
      "GitOps ensures Git is the single source of truth; in-cluster controllers automatically pull state and self-heal drift.",
      "ArgoCD ApplicationSets use Matrix Generators to stamp out hundreds of Applications across clusters without duplication.",
      "Argo Rollouts enables progressive canary releases with fractional traffic routing via Istio, NGINX, or cloud ALBs.",
      "AnalysisTemplates query real-time Prometheus metrics during rollouts, triggering instant automated rollback on anomalies."
    ]
  },
  {
    id: "k8s-deep-10",
    title: "Kubernetes Zero-Trust Security: Admission Webhooks, NetworkPolicies, PSA & Cilium Tetragon",
    category: "Security, RBAC & Policy Governance",
    readTimeMinutes: 32,
    overview: "Securing Kubernetes requires defense-in-depth across the API plane, container runtime sandbox, and network fabric. This deep dive explores zero-trust hardening: validating and mutating admission controllers, Pod Security Standards (Privileged, Baseline, Restricted), granular NetworkPolicy packet filtering, and runtime eBPF kernel enforcement using Cilium Tetragon.",
    diagram: `
+----------------------------------------------------------------------------------------------------+
|                                    DEFENSE-IN-DEPTH ZERO-TRUST ARCHITECTURE                         |
+----------------------------------------------------------------------------------------------------+
  1. API ADMISSION CONTROL (Prevent deployment of insecure manifests)
     [ kubectl / GitOps ]
              │
              ▼
     [ kube-apiserver ]
              │
              ├─► [ Pod Security Standards (PSA) ] : Enforces 'restricted' profile (no root, no hostPID)
              ├─► [ Kyverno / Gatekeeper OPA ]     : Asserts image registry whitelist & required limits
              ▼
  2. NETWORK FABRIC ISOLATION (Prevent lateral movement)
     [ Pod A: frontend ] ────(Blocked by default-deny NetworkPolicy)────► [ Pod B: database ]
              │
              ▼ (Allowed: explicit NetworkPolicy egress/ingress rule on Port 5432)
     [ Calico / Cilium eBPF Packet Filter ]
              │
              ▼
  3. KERNEL RUNTIME ENFORCEMENT (Detect & block zero-day escapes)
     [ Linux Kernel Layer (Cilium Tetragon eBPF) ]
      - Hooks sys_execve, sys_socket, sys_mount inside container namespaces.
      - Detects unauthorized binary executions (e.g. curl / nmap spawned inside container).
      - Sends immediate SIGKILL from kernel space *before* the syscall completes.
`,
    deepDive: `### 1. Pod Security Admission (PSA) Standards
Kubernetes deprecated PodSecurityPolicies (PSP) in favor of Pod Security Admission (PSA), built directly into kube-apiserver. PSA defines three cumulative levels applied via namespace labels:
- **Privileged**: Completely unrestricted (used for CNI, storage drivers).
- **Baseline**: Minimally restrictive; prevents known privilege escalations (blocks \`hostNetwork\`, \`hostPID\`, \`hostIPC\`, \`capabilities: SYS_ADMIN\`).
- **Restricted**: Hardened zero-trust standard for untrusted workloads:
  - Container must run as non-root (\`runAsNonRoot: true\`, \`runAsUser: 10001\`).
  - Drops all default capabilities and allows only \`NET_BIND_SERVICE\` (\`capabilities.drop: ["ALL"]\`).
  - Read-only root filesystem (\`readOnlyRootFilesystem: true\`).
  - Disallows privilege escalation (\`allowPrivilegeEscalation: false\`).
  - Mandates modern seccomp profile (\`seccompProfile.type: RuntimeDefault\`).

### 2. Default-Deny NetworkPolicies
By default, Kubernetes networking is non-isolated: any Pod can establish TCP/UDP connections to any other Pod in any namespace.
Zero-trust mandates deploying an explicit Default-Deny policy in every production namespace:
\`\`\`yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: finance
spec:
  podSelector: {} # Selects all pods in namespace
  policyTypes:
  - Ingress
  - Egress
\`\`\`
Once applied, all traffic is severed until explicit whitelisting rules specify allowed ingress peers (by \`podSelector\` or \`namespaceSelector\`) and egress destinations (e.g. CoreDNS port 53 and backend database port 5432).

### 3. Runtime Kernel Security with eBPF Tetragon
Traditional runtime security agents (like older Falco) monitor syscalls via \`ptrace\` or userspace kernel events, resulting in a detection delay: the adversary executes the attack before the alert fires.
**Cilium Tetragon** executes security enforcement directly inside the Linux kernel using eBPF:
- **kprobes and tracepoints**: Hooks kernel functions like \`__x64_sys_execve\`, \`security_file_permission\`, and \`tcp_connect\`.
- **In-Kernel Kill**: If an attacker gains shell execution inside a compromised web server and executes \`/bin/bash\` or reads \`/etc/shadow\`, Tetragon terminates the process with \`SIGKILL\` directly inside the kernel before the process can emit network packets or write to disk.`,
    edgeCasesAndPitfalls: `1. **Blocking CoreDNS Port 53 in Default-Deny Policies**: Applying an aggressive default-deny Egress NetworkPolicy without explicitly allowing UDP/TCP port 53 to \`kube-system\` CoreDNS pods breaks DNS resolution cluster-wide, causing immediate cascading microservice outages.
2. **Missing NetworkPolicy Enforcement Engine**: Kubernetes manifests for \`NetworkPolicy\` can be applied successfully to any cluster without error, but if the underlying CNI is basic Flannel (which lacks a network policy controller), the rules are silently ignored and no traffic is filtered.
3. **Read-Only Root Filesystem Crash Loops**: Enforcing \`readOnlyRootFilesystem: true\` on legacy container images causes immediate crashes if applications attempt to write temporary files or logs to \`/tmp\` or \`/var/log\`. Mount an ephemeral \`emptyDir\` volume at \`/tmp\` to accommodate scratch files securely.`,
    keyTakeaways: [
      "Pod Security Admission enforces Baseline or Restricted security profiles declaratively via namespace labels.",
      "Apply default-deny Ingress and Egress NetworkPolicies in all namespaces; explicitly whitelist CoreDNS port 53.",
      "Always set runAsNonRoot: true, allowPrivilegeEscalation: false, and drop all Linux capabilities in production containers.",
      "eBPF Tetragon enforces zero-trust security directly inside the Linux kernel, issuing instant SIGKILL on malicious syscalls."
    ]
  },
  {
    id: "k8s-deep-11",
    title: "Production Observability Stack: Prometheus Operator, PromQL Alerting, Vector & OpenTelemetry",
    category: "Observability, Operations & Troubleshooting",
    readTimeMinutes: 31,
    overview: "Operating enterprise Kubernetes clusters requires unified, multi-dimensional observability across metrics, logs, and distributed traces. This masterclass examines the Prometheus Operator telemetry architecture, ServiceMonitor discovery algorithms, production-grade PromQL alerting rules, high-throughput log aggregation with Vector, and distributed context propagation via OpenTelemetry.",
    diagram: `
+----------------------------------------------------------------------------------------------------+
|                                PRODUCTION CLOUD-NATIVE OBSERVABILITY PIPELINE                       |
+----------------------------------------------------------------------------------------------------+
  1. METRICS PIPELINE (Prometheus Operator)
     [ Pods with /metrics ] <──(Scraped every 15s)── [ Prometheus StatefulSet ]
               │                                                │
     [ ServiceMonitor CRD ] ──(Auto-configures targets)─────────┘
               │
               ▼ (Evaluates PromQL Alerting Rules)
     [ Alertmanager ] ──(Deduplicates & Routes)──► [ PagerDuty / Slack ]

  2. LOGGING PIPELINE (Vector / FluentBit)
     [ Container stdout/stderr ] ──► [ /var/log/pods/*.log on Host ]
                                                │
                                                ▼ (Tailed & Parsed by Vector DaemonSet)
     [ Vector Node Agent ] ──(HTTPS Batch Export)──► [ Grafana Loki / OpenSearch ]

  3. DISTRIBUTED TRACING PIPELINE (OpenTelemetry)
     [ App Request ] ──(W3C TraceContext: traceparent)──► [ App Downstream ]
            │                                                      │
            ▼ (OTLP gRPC)                                          ▼ (OTLP gRPC)
     [ OpenTelemetry Collector DaemonSet ] ─────────────────► [ Grafana Tempo / Jaeger ]
`,
    deepDive: `### 1. Prometheus Operator and Declarative Discovery
Rather than requiring manual updates to a monolithic \`prometheus.yml\`, Prometheus Operator introduces declarative CRDs:
- **ServiceMonitor**: Selects Kubernetes Services by label matchers and maps their target endpoints to Prometheus scrape jobs.
- **PrometheusRule**: Codifies alert evaluation expressions in PromQL:
\`\`\`yaml
apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: api-alerts
spec:
  groups:
  - name: api.rules
    rules:
    - alert: HighHTTPErrorRate
      expr: |
        sum(rate(http_requests_total{status=~"5.*"}[5m]))
        /
        sum(rate(http_requests_total[5m])) > 0.05
      for: 5m
      labels:
        severity: critical
      annotations:
        summary: "API 5xx error rate exceeds 5% on {{ $labels.namespace }}"
\`\`\`

### 2. High-Throughput Log Shipping with Vector
While older log shippers (like Fluentd) suffer high memory footprints under load, modern Rust-based shippers like **Vector** achieve 10x throughput with minimal CPU overhead:
- Runs as a node-level DaemonSet mounting host \`/var/log/pods\`.
- Uses inotify to tail JSON and CRI formatted logs.
- Uses Vector Remap Language (VRL) to parse structured JSON, strip ANSI escape codes, drop noisy health-check lines, and enrich events with Kubernetes pod metadata before streaming to storage.

### 3. OpenTelemetry and Distributed Trace Context
To trace requests as they hop across 15 microservices:
- Applications inject and extract **W3C TraceContext** headers (\`traceparent: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01\`).
- Spans are pushed via OTLP (OpenTelemetry Protocol) over gRPC to an in-cluster OTel Collector DaemonSet.
- The collector's \`k8sattributes\` processor automatically enriches every span with \`k8s.pod.name\`, \`k8s.namespace.name\`, and node labels before exporting to distributed tracing engines (Tempo, Jaeger).`,
    edgeCasesAndPitfalls: `1. **High Cardinality Metrics Exploding Prometheus Memory**: Including unbounded variables (like user IDs, order IDs, or raw URLs with query parameters) as metric labels causes millions of unique time series. Prometheus TSDB memory explodes, triggering node OOMKilled crashes. Enforce label sanitization at ingestion.
2. **Missing 'for' Durations Triggering Alert Storms**: Writing alerting rules without a \`for: 5m\` duration causes momentary single-scrape network blips or pod restarts to fire instant alerts, causing alert fatigue for on-call SRE teams.
3. **CoreDNS Metric Blackouts**: Prometheus scraping CoreDNS endpoints using outdated Service selectors can result in silent monitoring blackouts where cluster DNS failures occur completely undetected until applications begin timing out.`,
    keyTakeaways: [
      "Prometheus Operator uses ServiceMonitors to discover and scrape application endpoints dynamically via label selectors.",
      "Vector running as a Rust-based node DaemonSet provides high-throughput log parsing with minimal CPU and memory overhead.",
      "OpenTelemetry standardizes distributed tracing across microservices using W3C TraceContext header propagation.",
      "Never emit high-cardinality values (user IDs, timestamps, raw URLs) as Prometheus labels to avoid TSDB memory explosions."
    ]
  },
  {
    id: "k8s-deep-12",
    title: "Disaster Recovery & SRE Runbooks: etcd Quorum Recovery, Node Eviction Storms & Network Partitions",
    category: "Observability, Operations & Troubleshooting",
    readTimeMinutes: 35,
    overview: "When catastrophic failures strike production Kubernetes clusters—etcd loss of quorum, cascading node eviction storms, or split-brain network partitions—engineers must execute rigorous, battle-tested disaster recovery protocols. This masterclass provides step-by-step SRE runbooks for restoring etcd from bare snapshots, remediating cascading eviction loops, and safely recovering partitioned control planes.",
    diagram: `
+----------------------------------------------------------------------------------------------------+
|                                    SRE DISASTER RECOVERY & INCIDENT RUNBOOK                         |
+----------------------------------------------------------------------------------------------------+
  SCENARIO 1: ETCD QUORUM COLLAPSE (2 of 3 nodes permanently lost)
  [ Surviving etcd Node ]
            │
            ├─► 1. Stop kube-apiserver static pods across all control plane nodes.
            ├─► 2. Take immediate safety copy of /var/lib/etcd/member/snap/db.
            ├─► 3. Re-initialize single-member cluster:
            │      etcdctl snapshot restore <db> --initial-cluster=node1=https://IP:2380 ...
            ├─► 4. Update etcd static pod manifest; restart kubelet.
            └─► 5. Add new control plane nodes one-by-one via etcdctl member add.

  SCENARIO 2: CASCADING NODE EVICTION STORM
  [ Node A Hits Memory Pressure ] ──► Evicts 50 Pods ──► Kube-scheduler pushes pods to Node B
                                                                      │
  [ Node B Hits Memory Pressure ] ◄── Evicts 100 Pods ◄───────────────┘
            │
            ▼ (Cascading Cluster Meltdown)
  CIRCUIT BREAKER FIX: Enforce PodDisruptionBudgets, PriorityClasses & Cluster Autoscaler Rate-Limiting.
`,
    deepDive: `### 1. etcd Quorum Restoration Runbook
In a 3-node etcd cluster, losing 2 nodes destroys Raft quorum ($Q = 2$). The surviving node refuses all read/write operations:
1. **Quarantine Control Plane**: SSH to all master nodes. Move \`/etc/kubernetes/manifests/kube-apiserver.yaml\` to a backup directory to immediately stop API traffic and halt concurrent writes.
2. **Execute Snapshot Restore**:
\`\`\`bash
ETCDCTL_API=3 etcdctl snapshot restore /backups/latest.db \\
  --data-dir=/var/lib/etcd-recovered \\
  --name=master-01 \\
  --initial-cluster=master-01=https://10.0.0.10:2380 \\
  --initial-cluster-token=etcd-recovered-cluster \\
  --initial-advertise-peer-urls=https://10.0.0.10:2380
\`\`\`
3. **Point Manifests to Restored Data**: Update \`/etc/kubernetes/manifests/etcd.yaml\` to mount \`/var/lib/etcd-recovered\`.
4. **Restart Kubelet**: \`systemctl restart kubelet\`. Verify etcd health via \`etcdctl endpoint health\`.
5. **Restore API Server**: Move \`kube-apiserver.yaml\` back into the manifests directory.
6. **Re-expand Quorum**: Add standby control plane nodes one by one using \`etcdctl member add\`.

### 2. Remediating Cascading Node Eviction Storms
A cascading eviction storm occurs when one node experiences memory pressure, evicting dozens of pods. The scheduler relocates them to surviving nodes, overloading them and triggering a cluster-wide domino collapse:
- **Root Cause**: Unconstrained pod placement without \`PriorityClass\` hierarchy or missing resource requests.
- **SRE Remediation**:
  1. Instantly cordon remaining healthy nodes to stop the scheduling wave: \`kubectl cordon -l node-role.kubernetes.io/worker\`.
  2. Scale down non-critical background batch jobs and staging deployments to zero.
  3. Verify that production services have \`PodDisruptionBudgets\` specifying \`minAvailable: 70%\`.
  4. Trigger manual node pool expansion on the cloud provider.
  5. Uncordon nodes progressively as capacity stabilizes.

### 3. Resolving Split-Brain Network Partitions
During network partitions, Kubelet on partitioned nodes stops sending node status heartbeats (\`NodeStatusLease\`). After \`node-monitor-grace-period\` (default 40s), the controller manager marks nodes \`NotReady\`. After \`pod-eviction-timeout\`, StatefulSet pods enter \`Terminating\` state.
- **The StatefulSet Trap**: Kubernetes will *never* automatically recreate a partitioned StatefulSet pod on another node, because doing so could create two instances writing to the same storage simultaneously (data corruption).
- SREs must manually verify that the partitioned physical node is shut down before executing:
\`\`\`bash
kubectl delete pod <stateful-pod> --force --grace-period=0
\`\`\``,
    edgeCasesAndPitfalls: `1. **Executing 'delete pod --force' on Live Partitioned StatefulSets**: Forcing deletion of a StatefulSet pod while the original host is still alive and partitioned can lead to two instances of a database writing to the same underlying cloud disk simultaneously, causing catastrophic data corruption. Always power off the host first.
2. **etcd Restores Overwriting Newer Valid State**: Restoring an etcd snapshot taken 4 hours ago wipes out all namespace, deployment, and secret changes made in the interim. Always take a raw safety copy of the current corrupt \`/var/lib/etcd\` directory before executing any restore.
3. **CoreDNS CrashLoopBackOff Due to Local Resolv.conf Loop**: When systemd-resolved binds to \`127.0.0.53\`, Kubelet copying the host's \`/etc/resolv.conf\` into CoreDNS causes an infinite recursive loop, completely taking down in-cluster DNS. Configure Kubelet with \`--resolv-conf=/run/systemd/resolve/resolv.conf\`.`,
    keyTakeaways: [
      "Losing etcd quorum requires restoring a snapshot to a single node, re-initializing the cluster, and re-adding peers.",
      "Stop cascading node eviction storms by cordoning surviving nodes and enforcing PodDisruptionBudgets.",
      "Never execute kubectl delete pod --force on a StatefulSet without verifying the underlying host is physically powered down.",
      "Always take a point-in-time raw copy of /var/lib/etcd before attempting an etcdctl snapshot restore."
    ]
  }
];
