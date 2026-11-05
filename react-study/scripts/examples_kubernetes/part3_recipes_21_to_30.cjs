// scripts/examples_kubernetes/part3_recipes_21_to_30.cjs
module.exports = [
  {
    id: "k8s-ex-21",
    title: "Karpenter NodePool & EC2NodeClass for Automated Spot Provisioning",
    category: "Autoscaling & Capacity Planning",
    difficulty: "advanced",
    whatThisCodeCovers: "A modern Karpenter v1 (karpenter.sh/v1) NodePool and EC2NodeClass definition automating fast, group-less node provisioning with Spot-to-OnDemand fallback.",
    conceptsCovered: ["Karpenter", "NodePool", "EC2NodeClass", "Spot Instances", "ConsolidationPolicy"],
    code: `apiVersion: karpenter.sh/v1
kind: NodePool
metadata:
  name: general-compute-pool
spec:
  template:
    spec:
      requirements:
      - key: kubernetes.io/arch
        operator: In
        values: ["amd64", "arm64"]
      - key: karpenter.sh/capacity-type
        operator: In
        values: ["spot", "on-demand"] # Prefer spot, fallback to on-demand
      - key: node.kubernetes.io/instance-type
        operator: In
        values: ["m6i.large", "m6i.xlarge", "m6g.large", "c6i.xlarge"]
      nodeClassRef:
        group: karpenter.k8s.aws
        kind: EC2NodeClass
        name: default-ec2-class
  disruption:
    consolidationPolicy: WhenUnderutilized # Automatically bin-pack and consolidate nodes
    consolidateAfter: 30s
---
apiVersion: karpenter.k8s.aws/v1
kind: EC2NodeClass
metadata:
  name: default-ec2-class
spec:
  amiFamily: AL2023
  role: "KarpenterNodeRole-Cluster"
  subnetSelectorTerms:
  - tags:
      karpenter.sh/discovery: "production-cluster"
  securityGroupSelectorTerms:
  - tags:
      karpenter.sh/discovery: "production-cluster"`,
    breakdown: "Replaces traditional slow Auto-Scaling Groups. Karpenter provisions optimal ARM/x86 spot instances in under 45 seconds when unschedulable pods appear, and packs workloads to consolidate underutilized nodes.",
    expectedOutput: "Rapid compute elasticity with automated cost optimization, launching instances dynamically in response to pending pods."
  },
  {
    id: "k8s-ex-22",
    title: "Vertical Pod Autoscaler (VPA) with Recommendation & Auto Modes",
    category: "Autoscaling & Capacity Planning",
    difficulty: "intermediate",
    whatThisCodeCovers: "A Vertical Pod Autoscaler manifest configured to observe historical memory/CPU usage and dynamically right-size container requests without exceeding limits.",
    conceptsCovered: ["VerticalPodAutoscaler", "updateMode: Auto", "targetRef", "minAllowed", "maxAllowed"],
    code: `apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: worker-vpa-autoscaler
  namespace: batch
spec:
  targetRef:
    apiVersion: "apps/v1"
    kind:       Deployment
    name:       batch-processor
  updatePolicy:
    updateMode: "Auto" # Dynamically mutates container CPU & RAM requests
  resourcePolicy:
    containerPolicies:
    - containerName: "processor"
      minAllowed:
        cpu: "100m"
        memory: "256Mi"
      maxAllowed:
        cpu: "4000m"
        memory: "8Gi"
      controlledResources: ["cpu", "memory"]`,
    breakdown: "The VPA recommender computes 95th-percentile utilization profiles. Under 'Auto' mode, it evicts or resizes the pod in-place with optimal request boundaries bounded by minAllowed and maxAllowed.",
    expectedOutput: "Batch processor containers right-sized automatically to actual production memory and CPU profiles."
  },
  {
    id: "k8s-ex-23",
    title: "Kustomize Base & Production Overlay with Strategic Merge Patches",
    category: "Packaging, GitOps & Progressive Delivery",
    difficulty: "intermediate",
    whatThisCodeCovers: "A clean Kustomize configuration structure showing an environment-agnostic base overlaid by a production customization with replica scaling and image tag pins.",
    conceptsCovered: ["Kustomize", "bases and overlays", "kustomization.yaml", "strategic merge patch", "images override"],
    code: `# base/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- deployment.yaml
- service.yaml

---
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../../base
namespace: production
namePrefix: prod-
commonLabels:
  environment: production
images:
- name: payment-api
  newName: registry.example.com/payment-api
  newTag: v3.1.2
patches:
- patch: |-
    apiVersion: apps/v1
    kind: Deployment
    metadata:
      name: payment-api
    spec:
      replicas: 10
      template:
        spec:
          containers:
          - name: payment-api
            resources:
              requests:
                cpu: 1000m
                memory: 2Gi`,
    breakdown: "Avoids template engines by composing pure Kubernetes YAML. Overlays inherit base definitions while applying atomic overrides for production replica counts, image tags, and namespace prefixes.",
    expectedOutput: "Generated production deployment renamed to 'prod-payment-api' with 10 replicas and v3.1.2 image tag."
  },
  {
    id: "k8s-ex-24",
    title: "Production Helm 3 Chart with _helpers.tpl & ServiceMonitor",
    category: "Packaging, GitOps & Progressive Delivery",
    difficulty: "advanced",
    whatThisCodeCovers: "A production Helm 3 chart template integrating _helpers.tpl naming partials, Sprig template helpers, values defaults, and a Prometheus ServiceMonitor.",
    conceptsCovered: ["Helm 3", "_helpers.tpl", "include", "nindent", "ServiceMonitor template"],
    code: `{{/* templates/_helpers.tpl */}}
{{- define "webapp.fullname" -}}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" -}}
{{- end }}

---
{{/* templates/servicemonitor.yaml */}}
{{- if .Values.metrics.enabled }}
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: {{ include "webapp.fullname" . }}
  namespace: {{ .Release.Namespace }}
  labels:
    app.kubernetes.io/name: {{ .Chart.Name }}
    release: {{ .Values.metrics.prometheusRelease }}
spec:
  selector:
    matchLabels:
      app.kubernetes.io/name: {{ .Chart.Name }}
      app.kubernetes.io/instance: {{ .Release.Name }}
  endpoints:
  - port: metrics
    path: /metrics
    interval: {{ .Values.metrics.interval | default "15s" }}
{{- end }}`,
    breakdown: "Generates standard Kubernetes labels and resource names respecting 63-character RFC 1123 limits, optionally creating Prometheus scrape targets based on .Values.metrics.enabled.",
    expectedOutput: "Deployable Helm chart that safely conforms to enterprise labeling and observability standards."
  },
  {
    id: "k8s-ex-25",
    title: "Custom Resource Definition (CRD) with OpenAPI v3 Validation & Status",
    category: "Custom Resources & The Operator Pattern",
    difficulty: "advanced",
    whatThisCodeCovers: "A declarative CustomResourceDefinition (CRD) registering a custom DatabaseCluster resource with strict OpenAPI v3 JSONSchema validation and status subresource.",
    conceptsCovered: ["CRD", "OpenAPI v3 Validation", "subresources: status", "additionalPrinterColumns", "apiextensions/v1"],
    code: `apiVersion: apiextensions.k8s.io/v1
kind: CustomResourceDefinition
metadata:
  name: databaseclusters.storage.company.com
spec:
  group: storage.company.com
  names:
    plural: databaseclusters
    singular: databasecluster
    kind: DatabaseCluster
    shortNames: ["dbc"]
  scope: Namespaced
  versions:
  - name: v1alpha1
    served: true
    storage: true
    subresources:
      status: {} # Decouples /status updates from spec
    additionalPrinterColumns:
    - name: Engine
      type: string
      jsonPath: .spec.engine
    - name: Replicas
      type: integer
      jsonPath: .spec.replicas
    - name: Phase
      type: string
      jsonPath: .status.phase
    schema:
      openAPIV3Schema:
        type: object
        properties:
          spec:
            type: object
            required: ["engine", "replicas", "storageSize"]
            properties:
              engine:
                type: string
                enum: ["postgres", "mysql", "redis"]
              replicas:
                type: integer
                minimum: 1
                maximum: 7
              storageSize:
                type: string
                pattern: '^[0-9]+(Gi|Ti)$'
          status:
            type: object
            properties:
              phase:
                type: string
              readyReplicas:
                type: integer`,
    breakdown: "Registers a new REST endpoint on kube-apiserver with native validation, ensuring invalid configurations (like replicas: 12 or invalid storage strings) are rejected before saving to etcd.",
    expectedOutput: "'kubectl get dbc' displays custom columns (Engine, Replicas, Phase) and enforces type validation."
  },
  {
    id: "k8s-ex-26",
    title: "Go Kubernetes Controller Reconciliation Loop (Kubebuilder)",
    category: "Custom Resources & The Operator Pattern",
    difficulty: "advanced",
    whatThisCodeCovers: "A production Go reconciler function using controller-runtime to manage child StatefulSets and update status subresources idempotently.",
    conceptsCovered: ["controller-runtime", "Reconcile()", "ctrl.Request", "client.IgnoreNotFound", "Status().Update()"],
    code: `// controllers/databasecluster_controller.go
package controllers

import (
    "context"
    "time"
    appsv1 "k8s.io/api/apps/v1"
    "k8s.io/apimachinery/pkg/api/errors"
    "k8s.io/apimachinery/pkg/runtime"
    ctrl "sigs.k8s.io/controller-runtime"
    "sigs.k8s.io/controller-runtime/pkg/client"
    storagev1 "company.com/api/v1alpha1"
)

type DatabaseClusterReconciler struct {
    client.Client
    Scheme *runtime.Scheme
}

func (r *DatabaseClusterReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    // 1. Fetch CR from in-memory cache
    var cluster storagev1.DatabaseCluster
    if err := r.Get(ctx, req.NamespacedName, &cluster); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }

    // 2. Query child StatefulSet
    var sts appsv1.StatefulSet
    err := r.Get(ctx, req.NamespacedName, &sts)
    if errors.IsNotFound(err) {
        // Child missing -> Create child StatefulSet
        newSts := r.buildDesiredStatefulSet(&cluster)
        if err := r.Create(ctx, newSts); err != nil {
            return ctrl.Result{}, err
        }
        return ctrl.Result{RequeueAfter: 5 * time.Second}, nil
    }

    // 3. Update Status Subresource
    cluster.Status.ReadyReplicas = sts.Status.ReadyReplicas
    cluster.Status.Phase = "Running"
    if err := r.Status().Update(ctx, &cluster); err != nil {
        return ctrl.Result{}, err
    }

    return ctrl.Result{RequeueAfter: 10 * time.Minute}, nil
}`,
    breakdown: "Implements idempotent level-triggered reconciliation: fetches from local memory cache, asserts child resource existence, provisions missing dependencies, and updates the status subresource.",
    expectedOutput: "A high-performance Go operator reconciling desired state with live Kubernetes resources without polling etcd."
  },
  {
    id: "k8s-ex-27",
    title: "Mutating Admission Webhook with Dynamic Sidecar Injection",
    category: "Custom Resources & The Operator Pattern",
    difficulty: "advanced",
    whatThisCodeCovers: "A Go Mutating Webhook handler intercepting pod admission requests to inject a logging sidecar container and shared emptyDir volume via RFC 6902 JSONPatch.",
    conceptsCovered: ["Mutating Webhook", "AdmissionReview", "JSONPatch", "admission/v1", "Sidecar Injection"],
    code: `// webhook/mutate_pod.go
package webhook

import (
    "context"
    "encoding/json"
    "net/http"
    corev1 "k8s.io/api/core/v1"
    "sigs.k8s.io/controller-runtime/pkg/webhook/admission"
)

type PodSidecarInjector struct {
    decoder *admission.Decoder
}

func (a *PodSidecarInjector) Handle(ctx context.Context, req admission.Request) admission.Response {
    pod := &corev1.Pod{}
    if err := a.decoder.Decode(req, pod); err != nil {
        return admission.Errored(http.StatusBadRequest, err)
    }

    // Check if pod has opt-in annotation
    if pod.Annotations["company.com/inject-sidecar"] != "true" {
        return admission.Allowed("Injection not requested")
    }

    // Inject sidecar container into pod spec
    sidecar := corev1.Container{
        Name:  "telemetry-agent",
        Image: "registry.example.com/telemetry:v1.0",
        Resources: corev1.ResourceRequirements{/* ... */},
    }
    pod.Spec.Containers = append(pod.Spec.Containers, sidecar)

    // Return JSONPatch modifying the pod spec before etcd persistence
    marshaledPod, _ := json.Marshal(pod)
    return admission.PatchResponseFromRaw(req.Object.Raw, marshaledPod)
}`,
    breakdown: "Intercepts CREATE Pod requests, checks annotations, and dynamically produces a JSONPatch adding containers before the pod object is committed to etcd.",
    expectedOutput: "Annotated pods automatically launch with the telemetry-agent sidecar injected into their container list."
  },
  {
    id: "k8s-ex-28",
    title: "Validating Admission Webhook Enforcing Image Registry Whitelist",
    category: "Custom Resources & The Operator Pattern",
    difficulty: "advanced",
    whatThisCodeCovers: "A Validating Webhook handler that inspects container image URLs and rejects deployments using untrusted external public registries.",
    conceptsCovered: ["Validating Webhook", "AdmissionResponse", "Security Guardrail", "Registry Whitelist"],
    code: `// webhook/validate_registry.go
package webhook

import (
    "context"
    "fmt"
    "strings"
    corev1 "k8s.io/api/core/v1"
    "sigs.k8s.io/controller-runtime/pkg/webhook/admission"
)

const AllowedRegistry = "registry.company.internal/"

type RegistryValidator struct {
    decoder *admission.Decoder
}

func (v *RegistryValidator) Handle(ctx context.Context, req admission.Request) admission.Response {
    pod := &corev1.Pod{}
    if err := v.decoder.Decode(req, pod); err != nil {
        return admission.Errored(400, err)
    }

    // Assert all containers use the enterprise internal registry
    for _, container := range pod.Spec.Containers {
        if !strings.HasPrefix(container.Image, AllowedRegistry) {
            return admission.Denied(fmt.Sprintf(
                "Image '%s' rejected. Only images from '%s' are permitted.",
                container.Image, AllowedRegistry,
            ))
        }
    }

    return admission.Allowed("All container images verified")
}`,
    breakdown: "Enforces supply-chain security at admission. Any container referencing docker.io, quay.io, or untrusted external registries is immediately rejected with HTTP 403 Forbidden.",
    expectedOutput: "Deployments referencing public images are blocked with clear admission denial error messages."
  },
  {
    id: "k8s-ex-29",
    title: "Controller Finalizer Pattern: Pre-Delete Cloud Resource Cleanup",
    category: "Custom Resources & The Operator Pattern",
    difficulty: "advanced",
    whatThisCodeCovers: "A Go controller implementation of Kubernetes Finalizers, ensuring external cloud S3 buckets and DNS records are purged before Custom Resources are deleted.",
    conceptsCovered: ["Finalizers", "controllerutil.AddFinalizer", "controllerutil.RemoveFinalizer", "deletionTimestamp"],
    code: `// controllers/s3bucket_controller.go
package controllers

import (
    "context"
    ctrl "sigs.k8s.io/controller-runtime"
    "sigs.k8s.io/controller-runtime/pkg/controller/controllerutil"
    storagev1 "company.com/api/v1alpha1"
)

const bucketFinalizer = "storage.company.com/cleanup-aws-bucket"

func (r *S3BucketReconciler) Reconcile(ctx context.Context, req ctrl.Request) (ctrl.Result, error) {
    var bucket storagev1.S3Bucket
    if err := r.Get(ctx, req.NamespacedName, &bucket); err != nil {
        return ctrl.Result{}, client.IgnoreNotFound(err)
    }

    // Scenario A: Object is being deleted
    if !bucket.ObjectMeta.DeletionTimestamp.IsZero() {
        if controllerutil.ContainsFinalizer(&bucket, bucketFinalizer) {
            // Run asynchronous external teardown
            if err := r.deleteAWSCloudBucket(bucket.Spec.BucketName); err != nil {
                return ctrl.Result{}, err // Retry until external teardown succeeds
            }
            // Remove finalizer to allow etcd to purge the object
            controllerutil.RemoveFinalizer(&bucket, bucketFinalizer)
            return ctrl.Result{}, r.Update(ctx, &bucket)
        }
        return ctrl.Result{}, nil
    }

    // Scenario B: Object is active -> Ensure finalizer is registered
    if !controllerutil.ContainsFinalizer(&bucket, bucketFinalizer) {
        controllerutil.AddFinalizer(&bucket, bucketFinalizer)
        return ctrl.Result{}, r.Update(ctx, &bucket)
    }

    return ctrl.Result{}, nil
}`,
    breakdown: "Adds a finalizer on creation. When deletion is requested, the controller blocks removal, executes cloud AWS teardown, and removes the finalizer only upon confirmed completion.",
    expectedOutput: "Zero orphaned cloud resources when Kubernetes custom resources are deleted."
  },
  {
    id: "k8s-ex-30",
    title: "HA Operator Leader Election using Coordination Leases",
    category: "Custom Resources & The Operator Pattern",
    difficulty: "advanced",
    whatThisCodeCovers: "Leader election initialization in controller-runtime using coordination.k8s.io/v1 Leases to enable active-passive multi-replica operator deployment.",
    conceptsCovered: ["Leader Election", "coordination.k8s.io", "Lease", "LeaderElectionID", "High Availability"],
    code: `// main.go
package main

import (
    "os"
    "time"
    ctrl "sigs.k8s.io/controller-runtime"
    "sigs.k8s.io/controller-runtime/pkg/log/zap"
)

func main() {
    ctrl.SetLogger(zap.New(zap.UseDevMode(true)))

    mgr, err := ctrl.NewManager(ctrl.GetConfigOrDie(), ctrl.Options{
        Scheme:                 scheme,
        MetricsBindAddress:     ":8080",
        LeaderElection:         true, // Enable distributed HA leader lock
        LeaderElectionID:       "payment-operator-leader-lock",
        LeaderElectionNamespace: "operators",
        LeaseDuration:          func() *time.Duration { d := 15 * time.Second; return &d }(),
        RenewDeadline:          func() *time.Duration { d := 10 * time.Second; return &d }(),
        RetryPeriod:            func() *time.Duration { d := 2 * time.Second; return &d }(),
    })
    if err != nil {
        os.Exit(1)
    }

    if err := mgr.Start(ctrl.SetupSignalHandler()); err != nil {
        os.Exit(1)
    }
}`,
    breakdown: "Configures distributed coordination Leases. The replica acquiring the lock reconciles custom resources; standby replicas poll the Lease and take over instantly if the active leader crashes.",
    expectedOutput: "Multiple operator replicas run safely in parallel without split-brain reconciliation collisions."
  }
];
