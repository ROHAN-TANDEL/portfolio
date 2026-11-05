// scripts/data_kubernetes/cat09_packaging_gitops.cjs
const { card } = require('../k8s_builder_helper.cjs');

const cat = "Packaging, GitOps & Progressive Delivery";

module.exports = [
  card(
    97,
    cat,
    "Helm 3 Architecture: Charts, Values, Templates & Release Secrets",
    "must-know",
    "intermediate",
    "How does Helm 3 manage package templating, and how does its architecture differ from Helm 2?",
    "Helm is the de-facto package manager for Kubernetes. Helm 3 eliminated the in-cluster Tiller component (removing security and RBAC escalation risks). Helm 3 renders Go templates client-side against values.yaml, evaluates user overrides, communicates directly with kube-apiserver using the user's kubeconfig permissions, and stores release state inside Kubernetes Secrets in the target namespace.",
    "A chart directory contains `Chart.yaml` (metadata), `values.yaml` (defaults), and `templates/` (manifest templates). When `helm install` runs, Helm compiles YAML using Go text/template syntax, creates a Release record stored as a gzipped Secret (`sh.helm.release.v1.<release-name>.v<revision>`), and submits objects to the API server via 3-way strategic merge patch.",
    `# Chart Directory Structure
# mychart/
#   ├── Chart.yaml          # apiVersion: v2, name, version, appVersion
#   ├── values.yaml         # Default configurable values
#   ├── charts/             # Subcharts and dependencies
#   └── templates/          # Jinja/Go templates
#       ├── _helpers.tpl    # Reusable Go template snippets
#       ├── deployment.yaml
#       └── service.yaml

# Helm CLI Release Management
$ helm upgrade --install payment-svc ./mychart \\
    --namespace finance --create-namespace \\
    --set replicaCount=3 \\
    --values ./environments/production.yaml \\
    --atomic --timeout 5m`,
    "Helm 3 eliminated Tiller, shifting rendering to the client and persisting release revision state securely inside namespace Secrets.",
    ["helm3", "package-manager", "templates", "values-yaml", "release-secrets"]
  ),
  card(
    98,
    cat,
    "Helm Template Helpers (_helpers.tpl), Named Templates & Built-in Objects",
    "intermediate",
    "intermediate",
    "How do named templates and helper functions in `_helpers.tpl` promote DRY manifests in Helm charts?",
    "Helm template helpers (`_helpers.tpl`) define reusable template partials using Go `define` blocks. Combined with built-in objects (`.Values`, `.Release`, `.Chart`, `.Files`, `.Capabilities`), helpers standardize common labeling conventions, truncated resource names (respecting the 63-character DNS label limit), and cross-resource selector schemas.",
    "The pipeline operator (`|`) pipes data through Sprig template functions (such as `quote`, `trunc`, `default`, `nindent`). `nindent` is critical in Helm templating: it prepends newlines and injects precise whitespace indentation to preserve valid YAML indentation across multi-line includes.",
    `{{/* templates/_helpers.tpl */}}
{{- define "myapp.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name .Chart.Name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}

{{/* templates/deployment.yaml */}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "myapp.fullname" . }}
  labels:
    app.kubernetes.io/name: {{ .Chart.Name }}
    app.kubernetes.io/instance: {{ .Release.Name }}
spec:
  template:
    metadata:
      labels:
        app.kubernetes.io/name: {{ .Chart.Name }}
        app.kubernetes.io/instance: {{ .Release.Name }}`,
    "Helpers in _helpers.tpl provide reusable, DNS-safe string truncations and structured label sets using Sprig functions and nindent.",
    ["helm-helpers", "_helpers-tpl", "sprig-functions", "nindent", "named-templates"]
  ),
  card(
    99,
    cat,
    "Helm Lifecycle Hooks (pre-install, post-upgrade, test)",
    "intermediate",
    "intermediate",
    "How do Helm Lifecycle Hooks orchestrate out-of-band operational tasks like database schema migrations?",
    "Helm Lifecycle Hooks allow chart developers to intervene at specific points in a release lifecycle (e.g. running database migrations before application pods upgrade, or executing automated smoke tests after rollout). Hooks are annotated standard Kubernetes resources (commonly Jobs or Pods) executed out-of-band by the Helm engine.",
    "Supported hook phases include `pre-install`, `post-install`, `pre-upgrade`, `post-upgrade`, `pre-delete`, and `test`. The `helm.sh/hook-weight` annotation dictates execution order (lowest weights execute first). `helm.sh/hook-delete-policy: hook-succeeded,before-hook-creation` automatically purges migration Jobs upon completion, avoiding naming collisions on subsequent upgrades.",
    `apiVersion: batch/v1
kind: Job
metadata:
  name: {{ include "myapp.fullname" . }}-db-migrate
  annotations:
    "helm.sh/hook": pre-upgrade,pre-install
    "helm.sh/hook-weight": "-5" # Runs first
    "helm.sh/hook-delete-policy": hook-succeeded,before-hook-creation
spec:
  template:
    spec:
      restartPolicy: Never
      containers:
      - name: db-migrate
        image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
        command: ["npm", "run", "db:migrate"]`,
    "Helm hooks execute annotated auxiliary Jobs at precise lifecycle intervals, ensuring migrations complete before pods roll forward.",
    ["helm-hooks", "lifecycle-hooks", "db-migrations", "pre-upgrade", "hook-weight"]
  ),
  card(
    100,
    cat,
    "Kustomize Architecture: Bases, Overlays & Declarative Patches",
    "must-know",
    "intermediate",
    "How does Kustomize provide template-free configuration customization, and how do Bases and Overlays work?",
    "Unlike Helm, Kustomize does not use parameterized template strings or custom syntax; it operates on pure, valid, lintable Kubernetes YAML. Built directly into `kubectl` (`kubectl apply -k`), Kustomize organizes configurations into reusable **Bases** (common core manifests) and environment-specific **Overlays** (development, staging, production) that apply strategic merge patches and JSON6902 patches.",
    "A `kustomization.yaml` file in an overlay references a base directory and defines overrides: namePrefix, namespace, custom labels, replica counts, configMapGenerators, and image tags. This eliminates configuration duplication while preserving pristine declarative base manifests.",
    `# Directory Tree:
# ├── base/
# │   ├── deployment.yaml
# │   ├── service.yaml
# │   └── kustomization.yaml
# └── overlays/production/
#     ├── kustomization.yaml
#     └── replica-patch.yaml

# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../../base
namespace: production
namePrefix: prod-
images:
- name: my-service
  newTag: v2.4.1
patches:
- path: replica-patch.yaml
  target:
    kind: Deployment
    name: my-service`,
    "Kustomize customizes plain Kubernetes YAML through declarative overlays and strategic merge patches without template engines.",
    ["kustomize", "kubectl-k", "bases-overlays", "strategic-merge-patch", "dry-config"]
  ),
  card(
    101,
    cat,
    "GitOps Core Tenets: Declarative State, Version Controlled & Automated Reconciliation",
    "must-know",
    "intermediate",
    "What are the core tenets of GitOps, and why has it become the gold standard for cloud-native deployment?",
    "GitOps is an operational framework that uses Git repositories as the Single Source of Truth for infrastructure and application state. Codified by the OpenGitOps working group, it mandates four core tenets: 1. Declarative description of system state; 2. Versioned and immutable state stored in Git; 3. Automatically pulled state by in-cluster software agents; 4. Continuous reconciliation ensuring actual state matches desired state.",
    "In traditional CI/CD (Push model), external pipelines have broad cluster admin credentials and push changes imperatively into the cluster. In GitOps (Pull model), an in-cluster agent (ArgoCD or FluxCD) continuously monitors Git. No external pipeline holds cluster credentials; unauthorized manual changes in the cluster (`kubectl edit`) are immediately detected as drift and automatically overwritten.",
    `# Push Model (Legacy CI/CD):
# [Dev] -> [Git] -> [CI Pipeline (Holds Cluster Admin Token)] --(Push)--> [K8s Cluster]
# Vulnerability: Leaked CI token compromises entire cluster.

# GitOps Pull Model (Modern Cloud-Native):
# [Dev] -> [Git Repo (Source of Truth)]
#                ^
#   (Poll/Watch) |  (Pull & Self-Heal)
#                |
# [In-Cluster GitOps Controller (ArgoCD/Flux)] ---> [K8s kube-apiserver]
# Benefit: No incoming firewall ports, no external credentials, auditability via git commits.`,
    "GitOps replaces push pipelines with in-cluster reconciliation engines that pull from Git, closing cluster attack surfaces and halting configuration drift.",
    ["gitops", "opengitops", "declarative", "pull-model", "single-source-of-truth"]
  ),
  card(
    102,
    cat,
    "ArgoCD Architecture: Application CRD, API Server, Repo Server & Application Controller",
    "must-know",
    "advanced",
    "What are the internal architectural components of ArgoCD, and how does the Application controller reconcile state?",
    "ArgoCD is a declarative, GitOps continuous delivery tool for Kubernetes. Its architecture consists of three core daemons: the **Repo Server** (clones Git repos and renders Helm/Kustomize manifests into flat JSON/YAML), the **Application Controller** (compares live cluster state from API server with target state from Repo Server), and the **API Server / UI** (exposes REST/gRPC and Web UI for RBAC, audits, and sync requests).",
    "The fundamental resource is the `Application` CRD. It binds a Git source repository (targetRevision, path) to a destination cluster and namespace. When git updates, the Application Controller calculates differences using 3-way diffs. If `automated.prune: true` and `selfHeal: true` are enabled, ArgoCD automatically prunes deleted objects and overwrites cluster drift within seconds.",
    `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: order-service-prod
  namespace: argocd
spec:
  project: default
  source:
    repoURL: 'https://github.com/myorg/fleet-infra.git'
    targetRevision: main
    path: apps/order-service/overlays/production
  destination:
    server: 'https://kubernetes.default.svc'
    namespace: orders-prod
  syncPolicy:
    automated:
      prune: true     # Deletes resources removed from Git
      selfHeal: true  # Reverts manual kubectl changes back to Git
    syncOptions:
    - CreateNamespace=true`,
    "ArgoCD's Application controller continuously computes 3-way diffs between Git manifests and cluster state, automating sync and self-healing.",
    ["argocd", "application-crd", "repo-server", "application-controller", "gitops-engine"]
  ),
  card(
    103,
    cat,
    "ArgoCD ApplicationSets: Multi-Cluster & Multi-Tenant Generator Automation",
    "advanced",
    "advanced",
    "How do ArgoCD ApplicationSets automate multi-cluster and multi-tenant deployments without manifest duplication?",
    "ApplicationSets extend ArgoCD by introducing an `ApplicationSet` controller that generates multiple ArgoCD `Application` resources dynamically using parameterized **Generators**. Instead of manually crafting 100 Application manifests for 100 clusters or microservices, a single ApplicationSet template automates fleet provisioning.",
    "Supported generators include: **List Generator** (static lists of clusters/environments), **Cluster Generator** (targets all clusters registered in ArgoCD matching label selectors), **Git Generator** (scans directory trees or files in Git repositories), and **Matrix Generator** (computes the Cartesian product of two generators, e.g. deploying every microservice to every regional cluster).",
    `apiVersion: argoproj.io/v1alpha1
kind: ApplicationSet
metadata:
  name: guestbook-fleet
  namespace: argocd
spec:
  generators:
  - matrix:
      generators:
      - clusters:
          selector:
            matchLabels:
              environment: production
      - git:
          repoURL: https://github.com/myorg/fleet-apps.git
          revision: HEAD
          directories:
          - path: apps/*
  template:
    metadata:
      name: '{{path.basename}}-{{name}}'
    spec:
      project: default
      source:
        repoURL: https://github.com/myorg/fleet-apps.git
        targetRevision: HEAD
        path: '{{path}}'
      destination:
        server: '{{server}}'
        namespace: '{{path.basename}}'`,
    "ApplicationSets use matrix, cluster, and git generators to dynamically stamp out hundreds of ArgoCD Applications across global clusters.",
    ["applicationsets", "multi-cluster", "matrix-generator", "fleet-management", "argocd-automation"]
  ),
  card(
    104,
    cat,
    "FluxCD Architecture: Source Controller, Kustomize Controller & Helm Controller",
    "intermediate",
    "advanced",
    "What is FluxCD's microservices architecture, and how do Source, Kustomize, and Helm controllers collaborate?",
    "FluxCD (v2) is built on the GitOps Toolkit—a modular, composable suite of specialized Kubernetes controllers. Unlike ArgoCD's monolithic control plane, Flux decomposes functionality into independent controllers communicating strictly via CRDs: **Source Controller** (fetches artifacts from Git, OCI, S3, Helm repos), **Kustomize Controller** (reconciles plain YAML or Kustomize overlays), and **Helm Controller** (manages Helm releases via HelmRelease CRDs).",
    "Flux's **Notification Controller** handles incoming webhooks from GitHub/GitLab and outbound alerts to Slack/Teams, while the **Image Automation Controller** scans container registries for new image tags, commits the updated version directly back to Git, and triggers automatic GitOps deployment.",
    `# 1. Source definition (polls Git repo)
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: fleet-repo
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/myorg/fleet-manifests
  ref:
    branch: main
---
# 2. Reconcile Kustomization artifact
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: backend-apps
  namespace: flux-system
spec:
  interval: 5m
  targetNamespace: prod
  sourceRef:
    kind: GitRepository
    name: fleet-repo
  path: "./deploy/prod"
  prune: true`,
    "FluxCD employs a composable architecture of specialized micro-controllers (Source, Kustomize, Helm) adhering to the GitOps Toolkit philosophy.",
    ["fluxcd", "gitops-toolkit", "source-controller", "kustomize-controller", "helm-controller"]
  ),
  card(
    105,
    cat,
    "Progressive Delivery with Argo Rollouts: Canary Deployments & Traffic Routing",
    "must-know",
    "advanced",
    "How does Argo Rollouts enable Canary deployments and dynamic traffic splitting using Service Meshes and Ingresses?",
    "Standard Kubernetes Deployments only support basic RollingUpdate strategies, which cannot split fractional traffic (e.g. 5% canary) or pause deployments on error metrics. Argo Rollouts introduces the `Rollout` custom resource (a drop-in replacement for Deployment) supporting automated canary and blue/green progressive delivery with precise traffic shifting via ALB, NGINX Ingress, Istio, or Linkerd.",
    "In a canary strategy, Argo Rollouts defines progressive steps: e.g., set weight to 10%, pause for 30 minutes, promote to 50%, pause, promote to 100%. The Rollout controller dynamically adjusts ingress or service mesh routing weights so exactly 10% of user traffic reaches canary pods without duplicating infrastructure.",
    `apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: payment-service
spec:
  replicas: 10
  strategy:
    canary:
      canaryService: payment-canary-svc
      stableService: payment-stable-svc
      trafficRouting:
        istio:
          virtualService:
            name: payment-vsvc
            routes: ["primary"]
      steps:
      - setWeight: 5
      - pause: { duration: 10m }
      - setWeight: 20
      - pause: { duration: 30m }
      - setWeight: 50
      - pause: { duration: 15m }`,
    "Argo Rollouts provides advanced progressive delivery with step-by-step canary traffic shaping via Istio, NGINX, or cloud load balancers.",
    ["argo-rollouts", "canary-deployment", "progressive-delivery", "traffic-routing", "zero-downtime"]
  ),
  card(
    106,
    cat,
    "Automated Rollout Analysis & Metric Verification (Prometheus / Datadog)",
    "must-know",
    "advanced",
    "How does Argo Rollouts automate canary verification and abort rollbacks using real-time Prometheus queries?",
    "Automated Rollout Analysis continuously evaluates application health during canary progression using `AnalysisTemplate` and `AnalysisRun` CRDs. Rather than relying on human observation, the controller queries Prometheus, Datadog, CloudWatch, or custom Webhooks to assert error rate and latency thresholds. If queries fail, the rollout aborts immediately and rolls back to stable.",
    "An `AnalysisTemplate` defines PromQL queries, success criteria (`result[0] < 0.01`), evaluation intervals, and failure limits. During each canary step, an AnalysisRun executes in background. If HTTP 5xx error rate exceeds 1%, the canary is halted, traffic shifts 100% back to the stable replica set, and an alert is published.",
    `apiVersion: argoproj.io/v1alpha1
kind: AnalysisTemplate
metadata:
  name: http-error-rate-check
spec:
  metrics:
  - name: error-rate
    interval: 1m
    successCondition: result[0] <= 0.01 # Error rate must remain <= 1%
    failureLimit: 2 # Abort rollout after 2 consecutive failures
    provider:
      prometheus:
        address: http://prometheus-k8s.monitoring:9090
        query: |
          sum(rate(http_requests_total{status=~"5.*",app="payment"}[1m]))
          /
          sum(rate(http_requests_total{app="payment"}[1m]))`,
    "AnalysisTemplates query real-time monitoring metrics during canaries, triggering automated instant rollback if error budgets breach.",
    ["analysis-template", "canary-analysis", "prometheus-metrics", "automated-rollback", "error-budget"]
  ),
  card(
    107,
    cat,
    "GitOps Secrets Management: Sealed Secrets vs External Secrets Operator vs SOPS",
    "must-know",
    "advanced",
    "How do organizations securely manage sensitive secrets in public/private Git repositories?",
    "Storing plaintext Kubernetes Secrets in Git breaks security governance. Three major architectures resolve GitOps secrets: 1. **External Secrets Operator (ESO)**: Connects to external vaults (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault) and synchronizes them into native Kubernetes Secrets; 2. **Bitnami Sealed Secrets**: Asymmetrically encrypts secrets client-side via public key (safe to commit to public Git); only the in-cluster controller holds the private decryption key; 3. **Mozilla SOPS**: Encrypts YAML values with KMS keys.",
    "External Secrets Operator has emerged as the modern enterprise favorite because secrets stay centralized in enterprise vaults, rotation is managed by cloud KMS/Vault, and no encrypted secret artifacts clutter Git repositories.",
    `# ExternalSecrets.io (ESO) Pattern
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: stripe-credentials
spec:
  refreshInterval: "1h"
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: stripe-live-secret # Native K8s Secret created automatically
    creationPolicy: Owner
  data:
  - secretKey: api-key
    remoteRef:
      key: prod/stripe
      property: api_key`,
    "External Secrets Operator synchronizes external enterprise vaults into native Secrets, avoiding committing ciphertext blobs to Git.",
    ["gitops-secrets", "external-secrets-operator", "sealed-secrets", "sops", "vault-sync"]
  ),
  card(
    108,
    cat,
    "Declarative Drift Detection & Self-Healing Reconciliation",
    "must-know",
    "intermediate",
    "How do GitOps engines detect out-of-band cluster drift and self-heal the desired state?",
    "Cluster drift occurs when administrators execute imperative commands (`kubectl edit`, `kubectl scale`, `kubectl delete`) directly against cluster resources, bypassing Git. GitOps engines detect drift by comparing the Git commit tree against the live kube-apiserver state, flagging the application as `OutOfSync`.",
    "When **Self-Healing** is active, the controller immediately acts as an enforcement loop: it issues a strategic merge patch or replace call against kube-apiserver to revert live objects back to the Git specification within seconds. If resources were manually deleted, the engine recreates them; if unauthorized pods were created, the pruner purges them.",
    `# ArgoCD SyncPolicy enforcing continuous automated self-healing
spec:
  syncPolicy:
    automated:
      selfHeal: true  # Reverts manual 'kubectl edit' overrides immediately
      prune: true     # Deletes manual rogue resources not in Git
    syncOptions:
    - ApplyOutOfSyncOnly=true # Minimizes API churn
    - PrunePropagationPolicy=foreground`,
    "Automated drift self-healing constantly checks actual state against Git, automatically overwriting unauthorized manual changes in seconds.",
    ["drift-detection", "self-healing", "out-of-sync", "declarative-reconciliation", "immutability"]
  )
];
