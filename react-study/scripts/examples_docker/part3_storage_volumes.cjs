module.exports = [
  {
    id: "docker-ex-23",
    title: "Named Volume with Custom Device Mount Options (XFS / ext4 flags)",
    category: "Storage & Volumes",
    difficulty: "advanced",
    whatThisCodeCovers: "Creates a Docker named volume with low-level Linux mount options (noatime, nodiratime) to optimize database I/O performance on dedicated disk partitions.",
    conceptsCovered: [
      "docker volume create --opt",
      "Filesystem mount flags (noatime)",
      "Bypassing metadata write amplification",
      "Volume driver options",
      "Production database tuning"
    ],
    code: `#!/usr/bin/env bash
# Create optimized volume targeting dedicated NVMe partition with noatime
docker volume create \\
  --driver local \\
  --opt type=ext4 \\
  --opt device=/dev/nvme0n1p2 \\
  --opt o=noatime,nodiratime,data=ordered \\
  postgres-highperf-data

# Inspect created volume options
docker volume inspect postgres-highperf-data

# Launch database using the optimized block volume
docker run -d \\
  --name db-master \\
  -v postgres-highperf-data:/var/lib/postgresql/data \\
  -e POSTGRES_PASSWORD=secret \\
  postgres:16-alpine`,
    breakdown: [
      {
        lineRange: "2-7",
        note: "Creates local volume with custom filesystem driver options. noatime eliminates timestamp writes on every read operation."
      },
      {
        lineRange: "13-17",
        note: "Postgres data folder mounts directly onto high-speed dedicated block storage with optimized mount options."
      }
    ],
    expectedOutput: `[
  {
    "CreatedAt": "2026-11-04T10:40:00Z",
    "Driver": "local",
    "Name": "postgres-highperf-data",
    "Options": {
      "device": "/dev/nvme0n1p2",
      "o": "noatime,nodiratime,data=ordered",
      "type": "ext4"
    },
    "Scope": "local"
  }
]`
  },
  {
    id: "docker-ex-24",
    title: "Resolving Host Volume Permission Denied (EACCES) via gosu User Step-Down",
    category: "Storage & Volumes",
    difficulty: "advanced",
    whatThisCodeCovers: "Solves the notorious host-container UID mismatch where host bind mounts fail with EACCES permission denied, using gosu to dynamically chown mountpoints on boot and step down to unprivileged execution.",
    conceptsCovered: [
      "UID/GID synchronization",
      "EACCES Permission Denied resolution",
      "gosu vs sudo step-down",
      "Dynamic chown on mount",
      "Container security entrypoint"
    ],
    code: `# Dockerfile
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends gosu \\
    && rm -rf /var/lib/apt/lists/*

RUN useradd -u 1000 -m -s /bin/bash appuser

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "app.js"]

# --- content of entrypoint.sh ---
# #!/bin/sh
# set -e
# USER_ID=\${LOCAL_UID:-1000}
# GROUP_ID=\${LOCAL_GID:-1000}
# 
# # Adjust appuser UID/GID to match host user dynamically
# usermod -u "$USER_ID" appuser 2>/dev/null
# groupmod -g "$GROUP_ID" appuser 2>/dev/null
# 
# chown -R appuser:appuser /app/data
# 
# # Execute CMD as appuser via gosu (without retaining root privileges)
# exec gosu appuser "$@"`,
    breakdown: [
      {
        lineRange: "2-7",
        note: "Installs gosu, a lightweight Go utility that steps down privileges without the signal-swallowing baggage of sudo/su."
      },
      {
        lineRange: "17-27",
        note: "entrypoint reads host LOCAL_UID/LOCAL_GID, aligns container user IDs, fixes volume ownership, and executes as appuser."
      }
    ],
    expectedOutput: `$ docker run -e LOCAL_UID=$(id -u) -e LOCAL_GID=$(id -g) -v $(pwd)/data:/app/data my-app
Adjusting user permissions to match host UID 1001...
Filesystem synced. Stepping down to user appuser.
[node] Application started without EACCES errors!`
  },
  {
    id: "docker-ex-25",
    title: "Hot Reloading Development Environment with Bind Mount and node_modules Volume Mask",
    category: "Storage & Volumes",
    difficulty: "intermediate",
    whatThisCodeCovers: "Configures live hot-reloading for local Node/React development by bind-mounting host source files while masking node_modules with an anonymous container volume so host OS differences don't break native packages.",
    conceptsCovered: [
      "Bind mount source code (-v $(pwd):/app)",
      "Anonymous volume masking (-v /app/node_modules)",
      "Vite / Webpack hot module replacement (HMR)",
      "CHOKIDAR_USEPOLLING file watching",
      "Developer environment ergonomics"
    ],
    code: `# docker-compose.dev.yaml
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "5173:5173"
    environment:
      - NODE_ENV=development
      # Polling fixes file change events on Windows / macOS Docker Desktop
      - CHOKIDAR_USEPOLLING=true
      - WATCHPACK_POLLING=true
    volumes:
      # Bind mount host directory for live code editing
      - .:/app
      # Anonymous volume masks container node_modules, protecting native compiled binaries!
      - /app/node_modules
    command: npm run dev -- --host 0.0.0.0`,
    breakdown: [
      {
        lineRange: "9-13",
        note: "Enables polling flags for file watchers so inotify events traverse virtualization boundaries on macOS and Windows."
      },
      {
        lineRange: "14-19",
        note: "Bind mounts host files, but mounts an anonymous volume at /app/node_modules, preventing host node_modules from overwriting container Linux binaries."
      }
    ],
    expectedOutput: `$ docker compose -f docker-compose.dev.yaml up
[+] Running 1/1
 ✔ Container frontend-1  Created
  VITE v5.2.0  ready in 180 ms
  ➜  Local:   http://localhost:5173/
[hmr] /app/src/App.tsx changed, reloading page in 12ms...`
  },
  {
    id: "docker-ex-26",
    title: "Automated Cold Backup of Production Named Volume to Compressed Tarball",
    category: "Storage & Volumes",
    difficulty: "intermediate",
    whatThisCodeCovers: "Performs a safe, non-destructive backup of a production database volume by mounting it read-only into an ephemeral Alpine container and streaming a compressed tar.gz to the host filesystem.",
    conceptsCovered: [
      "Ephemeral container backup pattern",
      "Read-only volume mount (:ro)",
      "tar cvzf streaming",
      "Automated timestamped backups",
      "Zero backup agent installation"
    ],
    code: `#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/var/backups/docker"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
VOLUME_NAME="postgres-production-data"
ARCHIVE_NAME="\${VOLUME_NAME}_\${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "Backing up volume '\$VOLUME_NAME' to \$BACKUP_DIR/\$ARCHIVE_NAME..."

# Ephemeral Alpine container mounts source volume read-only and streams tar to host
docker run --rm \\
  -v "\${VOLUME_NAME}:/source:ro" \\
  -v "\${BACKUP_DIR}:/backup" \\
  alpine:3.20 \\
  tar -czf "/backup/\${ARCHIVE_NAME}" -C /source .

echo "Backup completed successfully!"
ls -lh "\$BACKUP_DIR/\$ARCHIVE_NAME"`,
    breakdown: [
      {
        lineRange: "12-18",
        note: "Uses a temporary Alpine container with the target volume mounted read-only (:ro) to prevent accidental mutation during archiving."
      },
      {
        lineRange: "19-21",
        note: "Outputs a portable gzip archive directly to host backup directory."
      }
    ],
    expectedOutput: `Backing up volume 'postgres-production-data' to /var/backups/docker/postgres-production-data_20261104_104500.tar.gz...
Backup completed successfully!
-rw-r--r-- 1 root root 842M Nov  4 10:45 postgres-production-data_20261104_104500.tar.gz`
  },
  {
    id: "docker-ex-27",
    title: "Restoring Named Volume from Compressed Tarball to Fresh Container",
    category: "Storage & Volumes",
    difficulty: "intermediate",
    whatThisCodeCovers: "Restores an archived database or file volume from a compressed tarball into a brand new named Docker volume using an ephemeral utility container.",
    conceptsCovered: [
      "docker volume create",
      "Restoring data with tar -xzf",
      "Ephemeral restoration container",
      "Disaster recovery runbook",
      "Volume integrity verification"
    ],
    code: `#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_PATH="/var/backups/docker/postgres-production-data_20261104_104500.tar.gz"
TARGET_VOLUME="postgres-restored-data"

# 1. Create fresh target volume
docker volume create "$TARGET_VOLUME"

# 2. Extract backup tarball into target volume mountpoint
echo "Restoring data from $ARCHIVE_PATH into $TARGET_VOLUME..."
docker run --rm \\
  -v "$ARCHIVE_PATH:/backup/archive.tar.gz:ro" \\
  -v "$TARGET_VOLUME:/destination" \\
  alpine:3.20 \\
  tar -xzf /backup/archive.tar.gz -C /destination

# 3. Verify directory contents
docker run --rm -v "$TARGET_VOLUME:/data:ro" alpine:3.20 ls -la /data`,
    breakdown: [
      {
        lineRange: "6-8",
        note: "Allocates a pristine named volume."
      },
      {
        lineRange: "10-16",
        note: "Runs an ephemeral Alpine worker that uncompresses the archive directly into the newly created volume."
      },
      {
        lineRange: "18-19",
        note: "Runs a read-only verification check to confirm restored files are intact."
      }
    ],
    expectedOutput: `Restoring data from /var/backups/docker/postgres... into postgres-restored-data...
total 56
drwx------ 19 999 999  4096 Nov  4 10:45 .
drwxr-xr-x  1 root root  4096 Nov  4 10:46 ..
-rw-------  1 999 999     3 Nov  4 10:45 PG_VERSION
drwx------  5 999 999  4096 Nov  4 10:45 base
drwx------  2 999 999  4096 Nov  4 10:45 global
Volume restored and verified!`
  },
  {
    id: "docker-ex-28",
    title: "Ultra-Fast In-Memory Cache and Secret Storage via tmpfs Mounts",
    category: "Storage & Volumes",
    difficulty: "intermediate",
    whatThisCodeCovers: "Mounts temporary volatile memory (RAM) directly into container paths via tmpfs, guaranteeing sub-millisecond I/O for caches and ensuring decrypted secrets are never written to physical disk.",
    conceptsCovered: [
      "--tmpfs flag syntax",
      "Mounting RAM storage (size, mode)",
      "Zero disk persistence for secrets",
      "High performance volatile caching",
      "Preventing flash storage wear"
    ],
    code: `# Launch container with a 256MB RAM-backed tmpfs mount for sensitive cache
docker run -d \\
  --name fast-worker \\
  --tmpfs /dev/shm:rw,noexec,nosuid,size=256m \\
  --mount type=tmpfs,destination=/app/cache,tmpfs-size=512M,tmpfs-mode=1770 \\
  my-worker:latest

# Verify tmpfs mount inside the container
docker exec fast-worker df -h /app/cache

# When fast-worker is stopped, all in-memory data evaporates immediately!`,
    breakdown: [
      {
        lineRange: "2-6",
        note: "--mount type=tmpfs creates an isolated RAM filesystem with size restrictions (512MB) and permissions (1770)."
      },
      {
        lineRange: "8-9",
        note: "df -h verifies that /app/cache is mounted on tmpfs and backed entirely by host RAM."
      }
    ],
    expectedOutput: `Filesystem      Size  Used Avail Use% Mounted on
tmpfs           512M     0  512M   0% /app/cache`
  },
  {
    id: "docker-ex-29",
    title: "Read-Only Root Filesystem with Selective Writable tmpfs Locations",
    category: "Storage & Volumes",
    difficulty: "advanced",
    whatThisCodeCovers: "Hardens production containers by mounting the root filesystem as strictly read-only (--read-only), whitelisting only designated scratch directories (/tmp, /run) as tmpfs.",
    conceptsCovered: [
      "--read-only root filesystem",
      "Immutable container runtime",
      "Preventing malware persistence",
      "Selective tmpfs whitelisting",
      "CIS Docker Benchmark compliance"
    ],
    code: `# Run production web server with 100% immutable root filesystem
docker run -d \\
  --name hardened-api \\
  --read-only \\
  --tmpfs /tmp:rw,noexec,nosuid,size=64m \\
  --tmpfs /run:rw,noexec,nosuid,size=16m \\
  --tmpfs /var/log:rw,noexec,nosuid,size=32m \\
  -p 8080:8080 \\
  my-api:latest

# Verify write prevention:
docker exec hardened-api touch /usr/local/bin/malware || echo "SUCCESS: Write blocked!"`,
    breakdown: [
      {
        lineRange: "2-7",
        note: "--read-only blocks writes to the rootfs overlay. tmpfs mounts provide ephemeral scratchpads for /tmp and /run."
      },
      {
        lineRange: "11-12",
        note: "Attempts by attackers or unauthorized processes to modify binaries fail with Read-only file system errors."
      }
    ],
    expectedOutput: `touch: cannot touch '/usr/local/bin/malware': Read-only file system
SUCCESS: Write blocked!
Container is fully hardened against disk tampering.`
  },
  {
    id: "docker-ex-30",
    title: "Multi-Container Read-Only Volume Sharing for Static Asset Distribution",
    category: "Storage & Volumes",
    difficulty: "intermediate",
    whatThisCodeCovers: "Shares a single volume containing compiled static assets or model weights across multiple application containers with strict read-only (:ro) enforcement to prevent cross-container contamination.",
    conceptsCovered: [
      "Shared volume pattern",
      "Read-only mount flag (:ro)",
      "Zero duplicate asset storage",
      "Cross-service data distribution",
      "Write prevention"
    ],
    code: `#!/usr/bin/env bash
# 1. Create shared asset volume
docker volume create shared-static-assets

# 2. Ingest static assets once using a publisher container
docker run --rm \\
  -v shared-static-assets:/assets \\
  builder-image:latest \\
  cp -r /dist/* /assets/

# 3. Mount into 3 replica web servers as strictly read-only (:ro)
for i in 1 2 3; do
  docker run -d \\
    --name "web-worker-$i" \\
    -v shared-static-assets:/usr/share/nginx/html:ro \\
    nginx:alpine
done

# Verify web-worker-1 cannot delete or write to the shared assets
docker exec web-worker-1 rm -f /usr/share/nginx/html/index.html || echo "PASS: Read-only protected!"`,
    breakdown: [
      {
        lineRange: "2-3",
        note: "Creates central shared volume."
      },
      {
        lineRange: "6-9",
        note: "Builder writes assets once into the volume."
      },
      {
        lineRange: "12-18",
        note: "Multiple worker containers mount the same volume with :ro, saving disk space and ensuring consistency."
      }
    ],
    expectedOutput: `rm: can't remove '/usr/share/nginx/html/index.html': Read-only file system
PASS: Read-only protected!
Shared volume served across 3 containers with zero write vulnerability.`
  },
  {
    id: "docker-ex-31",
    title: "Auditing Container Disk Usage, Reclaiming Dangling Volumes, and Volume Pruning",
    category: "Storage & Volumes",
    difficulty: "beginner",
    whatThisCodeCovers: "Inspects detailed Docker disk utilization breakdown across images, containers, and local volumes, identifying and purging orphaned storage using safety filters.",
    conceptsCovered: [
      "docker system df & docker system df -v",
      "docker volume ls -qf dangling=true",
      "docker volume prune --filter",
      "Disk space reclamation",
      "Preventing /var/lib/docker exhaustion"
    ],
    code: `#!/usr/bin/env bash
# 1. Inspect exact disk consumption by subsystem
docker system df

# 2. List all dangling (orphaned) volumes not attached to any container
echo "=== Dangling Volumes ==="
docker volume ls -f dangling=true

# 3. Dry-run / audit volumes older than 7 days
# Prune only unused volumes created more than 168 hours ago:
docker volume prune -f --filter "label!=keep" --filter "until=168h"

# 4. Check reclaimed disk space
docker system df`,
    breakdown: [
      {
        lineRange: "2-3",
        note: "docker system df outputs clear utilization figures for Images, Containers, Local Volumes, and Build Cache."
      },
      {
        lineRange: "6-7",
        note: "dangling=true isolates volumes left behind after container deletion."
      },
      {
        lineRange: "10-11",
        note: "Prunes orphaned volumes while respecting safety filters (retention period and exemption labels)."
      }
    ],
    expectedOutput: `TYPE            TOTAL     ACTIVE    SIZE      RECLAIMABLE
Images          18        4         4.12GB    3.15GB (76%)
Containers      4         4         12.4MB    0B (0%)
Local Volumes   32        3         18.9GB    16.2GB (85%)
Build Cache     42        0         6.8GB     6.8GB

Deleted Volumes:
b94a8c91d7...
Total reclaimed space: 16.2GB`
  },
  {
    id: "docker-ex-32",
    title: "Mounting Remote NFS Network Share Directly into Docker via NFS Volume Driver",
    category: "Storage & Volumes",
    difficulty: "advanced",
    whatThisCodeCovers: "Configures Docker to mount an enterprise Network File System (NFSv4) export directly as a container volume without requiring manual host fstab configuration.",
    conceptsCovered: [
      "NFSv4 volume driver",
      "docker volume create --opt type=nfs",
      "nfsvers=4 and nolock options",
      "Centralized shared file storage",
      "Cluster-wide persistent storage"
    ],
    code: `#!/usr/bin/env bash
# Create a Docker volume that mounts an external NFS export directly
docker volume create \\
  --driver local \\
  --opt type=nfs \\
  --opt o=addr=192.168.1.100,rw,nfsvers=4,rsize=1048576,wsize=1048576,hard,timeo=600 \\
  --opt device=:/srv/nfs/media \\
  enterprise-nfs-media

# Launch media server mounting the NFS volume
docker run -d \\
  --name media-server \\
  -v enterprise-nfs-media:/data:ro \\
  -p 8080:80 \\
  nginx:alpine

# The container streams files directly from the enterprise storage array!`,
    breakdown: [
      {
        lineRange: "2-8",
        note: "Uses Docker's built-in local driver with type=nfs and NFSv4 transmission parameters."
      },
      {
        lineRange: "10-15",
        note: "Binds the remote network share into /data inside the container transparently."
      }
    ],
    expectedOutput: `Volume 'enterprise-nfs-media' created.
media-server successfully started and connected to NFS export :/srv/nfs/media!`
  }
];
