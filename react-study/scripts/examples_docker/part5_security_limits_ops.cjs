module.exports = [
  {
    id: "docker-ex-43",
    title: "Dropping All Linux Capabilities (--cap-drop=ALL) and Restoring NET_BIND_SERVICE",
    category: "Security, Hardening & Ops",
    difficulty: "advanced",
    whatThisCodeCovers: "Hardens a container by dropping all default Linux kernel capabilities and adding back only the specific capability required to bind low ports (< 1024), stripping file ownership modification and raw socket access.",
    conceptsCovered: [
      "--cap-drop=ALL",
      "--cap-add=NET_BIND_SERVICE",
      "Principle of Least Privilege (PoLP)",
      "Linux capabilities inspection (capsh)",
      "Privilege escalation mitigation"
    ],
    code: `#!/usr/bin/env bash
# Run web server stripping ALL kernel capabilities except the ability to bind port 80:
docker run -d \\
  --name minimal-cap-nginx \\
  --cap-drop=ALL \\
  --cap-add=NET_BIND_SERVICE \\
  -p 80:80 \\
  nginx:alpine

# Verify capabilities inside the container using getpcaps or capsh
CONTAINER_PID=$(docker inspect --format '{{.State.Pid}}' minimal-cap-nginx)
echo "=== Effective Capabilities of PID $CONTAINER_PID ==="
grep Cap /proc/\${CONTAINER_PID}/status

# Verify privilege restriction (Attempting chown fails even as root!):
docker exec minimal-cap-nginx chown 1000 /etc/hosts || echo "PASS: Capability CAP_CHOWN is absent!"`,
    breakdown: [
      {
        lineRange: "3-8",
        note: "--cap-drop=ALL revokes 14 default root capabilities including CHOWN, FOWNER, KILL, MKNOD, and NET_RAW."
      },
      {
        lineRange: "5",
        note: "--cap-add=NET_BIND_SERVICE is the single capability granted so the process can listen on port 80."
      },
      {
        lineRange: "15-16",
        note: "Even with root UID 0, attempts to change file ownership fail because the kernel capability is missing."
      }
    ],
    expectedOutput: `=== Effective Capabilities of PID 14902 ===
CapInh: 0000000000000000
CapPrm: 0000000000000400 (NET_BIND_SERVICE only)
CapEff: 0000000000000400
chown: changing ownership of '/etc/hosts': Operation not permitted
PASS: Capability CAP_CHOWN is absent!`
  },
  {
    id: "docker-ex-44",
    title: "Enforcing a Custom Seccomp JSON Profile Blocking Risky System Calls",
    category: "Security, Hardening & Ops",
    difficulty: "advanced",
    whatThisCodeCovers: "Applies a custom Seccomp (Secure Computing Mode) profile to block dangerous system calls (such as ptrace, reboot, and keyctl) from reaching the host Linux kernel.",
    conceptsCovered: [
      "--security-opt seccomp=profile.json",
      "Seccomp default actions (SCMP_ACT_ERRNO)",
      "Syscall filtering",
      "Blocking ptrace and kernel exploits",
      "Kernel protection"
    ],
    code: `# Create a tightened seccomp profile blocking ptrace and sys_chroot
cat << 'EOF' > hardened-seccomp.json
{
  "defaultAction": "SCMP_ACT_ALLOW",
  "architectures": ["SCMP_ARCH_X86_64", "SCMP_ARCH_AARCH64"],
  "syscalls": [
    {
      "names": ["ptrace", "sys_chroot", "personality", "reboot"],
      "action": "SCMP_ACT_ERRNO"
    }
  ]
}
EOF

# Launch container with the custom Seccomp profile
docker run --rm -it \\
  --security-opt seccomp=hardened-seccomp.json \\
  alpine:3.20 \\
  sh -c "strace ls 2>&1 || echo 'Seccomp blocked ptrace successfully!'"`,
    breakdown: [
      {
        lineRange: "2-12",
        note: "Defines Seccomp profile: allows general calls but returns errno (EPERM) whenever ptrace or reboot is invoked."
      },
      {
        lineRange: "15-19",
        note: "Launches Alpine with the profile; strace (which relies on ptrace) is blocked immediately by the kernel."
      }
    ],
    expectedOutput: `strace: ptrace(PTRACE_TRACEME, ...): Operation not permitted
Seccomp blocked ptrace successfully!
Zero kernel debug tampering allowed.`
  },
  {
    id: "docker-ex-45",
    title: "Enforcing Hard Memory, CPU Quotas, and Swap Limits via Cgroups",
    category: "Security, Hardening & Ops",
    difficulty: "intermediate",
    whatThisCodeCovers: "Restricts container resource consumption using precise cgroup quotas (--memory, --memory-swap, --cpus, and --oom-kill-disable=false) to prevent single containers from degrading host stability.",
    conceptsCovered: [
      "--memory and --memory-swap",
      "--cpus CFS bandwidth quota",
      "OOM killer behavior",
      "Inspecting /sys/fs/cgroup",
      "Preventing noisy neighbor problems"
    ],
    code: `#!/usr/bin/env bash
# Launch container with 512MB RAM, no swap, and 1.5 CPU cores
docker run -d \\
  --name resource-capped-worker \\
  --memory="512m" \\
  --memory-swap="512m" \\
  --cpus="1.5" \\
  --cpu-shares="512" \\
  alpine:3.20 sleep 3600

# Inspect cgroup memory limit from inside container
echo "=== Memory Limit (bytes) ==="
docker exec resource-capped-worker cat /sys/fs/cgroup/memory.max 2>/dev/null || \\
docker exec resource-capped-worker cat /sys/fs/cgroup/memory/memory.limit_in_bytes

# Test OOM reaction by exceeding 512MB:
docker run --rm --memory="128m" --memory-swap="128m" \\
  polinux/stress stress --vm 1 --vm-bytes 200M --timeout 5s || echo "Process OOMKilled with exit code 137!"`,
    breakdown: [
      {
        lineRange: "3-9",
        note: "--memory-swap equal to --memory prevents the container from swapping out to host disk, preventing disk thrashing."
      },
      {
        lineRange: "12-14",
        note: "Reads cgroups directly: 536870912 bytes represents exactly 512MB."
      },
      {
        lineRange: "16-18",
        note: "Stress test forces memory allocation above 128M; the kernel terminates the container with SIGKILL (Exit code 137)."
      }
    ],
    expectedOutput: `=== Memory Limit (bytes) ===
536870912
stress: info: [1] dispatching hogs: 0 cpu, 0 io, 1 vm, 0 fd
Process OOMKilled with exit code 137!`
  },
  {
    id: "docker-ex-46",
    title: "Automated Container Vulnerability Scanning in CI/CD with Trivy",
    category: "Security, Hardening & Ops",
    difficulty: "intermediate",
    whatThisCodeCovers: "Integrates Aquasec Trivy into the build pipeline to scan Docker images for OS and application vulnerabilities, automatically breaking the build if CRITICAL CVEs with available fixes are discovered.",
    conceptsCovered: [
      "Trivy CLI container scanner",
      "--severity HIGH,CRITICAL",
      "--exit-code 1 build breaking",
      "--ignore-unfixed filter",
      "Automated CI vulnerability gating"
    ],
    code: `#!/usr/bin/env bash
# 1. Build local container image
docker build -t app-to-scan:latest .

# 2. Run Trivy vulnerability scan against the local Docker daemon image
docker run --rm \\
  -v /var/run/docker.sock:/var/run/docker.sock:ro \\
  -v /tmp/trivy-cache:/root/.cache/ \\
  aquasec/trivy:latest image \\
  --severity CRITICAL,HIGH \\
  --ignore-unfixed \\
  --exit-code 1 \\
  --format table \\
  app-to-scan:latest

# If Trivy finds any actionable HIGH/CRITICAL CVEs, script halts with exit code 1!`,
    breakdown: [
      {
        lineRange: "6-14",
        note: "Trivy connects to docker.sock to read images locally, caching vulnerability databases in /tmp/trivy-cache."
      },
      {
        lineRange: "10-12",
        note: "--ignore-unfixed ignores CVEs that developers cannot fix anyway; --exit-code 1 fails CI when real fixes exist."
      }
    ],
    expectedOutput: `app-to-scan:latest (alpine 3.18.2)
Total: 2 (HIGH: 2, CRITICAL: 0)
┌───────────────┬────────────────┬──────────┬────────┬───────────────────┐
│    Library    │ Vulnerability  │ Severity │ Status │ Installed Version │
├───────────────┼────────────────┼──────────┼────────┼───────────────────┤
│ libcrypto3    │ CVE-2023-3817  │ HIGH     │ fixed  │ 3.1.1-r0          │
│ libssl3       │ CVE-2023-3817  │ HIGH     │ fixed  │ 3.1.1-r0          │
└───────────────┴────────────────┴──────────┴────────┴───────────────────┘
Error: 2 actionable vulnerabilities detected. Build terminated!`
  },
  {
    id: "docker-ex-47",
    title: "Generating Software Bill of Materials (SBOM) and Signing Images with Cosign",
    category: "Security, Hardening & Ops",
    difficulty: "advanced",
    whatThisCodeCovers: "Generates an SPDX Software Bill of Materials using Docker Scout/Syft, signs the container image using Sigstore Cosign with a cryptographic keypair, and verifies the signature.",
    conceptsCovered: [
      "Software Bill of Materials (SBOM)",
      "Sigstore Cosign key generation & signing",
      "cosign sign & cosign verify",
      "Software supply chain integrity",
      "SLSA compliance"
    ],
    code: `#!/usr/bin/env bash
set -euo pipefail

IMAGE="registry.company.internal/security/api:v1.0"

# 1. Generate SBOM in SPDX JSON format
docker sbom --format spdx-json --output sbom.spdx.json "$IMAGE"

# 2. Generate Cosign cryptographic keypair (if not present)
# cosign generate-key-pair

# 3. Sign the remote container image digest
export COSIGN_PASSWORD="prod-signing-password"
cosign sign --key cosign.key "$IMAGE"

# 4. Attach the SBOM as an attestation
cosign attest --key cosign.key --predicate sbom.spdx.json --type spdx "$IMAGE"

# 5. Verify image signature before deployment:
cosign verify --key cosign.pub "$IMAGE"`,
    breakdown: [
      {
        lineRange: "6-7",
        note: "Generates a standardized SPDX SBOM cataloging every installed package, binary, and library."
      },
      {
        lineRange: "13-17",
        note: "Signs image hash with ECDSA private key and attaches SBOM directly to the OCI registry."
      },
      {
        lineRange: "19-20",
        note: "cosign verify ensures the image has not been tampered with or modified since signing."
      }
    ],
    expectedOutput: `Verification for registry.company.internal/security/api:v1.0 --
The following checks were performed on each of these signatures:
  - The cosign claims were validated
  - The signatures were successfully verified against the public key
[{"critical":{"identity":{"docker-reference":"..."},"type":"cosign"}}]`
  },
  {
    id: "docker-ex-48",
    title: "Non-Blocking JSON-File Logging with Automatic File Rotation and Max Size Limits",
    category: "Security, Hardening & Ops",
    difficulty: "intermediate",
    whatThisCodeCovers: "Configures Docker's json-file logging driver with mode: non-blocking, max-size, and max-file parameters to prevent high-velocity logging from filling disks or halting container threads.",
    conceptsCovered: [
      "log-driver: json-file",
      "max-size and max-file rotation",
      "mode: non-blocking with ring-buffer",
      "/etc/docker/daemon.json log configuration",
      "Preventing stdout disk exhaustion"
    ],
    code: `# Configure globally in /etc/docker/daemon.json:
# {
#   "log-driver": "json-file",
#   "log-opts": {
#     "max-size": "50m",
#     "max-file": "5",
#     "mode": "non-blocking",
#     "max-buffer-size": "4m"
#   }
# }

# Or pass explicitly per-container:
docker run -d \\
  --name high-load-api \\
  --log-driver json-file \\
  --log-opt max-size=20m \\
  --log-opt max-file=3 \\
  --log-opt mode=non-blocking \\
  --log-opt max-buffer-size=2m \\
  my-api:latest

# Check container log file path and active size
CONTAINER_ID=$(docker inspect --format '{{.Id}}' high-load-api)
sudo ls -lh /var/lib/docker/containers/\${CONTAINER_ID}/\${CONTAINER_ID}-json.log*`,
    breakdown: [
      {
        lineRange: "13-18",
        note: "max-size=20m and max-file=3 restricts disk usage to a hard maximum of 60MB total logs per container."
      },
      {
        lineRange: "17",
        note: "mode=non-blocking ensures that if disk I/O bottlenecks, application stdout won't lock up or block worker threads."
      }
    ],
    expectedOutput: `-rw-r----- 1 root root 19.8M Nov  4 10:50 ...-json.log
-rw-r----- 1 root root 20.0M Nov  4 10:48 ...-json.log.1
-rw-r----- 1 root root 20.0M Nov  4 10:46 ...-json.log.2
Total log disk footprint bounded strictly at 60MB!`
  },
  {
    id: "docker-ex-49",
    title: "Building Multi-Architecture Images (amd64 / arm64) using Docker Buildx and QEMU",
    category: "Security, Hardening & Ops",
    difficulty: "advanced",
    whatThisCodeCovers: "Sets up QEMU CPU emulators and a dedicated Buildx builder instance to simultaneously compile and push native Linux amd64 (x86_64) and arm64 (Apple Silicon / AWS Graviton) images in a single build command.",
    conceptsCovered: [
      "docker buildx create --use",
      "tonistiigi/binfmt QEMU registration",
      "--platform linux/amd64,linux/arm64",
      "OCI Manifest List generation",
      "Cross-platform compilation"
    ],
    code: `#!/usr/bin/env bash
set -euo pipefail

# 1. Register QEMU emulation binfmt handlers in the host kernel
docker run --privileged --rm tonistiigi/binfmt --install all

# 2. Create and initialize a new Buildx builder instance
docker buildx create --name enterprise-builder --driver docker-container --use
docker buildx inspect --bootstrap

# 3. Build and push multi-architecture image manifest list
docker buildx build \\
  --platform linux/amd64,linux/arm64 \\
  -t my-registry.internal/app:v2.5 \\
  --push \\
  .

# 4. Verify OCI manifest contains both target architectures:
docker buildx imagetools inspect my-registry.internal/app:v2.5`,
    breakdown: [
      {
        lineRange: "4-5",
        note: "Registers Linux kernel binfmt_misc handlers to transparently execute foreign ARM/RISC instructions via QEMU."
      },
      {
        lineRange: "7-9",
        note: "Creates container-backed Buildx worker capable of parallel cross-compilation."
      },
      {
        lineRange: "12-16",
        note: "Builds both architectures in parallel and pushes a unified manifest list under a single tag."
      }
    ],
    expectedOutput: `Name:      my-registry.internal/app:v2.5
MediaType: application/vnd.oci.image.index.v1+json
Manifests:
  Platform: linux/amd64
    Digest: sha256:7b91c04f...
  Platform: linux/arm64
    Digest: sha256:1a84f32e...`
  },
  {
    id: "docker-ex-50",
    title: "Diagnosing Memory Leaks and CPU Throttling via docker stats and cgroups",
    category: "Security, Hardening & Ops",
    difficulty: "intermediate",
    whatThisCodeCovers: "Monitors live CPU throttling statistics (nr_throttled, throttled_usec) and memory cgroup page cache vs RSS breakdown to pinpoint microservice performance degradation.",
    conceptsCovered: [
      "docker stats formatting",
      "/sys/fs/cgroup/cpu.stat analysis",
      "CFS quota throttling detection",
      "Memory RSS vs Cache distinction",
      "Performance triage"
    ],
    code: `#!/usr/bin/env bash
# 1. Stream formatted live stats across running containers
docker stats --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.BlockIO}}"

# 2. Inspect CPU throttling counters inside cgroups (Linux host)
CONTAINER_NAME="production-api"
CONTAINER_PID=$(docker inspect --format '{{.State.Pid}}' "$CONTAINER_NAME")

echo "=== CPU Throttling Statistics ==="
# Cgroups v2
if [ -f "/sys/fs/cgroup/system.slice/docker-\${CONTAINER_NAME}.scope/cpu.stat" ]; then
  cat "/sys/fs/cgroup/system.slice/docker-\${CONTAINER_NAME}.scope/cpu.stat"
else
  # Cgroups v1
  cat "/sys/fs/cgroup/cpu/docker/\${CONTAINER_NAME}/cpu.stat" 2>/dev/null || \\
  docker exec "$CONTAINER_NAME" cat /sys/fs/cgroup/cpu.stat
fi`,
    breakdown: [
      {
        lineRange: "2-3",
        note: "docker stats displays real-time CPU percentages, memory limits, and socket/disk throughput."
      },
      {
        lineRange: "10-17",
        note: "Checks cpu.stat: high nr_throttled indicates the container is being choked by its CFS quota."
      }
    ],
    expectedOutput: `NAME             CPU %     MEM USAGE / LIMIT     NET I/O           BLOCK I/O
production-api   99.4%     412MiB / 512MiB       1.2MB / 4.8MB     12MB / 0B

=== CPU Throttling Statistics ===
usage_usec 48192019
nr_periods 1204
nr_throttled 612 (50.8% of execution periods throttled!)
throttled_usec 24192080`
  },
  {
    id: "docker-ex-51",
    title: "Secure Remote Docker Daemon Management via Mutual TLS (mTLS) Certificates",
    category: "Security, Hardening & Ops",
    difficulty: "advanced",
    whatThisCodeCovers: "Secures the Docker daemon TCP socket (port 2376) using mutual TLS x509 certificates (CA, server cert, client cert) to permit remote CLI orchestration while preventing unauthorized access.",
    conceptsCovered: [
      "Docker mTLS configuration",
      "--tlsverify, --tlscacert, --tlscert, --tlskey",
      "Securing TCP 2376",
      "DOCKER_HOST and DOCKER_TLS_VERIFY environment vars",
      "Preventing unauthenticated root API access"
    ],
    code: `# Configure /etc/docker/daemon.json on the remote server:
# {
#   "hosts": ["tcp://0.0.0.0:2376", "unix:///var/run/docker.sock"],
#   "tls": true,
#   "tlsverify": true,
#   "tlscacert": "/etc/docker/certs/ca.pem",
#   "tlscert": "/etc/docker/certs/server-cert.pem",
#   "tlskey": "/etc/docker/certs/server-key.pem"
# }

# From developer client workstation:
export DOCKER_HOST="tcp://remote-docker-host.company.internal:2376"
export DOCKER_TLS_VERIFY=1
export DOCKER_CERT_PATH="~/.docker/client-certs"

# Remote daemon invocation over encrypted authenticated TLS tunnel:
docker version
docker ps`,
    breakdown: [
      {
        lineRange: "1-9",
        note: "Configures remote daemon to reject unencrypted or unauthenticated requests on TCP port 2376."
      },
      {
        lineRange: "12-14",
        note: "Client workstation sets DOCKER_HOST and DOCKER_CERT_PATH containing client-cert.pem and client-key.pem."
      },
      {
        lineRange: "16-18",
        note: "CLI communicates securely across WAN/VPC with mutual cryptographic verification."
      }
    ],
    expectedOutput: `Client: Docker Engine
 Version:           26.1.1
Server: Docker Engine - Community
 Engine:
  Version:          26.1.1
  API version:      1.45 (mTLS Handshake Verified)`
  },
  {
    id: "docker-ex-52",
    title: "Automated Host Disk Hygiene Script Pruning Dangling Images, Builders, and Volumes",
    category: "Security, Hardening & Ops",
    difficulty: "intermediate",
    whatThisCodeCovers: "An automated cron-compatible bash maintenance script that safely monitors /var/lib/docker disk utilization, triggering staged prune procedures when disk capacity exceeds 85%.",
    conceptsCovered: [
      "Disk threshold monitoring (df -h)",
      "Automated docker builder prune",
      "docker image prune --all --filter",
      "System maintenance runbook",
      "Preventing node disk starvation"
    ],
    code: `#!/usr/bin/env bash
set -euo pipefail

THRESHOLD=85
CURRENT_USAGE=$(df -P /var/lib/docker | awk 'NR==2 {gsub("%",""); print $5}')

echo "Checking Docker disk space: Current utilization is \${CURRENT_USAGE}% (Threshold: \${THRESHOLD}%)"

if [ "\$CURRENT_USAGE" -gt "\$THRESHOLD" ]; then
    echo "Warning: Disk threshold exceeded! Initiating staged cleanup..."
    
    # Stage 1: Prune dangling build caches older than 7 days
    docker builder prune -f --filter "until=168h"
    
    # Stage 2: Prune stopped containers older than 24 hours
    docker container prune -f --filter "until=24h"
    
    # Stage 3: Prune unreferenced dangling images
    docker image prune -f
    
    NEW_USAGE=$(df -P /var/lib/docker | awk 'NR==2 {gsub("%",""); print $5}')
    echo "Hygiene run complete. Disk usage dropped from \${CURRENT_USAGE}% to \${NEW_USAGE}%."
else
    echo "Disk usage is within acceptable limits. No prune required."
fi`,
    breakdown: [
      {
        lineRange: "4-7",
        note: "Extracts disk utilization percentage of the Docker data partition."
      },
      {
        lineRange: "12-19",
        note: "Executes a staged cleanup: first drops old BuildKit caches, then stopped containers, then dangling images."
      },
      {
        lineRange: "21-22",
        note: "Calculates reclaimed capacity and logs the result for monitoring."
      }
    ],
    expectedOutput: `Checking Docker disk space: Current utilization is 89% (Threshold: 85%)
Warning: Disk threshold exceeded! Initiating staged cleanup...
Total reclaimed build cache space: 14.8GB
Total reclaimed dangling images: 8.2GB
Hygiene run complete. Disk usage dropped from 89% to 62%.`
  }
];
