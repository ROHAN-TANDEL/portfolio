const { createCard } = require('../docker_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 1,
    category: "Architecture, Engine & Container Internals",
    concept: "Virtual Machines vs Containers (Hypervisor vs Kernel Sharing)",
    priority: "must-know",
    difficulty: "beginner",
    question: "What is the architectural difference between Virtual Machines (VMs) and Docker containers?",
    quickAnswer: "Virtual Machines virtualize physical hardware via a Hypervisor (Type 1 or Type 2), running a complete guest operating system with its own kernel, memory management, and device drivers. Containers virtualize the operating system, sharing the host Linux kernel while isolating processes using kernel primitives (namespaces and cgroups).",
    detailedAnswer: "Because each VM runs an entire guest OS kernel, VMs require gigabytes of disk storage, gigabytes of dedicated RAM, and minutes to boot. In contrast, Docker containers are simply isolated Linux processes executing directly on the host kernel. Containers share the host kernel, take milliseconds to start, share memory dynamically, and introduce virtually zero CPU virtualization overhead (~1-2% vs 5-15% for VMs).",
    code: `# Inspect the host process table to see a running container is just a native host PID:
$ docker run -d --name nginx-demo nginx:alpine

# Find the container's host Process ID (PID):
$ docker inspect --format '{{.State.Pid}}' nginx-demo
14582

# On the host OS, inspect this PID directly:
$ ps -fp 14582
UID        PID  PPID  C STIME TTY          TIME CMD
root     14582 14560  0 10:15 ?        00:00:00 nginx: master process nginx -g daemon off;`,
    recallHint: "VMs virtualize hardware with separate guest OS kernels; Containers isolate processes sharing host kernel.",
    interviewTip: "Highlight that containers cannot run a different kernel architecture than the host (e.g. you cannot run native Windows kernel drivers directly on a Linux kernel without virtualization).",
    tags: ["containers", "vm", "hypervisor", "architecture", "kernel"],
    practice: [
      "Why can Docker Desktop on macOS or Windows run Linux containers?",
      "What are the security boundary differences between hypervisor hardware isolation and kernel namespace isolation?"
    ]
  }),

  createCard({
    idNum: 2,
    category: "Architecture, Engine & Container Internals",
    concept: "Linux Namespaces (pid, net, mnt, ipc, uts, user)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are Linux Namespaces, and what are the six core namespaces Docker uses to isolate containers?",
    quickAnswer: "Linux Namespaces partition kernel resources so that a process sees an isolated instance of system resources. The six core namespaces are: 1) PID (process IDs), 2) NET (network interfaces & routes), 3) MNT (mount points & filesystem), 4) IPC (shared memory & message queues), 5) UTS (hostname & NIS domain), and 6) USER (UID/GID mappings).",
    detailedAnswer: "Introduced in the Linux kernel between 2002 and 2013, namespaces are the foundation of container illusion. A containerized process believes it is PID 1 with its own `eth0` network card, `/` mount tree, and localhost hostname. In reality, the host kernel maps these virtual views to real host resources. For example, a process running as PID 1 inside a PID namespace maps to PID 14582 in the root host namespace.",
    code: `# List active namespaces for a specific container PID using lsns:
$ CONTAINER_PID=$(docker inspect -f '{{.State.Pid}}' nginx-demo)
$ sudo lsns -p $CONTAINER_PID

# Output:
#         NS TYPE   NPROCS   PID USER COMMAND
# 4026532488 mnt         2 14582 root nginx: master process
# 4026532489 uts         2 14582 root nginx: master process
# 4026532490 ipc         2 14582 root nginx: master process
# 4026532491 pid         2 14582 root nginx: master process
# 4026532492 net         2 14582 root nginx: master process
# 4026532493 user        2 14582 root nginx: master process`,
    recallHint: "Namespaces isolate WHAT a process can SEE: PID, NET, MNT, IPC, UTS, and USER.",
    interviewTip: "Always distinguish Namespaces (isolation/visibility) from Cgroups (resource allocation/metering). This is the #1 fundamental Linux container interview question.",
    tags: ["namespaces", "linux-kernel", "isolation", "pid", "netns"],
    practice: [
      "What happens if you enter a container's namespaces using `nsenter -t $PID -m -u -i -n -p`?",
      "How does the USER namespace allow running root (UID 0) inside a container while mapping to an unprivileged UID 100000 on the host?"
    ]
  }),

  createCard({
    idNum: 3,
    category: "Architecture, Engine & Container Internals",
    concept: "Control Groups (cgroups v1 vs cgroups v2)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are Linux Control Groups (cgroups), and what are the key differences between cgroups v1 and cgroups v2?",
    quickAnswer: "Cgroups regulate, limit, and account for resource usage (CPU, Memory, Disk I/O, Network bandwidth, PIDs) for groups of processes. Cgroups v1 used multi-hierarchy trees where each resource controller (cpu, memory) operated independently, causing resource deadlocks. Cgroups v2 unified all controllers under a single coherent process tree with improved out-of-memory (OOM) tracking and rootless support.",
    detailedAnswer: "While namespaces determine what a process can see, cgroups govern how much of the host resources a process can consume. Under cgroups v1, memory and block I/O controllers were uncoordinated, meaning page cache writebacks could not be throttled properly. In cgroups v2 (standard in modern Linux kernels 5.8+ and Docker 20.10+), a unified hierarchy allows seamless memory pressure stalls, PSI (Pressure Stall Information), and accurate container memory accounting including kernel memory.",
    code: `# Check whether host system is running cgroups v1 or v2:
$ docker info | grep "Cgroup"
# Output on modern host:
# Cgroup Version: 2
# Cgroup Driver: systemd

# Inspect memory limits directly in sysfs:
$ cat /sys/fs/cgroup/system.slice/docker-<container_id>.scope/memory.max
536870912  # (512MB limit in bytes)

# Set runtime memory and CPU limits:
$ docker run -d --name limited-app \
    --memory="512m" \
    --cpus="1.5" \
    --pids-limit=100 \
    nginx:alpine`,
    recallHint: "Cgroups control HOW MUCH a process can USE (CPU, RAM, IO, PIDs). v2 unifies hierarchy.",
    interviewTip: "Mention that Kubernetes and Docker mandate the `systemd` cgroup driver on modern Linux distros (rather than `cgroupfs`) to prevent dual-controller contention.",
    tags: ["cgroups", "cgroups-v2", "resource-limits", "oom", "kernel"],
    practice: [
      "What happens when a container exceeds its cgroup `memory.max` threshold?",
      "Why does `--pids-limit` protect the host against fork-bomb attacks?"
    ]
  }),

  createCard({
    idNum: 4,
    category: "Architecture, Engine & Container Internals",
    concept: "Container Runtime Hierarchy (dockerd, containerd, shim, runc)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Explain the four-tier container runtime execution stack: dockerd, containerd, containerd-shim, and runc.",
    quickAnswer: "1) `dockerd` (Docker Daemon) handles user API requests, image management, builds, and volumes. 2) `containerd` is an OCI-compliant daemon managing image distribution and container lifecycles. 3) `containerd-shim` serves as a parent process to the container, retaining stdio pipes and exit status without locking the daemon. 4) `runc` is the lightweight CLI tool that talks directly to the Linux kernel to create namespaces and cgroups, spawning the container process before exiting.",
    detailedAnswer: "Historically, Docker was a single monolithic daemon. To standardize container runtimes across the industry (and enable Kubernetes CRI), Docker decomposed its engine into modular OCI components: `dockerd` translates high-level CLI commands into gRPC calls to `containerd`. `containerd` unpacks the image rootfs and invokes `runc`. `runc` executes `clone()`, sets up namespaces and cgroups, runs the container command, and immediately terminates. `containerd-shim` stays alive as the container's parent process, decoupling the container's lifecycle from the Docker daemon.",
    code: `# Process hierarchy tree on Linux host:
# systemd (PID 1)
#   └─ dockerd (PID 840)
#        └─ containerd (PID 910)
#             └─ containerd-shim (PID 14560)
#                  └─ nginx (PID 14582) -> Actual container process!
# (Notice runc is NOT running: it created the container and exited!)

# Run containers using containerd directly (bypassing dockerd):
$ sudo ctr images pull docker.io/library/alpine:latest
$ sudo ctr run --rm -t docker.io/library/alpine:latest my-alpine sh`,
    recallHint: "dockerd (API/Builds) -> containerd (lifecycle) -> containerd-shim (orphan prevention) -> runc (kernel setup).",
    interviewTip: "Emphasize that `runc` terminates after spawning the container. If an interviewer asks 'Does runc run as a background daemon?', the answer is strictly NO.",
    tags: ["runtime", "dockerd", "containerd", "runc", "shim", "oci"],
    practice: [
      "Why does `runc` exit immediately after creating the container?",
      "How does `containerd-shim` allow updating or restarting `dockerd` without killing running containers (Live Restore)?"
    ]
  }),

  createCard({
    idNum: 5,
    category: "Architecture, Engine & Container Internals",
    concept: "Open Container Initiative (OCI) Specifications",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the Open Container Initiative (OCI), and what are its two core specifications?",
    quickAnswer: "The OCI is an open Linux Foundation governance body formed in 2015 to create vendor-neutral industry standards for container infrastructure. Its two foundational specifications are: 1) The Runtime Specification (`runtime-spec`, defining how to run a filesystem bundle with `config.json`), and 2) The Image Specification (`image-spec`, defining image manifest, layer tarballs, and configuration blobs).",
    detailedAnswer: "Before the OCI, Docker had a monopoly on the container image and execution format. When CoreOS created Rocket (rkt) and Kubernetes needed an agnostic runtime interface, Docker donated `runc` (the reference implementation of `runtime-spec`) and its image format to the Linux Foundation. Today, any OCI-compliant runtime (like `runc`, `crun`, `kata-containers`, `gVisor`) can run any OCI image produced by Docker, Podman, or Buildah.",
    code: `# Generate an OCI runtime bundle configuration using runc:
$ mkdir -p my-oci-container/rootfs
$ cd my-oci-container

# Export an Alpine image as rootfs:
$ docker export $(docker create alpine) | tar -C rootfs -xvf -

# Generate default OCI runtime specification (config.json):
$ runc spec

# View OCI config.json snippet:
# {
#   "ociVersion": "1.0.2",
#   "process": { "terminal": true, "user": { "uid": 0, "gid": 0 }, "args": ["sh"] },
#   "root": { "path": "rootfs", "readonly": true },
#   "linux": { "namespaces": [ { "type": "pid" }, { "type": "network" } ] }
# }

# Run container natively with runc (without Docker daemon!):
$ sudo runc run demo-container`,
    recallHint: "OCI: runtime-spec (how to execute rootfs + config.json via runc); image-spec (tar layers + manifest).",
    interviewTip: "Mention that alternative runtimes like `gVisor` (runsc) or `Kata Containers` implement the exact same OCI runtime-spec to provide sandboxed security without changing Docker/K8s.",
    tags: ["oci", "runtime-spec", "image-spec", "runc", "standards"],
    practice: [
      "How does the OCI Distribution Specification standardize container image registries (Docker Hub, GHCR, ECR)?",
      "Can an image built with Buildah or Kaniko be executed by Docker without conversion?"
    ]
  }),

  createCard({
    idNum: 6,
    category: "Architecture, Engine & Container Internals",
    concept: "The containerd-shim & Live Restore Architecture",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why does every container have a dedicated `containerd-shim` process, and how does it enable Docker 'Live Restore'?",
    quickAnswer: "`containerd-shim` acts as an intermediary parent process for the container. It: 1) Keeps standard I/O (stdin, stdout, stderr) FIFO pipes open even if Docker/containerd crashes or restarts, 2) Reports the container's exit status code back to containerd, and 3) Prevents PID 1 zombie reaper issues. It allows 'Live Restore', keeping containers running during Docker daemon upgrades.",
    detailedAnswer: "If `containerd` were the direct parent of all containers, restarting the `dockerd` or `containerd` daemon would cause the operating system kernel to send `SIGHUP`/`SIGKILL` to all child containers. By inserting the tiny, lightweight `containerd-shim` between `containerd` and the container process, the daemon can shut down, restart, or crash without severing the container's execution or file descriptors.",
    code: `# Configure Docker daemon for Live Restore in /etc/docker/daemon.json:
{
  "live-restore": true
}

# Reload configuration:
$ sudo systemctl reload docker

# Test: Run a container, then restart the entire Docker daemon:
$ docker run -d --name long-running alpine sleep 1000
$ sudo systemctl restart docker

# The container continues running with 0 downtime:
$ docker ps
# CONTAINER ID   IMAGE     COMMAND        STATUS
# e51b7294ac12   alpine    "sleep 1000"   Up 45 seconds`,
    recallHint: "containerd-shim holds stdio open and captures exit codes; enables Live Restore daemon restarts.",
    interviewTip: "Always recommend enabling `\"live-restore\": true` in enterprise production environments so Docker engine updates do not cause downtime for customer containers.",
    tags: ["containerd-shim", "live-restore", "reliability", "daemon", "production"],
    practice: [
      "What happens to container logs if `dockerd` is stopped while live-restore is enabled?",
      "Why is `live-restore` incompatible with Docker Swarm mode?"
    ]
  }),

  createCard({
    idNum: 7,
    category: "Architecture, Engine & Container Internals",
    concept: "Root Filesystem (rootfs) & pivot_root vs chroot",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is a container rootfs, and why does Docker use `pivot_root` instead of legacy `chroot`?",
    quickAnswer: "A `rootfs` is a directory tree containing the complete filesystem structure (`/bin`, `/etc`, `/lib`, `/usr`) needed to execute an OS userland. Docker uses `pivot_root` because it swaps the current root filesystem with a new one and unmounts the old host root, preventing chroot-escape security vulnerabilities.",
    detailedAnswer: "In traditional Unix, `chroot` changed the apparent root directory for the current process. However, a root process inside a `chroot` can easily escape back to the host filesystem by opening a file descriptor to the outer directory (`chroot-breakout`). `pivot_root` is a Linux system call that moves the entire root mount point to an old directory, installs the new container mount point as true root (`/`), and allows unmounting the old root. The container has zero memory references to the host filesystem.",
    code: `# Simplified conceptual workflow of pivot_root executed by runc:
# 1. Create a mount namespace
unshare(CLONE_NEWNS);

# 2. Bind mount the new rootfs onto itself
mount("/path/to/container/rootfs", "/path/to/container/rootfs", "none", MS_BIND | MS_REC, NULL);

# 3. Create a temporary directory for the old root
mkdir("/path/to/container/rootfs/.old_root");

# 4. Swap root filesystems atomically!
pivot_root("/path/to/container/rootfs", "/path/to/container/rootfs/.old_root");

# 5. Move to new root and unmount old host root
chdir("/");
umount2("/.old_root", MNT_DETACH);
rmdir("/.old_root");`,
    recallHint: "pivot_root swaps and unmounts host root; chroot only changes view and is vulnerable to escape.",
    interviewTip: "Mention that `pivot_root` requires the target to be a mount point, which is why container runtimes perform a recursive bind mount before executing `pivot_root`.",
    tags: ["rootfs", "pivot_root", "chroot", "security", "filesystem"],
    practice: [
      "How did attackers historically break out of `chroot` jails using open file handles (`fchdir`)?",
      "Can a container with an Alpine rootfs run on an Ubuntu host kernel?"
    ]
  }),

  createCard({
    idNum: 8,
    category: "Architecture, Engine & Container Internals",
    concept: "Copy-on-Write (CoW) Mechanics in Container Layers",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the Copy-on-Write (CoW) strategy work in Docker container layers?",
    quickAnswer: "All image layers in Docker are strictly read-only and shared across all containers. When a container starts, Docker mounts a thin, writable 'container layer' on top. When the container modifies an existing image file, the storage driver copies the file UP from the read-only layer into the writable layer (Copy-on-Write) before mutating it. Reads happen directly; writes copy first.",
    detailedAnswer: "Copy-on-Write maximizes storage efficiency and container startup speed. If 100 containers run the same 1GB Ubuntu image, the image consumes only 1GB of physical host disk, not 100GB. Each container gets an isolated writable layer that starts empty (0 bytes). If a container reads `/etc/nginx.conf`, it reads directly from the shared lower layer. If it edits the file, `overlay2` copies the file into the upper layer and writes the changes there, masking the original file.",
    code: `# Inspect container layer size vs virtual size:
$ docker ps -s
# CONTAINER ID   IMAGE          SIZE
# 3a1b4c9e8f12   nginx:alpine   1.2kB (virtual 23.5MB)
# SIZE: 1.2kB is the writable container layer (CoW modifications)
# VIRTUAL: 23.5MB is the shared read-only image layers

# View overlay2 directories on Linux:
$ docker inspect --format '{{json .GraphDriver.Data}}' nginx-demo | jq .
# {
#   "LowerDir": "/var/lib/docker/overlay2/<layer3>/diff:...",  (Read-only image layers)
#   "UpperDir": "/var/lib/docker/overlay2/<layer4>/diff",      (Writable container layer)
#   "MergedDir": "/var/lib/docker/overlay2/<layer4>/merged",   (Unified mount view)
#   "WorkDir": "/var/lib/docker/overlay2/<layer4>/work"
# }`,
    recallHint: "Image layers: read-only & shared. Container layer: writable. File modified -> copied up to writable layer.",
    interviewTip: "Explain why heavy write workloads (like databases) should NEVER write to the container CoW layer: CoW introduces latency for large files; use named volumes instead.",
    tags: ["cow", "copy-on-write", "storage-driver", "overlay2", "layers"],
    practice: [
      "Why does deleting a large file in a container layer fail to reduce the Docker image size?",
      "What is the I/O performance penalty when a container modifies a 5GB file stored in a lower read-only layer?"
    ]
  }),

  createCard({
    idNum: 9,
    category: "Architecture, Engine & Container Internals",
    concept: "Container Image Anatomy: Tarballs, Config Blob & Manifest",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are the three core structural components of an OCI/Docker container image?",
    quickAnswer: "1) **Layer Tarballs**: Compressed `.tar.gz` archives containing filesystem diffs. 2) **Config JSON**: Machine metadata defining environment variables, entrypoint, architecture, working directory, and layer DiffIDs (SHA256 hashes). 3) **Image Manifest**: A JSON document binding the config blob and ordered layer descriptors together.",
    detailedAnswer: "An image is not a single binary file. When you push or pull an image, Docker transmits content-addressable blobs verified by SHA256 hashes. The manifest tells the client: 'Here is the Config Blob hash, and here is the list of layer tarballs in bottom-to-top order'. When downloaded, Docker verifies each sha256 checksum, unpacks the tarballs into the storage driver directory, and reads the config JSON to know what command to execute.",
    code: `# Save an image to a tarball and inspect its internal contents:
$ docker save alpine:latest -o alpine.tar
$ tar -tvf alpine.tar

# Contents of an exported image:
# -rw-r--r-- manifest.json           # Maps layers to config
# -rw-r--r-- <hash>.json             # Config JSON (Env, Cmd, History)
# -rw-r--r-- repositories            # Tag metadata
# drwxr-xr-x <layer-hash>/           # Directory containing layer
# -rw-r--r-- <layer-hash>/layer.tar  # Raw rootfs tarball

# View manifest.json:
$ cat manifest.json | jq .
# [
#   {
#     "Config": "ace17d5d883e.json",
#     "RepoTags": ["alpine:latest"],
#     "Layers": ["d734292770f8/layer.tar"]
#   }
# ]`,
    recallHint: "Image = Manifest JSON (index) + Config JSON (metadata) + Ordered Layer Tarballs (rootfs diffs).",
    interviewTip: "Highlight content-addressability: layer IDs are cryptographic SHA256 hashes of their uncompressed contents. If two different images share identical layers, Docker only downloads and stores them once.",
    tags: ["image-anatomy", "manifest", "content-addressable", "tarball", "oci"],
    practice: [
      "What is the difference between a layer's compressed digest (distribution hash) and uncompressed DiffID?",
      "How does content-addressable storage enable cross-image layer deduplication?"
    ]
  }),

  createCard({
    idNum: 10,
    category: "Architecture, Engine & Container Internals",
    concept: "Docker Client-Server REST API & Socket (/var/run/docker.sock)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How does the Docker CLI communicate with the Docker daemon, and what is `/var/run/docker.sock`?",
    quickAnswer: "The Docker CLI is a REST client that communicates with `dockerd` (the server) over a Unix domain socket located at `/var/run/docker.sock` (or over TCP/TLS for remote daemons). The CLI sends HTTP requests over this socket to create, inspect, and manage containers.",
    detailedAnswer: "When you run `docker ps`, the CLI does not inspect the kernel directly. Instead, it issues an HTTP `GET /containers/json` over the Unix socket `/var/run/docker.sock`. Because Unix sockets use file system permissions, any user with write permissions to this socket effectively has full root control over the host operating system.",
    code: `# Query the Docker daemon directly using curl over the Unix domain socket:
$ sudo curl --unix-socket /var/run/docker.sock http://localhost/v1.43/info | jq .ServerVersion
"24.0.7"

# List running containers directly via raw HTTP REST API:
$ sudo curl --unix-socket /var/run/docker.sock http://localhost/v1.43/containers/json | jq .

# Connect CLI to a remote daemon over TCP with TLS:
$ export DOCKER_HOST="tcp://remote-docker-host:2376"
$ export DOCKER_TLS_VERIFY=1
$ export DOCKER_CERT_PATH="~/.docker/certs"
$ docker ps`,
    recallHint: "CLI is an HTTP client talking to dockerd via /var/run/docker.sock or TCP 2376 with TLS.",
    interviewTip: "Never expose port 2375 (unencrypted Docker TCP) to the public internet. Doing so allows anyone to spawn root privileged containers and compromise the server in seconds.",
    tags: ["docker-sock", "rest-api", "client-server", "daemon", "security"],
    practice: [
      "Why is adding a user to the `docker` Linux group equivalent to granting passwordless root `sudo` access?",
      "How do you inspect the HTTP requests sent by the Docker CLI using `docker --debug`?"
    ]
  }),

  createCard({
    idNum: 11,
    category: "Architecture, Engine & Container Internals",
    concept: "Inspecting Low-Level Metadata with docker inspect & Go Templates",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you extract specific runtime configuration details from containers using `docker inspect` and Go template formatting?",
    quickAnswer: "`docker inspect` outputs the entire runtime JSON state of a container, image, volume, or network. Using the `--format` (or `-f`) flag with Go template syntax allows surgical extraction of nested values (e.g. IP address, host PID, exit code, mount paths) without piping to external tools.",
    detailedAnswer: "In production automation scripts, parsing raw text output from `docker ps` is fragile. `docker inspect --format` provides a robust, native query mechanism backed by Go template expressions. Common functions include `{{.State.Pid}}`, `{{json .NetworkSettings}}`, `{{range .Mounts}}`, and conditional logic (`if / else`).",
    code: `# 1. Extract Container IP Address:
$ docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' my-container
172.17.0.2

# 2. Extract Host PID and Container Health Status:
$ docker inspect -f 'PID: {{.State.Pid}}, Health: {{.State.Health.Status}}' my-container
PID: 14582, Health: healthy

# 3. Extract all volume mount destinations:
$ docker inspect -f '{{range .Mounts}}{{.Source}} -> {{.Destination}}{{println}}{{end}}' my-container
/var/data/db -> /var/lib/postgresql/data

# 4. Filter inspect output with jq:
$ docker inspect my-container | jq '.[0].State.ExitCode'`,
    recallHint: "docker inspect -f '{{.State.Pid}}' extracts nested container runtime attributes natively.",
    interviewTip: "Using `docker inspect --format` in shell scripts demonstrates senior-level Linux/DevOps proficiency compared to piping commands through `grep | awk`.",
    tags: ["docker-inspect", "go-templates", "automation", "scripting", "cli"],
    practice: [
      "How do you extract environment variables from an image using `docker inspect`?",
      "What is the difference between inspecting a container ID vs an image ID?"
    ]
  }),

  createCard({
    idNum: 12,
    category: "Architecture, Engine & Container Internals",
    concept: "Docker Engine Architecture: BuildKit, SwarmKit & Plugins",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What modular subsystems make up the complete Docker Engine platform?",
    quickAnswer: "The Docker Engine consists of: 1) **Daemon (`dockerd`)**: Core API server and orchestrator. 2) **Runtime Subsystem (`containerd` & `runc`)**: Manages containers. 3) **BuildKit**: Next-gen concurrent build engine. 4) **Networking (`libnetwork`)**: Pluggable CNM networking. 5) **Volume Subsystem**: Storage management. 6) **SwarmKit**: Built-in multi-host clustering.",
    detailedAnswer: "Docker Engine is a modular platform. In modern versions, image building is delegated to BuildKit, container execution is delegated to containerd, and container networking is managed by libnetwork using the Container Network Model (CNM). Custom volume and network plugins can be installed to integrate with third-party SAN storage (Ceph, NetApp) or overlay networks (Weave, Calico).",
    code: `# View active engine components and versions:
$ docker version
# Client: Docker Engine - Community
#  Version:           26.0.0
# Server: Docker Engine - Community
#  Engine:            Version: 26.0.0
#  containerd:        Version: v1.6.28
#  runc:              Version: v1.1.12
#  docker-init:       Version: 0.19.0

# Inspect installed volume and network plugins:
$ docker info --format '{{json .Plugins}}' | jq .
# {
#   "Log": ["awslogs", "fluentd", "json-file", "local", "syslog"],
#   "Network": ["bridge", "host", "ipvlan", "macvlan", "null", "overlay"],
#   "Volume": ["local"]
# }`,
    recallHint: "Engine = dockerd (server) + containerd/runc (runtime) + BuildKit (builder) + libnetwork.",
    interviewTip: "Mention that BuildKit is now the default builder in modern Docker (`DOCKER_BUILDKIT=1` is standard), replacing the legacy sequential builder.",
    tags: ["docker-engine", "buildkit", "libnetwork", "plugins", "subsystems"],
    practice: [
      "How does BuildKit execute independent Dockerfile build stages concurrently?",
      "What is the Container Network Model (CNM) used by libnetwork?"
    ]
  })
];
