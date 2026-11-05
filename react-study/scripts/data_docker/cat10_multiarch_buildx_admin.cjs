const { createCard } = require('../docker_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 109,
    category: "Multi-Platform Builds, Daemon Admin & Tooling",
    concept: "docker buildx & Multi-Platform Builds (--platform)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does `docker buildx` build multi-architecture container images supporting both `linux/amd64` (Intel/AMD) and `linux/arm64` (Apple Silicon, AWS Graviton)?",
    quickAnswer: "`docker buildx build --platform linux/amd64,linux/arm64` compiles the Dockerfile for multiple hardware architectures concurrently. It creates an **OCI Image Index** (manifest list) pointing to architecture-specific layer manifests, and pushes the combined multi-arch bundle to the registry in a single command.",
    detailedAnswer: "With the rise of Apple Silicon (M1/M2/M3/M4) and cost-effective AWS Graviton ARM64 servers, building for a single architecture causes 'exec format error' crashes when deployed across heterogeneous hardware. BuildKit's `buildx` plugin leverages QEMU emulation or remote multi-architecture builder nodes to compile separate image variants simultaneously, packaging them under a single unified image tag.",
    code: `# 1. Create and switch to a custom multi-architecture builder instance:
$ docker buildx create --name multiarch-builder --driver docker-container --use
$ docker buildx inspect --bootstrap

# 2. Build and push for both Intel (amd64) and ARM (arm64):
$ docker buildx build \
    --platform linux/amd64,linux/arm64 \
    -t my-registry.com/my-app:1.0.0 \
    --push .

# 3. Inspect the resulting multi-arch manifest list from registry:
$ docker buildx imagetools inspect my-registry.com/my-app:1.0.0
# Name:      my-registry.com/my-app:1.0.0
# MediaType: application/vnd.oci.image.index.v1+json
# Manifests:
#   Platform: linux/amd64
#   Platform: linux/arm64`,
    recallHint: "docker buildx build --platform linux/amd64,linux/arm64 --push . compiles multi-arch images in 1 command.",
    interviewTip: "Remember that you must include `--push` when building multiple platforms: the local Docker daemon cannot store multi-platform image indexes locally in its legacy storage graph driver.",
    tags: ["buildx", "multi-platform", "arm64", "amd64", "graviton"],
    practice: [
      "Why does `docker buildx build --platform linux/amd64,linux/arm64` fail without `--push` or a custom output driver?",
      "What is `exec format error` and why does it occur when running an x86 image on an ARM server?"
    ]
  }),

  createCard({
    idNum: 110,
    category: "Multi-Platform Builds, Daemon Admin & Tooling",
    concept: "QEMU Emulation vs Native Cross-Compilation (Go, Rust, xx)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why is QEMU user-mode emulation slow for multi-arch builds, and how does native Go/Rust cross-compilation accelerate builds by 10x?",
    quickAnswer: "QEMU emulates foreign CPU instructions (e.g. running an AMD64 compiler on an ARM host) in software, causing builds to run **5x to 20x slower** and occasionally crashing with segmentation faults. Native cross-compilation runs the compiler natively on the host CPU architecture (`--platform=$BUILDPLATFORM`), targeting the destination architecture (`$TARGETPLATFORM`) via compiler cross-flags (like `GOARCH=arm64`), compiling at 100% native CPU speed.",
    detailedAnswer: "In standard BuildKit multi-platform builds, BuildKit installs QEMU binfmt handlers (`binfmt_misc`). If building Python or C++ dependencies, QEMU translates every x86 machine instruction into ARM64 instructions in software, creating massive CPU overhead. In languages with built-in cross-compilers (Go, Rust), you declare `FROM --platform=$BUILDPLATFORM golang` so the Go compiler runs at native host speeds, outputting an ARM64 binary directly.",
    code: `# syntax=docker/dockerfile:1

# Fast Cross-Compilation in Go (Runs at 100% native host speed!):
FROM --platform=$BUILDPLATFORM golang:1.22-alpine AS builder

# BuildKit injects these architecture variables automatically:
ARG TARGETOS
ARG TARGETARCH

WORKDIR /src
COPY go.* ./
RUN go mod download
COPY . .

# Native Go compiler targets the requested destination architecture:
RUN CGO_ENABLED=0 GOOS=$TARGETOS GOARCH=$TARGETARCH \
    go build -ldflags="-s -w" -o /bin/server .

# Final minimal stage targets destination architecture:
FROM alpine:3.19
COPY --from=builder /bin/server /app/server
ENTRYPOINT ["/app/server"]`,
    recallHint: "QEMU emulates instructions in software (very slow). Cross-compilation (GOARCH=$TARGETARCH) runs at native speed.",
    interviewTip: "Explain the `xx` helper (`tonistiigi/xx`): it provides cross-compilation wrappers for C/C++ (`clang`, `gcc`, `pkg-config`) inside BuildKit, speeding up native C++ multi-arch compilation without QEMU lag.",
    tags: ["qemu", "cross-compilation", "buildplatform", "targetplatform", "performance"],
    practice: [
      "What are the automatic BuildKit platform arguments (`BUILDPLATFORM`, `TARGETPLATFORM`, `TARGETARCH`)?",
      "How do you install QEMU binfmt handlers using `docker run --privileged --rm tonistiigi/binfmt --install all`?"
    ]
  }),

  createCard({
    idNum: 111,
    category: "Multi-Platform Builds, Daemon Admin & Tooling",
    concept: "OCI Image Index & Multi-Arch Manifest Lists",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is an OCI Image Index (Manifest List), and how does Docker select the correct architecture when pulling `alpine:latest`?",
    quickAnswer: "An **OCI Image Index** is a parent manifest that contains an array of descriptors pointing to architecture-specific image manifests (`linux/amd64`, `linux/arm64`, `windows/amd64`). When you run `docker run alpine:latest`, the Docker client queries the host kernel architecture (`uname -m`), inspects the Image Index, and automatically downloads the matching architecture variant.",
    detailedAnswer: "When you run `docker pull nginx:latest` on an Intel laptop, it downloads an AMD64 image. When you run the exact same command on an Apple Silicon M3 Mac or Raspberry Pi, it downloads an ARM64 image. Neither the user nor the script needs to specify tags like `:latest-arm64`. The top-level tag points to the Image Index, which resolves the correct sub-manifest based on the client's architecture and OS.",
    code: `# Inspect the multi-architecture manifest list for official Alpine image:
$ docker manifest inspect alpine:latest | jq .
# {
#   "schemaVersion": 2,
#   "mediaType": "application/vnd.docker.distribution.manifest.list.v2+json",
#   "manifests": [
#     {
#       "digest": "sha256:d734292770f8...",
#       "platform": { "architecture": "amd64", "os": "linux" }
#     },
#     {
#       "digest": "sha256:87629b12a8f1...",
#       "platform": { "architecture": "arm64", "os": "linux" }
#     },
#     {
#       "digest": "sha256:1a2b3c4d5e6f...",
#       "platform": { "architecture": "s390x", "os": "linux" }
#     }
#   ]
# }`,
    recallHint: "Image Index is a fat manifest listing AMD64, ARM64, etc. Client automatically downloads its host architecture.",
    interviewTip: "Mention that you can manually assemble a multi-arch image index from existing single-arch images using `docker manifest create <fat-tag> <arch1-tag> <arch2-tag>` and `docker manifest push`.",
    tags: ["image-index", "manifest-list", "multi-arch", "oci-spec", "distribution"],
    practice: [
      "How do you force Docker to pull an AMD64 image on an Apple Silicon ARM64 Mac using `--platform=linux/amd64`?",
      "How do you create an image index manually with `docker manifest create`?"
    ]
  }),

  createCard({
    idNum: 112,
    category: "Multi-Platform Builds, Daemon Admin & Tooling",
    concept: "Docker-in-Docker (DinD) vs Docker-outside-of-Docker (DooD)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the architectural difference between Docker-in-Docker (DinD) and Docker-outside-of-Docker (DooD), and when is each used?",
    quickAnswer: "1) **DinD (Docker-in-Docker)**: Runs a complete, isolated Docker daemon *inside* a container. Requires `--privileged` mode and custom storage drivers (`vfs` or nested `overlay2`). Used for true sandbox isolation in CI runners. 2) **DooD (Docker-outside-of-Docker)**: Mounts the host's `/var/run/docker.sock` into the container. Spawns sibling containers directly on the host machine. Faster and avoids `--privileged`, but exposes full host root security risks.",
    detailedAnswer: "In CI/CD build agents (GitLab Runners, Jenkins), pipelines need to build and test Docker images. In DooD, running `docker build` inside Jenkins talks to the host daemon, meaning built images appear on the host, and port conflicts can collide with host services. In DinD, an isolated daemon runs inside the container with its own storage and network namespaces, providing complete container-level sandboxing at the cost of privileged kernel access.",
    code: `# 1. DOCKER-OUTSIDE-OF-DOCKER (DooD): Sibling container architecture
# Container shares host daemon via socket mount:
$ docker run -d --name dood-runner \
    -v /var/run/docker.sock:/var/run/docker.sock \
    docker:cli

# 2. DOCKER-IN-DOCKER (DinD): Child isolated daemon architecture
# Runs an independent dockerd daemon inside container (Requires --privileged!):
$ docker run --privileged --name dind-runner -d docker:dind

# Execute builds inside the DinD daemon:
$ docker exec -it dind-runner docker ps  # Isolated process table!`,
    recallHint: "DooD = mounts host docker.sock (spawns sibling containers on host). DinD = isolated nested daemon (needs --privileged).",
    interviewTip: "Senior engineers recommend unprivileged builders like Google Kaniko or Buildah for CI pipelines, which eliminate both DinD's `--privileged` security hazard and DooD's socket-escape vulnerability.",
    tags: ["dind", "dood", "docker-in-docker", "ci-runners", "architecture"],
    practice: [
      "Why does running OverlayFS on top of an existing OverlayFS filesystem in DinD cause kernel lockups?",
      "Why is DooD preferred over DinD when host image layer caching must be preserved across CI runs?"
    ]
  }),

  createCard({
    idNum: 113,
    category: "Multi-Platform Builds, Daemon Admin & Tooling",
    concept: "Docker Daemon Maintenance & System Pruning (docker system prune)",
    priority: "must-know",
    difficulty: "beginner",
    question: "How do you perform safe routine disk maintenance on Docker hosts, and what is the difference between `docker system prune` and `docker system prune -a --volumes`?",
    quickAnswer: "`docker system prune` removes: 1) stopped containers, 2) unreferenced networks, 3) dangling images (images without tags, `<none>`), and 4) dangling build cache. It **does NOT delete named volumes or tagged images**. Adding **`-a --volumes`** deletes ALL unused tagged images and ALL unattached named volumes, reclaiming maximum disk space (use with caution in production!).",
    detailedAnswer: "In production, automated cron jobs frequently run `docker system prune -f` weekly. However, if your application stores database state in a named volume that is temporarily detached during maintenance, running `--volumes` will permanently delete that database! Use filter flags (e.g. `--filter \"until=168h\"`) to purge only assets older than 7 days, leaving active caches intact.",
    code: `# 1. Standard Safe Cleanup (Keeps volumes and tagged images intact):
$ docker system prune -f

# 2. Filtered Cleanup: Prune only assets created more than 7 days ago (168 hours):
$ docker system prune -f --filter "until=168h"

# 3. Dedicated BuildKit cache pruning (Leaves image layers intact, frees build cache):
$ docker builder prune -f --keep-storage 10GB

# 4. NUCLEAR CLEANUP (DANGER: Deletes all unused images and unattached volumes!):
# $ docker system prune -a --volumes -f`,
    recallHint: "docker system prune removes stopped containers, dangling images, and build cache. Add --volumes to clean volumes.",
    interviewTip: "Never put `docker system prune --volumes` in an automated cron script in production without strict volume filters; it risks destroying unattached production database volumes.",
    tags: ["system-prune", "cleanup", "disk-maintenance", "admin", "volumes"],
    practice: [
      "What is the difference between a dangling image (`<none>:<none>`) and an unused image?",
      "How do you schedule an automatic cleanup job using Linux systemd timers?"
    ]
  }),

  createCard({
    idNum: 114,
    category: "Multi-Platform Builds, Daemon Admin & Tooling",
    concept: "Remote Daemon Management via Docker Contexts (docker context)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are Docker Contexts (`docker context`), and how do they allow switching CLI control between local, remote SSH, and cloud daemons seamlessly?",
    quickAnswer: "Docker Contexts store endpoint configurations and TLS credentials for multiple Docker daemons. Instead of manually exporting `DOCKER_HOST` environment variables, `docker context use <name>` seamlessly switches the CLI target between local Docker Desktop, remote staging servers over SSH (`ssh://user@host`), or AWS/Azure cloud endpoints.",
    detailedAnswer: "Historically, controlling a remote Docker server required creating complex SSH tunnels or setting `export DOCKER_HOST=ssh://user@server.com`. Docker Contexts introduced in Docker 19.03 formalize this. You can define a production context connecting securely via native OpenSSH. Once switched, running `docker ps` or `docker compose up` executes directly against the remote production server using your local CLI.",
    code: `# 1. List available contexts (current active context marked with *):
$ docker context ls
# NAME        DESCRIPTION                               DOCKER ENDPOINT
# default *   Current default context                   unix:///var/run/docker.sock
# desktop     Docker Desktop                            unix:///Users/user/.docker/run/docker.sock

# 2. Create a remote context connecting securely over SSH:
$ docker context create prod-cluster \
    --description "Production Staging Server" \
    --docker "host=ssh://devops@staging.company.com"

# 3. Switch active CLI context:
$ docker context use prod-cluster

# 4. Any subsequent Docker command targets the remote production server!
$ docker ps
$ docker compose up -d

# 5. Execute a one-off command against a specific context without switching:
$ docker --context prod-cluster ps`,
    recallHint: "docker context create/use switches the CLI target between local daemon and remote SSH servers seamlessly.",
    interviewTip: "Highlight that Docker Contexts use your local system's existing `~/.ssh/config` and SSH keys, making remote administration passwordless, secure, and encrypted without managing separate TLS certificates.",
    tags: ["docker-context", "remote-daemon", "ssh", "admin", "cli"],
    practice: [
      "How does `docker context` integrate with Docker Compose deployments?",
      "How do you export and import contexts across developer machines using `docker context export/import`?"
    ]
  }),

  createCard({
    idNum: 115,
    category: "Multi-Platform Builds, Daemon Admin & Tooling",
    concept: "Custom Network MTU Configuration",
    priority: "must-know",
    difficulty: "advanced",
    question: "What causes container network packets to be silently dropped on VPN or cloud networks, and how does configuring MTU fix it?",
    quickAnswer: "The host physical network or VPN tunnel uses a Maximum Transmission Unit (MTU) smaller than Docker's default 1500 bytes (e.g. WireGuard/OpenVPN uses 1420 bytes; VXLAN overlay uses 1450 bytes). Packets larger than the MTU with the 'Don't Fragment' (DF) bit set are silently dropped by intermediate routers, causing HTTPS TLS handshakes or large HTTP downloads to hang indefinitely. Fix by setting matching `mtu` in `/etc/docker/daemon.json`.",
    detailedAnswer: "This is a notoriously difficult production bug. Ping works (small 64-byte packets), small HTTP queries work, but downloading a 5MB payload or completing a TLS handshake hangs forever. The underlying physical or virtual tunnel adds encapsulation headers, shrinking the available packet payload. If Docker assumes an MTU of 1500, oversized packets are dropped. Configuring `\"mtu\": 1420` in `daemon.json` ensures all container interfaces negotiate packet sizes that traverse the tunnel without fragmentation.",
    code: `# Configure global network MTU in /etc/docker/daemon.json:
{
  "mtu": 1420
}

# Reload Docker daemon:
$ sudo systemctl restart docker

# Or specify custom MTU when creating a specific user-defined network:
$ docker network create --driver bridge --opt com.docker.network.driver.mtu=1420 vpn-net

# Verify container eth0 interface MTU:
$ docker run --rm --network vpn-net alpine ip link show eth0
# 5: eth0@if6: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1420 qdisc noqueue state UP ...`,
    recallHint: "Mismatched MTU causes large packets/TLS to hang on VPNs. Fix by configuring matching MTU in daemon.json.",
    interviewTip: "In cloud infrastructure interviews, explain that AWS VPC support 9001-byte Jumbo frames, while overlay networks and IPsec tunnels shrink MTU below 1500; aligning MTU eliminates packet fragmentation.",
    tags: ["mtu", "networking", "vpn", "packet-loss", "troubleshooting"],
    practice: [
      "Why do `ping` commands work across an MTU-mismatched network while `curl https://...` hangs on the TLS handshake?",
      "How do you test network path MTU using `ping -M do -s 1472 <host>`?"
    ]
  }),

  createCard({
    idNum: 116,
    category: "Multi-Platform Builds, Daemon Admin & Tooling",
    concept: "Moving /var/lib/docker to a Dedicated NVMe Partition",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you migrate Docker's data root directory (`/var/lib/docker`) to a dedicated high-speed NVMe disk or larger partition?",
    quickAnswer: "1) Stop the Docker daemon (`sudo systemctl stop docker`), 2) Configure `\"data-root\": \"/mnt/nvme/docker\"` in `/etc/docker/daemon.json`, 3) Synchronize existing data using `rsync -aP /var/lib/docker/ /mnt/nvme/docker/`, 4) Restart Docker, and 5) Verify `Docker Root Dir` with `docker info`.",
    detailedAnswer: "By default, Docker stores all images, containers, and overlay2 layers on the host root partition (`/var/lib/docker`). In production, container storage quickly exhausts the root filesystem, starving the host OS of disk space. Best practice dictates mounting a dedicated high-performance NVMe block device formatted with `ext4` or `xfs` (with `ftype=1`), and setting `data-root` in `daemon.json`.",
    code: `# Production Migration Procedure:
# Step 1: Stop Docker service completely
$ sudo systemctl stop docker
$ sudo systemctl stop docker.socket

# Step 2: Configure new target path in /etc/docker/daemon.json:
{
  "data-root": "/mnt/fast-nvme/docker",
  "storage-driver": "overlay2"
}

# Step 3: Copy existing container and image data preserving all permissions & extended attributes:
$ sudo rsync -aP /var/lib/docker/ /mnt/fast-nvme/docker/

# Step 4: Rename old directory as backup:
$ sudo mv /var/lib/docker /var/lib/docker.old

# Step 5: Start Docker service:
$ sudo systemctl start docker

# Step 6: Verify new data root path:
$ docker info | grep "Docker Root Dir"
# Docker Root Dir: /mnt/fast-nvme/docker`,
    recallHint: "Move Docker storage: Stop daemon, set data-root in daemon.json, rsync -aP data, restart daemon.",
    interviewTip: "Emphasize using `rsync -aP` instead of `cp -r`: `rsync -a` strictly preserves Linux file permissions, numeric ownerships, symlinks, and extended security attributes vital for container rootfs integrity.",
    tags: ["data-root", "daemon-config", "storage-migration", "nvme", "admin"],
    practice: [
      "Why must `xfs` filesystems be formatted with `d_type=true` (`ftype=1`) for `overlay2` compatibility?",
      "What happens if `data-root` is placed on an NFS or CIFS network filesystem?"
    ]
  }),

  createCard({
    idNum: 117,
    category: "Multi-Platform Builds, Daemon Admin & Tooling",
    concept: "Container Checkpoint & Restore in Userspace (CRIU)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Checkpoint/Restore In Userspace (CRIU), and how does `docker checkpoint` enable live state migration?",
    quickAnswer: "CRIU freezes a running container and dumps its entire memory state, process tree, registers, file descriptors, and socket states to disk as a collection of binary checkpoint files. You can later restore the container on the same machine (or migrate it to another server) using `docker start --checkpoint`, resuming execution from the exact millisecond it was frozen with zero loss of in-memory state.",
    detailedAnswer: "Traditional container restarts lose all volatile RAM state (e.g. JVM caches, active calculations, open socket connections). CRIU (an experimental Docker feature) dumps memory via kernel ptrace. This enables live container migration between physical hosts without dropping application session states, as well as ultra-fast instant startup for heavy applications (e.g. checkpointing a JVM after its 60-second initialization, then restoring new instances in 50ms).",
    code: `# 1. Enable experimental features in /etc/docker/daemon.json:
{
  "experimental": true
}

# 2. Run a stateful counting application:
$ docker run -d --name looper alpine sh -c 'i=0; while true; do echo $i; i=$(($i+1)); sleep 1; done'

# 3. Create a live memory checkpoint:
$ docker checkpoint create looper checkpoint-step1
# Container process halts; memory state dumped to disk!

# 4. Restore the container from the exact frozen memory snapshot:
$ docker start --checkpoint checkpoint-step1 looper

# The container resumes counting seamlessly from where it stopped!
$ docker logs looper`,
    recallHint: "CRIU dumps container RAM state to disk. docker checkpoint create / start --checkpoint resumes live memory state.",
    interviewTip: "Mention that CRIU requires matching Linux kernel versions and CPU instruction sets if migrating the checkpoint directory to a different physical machine.",
    tags: ["criu", "checkpoint", "live-migration", "memory-dump", "experimental"],
    practice: [
      "What happens to open TCP network connections during a CRIU checkpoint and restore?",
      "How is CRIU used in serverless platforms to eliminate cold start latency?"
    ]
  }),

  createCard({
    idNum: 118,
    category: "Multi-Platform Builds, Daemon Admin & Tooling",
    concept: "Docker Desktop VM Architecture (WSL2 & macOS Virtualization)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does Docker Desktop execute Linux containers on non-Linux operating systems (macOS and Windows)?",
    quickAnswer: "Docker Desktop runs a lightweight, headless Linux Virtual Machine (VM) managed by the host OS hypervisor. On Windows, it uses the **WSL2 (Windows Subsystem for Linux)** lightweight Hyper-V utility VM. On macOS, it uses the **Apple Virtualization Framework** (Virtualization.framework). The Docker CLI on macOS/Windows talks over a socket to the Docker Engine running inside this Linux VM.",
    detailedAnswer: "Because containers share the host Linux kernel, they cannot run natively on the Darwin (XNU) kernel of macOS or the NT kernel of Windows. Docker Desktop provisions a specialized Alpine-based Linux VM running Linux kernel 5.x/6.x. Filesystem sharing between the Mac/Windows host and the Linux VM is mediated by high-speed VirtioFS. Memory, CPU, and disk allocated in Docker Desktop settings dictate the resource limits of this hidden VM.",
    code: `# 1. On macOS: Inspect the hidden Docker Desktop virtual machine process:
$ ps aux | grep com.docker.virtualization
# /System/Library/Frameworks/Virtualization.framework/...

# 2. On Windows: Inspect the WSL2 Docker VM distributions:
# > wsl --list --verbose
#   NAME                   STATE           VERSION
# * Ubuntu-22.04           Running         2
#   docker-desktop         Running         2  <-- Engine VM!
#   docker-desktop-data    Running         2  <-- Persistent storage!

# 3. Configure memory limits for the Windows WSL2 VM via %USERPROFILE%/.wslconfig:
# [wsl2]
# memory=8GB
# processors=4`,
    recallHint: "macOS/Windows run Linux containers inside a hidden Linux VM (WSL2 on Windows, Virt.framework on Mac).",
    interviewTip: "Explain why `docker run -m 16g` fails on a Mac with 32GB of RAM: if Docker Desktop's VM is configured with a 4GB memory ceiling in its GUI preferences, no container can ever allocate more than 4GB regardless of CLI flags.",
    tags: ["docker-desktop", "wsl2", "macos", "virtualization", "architecture"],
    practice: [
      "Why does Docker Desktop consume significant RAM on macOS even when zero containers are running?",
      "How does VirtioFS improve file bind mount performance compared to legacy osxfs or gRPC-FUSE?"
    ]
  }),

  createCard({
    idNum: 119,
    category: "Multi-Platform Builds, Daemon Admin & Tooling",
    concept: "docker export/import vs docker save/load",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the critical difference between `docker export / import` and `docker save / load`?",
    quickAnswer: "`docker save` and `docker load` export/import **Image layers with full commit history, tags, and metadata** (retaining image layers). `docker export` and `docker import` export/import an individual **container's flattened root filesystem snapshot**, discarding all layer history, commit logs, environment variables, and metadata.",
    detailedAnswer: "Use `docker save my-image:latest -o image.tar` when migrating images across air-gapped environments where you need to preserve layer caching and image metadata (`CMD`, `ENV`, `ENTRYPOINT`). Use `docker export my-container -o container.tar` when you want to flatten an entire container into a single-layer tarball, stripping out all history and shrinking image overhead, though you will need to re-declare `CMD` upon `docker import`.",
    code: `# 1. DOCKER SAVE / LOAD: Operates on IMAGES (Preserves layers & metadata):
$ docker save -o my-image.tar nginx:alpine
$ docker load -i my-image.tar
# Layers and metadata (ENV, EXPOSE, CMD) are 100% preserved!

# -------------------------------------------------------------
# 2. DOCKER EXPORT / IMPORT: Operates on CONTAINERS (Flattens rootfs, drops history):
$ docker run -d --name temp-container nginx:alpine
$ docker export temp-container -o container-rootfs.tar

# Import flattened rootfs as a brand new single-layer image:
$ docker import \
    --change "ENV PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin" \
    --change "CMD [\"nginx\", \"-g\", \"daemon off;\"]" \
    container-rootfs.tar my-flattened-nginx:latest`,
    recallHint: "save/load = IMAGES with full layers & metadata. export/import = CONTAINERS flattened into single raw rootfs.",
    interviewTip: "Highlight that `docker export` can be used to scrub sensitive layer history from a container before distributing a rootfs tarball, but re-declaring `--change \"CMD ...\"` is mandatory during import.",
    tags: ["save-load", "export-import", "tarballs", "air-gapped", "layer-flattening"],
    practice: [
      "Why does an image created via `docker import` have exactly 1 layer?",
      "How do you transfer a Docker image between two air-gapped servers using `docker save | ssh user@host docker load`?"
    ]
  }),

  createCard({
    idNum: 120,
    category: "Multi-Platform Builds, Daemon Admin & Tooling",
    concept: "Production Docker Daemon Health & Enterprise Checklist",
    priority: "must-know",
    difficulty: "advanced",
    question: "What operational criteria define an enterprise production-ready Docker host environment?",
    quickAnswer: "1) **Dedicated data-root partition** with NVMe/SSD, 2) **Log rotation** enforced via `local` or `json-file` with size limits, 3) **Live restore enabled** (`live-restore: true`), 4) **User namespaces** or rootless mode active, 5) **Default pids-limit** configured to prevent fork bombs, 6) **Automated prune timers** with volume filters, and 7) **Secure mTLS socket** with unencrypted port 2375 blocked.",
    detailedAnswer: "Running Docker in production enterprise environments requires hardening the host operating system, configuring the daemon defensively, and establishing operational monitoring. A failure to set log rotation guarantees disk outages; a failure to set pids-limit invites host crashes; exposing an unencrypted socket invites ransomware. Adhering to this master checklist guarantees robust 99.99% container availability.",
    code: `# The Complete Enterprise Production /etc/docker/daemon.json:
{
  "data-root": "/var/lib/docker",
  "storage-driver": "overlay2",
  "live-restore": true,
  "no-new-privileges": true,
  "default-pids-limit": 200,
  "log-driver": "json-file",
  "log-opts": {
    "mode": "non-blocking",
    "max-buffer-size": "4m",
    "max-size": "25m",
    "max-file": "4",
    "compress": "true"
  },
  "metrics-addr": "127.0.0.1:9323",
  "experimental": true,
  "icc": false
}`,
    recallHint: "Production daemon checklist: dedicated storage, live-restore, non-blocking log rotation, pids-limit, no-new-privs.",
    interviewTip: "Conclude architecture interviews with this unified production daemon configuration. It encapsulates every major operational lesson in container infrastructure engineering.",
    tags: ["production-readiness", "daemon-config", "enterprise", "checklist", "best-practices"],
    practice: [
      "How do you validate the syntax of `/etc/docker/daemon.json` before reloading `systemd`?",
      "How does `dockerd --validate` catch configuration syntax errors in CI/CD host provisioning?"
    ]
  })
];
