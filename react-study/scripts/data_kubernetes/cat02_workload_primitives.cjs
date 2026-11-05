// scripts/data_kubernetes/cat02_workload_primitives.cjs
const { card } = require('../k8s_builder_helper.cjs');

const cat = "Workload Primitives & Pod Lifecycle";

module.exports = [
  card(
    13,
    cat,
    "The Pod as Atomic Scheduling Unit & Shared Linux Namespaces",
    "must-know",
    "intermediate",
    "Why is a Pod, rather than an individual container, the atomic unit of scheduling in Kubernetes, and what kernel namespaces are shared between containers in a Pod?",
    "A Pod encapsulates one or more closely coupled containers that share the same Network namespace (IP address and port space), IPC namespace (inter-process communication), and storage volumes, while maintaining isolated PID (by default) and Mount namespaces.",
    "Scheduling single containers independently would break multi-container patterns (e.g. an application container logging to local shared memory, and a log-shipping sidecar reading it). Inside a Pod: 1) The 'pause' container is created first to anchor the network namespace; 2) All containers in the Pod share \`localhost\` networking and can communicate via IPC shared memory; 3) Storage volumes mounted in a Pod are shared across containers in that Pod. Kubernetes schedules the entire Pod onto a single node as an indivisible atomic unit.",
    `# Demonstrating Shared localhost Networking between containers in a single Pod
apiVersion: v1
kind: Pod
metadata:
  name: multi-container-pod
spec:
  containers:
  - name: web-app
    image: nginx
    ports:
    - containerPort: 80
  - name: sidecar-proxy
    image: curlimages/curl
    # Sidecar can reach web-app directly on 127.0.0.1:80!
    command: ["/bin/sh", "-c", "while true; do curl -s http://127.0.0.1; sleep 10; done"]`,
    "Containers in the same pod share IP address and port space. Two containers in the same pod CANNOT bind to the exact same TCP port (port conflict).",
    ["pod-internals", "pause-container", "shared-namespaces", "sidecar-pattern", "atomic-unit"]
  ),
  card(
    14,
    cat,
    "Pod Lifecycle Phases & Transitions",
    "must-know",
    "intermediate",
    "What are the five official Pod Lifecycle Phases (Pending, Running, Succeeded, Failed, Unknown) and how do conditions differ from phases?",
    "A Pod's \`phase\` is a high-level summary of its state machine: Pending (accepted but awaiting scheduling or image pulling), Running (bound to a node with at least one container executing), Succeeded (all containers exited 0), Failed (at least one container exited non-zero), and Unknown (node communication lost).",
    "While \`phase\` is a broad category, Pod \`Conditions\` provide fine-grained diagnostic status: \`PodScheduled\` (bound to node), \`ContainersReady\` (all containers ready), \`Initialized\` (init containers finished), and \`Ready\` (passing readiness probe and eligible to receive Service traffic). A pod can be in the \`Running\` phase while its \`Ready\` condition is \`False\` (e.g. warming up caches), meaning it does not receive traffic from Services.",
    `# Inspecting Pod Conditions vs Phase
kubectl get pod api-worker -o json | jq '.status.conditions'
# Output shows array:
# [
#   { "type": "PodScheduled", "status": "True" },
#   { "type": "Initialized", "status": "True" },
#   { "type": "ContainersReady", "status": "False" }, <-- Warming up!
#   { "type": "Ready", "status": "False" }            <-- Excluded from Service!
# ]`,
    "Never rely solely on 'status.phase == Running' to determine service health. Always check 'status.conditions[type=Ready].status == True'.",
    ["pod-lifecycle", "pod-phase", "pod-conditions", "readiness-state"]
  ),
  card(
    15,
    cat,
    "Container Probes: Liveness vs Readiness vs Startup",
    "must-know",
    "intermediate",
    "What are the distinct responsibilities of Liveness, Readiness, and Startup probes, and why does misconfiguring them cause cascading restart loops?",
    "Liveness probes determine if the container process is deadlocked (failure triggers container restart). Readiness probes determine if the container is ready to accept user traffic (failure removes pod from Service endpoints). Startup probes disable liveness/readiness checks during slow boot sequences.",
    "Misconfiguring a liveness probe on a slow-booting application (e.g. a Spring Boot or heavy Node.js app that takes 60 seconds to connect to database caches) is a classic disaster: if the liveness probe fires at 15 seconds, Kubelet kills the container, restarting the process in an endless loop. The **Startup Probe** solves this: Kubelet will not evaluate liveness or readiness probes until the startup probe succeeds (\`failureThreshold: 30\`, \`periodSeconds: 5\` gives 150 seconds of boot budget).",
    `# Complete Three-Probe Configuration
apiVersion: v1
kind: Pod
metadata:
  name: hardened-app
spec:
  containers:
  - name: server
    image: enterprise/api:v1
    # 1. Startup Probe: Grants up to 60s for initial database migration/boot
    startupProbe:
      httpGet:
        path: /healthz/startup
        port: 8080
      failureThreshold: 12
      periodSeconds: 5
    # 2. Liveness Probe: Restarts container ONLY if process is deadlocked
    livenessProbe:
      httpGet:
        path: /healthz/liveness
        port: 8080
      periodSeconds: 10
      timeoutSeconds: 2
    # 3. Readiness Probe: Removes from Service endpoints if overloaded
    readinessProbe:
      httpGet:
        path: /healthz/readiness
        port: 8080
      periodSeconds: 5
      failureThreshold: 2`,
    "Never make a Liveness Probe check downstream dependencies (like PostgreSQL or Redis). If the database slows down, all app containers restart simultaneously (Cascading Failure).",
    ["liveness-probe", "readiness-probe", "startup-probe", "health-checks", "cascading-restarts"]
  ),
  card(
    16,
    cat,
    "Graceful Pod Termination: SIGTERM, preStop Hooks & terminationGracePeriodSeconds",
    "must-know",
    "intermediate",
    "What is the exact sequence of events during Pod deletion and how do preStop hooks and terminationGracePeriodSeconds prevent 502 Bad Gateway errors?",
    "When a pod is deleted, Kubelet executes the preStop hook, sends SIGTERM, waits for the application to drain connections up to terminationGracePeriodSeconds (default 30s), and finally sends SIGKILL if the process hasn't exited.",
    "A major race condition causes 502 errors during rolling deployments: when a pod deletion event occurs, the API server simultaneously: 1) Removes the pod from EndpointSlices (notifying kube-proxy/ingress); and 2) Signals Kubelet to terminate the container. If the application receives SIGTERM and closes its listening socket immediately, but the Ingress controller hasn't finished updating its routing tables, in-flight requests hit closed sockets. A simple \`preStop: exec: command: [\"sleep\", \"10\"]\` forces Kubelet to wait 10 seconds before sending SIGTERM, allowing iptables/ingress routers to cleanly drain existing traffic.",
    `# Zero-Downtime Graceful Termination Configuration
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-service
spec:
  template:
    spec:
      # Extend grace period to accommodate sleep + drain time
      terminationGracePeriodSeconds: 45
      containers:
      - name: api
        image: enterprise/api:latest
        lifecycle:
          preStop:
            exec:
              # Give upstream ingress proxies 10s to purge endpoint from routing table
              command: ["/bin/sh", "-c", "sleep 10"]`,
    "Always add a 'sleep 5-10' preStop hook to API pods to eliminate transient 502 Bad Gateway errors during rolling updates.",
    ["graceful-shutdown", "sigterm", "prestop-hook", "zero-downtime", "connection-draining"]
  ),
  card(
    17,
    cat,
    "Native Sidecar Containers (Kubernetes 1.28+)",
    "must-know",
    "intermediate",
    "How do Native Sidecar Containers (restartPolicy: Always inside initContainers) solve historical startup and shutdown ordering issues in Kubernetes?",
    "Native Sidecars are init containers with 'restartPolicy: Always'. They start before standard application containers, remain running for the entire pod lifecycle, and allow standard containers to wait for the sidecar to become ready before booting.",
    "Historically, sidecars (Istio proxy, Vault agent, Cloud SQL Proxy) were standard containers in the \`containers\` array. This caused two major problems: 1) The application container started before the service mesh proxy was ready, failing outbound database connections; 2) When batch Jobs finished, sidecars kept running indefinitely, preventing the Job from terminating. In Kubernetes 1.28+, placing the sidecar in \`initContainers\` with \`restartPolicy: Always\` guarantees it starts first, stays alive, and shuts down cleanly after main containers exit.",
    `# Native Sidecar Pattern (Kubernetes 1.28+)
apiVersion: v1
kind: Pod
metadata:
  name: job-with-sidecar
spec:
  initContainers:
  # Native Sidecar: Starts first, stays running, terminates automatically with pod!
  - name: vault-agent
    image: vault:1.15
    restartPolicy: Always
    command: ["vault", "agent", "-config=/etc/vault/config.hcl"]
  containers:
  - name: batch-job
    image: busybox
    # Executes only after vault-agent passes startup!
    command: ["sh", "-c", "echo Processing data with vaulted credentials..."]`,
    "Use native sidecars (initContainers with restartPolicy: Always) for service mesh proxies, secret fetchers, and logging agents.",
    ["native-sidecars", "k8s-1.28", "init-containers", "startup-ordering", "istio-proxy"]
  ),
  card(
    18,
    cat,
    "Deployments vs ReplicaSets: RollingUpdate vs Recreate Strategies",
    "must-know",
    "intermediate",
    "How does a Deployment manage progressive rollout versioning via underlying ReplicaSets, and how do maxSurge and maxUnavailable govern RollingUpdates?",
    "A Deployment manages declarative updates for Pods by creating and scaling ReplicaSets. RollingUpdate smoothly transitions between versions without downtime, governed by maxSurge (extra pods allowed during update) and maxUnavailable (maximum pods that can be offline).",
    "A Deployment does not manage pods directly; it manages ReplicaSets (one ReplicaSet per revision). During a RollingUpdate: 1) The Deployment creates a new ReplicaSet for version 2; 2) It scales up the new ReplicaSet and scales down the old ReplicaSet incrementally; 3) If an update fails, rolling back simply adjusts the replica counts between the two ReplicaSets. \`maxSurge: 25%\` allows 125% total capacity during rollout; \`maxUnavailable: 0\` guarantees 100% available capacity is maintained at all times.",
    `# Production Zero-Downtime RollingUpdate Spec
apiVersion: apps/v1
kind: Deployment
metadata:
  name: checkout-api
spec:
  replicas: 8
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: "25%"       # Up to 2 extra pods created simultaneously (total 10)
      maxUnavailable: 0     # ZERO pods allowed to be unavailable during update!
  template:
    metadata:
      labels:
        app: checkout-api
    spec:
      containers:
      - name: api
        image: enterprise/checkout:v2`,
    "Setting 'maxUnavailable: 0' guarantees that capacity never drops below the desired replica count during deployments.",
    ["deployment", "replicaset", "rolling-update", "max-surge", "max-unavailable"]
  ),
  card(
    19,
    cat,
    "StatefulSets: Stable Network Identity & Ordinal Indexing",
    "must-know",
    "intermediate",
    "Why are StatefulSets mandatory for stateful distributed databases (Kafka, Cassandra, PostgreSQL) and how do Headless Services provide predictable DNS names?",
    "StatefulSets provide unique, persistent ordinal identities (pod-0, pod-1), dedicated PersistentVolumeClaims per pod that survive pod rescheduling, and predictable network DNS hostnames via Headless Services (ClusterIP: None).",
    "Deployments treat pods as anonymous, fungible, interchangeable replicas. Databases require stable identities: node-0 is primary, node-1 is replica; each requires its own independent physical disk volume. A StatefulSet guarantees: 1) Ordinal deployment (pod-0 starts and becomes ready before pod-1 launches); 2) VolumeClaimTemplates dynamically allocate dedicated PVs that stay attached to that specific ordinal index across restarts; 3) A Headless Service assigns direct A-records for each pod: \`pod-0.db-service.namespace.svc.cluster.local\`.",
    `# StatefulSet with Headless Service & VolumeClaimTemplates
apiVersion: v1
kind: Service
metadata:
  name: postgres-cluster
spec:
  clusterIP: None # HEADLESS SERVICE: Direct pod DNS resolution!
  selector:
    app: postgres
  ports:
  - port: 5432

---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: "postgres-cluster"
  replicas: 3
  selector:
    matchLabels:
      app: postgres
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 100Gi`,
    "Never use Deployments for multi-node databases like Cassandra or Kafka. Always use StatefulSets with Headless Services and volumeClaimTemplates.",
    ["statefulset", "headless-service", "ordinal-indexing", "volume-claim-templates", "databases"]
  ),
  card(
    20,
    cat,
    "DaemonSets: Node-Colocated Infrastructure Agents",
    "must-know",
    "intermediate",
    "What is the operational purpose of a DaemonSet, how does it ensure exactly one pod runs on every matching node, and how are rolling updates handled?",
    "A DaemonSet ensures that all (or some matching) nodes run an exact single copy of a pod, used primarily for node-level infrastructure agents: log collectors (FluentBit, Promtail), monitoring metrics (node-exporter), and CNI network daemons (Calico, Cilium).",
    "When new nodes are added to the cluster via autoscalers, the DaemonSet controller automatically schedules a DaemonSet pod onto the new node; when nodes are removed, the pods are garbage collected. DaemonSets support rolling updates via \`strategy.type: RollingUpdate\` with \`maxUnavailable: 1\` (or a percentage), replacing the agent on one node at a time. DaemonSets automatically tolerate master/control-plane taints if configured, allowing infrastructure monitoring to run on master nodes.",
    `# Node Exporter DaemonSet
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-exporter
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: node-exporter
  updateStrategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 1
  template:
    metadata:
      labels:
        app: node-exporter
    spec:
      # Tolerate control plane taints to monitor master nodes!
      tolerations:
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      containers:
      - name: node-exporter
        image: prom/node-exporter:v1.7.0`,
    "Use DaemonSets exclusively for host-level agents (logging, monitoring, networking) that must run exactly once per physical/virtual machine.",
    ["daemonset", "node-agent", "fluentbit", "cilium", "host-monitoring"]
  ),
  card(
    21,
    cat,
    "Jobs & CronJobs: Parallelism, Completions & Concurrency Policies",
    "must-know",
    "intermediate",
    "How do Kubernetes Jobs execute batch workloads to completion, and what are the three CronJob concurrency policies (Allow, Forbid, Replace)?",
    "A Job creates one or more pods and ensures that a specified number of them terminate successfully (exit 0). A CronJob schedules Jobs on a time-based schedule (cron syntax), governed by concurrencyPolicy: Allow (concurrent runs permitted), Forbid (skips new run if previous is still executing), and Replace (terminates running job and starts new one).",
    "Deployments expect pods to run indefinitely; if a pod in a Deployment exits with code 0, Kubelet restarts it. A Job expects pods to terminate; when a container exits 0, the Job tracks it toward \`spec.completions\`. CronJob concurrency policies prevent system overload: \`concurrencyPolicy: Forbid\` is critical for batch payment or database reconciliation jobs—if a job takes 15 minutes but runs every 10 minutes, Forbid prevents two overlapping jobs modifying the database concurrently.",
    `# CronJob with Forbid Concurrency Policy
apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-reconciliation
spec:
  schedule: "*/15 * * * *" # Every 15 minutes
  # CRITICAL: If previous job is still running, SKIP the new execution!
  concurrencyPolicy: Forbid
  failedJobsHistoryLimit: 3
  successfulJobsHistoryLimit: 1
  jobTemplate:
    spec:
      backoffLimit: 2 # Maximum 2 retries before marking Job as failed
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: worker
            image: enterprise/billing-reconcile:latest`,
    "Always set 'concurrencyPolicy: Forbid' on financial or state-mutating CronJobs to eliminate dangerous concurrent duplicate runs.",
    ["jobs", "cronjobs", "concurrency-policy", "batch-processing", "backoff-limit"]
  ),
  card(
    22,
    cat,
    "Init Containers: Sequential Execution & Initialization Barriers",
    "must-know",
    "intermediate",
    "How do Init Containers execute sequentially before application containers launch, and how are they used to wait for external service readiness?",
    "Init Containers are specialized containers that run sequentially to completion in the exact order declared in the pod spec. The application containers will not start until every init container exits successfully (exit code 0).",
    "Init containers provide clear separation of concerns: they can hold administrative tools, run database migrations, fetch secrets, or block pod startup until dependent services (e.g. PostgreSQL) are reachable. If an init container fails (non-zero exit), Kubelet restarts it according to the pod's \`restartPolicy\`, effectively pausing application launch until the barrier condition is satisfied.",
    `# Waiting for PostgreSQL Database Readiness via Init Container
apiVersion: v1
kind: Pod
metadata:
  name: web-app
spec:
  initContainers:
  # Sequential Barrier: Waits until Postgres port 5432 is answering connections
  - name: wait-for-postgres
    image: busybox:1.36
    command: ['sh', '-c', 'until nc -z -v -w3 postgres-service 5432; do echo "Waiting for DB..."; sleep 2; done;']
  containers:
  - name: web
    image: enterprise/web:latest
    ports:
    - containerPort: 8080`,
    "Init containers run to completion sequentially. If you have 3 init containers, Container 2 will never start until Container 1 exits 0.",
    ["init-containers", "initialization-barrier", "sequential-execution", "dependency-check"]
  ),
  card(
    23,
    cat,
    "Pod Disruption Budgets (PDB): minAvailable vs maxUnavailable",
    "must-know",
    "intermediate",
    "How do Pod Disruption Budgets (PDB) protect application availability during voluntary disruptions (cluster upgrades, node draining, autoscaler scaling)?",
    "A Pod Disruption Budget (PDB) limits the number of concurrent pod disruptions during voluntary administrative events (e.g. 'kubectl drain', Kubernetes version upgrades, node autoscaler consolidation), enforcing either minAvailable or maxUnavailable.",
    "Kubernetes distinguishes between Involuntary disruptions (hardware crashes, kernel panics, VM preemption) and Voluntary disruptions (system administrator draining a node for OS upgrades). When an operator runs \`kubectl drain node-01\`, the Eviction API checks all matching PDBs. If an application with 4 replicas has \`minAvailable: 3\`, the eviction API will evict 1 pod, wait for the replacement pod to become ready on another node, and only then evict the next pod. If draining would violate the budget, the drain command blocks safely.",
    `# Pod Disruption Budget Enforcing High Availability
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: payment-service-pdb
  namespace: production
spec:
  # Guarantees that at least 80% of replicas remain Ready during node drains!
  minAvailable: "80%"
  selector:
    matchLabels:
      app: payment-service`,
    "Always define a PodDisruptionBudget for every production Deployment. Without a PDB, 'kubectl drain' can terminate 100% of your application pods simultaneously.",
    ["pdb", "pod-disruption-budget", "voluntary-disruptions", "node-drain", "cluster-upgrades"]
  ),
  card(
    24,
    cat,
    "Ephemeral Debug Containers (kubectl debug)",
    "must-know",
    "intermediate",
    "How do Ephemeral Containers (kubectl debug) allow operators to troubleshoot distroless and crashed pods without rebuilding container images or restarting pods?",
    "Ephemeral containers are temporary containers that can be injected dynamically into an existing running pod using the EphemeralContainers subresource, allowing operators to attach network and debugging utilities without modifying the original pod spec.",
    "Hardened production containers (like Distroless) lack shells, curl, and debugging tools. Historically, operators had to edit manifests to add debugging tools, restarting the pod and destroying the ephemeral reproduction state. With \`kubectl debug\`: 1) An ephemeral container running Alpine or Busybox is injected into the running pod; 2) It shares the pod's network namespace and process namespace (if \`shareProcessNamespace: true\`); 3) Operators run \`tcpdump\`, inspect open sockets, and debug the crashed application live.",
    `# Injecting an interactive debugging container into an existing production pod:
kubectl debug -it target-pod-name \\
  --image=nicolaka/netshoot \\
  --target=app-container

# Netshoot provides curl, dig, tcpdump, ngrep, and htop
# inside the target pod's exact network and cgroup namespace!`,
    "Ephemeral containers cannot be removed once added; they exit when debugging terminates. They provide live diagnostics without pod restarts.",
    ["kubectl-debug", "ephemeral-containers", "distroless-debugging", "troubleshooting", "netshoot"]
  )
];
