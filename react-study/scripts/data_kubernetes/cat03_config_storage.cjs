// scripts/data_kubernetes/cat03_config_storage.cjs
const { card } = require('../k8s_builder_helper.cjs');

const cat = "Configuration, Secrets & Persistent Storage";

module.exports = [
  card(
    25,
    cat,
    "ConfigMaps vs Secrets & Volume Hot Reloading",
    "must-know",
    "intermediate",
    "How do ConfigMaps and Secrets inject configuration into pods, and why do volume mounts update automatically while environment variables remain stale?",
    "ConfigMaps store non-confidential configuration; Secrets store sensitive base64-encoded credentials. When mounted as volumes, Kubelet continuously updates the filesystem symlink when the ConfigMap changes (hot reloading); when injected as environment variables (env/envFrom), values are set at container start and never update without restarting the pod.",
    "When a ConfigMap is mounted as a volume (\`volumeMounts\`), Kubelet uses atomic symlink swapping: it writes new data into a timestamped hidden directory (\`..data_tmp\`) and updates the \`..data\` symlink atomically. Applications that watch the filesystem (e.g. Nginx, Prometheus) can reload configuration without restarting. However, environment variables are copied into the Linux process's environment table at \`execve()\` time; the Linux kernel does not support updating a running process's environment variables from the outside.",
    `# ConfigMap Volume Mount with Automatic Hot Reload
apiVersion: v1
kind: Pod
metadata:
  name: nginx-proxy
spec:
  containers:
  - name: nginx
    image: nginx
    volumeMounts:
    - name: config-volume
      mountPath: /etc/nginx/conf.d # Mounted directory updates automatically on ConfigMap changes!
  volumes:
  - name: config-volume
    configMap:
      name: nginx-config`,
    "If your application can hot-reload config on file change, use volume mounts. If you use environment variables, you must restart pods (e.g. via rollout restart) to apply changes.",
    ["configmaps", "secrets", "hot-reloading", "volume-mounts", "symlink-swapping"]
  ),
  card(
    26,
    cat,
    "Secrets Encryption at Rest in etcd with KMS",
    "must-know",
    "advanced",
    "Why are default Kubernetes Secrets fundamentally insecure in etcd and how does the KMS Encryption Provider implement envelope encryption at rest?",
    "By default, Kubernetes Secrets are stored in plaintext (Base64-encoded, not encrypted) in etcd. An operator, backup tool, or attacker with read access to etcd or its disk backups can dump all secrets. The KMS Encryption Provider uses envelope encryption to encrypt secrets with a Data Encryption Key (DEK) protected by cloud KMS (AWS KMS, Vault) before writing to etcd.",
    "Enabling encryption at rest requires creating an \`EncryptionConfiguration\` YAML and passing \`--encryption-provider-config\` to kube-apiserver. In KMS v2 provider mode: 1) Kube-apiserver calls the KMS plugin via gRPC Unix socket; 2) The KMS plugin encrypts the local DEK using the remote cloud master key; 3) Only ciphertext bytes are written to etcd. Even if an attacker steals an etcd snapshot, all secrets remain unreadable AES-GCM ciphertext.",
    `# /etc/kubernetes/encryption-config.yaml
apiVersion: apiserver.config.k8s.io/v1
kind: EncryptionConfiguration
resources:
  - resources:
      - secrets # Encrypt secrets
    providers:
      # KMS v2 Provider: Integrates with AWS KMS or HashiCorp Vault
      - kms:
          apiVersion: v2
          name: aws-kms-provider
          endpoint: unix:///run/kmsplugin/socket.sock
      # Fallback provider to read unencrypted secrets during migration
      - identity: {}`,
    "Base64 is an encoding, NOT encryption. Without an active EncryptionConfiguration, any etcd backup exposes 100% of your cluster secrets in cleartext.",
    ["secrets-encryption", "etcd-encryption", "kms-v2", "envelope-encryption", "security-compliance"]
  ),
  card(
    27,
    cat,
    "External Secrets Operator (ESO) & Vault Synchronization",
    "must-know",
    "intermediate",
    "How does the External Secrets Operator (ESO) decouple secret storage from Kubernetes and securely synchronize credentials from AWS Secrets Manager / HashiCorp Vault?",
    "External Secrets Operator (ESO) is a Kubernetes operator that continuously polls external enterprise secret managers (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault) and automatically generates and synchronizes native Kubernetes Secret objects.",
    "Hardcoding secrets in Git (even in private repos) violates compliance standards. ESO introduces two CRDs: \`SecretStore\` (configures connection and authentication to Vault/AWS via IRSA/Workload Identity) and \`ExternalSecret\` (specifies which remote keys to fetch and how frequently to refresh). ESO reads secrets into memory and creates/updates standard Kubernetes Secrets. When a secret is rotated in AWS Secrets Manager, ESO updates the Kubernetes Secret within minutes without human intervention.",
    `# ExternalSecrets Custom Resource syncing from AWS Secrets Manager
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-credentials
  namespace: production
spec:
  refreshInterval: "1h" # Polls AWS for rotated secrets every hour
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: app-db-secret # Target native Kubernetes Secret created in cluster
    creationPolicy: Owner
  data:
  - secretKey: DB_PASSWORD
    remoteRef:
      key: production/rds/master
      property: password`,
    "Never commit static Secrets to Git. Store them in AWS Secrets Manager or Vault, and sync them into Kubernetes using External Secrets Operator.",
    ["external-secrets", "eso", "vault", "aws-secrets-manager", "gitops-secrets"]
  ),
  card(
    28,
    cat,
    "Container Storage Interface (CSI) Architecture",
    "must-know",
    "advanced",
    "What is the CSI (Container Storage Interface) specification and how do Controller Plugins vs Node Plugins orchestrate cloud storage volumes?",
    "CSI is a vendor-neutral specification that decouples storage plugins from the Kubernetes core binary. It splits storage management into Controller Plugins (running centrally in the control plane to create/attach cloud volumes) and Node Plugins (running on each worker node to format and mount devices).",
    "Prior to CSI, storage drivers (AWS EBS, Ceph) were compiled directly inside the Kubernetes binary ('in-tree'), meaning bugs in storage drivers could crash Kubelet. CSI drivers run out-of-tree as standard pods: 1) **CSI Controller**: Watches PVCs; calls cloud APIs (\`CreateVolume\` on AWS EBS; \`AttachVolume\` to attach virtual disk to EC2); 2) **CSI Node (DaemonSet)**: Runs on the specific node; calls \`NodeStageVolume\` (formats device with ext4/xfs) and \`NodePublishVolume\` (bind-mounts device into container directory).",
    `// CSI RPC Call Flow during Pod Startup:
// 1. PVC Created -> CSI Controller: CreateVolume() -> Creates AWS EBS Volume
// 2. Pod Scheduled on Node-01 -> CSI Controller: ControllerPublishVolume() -> Attaches EBS to EC2 Node-01
// 3. Kubelet on Node-01 -> CSI Node Plugin: NodeStageVolume() -> Formats disk (mkfs.ext4)
// 4. Kubelet on Node-01 -> CSI Node Plugin: NodePublishVolume() -> Mounts disk to /var/lib/kubelet/pods/...
// 5. Container Starts -> Container rootfs mounts volume at target path!`,
    "CSI Controller handles cloud API actions (Create/Attach/Delete). CSI Node handles local OS actions (Format/Mount/Unmount).",
    ["csi", "storage-driver", "ebs-csi", "volume-attachment", "storage-architecture"]
  ),
  card(
    29,
    cat,
    "PersistentVolumes (PV) vs PersistentVolumeClaims (PVC) Lifecycle",
    "must-know",
    "intermediate",
    "What is the abstraction difference between a PersistentVolume (PV) and a PersistentVolumeClaim (PVC), and what are the reclaim policies (Retain, Delete, Recycle)?",
    "A PersistentVolume (PV) is an actual storage resource in the cluster provisioned by an administrator or dynamically by a StorageClass. A PersistentVolumeClaim (PVC) is a request for storage by a user specifying size and access modes. Reclaim policies dictate what happens to the underlying cloud storage when a PVC is deleted.",
    "PVs represent physical infrastructure (e.g. a 500GB AWS gp3 disk); PVCs represent consumer requests ('I need 100GB ReadWriteOnce'). When a user creates a PVC, the control plane binds it 1:1 to a matching PV. Reclaim policies: 1) **Delete** (default): Deleting the PVC automatically deletes the PV and permanently deletes the underlying cloud storage disk; 2) **Retain**: Deleting the PVC leaves the PV and the underlying cloud disk intact in a 'Released' state, preventing data loss until an administrator manually recovers data; 3) **Recycle** (deprecated): Performs basic \`rm -rf\` on the volume.",
    `# PVC requesting 50Gi from gp3 StorageClass
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: mysql-data-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: gp3
  resources:
    requests:
      storage: 50Gi`,
    "In production databases, set PersistentVolume reclaimPolicy to 'Retain' to ensure accidental deletion of a PVC or namespace does not destroy the underlying cloud disk.",
    ["pv", "pvc", "reclaim-policy", "persistent-storage", "storage-lifecycle"]
  ),
  card(
    30,
    cat,
    "StorageClasses & Dynamic Volume Provisioning",
    "must-know",
    "intermediate",
    "How do StorageClasses enable dynamic volume provisioning and what parameters govern IOPS, throughput, and disk types?",
    "A StorageClass defines the provisioner (CSI driver), volume parameters (e.g. IOPS, throughput, encryption), and reclaim policy, allowing Kubernetes to automatically provision cloud storage on demand when a PVC is submitted, eliminating manual storage provisioning.",
    "Without StorageClasses, administrators had to pre-create dozens of static PVs manually. With dynamic provisioning: 1) Admin defines a StorageClass (\`gp3\`) with \`provisioner: ebs.csi.aws.com\` and parameters (\`iops: \"3000\"`, \`encrypted: \"true\"\`); 2) Developer submits a PVC referencing \`storageClassName: gp3\`; 3) The CSI controller automatically invokes AWS EC2 APIs to create the exact EBS volume; 4) The PV is created and bound instantly.",
    `# High-Performance AWS gp3 StorageClass
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-database-storage
provisioner: ebs.csi.aws.com
volumeBindingMode: WaitForFirstConsumer # Delay provisioning until pod is scheduled!
reclaimPolicy: Retain                   # Protect data against accidental deletion
allowVolumeExpansion: true              # Allow resizing disk on the fly
parameters:
  type: gp3
  iops: "5000"
  throughput: "250"
  encrypted: "true"`,
    "Always set 'allowVolumeExpansion: true' in StorageClasses so you can increase disk sizes dynamically by simply editing the PVC spec.",
    ["storageclass", "dynamic-provisioning", "gp3", "ebs-csi", "cloud-storage"]
  ),
  card(
    31,
    cat,
    "Volume Access Modes: RWO vs RWX vs ROX vs RWOP",
    "must-know",
    "intermediate",
    "What are the four Kubernetes volume access modes (ReadWriteOnce, ReadWriteMany, ReadOnlyMany, ReadWriteOncePod) and what storage backends support them?",
    "Access modes describe how many nodes can mount a volume concurrently: ReadWriteOnce (RWO: single node read-write), ReadWriteMany (RWX: multiple nodes read-write), ReadOnlyMany (ROX: multiple nodes read-only), and ReadWriteOncePod (RWOP: single pod read-write).",
    "Access modes describe node-level concurrency, not pod concurrency: **RWO** allows multiple pods on the *same* node to mount the disk, but blocks pods on other nodes (standard cloud block storage: AWS EBS, Azure Disk, GCP Persistent Disk only support RWO). **RWX** allows pods distributed across *hundreds* of different nodes to write concurrently (requires Network File Systems: AWS EFS, NFS, CephFS, GlusterFS). **RWOP** (introduced in K8s 1.22) guarantees that only a single *pod* in the entire cluster can access the volume, preventing data corruption in single-writer databases.",
    `// Storage Backend Access Mode Matrix:
// - AWS EBS / GCP PD / Azure Disk: ReadWriteOnce (Block Storage)
// - AWS EFS / Azure Files / NFS / CephFS: ReadWriteMany (File Storage)
// - S3 / Object Stores (CSI): ReadOnlyMany (Object Storage)
// - Dedicated Database (Postgres): ReadWriteOncePod (Strict Pod Isolation)`,
    "Attempting to mount an AWS EBS volume (RWO) onto two pods scheduled on different worker nodes will fail with a 'Multi-Attach error'. Use EFS or Ceph for RWX.",
    ["access-modes", "rwo", "rwx", "rwop", "block-vs-file-storage"]
  ),
  card(
    32,
    cat,
    "Volume Binding Modes: Immediate vs WaitForFirstConsumer",
    "must-know",
    "intermediate",
    "Why does 'volumeBindingMode: Immediate' cause unschedulable pod errors in multi-AZ clusters, and why is 'WaitForFirstConsumer' mandatory?",
    "'volumeBindingMode: Immediate' provisions the cloud storage disk the moment the PVC is created, picking an arbitrary Availability Zone (AZ) before the pod is scheduled. 'WaitForFirstConsumer' delays disk provisioning until the pod is actually scheduled, guaranteeing the disk is created in the exact AZ where the pod will run.",
    "Cloud block storage volumes (AWS EBS) are locked to a specific Availability Zone (e.g. us-east-1a) and cannot be attached to instances in another AZ (us-east-1b). If a StorageClass uses \`Immediate\`, Kubernetes provisions an EBS disk in us-east-1a immediately upon PVC creation. However, when the pod is later scheduled, node-01 in us-east-1a may be out of CPU/memory, so the scheduler places the pod in us-east-1b! The pod becomes permanently unschedulable with 'Node Affinity conflict'. \`WaitForFirstConsumer\` guarantees that the scheduler first finds a healthy node, and only then provisions the disk in that node's AZ.",
    `# StorageClass with Mandatory WaitForFirstConsumer
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: multi-az-gp3
provisioner: ebs.csi.aws.com
# MANDATORY FOR MULTI-AZ CLUSTERS:
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true`,
    "Always use 'volumeBindingMode: WaitForFirstConsumer' in multi-AZ cloud clusters to prevent AZ mismatch scheduling deadlocks.",
    ["volume-binding-mode", "waitforfirstconsumer", "multi-az", "scheduling-deadlock", "ebs-affinity"]
  ),
  card(
    33,
    cat,
    "Volume Expansion & Filesystem Resizing",
    "must-know",
    "intermediate",
    "How does Kubernetes expand PersistentVolume size on the fly without deleting PVCs or recreating database pods?",
    "Volume expansion allows operators to increase a PVC's storage request (e.g. from 50Gi to 100Gi) in place. The CSI driver expands the underlying cloud block device, and Kubelet automatically expands the underlying Linux filesystem (ext4/xfs) during pod execution.",
    "Requirements: 1) The StorageClass must have \`allowVolumeExpansion: true\`; 2) The operator edits the PVC: \`kubectl patch pvc data-pvc -p '{\"spec\":{\"resources\":{\"requests\":{\"storage\":\"100Gi\"}}}}'\`; 3) The CSI controller calls cloud APIs to increase the virtual disk size; 4) The PVC condition changes to \`FileSystemResizePending\`; 5) Kubelet detects the enlarged block device and runs \`resize2fs\` (ext4) or \`xfs_growfs\` (xfs) online without restarting the pod.",
    `# Patching PVC storage size on the fly
kubectl patch pvc postgres-data-pvc \\
  --type=merge \\
  -p '{"spec":{"resources":{"requests":{"storage":"200Gi"}}}}'

# Verifying resize status:
kubectl get pvc postgres-data-pvc
# Output displays: CAPACITY: 200Gi`,
    "Volume expansion can only increase disk sizes; cloud providers do not support shrinking block volumes. Back up data before expanding.",
    ["volume-expansion", "pvc-resize", "csi-expansion", "filesystem-grow", "zero-downtime-storage"]
  ),
  card(
    34,
    cat,
    "VolumeSnapshots & CSI Snapshot Controller",
    "advanced",
    "advanced",
    "How does the Kubernetes VolumeSnapshot API standardize point-in-time storage backups across cloud and on-premises storage providers?",
    "The VolumeSnapshot API (managed by the external CSI snapshot-controller) introduces three standardized CRDs: VolumeSnapshotClass, VolumeSnapshot, and VolumeSnapshotContent, allowing operators to create point-in-time disk snapshots and restore new PVCs from them declaratively.",
    "Before VolumeSnapshots, taking database backups required cloud-specific custom scripts. With VolumeSnapshots: 1) Admin creates \`VolumeSnapshotClass\`; 2) User creates \`VolumeSnapshot\` pointing to a target PVC; 3) The CSI controller triggers a native storage snapshot (e.g. AWS EBS Snapshot); 4) To restore or clone a database, the user creates a new PVC specifying \`dataSource: { kind: VolumeSnapshot, name: snap-01 }\`. The cloud provider clones the snapshot into a new independent high-speed disk in seconds.",
    `# Creating a VolumeSnapshot of an active database PVC
apiVersion: snapshot.storage.k8s.io/v1
kind: VolumeSnapshot
metadata:
  name: postgres-backup-snap-01
spec:
  volumeSnapshotClassName: csi-aws-vsc
  source:
    persistentVolumeClaimName: postgres-data-pvc

---
# Restoring a New PVC from the Snapshot
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-restored-pvc
spec:
  storageClassName: gp3
  dataSource:
    name: postgres-backup-snap-01
    kind: VolumeSnapshot
    apiGroup: snapshot.storage.k8s.io
  accessModes: ["ReadWriteOnce"]
  resources:
    requests:
      storage: 100Gi`,
    "VolumeSnapshots provide fast, storage-level point-in-time recovery without transferring gigabytes of raw data over application network pipes.",
    ["volumesnapshots", "csi-snapshots", "backup-and-restore", "disaster-recovery", "storage-cloning"]
  ),
  card(
    35,
    cat,
    "Projected Volumes: Tokens, Downward API & ConfigMaps",
    "must-know",
    "intermediate",
    "What is a Projected Volume in Kubernetes and how does it consolidate ServiceAccount tokens, Downward API metadata, and ConfigMaps into a single mount path?",
    "A Projected Volume maps several distinct volume sources (Secret, ConfigMap, downwardAPI, serviceAccountToken) into the exact same unified directory path inside a container, enabling atomic configuration composition and token projection.",
    "Standard volume mounts require each ConfigMap or Secret to occupy an independent directory path. A Projected Volume merges them seamlessly: an application can read \`/etc/app/config.json\` (from ConfigMap), \`/etc/app/password\` (from Secret), \`/etc/app/pod_ip\` (from Downward API), and \`/var/run/secrets/tokens/vault-token\` (from audience-bound short-lived ServiceAccount token) all in one consolidated mount point.",
    `# Projected Volume Spec
apiVersion: v1
kind: Pod
metadata:
  name: projected-pod
spec:
  containers:
  - name: app
    image: enterprise/app:v1
    volumeMounts:
    - name: unified-config
      mountPath: /etc/app/bundle
  volumes:
  - name: unified-config
    projected:
      sources:
      # Source 1: Static ConfigMap
      - configMap:
          name: app-config
      # Source 2: Secret file
      - secret:
          name: app-secret
      # Source 3: Downward API injecting Pod IP
      - downwardAPI:
          items:
            - path: "pod_ip"
              fieldRef:
                fieldPath: status.podIP
      # Source 4: Bound ServiceAccount token with specific audience
      - serviceAccountToken:
          audience: "vault.enterprise.com"
          expirationSeconds: 3600
          path: "token"`,
    "Projected ServiceAccount tokens are bound to specific audiences and expire automatically, replacing long-lived static legacy tokens.",
    ["projected-volumes", "downward-api", "bound-tokens", "serviceaccount-token", "configuration"]
  ),
  card(
    36,
    cat,
    "Local Persistent Volumes (Local PV) vs Cloud Block Storage",
    "advanced",
    "advanced",
    "When should high-throughput distributed databases (ScyllaDB, Elasticsearch, Kafka) use Local PVs over network-attached cloud storage (AWS EBS / Ceph)?",
    "Local Persistent Volumes mount directly attached physical host NVMe SSDs, delivering sub-millisecond I/O latency and millions of IOPS with zero network transport overhead, but sacrificing cloud snapshot portability and requiring application-level data replication.",
    "Cloud block storage (EBS) attaches over the network via NVMe-oF/iSCSI, introducing 1-3ms network latency and throughput throttling. For write-heavy distributed databases that already replicate data internally (Cassandra, Elasticsearch, Kafka), paying for cloud volume network hops is wasteful. Local PVs pin volumes to local NVMe disks on specific nodes using \`nodeAffinity\`. If the physical node hardware dies, the disk is lost; the distributed database must heal and rebuild the replica from peers over the network.",
    `# Local PV bound to host NVMe mount
apiVersion: v1
kind: PersistentVolume
metadata:
  name: local-nvme-pv
spec:
  capacity:
    storage: 1Ti
  accessModes:
  - ReadWriteOnce
  persistentVolumeReclaimPolicy: Retain
  storageClassName: local-nvme
  local:
    path: /mnt/disks/nvme0n1 # Direct local NVMe physical drive!
  # MANDATORY: Pins PV to the specific physical machine containing the disk!
  nodeAffinity:
    required:
      nodeSelectorTerms:
      - matchExpressions:
        - key: kubernetes.io/hostname
          operator: In
          values:
          - storage-node-04`,
    "Only use Local PVs for software architectures that manage their own clustering and replication (Kafka, ScyllaDB). Never use Local PVs for single-instance PostgreSQL.",
    ["local-pv", "nvme-storage", "high-iops", "cloud-storage-vs-local", "database-performance"]
  )
];
