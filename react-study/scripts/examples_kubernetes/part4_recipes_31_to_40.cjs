// scripts/examples_kubernetes/part4_recipes_31_to_40.cjs
module.exports = [
  {
    id: "k8s-ex-31",
    title: "ArgoCD Application with Automated Sync, Pruning & Drift Self-Healing",
    category: "Packaging, GitOps & Progressive Delivery",
    difficulty: "intermediate",
    whatThisCodeCovers: "A production ArgoCD Application definition synchronizing a microservice from a Git repository with automated self-healing and pruning.",
    conceptsCovered: ["ArgoCD", "Application CRD", "selfHeal", "prune", "syncPolicy"],
    code: `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: order-service-production
  namespace: argocd
  finalizers:
  - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: 'https://github.com/company/microservices-fleet.git'
    targetRevision: main
    path: apps/order-service/overlays/production
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: orders
  syncPolicy:
    automated:
      prune: true     # Remove cluster resources deleted in Git
      selfHeal: true  # Revert manual kubectl edits back to Git state
    syncOptions:
    - CreateNamespace=true
    - ApplyOutOfSyncOnly=true
    retry:
      limit: 5
      backoff:
        duration: 5s
        factor: 2
        maxDuration: 3m`,
    breakdown: "Binds Git repo to Kubernetes namespace. Automatically syncs commits, prunes stale manifests, and reverts unauthorized manual kubectl changes within seconds.",
    expectedOutput: "The order service deploys automatically and self-heals cluster drift back to the Git source of truth."
  },
  {
    id: "k8s-ex-32",
    title: "ArgoCD ApplicationSet Matrix Generator for Fleet-Wide Deployment",
    category: "Packaging, GitOps & Progressive Delivery",
    difficulty: "advanced",
    whatThisCodeCovers: "An ApplicationSet combining a Git directory generator and cluster label generator to deploy 50 microservices across multiple regional clusters without duplicating YAML.",
    conceptsCovered: ["ApplicationSet", "Matrix Generator", "Git Generator", "Cluster Generator", "Multi-Cluster"],
    code: `apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: fleet-matrix-deployer
  namespace: argocd
spec:
  generators:
  - matrix:
      generators:
      # Generator 1: All registered clusters matching production label
      - clusters:
          selector:
            matchLabels:
              type: production
      # Generator 2: All microservices found in apps/ directory in Git
      - git:
          repoURL: https://github.com/company/monorepo.git
          revision: main
          directories:
          - path: apps/*
  template:
    metadata:
      name: '{{path.basename}}-{{name}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/company/monorepo.git
        targetRevision: main
        path: '{{path}}/overlays/{{name}}'
      destination:
        server: '{{server}}'
        namespace: '{{path.basename}}'
      syncPolicy:
        automated:
          prune: true
          selfHeal: true`,
    breakdown: "Dynamically calculates the Cartesian product of Git apps and target clusters, automatically creating individual Application CRDs for each microservice on every regional cluster.",
    expectedOutput: "Dozens of ArgoCD Applications generated dynamically with zero manifest duplication."
  },
  {
    id: "k8s-ex-33",
    title: "Argo Rollouts Progressive Canary Deployment with Istio Traffic Steps",
    category: "Packaging, GitOps & Progressive Delivery",
    difficulty: "advanced",
    whatThisCodeCovers: "A drop-in replacement for standard Deployments using Argo Rollouts to execute a progressive canary rollout with Istio traffic shifting (5% -> 20% -> 50% -> 100%).",
    conceptsCovered: ["Argo Rollouts", "Canary Strategy", "Istio VirtualService", "setWeight", "Progressive Delivery"],
    code: `apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: customer-portal
  namespace: frontend
spec:
  replicas: 10
  strategy:
    canary:
      canaryService: customer-portal-canary
      stableService: customer-portal-stable
      trafficRouting:
        istio:
          virtualService:
            name: customer-portal-vsvc
            routes: ["primary"]
      steps:
      - setWeight: 5
      - pause: { duration: 10m } # Hold 5% canary for 10 minutes
      - setWeight: 20
      - pause: { duration: 30m } # Hold 20% canary for 30 minutes
      - setWeight: 50
      - pause: { duration: 15m }
  selector:
    matchLabels:
      app: customer-portal
  template:
    metadata:
      labels:
        app: customer-portal
    spec:
      containers:
      - name: web
        image: registry.example.com/frontend/portal:v2.0.0
        ports:
        - containerPort: 3000`,
    breakdown: "Replaces traditional coarse rolling updates with fine-grained fractional traffic shifting via Istio, ensuring new releases are validated on small subsets of production users before broad rollout.",
    expectedOutput: "Canary pods receive exactly 5%, then 20%, then 50% of real user traffic, advancing sequentially across pause windows."
  },
  {
    id: "k8s-ex-34",
    title: "Argo Rollouts Automated AnalysisTemplate with Prometheus PromQL",
    category: "Packaging, GitOps & Progressive Delivery",
    difficulty: "advanced",
    whatThisCodeCovers: "An AnalysisTemplate that continuously queries Prometheus during a canary deployment, aborting the rollout and rolling back if HTTP 5xx errors exceed 1%.",
    conceptsCovered: ["AnalysisTemplate", "PromQL Assertion", "Automated Rollback", "successCondition", "failureLimit"],
    code: `apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: http-error-rate-guard
  namespace: frontend
spec:
  metrics:
  - name: success-rate
    interval: 1m
    successCondition: result[0] <= 0.01 # Error rate must not exceed 1.0%
    failureLimit: 2 # Abort rollout after 2 consecutive failures
    provider:
      prometheus:
        address: http://prometheus-k8s.monitoring:9090
        query: |
          sum(rate(http_requests_total{status=~"5.*",app="customer-portal"}[1m]))
          /
          sum(rate(http_requests_total{app="customer-portal"}[1m]))`,
    breakdown: "Attaches to Rollout canary steps. Queries Prometheus every minute; if the PromQL query evaluates to >0.01 twice, the rollout aborts immediately and routes 100% of traffic back to stable pods.",
    expectedOutput: "Autonomous metric-driven deployment validation with instant rollback on error threshold breaches."
  },
  {
    id: "k8s-ex-35",
    title: "FluxCD GitRepository & Kustomization Toolkit Custom Resources",
    category: "Packaging, GitOps & Progressive Delivery",
    difficulty: "intermediate",
    whatThisCodeCovers: "Declarative GitOps configuration using the FluxCD GitOps Toolkit to continuously reconcile Kustomize overlays with automated health checking.",
    conceptsCovered: ["FluxCD", "GitRepository", "Kustomization CRD", "GitOps Toolkit", "Health Checks"],
    code: `apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: fleet-manifests
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/company/infrastructure-fleet
  ref:
    branch: main
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: payment-apps
  namespace: flux-system
spec:
  interval: 5m
  targetNamespace: production
  prune: true
  sourceRef:
    kind: GitRepository
    name: fleet-manifests
  path: "./clusters/production/apps"
  timeout: 3m
  wait: true # Block sync until all Deployment pods pass readiness checks
  healthChecks:
  - apiVersion: apps/v1
    kind: Deployment
    name: payment-api
    namespace: production`,
    breakdown: "FluxCD Source Controller pulls Git commits; Kustomize Controller validates and applies manifests, waiting for all pod healthchecks to pass before marking the release Ready.",
    expectedOutput: "Continuous, automated reconciliation of cluster state directly from Git with healthcheck validation."
  },
  {
    id: "k8s-ex-36",
    title: "Prometheus Operator ServiceMonitor Discovery Configuration",
    category: "Observability, Operations & Troubleshooting",
    difficulty: "intermediate",
    whatThisCodeCovers: "A declarative ServiceMonitor resource instructing Prometheus Operator to discover and scrape application metrics endpoints dynamically based on labels.",
    conceptsCovered: ["ServiceMonitor", "Prometheus Operator", "matchLabels", "scrape interval", "telemetry discovery"],
    code: `apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: checkout-api-monitor
  namespace: production
  labels:
    release: prometheus-stack # Scraped by this Prometheus instance
spec:
  selector:
    matchLabels:
      app: checkout-api
  endpoints:
  - port: metrics # Must match port name on Kubernetes Service
    path: /metrics
    interval: 15s
    scrapeTimeout: 10s
    metricRelabelings:
    # Drop noisy high-cardinality endpoint paths
    - sourceLabels: [__name__]
      regex: "go_gc_.*"
      action: drop`,
    breakdown: "Discovers target pods automatically through the Service's selector without modifying static prometheus.yml files, applying relabeling rules to drop noisy metrics at scrape time.",
    expectedOutput: "Prometheus scrapes all checkout-api pods every 15s without requiring manual configuration reloads."
  },
  {
    id: "k8s-ex-37",
    title: "PrometheusRule Alerting on Microservice HTTP 5xx Error Budgets",
    category: "Observability, Operations & Troubleshooting",
    difficulty: "advanced",
    whatThisCodeCovers: "A production alerting rule defining multi-window burn rate alerts on HTTP 5xx errors and alerting on imminent memory exhaustion.",
    conceptsCovered: ["PrometheusRule", "Alertmanager", "Burn Rate Alerting", "PromQL", "Error Budget"],
    code: `apiVersion: monitoring.coreos.com/v1
kind: PrometheusRule
metadata:
  name: microservice-burn-rate-alerts
  namespace: monitoring
spec:
  groups:
  - name: error-budget.rules
    rules:
    - alert: FastBurnRateCritical
      expr: |
        (
          sum(rate(http_requests_total{status=~"5.*"}[5m]))
          /
          sum(rate(http_requests_total[5m]))
        ) > (14.4 * 0.01) # Burning 14.4x of 1% error budget over 5m
      for: 2m
      labels:
        severity: page
      annotations:
        summary: "Critical Error Budget Burn Rate on {{ $labels.service }}"
        description: "Service is burning 14.4% of its 30-day budget per hour."
    - alert: PodMemorySaturation
      expr: |
        container_memory_working_set_bytes{container!=""}
        /
        container_spec_memory_limit_bytes > 0.90
      for: 5m
      labels:
        severity: warning
      annotations:
        summary: "Pod {{ $labels.pod }} memory usage is above 90%"`,
    breakdown: "Implements Google SRE multi-window burn rate alerting. Pushes actionable alerts to Alertmanager before services completely exhaust their monthly availability budget.",
    expectedOutput: "Alerts trigger only on high-confidence SLO breaches, minimizing pager noise for on-call engineers."
  },
  {
    id: "k8s-ex-38",
    title: "OpenTelemetry Collector DaemonSet Pipeline (OTLP to Tempo/Jaeger)",
    category: "Observability, Operations & Troubleshooting",
    difficulty: "advanced",
    whatThisCodeCovers: "A complete OpenTelemetry Collector configuration running as a node DaemonSet, enriching traces with Kubernetes metadata and exporting via gRPC.",
    conceptsCovered: ["OpenTelemetry Collector", "OTLP gRPC", "k8sattributes processor", "batch processor", "Distributed Tracing"],
    code: `apiVersion: opentelemetry.io/v1alpha1
kind: OpenTelemetryCollector
metadata:
  name: otel-collector-agent
  namespace: monitoring
spec:
  mode: daemonset
  config: |
    receivers:
      otlp:
        protocols:
          grpc:
            endpoint: 0.0.0.0:4317
          http:
            endpoint: 0.0.0.0:4318
    processors:
      batch:
        send_batch_size: 1000
        timeout: 1s
      k8sattributes:
        auth_type: "serviceAccount"
        passthrough: false
        extract:
          metadata:
            - k8s.pod.name
            - k8s.namespace.name
            - k8s.node.name
    exporters:
      otlp/tempo:
        endpoint: tempo.monitoring:4317
        tls:
          insecure: true
    service:
      pipelines:
        traces:
          receivers: [otlp]
          processors: [k8sattributes, batch]
          exporters: [otlp/tempo]`,
    breakdown: "Collects traces from pods on the same node via localhost/hostIP, attaches namespace and pod metadata in-memory, and exports batches to Tempo for visualization.",
    expectedOutput: "Distributed traces automatically tagged with Kubernetes pod and node metadata rendered in Grafana Tempo."
  },
  {
    id: "k8s-ex-39",
    title: "Vector DaemonSet Tailing Host Logs with Metadata Enrichment",
    category: "Observability, Operations & Troubleshooting",
    difficulty: "advanced",
    whatThisCodeCovers: "A high-performance Vector DaemonSet pipeline parsing host container logs from /var/log/pods, stripping ANSI colors, and exporting JSON to Grafana Loki.",
    conceptsCovered: ["Vector", "DaemonSet", "VRL (Vector Remap Language)", "Loki Exporter", "Log Shipping"],
    code: `apiVersion: v1
kind: ConfigMap
metadata:
  name: vector-config
  namespace: logging
data:
  vector.yaml: |
    sources:
      kubernetes_logs:
        type: kubernetes_logs
    transforms:
      parse_logs:
        type: remap
        inputs: ["kubernetes_logs"]
        source: |
          # Parse inner JSON application logs if present
          parsed, err = parse_json(.message)
          if err == null {
            . = merge(., parsed)
          }
          # Strip ANSI color codes
          .message = strip_ansi_escape_codes(.message)
    sinks:
      loki:
        type: loki
        inputs: ["parse_logs"]
        endpoint: http://loki.logging:3100
        encoding:
          codec: json
        labels:
          namespace: "{{ kubernetes.pod_namespace }}"
          app: "{{ kubernetes.pod_labels.app }}"`,
    breakdown: "Rust-based Vector agent consumes negligible CPU while parsing container JSON logs and shipping them into Loki tagged with pod namespace and application labels.",
    expectedOutput: "Zero-loss high-speed container log ingestion into Grafana Loki with structured field search."
  },
  {
    id: "k8s-ex-40",
    title: "Istio VirtualService & DestinationRule with Circuit Breaking",
    category: "Networking & Services",
    difficulty: "advanced",
    whatThisCodeCovers: "An Istio traffic policy establishing a 90/10 canary split and configuring outlier detection circuit breakers to eject failing pods.",
    conceptsCovered: ["VirtualService", "DestinationRule", "Circuit Breaking", "outlierDetection", "Traffic Splitting"],
    code: `apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: order-service-routing
  namespace: production
spec:
  hosts:
  - order-service
  http:
  - route:
    - destination:
        host: order-service
        subset: v1
      weight: 90
    - destination:
        host: order-service
        subset: v2
      weight: 10
---
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: order-service-destrules
  namespace: production
spec:
  host: order-service
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
  trafficPolicy:
    connectionPool:
      tcp:
        maxConnections: 100
      http:
        http1MaxPendingRequests: 50
    outlierDetection:
      consecutive5xxErrors: 3
      interval: 10s
      baseEjectionTime: 30s
      maxEjectionPercent: 50`,
    breakdown: "Splits 10% of traffic to v2 while protecting downstream systems: if an individual pod instance returns three consecutive 5xx errors, Envoy ejects it from the pool for 30 seconds.",
    expectedOutput: "Seamless traffic canary routing with automatic circuit breaking preventing cascading upstream microservice failures."
  }
];
