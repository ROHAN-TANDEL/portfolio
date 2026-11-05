// scripts/examples_kubernetes/part1_recipes_01_to_10.cjs
module.exports = [
  {
    id: "k8s-ex-01",
    title: "Zero-Downtime RollingUpdate Deployment with Graceful Shutdown & Probes",
    category: "Workloads & Pod Lifecycle",
    difficulty: "intermediate",
    whatThisCodeCovers: "A production-grade Deployment manifest featuring 25% rolling update limits, startup/readiness/liveness probes, and preStop sleep hooks to prevent dropped in-flight HTTP connections during pod termination.",
    conceptsCovered: ["RollingUpdate", "maxSurge", "maxUnavailable", "preStop Hook", "readinessProbe", "livenessProbe", "startupProbe"],
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-api
  namespace: production
  labels:
    app.kubernetes.io/name: payment-api
spec:
  replicas: 4
  revisionHistoryLimit: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%        # Spin up 1 extra pod before killing old ones
      maxUnavailable: 0     # Ensure 100% target capacity during rollout
  selector:
    matchLabels:
      app: payment-api
  template:
    metadata:
      labels:
        app: payment-api
    spec:
      terminationGracePeriodSeconds: 60
      containers:
      - name: payment-api
        image: registry.example.com/finance/payment-api:v2.4.0
        lifecycle:
          preStop:
            exec:
              # Give kube-proxy / ingress controllers 15s to remove pod from endpoints
              command: ["/bin/sh", "-c", "sleep 15"]
        ports:
        - containerPort: 8080
          name: http
        startupProbe:
          httpGet:
            path: /healthz/startup
            port: http
          failureThreshold: 30
          periodSeconds: 2 # Up to 60s warm up
        readinessProbe:
          httpGet:
            path: /healthz/ready
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 2
        livenessProbe:
          httpGet:
            path: /healthz/live
            port: http
          periodSeconds: 10
          failureThreshold: 3
        resources:
          requests:
            cpu: 250m
            memory: 512Mi
          limits:
            cpu: 1000m
            memory: 1024Mi`,
    breakdown: "Sets maxUnavailable to 0 ensuring full throughput throughout updates. PreStop hook executes a 15-second sleep, providing ample propagation time for endpoints controllers to sever inbound traffic before the application process receives SIGTERM.",
    expectedOutput: "Zero dropped HTTP requests during rolling updates, with graceful TCP connection drainage and automatic rollback on probe failures."
  },
  {
    id: "k8s-ex-02",
    title: "Production StatefulSet with Headless Service & VolumeClaimTemplates",
    category: "Workloads & Pod Lifecycle",
    difficulty: "advanced",
    whatThisCodeCovers: "A clustered stateful deployment (PostgreSQL/Kafka style) using StatefulSets, dedicated Headless Service DNS routing, and per-pod dynamic PersistentVolumeClaim storage templates.",
    conceptsCovered: ["StatefulSet", "Headless Service", "volumeClaimTemplates", "podAntiAffinity", "orderedReady"],
    code: `apiVersion: v1
kind: Service
metadata:
  name: postgres-cluster-headless
  namespace: databases
  labels:
    app: postgres-cluster
spec:
  clusterIP: None # Headless service for direct DNS routing
  ports:
  - port: 5432
    name: postgresql
  selector:
    app: postgres-cluster
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres-node
  namespace: databases
spec:
  serviceName: "postgres-cluster-headless"
  replicas: 3
  podManagementPolicy: OrderedReady
  updateStrategy:
    type: RollingUpdate
  selector:
    matchLabels:
      app: postgres-cluster
  template:
    metadata:
      labels:
        app: postgres-cluster
    spec:
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchExpressions:
              - key: app
                operator: In
                values: ["postgres-cluster"]
            topologyKey: "kubernetes.io/hostname" # Strict one pod per node
      containers:
      - name: postgres
        image: postgres:15.4-alpine
        ports:
        - containerPort: 5432
          name: postgresql
        volumeMounts:
        - name: pgdata
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: pgdata
    spec:
      accessModes: [ "ReadWriteOnce" ]
      storageClassName: "gp3-ebs"
      resources:
        requests:
          storage: 100Gi`,
    breakdown: "Combines a headless service with volumeClaimTemplates so each replica gets a dedicated, isolated cloud block volume (pgdata-postgres-node-0, 1, 2) and deterministic DNS hostname.",
    expectedOutput: "Stable ordinal pods postgres-node-0, postgres-node-1, postgres-node-2 each retaining their attached 100Gi EBS volumes across pod restarts."
  },
  {
    id: "k8s-ex-03",
    title: "High-Throughput Ingress with TLS Termination, Path Routing & Rate Limiting",
    category: "Networking & Services",
    difficulty: "intermediate",
    whatThisCodeCovers: "An enterprise NGINX Ingress manifest routing traffic across microservices, terminating TLS using Cert-Manager certificates, and enforcing rate limiting.",
    conceptsCovered: ["Ingress", "TLS Termination", "Cert-Manager", "Rate Limiting", "Path Prefix Routing"],
    code: `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: enterprise-api-gateway
  namespace: production
  annotations:
    kubernetes.io/ingress.class: "nginx"
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
    nginx.ingress.kubernetes.io/limit-rps: "100"           # 100 req/sec rate limit per client IP
    nginx.ingress.kubernetes.io/limit-burst-multiplier: "3" # Burst factor
    nginx.ingress.kubernetes.io/proxy-read-timeout: "60"
spec:
  tls:
  - hosts:
    - api.company.com
    secretName: api-company-tls-cert
  rules:
  - host: api.company.com
    http:
      paths:
      - path: /v1/orders
        pathType: Prefix
        backend:
          service:
            name: order-service
            port:
              number: 8080
      - path: /v1/payments
        pathType: Prefix
        backend:
          service:
            name: payment-service
            port:
              number: 8080`,
    breakdown: "Defines path-based layer 7 routing under a single TLS-secured domain, enforcing strict TLS redirection and automated SSL certificate management with NGINX rate-limiting.",
    expectedOutput: "Secure HTTPS endpoints on api.company.com routing /v1/orders and /v1/payments with automatic HTTP-to-HTTPS redirect and 100 req/s rate limits."
  },
  {
    id: "k8s-ex-04",
    title: "Dynamic Persistent Volume Provisioning with WaitForFirstConsumer",
    category: "Storage & Persistence",
    difficulty: "intermediate",
    whatThisCodeCovers: "A cloud-agnostic StorageClass and PersistentVolumeClaim configuration enforcing delayed volume binding until pod scheduling, preventing Availability Zone mismatches.",
    conceptsCovered: ["StorageClass", "volumeBindingMode", "WaitForFirstConsumer", "allowVolumeExpansion", "PVC"],
    code: `apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: high-performance-ssd
provisioner: ebs.csi.aws.com
volumeBindingMode: WaitForFirstConsumer # Delay creation until Pod is placed on a node!
allowVolumeExpansion: true              # Permit dynamic disk size increase
reclaimPolicy: Delete
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
---
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: elasticsearch-data-pvc
  namespace: logging
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: high-performance-ssd
  resources:
    requests:
      storage: 250Gi`,
    breakdown: "WaitForFirstConsumer halts dynamic volume creation until the scheduler assigns the consumer pod to a specific node, ensuring the cloud block volume is provisioned in the exact same Availability Zone.",
    expectedOutput: "PVC status remains 'Pending' until a consuming pod is scheduled, at which point the 250Gi gp3 volume is provisioned in the correct zone and transitions to 'Bound'."
  },
  {
    id: "k8s-ex-05",
    title: "Horizontal Pod Autoscaler (HPA v2) with Multi-Metric Scaling",
    category: "Autoscaling & Capacity Planning",
    difficulty: "advanced",
    whatThisCodeCovers: "An HPA v2 manifest scaling a deployment based on both average CPU utilization (70%) and a custom Prometheus business metric (HTTP request rate of 1500 req/sec).",
    conceptsCovered: ["HPA v2", "Custom Metrics", "Resource Metrics", "scaleDown StabilizationWindow", "autoscaling/v2"],
    code: `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: checkout-scaler
  namespace: production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: checkout-service
  minReplicas: 3
  maxReplicas: 30
  metrics:
  # Metric 1: System Resource (CPU)
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  # Metric 2: Application Throughput (Prometheus Custom Metric)
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second
      target:
        type: AverageValue
        averageValue: 1500m # 1.5 requests/sec per pod
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300 # Prevent premature flapping
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60`,
    breakdown: "HPA calculates target replicas across both metrics and selects the maximum replica count, ensuring capacity spikes during CPU-intensive tasks or high-throughput request floods.",
    expectedOutput: "Automated scaling between 3 and 30 replicas with a 5-minute cooldown stabilization window dampening downscaling spikes."
  },
  {
    id: "k8s-ex-06",
    title: "Pod Topology Spread Constraints across Multi-Zone Availability Domains",
    category: "Scheduling & Resource Allocation",
    difficulty: "advanced",
    whatThisCodeCovers: "Production topology spread configuration ensuring application pods are evenly distributed across cloud Availability Zones with maxSkew=1.",
    conceptsCovered: ["topologySpreadConstraints", "maxSkew", "topologyKey", "whenUnsatisfiable", "DoNotSchedule"],
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: auth-service
  namespace: production
spec:
  replicas: 6
  selector:
    matchLabels:
      app: auth-service
  template:
    metadata:
      labels:
        app: auth-service
    spec:
      topologySpreadConstraints:
      # 1. Distribute across Availability Zones
      - maxSkew: 1
        topologyKey: topology.kubernetes.io/zone
        whenUnsatisfiable: DoNotSchedule # Hard enforcement
        labelSelector:
          matchLabels:
            app: auth-service
      # 2. Distribute across physical Nodes within zones
      - maxSkew: 1
        topologyKey: kubernetes.io/hostname
        whenUnsatisfiable: ScheduleAnyway # Soft preference
        labelSelector:
          matchLabels:
            app: auth-service
      containers:
      - name: auth-service
        image: auth-service:v1.0.0
        ports:
        - containerPort: 8080`,
    breakdown: "Restricts difference between any two zones to at most 1 replica. If an entire cloud zone experiences an outage, surviving zones maintain equal, redundant load distribution.",
    expectedOutput: "6 replicas scheduled as exactly 2 in us-east-1a, 2 in us-east-1b, and 2 in us-east-1c."
  },
  {
    id: "k8s-ex-07",
    title: "PodDisruptionBudget (PDB) Enforcing Minimum High-Availability",
    category: "Scheduling & Resource Allocation",
    difficulty: "intermediate",
    whatThisCodeCovers: "A PodDisruptionBudget guaranteeing that automated node drains, cluster upgrades, and autoscaler consolidations cannot drop available replicas below safe thresholds.",
    conceptsCovered: ["PodDisruptionBudget", "minAvailable", "maxUnavailable", "kubectl drain", "cluster upgrades"],
    code: `apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: order-service-pdb
  namespace: production
spec:
  minAvailable: 80% # Guarantee at least 80% of desired pods remain ready
  selector:
    matchLabels:
      app: order-service
---
# Alternative PDB using absolute integer count
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: critical-redis-pdb
  namespace: caching
spec:
  maxUnavailable: 1 # At most 1 pod may be down during maintenance
  selector:
    matchLabels:
      app: redis-sentinel`,
    breakdown: "When an engineer or automated agent issues 'kubectl drain', the Eviction API rejects eviction requests if the eviction would violate the PDB's minAvailable threshold.",
    expectedOutput: "Cluster maintenance operations drain nodes one by one without breaching the 80% service availability guarantee."
  },
  {
    id: "k8s-ex-08",
    title: "Resilient CronJob with Forbid Concurrency & ActiveDeadlineSeconds",
    category: "Workloads & Pod Lifecycle",
    difficulty: "intermediate",
    whatThisCodeCovers: "A production batch CronJob configured to prevent overlapping job executions, enforce hard runtime timeouts, and limit history retention.",
    conceptsCovered: ["CronJob", "concurrencyPolicy", "Forbid", "activeDeadlineSeconds", "successfulJobsHistoryLimit"],
    code: `apiVersion: batch/v1
kind: CronJob
metadata:
  name: nightly-financial-ledger-sync
  namespace: finance
spec:
  schedule: "0 2 * * *" # Every morning at 2:00 AM UTC
  concurrencyPolicy: Forbid # Never start a new job if previous run is still active!
  startingDeadlineSeconds: 300
  successfulJobsHistoryLimit: 3
  failedJobsHistoryLimit: 5
  jobTemplate:
    spec:
      activeDeadlineSeconds: 3600 # Hard kill if job runs > 1 hour
      backoffLimit: 3             # Retry failed pods at most 3 times
      template:
        spec:
          restartPolicy: OnFailure
          containers:
          - name: ledger-sync
            image: registry.example.com/finance/ledger-worker:latest
            command: ["npm", "run", "sync:ledger"]
            resources:
              requests:
                cpu: 500m
                memory: 1Gi`,
    breakdown: "concurrencyPolicy: Forbid prevents double-processing financial transactions if a job hangs. activeDeadlineSeconds terminates stalled batch runs after 1 hour.",
    expectedOutput: "Reliable nightly execution with execution overlap prevention and automated pruning of old completed job pods."
  },
  {
    id: "k8s-ex-09",
    title: "InitContainers for Database Schema Migration & Service Wait Gates",
    category: "Workloads & Pod Lifecycle",
    difficulty: "intermediate",
    whatThisCodeCovers: "A Pod specification utilizing chained initContainers to wait for backend PostgreSQL connectivity and apply Liquibase/Flyway migrations before launching application containers.",
    conceptsCovered: ["initContainers", "nc connectivity check", "Database Migration", "Chained Init Steps"],
    code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: user-management-service
  namespace: production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: user-management
  template:
    metadata:
      labels:
        app: user-management
    spec:
      initContainers:
      # Init 1: Wait until PostgreSQL TCP port 5432 is responding
      - name: wait-for-postgres
        image: busybox:1.36
        command: ['sh', '-c',
          'until nc -z -w 2 postgres-cluster.databases.svc.cluster.local 5432; do
             echo "Waiting for postgresql cluster...";
             sleep 2;
           done']
      # Init 2: Execute Liquibase / Prisma / TypeORM schema migration
      - name: db-migrate
        image: registry.example.com/apps/user-migration:v1.4.0
        command: ["npm", "run", "prisma:migrate:deploy"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: connection_string
      containers:
      - name: user-app
        image: registry.example.com/apps/user-api:v1.4.0
        ports:
        - containerPort: 3000`,
    breakdown: "Init containers execute sequentially to completion before main containers start. If migrations fail, the pod restarts the init container with backoff, preventing application crashes against unmigrated tables.",
    expectedOutput: "Guaranteed sequential startup: connectivity check succeeds -> migration runs -> application server launches."
  },
  {
    id: "k8s-ex-10",
    title: "DaemonSet with HostPort & Tolerations for Cluster-Wide Telemetry",
    category: "Workloads & Pod Lifecycle",
    difficulty: "advanced",
    whatThisCodeCovers: "A DaemonSet manifest deploying a node-level telemetry and security agent across every worker and master node using tolerations and host PID access.",
    conceptsCovered: ["DaemonSet", "tolerations", "NoSchedule", "hostPID", "hostPath"],
    code: `apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: node-telemetry-agent
  namespace: monitoring
spec:
  selector:
    matchLabels:
      app: node-telemetry
  template:
    metadata:
      labels:
        app: node-telemetry
    spec:
      hostPID: true
      hostNetwork: true
      dnsPolicy: ClusterFirstWithHostNet
      tolerations:
      # Tolerate master / control-plane taints to monitor all nodes
      - key: node-role.kubernetes.io/control-plane
        operator: Exists
        effect: NoSchedule
      - key: node-role.kubernetes.io/master
        operator: Exists
        effect: NoSchedule
      containers:
      - name: agent
        image: agent/telemetry:v3.2.0
        securityContext:
          privileged: true
        volumeMounts:
        - name: proc
          mountPath: /host/proc
          readOnly: true
        - name: sys
          mountPath: /host/sys
          readOnly: true
      volumes:
      - name: proc
        hostPath:
          path: /proc
      - name: sys
        hostPath:
          path: /sys`,
    breakdown: "Deploys exactly 1 replica per node throughout the cluster. Tolerations allow scheduling onto tainted control-plane nodes, providing 100% cluster-wide telemetry coverage.",
    expectedOutput: "Telemetry agents launched on every node in the cluster, including master nodes, continuously monitoring host /proc and /sys."
  }
];
