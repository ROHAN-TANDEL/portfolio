const fs = require('fs');
const path = require('path');

const deepDives = [
  {
    id: "docker-deep-01",
    title: "Linux Kernel Primitives: Namespaces (pid, net, mnt, ipc, uts, user) & Cgroups v1 vs v2",
    category: "Kernel Primitives & Isolation",
    readTimeMinutes: 24,
    overview: "Containers are not physical or virtual entities; they are ordinary Linux processes isolated by Linux kernel namespaces and constrained by control groups (cgroups). This masterclass investigates how the Linux kernel constructs the container illusion, the data structures behind the 6 primary namespaces, and the architectural leap from cgroups v1 multi-hierarchy to the unified cgroups v2 tree.",
    diagram: `+-------------------------------------------------------------------------+
|                  LINUX NAMESPACES & CGROUPS ARCHITECTURE                |
+-------------------------------------------------------------------------+
|                                                                         |
|  [HOST LINUX KERNEL (Physical RAM, Multi-Core CPU, Disks, Network NIC)] |
|                                                                         |
|  NAMESPACES (Isolates WHAT a process sees):                             |
|  +--------------------+---------------------+------------------------+  |
|  | PID Namespace      | NET Namespace       | MNT Namespace          |  |
|  | Virtual PID 1      | Isolated eth0, lo   | Private rootfs (/)     |  |
|  | Isolated proc table| Private iptables    | pivot_root boundary    |  |
|  +--------------------+---------------------+------------------------+  |
|  | IPC Namespace      | UTS Namespace       | USER Namespace         |  |
|  | Shared memory, msg | Hostname, domain    | UID 0 inside container |  |
|  | queues isolation   | isolated            | maps to UID 100000 host|  |
|  +--------------------+---------------------+------------------------+  |
|                                                                         |
|  CONTROL GROUPS (cgroups) (Controls HOW MUCH a process can use):       |
|  +-------------------------------------------------------------------+  |
|  | cgroups v2 Unified Process Tree (/sys/fs/cgroup/)                 |  |
|  | - memory.max: 512MB (Strict OOM threshold)                        |  |
|  | - cpu.max: 150000 100000 (1.5 cores CFS bandwidth throttle)       |  |
|  | - pids.max: 100 (Fork bomb protection)                           |  |
|  | - io.max: 20MB/s (Block I/O bandwidth throttling)                 |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Six Core Namespaces: Creating the Container Illusion",
        explanation: "Namespaces are per-process attributes tracked in the kernel `task_struct.nsproxy`. When a container is launched with `clone(CLONE_NEWPID | CLONE_NEWNET | CLONE_NEWNS | ...)`, the kernel creates new namespace descriptor instances. In the PID namespace, the container process receives PID 1, while maintaining its real global PID (e.g. 14582) on the host. In the MNT namespace, the process receives an isolated virtual mount table, decoupling it from host disk paths. In the NET namespace, it receives dedicated loopback and virtual ethernet interfaces.",
        codeExample: `# C implementation of container creation using clone() and namespaces:
#define _GNU_SOURCE
#include <sched.h>
#include <unistd.h>
#include <stdio.h>

int container_main(void *arg) {
    printf("Container PID inside namespace: %d\\n", getpid()); // Prints: 1
    execvp("/bin/sh", NULL);
    return 0;
}

int main() {
    char stack[65536];
    // Spawn process in new UTS, PID, and Mount namespaces:
    clone(container_main, stack + sizeof(stack),
          CLONE_NEWUTS | CLONE_NEWPID | CLONE_NEWNS | SIGCHLD, NULL);
    return 0;
}`
      },
      {
        subheading: "2. cgroups v1 vs cgroups v2: The Unified Hierarchy",
        explanation: "In cgroups v1, each resource controller (cpu, cpuacct, memory, blkio) managed an independent, disjoint hierarchy in `/sys/fs/cgroup/`. Because the memory controller did not know about the blkio controller, buffered writebacks to disk could not be throttled properly, leading to major I/O priority inversions. Cgroups v2 (standardized in kernel 5.8+ and modern Docker/K8s) unified all controllers under a single hierarchy. A process belongs to exactly one cgroup node, enabling comprehensive OOM tracking, unified pressure stall information (PSI), and rootless delegation.",
        codeExample: `# Inspecting unified cgroups v2 on modern Linux:
# Controller enabling in cgroups v2 parent:
$ cat /sys/fs/cgroup/cgroup.controllers
# cpuset cpu io memory hugetlb pids rdma

# Container cgroup settings under unified slice:
$ cat /sys/fs/cgroup/system.slice/docker-<id>.scope/memory.max
# 536870912  (512MB hard limit)

$ cat /sys/fs/cgroup/system.slice/docker-<id>.scope/memory.current
# 42106880   (Active memory footprint in bytes)`
      },
      {
        subheading: "3. User Namespaces: Root Without Host Privileges",
        explanation: "The User namespace (`CLONE_NEWUSER`) is the ultimate security primitive. It maps a range of UIDs and GIDs from the host to a different range inside the container. An application can run with root privileges (UID 0), configure network interfaces, and install packages *inside* its container namespace, while the host kernel enforces that this process is actually unprivileged host UID 100000. If an attacker escapes the container, they hold zero host root permissions.",
        codeExample: `# Map container UID 0 to host UID 100000 using /etc/subuid:
# /etc/subuid:
# dockremap:100000:65536

# In /etc/docker/daemon.json:
{
  "userns-remap": "default"
}

# When container runs as root inside:
$ docker run --rm alpine id
# uid=0(root) gid=0(root)

# On the host process table:
$ ps aux | grep sleep
# 100000   19420  0.0  sleep 1000  (Owned by unprivileged host UID 100000!)`
      }
    ],
    edgeCasesAndPitfalls: [
      "Process names in `/proc` can leak host details if the host `/proc` is mounted into the container.",
      "Cgroups v1 does not accurately charge page cache writes to the originating container, causing silent OOM stalls on neighboring services.",
      "Sharing the host network namespace (`--network host`) completely disables network namespace isolation, allowing the container to sniff host interface traffic."
    ],
    keyTakeaways: [
      "Namespaces isolate process views (PID, NET, MNT, IPC, UTS, USER); cgroups govern resource ceilings.",
      "Cgroups v2 provides a unified hierarchy with accurate buffered I/O accounting and memory pressure tracking.",
      "User namespaces map container root (UID 0) to unprivileged host UIDs, eliminating container escape blast radiuses."
    ]
  },
  {
    id: "docker-deep-02",
    title: "Container Runtime Hierarchy: Docker Daemon -> containerd -> containerd-shim -> runc",
    category: "Runtime Architecture",
    readTimeMinutes: 22,
    overview: "Docker Engine is not a single monolith, but a decoupled four-tier OCI architecture. This masterclass inspects the gRPC protocol communication between dockerd and containerd, the process lifecycle managed by containerd-shim, and how runc executes Linux system calls to instantiate containers before immediately exiting.",
    diagram: `+-------------------------------------------------------------------------+
|                  CONTAINER RUNTIME DECOUPLED ARCHITECTURE               |
+-------------------------------------------------------------------------+
|                                                                         |
|  [DOCKER CLI]                                                           |
|  docker run -d nginx:alpine                                             |
|         |                                                               |
|         | HTTP REST API via /var/run/docker.sock                        |
|         v                                                               |
|  [DOCKER DAEMON (dockerd)]                                              |
|  - Manages high-level volumes, networks, builds (BuildKit)              |
|  - Translates requests to gRPC calls                                    |
|         |                                                               |
|         | gRPC via /run/containerd/containerd.sock                      |
|         v                                                               |
|  [CONTAINERD DAEMON]                                                    |
|  - Pulls, unpacks, and stores OCI image layers (content store)          |
|  - Prepares OCI rootfs and config.json bundle                           |
|         |                                                               |
|         | Spawns containerd-shim per container                          |
|         v                                                               |
|  [CONTAINERD-SHIM]                                                      |
|  - Holds open stdio FIFO pipes; captures exit status code               |
|  - Decouples container from daemon (enables Live Restore updates)       |
|         |                                                               |
|         | Executes runc create / runc start                             |
|         v                                                               |
|  [RUNC (OCI Reference Runtime CLI)]                                     |
|  - Invokes clone(), setns(), pivot_root() system calls                  |
|  - Sets cgroups limits; spawns container application                    |
|  - EXITS IMMEDIATELY! (runc is NOT a persistent process!)               |
|         |                                                               |
|         v                                                               |
|  [CONTAINER PROCESS (nginx)] (Child of containerd-shim)                 |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Decomposition of the Monolith",
        explanation: "In Docker 1.10 and earlier, `dockerd` managed everything: builds, images, volumes, network interfaces, and process execution in a single giant daemon. If `dockerd` crashed or was updated, every container on the host died. To standardize containers and integrate with Kubernetes, Docker donated `runc` to the OCI and extracted `containerd` as an independent CNCF project. Today, `dockerd` is merely a high-level UX wrapper over `containerd`.",
        codeExample: `# Interact directly with containerd using the ctr CLI (bypassing dockerd):
$ sudo ctr images pull docker.io/library/alpine:latest
$ sudo ctr run -d --net-host docker.io/library/alpine:latest my-ctr-container sleep 1000

# Inspect running tasks in containerd:
$ sudo ctr task list
# TASK                PID      STATUS
# my-ctr-container    18450    RUNNING`
      },
      {
        subheading: "2. The Critical Role of containerd-shim",
        explanation: "Why have `containerd-shim`? If `containerd` directly monitored the container process, restarting `containerd` would orphan child processes or sever their standard I/O pipes. The shim process consumes only ~2MB of RAM. It sits between `containerd` and the container. When `dockerd` is stopped for an upgrade, the shim keeps the container alive, buffers stdout/stderr, and waits for `containerd` to reconnect upon restart without dropping a single packet.",
        codeExample: `# Verify the host process tree using pstree:
$ pstree -p $(pgrep dockerd)
# dockerd(840)───containerd(910)─┬─containerd-shim(14560)───nginx(14582)───nginx(14583)
#                                └─containerd-shim(15100)───postgres(15120)

# Notice: Killing dockerd leaves containerd-shim and nginx running unbothered!`
      },
      {
        subheading: "3. runc: The Stateless Execution Tool",
        explanation: "`runc` is written in Go and implements the OCI Runtime Specification. Given an unpacked root filesystem directory and a `config.json` metadata file, `runc` executes the exact sequence of Linux kernel system calls (`unshare`, `clone`, `sethostname`, `pivot_root`, `setuid`). Once the user application process (e.g. Nginx) is running, `runc` exits. It does not monitor or supervise the container.",
        codeExample: `# Run a container directly using runc without Docker or containerd:
$ mkdir -p /tmp/my-container/rootfs
$ cd /tmp/my-container
$ docker export $(docker create alpine) | tar -C rootfs -xf -
$ runc spec  # Generates config.json

# Execute container directly via runc:
$ sudo runc run test-box
/ # echo "Running inside raw runc container!"`
      }
    ],
    edgeCasesAndPitfalls: [
      "Alternative OCI runtimes like `crun` (written in C) execute container startup 5x faster with 50x less memory footprint than Go-based `runc`.",
      "If `containerd-shim` is killed (`kill -9`), the container process is orphaned and re-parented to host PID 1.",
      "Live Restore fails if `dockerd` is restarted across major version upgrades that alter runtime communication protocols."
    ],
    keyTakeaways: [
      "The runtime hierarchy splits responsibilities: dockerd (API) -> containerd (lifecycle) -> shim (I/O) -> runc (kernel execution).",
      "runc is an ephemeral command-line tool that exits immediately after spawning the container.",
      "containerd-shim holds I/O file descriptors open, enabling seamless Docker daemon restarts without container downtime."
    ]
  },
  {
    id: "docker-deep-03",
    title: "Storage Architecture: OverlayFS (lowerdir, upperdir, merged, workdir) & Copy-on-Write (CoW)",
    category: "Storage Architecture",
    readTimeMinutes: 24,
    overview: "Container image layers are immutable read-only snapshots combined into a single unified mount point. This masterclass dives into the Linux kernel OverlayFS storage driver, analyzing how lowerdir, upperdir, merged, and workdir directories interact, how Copy-on-Write handles mutations, and how whiteout files process deletions.",
    diagram: `+-------------------------------------------------------------------------+
|                  OVERLAYFS (overlay2) STORAGE ARCHITECTURE              |
+-------------------------------------------------------------------------+
|                                                                         |
|  [MERGED DIR] (Unified Virtual View presented to Container)             |
|  /app/server.js   /etc/nginx.conf (Modified)   /var/log/app.log (New)   |
|  ---------------------------------------------------------------------  |
|                                                                         |
|  [UPPER DIR] (Writable Container Layer - Ephemeral / CoW)               |
|  - /etc/nginx.conf (Copied-up from lowerdir on first write & modified)  |
|  - /var/log/app.log (Newly created file)                                |
|  - .wh.old_config (Whiteout character device masking deleted file)      |
|                                                                         |
|  ---------------------------------------------------------------------  |
|  [LOWER DIR] (Read-Only Image Layers - Immutable & Shared)              |
|  +-------------------------------------------------------------------+  |
|  | Layer 3: Application Code (/app/server.js, /etc/nginx.conf)       |  |
|  +-------------------------------------------------------------------+  |
|  | Layer 2: Node.js Runtime (/usr/local/bin/node)                    |  |
|  +-------------------------------------------------------------------+  |
|  | Layer 1: Alpine Base OS (/bin/sh, /lib/ld-musl.so.1)              |  |
|  +-------------------------------------------------------------------+  |
|                                                                         |
|  [WORK DIR] (Internal Linux scratchpad for atomic rename & updates)     |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Mechanics of the OverlayFS Mount",
        explanation: "OverlayFS is an in-tree Linux union filesystem driver. Unlike traditional union filesystems that operate in userspace, OverlayFS runs entirely in kernel VFS (Virtual Filesystem) space, delivering near-native I/O read performance. When Docker starts a container, it invokes `mount -t overlay overlay -o lowerdir=...,upperdir=...,workdir=... merged`. Multiple read-only image layers are separated by colons in `lowerdir` in order from topmost layer to base image layer.",
        codeExample: `# Inspect the exact kernel mount string used by Docker:
$ docker inspect -f '{{json .GraphDriver.Data}}' my-container | jq .
# {
#   "LowerDir": "/var/lib/docker/overlay2/<layer3>/diff:/var/lib/docker/overlay2/<layer2>/diff:/var/lib/docker/overlay2/<layer1>/diff",
#   "UpperDir": "/var/lib/docker/overlay2/<layer4>/diff",
#   "MergedDir": "/var/lib/docker/overlay2/<layer4>/merged",
#   "WorkDir": "/var/lib/docker/overlay2/<layer4>/work"
# }`
      },
      {
        subheading: "2. Copy-on-Write (CoW) and File Modifications",
        explanation: "When a container opens a file for reading (`O_RDONLY`), the kernel queries the `upperdir`. If missing, it traverses the `lowerdir` layers top-to-bottom and reads the file directly from the shared image layer with zero copy overhead. However, when a file is opened for writing (`O_WRONLY` or `O_RDWR`), OverlayFS triggers Copy-on-Write: the kernel copies the entire file from `lowerdir` into `upperdir` before executing the write. For a 5GB database file, modifying a single byte triggers a full 5GB copy-up, causing major latency spikes.",
        codeExample: `# Demonstrating CoW copy-up latency penalty:
# If a 1GB file resides in the base image layer:
$ docker run --rm my-heavy-image python -c "
import time
start = time.time()
with open('/large_1gb_file.bin', 'r+b') as f:
    f.seek(0)
    f.write(b'X') # Modifying single byte forces kernel to copy 1GB into upperdir!
print(f'Mutation took: {time.time() - start:.2f} seconds')
"
# Output: Mutation took: 4.82 seconds! (Avoid CoW for large mutable files; use Volumes!)`
      },
      {
        subheading: "3. Whiteouts and File Deletions",
        explanation: "Because `lowerdir` image layers are strictly read-only, a container cannot physically delete a file from lower layers. When `rm /path/to/file` is called inside a container, OverlayFS creates a **Whiteout file** in the `upperdir`. A whiteout is a special character device with major/minor device numbers set to `0/0`. When the kernel constructs the `merged` view, encountering a whiteout file masks the underlying file in lowerdir, rendering it invisible to directory listings (`getdents`).",
        codeExample: `# Inspecting a whiteout file on the host filesystem:
# Inside container:
$ docker exec -it my-container rm /etc/issue

# On the host machine, inspect the upperdir:
$ sudo ls -la /var/lib/docker/overlay2/<container-layer>/diff/etc/
# crw-r--r-- 1 root root 0, 0 Nov 4 10:15 .wh.issue
# Notice the 'c' device type and 0, 0 numbers: this is an OverlayFS whiteout!`
      }
    ],
    edgeCasesAndPitfalls: [
      "Renaming directories with `rename()` in OverlayFS can fail with `EXDEV` (Invalid cross-device link) if directory copy-up is not supported.",
      "Hard links broken across layers: modifying a hard-linked file copies it up, breaking the link with other sibling files.",
      "Deleting files in container layers does NOT reduce image size, but increases it by creating whiteout records."
    ],
    keyTakeaways: [
      "OverlayFS unifies lowerdir (read-only image) and upperdir (writable container) into merged.",
      "Copy-on-Write copies entire files up on first write; heavy write workloads must use Volumes.",
      "Deletions create character device whiteouts (.wh.<name>) to mask lower layer files."
    ]
  },
  {
    id: "docker-deep-04",
    title: "BuildKit Architecture: Low-Level Builder (LLB) DAG, Cache Invalidation & Advanced Mounts",
    category: "Build Engine & Optimization",
    readTimeMinutes: 24,
    overview: "BuildKit is Docker's next-generation build engine, replacing the legacy sequential builder. This masterclass inspects the Low-Level Builder (LLB) intermediate representation, directed acyclic graph parallelization, cache mount internals, and remote cache distribution.",
    diagram: `+-------------------------------------------------------------------------+
|                  BUILDKIT LLB CONCURRENT EXECUTION GRAPH                |
+-------------------------------------------------------------------------+
|                                                                         |
|  [DOCKERFILE SOURCE]                                                    |
|  Stage A: Compile Frontend        Stage B: Compile Backend Go API       |
|         |                                        |                      |
|         v                                        v                      |
|  [BUILD COMPILER: Generates LLB DAG (Directed Acyclic Graph)]            |
|                                                                         |
|      Node 1: Base Node (node:20)         Node 4: Base Go (golang:1.22)  |
|               |                                    |                    |
|               v                                    v                    |
|      Node 2: npm ci                       Node 5: go mod download       |
|               |                                    |                    |
|               v                                    v                    |
|      Node 3: npm run build                Node 6: go build              |
|               |                                    |                    |
|               +-----------------+------------------+                    |
|                                 | (Both stages run in PARALLEL!)        |
|                                 v                                       |
|               Node 7: Final Stage (Alpine Runtime)                      |
|               - COPY --from=Stage A (dist/)                             |
|               - COPY --from=Stage B (binary)                            |
|                                 |                                       |
|                                 v                                       |
|                     [FINAL OCI IMAGE MANIFEST]                          |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Low-Level Builder (LLB): The LLVM of Containers",
        explanation: "Just as LLVM defines an intermediate bytecode representation for compilers (C, Rust, Swift), BuildKit defines Low-Level Builder (LLB). LLB is a language-agnostic, protocol-buffer-encoded Directed Acyclic Graph (DAG). Every build step is an operation node with explicit input and output dependencies. Dockerfile frontends parse syntax and produce LLB. Independent nodes with no mutual dependencies execute simultaneously on multi-threaded worker pools.",
        codeExample: `# Dump and inspect the raw binary LLB definition generated by BuildKit:
$ docker buildx build --output type=local,dest=/tmp/out --progress=plain .

# Notice in build logs:
# => [internal] load build definition from Dockerfile
# => [stage-0 1/3] FROM node:20-alpine
# => [stage-1 1/3] FROM golang:1.22-alpine
# Notice stages execute concurrently with interleaved progress timestamps!`
      },
      {
        subheading: "2. Advanced Mount Types: Cache, Secret, and SSH",
        explanation: "BuildKit introduces specialized mounts to the `RUN` instruction: 1) `--mount=type=cache`: preserves package manager directories across builds with zero layer weight, 2) `--mount=type=secret`: exposes credentials in memory via `/run/secrets/` without baking bytes into image history, 3) `--mount=type=ssh`: tunnels host SSH agent sockets for private Git dependency cloning, and 4) `--mount=type=bind`: binds context files without executing a physical `COPY`.",
        codeExample: `# Advanced BuildKit Dockerfile leveraging all mount types:
# syntax=docker/dockerfile:1
FROM alpine:3.19
WORKDIR /app

# Mount cache for apk packages and bind package manifest directly without COPY:
RUN --mount=type=cache,target=/var/cache/apk \
    --mount=type=bind,source=requirements.txt,target=requirements.txt \
    --mount=type=secret,id=pypi_token \
    TOKEN=$(cat /run/secrets/pypi_token) && \
    apk add --update py3-pip && \
    pip install --break-system-packages -r requirements.txt`
      },
      {
        subheading: "3. Distributed Remote Caching in CI/CD",
        explanation: "In distributed CI systems (GitHub Actions, GitLab CI), runners are ephemeral: each build starts on a fresh VM with an empty local Docker cache. BuildKit solves this with external cache exporters (`--cache-to` and `--cache-from`). BuildKit packages layer cache metadata into an OCI image and pushes it to a remote registry (or AWS S3 / GitHub Actions cache backend). Subsequent builds download cache manifests and skip rebuilding identical steps.",
        codeExample: `# Export and import cache directly using container registry backend:
$ docker buildx build \
    --cache-to=type=registry,ref=my-registry.com/app:buildcache,mode=max \
    --cache-from=type=registry,ref=my-registry.com/app:buildcache \
    -t my-registry.com/app:latest \
    --push .

# mode=max exports cache layers for ALL stages, including intermediate builders!`
      }
    ],
    edgeCasesAndPitfalls: [
      "Cache mounts are local to the specific BuildKit daemon instance unless exported using experimental cache drivers.",
      "Failing to specify `# syntax=docker/dockerfile:1` prevents older Docker engines from utilizing newer BuildKit mount features.",
      "Using `ADD <url>` busts the layer cache on every build if the remote server returns a new ETag or Last-Modified header."
    ],
    keyTakeaways: [
      "BuildKit models builds as an LLB Directed Acyclic Graph, executing independent stages concurrently.",
      "Cache mounts eliminate redundant package downloads with zero final image layer bloat.",
      "Distributed cache exporters allow ephemeral CI runners to share build caches across jobs."
    ]
  },
  {
    id: "docker-deep-05",
    title: "Container Networking Deep Dive: veth Pairs, Network Namespaces, Bridge & iptables NAT",
    category: "Networking Deep Dive",
    readTimeMinutes: 24,
    overview: "How does a packet travel from a client on the internet, through the host network interface, across the Linux bridge, into a container's private network namespace, and back? This masterclass maps the exact packet forwarding path, examining virtual ethernet pairs, network namespaces, and iptables PREROUTING/POSTROUTING chains.",
    diagram: `+-------------------------------------------------------------------------+
|                  PACKET FLOW: HOST TO CONTAINER VIA IPTABLES            |
+-------------------------------------------------------------------------+
|                                                                         |
|  Incoming Packet: [Client: 203.0.113.50] -> [Host eth0: 198.51.100.10:80]|
|         |                                                               |
|         v                                                               |
|  [LINUX KERNEL NETFILTER - PREROUTING CHAIN]                            |
|  Rule: iptables -t nat -A PREROUTING -p tcp --dport 80                  |
|        -j DNAT --to-destination 172.17.0.2:8080                         |
|  (Destination IP rewritten to Container Private IP: 172.17.0.2:8080!)   |
|         |                                                               |
|         v                                                               |
|  [FORWARD CHAIN]                                                        |
|  Kernel routing table directs packet to software bridge: docker0        |
|         |                                                               |
|         v                                                               |
|  [DOCKER0 BRIDGE (172.17.0.1)]                                          |
|  Transmits packet to host veth interface: veth92b510c                   |
|         |                                                               |
|         v (Traverses Virtual Ethernet Wire)                             |
|  [CONTAINER NETWORK NAMESPACE]                                          |
|  Packet arrives on container interface: eth0 (172.17.0.2)               |
|  Nginx web server process receives connection on port 8080!             |
|                                                                         |
|-------------------------------------------------------------------------|
|                                                                         |
|  OUTGOING RESPONSE PACKET FLOW:                                         |
|  Container sends SYN-ACK -> docker0 bridge -> POSTROUTING Chain         |
|  Kernel MASQUERADE rule translates source back to Host: 198.51.100.10:80|
|  Client receives response seamlessly from Host IP!                      |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Inbound Packet Journey: Destination NAT (DNAT)",
        explanation: "When a container publishes a port (`-p 80:8080`), Docker does not listen on that socket with a userland server. Instead, Docker injects a `DNAT` (Destination Network Address Translation) rule into the `nat` table's `DOCKER` chain. When a packet hits the host interface `eth0:80`, the Linux Netfilter kernel subsystem rewrites the packet's destination IP to the container's private IP (`172.17.0.2`) and destination port to `8080`. The packet is then handed to the `FORWARD` chain.",
        codeExample: `# Inspect the exact DNAT rule matching incoming traffic:
$ sudo iptables -t nat -L DOCKER -n -v --line-numbers
# num  pkts bytes target prot opt in      out destination
# 1    1250 80240 DNAT   tcp  --  !docker0 *   0.0.0.0/0   tcp dpt:80 to:172.17.0.2:8080`
      },
      {
        subheading: "2. The Outbound Packet Journey: Source NAT (SNAT / MASQUERADE)",
        explanation: "How does a container without a public IP connect to the internet to download packages (`curl google.com`)? When a packet leaves the container via `eth0`, its source IP is `172.17.0.2`. Because RFC 1918 private IPs cannot be routed across the public internet, the packet crosses the `POSTROUTING` chain on the host. Netfilter's `MASQUERADE` target rewrites the packet's source IP to match the host's public IP (`198.51.100.10`), tracking the connection in the `conntrack` table so return packets are mapped back to the container.",
        codeExample: `# Inspect the host MASQUERADE rule for container internet access:
$ sudo iptables -t nat -L POSTROUTING -n -v
# pkts bytes target     prot opt in  out    source        destination
# 8410  512K MASQUERADE all  --  *   !docker0 172.17.0.0/16 0.0.0.0/0

# View active connection tracking state table (conntrack):
$ sudo conntrack -L -p tcp --orig-src 172.17.0.2
# tcp 6 431999 ESTABLISHED src=172.17.0.2 dst=142.250.190.46 sport=48210 dport=443 [ASSURED] ...`
      },
      {
        subheading: "3. Docker Isolation Chains & Inter-Container Filtering",
        explanation: "To prevent containers on different custom bridge networks from eavesdropping on each other, Docker constructs filtering chains in the `filter` table: `DOCKER-ISOLATION-STAGE-1` and `DOCKER-ISOLATION-STAGE-2`. Packets traveling between two different bridge interfaces (e.g. `br-1234` to `br-5678`) are automatically matched and dropped (`-j DROP`) unless explicitly connected.",
        codeExample: `# Trace docker isolation rules blocking cross-network traffic:
$ sudo iptables -S DOCKER-ISOLATION-STAGE-1
# -A DOCKER-ISOLATION-STAGE-1 -i br-1a2b -j DOCKER-ISOLATION-STAGE-2
# -A DOCKER-ISOLATION-STAGE-2 -o br-3c4d -j DROP  # Blocks cross-bridge routing!`
      }
    ],
    edgeCasesAndPitfalls: [
      "Flushing iptables rules (`iptables -F`) wipes out Docker's forwarding chains, breaking all container networking until the Docker daemon is restarted.",
      "Linux kernel IP forwarding (`net.ipv4.ip_forward=1`) must be enabled on the host, otherwise the kernel drops forwarded container packets.",
      "High packet-per-second workloads can exhaust the Linux kernel `nf_conntrack` table, dropping new TCP connections."
    ],
    keyTakeaways: [
      "Incoming traffic is routed to containers via DNAT in the Netfilter PREROUTING chain.",
      "Outgoing container traffic reaches the internet via MASQUERADE (SNAT) in the POSTROUTING chain.",
      "veth virtual ethernet interfaces bridge the host network stack to the container namespace."
    ]
  },
  {
    id: "docker-deep-06",
    title: "The PID 1 Problem, Zombie Reaping, and Unix Signal Forwarding in Containers",
    category: "Process Management & Signals",
    readTimeMinutes: 22,
    overview: "Why do containers running Node.js or Python leak memory, ignore Ctrl+C, and refuse to shut down gracefully? This masterclass analyzes the special role of PID 1 in the Unix process model, the mechanics of zombie process accumulation, and the implementation of subreaper init systems.",
    diagram: `+-------------------------------------------------------------------------+
|                  THE PID 1 PROBLEM & ZOMBIE ACCUMULATION                |
+-------------------------------------------------------------------------+
|                                                                         |
|  [UNHARDENED CONTAINER (Node.js as PID 1)]                              |
|                                                                         |
|  PID 1: node server.js                                                  |
|         |                                                               |
|         +-- Spawns Subprocess: sh (PID 40)                              |
|         |         |                                                     |
|         |         v (Subprocess completes and terminates)               |
|         |   [ZOMBIE PROCESS (PID 40 defunct)]                           |
|         |   Parent failed to call waitpid()!                            |
|         |   Process remains in Linux kernel process table forever!      |
|         |                                                               |
|  DOCKER STOP SENDS SIGTERM:                                             |
|  Linux kernel ignores default SIGTERM for PID 1!                        |
|  Node.js has no listener -> Ignores signal!                             |
|  10 seconds pass -> Docker forcefully sends SIGKILL! (Data corrupted!)  |
|                                                                         |
|-------------------------------------------------------------------------|
|                                                                         |
|  [HARDENED CONTAINER (tini / docker run --init as PID 1)]               |
|                                                                         |
|  PID 1: /sbin/docker-init (tini)                                        |
|         |                                                               |
|         +-- Reaps all orphaned zombie processes continuously!          |
|         +-- Forwards SIGTERM down to child process:                     |
|                   |                                                     |
|                   v                                                     |
|             PID 6: node server.js                                       |
|             (Receives SIGTERM, closes DB pools, exits in 200ms!)        |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Dual Responsibilities of Unix PID 1",
        explanation: "In Unix, the process assigned PID 1 is the ancestor of all other processes. It has two mandatory responsibilities: 1) **Zombie Reaping**: When any child process dies, its exit status must be collected by its parent via `waitpid()`. If the parent died first, the orphan is re-parented to PID 1. If PID 1 does not call `waitpid()`, the process metadata stays stuck in the kernel process table as a zombie (`Z`). 2) **Signal Handling**: The Linux kernel disables default signal handlers for PID 1 to prevent accidental crashes. If PID 1 does not install an explicit signal handler for `SIGTERM`, the kernel silently drops the signal.",
        codeExample: `# Demonstrating that PID 1 drops SIGTERM without an explicit listener:
# If you run alpine with raw 'sh':
$ docker run --rm -it alpine sh
# Pressing Ctrl+C or sending SIGTERM from host does NOTHING because 'sh'
# does not handle SIGTERM when running as PID 1!`
      },
      {
        subheading: "2. The Defunct Zombie Leak Catastrophe",
        explanation: "Consider a Node.js web server that executes a shell command on every incoming request: `child_process.exec('git log -1')`. If Node is PID 1, and the child process finishes, it becomes a zombie until Node reads it. In high-traffic microservices handling 5,000 requests per minute, a subtle bug can generate 100,000 zombie processes in an hour. Once the system hits the Linux `kernel.pid_max` limit, the entire physical host server freezes, crashing all neighboring containers.",
        codeExample: `# Inspect zombie process accumulation:
$ ps -ef | grep defunct
# node     14201 14190  0 10:00 ?        00:00:00 [git] <defunct>
# node     14205 14190  0 10:00 ?        00:00:00 [git] <defunct>

# Check host PID allocation ceiling:
$ cat /proc/sys/kernel/pid_max
# 32768  (Once total processes hit this number, the host kernel crashes!)`
      },
      {
        subheading: "3. How tini Acts as an In-Kernel Subreaper",
        explanation: "`tini` is a tiny C binary that invokes `prctl(PR_SET_CHILD_SUBREAPER, 1)`. This kernel system call marks `tini` as the designated foster parent for all orphaned grandchildren. `tini` runs a tight event loop: whenever a child process dies, `tini` receives `SIGCHLD` and immediately calls `waitpid(-1, &status, WNOHANG)`, freeing the kernel process table slot. When Docker sends `SIGTERM`, `tini` captures it and forwards it down to all child processes in the process group.",
        codeExample: `# Snippet of tini's signal forwarding loop (simplified C):
int main(int argc, char *argv[]) {
    prctl(PR_SET_CHILD_SUBREAPER, 1);
    pid_t child_pid = fork();
    if (child_pid == 0) {
        execvp(argv[1], &argv[1]); // Spawns application as child
    }

    // Reaping loop:
    while (1) {
        int status;
        pid_t pid = waitpid(-1, &status, WNOHANG);
        if (pid > 0) {
            // Zombie reaped successfully!
        }
        // Forward signals...
    }
}`
      }
    ],
    edgeCasesAndPitfalls: [
      "Running containers in shell form (`CMD node server.js`) spawns `/bin/sh -c` as PID 1, completely breaking signal delivery to Node.",
      "Go static binaries that do not spawn subprocesses and handle `os.Interrupt` natively do not strictly require an init system.",
      "Docker CLI `--init` uses `/sbin/docker-init`, which must exist on the host Docker Engine."
    ],
    keyTakeaways: [
      "PID 1 must reap orphaned zombie processes and install explicit handlers for SIGTERM.",
      "Standard application runtimes (Node, Python, Java) make terrible PID 1 processes.",
      "Use docker run --init or tini in ENTRYPOINT to ensure clean signal delivery and zombie cleanup."
    ]
  },
  {
    id: "docker-deep-07",
    title: "Container Hardening: User Namespaces, Linux Capabilities & Seccomp System Call Filtering",
    category: "Container Security & Isolation",
    readTimeMinutes: 24,
    overview: "Defense-in-depth container hardening requires layering multiple independent security controls. This masterclass inspects the triad of Linux security boundaries: User Namespaces for UID remapping, POSIX Capabilities for privilege deconstruction, and Seccomp BPF filters for kernel system call interception.",
    diagram: `+-------------------------------------------------------------------------+
|                  THE TRIAD OF CONTAINER KERNEL DEFENSES                 |
+-------------------------------------------------------------------------+
|                                                                         |
|  ATTACKER ATTEMPTS REMOTE CODE EXECUTION (RCE)                          |
|         |                                                               |
|         v                                                               |
|  [DEFENSE 1: NON-ROOT USER + USER NAMESPACES]                           |
|  - Container UID 0 maps to unprivileged Host UID 100000                 |
|  - Attacker cannot modify host /etc or access physical devices          |
|         |                                                               |
|         v                                                               |
|  [DEFENSE 2: LINUX CAPABILITIES (--cap-drop=ALL)]                       |
|  - Kernel capability bitmask stripped (No CAP_SYS_ADMIN, CAP_NET_RAW)   |
|  - Attacker cannot mount filesystems, load kernel modules, or sniff raw |
|         |                                                               |
|         v                                                               |
|  [DEFENSE 3: SECCOMP SYSTEM CALL BPF FILTER]                            |
|  - Kernel Seccomp filter inspects every single syscall                  |
|  - Dangerous syscalls (reboot, ptrace, keyctl, bpf) return EPERM        |
|  - Zero-day kernel exploits blocked at the system call boundary!        |
|         |                                                               |
|         v                                                               |
|  [DEFENSE 4: READ-ONLY ROOT FILESYSTEM (--read-only)]                   |
|  - Root filesystem is mounted read-only; attacker cannot write malware! |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Deconstructing Root: The Linux Capabilities Bitmask",
        explanation: "In Linux, root privileges are represented as a 64-bit integer bitmask in `task_struct.cred`. Each bit corresponds to an operational capability defined in `<linux/capability.h>`. Docker's default capability set drops ~26 capabilities but retains 14. Dropping all capabilities (`--cap-drop=ALL`) clears this bitmask completely. When the application attempts a privileged operation (e.g. `chown()`), the kernel checks `capable(CAP_CHOWN)`. If the bit is 0, the kernel instantly returns `EPERM`.",
        codeExample: `# Inspect the exact capability bitmask of a running process:
$ grep Cap /proc/$CONTAINER_PID/status
# CapInh: 0000000000000000
# CapPrm: 0000000000000400  (Only CAP_NET_BIND_SERVICE enabled!)
# CapEff: 0000000000000400
# CapBnd: 0000000000000400

# Decode the hexadecimal bitmask using capsh:
$ capsh --decode=0000000000000400
# 0x0000000000000400=cap_net_bind_service`
      },
      {
        subheading: "2. Seccomp BPF: Programmable System Call Firewalls",
        explanation: "Seccomp leverages Berkeley Packet Filter (BPF) programs compiled directly into the kernel. Before executing any system call (e.g. `sys_ptrace`), the kernel executes the container's Seccomp BPF filter. Docker's default profile is a JSON whitelist that evaluates syscall architecture, syscall number, and parameters. If an exploit attempts to call `kexec_load` (to replace the running host kernel), the BPF program immediately terminates the call without touching kernel memory.",
        codeExample: `# Extract and inspect Docker's default Seccomp JSON profile:
$ curl -s https://raw.githubusercontent.com/moby/moby/master/profiles/seccomp/default.json | jq .defaultAction
# "SCMP_ACT_ERRNO"  (Default: deny and return error!)

# Blocked syscalls in default profile:
$ curl -s https://raw.githubusercontent.com/moby/moby/master/profiles/seccomp/default.json | jq '.syscalls[] | select(.action=="SCMP_ACT_ERRNO") | .names' | head -10
# [ "acct", "add_key", "bpf", "clock_settime", "clone3", "create_module", "delete_module", "finit_module", "kexec_file_load", "kexec_load" ]`
      },
      {
        subheading: "3. AppArmor and SELinux: Mandatory Access Control",
        explanation: "While Seccomp restricts system call verbs, AppArmor and SELinux restrict filesystem noun targets. AppArmor uses pathname-based profiles (`/etc/apparmor.d/docker-default`), blocking access to sensitive `/proc` and `/sys` kernel debuggers. SELinux uses inode extended attributes (`security.selinux`), tagging files with security contexts (`system_u:object_r:container_file_t:s0:c1,c2`). Multi-Category Security (MCS) assigns unique random category pairs (`c1, c2`) to each container, mathematically isolating container disk volumes from each other.",
        codeExample: `# View SELinux security context labels on host storage:
$ ls -Z /var/lib/docker/overlay2/<layer>/merged
# system_u:object_r:container_file_t:s0:c124,c450 /var/lib/docker/overlay2/...
# Only processes running with matching MCS context c124,c450 can access these files!`
      }
    ],
    edgeCasesAndPitfalls: [
      "Running with `--privileged` completely disables all Seccomp, AppArmor, and Capabilities restrictions simultaneously.",
      "Custom Seccomp profiles blocking `clock_gettime` or `futex` will crash multi-threaded language runtimes (Node, Go, Java).",
      "Using `sudo` inside a container requires `CAP_SETUID` and `CAP_SETGID`, which should be avoided in production."
    ],
    keyTakeaways: [
      "Layering Non-Root, Cap-Drop, Seccomp, and Read-Only rootfs creates a defense-in-depth security perimeter.",
      "Linux Capabilities break root into ~40 granular permissions; --cap-drop=ALL strips all privileges.",
      "Seccomp uses BPF filters to block dangerous Linux kernel system calls before execution."
    ]
  },
  {
    id: "docker-deep-08",
    title: "Rootless Docker Architecture: User Namespaces, slirp4netns & Subordinate UIDs",
    category: "Container Security & Daemon Architecture",
    readTimeMinutes: 22,
    overview: "How does Rootless Docker allow non-privileged users to run Docker daemons and containers without sudo or root access? This masterclass inspects user namespace mapping via /etc/subuid, userspace network translation via slirp4netns, and rootless cgroups v2 integration.",
    diagram: `+-------------------------------------------------------------------------+
|                  ROOTLESS DOCKER SYSTEM ARCHITECTURE                    |
+-------------------------------------------------------------------------+
|                                                                         |
|  [HOST OPERATING SYSTEM (Non-Root User: uid 1000 - "ubuntu")]           |
|                                                                         |
|  User initiates rootless daemon:                                        |
|  $ dockerd-rootless.sh                                                  |
|         |                                                               |
|         v                                                               |
|  [USER NAMESPACE CREATION via newuidmap / newgidmap]                    |
|  Reads /etc/subuid: ubuntu:100000:65536                                 |
|  - Inside User Namespace: UID 0 is mapped to Host UID 1000              |
|  - Inside User Namespace: UIDs 1-65535 map to Host UIDs 100001-165535   |
|         |                                                               |
|         v                                                               |
|  [ROOTLESS DOCKER DAEMON (PID owned by host uid 1000!)]                 |
|  Socket: /run/user/1000/docker.sock                                     |
|         |                                                               |
|         +-- Storage: Rootless overlay2 (via fuse-overlayfs or native)   |
|         +-- Network: slirp4netns (Userspace TCP/IP stack without root)  |
|         +-- Cgroups: Systemd user slice (/sys/fs/cgroup/user-1000.slice)|
|                                                                         |
|  SECURITY IMPACT: Even a complete container breakout yields only host   |
|  UID 1000 privileges! The host /etc/shadow and kernel remain safe!      |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. Subordinate UIDs and GIDs (/etc/subuid)",
        explanation: "To run containers, a userland process must be able to allocate multiple virtual UIDs (e.g. root, daemon, nobody) inside the container. Linux kernel subordinate user IDs solve this via `/etc/subuid` and `/etc/subgid`. When a user runs Rootless Docker, the helper binaries `newuidmap` and `newgidmap` (which have setuid root permissions) configure the user namespace mapping table: the user's host UID (1000) maps to container root (UID 0), while 65,536 subordinate host UIDs map to internal container UIDs.",
        codeExample: `# View user's allocated subordinate UID block in /etc/subuid:
$ cat /etc/subuid
# ubuntu:100000:65536
# User 'ubuntu' is allocated 65,536 subordinate UIDs starting at 100000

# Inspect the active UID mapping of a rootless container:
$ docker run --rm alpine cat /proc/self/uid_map
#          0       1000          1  (Container UID 0 -> Host UID 1000)
#          1     100001      65535  (Container UIDs 1-65535 -> Host 100001-165535)`
      },
      {
        subheading: "2. Userspace Networking with slirp4netns",
        explanation: "Creating standard Linux bridge interfaces (`docker0`) and manipulating iptables requires `CAP_NET_ADMIN` in the root network namespace. Unprivileged users cannot create bridges. Rootless Docker solves this using `slirp4netns`. `slirp4netns` implements a complete user-mode TCP/IP stack in userspace. It connects to a TAP interface inside the container's network namespace and translates container packets into standard unprivileged userspace POSIX `socket()` calls on the host.",
        codeExample: `# Verify slirp4netns process running on the host:
$ ps aux | grep slirp4netns
# ubuntu   18520  0.1  0.0  slirp4netns --mtu 65520 --disable-host-loopback ... 18510 tap0

# Notice: Container reaches the internet without ANY host iptables manipulation!`
      },
      {
        subheading: "3. Rootless Storage: fuse-overlayfs vs Native Kernel OverlayFS",
        explanation: "Historically, the Linux kernel prevented unprivileged users from mounting OverlayFS due to security concerns, forcing Rootless Docker to use `fuse-overlayfs` (Userspace FUSE filesystem, which introduced ~20% I/O overhead). In Linux kernel 5.11+, unprivileged user namespace mounts for OverlayFS were merged into mainline Linux. Modern Rootless Docker uses native kernel `overlay2` directly, achieving identical disk speeds to root Docker.",
        codeExample: `# Inspect storage driver in rootless mode:
$ docker info | grep "Storage Driver"
# Storage Driver: overlay2 (Native unprivileged kernel OverlayFS in modern kernels!)`
      }
    ],
    edgeCasesAndPitfalls: [
      "Binding privileged ports below 1024 fails by default in rootless mode; requires sysctl `net.ipv4.ip_unprivileged_port_start=0`.",
      "Cgroups v1 does not support resource limiting in rootless mode; cgroups v2 (`systemd` driver) is mandatory.",
      "slirp4netns introduces minor latency overhead compared to native kernel bridge veth pairs."
    ],
    keyTakeaways: [
      "Rootless Docker runs dockerd and containers completely within an unprivileged host user namespace.",
      "/etc/subuid and /etc/subgid provide subordinate UID mapping without host root access.",
      "slirp4netns handles network translation in userspace without requiring host CAP_NET_ADMIN."
    ]
  },
  {
    id: "docker-deep-09",
    title: "OCI Specification & Image Manifests (Image Index, Multi-Arch, Config Blob & Layers)",
    category: "Image Specification & OCI",
    readTimeMinutes: 20,
    overview: "What is a container image under the hood? This masterclass breaks down the Open Container Initiative (OCI) Image Specification, analyzing the JSON manifest schema, the config blob, layer tarballs, content-addressable storage, and multi-architecture Image Indexes.",
    diagram: `+-------------------------------------------------------------------------+
|                  OCI IMAGE SPECIFICATION OBJECT GRAPH                   |
+-------------------------------------------------------------------------+
|                                                                         |
|  [IMAGE INDEX (Manifest List)] (application/vnd.oci.image.index.v1+json)|
|  - Points to multiple manifests for heterogeneous architectures         |
|  +------------------------------+-------------------------------+       |
|  | Manifest (linux/amd64)       | Manifest (linux/arm64)        |       |
|  +------------------------------+-------------------------------+       |
|                 |                                                       |
|                 v                                                       |
|  [OCI IMAGE MANIFEST] (application/vnd.oci.image.manifest.v1+json)      |
|  - mediaType: oci.image.manifest.v1                                     |
|  - config: sha256:ace17d5d883e... (Descriptor for Config JSON)          |
|  - layers: [                                                            |
|      { digest: sha256:d73429..., size: 3401490 },                       |
|      { digest: sha256:8f2a1b..., size: 1250201 }                        |
|    ]                                                                    |
|         |                                   |                           |
|         v                                   v                           |
|  [CONFIG JSON BLOB]              [LAYER TARBALLS]                       |
|  - architecture: "amd64"         - d73429...tar.gz (Alpine rootfs)      |
|  - os: "linux"                   - 8f2a1b...tar.gz (Node.js binary)     |
|  - rootfs: { diff_ids: [...] }                                          |
|  - config: { Env, Cmd, User }                                           |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The OCI Image Manifest Structure",
        explanation: "The Image Manifest is a small JSON document that acts as the single source of truth for an image. It defines three things: 1) `schemaVersion` (always 2), 2) `config` descriptor (hash, size, and mediaType of the configuration JSON blob), and 3) `layers` array (ordered list of content-addressable tarball digests from bottom to top). Registries verify that every layer digest exists in their blob store before accepting a manifest push.",
        codeExample: `# JSON representation of an OCI Image Manifest:
{
  "schemaVersion": 2,
  "mediaType": "application/vnd.oci.image.manifest.v1+json",
  "config": {
    "mediaType": "application/vnd.oci.image.config.v1+json",
    "digest": "sha256:ace17d5d883e589885...",
    "size": 1471
  },
  "layers": [
    {
      "mediaType": "application/vnd.oci.image.layer.v1.tar+gzip",
      "digest": "sha256:d734292770f8b1a65...",
      "size": 3401490
    }
  ]
}`
      },
      {
        subheading: "2. The Image Config JSON Blob",
        explanation: "The Config Blob contains execution and provenance metadata. It stores: 1) Architecture (`amd64`, `arm64`), 2) OS (`linux`, `windows`), 3) Runtime settings (`Env`, `Cmd`, `Entrypoint`, `WorkingDir`, `User`), 4) History array (the Dockerfile instructions that produced each layer), and 5) `diff_ids` (uncompressed SHA256 hashes of the layers). The `diff_ids` allow Docker to verify layer integrity after decompression.",
        codeExample: `# Inspect Config JSON blob directly using crane or skopeo:
$ crane config alpine:latest | jq .
# {
#   "architecture": "amd64",
#   "config": {
#     "Env": ["PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin"],
#     "Cmd": ["/bin/sh"]
#   },
#   "rootfs": {
#     "type": "layers",
#     "diff_ids": ["sha256:d734292770f8b1a..."]
#   }
# }`
      },
      {
        subheading: "3. Content-Addressability and DiffIDs",
        explanation: "Crucially, a layer has TWO hashes: 1) Distribution Digest: the SHA256 hash of the compressed `.tar.gz` file as transferred across the network, and 2) DiffID: the SHA256 hash of the uncompressed tar archive as extracted into the local storage driver. Because different gzip algorithms can compress the same files into slightly different byte streams, the `diff_id` guarantees that the actual extracted files match the intended state.",
        codeExample: `# Inspecting layer DiffIDs in local image:
$ docker inspect alpine:latest --format '{{json .RootFS.Layers}}'
# ["sha256:d734292770f8..."]`
      }
    ],
    edgeCasesAndPitfalls: [
      "Pushing an image manifest before pushing all of its referenced layer blobs causes the registry to reject the manifest with a 400 Blob Unknown error.",
      "Modifying an image's environment variable creates a brand new Config Blob hash, changing the overall image digest.",
      "OCI media types (`application/vnd.oci.*`) and Docker v2 media types (`application/vnd.docker.*`) are interchangeable in modern registries."
    ],
    keyTakeaways: [
      "An image is an OCI Manifest pointing to a Config JSON blob and an ordered list of Layer Tarballs.",
      "The Image Index acts as a fat manifest pointing to platform-specific manifests for multi-arch support.",
      "Storage is content-addressable: every layer and config is verified by its cryptographic SHA256 digest."
    ]
  },
  {
    id: "docker-deep-10",
    title: "Resource Throttling & CFS (Completely Fair Scheduler) Bandwidth Control with Cgroups",
    category: "Resource Management & Kernel Scheduler",
    readTimeMinutes: 22,
    overview: "How does the Linux kernel enforce CPU limits on Docker containers? This masterclass inspects the Completely Fair Scheduler (CFS) bandwidth controller, analyzing how cpu-period, cpu-quota, and cpu-shares translate into microsecond scheduling allocations and why CPU throttling causes severe p99 latency spikes.",
    diagram: `+-------------------------------------------------------------------------+
|                  LINUX CFS BANDWIDTH SCHEDULER & THROTTLING             |
+-------------------------------------------------------------------------+
|                                                                         |
|  Container Configuration: --cpus="1.5"                                  |
|  - cpu.cfs_period_us = 100,000 us (100ms standard scheduling window)    |
|  - cpu.cfs_quota_us  = 150,000 us (150ms total compute time permitted)  |
|                                                                         |
|  [CFS PERIOD 1: 0ms to 100ms]                                           |
|  Time:  0ms                       40ms                     100ms        |
|  Core 1: [ Thread A Running (40ms) ]                                    |
|  Core 2: [ Thread B Running (40ms) ]                                    |
|  Core 3: [ Thread C Running (40ms) ]                                    |
|  Core 4: [ Thread D Running (30ms) ]                                    |
|          --------------------------                                     |
|  TOTAL RUNTIME: 40 + 40 + 40 + 30 = 150,000 us (150ms QUOTA EXHAUSTED!) |
|                                                                         |
|  TIME 40ms to 100ms: CPU THROTTLING ACTIVE!                             |
|  All 4 container threads are SUSPENDED by the kernel for 60ms!          |
|  Incoming HTTP requests wait -> Severe p99 latency spikes!              |
|                                                                         |
|  [CFS PERIOD 2: 100ms mark]                                             |
|  Quota refreshes to 150,000 us; threads unpaused and resume!            |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The CFS Bandwidth Formula: Period and Quota",
        explanation: "The Linux kernel Completely Fair Scheduler allocates CPU time in discrete windows called periods (`cpu.cfs_period_us`, default 100,000 microseconds / 100ms). When you declare `--cpus=\"2.5\"`, Docker calculates: `quota = period * cpus = 100000 * 2.5 = 250000`. The container threads can execute on any available CPU core. As threads run, the kernel decrements their runtime from this shared quota pool. When the quota hits 0, the kernel moves the container cgroup from the runqueue to the throttled queue.",
        codeExample: `# Inspect CFS period and quota directly in Linux cgroups v1:
$ cat /sys/fs/cgroup/cpu/docker/<id>/cpu.cfs_period_us
100000
$ cat /sys/fs/cgroup/cpu/docker/<id>/cpu.cfs_quota_us
150000

# In cgroups v2 (unified max file: "<quota> <period>"):
$ cat /sys/fs/cgroup/system.slice/docker-<id>.scope/cpu.max
150000 100000`
      },
      {
        subheading: "2. The Multi-Threaded Quota Burn Trap",
        explanation: "A common operational mystery is why an application experiences severe CPU throttling when its average CPU utilization is only 30-40%! In multi-threaded applications (e.g. Java, Go, Node.js with worker threads), running 8 concurrent threads burns through the quota 8 times faster. If 8 threads execute simultaneously, a 100ms quota is burned in just 12.5ms! For the remaining 87.5ms of the CFS period, all threads are frozen in throttle, causing massive response latency spikes.",
        codeExample: `# Monitor CPU throttling metrics in real time:
$ cat /sys/fs/cgroup/system.slice/docker-<id>.scope/cpu.stat
# nr_periods: 1000
# nr_throttled: 450   # 45% of all periods were throttled!
# throttled_usec: 12500000 (12.5 seconds lost to throttling!)`
      },
      {
        subheading: "3. Reducing Latency Jitter by Tuning the Period",
        explanation: "In latency-critical microservices, waiting up to 80ms for the next CFS period to refresh creates unacceptable latency jitter. You can tune the CFS period down from 100ms to 20ms or 10ms using `--cpu-period`: e.g. `--cpu-period=20000 --cpu-quota=30000` (still 1.5 cores). Throttling pauses now last at most 10-15ms rather than 80ms, smoothing out p99 API latency distributions.",
        codeExample: `# Run with lower period to minimize throttle sleep duration:
$ docker run -d --name low-jitter-api \
    --cpu-period=20000 \
    --cpu-quota=40000 \
    my-api:latest`
      }
    ],
    edgeCasesAndPitfalls: [
      "Older Linux kernels (prior to 4.18/5.4) had a notorious CFS quota bug that caused unprovoked throttling; upgrading kernels is critical.",
      "Setting `--cpu-shares` does NOT throttle CPU; it only allocates relative weights under 100% host CPU saturation.",
      "Applications with large thread pools (e.g. 64 threads) will burn CFS quotas instantly; tune thread pool sizes to match assigned CPU limits."
    ],
    keyTakeaways: [
      "The CFS bandwidth controller divides time into periods (100ms) and throttles threads when quota is exhausted.",
      "Multi-threaded applications can burn multi-core quotas in milliseconds, triggering unexpected p99 latency spikes.",
      "Tuning cpu-period lower reduces latency jitter during throttle intervals."
    ]
  },
  {
    id: "docker-deep-11",
    title: "Docker Logging Subsystem: Drivers, Ring Buffers & Non-Blocking Mode",
    category: "Logging & Observability",
    readTimeMinutes: 20,
    overview: "How does Docker capture stdout and stderr from thousands of container processes without crashing the host? This masterclass analyzes the pipe-based logging architecture, blocking vs non-blocking ring buffers, and how runaway logs cause cascading system outages.",
    diagram: `+-------------------------------------------------------------------------+
|                  DOCKER CONTAINER LOGGING SUBSYSTEM                     |
+-------------------------------------------------------------------------+
|                                                                         |
|  [CONTAINER APPLICATION PROCESS]                                        |
|  printf("Processed order #1234\\n");                                     |
|         |                                                               |
|         v                                                               |
|  [LINUX STANDARD I/O FIFO PIPES (stdout / stderr)]                      |
|         |                                                               |
|         v                                                               |
|  [CONTAINERD-SHIM]                                                      |
|  Reads FIFO streams from container process                              |
|         |                                                               |
|         +---------------------------------------------------------+     |
|         | (BLOCKING MODE: Default)                                |     |
|         | If log driver stalls, FIFO pipe fills (64kB) ->         |     |
|         | Container write() syscall BLOCKS -> APP FREEZES!        |     |
|         |                                                         |     |
|         | (NON-BLOCKING MODE: mode=non-blocking)                  |     |
|         | Streams to in-memory circular ring buffer:              |     |
|         v                                                         v     |
|  [CIRCULAR IN-MEMORY RING BUFFER (4MB max-buffer-size)]                 |
|  - Fast O(1) buffer append                                              |
|  - If buffer is full: drops oldest log line; NEVER blocks app!          |
|         |                                                               |
|         v                                                               |
|  [LOGGING DRIVER DISPATCHER]                                            |
|  +--------------------+---------------------+------------------------+  |
|  | json-file / local  | syslog / journald   | awslogs / fluentd      |  |
|  | Writes rotated log | Writes to host OS   | Streams over network   |  |
|  | files on host disk | system loggers      | to cloud log aggregator|  |
|  +--------------------+---------------------+------------------------+  |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Linux Pipe FIFO Trap",
        explanation: "When Docker starts a container, `containerd-shim` creates named FIFO pipes (`/run/containerd/io/...`) connected to file descriptors 1 (stdout) and 2 (stderr). In Linux, an anonymous pipe has a fixed kernel buffer capacity of 64kB. In standard blocking logging, if the process consuming the pipe (the Docker daemon) slows down or stalls, the 64kB pipe fills up. Once full, the container's next `write()` syscall blocks in the kernel, freezing the application thread indefinitely.",
        codeExample: `# Simulating a blocked stdout pipe deadlock:
# If stdout cannot be flushed, the application freezes:
$ docker run --rm alpine sh -c '
  # High-volume output fills pipe instantly:
  yes "Flood" | head -n 10000000
'`
      },
      {
        subheading: "2. The Ring-Buffer Solution: mode=non-blocking",
        explanation: "To solve this deadlock hazard, Docker introduced `mode=non-blocking`. When enabled, Docker creates an in-memory circular ring buffer (configured via `max-buffer-size`, default 4MB). The container writes to the buffer asynchronously. A background worker thread drains the ring buffer and writes to the logging driver. If a network blip stalls CloudWatch or Fluentd, the ring buffer overflows and drops the oldest log messages, emitting a warning metric while keeping the container running.",
        codeExample: `# Run high-throughput application with non-blocking logging:
$ docker run -d --name resilient-service \
    --log-driver json-file \
    --log-opt mode=non-blocking \
    --log-opt max-buffer-size=8m \
    --log-opt max-size=20m \
    --log-opt max-file=5 \
    my-high-load-api`
      },
      {
        subheading: "3. Log Rotation Mechanics and File Locking",
        explanation: "When `max-size` (e.g. 20MB) is reached, Docker renames the active `<id>-json.log` to `<id>-json.log.1` and creates a fresh `<id>-json.log`. Once `max-file` is reached, the oldest archive is unlinked. If `compress: \"true\"` is enabled, rotated files are gzipped in the background, slashing disk consumption by 85%.",
        codeExample: `# Inspect rotated log files on host:
$ sudo ls -lh /var/lib/docker/containers/<container_id>/
# -rw-r----- 1 root root  20M Nov  4 10:00 <id>-json.log
# -rw-r----- 1 root root 2.1M Nov  4 09:30 <id>-json.log.1.gz
# -rw-r----- 1 root root 1.9M Nov  4 09:00 <id>-json.log.2.gz`
      }
    ],
    edgeCasesAndPitfalls: [
      "In non-blocking mode, if `max-buffer-size` is exceeded, log lines are permanently dropped with zero recovery.",
      "Logging sensitive passwords or tokens to stdout bypasses encryption and writes them to world-readable host log files.",
      "Using `docker logs -f` on a 50GB unrotated log file consumes 100% host CPU reading the giant file from disk."
    ],
    keyTakeaways: [
      "Blocking logging stalls container execution if stdout pipes or remote log collectors back up.",
      "mode=non-blocking isolates application throughput by buffering logs in an in-memory ring buffer.",
      "Enforce max-size and max-file on all logging drivers to guarantee deterministic disk usage."
    ]
  },
  {
    id: "docker-deep-12",
    title: "Multi-Stage Builds, Artifact Extraction & Minimalist Distroless Execution",
    category: "Image Optimization & Supply Chain",
    readTimeMinutes: 20,
    overview: "How do multi-stage Docker builds separate build environments from runtime images, and why are Google Distroless and scratch images the gold standard for production security? This masterclass analyzes artifact extraction, musl vs glibc compatibility, and zero-shell container execution.",
    diagram: `+-------------------------------------------------------------------------+
|                  MULTI-STAGE COMPILATION & DISTROLESS RUNTIME           |
+-------------------------------------------------------------------------+
|                                                                         |
|  [STAGE 1: HEAVYWEIGHT BUILDER] (golang:1.22-alpine / ~350MB)           |
|  - Full Go compiler, git, gcc, make, build tools                        |
|  - Pulls dependencies, compiles static binary                           |
|  - Binary compiled with stripped debug symbols (-ldflags="-s -w")       |
|         |                                                               |
|         | ARTIFACT EXTRACTION:                                          |
|         | COPY --from=builder /bin/server /app/server                   |
|         v                                                               |
|  [STAGE 2: DISTROLESS RUNTIME] (gcr.io/distroless/static / ~2MB!)       |
|  - ONLY contains:                                                       |
|    1) Application binary (/app/server)                                  |
|    2) CA Root Certificates (/etc/ssl/certs/ca-certificates.crt)         |
|    3) /etc/passwd entry for unprivileged 'nonroot' user (UID 65532)     |
|    4) Timezone data (/usr/share/zoneinfo)                               |
|  - ZERO SHELL (No /bin/sh, no /bin/bash)                                |
|  - ZERO PACKAGE MANAGERS (No apt, no apk)                               |
|  - ZERO LINUX UTILITIES (No curl, no wget, no cat, no ls)               |
|                                                                         |
|  SECURITY IMPACT: Shell-based RCE exploits are physically IMPOSSIBLE!   |
|                                                                         |
+-------------------------------------------------------------------------+`,
    deepDive: [
      {
        subheading: "1. The Attack Surface of Standard Base Images",
        explanation: "A standard Ubuntu or Debian base image contains over 300 packages: `bash`, `sed`, `grep`, `coreutils`, `curl`, and `apt`. If an attacker achieves Remote Code Execution (RCE) in your Node.js or Python application, they immediately use `/bin/sh` to download cryptominers (`curl | sh`), install network scanners (`apt-get install nmap`), or establish reverse shell connections back to their command-and-control server. By removing the shell and package manager, the attacker's toolkit is completely neutralized.",
        codeExample: `# Attacker attempting to exploit a Distroless container:
$ docker run --rm gcr.io/distroless/static-debian12 sh
# docker: Error response from daemon: failed to create task:
# exec: "sh": executable file not found in $PATH: unknown
# Result: ZERO shell execution possible!`
      },
      {
        subheading: "2. The Multi-Stage Artifact Extraction Pipeline",
        explanation: "Multi-stage builds allow developers to declare independent `FROM` lines. Each stage can use completely different base images. The final stage uses `COPY --from=<stage_name>` to surgically extract only compiled binaries, pruned `node_modules` production trees, or HTML/JS bundles. BuildKit discards the builder stage layers, guaranteeing that source code, git histories, and compilers never leak into production artifacts.",
        codeExample: `# Multi-stage Node.js React production build with Nginx Distroless:
# Stage 1: Build Webpack/Vite bundle:
FROM node:20-alpine AS web-builder
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Serve via ultra-lean unprivileged Nginx:
FROM nginxinc/nginx-unprivileged:alpine-slim
COPY --from=web-builder /src/dist /usr/share/nginx/html
USER 101
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]`
      },
      {
        subheading: "3. musl libc vs glibc in Minimalist Images",
        explanation: "Alpine Linux uses `musl libc`, while Debian, Ubuntu, and Red Hat use `glibc`. While `musl` is tiny (~600kB), compiling Go or Rust with CGO or running Python wheels with C extensions often requires `glibc`. Pre-compiled Python wheels (like `numpy` or `cryptography`) on Alpine must compile from source on every build (taking 15 minutes), whereas on `debian-slim` or `distroless` they install in 2 seconds via pre-built glibc wheels.",
        codeExample: `# For Python/Data Science: Use Debian-slim or Distroless instead of Alpine:
# FAST & RELIABLE:
FROM python:3.11-slim
RUN pip install --no-cache-dir numpy pandas  # Pre-built glibc wheel installs in 2s!`
      }
    ],
    edgeCasesAndPitfalls: [
      "Statically linked Go binaries built on Alpine (`CGO_ENABLED=1`) fail to run on `scratch` or Distroless unless compiled with `CGO_ENABLED=0`.",
      "Debugging a Distroless container in production requires using ephemeral debug containers (`docker debug` or Kubernetes ephemeral containers).",
      "Omitting CA root certificates from a `scratch` image causes all outgoing HTTPS API calls to fail with x509 certificate verification errors."
    ],
    keyTakeaways: [
      "Multi-stage builds compile artifacts in heavyweight SDK stages and extract only binaries to production.",
      "Google Distroless provides glibc compatibility while removing all shells and package managers.",
      "Static Go/Rust binaries deployed to scratch or distroless achieve sub-10MB sizes with near-zero CVEs."
    ]
  }
];

const outputPath = path.resolve(__dirname, '../data/docker.deep.json');
fs.writeFileSync(outputPath, JSON.stringify(deepDives, null, 2), 'utf-8');
console.log(`Successfully wrote ${deepDives.length} Deep Dive chapters to ${outputPath}`);
