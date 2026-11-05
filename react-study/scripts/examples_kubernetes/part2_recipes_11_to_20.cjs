// scripts/examples_kubernetes/part2_recipes_11_to_20.cjs
module.exports = [
  {
    id: "k8s-ex-11",
    title: "Granular Zero-Trust NetworkPolicy for Multi-Tier Microservice Isolation",
    category: "Security, RBAC & Policy Governance",
    difficulty: "advanced",
    whatThisCodeCovers: "A multi-tier NetworkPolicy enforcing default-deny, allowing frontend-to-backend communication on port 8080, and strictly isolating database egress to port 5432 and CoreDNS on port 53.",
    conceptsCovered: ["NetworkPolicy", "default-deny", "Ingress Whitelist", "Egress Whitelist", "CoreDNS Egress"],
    code: `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-api-network-policy
  namespace: production
spec:
  podSelector:
    matchLabels:
      app: backend-api
  policyTypes:
  - Ingress
  - Egress
  ingress:
  # Allow Ingress ONLY from frontend pods on port 8080
  - from:
    - podSelector:
        matchLabels:
          app: frontend-ui
    ports:
    - protocol: TCP
      port: 8080
  egress:
  # 1. Allow Egress to Postgres database pods on port 5432
  - to:
    - podSelector:
        matchLabels:
          app: postgres-db
    ports:
    - protocol: TCP
      port: 5432
  # 2. Allow Egress to CoreDNS pods in kube-system on port 53 (UDP & TCP)
  - to:
    - namespaceSelector:
        matchLabels:
          kubernetes.io/metadata.name: kube-system
      podSelector:
        matchLabels:
          k8s-app: kube-dns
    ports:
    - protocol: UDP
      port: 53
    - protocol: TCP
      port: 53`,
    breakdown: "Enforces strict microservice segmentation. Lateral movement is completely blocked: even if backend-api is compromised, it cannot reach other namespaces or the public Internet.",
    expectedOutput: "Backend API receives traffic strictly from Frontend UI, can only talk to PostgreSQL and CoreDNS, and rejects all other network communication."
  },
  {
    id: "k8s-ex-12",
    title: "Least-Privilege RBAC: ServiceAccount, Role & RoleBinding for CI/CD",
    category: "Security, RBAC & Policy Governance",
    difficulty: "intermediate",
    whatThisCodeCovers: "A scoped RBAC definition granting a CI/CD automation ServiceAccount permission to deploy and roll out updates within a single namespace without cluster admin rights.",
    conceptsCovered: ["ServiceAccount", "Role", "RoleBinding", "RBAC Verbs", "Least-Privilege"],
    code: `apiVersion: v1
kind: ServiceAccount
metadata:
  name: github-actions-deployer
  namespace: staging
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: deployment-manager
  namespace: staging
rules:
# 1. Manage Deployments and Rollouts
- apiGroups: ["apps"]
  resources: ["deployments", "replicasets"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
# 2. View Pods and Stream Logs
- apiGroups: [""]
  resources: ["pods", "pods/log"]
  verbs: ["get", "list", "watch"]
# 3. Manage ConfigMaps for releases
- apiGroups: [""]
  resources: ["configmaps"]
  verbs: ["get", "list", "watch", "create", "update", "patch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: bind-deployer-role
  namespace: staging
subjects:
- kind: ServiceAccount
  name: github-actions-deployer
  namespace: staging
roleRef:
  kind: Role
  name: deployment-manager
  apiGroup: rbac.authorization.k8s.io`,
    breakdown: "Confines the deployment pipeline strictly to the 'staging' namespace. Prevents destructive permissions like deleting namespaces or accessing secrets outside the project.",
    expectedOutput: "The github-actions-deployer ServiceAccount can execute rolling updates and tail logs in 'staging' while being denied access to secrets and other namespaces."
  },
  {
    id: "k8s-ex-13",
    title: "ClusterRole & ClusterRoleBinding for Global Monitoring & Telemetry",
    category: "Security, RBAC & Policy Governance",
    difficulty: "intermediate",
    whatThisCodeCovers: "A cluster-wide ClusterRole granting Prometheus or Datadog collectors read-only visibility into Nodes, Services, Pods, and Endpoints across all namespaces.",
    conceptsCovered: ["ClusterRole", "ClusterRoleBinding", "Non-Resource URLs", "metrics scraping"],
    code: `apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: prometheus-cluster-reader
rules:
# 1. Core cluster resources
- apiGroups: [""]
  resources:
  - nodes
  - nodes/metrics
  - services
  - endpoints
  - pods
  verbs: ["get", "list", "watch"]
# 2. Non-resource metrics endpoints
- nonResourceURLs: ["/metrics", "/metrics/cadvisor"]
  verbs: ["get"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: prometheus-cluster-binding
subjects:
- kind: ServiceAccount
  name: prometheus-k8s
  namespace: monitoring
roleRef:
  kind: ClusterRole
  name: prometheus-cluster-reader
  apiGroup: rbac.authorization.k8s.io`,
    breakdown: "Binds cluster-scoped read permissions without granting write/delete powers, allowing the monitoring stack to discover all pod endpoints globally.",
    expectedOutput: "Prometheus ServiceAccount reads node metrics and watches pods globally without having privileges to alter or delete any cluster objects."
  },
  {
    id: "k8s-ex-14",
    title: "Enforcing Pod Security Standards 'Restricted' Profile",
    category: "Security, RBAC & Policy Governance",
    difficulty: "advanced",
    whatThisCodeCovers: "A namespace labeled with PSA 'restricted' policy and a matching Pod SecurityContext that drops all Linux capabilities, runs as non-root, and mounts a read-only rootfs.",
    conceptsCovered: ["Pod Security Admission", "pod-security.kubernetes.io/enforce", "readOnlyRootFilesystem", "drop ALL capabilities", "runAsNonRoot"],
    code: `apiVersion: v1
kind: Namespace
metadata:
  name: secure-apps
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/enforce-version: latest
    pod-security.kubernetes.io/warn: restricted
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hardened-microservice
  namespace: secure-apps
spec:
  replicas: 2
  selector:
    matchLabels:
      app: secure-app
  template:
    metadata:
      labels:
        app: secure-app
    spec:
      securityContext:
        runAsNonRoot: true
        runAsUser: 10001
        runAsGroup: 10001
        fsGroup: 10001
        seccompProfile:
          type: RuntimeDefault
      containers:
      - name: app
        image: registry.example.com/app:v1.0
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop: ["ALL"]
        volumeMounts:
        - name: tmp-dir
          mountPath: /tmp
      volumes:
      - name: tmp-dir
        emptyDir: {}`,
    breakdown: "Enforces zero-trust container sandboxing. If any container attempts privilege escalation or root execution, kube-apiserver rejects admission immediately.",
    expectedOutput: "Deployment passes admission under strict 'restricted' PSA policy with read-only rootfs and no host capabilities."
  },
  {
    id: "k8s-ex-15",
    title: "External Secrets Operator (ESO) Syncing from AWS Secrets Manager",
    category: "Configuration & Secrets",
    difficulty: "advanced",
    whatThisCodeCovers: "Enterprise secrets management using External Secrets Operator to automatically synchronize sensitive API keys and database credentials from AWS Secrets Manager.",
    conceptsCovered: ["External Secrets Operator", "ClusterSecretStore", "ExternalSecret", "IRSA", "Automated Rotation"],
    code: `apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: aws-secrets-manager
spec:
  provider:
    aws:
      service: SecretsManager
      region: us-east-1
      auth:
        jwt:
          serviceAccountRef:
            name: eso-irsa-sa
            namespace: external-secrets
---
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: payment-gateway-secret
  namespace: production
spec:
  refreshInterval: "1h" # Poll AWS Secrets Manager hourly for rotations
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: payment-creds # Native K8s Secret generated automatically
    creationPolicy: Owner
  data:
  - secretKey: STRIPE_API_KEY
    remoteRef:
      key: production/finance/payment-api
      property: stripe_secret_key
  - secretKey: DB_PASSWORD
    remoteRef:
      key: production/finance/payment-api
      property: db_password`,
    breakdown: "ESO synchronizes external enterprise KMS/Vault secrets into native Kubernetes Secrets automatically every hour, eliminating raw secrets from Git commits.",
    expectedOutput: "A native Kubernetes Secret named 'payment-creds' is generated and continuously updated with live credentials fetched from AWS Secrets Manager."
  },
  {
    id: "k8s-ex-16",
    title: "Live ConfigMap Mounting with Symlinks vs SubPath Invalidation",
    category: "Configuration & Secrets",
    difficulty: "intermediate",
    whatThisCodeCovers: "A ConfigMap volume mount pattern demonstrating directory mounting for live in-memory configuration updates without container restarts.",
    conceptsCovered: ["ConfigMap", "atomic-symlinks", "live-update", "subPath caveats", "volumeMounts"],
    code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: app-dynamic-config
  namespace: production
data:
  appsettings.json: |
    {
      "LogLevel": "Information",
      "FeatureFlag_NewCheckout": true,
      "TimeoutSeconds": 15
    }
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: config-consumer
  namespace: production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: consumer
  template:
    metadata:
      labels:
        app: consumer
    spec:
      containers:
      - name: consumer
        image: app/consumer:v1
        volumeMounts:
        # NOTE: Mounting full directory uses Kubelet atomic symlinks for live updates!
        # Do NOT use subPath if you want live file updates without restarting pods.
        - name: config-volume
          mountPath: /etc/app-config
          readOnly: true
      volumes:
      - name: config-volume
        configMap:
          name: app-dynamic-config`,
    breakdown: "Mounting the ConfigMap as a directory allows Kubelet to update the underlying ..data symlink atomically within ~60 seconds of ConfigMap edits, enabling zero-restart hot-reloads.",
    expectedOutput: "Modifying app-dynamic-config updates /etc/app-config/appsettings.json inside the running container in real time without pod restarts."
  },
  {
    id: "k8s-ex-17",
    title: "Preserving Client Source IP with ExternalTrafficPolicy Local",
    category: "Networking & Services",
    difficulty: "intermediate",
    whatThisCodeCovers: "A LoadBalancer Service configured with externalTrafficPolicy: Local to prevent SNAT rewriting and preserve true client IP addresses for auditing and geofencing.",
    conceptsCovered: ["LoadBalancer", "externalTrafficPolicy: Local", "SNAT", "Client Source IP", "HealthCheckNodePort"],
    code: `apiVersion: v1
kind: Service
metadata:
  name: public-web-ingress
  namespace: production
  annotations:
    service.beta.kubernetes.io/aws-load-balancer-type: "nlb"
    service.beta.kubernetes.io/aws-load-balancer-scheme: "internet-facing"
spec:
  type: LoadBalancer
  # CRITICAL: Local preserves original client IP and avoids extra inter-node hops
  externalTrafficPolicy: Local
  selector:
    app: public-nginx
  ports:
  - port: 80
    targetPort: 8080
    protocol: TCP
    name: http
  - port: 443
    targetPort: 8443
    protocol: TCP
    name: https`,
    breakdown: "Setting externalTrafficPolicy to Local instructs kube-proxy to bypass SNAT. Only nodes hosting healthy pods receive external traffic, exposing the client's actual IP to X-Forwarded-For.",
    expectedOutput: "Application container logs display genuine client public IP addresses instead of cluster node private IP addresses."
  },
  {
    id: "k8s-ex-18",
    title: "Dual-Stack IPv4/IPv6 Service & Pod Networking Configuration",
    category: "Networking & Services",
    difficulty: "advanced",
    whatThisCodeCovers: "A Service manifest enabling dual-stack networking to seamlessly accept both IPv4 and IPv6 incoming connections across multi-cloud infrastructure.",
    conceptsCovered: ["DualStack", "ipFamilies", "ipFamilyPolicy", "IPv4/IPv6", "PreferDualStack"],
    code: `apiVersion: v1
kind: Service
metadata:
  name: dual-stack-gateway
  namespace: production
spec:
  type: ClusterIP
  # Specify IPv4 first, IPv6 second
  ipFamilies:
  - IPv4
  - IPv6
  # PreferDualStack allocates both IPv4 and IPv6 ClusterIPs
  ipFamilyPolicy: PreferDualStack
  selector:
    app: web-server
  ports:
  - port: 80
    targetPort: 8080
    name: http`,
    breakdown: "Enables Kubernetes dual-stack networking, allocating two distinct Virtual IPs from cluster subnets so workloads communicate over both protocols simultaneously.",
    expectedOutput: "The service is assigned both an IPv4 (e.g. 10.96.12.4) and IPv6 (e.g. fd00:10:96::a1) ClusterIP address."
  },
  {
    id: "k8s-ex-19",
    title: "Optimized NodeLocal DNSCache DaemonSet with CoreDNS Rewrites",
    category: "Networking & Services",
    difficulty: "advanced",
    whatThisCodeCovers: "A NodeLocal DNSCache DaemonSet setup running a local caching agent on 169.254.20.10 to eliminate 5-second DNS timeouts and conntrack table saturation.",
    conceptsCovered: ["NodeLocal DNSCache", "CoreDNS", "conntrack bypass", "169.254.20.10", "DNS Caching"],
    code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: node-local-dns
  namespace: kube-system
data:
  Corefile: |
    cluster.local:53 {
        errors
        cache {
            success 9984 30
            denial 9984 5
        }
        reload
        loop
        bind 169.254.20.10
        forward . __PILLAR__CLUSTER__DNS__ {
            force_tcp
        }
        prometheus :9253
        health 169.254.20.10:8080
    }
    .:53 {
        errors
        cache 30
        reload
        loop
        bind 169.254.20.10
        forward . __PILLAR__UPSTREAM__SERVERS__
        prometheus :9253
    }`,
    breakdown: "Intercepts DNS requests locally on the host node loopback IP (169.254.20.10), serving cached records over TCP and eliminating UDP race conditions in iptables conntrack.",
    expectedOutput: "DNS query latency drops below 1ms with zero 5-second UDP conntrack packet drops."
  },
  {
    id: "k8s-ex-20",
    title: "Node Affinity & Taints with NoExecute Eviction Tolerations",
    category: "Scheduling & Resource Allocation",
    difficulty: "advanced",
    whatThisCodeCovers: "A specialized workload manifest pinning GPU pods to dedicated hardware nodes using required node affinity and enduring maintenance taints with tolerationSeconds.",
    conceptsCovered: ["nodeAffinity", "tolerations", "NoExecute", "tolerationSeconds", "Dedicated GPU Nodes"],
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ml-inference-engine
  namespace: mlops
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ml-inference
  template:
    metadata:
      labels:
        app: ml-inference
    spec:
      affinity:
        nodeAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
            nodeSelectorTerms:
            - matchExpressions:
              - key: accelerator
                operator: In
                values: ["nvidia-a100", "nvidia-h100"]
      tolerations:
      # Tolerate dedicated GPU taint
      - key: "hardware/gpu"
        operator: "Equal"
        value: "true"
        effect: "NoSchedule"
      # Tolerate node draining maintenance for 5 minutes before eviction
      - key: "node.kubernetes.io/unreachable"
        operator: "Exists"
        effect: "NoExecute"
        tolerationSeconds: 300
      containers:
      - name: inference
        image: ml/model:v2.0
        resources:
          limits:
            nvidia.com/gpu: 1`,
    breakdown: "Restricts scheduling to nodes with NVIDIA A100/H100 hardware, tolerates dedicated GPU taints, and survives transient node network unreachable events for up to 300 seconds before being evicted.",
    expectedOutput: "Pods successfully schedule exclusively onto dedicated GPU nodes while ignoring general application worker pools."
  }
];
