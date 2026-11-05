// scripts/data_kubernetes/cat06_autoscaling_capacity.cjs
const { card } = require('../k8s_builder_helper.cjs');

const cat = "Autoscaling & Capacity Management";

module.exports = [
  card(
    61,
    cat,
    "Horizontal Pod Autoscaler (HPA v2) Algorithm & Metrics Pipeline",
    "must-know",
    "intermediate",
    "How does the Horizontal Pod Autoscaler (HPA v2) calculate desired replica counts, and what is the exact mathematical scaling formula?",
    "HPA queries the Metrics API periodically (default 15s) and calculates desired replicas using the ratio formula: DesiredReplicas = ceil[ CurrentReplicas * ( CurrentMetricValue / TargetMetricValue ) ].",
    "If a service currently has 4 replicas running at 80% average CPU utilization and the HPA target is 50%, HPA calculates: $\\text{ceil}[ 4 \\times (80 / 50) ] = \\text{ceil}[6.4] = 7$ replicas. HPA v2 supports multiple metrics simultaneously (CPU, memory, custom Prometheus metrics, external cloud metrics). When multiple metrics are configured, HPA calculates the desired replica count for each metric independently and scales to the **highest** computed replica count to ensure capacity safety.",
    `# Production HPA v2 Spec with Scaling Behaviors
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-autoscaler
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-service
  minReplicas: 3
  maxReplicas: 25
  metrics:
  # Target 65% average CPU utilization
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 65
  # Scale quickly up, but scale down gradually to prevent flapping
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300 # Wait 5m before scaling down
      policies:
      - type: Percent
        value: 10 # Scale down at most 10% of pods per minute
        periodSeconds: 60`,
    "HPA calculation formula: ceil[CurrentReplicas * (CurrentMetric / TargetMetric)]. When multiple metrics are defined, HPA always picks the largest computed replica count.",
    ["hpa", "autoscaling", "scaling-formula", "metrics-server", "hpa-v2"]
  ),
  card(
    62,
    cat,
    "Custom & External Metrics in HPA via Prometheus Adapter",
    "must-know",
    "intermediate",
    "How does HPA scale workloads based on business metrics (HTTP requests per second, queue depth) using the Custom Metrics API and Prometheus Adapter?",
    "By default, Metrics Server only exposes raw CPU and memory. The Prometheus Adapter (k8s-prometheus-adapter) queries Prometheus for application metrics (e.g. nginx_http_requests_total) and registers them with the Kubernetes Custom Metrics API (custom.metrics.k8s.io), allowing HPA to scale based on application throughput.",
    "Scaling on CPU is reactive: by the time CPU spikes, incoming HTTP request queues may already be dropping packets. Scaling on business metrics is proactive: an HPA can target \`500 http_requests_per_second\` per pod. If traffic surges from 1,000 to 5,000 req/sec, HPA scales from 2 to 10 pods instantly before CPU utilization even registers a spike.",
    `# HPA Scaling on Custom Metric (HTTP Requests Per Second)
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: web-traffic-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: web-frontend
  minReplicas: 2
  maxReplicas: 50
  metrics:
  - type: Pods
    pods:
      metric:
        name: http_requests_per_second # Provided by Prometheus Adapter!
      target:
        type: AverageValue
        averageValue: "500" # Each pod handles 500 requests/sec`,
    "Scaling on application throughput (RPS) or queue lag is far superior to scaling purely on CPU/memory for web APIs and streaming consumer workloads.",
    ["custom-metrics", "prometheus-adapter", "hpa-scaling", "requests-per-second", "proactive-scaling"]
  ),
  card(
    63,
    cat,
    "Vertical Pod Autoscaler (VPA): Recommender, Updater & Admission Controller",
    "must-know",
    "intermediate",
    "What are the three components of the Vertical Pod Autoscaler (VPA) and how do its execution modes (Off, Initial, Recreate, Auto) dynamically resize pod requests?",
    "VPA optimizes resource allocation by observing real-world CPU/memory usage and adjusting container requests dynamically. It consists of the Recommender (computes optimal requests), Updater (evicts pods to apply new values), and Admission Controller (injects updated requests upon pod recreation).",
    "VPA operating modes: 1) **Off**: Generates resource recommendations in \`status.recommendation\` without modifying running pods (ideal for observing resource requirements without disruption); 2) **Initial**: Applies recommendations only when a pod is first created; never touches running pods; 3) **Auto / Recreate**: Evicts running pods and recreates them with updated CPU/memory requests if actual usage deviates significantly from current values.",
    `# VerticalPodAutoscaler in Recommendation-Only Mode
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: database-vpa
spec:
  targetRef:
    apiVersion: "apps/v1"
    kind: Deployment
    name: my-database
  updatePolicy:
    updateMode: "Off" # Safe mode: Observes & recommends without restarting pods!
  resourcePolicy:
    containerPolicies:
    - containerName: '*'
      minAllowed:
        cpu: "100m"
        memory: "256Mi"
      maxAllowed:
        cpu: "8000m"
        memory: "16Gi"`,
    "Run VPA with 'updateMode: Off' in production to collect accurate recommendations for right-sizing resource requests without pod restart disruptions.",
    ["vpa", "vertical-pod-autoscaler", "right-sizing", "recommender", "resource-optimization"]
  ),
  card(
    64,
    cat,
    "The HPA vs VPA Conflict & Resolution Rules",
    "must-know",
    "intermediate",
    "Why must HPA and VPA never be configured on the same resource metric (CPU/Memory) simultaneously, and how do you combine them safely?",
    "Running HPA and VPA simultaneously on the same metric (e.g. CPU) causes an uncontrollable race condition: HPA scales pod count up to reduce CPU, while VPA scales pod size up; when load drops, both scale down in an infinite thrashing feedback loop.",
    "The golden rule of autoscaling: **Never combine HPA on CPU/memory with VPA on CPU/memory**. Safe combination architectures: 1) Configure HPA to scale on custom/external business metrics (e.g. HTTP requests per second or Kafka queue lag), while configuring VPA to manage vertical CPU/memory requests; 2) Use VPA in \`updateMode: Off\` to observe recommendations, while using HPA to scale horizontally.",
    `// Safe Architecture: Decoupled Multi-Dimensional Autoscaling
// 1. Horizontal Pod Autoscaler:
//    - Metric: External Kafka Consumer Group Lag (or HTTP RPS)
//    - Action: Scales pod replica count from 5 to 50
//
// 2. Vertical Pod Autoscaler:
//    - Metric: Observed CPU / Memory usage
//    - updatePolicy: Off (Generates recommendations for CI/CD updates without racing!)`,
    "Never let HPA and VPA compete on CPU or Memory. Let HPA scale replicas on traffic, and use VPA in 'Off' mode to tune container baseline requests.",
    ["hpa-vs-vpa", "autoscaler-conflict", "thrashing", "feedback-loop", "best-practices"]
  ),
  card(
    65,
    cat,
    "Kubernetes Cluster Autoscaler: Cloud Auto Scaling Group (ASG) Mechanics",
    "must-know",
    "intermediate",
    "How does the legacy Cluster Autoscaler monitor pending pods to trigger cloud Auto Scaling Groups (ASGs), and why does scale-up latency take 2-5 minutes?",
    "Cluster Autoscaler monitors for unschedulable pods in 'Pending' state with scheduling failure predicates. It simulates node placement, calculates how many new nodes are needed, and increases the desired capacity of cloud Auto Scaling Groups (AWS ASG, GCP MIG).",
    "Cluster Autoscaler does not monitor CPU/memory metrics directly; it monitors pod scheduling failures. Scale-up latency takes 2-5 minutes because: 1) It must wait for pod scheduling attempts to fail; 2) It calls cloud APIs to increase ASG size; 3) The cloud provider provisions the VM instance; 4) The node boots its Linux OS, initializes Kubelet, and joins the cluster. When nodes are underutilized (<50% allocated requests) for 10 minutes, Cluster Autoscaler cordons, drains, and terminates the node.",
    `# Cluster Autoscaler Pod Annotations on Critical Workloads
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payment-worker
spec:
  template:
    metadata:
      annotations:
        # PREVENTS Cluster Autoscaler from terminating this node during scale-down!
        cluster-autoscaler.kubernetes.io/safe-to-evict: "false"`,
    "Cluster Autoscaler triggers strictly on 'Pending' unschedulable pods, NOT on high CPU percentage. Scale-up requires minutes for VM provisioning.",
    ["cluster-autoscaler", "asg", "node-provisioning", "scale-up-latency", "safe-to-evict"]
  ),
  card(
    66,
    cat,
    "Karpenter Just-In-Time Node Provisioning vs Cluster Autoscaler",
    "must-know",
    "advanced",
    "How does Karpenter bypass cloud Auto Scaling Groups (ASGs) to provision just-in-time, right-sized EC2 nodes in under 45 seconds?",
    "Karpenter is a modern, high-velocity node autoscaler created by AWS. It bypasses node groups and ASGs entirely, communicating directly with EC2 Fleet APIs to provision optimal instance types (exact CPU, memory, architecture, spot/on-demand) in under 45 seconds.",
    "Unlike Cluster Autoscaler (which scales fixed, pre-defined homogeneous node groups), Karpenter evaluates the pending pod's exact requirements (architecture, zone, GPU, memory requests) and selects the cheapest available instance type from over 600 EC2 configurations. Karpenter launches the instance directly via EC2 Fleet API and boots with optimized Amazon Linux/Bottlerocket AMIs that join the cluster in seconds. Furthermore, Karpenter continuously consolidates underutilized nodes, replacing expensive nodes with cheaper alternatives automatically.",
    `# Karpenter NodePool Spec (Just-In-Time Provisioning)
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: general-compute
spec:
  template:
    spec:
      requirements:
      - key: karpenter.sh/capacity-type
        operator: In
        values: ["spot", "on-demand"] # Prefer cheap Spot, fallback to On-Demand
      - key: kubernetes.io/arch
        operator: In
        values: ["arm64", "amd64"]    # Support Graviton ARM64 for cost savings
      nodeClassRef:
        name: default-ec2-class
  limits:
    cpu: 1000
    memory: 2000Gi
  disruption:
    consolidationPolicy: WhenUnderutilized # Automatically shrinks cluster to save money!
    expireAfter: 720h                     # Rotate nodes every 30 days`,
    "Karpenter provisions nodes in under 45 seconds and continuously bin-packs and consolidates nodes to achieve 30-50% cloud cost reductions.",
    ["karpenter", "just-in-time-nodes", "node-consolidation", "spot-instances", "cost-optimization"]
  ),
  card(
    67,
    cat,
    "KEDA (Kubernetes Event-Driven Autoscaling) Architecture",
    "must-know",
    "intermediate",
    "How does KEDA (Kubernetes Event-Driven Autoscaling) scale microservices from 0 to thousands based on external messaging queues (Kafka, AWS SQS, RabbitMQ)?",
    "KEDA is an operator that acts as a custom metrics server. It monitors external event sources (Kafka consumer lag, SQS message count, Redis stream length) and dynamically scales Kubernetes Deployments and Jobs, supporting true scale-to-zero.",
    "Standard HPA cannot scale down to 0 replicas (minimum is 1), wasting money on idle workers. KEDA introduces two components: the **KEDA Operator** (handles scale 0 to 1 and 1 to 0) and the **Metrics Server** (feeds external metrics to HPA for scaling 1 to N). When an SQS queue is empty, KEDA scales the consumer Deployment to 0 replicas. The moment messages arrive, KEDA scales to 1, and HPA scales horizontally based on queue depth.",
    `# KEDA ScaledObject for AWS SQS Queue
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: sqs-queue-scaler
  namespace: workers
spec:
  scaleTargetRef:
    name: order-consumer-deployment
  minReplicaCount: 0  # SCALE TO ZERO when queue is empty!
  maxReplicaCount: 100
  triggers:
  - type: aws-sqs-queue
    metadata:
      queueURL: "https://sqs.us-east-1.amazonaws.com/12345/orders-queue"
      queueLength: "50" # Scale 1 pod per 50 queued messages
      awsRegion: "us-east-1"
    authenticationRef:
      name: keda-aws-credentials`,
    "Use KEDA to scale event consumers (Kafka, RabbitMQ, SQS) to zero when idle and rapidly scale up when backlogs appear.",
    ["keda", "event-driven-scaling", "scale-to-zero", "kafka-lag", "sqs-autoscaler"]
  ),
  card(
    68,
    cat,
    "Scale-to-Zero Architecture for Serverless & Batch Processing",
    "must-know",
    "intermediate",
    "What architectural patterns enable Scale-to-Zero for HTTP services (Knative Serving) and batch background processors?",
    "Scale-to-zero terminates idle compute instances, spinning them up on demand when incoming HTTP traffic or queue messages arrive. For HTTP, Knative Serving's Activator buffers incoming requests while cold-starting pods; for queues, KEDA activates workers from 0 upon message arrival.",
    "Running 24/7 idle worker pods in development or staging clusters wastes substantial cloud budget. Knative Serving implements HTTP scale-to-zero: when an application scales to 0, Ingress points to the **Knative Activator**. When a request arrives, the Activator holds open the client's TCP socket, triggers pod creation, and proxies the buffered HTTP request once the container is ready (incurring a minor cold-start latency penalty).",
    `# Knative Service with Scale-to-Zero Configuration
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: serverless-api
spec:
  template:
    metadata:
      annotations:
        autoscaling.knative.dev/minScale: "0"          # Scale down to 0 when idle
        autoscaling.knative.dev/scaleToZeroPodRetentionPeriod: "2m" # Wait 2m idle before shutdown
        autoscaling.knative.dev/target: "100"          # Concurrent requests per pod
    spec:
      containers:
      - image: enterprise/report-generator:latest`,
    "Scale-to-zero cuts staging and non-production cluster cloud costs by up to 70% by terminating compute during nights and weekends.",
    ["scale-to-zero", "knative", "serverless", "cold-start", "cost-reduction"]
  ),
  card(
    69,
    cat,
    "Cluster Overprovisioning & Pause Pod Headroom Buffers",
    "must-know",
    "intermediate",
    "How does Cluster Overprovisioning using low-priority 'Pause Pods' eliminate cloud node spin-up latency during traffic spikes?",
    "Cluster Overprovisioning runs dummy, low-priority 'Pause Pods' that consume spare node capacity. When legitimate production pods spike, the scheduler preempts and evicts the pause pods instantly, scheduling production pods in under 1 second while cloud autoscalers provision replacement capacity in the background.",
    "Cloud VM startup takes 2-5 minutes. For flash-sale events, waiting 4 minutes for a new EC2 node causes dropped requests. By running lightweight Pause Pods (running the Google \`pause\` container that consumes zero CPU but requests 4 CPUs and 8GiB RAM) assigned a negative priority (\`priority: -10\`), the cluster maintains a warm capacity headroom buffer. When real traffic arrives, production pods (\`priority: 1000\`) immediately evict the pause pods, landing on warm nodes in 500 milliseconds.",
    `# 1. Negative PriorityClass for Headroom Buffers
apiVersion: scheduling.k8s.io/v1
kind: PriorityClass
metadata:
  name: overprovisioning-buffer
value: -10
globalDefault: false

---
# 2. Dummy Headroom Pause Pod Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cluster-headroom-buffer
spec:
  replicas: 5
  template:
    spec:
      priorityClassName: overprovisioning-buffer
      containers:
      - name: pause
        image: registry.k8s.io/pause:3.9
        resources:
          requests:
            cpu: "2"
            memory: "4Gi"`,
    "Overprovisioning trades a small cloud buffer cost for sub-second pod scheduling speeds during sudden traffic spikes.",
    ["overprovisioning", "headroom-buffer", "pause-pod", "preemption", "fast-scaling"]
  ),
  card(
    70,
    cat,
    "HPA Stabilization Windows & Flapping (Thrashing) Mitigation",
    "must-know",
    "intermediate",
    "What is HPA Flapping (Thrashing) and how do stabilization windows and scale-down policies stabilize autoscaling behavior?",
    "HPA Flapping occurs when replica counts rapidly oscillate between scaling up and scaling down in response to short-lived metric spikes, causing continuous pod churn. HPA stabilization windows evaluate historical metric averages over a configurable lookback period (e.g. 5 minutes) before scaling down.",
    "Without stabilization: a burst of requests hits a service -> HPA scales from 4 to 12 pods. Thirty seconds later, the burst clears -> HPA scales down to 4 pods. A minute later, another burst arrives. This continuous restarting exhausts resources. The \`behavior.scaleDown.stabilizationWindowSeconds: 300\` parameter forces HPA to look back across the past 5 minutes and choose the highest required replica count during that window, ensuring the cluster only scales down after load has remained low continuously.",
    `# HPA Spec with Anti-Flapping Stabilization Windows
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: resilient-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: checkout-service
  minReplicas: 4
  maxReplicas: 30
  behavior:
    # Scale up fast (max 100% replica increase every 15s)
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
      - type: Percent
        value: 100
        periodSeconds: 15
    # Scale down conservatively (wait 5 minutes to confirm traffic has dropped)
    scaleDown:
      stabilizationWindowSeconds: 300 # Anti-flapping window!
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60`,
    "Always set a 300-second stabilization window on scale-down. Fast scale-up ensures performance; slow scale-down prevents thrashing.",
    ["hpa-flapping", "thrashing", "stabilization-window", "scaling-policies", "hpa-tuning"]
  ),
  card(
    71,
    cat,
    "Node Consolidation & Cost Optimization in Karpenter",
    "advanced",
    "advanced",
    "How does Karpenter's Consolidation engine continuously bin-pack workloads, replace underutilized nodes with cheaper alternatives, and eliminate cluster waste?",
    "Karpenter continuously simulates cluster bin-packing. When it detects that pods on an expensive node can fit onto other existing nodes, or that a cheaper instance type can host them, Karpenter cordons, drains, and terminates the old node while provisioning a cheaper replacement.",
    "Unlike Cluster Autoscaler (which only deletes nodes when empty or below 50% utilization for 10 minutes), Karpenter's consolidation engine runs in real-time. If you have 3 pods running on an expensive \`m5.4xlarge\` ($0.76/hr) and load decreases, Karpenter calculates that those 3 pods can run on a compact \`c6g.large\` ($0.068/hr). It launches the smaller node, migrates the pods gracefully honoring PodDisruptionBudgets, and terminates the expensive node, saving over 80% on compute costs automatically.",
    `# Enabling Consolidation in Karpenter NodePool
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: cost-optimized-compute
spec:
  disruption:
    # WhenUnderutilized: Consolidates both empty nodes AND underutilized nodes!
    consolidationPolicy: WhenUnderutilized
    consolidateAfter: 30s
    budgets:
    - nodes: "20%" # Consolidate at most 20% of nodes at any time`,
    "Karpenter consolidation is active bin-packing. It continuously optimizes your cloud instance portfolio without administrative intervention.",
    ["karpenter", "node-consolidation", "bin-packing", "finops", "cloud-cost-optimization"]
  ),
  card(
    72,
    cat,
    "Predictive & Machine Learning Based Autoscaling",
    "advanced",
    "advanced",
    "How does Predictive Autoscaling forecast traffic surges before they occur to provision compute ahead of scheduled or historical demand spikes?",
    "Predictive autoscaling uses time-series forecasting models (ARIMA, Prophet, AWS Predictive Scaling) trained on historical traffic patterns to scale nodes and pods minutes before daily recurring peaks occur, eliminating reactive latency penalties.",
    "Standard reactive autoscaling waits for metrics to spike, forcing users to suffer through degraded latency while pods and nodes boot. For businesses with predictable daily rhythms (e.g. food delivery lunch surges at 11:45 AM, or stock market opening at 9:30 AM), predictive autoscalers analyze past 14-day metrics and schedule capacity scaling to launch at 11:30 AM, ensuring warm compute is already waiting before the first surge request arrives.",
    `# Scheduled Pre-Warming Scaling via KEDA Cron Scaler
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: scheduled-prewarming-scaler
spec:
  scaleTargetRef:
    name: order-service
  triggers:
  # Pre-warm capacity every weekday at 08:30 AM ahead of 09:00 market open!
  - type: cron
    metadata:
      timezone: "America/New_York"
      start: "30 8 * * 1-5"
      end: "00 17 * * 1-5"
      desiredReplicas: "40"`,
    "Combine predictive pre-warming (scheduled scaling) with reactive HPA to guarantee warm capacity ahead of known commercial traffic spikes.",
    ["predictive-autoscaling", "keda-cron", "pre-warming", "proactive-capacity", "traffic-forecasting"]
  )
];
