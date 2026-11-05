// scripts/data_kubernetes/cat01_architecture_controlplane.cjs
const { card } = require('../k8s_builder_helper.cjs');

const cat = "Control Plane & Node Architecture";

module.exports = [
  card(
    1,
    cat,
    "Kubernetes Control Plane Topology",
    "must-know",
    "intermediate",
    "What are the core components of the Kubernetes Control Plane and how do they interact to manage cluster state?",
    "The Kubernetes Control Plane consists of four primary components: kube-apiserver (the REST gateway and single source of truth), etcd (distributed consistent key-value store), kube-scheduler (assigns unscheduled pods to nodes), and kube-controller-manager (executes reconciliation loops).",
    "All control plane communication flows strictly through the kube-apiserver. Components never communicate directly with each other or directly with etcd: 1) kube-apiserver is stateless, horizontally scalable, authenticates requests, evaluates admission webhooks, and writes validated state to etcd; 2) etcd stores cluster state with strong Raft consensus; 3) kube-scheduler watches for unscheduled pods and runs filtering and scoring algorithms to bind pods to healthy nodes; 4) kube-controller-manager runs non-terminating loops (DeploymentController, NodeController, ReplicaSetController) that continuously compare actual state against desired state and issue corrective API mutations.",
    `# High-Availability Control Plane Interaction Flow
# 1. Developer sends: kubectl apply -f deployment.yaml
# 2. kube-apiserver: Authenticates, Authorizes (RBAC), Mutates/Validates (Webhooks)
# 3. kube-apiserver writes deployment object to etcd (MVCC Revision N)
# 4. kube-controller-manager (DeploymentController) detects change via WATCH API
# 5. DeploymentController creates ReplicaSet; ReplicaSetController creates Pods
# 6. kube-scheduler watches unscheduled Pods -> Assigns Pod to Node-02 via Binding API
# 7. Kubelet on Node-02 receives Pod spec via WATCH -> Calls containerd CRI to start container`,
    "Remember the golden rule: No component in Kubernetes speaks directly to etcd except kube-apiserver. Everything else is a client of the API server via Watch streams.",
    ["control-plane", "apiserver", "etcd", "scheduler", "controller-manager"]
  ),
  card(
    2,
    cat,
    "etcd Raft Consensus & Quorum Architecture",
    "must-know",
    "advanced",
    "Why does etcd require an odd number of members and how does Raft consensus prevent split-brain during network partitions?",
    "etcd uses the Raft consensus algorithm, which mandates a strict majority quorum: Quorum = floor(N / 2) + 1. An odd number of nodes (3, 5) tolerates the same number of failures as the next even number (4, 6) without wasting resources or risking split-brain ties.",
    "A 3-node etcd cluster requires 2 nodes for quorum and tolerates 1 node failure ($3 - 2 = 1$). A 4-node cluster requires 3 nodes for quorum and still tolerates only 1 failure ($4 - 3 = 1$), while doubling the risk of split quorum ties during network partitions. In Raft, a leader cannot commit write transactions to the Multi-Version Concurrency Control (MVCC) log without acknowledgments from a quorum of followers. If a network partition splits a 5-node cluster into 3 nodes and 2 nodes, the 3-node partition maintains quorum and continues writing, while the 2-node minority partition refuses writes, preventing split-brain state divergence.",
    `# Checking etcd cluster health and Raft leader status
ETCDCTL_API=3 etcdctl \\
  --endpoints=https://10.0.0.10:2379,https://10.0.0.11:2379,https://10.0.0.12:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key \\
  endpoint status --write-out=table

# Expected Output shows IS LEADER: true for exactly ONE node and matching RAFT REVISION.`,
    "Quorum formula: floor(N/2) + 1. Always use 3 nodes for small/medium clusters, and 5 nodes for high-throughput production clusters. Never use even numbers.",
    ["etcd", "raft-consensus", "quorum", "split-brain", "distributed-storage"]
  ),
  card(
    3,
    cat,
    "Kubelet Node Agent & Pod Lifecycle Event Generator (PLEG)",
    "must-know",
    "intermediate",
    "What is the internal architecture of the Kubelet on worker nodes and what causes PLEG (Pod Lifecycle Event Generator) timeout alerts?",
    "The Kubelet is the primary node agent that registers the node with the API server, interacts with the container runtime via the Container Runtime Interface (CRI), executes health probes, mounts storage volumes, and reports pod status.",
    "The Pod Lifecycle Event Generator (PLEG) is a subsystem within Kubelet that periodically polls the container runtime (containerd/CRI-O) to detect container state changes (e.g. running, exited) and translate them into internal lifecycle events. A 'PLEG is not healthy' alert occurs when the runtime poll takes longer than 3 minutes. Root causes include: 1) Container runtime lockup due to kernel deadlocks or unresponsive D-Bus calls; 2) Excessive number of pods/containers on a single node (thousands of dead containers not garbage-collected); 3) High disk I/O latency blocking runtime socket queries.",
    `# Inspecting Kubelet logs for PLEG timeout errors
journalctl -u kubelet -e | grep -i "pleg"

# Sample error log:
# "PLEG is not healthy: pleg was last seen active 3m12s ago; threshold is 3m0s"
# Remediations:
# 1. Inspect containerd socket responsiveness: crictl ps
# 2. Force containerd garbage collection: crictl rm $(crictl ps -a -q)
# 3. Restart container runtime: systemctl restart containerd`,
    "When a node transitions to 'NotReady', check Kubelet logs immediately for PLEG timeouts. It usually indicates container runtime or disk I/O saturation, not Kubelet code crashes.",
    ["kubelet", "pleg", "node-agent", "cri", "containerd"]
  ),
  card(
    4,
    cat,
    "Container Runtime Interface (CRI): containerd vs CRI-O vs Docker",
    "must-know",
    "intermediate",
    "What is the Container Runtime Interface (CRI) and why was direct Docker daemon support (Dockershim) removed in Kubernetes 1.24?",
    "CRI is a gRPC plugin interface that allows Kubelet to consume diverse container runtimes without recompiling Kubernetes. Dockershim was removed because Docker is not CRI-compliant, requiring an inefficient intermediary translation shim between Kubelet and containerd.",
    "Historically, Kubelet had hardcoded support for Docker. When Docker executed containers, it forwarded calls to its internal containerd daemon, which then invoked runc (the OCI specification runner). This extra hop added latency and memory bloat. Modern Kubernetes communicates directly with standard CRI-compliant runtimes: containerd or CRI-O via Unix domain sockets (/run/containerd/containerd.sock), eliminating the Docker daemon entirely and executing OCI images with lower resource consumption.",
    `// CRI Architecture Hierarchy:
// Kubelet
//   | (gRPC calls via /run/containerd/containerd.sock)
//   v
// containerd (Runtime Service & Image Service)
//   | (Invokes low-level OCI specification runtime)
//   v
// runc (Configures Linux cgroups, namespaces, and execs container process)`,
    "Kubernetes does not need Docker to run Docker-built images. Any OCI-compliant image runs natively on containerd and CRI-O.",
    ["cri", "dockershim", "containerd", "cri-o", "runc", "oci"]
  ),
  card(
    5,
    cat,
    "Kube-Proxy Modes: iptables vs IPVS vs eBPF (Cilium)",
    "must-know",
    "intermediate",
    "How does kube-proxy implement ClusterIP service routing and how do iptables, IPVS, and eBPF (Cilium) compare in throughput at scale?",
    "Kube-proxy programs kernel packet-forwarding rules to map virtual Service ClusterIPs to healthy backend Pod IPs. IPVS and eBPF scale to tens of thousands of services with O(1) hash lookups, whereas iptables uses sequential O(N) rule evaluations that degrade CPU under large clusters.",
    "In iptables mode, kube-proxy writes sequential netfilter chains: for every service and endpoint, sequential iptables rules are appended. In a cluster with 5,000 services and 20,000 pods, the kernel must evaluate thousands of linear rules per packet, causing high CPU usage and multi-second sync locks. In IPVS mode, the kernel uses in-memory IPVS hash tables with O(1) lookup speed and supports load balancing algorithms (least connection, round robin). In modern eBPF mode (Cilium Kube-Proxy Replacement), packet translation executes directly in the Linux socket/tc layer via eBPF bytecode, completely bypassing netfilter and connection tracking (conntrack).",
    `# Checking kube-proxy running mode
kubectl -n kube-system logs -l k8s-app=kube-proxy | grep "Using iptables Proxier"

# Converting kube-proxy to IPVS mode in ConfigMap:
# apiVersion: kubeproxy.config.k8s.io/v1alpha1
# kind: KubeProxyConfiguration
# mode: "ipvs"
# ipvs:
#   scheduler: "rr" # Round Robin`,
    "For clusters exceeding 1,000 services, migrate from iptables to IPVS or Cilium eBPF to eliminate conntrack race conditions and netfilter CPU saturation.",
    ["kube-proxy", "iptables", "ipvs", "ebpf", "cilium", "service-routing"]
  ),
  card(
    6,
    cat,
    "Declarative Reconciliation & The Level-Triggered Controller Pattern",
    "must-know",
    "intermediate",
    "What is the difference between Edge-Triggered and Level-Triggered architectures, and why does Kubernetes use Level-Triggered reconciliation loops?",
    "Edge-triggered systems act only when a state change event occurs (vulnerable to missing dropped events). Level-triggered reconciliation loops continuously observe the current state, compare it to desired state, and execute idempotent corrective actions, guaranteeing eventual consistency even after network partitions or missed notifications.",
    "In Kubernetes, controllers implement the loop: \`Reconcile(Request) -> (Result, error)\`. If an event is missed during an API server reboot or network timeout, a level-triggered system does not fail: on the next loop tick (or periodic resync every 10 hours), the controller inspects the actual world (e.g. 2 pods running) against desired world in etcd (3 pods requested) and issues \`CreatePod\` to converge state. State reconciliation is idempotent: running the loop 10 times produces the exact same state as running it once.",
    `// Conceptual Kubernetes Controller Reconciliation Loop
func (r *DeploymentReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    // 1. Fetch desired state from API server cache
    deployment := &apps.Deployment{}
    if err := r.Get(ctx, req.NamespacedName, deployment); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }

    // 2. Fetch actual state (matching pods currently running in cluster)
    actualPods := &core.PodList{}
    r.List(ctx, actualPods, client.InNamespace(req.Namespace), client.MatchingLabels(deployment.Spec.Selector.MatchLabels))

    // 3. Level-Triggered Convergence: Actual vs Desired
    diff := deployment.Spec.Replicas - len(actualPods.Items)
    if diff > 0 {
        r.scaleUp(diff)
    } else if diff < 0 {
        r.scaleDown(-diff)
    }

    return ctrl.Result{}, nil // Reconciled successfully!
}`,
    "Kubernetes controllers do not assume they receive every event. They continuously observe current state and drive it toward desired state.",
    ["reconciliation-loop", "level-triggered", "eventual-consistency", "controller-pattern"]
  ),
  card(
    7,
    cat,
    "kube-apiserver Request Processing Pipeline",
    "must-know",
    "advanced",
    "What are the sequential stages an HTTP request traverses inside the kube-apiserver before state is committed to etcd?",
    "An incoming request to kube-apiserver passes through five sequential stages: 1) Authentication (AuthN); 2) Authorization (AuthZ / RBAC); 3) Mutating Admission Webhooks; 4) Schema Validation; 5) Validating Admission Webhooks. Only after all 5 stages pass is data written to etcd.",
    "If an unauthenticated request arrives, it is rejected at Stage 1 (401). If the subject lacks RBAC permissions, it is rejected at Stage 2 (403). Stage 3 (Mutating Admission) can alter the object (e.g. injecting sidecar proxies or setting default storage classes). Stage 4 checks structural OpenAPI schema rules. Stage 5 (Validating Admission, e.g. Kyverno/Gatekeeper) evaluates policy constraints without modifying the object; if a policy fails, the request is rejected with 400/403. Finally, the API server executes etcd compare-and-swap (CAS) to commit the new revision.",
    `// kube-apiserver Pipeline Stages:
// [ HTTP Request: POST /api/v1/namespaces/default/pods ]
//       |
//       v 1. Authentication (X.509 cert, Bearer token, OIDC)
//       v 2. Authorization (RBAC: Can user 'X' create pods in 'default'?)
//       v 3. Mutating Webhooks (Inject Envoy sidecar, apply default CPU limits)
//       v 4. Object Schema Validation (Enforce OpenAPI types)
//       v 5. Validating Webhooks (Reject if container runs as root / lacks team label)
//       |
//       v 6. etcd Write: Key '/registry/pods/default/my-pod' written with revision!`,
    "Mutating webhooks ALWAYS run before Validating webhooks. This guarantees validating webhooks can inspect the final mutated object before it commits to etcd.",
    ["apiserver-pipeline", "authentication", "authorization", "admission-controllers", "mutating-webhooks"]
  ),
  card(
    8,
    cat,
    "Admission Webhooks & failurePolicy Fail-Open vs Fail-Closed",
    "must-know",
    "intermediate",
    "What is the difference between 'failurePolicy: Ignore' and 'failurePolicy: Fail' in Kubernetes Dynamic Admission Webhooks, and what risk does each introduce?",
    "'failurePolicy: Fail' (Fail-Closed) rejects the API request if the webhook server times out or is unreachable, maximizing security but risking cluster-wide control plane outages. 'failurePolicy: Ignore' (Fail-Open) permits the request on webhook failure, preserving availability but risking unvalidated/insecure workloads entering the cluster.",
    "If a ValidatingWebhookConfiguration uses \`failurePolicy: Fail\` and the webhook pod crashes or its network policy blocks traffic from the control plane: no new pods, deployments, or cert-manager certificates can be created cluster-wide! Even critical kube-system pods can be blocked from restarting. To mitigate this disaster: 1) Always configure \`namespaceSelector\` to exclude \`kube-system\` and the webhook's own namespace; 2) Run at least 3 replicas of the webhook with PodDisruptionBudgets; 3) Set aggressive webhook timeouts (\`timeoutSeconds: 3\`).",
    `# Hardened ValidatingWebhookConfiguration
apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: security-policy-webhook
webhooks:
  - name: policy.enterprise.com
    clientConfig:
      service:
        name: policy-validator
        namespace: security-tools
        path: /validate
    failurePolicy: Fail
    timeoutSeconds: 3
    # CRITICAL: Exclude system namespaces so webhook crashes do not break core K8s!
    namespaceSelector:
      matchExpressions:
        - key: kubernetes.io/metadata.name
          operator: NotIn
          values: ["kube-system", "security-tools"]
    rules:
      - operations: ["CREATE", "UPDATE"]
        apiGroups: [""]
        apiVersions: ["v1"]
        resources: ["pods"]`,
    "Never target the kube-system namespace with 'failurePolicy: Fail' webhooks. If the webhook goes down, core DNS and CNI pods cannot restart.",
    ["admission-webhooks", "failure-policy", "validating-webhooks", "control-plane-safety"]
  ),
  card(
    9,
    cat,
    "etcd MVCC Revision Model & Compaction",
    "advanced",
    "advanced",
    "How does etcd's Multi-Version Concurrency Control (MVCC) enable watch streams and why is periodic database compaction mandatory to avoid 'database space exceeded' errors?",
    "etcd never overwrites keys in place; every write, update, and delete increments a global 64-bit revision counter, appending a new version to the MVCC bbolt b-tree storage engine. Periodic compaction and defragmentation are required to reclaim disk space from historical revisions.",
    "Because historical revisions are retained, clients can query state at exact historical points (\`--rev=N\`) or open Watch streams to replay all events starting from revision $X$ without missing updates. However, high-churn clusters (frequent pod restarts, leader elections, leases) accumulate millions of historical revisions, causing etcd's database file to hit its default quota (2GB). Once full, etcd enters a read-only mode, rejecting all API writes with 'database space exceeded'. Production clusters run automated compaction (\`--auto-compaction-retention=5m\`) and periodic defragmentation jobs.",
    `# Clearing etcd 'database space exceeded' alarm in production:
# 1. Compact historical revisions up to current revision
REV=$(ETCDCTL_API=3 etcdctl --endpoints=https://127.0.0.1:2379 endpoint status --write-out="json" | jq .[0].Status.header.revision)
ETCDCTL_API=3 etcdctl compact $REV

# 2. Defragment backend bbolt database to release disk space to OS
ETCDCTL_API=3 etcdctl defrag

# 3. Disarm the space quota alarm to restore cluster writes!
ETCDCTL_API=3 etcdctl alarm disarm`,
    "Compaction marks dead MVCC pages as reusable within etcd; defragmentation (defrag) actually releases physical disk space back to the Linux filesystem.",
    ["etcd", "mvcc", "compaction", "defragmentation", "storage-quota"]
  ),
  card(
    10,
    cat,
    "Static Pods & The Bootstrapping Problem",
    "must-know",
    "intermediate",
    "What are Static Pods, how does Kubelet manage them without an API server, and how are they used by kubeadm to bootstrap the control plane?",
    "Static Pods are pods managed directly by the Kubelet on a specific node without control plane API server oversight, defined by placing manifest YAML files in a designated host directory (/etc/kubernetes/manifests).",
    "Static pods solve the 'chicken-and-egg' bootstrapping problem: How can Kubernetes schedule and run the kube-apiserver, etcd, and kube-scheduler as containers if the API server and scheduler don't exist yet? During cluster bootstrap (\`kubeadm init\`), the host installs Kubelet and drops \`kube-apiserver.yaml\`, \`etcd.yaml\`, and \`kube-controller-manager.yaml\` into \`/etc/kubernetes/manifests\`. The Kubelet watches this local directory, spawns the control plane containers via containerd, and automatically creates corresponding read-only 'Mirror Pods' in the API server once it comes online.",
    `# Inspecting static pod manifests on control plane node
ls -l /etc/kubernetes/manifests/
# Outputs:
# - etcd.yaml
# - kube-apiserver.yaml
# - kube-controller-manager.yaml
# - kube-scheduler.yaml

# Modifying flags (e.g. adding OIDC flags to kube-apiserver):
# Simply edit /etc/kubernetes/manifests/kube-apiserver.yaml!
# Kubelet detects file modification and restarts the pod automatically within 10s.`,
    "Static pods are not scheduled by kube-scheduler and cannot be deleted with 'kubectl delete'. They are controlled exclusively by the host directory manifests.",
    ["static-pods", "kubeadm", "bootstrap", "kubelet", "control-plane-init"]
  ),
  card(
    11,
    cat,
    "Garbage Collection in Kubernetes: Dead Pods, Images & Finalizers",
    "must-know",
    "intermediate",
    "How does Kubernetes Garbage Collection clean up orphaned resources, unreferenced container images, and how do Finalizers prevent premature deletion?",
    "Kubernetes Garbage Collection operates through three mechanisms: 1) Kubelet image garbage collection (deleting unreferenced container images when disk exceeds HighThresholdPercent); 2) OwnerReferences cascading deletion (deleting child Pods when a Deployment is deleted); 3) Finalizers (pre-delete hooks that block object removal until external cleanup completes).",
    "When a resource has an \`ownerReferences\` field (e.g. a Pod owned by a ReplicaSet), deleting the parent Deployment triggers the garbage collector to delete all children automatically (via \`propagationPolicy: Foreground\` or \`Background\`). A **Finalizer** is an entry in \`metadata.finalizers\` (e.g. \`kubernetes.io/pv-protection\`). When an object with a finalizer is deleted, Kubernetes sets \`deletionTimestamp\`, but keeps the object in etcd in a 'Terminating' state until the associated controller performs cleanup and removes the finalizer string.",
    `# Removing stuck finalizer causing an object to hang in 'Terminating' state:
kubectl get namespace stuck-namespace -o json | \\
  jq '.spec.finalizers = []' | \\
  kubectl replace --raw "/api/v1/namespaces/stuck-namespace/finalize" -f -

# Kubelet image garbage collection thresholds in kubelet-config.yaml:
# imageGCHighThresholdPercent: 85 # Starts deleting unused images when disk hits 85%
# imageGCLowThresholdPercent: 80  # Stops deleting once disk drops to 80%`,
    "If a pod or namespace is stuck in 'Terminating', inspect metadata.finalizers. An external operator or controller is likely failing to finish its pre-delete hook.",
    ["garbage-collection", "finalizers", "owner-references", "image-gc", "terminating-state"]
  ),
  card(
    12,
    cat,
    "High-Availability Control Plane: Stacked vs External etcd Topology",
    "advanced",
    "advanced",
    "What are the architectural tradeoffs between Stacked Control Plane Topology and External etcd Topology in production Kubernetes clusters?",
    "In a Stacked Topology, etcd runs as static pods colocated on the exact same master nodes as kube-apiserver; in an External etcd Topology, etcd runs on a dedicated, isolated cluster of separate compute nodes.",
    "Stacked topology is the default in kubeadm/EKS: it requires fewer physical/cloud servers (3 nodes total for HA), but couples etcd's disk I/O and memory usage with API server spikes. If an API server saturates node memory or disk I/O during heavy loads, etcd suffers heartbeat timeouts and drops leader election. External etcd topology decouples control plane compute from storage: 3 API server nodes + 3 dedicated etcd nodes with high-IOPS NVMe disks. External topology offers maximum resilience against blast radius propagation at the cost of managing 6 nodes instead of 3.",
    `// Topology Comparison:
// 1. Stacked HA Topology (3 Nodes):
// [ Master 1: apiserver + etcd-1 ] <-\
// [ Master 2: apiserver + etcd-2 ] <--> (Raft Sync over local/private network)
// [ Master 3: apiserver + etcd-3 ] <-/

// 2. External etcd HA Topology (6 Nodes - Enterprise Gold Standard):
// [ Control Plane 1: apiserver ]  [ Control Plane 2 ]  [ Control Plane 3 ]
//                 \                       |                       /
//                  v                      v                      v
//              [ etcd Node 1 ] <---> [ etcd Node 2 ] <---> [ etcd Node 3 ]`,
    "For enterprise clusters with high pod churn, external etcd with dedicated high-IOPS SSDs (minimum 3,000 IOPS) prevents control plane API server lockups.",
    ["high-availability", "stacked-etcd", "external-etcd", "cluster-topology", "production-ha"]
  )
];
