// scripts/data_kubernetes/cat07_security_rbac_policy.cjs
const { card } = require('../k8s_builder_helper.cjs');

const cat = "Security, RBAC & Policy Governance";

module.exports = [
  card(
    73,
    cat,
    "Kubernetes RBAC Architecture: Roles, ClusterRoles & Bindings",
    "must-know",
    "intermediate",
    "How does Kubernetes Role-Based Access Control (RBAC) evaluate API requests, and what is the difference between namespace-scoped Roles and cluster-scoped ClusterRoles?",
    "Kubernetes RBAC evaluates three entities: Subjects (Users, Groups, ServiceAccounts), API Rules (apiGroups, resources, verbs like get, list, create), and Bindings. Roles and RoleBindings apply strictly within a single namespace; ClusterRoles and ClusterRoleBindings apply cluster-wide across all namespaces and cluster-scoped resources (Nodes, PVs, Namespaces).",
    "RBAC permissions are strictly additive (there are no explicit 'Deny' rules). A **Role** is bound inside a namespace: granting \`['get', 'list']\` on \`pods\` in namespace \`development\` only allows operations in that namespace. A **ClusterRole** defines permissions globally: granting access to non-namespaced resources (e.g. \`nodes\`, \`storageclasses\`, \`/healthz\`) or providing a reusable template. A **RoleBinding** can reference a ClusterRole to grant permissions scoped down strictly to the target namespace.",
    `# 1. Namespace-Scoped Developer Role
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: development
  name: pod-reader
rules:
- apiGroups: [""] # Core API group
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]

---
# 2. Binding Role to a ServiceAccount
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  namespace: development
  name: read-pods-binding
subjects:
- kind: ServiceAccount
  name: dev-developer
  namespace: development
roleRef:
  kind: Role
  name: pod-reader
  apiGroup: rbac.authorization.k8s.io`,
    "RBAC is purely additive: access is denied unless an explicit Rule in an active RoleBinding permits the verb on the resource.",
    ["rbac", "roles", "clusterroles", "rolebindings", "api-security"]
  ),
  card(
    74,
    cat,
    "ServiceAccount Token Projection & Disabling Auto-Mount",
    "must-know",
    "intermediate",
    "Why is default ServiceAccount token auto-mounting a severe security risk and how do Projected ServiceAccount Tokens enforce audience and expiration limits?",
    "By default, Kubernetes injects a ServiceAccount JWT into every pod at /var/run/secrets/kubernetes.io/serviceaccount/token. If a pod is compromised, an attacker uses this token to query the Kubernetes API server. Disabling auto-mount (automountServiceAccountToken: false) prevents credential leakage.",
    "Historically, injected tokens were long-lived, static, and valid for any cluster service. Modern Kubernetes uses **Projected ServiceAccount Tokens** (\`BoundServiceAccountTokenVolume\`): 1) Tokens have a short cryptographic lifespan (e.g. 1 hour) and are rotated continuously by Kubelet; 2) Tokens are bound to the specific pod instance (deleting the pod invalidates the token in etcd); 3) Tokens are bound to an explicit audience (\`aud\`), preventing a token leaked to one service from being replayed against another.",
    `# Disabling Default Token Auto-Mount on Pod Spec
apiVersion: v1
kind: Pod
metadata:
  name: hardened-web-server
spec:
  # CRITICAL: Prevents secret token from being mounted into container!
  automountServiceAccountToken: false
  containers:
  - name: web
    image: nginx:alpine`,
    "Over 95% of microservices never need to speak to the Kubernetes API server. Set 'automountServiceAccountToken: false' across all application pods.",
    ["serviceaccount", "token-projection", "automount-token", "pod-hardening", "credential-theft"]
  ),
  card(
    75,
    cat,
    "IAM Roles for Service Accounts (IRSA) & Pod Identity",
    "must-know",
    "intermediate",
    "How does IAM Roles for Service Accounts (IRSA / EKS Pod Identity / Workload Identity) eliminate static AWS access keys inside Kubernetes pods?",
    "IRSA uses OpenID Connect (OIDC) federation between the Kubernetes cluster and AWS IAM. The pod assumes an IAM role dynamically using a projected ServiceAccount token, exchanging it via AWS STS (AssumeRoleWithWebIdentity) for temporary 15-minute AWS credentials.",
    "Prior to IRSA, applications stored static \`AWS_ACCESS_KEY_ID\` and \`AWS_SECRET_ACCESS_KEY\` in Kubernetes Secrets (vulnerable to git leaks) or inherited broad permissions from the underlying EC2 worker node IAM role. With IRSA: 1) The EKS cluster hosts an OIDC discovery endpoint; 2) The ServiceAccount is annotated with \`eks.amazonaws.com/role-arn\`; 3) An admission webhook injects a projected token and environment variables; 4) The AWS SDK automatically calls AWS STS to assume the role, ensuring strict pod-level least-privilege without any long-lived secrets.",
    `# ServiceAccount Annotated with AWS IAM Role
apiVersion: v1
kind: ServiceAccount
metadata:
  name: s3-reader-sa
  namespace: production
  annotations:
    # EKS Webhook intercepts this annotation and mounts STS credentials automatically!
    eks.amazonaws.com/role-arn: arn:aws:iam::123456789012:role/ProductionS3ReaderRole`,
    "Never attach administrative S3 or DynamoDB permissions to the EC2 worker node IAM role. Use IRSA to grant fine-grained permissions per pod ServiceAccount.",
    ["irsa", "pod-identity", "workload-identity", "aws-iam", "oidc-federation"]
  ),
  card(
    76,
    cat,
    "Pod Security Admission (PSA) & Pod Security Standards (PSS)",
    "must-know",
    "intermediate",
    "What are the three Pod Security Standards (Privileged, Baseline, Restricted) and how does the built-in Pod Security Admission (PSA) controller enforce them at namespace boundaries?",
    "Pod Security Admission (PSA) replaced deprecated PodSecurityPolicies (PSP). It evaluates pods against three standardized profiles: Privileged (unrestricted), Baseline (prevents known privilege escalations), and Restricted (hardened best practices: non-root, drop all capabilities, read-only rootfs) via namespace labels.",
    "PSA is built directly into kube-apiserver (requiring zero external webhooks). Namespaces declare their enforcement policy using labels with three modes: \`enforce\` (rejects non-compliant pods), \`audit\` (adds audit log entry), and \`warn\` (returns warning to developer CLI). Applying \`pod-security.kubernetes.io/enforce: restricted\` guarantees that developers cannot deploy containers that run as root, share host namespaces, or add dangerous Linux kernel capabilities.",
    `# Enforcing Restricted Pod Security Standard on Production Namespace
apiVersion: v1
kind: Namespace
metadata:
  name: payment-production
  labels:
    # Rejects pods violating Restricted standard at API server admission
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    # Warnings returned during 'kubectl apply'
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/audit: restricted`,
    "Apply 'pod-security.kubernetes.io/enforce: restricted' across all tenant and production namespaces to block root execution and privilege escalation at admission.",
    ["psa", "pss", "pod-security-standards", "restricted-profile", "psp-migration"]
  ),
  card(
    77,
    cat,
    "Kubernetes NetworkPolicies: Default-Deny Isolation",
    "must-know",
    "intermediate",
    "How do Kubernetes NetworkPolicies enforce Layer 3/4 firewall isolation between pods, and why must every namespace deploy a Default-Deny policy?",
    "By default, all pods in a Kubernetes cluster can communicate with all other pods across all namespaces without restriction. A Default-Deny NetworkPolicy isolates the namespace, dropping all inbound and outbound traffic unless explicitly permitted by an allow rule.",
    "If an attacker achieves Remote Code Execution (RCE) in a public frontend pod, the absence of NetworkPolicies allows them to connect to internal databases, Redis caches, and other namespace workloads across the flat virtual network. A **Default-Deny** policy acts as a localized firewall: 1) It selects all pods in the namespace (\`podSelector: {}\`); 2) It enables Ingress and Egress policy types with empty rule lists (dropping 100% of packets); 3) Specific NetworkPolicies are then added to whitelist exact pod-to-pod and port-level communication channels.",
    `# Default-Deny All Ingress and Egress NetworkPolicy
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: production
spec:
  podSelector: {} # Applies to ALL pods in namespace!
  policyTypes:
  - Ingress
  - Egress
  # Leaving ingress and egress lists empty drops all inbound and outbound traffic!`,
    "NetworkPolicies require a supporting CNI (Calico, Cilium). If your cluster runs Flannel, NetworkPolicies are silently ignored!",
    ["networkpolicy", "default-deny", "microsegmentation", "cni-security", "zero-trust"]
  ),
  card(
    78,
    cat,
    "Policy Engines: OPA Gatekeeper vs Kyverno",
    "must-know",
    "intermediate",
    "How do OPA Gatekeeper (Rego) and Kyverno (Declarative YAML) compare as Kubernetes admission policy engines?",
    "OPA Gatekeeper uses ConstraintTemplates and the Rego query language to validate resources at admission; Kyverno is a Kubernetes-native policy engine that uses standard YAML declarations to validate, mutate, generate, and verify image signatures without learning a custom programming language.",
    "Both tools act as Validating and Mutating Admission Webhooks. **OPA Gatekeeper** is battle-tested, extremely flexible, and unifies policy-as-code across Kubernetes, Terraform, and cloud APIs using Rego Datalog queries, but has a steep learning curve. **Kyverno** is tailored specifically for Kubernetes: policies are written in familiar Kubernetes YAML syntax, can mutate resources (e.g. auto-injecting environment variables), generate new resources (e.g. cloning a NetworkPolicy into newly created namespaces), and verify Sigstore Cosign container image signatures natively.",
    `# Kyverno Policy: Mandate Non-Root User & Drop All Capabilities
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-root-execution
spec:
  validationFailureAction: Enforce
  rules:
  - name: validate-run-as-non-root
    match:
      any:
      - resources:
          kinds: ["Pod"]
    validate:
      message: "Running as root is forbidden! Set securityContext.runAsNonRoot: true"
      pattern:
        spec:
          =(securityContext):
            runAsNonRoot: true
          containers:
          - securityContext:
              capabilities:
                drop:
                - ALL`,
    "Use Kyverno for fast, Kubernetes-native declarative policies written in YAML. Use OPA Gatekeeper if your enterprise already standardizes on Rego across multiple tools.",
    ["kyverno", "opa-gatekeeper", "rego", "policy-as-code", "admission-control"]
  ),
  card(
    79,
    cat,
    "Container Capability Dropping & Non-Root Enforcement",
    "must-know",
    "intermediate",
    "Why is dropping all Linux capabilities (capabilities.drop: ['ALL']) and setting runAsNonRoot mandatory in enterprise container security?",
    "Linux capabilities divide traditional superuser privileges into discrete permissions. Dropping ALL capabilities strips over 40 root-level kernel powers (raw network sockets, memory manipulation, chroot), preventing container escape even if a process achieves root execution.",
    "Running a container as root (UID 0) inside a container shares the host kernel's UID 0. If a container has \`CAP_SYS_ADMIN\` or \`CAP_NET_RAW\`, an attacker can modify routing tables, mount filesystems, or sniff raw network packets. Hardening requires: 1) \`runAsNonRoot: true\` and \`runAsUser: 10001\`; 2) \`allowPrivilegeEscalation: false\` (prevents setuid binaries like sudo from elevating privileges); 3) \`capabilities: { drop: ['ALL'] }\`.",
    `# SecurityContext Enforcing Least Privilege
apiVersion: v1
kind: Pod
metadata:
  name: secure-container
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 10001
    seccompProfile:
      type: RuntimeDefault
  containers:
  - name: app
    image: enterprise/api:v1
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop:
        - ALL # Strips ALL Linux kernel capabilities!`,
    "Setting 'allowPrivilegeEscalation: false' and 'capabilities.drop: [ALL]' neutralizes setuid privilege escalation vectors inside containers.",
    ["linux-capabilities", "runasnonroot", "allowprivilegeescalation", "least-privilege", "securitycontext"]
  ),
  card(
    80,
    cat,
    "Preventing Secret Theft via Pod Exec & Volume Inspection",
    "must-know",
    "intermediate",
    "How do attackers steal credentials using 'kubectl exec' on running pods, and how do RBAC restrictions and Ephemeral Containers lock down live runtime inspection?",
    "Access to 'kubectl exec' grants an interactive root shell inside a running container, allowing attackers to dump environment variables, read mounted Secret files, and inspect internal network sockets. Restricting the 'pods/exec' subresource in RBAC is critical to securing production clusters.",
    "Developers frequently ask for \`kubectl exec\` to debug production issues. However, anyone with \`create\` on \`pods/exec\` can run: \`kubectl exec -it pod-0 -- env\` and steal all database passwords, API tokens, and private keys. Hardening strategies: 1) Remove \`pods/exec\` from developer RBAC roles in production namespaces; 2) Route production debugging through ephemeral containers (\`kubectl debug\`) with strict audit logging; 3) Use audit daemons (Falco) to trigger alerts whenever shell processes (sh, bash) spawn inside production containers.",
    `# Restricting pods/exec in Developer ClusterRole
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: developer-restricted
rules:
- apiGroups: [""]
  resources: ["pods", "services", "configmaps"]
  verbs: ["get", "list", "watch"]
- apiGroups: [""]
  resources: ["pods/log"] # Allow viewing logs
  verbs: ["get"]
# NOTICE: 'pods/exec' and 'pods/portforward' are EXCLUDED completely!`,
    "Treat 'kubectl exec' in production as root shell access. Restrict 'pods/exec' in RBAC and monitor shell spawns via Falco.",
    ["kubectl-exec", "credential-theft", "rbac-restrictions", "audit-logging", "falco"]
  ),
  card(
    81,
    cat,
    "API Server Auditing & Falco Runtime Threat Detection",
    "must-know",
    "intermediate",
    "How does the Kubernetes Audit Policy capture administrative API events, and how does Falco detect real-time kernel-level runtime intrusions?",
    "Kubernetes Audit Logging records all requests received by kube-apiserver at four stages (RequestReceived, ResponseStarted, ResponseComplete, Panic). Falco operates in kernel space (via eBPF / kernel module) to detect runtime anomalies (spawning shells, writing to /etc, unexpected outbound connections).",
    "The API server audit log records who did what, when, and to what resource (e.g. 'User Bob deleted namespace production at 14:02 UTC'). However, once a container is running, the API server cannot see what executes inside the container. **Falco** bridges this gap: running as a DaemonSet, Falco uses eBPF probes in the Linux kernel to intercept all system calls (\`execve\`, \`open\`, \`connect\`). If an attacker spawns a bash shell inside an Nginx container or modifies \`/etc/shadow\`, Falco detects the kernel event and streams a high-priority security alert to the SIEM in milliseconds.",
    `# Falco Rule: Alert on Shell Spawned Inside Container
- rule: Shell in Container
  desc: A shell was spawned inside a running container
  condition: >
    container.id != host and
    evt.type = execve and
    proc.name in (bash, sh, zsh, csh) and
    not k8s.ns.name in (debug-tools)
  output: "CRITICAL: Shell spawned in container (user=%user.name container=%container.name ns=%k8s.ns.name cmd=%proc.cmdline)"
  priority: CRITICAL`,
    "Audit logs catch control plane API mutations. Falco catches live data plane container runtime intrusions in kernel space.",
    ["audit-logging", "falco", "ebpf-security", "runtime-defense", "intrusion-detection"]
  ),
  card(
    82,
    cat,
    "CIS Kubernetes Benchmark & Automated Auditing with kube-bench",
    "must-know",
    "intermediate",
    "What is the CIS Kubernetes Benchmark and how does kube-bench automate security auditing of control plane and worker node configurations?",
    "The Center for Internet Security (CIS) Kubernetes Benchmark defines hundreds of prescriptive security hardening guidelines for control plane binaries, etcd, Kubelet, and worker nodes. Kube-bench is an open-source tool that scans nodes against CIS benchmarks and outputs automated Pass/Fail scorecards.",
    "Kube-bench checks file permissions, ownership, and process flags against CIS standards: 1) Verifying \`/etc/kubernetes/manifests/kube-apiserver.yaml\` is owned by \`root:root\` with permissions \`600\` or \`644\`; 2) Verifying anonymous auth is disabled (\`--anonymous-auth=false\`); 3) Verifying authorization mode includes Node and RBAC (\`--authorization-mode=Node,RBAC\`); 4) Verifying Kubelet enforces read-only ports disabled (\`--read-only-port=0\`). Running kube-bench as a Kubernetes Job or in CI/CD ensures clusters maintain SOC 2 and PCI-DSS compliance.",
    `# Running kube-bench as a Job on worker nodes:
kubectl apply -f https://raw.githubusercontent.com/aquasecurity/kube-bench/main/job-node.yaml
kubectl logs -l app=kube-bench

# Sample Output:
# [PASS] 4.2.1 Ensure that the --anonymous-auth argument is set to false
# [PASS] 4.2.2 Ensure that the --authorization-mode argument is not set to AlwaysAllow
# [FAIL] 4.2.6 Ensure that the --protect-kernel-defaults argument is set to true`,
    "Run kube-bench quarterly or as part of automated cluster build pipelines to guarantee compliance with the official CIS Kubernetes Benchmark.",
    ["cis-benchmark", "kube-bench", "security-audit", "compliance", "node-hardening"]
  ),
  card(
    83,
    cat,
    "Multi-Tenancy Isolation: Soft vs Hard Multi-Tenancy (vcluster & Capsule)",
    "advanced",
    "advanced",
    "What is the difference between Soft Multi-Tenancy (Namespaces, RBAC, NetworkPolicies) and Hard Multi-Tenancy (Virtual Clusters via vcluster / Capsule)?",
    "Soft Multi-Tenancy isolates trusted teams sharing a single control plane using Namespaces, RBAC, and Quotas. Hard Multi-Tenancy isolates untrusted or external tenants by provisioning isolated virtual control planes (vcluster) or microVM runtimes (Kata, gVisor) on dedicated physical nodes.",
    "Kubernetes was originally designed for single-tenant or cooperative multi-tenant environments. Namespaces do not isolate CRDs, cluster-scoped resources, or the shared Linux kernel. If Tenant A installs a CRD with the same name as Tenant B, conflicts occur. **vcluster** provisions a fully functional virtual Kubernetes control plane inside a namespace on the host cluster: tenants receive full \`cluster-admin\` over their own virtual API server, create their own CRDs, and deploy operators, while pods are scheduled securely onto the underlying shared host worker nodes.",
    `# Creating an Isolated Virtual Cluster in seconds using vcluster CLI:
vcluster create team-payments -n tenant-payments

# Connects to virtual cluster:
# Tenant has full 'cluster-admin' over virtual API server!
kubectl get namespaces
# Host cluster control plane remains completely shielded from tenant actions.`,
    "For multi-tenant SaaS or providing autonomous developer sandboxes, use vcluster to give tenants virtual cluster-admin rights without sharing etcd.",
    ["multi-tenancy", "vcluster", "hard-multi-tenancy", "soft-multi-tenancy", "capsule"]
  ),
  card(
    84,
    cat,
    "Certificate Management & Automated Rotation via Cert-Manager",
    "must-know",
    "intermediate",
    "How does cert-manager automate the issuance, renewal, and secret synchronization of X.509 SSL/TLS certificates using Let's Encrypt and internal HashiCorp Vault?",
    "Cert-manager is an operator that automates TLS certificate lifecycles in Kubernetes. It introduces Issuer/ClusterIssuer CRDs to connect to Certificate Authorities (Let's Encrypt ACME, Vault, internal CA) and Certificate CRDs to automatically provision and rotate Kubernetes TLS Secrets before expiration.",
    "Expired SSL certificates are one of the most common causes of public web outages. Cert-manager runs reconciliation loops that: 1) Solve ACME HTTP-01 or DNS-01 challenges automatically (calling Route 53 or Cloudflare to create TXT records); 2) Receives signed certificates and writes them into a standard Kubernetes Secret (\`tls.crt\`, \`tls.key\`); 3) Monitors expiration dates and automatically initiates renewal 30 days before expiration, updating the Secret in place and triggering Ingress controllers to reload certificates without downtime.",
    `# ClusterIssuer for Let's Encrypt Production
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-production
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: security@enterprise.com
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
    # Automated DNS-01 challenge solver using AWS Route 53
    - dns01:
        route53:
          region: us-east-1`,
    "Automate all public and internal TLS certificates with cert-manager. Never manage TLS certificates manually in production Kubernetes clusters.",
    ["cert-manager", "tls-certificates", "lets-encrypt", "acme-dns01", "automated-rotation"]
  )
];
