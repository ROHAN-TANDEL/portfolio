// scripts/data_kubernetes/cat05_scheduling_allocation.cjs
const { card } = require('../k8s_builder_helper.cjs');

const cat = "Scheduling, Affinity & Capacity Allocation";

module.exports = [
  card(
    49,
    cat,
    "The Kubernetes Scheduling Pipeline & Extension Points",
    "must-know",
    "advanced",
    "What are the sequential extension points in the Kubernetes Scheduling Framework (PreFilter, Filter, PreScore, Score, Reserve, Permit, Preempt, Bind)?",
    "The Kubernetes Scheduling Framework divides scheduling into two phases: the Scheduling Cycle (selects the best node via Filter and Score extension points) and the Binding Cycle (executes Reserve, Permit, and Bind to atomically assign the pod to the node).",
    "The pipeline executes sequentially for each unscheduled pod: 1) **PreFilter**: Checks preconditions (e.g. pod readiness); 2) **Filter**: Eliminates nodes that cannot run the pod (insufficient CPU/memory, taint mismatches, port conflicts); 3) **PreScore**: Computes shared metadata for scoring; 4) **Score**: Ranks remaining nodes from 0-100 based on plugins (NodeResourcesBalancedAllocation, ImageLocality, PodTopologySpread); 5) **Reserve**: Tentatively reserves resources in memory; 6) **Permit**: Can delay binding (e.g. gang scheduling); 7) **PreBind**: Performs pre-binding actions (mounting network interfaces); 8) **Bind**: Executes HTTP call to API server to commit the \`Binding\` object.",
    `// Conceptual Scheduling Pipeline Execution:
// [ Unscheduled Pod ] -> PreFilter -> Filter (Drops 15 nodes) -> 5 Feasible Nodes
// -> PreScore -> Score (Ranks Node-02 highest with 94/100 points)
// -> Reserve (Locks resources in scheduler cache)
// -> Permit (Checks gang scheduling barriers)
// -> PreBind -> Bind (POST /api/v1/namespaces/default/pods/my-pod/binding -> Node-02)`,
    "Filtering drops infeasible nodes (Boolean yes/no). Scoring ranks surviving nodes (0-100 score). The highest-scoring node wins the binding.",
    ["scheduling-pipeline", "scheduler-framework", "filtering", "scoring", "kube-scheduler"]
  ),
  card(
    50,
    cat,
    "Resource Requests vs Limits & The CFS Quota Throttling Trap",
    "must-know",
    "intermediate",
    "What is the operational difference between CPU/Memory Requests and Limits, and why do aggressive CPU limits cause severe CFS throttling latency?",
    "Requests dictate scheduling: the scheduler ensures a node has sufficient unallocated requested resources before placing a pod. Limits dictate runtime throttling/killing: if memory exceeds limit, the container is OOMKilled; if CPU exceeds limit, the Linux Completely Fair Scheduler (CFS) throttles CPU cycles.",
    "A common production trap is setting tight CPU limits on multi-threaded runtimes (Node.js, Go, Java). Linux CFS enforces CPU limits using 100ms periods (\`cpu.cfs_quota_us\`). If a container has a 2-core limit (200ms quota) and spawns 8 threads that consume 200ms of CPU in the first 25ms of the period, the Linux kernel **completely freezes all threads for the remaining 75ms of the period**! This causes massive p99 latency spikes and connection drops even when the host node has 60% idle CPU capacity. Best practice in modern Kubernetes: set accurate CPU requests, but omit CPU limits (or set high headroom), while always enforcing hard memory limits.",
    `# Hardened Pod Resources Spec
apiVersion: v1
kind: Pod
metadata:
  name: hardened-api
spec:
  containers:
  - name: api
    image: enterprise/api:v1
    resources:
      requests:
        cpu: "1000m"     # Guaranteed 1 full CPU core for scheduling
        memory: "1Gi"    # Guaranteed 1 GiB RAM
      limits:
        memory: "1Gi"    # Hard ceiling: OOMKills if memory leaks!
        # CPU limit intentionally omitted to eliminate CFS throttling latency spikes!`,
    "Never set strict CPU limits on latency-sensitive APIs. Enforce accurate CPU requests to guide scheduling, and let containers burst into spare node CPU capacity.",
    ["requests-vs-limits", "cfs-throttling", "cpu-quota", "p99-latency", "resource-management"]
  ),
  card(
    51,
    cat,
    "Quality of Service (QoS) Classes: Guaranteed, Burstable & BestEffort",
    "must-know",
    "intermediate",
    "How does Kubernetes derive a Pod's QoS Class (Guaranteed, Burstable, BestEffort) from its resource configuration, and how does QoS dictate node eviction order under resource pressure?",
    "Kubernetes automatically assigns one of three QoS classes based on requests and limits: Guaranteed (requests == limits for both CPU and Memory), Burstable (requests < limits, or at least one request set), and BestEffort (zero requests and zero limits set). Under node resource pressure, BestEffort pods are evicted first, followed by Burstable pods, while Guaranteed pods are evicted last.",
    "QoS is not configured directly; it is calculated: 1) **Guaranteed**: Every container has CPU and Memory requests equal to limits. Guaranteed pods receive top eviction immunity and can use the static CPU Manager policy to bind dedicated physical CPU cores; 2) **Burstable**: Requests are specified but differ from limits (or only requests are set). Burstable pods can burst, but are evicted if node memory exhausts and they exceed their requested values; 3) **BestEffort**: Lowest priority; Kubelet will kill BestEffort pods instantly when node memory or disk pressure occurs.",
    `// QoS Derivation Rules:
// 1. Guaranteed:
//    requests: { cpu: "1", memory: "1Gi" }
//    limits:   { cpu: "1", memory: "1Gi" }  <-- Requests EQUAL Limits!
//
// 2. Burstable:
//    requests: { cpu: "500m", memory: "512Mi" }
//    limits:   { cpu: "2",    memory: "2Gi" }    <-- Requests LESS THAN Limits!
//
// 3. BestEffort:
//    resources: {}  <-- No requests or limits specified!`,
    "For critical databases and payment gateways, configure identical requests and limits to achieve 'Guaranteed' QoS and prevent unexpected node evictions.",
    ["qos-classes", "guaranteed", "burstable", "besteffort", "pod-eviction", "kubelet"]
  ),
  card(
    52,
    cat,
    "OOM Killer & oom_score_adj Calculation",
    "must-know",
    "advanced",
    "How does Kubelet calculate the Linux kernel oom_score_adj for containers, and how does the kernel choose which process to terminate during an OOM event?",
    "When a node runs out of physical memory, the Linux kernel Out-Of-Memory (OOM) Killer terminates processes with the highest oom_score. Kubelet configures /proc/[pid]/oom_score_adj based on the Pod's QoS class: Guaranteed pods get -997 (near-immunity), BestEffort pods get 1000 (killed first), and Burstable pods get a score proportional to their memory request.",
    "The Linux kernel scores processes from 0 to 1000. System daemons (sshd, kubelet, containerd) receive \`-1000\` (completely exempt from OOM killing). Guaranteed pods receive \`-997\`. For Burstable pods, Kubelet calculates: \`oom_score_adj = 1000 - (1000 * memoryRequest / nodeMemoryCapacity)\`. The higher the memory request a container has relative to the node, the lower its score (less likely to be killed). If a Burstable container consumes more memory than it requested, its score climbs, making it the prime target for the kernel's SIGKILL.",
    `# Checking container process oom_score_adj on worker node:
cat /proc/$(pgrep -f "node server.js")/oom_score_adj

# Output Values:
# -997  -> Guaranteed QoS Pod (Near immune)
# 650   -> Burstable QoS Pod (Adjusted based on requested memory)
# 1000  -> BestEffort QoS Pod (First process killed by kernel!)`,
    "If your application is killed with Exit Code 137, inspect 'kubectl describe pod': if 'OOMKilled: true', the Linux kernel killed the process for exceeding memory limits.",
    ["oom-killer", "oom-score-adj", "exit-code-137", "memory-pressure", "linux-kernel"]
  ),
  card(
    53,
    cat,
    "NodeSelector vs Node Affinity: Hard vs Soft Rules",
    "must-know",
    "intermediate",
    "How does Node Affinity expand upon basic nodeSelector, and what is the difference between 'requiredDuringSchedulingIgnoredDuringExecution' and 'preferredDuringSchedulingIgnoredDuringExecution'?",
    "nodeSelector only supports exact key-value string equality. Node Affinity supports rich set-based operators (In, NotIn, Exists, Gt), and separates Hard requirements (requiredDuringScheduling: pod will NOT be scheduled unless condition is met) from Soft preferences (preferredDuringScheduling: scheduler tries to satisfy rule, but schedules anyway if no nodes match).",
    "In Node Affinity: \`requiredDuringSchedulingIgnoredDuringExecution\` is a strict filter: if no node has label \`topology.kubernetes.io/zone=us-east-1a\`, the pod remains \`Pending\`. \`preferredDuringSchedulingIgnoredDuringExecution\` assigns weights (1-100) during the Scoring phase: the scheduler adds points to nodes matching the preference, placing the pod on preferred hardware (e.g. ARM64 nodes) when available, while falling back to x86 nodes if capacity is full.",
    `# Node Affinity: Hard Zone Constraint + Soft Instance Type Preference
apiVersion: v1
kind: Pod
metadata:
  name: affinity-pod
spec:
  affinity:
    nodeAffinity:
      # HARD REQUIREMENT: Must run in us-east-1a or us-east-1b
      requiredDuringSchedulingIgnoredDuringExecution:
        nodeSelectorTerms:
        - matchExpressions:
          - key: topology.kubernetes.io/zone
            operator: In
            values: ["us-east-1a", "us-east-1b"]
      # SOFT PREFERENCE: Prefer high-memory c6i instances if available
      preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 80
        preference:
          matchExpressions:
          - key: node.kubernetes.io/instance-type
            operator: In
            values: ["c6i.4xlarge"]`,
    "'required' is a hard filter; 'preferred' is a weighted scoring boost. Use 'preferred' when you want optimal placement without risking pending pod outages.",
    ["node-affinity", "nodeselector", "hard-vs-soft", "topology-keys", "scheduling-affinity"]
  ),
  card(
    54,
    cat,
    "Pod Affinity & Pod Anti-Affinity: High-Availability Spreading",
    "must-know",
    "intermediate",
    "How does Pod Anti-Affinity prevent single-point-of-failure outages by ensuring multiple replicas of a service never run on the same physical host or failure domain?",
    "Pod Anti-Affinity instructs the scheduler not to place a pod on a node that is already running a pod matching specific label selectors within a given topologyDomain (e.g. kubernetes.io/hostname or topology.kubernetes.io/zone).",
    "If a Deployment has 3 replicas and the scheduler places all 3 on worker node-01, a hardware crash or node reboot takes down 100% of your application. Using \`podAntiAffinity\` with \`topologyKey: kubernetes.io/hostname\` forces the scheduler to place each replica on a physically distinct server. Using \`topologyKey: topology.kubernetes.io/zone\` guarantees replicas are distributed across different availability zones, surviving data center outages.",
    `# Pod Anti-Affinity: Enforce 1 Replica per Physical Host
apiVersion: apps/v1
kind: Deployment
metadata:
  name: redis-cluster
spec:
  replicas: 3
  template:
    metadata:
      labels:
        app: redis
    spec:
      affinity:
        podAntiAffinity:
          # HARD ANTI-AFFINITY: Never place two redis pods on the same node!
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values: ["redis"]
            topologyKey: "kubernetes.io/hostname"`,
    "Hard podAntiAffinity with topologyKey 'kubernetes.io/hostname' means you cannot run more replicas than you have nodes. If you have 3 nodes, you cannot scale to 4 replicas.",
    ["pod-affinity", "pod-anti-affinity", "failure-domain", "high-availability", "topology-key"]
  ),
  card(
    55,
    cat,
    "Taints & Tolerations: Dedicated Node Isolation & Master Protection",
    "must-know",
    "intermediate",
    "How do Taints and Tolerations repel pods from nodes, and what are the three taint effects (NoSchedule, PreferNoSchedule, NoExecute)?",
    "Taints are applied to Nodes to repel pods (unless the pod has a matching Toleration). The three taint effects are: NoSchedule (new non-tolerating pods will not be scheduled), PreferNoSchedule (scheduler tries to avoid node but can place if needed), and NoExecute (immediately evicts existing non-tolerating pods from the node).",
    "Affinity attracts pods to nodes; Taints repel pods from nodes. Taints isolate specialized hardware: 1) **Master Nodes**: Tainted with \`node-role.kubernetes.io/control-plane:NoSchedule\` so standard workloads don't starve the API server; 2) **GPU Instances**: Tainted with \`sku=gpu:NoSchedule\` so cheap web APIs don't consume expensive $10/hr GPU instances; only machine learning pods with matching tolerations can land on them; 3) **Unhealthy Nodes**: Kubelet automatically adds \`node.kubernetes.io/unreachable:NoExecute\`, evicting pods after 300 seconds.",
    `# 1. Tainting a Node (CLI)
kubectl taint nodes gpu-node-01 sku=gpu:NoSchedule

# 2. Pod Toleration allowing placement on tainted GPU node
apiVersion: v1
kind: Pod
metadata:
  name: ml-inference-pod
spec:
  tolerations:
  - key: "sku"
    operator: "Equal"
    value: "gpu"
    effect: "NoSchedule"
  containers:
  - name: model
    image: enterprise/ml-model:v1`,
    "Remember: A toleration does NOT attract a pod to a node; it merely permits the pod to be placed on a tainted node. Pair tolerations with nodeAffinity to attract workloads.",
    ["taints", "tolerations", "noschedule", "noexecute", "node-isolation", "gpu-scheduling"]
  ),
  card(
    56,
    cat,
    "Topology Spread Constraints: Even Zone & Rack Distribution",
    "must-know",
    "intermediate",
    "Why did Topology Spread Constraints succeed Pod Anti-Affinity for even replica distribution across Availability Zones, and how does maxSkew work?",
    "Topology Spread Constraints distribute pods evenly across arbitrary failure domains (zones, racks, nodes) based on a mathematical maxSkew parameter, preventing the 'all-or-nothing' scheduling failures common with strict Pod Anti-Affinity.",
    "Pod Anti-Affinity is binary: either a node has a pod or it doesn't, making it difficult to spread 10 pods evenly across 3 Availability Zones (3 in zone A, 3 in zone B, 4 in zone C). **Topology Spread Constraints** calculate: $Skew = | \text{PodsInTargetTopology} - \text{MinPodsInAnyTopology} |$. Setting \`maxSkew: 1\` with \`whenUnsatisfiable: DoNotSchedule\` guarantees that no zone will ever have more than 1 pod difference compared to any other zone, ensuring perfect fault tolerance.",
    `# Spreading Pods Evenly Across Availability Zones with maxSkew: 1
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-engine
spec:
  replicas: 9
  template:
    metadata:
      labels:
        app: payment-engine
    spec:
      topologySpreadConstraints:
      - maxSkew: 1
        topologyKey: "topology.kubernetes.io/zone"
        whenUnsatisfiable: DoNotSchedule # Hard enforcement
        labelSelector:
          matchLabels:
            app: payment-engine`,
    "Use Topology Spread Constraints instead of podAntiAffinity for production Deployments. It gracefully handles autoscaling across multiple zones.",
    ["topology-spread-constraints", "maxskew", "zone-distribution", "fault-tolerance"]
  ),
  card(
    57,
    cat,
    "PriorityClasses & Pod Preemption Mechanics",
    "must-know",
    "intermediate",
    "How do PriorityClasses govern pod preemption during resource exhaustion, and how does the scheduler evict lower-priority pods to make room for critical workloads?",
    "PriorityClasses assign integer priority values to pods. When a high-priority pod is unschedulable due to resource starvation, the scheduler triggers Preemption: it evicts lower-priority pods from a node, waits for them to terminate, and binds the high-priority pod.",
    "Without PriorityClasses, when a cluster runs out of memory, a critical payment-gateway pod could sit in \`Pending\` while non-critical batch report pods occupy all node resources. Setting up a \`PriorityClass\` (e.g. \`critical-workloads\` with priority 1,000,000) guarantees that the scheduler will evict lower-priority pods (\`priority: 0\`) to immediately free up CPU/memory. Preemption honors PodDisruptionBudgets by default, unless the pod has emergency \`preemptionPolicy: PreemptLowerPriority\`.",
    `# 1. Define Cluster PriorityClass
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: high-priority-payment
value: 1000000
globalDefault: false
description: "Mission-critical payment processing services"

---
# 2. Attach PriorityClass to Pod Spec
apiVersion: v1
kind: Pod
metadata:
  name: payment-core
spec:
  priorityClassName: high-priority-payment
  containers:
  - name: core
    image: enterprise/payment:v1`,
    "Never make a high PriorityClass the globalDefault. Reserve high priority strictly for production services that must preempt batch jobs during capacity crunches.",
    ["priorityclass", "preemption", "scheduler-preemption", "capacity-starvation", "qos"]
  ),
  card(
    58,
    cat,
    "The Kubernetes Descheduler: Remedying Resource Drift",
    "advanced",
    "advanced",
    "Why is the Kubernetes Descheduler needed in mature clusters and what strategies (RemoveDuplicates, LowNodeUtilization) eliminate scheduling fragmentation?",
    "The default kube-scheduler only evaluates nodes at the exact moment a pod is created. Over time, as nodes are added or pods autoscale, clusters suffer from resource fragmentation and imbalance. The Descheduler runs periodically to evict pods that violate updated scheduling policies, forcing them to be rescheduled onto optimal nodes.",
    "Scenarios that cause cluster drift: 1) New nodes added to an autoscaled cluster sit empty while older nodes run at 90% CPU; 2) Node taints or labels were updated, but existing pods continue running; 3) Zone distribution drifts due to pod restarts. The Descheduler evaluates strategies: \`RemoveDuplicates\` (evicts colocated pods of the same deployment), \`LowNodeUtilization\` (evicts pods from over-utilized nodes to balance under-utilized nodes), and \`RemovePodsViolatingInterPodAntiAffinity\`.",
    `# Descheduler Policy Spec
apiVersion: "descheduler/v1alpha2"
kind: "DeschedulerPolicy"
profiles:
  - name: balance-nodes
    pluginConfig:
      - name: "LowNodeUtilization"
        args:
          thresholds:
            "cpu": 20
            "memory": 20
          targetThresholds:
            "cpu": 70
            "memory": 70
    plugins:
      balance:
        enabled:
          - "LowNodeUtilization"
          - "RemoveDuplicates"`,
    "The Descheduler does not schedule pods; it evicts them. It relies on the standard kube-scheduler to reschedule the evicted pods onto optimal nodes.",
    ["descheduler", "cluster-drift", "node-utilization", "fragmentation", "rebalancing"]
  ),
  card(
    59,
    cat,
    "Node Eviction Policies: Hard vs Soft Eviction Thresholds",
    "must-know",
    "advanced",
    "How do Kubelet Node Eviction Thresholds (Hard vs Soft) reclaim disk and memory before Linux kernel OOM panics freeze the worker node?",
    "Kubelet continuously monitors node resources (memory.available, nodefs.available, imagefs.available). Soft Eviction triggers warnings and graceful eviction after an eviction grace period; Hard Eviction triggers immediate termination (SIGKILL) of pods without grace periods to prevent host kernel lockups.",
    "When physical host memory or disk runs out, the Linux kernel can panic or freeze completely. Kubelet proactively manages node pressure via eviction thresholds. If \`memory.available < 100Mi\` (Hard threshold), Kubelet immediately evicts pods based on QoS classes (BestEffort -> Burstable -> Guaranteed). Soft thresholds (\`memory.available < 500Mi\` for \`softGracePeriod: 90s\`) give pods 90 seconds to clean up before eviction begins.",
    `# /var/lib/kubelet/config.yaml - Eviction Thresholds
evictionHard:
  memory.available: "100Mi"     # Immediate eviction if node RAM drops below 100MB
  nodefs.available: "10%"       # Evicts pods if root disk has less than 10% space
  imagefs.available: "15%"      # Triggers container image cleanup
evictionSoft:
  memory.available: "500Mi"     # Triggers soft eviction warnings
evictionSoftGracePeriod:
  memory.available: "90s"
evictionMaxPodGracePeriod: 30`,
    "When a node transitions to 'DiskPressure' or 'MemoryPressure', Kubelet stops accepting new pods and begins evicting existing workloads.",
    ["node-eviction", "hard-eviction", "soft-eviction", "kubelet-pressure", "diskpressure"]
  ),
  card(
    60,
    cat,
    "Custom Schedulers & Scheduling Framework Plugins",
    "advanced",
    "advanced",
    "How can organizations run custom scheduling algorithms or secondary schedulers using the Kubernetes Scheduling Framework?",
    "Kubernetes allows running multiple schedulers concurrently in the same cluster. Workloads specify 'spec.schedulerName: custom-scheduler' to bypass the default scheduler and utilize custom compiled Scheduling Framework plugins (written in Go) for specialized placement.",
    "Use cases for custom schedulers include: gang scheduling for distributed machine learning (Coscheduling: all 16 workers must be scheduled together or none are scheduled), hardware-aware network topologies, or bin-packing cost optimizers. Developers implement Go interfaces (\`FilterPlugin\`, \`ScorePlugin\`) from \`k8s.io/kubernetes/pkg/scheduler/framework\` and compile a custom scheduler binary running as a Deployment in kube-system.",
    `# Pod Consuming a Custom Scheduler
apiVersion: v1
kind: Pod
metadata:
  name: ml-gang-worker
spec:
  # Bypasses default-scheduler! Managed strictly by our custom scheduler:
  schedulerName: "ml-gang-scheduler"
  containers:
  - name: worker
    image: enterprise/trainer:v1`,
    "You do not need to fork Kubernetes to customize scheduling. Write a Go plugin for the official Scheduling Framework and compile it into a secondary scheduler deployment.",
    ["custom-scheduler", "scheduling-framework", "gang-scheduling", "scheduler-name"]
  )
];
