const fs = require('fs');
const path = require('path');

const productionRunbooks = [
  {
    id: "docker-prod-01",
    topic: "Container OOMKilled (Exit Code 137) from Unbounded Memory & JVM/Node Heap Desync",
    category: "Resource Management & Cgroups",
    severity: "Critical / Cascading Process Crash",
    theProblem: "Containers suddenly crash with Exit Code 137 without throwing application exceptions or writing stack traces to application loggers. Runtime runtimes like JVM, Node.js V8, or Python allocate memory based on total physical host RAM rather than the container's cgroup memory quota, causing the Linux kernel Out-Of-Memory (OOM) Killer to abruptly send SIGKILL to the container process.",
    howItWorksInternally: "When a container reaches memory.max (or memory.limit_in_bytes in cgroups v1), the Linux kernel page allocator fails to reclaim anonymous pages. If swap is disabled or exhausted, the kernel invokes mem_cgroup_out_of_memory(). It scores processes within the cgroup and terminates the highest memory consumer with SIGKILL (signal 9, exit code 128 + 9 = 137). In older runtimes (pre-Java 10, pre-Node 12), runtime heuristics query sysconf(_SC_PHYS_PAGES) or /proc/meminfo, detecting 128GB of host RAM instead of the 2GB container limit, causing the heap to expand until kernel SIGKILL terminates it.",
    productionCode: `# 1. Production Dockerfile with Container-Aware Memory Constraints
FROM eclipse-temurin:21-jre-alpine AS runner
WORKDIR /app
COPY app.jar .

# JVM Container ergonomics flags:
# -XX:+UseContainerSupport (Enables cgroup memory auto-detection)
# -XX:MaxRAMPercentage=75.0 (Leaves 25% for Metaspace, threads, off-heap native memory)
# -XX:+ExitOnOutOfMemoryError (Guarantees clean exit instead of hanging in unhandled state)
ENTRYPOINT ["java", \\
  "-XX:+UseContainerSupport", \\
  "-XX:MaxRAMPercentage=75.0", \\
  "-XX:InitialRAMPercentage=50.0", \\
  "-XX:+ExitOnOutOfMemoryError", \\
  "-jar", "app.jar"]

# --- For Node.js deployments ---
# node --max-old-space-size=1536 server.js (for a 2048m cgroup container)

# --- In compose.yaml: Enforce matching cgroup limit and swap constraint ---
# services:
#   backend:
#     image: my-backend:latest
#     deploy:
#       resources:
#         limits:
#           memory: 2048M
#           # Prevent unbounded swap thrashing on host
#           memory-swap: 2048M`,
    monitoringMetrics: [
      "Container termination count with exit code 137 > 0 [Severity: Critical]",
      "cgroup memory.events: oom_kill count > 0 [Severity: Critical]",
      "Container memory utilization (memory.current / memory.max) > 90% [Severity: High]",
      "Kernel log dmesg | grep -i 'killed process' events [Severity: Critical]"
    ],
    productionChecklist: [
      "Set runtime heap constraints (e.g., `-XX:MaxRAMPercentage=75.0` or `--max-old-space-size`) to leave 25% buffer for native allocations.",
      "Always configure `--memory` and `--memory-swap` simultaneously to prevent disk thrashing.",
      "Audit `/proc/sys/vm/overcommit_memory` and cgroup memory limits.",
      "Monitor Prometheus metric `container_memory_working_set_bytes` instead of total memory usage.",
      "Ensure container health checks do not leak memory via child process spawning."
    ]
  },
  {
    id: "docker-prod-02",
    topic: "Zombie Process Accumulation & Host PID Table Exhaustion from Broken PID 1 Reaping",
    category: "Process Lifecycle & Signals",
    severity: "High / Host PID Table Saturation",
    theProblem: "Applications running inside Docker that spawn subshells, child processes, or CLI utilities leave behind thousands of defunct zombie (<defunct>) processes. Over days of operation, the Linux host PID table (/proc/sys/kernel/pid_max) fills completely, preventing new processes from being spawned anywhere across the physical server and freezing host monitoring agents.",
    howItWorksInternally: "In standard Linux, PID 1 (init/systemd) reaps orphaned child processes when their parent terminates by invoking wait() or waitpid(). In Docker, the container entrypoint process is assigned PID 1 in the container's PID namespace. However, standard binaries (like Node.js, Python, or shell wrappers) do not implement child process reaping logic. When child worker processes exit, they transition into a defunct zombie state waiting for their parent to read their exit status. Because PID 1 ignores SIGCHLD, zombies accumulate indefinitely, each holding a slot in the host kernel's global task table.",
    productionCode: `# Option A: Embed lightweight Tini init into Dockerfile (Recommended)
FROM node:20-alpine
RUN apk add --no-cache tini

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Use tini as the PID 1 init process to reap zombies and forward signals
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "worker.js"]

# Option B: Run container with built-in Docker init flag
# docker run -d --name my-worker --init my-image:latest

# Option C: In docker-compose.yaml:
# services:
#   worker:
#     image: my-worker:latest
#     init: true # Docker automatically injects docker-init (tini) as PID 1!`,
    monitoringMetrics: [
      "Host active PID count (/proc/sys/kernel/pid_max) > 80% [Severity: Critical]",
      "Container zombie process count (ps -ef | grep defunct | wc -l) > 5 [Severity: High]",
      "docker exec failures with 'fork: retry: Resource temporarily unavailable' [Severity: Critical]",
      "Kernel task struct allocation errors [Severity: High]"
    ],
    productionChecklist: [
      "Add `init: true` in docker-compose.yaml or `--init` flag in `docker run`.",
      "Embed `/sbin/tini` or `gosu` in base Dockerfiles when running sub-process heavy tools.",
      "Configure `--pids-limit` (e.g. `--pids-limit 1000`) on all containers to isolate PID exhaustion.",
      "Never use shell script wrapper entrypoints without `exec \"$@\"` replacing the subshell PID.",
      "Audit application child process code to ensure `child_process.on('close')` is handled."
    ]
  },
  {
    id: "docker-prod-03",
    topic: "BuildKit Cache Busting & CI Pipeline Freezes from Non-Deterministic Timestamps & Commands",
    category: "Image Optimization & BuildKit",
    severity: "Medium / CI Delivery Pipeline Bottleneck",
    theProblem: "Docker builds in CI/CD environments take 15 to 30 minutes on every commit instead of 30 seconds. Developers accidentally bust the layer cache on early Dockerfile lines by copying entire repositories, running non-deterministic package updates (apt-get upgrade), or using volatile build arguments, resulting in GBs of duplicate layer transfers and massive registry storage inflation.",
    howItWorksInternally: "BuildKit creates a directed acyclic graph (LLB DAG) of build steps. Each instruction's cache key is a SHA256 hash computed from: the parent layer hash, the instruction string, and (for ADD/COPY) the checksum of the content being injected. If ANY file copied in an early layer changes (such as a local .git directory or README), BuildKit invalidates that step and every subsequent step in the DAG. Commands like RUN apt-get upgrade also invalidate caching because upstream package manifests change dynamically.",
    productionCode: `# 1. Mandatory .dockerignore to eliminate volatile files from build context
# --- .dockerignore ---
# **/.git
# **/.github
# **/node_modules
# **/dist
# **/build
# **/.env*
# **/*.log
# **/*.md

# 2. Hardened Cache-Optimized Dockerfile
# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS builder
WORKDIR /app

# Cache Layer 1: Copy ONLY dependency manifests first
COPY package.json package-lock.json ./

# Cache Layer 2: Utilize BuildKit persistent cache mounts across CI runners
RUN --mount=type=cache,target=/root/.npm \\
    npm ci --prefer-offline

# Cache Layer 3: Copy source code ONLY after dependencies are locked
COPY tsconfig.json ./
COPY src/ ./src/

# Compile application
RUN npm run build

# Production runtime stage
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
USER node
CMD ["node", "dist/index.js"]`,
    monitoringMetrics: [
      "CI/CD Docker build duration > 180s [Severity: High]",
      "Docker layer cache miss rate in CI pipelines > 20% [Severity: Medium]",
      "Local build context size > 100MB [Severity: High]",
      "Container registry storage growth rate > 50GB/week [Severity: Medium]"
    ],
    productionChecklist: [
      "Maintain a strict `.dockerignore` file excluding `.git`, `node_modules`, and local build artifacts.",
      "Copy dependency definitions (`package.json`, `go.mod`, `pom.xml`) before copying source trees.",
      "Use `RUN --mount=type=cache,target=...` to preserve package manager caches across builds.",
      "Use BuildKit remote cache backends (`--cache-to type=registry` and `--cache-from type=registry`).",
      "Never run `apt-get upgrade` or `apk update` without freezing package versions."
    ]
  },
  {
    id: "docker-prod-04",
    topic: "Root Daemon Privilege Escalation & Host Compromise via Unrestricted `/var/run/docker.sock` Mounts",
    category: "Security & Hardening",
    severity: "Critical / Full Host Compromise",
    theProblem: "Mounting the host's `/var/run/docker.sock` into application containers (often done for CI agents, monitoring tools, or container managers) grants the container process root-equivalent privileges on the host kernel. An attacker who compromises the container via SQL injection or RCE can escape the container immediately, mount the host's `/` root partition, and obtain full host root takeover.",
    howItWorksInternally: "The Docker daemon runs as root (UID 0) in the host's initial namespace. Any process with write access to the UNIX socket `/var/run/docker.sock` can issue Docker REST API commands. An attacker inside the container issues `docker run -v /:/host_root alpine chroot /host_root` to execute commands directly on the host operating system, effectively rendering all cgroups, namespaces, and AppArmor profiles completely useless.",
    productionCode: `#!/usr/bin/env bash
# VULNERABLE PATTERN TO AVOID:
# docker run -v /var/run/docker.sock:/var/run/docker.sock my-app (LETHAL PRIVILEGE ESCALATION!)

# PRODUCTION SAFEGUARD 1: Use docker-socket-proxy to restrict API endpoints
# docker-socket-proxy exposes an HAProxy proxy that allows ONLY read-only GET requests:
cat << 'EOF' > compose.socket-proxy.yaml
services:
  docker-proxy:
    image: tecnativa/docker-socket-proxy:latest
    environment:
      # Block all mutating and container creation endpoints
      CONTAINERS: 1
      POST: 0
      DELETE: 0
      BUILD: 0
      EXEC: 0
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - monitor-net

  monitoring-agent:
    image: datadog/agent:latest
    environment:
      - DOCKER_HOST=tcp://docker-proxy:2375
    networks:
      - monitor-net
    depends_on:
      - docker-proxy

networks:
  monitor-net:
    internal: true
EOF

# PRODUCTION SAFEGUARD 2: Rootless Docker
# Run Docker daemon entirely inside unprivileged user namespace:
# dockerd-rootless-setuptool.sh install`,
    monitoringMetrics: [
      "Container mounts containing /var/run/docker.sock detected > 0 [Severity: Critical]",
      "Auditd host events: docker.sock write syscalls from non-whitelisted PIDs [Severity: Critical]",
      "Containers running with privileged: true or hostPid: true [Severity: Critical]",
      "Host filesystem mounts (-v /:/...) detected in Docker events [Severity: Critical]"
    ],
    productionChecklist: [
      "Never mount `/var/run/docker.sock` into untrusted or public-facing application containers.",
      "Use `docker-socket-proxy` to enforce granular read-only REST API access for monitoring agents.",
      "Deploy Docker in Rootless Mode (`rootlesskit`) so daemon compromise cannot yield host root.",
      "Enforce Falco or AppArmor security policies that block execution of Docker CLI inside containers.",
      "Use Kaniko or Buildah instead of DinD or mounted sockets for CI container builds."
    ]
  },
  {
    id: "docker-prod-05",
    topic: "Overlay2 Storage Exhaustion & Inode Starvation from Dangling Layers & Unrotated Container Logs",
    category: "Storage & OverlayFS",
    severity: "Critical / Host Disk Lockup",
    theProblem: "Docker hosts suddenly experience 100% disk utilization or 100% inode exhaustion in `/var/lib/docker/overlay2`, causing the Docker daemon to lock up, existing containers to fail on writes with `No space left on device`, and Kubernetes nodes to enter `DiskPressure` eviction storms.",
    howItWorksInternally: "Overlay2 stores container layers and diffs inside `/var/lib/docker/overlay2`. If containers write heavy logs to stdout/stderr and no log rotation is configured, Docker's default `json-file` driver writes unbounded single files on the host filesystem until disk capacity hits 100%. Furthermore, containers that generate millions of small temporary files without cleanup exhaust filesystem inodes (`df -i`) even when raw gigabyte capacity is still available.",
    productionCode: `# 1. Global Host Log Rotation Policy in /etc/docker/daemon.json
# Automatically clamps all container logs to max 150MB total per container
cat << 'EOF' | sudo tee /etc/docker/daemon.json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "3",
    "mode": "non-blocking",
    "max-buffer-size": "4m"
  },
  "storage-driver": "overlay2"
}
EOF
sudo systemctl reload docker

# 2. Automated Disk & Inode Audit Script for Crontab
cat << 'EOF' > /usr/local/bin/docker-storage-monitor.sh
#!/usr/bin/env bash
set -euo pipefail

DISK_USAGE=$(df -P /var/lib/docker | awk 'NR==2 {gsub("%",""); print $5}')
INODE_USAGE=$(df -Pi /var/lib/docker | awk 'NR==2 {gsub("%",""); print $5}')

if [ "$DISK_USAGE" -gt 85 ] || [ "$INODE_USAGE" -gt 85 ]; then
  echo "CRITICAL: Docker storage pressure! Disk: \${DISK_USAGE}%, Inodes: \${INODE_USAGE}%"
  # Clean dangling images, stopped containers older than 48h, and unused build cache
  docker system prune -f --filter "until=48h"
  docker volume prune -f
fi
EOF
chmod +x /usr/local/bin/docker-storage-monitor.sh`,
    monitoringMetrics: [
      "/var/lib/docker disk utilization percentage > 80% [Severity: High], > 90% [Severity: Critical]",
      "/var/lib/docker inode utilization percentage (`df -i`) > 85% [Severity: Critical]",
      "Docker log file size on host filesystem > 500MB [Severity: High]",
      "Kubernetes Node condition `DiskPressure = True` [Severity: Critical]"
    ],
    productionChecklist: [
      "Configure global `max-size` and `max-file` in `/etc/docker/daemon.json`.",
      "Partition `/var/lib/docker` onto a dedicated high-speed disk partition to protect host OS root.",
      "Enforce tmpfs mounts for high-volume temporary directories (`/tmp`, `/cache`).",
      "Regularly prune dangling build cache (`docker builder prune`) and stopped containers in CI workers.",
      "Monitor both disk byte capacity (`df -h`) and inode allocation (`df -i`)."
    ]
  },
  {
    id: "docker-prod-06",
    topic: "Cascading Startup Failures & Distributed Deadlocks from Unordered Microservice Boot Sequences",
    category: "Docker Compose & Orchestration",
    difficulty: "High / Service Boot Crash Loops",
    severity: "High / Boot Failure Crash Loop",
    theProblem: "When spinning up a multi-container stack with Docker Compose or orchestrators, API and backend services crash immediately with database connection refused errors. Naive depends_on declarations only wait for the database container to create its process, not for the database engine to finish WAL recovery and listen on the TCP port.",
    howItWorksInternally: "By default, Docker Compose depends_on only checks if the target container process has been started (created state). PostgreSQL, MySQL, and Redis take 5-15 seconds to allocate shared memory, initialize transaction logs, and bind their network sockets. If dependent microservices boot instantly and lack exponential backoff connection retries, they fail fast and exit with code 1. If restart: always is configured, the container enters a rapid crash-backoff loop, overloading the host scheduler.",
    productionCode: `services:
  database:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: appdb
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: secretpassword
    # Robust healthcheck testing actual query execution
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d appdb && psql -U postgres -d appdb -c 'SELECT 1;'"]
      interval: 4s
      timeout: 3s
      retries: 5
      start_period: 10s

  redis:
    image: redis:7.2-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 3s
      timeout: 2s
      retries: 3

  # Migrator executes schema updates once and completes
  migrator:
    image: enterprise/api:latest
    command: ["npm", "run", "db:migrate"]
    depends_on:
      database:
        condition: service_healthy

  # Core API service only starts when DB is healthy AND migrations succeeded
  api:
    image: enterprise/api:latest
    command: ["npm", "start"]
    ports:
      - "8080:8080"
    depends_on:
      database:
        condition: service_healthy
      redis:
        condition: service_healthy
      migrator:
        condition: service_completed_successfully`,
    monitoringMetrics: [
      "Container crash loop count (restarts > 5 within 2 minutes) [Severity: Critical]",
      "Startup database connection failure rate during stack boot [Severity: High]",
      "Healthcheck transition from starting to unhealthy [Severity: High]",
      "Time taken for all stack services to reach healthy status > 45s [Severity: Medium]"
    ],
    productionChecklist: [
      "Use `condition: service_healthy` instead of simple `depends_on` lists in Compose.",
      "Implement `condition: service_completed_successfully` for one-shot database migration jobs.",
      "Configure `start_period` on healthchecks to allow database buffers and caches to warm up.",
      "Build exponential backoff and connection retry loops into application database drivers.",
      "Test complete cold-start boot sequence (`docker compose down -v && docker compose up`) in CI."
    ]
  },
  {
    id: "docker-prod-07",
    topic: "iptables DNAT Forwarding Bypassing Host UFW / Firewalld Firewalls (Public Exposure)",
    category: "Networking & Security",
    severity: "Critical / Unintended Public Data Exposure",
    theProblem: "Security administrators configure UFW (Uncomplicated Firewall) on Ubuntu to block port 5432 or 6379 from the public internet. However, when Docker runs a container with `-p 5432:5432`, the database port becomes accessible to the entire public internet, completely bypassing all UFW firewall rules and exposing sensitive data.",
    howItWorksInternally: "Docker manipulates Linux iptables directly, injecting PREROUTING rules into the nat table and forwarding rules into the FORWARD filter chain. UFW configures the INPUT chain. When incoming packets arrive from external network interfaces, the Linux kernel processes the PREROUTING nat table first, rewrites the destination IP to the container's virtual bridge IP, and routes the packet through the FORWARD chain. Because UFW rules reside in INPUT, the incoming packets bypass UFW entirely.",
    productionCode: `#!/usr/bin/env bash
# REMEDY 1: Bind published ports explicitly to host loopback interface (Recommended)
# Never expose ports to 0.0.0.0 unless intended for public ingress!
docker run -d \\
  --name secure-postgres \\
  -p 127.0.0.1:5432:5432 \\
  -e POSTGRES_PASSWORD=secret \\
  postgres:16-alpine

# REMEDY 2: Configure DOCKER-USER chain in iptables for firewall integration
# The DOCKER-USER chain is evaluated BEFORE Docker's own FORWARD rules.
# Add these rules to /etc/ufw/after.rules or iptables startup script:

# Drop all incoming external traffic to container ports by default
sudo iptables -I DOCKER-USER -i eth0 -j DROP

# Allow established/related return traffic
sudo iptables -I DOCKER-USER -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT

# Explicitly whitelist trusted VPN / office subnet for access to container port 5432
sudo iptables -I DOCKER-USER -i eth0 -s 10.8.0.0/16 -p tcp --dport 5432 -j ACCEPT

# Verify rules are in place:
sudo iptables -L DOCKER-USER -v -n`,
    monitoringMetrics: [
      "External connection attempts accepted on non-public ports [Severity: Critical]",
      "Audit of containers bound to 0.0.0.0 instead of 127.0.0.1 [Severity: High]",
      "iptables DOCKER-USER chain rule evaluation counters [Severity: Medium]",
      "Port scanner (Nmap) alerts on public database ports [Severity: Critical]"
    ],
    productionChecklist: [
      "Always publish ports with explicit host IPs: `-p 127.0.0.1:8080:8080` instead of `-p 8080:8080`.",
      "Use reverse proxies (Nginx, Traefik, Caddy) as the sole entrypoint bound to public interfaces.",
      "Configure the `DOCKER-USER` iptables chain to enforce network ACLs before Docker NAT.",
      "Disable Docker iptables auto-manipulation (`\"iptables\": false` in `daemon.json`) only if managing routing manually.",
      "Run automated external port scans against production host public IPs in CI/CD."
    ]
  },
  {
    id: "docker-prod-08",
    topic: "Host Volume Permission Denied (`EACCES`) Caused by Host-Container UID/GID Desynchronization",
    category: "Storage & Permissions",
    severity: "High / Application Write Failure",
    theProblem: "When containers mount host directories (`-v /var/data:/data` or bind mounts in development), application processes fail immediately with `EACCES: permission denied` when attempting to write files, create logs, or initialize databases.",
    howItWorksInternally: "Linux file permissions are enforced by numeric UID (User ID) and GID (Group ID), not usernames. Inside a container, a non-root user like `node` or `appuser` typically has UID 1000. However, on the host machine, the mounted folder may be owned by root (UID 0), deploy (UID 1001), or another user. When the container's unprivileged process requests a write syscall, the host kernel checks the inode owner against the process UID. Because UID 1000 does not match UID 0 or host group ownership, the kernel returns EACCES.",
    productionCode: `# Solution: Adaptive Container Entrypoint with Dynamic Step-Down
# Dockerfile:
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends gosu \\
    && rm -rf /var/lib/apt/lists/*

RUN groupadd -g 1000 appgroup && \\
    useradd -u 1000 -g appgroup -m appuser

COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "server.js"]

# --- content of entrypoint.sh ---
# #!/bin/sh
# set -e
# TARGET_UID=\${LOCAL_UID:-1000}
# TARGET_GID=\${LOCAL_GID:-1000}
# 
# # Align container user with host UID/GID if provided
# if [ "$TARGET_UID" != "$(id -u appuser)" ]; then
#     usermod -o -u "$TARGET_UID" appuser
#     groupmod -o -g "$TARGET_GID" appgroup
# fi
# 
# # Ensure directory ownership matches the runtime user
# chown -R appuser:appgroup /data
# 
# # Execute CMD as unprivileged user via gosu
# exec gosu appuser "$@"`,
    monitoringMetrics: [
      "Application filesystem write error rate (`EACCES`) > 0 [Severity: Critical]",
      "Failed container startup events related to directory initialization [Severity: High]",
      "Audit of containers running as root to bypass permission errors [Severity: High]"
    ],
    productionChecklist: [
      "Use `gosu` in entrypoint scripts to dynamically reconcile host UID/GID before dropping privileges.",
      "Never chmod 777 host directories as a workaround for UID mismatches.",
      "Use Docker named volumes instead of host bind mounts for database files in production.",
      "Pass `--user $(id -u):$(id -g)` during local CLI runs where dynamic entrypoints are unavailable.",
      "Verify permissions on created files from both host and container perspectives."
    ]
  },
  {
    id: "docker-prod-09",
    topic: "Container Stdout Buffer Deadlock in Blocking Logging Drivers Freezing Application Threads",
    category: "Observability & Logging",
    severity: "Critical / Unresponsive Application Freezes",
    theProblem: "High-throughput APIs suddenly stop processing incoming HTTP requests. Process CPU drops to near 0%, threads appear stuck in `write()` syscalls, and the application becomes completely unresponsive, even though memory and database connections are healthy.",
    howItWorksInternally: "Docker captures standard output and standard error from container processes via Linux pipes (`fifo`). By default, Docker's logging driver operates in blocking mode (`mode: blocking`). If the logging driver buffer fills up (e.g. during heavy log bursts or when disk I/O bottlenecks while writing to disk or forwarding to a remote syslog/fluentd daemon), the kernel write buffer fills to capacity. Subsequent `console.log()` or `printf()` calls in the application block synchronously waiting for buffer space, freezing the Node.js event loop or worker threads entirely.",
    productionCode: `# Remedy: Configure Non-Blocking Ring Buffer Logging

# 1. Global configuration in /etc/docker/daemon.json:
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "50m",
    "max-file": "5",
    "mode": "non-blocking",
    "max-buffer-size": "8m"
  }
}

# 2. Per-service configuration in docker-compose.yaml:
services:
  api:
    image: enterprise/api:v1
    logging:
      driver: "json-file"
      options:
        max-size: "20m"
        max-file: "3"
        mode: "non-blocking"
        max-buffer-size: "4m"`,
    monitoringMetrics: [
      "Docker daemon log buffer drop counters (`dropped_logs`) > 0 [Severity: Medium]",
      "Application request latency spikes correlating with high log write volume [Severity: High]",
      "Processes blocked in uninterruptible sleep state (D-state) during I/O spikes [Severity: Critical]"
    ],
    productionChecklist: [
      "Configure `mode: \"non-blocking\"` globally in `/etc/docker/daemon.json`.",
      "Allocate a reasonable `max-buffer-size` (e.g. 4m to 16m) for burst absorption.",
      "Use structured JSON logging and throttle verbose debug logs in production environments.",
      "Monitor disk I/O latency (`iostat -x`) on the storage device hosting `/var/lib/docker`.",
      "Consider using an out-of-process log collector (Promtail, Vector) scraping log files asynchronously."
    ]
  },
  {
    id: "docker-prod-10",
    topic: "Multi-Arch Cross-Compilation Segmentation Faults & Slowdowns in QEMU Emulation",
    category: "Multi-Architecture & Buildx",
    severity: "High / CI Build Failures & Corrupt Binaries",
    theProblem: "Building ARM64 (aarch64) container images on x86_64 CI servers using QEMU emulation results in builds that take 10x longer, crash with unexplained `Segmentation fault (core dumped)` errors during Node.js/Python dependency compilation, or produce corrupted binary outputs.",
    howItWorksInternally: "When using `docker buildx` with `--platform linux/amd64,linux/arm64`, BuildKit relies on QEMU user-mode emulation (`binfmt_misc`) to translate ARM instructions into x86 instructions on the fly. QEMU does not achieve 100% fidelity for complex JIT compilers (V8, Rust, Go CGO, JVM) and thread-locking primitives. Under high concurrency, QEMU's memory model translation causes race conditions, leading to random segmentation faults and massive CPU emulation penalties.",
    productionCode: `# Solution: Multi-Platform Cross-Compilation with Native Builders
# Instead of slow QEMU emulation, attach remote native builders to Buildx:

# 1. Initialize custom Buildx builder
docker buildx create --name enterprise-cluster --use

# 2. Add native ARM64 worker node (e.g. AWS Graviton instance)
docker buildx create --name enterprise-cluster \\
  --append \\
  --node arm64-node \\
  --platform linux/arm64 \\
  ssh://ubuntu@arm64-builder.internal

# 3. Add native AMD64 worker node
docker buildx create --name enterprise-cluster \\
  --append \\
  --node amd64-node \\
  --platform linux/amd64 \\
  ssh://ubuntu@amd64-builder.internal

# 4. Build executes natively on both architectures with zero QEMU emulation!
docker buildx build \\
  --builder enterprise-cluster \\
  --platform linux/amd64,linux/arm64 \\
  -t my-registry.internal/app:v1.0 \\
  --push .`,
    monitoringMetrics: [
      "Cross-platform build step failure rate due to SIGSEGV [Severity: Critical]",
      "Multi-arch build execution duration compared to native baseline [Severity: High]",
      "QEMU binfmt translation error logs in host dmesg [Severity: Medium]"
    ],
    productionChecklist: [
      "Use native ARM64 runners (e.g., AWS Graviton, GitHub Actions ARM runners) instead of QEMU emulation.",
      "Use Go/Rust native cross-compilers (`GOARCH=arm64`, `cargo --target aarch64-...`) in builder stages.",
      "Pin QEMU binfmt helper to tested versions (`tonistiigi/binfmt:qemu-v7.0.0-28`).",
      "Avoid running memory-intensive compilation steps inside QEMU emulated containers.",
      "Verify image manifest lists using `docker buildx imagetools inspect` after pushing."
    ]
  },
  {
    id: "docker-prod-11",
    topic: "Docker-in-Docker (DinD) Storage Driver Overlay-on-Overlay Filesystem Deadlocks & Corruption",
    category: "Container Runtimes & CI/CD",
    severity: "Critical / CI Runner Filesystem Corruption",
    theProblem: "Running Docker inside Docker (DinD) in GitLab CI, Jenkins, or GitHub Actions runners causes mysterious filesystem corruption, `failed to mount overlay: invalid argument` errors, and frozen build jobs that require hard runner reboots.",
    howItWorksInternally: "When a containerized Docker daemon (DinD) uses the `overlay2` storage driver while its own rootfs is already backed by the host's `overlay2` filesystem, Linux kernel restrictions against nesting OverlayFS instances trigger unexpected behavior. Older kernels completely disallow mounting overlay on top of overlay. Even on modern kernels, layer reference counting and whiteout file handling (`character device 0,0`) can lead to kernel deadlocks and filesystem corruption under parallel build loads.",
    productionCode: `# Solution 1: Use Kaniko or Buildah for Daemonless CI Container Builds (Recommended)
# No privileged mode, no nested Docker daemon, no socket mounts!

# Example GitLab CI / Kubernetes build step with Kaniko:
# /kaniko/executor \\
#   --context dir://. \\
#   --dockerfile Dockerfile \\
#   --destination my-registry.internal/my-image:latest \\
#   --cache=true

# Solution 2: If DinD is strictly required, use dedicated volume for inner /var/lib/docker
# This ensures inner overlay2 mounts on a native block filesystem rather than an outer overlayfs:
cat << 'EOF' > compose.dind.yaml
services:
  dind-runner:
    image: docker:26-dind
    privileged: true
    environment:
      DOCKER_TLS_CERTDIR: /certs
    volumes:
      # Outer volume ensures inner dockerd writes directly to ext4/xfs block device!
      - dind-storage:/var/lib/docker
      - dind-certs:/certs
    networks:
      - ci-net

volumes:
  dind-storage:
  dind-certs:

networks:
  ci-net:
EOF`,
    monitoringMetrics: [
      "DinD container mount failure rate with 'invalid argument' [Severity: Critical]",
      "Kernel dmesg overlayfs bug/warning call traces [Severity: Critical]",
      "CI runner build timeout rate on container export steps [Severity: High]"
    ],
    productionChecklist: [
      "Replace DinD with rootless, daemonless builders (Kaniko, Buildah) in production CI pipelines.",
      "Mount a dedicated named volume or host directory onto `/var/lib/docker` inside DinD containers.",
      "Never run nested `dockerd` directly on top of an unmounted container layer.",
      "Ensure host kernel version is 5.15+ if nested overlay mounts are utilized.",
      "Audit CI agents for unneeded `--privileged` flags."
    ]
  },
  {
    id: "docker-prod-12",
    topic: "Embedded DNS (`127.0.0.11`) Resolution Timeouts in High-Throughput Microservice Meshes",
    category: "Networking & DNS",
    severity: "High / Sporadic 5-Second Request Latency",
    theProblem: "Microservices communicating via user-defined bridge networks experience sporadic 5-second connection delays. Applications making rapid outbound HTTP, gRPC, or database calls intermittently fail with `getaddrinfo EAI_AGAIN` or DNS query timeouts.",
    howItWorksInternally: "Docker runs an embedded DNS resolver at `127.0.0.11` for containers attached to user-defined networks. Internal iptables DNAT rules route UDP/TCP port 53 traffic from the container to Docker's internal libnetwork DNS server. Under heavy concurrent query volumes (or when glibc makes simultaneous IPv4 `A` and IPv6 `AAAA` queries over UDP), Linux connection tracking (`conntrack`) suffers race conditions, causing one of the UDP responses to be silently dropped. The standard glibc resolver timeout fallback is exactly 5 seconds.",
    productionCode: `# Solution: Implement DNS Caching Sidecar & Optimize Resolver Options

# 1. Inject hardened resolv.conf options in Dockerfile or container flags
# - options single-request: Serializes A and AAAA queries to prevent conntrack race
# - options timeout:1 attempts:2: Slashes DNS timeout penalty from 5s to 1s
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Configure DNS options in entrypoint or compose
# In compose.yaml:
# services:
#   api:
#     image: enterprise/api:latest
#     dns_opt:
#       - "single-request"
#       - "timeout:1"
#       - "attempts:2"
#       - "ndots:1" # Prevents recursive search domain expansion

# 2. Deploy lightweight dnsmasq / CoreDNS caching proxy for massive microservice meshes
# services:
#   dns-cache:
#     image: strm/dnsmasq:latest
#     volumes:
#       - ./dnsmasq.conf:/etc/dnsmasq.conf:ro
#     networks:
#       - mesh-net`,
    monitoringMetrics: [
      "DNS resolution failure rate (`EAI_AGAIN`, `SERVFAIL`) > 0.05% [Severity: High]",
      "p99 HTTP request duration spikes clustered around 5000ms [Severity: Critical]",
      "Host kernel conntrack table drops and insert failures [Severity: High]"
    ],
    productionChecklist: [
      "Add `single-request` and `timeout:1` to container DNS options via `dns_opt` in Compose.",
      "Set `ndots:1` to prevent unnecessary recursive search queries on internal service names.",
      "Deploy local DNS caching proxies (CoreDNS, dnsmasq) in high-throughput microservice environments.",
      "Tune host conntrack limits (`sysctl -w net.netfilter.nf_conntrack_max=...`) under heavy loads.",
      "Use persistent keep-alive connection pooling in HTTP and database clients to avoid repeated DNS lookups."
    ]
  },
  {
    id: "docker-prod-13",
    topic: "SIGTERM Signal Drop & Abrupt SIGKILL Termination during Container Teardown",
    category: "Process Lifecycle & Graceful Shutdown",
    severity: "Critical / Data Corruption & Dropped Requests",
    theProblem: "When stopping containers (`docker stop` or orchestrator rolling updates), containers take exactly 10 seconds to terminate and exit with code 137. In-flight database transactions are abruptly aborted, HTTP connections are dropped, and shutdown hooks never execute.",
    howItWorksInternally: "`docker stop` sends `SIGTERM` to PID 1 inside the container, waits for a grace period (default 10 seconds), and if the process has not exited, forcefully terminates it with `SIGKILL` (signal 9, exit code 128 + 9 = 137). When a Dockerfile uses the shell form `CMD npm start` or `ENTRYPOINT ./start.sh`, the Linux shell `/bin/sh -c` runs as PID 1. Standard shells do not forward signals to child processes. As a result, the application running as PID 2 never receives `SIGTERM`, ignores the shutdown request, and is ungracefully killed 10 seconds later.",
    productionCode: `# BAD PATTERN (Shell Form - Breaks Signal Forwarding):
# CMD npm start  <-- Spawns /bin/sh -c 'npm start'; signals are trapped by /bin/sh!

# GOOD PATTERN 1: Exec Form (Direct Execution as PID 1)
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Exec form uses JSON array syntax:
CMD ["node", "server.js"]

# --- Inside server.js: Handle SIGTERM cleanly ---
# const server = app.listen(3000);
# process.on('SIGTERM', () => {
#   console.log('SIGTERM received. Closing HTTP server...');
#   server.close(() => {
#     console.log('HTTP connections drained. Closing DB pools...');
#     db.end().then(() => process.exit(0));
#   });
# });

# GOOD PATTERN 2: If using a shell script, use 'exec' to replace shell PID:
# --- entrypoint.sh ---
# #!/bin/sh
# # Do setup work here
# exec "$@" # Replaces the shell with the target process on PID 1!`,
    monitoringMetrics: [
      "Container shutdown duration clustering at exactly 10.0 seconds [Severity: High]",
      "Container exit code distribution: ratio of exit code 137 on stop > 1% [Severity: Critical]",
      "Database incomplete transaction rollbacks during container deployment rollouts [Severity: High]"
    ],
    productionChecklist: [
      "Always use JSON array exec form: `CMD [\"node\", \"server.js\"]` instead of string shell form.",
      "Ensure all entrypoint shell scripts end with `exec \"$@\"` to transfer PID 1.",
      "Register explicit `SIGTERM` and `SIGINT` handlers in application code to drain connections.",
      "Adjust `stop_grace_period` in Compose or `--stop-timeout` if applications require more than 10s to drain.",
      "Verify clean shutdown by executing `docker stop` and confirming exit code 0."
    ]
  },
  {
    id: "docker-prod-14",
    topic: "Secret Leakage into World-Readable Image History via Intermediate Layers & Build Arguments",
    category: "Supply Chain & Security",
    severity: "Critical / Stolen Production Credentials",
    theProblem: "Private GitHub tokens, AWS keys, database passwords, or private SSH keys used during container builds are permanently exposed in production images. Anyone with read access to the image registry can run `docker history --no-trunc` or inspect image layers to extract plaintext credentials.",
    howItWorksInternally: "Docker images are immutable stacks of tarball layers. If an image layer creates a file containing a secret, running `RUN rm /tmp/secret.key` in a subsequent line does NOT remove the secret from the underlying layer blob; it merely records a whiteout marker in the top layer. Furthermore, values passed to `ARG` instructions are permanently recorded in the image's config JSON metadata under `container_config.Env` and `history`, making `docker inspect` an open credential book.",
    productionCode: `# VULNERABLE PATTERN TO AVOID:
# ARG GITHUB_TOKEN  <-- LEAKS INTO METADATA!
# COPY .npmrc /root/.npmrc
# RUN npm install && rm /root/.npmrc  <-- LEAKS INTO LAYER HISTORY!

# PRODUCTION REMEDY: BuildKit Secret Mounts (Tmpfs in RAM)
# syntax=docker/dockerfile:1.7
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./

# Mount secret temporarily during RUN; never persisted in any layer or metadata!
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc \\
    --mount=type=cache,target=/root/.npm \\
    npm ci

COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
USER node
CMD ["node", "dist/index.js"]

# Build invocation command:
# docker build --secret id=npmrc,src=/home/deploy/.npmrc.private -t enterprise-app:v1 .`,
    monitoringMetrics: [
      "Container image scanner secret detection alerts (Trivy, Gitleaks, Docker Scout) > 0 [Severity: Critical]",
      "Presence of sensitive keywords ('token', 'password', 'api_key') in `docker history` [Severity: High]",
      "Audit of base images and external layer dependencies for exposed secrets [Severity: High]"
    ],
    productionChecklist: [
      "Use BuildKit `--mount=type=secret` instead of `ARG` or `ENV` for build-time credentials.",
      "Use BuildKit `--mount=type=ssh` for private Git cloning to avoid embedding private keys.",
      "Run automated secret scanners (`trivy image --security-checks secret`) on every build in CI.",
      "Always inspect completed images with `docker history --no-trunc <image>` before pushing to registries.",
      "Rotate immediately any credentials that were ever embedded into intermediate image layers."
    ]
  }
];

const outputPath = path.join(__dirname, '../data/docker.production.json');
fs.writeFileSync(outputPath, JSON.stringify(productionRunbooks, null, 2), 'utf-8');
console.log(`Successfully wrote ${productionRunbooks.length} production runbooks to ${outputPath}`);
