const { createCard } = require('../docker_builder_helper.cjs');

module.exports = [
  createCard({
    idNum: 97,
    category: "Logging, Monitoring, Resource Limits & Telemetry",
    concept: "Docker Logging Drivers Ecosystem (json-file, local, syslog, awslogs)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What logging drivers does Docker support, and what is the difference between `json-file` and the newer `local` driver?",
    quickAnswer: "Docker supports pluggable drivers: `json-file` (default, stores JSON on disk), `local` (binary format with automatic rotation), `syslog`, `journald`, `fluentd`, `awslogs` (CloudWatch), `gelf`, and `splunk`. The newer `local` driver uses a compact binary ring-buffer with automatic 100MB rotation enabled by default, preventing disk exhaustion without manual config.",
    detailedAnswer: "In the default `json-file` driver, logs are formatted as JSON text and appended to `/var/lib/docker/containers/<id>/<id>-json.log`. Without explicit rotation flags, this file grows indefinitely. The `local` driver (introduced in Docker 18.09) stores logs in an internal binary format with built-in compression. It automatically limits total storage to 100MB (5 files of 20MB each) and delivers higher I/O write throughput.",
    code: `# 1. Run container using the compact local driver with rotation:
$ docker run -d --name secure-logs \
    --log-driver local \
    --log-opt max-size=50m \
    --log-opt max-file=3 \
    nginx:alpine

# 2. Configure global default logging driver in /etc/docker/daemon.json:
{
  "log-driver": "local",
  "log-opts": {
    "max-size": "20m",
    "max-file": "5",
    "compress": "true"
  }
}

# 3. Stream logs directly to AWS CloudWatch:
# $ docker run --log-driver=awslogs \
#     --log-opt awslogs-region=us-east-1 \
#     --log-opt awslogs-group=/docker/production \
#     my-app`,
    recallHint: "json-file = JSON on disk (grows forever without config). local = binary ring-buffer with auto-rotation.",
    interviewTip: "Mention that switching the global default to `\"log-driver\": \"local\"` in `/etc/docker/daemon.json` is a premier best practice to prevent junior developers from blowing up host disks with unrotated json-file logs.",
    tags: ["logging-drivers", "json-file", "local-driver", "awslogs", "log-rotation"],
    practice: [
      "Where are container log files physically stored on a Linux host?",
      "Why does a container generating 10,000 log lines per second cause disk I/O bottlenecks in `json-file` mode?"
    ]
  }),

  createCard({
    idNum: 98,
    category: "Logging, Monitoring, Resource Limits & Telemetry",
    concept: "Non-Blocking Logging Mode (mode=non-blocking)",
    priority: "must-know",
    difficulty: "advanced",
    question: "Why can a slow or failing logging driver freeze a container's application execution, and how does `mode=non-blocking` prevent it?",
    quickAnswer: "By default, Docker logging operates in **blocking mode** (`mode=blocking`). If the logging driver buffer fills up (e.g. high stdout volume, or remote Syslog/AWS CloudWatch is lagging), the container's `stdout`/`stderr` write calls block. The application's main thread pauses on `console.log()` or `print()`, freezing the container! **`mode=non-blocking`** places an in-memory ring buffer between the container and driver, dropping logs if the buffer fills rather than freezing application execution.",
    detailedAnswer: "In standard blocking mode, writing to stdout is a synchronous pipe operation. When logging to remote network backends (like Fluentd, Syslog, or AWS CloudWatch), a network hiccup or backpressure stalls the logging daemon. The pipe fills up (64kB Linux pipe buffer limit), and the containerized process blocks indefinitely on its next `write()` syscall. With `mode=non-blocking`, logs enter a dedicated circular buffer (default 4MB). If the remote collector stalls, oldest logs are dropped, but the business application continues processing customer transactions at full speed.",
    code: `# Configure non-blocking logging with a 4MB memory buffer:
$ docker run -d --name resilient-api \
    --log-driver json-file \
    --log-opt mode=non-blocking \
    --log-opt max-buffer-size=4m \
    --log-opt max-size=20m \
    --log-opt max-file=5 \
    my-high-throughput-api

# Configure globally in /etc/docker/daemon.json:
{
  "log-driver": "json-file",
  "log-opts": {
    "mode": "non-blocking",
    "max-buffer-size": "4m",
    "max-size": "50m",
    "max-file": "3"
  }
}`,
    recallHint: "Blocking logging freezes apps on slow log shippers. mode=non-blocking uses ring-buffer to guarantee app never hangs.",
    interviewTip: "In financial, payment, and high-throughput microservice architectures, emphasize that dropping a non-critical debug log is infinitely preferable to freezing customer payment transactions.",
    tags: ["non-blocking-logs", "logging-deadlock", "ring-buffer", "resilience", "production"],
    practice: [
      "What happens when the `max-buffer-size` ring buffer is completely full in non-blocking mode?",
      "How do you monitor dropped log line counts in Docker Engine telemetry?"
    ]
  }),

  createCard({
    idNum: 99,
    category: "Logging, Monitoring, Resource Limits & Telemetry",
    concept: "Dual-Logging Architecture in Docker Engine",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is Docker Dual-Logging, and why was `docker logs` historically broken when using remote logging drivers?",
    quickAnswer: "Historically, configuring an external logging driver (like `syslog`, `fluentd`, or `awslogs`) completely broke the `docker logs` CLI command with error `\"configured logging driver does not support reading\"`. **Dual-Logging** (Docker 20.10+) automatically caches a local copy of recent logs using the `local` driver, allowing `docker logs` to work seamlessly regardless of which remote driver is active.",
    detailedAnswer: "Before Docker 20.10, if an operations team routed logs to an ELK stack or Datadog via `syslog`, developers debugging a container on the host could not use `docker logs -f <container>`. They were forced to log into the centralized web dashboard. Dual-Logging introduced an automatic local buffer cache on the host. Logs are forwarded to the remote destination while simultaneously maintaining a fast, rotated local ring-buffer for CLI inspection.",
    code: `# Run container shipping logs to remote Syslog, while retaining local 'docker logs' access:
$ docker run -d --name dual-logging-demo \
    --log-driver syslog \
    --log-opt syslog-address="udp://192.168.1.50:514" \
    nginx:alpine

# In Docker 20.10+, this command SUCCEEDS thanks to Dual-Logging:
$ docker logs -n 50 dual-logging-demo
# 172.17.0.1 - - [04/Nov/2026:10:00:00 +0000] "GET / HTTP/1.1" 200 ...

# Disable dual-logging local cache if disk writes must be strictly eliminated:
# $ docker run --log-opt cache-disabled=true ...`,
    recallHint: "Dual-Logging keeps a local buffer so `docker logs` works even when streaming to remote syslog/fluentd/awslogs.",
    interviewTip: "Mention `cache-disabled=true`: if you run on ultra-constrained flash memory or security environments where logs must NEVER touch local disk, you can disable the dual-logging local cache.",
    tags: ["dual-logging", "docker-logs", "syslog", "fluentd", "observability"],
    practice: [
      "Why did legacy versions of Docker disable `docker logs` when using third-party logging drivers?",
      "How does `cache-max-size` tune the local buffer capacity when dual-logging is enabled?"
    ]
  }),

  createCard({
    idNum: 100,
    category: "Logging, Monitoring, Resource Limits & Telemetry",
    concept: "Memory Limits & Linux OOM Killer Deep Dive (--memory)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How does the Linux Out-Of-Memory (OOM) Killer operate on Docker containers, and what do `--memory` and `--memory-swap` control?",
    quickAnswer: "`--memory` (or `-m`) sets the maximum user memory limit for the container cgroup. If the container exceeds this limit, the Linux kernel terminates its processes with `SIGKILL` (Exit Code 137, `OOMKilled: true`). `--memory-swap` controls total memory PLUS swap (e.g. `--memory=512m --memory-swap=1g` allows 512MB RAM + 512MB Swap). Setting `--memory-swap` equal to `--memory` disables swap entirely.",
    detailedAnswer: "In Linux, every process has an `oom_score` based on memory consumption. Docker assigns an `oom_score_adj` to containers. When physical RAM is exhausted, the kernel scans processes and kills the one with the highest score. If a container is restricted via cgroups, the kernel invokes the cgroup-level OOM killer specifically on that container without affecting other containers or host processes. If swap is enabled, the container will page memory to disk, causing extreme latency spikes before OOM occurs.",
    code: `# 1. Hard memory ceiling with SWAP DISABLED (Best for production microservices):
$ docker run -d --name memory-capped \
    --memory="512m" \
    --memory-swap="512m" \
    my-app

# 2. Allow 512MB RAM + 512MB Swap (Total 1GB):
$ docker run -d --memory="512m" --memory-swap="1g" my-app

# 3. Soft memory reservation (cgroups memory.low):
# Docker only throttles this container if the host experiences general memory pressure:
$ docker run -d --memory="1g" --memory-reservation="256m" my-app

# 4. Inspect if a stopped container was killed by OOM:
$ docker inspect -f 'ExitCode: {{.State.ExitCode}}, OOMKilled: {{.State.OOMKilled}}' memory-capped
# ExitCode: 137, OOMKilled: true`,
    recallHint: "--memory sets RAM limit. If exceeded -> Exit Code 137 (OOMKilled). Set memory-swap equal to memory to disable swap.",
    interviewTip: "In Java/Node.js interviews, emphasize aligning runtime heap limits (e.g. `-XX:MaxRAMPercentage=75.0` or `--max-old-space-size`) with the Docker `--memory` limit, leaving 25% overhead for OS and native memory buffers.",
    tags: ["memory-limits", "oom-killer", "exit-137", "cgroups", "swap"],
    practice: [
      "What happens if a Java JVM container has `--memory=512m` but its JVM `-Xmx` is set to 512MB?",
      "Why should swap memory be completely disabled for latency-critical database and cache containers?"
    ]
  }),

  createCard({
    idNum: 101,
    category: "Logging, Monitoring, Resource Limits & Telemetry",
    concept: "CPU Throttling: CFS Quota (--cpus) vs Shares (--cpu-shares)",
    priority: "must-know",
    difficulty: "advanced",
    question: "What is the difference between CPU CFS Quota (`--cpus`) and CPU Shares (`--cpu-shares`), and how does CPU throttling occur?",
    quickAnswer: "`--cpus` enforces a **hard limit** on CPU time using the Linux Completely Fair Scheduler (CFS) bandwidth controller (e.g. `--cpus=\"1.5\"` allows at most 1.5 CPU cores of compute per period, throttling threads if exceeded). `--cpu-shares` (default 1024) is a **soft relative weight**: it only prioritizes CPU time when the host is under 100% CPU contention.",
    detailedAnswer: "In Linux CFS, time is divided into periods (default `--cpu-period=100000` microseconds, or 100ms). Setting `--cpus=\"2.0\"` sets `cpu-quota=200000`. A multi-threaded container can burn 200ms of CPU time across multiple cores within that 100ms window. If it exhausts its quota in the first 40ms, the Linux kernel **throttles the container threads**, suspending execution for the remaining 60ms! In contrast, `--cpu-shares` is non-throttling: if the host CPU is idle, a container with low shares can consume 100% of all host CPU cores.",
    code: `# 1. Enforce hard CPU ceiling (Max 1.5 cores, throttles if exceeded):
$ docker run -d --name throttled-app \
    --cpus="1.5" \
    my-app

# 2. Soft relative priority (Give high-priority batch job 2048 shares, low job 512):
$ docker run -d --name batch-high --cpu-shares=2048 high-app
$ docker run -d --name batch-low --cpu-shares=512 low-app

# 3. Inspect CPU throttling metrics directly in cgroups v2:
$ cat /sys/fs/cgroup/system.slice/docker-<id>.scope/cpu.stat
# usage_usec 1450201020
# user_usec 1120405000
# system_usec 329796020
# nr_periods 15420       # Number of CFS periods elapsed
# nr_throttled 3410      # Number of periods container was THROTTLED!
# throttled_usec 421000  # Total microseconds spent frozen in throttle!`,
    recallHint: "--cpus = HARD ceiling (CFS quota, causes throttling). --cpu-shares = SOFT relative weight under contention.",
    interviewTip: "Explain why CPU throttling causes severe p99 latency spikes in microservices: when threads are throttled by CFS quota, HTTP requests are suspended mid-execution until the next 100ms CFS period begins.",
    tags: ["cpu-limits", "cfs-quota", "cpu-shares", "throttling", "performance"],
    practice: [
      "Why can a container experience CPU throttling even if average CPU utilization in `docker stats` is only 40%?",
      "How does adjusting `--cpu-period` to 20ms reduce latency jitter in real-time APIs?"
    ]
  }),

  createCard({
    idNum: 102,
    category: "Logging, Monitoring, Resource Limits & Telemetry",
    concept: "CPU Core Pinning & NUMA Node Optimization (--cpuset-cpus)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do `--cpuset-cpus` and `--cpuset-mems` pin container execution to specific physical CPU cores and NUMA memory nodes?",
    quickAnswer: "`--cpuset-cpus=\"0,1\"` pins container execution strictly to physical CPU cores 0 and 1, preventing the Linux scheduler from migrating threads across cores. `--cpuset-mems=\"0\"` binds memory allocations to NUMA memory node 0. This maximizes CPU L1/L2/L3 cache locality and eliminates Non-Uniform Memory Access (NUMA) bus traversal latency.",
    detailedAnswer: "In multi-socket enterprise servers (e.g. dual Intel Xeon or AMD EPYC), memory access is non-uniform (NUMA): accessing RAM physically attached to Socket 0 takes ~60ns, while accessing RAM attached to Socket 1 across the interconnect takes ~100ns+. By binding latency-critical databases (Redis, ClickHouse, PostgreSQL) to the exact CPU cores and memory nodes physically co-located on the same socket, latency is slashed and context switching overhead is eliminated.",
    code: `# Pin Redis container to dedicated physical cores 2 and 3:
$ docker run -d --name ultra-fast-redis \
    --cpuset-cpus="2,3" \
    --cpuset-mems="0" \
    redis:alpine

# Verify pinned CPU core affinity on Linux host using taskset:
$ REDIS_PID=$(docker inspect -f '{{.State.Pid}}' ultra-fast-redis)
$ taskset -c -p $REDIS_PID
# pid 18450's current affinity list: 2,3

# Pin across a range of cores:
$ docker run -d --cpuset-cpus="0-7" my-high-core-service`,
    recallHint: "--cpuset-cpus pins container to dedicated physical CPU cores for maximum L1/L2 cache locality.",
    interviewTip: "Highlight the use case: dedicated core pinning is standard for in-memory databases (Redis) and telecommunications/media encoding, ensuring unpredictable background OS tasks never steal CPU cycles from core processes.",
    tags: ["cpuset", "numa", "core-pinning", "cpu-affinity", "hpc"],
    practice: [
      "What is NUMA (Non-Uniform Memory Access) and how does cross-socket memory access degrade database latency?",
      "Can `--cpuset-cpus` and `--cpus` be combined in the same `docker run` command?"
    ]
  }),

  createCard({
    idNum: 103,
    category: "Logging, Monitoring, Resource Limits & Telemetry",
    concept: "Disk I/O Throttling with Block I/O Controller (--device-read-bps)",
    priority: "must-know",
    difficulty: "advanced",
    question: "How do you throttle container disk read/write bandwidth and IOPS to prevent a noisy neighbor from starving host storage?",
    quickAnswer: "Use the Linux Block I/O (`blkio`) cgroup controller flags: `--device-read-bps` and `--device-write-bps` (limit bytes per second, e.g. `10mb`), and `--device-read-iops` and `--device-write-iops` (limit operations per second).",
    detailedAnswer: "In multi-tenant container environments, a runaway batch job or database dump container can saturate the host physical SSD, driving disk I/O queue depths to 100% and stalling critical web servers on the same node ('noisy neighbor problem'). By applying block I/O rate limits directly to the host block device (e.g. `/dev/sda` or `/dev/nvme0n1`), the Linux kernel throttles the container's disk throughput.",
    code: `# Limit write speed on physical NVMe drive to 20 Megabytes/second:
$ docker run -d --name throttled-writer \
    --device-write-bps /dev/nvme0n1:20mb \
    my-heavy-writer

# Limit disk operations to 100 IOPS:
$ docker run -d --name capped-iops \
    --device-write-iops /dev/sda:100 \
    my-heavy-db

# Test throttling using dd inside container:
$ docker exec -it throttled-writer dd if=/dev/zero of=/tmp/test.img bs=1M count=50 oflag=direct
# 50 MB copied in 2.5001 s, 20.0 MB/s  <-- Exactly 20MB/s bandwidth limit enforced!`,
    recallHint: "Throttle disk I/O: --device-write-bps /dev/sda:20mb and --device-write-iops /dev/sda:100.",
    interviewTip: "Always mention `oflag=direct` when testing with `dd`: without direct I/O, writes enter the Linux page cache in RAM first and will not immediately reflect block device I/O throttling limits.",
    tags: ["blkio", "iops", "disk-throttling", "noisy-neighbor", "cgroups"],
    practice: [
      "What is the difference between direct I/O and buffered page-cache I/O in Block I/O accounting?",
      "Why does cgroups v2 provide superior block I/O throttling compared to cgroups v1?"
    ]
  }),

  createCard({
    idNum: 104,
    category: "Logging, Monitoring, Resource Limits & Telemetry",
    concept: "Real-Time Resource Monitoring with docker stats",
    priority: "must-know",
    difficulty: "beginner",
    question: "How do you monitor container CPU, Memory, Network, and Block I/O consumption in real-time using `docker stats`?",
    quickAnswer: "Run `docker stats` for an interactive live terminal dashboard displaying Container ID, Name, CPU %, Memory Usage / Limit, Memory %, Network I/O, Block I/O, and PIDs. Use `--no-stream` for a single-pass snapshot suitable for shell scripting.",
    detailedAnswer: "`docker stats` reads directly from the Linux `/sys/fs/cgroup/` filesystem for each container. It provides instantaneous visibility into resource bottlenecks. Passing custom Go template formatting with `--format` allows developers to extract precise numeric metrics or output raw JSON for automated monitoring pipelines.",
    code: `# 1. Interactive real-time streaming dashboard across all running containers:
$ docker stats

# Sample Terminal Output:
# CONTAINER ID   NAME       CPU %     MEM USAGE / LIMIT     MEM %     NET I/O           BLOCK I/O         PIDS
# 3a1b4c9e8f12   web-api    0.15%     65.2MiB / 512MiB      12.73%    1.2MB / 450KB     12MB / 0B         8
# 7d8e9f0a1b2c   redis      0.02%     12.8MiB / 256MiB      5.00%     5.8MB / 12.1MB    0B / 0B           4

# 2. Single-pass non-streaming snapshot for shell scripts:
$ docker stats --no-stream

# 3. Extract JSON formatted output:
$ docker stats --no-stream --format '{{json .}}' | jq .

# 4. Filter to monitor specific containers only:
$ docker stats web-api postgres-db`,
    recallHint: "docker stats: real-time dashboard of CPU, Memory, Network, Block I/O. Use --no-stream for scripts.",
    interviewTip: "Explain why Memory Usage in `docker stats` may differ from `top` or `free` inside the container: `docker stats` reports cgroup RSS + Page Cache memory, whereas tools inside the container often misinterpret host total memory.",
    tags: ["docker-stats", "monitoring", "telemetry", "metrics", "troubleshooting"],
    practice: [
      "How do you sort `docker stats` output by memory consumption?",
      "Why did older runtimes running Java inside containers calculate heap limits based on total host RAM instead of cgroup limits?"
    ]
  }),

  createCard({
    idNum: 105,
    category: "Logging, Monitoring, Resource Limits & Telemetry",
    concept: "Prometheus Native Metrics Endpoint in Docker Daemon",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you configure the Docker Engine to expose native Prometheus metrics for automated observability?",
    quickAnswer: "Enable the experimental metrics endpoint in `/etc/docker/daemon.json` by configuring `\"metrics-addr\": \"0.0.0.0:9323\"` and `\"experimental\": true`. The daemon exposes standard Prometheus-formatted metrics at `http://host:9323/metrics`.",
    detailedAnswer: "Historically, scraping Docker metrics required running third-party exporter sidecars (like Google's cAdvisor). Modern Docker Engine has a built-in Prometheus metrics collector that exports daemon events, container state counters (running, stopped, paused), engine memory/CPU usage, and image build metrics. Prometheus can scrape this endpoint directly.",
    code: `# 1. Configure /etc/docker/daemon.json:
{
  "metrics-addr": "0.0.0.0:9323",
  "experimental": true
}

# 2. Reload Docker daemon:
$ sudo systemctl reload docker

# 3. Scrape metrics using curl:
$ curl http://localhost:9323/metrics
# HELP engine_daemon_container_states_containers Number of containers in various states
# TYPE engine_daemon_container_states_containers gauge
# engine_daemon_container_states_containers{state="running"} 5
# engine_daemon_container_states_containers{state="stopped"} 2
# engine_daemon_container_states_containers{state="paused"} 0
# HELP builder_builds_failed_total Total number of failed builds
# TYPE builder_builds_failed_total counter
# builder_builds_failed_total 1`,
    recallHint: "Expose Prometheus metrics on port 9323: set metrics-addr: 0.0.0.0:9323 and experimental: true in daemon.json.",
    interviewTip: "Differentiate Docker Engine metrics (port 9323: daemon health, total container counts) from cAdvisor (detailed per-container CPU/memory timeseries metrics). Enterprise stacks use both.",
    tags: ["prometheus", "metrics", "observability", "daemon-config", "monitoring"],
    practice: [
      "How do you configure a `prometheus.yml` scrape job to ingest Docker daemon metrics?",
      "What is Google cAdvisor and why is it used alongside the native Docker metrics endpoint?"
    ]
  }),

  createCard({
    idNum: 106,
    category: "Logging, Monitoring, Resource Limits & Telemetry",
    concept: "Inspecting Kernel Cgroups Directly under /sys/fs/cgroup",
    priority: "must-know",
    difficulty: "advanced",
    question: "Where are container resource limits and statistics physically stored in the Linux kernel filesystem, and how do you read them directly?",
    quickAnswer: "All container resource limits and usage metrics are exposed via the Linux virtual filesystem at **`/sys/fs/cgroup/`** (in cgroups v2: `/sys/fs/cgroup/system.slice/docker-<id>.scope/`). Reading these pseudo-files (`memory.current`, `memory.max`, `cpu.stat`) provides raw, zero-overhead kernel metrics without invoking the Docker CLI.",
    detailedAnswer: "When `docker stats` or a monitoring agent runs, it does not invent metrics; it simply reads text files in `/sys/fs/cgroup/`. Inside a running container, reading `/sys/fs/cgroup/memory.max` reveals its own hard memory limit in bytes. In cgroups v2, unified interface files include `memory.current` (bytes used), `memory.stat` (page cache breakdown), and `cpu.stat` (CFS periods throttled).",
    code: `# 1. From INSIDE a container: Check its own cgroups v2 memory limit:
$ docker run --rm -m 256m alpine cat /sys/fs/cgroup/memory.max
268435456  # Exactly 256MB in bytes!

# 2. Check current real-time memory usage from inside container:
$ docker run --rm -m 256m alpine cat /sys/fs/cgroup/memory.current
1843200    # ~1.8MB active memory

# 3. From the Linux HOST: Read metrics for a running container:
$ CONTAINER_ID=$(docker inspect -f '{{.Id}}' my-app)
$ cat /sys/fs/cgroup/system.slice/docker-\${CONTAINER_ID}.scope/memory.current
$ cat /sys/fs/cgroup/system.slice/docker-\${CONTAINER_ID}.scope/cpu.stat`,
    recallHint: "Kernel metrics live in /sys/fs/cgroup/. Reading memory.current and memory.max gives raw cgroup metrics.",
    interviewTip: "Modern runtimes (Node 16+, Java 11+, Go 1.19+) natively read `/sys/fs/cgroup/` to automatically configure garbage collection thresholds to match container limits.",
    tags: ["cgroups-sysfs", "linux-kernel", "memory-max", "metrics", "internals"],
    practice: [
      "How did legacy cgroups v1 organize paths (`/sys/fs/cgroup/memory/docker/`) vs cgroups v2 unified paths?",
      "How does the JVM use `UseContainerSupport` to inspect `/sys/fs/cgroup/` automatically?"
    ]
  }),

  createCard({
    idNum: 107,
    category: "Logging, Monitoring, Resource Limits & Telemetry",
    concept: "Emergency Log Truncation Without Container Restarts",
    priority: "must-know",
    difficulty: "intermediate",
    question: "How do you immediately truncate a 50GB runaway container log file on a full disk without stopping or restarting the production container?",
    quickAnswer: "Do NOT use `rm`! Deleting the open file with `rm` does NOT reclaim disk space (the active file descriptor keeps the inodes allocated). Instead, **truncate the file in-place to 0 bytes** using: **`truncate -s 0 /var/lib/docker/containers/<id>/<id>-json.log`** (or `> /path/to/logfile`).",
    detailedAnswer: "In Unix systems, deleting an open file with `rm` simply removes its directory entry ('unlink'). The kernel retains the disk blocks as long as the Docker daemon holds an open write file handle, so `df -h` still reports 100% full! Truncating with `truncate -s 0` shrinks the file size to 0 bytes immediately in-place, releasing all allocated disk blocks back to the filesystem while preserving the daemon's open file descriptor.",
    code: `# 1. EMERGENCY OUTAGE: Host disk is at 100% due to runaway container log:
$ df -h /
# /dev/sda1   100G  100G     0 100% /  <-- DISK EXHAUSTED!

# 2. Find the offending huge log file:
$ sudo find /var/lib/docker/containers/ -name "*-json.log" -size +10G
# /var/lib/docker/containers/e1a2b3.../e1a2b3...-json.log (48GB!)

# 3. WRONG (Does not reclaim disk space while container runs!):
# $ sudo rm /var/lib/docker/containers/e1a2b3.../e1a2b3...-json.log

# 4. CORRECT PRODUCTION REMEDIATION: Truncate in-place to 0 bytes:
$ sudo truncate -s 0 /var/lib/docker/containers/e1a2b3*/*-json.log

# Verify disk space is instantly reclaimed:
$ df -h /
# /dev/sda1   100G   52G   48G  52% /  <-- 48GB INSTANTLY RECLAIMED!`,
    recallHint: "Never rm an active log file! Truncate in-place to 0 bytes: truncate -s 0 *-json.log to reclaim disk instantly.",
    interviewTip: "This is a classic SRE war-story interview question. Explaining the difference between `unlink()` and `truncate()` file descriptor semantics proves production battle-hardening.",
    tags: ["log-truncation", "emergency-response", "disk-full", "truncate", "troubleshooting"],
    practice: [
      "Why does deleting an open file with `rm` fail to free disk space until the process exits?",
      "How do you inspect open deleted files on Linux using `lsof +L1`?"
    ]
  }),

  createCard({
    idNum: 108,
    category: "Logging, Monitoring, Resource Limits & Telemetry",
    concept: "PID Limits & Fork Bomb Defense (--pids-limit)",
    priority: "must-know",
    difficulty: "intermediate",
    question: "What is a Fork Bomb attack, and how does `--pids-limit` protect the host operating system from catastrophic freezing?",
    quickAnswer: "A Fork Bomb (`:(){ :|:& };:`) is a Denial of Service attack where a process spawns infinite child processes in a tight recursion loop, exhausting the Linux kernel process table (`kernel.pid_max`). Once exhausted, the host cannot spawn ANY new processes (even `ssh` or `sudo` fail). **`--pids-limit=100`** caps the maximum number of simultaneous processes the container can create.",
    detailedAnswer: "Without PID limits, a single compromised container or a buggy script running `fork()` inside a container will saturate all 32,768 (or 4,194,304) process slots on the entire physical host server. Sysadmins are locked out of SSH, monitoring agents crash, and the only recourse is a hard hardware power cycle. Setting `--pids-limit` instructs the Linux `pids` cgroup controller to reject `clone()` and `fork()` calls once the quota is reached.",
    code: `# 1. Run container protected against fork bombs (Max 100 PIDs):
$ docker run -d --name safe-app \
    --pids-limit=100 \
    my-app

# 2. In Docker Compose:
# services:
#   web:
#     image: my-app:latest
#     pids_limit: 100

# 3. Configure default global pids-limit in /etc/docker/daemon.json:
{
  "default-pids-limit": 150
}

# 4. Test fork-bomb defense (Container is stopped safely without crashing host!):
$ docker run --rm --pids-limit=50 alpine sh -c ':(){ :|:& };:'
# sh: can't fork: Resource temporarily unavailable (Host remains 100% healthy!)`,
    recallHint: "--pids-limit caps max processes; stops fork bombs from exhausting host kernel.pid_max table.",
    interviewTip: "Recommend setting `\"default-pids-limit\": 150` in `/etc/docker/daemon.json` globally across all enterprise clusters to protect nodes against accidental recursive subprocess loops.",
    tags: ["pids-limit", "fork-bomb", "dos-protection", "cgroups", "security"],
    practice: [
      "What is `/proc/sys/kernel/pid_max` and what happens when it is exceeded?",
      "Why does a Java Spring Boot or Go application typically require a `--pids-limit` of at least 100-200 threads?"
    ]
  })
];
