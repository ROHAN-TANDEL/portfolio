const { createCard } = require('../docker_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 73,
    category: "Container Security, Hardening & Isolation",
    concept: "Running as Non-Root User (USER directive)",
    priority: "must-know",
    difficulty: "beginner",
    question: "Why is running containers as `root` (default UID 0) a major security hazard, and how do you enforce a non-root user?",
    quickAnswer: "By default, containers execute as `root` (UID 0). Because the container shares the Linux kernel with the host, root inside an unhardened container is identical to root on the host OS! If a container breakout or RCE vulnerability occurs, the attacker immediately gains full root control of the host machine. Enforce a non-root user via `USER <uid>:<gid>` in the Dockerfile.",
    detailedAnswer: "A common misconception is that container root is a 'fake' virtualized user. In standard Docker (without User Namespaces), UID 0 inside a container is UID 0 in the host kernel. If the attacker escapes via a kernel exploit or a mounted Docker socket, they have unconstrained root access to the physical host. Creating a dedicated non-root user (e.g. UID 10001) limits an attacker's privileges to that specific unprivileged UID upon breach.",
    code: `# syntax=docker/dockerfile:1
FROM alpine:3.19

# 1. Create a dedicated unprivileged user and group with explicit IDs:
RUN addgroup -g 10001 appgroup && \
    adduser -u 10001 -G appgroup -D -s /sbin/nologin appuser

WORKDIR /app
COPY --chown=10001:10001 ./bin/api /app/api

# 2. MANDATORY: Switch to non-root user before ENTRYPOINT!
USER 10001:10001

EXPOSE 8080
ENTRYPOINT ["/app/api"]

# Verify at runtime that user is NOT root:
# $ docker run --rm my-app whoami
# appuser (UID 10001)`,
    recallHint: "Root inside container = root on host kernel! Always declare USER <uid>:<gid> (e.g. 10001:10001).",
    interviewTip: "Always specify numerical IDs (`USER 10001:10001`) instead of usernames (`USER appuser`). Kubernetes security policies (`runAsNonRoot`, `MustRunAsNonRoot`) validate numerical UIDs and may reject string usernames.",
    tags: ["non-root", "user-directive", "security", "least-privilege", "cis-benchmark"],
    practice: [
      "Why can't an unprivileged non-root user bind to ports below 1024 without `CAP_NET_BIND_SERVICE`?",
      "How do you verify the active UID inside a container using `docker exec my-app id`?"
    ]
  }),

  createCard({
    idNum: 74,
    category: "Container Security, Hardening & Isolation",
    concept: "Rootless Docker Daemon Architecture",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Rootless Docker, and how does it eliminate host root privileges for both the daemon and containers?",
    quickAnswer: "Rootless Docker runs both the Docker daemon (`dockerd`) and containers entirely inside an unprivileged user namespace without root access on the host. Even if an attacker achieves a complete container escape, they find themselves with only the privileges of an ordinary host user (e.g. `ubuntu`), completely preventing host takeover.",
    detailedAnswer: "In standard Docker, `dockerd` must run as host `root` to create network bridges and mount filesystems. Rootless Docker uses User Namespaces (`newuidmap`, `newgidmap`), subordinate UIDs (`/etc/subuid`), and `slirp4netns` (userspace networking). The user's UID 1000 maps to container UID 0. The host kernel strictly enforces that this 'root' container has zero true host root capabilities.",
    code: `# Install and run rootless Docker on Ubuntu as regular user:
$ sudo apt-get install -y uidmap dbus-user-session
$ dockerd-rootless-setuptool.sh install

# Export rootless socket path:
$ export DOCKER_HOST="unix:///run/user/1000/docker.sock"

# Verify daemon runs as unprivileged user:
$ docker info | grep "Rootless"
# Security Options:
#  rootless

# Notice: dockerd process on host is owned by user 1000, NOT root!
$ ps -u 1000 | grep dockerd
# 1000   18420  0.5  0.8 1450000 70000 ? Sl 10:00 0:02 dockerd`,
    recallHint: "Rootless Docker runs dockerd and containers as an ordinary host user; container escape yields 0 root privileges.",
    interviewTip: "Acknowledge the trade-offs of Rootless Docker: cgroups v1 resource limits are restricted (requires cgroups v2), and binding ports below 1024 requires sysctl `net.ipv4.ip_unprivileged_port_start=0`.",
    tags: ["rootless", "user-namespaces", "security", "hardening", "subuid"],
    practice: [
      "What is `/etc/subuid` and how does it allocate subordinate UID ranges for rootless containers?",
      "Why is `slirp4netns` used for network translation in rootless environments?"
    ]
  }),

  createCard({
    idNum: 75,
    category: "Container Security, Hardening & Isolation",
    concept: "Linux Capabilities & Principle of Least Privilege (--cap-drop)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What are Linux Capabilities, and why is `--cap-drop=ALL` followed by `--cap-add` an essential production security standard?",
    quickAnswer: "Linux divides root's monolithic privileges into distinct units called **Capabilities** (e.g. `CAP_CHOWN`, `CAP_NET_RAW`, `CAP_SYS_ADMIN`). Docker grants ~14 default capabilities to containers. The gold standard for hardening is: **`--cap-drop=ALL`** (strips all privileges), then surgically **`--cap-add`** only the exact capability the application strictly needs.",
    detailedAnswer: "Traditionally, Unix was binary: a process was either root (god mode) or unprivileged. Linux capabilities broke root down into ~40 granular permissions. Docker's default capability set includes `CAP_NET_RAW` (allowing ARP poisoning) and `CAP_MKNOD`. By dropping ALL capabilities, you neutralize 80% of container privilege escalation exploits. If an Nginx container needs to bind to port 80 as non-root, grant only `CAP_NET_BIND_SERVICE`.",
    code: `# 1. PRODUCTION SECURITY STANDARD: Drop all, whitelist only required capability:
$ docker run -d --name hardened-nginx \
    --cap-drop=ALL \
    --cap-add=NET_BIND_SERVICE \
    -p 80:80 \
    nginx:alpine

# 2. In Docker Compose:
# services:
#   api:
#     image: my-api:latest
#     cap_drop:
#       - ALL
#     cap_add:
#       - CHOWN
#       - SETUID

# 3. Verify active capabilities inside running container using capsh:
$ docker exec -it hardened-nginx capsh --print | grep Current
# Current: = cap_net_bind_service+eip`,
    recallHint: "Always run with --cap-drop=ALL, then selectively whitelist only required capabilities with --cap-add.",
    interviewTip: "Mention that dropping `CAP_NET_RAW` prevents malicious containers from executing ARP spoofing and packet sniffing attacks against neighboring containers on the same bridge network.",
    tags: ["capabilities", "cap-drop", "cap-add", "least-privilege", "hardening"],
    practice: [
      "What dangerous privileges are granted by `CAP_SYS_ADMIN` and `CAP_SYS_PTRACE`?",
      "Which capability allows an unprivileged user to bind to port 80 or 443?"
    ]
  }),

  createCard({
    idNum: 76,
    category: "Container Security, Hardening & Isolation",
    concept: "The Dangers of Privileged Mode (--privileged)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What happens when you run a container with `--privileged`, and why is it considered the ultimate security anti-pattern in production?",
    quickAnswer: "`--privileged` disables almost all container isolation: it grants ALL Linux capabilities, disables Seccomp filtering, disables AppArmor/SELinux profiles, and gives the container direct access to all host physical hardware devices in `/dev`. Any root process inside a `--privileged` container can escape and compromise the host in seconds.",
    detailedAnswer: "Running with `--privileged` effectively turns the container into host root with full hardware access. An attacker inside a privileged container can mount the host's physical hard drive partition directly (`mount /dev/sda1 /mnt`), edit `/mnt/etc/shadow` or add a root SSH key, and gain full unhindered control of the underlying Linux server. Never use `--privileged` in production; use surgical `--cap-add` or `--device` flags instead.",
    code: `# DISASTER ANTI-PATTERN: Complete container breakout in 3 commands!
$ docker run --rm -it --privileged ubuntu bash

# Inside the privileged container:
root@container:/# ls /dev/sda* # Attacker sees physical host drives!
/dev/sda  /dev/sda1  /dev/sda2

# Mount the host root filesystem directly:
root@container:/# mkdir /host_root && mount /dev/sda1 /host_root

# The attacker now has full read/write access to host /etc/shadow, cron, and SSH!
root@container:/# chroot /host_root  # HOST IS FULLY COMPROMISED!

# -------------------------------------------------------------
# SAFE PRODUCTION ALTERNATIVE:
# If you only need a specific host device (e.g. GPU, USB serial):
$ docker run --device=/dev/ttyUSB0 my-app`,
    recallHint: "--privileged grants all capabilities and exposes /dev; enables trivial 10-second host breakout.",
    interviewTip: "If an interviewer asks 'How do we give our container access to the GPU or USB camera?', answer: 'Use `--device=/dev/nvidia0` or the NVIDIA Container Toolkit, NEVER `--privileged`'.",
    tags: ["privileged-mode", "container-escape", "vulnerability", "anti-pattern", "security"],
    practice: [
      "Why do developers mistakenly use `--privileged` when building Docker-in-Docker (DinD)?",
      "What is the difference between `--device` and `--privileged`?"
    ]
  }),

  createCard({
    idNum: 77,
    category: "Container Security, Hardening & Isolation",
    concept: "Seccomp System Call Filtering Profiles",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is Seccomp (Secure Computing Mode), and how does Docker use Seccomp profiles to block dangerous Linux system calls?",
    quickAnswer: "Seccomp is a Linux kernel security facility that restricts which system calls (syscalls) a process can make. Docker applies a default Seccomp JSON profile that **blocks ~44 dangerous system calls** (out of ~450+ in Linux), including `reboot`, `sys_ptrace`, `kexec_load`, and `mount`, preventing kernel exploits even if running as root.",
    detailedAnswer: "The Linux kernel exposes hundreds of syscalls. Many of these syscalls (`keyctl`, `bpf`, `userfaultfd`) are rarely needed by web applications, but are prime targets for kernel privilege escalation exploits. Docker's default Seccomp profile blocks these syscalls and returns `EPERM` (Operation not permitted). In ultra-hardened environments, you can write a custom whitelist profile allowing only the ~50 syscalls your microservice strictly requires.",
    code: `# Run container with default Seccomp profile (Default):
$ docker run --rm alpine reboot
# reboot: Operation not permitted (Blocked by Seccomp!)

# DANGEROUS: Disabling Seccomp (Security Anti-Pattern!):
# $ docker run --security-opt seccomp=unconfined alpine

# Apply a custom strict Seccomp JSON profile:
$ docker run --rm -it \
    --security-opt seccomp=/path/to/strict-profile.json \
    my-app

# Snippet of custom Seccomp profile:
# {
#   "defaultAction": "SCMP_ACT_ERRNO",
#   "architectures": ["SCMP_ARCH_X86_64"],
#   "syscalls": [
#     {
#       "names": ["read", "write", "exit", "futex", "epoll_wait"],
#       "action": "SCMP_ACT_ALLOW"
#     }
#   ]
# }`,
    recallHint: "Seccomp filters Linux syscalls. Default profile blocks ~44 dangerous kernel syscalls like reboot and ptrace.",
    interviewTip: "Mention that Seccomp works alongside Capabilities: Capabilities check coarse-grained permissions, while Seccomp intercepts low-level system call execution in the kernel.",
    tags: ["seccomp", "syscalls", "kernel-security", "hardening", "defense-in-depth"],
    practice: [
      "How do you trace which system calls an application makes using `strace` to generate a custom Seccomp profile?",
      "What happens if a process attempts an unauthorized syscall blocked by Seccomp with action `SCMP_ACT_KILL`?"
    ]
  }),

  createCard({
    idNum: 78,
    category: "Container Security, Hardening & Isolation",
    concept: "AppArmor & SELinux Mandatory Access Control (MAC)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do AppArmor (Ubuntu/Debian) and SELinux (RHEL/CentOS) provide Mandatory Access Control for Docker containers?",
    quickAnswer: "AppArmor and SELinux are Linux Security Modules (LSM) that enforce Mandatory Access Control (MAC). Even if a process runs as root with full capabilities, the LSM profile overrides root, restricting which files can be read/written, which `/proc` and `/sys` entries can be accessed, and preventing raw socket creation.",
    detailedAnswer: "Discretionary Access Control (DAC) relies on standard file permissions (`rwxr-xr-x`). If root wants to overwrite `/proc/kcore`, DAC permits it. Mandatory Access Control (MAC) enforces system-wide security policies that root cannot bypass. On Ubuntu, Docker applies the `docker-default` AppArmor profile, which restricts writing to `/proc/sysrq-trigger`, mounting filesystems, and reading sensitive host files. On Red Hat, SELinux labels (`svirt_lxc_net_t`) isolate container filesystems using Multi-Category Security (MCS).",
    code: `# Verify active AppArmor profile applied to container on Ubuntu:
$ docker inspect -f '{{.AppArmorProfile}}' my-container
docker-default

# Apply a custom enterprise AppArmor profile:
$ sudo apparmor_parser -r -W /etc/apparmor.d/containers/my-custom-profile
$ docker run --security-opt apparmor=my-custom-profile my-app

# SELinux Volume Labeling (:z vs :Z):
# On RHEL/Fedora, host directories must be relabeled for container access:
# :z = Shared volume label across multiple containers
$ docker run -v /host/data:/app/data:z my-app
# :Z = Private volume label restricted strictly to this single container
$ docker run -v /host/data:/app/data:Z my-app`,
    recallHint: "AppArmor/SELinux enforce Mandatory Access Control (MAC) that even root cannot override. Use :z/:Z for SELinux mounts.",
    interviewTip: "Explain the `:z` vs `:Z` flag on RHEL/CentOS: if an engineer gets permission denied on a bind mount with SELinux enforcing, appending `:z` relabels the SELinux context so the container can access it.",
    tags: ["apparmor", "selinux", "mac", "lsm", "security-modules"],
    practice: [
      "What is the difference between SELinux `:z` (shared label) and `:Z` (private unshared label)?",
      "Why does Docker protect `/proc` and `/sys` using AppArmor in default containers?"
    ]
  }),

  createCard({
    idNum: 79,
    category: "Container Security, Hardening & Isolation",
    concept: "Preventing Privilege Escalation (--security-opt no-new-privileges)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What security risk does `--security-opt no-new-privileges:true` prevent?",
    quickAnswer: "It prevents container processes from gaining additional privileges through `setuid` or `setgid` binaries (like `su`, `sudo`, or `ping`). Even if an attacker finds an unpatched setuid vulnerability in an installed package inside the container, the Linux kernel refuses to escalate their privileges to root.",
    detailedAnswer: "In Unix, binaries with the `setuid` bit set (`-rwsr-xr-x`) execute with the permissions of the file owner (usually root) rather than the executing user. Attackers use misconfigured or vulnerable setuid binaries to escalate from an unprivileged user to root. Setting `no-new-privileges` instructs the kernel via `prctl(PR_SET_NO_NEW_PRIVS)` that no process in this container hierarchy can ever acquire new privileges via execve.",
    code: `# Run container with privilege escalation blocked:
$ docker run -d --name secure-app \
    --security-opt no-new-privileges:true \
    my-app

# In Docker Compose:
# services:
#   api:
#     image: my-app:latest
#     security_opt:
#       - no-new-privileges:true

# Test effect on setuid binaries:
$ docker run --rm --security-opt no-new-privileges:true --user 1000 alpine ping 127.0.0.1
# ping: permission denied (ping requires raw socket via setuid; blocked!)`,
    recallHint: "no-new-privileges:true blocks setuid/setgid privilege escalation binaries inside containers.",
    interviewTip: "Highlight that Kubernetes enforces `allowPrivilegeEscalation: false` by default in modern Pod Security Standards; `--security-opt no-new-privileges:true` is the exact Docker equivalent.",
    tags: ["no-new-privileges", "setuid", "privilege-escalation", "prctl", "hardening"],
    practice: [
      "How do attackers use setuid binaries (`find`, `vim`, `bash`) for local privilege escalation?",
      "Why should production multi-stage distroless images contain zero setuid binaries?"
    ]
  }),

  createCard({
    idNum: 80,
    category: "Container Security, Hardening & Isolation",
    concept: "Docker Daemon Hardening (/etc/docker/daemon.json)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What core security configurations should be enforced in production `/etc/docker/daemon.json`?",
    quickAnswer: "1) `\"no-new-privileges\": true` (blocks setuid escalation globally), 2) `\"userns-remap\": \"default\"` (maps container root to unprivileged host UID), 3) `\"live-restore\": true` (uptime during daemon restarts), 4) `\"userland-proxy\": false` (reduces attack surface by using pure iptables), and 5) `\"log-driver\": \"json-file\"` with size limits.",
    detailedAnswer: "Hardening should be applied at the daemon level so all containers inherit security defaults even if a developer forgets CLI flags. Enabling `userns-remap` is especially potent: if a container process runs as root (UID 0), the kernel translates that UID to host UID 100000. Even if the container escapes to the host, it has zero privileges on host files.",
    code: `# Production Hardened /etc/docker/daemon.json:
{
  "icc": false,                             # Disables inter-container communication on default bridge
  "no-new-privileges": true,                # Prevents setuid privilege escalation
  "userns-remap": "default",                # Maps container root to unprivileged host subuid
  "live-restore": true,                     # Keeps containers running during daemon updates
  "userland-proxy": false,                  # Disables docker-proxy; relies on kernel iptables
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5"
  },
  "storage-driver": "overlay2"
}`,
    recallHint: "Harden daemon.json: no-new-privileges: true, userns-remap: default, icc: false, live-restore: true.",
    interviewTip: "Mention `\"icc\": false`: it disables Inter-Container Communication on the default bridge network, preventing untrusted containers from port-scanning and eavesdropping on neighboring containers.",
    tags: ["daemon-json", "hardening", "userns-remap", "icc", "production-security"],
    practice: [
      "What is `\"icc\": false` and how does it restrict traffic between containers on the default bridge?",
      "How does `userns-remap` interact with host-mounted bind volume permissions?"
    ]
  }),

  createCard({
    idNum: 81,
    category: "Container Security, Hardening & Isolation",
    concept: "Securing the Docker TCP Socket with Mutual TLS (mTLS)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you securely expose the Docker daemon over a TCP socket using mutual TLS (mTLS) authentication?",
    quickAnswer: "Never expose port 2375 unencrypted! Expose port 2376 using mutual TLS (`tlsverify`): 1) Generate a Certificate Authority (CA), 2) Sign a server certificate for the daemon, 3) Sign client certificates for authorized users, and 4) Configure `dockerd` with `--tlsverify`, `--tlscacert`, `--tlscert`, and `--tlskey`. Clients must present valid signed certificates to connect.",
    detailedAnswer: "An unencrypted Docker TCP socket (port 2375) allows anyone with network access to issue `POST /containers/create` with a bind mount to the host's `/` root directory, giving them instantaneous root compromise without passwords. With mTLS on port 2376, the Docker daemon validates the cryptographic signature of the client's certificate against `ca.pem`. Connections without valid client certificates are rejected at the TLS handshake.",
    code: `# Configure daemon with mutual TLS in /etc/docker/daemon.json:
{
  "hosts": ["tcp://0.0.0.0:2376", "unix:///var/run/docker.sock"],
  "tls": true,
  "tlsverify": true,
  "tlscacert": "/etc/docker/certs/ca.pem",
  "tlscert": "/etc/docker/certs/server-cert.pem",
  "tlskey": "/etc/docker/certs/server-key.pem"
}

# Connect securely from client machine:
$ docker --tlsverify \
    --tlscacert=~/.docker/ca.pem \
    --tlscert=~/.docker/cert.pem \
    --tlskey=~/.docker/key.pem \
    -H=tcp://remote-server.company.com:2376 \
    ps`,
    recallHint: "Port 2375 is unencrypted (DANGEROUS). Port 2376 requires mutual TLS (tlsverify with CA, cert, and key).",
    interviewTip: "In security audits, Shodan constantly discovers thousands of unsecured Docker port 2375 daemons actively being hijacked for cryptomining. Stress mTLS as non-negotiable.",
    tags: ["mtls", "tlsverify", "tcp-socket", "certificates", "daemon-security"],
    practice: [
      "How do attackers compromise a host when port 2375 is exposed to the public internet?",
      "How does `docker context create` store remote TLS credentials for seamless CLI switching?"
    ]
  }),

  createCard({
    idNum: 82,
    category: "Container Security, Hardening & Isolation",
    concept: "Docker Socket Mount Escape Vector (/var/run/docker.sock)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why is mounting `/var/run/docker.sock` into a container equivalent to giving that container full root access to the host machine?",
    quickAnswer: "The Docker socket exposes the full Docker Engine REST API. Any process that can communicate with `/var/run/docker.sock` can instruct the host daemon to spawn a new privileged container mounting the host's physical root filesystem (`-v /:/host`), escape the container jail, and execute arbitrary root commands on the host.",
    detailedAnswer: "Developers frequently mount `/var/run/docker.sock` into CI/CD build agents (Jenkins, GitLab Runner) or monitoring tools (Portainer) so they can build or restart containers ('Docker-outside-of-Docker'). However, if a vulnerable application in that container is compromised, the attacker simply runs `curl -X POST --unix-socket /var/run/docker.sock` to create a backdoor root container on the host OS.",
    code: `# DISASTER ANTI-PATTERN: Mounting docker.sock into an untrusted container!
$ docker run -d -v /var/run/docker.sock:/var/run/docker.sock my-ci-runner

# How an attacker escalates from inside this container to HOST ROOT:
$ docker run --rm -v /:/host-root alpine chroot /host-root \
    useradd -m -s /bin/bash -p '$6$hashedpassword' hacker && \
    usermod -aG sudo hacker
# RESULT: Attacker has created a root sudo user directly on the host machine!

# -------------------------------------------------------------
# PRODUCTION REMEDIATION:
# 1. Use unprivileged container builders (Kaniko, Buildah) that don't need docker.sock!
# 2. Use a Docker socket proxy (e.g. tecnativa/docker-socket-proxy) allowing ONLY GET requests!`,
    recallHint: "Mounting /var/run/docker.sock = root access to host. Use Kaniko/Buildah or socket proxies instead.",
    interviewTip: "Recommend using tools like `tecnativa/docker-socket-proxy` for monitoring tools: it exposes a restricted API endpoint that permits `GET /containers/json` while blocking `POST /containers/create`.",
    tags: ["docker-sock-escape", "privilege-escalation", "security", "vulnerability", "kaniko"],
    practice: [
      "How does Google Kaniko build container images inside Kubernetes without needing `docker.sock`?",
      "How do you restrict `/var/run/docker.sock` using an Nginx/HAProxy reverse proxy filter?"
    ]
  }),

  createCard({
    idNum: 83,
    category: "Container Security, Hardening & Isolation",
    concept: "CIS Docker Benchmark Compliance & Auditing",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is the CIS Docker Benchmark, and what automated tools exist to audit host and container compliance?",
    quickAnswer: "The **Center for Internet Security (CIS) Docker Benchmark** is a vendor-neutral consensus guide providing 100+ prescriptive configuration rules for securing Docker hosts, daemon configs, container runtime profiles, and image baselines. Automated auditing tools include **`docker-bench-security`** and Trivy.",
    detailedAnswer: "In enterprise compliance audits (SOC2, PCI-DSS, HIPAA), infrastructure must demonstrate adherence to CIS benchmarks. The benchmark covers 7 sections: 1) Host configuration (separate partitions for `/var/lib/docker`, auditing rules), 2) Docker daemon configuration (logging, TLS, no-new-privileges), 3) Daemon files (permissions on `/etc/docker`), 4) Container images, 5) Container runtime, 6) Security operations, and 7) Swarm security.",
    code: `# Run the official CIS Docker Benchmark audit tool on your host:
$ git clone https://github.com/docker/docker-bench-security.git
$ cd docker-bench-security
$ sudo ./docker-bench-security.sh

# Sample Audit Output:
# [INFO] 1 - Host Configuration
# [PASS] 1.1.1 - Ensure a separate partition for containers has been created
# [WARN] 1.1.2 - Ensure only trusted users are allowed to control Docker daemon
# [INFO] 2 - Docker daemon configuration
# [WARN] 2.1 - Ensure network traffic is restricted between containers on default bridge
# [PASS] 2.2 - Ensure 'logging driver' is configured properly
# [FAIL] 2.8 - Ensure user namespace support is enabled (userns-remap)`,
    recallHint: "CIS Docker Benchmark: 100+ security rules for host, daemon, and images. Audit via docker-bench-security.",
    interviewTip: "Mention integrating `docker-bench-security` into your Terraform / Ansible provisioning pipelines to automatically verify hardening on newly minted Docker nodes.",
    tags: ["cis-benchmark", "audit", "compliance", "docker-bench", "hardening"],
    practice: [
      "Why does CIS Benchmark rule 1.1 mandate a separate disk partition for `/var/lib/docker`?",
      "How does `auditd` monitor changes to Docker daemon configuration files?"
    ]
  }),

  createCard({
    idNum: 84,
    category: "Container Security, Hardening & Isolation",
    concept: "Defense-in-Depth Container Hardening Checklist",
    priority: "must-know",
    difficulty: "intermediate",
    question: "Summarize the 6 golden rules of the Defense-in-Depth container security model.",
    quickAnswer: "1) **Non-root user**: `USER 10001:10001`. \n2) **Drop capabilities**: `--cap-drop=ALL` (add only needed). \n3) **Read-only rootfs**: `--read-only` with `tmpfs`. \n4) **Prevent escalation**: `--security-opt no-new-privileges:true`. \n5) **Resource boundaries**: Set `--memory` and `--cpus`. \n6) **Minimal base image**: Use Distroless or Alpine with 0 CVEs.",
    detailedAnswer: "True security relies on layered defense (Defense-in-Depth). If an attacker finds a remote code execution vulnerability in your web framework, Rule #6 (Distroless) prevents them from running bash. If they execute binary exploits, Rule #1 (Non-root) stops them from modifying system files. If they attempt setuid escalation, Rule #4 stops them. If they attempt kernel exploitation, Rule #2 (Capabilities) and Seccomp block them. If they attempt a fork bomb, Rule #5 kills them.",
    code: `# The Ultimate Hardened Docker Run Command:
$ docker run -d \
    --name secure-production-app \
    --user 10001:10001 \
    --cap-drop=ALL \
    --cap-add=NET_BIND_SERVICE \
    --read-only \
    --tmpfs /tmp:rw,noexec,nosuid,size=64m \
    --security-opt no-new-privileges:true \
    --memory=512m \
    --cpus=1.0 \
    --pids-limit=100 \
    --restart=unless-stopped \
    -p 8080:8080 \
    my-hardened-app:latest`,
    recallHint: "Defense-in-depth: Non-root + Cap-drop ALL + Read-only rootfs + No-new-privs + Resource limits + Distroless.",
    interviewTip: "Reciting this 6-point checklist verbatim in technical interviews immediately signals senior DevSecOps competency.",
    tags: ["defense-in-depth", "hardening-checklist", "production-security", "best-practices", "devsecops"],
    practice: [
      "How do you translate this hardened `docker run` command into a Kubernetes PodSecurityContext?",
      "Why does combining `--read-only` with `--tmpfs /tmp:noexec` completely prevent in-memory malware persistence?"
    ]
  })
];
