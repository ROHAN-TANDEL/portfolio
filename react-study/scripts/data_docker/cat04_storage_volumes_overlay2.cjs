const { createCard } = require('../docker_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 37,
    category: "Storage, Volumes & Storage Drivers",
    concept: "Named Volumes vs Bind Mounts vs tmpfs",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the three primary types of storage mounts in Docker, and when should you use each?",
    quickAnswer: "1) **Named Volumes**: Managed by Docker in `/var/lib/docker/volumes/`, platform-agnostic, best for persistent data (databases). 2) **Bind Mounts**: Maps any arbitrary host path into the container, highly dependent on host directory structure, best for source code hot-reloading. 3) **`tmpfs` Mounts**: Stored strictly in host memory (RAM), never written to disk, best for sensitive secrets or high-speed temporary scratchpads.",
    detailedAnswer: "Storage mounts bypass the container's storage driver (Copy-on-Write layer), providing native I/O throughput. Named Volumes are completely managed by Docker's API, can be backed by cloud plugins (NFS, AWS EFS), and survive container destruction. Bind Mounts allow bi-directional synchronization between the host filesystem and the container, but expose host file permission risks. `tmpfs` mounts guarantee that files vanish immediately when the container stops.",
    code: `# 1. NAMED VOLUME (Production Database Standard):
$ docker volume create pg_data
$ docker run -d -v pg_data:/var/lib/postgresql/data postgres:16

# 2. BIND MOUNT (Development Hot-Reloading):
$ docker run -d -v $(pwd)/src:/app/src node:20 npm run dev

# 3. TMPFS MOUNT (High-Speed Memory Only / Sensitive keys):
$ docker run -d --tmpfs /app/cache:rw,noexec,nosuid,size=64m my-app

# 4. Modern unified --mount syntax (Preferred over -v):
$ docker run -d \
    --mount type=volume,source=pg_data,target=/var/lib/postgresql/data \
    postgres:16`,
    recallHint: "Named Volume = managed by Docker (databases). Bind Mount = host path (dev). tmpfs = RAM only (secrets/cache).",
    interviewTip: "Always recommend the `--mount` syntax over `-v`. The `-v` flag silently creates a new host directory if the source path does not exist, whereas `--mount` throws an explicit error, preventing silent bugs.",
    tags: ["volumes", "bind-mounts", "tmpfs", "storage", "persistence"],
    practice: [
      "What happens if you mount a named volume onto a container directory that already contains files?",
      "Why does a bind mount overwrite existing container directory contents, while an empty named volume populates with existing container files?"
    ]
  }),

  createCard({
    idNum: 38,
    category: "Storage, Volumes & Storage Drivers",
    concept: "Named Volume Management (create, inspect, prune)",
    priority: "must-know",
    difficulty: "beginner",
    question: "How do you manage the lifecycle of Docker Named Volumes using CLI commands?",
    quickAnswer: "Use `docker volume create <name>`, `docker volume ls` (list), `docker volume inspect <name>` (view host mountpoint), `docker volume rm <name>` (delete volume), and `docker volume prune` (delete all dangling unattached volumes).",
    detailedAnswer: "Named Volumes are first-class citizens in Docker. Unlike anonymous volumes created without a name, named volumes have clear semantic identities and are never automatically deleted when a container is removed with `docker rm`. To inspect where Docker stores the physical data on Linux hosts, check `Mountpoint` in `docker volume inspect` (typically `/var/lib/docker/volumes/<name>/_data`).",
    code: `# 1. Create a volume with custom labels:
$ docker volume create --label environment=production db_data

# 2. Inspect volume details and host storage location:
$ docker volume inspect db_data
# [
#   {
#     "CreatedAt": "2026-11-04T10:00:00Z",
#     "Driver": "local",
#     "Labels": { "environment": "production" },
#     "Mountpoint": "/var/lib/docker/volumes/db_data/_data",
#     "Name": "db_data",
#     "Scope": "local"
#   }
# ]

# 3. List dangling volumes not connected to any container:
$ docker volume ls -f dangling=true

# 4. Safely delete all dangling volumes to reclaim disk:
$ docker volume prune -f`,
    recallHint: "docker volume create, ls, inspect, rm, prune. Stored in /var/lib/docker/volumes/<name>/_data.",
    interviewTip: "Caution: `docker system prune` does NOT delete volumes by default! You must pass `docker system prune --volumes` or run `docker volume prune` explicitly to prevent orphaned volumes from eating host disk space.",
    tags: ["volume-management", "cli", "prune", "storage", "admin"],
    practice: [
      "Why does Docker protect volumes from being deleted by default in `docker system prune`?",
      "How do you inspect which container is currently using a specific volume?"
    ]
  }),

  createCard({
    idNum: 39,
    category: "Storage, Volumes & Storage Drivers",
    concept: "Bind Mounts & The -v vs --mount Distinction",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the behavioral differences between `-v /host:/container` and `--mount type=bind,src=...,dst=...`?",
    quickAnswer: "`-v` uses a concise colon-separated syntax; if the host path does NOT exist, Docker automatically creates an empty directory owned by root on the host! `--mount` is explicit and verbose; if the host source path does not exist, Docker throws an immediate error and halts execution.",
    detailedAnswer: "The silent directory creation behavior of `-v` is the source of frequent production outages. If a developer accidentally writes `-v /etc/myconfig.conf:/app/config.conf` with a typo, Docker creates `/etc/myconfig.conf` as a directory on the host rather than mounting the file! The containerized app crashes trying to read a directory as a file. The modern `--mount` flag enforces strict validation, supports advanced options (like `bind-propagation=rshared`, `consistency`), and avoids accidental directory creation.",
    code: `# DANGEROUS: If config.json does not exist on host, -v creates it as a DIRECTORY!
$ docker run -v /host/missing.json:/app/config.json my-app
# Result: Host now has an empty folder named /host/missing.json!

# SAFE & STRICT: Fails immediately with explicit error:
$ docker run \
    --mount type=bind,source=/host/missing.json,target=/app/config.json,readonly \
    my-app
# Error: "invalid mount config for type 'bind': bind source path does not exist"

# Read-only bind mount syntax:
$ docker run -v $(pwd)/config:/etc/nginx:ro nginx:alpine
$ docker run --mount type=bind,src=$(pwd)/config,dst=/etc/nginx,readonly nginx:alpine`,
    recallHint: "-v creates missing host paths as root directories. --mount throws an explicit error if path is missing.",
    interviewTip: "Always recommend `--mount` in enterprise scripts and Docker Compose for clarity, safety, and strict error handling.",
    tags: ["bind-mount", "mount-flag", "v-flag", "best-practices", "storage"],
    practice: [
      "What is bind-propagation (`rprivate`, `rshared`, `rslave`) in Docker bind mounts?",
      "How does the `readonly` option protect the host filesystem from container mutations?"
    ]
  }),

  createCard({
    idNum: 40,
    category: "Storage, Volumes & Storage Drivers",
    concept: "overlay2 Storage Driver Internals (LowerDir, UpperDir, MergedDir)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Explain the four directories of the Linux `overlay2` storage driver: lowerdir, upperdir, merged, and workdir.",
    quickAnswer: "1) **lowerdir**: The read-only image layers stacked together. 2) **upperdir**: The container's writable layer where all file additions and edits are stored. 3) **merged**: The unified virtual mount view presented to the running container. 4) **workdir**: An internal scratch directory used by OverlayFS for atomic file modifications.",
    detailedAnswer: "OverlayFS is a modern Linux union mount filesystem. Instead of physically merging files, it creates a virtual unified view (`merged`). When a process reads a file, OverlayFS searches `upperdir` first; if missing, it checks `lowerdir` layers from top to bottom. When a process modifies an existing file, the kernel copies the file from `lowerdir` into `upperdir` (Copy-on-Write) before mutating it. When a file is deleted, a character device called a 'whiteout' (`.wh.<filename>`) is created in `upperdir` to mask the file from the merged view.",
    code: `# Mount a custom OverlayFS manually to understand container internals:
$ mkdir lower upper work merged

# Create a file in lower (read-only base):
$ echo "Hello from Lower Layer" > lower/file.txt

# Mount OverlayFS:
$ sudo mount -t overlay overlay \
    -o lowerdir=lower,upperdir=upper,workdir=work \
    merged

# View the merged virtual directory:
$ cat merged/file.txt
Hello from Lower Layer

# Modify the file in merged:
$ echo "Mutated in Upper Layer" >> merged/file.txt

# Notice: 'lower' remains pristine; 'upper' now has the copied & mutated file!
$ cat lower/file.txt
Hello from Lower Layer
$ cat upper/file.txt
Hello from Lower Layer
Mutated in Upper Layer`,
    recallHint: "overlay2: lowerdir = read-only image layers; upperdir = container writable layer; merged = unified view.",
    interviewTip: "Draw the 4 directories on a whiteboard in system design interviews. Explain that whiteout files (`0,0` character devices) mask deleted files in lower layers.",
    tags: ["overlay2", "overlayfs", "storage-driver", "lowerdir", "upperdir", "linux"],
    practice: [
      "Why is `overlay2` dramatically faster than legacy `aufs` or `devicemapper` storage drivers?",
      "What happens to `upperdir` when `docker rm` is executed on an exited container?"
    ]
  }),

  createCard({
    idNum: 41,
    category: "Storage, Volumes & Storage Drivers",
    concept: "Volume Permissions & Host UID/GID Mismatch Disasters",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why do containerized applications frequently fail with `EACCES: permission denied` on host-mounted volumes, and how do you resolve it?",
    quickAnswer: "Linux enforces permissions using numerical User IDs (UIDs), NOT usernames. If an app inside a container runs as `node` (UID 1000), but the host directory is owned by host root (UID 0) or another user (UID 1001), the Linux kernel denies write access. Solutions: 1) Match host UID via `docker run --user $(id -u):$(id -g)`, 2) Enable Docker User Namespaces (`userns-remap`), or 3) Use an entrypoint `gosu` fixup script.",
    detailedAnswer: "A common developer trap is creating a directory on the host as root, mounting it into a container running as a non-root user, and receiving permission denied errors. The container's non-root process (e.g. UID 1000) has no permission to write to a host directory with `drwxr-xr-x root:root` permissions. You can fix this by passing the host user's UID dynamically at runtime (`--user $(id -u):$(id -g)`), ensuring created files are owned by the host developer.",
    code: `# 1. RUNTIME FIX: Run container using the host user's exact UID and GID:
$ docker run --rm \
    --user $(id -u):$(id -g) \
    -v $(pwd)/data:/app/data \
    my-node-app

# 2. DOCKERFILE FIX: Parameterize UID during image build:
ARG USER_ID=1000
ARG GROUP_ID=1000
RUN groupadd -g \${GROUP_ID} appgroup && \
    useradd -u \${USER_ID} -g appgroup -m appuser
USER appuser

# 3. GOSU FIX: Entrypoint starts as root, fixes permissions, drops to unprivileged:
# In entrypoint.sh:
#!/bin/sh
chown -R appuser:appgroup /app/data
exec gosu appuser "$@"`,
    recallHint: "Linux permissions use numerical UIDs, not usernames. Pass --user $(id -u):$(id -g) to match host ownership.",
    interviewTip: "Explain why `gosu` is superior to `sudo` or `su` in entrypoint scripts: `gosu` replaces the current process without creating a subshell, ensuring the application remains PID 1 to catch `SIGTERM` signals.",
    tags: ["permissions", "uid-gid", "eacces", "gosu", "security"],
    practice: [
      "Why does running `sudo chown -R 777 /path` on the host violate production security guidelines?",
      "How does `userns-remap` in `/etc/docker/daemon.json` transparently remap container root (UID 0) to an unprivileged host UID?"
    ]
  }),

  createCard({
    idNum: 42,
    category: "Storage, Volumes & Storage Drivers",
    concept: "Read-Only Root Filesystem & Ephemeral tmpfs",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Why should production containers run with `--read-only`, and how do you handle applications that require temporary writable directories?",
    quickAnswer: "`--read-only` mounts the container's root filesystem as strictly read-only, preventing attackers from downloading malware, injecting rootkits, or modifying code binaries upon an RCE breach. For directories that legitimately require temporary writes (like `/tmp`, `/run`, or cache), mount writable `tmpfs` in-memory filesystems.",
    detailedAnswer: "An immutable infrastructure best practice is treating containers as pure stateless computation units. Running with `--read-only` guarantees that even if a zero-day vulnerability is exploited, the attacker cannot persist a backdoor or modify any application files. Any logging or transient file uploads should be directed to explicit `tmpfs` mounts with `noexec` and `nosuid` security flags.",
    code: `# Run production container with read-only root and isolated tmpfs for /tmp:
$ docker run -d --name secure-api \
    --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,size=64m \
    --tmpfs /run:rw,noexec,nosuid,size=16m \
    --tmpfs /app/cache:rw,noexec,nosuid,size=128m \
    -p 8080:8080 \
    my-api:latest

# In Docker Compose:
# services:
#   api:
#     image: my-api:latest
#     read_only: true
#     tmpfs:
#       - /tmp:size=64M,noexec
#       - /run:size=16M,noexec`,
    recallHint: "--read-only locks down container filesystem against tampering; use --tmpfs for required temp directories.",
    interviewTip: "Mention `noexec` on `--tmpfs`: it prevents attackers from saving an executable binary into `/tmp` and executing it.",
    tags: ["read-only", "tmpfs", "hardening", "security", "immutability"],
    practice: [
      "What happens if an application attempts to write to `/var/log` inside a `--read-only` container without a mount?",
      "How does `--read-only` protect against container escape exploits?"
    ]
  }),

  createCard({
    idNum: 43,
    category: "Storage, Volumes & Storage Drivers",
    concept: "Backup & Restore of Named Volumes with Ephemeral Containers",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you back up and restore a Docker Named Volume without stopping the Docker daemon?",
    quickAnswer: "Spawn an ephemeral container using `docker run --rm`, mount the target volume using `-v <volume_name>:/data`, mount the current host backup directory using `-v $(pwd):/backup`, and execute `tar -czvf /backup/backup.tar.gz -C /data .`. To restore, run `tar -xzvf` into the new volume.",
    detailedAnswer: "Because named volumes reside inside `/var/lib/docker/volumes/` (often protected by root permissions or stored inside a virtual machine on macOS/Windows), copying files manually from the host is error-prone. The standard pattern is launching a lightweight container (Alpine) that attaches to the volume, streams the files into a compressed archive on the host, and auto-removes itself (`--rm`).",
    code: `# 1. BACKUP: Dump named volume 'db_data' to a host compressed tarball:
$ docker run --rm \
    -v db_data:/volume-data:ro \
    -v $(pwd)/backups:/backup \
    alpine \
    tar -czvf /backup/db_data_$(date +%Y%m%d).tar.gz -C /volume-data .

# 2. RESTORE: Restore backup tarball into a brand new named volume 'db_data_restored':
$ docker volume create db_data_restored
$ docker run --rm \
    -v db_data_restored:/volume-data \
    -v $(pwd)/backups:/backup:ro \
    alpine \
    tar -xzvf /backup/db_data_20261104.tar.gz -C /volume-data`,
    recallHint: "Backup volume: Mount volume + host dir into ephemeral alpine container, run tar -czf to dump archive.",
    interviewTip: "Always mount the source volume as `:ro` (read-only) during backup to guarantee the backup process cannot accidentally modify or corrupt production files.",
    tags: ["backup", "restore", "tar", "volume-migration", "disaster-recovery"],
    practice: [
      "Why is dumping a live PostgreSQL database via `pg_dump` safer than taking a raw filesystem `tar` of the volume?",
      "How do you upload the volume tarball directly to an AWS S3 bucket using an ephemeral AWS CLI container?"
    ]
  }),

  createCard({
    idNum: 44,
    category: "Storage, Volumes & Storage Drivers",
    concept: "Sharing Volumes Between Containers (--volumes-from)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you share storage volumes between multiple containers, and how does `--volumes-from` work?",
    quickAnswer: "Containers share storage by mounting the **exact same named volume** simultaneously (e.g. `-v shared_cache:/cache`). Alternatively, legacy `--volumes-from <container>` mounts all volumes exported by another container into the current container.",
    detailedAnswer: "Sharing volumes is common for sidecar architectures—for example, an application container writes access logs to a shared volume, and a Fluentd or Promtail logging sidecar container reads and ships those logs to an aggregation server. In modern Docker and Compose, explicitly mounting the same named volume to both services is preferred over `--volumes-from` for clarity and modularity.",
    code: `# Pattern: Application writes logs; Nginx/Log collector reads them:
$ docker volume create app_logs

# 1. Main Application Container writes logs:
$ docker run -d --name backend-api \
    -v app_logs:/var/log/app \
    my-backend

# 2. Sidecar Log Shipper reads the same volume in read-only mode:
$ docker run -d --name log-shipper \
    -v app_logs:/var/log/app:ro \
    fluent/fluent-bit:latest

# Using legacy --volumes-from syntax:
$ docker run -d --name metrics-sidecar --volumes-from backend-api:ro prom/statsd-exporter`,
    recallHint: "Mount the exact same named volume on multiple containers; use :ro on sidecar readers.",
    interviewTip: "Remind the interviewer that local filesystem locks (like SQLite database locks) can deadlock or corrupt if multiple containers write concurrently to the same volume without distributed locking.",
    tags: ["shared-storage", "sidecar", "volumes-from", "logging", "patterns"],
    practice: [
      "What are the concurrency hazards of two containers writing to the same SQLite database file on a shared volume?",
      "How does Docker Compose declare shared volumes across multiple service definitions?"
    ]
  }),

  createCard({
    idNum: 45,
    category: "Storage, Volumes & Storage Drivers",
    concept: "Docker Volume Drivers & Remote Storage (NFS, Cloud Plugins)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do Docker Volume Drivers allow containers to attach directly to remote storage systems (NFS, AWS EBS/EFS, Ceph)?",
    quickAnswer: "Docker Volume Drivers are plugins that intercept volume lifecycle events. When a container starts, the driver automatically mounts remote network block or file storage (like NFS, AWS EFS, or Ceph) into `/var/lib/docker/volumes/<name>` on the host. When the container migrates to another node, the storage attaches dynamically.",
    detailedAnswer: "In multi-host clustering environments, local host volumes tie containers to a single physical machine. Volume drivers decouple storage from host hardware. Using the built-in `local` driver with NFS mount options allows containers to write to enterprise network attached storage without installing NFS client packages inside the container image itself.",
    code: `# Create a volume backed by a remote NFS server using Docker's built-in local driver:
$ docker volume create --driver local \
    --opt type=nfs \
    --opt o=addr=192.168.1.100,rw,noatime,rsize=8192,wsize=8192,tcp,timeo=14 \
    --opt device=:/srv/nfs/shared_data \
    nfs_shared_volume

# Mount and use in any container:
$ docker run -d -v nfs_shared_volume:/data nginx:alpine

# Install third-party cloud volume driver (e.g. Rex-Ray for AWS EBS):
$ docker plugin install rexray/ebs EBS_ACCESSKEY=... EBS_SECRETKEY=...`,
    recallHint: "Volume drivers attach remote network storage (NFS, EFS) dynamically using driver options.",
    interviewTip: "Highlight that using driver options on the host avoids baking NFS utilities or AWS credentials into container application images.",
    tags: ["volume-drivers", "nfs", "cloud-storage", "plugins", "enterprise"],
    practice: [
      "What happens to container write operations if the remote NFS server becomes temporarily unreachable?",
      "How does AWS ECS use the Docker EFS volume driver to mount persistent serverless volumes in Fargate?"
    ]
  }),

  createCard({
    idNum: 46,
    category: "Storage, Volumes & Storage Drivers",
    concept: "OverlayFS Inode Exhaustion & Dangling Storage Bloat",
    priority: "must-know",
    difficulty: "advanced",
    question: "What causes 'No space left on device' errors when `df -h` shows plenty of gigabytes remaining on host disk?",
    quickAnswer: "The filesystem has suffered **Inode Exhaustion** (`df -i` shows 100% inode usage). Every file, directory, and OverlayFS layer consumes exactly one inode. Applications that create millions of tiny temporary files (e.g. cache files, uncleaned sessions) or builds with hundreds of dangling layers exhaust the inode table long before physical disk bytes are filled.",
    detailedAnswer: "In Linux, every filesystem has a fixed number of inodes allocated during formatting. If a container writes 500,000 tiny 10-byte files, it consumes only 5MB of disk space, but burns 500,000 inodes. Once free inodes reach 0, the kernel rejects new file creation with `ENOSPC: No space left on device`. Additionally, unpruned intermediate image layers in `/var/lib/docker/overlay2` hoard millions of inodes.",
    code: `# 1. Check disk space in gigabytes:
$ df -h /var/lib/docker
# Filesystem      Size  Used Avail Use% Mounted on
# /dev/sda1        50G   15G   35G  30% /  <-- Looks fine!

# 2. Check INODE usage:
$ df -i /var/lib/docker
# Filesystem       Inodes   IUsed   IFree IUse% Mounted on
# /dev/sda1       3276800 3276800       0  100% /  <-- OUT OF INODES!

# 3. Find directories with the highest file counts:
$ find /var/lib/docker/overlay2 -maxdepth 2 -type d | while read -r dir; do \
    echo "$(find "$dir" | wc -l) $dir"; \
  done | sort -rn | head -10

# 4. Immediate Remediation: Clean dangling images, builders, and containers:
$ docker system prune -a --volumes -f`,
    recallHint: "No space left on device with free GB means INODE exhaustion (df -i at 100%). Check millions of tiny files.",
    interviewTip: "Senior DevOps engineers always check both `df -h` (bytes) and `df -i` (inodes) when investigating disk-related production outages.",
    tags: ["inodes", "enospc", "storage-exhaustion", "overlay2", "troubleshooting"],
    practice: [
      "Why can't you increase the inode limit on an existing ext4 filesystem without reformatting?",
      "How do BuildKit cache mounts help prevent inode accumulation on CI runners?"
    ]
  }),

  createCard({
    idNum: 47,
    category: "Storage, Volumes & Storage Drivers",
    concept: "Disk Space Auditing with docker system df",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you audit and analyze Docker disk usage across images, containers, local volumes, and build cache?",
    quickAnswer: "Run `docker system df` to display a high-level breakdown of disk usage and reclaimable space across Images, Containers, Local Volumes, and Build Cache. Use `docker system df -v` for detailed line-by-line inspection of individual assets and last-used timestamps.",
    detailedAnswer: "Over time, Docker hosts suffer from 'disk creep' as new images are pulled, containers crash, and build caches grow. `docker system df` categorizes usage and calculates exactly how many gigabytes are 'reclaimable' (unattached assets). In modern Docker versions with BuildKit, the build cache frequently accounts for 40-70% of total host disk consumption.",
    code: `# Summary of Docker disk usage:
$ docker system df
# TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
# Images          15        4         4.82GB    3.21GB (66%)
# Containers      5         2         124MB     82MB (66%)
# Local Volumes   8         3         12.5GB    8.1GB (64%)
# Build Cache     42        0         6.85GB    6.85GB (100%)

# Verbose breakdown showing every image, volume, and container ID:
$ docker system df -v

# Prune build cache specifically:
$ docker builder prune -f --keep-storage 5GB

# Prune everything unused:
$ docker system prune -a --volumes`,
    recallHint: "docker system df shows Images, Containers, Volumes, and Build Cache with reclaimable %.",
    interviewTip: "Point out that `docker builder prune` is dedicated to cleaning the BuildKit cache, which is often overlooked when developers only run `docker image prune`.",
    tags: ["system-df", "disk-audit", "build-cache", "cleanup", "admin"],
    practice: [
      "What is the difference between dangling images and unused images in `docker image prune`?",
      "How do you configure automatic build cache garbage collection in `/etc/docker/daemon.json`?"
    ]
  }),

  createCard({
    idNum: 48,
    category: "Storage, Volumes & Storage Drivers",
    concept: "File Change Monitoring in Bind Mounts (inotify & Virtualization)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why do file watcher tools (nodemon, Vite, webpack-dev-server) fail to detect file edits in bind mounts on macOS and Windows?",
    quickAnswer: "On macOS and Windows, Docker runs inside a lightweight Linux Virtual Machine. File modifications made on the host OS must pass across a hypervisor filesystem sharing bridge (VirtioFS, gRPC-FUSE, or osxfs). These bridges frequently drop Linux kernel `inotify` event notifications, preventing dev servers from auto-reloading.",
    detailedAnswer: "In Linux, file watchers rely on kernel `inotify` system calls to receive instant notifications when a file inode is written to. When host files change in macOS Finder or VS Code, the macOS FSEvents notification does not always translate into a native Linux `inotify` event inside the Docker VM. Solutions include: 1) Enabling polling in dev servers (`CHOKIDAR_USEPOLLING=true`), 2) Using Docker Compose Watch (`docker compose watch`), or 3) Ensuring VirtioFS is enabled in Docker Desktop.",
    code: `# 1. Fix file watching in Node.js / Vite / React inside Docker:
# Force polling fallback instead of inotify:
ENV CHOKIDAR_USEPOLLING=true
ENV WATCHPACK_POLLING=true

# In vite.config.js:
# server: {
#   watch: {
#     usePolling: true,
#     interval: 100
#   }
# }

# 2. Modern Solution: Docker Compose Watch (Native file sync):
# compose.yaml:
# services:
#   web:
#     build: .
#     develop:
#       watch:
#         - action: sync
#           path: ./src
#           target: /app/src`,
    recallHint: "macOS/Windows Docker VM bridge drops inotify events. Fix with CHOKIDAR_USEPOLLING=true or Compose Watch.",
    interviewTip: "Mention that while polling fixes hot-reloading on macOS, polling burns 10-20% CPU on large codebases. Docker Compose Watch is the modern, CPU-efficient native alternative.",
    tags: ["inotify", "hot-reload", "bind-mount", "virtualization", "docker-desktop"],
    practice: [
      "What is VirtioFS and how does it improve file sharing throughput in Docker Desktop?",
      "How does `docker compose watch` synchronize files without relying on bind mounts?"
    ]
  })
];
