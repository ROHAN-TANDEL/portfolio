// scripts/data_kubernetes/cat10_observability_operations.cjs
const { card } = require('../k8s_builder_helper.cjs');

const cat = "Observability, Operations & Troubleshooting";

module.exports = [
  card(
    109,
    cat,
    "Kubernetes Metrics Architecture: Metrics Server vs Prometheus Operator",
    "must-know",
    "intermediate",
    "What is the difference between Metrics Server and Prometheus Operator in Kubernetes observability?",
    "Kubernetes differentiates between **Resource Metrics** (used for internal autoscaling decisions) and **Full Observability Metrics** (used for alerting, analysis, and capacity planning). Metrics Server is a lightweight, in-memory aggregator providing current CPU and memory consumption solely for HPA and VPA, without historical persistence.",
    "Metrics Server scrapes cAdvisor metrics every 15 seconds, exposing them on the `metrics.k8s.io` sub-API (consumed by `kubectl top nodes` and HPA). It does not store historical time series. Conversely, **Prometheus Operator** deploys a complete monitoring stack with persistent time-series storage, alert evaluation (Alertmanager), dashboards (Grafana), and rich application metrics via custom PromQL.",
    `# 1. Inspecting Resource Metrics from Metrics Server:
$ kubectl top nodes
NAME              CPU(cores)   CPU%   MEMORY(bytes)   MEMORY%
worker-node-1     245m         6%     1850Mi          24%

$ kubectl top pods -n production --sort-by=memory
NAME                           CPU(cores)   MEMORY(bytes)
order-svc-788df67b95-d2s9l     45m          412Mi
payment-svc-5cfb97c55-z7m99    110m         280Mi

# Metrics Server serves the ephemeral metrics.k8s.io API.
# Prometheus persists time series to TSDB for alerting and graphing.`,
    "Metrics Server provides in-memory CPU/RAM snapshots for HPA via metrics.k8s.io; Prometheus persists metrics for alerting and telemetry.",
    ["metrics-server", "prometheus-operator", "hpa-metrics", "kubectl-top", "cadvisor"]
  ),
  card(
    110,
    cat,
    "Prometheus Operator: ServiceMonitors & PodMonitors",
    "must-know",
    "advanced",
    "How do ServiceMonitor and PodMonitor CRDs automate target discovery in Prometheus Operator?",
    "Instead of manually editing a static `prometheus.yml` scrape configuration and reloading the Prometheus process, Prometheus Operator uses declarative Kubernetes custom resources. The Prometheus operator continuously watches `ServiceMonitor` and `PodMonitor` CRDs and dynamically updates the active Prometheus scrape targets.",
    "A `ServiceMonitor` specifies label selectors (`matchLabels`) that discover Kubernetes Services pointing to target endpoints, defining scrape intervals, metrics paths (`/metrics`), authentication, and port names. When new pods or services matching labels spin up anywhere in the cluster, Prometheus automatically begins scraping them without restarts.",
    `apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: order-service-metrics
  namespace: production
  labels:
    release: prometheus-stack # Scraped by this Prometheus instance
spec:
  selector:
    matchLabels:
      app: order-service
  endpoints:
  - port: http-metrics # Must match Service port name
    path: /metrics
    interval: 15s
    scrapeTimeout: 10s`,
    "ServiceMonitors dynamically bind Prometheus scrape configs to Services matching label selectors, eliminating manual config reloads.",
    ["servicemonitor", "podmonitor", "prometheus-operator", "target-discovery", "scrape-config"]
  ),
  card(
    111,
    cat,
    "kube-state-metrics (KSM) vs cAdvisor: Cluster State vs Container Metrics",
    "must-know",
    "advanced",
    "What is the distinct role of kube-state-metrics compared to cAdvisor in Kubernetes monitoring?",
    "cAdvisor (Container Advisor) is embedded inside the Kubelet on every node; it measures **resource utilization** (CPU nanoseconds, memory resident set size, network I/O, disk I/O) directly from Linux cgroups. kube-state-metrics (KSM) is an agent listening to the kube-apiserver; it generates metrics regarding the **health and state of Kubernetes objects**.",
    "cAdvisor answers questions like: *'How many bytes of memory is container order-api consuming?'* (`container_memory_working_set_bytes`). kube-state-metrics answers questions like: *'How many desired replicas does the Deployment have versus ready replicas?'* (`kube_deployment_status_replicas_unavailable`) or *'How many days until an SSL certificate secret expires?'*.",
    `# cAdvisor Metric Example (Resource utilization from cgroups):
container_cpu_usage_seconds_total{pod="api-78f9-x", container="api"} 142.85
container_memory_working_set_bytes{pod="api-78f9-x", container="api"} 524288000

# kube-state-metrics (KSM) Example (Cluster object state from API server):
kube_pod_status_phase{pod="api-78f9-x", phase="Running"} 1
kube_deployment_status_replicas_available{deployment="api"} 3
kube_node_status_condition{condition="Ready", status="true"} 1`,
    "cAdvisor measures low-level cgroup resource consumption; kube-state-metrics translates Kubernetes API object states into time series.",
    ["cadvisor", "kube-state-metrics", "ksm", "resource-metrics", "cluster-health"]
  ),
  card(
    112,
    cat,
    "OpenTelemetry Collector Architecture in Kubernetes (DaemonSet vs Sidecar)",
    "advanced",
    "advanced",
    "How is the OpenTelemetry (OTel) Collector deployed in Kubernetes, and when should you choose DaemonSet versus Sidecar?",
    "The OpenTelemetry Collector receives, processes, and exports traces, metrics, and logs across vendor-neutral backends. In Kubernetes, it is commonly deployed in two primary topologies: as a cluster-wide **DaemonSet** (one agent per node) or as a per-pod **Sidecar** (injected directly alongside application containers).",
    "**DaemonSet Deployment**: Minimizes resource overhead; application pods send telemetry locally over `localhost` or HostIP (`status.hostIP`). Node-level agents enrich telemetry with Kubelet metadata (`k8sattributes` processor). **Sidecar Deployment**: Provides strict isolation, per-service custom sampling rules, and eliminates cross-pod port contention at the expense of higher cluster RAM utilization.",
    `apiVersion: opentelemetry.io/v1alpha1
kind: OpenTelemetryCollector
metadata:
  name: otel-daemonset
  namespace: opentelemetry
spec:
  mode: daemonset
  config: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
    processors:
      batch:
      k8sattributes:
        auth_type: "serviceAccount"
        passthrough: false
    exporters:
      otlp/tempo:
        endpoint: tempo-distributor.monitoring:4317
        tls:
          insecure: true
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [k8sattributes, batch]
          exporters: [otlp/tempo]`,
    "OTel Collectors run as DaemonSets to maximize cluster resource efficiency or as Sidecars for fine-grained per-workload telemetry pipeline isolation.",
    ["opentelemetry", "otel-collector", "distributed-tracing", "daemonset", "k8sattributes"]
  ),
  card(
    113,
    cat,
    "Centralized Logging Architectures: DaemonSet (FluentBit/Vector) vs Sidecar vs Node-Level",
    "must-know",
    "intermediate",
    "How does Kubernetes collect and centralize container logs, and why is the node-level DaemonSet pattern preferred?",
    "Applications in Kubernetes write standard logs to `stdout` and `stderr`. The container runtime redirects streams to JSON/CRI log files on the host node filesystem (`/var/log/pods/` and `/var/log/containers/`). The standard Kubernetes centralized logging architecture uses a **Node-Level DaemonSet** (such as FluentBit, Vector, or Fluentd) running on each node.",
    "The DaemonSet tails host log files, enriches entries with Kubernetes metadata (namespace, pod name, labels, container name via API server or Kubelet API), parses JSON payloads, and forwards them to central log storage (Elasticsearch, OpenSearch, Grafana Loki, or AWS CloudWatch). This approach uses zero application memory and requires no sidecars.",
    `# Node Log Pipeline:
# [Container (stdout/stderr)]
#             │
#             ▼ (Redirected by CRI runtime)
# [/var/log/pods/<ns>_<pod>_<uid>/<container>/0.log]
#             │
#             ▼ (Tailed & Enriched by DaemonSet)
# [FluentBit / Vector DaemonSet Agent]
#             │ (HTTPS Batch Export)
#             ▼
# [Grafana Loki / Elasticsearch / OpenSearch / CloudWatch]`,
    "Centralized logging relies on node-level DaemonSets tailing host /var/log/pods files, enriching streams with K8s metadata without sidecar bloat.",
    ["logging-architecture", "fluentbit", "vector", "stdout-stderr", "var-log-pods"]
  ),
  card(
    114,
    cat,
    "Node Maintenance Lifecycle: Cordoning, Draining & Pod Eviction",
    "must-know",
    "intermediate",
    "What is the lifecycle of safely preparing a node for kernel patching or decommissioning using cordon and drain?",
    "Before rebooting, upgrading, or decommissioning a Kubernetes node, workloads must be safely migrated to prevent application downtime. The process requires two steps: **Cordoning** (marking the node unschedulable so no new pods are placed on it) and **Draining** (safely evicting existing pods using the Eviction API).",
    "`kubectl cordon <node>` sets `spec.unschedulable: true`. `kubectl drain <node>` sends Pod Eviction requests honoring `PodDisruptionBudgets`. If a drain would violate a PDB (e.g. fewer than `minAvailable` replicas ready), the eviction call is rejected, protecting the application from downtime. Flag `--ignore-daemonsets` skips host-level agents, while `--delete-emptydir-data` confirms discarding ephemeral scratch storage.",
    `# 1. Mark node as unschedulable
$ kubectl cordon node-worker-pool-1-abc12

# 2. Drain workloads honoring PodDisruptionBudgets
$ kubectl drain node-worker-pool-1-abc12 \\
    --ignore-daemonsets \\
    --delete-emptydir-data \\
    --grace-period=60 \\
    --timeout=5m

# 3. Perform maintenance / OS updates / Reboot

# 4. Return node to schedulable pool
$ kubectl uncordon node-worker-pool-1-abc12`,
    "Cordoning halts new scheduling; draining uses the Pod Eviction API while strictly honoring PodDisruptionBudgets to eliminate service disruption.",
    ["kubectl-drain", "kubectl-cordon", "node-maintenance", "eviction-api", "pdb-enforcement"]
  ),
  card(
    115,
    cat,
    "Cluster Upgrades with kubeadm: Control Plane & Kubelet Sequential Rollout",
    "must-know",
    "advanced",
    "What is the exact zero-downtime sequence for upgrading a Kubernetes cluster using kubeadm?",
    "Upgrading Kubernetes clusters must strictly adhere to version skew policies (never skipping minor versions, e.g. 1.28 to 1.30 is prohibited; must upgrade 1.28 -> 1.29 -> 1.30). The sequence upgrades primary control plane components first, followed by secondary control plane nodes, and finally worker nodes one by one.",
    "The step-by-step sequence: 1. Upgrade `kubeadm` package; 2. Run `kubeadm upgrade plan` and `kubeadm upgrade apply v1.x.y` (upgrades API server, controller-manager, scheduler, etcd static pod manifests); 3. Drain control plane node; 4. Upgrade `kubelet` and `kubectl`, restart kubelet; 5. Uncordon control plane; 6. For each worker node: cordon & drain, upgrade kubeadm/kubelet, restart kubelet, and uncordon.",
    `# Step 1: Upgrade control plane node
$ sudo apt-mark unhold kubeadm && sudo apt-get update
$ sudo apt-get install -y kubeadm=1.30.0-1.1 && sudo apt-mark hold kubeadm
$ sudo kubeadm upgrade plan
$ sudo kubeadm upgrade apply v1.30.0

# Step 2: Upgrade kubelet & restart
$ sudo apt-mark unhold kubelet kubectl
$ sudo apt-get install -y kubelet=1.30.0-1.1 kubectl=1.30.0-1.1
$ sudo apt-mark hold kubelet kubectl
$ sudo systemctl daemon-reload && sudo systemctl restart kubelet

# Step 3: Upgrade worker nodes sequentially (Drain -> Upgrade -> Uncordon)`,
    "Cluster upgrades proceed sequentially: upgrade kubeadm, apply control plane manifests, upgrade kubelet, and roll worker nodes one node at a time.",
    ["kubeadm-upgrade", "cluster-lifecycle", "version-skew", "control-plane-upgrade", "kubelet-upgrade"]
  ),
  card(
    116,
    cat,
    "etcd Backup & Disaster Recovery: Automated Snapshotting & etcdctl restore",
    "must-know",
    "advanced",
    "How do you perform consistent disaster recovery snapshots and restore an etcd cluster from complete corruption?",
    "etcd holds the complete cluster state. In the event of catastrophic data corruption or accidental control plane deletion, point-in-time recovery requires an etcd snapshot. `etcdctl snapshot save` takes a point-in-time copy of the bbolt database using TLS client certificates.",
    "To restore from disaster: 1. Stop all control plane instances (`kube-apiserver`); 2. Run `etcdctl snapshot restore <snapshot.db> --data-dir=/var/lib/etcd-restored` initializing a new cluster token; 3. Update the static pod manifest (`/etc/kubernetes/manifests/etcd.yaml`) to point host volume mounts to `/var/lib/etcd-restored`; 4. Restart kubelet to launch restored etcd and apiserver.",
    `# 1. Take consistent TLS-authenticated snapshot
$ sudo ETCDCTL_API=3 etcdctl snapshot save /backups/etcd-backup-$(date +%Y%m%d%H%M).db \\
    --endpoints=https://127.0.0.1:2379 \\
    --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
    --cert=/etc/kubernetes/pki/etcd/server.crt \\
    --key=/etc/kubernetes/pki/etcd/server.key

# 2. Verify snapshot integrity
$ sudo ETCDCTL_API=3 etcdctl --write-out=table snapshot status /backups/etcd-backup-20261105.db

# 3. Restore to new directory
$ sudo ETCDCTL_API=3 etcdctl snapshot restore /backups/etcd-backup-20261105.db \\
    --data-dir=/var/lib/etcd-restored \\
    --initial-cluster=master1=https://10.0.0.10:2380 \\
    --initial-cluster-token=etcd-cluster-restore \\
    --initial-advertise-peer-urls=https://10.0.0.10:2380`,
    "Disaster recovery requires TLS-authenticated etcd snapshots restored to clean data directories before relaunching kube-apiserver static pods.",
    ["etcd-backup", "etcdctl-restore", "disaster-recovery", "bbolt-snapshot", "control-plane-recovery"]
  ),
  card(
    117,
    cat,
    "Troubleshooting CrashLoopBackOff: Exit Codes 0, 1, 137, 139 & 143",
    "must-know",
    "intermediate",
    "How do Linux container exit codes pinpoint the exact root cause of CrashLoopBackOff errors in Kubernetes?",
    "When a container exits unexpectedly, Kubelet restarts it with exponential delays (10s, 20s, 40s... up to 5m), labeling the Pod `CrashLoopBackOff`. Inspecting `kubectl describe pod <name>` and `kubectl logs <name> --previous` provides the terminating container's numeric **Exit Code**, which pinpoints the root failure.",
    "**Exit Code 0**: Application completed normally (often an interactive CLI container missing a persistent foreground process). **Exit Code 1/2**: Application runtime crash (uncaught exception, missing environment variable, syntax error). **Exit Code 137 (128 + 9 / SIGKILL)**: Pod was killed by the Linux Out-Of-Memory (OOM) killer (`OOMKilled: true`) for exceeding memory limits. **Exit Code 139 (SIGSEGV)**: Segmentation fault in native C/Rust binary. **Exit Code 143 (128 + 15 / SIGTERM)**: Pod was terminated gracefully by Kubernetes.",
    `# Diagnostic Workflow:
$ kubectl describe pod payment-api-687f8b9d-4kx2l
# Look under 'Containers' -> 'Last State':
# Reason: OOMKilled
# Exit Code: 137   <-- Memory Limit Exceeded!

# View crash stack trace from terminated container:
$ kubectl logs payment-api-687f8b9d-4kx2l --previous

# Check kernel dmesg for OOM kills:
$ sudo dmesg -T | grep -i oom-killer`,
    "Container exit codes identify failure modes: 137 indicates OOMKilled exceeding memory limits; 1/2 indicates uncaught code exceptions.",
    ["crashloopbackoff", "exit-codes", "oomkilled", "sigkill-137", "pod-troubleshooting"]
  ),
  card(
    118,
    cat,
    "Troubleshooting ImagePullBackOff, ErrImagePull & Registry Authentication",
    "must-know",
    "intermediate",
    "What causes ImagePullBackOff and ErrImagePull, and how do you resolve registry authentication and network pull failures?",
    "`ImagePullBackOff` indicates Kubelet failed to pull the container image from the container registry. Common causes include: 1. Image tag does not exist or has a typo; 2. Missing or expired private registry credentials; 3. Network firewalls blocking outbound registry traffic; 4. Docker Hub rate limiting.",
    "To diagnose, run `kubectl describe pod <name>` and inspect the **Events** section. If the error is `401 Unauthorized` or `403 Forbidden`, create an `imagePullSecret` using `kubectl create secret docker-registry` and link it under `spec.imagePullSecrets` or attach it directly to the ServiceAccount. If Docker Hub rate limits are hit (`429 Too Many Requests`), configure an authenticated pull-through cache.",
    `# 1. Create Docker Registry Secret
$ kubectl create secret docker-registry registry-credential \\
    --docker-server=registry.example.com \\
    --docker-username=robot$prod \\
    --docker-password='secret-token' \\
    --docker-email=ops@example.com

# 2. Attach secret to Workload manifest
apiVersion: v1
kind: Pod
metadata:
  name: private-app
spec:
  imagePullSecrets:
  - name: registry-credential
  containers:
  - name: app
    image: registry.example.com/finance/order-service:v2.1.0`,
    "ErrImagePull arises from typos, missing imagePullSecrets, or registry rate limits; inspect pod events to diagnose auth versus network failures.",
    ["imagepullbackoff", "errimagepull", "imagepullsecrets", "docker-registry", "container-pull"]
  ),
  card(
    119,
    cat,
    "Troubleshooting Pending Pods: Scheduler Events, Affinity & Quota Exhaustion",
    "must-know",
    "intermediate",
    "Why do Pods remain trapped in Pending state, and how do you resolve scheduling bottlenecks?",
    "A Pod remains stuck in `Pending` state when `kube-scheduler` is unable to place it on any node during the Filtering/Predicates phase. The definitive diagnostic tool is `kubectl describe pod <name>`, which prints the exact predicate failures returned by the scheduler.",
    "Common causes: 1. **Insufficient CPU/Memory**: Node capacity cannot accommodate container requests (`0/10 nodes are available: 10 Insufficient cpu`); 2. **Taints and Tolerations**: Pod lacks tolerations for node taints (`node(s) had untolerated taint`); 3. **Affinity Mismatches**: `nodeSelector` or `nodeAffinity` matches zero nodes; 4. **Volume Binding**: Unbound PVC with `volumeBindingMode: WaitForFirstConsumer`; 5. **ResourceQuota**: Namespace has exhausted its compute quota.",
    `# Check scheduler failure reasons in Pod events:
$ kubectl describe pod batch-worker-7df9-m2k19

# Events:
# Type     Reason            Message
# ----     ------            -------
# Warning  FailedScheduling  0/8 nodes are available:
#                            3 node(s) had untolerated taint {dedicated: gpu},
#                            5 Insufficient memory.

# Solution:
# 1. Scale cluster node pool (Trigger Cluster Autoscaler or Karpenter)
# 2. Add required toleration for GPU nodes if workload requires it
# 3. Downsize pod resource requests if over-provisioned`,
    "Pending pods result from unschedulable predicates (insufficient CPU/RAM, untolerated taints, or unbound PVCs) displayed in describe events.",
    ["pending-pods", "scheduler-predicates", "insufficient-cpu", "unbound-pvc", "failed-scheduling"]
  ),
  card(
    120,
    cat,
    "Multi-Cluster Management & Federation: Fleet, Karmada & Cluster API (CAPI)",
    "advanced",
    "advanced",
    "How do Cluster API (CAPI) and multi-cluster orchestrators like Karmada manage fleets of Kubernetes clusters declaratively?",
    "As enterprise architectures scale, managing single large clusters gives way to multi-cluster fleets across regions and clouds. **Cluster API (CAPI)** treats Kubernetes clusters themselves as declarative resources: clusters, control planes, and worker machines are provisioned and upgraded using CRDs (`Cluster`, `MachineDeployment`, `KubeadmControlPlane`) via GitOps.",
    "For workload distribution, engines like **Karmada** and **Open Cluster Management (OCM)** provide centralized multi-cluster federation. Administrators deploy resources to a Karmada control plane, which propagates workloads across child clusters based on geo-redundancy, failover, and compliance propagation policies, presenting a single unified multi-cloud fabric.",
    `# Declarative Cluster Provisioning with Cluster API (CAPI)
apiVersion: cluster.x-k8s.io/v1beta1
kind: Cluster
metadata:
  name: prod-eu-west-cluster
  namespace: default
spec:
  clusterNetwork:
    pods:
      cidrBlocks: ["192.168.0.0/16"]
    services:
      cidrBlocks: ["10.96.0.0/12"]
  infrastructureRef:
    apiVersion: infrastructure.cluster.x-k8s.io/v1beta1
    kind: AWSCluster
    name: prod-eu-west-cluster
  controlPlaneRef:
    apiVersion: controlplane.cluster.x-k8s.io/v1beta1
    kind: KubeadmControlPlane
    name: prod-eu-west-control-plane`,
    "Cluster API and Karmada treat clusters as declarative Kubernetes resources, enabling automated multi-cluster fleet provisioning and governance.",
    ["cluster-api", "capi", "karmada", "multi-cluster", "cluster-federation"]
  )
];
