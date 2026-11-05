// scripts/examples_kubernetes/part5_recipes_41_to_52.cjs
module.exports = [
  {
    id: "k8s-ex-41",
    title: "Istio PeerAuthentication & AuthorizationPolicy for STRICT Zero-Trust mTLS",
    category: "Security, RBAC & Policy Governance",
    difficulty: "advanced",
    whatThisCodeCovers: "A pair of Istio security manifests enforcing STRICT mutual TLS wire encryption and verifying caller SPIFFE identities with fine-grained HTTP method permissions.",
    conceptsCovered: ["PeerAuthentication", "AuthorizationPolicy", "STRICT mTLS", "SPIFFE Identity", "Service-to-Service AuthZ"],
    code: `apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default-strict-mtls
  namespace: finance
spec:
  mtls:
    mode: STRICT # Reject all plaintext TCP connections
---
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: payment-access-control
  namespace: finance
spec:
  selector:
    matchLabels:
      app: payment-vault
  action: ALLOW
  rules:
  - from:
    - source:
        # Only allow requests from checkout-service ServiceAccount
        principals: ["cluster.local/ns/production/sa/checkout-service-sa"]
    to:
    - operation:
        methods: ["POST"]
        paths: ["/v1/charges"]`,
    breakdown: "Rejects unencrypted connections, requiring mutual TLS cryptographic handshake. The AuthorizationPolicy parses the client's SPIFFE certificate, permitting only POST requests to /v1/charges from the checkout-service identity.",
    expectedOutput: "Plaintext traffic is rejected immediately with connection reset; authorized callers communicate over encrypted mTLS."
  },
  {
    id: "k8s-ex-42",
    title: "Gateway API (gateway.networking.k8s.io) HTTPRoute with Header Splitting",
    category: "Networking & Services",
    difficulty: "advanced",
    whatThisCodeCovers: "The modern successor to Ingress: Gateway API Gateway and HTTPRoute manifests routing beta users to canary pods via custom HTTP headers.",
    conceptsCovered: ["Gateway API", "Gateway", "HTTPRoute", "gateway.networking.k8s.io", "Header Matching"],
    code: `apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: enterprise-gateway
  namespace: default
spec:
  gatewayClassName: envoy-gateway
  listeners:
  - name: https
    protocol: HTTPS
    port: 443
    tls:
      mode: Terminate
      certificateRefs:
      - name: enterprise-tls-cert
---
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: payment-route
  namespace: default
spec:
  parentRefs:
  - name: enterprise-gateway
  hostnames:
  - "pay.company.com"
  rules:
  # Rule 1: Beta testers routed to canary backend
  - matches:
    - headers:
      - name: X-Beta-Tester
        value: "true"
    backendRefs:
    - name: payment-api-canary
      port: 8080
  # Rule 2: Default traffic to stable production backend
  - backendRefs:
    - name: payment-api-stable
      port: 8080`,
    breakdown: "Uses the standardized Gateway API specification. Expresses role-oriented routing decoupling infrastructure gateways from application routing rules, inspecting headers to route beta testers.",
    expectedOutput: "Requests with header 'X-Beta-Tester: true' route to canary; all other requests route to stable."
  },
  {
    id: "k8s-ex-43",
    title: "Node Maintenance Runbook: Safe Cordoning and Draining with PDB Verification",
    category: "Observability, Operations & Troubleshooting",
    difficulty: "intermediate",
    whatThisCodeCovers: "A production shell runbook safely cordoning and draining worker nodes for OS/kernel upgrades while honoring PodDisruptionBudgets and skipping DaemonSets.",
    conceptsCovered: ["kubectl cordon", "kubectl drain", "--ignore-daemonsets", "--delete-emptydir-data", "Node Maintenance"],
    code: `#!/usr/bin/env bash
# runbooks/drain_node.sh
set -euo pipefail

NODE_NAME="\$1"

echo "=== Step 1: Cordoning node \${NODE_NAME} (Halting new scheduling) ==="
kubectl cordon "\${NODE_NAME}"

echo "=== Step 2: Checking PodDisruptionBudgets in cluster ==="
kubectl get pdb -A

echo "=== Step 3: Evicting workloads with safety thresholds ==="
kubectl drain "\${NODE_NAME}" \\
  --ignore-daemonsets \\
  --delete-emptydir-data \\
  --grace-period=60 \\
  --timeout=5m \\
  --skip-wait-for-delete-timeout=30

echo "=== Step 4: Maintenance ready. Node \${NODE_NAME} successfully drained. ==="
# Execute OS reboot / kernel patch here...

echo "=== Step 5: Returning node to schedulable pool ==="
kubectl uncordon "\${NODE_NAME}"`,
    breakdown: "Prevents downtime during infrastructure maintenance: marks node unschedulable, invokes the eviction API honoring PDBs, ignores node-level DaemonSets, and uncordons once maintenance concludes.",
    expectedOutput: "Pods migrate smoothly to other nodes with zero application downtime before the host undergoes OS reboot."
  },
  {
    id: "k8s-ex-44",
    title: "Disaster Recovery Script: etcdctl TLS Snapshot Backup Automation",
    category: "Observability, Operations & Troubleshooting",
    difficulty: "advanced",
    whatThisCodeCovers: "An automated bash backup script that creates a consistent point-in-time snapshot of the etcd database using mTLS certificates and validates database integrity.",
    conceptsCovered: ["etcdctl snapshot save", "etcdctl snapshot status", "mTLS Authentication", "Disaster Recovery"],
    code: `#!/usr/bin/env bash
# scripts/backup_etcd.sh
set -euo pipefail

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/var/backups/etcd"
BACKUP_FILE="\${BACKUP_DIR}/etcd_snapshot_\${TIMESTAMP}.db"

mkdir -p "\${BACKUP_DIR}"

echo "=== Taking consistent point-in-time etcd snapshot ==="
ETCDCTL_API=3 etcdctl snapshot save "\${BACKUP_FILE}" \\
  --endpoints=https://127.0.0.1:2379 \\
  --cacert=/etc/kubernetes/pki/etcd/ca.crt \\
  --cert=/etc/kubernetes/pki/etcd/server.crt \\
  --key=/etc/kubernetes/pki/etcd/server.key

echo "=== Verifying snapshot integrity ==="
ETCDCTL_API=3 etcdctl --write-out=table snapshot status "\${BACKUP_FILE}"

echo "=== Compressing snapshot and syncing to encrypted S3 bucket ==="
gzip -c "\${BACKUP_FILE}" > "\${BACKUP_FILE}.gz"
aws s3 cp "\${BACKUP_FILE}.gz" s3://company-k8s-disaster-recovery/cluster-prod/ --sse aws:kms

echo "=== etcd backup successfully completed and verified. ==="`,
    breakdown: "Uses ETCDCTL_API=3 to take a consistent snapshot of the B+ tree database using master certificates, verifies the hash table integrity, and uploads the compressed snapshot to cloud cold storage.",
    expectedOutput: "A validated etcd snapshot saved and securely synced to S3 with a table displaying total keys and revision index."
  },
  {
    id: "k8s-ex-45",
    title: "Diagnostic Runbook: Remediating CrashLoopBackOff Exit Code 137 (OOMKilled)",
    category: "Observability, Operations & Troubleshooting",
    difficulty: "intermediate",
    whatThisCodeCovers: "An SRE diagnostic workflow using kubectl, cAdvisor, and dmesg to diagnose and resolve Exit Code 137 Out-Of-Memory container termination.",
    conceptsCovered: ["Exit Code 137", "OOMKilled", "kubectl logs --previous", "cgroups memory.max", "Memory Limits"],
    code: `#!/usr/bin/env bash
# runbooks/diagnose_oom.sh
POD="\$1"
NAMESPACE="\$2"

echo "=== 1. Inspecting Termination Reason and Exit Code ==="
kubectl get pod "\${POD}" -n "\${NAMESPACE}" -o jsonpath='{range .status.containerStatuses[*]}{.name}{": Reason="}{.lastState.terminated.reason}{" ExitCode="}{.lastState.terminated.exitCode}{"\\n"}{end}'

echo "=== 2. Tailing logs from crashed instance ==="
kubectl logs "\${POD}" -n "\${NAMESPACE}" --previous --tail=50

echo "=== 3. Inspecting configured memory requests vs limits ==="
kubectl get pod "\${POD}" -n "\${NAMESPACE}" -o jsonpath='{range .spec.containers[*]}{.name}{": requests.memory="}{.resources.requests.memory}{" limits.memory="}{.resources.limits.memory}{"\\n"}{end}'

echo "=== 4. Checking node kernel dmesg for OOM-killer invocations ==="
NODE=$(kubectl get pod "\${POD}" -n "\${NAMESPACE}" -o jsonpath='{.spec.nodeName}')
echo "Pod was placed on node: \${NODE}"
# Inspect dmesg: dmesg -T | grep -i -E "oom-killer|killed process"`,
    breakdown: "Detects OOMKilled exit code 137, inspects preceding application memory logs, and compares configured memory limits against container runtime needs to right-size specifications.",
    expectedOutput: "Pinpoints memory limit violations and outputs exact adjustments required for resources.limits.memory."
  },
  {
    id: "k8s-ex-46",
    title: "Diagnostic Runbook: Resolving ImagePullBackOff with Docker Registry Secrets",
    category: "Observability, Operations & Troubleshooting",
    difficulty: "intermediate",
    whatThisCodeCovers: "A diagnostic script to triage ImagePullBackOff errors and bind docker-registry credentials to ServiceAccounts for automated private image authentication.",
    conceptsCovered: ["ImagePullBackOff", "docker-registry secret", "imagePullSecrets", "ServiceAccount patch"],
    code: `#!/usr/bin/env bash
# runbooks/fix_image_pull.sh
set -euo pipefail

NAMESPACE="\$1"
SECRET_NAME="enterprise-registry-creds"

echo "=== Step 1: Creating docker-registry secret in namespace \${NAMESPACE} ==="
kubectl create secret docker-registry "\${SECRET_NAME}" \\
  --namespace="\${NAMESPACE}" \\
  --docker-server="registry.company.internal" \\
  --docker-username="\$REGISTRY_USER" \\
  --docker-password="\$REGISTRY_TOKEN" \\
  --dry-run=client -o yaml | kubectl apply -f -

echo "=== Step 2: Patching default ServiceAccount to automatically inject secret ==="
kubectl patch serviceaccount default \\
  -n "\${NAMESPACE}" \\
  -p '{"imagePullSecrets": [{"name": "'"\${SECRET_NAME}"'"}]}'

echo "=== Step 3: Verified. All new pods in \${NAMESPACE} inherit credentials. ==="`,
    breakdown: "Creates a docker-registry secret and patches the namespace's default ServiceAccount, ensuring all workloads in the namespace automatically pull images from private registries without modifying individual Deployment specs.",
    expectedOutput: "Pods previously stuck in ErrImagePull / ImagePullBackOff successfully authenticate and launch."
  },
  {
    id: "k8s-ex-47",
    title: "Diagnostic Runbook: Unblocking Pending Pods Trapped in Predicate Failures",
    category: "Observability, Operations & Troubleshooting",
    difficulty: "intermediate",
    whatThisCodeCovers: "An automated diagnostic script identifying why Pods remain in Pending state, extracting scheduler predicate errors and cluster node capacity deficits.",
    conceptsCovered: ["Pending Pods", "FailedScheduling", "Predicate Failures", "Resource Deficits", "Scheduler Events"],
    code: `#!/usr/bin/env bash
# runbooks/triage_pending_pods.sh
set -euo pipefail

NAMESPACE="\${1:-default}"

echo "=== Listing all Pending Pods in namespace '\${NAMESPACE}' ==="
PENDING_PODS=$(kubectl get pods -n "\${NAMESPACE}" --field-selector=status.phase=Pending -o jsonpath='{.items[*].metadata.name}')

if [ -z "\${PENDING_PODS}" ]; then
  echo "No pending pods found."
  exit 0
fi

for POD in \${PENDING_PODS}; do
  echo "---------------------------------------------------------"
  echo "POD: \${POD}"
  echo "Scheduler Failure Reason:"
  kubectl get events -n "\${NAMESPACE}" \\
    --field-selector "involvedObject.name=\${POD},reason=FailedScheduling" \\
    --sort-by='.metadata.creationTimestamp' \\
    -o custom-columns=TIME:.metadata.creationTimestamp,MESSAGE:.message | tail -n 2
done

echo "---------------------------------------------------------"
echo "=== Cluster Allocatable vs Capacity Summary ==="
kubectl describe nodes | grep -A 8 "Allocated resources:"`,
    breakdown: "Parses FailedScheduling events to instantly tell the engineer whether the issue is Insufficient CPU/Memory, untolerated taints, or unbound PersistentVolumeClaims.",
    expectedOutput: "Diagnostic summary pinpointing predicate failure causes (e.g. '0/12 nodes available: 12 Insufficient cpu')."
  },
  {
    id: "k8s-ex-48",
    title: "ResourceQuota & LimitRange Enforcing Fair Share Compute Across Namespaces",
    category: "Scheduling & Resource Allocation",
    difficulty: "intermediate",
    whatThisCodeCovers: "Enterprise multi-tenancy manifests setting hard namespace compute ceilings with ResourceQuota and mandating default CPU/RAM requests with LimitRange.",
    conceptsCovered: ["ResourceQuota", "LimitRange", "Default Requests", "Multi-Tenancy", "Resource Constraints"],
    code: `apiVersion: v1
kind: LimitRange
metadata:
  name: default-limits
  namespace: development
spec:
  limits:
  - default: # Default limits if omitted by developer
      cpu: "500m"
      memory: "512Mi"
    defaultRequest: # Default requests if omitted
      cpu: "100m"
      memory: "128Mi"
    max:
      cpu: "2000m"
      memory: "2Gi"
    type: Container
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: compute-quota
  namespace: development
spec:
  hard:
    requests.cpu: "10"
    requests.memory: "20Gi"
    limits.cpu: "20"
    limits.memory: "40Gi"
    pods: "30"
    services.loadbalancers: "1"`,
    breakdown: "LimitRange injects default CPU/memory requests if developers omit them, preventing unconstrained containers. ResourceQuota bounds total namespace footprint, preventing noisy neighbor starvation.",
    expectedOutput: "Development namespace caps total resource usage to 10 CPUs / 20Gi RAM, automatically injecting default container sizes."
  },
  {
    id: "k8s-ex-49",
    title: "Secret Encryption at Rest via kube-apiserver KMS v2 Provider",
    category: "Security, RBAC & Policy Governance",
    difficulty: "advanced",
    whatThisCodeCovers: "The kube-apiserver EncryptionConfiguration manifest implementing envelope encryption with external cloud KMS (AWS KMS / HashiCorp Vault) for Secrets stored in etcd.",
    conceptsCovered: ["EncryptionConfiguration", "KMS v2 Provider", "Envelope Encryption", "etcd ciphertext", "DEK/KEK"],
    code: `apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets
      - configmaps
    providers:
      # 1. Primary: Cloud KMS v2 Provider (Envelope Encryption)
      - kms:
          apiVersion: v2
          name: aws-kms-provider
          endpoint: unix:///var/run/kmsplugin/socket.sock
          timeout: 3s
      # 2. Secondary fallback (Read existing AES-CBC secrets during migration)
      - aescbc:
          keys:
            - name: legacy-key
              secret: c2VjcmV0IGlzIGEgMzItYnl0ZSBzdHJpbmc=
      # 3. Identity (Plaintext fallback for unencrypted legacy objects)
      - identity: {}`,
    breakdown: "Configures kube-apiserver to encrypt Secret values before writing to etcd using KMS envelope encryption. If the etcd disk is stolen, the raw database contains only unreadable ciphertext.",
    expectedOutput: "etcd stores Secrets as ciphertext encrypted with dynamic DEKs rotated and protected by cloud hardware KMS."
  },
  {
    id: "k8s-ex-50",
    title: "Ephemeral Containers (kubectl debug) for Live Production Troubleshooting",
    category: "Observability, Operations & Troubleshooting",
    difficulty: "intermediate",
    whatThisCodeCovers: "Using ephemeral debug containers to attach interactive troubleshooting toolkits (curl, tcpdump, gdb) to live distroless production pods without restarting them.",
    conceptsCovered: ["kubectl debug", "Ephemeral Containers", "Distroless Debugging", "Process Namespace Sharing"],
    code: `# 1. Attach an ephemeral debugging container into a live distroless pod
$ kubectl debug -it payment-api-78f99-z9k12 \\
    --image=nicolaka/netshoot \\
    --target=payment-api \\
    -n production

# Inside the netshoot ephemeral container:
# You now share the pod's network namespace and process namespace!
$ tcpdump -i eth0 -nn -s0 -v port 8080
$ curl -v http://localhost:8080/healthz
$ strace -p 1 -f -e trace=network

# 2. Alternatively, copy a crashing pod with an interactive override
$ kubectl debug pod/crashing-pod-abc \\
    --copy-to=debug-pod \\
    --container=app \\
    --sh`,
    breakdown: "Solves the dilemma of inspecting hardened distroless containers (which lack shells and package managers): dynamically injects a temporary debugging container into the pod's shared Linux namespaces.",
    expectedOutput: "Instant interactive shell inside the production pod's network and process namespace with zero workload disruption."
  },
  {
    id: "k8s-ex-51",
    title: "PriorityClass Hierarchy: Critical System Workloads vs Batch Jobs",
    category: "Scheduling & Resource Allocation",
    difficulty: "intermediate",
    whatThisCodeCovers: "Defining cluster-wide PriorityClass tiers with preemption policies to guarantee mission-critical microservices pre-empt low-priority batch jobs during capacity shortages.",
    conceptsCovered: ["PriorityClass", "preemptionPolicy", "PreemptLowerPriority", "Cluster Capacity Governance"],
    code: `apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: mission-critical-service
value: 1000000000 # High priority
globalDefault: false
description: "Core revenue-generating microservices (payment, checkout)."
---
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: background-batch-job
value: 1000 # Low priority
globalDefault: false
preemptionPolicy: Never # Never pre-empt other workloads
description: "Non-critical batch data processing."
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-engine
  namespace: production
spec:
  replicas: 4
  template:
    spec:
      priorityClassName: mission-critical-service
      containers:
      - name: payment
        image: payment:v2`,
    breakdown: "When nodes reach 100% capacity, kube-scheduler evicts low-priority batch jobs (value: 1000) to ensure mission-critical service pods (value: 1000000000) schedule without delay.",
    expectedOutput: "Mission-critical pods immediately pre-empt background jobs during node resource crunch."
  },
  {
    id: "k8s-ex-52",
    title: "Cluster API (CAPI) AWS Managed Control Plane & Worker MachineDeployment",
    category: "Architecture & Control Plane",
    difficulty: "advanced",
    whatThisCodeCovers: "A declarative Cluster API manifest defining a Kubernetes cluster, its AWS managed EKS control plane, and an auto-scaling worker MachineDeployment via GitOps.",
    conceptsCovered: ["Cluster API (CAPI)", "AWSManagedControlPlane", "MachineDeployment", "Infrastructure-as-Code in K8s"],
    code: `apiVersion: cluster.x-k8s.io/v1beta1
kind: Cluster
metadata:
  name: prod-cluster-us-east
  namespace: capi-clusters
spec:
  clusterNetwork:
    pods:
      cidrBlocks: ["10.244.0.0/16"]
    services:
      cidrBlocks: ["10.96.0.0/12"]
  controlPlaneRef:
    apiVersion: controlplane.cluster.x-k8s.io/v1beta2
    kind: AWSManagedControlPlane
    name: prod-control-plane
  infrastructureRef:
    apiVersion: infrastructure.cluster.x-k8s.io/v1beta2
    kind: AWSManagedCluster
    name: prod-cluster-infra
---
apiVersion: cluster.x-k8s.io/v1beta1
kind: MachineDeployment
metadata:
  name: prod-worker-pool-m6i
  namespace: capi-clusters
spec:
  clusterName: prod-cluster-us-east
  replicas: 10
  selector:
    matchLabels:
      cluster.x-k8s.io/cluster-name: prod-cluster-us-east
  template:
    spec:
      clusterName: prod-cluster-us-east
      version: v1.30.0
      bootstrap:
        configRef:
          apiVersion: bootstrap.cluster.x-k8s.io/v1beta2
          kind: EKSConfigTemplate
          name: prod-eks-config
      infrastructureRef:
        apiVersion: infrastructure.cluster.x-k8s.io/v1beta2
        kind: AWSManagedMachinePool
        name: prod-worker-m6i-pool`,
    breakdown: "Treats entire Kubernetes clusters as declarative custom resources. Upgrading Kubernetes minor versions or resizing worker pools is managed through Git commits and CAPI controllers.",
    expectedOutput: "A fully functional, multi-node managed Kubernetes cluster provisioned entirely via declarative Kubernetes CRDs."
  }
];
