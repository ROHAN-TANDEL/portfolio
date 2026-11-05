// scripts/data_kubernetes/cat08_crds_operators.cjs
const { card } = require('../k8s_builder_helper.cjs');

const cat = "Custom Resources & The Operator Pattern";

module.exports = [
  card(
    85,
    cat,
    "Custom Resource Definitions (CRDs) Specification & OpenAPI v3 Schema Validation",
    "must-know",
    "advanced",
    "How do Custom Resource Definitions (CRDs) extend the Kubernetes API with declarative schema validation?",
    "CRDs allow engineers to register new domain-specific REST endpoints on the kube-apiserver without modifying core Kubernetes code. Defined under apiextensions.k8s.io/v1, CRDs utilize OpenAPI v3 JSON schemas to enforce structural validation, type constraints, default values, and required fields before persisted to etcd.",
    "When a CRD is applied, kube-apiserver dynamically creates REST endpoints (e.g. `/apis/database.example.com/v1/namespaces/{ns}/postgresclusters`). OpenAPI v3 schemas prevent invalid states from being saved to etcd. Structural schemas require all fields to have explicit types (`type: object`, `string`, `integer`). Defaulting applies default values during admission if fields are omitted.",
    `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: postgresclusters.database.example.com
spec:
  group: database.example.com
  names:
    plural: postgresclusters
    singular: postgrescluster
    kind: PostgresCluster
    shortNames: ["pgc"]
  scope: Namespaced
  versions:
  - name: v1
    served: true
    storage: true
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            required: ["replicas", "storageGb"]
            properties:
              replicas:
                type: integer
                minimum: 1
                maximum: 9
              storageGb:
                type: integer
                minimum: 10
              version:
                type: string
                default: "15"`,
    "CRDs register new HTTP endpoints dynamically on kube-apiserver, with OpenAPI v3 validation rejecting ill-formed manifests at admission.",
    ["crds", "openapi-v3", "apiextensions", "schema-validation", "extensibility"]
  ),
  card(
    86,
    cat,
    "The Operator Pattern: Level-Triggered Controller Reconciliation Loops",
    "must-know",
    "advanced",
    "What is the Operator Pattern, and how does level-triggered reconciliation differ from edge-triggered event handling?",
    "The Operator Pattern encapsulates human domain knowledge (backup, restore, failover, upgrades) into software by combining Custom Resources with a continuous reconciliation controller. Kubernetes controllers are level-triggered: they react to the current observed state versus desired state rather than transient edge event transitions.",
    "Edge-triggered systems act only on state transitions (e.g., 'event: pod terminated'). If an edge event is dropped during network partitioned downtime, the system stays inconsistent. Level-triggered systems evaluate `Reconcile(Request)`: the controller queries the live world, compares it to the CR spec, and executes idempotent operations until observed state matches desired state. If reconciliations fail, the request is re-queued with exponential backoff.",
    `// Conceptual Go Controller Reconciliation Loop
func (r *PostgresClusterReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    // 1. Fetch current desired state from API Server
    var cluster dbv1.PostgresCluster
    if err := r.Get(ctx, req.NamespacedName, &cluster); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }

    // 2. Observe underlying child resources (StatefulSets, Services)
    var sts appsv1.StatefulSet
    err := r.Get(ctx, req.NamespacedName, &sts)
    if errors.IsNotFound(err) {
        // 3. Act: StatefulSet missing -> Create desired StatefulSet
        newSts := r.buildStatefulSet(&cluster)
        return ctrl.Result{}, r.Create(ctx, newSts)
    }

    // 4. Update Status subresource with observed healthy replica count
    cluster.Status.ReadyReplicas = sts.Status.ReadyReplicas
    return ctrl.Result{}, r.Status().Update(ctx, &cluster)
}`,
    "Operators maintain desired state through idempotent level-triggered loops, continuously correcting state drift regardless of missed events.",
    ["operators", "controller-loop", "reconciliation", "level-triggered", "control-theory"]
  ),
  card(
    87,
    cat,
    "Status Subresources & Optimistic Concurrency Control (ResourceVersion)",
    "advanced",
    "advanced",
    "Why does Kubernetes isolate `/status` subresources in CRDs, and how does ResourceVersion enforce optimistic concurrency control?",
    "Enabling the `/status` subresource separates user-managed specification changes from controller-managed status observation. This prevents reconciliation collisions and allows RBAC to grant status update permissions without granting spec write privileges. ResourceVersion strings guarantee optimistic concurrency control (OCC).",
    "When `/status` is enabled, mutating `/spec` does not increment or alter status fields, and controller updates to `/status` ignore changes to `/spec`. etcd uses `metadata.resourceVersion` to detect concurrent writes. If Controller A and User B read version 100, and User B writes version 101 first, Controller A's write fails with `409 Conflict` (OptimisticLockingError). The controller must re-fetch version 101, re-evaluate, and retry.",
    `# CRD enabling status subresource
apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: backups.storage.example.com
spec:
  group: storage.example.com
  names:
    kind: Backup
    plural: backups
  scope: Namespaced
  versions:
  - name: v1
    served: true
    storage: true
    subresources:
      status: {} # Enables /status subresource endpoint
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
          status:
            type: object
            properties:
              phase:
                type: string
              completedAt:
                type: string
                format: date-time`,
    "Status subresources decouple spec writes from controller updates, while metadata.resourceVersion stops concurrent stomping via 409 Conflicts.",
    ["subresources", "status", "resource-version", "optimistic-concurrency", "etcd-lock"]
  ),
  card(
    88,
    cat,
    "Mutating Admission Webhooks & Sidecar Injection Mechanics",
    "must-know",
    "advanced",
    "How do Mutating Admission Webhooks work, and how do service meshes use them to inject sidecar containers?",
    "Mutating Admission Webhooks are HTTP callbacks invoked by kube-apiserver during API admission before object schema validation and persistence. They evaluate incoming JSON manifests and return JSONPatch (RFC 6902) modifications, allowing automated sidecar injection, security context enforcement, and default label mutation.",
    "When a user submits a Pod, kube-apiserver queries registered `MutatingWebhookConfiguration` webhooks in sequence. If a webhook targeting `pods` has matching namespace selectors, apiserver POSTs an `AdmissionReview` payload to the webhook's TLS endpoint. The webhook inspects annotations (e.g. `sidecar.istio.io/inject: true`) and returns a base64-encoded JSONPatch adding `initContainers`, `containers` (Envoy proxy), and shared volumes.",
    `apiVersion: admissionregistration.k8s.io/v1
kind: MutatingWebhookConfiguration
metadata:
  name: sidecar-injector-webhook
webhooks:
- name: injector.mesh.example.com
  rules:
  - apiGroups: [""]
    apiVersions: ["v1"]
    operations: ["CREATE"]
    resources: ["pods"]
    scope: "Namespaced"
  clientConfig:
    service:
      name: injector-service
      namespace: istio-system
      path: "/mutate-pods"
    caBundle: LS0tLS1CRUdJTi... # Root CA certificate
  admissionReviewVersions: ["v1"]
  sideEffects: None
  timeoutSeconds: 5
  failurePolicy: Fail # Fail blocks pod creation if webhook is unreachable`,
    "Mutating webhooks intercept CREATE/UPDATE admission calls to modify specs via RFC 6902 JSONPatch before objects are stored in etcd.",
    ["mutating-webhooks", "admission-control", "sidecar-injection", "jsonpatch", "service-mesh"]
  ),
  card(
    89,
    cat,
    "Validating Admission Webhooks & Schema Rejection",
    "must-know",
    "advanced",
    "How do Validating Admission Webhooks enforce custom business rules and block non-compliant resources?",
    "Validating Admission Webhooks execute after all mutating webhooks complete. They inspect the fully resolved and mutated object against organization security policies, organizational constraints, and business invariants, returning either `allowed: true` or `allowed: false` with an explicit rejection reason.",
    "Validating webhooks cannot mutate objects; their responsibility is strictly binary admission. Common applications include verifying that container images originate only from private enterprise registries (`registry.myorg.internal/*`), ensuring CPU/memory limits are strictly specified, or disallowing root container execution. If `failurePolicy: Fail` is set, any network timeout or 5xx from the webhook stops the deployment.",
    `apiVersion: admissionregistration.k8s.io/v1
kind: ValidatingWebhookConfiguration
metadata:
  name: strict-policy-enforcer
webhooks:
- name: registry-guard.security.example.com
  rules:
  - apiGroups: [""]
    apiVersions: ["v1"]
    operations: ["CREATE", "UPDATE"]
    resources: ["pods"]
  clientConfig:
    service:
      name: policy-validator
      namespace: security-system
      path: "/validate-pods"
    caBundle: LS0tLS1CRUdJTi...
  admissionReviewVersions: ["v1"]
  sideEffects: None
  failurePolicy: Fail
  matchPolicy: Equivalent`,
    "Validating admission webhooks perform final assertion checks after mutation, rejecting non-compliant manifests with custom status codes.",
    ["validating-webhooks", "admission-review", "policy-enforcement", "security-guardrails"]
  ),
  card(
    90,
    cat,
    "Kubebuilder Architecture & Controller-Runtime Manager / Informers / Workqueues",
    "advanced",
    "advanced",
    "How does the controller-runtime library (Kubebuilder) optimize API server traffic using Managers, Informers, and Workqueues?",
    "The Kubernetes `controller-runtime` framework powers modern Go operators. Rather than repeatedly polling kube-apiserver, it implements an event-driven architecture using Informers, local in-memory Caches (ListerWatcher), DeltaFIFOs, and rate-limited Workqueues to ensure high throughput with minimal API server load.",
    "The **Manager** initializes dependencies, shared caches, and leader election. **Informers** establish long-lived HTTP chunked HTTP/2 WATCH connections with kube-apiserver, caching deserialized objects in RAM. When objects change, Informers push keys (`namespace/name`) into a **RateLimitingQueue**. Reconciler worker goroutines pop keys from the queue and fetch resources directly from the lightning-fast in-memory cache, writing back to apiserver only when mutations are required.",
    `// Kubebuilder / Controller-Runtime Setup
func main() {
    mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
        Scheme: scheme,
        MetricsBindAddress: ":8080",
        LeaderElection: true,
        LeaderElectionID: "my-operator-lock",
    })
    if err != nil { os.Exit(1) }

    // Register Reconciler watching Custom Resource
    if err = (&controllers.AppClusterReconciler{
        Client: mgr.GetClient(), // Reads from Informer Cache, writes to API
        Scheme: mgr.GetScheme(),
    }).SetupWithManager(mgr); err != nil {
        os.Exit(1)
    }

    if err := mgr.Start(ctrl.SetupSignalHandler()); err != nil {
        os.Exit(1)
    }
}`,
    "Informers maintain in-memory read caches via continuous WATCH streams, pushing keys to workqueues so reconcilers avoid polling etcd.",
    ["kubebuilder", "controller-runtime", "informers", "workqueues", "listerwatcher"]
  ),
  card(
    91,
    cat,
    "Operator SDK vs Kubebuilder: Helm vs Ansible vs Go Operators",
    "intermediate",
    "intermediate",
    "How do Operator SDK and Kubebuilder compare, and when should you choose Helm, Ansible, or Go operator runtimes?",
    "Kubebuilder is the underlying Go framework developed by the Kubernetes API Machinery SIG. Red Hat's Operator SDK builds on top of Kubebuilder, adding enterprise lifecycle tooling and supporting three operator implementation runtimes: Helm, Ansible, and Golang.",
    "**Helm Operators**: Lowest barrier to entry. Transforms existing Helm charts into declarative CRDs without writing code. Capability level 1-2 (basic install and seamless config upgrades). **Ansible Operators**: Uses Ansible playbooks/roles; great for sysadmins automating existing playbooks. Level 1-3. **Go Operators (Kubebuilder)**: Maximum control, lowest memory overhead, capable of Level 5 autonomous operations (auto-tuning, automated backups, fault-tolerance, dynamic scaling, multi-phase canary upgrades).",
    `# Operator Capability Matrix
# Level 1: Basic Install (Automated provisioning)
# Level 2: Seamless Upgrades (Patching, minor version bumps)
# Level 3: Full Lifecycle (Backup, disaster recovery, failover)
# Level 4: Deep Insights (Metrics, alerts, log analysis)
# Level 5: Autopilot (Horizontal/vertical auto-tuning, anomaly remediation)

# Initializing a Go Operator with Operator-SDK:
# $ operator-sdk init --domain example.com --repo github.com/myorg/db-operator
# $ operator-sdk create api --group storage --version v1 --kind DatabaseCluster --resource --controller`,
    "Helm and Ansible operators enable rapid automation of existing manifests, whereas Go/Kubebuilder provides Level 5 autopilot operational mastery.",
    ["operator-sdk", "kubebuilder", "helm-operator", "ansible-operator", "capability-model"]
  ),
  card(
    92,
    cat,
    "Leader Election in High-Availability Operators (Coordination Leases)",
    "advanced",
    "advanced",
    "How do multi-replica operators implement High Availability without split-brain reconciliation collisions?",
    "Running multiple replicas of an operator prevents single-point-of-failure downtimes during node drains or crashes. To prevent concurrent replicas from stomping each other's state changes, operators utilize distributed Leader Election backed by the `coordination.k8s.io/v1` Lease API.",
    "All operator replicas attempt to acquire or renew a specific `Lease` object in the control plane. The replica that successfully acquires the Lease becomes the active leader and runs reconciliation loops. Standby replicas periodically poll the Lease. If the active leader fails to renew the Lease within `leaseDurationSeconds` (e.g. 15s) due to crash or network partition, standby replicas race to acquire ownership and seamlessly take over.",
    `apiVersion: coordination.k8s.io/v1
kind: Lease
metadata:
  name: cert-manager-controller
  namespace: kube-system
spec:
  holderIdentity: cert-manager-controller-7f44d9f78-29kq8 # Active Pod
  leaseDurationSeconds: 15
  acquireTime: "2026-11-05T01:10:00.000000Z"
  renewTime: "2026-11-05T01:14:45.120000Z"
  leaseTransitions: 3`,
    "Coordination Leases allow redundant operator replicas to establish active-passive HA, ensuring only one leader reconciles resources at any time.",
    ["leader-election", "coordination-lease", "high-availability", "split-brain", "distributed-locks"]
  ),
  card(
    93,
    cat,
    "CRD Structural Schemas & Conversion Webhooks (v1alpha1 to v1)",
    "advanced",
    "advanced",
    "How does Kubernetes handle API schema evolution across multiple CRD versions using Conversion Webhooks?",
    "When custom resources evolve across lifecycle stages (e.g., from `v1alpha1` to `v1beta1` to `v1`), storage schemas change. Kubernetes CRDs support serving multiple API versions simultaneously while designating exactly one version as the persisted storage version in etcd. Conversion Webhooks handle seamless bidirectional translation between versions.",
    "When a client requests `GET /apis/db.io/v1alpha1/clusters`, if etcd stores `v1`, kube-apiserver makes an HTTP callback to the CRD's conversion webhook. The webhook translates the `v1` representation into `v1alpha1` in-flight and returns it to the client. Similarly, when older clients write `v1alpha1`, the webhook converts it into `v1` before etcd persistence.",
    `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: caches.redis.example.com
spec:
  group: redis.example.com
  conversion:
    strategy: Webhook
    webhook:
      clientConfig:
        service:
          name: redis-conversion-webhook
          namespace: redis-operator
          path: /crdconvert
        caBundle: LS0tLS1CRUd...
      conversionReviewVersions: ["v1"]
  versions:
  - name: v1alpha1
    served: true
    storage: false # Deprecated client format
  - name: v1
    served: true
    storage: true  # Persisted format in etcd`,
    "Conversion webhooks dynamically translate CRDs between multiple API versions on the fly, allowing non-disruptive schema deprecation.",
    ["conversion-webhooks", "api-evolution", "versioning", "crd-storage", "etcd-schema"]
  ),
  card(
    94,
    cat,
    "Finalizers in Custom Controllers: Pre-Delete Cleanup Hooks",
    "must-know",
    "advanced",
    "What are Finalizers, and how do custom controllers use them to safely clean up external resources before deletion?",
    "Finalizers are keys in `metadata.finalizers` that inform Kubernetes that an asynchronous pre-delete cleanup operation must execute before the object is purged from etcd. When a user runs `kubectl delete`, kube-apiserver does not delete the object immediately; it sets `metadata.deletionTimestamp` and blocks removal until all finalizers are removed.",
    "When an operator detects that `deletionTimestamp` is non-nil and its finalizer string (e.g. `storage.example.com/clean-s3-bucket`) is present, it executes external teardown (e.g. dropping cloud databases, unbinding DNS records, deleting cloud S3 buckets). Once cleanup completes successfully, the controller issues a patch removing its finalizer string. When the finalizer list becomes empty, kube-apiserver physically purges the record.",
    `# Object undergoing graceful teardown
apiVersion: storage.example.com/v1
kind: S3Bucket
metadata:
  name: user-uploads
  finalizers:
  - storage.example.com/cleanup-aws-bucket # Blocks deletion
  deletionTimestamp: "2026-11-05T01:15:00Z"
spec:
  bucketName: prod-user-uploads-2026

# Go Controller handling finalizer
// if !bucket.DeletionTimestamp.IsZero() {
//    if controllerutil.ContainsFinalizer(bucket, finalizerName) {
//        cleanAWSBucket(bucket)
//        controllerutil.RemoveFinalizer(bucket, finalizerName)
//        r.Update(ctx, bucket)
//    }
//    return ctrl.Result{}, nil
// }`,
    "Finalizers protect against premature deletion by keeping objects in terminating state until asynchronous teardown logic cleans up dependencies.",
    ["finalizers", "deletion-timestamp", "graceful-cleanup", "resource-lifecycle", "etcd-purge"]
  ),
  card(
    95,
    cat,
    "Custom Resource Rate Limiting & Controller Workqueue Backoff",
    "advanced",
    "advanced",
    "How do Kubernetes controller workqueues prevent cascading failures and API server thundering herds during reconciliation errors?",
    "When a controller encounters transient external errors (database unreachable, AWS API rate limits exceeded), immediately retrying in an infinite loop causes a thundering herd against kube-apiserver and downstream systems. Controller-runtime workqueues mitigate this via exponential backoff rate limiters.",
    "The default controller workqueue combines an `ItemExponentialFailureRateLimiter` (doubling retry delays from e.g. 5ms to 1000s) and an `ItemFastSlowRateLimiter`. If reconciliation returns an error or `Result{Requeue: true}`, the key is re-queued with progressive delays. Once a reconciliation succeeds, `queue.Forget(key)` resets failure counters back to zero.",
    `// Configuring Custom RateLimiting Queue in Controller-Runtime
import "k8s.io/client-go/util/workqueue"

rateLimiter := workqueue.NewMaxOfRateLimiter(
    // 1. Exponential backoff per individual failing item
    workqueue.NewItemExponentialFailureRateLimiter(500*time.Millisecond, 60*time.Second),
    // 2. Global bucket rate limiter across all incoming events
    &workqueue.BucketRateLimiter{
        Limiter: rate.NewLimiter(rate.Limit(10), 100),
    },
)

return ctrl.NewControllerManagedBy(mgr).
    For(&dbv1.DatabaseCluster{}).
    WithOptions(controller.Options{
        RateLimiter: rateLimiter,
        MaxConcurrentReconciles: 5,
    }).
    Complete(r)`,
    "Workqueues protect APIs from storming by backing off failing reconciliations exponentially and resetting retry counters upon success.",
    ["workqueues", "rate-limiting", "exponential-backoff", "resilience", "thundering-herd"]
  ),
  card(
    96,
    cat,
    "Operator Lifecycle Manager (OLM) & CatalogSources",
    "intermediate",
    "advanced",
    "What is the Operator Lifecycle Manager (OLM), and how does it manage operator discovery, dependency resolution, and automated upgrades?",
    "Operator Lifecycle Manager (part of the CNCF Operator Framework) acts as an enterprise package manager for Kubernetes operators. It manages the declarative installation, version upgrades, RBAC generation, and CRD dependency resolution across clusters via four core custom resources: ClusterServiceVersion (CSV), CatalogSource, Subscription, and InstallPlan.",
    "A **CatalogSource** indexes available operator bundles stored in container registries. A **Subscription** declares an intent to track an operator channel (e.g. `stable-v2`). When the CatalogSource receives an updated operator version, OLM generates an **InstallPlan**, verifies CRD compatibility without breaking existing workloads, and automates rolling upgrades according to the specified approval strategy (`Automatic` vs `Manual`).",
    `apiVersion: operators.coreos.com/v1alpha1
kind: Subscription
metadata:
  name: prometheus-operator-subscription
  namespace: monitoring
spec:
  channel: beta
  name: prometheus
  source: operatorhub-catalog
  sourceNamespace: olm
  installPlanApproval: Automatic # Auto-upgrade upon upstream release`,
    "OLM automates the enterprise lifecycle of operators, providing dependency resolution, catalog channels, and automated rolling upgrades.",
    ["olm", "operator-lifecycle-manager", "csv", "operator-hub", "catalogsource"]
  )
];
